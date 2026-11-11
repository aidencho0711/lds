// ============================================================
// 봇 스킨 — 난이도가 높을수록 높은 등급의 옷·총·차량 스킨을 입는다
//  · 등급: 0 일반 · 1 고급 · 2 희귀 · 3 영웅 · 4 슈퍼레어 · 5 울트라레어 (RARITY)
//  · 옷(상의·하의·신발·장갑)은 몸 메시 하나로 합쳐져 외형마다 ~0.9MB 라, 경기마다 '옷 묶음'을 몇 벌만 만들어
//    봇들이 나눠 입는다 (지금까지의 봇 얼굴 14종과 비슷한 수). 모자·낙하산·총·차량은 따로 붙는 메시라 봇마다 따로 뽑는다
//  · 같이 하기: 시드와 봇 번호·난이도만으로 정해지므로 모든 기기에서 같은 봇이 같은 스킨
// ============================================================
const BotSkin = (() => {
  // 난이도별 등급 가중치 [0, 1, 2, 3, 4, 5] — 그 등급의 스킨이 없으면 한 단계씩 낮춰 고른다 (총·차량의 0 = 스킨 없음)
  const W = {
    easy:    [62, 30, 0, 8, 0, 0],
    normal:  [30, 36, 0, 24, 9, 1],
    hard:    [10, 22, 0, 33, 25, 10],
    extreme: [0, 4, 0, 16, 38, 42],
  };
  const KEYS = ['easy', 'normal', 'hard', 'extreme'], CODE = { easy: 'e', normal: 'n', hard: 'h', extreme: 'x' };
  const fromCode = (ch) => ({ e: 'easy', n: 'normal', h: 'hard', x: 'extreme' })[ch] || 'normal';
  const wOf = (dk) => W[dk] || W.normal;
  function rarPick(R, dk) { const w = wOf(dk); let s = 0; for (const x of w) s += x; let r = R() * s; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return 0; }
  // 표(tab)에서 조건에 맞는 것 중 등급 r 인 것 하나 (없으면 r-1, r-2 …). 0까지 내려가면 base (기본값/없음)
  function pickRar(R, list, r, base) {
    for (let k = r; k >= 0; k--) { const L = list.filter((x) => x.rar === k); if (L.length) return L[Math.floor(R() * L.length)].id; }
    return base;
  }
  let OUT = null, GUN = null, VEH = null;   // 슬롯·총·차량별 후보 목록 (처음 쓸 때 만든다)
  function lists() {
    if (OUT) return;
    OUT = {};
    for (const id in Body.SKINS) { const s = Body.SKINS[id]; (OUT[s.slot] || (OUT[s.slot] = [])).push({ id, rar: s.rar || 0 }); }
    GUN = {}; for (const id in GSKINS) { const s = GSKINS[id]; if ((s.rar || 0) >= 6) continue; (GUN[s.gun] || (GUN[s.gun] = [])).push({ id, rar: s.rar || 1 }); }
    VEH = {}; for (const id in VSKINS) { const s = VSKINS[id]; (VEH[s.veh] || (VEH[s.veh] = [])).push({ id, rar: s.rar || 3 }); }
  }
  // 옷 묶음 한 벌 (상의·하의·신발·장갑). 묶음 안에서는 등급을 비슷하게 맞춘다 (한 번 뽑은 등급 ± 1)
  function outfit(R, dk) {
    lists(); const r0 = rarPick(R, dk), near = () => Math.max(0, Math.min(5, r0 + (R() < 0.3 ? (R() < 0.5 ? -1 : 1) : 0)));
    const eq = { top: pickRar(R, OUT.top, near(), 'top_basic'), bottom: pickRar(R, OUT.bottom, near(), 'bottom_basic'), shoes: pickRar(R, OUT.shoes, near(), 'shoes_basic') };
    // 장갑: 높은 난이도일수록 자주 낀다
    eq.gloves = R() < [0.15, 0.35, 0.55, 0.75][KEYS.indexOf(dk)] ? pickRar(R, OUT.gloves || [], Math.max(1, near()), null) : null;
    // 울트라 상의를 뽑았으면 같은 계열 하의를 맞춰 입힐 때가 많다 (골드·크롬·네온 세트)
    const set = /_(gold|chrome|neon)$/.exec(eq.top); if (set && R() < 0.7) { const b = OUT.bottom.find((x) => x.id.endsWith('_' + set[1])); if (b) eq.bottom = b.id; }
    return eq;
  }
  // 경기 하나의 옷 묶음 표: 난이도마다 n 벌 (경기에 나오는 난이도 수가 많으면 벌 수를 줄여 전체를 16벌 안팎으로)
  //  ds: 이번 경기 봇 난이도 목록 · seed: 같이 하기면 모두 같은 값
  function pool(ds, seed) {
    const R = mulberry32((seed ^ 0x51ed270b) | 0), used = KEYS.filter((k) => ds.includes(k));
    const per = Math.max(3, Math.round(16 / Math.max(1, used.length))), P = {};
    for (const k of used) { P[k] = []; for (let i = 0; i < per; i++) P[k].push({ eq: outfit(R, k), body: Body.randomBody(R) }); }
    return P;
  }
  // 봇 한 명분: 옷 묶음 하나 + 모자·낙하산 + 총별 스킨 + 차량별 스킨
  //  i: 봇 번호(경기 안에서 고정) · P: pool() 결과
  function forBot(P, dk, seed, i) {
    lists();
    const R = mulberry32(((seed ^ 0x2c1b3c6d) + Math.imul(i + 1, 0x9e3779b1)) | 0), L = P[dk] || P[Object.keys(P)[0]];
    const o = L[Math.floor(R() * L.length)], eq = Object.assign({}, o.eq);
    // 모자: 반쯤은 맨머리, 쓰면 난이도 등급으로
    eq.hat = R() < [0.35, 0.5, 0.6, 0.7][KEYS.indexOf(dk)] ? pickRar(R, OUT.hat || [], Math.max(0, rarPick(R, dk)), null) : null;
    eq.chute = pickRar(R, OUT.chute || [], rarPick(R, dk), 'chute_basic');
    const gun = {}; for (const g in GUN) { const s = pickRar(R, GUN[g], rarPick(R, dk), null); if (s) gun[g] = s; }
    const veh = {}; for (const t in VEH) { const s = pickRar(R, VEH[t], rarPick(R, dk), null); if (s) veh[t] = s; }
    return { look: Body.makeLook(eq, o.body), gun, veh };
  }
  // 난이도 하나 고르기 (하드코어 = 전원 익스트림, 랭크전 = 내 티어 비율, 아니면 설정. '섞어서'는 쉬움·보통·보통·어려움)
  function pickDiff(ranked, hc) { return hc ? 'extreme' : ranked ? Rank.botDifficulty() : SETTINGS.difficulty === 'mixed' ? pick(['easy', 'normal', 'normal', 'hard']) : SETTINGS.difficulty; }
  // 같이 하기 설정용: 봇 n명의 난이도를 한 글자씩 ('enhx')
  const diffCodes = (n, ranked, hc) => { let s = ''; for (let i = 0; i < n; i++) s += CODE[pickDiff(ranked, hc)] || 'n'; return s; };
  // 이번 경기 봇 몸 메시 열쇠들 — 경기가 끝나면 지워 메모리를 돌려받는다 (사람이 쓰는 외형은 남김)
  function purge(botLooks, keepLooks) {
    const keep = new Set(keepLooks.map(Body.lookKey)), C = Body.cache;
    for (const L of botLooks) { const k = Body.lookKey(L); if (keep.has(k)) continue; for (const s of ['#0', '#1', '#arms']) { const g = C.get(k + s); if (g) { g.dispose(); C.delete(k + s); } } }
  }
  return { W, KEYS, pool, forBot, pickDiff, diffCodes, fromCode, purge };
})();
