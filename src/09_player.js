// ============================================================
// 09_player.js — 입력(키보드·마우스·터치), 카메라(3인칭/1인칭, 충돌), 플레이어 조작
// ============================================================
const Input = {
  keys: {}, fire: false, aim: false, aimToggle: false, lookX: 0, lookY: 0, locked: false, lockFailed: false,
  move: { x: 0, z: 0 }, touchSprint: false, edge: new Set(), mouseBtns: 0,
  press(a) { this.edge.add(a); if (a === 'ping') this.pingQ.push(performance.now() / 1000); }, // 핑은 누른 시각을 쌓아 둔다(두 번 누르기 판정)
  pingQ: [],
  consume(a) { if (this.edge.has(a)) { this.edge.delete(a); return true; } return false; },
  reset() { this.pingQ.length = 0; this.pingDown = false; this.keys = {}; this.fire = false; this.aim = false; this.move.x = this.move.z = 0; this.edge.clear(); this.lookX = this.lookY = 0; this.touchSprint = false; },
};
const KEYMAP = { Space: 'jump', KeyC: 'crouch', KeyZ: 'prone', Tab: 'inventory', KeyI: 'inventory', KeyM: 'map', KeyF: 'interact', Escape: 'pause', KeyR: 'reload', Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', KeyX: 'holster', KeyG: 'throw', KeyT: 'throwSwap', KeyH: 'heal', KeyJ: 'drink', KeyV: 'view', KeyP: 'pause', KeyB: 'fireMode', KeyQ: 'ping' };

function setupInput(canvas) {
  const inGame = () => G.state === 'play' && !G.paused && !HUD.modalOpen();
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    Input.keys[e.code] = true;
    const a = KEYMAP[e.code];
    if (e.code === 'Tab') e.preventDefault();
    if (a === 'pause' && G.paused && !$('pausePanel').hidden && $('settingsPanel').hidden) { G.pause(false); return; }
    if (e.code === 'Escape' && !$('acctPanel').hidden) { Cloud.close(); return; }
    if (e.code === 'Escape' && !$('helpPanel').hidden) { $('helpPanel').hidden = true; return; }
    if (e.code === 'Escape' && !$('settingsPanel').hidden) { G.ui('closeSettings'); return; }
    if (e.code === 'Escape' && !$('matchCfgPanel').hidden) { G.ui('closeMatchCfg'); return; }
    if (e.code === 'Escape' && !$('mapPickPanel').hidden) { G.ui('closeMapPick'); return; }
    if (e.code === 'Escape' && !$('rankPanel').hidden) { G.ui('closeRanks'); return; }
    if (a && !e.repeat) Input.press(a);
    if (e.code === 'Space' && G.state === 'play') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => Input.reset());
  // 마우스
  window.addEventListener('mousedown', (e) => {
    if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (e.target !== canvas && e.target.id !== 'touchLayer') return;
    Audio.init();
    if (G.state !== 'play' || G.paused || HUD.modalOpen()) return;
    // 마우스 고정을 얻는 첫 클릭은 사격하지 않음
    if (!Input.locked && !Input.lockFailed) { requestLock(canvas); return; }
    Input.mouseBtns = e.buttons;
    if (e.button === 0) Input.fire = true;
    if (e.button === 2) Input.aim = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return; Input.mouseBtns = e.buttons; if (e.button === 0) Input.fire = false; if (e.button === 2) Input.aim = false; });
  window.addEventListener('contextmenu', (e) => { if (e.target === canvas || e.target.id === 'touchLayer') e.preventDefault(); });
  window.addEventListener('mousemove', (e) => {
    if (!inGame()) return;
    // 포인터 락이 안 되는 환경: 버튼을 누른 채 드래그로 시점 회전
    if (Input.locked || (Input.mouseBtns & 3)) { Input.lookX += e.movementX || 0; Input.lookY += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', () => {
    const was = Input.locked; Input.locked = document.pointerLockElement === canvas;
    if (was && !Input.locked && G.state === 'play' && !G.paused && !HUD.modalOpen() && !G.suppressPause) G.pause(true);
    G.suppressPause = false;
  });
  document.addEventListener('pointerlockerror', () => { Input.lockFailed = true; HUD.toast('마우스 고정이 지원되지 않아 클릭한 채 드래그로 시점을 돌립니다', 'info'); });
}
function requestLock(canvas) {
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { Input.lockFailed = true; }); } catch (e) { Input.lockFailed = true; }
}
function releaseLock() { if (document.pointerLockElement) { G.suppressPause = true; document.exitPointerLock(); } }

