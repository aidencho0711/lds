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
const _cg = {};
function charGeo() {
  if (_cg.torso) return _cg;
  const C = (rt, rb, h, ty) => { const g = new THREE.CylinderGeometry(rt, rb, h, 7); g.translate(0, ty, 0); return g; };
  Object.assign(_cg, {
    torso: new THREE.BoxGeometry(0.42, 0.55, 0.25), vest: new THREE.BoxGeometry(0.48, 0.42, 0.31),
    pelvis: new THREE.BoxGeometry(0.37, 0.2, 0.23), head: new THREE.SphereGeometry(0.125, 12, 9),
    helmet: new THREE.SphereGeometry(0.152, 12, 6, 0, TAU, 0, Math.PI / 2), neck: C(0.05, 0.06, 0.12, 0.04),
    upper: C(0.066, 0.058, 0.3, -0.15), fore: C(0.056, 0.048, 0.28, -0.14), hand: new THREE.SphereGeometry(0.052, 6, 5),
    thigh: C(0.095, 0.078, 0.44, -0.22), shin: C(0.074, 0.062, 0.42, -0.21), boot: new THREE.BoxGeometry(0.12, 0.1, 0.25),
    pack: new THREE.BoxGeometry(0.34, 0.42, 0.18), canopy: new THREE.SphereGeometry(3.4, 14, 5, 0, TAU, 0, Math.PI * 0.32),
    eyes: new THREE.BoxGeometry(0.16, 0.035, 0.02),
  });
  return _cg;
}
const _matCache = {};
function lam(hex) { return _matCache[hex] || (_matCache[hex] = new THREE.MeshLambertMaterial({ color: hex })); }

function buildRig(outfit) {
  const G = charGeo(), o = outfit;
  const M = (geo, hex) => { const m = new THREE.Mesh(geo, lam(hex)); m.castShadow = true; return m; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  hips.add(M(G.pelvis, o.pants));
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  const torso = M(G.torso, o.shirt); torso.position.y = 0.28; spine.add(torso);
  const vest = M(G.vest, 0x4a4f3a); vest.position.y = 0.32; vest.visible = false; spine.add(vest);
  const pack = M(G.pack, 0x5a4a35); pack.position.set(0, 0.3, -0.22); pack.visible = false; spine.add(pack);
  const neck = new THREE.Group(); neck.position.y = 0.56; spine.add(neck);
  neck.add(M(G.neck, o.skin));
  const head = M(G.head, o.skin); head.position.y = 0.15; neck.add(head);
  const eyes = M(G.eyes, 0x1a1a1a); eyes.position.set(0, 0.17, 0.115); neck.add(eyes);
  const helmet = M(G.helmet, 0x4b5240); helmet.position.y = 0.17; helmet.visible = false; neck.add(helmet);
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.265, 0.5, 0); spine.add(sh);
    sh.add(M(G.upper, o.shirt));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(M(G.fore, o.shirt)); const h = M(G.hand, o.skin); h.position.y = -0.29; el.add(h);
    const hold = new THREE.Group(); hold.position.y = -0.31; el.add(hold); // 회복·투척 물건을 쥐는 자리
    return { sh, el, hold };
  };
  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.11, -0.05, 0); hips.add(hip);
    hip.add(M(G.thigh, o.pants));
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    knee.add(M(G.shin, o.pants)); const b = M(G.boot, o.boots); b.position.set(0, -0.43, 0.04); knee.add(b);
    return { hip, knee };
  };
  const armR = arm(-1), armL = arm(1), legR = leg(-1), legL = leg(1);
  const gunMount = new THREE.Group(); gunMount.position.set(-0.1, 0.36, 0.2); spine.add(gunMount);
  const chute = new THREE.Group();
  const can = new THREE.Mesh(G.canopy, new THREE.MeshLambertMaterial({ color: o.accent || 0x9a5a3a, side: THREE.DoubleSide }));
  can.scale.set(1, 0.55, 0.75); can.position.y = 3.4; chute.add(can);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.25, 1.4, 0), new THREE.Vector3(-2.6, 4.1, 0), new THREE.Vector3(0.25, 1.4, 0), new THREE.Vector3(2.6, 4.1, 0), new THREE.Vector3(0, 1.4, -0.1), new THREE.Vector3(0, 4.4, -1.8), new THREE.Vector3(0, 1.4, 0.1), new THREE.Vector3(0, 4.4, 1.8)]);
  chute.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x222222 })));
  chute.visible = false; root.add(chute);
  return { root, body, hips, spine, neck, head, helmet, vest, pack, torso, armR, armL, legR, legL, gunMount, chute, gunId: null };
}

