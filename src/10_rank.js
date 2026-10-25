// ============================================================
// 10_rank.js — 랭크전: 배치고사 3판 → 10티어 × 4단계(4→1), RP, 티어 엠블럼(캔버스로 직접 그림)
//  티어: 아이언 · 브론즈 · 실버 · 골드 · 플래티넘 · 다이아 · 마스터 · 그랜드마스터 · 레전드 · 이터널
//  한 단계 = 100 RP, 한 티어 = 400 RP. 이터널 1부터는 상한 없이 RP만 쌓인다
// ============================================================
const RANK_TIERS = [
  { id: 'iron', name: '아이언', c: ['#c3c8cd', '#80868c', '#3d4246'], glow: null },
  { id: 'bronze', name: '브론즈', c: ['#f2c08a', '#b5733a', '#5c3417'], glow: null },
  { id: 'silver', name: '실버', c: ['#ffffff', '#b9c3cc', '#5e6973'], glow: null },
  { id: 'gold', name: '골드', c: ['#fff3b0', '#e2a922', '#7a4e05'], glow: 'rgba(255,200,60,0.35)' },
  { id: 'platinum', name: '플래티넘', c: ['#e9fffb', '#5fc9bd', '#1c5d58'], glow: 'rgba(90,220,205,0.4)' },
  { id: 'diamond', name: '다이아', c: ['#eaf7ff', '#5aa8f2', '#173f8a'], glow: 'rgba(110,180,255,0.5)' },
  { id: 'master', name: '마스터', c: ['#f6e8ff', '#a45cf0', '#3e146e'], glow: 'rgba(175,110,255,0.55)' },
  { id: 'grandmaster', name: '그랜드마스터', c: ['#ffe2d6', '#e8384a', '#5d0712'], glow: 'rgba(255,80,60,0.6)' },
  { id: 'legend', name: '레전드', c: ['#fffdf2', '#ffd36b', '#9a6a08'], glow: 'rgba(255,230,140,0.7)' },
  { id: 'eternal', name: '이터널', c: ['#ffffff', '#c58cff', '#2b1060'], glow: 'rgba(200,160,255,0.8)' },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

const Rank = (() => {
  let S = Object.assign({ rp: 0, placed: 0, placements: [], games: 0, wins: 0, peak: 0, history: [] }, store.get('rank', {}));
  const save = () => { store.set('rank', S); dataSaved('rank'); };
  const unlocked = () => levelFromXp(STATS.xp).lv >= 3;
  const placed = () => S.placed >= 3;
  function tierOf(rp) {
    rp = Math.max(0, Math.floor(rp));
    const t = Math.min(9, Math.floor(rp / 400)), inT = rp - t * 400;
    const div = t === 9 ? Math.max(1, 4 - Math.floor(inT / 100)) : 4 - Math.floor(inT / 100);
    const top = t === 9 && div === 1, base = t * 400 + (4 - div) * 100;
    return { t, div, rp, name: RANK_TIERS[t].name, label: `${RANK_TIERS[t].name} ${div}`, into: top ? rp - base : rp - base, need: top ? null : 100, top };
  }
  // ---------- 점수 ----------
  // 배치고사 1판 점수: 순위(상위일수록 크게) + 우승 + 처치 + 가한 피해
  function placementScore(r) { const p = (r.place - 1) / Math.max(1, r.total - 1); return 50 * (1 - p) ** 2 + (r.win ? 30 : 0) + Math.min(r.kills, 10) * 8 + Math.min(r.dmg, 1500) / 50; }
  // 배치 후 1판 RP 변화: 순위 곡선 + 우승 + 처치 + 피해 − 티어 세금(높을수록 오르기 어렵다)
  function rpDelta(r, t) {
    const p = (r.place - 1) / Math.max(1, r.total - 1);
    let d = 50 * (1 - p) ** 2 - 18 + (r.win ? 23 : 0) + Math.min(r.kills, 10) * 6 + Math.min(r.dmg, 1500) / 100 - t * 2.5;
    if (r.quit) d = Math.min(d, -25) - 10; // 탈주 패널티
    return Math.round(clamp(d, -45, 140));
  }
  // 티어별 봇 난이도 비율 [쉬움, 보통, 어려움]
  const MIX = [[70, 30, 0], [55, 40, 5], [40, 50, 10], [25, 55, 20], [15, 55, 30], [10, 50, 40], [5, 45, 50], [0, 40, 60], [0, 30, 70], [0, 20, 80]];
  function botDifficulty() {
    if (!placed()) return pick(['easy', 'normal', 'normal', 'hard']);
    const m = MIX[tierOf(S.rp).t]; return weightedPick([['easy', m[0]], ['normal', m[1]], ['hard', m[2]]]);
  }
  function botCount(mapId) { return MAPS[mapId] && MAPS[mapId].big ? 99 : 40; }
  // 경기 결과 반영 → 결과 화면용 요약
  function apply(r) {
    S.games++; if (r.win) S.wins++;
    if (!placed()) {
      S.placements.push(Math.round(placementScore(r) * 10) / 10); S.placed++;
      const out = { placement: true, step: S.placed, of: 3, score: S.placements[S.placements.length - 1] };
      if (S.placed >= 3) {
        const sum = S.placements.reduce((a, b) => a + b, 0);
        S.rp = clamp(Math.round(sum * 3.5), 0, 1999); S.peak = Math.max(S.peak, S.rp);
        out.revealed = true; out.after = tierOf(S.rp);
      }
      S.history.unshift({ placement: true, place: r.place, total: r.total, kills: r.kills });
      S.history = S.history.slice(0, 10); save(); return out;
    }
    const before = tierOf(S.rp), delta = rpDelta(r, before.t);
    S.rp = Math.max(0, S.rp + delta); S.peak = Math.max(S.peak, S.rp);
    const after = tierOf(S.rp);
    const rank = (x) => x.t * 4 + (4 - x.div);
    S.history.unshift({ place: r.place, total: r.total, kills: r.kills, delta, rp: S.rp });
    S.history = S.history.slice(0, 10); save();
    return { placement: false, delta, before, after, promoted: rank(after) > rank(before), demoted: rank(after) < rank(before), tierUp: after.t > before.t };
  }

  // ---------- 엠블럼 ----------
  const cache = {};
  function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  // 금속 질감: 위쪽 밝은 반사 → 중간 본색 → 아래 어두운 색 → 바닥 반사
  const metalStops = (c) => [[0, c[0]], [0.35, c[1]], [0.72, c[2]], [0.9, c[1]], [1, c[0]]];
  function shield(g, cx, cy, w, h) {
    const t = cy - h / 2, b = cy + h / 2;
    g.beginPath(); g.moveTo(cx - w / 2, t + h * 0.08);
    g.quadraticCurveTo(cx - w / 4, t - h * 0.02, cx, t); g.quadraticCurveTo(cx + w / 4, t - h * 0.02, cx + w / 2, t + h * 0.08);
    g.bezierCurveTo(cx + w / 2, t + h * 0.55, cx + w * 0.32, b - h * 0.12, cx, b);
    g.bezierCurveTo(cx - w * 0.32, b - h * 0.12, cx - w / 2, t + h * 0.55, cx - w / 2, t + h * 0.08); g.closePath();
  }
  function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
  function star(g, cx, cy, r, n = 5, inner = 0.45, rot = -Math.PI / 2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } poly(g, p); }
  function sparkle(g, x, y, r, col) { g.save(); g.fillStyle = col; star(g, x, y, r, 4, 0.18, 0); g.fill(); g.restore(); }
  function gem(g, cx, cy, r, col, sides = 6) {
    g.save();
    const p = []; for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + i * TAU / sides; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    poly(g, p); g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.35, r * 0.1, r * 1.2, [[0, '#ffffff'], [0.25, col[0]], [0.7, col[1]], [1, col[2]]]); g.fill();
    g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    g.globalAlpha = 0.35; g.fillStyle = '#fff'; poly(g, [[cx, cy - r], [cx + r * 0.5, cy - r * 0.2], [cx, cy], [cx - r * 0.5, cy - r * 0.2]]); g.fill();
    g.restore();
  }
  // 날개: 깃털을 부채꼴로 겹쳐 그림. side -1 왼쪽 / 1 오른쪽
  function wing(g, cx, cy, side, len, n, cols, spread = 1.0, lift = 0) {
    g.save(); g.translate(cx, cy); g.scale(side, 1);
    for (let i = n - 1; i >= 0; i--) {
      const k = i / Math.max(1, n - 1), a = (-0.95 + k * 1.35) * spread - lift, L = len * (0.62 + 0.38 * Math.sin(k * Math.PI * 0.9 + 0.25)), wdt = len * 0.16;
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(0, -wdt * 0.3); g.quadraticCurveTo(L * 0.55, -wdt * 1.15, L, -wdt * 0.1); g.quadraticCurveTo(L * 0.6, wdt * 0.85, 0, wdt * 0.45); g.closePath();
      g.fillStyle = lin(g, 0, 0, L, 0, [[0, cols[2]], [0.45, cols[1]], [1, cols[0]]]); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(L * 0.1, 0); g.quadraticCurveTo(L * 0.55, -wdt * 0.45, L * 0.95, -wdt * 0.12); g.stroke();
      g.restore();
    }
    g.restore();
  }
  // 월계관: 아래에서 위로 휘어 오르는 가지 + 바깥쪽을 향한 잎사귀 쌍
  function laurel(g, cx, cy, r, side, n, cols) {
    g.save();
    const a0 = Math.PI / 2 + side * 0.25, a1 = Math.PI / 2 + side * 2.15;
    g.strokeStyle = cols[2]; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, a = a0 + (a1 - a0) * k, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, sz = r * (0.15 - k * 0.04);
      const tang = a + side * Math.PI / 2; // 가지 진행 방향
      for (const s2 of [-1, 1]) {
        g.save(); g.translate(x, y); g.rotate(tang + s2 * 0.75 + Math.PI / 2);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sz * 0.45, -sz * 0.55, 0, -sz * 1.25); g.quadraticCurveTo(-sz * 0.45, -sz * 0.55, 0, 0); g.closePath();
        g.fillStyle = lin(g, 0, 0, 0, -sz * 1.25, [[0, cols[2]], [0.5, cols[1]], [1, cols[0]]]); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; g.stroke();
        g.restore();
      }
    }
    g.restore();
  }
  function crown(g, cx, cy, w, h, cols, gemCols) {
    g.save();
    const b = cy + h / 2, t = cy - h / 2, pts = [[cx - w / 2, b], [cx - w / 2, cy - h * 0.05], [cx - w * 0.3, cy + h * 0.15], [cx - w * 0.2, t], [cx, cy + h * 0.05], [cx + w * 0.2, t], [cx + w * 0.3, cy + h * 0.15], [cx + w / 2, cy - h * 0.05], [cx + w / 2, b]];
    poly(g, pts); g.fillStyle = lin(g, 0, t, 0, b, metalStops(cols)); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.stroke();
    for (const [x, y] of [[cx - w / 2, cy - h * 0.05], [cx - w * 0.2, t], [cx + w * 0.2, t], [cx + w / 2, cy - h * 0.05]]) { g.beginPath(); g.arc(x, y, w * 0.05, 0, TAU); g.fillStyle = cols[0]; g.fill(); }
    if (gemCols) { gem(g, cx, b - h * 0.28, w * 0.09, gemCols, 4); gem(g, cx - w * 0.3, b - h * 0.22, w * 0.06, ['#ffd7d7', '#e2243a', '#5a0010'], 4); gem(g, cx + w * 0.3, b - h * 0.22, w * 0.06, ['#d7f1ff', '#2a8de2', '#0a2a60'], 4); }
    g.restore();
  }
  function rays(g, cx, cy, r0, r1, n, col, rot = 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = rot + i * TAU / n, w = (TAU / n) * 0.28, L = i % 2 ? r1 : r1 * 0.78;
      g.beginPath(); g.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); g.closePath();
      g.fillStyle = rad(g, cx, cy, r0, L, [[0, col], [1, 'rgba(255,255,255,0)']]); g.fill();
    }
    g.restore();
  }
  function flames(g, cx, cy, r) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 13; i++) {
      const a = -Math.PI / 2 + (i - 6) * 0.3, L = r * (0.62 + 0.3 * Math.sin(i * 1.7) ** 2), x = cx + Math.cos(a) * r * 0.42, y = cy + Math.sin(a) * r * 0.42;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(-r * 0.12, 0); g.quadraticCurveTo(-r * 0.1, -L * 0.6, 0, -L); g.quadraticCurveTo(r * 0.1, -L * 0.6, r * 0.12, 0); g.closePath();
      g.fillStyle = lin(g, 0, 0, 0, -L, [[0, 'rgba(255,90,20,0.9)'], [0.5, 'rgba(255,170,40,0.6)'], [1, 'rgba(255,240,150,0)']]); g.fill(); g.restore();
    }
    g.restore();
  }
  // 이터널: 무지개빛 그라데이션 (원뿔형 지원 시)
  function prism(g, cx, cy) {
    if (g.createConicGradient) { const c = g.createConicGradient(0, cx, cy); ['#ff7ad9', '#a77bff', '#62c8ff', '#7cffd1', '#fff27a', '#ffb36b', '#ff7ad9'].forEach((col, i, a) => c.addColorStop(i / (a.length - 1), col)); return c; }
    return lin(g, cx - 100, cy - 100, cx + 100, cy + 100, [[0, '#ff7ad9'], [0.3, '#7d8cff'], [0.6, '#62e8ff'], [1, '#fff27a']]);
  }
  function ribbon(g, cx, y, w, label, cols, fs) {
    g.save();
    const h = fs * 1.45;
    for (const s of [-1, 1]) { poly(g, [[cx + s * w * 0.42, y - h * 0.3], [cx + s * w * 0.62, y - h * 0.3], [cx + s * w * 0.55, y + h * 0.15], [cx + s * w * 0.62, y + h * 0.6], [cx + s * w * 0.42, y + h * 0.6]]); g.fillStyle = cols[2]; g.fill(); }
    g.beginPath(); g.moveTo(cx - w / 2, y - h / 2); g.quadraticCurveTo(cx, y - h * 0.8, cx + w / 2, y - h / 2); g.lineTo(cx + w / 2, y + h / 2); g.quadraticCurveTo(cx, y + h * 0.2, cx - w / 2, y + h / 2); g.closePath();
    g.fillStyle = lin(g, 0, y - h / 2, 0, y + h / 2, [[0, cols[0]], [0.5, cols[1]], [1, cols[2]]]); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5; g.stroke();
    g.font = `800 ${fs}px "Saira Condensed","Arial Narrow",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(label, cx, y - h * 0.05); g.fillStyle = '#fff'; g.fillText(label, cx, y - h * 0.05);
    g.restore();
  }
  // 티어별 엠블럼. t=-1: 배치 전(물음표), t=-2: 잠김
  function draw(t, div, S = 256) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    g.scale(S / 256, S / 256);
    const cx = 128, cy = 120;
    if (t < 0) {
      shield(g, cx, cy, 120, 140); g.fillStyle = lin(g, 0, 50, 0, 190, [[0, '#5a6066'], [1, '#2a2e32']]); g.fill(); g.lineWidth = 6; g.strokeStyle = '#7d848a'; g.stroke();
      g.font = '800 72px "Saira Condensed",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#c9ced3';
      if (t === -1) g.fillText('?', cx, cy + 4);
      else { g.fillStyle = '#c9ced3'; g.fillRect(cx - 22, cy - 4, 44, 36); g.lineWidth = 8; g.strokeStyle = '#c9ced3'; g.beginPath(); g.arc(cx, cy - 6, 15, Math.PI, 0); g.stroke(); }
      return cv;
    }
    const T = RANK_TIERS[t], c = T.c;
    // 뒤 배경 효과
    if (T.glow) { g.fillStyle = rad(g, cx, cy, 10, 125, [[0, T.glow], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 256, 256); }
    if (t === 9) { g.save(); g.globalAlpha = 0.85; g.lineWidth = 6; g.strokeStyle = prism(g, cx, cy); g.beginPath(); g.arc(cx, cy, 104, 0, TAU); g.stroke(); g.globalAlpha = 0.4; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 114, 0, TAU); g.stroke(); g.restore(); for (let i = 0; i < 14; i++) { const a = i * 2.39, r = 96 + (i % 3) * 9; sparkle(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3 + (i % 4), 'rgba(255,255,255,0.9)'); } }
    if (t === 8 || t === 9) rays(g, cx, cy, 30, t === 9 ? 128 : 118, 16, t === 9 ? 'rgba(220,190,255,0.75)' : 'rgba(255,230,150,0.8)', 0.1);
    if (t === 7) flames(g, cx, cy + 14, 92);
    // 날개
    const wc = t === 9 ? ['#ffffff', '#c9a6ff', '#4b1f8f'] : t === 8 ? ['#ffffff', '#ffe7a3', '#b98a1a'] : c;
    const wings = [0, 0, 3, 0, 5, 6, 8, 8, 9, 10][t];
    if (wings) {
      const len = [0, 0, 52, 0, 64, 72, 86, 92, 100, 108][t];
      if (t >= 7) { wing(g, cx - 34, cy - 4, -1, len * 0.82, wings - 2, [c[0], c[1], c[2]], 0.85, -0.35); wing(g, cx + 34, cy - 4, 1, len * 0.82, wings - 2, [c[0], c[1], c[2]], 0.85, -0.35); }
      wing(g, cx - 40, cy - 12, -1, len, wings, wc, 1.0, 0.1); wing(g, cx + 40, cy - 12, 1, len, wings, wc, 1.0, 0.1);
    }
    // 월계관 (골드~)
    if (t >= 3 && t <= 9) laurel(g, cx, cy + 6, 74, -1, t >= 6 ? 9 : 7, t >= 8 ? ['#fffbe0', '#ffd75a', '#a8780a'] : ['#e7f5c0', '#7fae3a', '#2f5014']), laurel(g, cx, cy + 6, 74, 1, t >= 6 ? 9 : 7, t >= 8 ? ['#fffbe0', '#ffd75a', '#a8780a'] : ['#e7f5c0', '#7fae3a', '#2f5014']);
    // 방패 본체
    const sw = 96 + Math.min(t, 6) * 3, sh = 116 + Math.min(t, 6) * 3;
    if (t === 0) { const p = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; p.push([cx + Math.cos(a) * 56, cy + Math.sin(a) * 60]); } poly(g, p); }
    else shield(g, cx, cy, sw, sh);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.fillStyle = t === 9 ? prism(g, cx, cy) : lin(g, 0, cy - sh / 2, 0, cy + sh / 2, metalStops(c)); g.fill(); g.restore();
    g.lineWidth = t >= 4 ? 7 : 5; g.strokeStyle = t >= 6 ? lin(g, 0, cy - sh / 2, 0, cy + sh / 2, [[0, '#fff6c9'], [0.5, '#e7b43a'], [1, '#8a5a06']]) : c[2]; g.stroke();
    // 안쪽 테두리·면
    g.save(); g.translate(cx, cy); g.scale(0.78, 0.78); g.translate(-cx, -cy);
    if (t === 0) { const p = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; p.push([cx + Math.cos(a) * 56, cy + Math.sin(a) * 60]); } poly(g, p); } else shield(g, cx, cy, sw, sh);
    g.fillStyle = t === 9 ? rad(g, cx, cy - 10, 5, 80, [[0, '#ffffff'], [0.35, '#d9b8ff'], [1, '#3a1678']]) : lin(g, 0, cy - sh / 2, 0, cy + sh / 2, [[0, c[1]], [0.6, c[2]], [1, c[1]]]); g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke();
    g.restore();
    // 상단 반사
    g.save(); shield(g, cx, cy, sw, sh); g.clip(); g.globalAlpha = 0.28; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - 18, cy - sh * 0.36, sw * 0.42, sh * 0.16, -0.35, 0, TAU); g.fill(); g.restore();
    // 리벳 (아이언·브론즈)
    if (t <= 1) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6 + (t ? 0.5 : 0); g.beginPath(); g.arc(cx + Math.cos(a) * 44, cy + Math.sin(a) * 48, 3.5, 0, TAU); g.fillStyle = c[0]; g.fill(); g.strokeStyle = c[2]; g.lineWidth = 1; g.stroke(); }
    // 중앙 문양
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6;
    if (t === 0) { g.fillStyle = c[0]; poly(g, [[cx - 24, cy + 6], [cx, cy - 14], [cx + 24, cy + 6], [cx + 24, cy + 18], [cx, cy - 2], [cx - 24, cy + 18]]); g.fill(); }
    else if (t <= 2) { g.fillStyle = lin(g, 0, cy - 30, 0, cy + 30, [[0, '#fff'], [1, c[1]]]); star(g, cx, cy - 4, t === 1 ? 26 : 22); g.fill(); if (t === 2) { poly(g, [[cx - 26, cy + 22], [cx, cy + 10], [cx + 26, cy + 22], [cx + 26, cy + 30], [cx, cy + 18], [cx - 26, cy + 30]]); g.fill(); } }
    else if (t <= 4) { g.fillStyle = lin(g, 0, cy - 30, 0, cy + 30, [[0, '#fff'], [1, c[1]]]); star(g, cx, cy - 2, 30, 5, 0.42); g.fill(); g.strokeStyle = c[2]; g.lineWidth = 2; g.stroke(); }
    else if (t === 5) gem(g, cx, cy - 2, 34, ['#ffffff', '#7cc6ff', '#1a4ea8'], 8);
    else if (t === 6) gem(g, cx, cy - 2, 32, ['#ffffff', '#c58cff', '#4a1488'], 6);
    else if (t === 7) gem(g, cx, cy - 2, 34, ['#ffe0e0', '#ff3048', '#5a0010'], 6);
    else if (t === 8) { g.fillStyle = lin(g, 0, cy - 40, 0, cy + 30, [[0, '#ffffff'], [0.5, '#ffe28a'], [1, '#c58a10']]); star(g, cx, cy - 2, 38, 8, 0.5); g.fill(); gem(g, cx, cy - 2, 14, ['#e0f4ff', '#2a8de2', '#0a2a60'], 6); }
    else { g.fillStyle = prism(g, cx, cy); star(g, cx, cy - 2, 42, 8, 0.45); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); gem(g, cx, cy - 2, 16, ['#ffffff', '#ffd6ff', '#7a2ac0'], 8); }
    g.restore();
    // 왕관 (플래티넘·다이아 보석 장식 / 마스터~ 왕관)
    if (t === 4 || t === 5) gem(g, cx, cy - sh / 2 - 4, t === 5 ? 15 : 12, t === 5 ? ['#ffffff', '#7cc6ff', '#1a4ea8'] : ['#ffffff', '#7ff0e2', '#106a62'], t === 5 ? 4 : 6);
    if (t >= 6) crown(g, cx, cy - sh / 2 - 14, t >= 8 ? 78 : 66, t >= 8 ? 40 : 34, t === 9 ? ['#ffffff', '#e4c6ff', '#6a2fb0'] : ['#fff6c9', '#e7b43a', '#8a5a06'], t >= 7 ? ['#ffffff', t === 9 ? '#ff9bf0' : '#ffd84a', t === 9 ? '#7a2ac0' : '#a86a00'] : null);
    // 반짝임
    if (t >= 5) for (const [x, y, r] of [[cx + 44, cy - 50, 7], [cx - 52, cy + 30, 5], [cx + 30, cy + 52, 4], [cx - 36, cy - 58, 4]].slice(0, t >= 8 ? 4 : 2)) sparkle(g, x, y, r + (t >= 8 ? 3 : 0), 'rgba(255,255,255,0.95)');
    // 단계 리본
    if (div) ribbon(g, cx, 222, t >= 6 ? 124 : 108, ROMAN[div], t === 9 ? ['#ffffff', '#c9a6ff', '#4b1f8f'] : t >= 6 ? ['#fff6c9', '#e7b43a', '#8a5a06'] : c, 26);
    return cv;
  }
  function emblem(t, div, size = 128) {
    const key = t + ':' + (div || 0) + ':' + size;
    if (!cache[key]) { try { cache[key] = draw(t, div, size).toDataURL('image/png'); } catch (e) { cache[key] = ''; } }
    return cache[key];
  }
  // 현재 상태의 엠블럼/라벨
  function status() {
    if (!unlocked()) return { kind: 'locked', emb: emblem(-2, 0), label: '랭크 잠김', sub: `레벨 3부터 (현재 레벨 ${levelFromXp(STATS.xp).lv})` };
    if (!placed()) return { kind: 'placement', emb: emblem(-1, 0), label: '배치고사', sub: `${S.placed} / 3 완료` };
    const ti = tierOf(S.rp);
    return { kind: 'ranked', emb: emblem(ti.t, ti.div), label: ti.label, sub: ti.top ? `${S.rp} RP` : `${ti.into} / 100 RP`, tier: ti };
  }
  return { get state() { return S; }, unlocked, placed, tierOf, apply, botDifficulty, botCount, emblem, status, placementScore, rpDelta, reset() { S = { rp: 0, placed: 0, placements: [], games: 0, wins: 0, peak: 0, history: [] }; save(); }, _set(o) { Object.assign(S, o); save(); },
    // 계정 전환: 통째로 바꿔 끼움 (저장 알림 없이)
    replace(o) { S = Object.assign({ rp: 0, placed: 0, placements: [], games: 0, wins: 0, peak: 0, history: [] }, o || {}); store.set('rank', S); } };
})();