// ---------- 카메라 ----------
// ads: 0(허리 사격)~1(정조준). 정조준은 항상 눈 위치에서 조준경/가늠자를 통해 본다(3인칭이어도)
const Cam = { dist: 3.3, ads: 0, zoom: 1, si: null, recoilP: 0, kick: 0, kickRot: 0, swayT: 0, swayX: 0, swayY: 0, breath: 1, wasAds: false };
const VM = { scene: null, cam: null, root: null, pivot: null, tilt: null, gun: null, key: null, handL: null, handR: null, armL: null, armR: null, shellL: null, roundR: null, dir: null, hemi: null, flashLight: null, active: false, sleeveHex: null };
const _cv = new THREE.Vector3(), _cf = new THREE.Vector3(), _cp = new THREE.Vector3(), _tp = new THREE.Vector3(), _hw = new THREE.Vector3(), _ew = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function buildViewModel() {
  VM.scene = new THREE.Scene();
  VM.cam = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.01, 30);
  VM.hemi = new THREE.HemisphereLight(0xdfe8f0, 0x3a3428, 0.55); VM.scene.add(VM.hemi);
  VM.dir = new THREE.DirectionalLight(0xfff2da, 0.85); VM.scene.add(VM.dir); VM.scene.add(VM.dir.target);
  VM.flashLight = new THREE.PointLight(0xffb060, 0, 1.5, 2); VM.scene.add(VM.flashLight);
  VM.root = new THREE.Group(); VM.scene.add(VM.root);
  VM.pivot = new THREE.Group(); VM.pivot.rotation.y = Math.PI; VM.root.add(VM.pivot);
  VM.tilt = new THREE.Group(); VM.pivot.add(VM.tilt);
  VM.handL = Models.hand(); VM.handR = Models.hand(); VM.tilt.add(VM.handL); VM.tilt.add(VM.handR);
  VM.shellL = Models.casing('hull'); VM.roundR = Models.casing('762'); VM.tilt.add(VM.shellL); VM.tilt.add(VM.roundR);
  // 회복·투척용 손 (카메라 공간)
  VM.hold = new THREE.Group(); VM.hold.rotation.y = Math.PI; VM.root.add(VM.hold);
  VM.hhL = Models.hand(); VM.hhR = Models.hand(); VM.hold.add(VM.hhL); VM.hold.add(VM.hhR);
  VM.hItemL = new THREE.Group(); VM.hItemR = new THREE.Group(); VM.hhL.add(VM.hItemL); VM.hhR.add(VM.hItemR);
  VM.hold.visible = false;
  VM.root.visible = false;
}
// 소매: 화면 밖 팔꿈치(ex,ey,ez)에서 손목까지
function vmSleeve(arm, hand, ex, ey, ez) {
  hand.getWorldPosition(_hw); _ew.set(ex, ey, ez);
  const L = _hw.distanceTo(_ew); _cv.subVectors(_hw, _ew).normalize();
  arm.position.lerpVectors(_ew, _hw, 0.5 - 0.035 / Math.max(0.1, L)); arm.quaternion.setFromUnitVectors(_up, _cv); arm.scale.set(1, Math.max(0.05, L - 0.06), 1);
}
// 1인칭 회복·투척: 손 위치(x 오른쪽, y 위, d 앞쪽 거리)와 아이템
function vmHeldItem(grp, id) {
  if (grp.userData.id === id) return; grp.userData.id = id;
  while (grp.children.length) grp.remove(grp.children[0]);
  if (!id) return;
  const o = heldModel(id); o.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const P = { bandage: [0, 0.02, 0.03, 0, 0, 0], firstaid: [0.03, 0.03, 0.05, 1.3, 0.2, 0], medkit: [0.05, 0.03, 0.07, 1.3, 0.2, 0], drink: [0, 0.01, 0.03, 0.15, 0, 0], frag: [0, 0.01, 0.035, 0, 0, 0], smoke: [0, 0.01, 0.035, 0, 0, 0] }[id] || [0, 0, 0, 0, 0, 0];
  o.position.set(P[0], P[1], P[2]); o.rotation.set(P[3], P[4], P[5]); grp.add(o);
}
function updateHoldVM(dt, p) {
  setSleeves(OUTFITS[SETTINGS.outfit].shirt);
  const T = G.time, k = clamp(dt * 14, 0, 1), tm = p.throwMode;
  let L = [-0.13, -0.2, 0.4], R = [0.15, -0.17, 0.4], itL = null, itR = null;
  if (p.heal) {
    const id = p.heal.id, u = 1 - p.heal.t / p.heal.total;
    if (id === 'bandage') { itR = 'bandage'; L = [-0.06, -0.18, 0.48]; R = [0.05 + Math.cos(T * 8) * 0.05, -0.14 + Math.sin(T * 8) * 0.035, 0.46]; }
    else if (id === 'drink') { itR = 'drink'; const up = sstep(0, 0.2, u) * (1 - sstep(0.88, 1, u)); R = [lerp(0.15, 0.03, up), lerp(-0.17, -0.06, up), lerp(0.4, 0.2, up)]; L = [-0.17, -0.3, 0.38]; }
    else { itL = id; L = [-0.05, -0.17, 0.44]; R = [0.08 + Math.sin(T * 6) * 0.03, -0.1 + Math.cos(T * 7) * 0.02, 0.41]; }
  } else {
    const nade = tm ? tm.type : (p.inv.throwSel || 'frag');
    const thr = p.throwAnim > 0 ? 1 - p.throwAnim / 0.35 : 0;
    itR = thr > 0.35 ? null : nade;
    if (tm && tm.pin) { R = [0.2, -0.02, 0.24]; L = [-0.1, -0.08, 0.48]; }
    else if (thr > 0) { R = [lerp(0.2, 0.08, thr), lerp(-0.02, -0.22, thr), lerp(0.24, 0.75, thr)]; L = [-0.12, -0.17, 0.45]; }
    else { R = [0.13, -0.12, 0.38]; L = [-0.03, -0.14, 0.4]; }
  }
  const mv = (h, P) => { h.position.x = lerp(h.position.x, -P[0], k); h.position.y = lerp(h.position.y, P[1], k); h.position.z = lerp(h.position.z, P[2], k); };
  mv(VM.hhL, L); mv(VM.hhR, R); VM.hhL.rotation.set(0.2, 0, 0.6); VM.hhR.rotation.set(0.3, 0, -0.5);
  vmHeldItem(VM.hItemL, itL); vmHeldItem(VM.hItemR, itR);
  VM.root.updateMatrixWorld(true);
  vmSleeve(VM.armL, VM.hhL, -0.24, -0.42, -0.02); vmSleeve(VM.armR, VM.hhR, 0.26, -0.4, 0.02);
  if (G.sunDir) { _q.copy(G.camera.quaternion).invert(); VM.dir.position.copy(G.sunDir).applyQuaternion(_q).multiplyScalar(5); }
}
function setSleeves(hex) {
  if (VM.sleeveHex === hex) return;
  if (VM.armL) { VM.root.remove(VM.armL); VM.root.remove(VM.armR); }
  VM.armL = Models.sleeve(hex); VM.armR = Models.sleeve(hex); VM.root.add(VM.armL); VM.root.add(VM.armR); VM.sleeveHex = hex;
}
function sightInfo(p) {
  const w = p.weapon; if (!w) return { key: 'iron', zoom: 1.05, mag: false, aimT: 0.18, reticle: null };
  const am = ITEMS[w.id].adsMul || 1;
  if (w.att.scope) { const s = ITEMS[w.att.scope]; return { key: w.att.scope, zoom: s.zoom, mag: s.zoom >= 2, aimT: s.aimT * am, reticle: w.att.scope }; }
  return { key: 'iron', zoom: ITEMS[w.id].zoom, mag: false, aimT: 0.16 * am, reticle: null };
}
// 차량 추적 카메라: 마우스/드래그로 자유롭게 돌려 보고, 손을 떼면 진행 방향 뒤로 돌아온다
function vehicleCamera(dt, p, v) {
  const cam = G.camera, T = v.T, sp = Math.hypot(v.vx, v.vz);
  Cam.ads = 0; Cam.zoom = 1;
  cam.fov = 72 + clamp(sp / T.vmax, 0, 1) * 9; cam.updateProjectionMatrix();
  const yaw = p.yaw, pitch = p.pitch;
  _cf.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  _cv.set(v.pos.x, v.pos.y + T.camUp, v.pos.z);
  const bx = -_cf.x, by = -_cf.y, bz = -_cf.z, dist = T.camDist;
  let d = dist;
  const hb = rayBoxes(_cv.x, _cv.y, _cv.z, bx, by, bz, dist + 0.3, true);
  if (hb.t < d + 0.25) d = Math.max(0.6, hb.t - 0.3);
  const ht = rayTerrain(_cv.x, _cv.y, _cv.z, bx, by, bz, d + 0.4);
  if (ht < d + 0.35) d = Math.max(0.6, ht - 0.4);
  Cam.dist = d < Cam.dist ? d : lerp(Cam.dist, d, clamp(dt * 4, 0, 1));
  cam.position.set(_cv.x + bx * Cam.dist, _cv.y + by * Cam.dist, _cv.z + bz * Cam.dist);
  const gy = heightAt(cam.position.x, cam.position.z) + 0.4; if (cam.position.y < gy) cam.position.y = gy;
  cam.rotation.order = 'YXZ'; cam.rotation.set(pitch - 0.08, yaw + Math.PI, 0);
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 2.5); cam.position.x += rnd(-1, 1) * G.shake * 0.15; cam.position.y += rnd(-1, 1) * G.shake * 0.15; }
  cam.updateMatrixWorld();
  p.root.visible = true; VM.active = false; VM.root.visible = false;
}
function updateCamera(dt) {
  const cam = G.camera, p = G.player;
  if (!p) return;
  // 운전석은 추적 카메라, 동승석은 조준할 때만 일반(어깨·조준경) 카메라
  if (p.veh && !(p.seat > 0 && (p.aiming || Cam.ads > 0.05))) { Cam.ads = Math.max(0, Cam.ads - dt * 6); vehicleCamera(dt, p, p.veh); return; }
  const si = Cam.si = sightInfo(p);
  Cam.ads = clamp(Cam.ads + (p.aiming ? 1 : -1.4) * dt / si.aimT, 0, 1);
  const adsE = smoothstep01(Cam.ads);
  if (adsE > 0.05 && !Cam.wasAds) { Audio.mech('aimIn', null, p.weapon ? p.weapon.id : 'm416', true); Cam.wasAds = true; }
  if (adsE < 0.02) Cam.wasAds = false;
  Cam.zoom = lerp(1, si.zoom, adsE);
  const fppBase = G.firstPerson && p.mode === 'ground' && p.alive;
  cam.fov = (fppBase ? 78 : lerp(72, 78, adsE)) / Cam.zoom; cam.updateProjectionMatrix();
  // 배율 조준경 흔들림 (호흡). PC는 Shift로 잠시 숨참기
  const swayBase = adsE > 0.5 ? ({ x3: 0.0011, x4: 0.0017, x6: 0.0027 }[si.key] || 0) : 0;
  const hold = (Input.keys.ShiftLeft || Input.keys.ShiftRight) && swayBase > 0 && Cam.breath > 0;
  Cam.breath = clamp(Cam.breath + (hold ? -dt / 4.5 : dt / 7), 0, 1);
  const amp = swayBase * (p.stance === 'prone' ? 0.35 : p.stance === 'crouch' ? 0.6 : 1) * (p.anim.speed > 0.8 ? 2 : 1) * (hold ? 0.15 : 1) * (IS_TOUCH ? 0.6 : 1);
  Cam.swayT += dt;
  Cam.swayX = lerp(Cam.swayX, amp * (Math.sin(Cam.swayT * 0.9) + Math.sin(Cam.swayT * 2.3 + 1) * 0.35), clamp(dt * 4, 0, 1));
  Cam.swayY = lerp(Cam.swayY, amp * (Math.sin(Cam.swayT * 1.3 + 2) * 0.8 + Math.sin(Cam.swayT * 3.1) * 0.25), clamp(dt * 4, 0, 1));
  const yaw = p.yaw + Cam.swayX, pitch = p.pitch + Cam.recoilP + Cam.swayY;
  _cf.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  p.eye(_cp);
  if (fppBase) cam.position.copy(_cp);
  else {
    const aimK = 0;
    let up = p.mode === 'ground' ? 1.58 - p.anim.crouch * 0.45 - p.anim.prone * 1.0 : 1.2;
    const dist = p.mode === 'ground' ? 3.3 * (p.stance === 'prone' ? 1.1 : 1) : 7;
    const side = p.mode === 'ground' ? 0.62 : 0;
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    _cv.set(p.pos.x + rx * side, p.pos.y + up, p.pos.z + rz * side);
    if (p.anim.prone > 0.5) { _cv.x += Math.sin(p.bodyYaw) * 0.9; _cv.z += Math.cos(p.bodyYaw) * 0.9; }
    // 카메라 충돌: 벽/지형 안쪽으로 들어가지 않도록
    const bx = -_cf.x, by = -_cf.y, bz = -_cf.z;
    let d = dist;
    const hb = rayBoxes(_cv.x, _cv.y, _cv.z, bx, by, bz, dist + 0.3, true);
    if (hb.t < d + 0.25) d = Math.max(0.25, hb.t - 0.25);
    const ht = rayTerrain(_cv.x, _cv.y, _cv.z, bx, by, bz, d + 0.4);
    if (ht < d + 0.35) d = Math.max(0.25, ht - 0.35);
    Cam.dist = d < Cam.dist ? d : lerp(Cam.dist, d, clamp(dt * 5, 0, 1));
    _tp.set(_cv.x + bx * Cam.dist, _cv.y + by * Cam.dist, _cv.z + bz * Cam.dist);
    const gy = heightAt(_tp.x, _tp.z) + 0.25; if (_tp.y < gy) _tp.y = gy;
    cam.position.lerpVectors(_tp, _cp, adsE);
  }
  p.root.visible = !(fppBase || adsE > 0.5) && !(Cam.dist < 0.6 && adsE < 0.2);
  cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw + Math.PI, 0);
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 2.5); cam.position.x += rnd(-1, 1) * G.shake * 0.15; cam.position.y += rnd(-1, 1) * G.shake * 0.15; }
  cam.updateMatrixWorld();
  Cam.recoilP = lerp(Cam.recoilP, 0, clamp(dt * 9, 0, 1));
  // 뷰모델: 1인칭이거나 정조준 중일 때. 배율 조준경을 끝까지 당기면 스코프 화면으로 대체
  const holding = p.alive && !p.knocked && p.mode === 'ground' && !p.veh && (p.heal || p.throwMode || p.throwAnim > 0);
  VM.active = holding ? fppBase : !!p.weapon && p.alive && !p.knocked && p.mode === 'ground' && (fppBase || adsE > 0.35) && !(si.mag && adsE > 0.9);
  VM.root.visible = VM.active;
  if (VM.pivot) VM.pivot.visible = !holding;
  if (VM.hold) VM.hold.visible = !!(holding && VM.active);
  if (VM.active) { if (holding) updateHoldVM(dt, p); else updateViewModel(dt, p, adsE); }
}
function updateViewModel(dt, p, adsE) {
  const w = p.weapon;
  const key = w.id + '|' + [w.att.scope, w.att.muzzle, w.att.mag, w.att.grip].join(',');
  if (VM.key !== key) {
    if (VM.gun) VM.tilt.remove(VM.gun);
    VM.gun = buildGunMesh(w.id, w.att); VM.gun.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    VM.tilt.add(VM.gun); VM.key = key;
  }
  setSleeves(OUTFITS[SETTINGS.outfit].shirt);
  const m = VM.gun.userData.meta, A = weaponAnim(p, m);
  applyParts(VM.gun, A);
  // 허리 위치 ↔ 조준 위치 (조준선이 화면 중앙을 지나도록)
  const hx = m.hip[0], hy = m.hip[1], hz = m.hip[2];
  const ax = 0, ay = -m.sightY, az = m.sightRearZ - m.relief;
  const bobAmp = clamp(p.anim.speed / 5, 0, 1) * (1 - adsE * 0.85);
  const bobX = Math.sin(p.anim.phase) * 0.008 * bobAmp, bobY = -Math.abs(Math.cos(p.anim.phase)) * 0.01 * bobAmp;
  const eq = clamp(p.equipT / 0.6, 0, 1), sprintK = p.sprint ? 1 : 0;
  Cam.kick = lerp(Cam.kick, 0, clamp(dt * 16, 0, 1)); Cam.kickRot = lerp(Cam.kickRot, 0, clamp(dt * 12, 0, 1));
  const tx = lerp(hx, ax, adsE) + bobX + sprintK * 0.03, ty = lerp(hy, ay, adsE) + bobY - eq * 0.25 - sprintK * 0.03, tz = lerp(hz, az, adsE) + Cam.kick * (1 - adsE * 0.5);
  const k = clamp(dt * 22, 0, 1);
  VM.pivot.position.x = lerp(VM.pivot.position.x, tx, k); VM.pivot.position.y = lerp(VM.pivot.position.y, ty, k); VM.pivot.position.z = lerp(VM.pivot.position.z, tz, k);
  VM.pivot.rotation.set(0, Math.PI + sprintK * 0.5, sprintK * -0.25);
  VM.tilt.rotation.set(-(A.tiltX + Cam.kickRot * (1 - adsE * 0.6)) - eq * 0.6, 0, A.tiltZ);
  // 손: 총 좌표계에서 애니메이션된 위치
  VM.handL.position.copy(A.left); VM.handL.rotation.set(0, 0, 0.55);
  VM.handR.position.copy(A.right); VM.handR.rotation.set(0.35, 0, -0.2);
  VM.shellL.visible = A.shellL; if (A.shellL) { VM.shellL.position.copy(A.left).add(_hw.set(-0.01, 0.025, 0.02)); VM.shellL.rotation.set(0, 0, 0); }
  VM.roundR.visible = A.shellR; if (A.shellR) { VM.roundR.position.copy(A.right).add(_hw.set(0.01, 0.025, 0.03)); }
  // 소매: 화면 밖 팔꿈치에서 손목까지
  VM.root.updateMatrixWorld(true);
  vmSleeve(VM.armL, VM.handL, -0.24, -0.42, -0.02); vmSleeve(VM.armR, VM.handR, 0.26, -0.4, 0.02);
  // 조명: 태양 방향을 카메라 공간으로
  if (G.sunDir) { _q.copy(G.camera.quaternion).invert(); VM.dir.position.copy(G.sunDir).applyQuaternion(_q).multiplyScalar(5); }
}
function renderViewModel() {
  if (!VM.active || !VM.scene) return;
  const r = G.renderer;
  VM.cam.aspect = G.camera.aspect; VM.cam.updateProjectionMatrix();
  r.autoClear = false; r.clearDepth(); r.render(VM.scene, VM.cam); r.autoClear = true;
}

