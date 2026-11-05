// ============================================================
// 10_eco.js — 상점 경제: 재화 · 보유 스킨 · 뽑기 확률 · 교환소 · 미션 · 출석 보상
//  · 재화 '골드 탄피': 뽑기(레어 등급으로 나옴) · 배틀로얄 경기 중 주운 골드 탄피 주머니 · 미션 · 출석 보상
//  · '차량 교환 코인': 차량 뽑기(높은 확률) · 출석 6일째 → 교환소에서 차량 스킨과 바꿈
//  · 저장: STATS.eco(재화·미션·출석) · STATS.skins(옷) · STATS.vskins(차량) → 로그인하면 서버(player_data.stats)에 함께 저장
//  · 여러 기기: 서버에 다른 기기가 쓴 기록이 있으면 '마지막 동기화 이후 바뀐 양'만 더해 합친다 (mergeStats)
//    → 한 기기에서 쓴 재화가 다른 기기의 옛 기록 때문에 되살아나거나, 얻은 스킨이 사라지지 않는다
//  · 확률은 상자마다 공개(상점 '확률' 버튼). 무작위는 이 기기에서 뽑는다(실제 돈 결제가 없는 게임 재화)
// ============================================================
const GOLD_NAME = '골드 탄피', COIN_NAME = '차량 교환 코인';
const BOXES = {
  br: { name: '배틀로얄 상자', theme: '전장 테마 옷', cost: 100, accent: '#9db35e', hex: 0x6f8a3a },
  sp: { name: '스페셜 상자', theme: '스트리트 테마 옷', cost: 100, accent: '#ff6fb0', hex: 0xd0457f },
  sup: { name: '보급 상자', theme: '엘리트 테마 옷', cost: 100, accent: '#f0a43a', hex: 0xd07a1e },
  veh: { name: '차량 뽑기', theme: '교환 코인 · 차량 스킨', cost: 1000, accent: '#46c8ff', hex: 0x2a8ac0 },
};
const BOX_TIER_P = [45, 25, 18, 8, 3.2, 0.8];                 // 옷 상자의 레어도별 확률(%) — 2번(레어)은 골드 탄피
const BOX_GOLD = [[30, 9], [60, 6], [150, 2.5], [500, 0.5]];   // 상자 속 골드 탄피 [양, %] (합 18%)
const DUP_GOLD = [10, 20, 0, 60, 150, 400];                     // 이미 가진 옷이 나오면 레어도별 골드 탄피 환급
const VEH_COINS = [[3, 55], [5, 25], [10, 10], [20, 2]];        // 차량 뽑기 코인 [개수, %] (합 92%)
const VEH_SKIN_P = { 3: 5.5, 4: 2, 5: 0.5 };                    // 차량 뽑기 스킨 레어도별 합(%) — 같은 레어도 안에서 똑같이 나눔
const ATTEND = [{ gold: 50 }, { gold: 50 }, { gold: 100 }, { gold: 50 }, { gold: 100 }, { coin: 3 }, { gold: 300 }];
const WELCOME_GOLD = 1000;
// 미션: key = 경기에서 세는 값. 일일 미션은 날마다 4개(겹치는 key 없이), 주간 미션은 4개 고정
const QUESTS = {
  d_play: { name: '배틀로얄 1판 완료', goal: 1, key: 'play', gold: 30 },
  d_play3: { name: '배틀로얄 3판 완료', goal: 3, key: 'play', gold: 60 },
  d_kill5: { name: '적 5명 처치', goal: 5, key: 'kill', gold: 40 },
  d_head3: { name: '헤드샷 3번 맞히기', goal: 3, key: 'head', gold: 30 },
  d_dmg500: { name: '피해 500 주기', goal: 500, key: 'dmg', gold: 40 },
  d_top10: { name: '10위 안에 들기', goal: 1, key: 'top10', gold: 40 },
  d_drive: { name: '차량으로 2km 이동', goal: 2000, key: 'drive', gold: 30, unit: 'm' },
  d_loot: { name: '아이템 30개 줍기', goal: 30, key: 'loot', gold: 20 },
  d_heal: { name: '회복 아이템 5번 사용', goal: 5, key: 'heal', gold: 20 },
  d_surv: { name: '한 판에서 10분 생존', goal: 600, key: 'surv', gold: 30, unit: 's', max: true },
  d_gold: { name: '골드 탄피 주머니 찾기', goal: 1, key: 'goldFind', gold: 20 },
  d_drop: { name: '보급품 상자에서 아이템 줍기', goal: 1, key: 'drop', gold: 40 },
};
const WEEKLY = {
  w_play10: { name: '배틀로얄 10판 완료', goal: 10, key: 'play', gold: 150 },
  w_kill30: { name: '적 30명 처치', goal: 30, key: 'kill', gold: 150 },
  w_win: { name: '우승 1번', goal: 1, key: 'win', gold: 200 },
  w_pull5: { name: '상점 상자 5번 뽑기', goal: 5, key: 'pull', gold: 100 },
};
const DAILY_BONUS = 50;   // 일일 미션 4개를 모두 받으면

