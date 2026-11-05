// ============================================================
// 04_character.js — 관절 캐릭터 모델, 애니메이션, 이동 물리, 히트박스
//  플레이어와 봇이 동일한 클래스/물리/피해 규칙을 공유한다.
// ============================================================
let CHARS = [];                // 경기 중 모든 캐릭터
const STANCE_H = { stand: 1.8, crouch: 1.25, prone: 0.6 };
// ---------- 팀 ----------
const sameTeam = (a, b) => !!a && !!b && a !== b && a.team === b.team;
const standing = (c) => c.alive && !c.knocked;
function teamMembers(c) { return G.teams && G.teams[c.team] ? G.teams[c.team].members : [c]; }
function teamHasStanding(team, except) { for (const m of G.teams[team].members) if (m !== except && standing(m)) return true; return false; }
function teamAlive(T) { for (const m of T.members) if (m.alive) return true; return false; }
function aliveTeamCount() { let n = 0; for (const T of G.teams) if (teamAlive(T)) n++; return n; }
// 가까운 기절한 팀원 (부활 대상)
function nearestKnockedMate(c, r) {
  let best = null, bd = r;
  for (const m of teamMembers(c)) {
    if (m === c || !m.alive || !m.knocked || Math.abs(m.pos.y - c.pos.y) > 1.6) continue;
    if (m.revivedBy && m.revivedBy !== c && m.revivedBy.revive) continue;
    const d = Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z); if (d < bd) { bd = d; best = m; }
  }
  return best;
}
const _matCache = {};
function lam(hex) { return _matCache[hex] || (_matCache[hex] = new THREE.MeshLambertMaterial({ color: hex })); }

// ---------- 캐릭터 모델 (04_body.js의 뼈대·스킨드 메시 + 05_models_gear.js의 장비) ----------
// look: Body.makeLook(장착 스킨, 몸) 결과. 옛 형식(복장 색 표)이 오면 기본 외형
function buildRig(look) {
  const L = look && look.top ? look : Body.makeLook(null, null);
  const I = Body.instance(L), B = I.B;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(B.hips);
  root.add(I.hi); root.add(I.lo);
  const arm = (k) => {
    const s = k === 'L' ? 1 : -1, hold = new THREE.Group(); hold.position.set(-s * 0.022, -0.072, 0.004); B['hand' + k].add(hold); // 손바닥 가운데
    return { clav: B['clav' + k], sh: B['sh' + k], el: B['el' + k], hand: B['hand' + k], thumb1: B['thumb1' + k], thumb2: B['thumb2' + k], idx1: B['idx1' + k], idx2: B['idx2' + k], fin1: B['fin1' + k], fin2: B['fin2' + k], hold, side: s };
  };
  const leg = (k) => ({ hip: B['hip' + k], knee: B['knee' + k], foot: B['foot' + k], toe: B['toe' + k], side: k === 'L' ? 1 : -1 });
  const gunMount = new THREE.Group(); B.chest.add(gunMount);
  const backGuns = new THREE.Group(); B.chest.add(backGuns);   // 등에 멘 주무기(손에 없는 것)
  const helmet = new THREE.Group(), vest = new THREE.Group(), pack = new THREE.Group(); B.head.add(helmet); B.chest.add(vest); B.chest.add(pack);
  // 모자 스킨: 머리 뼈에 붙는 단단한 메시. 헬멧을 쓰면 숨긴다
  const hat = new THREE.Group(); B.head.add(hat);
  if (L.hat) { const hm = Body.hatMesh(L.hat); if (hm) hat.add(hm); }
  const chute = Gear.canopy(L.chute); chute.visible = false; root.add(chute);
  const rig = { root, body, hips: B.hips, spine: B.spine, chest: B.chest, neck: B.neck, head: B.head, armL: arm('L'), armR: arm('R'), legL: leg('L'), legR: leg('R'),
    gunMount, backGuns, backKey: ['', ''], chute, helmet, vest, pack, hat, mesh: I.hi, meshLo: I.lo, skel: I.skel, bones: I.list, look: L, gunId: null, gunObj: null, gearKey: '', lod: 0, shadow: true,
    // 장비 단계(0 = 없음): 바뀔 때만 메시 교체
    setGear(h, v, p) {
      const key = h + '|' + v + '|' + p; if (this.gearKey === key) return; this.gearKey = key;
      for (const [grp, lvl, fn] of [[helmet, h, Gear.helmet], [vest, v, Gear.vest], [pack, p, Gear.pack]]) {
        while (grp.children.length) grp.remove(grp.children[0]);
        const m = lvl ? fn(lvl) : null; if (m) { m.traverse((o) => { if (o.isMesh) o.castShadow = this.shadow; }); grp.add(m); }
      }
      hat.visible = !h;
    },
    setShadow(on) {
      if (this.shadow === on) return; this.shadow = on;
      this.mesh.castShadow = this.meshLo.castShadow = on;
      for (const grp of [helmet, vest, pack, hat, gunMount, backGuns]) grp.traverse((o) => { if (o.isMesh) o.castShadow = on; });
    },
    // 0 = 가까이(정밀), 1 = 멀리(간략)
    setLod(l) { if (this.lod === l) return; this.lod = l; this.mesh.visible = l === 0; this.meshLo.visible = l !== 0; },
  };
  return rig;
}