// ---------- 플레이어 조작 ----------
const _aimO = new THREE.Vector3(), _aimD = new THREE.Vector3(), _near = [];
// 기절: 시점 돌리기 + 기어가기만 (사격·회복·줍기·탑승 불가). 부활받는 동안은 멈춘다
const KNOCK_IGNORE = ['crouch', 'prone', 'reload', 'w1', 'w2', 'w3', 'weaponCycle', 'holster', 'throw', 'throwSwap', 'fireMode', 'jump', 'view', 'interact', 'heal', 'drink'];
function updateKnockedPlayer(dt, p) {
  const sens = 0.0023 * SETTINGS.lookSens;
  p.yaw -= Input.lookX * sens; p.pitch = clamp(p.pitch - Input.lookY * sens, -0.9, 0.9); Input.lookX = Input.lookY = 0;
  for (const k of KNOCK_IGNORE) Input.consume(k);
  if (Input.consume('ping')) pingInputs(p); // 기절해도 핑은 가능
  let mx = 0, mz = 0;
  if (Input.keys.KeyW || Input.keys.ArrowUp) mz += 1;
  if (Input.keys.KeyS || Input.keys.ArrowDown) mz -= 1;
  if (Input.keys.KeyD || Input.keys.ArrowRight) mx += 1;
  if (Input.keys.KeyA || Input.keys.ArrowLeft) mx -= 1;
  mx += Input.move.x; mz += Input.move.z;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
  let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx; const an = Math.hypot(wx, wz); if (an > 0.01) { wx /= an; wz /= an; }
  const held = p.revivedBy && p.revivedBy.revive;
  p.stance = 'prone'; p.aiming = false; p.sprint = false; p.fireHold = false; p.moving = an > 0.05 && !held;
  stepPhysics(p, dt, wx, wz, held ? 0 : CRAWL_SPEED * clamp(an, 0, 1) * (p.inWater ? 1.6 : 1), false);
}
function updatePlayer(dt) {
  const p = G.player;
  if (!p || !p.alive || p.mode !== 'ground') return;
  if (p.knocked) { p.throwMode = null; updateKnockedPlayer(dt, p); return; }
  const s = SETTINGS;
  // 시점
  // 스코프별 감도: 100%면 배율과 상관없이 화면에서 같은 속도로 움직인다
  const adsE = smoothstep01(Cam.ads), sensK = adsE > 0.5 && Cam.si ? (SETTINGS['sens_' + Cam.si.key] || 1) / Math.max(1, Cam.zoom) : 1;
  const sensBase = 0.0023 * s.lookSens * sensK;
  p.yaw -= Input.lookX * sensBase; p.pitch -= Input.lookY * sensBase;
  p.pitch = clamp(p.pitch, -1.35, 1.35);
  Input.lookX = Input.lookY = 0;
  // 단발 입력
  if (Input.consume('crouch')) p.stance = p.stance === 'crouch' ? 'stand' : 'crouch';
  if (Input.consume('prone')) { if (p.stance === 'prone') p.stance = 'crouch'; else if (!p.inWater) p.stance = 'prone'; }
  if (Input.consume('reload')) { if (p.throwMode) exitThrow(p, true); startReload(p); }
  for (const [k, i] of [['w1', 0], ['w2', 1], ['w3', 2]]) if (Input.consume(k)) { if (p.throwMode) exitThrow(p, true); switchWeapon(p, i); }
  if (Input.consume('weaponCycle')) { if (p.throwMode) exitThrow(p, true); else { const order = [0, 1, 2].filter(i => p.inv.weapons[i]); if (order.length) switchWeapon(p, order[(order.indexOf(p.inv.cur) + 1) % order.length]); } }
  if (Input.consume('holster')) { if (p.throwMode) exitThrow(p, true); p.inv.cur = -1; p.reloadT = 0; p.cycle = null; p.setVisibleGear(); }
  if (Input.consume('heal')) usePlayerHeal(p);
  if (Input.consume('drink')) useConsumable(p, 'drink');
  if (Input.consume('throwSwap')) {
    const nx = p.inv.throwSel === 'frag' ? 'smoke' : 'frag';
    if (p.throwMode && !p.throwMode.pin) { if (p.inv.count(nx)) { p.throwMode.type = nx; p.inv.throwSel = nx; HUD.toast(ITEMS[nx].name + ' 선택'); } else HUD.toast(ITEMS[nx].name + ' 없음'); }
    else if (!p.throwMode) { p.inv.throwSel = nx; HUD.toast(ITEMS[p.inv.throwSel].name + ' 선택'); }
  }
  if (Input.consume('throw')) { if (p.throwMode) exitThrow(p); else enterThrow(p); }
  if (Input.consume('fireMode') && p.weapon) {
    if (cycleFireMode(p.weapon)) { p.burstQ = 0; Audio.mech('selector', null, p.weapon.id, true); HUD.toast('사격 모드: ' + MODE_NAMES[fireMode(p.weapon)]); }
    else HUD.toast(ITEMS[p.weapon.id].name + '은(는) ' + MODE_NAMES[fireMode(p.weapon)] + '만 가능합니다');
  }
  if (Input.consume('view')) { G.firstPerson = !G.firstPerson; SETTINGS.view = G.firstPerson ? 'fpp' : 'tpp'; saveSettings(); }
  if (Input.consume('ping')) pingInputs(p);
  // 이동 입력
  let mx = 0, mz = 0;
  if (Input.keys.KeyW || Input.keys.ArrowUp) mz += 1;
  if (Input.keys.KeyS || Input.keys.ArrowDown) mz -= 1;
  if (Input.keys.KeyD || Input.keys.ArrowRight) mx += 1;
  if (Input.keys.KeyA || Input.keys.ArrowLeft) mx -= 1;
  mx += Input.move.x; mz += Input.move.z;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
  let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
  const analog = Math.hypot(wx, wz);
  if (analog > 0.01) { wx /= analog; wz /= analog; }
  const wantAim = (Input.aim || Input.aimToggle) && p.weapon && p.reloadT <= 0 && p.equipT <= 0 && !p.inWater;
  const sprintKey = Input.keys.ShiftLeft || Input.keys.ShiftRight || Input.touchSprint || Input.touchSprintBtn;
  // 사격 중에는 달리기를 끊는다 → 조이스틱을 끝까지 민 상태에서도 이동하며 쏠 수 있음
  const firing = Input.fire && !!p.weapon && !p.throwMode;
  p.sprint = !!sprintKey && mz > 0.3 && !wantAim && !p.heal && !p.inWater && !firing && !p.vault;
  if (p.sprint && p.stance !== 'stand') p.stance = 'stand';
  p.aiming = !!wantAim && !p.sprint && !p.throwMode;
  let speed = 4.6;
  if (p.sprint) speed = 6.3 + (p.boost > 60 ? 0.4 : 0);
  if (p.aiming) speed = 2.6;
  if (p.stance === 'crouch') speed = Math.min(speed, 2.7); else if (p.stance === 'prone') speed = 1.1;
  if (p.heal) speed = Math.min(speed, 1.9);
  if (p.inWater) speed = 2.3;
  // 부활 중: 움직이거나 쏘면 취소
  if (p.revive) { if (analog > 0.05 || Input.fire || p.sprint) cancelRevive(p); else speed = 0; }
  if (p.weapon && ITEMS[p.weapon.id].moveMul) speed *= ITEMS[p.weapon.id].moveMul;
  if (mz < -0.2) speed *= 0.8;
  speed *= clamp(analog, 0, 1);
  // 점프 버튼: 앞에 넘을 수 있는 창문·담·턱이 있으면 넘기/오르기, 없으면 점프
  let jump = Input.consume('jump');
  p.vaultHint = null;
  if (!p.vault && p.onGround && !p.inWater && p.stance !== 'prone' && !p.revive) {
    p.vaultT = (p.vaultT || 0) - dt;
    if (jump || p.vaultT <= 0) {
      p.vaultT = 0.12;
      const dl = analog > 0.3 ? 1 : 0, vx = dl ? wx : Math.sin(p.yaw), vz = dl ? wz : Math.cos(p.yaw);
      p.vaultPlanC = vaultPlan(p, vx, vz);
    }
    p.vaultHint = p.vaultPlanC ? p.vaultPlanC.kind : null;
    if (jump && p.vaultPlanC) { const pl = vaultPlan(p, p.vaultPlanC.dx, p.vaultPlanC.dz); if (pl) { if (p.throwMode && !p.throwMode.pin) exitThrow(p, true); startVault(p, pl); jump = false; p.vaultPlanC = null; } }
  } else p.vaultPlanC = null;
  p.moving = analog > 0.05;
  stepPhysics(p, dt, wx, wz, p.vault ? 0 : speed, jump);
  if (p.throwMode) updateThrow(p, dt);
  else if (!p.vault) {
    playerFire(p);
    if (Input.fire && !p.weapon && !p.firedThisPress && p.fireCd <= 0) { p.eye(_aimO); G.camera.getWorldDirection(_aimD); melee(p, _aimO, _aimD); p.firedThisPress = true; }
  }
  // 상호작용 (주변 아이템)
  updateNearbyLoot(p);
  if (Input.consume('interact')) {
    const km = !p.revive && nearestKnockedMate(p, 1.9), v = !km && Veh.nearestEnterable(p);
    if (p.revive) cancelRevive(p);
    else if (km) startRevive(p, km);
    else if (v) { if (Veh.enter(p, v)) HUD.setLoot([]); }
    else { const it = HUD.focusItem(); if (it) doPickup(p, it); }
  }
}
// ---------- 운전 ----------
const DRIVE_IGNORE = ['prone', 'reload', 'w1', 'w2', 'w3', 'weaponCycle', 'holster', 'throw', 'throwSwap', 'fireMode', 'jump', 'view'];
// 동승석: 자유 시점 + 조준·사격·장전·무기 교체 (이동은 운전자가)
function updatePassenger(dt, p, v) {
  const adsE = smoothstep01(Cam.ads), sensK = adsE > 0.5 && Cam.si ? (SETTINGS['sens_' + Cam.si.key] || 1) / Math.max(1, Cam.zoom) : 1, sens = 0.0023 * SETTINGS.lookSens * sensK;
  p.yaw -= Input.lookX * sens; p.pitch = clamp(p.pitch - Input.lookY * sens, -1.1, 1.0); Input.lookX = Input.lookY = 0;
  for (const k of ['prone', 'holster', 'throw', 'throwSwap', 'jump', 'view']) Input.consume(k);
  if (Input.consume('reload')) startReload(p);
  for (const [k, i] of [['w1', 0], ['w2', 1], ['w3', 2]]) if (Input.consume(k)) switchWeapon(p, i);
  if (Input.consume('weaponCycle')) { const order = [0, 1, 2].filter(i => p.inv.weapons[i]); if (order.length) switchWeapon(p, order[(order.indexOf(p.inv.cur) + 1) % order.length]); }
  if (Input.consume('fireMode') && p.weapon && cycleFireMode(p.weapon)) { p.burstQ = 0; Audio.mech('selector', null, p.weapon.id, true); HUD.toast('사격 모드: ' + MODE_NAMES[fireMode(p.weapon)]); }
  if (Input.consume('crouch') || Input.consume('seat')) Veh.switchSeat(p);
  if (Input.consume('heal')) usePlayerHeal(p);
  if (Input.consume('drink')) useConsumable(p, 'drink');
  p.aiming = !!((Input.aim || Input.aimToggle) && p.weapon && p.reloadT <= 0 && p.equipT <= 0);
  p.sprint = false; p.moving = false;
  playerFire(p);
  if (Input.consume('interact')) Veh.exit(p);
  if (Input.consume('ping')) pingInputs(p);
}
function updateDriving(dt) {
  const p = G.player, v = p.veh; if (!v) return;
  if (p.seat > 0) { updatePassenger(dt, p, v); return; }
  const lx = Input.lookX, ly = Input.lookY, sens = 0.0023 * SETTINGS.lookSens;
  p.yaw -= lx * sens; p.pitch = clamp(p.pitch - ly * sens, -0.9, 0.55); Input.lookX = Input.lookY = 0;
  if (Math.abs(lx) + Math.abs(ly) > 0.5) Cam.vLookT = G.time;
  const sp = Math.hypot(v.vx, v.vz);
  // 시점을 놓고 1.3초가 지나면 진행 방향 뒤로 천천히 돌아온다
  if (G.time - (Cam.vLookT || -9) > 1.3 && sp > 2) {
    const head = v.f < -1 ? v.yaw + Math.PI : v.yaw;
    p.yaw += angleDiff(p.yaw, head) * clamp(dt * 2.4, 0, 1); p.pitch = lerp(p.pitch, -0.12, clamp(dt * 1.5, 0, 1));
  }
  let thr = 0, st = 0;
  if (Input.keys.KeyW || Input.keys.ArrowUp) thr += 1;
  if (Input.keys.KeyS || Input.keys.ArrowDown) thr -= 1;
  if (Input.keys.KeyD || Input.keys.ArrowRight) st += 1;
  if (Input.keys.KeyA || Input.keys.ArrowLeft) st -= 1;
  thr += Input.move.z; st += Input.move.x; // 모바일 조이스틱: 위/아래 = 가속/후진, 좌우 = 조향
  v.ctrl.throttle = clamp(thr, -1, 1); v.ctrl.steer = clamp(st, -1, 1); v.ctrl.hand = !!Input.keys.Space;
  p.fireHold = false; p.aiming = false; p.sprint = false; p.moving = sp > 0.5;
  for (const k of DRIVE_IGNORE) Input.consume(k);
  if (Input.consume('heal')) { if (sp < 0.8) usePlayerHeal(p); else HUD.toast('차량을 멈춘 뒤 사용할 수 있습니다'); }
  if (Input.consume('drink')) { if (sp < 0.8) useConsumable(p, 'drink'); else HUD.toast('차량을 멈춘 뒤 사용할 수 있습니다'); }
  if (Input.consume('interact')) Veh.exit(p);
  if (Input.consume('ping')) pingInputs(p);
  if (Input.consume('crouch') || Input.consume('seat')) Veh.switchSeat(p);
}
// ---------- 팀 지휘 (핑) ----------
// Q / 핑 버튼: 조준점 근처에 보이는 적이 있으면 '공격', 아니면 그 지점으로 '이동'
//  빠르게 두 번(0.4초 안) → '위험' 표시(빨간 경고: 팀원이 그쪽을 경계하며 엄폐), 길게 누르기(0.55초) → '모여'(따라오기)
let _pingT = -9, _pingPrev = null, _pingHold0 = 0, _pingHoldDone = false;
const rtNow = () => performance.now() / 1000; // 실제 시간 (프레임이 느려도 두 번 누르기 판정이 흔들리지 않게)
const _pv = new THREE.Vector3(), _pc = new THREE.Vector3();
function mateBots(p) { return teamMembers(p).filter((m) => m !== p && m.brain && standing(m)); }
function teamCallout(text, kind) { const ms = mateBots(G.player); if (ms.length) HUD.toast(`${pick(ms).name}: ${text}`, kind || 'info'); }
function setTeamOrder(ord, quiet) {
  const p = G.player; if (!p) return;
  ord.t = G.time; G.teamOrder = ord.kind === 'follow' ? null : ord;
  for (const m of mateBots(p)) {
    const b = m.brain; b.thinkT = 0; b.goal = null; b.path = null; b.wantPath = null;
    if (b.investigate && b.investigate.kind === 'order') b.investigate = null;
    if (b.state === 'ORDER' || b.state === 'FOLLOW' || b.state === 'MOVE' || b.state === 'EXPLORE' || b.state === 'LOOT') b.setState('EXPLORE');
  }
  Audio.ping(ord.kind);
  if (!quiet) teamCallout({ follow: '알겠다, 따라간다', move: '이동한다', attack: '목표 확인, 공격한다' }[ord.kind], 'ok');
}
// 조준점이 가리키는 지면·건물 지점 (없으면 null)
function aimPoint(p, maxD) {
  const cam = G.camera, o = cam.position; cam.getWorldDirection(_pv);
  const h = raycastAll(o.x, o.y, o.z, _pv.x, _pv.y, _pv.z, maxD, p);
  return h.type && h.t <= maxD ? { x: o.x + _pv.x * h.t, y: o.y + _pv.y * h.t, z: o.z + _pv.z * h.t } : null;
}
function setDanger(pt) {
  G.danger = { x: pt.x, y: pt.y, z: pt.z, t: G.time };
  for (const m of mateBots(G.player)) { m.brain.thinkT = 0; m.brain.holdCover = null; }
  Audio.ping('danger'); teamCallout('위험 지역 확인, 엄폐한다', 'warn');
}
// 길게 누르기 → 모여 (매 프레임 확인)
function pingHoldCheck() {
  const held = Input.keys.KeyQ || Input.pingDown;
  if (!held) { _pingHold0 = 0; _pingHoldDone = false; return; }
  if (!_pingHold0) _pingHold0 = rtNow();
  else if (!_pingHoldDone && rtNow() - _pingHold0 > 0.55 && G.teamSize > 1 && G.player && G.player.alive) {
    _pingHoldDone = true; _pingT = -9;
    G.teamOrder = _pingPrev && _pingPrev.kind !== 'follow' ? _pingPrev : null; // 누르는 순간 찍힌 핑은 취소
    setTeamOrder({ kind: 'follow' });
  }
}
function pingInputs(p) { const q = Input.pingQ.splice(0); if (!q.length) q.push(rtNow()); for (const t of q) playerPing(p, t); }
function playerPing(p, tPress) {
  const now = tPress || rtNow();
  if (!(G.teamSize > 1)) { HUD.toast('핑은 듀오·스쿼드에서 팀원 봇에게 지시할 때 씁니다'); return; }
  if (!mateBots(p).length) { HUD.toast('지시할 팀원이 없습니다', 'warn'); return; }
  // 두 번째 누름: 방금 찍은 핑을 되돌리고 그 자리에 '위험' 표시
  if (now - _pingT < 0.4) {
    _pingT = -9; G.teamOrder = _pingPrev || null;
    const pt = aimPoint(p, 700); if (pt) setDanger(pt); else HUD.toast('너무 멀어서 표시할 수 없습니다', 'warn');
    return;
  }
  _pingT = now; _pingPrev = G.teamOrder;
  const cam = G.camera, o = cam.position; cam.getWorldDirection(_pv);
  // 적: 조준점 2.5° 안에서 실제로 보이는 적 (가장 정면)
  let best = null, bd = Math.cos(2.5 * DEG);
  for (const c of CHARS) {
    if (!c.alive || c.mode !== 'ground' || c.team === p.team) continue;
    c.chest(_pc); const dx = _pc.x - o.x, dy = _pc.y - o.y, dz = _pc.z - o.z, L = Math.hypot(dx, dy, dz);
    if (L > 350 || L < 1) continue;
    const dot = (dx * _pv.x + dy * _pv.y + dz * _pv.z) / L;
    if (dot > bd && losClear(o.x, o.y, o.z, _pc.x, _pc.y, _pc.z)) { bd = dot; best = c; }
  }
  if (best) { setTeamOrder({ kind: 'attack', target: best, x: best.pos.x, y: best.pos.y, z: best.pos.z }); HUD.spot(best, p); return; }
  const pt = aimPoint(p, 700);
  if (!pt) { HUD.toast('너무 멀어서 표시할 수 없습니다', 'warn'); return; }
  setTeamOrder({ kind: 'move', x: pt.x, y: pt.y, z: pt.z });
}
// 지시 유지·해제: 공격 목표 탈락/40초, 이동 지점에서 플레이어가 160m 넘게 멀어지거나 150초
function updateTeamOrder() {
  pingHoldCheck();
  if (G.danger && G.time - G.danger.t > 25) G.danger = null;
  const ord = G.teamOrder, p = G.player; if (!ord) return;
  if (!p || !p.alive) { G.teamOrder = null; return; }
  if (ord.kind === 'attack') {
    if (!ord.target.alive) { G.teamOrder = null; teamCallout('목표 처치 확인', 'ok'); }
    else if (G.time - ord.t > 40) { G.teamOrder = null; teamCallout('목표를 놓쳤다, 따라간다'); }
  } else if (ord.kind === 'move' && (Math.hypot(ord.x - p.pos.x, ord.z - p.pos.z) > 160 || G.time - ord.t > 150)) { G.teamOrder = null; teamCallout('너무 멀어졌다, 따라간다'); }
}
// 사격 입력 처리 (걸을 때·동승석 공용)
function playerFire(p) {
  p.fireHold = Input.fire;
  // 산탄총·볼트액션은 한 발씩 넣는 중에도 쏘면 장전을 멈추고 바로 사격
  if (Input.fire && p.rl && p.rl.canCancel && p.weapon && p.weapon.mag > 0 && !p.firedThisPress) cancelReload(p);
  if (!p.weapon || p.sprint || p.rl) p.burstQ = 0;
  if (p.weapon && p.fireCd <= 0 && !p.sprint && !p.rl && !p.cycle) {
    const d = ITEMS[p.weapon.id], mode = fireMode(p.weapon);
    // 사격 모드: 연사/저속 연사는 누르는 동안, 단발은 한 번 누를 때 1발, 3점사는 한 번 누르면 3발(손을 떼도 끝까지)
    let want = p.burstQ > 0;
    if (!want && Input.fire && (mode === 'auto' || mode === 'slow' || !p.firedThisPress)) { want = true; if (mode === 'burst' && p.weapon.mag > 0) p.burstQ = d.burstN; }
    if (want) {
      if (p.weapon.mag <= 0) { p.burstQ = 0; if (!p.firedThisPress) { if (!startReload(p)) { Audio.dryfire(); HUD.toast('탄약이 없습니다'); } } p.firedThisPress = true; }
      else {
        computeAim(p, _aimO, _aimD);
        if (fireWeapon(p, _aimO, _aimD)) {
          p.lastShotT = G.time; p.firedThisPress = true;
          const lmgProne = d.cls === 'LMG' && p.stance === 'prone';
          const rec = d.recoil * (p.weapon.att.muzzle ? ITEMS.comp.recoilMul : 1) * (p.aiming ? 0.7 : 1) * (lmgProne ? 0.4 : p.stance === 'prone' ? 0.6 : p.stance === 'crouch' ? 0.85 : 1);
          p.pitch += rec * 0.011; p.yaw += rnd(-1, 1) * rec * 0.004; Cam.recoilP += rec * 0.006 / Math.max(1, Cam.zoom * 0.5); Cam.kick += 0.022 * rec; Cam.kickRot += 0.035 * rec;
          if (p.burstQ > 0 && --p.burstQ === 0) p.fireCd = Math.max(p.fireCd, d.burstGap);
        } else p.burstQ = 0;
      }
    }
  }
  if (!Input.fire) p.firedThisPress = false;
}
function computeAim(p, origin, dir) {
  const cam = G.camera;
  cam.getWorldDirection(_cf);
  p.eye(origin);
  if (G.firstPerson || Cam.ads > 0.5) { dir.copy(_cf); return; }
  // 3인칭: 화면 중앙 조준점이 가리키는 지점으로, 캐릭터 눈 위치에서 발사
  const startT = cam.position.distanceTo(origin);
  const h = raycastAll(cam.position.x, cam.position.y, cam.position.z, _cf.x, _cf.y, _cf.z, 800, p);
  let t = h.type && h.t > startT ? h.t : 600;
  const tx = cam.position.x + _cf.x * t, ty = cam.position.y + _cf.y * t, tz = cam.position.z + _cf.z * t;
  origin.x += -Math.cos(p.yaw) * 0.12; origin.z += Math.sin(p.yaw) * 0.12;
  dir.set(tx - origin.x, ty - origin.y, tz - origin.z).normalize();
}
function switchWeapon(p, i) {
  if (!p.inv.weapons[i] || p.inv.cur === i) return;
  p.inv.cur = i; p.equipT = 0.6; p.reloadT = 0; p.cycle = null; p.aiming = false; p.burstQ = 0; p.setVisibleGear();
  Audio.mech('equip', null, p.inv.weapons[i].id, true);
}
function usePlayerHeal(p) {
  const id = p.inv.bestHeal(p.hp);
  if (!id) { HUD.toast(p.hp >= 100 ? '체력이 가득 찼습니다' : (p.hp >= 75 && (p.inv.count('bandage') || p.inv.count('firstaid')) ? '75 이상은 의료 키트만 회복됩니다' : '회복 아이템이 없습니다')); return; }
  useConsumable(p, id);
}
function useConsumable(p, id) {
  const d = ITEMS[id];
  if (p.knocked) { HUD.toast('기절 중에는 사용할 수 없습니다', 'warn'); return; }
  if (!p.inv.count(id)) { HUD.toast(d.name + ' 없음'); return; }
  if (d.type === 'heal' && p.hp >= d.cap) { HUD.toast(`${d.name}은(는) 체력 ${d.cap}까지만 회복합니다`); return; }
  if (p.heal) return;
  if (p.throwMode) exitThrow(p);
  beginHeal(p, id); p.reloadT = 0;
}
// 회복 시작 (플레이어·봇 공용): 아이템별 소리 — 봇은 가까이 있으면 들린다
function beginHeal(c, id) {
  const d = ITEMS[id];
  c.heal = { id, t: d.time, total: d.time }; c.aiming = false;
  if (c.isPlayer || (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 18)) Audio.heal(id, 'start', c.pos, c.isPlayer);
}
// ---------- 투척 ----------
// G/투척 버튼 → 투척 준비(총을 내리고 수류탄을 쥠, 궤적 표시) → 사격 버튼을 누르면 핀 뽑기(카운트다운 시작) → 떼면 던짐
//  수류탄은 핀을 뽑고 7초, 연막탄은 3초 뒤 터진다. 쥐고 있다가 시간이 다 되면 손에서 터진다
const THROW_POWER = 17;
const _tpo = new THREE.Vector3(), _tpd = new THREE.Vector3();
function throwOrigin(p, o, d) { G.camera.getWorldDirection(d); p.eye(o); o.addScaledVector(d, 0.5); return o; }
function enterThrow(p, type) {
  if (!type) { type = p.inv.throwSel; if (!p.inv.count(type)) type = type === 'frag' ? 'smoke' : 'frag'; }
  if (!p.inv.count(type)) { HUD.toast('투척 무기가 없습니다'); return false; }
  if (p.knocked || p.veh || p.mode !== 'ground') return false;
  if (p.heal) p.heal = null;
  if (p.revive) cancelRevive(p);
  p.reloadT = 0; p.cycle = null; p.burstQ = 0; p.aiming = false;
  if (Input.aimToggle) { Input.aimToggle = false; const ab = $('tb_aim'); if (ab) ab.classList.remove('active'); }
  p.throwMode = { type, pin: false, cook: 0, armed: !Input.fire };
  p.inv.throwSel = type;
  Audio.pickup('nade', null, true);
  return true;
}
function exitThrow(p, quiet) { if (!p.throwMode) return; const pin = p.throwMode.pin; p.throwMode = null; if (!quiet) HUD.toast(pin ? '핀을 다시 꽂았습니다' : '투척 취소'); }
function updateThrow(p, dt) {
  const tm = p.throwMode; if (!tm) return;
  if (!p.inv.count(tm.type)) { p.throwMode = null; return; }
  if (!tm.armed) { if (!Input.fire) tm.armed = true; return; }
  if (!tm.pin) { if (Input.fire) { tm.pin = true; tm.cook = 0; Audio.pin(); } return; }
  tm.cook += dt;
  const left = FUSE[tm.type] - tm.cook;
  if (left <= 0) { // 너무 오래 쥐고 있었다
    p.chest(_tpo); _tpd.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const pr = throwItem(p, tm.type, _tpo, _tpd, 0.5, 0); if (pr) pr.inHand = true; p.throwMode = null;
    if (tm.type === 'frag') HUD.toast('수류탄을 너무 오래 쥐고 있었습니다!', 'warn');
    return;
  }
  if (!Input.fire) {
    throwOrigin(p, _tpo, _tpd);
    const pr = throwItem(p, tm.type, _tpo, _tpd, THROW_POWER, left);
    if (pr) { G.myNade = pr; p.throwAnim = 0.35; Audio.spoon(); HUD.toast(`${ITEMS[tm.type].name} 투척 — ${left.toFixed(1)}초 뒤 ${tm.type === 'frag' ? '폭발' : '연막'}`); }
    p.throwMode = null; p.firedThisPress = true;
  }
}
// 궤적 미리보기: 실제 투척물과 같은 물리로 첫 충돌 지점까지 (튕겨 굴러가는 것은 제외)
const ThrowViz = (() => {
  const MAXP = 160; let pts = null, ring = null, dot = null, scene = null;
  function init(sc) {
    scene = sc;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: IS_TOUCH ? 6 : 4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
    pts.frustumCulled = false; pts.renderOrder = 998; pts.visible = false; sc.add(pts);
    ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }));
    ring.renderOrder = 999; ring.visible = false; sc.add(ring);
    dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), ring.material); dot.renderOrder = 999; ring.add(dot);
  }
  function predict(o, d, power, arr) {
    let x = o.x, y = o.y, z = o.z, vx = d.x * power, vy = d.y * power + 3.2, vz = d.z * power, n = 0, acc = 0;
    const dt = 1 / 60, put = () => { if (n < MAXP) { arr[n * 3] = x; arr[n * 3 + 1] = y; arr[n * 3 + 2] = z; n++; } };
    put();
    for (let i = 0; i < 360; i++) {
      vy -= GRAVITY * 0.9 * dt;
      const sp = Math.hypot(vx, vy, vz), L = sp * dt, r = rayBoxes(x, y, z, vx / sp, vy / sp, vz / sp, L + 0.1, true);
      if (r.t <= L + 0.1) { const t = Math.max(0, r.t - 0.04); x += vx / sp * t; y += vy / sp * t; z += vz / sp * t; put(); return { n, x, y, z, up: r.ny > 0 }; }
      x += vx * dt; y += vy * dt; z += vz * dt; acc += L;
      const g = groundAt(x, z, y + 0.3);
      if (y < g + 0.08) { y = g + 0.08; put(); return { n, x, y: g, z, up: true }; }
      if (acc > 0.45) { acc = 0; put(); }
    }
    return { n, x, y, z, up: false };
  }
  function update(p) {
    if (!pts) return;
    const on = !!(p && p.alive && p.throwMode && p.mode === 'ground' && !p.veh && G.state === 'play');
    pts.visible = ring.visible = on; if (!on) return;
    throwOrigin(p, _tpo, _tpd);
    const arr = pts.geometry.attributes.position.array, r = predict(_tpo, _tpd, THROW_POWER, arr);
    pts.geometry.setDrawRange(1, Math.max(0, r.n - 1)); pts.geometry.attributes.position.needsUpdate = true;
    ring.position.set(r.x, r.y + 0.04, r.z); ring.visible = r.up;
    const col = p.throwMode.type === 'frag' ? 0xff8a3d : 0xe8eef2; if (ring.material.color.getHex() !== col) ring.material.color.setHex(col);
    ring.scale.setScalar(1 + Math.sin(G.time * 6) * 0.08);
  }
  return { init, update, predict };
})();
function updateNearbyLoot(p) {
  itemsNear(p.pos.x, p.pos.z, 2.6, _near);
  const list = _near.filter(it => Math.abs(it.y - p.pos.y) < 1.6);
  // 바라보는 방향에 가까운 순서
  const yaw = p.yaw;
  list.sort((a, b) => {
    const sa = Math.abs(angleDiff(yaw, Math.atan2(a.x - p.pos.x, a.z - p.pos.z))) + Math.hypot(a.x - p.pos.x, a.z - p.pos.z) * 0.3;
    const sb = Math.abs(angleDiff(yaw, Math.atan2(b.x - p.pos.x, b.z - p.pos.z))) + Math.hypot(b.x - p.pos.x, b.z - p.pos.z) * 0.3;
    return sa - sb;
  });
  HUD.setLoot(list.slice(0, 6));
}
function doPickup(p, it) {
  if (p.knocked || !p.alive) return;
  const r = pickupItem(p, it, G.scene);
  HUD.toast(r.msg, r.ok ? 'ok' : 'warn');
  if (r.ok && p.weapon && p.weapon.mag === 0 && ITEMS[it.id].type === 'weapon') startReload(p);
  HUD.refreshInventory();
}

