// ============================================================
// 05_models_gdeco.js — 테스터 총기 스킨의 각인 · 엠블럼 · 홀로그램 (v20)
//  · 베타 테스터 한정 컬렉션 공통: 육각형 BETA 엠블럼 + 그 아래 고유 번호(No.001~003)
//  · 글자는 모두 캔버스로 직접 그린 텍스처(외부 그림 없음). 총 몸체 옆면은 광선으로 잰 표면(GunParts.probe)에, 탄창 글자는 탄창 부품에 붙여 같이 움직인다
//  · kind: emblem(엠블럼) · text(발광 글자 neon / 각인 engrave / 경고 warn) · hidden(특정 각도에서만 보이는 글자)
//          holo(조준 장치 둘레 홀로그램 괄호 — 1인칭 정조준 때 숨김) · rim(조준경 앞뒤 금테) · pips(탄창 에너지 표시등)
//  · 꺼내기·넣기 빛 띠가 지나가면 나타나고 사라진다(GunSkin.update 가 z 로 판단)
// ============================================================
const GunDeco = (() => {
  const TEX = {};
  const FONT = (w, px) => `${w} ${px}px "Saira Condensed","Arial Narrow",Arial,sans-serif`;
  function ctex(key, W, H, draw) {
    if (TEX[key]) return TEX[key];
    const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return (TEX[key] = t);
  }
  const hexPath = (g, cx, cy, r) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; i ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); };
  // 육각 BETA 엠블럼: 검은 겹육각 · 시안 빛 테 · 가운데 BETA · 아래 번호판
  function emblemTex(no) {
    return ctex('emb' + no, 256, 330, (g) => {
      const cx = 128, cy = 124;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 10; hexPath(g, cx, cy, 116); g.fillStyle = '#0b0d0f'; g.fill(); g.restore();
      hexPath(g, cx, cy, 116); g.lineWidth = 5; g.strokeStyle = '#3a4046'; g.stroke();
      hexPath(g, cx, cy, 100); g.fillStyle = '#15191c'; g.fill();
      g.save(); g.shadowColor = '#3ff5ff'; g.shadowBlur = 18; hexPath(g, cx, cy, 86); g.lineWidth = 7; g.strokeStyle = '#5ff8ff'; g.stroke(); g.restore();
      hexPath(g, cx, cy, 74); const gr = g.createRadialGradient(cx, cy - 10, 4, cx, cy, 80); gr.addColorStop(0, '#163a44'); gr.addColorStop(1, '#070a0c'); g.fillStyle = gr; g.fill();
      g.fillStyle = '#7ffbff'; for (const [x, y] of [[cx - 50, cy - 40], [cx + 50, cy - 40], [cx - 50, cy + 40], [cx + 50, cy + 40]]) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
      g.save(); g.shadowColor = '#3ff5ff'; g.shadowBlur = 14; g.font = FONT(900, 50); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#e9feff'; g.fillText('BETA', cx, cy + 2); g.restore();
      g.fillStyle = '#3ff5ff'; g.fillRect(cx - 34, cy + 28, 68, 3);
      // 번호판
      const py = 268; g.beginPath(); g.moveTo(cx - 70, py - 24); g.lineTo(cx + 70, py - 24); g.lineTo(cx + 84, py); g.lineTo(cx + 70, py + 24); g.lineTo(cx - 70, py + 24); g.lineTo(cx - 84, py); g.closePath();
      g.fillStyle = '#0b0d0f'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#3ff5ff'; g.stroke();
      g.font = FONT(800, 32); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#bffcff'; g.fillText('No.' + no, cx, py + 1);
    });
  }
  // 글자 판. style: neon(빛나는 글자) · engrave(금 각인) · warn(경고 띠) · plain
  function textTex(text, style, col, W = 512, H = 96) {
    return ctex(['t', text, style, col, W, H].join('|'), W, H, (g) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (style === 'warn') {
        g.fillStyle = '#121213'; g.fillRect(0, 0, W, H);
        g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.fillStyle = '#ffb21e';
        for (let x = -H; x < W + H; x += 34) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 17, 0); g.lineTo(x + 17 - H * 0.22, H * 0.22); g.lineTo(x - H * 0.22, H * 0.22); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, H); g.lineTo(x + 17, H); g.lineTo(x + 17 + H * 0.22, H * 0.78); g.lineTo(x + H * 0.22, H * 0.78); g.closePath(); g.fill(); }
        g.restore();
        g.fillStyle = '#121213'; g.fillRect(0, H * 0.24, W, H * 0.52);
        g.save(); g.shadowColor = col; g.shadowBlur = 10; g.font = FONT(900, H * 0.42); g.fillStyle = col; g.fillText(text, W / 2, H / 2 + 1); g.restore();
        return;
      }
      if (style === 'engrave') {
        g.font = FONT(800, H * 0.6);
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(text, W / 2 + 2, H / 2 + 3);
        const gr = g.createLinearGradient(0, H * 0.2, 0, H * 0.8); gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#8a6a2a'); g.fillStyle = gr; g.fillText(text, W / 2, H / 2);
        g.strokeStyle = 'rgba(255,240,200,0.6)'; g.lineWidth = 1; g.strokeText(text, W / 2, H / 2);
        return;
      }
      g.font = FONT(800, H * 0.62);
      if (style === 'neon') { g.save(); g.shadowColor = col; g.shadowBlur = H * 0.25; g.fillStyle = col; g.fillText(text, W / 2, H / 2); g.restore(); g.fillStyle = '#ffffff'; g.globalAlpha = 0.85; g.fillText(text, W / 2, H / 2); return; }
      g.fillStyle = col; g.fillText(text, W / 2, H / 2);
    });
  }
  // 탄창 에너지 표시등: 다섯 칸 중 네 칸 켜짐
  const pipsTex = (col) => ctex('pips' + col, 256, 64, (g) => { for (let i = 0; i < 5; i++) { g.fillStyle = i < 4 ? col : 'rgba(255,255,255,0.15)'; g.save(); if (i < 4) { g.shadowColor = col; g.shadowBlur = 10; } g.fillRect(12 + i * 48, 16, 36, 32); g.restore(); } });
  // 조준 장치 둘레 홀로그램 괄호
  const holoTex = (col) => ctex('holo' + col, 256, 128, (g) => {
    g.strokeStyle = col; g.lineWidth = 5; g.shadowColor = col; g.shadowBlur = 12;
    for (const [x, y, sx, sy] of [[16, 16, 1, 1], [240, 16, -1, 1], [16, 112, 1, -1], [240, 112, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * 30); g.lineTo(x, y); g.lineTo(x + sx * 40, y); g.stroke(); }
    g.lineWidth = 2; g.globalAlpha = 0.6; for (let x = 70; x < 190; x += 12) { g.beginPath(); g.moveTo(x, 58); g.lineTo(x, x % 36 === 10 ? 74 : 68); g.stroke(); }
    g.globalAlpha = 1; g.font = FONT(700, 22); g.fillStyle = col; g.textAlign = 'center'; g.fillText('β-LINK', 128, 98);
  });
  // 살펴보기 홀로그램 창 (ZERO PROTOCOL)
  const panelTex = () => ctex('panel', 512, 256, (g) => {
    g.fillStyle = 'rgba(10,40,48,0.55)'; g.fillRect(8, 8, 496, 240);
    g.strokeStyle = '#5ff8ff'; g.lineWidth = 4; g.shadowColor = '#3ff5ff'; g.shadowBlur = 14; g.strokeRect(8, 8, 496, 240); g.shadowBlur = 0;
    g.fillStyle = '#5ff8ff'; g.fillRect(8, 8, 120, 10); g.fillRect(384, 238, 120, 10);
    g.font = FONT(900, 64); g.textAlign = 'left'; g.textBaseline = 'middle'; g.shadowColor = '#3ff5ff'; g.shadowBlur = 16; g.fillStyle = '#e9feff'; g.fillText('SYSTEM ONLINE', 36, 78); g.shadowBlur = 0;
    g.font = FONT(700, 28); g.fillStyle = '#7ffbff'; g.fillText('ZERO PROTOCOL  ·  BETA-001', 36, 140);
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(95,248,255,0.25)'; g.fillRect(36, 172 + i * 16, 300, 8); g.fillStyle = '#5ff8ff'; g.fillRect(36, 172 + i * 16, [280, 210, 250, 150][i], 8); }
    g.globalAlpha = 0.18; g.fillStyle = '#ffffff'; for (let y = 10; y < 248; y += 4) g.fillRect(8, y, 496, 1);
  });

  // ---------- 재질 ----------
  const flat = (map, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o));
  // 특정 각도(비스듬히 볼 때)에서만 보이는 글자 — 정면이나 완전히 옆에서는 안 보임
  const HV = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const HF = 'uniform sampler2D map; uniform vec3 uC; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { float f = abs(dot(vN, vV)); float a = smoothstep(0.08, 0.2, f) * smoothstep(0.66, 0.42, f); vec4 t = texture2D(map, vUv); vec3 c = uC * (1.5 + 0.4 * sin(uT * 3.0 + vUv.x * 9.0)); gl_FragColor = vec4(c * t.a, t.a * a); }';
  const hiddenMat = (map, col) => new THREE.ShaderMaterial({ uniforms: { map: { value: map }, uC: { value: new THREE.Color(col) }, uT: GunDeco_T }, vertexShader: HV, fragmentShader: HF, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const PLANE = new THREE.PlaneGeometry(1, 1);

  // ---------- 붙이기 ----------
  //  d.deco: [{ kind, side('L'|'R'|'LR'|'top'), z(몸체 비율), dy(총열 높이 기준 m), w(m), h(m), text, style, col, no, on:'mag' }]
  function attach(g, d, z0, z1) {
    const out = [], m = g.userData.meta, parts = g.userData.parts || {};
    for (const e of d.deco || []) {
      if (e.kind === 'rim') { rims(g, e, out); continue; }
      if (e.kind === 'holo') { holo(g, e, out); continue; }
      if (e.kind === 'wings') { wings(g, e, out); continue; }
      for (const side of e.side === 'LR' ? ['L', 'R'] : [e.side || 'L']) {
        let host = g, p = null;
        if (e.on === 'mag') {
          const mg = parts.mag; if (!mg) continue;
          g.updateMatrixWorld(true); const bb = new THREE.Box3(); mg.children.forEach((ch) => bb.expandByObject(ch)); if (bb.isEmpty()) continue;
          const c = bb.getCenter(new THREE.Vector3()); p = [side === 'L' ? bb.max.x : bb.min.x, c.y + (e.dy || 0), c.z + (e.dz || 0)];
          host = mg; p[0] -= mg.position.x; p[1] -= mg.position.y; p[2] -= mg.position.z;
        } else p = GunParts.probe(g, side, e.z, e.dy || 0, z0, z1);
        if (!p) continue;
        const s = side === 'L' ? 1 : -1, mesh = new THREE.Mesh(PLANE, matOf(e));
        mesh.position.set(p[0] + s * 0.0007, p[1], p[2]); mesh.rotation.y = s * Math.PI / 2;
        mesh.scale.set(e.w, e.h || e.w * (e.kind === 'emblem' ? 330 / 256 : e.kind === 'eps' ? 340 / 256 : e.kind === 'crown' || e.kind === 'crest' || e.kind === 'crystal' ? 1 : 96 / 512), 1);
        mesh.renderOrder = 3; mesh.name = 'gdeco'; mesh.userData.noSkin = true; host.add(mesh);
        out.push({ mesh, kind: e.kind, zg: host === g ? p[2] : p[2] + host.position.z });
      }
    }
    return out;
  }
  function matOf(e) {
    if (e.kind === 'emblem') return flat(emblemTex(e.no));
    if (e.kind === 'eps') return flat(epsTex(e.no), { toneMapped: false });
    if (e.kind === 'crown') return flat(crownTex(e.col || '#e9c46a'));
    if (e.kind === 'crest') return flat(crestTex());
    if (e.kind === 'crystal') return flat(crystalTex(e.col || '#9ff5ee'), { toneMapped: false });
    if (e.kind === 'pips') return flat(pipsTex(e.col));
    if (e.kind === 'hidden') return hiddenMat(textTex(e.text, 'plain', '#ffffff'), e.col);
    return flat(textTex(e.text, e.style || 'neon', e.col, 512, e.style === 'warn' ? 96 : 96), e.style === 'neon' ? { toneMapped: false } : {});
  }
  // 조준 장치 둘레 홀로그램 괄호 (양옆, 살짝 떠 있음) — 1인칭 정조준 때 숨김(GunSkin.adsFold)
  function holo(g, e, out) {
    const m = g.userData.meta, z = m.scopeZ !== undefined && g.getObjectByName('scope') ? m.scopeZ : (m.ironRearZ !== undefined ? m.ironRearZ + 0.06 : 0), y = (m.railY || m.boreY || 0) + (e.dy || 0.012);
    for (const s of [1, -1]) {
      const mesh = new THREE.Mesh(PLANE, flat(holoTex(e.col), { blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0.85 }));
      mesh.position.set(s * (e.x || 0.034), y, z); mesh.rotation.y = s * Math.PI / 2; mesh.scale.set(e.w || 0.06, (e.w || 0.06) / 2, 1);
      mesh.renderOrder = 6; mesh.name = 'gdeco'; mesh.userData.noSkin = true; g.add(mesh);
      out.push({ mesh, kind: 'holo', zg: z });
    }
  }
  // 조준경 앞뒤 금테 (조준경이 있을 때만)
  function rims(g, e, out) {
    const sc = g.getObjectByName('scope'); if (!sc) return;
    g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(sc); if (bb.isEmpty()) return;
    const m = g.userData.meta, r = Math.min(0.03, (bb.max.x - bb.min.x) / 2 + 0.0016), y = m.sightY !== undefined ? m.sightY : (bb.min.y + bb.max.y) / 2;
    const mat = new THREE.MeshStandardMaterial({ color: e.col || 0xe9cf8a, metalness: 1, roughness: 0.22, emissive: e.col || 0xe9cf8a, emissiveIntensity: 0.25 });
    const orn = e.orn === 'gems' ? [0xe0203a, 0x2a6cff, 0x1fbf6a, 0xe0203a] : e.orn === 'stars' ? [0xfff0c0, 0xc9a6ff, 0xfff0c0, 0xc9a6ff] : null;
    for (const z of [bb.max.z - 0.004, bb.min.z + 0.004]) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0018, 6, 28), mat); mesh.geometry.userData.own = true;
      mesh.position.set(0, y, z); mesh.name = 'gdeco'; mesh.userData.noSkin = true; g.add(mesh); out.push({ mesh, kind: 'rim', zg: z });
      // 테 장식: 보석(왕실) · 작은 별(천체) — 테 둘레 네 곳
      if (orn) orn.forEach((col, i) => { const a = Math.PI / 4 + i * Math.PI / 2, gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.0034, 0), new THREE.MeshStandardMaterial({ color: col, metalness: 0.3, roughness: 0.15, emissive: col, emissiveIntensity: e.orn === 'stars' ? 1.2 : 0.45 })); gm.geometry.userData.own = true; gm.position.set(Math.cos(a) * (r + 0.0016), y + Math.sin(a) * (r + 0.0016), z); gm.name = 'gdeco'; gm.userData.noSkin = true; g.add(gm); out.push({ mesh: gm, kind: 'rim', zg: z }); });
    }
  }
  // 살펴보기 홀로그램 창 (ZERO PROTOCOL): 총 옆에 떠오르는 SYSTEM ONLINE — 항상 카메라를 봄
  function panel(g) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: panelTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const m = g.userData.meta; s.position.set(0.03, (m.boreY || 0) + 0.115, 0.04); s.scale.set(0.001, 0.001, 1); s.renderOrder = 9; s.name = 'gdeco-panel'; g.add(s); return s;
  }
  // ---------- 엡실론 ----------
  //  ε 엠블럼: 금테 마름모 + 보랏빛 안쪽 + 가운데 ε + EPSILON 글자 + 아래 컬렉션 번호판(Ε-01~08)
  function epsTex(no) {
    return ctex('eps' + no, 256, 340, (g) => {
      const cx = 128, cy = 126, R = 112;
      const dia = (r) => { g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.82, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r * 0.82, cy); g.closePath(); };
      g.save(); g.shadowColor = '#c084fc'; g.shadowBlur = 22; dia(R); const gd = g.createLinearGradient(0, cy - R, 0, cy + R); gd.addColorStop(0, '#fff3c4'); gd.addColorStop(0.5, '#d9a93e'); gd.addColorStop(1, '#7a520e'); g.fillStyle = gd; g.fill(); g.restore();
      dia(R - 12); const vi = g.createRadialGradient(cx, cy - 14, 6, cx, cy, R); vi.addColorStop(0, '#5a2a9a'); vi.addColorStop(1, '#0d0618'); g.fillStyle = vi; g.fill();
      dia(R - 22); g.lineWidth = 2; g.strokeStyle = 'rgba(255,230,170,0.7)'; g.stroke();
      g.save(); g.shadowColor = '#e6c8ff'; g.shadowBlur = 16; g.font = FONT(900, 120); g.textAlign = 'center'; g.textBaseline = 'middle'; const tg = g.createLinearGradient(0, cy - 50, 0, cy + 50); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#e6c8ff'); g.fillStyle = tg; g.fillText('ε', cx, cy + 4); g.restore();
      g.font = FONT(800, 22); g.textAlign = 'center'; g.fillStyle = '#ffe9b0'; g.fillText('EPSILON', cx, cy + 62);
      const py = 284; g.beginPath(); g.moveTo(cx - 76, py - 24); g.lineTo(cx + 76, py - 24); g.lineTo(cx + 90, py); g.lineTo(cx + 76, py + 24); g.lineTo(cx - 76, py + 24); g.lineTo(cx - 90, py); g.closePath();
      g.fillStyle = '#0d0618'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d9a93e'; g.stroke();
      g.font = FONT(800, 30); g.textBaseline = 'middle'; g.fillStyle = '#f3dcff'; g.fillText('Ε-' + no, cx, py + 1);
    });
  }
  // 왕관 (INFERNAL SOVEREIGN 탄창): 금 왕관 + 붉은 보석
  const crownTex = (col) => ctex('crown' + col, 256, 256, (g) => {
    g.save(); g.shadowColor = '#ff3a1a'; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(40, 190); g.lineTo(28, 80); g.lineTo(84, 130); g.lineTo(128, 52); g.lineTo(172, 130); g.lineTo(228, 80); g.lineTo(216, 190); g.closePath();
    const gr = g.createLinearGradient(0, 52, 0, 190); gr.addColorStop(0, '#fff2c0'); gr.addColorStop(0.5, col); gr.addColorStop(1, '#7a4a08'); g.fillStyle = gr; g.fill(); g.restore();
    g.lineWidth = 4; g.strokeStyle = '#4a2a04'; g.stroke(); g.fillStyle = col; g.fillRect(40, 196, 176, 22); g.strokeRect(40, 196, 176, 22);
    for (const [x, y, r] of [[128, 150, 15], [76, 160, 9], [180, 160, 9], [128, 207, 6], [28, 80, 7], [128, 52, 8], [228, 80, 7]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = '#d4141e'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff2c0'; g.stroke(); }
  });
  // 왕실 문장 (ETERNAL DYNASTY 개머리판·살펴보기): 남색 방패 + 금 테 + 가운데 왕관과 별 + 양옆 월계수
  const crestTex = () => ctex('crest', 256, 256, (g) => {
    const cx = 128;
    g.lineCap = 'round';
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const t = i / 6, x = cx + s * (70 + Math.sin(t * Math.PI) * 18), y = 210 - t * 140; g.save(); g.translate(x, y); g.rotate(s * (0.6 - t * 0.9)); g.beginPath(); g.ellipse(0, 0, 6, 14, 0, 0, TAU); g.fillStyle = '#d9b45a'; g.fill(); g.restore(); }
    g.beginPath(); g.moveTo(cx - 62, 56); g.lineTo(cx + 62, 56); g.lineTo(cx + 62, 140); g.quadraticCurveTo(cx + 58, 204, cx, 224); g.quadraticCurveTo(cx - 58, 204, cx - 62, 140); g.closePath();
    const gr = g.createLinearGradient(0, 56, 0, 224); gr.addColorStop(0, '#22356e'); gr.addColorStop(1, '#0b1330'); g.fillStyle = gr; g.fill(); g.lineWidth = 7; g.strokeStyle = '#e2c27a'; g.stroke(); g.lineWidth = 2; g.strokeStyle = '#fff3cf'; g.stroke();
    g.fillStyle = '#e2c27a'; g.beginPath(); g.moveTo(cx - 34, 120); g.lineTo(cx - 40, 86); g.lineTo(cx - 17, 104); g.lineTo(cx, 78); g.lineTo(cx + 17, 104); g.lineTo(cx + 40, 86); g.lineTo(cx + 34, 120); g.closePath(); g.fill();
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; i ? g.lineTo(cx + Math.cos(a) * r, 160 + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, 160 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = '#d4141e'; g.beginPath(); g.arc(cx, 108, 5, 0, TAU); g.fill();
  });
  // 크리스털 무늬 (PHANTOM SERAPH 탄창): 겹친 육면 결정 + 빛
  const crystalTex = (col) => ctex('crys' + col, 256, 256, (g) => {
    const R = mulberry32(77);
    for (let i = 0; i < 9; i++) {
      const x = 40 + R() * 176, y = 40 + R() * 176, h = 40 + R() * 70, w = h * 0.38, a = (R() - 0.5) * 0.8;
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(w / 2, -h * 0.2); g.lineTo(w / 2, h * 0.3); g.lineTo(0, h / 2); g.lineTo(-w / 2, h * 0.3); g.lineTo(-w / 2, -h * 0.2); g.closePath();
      const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(60,140,150,0.8)'); g.fillStyle = gr; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(0, h / 2); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.stroke(); g.restore();
    }
  });
  // 빛의 날개 (PHANTOM SERAPH): 깃털 다섯 겹 반투명 날개 — 평소엔 숨겨 두고 GunSkin 이 펼침
  const wingTex = (col) => ctex('wing' + col, 256, 256, (g) => {
    g.translate(18, 230);
    for (let i = 0; i < 6; i++) { const a = -0.25 - i * 0.22, L = 230 - i * 22; g.save(); g.rotate(a - Math.PI / 2 + 0.2); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -26, L, -4); g.quadraticCurveTo(L * 0.5, 22, 0, 0); const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,255,255,0.15)'); gr.addColorStop(0.6, col); gr.addColorStop(1, 'rgba(255,255,255,0.95)'); g.fillStyle = gr; g.globalAlpha = 0.75; g.fill(); g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.stroke(); g.restore(); }
  });
  function wings(g, e, out) {
    const p0 = GunParts.probe(g, 'L', e.z, e.dy || 0.01, ...zRange(g)); if (!p0) return;
    for (const s of [1, -1]) {
      const p = GunParts.probe(g, s > 0 ? 'L' : 'R', e.z, e.dy || 0.01, ...zRange(g)) || p0, pv = new THREE.Group(), mesh = new THREE.Mesh(PLANE, flat(wingTex(e.col || 'rgba(160,240,235,0.85)'), { blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0 }));
      mesh.scale.set(e.w || 0.16, e.w || 0.16, 1); mesh.position.set(0, (e.w || 0.16) * 0.42, -(e.w || 0.16) * 0.42);
      pv.position.set(p[0] + s * 0.004, p[1], p[2]); pv.rotation.y = s * Math.PI / 2; pv.rotation.x = 0; pv.add(mesh); pv.scale.setScalar(0.001);
      pv.name = 'gdeco'; mesh.userData.noSkin = true; mesh.renderOrder = 7; g.add(pv); out.push({ mesh: pv, mat: mesh.material, kind: 'wings', zg: p[2] });
    }
  }
  function zRange(g) { const I = g.userData.skin; return I ? [I.z0, I.z1] : [-0.4, 0.6]; }
  // 살펴보기: 왕실 문장 홀로그램(총 위에서 빛나며 돎) — ETERNAL DYNASTY
  function crestHolo(g) {
    const m = g.userData.meta, mesh = new THREE.Mesh(PLANE, flat(crestTex(), { blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0, depthTest: false }));
    mesh.position.set(0, (m.boreY || 0) + 0.12, 0.02); mesh.scale.setScalar(0.001); mesh.renderOrder = 9; mesh.name = 'gdeco-panel'; g.add(mesh); return mesh;
  }
  // ---------- 엡실론 살펴보기 (v20): ε 문양 고리 · 이름 명판 ----------
  // 문양 고리: 총을 감싸는 얇은 빛 고리(바깥 글자 · 안쪽 눈금 · 마름모 넷). col = 그 스킨의 빛깔(CSS)
  function sigilTex(col) {
    return ctex('sigil|' + col, 512, 512, (g) => {
      g.translate(256, 256); g.strokeStyle = col; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10;
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 236, 0, TAU); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 186, 0, TAU); g.stroke();
      for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, r0 = i % 6 ? 178 : 166; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 186, Math.sin(a) * 186); g.stroke(); }
      const txt = 'EPSILON  ·  THE ABSOLUTE  ·  Ε  ·  ', N = txt.length * 2; g.font = FONT(800, 30); g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < N; i++) { g.save(); g.rotate(i / N * TAU); g.translate(0, -211); g.fillText(txt[i % txt.length], 0, 0); g.restore(); }
      for (let i = 0; i < 4; i++) { g.save(); g.rotate(i / 4 * TAU + 0.4); g.translate(0, -150); g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 0); g.lineTo(0, 13); g.lineTo(-9, 0); g.closePath(); g.fill(); g.restore(); }
    });
  }
  // 고리 둘: 하나는 총열과 직각으로 서서 개머리판에서 총구까지 훑고 지나가고, 하나는 비스듬히 누워 가운데에서 돈다 (GunSkin 이 움직임)
  function sigil(g, col) {
    const m = g.userData.meta, I = g.userData.skin, grp = new THREE.Group();
    const mk = () => new THREE.Mesh(PLANE, flat(sigilTex(col), { blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, opacity: 0, polygonOffset: false }));
    const a = mk(), b = mk(); b.rotation.set(0.5, 0.95, 0); b.scale.setScalar(0.74); grp.add(a, b);
    grp.position.set(0, (m.boreY || 0) - 0.012, I ? (I.z0 + I.z1) / 2 : 0.1); grp.scale.setScalar(0.001); grp.name = 'gdeco-panel'; grp.userData.noSkin = true; g.add(grp); return grp;
  }
  // 이름 명판: 총 위에 떠오르는 홀로그램 — EPSILON · Ε-번호 / 스킨 이름 / 소유 번호 (항상 카메라를 봄)
  function plateTex(d, serial, col) {
    return ctex(['plate', d.name, d.no, serial, col].join('|'), 640, 200, (g, W, H) => {
      g.fillStyle = 'rgba(10,8,20,0.6)'; g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, 4); g.fillRect(0, H - 4, W, 4);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 12;
      g.font = FONT(700, 30); g.fillStyle = col; g.fillText(`EPSILON  ·  Ε-${d.no}`, W / 2, 40);
      let px = 62; g.font = FONT(900, px); const w = g.measureText(d.name).width; if (w > W - 48) { px *= (W - 48) / w; g.font = FONT(900, px); }
      g.fillStyle = '#ffffff'; g.fillText(d.name, W / 2, 102);
      g.font = FONT(700, 26); g.fillStyle = col; g.fillText(serial ? `THE ABSOLUTE  ·  OWNER #${serial}` : 'THE ABSOLUTE', W / 2, 164);
    });
  }
  function plate(g, d, serial, col) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: plateTex(d, serial, col), transparent: true, depthWrite: false, depthTest: false, toneMapped: false, opacity: 0 }));
    const m = g.userData.meta; s.position.set(0, (m.boreY || 0) + 0.17, 0.08); s.scale.set(0.001, 0.001, 1); s.renderOrder = 9; s.name = 'gdeco-panel'; g.add(s); return s;
  }
  return { attach, panel, crestHolo, sigil, plate, emblemTex, textTex, epsTex };
})();
// 특정 각도 글자의 일렁임 시간 (GunSkin.update 가 갱신)
const GunDeco_T = { value: 0 };
