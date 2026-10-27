// ============================================================
// 11_game.js — 렌더러, 로비 3D 씬, 경기 흐름(로딩→미리보기→수송기→강하→생존→결과),
//              메인 루프, 설정 적용, 통계 저장
// ============================================================
const BOT_NAMES = ['Raven', 'Kite', 'Mako', 'Talon', 'Viper', 'Onyx', 'Sable', 'Rook', 'Drift', 'Ember', 'Frost', 'Grit', 'Havoc', 'Jinx', 'Lynx', 'Nomad', 'Pike', 'Quill', 'Rogue', 'Shade', 'Torque', 'Vex', 'Wolf', 'Zed', '바람', '천둥', '매', '여우', '늑대', '그림자', '번개', '독수리', '서리', '불꽃', '강철', '안개', '파도', '돌풍', '흑표', '은빛'];
const TIMES = {
  day:  { top: 0x4f86c6, hor: 0xcfdde4, fog: 0xbfcdd3, sun: 0xfff2da, sunI: 1.05, hemiS: 0xd6e6f2, hemiG: 0x5a5a40, hemiI: 0.62, dir: [0.45, 0.82, 0.35] },
  dusk: { top: 0x26345e, hor: 0xf09a5e, fog: 0xb08470, sun: 0xffad6a, sunI: 0.9, hemiS: 0x9a86a8, hemiG: 0x3a3030, hemiI: 0.5, dir: [0.85, 0.26, 0.22] },
};
const TIPS = [
  '파란 벽 바깥은 자기장입니다. 단계가 올라갈수록 초당 피해가 커집니다.',
  '봇은 벽 너머를 보지 못합니다. 대신 총성과 발소리를 듣고 그 근처를 수색합니다.',
  '앉거나 엎드리면 봇이 당신을 발견하는 거리가 줄어듭니다.',
  '붕대와 구급상자는 체력 75까지만 회복됩니다. 그 이상은 의료 키트가 필요합니다.',
  '연막탄은 봇의 시야를 가립니다. 엄폐물 없이 이동할 때 쓰세요.',
  '군사기지와 도시 중심부에는 좋은 장비가 많지만 봇도 많이 내립니다.',
  '차량은 도로변·주차장·농장(말)·군사기지(UAZ)에 있습니다. F(모바일은 탑승 버튼)로 타고 내립니다.',
  '오토바이는 가장 빠르지만(150km/h) 몸이 그대로 드러납니다. UAZ는 느려도 가장 튼튼합니다.',
  '듀오·스쿼드에서는 쓰러져도 바로 죽지 않고 기절합니다. 팀원이 옆에서 F(부활 버튼)를 10초 누르면 살아납니다.',
  '기절한 적은 아직 탈락이 아닙니다. 팀원이 살리기 전에 확인 사살하거나, 팀 전체를 쓰러뜨리면 한꺼번에 탈락합니다.',
];

const G = {
  state: 'lobby', paused: false, time: 0, noises: [], player: null, plane: null, marker: null, markerMesh: null,
  firstPerson: SETTINGS.view === 'fpp', shake: 0, over: false, scene: null, camera: null, renderer: null,
  sun: null, hemi: null, previewT: 0, stats: { shots: 0, hits: 0 }, lastXp: 0, statsSaved: false, timeScale: 1, endT: 0, total: 0,
};

// ---------- 렌더러 ----------
function initRenderer() {
  const canvas = $('gl');
  const r = new THREE.WebGLRenderer({ canvas, antialias: SETTINGS.quality !== 'low', powerPreference: 'high-performance' });
  r.setPixelRatio(QUALITY[SETTINGS.quality].pr);
  r.setSize(window.innerWidth, window.innerHeight, false);
  r.shadowMap.enabled = SHADOW_SIZE[SETTINGS.shadows] > 0; r.shadowMap.type = THREE.PCFSoftShadowMap;
  G.renderer = r;
  G.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, QUALITY[SETTINGS.quality].far + 200);
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    r.setSize(w, h, false);
    G.camera.aspect = w / h; G.camera.updateProjectionMatrix();
    Lobby.cam.aspect = w / h; Lobby.cam.updateProjectionMatrix();
    $('rotateHint').hidden = !(IS_TOUCH && h > w && !G.rotateDismissed);
    if (!$('mapPanel').hidden) HUD.drawBig();
  };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  G.onResize = onResize;
}
function skyDome(t, R = 1500) {
  const g = new THREE.SphereGeometry(R, 24, 12), col = [], top = new THREE.Color(t.top), hor = new THREE.Color(t.hor), c = new THREE.Color();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / R; c.copy(hor).lerp(top, clamp(y * 1.6, 0, 1)); if (y < 0) c.copy(hor).multiplyScalar(0.8); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}
