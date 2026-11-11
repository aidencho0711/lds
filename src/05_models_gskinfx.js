// ---------- 울트라레어 총기 스킨: 맞힘 · 처치 효과 ----------
//  맞힘(hit): 맞은 자리가 터지고(스킨마다 다른 입자) 맞은 몸에 잠깐 효과가 남는다
//    마그마 = 몸에서 불씨가 피어오름 · 홍룡 = 작은 불꽃이 핥음 · 플라즈마 = 몸 위로 전기가 튐 · 글리치 = 몸에 깨진 블록이 깜빡임
//  처치(kill): 쓰러진 자리에 큰 효과 + 효과음, 내가 처치하면 화면 위에 스킨 색 휘장
//    마그마 = 용암 분출(빛 기둥 · 용암 덩이 · 갈라진 바닥) · 홍룡 = 불꽃 용이 나선으로 솟아오름(불의 고리)
//    플라즈마 = 하늘에서 낙뢰(전기 돔 · 번개 자국) · 글리치 = 몸이 픽셀로 흩어짐(겹친 선 상자 · 데이터 기둥)
//  입자는 GunSkin의 점 구름(장면마다 그리기 1번)을 같이 쓰고, 고리·기둥·바닥 자국·번개·돔 같은 큰 모양만 메시로 잠깐 만든다
const SkinFx = (() => {
  let scene = null, warm = null, GEO = null, ARCS = [], ai = 0;
  const LIVE = [], BODY = new Map(), TEX = {};
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const E = (...a) => GunSkin.fx.emit(...a), pool = () => GunSkin.fx.pool(scene);
  const pick = (fx) => (fx.rainbow ? GunSkin.PRISM[(Math.random() * 6) | 0] : Math.random() < 0.55 ? fx.c : fx.c2);   // 테스터: 무지개

  // ---------- 텍스처 (처음 쓸 때 1번 그림) ----------
  const ctex = (key, W, H, fn) => { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d'), W, H); return (TEX[key] = new THREE.CanvasTexture(c)); };
  const glowTex = () => ctex('glow', 128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,0.6)'); r.addColorStop(0.55, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const ringTex = () => ctex('ring', 256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.6, 'rgba(255,255,255,0)'); r.addColorStop(0.83, 'rgba(255,255,255,0.85)'); r.addColorStop(0.9, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
  const sqRingTex = () => ctex('sqring', 256, 256, (g) => { g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 12; g.strokeRect(16, 16, 224, 224); g.lineWidth = 3; g.strokeRect(42, 42, 172, 172); g.fillStyle = '#fff'; for (const [x, y] of [[16, 16], [240, 16], [16, 240], [240, 240]]) g.fillRect(x - 11, y - 11, 22, 22); });
  // 빛 기둥: 아래가 밝고 위로 사라짐 + 세로 줄무늬
  const colTex = () => ctex('col', 64, 128, (g) => { const r = g.createLinearGradient(0, 128, 0, 0); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 128); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 64, 0, 2 + Math.random() * 6, 128); } });
  // 데이터 기둥(글리치): 가로 띠가 위로 흐름
  const stripeTex = () => ctex('stripe', 8, 128, (g) => { for (let y = 0; y < 128; y += 4) { const a = Math.random(); if (a < 0.4) continue; g.fillStyle = `rgba(255,255,255,${0.3 + a * 0.6})`; g.fillRect(0, y, 8, 1 + ((Math.random() * 3) | 0)); } });
  // 번개 띠: 가운데가 밝고 가장자리로 흐려짐 (v = 폭 방향)
  const boltTex = () => ctex('bolt', 4, 64, (g) => { const r = g.createLinearGradient(0, 0, 0, 64); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.3, 'rgba(255,255,255,0.35)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 4, 64); });
  // 가운데에서 갈라져 나가는 금(가지 포함)
  function cracks(cx, cy, n, len, step, turn, split) {
    const out = [];
    const walk = (x, y, a, L, d) => { const pts = [[x, y]]; for (let i = 0; i < L; i++) { a += (Math.random() - 0.5) * turn; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); if (d < 2 && Math.random() < split) walk(x, y, a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7), Math.max(3, ((L - i) * 0.6) | 0), d + 1); } out.push({ pts, d }); };
    for (let i = 0; i < n; i++) walk(cx, cy, (i / n) * TAU + Math.random() * 0.5, len, 0);
    return out;
  }
  function strokeAll(g, lines, w, col, blur) {
    g.save(); g.strokeStyle = col; g.lineCap = g.lineJoin = 'round'; if (blur) { g.shadowColor = col; g.shadowBlur = blur; }
    for (const { pts, d } of lines) { g.lineWidth = w / (1 + d * 0.8); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); }
    g.restore();
  }
  const halo = (g, r0, cols) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, r0); cols.forEach(([s, c]) => r.addColorStop(s, c)); g.fillStyle = r; g.fillRect(0, 0, 256, 256); };
  const lavaTex = () => ctex('lava', 256, 256, (g) => {
    halo(g, 124, [[0, 'rgba(255,200,90,0.9)'], [0.18, 'rgba(255,110,30,0.45)'], [0.5, 'rgba(170,30,0,0.18)'], [1, 'rgba(80,0,0,0)']]);
    const L = cracks(128, 128, 9, 13, 8, 0.7, 0.14);
    strokeAll(g, L, 10, 'rgba(255,80,10,0.6)', 10); strokeAll(g, L, 4.5, 'rgba(255,170,60,0.95)'); strokeAll(g, L, 1.8, 'rgba(255,248,210,1)');
  });
  const boltMarkTex = () => ctex('lich', 256, 256, (g) => {
    halo(g, 70, [[0, 'rgba(255,230,245,0.9)'], [0.3, 'rgba(255,60,120,0.4)'], [1, 'rgba(255,0,80,0)']]);
    const L = cracks(128, 128, 8, 13, 8, 1.1, 0.32);
    strokeAll(g, L, 6, 'rgba(255,50,110,0.65)', 8); strokeAll(g, L, 1.6, 'rgba(255,235,245,1)');
  });
  const fireTex = () => ctex('fire', 256, 256, (g) => {
    const C = 128;
    halo(g, 126, [[0, 'rgba(255,60,20,0)'], [0.5, 'rgba(255,70,20,0.3)'], [0.66, 'rgba(255,170,60,0.55)'], [0.8, 'rgba(255,90,20,0.22)'], [1, 'rgba(255,40,0,0)']]);
    for (let i = 0; i < 26; i++) {   // 바깥으로 뻗는 불꽃 혀
      const a = (i / 26) * TAU + Math.random() * 0.1, r0 = 80, r1 = 104 + Math.random() * 20, w = 0.09 + Math.random() * 0.05, m = (r0 + r1) / 2;
      const gr = g.createRadialGradient(C, C, r0, C, C, r1); gr.addColorStop(0, 'rgba(255,225,130,0.95)'); gr.addColorStop(0.5, 'rgba(255,110,30,0.7)'); gr.addColorStop(1, 'rgba(255,40,10,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(C + Math.cos(a - w) * r0, C + Math.sin(a - w) * r0);
      g.quadraticCurveTo(C + Math.cos(a - w * 0.3) * m, C + Math.sin(a - w * 0.3) * m, C + Math.cos(a + w * 0.4) * r1, C + Math.sin(a + w * 0.4) * r1);
      g.quadraticCurveTo(C + Math.cos(a + w * 0.7) * m, C + Math.sin(a + w * 0.7) * m, C + Math.cos(a + w) * r0, C + Math.sin(a + w) * r0); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,210,120,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(C, C, 77, 0, TAU); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(C, C, 63, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,200,100,0.9)'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.arc(C + Math.cos(a) * 70, C + Math.sin(a) * 70, 2.6, 0, TAU); g.fill(); }
  });
  // 얼음 금(흰색 — 바닥 자국 색으로 물듦) · 공허 소용돌이
  const iceTex = () => ctex('ice', 256, 256, (g) => {
    halo(g, 110, [[0, 'rgba(255,255,255,0.8)'], [0.35, 'rgba(200,240,255,0.3)'], [1, 'rgba(160,220,255,0)']]);
    const L = cracks(128, 128, 7, 11, 9, 0.35, 0.22);
    strokeAll(g, L, 5, 'rgba(210,245,255,0.55)', 6); strokeAll(g, L, 1.6, 'rgba(255,255,255,1)');
  });
  const swirlTex = () => ctex('swirl', 256, 256, (g) => {
    halo(g, 120, [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(255,255,255,0.15)'], [0.7, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round';
    for (let k = 0; k < 5; k++) { g.lineWidth = 3 - k * 0.4; g.beginPath(); for (let i = 0; i <= 80; i++) { const t = i / 80, a = k * TAU / 5 + t * 4.2, r = 18 + t * 100; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  });
  const pixTex = () => ctex('pix', 256, 256, (g) => {
    const S = 16;
    for (let y = 0; y < 256; y += S) for (let x = 0; x < 256; x += S) {
      const d = Math.hypot(x + S / 2 - 128, y + S / 2 - 128) / 128; if (Math.random() > (1 - d) * 1.15) continue;
      const k = Math.random(); g.fillStyle = g.strokeStyle = k < 0.45 ? 'rgba(255,40,60,0.85)' : k < 0.85 ? 'rgba(60,240,255,0.8)' : 'rgba(255,255,255,0.9)';
      if (Math.random() < 0.3) { g.lineWidth = 2; g.strokeRect(x + 2, y + 2, S - 4, S - 4); } else g.fillRect(x + 1, y + 1, S - 2, S - 2);
    }
  });

  // ---------- 메시 재료 (같은 셰이더 프로그램을 쓰도록 설정을 통일) ----------
  function geo() {
    if (GEO) return GEO;
    const plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2);          // 바닥에 눕힌 1×1 (법선 +Y)
    const col = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); col.translate(0, 0.5, 0); // 밑면이 0인 열린 원기둥
    return (GEO = { plane, col, sph: new THREE.SphereGeometry(1, 24, 16), box: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)) });
  }
  const addMat = (map, color) => new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sprMat = (color) => new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lineMat = (color) => new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  // 전기 돔: 가장자리가 밝은 구 (프레넬) + 빠르게 흐르는 띠
  const DV = 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const DF = 'uniform vec3 uC; uniform float uA; uniform float uT; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float b = 0.7 + 0.3 * sin(uT * 38.0 + vN.y * 26.0 + vN.x * 9.0); gl_FragColor = vec4(uC * (f * 1.7 + 0.05) * b * uA, 1.0); }';
  const domeMat = (color) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: 1 }, uT: { value: 0 } }, vertexShader: DV, fragmentShader: DF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function free(o) { o.traverse((m) => { if (m.material) m.material.dispose(); if (m.geometry && m.userData.own) m.geometry.dispose(); }); }

  // ---------- 장면 준비 (경기·훈련장·데스매치 시작 때) ----------
  function init(sc) {
    for (const e of LIVE) if (e.o) { if (e.o.parent) e.o.parent.remove(e.o); free(e.o); }
    LIVE.length = 0; BODY.clear();
    for (const r of ARCS) { if (r.m.parent) r.m.parent.remove(r.m); r.m.material.dispose(); r.geo.dispose(); }
    ARCS = []; scene = sc; LIGHT = null; needWarm = true;
    if (warmGrp) { if (warmGrp.parent) warmGrp.parent.remove(warmGrp); warmGrp = null; }
  }
  // 셰이더 미리 컴파일: 셰이더 프로그램은 장면의 안개·조명 개수까지 묶여 있으므로, 경기 장면이 다 만들어진 뒤 첫 프레임에
  //  보이지 않는 작은 효과 물체(투명도 0)를 한 프레임 그려서 그 조건 그대로 컴파일해 둔다. 재료를 남겨 두어야 프로그램이 유지된다
  let needWarm = false, warmGrp = null, warmN = 0;
  function warmUp() {
    needWarm = false; if (!scene || !G.camera || !G.renderer) return;
    const g = geo();
    const dm = domeMat(0x000000); dm.uniforms.uA.value = 0;
    const objs = [new THREE.Mesh(g.plane, addMat(glowTex(), 0x000000)), new THREE.Sprite(sprMat(0x000000)), new THREE.LineSegments(g.box, lineMat(0x000000)), new THREE.Mesh(g.sph, dm)];
    warmGrp = new THREE.Group();
    for (const o of objs) { o.frustumCulled = false; if (!o.material.isShaderMaterial) o.material.opacity = 0; o.scale.setScalar(0.001); warmGrp.add(o); }
    warmGrp.position.copy(G.camera.position); scene.add(warmGrp); warmN = 2;
    const P = pool(); P.warm = 2;                         // 입자 구름도 한 프레임 보이게 (점 크기 0)
    if (typeof VM !== 'undefined' && VM.scene && VM.cam) { GunSkin.fx.pool(VM.scene); try { G.renderer.compile(VM.scene, VM.cam); } catch (e) { /* 처음 그릴 때 컴파일됨 */ } }
    const old = warm; warm = objs; if (old) for (const o of old) o.material.dispose();   // 새 재료가 같은 프로그램을 잡은 뒤에 헌 재료를 놓는다
  }
  // 시간 진행 효과: o(메시, 없어도 됨)를 장면에 두고 dur초 동안 upd(e, u 0→1, dt)
  function add(o, dur, upd) {
    if (!scene) return null;
    if (o) scene.add(o);
    const e = { o, t: 0, dur, upd, dt: 0 }; LIVE.push(e); upd(e, 0, 0); return e;   // 만든 프레임부터 제 모양으로
  }
  // 바닥 높이와 기울기 (경사면에서도 바닥 자국·고리가 땅을 따라 눕도록)
  function ground(x, yHint, z) {
    const h = yHint + 0.6, y = groundAt(x, z, h);
    const hx = groundAt(x + 0.8, z, h) - groundAt(x - 0.8, z, h), hz = groundAt(x, z + 0.8, h) - groundAt(x, z - 0.8, h);
    const n = new THREE.Vector3(-hx / 1.6, 1, -hz / 1.6).normalize();
    if (n.y < 0.82) n.copy(UP);   // 건물 모서리 등 급한 차이는 무시
    return { x, y, z, n };
  }
  const lay = (m, gp, lift) => { m.position.set(gp.x, gp.y, gp.z).addScaledVector(gp.n, lift); m.quaternion.setFromUnitVectors(UP, gp.n); };

  // ---------- 큰 모양 부품 ----------
  function glow(p, color, size, dur) {
    const s = new THREE.Sprite(sprMat(color)); s.position.copy(p); s.renderOrder = 7;
    add(s, dur, (e, u) => { s.scale.setScalar(size * (0.3 + 0.7 * Math.sqrt(u))); s.material.opacity = (1 - u) * (1 - u); });
  }
  function ring(gp, color, r1, dur, tex, delay = 0) {
    const m = new THREE.Mesh(geo().plane, addMat(tex || ringTex(), color)); lay(m, gp, 0.06); m.renderOrder = 4; m.visible = false;
    add(m, dur + delay, (e, u) => { const v = Math.max(0, e.t - delay) / dur; m.visible = e.t >= delay; const k = 1 - Math.pow(1 - Math.min(1, v), 2.4); m.scale.setScalar(Math.max(0.01, r1 * 2 * (0.1 + 0.9 * k))); m.material.opacity = 1 - Math.min(1, v); });
  }
  // 바닥 자국: 빛나다가 식으며(c0 → c1) 사라짐
  function decal(gp, tex, size, dur, c0, c1) {
    const m = new THREE.Mesh(geo().plane, addMat(tex, c0)); lay(m, gp, 0.04); m.rotateY(Math.random() * TAU); m.scale.setScalar(size); m.renderOrder = 3;
    const A = new THREE.Color(c0), B = new THREE.Color(c1);
    add(m, dur, (e, u) => { m.material.opacity = Math.min(1, u * 14) * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45); m.material.color.copy(A).lerp(B, Math.min(1, u * 1.5)); });
  }
  // 빛 기둥: 아래에서 솟아오른 뒤 흐려짐. scroll이면 텍스처가 위로 흐름(데이터 기둥)
  function pillar(gp, color, r, h, dur, tex, scroll) {
    const m = new THREE.Mesh(geo().col, addMat(tex || colTex(), color)); m.position.set(gp.x, gp.y, gp.z); m.renderOrder = 5;
    if (scroll) { m.material.map = tex.clone(); m.material.map.needsUpdate = true; m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping; m.material.map.repeat.set(3, 2); m.userData.ownMap = true; }
    add(m, dur, (e, u) => {
      const up = Math.min(1, u / 0.22), k = 1 - Math.pow(1 - up, 3), w = r * (0.55 + 0.45 * k) * (1 + u * 0.3);
      m.scale.set(w, Math.max(0.01, h * k), w); m.rotation.y += e.dt * 1.5;
      m.material.opacity = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
      if (scroll) m.material.map.offset.y -= e.dt * scroll;
      if (u >= 1 && m.userData.ownMap) m.material.map.dispose();
    });
  }
  function dome(p, color, R, dur) {
    const m = new THREE.Mesh(geo().sph, domeMat(color)); m.position.copy(p); m.renderOrder = 6;
    add(m, dur, (e, u) => { const k = 1 - Math.pow(1 - u, 3); m.scale.setScalar(R * (0.12 + 0.88 * k)); m.material.uniforms.uA.value = (1 - u) * (1 - u * 0.4); m.material.uniforms.uT.value = e.t; });
  }
  // 번개 띠: 점 목록을 카메라를 향하는 띠로 (폭 w)
  function ribbonGeo(n) {
    const g = new THREE.BufferGeometry(), uv = new Float32Array((n + 1) * 4), idx = [];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i <= n; i++) { uv.set([i / n, 0, i / n, 1], i * 4); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  function face(g, pts, w) {
    const cam = G.camera; if (!cam) return;
    const pos = g.attributes.position.array, n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
      _t.subVectors(q, o); _v.subVectors(cam.position, p); _s.crossVectors(_t, _v); const l = _s.length() || 1; _s.multiplyScalar((w * 0.5) / l);
      pos[i * 6] = p.x + _s.x; pos[i * 6 + 1] = p.y + _s.y; pos[i * 6 + 2] = p.z + _s.z; pos[i * 6 + 3] = p.x - _s.x; pos[i * 6 + 4] = p.y - _s.y; pos[i * 6 + 5] = p.z - _s.z;
    }
    g.attributes.position.needsUpdate = true;
  }
  // a → b 사이를 지그재그로 (큰 꺾임 + 잔떨림, 양 끝은 고정)
  const _off = [];
  function jag(pts, a, b, amp) {
    const n = pts.length - 1, L = a.distanceTo(b);
    _t.subVectors(b, a).normalize(); _s.set(_t.z, 0, -_t.x); if (_s.lengthSq() < 1e-4) _s.set(1, 0, 0); _s.normalize(); _n.crossVectors(_t, _s);
    let ox = 0, oz = 0;
    for (let i = 0; i <= n; i++) {
      const u = i / n, env = Math.sin(Math.PI * u);
      ox = ox * 0.55 + (Math.random() - 0.5); oz = oz * 0.55 + (Math.random() - 0.5);
      pts[i].lerpVectors(a, b, u);
      if (i && i < n) pts[i].addScaledVector(_s, ox * amp * L * env).addScaledVector(_n, oz * amp * L * env);
    }
  }
  // 하늘에서 내려꽂는 번개(가지 포함). flick: 모양이 바뀌는 시각들
  function bolt(a, b, fx, dur) {
    const paths = [{ a: a.clone(), b: b.clone(), n: 26, w: 0.24, gw: 1.15, amp: 0.07 }];
    for (let i = 0; i < 3; i++) { const u = 0.25 + Math.random() * 0.45, s = new THREE.Vector3().lerpVectors(a, b, u); const e = s.clone().add(new THREE.Vector3(rnd(-3, 3), -rnd(1.5, 4), rnd(-3, 3))); paths.push({ a: s, b: e, n: 10, w: 0.09, gw: 0, amp: 0.16 }); }
    const grp = new THREE.Group();
    for (const P of paths) {
      P.pts = Array.from({ length: P.n + 1 }, () => new THREE.Vector3());
      P.core = new THREE.Mesh(ribbonGeo(P.n), addMat(boltTex(), 0xfff2f8)); P.core.userData.own = true; P.core.frustumCulled = false; P.core.renderOrder = 8; grp.add(P.core);
      if (P.gw) { P.glow = new THREE.Mesh(ribbonGeo(P.n), addMat(boltTex(), fx.c)); P.glow.userData.own = true; P.glow.frustumCulled = false; P.glow.renderOrder = 7; grp.add(P.glow); }
    }
    let next = 0;
    add(grp, dur, (e, u) => {
      if (e.t >= next) { next = e.t + 0.06 + Math.random() * 0.04; for (const P of paths) jag(P.pts, P.a, P.b, P.amp); }
      const on = u < 0.18 || (u > 0.24 && u < 0.5) || (u > 0.56 && Math.random() < 0.8), op = on ? 1 - u * 0.8 : 0;
      for (const P of paths) { face(P.core.geometry, P.pts, P.w); P.core.material.opacity = op; if (P.glow) { face(P.glow.geometry, P.pts, P.gw); P.glow.material.opacity = op * 0.75; } }
    });
  }
  // 작은 전기 호 (맞은 자리·쓰러진 몸 위): 띠 10개를 돌려 씀
  function arcPool() {
    if (ARCS.length || !scene) return ARCS;
    for (let i = 0; i < 10; i++) {
      const g = ribbonGeo(7), m = new THREE.Mesh(g, addMat(boltTex(), 0xffffff)); m.frustumCulled = false; m.visible = false; m.renderOrder = 8; scene.add(m);
      ARCS.push({ m, geo: g, pts: Array.from({ length: 8 }, () => new THREE.Vector3()), a: new THREE.Vector3(), b: new THREE.Vector3(), life: 0, max: 1, w: 0.05, re: 0 });
    }
    return ARCS;
  }
  function arc(a, b, color, w, life) {
    const A = arcPool(); if (!A.length) return;
    const r = A[ai++ % A.length]; r.a.copy(a); r.b.copy(b); r.life = r.max = life; r.w = w; r.re = 0; r.m.material.color.setHex(color); r.m.visible = true;
  }
  function updateArcs(dt) {
    for (const r of ARCS) {
      if (r.life <= 0) continue;
      r.life -= dt; if (r.life <= 0) { r.m.visible = false; continue; }
      r.re -= dt; if (r.re <= 0) { r.re = 0.035; jag(r.pts, r.a, r.b, 0.2); }
      face(r.geo, r.pts, r.w); r.m.material.opacity = Math.min(1, (r.life / r.max) * 1.6);
    }
  }

  // ---------- 몸에서 점 고르기 (뼈 사이 선분 위, 몸통 쪽이 더 자주) ----------
  // [뼈 A, 뼈 B, 고를 비중, 살 두께(m)] — 뼈는 몸 속에 있으므로 두께만큼 겉으로(카메라 쪽 반구) 밀어내야 보인다
  const SEGS = [['head', 'neck', 1, 0.12], ['neck', 'chest', 1.4, 0.13], ['chest', 'spine', 1.6, 0.17], ['spine', 'hips', 1.4, 0.16], ['armL.sh', 'armL.el', 0.8, 0.07], ['armL.el', 'armL.hand', 0.7, 0.06], ['armR.sh', 'armR.el', 0.8, 0.07], ['armR.el', 'armR.hand', 0.7, 0.06],
    ['legL.hip', 'legL.knee', 1, 0.09], ['legL.knee', 'legL.foot', 0.9, 0.07], ['legR.hip', 'legR.knee', 1, 0.09], ['legR.knee', 'legR.foot', 0.9, 0.07]];
  function bones(c) {
    const r = c.rig; if (!r) return null; if (r._fxb) return r._fxb;
    const get = (k) => k.split('.').reduce((o, s) => o && o[s], r), L = []; let W = 0;
    for (const [a, b, w, th] of SEGS) { const A = get(a), B = get(b); if (A && B) { W += w; L.push([A, B, W, th]); } }
    return (r._fxb = { L, W });
  }
  function bodyPoint(c, out) {
    const B = bones(c); if (!B || !B.L.length) return out.set(c.pos.x + rnd(-0.2, 0.2), c.pos.y + rnd(0.3, 1.6), c.pos.z + rnd(-0.2, 0.2));
    const x = Math.random() * B.W; let s = B.L[B.L.length - 1]; for (const e of B.L) if (x <= e[2]) { s = e; break; }
    _b.setFromMatrixPosition(s[0].matrixWorld); _c.setFromMatrixPosition(s[1].matrixWorld);
    out.lerpVectors(_b, _c, Math.random());
    // 겉면: 카메라 쪽으로 기운 무작위 방향 × 살 두께
    _v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
    if (G.camera) { _n.subVectors(G.camera.position, out).normalize(); _v.multiplyScalar(0.75).add(_n).normalize(); }
    return out.addScaledVector(_v, s[3] * rnd(0.95, 1.25));
  }
  // 멀리 있어도 보이도록 화면 크기를 어느 정도 유지 (배율 조준경이면 그만큼 덜 키움)
  function farK(p, lo, hi) {
    const cam = G.camera; if (!cam) return 1;
    return clamp((p.distanceTo(cam.position) * (cam.fov / 72)) / lo, 1, hi);
  }

  // ---------- 맞힘 ----------
  const HIT = {
    ember(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, fx.c2, 0.45 * k, 0.1, { grow: 0.8, so: 0.35 }); E(P, p, 0, 0.05, 0, fx.c, 0.16 * k, 0.5, { so: 0.8 });
      for (let i = 0; i < 9; i++) E(P, p, -d.x * 1.4 + rnd(-1.1, 1.1) * s, rnd(1.2, 3.6) * s, -d.z * 1.4 + rnd(-1.1, 1.1) * s, Math.random() < 0.6 ? fx.c : fx.c2, rnd(0.035, 0.07) * k, rnd(0.35, 0.7), { g: -7, drag: 1, so: 0.8 });
    },
    flame(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, fx.c2, 0.42 * k, 0.09, { grow: 1, so: 0.35 }); E(P, p, 0, 0.3, 0, fx.c, 0.2 * k, 0.45, { grow: 1.2, so: 0.7 });
      for (let i = 0; i < 5; i++) E(P, p, -d.x * 0.6 + rnd(-0.4, 0.4), rnd(0.8, 2) * s, -d.z * 0.6 + rnd(-0.4, 0.4), i < 2 ? 0xffd27a : fx.c, rnd(0.1, 0.18) * k, rnd(0.28, 0.48), { grow: 1.6, drag: 2, so: 0.5 });
      for (let i = 0; i < 4; i++) E(P, p, rnd(-2, 2) * s, rnd(0.5, 2.5) * s, rnd(-2, 2) * s, fx.c2, rnd(0.02, 0.035) * k, rnd(0.3, 0.5), { g: -4, drag: 2, so: 0.6 });
    },
    spark(P, p, d, fx, k, s, t) {
      E(P, p, 0, 0, 0, 0xffffff, 0.26 * k, 0.05, { grow: 1 }); E(P, p, 0, 0, 0, fx.c, 0.5 * k, 0.09, { grow: 0.6, so: 0.35 });
      for (let i = 0; i < 10; i++) { _v.set(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 7) * s); E(P, p, _v.x, _v.y, _v.z, pick(fx), rnd(0.025, 0.045) * k, rnd(0.1, 0.22), { drag: 9, so: 0.5 }); }
      if (!t || G.time - (t._fxArcT || -9) > 0.07) { if (t) t._fxArcT = G.time; for (let i = 0; i < 2; i++) { _a.copy(p).add(_v.set(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 0.55) * Math.sqrt(k))); arc(p, _a, i ? fx.c : 0xffe8f2, 0.05 * Math.sqrt(k), rnd(0.1, 0.18)); } }
    },
    glitch(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, fx.c, 0.36 * k, 0.07, { sq: 1, grow: 0.5, so: 0.6 });
      for (let i = 0; i < 9; i++) { _v.set(rnd(-1, 1), rnd(-0.4, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 2.6) * s); E(P, p, _v.x, _v.y, _v.z, pick(fx), rnd(0.03, 0.06) * k, rnd(0.15, 0.3), { sq: 1, drag: 5, so: 0.85 }); }
      for (let i = 0; i < 3; i++) { _a.copy(p).add(_v.set(rnd(-0.16, 0.16), rnd(-0.16, 0.16), rnd(-0.16, 0.16))); E(P, _a, 0, 0, 0, pick(fx), rnd(0.08, 0.14) * k, rnd(0.06, 0.12), { sq: 1, so: 0.85 }); }
    },
    // 서리: 얼음 조각이 튀고 하얀 김이 퍼짐
    frost(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, 0xffffff, 0.3 * k, 0.07, { grow: 0.8, so: 0.3 }); E(P, p, 0, 0.1, 0, fx.c, 0.32 * k, 0.5, { grow: 1.3, drag: 2, so: 0.55 });
      for (let i = 0; i < 9; i++) { _v.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.5, 3.5) * s); E(P, p, _v.x, _v.y, _v.z, pick(fx), rnd(0.03, 0.055) * k, rnd(0.3, 0.55), { sq: 1, g: -6, drag: 1.5, so: 0.85 }); }
    },
    // 공허: 보랏빛이 맞은 자리로 빨려 들었다가 작게 터짐
    void(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, fx.c, 0.5 * k, 0.12, { grow: -0.7, so: 0.6 }); E(P, p, 0, 0, 0, fx.c2, 0.14 * k, 0.06, { grow: 1.4, so: 0.4 });
      for (let i = 0; i < 10; i++) { _v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); const R = rnd(0.2, 0.4) * s; _a.copy(p).addScaledVector(_v, R); E(P, _a, -_v.x * R * 6, -_v.y * R * 6, -_v.z * R * 6, pick(fx), rnd(0.03, 0.05) * k, 0.16, { so: 0.8 }); }
    },
    // 테스터(프리즘): 하얀 섬광 + 무지개 여섯 조각이 육각으로 튀고 + 작은 반짝임
    prism(P, p, d, fx, k, s) {
      E(P, p, 0, 0, 0, 0xffffff, 0.34 * k, 0.07, { grow: 0.9, so: 0.35 }); E(P, p, 0, 0, 0, fx.c, 0.28 * k, 0.16, { grow: 1.2, so: 0.4 });
      const a0 = Math.random() * TAU;
      for (let i = 0; i < 6; i++) { const a = a0 + i * TAU / 6; E(P, p, Math.cos(a) * 2.4 * s - d.x, rnd(0.6, 1.6) * s, Math.sin(a) * 2.4 * s - d.z, GunSkin.PRISM[i], rnd(0.05, 0.075) * k, rnd(0.25, 0.4), { sq: 1, drag: 4, so: 0.85 }); }
      for (let i = 0; i < 6; i++) { _v.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.5, 3.5) * s); E(P, p, _v.x, _v.y, _v.z, 0xffffff, rnd(0.02, 0.035) * k, rnd(0.2, 0.35), { drag: 5, so: 0.5 }); }
    },
  };
  // 슈퍼레어(약한 효과): 작은 섬광 + 조각 몇 개, 몸에 남는 효과는 짧게
  function liteHit(P, p, d, fx, k, s) {
    const sq = fx.kind === 'glitch';
    E(P, p, 0, 0, 0, fx.c2, 0.2 * k, 0.06, { sq, grow: 0.5, so: 0.35 });
    for (let i = 0; i < 4; i++) { _v.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 2.4) * s); E(P, p, _v.x, _v.y, _v.z, pick(fx), rnd(0.02, 0.035) * k, rnd(0.15, 0.3), { sq, drag: 5, g: fx.kind === 'ember' ? -4 : 0, so: 0.7 }); }
  }
  // 몸에 남는 효과: 초당 개수 · 한 번에 하나씩
  const RATE = { ember: 50, flame: 44, spark: 36, glitch: 44, frost: 40, void: 40, prism: 46 };
  const BODYFX = {
    ember(P, p, fx, k) { E(P, p, rnd(-0.12, 0.12), rnd(0.15, 0.9), rnd(-0.12, 0.12), Math.random() < 0.6 ? fx.c : fx.c2, rnd(0.1, 0.17) * k, rnd(0.4, 0.8), { g: 0.6, drag: 1.5, so: 0.85 }); },
    flame(P, p, fx, k) { E(P, p, rnd(-0.08, 0.08), rnd(0.4, 1.1), rnd(-0.08, 0.08), Math.random() < 0.3 ? 0xffd27a : fx.c, rnd(0.18, 0.28) * k, rnd(0.2, 0.36), { grow: 1.2, drag: 1.5, so: 0.8 }); },
    spark(P, p, fx, k) { E(P, p, rnd(-1.5, 1.5), rnd(-1, 1.5), rnd(-1.5, 1.5), pick(fx), rnd(0.05, 0.08) * k, rnd(0.08, 0.18), { drag: 6, so: 0.55 }); },
    glitch(P, p, fx, k) { E(P, p, 0, 0, 0, pick(fx), rnd(0.09, 0.19) * k, rnd(0.05, 0.15), { sq: 1, so: 0.85 }); },
    frost(P, p, fx, k) { E(P, p, rnd(-0.1, 0.1), rnd(-0.4, -0.1), rnd(-0.1, 0.1), Math.random() < 0.5 ? fx.c2 : fx.c, rnd(0.08, 0.15) * k, rnd(0.5, 0.9), { grow: 0.8, drag: 1.2, so: 0.6 }); },
    void(P, p, fx, k) { E(P, p, rnd(-0.1, 0.1), rnd(0.3, 0.9), rnd(-0.1, 0.1), Math.random() < 0.7 ? fx.c : fx.c2, rnd(0.1, 0.17) * k, rnd(0.35, 0.6), { grow: -0.4, drag: 1.2, so: 0.85 }); },
    prism(P, p, fx, k) { E(P, p, rnd(-0.15, 0.15), rnd(0.3, 0.8), rnd(-0.15, 0.15), pick(fx), rnd(0.06, 0.11) * k, rnd(0.35, 0.6), { sq: Math.random() < 0.6, drag: 1.4, so: 0.85 }); },
  };
  function body(t, fx, dur, corpse) {
    const s = BODY.get(t);
    if (s && !corpse && !s.corpse) { s.t = 0; s.dur = Math.max(s.dur, dur); s.fx = fx; return; }
    BODY.set(t, { fx, t: 0, dur, corpse, acc: 0, bt: 0 });
  }
  // t: 맞은 캐릭터(모르면 null → 맞은 자리에서 가까운 캐릭터) · (x,y,z) 맞은 자리 · (dx,dy,dz) 탄 방향 · fx: 스킨 효과 · by: 쏜 캐릭터
  function hit(t, x, y, z, dx, dy, dz, fx, by) {
    if (!scene || !fx || !G.camera) return;
    _a.set(x, y, z); if (_a.distanceTo(G.camera.position) > 220) return;
    if (!t) { let best = 1.3; for (const c of CHARS) { if (c === by || !c.alive) continue; const dd = Math.hypot(c.pos.x - x, c.pos.y + 1 - y, c.pos.z - z); if (dd < best) { best = dd; t = c; } } }
    const k = farK(_a, 6, 4), s = Math.sqrt(k), P = pool(), p = _a.clone();
    // 같은 표적을 아주 빠르게 연달아 맞히면(고속 연사) 터짐을 줄이고 빛만
    if (t && G.time - (t._fxHitT || -9) < 0.03) E(P, p, 0, 0, 0, fx.c2, (fx.lite ? 0.12 : 0.25) * k, 0.06, { sq: fx.kind === 'glitch', grow: 0.6, so: 0.4 });
    else if (fx.lite) liteHit(P, p, _t.set(dx, dy, dz), fx, k * 0.7, s);
    else (HIT[fx.kind] || HIT.ember)(P, p, _t.set(dx, dy, dz), fx, k, s, t);
    if (t) { t._fxHitT = G.time; body(t, fx, fx.lite ? 0.3 : 1.0, false); }
    if (typeof Audio !== 'undefined' && Audio.skinFx) Audio.skinFx('hit', fx.kind, by && by.isPlayer ? null : p, !!(by && by.isPlayer), !!fx.lite);
  }

  // ---------- 처치 ----------
  const KILL = {
    // 마그마: 바닥이 갈라지며 용암 분출 — 빛 기둥(바깥 + 뜨거운 속) · 솟았다 떨어지는 용암 덩이 · 떠오르는 불씨
    ember(t, fx, gp, cp, k) {
      const P = pool();
      glow(cp, fx.c2, 5.5, 0.45); light(cp, fx.c, 7, 0.7);
      ring(gp, fx.c, 4.6, 0.75); ring(gp, fx.c2, 2.8, 0.55, null, 0.12);
      decal(gp, lavaTex(), 4.2, 2.8, 0xfff2c8, 0xa01806);
      pillar(gp, fx.c, 0.75, 6.5, 0.9); pillar(gp, 0xffe2a0, 0.28, 7.5, 0.55);
      for (let i = 0; i < 64; i++) { const a = Math.random() * TAU, r = Math.random() * 0.4, o = rnd(0.6, 3); _a.set(gp.x + Math.cos(a) * r, gp.y + 0.25, gp.z + Math.sin(a) * r); E(P, _a, Math.cos(a) * o, rnd(5, 10.5), Math.sin(a) * o, Math.random() < 0.5 ? fx.c : Math.random() < 0.6 ? fx.c2 : 0xffe6b0, rnd(0.16, 0.3) * k, rnd(1, 1.7), { g: -9.8, drag: 0.3, so: 0.85 }); }
      for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, r = rnd(0.2, 1.6); _a.set(gp.x + Math.cos(a) * r, gp.y + rnd(0.1, 1.4), gp.z + Math.sin(a) * r); E(P, _a, rnd(-0.3, 0.3), rnd(0.6, 1.9), rnd(-0.3, 0.3), Math.random() < 0.6 ? fx.c : fx.c2, rnd(0.05, 0.09) * k, rnd(1.4, 2.4), { g: 0.4, drag: 0.8, so: 0.7 }); }
      body(t, fx, 2.4, true);
    },
    // 홍룡: 불꽃 용이 몸을 감고 나선으로 솟아올라 꼭대기에서 터짐 · 바닥에 불의 고리
    flame(t, fx, gp, cp, k) {
      const P = pool();
      glow(cp, fx.c, 4.6, 0.4); light(cp, fx.c, 6, 1.0); ring(gp, fx.c, 4, 0.8); decal(gp, fireTex(), 3.8, 2.4, 0xffffff, 0x8a1406);
      pillar(gp, fx.c, 0.5, 4.2, 1.0);
      for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, r = rnd(0.8, 1.1); _a.set(gp.x + Math.cos(a) * r, gp.y + 0.1, gp.z + Math.sin(a) * r); E(P, _a, Math.cos(a) * 0.3, rnd(1.4, 2.8), Math.sin(a) * 0.3, Math.random() < 0.4 ? 0xffd27a : fx.c, rnd(0.24, 0.36) * k, rnd(0.5, 0.8), { grow: 1.2, drag: 1.2, so: 0.5 }); }
      const a0 = Math.random() * TAU, H = 6, D = 1.0; let last = 0, burst = false;
      const head = new THREE.Sprite(sprMat(fx.c2)); head.renderOrder = 7; head.scale.setScalar(1.3);
      add(head, D, (e, u) => { const ang = a0 + u * TAU * 2.3, rad = 1.5 * (1 - u * 0.7); head.position.set(gp.x + Math.cos(ang) * rad, gp.y + 0.3 + u * H, gp.z + Math.sin(ang) * rad); head.material.opacity = u < 0.85 ? 1 : (1 - u) / 0.15; });
      add(null, D + 0.05, (e) => {
        const u1 = Math.min(1, e.t / D), steps = Math.max(1, Math.round((u1 - last) * 240));
        for (let i = 1; i <= steps; i++) {
          const u = last + ((u1 - last) * i) / steps, ang = a0 + u * TAU * 2.3, rad = 1.5 * (1 - u * 0.7);
          _a.set(gp.x + Math.cos(ang) * rad, gp.y + 0.3 + u * H, gp.z + Math.sin(ang) * rad);
          E(P, _a, Math.cos(ang) * 0.3, 0.4, Math.sin(ang) * 0.3, i === steps ? 0xffe6a0 : Math.random() < 0.3 ? fx.c2 : fx.c, rnd(0.34, 0.5) * k * (1.1 - u * 0.35), rnd(0.45, 0.7), { grow: 0.9, drag: 2, so: i === steps ? 0.3 : 0.85 });
          if (Math.random() < 0.35) E(P, _a, rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1), fx.c2, rnd(0.04, 0.06) * k, rnd(0.4, 0.7), { g: -3, drag: 1.5, so: 0.6 });
          _b.set(gp.x - Math.cos(ang) * rad * 0.8, gp.y + 0.3 + u * H * 0.92, gp.z - Math.sin(ang) * rad * 0.8);   // 맞은편 금빛 꼬리
          if (i % 2 === 0) E(P, _b, 0, 0.3, 0, fx.c2, rnd(0.1, 0.15) * k, rnd(0.3, 0.5), { grow: 0.8, drag: 2, so: 0.55 });
        }
        last = u1;
        if (u1 >= 1 && !burst) {
          burst = true; _a.set(gp.x, gp.y + 0.3 + H, gp.z); glow(_a, fx.c2, 4, 0.45);
          for (let i = 0; i < 48; i++) { _v.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2.5, 6.5)); E(P, _a, _v.x, _v.y, _v.z, Math.random() < 0.5 ? fx.c : fx.c2, rnd(0.12, 0.22) * k, rnd(0.6, 1), { g: -3, drag: 1.6, grow: 0.6, so: 0.6 }); }
        }
      });
      body(t, fx, 2.2, true);
    },
    // 플라즈마: 하늘에서 낙뢰 → 전기 돔이 퍼지고 사방으로 스파크 · 바닥에 번개 자국 · 몸 위로 전기
    spark(t, fx, gp, cp, k) {
      const P = pool();
      _a.set(cp.x + rnd(-2.5, 2.5), cp.y + 18, cp.z + rnd(-2.5, 2.5)); bolt(_a, cp, fx, 0.45);
      glow(cp, 0xffe6f2, 7, 0.3); glow(cp, fx.c, 3.8, 0.65); light(cp, 0xff7aa8, 9, 0.5); dome(cp, fx.c, 3.2, 0.6);
      ring(gp, fx.c, 5, 0.65); decal(gp, boltMarkTex(), 4.2, 2.4, 0xffffff, 0x900a3c);
      for (let i = 0; i < 70; i++) { _v.set(rnd(-1, 1), rnd(-0.4, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 11)); E(P, cp, _v.x, _v.y, _v.z, Math.random() < 0.2 ? 0xffffff : pick(fx), rnd(0.06, 0.1) * k, rnd(0.25, 0.6), { drag: 5, so: 0.45 }); }
      body(t, fx, 2.0, true);
    },
    // 글리치: 몸이 픽셀로 깨져 흩어짐(세 번에 나눠) · 빨강·하늘색 선 상자가 어긋나며 떨림 · 데이터 기둥 · 네모 충격파
    glitch(t, fx, gp, cp, k) {
      const P = pool();
      glow(cp, fx.c, 4, 0.3); light(cp, 0xff5070, 4, 0.45);
      ring(gp, fx.c2, 4.2, 0.65, sqRingTex()); ring(gp, fx.c, 3, 0.55, sqRingTex(), 0.15);
      decal(gp, pixTex(), 3.6, 2.0, 0xffffff, 0x60000e);
      pillar(gp, fx.c2, 0.8, 6.5, 0.9, stripeTex(), 2.4);
      const yaw = t.bodyYaw || 0;
      for (const [col, off] of [[fx.c, 0.05], [fx.c2, -0.05]]) {
        const box = new THREE.LineSegments(geo().box, lineMat(col)); box.renderOrder = 8; let nt = 0;
        add(box, 0.75, (e, u) => {
          if (e.t >= nt) { nt = e.t + 0.045; box.visible = Math.random() < 0.82; box.position.set(gp.x + off + rnd(-0.06, 0.06), gp.y + 0.95 * (1 - u * 0.55) + rnd(-0.04, 0.04), gp.z + rnd(-0.06, 0.06)); }
          box.scale.set(0.85 + rnd(-0.04, 0.04), 1.85 * (1 - u * 0.55), 0.85); box.rotation.y = yaw; box.material.opacity = 1 - u * 0.7;
        });
      }
      let wave = 0;
      add(null, 0.5, (e) => {
        const due = e.t < 0.2 ? 1 : e.t < 0.42 ? 2 : 3;
        while (wave < due) {
          wave++;
          for (let i = 0; i < 36; i++) { bodyPoint(t, _a); E(P, _a, rnd(-0.5, 0.5), rnd(0.5, 1.8), rnd(-0.5, 0.5), Math.random() < 0.12 ? 0xffffff : pick(fx), rnd(0.09, 0.17) * k, rnd(0.8, 1.5), { sq: 1, drag: 0.8, so: 0.9 }); }
        }
      });
      body(t, fx, 1.8, true);
    },
    // 서리: 바닥이 얼어붙고(얼음 금) 얼음 결정이 솟았다 부서져 떨어짐 · 얼음 껍질(돔) · 하얀 냉기 고리
    frost(t, fx, gp, cp, k) {
      const P = pool();
      glow(cp, 0xffffff, 4.2, 0.35); light(cp, fx.c, 6, 0.7); dome(cp, fx.c, 1.6, 0.9);
      ring(gp, fx.c2, 4.4, 0.8); ring(gp, fx.c, 2.6, 0.6, null, 0.1);
      decal(gp, iceTex(), 4.2, 3.0, 0xffffff, 0x2a6a9a);
      pillar(gp, fx.c, 0.6, 3.6, 0.8);
      for (let i = 0; i < 46; i++) { const a = Math.random() * TAU, r = Math.random() * 0.5, o = rnd(0.5, 2.6); _a.set(gp.x + Math.cos(a) * r, gp.y + 0.3, gp.z + Math.sin(a) * r); E(P, _a, Math.cos(a) * o, rnd(3.5, 8), Math.sin(a) * o, Math.random() < 0.5 ? fx.c : fx.c2, rnd(0.1, 0.2) * k, rnd(0.9, 1.5), { sq: 1, g: -9.8, drag: 0.4, so: 0.85 }); }
      for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, r = rnd(0.3, 1.8); _a.set(gp.x + Math.cos(a) * r, gp.y + rnd(0.05, 0.5), gp.z + Math.sin(a) * r); E(P, _a, Math.cos(a) * 0.5, rnd(0.1, 0.5), Math.sin(a) * 0.5, 0xeafcff, rnd(0.3, 0.5) * k, rnd(1, 1.8), { grow: 1, drag: 1, so: 0.35 }); }
      body(t, fx, 2.0, true);
    },
    // 공허: 주변이 한 점으로 빨려 들어가며 검보라 구가 줄어들다(안쪽으로 모이는 입자) 터지고 · 바닥에 소용돌이 자국 · 보라 고리
    void(t, fx, gp, cp, k) {
      const P = pool();
      const sp = new THREE.Mesh(geo().sph, domeMat(fx.c)); sp.position.copy(cp); sp.renderOrder = 6;
      add(sp, 0.55, (e, u) => { sp.scale.setScalar(2.4 * (1 - u) + 0.05); sp.material.uniforms.uA.value = 0.4 + u * 0.6; sp.material.uniforms.uT.value = e.t; });
      for (let i = 0; i < 60; i++) { _v.set(rnd(-1, 1), rnd(-0.6, 1), rnd(-1, 1)).normalize(); const R = rnd(1.6, 3); _a.copy(cp).addScaledVector(_v, R); E(P, _a, -_v.x * R * 1.9, -_v.y * R * 1.9, -_v.z * R * 1.9, Math.random() < 0.7 ? fx.c : fx.c2, rnd(0.08, 0.14) * k, 0.5, { so: 0.85 }); }
      decal(gp, swirlTex(), 4.4, 2.6, 0xe6c8ff, 0x3a0a5a);
      let burst = false;
      add(null, 0.6, (e) => {
        if (e.t < 0.5 || burst) return; burst = true;
        glow(cp, fx.c2, 5, 0.4); light(cp, fx.c, 7, 0.6); ring(gp, fx.c, 4.8, 0.7); pillar(gp, fx.c, 0.5, 5, 0.7);
        for (let i = 0; i < 50; i++) { _v.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, 9)); E(P, cp, _v.x, _v.y, _v.z, Math.random() < 0.25 ? 0xffffff : pick(fx), rnd(0.06, 0.11) * k, rnd(0.3, 0.6), { drag: 4, so: 0.5 }); }
      });
      body(t, fx, 2.0, true);
    },
    // 테스터(프리즘 감옥): 쓰러진 몸을 무지개 육각 기둥 틀이 감싸고 돌다가 한 점으로 접히며 터짐 → 무지개 조각이 솟아오름
    //  · 바닥에 무지개 육각 격자 자국 · 색이 다른 고리 세 겹이 차례로 퍼짐 · 하얀 빛 기둥
    prism(t, fx, gp, cp, k) {
      const P = pool(), C = GunSkin.PRISM;
      glow(cp, 0xffffff, 4.4, 0.35); light(cp, 0xbff8ff, 8, 0.9);
      ring(gp, C[2], 4.6, 0.75); ring(gp, C[0], 3.4, 0.7, null, 0.12); ring(gp, C[4], 2.3, 0.6, null, 0.24);
      decal(gp, hexTex(), 4.4, 2.8, 0xffffff, 0x2a3a6a);
      // 육각 기둥 틀: 색 세 묶음(각 묶음 = 세로 모서리 2개 + 위아래 테두리 2변씩) → 같은 선 재질 프로그램을 씀
      const grp = new THREE.Group(), R = 0.75, H = 2.1, cols = [C[0], C[2], C[4]];
      for (let gi = 0; gi < 3; gi++) {
        const v = [];
        for (const i of [gi * 2, gi * 2 + 1]) {
          const a = i * TAU / 6, b = (i + 1) * TAU / 6, x0 = Math.cos(a) * R, z0 = Math.sin(a) * R, x1 = Math.cos(b) * R, z1 = Math.sin(b) * R;
          v.push(x0, 0, z0, x0, H, z0, x0, 0, z0, x1, 0, z1, x0, H, z0, x1, H, z1);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        const ls = new THREE.LineSegments(g, lineMat(cols[gi])); ls.userData.own = true; ls.renderOrder = 8; grp.add(ls);
      }
      grp.position.set(gp.x, gp.y, gp.z);
      let burst = false;
      add(grp, 1.15, (e, u) => {
        const open = Math.min(1, u / 0.25), ok = 1 - Math.pow(1 - open, 3), shut = u < 0.58 ? 0 : Math.min(1, (u - 0.58) / 0.16), sk = 1 - shut * shut;
        grp.rotation.y += e.dt * (2 + shut * 14);
        grp.scale.set(Math.max(0.02, (0.35 + 0.65 * ok) * sk), Math.max(0.02, ok * (1 - shut * 0.5)), Math.max(0.02, (0.35 + 0.65 * ok) * sk));
        grp.position.y = gp.y + shut * 0.9;
        for (const ls of grp.children) ls.material.opacity = u < 0.74 ? 1 : 0;
        if (!burst && u >= 0.74) {
          burst = true; _a.set(gp.x, gp.y + 1.05, gp.z); glow(_a, 0xffffff, 5.2, 0.45); light(_a, C[(Math.random() * 6) | 0], 7, 0.5); pillar(gp, 0xe8fbff, 0.45, 6.5, 0.75, stripeTex(), 2);
          for (let i = 0; i < 72; i++) { _v.set(rnd(-1, 1), rnd(-0.2, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 8)); E(P, _a, _v.x, _v.y, _v.z, i % 7 === 0 ? 0xffffff : C[i % 6], rnd(0.08, 0.15) * k, rnd(0.5, 1.0), { sq: i % 2 === 0, g: -3, drag: 1.8, so: 0.8 }); }
        }
      });
      // 틀이 도는 동안 몸에서 무지개 조각이 틀 쪽으로 빨려 나감
      add(null, 0.7, (e) => { if (Math.random() < 0.7) { bodyPoint(t, _a); _v.set(_a.x - gp.x, 0, _a.z - gp.z).normalize(); E(P, _a, _v.x * 1.2, rnd(0.2, 0.8), _v.z * 1.2, C[(Math.random() * 6) | 0], rnd(0.06, 0.1) * k, 0.4, { sq: 1, drag: 1, so: 0.85 }); } });
      body(t, fx, 2.2, true);
    },
  };
  // 테스터 바닥 자국: 무지개 육각 격자 + 가운데 하얀 빛
  const hexTex = () => ctex('hex', 256, 256, (g) => {
    halo(g, 90, [[0, 'rgba(255,255,255,0.85)'], [0.35, 'rgba(200,250,255,0.3)'], [1, 'rgba(160,220,255,0)']]);
    const R = 15, w = Math.sqrt(3) * R;
    for (let j = -1; j < 12; j++) for (let i = -1; i < 11; i++) {
      const x = i * w + (j % 2 ? w / 2 : 0), y = j * R * 1.5, d = Math.hypot(x - 128, y - 128) / 128; if (d > 0.95) continue;
      g.strokeStyle = `hsla(${(Math.atan2(y - 128, x - 128) / TAU * 360 + 360) % 360},95%,68%,${(1 - d) * 0.95})`; g.lineWidth = 2.2;
      g.beginPath(); for (let k2 = 0; k2 < 6; k2++) { const a = -Math.PI / 2 + k2 * TAU / 6, px = x + Math.cos(a) * R * 0.92, py = y + Math.sin(a) * R * 0.92; k2 ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.stroke();
    }
  });
  // 슈퍼레어(약한 효과): 작은 빛 + 바닥 고리 하나 + 위로 흩어지는 조각 몇 개 — 휘장·빛 기둥·바닥 자국·조명 없음
  function liteKill(t, fx, gp, cp, k) {
    const P = pool();
    glow(cp, fx.c, 1.8, 0.3);
    ring(gp, fx.c, 1.9, 0.5, fx.kind === 'glitch' ? sqRingTex() : null);
    for (let i = 0; i < 16; i++) { const a = Math.random() * TAU; E(P, cp, Math.cos(a) * rnd(0.4, 1.4), rnd(1, 3), Math.sin(a) * rnd(0.4, 1.4), pick(fx), rnd(0.05, 0.09) * k, rnd(0.4, 0.7), { sq: fx.kind === 'glitch', g: -4, drag: 1.5, so: 0.75 }); }
    body(t, fx, 0.6, true);
  }
  // 주변을 잠깐 그 색으로 비춤 (총구 화염용 점광원을 빌려 씀 → 조명 개수가 그대로라 셰이더를 다시 만들지 않는다)
  let LIGHT = null;
  function light(p, color, i0, dur) { if (!G.muzzleLight || !G.camera || p.distanceTo(G.camera.position) > 70) return; LIGHT = { p: p.clone(), color, i0, t: 0, dur }; }
  function updateLight(dt) {
    const L = G.muzzleLight; LIGHT.t += dt; const u = LIGHT.t / LIGHT.dur;
    if (!L || u >= 1) { if (L) { L.color.setHex(0xffb060); L.distance = 9; } LIGHT = null; return; }
    L.position.copy(LIGHT.p); L.color.setHex(LIGHT.color); L.distance = 16; L.intensity = LIGHT.i0 * (1 - u) * (1 - u);
  }
  // t: 쓰러진 캐릭터 · by: 처치한 캐릭터 · cause: 무기 id (그 총에 장착한 스킨이 울트라레어일 때만)
  function kill(t, by, cause) {
    if (!scene || !t || !by || by === t || !by.skinOf) return;
    const sk = by.skinOf(cause), d = sk && GSKINS[sk], fx = d && (d.fx || d.lite); if (!fx) return;
    if (by.isPlayer && !fx.lite && typeof HUD !== 'undefined' && HUD.skinKill) HUD.skinKill(fx, GunSkin.name(sk));   // 휘장은 울트라레어만
    if (!G.camera) return;
    const cp = new THREE.Vector3(); t.chest(cp);
    if (cp.distanceTo(G.camera.position) > (fx.lite ? 160 : 320)) return;
    const gp = ground(t.pos.x, t.pos.y, t.pos.z), k = farK(cp, 25, 2.5);
    if (t.inWater) gp.y = t.pos.y + 0.3;
    if (fx.lite) liteKill(t, fx, gp, cp, k);
    else (KILL[fx.kind] || KILL.ember)(t, fx, gp, cp, k);
    if (typeof Audio !== 'undefined' && Audio.skinFx) Audio.skinFx('kill', fx.kind, by.isPlayer ? null : cp, !!by.isPlayer, !!fx.lite);
  }

  // ---------- 매 프레임 (GunSkin.update 안에서, 입자 갱신 전에) ----------
  function update(dt) {
    if (!scene) return;
    if (needWarm) warmUp();
    else if (warmGrp && --warmN <= 0) { if (warmGrp.parent) warmGrp.parent.remove(warmGrp); warmGrp = null; }
    for (let i = LIVE.length - 1; i >= 0; i--) {
      const e = LIVE[i]; e.t += dt; e.dt = dt;
      const u = Math.min(1, e.t / e.dur); e.upd(e, u, dt);
      if (u >= 1) { if (e.o) { if (e.o.parent) e.o.parent.remove(e.o); free(e.o); } LIVE.splice(i, 1); }
    }
    if (BODY.size) {
      const P = pool(), cam = G.camera;
      for (const [c, s] of BODY) {
        s.t += dt;
        if (s.t >= s.dur || !c.root || !c.root.parent || (s.corpse && c.alive)) { BODY.delete(c); continue; }
        if (!cam || !c.root.visible || c.pos.distanceTo(cam.position) > 140) continue;
        const f = 1 - s.t / s.dur, k = farK(c.pos, 6, 3.5), kind = s.fx.kind;
        s.acc += dt * (RATE[kind] || 20) * (s.corpse ? 1.4 : 1) * (0.35 + 0.65 * f) * (s.fx.lite ? 0.35 : 1);
        for (; s.acc >= 1; s.acc--) { bodyPoint(c, _a); (BODYFX[kind] || BODYFX.ember)(P, _a, s.fx, k); }
        if (kind === 'spark') { s.bt -= dt; if (s.bt <= 0) { s.bt = rnd(0.05, 0.1) / (s.corpse ? 1.4 : 1); bodyPoint(c, _a); bodyPoint(c, _b); if (_a.distanceTo(_b) > 0.12) arc(_a, _b, Math.random() < 0.5 ? 0xffe8f2 : s.fx.c, 0.06 * Math.sqrt(k), rnd(0.1, 0.2)); } }
      }
    }
    if (ARCS.length) updateArcs(dt);
    if (LIGHT) updateLight(dt);
  }
  return { init, hit, kill, update, _live: LIVE, _body: BODY };
})();