class Character {
  constructor(opts) {
    this.id = opts.id; this.name = opts.name; this.isPlayer = !!opts.isPlayer;
    this.outfit = opts.outfit;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.bodyYaw = 0;
    this.hp = 100; this.boost = 0; this.alive = true;
    this.stance = 'stand'; this.mode = 'plane'; this.onGround = false; this.inWater = false;
    this.sprint = false; this.aiming = false; this.moving = false;
    this.inv = new Inventory(this);
    this.kills = 0; this.damageDealt = 0; this.deathTime = 0; this.place = 0;
    this.fireCd = 0; this.rl = null; this.cycle = null; this.slideKick = 0; this.equipT = 0; this.bloom = 0;
    this.heal = null; // {id, t, total}
    this.rig = buildRig(this.outfit); this.root = this.rig.root;
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
    r.helmet.visible = !!inv.gear.helmet; r.vest.visible = !!inv.gear.vest; r.pack.visible = !!inv.gear.bag;
    if (inv.gear.helmet) r.helmet.material = lam([0, 0x5b6250, 0x4a4a42, 0x3a4048][ITEMS[inv.gear.helmet.id].lvl]);
    if (inv.gear.vest) r.vest.material = lam([0, 0x5a5f48, 0x3f4a3a, 0x2f3438][ITEMS[inv.gear.vest.id].lvl]);
    const w = this.weapon, gid = w && this.equipT <= 0.25 && !this.knocked ? w.id + '|' + [w.att.scope, w.att.muzzle, w.att.mag, w.att.grip].join(',') : null;
    if (r.gunId !== gid) {
      while (r.gunMount.children.length) r.gunMount.remove(r.gunMount.children[0]);
      r.gunObj = gid ? buildGunMesh(w.id, w.att) : null;
      if (r.gunObj) { r.gunObj.rotation.y = 0; r.gunMount.add(r.gunObj); }
      r.gunId = gid;
    }
  }
}

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
      return { kind: 'vault', x0: x, y0: feet, z0: z, x1: lx, y1, z1: lz, top: topMax, land: drop <= 1.3, dur: 0.48 + 0.17 * h, dx, dz };
    }
  }
  // 오르기: 앞면 높이 그대로 0.45m 이상 이어지는 평평한 윗면
  if (h <= 2.05) {
    const C = d0 + 0.45, cx = x + dx * C, cz = z + dz * C;
    for (const s of [0, -0.2, 0.2]) { const q = vaultColumn(cx + px * s, cz + pz * s, feet); if (Math.abs(q.top - top) > 0.12) return null; }
    const gc = groundAt(cx, cz, top);
    if (Math.abs(gc - top) > 0.12 || !roomAt(cx, cz, gc, 1.25)) return null;
    for (let d = d0; d <= C; d += 0.1) { const q = vaultColumn(x + dx * d, z + dz * d, feet); if (q.ceil - q.top < 1.0) return null; }
    return { kind: 'climb', x0: x, y0: feet, z0: z, x1: cx, y1: gc, z1: cz, top, land: true, crouch: !roomAt(cx, cz, gc, 1.8), dur: 0.55 + 0.3 * (top - feet), dx, dz };
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

// ---------- 애니메이션 ----------
const PICK_T = 0.5;
// 손에 든 물건(회복 아이템·투척물): 가까운 캐릭터만 실제 모델을 붙인다
const HOLD_POSE = {   // [x, y, z, rx, ry, rz, scale]
  bandage: [0, -0.02, 0.03, 0, 0, 0, 1.2], firstaid: [0.02, -0.03, 0.06, 1.2, 0, 0, 0.95], medkit: [0.02, -0.05, 0.08, 1.25, 0, 0, 0.85],
  drink: [0, -0.02, 0.04, 0, 0, 0, 1.15], frag: [0, -0.03, 0.03, 0, 0, 0, 1.15], smoke: [0, -0.03, 0.03, 0, 0, 0, 1.1],
};
// 들고 쓰는 모양: 붕대는 포장 대신 감는 붕대 롤
let _rollGeo = null;
function heldModel(id) {
  if (id !== 'bandage') return Models.display(id);
  if (!_rollGeo) _rollGeo = [new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16).rotateZ(Math.PI / 2), new THREE.BoxGeometry(0.06, 0.003, 0.11).translate(0, -0.03, 0.05)];
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xe9e3d2 });
  g.add(new THREE.Mesh(_rollGeo[0], m)); g.add(new THREE.Mesh(_rollGeo[1], m)); return g;
}
function setHeld(c, R, L) {
  const r = c.rig, key = (R || '') + '|' + (L || '');
  if (r.heldKey === key) return; r.heldKey = key;
  for (const [arm, id] of [[r.armR, R], [r.armL, L]]) {
    while (arm.hold.children.length) arm.hold.remove(arm.hold.children[0]);
    if (!id) continue;
    const o = heldModel(id), P = HOLD_POSE[id] || [0, 0, 0, 0, 0, 0, 1];
    o.position.set(P[0], P[1], P[2]); o.rotation.set(P[3], P[4], P[5]); o.scale.setScalar(P[6]);
    o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    arm.hold.add(o);
  }
}
function animateChar(c, dt) {
  if (c.veh) { Veh.animateRider(c, dt); return; }
  const a = c.anim, r = c.rig;
  const sp = Math.hypot(c.vel.x, c.vel.z);
  a.speed = lerp(a.speed, sp, clamp(dt * 10, 0, 1));
  const k = clamp(dt * 9, 0, 1);
  // 동작 가중치: 넘기 / 낙하 / 구르기 / 줍기 / 회복 / 투척
  const V = c.vault, vu = V ? clamp(V.t / V.dur, 0, 1) : 0, vk = V ? Math.sin(Math.PI * vu) : 0, climb = !!V && V.kind === 'climb';
  const ru = c.rollT > 0 ? 1 - c.rollT / ROLL_T : 0, rk = c.rollT > 0 ? Math.sin(Math.PI * clamp(ru * 1.1, 0, 1)) : 0;
  const pk = c.pickT > 0 && c.alive ? Math.sin(Math.PI * (1 - c.pickT / PICK_T)) : 0;
  a.air = lerp(a.air || 0, c.alive && c.mode === 'ground' && !c.onGround && !c.inWater && !V && c.airT > 0.2 && c.vel.y < -2 ? 1 : 0, clamp(dt * 7, 0, 1));
  a.heal = lerp(a.heal || 0, c.heal && c.alive ? 1 : 0, clamp(dt * 8, 0, 1)); if (c.heal) a.healId = c.heal.id;
  const tm = c.throwMode, nadeOn = c.alive && !c.knocked && (!!tm || c.throwAnim > 0);
  a.nade = lerp(a.nade || 0, nadeOn ? 1 : 0, clamp(dt * 12, 0, 1)); if (tm) a.nadeId = tm.type;
  const busy = Math.max(a.heal, a.nade, climb ? vk : 0, rk);   // 총을 내려놓는 동작
  a.crouch = lerp(a.crouch, c.stance === 'crouch' ? 1 : 0, k);
  a.prone = lerp(a.prone, c.stance === 'prone' ? 1 : 0, clamp(dt * 6, 0, 1));
  a.armed = lerp(a.armed, c.weapon && c.equipT <= 0 && !c.knocked ? 1 : 0, k) * (1 - busy);
  a.knock = lerp(a.knock || 0, c.knocked ? 1 : 0, k);
  a.aim = lerp(a.aim, c.aiming ? 1 : 0, k);
  // 조준·사격·교전·장전 중이 아니면 총구를 아래로 비스듬히 든 '로우 레디' 자세
  const ready = c.aiming || c.combatFacing || (c.fireHold && c.weapon && !tm) || (G.time - (c.lastShotT || -99) < 1.5) || !!c.rl || !!c.cycle;
  a.ready = lerp(a.ready || 0, ready ? 1 : 0, clamp(dt * 8, 0, 1));
  a.flinch = Math.max(0, a.flinch - dt * 5);
  a.land = Math.max(0, a.land - dt * 3);
  a.fall = lerp(a.fall, c.mode === 'fall' ? 1 : 0, clamp(dt * 4, 0, 1));
  a.chute = lerp(a.chute, c.mode === 'chute' ? 1 : 0, clamp(dt * 4, 0, 1));
  if (!c.alive) a.dead = Math.min(1, a.dead + dt * 2.2);
  // 걸음 위상은 이동 거리에 비례 → 떨림 없음
  if (c.onGround && !c.inWater) a.phase += sp * dt * (a.prone > 0.5 ? 2.6 : 2.15);
  else if (c.inWater) a.phase += dt * 3;
  // 몸 방향
  const mv = sp > 0.6;
  let targetYaw = c.yaw;
  if (!c.isPlayer || !(c.aiming || c.fireHold || c.firstPerson)) { if (mv && !c.aiming && !c.combatFacing) targetYaw = Math.atan2(c.vel.x, c.vel.z); }
  if (V) targetYaw = Math.atan2(V.dx, V.dz); else if (c.rollT > 0) targetYaw = c.rollYaw;
  c.bodyYaw += angleDiff(c.bodyYaw, targetYaw) * clamp(dt * (a.prone > 0.5 ? 4 : V || c.rollT > 0 ? 20 : 11), 0, 1);
  c.root.position.copy(c.pos); c.root.rotation.y = c.bodyYaw;

  const amp = clamp(a.speed / 5.5, 0, 1) * (1 - a.crouch * 0.4) * (1 - a.prone) * (1 - vk) * (1 - rk) * (1 - a.air);
  const ph = a.phase, tuck = Math.max(rk, V && !climb ? vk : 0);
  const legPose = (L, p, side) => {
    const swing = -Math.sin(p) * 0.75 * amp;
    L.hip.rotation.x = swing - a.crouch * 1.25 - a.fall * 0.3 + a.chute * -0.5 - a.land * 0.8 - pk * 0.75 * (1 - a.prone);
    L.knee.rotation.x = amp * (0.2 + 0.9 * Math.max(0, -Math.sin(p + 0.9))) + a.crouch * 2.0 + a.land * 1.4 + a.chute * 0.4 + a.fall * 0.6 + pk * 1.3 * (1 - a.prone);
    L.hip.rotation.z = 0;
    // 공중: 한쪽 다리를 앞으로 굽힌 채 버팀 / 넘기·구르기: 다리를 몸 쪽으로 접음 / 오르기: 한쪽 무릎을 올려 디딤
    if (a.air > 0.01) { L.hip.rotation.x = lerp(L.hip.rotation.x, side > 0 ? -0.75 : 0.15, a.air); L.knee.rotation.x = lerp(L.knee.rotation.x, side > 0 ? 1.25 : 0.55, a.air); }
    if (tuck > 0.01) { L.hip.rotation.x = lerp(L.hip.rotation.x, -1.45 - (side > 0 ? 0.2 : 0), tuck); L.knee.rotation.x = lerp(L.knee.rotation.x, 2.1, tuck); L.hip.rotation.z = (V && !climb ? 0.45 : 0) * tuck; }
    if (climb) { const up = side > 0 ? sstep(0.2, 0.55, vu) * (1 - sstep(0.75, 1, vu)) : 0; L.hip.rotation.x = lerp(L.hip.rotation.x, side > 0 ? -1.5 : 0.1, Math.max(up, vk * 0.4)); L.knee.rotation.x = lerp(L.knee.rotation.x, side > 0 ? 1.9 : 0.35, Math.max(up, vk * 0.4)); }
  };
  legPose(r.legR, ph, -1); legPose(r.legL, ph + Math.PI, 1);
  if (a.fall > 0.01) { r.legR.hip.rotation.z = -0.35 * a.fall; r.legL.hip.rotation.z = 0.35 * a.fall; }
  const bob = Math.abs(Math.sin(ph)) * 0.04 * amp;
  r.hips.position.y = 0.95 - a.crouch * 0.42 - a.land * 0.25 + bob - pk * 0.3 * (1 - a.prone) - tuck * 0.35;
  // 상체
  const pitch = c.alive ? c.pitch : 0;
  r.spine.rotation.x = a.crouch * 0.22 - pitch * 0.45 * (1 - a.prone) * (1 - busy * 0.7) + amp * 0.12 * (1 - a.armed * 0.5) + a.fall * 0.1 + pk * 0.65 * (1 - a.prone) + vk * (climb ? 0.25 : 0.4) - a.air * 0.12 + rk * 0.5 + a.heal * 0.12;
  r.spine.rotation.z = a.flinch * 0.35 * a.flinchDir;
  // 사격 자세: 왼쪽 어깨를 앞으로 비튼 '블레이드' 스탠스 → 오른쪽 어깨 뒤 3인칭 카메라에서 총이 몸통에 가려지지 않는다
  const blade = -(0.12 * (1 - (a.ready || 0)) + 0.42 * (a.ready || 0)) * a.armed * (1 - a.prone) * (1 - a.dead) * (1 - clamp(a.speed / 6 - 0.5, 0, 0.6));
  r.spine.rotation.y = blade;
  r.neck.rotation.x = -pitch * 0.4 * (1 - a.prone) - a.prone * 1.1;
  // 팔: 무장(조준 자세) / 비무장(흔들기) 혼합
  const rd = a.ready || 0;
  const armedR = [lerp(-0.45, -1.15 - pitch * 0.15, rd), lerp(-0.9, -1.0, rd), lerp(0.1, 0.12, rd)], armedL = [lerp(-0.85, -1.45 - pitch * 0.15, rd), lerp(-1.0, -0.5, rd), lerp(-0.55, -0.4, rd)];
  const swR = Math.sin(ph) * 0.6 * amp, swL = -swR;
  const free = 1 - a.armed;
  const set = (A, base, sw, side) => {
    let x = base[0] * a.armed + sw * free + 0.05, e = base[1] * a.armed - 0.25 * free, zz = base[2] * a.armed + side * 0.08 * free;
    // 엎드림: 팔을 머리 방향(몸 로컬 +y)으로
    // 엎드려 기어갈 때(특히 기절) 팔을 번갈아 뻗는다
    const crawl = a.prone * clamp(a.speed / 1.2, 0, 1) * Math.sin(ph + (side > 0 ? Math.PI : 0));
    x = lerp(x, -Math.PI + 0.25 + crawl * 0.45 + a.knock * 0.35, a.prone); e = lerp(e, -0.2 - Math.max(0, crawl) * 0.5 - a.knock * 0.4, a.prone); zz = lerp(zz, side * (0.25 + a.knock * 0.2), a.prone);
    // 낙하/낙하산
    x = lerp(x, -2.7, a.chute); zz = lerp(zz, side * 0.35, a.chute);
    x = lerp(x, -0.3, a.fall); zz = lerp(zz, side * 1.2, a.fall);
    // 공중(건물에서 떨어질 때): 팔을 옆으로 벌려 균형 (총을 들었으면 조금만)
    const ak = a.air * (1 - a.armed * 0.6); x = lerp(x, -1.25, ak); e = lerp(e, -0.5, ak); zz = lerp(zz, side * 1.0, ak);
    A.sh.rotation.set(x, 0, zz); A.el.rotation.x = e;
  };
  // 장전·볼트·펌프 동작: 총 부품을 움직이고 팔 자세를 섞는다 (가까운 캐릭터만)
  let roll = 0;
  const gun = r.gunObj;
  if (gun && (c.rl || c.cycle || c.slideKick > 0 || (c.weapon && c.weapon.mag === 0)) && c.root.visible && G.camera && Math.hypot(c.pos.x - G.camera.position.x, c.pos.z - G.camera.position.z) < 45) {
    const A = weaponAnim(c, gun.userData.meta);
    applyParts(gun, A);
    roll = A.tiltZ * 0.6;
    const blend = (info, table, base) => { const pa = table[info.a] || base, pb = table[info.b] || base; return [lerp(pa[0], pb[0], info.k), lerp(pa[1], pb[1], info.k), lerp(pa[2], pb[2], info.k)]; };
    if (a.armed > 0.5) {
      const L = blend(A.li, ARM_L, armedL), Rr = blend(A.ri, ARM_R, armedR);
      armedL[0] = L[0]; armedL[1] = L[1]; armedL[2] = L[2]; armedR[0] = Rr[0]; armedR[1] = Rr[1]; armedR[2] = Rr[2];
    }
    gun.userData.posed = true;
  } else if (gun && gun.userData.posed) { applyParts(gun, weaponAnim({ rl: null, cycle: null, weapon: c.weapon, slideKick: 0 }, gun.userData.meta)); gun.userData.posed = false; }
  set(r.armR, armedR, swR, -1); set(r.armL, armedL, swL, 1);
  const pose = (A, w, x, e, zz) => { if (w <= 0.001) return; A.sh.rotation.x = lerp(A.sh.rotation.x, x, w); A.el.rotation.x = lerp(A.el.rotation.x, e, w); A.sh.rotation.z = lerp(A.sh.rotation.z, zz, w); };
  const T = G.time || 0;
  // 줍기: 허리를 굽혀 오른손을 바닥으로
  pose(r.armR, pk, a.prone > 0.5 ? -2.6 : -0.6, -0.12, 0.05);
  // 회복: 아이템별 손동작
  if (a.heal > 0.01) {
    const id = a.healId, hu = c.heal ? 1 - c.heal.t / c.heal.total : 1, w = a.heal * (1 - a.prone * 0.5);
    if (id === 'bandage') { pose(r.armL, w, -0.95, -1.5, -0.55); pose(r.armR, w, -0.8 + Math.sin(T * 9) * 0.2, -1.2 + Math.cos(T * 9) * 0.28, 0.4 + Math.cos(T * 9) * 0.12); }
    else if (id === 'drink') {
      const up = sstep(0, 0.22, hu) * (1 - sstep(0.88, 1, hu));
      pose(r.armR, w, lerp(-0.6, -0.95, up), lerp(-1.0, -1.85, up), lerp(0.2, 0.55, up)); pose(r.armL, w * 0.6, -0.3, -0.4, -0.1);
      r.neck.rotation.x -= 0.4 * up * sstep(0.3, 0.45, hu) * w;
    } else { // 구급상자·의료 키트: 왼손에 들고 오른손으로 처치
      const low = id === 'medkit' ? 0.25 : 0;
      pose(r.armL, w, -0.85 + low, -1.15 + low * 0.4, -0.35); pose(r.armR, w, -0.95 + Math.sin(T * 6) * 0.14, -0.95 + Math.cos(T * 7) * 0.15, 0.35);
    }
  }
  // 투척: 가슴 앞에 쥠 → 핀을 뽑으면 머리 위 뒤로 젖힘 → 놓으면 앞으로 휘두름
  if (a.nade > 0.01) {
    const w = a.nade, thr = c.throwAnim > 0 ? 1 - c.throwAnim / 0.35 : 0, wind = tm && tm.pin ? 1 : 0;
    a.wind = lerp(a.wind || 0, wind, clamp(dt * 10, 0, 1));
    let x = lerp(-0.9, -2.75, a.wind), e = lerp(-1.25, -1.5, a.wind), zz = lerp(0.25, -0.15, a.wind);
    if (thr > 0) { x = lerp(-2.75, -0.55, sstep(0, 0.55, thr)); e = lerp(-1.5, -0.25, sstep(0, 0.5, thr)); zz = 0.1; }
    pose(r.armR, w, x, e, zz); pose(r.armL, w, lerp(-0.9, -1.45, Math.max(a.wind, thr > 0 ? 1 - thr : 0)), -0.3, -0.25);
    r.spine.rotation.y += (thr > 0 ? 0.35 * (1 - thr) - 0.2 * thr : -0.3 * a.wind) * w;
  }
  // 넘기: 왼손을 장애물 위에 짚음 / 오르기: 두 팔로 끌어올림
  if (V) {
    if (climb) { const hk = vk; pose(r.armL, Math.max(hk, 0.5), lerp(-2.6, -1.3, vu), -0.5, -0.15); pose(r.armR, Math.max(hk, 0.5), lerp(-2.6, -1.3, vu), -0.5, 0.15); }
    else pose(r.armL, vk, -1.15, -0.25, -0.1);
  }
  // 구르기: 팔을 몸에 붙임
  if (rk > 0.01) { pose(r.armL, rk, -1.6, -1.9, -0.2); pose(r.armR, rk, -1.6, -1.9, 0.2); }
  // 손에 든 물건 (가까운 캐릭터만)
  const near = c.isPlayer || (G.camera && Math.hypot(c.pos.x - G.camera.position.x, c.pos.z - G.camera.position.z) < 40);
  if (near) {
    const hid = a.heal > 0.3 ? a.healId : null, nid = a.nade > 0.3 && (c.throwAnim <= 0 || c.throwAnim > 0.2) ? (a.nadeId || 'frag') : null;
    setHeld(c, nid || (hid === 'bandage' || hid === 'drink' ? hid : null), !nid && (hid === 'firstaid' || hid === 'medkit') ? hid : null);
  } else if (r.heldKey && r.heldKey !== '|') setHeld(c, null, null);
  r.gunMount.rotation.z = roll;
  r.gunMount.rotation.y = lerp(0.7 * (1 - rd), 0, a.prone) - blade;
  r.gunMount.rotation.x = lerp(lerp(0.4, -pitch * 0.15, rd), -Math.PI / 2 + 0.2, a.prone);
  // 개머리판을 오른쪽 어깨에 붙인 자세 → 3인칭 카메라(오른쪽 어깨 뒤)에서 총이 보인다
  r.gunMount.position.set(lerp(lerp(-0.28, -0.17, rd), -0.1, a.prone), lerp(lerp(0.32, 0.43, rd), 0.62, a.prone), lerp(lerp(0.2, 0.24, rd), 0.05, a.prone));
  r.gunMount.visible = a.chute < 0.3 && a.fall < 0.3 && !c.knocked && busy < 0.5;
  // 전신 회전: 엎드림 / 자유낙하 / 사망 / 구르기(몸 중심을 축으로 한 바퀴) / 넘기(옆으로 기울임)
  let bx = a.prone * Math.PI / 2 + a.fall * Math.PI * 0.42;
  let by = a.prone * 0.12;
  r.body.rotation.z = a.knock * 0.32 * a.prone + (V && !climb ? 0.3 * vk : 0); // 기절: 옆으로 기운 채 기어감
  if (a.dead > 0) { if (a.prone > 0.5) { /* 엎드린 채 */ } else { bx = lerp(bx, -Math.PI / 2, smoothstep01(a.dead)); by = lerp(by, 0.18, a.dead); } }
  let bz = 0;
  if (c.rollT > 0 && c.alive) { const th = TAU * sstep(0.08, 0.88, ru), pv = 0.5; bx += th; by += pv - pv * Math.cos(th); bz = -pv * Math.sin(th); }
  r.body.rotation.x = bx; r.body.position.set(0, by + a.fall * 0.6, bz);
  r.chute.visible = a.chute > 0.05; r.chute.scale.setScalar(Math.max(0.05, a.chute));
}
function smoothstep01(t) { return t * t * (3 - 2 * t); }
// 3인칭 팔 자세 표 [어깨 x, 팔꿈치, 어깨 z] — 손이 향하는 지점 이름별
const ARM_L = { well: [-0.95, -1.5, -0.2], pouch: [-0.2, -0.75, -0.12], charge: [-1.6, -0.95, -0.5], chargeBack: [-1.4, -1.35, -0.5], port: [-0.9, -1.65, -0.22], cover: [-1.5, -1.25, -0.42], coverUp: [-1.85, -1.0, -0.42], tray: [-1.3, -1.25, -0.32], foreOpen: [-0.7, -0.85, -0.5], breech: [-1.2, -1.45, -0.3] };
const ARM_R = { bolt: [-1.0, -1.45, 0.12], boltUp: [-1.15, -1.5, 0.08], boltBack: [-1.0, -1.75, 0.1], pouchR: [-0.25, -0.8, 0.12], port: [-1.1, -1.6, -0.05], lever: [-1.15, -1.35, 0.1] };