function addLights(scene, t, shadowSize) {
  const hemi = new THREE.HemisphereLight(t.hemiS, t.hemiG, t.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(t.sun, t.sunI);
  sun.position.set(t.dir[0] * 120, t.dir[1] * 120, t.dir[2] * 120);
  sun.castShadow = shadowSize > 0;
  if (shadowSize) {
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const s = sun.shadow.camera; s.left = s.bottom = -55; s.right = s.top = 55; s.near = 1; s.far = 320;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  }
  scene.add(sun); scene.add(sun.target);
  return { hemi, sun };
}

// ---------- 로비 3D ----------
const Lobby = {
  scene: null, cam: null, rig: null, t: 0,
  init() {
    const sc = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 400);
    this.applyTime();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), new THREE.MeshLambertMaterial({ color: 0x5b5a48 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.2, 32), lam(0x3c3f3a)); pad.position.y = 0.1; pad.receiveShadow = true; sc.add(pad);
    const add = (geo, col, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, lam(col)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; sc.add(m); return m; };
    // 소품: 캐릭터 뒤쪽에 배치 (가운데 캐릭터를 가리지 않게) — 탄약 상자, 모래주머니, 컨테이너, 실제 차량 모델, 철조망 기둥, 숲
    add(new THREE.BoxGeometry(1.2, 0.8, 0.8), 0x4d5a3a, -2.7, 0.4, -1.5, 0.3); add(new THREE.BoxGeometry(0.9, 0.6, 0.6), 0x5a4a30, -2.5, 1.1, -1.6, 0.1);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.0, 0.36, 0.5), 0xa89670, 5.4 + (i % 3) * 0.95, 0.18 + Math.floor(i / 3) * 0.36, -3.6, 0.05 * i);
    add(new THREE.BoxGeometry(2.44, 2.6, 6.1), 0xa8452f, 12, 1.3, -15, 0.5);
    add(new THREE.BoxGeometry(2.44, 2.6, 6.1), 0x2f6a8a, -13, 1.3, -16, -0.4);
    try {
      const u = VehModels.instance('uaz'); u.root.position.set(-5.2, 0, -4.6); u.root.rotation.y = 0.95; sc.add(u.root);
      const m = VehModels.instance('moto'); m.root.position.set(3.0, 0, -3.0); m.root.rotation.y = -0.75; m.root.rotation.z = 0.12; sc.add(m.root);
    } catch (e) { console.warn('로비 차량 생략', e); }
    for (let i = 0; i < 11; i++) add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), 0x777777, -15 + i * 3, 1.2, -11);
    const tg = new THREE.ConeGeometry(1.6, 5, 7); for (let i = 0; i < 22; i++) { const a = -Math.PI * 0.95 + i / 21 * Math.PI * 0.9, r = 24 + Math.random() * 12; add(tg, 0x2e4a2a, Math.cos(a) * r, 2.5, Math.sin(a) * r); }
    this.setOutfit(SETTINGS.outfit);
    this.mates = []; this.setTeam(1);
  },
  // 듀오·스쿼드: 캐릭터 옆에 봇 팀원을 세워 둔다 (오른쪽·뒤 — 왼쪽 패널에 가리지 않게)
  // outs: 파티원 복장 번호 (있으면 그 복장으로)
  setTeam(n, outs) {
    const key = n + '|' + (outs ? outs.join(',') : '');
    if (this.teamN === key) return; this.teamN = key;
    for (const m of this.mates) this.scene.remove(m.root);
    this.mates = [];
    const spots = [[1.3, -0.5, -0.25], [2.45, -1.25, -0.45], [-1.05, -1.55, 0.35]];
    for (let i = 0; i < n - 1 && i < spots.length; i++) {
      const o = outs && outs[i] !== undefined ? OUTFITS[outs[i]] || OUTFITS[0] : OUTFITS[(SETTINGS.outfit + 1 + i) % OUTFITS.length], rig = buildRig(o);
      rig.gunMount.add(buildGunMesh(['akm', 'aug', 'mini14'][i] || 'm416', { scope: i === 2 ? 'x4' : 'reddot' }));
      rig.helmet.visible = true; rig.vest.visible = i !== 1; rig.pack.visible = true;
      rig.root.position.set(spots[i][0], 0, spots[i][1]); rig.baseYaw = spots[i][2]; rig.ph = i * 1.7 + 0.6;
      this.scene.add(rig.root); this.mates.push(rig);
    }
  },
  pose(r, t, yaw) {
    r.root.rotation.y = yaw;
    r.hips.position.y = 0.95 + Math.sin(t * 1.6) * 0.008;
    r.spine.rotation.x = 0.05 + Math.sin(t * 1.6) * 0.012;
    r.neck.rotation.y = Math.sin(t * 0.4) * 0.35; r.neck.rotation.x = -0.05;
    r.armR.sh.rotation.set(-0.75, 0, 0.05); r.armR.el.rotation.x = -1.1;
    r.armL.sh.rotation.set(-1.05, 0, -0.45); r.armL.el.rotation.x = -0.75;
    r.gunMount.rotation.set(0.35, 0.15, 0); r.gunMount.position.set(-0.08, 0.3, 0.22);
    r.legR.hip.rotation.set(-0.04, 0, -0.04); r.legL.hip.rotation.set(0.05, 0, 0.06); r.legR.knee.rotation.x = 0.08; r.legL.knee.rotation.x = 0.03;
  },
  applyTime() {
    const sc = this.scene, t = TIMES[SETTINGS.time];
    if (this.lights) { sc.remove(this.lights.hemi); sc.remove(this.lights.sun); }
    if (this.sky) sc.remove(this.sky);
    this.sky = skyDome(t, 300); sc.add(this.sky);
    sc.fog = new THREE.Fog(t.fog, 26, 120);
    this.lights = addLights(sc, t, SHADOW_SIZE[SETTINGS.shadows] ? 1024 : 0);
    this.lights.sun.shadow.camera.left = this.lights.sun.shadow.camera.bottom = -12; this.lights.sun.shadow.camera.right = this.lights.sun.shadow.camera.top = 12;
  },
  setOutfit(i) {
    if (this.rig) this.scene.remove(this.rig.root);
    const rig = buildRig(OUTFITS[i]); this.rig = rig; this.scene.add(rig.root);
    rig.gunMount.add(buildGunMesh('m416', { scope: 'x2', muzzle: 'comp' }));
    rig.helmet.visible = true; rig.vest.visible = true; rig.pack.visible = true;
    rig.root.position.set(0, 0.2, 0);
  },
  update(dt) {
    this.t += dt; const r = this.rig, t = this.t;
    // 대기 자세: 호흡, 무게 이동, 가끔 고개 돌리기
    this.pose(r, t, 0.35 + Math.sin(t * 0.25) * 0.15);
    for (const m of this.mates) this.pose(m, t + m.ph, m.baseYaw + Math.sin((t + m.ph) * 0.21) * 0.12);
    // 캐릭터를 화면 가운데에 (왼쪽 패널은 배경 위에 겹친다)
    const a = t * 0.08;
    this.cam.position.set(Math.sin(a) * 0.5 + 0.2, 1.45 + Math.sin(t * 0.3) * 0.05, 4.9 + Math.cos(a) * 0.2);
    this.cam.lookAt(0.05, 1.02, 0);
  },
};