// 공용: 재장전/회복/장착 타이머 (플레이어·봇)
function updateCharTimers(c, dt) {
  if (!c.alive) return;
  if (c.pickT > 0) c.pickT = Math.max(0, c.pickT - dt);
  if (c.rollT > 0) c.rollT = Math.max(0, c.rollT - dt);
  if (c.throwAnim > 0) c.throwAnim = Math.max(0, c.throwAnim - dt);
  if (c.knocked) { updateKnocked(c, dt); return; }
  if (c.revive) updateRevive(c, dt);
  c.fireCd -= dt; c.bloom = Math.max(0, c.bloom - dt * 2.4);
  if (c.equipT > 0) { c.equipT -= dt; if (c.equipT <= 0.25 && c.rig.gunId !== (c.weapon && c.weapon.id)) c.setVisibleGear(); }
  if (c.rl) updateReload(c, dt);
  if (c.cycle) updateCycle(c, dt);
  if (c.slideKick > 0) c.slideKick -= dt;
  if (c.heal) {
    if (c.sprint || (c.isPlayer && c.fireHold && c.weapon)) { c.heal = null; }
    else {
      c.heal.t -= dt;
      if (c.heal.t <= 0) {
        const d = ITEMS[c.heal.id];
        if (c.inv.take(c.heal.id, 1)) {
          if (d.type === 'heal') c.hp = Math.min(Math.max(c.hp, Math.min(d.cap, c.hp + d.heal)), d.cap === 100 ? 100 : Math.max(c.hp, d.cap));
          else c.boost = Math.min(100, c.boost + d.boost);
          if (c.isPlayer) { HUD.toast(d.name + ' 사용 완료', 'ok'); HUD.refreshInventory(); Audio.heal(c.heal.id, 'done', null, true); }
        }
        c.heal = null;
      }
    }
  }
  // 부스트: 서서히 체력 회복
  if (c.boost > 0) { c.boost = Math.max(0, c.boost - dt * 1.6); if (c.hp < 100) c.hp = Math.min(100, c.hp + dt * (c.boost > 60 ? 1.6 : 0.8)); }
}
