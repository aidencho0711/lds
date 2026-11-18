// ============================================================
// 02_world_house.js — 집 외형 (v22 집 외형 개편 · 크리스마스 섬 장식)
//  · buildHouse 가 바닥·벽·문·층·계단·전리품·충돌 상자를 예전 그대로 만든 뒤 겉모습만 덧붙인다 (모두 충돌 없음)
//  · 집마다 위치로 시드를 정한 별도 난수 → 월드 난수 순서·충돌 상자·전리품·내비게이션은 예전과 같다
//  · 양식: 시골집(회벽·반목조) · 농가(판자벽) · 벽돌집 · 돌집 · 통나무집 · 도시 상가(간판·차양막) · 현대식 · 막사 · 정글 판잣집 · 열대 회벽집 · 진저브레드 집
//  · 지붕(박공·앞박공·모임지붕, 기와 줄 그림자)·처마·박공판·용마루 · 창틀·창턱·인방·덧창·꽃상자 · 현관 차양·문짝·외등·문패
//    · 모서리 판·돌 모서리·밑동 띠·층 띠·반목조 · 굴뚝 · 난간 살 · 평지붕 갓돌·코니스·외벽 처마 · 벽걸이 실외기
//  · 재질: 코드로 그린 무늬 아틀라스 한 장(판자·벽돌·돌·통나무·널빤지·회벽·콘크리트·기와·너와·슬레이트·함석·초가·눈 …) — 집 재질은 구역마다 그리기 1번
//  · 크리스마스 섬: 지붕·창턱·차양의 눈 · 처마 고드름 · 반짝이는 전구 줄 · 문 옆 화환 · 선물 상자 · 마당 트리 · 눈사람
// ============================================================
const HTX = (() => {
  const T = 128, A = 1024, GU = 2, S = T - GU * 2;   // 칸 128px · 가장자리 2px(이음매 없이 반복) · 무늬 124px
  const P = {};
  // 무늬: 이름 · 칸 x,y · 칸 폭 · 한 장의 실제 크기(m) · 그리기 · fit(면 하나에 한 장, 간판)
  const def = (name, cx, cy, cw, sx, sy, draw, fit) => { P[name] = { r: [(cx * T + GU) / A, (cy * T + GU) / A, (cw * T - GU * 2) / A, S / A], sx, sy, cx, cy, cw, draw, fit: !!fit }; };
  const gv = (v, a) => { const c = Math.round(clamp(v, 0, 1) * 255); return a !== undefined ? `rgba(${c},${c},${c},${a})` : `rgb(${c},${c},${c})`; };
  // 가장자리를 넘는 도형은 반대쪽에도 → 이음매 없이 반복
  const wf = (g, W, H, x, y, w, h) => { for (const ox of [0, -W, W]) for (const oy of [0, -H, H]) { const X = x + ox, Y = y + oy; if (X + w < 0 || X > W || Y + h < 0 || Y > H) continue; g.fillRect(X, Y, w, h); } };
  const wc = (g, W, H, x, y, rx, ry) => { for (const ox of [0, -W, W]) for (const oy of [0, -H, H]) { const X = x + ox, Y = y + oy; if (X + rx < 0 || X - rx > W || Y + ry < 0 || Y - ry > H) continue; g.beginPath(); g.ellipse(X, Y, rx, ry, 0, 0, TAU); g.fill(); } };
  const blot = (g, W, H, r, n, r0, r1, a, dark) => { for (let i = 0; i < n; i++) { g.fillStyle = gv(dark !== undefined ? (r() < dark ? 0 : 1) : (r() < 0.5 ? 0 : 1), a); const rr = r0 + r() * (r1 - r0); wc(g, W, H, r() * W, r() * H, rr, rr * (0.6 + r() * 0.8)); } };
  const rows = (g, W, H, n, f) => { const h = H / n; for (let i = 0; i < n; i++) f(i, i * h, h); };
  // ----- 벽 -----
  def('plain', 0, 0, 1, 2, 2, (g, W, H) => { g.fillStyle = gv(0.91); g.fillRect(0, 0, W, H); });
  def('siding', 1, 0, 1, 1.2, 1.2, (g, W, H, r) => {   // 가로 판자벽 (판 30cm)
    rows(g, W, H, 4, (i, y, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, gv(1)); gr.addColorStop(0.75, gv(0.9)); gr.addColorStop(1, gv(0.76)); g.fillStyle = gr; g.fillRect(0, y, W, h); g.fillStyle = gv(0.5); g.fillRect(0, y + h - 2, W, 2); });
    for (let k = 0; k < 60; k++) { g.fillStyle = gv(r() < 0.5 ? 0 : 1, 0.07); wf(g, W, H, r() * W, r() * H, 6 + r() * 40, 1); }
  });
  def('brick', 2, 0, 1, 0.9, 0.6, (g, W, H, r) => {   // 벽돌 (줄 10cm, 엇갈림 쌓기)
    g.fillStyle = gv(0.98); g.fillRect(0, 0, W, H); const bw = W / 3;
    rows(g, W, H, 6, (i, y, h) => { for (let k = -1; k < 4; k++) { const x = k * bw + (i % 2 ? bw / 2 : 0); g.fillStyle = gv(0.7 + r() * 0.2); wf(g, W, H, x + 1.5, y + 1.5, bw - 3, h - 3); g.fillStyle = gv(1, 0.12); wf(g, W, H, x + 1.5, y + 1.5, bw - 3, 2); } });
    blot(g, W, H, r, 40, 1, 3, 0.08);
  });
  def('stone', 3, 0, 1, 1.6, 1.6, (g, W, H, r) => {   // 돌 쌓기 (크기 다른 마름돌)
    g.fillStyle = gv(0.5); g.fillRect(0, 0, W, H); let y = 0;
    for (const h of [44, 38, 42]) { let x = r() * 20; while (x < W + 20) { const w = 26 + r() * 32; g.fillStyle = gv(0.74 + r() * 0.24); wf(g, W, H, x + 2, y + 2, Math.min(w, W) - 4, h - 4); g.fillStyle = gv(1, 0.12); wf(g, W, H, x + 2, y + 2, Math.min(w, W) - 4, 3); x += w; } y += h; }
    blot(g, W, H, r, 70, 1, 4, 0.1);
  });
  def('log', 4, 0, 1, 1.4, 1.2, (g, W, H, r) => {   // 통나무 (원통 그늘)
    rows(g, W, H, 4, (i, y, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, gv(0.5)); gr.addColorStop(0.18, gv(0.85)); gr.addColorStop(0.45, gv(1)); gr.addColorStop(0.8, gv(0.82)); gr.addColorStop(1, gv(0.45)); g.fillStyle = gr; g.fillRect(0, y, W, h); });
    for (let k = 0; k < 40; k++) { g.fillStyle = gv(0, 0.08); wf(g, W, H, r() * W, r() * H, 10 + r() * 30, 1); }
    for (let k = 0; k < 5; k++) { g.fillStyle = gv(0, 0.22); wc(g, W, H, r() * W, (Math.floor(r() * 4) + 0.5) * H / 4, 3, 2); }
  });
  def('plank', 5, 0, 1, 1.2, 1.2, (g, W, H, r) => {   // 세로 널빤지 + 쫄대
    const bw = W / 4; for (let k = 0; k < 4; k++) { g.fillStyle = gv(0.84 + r() * 0.1); g.fillRect(k * bw, 0, bw, H); g.fillStyle = gv(1); g.fillRect(k * bw, 0, 5, H); g.fillStyle = gv(0.52); g.fillRect(k * bw + 5, 0, 2, H); }
    for (let k = 0; k < 50; k++) { g.fillStyle = gv(r() < 0.5 ? 0 : 1, 0.07); wf(g, W, H, r() * W, r() * H, 1, 8 + r() * 30); }
  });
  def('stucco', 6, 0, 1, 2, 2, (g, W, H, r) => { g.fillStyle = gv(0.93); g.fillRect(0, 0, W, H); blot(g, W, H, r, 90, 3, 14, 0.035); blot(g, W, H, r, 160, 0.6, 1.6, 0.12); });
  def('concrete', 7, 0, 1, 2.4, 2.4, (g, W, H, r) => { g.fillStyle = gv(0.9); g.fillRect(0, 0, W, H); blot(g, W, H, r, 70, 4, 16, 0.03); blot(g, W, H, r, 120, 0.5, 1.4, 0.15); g.fillStyle = gv(0.66); g.fillRect(0, H - 2, W, 2); g.fillRect(W - 2, 0, 2, H); for (const [x, y] of [[20, 20], [W - 22, 20], [20, H - 22], [W - 22, H - 22]]) { g.fillStyle = gv(0.7); wc(g, W, H, x, y, 2, 2); } });
  // ----- 지붕 (v: 용마루 → 처마 방향) -----
  def('tile', 0, 1, 1, 1.0, 1.0, (g, W, H, r) => {   // 기와 (둥근 골)
    rows(g, W, H, 4, (i, y, h) => { const cw = W / 6; for (let k = 0; k < 7; k++) { const x = k * cw + (i % 2 ? cw / 2 : 0), gr = g.createLinearGradient(x, 0, x + cw, 0); gr.addColorStop(0, gv(0.62)); gr.addColorStop(0.5, gv(1)); gr.addColorStop(1, gv(0.62)); g.fillStyle = gr; wf(g, W, H, x, y, cw, h); } g.fillStyle = gv(0, 0.35); g.fillRect(0, y + h - 4, W, 4); });
  });
  def('shingle', 1, 1, 1, 1.0, 1.0, (g, W, H, r) => {   // 너와·아스팔트 싱글
    g.fillStyle = gv(0.42); g.fillRect(0, 0, W, H);
    rows(g, W, H, 5, (i, y, h) => { let x = (i % 2) * 11; while (x < W + 30) { const w = 14 + r() * 13; g.fillStyle = gv(0.76 + r() * 0.22); wf(g, W, H, x + 1, y, w - 2, h - 3); x += w; } g.fillStyle = gv(0, 0.25); g.fillRect(0, y + h - 3, W, 3); });
  });
  def('slate', 2, 1, 1, 0.9, 0.9, (g, W, H, r) => {   // 슬레이트
    g.fillStyle = gv(0.4); g.fillRect(0, 0, W, H); const sw = W / 6;
    rows(g, W, H, 6, (i, y, h) => { for (let k = -1; k < 7; k++) { g.fillStyle = gv(0.74 + r() * 0.2); wf(g, W, H, k * sw + (i % 2 ? sw / 2 : 0) + 1, y + 1, sw - 2, h - 2.5); } });
  });
  def('metal', 3, 1, 1, 1.2, 1.2, (g, W, H, r) => {   // 함석 (세로 골)
    g.fillStyle = gv(0.88); g.fillRect(0, 0, W, H); const sw = W / 3;
    for (let k = 0; k < 3; k++) { g.fillStyle = gv(1); g.fillRect(k * sw, 0, 3, H); g.fillStyle = gv(0.6); g.fillRect(k * sw + 3, 0, 3, H); }
    blot(g, W, H, r, 30, 2, 8, 0.04);
  });
  def('thatch', 4, 1, 1, 1.0, 1.0, (g, W, H, r) => {   // 초가·야자잎
    g.fillStyle = gv(0.75); g.fillRect(0, 0, W, H);
    for (let k = 0; k < 420; k++) { g.fillStyle = gv(0.55 + r() * 0.5); wf(g, W, H, r() * W, r() * H, 1, 8 + r() * 22); }
    rows(g, W, H, 3, (i, y, h) => { g.fillStyle = gv(0, 0.3); g.fillRect(0, y + h - 3, W, 3); });
  });
  def('snow', 5, 1, 1, 3, 3, (g, W, H, r) => {   // 눈 (푸른 그늘이 살짝)
    g.fillStyle = 'rgb(250,252,255)'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(190,210,235,${0.05 + r() * 0.08})`; const rr = 4 + r() * 16; wc(g, W, H, r() * W, r() * H, rr, rr * 0.6); }
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; wc(g, W, H, r() * W, r() * H, 0.8, 0.8); }
  });
  def('floor', 6, 1, 1, 1.6, 1.6, (g, W, H, r) => {   // 마루 (가로 널)
    g.fillStyle = gv(0.5); g.fillRect(0, 0, W, H);
    rows(g, W, H, 6, (i, y, h) => { let x = r() * 30; while (x < W + 60) { const w = 40 + r() * 40; g.fillStyle = gv(0.8 + r() * 0.16); wf(g, W, H, x + 1, y + 0.8, w - 2, h - 1.6); x += w; } });
    for (let k = 0; k < 60; k++) { g.fillStyle = gv(0, 0.06); wf(g, W, H, r() * W, r() * H, 10 + r() * 30, 1); }
  });
  def('candy', 7, 1, 1, 0.8, 0.8, (g, W, H) => {   // 사탕 줄무늬 (빨강·흰색 — 색 그대로)
    g.fillStyle = '#f6f2ee'; g.fillRect(0, 0, W, H); g.fillStyle = '#d4252e';
    for (let k = -2; k < 4; k++) { g.beginPath(); const x = k * W / 2; g.moveTo(x, 0); g.lineTo(x + W / 4, 0); g.lineTo(x + W / 4 + W, H); g.lineTo(x + W, H); g.closePath(); g.fill(); }
  });
  // ----- 선물 포장 · 얼음 -----
  def('gift1', 0, 2, 1, 0.5, 0.5, (g, W, H) => { g.fillStyle = gv(0.72); g.fillRect(0, 0, W, H); g.fillStyle = gv(1); for (const [x, y] of [[0, 0], [W / 2, H / 2]]) wc(g, W, H, x + W / 4, y + H / 4, 11, 11); });
  def('gift2', 1, 2, 1, 0.5, 0.5, (g, W, H) => { g.fillStyle = gv(0.74); g.fillRect(0, 0, W, H); g.fillStyle = gv(1); for (let k = 0; k < 4; k++) wf(g, W, H, k * W / 4, 0, W / 9, H); });
  def('gift3', 2, 2, 1, 0.5, 0.5, (g, W, H) => {
    g.fillStyle = gv(0.72); g.fillRect(0, 0, W, H); g.fillStyle = gv(1);
    for (const [cx, cy] of [[W * 0.25, H * 0.25], [W * 0.75, H * 0.75]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 7 : 17; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  });
  def('ice', 3, 2, 1, 4, 4, (g, W, H, r) => { g.fillStyle = 'rgb(236,246,252)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(150,185,210,0.55)'; g.lineWidth = 1; for (let k = 0; k < 14; k++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } });
  // ----- 간판 (면 하나에 한 장, 2칸 폭) -----
  const SIGNS = ['카페', '빵집', '약국', '꽃집', '식당', '서점', '호텔', '잡화점', '선물가게', '장난감', '코코아', '우체국', '산타 공방'];
  SIGNS.forEach((txt, i) => def('sign' + i, (i % 4) * 2, 3 + Math.floor(i / 4), 2, 1, 1, (g, W, H) => {
    g.fillStyle = gv(0.97); g.fillRect(0, 0, W, H); g.strokeStyle = gv(0.42); g.lineWidth = 7; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = gv(0.16); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${txt.length > 3 ? 46 : 58}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`; g.fillText(txt, W / 2, H / 2 + 3);
  }, true));
  const SIGN_N = SIGNS.length;
  let tex = null, mat = null, lit = null; const TW = { value: 0 };
  function paint() {
    const cv = document.createElement('canvas'); cv.width = cv.height = A; const g = cv.getContext('2d');
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, A, A);
    for (const [name, p] of Object.entries(P)) {
      const W = p.cw * T - GU * 2, oc = document.createElement('canvas'); oc.width = W; oc.height = S;
      const og = oc.getContext('2d'); let seed = 0; for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
      p.draw(og, W, S, mulberry32(seed + 77));
      const X = p.cx * T + GU, Y = p.cy * T + GU;
      g.save(); g.beginPath(); g.rect(p.cx * T, p.cy * T, p.cw * T, T); g.clip();
      for (const ox of [-W, 0, W]) for (const oy of [-S, 0, S]) g.drawImage(oc, X + ox, Y + oy);
      g.restore();
    }
    tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = (typeof G !== 'undefined' && G.renderer) ? Math.min(4, G.renderer.capabilities.getMaxAnisotropy()) : 1;
  }
  // 집 재질 셰이더: 정점 색 × 무늬(아틀라스의 칸을 fract 로 반복) · WebGL2 는 textureGrad 로 칸 경계 이음매 없이 · 멀리서는 평균 밝기로 (번쩍임 방지)
  const obc = (sh) => {
    sh.vertexShader = 'attribute vec4 trect;\nvarying vec4 vTRect;\nvarying float vTDist;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vTRect = trect; vTDist = -mvPosition.z;');
    sh.fragmentShader = 'varying vec4 vTRect;\nvarying float vTDist;\n' + sh.fragmentShader.replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      '  vec2 tuv = vTRect.xy + fract(vUv) * vTRect.zw;',
      '  #if __VERSION__ >= 300',
      '    vec4 texelColor = textureGrad(map, tuv, dFdx(vUv) * vTRect.zw, dFdy(vUv) * vTRect.zw);',
      '  #else',
      '    vec4 texelColor = texture2D(map, tuv);',
      '  #endif',
      '  diffuseColor.rgb *= mix(texelColor.rgb, vec3(0.88), smoothstep(90.0, 220.0, vTDist)) * 1.08;',
      '#endif'].join('\n'));
  };
  let matO = null;
  return {
    P, TW, SIGN_N,
    mat() {
      if (mat) return mat;
      if (!tex) paint();
      mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }); mat.onBeforeCompile = obc;
      return mat;
    },
    // 지면에 붙여 까는 무늬(얼음판): 깊이를 앞으로 당겨 지형과 겹쳐 깜빡이지 않게
    matOff() {
      if (matO) return matO;
      if (!tex) paint();
      matO = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); matO.onBeforeCompile = obc;
      return matO;
    },
    // 크리스마스 전구: 빛을 받지 않는 색(밤낮 똑같이 빛남) · 정점마다 위상이 달라 하나씩 반짝임 (TW.value = 시간)
    lit() {
      if (lit) return lit;
      lit = new THREE.MeshBasicMaterial({ vertexColors: true });
      lit.onBeforeCompile = (sh) => {
        sh.uniforms.uTw = TW;
        sh.vertexShader = 'attribute float tph;\nuniform float uTw;\nvarying float vTw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTw = 0.5 + 0.5 * sin(uTw * 2.3 + tph);');
        sh.fragmentShader = 'varying float vTw;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.45 + 0.85 * vTw * vTw;');
      };
      return lit;
    },
  };
})();