// ---------- 수송기 ----------
function buildPlane() {
  const g = new THREE.Group(), body = lam(0x6b705c), dark = lam(0x2e3230);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 26, 12).rotateX(Math.PI / 2), body); g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), body); nose.position.z = 13; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 4.5), body); wing.position.set(0, 1.4, 2); g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 2.6), body); tail.position.set(0, 1.2, -12); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 3.4), body); fin.position.set(0, 3.6, -12); g.add(fin);
  const props = [];
  for (const x of [-11, -5.5, 5.5, 11]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.4, 8).rotateX(Math.PI / 2), dark); eng.position.set(x, 1.0, 4); g.add(eng);
    const pr = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.1), dark); pr.position.set(x, 1.0, 5.8); g.add(pr); props.push(pr);
  }
  g.userData.props = props;
  return g;
}
function setupPlane(scene, NP) {
  const PC = MAPS[SETTINGS.map].plane || { L: 470, speed: 38, alt: 300, off: 110 };
  // 같이 하기: 방장이 정한 비행 경로(각도·옆 이동)를 모두가 쓴다
  const a = NP ? NP.a : Math.random() * TAU, off = NP ? NP.off * PC.off : rnd(-PC.off, PC.off), dx = Math.cos(a), dz = Math.sin(a);
  const px = -dz * off, pz = dx * off, L = PC.L;
  const pl = { ax: px - dx * L, az: pz - dz * L, bx: px + dx * L, bz: pz + dz * L, dx, dz, t: 0, len: L * 2, speed: PC.speed, alt: PC.alt, active: true, pos: new THREE.Vector3(), mesh: buildPlane() };
  pl.pos.set(pl.ax, pl.alt, pl.az); pl.mesh.position.copy(pl.pos); pl.mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(pl.mesh);
  G.plane = pl;
}
// 섬 위 판정. 대형 맵은 해안선이 지도 가장자리보다 훨씬 안쪽이라 해안 기준으로 본다
function overIsland(x, z) {
  if (W && W.big) return Math.max(Math.abs(x), Math.abs(z)) * 0.65 + Math.hypot(x, z) * 0.35 < HALF * 0.84;
  return Math.abs(x) < HALF - 25 && Math.abs(z) < HALF - 25;
}
function jumpOut(c) {
  if (c.mode !== 'plane') return;
  const pl = G.plane;
  c.mode = 'fall'; c.pos.set(pl.pos.x + rnd(-2, 2), pl.pos.y - 3, pl.pos.z + rnd(-2, 2));
  c.vel.set(pl.dx * 14, -5, pl.dz * 14); c.root.visible = true; c.jumpT = G.time;
  if (c.isPlayer) {
    Audio.plane(false); HUD.toast('강하! W로 하강 속도를 높이고, F로 낙하산을 펼치세요', 'info');
    // 플레이어 팀원 봇: 플레이어를 따라 0.3~1.4초 뒤에 뛰어내린다
    let k = 0; for (const m of teamMembers(c)) if (m !== c && m.mode === 'plane' && m.brain) m.brain.jumpAt = pl.t + 0.3 + 0.35 * k++;
  }
}
// 자유낙하/낙하산 이동 (플레이어·봇 공용)
function updateDrop(c, dt, sx, sz, dive) {
  const ground = groundAt(c.pos.x, c.pos.z, c.pos.y);
  const hgt = c.pos.y - Math.max(ground, WATER_Y);
  if (c.mode === 'fall') {
    const gm = W.big ? 2.2 : 1; // 대형 맵은 활강 거리를 늘려 먼 지역까지 닿게 한다
    const vy = -(34 + dive * 14), hs = (6 + dive * 16) * gm;
    c.vel.y += clamp(vy - c.vel.y, -30 * dt, 30 * dt);
    c.vel.x += clamp(sx * hs - c.vel.x, -12 * dt, 12 * dt); c.vel.z += clamp(sz * hs - c.vel.z, -12 * dt, 12 * dt);
    if (hgt < (c.isPlayer ? 95 : c.brain.chuteH)) openChute(c);
  } else if (c.mode === 'chute') {
    const vy = -(5.2 + dive * 2.2), hs = (3.5 + Math.max(0, dive) * 6.5) * (W.big ? 2.2 : 1);
    c.vel.y += clamp(vy - c.vel.y, -25 * dt, 25 * dt);
    c.vel.x += clamp(sx * hs - c.vel.x, -6 * dt, 6 * dt); c.vel.z += clamp(sz * hs - c.vel.z, -6 * dt, 6 * dt);
  }
  c.pos.x += c.vel.x * dt; c.pos.y += c.vel.y * dt; c.pos.z += c.vel.z * dt;
  const lim = HALF - 3; c.pos.x = clamp(c.pos.x, -lim, lim); c.pos.z = clamp(c.pos.z, -lim, lim);
  const g2 = groundAt(c.pos.x, c.pos.z, c.pos.y);
  if (c.pos.y <= g2 || (g2 < WATER_Y - 1.25 && c.pos.y < WATER_Y - 1.2)) {
    if (c.pos.y <= g2) c.pos.y = g2;
    c.mode = 'ground'; c.vel.set(0, 0, 0); c.anim.land = 1; c.onGround = true; c.stance = 'stand';
    if (c.brain) { c.brain.landT = G.time; c.brain.setState('LANDING'); }
    if (c.isPlayer) { Audio.wind(0); HUD.toast('착지! 무기와 장비를 찾으세요', 'ok'); }
  }
  c.bodyYaw = c.yaw; c.root.position.copy(c.pos); c.root.rotation.y = c.bodyYaw;
}
function openChute(c) { if (c.mode === 'fall') { c.mode = 'chute'; if (c.isPlayer) HUD.toast('낙하산 전개', 'info'); } }