class Character {
  constructor(opts) {
    this.id = opts.id; this.name = opts.name; this.isPlayer = !!opts.isPlayer;
    this.look = opts.look && opts.look.top ? opts.look : Body.makeLook(null, null);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.bodyYaw = 0;
    this.hp = 100; this.boost = 0; this.alive = true;
    this.stance = 'stand'; this.mode = 'plane'; this.onGround = false; this.inWater = false;
    this.sprint = false; this.aiming = false; this.moving = false;
    this.inv = new Inventory(this);
    this.kills = 0; this.damageDealt = 0; this.deathTime = 0; this.place = 0;
    this.fireCd = 0; this.rl = null; this.cycle = null; this.slideKick = 0; this.equipT = 0; this.bloom = 0;
    this.heal = null; // {id, t, total}
    this.rig = buildRig(this.look); this.root = this.rig.root;
    this.anim = { phase: 0, crouch: 0, prone: 0, aim: 0, flinch: 0, flinchDir: 1, land: 0, dead: 0, fall: 0, chute: 0, speed: 0, armed: 0, stepAcc: 0 };
    this.lastAttacker = null; this.lastDamageT = -99; this.outsideZoneT = 0;
    // 팀·기절·부활
    this.team = opts.team || 0; this.slot = 0;
    this.knocked = false; this.knockN = 0; this.knockedBy = null; this.knocks = 0; this.revives = 0;
    this.revive = null;      // 내가 부활시키는 중: { tgt, t, total }
    this.revivedBy = null;   // 나를 부활시키는 팀원
    // 넘기·낙하·줍기·투척 동작
    this.vault = null;       // { kind:'vault'|'climb', t, dur, x0..z1, top }
    this.airT = 0; this.rollT = 0; this.pickT = 0; this.throwAnim = 0;
    this.throwMode = null;   // 플레이어: 투척 준비 { type, pin, cook, armed }
  }
  get height() { return STANCE_H[this.stance]; }
  // 장전 남은 시간(읽기) / 0을 넣으면 장전 취소
  get reloadT() { return this.rl ? Math.max(1e-4, this.rl.total - this.rl.t) : 0; }
  set reloadT(v) { if (!v) this.rl = null; }
  get weapon() { return this.inv.current(); }
  forward(out) { out.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)); return out; }
  eye(out) {
    const a = this.anim;
    if (a.prone > 0.5) out.set(this.pos.x + Math.sin(this.bodyYaw) * 1.45, this.pos.y + 0.42, this.pos.z + Math.cos(this.bodyYaw) * 1.45);
    else out.set(this.pos.x, this.pos.y + 1.64 - a.crouch * 0.44, this.pos.z);
    return out;
  }
  chest(out) {
    if (this.anim.prone > 0.5) return out.set(this.pos.x + Math.sin(this.bodyYaw) * 1.05, this.pos.y + 0.28, this.pos.z + Math.cos(this.bodyYaw) * 1.05);
    return out.set(this.pos.x, this.pos.y + 1.25 - this.anim.crouch * 0.36, this.pos.z);
  }
  setVisibleGear() {
    const r = this.rig, inv = this.inv;
    const lv = (g) => (g && ITEMS[g.id] && ITEMS[g.id].lvl) || (g ? 1 : 0);
    r.setGear(lv(inv.gear.helmet), lv(inv.gear.vest), lv(inv.gear.bag));
    const w = this.weapon, gid = w && this.equipT <= 0.25 && !this.knocked ? w.id + '|' + [w.att.scope, w.att.muzzle, w.att.mag, w.att.grip].join(',') : null;
    // 등에 멘 주무기: 1번은 왼쪽 어깨 위로, 2번은 오른쪽 어깨 위로 비스듬히 (가방이 있으면 가방 위)
    for (let i = 0; i < 2; i++) {
      const bw = inv.weapons[i], inHand = i === inv.cur && this.equipT <= 0.25 && !this.knocked;
      const key = bw && !inHand ? bw.id + '|' + [bw.att.scope, bw.att.muzzle, bw.att.mag, bw.att.grip].join(',') + '|' + (inv.gear.bag ? 1 : 0) : '';
      if (r.backKey[i] === key) continue;
      r.backKey[i] = key;
      const old = r.backGuns.getObjectByName('back' + i); if (old) r.backGuns.remove(old);
      if (!key) continue;
      const g = buildGunMesh(bw.id, bw.att), s = i === 0 ? 1 : -1, zb = (inv.gear.bag ? -0.36 : -0.16) - i * 0.045;
      g.name = 'back' + i; g.traverse((o) => { if (o.isMesh) o.castShadow = r.shadow; });
      _bz.set(s * 0.42, 0.9, 0).normalize(); _bx.set(0, 0, -1); _by.crossVectors(_bz, _bx);
      g.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz));
      g.position.set(0, 0.04, zb).addScaledVector(_bz, -0.05);
      r.backGuns.add(g);
    }
    if (r.gunId !== gid) {
      while (r.gunMount.children.length) r.gunMount.remove(r.gunMount.children[0]);
      r.gunObj = gid ? buildGunMesh(w.id, w.att) : null;
      if (r.gunObj) { r.gunObj.rotation.y = 0; r.gunMount.add(r.gunObj); }
      r.gunId = gid;
    }
  }
}