// ---------- 양식 ----------
// walls/roofs/trim/shut/door: 색 후보 · wp/rp: 벽·지붕 무늬 · timber/flower/shutter/chim/porch/pent/awning/sign/ac: 장식 확률
const HSTY = {
  cottage: { wp: 'stucco', rp: ['tile', 'shingle'], walls: [0xf3ecd9, 0xefe2c4, 0xe9e4d6, 0xf6eee2, 0xeadfcb, 0xf0dcc8], roofs: [0x9c4b33, 0x8a3f2d, 0xa95d3b, 0x6b4a3a], trim: [0x5b3b28, 0x4a3526], shut: [0x2f6a4a, 0x2d5b8a, 0x8a3030, 0x3b6b6b, 0x6a4a8a], door: [0x7a2e22, 0x2f5a3a, 0x2d4a7a], base: 0xb0a898, basep: 'stone', timber: 0.6, flower: 0.85, shutter: 0.85, chim: 0.75, porch: 'gable', pent: 0.5 },
  farm: { wp: 'siding', rp: ['shingle', 'metal'], walls: [0xf4f4ef, 0xdde7ee, 0xeee6c6, 0xd2dcc8, 0xecd5c6, 0xc9d6e0, 0xb8473a], roofs: [0x4b5058, 0x5b4b3f, 0x3f4b44, 0x7a3a2e], trim: [0xfbfbf7, 0xf1efe6], shut: [0x2f4a6b, 0x3b5b3b, 0x7b2b2b, 0x2b2b2b], door: [0xa8342a, 0x2f4a6b, 0x3b5b3b], base: 0xa8a49c, basep: 'concrete', flower: 0.45, shutter: 0.7, chim: 0.55, porch: 'flat', pent: 0.35 },
  brick: { wp: 'brick', rp: ['slate', 'tile'], walls: [0xb8674b, 0xa9583f, 0x9b6151, 0xc27c5c, 0x8f5440], roofs: [0x4b5159, 0x3f454d, 0x5a4a44], trim: [0xece6d8, 0xe2dccd], shut: [0x1f3b2b, 0x2b2b2b, 0x3b2519], door: [0x1f3b2b, 0x6b1f1f, 0x22304a], base: 0x9c948a, basep: 'stone', lintel: 1, flower: 0.55, shutter: 0.35, chim: 0.9, porch: 'gable', pent: 0.3 },
  stone: { wp: 'stone', rp: ['slate', 'shingle'], walls: [0xcac2b2, 0xbab4a6, 0xd4cab6, 0xb0a898], roofs: [0x4b5159, 0x5b5149, 0x44494f], trim: [0x6b5b49, 0x5a4a3a], shut: [0x5b3b29, 0x2f4b3b, 0x3b4b5b], door: [0x5b3b29, 0x3b2b1f], base: 0x948e84, basep: 'stone', quoin: 1, lintel: 1, flower: 0.6, shutter: 0.6, chim: 0.9, porch: 'gable', pent: 0.25 },
  cabin: { wp: 'log', rp: ['shingle', 'metal'], walls: [0xa9794b, 0x9b6b41, 0xb98b59, 0x8f6440], roofs: [0x4b3b2f, 0x3f4b3b, 0x5b3b2b, 0x6b2f2a], trim: [0x4b3121, 0x3b2719], shut: [0x6b2b1b, 0x2b4b2b], door: [0x5b3b25, 0x6b2b1b], base: 0x948e84, basep: 'stone', flower: 0.3, shutter: 0.3, chim: 1, chimp: 'stone', porch: 'flat', pent: 0.2 },
  town: { wp: ['brick', 'stucco', 'stucco'], rp: ['tile', 'slate'], walls: [0xb8674b, 0xd8c3a0, 0xe6d6b8, 0xc98f6a, 0xb7c2c6, 0xe2cfa6, 0xa9583f, 0xd9b48e], roofs: [0x9c4b33, 0x4b5159], trim: [0xf1ece2, 0xe2dccd, 0x4b4b4b], shut: [0x2f4a6b, 0x1f3b2b, 0x6b2b2b], door: [0x22304a, 0x6b1f1f, 0x1f3b2b, 0x3a3a3a], awn: [[0xb8352c, 0xf1ece2], [0x2f5a3a, 0xf1ece2], [0x2d4a7a, 0xf1ece2], [0xd6a12e, 0xf6f0e0], [0x6a2a4a, 0xf1ece2]], base: 0x9a948a, basep: 'stone', lintel: 0.6, flower: 0.4, shutter: 0.3, chim: 0.35, porch: 'flat', pent: 0.45, awning: 0.65, sign: 0.75, ac: 0.6, cornice: 1 },
  modern: { wp: ['stucco', 'concrete'], rp: ['metal'], walls: [0xefefeb, 0xdcdcd6, 0x9aa0a4, 0xe8e0d0, 0xc9cfd2], roofs: [0x3e4246], trim: [0x34383b, 0x2a2d30], shut: [0x34383b], door: [0x2a2d30, 0x7a5a3a], base: 0x8a8e92, basep: 'concrete', accent: 0.7, flower: 0.35, shutter: 0, chim: 0, porch: 'flat', ac: 0.7, sign: 0.3 },
  military: { wp: 'concrete', rp: ['metal'], walls: null, roofs: null, trim: [0x3d4434, 0x34392c], shut: [0x3d4434], door: [0x3a3f34, 0x4a4f44], base: 0x7e7d70, basep: 'concrete', flower: 0, shutter: 0, chim: 0, porch: 'flat', ac: 0.4, vents: 1 },
  jungle: { wp: 'plank', rp: ['thatch', 'metal', 'thatch'], walls: null, roofs: [0x9a8456, 0x8a7448, 0x6b7a7f], trim: [0x4b3121, 0x5b3b25], shut: [0x2f6a4a, 0x8a3030, 0x2d5b8a], door: [0x5b3b25], base: 0x948e84, basep: 'stone', flower: 0.35, shutter: 0.5, chim: 0, porch: 'flat', pent: 0.5 },
  tropic: { wp: 'stucco', rp: ['tile'], walls: null, roofs: null, trim: [0xfaf6ee, 0xf1ece2], shut: [0x2f8a8a, 0x2d6b9a, 0x3a8a4a, 0xd6a12e, 0xb8352c], door: [0x2d6b9a, 0x7a2e22, 0x2f8a8a], base: 0x9a9286, basep: 'stucco', flower: 0.7, shutter: 0.8, chim: 0, porch: 'gable', pent: 0.6, awning: 0.25, sign: 0.3 },
  ginger: { wp: 'stucco', rp: ['tile', 'shingle'], walls: [0x9a5a30, 0x8a4e28, 0xa8683a, 0xb07040], roofs: [0xf4f0ea, 0xe8e0d8, 0xc84a4a], trim: [0xfbf8f4], shut: [0xd83a4a, 0x3aa85a, 0xf2c94c], door: [0xd83a4a, 0x3aa85a], base: 0xf4f0ea, basep: 'stucco', icing: 1, flower: 0, shutter: 0.55, chim: 0.7, chimp: 'candy', porch: 'gable', pent: 0.3 },
  keep: { wp: 'stucco', rp: ['tile', 'slate'], walls: null, roofs: null, trim: [0xf1ece2, 0x5b4b3b], shut: [0x2f4a6b, 0x3b5b3b], door: [0x5b3b29, 0x22304a], base: 0x9c948a, basep: 'stone', lintel: 0.4, flower: 0.4, shutter: 0.4, chim: 0.4, porch: 'flat', pent: 0.3 },
};
const BULBS = [0xff4040, 0xffcc40, 0x40ff80, 0x40b0ff, 0xfff2d8, 0xff70d0];
const hdMul = (c, k) => { const r = clamp(((c >> 16) & 255) * k, 0, 255), g = clamp(((c >> 8) & 255) * k, 0, 255), b = clamp((c & 255) * k, 0, 255); return (r << 16) | (g << 8) | b; };