// 봇 착지 목표: 확산되도록 POI·외곽을 섞어 선택, 지붕이 아닌 열린 땅
// 비행 경로에서의 수직 거리
function planeLat(x, z) { const pl = G.plane; return Math.abs((x - pl.ax) * -pl.dz + (z - pl.az) * pl.dx); }
// 대형 맵: 봇이 활강해서 닿을 수 있는 거리(약 400m) 안의 POI/건물만 착지 후보로 — 그 밖을 고르면 들판에 떨어져 맨손이 된다
const BIG_DROP_LAT = 1100;
function dropCands() {
  if (G.dropCands && G.dropCands.plane === G.plane) return G.dropCands;
  const pois = W.pois.filter(p => planeLat(p.x, p.z) < BIG_DROP_LAT + p.r * 0.4);
  let blds = W.buildings.filter(b => planeLat(b.x, b.z) < BIG_DROP_LAT);
  // 첫 안전구역(+200m) 안 건물이 충분하면 그것만
  const nz = Zone.next, zb = nz ? blds.filter(b => Math.hypot(b.x - nz.x, b.z - nz.z) < nz.r + 200) : blds;
  if (zb.length >= 15) blds = zb;
  return (G.dropCands = { plane: G.plane, pois: pois.length ? pois : W.pois, blds: blds.length ? blds : W.buildings, taken: [] });
}
function pickDropTarget() {
  const C = W.big ? dropCands() : null;
  for (let i = 0; i < 60; i++) {
    let x, z;
    // 대형 맵: 빈 들판에 내리면 무기를 못 찾아 맨손 싸움이 된다 → 거의 항상 마을/건물 근처
    if (W.big && Math.random() < 0.35 && C.blds.length) { const b = pick(C.blds); x = b.x + rnd(-15, 15); z = b.z + rnd(-15, 15); }
    else if (Math.random() < (W.big ? 0.95 : 0.62) && W.pois.length) {
      const P = C ? C.pois : W.pois, nz = Zone.next;
      // 대형 맵: 첫 안전구역 안/근처 지역을 선호 (먼 곳에 내리면 자기장에 쫓겨 파밍을 못 한다)
      const zw = p => { if (!W.big || !nz) return 1; const o = Math.max(0, Math.hypot(p.x - nz.x, p.z - nz.z) - nz.r) / 250; return 1 / (1 + o * o); };
      const p = weightedPick(P.map(p => [p, { city: 4, military: 3, industrial: 2.4, depot: 1.6, farm: 1.4, village: 1.6 }[p.type] * zw(p)]));
      const a = Math.random() * TAU, d = Math.random() * (p.r + 25); x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else { x = rnd(-HALF * 0.75, HALF * 0.75); z = rnd(-HALF * 0.75, HALF * 0.75); }
    if (W.big && i < 50 && planeLat(x, z) > BIG_DROP_LAT + 40) continue;
    if (!Nav.isFree(x, z)) continue;
    const h = heightAt(x, z); if (h < 0.8) continue;
    if (groundAt(x, z, 9999) - h > 1.0) continue; // 지붕/구조물 위 제외
    if (Math.abs(x - G.plane.ax) + Math.abs(z - G.plane.az) < 1) continue;
    // 대형 맵: 한 지점에 봇이 몰리면 맨손 난투로 절반이 1분 안에 죽는다 → 80m 안에 이미 2명이면 다른 곳
    if (C && i < 50) { let n = 0; for (const t of C.taken) if (Math.abs(t.x - x) < 80 && Math.abs(t.z - z) < 80 && ++n >= 2) break; if (n >= 2) continue; }
    if (C) C.taken.push({ x, z });
    return { x, z };
  }
  return { x: rnd(-150, 150), z: rnd(-150, 150) };
}

// ---------- 경기 ----------
// cfg: 같이 하기(파티) 경기 설정 — 없으면 혼자
async function startMatch(cfg) {
  if (G.state === 'loading') return;
  const net = !!(cfg && G.net);
  G.state = 'loading'; G.paused = false; G.over = false; G.training = false;
  document.body.classList.remove('training'); $('quitBtn').textContent = '경기 포기 (로비로)';
  Audio.music(false);
  $('lobby').hidden = true; $('resultPanel').hidden = true; $('hud').hidden = true; $('loading').hidden = false;
  $('loadMap').textContent = MAPS[SETTINGS.map].name; $('loadTip').textContent = pick(TIPS);
  const prog = (p, label) => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadStep').textContent = label; };
  disposeMatch();
  const sc = new THREE.Scene(); G.scene = sc;
  const t = TIMES[SETTINGS.time], Q = QUALITY[SETTINGS.quality];
  G.sky = skyDome(t, Q.far * 0.92); sc.add(G.sky); sc.fog = new THREE.Fog(t.fog, Q.far * 0.25, Q.far);
  const L = addLights(sc, t, SHADOW_SIZE[SETTINGS.shadows]); G.sun = L.sun; G.hemi = L.hemi; G.sunDir = new THREE.Vector3(...t.dir).normalize();
  G.renderer.shadowMap.enabled = SHADOW_SIZE[SETTINGS.shadows] > 0;
  G.camera.far = Q.far + 200; G.camera.updateProjectionMatrix();
  sc.add(G.camera);
  // 총구 섬광 조명(중·고품질). 항상 장면에 두고 세기만 바꿔 셰이더 재컴파일을 피한다
  G.muzzleLight = SETTINGS.quality === 'low' ? null : new THREE.PointLight(0xffb060, 0, 9, 2);
  if (G.muzzleLight) sc.add(G.muzzleLight);
  VM.hemi.color.setHex(t.hemiS); VM.hemi.groundColor.setHex(t.hemiG); VM.dir.color.setHex(t.sun); VM.dir.intensity = t.sunI * 0.8; VM.hemi.intensity = t.hemiI * 0.9;
  G.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0c060, transparent: true, opacity: 0.6, depthWrite: false }));
  G.focusRing.visible = false; sc.add(G.focusRing);
  setMapSize(SETTINGS.map);
  try { await generateWorld(SETTINGS.map, sc, prog); }
  catch (e) { console.error(e); fatal('맵 생성 중 오류: ' + e.message); return; }
  prog(0.97, '아이템 배치');
  // 같이 하기: 시드를 맞춰 모든 기기에서 같은 아이템·차량이 같은 자리에 생긴다
  if (net) Net.seeded(cfg.seed + 1, () => populateLoot(sc)); else populateLoot(sc);
  prog(0.98, '차량 배치');
  Veh.init(sc);
  if (net) Net.seeded(cfg.seed + 2, () => Veh.spawnAll()); else Veh.spawnAll();
  if (net) { Net.indexVehicles(); Net.baseline(); }
  FX.init(sc); ThrowViz.init(sc); PROJ = []; SMOKES = []; PathQ.clear(); G.myNade = null;
  Zone.init(sc, MODES[SETTINGS.mode].zoneScale, SETTINGS.map);
  Airdrop.init(sc);
  setupPlane(sc, net ? cfg.plane : null);
  if (W.streamTerrain) { W.streamTerrain(G.plane.pos.x, G.plane.pos.z, Q.far + 250, 99); W.cullChunks(G.plane.pos.x, G.plane.pos.z, Q.far); }
  // 캐릭터 생성
  CHARS = []; G.noises = []; G.time = 0; G.stats = { shots: 0, hits: 0 }; G.killLog = []; G.knockLog = []; G.marker = null; G.updateMarker(); G.spec = null;
  G.teamOrder = null; G.spotted = new Map(); G.danger = null;
  G.ranked = net ? !!cfg.ranked : SETTINGS.queue === 'ranked' && Rank.unlocked(); G.quit = false; G.rankResult = null; G.hostGone = false;
  // 팀 구성 (혼자 랭크전은 솔로 고정, 파티 랭크전은 고른 팀 구성)
  const TS = G.teamSize = net ? cfg.teamSize : G.ranked ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size;
  G.teams = [];
  const joinTeam = (c) => { let T = G.teams[G.teams.length - 1]; if (!T || T.members.length >= TS) { T = { id: G.teams.length, members: [], place: 0 }; G.teams.push(T); } c.team = T.id; c.slot = T.members.length; T.members.push(c); return T; };
  // 사람: 혼자면 나, 파티면 파티원 전원(같은 팀, 0번부터)
  const humans = net ? cfg.humans : [{ uid: null, name: playerName(), outfit: SETTINGS.outfit }];
  let player = null;
  humans.forEach((hm, i) => {
    const me = !net || hm.uid === Cloud.uid;
    const c = new Character({ id: i, name: hm.name, isPlayer: me, outfit: OUTFITS[hm.outfit] || OUTFITS[0] });
    if (net) c.net = Net.charNet(hm.uid);
    CHARS.push(c); joinTeam(c); if (me) player = c;
  });
  G.player = player;
  const srand = net ? mulberry32(cfg.seed ^ 0x2545f491) : Math.random;        // 봇 이름·옷 색: 모든 기기에서 같게
  const names = BOT_NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); const t0 = names[i]; names[i] = names[j]; names[j] = t0; }
  const nBots = net ? Math.max(0, cfg.nBots - humans.length + 1) : G.ranked ? Rank.botCount(SETTINGS.map) : clamp(SETTINGS.bots, 1, mapMaxBots(SETTINGS.map));
  const pl = G.plane, hostSide = !net || Net.isHost(), H0 = humans.length;
  for (let i = 0; i < nBots; i++) {
    const outfit = Object.assign({}, OUTFITS[i % OUTFITS.length]);
    outfit.shirt = new THREE.Color(outfit.shirt).offsetHSL((srand() - 0.5) * 0.06, 0, (srand() - 0.5) * 0.12).getHex();
    const b = new Character({ id: i + H0, name: (names[i % names.length]) + (i >= names.length ? '_' + i : ''), outfit });
    if (!hostSide) { b.net = Net.charNet(cfg.host); joinTeam(b); CHARS.push(b); continue; } // 파티원 기기: 봇은 방장이 움직인다
    const dk = G.ranked ? Rank.botDifficulty() : SETTINGS.difficulty === 'mixed' ? pick(['easy', 'normal', 'normal', 'hard']) : SETTINGS.difficulty;
    const br = new Brain(b, dk);
    const T = joinTeam(b), lead = T.members[0];
    if (b.team === player.team && (!net || Net.isHost())) {
      // 플레이어 팀원: 플레이어가 뛰어내릴 때 따라 뛰고, 플레이어 근처에 착지
      br.followJump = true; br.jumpAt = Infinity; br.chuteH = 95; br.dropTarget = { x: 0, z: 0 };
      const a = b.slot / 3 * TAU + rnd(-0.4, 0.4); br.followOff = [Math.cos(a) * rnd(6, 11), Math.sin(a) * rnd(6, 11)];
    } else if (lead === b) {
      br.dropTarget = pickDropTarget(); br.chuteH = rnd(70, 140);
      // 경로상 목표에 가장 가까운 지점에서 강하 (약간의 시간차)
      const along = (br.dropTarget.x - pl.ax) * pl.dx + (br.dropTarget.z - pl.az) * pl.dz;
      br.jumpAt = clamp(along - rnd(40, 110), 60, pl.len - 80) / pl.speed;
    } else {
      // 같은 팀 봇: 팀장과 같은 지역(±15m)에 함께 내린다
      const L = lead.brain, t0 = L.dropTarget; let tg = null;
      for (let k = 0; k < 12 && !tg; k++) { const x = t0.x + rnd(-15, 15), z = t0.z + rnd(-15, 15); if (Nav.isFree(x, z) && heightAt(x, z) > 0.8 && groundAt(x, z, 9999) - heightAt(x, z) < 1) tg = { x, z }; }
      br.dropTarget = tg || { x: t0.x, z: t0.z }; br.chuteH = clamp(L.chuteH + rnd(-12, 12), 60, 150); br.jumpAt = L.jumpAt + b.slot * rnd(0.25, 0.5);
    }
    CHARS.push(b);
  }
  G.total = CHARS.length;
  for (const c of CHARS) { c.root.visible = false; c.pos.copy(G.plane.pos); sc.add(c.root); c.yaw = Math.atan2(G.plane.dx, G.plane.dz); }
  if (net) Net.ready();
  G.firstPerson = SETTINGS.view === 'fpp'; Cam.ads = 0; VM.key = null;
  HUD.reset(); Input.reset(); Touch.resetToggles(); Touch.apply();
  $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !IS_TOUCH;
  G.state = 'play'; G.previewT = 4.5;
  HUD.openMap(); HUD.toast('비행 경로를 확인하세요. 지도를 닫으면 출발합니다', 'info');
  Audio.plane(true); Audio.wind(0.1);
}
function disposeMatch() {
  Training.dispose(); DM.dispose();
  if (!G.scene) return;
  Zone.dispose(G.scene); Airdrop.dispose(); Veh.dispose();
  G.scene.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
  G.scene = null; CHARS = []; GROUND = []; W = null; G.player = null; G.plane = null; G.dropCands = null;
  Audio.plane(false);
}
G.updateMarker = function () {
  if (!G.scene) return;
  if (!G.markerMesh) {
    G.markerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 160, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xf0a43a, transparent: true, opacity: 0.45, fog: false, depthWrite: false }));
  }
  if (G.markerMesh.parent !== G.scene) G.scene.add(G.markerMesh);
  G.markerMesh.visible = !!G.marker;
  if (G.marker) G.markerMesh.position.set(G.marker.x, heightAt(G.marker.x, G.marker.z) + 80, G.marker.z);
};
// 경기 종료 판정: 내 팀이 전멸하면 패배, 살아 있는 팀이 내 팀뿐이면 우승 (내가 죽어 관전 중이어도 팀 우승)
G.onDeath = function (c, killer) {
  if (G.dm) { DM.onDeath(c, killer); return; }
  const p = G.player; if (!p || G.over || !G.teams) return;
  const mine = G.teams[p.team], team = G.teamSize > 1;
  if (!teamAlive(mine)) { G.over = true; G.endT = 2.2; G.win = false; Audio.lose(); HUD.toast(team ? '팀이 전멸했습니다' : '탈락했습니다', 'warn'); }
  else if (aliveTeamCount() === 1) { G.over = true; G.endT = 1.5; G.win = true; Audio.win(); HUD.toast(team ? '최후의 팀!' : '최후의 1인!', 'ok'); }
  else if (c === p) { HUD.toast('탈락했습니다 — 팀원을 관전합니다', 'warn'); G.spec = null; nextSpectate(); }
};
// 관전: 살아 있는 팀원 순환
function nextSpectate() {
  const p = G.player; if (!p || p.alive) return;
  const list = teamMembers(p).filter(m => m !== p && m.alive); if (!list.length) return;
  const i = list.indexOf(G.spec); G.spec = list[(i + 1) % list.length];
}
G.viewChar = () => { const p = G.player; return p && !p.alive && G.spec && G.spec.alive ? G.spec : p; };
const _sc = new THREE.Vector3();
function spectateCamera(dt, t) {
  const cam = G.camera, v = t.veh, yaw = v ? v.yaw : t.yaw;
  const back = v ? 7.5 : 4.2, up = v ? 3.2 : t.anim.prone > 0.5 ? 1.5 : 2.1;
  const hx = t.pos.x, hy = t.pos.y + (t.anim.prone > 0.5 ? 0.8 : 1.6), hz = t.pos.z;
  let bx = -Math.sin(yaw), bz = -Math.cos(yaw), by = (up - 1.0) / back; const L = Math.hypot(bx, by, bz); bx /= L; by /= L; bz /= L;
  let d = Math.hypot(back, up - 1.0);
  const hb = rayBoxes(hx, hy, hz, bx, by, bz, d + 0.3, true); if (hb.t < d + 0.25) d = Math.max(0.6, hb.t - 0.3);
  const ht = rayTerrain(hx, hy, hz, bx, by, bz, d + 0.4); if (ht < d + 0.35) d = Math.max(0.6, ht - 0.4);
  _sc.set(hx + bx * d, hy + by * d, hz + bz * d);
  const g = heightAt(_sc.x, _sc.z) + 0.4; if (_sc.y < g) _sc.y = g;
  if (cam.position.distanceTo(_sc) > 30) cam.position.copy(_sc); else cam.position.lerp(_sc, clamp(dt * 6, 0, 1));
  cam.fov = 72; cam.updateProjectionMatrix(); cam.lookAt(hx, hy - 0.3, hz);
  t.root.visible = true; VM.active = false; VM.root.visible = false;
}
function endMatch() {
  const p = G.player, win = G.win, T = G.teams[p.team], nT = G.teams.length;
  const place = win ? 1 : (T.place || aliveTeamCount() + (teamAlive(T) ? 0 : 1));
  G.state = 'result'; G.place = place;
  // 경험치: 처치·부활·순위(팀 수 대비 비율)·우승
  const xp = Math.round(40 + p.kills * 35 + p.revives * 20 + Math.max(0, nT - place) / Math.max(1, nT - 1) * (G.total - 1) * 4 + (win ? 150 : 0));
  G.lastXp = xp;
  STATS.matches++; STATS.kills += p.kills; STATS.xp += xp; if (win) STATS.wins++;
  STATS.best = Math.min(STATS.best || 99, place);
  G.rankResult = G.ranked ? Rank.apply({ place, total: G.teamSize > 1 ? nT : G.total, kills: p.kills, dmg: p.damageDealt, win, quit: !!G.quit }) : null;
  STATS.recent.unshift({ rank: place, total: nT, kills: p.kills, time: Math.round(p.alive || win && !p.deathTime ? G.time : p.deathTime), map: SETTINGS.map, ranked: !!G.ranked, sq: G.teamSize, party: G.net ? 1 : 0, delta: G.rankResult && !G.rankResult.placement ? G.rankResult.delta : undefined });
  STATS.recent = STATS.recent.slice(0, 5);
  G.statsSaved = saveStats();
  HUD.showResult(win, p, nT);
}

