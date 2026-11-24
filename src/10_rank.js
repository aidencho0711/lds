// ============================================================
// 10_rank.js — 랭크전: 배치고사 3판 → 10티어 × 4단계(4→1) + 상위 티어 4종 × 5단계(5→1), RP, 티어 엠블럼(캔버스로 직접 그림)
//  티어: 아이언 · 브론즈 · 실버 · 골드 · 플래티넘 · 다이아 · 마스터 · 그랜드마스터 · 레전드 · 이터널  (한 단계 100 RP, 한 티어 400 RP · 이터널 = 3600~4000)
//  v23 상위 티어: 노바 · 셀레스티얼 · 이클립스 · 제니스 — 이터널 아래 티어들과 격이 다른 티어. 한 단계 200 RP, 한 티어 1000 RP (노바 5 = 4000 RP)
//   · 티어 끝(이터널 1 = 4000 · 노바 1 = 5000 · 셀레스티얼 1 = 6000 · 이클립스 1 = 7000)에 닿으면 RP가 멈추고 '승급전'
//   · 승급전: 맵마다 정한 순위 안에 들고(SERIES_TOP) 처치 2 이상이면 1회 성공(우승은 처치 수 상관없이) — 연속으로 3 → 3 → 4 → 5번 성공하면 다음 티어 5단계
//     실패하면 연속 기록이 0부터 · 승급전 동안 RP는 그대로 · 봇 95% 익스트림 · 숨어 있으면 봇이 찾아온다(07_bot_hunt.js)
//   · 한 번 오른 상위 티어 밑으로는 떨어지지 않는다(강등 보호). 제니스 1부터는 상한 없이 RP만 쌓인다
//   · 저장: S.sg = 통과한 승급전 수(0~4) · S.ss = 지금 승급전 연속 성공 · S.cv = 개편 뒤 기록 표식
//     S.cv 가 없는 옛 기록은 4000 RP를 넘으면 4000(이터널 1 · 승급전 대기)으로 내리고 S.cut 에 남긴다 → 최상위 스킨 3종 + 안내 (settle)
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
  // v23 상위 티어 (sup) — en: 영문 이름(컷신 글자) · ac: 빛 색
  { id: 'nova', name: '노바', en: 'NOVA', c: ['#ffffff', '#8fe3ff', '#0b2f6e'], glow: 'rgba(120,215,255,0.85)', ac: '#5fd8ff', sup: true },
  { id: 'celestial', name: '셀레스티얼', en: 'CELESTIAL', c: ['#fffaf0', '#f3d98b', '#6e4c0c'], glow: 'rgba(255,225,150,0.9)', ac: '#ffe39a', sup: true },
  { id: 'eclipse', name: '이클립스', en: 'ECLIPSE', c: ['#ffe3d6', '#ff4a2e', '#22030a'], glow: 'rgba(255,80,40,0.9)', ac: '#ff5a2a', sup: true },
  { id: 'zenith', name: '제니스', en: 'ZENITH', c: ['#ffffff', '#ffd76a', '#2a1060'], glow: 'rgba(255,240,200,0.95)', ac: '#ffe6a0', sup: true },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
// 상위 티어: t0 첫 번호 · base 노바 5 시작 RP · span 한 티어 · div 한 단계 · need 승급전 연속 성공 수(이터널→노바, 노바→셀레스티얼, …) · mix 승급전 봇 비율
const SUP = { t0: 10, base: 4000, span: 1000, div: 200, need: [3, 3, 4, 5], mix: [0, 0, 5, 95] };
// 승급전 1회 성공 순위 (이 순위 안) — 맵마다. 목록에 없는 맵은 10위
const SERIES_TOP = { kalden: 10, ironridge: 10, kinaru: 13, xmas: 13, norden: 17 };
const seriesTop = (map) => SERIES_TOP[map] || 10;
// v23 잠수 막기: 순위만으로는 성공이 아니다 — 처치도 이만큼 (우승은 처치 수 상관없이). 숨어서 순위만 올리면 실패
const SERIES_KILLS = 2;
// 승급전 1회 판정: '' = 성공, 아니면 실패 까닭 (quit 탈주 · place 순위 밖 · kills 처치 부족)
const seriesWhy = (r) => (r.quit ? 'quit' : r.win ? '' : r.place > seriesTop(r.map) ? 'place' : (r.kills || 0) < SERIES_KILLS ? 'kills' : '');
// 하드코어 랭크전 티어 (다이아 4 이상을 찍어 본 사람만): 방패·날개 대신 각진 흑철 휘장 · 갈라진 틈에서 빛이 샌다
//  스토커 → 헌터 → 슬레이어 → 리퍼 → 오버로드. 단계는 4→1 동일, 오버로드 1부터 상한 없이 RP
const HC_TIERS = [
  { id: 'stalker', name: '스토커', c: ['#d6d0cb', '#6d6560', '#221d1b'], glow: null, ln: '#b8433a' },
  { id: 'hunter', name: '헌터', c: ['#ffd9c2', '#b8673c', '#3e1608'], glow: 'rgba(230,120,60,0.3)', ln: '#ff8a3c' },
  { id: 'slayer', name: '슬레이어', c: ['#ffd6d6', '#c4203a', '#3c0410'], glow: 'rgba(255,40,70,0.45)', ln: '#ff3352' },
  { id: 'reaper', name: '리퍼', c: ['#e6fff1', '#2fd486', '#05281a'], glow: 'rgba(50,255,150,0.5)', ln: '#4dffa6' },
  { id: 'overlord', name: '오버로드', c: ['#fff1c8', '#ff7a18', '#2a0800'], glow: 'rgba(255,110,20,0.7)', ln: '#ffb02e' },
];
const HC_MIN_PEAK = 2000;   // 다이아 4 = 2000 RP

