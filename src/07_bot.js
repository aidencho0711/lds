// ============================================================
// 07_bot.js — 봇 AI
//  상태: 착지 → 탐색/파밍/이동 ↔ 적 탐지 → 전투/엄폐/후퇴/회복, 안전구역 복귀, 탈락
//  · 시야(거리·시야각·차폐물·연막·자세) 기반 인지, 반응 시간 존재 (월핵 없음)
//  · 총성/발소리를 듣고 오차가 있는 위치를 수색
//  · 마지막 목격 위치 기억 → 놓치면 수색
//  · 1m 격자 A* 경로, 벽 통과 불가, 끼임 감지 후 재탐색
//  · 플레이어와 동일한 무기/탄약/피해/회복 규칙 사용
// ============================================================
const DIFF = {
  easy:   { key: 'easy', view: 75, fov: 55, react: [0.9, 1.5], aimErr: 2.4, settle: 1.8, burst: [2, 4], pause: [0.6, 1.2], cover: 0.15, retreatHp: 25, hear: 0.7, zoneLead: 0.6, grenade: 0, strafe: 0.25, fireRange: 0.8, think: 0.34, headshot: 0.03 },
  normal: { key: 'normal', view: 115, fov: 65, react: [0.45, 0.8], aimErr: 1.25, settle: 1.2, burst: [3, 6], pause: [0.35, 0.8], cover: 0.45, retreatHp: 38, hear: 1.0, zoneLead: 0.9, grenade: 0.25, strafe: 0.5, fireRange: 1.0, think: 0.24, headshot: 0.08 },
  hard:   { key: 'hard', view: 160, fov: 75, react: [0.22, 0.45], aimErr: 0.7, settle: 0.8, burst: [3, 7], pause: [0.25, 0.55], cover: 0.8, retreatHp: 50, hear: 1.35, zoneLead: 1.2, grenade: 0.5, strafe: 0.75, fireRange: 1.2, think: 0.16, headshot: 0.15 },
};
const STATE_KO = { LANDING: '착지', EXPLORE: '탐색', LOOT: '파밍', MOVE: '이동', DETECT: '적 탐지', COMBAT: '전투', COVER: '엄폐', RETREAT: '후퇴', HEAL: '회복', ZONE: '안전구역 복귀', DEAD: '탈락', TOVEH: '차량으로', DRIVE: '운전', BOARD: '동승하러', RIDE: '동승', KNOCKED: '기절', REVIVE: '부활', REGROUP: '합류', HOLD: '엄폐 대기', FOLLOW: '따라가기', ORDER: '지시 이동', DANGER: '위험 경계' };

// 경로 요청 큐 (프레임당 처리량 제한)
const PathQ = { q: [], push(b) { if (!this.q.includes(b)) this.q.push(b); }, run(n, msBudget = 2.5) { const t0 = performance.now(); while (n-- > 0 && this.q.length) { const b = this.q.shift(); b.solvePath(); if (performance.now() - t0 > msBudget) break; } }, clear() { this.q = []; } };

const _e = new THREE.Vector3(), _t = new THREE.Vector3(), _d = new THREE.Vector3(), _items = [];
// ---------- 2층 주택 계단 동선 (봇) ----------
function inRect(r, x, z, m = 0) { return x > r[0] + m && x < r[2] - m && z > r[1] + m && z < r[3] - m; }
function localX(S, x, z) { return (x - S.O[0]) * S.ex[0] + (z - S.O[1]) * S.ex[1]; }
function inStairCol(S, x, z) { return localX(S, x, z) > localX(S, S.T2[0], S.T2[1]) + 0.35; }
// 높이 y의 (x,z)가 계단 있는 건물의 위층이면 그 건물
function upstairsBld(x, z, y) {
  for (const b of W.buildings) if (b.st && y > b.y + 2.2 && inRect(b.rect, x, z, 1.4)) return b;
  return null;
}
// 위층 안에서 P→Q 직선 이동이 칸막이/난간에 막히지 않도록 경유점 추가 (계단 칸 ↔ 방: T2, 오른쪽 방 ↔ 왼쪽 방: 칸막이 문)
function stairRoute(b, pts, px, pz, qx, qz) {
  const S = b.st, lp = localX(S, px, pz), lq = localX(S, qx, qz), cp = inStairCol(S, px, pz), cq = inStairCol(S, qx, qz);
  if (lq < S.xs && lp >= S.xs) { if (cp) pts.push(S.T2); pts.push(S.Dr, S.Dl); }
  else if (lq >= S.xs && lp < S.xs) { pts.push(S.Dl, S.Dr); if (cq) pts.push(S.T2); }
  else if (cp !== cq) pts.push(S.T2);
}