// ---------- 메인 업데이트 ----------
let lootCullT = 0;
const _sp = new THREE.Vector3();
G.update = function (dt) {
  G.time += dt;
  const p = G.player;
  // 메뉴 토글 (모달이 열려 있어도 처리)
  if (Input.consume('pause')) { if (!$('mapPanel').hidden) HUD.closeMap(); else if (!$('invPanel').hidden) HUD.closeInv(); else G.pause(true); }
  if (Input.consume('map')) { $('mapPanel').hidden ? HUD.openMap() : HUD.closeMap(); }
  if (Input.consume('inventory')) { $('invPanel').hidden ? HUD.openInv() : HUD.closeInv(); }
  if (G.previewT > 0) { G.previewT -= dt; if (G.previewT <= 0 || $('mapPanel').hidden) { G.previewT = 0; HUD.closeMap(); } }
  // 수송기
  const pl = G.plane;
  if (pl && pl.active && G.previewT <= 0) {
    pl.t += dt; const d = pl.t * pl.speed;
    pl.pos.set(pl.ax + pl.dx * d, pl.alt, pl.az + pl.dz * d); pl.mesh.position.copy(pl.pos);
    for (const pr of pl.mesh.userData.props) pr.rotation.z += dt * 30;
    const left = CHARS.filter(c => c.mode === 'plane');
    for (const c of left) {
      c.pos.copy(pl.pos);
      if (!c.isPlayer && c.brain && pl.t >= c.brain.jumpAt && overIsland(pl.pos.x, pl.pos.z)) jumpOut(c);
    }
    // 섬을 벗어나기 직전 강제 강하
    const ahead = d + 60;
    if (!overIsland(pl.ax + pl.dx * ahead, pl.az + pl.dz * ahead) && d > pl.len * 0.5) for (const c of left) { if (!Net.mine(c)) continue; if (c.isPlayer) HUD.toast('수송기가 섬을 벗어나 자동 강하합니다', 'warn'); jumpOut(c); }
    if (d > pl.len) { pl.active = false; pl.mesh.visible = false; Audio.plane(false); }
  }
  // 플레이어
  if (p && p.alive && !G.over) {
    const modal = HUD.modalOpen();
    if (p.mode === 'plane') {
      if (!modal || !$('mapPanel').hidden) { p.yaw -= Input.lookX * 0.0023 * SETTINGS.lookSens; p.pitch = clamp(p.pitch - Input.lookY * 0.0023 * SETTINGS.lookSens, -1.2, 0.6); }
      Input.lookX = Input.lookY = 0;
      if (Input.consume('interact') || Input.consume('jump')) { if (G.previewT <= 0 && overIsland(pl.pos.x, pl.pos.z)) jumpOut(p); else HUD.toast(G.previewT > 0 ? '지도를 닫으면 출발합니다' : '섬 상공에서만 강하할 수 있습니다', 'warn'); }
    } else if (p.mode === 'fall' || p.mode === 'chute') {
      if (!modal) { p.yaw -= Input.lookX * 0.0023 * SETTINGS.lookSens; p.pitch = clamp(p.pitch - Input.lookY * 0.0023 * SETTINGS.lookSens, -1.3, 0.8); }
      Input.lookX = Input.lookY = 0;
      let mz = (Input.keys.KeyW ? 1 : 0) - (Input.keys.KeyS ? 1 : 0) + Input.move.z, mx = (Input.keys.KeyD ? 1 : 0) - (Input.keys.KeyA ? 1 : 0) + Input.move.x;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
      let sx = fx * Math.max(0, mz) + rx * mx, sz = fz * Math.max(0, mz) + rz * mx; const sl = Math.hypot(sx, sz); if (sl > 1) { sx /= sl; sz /= sl; }
      if ((Input.consume('interact') || Input.consume('jump')) && p.mode === 'fall' && G.time - p.jumpT > 1) openChute(p);
      updateDrop(p, dt, sx, sz, clamp(mz, -1, 1));
      Audio.wind(p.mode === 'fall' ? 1 : 0.35);
    } else if (!modal) { if (p.veh) updateDriving(dt); else updatePlayer(dt); }
    else { Input.lookX = Input.lookY = 0; if (p.veh) { p.veh.ctrl.throttle = 0; p.veh.ctrl.steer = 0; } else stepPhysics(p, dt, 0, 0, 0, false); }
  }
  // 봇 (대형 맵: 카메라에서 600m 밖의 봇은 두 프레임에 한 번, 누적 dt로 갱신 — 봇마다 번갈아 부하 분산)
  G.frame = (G.frame || 0) + 1;
  const camP = G.camera.position;
  for (const c of CHARS) {
    if (c.net && !c.net.mine) { Net.updateProxy(c, dt); continue; } // 다른 기기가 움직이는 캐릭터: 받은 상태 보간
    if (c.isPlayer || !c.alive) continue;
    const b = c.brain; if (!b) continue;
    if (c.mode === 'fall' || c.mode === 'chute') {
      if (b.followJump && p) { // 플레이어를 따라 강하
        b.dropTarget.x = p.pos.x + b.followOff[0]; b.dropTarget.z = p.pos.z + b.followOff[1];
        if (c.mode === 'fall' && p.mode !== 'fall' && G.time - c.jumpT > 1) openChute(c);
      }
      const dx = b.dropTarget.x - c.pos.x, dz = b.dropTarget.z - c.pos.z, L = Math.hypot(dx, dz);
      const sx = L > 3 ? dx / L : 0, sz = L > 3 ? dz / L : 0;
      c.yaw = Math.atan2(sx || 0.001, sz || 1);
      // 자유낙하로는 못 닿을 만큼 멀면 낙하산을 일찍 펴서 활공 (낙하산이 수평 거리/낙하 비율이 약 3배)
      if (c.mode === 'fall' && G.time - c.jumpT > 1.5 && L > (c.pos.y - Math.max(heightAt(c.pos.x, c.pos.z), WATER_Y)) * 1.05) openChute(c);
      updateDrop(c, dt, sx, sz, L > 120 ? 1 : L > 30 ? 0.5 : -0.3);
    } else if (c.mode === 'ground') {
      if (!W.big || Math.hypot(c.pos.x - camP.x, c.pos.z - camP.z) < 600) { c._lod = 0; b.update(dt); }
      else { c._lod = (c._lod || 0) + dt; if ((G.frame + c.id) % 2 === 0) { b.update(c._lod); c._lod = 0; } }
    }
  }
  PathQ.run(3);
  updateTeamOrder(); if (Input.consume('ping') || Input.pingQ.length) Input.pingQ.length = 0;
  Veh.update(dt);
  if (G.training) Training.update(dt);
  if (G.dm) DM.update(dt);
  for (const c of CHARS) {
    if (c.mode === 'plane') continue;
    if (!c.net || c.net.mine) updateCharTimers(c, dt);
    // 화면에 안 보이는 캐릭터는 관절 애니메이션 생략
    if (c.isPlayer || c.root.visible) animateChar(c, dt);
    footsteps(c, dt);
  }
  separateChars();
  if (!G.training && !G.dm) { if (!G.over || G.win) Zone.update(dt); Airdrop.update(dt); }
  updateProjectiles(dt); FX.update(dt);
  if (G.noises.length > 80 || (G.noises.length && G.time - G.noises[0].t > 2)) G.noises = G.noises.filter(n => G.time - n.t < 2);
  // 거리 기반 표시 최적화
  const Q = QUALITY[SETTINGS.quality], cam = G.camera.position;
  for (const c of CHARS) if (!c.isPlayer && c.mode !== 'plane') {
    const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
    c.root.visible = d < Q.botDraw || c.mode !== 'ground' || !!c.dummy;
    c.rig.body.traverse(o => { if (o.isMesh) o.castShadow = d < 45; });
  }
  lootCullT -= dt;
  if (lootCullT <= 0) {
    lootCullT = 0.25;
    for (const it of GROUND) if (it.alive) { const d = Math.hypot(it.x - cam.x, it.z - cam.z); if (d < Q.near) itemMesh(it).visible = true; else if (it.mesh) it.mesh.visible = false; }
    // 대형 맵: 카메라 주변 지형 스트리밍 + 먼 구역 숨김
    if (W.streamTerrain) { W.streamTerrain(cam.x, cam.z, Q.far + 250, 2); W.cullChunks(cam.x, cam.z, Q.far); }
  }
  // 줍기 대상 표시 링
  const fi = p && p.alive && p.mode === 'ground' && !p.veh ? HUD.focusItem() : null;
  if (G.focusRing) { G.focusRing.visible = !!fi; if (fi) { G.focusRing.position.set(fi.x, fi.y + 0.015, fi.z); G.focusRing.material.opacity = 0.35 + Math.sin(G.time * 5) * 0.2; } }
  // 카메라 / 그림자 / 오디오 리스너
  if (p) {
    if (p.mode === 'plane' && pl) {
      const a = p.yaw, dist = 42;
      G.camera.position.set(pl.pos.x - Math.sin(a) * dist * Math.cos(p.pitch - 0.3), pl.pos.y + 12 - Math.sin(p.pitch - 0.3) * dist, pl.pos.z - Math.cos(a) * dist * Math.cos(p.pitch - 0.3));
      G.camera.lookAt(pl.pos.x, pl.pos.y, pl.pos.z); G.camera.fov = 70; G.camera.updateProjectionMatrix();
      p.root.visible = false; VM.active = false;
    } else if (!p.alive && G.spec && G.spec.alive && !G.over) {
      spectateCamera(dt, G.spec); p.root.visible = true;
      if (Input.consume('interact') || Input.consume('jump')) nextSpectate();
    } else if (!p.alive) {
      if (G.spec && !G.spec.alive && !G.over) nextSpectate();
      const a = G.time * 0.25; G.camera.position.set(p.pos.x + Math.sin(a) * 8, p.pos.y + 5, p.pos.z + Math.cos(a) * 8); G.camera.lookAt(p.pos.x, p.pos.y + 0.5, p.pos.z);
      p.root.visible = true; VM.active = false;
    } else updateCamera(dt);
    ThrowViz.update(p);
    if (G.training) Training.hud(dt);
    if (G.dm) DM.hud(dt);
    G.sky.position.copy(G.camera.position);
    const focus = p.mode === 'plane' ? pl.pos : G.viewChar().pos;
    if (G.sun) { G.sun.target.position.set(focus.x, focus.y, focus.z); G.sun.position.set(focus.x + G.sunDir.x * 150, focus.y + G.sunDir.y * 150, focus.z + G.sunDir.z * 150); }
    Audio.setListener(G.camera.position.x, G.camera.position.y, G.camera.position.z, p.yaw, p.mode === 'ground' && isIndoor(p.pos.x, p.pos.z, p.pos.y));
  }
  HUD.update(dt);
  if (G.net) Net.tick(dt);
  if (G.over) { G.endT -= dt; if (G.endT <= 0 && G.state === 'play') { if (G.dm) DM.end(); else endMatch(); } }
};
function footsteps(c, dt) {
  if (!c.alive || c.mode !== 'ground' || !c.onGround || c.veh) return;
  const sp = Math.hypot(c.vel.x, c.vel.z); if (sp < 0.8) return;
  c.anim.stepAcc += sp * dt;
  const stride = c.stance === 'prone' ? 1.2 : 1.55;
  if (c.anim.stepAcc < stride) return;
  c.anim.stepAcc = 0;
  const loud = c.stance === 'crouch' || c.stance === 'prone' ? 0.25 : sp > 5.5 ? 1.4 : 0.8;
  if (G.player && (c.isPlayer || Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 30)) {
    const s = surfaceAt(c.pos.x, c.pos.z), hard = s === 4 || s === 5 || c.pos.y - heightAt(c.pos.x, c.pos.z) > 0.1;
    Audio.step(c.pos, c.inWater ? 'water' : hard ? 'hard' : 'soft', c.isPlayer, loud);
  }
  if (loud > 0.3) G.noises.push({ x: c.pos.x, y: c.pos.y, z: c.pos.z, t: G.time, r: sp > 5.5 ? 32 : 18, by: c, kind: 'step' });
}

