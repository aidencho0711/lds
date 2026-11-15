// ============================================================
// 10_winter.js — 겨울·크리스마스 로비 (v20 크리스마스 업데이트)
//  · WINTER.on(): 11월 15일 ~ 2월 15일 (기기 날짜) — 끝나면 저절로 원래 로비
//  · 로비 장면에 더함: 눈 덮인 땅·상자·컨테이너·나무 꼭대기 · 내리는 눈(점 1,600개) · 장식 트리(전구가 반짝이고 별이 빛남) · 선물 상자 · 눈사람
//    · 울타리 기둥 사이 전구 줄 · 트리 옆 따뜻한 빛 — 그림·모델 모두 코드로 (외부 에셋 없음)
//  · 캐릭터(가운데)와 왼쪽 창을 가리지 않게 오른쪽 뒤·왼쪽 뒤에 배치
// ============================================================
const WINTER = {
  on() { const d = new Date(), m = d.getMonth() + 1, day = d.getDate(); return m === 12 || m === 1 || (m === 11 && day >= 15) || (m === 2 && day <= 15); },
  fog: 0xdde6ee,
};
const WinterLobby = (() => {
  const SNOW = 0xf2f6f9;
  let snowMat = null; const snow = () => snowMat || (snowMat = new THREE.MeshLambertMaterial({ color: SNOW }));
  const glowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (t = new THREE.CanvasTexture(c)); }; })();
  const flakeTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (t = new THREE.CanvasTexture(c)); }; })();
  const BULB = [0xff3a3a, 0xffc93a, 0x3aff7a, 0x3aa8ff, 0xfff2d8];
  function mesh(geo, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; return m; }
  // 반짝이는 전구 묶음: 색마다 재질 하나 → 매 프레임 색 세기만 바꿈
  function bulbs() { return BULB.map((c, i) => ({ base: new THREE.Color(c), mat: new THREE.MeshBasicMaterial({ color: c }), ph: i * 1.3 })); }
  function twinkle(B, t, speed = 1) { for (const b of B) { const k = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 * speed + b.ph)) ** 2; b.mat.color.copy(b.base).multiplyScalar(0.25 + 0.75 * k + 0.15); } }

  // 장식 트리: 원뿔 4단(눈 가루) + 줄기 · 나선 전구 · 장식 공 · 꼭대기 별(빛 번짐) · 아래 선물 상자
  function tree(B) {
    const g = new THREE.Group(), green = new THREE.MeshLambertMaterial({ color: 0x1d4a2e }), tip = new THREE.MeshLambertMaterial({ color: 0xe8f0f4 });
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x4a2e1a }), 0, 0.3, 0));
    const T = [[1.55, 1.5, 0.5], [1.25, 1.35, 1.2], [0.95, 1.2, 1.85], [0.62, 1.0, 2.45]];
    for (const [r, h, y] of T) { g.add(mesh(new THREE.ConeGeometry(r, h, 12), green, 0, y + h / 2, 0)); const s = mesh(new THREE.ConeGeometry(r * 0.98, h * 0.18, 12, 1, true), tip, 0, y + h * 0.1, 0); s.scale.set(1.02, 1, 1.02); g.add(s); }
    // 나선 전구 (원뿔 겉면을 따라 4바퀴)
    const sg = new THREE.SphereGeometry(0.055, 8, 6);
    for (let i = 0; i < 72; i++) { const u = i / 72, y = 0.65 + u * 2.6, R = 1.5 * (1 - (y - 0.5) / 3.05) + 0.06, a = u * TAU * 4; const m = new THREE.Mesh(sg, B[i % B.length].mat); m.position.set(Math.cos(a) * R, y, Math.sin(a) * R); g.add(m); }
    // 장식 공 (빨강·금)
    const og = new THREE.SphereGeometry(0.1, 12, 8), om = [new THREE.MeshStandardMaterial({ color: 0xc8202e, metalness: 0.6, roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xd9a93a, metalness: 0.8, roughness: 0.2 })];
    for (let i = 0; i < 18; i++) { const y = 0.8 + (i / 18) * 2.3, R = 1.5 * (1 - (y - 0.5) / 3.05) + 0.02, a = i * 2.4; g.add(mesh(og, om[i % 2], Math.cos(a) * R, y, Math.sin(a) * R)); }
    // 꼭대기 별: 다섯 갈래 별을 두께 있게 + 빛 번짐
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.11 : 0.27; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    const starG = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); starG.translate(0, 0, -0.03);
    const star = new THREE.Mesh(starG, new THREE.MeshBasicMaterial({ color: 0xffd65a })); star.position.y = 3.72; g.add(star);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(1.6); halo.position.y = 3.72; g.add(halo);
    // 선물 상자 (리본 십자 + 매듭)
    const gifts = [[0.9, 0.5, 0x2a7a3a, 0xe8c45a, 0.42], [-0.8, 0.7, 0xc8202e, 0xf2f2ee, 0.36], [0.2, 1.05, 0x2a5ac8, 0xe8c45a, 0.3], [-0.2, -0.95, 0xe8c45a, 0xc8202e, 0.34], [1.1, -0.5, 0xf2f2ee, 0xc8202e, 0.28]];
    for (const [x, z, c, rc, s] of gifts) {
      const gb = new THREE.Group(); gb.position.set(x, 0, z); gb.rotation.y = x * 2.1;
      gb.add(mesh(new THREE.BoxGeometry(s, s * 0.8, s), new THREE.MeshLambertMaterial({ color: c }), 0, s * 0.4, 0));
      const rm = new THREE.MeshLambertMaterial({ color: rc });
      gb.add(mesh(new THREE.BoxGeometry(s * 1.02, s * 0.82, s * 0.14), rm, 0, s * 0.4, 0)); gb.add(mesh(new THREE.BoxGeometry(s * 0.14, s * 0.82, s * 1.02), rm, 0, s * 0.4, 0));
      for (const sx of [-1, 1]) { const bow = mesh(new THREE.TorusGeometry(s * 0.12, s * 0.035, 6, 10), rm, sx * s * 0.1, s * 0.86, 0); bow.rotation.set(0, Math.PI / 2, sx * 0.5); gb.add(bow); }
      g.add(gb);
    }
    return { g, star, halo };
  }
  // 눈사람: 눈덩이 셋 · 숯 눈·단추 · 당근 코 · 빨간 목도리 · 검은 모자 · 나뭇가지 팔
  function snowman() {
    const g = new THREE.Group(), w = snow(), coal = new THREE.MeshLambertMaterial({ color: 0x1a1a1c }), red = new THREE.MeshLambertMaterial({ color: 0xc8202e }), brown = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
    g.add(mesh(new THREE.SphereGeometry(0.5, 16, 12), w, 0, 0.45, 0)); g.add(mesh(new THREE.SphereGeometry(0.36, 16, 12), w, 0, 1.12, 0)); g.add(mesh(new THREE.SphereGeometry(0.25, 16, 12), w, 0, 1.6, 0));
    for (const x of [-0.08, 0.08]) g.add(mesh(new THREE.SphereGeometry(0.03, 6, 4), coal, x, 1.66, 0.22));
    for (const y of [1.0, 1.14, 1.28]) g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), coal, 0, y, 0.35));
    const nose = mesh(new THREE.ConeGeometry(0.04, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0xf07a1a }), 0, 1.6, 0.33); nose.rotation.x = Math.PI / 2; g.add(nose);
    const sc = mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 18), red, 0, 1.4, 0); sc.rotation.x = Math.PI / 2; g.add(sc);
    const tail = mesh(new THREE.BoxGeometry(0.1, 0.32, 0.04), red, 0.16, 1.26, 0.2); tail.rotation.z = 0.25; g.add(tail);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16), coal, 0, 1.82, 0)); g.add(mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.24, 16), coal, 0, 1.95, 0));
    for (const s of [1, -1]) { const arm = mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.75, 5), brown, s * 0.55, 1.25, 0); arm.rotation.z = s * -1.0; g.add(arm); }
    return g;
  }
  // 울타리 기둥 사이 처진 전구 줄
  function stringLights(B, posts) {
    const g = new THREE.Group(), sg = new THREE.SphereGeometry(0.06, 8, 6), wire = [];
    for (let i = 0; i < posts.length - 1; i++) {
      const [x0, y0, z0] = posts[i], [x1, , z1] = posts[i + 1];
      for (let k = 0; k <= 7; k++) { const u = k / 7, x = lerp(x0, x1, u), z = lerp(z0, z1, u), y = y0 - 0.38 * Math.sin(Math.PI * u); wire.push(new THREE.Vector3(x, y, z)); if (k > 0 && k < 7) { const m = new THREE.Mesh(sg, B[(i * 6 + k) % B.length].mat); m.position.set(x, y - 0.07, z); g.add(m); } }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x202020 })));
    return g;
  }
  // 내리는 눈: 카메라 앞 상자 안을 천천히 떨어지며 흔들림 (바닥에 닿으면 위로)
  function snowfall(n = 1600) {
    const pos = new Float32Array(n * 3), sp = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-16, 16); pos[i * 3 + 1] = rnd(0, 10); pos[i * 3 + 2] = rnd(-22, 7); sp[i] = rnd(0.45, 1.1); ph[i] = rnd(0, TAU); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: flakeTex(), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false;
    return { pts, update(dt, t) { for (let i = 0; i < n; i++) { const j = i * 3; pos[j + 1] -= sp[i] * dt; pos[j] += Math.sin(t * 0.8 + ph[i]) * 0.25 * dt; if (pos[j + 1] < 0) { pos[j + 1] = 10; pos[j] = rnd(-16, 16); } } geo.attributes.position.needsUpdate = true; } };
  }
  // sc: 로비 장면 · o: { ground, trees: [[x, z], ...], posts: [[x, y, z], ...] }
  function build(sc, o) {
    if (o.ground) o.ground.material.color.setHex(0xe1e9ef);
    const w = snow(), root = new THREE.Group(); sc.add(root);
    // 나무 꼭대기 눈 · 상자·컨테이너·모래주머니 위 눈 · 눈 둔덕
    const cap = new THREE.ConeGeometry(0.7, 2.05, 7);
    for (const [x, z] of o.trees || []) root.add(mesh(cap, w, x, 3.98, z));
    for (const [x, y, z, sx, sz, ry] of [[-2.7, 0.83, -1.5, 1.24, 0.84, 0.3], [-2.5, 1.43, -1.6, 0.94, 0.64, 0.1], [12, 2.65, -15, 2.5, 6.2, 0.5], [-13, 2.65, -16, 2.5, 6.2, -0.4], [6.35, 0.76, -3.6, 2.9, 0.55, 0.1]]) { const m = mesh(new THREE.BoxGeometry(sx, 0.07, sz), w, x, y, z, ry); root.add(m); }
    const rim = mesh(new THREE.TorusGeometry(2.36, 0.09, 6, 48), w, 0, 0.17, 0); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.6; root.add(rim);   // 받침대 가장자리에 쌓인 눈
    const mound = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2);
    for (const [x, z, s] of [[-4.2, -1.2, 0.9], [3.8, -1.6, 0.7], [-7.5, -7.0, 1.6], [8.5, -9.0, 1.8], [1.5, -8.5, 1.2], [-1.8, -5.5, 0.8]]) { const m = mesh(mound, w, x, 0, z); m.scale.set(s, s * 0.32, s * 0.9); root.add(m); }
    // 트리 · 눈사람 · 전구 줄 · 따뜻한 빛
    const B = bulbs(), T = tree(B); T.g.position.set(4.9, 0, -7.4); T.g.rotation.y = -0.5; root.add(T.g);
    const sm = snowman(); sm.position.set(-1.8, 0, -4.9); sm.rotation.y = 0.35; root.add(sm);
    if (o.posts && o.posts.length > 1) root.add(stringLights(B, o.posts));
    const warm = new THREE.PointLight(0xffb060, 0.9, 9, 2); warm.position.set(4.6, 2.2, -6.4); root.add(warm);
    const fall = snowfall(); root.add(fall.pts);
    return {
      root,
      update(dt, t) { twinkle(B, t); fall.update(dt, t); const k = 0.8 + 0.2 * Math.sin(t * 2.4); T.halo.scale.setScalar(1.4 + 0.5 * k); T.halo.material.opacity = 0.6 + 0.4 * k; T.star.rotation.y = Math.sin(t * 0.6) * 0.35; warm.intensity = 0.75 + 0.2 * Math.sin(t * 3.1) * Math.sin(t * 1.7); },
    };
  }
  return { build };
})();
