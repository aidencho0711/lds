// ============================================================
// 08_vehicle.js — 차량: 말·오토바이·UAZ·세단·픽업트럭
//  · 아케이드 물리: 앞뒤 가속/제동/후진, 속도에 따라 줄어드는 조향각(자전거 모델), 옆미끄러짐(접지력),
//    핸드브레이크 드리프트, 비포장·모래·얕은 물 감속, 경사 중력, 바퀴 4점 지면 추종(기울기), 점프/착지
//  · 충돌: 차체 = 회전 직사각형(OBB) ↔ 건물·나무·바위 상자(분리축), 차량끼리(운동량 교환), 사람(들이받기)
//  · 피해: 총탄·수류탄·충돌·추락 → 연기 → 불 → 폭발(주변 피해·연쇄), 말은 쓰러짐
//  · 주차 중인 차량은 잠들어 계산하지 않는다 (8km 맵 170대)
//  · 탑승자: mode는 'ground' 그대로, c.veh로 표시. 위치는 좌석에서 0.9m 아래 가상 발 위치
//    → 히트박스·시야·자기장 피해가 그대로 맞는다 (머리 = 좌석 + 0.76m)
// ============================================================
const VEH_TYPES = {
  //        표시 이름  최고속(km/h) 가속 제동 후진비 비포장 접지 조향각 감쇠 조향속도 축거  반길이 반폭  중심z 높이 내구도 질량 충돌계수 들이받기 도하깊이
  horse:  { name: '말', kmh: 62, acc: 5.6, brake: 9, rev: 0.22, off: 1.0, grip: 9, turn: 1.9, steerRate: 4, wb: 1.3, hl: 1.2, hw: 0.36, zc: 0.2, H: 2.1, hp: 260, mass: 0.5, crash: 0.55, hit: 5, wade: 1.25,
    seat: [0, 1.74, -0.08], pose: 'horse', camDist: 5.2, camUp: 2.3, axF: 0.6, axR: -0.7, tw: 0.17, animal: true, noise: 55,
    hitBoxes: [[-0.38, 0.85, -1.05, 0.38, 1.7, 0.95], [-0.2, 1.4, 0.75, 0.2, 2.25, 1.62]] },
  moto:   { name: '오토바이', kmh: 150, acc: 8.6, brake: 11, rev: 0.15, off: 0.62, grip: 7.5, steerMax: 0.55, steerFall: 9, steerRate: 3.5, wb: 1.44, hl: 1.08, hw: 0.3, zc: 0, H: 1.25, hp: 450, mass: 0.6, crash: 0.8, hit: 6, wade: 0.6,
    seat: [0, 1.02, -0.3], pose: 'moto', camDist: 4.8, camUp: 1.9, axF: 0.74, axR: -0.7, tw: 0.08, noise: 170, hitBoxes: [[-0.2, 0.28, -0.75, 0.2, 1.0, 0.78]] },
  sedan:  { name: '세단', kmh: 135, acc: 6.2, brake: 10, rev: 0.3, off: 0.6, grip: 6.2, steerMax: 0.6, steerFall: 11, steerRate: 2.6, wb: 2.66, hl: 2.3, hw: 0.9, zc: 0, H: 1.45, hp: 1100, mass: 1.3, crash: 1.6, hit: 9, wade: 0.7,
    seat: [0.4, 0.46, -0.3], pose: 'car', camDist: 7.2, camUp: 2.4, axF: 1.33, axR: -1.33, tw: 0.79, noise: 180, hitBoxes: [[-0.9, 0.3, -2.3, 0.9, 1.0, 2.3]] },
  pickup: { name: '픽업트럭', kmh: 122, acc: 5.5, brake: 10, rev: 0.3, off: 0.74, grip: 6.2, steerMax: 0.58, steerFall: 11, steerRate: 2.5, wb: 3.22, hl: 2.7, hw: 0.98, zc: 0, H: 1.8, hp: 1400, mass: 1.6, crash: 1.5, hit: 10, wade: 0.9,
    seat: [0.42, 0.78, 0.22], pose: 'car', camDist: 8, camUp: 2.7, axF: 1.62, axR: -1.6, tw: 0.86, noise: 190, hitBoxes: [[-0.98, 0.42, -2.62, 0.98, 1.24, 2.64]] },
  uaz:    { name: 'UAZ', kmh: 110, acc: 5.0, brake: 10, rev: 0.3, off: 0.92, grip: 6.8, steerMax: 0.62, steerFall: 12, steerRate: 2.5, wb: 2.4, hl: 2.15, hw: 0.97, zc: 0, H: 1.97, hp: 1800, mass: 1.8, crash: 1.3, hit: 10, wade: 1.0,
    seat: [0.42, 0.95, -0.05], pose: 'car', camDist: 7.6, camUp: 2.8, axF: 1.22, axR: -1.18, tw: 0.8, noise: 200, hitBoxes: [[-0.95, 0.5, -2.1, 0.95, 1.27, 2.1]] },
};
// 좌석: [0] 운전석 + 동승석 (차량 로컬 좌표, 엉덩이 높이). 말 1, 오토바이 2(뒷자리), 차 4(픽업은 뒤 2자리가 적재함)
VEH_TYPES.horse.seats = [VEH_TYPES.horse.seat];
VEH_TYPES.moto.seats = [VEH_TYPES.moto.seat, [0, 1.1, -0.8]];
VEH_TYPES.sedan.seats = [VEH_TYPES.sedan.seat, [-0.4, 0.46, -0.3], [0.4, 0.46, -1.22], [-0.4, 0.46, -1.22]];
VEH_TYPES.pickup.seats = [VEH_TYPES.pickup.seat, [-0.42, 0.78, 0.22], [0.48, 1.0, -1.45], [-0.48, 1.0, -1.45]];
VEH_TYPES.uaz.seats = [VEH_TYPES.uaz.seat, [-0.42, 0.95, -0.05], [0.42, 0.95, -1.0], [-0.42, 0.95, -1.0]];
for (const k in VEH_TYPES) { const T = VEH_TYPES[k]; T.key = k; T.vmax = T.kmh / 3.6; T.R = Math.hypot(T.hl + Math.abs(T.zc), T.hw); }