G.pause = function (on) {
  if (G.state !== 'play') return;
  G.paused = on; $('pausePanel').hidden = !on;
  Input.edge.clear(); Input.fire = false; Input.aim = false;
  if (on) releaseLock();
};
G.ui = function (a) {
  switch (a) {
    case 'settings': HUD.renderSettings(); $('settingsPanel').hidden = false; if (G.state === 'play') G.paused = true; break;
    case 'closeSettings': $('settingsPanel').hidden = true; HUD.renderLobby(); break;
    case 'help': $('helpPanel').hidden = false; break;
    case 'closeHelp': $('helpPanel').hidden = true; break;
    case 'resume': G.pause(false); break;
    case 'closeMap': HUD.closeMap(); break;
    case 'closeInv': HUD.closeInv(); break;
    case 'layout': Touch.openEditor(); break;
    case 'ranks': HUD.renderRanks(); $('rankPanel').hidden = false; break;
    case 'matchCfg': HUD.renderLobby(); $('matchCfgPanel').hidden = false; break;
    case 'closeMatchCfg': $('matchCfgPanel').hidden = true; HUD.renderLobby(); break;
    case 'mapPick': HUD.renderLobby(); $('mapPickPanel').hidden = false; break;
    case 'closeMapPick': $('mapPickPanel').hidden = true; HUD.renderLobby(); break;
    case 'closeRanks': $('rankPanel').hidden = true; break;
    case 'quit': $('pausePanel').hidden = true; G.paused = false;
      if (G.net && Net.isHost() && Net.othersPlaying() && !G.quitSure) { G.quitSure = true; setTimeout(() => { G.quitSure = false; }, 4000); HUD.toast('파티원이 아직 경기 중입니다 — 방장이 나가면 모두의 경기가 끝납니다. 한 번 더 누르면 나갑니다', 'warn'); $('pausePanel').hidden = false; G.paused = true; break; }
      if (G.training || G.dm) { toLobby(); break; }
      if (G.player && G.state === 'play' && !G.over) {
        // 경기 중 나가기(관전 중 포함): 지금 살아 있는 팀 수를 순위로
        const p = G.player, T = G.teams[p.team]; G.quit = true;
        if (p.alive) { p.place = CHARS.filter(c => c.alive).length; p.deathTime = G.time; p.alive = false; p.knocked = false; }
        if (!T.place) T.place = aliveTeamCount() + (teamAlive(T) ? 0 : 1);
        G.win = false; endMatch(); $('resultPanel').hidden = true;
      }
      toLobby(); break;
    case 'specNext': nextSpectate(); break;
    case 'again': if (G.net || (Party.lockInfo() && !Party.isLeader())) { toLobby(); break; } $('resultPanel').hidden = true; G.startMatch(); break;
    case 'lobby':
      if (G.net && Net.isHost() && Net.othersPlaying() && !G.quitSure) { G.quitSure = true; setTimeout(() => { G.quitSure = false; }, 4000); HUD.toast('파티원이 아직 경기 중입니다 — 한 번 더 누르면 로비로 나갑니다(파티원의 경기도 끝남)', 'warn'); break; }
      toLobby(); break;
  }
};
function toLobby() {
  if (G.net) Net.leave();
  $('resultPanel').hidden = true; $('hud').hidden = true; $('mapPanel').hidden = true; $('invPanel').hidden = true; $('pausePanel').hidden = true;
  disposeMatch(); G.state = 'lobby'; G.paused = false; G.spec = null; releaseLock();
  G.training = false; document.body.classList.remove('training');
  $('lobby').hidden = false; HUD.renderLobby(); Audio.music(true);
}
// 로비의 출격·다시 하기: 게임 종류에 따라 배틀로얄 또는 데스매치
G.startMatch = () => { if (Party.tryStart()) return; return isDmGame(SETTINGS.game) ? DM.start() : startMatch(); };
G.startMatchNet = (cfg) => startMatch(cfg);
G.applySettings = function (key) {
  const r = G.renderer, Q = QUALITY[SETTINGS.quality];
  if (key === 'quality') { const far = G.training ? Training.viewFar() : Q.far; r.setPixelRatio(Q.pr); G.onResize(); if (G.scene && G.scene.fog) { G.scene.fog.far = far; G.scene.fog.near = far * (G.training ? 0.3 : 0.25); if (G.sky) G.sky.scale.setScalar(far / (G.sky.geometry.parameters.radius / 0.92)); } G.camera.far = far + 200; G.camera.updateProjectionMatrix(); }
  if (key === 'shadows') {
    const s = SHADOW_SIZE[SETTINGS.shadows]; r.shadowMap.enabled = s > 0;
    for (const L of [G.sun, Lobby.lights && Lobby.lights.sun]) if (L) { L.castShadow = s > 0; if (s) { L.shadow.mapSize.set(s, s); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } } }
    for (const sc of [G.scene, Lobby.scene]) if (sc) sc.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  }
  if (key === 'sfx' || key === 'music') Audio.applyVolumes();
  if (key === 'view') G.firstPerson = SETTINGS.view === 'fpp';
  applyCssVars();
};
function applyCssVars() {
  const s = document.documentElement.style;
  s.setProperty('--bs', SETTINGS.btnScale); s.setProperty('--hud-s', SETTINGS.hudScale); s.setProperty('--hud-o', SETTINGS.hudOpacity);
}
function fatal(msg) { const f = $('fatal'); f.hidden = false; f.innerHTML = ''; const d = document.createElement('div'); d.innerHTML = '<p class="eyebrow">실행 오류</p>'; const p = document.createElement('p'); p.textContent = msg; d.appendChild(p); const b = document.createElement('button'); b.className = 'btn'; b.textContent = '새로고침'; b.onclick = () => location.reload(); d.appendChild(b); f.appendChild(d); }