const Eco = (() => {
  const DEV = (() => { let d = store.get('devId', null); if (!d) { d = Math.random().toString(36).slice(2, 10); store.set('devId', d); } return d; })();
  const listeners = [];
  const pad2 = (n) => String(n).padStart(2, '0');
  // 기기 시간 기준 날짜 / 주(월요일 시작)
  function today(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function weekKey(d = new Date()) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return 'W' + today(m); }
  function E() {
    if (!STATS.eco || typeof STATS.eco !== 'object') { STATS.eco = { v: 1, gold: WELCOME_GOLD, coin: 0, rev: 1, dev: DEV, pulls: {}, att: { last: '', n: 0 }, q: null, welcome: 1 }; }
    const e = STATS.eco;
    if (!Array.isArray(STATS.skins)) STATS.skins = [];
    if (!Array.isArray(STATS.vskins)) STATS.vskins = [];
    if (!e.pulls) e.pulls = {}; if (!e.att) e.att = { last: '', n: 0 };
    rollQuests(e);
    return e;
  }
  function changed(what) { const e = E(); e.rev = (e.rev || 0) + 1; e.dev = DEV; saveStats(); for (const f of listeners) try { f(what); } catch (err) { console.warn(err); } }
  // ---------- 보유 ----------
  const owns = (id) => Body.SKINS[id] && (/_basic$/.test(id) || (STATS.skins || []).includes(id));
  const ownsVeh = (id) => (STATS.vskins || []).includes(id);
  function ownedSkins() { const s = new Set(Object.keys(Body.SKINS).filter((k) => /_basic$/.test(k))); for (const k of (STATS.skins || [])) if (Body.SKINS[k]) s.add(k); return s; }
  // ---------- 뽑기 확률표 ----------
  const POOLS = {};
  function pool(box) {
    if (POOLS[box]) return POOLS[box];
    const out = [];
    if (box === 'veh') {
      for (const [n, p] of VEH_COINS) out.push({ k: 'coin', n, rar: 2, p });
      for (const r of [3, 4, 5]) { const ids = Object.keys(VSKINS).filter((id) => VSKINS[id].rar === r); for (const id of ids) out.push({ k: 'vskin', id, rar: r, p: VEH_SKIN_P[r] / ids.length }); }
    } else {
      for (let r = 0; r < BOX_TIER_P.length; r++) {
        if (r === 2) { for (const [n, p] of BOX_GOLD) out.push({ k: 'gold', n, rar: 2, p }); continue; }
        const ids = Object.keys(Body.SKINS).filter((id) => Body.SKINS[id].box === box && Body.SKINS[id].rar === r);
        for (const id of ids) out.push({ k: 'skin', id, rar: r, p: BOX_TIER_P[r] / ids.length });
      }
    }
    const tot = out.reduce((a, x) => a + x.p, 0); for (const x of out) x.p = x.p * 100 / tot;   // 빈 등급이 있어도 합 100%
    return (POOLS[box] = out);
  }
  function draw(box, rnd = Math.random) {
    const P = pool(box); let r = rnd() * 100;
    for (const x of P) { r -= x.p; if (r < 0) return x; }
    return P[P.length - 1];
  }
  // 보상 지급(뽑기·교환 공통) → 결과 카드 정보
  function give(x) {
    const e = E(), o = { k: x.k, id: x.id, n: x.n, rar: x.rar };
    if (x.k === 'gold') e.gold += x.n;
    else if (x.k === 'coin') e.coin += x.n;
    else if (x.k === 'skin') { if (owns(x.id)) { o.dup = true; o.refund = DUP_GOLD[x.rar] || 10; e.gold += o.refund; } else { STATS.skins.push(x.id); o.isNew = true; } }
    else if (x.k === 'vskin') { if (ownsVeh(x.id)) { o.dup = true; o.refundCoin = Math.ceil(VSKINS[x.id].price / 2); e.coin += o.refundCoin; } else { STATS.vskins.push(x.id); o.isNew = true; } }
    return o;
  }
  function pull(box, n = 1) {
    const B = BOXES[box], e = E(); if (!B) return { err: '없는 상자입니다' };
    const cost = B.cost * n;
    if (e.gold < cost) return { err: `${GOLD_NAME}이(가) 부족합니다 (필요 ${cost.toLocaleString()} · 보유 ${e.gold.toLocaleString()})` };
    e.gold -= cost;
    const res = []; for (let i = 0; i < n; i++) res.push(give(draw(box)));
    e.pulls[box] = (e.pulls[box] || 0) + n;
    if (box !== 'veh') questAdd('pull', n, true);
    changed('pull');
    return { res, cost, best: res.reduce((m, x) => Math.max(m, x.rar), 0) };
  }
  function exchange(id) {
    const V = VSKINS[id], e = E(); if (!V) return { err: '없는 차량입니다' };
    if (ownsVeh(id)) return { err: '이미 가지고 있습니다' };
    if (e.coin < V.price) return { err: `${COIN_NAME}이 부족합니다 (필요 ${V.price} · 보유 ${e.coin})` };
    e.coin -= V.price; const o = give({ k: 'vskin', id, rar: V.rar }); changed('exchange');
    return { res: [o], best: V.rar };
  }
  // ---------- 출석 ----------
  function attendInfo() { const e = E(), a = e.att; return { can: a.last !== today(), n: a.n, day: a.n % 7, rewards: ATTEND, last: a.last }; }
  function attend() {
    const e = E(), a = e.att; if (a.last === today()) return { err: '오늘은 이미 받았습니다' };
    const R = ATTEND[a.n % 7]; a.n++; a.last = today();
    if (R.gold) e.gold += R.gold; if (R.coin) e.coin += R.coin;
    changed('attend'); return { reward: R, day: (a.n - 1) % 7 + 1 };
  }
  // ---------- 미션 ----------
  function rollQuests(e) {
    const d = today(), w = weekKey();
    if (!e.q || e.q.d !== d) {
      // 날짜 시드로 4개 (같은 key는 한 번만)
      const rng = mulberry32([...d].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)), ids = Object.keys(QUESTS), pickd = [], keys = new Set();
      while (pickd.length < 4 && ids.length) { const i = Math.floor(rng() * ids.length), id = ids.splice(i, 1)[0]; if (keys.has(QUESTS[id].key)) continue; keys.add(QUESTS[id].key); pickd.push(id); }
      const old = e.q || {};
      e.q = { d, ids: pickd, p: {}, c: [], bonus: 0, w: old.w, wp: old.wp || {}, wc: old.wc || [] };
    }
    if (e.q.w !== w) { e.q.w = w; e.q.wp = {}; e.q.wc = []; }
  }
  function questList() {
    const e = E(), q = e.q;
    const row = (id, Q, prog, claimed) => ({ id, name: Q.name, goal: Q.goal, cur: Math.min(Q.goal, prog[Q.key] || 0), gold: Q.gold, unit: Q.unit, done: (prog[Q.key] || 0) >= Q.goal, claimed: claimed.includes(id) });
    const daily = q.ids.map((id) => row(id, QUESTS[id], q.p, q.c)), weekly = Object.keys(WEEKLY).map((id) => row(id, WEEKLY[id], q.wp, q.wc));
    return { daily, weekly, bonus: { gold: DAILY_BONUS, can: !q.bonus && daily.every((x) => x.claimed), got: !!q.bonus } };
  }
  // n만큼 더하기(최대형 key는 큰 값으로). silent: 저장은 호출한 쪽에서
  function questAdd(key, n, silent) {
    if (!n) return; const e = E(), q = e.q;
    for (const [P, list] of [[q.p, q.ids.map((id) => QUESTS[id])], [q.wp, Object.values(WEEKLY)]]) {
      const Q = list.find((x) => x.key === key); if (!Q) continue;
      P[key] = Q.max ? Math.max(P[key] || 0, n) : (P[key] || 0) + n;
    }
    if (!silent) changed('quest');
  }
  function claim(id) {
    const e = E(), q = e.q, Q = QUESTS[id] || WEEKLY[id]; if (!Q) return { err: '없는 미션' };
    const weekly = !!WEEKLY[id], P = weekly ? q.wp : q.p, C = weekly ? q.wc : q.c;
    if (!weekly && !q.ids.includes(id)) return { err: '오늘의 미션이 아닙니다' };
    if (C.includes(id)) return { err: '이미 받았습니다' };
    if ((P[Q.key] || 0) < Q.goal) return { err: '아직 완료하지 않았습니다' };
    C.push(id); e.gold += Q.gold; changed('claim');
    return { gold: Q.gold };
  }
  function claimBonus() { const L = questList(); if (!L.bonus.can) return { err: '일일 미션을 모두 받아야 합니다' }; E().q.bonus = 1; E().gold += DAILY_BONUS; changed('claim'); return { gold: DAILY_BONUS }; }
  // 받을 것이 있나(탭 배지)
  function claimable() { const L = questList(); return attendInfo().can || L.bonus.can || L.daily.some((x) => x.done && !x.claimed) || L.weekly.some((x) => x.done && !x.claimed); }
  // 배틀로얄 경기 끝: 경기 기록으로 미션 진행 (훈련장·데스매치는 호출하지 않음)
  function matchEnd(m) {
    E();
    const add = { play: m.quit ? 0 : 1, kill: m.kills, head: m.heads, dmg: Math.round(m.dmg), top10: m.place <= 10 ? 1 : 0, drive: Math.round(m.drive), loot: m.loot, heal: m.heals, goldFind: m.goldN, drop: m.drops, win: m.win ? 1 : 0 };
    for (const k in add) questAdd(k, add[k], true);
    questAdd('surv', Math.round(m.surv), true);
    changed('match');
  }
  // 경기 중 골드 탄피 주머니 (바로 지급)
  function found(n) { E().gold += n; changed('found'); }
  // ---------- 장착(차량) ----------
  function vlook() { const v = SETTINGS.vlook && typeof SETTINGS.vlook === 'object' ? SETTINGS.vlook : {}; const out = {}; for (const t in VEH_SKIN_TYPES) out[t] = v[t] && VSKINS[v[t]] && VSKINS[v[t]].veh === t && ownsVeh(v[t]) ? v[t] : null; return out; }
  function equipVeh(type, id) { const v = vlook(); v[type] = id && ownsVeh(id) ? id : null; SETTINGS.vlook = v; saveSettings(); for (const f of listeners) try { f('vequip'); } catch (err) { console.warn(err); } }
  // ---------- 여러 기기 합치기 ----------
  //  base: 마지막 동기화 때의 기록, local: 이 기기, server: 서버. 숫자(재화·전적)는 서버 + (이 기기에서 늘어난/줄어든 양)
  function mergeStats(base, local, server) {
    const B = base || {}, L = local || {}, S = server || {}, out = Object.assign({}, S);
    const delta = (b, l, s) => (s || 0) + ((l || 0) - (b || 0));
    for (const k of ['matches', 'wins', 'kills', 'xp']) out[k] = Math.max(0, base ? delta(B[k], L[k], S[k]) : Math.max(L[k] || 0, S[k] || 0));
    out.best = Math.min(L.best || 99, S.best || 99);
    out.recent = JSON.stringify(L.recent || []) !== JSON.stringify(B.recent || []) ? (L.recent || []) : (S.recent || L.recent || []);
    const dm = {}, Bd = B.dm || {}, Ld = L.dm || {}, Sd = S.dm || {}; for (const k of ['matches', 'wins', 'kills', 'deaths']) dm[k] = Math.max(0, base ? delta(Bd[k], Ld[k], Sd[k]) : Math.max(Ld[k] || 0, Sd[k] || 0)); out.dm = dm;
    out.skins = [...new Set([...(S.skins || []), ...(L.skins || [])])];
    out.vskins = [...new Set([...(S.vskins || []), ...(L.vskins || [])])];
    const Be = B.eco || {}, Le = L.eco, Se = S.eco;
    if (Le || Se) {
      const le = Le || {}, se = Se || {}, e = Object.assign({}, se.v ? se : le);
      e.gold = Math.max(0, Se && Le ? (base ? delta(Be.gold, le.gold, se.gold) : Math.max(le.gold || 0, se.gold || 0)) : (le.gold !== undefined ? le.gold : se.gold || 0));
      e.coin = Math.max(0, Se && Le ? (base ? delta(Be.coin, le.coin, se.coin) : Math.max(le.coin || 0, se.coin || 0)) : (le.coin !== undefined ? le.coin : se.coin || 0));
      const pulls = {}; for (const k of new Set([...Object.keys(le.pulls || {}), ...Object.keys(se.pulls || {})])) pulls[k] = Math.max((le.pulls || {})[k] || 0, (se.pulls || {})[k] || 0); e.pulls = pulls;
      const la = le.att || { last: '', n: 0 }, sa = se.att || { last: '', n: 0 }; e.att = { last: la.last > sa.last ? la.last : sa.last, n: Math.max(la.n || 0, sa.n || 0) };
      const lq = le.q, sq = se.q;
      if (lq && sq) {
        const q = Object.assign({}, lq.d >= sq.d ? lq : sq);
        if (lq.d === sq.d) { q.p = {}; for (const k of new Set([...Object.keys(lq.p || {}), ...Object.keys(sq.p || {})])) q.p[k] = Math.max((lq.p || {})[k] || 0, (sq.p || {})[k] || 0); q.c = [...new Set([...(lq.c || []), ...(sq.c || [])])]; q.bonus = lq.bonus || sq.bonus ? 1 : 0; }
        if (lq.w === sq.w) { q.wp = {}; for (const k of new Set([...Object.keys(lq.wp || {}), ...Object.keys(sq.wp || {})])) q.wp[k] = Math.max((lq.wp || {})[k] || 0, (sq.wp || {})[k] || 0); q.wc = [...new Set([...(lq.wc || []), ...(sq.wc || [])])]; }
        e.q = q;
      } else e.q = lq || sq || null;
      e.welcome = 1; e.rev = Math.max(le.rev || 0, se.rev || 0) + 1; e.dev = DEV;
      out.eco = e;
    }
    return out;
  }
  return { E, today, weekKey, owns, ownsVeh, ownedSkins, pool, draw, pull, exchange, attendInfo, attend, questList, questAdd, claim, claimBonus, claimable, matchEnd, found, vlook, equipVeh, mergeStats, changed,
    on: (f) => listeners.push(f), get gold() { return E().gold; }, get coin() { return E().coin; }, DEV };
})();