const Rank = (() => {
  const S0 = () => ({ rp: 0, placed: 0, placements: [], games: 0, wins: 0, peak: 0, history: [], sg: 0, ss: 0 });   // cv 는 norm 이 붙인다 (옛 기록과 구분)
  let S = Object.assign(S0(), store.get('rank', {}));
  const save = () => { store.set('rank', S); dataSaved('rank'); };
  const unlocked = () => levelFromXp(STATS.xp).lv >= 3;
  const placed = () => S.placed >= 3;
  // 통과한 승급전 수(sg)별 RP 상한(그 티어 끝 — 승급전 대기)과 하한(강등 보호)
  const capOf = (sg) => (sg >= 4 ? Infinity : SUP.base + sg * SUP.span);
  const floorOf = (sg) => (sg > 0 ? SUP.base + (sg - 1) * SUP.span : 0);
  // 기록 정리 + v23 개편 이전 기록(cv 없음) 옮기기: 4000 RP 넘으면 4000으로 (S.cut — 보상·안내는 settle)
  //  S: 정리할 기록 — 지금 기록, 또는 합치기 전의 서버·base 기록 (normOf)
  function norm(S) {
    if (!Array.isArray(S.history)) S.history = [];
    if (!Array.isArray(S.placements)) S.placements = [];
    S.rp = Math.max(0, Math.floor(+S.rp || 0)); S.sg = clamp(Math.floor(+S.sg || 0), 0, 4); S.ss = Math.max(0, Math.floor(+S.ss || 0));
    if (!S.cv) {
      if (S.rp > SUP.base) S.cut = { from: S.rp, peak: Math.floor(+S.peak || 0), at: Date.now() };
      S.sg = 0; S.ss = 0; S.cv = 1;
    }
    const cap = capOf(S.sg), fl = floorOf(S.sg);
    if (S.rp > cap) S.rp = cap; if (S.rp < fl) S.rp = fl;
    S.peak = Math.min(Math.max(+S.peak || 0, S.rp), cap);
  }
  norm(S); store.set('rank', S);
  // RP만 알 때(다른 계정 — 랭킹 서버가 sg 를 안 줄 때) 통과한 승급전 수 짐작: 티어 끝 RP 는 '승급전 대기'로 본다
  const sgGuess = (rp) => (rp > SUP.base ? Math.min(4, Math.ceil((rp - SUP.base) / SUP.span)) : 0);
  function mk(t, div, rp, into, need, top, series, sg) {
    const T = RANK_TIERS[t];
    return { t, div, rp, sg, name: T.name, label: `${T.name} ${div}`, into, need, top, series, sup: !!T.sup, pct: top ? 100 : clamp(into / need * 100, 0, 100) };
  }
  // RP(+통과한 승급전 수) → 티어. series: 티어 끝에서 승급전 중 · pct: 막대 % · sup: 상위 티어
  function tierOf(rp, sg) {
    rp = Math.max(0, Math.floor(+rp || 0));
    sg = sg === undefined || sg === null ? sgGuess(rp) : clamp(Math.floor(+sg || 0), 0, 4);
    rp = clamp(rp, floorOf(sg), capOf(sg));
    if (sg === 0) {
      const t = Math.min(9, Math.floor(rp / 400)), div = Math.max(1, 4 - Math.floor((rp - t * 400) / 100)), base = t * 400 + (4 - div) * 100;
      return mk(t, div, rp, Math.min(100, rp - base), 100, false, rp >= SUP.base, 0);
    }
    const k = Math.min(sg - 1, Math.floor((rp - SUP.base) / SUP.span)), t = SUP.t0 + k, b0 = SUP.base + k * SUP.span, last = t === RANK_TIERS.length - 1;
    const div = Math.max(1, 5 - Math.floor((rp - b0) / SUP.div)), base = b0 + (5 - div) * SUP.div, top = last && div === 1;
    return mk(t, div, rp, top ? rp - base : Math.min(SUP.div, rp - base), top ? null : SUP.div, top, !last && k === sg - 1 && rp >= b0 + SUP.span, sg);
  }
  const mine = () => tierOf(S.rp, S.sg);
  const peakTier = () => tierOf(Math.max(S.peak || 0, S.rp || 0), S.sg);
  // 다른 계정의 랭크 기록(서버 원본) → 지금·최고 티어. 개편 전 기록(cv 없음)은 4000 RP 로 잘라서 본다
  function viewOf(R) {
    R = R && typeof R === 'object' ? R : {};
    const cut = (v) => (R.cv ? +v || 0 : Math.min(+v || 0, SUP.base)), sg = R.cv ? +R.sg || 0 : 0, rp = cut(R.rp);
    return { rp, now: tierOf(rp, sg), peak: tierOf(Math.max(rp, cut(R.peak)), sg) };
  }
  const ord = (x) => x.t * 10 + (10 - x.div);   // 티어·단계 순서 (단계는 5·4→1)
  // 승급전 정보 (승급전 중이 아니면 null)
  function series() {
    const ti = mine(); if (!placed() || !ti.series) return null;
    return { n: S.ss, need: SUP.need[S.sg], next: ti.t + 1, from: ti, lim: seriesTop(SETTINGS.map), k: SERIES_KILLS };
  }
  // ---------- 점수 ----------
  // 배치고사 1판 점수: 순위(상위일수록 크게) + 우승 + 처치 + 가한 피해
  function placementScore(r) { const p = (r.place - 1) / Math.max(1, r.total - 1); return 50 * (1 - p) ** 2 + (r.win ? 30 : 0) + Math.min(r.kills, 10) * 8 + Math.min(r.dmg, 1500) / 50; }
  // 배치 후 1판 RP 변화: 순위 곡선 + 우승 + 처치 + 피해 − 티어 세금(높을수록 오르기 어렵다 · 상위 티어는 더)
  function rpDelta(r, t) {
    const p = (r.place - 1) / Math.max(1, r.total - 1);
    let d = 50 * (1 - p) ** 2 - 18 + (r.win ? 23 : 0) + Math.min(r.kills, 10) * 6 + Math.min(r.dmg, 1500) / 100 - t * 2.5;
    if (r.quit) d = Math.min(d, -25) - 10; // 탈주 패널티
    return Math.round(clamp(d, -45, 140));
  }
  // 티어별 봇 난이도 비율 [쉬움, 보통, 어려움, 익스트림] — 골드부터 익스트림이 섞이고 이터널은 절반, 상위 티어는 60~88% (승급전 95% — SUP.mix)
  const MIX = [[70, 30, 0, 0], [55, 40, 5, 0], [40, 50, 10, 0], [25, 55, 18, 2], [15, 50, 30, 5], [8, 45, 37, 10], [3, 35, 45, 17], [0, 25, 50, 25], [0, 15, 50, 35], [0, 5, 45, 50],
    [0, 0, 40, 60], [0, 0, 30, 70], [0, 0, 20, 80], [0, 0, 12, 88]];
  function botDifficulty() {
    if (!placed()) return pick(['easy', 'normal', 'normal', 'hard']);
    const ti = mine(), m = ti.series ? SUP.mix : MIX[ti.t]; return weightedPick([['easy', m[0]], ['normal', m[1]], ['hard', m[2]], ['extreme', m[3]]]);
  }
  const mixOf = (t) => MIX[t];
  function botCount(mapId) { return mapMaxBots(mapId); }   // 랭크전: 맵 최대 인원 (기본 75명 · 노르덴 100명)
  // 경기 결과 반영 → 결과 화면용 요약.  r.map: 경기한 맵 (승급전 성공 순위)
  function apply(r) {
    S.games++; if (r.win) S.wins++;
    if (!placed()) {
      S.placements.push(Math.round(placementScore(r) * 10) / 10); S.placed++;
      const out = { placement: true, step: S.placed, of: 3, score: S.placements[S.placements.length - 1] };
      if (S.placed >= 3) {
        const sum = S.placements.reduce((a, b) => a + b, 0);
        S.rp = clamp(Math.round(sum * 3.5), 0, 1999); S.peak = Math.max(S.peak, S.rp);
        out.revealed = true; out.after = mine();
      }
      S.history.unshift({ placement: true, place: r.place, total: r.total, kills: r.kills, t: Date.now() });   // t: 끝난 시각 (여러 기기 기록을 합칠 때 순서·같은 판 — mergeRank)
      S.history = S.history.slice(0, 10); save(); return out;
    }
    const before = mine();
    // 승급전: RP 그대로, 순위 안 + 처치 2 이상이면 연속 성공 +1 (다 채우면 다음 티어 5단계) / 아니거나 탈주면 연속 기록 0
    if (before.series) {
      const need = SUP.need[S.sg], lim = seriesTop(r.map), why = seriesWhy(r), ok = !why;
      S.ss = ok ? S.ss + 1 : 0;
      const passed = ok && S.ss >= need;
      if (passed) { S.sg++; S.ss = 0; }
      const after = mine();
      S.history.unshift({ place: r.place, total: r.total, kills: r.kills, delta: 0, rp: S.rp, ser: ok ? 1 : -1, t: Date.now() });
      S.history = S.history.slice(0, 10); save();
      return { placement: false, series: true, ok, why, kills: r.kills || 0, needK: SERIES_KILLS, streak: passed ? need : S.ss, need, lim, map: r.map, passed, delta: 0, before, after, promoted: passed, demoted: false, tierUp: passed };
    }
    const raw = rpDelta(r, before.t), rp = clamp(S.rp + raw, floorOf(S.sg), capOf(S.sg)), delta = rp - S.rp;
    S.rp = rp; S.peak = Math.max(S.peak, S.rp);
    const after = mine();
    S.history.unshift({ place: r.place, total: r.total, kills: r.kills, delta, rp: S.rp, t: Date.now() });
    S.history = S.history.slice(0, 10); save();
    return { placement: false, delta, raw, before, after, promoted: ord(after) > ord(before), demoted: ord(after) < ord(before), tierUp: after.t > before.t,
      seriesStart: after.series, guard: delta > raw };   // seriesStart: 이번 판으로 티어 끝에 닿아 승급전 시작 · guard: 강등 보호로 덜 깎임
  }
  // ---------- v23 개편: 4000 RP 넘던 계정 → 4000 + 가지지 않은 최상위 스킨 3종 + 안내 창 ----------
  //  계정 기록을 다 불러온 뒤에만 지급한다 (불러오는 중에 기기 기록에 넣으면 서버 기록에 덮인다). 지급 결과는 S.cut.got 에 남아 두 번 들어가지 않는다
  function settle() {
    const C = S.cut; if (!C || typeof C !== 'object') return false;
    if (typeof Cloud !== 'undefined' && store.get('account', null) && !(Cloud.user && (Cloud.status === 'online' || Cloud.status === 'syncing'))) return false;   // 로그인 계정이면 서버 기록을 다 불러온(online) 뒤에만
    if (!Array.isArray(C.got)) { C.got = Eco.grantTop(3, 'cut:' + ((typeof Cloud !== 'undefined' && Cloud.uid) || 'guest')); save(); }
    if (!C.seen && typeof RankFx !== 'undefined') RankFx.cutNotice(C);
    return true;
  }
  function cutSeen() { if (S.cut && !S.cut.seen) { S.cut.seen = 1; save(); } }

  // ---------- 여러 기기 합치기 (10_cloud.js — 저장·받아오기 때 서버 기록과) ----------
  //  local 이 기기 · server 서버 · base 마지막으로 서버와 같았던 기록. 랭크는 경기로만 바뀌므로 base 이후 판 수(games)가 늘어난 쪽을 통째로 고른다
  //  (RP·단계·승급전·배치고사를 한 기록에서 — 칸마다 섞으면 티어와 승급전 상태가 어긋남). 일반 랭크와 하드코어(hc)는 따로 고른다
  //   · 둘 다 늘었으면 승급전을 더 통과한 쪽(강등 보호) → 판 수가 많은 쪽 → RP 높은 쪽. 다른 쪽에서 한 판·승 수는 더하고, 최고 RP 는 큰 쪽, 최근 기록은 합친다
  //   · 둘 다 그대로면 판 수가 많은 쪽(옛 기기가 덮어써 줄어든 서버 기록은 버림) → 같으면 이 기기에서 바뀐 것(개발자 도구 등)이 있을 때만 이 기기 것
  //   · 개편 보상 표식(cut 의 받음·안내 봄)은 양쪽을 합친다
  const normOf = (o) => { const x = Object.assign(S0(), JSON.parse(JSON.stringify(o && typeof o === 'object' ? o : {}))); norm(x); return x; };
  // 키 순서와 상관없는 JSON — 서버(jsonb)는 칸 순서를 바꿔 돌려주므로 같은 판·같은 기록인지 볼 때 이것으로
  const cj = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v));
  function mergeRank(local, server, base) {
    const L = normOf(local), R = normOf(server), B = normOf(base), n = (o, k) => Math.max(0, Math.floor(+o[k] || 0)), arr = (a) => (Array.isArray(a) ? a : []);
    // 최근 기록: 양쪽에 다 있는 판은 하나만, 늦게 끝난 판부터 10개 (끝난 시각 t 가 없는 옛 기록은 뒤에 그대로)
    const hist = (a, b) => { const out = arr(a).slice(), ks = out.map(cj); for (const x of arr(b)) { const i = ks.indexOf(cj(x)); if (i >= 0) ks[i] = null; else out.push(x); } return out.sort((x, y) => (y.t || 0) - (x.t || 0)).slice(0, 10); };
    // 되돌아간 기록: 통과한 승급전 수(sg)·최고 RP(peak)는 관리자 초기화(adoptReset — 합치기 전에 따로 처리) 말고는 줄지 않는다
    //  → base 보다 작으면 옛 탭·옛 빌드가 덮어쓴 것. 판 수가 더 많아도 그쪽은 고르지 않는다 (승급전 통과가 사라지지 않게)
    const back = (x, b) => n(x, 'sg') < n(b, 'sg') || n(x, 'peak') < n(b, 'peak');
    const pick = (l, r, b) => {
      const bl = back(l, b), br = back(r, b); if (bl !== br) return br ? l : r;
      const gl = n(l, 'games'), gr = n(r, 'games'), gb = n(b, 'games');
      if (gl <= gb || gr <= gb) return gl !== gr ? (gl > gr ? l : r) : cj(l) === cj(b) ? r : l;
      const w = ((n(l, 'sg') - n(r, 'sg')) || (gl - gr) || (n(l, 'rp') - n(r, 'rp'))) > 0 ? l : r, o = w === l ? r : l;
      return Object.assign({}, w, { games: n(w, 'games') + n(o, 'games') - gb, wins: n(w, 'wins') + Math.max(0, n(o, 'wins') - n(b, 'wins')), peak: Math.max(n(w, 'peak'), n(o, 'peak')), history: hist(w.history, o.history) });
    };
    const main = (o) => Object.assign({}, o, { hc: undefined }), hc = (o) => Object.assign(HC0(), o.hc && typeof o.hc === 'object' ? o.hc : {});   // main: 하드코어를 뺀 일반 랭크 (칸 순서는 그대로)
    const out = pick(main(L), main(R), main(B));
    if (L.cut || R.cut) out.cut = Object.assign({}, ...[L.cut, R.cut, out.cut].filter((c) => c && typeof c === 'object'));
    if (L.hc || R.hc) out.hc = pick(hc(L), hc(R), hc(B));
    return out;
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
  // ---------- v23 상위 티어 엠블럼 — 방패 대신 '별빛 인장'(뾰족한 별 모양 금속판) + 궤도 고리 + 티어별 날개·문양·머리 장식 · 단계는 각진 명판 ----------
  //  노바: 백청색 별의 폭발(수정 칼날 날개 · 렌즈 빛) · 셀레스티얼: 천상의 금빛(여섯 깃 날개 · 후광 · 초승달)
  //  이클립스: 일식(흑요석 판 · 검은 태양과 코로나 불꽃 · 다이아몬드 반지 섬광) · 제니스: 정점(무지개 고리 · 금빛 왕관 · 이중 날개 · 큰 보석)
  function seal(g, cx, cy, R, n, k, rot = -Math.PI / 2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? R * k : R; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(g, p); }
  function orbitRing(g, cx, cy, rx, ry, rot, col, lw, a0 = 0, a1 = TAU) { g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, a0, a1); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); g.restore(); }
  const onEllipse = (cx, cy, rx, ry, rot, th) => [cx + Math.cos(rot) * rx * Math.cos(th) - Math.sin(rot) * ry * Math.sin(th), cy + Math.sin(rot) * rx * Math.cos(th) + Math.cos(rot) * ry * Math.sin(th)];
  function orb(g, x, y, r, col) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rad(g, x, y, 0, r * 3, [[0, '#ffffff'], [0.25, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); g.restore(); }
  // 수정 칼날 날개: 끝이 뾰족한 긴 마름모를 부채꼴로 (side -1 왼쪽 / 1 오른쪽)
  function blades(g, cx, cy, side, n, len, cols, spread = 1, lift = 0, alpha = 1) {
    g.save(); g.translate(cx, cy); g.scale(side, 1); g.globalAlpha = alpha;
    for (let i = n - 1; i >= 0; i--) {
      const k = i / Math.max(1, n - 1), a = (-0.9 + k * 1.25) * spread - lift, L = len * (1 - k * 0.42), w = len * 0.075 * (1.15 - k * 0.3);
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.3, -w); g.lineTo(L, 0); g.lineTo(L * 0.3, w * 0.7); g.closePath();
      g.fillStyle = lin(g, 0, 0, L, 0, [[0, cols[2]], [0.55, cols[1]], [1, cols[0]]]); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.9; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(L * 0.06, 0); g.lineTo(L * 0.97, 0); g.stroke();   // 가운데 날 선
      g.restore();
    }
    g.restore();
  }
  // 긴 별빛 가시 (짝수 번째는 짧게)
  function spikes(g, cx, cy, n, r0, r1, w, col, rot = 0, alt = 0.55) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = rot + i * TAU / n, L = i % 2 ? r1 * alt : r1, ww = i % 2 ? w * 0.6 : w, px = -Math.sin(a) * ww, py = Math.cos(a) * ww, x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
      g.beginPath(); g.moveTo(x0 + px, y0 + py); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.lineTo(x0 - px, y0 - py); g.closePath();
      g.fillStyle = lin(g, x0, y0, cx + Math.cos(a) * L, cy + Math.sin(a) * L, [[0, col], [1, 'rgba(255,255,255,0)']]); g.fill();
    }
    g.restore();
  }
  // 코로나 불꽃 (이클립스): 원 둘레에서 휘어 나오는 불꽃 혀 (시드 고정)
  function corona(g, cx, cy, r, n, len, seed) {
    const R = mulberry32(seed); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + R() * 0.2, L = len * (0.55 + R() * 0.6), bend = (R() - 0.5) * 0.9, w = r * 0.16;
      g.save(); g.translate(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 0.3 + bend * L * 0.5, -L * 0.6, bend * L * 0.6, -L); g.quadraticCurveTo(w * 0.4 + bend * L * 0.3, -L * 0.5, w, 0); g.closePath();
      g.fillStyle = lin(g, 0, 0, 0, -L, [[0, 'rgba(255,240,200,0.95)'], [0.25, 'rgba(255,150,60,0.85)'], [0.6, 'rgba(255,50,30,0.55)'], [1, 'rgba(120,0,0,0)']]); g.fill();
      g.restore();
    }
    g.restore();
  }
  // 별 가루 (시드 고정)
  function dust(g, cx, cy, r0, r1, n, col, seed) {
    const R = mulberry32(seed); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = R() * TAU, r = r0 + (r1 - r0) * Math.sqrt(R()), s = 0.5 + R() * 1.4; g.globalAlpha = 0.35 + R() * 0.65; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, 0, TAU); g.fill(); }
    g.restore();
  }
  // 단계 명판: 양 끝이 뾰족한 각진 판 + 끝 보석 + 로마 숫자
  function plaque(g, cx, y, w, label, cols, edge, gemC) {
    g.save(); const h = 30, pts = (d) => [[cx - w / 2 + d, y - h / 2 + d], [cx + w / 2 - d, y - h / 2 + d], [cx + w / 2 + 12 - d * 1.7, y], [cx + w / 2 - d, y + h / 2 - d], [cx - w / 2 + d, y + h / 2 - d], [cx - w / 2 - 12 + d * 1.7, y]];
    poly(g, pts(0)); g.fillStyle = lin(g, 0, y - h / 2, 0, y + h / 2, [[0, cols[0]], [0.5, cols[1]], [1, cols[2]]]); g.fill(); g.lineWidth = 2.5; g.strokeStyle = edge; g.stroke();
    poly(g, pts(4)); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke();
    if (gemC) for (const s of [-1, 1]) gem(g, cx + s * (w / 2 + 3), y, 6, gemC, 4);
    g.font = '900 23px "Saira Condensed","Arial Narrow",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.strokeText(label, cx, y + 1); g.shadowColor = edge; g.shadowBlur = 8; g.fillStyle = '#fff'; g.fillText(label, cx, y + 1);
    g.restore();
  }
  // part: 그 구성품만 그림 (컷신 「합체」 — SUP_PARTS · embParts). 없으면 전부
  function drawSup(g, t, div, part) {
    const T = RANK_TIERS[t], k = t - SUP.t0, cx = 128, cy = 118, SR = k === 3 ? 66 : 62, FR = SR * 0.64;
    const ga = (a) => T.glow.replace(/[\d.]+\)$/, a + ')'), on = (p) => !part || part === p;
    // ① 뒤 빛 · 빛줄기 · 별 가루
    if (on('back')) {
      g.fillStyle = rad(g, cx, cy, 4, 128, [[0, ga(0.95)], [0.45, ga(0.32)], [1, ga(0)]]); g.fillRect(0, 0, 256, 256);
      if (k === 0) spikes(g, cx, cy, 16, 18, 128, 5, 'rgba(210,245,255,0.95)', Math.PI / 16, 0.6);
      if (k === 1) rays(g, cx, cy, 28, 126, 20, 'rgba(255,236,180,0.75)', 0.05);
      if (k === 2) { g.fillStyle = rad(g, cx, cy, SR * 0.8, 124, [[0, 'rgba(255,60,20,0.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 256, 256); corona(g, cx, cy, SR * 0.98, 28, 46, 77); }
      if (k === 3) { g.save(); g.globalAlpha = 0.75; g.lineWidth = 8; g.strokeStyle = prism(g, cx, cy); g.beginPath(); g.arc(cx, cy, 110, 0, TAU); g.stroke(); g.globalAlpha = 0.35; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 122, 0, TAU); g.stroke(); g.restore(); spikes(g, cx, cy, 24, 22, 128, 4.5, 'rgba(255,240,190,0.95)', 0, 0.58); }
      dust(g, cx, cy, 66, 124, 36 + k * 14, '#ffffff', 300 + k * 11);
    }
    // ② 궤도 고리 — 뒤쪽 반 (인장 뒤로 지나감)
    const ORB = [[[110, 25, -0.3]], [[102, 22, 0.42], [102, 22, -0.42]], [], [[114, 24, -0.26], [100, 30, 0.5]]][k];
    const oc = ['rgba(140,225,255,0.85)', 'rgba(255,226,150,0.85)', '', 'rgba(255,236,170,0.9)'][k];
    if (on('orbB')) for (const [rx, ry, rot] of ORB) orbitRing(g, cx, cy, rx, ry, rot, oc, 2.2, Math.PI, TAU);
    // ③ 날개 (왼쪽 · 오른쪽)
    for (const s of [-1, 1]) {
      if (!on(s < 0 ? 'wingL' : 'wingR')) continue;
      if (k === 0) blades(g, cx + s * 30, cy - 8, s, 6, 98, ['#ffffff', '#86e0ff', '#0d3c84'], 0.95, 0.2);
      if (k === 1) { wing(g, cx + s * 34, cy + 18, s, 66, 8, ['#ffffff', '#f6e2a8', '#b48a2a'], 0.7, -0.8); wing(g, cx + s * 38, cy - 14, s, 106, 12, ['#ffffff', '#fff1c8', '#c7962c'], 1.05, 0.15); }
      if (k === 2) { g.save(); g.shadowColor = 'rgba(255,70,30,0.9)'; g.shadowBlur = 10; blades(g, cx + s * 32, cy - 4, s, 5, 102, ['#ff9a6a', '#5a0a10', '#0a0204'], 0.9, 0.35); g.restore(); }
      if (k === 3) { blades(g, cx + s * 30, cy, s, 6, 116, ['#ffffff', '#c9a6ff', '#4b1f8f'], 1.0, 0.02, 0.92); wing(g, cx + s * 40, cy - 16, s, 106, 12, ['#ffffff', '#ffe08a', '#a8780a'], 1.05, 0.25); }
    }
    // ④ 인장 본체 (뾰족한 별 모양 금속판)
    const NP = [8, 12, 16, 12][k], KK = [0.8, 0.88, 0.88, 0.86][k];
    if (on('seal')) {
      seal(g, cx, cy, SR, NP, KK);
      g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.fillStyle = [lin(g, 0, cy - SR, 0, cy + SR, [[0, '#ffffff'], [0.3, '#d2ecff'], [0.58, '#5f86b4'], [0.82, '#e9f8ff'], [1, '#7aa2cc']]), lin(g, 0, cy - SR, 0, cy + SR, metalStops(['#fffbe8', '#f0c95a', '#7a5410'])),
        lin(g, 0, cy - SR, 0, cy + SR, [[0, '#6a5050'], [0.35, '#1c0d0f'], [0.7, '#070203'], [1, '#4a1410']]), lin(g, 0, cy - SR, 0, cy + SR, metalStops(['#ffffff', '#ffd76a', '#8a5a06']))][k];
      g.fill(); g.restore();
      g.lineWidth = 3; g.strokeStyle = k === 2 ? lin(g, 0, cy - SR, 0, cy + SR, [[0, '#ffcf6a'], [0.5, '#ff3b1f'], [1, '#ffcf6a']]) : k === 3 ? prism(g, cx, cy) : k === 1 ? '#fff3c4' : '#e2f8ff'; g.stroke();
      for (let i = 0; i < NP; i++) { const a = -Math.PI / 2 + i * TAU / NP; sparkle(g, cx + Math.cos(a) * (SR - 3), cy + Math.sin(a) * (SR - 3), 2.6, 'rgba(255,255,255,0.9)'); }
    }
    // ⑤ 안쪽 면 + 별밭
    if (on('face')) {
      g.save(); g.beginPath(); g.arc(cx, cy, FR, 0, TAU);
      g.fillStyle = [rad(g, cx, cy, 2, FR, [[0, '#9fe8ff'], [0.35, '#1d5fb8'], [1, '#04102e']]), rad(g, cx - 8, cy - 10, 2, FR, [[0, '#ffffff'], [0.45, '#d2ebff'], [1, '#5a86c8']]),
        rad(g, cx, cy, 2, FR, [[0, '#3a0a0c'], [0.6, '#120204'], [1, '#2a0606']]), rad(g, cx, cy, 2, FR, [[0, '#ffffff'], [0.5, '#7a4ad0'], [1, '#1a0840']])][k];
      g.fill(); g.clip();
      if (k === 3) { g.globalAlpha = 0.5; g.fillStyle = prism(g, cx, cy); g.fillRect(cx - FR, cy - FR, FR * 2, FR * 2); g.globalAlpha = 1; }
      if (k !== 1) dust(g, cx, cy, 0, FR, 26, '#ffffff', 900 + k);
      g.restore();
      g.lineWidth = 4; g.strokeStyle = [lin(g, 0, cy - FR, 0, cy + FR, [[0, '#ffffff'], [0.5, '#7aa2cc'], [1, '#e9f8ff']]), lin(g, 0, cy - FR, 0, cy + FR, metalStops(['#fffbe8', '#d9aa3a', '#7a5410'])), '#ff5a2a', lin(g, 0, cy - FR, 0, cy + FR, metalStops(['#ffffff', '#ffd76a', '#8a5a06']))][k];
      g.beginPath(); g.arc(cx, cy, FR, 0, TAU); g.stroke();
      g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(cx, cy, FR - 4.5, 0, TAU); g.stroke();
    }
    // 위쪽 반사
    if (on('gloss')) { g.save(); seal(g, cx, cy, SR, NP, KK); g.clip(); g.globalAlpha = k === 2 ? 0.12 : 0.22; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - 16, cy - SR * 0.55, SR * 0.72, SR * 0.24, -0.35, 0, TAU); g.fill(); g.restore(); }
    // ⑥ 가운데 문양 (제니스는 별 · 보석을 따로)
    const cOn = on('star');
    if (k === 0 && cOn) {   // 폭발하는 별 + 렌즈 빛
      g.save(); g.shadowColor = '#8fe3ff'; g.shadowBlur = 18;
      g.fillStyle = rad(g, cx, cy, 2, 36, [[0, '#ffffff'], [0.4, '#dff7ff'], [1, '#49c6ff']]); star(g, cx, cy, 36, 8, 0.32); g.fill();
      g.fillStyle = '#ffffff'; star(g, cx, cy, 20, 4, 0.28); g.fill(); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = lin(g, cx - 74, 0, cx + 74, 0, [[0, 'rgba(120,220,255,0)'], [0.5, 'rgba(255,255,255,0.95)'], [1, 'rgba(120,220,255,0)']]); g.fillRect(cx - 74, cy - 1.6, 148, 3.2);
      g.fillStyle = lin(g, 0, cy - 46, 0, cy + 46, [[0, 'rgba(120,220,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(120,220,255,0)']]); g.fillRect(cx - 1.3, cy - 46, 2.6, 92);
      g.fillStyle = rad(g, cx, cy, 0, 15, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(cx - 15, cy - 15, 30, 30); g.restore();
    } else if (k === 1 && cOn) {   // 초승달 + 별
      g.save(); g.beginPath(); g.arc(cx - 2, cy + 2, 30, 0, TAU); g.clip();
      g.beginPath(); g.arc(cx - 2, cy + 2, 30, 0, TAU); g.arc(cx + 12, cy - 6, 26, 0, TAU);
      g.fillStyle = lin(g, cx - 32, cy - 28, cx + 8, cy + 32, [[0, '#fffbe8'], [0.5, '#f3c95a'], [1, '#a8780a']]); g.fill('evenodd'); g.restore();
      g.save(); g.shadowColor = 'rgba(255,210,110,0.95)'; g.shadowBlur = 10; g.strokeStyle = 'rgba(122,84,16,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx - 2, cy + 2, 30, 0.75, 4.95); g.stroke(); g.restore();
      g.save(); g.shadowColor = '#fff'; g.shadowBlur = 10; sparkle(g, cx + 12, cy - 6, 15, '#ffffff'); sparkle(g, cx + 22, cy + 14, 6, '#fffbe0'); sparkle(g, cx + 2, cy - 22, 5, '#fffbe0'); g.restore();
    } else if (k === 2 && cOn) {   // 검은 태양 + 코로나 + 다이아몬드 반지 섬광
      corona(g, cx, cy, 27, 20, 20, 91);
      g.fillStyle = rad(g, cx - 6, cy - 6, 2, 30, [[0, '#1c0b0b'], [1, '#000000']]); g.beginPath(); g.arc(cx, cy, 27, 0, TAU); g.fill();
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,205,150,0.95)'; g.lineWidth = 2.6; g.shadowColor = '#ff6a2a'; g.shadowBlur = 14; g.beginPath(); g.arc(cx, cy, 28, 0, TAU); g.stroke(); g.restore();
      const fa = -0.75, fx = cx + Math.cos(fa) * 28, fy = cy + Math.sin(fa) * 28;
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rad(g, fx, fy, 0, 18, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,220,170,0.8)'], [1, 'rgba(255,120,40,0)']]); g.fillRect(fx - 18, fy - 18, 36, 36); g.restore();
      sparkle(g, fx, fy, 14, 'rgba(255,255,255,0.95)');
    } else if (k === 3) {   // 금빛 팔각 별 + 큰 보석
      if (cOn) {
        g.save(); g.shadowColor = 'rgba(255,230,150,0.9)'; g.shadowBlur = 14;
        g.fillStyle = lin(g, 0, cy - 42, 0, cy + 42, [[0, '#ffffff'], [0.45, '#ffe08a'], [1, '#b8860b']]); star(g, cx, cy, 42, 8, 0.5); g.fill(); g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5; star(g, cx, cy, 42, 8, 0.5); g.stroke();
      }
      if (on('gem')) { gem(g, cx, cy, 21, ['#ffffff', '#ffb8f4', '#5a1ea8'], 8); sparkle(g, cx - 7, cy - 9, 8, 'rgba(255,255,255,0.95)'); }
    }
    // ⑦ 궤도 고리 — 앞쪽 반 + 빛 구슬
    if (on('orbF')) for (const [rx, ry, rot] of ORB) { orbitRing(g, cx, cy, rx, ry, rot, oc, 2.4, 0, Math.PI); for (const th of [0.55, 2.35]) { const [x, y] = onEllipse(cx, cy, rx, ry, rot, th); orb(g, x, y, 3.2, oc); } }
    // ⑧ 머리 장식
    const ty = cy - SR;
    if (!on('crown')) { /* 다른 구성품만 */ } else if (k === 0) {   // 수정 조각 관
      const C = ['#ffffff', '#86e0ff', '#0d3c84'];
      spike(g, cx - 11, ty + 8, -Math.PI / 2 - 0.45, 30, 12, C); spike(g, cx + 11, ty + 8, -Math.PI / 2 + 0.45, 30, 12, C); spike(g, cx, ty + 6, -Math.PI / 2, 44, 16, C);
      gem(g, cx, ty + 4, 8, ['#ffffff', '#8fe3ff', '#0b2f6e'], 4);
    } else if (k === 1) {   // 금빛 후광
      const hy = ty - 14;
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,230,160,0.55)'; g.lineWidth = 9; g.beginPath(); g.ellipse(cx, hy, 37, 9, 0, 0, TAU); g.stroke(); g.restore();
      g.strokeStyle = lin(g, cx - 37, 0, cx + 37, 0, [[0, '#a8780a'], [0.5, '#fffbe0'], [1, '#a8780a']]); g.lineWidth = 3.6; g.beginPath(); g.ellipse(cx, hy, 37, 9, 0, 0, TAU); g.stroke();
      gem(g, cx, ty + 2, 9, ['#ffffff', '#a9d8ff', '#2a5a9a'], 4);
    } else if (k === 2) {   // 흑요석 가시 관
      g.save(); g.shadowColor = 'rgba(255,60,30,0.85)'; g.shadowBlur = 8;
      for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.28, L = 40 - Math.abs(i) * 6; spike(g, cx + i * 9, ty + 9 + Math.abs(i) * 3, a, L, 13 - Math.abs(i), ['#ff9a6a', '#3a0508', '#0a0102']); }
      g.restore(); gem(g, cx, ty + 6, 9, ['#ffe0c0', '#ff3b1f', '#4a0505'], 4);
    } else {   // 무지개 후광 + 큰 왕관
      g.save(); g.globalAlpha = 0.9; g.strokeStyle = prism(g, cx, ty - 20); g.lineWidth = 4; g.beginPath(); g.arc(cx, ty - 20, 31, 0, TAU); g.stroke(); g.restore();
      crown(g, cx, ty - 12, 84, 42, ['#ffffff', '#ffe08a', '#9a6a08'], ['#ffffff', '#ff9bf0', '#7a2ac0']);
    }
    // ⑨ 반짝임
    if (on('spark')) for (const [x, y, r] of [[cx + 52, cy - 56, 7], [cx - 56, cy + 30, 5], [cx + 34, cy + 56, 4], [cx - 40, cy - 64, 5], [cx + 70, cy + 12, 3.5], [cx - 72, cy - 20, 3.5]].slice(0, 3 + k)) sparkle(g, x, y, r + k, 'rgba(255,255,255,0.95)');
    // ⑩ 단계 명판
    if (div && on('plaque')) plaque(g, cx, 224, 70 + k * 6, ROMAN[div], [['#3a86e0', '#0d2f6e', '#061633'], ['#fff2c8', '#c9962e', '#6e4c0c'], ['#3a1012', '#14040a', '#060102'], ['#5a34a8', '#2a1060', '#120630']][k],
      ['#8fe3ff', '#fff3c4', '#ff5a2a', '#ffd76a'][k], [['#ffffff', '#8fe3ff', '#0b2f6e'], ['#ffffff', '#a9d8ff', '#2a5a9a'], ['#ffe0c0', '#ff3b1f', '#4a0505'], ['#ffffff', '#ff9bf0', '#7a2ac0']][k]);
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
    if (RANK_TIERS[t].sup) { drawSup(g, t, div); return cv; }   // v23 상위 티어
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
  // 컷신용: 티어(tierOf · hcTierOf 결과) → 그 크기의 캔버스 (캐시 없이 새로)
  const embCanvas = (x, size = 512) => (x.hc ? drawHc(x.t, x.div, size) : draw(x.t, x.div, size));
  // 컷신 「합체」(제니스): 상위 티어 엠블럼을 구성품별 그림으로 — 겹치는 순서대로 [{ id, cv, x, y, w, h }]
  //  cv 는 빈 곳을 잘라낸 그림, x·y·w·h 는 엠블럼 그림(0~1) 안의 자리. 모두 제자리에 겹쳐 그리면 embCanvas 와 같은 모습
  const SUP_PARTS = ['back', 'orbB', 'wingL', 'wingR', 'seal', 'face', 'gloss', 'star', 'gem', 'orbF', 'crown', 'spark', 'plaque'];
  function embParts(x, size = 512, ids = SUP_PARTS) {
    if (!x || x.hc || !RANK_TIERS[x.t] || !RANK_TIERS[x.t].sup) return null;
    const out = [];
    for (const id of SUP_PARTS) {
      if (!ids.includes(id)) continue;
      const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d', { willReadFrequently: true });
      g.scale(size / 256, size / 256); drawSup(g, x.t, x.div, id);
      const d = g.getImageData(0, 0, size, size).data; let x0 = size, y0 = size, x1 = -1, y1 = -1;
      for (let y = 0; y < size; y++) for (let i = y * size * 4 + 3, xx = 0; xx < size; xx++, i += 4) if (d[i] > 1) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; y1 = y; }
      if (x1 < 0) continue;   // 이 티어에는 없는 구성품
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(size - 1, x1 + 2); y1 = Math.min(size - 1, y1 + 2);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, c2 = document.createElement('canvas'); c2.width = w; c2.height = h; c2.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      out.push({ id, cv: c2, x: x0 / size, y: y0 / size, w: w / size, h: h / size });
    }
    return out;
  }
  // ---------- 하드코어 랭크전 ----------
  //  참가: 일반 랭크 최고 기록이 다이아 4(2000 RP) 이상. 배치고사 없이 스토커 4(0 RP)부터
  //  봇은 전원 익스트림, 티어 세금·감점이 일반 랭크보다 크다. 기록은 S.hc (랭크 기록과 같이 서버에 저장)
  const HC0 = () => ({ rp: 0, games: 0, wins: 0, peak: 0, history: [] });
  const hcS = () => (S.hc && typeof S.hc === 'object' ? S.hc : (S.hc = HC0()));
  const hcOk = () => unlocked() && (S.peak || 0) >= HC_MIN_PEAK;
  function hcTierOf(rp) {
    rp = Math.max(0, Math.floor(rp || 0));
    const t = Math.min(4, Math.floor(rp / 400)), inT = rp - t * 400;
    const div = t === 4 ? Math.max(1, 4 - Math.floor(inT / 100)) : 4 - Math.floor(inT / 100);
    const top = t === 4 && div === 1, base = t * 400 + (4 - div) * 100;
    return { hc: true, t, div, rp, name: HC_TIERS[t].name, label: `${HC_TIERS[t].name} ${div}`, into: rp - base, need: top ? null : 100, top, pct: top ? 100 : rp - base };
  }
  // v23 잠수 막기: 순위 점수는 싸운 만큼만 — 처치 2 (또는 피해 300, 처치 1 + 피해 150)면 다 받고, 한 번도 안 싸웠으면 20%만
  const fightK = (r) => clamp(((r.kills || 0) + (r.dmg || 0) / 150) / 2, 0, 1);
  function rpDeltaHc(r, t) {
    const p = (r.place - 1) / Math.max(1, r.total - 1);
    let d = 52 * (1 - p) ** 2 * (0.2 + 0.8 * fightK(r)) - 24 + (r.win ? 26 : 0) + Math.min(r.kills, 12) * 6 + Math.min(r.dmg, 2000) / 100 - t * 4;
    if (r.quit) d = Math.min(d, -35) - 15;
    return Math.round(clamp(d, -60, 150));
  }
  function applyHc(r) {
    const H = hcS(); H.games++; if (r.win) H.wins++;
    const before = hcTierOf(H.rp), delta = rpDeltaHc(r, before.t);
    H.rp = Math.max(0, H.rp + delta); H.peak = Math.max(H.peak || 0, H.rp);
    const after = hcTierOf(H.rp), rank = (x) => x.t * 4 + (4 - x.div);
    const p = (r.place - 1) / Math.max(1, r.total - 1), lazy = r.quit ? 0 : Math.round(52 * (1 - p) ** 2 * 0.8 * (1 - fightK(r)));   // 싸우지 않아 덜 받은 순위 점수
    H.history = [{ place: r.place, total: r.total, kills: r.kills, delta, rp: H.rp, t: Date.now() }].concat(H.history || []).slice(0, 10); save();
    return { hc: true, placement: false, delta, lazy: lazy >= 3 ? lazy : 0, before, after, promoted: rank(after) > rank(before), demoted: rank(after) < rank(before), tierUp: after.t > before.t };
  }
  // 하드코어 휘장: 위아래가 뾰족한 각진 판(흑철) + 티어별 장식. 단계는 각진 명판에 로마 숫자
  function blade(g, cx, cy, w, h) {
    poly(g, [[cx, cy - h / 2], [cx + w * 0.22, cy - h * 0.36], [cx + w / 2, cy - h * 0.3], [cx + w * 0.44, cy + h * 0.08], [cx + w * 0.2, cy + h * 0.3], [cx, cy + h / 2],
      [cx - w * 0.2, cy + h * 0.3], [cx - w * 0.44, cy + h * 0.08], [cx - w / 2, cy - h * 0.3], [cx - w * 0.22, cy - h * 0.36]]);
  }
  // 갈라진 틈: 시드 고정 지그재그 선을 빛 색으로 (겹쳐 그려 번지게)
  function cracks(g, cx, cy, r, col, n, seed) {
    const R = mulberry32(seed); g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = R() * TAU; let x = cx + Math.cos(a) * r * 0.2, y = cy + Math.sin(a) * r * 0.2; const pts = [[x, y]];
      for (let k = 0; k < 4; k++) { const aa = a + (R() - 0.5) * 1.1, L = r * (0.12 + R() * 0.14); x += Math.cos(aa) * L; y += Math.sin(aa) * L; pts.push([x, y]); }
      for (const [lw, al] of [[5, 0.25], [2.2, 0.9]]) { g.beginPath(); pts.forEach(([px, py], j) => j ? g.lineTo(px, py) : g.moveTo(px, py)); g.strokeStyle = col; g.globalAlpha = al; g.lineWidth = lw; g.stroke(); }
    }
    g.restore();
  }
  function spike(g, x, y, a, L, w, cols) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, -w / 2); g.quadraticCurveTo(L * 0.6, -w * 0.25, L, 0); g.quadraticCurveTo(L * 0.6, w * 0.25, 0, w / 2); g.closePath();
    g.fillStyle = lin(g, 0, 0, L, 0, [[0, cols[2]], [0.6, cols[1]], [1, cols[0]]]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke(); g.restore();
  }
  function hcBlade(g, cx, cy, side) {   // 뒤에 엇갈린 칼날 (슬레이어~)
    g.save(); g.translate(cx, cy); g.rotate(side * 0.72);
    poly(g, [[-7, 92], [7, 92], [9, -70], [0, -102], [-9, -70]]); g.fillStyle = lin(g, -9, 0, 9, 0, [[0, '#5d6266'], [0.5, '#f2f5f7'], [1, '#4a4e52']]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#2b2321'; g.fillRect(-20, 66, 40, 8); g.fillStyle = '#5a3b22'; g.fillRect(-5, 74, 10, 26);
    g.restore();
  }
  function scythe(g, cx, cy) {   // 리퍼: 등 뒤 큰 낫
    g.save(); g.translate(cx, cy + 12); g.scale(0.84, 0.84); g.rotate(-0.5);
    g.fillStyle = '#2a2a2e'; g.fillRect(-4, -110, 8, 220);
    g.beginPath(); g.moveTo(2, -108); g.quadraticCurveTo(96, -112, 120, -40); g.quadraticCurveTo(80, -86, 2, -84); g.closePath();
    g.fillStyle = lin(g, 0, -110, 120, -40, [[0, '#c9fbe2'], [0.4, '#7c8a86'], [1, '#1d2422']]); g.fill(); g.strokeStyle = 'rgba(77,255,166,0.8)'; g.lineWidth = 2; g.stroke();
    g.restore();
  }
  function hornCrown(g, cx, cy, cols) {   // 오버로드: 뿔 왕관
    for (let i = -3; i <= 3; i++) { const a = -Math.PI / 2 + i * 0.3, L = 46 - Math.abs(i) * 6; spike(g, cx + i * 11, cy + Math.abs(i) * 4, a, L, 15 - Math.abs(i), cols); }
  }
  function drawHc(t, div, S = 256) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    g.scale(S / 256, S / 256);
    const cx = 128, cy = 118, T = HC_TIERS[t], c = T.c, w = 118 + t * 6, hh = 150 + t * 4;
    if (T.glow) { g.fillStyle = rad(g, cx, cy, 8, 126, [[0, T.glow], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 256, 256); }
    if (t === 4) { rays(g, cx, cy, 34, 128, 18, 'rgba(255,140,40,0.75)', 0.05); flames(g, cx, cy + 22, 104); }
    if (t === 3) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; g.fillStyle = rad(g, cx + Math.cos(a) * 70, cy + Math.sin(a) * 74, 2, 34, [[0, 'rgba(80,255,170,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 256, 256); } g.restore(); scythe(g, cx, cy); }
    if (t >= 2) { hcBlade(g, cx, cy + 4, -1); hcBlade(g, cx, cy + 4, 1); }
    // 옆 가시 (헌터~)
    if (t >= 1) for (const s of [-1, 1]) { spike(g, cx + s * w * 0.46, cy - hh * 0.22, s < 0 ? Math.PI + 0.25 : -0.25, 26 + t * 7, 16, c); if (t >= 3) spike(g, cx + s * w * 0.4, cy + hh * 0.12, s < 0 ? Math.PI - 0.45 : 0.45, 20 + t * 5, 12, c); }
    if (t === 4) hornCrown(g, cx, cy - hh / 2 + 10, ['#ffe9b0', '#ff8a1e', '#3a0a00']);
    // 판 본체: 흑철 + 테두리 색
    blade(g, cx, cy, w, hh);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.fillStyle = lin(g, 0, cy - hh / 2, 0, cy + hh / 2, [[0, '#4a4644'], [0.45, '#1c1a19'], [1, '#0b0a0a']]); g.fill(); g.restore();
    g.lineWidth = t >= 2 ? 7 : 5; g.strokeStyle = lin(g, 0, cy - hh / 2, 0, cy + hh / 2, metalStops(c)); g.stroke();
    // 안쪽 판
    g.save(); g.translate(cx, cy); g.scale(0.74, 0.74); g.translate(-cx, -cy); blade(g, cx, cy, w, hh);
    g.fillStyle = rad(g, cx, cy - 6, 6, 90, [[0, t >= 3 ? c[2] : '#2a2624'], [1, '#0d0c0c']]); g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.18)'; g.stroke(); g.restore();
    // 틈에서 새는 빛
    g.save(); blade(g, cx, cy, w, hh); g.clip(); cracks(g, cx, cy, 70, T.ln, 3 + t * 2, 101 + t * 37); g.restore();
    // 위쪽 반사
    g.save(); blade(g, cx, cy, w, hh); g.clip(); g.globalAlpha = 0.16; g.fillStyle = '#fff'; poly(g, [[cx - w / 2, cy - hh * 0.3], [cx, cy - hh / 2], [cx + w * 0.1, cy - hh * 0.34], [cx - w * 0.36, cy - hh * 0.06]]); g.fill(); g.restore();
    // 중앙 문양
    g.save(); g.shadowColor = T.ln; g.shadowBlur = 14;
    if (t === 0) {   // 세 줄 발톱 자국
      g.strokeStyle = T.ln; g.lineCap = 'round'; g.lineWidth = 7;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx - 22 + i * 14, cy - 30); g.quadraticCurveTo(cx - 4 + i * 14, cy, cx + 14 + i * 14, cy + 30); g.stroke(); }
    } else if (t === 1) {   // 조준선
      g.strokeStyle = T.ln; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.stroke(); g.lineWidth = 4;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { g.beginPath(); g.moveTo(cx + dx * 14, cy + dy * 14); g.lineTo(cx + dx * 38, cy + dy * 38); g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
    } else if (t === 2) {   // 핏빛 눈
      g.fillStyle = rad(g, cx, cy, 2, 34, [[0, '#ffffff'], [0.3, '#ff4060'], [1, '#4a0010']]); g.beginPath(); g.ellipse(cx, cy, 34, 18, 0, 0, TAU); g.fill();
      g.fillStyle = '#120004'; g.beginPath(); g.ellipse(cx, cy, 5, 15, 0, 0, TAU); g.fill();
    } else if (t === 3) {   // 두건 해골
      g.fillStyle = '#e9f3ee'; g.beginPath(); g.arc(cx, cy - 6, 24, Math.PI, 0); g.lineTo(cx + 18, cy + 18); g.lineTo(cx - 18, cy + 18); g.closePath(); g.fill();
      g.fillStyle = '#05281a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 9, cy - 4, 7, 8, 0, 0, TAU); g.fill(); }
      g.fillStyle = T.ln; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 9, cy - 4, 2.6, 0, TAU); g.fill(); }
      g.fillStyle = '#05281a'; for (let i = -2; i <= 2; i++) g.fillRect(cx + i * 6 - 1.5, cy + 10, 3, 8);
      g.strokeStyle = 'rgba(77,255,166,0.85)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy - 2, 36, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    } else {   // 녹은 핵
      gem(g, cx, cy, 30, ['#fff4c0', '#ff7a18', '#4a0a00'], 6);
      g.fillStyle = '#140400'; star(g, cx, cy, 13, 4, 0.35, 0); g.fill();
    }
    g.restore();
    if (t >= 3) for (const [x, y, r] of [[cx + 50, cy - 56, 6], [cx - 54, cy + 34, 5], [cx + 36, cy + 58, 4]]) sparkle(g, x, y, r, t === 3 ? 'rgba(160,255,210,0.95)' : 'rgba(255,220,140,0.95)');
    // 단계: 각진 명판
    if (div) {
      const y = 222, pw = 64 + t * 6, ph = 30;
      poly(g, [[cx - pw / 2, y - ph / 2], [cx + pw / 2, y - ph / 2], [cx + pw / 2 + 10, y], [cx + pw / 2, y + ph / 2], [cx - pw / 2, y + ph / 2], [cx - pw / 2 - 10, y]]);
      g.fillStyle = lin(g, 0, y - ph / 2, 0, y + ph / 2, [[0, '#3a3634'], [1, '#0e0d0d']]); g.fill(); g.lineWidth = 3; g.strokeStyle = T.ln; g.stroke();
      g.font = '800 24px "Saira Condensed","Arial Narrow",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.shadowColor = T.ln; g.shadowBlur = 8; g.fillText(ROMAN[div], cx, y + 1); g.shadowBlur = 0;
    }
    return cv;
  }
  function hcEmblem(t, div, size = 128) {
    const key = 'hc' + t + ':' + (div || 0) + ':' + size;
    if (!cache[key]) { try { cache[key] = drawHc(t, div, size).toDataURL('image/png'); } catch (e) { cache[key] = ''; } }
    return cache[key];
  }
  const embOf = (x, size) => x.hc ? hcEmblem(x.t, x.div, size) : emblem(x.t, x.div, size);   // tierOf / hcTierOf 결과 → 엠블럼
  function hcStatus() {
    if (!hcOk()) return { kind: 'locked', hc: true, emb: emblem(-2, 0), label: '하드코어 잠김', sub: `일반 랭크 최고 다이아 4 이상 (현재 최고 ${placed() ? peakTier().label : '배치 전'})` };
    const H = hcS(), ti = hcTierOf(H.rp);
    return { kind: 'ranked', hc: true, emb: hcEmblem(ti.t, ti.div), label: ti.label, sub: ti.top ? `${H.rp} RP` : `${ti.into} / 100 RP`, tier: ti };
  }
  // 현재 상태의 엠블럼/라벨 (승급전 중이면 series: { n 연속 성공, need, next 다음 티어 번호 })
  function status() {
    if (!unlocked()) return { kind: 'locked', emb: emblem(-2, 0), label: '랭크 잠김', sub: `레벨 3부터 (현재 레벨 ${levelFromXp(STATS.xp).lv})` };
    if (!placed()) return { kind: 'placement', emb: emblem(-1, 0), label: '배치고사', sub: `${S.placed} / 3 완료` };
    const ti = mine();
    if (ti.series) { const need = SUP.need[S.sg]; return { kind: 'ranked', emb: emblem(ti.t, ti.div), label: `${ti.label} · 승급전`, sub: `연속 성공 ${S.ss} / ${need} → ${RANK_TIERS[ti.t + 1].name} 5`, tier: ti, series: { n: S.ss, need, next: ti.t + 1 } }; }
    return { kind: 'ranked', emb: emblem(ti.t, ti.div), label: ti.label, sub: ti.top ? `${S.rp} RP` : `${ti.into} / ${ti.need} RP`, tier: ti };
  }
  return { get state() { return S; }, get hc() { return hcS(); }, hcOk, hcTierOf, applyHc, hcEmblem, hcStatus, embOf, embCanvas, embParts, rpDeltaHc, unlocked, placed, tierOf, mine, peakTier, viewOf, series, settle, cutSeen, ord, apply, botDifficulty, botCount, mixOf, emblem, status, placementScore, rpDelta,
    reset() { S = S0(); norm(S); save(); }, _set(o) { Object.assign(S, o); norm(S); save(); },
    // 계정 전환: 통째로 바꿔 끼움 (저장 알림 없이) — 개편 전 기록이면 norm 이 옮긴다
    replace(o) { S = Object.assign(S0(), o || {}); norm(S); store.set('rank', S); }, normOf, mergeRank };
})();