// ---------- 루프 ----------
let _last = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const t = performance.now(); let dt = (t - _last) / 1000; _last = t; dt = Math.min(dt, 0.05);
  try {
    if (G.state === 'lobby' || G.state === 'loading') { Lobby.update(dt); G.renderer.render(Lobby.scene, Lobby.cam); Models.pump(5); }
    else if (G.scene) {
      if ((!G.paused || G.net) && G.state === 'play') G.update(dt * G.timeScale); // 같이 하기는 메뉴를 열어도 멈추지 않는다
      else if (G.state === 'result' && G.player) { VM.active = false; const a = performance.now() / 4000; G.camera.position.set(G.player.pos.x + Math.sin(a) * 10, G.player.pos.y + 6, G.player.pos.z + Math.cos(a) * 10); G.camera.lookAt(G.player.pos); }
      G.renderer.render(G.scene, G.camera);
      if (G.state === 'play') renderViewModel();
      Models.pump(2);
    }
  } catch (e) { console.error(e); if (!G._errShown) { G._errShown = true; HUD.toast('오류: ' + e.message, 'warn'); } }
}

function boot() {
  if (typeof THREE === 'undefined') { fatal('3D 라이브러리(three.js)를 불러오지 못했습니다. 네트워크 연결을 확인하세요.'); return; }
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) { fatal('이 브라우저/기기에서 WebGL을 사용할 수 없습니다.'); return; }
  if (IS_TOUCH) document.body.classList.add('touch');
  applyCssVars();
  initRenderer();
  Models.init(G.renderer);
  buildViewModel();
  Lobby.init();
  setupInput($('gl'));
  setupTouch($('touch'));
  HUD.setupLobby(); Training.setupLobby(); Social.setup(); Cloud.setup(); Cloud.init();
  $('rotateDismiss').addEventListener('click', () => { G.rotateDismissed = true; $('rotateHint').hidden = true; });
  G.onResize();
  document.addEventListener('pointerdown', () => { Audio.init(); if (G.state === 'lobby') Audio.music(true); }, { once: true });
  loop();
  // 인벤토리 사진(아이콘)은 글꼴이 준비된 뒤 로비에서 조금씩 미리 렌더
  const warm = () => Models.prewarm();
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(warm); else setTimeout(warm, 500);
  // 테스트/디버그용 핸들
  window.__gh = (x, z) => groundAt(x, z, 999); window.__spawn = (id, x, z) => { const d = ITEMS[id]; return spawnItem(G.scene, id, d.type === 'ammo' ? d.stack : 1, x, groundAt(x, z, 999), z, d.type === 'weapon' ? newWeapon(id, d.mag) : (d.dur ? { id, dur: d.dur } : (d.type === 'bag' ? { id } : null))); }; window.__LD = { playerPing, setTeamOrder, startRevive, cancelRevive, nearestKnockedMate, knockChar, killChar, Models, VehModels, Veh, VEH_TYPES, VM, Cam, Touch, TOUCH_BTNS, Audio, Brain, PathQ, Airdrop, Rank, RANK_TIERS, get Training() { return Training; }, get Cloud() { return Cloud; }, get DM() { return DM; }, get Net() { return Net; }, get Party() { return Party; }, get Social() { return Social; }, fns: { vaultPlan, startVault, enterThrow, exitThrow, ThrowViz, useConsumable, doPickup, pickupItem, get PROJ() { return PROJ; }, FUSE, losClear, rayBoxes, rayTerrain, stepPhysics, animateChar, raycastAll, updateCharTimers, separateChars, footsteps, attFits, newWeapon, startReload, fireWeapon, fireMode, cycleFireMode, applyDamage, weaponAnim, itemsNear, get GROUND() { return GROUND; }, heightAt, groundAt }, G, get CHARS() { return CHARS; }, get W() { return W; }, Zone, Nav, ITEMS, Input, HUD,
    setXp(x) { STATS.xp = x; saveStats(); HUD.renderLobby(); }, get stats() { return STATS; },
    sim(n, dt = 1 / 30) { for (let i = 0; i < n && G.state === 'play'; i++) G.update(dt); },
    states() { const s = {}; for (const c of CHARS) if (c.brain) s[c.brain.state] = (s[c.brain.state] || 0) + 1; return s; } };
}
boot();