// 집 한 채의 겉모습 정하기 — buildHouse 맨 앞에서 부른다 (월드 난수를 쓰지 않는다)
function houseLook(DX, F, wd, dp, floors, pal, o) {
  const seed = (Math.imul(Math.round(F.cx * 8) | 0, 73856093) ^ Math.imul(Math.round(F.cz * 8) | 0, 19349663) ^ Math.imul(Math.round(wd * 64 + dp * 7) | 0, 83492791) ^ 0x5bd1e995) >>> 0;
  const r = mulberry32(seed), pk = (a) => a[Math.floor(r() * a.length)];
  const flat = !!(o.flatRoof || floors > 1), PL = DX.PAL;
  let key;
  if (o.style && HSTY[o.style]) key = o.style;   // 지역이 정한 양식 (산타 공방 진저브레드 · 산장 통나무집)
  else if (PL.military.includes(pal)) key = 'military';
  else if (DX.XM) key = flat ? weightedPick([['brick', 3], ['farm', 3], ['cottage', 2], ['ginger', 1.5], ['stone', 1]], r) : weightedPick([['cabin', 3], ['cottage', 3], ['farm', 2], ['ginger', 2.5], ['stone', 1], ['brick', 1]], r);
  else if (PL.city.includes(pal)) key = floors > 1 ? weightedPick([['town', 6], ['modern', 2]], r) : weightedPick([['modern', 3], ['town', 2]], r);
  else if (V2_PAL.wood.includes(pal)) key = 'jungle';
  else if (V2_PAL.tropic.includes(pal)) key = 'tropic';
  else if (PL.house.includes(pal)) key = flat ? weightedPick([['farm', 3], ['brick', 2.5], ['cottage', 2], ['stone', 2], ['modern', 1]], r) : weightedPick([['cottage', 3], ['farm', 3], ['brick', 2], ['stone', 2], ['cabin', 1.2]], r);
  else key = 'keep';
  const st = HSTY[key], var_ = 0.95 + r() * 0.1;
  const wallC = hdMul(st.walls ? pk(st.walls) : pal[0], var_), roofC = st.roofs ? pk(st.roofs) : pal[1];
  const wp = Array.isArray(st.wp) ? pk(st.wp) : st.wp, rp = pk(st.rp);
  const S = { key, st, r, pk, flat, wallC, roofC, wp, rp, trim: pk(st.trim), shut: pk(st.shut), door: pk(st.door), base: st.base, basep: st.basep,
    roofT: weightedPick(key === 'cabin' || key === 'ginger' ? [['gable', 5], ['gableX', 4], ['hip', 1]] : key === 'tropic' || key === 'keep' ? [['hip', 4], ['gable', 3], ['gableX', 2]] : [['gable', 4], ['gableX', 3], ['hip', 2.5]], r),
    timber: !!st.timber && r() < st.timber, uo: [F.cx, F.by, F.cz] };
  S.shutters = !S.timber && r() < (st.shutter || 0); S.flowers = r() < (st.flower || 0);
  if (key === 'military') S.wallC = hdMul(pal[0], var_);
  if (key === 'tropic' || key === 'keep' || key === 'jungle') S.trim = key === 'jungle' ? S.trim : (((wallC >> 16) & 255) + ((wallC >> 8) & 255) + (wallC & 255) > 560 ? 0x5b4b3b : S.trim);
  if (S.timber) S.wallC = hdMul(pk([0xf3ecd9, 0xf6eee2, 0xefe4cc, 0xf2e6d6]), var_);
  const P = HTX.P, uo = S.uo;
  S.wallO = { mat: 'tex', pat: P[wp], uo };
  S.slabO = { mat: 'tex', pat: P[key === 'military' || key === 'modern' ? 'concrete' : 'concrete'], uo };
  S.floorO = { mat: 'tex', pat: P.floor, uo };
  S.innerO = { mat: 'tex', pat: P.stucco, uo };
  S.foundC = key === 'ginger' ? 0xe8e0d8 : st.base;
  // 평지붕 윗면: 방수 초록 · 회색 · 적갈색 · 청회색 (하늘에서 내려다볼 때 마을이 한 가지 색이 되지 않게)
  S.flatC = key === 'military' ? roofC : pk([0x6f8f6a, 0x7a7570, 0x8a5a4a, 0x5f6a70, 0x6f8f6a, 0x86807a]);
  return S;
}

// ---------- 공용 그리기 도구 (지역 좌표 → 세계: F.pt · F.by) ----------
const HD_NC = { noCollide: true };
function hdBox(C, x0, y0, z0, x1, y1, z1, color, pat) {
  if (x1 - x0 < 0.004 || y1 - y0 < 0.004 || z1 - z0 < 0.004) return;
  C.F.box(x0, y0, z0, x1, y1, z1, color, pat ? { noCollide: true, mat: 'tex', pat: HTX.P[pat], uo: C.S.uo } : HD_NC);
}
// 다각형 면(볼록, 점 3~4개): out = 바깥쪽 방향(지역) — 감는 방향을 맞춘다 · uv: 무늬 칸 단위 [u,v]…
// uv === 'w': 벽 상자와 같은 규칙(세계 좌표)으로 → 박공 세모가 아래 벽 무늬와 이어진다
function hdPoly(C, pts, color, out, pat, uv) {
  const a = pts[0], b = pts[1], c = pts[2];
  const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (out && nx * out[0] + ny * out[1] + nz * out[2] < 0) { pts = pts.slice().reverse(); if (uv && uv !== 'w') uv = uv.slice().reverse(); }
  const F = C.F, W = pts.map((p) => { const q = F.pt(p[0], p[2]); return [q[0], F.by + p[1], q[1]]; });
  const P = pat ? HTX.P[pat] : undefined;
  if (uv === 'w' && P) {
    const [ox, oy, oz] = C.S.uo, q0 = W[0], q1 = W[1], q2 = W[2];
    const wx = Math.abs((q1[1] - q0[1]) * (q2[2] - q0[2]) - (q1[2] - q0[2]) * (q2[1] - q0[1])), wy = Math.abs((q1[2] - q0[2]) * (q2[0] - q0[0]) - (q1[0] - q0[0]) * (q2[2] - q0[2])), wz = Math.abs((q1[0] - q0[0]) * (q2[1] - q0[1]) - (q1[1] - q0[1]) * (q2[0] - q0[0]));
    uv = W.map((p) => (wy > wx && wy > wz ? [(p[0] - ox) / P.sx, (p[2] - oz) / P.sy] : wx > wz ? [(p[2] - oz) / P.sx, -(p[1] - oy) / P.sy] : [(p[0] - ox) / P.sx, -(p[1] - oy) / P.sy]));
  }
  C.DX.getBatch(F.cx, F.cz, P ? 'tex' : undefined).poly(W, color, P, uv);
}
// 전구 (빛나는 팔면체)
function hdBulb(C, x, y, z, s, color) { const F = C.F, q = F.pt(x, z); C.DX.getBatch(F.cx, F.cz, 'lit').oct(q[0], F.by + y, q[1], s, color, C.S.r() * TAU); }
// 벽면 좌표: side f(앞, -z)·b(뒤, +z)·l(왼쪽, -x)·r(오른쪽, +x). a = 벽을 따라가는 좌표, d = 벽 바깥면에서 떨어진 거리
const HD_SD = { f: ['x', -1], b: ['x', 1], l: ['z', -1], r: ['z', 1] };
function hdWallAt(C, sd) { const [ax, n] = HD_SD[sd]; return ax === 'x' ? (n < 0 ? C.Z0 : C.Z1) : (n < 0 ? C.X0 : C.X1); }
function hdWB(C, sd, a0, a1, y0, y1, d0, d1, color, pat) {
  const [ax, n] = HD_SD[sd], at = hdWallAt(C, sd), p0 = at + n * d0, p1 = at + n * d1;
  if (a0 > a1) [a0, a1] = [a1, a0];
  if (ax === 'x') hdBox(C, a0, y0, Math.min(p0, p1), a1, y1, Math.max(p0, p1), color, pat);
  else hdBox(C, Math.min(p0, p1), y0, a0, Math.max(p0, p1), y1, a1, color, pat);
}
const hdWP = (C, sd, a, y, d) => { const [ax, n] = HD_SD[sd], at = hdWallAt(C, sd) + n * d; return ax === 'x' ? [a, y, at] : [at, y, a]; };
const hdWN = (sd) => { const [ax, n] = HD_SD[sd]; return ax === 'x' ? [0, 0, n] : [n, 0, 0]; };
const hdExt = (C, sd) => (HD_SD[sd][0] === 'x' ? [C.X0, C.X1] : [C.Z0, C.Z1]);
// 구간 [a,b] 가 벽의 다른 구멍들과 겹치지 않는지
const hdFree = (C, sd, a, b, y0, y1, skip) => { const [e0, e1] = hdExt(C, sd); if (a < e0 + 0.22 || b > e1 - 0.22) return false; for (const O of C.open) if (O.sd === sd && O !== skip && O.y1 > y0 && O.y0 < y1 && O.b > a - 0.05 && O.a < b + 0.05) return false; return true; };
// 벽을 따라 [e0,e1] 를 문 같은 구멍(y0~y1 과 겹치는)을 피해 나눈 조각
function hdSplit(C, sd, e0, e1, y0, y1, pad = 0.08) { const cut = C.open.filter((O) => O.sd === sd && O.y0 < y1 && O.y1 > y0).map((O) => [O.a - pad, O.b + pad]).sort((p, q) => p[0] - q[0]); const out = []; let cur = e0; for (const [a, b] of cut) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, b); } if (cur < e1) out.push([cur, e1]); return out.filter(([a, b]) => b - a > 0.05); }

