// ============================================================
// 10_rankfx_th.js — v23 상위 티어 승급 컷신: 티어마다 다른 장면 (10_rankfx.js build·frame·text·sound 가 부름)
//  · 노바 「초신성」: 깊은 우주 · 별빛이 빨려들고 강착 원반이 돌며 이전 엠블럼이 한 점으로 오그라듦
//      → 초신성(번쩍 · 가로 렌즈 빛 · 육각 고스트 · 일렁이는 껍질 3겹 · 수정 조각) → 회절 빛살 속 새 엠블럼 · 성운 고리 · 도는 별 · 유성
//  · 셀레스티얼 「천상의 문」: 노을 구름 바다 · 빛의 고리가 내려옴 · 깃털 → 이전 엠블럼이 아래부터 금빛 알갱이로 풀려 올라감
//      → 위 구름이 갈라지며 빛기둥 · 새 엠블럼이 천천히 내려앉음 · 빛의 날개가 펼쳐짐 · 머리 위 고리 · 초승달 · 흩날리는 깃털
//  · 이클립스 「개기일식」: 붉은 하늘의 태양을 검은 달이 가림 · 이전 엠블럼은 붉은 금이 가고 가장자리부터 타들어 재로
//      → 개기일식(코로나 · 홍염 · 붉은 번개) → 다이아몬드 링 → 땅이 갈라진 붉은 틈에서 새 엠블럼이 솟아오름 · 번개 · 불티 폭풍
//  · 제니스 「정점」: 하늘을 뚫고 올라감(아래로 흐르는 빛 띠) · 오로라 · 은하 · 별자리 왕관이 이어짐 · 팔각 별 문양
//      → 이전 엠블럼이 흰빛으로 모였다가 프리즘처럼 무지개 빛살로 → 그 빛에서 새 엠블럼의 구성품이 튀어나와 입체로 펼쳐짐(별자리 선)
//      → 인장 · 날개 · 궤도 고리 · 안쪽 면 · 별 · 왕관 · 명판이 차례로 '철컥' 맞물리고 마지막 보석이 박히며 완성 → 충격파 · 색종이 · 별 왕관 · 무지개 고리
//  · 장면은 시각 t 하나로 정해짐(draw) — 입자·모양은 build 에서 시드로 한 번 · 소리 Audio.rankTheme(id, 단계) · 글자 모양 text
// ============================================================
const RankTheme = (() => {
  const hex2 = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, gg, b] = Array.isArray(c) ? c : hex2(c); return `rgba(${r | 0},${gg | 0},${b | 0},${clamp(a, 0, 1).toFixed(3)})`; };
  const mixc = (a, b, k) => { const p = Array.isArray(a) ? a : hex2(a), q = Array.isArray(b) ? b : hex2(b); return [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)]; };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const eOut = (x) => 1 - (1 - x) ** 3, eIn = (x) => x * x * x, eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2), eBack = (x) => 1 + 2.9 * (x - 1) ** 3 + 1.9 * (x - 1) ** 2;
  const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);
  const ell = (cx, cy, rx, ry, rot, th) => [cx + Math.cos(rot) * rx * Math.cos(th) - Math.sin(rot) * ry * Math.sin(th), cy + Math.sin(rot) * rx * Math.cos(th) + Math.cos(rot) * ry * Math.sin(th)];
  const hsl = (h, l = 68, a = 1) => `hsla(${((h % 360) + 360) % 360},100%,${l}%,${clamp(a, 0, 1).toFixed(3)})`;
  let g = null, FO = 1, S = null;
  const A = (a) => { g.globalAlpha = clamp(a, 0, 1) * FO; };
  const ADD = () => { g.globalCompositeOperation = 'lighter'; }, SRC = () => { g.globalCompositeOperation = 'source-over'; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const SPR = new Map();
  // 부드러운 빛 점 (가운데 흰빛 → 색 → 투명) — 입자는 모두 이 그림을 늘려 그림 (원·그림자보다 빠름)
  function glow(col, core = 0.22) {
    const k = col + '|' + core; let c = SPR.get(k); if (c) return c;
    const [cv, h] = mk(64, 64), gr = h.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(core, rgba(col, 0.92)); gr.addColorStop(Math.min(0.9, core * 2.4), rgba(col, 0.3)); gr.addColorStop(1, rgba(col, 0));
    h.fillStyle = gr; h.fillRect(0, 0, 64, 64); SPR.set(k, cv); return cv;
  }
  const dot = (spr, x, y, r, a) => { if (a <= 0.004 || r <= 0.15) return; A(a); g.drawImage(spr, x - r, y - r, r * 2, r * 2); };
  // 무지개 빛 점: 색상(도)을 30° 단위로 묶어 12가지 그림만 만들어 둠 (매 프레임 새 그림을 만들지 않게)
  function hslRgb(h, s, l) { h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (x) => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 0.5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255].map(Math.round); }
  const hueGlow = (h) => glow(hslRgb(Math.round((((h % 360) + 360) % 360) / 30) * 30, 100, 72), 0.25);
  // 엠블럼 실루엣을 한 색으로 (흰빛으로 달아오름 · 그을림)
  function tint(im, col) { const [c, h] = mk(im.width, im.height); h.drawImage(im, 0, 0); h.globalCompositeOperation = 'source-in'; h.fillStyle = col; h.fillRect(0, 0, c.width, c.height); return c; }
  const jit = (t, s) => [Math.sin(t * 97.3) * Math.cos(t * 41.1) * s, Math.cos(t * 83.7) * Math.sin(t * 57.9) * s];
  function pic(im, x, y, S2, a, sx = 1, rot = 0) {
    if (a <= 0.004 || S2 <= 1) return; A(a);
    if (sx === 1 && !rot) { g.drawImage(im, x - S2 / 2, y - S2 / 2, S2, S2); return; }
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(sx, 1); g.drawImage(im, -S2 / 2, -S2 / 2, S2, S2); g.restore();
  }
  function ring(x, y, r, w, col, a) { if (a <= 0.004 || r <= 0) return; A(a); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  function flash(col, a) { if (a <= 0.004) return; SRC(); A(a); g.fillStyle = col; g.fillRect(-50, -50, S.W + 100, S.H + 100); }
  function vignette(a, col = '#000000', r0 = 0.25) { if (a <= 0.004) return; const gr = g.createRadialGradient(S.cx, S.cy, Math.min(S.W, S.H) * r0, S.cx, S.cy, S.MX * 0.78); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 1)); SRC(); A(a); g.fillStyle = gr; g.fillRect(0, 0, S.W, S.H); }
  function star4(x, y, r, col, a, rot = 0) {
    if (a <= 0.004 || r <= 0.3) return; A(a); g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 8; i++) { const an = rot + i * Math.PI / 4, rr = i % 2 ? r * 0.18 : r; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
    g.closePath(); g.fill();
  }
  // 별 모양 빛살: n 갈래 긴 빛 + 그 사이 짧은 빛 (가운데 굵고 끝으로 가늘게)
  function spikes(x, y, L, w, rot, col, a, n = 4, short = 0.4) {
    if (a <= 0.004) return;
    for (let i = 0; i < n * 2; i++) {
      const an = rot + i * Math.PI / n, LL = L * (i % 2 ? short : 1), ww = w * (i % 2 ? 0.65 : 1), ex = x + Math.cos(an) * LL, ey = y + Math.sin(an) * LL;
      const gr = g.createLinearGradient(x, y, ex, ey); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.22, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
      A(a); g.fillStyle = gr; g.beginPath(); g.moveTo(x + Math.cos(an + Math.PI / 2) * ww, y + Math.sin(an + Math.PI / 2) * ww); g.lineTo(ex, ey); g.lineTo(x + Math.cos(an - Math.PI / 2) * ww, y + Math.sin(an - Math.PI / 2) * ww); g.closePath(); g.fill();
    }
  }
  // 별밭 (size² 그림 — 화면을 덮게 늘려 그림)
  function starfield(R, n, size, cols, amax = 0.95) {
    const [c, h] = mk(size, size);
    for (let i = 0; i < n; i++) { const x = R() * size, y = R() * size, s = R() ** 3 * 1.9 + 0.35; h.fillStyle = rgba(cols[(R() * cols.length) | 0], 0.25 + R() * (amax - 0.25)); h.beginPath(); h.arc(x, y, s, 0, TAU); h.fill(); }
    return c;
  }
  // 갈라지는 번개·금: 중간점을 옆으로 흔드는 선 (0,0)→(0,1), 옆 흔들림은 길이 비율
  function bolt(R, n = 6, amp = 0.16) {
    let P = [[0, 0], [0, 1]];
    for (let k = 0; k < n; k++) { const Q = [P[0]]; for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; Q.push([(x0 + x1) / 2 + (R() - 0.5) * amp * (y1 - y0) * 2.2, (y0 + y1) / 2], P[i]); } P = Q; }
    return P;
  }
  function drawBolt(P, x0, y0, x1, y1, col, w, a) {
    if (a <= 0.004) return; const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.beginPath(); P.forEach(([o, s], i) => { const x = x0 + dx * s + nx * o * L, y = y0 + dy * s + ny * o * L; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.lineCap = 'round'; g.lineJoin = 'round';
    A(a * 0.35); g.strokeStyle = col; g.lineWidth = w * 4; g.stroke();
    A(a); g.strokeStyle = '#ffffff'; g.lineWidth = w; g.stroke();
  }
  // 빛나는 금 (10_rankfx.js 의 금 자료 X.cracks — 같은 자리가 갈라짐)
  function cracks(X, ex, ey, S2, t0, t1, t, col, al = 1) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const C of X.cracks) {
      const ts = t0 + C.d * (t1 - t0) * 0.8, f = seg(t, ts, ts + 0.3); if (f <= 0) continue;
      const L = C.total * f; let acc = 0; g.beginPath(); g.moveTo(ex + C.pts[0][0] * S2, ey + C.pts[0][1] * S2);
      for (let j = 1; j < C.pts.length; j++) { const [x0, y0] = C.pts[j - 1], [x1, y1] = C.pts[j], sl = Math.hypot(x1 - x0, y1 - y0); if (acc + sl >= L) { const q = (L - acc) / sl; g.lineTo(ex + (x0 + (x1 - x0) * q) * S2, ey + (y0 + (y1 - y0) * q) * S2); break; } acc += sl; g.lineTo(ex + x1 * S2, ey + y1 * S2); }
      A(0.45 * al); g.strokeStyle = col; g.lineWidth = Math.max(4, S2 * 0.024); g.stroke();
      A(0.95 * al); g.strokeStyle = '#fff4e0'; g.lineWidth = Math.max(1.4, S2 * 0.006); g.stroke();
    }
  }
  // 엠블럼 위를 훑는 빛 시각들
  const sweeps = (S2, x, y, t, list) => { for (const ts of list) { const p = seg(t, ts, ts + 0.8); if (p > 0 && p < 1) S.shine(x, y, S2, p); } };

  // =================== 노바 — 초신성 ===================
  const NOVA = {
    id: 'nova', Tm: { title: 3.95, dur: 8.9 },
    P: { implode: 1.25, boom: 2.3, reveal: 2.4, settle: 3.25 },
    cues: [[0, 'gather'], [1.25, 'implode'], [2.3, 'boom'], [2.4, 'reveal'], [3.95, 'title']],
    text: { kick: '승급전 통과  ·  SUPERNOVA', grad: ['#ffffff', '#c8f3ff', '#5fd8ff'], glow: '#5fd8ff', chroma: true },
    build(X, R) {
      const sf = starfield(R, 560, 1024, ['#ffffff', '#ffffff', '#a8d8ff', '#cfe6ff', '#ffd9a8']);
      { const h = sf.getContext('2d'); h.globalCompositeOperation = 'lighter'; for (let i = 0; i < 24; i++) { const x = R() * 1024, y = R() * 1024, r = 90 + R() * 240, col = ['#1d4fb8', '#3a1d8a', '#0d6d8f', '#5a2a9a'][i % 4], gr = h.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, 0.1 + R() * 0.08)); gr.addColorStop(1, rgba(col, 0)); h.fillStyle = gr; h.fillRect(x - r, y - r, r * 2, r * 2); } }
      const tw = []; for (let i = 0; i < 40; i++) tw.push({ x: R(), y: R(), s: 1.2 + R() * 2.4, f: 1 + R() * 3, ph: R() * TAU, c: R() < 0.35 ? '#9fe0ff' : '#ffffff' });
      const streak = []; for (let i = 0; i < 150; i++) streak.push({ a: R() * TAU, r0: 0.5 + R() * 0.75, t0: R() * 1.5, du: 0.5 + R() * 0.55, w: 0.7 + R() * 1.6, c: R() < 0.4 ? '#ffffff' : R() < 0.75 ? '#8fe3ff' : '#7f9bff' });
      const disk = []; for (let i = 0; i < 100; i++) disk.push({ a: R() * TAU, r: 0.5 + R() * 0.32, sp: 0.8 + R() * 0.7, s: 0.7 + R() * 1.4, c: R() < 0.3 ? '#ffffff' : R() < 0.7 ? '#8fe3ff' : '#b48cff' });
      const shards = []; for (let i = 0; i < 44; i++) shards.push({ a: R() * TAU, s: 0.6 + R() ** 1.4 * 2.8, w: (R() - 0.5) * 8, sz: 0.022 + R() * 0.05, n: R() < 0.55 ? 6 : 4, life: 0.9 + R() * 1.2, el: 0.45 + R() * 0.55 });
      const [neb, nh] = mk(512, 512); nh.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 320; i++) { const a = R() * TAU, rr = 150 + (R() - 0.5) * 64 + Math.sin(a * 3 + 1.3) * 16, x = 256 + Math.cos(a) * rr, y = 256 + Math.sin(a) * rr, r = 12 + R() * 34, q = R(), col = q < 0.42 ? '#3fb8ff' : q < 0.66 ? '#7a5cff' : q < 0.82 ? '#ff5fd2' : '#c8f6ff', gr = nh.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, 0.15)); gr.addColorStop(1, rgba(col, 0)); nh.fillStyle = gr; nh.fillRect(x - r, y - r, r * 2, r * 2); }
      const met = []; for (let i = 0; i < 5; i++) met.push({ t0: 3.3 + i * 1.05 + R() * 0.5, x: 0.3 + R() * 0.7, y: -0.05 + R() * 0.25, ang: Math.PI * 0.75 + (R() - 0.5) * 0.3, len: 0.2 + R() * 0.12, sp: 1.3 + R() * 0.6 });
      const burst = []; for (let i = 0; i < 200; i++) { const q = R(); burst.push({ a: R() * TAU, s: 0.7 + R() ** 1.7 * 3.6, life: 1.1 + R() * 2.0, sz: 1 + R() * 2.8, c: q < 0.4 ? '#ffffff' : q < 0.75 ? '#8fe3ff' : '#8a7dff', d: R() * 0.12 }); }
      const orb = [0, 1, 2].map((j) => ({ rx: 0.78 + j * 0.08, ry: 0.2 + j * 0.06, rot: -0.4 + j * 0.65, sp: 1.25 - j * 0.2, ph: j * 2.1 }));
      return { sf, tw, streak, disk, shards, neb, met, burst, orb, wA: tint(X.imgA, '#eafcff'), wB: tint(X.imgB, '#ffffff') };
    },
    draw(X, t) {
      const D = X.td, P = NOVA.P, { W, H, cx, cy, E, MX } = S, fin = seg(t, 0, 0.5), dB = t - P.boom, dr = t - P.reveal;
      const im = eIn(seg(t, P.implode, P.boom - 0.04)), dim = dB < 0 ? im : 0;
      const shk = (dB >= 0 ? Math.min(W, H) * 0.045 * Math.exp(-dB * 4.2) : 4 * im), [jx, jy] = jit(t, shk);
      SRC(); A(fin); g.fillStyle = '#01020a'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(jx, jy);
      // 별밭: 다가가다가(모임) 오므라들고(빨려듦) 터지면 확 퍼짐
      const zoom = 1 + 0.1 * eInOut(seg(t, 0, P.implode)) - 0.07 * (dB < 0 ? im : 1) + 0.25 * eOut(seg(t, P.boom, P.boom + 1.8)) + 0.012 * Math.max(0, t - P.boom - 1.8);
      const ss = MX * 1.3 * zoom; A(fin * (1 - 0.55 * dim)); g.drawImage(D.sf, cx - ss / 2, cy - ss / 2, ss, ss);
      ADD();
      for (const p of D.tw) { const x = cx + (p.x - 0.5) * ss, y = cy + (p.y - 0.5) * ss; if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue; dot(glow(p.c, 0.16), x, y, p.s * 3, fin * (0.2 + 0.8 * Math.sin(t * p.f + p.ph) ** 2) * (1 - dim * 0.6)); }
      // 가운데 성운 빛 (이전 티어 보랏빛 → 터진 뒤 푸른빛)
      { const bk = seg(t, P.boom, P.boom + 1), c0 = mixc(X.a.c[1], '#3a8ff0', bk), gr = g.createRadialGradient(cx, cy, 0, cx, cy, MX * 0.72); gr.addColorStop(0, rgba(mixc(c0, '#000000', 0.45), 0.5)); gr.addColorStop(0.45, rgba(mixc(c0, '#000000', 0.8), 0.25)); gr.addColorStop(1, 'rgba(0,0,0,0)'); A(fin * (1 - 0.6 * dim)); g.fillStyle = gr; g.fillRect(-20, -20, W + 40, H + 40); }
      // ① 별빛이 빨려듦 (가운데로 갈수록 빨라지고 길어짐)
      if (dB < 0) {
        g.lineCap = 'round';
        for (const p of D.streak) {
          const k = seg(t, p.t0, p.t0 + p.du); if (k <= 0 || k >= 1) continue;
          const e = k * k, r = p.r0 * MX * (1 - e) + E * 0.05, a = p.a + e * 0.4, len = MX * (0.02 + 0.2 * e * p.r0);
          A(Math.sin(k * Math.PI) * 0.8); g.strokeStyle = p.c; g.lineWidth = p.w * (0.6 + e);
          g.beginPath(); g.moveTo(cx + Math.cos(a - 0.05) * (r + len), cy + Math.sin(a - 0.05) * (r + len)); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
        }
      }
      // ① 이전 엠블럼 + 강착 원반(뒤 반·앞 반) + 중력 렌즈 고리 → 한 점으로 오그라들며 하얗게
      const disk = (front) => {
        const dk = seg(t, 0.35, 1.0) * (1 - seg(t, P.boom - 0.12, P.boom)); if (dk <= 0) return;
        const shrink = 1 - 0.8 * im, spin = t * 1.1 + 9 * eIn(seg(t, P.implode, P.boom));
        for (const p of D.disk) { const th = p.a + spin * p.sp; if ((Math.sin(th) > 0) !== front) continue; const [x, y] = ell(cx, cy, E * p.r * shrink, E * p.r * shrink * 0.26, -0.32, th); dot(glow(p.c, 0.2), x, y, p.s * Math.max(1.2, E / 220) * (1 + im), dk * 0.85); }
      };
      if (dB < 0) {
        const k = eOut(seg(t, 0, 0.6)), S2 = E * lerp(0.84, 1, k) * (1 - 0.94 * im), bob = Math.sin(t * 2) * E * 0.012 * (1 - im);
        ADD(); disk(false);
        ring(cx, cy + bob, E * (0.6 - 0.48 * im), 1.2 + 4 * im, '#cdf3ff', 0.45 * seg(t, 0.5, 1.1));
        dot(glow('#8fe3ff', 0.2), cx, cy + bob, E * (0.5 + 0.1 * im), 0.32 * k);
        SRC(); pic(X.imgA, cx, cy + bob, S2, k); pic(D.wA, cx, cy + bob, S2, Math.min(1, im * 1.5) * k);
        ADD(); dot(glow('#ffffff', 0.25), cx, cy + bob, E * (0.06 + 0.42 * im), seg(t, P.implode - 0.3, P.boom) * 0.95);
        disk(true);
        const ck = seg(t, P.boom - 0.32, P.boom); if (ck > 0 && ck < 1) ring(cx, cy, E * 0.95 * (1 - eIn(ck)), 2 + 6 * ck, '#bff4ff', 0.85 * ck);   // 터지기 직전 안으로 조여드는 고리
      }
      // ② 초신성
      if (dB >= 0) {
        ADD();
        for (const [d0, sp, col, w0] of [[0, 1, '#c8f6ff', 0.085], [0.1, 0.7, '#5f8cff', 0.06], [0.22, 0.48, '#b48cff', 0.05]]) {   // 일렁이는 껍질 3겹
          const p = seg(dB, d0, d0 + 1.7); if (p <= 0 || p >= 1) continue;
          const r = E * 0.15 + eOut(p) * MX * 0.9 * sp, a = (1 - p) ** 1.4, sp2 = glow(col, 0.14), bw = MX * w0 * (0.8 + 0.7 * (1 - p));
          ring(cx, cy, r, bw * 1.3, col, a * 0.2);   // 두꺼운 빛 띠 (한 번에 — 큰 빛 점을 수십 개 겹치는 것보다 가벼움)
          for (let i = 0; i < 20; i++) { const th = i / 20 * TAU + d0 * 7 + t * 0.3, rr = r * (1 + 0.07 * Math.sin(th * 5 + t * 3 + d0 * 9)); dot(sp2, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, bw * 0.9, a * 0.3); }   // 일렁이는 덩어리
          ring(cx, cy, r, 2 + 9 * (1 - p), col, a * 0.75);
        }
        // 가로 렌즈 빛 (화면을 가로지르는 푸른 선)
        const lf = Math.exp(-dB * 1.25);
        if (lf > 0.01) { const hh = Math.max(2, E * 0.012), gr = g.createLinearGradient(cx - W * 0.6, 0, cx + W * 0.6, 0); gr.addColorStop(0, rgba('#5fd8ff', 0)); gr.addColorStop(0.5, rgba('#ffffff', 1)); gr.addColorStop(1, rgba('#5fd8ff', 0)); g.fillStyle = gr; A(lf); g.fillRect(cx - W * 0.6, cy - hh / 2, W * 1.2, hh); A(lf * 0.35); g.fillRect(cx - W * 0.6, cy - hh * 3.5, W * 1.2, hh * 7); }
        // 육각 고스트 (렌즈에 비친 빛) — 가운데를 지나는 비스듬한 줄 위
        const gk = Math.exp(-dB * 0.8) * seg(dB, 0, 0.08);
        for (const [k, rr, col] of [[-0.6, 0.05, '#5fd8ff'], [-0.28, 0.028, '#b48cff'], [0.3, 0.045, '#5fd8ff'], [0.62, 0.085, '#7cffea'], [0.95, 0.03, '#ffffff']]) {
          const x = cx + W * 0.42 * k, y = cy + H * 0.3 * k, r = MX * rr; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath();
          A(gk * 0.2); g.fillStyle = col; g.fill(); A(gk * 0.4); g.strokeStyle = col; g.lineWidth = 1; g.stroke();
        }
        // 수정 조각: 육각·마름모 결정이 꼬리를 끌며 날아감
        for (const p of D.shards) {
          if (dB > p.life) continue;
          const k = (1 - Math.exp(-2.2 * dB)) / 2.2, r = E * 0.08 + p.s * E * k * 1.25, x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r + E * 0.08 * dB * dB, a = (1 - dB / p.life) ** 1.2, sz = E * p.sz, tl = sz * 4 * Math.exp(-dB * 1.5);
          A(a * 0.3); g.strokeStyle = '#8fe3ff'; g.lineWidth = sz * 0.5; g.beginPath(); g.moveTo(x - Math.cos(p.a) * tl, y - Math.sin(p.a) * tl); g.lineTo(x, y); g.stroke();
          g.save(); g.translate(x, y); g.rotate(p.a + p.w * k); g.scale(1, p.el); g.beginPath(); for (let i = 0; i < p.n; i++) { const aa = i * TAU / p.n; g.lineTo(Math.cos(aa) * sz, Math.sin(aa) * sz); } g.closePath();
          const gr = g.createLinearGradient(-sz, -sz, sz, sz); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#8fe3ff'); gr.addColorStop(1, 'rgba(60,90,255,0.15)');
          A(a * 0.9); g.fillStyle = gr; g.fill(); A(a); g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.stroke(); g.restore();
        }
      }
      // ③ 새 엠블럼: 성운 고리 · 회절 빛살 · 도는 별 · 터지는 빛 · 유성
      if (dr >= 0) {
        const al = seg(dr, 0, 0.12), sc = 0.2 + 0.8 * eBack(seg(dr, 0, 0.55)), S2 = E * sc * (1 + 0.01 * Math.sin(t * 2.3));
        const orbit = (front) => {
          const k = seg(dr, 0.3, 1.2); if (k <= 0) return;
          for (const o of D.orb) for (let q = 0; q < 14; q++) {
            const th = t * o.sp + o.ph - q * 0.05; if ((Math.sin(th) > 0) !== front) continue;
            const [x, y] = ell(cx, cy, E * o.rx, E * o.ry, o.rot, th), f = 1 - q / 14;
            if (q === 0) { dot(glow('#8fe3ff', 0.2), x, y, E * 0.05, k * 0.8); star4(x, y, E * 0.045, '#ffffff', k, t * 2); } else dot(glow('#8fe3ff', 0.2), x, y, E * 0.014 * (0.4 + f), k * f * 0.8);
          }
        };
        ADD();
        const nk = seg(dr, 0.05, 1.0), ns = E * (1.0 + 0.55 * eOut(seg(dr, 0, 3.5)));
        if (nk > 0) { A(0.8 * nk); g.save(); g.translate(cx, cy); g.rotate(t * 0.06); g.drawImage(D.neb, -ns, -ns, ns * 2, ns * 2); g.restore(); }
        spikes(cx, cy, MX * 0.55 * (0.85 + 0.15 * Math.sin(t * 1.7)) * (0.6 + 0.4 * eOut(seg(dr, 0, 1))), E * 0.028, t * 0.04, '#8fe3ff', seg(dr, 0, 0.3) * 0.8, 4, 0.42);
        dot(glow('#5fd8ff', 0.18), cx, cy, E * 0.95, al * 0.42);
        orbit(false);
        SRC(); pic(X.imgB, cx, cy, S2, al); pic(D.wB, cx, cy, S2, Math.exp(-dr * 2.4) * 0.95);
        sweeps(S2, cx, cy, t, [P.settle, NOVA.Tm.title + 1.4, NOVA.Tm.title + 3.2]);
        ADD(); orbit(true);
        for (const p of D.burst) { const d = dr - p.d; if (d <= 0 || d > p.life) continue; const k = (1 - Math.exp(-2.3 * d)) / 2.3, r = p.s * E * k * 1.15 + E * 0.12; dot(glow(p.c, 0.2), cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r + E * 0.1 * d * d, p.sz * Math.max(1.4, E / 180) * (0.6 + 0.4 * (1 - d / p.life)), 1 - d / p.life); }
        g.lineCap = 'round';
        for (const m of D.met) {   // 유성
          const d = t - m.t0; if (d < 0 || d > 0.75) continue;
          const k = d / 0.75, dx = Math.cos(m.ang), dy = Math.sin(m.ang), hx = m.x * W + dx * m.sp * d * MX * 0.7, hy = m.y * H + dy * m.sp * d * MX * 0.7, L = m.len * MX, gr = g.createLinearGradient(hx - dx * L, hy - dy * L, hx, hy);
          gr.addColorStop(0, 'rgba(143,227,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)'); A(Math.sin(k * Math.PI)); g.strokeStyle = gr; g.lineWidth = 2; g.beginPath(); g.moveTo(hx - dx * L, hy - dy * L); g.lineTo(hx, hy); g.stroke();
          dot(glow('#bff4ff', 0.25), hx, hy, 7, Math.sin(k * Math.PI));
        }
      }
      g.restore();
      if (dB >= 0) flash('#e8fbff', 0.92 * Math.exp(-dB * 5));
      vignette(0.65 * dim);
    },
  };

  // =================== 셀레스티얼 — 천상의 문 ===================
  // 깃털 그림 (오른쪽을 향함 · 흰 금빛)
  function featherSpr() {
    if (SPR.has('feather')) return SPR.get('feather');
    const [c, h] = mk(192, 56); h.translate(6, 28);
    const vane = () => { h.beginPath(); h.moveTo(0, 0); h.bezierCurveTo(40, -22, 120, -24, 182, -2); h.bezierCurveTo(126, 13, 46, 17, 0, 0); h.closePath(); };
    vane(); const gr = h.createLinearGradient(0, -20, 0, 16); gr.addColorStop(0, '#fffdf6'); gr.addColorStop(0.55, '#fff2d0'); gr.addColorStop(1, '#efcd86'); h.fillStyle = gr; h.fill();
    h.save(); vane(); h.clip(); h.strokeStyle = 'rgba(200,150,70,0.3)'; h.lineWidth = 1;   // 깃가지
    for (let i = 1; i < 18; i++) { const x = i * 10; h.beginPath(); h.moveTo(x, 0); h.lineTo(x + 12, -16); h.moveTo(x, 0); h.lineTo(x + 11, 14); h.stroke(); }
    h.restore();
    vane(); h.strokeStyle = 'rgba(186,132,52,0.8)'; h.lineWidth = 1.6; h.stroke();   // 가장자리 (겹쳐도 한 장씩 보이게)
    h.strokeStyle = 'rgba(255,255,255,0.95)'; h.lineWidth = 1.8; h.beginPath(); h.moveTo(-4, 0.5); h.quadraticCurveTo(90, -3, 180, -2); h.stroke();   // 깃대
    SPR.set('feather', c); return c;
  }
  function featherAt(x, y, L, rot, a) { if (a <= 0.004) return; const f = featherSpr(); A(a); g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(f, -L * 0.03, -L * 0.15, L, L * 0.29); g.restore(); }
  const CEL = {
    id: 'celestial', Tm: { title: 4.15, dur: 9.1 },
    P: { lift: 1.05, gate: 2.2, desc: 2.25, land: 3.2, wings: 2.75 },
    cues: [[0, 'gather'], [1.05, 'lift'], [2.2, 'gate'], [3.2, 'land'], [4.15, 'title']],
    text: { kick: '승급전 통과  ·  ASCENSION', grad: ['#ffffff', '#fff2c4', '#e2ac3c'], glow: '#ffd77a' },
    build(X, R) {
      // 구름 띠 (1024×256): 부드러운 흰 덩어리를 겹친 모양을 만들고 → 위는 밝게·아래는 그늘로 물들이고 → 꼭대기에 빛을 얹음
      const cloud = (top, bot, n, hi) => {
        const [c, h] = mk(1024, 256);
        for (let i = 0; i < n; i++) { const x = R() * 1150 - 60, y = 70 + R() * 140, r = 48 + R() * 110; h.save(); h.translate(x, y); h.scale(1, 0.62); const gr = h.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); h.fillStyle = gr; h.fillRect(-r, -r, r * 2, r * 2); h.restore(); }
        const bg = h.createLinearGradient(0, 150, 0, 256); bg.addColorStop(0, 'rgba(255,255,255,0)'); bg.addColorStop(1, 'rgba(255,255,255,0.95)'); h.fillStyle = bg; h.fillRect(0, 150, 1024, 106);
        h.globalCompositeOperation = 'source-in'; const cg = h.createLinearGradient(0, 30, 0, 256); cg.addColorStop(0, top); cg.addColorStop(1, bot); h.fillStyle = cg; h.fillRect(0, 0, 1024, 256);
        h.globalCompositeOperation = 'source-atop'; for (let i = 0; i < n * 0.5; i++) { const x = R() * 1100 - 40, y = 60 + R() * 110, r = 30 + R() * 70, gr = h.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(hi, 0.4)); gr.addColorStop(1, rgba(hi, 0)); h.fillStyle = gr; h.fillRect(x - r, y - r, r * 2, r * 2); }
        return c;
      };
      const cBack = cloud('#e9b9a2', '#4a2c4c', 80, '#ffe6c8'), cFront = cloud('#fff2dc', '#a87878', 90, '#ffffff'), cTop = cloud('#a98fc4', '#140f2c', 70, '#e0d0f4');
      const sf = starfield(R, 160, 512, ['#ffffff', '#fff2c4'], 0.7);
      const motes = []; for (let i = 0; i < 140; i++) motes.push({ x: (R() - 0.5) * 0.72, y: (R() - 0.5) * 0.8, vy: 0.16 + R() * 0.32, sw: R() * TAU, sf: 1 + R() * 2, sz: 0.8 + R() * 2.2, life: 1.2 + R() * 1.3, c: R() < 0.35 ? '#ffffff' : R() < 0.7 ? '#ffe39a' : '#f3c86a' });
      const fall = []; for (let i = 0; i < 20; i++) fall.push({ x: R(), t0: R() * 10 - 2, sp: 0.05 + R() * 0.06, sw: 0.02 + R() * 0.04, f: 0.5 + R() * 0.9, ph: R() * TAU, L: 0.07 + R() * 0.06, rot: R() * TAU, front: R() < 0.4 });
      const fburst = []; for (let i = 0; i < 14; i++) fburst.push({ a: -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.7, s: 0.5 + R() * 0.9, spin: (R() - 0.5) * 4, L: 0.07 + R() * 0.06, ph: R() * TAU });
      const dust = []; for (let i = 0; i < 46; i++) dust.push({ x: R(), sp: 0.03 + R() * 0.06, ph: R() * 10, f: 0.5 + R() * 1.2, sz: 0.8 + R() * 1.8, off: R() });
      // 날개: 줄마다 깃털 [접힌 각, 편 각, 길이(E), 뿌리 위치 0~1 (어깨→손목)]
      const wing = [];
      for (let i = 0; i < 9; i++) wing.push({ row: 0, open: -1.0 + i * 0.1, fold: 1.22 + i * 0.03, L: 0.78 - i * 0.026, base: 1 });
      for (let i = 0; i < 8; i++) wing.push({ row: 1, open: -0.08 + i * 0.09, fold: 1.3 + i * 0.02, L: 0.5 - i * 0.016, base: 0.95 - i * 0.11 });
      for (let i = 0; i < 8; i++) wing.push({ row: 2, open: -0.75 + i * 0.16, fold: 1.3, L: 0.3 - i * 0.01, base: 0.12 + i * 0.1 });
      wing.sort((a, b) => a.row - b.row);
      const [moon, mh] = mk(256, 256); { const gr = mh.createRadialGradient(110, 110, 10, 128, 128, 120); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#f3d98b'); mh.fillStyle = gr; mh.beginPath(); mh.arc(128, 128, 118, 0, TAU); mh.fill(); mh.globalCompositeOperation = 'destination-out'; mh.beginPath(); mh.arc(168, 104, 108, 0, TAU); mh.fill(); }
      return { cBack, cFront, cTop, sf, motes, fall, fburst, dust, wing, moon, wA: tint(X.imgA, '#ffe7a8'), wB: tint(X.imgB, '#ffffff') };
    },
    draw(X, t) {
      const D = X.td, P = CEL.P, { W, H, cx, cy, E, MX } = S, fin = seg(t, 0, 0.6), dG = t - P.gate, dL = t - P.land;
      const part = eInOut(seg(t, P.gate - 0.25, P.gate + 1.0)), lift = seg(t, P.lift, P.gate);
      const shk = dL >= 0 ? Math.min(W, H) * 0.012 * Math.exp(-dL * 5) : 0, [jx, jy] = jit(t, shk);
      // 하늘: 남빛 위 → 노을 지평선 (문이 열리면 따뜻하게 밝아짐)
      const sky = g.createLinearGradient(0, 0, 0, H), wk = seg(t, P.gate - 0.2, P.gate + 1.2);
      sky.addColorStop(0, rgba(mixc('#070a22', '#1a1638', wk), 1)); sky.addColorStop(0.45, rgba(mixc('#251f4a', '#4a3560', wk), 1)); sky.addColorStop(0.74, rgba(mixc('#80492a', '#c4823e', wk), 1)); sky.addColorStop(1, rgba(mixc('#2a160c', '#4a2a14', wk), 1));
      SRC(); A(fin); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.save(); g.translate(jx, jy);
      A(fin * 0.8 * (1 - wk * 0.6)); g.drawImage(D.sf, 0, 0, W, H * 0.6);
      ADD();
      dot(glow('#ffd88a', 0.12), cx, cy + E * 0.1, MX * 0.55, fin * (0.35 + 0.35 * wk));
      // 빛줄기 (위에서 비스듬히 · 흔들림) — 문이 열리면 진해짐
      for (let i = 0; i < 7; i++) {
        const sx = cx + (i - 3) * W * 0.07 + Math.sin(t * 0.4 + i) * W * 0.01, ang = (i - 3) * 0.13 + Math.sin(t * 0.3 + i * 1.7) * 0.03, L = H * 1.15, w0 = W * 0.012, w1 = W * (0.05 + (i % 3) * 0.02);
        const gr = g.createLinearGradient(sx, 0, sx + Math.sin(ang) * L, L); gr.addColorStop(0, rgba('#fff0c0', 0.5)); gr.addColorStop(1, rgba('#fff0c0', 0));
        A(fin * (0.16 + 0.3 * wk) * (0.7 + 0.3 * Math.sin(t * 0.9 + i * 2.1))); g.fillStyle = gr; g.beginPath(); g.moveTo(sx - w0, -10); g.lineTo(sx + w0, -10); g.lineTo(sx + Math.sin(ang) * L + w1, L); g.lineTo(sx + Math.sin(ang) * L - w1, L); g.closePath(); g.fill();
      }
      // 구름: 뒤 · 위 천장(문이 열리며 양쪽으로 갈라짐)
      SRC();
      const cw = W * 1.5, chB = H * 0.34, hy = cy + E * 0.42, drift = (t * W * 0.012) % cw;
      A(fin * 0.9); for (const ox of [-drift, cw - drift]) g.drawImage(D.cBack, ox - W * 0.25, hy - chB * 0.3, cw, chB);
      // 구름을 가운데에서 좌우 반쪽으로 나눠 그림 (gap 만큼 벌어짐) — 그림의 반쪽만 잘라 그려 자르기(clip) 없이
      const half = (img, y, h, a, gap, flip) => {
        const sxOf = (x) => clamp((x + W * 0.25) / cw * img.width, 0, img.width);
        for (const sd of [-1, 1]) {
          const s0 = sxOf(sd < 0 ? -50 : cx), s1 = sxOf(sd < 0 ? cx : W + 50); if (s1 - s0 < 1) continue;
          g.save(); g.translate(sd * gap, 0); if (flip) { g.translate(0, y + h / 2); g.scale(1, -1); g.translate(0, -(y + h / 2)); }
          A(a); g.drawImage(img, s0, 0, s1 - s0, img.height, s0 / img.width * cw - W * 0.25, y, (s1 - s0) / img.width * cw, h); g.restore();
        }
      };
      half(D.cTop, -H * 0.12, H * 0.36, fin * 0.95, part * W * 0.42, true);
      // 문 틈의 빛 (갈라진 사이)
      ADD();
      if (part > 0) { const gw = part * W * 0.42, gr = g.createLinearGradient(cx - gw, 0, cx + gw, 0); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.5, rgba('#fff6d8', 0.8 * part)); gr.addColorStop(1, 'rgba(255,240,200,0)'); A(1); g.fillStyle = gr; g.fillRect(cx - gw, -10, gw * 2, H * 0.24); }
      // 빛기둥 (문이 열리면 위에서 내려와 새 엠블럼을 감쌈)
      const pl = seg(t, P.gate - 0.05, P.gate + 0.35) * (1 - 0.6 * seg(t, P.land + 0.4, P.land + 2.2));
      if (pl > 0) {
        const pw = E * (0.22 + 0.25 * pl), yb = lerp(0, cy + E * 0.4, eOut(seg(t, P.gate, P.gate + 0.4))), gr = g.createLinearGradient(cx - pw, 0, cx + pw, 0);
        gr.addColorStop(0, 'rgba(255,230,160,0)'); gr.addColorStop(0.35, rgba('#ffe39a', 0.3 * pl)); gr.addColorStop(0.5, rgba('#fff8e4', 0.6 * pl)); gr.addColorStop(0.65, rgba('#ffe39a', 0.3 * pl)); gr.addColorStop(1, 'rgba(255,230,160,0)');
        A(1); g.fillStyle = gr; g.fillRect(cx - pw, -10, pw * 2, yb + 10);
      }
      // 떨어지는 깃털 (뒤쪽)
      const fallF = (front) => { for (const f of D.fall) { if (f.front !== front) continue; const d = t - f.t0; if (d < 0) continue; const y = -H * 0.08 + d * f.sp * H * 1.3, x = f.x * W + Math.sin(d * f.f * 2 + f.ph) * f.sw * W; if (y > H + 30) continue; featherAt(x, y, f.L * E * 1.6, f.rot + Math.sin(d * f.f * 2.6 + f.ph) * 0.9, fin * 0.8); } };
      SRC(); fallF(false);
      // ① 빛의 고리(만다라)가 위에서 내려와 이전 엠블럼을 감쌈 → 문이 열리면 퍼지며 사라짐
      const hk = seg(t, 0.15, 0.9) * (1 - seg(t, P.gate, P.gate + 0.6)), hy0 = cy - E * 0.9 * (1 - eOut(seg(t, 0.15, 1.0))), hs = 1 + 0.6 * eOut(seg(t, P.gate, P.gate + 0.6));
      if (hk > 0) {
        ADD(); g.save(); g.translate(cx, hy0); g.scale(hs, hs);
        ring(0, 0, E * 0.62, 1.5, '#ffe39a', 0.7 * hk); ring(0, 0, E * 0.7, 1, '#ffe39a', 0.5 * hk); ring(0, 0, E * 0.48, 1, '#fff6d8', 0.35 * hk);
        g.rotate(t * 0.2); A(0.65 * hk); g.strokeStyle = '#ffe39a'; g.lineWidth = 1.2; g.beginPath();
        for (let i = 0; i < 48; i++) { const a = i * TAU / 48, l = i % 4 ? 0.025 : 0.06; g.moveTo(Math.cos(a) * E * 0.62, Math.sin(a) * E * 0.62); g.lineTo(Math.cos(a) * E * (0.62 + l), Math.sin(a) * E * (0.62 + l)); }
        g.stroke();
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; star4(Math.cos(a) * E * 0.66, Math.sin(a) * E * 0.66, E * 0.022, '#fff6d8', hk * 0.9, 0); }
        g.restore();
      }
      // ① 이전 엠블럼: 아래부터 금빛 알갱이로 풀려 올라감 (풀리는 선이 아래에서 위로)
      if (t < P.gate + 0.1) {
        const k = eOut(seg(t, 0, 0.6)), S2 = E * lerp(0.84, 1, k), ey = cy + Math.sin(t * 1.8) * E * 0.012 - E * 0.06 * lift, yl = ey + S2 * 0.5 - S2 * lift;
        dot(glow('#ffe39a', 0.15), cx, ey, E * 0.6, 0.35 * k);
        g.save(); g.beginPath(); g.rect(cx - S2, ey - S2, S2 * 2, Math.max(0, yl - (ey - S2))); g.clip();
        SRC(); pic(X.imgA, cx, ey, S2, k); ADD(); pic(D.wA, cx, ey, S2, 0.15 + 0.5 * lift); g.restore();
        if (lift > 0 && lift < 1) { const bw = S2 * 0.42, gr = g.createLinearGradient(cx - bw, 0, cx + bw, 0); gr.addColorStop(0, 'rgba(255,227,154,0)'); gr.addColorStop(0.5, 'rgba(255,250,230,0.95)'); gr.addColorStop(1, 'rgba(255,227,154,0)'); ADD(); A(0.9); g.fillStyle = gr; g.fillRect(cx - bw, yl - 3, bw * 2, 6); for (let i = 0; i < 7; i++) dot(glow('#ffe39a', 0.2), cx + (i - 3) / 3 * bw * 0.8, yl, E * 0.035, 0.6); }
        ADD();
        for (const m of D.motes) {
          const tb = P.lift + (0.5 - m.y) * (P.gate - P.lift), d = t - tb; if (d <= 0 || d > m.life) continue;
          const x = cx + m.x * S2 + Math.sin(d * m.sf + m.sw) * E * 0.04 * d, y = ey + m.y * S2 - d * m.vy * E - d * d * E * 0.1;
          dot(glow(m.c, 0.22), x, y, m.sz * Math.max(1.3, E / 200), (1 - d / m.life) * Math.min(1, d * 6));
        }
      }
      // ③ 새 엠블럼: 빛기둥을 타고 천천히 내려앉음 · 날개가 펼쳐짐 · 머리 위 고리 · 초승달
      if (t >= P.desc) {
        const kd = seg(t, P.desc, P.land), ey = lerp(-E * 0.7, cy, eOut(kd)) + (dL > 0 ? Math.sin(dL * 1.6) * E * 0.01 : 0), S2 = E * (0.9 + 0.1 * eOut(kd)), al = seg(t, P.desc, P.desc + 0.2);
        const mk2 = seg(t, P.land, P.land + 1.6);
        if (mk2 > 0) { SRC(); A(0.28 * mk2); const ms = E * 1.9; g.save(); g.translate(cx + E * 0.08, cy - E * 0.05 - E * 0.08 * mk2); g.rotate(-0.5); g.drawImage(D.moon, -ms / 2, -ms / 2, ms, ms); g.restore(); }
        // 날개 (펴는 중 · 다 펴면 천천히 날갯짓)
        const u = eOut(seg(t, P.wings, P.wings + 1.0)), flap = Math.sin((t - P.wings) * 1.7) * 0.05 * u, wsc = Math.min(1, (W * 0.5) / (E * 1.15));
        if (u > 0) {
          for (const sd of [-1, 1]) {
            g.save(); g.translate(cx + sd * E * 0.16, ey - E * 0.04); g.scale(sd * wsc, wsc);
            ADD(); dot(glow('#ffe7a8', 0.1), E * 0.42, -E * 0.18, E * 0.62, 0.42 * u);   // 날개 뒤 빛
            const wr = lerp(1.1, -0.5, u) + flap, wl = E * 0.26 * (0.55 + 0.45 * u), wx = Math.cos(wr) * wl, wy = Math.sin(wr) * wl;
            SRC();
            for (const f of D.wing) {   // 긴 깃(뒤) → 둘째 깃 → 덮깃(앞) 순서로 겹쳐 비늘처럼
              const bx = wx * f.base, by = wy * f.base, rot = lerp(f.fold, f.open, u) + flap * (1 + f.row * 0.3), L = E * f.L * (0.55 + 0.45 * u);
              featherAt(bx, by, L, rot, 0.95 * u);
            }
            ADD(); for (const f of D.wing) if (f.row === 0) featherAt(wx, wy, E * f.L * (0.55 + 0.45 * u), lerp(f.fold, f.open, u) + flap, 0.22 * u);   // 긴 깃 위로 빛
            g.restore();
          }
        }
        ADD(); dot(glow('#fff1c4', 0.16), cx, ey, E * 0.9, 0.45 * al);
        SRC(); pic(X.imgB, cx, ey, S2, al); pic(D.wB, cx, ey, S2, (1 - seg(t, P.land - 0.1, P.land + 1.2)) * 0.5 * al);
        if (dL > 0) sweeps(S2, cx, ey, t, [P.land + 0.3, CEL.Tm.title + 1.5, CEL.Tm.title + 3.3]);
        // 머리 위 빛의 고리
        const hk2 = seg(t, P.land - 0.1, P.land + 0.6);
        if (hk2 > 0) { ADD(); const hx = cx, hy2 = ey - S2 * 0.56 - E * 0.02 * Math.sin(t * 2), rx = E * 0.24, ry = E * 0.06; A(0.4 * hk2); g.strokeStyle = '#ffe39a'; g.lineWidth = E * 0.03; g.beginPath(); g.ellipse(hx, hy2, rx, ry, 0, 0, TAU); g.stroke(); A(0.95 * hk2); g.strokeStyle = '#fffaf0'; g.lineWidth = Math.max(2, E * 0.008); g.stroke(); }
        // 내려앉는 충격(부드러운 금빛 고리) · 흩날리는 깃털
        if (dL >= 0) {
          ADD(); for (const [d0, c] of [[0, '#fff6d8'], [0.15, '#ffe39a']]) { const p = seg(dL, d0, d0 + 1.2); if (p > 0 && p < 1) ring(cx, ey, E * 0.35 + eOut(p) * MX * 0.55, 6 * (1 - p) + 1, c, (1 - p) * 0.8); }
          SRC(); for (const f of D.fburst) { if (dL > 3.2) break; const k = (1 - Math.exp(-2.5 * dL)) / 2.5, x = cx + Math.cos(f.a) * f.s * E * k * 1.6 + Math.sin(dL * 2 + f.ph) * E * 0.04 * dL, y = ey + Math.sin(f.a) * f.s * E * k * 1.6 + E * 0.16 * dL * dL; featherAt(x, y, f.L * E * 1.6, f.a + f.spin * k + Math.sin(dL * 3 + f.ph) * 0.6, (1 - dL / 3.2) * 0.9); }
        }
        if (dG > 0 && dG < 0.9) { ADD(); dot(glow('#fff6d8', 0.15), cx, cy, MX * 0.55, 0.32 * (1 - dG / 0.9)); }
      }
      SRC(); fallF(true);
      // 앞 구름 (문이 열리면 살짝 갈라짐)
      const chF = H * 0.3; half(D.cFront, H - chF * 0.78, chF, fin, part * W * 0.08, false);
      // 떠오르는 금빛 먼지
      ADD(); for (const e of D.dust) { const y = H * 1.05 - ((t * e.sp * H + e.off * H * 1.2) % (H * 1.2)), x = e.x * W + Math.sin(t * e.f + e.ph) * 14; dot(glow('#ffe39a', 0.25), x, y, e.sz * 2.4, fin * 0.6 * (0.3 + 0.7 * Math.sin(t * 3 + e.ph) ** 2)); }
      g.restore();
      if (dG >= 0) flash('#fff4d6', 0.45 * Math.exp(-dG * 3.5));
    },
  };

  // =================== 이클립스 — 개기일식 ===================
  const ECL = {
    id: 'eclipse', Tm: { title: 4.05, dur: 9.0 },
    P: { cover: 0.35, total: 1.75, burn: 1.0, burnEnd: 2.3, diamond: 2.42, rise: 2.5, land: 3.3 },
    cues: [[0, 'gather'], [1.0, 'burn'], [1.75, 'total'], [2.42, 'diamond'], [3.3, 'land'], [4.05, 'title']],
    text: { kick: '승급전 통과  ·  TOTALITY', grad: ['#fff1e6', '#ff8a5a', '#c8140c'], glow: '#ff3a1a', flicker: true },
    build(X, R) {
      const streamers = []; for (let i = 0; i < 28; i++) streamers.push({ a: (i + (R() - 0.5) * 0.7) / 28 * TAU, L: 0.35 + R() ** 2 * 1.1, w: 0.05 + R() * 0.09, ph: R() * TAU, f: 0.6 + R() * 1.4 });
      const prom = []; for (let i = 0; i < 5; i++) prom.push({ a: R() * TAU, h: 0.08 + R() * 0.14, w: 0.1 + R() * 0.16, t0: 1.9 + R() * 0.8 });
      const burnP = []; for (let i = 0; i < 160; i++) { const r = 0.05 + R() * 0.55; burnP.push({ th: R() * TAU, r, vy: 0.12 + R() * 0.3, sw: R() * TAU, f: 1 + R() * 2.5, sz: 0.7 + R() * 2, life: 0.9 + R() * 1.4, ash: R() < 0.3 }); }
      const rift = []; for (let i = 0; i <= 30; i++) rift.push([i / 30 * 2 - 1, (R() - 0.5) * (i % 3 === 0 ? 1 : 0.5)]);
      const stream = []; for (let i = 0; i < 150; i++) stream.push({ x: (R() - 0.5) * 0.55, t0: ECL.P.rise - 0.1 + R() * 1.6, vy: 0.5 + R() * 0.9, sz: 0.8 + R() * 2.2, life: 0.6 + R() * 0.9, sw: R() * TAU });
      const sparks = []; for (let i = 0; i < 150; i++) { const q = R(); sparks.push({ a: R() * TAU, s: 0.6 + R() ** 1.6 * 3.2, life: 0.9 + R() * 1.7, sz: 1 + R() * 2.6, c: q < 0.3 ? '#ffffff' : q < 0.7 ? '#ff7a2a' : '#ff2a12', d: R() * 0.1 }); }
      const embers = []; for (let i = 0; i < 56; i++) embers.push({ x: R(), sp: 0.05 + R() * 0.09, ph: R() * 10, f: 0.5 + R() * 1.4, sz: 0.6 + R() * 1.8, off: R() });
      const bolts = [0, 1, 2].map((i) => ({ P: bolt(R, 6, 0.2), x: (i - 1) * 0.34 + (R() - 0.5) * 0.1, t: ECL.P.land - 0.04 + i * 0.09 }));
      const skyB = [0, 1, 2, 3].map((i) => ({ P: bolt(R, 5, 0.24), x0: R(), x1: R(), y1: 0.25 + R() * 0.3, t: ECL.P.total + 0.15 + i * 0.22 + R() * 0.1 }));
      const [ec, eh] = mk(512, 512), [bc, bh] = mk(512, 512);   // 타는 엠블럼 · 타는 가장자리를 그리는 곳
      return { streamers, prom, burnP, rift, stream, sparks, embers, bolts, skyB, ec, eh, bc, bh, char: tint(X.imgA, '#1a0402'), hotA: tint(X.imgA, '#ff6a2a'), hotB: tint(X.imgB, '#ffb08a') };
    },
    draw(X, t) {
      const D = X.td, P = ECL.P, { W, H, cx, cy, E, MX } = S, fin = seg(t, 0, 0.5), dD = t - P.diamond, dL = t - P.land;
      const cov = eInOut(seg(t, P.cover, P.total)), tot = seg(t, P.total - 0.05, P.total + 0.35);
      const shk = (dL >= 0 ? Math.min(W, H) * 0.04 * Math.exp(-dL * 4.5) : 0) + (dD >= 0 && dL < 0 ? 3 : 0) + (t > P.burn && t < P.burnEnd ? 1.5 : 0), [jx, jy] = jit(t, shk);
      // 하늘: 핏빛 → 가려질수록 검붉게
      SRC(); A(fin); g.fillStyle = '#060102'; g.fillRect(0, 0, W, H);
      { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, MX * 0.8); gr.addColorStop(0, rgba(mixc('#6a1408', '#2a0406', cov), 1)); gr.addColorStop(0.5, rgba(mixc('#2a0606', '#120203', cov), 1)); gr.addColorStop(1, 'rgba(6,1,2,1)'); A(fin); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      g.save(); g.translate(jx, jy);
      const Rs = E * 0.62, Rm = Rs * 1.03, sx = cx, sy = cy - E * 0.02;
      // 해 (가려지기 전 · 가려지는 중)
      ADD(); dot(glow('#ff8a3a', 0.12), sx, sy, Rs * 2.6, fin * (0.7 - 0.55 * cov));
      if (cov < 1) { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, Rs); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.55, '#ffd27a'); gr.addColorStop(0.92, '#ff7a2a'); gr.addColorStop(1, '#ff4a1a'); SRC(); A(fin); g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, Rs, 0, TAU); g.fill(); }
      // 붉은 번개 (개기일식 동안 하늘에서)
      ADD(); for (const b of D.skyB) { const d = t - b.t; if (d < 0 || d > 0.22) continue; drawBolt(b.P, b.x0 * W, -10, b.x1 * W, b.y1 * H, '#ff3a2a', 1.6, (d < 0.06 || (d > 0.11 && d < 0.16) ? 1 : 0.35)); }
      // 코로나 · 홍염 (다 가려진 뒤)
      if (tot > 0) {
        ADD();
        for (const s of D.streamers) {
          const L = Rm * (1 + s.L * (0.85 + 0.15 * Math.sin(t * s.f + s.ph))) * (0.6 + 0.4 * tot), a = s.a + t * 0.03, w = s.w, x0 = sx + Math.cos(a) * Rm * 0.98, y0 = sy + Math.sin(a) * Rm * 0.98, ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
          const gr = g.createLinearGradient(x0, y0, ex, ey); gr.addColorStop(0, 'rgba(255,244,230,0.85)'); gr.addColorStop(0.35, 'rgba(255,170,110,0.35)'); gr.addColorStop(1, 'rgba(255,80,40,0)');
          A(tot * 0.75); g.fillStyle = gr; g.beginPath(); g.moveTo(sx + Math.cos(a - w) * Rm, sy + Math.sin(a - w) * Rm); g.quadraticCurveTo(sx + Math.cos(a - w * 0.3) * (Rm + L) / 2, sy + Math.sin(a - w * 0.3) * (Rm + L) / 2, ex, ey); g.quadraticCurveTo(sx + Math.cos(a + w * 0.3) * (Rm + L) / 2, sy + Math.sin(a + w * 0.3) * (Rm + L) / 2, sx + Math.cos(a + w) * Rm, sy + Math.sin(a + w) * Rm); g.closePath(); g.fill();
        }
        const cr = g.createRadialGradient(sx, sy, Rm * 0.96, sx, sy, Rm * 1.45); cr.addColorStop(0, 'rgba(255,250,240,0.95)'); cr.addColorStop(0.18, 'rgba(255,190,140,0.5)'); cr.addColorStop(1, 'rgba(255,60,30,0)'); A(tot); g.fillStyle = cr; g.beginPath(); g.arc(sx, sy, Rm * 1.45, 0, TAU); g.fill();
        g.lineCap = 'round';
        for (const p of D.prom) { const k = eOut(seg(t, p.t0, p.t0 + 0.6)); if (k <= 0) continue; const x = sx + Math.cos(p.a) * Rm, y = sy + Math.sin(p.a) * Rm, hh = Rm * p.h * k * (1 + 0.1 * Math.sin(t * 2 + p.a)); A(tot * 0.5); g.strokeStyle = '#ff3a2a'; g.lineWidth = Rm * 0.05; g.beginPath(); g.ellipse(x, y, Rm * p.w, hh, p.a + Math.PI / 2, Math.PI, TAU); g.stroke(); A(tot * 0.9); g.strokeStyle = '#ffb08a'; g.lineWidth = Rm * 0.014; g.stroke(); }
      }
      // 검은 달: 왼쪽 위에서 미끄러져 와 해를 가림
      { const mx = lerp(sx - Rs * 2.4, sx, cov), my = lerp(sy - Rs * 1.35, sy, cov); SRC(); A(fin * seg(t, P.cover - 0.3, P.cover + 0.1)); g.fillStyle = '#050102'; g.beginPath(); g.arc(mx, my, Rm, 0, TAU); g.fill(); ADD(); ring(mx, my, Rm, 1.5, '#ff6a3a', 0.25 * fin * (1 - tot)); }
      // 베일리의 구슬 (다 가려지기 직전 가장자리 빛 알갱이)
      { const bk = bump(t, P.total - 0.32, P.total + 0.06); if (bk > 0) for (let i = 0; i < 6; i++) { const a = 0.78 + (i - 2.5) * 0.16 + Math.sin(i * 7.3) * 0.04; dot(glow('#fff1d0', 0.25), sx + Math.cos(a) * Rm, sy + Math.sin(a) * Rm, E * 0.035 * (0.6 + 0.4 * Math.sin(i * 3.1)), bk); } }
      // ① 이전 엠블럼: 붉은 금 → 가장자리부터 타들어 재로
      if (t < P.burnEnd + 0.05) {
        const k = eOut(seg(t, 0, 0.6)), S2 = E * lerp(0.84, 1, k), ey = cy + Math.sin(t * 1.9) * E * 0.01, u = eIn(seg(t, P.burn + 0.35, P.burnEnd)), rb = 0.66 * (1 - u);   // rb: 남은 둘레 (엠블럼 크기 단위)
        // 엠블럼 그림(512) 좌표의 일렁이는 원 — 그 안만 남고 밖은 탔음
        const poly = (h) => { h.beginPath(); for (let i = 0; i < 72; i++) { const th = i / 72 * TAU, rr = rb * 512 * (1 + 0.14 * Math.sin(5 * th + 1.7 + t * 2.5) + 0.09 * Math.sin(9 * th - t * 3.1) + 0.05 * Math.sin(17 * th + t * 5)), x = 256 + Math.cos(th) * rr, y = 256 + Math.sin(th) * rr; i ? h.lineTo(x, y) : h.moveTo(x, y); } h.closePath(); };
        // 남은 엠블럼: 그을음 · 달아오름 · 타 들어간 가장자리가 검게 (엠블럼 그림 안에서만)
        const eh = D.eh; eh.globalCompositeOperation = 'source-over'; eh.globalAlpha = 1; eh.clearRect(0, 0, 512, 512); eh.drawImage(X.imgA, 0, 0, 512, 512);
        eh.globalCompositeOperation = 'source-atop'; eh.globalAlpha = 0.55 * seg(t, P.burn, P.burnEnd); eh.drawImage(D.char, 0, 0, 512, 512);
        eh.globalAlpha = 0.3 * seg(t, P.burn - 0.2, P.burn + 0.6) * (0.75 + 0.25 * Math.sin(t * 13)); eh.drawImage(D.hotA, 0, 0, 512, 512); eh.globalAlpha = 1;
        if (u > 0) { const gr = eh.createRadialGradient(256, 256, rb * 512 * 0.5, 256, 256, rb * 512 * 1.05); gr.addColorStop(0, 'rgba(20,2,0,0)'); gr.addColorStop(1, 'rgba(20,2,0,0.92)'); eh.fillStyle = gr; eh.fillRect(0, 0, 512, 512); eh.globalCompositeOperation = 'destination-in'; poly(eh); eh.fillStyle = '#ffffff'; eh.fill(); }
        SRC(); pic(D.ec, cx, ey, S2, k);
        if (t > P.burn - 0.15) { ADD(); g.save(); g.globalAlpha = 1; cracks(X, cx, ey, S2, P.burn - 0.15, P.burn + 0.4, t, '#ff3a1a', 1 - u); g.restore(); }
        if (u > 0 && rb > 0.004) {   // 타는 가장자리 (엠블럼이 있던 자리에서만 빛남)
          const bh = D.bh; bh.globalCompositeOperation = 'source-over'; bh.clearRect(0, 0, 512, 512); poly(bh); bh.lineJoin = 'round';
          bh.strokeStyle = 'rgba(255,80,20,0.85)'; bh.lineWidth = 30; bh.stroke(); bh.strokeStyle = 'rgba(255,214,122,1)'; bh.lineWidth = 9; bh.stroke();
          bh.globalCompositeOperation = 'destination-in'; bh.drawImage(X.imgA, 0, 0, 512, 512);
          ADD(); pic(D.bc, cx, ey, S2, 0.95 * k); pic(D.bc, cx, ey, S2, 0.4 * k * (0.6 + 0.4 * Math.sin(t * 19)));
        }
        // 불티 · 재 (가장자리가 지나간 자리에서 피어오름)
        for (const p of D.burnP) {
          const tb = P.burn + 0.35 + Math.cbrt(Math.max(0, 1 - p.r / 0.66)) * (P.burnEnd - P.burn - 0.35), d = t - tb; if (d <= 0 || d > p.life) continue;
          const x = cx + Math.cos(p.th) * p.r * E + Math.sin(d * p.f + p.sw) * E * 0.03 * d, y = ey + Math.sin(p.th) * p.r * E - d * p.vy * E - d * d * E * 0.08, a = 1 - d / p.life;
          if (p.ash) { SRC(); A(a * 0.8); g.fillStyle = '#2a1a18'; g.save(); g.translate(x, y); g.rotate(d * p.f * 2); g.fillRect(-p.sz * 1.4, -p.sz * 0.7, p.sz * 2.8, p.sz * 1.4); g.restore(); }
          else { ADD(); dot(glow(d < 0.3 ? '#ffd27a' : '#ff5a1a', 0.22), x, y, p.sz * Math.max(1.3, E / 220), a); }
        }
      }
      // ② 다이아몬드 링 (한 점이 번쩍) — 그 뒤 가장자리 빛으로 남음
      if (dD >= 0) {
        ADD(); const a = -0.72, x = sx + Math.cos(a) * Rm, y = sy + Math.sin(a) * Rm, k = Math.exp(-dD * 1.8);
        dot(glow('#fff4e0', 0.18), x, y, E * (0.5 * k + 0.08), 0.9 * k + 0.25);
        spikes(x, y, MX * (0.45 * k + 0.06), E * 0.012, 0.2 + t * 0.05, '#ffcfa0', 0.9 * k + 0.25, 4, 0.35);
        A(0.6 * k); g.fillStyle = 'rgba(255,220,180,1)'; g.fillRect(-20, y - 1.5, W + 40, 3);
      }
      // ③ 갈라지는 땅: 아래 가운데 붉은 틈 (새 엠블럼이 나오면 닫힘)
      const yR = H * 0.93, rk = eOut(seg(t, P.diamond, P.diamond + 0.35)) * (1 - seg(t, P.land + 0.5, P.land + 1.6));
      if (rk > 0) {
        const wR = W * 0.44 * rk, op = E * 0.035 * rk; ADD();
        A(0.55 * rk); g.drawImage(glow('#ff4a1a', 0.08), cx - wR, yR - H * 0.5, wR * 2, H);   // 틈에서 솟는 붉은 빛 (가장자리 없이 번지게)
        dot(glow('#ff3a1a', 0.1), cx, yR, wR, 0.75 * rk);
        // 갈라진 틈: 가운데가 더 벌어진 지그재그 (위·아래 가장자리) → 노란 속 + 붉은 빛
        g.beginPath();
        D.rift.forEach(([u, v], i) => { const x = cx + u * wR, y = yR + v * E * 0.06 * rk - op * (1 - u * u); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        for (let i = D.rift.length - 1; i >= 0; i--) { const [u, v] = D.rift[i]; g.lineTo(cx + u * wR, yR + v * E * 0.06 * rk + op * (1 - u * u)); }
        g.closePath(); g.lineJoin = 'round';
        A(0.5 * rk); g.strokeStyle = '#ff2a12'; g.lineWidth = E * 0.06; g.stroke();
        A(0.9 * rk); g.strokeStyle = '#ff8a2a'; g.lineWidth = E * 0.018; g.stroke();
        A(rk); g.fillStyle = '#fff0b0'; g.fill();
      }
      // ③ 새 엠블럼: 틈에서 솟아오름 (불기둥 같은 불티 줄기) → 번개 세 줄기 · 충격파
      if (t >= P.rise) {
        const kr = seg(t, P.rise, P.land), ey = lerp(H + E * 0.55, cy, eOut(kr)), al = seg(t, P.rise, P.rise + 0.1);
        ADD();
        const fk = (1 - seg(t, P.land, P.land + 0.9)) * al;   // 불기둥 (틈 → 엠블럼)
        if (fk > 0) { const pw = E * 0.3, gr = g.createLinearGradient(cx - pw, 0, cx + pw, 0); gr.addColorStop(0, 'rgba(255,60,20,0)'); gr.addColorStop(0.5, rgba('#ff9a4a', 0.55 * fk)); gr.addColorStop(1, 'rgba(255,60,20,0)'); A(1); g.fillStyle = gr; g.fillRect(cx - pw, ey, pw * 2, yR - ey); }
        for (const p of D.stream) { const d = t - p.t0; if (d <= 0 || d > p.life) continue; const x = cx + p.x * E * (1 + d) + Math.sin(d * 7 + p.sw) * E * 0.02, y = yR - d * p.vy * H; dot(glow(d < 0.2 ? '#ffd27a' : '#ff4a1a', 0.22), x, y, p.sz * Math.max(1.3, E / 220) * (1.3 - d / p.life), (1 - d / p.life) * (1 - seg(t, P.land + 0.4, P.land + 1.2))); }
        dot(glow('#ff4a1a', 0.12), cx, ey, E * 0.95, 0.5 * al);
        SRC(); pic(X.imgB, cx, ey, E, al); ADD(); pic(D.hotB, cx, ey, E, (1 - seg(t, P.land - 0.2, P.land + 1.4)) * 0.75);
        if (dL > 0) sweeps(E, cx, ey, t, [P.land + 0.35, ECL.Tm.title + 1.5, ECL.Tm.title + 3.3]);
        for (const b of D.bolts) { const d = t - b.t; if (d < 0 || d > 0.3) continue; drawBolt(b.P, cx + b.x * W, -10, cx + b.x * E * 0.4, cy - E * 0.38, '#ff3a2a', Math.max(1.6, E * 0.006), d < 0.08 || (d > 0.14 && d < 0.2) ? 1 : 0.3); }
        if (dL >= 0) {
          for (const [d0, c, w0] of [[0, '#ff6a3a', 14], [0.12, '#ff2a12', 7]]) { const p = seg(dL, d0, d0 + 0.9); if (p > 0 && p < 1) ring(cx, cy, E * 0.32 + eOut(p) * MX * 0.75, w0 * (1 - p) + 1, c, 1 - p); }
          for (const p of D.sparks) { const d = dL - p.d; if (d <= 0 || d > p.life) continue; const k = (1 - Math.exp(-2.4 * d)) / 2.4, r = p.s * E * k * 1.1 + E * 0.15; dot(glow(p.c, 0.2), cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r + E * 0.2 * d * d, p.sz * Math.max(1.3, E / 200), 1 - d / p.life); }
        }
      }
      // 떠오르는 불티 (아래에서)
      ADD(); const ek = seg(t, P.diamond, P.diamond + 1); for (const e of D.embers) { const y = H * 1.05 - ((t * e.sp * H + e.off * H * 1.2) % (H * 1.2)), x = e.x * W + Math.sin(t * e.f + e.ph) * 16; dot(glow('#ff5a1a', 0.25), x, y, e.sz * 2.4, ek * 0.75 * (0.3 + 0.7 * Math.sin(t * 3 + e.ph) ** 2)); }
      g.restore();
      vignette(0.55 * cov, '#000000', 0.2);
      if (dD >= 0) flash('#ffd8c0', 0.75 * Math.exp(-dD * 6));
      if (dL >= 0) flash('#ff6a3a', 0.35 * Math.exp(-dL * 6));
    },
  };

  // =================== 제니스 — 정점 ===================
  // 합체: 엠블럼 구성품(Rank.embParts) — ox·oy 옆으로 · z 앞으로 펼친 거리(E 단위) · r 돌아간 각 · s 크기 · ax·ay 돌며 맞물리는 중심(256 기준) · n 맞물리는 차례
  //  궤도 고리의 뒤·앞 반쪽(orbB · orbF)은 같이 움직여야 고리 하나로 보임
  const ZPART = {
    orbB: { r: 0.8, s: 1.4, n: 2 }, wingL: { ox: -0.8, oy: 0.04, r: 0.5, ax: 95, ay: 112, n: 1 }, wingR: { ox: 0.8, oy: 0.04, r: -0.5, ax: 161, ay: 112, n: 1 },
    seal: { r: -1.2, s: 1.12, n: 0 }, face: { z: 0.4, n: 3 }, star: { z: 0.75, r: 1.3, n: 4 }, gem: { z: 1.15, r: 0.9, s: 1.2, n: 7 },
    orbF: { r: 0.8, s: 1.4, n: 2 }, crown: { oy: -0.1, z: 0.25, r: -0.3, ay: 40, n: 5 }, plaque: { oy: 0.12, z: 0.25, r: 0.25, ay: 224, n: 6 },
  };
  const ZLOCK = [3.6, 3.82, 4.0, 4.15, 4.28, 4.4, 4.5, 4.75];   // 차례(n)마다 맞물리는 시각 — 마지막(보석) = 완성(P.land)
  const eBackIn = (x) => 2.70158 * x * x * x - 1.70158 * x * x;   // 살짝 물러났다가 빨려 들어감
  const ZEN = {
    id: 'zenith', Tm: { title: 5.7, dur: 10.95 },
    P: { ascend: 1.7, crown: 0.95, white: 1.95, prism: 2.35, form: 2.4, pull: 3.3, land: 4.75 },
    cues: [[0, 'gather'], [0.95, 'crown'], [2.35, 'prism'], [2.42, 'form'], [3.3, 'pull'], [4.37, 'charge'], [4.75, 'land'], [5.7, 'title']].concat(ZLOCK.slice(0, 7).map((t, i) => [t, 'lock' + i])).sort((a, b) => a[0] - b[0]),
    text: { kick: '승급전 통과  ·  APEX', rainbow: true, glow: '#fff3c8' },
    build(X, R) {
      const sf = starfield(R, 600, 1024, ['#ffffff', '#ffffff', '#fff2c4', '#d8c8ff', '#a8d8ff']);
      // 은하 (팔 두 개 · 가운데 금빛)
      const [gal, gh] = mk(768, 768); gh.globalCompositeOperation = 'lighter';
      { const gr = gh.createRadialGradient(384, 384, 0, 384, 384, 150); gr.addColorStop(0, 'rgba(255,240,200,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); gh.fillStyle = gr; gh.fillRect(0, 0, 768, 768); }
      for (let i = 0; i < 1800; i++) { const arm = i % 2, r = R() ** 0.7 * 360, th = arm * Math.PI + Math.log(1 + r / 26) * 2.3 + (R() - 0.5) * (0.35 + r / 900), x = 384 + Math.cos(th) * r, y = 384 + Math.sin(th) * r * 0.55, q = r / 360; gh.fillStyle = rgba(q < 0.3 ? '#fff0c8' : q < 0.6 ? '#c8a8ff' : '#8fb8ff', 0.25 + R() * 0.5); gh.beginPath(); gh.arc(x, y, 0.6 + R() * 1.4, 0, TAU); gh.fill(); }
      { const h = sf.getContext('2d'); h.save(); h.globalCompositeOperation = 'lighter'; h.globalAlpha = 0.55; h.translate(512, 512); h.rotate(-0.35); h.drawImage(gal, -490, -490, 980, 980); h.restore(); }   // 은하는 별밭에 미리 얹음 (화면에 큰 층을 하나 덜 그림)
      const bands = []; for (let i = 0; i < 18; i++) bands.push({ y: R() * 1.3, h: 0.012 + R() * 0.035, w: 0.6 + R() * 0.9, x: R(), c: ['#fff0c8', '#ffd0e8', '#ffffff', '#ffe39a'][i % 4], sp: 0.7 + R() * 1.2 });
      const speed = []; for (let i = 0; i < 46; i++) speed.push({ x: R(), y: R(), L: 0.05 + R() * 0.12, sp: 1.2 + R() * 1.6 });
      // 오로라 띠: 세로 그라데이션 조각 그림 (띠마다 색)
      const auro = ['#7cffd1', '#c87bff', '#ffe39a'].map((c, i) => { const [s, h] = mk(4, 128), gr = h.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.7, rgba(c, 0.55)); gr.addColorStop(0.92, rgba('#ffffff', 0.7)); gr.addColorStop(1, rgba(c, 0)); h.fillStyle = gr; h.fillRect(0, 0, 4, 128); return { s, y0: 0.08 + i * 0.07, amp: 0.04 + R() * 0.04, f: 1.5 + R() * 1.5, ph: R() * TAU, hh: 0.16 + R() * 0.1, sp: 0.5 + R() * 0.6 }; });
      // 별자리 왕관 (엠블럼 크기 E 단위 · 위쪽) — 차례로 켜지며 선으로 이어짐
      const crown = [[-0.32, -0.5], [-0.36, -0.68], [-0.18, -0.58], [0, -0.74], [0.18, -0.58], [0.36, -0.68], [0.32, -0.5], [0.16, -0.5], [0, -0.5], [-0.16, -0.5]];
      const scat = crown.map(() => [(R() - 0.5) * 2.6, (R() - 0.5) * 1.8]);
      const rays = []; for (let i = 0; i < 30; i++) rays.push({ hue: i / 30 * 360 + (R() - 0.5) * 8, a: i / 30 * TAU + (R() - 0.5) * 0.1, L: 0.55 + R() * 0.6, w: 0.01 + R() * 0.022 });
      const conf = []; for (let i = 0; i < 90; i++) { const q = R(); conf.push({ a: -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.9, s: 0.6 + R() * 2.2, w: 0.012 + R() * 0.012, h: 0.006 + R() * 0.006, spin: (R() - 0.5) * 10, flip: 4 + R() * 8, life: 1.8 + R() * 1.8, c: q < 0.4 ? '#ffd76a' : q < 0.6 ? '#ffffff' : hsl(R() * 360, 70) }); }
      const glit = []; for (let i = 0; i < 50; i++) glit.push({ x: R(), y: R(), f: 1 + R() * 3, ph: R() * TAU, s: 1 + R() * 2.2, hue: R() * 360 });
      const [ac, ah] = mk(256, 96);   // 오로라를 그리는 곳
      // 합체 구성품: 그림 · 흰빛 그림 · 맞물릴 때 튀는 빛 알갱이 (못 만들면 새 엠블럼이 그냥 나타남)
      let parts = null;
      try { parts = Rank.embParts ? Rank.embParts(X.to, 512, Object.keys(ZPART)) : null; } catch (e) { parts = null; }
      if (parts && parts.length) {
        parts = parts.map((p, i) => { const q = ZPART[p.id]; return Object.assign(p, { i, n: q.n, ox: q.ox || 0, oy: q.oy || 0, z: q.z || 0, r: q.r || 0, s: q.s || 1, ax: (q.ax || 128) / 256, ay: (q.ay || 118) / 256, tl: ZLOCK[q.n], du: q.n === 7 ? 0.55 : q.n === 0 ? 0.5 : 0.42, wv: tint(p.cv, '#ffffff'), dv: tint(p.cv, '#06020f'), sp: Array.from({ length: 9 }, () => ({ a: R() * TAU, s: 0.25 + R() * 0.5, life: 0.35 + R() * 0.4, h: R() * 360 })) }); });
      } else parts = null;
      return { sf, gal, bands, speed, auro, ac, ah, crown, scat, rays, conf, glit, parts, iSeal: parts ? parts.findIndex((p) => p.id === 'seal') : -1, wA: tint(X.imgA, '#ffffff'), wB: tint(X.imgB, '#ffffff') };
    },
    // 합체 — 구성품 q 의 시각 t 자리: 프리즘에서 튀어나와(m) 입체로 펼쳐져 있다가(f) 맞물림(e → 1) · cam: 카메라 (옆으로 돈 각 · 내려다본 각 · 원근)
    lay(q, t, cam) {
      const { cx, cy, E } = S, te = ZEN.P.form + q.n * 0.035, m = eOut(seg(t, te, te + 0.55));
      const k = seg(t, q.tl - q.du, q.tl), e = k > 0 ? eBackIn(k) : 0, f = 1 - e, done = k >= 1, pu = done ? cam.pu : 1;
      const X = q.ax - 0.5 + q.ox * f * cam.spread, Y = q.ay - 0.5 + q.oy * f + f * 0.016 * Math.sin(t * 2.1 + q.n * 1.7), Z = q.z * f - cam.zc;
      const x1 = X * cam.ct + Z * cam.st, z1 = Z * cam.ct - X * cam.st, py = Y * cam.cp - z1 * cam.sp, pz = Y * cam.sp + z1 * cam.cp, ps = 3.2 / (3.2 - pz);
      return { x: cx + x1 * E * ps * m * pu, y: cy + py * E * ps * m * pu, k: E * ps * (1 + (q.s - 1) * f) * lerp(0.06, 1, m) * pu, r: q.r * f + (1 - m) * 2.4 * (q.n % 2 ? 1 : -1), z: q.z * f, m, e, f, done };
    },
    // 구성품 그림을 그 자리 · 각 · 크기로 (판이 카메라 쪽으로 기울어 보이게)
    put(q, L, im, cam) {
      const c = Math.cos(L.r), s = Math.sin(L.r);
      g.save(); g.transform((cam.ux * c + cam.vx * s) * L.k, (cam.uy * c + cam.vy * s) * L.k, (cam.vx * c - cam.ux * s) * L.k, (cam.vy * c - cam.uy * s) * L.k, L.x, L.y);
      g.drawImage(im, q.x - q.ax, q.y - q.ay, q.w, q.h); g.restore();
    },
    asm(D, t) {
      const { W, cx, cy, E } = S, P = ZEN.P, ce = eInOut(seg(t, P.pull, P.land - 0.12));
      // 카메라: 비스듬히 내려다본 펼친 모습(앞 층일수록 오른쪽 아래) → 맞물릴수록 정면으로
      const th = lerp(0.5, 0.36, seg(t, P.form, P.pull)) * (1 - ce), ph = -(0.42 + 0.04 * Math.sin(t * 1.1)) * (1 - ce);
      let last = -9, nOn = 0; for (let n = 0; n < 7; n++) if (t >= ZLOCK[n]) { last = ZLOCK[n]; nOn++; }
      const cam = { ct: Math.cos(th), st: Math.sin(th), cp: Math.cos(ph), sp: Math.sin(ph), zc: 0.55 * (1 - ce), spread: clamp((W * 0.5 / E - 0.75) / 0.55, 0.35, 1), pu: 1 + 0.045 * Math.exp(-(t - last) * 11) };
      cam.ux = cam.ct; cam.uy = cam.st * cam.sp; cam.vx = 0; cam.vy = cam.cp;
      const Q = D.parts, L = Q.map((q) => ZEN.lay(q, t, cam)), sl = L[D.iSeal] || { x: cx, y: cy, m: 1 };
      // 뒤 빛 (맞물린 구성품이 늘수록 밝게)
      ADD(); dot(glow('#fff3c8', 0.14), sl.x, sl.y, E * (0.45 + 0.05 * nOn), (0.08 + 0.03 * nOn) * sl.m);
      // 별자리 선: 아직 떨어져 있는 구성품 → 인장 가운데 (펼친 모습이 한눈에)
      g.lineWidth = 1; g.strokeStyle = '#ffe9b0';
      for (let i = 0; i < Q.length; i++) {
        const q = Q[i], l = L[i]; if (!q.n || l.done || q.id === 'orbB' || q.id === 'orbF') continue;
        const a = (q.ox || q.oy ? 0.38 : 0.22) * l.f * l.m; if (a < 0.01) continue;
        A(a); g.beginPath(); g.moveTo(sl.x, sl.y); g.lineTo(l.x, l.y); g.stroke(); star4(l.x, l.y, E * 0.035, '#ffffff', Math.min(1, a * 2), t * 0.8 + i);
      }
      // 구성품: 앞뒤(z) 순서로 — 같으면 엠블럼을 그리는 순서
      const ord = Q.map((q, i) => i).sort((a, b) => L[a].z - L[b].z || a - b);
      for (const i of ord) {
        const q = Q[i], l = L[i]; if (l.m <= 0) continue;
        if (q.n === 7 && !l.done) { ADD(); dot(glow('#ffb8f4', 0.2), l.x, l.y, l.k * 0.24, (0.45 + 0.2 * Math.sin(t * 5)) * l.m); }   // 보석: 이전 엠블럼의 빛 — 펼친 동안 숨 쉬듯
        if (l.e > 0.02 && !l.done) { ADD(); for (let j = 3; j >= 1; j--) { A(0.2 * (1 - j / 4)); ZEN.put(q, ZEN.lay(q, t - j * 0.03, cam), q.wv, cam); } }   // 날아드는 꼬리
        if (l.f > 0.02 && q.id !== 'orbB' && q.id !== 'orbF') { SRC(); A(0.42 * l.f * l.m); ZEN.put(q, Object.assign({}, l, { x: l.x + E * 0.03 * l.f, y: l.y + E * 0.05 * l.f }), q.dv, cam); }   // 그림자: 뒤 층에 드리워 앞뒤가 보이게
        SRC(); A(1); ZEN.put(q, l, q.cv, cam);
        const te = P.form + q.n * 0.035, hot = 1 - seg(t, te, te + 0.45), dl = t - q.tl;
        const wl = Math.max(hot, l.done ? 0.75 * Math.exp(-dl * 7) : 0.02 + 0.02 * Math.sin(t * 3 + q.n));   // 흰빛: 달아오름 → 은은히 → 맞물린 순간 번쩍
        if (wl > 0.01) { ADD(); A(wl); ZEN.put(q, l, q.wv, cam); }
      }
      // 맞물린 순간: 빛 · 반짝 · 빛 알갱이 · 고리 (보석은 완성 장면이 맡음)
      ADD();
      for (let i = 0; i < Q.length; i++) {
        const q = Q[i], l = L[i], dl = t - q.tl; if (q.n === 7 || dl < 0 || dl > 0.8 || q.id === 'orbB') continue;
        const p = seg(dl, 0, 0.45);
        dot(glow('#fff3c8', 0.2), l.x, l.y, E * 0.24, 0.6 * Math.exp(-dl * 6)); star4(l.x, l.y, E * 0.2 * (1 - p), '#ffffff', 1 - p, p * 1.6);
        for (const s of q.sp) { if (dl > s.life) continue; const d = E * s.s * eOut(dl / s.life) * 0.6; dot(hueGlow(s.h + t * 60), l.x + Math.cos(s.a) * d, l.y + Math.sin(s.a) * d, E * 0.02, 0.9 * (1 - dl / s.life)); }
      }
      for (let n = 0; n < 7; n++) { const p = seg(t - ZLOCK[n], 0, 0.55); if (p > 0 && p < 1) ring(sl.x, sl.y, E * (0.28 + 0.5 * eOut(p)), 3 * (1 - p) + 0.6, hsl(n * 50 + 40, 75), (1 - p) * 0.7); }
      // 마지막: 인장 끝 열두 곳에서 빛이 가운데로 모임 → 보석이 박힘
      const chg = seg(t, P.land - 0.4, P.land);
      if (chg > 0) {
        for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * TAU / 12, p = eIn(seg(t, P.land - 0.38 + (i % 3) * 0.04, P.land - 0.02)), rr = E * 0.26 * (1 - p); if (p > 0 && p < 1) dot(hueGlow(i * 30 + t * 200), sl.x + Math.cos(a) * rr, sl.y + Math.sin(a) * rr, E * 0.04, 0.9 * Math.sin(p * Math.PI)); }
        dot(glow('#ffffff', 0.25), sl.x, sl.y, E * (0.06 + 0.26 * eIn(chg)), 0.75 * chg * chg);
      }
    },
    draw(X, t) {
      const D = X.td, P = ZEN.P, { W, H, cx, cy, E, MX } = S, fin = seg(t, 0, 0.5), dP = t - P.prism, dL = t - P.land;
      let lk = 0; for (let n = 0; n < 7; n++) { const d = t - ZLOCK[n]; if (d >= 0 && d < 0.6) lk += Math.exp(-d * 12); }   // 맞물릴 때마다 '쿵'
      const asc = eInOut(seg(t, 0.15, P.ascend)), shk = (dL >= 0 ? Math.min(W, H) * 0.05 * Math.exp(-dL * 4.2) : 0) + (dP >= 0 && dL < 0 ? Math.min(W, H) * (0.02 * Math.exp(-dP * 6) + 0.011 * lk) : 0) + 2 * bump(t, 0.2, P.ascend), [jx, jy] = jit(t, shk);
      // 하늘 → 우주 (위로 올라감)
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, rgba(mixc('#1c1748', '#020108', asc), 1)); sky.addColorStop(0.6, rgba(mixc('#3b2a6a', '#07041a', asc), 1)); sky.addColorStop(1, rgba(mixc('#6a4270', '#0d0820', asc), 1));
      SRC(); A(fin); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.save(); g.translate(jx, jy);
      const ss = MX * 1.3; A(fin * seg(t, 0.6, 1.7)); g.save(); g.translate(cx, cy + H * 0.1 * (1 - asc)); g.rotate(t * 0.01); g.drawImage(D.sf, -ss / 2, -ss / 2, ss, ss); g.restore();
      ADD();
      // 오로라: 작은 그림(256×96, 화면 위쪽 45%)에 세로 조각으로 그린 뒤 늘려 그림 → 조각 경계 없이 부드럽게
      const ak = seg(t, 0.7, 1.8);
      if (ak > 0) {
        const ah = D.ah; ah.globalCompositeOperation = 'source-over'; ah.globalAlpha = 1; ah.clearRect(0, 0, 256, 96); ah.globalCompositeOperation = 'lighter';
        for (const a of D.auro) {
          const hh = a.hh / 0.45 * 96;
          for (let i = 0; i < 128; i++) { const u = i / 127, y = (a.y0 + a.amp * Math.sin(u * a.f * TAU + t * a.sp + a.ph) + 0.02 * Math.sin(u * 17 + t * 1.3)) / 0.45 * 96, br = 0.5 + 0.5 * Math.sin(u * 9 + t * 0.9 + a.ph); ah.globalAlpha = 0.42 * br; ah.drawImage(a.s, i * 2 - 1, y - hh * 0.75, 4, hh); }
        }
        A(ak); g.drawImage(D.ac, 0, 0, W, H * 0.45);
      }
      // 아래로 흐르는 빛 띠 · 속도선 (위로 솟구치는 느낌)
      const bk = 1 - seg(t, P.ascend - 0.4, P.ascend + 0.3);
      if (bk > 0) {
        for (const b of D.bands) { const v = (b.y + t * b.sp * (0.6 + 1.4 * bump(t, 0, P.ascend))) % 1.3 - 0.15, y = v * H, w = b.w * W, x = b.x * W - w / 2; const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, rgba(b.c, 0)); gr.addColorStop(0.5, rgba(b.c, 0.45)); gr.addColorStop(1, rgba(b.c, 0)); A(fin * bk * 0.6); g.fillStyle = gr; g.fillRect(x, y, w, b.h * H); }
        g.lineCap = 'round'; for (const s of D.speed) { const y = ((s.y + t * s.sp) % 1.2 - 0.1) * H, x = s.x * W, L = s.L * H * (0.5 + bump(t, 0.1, P.ascend)); A(fin * bk * 0.5); g.strokeStyle = '#fff6e0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - L); g.lineTo(x, y); g.stroke(); }
      }
      // ① 팔각 별 문양 (두 사각형이 반대로 돌며 좁혀 옴)
      const ok = seg(t, P.crown, P.crown + 0.45) * (1 - seg(t, P.prism - 0.1, P.prism + 0.05));
      if (ok > 0) {
        const rr = E * (0.78 - 0.2 * seg(t, 1.6, P.prism)); A(0.75 * ok); g.strokeStyle = '#ffe39a'; g.lineWidth = 1.5;
        for (const sd of [-1, 1]) { const r0 = sd * t * 0.5; g.beginPath(); for (let i = 0; i < 4; i++) { const a = r0 + i * Math.PI / 2 + (sd > 0 ? Math.PI / 4 : 0); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.stroke(); }
        ring(cx, cy, rr * 0.71, 1, '#fff6d8', 0.55 * ok); ring(cx, cy, rr * 1.04, 1, '#ffe39a', 0.4 * ok);
      }
      // ① 별자리 왕관: 하나씩 켜지며 이어짐 → 프리즘 때 흩어졌다가 완성되면 다시 모여 머리 위에
      const cs = clamp((cy - 0.5 * E - H * 0.035) / (0.24 * E), 0.45, 1);   // 왕관 높이: 엠블럼 위에 남은 자리에 맞춤 (가로 화면은 위가 좁음)
      const crownAt = (i, k) => { const [x, y] = D.crown[i], [sx2, sy2] = D.scat[i], yy = -0.5 + (y + 0.5) * cs, xx = x * (0.7 + 0.3 * cs); return [cx + lerp(sx2 * E, xx * E, k), cy + lerp(sy2 * E, yy * E, k)]; };
      // k: 0 흩어짐 → 1 왕관 자리 · al: 밝기 · tl(i): 선 i(별 i → i+1)가 그어진 정도 · pv(i): 별 i 가 켜진 정도
      const drawCrown = (k, al, tl, pv) => {
        if (al <= 0.004) return; const n = D.crown.length;
        A(al * 0.55); g.strokeStyle = '#ffe9b0'; g.lineWidth = 1.3;
        for (let i = 0; i < n; i++) { const lf = tl(i); if (lf <= 0) continue; const [x0, y0] = crownAt(i, k), [x1, y1] = crownAt((i + 1) % n, k); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * lf, y0 + (y1 - y0) * lf); g.stroke(); }
        for (let i = 0; i < n; i++) { const v = pv(i); if (v <= 0) continue; const pk = i === 1 || i === 3 || i === 5, [x, y] = crownAt(i, k), tw = (0.75 + 0.25 * Math.sin(t * 4 + i * 1.7)) * v; dot(glow('#ffe39a', 0.2), x, y, E * (pk ? 0.07 : 0.045), al * tw); star4(x, y, E * (pk ? 0.06 : 0.035), '#ffffff', al * tw, t * 0.6 + i); }
      };
      if (t < P.prism + 0.45) {
        const n = D.crown.length, on = (i) => P.crown + 0.15 + i * 0.09, sc = seg(t, P.prism, P.prism + 0.45);
        drawCrown(1 - eOut(sc), seg(t, P.crown, P.crown + 0.2) * (1 - sc) * (1 + 0.8 * bump(t, P.prism - 0.3, P.prism + 0.1)), (i) => seg(t, on(i + 1) - 0.04, on(i + 1) + 0.12), (i) => seg(t, on(i) - 0.02, on(i) + 0.08));   // 선 i: 다음 별이 켜질 때 (마지막 선은 왕관을 닫음)
        for (let i = 0; i < n; i++) { const d = t - on(i); if (d > 0 && d < 0.3) { const [x, y] = crownAt(i, 1); dot(glow('#ffffff', 0.25), x, y, E * 0.12 * (1 - d / 0.3), 0.8 * (1 - d / 0.3)); } }
      }
      // ① 이전 엠블럼: 떠오르다가 흰빛으로 → 한 점으로
      if (t < P.prism) {
        const k = eOut(seg(t, 0, 0.6)), wk = seg(t, P.white, P.prism - 0.12), sh = eIn(seg(t, P.prism - 0.3, P.prism)), S2 = E * lerp(0.84, 1, k) * (1 - 0.94 * sh), ey = cy + Math.sin(t * 1.7) * E * 0.012 - E * 0.03 * asc;
        dot(glow('#fff3c8', 0.15), cx, ey, E * (0.6 + 0.3 * wk), (0.3 + 0.5 * wk) * k);
        SRC(); pic(X.imgA, cx, ey, S2, k); pic(D.wA, cx, ey, S2, wk * k);
        ADD(); dot(glow('#ffffff', 0.25), cx, ey, E * (0.1 + 0.5 * sh), 0.9 * seg(t, P.white, P.prism));
      }
      // ② 프리즘: 흰빛이 무지개 빛살로 갈라짐 (천천히 돌며 남음)
      if (dP >= 0) {
        const dl0 = P.land - P.prism;   // 합체하는 동안은 빛살을 낮춰 구성품이 잘 보이게 → 완성되면 다시
        ADD(); const rk = eOut(seg(dP, 0, 0.5)), ra = 0.5 * Math.exp(-dP * 2.5) + (0.06 + 0.08 * seg(dP, dl0 - 0.1, dl0 + 0.4)) * (1 - seg(dP, dl0 + 1.4, dl0 + 4.4));
        for (const r of D.rays) {
          const a = r.a + t * 0.05, L = MX * r.L * rk, w = MX * r.w, ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L, gr = g.createLinearGradient(cx, cy, ex, ey);
          gr.addColorStop(0, hsl(r.hue + t * 30, 85, 0.9)); gr.addColorStop(1, hsl(r.hue + t * 30, 65, 0));
          A(ra); g.fillStyle = gr; g.beginPath(); g.moveTo(cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w); g.lineTo(ex, ey); g.lineTo(cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w); g.closePath(); g.fill();
        }
        const p = seg(dP, 0, 1.1); if (p < 1) for (let i = 0; i < 6; i++) ring(cx, cy, E * 0.2 + eOut(p) * MX * (0.62 + i * 0.025), 5 * (1 - p) + 1, hsl(i * 60 + t * 40, 65), (1 - p) * 0.7);
      }
      // ③ 합체: 프리즘에서 구성품이 튀어나와 입체로 펼쳐짐(별자리 선) → 인장 · 날개 · 궤도 고리 · 안쪽 면 · 별 · 왕관 · 명판이 차례로 맞물림 → 마지막 보석
      if (D.parts && t >= P.form && t < P.land) ZEN.asm(D, t);
      // ④ 완성 (보석이 박힌 순간): 몸통이 한 번 '쿵' · 충격파 · 색종이 · 별 왕관이 다시 모임 · 무지개 고리
      if (dL >= 0 || (!D.parts && t >= P.land - 0.45)) {
        const al = D.parts ? 1 : seg(t, P.land - 0.45, P.land), S2 = E * (1 + 0.06 * Math.exp(-Math.max(0, dL) * 8)), hk = seg(t, P.land, P.land + 0.6);
        ADD();
        if (hk > 0) {   // 무지개 고리 (뒤)
          const rr = E * 0.6, rot = t * 0.4; A(0.55 * hk);
          if (g.createConicGradient) { const cg = g.createConicGradient(rot, cx, cy); for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, hsl(i * 60, 70)); g.strokeStyle = cg; } else g.strokeStyle = '#ffe39a';
          g.lineWidth = E * 0.022; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); ring(cx, cy, rr, 1.2, '#ffffff', 0.6 * hk);
        }
        dot(glow('#fff3c8', 0.14), cx, cy, E * 0.95, 0.5 * al);
        SRC(); pic(X.imgB, cx, cy, S2, al); pic(D.wB, cx, cy, S2, (1 - seg(t, P.land, P.land + 1.0)) * 0.75 * al);
        if (dL > 0) sweeps(E, cx, cy, t, [P.land + 0.3, ZEN.Tm.title + 1.5, ZEN.Tm.title + 3.3]);
        if (dL >= 0) {
          ADD();
          for (const [d0, c, w0, sp] of [[0, '#fff6d8', 18, 1], [0.08, '#ffd76a', 9, 0.8], [0.18, null, 5, 0.62]]) { const p = seg(dL, d0, d0 + 1.0); if (p <= 0 || p >= 1) continue; const r = E * 0.3 + eOut(p) * MX * 0.8 * sp; if (c) ring(cx, cy, r, w0 * (1 - p) + 1, c, 1 - p); else for (let i = 0; i < 6; i++) ring(cx, cy, r + i * 3, 2, hsl(i * 60, 65), (1 - p) * 0.8); }
          drawCrown(eOut(seg(dL, 0.15, 0.95)), seg(dL, 0.1, 0.5), () => seg(dL, 0.6, 1.0), () => 1);
          for (const c of D.conf) {
            if (dL > c.life) continue; const k = (1 - Math.exp(-2.2 * dL)) / 2.2, x = cx + Math.cos(c.a) * c.s * E * k * 1.3, y = cy + Math.sin(c.a) * c.s * E * k * 1.3 + E * 0.35 * dL * dL * 0.5, a = 1 - dL / c.life;
            SRC(); A(a); g.fillStyle = c.c; g.save(); g.translate(x, y); g.rotate(c.spin * dL); g.scale(1, Math.cos(dL * c.flip)); g.fillRect(-c.w * E / 2, -c.h * E / 2, c.w * E, c.h * E); g.restore();
          }
        }
        ADD(); const gl = seg(t, P.land + 0.5, P.land + 1.5);
        if (gl > 0) for (const p of D.glit) dot(hueGlow(p.hue + t * 40), p.x * W, p.y * H, p.s * 2.2, gl * 0.5 * Math.max(0, Math.sin(t * p.f + p.ph)) ** 3);
      }
      g.restore();
      if (dP >= 0) flash('#ffffff', 0.95 * Math.exp(-dP * 5.5));
      if (dL >= 0) flash('#fff1c8', 0.5 * Math.exp(-dL * 6));
    },
  };

  const LIST = { nova: NOVA, celestial: CEL, eclipse: ECL, zenith: ZEN };
  return {
    get: (id) => LIST[id] || null,
    // 한 장면 그리기 — sc: { W, H, cx, cy, E, MX, FO(전체 투명도), shine(x, y, 크기, p) }
    draw(X, t, g0, sc) { g = g0; S = sc; FO = sc.FO; g.save(); try { X.th.draw(X, t); } finally { g.restore(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } },
  };
})();
