// ============================================================
// 04_body.js — 사람 캐릭터의 몸: 뼈대 · 절차적 스킨드 메시 · 옷 슬롯(스킨) · 질감 아틀라스
//  · 뼈대 33개: 골반·허리·가슴·목·머리 / 쇄골·위팔·아래팔·손·엄지2·검지2·나머지 손가락2 (좌우) / 허벅지·정강이·발·발가락 (좌우)
//  · 몸은 관절에서 끊기지 않고 휘는 하나의 메시(SkinnedMesh). 같은 외형은 지오메트리를 모든 캐릭터가 공유
//  · 옷은 슬롯(모자·상의·하의·신발·장갑·낙하산)별 부품 생성기 — SKINS 표에 항목을 더하면 창고에 나온다
//  · 질감: 1024² 아틀라스 한 장(얼굴·니트·능직·가죽·피부·머리카락·고무·위장 무늬) × 정점 색 → 캐릭터당 그리기 1번
//  · 먼 거리용 간략 메시(LOD) 자동 전환
//  좌표: +z 앞, +y 위, +x 캐릭터 왼쪽. 원점은 두 발 사이 바닥
// ============================================================
const Body = (() => {
  // ---------- 뼈대 (부모 기준 위치, 선 자세) ----------
  const DEF = [
    ['hips', null, 0, 0.97, 0], ['spine', 'hips', 0, 0.10, -0.005], ['chest', 'spine', 0, 0.18, 0],
    ['neck', 'chest', 0, 0.27, -0.015], ['head', 'neck', 0, 0.083, 0.004],
  ];
  const SIDES = [[1, 'L'], [-1, 'R']];
  for (const [s, k] of SIDES) DEF.push(
    ['clav' + k, 'chest', s * 0.028, 0.205, 0.035], ['sh' + k, 'clav' + k, s * 0.163, -0.034, -0.035],
    ['el' + k, 'sh' + k, 0, -0.295, 0], ['hand' + k, 'el' + k, 0, -0.255, 0],
    ['thumb1' + k, 'hand' + k, -s * 0.011, -0.024, 0.024], ['thumb2' + k, 'thumb1' + k, 0, -0.037, 0],
    ['idx1' + k, 'hand' + k, 0, -0.094, 0.026], ['idx2' + k, 'idx1' + k, 0, -0.043, 0],
    ['fin1' + k, 'hand' + k, 0, -0.094, -0.01], ['fin2' + k, 'fin1' + k, 0, -0.045, 0]);
  for (const [s, k] of SIDES) DEF.push(
    ['hip' + k, 'hips', s * 0.088, -0.05, 0.005], ['knee' + k, 'hip' + k, 0, -0.415, 0],
    ['foot' + k, 'knee' + k, 0, -0.42, -0.01], ['toe' + k, 'foot' + k, 0, -0.06, 0.128]);
  const BI = {}; DEF.forEach((d, i) => { BI[d[0]] = i; });
  // 기본 각도: 엄지는 손바닥 앞쪽 아래로. 바인드(메시를 만드는 자세)는 팔을 45° 벌린 A 자세
  const REST = { thumb1L: [-0.75, 0, -0.32], thumb1R: [-0.75, 0, 0.32] };
  const APOSE = { shL: [0, 0, 0.75], shR: [0, 0, -0.75] };
  const LEN = { upper: 0.295, fore: 0.255, thigh: 0.415, shin: 0.42 };
  function makeBones(apose) {
    const B = {}, list = [];
    for (const [n, p, x, y, z] of DEF) {
      const b = new THREE.Bone(); b.name = n; b.position.set(x, y, z);
      const r = (apose && APOSE[n]) || REST[n]; if (r) b.rotation.set(r[0], r[1], r[2]);
      B[n] = b; list.push(b); if (p) B[p].add(b);
    }
    return { B, list };
  }
  let BIND = null;
  function bindPose() {
    if (BIND) return BIND;
    const { B, list } = makeBones(true); B.hips.updateMatrixWorld(true);
    BIND = { inv: list.map((b) => b.matrixWorld.clone().invert()), M: {} };
    for (const b of list) BIND.M[b.name] = b.matrixWorld.clone();
    return BIND;
  }

  // ---------- 질감 아틀라스 ----------
  //  2048×1024: 왼쪽 절반은 몸·기본 옷, 오른쪽 절반은 스킨 무늬(위장·체크·데님·금·빛나는 선)
  //  빛나는 셀(glow*)은 같은 배치의 발광 지도(emissiveMap)에도 그려져 어두운 곳에서도 선이 빛난다
  const ATW = 2048, ATH = 1024, PAD = 6;
  const CELL = { face: [0, 0, 512, 512], knit: [512, 0, 256, 256], twill: [768, 0, 256, 256], leather: [512, 256, 256, 256], skin: [768, 256, 256, 256],
    hair: [0, 512, 256, 256], sole: [256, 512, 256, 256], canvas: [512, 512, 256, 256], glove: [768, 512, 256, 256],
    camoW: [0, 768, 256, 256], camoD: [256, 768, 256, 256], camoU: [512, 768, 256, 256], gloss: [768, 768, 128, 256], matte: [896, 768, 128, 256],
    camoS: [1024, 0, 256, 256], camoDig: [1280, 0, 256, 256], camoTiger: [1536, 0, 256, 256], plaid: [1792, 0, 256, 256],
    denim: [1024, 256, 256, 256], stripe: [1280, 256, 256, 256], gold: [1536, 256, 256, 256], sneak: [1792, 256, 256, 256],
    glowC: [1024, 512, 256, 256], glowO: [1280, 512, 256, 256], glowP: [1536, 512, 256, 256], fleece: [1792, 512, 256, 256] };
  // 셀별 거칠기 (16×8 격자, 한 칸 = 128px)
  const ROUGH = { face: 0.62, knit: 0.93, twill: 0.9, leather: 0.55, skin: 0.6, hair: 0.58, sole: 0.92, canvas: 0.9, glove: 0.75, camoW: 0.9, camoD: 0.9, camoU: 0.9, gloss: 0.12, matte: 0.85,
    camoS: 0.9, camoDig: 0.9, camoTiger: 0.9, plaid: 0.92, denim: 0.92, stripe: 0.93, gold: 0.3, sneak: 0.85, glowC: 0.45, glowO: 0.38, glowP: 0.45, fleece: 0.96 };
  const _uv = [0, 0];
  function cellUV(name, u, v) {
    const c = CELL[name] || CELL.matte;
    const x = c[0] + PAD + clamp(u, 0, 1) * (c[2] - PAD * 2), y = c[1] + PAD + (1 - clamp(v, 0, 1)) * (c[3] - PAD * 2);
    _uv[0] = x / ATW; _uv[1] = 1 - y / ATH; return _uv;
  }
  // 머리 원통 투영: 정면을 넓게 (u = 0.5 + 0.5 sin(α/2), v = 0.5 + 0.5 y)
  const faceU = (al) => 0.5 + 0.5 * Math.sin(al / 2), faceV = (uy) => 0.5 + 0.5 * uy;
  let ATLAS = null, MAT = null, EMI = null, RIGIDMAT = null;
  function paintAtlas() {
    const cv = document.createElement('canvas'); cv.width = ATW; cv.height = ATH;
    const g = cv.getContext('2d'), rng = mulberry32(90210);
    const R = (a, b) => a + rng() * (b - a);
    const cellDo = (name, fn) => { const c = CELL[name]; g.save(); g.beginPath(); g.rect(c[0], c[1], c[2], c[3]); g.clip(); g.translate(c[0], c[1]); fn(c[2], c[3]); g.restore(); };
    const speck = (w, h, n, a0, a1, light) => { for (let i = 0; i < n; i++) { const v = Math.floor(R(a0, a1)); g.fillStyle = light ? `rgba(255,255,255,${R(0.05, 0.25)})` : `rgba(0,0,0,${R(0.03, 0.12)})`; g.fillRect(R(0, w), R(0, h), v, v); } };
    // 얼굴·머리 (피부 톤은 정점 색으로 곱해진다 → 여기는 밝은 회색 기준)
    cellDo('face', (W, H) => {
      const X = (ux, uy) => PAD + faceU(Math.atan2(ux, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)))) * (W - PAD * 2);
      const Y = (uy) => PAD + (1 - faceV(uy)) * (H - PAD * 2);
      g.fillStyle = '#efefef'; g.fillRect(0, 0, W, H);
      // 잔잔한 피부 얼룩
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '180,120,110' : '120,100,90'},${R(0.015, 0.04)})`; g.beginPath(); g.arc(R(0, W), R(0, H), R(4, 18), 0, TAU); g.fill(); }
      // 두피(머리카락이 덮음)
      const sc = g.createLinearGradient(0, 0, 0, Y(0.45)); sc.addColorStop(0, 'rgba(70,60,55,0.35)'); sc.addColorStop(1, 'rgba(70,60,55,0)'); g.fillStyle = sc; g.fillRect(0, 0, W, Y(0.45));
      const rg = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      for (const s of [1, -1]) {
        rg(X(s * 0.5, -0.05), Y(-0.05), 30, 'rgba(205,110,100,0.1)');      // 볼 홍조
        rg(X(s * 0.33, 0.22), Y(0.22), 24, 'rgba(90,60,55,0.2)');           // 눈두덩
        rg(X(s * 0.42, -0.5), Y(-0.5), 30, 'rgba(90,70,60,0.08)');          // 턱선
      }
      rg(X(0, -0.66), Y(-0.66), 26, 'rgba(90,70,60,0.08)');
      // 눈(먼 거리용 그림 — 가까이서는 눈알 메시가 덮는다)
      for (const s of [1, -1]) {
        const ex = X(s * 0.33, 0.22), ey = Y(0.22);
        g.fillStyle = '#e9e4df'; g.beginPath(); g.ellipse(ex, ey, 9, 4.6, 0, 0, TAU); g.fill();
        g.fillStyle = '#3b2b22'; g.beginPath(); g.arc(ex, ey + 0.3, 3.6, 0, TAU); g.fill();
        // 윗눈꺼풀·속눈썹 / 아랫눈꺼풀
        g.strokeStyle = 'rgba(40,26,20,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(ex, ey + 1.5, 10, 6.2, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        g.strokeStyle = 'rgba(95,65,55,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex, ey - 0.5, 9, 4.8, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
        g.strokeStyle = 'rgba(120,85,75,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex, ey - 3, 11, 9, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); // 쌍꺼풀 주름
        // 눈썹: 짧은 털 획을 겹쳐 그림
        const b0 = s * 0.17, b1 = s * 0.52;
        for (let i = 0; i < 70; i++) {
          const t = rng(), ux = lerp(b0, b1, t), uy = 0.345 + Math.sin(t * Math.PI) * 0.035 - t * 0.02 + R(-0.012, 0.012);
          const x = X(ux, uy), y = Y(uy), th = lerp(4.8, 2.0, t);
          g.strokeStyle = `rgba(38,26,20,${R(0.45, 0.85)})`; g.lineWidth = R(0.8, 1.6);
          g.beginPath(); g.moveTo(x, y + R(-th / 2, th / 2)); g.lineTo(x + s * R(3, 6), y + R(-th / 2, th / 2) - 1.2); g.stroke();
        }
      }
      // 코: 콧볼 그림자·콧구멍
      const nx = X(0, -0.17), ny = Y(-0.17);
      rg(nx, ny + 4, 12, 'rgba(110,70,60,0.18)');
      for (const s of [1, -1]) { g.fillStyle = 'rgba(80,45,40,0.75)'; g.beginPath(); g.ellipse(nx + s * 5.2, ny + 4.5, 2.6, 1.5, s * 0.3, 0, TAU); g.fill(); }
      // 인중
      g.strokeStyle = 'rgba(120,80,70,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0, -0.23), Y(-0.23)); g.lineTo(X(0, -0.3), Y(-0.3)); g.stroke();
      // 입술
      const mx = X(0, -0.355), my = Y(-0.355);
      g.fillStyle = 'rgba(190,105,100,0.85)'; g.beginPath(); g.moveTo(mx - 17, my); g.quadraticCurveTo(mx - 8, my - 6, mx, my - 3.5); g.quadraticCurveTo(mx + 8, my - 6, mx + 17, my); g.quadraticCurveTo(mx, my + 1, mx - 17, my); g.fill();
      g.fillStyle = 'rgba(200,115,108,0.85)'; g.beginPath(); g.moveTo(mx - 16, my + 0.5); g.quadraticCurveTo(mx, my + 11, mx + 16, my + 0.5); g.quadraticCurveTo(mx, my + 2, mx - 16, my + 0.5); g.fill();
      g.fillStyle = 'rgba(255,240,235,0.25)'; g.beginPath(); g.ellipse(mx, my + 5, 7, 2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,40,38,0.85)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(mx - 17, my); g.quadraticCurveTo(mx, my + 2.2, mx + 17, my); g.stroke();
      // 팔자 주름·턱 끝
      for (const s of [1, -1]) { g.strokeStyle = 'rgba(110,75,65,0.07)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(s * 0.17, -0.12), Y(-0.12)); g.quadraticCurveTo(X(s * 0.27, -0.3), Y(-0.3), X(s * 0.24, -0.42), Y(-0.42)); g.stroke(); }
      g.strokeStyle = 'rgba(110,75,65,0.14)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(-0.1, -0.52), Y(-0.52)); g.quadraticCurveTo(X(0, -0.49), Y(-0.49), X(0.1, -0.52), Y(-0.52)); g.stroke();
    });
    cellDo('knit', (W, H) => {
      g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 2) { g.fillStyle = x % 4 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)'; g.fillRect(x, 0, 1, H); }
      for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, y, W, 1); }
      speck(W, H, 900, 1, 2.5); speck(W, H, 300, 1, 2, true);
      // 큰 주름 음영(부드럽게)
      for (let i = 0; i < 14; i++) { const y = R(0, H), gr = g.createLinearGradient(0, y - 10, 0, y + 10); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y - 10, W, 20); }
    });
    cellDo('twill', (W, H) => {
      g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
      for (let k = -H; k < W; k += 4) { g.beginPath(); g.moveTo(k, H); g.lineTo(k + H, 0); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < W; k += 16) g.fillRect(k, 0, 1, H); for (let k = 0; k < H; k += 16) g.fillRect(0, k, W, 1);
      speck(W, H, 700, 1, 2.5);
      for (let i = 0; i < 18; i++) { const y = R(0, H), gr = g.createLinearGradient(0, y - 12, 0, y + 12); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y - 12, W, 24); }
    });
    cellDo('leather', (W, H) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${R(0.02, 0.07)})`; g.beginPath(); g.arc(R(0, W), R(0, H), R(4, 20), 0, TAU); g.fill(); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = R(0.6, 1.4); const x = R(0, W), y = R(0, H); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-14, 14), y + R(-3, 3)); g.stroke(); }
      speck(W, H, 500, 1, 2);
      // 끈(정면 u≈0.25, 위쪽 70%)
      const cx = PAD + 0.25 * (W - PAD * 2), y0 = PAD + 0.0 * (H - PAD * 2), y1 = PAD + 0.7 * (H - PAD * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - 9, y0, 18, y1 - y0);
      for (let y = y0 + 6; y < y1; y += 13) {
        g.strokeStyle = 'rgba(30,26,22,0.95)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 10, y); g.lineTo(cx + 10, y + 7); g.moveTo(cx + 10, y); g.lineTo(cx - 10, y + 7); g.stroke();
        g.fillStyle = '#8a8a86'; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 12, y + 3, 2.2, 0, TAU); g.fill(); }
      }
      // 박음질 선
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(0, PAD + 0.86 * (H - PAD * 2)); g.lineTo(W, PAD + 0.86 * (H - PAD * 2)); g.stroke(); g.setLineDash([]);
    });
    cellDo('skin', (W, H) => {
      g.fillStyle = '#efefef'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '180,120,110' : '120,100,90'},${R(0.015, 0.045)})`; g.beginPath(); g.arc(R(0, W), R(0, H), R(5, 22), 0, TAU); g.fill(); }
      speck(W, H, 500, 1, 1.6);
    });
    cellDo('hair', (W, H) => {
      g.fillStyle = '#9c9c9c'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) {
        const x = R(0, W), y = R(0, H), l = R(8, 28), v = Math.floor(R(110, 255));
        g.strokeStyle = `rgba(${v},${v},${v},${R(0.25, 0.6)})`; g.lineWidth = R(0.6, 1.4);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + R(-3, 3), y - l / 2, x + R(-5, 5), y - l); g.stroke();
      }
    });
    cellDo('sole', (W, H) => { g.fillStyle = '#5d5d5d'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 6) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, W, 2); } speck(W, H, 400, 1, 2.5, true); });
    cellDo('canvas', (W, H) => {
      g.fillStyle = '#dedede'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 3) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x, 0, 1, H); }
      for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, y, W, 1); }
      speck(W, H, 600, 1, 2.5);
    });
    cellDo('glove', (W, H) => { g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, W, H); speck(W, H, 800, 1, 2); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const y = R(0, H); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W / 3, y + R(-10, 10), W * 2 / 3, y + R(-10, 10), W, y); g.stroke(); } });
    // 위장 무늬(스킨용): 반복 가능한 덩어리 무늬
    const camo = (name, cols) => cellDo(name, (W, H) => {
      g.fillStyle = cols[0]; g.fillRect(0, 0, W, H);
      for (let l = 1; l < cols.length; l++) for (let i = 0; i < 24; i++) {
        const x = R(0, W), y = R(0, H), r = R(10, 30); g.fillStyle = cols[l];
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { g.beginPath(); for (let a = 0; a <= 10; a++) { const t = a / 10 * TAU, rr = r * (0.6 + rng() * 0.6); g.lineTo(x + ox + Math.cos(t) * rr * 1.4, y + oy + Math.sin(t) * rr); } g.closePath(); g.fill(); }
      }
      speck(W, H, 500, 1, 2);
    });
    camo('camoW', ['#5b6342', '#434a2f', '#77744d', '#2e2e24']); camo('camoD', ['#b39b72', '#987f58', '#cdb98f', '#7a6446']); camo('camoU', ['#8a8d90', '#6b6e72', '#b4b6b8', '#3e4144']);
    cellDo('gloss', (W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); });
    cellDo('matte', (W, H) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); });
    // ----- 스킨 무늬 (오른쪽 절반) -----
    camo('camoS', ['#dfe3e6', '#b9bfc4', '#f7f8f9', '#8b9298']);   // 설원
    // 디지털 위장: 8px 칸을 이어 붙인 덩어리
    cellDo('camoDig', (W, H) => {
      const P = ['#6b6e4b', '#4a4d33', '#8b8661', '#2e3023'], s = 8;
      g.fillStyle = P[0]; g.fillRect(0, 0, W, H);
      for (let l = 1; l < P.length; l++) for (let i = 0; i < 60; i++) {
        let x = Math.floor(R(0, W / s)), y = Math.floor(R(0, H / s)); const n = 4 + Math.floor(R(0, 10)); g.fillStyle = P[l];
        for (let k = 0; k < n; k++) { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) g.fillRect(x * s + ox, y * s + oy, s, s); x += Math.floor(R(-1, 2)); y += Math.floor(R(-1, 2)); }
      }
      speck(W, H, 400, 1, 2);
    });
    // 타이거 스트라이프: 가로로 긴 붓자국
    cellDo('camoTiger', (W, H) => {
      g.fillStyle = '#7d7a52'; g.fillRect(0, 0, W, H);
      for (const [c, n] of [['#55532f', 16], ['#2b2b21', 22]]) for (let i = 0; i < n; i++) {
        const y = R(0, H), x = R(0, W), L = R(60, 150), th = R(5, 13); g.fillStyle = c;
        for (const ox of [-W, 0, W]) { g.beginPath(); g.moveTo(x + ox, y); for (let k = 0; k <= 12; k++) { const t = k / 12; g.lineTo(x + ox + L * t, y + Math.sin(t * 6 + i) * 4 - th * Math.sin(t * Math.PI) * 0.5); } for (let k = 12; k >= 0; k--) { const t = k / 12; g.lineTo(x + ox + L * t, y + Math.sin(t * 6 + i) * 4 + th * Math.sin(t * Math.PI) * 0.5); } g.closePath(); g.fill(); }
      }
      speck(W, H, 400, 1, 2);
    });
    // 버펄로 체크(빨강·검정) + 가는 실 줄
    cellDo('plaid', (W, H) => {
      g.fillStyle = '#a3262c'; g.fillRect(0, 0, W, H);
      const s = 32; g.fillStyle = 'rgba(12,10,10,0.55)';
      for (let x = 0; x < W; x += s * 2) g.fillRect(x, 0, s, H);
      for (let y = 0; y < H; y += s * 2) g.fillRect(0, y, W, s);
      g.fillStyle = 'rgba(255,255,255,0.06)'; for (let k = 0; k < W; k += 4) g.fillRect(k, 0, 1, H);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 2; k < H; k += 4) g.fillRect(0, k, W, 1);
    });
    // 데님(회색 기준, 정점 색으로 물들임): 사선 능직 + 바랜 얼룩
    cellDo('denim', (W, H) => {
      g.fillStyle = '#d8dce2'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1; for (let k = -H; k < W; k += 3) { g.beginPath(); g.moveTo(k, H); g.lineTo(k + H, 0); g.stroke(); }
      for (let i = 0; i < 26; i++) { const gr = g.createRadialGradient(R(0, W), R(0, H), 0, R(0, W), R(0, H), R(20, 60)); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      speck(W, H, 900, 1, 2, true);
    });
    // 가로 줄무늬(흰색·남색)
    cellDo('stripe', (W, H) => {
      g.fillStyle = '#ecebe6'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1f2b4a'; for (let y = 0; y < H; y += 32) g.fillRect(0, y, W, 13);
      for (let x = 0; x < W; x += 2) { g.fillStyle = x % 4 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'; g.fillRect(x, 0, 1, H); }
    });
    // 금색 광택 천: 결 방향 줄 + 솔기
    cellDo('gold', (W, H) => {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#d9a93e'); gr.addColorStop(0.3, '#8f6418'); gr.addColorStop(0.55, '#e8c25a'); gr.addColorStop(0.8, '#9c6e1c'); gr.addColorStop(1, '#dcae44'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,236,170' : '90,55,10'},${R(0.04, 0.12)})`; g.fillRect(0, R(0, H), W, R(0.5, 1.5)); }
      g.strokeStyle = 'rgba(80,50,10,0.35)'; g.lineWidth = 2; for (let y = 32; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    });
    // 운동화 천: 밝은 캔버스 + 앞쪽 끈(전투화와 같은 자리)
    cellDo('sneak', (W, H) => {
      g.fillStyle = '#e6e6e4'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 3) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x, 0, 1, H); }
      speck(W, H, 500, 1, 2);
      const cx = PAD + 0.25 * (W - PAD * 2), y0 = PAD, y1 = PAD + 0.66 * (H - PAD * 2);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 10, y0, 20, y1 - y0);
      for (let y = y0 + 6; y < y1; y += 14) { g.strokeStyle = 'rgba(250,250,250,0.95)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(cx - 11, y); g.lineTo(cx + 11, y + 7); g.moveTo(cx + 11, y); g.lineTo(cx - 11, y + 7); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(0, PAD + 0.8 * (H - PAD * 2)); g.lineTo(W, PAD + 0.8 * (H - PAD * 2)); g.stroke(); g.setLineDash([]);
    });
    // 플리스(털 깃): 짧고 굵은 털
    cellDo('fleece', (W, H) => {
      g.fillStyle = '#d2d0cc'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 3000; i++) { const x = R(0, W), y = R(0, H), v = Math.floor(R(150, 255)); g.fillStyle = `rgba(${v},${v},${v},${R(0.2, 0.5)})`; g.beginPath(); g.arc(x, y, R(1, 2.6), 0, TAU); g.fill(); }
    });
    // 빛나는 셀: 어두운 바탕 + 선. 같은 선을 발광 지도에도 그린다 (셀마다 고정 시드)
    const ec = document.createElement('canvas'); ec.width = ATW / 2; ec.height = ATH / 2;
    const eg = ec.getContext('2d'); eg.fillStyle = '#000'; eg.fillRect(0, 0, ec.width, ec.height);
    const glowDo = (name, base, lineCol, glowCol, paths) => {
      cellDo(name, (W, H) => { g.fillStyle = base; g.fillRect(0, 0, W, H); speck(W, H, 300, 1, 2, true); paths(g, W, H, lineCol, 2.6, mulberry32(name.length * 131)); });
      const c = CELL[name]; eg.save(); eg.beginPath(); eg.rect(c[0] / 2, c[1] / 2, c[2] / 2, c[3] / 2); eg.clip(); eg.translate(c[0] / 2, c[1] / 2); eg.scale(0.5, 0.5);
      paths(eg, c[2], c[3], glowCol, 3.4, mulberry32(name.length * 131)); eg.restore();
    };
    // 회로선(직각으로 꺾이는 선 + 끝 점)
    const circuit = (x, W, H, col, lw, rr) => {
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = lw; x.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        let px = Math.round(rr() * 16) * 16, py = Math.round(rr() * 16) * 16; x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 4; k++) { if (rr() < 0.5) px += (rr() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rr() * 3)); else py += (rr() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rr() * 3)); x.lineTo(px, py); }
        x.stroke(); x.beginPath(); x.arc(px, py, lw * 1.4, 0, TAU); x.fill();
      }
      for (let y = 24; y < H; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    };
    // 육각 격자 판
    const hexes = (x, W, H, col, lw) => {
      x.strokeStyle = col; x.lineWidth = lw; const r = 16, dx = r * Math.sqrt(3);
      for (let row = -1; row * r * 1.5 < H + r; row++) for (let i = -1; i * dx < W + dx; i++) {
        const cx = i * dx + (row % 2 ? dx / 2 : 0), cy = row * r * 1.5; x.beginPath();
        for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.stroke();
      }
    };
    // 물결선
    const waves = (x, W, H, col, lw) => { x.strokeStyle = col; x.lineWidth = lw; for (let y = 16; y < H; y += 32) { x.beginPath(); for (let k = 0; k <= W; k += 4) x.lineTo(k, y + Math.sin(k / W * TAU * 2) * 7); x.stroke(); } };
    glowDo('glowC', '#16191d', '#3a434b', '#46f2ff', circuit);
    glowDo('glowO', '#2a2e33', '#4a5158', '#ff8a1e', hexes);
    glowDo('glowP', '#1b151a', '#43343f', '#ff4fd0', waves);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    EMI = new THREE.CanvasTexture(ec);
    return t;
  }
  function roughMap() {
    const NX = ATW / 128, NY = ATH / 128, data = new Uint8Array(NX * NY * 4).fill(255);
    for (const k in CELL) {
      const c = CELL[k], v = Math.round((ROUGH[k] || 0.85) * 255);
      for (let y = c[1] / 128; y < (c[1] + c[3]) / 128; y++) for (let x = c[0] / 128; x < (c[0] + c[2]) / 128; x++) {
        const row = NY - 1 - y, i = (row * NX + x) * 4; data[i] = data[i + 1] = data[i + 2] = v;
      }
    }
    const t = new THREE.DataTexture(data, NX, NY, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }
  function material() {
    if (MAT) return MAT;
    ATLAS = paintAtlas();
    const env = Models.env;
    MAT = new THREE.MeshStandardMaterial({ map: ATLAS, roughnessMap: roughMap(), roughness: 1, metalness: 0, vertexColors: true, envMap: env || null, envMapIntensity: 0.3,
      emissive: 0xffffff, emissiveMap: EMI });
    MAT.skinning = true;
    return MAT;
  }
  // 모자처럼 머리 뼈에 붙는 단단한 부품: 같은 아틀라스, 스키닝 없음
  function rigidMaterial() {
    if (RIGIDMAT) return RIGIDMAT;
    RIGIDMAT = material().clone(); RIGIDMAT.skinning = false;
    return RIGIDMAT;
  }

  // ---------- 지오메트리 빌더 ----------
  class GB {
    constructor(lod) { this.lod = lod; this.P = []; this.C = []; this.U = []; this.SI = []; this.SW = []; this.I = []; this.seam = []; }
    get n() { return this.P.length / 3; }
    vert(x, y, z, col, u, v, W) {
      this.P.push(x, y, z); this.C.push(col[0], col[1], col[2]); this.U.push(u, v);
      W.sort((a, b) => b[1] - a[1]); let t = 0; const n = Math.min(4, W.length); for (let i = 0; i < n; i++) t += W[i][1];
      for (let i = 0; i < 4; i++) { const w = i < n ? W[i] : null; this.SI.push(w ? w[0] : 0); this.SW.push(w && t > 0 ? w[1] / t : 0); }
      return this.n - 1;
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
      g.setIndex(this.I); g.computeVertexNormals();
      const N = g.attributes.normal;
      for (const [a, b] of this.seam) { const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); }
      // 자세에 따라 몸이 뼈대 밖으로 나가므로(엎드림·구르기) 넉넉한 경계구
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 2.2);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-2.2, -1.3, -2.2), new THREE.Vector3(2.2, 3.1, 2.2));
      return g;
    }
  }
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  const CAPF = [1, 0.94, 0.8, 0.6, 0.35];   // 둥근 끝: 축 방향 위치(반지름 비) — 반지름 = √(1-f²)
  const spow = (x, p) => (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), p);
  const hexc = (h, k = 1) => [((h >> 16) & 255) / 255 * k, ((h >> 8) & 255) / 255 * k, (h & 255) / 255 * k];
  // 렌더러가 감마 보정 없는 선형 출력이므로(다른 모델과 같게) 색 값을 그대로 쓴다
  const col = (h, k = 1) => hexc(h, k);
  // 단면 보간 (Catmull-Rom). prof: [[s, rx, zf, zb, ox, oz], ...]
  function profAt(prof, s, out) {
    let i = 0; while (i < prof.length - 2 && s > prof[i + 1][0]) i++;
    const a = prof[i], b = prof[i + 1], t = clamp((s - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
    const p0 = prof[Math.max(0, i - 1)], p3 = prof[Math.min(prof.length - 1, i + 2)], t2 = t * t, t3 = t2 * t;
    for (let k = 1; k < 6; k++) {
      const y0 = p0[k] || 0, y1 = a[k] || 0, y2 = b[k] || 0, y3 = p3[k] || 0;
      out[k - 1] = 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
    }
    out[0] = Math.max(0, out[0]); out[1] = Math.max(0, out[1]); out[2] = Math.max(0, out[2]);
    return out;
  }
  const addR = (prof, d, dz = 0) => prof.map((r) => [r[0], r[1] + d, r[2] + d + dz, r[3] + d, r[4] || 0, r[5] || 0]);
  // 관(tube): 로컬 축(dir=+1: +y, -1: -y)을 따라 초타원 단면 링을 쌓는다
  //  o: { mat, dir, seg, step, ex, col(s,x,z)|[r,g,b], cell, v0, v1, W(s,x,z), hem0, hem1(접힌 두께), cap0, cap1(둥근 끝 길이), ao(s,x,z)→배수 }
  function tube(B, prof, o) {
    const seg = o.seg, ex = o.ex || 2, s0 = prof[0][0], s1 = prof[prof.length - 1][0], L = (s1 - s0) || 1, dir = o.dir || -1;
    const rings = [], n = Math.max(1, Math.ceil((s1 - s0) / o.step));
    const R0 = profAt(prof, s0, [0, 0, 0, 0, 0]), R1 = profAt(prof, s1, [0, 0, 0, 0, 0]);
    if (o.cap0) for (const f of CAPF) rings.push([s0 - o.cap0 * f, R0, Math.sqrt(Math.max(0, 1 - f * f)) || 0.02]);
    if (o.hem0) rings.push([s0 + o.hem0, R0, 0.9], [s0 - 0.002, R0, 0.97]);
    for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n; rings.push([s, profAt(prof, s, [0, 0, 0, 0, 0]), 1]); }
    if (o.hem1) rings.push([s1 + 0.002, R1, 0.97], [s1 - o.hem1, R1, 0.9]);
    if (o.cap1) for (let i = CAPF.length - 1; i >= 0; i--) { const f = CAPF[i]; rings.push([s1 + o.cap1 * f, R1, Math.sqrt(Math.max(0, 1 - f * f)) || 0.02]); }
    const base = B.n, colF = typeof o.col === 'function' ? o.col : null, ph = o.u0 || 0;
    for (const [s, R, k] of rings) {
      for (let j = 0; j <= seg; j++) {
        const th = j / seg * TAU + ph, c = Math.cos(th), sn = Math.sin(th);
        const x = R[3] + R[0] * k * spow(c, 2 / ex), z = R[4] + (sn >= 0 ? R[1] : R[2]) * k * spow(sn, 2 / ex);
        _v.set(x, dir * s, z); if (o.mat) _v.applyMatrix4(o.mat);
        let cc = colF ? colF(s, x, z) : o.col;
        if (o.ao) { const a = o.ao(s, x, z); if (a !== 1) cc = [cc[0] * a, cc[1] * a, cc[2] * a]; }
        const uv = cellUV(o.cell, j / seg, lerp(o.v0 || 0, o.v1 === undefined ? 1 : o.v1, clamp((s - s0) / L, 0, 1)));
        B.vert(_v.x, _v.y, _v.z, cc, uv[0], uv[1], o.W(s, x, z));
      }
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j, b = a + seg + 1, c = b + 1, d = a + 1;
      if (dir > 0) B.I.push(a, b, d, b, c, d); else B.I.push(a, d, b, d, c, b);
    }
    for (let i = 0; i < rings.length; i++) B.seam.push([base + i * (seg + 1), base + i * (seg + 1) + seg]);
  }
  // 타원체 (위경도 격자). fn(ux,uy,uz) → 정점 색, 위치는 로컬(cx,cy,cz 중심, 회전 rot) → mat
  const _m4 = new THREE.Matrix4(), _e = new THREE.Euler();
  function ellipsoid(B, o) {
    const ws = o.ws, hs = o.hs, base = B.n, b0 = o.lat0 === undefined ? -Math.PI / 2 : o.lat0;
    _m4.makeRotationFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
    for (let i = 0; i <= hs; i++) {
      const b = b0 + (Math.PI / 2 - b0) * i / hs, cb = Math.cos(b), sb = Math.sin(b);
      for (let j = 0; j <= ws; j++) {
        const a = j / ws * TAU, ux = Math.sin(a) * cb, uz = Math.cos(a) * cb;
        _v.set(ux * o.r[0], sb * o.r[1], uz * o.r[2]).applyMatrix4(_m4).add(_w.set(o.c[0], o.c[1], o.c[2]));
        if (o.mat) _v.applyMatrix4(o.mat);
        const uv = cellUV(o.cell, j / ws, i / hs);
        B.vert(_v.x, _v.y, _v.z, typeof o.col === 'function' ? o.col(ux, sb, uz) : o.col, uv[0], uv[1], o.W.slice ? o.W.slice() : o.W(ux, sb, uz));
      }
    }
    for (let i = 0; i < hs; i++) for (let j = 0; j < ws; j++) { const a = base + i * (ws + 1) + j, b = a + ws + 1; B.I.push(a, d0(a), b, d0(a), b + 1, b); }
    for (let i = 0; i <= hs; i++) B.seam.push([base + i * (ws + 1), base + i * (ws + 1) + ws]);
  }
  const d0 = (a) => a + 1;
  // 둥근 상자(작은 관 + 양끝 막음): 주머니·패치·버클
  function rbox(B, o) {
    const h = o.h / 2;
    tube(B, [[o.c[1] - h, o.w / 2, o.d / 2, o.d / 2, o.c[0], o.c[2]], [o.c[1] + h, o.w / 2, o.d / 2, o.d / 2, o.c[0], o.c[2]]],
      { mat: o.mat, dir: 1, seg: o.seg || 8, step: o.h, ex: o.ex || 5, col: o.col, cell: o.cell, W: o.W, cap0: Math.min(o.w, o.d) * 0.35, cap1: Math.min(o.w, o.d) * 0.35, v0: o.v0, v1: o.v1 });
  }
  // 관절 사슬 가중치: ch = [[시작 s, 뼈, 섞는 반폭], ...]
  function chainW(s, ch) {
    const out = [];
    for (let i = 0; i < ch.length; i++) {
      const lo = ch[i][0], hi = i < ch.length - 1 ? ch[i + 1][0] : 1e9, hl = ch[i][2] || 0.03, hh = i < ch.length - 1 ? (ch[i + 1][2] || 0.03) : 0;
      const w = (i === 0 ? 1 : sstep(lo - hl, lo + hl, s)) * (i === ch.length - 1 ? 1 : 1 - sstep(hi - hh, hi + hh, s));
      if (w > 1e-3) out.push([BI[ch[i][1]], w]);
    }
    return out;
  }
  const one = (name) => () => [[BI[name], 1]];
  const gauss = (x, s) => Math.exp(-(x * x) / (s * s));

  // ---------- 기본 몸 치수 (프로필) ----------
  // 몸통: [y, 가로 반폭, 앞, 뒤, 0, 앞뒤 치우침]
  const TORSO = [
    [0.95, 0.170, 0.100, 0.126, 0, 0], [1.00, 0.165, 0.100, 0.116, 0, 0], [1.05, 0.156, 0.100, 0.100, 0, 0],
    [1.12, 0.150, 0.106, 0.093, 0, 0], [1.20, 0.157, 0.114, 0.095, 0, 0], [1.27, 0.167, 0.124, 0.099, 0, 0],
    [1.34, 0.175, 0.128, 0.103, 0, 0], [1.40, 0.181, 0.118, 0.104, 0, -0.004], [1.445, 0.184, 0.098, 0.096, 0, -0.008],
    [1.48, 0.148, 0.076, 0.080, 0, -0.012], [1.51, 0.094, 0.063, 0.066, 0, -0.014], [1.535, 0.068, 0.058, 0.060, 0, -0.012],
  ];
  const PELVIS = [[0.875, 0.10, 0.05, 0.07, 0, -0.01], [0.90, 0.145, 0.075, 0.1, 0, -0.004], [0.935, 0.164, 0.093, 0.114, 0, 0], [0.98, 0.163, 0.098, 0.112, 0, 0], [1.045, 0.156, 0.099, 0.101, 0, 0]];
  // 팔(위팔 뼈 로컬, 축 -y): [s, 가로, 앞, 뒤, 바깥쪽 치우침, 앞뒤]
  const ARM = [[-0.06, 0.048, 0.050, 0.050, 0.004, 0], [0.0, 0.053, 0.057, 0.055, 0.005, 0], [0.06, 0.050, 0.054, 0.053, 0.003, 0], [0.13, 0.044, 0.050, 0.045, 0, 0.002],
    [0.21, 0.040, 0.044, 0.041, 0, 0], [0.28, 0.036, 0.037, 0.039, 0, -0.002], [0.33, 0.039, 0.041, 0.040, 0, 0], [0.40, 0.035, 0.037, 0.035, 0, 0],
    [0.47, 0.029, 0.033, 0.031, 0, 0], [0.53, 0.021, 0.030, 0.028, 0, 0], [0.565, 0.020, 0.029, 0.027, 0, 0]];
  // 다리(허벅지 뼈 로컬, 축 -y)
  const LEG = [[-0.08, 0.08, 0.084, 0.088, 0, 0], [0.0, 0.085, 0.087, 0.092, 0.002, 0], [0.10, 0.083, 0.081, 0.083, 0.003, 0], [0.22, 0.077, 0.075, 0.073, 0.002, 0],
    [0.33, 0.066, 0.065, 0.061, 0, 0], [0.40, 0.059, 0.063, 0.055, 0, 0.003], [0.45, 0.057, 0.057, 0.059, 0, 0], [0.53, 0.059, 0.053, 0.071, 0, -0.004],
    [0.64, 0.051, 0.047, 0.057, 0, -0.002], [0.74, 0.043, 0.043, 0.045, 0, 0], [0.80, 0.041, 0.042, 0.043, 0, 0]];
  const NECK = [[1.42, 0.068, 0.064, 0.062, 0, -0.014], [1.50, 0.061, 0.058, 0.057, 0, -0.014], [1.55, 0.057, 0.055, 0.053, 0, -0.012], [1.63, 0.053, 0.05, 0.05, 0, -0.01]];

  // ---------- 머리 ----------
  // 단위구 방향(ux,uy,uz) → 머리 뼈 로컬 좌표. 두개골 타원체 + 턱 좁힘 + 이마·눈두덩·광대·턱 끝
  const HC = [0, 0.072, 0.0];
  function headPoint(ux, uy, uz, out, puff = 0) {
    let X = ux * 0.0715, Y = uy * (uy > 0 ? 0.121 : 0.117), Z = uz * (uz > 0 ? 0.097 : 0.093);
    if (uy < 0) {
      const t = -uy, fr = Math.max(0, uz);
      X *= (1 + 0.1 * sstep(0.12, 0.5, t) * (1 - sstep(0.62, 0.98, t))) * (1 - 0.2 * Math.pow(t, 2) * (0.5 + 0.5 * fr));
      if (uz < 0) Z *= 1 - 0.5 * Math.pow(t, 1.2); else Z *= 1 - 0.1 * t;
    }
    if (uz > 0.25) { const k = (uz - 0.25) / 0.75; Z -= 0.011 * k * k * (1 - 0.6 * Math.max(0, uy)); }
    if (uz > 0) {
      Z += 0.0065 * gauss(uy - 0.33, 0.07) * gauss(ux, 0.42) * uz;                        // 눈썹뼈
      Z -= 0.0095 * (gauss(ux - 0.33, 0.15) + gauss(ux + 0.33, 0.15)) * gauss(uy - 0.21, 0.1) * uz; // 눈구멍
      Z += 0.004 * (gauss(ux - 0.52, 0.17) + gauss(ux + 0.52, 0.17)) * gauss(uy - 0.06, 0.12);     // 광대
      Z += 0.004 * gauss(ux, 0.22) * gauss(uy + 0.64, 0.12) * uz;                         // 턱 끝
      Z -= 0.0025 * gauss(ux, 0.24) * gauss(uy + 0.355, 0.045) * uz;                      // 입술 선
      Z += 0.0028 * gauss(ux, 0.2) * gauss(uy + 0.3, 0.06) * uz;                          // 윗입술
    }
    const k = 1 + puff;
    return out.set(HC[0] + X * k, HC[1] + Y * k, HC[2] + Z * k);
  }
  // 머리카락 경계(단위구 y): 방위각 a(0 = 정면, +는 왼쪽)
  const HAIRLINE = (a) => { const t = Math.abs(a); return t < 0.95 ? 0.5 + 0.03 * sstep(0.25, 0.6, t) - 0.17 * sstep(0.62, 0.95, t) : t < 1.62 ? lerp(0.36, -0.02, sstep(0.98, 1.42, t)) + 0.06 * sstep(1.45, 1.62, t) : lerp(0.04, -0.42, sstep(1.62, 2.7, t)); };
  const HAIR_STYLES = { buzz: { th: 0.0035 }, short: { th: 0.010 }, crew: { th: 0.016, top: 0.006 }, none: null };
  function buildHead(B, look, lod) {
    const M = bindPose().M.head, skin = col(look.tone), lo = lod > 0;
    const LON = lo ? 14 : 34, LAT = lo ? 10 : 26, base = B.n;
    const stub = look.beard === 'stubble' ? 1 : 0;
    const mq = !!look.mannequin;
    // 피부 (얼굴 그림 셀, 원통 투영)
    for (let i = 0; i <= LAT; i++) {
      const b = -Math.PI / 2 + Math.PI * i / LAT, cb = Math.cos(b), sb = Math.sin(b);
      for (let j = 0; j <= LON; j++) {
        const a = -Math.PI + j / LON * TAU, ux = Math.sin(a) * cb, uz = Math.cos(a) * cb;
        headPoint(ux, sb, uz, _v); _v.applyMatrix4(M);
        let c = skin;
        if (stub) { const k = sstep(-0.05, -0.3, sb) * sstep(-0.35, 0.1, uz) * (1 - 0.7 * gauss(ux, 0.2) * gauss(sb + 0.36, 0.08)); if (k > 0) { const m = 1 - 0.3 * k; c = [c[0] * m * 0.95, c[1] * m * 0.97, c[2] * m]; } }
        const uv = mq ? cellUV('skin', j / LON, i / LAT) : cellUV('face', faceU(a), faceV(sb));
        // 목 쪽 아랫면은 목과 섞는다
        const wn = sb < -0.6 && uz < 0.4 ? sstep(-0.6, -0.95, sb) * 0.5 : 0;
        B.vert(_v.x, _v.y, _v.z, c, uv[0], uv[1], wn > 0 ? [[BI.head, 1 - wn], [BI.neck, wn]] : [[BI.head, 1]]);
      }
    }
    for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) { const a = base + i * (LON + 1) + j, b2 = a + LON + 1; B.I.push(a, a + 1, b2, a + 1, b2 + 1, b2); }
    for (let i = 0; i <= LAT; i++) B.seam.push([base + i * (LON + 1), base + i * (LON + 1) + LON]);
    const W = [[BI.head, 1]];
    if (!lo && !mq) {
      // 눈알: 흰자 + 홍채 + 동공 (반짝이는 셀)
      const iris = col(look.eye || 0x4a3524), white = col(0xe4ddd4), pupil = col(0x0b0908);
      for (const s of [1, -1]) {
        const ux = s * 0.33, uy = 0.215, uz = Math.sqrt(1 - ux * ux - uy * uy);
        headPoint(ux, uy, uz, _w); const dx = _w.x - HC[0], dy = _w.y - HC[1], dz = _w.z - HC[2], dl = Math.hypot(dx, dy, dz);
        const c = [_w.x - dx / dl * 0.0062, _w.y - dy / dl * 0.0062, _w.z - dz / dl * 0.0062];
        ellipsoid(B, { mat: M, c, r: [0.0136, 0.0086, 0.0112], ry: s * 0.18, ws: 12, hs: 8, cell: 'gloss', W, col: (x, y, z) => (z > 0.955 ? pupil : z > 0.8 ? iris : white) });
        ellipsoid(B, { mat: M, c: [c[0], c[1] + 0.0006, c[2] + 0.0004], r: [0.0146, 0.0098, 0.0122], ry: s * 0.18, rx: -0.12, lat0: 0.32, ws: 12, hs: 4, cell: 'skin', W, col: col(look.tone, 0.86) });
      }
      // 코: 콧대 + 코끝 + 콧볼
      const nc = col(look.tone, 0.98).map((x, i) => x * (i === 0 ? 1.02 : 0.98));
      headPoint(0, 0.2, 0.98, _w);
      const Mn = M.clone().multiply(_m4.makeTranslation(_w.x, _w.y, _w.z - 0.006)).multiply(new THREE.Matrix4().makeRotationX(-0.4));
      tube(B, [[0, 0.0052, 0.002, 0.006], [0.014, 0.0062, 0.0068, 0.008], [0.028, 0.0088, 0.0112, 0.01], [0.041, 0.0108, 0.0132, 0.011]], { mat: Mn, dir: -1, seg: 10, step: 0.007, ex: 1.9, col: nc, cell: 'skin', cap1: 0.008, W: () => [[BI.head, 1]] });
      _v.set(0, -0.046, 0.004).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.4)); const tx = _w.x, ty = _w.y + _v.y, tz = _w.z - 0.006 + _v.z;
      ellipsoid(B, { mat: M, c: [0, ty - 0.002, tz - 0.004], r: [0.0135, 0.0062, 0.0085], ws: 10, hs: 6, cell: 'skin', W, col: nc });
      // 귀
      for (const s of [1, -1]) {
        ellipsoid(B, { mat: M, c: [s * 0.0725, 0.082, -0.01], r: [0.0085, 0.029, 0.018], ry: s * -0.35, rz: s * 0.12, ws: 10, hs: 8, cell: 'skin', W, col: col(look.tone, 0.95) });
        ellipsoid(B, { mat: M, c: [s * 0.0765, 0.084, -0.012], r: [0.004, 0.02, 0.011], ry: s * -0.35, rz: s * 0.12, ws: 6, hs: 5, cell: 'skin', W, col: col(look.tone, 0.72) });
      }
    }
    // 머리카락
    const HS = HAIR_STYLES[look.hair];
    if (HS && !look.noHair) {
      const hc = col(look.hairColor || 0x2a2019), AN = lo ? 14 : 32, RN = lo ? 5 : 10, hb = B.n;
      for (let i = 0; i <= RN; i++) for (let j = 0; j <= AN; j++) {
        const a = -Math.PI + j / AN * TAU, line = HAIRLINE(a), t = i / RN;   // t: 0 = 정수리, 1 = 경계
        const uy = lerp(1, line, Math.pow(t, 0.9)), cb = Math.sqrt(Math.max(0, 1 - uy * uy)), ux = Math.sin(a) * cb, uz = Math.cos(a) * cb;
        const side = 1 - 0.45 * sstep(0.35, 0.8, Math.abs(Math.sin(a))) * sstep(0.3, 0.9, t);
        const th = Math.max(0.0016, HS.th * side * (1 - sstep(0.75, 1, t) * 0.85) + (HS.top || 0) * (1 - t) * (1 - t));
        headPoint(ux, uy, uz, _v); const dx = _v.x - HC[0], dy = _v.y - HC[1], dz = _v.z - HC[2], dl = Math.hypot(dx, dy, dz);
        _v.set(_v.x + dx / dl * th, _v.y + dy / dl * th, _v.z + dz / dl * th).applyMatrix4(M);
        const uv = cellUV('hair', j / AN, 1 - t), k = 0.8 + 0.2 * (1 - t);
        B.vert(_v.x, _v.y, _v.z, [hc[0] * k, hc[1] * k, hc[2] * k], uv[0], uv[1], [[BI.head, 1]]);
      }
      for (let i = 0; i < RN; i++) for (let j = 0; j < AN; j++) { const a = hb + i * (AN + 1) + j, b2 = a + AN + 1; B.I.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
      for (let i = 0; i <= RN; i++) B.seam.push([hb + i * (AN + 1), hb + i * (AN + 1) + AN]);
    }
    // 수염(턱수염): 얼굴 아래쪽을 덮는 얇은 껍질
    if (look.beard === 'beard' && !lo) {
      const hc = col(look.hairColor || 0x2a2019, 0.9), AN = 22, RN = 7, hb = B.n;
      for (let i = 0; i <= RN; i++) for (let j = 0; j <= AN; j++) {
        const a = lerp(-1.75, 1.75, j / AN), t = i / RN, uy = lerp(-0.12 - 0.12 * gauss(a, 0.5), -0.98, t), cb = Math.sqrt(Math.max(0, 1 - uy * uy));
        const ux = Math.sin(a) * cb, uz = Math.cos(a) * cb, mouth = gauss(ux, 0.22) * gauss(uy + 0.36, 0.07);
        const th = 0.006 * (1 - mouth) * sstep(0, 0.2, t) * (1 - sstep(0.85, 1, t)) + 0.0012;
        headPoint(ux, uy, uz, _v); const dx = _v.x - HC[0], dy = _v.y - HC[1], dz = _v.z - HC[2], dl = Math.hypot(dx, dy, dz);
        _v.set(_v.x + dx / dl * th, _v.y + dy / dl * th, _v.z + dz / dl * th).applyMatrix4(M);
        const uv = cellUV('hair', j / AN, t);
        B.vert(_v.x, _v.y, _v.z, mouth > 0.5 ? col(look.tone) : hc, uv[0], uv[1], [[BI.head, 1]]);
      }
      for (let i = 0; i < RN; i++) for (let j = 0; j < AN; j++) { const a = hb + i * (AN + 1) + j, b2 = a + AN + 1; B.I.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
    }
  }
  // 목 (피부)
  function buildNeck(B, look, lod) {
    tube(B, NECK, { dir: 1, seg: lod ? 8 : 16, step: lod ? 0.08 : 0.03, cell: 'skin', col: col(look.tone, 0.97),
      ao: (s, x, z) => 1 - 0.22 * sstep(1.55, 1.62, s) * sstep(-0.02, 0.04, z),
      W: (s) => chainW(s, [[0, 'chest'], [1.49, 'neck', 0.04], [1.6, 'head', 0.03]]) });
  }
  // 손(피부 또는 장갑): 손바닥 + 손가락 4 + 엄지
  // 장갑: kind 'tac'(전술 — 손등 보호대), 'full'(민무늬), 'fingerless'(손가락 끝이 나온 반장갑)
  function buildHands(B, look, lod) {
    const M = bindPose().M, gl = look.gloves && SKINS[look.gloves], skin = col(look.tone);
    const c = gl ? col(gl.color) : skin, cell = gl ? (gl.cell || 'glove') : 'skin', lo = lod > 0, half = gl && gl.kind === 'fingerless';
    // 반장갑의 손가락: 첫 마디 일부만 장갑, 나머지는 피부(피부 질감)
    const fc = half ? (q) => (q < 0.016 ? c : skin) : c, fcell = half ? 'skin' : cell;
    for (const [s, k] of SIDES) {
      const H = M['hand' + k], palmW = (q) => lo ? chainW(q, [[0, 'el' + k], [0, 'hand' + k, 0.015], [0.1, 'fin1' + k, 0.02]]) : chainW(q, [[0, 'el' + k], [0, 'hand' + k, 0.015]]);
      tube(B, [[-0.02, 0.018, 0.025, 0.025, 0, 0], [0.01, 0.0185, 0.033, 0.031, -s * 0.001, 0.002], [0.04, 0.017, 0.039, 0.037, -s * 0.002, 0.003], [0.07, 0.0152, 0.041, 0.039, -s * 0.001, 0.002], [lo ? 0.15 : 0.094, lo ? 0.011 : 0.0135, 0.04, 0.038, 0, 0]],
        { mat: H, dir: -1, seg: lo ? 8 : 12, step: lo ? 0.06 : 0.016, ex: 2.6, col: c, cell, cap1: lo ? 0.02 : 0.008, W: palmW });
      if (lo) { tube(B, [[-0.01, 0.01, 0.011, 0.011], [0.06, 0.008, 0.009, 0.009]], { mat: M['thumb1' + k], dir: -1, seg: 6, step: 0.07, col: half ? skin : c, cell: fcell, cap1: 0.008, W: one('thumb1' + k) }); continue; }
      const fing = (bone, bone2, dz, len, r, s0) => tube(B, [[s0, r * 1.05, r * 1.08, r * 1.08, 0, dz], [0.022, r, r * 1.02, r * 1.02, 0, dz], [0.044, r * 0.93, r * 0.95, r * 0.95, 0, dz], [len * 0.8, r * 0.85, r * 0.86, r * 0.86, -s * 0.0006, dz], [len, r * 0.75, r * 0.78, r * 0.78, -s * 0.001, dz]],
        { mat: M[bone], dir: -1, seg: 6, step: 0.016, col: fc, cell: fcell, cap1: r * 0.9, ao: (q) => 1 - 0.12 * sstep(0.01, -0.01, q), W: (q) => chainW(q, [[0, bone], [0.044, bone2, 0.008]]) });
      fing('idx1' + k, 'idx2' + k, 0, 0.082, 0.0091, -0.008);
      fing('fin1' + k, 'fin2' + k, 0.016, 0.088, 0.0094, -0.008);
      fing('fin1' + k, 'fin2' + k, -0.004, 0.083, 0.0089, -0.006);
      fing('fin1' + k, 'fin2' + k, -0.0225, 0.067, 0.0079, 0.0);
      tube(B, [[-0.016, 0.0125, 0.0135, 0.0135], [0.02, 0.0118, 0.0122, 0.0122], [0.04, 0.0105, 0.0108, 0.0108], [0.066, 0.0088, 0.0092, 0.0092]],
        { mat: M['thumb1' + k], dir: -1, seg: 8, step: 0.012, col: fc, cell: fcell, cap1: 0.008, W: (q) => chainW(q, [[0, 'thumb1' + k], [0.037, 'thumb2' + k, 0.008]]) });
      if (gl) {
        // 손목 조임 단 + (전술) 손등 보호대
        tube(B, [[-0.048, 0.024, 0.031, 0.031, 0, 0], [-0.008, 0.0225, 0.032, 0.031, 0, 0.001]], { mat: H, dir: -1, seg: 12, step: 0.04, ex: 2.4, col: col(gl.cuff !== undefined ? gl.cuff : gl.color, gl.cuff !== undefined ? 1 : 0.78), cell: 'glove', hem0: 0.003, W: palmW });
        if (gl.kind === 'tac') rbox(B, { mat: H, c: [s * 0.021, -0.082, 0.0], w: 0.01, h: 0.03, d: 0.064, ex: 3, col: col(gl.pad !== undefined ? gl.pad : 0x2a2a2a), cell: 'glove', W: one('hand' + k), seg: 8 });
      }
    }
  }
  // 팔 피부: from부터 손목까지 (반팔이면 소매 아래부터)
  function buildArmsSkin(B, look, lod, from) {
    const M = bindPose().M;
    for (const [s, k] of SIDES) {
      const prof = ARM.filter((r) => r[0] >= (from <= 0 ? 0 : from - 0.07)).map((r) => [r[0], r[1], r[2], r[3], s * (r[4] || 0), r[5] || 0]);
      tube(B, prof, { mat: M['sh' + k], dir: -1, seg: lod ? 8 : 13, step: lod ? 0.09 : 0.028, cell: 'skin', col: col(look.tone, 0.98), cap0: from <= 0 ? 0.055 : 0,
        W: (q) => chainW(q, [[0, 'sh' + k], [LEN.upper, 'el' + k, 0.035], [LEN.upper + LEN.fore, 'hand' + k, 0.02]]) });
    }
  }
  // ---------- 옷 생성기 ----------
  // 몸통 가중치: 골반→허리→가슴→목 + 어깨 위쪽은 쇄골·위팔, 엉덩이 아래쪽은 허벅지
  function torsoW(y, x) {
    const W = chainW(y, [[0, 'hips'], [1.05, 'spine', 0.06], [1.24, 'chest', 0.06], [1.515, 'neck', 0.025]]);
    const ax = Math.abs(x), k = x > 0 ? 'L' : 'R';
    const f = sstep(0.11, 0.185, ax) * sstep(1.33, 1.44, y);
    if (f > 0) { for (const w of W) w[1] *= 1 - 0.75 * f; W.push([BI['clav' + k], 0.5 * f], [BI['sh' + k], 0.25 * f]); }
    const g = sstep(0.975, 0.86, y) * sstep(0.02, 0.1, ax);
    if (g > 0) { for (const w of W) w[1] *= 1 - 0.45 * g; W.push([BI['hip' + k], 0.45 * g]); }
    return W;
  }
  const torsoAO = (y, x, z) => {
    const ax = Math.abs(x);
    return 1 - 0.2 * sstep(0.12, 0.175, ax) * gauss(y - 1.37, 0.05) * (1 - Math.abs(z) / 0.12) - 0.12 * gauss(y - 1.52, 0.02);
  };
  // 상의 공통 부품 ----------------------------------------------------------
  // 바지 속으로 넣어 입은 몸통(티셔츠·셔츠): 허리띠 위에서 살짝 부풀어 오름. colF(y, x, z) → 정점 색
  function tuckedTorso(B, it, lod, c, cell, colF) {
    const lo = lod > 0;
    const T = [[1.0, 0.148, 0.09, 0.094, 0, 0], [1.04, 0.15, 0.094, 0.096, 0, 0], [1.068, 0.166, 0.111, 0.11, 0, 0]].concat(addR(TORSO, 0.007).filter((r) => r[0] >= 1.12 && r[0] <= 1.52));
    tube(B, T, { dir: 1, seg: lo ? 12 : 22, step: lo ? 0.07 : 0.02, ex: 2.15, col: colF || c, cell, ao: torsoAO, W: (y, x) => torsoW(y, x) });
  }
  // 밖으로 내어 입은 몸통(후드·재킷): 허리띠를 덮고 골반까지. d: 품(여유)
  function looseTorso(B, it, lod, c, cell, colF, d = 0) {
    const lo = lod > 0;
    const T = [[0.905, 0.183 + d, 0.124 + d, 0.134 + d, 0, 0], [0.95, 0.189 + d, 0.13 + d, 0.137 + d, 0, 0], [1.0, 0.192 + d, 0.134 + d, 0.137 + d, 0, 0],
      [1.06, 0.186 + d, 0.132 + d, 0.13 + d, 0, 0], [1.13, 0.178 + d, 0.13 + d, 0.121 + d, 0, 0]].concat(addR(TORSO, 0.018 + d).filter((r) => r[0] >= 1.2 && r[0] <= 1.52));
    tube(B, T, { dir: 1, seg: lo ? 12 : 24, step: lo ? 0.08 : 0.022, ex: 2.12, col: colF || c, cell, ao: torsoAO, W: (y, x) => torsoW(y, x) });
    // 아래단(립·밴드): 조금 조이고 어둡게
    if (!lo) tube(B, [[0.9, 0.181 + d, 0.122 + d, 0.132 + d, 0, 0], [0.935, 0.186 + d, 0.127 + d, 0.135 + d, 0, 0]],
      { dir: 1, seg: 24, step: 0.04, ex: 2.12, col: it.hem !== undefined ? col(it.hem) : col(it.color, 0.82), cell: it.hemCell || 'knit', hem0: 0.006, W: (y, x) => torsoW(y, x) });
  }
  // 둥근 목 립(티셔츠·후드 공통)
  function neckRib(B, c, r = 0) {
    tube(B, [[1.5, 0.084 + r, 0.072 + r, 0.076 + r, 0, -0.014], [1.525, 0.072 + r, 0.064 + r, 0.068 + r, 0, -0.013], [1.545, 0.064 + r * 0.6, 0.06 + r * 0.6, 0.062 + r * 0.6, 0, -0.012]],
      { dir: 1, seg: 18, step: 0.012, col: c, cell: 'knit', hem1: 0.008, W: (y, x) => torsoW(y, x) });
  }
  const sleeveW = (k) => (q) => chainW(q, [[0, 'sh' + k], [LEN.upper, 'el' + k, 0.035], [LEN.upper + LEN.fore, 'hand' + k, 0.02]]);
  // 반팔 소매: 어깨는 관절 중심의 반구(돌려도 모양이 그대로) → 아래로 소매
  function shortSleeves(B, it, lod, c, cell, colF) {
    const M = bindPose().M, lo = lod > 0;
    for (const [s, k] of SIDES) {
      const prof = [[0.0, 0.058, 0.062, 0.06, 0, 0], [0.05, 0.058, 0.062, 0.06, s * 0.002, 0], [0.11, 0.056, 0.06, 0.058, s * 0.002, 0.001], [it.sleeve || 0.17, 0.055, 0.059, 0.056, s * 0.002, 0.002]];
      tube(B, prof, { mat: M['sh' + k], dir: -1, seg: lo ? 9 : 16, step: lo ? 0.12 : 0.025, col: colF ? (q, x, z) => colF(q, x, z, s) : c, cell, hem1: lo ? 0 : 0.01, cap0: 0.046,
        ao: (q) => 1 - 0.1 * sstep(0.12, 0.17, q), W: one('sh' + k) });
    }
  }
  // 긴소매: 어깨 반구 → 손목. loose: 팔보다 굵은 정도, 끝동(cuff) 색·질감
  function longSleeves(B, it, lod, c, cell, o = {}) {
    const M = bindPose().M, lo = lod > 0, L = o.loose || 0.012;
    for (const [s, k] of SIDES) {
      const prof = [[0.0, 0.058 + L * 0.4, 0.062 + L * 0.4, 0.06 + L * 0.4, 0, 0], [0.06, 0.056 + L * 0.6, 0.06 + L * 0.6, 0.058 + L * 0.6, s * 0.002, 0]]
        .concat(ARM.filter((r) => r[0] >= 0.13 && r[0] <= 0.47).map((r) => [r[0], r[1] + L, r[2] + L, r[3] + L, s * (r[4] || 0), r[5] || 0]));
      prof.push([0.505, 0.026 + L, 0.033 + L, 0.031 + L, 0, 0], [0.53, 0.024 + L, 0.031 + L, 0.029 + L, 0, 0]);
      tube(B, prof, { mat: M['sh' + k], dir: -1, seg: lo ? 9 : 16, step: lo ? 0.1 : 0.026, col: o.colF ? (q, x, z) => o.colF(q, x, z, s) : c, cell, cap0: 0.046, hem1: lo || o.cuff ? 0 : 0.01,
        ao: (q) => 1 - 0.1 * gauss(q - LEN.upper, 0.03), W: sleeveW(k) });
      // 끝동(소매 단): 조금 굵고 다른 색
      if (!lo && o.cuff) tube(B, [[0.49, 0.03 + L, 0.037 + L, 0.035 + L, 0, 0], [0.54, 0.028 + L, 0.035 + L, 0.033 + L, 0, 0]],
        { mat: M['sh' + k], dir: -1, seg: 14, step: 0.05, col: o.cuff, cell: o.cuffCell || 'knit', hem0: 0.004, hem1: 0.006, W: sleeveW(k) });
    }
  }
  // 앞판 지퍼·단추 줄, 주머니 같은 '그린' 디테일: 몸통 정점 색 함수
  const frontLine = (c, lineC, w = 0.006) => (y, x, z) => (z > 0 && Math.abs(x) < w && y > 0.92 ? lineC : c);
  const TOPS = {
    // 반팔 티셔츠: 몸통 + 반팔 소매(단 접힘) + 둥근 목 립 + 아래단. cell: 무늬, rib: 목 립 색
    tee(B, look, it, lod, armsOnly) {
      const c = col(it.color), cell = it.cell || 'knit', lo = lod > 0;
      if (!armsOnly) {
        tuckedTorso(B, it, lod, c, cell);
        if (!lo) neckRib(B, it.rib !== undefined ? col(it.rib) : col(it.color, 0.85));
      }
      shortSleeves(B, it, lod, c, cell);
    },
    // 민소매: 몸통만 (팔은 어깨부터 피부)
    tank(B, look, it, lod, armsOnly) {
      if (armsOnly) return;
      const c = col(it.color), cell = it.cell || 'knit';
      tuckedTorso(B, it, lod, c, cell);
      if (lod === 0) neckRib(B, it.rib !== undefined ? col(it.rib) : col(it.color, 0.85), 0.006);
    },
    // 긴팔 셔츠·전술복: 넣어 입은 몸통 + 깃 + 단추 줄 + (전술복) 가슴 주머니·어깨 패드
    longsleeve(B, look, it, lod, armsOnly) {
      const c = col(it.color), cell = it.cell || 'twill', lo = lod > 0, dk = col(it.trim !== undefined ? it.trim : it.color, it.trim !== undefined ? 1 : 0.72);
      if (!armsOnly) {
        tuckedTorso(B, it, lod, c, cell, lo ? null : frontLine(c, dk, 0.005));
        if (!lo) {
          // 셔츠 깃: 목 둘레에서 바깥으로 접힌 고리
          tube(B, [[1.488, 0.093, 0.083, 0.09, 0, -0.016], [1.515, 0.086, 0.074, 0.083, 0, -0.016], [1.55, 0.072, 0.064, 0.07, 0, -0.014]], { dir: 1, seg: 20, step: 0.02, col: it.collar !== undefined ? col(it.collar) : c, cell, hem1: 0.006, W: (y, x) => torsoW(y, x) });
          if (it.pockets) for (const s of [1, -1]) {
            rbox(B, { c: [s * 0.082, 1.31, 0.126], w: 0.085, h: 0.095, d: 0.016, ex: 3, col: col(it.color, 0.93), cell, W: (y, x) => torsoW(1.31, s * 0.08), seg: 8 });
            rbox(B, { c: [s * 0.082, 1.355, 0.13], w: 0.09, h: 0.024, d: 0.016, ex: 3, col: dk, cell, W: (y, x) => torsoW(1.355, s * 0.08), seg: 8 });
          }
        }
      }
      longSleeves(B, it, lod, c, cell, { loose: 0.011, cuff: lo ? null : dk, cuffCell: cell });
      if (!lo && it.pockets && !armsOnly) { const M = bindPose().M; for (const [s, k] of SIDES) rbox(B, { mat: M['sh' + k], c: [s * 0.068, -0.12, 0.0], w: 0.012, h: 0.08, d: 0.07, ex: 3, col: dk, cell, W: one('sh' + k), seg: 8 }); }
    },
    // 후드티: 밖으로 내어 입은 넉넉한 몸통 + 캥거루 주머니(색 영역) + 등에 접힌 후드 + 끈 + 립 소매 끝동
    hoodie(B, look, it, lod, armsOnly) {
      const c = col(it.color), cell = it.cell || 'knit', lo = lod > 0, c2 = it.color2 !== undefined ? col(it.color2) : col(it.color, 0.82);
      if (!armsOnly) {
        // 앞 주머니: 배 앞쪽 사각 영역을 다른 색으로, 위·옆 가장자리는 박음질처럼 어둡게
        const pocket = (y, x, z) => {
          if (z <= 0.04 || y < 0.94 || y > 1.13 || Math.abs(x) > 0.105) return c;
          const edge = y > 1.11 || Math.abs(x) > 0.095 || (Math.abs(x) > 0.07 && y > 1.08 - (Math.abs(x) - 0.07) * 1.2);
          return edge ? col(it.color2 !== undefined ? it.color2 : it.color, 0.62) : c2;
        };
        looseTorso(B, it, lod, c, cell, lo ? null : pocket, 0.004);
        if (!lo) {
          neckRib(B, c2, 0.012);
          // 후드: 목 뒤로 접혀 등에 얹힌 천 덩어리 두 겹
          ellipsoid(B, { c: [0, 1.47, -0.112], r: [0.128, 0.07, 0.05], rx: 0.45, ws: 16, hs: 10, cell, W: (ux, uy, uz) => torsoW(1.47 + uy * 0.06, ux * 0.12), col: c });
          ellipsoid(B, { c: [0, 1.515, -0.088], r: [0.112, 0.05, 0.045], rx: 0.2, ws: 14, hs: 8, cell, W: (ux, uy, uz) => torsoW(1.52 + uy * 0.04, ux * 0.1), col: col(it.color, 0.9) });
          // 끈 두 가닥
          for (const s of [1, -1]) ellipsoid(B, { c: [s * 0.036, 1.43, 0.112], r: [0.0045, 0.068, 0.0045], rx: -0.36, ws: 6, hs: 6, cell: 'matte', W: (ux, uy) => torsoW(1.43 + uy * 0.06, s * 0.036), col: col(it.cord !== undefined ? it.cord : 0xe8e6e0) });
        }
      }
      longSleeves(B, it, lod, c, cell, { loose: 0.017, cuff: lo ? null : c2 });
    },
    // 재킷·점퍼: 넉넉한 몸통 + 세운 깃(털 깃 가능) + 앞 지퍼 + 옆 주머니 덮개 + 어깨 투톤 + 소매 줄
    jacket(B, look, it, lod, armsOnly) {
      const c = col(it.color), cell = it.cell || 'canvas', lo = lod > 0, c2 = it.color2 !== undefined ? col(it.color2) : c, zip = col(it.zip !== undefined ? it.zip : 0x2b2c2e);
      const stripe = it.stripe !== undefined ? col(it.stripe) : null;
      if (!armsOnly) {
        const body = (y, x, z) => {
          if (z > 0 && Math.abs(x) < 0.007 && y > 0.91 && y < 1.5) return zip;
          if (it.color2 !== undefined && y > 1.37 - Math.abs(x) * 0.25) return c2;   // 어깨 요크
          return c;
        };
        looseTorso(B, it, lod, c, cell, lo ? null : body, 0.008);
        if (!lo) {
          tube(B, [[1.488, 0.095, 0.084, 0.09, 0, -0.016], [1.53, 0.083, 0.072, 0.08, 0, -0.016], [1.585, 0.078, 0.068, 0.074, 0, -0.016]],
            { dir: 1, seg: 20, step: 0.025, col: it.collar !== undefined ? col(it.collar) : c2, cell: it.collarCell || cell, hem1: 0.008, W: (y, x) => torsoW(y, x) });
          for (const s of [1, -1]) rbox(B, { c: [s * 0.125, 1.055, 0.122], w: 0.085, h: 0.022, d: 0.03, ex: 3, col: col(it.color, 0.78), cell, W: (y, x) => torsoW(1.055, s * 0.12), seg: 8 });
        }
      }
      const sl = stripe ? (q, x, z, s) => (x * s > 0 && Math.abs(z) < Math.abs(x) * 0.28 && q > 0.06 ? stripe : (it.color2 !== undefined && q < 0.08 ? c2 : c)) : (it.color2 !== undefined ? (q) => (q < 0.08 ? c2 : c) : null);
      longSleeves(B, it, lod, c, cell, { loose: 0.019, cuff: lo ? null : col(it.cuff !== undefined ? it.cuff : it.color, it.cuff !== undefined ? 1 : 0.75), cuffCell: 'knit', colF: lo ? null : sl });
    },
  };
  const legW = (k) => (q) => chainW(q, [[0, 'hips'], [-0.01, 'hip' + k, 0.07], [LEN.thigh, 'knee' + k, 0.045], [LEN.thigh + LEN.shin, 'foot' + k, 0.03]]);
  // 바지 공통: 골반 + 두 다리. o: { add(여유), end(다리 끝 s), cell, colL(q,x,z,s), hem }
  function pants(B, it, lod, c, o) {
    const M = bindPose().M, lo = lod > 0, cell = o.cell;
    tube(B, addR(PELVIS, 0.01), { dir: 1, seg: lo ? 12 : 22, step: lo ? 0.06 : 0.02, ex: 2.1, col: c, cell, cap0: 0.02, hem1: lo ? 0 : 0.008, W: (y, x) => torsoW(y, x) });
    for (const [s, k] of SIDES) {
      let prof = addR(LEG, o.add).map((r) => [r[0], r[1], r[2], r[3], s * r[4], r[5]]);
      if (o.end) { prof = prof.filter((r) => r[0] < o.end); const R = profAt(addR(LEG, o.add + (o.flare || 0)), o.end, [0, 0, 0, 0, 0]); prof.push([o.end, R[0], R[1], R[2], s * R[3], R[4]]); }
      tube(B, prof, { mat: M['hip' + k], dir: -1, seg: lo ? 9 : 16, step: lo ? 0.09 : 0.03, ex: 2.05, col: o.colL && !lo ? (q, x, z) => o.colL(q, x, z, s) : c, cell, v0: 0, v1: 1, hem1: lo || !o.hem ? 0 : o.hem,
        ao: (q, x) => 1 - 0.2 * sstep(0.08, -0.02, q) * sstep(0, -s * 0.06, x), W: legW(k) });
    }
  }
  // 허리띠 + 버클 + 고리
  function belt(B, it, c, cell) {
    const bc = col(it.belt || 0x2a2622);
    tube(B, [[1.0, 0.178, 0.115, 0.126, 0, 0], [1.036, 0.174, 0.116, 0.12, 0, 0]], { dir: 1, seg: 24, step: 0.04, ex: 2.1, col: bc, cell: 'canvas', W: (y, x) => torsoW(y, x), hem0: 0.004, hem1: 0.004 });
    rbox(B, { c: [0, 1.018, 0.12], w: 0.056, h: 0.04, d: 0.01, col: col(it.buckle || 0x8f8f88), cell: 'gloss', W: one('hips'), seg: 8 });
    for (const a of [-2.1, -1.15, 1.15, 2.1]) rbox(B, { c: [Math.sin(a) * 0.18, 1.018, Math.cos(a) * (Math.abs(a) > 1.6 ? 0.126 : 0.117)], w: 0.016, h: 0.044, d: 0.008, col: c, cell, W: one('hips'), seg: 6 });
  }
  // 반바지 아래 맨다리(신발 속까지)
  function buildLegsSkin(B, look, lod, from) {
    const M = bindPose().M;
    for (const [s, k] of SIDES) {
      const prof = LEG.filter((r) => r[0] >= from - 0.07).map((r) => [r[0], r[1] - 0.003, r[2] - 0.003, r[3] - 0.003, s * r[4], r[5]]);
      tube(B, prof, { mat: M['hip' + k], dir: -1, seg: lod ? 8 : 14, step: lod ? 0.12 : 0.035, cell: 'skin', col: col(look.tone, 0.97), W: legW(k) });
    }
  }
  const BOTTOMS = {
    // 카고 바지: 골반 + 다리 + 허리띠·버클 + 옆 주머니 + 무릎 덧댐. cell: 무늬
    cargo(B, look, it, lod) {
      const M = bindPose().M, c = col(it.color), lo = lod > 0, dk = col(it.color, 0.78), cell = it.cell || 'twill';
      pants(B, it, lod, c, { add: 0.011, cell });
      if (lo) return;
      for (const [s, k] of SIDES) {
        // 옆 주머니(덮개 포함) — 허벅지 바깥쪽
        const pW = one('hip' + k), H = M['hip' + k];
        rbox(B, { mat: H, c: [s * 0.088, -0.245, 0.006], w: 0.02, h: 0.125, d: 0.105, ex: 3, col: col(it.color, 0.96), cell, W: pW });
        rbox(B, { mat: H, c: [s * 0.092, -0.19, 0.006], w: 0.018, h: 0.03, d: 0.11, ex: 3, col: dk, cell, W: pW });
        if (it.knee) rbox(B, { mat: H, c: [0, -0.405, 0.064], w: 0.1, h: 0.12, d: 0.014, ex: 3, col: it.kneeCol !== undefined ? col(it.kneeCol) : col(it.color, 0.9), cell: it.kneeCell || cell, seg: 10, W: (q) => chainW(-q, [[0, 'hip' + k], [LEN.thigh, 'knee' + k, 0.045]]) });
      }
      belt(B, it, c, cell);
    },
    // 청바지: 날씬한 다리 + 뒷주머니 + 밑단 접힘. cell 기본 데님
    jeans(B, look, it, lod) {
      const c = col(it.color), lo = lod > 0, cell = it.cell || 'denim';
      pants(B, it, lod, c, { add: 0.007, cell, hem: 0.012 });
      if (lo) return;
      for (const s of [1, -1]) rbox(B, { c: [s * 0.072, 0.955, -0.112], w: 0.085, h: 0.1, d: 0.012, ex: 3, col: col(it.color, 0.9), cell, W: (y, x) => torsoW(0.955, s * 0.07), seg: 8 });
      if (it.belt !== null) belt(B, it, c, cell);
    },
    // 트레이닝 바지: 옆줄 + 고무 밴드 허리(끈) + 발목 조임
    track(B, look, it, lod) {
      const c = col(it.color), lo = lod > 0, cell = it.cell || 'knit', st = col(it.stripe !== undefined ? it.stripe : 0xf0f0ec);
      pants(B, it, lod, c, { add: 0.014, cell, hem: 0.01, colL: (q, x, z, s) => (x * s > 0 && Math.abs(z) < Math.abs(x) * 0.24 && q > -0.02 ? st : c) });
      if (lo) return;
      tube(B, [[1.0, 0.176, 0.114, 0.124, 0, 0], [1.045, 0.172, 0.114, 0.118, 0, 0]], { dir: 1, seg: 24, step: 0.045, ex: 2.1, col: col(it.color, 0.8), cell: 'knit', W: (y, x) => torsoW(y, x), hem0: 0.004, hem1: 0.004 });
      for (const s of [1, -1]) ellipsoid(B, { c: [s * 0.016, 0.985, 0.122], r: [0.004, 0.04, 0.004], rz: s * 0.15, ws: 6, hs: 6, cell: 'matte', W: one('hips'), col: col(0xe8e6e0) });
    },
    // 반바지: 무릎 위까지 + 아래는 맨다리(geometry에서 buildLegsSkin)
    shorts(B, look, it, lod) {
      const M = bindPose().M, c = col(it.color), lo = lod > 0, cell = it.cell || 'twill';
      pants(B, it, lod, c, { add: 0.016, flare: 0.006, end: 0.3, cell, hem: 0.012 });
      if (lo) return;
      for (const [s, k] of SIDES) rbox(B, { mat: M['hip' + k], c: [s * 0.094, -0.19, 0.006], w: 0.02, h: 0.09, d: 0.095, ex: 3, col: col(it.color, 0.94), cell, W: one('hip' + k) });
      belt(B, it, c, cell);
    },
  };
  const SHOES = {
    boots(B, look, it, lod) {
      const M = bindPose().M, c = col(it.color), lo = lod > 0, so = col(it.sole || 0x26231f);
      for (const [s, k] of SIDES) {
        // 목(정강이 뼈 로컬)
        tube(B, [[0.19, 0.056, 0.055, 0.065, 0, -0.004], [0.23, 0.054, 0.053, 0.062, 0, -0.004], [0.30, 0.05, 0.05, 0.055, 0, -0.002], [0.38, 0.047, 0.05, 0.052, 0, 0.002], [0.44, 0.046, 0.056, 0.056, 0, 0.008]],
          { mat: M['knee' + k], dir: -1, seg: lo ? 9 : 16, step: lo ? 0.13 : 0.03, col: c, cell: 'leather', hem0: lo ? 0 : 0.012, v0: 0.95, v1: 0.42, u0: 0,
            W: (q) => chainW(q, [[0, 'knee' + k], [0.405, 'foot' + k, 0.035]]) });
        // 발등~앞코 (발 뼈 로컬, 뒤꿈치→앞코를 따라)
        const Mf = M['foot' + k].clone().multiply(_m4.makeRotationX(-Math.PI / 2));
        const FOOT = [[-0.085, 0.031, 0.035, 0.02, 0, -0.03], [-0.06, 0.038, 0.062, 0.03, 0, -0.03], [-0.02, 0.043, 0.066, 0.032, 0, -0.03], [0.02, 0.046, 0.054, 0.032, 0, -0.03],
          [0.07, 0.05, 0.036, 0.032, 0, -0.03], [0.12, 0.051, 0.026, 0.03, 0, -0.032], [0.17, 0.047, 0.019, 0.028, 0, -0.036], [0.205, 0.035, 0.015, 0.022, 0, -0.04]];
        tube(B, FOOT, { mat: Mf, dir: -1, seg: lo ? 9 : 14, step: lo ? 0.1 : 0.027, ex: 2.4, col: c, cell: 'leather', cap0: 0.012, cap1: 0.016, v0: 0.42, v1: 0.0, u0: 0,
          W: (q) => chainW(q, [[0, 'foot' + k], [0.11, 'toe' + k, 0.025]]) });
        // 밑창
        tube(B, FOOT.map((r) => [r[0], r[1] + 0.005, 0.0125, 0.0125, 0, -0.072]), { mat: Mf, dir: -1, seg: lo ? 8 : 14, step: lo ? 0.1 : 0.025, ex: 5, col: so, cell: 'sole', cap0: 0.01, cap1: 0.012,
          W: (q) => chainW(q, [[0, 'foot' + k], [0.11, 'toe' + k, 0.025]]) });
      }
    },
    // 운동화(낮은 목) / 하이탑(high): 천 갑피 + 끈 + 앞코·뒤축 다른 색 + 두꺼운 흰 중창 + 얇은 고무 밑창
    sneakers(B, look, it, lod) {
      const M = bindPose().M, c = col(it.color), lo = lod > 0, mid = col(it.sole !== undefined ? it.sole : 0xf1f1ec), out = col(it.out !== undefined ? it.out : 0x3a3a38);
      const c2 = it.color2 !== undefined ? col(it.color2) : col(it.color, 0.86), c0 = it.high ? 0.25 : 0.355, cell = it.cell || 'sneak';
      for (const [s, k] of SIDES) {
        const shaft = [[c0, 0.057, 0.056, 0.066, 0, -0.004], [c0 + 0.025, 0.054, 0.054, 0.063, 0, -0.004]].concat([[0.3, 0.05, 0.05, 0.056, 0, -0.002], [0.38, 0.048, 0.051, 0.054, 0, 0.002], [0.44, 0.047, 0.057, 0.057, 0, 0.008]].filter((r) => r[0] > c0 + 0.03));
        tube(B, shaft, { mat: M['knee' + k], dir: -1, seg: lo ? 9 : 16, step: lo ? 0.13 : 0.03, col: c, cell, hem0: lo ? 0 : 0.014, v0: it.high ? 0.95 : 0.6, v1: 0.42, u0: 0,
          W: (q) => chainW(q, [[0, 'knee' + k], [0.405, 'foot' + k, 0.035]]) });
        const Mf = M['foot' + k].clone().multiply(_m4.makeRotationX(-Math.PI / 2));
        const FOOT = [[-0.085, 0.032, 0.036, 0.022, 0, -0.03], [-0.06, 0.039, 0.062, 0.03, 0, -0.03], [-0.02, 0.044, 0.064, 0.032, 0, -0.03], [0.02, 0.047, 0.052, 0.032, 0, -0.03],
          [0.07, 0.051, 0.036, 0.032, 0, -0.03], [0.12, 0.053, 0.028, 0.03, 0, -0.032], [0.17, 0.049, 0.022, 0.028, 0, -0.036], [0.208, 0.037, 0.017, 0.022, 0, -0.04]];
        tube(B, FOOT, { mat: Mf, dir: -1, seg: lo ? 9 : 14, step: lo ? 0.1 : 0.027, ex: 2.5, col: lo ? c : (q) => (q > 0.15 || q < -0.07 ? c2 : c), cell, cap0: 0.012, cap1: 0.016, v0: 0.42, v1: 0.0, u0: 0,
          W: (q) => chainW(q, [[0, 'foot' + k], [0.11, 'toe' + k, 0.025]]) });
        tube(B, FOOT.map((r) => [r[0], r[1] + 0.008, 0.0145, 0.0145, 0, -0.0655]), { mat: Mf, dir: -1, seg: lo ? 8 : 14, step: lo ? 0.1 : 0.025, ex: 5, col: mid, cell: it.soleCell || 'matte', cap0: 0.012, cap1: 0.014,
          W: (q) => chainW(q, [[0, 'foot' + k], [0.11, 'toe' + k, 0.025]]) });
        if (!lo) tube(B, FOOT.map((r) => [r[0], r[1] + 0.006, 0.0032, 0.0032, 0, -0.0818]), { mat: Mf, dir: -1, seg: 14, step: 0.03, ex: 5, col: out, cell: 'sole', cap0: 0.01, cap1: 0.012,
          W: (q) => chainW(q, [[0, 'foot' + k], [0.11, 'toe' + k, 0.025]]) });
      }
    },
  };
  // ---------- 모자 (머리 뼈에 붙는 단단한 메시 — 헬멧을 쓰면 숨김) ----------
  //  머리 덮개: 단위구 방위각 a(0 = 정면), 경계 line(a) 위를 off(t, a)만큼 띄워 덮는다 (t: 0 정수리 → 1 경계)
  function headShell(B, o) {
    const AN = o.AN || 32, RN = o.RN || 10, hb = B.n, t0 = o.t0 || 0;
    for (let i = 0; i <= RN; i++) for (let j = 0; j <= AN; j++) {
      const a = -Math.PI + j / AN * TAU, t = lerp(t0, 1, i / RN), line = o.line(a);
      const uy = lerp(1, line, Math.pow(t, 0.85)), cb = Math.sqrt(Math.max(0, 1 - uy * uy)), ux = Math.sin(a) * cb, uz = Math.cos(a) * cb;
      headPoint(ux, uy, uz, _v); const dx = _v.x - HC[0], dy = _v.y - HC[1], dz = _v.z - HC[2], dl = Math.hypot(dx, dy, dz), th = o.off(t, a);
      _v.set(_v.x + dx / dl * th, _v.y + dy / dl * th, _v.z + dz / dl * th);
      if (o.shape) o.shape(_v, t, a);
      const uv = cellUV(o.cell, j / AN, 1 - t);
      B.vert(_v.x, _v.y, _v.z, typeof o.col === 'function' ? o.col(t, a) : o.col, uv[0], uv[1], [[BI.head, 1]]);
    }
    for (let i = 0; i < RN; i++) for (let j = 0; j < AN; j++) { const a = hb + i * (AN + 1) + j, b2 = a + AN + 1; B.I.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
    for (let i = 0; i <= RN; i++) B.seam.push([hb + i * (AN + 1), hb + i * (AN + 1) + AN]);
    return hb;
  }
  // 경계 위의 점 (챙의 안쪽 가장자리)
  function shellEdge(o, a, out) {
    const line = o.line(a), uy = line, cb = Math.sqrt(Math.max(0, 1 - uy * uy));
    headPoint(Math.sin(a) * cb, uy, Math.cos(a) * cb, out); const dx = out.x - HC[0], dy = out.y - HC[1], dz = out.z - HC[2], dl = Math.hypot(dx, dy, dz), th = o.off(1, a);
    out.set(out.x + dx / dl * th, out.y + dy / dl * th, out.z + dz / dl * th); if (o.shape) o.shape(out, 1, a);
    return out;
  }
  // 챙: a0~a1 각도 범위, 폭 w(a), 처짐 droop(f). 위·아래 면 + 바깥 테두리
  function brim(B, o, a0, a1, n, w, droop, c, cell, th = 0.0035) {
    const base = B.n, P = new THREE.Vector3(), rows = [];
    for (let j = 0; j <= n; j++) {
      const a = lerp(a0, a1, j / n); shellEdge(o, a, P);
      const hx = Math.sin(a), hz = Math.cos(a), W = w(a), ring = [];
      for (const [f, dy] of [[0, th], [1, th], [1, -th], [0, -th]]) {
        const x = P.x + hx * W * f, z = P.z + hz * W * f, y = P.y - droop(f, a) * W + dy;
        const uv = cellUV(cell, j / n, f * 0.3 + (dy < 0 ? 0.5 : 0));
        ring.push(B.vert(x, y, z, dy < 0 ? [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75] : c, uv[0], uv[1], [[BI.head, 1]]));
      }
      rows.push(ring);
    }
    for (let j = 0; j < n; j++) for (let k = 0; k < 3; k++) {
      const a = rows[j][k], b = rows[j][k + 1], c2 = rows[j + 1][k + 1], d = rows[j + 1][k];
      B.I.push(a, b, d, b, c2, d);
    }
    return base;
  }
  const HAT_LINES = {
    beanie: (a) => { const t = Math.abs(a); return t < 0.6 ? 0.42 : t < 1.6 ? lerp(0.42, 0.18, sstep(0.6, 1.5, t)) : lerp(0.18, -0.06, sstep(1.6, 2.6, t)); },
    cap: (a) => { const t = Math.abs(a); return t < 0.7 ? 0.5 : t < 1.7 ? lerp(0.5, 0.3, sstep(0.7, 1.6, t)) : lerp(0.3, 0.14, sstep(1.7, 2.7, t)); },
    boonie: (a) => { const t = Math.abs(a); return t < 0.8 ? 0.4 : lerp(0.4, 0.16, sstep(0.8, 2.6, t)); },
    band: (a) => { const t = Math.abs(a); return t < 0.8 ? 0.47 : t < 1.8 ? lerp(0.47, 0.24, sstep(0.8, 1.7, t)) : lerp(0.24, -0.16, sstep(1.8, 2.8, t)); },
    beret: (a) => { const t = Math.abs(a); return t < 0.9 ? 0.5 : lerp(0.5, 0.3, sstep(0.9, 2.6, t)); },
  };
  const HATS = {
    // 비니: 머리 모양을 따라 씌운 니트 + 접어 올린 단
    beanie(B, it) {
      // 옆·윗부분을 둥글게 부풀리고(머리 모양보다 넉넉하게) 정수리는 낮게 눌러 뾰족하지 않게
      const c = col(it.color), cell = it.cell || 'knit', o = { line: HAT_LINES.beanie, cell, col: (t) => (t > 0.76 ? col(it.color, 0.88) : c),
        off: (t) => 0.02 + 0.016 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + (t > 0.76 ? 0.008 : 0), shape: (v, t) => { v.y -= 0.012 * Math.max(0, 1 - t / 0.35); } };
      headShell(B, o);
      if (it.pom) ellipsoid(B, { c: [0, 0.226, -0.004], r: [0.03, 0.026, 0.03], ws: 10, hs: 8, cell: 'fleece', W: [[BI.head, 1]], col: col(it.pom) });
    },
    // 야구모자: 둥근 정수리(6쪽 박음질 = 캔버스 질감) + 앞챙 + 꼭지 단추
    cap(B, it) {
      const c = col(it.color), cell = it.cell || 'canvas', o = { line: HAT_LINES.cap, cell, col: c, off: (t) => 0.023 + 0.004 * (1 - t) };
      headShell(B, o);
      brim(B, o, -1.05, 1.05, 14, (a) => 0.082 * Math.pow(Math.cos(a * 1.25), 0.6), (f) => 0.12 * f * f, it.brim !== undefined ? col(it.brim) : c, cell);
      ellipsoid(B, { c: [0, 0.219, -0.002], r: [0.011, 0.006, 0.011], ws: 8, hs: 5, cell, W: [[BI.head, 1]], col: it.brim !== undefined ? col(it.brim) : c });
    },
    // 정글모자(부니햇): 낮은 통 + 사방으로 처진 넓은 챙
    boonie(B, it) {
      const c = col(it.color), cell = it.cell || 'canvas', o = { line: HAT_LINES.boonie, cell, col: c, off: (t) => 0.028 + 0.012 * (1 - t), shape: (v, t) => { if (t < 0.3) v.y -= 0.01 * (1 - t / 0.3); } };
      headShell(B, o);
      brim(B, o, -Math.PI, Math.PI, 36, () => 0.068, (f, a) => (0.3 + 0.08 * Math.cos(a * 3)) * f, c, cell, 0.003);
      headShell(B, { line: (a) => HAT_LINES.boonie(a) + 0.05, cell: 'canvas', col: col(it.band !== undefined ? it.band : it.color, it.band !== undefined ? 1 : 0.72), off: () => 0.031, t0: 0.9, RN: 2 });
    },
    // 베레모: 한쪽으로 처진 납작한 천 + 가죽 테 + 앞 배지
    beret(B, it) {
      const c = col(it.color);
      headShell(B, { line: HAT_LINES.beret, cell: 'leather', col: col(0x1d1916), off: () => 0.024, t0: 0.82, RN: 2 });
      ellipsoid(B, { c: [-0.022, 0.172, -0.012], r: [0.108, 0.042, 0.116], rz: 0.24, rx: -0.08, ws: 22, hs: 12, cell: 'fleece', W: [[BI.head, 1]], col: c });
      // 배지: 왼쪽 눈 위 가죽 테에 붙임
      const a = 0.42, uy = 0.56, cb = Math.sqrt(1 - uy * uy); headPoint(Math.sin(a) * cb, uy, Math.cos(a) * cb, _w);
      const nx = _w.x - HC[0], ny = _w.y - HC[1], nz = _w.z - HC[2], nl = Math.hypot(nx, ny, nz);
      ellipsoid(B, { c: [_w.x + nx / nl * 0.029, _w.y + ny / nl * 0.029, _w.z + nz / nl * 0.029], r: [0.009, 0.011, 0.003], ry: a, ws: 10, hs: 6, cell: 'gold', W: [[BI.head, 1]], col: col(it.badge !== undefined ? it.badge : 0xffffff) });
    },
    // 두건: 머리를 감싸 뒤에서 묶음 + 매듭 꼬리 두 가닥
    bandana(B, it) {
      const c = col(it.color), cell = it.cell || 'canvas';
      headShell(B, { line: HAT_LINES.band, cell, col: c, off: (t) => 0.015 + 0.006 * (1 - t) });
      ellipsoid(B, { c: [0, 0.04, -0.104], r: [0.022, 0.02, 0.018], ws: 8, hs: 6, cell, W: [[BI.head, 1]], col: col(it.color, 0.85) });
      for (const s of [1, -1]) ellipsoid(B, { c: [s * 0.018, -0.005, -0.112], r: [0.016, 0.05, 0.006], rz: s * 0.35, rx: 0.25, ws: 8, hs: 6, cell, W: [[BI.head, 1]], col: col(it.color, 0.9) });
    },
  };
  const HATGEO = new Map();
  function hatMesh(id) {
    const it = id && SKINS[id]; if (!it || !HATS[it.kind]) return null;
    let g = HATGEO.get(id);
    if (!g) { const B = new GB(0); HATS[it.kind](B, it); g = B.geometry(); g.computeBoundingSphere(); HATGEO.set(id, g); }
    const m = new THREE.Mesh(g, rigidMaterial()); m.castShadow = true;
    return m;
  }
  // ---------- 스킨 표(창고) ----------
  //  slot: 장착 슬롯, kind: 생성기, color 등은 생성기 인수. 새 스킨은 여기에 항목을 더하면 된다
  const SLOTS = [
    { id: 'hat', name: '모자', optional: true }, { id: 'top', name: '상의' }, { id: 'bottom', name: '하의' },
    { id: 'shoes', name: '신발' }, { id: 'gloves', name: '장갑', optional: true }, { id: 'chute', name: '낙하산' },
  ];
  const SKINS = {
    top_basic: { slot: 'top', name: '기본 티셔츠', desc: '면 반팔 티셔츠', kind: 'tee', color: 0x6b7067 },
    bottom_basic: { slot: 'bottom', name: '기본 카고 바지', desc: '주머니가 달린 작업 바지', kind: 'cargo', color: 0x4f523f, belt: 0x2b2722 },
    shoes_basic: { slot: 'shoes', name: '기본 전투화', desc: '끈으로 묶는 가죽 부츠', kind: 'boots', color: 0x4b3a2a, sole: 0x24211d },
    chute_basic: { slot: 'chute', name: '기본 낙하산', desc: '올리브·모래색 사각 낙하산', kind: 'ramair', colors: [0x55603f, 0xa48d68] },
  };
  const DEFAULT_LOOK = { hat: null, top: 'top_basic', bottom: 'bottom_basic', shoes: 'shoes_basic', gloves: null, chute: 'chute_basic' };
  // 사람마다 다른 몸(스킨 아님): 피부·머리 모양·머리 색·수염·눈 색
  const TONES = [0xf1c9a5, 0xe0ac86, 0xc98f6b, 0xa8714f, 0x7d5034, 0x5a3825];
  const HAIR_COLORS = [0x15110e, 0x2a2019, 0x3d2b1d, 0x5a3e26, 0x8a6a45, 0x6d6862];
  const EYES = [0x3a2a1e, 0x4a3524, 0x2f4a5e, 0x45563a];
  const PLAYER_BODY = { tone: 0xe0ac86, hair: 'short', hairColor: 0x2a2019, beard: 'none', eye: 0x4a3524 };
  // 봇 얼굴: 고정된 14가지 중에서 고른다 (조합마다 지오메트리를 새로 만들면 봇 99명일 때 메모리가 수십 MB)
  const BOT_BODIES = (() => {
    const R = mulberry32(777), out = [];
    for (let i = 0; i < 14; i++) out.push({ tone: TONES[i % TONES.length], hair: ['buzz', 'short', 'crew', 'short', 'crew', 'buzz', 'short'][i % 7], hairColor: HAIR_COLORS[Math.floor(R() * HAIR_COLORS.length)],
      beard: ['none', 'stubble', 'none', 'beard', 'stubble', 'none', 'none'][(i * 3) % 7], eye: EYES[Math.floor(R() * EYES.length)] });
    return out;
  })();
  function randomBody(r) { const R = r || Math.random; return BOT_BODIES[Math.floor(R() * BOT_BODIES.length) % BOT_BODIES.length]; }
  // 장착 정보 정리: 없는 스킨·잘못된 슬롯은 기본값으로
  function normEquip(eq) {
    const out = Object.assign({}, DEFAULT_LOOK);
    if (eq && typeof eq === 'object') for (const sl of SLOTS) { const v = eq[sl.id]; if (v === null && sl.optional) out[sl.id] = null; else if (v && SKINS[v] && SKINS[v].slot === sl.id) out[sl.id] = v; }
    return out;
  }
  function makeLook(equip, body) { return Object.assign({}, PLAYER_BODY, body || {}, normEquip(equip)); }
  // 모자는 따로 붙는 메시라 지오메트리 열쇠에 넣지 않는다 (모자만 바꿔도 몸 메시 공유)
  const lookKey = (L) => [L.top, L.bottom, L.shoes, L.gloves, L.tone, L.hair, L.hairColor, L.beard, L.eye, L.mannequin ? 'm' : ''].join('|');
  const GEO = new Map();
  const LONG_TOPS = { longsleeve: 1, hoodie: 1, jacket: 1 };
  const isLong = (top) => !!(top.sleeveLong || LONG_TOPS[top.kind]);
  const armFrom = (top) => (top.kind === 'tank' ? 0 : top.sleeve || 0.17);
  function geometry(look, lod) {
    const key = lookKey(look) + '#' + lod;
    let g = GEO.get(key); if (g) return g;
    const B = new GB(lod);
    let top = SKINS[look.top] || SKINS.top_basic, bot = SKINS[look.bottom] || SKINS.bottom_basic, sh = SKINS[look.shoes] || SKINS.shoes_basic;
    if (look.mannequin) { top = Object.assign({}, SKINS.top_basic, { color: 0xbda27c }); bot = Object.assign({}, SKINS.bottom_basic, { color: 0xa88f6a, belt: 0x6e5c45 }); sh = Object.assign({}, SKINS.shoes_basic, { color: 0x6a5842, sole: 0x3a3128 }); }
    buildHead(B, look, lod); buildNeck(B, look, lod);
    if (!isLong(top)) buildArmsSkin(B, look, lod, armFrom(top));
    buildHands(B, look, lod);
    (TOPS[top.kind] || TOPS.tee)(B, look, top, lod);
    (BOTTOMS[bot.kind] || BOTTOMS.cargo)(B, look, bot, lod);
    if (bot.kind === 'shorts') buildLegsSkin(B, look, lod, 0.27);
    (SHOES[sh.kind] || SHOES.boots)(B, look, sh, lod);
    g = B.geometry(); g.userData.verts = B.n; GEO.set(key, g);
    return g;
  }
  // 1인칭 팔: 소매·팔 피부·손만 (같은 뼈대 번호)
  function armsGeometry(look) {
    const key = lookKey(look) + '#arms';
    let g = GEO.get(key); if (g) return g;
    const B = new GB(0), top = SKINS[look.top] || SKINS.top_basic;
    if (!isLong(top)) buildArmsSkin(B, look, 0, armFrom(top));
    buildHands(B, look, 0);
    (TOPS[top.kind] || TOPS.tee)(B, look, top, 0, true);
    g = B.geometry(); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 3); GEO.set(key, g);
    return g;
  }
  const IDENT = new THREE.Matrix4();
  // 캐릭터 한 명분: 뼈대 + 메시(가까이/멀리) — 지오메트리·재질은 공유
  function instance(look) {
    const { B, list } = makeBones(false);
    const skel = new THREE.Skeleton(list, bindPose().inv), mat = material();
    const hi = new THREE.SkinnedMesh(geometry(look, 0), mat), lo = new THREE.SkinnedMesh(geometry(look, 1), mat);
    for (const m of [hi, lo]) { m.bind(skel, IDENT); m.castShadow = true; m.receiveShadow = false; }
    lo.visible = false;
    return { B, list, skel, hi, lo };
  }
  function armsInstance(look) {
    const { B, list } = makeBones(false);
    const skel = new THREE.Skeleton(list, bindPose().inv), m = new THREE.SkinnedMesh(armsGeometry(look), material());
    m.bind(skel, IDENT); m.castShadow = false; m.frustumCulled = false;
    return { B, list, skel, mesh: m };
  }
  return { DEF, BI, REST, LEN, SIDES, SLOTS, SKINS, DEFAULT_LOOK, PLAYER_BODY, TONES, makeLook, normEquip, randomBody, lookKey, geometry, armsGeometry, instance, armsInstance, material, rigidMaterial, hatMesh, bindPose, headPoint, HC,
    get atlas() { return ATLAS; }, get emissive() { return EMI; }, get cache() { return GEO; } };
})();