// ---------- 집 장식 본체 ----------
// H: { wd, dp, floors, fh, t, hw, hd, flat, balcony, walls:[{sd, fl, ops}], S }
function houseDeco(DX, F, H) {
  const S = H.S, r = S.r, st = S.st, t = H.t, fh = H.fh;
  const C = { DX, F, S, H, st, r, X0: -H.hw - t / 2, X1: H.hw + t / 2, Z0: -H.hd - t / 2, Z1: H.hd + t / 2, ry: H.floors * fh, open: [], XM: !!DX.XM };
  for (const W of H.walls) for (const op of W.ops) { const y0 = W.fl * fh + 0.15; C.open.push({ sd: W.sd, fl: W.fl, a: op.a, b: op.b, y0: y0 + op.lo, y1: y0 + op.hi, door: op.lo === 0 }); }
  C.awnPlan = !!(st.awning && H.flat && r() < st.awning);   // 차양막을 달 집은 현관 차양·앞 외벽 처마를 생략
  const trim = S.trim, wallC = S.wallC, top = C.ry;
  // 1) 밑동 띠 (문은 비움)
  const baseC = hdMul(S.base, 0.98);
  for (const sd of ['f', 'b', 'l', 'r']) { const [e0, e1] = hdExt(C, sd); for (const [a, b] of hdSplit(C, sd, e0 - 0.04, e1 + 0.04, 0.15, 0.62)) hdWB(C, sd, a, b, 0.15, 0.6, 0, 0.04, baseC, S.basep); }
  // 2) 모서리: 돌 모서리(quoin) 또는 모서리 판
  const cornerC = S.timber ? 0x4a3324 : st.quoin ? hdMul(wallC, 1.12) : S.key === 'cabin' ? hdMul(wallC, 0.78) : trim;
  for (const [cx, cz, sx, sz] of [[C.X0, C.Z0, 1, 1], [C.X1, C.Z0, -1, 1], [C.X0, C.Z1, 1, -1], [C.X1, C.Z1, -1, -1]]) {
    if (st.quoin) for (let y = 0.62, k = 0; y < top - 0.3; y += 0.42, k++) { const lx = k % 2 ? 0.42 : 0.26, lz = k % 2 ? 0.26 : 0.42; hdBox(C, Math.min(cx - sx * 0.04, cx + sx * lx), y, Math.min(cz - sz * 0.04, cz + sz * lz), Math.max(cx - sx * 0.04, cx + sx * lx), y + 0.36, Math.max(cz - sz * 0.04, cz + sz * lz), cornerC, 'stone'); }
    else hdBox(C, Math.min(cx - sx * 0.045, cx + sx * 0.17), 0.6, Math.min(cz - sz * 0.045, cz + sz * 0.17), Math.max(cx - sx * 0.045, cx + sx * 0.17), top - 0.02, Math.max(cz - sz * 0.045, cz + sz * 0.17), cornerC);
  }
  // 3) 층 띠 (2층)
  if (H.floors > 1) for (const sd of ['f', 'b', 'l', 'r']) { const [e0, e1] = hdExt(C, sd); for (const [a, b] of hdSplit(C, sd, e0 - 0.06, e1 + 0.06, fh - 0.04, fh + 0.16)) hdWB(C, sd, a, b, fh - 0.04, fh + 0.16, 0, 0.06, trim); }
  // 4) 반목조 (시골집): 위·가운데·아래 가로대 + 구멍 옆 기둥 + 넓은 칸에 빗장
  if (S.timber) hdTimber(C);
  // 5) 창·문
  for (const O of C.open) { if (O.door) hdDoor(C, O); else hdWindow(C, O); }
  // 6) 지붕
  const roof = H.flat ? hdFlatRoof(C) : S.roofT === 'hip' ? hdHip(C) : hdGable(C, S.roofT === 'gableX' ? 'z' : 'x');
  // 7) 굴뚝
  if (st.chim && r() < st.chim) hdChimney(C, roof);
  // 8) 발코니 난간
  if (H.balcony) hdBalcony(C);
  // 9) 상가: 차양막 · 간판 · 실외기
  if (C.awnPlan) hdAwning(C);
  if (st.sign && r() < st.sign) hdSign(C);
  if (st.ac && r() < st.ac) hdAC(C);
  if (st.accent && r() < st.accent) hdAccent(C);
  if (st.vents) for (let k = 0; k < 2; k++) { const x = (k ? 0.5 : -0.5) * H.hw; hdBox(C, x - 0.35, C.ry + 0.2, -0.3, x + 0.35, C.ry + 0.62, 0.3, 0x6a6e66); hdBox(C, x - 0.42, C.ry + 0.62, -0.37, x + 0.42, C.ry + 0.68, 0.37, 0x55594f); }
  // 10) 크리스마스 섬
  if (C.XM) hdXmas(C, roof);
}

function hdTimber(C) {
  const { H, S } = C, fh = H.fh, TC = 0x4a3324;
  for (let fl = H.floors > 1 ? 1 : 0; fl < H.floors; fl++) {
    const yb = fl * fh + 0.15 + (fl === 0 ? 0.47 : 0.05), yt = fl === H.floors - 1 ? (H.flat ? (fl + 1) * fh - 0.34 : fl * fh + 2.72) : (fl + 1) * fh - 0.06, ys = fl * fh + 0.15 + 0.98;
    for (const sd of ['f', 'b', 'l', 'r']) {
      const [e0, e1] = hdExt(C, sd);
      for (const [y0, y1] of [[yb, yb + 0.16], [ys - 0.15, ys], [yt - 0.16, yt]]) for (const [a, b] of hdSplit(C, sd, e0, e1, y0, y1, 0.12)) hdWB(C, sd, a, b, y0, y1, 0, 0.035, TC);
      // 기둥: 구멍 양옆 + 벽 끝 → 칸마다 빗장
      const posts = [e0 + 0.08, e1 - 0.08];
      for (const O of C.open) if (O.sd === sd && O.fl === fl) { posts.push(O.a - 0.2, O.b + 0.2); }
      posts.sort((p, q) => p - q);
      const P2 = []; for (const p of posts) if (!P2.length || p - P2[P2.length - 1] > 0.3) P2.push(p);
      for (const p of P2) { if (p < e0 + 0.05 || p > e1 - 0.05) continue; const inOpen = C.open.some((O) => O.sd === sd && O.fl === fl && p > O.a - 0.12 && p < O.b + 0.12); if (!inOpen) hdWB(C, sd, p - 0.08, p + 0.08, yb + 0.16, yt - 0.16, 0, 0.034, TC); }
      for (let i = 0; i < P2.length - 1; i++) {
        const a = P2[i] + 0.08, b = P2[i + 1] - 0.08; if (b - a < 1.0) continue;
        if (C.open.some((O) => O.sd === sd && O.fl === fl && O.b > a && O.a < b)) continue;
        const dir = (i + fl) % 2, ya = yb + 0.16, yb2 = yt - 0.16, wv = 0.15;
        const p0 = dir ? [a, ya] : [b, ya], p1 = dir ? [b, yb2] : [a, yb2], sx = dir ? wv : -wv;
        hdPoly(C, [hdWP(C, sd, p0[0], p0[1], 0.033), hdWP(C, sd, p0[0] + sx, p0[1], 0.033), hdWP(C, sd, p1[0], p1[1], 0.033), hdWP(C, sd, p1[0] - sx, p1[1], 0.033)], TC, hdWN(sd));
        if (b - a > 2.3) { const m = (a + b) / 2; hdWB(C, sd, m - 0.08, m + 0.08, ya, yb2, 0, 0.034, TC); }
      }
    }
  }
}

