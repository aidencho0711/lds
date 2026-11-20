// ============================================================
// 10_rankfx.js — v23 티어 승급 컷신 · 랭크 개편 안내 창
//  · 컷신(RankFx.play): 화면 전체를 덮는 2D 캔버스. 글자까지 캔버스에 그려서 시각 t 하나로 장면이 정해진다(frame(t))
//    ① 모임(0 ~ 1.5초): 화면이 어두워지며 이전 엠블럼이 떠오르고, 새 티어 색의 빛이 소용돌이치며 모여듦 · 고리가 좁혀 옴
//       엠블럼이 달아오르며 떨리고 빛나는 금이 퍼짐
//    ② 깨짐: 번쩍임 · 충격파 두 겹 · 엠블럼이 유리처럼 조각나 흩어짐 · 화면 흔들림
//    ③ 상승: 위에서 내리꽂는 빛기둥 · 뒤에서 도는 빛살 · 새 엠블럼이 튀어나왔다 자리 잡음 · 빛 입자 폭발 · 엠블럼 위를 훑는 빛
//       상위 티어(노바~제니스)는 더 길게 + 영문 이름이 새겨진 인장 고리가 돌고, 혜성 셋이 엠블럼 둘레를 돈다
//    ④ 이름: 'TIER UP' · 티어 이름(글자 간격이 좁혀지며) · 영문/단계 · 다음 목표
//  · 화면을 누르면 이름 장면으로 건너뛰고, 한 번 더 누르면 닫힘 (건너뛰기 버튼은 바로 닫기)
//  · 개편 안내(RankFx.cutNotice): 4000 RP 넘던 계정이 다시 들어오면 — 바뀐 RP · 새 티어 4종 · 받은 최상위 스킨 3종 (10_rank.js settle)
//  · 개발자 도구에서 티어마다 컷신을 다시 볼 수 있다 (RankFx.demo)
// ============================================================
const RankFx = (() => {
  let cv = null, g = null, W = 0, H = 0, DPR = 1, raf = 0, tStart = 0, A = null, active = false, cue = 0, onDone = null;
  const hex2 = (h) => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, gg, b] = Array.isArray(c) ? c : hex2(c); return `rgba(${r | 0},${gg | 0},${b | 0},${clamp(a, 0, 1).toFixed(3)})`; };
  const mixc = (a, b, k) => { const p = Array.isArray(a) ? a : hex2(a), q = Array.isArray(b) ? b : hex2(b); return [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)]; };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eOut = (x) => 1 - (1 - x) ** 3, eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2), eBack = (x) => 1 + 2.9 * (x - 1) ** 3 + 1.9 * (x - 1) ** 2;
  const FD = '"Saira Condensed","IBM Plex Sans KR","Arial Narrow",sans-serif', FB = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const OY = -0.04;   // 엠블럼 몸통 가운데 (그림 가운데보다 조금 위 — 금·조각의 중심)
  const ell = (cx, cy, rx, ry, rot, th) => [cx + Math.cos(rot) * rx * Math.cos(th) - Math.sin(rot) * ry * Math.sin(th), cy + Math.sin(rot) * rx * Math.cos(th) + Math.cos(rot) * ry * Math.sin(th)];
  const EN = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'LEGEND', 'ETERNAL'], HC_EN = ['STALKER', 'HUNTER', 'SLAYER', 'REAPER', 'OVERLORD'];   // 컷신 영문 줄
  function tinfo(x) {
    const T = x.hc ? HC_TIERS[x.t] : RANK_TIERS[x.t];
    return { T, c: T.c, ac: T.ac || T.ln || T.c[1], name: T.name, en: T.en || (x.hc ? HC_EN : EN)[x.t] || '', sup: !!T.sup, hc: !!x.hc };
  }

  // ---------- 장면 준비 ----------
  function build(from, to, opt) {
    const a = tinfo(from), b = tinfo(to), sup = b.sup;
    const Tm = sup ? { crack: 1.2, shatter: 1.9, reveal: 2.05, settle: 2.9, title: 3.6, dur: 8.4 } : { crack: 0.9, shatter: 1.5, reveal: 1.65, settle: 2.45, title: 3.0, dur: 6.6 };
    const R = mulberry32(((to.t + 1) * 7919 + (from.t + 3) * 31 + (to.hc ? 5 : 0)) >>> 0);
    // 조각: 몸통 가운데에서 뻗는 9갈래 + 고리 3겹 (꼭짓점을 흔들어 불규칙하게)
    const NA = 9, RR = [0, 0.16, 0.34, 0.8], ang = [];
    for (let i = 0; i < NA; i++) ang.push((i + (R() - 0.5) * 0.6) / NA * TAU);
    const rj = RR.map((r, j) => ang.map(() => (j === 0 ? 0 : j === RR.length - 1 ? r : r * (0.8 + R() * 0.4))));
    const P2 = (a2, r) => [Math.cos(a2) * r, Math.sin(a2) * r + OY];
    const shards = [];
    for (let j = 0; j < RR.length - 1; j++) for (let i = 0; i < NA; i++) {
      const i2 = (i + 1) % NA, a1 = ang[i], a2 = i + 1 < NA ? ang[i + 1] : ang[0] + TAU, am = (a1 + a2) / 2, P = [];
      if (j === 0) P.push([0, OY]); else P.push(P2(a1, rj[j][i]), P2(am, (rj[j][i] + rj[j][i2]) / 2), P2(a2, rj[j][i2]));
      P.push(P2(a2, rj[j + 1][i2]), P2(am, (rj[j + 1][i] + rj[j + 1][i2]) / 2), P2(a1, rj[j + 1][i]));
      const c0 = P.reduce((s, p) => s + p[0], 0) / P.length, c1 = P.reduce((s, p) => s + p[1], 0) / P.length, d = Math.hypot(c0, c1 - OY) || 0.01, sp = 0.7 + R() * 1.3 + (0.8 - d);
      shards.push({ P: P.map(([x, y]) => [x - c0, y - c1]), c: [c0, c1], v: [(c0 / d) * sp + (R() - 0.5) * 0.5, ((c1 - OY) / d) * sp + (R() - 0.5) * 0.5 - 0.3], w: (R() - 0.5) * 7, life: 0.9 + R() * 0.7, edge: d < 0.42 });
    }
    // 금: 갈래마다 가운데에서 바깥으로 (조각 경계를 따라 → 정확히 그 자리가 깨진다) + 고리를 따라 일부
    const cracks = [];
    for (let i = 0; i < NA; i++) cracks.push({ d: i / NA * 0.45 + R() * 0.1, pts: [[0, OY], P2(ang[i], rj[1][i]), P2(ang[i] + (R() - 0.5) * 0.08, rj[2][i]), P2(ang[i] + (R() - 0.5) * 0.1, 0.46)] });
    for (let j = 1; j <= 2; j++) for (let i = 0; i < NA; i++) if (R() < 0.6) { const i2 = (i + 1) % NA, a1 = ang[i], a2 = i + 1 < NA ? ang[i + 1] : ang[0] + TAU; cracks.push({ d: 0.45 + R() * 0.5, pts: [P2(a1, rj[j][i]), P2((a1 + a2) / 2, (rj[j][i] + rj[j][i2]) / 2), P2(a2, rj[j][i2])] }); }
    for (const C of cracks) { C.total = 0; for (let j = 1; j < C.pts.length; j++) C.total += Math.hypot(C.pts[j][0] - C.pts[j - 1][0], C.pts[j][1] - C.pts[j - 1][1]); }
    // 입자: 모이는 빛 · 터지는 빛 · 떠오르는 불티
    const gath = [], NG = sup ? 170 : 120;
    for (let i = 0; i < NG; i++) gath.push({ a: R() * TAU, r0: 0.55 + R() * 0.6, t0: 0.12 + R() * (Tm.shatter - 0.7), du: 0.5 + R() * 0.5, sp: (R() < 0.5 ? -1 : 1) * (1.2 + R() * 1.6), sz: 0.8 + R() * 1.8, col: R() < 0.3 ? '#ffffff' : b.ac });
    const burst = [], NB = sup ? 260 : 170;
    for (let i = 0; i < NB; i++) { const q = R(); burst.push({ a: R() * TAU, s: 0.7 + R() ** 1.6 * 3.4, life: 1.0 + R() * 1.8, sz: 1 + R() * 3.2, col: q < 0.35 ? '#ffffff' : q < 0.62 ? b.ac : b.c[R() < 0.5 ? 0 : 1], spk: R() < 0.22, d: R() * 0.12 }); }
    const embers = []; for (let i = 0; i < 46; i++) embers.push({ x: R(), sp: 0.04 + R() * 0.08, ph: R() * 10, f: 0.5 + R() * 1.4, sz: 0.6 + R() * 1.8, off: R() });
    // 글자
    const top = !to.hc && to.t === RANK_TIERS.length - 1;
    const kick = opt.series ? '승급전 통과  ·  TIER UP' : to.hc ? 'HARDCORE  ·  TIER UP' : 'TIER UP';
    const line3 = `${b.en}  ${ROMAN[to.div] || ''}`.trim();
    const sub = sup ? (top ? '최고 티어 — 제니스 1부터 RP가 끝없이 쌓입니다' : `${b.name} 1에서 다음 승급전 — ${SUP.need[to.t - SUP.t0 + 1]}연속 성공`)
      : `${a.name} ${from.div}  →  ${b.name} ${to.div}`;
    const sweeps = sup ? [Tm.settle, Tm.title + 1.3, Tm.title + 3.1] : [Tm.settle, Tm.title + 1.6];
    const sh = document.createElement('canvas'); sh.width = sh.height = 256;
    return { from, to, a, b, sup, Tm, shards, cracks, gath, burst, embers, sweeps, sh, txt: { kick, name: b.name, line3, sub },
      imgA: Rank.embCanvas(from, 512), imgB: Rank.embCanvas(to, 512) };
  }

  // ---------- 그리기 ----------
  function star4(x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.2 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  function drawCracks(ex, ey, S2, t) {
    const X = A, Tm = X.Tm; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const C of X.cracks) {
      const ts = Tm.crack + C.d * (Tm.shatter - Tm.crack) * 0.8, f = seg(t, ts, ts + 0.3); if (f <= 0) continue;
      const L = C.total * f; let acc = 0;
      g.beginPath(); g.moveTo(ex + C.pts[0][0] * S2, ey + C.pts[0][1] * S2);
      for (let j = 1; j < C.pts.length; j++) {
        const [x0, y0] = C.pts[j - 1], [x1, y1] = C.pts[j], sl = Math.hypot(x1 - x0, y1 - y0);
        if (acc + sl >= L) { const q = (L - acc) / sl; g.lineTo(ex + (x0 + (x1 - x0) * q) * S2, ey + (y0 + (y1 - y0) * q) * S2); break; }
        acc += sl; g.lineTo(ex + x1 * S2, ey + y1 * S2);
      }
      g.strokeStyle = rgba(X.b.ac, 0.4); g.lineWidth = Math.max(4, S2 * 0.022); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = Math.max(1.4, S2 * 0.006); g.stroke();
    }
    g.restore();
  }
  // 엠블럼 위를 훑는 빛: 비스듬한 흰 띠를 엠블럼 모양으로 잘라(destination-in) 더해 그림
  function shine(cx, cy, S2, p) {
    const X = A, c = X.sh, s = c.width, h = c.getContext('2d');
    h.globalCompositeOperation = 'source-over'; h.clearRect(0, 0, s, s);
    const x = lerp(-0.45, 1.45, eInOut(p)) * s, gr = h.createLinearGradient(x - s * 0.16, 0, x + s * 0.16, s * 0.12);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    h.fillStyle = gr; h.fillRect(0, 0, s, s);
    h.globalCompositeOperation = 'destination-in'; h.drawImage(X.imgB, 0, 0, s, s);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.85; g.drawImage(c, cx - S2 / 2, cy - S2 / 2, S2, S2); g.restore();
  }
  // 상위 티어: 영문 이름이 새겨진 인장 고리 (눈금 고리는 시계 방향, 글자 띠는 반대로)
  function sigil(cx, cy, E, t, al) {
    const X = A, k = al * seg(t, X.Tm.reveal + 0.2, X.Tm.reveal + 1.0); if (k <= 0) return;
    const r1 = E * 0.55, r2 = E * 0.64, rot = t * 0.16, rr = (r1 + r2) / 2;
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(cx, cy);
    g.strokeStyle = rgba(X.b.ac, 0.6 * k); g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, r1, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, r2, 0, TAU); g.stroke();
    g.save(); g.rotate(rot); g.beginPath();
    for (let i = 0; i < 72; i++) { const a = i * TAU / 72, l = i % 6 ? 0.18 : 0.45; g.moveTo(Math.cos(a) * r2, Math.sin(a) * r2); g.lineTo(Math.cos(a) * (r2 + (r2 - r1) * l), Math.sin(a) * (r2 + (r2 - r1) * l)); }
    g.stroke(); g.restore();
    // 글자는 위쪽 호에만 (아래로 가면 거꾸로 읽히고 이름 글자와 겹침) — 천천히 좌우로 흔들림
    const fs = Math.max(8, (r2 - r1) * 0.66), span = Math.PI * 1.05, unit = `${X.b.en} · `, n = Math.floor(span * rr / (fs * 0.66)), txt = unit.repeat(Math.max(0, Math.floor((n + 3) / unit.length) - 1)) + X.b.en, step = span / txt.length, a0 = -Math.PI / 2 - span / 2 + Math.sin(t * 0.5) * 0.08;
    g.font = `700 ${fs.toFixed(1)}px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = rgba('#ffffff', 0.8 * k);
    for (let i = 0; i < txt.length; i++) { g.save(); g.rotate(a0 + (i + 0.5) * step + Math.PI / 2); g.translate(0, -rr); g.fillText(txt[i], 0, 0); g.restore(); }
    g.restore();
  }
  // 상위 티어: 엠블럼 둘레를 도는 혜성 셋 (꼬리 = 지나온 자리의 작은 빛)
  function comets(cx, cy, E, t, al, front) {
    const X = A, k = al * seg(t, X.Tm.reveal + 0.3, X.Tm.reveal + 1.2); if (k <= 0) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 3; j++) {
      const rx = E * (0.8 + j * 0.07), ry = E * (0.17 + j * 0.07), rot = -0.38 + j * 0.62, th0 = t * (1.3 - j * 0.22) + j * 2.1;
      if (!front) { g.strokeStyle = rgba(X.b.ac, 0.16 * k); g.lineWidth = 1; g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke(); g.restore(); }
      for (let q = 0; q < 16; q++) {
        const th = th0 - q * 0.045, inFront = Math.sin(th) > 0; if (inFront !== !!front) continue;
        const [x, y] = ell(cx, cy, rx, ry, rot, th), f = 1 - q / 16;
        g.fillStyle = rgba(q ? X.b.ac : '#ffffff', k * f * (q ? 0.6 : 1)); g.beginPath(); g.arc(x, y, (q ? 2.6 : 4) * (0.4 + 0.6 * f) * Math.max(1, E / 260), 0, TAU); g.fill();
      }
    }
    g.restore();
  }
  function text(t, out = 1) {
    const X = A, Tm = X.Tm, k1 = seg(t, Tm.title, Tm.title + 0.5); if (k1 <= 0) return;
    const base = Math.min(W, H), L = layout(), cx = W / 2;
    const fk = Math.max(11, base * 0.034), fn = Math.max(26, base * (W >= H ? 0.11 : 0.12)), fe = Math.max(12, base * 0.04), fs = Math.max(11, base * 0.03);
    const yK = L.eb + Math.max(18, base * 0.1), yN = yK + fk * 0.8 + fn * 0.62, yE = yN + fn * 0.62 + fe * 0.75, yS = yE + fe * 0.8 + fs * 0.85;
    const k2 = seg(t, Tm.title + 0.15, Tm.title + 0.8), k3 = seg(t, Tm.title + 0.55, Tm.title + 1.1), sp = 'letterSpacing' in g;
    g.save(); g.globalAlpha = out; g.textAlign = 'center'; g.textBaseline = 'middle';
    // 머리말 + 양옆으로 뻗는 선
    g.font = `800 ${fk.toFixed(1)}px ${FD}`; if (sp) g.letterSpacing = `${(fk * 0.32).toFixed(1)}px`;
    const yk = yK + (1 - eOut(k1)) * 10; g.fillStyle = rgba(X.b.ac, k1); g.fillText(X.txt.kick, cx, yk);
    const tw = g.measureText(X.txt.kick).width / 2 + 14, lw = base * 0.2 * eOut(k1);
    for (const s of [-1, 1]) { const lg = g.createLinearGradient(cx + s * tw, 0, cx + s * (tw + lw), 0); lg.addColorStop(0, rgba(X.b.ac, 0.9 * k1)); lg.addColorStop(1, rgba(X.b.ac, 0)); g.fillStyle = lg; g.fillRect(Math.min(cx + s * tw, cx + s * (tw + lw)), yk - 1, lw, 2); }
    // 티어 이름: 커졌다가 줄어들며 글자 간격이 좁혀짐
    if (k2 > 0) {
      const e = eOut(k2), sc = lerp(1.35, 1, e);
      g.save(); g.translate(cx, yN); g.scale(sc, sc); g.font = `800 ${fn.toFixed(1)}px ${FD}`; if (sp) g.letterSpacing = `${(fn * lerp(0.55, 0.1, e)).toFixed(1)}px`;
      g.globalAlpha = k2 * out; g.shadowColor = rgba(X.b.ac, 0.95); g.shadowBlur = fn * 0.5;
      const gr = g.createLinearGradient(0, -fn / 2, 0, fn / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, X.b.c[0]); gr.addColorStop(1, X.b.c[1]);
      g.fillStyle = gr; g.fillText(X.txt.name, 0, 0); g.shadowBlur = 0; g.lineWidth = Math.max(1, fn * 0.025); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(X.txt.name, 0, 0);
      g.restore();
    }
    if (k3 > 0) {
      g.globalAlpha = k3 * out; g.font = `700 ${fe.toFixed(1)}px ${FD}`; if (sp) g.letterSpacing = `${(fe * 0.3).toFixed(1)}px`; g.fillStyle = '#ffffff'; g.fillText(X.txt.line3, cx, yE);
      g.font = `600 ${fs.toFixed(1)}px ${FB}`; if (sp) g.letterSpacing = '0px'; g.fillStyle = 'rgba(232,238,246,0.86)'; g.fillText(X.txt.sub, cx, yS);
    }
    const k4 = seg(t, Tm.title + 1.4, Tm.title + 1.8), yT = Math.max(yS + fs * 2.2, H - Math.max(16, base * 0.045));
    if (k4 > 0 && yT < H - 6) { g.globalAlpha = k4 * out * (0.45 + 0.3 * Math.sin(t * 3.2)); g.font = `600 ${Math.max(10, base * 0.026).toFixed(1)}px ${FB}`; if (sp) g.letterSpacing = '0px'; g.fillStyle = '#ffffff'; g.fillText('화면을 눌러 계속', cx, yT); }
    g.restore();
  }
  // 화면 배치: 가로 화면은 엠블럼을 위쪽 가운데, 세로 화면은 조금 크게
  function layout() {
    const land = W >= H, cy = H * 0.36, E = land ? Math.min(H * 0.5, W * 0.4) : Math.min(W * 0.62, H * 0.34);
    return { cx: W / 2, cy, E, eb: cy + E / 2, MX: Math.max(W, H) };
  }
  function frame(t) {
    const X = A; if (!X || !g) return;
    const Tm = X.Tm, { cx, cy, E, MX } = layout();
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
    const fin = seg(t, 0, 0.45), out = 1 - seg(t, Tm.dur, Tm.dur + 0.45);
    g.globalAlpha = out;
    // 배경: 어둠 + 이전 티어 색에서 새 티어 색으로 바뀌는 큰 빛
    g.fillStyle = `rgba(3,4,9,${(0.94 * fin).toFixed(3)})`; g.fillRect(0, 0, W, H);
    const bg = mixc(X.a.c[2], X.b.c[1], seg(t, Tm.shatter - 0.2, Tm.reveal + 0.5)), gr = g.createRadialGradient(cx, cy, 0, cx, cy, MX * 0.75);
    gr.addColorStop(0, rgba(bg, 0.5 * fin)); gr.addColorStop(0.5, rgba(mixc(bg, [0, 0, 0], 0.65), 0.3 * fin)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 화면 흔들림 (금 가는 동안 약하게 · 깨지는 순간 크게 → 줄어듦)
    const ds = t - Tm.shatter, shk = (ds >= 0 ? Math.min(W, H) * 0.035 * Math.exp(-ds * 5.5) : 0) + (t > Tm.crack && t < Tm.shatter ? 2.5 * seg(t, Tm.crack, Tm.shatter) : 0);
    g.save(); g.translate(Math.sin(t * 97.3) * Math.cos(t * 41.1) * shk, Math.cos(t * 83.7) * Math.sin(t * 57.9) * shk);
    const rv = seg(t, Tm.reveal, Tm.reveal + 0.6);
    // ③ 뒤에서 도는 빛살 (한 경로로 모아 한 번에)
    if (rv > 0) {
      g.save(); g.globalCompositeOperation = 'lighter'; const n = X.sup ? 18 : 14, rot = t * 0.22, L0 = MX * 0.8;
      const rg = g.createRadialGradient(cx, cy, E * 0.15, cx, cy, L0); rg.addColorStop(0, rgba(X.b.ac, 0.24 * rv)); rg.addColorStop(0.6, rgba(X.b.ac, 0.06 * rv)); rg.addColorStop(1, rgba(X.b.ac, 0));
      g.beginPath();
      for (let i = 0; i < n; i++) { const a = rot + i * TAU / n, w = TAU / n * 0.16, L = L0 * (i % 2 ? 0.62 : 1); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - w) * L, cy + Math.sin(a - w) * L); g.lineTo(cx + Math.cos(a + w) * L, cy + Math.sin(a + w) * L); g.closePath(); }
      g.fillStyle = rg; g.fill(); g.restore();
    }
    // ③ 빛기둥
    const pl = seg(t, Tm.reveal - 0.08, Tm.reveal + 0.2) * (1 - seg(t, Tm.reveal + 0.8, Tm.title + 0.7));
    if (pl > 0) {
      g.save(); g.globalCompositeOperation = 'lighter'; const pw = E * (0.2 + 0.28 * pl), lg = g.createLinearGradient(cx - pw, 0, cx + pw, 0);
      lg.addColorStop(0, rgba(X.b.ac, 0)); lg.addColorStop(0.36, rgba(X.b.ac, 0.45 * pl)); lg.addColorStop(0.5, rgba('#ffffff', 0.92 * pl)); lg.addColorStop(0.64, rgba(X.b.ac, 0.45 * pl)); lg.addColorStop(1, rgba(X.b.ac, 0));
      g.fillStyle = lg; g.fillRect(cx - pw, -40, pw * 2, cy + 40 + E * 0.1);
      const vg = g.createLinearGradient(0, cy, 0, H); vg.addColorStop(0, rgba(X.b.ac, 0.35 * pl)); vg.addColorStop(1, rgba(X.b.ac, 0)); g.fillStyle = vg; g.fillRect(cx - pw * 0.35, cy, pw * 0.7, H - cy);
      g.restore();
    }
    // ① 모이는 빛 + 좁혀 오는 고리
    if (t < Tm.shatter + 0.05) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const p of X.gath) {
        const k = seg(t, p.t0, p.t0 + p.du); if (k <= 0 || k >= 1) continue;
        const e = k * k, r = p.r0 * MX * (1 - e) + E * 0.06 * e, a = p.a + p.sp * e, r2 = r + MX * 0.05 * (1 - e) + 6, a2 = a - p.sp * 0.05;
        g.strokeStyle = rgba(p.col, Math.sin(k * Math.PI) * 0.9); g.lineWidth = p.sz; g.beginPath(); g.moveTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
      }
      for (const [d0, lw] of [[0, 2.5], [0.35, 1.4]]) { const k = seg(t, 0.2 + d0, Tm.shatter); if (k <= 0) continue; g.strokeStyle = rgba(X.b.ac, 0.7 * k); g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, lerp(MX * 0.62, E * 0.5, eInOut(k)), 0, TAU); g.stroke(); }
      g.restore();
    }
    // ① 이전 엠블럼: 떠오름 → 달아오르며 떨림 → 금
    if (t < Tm.shatter) {
      const k = eOut(seg(t, 0, 0.6)), jit = seg(t, Tm.crack, Tm.shatter) ** 2 * E * 0.025, S2 = E * lerp(0.82, 1, k);
      const ex = cx + Math.sin(t * 71) * jit, ey = cy + Math.sin(t * 2.2) * E * 0.012 + Math.cos(t * 63) * jit;
      const hg = g.createRadialGradient(ex, ey, 0, ex, ey, S2 * 0.75); hg.addColorStop(0, rgba(X.a.c[1], 0.45 * k)); hg.addColorStop(1, rgba(X.a.c[1], 0)); g.fillStyle = hg; g.fillRect(ex - S2, ey - S2, S2 * 2, S2 * 2);
      g.save(); g.globalAlpha *= k; g.drawImage(X.imgA, ex - S2 / 2, ey - S2 / 2, S2, S2); g.restore();
      const hot = seg(t, Tm.crack - 0.25, Tm.shatter); if (hot > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= hot * 0.6; g.drawImage(X.imgA, ex - S2 / 2, ey - S2 / 2, S2, S2); g.restore(); }
      if (t > Tm.crack) drawCracks(ex, ey, S2, t);
    }
    // ② 조각
    if (ds >= 0 && ds < 1.8) {
      for (const s of X.shards) {
        const al = 1 - seg(ds, s.life * 0.45, s.life); if (al <= 0) continue;
        const k = (1 - Math.exp(-2.6 * ds)) / 2.6 * 1.7, px = cx + (s.c[0] + s.v[0] * k) * E, py = cy + (s.c[1] + s.v[1] * k) * E + 0.55 * E * ds * ds, sc = 1 - 0.3 * seg(ds, 0, s.life);
        g.save(); g.translate(px, py); g.rotate(s.w * k); g.scale(sc, sc);
        g.beginPath(); s.P.forEach(([x, y], j) => (j ? g.lineTo(x * E, y * E) : g.moveTo(x * E, y * E))); g.closePath();
        g.save(); g.clip(); g.globalAlpha *= al; g.drawImage(X.imgA, (-0.5 - s.c[0]) * E, (-0.5 - s.c[1]) * E, E, E);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha *= Math.exp(-ds * 3) * 0.8; g.drawImage(X.imgA, (-0.5 - s.c[0]) * E, (-0.5 - s.c[1]) * E, E, E); g.restore();
        if (s.edge) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(X.b.ac, 0.85 * al); g.lineWidth = 1.5; g.stroke(); }
        g.restore();
      }
    }
    // ② 번쩍임 + 충격파
    if (ds >= 0) {
      for (const [d0, w0] of [[0, 22], [0.12, 9]]) {
        const p = seg(ds, d0, d0 + 0.75); if (p <= 0 || p >= 1) continue;
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(mixc('#ffffff', X.b.ac, p), 1 - p); g.lineWidth = w0 * (1 - p) + 1; g.beginPath(); g.arc(cx, cy, E * 0.3 + eOut(p) * MX * 0.75, 0, TAU); g.stroke(); g.restore();
      }
    }
    // ③ 새 엠블럼
    if (t >= Tm.reveal) {
      const dr = t - Tm.reveal, s = 0.25 + 0.75 * eBack(seg(dr, 0, 0.6)), S2 = E * s * (1 + 0.012 * Math.sin(t * 2.4)), al = seg(dr, 0, 0.15);
      const hg = g.createRadialGradient(cx, cy, 0, cx, cy, E * 0.95); hg.addColorStop(0, rgba(X.b.c[1], 0.55 * al)); hg.addColorStop(0.5, rgba(X.b.ac, 0.18 * al)); hg.addColorStop(1, rgba(X.b.ac, 0));
      g.fillStyle = hg; g.fillRect(cx - E, cy - E, E * 2, E * 2);
      if (X.sup) { sigil(cx, cy, E, t, al); comets(cx, cy, E, t, al, false); }
      g.save(); g.globalAlpha *= al; g.drawImage(X.imgB, cx - S2 / 2, cy - S2 / 2, S2, S2); g.restore();
      const hot = Math.exp(-dr * 2.6); if (hot > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= hot; g.drawImage(X.imgB, cx - S2 / 2, cy - S2 / 2, S2, S2); g.restore(); }
      for (const ts of X.sweeps) { const p = seg(t, ts, ts + 0.75); if (p > 0 && p < 1) shine(cx, cy, S2, p); }
      if (X.sup) comets(cx, cy, E, t, al, true);
      // 터지는 빛 + 떠오르는 불티
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const p of X.burst) {
        const d = dr - p.d; if (d <= 0 || d > p.life) continue;
        const k = (1 - Math.exp(-2.4 * d)) / 2.4, r = p.s * E * k * 1.1 + E * 0.15, x = cx + Math.cos(p.a) * r, y = cy + Math.sin(p.a) * r + E * 0.18 * d * d, a = 1 - d / p.life, z = Math.max(1, E / 260);
        if (p.spk) star4(x, y, p.sz * 2.4 * z * (0.6 + 0.4 * Math.sin(d * 14 + p.a * 5)), rgba(p.col, a));
        else { g.fillStyle = rgba(p.col, a); g.beginPath(); g.arc(x, y, p.sz * z * (0.5 + 0.5 * a), 0, TAU); g.fill(); }
      }
      for (const e of X.embers) { const y = H * 1.05 - ((t * e.sp * H + e.off * H * 1.2) % (H * 1.2)), x = e.x * W + Math.sin(t * e.f + e.ph) * 14; g.fillStyle = rgba(X.b.ac, 0.55 * rv * (0.3 + 0.7 * Math.sin(t * 3 + e.ph) ** 2)); g.beginPath(); g.arc(x, y, e.sz, 0, TAU); g.fill(); }
      g.restore();
    }
    // ② 번쩍임 (흔들림과 무관하게 화면 전체)
    g.restore();
    if (ds >= 0) { const fk = Math.exp(-ds * 6.5); if (fk > 0.01) { g.fillStyle = rgba('#ffffff', 0.85 * fk * out); g.fillRect(0, 0, W, H); } }
    // ④ 글자
    text(t, out);
    g.globalAlpha = 1;
  }

  // ---------- 재생 ----------
  function size() {
    if (!cv) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    // 아주 큰 화면에서는 해상도를 낮춤 (픽셀 수 약 330만 이하)
    const px = W * H * DPR * DPR; if (px > 3.3e6) DPR = Math.max(1, Math.sqrt(3.3e6 / (W * H)));
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  const CUES = (X) => [[0, 'gather'], [X.Tm.crack, 'crack'], [X.Tm.shatter, 'shatter'], [X.Tm.reveal, 'reveal'], [X.Tm.title, 'title']];
  function sound(t) {
    const C = CUES(A);
    while (cue < C.length && t >= C[cue][0]) { const ph = C[cue][1]; cue++; if (t - C[cue - 1][0] < 0.35 || ph === 'title') try { if (Audio.rankUp) Audio.rankUp(ph, A.sup); } catch (e) { /* 소리 없이 */ } }
  }
  function loop() {
    if (!active) return;
    const t = (performance.now() - tStart) / 1000;
    sound(t); frame(t);
    if (t >= A.Tm.dur + 0.45) { close(); return; }
    raf = requestAnimationFrame(loop);
  }
  // from·to: tierOf / hcTierOf 결과 · opt.series: 승급전 통과 · done: 끝나면
  function play(from, to, opt = {}, done) {
    if (active) close(true);
    const L = $('tcLayer'); cv = $('tcCanvas'); if (!L || !cv) { if (done) done(); return false; }
    g = cv.getContext('2d'); size();
    try { A = build(from, to, opt); } catch (e) { console.warn(e); if (done) done(); return false; }
    onDone = done || null; active = true; cue = 0; tStart = performance.now();
    L.hidden = false; L.classList.toggle('sup', A.sup);
    try { Audio.init(); } catch (e) { /* 소리 없이 */ }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    return true;
  }
  // 누르면: 이름 장면 전이면 그리로 건너뛰고, 이름이 나온 뒤면 닫기
  function tap() {
    if (!active) return;
    const t = (performance.now() - tStart) / 1000;
    if (t < A.Tm.title) { tStart = performance.now() - A.Tm.title * 1000; cue = CUES(A).length - 1; }
    else close();
  }
  function close(silent) {
    if (!active && !A) return;
    active = false; cancelAnimationFrame(raf);
    const L = $('tcLayer'); if (L) L.hidden = true;
    if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
    A = null; const f = onDone; onDone = null;
    if (f && !silent) try { f(); } catch (e) { console.warn(e); }
  }
  // 개발자 도구: t번째 티어로 오르는 컷신 (상위 티어는 승급전 통과로)
  function demo(t) {
    t = clamp(t | 0, 1, RANK_TIERS.length - 1);
    const sup = !!RANK_TIERS[t].sup, mk = (tt, div) => ({ t: tt, div, label: `${RANK_TIERS[tt].name} ${div}` });
    return play(mk(t - 1, 1), mk(t, sup ? 5 : 4), { series: sup });
  }
  // 테스트용: 그 순간 한 장면만 그림 (requestAnimationFrame 없이)
  function still(from, to, opt, t) {
    cv = $('tcCanvas'); g = cv.getContext('2d'); $('tcLayer').hidden = false; size(); A = build(from, to, opt || {}); active = false; frame(t); return cv;
  }

  // ---------- 개편 안내 창 ----------
  let pend = null, pendT = null;
  function cutNotice(C) { if (!C || C.seen) return; pend = C; showCut(); }
  function showCut() {
    const C = pend; if (!C) return; clearTimeout(pendT);
    const P = $('rkCutPanel'); if (!P) return;
    const busy = G.state !== 'lobby' || active || (typeof Watch !== 'undefined' && Watch.viewing && Watch.viewing()) || ($('rnPanel') && !$('rnPanel').hidden);
    if (busy) { pendT = setTimeout(showCut, 1500); return; }
    pend = null;
    $('rkCutFrom').textContent = `${(C.from || 0).toLocaleString()} RP`;
    $('rkCutTo').textContent = `${SUP.base.toLocaleString()} RP`;
    $('rkCutText').textContent = `이터널 위에 격이 다른 상위 티어 4개(노바 · 셀레스티얼 · 이클립스 · 제니스)가 생기면서, 4,000 RP를 넘던 기록은 4,000 RP(이터널 1 · 승급전 대기)로 조정됐습니다. 다음 랭크전부터 노바 승급전이 시작됩니다 — 맵마다 정해진 순위 안에 들고 처치 ${SERIES_KILLS} 이상을 ${SUP.need[0]}번 연속으로 하면 노바 5로 오릅니다.`;
    const tr = $('rkCutTiers'); tr.innerHTML = '';
    for (let t = SUP.t0; t < RANK_TIERS.length; t++) { const d = document.createElement('div'); d.className = 'rkc-tier'; d.innerHTML = `<img alt="" src="${Rank.emblem(t, 5, 128)}"><b>${RANK_TIERS[t].name}</b>`; tr.appendChild(d); }
    const gl = $('rkCutGifts'); gl.innerHTML = '';
    const KIND = { skin: '옷', gskin: '총기 스킨', vskin: '차량 스킨', gold: '재화' };
    for (const o of C.got || []) {
      const r = rarOf(o.rar), d = document.createElement('div'); d.className = 'rkc-gift'; d.style.setProperty('--rc', r.color);
      d.innerHTML = `<span class="rkc-ico">${Shop.itemIcon(o)}</span><b>${esc(Shop.itemName(o))}</b><small>${esc(o.k === 'gold' ? '이미 모두 가진 등급이라 골드 탄피로' : `${r.name} · ${KIND[o.k] || ''}`)}</small>`;
      gl.appendChild(d);
    }
    try { Shop.pump(); } catch (e) { /* 그림은 나중에 */ }
    P.hidden = false;
    try { Audio.gacha && Audio.gacha('open', 5); } catch (e) { /* 소리 없이 */ }
  }
  function setup() {
    const L = $('tcLayer'); if (L) L.addEventListener('pointerdown', (e) => { if (e.target.id === 'tcSkip') return; e.preventDefault(); tap(); });
    const sk = $('tcSkip'); if (sk) sk.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    const ok = $('rkCutOk'); if (ok) ok.addEventListener('click', () => { Audio.ui(); $('rkCutPanel').hidden = true; Rank.cutSeen(); });
    window.addEventListener('resize', () => { if (active) size(); });
  }
  return { play, demo, still, frame, tap, close, cutNotice, setup, get active() { return active; } };
})();
