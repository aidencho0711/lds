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
  '듀오·스쿼드에서 팀원이 탈락하면 리콜 카드가 떨어집니다. 주워서 지도의 리콜 타워(하늘색 삼각형)에서 8초 등록하면 수송기로 돌아옵니다.',
];

const G = {
  state: 'lobby', paused: false, time: 0, noises: [], player: null, plane: null, marker: null,
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
    Lobby.cam.aspect = w / h; Lobby.cam.updateProjectionMatrix(); Cutscene.resize(w, h);
    $('rotateHint').hidden = !(IS_TOUCH && h > w && !G.rotateDismissed);
    if (!$('mapPanel').hidden) HUD.drawBig();
  };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  G.onResize = onResize;
  GLX.init(r);
}
// ---------- v23 화면(WebGL) 끊김 · 복구 ----------
//  휴대폰은 앱을 바꾸거나 메모리가 모자라면 GL 컨텍스트를 버린다 — 예전엔 안내 없이 화면이 멈췄고, 돌아와도 금속 반사(환경맵)가 까맣게 · 끊긴 사이 그린 아이콘은 빈 그림으로 남았다
//  · 끊김(webglcontextlost): 기본 동작을 막아 복구를 허용하고(three r128 도 막음) 그리기를 멈춘 뒤 '화면을 다시 불러오는 중…'
//    혼자 하는 경기는 그동안 멈춘다(보이지 않는 사이 죽지 않게) · 같이 하기는 경기만 계속 돌린다(다른 사람 화면이 멈추지 않게)
//  · 복구(webglcontextrestored): three 가 GL 상태를 새로 만들고 텍스처·버퍼·셰이더는 CPU 에 남은 것으로 다시 올린다 (그림자 설정도 three 가 지킴)
//    (GPU 에만 있던 환경맵은 05_models.js 가 CPU 사본으로 · 읽는 중이던 아이콘은 다시 줄에) → 한 장 그려 본 뒤 안내를 닫음
//  · 화면이 보이는 채로 5초 안에 돌아오지 않거나 복구한 뒤 그리지 못하면 '새로고침' — 경기 중이면 이어하기 저장(10_resume.js)부터
//  · WebGL 컨텍스트는 이 렌더러 하나 — 로비·상자 컷신·총기 스킨·입장 연출은 모두 이것으로 그리고, 티어 컷신·지도는 2D 캔버스, 관전은 영상
//    (친구 관전 영상 · 티어 승급 컷신을 보는 동안은 안내로 가리지 않는다)
const GLX = {
  lost: false, bad: false, t: 0, iv: 0, gl: null, cv2: null, cvLost: false, cvTrust: false, rfx: false,   // bad: 복구했는데 그리지 못함 · t: 끊긴(또는 다시 보이기 시작한) 시각 · cv2·cvLost·cvTrust: 2D 캔버스 확인 (아래 pad) · rfx: 안내 때 본 티어 컷신
  init(r) {
    const cv = r.domElement; this.gl = r.getContext();
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.down(); }, false);
    cv.addEventListener('webglcontextrestored', () => this.up(), false);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.t = performance.now(); if (this.lost) this.show(); });   // 5초는 다시 보일 때부터 센다
    $('glReload').addEventListener('click', () => this.reload());
    try { this.cvTrust = this.mag(this.pad(4)); this.watch2d(); } catch (e) { console.warn(e); }
  },
  // 2D 캔버스도 지워졌는가 — 진짜 GPU 프로세스 오류(메모리 부족·응답 없음)는 WebGL 뿐 아니라 가속 2D 캔버스(CanvasTexture 원본·지도 바탕)까지 비운다
  //  → 복구는 되는데 three 가 빈 원본을 다시 올려 글자·무늬·집 외벽이 까맣게 된다 (WEBGL_lose_context 시험으로는 보이지 않음)
  //  자홍색으로 칠한 256×256 캔버스(텍스처 원본과 같은 크기대 — 128×129 보다 작으면 브라우저가 가속하지 않음)가 contextlost 를 받았거나
  //  복구 때 읽은 값이 자홍색이 아니면 그리지 않고 새로고침 안내(이어하기 저장) · 한 캔버스는 한 번만 읽는다 (여러 번 읽으면 Chrome 이 CPU 캔버스로 바꿔 확인이 안 됨)
  //  처음에 작은 캔버스로 읽어 보아 읽기를 막거나 바꾸는 브라우저(개인정보 보호)면 읽기로는 판단하지 않고 이벤트로만 (cvTrust)
  pad(n) { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, n, n); return c; },
  mag(c) { try { const d = c.getContext('2d').getImageData(0, 0, 1, 1).data; return d[0] > 200 && d[1] < 60 && d[2] > 200 && d[3] > 200; } catch (e) { return false; } },
  watch2d() { const c = this.pad(256); c.addEventListener('contextlost', () => { if (c === this.cv2) this.cvLost = true; }); this.cv2 = c; },
  cvGone() { return this.cvLost || (this.cvTrust && !!this.cv2 && !this.mag(this.cv2)); },
  // 이번 프레임에 그리면 안 되는가 (이벤트가 오기 전에도 GL 에 직접 물어본다 — 끊긴 GL 에 셰이더를 만들면 three 가 오류)
  //  끊긴 동안 티어 승급 컷신이 시작·끝나면 그 프레임에 안내를 감추거나 다시 덮는다 (1초 간격을 기다리지 않게 — show 가 rfx 를 적음)
  off() { if (!this.lost && this.gl && this.gl.isContextLost()) this.down(); else if (this.lost && RankFx.active !== this.rfx) this.show(); return this.lost; },
  down() {
    if (this.lost) return; this.lost = true; this.bad = false; this.t = performance.now();
    try { Models.glLost(); } catch (e) { console.warn(e); }
    clearInterval(this.iv); this.iv = setInterval(() => this.show(), 1000); this.show();
  },
  up() {
    if (!this.lost) return; this.lost = false; this.bad = this.cvGone();   // 2D 캔버스까지 지워졌으면 그리지 않고 바로 새로고침 안내 · 아니면 앞서 그리지 못했어도 이번 복구로 다시 해 본다
    if (!this.bad) try { G.onResize(); drawNow(); } catch (e) { console.warn('화면 복구 실패', e); this.bad = true; }   // 바로 한 장 그림 — 셰이더를 다시 만드는 동안은 안내가 덮고 있게
    if (this.gl.isContextLost()) { this.down(); return; }   // 그새 다시 끊김: 다시 기다림
    if (this.bad) { this.lost = true; this.show(); return; }   // 그리지 못함: 새로고침 안내 (그리기는 계속 멈춤)
    clearInterval(this.iv); this.show();
    try { this.watch2d(); this.refill(); } catch (e) { console.warn(e); }   // 다음 확인용 새 캔버스 · 끊긴 사이 빈칸이 된 그림 다시
  },
  // 끊긴 동안 바로 그리려다 빈칸이 된 그림 — 줄(img[data-th] · Shop.pump)을 거치지 않는 상점 상자·차량, 창고 차량 그림 (열려 있는 화면만 다시 그림)
  refill() {
    if (G.state !== 'lobby') return;
    const vis = (p) => { const e = document.querySelector(`[data-pane=${p}]`); return !!e && !e.hidden; };
    if (vis('shop')) Shop.render();
    if (vis('custom')) HUD.renderWarehouse();
  },
  // 안내 (끊긴 동안 1초마다): 기다리는 중 → 보이는 채로 5초가 지나거나 복구 뒤 그리지 못하면 새로고침 버튼
  //  친구 관전 영상 · 티어 승급 컷신(2D 캔버스 — 10_rankfx.js)은 GL 없이 보이므로 가리지 않는다 (컷신이 시작·끝나는 프레임에 off 가 다시 부름)
  show() {
    const el = $('glLost'), fail = this.lost && (this.bad || (!document.hidden && performance.now() - this.t > 5000));
    this.rfx = RankFx.active; el.hidden = !this.lost || Watch.viewing() || this.rfx;
    if (el.hidden) return;
    el.classList.toggle('fail', fail); $('glReload').hidden = !fail;
    $('glLostT').textContent = fail ? '화면을 다시 불러오지 못했습니다' : '화면을 다시 불러오는 중…';
    // 이어하기를 약속하는 것은 실제로 저장하는 경기일 때만 (10_resume.js can · 끝난 경기(G.over)는 새로고침하면 결과만 기록됨)
    $('glLostMsg').textContent = fail ? '새로고침하면 다시 그립니다.' + (Resume.can() && !G.over ? ' 진행 중이던 경기는 새로고침한 뒤 이어서 할 수 있습니다.' : '') : '그래픽(WebGL) 연결이 잠시 끊겼습니다. 곧 이어서 그립니다.';
    if (fail) releaseLock();   // PC: 마우스 잠금을 풀어 버튼을 누를 수 있게
  },
  reload() { try { Resume.save(); } catch (e) { console.warn(e); } location.reload(); },   // 경기 상태를 먼저 저장 (pagehide 에서도 저장하지만 확실히)
};
// 지금 화면을 한 장 그림 (GL 복구 직후 — GLX.up)
function drawNow() {
  const r = G.renderer;
  if (G.state === 'lobby' || G.state === 'loading') { if (Cutscene.active) Cutscene.render(r); else if (!Watch.viewing()) r.render(Lobby.scene, Lobby.cam); }
  else if (G.scene) { r.render(G.scene, G.camera); if (G.state === 'play') renderViewModel(); }
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
    const s = sun.shadow.camera, hw = SHADOW_HALF(shadowSize); s.left = s.bottom = -hw; s.right = s.top = hw; s.near = 1; s.far = 320;
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
      this.motoProp = () => { if (this.moto) sc.remove(this.moto.root); const m = this.moto = VehModels.instance('moto', Eco.vlook().moto); m.root.position.set(3.0, 0, -3.0); m.root.rotation.y = -0.75; m.root.rotation.z = 0.12; sc.add(m.root); };
      this.motoProp(); Eco.on((w) => { if (w === 'vequip') this.motoProp(); if (w === 'gequip') this.setGun(true); });
    } catch (e) { console.warn('로비 차량 생략', e); }
    const posts = []; for (let i = 0; i < 11; i++) { add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), 0x777777, -15 + i * 3, 1.2, -11); posts.push([-15 + i * 3, 2.38, -11]); }
    const tg = new THREE.ConeGeometry(1.6, 5, 7), trees = []; for (let i = 0; i < 22; i++) { const a = -Math.PI * 0.95 + i / 21 * Math.PI * 0.9, r = 24 + Math.random() * 12; add(tg, 0x2e4a2a, Math.cos(a) * r, 2.5, Math.sin(a) * r); trees.push([Math.cos(a) * r, Math.sin(a) * r]); }
    // 겨울(11/15~2/15): 눈 덮인 기지 · 내리는 눈 · 장식 트리 · 눈사람 · 전구 줄 (10_winter.js)
    try { this.winter = WINTER.on() ? WinterLobby.build(sc, { ground, trees, posts }) : null; } catch (e) { console.warn('겨울 로비 생략', e); this.winter = null; }
    this.setLook(SETTINGS.look);
    this.mates = []; this.setTeam(1);
  },
  // 듀오·스쿼드: 캐릭터 옆에 팀원을 세워 둔다 (오른쪽·뒤 — 왼쪽 패널에 가리지 않게)
  // looks: 파티원 외형 {eq, body, gun, sg} (있으면 그 외형으로, 없으면 기본 옷 + 무작위 얼굴)
  //  파티원은 자기가 로비에서 들고 있는 총(sg)을 장착한 스킨으로 든다 — 울트라레어면 빛 띠·부속품과 함께 나타남
  // infos: 파티원 [{uid, name, pf, ent}] — 캐릭터 아래 이름·칭호 표시용 (10_ui_profile.js lobbyTags). 프로필만 바뀌면 캐릭터는 다시 만들지 않는다
  //  v23 파티 입장·퇴장 연출(10_partyfx.js): 들어온 사람은 그 자리에서 등장, 나간 사람의 리그는 넘겨서 퇴장 동작 뒤 치움 · 파티원 자리는 uid 마다 고정
  setTeam(n, looks, infos) {
    this.mateInfo = infos || [];
    const FX = typeof PartyFx !== 'undefined' ? PartyFx : null, gone = FX ? FX.team(this, infos) : null;
    const key = n + '|' + (infos || []).map((f) => (f && f.uid) || '').join(',') + '|' + (looks ? JSON.stringify(looks.map((l) => Object.assign({}, l, { pf: undefined }))) : '');
    if (this.teamN === key) { if (FX) FX.bound(this); return; } this.teamN = key;
    for (const m of this.mates) { if (!(gone && m.uid && FX.ghost(this, m, gone.get(m.uid)))) { this.scene.remove(m.root); m.skel.dispose(); } }
    this.mates = [];
    const spots = [[1.3, -0.5, -0.25], [2.45, -1.25, -0.45], [-1.05, -1.55, 0.35]], rng = mulberry32(4242);
    for (let i = 0; i < n - 1 && i < spots.length; i++) {
      const uid = (infos && infos[i] && infos[i].uid) || null, si = FX ? FX.spot(uid, i, spots.length) : i;
      const pl = looks && looks[i], body = Body.randomBody(rng), rig = buildRig(pl ? Body.makeLook(pl.eq, pl.body) : Body.makeLook(null, body));
      const gid = pl && pl.sg && ITEMS[pl.sg] && ITEMS[pl.sg].type === 'weapon' ? pl.sg : (['akm', 'aug', 'mini14'][i] || 'm416');
      const sk = pl && pl.gun && pl.gun[gid] && typeof GSKINS !== 'undefined' && GSKINS[pl.gun[gid]] && GSKINS[pl.gun[gid]].gun === gid ? pl.gun[gid] : null, att = {};
      if (pl && pl.sg) { for (const s of ['x2', 'reddot']) if (attFits(s, gid)) { att.scope = s; break; } } else att.scope = i === 2 ? 'x4' : 'reddot';
      rig.gunObj = buildGunMesh(gid, att, sk); rig.gunMount.add(rig.gunObj); rig.matesSkin = sk;
      if (sk) GunSkin.draw(rig.gunObj, 0.55, null, true);
      { const E = pl ? Body.normEquip(pl.eq) : {}; rig.setGear(E.helmet ? 3 : E.hat ? 0 : 2, i === 1 ? 0 : 2, E.pack || i === 2 ? 3 : 2); }   // v23 헬멧·가방 스킨이 있으면 3레벨로 보여 줌
      // 가운데 받침(반지름 2.2 · 높이 0.2) 위 자리는 받침 윗면에 세운다 (예전엔 발이 받침 속 20cm 에 묻혔음)
      const pd = Math.hypot(spots[si][0], spots[si][1]), py = pd < 2.2 ? 0.2 : Math.max(0, 2.4 - pd);
      rig.root.position.set(spots[si][0], py, spots[si][1]); rig.baseYaw = spots[si][2]; rig.ph = si * 1.7 + 0.6; rig.uid = uid;
      this.scene.add(rig.root); this.mates.push(rig);
    }
    if (FX) FX.bound(this);
  },
  pose(r, t, yaw) { poseLobby(r, t, yaw); },
  applyTime() {
    const sc = this.scene, t = TIMES[SETTINGS.time] || TIMES.day;
    if (this.lights) { sc.remove(this.lights.hemi); sc.remove(this.lights.sun); }
    if (this.sky) sc.remove(this.sky);
    this.sky = skyDome(t, 300); sc.add(this.sky);
    sc.fog = new THREE.Fog(t.fog, 26, 120);
    if (WINTER.on()) sc.fog.color.lerp(new THREE.Color(WINTER.fog), 0.45);   // 겨울: 차갑고 뿌연 공기
    this.lights = addLights(sc, t, SHADOW_SIZE[SETTINGS.shadows] ? 1024 : 0);
    this.lights.sun.shadow.camera.left = this.lights.sun.shadow.camera.bottom = -12; this.lights.sun.shadow.camera.right = this.lights.sun.shadow.camera.top = 12;
  },
  // 장착 스킨(eq)으로 가운데 캐릭터를 다시 만든다
  setLook(eq) {
    if (this.rig) { this.scene.remove(this.rig.root); this.rig.skel.dispose(); }
    const rig = buildRig(Body.makeLook(eq, SETTINGS.body)); this.rig = rig; this.scene.add(rig.root);
    this.setGun(false);
    // 헬멧: 헬멧 스킨이 있으면 3레벨(모자는 숨김), 모자만 있으면 맨머리에 모자 · 가방: 가방 스킨이 있으면 3레벨 (v23)
    const E = Body.normEquip(eq); this.gear = [E.helmet ? 3 : E.hat ? 0 : 2, 2, E.pack ? 3 : 2]; rig.setGear(this.gear[0], this.gear[1], this.gear[2]);
    rig.root.position.set(0, 0.2, 0);
  },
  // 가운데 캐릭터가 드는 총: 마지막으로 스킨을 바꾼 총(+그 스킨). 바꾸면 울트라레어는 빛 띠와 함께 나타남
  setGun(fx) {
    const r = this.rig; if (!r) return;
    if (r.gunObj) r.gunMount.remove(r.gunObj);
    const id = Eco.showGun(), sk = Eco.glook()[id] || null, att = {};
    for (const s of ['x2', 'reddot']) if (attFits(s, id)) { att.scope = s; break; }
    if (attFits('comp', id)) att.muzzle = 'comp';
    r.gunObj = buildGunMesh(id, att, sk); r.gunMount.add(r.gunObj);
    if (fx && sk) GunSkin.draw(r.gunObj, 0.55, null);
  },
  // 상점·창고 진열: 받침대 위에 상자나 차량을 올려 천천히 돌린다 (캐릭터는 숨김). spec: null | {kind:'crate', box} | {kind:'veh', type, skin} | {kind:'gun', gun, skin}
  show(spec) {
    const key = spec ? JSON.stringify(spec) : '';
    if (this.scKey === key) return; this.scKey = key;
    if (this.sc) { this.scene.remove(this.sc.obj); this.sc = null; }
    if (!spec) return;
    let obj, size;
    let gun = null;
    if (spec.kind === 'crate') { this.crates = this.crates || {}; obj = (this.crates[spec.box] = this.crates[spec.box] || Shop.crate(spec.box)).root; obj.scale.setScalar(1.1); size = 1.9; }
    else if (spec.kind === 'gun') {
      // 총: 가운데를 축으로 돌도록 감싸서 받침대 위에 띄움
      gun = buildGunMesh(spec.gun, {}, spec.skin || null); const bb = new THREE.Box3().setFromObject(gun), c = bb.getCenter(new THREE.Vector3());
      gun.position.sub(c); obj = new THREE.Group(); obj.add(gun); obj.scale.setScalar(2.4); size = Math.max(1.5, (bb.max.z - bb.min.z) * 2.6);
    }
    else if (spec.kind === 'melee') {
      // v23 근접 무기(스킨이면 그 모양): 총처럼 가운데를 축으로 돌도록 감싸 받침대 위에 띄움
      const m = MeleeSkin.model(spec.melee, spec.skin || null), bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3());
      m.position.sub(c); obj = new THREE.Group(); obj.add(m); obj.scale.setScalar(2.6); size = Math.max(1.5, Math.max(bb.max.z - bb.min.z, bb.max.y - bb.min.y) * 2.8);
    }
    else { const VP = VehModels.instance(spec.type, spec.skin || null); obj = VP.root; size = spec.type === 'sedan' ? 5.5 : spec.type === 'uaz' ? 6.2 : spec.type === 'pickup' ? 7.0 : spec.type === 'moto' ? 2.4 : 2.9; if (VP.fx) { VehFx.attach(VP); obj.userData.efxP = VP; } }   // 엡실론 차량: 시동이 걸린 채 진열
    obj.position.set(0, spec.kind === 'gun' || spec.kind === 'melee' ? 1.05 : 0.2, 0); obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(obj); this.sc = { obj, size, t0: this.t, kind: spec.kind };
    if (gun && spec.skin) { GunSkin.draw(gun, 0.8, null); GunSkin.inspect(gun, null, 1.4, 5.5); }   // 테스터 스킨: 진열장에서 살펴보기 연출을 몇 초마다
  },
  update(dt) {
    this.t += dt; const r = this.rig, t = this.t;
    if (this.winter) this.winter.update(dt, t);   // 눈 · 전구 · 별
    // 진열 중: 캐릭터·팀원 숨기고 진열품을 화면 오른쪽에 크게 (왼쪽은 상점 창)
    const sc = this.sc; r.root.visible = !sc; if (this.moto) this.moto.root.visible = !sc;
    if (typeof Prof !== 'undefined') Prof.lobbyTags(this);   // 캐릭터 아래 칭호 (지난 프레임 카메라 기준 — 카메라는 천천히 움직임)
    if (sc) {
      for (const m of this.mates) m.root.visible = false;
      if (typeof PartyFx !== 'undefined') PartyFx.update(dt, this);   // 진열 중에는 입장·퇴장 연출을 모두 멈추고 치움
      sc.obj.rotation.y = 0.7 + (t - sc.t0) * 0.32; if (sc.obj.userData.efxP) VehFx.showroom(sc.obj.userData.efxP, dt);
      // 왼쪽 창이 가리지 않는 영역의 가운데에 오도록 카메라를 옆으로 민다 (창 오른쪽 끝은 0.5초마다 다시 잼)
      if (!(sc.fracT > t)) { const P = document.querySelector('.lb-left'), rr = P ? P.getBoundingClientRect().right : 0; sc.frac = clamp(rr / Math.max(1, window.innerWidth), 0, 0.7); sc.fracT = t + 0.5; }
      const s = sc.size, dist = 1.45 * s + 1.4, xs = Math.min(0.82, sc.frac + (1 - sc.frac) * 0.5), tanH = Math.tan(this.cam.fov * Math.PI / 360) * this.cam.aspect;
      const off = (2 * xs - 1) * tanH * dist;
      this.cam.position.set(-off + 0.25 * s, 0.5 * s + 0.75, dist); this.cam.lookAt(-off, 0.2 * s + 0.35, 0);
      return;
    }
    // 창고(옷 보기): 조끼·가방·헬멧을 벗겨 옷이 보이게 — v23 헬멧·가방 탭이면 고른 레벨의 그 장비만 (가방은 등이 보이게 돌림, 헬멧은 머리 가까이)
    const gv = this.focus ? this.gearView : null;
    const g = this.focus ? (gv ? (gv.k === 'helmet' ? [gv.lv, 0, 0] : [0, 0, gv.lv]) : [0, 0, 0]) : (this.gear || [2, 2, 2]); r.setGear(g[0], g[1], g[2]);
    // 창고 탭: 카메라를 캐릭터 가까이(오른쪽에 크게), 캐릭터는 천천히 돌며 옷을 보여 줌
    this.fk = lerp(this.fk || 0, this.focus ? 1 : 0, clamp(dt * 4, 0, 1));
    this.bk = lerp(this.bk || 0, gv && gv.k === 'pack' ? 1 : 0, clamp(dt * 3, 0, 1)); this.hk = lerp(this.hk || 0, gv && gv.k === 'helmet' ? 1 : 0, clamp(dt * 3, 0, 1));
    const yaw = lerp(0.35 + Math.sin(t * 0.25) * 0.15, 0.25 + Math.sin(t * 0.32) * 0.65, this.fk) + this.bk * Math.PI * 0.85;
    this.pose(r, t, yaw); OutfitFx.update(r, dt);   // EXCLUSIVE 옷 효과 (08_outfitfx.js)
    for (const m of this.mates) { m.root.visible = this.fk < 0.5; if (m.root.visible) { this.pose(m, t + m.ph, m.baseYaw + Math.sin((t + m.ph) * 0.21) * 0.12); OutfitFx.update(m, dt); } }
    if (typeof PartyFx !== 'undefined') PartyFx.update(dt, this);   // 파티 입장·퇴장 연출: 쉬는 자세 위에 동작을 덮어 쓰고 효과를 진행 (10_partyfx.js)
    // 캐릭터를 화면 가운데에 (왼쪽 패널은 배경 위에 겹친다)
    const a = t * 0.08, f = smoothstep01(this.fk), hk = smoothstep01(this.hk || 0);
    this.cam.position.set(lerp(Math.sin(a) * 0.5 + 0.2, lerp(-0.55, -0.3, hk), f), lerp(1.45 + Math.sin(t * 0.3) * 0.05, lerp(1.32, 1.72, hk), f), lerp(4.9 + Math.cos(a) * 0.2, lerp(3.05, 1.6, hk), f));
    this.cam.lookAt(lerp(0.05, lerp(-0.62, -0.34, hk), f), lerp(1.02, lerp(1.05, 1.64, hk), f), 0);
    if (typeof PartyFx !== 'undefined') PartyFx.cam(this.cam, dt);   // 착지 충격 흔들림
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
  const pl = { ax: px - dx * L, az: pz - dz * L, bx: px + dx * L, bz: pz + dz * L, dx, dz, t: 0, len: L * 2, speed: PC.speed, alt: PC.alt, active: true, pos: new THREE.Vector3(), mesh: buildPlane(),
    a, offN: PC.off ? off / PC.off : 0 };   // 경로(각도·옆 이동 비율) — 이어하기가 같은 경로로 다시 만든다 (10_resume.js)
  pl.pos.set(pl.ax, pl.alt, pl.az); pl.mesh.position.copy(pl.pos); pl.mesh.rotation.y = Math.atan2(dx, dz);
  scene.add(pl.mesh);
  G.plane = pl;
}
// 섬 위 판정. 대형 맵은 해안선이 지도 가장자리보다 훨씬 안쪽이라 해안 기준으로 본다
function overIsland(x, z) {
  if (W && W.big) return Math.max(Math.abs(x), Math.abs(z)) * 0.65 + Math.hypot(x, z) * 0.35 < HALF * 0.84;
  return Math.abs(x) < HALF - 25 && Math.abs(z) < HALF - 25;
}
// 캐릭터가 탄 수송기: 리콜로 복귀하는 중이면 리콜 수송기(08_recall.js), 아니면 경기 시작 수송기
const planeOf = (c) => (c && c.rplane) || G.plane;
function jumpOut(c) {
  if (c.mode !== 'plane') return;
  const pl = planeOf(c);
  c.mode = 'fall'; c.pos.set(pl.pos.x + rnd(-2, 2), pl.pos.y - 3, pl.pos.z + rnd(-2, 2));
  c.vel.set(pl.dx * 14, -5, pl.dz * 14); c.root.visible = true; c.jumpT = G.time; c.rplane = null;
  if (c.isPlayer) { Audio.plane(false); HUD.toast('강하! W로 하강 속도를 높이고, F로 낙하산을 펼치세요', 'info'); mateJump(c, pl); }
}
// 사람의 팀원 봇: 그 사람을 따라 0.3~1.4초 뒤에 뛰어내린다 (같은 수송기에 탄 팀원만)
//  방장 기기에서는 다른 기기 사람(온라인 매칭·파티)이 뛰어내릴 때도 (10_net.js applyChar)
function mateJump(c, pl) {
  pl = pl || planeOf(c); if (!pl) return;
  let k = 0; for (const m of teamMembers(c)) if (m !== c && m.mode === 'plane' && m.brain && planeOf(m) === pl) m.brain.jumpAt = pl.t + 0.3 + 0.35 * k++;
}
G.mateJump = (c) => mateJump(c);
// 봇 강하 계획 (방장을 넘겨받은 기기가 수송기·스타트 섬에 있는 봇을 맡을 때 — 10_net.js adopt)
//  팀의 사람이 아직 수송기에 있으면 그 사람을 따라 뛰고, 아니면 지역을 골라 그 위에서 뜀
function planDrop(br, mate) {
  const pl = G.plane; if (!pl) return;
  if (mate && (mate.mode === 'plane' || G.island)) {
    br.followJump = true; br.followC = mate; br.jumpAt = Infinity; br.chuteH = 95; br.dropTarget = { x: 0, z: 0 };
    const a = rnd(0, TAU); br.followOff = [Math.cos(a) * rnd(6, 11), Math.sin(a) * rnd(6, 11)]; return;
  }
  br.dropTarget = pickDropTarget(); br.chuteH = rnd(70, 140);
  const along = (br.dropTarget.x - pl.ax) * pl.dx + (br.dropTarget.z - pl.az) * pl.dz;
  br.jumpAt = Math.max(pl.t + rnd(0.5, 2.5), clamp(along - rnd(40, 110), 60, pl.len - 80) / pl.speed);
}
G.planDrop = planDrop;
// 자유낙하/낙하산 이동 (플레이어·봇 공용)
function updateDrop(c, dt, sx, sz, dive) {
  const ground = groundAt(c.pos.x, c.pos.z, c.pos.y);
  const hgt = c.pos.y - Math.max(ground, WATER_Y);
  if (c.mode === 'fall') {
    const gm = glideMul(); // 대형 맵은 활강 거리를 늘려 먼 지역까지 닿게 한다 (맵 크기 비례)
    const vy = -(34 + dive * 14), hs = (6 + dive * 16) * gm;
    c.vel.y += clamp(vy - c.vel.y, -30 * dt, 30 * dt);
    c.vel.x += clamp(sx * hs - c.vel.x, -12 * dt, 12 * dt); c.vel.z += clamp(sz * hs - c.vel.z, -12 * dt, 12 * dt);
    if (hgt < (c.isPlayer ? 95 : c.brain.chuteH)) openChute(c);
  } else if (c.mode === 'chute') {
    const vy = -(5.2 + dive * 2.2), hs = (3.5 + Math.max(0, dive) * 6.5) * glideMul();
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
// 활강 배율: 작은 맵 1 · 4km 1.5 · 8km 2.2
function glideMul() { return W && W.big ? clamp(0.8 + HALF / 2850, 1, 2.2) : 1; }
function openChute(c) { if (c.mode === 'fall') { c.mode = 'chute'; if (c.isPlayer) HUD.toast('낙하산 전개', 'info'); } }

// 봇 착지 목표: 확산되도록 POI·외곽을 섞어 선택, 지붕이 아닌 열린 땅
// 비행 경로에서의 수직 거리
function planeLat(x, z) { const pl = G.plane; return Math.abs((x - pl.ax) * -pl.dz + (z - pl.az) * pl.dx); }
// 대형 맵: 봇이 활강해서 닿을 수 있는 거리(약 400m) 안의 POI/건물만 착지 후보로 — 그 밖을 고르면 들판에 떨어져 맨손이 된다
// 8km 1100m · 4km 550m (맵 크기 비례)
const bigDropLat = () => HALF * 0.275;
function dropCands() {
  if (G.dropCands && G.dropCands.plane === G.plane) return G.dropCands;
  const pois = W.pois.filter(p => planeLat(p.x, p.z) < bigDropLat() + p.r * 0.4);
  let blds = W.buildings.filter(b => planeLat(b.x, b.z) < bigDropLat());
  // 첫 안전구역(+200m) 안 건물이 충분하면 그것만
  const nz = Zone.next, zb = nz ? blds.filter(b => Math.hypot(b.x - nz.x, b.z - nz.z) < nz.r + 200) : blds;
  if (zb.length >= 15) blds = zb;
  return (G.dropCands = { plane: G.plane, pois: pois.length ? pois : W.pois, blds: blds.length ? blds : W.buildings, taken: [] });
}
function pickDropTarget() {
  const C = W.big ? dropCands() : null;
  // 착지 분산: 한 지점에 봇이 몰리면 착지하자마자 난투로 절반이 1분 안에 죽는다 → 이미 고른 착지점이 대형 맵은 80m 안에 2곳,
  //  v23 작은 맵은 40m 안에 3곳이면 다른 곳 (교전 템포를 쓰는 일반 경기만 — 랭크전·하드코어는 예전처럼 분산 없음, 07_bot_pace.js)
  const T = C || (!Pace.live() ? null : G.dropCands && G.dropCands.plane === G.plane ? G.dropCands : (G.dropCands = { plane: G.plane, taken: [] })), tR = C ? 80 : 40, tN = C ? 2 : 3;
  for (let i = 0; i < 60; i++) {
    let x, z;
    // 대형 맵: 빈 들판에 내리면 무기를 못 찾아 맨손 싸움이 된다 → 거의 항상 마을/건물 근처
    if (W.big && Math.random() < 0.35 && C.blds.length) { const b = pick(C.blds); x = b.x + rnd(-15, 15); z = b.z + rnd(-15, 15); }
    else if (Math.random() < (W.big ? 0.95 : 0.62) && W.pois.length) {
      const P = C ? C.pois : W.pois, nz = Zone.next;
      // 대형 맵: 첫 안전구역 안/근처 지역을 선호 (먼 곳에 내리면 자기장에 쫓겨 파밍을 못 한다)
      const zw = p => { if (!W.big || !nz) return 1; const o = Math.max(0, Math.hypot(p.x - nz.x, p.z - nz.z) - nz.r) / 250; return 1 / (1 + o * o); };
      const p = weightedPick(P.map(p => [p, (p.dropW || { city: 4, military: 3, industrial: 2.4, depot: 1.6, farm: 1.4, village: 1.6 }[p.type] || 1.2) * zw(p)]));
      const a = Math.random() * TAU, d = Math.random() * (p.r + 25); x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d;
    } else { x = rnd(-HALF * 0.75, HALF * 0.75); z = rnd(-HALF * 0.75, HALF * 0.75); }
    if (W.big && i < 50 && planeLat(x, z) > bigDropLat() + 40) continue;
    if (!Nav.isFree(x, z)) continue;
    const h = heightAt(x, z); if (h < 0.8) continue;
    if (groundAt(x, z, 9999) - h > 1.0) continue; // 지붕/구조물 위 제외
    if (Math.abs(x - G.plane.ax) + Math.abs(z - G.plane.az) < 1) continue;
    if (T && i < 50) { let n = 0; for (const t of T.taken) if (Math.abs(t.x - x) < tR && Math.abs(t.z - z) < tR && ++n >= tN) break; if (n >= tN) continue; }
    if (T) T.taken.push({ x, z });
    return { x, z };
  }
  return { x: rnd(-150, 150), z: rnd(-150, 150) };
}

// ---------- 경기 ----------
// cfg: 같이 하기(파티) 경기 설정 — 없으면 혼자 · { resume }: 혼자 하던 경기를 저장한 상태로 다시 연다 (10_resume.js)
async function startMatch(cfg) {
  if (G.state === 'loading') return;
  const net = !!(cfg && G.net), rs = !net && cfg && cfg.resume ? cfg.resume : null, rj = net && G.net.rj ? G.net.rj : null;   // rj: 나갔다가 같이 하기 경기로 돌아옴
  if (!rs) Resume.fresh();   // 새 경기 — 답하지 않은 이어하기 창이 남아 있으면 그 경기는 포기로 기록
  G.state = 'loading'; G.paused = false; G.over = false; G.training = false; G.matchT = 0; G.victory = null;
  document.body.classList.remove('training'); $('quitBtn').textContent = '경기 포기 (로비로)';
  Audio.music(false);
  $('lobby').hidden = true; $('resultPanel').hidden = true; $('hud').hidden = true; $('loading').hidden = false; Shop.closeAll();
  $('loadMap').textContent = MAPS[SETTINGS.map].name; $('loadTip').textContent = pick(TIPS);
  const prog = (p, label) => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadStep').textContent = label; };
  disposeMatch();
  G.netCfg = net ? cfg : null;   // 이어하기 저장용 (창을 닫을 때 10_net.js 가 먼저 나가도 남아 있게)
  const sc = new THREE.Scene(); G.scene = sc;
  const t = TIMES[SETTINGS.time], Q = QUALITY[SETTINGS.quality];
  // 맵별 안개 (정글: 조금 가깝고 푸르게) — 하늘 지평선 색도 안개 쪽으로 맞춰 경계가 안 보이게
  const FG = MAPS[SETTINGS.map].fog, fogC = FG ? new THREE.Color(t.fog).lerp(new THREE.Color(FG.color), SETTINGS.time === 'day' ? 0.7 : 0.3).getHex() : t.fog;
  G.fogK = FG ? [FG.near, FG.far] : [0.25, 1];
  G.sky = skyDome(FG ? Object.assign({}, t, { hor: new THREE.Color(t.hor).lerp(new THREE.Color(fogC), 0.6).getHex() }) : t, Q.far * 0.92); sc.add(G.sky); sc.fog = new THREE.Fog(fogC, Q.far * G.fogK[0], Q.far * G.fogK[1]);
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
  if (net && cfg.humans && typeof Cloud !== 'undefined' && Cloud.staffAsk) Cloud.staffAsk(cfg.humans.map((hm) => hm.uid));   // v23 스타트 섬 머리 위 칭호(한 번만 그려짐): 관리자 계정이 단 칭호가 보이게, 맵을 만드는 동안 답이 오도록 미리 확인 (10_cloud.js)
  try { await generateWorld(SETTINGS.map, sc, prog); }
  catch (e) { console.error(e); fatal('맵 생성 중 오류: ' + e.message); return; }
  prog(0.97, '아이템 배치');
  // 경기 시드: 같이 하기는 방장이 정한 것, 혼자면 새로(이어하기는 저장해 둔 것) — 시드가 같으면 모든 기기에서 같은 아이템이 같은 자리에 생긴다
  //  v23: 혼자 하는 경기도 시드로 — 이어하기가 시작 아이템을 다시 만들고 바뀐 것만 저장한다 (10_resume.js)
  const ms = net ? cfg.seed : rs ? rs.seed : (Math.random() * 2147483647) | 0; G.mseed = ms;
  Net.seeded(ms + 1, () => populateLoot(sc)); Resume.mark();
  prog(0.98, '차량 배치');
  Veh.init(sc);
  if (net) Net.seeded(cfg.seed + 2, () => Veh.spawnAll()); else Veh.spawnAll();
  if (net) { Net.indexVehicles(); Net.baseline(); }
  FX.init(sc); ThrowViz.init(sc); PROJ = []; SMOKES = []; ROCKETS = []; PathQ.clear(); G.myNade = null;
  Zone.init(sc, MODES[SETTINGS.mode].zoneScale, SETTINGS.map);
  Airdrop.init(sc); Recall.init(sc);
  if (W.xmas) XmasFx.init(sc, G.camera.position); else XmasFx.dispose();   // 크리스마스 섬: 내리는 눈·전구 반짝임
  setupPlane(sc, net ? cfg.plane : rs ? rs.pl : null);   // 이어하기: 같은 비행 경로
  if (W.streamTerrain) { W.streamTerrain(G.plane.pos.x, G.plane.pos.z, Q.far + 250, 99); W.cullChunks(G.plane.pos.x, G.plane.pos.z, Q.far); }
  // 캐릭터 생성
  CHARS = []; G.noises = []; G.time = 0; G.stats = { shots: 0, hits: 0 }; G.killLog = []; G.knockLog = []; G.marker = null; G.updateMarker(); G.spec = null;
  G.teamOrder = null; G.spotted = new Map(); G.danger = null;
  G.hc = net ? !!cfg.hc : rs ? !!rs.hc : SETTINGS.queue === 'hardcore' && Rank.hcOk();   // 하드코어 랭크전 (다이아 4 이상 경험자 · 전원 익스트림 봇)
  G.ranked = net ? !!cfg.ranked : rs ? !!rs.rk : (SETTINGS.queue === 'ranked' || G.hc) && Rank.unlocked(); G.quit = false; G.rankResult = null; G.hostGone = false;
  // 팀 구성 (혼자 랭크전은 솔로 고정, 파티 랭크전은 고른 팀 구성)
  const TS = G.teamSize = net ? cfg.teamSize : rs ? rs.ts : G.ranked ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size;
  G.teams = [];
  const newTeam = (human) => { const T = { id: G.teams.length, members: [], place: 0, human: !!human }; G.teams.push(T); return T; };
  const addTo = (c, T) => { c.team = T.id; c.slot = T.members.length; T.members.push(c); return T; };
  const joinTeam = (c) => { let T = G.teams[G.teams.length - 1]; if (!T || T.members.length >= TS) T = newTeam(); return addTo(c, T); };
  // 봇 팀: 사람 팀의 빈자리부터(그 사람의 팀원) → 나머지는 차례로 새 팀. 방장·파티원 기기가 같은 순서로 정한다
  const botTeam = (b) => { const T = G.teams.find((t) => t.human && t.members.length < TS); return T ? addTo(b, T) : joinTeam(b); };
  // 사람: 혼자면 나, 파티면 파티원 전원(같은 팀, 0번부터). 온라인 매칭은 줄(파티)마다 따로 팀 — 다른 줄 사람과는 팀이 되지 않는다
  const humans = net ? cfg.humans : [{ uid: null, name: playerName(), look: myLook() }];
  let player = null; const grpT = new Map();
  humans.forEach((hm, i) => {
    const me = !net || hm.uid === Cloud.uid;
    const hl = hm.look || {}, c = new Character({ id: i, name: hm.name, isPlayer: me, look: Body.makeLook(hl.eq, hl.body) });
    c.human = true;   // 사람(파티원 포함) — 봇은 사람 팀원에게 차 자리를 비켜 준다 (08_vehicle.js yieldSeat)
    c.vlook = hl.veh || null; c.glook = hl.gun || null;   // 차량·총기 스킨 (파티원은 그 사람의 장착 목록)
    c.pf = hl.pf || null;   // 프로필 사진·테두리·칭호 — 스타트 섬 머리 위 칭호 (08_island.js)
    if (net) { c.net = Net.charNet(hm.uid); c.uid = hm.uid; }   // uid: 이 캐릭터의 사람 — 나갔다 돌아오면 봇에게서 돌려받는다 (10_net.js unbotize)
    const g = net && cfg.mm ? hm.g || 0 : 0; let T = grpT.get(g);
    if (!T || T.members.length >= TS) { T = newTeam(true); grpT.set(g, T); }
    CHARS.push(c); addTo(c, T); if (me) player = c;
  });
  // 사람이 장착한 차량 스킨 모델은 로딩 중에 미리 만들어 둠 (운전석에 앉는 순간 처음 만들면 큰 모델은 한 박자 멈춤 · 모델은 종류마다 한 번 만들어 공유)
  for (const c of CHARS) if (c.vlook) for (const t in c.vlook) { const id = c.vlook[t]; if (id && VehModels.has(id)) try { VehModels.instance(t, id); } catch (e) { console.warn(e); } }
  G.player = player;
  const srand = mulberry32(ms ^ 0x2545f491);        // 봇 이름·얼굴: 시드가 같으면 같게 (같이 하기는 모든 기기에서 · 혼자는 이어하기가 다시 만들 때)
  const names = BOT_NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(srand() * (i + 1)); const t0 = names[i]; names[i] = names[j]; names[j] = t0; }
  const nBots = net ? Math.max(0, cfg.nBots - humans.length + 1) : rs ? rs.nb : G.ranked ? Rank.botCount(SETTINGS.map) : clamp(SETTINGS.bots, 1, mapMaxBots(SETTINGS.map));
  const pl = G.plane, hostSide = !net || Net.isHost(), H0 = humans.length;
  // 봇 난이도 → 스킨 (07_bot_skin.js): 같이 하기면 방장이 정한 난이도(cfg.bd)와 시드로 모든 기기에서 같은 스킨 · 혼자도 난이도를 글자로 정해 두어 이어하기가 같게
  const bseed = ms, dks = [], bd = net ? cfg.bd : rs ? rs.bd : BotSkin.diffCodes(nBots, G.ranked, G.hc); G.bd = bd || '';
  for (let i = 0; i < nBots; i++) dks.push(bd ? BotSkin.fromCode(bd[i]) : hostSide ? BotSkin.pickDiff(G.ranked, G.hc) : null);
  const BP = BotSkin.pool([...new Set(dks.filter(Boolean))], bseed); G.botLooks = [];
  for (let i = 0; i < nBots; i++) {
    const body0 = Body.randomBody(srand), dk = dks[i], sk = dk ? BotSkin.forBot(BP, dk, bseed, i) : null;
    const b = new Character({ id: i + H0, name: (names[i % names.length]) + (i >= names.length ? '_' + i : ''), look: sk ? sk.look : Body.makeLook(null, body0) });
    b.diffKey = dk || null;   // 봇 난이도 — 스타트 섬 머리 위 표시
    if (sk) { b.glook = sk.gun; b.vlook = sk.veh; G.botLooks.push(b.look); }
    if (!hostSide) { b.net = Net.charNet(cfg.host); botTeam(b); CHARS.push(b); continue; } // 파티원 기기: 봇은 방장이 움직인다
    const br = new Brain(b, dk);
    const T = botTeam(b), lead = T.members[0], mate = T.human ? T.members.find((m) => m.human) : null;
    if (mate) {
      // 사람의 팀원: 그 사람이 뛰어내릴 때 따라 뛰고, 그 사람 근처에 착지 (온라인 매칭은 다른 기기 사람의 팀원도 방장이 움직임)
      br.followJump = true; br.followC = mate; br.jumpAt = Infinity; br.chuteH = 95; br.dropTarget = { x: 0, z: 0 };
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
  G.total = CHARS.length; Hunt.reset(); Pace.reset();   // v23 잠수 추적 (승급전 · 하드코어 — 07_bot_hunt.js) · 교전 템포 (07_bot_pace.js)
  try { MeleeSkin.warm(CHARS, G.player); } catch (e) { console.warn('근접 무기 스킨 미리 만들기 실패', e); }   // v23 이번 경기의 근접 무기 스킨 모양·내 무기 칸 그림을 미리 (주울 때 끊기지 않게)
  // 모든 캐릭터를 장면에 넣는다 (수송기 안 = 숨김) — v23 교전 템포를 합칠 때 이 줄이 빠져 모든 경기에서 나·적이 그려지지 않았다(이름표만 보임)
  for (const c of CHARS) { c.root.visible = false; c.pos.copy(G.plane.pos); sc.add(c.root); c.yaw = Math.atan2(G.plane.dx, G.plane.dz); }
  warmFar(sc);   // v23 먼 캐릭터용 셰이더·점 색을 로딩 중에 미리
  G.firstPerson = SETTINGS.view === 'fpp'; Cam.ads = 0; VM.key = null;
  HUD.reset(); Input.reset(); Touch.resetToggles(); Touch.apply();
  // 스타트 섬 (08_island.js): 25초 동안 모두 섬에 모였다가 수송기로 — 끝나면 비행 경로 보기부터. 테스트는 G.skipIsland 로 건너뜀
  //  이어하기는 섬 없이 (섬에서는 저장하지 않는다) · 같이 하기로 돌아올 때는 방장이 아직 섬에 있을 때만
  const isl = !G.skipIsland && !rs && !(rj && !rj.isl) && Island.start(sc, net ? cfg.seed : (Math.random() * 2147483647) | 0);
  if (rs) Resume.apply(rs);
  if (net) Net.ready();
  $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !IS_TOUCH;
  G.state = 'play';
  if (isl) { G.previewT = 0; Audio.wind(0.04); }
  else if (!rs && !rj) planeIntro();
}
// 비행 경로 보기 → 지도를 닫으면 출발 (스타트 섬이 끝날 때도)
function planeIntro() {
  G.previewT = 4.5;
  HUD.openMap(); HUD.toast('비행 경로를 확인하세요. 지도를 닫으면 출발합니다', 'info');
  Audio.plane(true); Audio.wind(0.1);
}
G.planeIntro = planeIntro;
function disposeMatch() {
  Training.dispose(); DM.dispose(); Island.dispose(); G.bgSim = false; G.netCfg = null; G.rjHold = false;
  Victory.reset();   // v23 우승 축하 창·춤 음악 정리
  // v23 근접 무기 스킨 처치 효과: 판 풀을 장면에서 뺌 (아래 장면 정리가 공유 판을 지우기 전에 · 판·재질은 다음 경기에 다시 씀)
  MeleeFx.dispose();
  Body.fogMax.value = 1; CV.objR = 0; CAPV.clear();   // v23 캐릭터 안개 상한·건물 표시 거리 되돌림 (로비·상점 화면의 캐릭터는 지형과 같은 안개) · 안개 상한을 씌운 차 목록
  if (!G.scene) return;
  Zone.dispose(G.scene); Airdrop.dispose(); Recall.dispose(); Veh.dispose(); XmasFx.dispose(); TeamPing.reset();   // 핑 점·링을 장면에서 뗌 (지난 장면이 메모리에 남지 않게)
  G.scene.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
  for (const c of CHARS) if (c.rig && c.rig.skel) c.rig.skel.dispose();   // 뼈대 텍스처(GPU) 해제
  if (G.botLooks) { const ml = myLook(); BotSkin.purge(G.botLooks, CHARS.filter((c) => c.human || c.isPlayer).map((c) => c.look).concat([Body.makeLook(ml.eq, ml.body)])); G.botLooks = null; }   // 봇 옷 묶음 몸 메시(CPU) 정리
  G.scene = null; CHARS = []; GROUND = []; W = null; G.player = null; G.plane = null; G.dropCands = null;
  Audio.plane(false);
}
// 지도 마커가 바뀜: v23 부터 기둥 없이 — 화면 표식·3D 점·팀원에게 보내기는 TeamPing 이 매 프레임 G.marker 를 보고 한다 (09_player_ping.js)
G.updateMarker = function () {};
// 경기 종료 판정: 내 팀이 전멸하면 패배, 살아 있는 팀이 내 팀뿐이면 우승 (내가 죽어 관전 중이어도 팀 우승)
G.onDeath = function (c, killer) {
  if (G.dm) { DM.onDeath(c, killer); return; }
  const p = G.player; if (!p || G.over || !G.teams) return;
  const mine = G.teams[p.team], team = G.teamSize > 1;
  if (!teamAlive(mine)) { G.over = true; G.endT = 2.2; G.win = false; Audio.lose(); HUD.toast(team ? '팀이 전멸했습니다' : '탈락했습니다', 'warn'); }
  // v23 우승: 살아 있으면 바로 결산하지 않고 축하(동상·춤·즉시 결산 — 10_victory.js). 죽어서 팀원이 이긴 거면 예전처럼 잠시 뒤 결과
  else if (aliveTeamCount() === 1) { if (p.alive && !G.training) Victory.start(); else { G.over = true; G.endT = 1.5; G.win = true; G.matchT = G.time; Audio.win(); HUD.toast(team ? '최후의 팀!' : '최후의 1인!', 'ok'); } }
  else if (c === p) { HUD.toast('탈락했습니다 — 팀원을 관전합니다', 'warn'); G.spec = null; nextSpectate(); }
};
// 관전: 살아 있는 팀원 순환
function nextSpectate() {
  const p = G.player; if (!p || p.alive) return;
  const list = teamMembers(p).filter(m => m !== p && m.alive && m.mode !== 'plane'); if (!list.length) return;   // 리콜 수송기에 탄 팀원은 관전하지 않음
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
  if (G.island) Island.dispose();
  // 방장: 다른 팀 사람(온라인 매칭)이 아직 경기 중이면 결과 화면 뒤에서 경기(봇·자기장·중계)를 계속 돌린다 — 안 그러면 그 사람들 경기가 멈춤
  G.bgSim = !!(G.net && Net.isHost() && Net.othersPlaying());
  Resume.clear();   // 결과가 났으니 이어하기 저장은 지운다
  const r = recordBR({ place, nT, total: G.total, kills: p.kills, dmg: p.damageDealt || 0, revives: p.revives, heads: p.headshots || 0, drive: p.driveM || 0, loot: p.lootN || 0, heals: p.healN || 0, goldN: p.goldN || 0, drops: p.dropN || 0,
    surv: p.alive || win && !p.deathTime ? G.matchT || G.time : p.deathTime || 0, ranked: G.ranked, hc: G.hc, ts: G.teamSize, party: !!G.net, map: SETTINGS.map, win, quit: !!G.quit });   // matchT: 우승이 정해진 시각 (v23 우승 축하 시간은 빼고)
  for (const m of r.notes) HUD.toast(m, 'ok');
  HUD.showResult(win, p, nT);
}
// 배틀로얄 경기 기록: 경험치 · 전적 · 랭크 · 미션 — 결과 화면(endMatch)과 이어하기에서 포기·이미 끝난 경기(10_resume.js) 공용
//  r: { place, nT(팀 수), total(인원), kills, dmg, revives, heads, drive, loot, heals, goldN, drops, surv(생존 초), ranked, hc, ts(팀 크기), party, map, win, quit }
function recordBR(r) {
  // 경험치: 처치·부활·순위(팀 수 대비 비율)·우승
  const xp = Math.round(40 + r.kills * 35 + (r.revives || 0) * 20 + Math.max(0, r.nT - r.place) / Math.max(1, r.nT - 1) * (r.total - 1) * 4 + (r.win ? 150 : 0));
  G.lastXp = xp;
  STATS.matches++; STATS.kills += r.kills; STATS.xp += xp; if (r.win) STATS.wins++;
  STATS.best = Math.min(STATS.best || 99, r.place);
  const rr = { place: r.place, total: r.ts > 1 ? r.nT : r.total, kills: r.kills, dmg: r.dmg, win: !!r.win, quit: !!r.quit, map: r.map };   // map: 승급전 성공 순위 (10_rank.js SERIES_TOP)
  G.rankResult = r.hc ? Rank.applyHc(rr) : r.ranked ? Rank.apply(rr) : null;
  STATS.recent.unshift({ rank: r.place, total: r.nT, kills: r.kills, time: Math.round(r.surv), map: r.map, ranked: !!r.ranked, hc: r.hc ? 1 : 0, sq: r.ts, party: r.party ? 1 : 0, delta: G.rankResult && !G.rankResult.placement ? G.rankResult.delta : undefined });
  STATS.recent = STATS.recent.slice(0, 5);
  G.statsSaved = saveStats();
  // 미션: 배틀로얄 경기 기록 반영 (훈련장·데스매치는 여기로 오지 않음)
  const notes = [];
  try { const evG = Eco.matchEnd({ quit: !!r.quit, win: !!r.win, place: r.place, kills: r.kills, heads: r.heads || 0, dmg: r.dmg || 0, drive: r.drive || 0, loot: r.loot || 0, heals: r.heals || 0, goldN: r.goldN || 0, drops: r.drops || 0, surv: r.surv || 0 }); if (evG) notes.push(`골드 이벤트 · 매치 보너스 +${evG} 골드 탄피`); const B = Eco.bpLast; if (B && B.xp) notes.push(`배틀패스 +${B.xp} 경험치` + (B.lv > B.lv0 ? ` · ${B.lv}단계 달성! 보상이 들어왔습니다` : '')); } catch (e) { console.warn('미션 반영 실패', e); }
  return { xp, notes };
}

// ---------- 메인 업데이트 ----------
let lootCullT = 0;
// v22 시체: 죽고 10초 뒤 1.2초 동안 땅으로 가라앉아 사라진다 (소지품은 옆의 시체 상자에 — 06_combat.js killChar) · 0 = 그대로, 1 = 사라짐
const CORPSE_T = 10, CORPSE_SINK = 1.2;
function corpseK(c) { return !c.alive && c.deathTime && !G.dm && c.mode === 'ground' ? clamp((G.time - c.deathTime - CORPSE_T) / CORPSE_SINK, 0, 1) : 0; }
const _sp = new THREE.Vector3();
// v23 캐릭터를 그리는 거리 (매 프레임 charView — 카메라 기준이라 팀원 관전·친구 관전 영상도 같은 규칙):
//  · R: 봇이 보고 쏘는 거리(BOT_SEE — 익스트림 200m) + 10% 와 품질의 봇 표시 거리 중 먼 쪽 — 예전 '낮음'(휴대폰 기본)은 160m 라 안 보이는 적에게 맞았다
//  · Rs: 배율 조준경(2배 이상)으로 조준하는 동안 조준 방향(inScope) 안은 BOT_SCOPE(봇 시야 × 1.6 = 320m — 07_bot.js)까지, 모든 품질에서 같게
//    (카메라 끝이 더 가까우면 거기까지 · R 이 이미 더 멀면(높음 320·엑스트라 420) 늘리지 않음). 예전처럼 카메라 끝(낮음 460 · 엑스트라 840m)까지 그리면
//    PC 높은 품질이 휴대폰보다 사람을 훨씬 멀리 보고, 나를 못 보는 봇을 위험 없이 저격했다
//    대형 맵은 건물·나무 구역을 그 거리까지 보인 뒤(objR)에만 — 숨긴 건물 안의 캐릭터가 벽 없이 보이지 않게
//  · 캐릭터 안개 상한(Body.fogMax — 04_body.js): 캐릭터(와 탄 차 — vehShow)는 안개에 CHAR_FOG 넘게 묻히지 않는다. '낮음'은 안개가 65~260m(정글 31~208m)라
//    200m 적이 77~99% 묻혀 그려도 안 보였다. 안개가 그보다 옅은 곳은 지형과 똑같다 (보통·높음의 칼덴·아이언리지는 R 안에서 그대로)
//    봇 시야를 안개로 줄이지 않는 까닭: 안개 거리는 그래픽 품질(기기마다 다름)을 따르므로, 같이 하기에서 방장 품질이 규칙을 바꾸게 된다
//    그래서 짙은 안개(키나루 정글·크리스마스 섬)도 이제 캐릭터를 다 숨기지 못한다 — 봇은 안개와 상관없이 보고 쏘므로
//  · capD: 상한이 걸리기 시작하는 거리 (smoothstep 이 0.6 이 되는 자리 = near + (far - near) × 0.5665)
//  · farD: 120m 밖이면서 화면에서 키 5화소 미만(해상도·조준경 배율 반영) — 관절 자세는 네 프레임에 한 번, 그림자 없음, 안티에일리어싱이 없으면 가슴에 점(FarDots)
//  · loD: farD 와 capD 중 가까운 쪽 — 그 밖은 총을 상자 하나로, 장비는 숨김 (rig.setFar · 상한이 걸린 몸 위에 장비만 옅게 묻히는 구간이 없게)
const CHAR_FOG = 0.6, CAP_T = 0.5665, FAR_MIN = 120;
const CV = { R: 220, Rs: 220, want: 220, objR: 0, zs: 0, fx: 0, fy: 0, fz: 1, cosA: 1, farD: FAR_MIN, loD: FAR_MIN, capD: Infinity, dots: null };
function charView(Q) {
  const p = G.player, cam = G.camera, fog = G.scene.fog;
  CV.R = Math.max(Q.botDraw, Math.round(BOT_SEE * 1.1));
  CV.zs = p && p.alive && p.mode === 'ground' && G.viewChar() === p && Cam.si && Cam.si.mag ? smoothstep01(Cam.ads) : 0;
  CV.want = lerp(CV.R, Math.max(CV.R, Math.min(cam.far, BOT_SCOPE)), CV.zs);
  CV.Rs = Math.min(CV.want, W.streamTerrain ? CV.objR : Infinity);
  if (CV.zs > 0) {   // 조준 방향 원뿔: 화면 대각선 반각 + 0.1 (반동·흔들림·한 프레임 늦은 시야 여유)
    const cp = Math.cos(p.pitch), hv = cam.fov * DEG / 2;
    CV.fx = Math.sin(p.yaw) * cp; CV.fy = Math.sin(p.pitch); CV.fz = Math.cos(p.yaw) * cp;
    CV.cosA = Math.cos(Math.min(1.4, Math.atan(Math.tan(hv) * Math.hypot(1, cam.aspect || 1.78)) + 0.1));
  }
  Body.fogMax.value = fog ? CHAR_FOG : 1;
  const pxK = (G.renderer.domElement.height || 540) / (2 * Math.tan(cam.fov * DEG / 2));   // d m 앞 1m 가 화면에서 차지하는 화소 = pxK / d
  CV.farD = Math.max(FAR_MIN, pxK * 1.8 / 5);
  CV.capD = fog ? fog.near + (fog.far - fog.near) * CAP_T : Infinity;
  CV.loD = Math.min(CV.farD, CV.capD);
  if (CV.dots === null) CV.dots = !(G.renderer.getContextAttributes() || {}).antialias;   // 렌더러는 시작할 때 품질로 한 번 만들어짐 ('낮음' = 안티에일리어싱 없음)
  return CV;
}
const inScope = (c, cam) => { const dx = c.pos.x - cam.x, dy = c.pos.y + 1.2 - cam.y, dz = c.pos.z - cam.z; return dx * CV.fx + dy * CV.fy + dz * CV.fz > CV.cosA * Math.hypot(dx, dy, dz); };
// v23 아주 멀리 있는 캐릭터(farD 밖)의 점: 안티에일리어싱이 없으면('낮음') 화면에서 키 5화소 미만인 몸은 화소보다 가늘어
//  0~2화소만 찍히거나 깜빡인다 (휴대폰 '낮음' 실측: 150m 봇 0화소, 210m 1화소) → 가슴 자리에 2×2화소 점.
//  모든 캐릭터를 점 묶음 하나로(그리기 1번) · 안개 상한을 받고 지형·건물에 가려진다 · 경기 장면이 바뀌면 그 장면에 다시 붙음
//  색은 그 캐릭터 옷의 평균 색(Body.farColor — 외형마다 한 번) × 이 경기의 빛 × 0.85 → 멀리서 본 그 몸보다 조금 어둡게 (한 색 점이면 위장복이 점으로 드러남)
//   빛 = 선 몸이 받는 빛: 하늘빛(하늘·땅 반씩) + 해(옆면 평균 cos(고도)/π) + 환경광 0.075 — 점은 빛을 받지 않는 재질이라 미리 곱함.
//   엎드리면 등이 하늘을 보아 더 밝다 → 앉음 +8%·엎드림 +15%. 실측(먼 모습 밝기/옷 색, 8방향 평균): 낮 선 0.59~0.70 · 앉음 0.65~0.80 · 엎드림 0.60~0.91,
//   저녁 선 0.46~0.58 — 이 식으로 점은 그 몸 밝기의 0.67~0.99배 (옷의 광택·발광은 셈하지 않아 조금 어두운 쪽)
const FarDots = (() => {
  const MAX = 128, pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), g = new THREE.BufferGeometry(), v = new THREE.Vector3(), LK = [0.54, 0.55, 0.52];
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const pts = new THREE.Points(g, Body.charFog(new THREE.PointsMaterial({ vertexColors: true, size: 2, sizeAttenuation: false })));
  pts.frustumCulled = false; let n = 0;
  function light() {
    const h = G.hemi, s = G.sun, sd = G.sunDir; if (!h || !s) return;
    const ks = s.intensity * (sd ? Math.hypot(sd.x, sd.z) : 0.6) / Math.PI;
    for (const [i, k] of [[0, 'r'], [1, 'g'], [2, 'b']]) LK[i] = ((h.color[k] + h.groundColor[k]) / 2 * h.intensity + s.color[k] * ks + 0.075) * 0.85;
  }
  const colorOf = (c) => (c._dotL === c.look ? c._dotC : (c._dotL = c.look, c._dotC = Body.farColor(c.look)));
  return {
    begin() { n = 0; },
    add(c) {
      if (n >= MAX) return; c.chest(v); const k = colorOf(c), i = n * 3, s = 1 + 0.08 * c.anim.crouch + 0.15 * c.anim.prone;
      pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; col[i] = k[0] * LK[0] * s; col[i + 1] = k[1] * LK[1] * s; col[i + 2] = k[2] * LK[2] * s; n++;
    },
    end(sc) {
      if (pts.parent !== sc) { sc.add(pts); light(); }
      g.setDrawRange(0, n); pts.visible = n > 0; if (n) g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
      pts.material.size = 2 / G.renderer.getPixelRatio();   // 크기는 그리는 화소 2개 (three 가 배율을 곱함)
    },
    colorOf, get count() { return n; }, get points() { return pts; }, get light() { return LK; },
  };
})();
// v23 탄 사람을 그리면 그 차도 그린다 — 차는 0.3초마다 거리로 숨기는데(08_vehicle.js, 이 프레임 앞에서) 여기서 같은 프레임에 다시 켜므로 깜빡이지 않음.
//  상한이 걸리는 거리(capD) 밖이면 차도 캐릭터처럼 안개 상한 재질로(VehModels.fogCap) — 차는 안개에 묻히고 사람만 앉은 채 떠서 달리지 않게. 아무도 그리지 않게 되면 되돌림
const CAPV = new Set();
function vehShow(P, d) {
  if (!P.root.visible) { P.root.visible = true; VehModels.setShadows(P, false); }
  if (d > CV.capD - 15) { if (!P.fogCap) { VehModels.fogCap(P, true); CAPV.add(P); } P.capF = G.frame; }
}
// v23 먼 캐릭터에만 쓰는 셰이더(총 상자 · 점 · 탄 차의 안개 상한 짝)를 경기 시작 때 미리 컴파일 — 처음 쓰는 순간(착지 뒤 첫 원거리 교전)에 한 박자 멈추지 않게.
//  r128 의 compile 은 숨긴 물체의 재질도 컴파일한다(10_partyfx.js warmDev 와 같은 방법) · 점 색도 외형마다 미리
//  임시 상자에도 정점 색(3개짜리)을 둔다 — three 는 '색 속성이 4개짜리인가'(vertexAlphas)도 셰이더 열쇠에 넣어, 색 속성이 없으면 다른 셰이더가 만들어진다(실측)
function warmFar(sc) {
  FarDots.begin(); FarDots.end(sc);
  const wg = new THREE.BoxGeometry(1, 1, 1); wg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(wg.attributes.position.count * 3), 3));
  const tmp = new THREE.Group(); tmp.visible = false; for (const m of [gunBoxMat(), ...VehModels.capMats()]) tmp.add(new THREE.Mesh(wg, m));
  sc.add(tmp); try { G.renderer.compile(sc, G.camera); } catch (e) { /* 처음 그릴 때 컴파일됨 */ } sc.remove(tmp); wg.dispose();
  for (const c of CHARS) try { FarDots.colorOf(c); } catch (e) { console.warn(e); }
}
G.update = function (dt) {
  G.time += dt;
  const p = G.player, bg = G.state !== 'play';   // bg: 방장이 결과 화면에 있는 동안 뒤에서 돌리는 경기 (G.bgSim)
  if (p && p.veh && p.seat === 0 && !p.veh.dead) p.driveM = (p.driveM || 0) + Math.hypot(p.veh.vx, p.veh.vz) * dt;
  // 메뉴 토글 (모달이 열려 있어도 처리)
  if (!bg) {
    if (Input.consume('pause')) { if (!$('mapPanel').hidden) HUD.closeMap(); else if (!$('invPanel').hidden) HUD.closeInv(); else G.pause(true); }
    if (Input.consume('map')) { $('mapPanel').hidden ? HUD.openMap() : HUD.closeMap(); }
    if (Input.consume('inventory')) { $('invPanel').hidden ? HUD.openInv() : HUD.closeInv(); }
  }
  if (G.previewT > 0) { G.previewT -= dt; if (G.previewT <= 0 || $('mapPanel').hidden) { G.previewT = 0; HUD.closeMap(); } }
  // 수송기 (스타트 섬에 있는 동안은 출발 전)
  const pl = G.plane;
  if (pl && pl.active && G.previewT <= 0 && !G.island) {
    pl.t += dt; const d = pl.t * pl.speed;
    pl.pos.set(pl.ax + pl.dx * d, pl.alt, pl.az + pl.dz * d); pl.mesh.position.copy(pl.pos);
    for (const pr of pl.mesh.userData.props) pr.rotation.z += dt * 30;
    const left = CHARS.filter(c => c.mode === 'plane' && !c.rplane);   // 리콜 수송기 탑승자는 08_recall.js가
    for (const c of left) {
      c.pos.copy(pl.pos);
      if (!c.isPlayer && c.brain && pl.t >= c.brain.jumpAt && overIsland(pl.pos.x, pl.pos.z)) jumpOut(c);
    }
    // 섬을 벗어나기 직전 강제 강하
    const ahead = d + 60;
    if (!overIsland(pl.ax + pl.dx * ahead, pl.az + pl.dz * ahead) && d > pl.len * 0.5) for (const c of left) { if (!Net.mine(c)) continue; if (c.isPlayer) HUD.toast('수송기가 섬을 벗어나 자동 강하합니다', 'warn'); jumpOut(c); }
    if (d > pl.len) { pl.active = false; pl.mesh.visible = false; Audio.plane(false); }
  }
  // 플레이어 (v23 우승 축하 중에도 움직일 수 있다 · 같이 하기로 돌아오는 중이면 방장이 지금 상태를 보낼 때까지 그대로 — 10_resume.js)
  if (p && p.alive && (!G.over || G.victory) && !G.rjHold) {
    const modal = HUD.modalOpen();
    if (p.mode === 'plane') {
      if (!modal || !$('mapPanel').hidden) { p.yaw -= Input.lookX * 0.0023 * SETTINGS.lookSens; p.pitch = clamp(p.pitch - Input.lookY * 0.0023 * SETTINGS.lookSens, -1.2, 0.6); }
      Input.lookX = Input.lookY = 0;
      const pp = planeOf(p);
      if (Input.consume('interact') || Input.consume('jump')) { if (G.previewT <= 0 && overIsland(pp.pos.x, pp.pos.z)) jumpOut(p); else HUD.toast(G.previewT > 0 ? '지도를 닫으면 출발합니다' : '섬 상공에서만 강하할 수 있습니다', 'warn'); }
    } else if (p.mode === 'fall' || p.mode === 'chute') {
      if (!modal) { p.yaw -= Input.lookX * 0.0023 * SETTINGS.lookSens; p.pitch = clamp(p.pitch - Input.lookY * 0.0023 * SETTINGS.lookSens, -1.3, 0.8); }
      Input.lookX = Input.lookY = 0;
      let mz = (Input.keys.KeyW ? 1 : 0) - (Input.keys.KeyS ? 1 : 0) + Input.move.z, mx = (Input.keys.KeyD ? 1 : 0) - (Input.keys.KeyA ? 1 : 0) + Input.move.x;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
      let sx = fx * Math.max(0, mz) + rx * mx, sz = fz * Math.max(0, mz) + rz * mx; const sl = Math.hypot(sx, sz); if (sl > 1) { sx /= sl; sz /= sl; }
      if ((Input.consume('interact') || Input.consume('jump')) && p.mode === 'fall' && G.time - p.jumpT > 1) openChute(p);
      updateDrop(p, dt, sx, sz, clamp(mz, -1, 1));
      Audio.wind(p.mode === 'fall' ? 1 : 0.35);
    } else if (p.dance && !p.veh) {
      Victory.danceInput(dt, modal);   // v23 춤추는 중: 움직이거나 쏘면 멈춤, 끌면 카메라가 돎
    } else if (G.frozen && !p.veh) {
      // 대결 준비·라운드 사이: 둘러보기만 (움직이기·쏘기 없음)
      if (!modal) { p.yaw -= Input.lookX * 0.0023 * SETTINGS.lookSens; p.pitch = clamp(p.pitch - Input.lookY * 0.0023 * SETTINGS.lookSens, -1.3, 0.8); }
      Input.lookX = Input.lookY = 0; stepPhysics(p, dt, 0, 0, 0, false);
    } else if (!modal) { if (p.veh) updateDriving(dt); else updatePlayer(dt); }
    else { Input.lookX = Input.lookY = 0; if (p.veh) { p.veh.ctrl.throttle = 0; p.veh.ctrl.steer = 0; } else stepPhysics(p, dt, 0, 0, 0, false); }
  }
  // 봇 (대형 맵: 카메라에서 600m 밖의 봇은 두 프레임에 한 번, 누적 dt로 갱신 — 봇마다 번갈아 부하 분산)
  //  v22: 작은 맵도 봇 표시 거리 밖(화면에 그리지 않는 거리, 최소 220m)이면 같게. 단 싸우는 중(COMBAT)이거나
  //  다른 기기 사람(같이 하기·온라인 매칭) 가까이 있는 봇은 매 프레임 (움직임은 stepPhysics 가 큰 dt 를 잘게 나눠 벽을 뚫지 않음)
  //  v23: 화면에 그리는 봇(배율 조준경으로 보는 220m 밖 봇 — 아래 charView)도 매 프레임 — 조준경 속에서 두 프레임씩 끊겨 움직이지 않게
  G.frame = (G.frame || 0) + 1;
  const camP = G.camera.position, lodR = W.big ? 600 : Math.max(QUALITY[SETTINGS.quality].botDraw, 220);
  let hum = null; if (G.net) for (const h of CHARS) if (h.human && h.alive && h.net && !h.net.mine && !h.botized) (hum || (hum = [])).push(h);
  const nearHum = (c) => { if (!hum) return false; for (const h of hum) if (Math.abs(h.pos.x - c.pos.x) < lodR && Math.abs(h.pos.z - c.pos.z) < lodR) return true; return false; };
  if (!G.island && !G.training && !G.dm) Pace.update(dt);   // v23 교전 템포(일반 경기만): 봇을 움직이기 전에 — 사람·이 기기 화면이 볼 수 있는 봇 표시 · 0.5초마다 k (07_bot_pace.js)
  for (const c of CHARS) {
    if (c.net && !c.net.mine) { Net.updateProxy(c, dt); continue; } // 다른 기기가 움직이는 캐릭터: 받은 상태 보간
    if (c.isPlayer || !c.alive) continue;
    const b = c.brain; if (!b) continue;
    if (G.island) { if (c.mode === 'ground') Island.bot(c, dt); continue; }   // 스타트 섬: 섬 안을 돌아다니기만
    if ((G.frozen || c.dance) && c.mode === 'ground') { stepPhysics(c, dt, 0, 0, 0, false); continue; }   // 대결 준비·라운드 사이: 봇도 멈춤 · v23 우승 축하로 춤추는 팀원 봇
    if (c.mode === 'fall' || c.mode === 'chute') {
      const fp = b.followC || p;
      if (b.followJump && fp) { // 팀의 사람(플레이어·다른 기기 사람)을 따라 강하
        b.dropTarget.x = fp.pos.x + b.followOff[0]; b.dropTarget.z = fp.pos.z + b.followOff[1];
        if (c.mode === 'fall' && fp.mode !== 'fall' && G.time - c.jumpT > 1) openChute(c);
      }
      const dx = b.dropTarget.x - c.pos.x, dz = b.dropTarget.z - c.pos.z, L = Math.hypot(dx, dz);
      const sx = L > 3 ? dx / L : 0, sz = L > 3 ? dz / L : 0;
      c.yaw = Math.atan2(sx || 0.001, sz || 1);
      // 자유낙하로는 못 닿을 만큼 멀면 낙하산을 일찍 펴서 활공 (낙하산이 수평 거리/낙하 비율이 약 3배)
      if (c.mode === 'fall' && G.time - c.jumpT > 1.5 && L > (c.pos.y - Math.max(heightAt(c.pos.x, c.pos.z), WATER_Y)) * 1.05) openChute(c);
      updateDrop(c, dt, sx, sz, L > 120 ? 1 : L > 30 ? 0.5 : -0.3);
    } else if (c.mode === 'ground') {
      if (Math.hypot(c.pos.x - camP.x, c.pos.z - camP.z) < lodR || b.state === 'COMBAT' || c.root.visible || nearHum(c)) { if (c._lod) { b.update(c._lod + dt); c._lod = 0; } else b.update(dt); }
      else { c._lod = (c._lod || 0) + dt; if ((G.frame + c.id) % 2 === 0) { b.update(c._lod); c._lod = 0; } }
    }
  }
  PathQ.run(3);
  updateTeamOrder(); if (Input.consume('ping') || Input.pingQ.length) Input.pingQ.length = 0;
  Veh.update(dt);
  if (G.training) Training.update(dt);
  if (G.dm) DM.update(dt);
  // 스타트 섬은 75명이 지름 80m 섬에 모여 모두 가까이 보이므로 25m 부터 (섬 봇은 걷기·멈추기뿐)
  const Qa = QUALITY[SETTINGS.quality], animFar = G.island ? 25 : Math.max(45, (Qa.lod || (SETTINGS.quality === 'low' ? 18 : SETTINGS.quality === 'high' ? 45 : 30)) + 15);
  for (const c of CHARS) {
    if (c.mode === 'plane') continue;
    if (!c.net || c.net.mine) updateCharTimers(c, dt);
    else { if (c.punch) updatePunch(c, dt); if (c.swing) updateSwing(c, dt); }   // 다른 기기 캐릭터의 주먹·근접 무기: 동작·소리만
    if (c.net && !c.net.mine && (c.lean || c.leanA)) { const lt = c.alive && !c.knocked && c.mode === 'ground' ? c.lean || 0 : 0; c.leanA += (lt - c.leanA) * Math.min(1, dt * 11); if (!lt && Math.abs(c.leanA) < 0.003) c.leanA = 0; }   // 다른 기기 캐릭터의 기울이기
    // 화면에 안 보이는 캐릭터는 관절 애니메이션 생략
    //  v22: 멀리 있는(카메라에서 정밀 메시 거리 + 15m, 최소 45m 밖 — 강하 중 포함) 캐릭터는 관절 자세를 두 프레임에 한 번(쌓인 시간으로) 계산하고,
    //  그 사이 프레임은 몸만 이동한 만큼 옮긴다 — 멀리서는 차이가 보이지 않고, 애니메이션이 프레임 시간에서 가장 큰 몫
    //  v23: 아주 멀리(120m 밖·화면에서 키 5화소 미만 — c._far, 아래 표시 거리에서 정함) 보이는 캐릭터는 네 프레임에 한 번
    if (c.isPlayer || c.root.visible) {
      const ap = c._ap;
      if (ap && !c.isPlayer && !c.veh && (c._far ? G.frame - c._animF < 4 && ((G.frame + c.id) & 3) : G.frame - c._animF <= 2 && ((G.frame + c.id) & 1) && Math.hypot(c.pos.x - camP.x, c.pos.y - camP.y, c.pos.z - camP.z) > animFar)) {
        c.root.position.copy(c.pos); ap.copy(c.pos);   // animateChar 처럼 몸을 지금 자리로 (v23: 이동량을 더하던 방식은 다른 곳이 몸을 옮긴 뒤 — 다른 기기 사람의 강하·이어하기 — 한 번 더 옮겨 튀었다)
        c._animAcc = (c._animAcc || 0) + dt;
      } else { animateChar(c, dt + (c._animAcc || 0)); c._animAcc = 0; c._animF = G.frame; (c._ap || (c._ap = new THREE.Vector3())).copy(c.pos); }
      if (!c.alive) { const ck = corpseK(c); if (ck > 0) c.root.position.y = c.pos.y - ck * 0.9; }   // v22 시체: 10초 뒤 가라앉으며 사라짐
    } else if (c.alive && c.mode === 'ground' && !c.veh) {
      // v23 그리지 않는 캐릭터도 걷기 속도·앉음·엎드림 값은 매 프레임 (animateChar 와 같은 빠르기) — 맞는 자리(hitSpheres)·눈·가슴(eye·chest: 봇 시선·조준)·
      //  탄 퍼짐(weaponSpread)이 이 값을 읽는다. 예전엔 그리는 캐릭터만 갱신돼 방장 화면 밖에서 엎드린 다른 기기 사람을 방장 봇이 선 키로 보고 맞혔다
      const a = c.anim, t = dt + (c._animAcc || 0); c._animAcc = 0;
      a.speed = lerp(a.speed, Math.hypot(c.vel.x, c.vel.z), clamp(t * 10, 0, 1)); a.crouch = lerp(a.crouch, c.stance === 'crouch' ? 1 : 0, clamp(t * 9, 0, 1)); a.prone = lerp(a.prone, c.stance === 'prone' ? 1 : 0, clamp(t * 6, 0, 1));
    }
    if (c.rig.ofx.length && c.alive && c.root.visible && !(c.isPlayer && VM.active)) { const d = G.camera.position.distanceTo(c.pos); if (d < 40) OutfitFx.update(c.rig, dt, d < 15 ? 1 : 0.5); }   // EXCLUSIVE 옷 효과
    footsteps(c, dt);
  }
  separateChars();
  if (G.island) Island.update(dt);
  // 자기장·보급·리콜 (스타트 섬 동안은 아직 시작 전). 방장은 졌어도 다른 팀 사람이 남아 있으면 자기장을 계속 줄인다
  else if (!G.training && !G.dm) { if (!G.over || G.win || bg || (G.net && Net.isHost() && Net.othersPlaying())) Zone.update(dt); Airdrop.update(dt); Recall.update(dt); if (!bg) Hunt.update(dt); }
  updateProjectiles(dt); FX.update(dt);
  if (W.xmas) XmasFx.update(dt, G.time, G.camera.position);
  if (G.noises.length > 80 || (G.noises.length && G.time - G.noises[0].t > 2)) G.noises = G.noises.filter(n => G.time - n.t < 2);
  // 거리 기반 표시 최적화
  const Q = QUALITY[SETTINGS.quality], cam = G.camera.position;
  const lodD = Q.lod || (SETTINGS.quality === 'low' ? 18 : SETTINGS.quality === 'high' ? 45 : 30), shD = Q.shadow || 45;
  const V = charView(Q); FarDots.begin();   // v23 그리는 거리·조준경·아주 먼 캐릭터 (위 charView)
  for (const c of CHARS) if (!c.isPlayer && c.mode !== 'plane') {
    const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
    c.root.visible = (d < V.R || (d < V.Rs && inScope(c, cam)) || c.mode !== 'ground' || !!c.dummy) && corpseK(c) < 1;
    const lo = c.root.visible && d > V.loD, far = c._far = lo && d > V.farD;
    c.rig.setShadow(d < shD && !far); c.rig.setLod(d > lodD && !c.dummy ? 1 : 0); c.rig.backGuns.visible = d < Math.max(60, lodD + 15); c.rig.setFar(lo);   // 정밀 메시 거리: 낮음 18m·보통 30m·높음 45m·엑스트라 70m(캐릭터 그림자 90m), 그 밖은 등의 총 생략
    if (far && V.dots && c.alive && c.mode === 'ground') FarDots.add(c);
    if (c.veh && c.root.visible) vehShow(c.veh.P, d);   // v23 탄 사람을 그리면 그 차도 (위 vehShow)
  }
  FarDots.end(G.scene);
  for (const P of CAPV) if (P.capF !== G.frame) { VehModels.fogCap(P, false); CAPV.delete(P); }   // 탄 사람을 더는 그리지 않는(내린·멀어진) 차는 원래 재질로
  // 대형 맵: 카메라 주변 지형 스트리밍 + 먼 구역 숨김 (안개 너머 · v23 단 캐릭터를 그리는 거리까지는 보임 — 조준경이면 더 멀리, CV.objR)
  //  v23 조준을 풀어 그리는 거리가 줄면 먼 구역도 바로 숨김 — 0.25초를 기다리면 다시 넓어진 시야에 안개색 건물·나무가 잔뜩 그려졌다
  const objR = Math.max(Q.far * (G.fogK ? G.fogK[1] : 1), CV.want);
  if (W.streamTerrain && CV.objR > objR + 20) W.cullChunks(cam.x, cam.z, CV.objR = objR);
  lootCullT -= dt;
  if (lootCullT <= 0) {
    lootCullT = 0.25;
    for (const it of GROUND) if (it.alive && !it.bx) { const d = Math.hypot(it.x - cam.x, it.z - cam.z); if (d < Q.near) itemMesh(it).visible = true; else if (it.mesh) it.mesh.visible = false; }   // 상자 안 물건은 모델 없음 (상자 하나로)
    if (W.streamTerrain) { W.streamTerrain(cam.x, cam.z, Q.far + 250, 2); W.cullChunks(cam.x, cam.z, CV.objR = objR); }
  }
  Crates.update(cam, Math.max(Q.near * 2, 90), dt);   // v22 시체 상자: 먼 것은 숨기고, 다 비우면 뚜껑이 열림
  // 줍기 대상 표시 링
  const fi = p && p.alive && p.mode === 'ground' && !p.veh ? HUD.focusItem() : null;
  if (G.focusRing) { G.focusRing.visible = !!fi; if (fi) { G.focusRing.position.set(fi.x, fi.y + 0.015, fi.z); G.focusRing.material.opacity = 0.35 + Math.sin(G.time * 5) * 0.2; } }
  // 카메라 / 그림자 / 오디오 리스너 (결과 화면 뒤에서 돌 때는 결과 화면 카메라 그대로)
  if (p && !bg) {
    const pp = planeOf(p);
    if (p.mode === 'plane' && pp) {
      const a = p.yaw, dist = 42;
      G.camera.position.set(pp.pos.x - Math.sin(a) * dist * Math.cos(p.pitch - 0.3), pp.pos.y + 12 - Math.sin(p.pitch - 0.3) * dist, pp.pos.z - Math.cos(a) * dist * Math.cos(p.pitch - 0.3));
      G.camera.lookAt(pp.pos.x, pp.pos.y, pp.pos.z); G.camera.fov = 70; G.camera.updateProjectionMatrix();
      p.root.visible = false; VM.active = false;
    } else if (!p.alive && G.spec && G.spec.alive && !G.over) {
      spectateCamera(dt, G.spec); p.root.visible = corpseK(p) < 1;
      if (Input.consume('interact') || Input.consume('jump')) nextSpectate();
    } else if (!p.alive) {
      if (G.spec && !G.spec.alive && !G.over) nextSpectate();
      const a = G.time * 0.25; G.camera.position.set(p.pos.x + Math.sin(a) * 8, p.pos.y + 5, p.pos.z + Math.cos(a) * 8); G.camera.lookAt(p.pos.x, p.pos.y + 0.5, p.pos.z);
      p.root.visible = corpseK(p) < 1; VM.active = false;
    } else if (G.victory && Victory.camOn()) Victory.camera(dt);   // v23 춤·동상이 솟는 장면
    else updateCamera(dt);
    ThrowViz.update(p);
    if (G.training) Training.hud(dt);
    if (G.dm) DM.hud(dt);
    G.sky.position.copy(G.camera.position);
    const focus = p.mode === 'plane' ? pp.pos : G.viewChar().pos;
    if (G.sun) { G.sun.target.position.set(focus.x, focus.y, focus.z); G.sun.position.set(focus.x + G.sunDir.x * 150, focus.y + G.sunDir.y * 150, focus.z + G.sunDir.z * 150); }
    Audio.setListener(G.camera.position.x, G.camera.position.y, G.camera.position.z, p.yaw, p.mode === 'ground' && isIndoor(p.pos.x, p.pos.z, p.pos.y));
  }
  if (!bg) HUD.update(dt);
  if (G.net) Net.tick(dt);
  if (!bg) Resume.tick(dt);   // 이어하기: 5초마다 경기 상태 저장
  if (G.victory) Victory.update(dt);   // v23 우승 축하: 동상·춤·자동 결산 (결산은 거기서)
  else if (G.over) { G.endT -= dt; if (G.endT <= 0 && G.state === 'play') { if (G.dm) DM.end(); else endMatch(); } }
};
function footsteps(c, dt) {
  if (!c.alive || c.mode !== 'ground' || !c.onGround || c.veh) return;
  const sp = Math.hypot(c.vel.x, c.vel.z); if (sp < 0.8) return;
  // 발소리는 발이 땅에 닿는 순간(걸음 위상 π마다)에 맞춘다. 화면 밖(애니메이션 생략) 캐릭터는 거리로 근사
  const a = c.anim;
  if (c.isPlayer || c.root.visible) { const k = Math.floor(a.phase / Math.PI); if (k === a.stepK) return; a.stepK = k; }
  else { a.stepAcc += sp * dt; if (a.stepAcc < (c.stance === 'prone' ? 1.2 : 1.4)) return; a.stepAcc = 0; }
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
    case 'dev': Dev.open(); break;
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
      if (G.training || G.dm || G.island) { toLobby(); break; }   // 스타트 섬(시작 전)에서 나가면 기록 없음
      if (G.victory && G.state === 'play') Victory.settle(true);   // v23 우승 축하 중 나가기: 우승 기록은 남긴다
      else if (G.player && G.state === 'play' && !G.over) {
        // 경기 중 나가기(관전 중 포함): 지금 살아 있는 팀 수를 순위로
        const p = G.player, T = G.teams[p.team]; G.quit = true;
        if (p.alive) { p.place = CHARS.filter(c => c.alive).length; p.deathTime = G.time; p.alive = false; p.knocked = false; }
        if (!T.place) T.place = aliveTeamCount() + (teamAlive(T) ? 0 : 1);
        G.win = false; endMatch(); $('resultPanel').hidden = true;
      }
      toLobby(); break;
    case 'specNext': nextSpectate(); break;
    case 'again':
      if (G.net || (Party.lockInfo() && !Party.isLeader())) { toLobby(); break; }
      if (SETTINGS.online && Cloud.user) { toLobby(); G.startMatch(); break; }   // 온라인 매칭: 로비에서 다시 줄 서기
      $('resultPanel').hidden = true; G.startMatch(); break;
    case 'lobby':
      toLobby(); break;
  }
};
function toLobby() {
  if (G.net) Net.leave();
  if (!Resume.busy) Resume.clear();   // 메뉴로 나간 경기는 이어하지 않는다 (경기 포기는 그때 기록됨)
  $('resultPanel').hidden = true; $('hud').hidden = true; $('mapPanel').hidden = true; $('invPanel').hidden = true; $('pausePanel').hidden = true;
  disposeMatch(); G.state = 'lobby'; G.paused = false; G.spec = null; releaseLock();
  G.training = false; document.body.classList.remove('training');
  $('lobby').hidden = false; HUD.renderLobby(); Audio.music(true);
  Ver.lobby();   // 새 배포를 다시 물음 (10_ver.js · 60초에 한 번까지 · 이미 알았으면 닫아 둔 막대를 다시)
}
// 로비의 출격·다시 하기: 게임 종류에 따라 배틀로얄 또는 데스매치
//  온라인 매칭이 켜져 있으면 줄 서기 (10_mm.js) · noMM: 매칭 없이 바로 (AI로 바로 시작 · 매칭 서버 연결 실패)
G.startMatch = (noMM) => { if (Party.tryStart(noMM)) return; if (!noMM && MM.trySolo()) return; return isDmGame(SETTINGS.game) ? DM.start() : startMatch(); };
G.startMatchNet = (cfg) => startMatch(cfg);
G.applySettings = function (key) {
  const r = G.renderer, Q = QUALITY[SETTINGS.quality];
  if (key === 'quality') { const far = G.training ? Training.viewFar() : Q.far; r.setPixelRatio(Q.pr); G.onResize(); if (G.scene && G.scene.fog) { const fk = !G.training && G.fogK ? G.fogK : [G.training ? 0.3 : 0.25, 1]; G.scene.fog.far = far * fk[1]; G.scene.fog.near = far * fk[0]; if (G.sky) G.sky.scale.setScalar(far / (G.sky.geometry.parameters.radius / 0.92)); } G.camera.far = far + 200; G.camera.updateProjectionMatrix(); }
  if (key === 'shadows') {
    const s = SHADOW_SIZE[SETTINGS.shadows]; r.shadowMap.enabled = s > 0;
    for (const L of [G.sun, Lobby.lights && Lobby.lights.sun]) if (L) {
      L.castShadow = s > 0;
      if (s) { L.shadow.mapSize.set(s, s); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } const c = L.shadow.camera, hw = SHADOW_HALF(s); c.left = c.bottom = -hw; c.right = c.top = hw; c.updateProjectionMatrix(); }
    }
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
function fatal(msg) { if (window.LDBoot) window.LDBoot.fail(true); const f = $('fatal'); f.hidden = false; f.innerHTML = ''; const d = document.createElement('div'); d.innerHTML = '<p class="eyebrow">실행 오류</p>'; const p = document.createElement('p'); p.textContent = msg; d.appendChild(p); const b = document.createElement('button'); b.className = 'btn'; b.textContent = '새로고침'; b.onclick = () => location.reload(); d.appendChild(b); f.appendChild(d); }

// ---------- 루프 ----------
//  FPS 제한(설정 30·60·120, 0 = 제한 없음 → 화면 주사율까지): 일정 기반 — 다음 프레임 목표 시각을 정해 두고, 그보다 일찍 온 화면 갱신은 건너뛴다.
//  허용 오차는 간격의 20% (예: 144Hz 화면에서 60fps — 주기가 간격의 정수배가 아니어도 평균이 목표에 맞음). 한 간격 넘게 밀리면 지금부터 다시 맞춤
const FrameGate = {
  next: 0, fps: 0,
  pass(t) {
    const f = SETTINGS.fps | 0; if (f !== this.fps) { this.fps = f; this.next = 0; }
    if (!f) return true;
    const iv = 1000 / f;
    if (this.next && t < this.next - iv * 0.2) return false;
    this.next = this.next && t - this.next < iv ? this.next + iv : t + iv;
    return true;
  },
};
// FPS 표시: 실제로 그린 프레임 수 (0.5초마다 갱신, 경기 중에만 · 개발자 통계가 켜져 있으면 그쪽에 이미 나오므로 숨김)
//  last: 최근 0.5초 FPS — 친구 관전이 해상도를 올린 뒤 FPS 가 떨어지는지 본다 (10_watch.js)
const FpsBox = { n: 0, t0: 0, el: null, last: 0,
  tick(t) {
    if (!this.t0) { this.t0 = t; this.n = 0; return; }   // 시작 프레임은 세지 않음 (간격 수 = 프레임 수)
    this.n++; if (t - this.t0 < 500) return;
    this.last = Math.round(this.n * 1000 / (t - this.t0));
    const el = this.el || (this.el = $('fpsBox')), dev = $('devStats'), show = !!SETTINGS.showFps && G.state === 'play' && !(dev && !dev.hidden);
    if (el) { el.hidden = !show; if (show) el.textContent = this.last + ' FPS' + (SETTINGS.fps ? ' / ' + SETTINGS.fps : ''); }
    this.n = 0; this.t0 = t;
  } };
let _last = performance.now();
function loop(ts) {
  requestAnimationFrame(loop);
  const t = performance.now();
  if (!FrameGate.pass(ts === undefined ? t : ts)) return;   // 목표 시각 전 → 이번 화면 갱신은 건너뜀
  let dt = (t - _last) / 1000; _last = t; dt = Math.min(dt, 0.05);
  Dev.frame(); FpsBox.tick(t);
  const off = GLX.off();   // 화면(GL)이 끊긴 동안: 그리지 않는다 · 로비와 혼자 하는 경기는 멈추고 같이 하기는 경기만 계속
  try {
    if (G.state === 'lobby' || G.state === 'loading') {
      if (off) return;
      GunSkin.update(dt);   // 총기 스킨: 빛 애니메이션·꺼내기 효과 (경기 중에는 G.update와 함께 — 멈추면 같이 멈춤)
      if (Cutscene.active) { Cutscene.update(dt); Cutscene.render(G.renderer); }
      else if (!Watch.viewing()) { Lobby.update(dt); G.renderer.render(Lobby.scene, Lobby.cam); }   // 친구 관전 화면이 덮고 있으면 로비 3D 는 그리지 않음
      Models.pump(5); Shop.pump();
    }
    else if (G.scene) {
      if ((!G.paused || G.net) && (!off || G.net) && G.state === 'play') { GunSkin.update(dt * G.timeScale); G.update(dt * G.timeScale); } // 같이 하기는 메뉴를 열어도·화면이 끊겨도 멈추지 않는다
      else if (G.state === 'result' && G.player) {
        // 방장이 진 뒤에도 다른 팀 사람이 남아 있으면 경기를 계속 돌린다 (승부가 나거나 모두 나가면 멈춤)
        if (G.bgSim) { if (G.net && Net.isHost() && Net.othersPlaying() && aliveTeamCount() > 1) G.update(dt * G.timeScale); else G.bgSim = false; }
        VM.active = false; const a = performance.now() / 4000; G.camera.position.set(G.player.pos.x + Math.sin(a) * 10, G.player.pos.y + 6, G.player.pos.z + Math.cos(a) * 10); G.camera.lookAt(G.player.pos);
      }
      if (off) return;
      G.renderer.render(G.scene, G.camera);
      if (G.state === 'play') renderViewModel();
      if (G.state === 'play') Models.idle(); else Models.pump(2);   // v22: 경기 중에는 아이콘 미리 그리기를 멈추고, 꼭 필요한 것만 GPU 를 기다리지 않고
    }
  } catch (e) { console.error(e); if (!G._errShown) { G._errShown = true; HUD.toast('오류: ' + e.message, 'warn'); } }
}

function boot() {
  // three.js 는 index.html 이 cdnjs → jsdelivr → unpkg 순서로 받은 뒤에야 이 코드를 시작한다 (모두 실패하면 거기서 안내) — 여기는 마지막 확인
  if (typeof THREE === 'undefined') { fatal('3D 라이브러리(three.js)를 불러오지 못했습니다. 네트워크 연결을 확인하세요.'); return; }
  const test = document.createElement('canvas'), tgl = test.getContext('webgl') || test.getContext('experimental-webgl');
  if (!tgl) { fatal('이 브라우저/기기에서 WebGL을 사용할 수 없습니다.'); return; }
  { const x = tgl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }   // 확인용 컨텍스트는 바로 놓는다 (휴대폰의 GL 메모리·동시 컨텍스트 수)
  if (IS_TOUCH) document.body.classList.add('touch');
  applyCssVars();
  initRenderer();
  Models.init(G.renderer);
  buildViewModel();
  Lobby.init();
  setupInput($('gl'));
  setupTouch($('touch'));
  HUD.setupLobby(); Training.setupLobby(); Social.setup(); Chat.setup(); Watch.setup(); Shop.setup(); Pass.setup(); Ladder.setup(); Dev.setup(); Prof.setup(); RankFx.setup(); Resume.setup(); Ver.setup(); Cloud.setup();
  // 이어하기: 로그인 복원이 끝난 뒤(계정 기록을 불러온 다음) 지난 경기가 남아 있으면 묻는다 · 나중에 로그인할 때도 (10_resume.js)
  Promise.resolve(Cloud.init()).catch((e) => console.warn(e)).then(() => Resume.check());
  { const prev = G.onAuth; G.onAuth = (on) => { if (prev) try { prev(on); } catch (e) { console.warn(e); } if (on) setTimeout(() => Resume.check(), 0); }; }
  $('rotateDismiss').addEventListener('click', () => { G.rotateDismissed = true; $('rotateHint').hidden = true; });
  G.onResize();
  document.addEventListener('pointerdown', () => { Audio.init(); if (G.state === 'lobby') Audio.music(true); }, { once: true });
  // v23 부팅 화면(index.html #bootSplash): '로비 입장 중'을 한 번 그린 뒤 로비 첫 프레임 — 첫 프레임(셰이더 컴파일)이 오래 걸려도 그동안 부팅 화면은 합성 스레드에서 계속 움직인다
  //  첫 프레임 다음 화면 갱신에 done → 0 m 착지 → 사라짐 · 부팅 화면이 없으면 예전처럼 바로
  //  window.LDBoot 을 지역 변수에 담지 말 것: boot() 안의 오래 사는 함수들(이벤트 리스너 등)이 같은 클로저를 공유해, 끝난 부팅 화면(캔버스 포함)이 통째로 메모리에 남는다
  if (window.LDBoot) { window.LDBoot.step(0.9, '로비 입장 중'); window.LDBoot.after(() => { requestAnimationFrame(() => { if (window.LDBoot) window.LDBoot.done(); }); loop(); }); } else loop();
  // 인벤토리 사진(아이콘)은 글꼴이 준비된 뒤 로비에서 조금씩 미리 렌더
  const warm = () => Models.prewarm();
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(warm); else setTimeout(warm, 500);
  // 테스트/디버그용 핸들 — 로컬 파일·개발 주소이거나 서버가 확인한 관리자 계정일 때만 window 에 붙는다 (10_dev.js Dev.hooks · 배포 사이트의 콘솔 치트 막기)
  Dev.hooks(() => ({ __gh: (x, z) => groundAt(x, z, 999), __spawn: (id, x, z) => { const d = ITEMS[id]; return spawnItem(G.scene, id, d.type === 'ammo' ? d.stack : 1, x, groundAt(x, z, 999), z, d.type === 'weapon' ? newWeapon(id, d.mag) : (d.dur ? { id, dur: d.dur } : (d.type === 'bag' ? { id } : null))); }, __LD: { KAnim, MeleeSkin, get MSHAPE() { return MSHAPE; }, FrameGate, FpsBox, GLX, Boom, FX, MM, Island, Net, get SETTINGS() { return SETTINGS; }, Body, Gear, buildRig, Lobby, Eco, EvBR, BR_EVENT, Shop, Cutscene, VSKINS, BOXES, RARITY, GSKINS, GunSkin, GunParts, SkinFx, MeleeFx, Dev, Ladder, VehFx, get animateChar() { return typeof animateChar !== 'undefined' ? animateChar : null; }, playerPing, setTeamOrder, TeamPing, startRevive, cancelRevive, nearestKnockedMate, knockChar, killChar, Models, VehModels, Veh, VEH_TYPES, VM, Cam, Touch, TOUCH_BTNS, Audio, Brain, PathQ, Airdrop, Recall, RECALL, jumpOut, Rank, RANK_TIERS, RankFx, Hunt, HUNT, Pace, PACE, get Training() { return Training; }, get Cloud() { return Cloud; }, get DM() { return DM; }, get Net() { return Net; }, get Party() { return Party; }, get PartyFx() { return PartyFx; }, get Social() { return Social; }, get Prof() { return Prof; }, get Watch() { return Watch; }, get Chat() { return Chat; }, get Resume() { return Resume; }, get Ver() { return Ver; }, NET_VER, NET_HIT_MAX, get Victory() { return Victory; }, fns: { vaultPlan, startVault, enterThrow, exitThrow, ThrowViz, useConsumable, doPickup, pickupItem, Crates, Hazard, queueThrow, swingMelee, autoWant, lootWant, autoPickup, gearBetter, spawnItem, drawMelee, corpseK, throwItem, detonate, get PROJ() { return PROJ; }, FUSE, losClear, rayBoxes, rayTerrain, stepPhysics, animateChar, raycastAll, updateCharTimers, separateChars, footsteps, attFits, newWeapon, startReload, fireWeapon, weaponSpread, sightInfo, fireMode, cycleFireMode, modeName, dropFromInventory, applyDamage, weaponAnim, itemsNear, get GROUND() { return GROUND; }, heightAt, groundAt }, G, get CHARS() { return CHARS; }, get W() { return W; }, Zone, Nav, ITEMS, Input, HUD, CV, FarDots,
    setXp(x) { STATS.xp = x; saveStats(); HUD.renderLobby(); }, get stats() { return STATS; },
    sim(n, dt = 1 / 30) { for (let i = 0; i < n && G.state === 'play'; i++) { GunSkin.update(dt); G.update(dt); } },
    states() { const s = {}; for (const c of CHARS) if (c.brain) s[c.brain.state] = (s[c.brain.state] || 0) + 1; return s; } } }));
}
boot();