function hdWindow(C, O) {
  const { S, st, r } = C, sd = O.sd, trim = S.trim, lintel = st.lintel && (st.lintel >= 1 || r() < st.lintel);
  // 창틀 (위·양옆) + 창턱
  if (lintel) hdWB(C, sd, O.a - 0.15, O.b + 0.15, O.y1, O.y1 + 0.24, 0, 0.05, S.key === 'brick' || S.key === 'town' ? 0xe2dccd : hdMul(S.wallC, 1.1), 'stone');
  else hdWB(C, sd, O.a - 0.08, O.b + 0.08, O.y1, O.y1 + 0.1, 0, 0.065, trim);
  hdWB(C, sd, O.a - 0.08, O.a, O.y0, O.y1, 0, 0.06, trim); hdWB(C, sd, O.b, O.b + 0.08, O.y0, O.y1, 0, 0.06, trim);
  hdWB(C, sd, O.a - 0.14, O.b + 0.14, O.y0 - 0.09, O.y0 + 0.02, 0, 0.15, S.key === 'ginger' ? 0xfbf8f4 : lintel ? 0xd8d2c4 : trim);
  if (S.key === 'ginger') for (let x = O.a - 0.08; x < O.b + 0.08; x += 0.2) hdWB(C, sd, x, x + 0.12, O.y1 + 0.1, O.y1 + 0.17, 0, 0.07, 0xfbf8f4);   // 창 위 설탕 장식
  // 덧창 (양쪽 다 자리가 있을 때만)
  if (S.shutters && sd !== 'b' && O.y1 - O.y0 > 0.8 && hdFree(C, sd, O.a - 0.62, O.a - 0.07, O.y0, O.y1, O) && hdFree(C, sd, O.b + 0.07, O.b + 0.62, O.y0, O.y1, O)) {
    const sc = S.shut;
    for (const [a, b] of [[O.a - 0.6, O.a - 0.08], [O.b + 0.08, O.b + 0.6]]) { hdWB(C, sd, a, b, O.y0 - 0.02, O.y1 + 0.03, 0, 0.035, sc); hdWB(C, sd, a + 0.06, b - 0.06, (O.y0 + O.y1) / 2 - 0.03, (O.y0 + O.y1) / 2 + 0.03, 0.035, 0.05, hdMul(sc, 0.75)); }
  }
  // 꽃상자 (앞·옆 1층, 크리스마스 섬은 상록수 상자)
  if (S.flowers && O.fl === 0 && sd !== 'b' && r() < 0.8) {
    const wood = S.key === 'modern' ? 0x3a3d40 : 0x6b4a32;
    hdWB(C, sd, O.a - 0.04, O.b + 0.04, O.y0 - 0.42, O.y0 - 0.1, 0.02, 0.26, wood);
    hdWB(C, sd, O.a + 0.02, O.b - 0.02, O.y0 - 0.1, O.y0 + 0.08, 0.05, 0.23, C.XM ? 0x2a5a3a : 0x3f7a3a);
    if (!C.XM) for (let x = O.a + 0.12; x < O.b - 0.08; x += 0.26 + r() * 0.12) { const fc = S.pk([0xe84a5a, 0xf2c94c, 0xf2f2f2, 0xd86ad0, 0xff8a3a]); hdWB(C, sd, x, x + 0.11, O.y0 + 0.06, O.y0 + 0.17, 0.1, 0.2, fc); }
    else { hdWB(C, sd, O.a, O.b, O.y0 + 0.08, O.y0 + 0.13, 0.04, 0.24, 0xf4f8fb); for (let x = O.a + 0.15; x < O.b - 0.1; x += 0.35) hdWB(C, sd, x, x + 0.07, O.y0 + 0.11, O.y0 + 0.18, 0.12, 0.19, 0xc8202e); }
  }
}

function hdDoor(C, O) {
  const { S, st, r, H } = C, sd = O.sd, trim = S.trim, front = sd === 'f' && O.fl === 0;
  // 문틀
  hdWB(C, sd, O.a - 0.11, O.a, 0.15, O.y1, 0, 0.075, trim); hdWB(C, sd, O.b, O.b + 0.11, 0.15, O.y1, 0, 0.075, trim);
  hdWB(C, sd, O.a - 0.11, O.b + 0.11, O.y1, O.y1 + 0.15, 0, 0.08, trim);
  if (O.fl > 0) return;
  // 안쪽으로 열린 문짝 두 장 (벽 안쪽 면에 직각, 통로는 그대로)
  const [ax, n] = HD_SD[sd], inner = hdWallAt(C, sd) - n * H.t, dc = S.door;
  for (const [x0, x1] of [[O.a + 0.02, O.a + 0.07], [O.b - 0.07, O.b - 0.02]]) {
    const z0 = inner - n * 0.02, z1 = inner - n * 0.86;
    if (ax === 'x') hdBox(C, x0, 0.16, Math.min(z0, z1), x1, O.y1 - 0.05, Math.max(z0, z1), dc); else hdBox(C, Math.min(z0, z1), 0.16, x0, Math.max(z0, z1), O.y1 - 0.05, x1, dc);
  }
  if (!front) { hdWB(C, sd, O.a - 0.35, O.b + 0.35, O.y1 + 0.2, O.y1 + 0.3, 0, 0.75, hdMul(S.roofC, 0.9)); return; }
  // 외등 · 문패
  const lx = hdFree(C, sd, O.b + 0.18, O.b + 0.42, 1.6, 2.1, O) ? O.b + 0.24 : O.a - 0.4;
  hdWB(C, sd, lx, lx + 0.16, 1.72, 2.02, 0, 0.18, 0x2a2a2a); hdWB(C, sd, lx + 0.02, lx + 0.14, 1.76, 1.94, 0.18, 0.2, 0xffe2a0);
  if (hdFree(C, sd, O.a - 0.5, O.a - 0.15, 1.85, 2.1, O)) hdWB(C, sd, O.a - 0.5, O.a - 0.18, 1.86, 2.06, 0, 0.025, S.pk([0x22304a, 0xf1ece2, 0x2f5a3a]));
  // 현관 차양 (발코니가 있으면 발코니가 지붕 역할)
  if (H.balcony || C.awnPlan) return;
  const y = Math.min(O.y1 + 0.24, C.ry - 0.24), e = 1.15, a0 = O.a - 0.45, b0 = O.b + 0.45, rc = S.roofC;
  if (st.porch === 'gable' && !H.flat) {
    const at = hdWallAt(C, sd), n2 = HD_SD[sd][1], hh = 0.62, zc = at + n2 * e, mid = (a0 + b0) / 2;
    const P = (a, yy, d) => hdWP(C, sd, a, yy, d);
    for (const s of [-1, 1]) {
      const xe = s < 0 ? a0 - 0.08 : b0 + 0.08;
      hdPoly(C, [P(xe, y, 0), P(xe, y, e), P(mid, y + hh, e), P(mid, y + hh, 0)], rc, [s * (HD_SD[sd][0] === 'x' ? 1 : 0), 1, s * (HD_SD[sd][0] === 'z' ? 1 : 0)], S.rp, [[0, 0], [0, e], [1, e], [1, 0]].map(([u, v]) => [u * 0.8, v]));
      hdPoly(C, [P(xe, y - 0.1, e), P(xe, y, e), P(mid, y + hh, e), P(mid, y + hh - 0.1, e)], trim, hdWN(sd));
    }
    hdPoly(C, [P(a0, y, e - 0.02), P(b0, y, e - 0.02), P(mid, y + hh - 0.06, e - 0.02)], S.key === 'ginger' ? 0xfbf8f4 : C.S.wallC, hdWN(sd), S.wp, 'w');
    hdPoly(C, [P(a0 - 0.08, y, 0), P(b0 + 0.08, y, 0), P(b0 + 0.08, y, e), P(a0 - 0.08, y, e)], hdMul(trim, 0.85), [0, -1, 0]);   // 차양 밑면
    void zc;
    for (const x of [a0 + 0.08, b0 - 0.08]) { hdWB(C, sd, x - 0.05, x + 0.05, y - 0.55, y, 0, 0.1, trim); hdPoly(C, [P(x - 0.04, y - 0.5, 0.1), P(x + 0.04, y - 0.5, 0.1), P(x + 0.04, y - 0.04, e - 0.15), P(x - 0.04, y - 0.04, e - 0.15)], trim, [0, -1, 0]); }
  } else {
    hdWB(C, sd, a0, b0, y, y + 0.12, 0, e, rc, H.flat ? undefined : S.rp);
    hdWB(C, sd, a0, b0, y - 0.06, y + 0.14, e - 0.06, e, trim);
    for (const x of [a0 + 0.1, b0 - 0.1]) hdWB(C, sd, x - 0.04, x + 0.04, y - 0.42, y, 0, 0.42, trim);
  }
  C.porch = { sd, a0, b0, y: y + 0.12, e };
}

// 박공지붕 (ax 'x': 용마루가 x 방향, 앞뒤로 경사 · 'z': 앞박공 — 정면에 세모 벽)
function hdGable(C, ax) {
  const { S, H, r } = C, P = HTX.P[S.rp], L = (u, y, v) => (ax === 'x' ? [u, y, v] : [v, y, u]);
  const uh = ax === 'x' ? C.X1 : C.Z1, vh = ax === 'x' ? C.Z1 : C.X1;
  const e = 0.55, g = 0.34, yb = C.ry + 0.1, Hh = clamp(vh * 0.55, 1.5, 2.3), m = Hh / vh, ye = yb - e * m, yr = yb + Hh, ue = uh + g, ve = vh + e, th = 0.16, lift = 0.035;
  const SL = Math.hypot(ve, yr - ye), N = Math.max(3, Math.round(SL / 0.62)), rc = S.roofC, trim = S.key === 'ginger' ? 0xfbf8f4 : S.trim;
  for (const s of [-1, 1]) {
    const nl = Math.hypot(ve, yr - ye), n = [0, ve / nl, s * (yr - ye) / nl], at = (tt) => [ye + (yr - ye) * tt, s * ve * (1 - tt)];
    for (let k = 0; k < N; k++) {
      const [y0, v0] = at(k / N), [y1, v1] = at((k + 1) / N), ly = n[1] * lift, lv = n[2] * lift, cc = hdMul(rc, 0.95 + 0.07 * (k % 2) + (r() - 0.5) * 0.05);
      const vt0 = (1 - k / N) * SL / P.sy, vt1 = (1 - (k + 1) / N) * SL / P.sy, uu = 2 * ue / P.sx;
      hdPoly(C, [L(-ue, y0 + ly, v0 + lv), L(ue, y0 + ly, v0 + lv), L(ue, y1, v1), L(-ue, y1, v1)], cc, L(0, n[1], n[2]), S.rp, [[0, vt0], [uu, vt0], [uu, vt1], [0, vt1]]);
      if (k > 0) hdPoly(C, [L(-ue, y0, v0), L(ue, y0, v0), L(ue, y0 + ly, v0 + lv), L(-ue, y0 + ly, v0 + lv)], hdMul(rc, 0.62), L(0, -n[1] * 0.3, s));
    }
    // 처마널 · 처마 밑 · 박공널 · 박공 처마 밑
    hdPoly(C, [L(-ue, ye - th, s * ve), L(ue, ye - th, s * ve), L(ue, ye + lift, s * ve), L(-ue, ye + lift, s * ve)], trim, L(0, 0, s));
    hdPoly(C, [L(-ue, ye - th, s * ve), L(ue, ye - th, s * ve), L(ue, ye - th, s * vh), L(-ue, ye - th, s * vh)], hdMul(trim, 0.85), [0, -1, 0]);
    for (const su of [-1, 1]) {
      hdPoly(C, [L(su * ue, ye - th, s * ve), L(su * ue, ye + lift, s * ve), L(su * ue, yr + lift, 0), L(su * ue, yr - th, 0)], trim, L(su, 0, 0));
      hdPoly(C, [L(su * uh, ye - th, s * ve), L(su * ue, ye - th, s * ve), L(su * ue, yr - th, 0), L(su * uh, yr - th, 0)], hdMul(trim, 0.8), L(0, -n[1], -n[2]));
    }
  }
  // 박공벽 세모 (벽 무늬) + 환기창 / 반목조
  for (const su of [-1, 1]) {
    hdPoly(C, [L(su * uh, yb - th, -vh), L(su * uh, yb - th, vh), L(su * uh, yr - th - 0.02, 0)], S.wallC, L(su, 0, 0), S.wp, 'w');
    const gv = (v, y, d) => L(su * (uh + d), y, v);
    if (S.timber) { hdPoly(C, [gv(-0.08, yb - 0.1, 0.03), gv(0.08, yb - 0.1, 0.03), gv(0.08, yr - th - 0.1, 0.03), gv(-0.08, yr - th - 0.1, 0.03)], 0x4a3324, L(su, 0, 0)); for (const sv of [-1, 1]) hdPoly(C, [gv(sv * 0.08, yb + 0.1, 0.03), gv(sv * 0.24, yb + 0.1, 0.03), gv(sv * vh * 0.62, yb + Hh * 0.3, 0.03), gv(sv * vh * 0.5, yb + Hh * 0.36, 0.03)], 0x4a3324, L(su, 0, 0)); }
    else if (Hh > 1.4) { const yv = yb + Hh * 0.38; if (ax === 'z' && su < 0 && C.XM) continue; hdBox(C, ...hdLB(L, su * uh, yv, -0.28, su * (uh + 0.05), yv + 0.42, 0.28), hdMul(trim, 0.7)); }
  }
  // 용마루
  hdBox(C, ...hdLB(L, -ue - 0.02, yr - 0.06, -0.13, ue + 0.02, yr + 0.1, 0.13), hdMul(rc, 0.72));
  if (S.key === 'ginger') for (const s of [-1, 1]) for (let u = -ue + 0.1; u < ue - 0.1; u += 0.32) hdBox(C, ...hdLB(L, u, ye - th - 0.12, s * ve - 0.06, u + 0.18, ye - th, s * ve + 0.06), 0xfbf8f4);   // 처마 설탕 고드름
  C.soffitY = ye - th;
  return { type: 'gable', ax, L, uh, vh, ue, ve, ye, yr, yb, Hh, m, th, e, g };
}
// 지붕 좌표 상자 → 지역 상자 인자
function hdLB(L, u0, y0, v0, u1, y1, v1) { const a = L(u0, y0, v0), b = L(u1, y1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]; }

