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
        mesh.scale.set(e.w, e.h || e.w * (e.kind === 'emblem' ? 330 / 256 : 96 / 512), 1);
        mesh.renderOrder = 3; mesh.name = 'gdeco'; mesh.userData.noSkin = true; host.add(mesh);
        out.push({ mesh, kind: e.kind, zg: host === g ? p[2] : p[2] + host.position.z });
      }
    }
    return out;
  }
  function matOf(e) {
    if (e.kind === 'emblem') return flat(emblemTex(e.no));
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
    for (const z of [bb.max.z - 0.004, bb.min.z + 0.004]) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0018, 6, 28), mat); mesh.geometry.userData.own = true;
      mesh.position.set(0, y, z); mesh.name = 'gdeco'; mesh.userData.noSkin = true; g.add(mesh); out.push({ mesh, kind: 'rim', zg: z });
    }
  }
  // 살펴보기 홀로그램 창 (ZERO PROTOCOL): 총 옆에 떠오르는 SYSTEM ONLINE — 항상 카메라를 봄
  function panel(g) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: panelTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const m = g.userData.meta; s.position.set(0.03, (m.boreY || 0) + 0.115, 0.04); s.scale.set(0.001, 0.001, 1); s.renderOrder = 9; s.name = 'gdeco-panel'; g.add(s); return s;
  }
  return { attach, panel, emblemTex, textTex };
})();
// 특정 각도 글자의 일렁임 시간 (GunSkin.update 가 갱신)
const GunDeco_T = { value: 0 };