class Brain {
  constructor(c, diffKey) {
    this.c = c; this.d = DIFF[diffKey]; c.brain = this;
    this.state = 'LANDING'; this.stateT = 0; this.thinkT = Math.random() * 0.3;
    this.goal = null; this.goalKind = ''; this.path = null; this.pathI = 0; this.wantPath = null;
    this.stuckT = 0; this.stuckRef = { x: 0, z: 0 }; this.stuckCount = 0;
    this.aware = new Map(); this.target = null; this.noiseT = 0;
    this.investigate = null; this.lootTarget = null; this.cover = null; this.coverT = 0;
    this.visited = new Set(); this.building = null;
    this.burstLeft = 0; this.pauseT = 0; this.track = 0; this.errYaw = 0; this.errPitch = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0; this.scanPhase = Math.random() * 10;
    this.lookYaw = 0; this.dropTarget = null; this.landT = 0; this.personal = Math.random();
    this.lastThink = 0; this.grenadeCd = 0; this.ignore = new Set(); this.aimHead = false;
  }
  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; if (s !== 'COVER') this.cover = null; if (s === 'LOOT') this.lootProg = null; } }

  // ---------- 인지 ----------
  perceive() {
    const c = this.c, d = this.d; c.eye(_e);
    for (const [o, r] of this.aware) { r.visible = false; if (!o.alive) this.aware.delete(o); }
    for (const o of CHARS) {
      if (o === c || !o.alive || o.mode !== 'ground' || o.team === c.team) continue;
      const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z, dist = Math.hypot(dx, dz);
      let range = d.view * (o.stance === 'prone' ? 0.5 : o.stance === 'crouch' ? 0.8 : 1);
      if (G.time - (o.lastShotT || -99) < 1.5) range = Math.max(range, d.view); // 사격 중이면 잘 보임
      if (dist > range) continue;
      const ang = Math.abs(angleDiff(c.yaw, Math.atan2(dx, dz)));
      if (ang > d.fov * DEG && dist > 5) continue;
      o.chest(_t);
      let vis = losClear(_e.x, _e.y, _e.z, _t.x, _t.y, _t.z, c.veh);
      if (!vis) { o.eye(_t); vis = losClear(_e.x, _e.y, _e.z, _t.x, _t.y + 0.05, _t.z, c.veh); }
      if (!vis) continue;
      let r = this.aware.get(o);
      if (!r) { r = { first: G.time, last: -99, x: 0, y: 0, z: 0, react: rnd(d.react[0], d.react[1]) * (1 + dist / 120), heard: -99 }; this.aware.set(o, r); }
      if (G.time - r.last > 4) { r.first = G.time; r.react = rnd(d.react[0], d.react[1]) * (1 + dist / 120) * (ang > 40 * DEG ? 1.4 : 1); }
      r.visible = true; r.last = G.time; r.x = o.pos.x; r.y = o.pos.y; r.z = o.pos.z; r.dist = dist;
      if (G.teamSize > 1 && G.time - (r.shareT || -9) > 1) { r.shareT = G.time; this.shareSpot(o); }
    }
    // 소리: 총성, 폭발, 발소리
    for (const n of G.noises) {
      if (n.t <= this.noiseT || n.by === c || !n.by) continue;
      const dist = Math.hypot(n.x - c.pos.x, n.z - c.pos.z);
      if (n.by.team === c.team) {
        // 팀원 총성: 적이 안 보이면 지원하러 그쪽으로 (소리로 위치를 알 뿐, 적 위치는 모른다)
        if (n.kind === 'shot' && dist > 12 && dist < 170 && !c.knocked && (!this.investigate || G.time - this.investigate.t > 3)) this.investigate = { x: n.x + rnd(-6, 6), z: n.z + rnd(-6, 6), t: G.time, kind: 'mate' };
        continue;
      }
      if (dist > n.r * d.hear) continue;
      const err = dist * (n.kind === 'step' ? 0.15 : 0.1);
      const r = this.aware.get(n.by);
      if (r && r.visible) continue;
      const pos = { x: n.x + rnd(-err, err), z: n.z + rnd(-err, err), t: G.time };
      const iv = this.investigate;
      if (!iv || G.time - iv.t > 6 || (Math.hypot(pos.x - iv.x, pos.z - iv.z) > 15 && (n.kind !== 'step' || iv.kind === 'step'))) { pos.kind = n.kind; this.investigate = pos; }
      else if (n.kind !== 'step') iv.t = G.time;
      if (r) r.heard = G.time;
      // 근처 총성은 그쪽으로 시선을 돌림
      if (dist < 60) this.lookYaw = Math.atan2(n.x - c.pos.x, n.z - c.pos.z);
    }
    this.noiseT = G.time;
  }
  pickTarget() {
    let best = null, bs = 1e9;
    for (const [o, r] of this.aware) {
      if (!r.visible && G.time - r.last > 1.2) continue;
      let s = (r.dist || 50) * (o.hp / 100 * 0.4 + 0.6);
      if (o.knocked) s *= 3; // 기절한 적은 서 있는 적보다 뒤로 (위협이 아님)
      if (o === this.c.lastAttacker && G.time - this.c.lastDamageT < 6) s *= 0.4;
      if (o === this.target) s *= 0.7;
      if (G.teamSize > 1) {
        // 집중 사격: 팀원이 쏘고 있는 적, 팀원을 쏘는 적을 우선 (플레이어가 쏘는 적은 더 우선)
        for (const m of teamMembers(this.c)) {
          if (m === this.c || !m.alive) continue;
          if (m.lastTarget === o && G.time - m.lastTargetT < 5) { s *= m.isPlayer ? 0.45 : 0.7; break; }
          if (m.lastAttacker === o && G.time - m.lastDamageT < 4) { s *= m.isPlayer ? 0.5 : 0.75; break; }
        }
        const ord = this.order(); if (ord && ord.kind === 'attack' && ord.target === o) s *= 0.25;
      }
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }
  onDamaged(attacker, cause) {
    if (!attacker || attacker === this.c || cause === 'zone' || cause === 'fall') return;
    // 부활 중에 맞으면: 거의 끝났으면(남은 4초 이하, 체력이 넉넉하면 6초 이하) 끝까지, 아니면 멈추고 대응
    const rv = this.c.revive;
    if (rv) { const rem = rv.total - rv.t; if (rem > 6 || (rem > 4 && this.c.hp < 60)) { cancelRevive(this.c, true); this.setState('EXPLORE'); } }
    // 피격 방향으로 즉시 경계 (정확한 위치가 아닌 방향 + 오차)
    const dist = Math.hypot(attacker.pos.x - this.c.pos.x, attacker.pos.z - this.c.pos.z), err = dist * 0.12;
    this.investigate = { x: attacker.pos.x + rnd(-err, err), z: attacker.pos.z + rnd(-err, err), t: G.time };
    this.lookYaw = Math.atan2(this.investigate.x - this.c.pos.x, this.investigate.z - this.c.pos.z);
    let r = this.aware.get(attacker);
    if (!r) { r = { first: G.time, last: -99, x: this.investigate.x, y: attacker.pos.y, z: this.investigate.z, react: 0.3, heard: G.time }; this.aware.set(attacker, r); }
    if (this.c.knocked) { this.thinkT = Math.min(this.thinkT, 0.1); return; }
    if (this.state === 'HEAL') this.setState('RETREAT');
    this.thinkT = Math.min(this.thinkT, 0.05);
  }
  // ---------- 기절·부활 ----------
  onKnocked() {
    this.goal = null; this.path = null; this.wantPath = null; this.target = null; this.crawlGoal = null;
    this.reviveTgt = null; this.vehTarget = null; this.exitReq = null; this.burstLeft = 0;
    this.setState('KNOCKED'); this.thinkT = 0;
  }
  // 부활 직후(체력 15): 18초 동안 '조심' 모드 — 적에게 다가가지 않고 엄폐·회복부터.
  // (기절 중에 들은 총성·피격 위치로 바로 달려가 다시 기절하던 문제)
  onRevived() {
    this.goal = null; this.path = null; this.wantPath = null; this.investigate = null; this.cover = null;
    this.recoverUntil = G.time + 18; this.setState('EXPLORE'); this.thinkT = 0;
  }
  // ---------- 팀 정보·지휘 ----------
  // 팀원이 적을 보면 위치를 팀에 알린다 (벽 너머 위치를 '아는' 것뿐 — 보이기 전엔 쏘지 않는다)
  shareSpot(o) {
    if (G.noIntel) return; // (테스트용 비교 스위치)
    for (const m of teamMembers(this.c)) if (m !== this.c && m.brain && standing(m)) m.brain.reportEnemy(o, o.pos.x, o.pos.z);
    if (G.player && sameTeam(G.player, this.c)) {
      HUD.spot(o, this.c);
      const ord = G.teamOrder; if (ord && ord.kind === 'attack' && ord.target === o) { ord.x = o.pos.x; ord.z = o.pos.z; }
    }
  }
  reportEnemy(o, x, z) {
    const c = this.c; if (c.knocked || !o.alive) return;
    let r = this.aware.get(o);
    if (!r) { r = { first: G.time, last: -99, x, y: o.pos.y, z, react: rnd(this.d.react[0], this.d.react[1]), heard: G.time }; this.aware.set(o, r); }
    else if (!r.visible) { r.x = x; r.y = o.pos.y; r.z = z; r.heard = G.time; }
    this.intel = { o, x, z, t: G.time };
    // 무장한 봇만 그쪽을 돌아본다 (맨손 봇이 서로 돌아보다 주먹 싸움이 늘던 문제)
    if (this.usableWeapons().length && (!this.target || !this.aware.get(this.target) || !this.aware.get(this.target).visible)) this.lookYaw = Math.atan2(x - c.pos.x, z - c.pos.z);
  }
  // 플레이어 팀원이면 플레이어 (살아 있을 때) — 플레이어를 따라가고 지시를 받는다
  playerMate() { const p = G.player; return G.teamSize > 1 && p && p.alive && p !== this.c && p.team === this.c.team && p.mode === 'ground' ? p : null; }
  order() { return this.playerMate() ? G.teamOrder : null; }
  // 따라가기 자리: 플레이어 진행 방향 기준 왼뒤·오른뒤·뒤
  followSlot(p) {
    const yaw = Math.hypot(p.vel.x, p.vel.z) > 1 ? Math.atan2(p.vel.x, p.vel.z) : p.yaw;
    const o = [[-4.5, -5], [4.5, -5], [0, -8.5]][(Math.max(1, this.c.slot) - 1) % 3];
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    let x = p.pos.x + rx * o[0] + fx * o[1], z = p.pos.z + rz * o[0] + fz * o[1];
    if (!Nav.isFree(x, z)) { const q = Nav.randomFreeNear(x, z, 4); if (q) { x = q[0]; z = q[1]; } else { x = p.pos.x; z = p.pos.z; } }
    return [x, z];
  }
  // 이동 지시 지점 주변 자리 (팀원마다 다른 방향 3.5m)
  orderSlot(ord) {
    const k = this.c.slot; ord.slots = ord.slots || {};
    if (!ord.slots[k]) { const a = k * 2.1, x = ord.x + Math.cos(a) * 3.5, z = ord.z + Math.sin(a) * 3.5; ord.slots[k] = Nav.isFree(x, z) ? [x, z] : (Nav.randomFreeNear(x, z, 5) || [ord.x, ord.z]); }
    return ord.slots[k];
  }
  // 부활시킬 팀원: 반경 안에서 가장 가까운, 아무도 살리러 가지 않은 기절 팀원
  knockedMate() {
    const c = this.c; if (!G.teams || G.teamSize < 2) return null;
    let best = null, bd = W.big ? 140 : 100;
    for (const m of teamMembers(c)) {
      if (m === c || !m.alive || !m.knocked) continue;
      if (teamMembers(c).some(o => o !== c && o.brain && o.alive && !o.knocked && o.brain.state === 'REVIVE' && o.brain.reviveTgt === m)) continue;
      if (m.revivedBy && m.revivedBy !== c && m.revivedBy.revive) continue;
      if (this.rvSkip && this.rvSkip.m === m && G.time - this.rvSkip.t < 15) continue; // 못 가는 곳(지붕 등)
      const d = Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z); if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  // 팀장: 플레이어 팀이면 플레이어, 아니면 서 있는 첫 팀원 (팀원은 팀장 근처에서 움직인다)
  teamLeader() {
    if (!G.teams || G.teamSize < 2) return null;
    for (const m of teamMembers(this.c)) if (standing(m) && m.mode === 'ground') return m;
    return null;
  }
  regroupRange(ld) { return ld.isPlayer ? 40 : W.big ? 80 : 55; }
  thinkKnocked() {
    const c = this.c; this.setState('KNOCKED'); this.perceive();
    const tgt = this.pickTarget(), tr = tgt ? this.aware.get(tgt) : null; this.target = null;
    if (c.revivedBy) { this.crawlGoal = null; return; }
    // 살리러 오는 팀원 → 그쪽으로, 아니면 가까운 서 있는 팀원 쪽으로, 적이 가까우면 반대쪽으로
    let helper = null, hd = 45;
    for (const m of teamMembers(c)) {
      if (m === c || !standing(m)) continue;
      let d = Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z); if (m.brain && m.brain.reviveTgt === c && m.brain.state === 'REVIVE') d *= 0.3;
      if (d < hd) { hd = d; helper = m; }
    }
    if (helper) { this.crawlGoal = hd > 2 ? { x: helper.pos.x, z: helper.pos.z } : null; return; }
    if (tgt && tr.visible && tr.dist < 45) {
      const ax = c.pos.x - tr.x, az = c.pos.z - tr.z, L = Math.hypot(ax, az) || 1;
      const q = Nav.randomFreeNear(c.pos.x + ax / L * 10, c.pos.z + az / L * 10, 4); this.crawlGoal = q ? { x: q[0], z: q[1] } : null; return;
    }
    this.crawlGoal = null;
  }
  updateKnocked(dt) {
    const c = this.c; c.stance = 'prone'; c.aiming = false; c.combatFacing = false; c.sprint = false;
    let wish = null;
    if (this.crawlGoal && !c.revivedBy) {
      this.moveGoal(this.crawlGoal.x, this.crawlGoal.z, 'crawl'); wish = this.steer();
      if (!wish && !this.wantPath) this.crawlGoal = null;
    }
    if (wish && (wish[0] || wish[1])) c.yaw += angleDiff(c.yaw, Math.atan2(wish[0], wish[1])) * clamp(dt * 3, 0, 1);
    stepPhysics(c, dt, wish ? wish[0] : 0, wish ? wish[1] : 0, c.revivedBy ? 0 : CRAWL_SPEED * (c.inWater ? 1.6 : 1), false);
  }

  // ---------- 장비 판단 ----------
  usableWeapons() { const inv = this.c.inv; return [0, 1, 2].filter(i => { const w = inv.weapons[i]; return w && (w.mag > 0 || inv.count(ITEMS[w.id].ammo) > 0); }); }
  chooseWeapon(dist) {
    const c = this.c, inv = c.inv, list = this.usableWeapons();
    if (!list.length) return;
    let best = list[0], bs = -1;
    for (const i of list) {
      const cls = ITEMS[inv.weapons[i].id].cls;
      let s = weaponScore(inv.weapons[i]);
      if (dist !== undefined) {
        if (dist < 18 && (cls === 'SG' || cls === 'SMG')) s += 40;
        if (dist > 70 && (cls === 'DMR' || cls === 'SR')) s += 40;
        if (dist > 30 && dist < 120 && cls === 'LMG') s += 12;
        if (dist > 90 && (cls === 'SG' || cls === 'PISTOL')) s -= 50;
      }
      if (inv.weapons[i].mag === 0) s -= 10;
      if (s > bs) { bs = s; best = i; }
    }
    if (inv.cur !== best) { inv.cur = best; c.equipT = 0.55; c.reloadT = 0; c.setVisibleGear(); }
  }
  desire(it) {
    const inv = this.c.inv, d = ITEMS[it.id];
    switch (d.type) {
      case 'weapon': {
        if (d.slot === 'secondary') return inv.weapons[2] ? 0 : (inv.weapons[0] ? 6 : 45);
        const a = inv.weapons[0], b = inv.weapons[1];
        if (!a || !b) return (a || b) && (a || b).id === it.id ? 4 : 60 + weaponScore(it.inst) / 3;
        return weaponScore(it.inst) > Math.min(weaponScore(a), weaponScore(b)) + 10 ? 22 : 0;
      }
      case 'ammo': return inv.weapons.some(w => w && ITEMS[w.id].ammo === it.id) && inv.count(it.id) < 150 && inv.room(it.id) > 5 ? 30 : 0;
      case 'heal': return inv.healCount() < 9 && inv.room(it.id) > 0 ? 22 : 0;
      case 'boost': return inv.count('drink') < 2 && inv.room(it.id) > 0 ? 8 : 0;
      case 'vest': case 'helmet': { const g = inv.gear[d.type]; return !g ? 45 : (d.lvl > ITEMS[g.id].lvl ? 32 : 0); }
      case 'bag': { const g = inv.gear.bag; return !g ? 26 : (d.lvl > ITEMS[g.id].lvl ? 20 : 0); }
      case 'att': return inv.weapons.some(w => w && attFits(it.id, w.id) && (!w.att[d.slot] || (d.slot === 'scope' && ITEMS[w.att.scope].zoom < d.zoom))) ? 12 : 0;
      case 'throw': return (it.id === 'frag' ? inv.count('frag') < 2 : inv.count('smoke') < 1) && inv.room(it.id) > 0 ? 9 : 0;
    }
    return 0;
  }
  // anchor·anchorR: 이 지점에서 anchorR 안의 물건만 (플레이어 팀원은 플레이어 곁에서만 줍는다)
  findLoot(radius, anchor, anchorR) {
    const c = this.c; itemsNear(c.pos.x, c.pos.z, radius, _items);
    if (!anchor) { const pm = this.playerMate(); if (pm) { anchor = pm.pos; anchorR = this.usableWeapons().length ? 22 : 40; } }
    let best = null, bs = 0; c.eye(_e);
    for (const it of _items) {
      if (Math.abs(it.y - c.pos.y) > 1.5 || this.ignore.has(it)) continue;
      if (anchor && Math.hypot(it.x - anchor.x, it.z - anchor.z) > anchorR) continue;
      const des = this.desire(it); if (des <= 0) continue;
      const dist = Math.hypot(it.x - c.pos.x, it.z - c.pos.z), s = des - dist * 0.9;
      if (s <= bs) continue;
      if (dist > 9 && !losClear(_e.x, _e.y, _e.z, it.x, it.y + 0.3, it.z)) continue;
      best = it; bs = s;
    }
    return best;
  }

  // ---------- 의사결정 ----------
  think() {
    const c = this.c, d = this.d;
    if (!c.alive) { this.setState('DEAD'); return; }
    if (c.knocked) { this.thinkKnocked(); return; }
    if (c.veh) { if (c.seat > 0) this.thinkRide(); else this.thinkDrive(); return; }
    if (c.mode !== 'ground') { this.setState('LANDING'); return; }
    if (this.state === 'LANDING' && G.time - this.landT < rnd(0.4, 1.2)) return;
    this.perceive();
    const tgt = this.pickTarget();
    const tr = tgt ? this.aware.get(tgt) : null;
    const usable = this.usableWeapons().length > 0;
    const healable = c.inv.bestHeal(c.hp);
    // 플레이어 팀원: 자기장 판단은 플레이어에게 맡긴다 (플레이어와 60m 안이면 자기장으로 따로 가지 않고 따라감)
    const pmz = this.playerMate(), leadZone = !!pmz && Math.hypot(pmz.pos.x - c.pos.x, pmz.pos.z - c.pos.z) < 60;
    const inZoneNow = leadZone || Zone.inside(c.pos.x, c.pos.z, Zone.cur, 0);
    const zonePressure = !leadZone && this.zonePressure();
    this.target = tgt;
    // 조심 모드: 막 부활했거나 체력이 낮으면 돌진·추격·소리 수색을 하지 않는다
    const recovering = G.time < (this.recoverUntil || 0);
    const pm = this.playerMate(), ord = pm ? G.teamOrder : null;
    const cautious = this.cautious = recovering || c.hp < 35;

    // 무기 정비
    if (usable && (!c.weapon || (c.weapon.mag === 0 && c.inv.count(ITEMS[c.weapon.id].ammo) === 0))) this.chooseWeapon(tr ? tr.dist : undefined);
    if (c.weapon && c.weapon.mag === 0 && c.reloadT <= 0) startReload(c);
    if (!tgt && c.weapon && c.reloadT <= 0 && c.weapon.mag < c.inv.magSize(c.weapon) * 0.5) startReload(c);

    // 팀원 부활: 서 있는 적이 안 보이거나 멀고(기절한 팀원이 바로 옆이면 30m), 최근 3초간 맞지 않았으면 (진행 중이면 유지)
    let threatD = Infinity; for (const [o, r] of this.aware) if (r.visible && !o.knocked && r.dist < threatD) threatD = r.dist;
    let calm = false;
    if (G.teamSize > 1 && G.time - c.lastDamageT > 3) {
      if (threatD > 60) calm = true;
      else if (threatD > 30) { const km = this.reviveTgt && this.reviveTgt.knocked ? this.reviveTgt : this.knockedMate(); calm = !!km && Math.hypot(km.pos.x - c.pos.x, km.pos.z - c.pos.z) < 20; }
    }
    // 부활 진행 중: 적이 보인다고 바로 멈추지 않는다 — 남은 시간이 4초를 넘고, 실제로 맞고 있거나 서 있는 적이 25m 안에 보일 때만 멈춤
    if (c.revive) {
      const rem = c.revive.total - c.revive.t, shot = G.time - c.lastDamageT < 1.2;
      if (rem > 4 && (threatD < 25 || (shot && (rem > 6 || c.hp < 60)))) cancelRevive(c, true);
    }
    if (this.state === 'REVIVE' && this.reviveTgt && this.reviveTgt.alive && this.reviveTgt.knocked && (calm || c.revive) && this.stateT < 45) return;
    if (calm && !(this.state === 'REVIVE' && this.stateT >= 45)) {
      const m = this.knockedMate();
      // 막 부활한 봇은 회복 아이템이 있으면 자기부터, 다른 팀원은 바로 옆(15m)일 때만 살리러 간다
      const ok = m && (!recovering || (!healable && Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z) < 15));
      if (ok && !(Zone.dps > 3 && !Zone.inside(m.pos.x, m.pos.z, Zone.cur, 0))) { this.reviveTgt = m; c.heal = null; this.setState('REVIVE'); return; }
    }
    if (c.heal && (!tgt || !tr.visible)) { this.setState('HEAL'); return; }
    // 대형 맵: 맨손이면 자기장으로 이동 중이라도 가까운 무기는 줍고 간다 (안 그러면 끝까지 맨손). 적이 보이면 아래 판단에 맡김
    if (W.big && !usable && !(tgt && tr.visible) && (inZoneNow || Zone.dps <= 1.5)) {
      if (this.state === 'LOOT' && this.lootTarget && this.lootTarget.alive && this.stateT < 12) { if (c.hp > 30) return; }
      else if (c.hp > 45) { const l = this.findLoot(32); if (l) { this.lootTarget = l; this.setState('LOOT'); return; } }
    }
    // 안전구역 밖에서 자기장이 조여 오면 무엇보다 우선
    // 차량: 자기장이 멀면 근처 차량을 타러 간다 (적이 안 보일 때)
    const noEnemy = !tgt || !tr.visible;
    // 동승: 팀원이 운전 중이거나 플레이어가 탄 차에 빈자리가 있으면 타러 간다
    if (noEnemy && !recovering) {
      if (this.state === 'BOARD' && this.vehTarget && Veh.freeSeats(this.vehTarget) && !this.vehTarget.dead && this.stateT < 20) return;
      const bv = this.boardTarget(); if (bv) { this.vehTarget = bv; this.setState('BOARD'); return; }
    }
    if (this.state === 'TOVEH' && this.vehTarget && !this.vehTarget.driver && !this.vehTarget.dead && this.stateT < 25 && noEnemy) return;
    if (noEnemy && (usable || zonePressure) && this.wantVehicle()) {
      const crew = 1 + (G.teamSize > 1 ? teamMembers(c).filter(m => m !== c && standing(m) && Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z) < 60).length : 0);
      const v = Veh.nearestFree(c.pos.x, c.pos.z, W.big ? 90 : 60, (o) => Math.hypot(o.vx, o.vz) < 1 && o.seats.length >= Math.min(crew, 4) && !(this.badVeh && this.badVeh.has(o)));
      if (v) { this.vehTarget = v; this.setState('TOVEH'); return; }
    }
    if (!inZoneNow && (Zone.state === 'shrink' || c.outsideZoneT > 3) && (!tgt || !tr.visible || c.hp < 60)) { this.setState('ZONE'); return; }
    const threatArmed = tgt && !tgt.knocked && tgt.weapon && tgt.weapon.mag > 0;
    // 대형 맵 초반(착지 후 100초): 먼 적보다 파밍 우선 — 맞거나 28m 안에 들어오면 교전 (99명이 4분 안에 2/3 탈락하던 문제)
    const lootPhase = W.big && G.time - this.landT < 100 && G.time - c.lastDamageT > 4;
    if (tgt && tr.visible && !usable) {
      // 비무장: 무장한 적이 가까우면 잠시 이탈, 둘 다 맨손이고 가까우면 근접전, 아니면 파밍 계속
      if (threatArmed && tr.dist < 35 && (G.time - c.lastDamageT < 3 || tr.dist < 15)) {
        const wl = this.findLoot(14);
        if (wl && ITEMS[wl.id].type === 'weapon') { this.lootTarget = wl; this.setState('LOOT'); return; }
        this.setState('RETREAT'); return;
      }
      // 맨손끼리 주먹싸움은 성향이 공격적인 봇만, 아주 가까울 때만 (대형 맵은 더 드물게 — 초반 1~2분에 절반이 죽는 문제)
      if (!threatArmed && tr.dist < (W.big ? 5 : 7) && this.personal > (W.big ? 0.6 : 0.35) && (G.time - tr.first > tr.react)) { this.setState('COMBAT'); return; }
    } else if (tgt && tr.visible && !(lootPhase && tr.dist > 28)) {
      if (G.time - tr.first < tr.react && this.state !== 'COMBAT' && this.state !== 'COVER') { this.setState('DETECT'); return; }
      if (this.state === 'COMBAT' && tr.dist !== undefined && Math.random() < 0.15) this.chooseWeapon(tr.dist);
      if (c.hp < d.retreatHp && healable && tr.dist > 12) { this.setState('RETREAT'); return; }
      if (cautious && !tgt.knocked) {
        if (this.state === 'COVER' && this.cover && this.coverT < 8) return;
        if (this.findCover(tgt)) { this.setState('COVER'); return; }
        if (healable && tr.dist > 8) { this.setState('RETREAT'); return; }
      }
      if (this.state === 'COVER' && this.cover && this.coverT < 3.5) return;
      if ((c.reloadT > 0 || c.hp < d.retreatHp + 15) && Math.random() < d.cover && this.findCover(tgt)) { this.setState('COVER'); return; }
      this.setState('COMBAT'); return;
    }
    // 최근에 본 적 → 수색 / 무기 상황 따라 판단
    if (tgt && G.time - tr.last < 2.5 && usable && !lootPhase && !cautious) {
      if (this.state === 'COVER' && this.coverT < 3) return;
      if (c.inv.count('frag') && Math.random() < d.grenade && this.grenadeCd <= 0 && tr.dist > 10 && tr.dist < 32) { this.throwAt(tr); }
      this.investigate = { x: tr.x, z: tr.z, t: G.time };
    }
    if (this.state === 'RETREAT' && this.stateT < (usable ? 4 : 2.5)) return;
    if (healable && c.hp < 80 && G.time - c.lastDamageT > (cautious ? 1.5 : 2.5) && (!tgt || G.time - tr.last > (cautious ? 1.5 : 3))) { this.startHeal(); this.setState('HEAL'); return; }
    if (!inZoneNow && (Zone.state === 'shrink' || c.outsideZoneT > 1)) { this.setState('ZONE'); return; }
    if (zonePressure && !(this.state === 'LOOT' && this.lootTarget && Math.hypot(this.lootTarget.x - c.pos.x, this.lootTarget.z - c.pos.z) < 8)) { this.setState('ZONE'); return; }
    // 플레이어 지시: 이동(지점 주변 경계, 근처 물건만) / 공격(목표의 마지막 보고 위치로)
    if (ord && ord.kind === 'move' && !recovering) {
      const sp = this.orderSlot(ord);
      if (Math.hypot(sp[0] - c.pos.x, sp[1] - c.pos.z) > 4 && this.state === 'ORDER') return;
      if (this.state === 'LOOT' && this.lootTarget && this.lootTarget.alive && this.stateT < 10) return;
      const l = Math.hypot(sp[0] - c.pos.x, sp[1] - c.pos.z) < 6 ? this.findLoot(14, ord, 12) : null;
      if (l) { this.lootTarget = l; this.setState('LOOT'); return; }
      this.setState('ORDER'); return;
    }
    if (ord && ord.kind === 'attack' && ord.target.alive && usable && !cautious) {
      if (Math.hypot(ord.x - c.pos.x, ord.z - c.pos.z) > 6 || this.state !== 'MOVE') { this.investigate = { x: ord.x + rnd(-3, 3), z: ord.z + rnd(-3, 3), t: G.time, kind: 'order' }; this.setState('MOVE'); return; }
    }
    // 플레이어 따라가기: 24m 넘게 떨어지면 자리로 (막 부활했으면 48m)
    if (pm && !(ord && ord.kind === 'move')) {
      const dl = Math.hypot(pm.pos.x - c.pos.x, pm.pos.z - c.pos.z);
      if (dl > (recovering ? 48 : usable ? 24 : 40) || (this.state === 'FOLLOW' && dl > 9 && this.stateT < 25)) { this.setState('FOLLOW'); return; }
    }
    // 플레이어의 '위험' 표시: 150m 안이면 그쪽을 보고 엄폐(없으면 그 자리에서 앉아 경계) — 25초
    const dg = pm && G.danger;
    if (dg && Math.hypot(dg.x - c.pos.x, dg.z - c.pos.z) < 150 && !(tgt && tr.visible)) {
      if (this.state !== 'DANGER' || this.dangerRef !== dg) { this.dangerRef = dg; this.holdCover = null; const q = this.coverFrom(dg.x, (dg.y || heightAt(dg.x, dg.z)) + 1.5, dg.z); if (q) this.holdCover = { x: q[0], z: q[1] }; }
      this.setState('DANGER'); return;
    }
    // 팀 결집: 팀장에게서 멀어지면 합류 (맨손이면 무기를 찾을 여유를 두 배로)
    const ld = pm ? null : this.teamLeader();
    if (ld && ld !== c && !ld.veh) {
      const dl = Math.hypot(ld.pos.x - c.pos.x, ld.pos.z - c.pos.z), R = this.regroupRange(ld) * (usable ? 1 : 2);
      if ((dl > R || (this.state === 'REGROUP' && dl > R * 0.4)) && (!recovering || dl > R * 2)) { this.setState('REGROUP'); return; }
    }
    if (!usable) { const l = this.findLoot(45); if (l) { this.lootTarget = l; this.setState('LOOT'); return; } }
    // 보급상자: 착지한 상자를 처음 알게 되면 한 번 결정 — 난이도에 따라 확률적으로 찾아간다
    const ad = !tgt ? Airdrop.nearest(c.pos.x, c.pos.z, 230) : null, seen = this.crates || (this.crates = new Set());
    if (ad && !seen.has(ad)) { seen.add(ad); if (Math.random() < (d.key === 'hard' ? 0.85 : d.key === 'normal' ? 0.6 : 0.35) && Zone.inside(ad.x, ad.z, Zone.next || Zone.cur, 0)) this.investigate = { x: ad.x, z: ad.z, t: G.time + 40, kind: 'crate' }; }
    // 맨손 봇은 소리를 조사하지 않는다 (예전엔 판단마다 30% 확률을 굴려 사실상 항상 총소리 쪽으로 달려가 파밍을 못 했다)
    // 팀원이 알려 준 적 위치로 지원 (플레이어 팀원은 플레이어 근처 35m 안일 때만)
    if (this.intel && G.time - this.intel.t < 6 && usable && !cautious && this.intel.o.alive && (!this.investigate || G.time - this.investigate.t > 4)) {
      const iv = this.intel, di = Math.hypot(iv.x - c.pos.x, iv.z - c.pos.z);
      if (di < 160 && (!pm || Math.hypot(iv.x - pm.pos.x, iv.z - pm.pos.z) < 35)) this.investigate = { x: iv.x + rnd(-5, 5), z: iv.z + rnd(-5, 5), t: G.time, kind: 'intel' };
    }
    const ivOk = this.investigate && (!pm || this.investigate.kind === 'order' || Math.hypot(this.investigate.x - pm.pos.x, this.investigate.z - pm.pos.z) < 35);
    if (ivOk && G.time - this.investigate.t < 14 && (usable || this.investigate.kind === 'crate') && !cautious) { this.setState('MOVE'); return; }
    if (c.boost < 40 && c.inv.count('drink') && !tgt && c.hp < 100 && Math.random() < 0.3) this.startBoost();
    if (recovering) {
      // 회복할 게 없으면 바로 옆(12m) 물건만 줍고, 아니면 최근 본 적을 피해 엄폐한 채 버틴다
      if (this.state === 'LOOT' && this.lootTarget && this.lootTarget.alive && this.stateT < 8) return;
      const near = this.findLoot(12); if (near) { this.lootTarget = near; this.setState('LOOT'); return; }
      if (this.state !== 'HOLD') {
        let seen = null; for (const [o, r] of this.aware) if (!o.knocked && o.alive && (!seen || r.last > this.aware.get(seen).last)) seen = o;
        this.cover = null; if (seen && G.time - this.aware.get(seen).last < 30) this.findCover(seen);
        this.holdCover = this.cover; this.setState('HOLD');
      }
      return;
    }
    if (this.state === 'LOOT' && this.lootTarget && this.lootTarget.alive && this.stateT < 15) return;
    const loot = this.findLoot(usable ? 26 : 40);
    if (loot) { this.lootTarget = loot; this.setState('LOOT'); return; }
    this.setState('EXPLORE');
  }
  // ---------- 차량 ----------
  wantVehicle() {
    if (G.time - (this.vehFailT || -99) < 40 || this.personal < 0.1) return false;
    // 팀전: 플레이어 팀원은 직접 운전하지 않고(플레이어 차에 동승만), 봇 팀은 팀장만 운전 — 팀원은 동승
    if (this.playerMate()) return false;
    if (G.teamSize > 1) { const ld = this.teamLeader(); if (ld && ld !== this.c) return false; }
    const z = Zone.next || Zone.cur; if (!z) return false;
    const c = this.c, d = Math.hypot(c.pos.x - z.x, c.pos.z - z.z) - z.r * 0.6;
    return d > (W.big ? 320 : 150);
  }
  // 동승할 차: 같은 팀이 운전 중(또는 플레이어가 탑승)이고 빈자리가 있으며 60m 안, 느리게 움직이는 차
  boardTarget() {
    if (!(G.teamSize > 1)) return null;
    const c = this.c;
    for (const m of teamMembers(c)) {
      if (m === c || !m.alive || !m.veh || (m.seat !== 0 && !m.isPlayer)) continue;
      const v = m.veh; if (v.dead || v.burnT > 0 || !Veh.freeSeats(v) || v.T.animal) continue;
      if (Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z) < 60 && Math.hypot(v.vx, v.vz) < 6) return v;
    }
    return null;
  }
  // 동승 중: 내릴 때 판단 (차에 불, 운전자가 내려 거의 멈춤, 플레이어가 내림)
  thinkRide() {
    const c = this.c, v = c.veh; this.setState('RIDE'); this.perceive();
    const tgt = this.pickTarget(); this.target = tgt;
    const sp = Math.hypot(v.vx, v.vz), pm = this.playerMate();
    let out = v.burnT > 0 || v.dead;
    if (!out && !v.seats[0] && sp < 3 && !(pm && pm.veh === v)) out = true;
    if (!out && pm && pm.veh !== v && sp < 4) out = true;
    if (out && Veh.exit(c, true, v.burnT > 0 || v.dead)) { this.goal = null; this.path = null; this.setState('EXPLORE'); this.thinkT = 0; this.vehFailT = G.time; }
  }
  // 동승 중: 보이는 적을 쏜다 (반응 시간은 똑같이)
  ride(dt) {
    const c = this.c, tgt = this.target, tr = tgt && this.aware.get(tgt);
    c.combatFacing = false; c.aiming = false; c.sprint = false;
    if (tgt && tr && tr.visible && G.time - tr.first > tr.react && this.usableWeapons().length) {
      if (!c.weapon || c.weapon.mag === 0 && c.inv.count(ITEMS[c.weapon.id].ammo) === 0) this.chooseWeapon(tr.dist);
      c.combatFacing = true; this.combat(dt, tgt, tr);
    } else { this.scan(dt); if (c.weapon && c.weapon.mag < c.inv.magSize(c.weapon) * 0.5 && !c.rl) startReload(c); }
  }
  vehFail(v) { this.vehFailT = G.time; if (v) (this.badVeh || (this.badVeh = new Set())).add(v); this.vehTarget = null; this.setState('EXPLORE'); }
  pickDriveDest(z) {
    const c = this.c, dx = c.pos.x - z.x, dz = c.pos.z - z.z, d = Math.hypot(dx, dz) || 1, k = z.r * (0.3 + Math.random() * 0.25);
    let x = z.x + dx / d * k, y = z.z + dz / d * k; const f = Nav.randomFreeNear(x, y, 30); if (f) { x = f[0]; y = f[1]; }
    return { x, z: y, ref: z };
  }
  startDrive() {
    const z = Zone.next || Zone.cur;
    this.driveDest = this.pickDriveDest(z || { x: 0, z: 0, r: 100 }); this.driveT = G.time; this.routeT = -9; this.stuckN = 0; this.revT = 0; this.slowT = 0; this.exitReq = null;
    this.progBest = 1e9; this.progT = G.time; this.path = null; this.goal = null; this.wantPath = null; this.setState('DRIVE');
    this.boardWait = G.teamSize > 1 ? G.time + 12 : 0;
  }
  thinkDrive() {
    const c = this.c, v = c.veh, z = Zone.next || Zone.cur;
    this.perceive();
    const tgt = this.pickTarget(), tr = tgt ? this.aware.get(tgt) : null; this.target = tgt;
    if (z && (!this.driveDest || this.driveDest.ref !== z)) this.driveDest = this.pickDriveDest(z);
    const dd = Math.hypot(c.pos.x - this.driveDest.x, c.pos.z - this.driveDest.z);
    if (dd < this.progBest - 25) { this.progBest = dd; this.progT = G.time; } else if (G.time - this.progT > 20) { this.progT = G.time; this.progBest = dd; this.stuckN++; }
    let why = null;
    if (v.burnT > 0 || v.hp < v.T.hp * 0.3) why = 'damaged';
    else if (G.time - c.lastDamageT < 1.5 && Math.hypot(v.vx, v.vz) < 7) why = 'shot';   // 빠르게 달리는 중이면 그대로 도주
    else if (tgt && tr.visible && this.usableWeapons().length && (tr.dist < 25 || (tr.dist < 60 && Math.hypot(v.vx, v.vz) < 6 && G.time - this.driveT > 3))) why = 'enemy';
    else if (dd < 30 || (z && Math.hypot(c.pos.x - z.x, c.pos.z - z.z) < z.r * 0.55)) why = 'arrived';
    else if (G.time - this.driveT > 150) why = 'timeout';
    else if (this.stuckN >= 4) why = 'stuck';
    if (why && !this.exitReq) this.exitReq = why;
  }
  drive(dt) {
    const c = this.c, v = c.veh, T = v.T, C = v.ctrl, sp = Math.hypot(v.vx, v.vz);
    if (this.exitReq) {
      C.throttle = sp > 1 ? -1 : 0; C.steer = 0; C.hand = sp > 1;
      if (sp < (this.exitReq === 'damaged' ? 99 : 3.5)) {
        const why = this.exitReq;
        if (Veh.exit(c, true)) {
          this.exitReq = null; this.goal = null; this.path = null; this.wantPath = null; this.thinkT = 0;
          if (why === 'stuck' || why === 'timeout') this.vehFail(v); else this.setState(why === 'enemy' || why === 'shot' ? 'COMBAT' : 'EXPLORE');
          if (why !== 'stuck' && why !== 'timeout') this.vehFailT = G.time - (why === 'arrived' ? 0 : 15); // 바로 다시 타지 않게
        } else if (sp < 0.5) { this.exitReq = null; this.stuckN++; }
      }
      return;
    }
    if (this.revT > 0) { this.revT -= dt; C.throttle = -1; C.steer = -this.revSteer; C.hand = false; return; }
    // 팀원이 타러 오는 중이면 최대 12초 기다린다
    if (this.boardWait && G.time < this.boardWait) {
      const coming = Veh.freeSeats(v) && teamMembers(c).some(m => m !== c && m.brain && standing(m) && !m.veh && m.brain.state === 'BOARD' && m.brain.vehTarget === v);
      if (coming) { C.throttle = 0; C.steer = 0; C.hand = true; return; }
      this.boardWait = 0;
    }
    // 경로(보행 내비 경로를 큰 틀로) — 4초마다 다시
    if (G.time - this.routeT > 4 || (!this.path && !this.wantPath)) { this.routeT = G.time; this.goal = null; this.moveGoal(this.driveDest.x, this.driveDest.z, 'drive'); }
    let tx = this.driveDest.x, tz = this.driveDest.z;
    if (this.path) {
      const pts = this.path.pts, la = 7 + sp * 0.7;
      while (this.pathI < pts.length - 1 && Math.hypot(pts[this.pathI][0] - v.pos.x, pts[this.pathI][1] - v.pos.z) < la) this.pathI++;
      if (this.pathI < pts.length) { tx = pts[this.pathI][0]; tz = pts[this.pathI][1]; }
    }
    const err = angleDiff(v.yaw, Math.atan2(tx - v.pos.x, tz - v.pos.z)); // + 이면 왼쪽으로
    let steer = clamp(-err * 2.2, -1, 1);
    let thr = Math.abs(err) < 0.45 ? 1 : Math.abs(err) < 1.0 ? 0.55 : 0.3;
    if (Math.abs(err) > 0.7 && sp > 11) thr = -0.6;
    if (sp > T.vmax * 0.82) thr = Math.min(thr, 0);
    // 장애물·깊은 물 탐지 (앞쪽 3갈래)
    const L = 5 + sp * 0.9, oy = v.pos.y + 1.0, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const ox = v.pos.x + fx * (T.zc + T.hl * 0.9), oz = v.pos.z + fz * (T.zc + T.hl * 0.9);
    const probe = (a) => {
      const yy = v.yaw + a, dx = Math.sin(yy), dz = Math.cos(yy);
      let dd = Math.min(L, rayBoxes(ox, oy, oz, dx, 0, dz, L, true).t);
      for (let s = 3; s < dd; s += 3) { const px = ox + dx * s, pz = oz + dz * s, h = heightAt(px, pz); if (h < WATER_Y - T.wade + 0.2 && groundAt(px, pz, v.pos.y + 1) <= h + 0.05) { dd = s; break; } }
      return dd;
    };
    const dc = probe(0);
    if (dc < L) { const dl = probe(0.5), dr = probe(-0.5); steer = dl >= dr ? -1 : 1; if (dc < 4 + sp * 0.35) thr = sp > 4 ? -0.8 : 0.6; }
    if (thr > 0.3 && sp < 0.8) { this.slowT += dt; if (this.slowT > 1.6) { this.slowT = 0; this.revT = 1.5; this.revSteer = steer >= 0 ? 1 : -1; this.stuckN++; } } else if (sp > 3) this.slowT = 0;
    C.throttle = thr; C.steer = steer; C.hand = false;
  }
  zonePressure() {
    if (!Zone.next) return false;
    const c = this.c, nx = Zone.next, d = Math.hypot(c.pos.x - nx.x, c.pos.z - nx.z) - nx.r * 0.75;
    if (d <= 0) return false;
    const travel = d / 4.6, left = Zone.timeToNextEdge();
    // 대형 맵 첫 원(피해 0.4/s)만: 체력이 버틸 수 있는 시간만큼 여유를 둔다. 2단계부터는 원이 걷는 속도보다 빨리 줄어 여유를 주면 갇혀 죽는다
    let tol = 0;
    if (W.big && Zone.phase === 0) { const P = Zone.phases[0]; tol = clamp((c.hp - 50) / Math.max(0.4, P.dps), 0, 100); }
    return travel * 1.25 * this.d.zoneLead > left + tol - 15 * (this.d.zoneLead - 0.5);
  }
  startHeal() {
    const c = this.c, id = c.inv.bestHeal(c.hp); if (!id || c.heal) return;
    beginHeal(c, id);
  }
  startBoost() { const c = this.c; if (c.heal) return; beginHeal(c, 'drink'); }
  throwAt(tr) {
    const c = this.c; c.eye(_e);
    const dx = tr.x - c.pos.x, dz = tr.z - c.pos.z, dist = Math.hypot(dx, dz);
    const power = clamp(Math.sqrt(dist * GRAVITY * 0.9) * 0.82, 8, 22);
    _d.set(dx / dist * 0.8, 0.45, dz / dist * 0.8).normalize();
    // 수류탄 신관 7초: 봇은 핀을 뽑고 잠시 쥐었다가(쿠킹) 던진 것으로 친다 — 숙련도에 따라 남은 시간 2.6~5.8초
    const left = this.d.key === 'hard' ? rnd(2.6, 3.6) : this.d.key === 'easy' ? rnd(4.8, 5.8) : rnd(3.4, 4.6);
    if (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 20) Audio.pin(c.pos, false);
    if (throwItem(c, 'frag', _e, _d, power, left)) this.grenadeCd = 8;
  }
  throwSmoke(x, z) {
    const c = this.c; c.eye(_e);
    const dx = x - c.pos.x, dz = z - c.pos.z, dist = Math.max(3, Math.hypot(dx, dz));
    const power = clamp(Math.sqrt(dist * GRAVITY * 0.9) * 0.82, 6, 20);
    _d.set(dx / dist * 0.8, 0.45, dz / dist * 0.8).normalize();
    throwItem(c, 'smoke', _e, _d, power, rnd(1.4, 2.0));
  }
  // 엄폐 지점 탐색: 위협 방향에서 시야가 막히는 근처 지점
  findCover(threat) {
    const tr = this.aware.get(threat); if (!tr) return false;
    threat.eye(_t); const p = this.coverFrom(_t.x, _t.y, _t.z); if (!p) return false;
    this.cover = { x: p[0], z: p[1], threat }; this.coverT = 0;
    return true;
  }
  // (tx,ty,tz)에서 보이지 않는 16m 안의 엄폐 지점 [x,z] (없으면 null)
  coverFrom(tx, ty, tz) {
    const c = this.c; _t.set(tx, ty, tz);
    queryBoxes(c.pos.x - 16, c.pos.z - 16, c.pos.x + 16, c.pos.z + 16, _boxes);
    let best = null, bs = 1e9;
    for (const b of _boxes) {
      if (b.soft || b.y1 - c.pos.y < 1.0 || b.y0 > c.pos.y + 1) continue;
      const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2;
      let ax = bx - _t.x, az = bz - _t.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
      const ext = Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 0.9;
      if (ext > 8) continue;
      const px = bx + ax * ext, pz = bz + az * ext;
      const dist = Math.hypot(px - c.pos.x, pz - c.pos.z);
      if (dist > 16 || dist >= bs || !Nav.isFree(px, pz)) continue;
      const gy = groundAt(px, pz, c.pos.y + 1);
      if (losClear(_t.x, _t.y, _t.z, px, gy + 1.0, pz)) continue;
      if (!Zone.inside(px, pz, Zone.cur, -5) && Zone.inside(c.pos.x, c.pos.z, Zone.cur, 0)) continue;
      best = [px, pz]; bs = dist;
    }
    return best;
  }

  // ---------- 경로 ----------
  // y: 목표 높이(선택). 2층 주택 위층이면 계단 동선을 붙인다
  moveGoal(x, z, kind, y) {
    if (this.goal && Math.hypot(this.goal.x - x, this.goal.z - z) < 2.5 && this.goalKind === kind && (y === undefined || this.goal.y === undefined || Math.abs(this.goal.y - y) < 1.5) && (this.path || this.wantPath || this.arrived)) return;
    this.goal = { x, z, y }; this.goalKind = kind; this.path = null; this.arrived = false; this.wantPath = this.goal; PathQ.push(this);
  }
  solvePath() {
    if (!this.wantPath || !this.c.alive) return;
    const c = this.c, wp = this.wantPath; this.wantPath = null;
    const from = this.upB && c.pos.y > this.upB.y + 1.2 && inRect(this.upB.rect, c.pos.x, c.pos.z, 0.5) ? this.upB : null;
    const to = wp.y !== undefined ? upstairsBld(wp.x, wp.z, wp.y) : null;
    const cache = this.coarseCache || (this.coarseCache = {});
    if (!from && !to) { const r = Nav.find(c.pos.x, c.pos.z, wp.x, wp.z, 2500, cache); this.path = r; this.pathI = 1; if (!r) this.arrived = true; return; }
    const pts = [[c.pos.x, c.pos.z]];
    if (from && to === from) { stairRoute(from, pts, c.pos.x, c.pos.z, wp.x, wp.z); pts.push([wp.x, wp.z]); this.setPath(pts, true); return; }
    let sx = c.pos.x, sz = c.pos.z;
    if (from) { const S = from.st; if (localX(S, c.pos.x, c.pos.z) < S.xs) pts.push(S.Dl, S.Dr); if (!inStairCol(S, c.pos.x, c.pos.z)) pts.push(S.T2); pts.push(S.T, S.B, S.A); sx = S.A[0]; sz = S.A[1]; }
    const ex = to ? to.st.A : [wp.x, wp.z];
    const r = Nav.find(sx, sz, ex[0], ex[1], 2500, cache);
    if (!r) { if (from) this.setPath(pts, false); else { this.path = null; this.arrived = true; } return; }
    for (let i = 1; i < r.pts.length; i++) pts.push(r.pts[i]);
    if (to && r.complete) { const S = to.st; pts.push(S.B, S.T); stairRoute(to, pts, S.T[0], S.T[1], wp.x, wp.z); pts.push([wp.x, wp.z]); this.upB = to; }
    this.setPath(pts, r.complete);
  }
  // 현재 경로를 따라 (x,z)까지 남은 거리 (경로 계산 중이면 직선 거리)
  pathRemain(x, z) {
    const c = this.c, P = this.path;
    if (!P || this.pathI >= P.pts.length) return Math.hypot(x - c.pos.x, z - c.pos.z);
    const pts = P.pts; let d = Math.hypot(pts[this.pathI][0] - c.pos.x, pts[this.pathI][1] - c.pos.z);
    for (let i = this.pathI + 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const e = pts[pts.length - 1]; return d + Math.hypot(x - e[0], z - e[1]);
  }
  setPath(pts, complete) { this.path = { pts, complete }; this.pathI = 1; this.arrived = false; }
  // 다음 이동 방향 반환 (도착 시 null)
  steer() {
    const c = this.c;
    if (!this.path) {
      if (this.wantPath) return [0, 0];
      return null;
    }
    const pts = this.path.pts;
    while (this.pathI < pts.length && Math.hypot(pts[this.pathI][0] - c.pos.x, pts[this.pathI][1] - c.pos.z) < 0.9) this.pathI++;
    if (this.pathI >= pts.length) {
      if (!this.path.complete && this.goal && Math.hypot(this.goal.x - c.pos.x, this.goal.z - c.pos.z) > 3) { this.wantPath = this.goal; this.path = null; PathQ.push(this); return [0, 0]; }
      this.path = null; this.arrived = true; return null;
    }
    const p = pts[this.pathI], dx = p[0] - c.pos.x, dz = p[1] - c.pos.z, L = Math.hypot(dx, dz) || 1;
    return [dx / L, dz / L];
  }
  checkStuck(dt, moving) {
    const c = this.c; this.stuckT += dt;
    if (this.stuckT < 1.6) return;
    const m = Math.hypot(c.pos.x - this.stuckRef.x, c.pos.z - this.stuckRef.z);
    if (moving && m < 0.6) {
      this.stuckCount++;
      if (this.goal) { this.wantPath = this.goal; this.path = null; PathQ.push(this); }
      if (this.stuckCount > 2) { this.goal = null; this.path = null; this.building = null; this.stuckCount = 0; c.vel.y = 5; }
    } else this.stuckCount = 0;
    this.stuckT = 0; this.stuckRef.x = c.pos.x; this.stuckRef.z = c.pos.z;
  }

  // ---------- 행동 (매 프레임) ----------
  update(dt) {
    const c = this.c, d = this.d;
    if (!c.alive) return;
    this.stateT += dt; this.grenadeCd -= dt;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.think(); this.thinkT = d.think * rnd(0.8, 1.25); }
    if (c.mode !== 'ground') return;
    if (c.knocked) { this.updateKnocked(dt); return; }
    if (c.veh) { if (c.seat > 0) this.ride(dt); else this.drive(dt); return; }
    let wish = null, speed = 4.6, jump = false;
    c.combatFacing = false; c.aiming = false; c.sprint = false;
    let wantStance = 'stand';
    const tgt = this.target, tr = tgt && this.aware.get(tgt);
    switch (this.state) {
      case 'LANDING': case 'DEAD': break;
      case 'DETECT': {
        if (tr) this.faceToward(tr.x, tr.y + 1.2, tr.z, dt, 3);
        wantStance = d.key !== 'easy' && tr && tr.dist > 25 ? 'crouch' : 'stand';
        break;
      }
      case 'COMBAT': {
        if (!tgt || !tr) break;
        c.combatFacing = true;
        this.combat(dt, tgt, tr);
        const fists = !this.usableWeapons().length;
        const cls = c.weapon && !fists ? ITEMS[c.weapon.id].cls : 'FIST';
        const pref = { SG: 8, SMG: 14, PISTOL: 12, AR: 35, LMG: 40, DMR: 70, SR: 90, FIST: 0.5 }[cls];
        if (fists && tr.visible) { this.moveGoal(tgt.pos.x, tgt.pos.z, 'chase', tgt.pos.y); if (tr.dist > 1.4) { wish = this.steer(); if (!wish || (!wish[0] && !wish[1])) { const dx = tgt.pos.x - c.pos.x, dz = tgt.pos.z - c.pos.z, L = Math.hypot(dx, dz) || 1; wish = [dx / L, dz / L]; } speed = 5.5; } break; }
        const dist = tr.dist || 30;
        if (!tr.visible && G.time - tr.last > 1.2) {
          if (this.cautious) { wantStance = 'crouch'; this.faceToward(tr.x, tr.y + 1.2, tr.z, dt, 3); break; } // 쫓아가지 않고 그 자리에서 경계
          this.moveGoal(tr.x, tr.z, 'chase', tr.y); wish = this.steer(); speed = 4.6; break;
        }
        this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = rnd(0.6, 1.8); this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeOn = Math.random() < d.strafe; }
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        let mx = 0, mz = 0;
        if (dist > pref * 1.6 && !this.cautious) { mx += fx; mz += fz; }
        else if (dist < pref * 0.5 && cls !== 'SG') { mx -= fx; mz -= fz; }
        if (this.strafeOn) { mx += -fz * this.strafeDir; mz += fx * this.strafeDir; }
        const L = Math.hypot(mx, mz);
        if (L > 0.1) {
          mx /= L; mz /= L;
          if (Nav.isFree(c.pos.x + mx * 1.2, c.pos.z + mz * 1.2)) { wish = [mx, mz]; speed = 2.8; c.aiming = true; } else this.strafeDir *= -1;
        } else c.aiming = true;
        if (((cls === 'DMR' || cls === 'SR') && dist > 60 || cls === 'LMG' && dist > 45) && !this.strafeOn) { wantStance = d.key === 'hard' && dist > 90 ? 'prone' : 'crouch'; wish = null; c.aiming = true; }
        else if (!wish && d.key !== 'easy' && Math.random() < 0.002) wantStance = 'crouch';
        else if (!wish) wantStance = this.lastStance === 'crouch' ? 'crouch' : 'stand';
        break;
      }
      case 'COVER': {
        if (!this.cover) { this.setState('COMBAT'); break; }
        const cv = this.cover, dist = Math.hypot(cv.x - c.pos.x, cv.z - c.pos.z);
        if (dist > 0.8 && this.coverT === 0) { this.moveGoal(cv.x, cv.z, 'cover'); wish = this.steer(); speed = 6.2; c.sprint = true; if (!wish && !this.wantPath) this.coverT = 0.01; }
        else {
          this.coverT += dt; wantStance = 'crouch';
          if (tr) this.faceToward(tr.x, tr.y + 1.2, tr.z, dt, 4);
          if (c.weapon && c.weapon.mag < c.inv.magSize(c.weapon) && c.reloadT <= 0) startReload(c);
          if (tgt && tr && tr.visible) { c.combatFacing = true; this.combat(dt, tgt, tr); }
          if (this.coverT > rnd(2.5, 4.5) && c.reloadT <= 0) {
            // 조심 모드: 적이 안 보이면 엄폐한 채 회복, 아니면 더 버틴다(최대 8초) — 엄폐에서 나와 적 쪽으로 가지 않음
            if (this.cautious && !(tr && tr.visible)) { if (c.inv.bestHeal(c.hp)) { this.startHeal(); this.setState('HEAL'); } else if (this.coverT > 8) this.setState('EXPLORE'); }
            else if (!this.cautious || this.coverT > 8) this.setState(tr && tr.visible ? 'COMBAT' : this.cautious ? 'EXPLORE' : 'MOVE');
          }
        }
        break;
      }
      case 'RETREAT': {
        let ax = 0, az = 0;
        if (tr) { ax = c.pos.x - tr.x; az = c.pos.z - tr.z; }
        else { ax = Math.sin(c.yaw + Math.PI); az = Math.cos(c.yaw + Math.PI); }
        const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
        const zc = Zone.next || Zone.cur;
        if (zc) { const zx = zc.x - c.pos.x, zz = zc.z - c.pos.z, zl = Math.hypot(zx, zz) || 1; ax += zx / zl * 0.6; az += zz / zl * 0.6; }
        if (!this.goal || this.goalKind !== 'retreat' || this.stateT < dt * 2) {
          const p = Nav.randomFreeNear(c.pos.x + ax * 30, c.pos.z + az * 30, 10) || [c.pos.x + ax * 20, c.pos.z + az * 20];
          this.moveGoal(p[0], p[1], 'retreat');
        }
        wish = this.steer(); speed = 6.2; c.sprint = true;
        if (!wish && !this.wantPath) this.goal = null;
        if (this.stateT > 3.5 && (!tr || !tr.visible)) { if (c.inv.bestHeal(c.hp)) { this.startHeal(); this.setState('HEAL'); } else this.setState('EXPLORE'); }
        break;
      }
      case 'HEAL': {
        wantStance = 'crouch';
        if (!c.heal) { if (c.inv.bestHeal(c.hp) && c.hp < 90) this.startHeal(); else { this.setState('EXPLORE'); } }
        this.scan(dt);
        break;
      }
      case 'ZONE': {
        const z = Zone.next || Zone.cur;
        if (!this.goal || this.goalKind !== 'zone') {
          const dx = z.x - c.pos.x, dz = z.z - c.pos.z, L = Math.hypot(dx, dz) || 1, depth = z.r * rnd(0.35, 0.7);
          const p = Nav.randomFreeNear(z.x - dx / L * depth, z.z - dz / L * depth, Math.min(25, z.r * 0.3)) || [z.x, z.z];
          this.moveGoal(p[0], p[1], 'zone');
        }
        wish = this.steer(); speed = 6.2; c.sprint = true;
        if (!wish && !this.wantPath) { this.goal = null; this.setState('EXPLORE'); }
        this.scan(dt);
        break;
      }
      case 'REVIVE': {
        const m = this.reviveTgt;
        if (!m || !m.alive || !m.knocked) { this.reviveTgt = null; if (c.revive) cancelRevive(c, true); this.setState('EXPLORE'); break; }
        const dx = m.pos.x - c.pos.x, dz = m.pos.z - c.pos.z, dist = Math.hypot(dx, dz) || 1;
        if (c.revive) { wantStance = 'crouch'; this.faceToward(m.pos.x, m.pos.y + 0.3, m.pos.z, dt, 4); break; }
        if (dist < 1.5 && Math.abs(m.pos.y - c.pos.y) < 1.5) { if (!startRevive(c, m)) { this.reviveTgt = null; this.setState('EXPLORE'); } wantStance = 'crouch'; break; }
        // 최근 적을 봤고 연막탄이 있으면 기절한 팀원과 적 사이에 연막부터
        if (dist < 22 && this.smokedFor !== m && c.inv.count('smoke')) {
          let seen = null; for (const [o, r] of this.aware) if (!o.knocked && G.time - r.last < 12 && (!seen || r.last > seen.last)) seen = r;
          if (seen) { this.smokedFor = m; const sx = m.pos.x + (seen.x - m.pos.x) * 0.25, sz = m.pos.z + (seen.z - m.pos.z) * 0.25; this.throwSmoke(sx, sz); }
        }
        this.moveGoal(m.pos.x, m.pos.z, 'revive', m.pos.y); wish = this.steer(); speed = dist > 8 ? 6.2 : 3.2; c.sprint = dist > 8;
        if (dist < 12 && (!wish || (!wish[0] && !wish[1])) && !this.wantPath) wish = [dx / dist, dz / dist];
        // 6초 동안 0.5m도 못 다가가면(지붕 위·막힌 곳) 포기
        if (this.rvM !== m) { this.rvM = m; this.rvBest = dist; this.rvBestT = G.time; }
        else if (dist < this.rvBest - 0.5) { this.rvBest = dist; this.rvBestT = G.time; }
        if (this.stateT > 45 || G.time - this.rvBestT > 6) { this.rvSkip = { m, t: G.time }; this.rvM = null; this.reviveTgt = null; this.setState('EXPLORE'); }
        this.scan(dt);
        break;
      }
      case 'DANGER': { // 위험 표시 쪽을 경계: 엄폐 지점으로 가서 앉아 그쪽을 본다
        const dg = G.danger; if (!dg) { this.setState('EXPLORE'); break; }
        const cv = this.holdCover;
        if (cv && Math.hypot(cv.x - c.pos.x, cv.z - c.pos.z) > 0.8) { this.moveGoal(cv.x, cv.z, 'cover'); wish = this.steer(); speed = 6.2; c.sprint = true; if (!wish && !this.wantPath) this.holdCover = null; }
        else { wantStance = 'crouch'; c.aiming = !!c.weapon; this.faceToward(dg.x, (dg.y || heightAt(dg.x, dg.z)) + 1.2, dg.z, dt, 3); }
        break;
      }
      case 'FOLLOW': { // 플레이어 곁 자리로 — 도착하면 플레이어 자세를 따라 하며 경계
        const p = this.playerMate(); if (!p) { this.setState('EXPLORE'); break; }
        const sl = this.followSlot(p), ds = Math.hypot(sl[0] - c.pos.x, sl[1] - c.pos.z), dp = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
        if (ds > 2.5) {
          if (!this.goal || this.goalKind !== 'follow' || Math.hypot(this.goal.x - sl[0], this.goal.z - sl[1]) > 4) { this.goal = null; this.moveGoal(sl[0], sl[1], 'follow', p.pos.y); }
          wish = this.steer(); speed = dp > 16 ? 6.2 : dp > 8 ? 4.6 : 3.0; c.sprint = dp > 16;
          if ((!wish || (!wish[0] && !wish[1])) && !this.wantPath && ds < 8) wish = [(sl[0] - c.pos.x) / ds, (sl[1] - c.pos.z) / ds];
        } else { if (p.stance !== 'stand') wantStance = 'crouch'; this.scan(dt * 0.7); }
        break;
      }
      case 'ORDER': { // 이동 지시 지점으로 가서 앉아 경계
        const o = this.order(); if (!o || o.kind !== 'move') { this.setState('EXPLORE'); break; }
        const sl = this.orderSlot(o), ds = Math.hypot(sl[0] - c.pos.x, sl[1] - c.pos.z);
        if (ds > 2) {
          this.moveGoal(sl[0], sl[1], 'order', o.y); wish = this.steer(); speed = ds > 20 ? 6.2 : 4.6; c.sprint = ds > 20;
          if ((!wish || (!wish[0] && !wish[1])) && !this.wantPath && ds < 8) wish = [(sl[0] - c.pos.x) / ds, (sl[1] - c.pos.z) / ds];
        } else if (G.danger && Math.hypot(G.danger.x - c.pos.x, G.danger.z - c.pos.z) < 150) { wantStance = 'crouch'; c.aiming = !!c.weapon; this.faceToward(G.danger.x, (G.danger.y || heightAt(G.danger.x, G.danger.z)) + 1.2, G.danger.z, dt, 3); }
        else { wantStance = 'crouch'; this.scan(dt * 0.6); }
        break;
      }
      case 'HOLD': { // 부활 직후: 엄폐 지점으로 가서(있으면) 앉아 경계
        const cv = this.holdCover;
        if (cv && Math.hypot(cv.x - c.pos.x, cv.z - c.pos.z) > 0.8) { this.moveGoal(cv.x, cv.z, 'cover'); wish = this.steer(); speed = 4.6; if (!wish && !this.wantPath) this.holdCover = null; }
        else { wantStance = 'crouch'; this.scan(dt * 0.6); }
        if (G.time > (this.recoverUntil || 0)) this.setState('EXPLORE');
        break;
      }
      case 'REGROUP': {
        const ld = this.teamLeader();
        if (!ld || ld === c) { this.setState('EXPLORE'); break; }
        const dl = Math.hypot(ld.pos.x - c.pos.x, ld.pos.z - c.pos.z);
        if (!this.goal || this.goalKind !== 'regroup' || Math.hypot(this.goal.x - ld.pos.x, this.goal.z - ld.pos.z) > 12) {
          const q = Nav.randomFreeNear(ld.pos.x, ld.pos.z, 6) || [ld.pos.x, ld.pos.z]; this.goal = null; this.moveGoal(q[0], q[1], 'regroup', ld.pos.y);
        }
        wish = this.steer(); speed = dl > 25 ? 6.2 : 4.6; c.sprint = dl > 25;
        if (!wish && !this.wantPath) { this.goal = null; if (dl < 15 || this.stateT > 30) this.setState('EXPLORE'); }
        this.scan(dt);
        break;
      }
      case 'BOARD': { // 팀원 차에 타러 달려감 (동승석만)
        const v = this.vehTarget;
        if (!v || v.dead || v.burnT > 0 || !Veh.freeSeats(v)) { this.vehTarget = null; this.setState('EXPLORE'); break; }
        const dv = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z);
        if (Veh.nearestEnterable(c, 2.4) === v) { if (Veh.enter(c, v, undefined, true)) { this.setState('RIDE'); this.thinkT = 0.2; } else { this.vehTarget = null; this.setState('EXPLORE'); } break; }
        this.moveGoal(v.pos.x, v.pos.z, 'veh'); wish = this.steer(); speed = 6.2; c.sprint = true;
        if ((!wish || (!wish[0] && !wish[1])) && !this.wantPath && dv < 12) wish = [(v.pos.x - c.pos.x) / dv, (v.pos.z - c.pos.z) / dv];
        if (this.stateT > 20 || dv > 75) { this.vehTarget = null; this.setState('EXPLORE'); }
        break;
      }
      case 'TOVEH': {
        const v = this.vehTarget;
        if (!v || v.dead || v.driver) { this.vehTarget = null; this.setState('EXPLORE'); break; }
        if (Veh.nearestEnterable(c, 2.3) === v) { if (Veh.enter(c, v)) this.startDrive(); else this.vehFail(v); break; }
        this.moveGoal(v.pos.x, v.pos.z, 'veh'); wish = this.steer(); speed = 5.6; c.sprint = true;
        if (!wish && !this.wantPath && this.stateT > 1) { const dx = v.pos.x - c.pos.x, dz = v.pos.z - c.pos.z, L = Math.hypot(dx, dz) || 1; wish = [dx / L, dz / L]; }
        if (this.stateT > 25) this.vehFail(v);
        this.scan(dt);
        break;
      }
      case 'MOVE': {
        const inv = this.investigate;
        if (!inv) { this.setState('EXPLORE'); break; }
        this.moveGoal(inv.x, inv.z, 'investigate');
        wish = this.steer(); speed = this.d.key === 'hard' ? 4.0 : 4.6;
        if (!wish && !this.wantPath) { this.lookAround = (this.lookAround || 0) + dt; this.scan(dt * 2.5); if (this.lookAround > 3) { this.investigate = null; this.lookAround = 0; this.goal = null; } }
        else this.faceToward(inv.x, c.pos.y + 1.5, inv.z, dt, 2.5);
        if (d.key !== 'easy' && Math.hypot(inv.x - c.pos.x, inv.z - c.pos.z) < 25) wantStance = 'crouch';
        if (wantStance === 'crouch') speed = 2.6;
        break;
      }
      case 'LOOT': {
        const it = this.lootTarget;
        if (!it || !it.alive) { this.lootTarget = null; this.setState('EXPLORE'); break; }
        const dist = Math.hypot(it.x - c.pos.x, it.z - c.pos.z);
        if (dist < 1.9 && Math.abs(it.y - c.pos.y) < 1.6) {
          const inv = c.inv, d2 = ITEMS[it.id];
          let opts = {};
          if (d2.type === 'weapon' && d2.slot === 'primary' && inv.weapons[0] && inv.weapons[1]) opts.slot = weaponScore(inv.weapons[0]) <= weaponScore(inv.weapons[1]) ? 0 : 1;
          pickupItem(c, it, G.scene, opts);
          if (!c.weapon && this.usableWeapons().length) this.chooseWeapon();
          if (c.weapon && c.weapon.mag === 0) startReload(c);
          this.lootTarget = null; this.thinkT = 0.15; this.setState('EXPLORE');
          break;
        }
        this.moveGoal(it.x, it.z, 'loot', it.y); wish = this.steer(); speed = 4.6;
        // 경로 끝(벽·가구 옆이라 격자 칸이 막힌 경우 등)에서 6m 안이면 직접 다가간다
        // (경로가 불완전해 끝에서 재탐색만 반복하는 경우 포함)
        if (dist < 6 && (!wish ? !this.wantPath : (!wish[0] && !wish[1] && this.stateT > 1))) { wish = [(it.x - c.pos.x) / dist, (it.z - c.pos.z) / dist]; speed = 2.6; }
        // 진척 감시(남은 경로 길이 기준): 4초 동안 0.5m도 줄지 않으면(창문 너머·선반 위 등) 포기
        const rem = this.pathRemain(it.x, it.z);
        if (this.lootProg !== it) { this.lootProg = it; this.lootBest = rem; this.lootBestT = G.time; }
        else if (rem < this.lootBest - 0.5) { this.lootBest = rem; this.lootBestT = G.time; }
        if ((!wish && !this.wantPath && this.stateT > 0.5) || G.time - this.lootBestT > 4) { this.ignore.add(it); this.lootTarget = null; this.lootProg = null; this.setState('EXPLORE'); }
        this.scan(dt);
        break;
      }
      case 'EXPLORE': {
        if (!this.goal || this.goalKind !== 'explore') this.pickExploreGoal();
        wish = this.steer(); speed = 4.6;
        if (!wish && !this.wantPath) {
          if (this.building) {
            const b = this.building; this.visited.add(b);
            if (this.buildingStage === 0) { this.buildingStage = 1; this.goal = null; this.moveGoal(b.x, b.z, 'explore'); }
            // 2층 주택: 1층을 본 뒤 계단으로 올라가 위층도 훑는다
            else if (this.buildingStage === 1 && b.st) { this.buildingStage = 2; this.goal = null; this.moveGoal(b.st.T2[0], b.st.T2[1], 'explore', b.st.y); }
            else if (this.buildingStage === 2) { this.buildingStage = 3; this.upT = G.time; }
            else if (this.buildingStage === 3 && G.time - this.upT < 1.6) { /* 위층 둘러보기 */ }
            else { this.building = null; this.goal = null; }
          }
          else this.goal = null;
        }
        this.scan(dt);
        break;
      }
    }
    // 자세 (엎드리기/앉기)
    if (c.stance !== wantStance && !c.inWater) {
      if (wantStance !== 'stand' || Nav.isFree(c.pos.x, c.pos.z) || c.stance === 'prone') c.stance = wantStance;
    }
    this.lastStance = c.stance;
    if (c.stance === 'crouch') speed = Math.min(speed, 2.6); else if (c.stance === 'prone') speed = Math.min(speed, 1.1);
    if (c.heal) speed = Math.min(speed, 1.8);
    // 문턱/작은 장애물 점프
    if (wish && c.onGround && Math.hypot(c.vel.x, c.vel.z) < 0.6 && this.stuckT > 0.8 && Math.random() < 0.05) jump = true;
    this.checkStuck(dt, !!wish && (wish[0] || wish[1]));
    const wx = wish ? wish[0] : 0, wz = wish ? wish[1] : 0;
    if (!c.combatFacing && !wish && this.state !== 'DETECT' && this.state !== 'COVER' && this.state !== 'MOVE' && this.state !== 'HEAL') this.scan(dt);
    stepPhysics(c, dt, wx, wz, c.inWater ? 2.2 : speed, jump);
  }
  pickExploreGoal() {
    const c = this.c, z = Zone.next || Zone.cur;
    const pm0 = this.playerMate();
    if (pm0 && this.building && Math.hypot(this.building.x - pm0.pos.x, this.building.z - pm0.pos.z) > 35) this.building = null;
    if (this.building && !this.visited.has(this.building) && (!z || Zone.inside(this.building.x, this.building.z, z, 0) || (W.big && !this.zonePressure()))) {
      const b = this.building; this.moveGoal(this.buildingStage ? b.x : b.door[0], this.buildingStage ? b.z : b.door[1], 'explore'); return;
    }
    let best = null, bs = 1e9;
    const armed = this.usableWeapons().length > 0;
    const maxD = W.big ? (armed ? 450 : 900) : 180; // 대형 맵은 건물이 드물어 더 멀리 찾는다
    // 대형 맵: 자기장 압박이 없으면 구역 밖 건물도 후보 (구역 밖 거리만큼 감점) — 아니면 맨손으로 수 km를 걷게 된다
    const loose = W.big && z && !this.zonePressure();
    const pm = this.playerMate();
    const ld0 = this.teamLeader(), lead = ld0 && ld0 !== c ? ld0 : null;
    for (const b of W.buildings) {
      if (b.kind === 'tower' || b.kind === 'park' || b.kind === 'containers' || this.visited.has(b)) continue;
      if (pm && Math.hypot(b.x - pm.pos.x, b.z - pm.pos.z) > 30) continue; // 플레이어 팀원: 플레이어 곁 건물만
      const dist = Math.hypot(b.x - c.pos.x, b.z - c.pos.z);
      if (dist > maxD) continue;
      let pen = 0;
      if (z && !Zone.inside(b.x, b.z, z, -5)) {
        if (!loose) continue;
        const out = Math.hypot(b.x - z.x, b.z - z.z) - z.r, here = Math.max(0, Math.hypot(c.pos.x - z.x, c.pos.z - z.z) - z.r);
        if (out > here + 60) continue; // 구역에서 더 멀어지는 건물은 제외
        pen = Math.max(0, out) * (armed ? 0.8 : 0.25);
      }
      if (lead) pen += Math.max(0, Math.hypot(b.x - lead.pos.x, b.z - lead.pos.z) - 25) * 1.5; // 팀장 근처 건물 우선
      const s = dist * (0.7 + Math.random() * 0.6) + b.visits * 25 + pen;
      if (s < bs) { bs = s; best = b; }
    }
    if (best) { this.building = best; this.buildingStage = 0; best.visits++; this.moveGoal(best.door[0], best.door[1], 'explore'); return; }
    if (pm) { this.building = null; this.setState('FOLLOW'); return; }
    // 건물이 없으면 안전구역 안쪽 임의 지점 (엄폐물 많은 곳 선호는 경로 비용이 처리)
    const p = Nav.randomFreeNear(z ? z.x : 0, z ? z.z : 0, z ? z.r * 0.7 : 200) || [c.pos.x + rnd(-40, 40), c.pos.z + rnd(-40, 40)];
    this.building = null; this.moveGoal(p[0], p[1], 'explore');
  }
  scan(dt) { // 이동 중 주변 살피기
    const c = this.c; this.scanPhase += dt * 0.9;
    const mv = Math.hypot(c.vel.x, c.vel.z) > 0.5 ? Math.atan2(c.vel.x, c.vel.z) : this.lookYaw;
    const target = mv + Math.sin(this.scanPhase) * 0.9;
    c.yaw += angleDiff(c.yaw, target) * clamp(dt * 3, 0, 1);
    c.pitch = lerp(c.pitch, 0, clamp(dt * 3, 0, 1));
    if (Math.hypot(c.vel.x, c.vel.z) > 0.5) this.lookYaw = mv;
  }
  faceToward(x, y, z, dt, rate) {
    const c = this.c; c.eye(_e);
    const yaw = Math.atan2(x - c.pos.x, z - c.pos.z), pitch = Math.atan2(y - _e.y, Math.hypot(x - _e.x, z - _e.z));
    c.yaw += angleDiff(c.yaw, yaw) * clamp(dt * rate, 0, 1);
    c.pitch = lerp(c.pitch, pitch, clamp(dt * rate, 0, 1));
    this.lookYaw = yaw;
  }
  combat(dt, tgt, tr) {
    const c = this.c, d = this.d;
    if (!c.weapon || (c.weapon.mag === 0 && c.inv.count(ITEMS[c.weapon.id].ammo) === 0)) {
      // 맨손: 붙어서 주먹
      if (!tr.visible) return;
      this.faceToward(tgt.pos.x, tgt.pos.y + 1.2, tgt.pos.z, dt, 8);
      if (tr.dist < 1.8) { c.eye(_e); _d.set(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)); melee(c, _e, _d); }
      return;
    }
    // 추적 시간이 길수록 조준 안정
    this.track = tr.visible ? this.track + dt : Math.max(0, this.track - dt * 2);
    const settle = clamp(1.5 - this.track / d.settle, 0.5, 1.5);
    const tsp = Math.hypot(tgt.vel.x, tgt.vel.z);
    // 조준경: 원거리에서 배율이 높을수록 정확, 근거리에서 고배율은 오히려 불리
    const zk = c.weapon.att.scope ? ITEMS[c.weapon.att.scope].zoom : 1, dist0 = tr.dist || 50;
    const scopeK = dist0 > 60 ? (zk >= 3 ? 0.65 : zk >= 2 ? 0.8 : 1) : (dist0 < 15 && zk >= 4 ? 1.25 : 1);
    const cls0 = ITEMS[c.weapon.id].cls, wk = cls0 === 'SR' ? 0.45 : cls0 === 'DMR' ? 0.6 : 1, still = Math.hypot(c.vel.x, c.vel.z) < 0.5 && c.stance !== 'stand' ? 0.8 : 1;
    const err = d.aimErr * DEG * settle * scopeK * wk * still * (1 + tsp / 5) * (Math.hypot(c.vel.x, c.vel.z) > 1 ? 1.4 : 1);
    c.aiming = true; // 사격할 때는 정조준 (엄폐 중에도)
    // 부드러운 랜덤 워크 조준 오차
    this.errYaw = clamp(this.errYaw + rnd(-1, 1) * err * dt * 6, -err, err);
    this.errPitch = clamp(this.errPitch + rnd(-1, 1) * err * dt * 6, -err, err);
    if (tr.visible) {
      tgt.chest(_t);
      if (this.aimHead) tgt.eye(_t);
    } else _t.set(tr.x, tr.y + 1.2, tr.z);
    c.eye(_e);
    const yaw = Math.atan2(_t.x - _e.x, _t.z - _e.z) + this.errYaw;
    const pitch = Math.atan2(_t.y - _e.y, Math.hypot(_t.x - _e.x, _t.z - _e.z)) + this.errPitch;
    const turn = clamp(dt * 7, 0, 1);
    c.yaw += angleDiff(c.yaw, yaw) * turn; c.pitch = lerp(c.pitch, pitch, turn);
    const wd = ITEMS[c.weapon.id];
    const dist = tr.dist || 50;
    const aligned = Math.abs(angleDiff(c.yaw, yaw)) < 0.12;
    if (!tr.visible || !aligned || dist > Math.min(wd.range * 1.4, d.view) * d.fireRange) return;
    // 산탄총·볼트액션을 한 발씩 넣는 중이라도 적이 보이고 탄이 있으면 장전을 멈추고 쏜다
    if (c.rl && c.rl.canCancel && c.weapon.mag > 0 && tr.visible && dist < wd.range) cancelReload(c);
    if (c.fireCd > 0 || c.reloadT > 0 || c.equipT > 0 || c.heal) return;
    if (this.pauseT > 0) { this.pauseT -= dt; return; }
    if (c.weapon.mag <= 0) { startReload(c); return; }
    _d.set(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch));
    if (fireWeapon(c, _e, _d)) {
      c.lastShotT = G.time;
      const mode = fireMode(c.weapon), autoish = mode === 'auto' || mode === 'slow';
      if (this.burstLeft <= 0) { this.burstLeft = mode === 'burst' ? wd.burstN : autoish ? rndi(d.burst[0], d.burst[1]) * (wd.cls === 'LMG' ? 2 : 1) : 1; this.aimHead = Math.random() < d.headshot; }
      this.burstLeft--;
      if (mode === 'burst' && this.burstLeft <= 0) c.fireCd = Math.max(c.fireCd, wd.burstGap);
      if (this.burstLeft <= 0) this.pauseT = rnd(d.pause[0], d.pause[1]) * (autoish ? 1 : mode === 'burst' ? 0.45 : 0.6) + (dist > 80 ? 0.3 : 0);
      // 반동으로 조준이 위로 튐
      this.errPitch += wd.recoil * 0.004 * (c.weapon.att.muzzle ? 0.7 : 1);
    }
  }
}