// 모임지붕: 네 방향 경사 (긴 쪽에 용마루)
function hdHip(C) {
  const { S, r } = C, P = HTX.P[S.rp], ax = C.X1 >= C.Z1 ? 'x' : 'z', L = (u, y, v) => (ax === 'x' ? [u, y, v] : [v, y, u]);
  const uh = ax === 'x' ? C.X1 : C.Z1, vh = ax === 'x' ? C.Z1 : C.X1, e = 0.55, yb = C.ry + 0.1, Hh = clamp(vh * 0.5, 1.35, 2.05), m = Hh / vh;
  const A = uh + e, Bv = vh + e, ye = yb - e * m, yr = ye + Bv * m, Lr = Math.max(0, A - Bv), th = 0.16, rc = S.roofC, trim = S.trim;
  // 면: [처마 왼쪽, 처마 오른쪽, 위 오른쪽, 위 왼쪽] (바깥에서 볼 때)
  const faces = [
    [L(-A, ye, -Bv), L(A, ye, -Bv), L(Lr, yr, 0), L(-Lr, yr, 0), L(0, 1, -1)],
    [L(A, ye, Bv), L(-A, ye, Bv), L(-Lr, yr, 0), L(Lr, yr, 0), L(0, 1, 1)],
    [L(-A, ye, Bv), L(-A, ye, -Bv), L(-Lr, yr, 0), L(-Lr, yr, 0), L(-1, 1, 0)],
    [L(A, ye, -Bv), L(A, ye, Bv), L(Lr, yr, 0), L(Lr, yr, 0), L(1, 1, 0)],
  ];
  const SL = Math.hypot(Bv, yr - ye), N = Math.max(3, Math.round(SL / 0.62)), lerp3 = (p, q, tt) => [lerp(p[0], q[0], tt), lerp(p[1], q[1], tt), lerp(p[2], q[2], tt)];
  for (const [p0, p1, p2, p3, out] of faces) {
    const ew = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), tw = Math.hypot(p2[0] - p3[0], p2[2] - p3[2]);
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N, a0 = lerp3(p0, p3, t0), b0 = lerp3(p1, p2, t0), a1 = lerp3(p0, p3, t1), b1 = lerp3(p1, p2, t1), lift = k > 0 ? 0.035 : 0, cc = hdMul(rc, 0.95 + 0.07 * (k % 2) + (r() - 0.5) * 0.05);
      const up = (p) => [p[0] + out[0] * lift * 0.6, p[1] + lift, p[2] + out[2] * lift * 0.6], v0 = (1 - t0) * SL / P.sy, v1 = (1 - t1) * SL / P.sy, w0 = lerp(ew, tw, t0) / P.sx, w1 = lerp(ew, tw, t1) / P.sx, c0 = (ew / P.sx - w0) / 2, c1 = (ew / P.sx - w1) / 2;
      if (Math.hypot(b1[0] - a1[0], b1[2] - a1[2]) < 0.02) hdPoly(C, [up(a0), up(b0), a1], cc, out, S.rp, [[c0, v0], [c0 + w0, v0], [c1, v1]]);
      else hdPoly(C, [up(a0), up(b0), b1, a1], cc, out, S.rp, [[c0, v0], [c0 + w0, v0], [c1 + w1, v1], [c1, v1]]);
      if (lift) hdPoly(C, [a0, b0, up(b0), up(a0)], hdMul(rc, 0.62), [out[0], -0.3, out[2]]);
    }
    // 처마널 + 처마 밑
    hdPoly(C, [[p0[0], ye - th, p0[2]], [p1[0], ye - th, p1[2]], [p1[0], ye + 0.035, p1[2]], [p0[0], ye + 0.035, p0[2]]], trim, [out[0], 0, out[2]]);
  }
  // 처마 밑 (벽 밖 둘레만 — 실내 천장은 그대로)
  const ys = ye - th, sc = hdMul(trim, 0.85);
  for (const [a, b, c, d] of [[L(-A, ys, -Bv), L(A, ys, -Bv), L(uh, ys, -vh), L(-uh, ys, -vh)], [L(A, ys, Bv), L(-A, ys, Bv), L(-uh, ys, vh), L(uh, ys, vh)], [L(-A, ys, Bv), L(-A, ys, -Bv), L(-uh, ys, -vh), L(-uh, ys, vh)], [L(A, ys, -Bv), L(A, ys, Bv), L(uh, ys, vh), L(uh, ys, -vh)]]) hdPoly(C, [a, b, c, d], sc, [0, -1, 0]);
  if (Lr > 0.05) hdBox(C, ...hdLB(L, -Lr - 0.05, yr - 0.06, -0.12, Lr + 0.05, yr + 0.09, 0.12), hdMul(rc, 0.72));
  C.soffitY = ye - th;
  return { type: 'hip', ax, L, uh, vh, ue: A, ve: Bv, ye, yr, yb, Hh, m, th, e, Lr };
}

// 평지붕: 갓돌 · 코니스 · (양식에 따라) 앞뒤 외벽 처마
function hdFlatRoof(C) {
  const { S, st, r, H } = C, ry = C.ry, hw = H.hw, hd = H.hd, cop = S.key === 'modern' ? 0xd8d8d4 : S.key === 'military' ? 0x6a6a5e : 0xe2dccd;
  // 갓돌 (난간 위)
  hdBox(C, -hw - 0.26, ry + 0.75, -hd - 0.26, hw + 0.26, ry + 0.83, -hd + 0.09, cop); hdBox(C, -hw - 0.26, ry + 0.75, hd - 0.09, hw + 0.26, ry + 0.83, hd + 0.26, cop);
  hdBox(C, -hw - 0.26, ry + 0.75, -hd + 0.09, -hw + 0.09, ry + 0.83, hd - 0.09, cop); hdBox(C, hw - 0.09, ry + 0.75, -hd + 0.09, hw + 0.26, ry + 0.83, hd - 0.09, cop);
  // 코니스 (지붕판 위 바깥 띠)
  if (st.cornice || S.key !== 'military') { const cc = S.key === 'modern' ? hdMul(S.wallC, 0.8) : S.trim; hdBox(C, -hw - 0.32, ry + 0.2, -hd - 0.32, hw + 0.32, ry + 0.38, -hd - 0.2, cc); hdBox(C, -hw - 0.32, ry + 0.2, hd + 0.2, hw + 0.32, ry + 0.38, hd + 0.32, cc); hdBox(C, -hw - 0.32, ry + 0.2, -hd - 0.2, -hw - 0.2, ry + 0.38, hd + 0.2, cc); hdBox(C, hw + 0.2, ry + 0.2, -hd - 0.2, hw + 0.32, ry + 0.38, hd + 0.2, cc); }
  // 외벽 처마: 지붕판 바로 아래 기와 경사띠 (앞·뒤)
  if (st.pent && r() < st.pent) {
    const rp = S.rp === 'metal' ? 'tile' : S.rp, rc = S.key === 'town' || S.key === 'tropic' ? S.pk([0x9c4b33, 0xa95d3b, 0x8a3f2d]) : S.roofC;
    for (const sd of H.floors > 1 ? ['f', 'b'] : ['b']) {   // 1층 집은 앞 처마를 두지 않는다 (차양막·간판과 겹침)
      const n = HD_SD[sd][1], z0 = n < 0 ? C.Z0 : C.Z1, y0 = ry - 0.16, y1 = ry - 0.5, e = 0.72, P = (x, y, d) => [x, y, z0 + n * d];
      hdPoly(C, [P(-hw - 0.32, y0, 0), P(hw + 0.32, y0, 0), P(hw + 0.32, y1, e), P(-hw - 0.32, y1, e)], rc, [0, 1, n], rp, [[0, 0], [(2 * hw + 0.6) / HTX.P[rp].sx, 0], [(2 * hw + 0.6) / HTX.P[rp].sx, 0.82 / HTX.P[rp].sy], [0, 0.82 / HTX.P[rp].sy]]);
      hdPoly(C, [P(-hw - 0.32, y1 - 0.1, e), P(hw + 0.32, y1 - 0.1, e), P(hw + 0.32, y1, e), P(-hw - 0.32, y1, e)], S.trim, [0, 0, n]);
      hdPoly(C, [P(-hw - 0.32, y1 - 0.1, e), P(hw + 0.32, y1 - 0.1, e), P(hw + 0.32, y1 - 0.1, 0), P(-hw - 0.32, y1 - 0.1, 0)], hdMul(S.trim, 0.8), [0, -1, 0]);
      for (const sx of [-1, 1]) hdPoly(C, [P(sx * (hw + 0.32), y0, 0), P(sx * (hw + 0.32), y1 - 0.1, 0), P(sx * (hw + 0.32), y1 - 0.1, e), P(sx * (hw + 0.32), y1, e)], S.trim, [sx, 0, 0]);
      for (let x = -hw + 0.6; x <= hw - 0.5; x += Math.max(1.6, (2 * hw - 1.2) / 3)) hdWB(C, sd, x - 0.05, x + 0.05, y1 - 0.3, y1 - 0.1, 0, 0.45, S.trim);
      if (sd === 'f') C.pentY = y1 - 0.1;
    }
  }
  return { type: 'flat', ry };
}