const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
// ---------- 히트박스 (구 목록) ----------
function hitSpheres(c, out) {
  out.length = 0; if (!c.alive || c.mode === 'plane') return out;
  const a = c.anim, x = c.pos.x, y = c.pos.y, z = c.pos.z;
  if (a.prone > 0.5) {
    const fx = Math.sin(c.bodyYaw), fz = Math.cos(c.bodyYaw);
    out.push({ x: x + fx * 1.62, y: y + 0.3, z: z + fz * 1.62, r: 0.15, part: 'head' });
    out.push({ x: x + fx * 1.15, y: y + 0.26, z: z + fz * 1.15, r: 0.27, part: 'body' });
    out.push({ x: x + fx * 0.75, y: y + 0.24, z: z + fz * 0.75, r: 0.25, part: 'body' });
    out.push({ x: x + fx * 0.3, y: y + 0.2, z: z + fz * 0.3, r: 0.22, part: 'legs' });
  } else {
    const k = a.crouch;
    out.push({ x, y: y + 1.66 - k * 0.45, z, r: 0.15, part: 'head' });
    out.push({ x, y: y + 1.3 - k * 0.38, z, r: 0.27, part: 'body' });
    out.push({ x, y: y + 0.95 - k * 0.36, z, r: 0.25, part: 'body' });
    out.push({ x, y: y + 0.5 - k * 0.2, z, r: 0.22, part: 'legs' });
  }
  return out;
}