const Veh = (() => {
  let scene = null, list = [], nextId = 1, cullT = 0;
  const VG = 32; let VGN = 1; const grid = new Map();
  const _b = [], _v = new THREE.Vector3(), _w = new THREE.Vector3();

  // ---------- 공간 색인 ----------
  const cellOf = (x, z) => clamp(Math.floor((z + HALF) / VG), 0, VGN - 1) * VGN + clamp(Math.floor((x + HALF) / VG), 0, VGN - 1);
  function regrid(v) {
    const k = cellOf(v.pos.x, v.pos.z); if (k === v.cell) return;
    if (v.cell >= 0) { const a = grid.get(v.cell); if (a) { const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); } }
    let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(v); v.cell = k;
  }
  const _near = [];
  function near(x, z, r, out = _near) {
    out.length = 0;
    const i0 = clamp(Math.floor((x - r + HALF) / VG), 0, VGN - 1), i1 = clamp(Math.floor((x + r + HALF) / VG), 0, VGN - 1);
    const j0 = clamp(Math.floor((z - r + HALF) / VG), 0, VGN - 1), j1 = clamp(Math.floor((z + r + HALF) / VG), 0, VGN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const a = grid.get(j * VGN + i); if (a) for (const v of a) out.push(v); }
    return out;
  }

  // 탑승자 전원 (운전자 포함)
  const riders = (v) => v.seats.filter(Boolean);
  const freeSeats = (v) => v.seats.reduce((n, s) => n + (s ? 0 : 1), 0);
  // ---------- 생성 ----------
  function init(sc) { dispose(); scene = sc; list = []; grid.clear(); VGN = Math.ceil(SIZE / VG); cullT = 0; }
  function dispose() {
    if (scene) for (const v of list) scene.remove(v.P.root);
    for (const v of list) if (v.smoke) v.smoke = null;
    list = []; grid.clear(); scene = null; Audio.engineStopAll && Audio.engineStopAll();
  }
  function make(type, x, z, yaw) {
    const T = VEH_TYPES[type], P = VehModels.instance(type);
    const v = { id: nextId++, type, T, P, pos: new THREE.Vector3(x, heightAt(x, z), z), yaw, vx: 0, vz: 0, vy: 0, f: 0, steer: 0, yawRate: 0, pitch: 0, roll: 0, lean: 0,
      hp: T.hp, dead: false, burnT: 0, driver: null, seats: T.seats.map(() => null), lastDriver: null, lastHitBy: null, ctrl: { throttle: 0, steer: 0, hand: false },
      awake: true, sleepT: 0, onGround: true, onBox: false, wheelRot: 0, phase: 0, fxT: 0, noiseT: 0, stepAcc: 0, cell: -1, slip: 0, deadT: 0 };
    scene.add(P.root); list.push(v); regrid(v);
    settle(v); v.awake = false;
    return v;
  }
  // 차량 없애기 (훈련장 재배치용). 탑승자가 있으면 거부
  function remove(v) {
    if (v.seats.some(Boolean)) return false;
    if (scene) scene.remove(v.P.root);
    const i = list.indexOf(v); if (i >= 0) list.splice(i, 1);
    if (v.cell >= 0) { const a = grid.get(v.cell); if (a) { const k = a.indexOf(v); if (k >= 0) a.splice(k, 1); } }
    return true;
  }
  // 놓을 수 있는 자리인가: 마른 평지, 구조물·나무와 겹치지 않음, 다른 차량과 떨어짐
  function spotOk(type, x, z, yaw) {
    const T = VEH_TYPES[type], h = heightAt(x, z);
    if (h < 1.0 || !overIslandV(x, z)) return false;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let mn = 1e9, mx = -1e9;
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]]) { const px = x + rx * T.hw * a + fx * (T.zc + T.hl * b), pz = z + rz * T.hw * a + fz * (T.zc + T.hl * b), hh = heightAt(px, pz); mn = Math.min(mn, hh); mx = Math.max(mx, hh); if (hh < 0.8) return false; }
    if (mx - mn > 0.75) return false;
    if (groundAt(x, z, h + 0.3) > h + 0.3) return false;
    if (obbHitsBoxes(x, z, yaw, T, h, 0.5)) return false;
    for (const o of near(x, z, 12)) if (Math.hypot(o.pos.x - x, o.pos.z - z) < 7) return false;
    return true;
  }
  function overIslandV(x, z) { return W.big ? Math.max(Math.abs(x), Math.abs(z)) * 0.65 + Math.hypot(x, z) * 0.35 < HALF * 0.82 : Math.abs(x) < HALF - 30 && Math.abs(z) < HALF - 30; }
  function obbHitsBoxes(x, z, yaw, T, y, pad) {
    const R = T.R + pad + 1; queryBoxes(x - R, z - R, x + R, z + R, _b);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), cx = x + fx * T.zc, cz = z + fz * T.zc;
    for (const b of _b) { if (b.y1 <= y + 0.45 || b.y0 >= y + T.H) continue; if (sat(cx, cz, fx, fz, rx, rz, T.hl + pad, T.hw + pad, b)) return true; }
    return false;
  }
  function spawnAll() {
    const big = !!W.big, total = big ? 170 : 14;
    const rnd01 = Math.random;
    const roadT = () => weightedPick([['sedan', 30], ['pickup', 25], ['uaz', 12], ['moto', 20]]);
    let placed = 0, tries = 0;
    const tryPut = (type, x, z, yaw) => { if (spotOk(type, x, z, yaw)) { make(type, x, z, yaw); placed++; return true; } return false; };
    // 1) 군사기지: UAZ
    for (const p of W.pois.filter((p) => p.type === 'military')) for (let k = 0, n = 0; k < 30 && n < (big ? 4 : 2); k++) { const a = rnd01() * TAU, d = rnd01() * p.r * 0.8; if (tryPut('uaz', p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, rnd01() * TAU)) n++; }
    // 2) 농장·마을: 말
    const rural = W.pois.filter((p) => p.type === 'farm' || p.type === 'village');
    const horses = big ? 34 : 3;
    for (let k = 0, n = 0; k < horses * 25 && n < horses && rural.length; k++) { const p = pick(rural), a = rnd01() * TAU, d = p.r * (0.6 + rnd01() * 0.8); if (tryPut('horse', p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, rnd01() * TAU)) n++; }
    // 3) 도시 주차장
    for (const pk of W.parking) { if (rnd01() < 0.6) tryPut(rnd01() < 0.6 ? 'sedan' : 'pickup', pk[0] + rnd01() * 4 - 2, pk[1] + rnd01() * 4 - 2, rnd01() < 0.5 ? 0 : Math.PI / 2); }
    // 4) 나머지: 도로변 (길이 비례)
    const roads = W.roads.map((r) => [r, r.len]);
    while (placed < total && tries++ < total * 40) {
      const r = weightedPick(roads), t = rnd01() * r.len, s = rnd01() < 0.5 ? -1 : 1, off = r.width / 2 + 1.4 + rnd01() * 1.6;
      const x = r.ax + r.dx * t - r.dz * off * s, z = r.az + r.dz * t + r.dx * off * s;
      const yaw = Math.atan2(r.dx, r.dz) + (rnd01() < 0.5 ? 0 : Math.PI) + (rnd01() - 0.5) * 0.2;
      tryPut(roadT(), x, z, yaw);
    }
    return placed;
  }

  // ---------- 분리축(SAT): 차량 직사각형 ↔ 축정렬 상자. 겹치면 {o, nx, nz} (차량을 밀어낼 방향) ----------
  const _sat = { o: 0, nx: 0, nz: 0 };
  function sat(cx, cz, fx, fz, rx, rz, hl, hw, b) {
    const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, ex = (b.x1 - b.x0) / 2, ez = (b.z1 - b.z0) / 2, dx = cx - bx, dz = cz - bz;
    let best = 1e9, nx = 0, nz = 0;
    const axes = [[1, 0], [0, 1], [fx, fz], [rx, rz]];
    for (const [ax, az] of axes) {
      const ro = Math.abs(fx * ax + fz * az) * hl + Math.abs(rx * ax + rz * az) * hw, rb = Math.abs(ax) * ex + Math.abs(az) * ez;
      const d = dx * ax + dz * az, o = ro + rb - Math.abs(d);
      if (o <= 0) return null;
      if (o < best) { best = o; const sg = d < 0 ? -1 : 1; nx = ax * sg; nz = az * sg; }
    }
    _sat.o = best; _sat.nx = nx; _sat.nz = nz; return _sat;
  }

  // ---------- 물리 ----------
  function settle(v) {
    ground(v, 0.016, true);
    v.pos.y = v.gy; v.vy = 0; v.pitch = v.pitchT; v.roll = v.rollT; v.onGround = true;
    syncMesh(v);
  }
  const wheelGround = (x, z, feet) => groundAt(x, z, feet);
  function ground(v, dt, init) {
    const T = v.T, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    const feet = init ? heightAt(v.pos.x, v.pos.z) + 0.3 : v.pos.y - 0.1;
    const s = (lx, lz) => wheelGround(v.pos.x + rx * lx + fx * lz, v.pos.z + rz * lx + fz * lz, feet);
    const fl = s(T.tw, T.axF), fr = s(-T.tw, T.axF), rl = s(T.tw, T.axR), rr = s(-T.tw, T.axR);
    const front = (fl + fr) / 2, rear = (rl + rr) / 2;
    const k = -T.axR / (T.axF - T.axR);
    v.gy = rear + (front - rear) * k;
    v.pitchT = clamp(Math.atan2(front - rear, T.axF - T.axR), -0.7, 0.7);
    v.rollT = T.tw > 0.3 ? clamp(Math.atan2((fl + rl) - (fr + rr), 4 * T.tw), -0.5, 0.5) : 0;
    const hc = heightAt(v.pos.x, v.pos.z);
    v.onBox = v.gy > hc + 0.05;
    v.depth = v.onBox ? 0 : WATER_Y - hc;
  }
  function stepOnce(v, dt) {
    const T = v.T, C = v.ctrl;
    let fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    let f = v.vx * fx + v.vz * fz, l = v.vx * rx + v.vz * rz;
    const sfc = surfaceAt(v.pos.x, v.pos.z), road = v.onBox || sfc === 4 || sfc === 5;
    let sf = road ? 1 : sfc === 3 ? T.off * 0.82 : sfc === 2 ? T.off * 0.9 : T.off;
    if (v.depth > 0.2) sf *= clamp(1 - v.depth / (T.wade * 1.25), 0.2, 1);
    const burning = v.burnT > 0 && !T.animal;
    const vmax = T.vmax * sf * (burning ? 0.85 : 1);
    const thr = v.onGround ? C.throttle : 0;
    if (thr > 0.05) {
      if (f < -0.3) f = Math.min(0, f + T.brake * thr * dt);
      else f += T.acc * thr * Math.max(0, 1 - Math.pow(Math.max(0, f) / vmax, 3)) * dt * (f < 3 ? 1.25 : 1);
    } else if (thr < -0.05) {
      if (f > 0.3) f = Math.max(0, f + T.brake * thr * dt);
      else { const rm = Math.max(2, vmax * T.rev); f += T.acc * 0.75 * thr * Math.max(0, 1 - (f / rm) ** 2) * dt; }
    }
    if (v.onGround) {
      const coast = Math.abs(thr) < 0.05 ? (v.driver ? 1.1 : 3.2) : 0;
      const drag = (0.3 + coast) * (road ? 1 : 1.5) + (v.depth > 0.2 ? v.depth * 3 : 0);
      f -= Math.sign(f) * Math.min(Math.abs(f), drag * dt);
      if (Math.abs(f) > vmax) f -= Math.sign(f) * Math.min(Math.abs(f) - vmax, ((Math.abs(f) - vmax) * 1.4 + 1.5) * dt);
      if (C.hand) f -= Math.sign(f) * Math.min(Math.abs(f), 6.5 * dt);
      f -= GRAVITY * Math.sin(v.pitch) * 0.82 * dt; // 오르막 감속 / 내리막 가속
    }
    // 조향 (steer > 0 = 오른쪽 = yaw 감소)
    v.steer += clamp(C.steer - v.steer, -T.steerRate * dt, T.steerRate * dt);
    let yr;
    if (T.animal) yr = v.steer * T.turn * (Math.abs(f) < 0.6 ? 0.55 : 1) * (f < -0.3 ? -1 : 1);
    else { const ang = v.steer * T.steerMax / (1 + Math.abs(f) / T.steerFall); yr = f * Math.tan(ang) / T.wb; }
    if (!v.onGround) yr *= 0.15;
    v.yawRate = yr; v.yaw -= yr * dt;
    // 옆미끄러짐: 접지력만큼 빠르게 사라진다 (핸드브레이크면 약해짐 → 드리프트)
    const grip = T.grip * (C.hand ? 0.2 : 1) * (v.onGround ? 1 : 0.03) * (road ? 1 : 0.8) * (sfc === 3 && !road ? 0.7 : 1);
    l *= Math.exp(-grip * dt);
    v.slip = Math.abs(l);
    fx = Math.sin(v.yaw); fz = Math.cos(v.yaw); rx = Math.cos(v.yaw); rz = -Math.sin(v.yaw);
    v.vx = f * fx + l * rx; v.vz = f * fz + l * rz; v.f = f;
    const ox = v.pos.x, oz = v.pos.z;
    v.pos.x += v.vx * dt; v.pos.z += v.vz * dt;
    collideWorld(v);
    // 깊은 물: 들어가지 못하고 멈춘다
    const hc = heightAt(v.pos.x, v.pos.z);
    if (hc < WATER_Y - T.wade && groundAt(v.pos.x, v.pos.z, v.pos.y) <= hc + 0.05) {
      v.pos.x = ox; v.pos.z = oz; v.waterBlock = (v.waterBlock || 0) + 1; const sp = Math.hypot(v.vx, v.vz); if (sp > 6) impact(v, sp * 0.5, null);
      v.vx = v.vz = 0; v.f = 0;
    }
  }
  function collideWorld(v) {
    const T = v.T, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw), R = T.R + 0.5;
    queryBoxes(v.pos.x - R, v.pos.z - R, v.pos.x + R, v.pos.z + R, _b);
    const y0 = v.pos.y + 0.5, y1 = v.pos.y + T.H;
    for (let it = 0; it < 3; it++) {
      let hit = false;
      for (const b of _b) {
        if (b.y1 <= y0 || b.y0 >= y1) continue;
        const s = sat(v.pos.x + fx * T.zc, v.pos.z + fz * T.zc, fx, fz, rx, rz, T.hl, T.hw, b);
        if (!s) continue;
        hit = true; v.pos.x += s.nx * s.o; v.pos.z += s.nz * s.o; v.lastBox = b;
        const vn = v.vx * s.nx + v.vz * s.nz;
        if (vn < 0) { impact(v, -vn, b); v.vx -= vn * s.nx * 1.25; v.vz -= vn * s.nz * 1.25; v.vx *= 0.96; v.vz *= 0.96; }
      }
      if (!hit) break;
    }
    const lim = HALF - 6; v.pos.x = clamp(v.pos.x, -lim, lim); v.pos.z = clamp(v.pos.z, -lim, lim);
  }
  // 충돌 충격: 차량 피해 + 탑승자 피해 + 소리
  function impact(v, sp, what) {
    if (sp < 3) return;
    if (G.time - (v.impT || -9) < 0.25 && sp < (v.impS || 0) + 3) return;
    v.impT = G.time; v.impS = sp;
    const dmg = Math.max(0, sp - 4) ** 2 * v.T.crash;
    if (dmg > 0) damage(v, dmg, v.lastHitBy, 'crash');
    if (sp > 9) for (const r of riders(v)) applyDamage(r, (sp - 9) * 2.6, 'impact', null, 'crash');
    Audio.crash && Audio.crash(v.pos, clamp(sp / 25, 0.15, 1), v.T.animal);
    if (G.player && G.player.veh === v) G.shake = Math.max(G.shake, clamp(sp / 30, 0.1, 0.9));
  }
  function physics(v, dt) {
    const sp = Math.hypot(v.vx, v.vz);
    const n = Math.max(1, Math.ceil(sp * dt / 0.45));
    for (let i = 0; i < n; i++) stepOnce(v, dt / n);
    // 수직: 지면을 따라가되, 둔덕을 빠르게 넘으면 뜬다
    const prevY = v.pos.y, wasGround = v.onGround, vyBefore = v.vy;
    ground(v, dt);
    v.vy -= GRAVITY * dt;
    v.pos.y += v.vy * dt;
    if (v.pos.y <= v.gy) {
      if (!wasGround && vyBefore < -8) { const s = -vyBefore; damage(v, (s - 8) ** 2 * 6 * v.T.crash, v.lastHitBy, 'crash'); if (s > 12) for (const r of riders(v)) applyDamage(r, (s - 12) * 6, 'impact', null, 'fall'); Audio.crash && Audio.crash(v.pos, clamp(s / 20, 0.2, 1), v.T.animal); }
      v.pos.y = v.gy;
      v.vy = wasGround ? clamp((v.gy - prevY) / Math.max(dt, 1e-3), -25, 12) : 0;
      v.onGround = true;
    } else v.onGround = false;
    const k = clamp(dt * (v.onGround ? 10 : 2), 0, 1);
    v.pitch += (v.pitchT - v.pitch) * k; v.roll += (v.rollT - v.roll) * k;
    // 오토바이: 회전 방향으로 기울기
    if (v.type === 'moto') v.lean = lerp(v.lean, clamp(v.yawRate * Math.abs(v.f) * 0.045, -0.55, 0.55) * (v.onGround ? 1 : 0.3), clamp(dt * 6, 0, 1));
    regrid(v);
  }

  // ---------- 차량끼리 ----------
  const _nn = [];
  function vehVeh(a) {
    const Ta = a.T;
    for (const b of near(a.pos.x, a.pos.z, Ta.R + 6, _nn)) {
      if (b === a || (b.awake && b.id < a.id) || (b.dead && b.T.animal)) continue;
      const Tb = b.T, dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
      if (dx * dx + dz * dz > (Ta.R + Tb.R) ** 2 || Math.abs(a.pos.y - b.pos.y) > 2.2) continue;
      const fa = [Math.sin(a.yaw), Math.cos(a.yaw)], ra = [Math.cos(a.yaw), -Math.sin(a.yaw)], fb = [Math.sin(b.yaw), Math.cos(b.yaw)], rb = [Math.cos(b.yaw), -Math.sin(b.yaw)];
      const ca = [a.pos.x + fa[0] * Ta.zc, a.pos.z + fa[1] * Ta.zc], cb = [b.pos.x + fb[0] * Tb.zc, b.pos.z + fb[1] * Tb.zc], d = [ca[0] - cb[0], ca[1] - cb[1]];
      let best = 1e9, nx = 0, nz = 0, sep = false;
      for (const ax of [fa, ra, fb, rb]) {
        const pa = Math.abs(fa[0] * ax[0] + fa[1] * ax[1]) * Ta.hl + Math.abs(ra[0] * ax[0] + ra[1] * ax[1]) * Ta.hw;
        const pb = Math.abs(fb[0] * ax[0] + fb[1] * ax[1]) * Tb.hl + Math.abs(rb[0] * ax[0] + rb[1] * ax[1]) * Tb.hw;
        const dd = d[0] * ax[0] + d[1] * ax[1], o = pa + pb - Math.abs(dd);
        if (o <= 0) { sep = true; break; }
        if (o < best) { best = o; const sg = dd < 0 ? -1 : 1; nx = ax[0] * sg; nz = ax[1] * sg; }
      }
      if (sep) continue;
      const ma = Ta.mass, mb = b.dead ? 1e6 : Tb.mass, ka = mb / (ma + mb), kb = ma / (ma + mb);
      a.pos.x += nx * best * ka; a.pos.z += nz * best * ka; b.pos.x -= nx * best * kb; b.pos.z -= nz * best * kb;
      const vr = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (vr < 0) {
        const j = -(1.2 * vr) / (1 / ma + 1 / mb);
        a.vx += j / ma * nx; a.vz += j / ma * nz; if (!b.dead) { b.vx -= j / mb * nx; b.vz -= j / mb * nz; }
        impact(a, -vr * kb * 1.6, null); if (!b.dead) impact(b, -vr * ka * 1.6, null);
      }
      if (!b.dead) { b.awake = true; b.sleepT = 0; regrid(b); }
    }
  }
  // ---------- 사람과 충돌 ----------
  // 움직이는 차량이 사람을 치면 피해 + 튕겨냄
  function runOver(v) {
    const T = v.T, sp = Math.hypot(v.vx, v.vz); if (sp < 0.5) return;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    const cx = v.pos.x + fx * T.zc, cz = v.pos.z + fz * T.zc;
    for (const c of CHARS) {
      if (!c.alive || c.veh || c.mode !== 'ground') continue;
      const dx = c.pos.x - cx, dz = c.pos.z - cz; if (dx * dx + dz * dz > (T.R + 1) ** 2) continue;
      if (c.pos.y > v.pos.y + T.H || c.pos.y + 1.6 < v.pos.y + 0.2) continue;
      const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz, pz = T.hl + CHAR_R - Math.abs(lz), px = T.hw + CHAR_R - Math.abs(lx);
      if (pz <= 0 || px <= 0) continue;
      // 상대 속도(차가 사람 쪽으로)
      const nx = px < pz ? rx * Math.sign(lx) : fx * Math.sign(lz), nz = px < pz ? rz * Math.sign(lx) : fz * Math.sign(lz);
      const rel = -((c.vel.x - v.vx) * nx + (c.vel.z - v.vz) * nz);
      if (rel > 3 && G.time - (c.runT || -9) > 0.7) {
        c.runT = G.time;
        applyDamage(c, (rel - 2.5) * T.hit, 'impact', v.driver || v.lastDriver, 'veh');
        c.vel.x = v.vx * 0.9 + nx * 3; c.vel.z = v.vz * 0.9 + nz * 3; c.vel.y = Math.min(7, 2 + rel * 0.25); c.onGround = false;
        v.vx *= 0.93; v.vz *= 0.93;
        Audio.impact(c.pos, true);
      }
      const push = Math.min(px, pz) + 0.02;
      c.pos.x += nx * push; c.pos.z += nz * push;
    }
  }
  // 걷는 사람이 서 있는 차량에 막힘 (collideChar에서 호출)
  function pushChar(c) {
    if (!list.length || c.veh) return;
    for (const v of near(c.pos.x, c.pos.z, 6)) {
      if (v.dead && v.T.animal) continue;
      const T = v.T; if (c.pos.y > v.pos.y + T.H - 0.2 || c.pos.y + c.height < v.pos.y + 0.3) continue;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      const dx = c.pos.x - (v.pos.x + fx * T.zc), dz = c.pos.z - (v.pos.z + fz * T.zc);
      const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz, pz = T.hl + CHAR_R - Math.abs(lz), px = T.hw + CHAR_R - Math.abs(lx);
      if (pz <= 0 || px <= 0) continue;
      if (px < pz) { const s = Math.sign(lx) || 1; c.pos.x += rx * s * px; c.pos.z += rz * s * px; const vn = c.vel.x * rx * s + c.vel.z * rz * s; if (vn < 0) { c.vel.x -= vn * rx * s; c.vel.z -= vn * rz * s; } }
      else { const s = Math.sign(lz) || 1; c.pos.x += fx * s * pz; c.pos.z += fz * s * pz; const vn = c.vel.x * fx * s + c.vel.z * fz * s; if (vn < 0) { c.vel.x -= vn * fx * s; c.vel.z -= vn * fz * s; } }
    }
  }

  // ---------- 총탄·시야 ----------
  const _ray = { t: Infinity, v: null }, lo = new Float64Array(3), ld = new Float64Array(3);
  function ray(ox, oy, oz, dx, dy, dz, maxD, except) {
    _ray.t = Infinity; _ray.v = null;
    for (const v of list) {
      if (v === except || (v.dead && v.T.animal && v.deadT > 1)) continue;
      const T = v.T, cx = v.pos.x - ox, cy = v.pos.y + 1 - oy, cz = v.pos.z - oz, along = cx * dx + cy * dy + cz * dz;
      if (along < -T.R - 1 || along > maxD + T.R + 1) continue;
      const px = cx - dx * along, py = cy - dy * along, pz = cz - dz * along;
      if (px * px + py * py + pz * pz > (T.R + 1.2) ** 2) continue;
      // 차량 로컬 좌표 (기울기는 무시)
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      const qx = ox - v.pos.x, qz = oz - v.pos.z;
      lo[0] = qx * rx + qz * rz; lo[1] = oy - v.pos.y; lo[2] = qx * fx + qz * fz; ld[0] = dx * rx + dz * rz; ld[1] = dy; ld[2] = dx * fx + dz * fz;
      for (const hb of T.hitBoxes) {
        let t0 = 0, t1 = Math.min(maxD, _ray.t), ok = true;
        for (let a = 0; a < 3 && ok; a++) {
          const lo0 = hb[a], hi0 = hb[a + 3];
          if (Math.abs(ld[a]) < 1e-9) { if (lo[a] < lo0 || lo[a] > hi0) ok = false; continue; }
          let ta = (lo0 - lo[a]) / ld[a], tb = (hi0 - lo[a]) / ld[a]; if (ta > tb) { const s = ta; ta = tb; tb = s; }
          if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) ok = false;
        }
        if (ok && t0 < _ray.t && t0 > 0.05) { _ray.t = t0; _ray.v = v; }
      }
    }
    return _ray;
  }

  // ---------- 피해·파괴 ----------
  function damage(v, dmg, attacker, cause) {
    if (v.dead || dmg <= 0) return;
    if (G.net && Net.vehRemote(v)) { Net.vehHit(v, dmg, attacker, cause); return; } // 다른 기기가 움직이는 차량: 그 기기가 판정
    v.hp -= dmg; if (attacker) v.lastHitBy = attacker;
    v.awake = true; v.sleepT = 0;
    if (attacker) for (const r of riders(v)) if (r.brain && attacker !== r && !sameTeam(attacker, r)) r.brain.onDamaged(attacker, cause);
    if (v.hp <= 0) {
      v.hp = 0;
      if (v.T.animal) { kill(v); return; }
      if (v.burnT <= 0) { v.burnT = 3.6; if (G.player && G.player.veh === v) HUD.toast('차량에 불이 붙었습니다! 곧 폭발합니다 — 내리세요 (F)', 'warn'); }
    }
  }
  function kill(v) { // 말: 쓰러짐
    v.dead = true; v.deadT = 0; v.awake = true; v.ctrl.throttle = 0;
    for (const d of riders(v)) { exit(d, false, true); applyDamage(d, 8, 'impact', null, 'fall'); }
    Audio.death(v.pos);
  }
  function explode(v) {
    if (G.net) Net.ev({ k: 'vboom', n: v.nid });
    v.dead = true; v.burnT = 0; v.awake = false; v.vx = v.vz = 0;
    const x = v.pos.x, y = v.pos.y + 0.8, z = v.pos.z, by = v.lastHitBy;
    FX.explosion(x, y, z); FX.explosion(x + rnd(-1, 1), y + 0.6, z + rnd(-1, 1)); Audio.explosion({ x, y, z });
    G.noises.push({ x, y, z, t: G.time, r: 300, by, kind: 'blast' });
    for (const d of riders(v)) { applyDamage(d, 400, 'impact', by, 'vexp'); if (d.veh) exit(d, false, true); }
    for (const c of CHARS) {
      if (!c.alive || c.mode !== 'ground') continue;
      c.chest(_v); const d = Math.hypot(_v.x - x, _v.y - y, _v.z - z); if (d > 8) continue;
      const cover = losClear(x, y + 0.4, z, _v.x, _v.y, _v.z) ? 1 : 0.2;
      applyDamage(c, 150 * Math.pow(1 - d / 8, 1.2) * cover, 'blast', by, 'vexp');
    }
    blast(x, y, z, 7, 500, by, v);
    VehModels.wreck(v.P); v.P.root.position.y -= 0.12;
    v.smokeT = 30;
    if (G.player && G.player.alive) { const d = Math.hypot(G.player.pos.x - x, G.player.pos.z - z); if (d < 60) G.shake = Math.max(G.shake, (1 - d / 60) * 1.4); }
  }
  // 폭발(수류탄·차량)이 주변 차량에 주는 피해
  function blast(x, y, z, r, dmg, owner, except) {
    for (const v of near(x, z, r + 3)) {
      if (v === except || v.dead) continue;
      const d = Math.hypot(v.pos.x - x, v.pos.y + 0.8 - y, v.pos.z - z); if (d > r + 1.5) continue;
      damage(v, dmg * clamp(1 - (d - 1.5) / r, 0, 1), owner, 'blast');
    }
  }

  // 다른 기기에서 폭발한 차량: 보이기만 (피해는 그쪽이 판정)
  function netBoom(v) {
    v.dead = true; v.burnT = 0; v.awake = false; v.vx = v.vz = 0;
    const x = v.pos.x, y = v.pos.y + 0.8, z = v.pos.z;
    FX.explosion(x, y, z); FX.explosion(x + rnd(-1, 1), y + 0.6, z + rnd(-1, 1)); Audio.explosion({ x, y, z });
    G.noises.push({ x, y, z, t: G.time, r: 300, by: v.lastHitBy, kind: 'blast' });
    for (const d of riders(v)) if (!d.net || d.net.mine) exit(d, false, true);
    VehModels.wreck(v.P); v.P.root.position.y -= 0.12; v.smokeT = 30;
    if (G.player && G.player.alive) { const d = Math.hypot(G.player.pos.x - x, G.player.pos.z - z); if (d < 60) G.shake = Math.max(G.shake, (1 - d / 60) * 1.4); }
  }
  // ---------- 탑승 ----------
  function nearestEnterable(c, r = 2.2) {
    let best = null, bd = r;
    for (const v of near(c.pos.x, c.pos.z, 8)) {
      if (v.dead || !freeSeats(v) || v.burnT > 0) continue;
      const T = v.T, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      const dx = c.pos.x - (v.pos.x + fx * T.zc), dz = c.pos.z - (v.pos.z + fz * T.zc), lz = dx * fx + dz * fz, lx = dx * rx + dz * rz;
      const ex = Math.max(0, Math.abs(lx) - T.hw), ez = Math.max(0, Math.abs(lz) - T.hl), d = Math.hypot(ex, ez);
      if (Math.abs(c.pos.y - v.pos.y) > 1.6) continue;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  // seat: 원하는 좌석(없으면 운전석이 비면 운전석, 아니면 첫 빈 동승석). passengerOnly: 봇 팀원은 동승석만
  function enter(c, v, seat, passengerOnly) {
    if (!v || v.dead || c.veh || c.knocked || !c.alive || v.burnT > 0) return false;
    let i = seat !== undefined ? seat : (!v.seats[0] && !passengerOnly ? 0 : v.seats.findIndex((s, k) => !s && k > 0));
    if (i < 0 || i >= v.seats.length || v.seats[i]) return false;
    if (c.revive) cancelRevive(c, true);
    v.seats[i] = c; c.seat = i; c.veh = v; v.awake = true; v.sleepT = 0;
    if (i === 0) { v.driver = c; v.lastDriver = c; }
    c.cycle = null; c.heal = null; c.throwMode = null; c.vault = null; c.rollT = 0; c.aiming = false; c.sprint = false; c.stance = 'stand'; c.vel.set(0, 0, 0); c.burstQ = 0;
    if (i === 0) { c.rl = null; v.ctrl.throttle = 0; v.ctrl.steer = 0; v.ctrl.hand = false; }
    c.setVisibleGear(); syncRider(v);
    if (c.isPlayer) {
      HUD.toast(i === 0 ? `${v.T.name} 운전 · 최고 속도 ${v.T.kmh}km/h` : `${v.T.name} ${i + 1}번 좌석 — 사격 가능`, 'ok');
      c.yaw = v.yaw; c.pitch = -0.12; Cam.vLookT = -9; Audio.vehDoor && Audio.vehDoor(v.T.animal);
    }
    return true;
  }
  // 다음 빈 좌석으로 옮기기 (운전석 포함 순환)
  function switchSeat(c) {
    const v = c.veh; if (!v) return false;
    const n = v.seats.length;
    for (let k = 1; k < n; k++) {
      const i = (c.seat + k) % n; if (v.seats[i]) continue;
      v.seats[c.seat] = null; if (c.seat === 0) { v.driver = null; v.ctrl.throttle = 0; v.ctrl.steer = 0; v.ctrl.hand = false; }
      v.seats[i] = c; c.seat = i; if (i === 0) { v.driver = c; v.lastDriver = c; c.rl = null; }
      c.aiming = false; c.setVisibleGear(); syncRider(v);
      if (c.isPlayer) { HUD.toast(i === 0 ? '운전석' : `${i + 1}번 좌석 — 사격 가능`, 'info'); Audio.vehDoor && Audio.vehDoor(v.T.animal); }
      return true;
    }
    if (c.isPlayer) HUD.toast('빈 좌석이 없습니다', 'warn');
    return false;
  }
  // 내리기: 운전석 쪽 → 반대쪽 → 앞 → 뒤 순으로 빈자리
  function exit(c, quiet, forced) {
    const v = c.veh; if (!v) return false;
    const T = v.T, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    const st = T.seats[c.seat || 0] || T.seat, side = st[0] < 0 ? -1 : 1; // 내 좌석 쪽 문으로 먼저
    const cand = [[side * (T.hw + 0.7), st[2]], [-side * (T.hw + 0.7), st[2]], [0, T.zc + T.hl + 0.7], [0, T.zc - T.hl - 0.7], [T.hw + 1.4, 0], [-(T.hw + 1.4), 0]];
    let spot = null;
    for (const [lx, lz] of cand) {
      const x = v.pos.x + rx * lx + fx * lz, z = v.pos.z + rz * lx + fz * lz, g = groundAt(x, z, v.pos.y + 0.6);
      if (Math.abs(g - v.pos.y) > 1.5 || g < WATER_Y - 1.2) continue;
      queryBoxes(x - 0.6, z - 0.6, x + 0.6, z + 0.6, _b);
      let ok = true; for (const b of _b) if (b.y1 > g + STEP_H && b.y0 < g + 1.7 && x > b.x0 - CHAR_R && x < b.x1 + CHAR_R && z > b.z0 - CHAR_R && z < b.z1 + CHAR_R) { ok = false; break; }
      if (ok) { spot = [x, g, z]; break; }
    }
    if (!spot && !forced) { if (c.isPlayer && !quiet) HUD.toast('내릴 자리가 없습니다', 'warn'); return false; }
    if (!spot) spot = [v.pos.x, v.pos.y + T.H, v.pos.z];
    const sp = Math.hypot(v.vx, v.vz);
    const si = c.seat || 0; if (v.seats[si] === c) v.seats[si] = null; c.veh = null; c.seat = 0;
    if (v.driver === c) { v.driver = null; v.ctrl.throttle = 0; v.ctrl.steer = 0; v.ctrl.hand = false; }
    c.pos.set(spot[0], spot[1], spot[2]); c.vel.set(v.vx * 0.5, 0, v.vz * 0.5); c.onGround = true;
    c.bodyYaw = v.yaw; c.root.rotation.set(0, v.yaw, 0); c.root.rotation.order = 'XYZ'; c.rig.neck.rotation.y = 0;
    c.setVisibleGear();
    if (sp > 7 && c.alive) applyDamage(c, (sp - 7) * 6, 'impact', null, 'fall');
    if (c.isPlayer && !quiet) Audio.vehDoor && Audio.vehDoor(T.animal);
    return true;
  }
  const _seat = new THREE.Vector3();
  function syncRider(v) {
    const T = v.T; let done = false;
    for (let i = 0; i < v.seats.length; i++) {
      const c = v.seats[i]; if (!c) continue;
      if (!done) { v.P.root.updateMatrixWorld(true); done = true; }
      const st = T.seats[i]; _seat.set(st[0], st[1] - 0.9, st[2]); v.P.body.localToWorld(_seat);
      c.pos.copy(_seat); c.vel.set(v.vx, v.vy, v.vz); c.bodyYaw = v.yaw; c.onGround = true; c.inWater = false;
      if (!c.isPlayer && i === 0) c.yaw = v.yaw;
    }
  }
  // 탑승 자세 (animateChar 대신)
  function animateRider(c, dt) {
    const v = c.veh, r = c.rig, a = c.anim, T = v.T, pose = T.pose;
    r.root.rotation.order = 'YXZ'; r.root.position.copy(c.pos); r.root.rotation.set(-v.pitch, v.yaw, v.roll + v.lean);
    r.body.rotation.set(0, 0, 0); r.body.position.y = 0; r.chute.visible = false; r.gunMount.visible = false;
    a.speed = 0; a.crouch = 0; a.prone = 0; a.fall = 0; a.chute = 0; a.land = 0;
    const bob = pose === 'horse' ? Math.sin(v.phase * 2) * 0.03 * clamp(Math.abs(v.f) / 6, 0, 1) : 0;
    r.hips.position.y = 0.95 + bob;
    const st = v.steer;
    for (const [L, s] of [[r.legR, -1], [r.legL, 1]]) {
      if (pose === 'car') { L.hip.rotation.set(-1.45, 0, s * 0.06); L.knee.rotation.x = 1.4; }
      else if (pose === 'moto') { L.hip.rotation.set(-1.05, 0, s * 0.28); L.knee.rotation.x = 1.35; }
      else { L.hip.rotation.set(-0.5, 0, s * 0.52); L.knee.rotation.x = 0.95; }
    }
    r.spine.rotation.set(pose === 'moto' ? 0.42 : pose === 'horse' ? 0.15 + bob * 2 : -0.06, 0, 0);
    for (const [A, s] of [[r.armR, -1], [r.armL, 1]]) {
      if (pose === 'car') { A.sh.rotation.set(-1.0 + s * st * 0.12, 0, s * 0.12); A.el.rotation.x = -0.6; }
      else if (pose === 'moto') { A.sh.rotation.set(-1.15 + s * st * 0.15, 0, s * 0.32); A.el.rotation.x = -0.35; }
      else { A.sh.rotation.set(-0.7, 0, s * 0.12); A.el.rotation.x = -0.95 + bob * 3; }
    }
    const look = c.isPlayer ? clamp(angleDiff(v.yaw, c.yaw), -1.1, 1.1) : 0;
    r.neck.rotation.set(-0.05, look, 0);
    a.flinch = Math.max(0, a.flinch - dt * 5); r.spine.rotation.z = a.flinch * 0.25 * a.flinchDir;
    // 동승자: 상체를 조준 방향으로 돌리고 총을 든다 (오토바이 뒷자리는 한 손 잡기 대신 같은 자세)
    if (c.seat > 0 && c.weapon && c.equipT <= 0) {
      const tw = clamp(angleDiff(v.yaw, c.yaw), -2.7, 2.7), pitch = c.pitch || 0;
      r.spine.rotation.set(-pitch * 0.4 + (pose === 'moto' ? 0.15 : 0), tw * 0.75, 0); r.neck.rotation.set(-pitch * 0.35, tw * 0.25, 0);
      r.armR.sh.rotation.set(-1.15 - pitch * 0.15, 0, 0.12); r.armR.el.rotation.x = -1.0;
      r.armL.sh.rotation.set(-1.45 - pitch * 0.15, 0, -0.4); r.armL.el.rotation.x = -0.5;
      r.gunMount.visible = true; r.gunMount.rotation.set(-pitch * 0.15, 0, 0); r.gunMount.position.set(-0.17, 0.43, 0.24);
    }
  }

  // ---------- 매 프레임 ----------
  function syncMesh(v) {
    const P = v.P;
    P.root.position.copy(v.pos); P.root.rotation.order = 'YXZ'; P.root.rotation.set(-v.pitch, v.yaw, v.roll + v.lean);
    if (v.T.animal) return;
    for (const w of P.wheels) w.rotation.x = v.wheelRot;
    const ang = v.steer * (v.T.steerMax || 0.5);
    for (const s of P.steerPivots) s.rotation.y = -ang;
  }
  function animateHorse(v, dt) {
    const P = v.P, sp = Math.abs(v.f);
    if (v.dead) { // 쓰러짐
      v.deadT += dt; const k = clamp(v.deadT / 0.7, 0, 1);
      P.body.rotation.z = smoothstep01(k) * 1.45; P.body.position.y = -smoothstep01(k) * 0.55;
      for (const L of P.legs) { L.hip.rotation.x = (L.front ? -0.3 : 0.3) * k; L.knee.rotation.x = 0.4 * k; }
      return;
    }
    // 걸음 → 속보 → 구보: 속도에 따라 다리 위상·진폭
    v.phase += sp * dt * (sp > 9 ? 1.05 : 1.55) * (v.f < 0 ? -1 : 1);
    const gal = clamp((sp - 6) / 5, 0, 1), amp = clamp(sp / 4, 0, 1) * (0.45 + gal * 0.25);
    const offs = [0, Math.PI, Math.PI * 0.5 + gal * 0.3, Math.PI * 1.5 + gal * 0.3];
    P.legs.forEach((L, i) => {
      const ph = v.phase + (gal > 0.5 ? [0, 0.35, 2.4, 2.75][i] : offs[i]);
      const sw = Math.sin(ph) * amp;
      L.hip.rotation.x = sw * (L.front ? 1 : 0.9);
      L.knee.rotation.x = (L.front ? 1 : -0.6) * Math.max(0, -Math.cos(ph)) * amp * 1.3;
    });
    P.body.position.y = Math.abs(Math.sin(v.phase)) * 0.06 * amp;
    P.body.rotation.x = Math.sin(v.phase) * 0.04 * gal;
    P.neck.rotation.x = Math.sin(v.phase + 0.6) * 0.12 * amp - gal * 0.15;
    v.tailT = (v.tailT || 0) + dt;
    P.tail.rotation.x = -0.25 - gal * 0.5 + Math.sin(v.tailT * 1.7) * 0.06; P.tail.rotation.z = Math.sin(v.tailT * 1.1) * 0.15;
    // 발굽 소리
    if (sp > 0.8) { v.stepAcc += sp * dt; const stride = gal > 0.5 ? 0.9 : 0.75; if (v.stepAcc > stride) { v.stepAcc = 0; Audio.hoof && Audio.hoof(v.pos, v.driver === G.player, gal); } }
  }
  function effects(v, dt) {
    const T = v.T; v.fxT -= dt;
    if (v.fxT > 0) return;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), ex = v.pos.x + fx * (T.zc + T.hl * 0.75), ez = v.pos.z + fz * (T.zc + T.hl * 0.75), ey = v.pos.y + T.H * 0.7;
    if (G.player && Math.hypot(v.pos.x - G.player.pos.x, v.pos.z - G.player.pos.z) > 220) { v.fxT = 0.5; return; }
    if (v.burnT > 0) { FX.puff(ex + rnd(-0.4, 0.4), ey, ez + rnd(-0.4, 0.4), 0xff7a22, 0.9, 0.35, 1.5, 1.5); FX.puff(ex, ey + 0.4, ez, 0x1d1a18, 1.3, 1.6, 2.4, 2.2); v.fxT = 0.06; return; }
    if (v.dead && v.smokeT > 0) { v.smokeT -= 0.25; FX.puff(v.pos.x + rnd(-0.8, 0.8), v.pos.y + 1.2, v.pos.z + rnd(-0.8, 0.8), 0x2a2725, 1.8, 2.5, 2.5, 1.6); v.fxT = 0.25; return; }
    const r = v.hp / T.hp;
    if (!v.dead && !T.animal && r < 0.35) { FX.puff(ex, ey, ez, r < 0.15 ? 0x2a2622 : 0x9a9894, 0.7, 1.2, 2, 1.3); v.fxT = r < 0.15 ? 0.12 : 0.28; return; }
    // 흙먼지 (비포장 고속·드리프트)
    const sp = Math.hypot(v.vx, v.vz), sfc = surfaceAt(v.pos.x, v.pos.z);
    if (v.onGround && (sp > 9 && sfc !== 4 && sfc !== 5 || v.slip > 4)) { FX.puff(v.pos.x - fx * T.hl, v.pos.y + 0.3, v.pos.z - fz * T.hl, sfc === 3 ? 0xc8b58a : 0x9a8a68, 0.8, 0.9, 2.2, 0.5); v.fxT = 0.09; return; }
    v.fxT = 0.2;
  }
  function update(dt) {
    if (!scene) return;
    for (const v of list) {
      for (let i = 0; i < v.seats.length; i++) { const s0 = v.seats[i]; if (s0 && (!s0.alive || s0.veh !== v)) v.seats[i] = null; }
      v.driver = v.seats[0];
      if (G.net && Net.vehRemote(v)) { // 다른 기기가 움직이는 차량: 받은 상태 보간
        Net.vehInterp(v, dt);
        if (v.T.animal && (v.P.root.visible || v.driver)) animateHorse(v, dt);
        syncMesh(v);
        if (v.seats.some(Boolean)) syncRider(v);
        if (v.burnT > 0 || v.smokeT > 0 || v.awake || v.hp < v.T.hp * 0.35) effects(v, dt);
        continue;
      }
      if (v.burnT > 0) { v.burnT -= dt; if (v.burnT <= 0) explode(v); }
      if (v.T.animal && (v.P.root.visible || v.driver)) animateHorse(v, dt);
      if (v.awake && !(v.dead && !v.T.animal)) {
        if (v.dead) { v.ctrl.throttle = 0; v.ctrl.steer = 0; }
        if (v.T.animal && v.dead) { v.vx *= Math.exp(-4 * dt); v.vz *= Math.exp(-4 * dt); v.f = 0; }
        physics(v, dt);
        v.wheelRot += v.f * dt / v.P.wr;
        if (!v.driver && Math.hypot(v.vx, v.vz) < 0.05 && v.onGround && v.burnT <= 0) { v.sleepT += dt; if (v.sleepT > 1.5) { v.awake = false; v.vx = v.vz = 0; } } else v.sleepT = 0;
      }
      if (v.awake || (v.dead && v.T.animal && v.deadT < 1.5)) syncMesh(v);
      if (v.seats.some(Boolean)) syncRider(v);
      if (v.burnT > 0 || v.smokeT > 0 || v.awake || v.hp < v.T.hp * 0.35) effects(v, dt);
      // 엔진 소리(봇 청각)
      if (v.driver && !v.dead && Math.hypot(v.vx, v.vz) > 1.5) { v.noiseT -= dt; if (v.noiseT <= 0) { v.noiseT = 0.6; G.noises.push({ x: v.pos.x, y: v.pos.y, z: v.pos.z, t: G.time, r: v.T.noise, by: v.driver, kind: 'engine' }); } }
    }
    for (const v of list) if (v.awake && !v.dead && !(G.net && Net.vehRemote(v))) { vehVeh(v); runOver(v); }
    engineAudio();
    // 거리 컬링·그림자
    cullT -= dt;
    if (cullT <= 0 && G.camera) {
      cullT = 0.3; const cam = G.camera.position, far = QUALITY[SETTINGS.quality].far + 40;
      for (const v of list) { const d = Math.hypot(v.pos.x - cam.x, v.pos.z - cam.z); v.P.root.visible = d < far; if (d < far) VehModels.setShadows(v.P, d < 55); }
    }
  }
  // 엔진음: 플레이어 차량 + 가까운 봇 차량 3대
  const _eng = [];
  function engineAudio() {
    if (!Audio.engine) return;
    _eng.length = 0;
    const L = G.camera ? G.camera.position : null; if (!L) return;
    for (const v of list) if (v.driver && !v.dead && !v.T.animal) { const d = Math.hypot(v.pos.x - L.x, v.pos.z - L.z); if (d < 180 || v.driver.isPlayer) _eng.push([v.driver.isPlayer ? -1 : d, v]); }
    _eng.sort((a, b) => a[0] - b[0]);
    const keep = new Set();
    for (let i = 0; i < Math.min(4, _eng.length); i++) {
      const v = _eng[i][1], T = v.T, ratio = clamp(Math.abs(v.f) / T.vmax, 0, 1.1);
      const gears = v.type === 'moto' ? 5 : 4, gf = ratio * gears, g = Math.min(gears - 1, Math.floor(gf));
      const rpm = Math.abs(v.f) < 0.5 ? 0.12 : clamp(0.3 + (gf - g) * 0.62 + g * 0.03, 0.2, 1);
      Audio.engine(v.id, v.pos, v.type, rpm, Math.abs(v.ctrl.throttle), v.driver.isPlayer, clamp((v.slip - 2.5) / 6, 0, 1) * (v.onGround ? 1 : 0));
      keep.add(v.id);
    }
    Audio.engineSweep(keep);
  }
  // 봇용: 가까운 탈 수 있는 차량
  function nearestFree(x, z, r, pred) {
    let best = null, bd = r;
    for (const v of near(x, z, r)) { if (v.dead || v.seats.some(Boolean) || v.burnT > 0 || v.hp < v.T.hp * 0.3) continue; if (pred && !pred(v)) continue; const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  return { init, dispose, spawnAll, make, remove, update, ray, damage, blast, netBoom, pushChar, nearestEnterable, enter, exit, switchSeat, riders, freeSeats, animateRider, syncRider, nearestFree, near,
    get list() { return list; }, get active() { return list.length > 0; } };
})();