function hdChimney(C, roof) {
  const { S, r, H } = C, pat = S.st.chimp || (S.key === 'stone' || S.key === 'cabin' ? 'stone' : 'brick'), col = pat === 'candy' ? 0xffffff : pat === 'stone' ? 0xa8a090 : S.pk([0xa9583f, 0x9b5a48, 0x8f4a38]);
  if (roof.type === 'flat') {   // 옆벽 바깥 굴뚝: 땅에서 난간 위 1.1m 까지
    const sd = r() < 0.5 ? 'l' : 'r', [e0, e1] = hdExt(C, sd); let a = null;
    for (const c of [e0 + 0.75, e1 - 0.75, (e0 + e1) / 2]) if (hdFree(C, sd, c - 0.45, c + 0.45, 0, 99)) { a = c; break; }
    if (a === null) return;
    hdWB(C, sd, a - 0.38, a + 0.38, 0.15, C.ry + 1.55, 0, 0.62, col, pat); hdWB(C, sd, a - 0.46, a + 0.46, C.ry + 1.55, C.ry + 1.66, 0, 0.7, 0x5a5650); hdWB(C, sd, a - 0.14, a + 0.14, C.ry + 1.66, C.ry + 1.88, 0.2, 0.45, 0x3a3836);
    C.chim = { x: hdWP(C, sd, a, 0, 0.33), y: C.ry + 1.66 }; return;
  }
  const L = roof.L, u = (r() < 0.5 ? -1 : 1) * roof.uh * (0.45 + r() * 0.2), v = roof.type === 'hip' ? 0 : (r() < 0.55 ? 0 : (r() < 0.5 ? -1 : 1) * roof.vh * 0.35);
  if (roof.type === 'hip' && Math.abs(u) > roof.Lr + 0.3) { /* 모임지붕 끝 경사 위 */ }
  const yTop = roof.yr - Math.abs(v) * roof.m + (v === 0 ? 0.75 : 1.0);
  hdBox(C, ...hdLB(L, u - 0.36, roof.yb - 0.4, v - 0.29, u + 0.36, yTop, v + 0.29), col, pat);
  hdBox(C, ...hdLB(L, u - 0.44, yTop, v - 0.37, u + 0.44, yTop + 0.1, v + 0.37), 0x5a5650);
  hdBox(C, ...hdLB(L, u - 0.13, yTop + 0.1, v - 0.13, u + 0.13, yTop + 0.32, v + 0.13), 0x3a3836);
  C.chim = { x: L(u, 0, v), y: yTop + 0.1 };
}

function hdBalcony(C) {
  const { S, H } = C, fy = H.fh, hd = H.hd, t = H.t, key = S.key, rc = key === 'town' ? 0x2a2a2a : key === 'modern' ? 0x9aa6ad : S.trim;
  const Z = -hd - 2.2, y0 = fy + 0.15, y1 = fy + 1.15;
  if (key === 'modern') {   // 판 난간
    hdBox(C, -2.2, y0, Z, 2.2, y1 - 0.05, Z + 0.15, S.wallC, S.wp); hdBox(C, -2.2, y0, Z + 0.15, -2.05, y1 - 0.05, -hd - t / 2, S.wallC, S.wp); hdBox(C, 2.05, y0, Z + 0.15, 2.2, y1 - 0.05, -hd - t / 2, S.wallC, S.wp);
    hdBox(C, -2.25, y1 - 0.05, Z - 0.04, 2.25, y1 + 0.02, Z + 0.19, 0x34383b);
  } else {   // 손잡이 + 아래대 + 살
    for (const [x0, z0, x1, z1] of [[-2.2, Z, 2.2, Z + 0.15], [-2.2, Z + 0.15, -2.05, -hd - t / 2], [2.05, Z + 0.15, 2.2, -hd - t / 2]]) { hdBox(C, x0 - 0.02, y1 - 0.1, z0 - 0.02, x1 + 0.02, y1 + 0.02, z1 + 0.02, rc); hdBox(C, x0, y0, z0, x1, y0 + 0.1, z1, rc); }
    const bw = key === 'town' ? 0.03 : 0.05;
    for (let x = -2.05; x <= 2.06; x += 0.3) hdBox(C, x - bw, y0 + 0.1, Z + 0.05, x + bw, y1 - 0.1, Z + 0.1, rc);
    for (const sx of [-1, 1]) for (let z = Z + 0.45; z < -hd - 0.3; z += 0.3) hdBox(C, sx * 2.125 - bw, y0 + 0.1, z - bw, sx * 2.125 + bw, y1 - 0.1, z + bw, rc);
  }
  hdBox(C, -2.25, fy - 0.2, Z - 0.05, 2.25, fy - 0.1, -hd - t / 2, hdMul(S.trim, 0.9));   // 바닥 테두리
  if (S.flowers && !C.XM) { hdBox(C, -1.2, y1 - 0.1, Z - 0.28, 1.2, y1 + 0.12, Z - 0.02, 0x6b4a32); for (let x = -1.05; x < 1.1; x += 0.3) hdBox(C, x, y1 + 0.1, Z - 0.22, x + 0.14, y1 + 0.24, Z - 0.08, S.pk([0xe84a5a, 0xf2c94c, 0xd86ad0, 0x3f7a3a])); }
}

function hdAwning(C) {   // 1층 앞 줄무늬 차양막
  const { S, H } = C, fr = C.open.filter((O) => O.sd === 'f' && O.fl === 0); if (!fr.length) return;
  const a = Math.max(C.X0 + 0.3, Math.min(...fr.map((O) => O.a)) - 0.35), b = Math.min(C.X1 - 0.3, Math.max(...fr.map((O) => O.b)) + 0.35), [c1, c2] = S.pk(S.st.awn || HSTY.town.awn), y0 = 2.92, y1 = 2.5, e = 1.05, n = Math.max(4, Math.round((b - a) / 0.5));
  for (let i = 0; i < n; i++) {
    const x0 = lerp(a, b, i / n), x1 = lerp(a, b, (i + 1) / n), col = i % 2 ? c2 : c1, P = (x, y, d) => hdWP(C, 'f', x, y, d);
    hdPoly(C, [P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, e), P(x0, y1, e)], col, [0, 1, -1]);
    hdPoly(C, [P(x0, y1 - 0.22, e), P(x1, y1 - 0.22, e), P(x1, y1, e), P(x0, y1, e)], col, [0, 0, -1]);
    hdPoly(C, [P(x0, y1 - 0.22, e), P(x1, y1 - 0.22, e), P(x1, y0 - 0.02, 0.02), P(x0, y0 - 0.02, 0.02)], hdMul(col, 0.7), [0, -1, 0]);
  }
  for (const x of [a, b]) hdPoly(C, [hdWP(C, 'f', x, y0, 0), hdWP(C, 'f', x, y1 - 0.22, e), hdWP(C, 'f', x, y1, e)], hdMul(c1, 0.85), [x === a ? -1 : 1, 0, 0]);
  C.awn = true;
}
function hdSign(C) {   // 간판: 1층 앞 문 위 (차양막 위 또는 문 위)
  const { S, H, r } = C, fr = C.open.find((O) => O.sd === 'f' && O.fl === 0 && O.door); if (!fr) return;
  const w = Math.min(2.6, C.X1 - C.X0 - 1.2), c = (fr.a + fr.b) / 2, a = clamp(c - w / 2, C.X0 + 0.4, C.X1 - 0.4 - w), y0 = C.awn ? 2.98 : 2.66, y1 = Math.min(y0 + 0.5, H.floors > 1 ? H.fh - 0.08 : C.ry - 0.1);
  if (y1 - y0 < 0.3 || (H.balcony)) return;
  const col = S.pk([0xf6f0e0, 0xe8d6a8, 0xd6e6ee, 0xf2dcd0, 0xdfeedd]), id = C.XM && r() < 0.6 ? 8 + Math.floor(r() * 4) : Math.floor(r() * 8);
  hdWB(C, 'f', a - 0.06, a + w + 0.06, y0 - 0.06, y1 + 0.06, 0, 0.07, S.pk([0x3a3836, 0x5b3b29, 0x22304a]));
  const P = (x, y) => hdWP(C, 'f', x, y, 0.075);
  // 앞벽(-z)을 바라보면 오른쪽이 지역 -x → 글자가 뒤집히지 않게 u 를 큰 x 에서 0 으로
  hdPoly(C, [P(a, y0), P(a + w, y0), P(a + w, y1), P(a, y1)], col, [0, 0, -1], 'sign' + id, [[0.999, 0.999], [0, 0.999], [0, 0.001], [0.999, 0.001]]);
}
function hdAC(C) {   // 벽걸이 실외기 (옆·뒤 벽, 창 아래)
  const { r, H } = C, cand = C.open.filter((O) => !O.door && O.sd !== 'f' && O.fl === H.floors - 1);
  if (!cand.length) return; const O = cand[Math.floor(r() * cand.length)], w = 0.8, a = (O.a + O.b) / 2 - w / 2, y = O.y0 - 0.75;
  if (y < 0.6) return;
  hdWB(C, O.sd, a, a + w, y, y + 0.6, 0, 0.32, 0xd8d8d2); hdWB(C, O.sd, a + 0.08, a + 0.48, y + 0.1, y + 0.5, 0.32, 0.34, 0x4a4e52); hdWB(C, O.sd, a - 0.02, a + w + 0.02, y - 0.06, y, 0, 0.36, 0x6a6e72);
}
function hdAccent(C) {   // 현대식: 앞벽 한쪽을 세로 널빤지 판으로
  const { S, H, r } = C, [e0, e1] = hdExt(C, 'f'), left = r() < 0.5, a = left ? e0 + 0.2 : (e0 + e1) / 2 + 0.6, b = left ? (e0 + e1) / 2 - 0.6 : e1 - 0.2;
  for (const [x0, x1] of hdSplit(C, 'f', a, b, 0.62, C.ry - 0.05, 0.12)) hdWB(C, 'f', x0, x1, 0.62, C.ry - 0.05, 0, 0.03, S.pk([0x9a6a42, 0x7a5236, 0xb0805a]), 'plank');
}