// ---------- 이동 물리 ----------
const _boxes = [];
function collideChar(c) {
  const r = CHAR_R, feet = c.pos.y, head = feet + c.height;
  queryBoxes(c.pos.x - 1, c.pos.z - 1, c.pos.x + 1, c.pos.z + 1, _boxes);
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const b of _boxes) {
      if (b.y1 <= feet + STEP_H || b.y0 >= head) continue;
      const px = clamp(c.pos.x, b.x0, b.x1), pz = clamp(c.pos.z, b.z0, b.z1);
      const dx = c.pos.x - px, dz = c.pos.z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      moved = true;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = r - d;
        c.pos.x += nx * push; c.pos.z += nz * push;
        const vn = c.vel.x * nx + c.vel.z * nz; if (vn < 0) { c.vel.x -= vn * nx; c.vel.z -= vn * nz; }
      } else { // 중심이 박스 내부: 최소 침투 축으로 밀어냄
        const pen = [[c.pos.x - b.x0 + r, -1, 0], [b.x1 - c.pos.x + r, 1, 0], [c.pos.z - b.z0 + r, 0, -1], [b.z1 - c.pos.z + r, 0, 1]].sort((p, q) => p[0] - q[0])[0];
        c.pos.x += pen[1] * pen[0]; c.pos.z += pen[2] * pen[0];
      }
    }
    if (!moved) break;
  }
  Veh.pushChar(c);
  const lim = HALF - 3;
  c.pos.x = clamp(c.pos.x, -lim, lim); c.pos.z = clamp(c.pos.z, -lim, lim);
}
// wx, wz: 원하는 이동 방향(정규화), speed: 목표 속도
function stepPhysics(c, dt, wx, wz, speed, jump) {
  if (c.vault) { updateVault(c, dt); return; }
  if (c.rollT > 0) speed = Math.max(speed, 3.2); // 구르는 동안은 앞으로 밀려 나간다
  const accel = c.onGround || c.inWater ? 34 : 5;
  c.vel.x += clamp(wx * speed - c.vel.x, -accel * dt, accel * dt);
  c.vel.z += clamp(wz * speed - c.vel.z, -accel * dt, accel * dt);
  if (jump && c.onGround && !c.inWater) {
    if (c.stance !== 'stand') c.stance = 'stand';
    else { c.vel.y = 5.6; c.onGround = false; }
  }
  // 이동 (큰 dt는 분할)
  const sub = Math.max(1, Math.ceil(Math.hypot(c.vel.x, c.vel.z) * dt / 0.25));
  for (let s = 0; s < sub; s++) { c.pos.x += c.vel.x * dt / sub; c.pos.z += c.vel.z * dt / sub; collideChar(c); }
  // 수직
  const g = groundAt(c.pos.x, c.pos.z, c.pos.y);
  const deep = g < WATER_Y - 1.25;
  if (deep && c.pos.y <= WATER_Y - 1.2) { // 수영
    c.inWater = true; c.stance = 'stand'; c.vel.y = 0; c.pos.y = WATER_Y - 1.25; c.onGround = false; c.airT = 0; return;
  }
  c.inWater = false;
  c.vel.y -= GRAVITY * dt;
  c.pos.y += c.vel.y * dt;
  if (c.vel.y > 0) { const ceil = ceilingAt(c.pos.x, c.pos.z, c.pos.y + c.height - 0.1); if (c.pos.y + c.height > ceil) { c.pos.y = ceil - c.height; c.vel.y = 0; } }
  const g2 = groundAt(c.pos.x, c.pos.z, c.pos.y);
  if (c.pos.y <= g2) {
    if (!c.onGround) landImpact(c, -c.vel.y);
    c.pos.y = g2; c.vel.y = 0; c.onGround = true;
  } else if (c.onGround && c.vel.y <= 0 && c.pos.y - g2 < 0.5) { c.pos.y = g2; c.vel.y = 0; }
  else c.onGround = false;
  c.airT = c.onGround ? 0 : c.airT + dt;
}
// 착지: 낙하 속도(m/s)에 따라 가볍게 굽힘 → 크게 웅크림 → 앞구르기. 피해는 약 4.5m(13.5m/s)부터, 예전보다 완만하게
//  (예전: 3.6m부터 ×7 → 2층 지붕에서 뛰어내려도 28 피해. 지금: 6.4m 약 11, 10m 약 29, 20m 약 66, 30m 약 95)
const FALL_SAFE = 13.5, FALL_K = 4.5, ROLL_T = 0.7;
function landImpact(c, v) {
  if (v < 6) return;
  const hs = Math.hypot(c.vel.x, c.vel.z), a = c.anim;
  if (v > FALL_SAFE) applyDamage(c, (v - FALL_SAFE) * FALL_K, 'fall', null, 'fall');
  if (!c.alive) return;
  if (v > 11.5 && (hs > 1.8 || v > 15) && c.stance !== 'prone' && !c.knocked && !c.inWater) { c.rollT = ROLL_T; c.rollYaw = hs > 1 ? Math.atan2(c.vel.x, c.vel.z) : c.bodyYaw; }
  else a.land = Math.max(a.land, v > 9 ? 1 : 0.55);
  Audio.land(c.pos, c.isPlayer, v / 11);
  if (c.isPlayer && v > 10) G.shake = Math.max(G.shake || 0, clamp((v - 10) / 12, 0.15, 0.6));
}
// ---------- 넘기 / 오르기 ----------
// (x,z) 지점의 장애물 기둥: 발 높이 기준 가슴 아래에서 시작하는 박스들의 최고 높이 top, 그 위 첫 천장 ceil
const _vcol = { top: 0, ceil: 0 };
function vaultColumn(x, z, feet) {
  let top = -1e9, ceil = 1e9;
  const list = W.grid[cellIndex(x, z)];
  for (let n = 0; n < list.length; n++) {
    const b = list[n];
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || b.y1 <= feet + 0.05) continue;
    if (b.y0 < feet + 1.45 && b.y1 > top) top = b.y1;
  }
  if (top > -1e9) for (let n = 0; n < list.length; n++) {
    const b = list[n];
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y0 >= top - 0.01 && b.y0 < ceil) ceil = b.y0;
  }
  _vcol.top = top; _vcol.ceil = ceil; return _vcol;
}
// y 높이에 서 있을 때 몸(무릎~머리 h)이 들어갈 공간이 있는지
function roomAt(x, z, y, h) {
  const list = W.grid[cellIndex(x, z)];
  for (let n = 0; n < list.length; n++) { const b = list[n]; if (x >= b.x0 - CHAR_R * 0.7 && x <= b.x1 + CHAR_R * 0.7 && z >= b.z0 - CHAR_R * 0.7 && z <= b.z1 + CHAR_R * 0.7 && b.y1 > y + STEP_H && b.y0 < y + h) return false; }
  return true;
}
// 정면(dx,dz) 장애물을 넘을 수 있는지: 얇고 낮으면(≤1.4m, 두께 ≤1.35m) 넘기, 위가 넓으면(≤2.05m) 오르기
function vaultPlan(c, dx, dz) {
  if (!c.onGround || c.inWater || c.veh || c.knocked || c.vault || c.stance === 'prone' || c.mode !== 'ground') return null;
  const feet = c.pos.y, x = c.pos.x, z = c.pos.z, px = -dz, pz = dx;
  let d0 = -1, top = 0;
  for (let d = 0.3; d <= 0.95; d += 0.08) { const q = vaultColumn(x + dx * d, z + dz * d, feet); if (q.top > feet + STEP_H + 0.02) { d0 = d; top = q.top; break; } }
  if (d0 < 0 || top - feet > 2.05) return null;
  // 장애물을 따라가며 두께·최고 높이·위 공간 (몸통 폭 ±0.2m 세 줄)
  let topMax = top, gapMin = 9, d1 = -1;
  for (let d = d0 + 0.04; d <= d0 + 1.6; d += 0.06) {
    let ct = -1e9, cc = 1e9;
    for (const s of [0, -0.2, 0.2]) { const q = vaultColumn(x + dx * d + px * s, z + dz * d + pz * s, feet); if (q.top > ct) ct = q.top; if (q.top > feet + STEP_H + 0.02 && q.ceil < cc) cc = q.ceil; }
    if (ct <= feet + STEP_H + 0.02) { d1 = d; break; }
    if (ct > topMax) topMax = ct;
    if (cc - ct < gapMin) gapMin = cc - ct;
    if (topMax - feet > 2.05) return null;
  }
  const h = topMax - feet;
  // 넘기
  if (d1 > 0 && h <= 1.4 && gapMin >= 0.7) {
    const L = d1 + 0.42, lx = x + dx * L, lz = z + dz * L, gl = groundAt(lx, lz, topMax);
    if (gl <= topMax + 0.05 && roomAt(lx, lz, gl, 1.7)) {
      const drop = topMax - gl, y1 = drop <= 1.3 ? gl : topMax - 0.35;
      return { kind: 'vault', x0: x, y0: feet, z0: z, x1: lx, y1, z1: lz, top: topMax, land: drop <= 1.3, dur: 0.48 + 0.17 * h, dx, dz, d0 };
    }
  }
  // 오르기: 앞면 높이 그대로 0.45m 이상 이어지는 평평한 윗면
  if (h <= 2.05) {
    const C = d0 + 0.45, cx = x + dx * C, cz = z + dz * C;
    for (const s of [0, -0.2, 0.2]) { const q = vaultColumn(cx + px * s, cz + pz * s, feet); if (Math.abs(q.top - top) > 0.12) return null; }
    const gc = groundAt(cx, cz, top);
    if (Math.abs(gc - top) > 0.12 || !roomAt(cx, cz, gc, 1.25)) return null;
    for (let d = d0; d <= C; d += 0.1) { const q = vaultColumn(x + dx * d, z + dz * d, feet); if (q.ceil - q.top < 1.0) return null; }
    return { kind: 'climb', x0: x, y0: feet, z0: z, x1: cx, y1: gc, z1: cz, top, land: true, crouch: !roomAt(cx, cz, gc, 1.8), dur: 0.55 + 0.3 * (top - feet), dx, dz, d0 };
  }
  return null;
}
function startVault(c, plan) {
  c.vault = Object.assign({ t: 0 }, plan);
  c.heal = null; c.aiming = false; c.sprint = false; c.burstQ = 0; c.onGround = false; c.rollT = 0;
  if (c.revive) cancelRevive(c, true);
  c.bodyYaw = Math.atan2(plan.dx, plan.dz);
  if (plan.kind === 'climb' || c.stance === 'prone') c.stance = 'stand';
  Audio.vault(c.pos, c.isPlayer);
  G.noises.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, t: G.time, r: 16, by: c, kind: 'step' });
}
function updateVault(c, dt) {
  const V = c.vault; V.t += dt;
  const u = Math.min(1, V.t / V.dur), px = c.pos.x, py = c.pos.y, pz = c.pos.z;
  const s = V.kind === 'vault' ? sstep(0, 1, u) : sstep(0.32, 1, u);
  const peak = V.top + (V.kind === 'vault' ? 0.1 : 0.04), a = V.kind === 'vault' ? 0.45 : 0.62;
  c.pos.x = lerp(V.x0, V.x1, s); c.pos.z = lerp(V.z0, V.z1, s);
  c.pos.y = u < a ? lerp(V.y0, peak, V.kind === 'vault' ? Math.sin(u / a * Math.PI / 2) : sstep(0, 1, u / a)) : lerp(peak, V.y1, V.kind === 'vault' ? 1 - Math.cos((u - a) / (1 - a) * Math.PI / 2) : sstep(0, 1, (u - a) / (1 - a)));
  if (dt > 0) c.vel.set((c.pos.x - px) / dt, (c.pos.y - py) / dt, (c.pos.z - pz) / dt);
  c.onGround = false; c.airT = 0;
  if (u >= 1) {
    c.vault = null;
    if (V.kind === 'vault') { c.vel.set(V.dx * 3.2, V.land ? 0 : -1.5, V.dz * 3.2); c.onGround = V.land; }
    else { c.vel.set(0, 0, 0); c.onGround = true; if (V.crouch) c.stance = 'crouch'; }
    collideChar(c);
    if (V.land) Audio.land(c.pos, c.isPlayer, 0.6);
  }
}
// 캐릭터끼리 겹침 방지
function separateChars() {
  for (let i = 0; i < CHARS.length; i++) {
    const a = CHARS[i]; if (!a.alive || a.mode !== 'ground' || a.veh) continue;
    for (let j = i + 1; j < CHARS.length; j++) {
      const b = CHARS[j]; if (!b.alive || b.mode !== 'ground' || b.veh) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 > 0.49 || d2 < 1e-6 || Math.abs(a.pos.y - b.pos.y) > 1.5) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ma = !a.net || a.net.mine, mb = !b.net || b.net.mine;
      if (!ma && !mb) continue;
      const p = (0.7 - d) / (ma && mb ? 2 : 1), pa = ma ? p : 0, pb = mb ? p : 0; // 다른 기기 캐릭터는 밀지 않는다
      a.pos.x -= nx * pa; a.pos.z -= nz * pa; b.pos.x += nx * pb; b.pos.z += nz * pb;
    }
  }
}

// 애니메이션은 04_motion.js