// ---------- 크리스마스 섬: 눈 · 고드름 · 전구 · 화환 · 선물 · 마당 트리 · 눈사람 ----------
function hdXmas(C, roof) {
  const { S, H, r } = C, SNOW = 0xf4f8fb, ICE = 0xd8eef8;
  // 지붕 눈
  if (roof.type === 'gable') {
    const L = roof.L, { ue, ve, ye, yr } = roof;
    for (const s of [-1, 1]) {
      const at = (tt) => [ye + (yr - ye) * tt + 0.11, s * ve * (1 - tt)], [ya, va] = at(0.04), [yb2, vb] = at(1);
      hdPoly(C, [L(-ue + 0.03, ya, va), L(ue - 0.03, ya, va), L(ue - 0.03, yb2, vb), L(-ue + 0.03, yb2, vb)], SNOW, L(0, 1, s * 0.5), 'snow', [[0, 0], [2 * ue / 3, 0], [2 * ue / 3, ve / 3], [0, ve / 3]]);
      hdBox(C, ...hdLB(L, -ue, ye + 0.02, s * ve - 0.1, ue, ye + 0.2, s * ve + 0.07), SNOW);
      // 고드름 (처마 밑)
      if (s < 0 || roof.ax === 'x') for (let u = -ue + 0.15; u < ue - 0.1; u += 0.22 + r() * 0.2) { const len = 0.12 + r() * 0.35, v0 = s * ve, P = (du, y, dv) => L(u + du, y, v0 + dv); const y0 = ye - roof.th; hdPoly(C, [P(-0.045, y0, -0.03 * s), P(0.045, y0, -0.03 * s), P(0, y0 - len, 0)], ICE, L(0, 0, s)); hdPoly(C, [P(0.045, y0, -0.03 * s), P(0, y0, 0.05 * s), P(0, y0 - len, 0)], hdMul(ICE, 0.9), L(1, 0, s)); }
    }
    hdBox(C, ...hdLB(L, -ue, yr + 0.08, -0.22, ue, yr + 0.24, 0.22), SNOW);
  } else if (roof.type === 'hip') {
    const L = roof.L, { ue: A, ve: Bv, ye, yr, Lr } = roof, k = 0.11;
    const faces = [[L(-A, ye + k, -Bv), L(A, ye + k, -Bv), L(Lr, yr + k, 0), L(-Lr, yr + k, 0), L(0, 1, -1)], [L(A, ye + k, Bv), L(-A, ye + k, Bv), L(-Lr, yr + k, 0), L(Lr, yr + k, 0), L(0, 1, 1)], [L(-A, ye + k, Bv), L(-A, ye + k, -Bv), L(-Lr, yr + k, 0), L(-Lr, yr + k, 0), L(-1, 1, 0)], [L(A, ye + k, -Bv), L(A, ye + k, Bv), L(Lr, yr + k, 0), L(Lr, yr + k, 0), L(1, 1, 0)]];
    for (const [p0, p1, p2, p3, out] of faces) { if (Math.hypot(p2[0] - p3[0], p2[2] - p3[2]) < 0.02) hdPoly(C, [p0, p1, p2], SNOW, out, 'snow', [[0, 0], [2, 0], [1, 1]]); else hdPoly(C, [p0, p1, p2, p3], SNOW, out, 'snow', [[0, 0], [2, 0], [1.5, 1], [0.5, 1]]); }
    for (let u = -A + 0.15; u < A - 0.1; u += 0.24 + r() * 0.2) { const len = 0.12 + r() * 0.3, P = (du, y, dv) => L(u + du, y, -Bv + dv), y0 = ye - roof.th; hdPoly(C, [P(-0.045, y0, 0.03), P(0.045, y0, 0.03), P(0, y0 - len, 0)], ICE, L(0, 0, -1)); }
  } else {
    const ry = C.ry, hw = H.hw, hd = H.hd;
    hdBox(C, -hw + 0.06, ry + 0.2, -hd + 0.06, hw - 0.06, ry + 0.29, hd - 0.06, SNOW, 'snow');
    for (const [x0, z0, x1, z1] of [[-hw - 0.26, -hd - 0.26, hw + 0.26, -hd + 0.09], [-hw - 0.26, hd - 0.09, hw + 0.26, hd + 0.26], [-hw - 0.26, -hd + 0.09, -hw + 0.09, hd - 0.09], [hw - 0.09, -hd + 0.09, hw + 0.26, hd - 0.09]]) hdBox(C, x0, ry + 0.83, z0, x1, ry + 0.92, z1, SNOW);
    if (C.pentY) hdPoly(C, [[-hw - 0.32, ry - 0.08, C.Z0], [hw + 0.32, ry - 0.08, C.Z0], [hw + 0.32, ry - 0.42, C.Z0 - 0.72], [-hw - 0.32, ry - 0.42, C.Z0 - 0.72]], SNOW, [0, 1, -1], 'snow', [[0, 0], [2, 0], [2, 0.3], [0, 0.3]]);
  }
  // 창턱·차양 눈
  for (const O of C.open) if (!O.door) hdWB(C, O.sd, O.a - 0.13, O.b + 0.13, O.y0 + 0.02, O.y0 + 0.08, 0, 0.15, SNOW);
  if (C.porch) { const p = C.porch; hdWB(C, p.sd, p.a0 + 0.02, p.b0 - 0.02, p.y, p.y + 0.08, 0, p.e - 0.02, SNOW); }
  if (C.chim) { const c = C.chim; hdBox(C, c.x[0] - 0.42, c.y, c.x[2] - 0.35, c.x[0] + 0.42, c.y + 0.09, c.x[2] + 0.35, SNOW); }
  if (S.key === 'military') return;   // 막사는 눈만
  // 전구 줄: 앞 처마(또는 앞박공 두 빗변 · 평지붕은 앞 난간 위) — 줄마다 살짝 처짐
  const string = (pa, pb, n) => { for (let i = 0; i <= n; i++) { const u = i / n, sag = -0.08 * Math.sin(Math.PI * ((u * n) % 4) / 4); hdBulb(C, lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u) + sag, lerp(pa[2], pb[2], u), 0.055, BULBS[(i + Math.floor(r() * 2)) % BULBS.length]); } };
  if (roof.type === 'gable' && roof.ax === 'z') { const L = roof.L, y0 = roof.ye - roof.th - 0.06, d = -roof.ue - 0.05; string(L(d, y0, -roof.ve), L(d, roof.yr - roof.th - 0.04, 0), Math.round(roof.ve / 0.3)); string(L(d, roof.yr - roof.th - 0.04, 0), L(d, y0, roof.ve), Math.round(roof.ve / 0.3)); }
  else if (roof.type !== 'flat') {   // 앞 처마 한 줄 (ax 'x': 처마가 x 방향 · 모임지붕 ax 'z': 앞 끝 세모의 처마)
    const L = roof.L, y = roof.ye - roof.th - 0.06, P0 = roof.ax === 'x' ? L(-roof.ue, y, -roof.ve - 0.04) : L(-roof.ue - 0.04, y, -roof.ve), P1 = roof.ax === 'x' ? L(roof.ue, y, -roof.ve - 0.04) : L(-roof.ue - 0.04, y, roof.ve);
    string(P0, P1, Math.round(Math.hypot(P1[0] - P0[0], P1[2] - P0[2]) / 0.3));
  }
  else string([-H.hw - 0.26, C.ry + 0.7, -H.hd - 0.3], [H.hw + 0.26, C.ry + 0.7, -H.hd - 0.3], Math.round(H.hw * 2 / 0.3));
  // 현관: 문 위 화환 · 문틀 전구 · 선물 상자
  const door = C.open.find((O) => O.sd === 'f' && O.fl === 0 && O.door);
  if (door) {
    const wx = hdFree(C, 'f', door.b + 0.3, door.b + 0.9, 1.3, 2.2, door) ? door.b + 0.6 : hdFree(C, 'f', door.a - 0.9, door.a - 0.3, 1.3, 2.2, door) ? door.a - 0.6 : null;
    if (wx !== null) hdWreath(C, 'f', wx, 1.78);
    for (let k = 0; k <= 8; k++) { const u = k / 8; hdBulb(C, ...hdWP(C, 'f', lerp(door.a - 0.06, door.b + 0.06, u), door.y1 + 0.2 - Math.sin(Math.PI * u) * 0.08, 0.1), 0.045, BULBS[k % BULBS.length]); }
    const ng = 1 + Math.floor(r() * 3);
    for (let i = 0; i < ng; i++) { const x = (i % 2 ? 1 : -1) * (1.72 + (i > 1 ? 0.5 : 0)), s = 0.3 + r() * 0.25; hdGift(C, x, C.Z0 - 0.35 - r() * 0.5, s); }
  }
  // 마당: 작은 트리 (앞 모서리) · 가끔 눈사람
  const tx = (r() < 0.5 ? -1 : 1) * (H.hw + 0.75), tz = C.Z0 - 0.75;
  hdTree(C, tx, tz, 1.2 + r() * 0.6);
  if (r() < 0.3) hdSnowman(C, -tx * 0.85, C.Z0 - 0.95);
}
function hdWreath(C, sd, a, y) {   // 화환: 고리(10조각) + 붉은 열매 + 리본
  const R0 = 0.27, R1 = 0.14, n = 10, d = 0.06, G = 0x1f5a32;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, P = (ang, rr, dd) => hdWP(C, sd, a + Math.cos(ang) * rr, y + Math.sin(ang) * rr, dd);
    hdPoly(C, [P(a0, R1, d), P(a0, R0, d), P(a1, R0, d), P(a1, R1, d)], i % 2 ? G : hdMul(G, 1.25), hdWN(sd));
    const am = (a0 + a1) / 2, rad = HD_SD[sd][0] === 'x' ? [Math.cos(am), Math.sin(am), 0] : [0, Math.sin(am), Math.cos(am)];
    hdPoly(C, [P(a0, R0, 0), P(a1, R0, 0), P(a1, R0, d), P(a0, R0, d)], hdMul(G, 0.8), rad);
  }
  for (const ang of [0.6, 2.2, 3.6, 5.0]) hdWB(C, sd, a + Math.cos(ang) * 0.205 - 0.03, a + Math.cos(ang) * 0.205 + 0.03, y + Math.sin(ang) * 0.205 - 0.03, y + Math.sin(ang) * 0.205 + 0.03, d, d + 0.04, 0xd8202e);
  hdWB(C, sd, a - 0.12, a + 0.12, y - 0.3, y - 0.2, d, d + 0.04, 0xc8202e); hdWB(C, sd, a - 0.04, a + 0.04, y - 0.42, y - 0.22, d, d + 0.03, 0xc8202e);
}
function hdGift(C, x, z, s) {   // 선물 상자: 포장 무늬 + 리본 십자 + 매듭
  const { S } = C, c = S.pk([0xc8202e, 0x2a7a3a, 0x2a5ac8, 0xe8c45a, 0x8a3aa8, 0xf2f2ee]), rc = c === 0xe8c45a || c === 0xf2f2ee ? 0xc8202e : S.pk([0xe8c45a, 0xf2f2ee]), h = s * 0.8;
  hdBox(C, x - s / 2, 0.02, z - s / 2, x + s / 2, h, z + s / 2, c, S.pk(['gift1', 'gift2', 'gift3']));
  hdBox(C, x - s / 2 - 0.01, 0.02, z - 0.04, x + s / 2 + 0.01, h + 0.01, z + 0.04, rc); hdBox(C, x - 0.04, 0.02, z - s / 2 - 0.01, x + 0.04, h + 0.01, z + s / 2 + 0.01, rc);
  hdBox(C, x - 0.09, h, z - 0.05, x + 0.09, h + 0.09, z + 0.05, rc);
}
function hdTree(C, x, z, hgt) {   // 마당 트리: 원뿔 3단 + 눈 + 전구 + 별
  const F = C.F, gc = 0x1d4a2e;
  F.geo(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 5), x, 0.2, z, 0x4a2e1a);
  const T = [[0.62, 0.62, 0.3], [0.48, 0.55, 0.62], [0.32, 0.48, 0.92]];
  for (const [rr, hh, yy] of T) { const k = hgt / 1.5; F.geo(new THREE.ConeGeometry(rr * k, hh * k, 7), x, (yy + hh / 2) * k, z, gc); F.geo(new THREE.ConeGeometry(rr * k * 0.78, hh * k * 0.32, 7), x, (yy + hh * 0.86) * k, z, 0xf4f8fb); }
  const k = hgt / 1.5;
  for (let i = 0; i < 12; i++) { const u = i / 12, yy = (0.35 + u * 1.0) * k, rr = (0.6 - u * 0.4) * k, ang = u * TAU * 2.2; hdBulb(C, x + Math.cos(ang) * rr, yy, z + Math.sin(ang) * rr, 0.045, BULBS[i % BULBS.length]); }
  hdBulb(C, x, 1.46 * k, z, 0.11, 0xffd65a);
}
function hdSnowman(C, x, z) {
  const F = C.F, W = 0xf2f6f9;
  F.geo(new THREE.SphereGeometry(0.38, 8, 6), x, 0.34, z, W); F.geo(new THREE.SphereGeometry(0.28, 8, 6), x, 0.86, z, W); F.geo(new THREE.SphereGeometry(0.2, 8, 6), x, 1.24, z, W);
  F.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 8), x, 1.42, z, 0x1a1a1c); F.geo(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 8), x, 1.52, z, 0x1a1a1c);
  F.geo(new THREE.ConeGeometry(0.035, 0.18, 5).rotateX(-Math.PI / 2), x, 1.25, z - 0.25, 0xf07a1a);
  hdBox(C, x - 0.2, 1.04, z - 0.2, x + 0.2, 1.1, z + 0.2, 0xc8202e);
}
