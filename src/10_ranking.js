// ============================================================
// 10_ranking.js — 랭킹 (로비 '랭킹' 탭): 레벨 · 랭크 티어 · 하드코어 티어의 1~15위
//  · 순위는 서버 함수 rank_boards() (supabase/ranking.sql)가 저장된 기록으로 그때그때 계산 — 로그인한 계정만 볼 수 있음
//  · 랭킹마다 1위는 그 주제의 칭호·테두리를 받는다 (10_ui_profile.js TI · FR 의 champ_lv / champ_tier / champ_hc)
//    1위인지는 이 랭킹 결과로만 판정 → 다른 사람이 1위가 되면 이전 1위 계정에서 칭호·테두리가 회수된다
//    회수되면 그 칭호·테두리를 달고 있던 경우 기본으로 되돌리고 서버에도 저장한다. 얻거나 잃으면 로비에 알림
//  · STATS.champ = { lv, tier, hc } : 마지막으로 확인한 1위 여부 (다시 접속했을 때 랭킹을 받기 전까지 쓰는 값)
//  · 갱신: 로그인할 때 · 랭킹 탭을 열 때 · 로비에 있는 동안 90초마다
//  · 관리자(개발자) 계정은 랭킹에서 빠진다 (개발자 도구로 기록을 바꿀 수 있으므로)
// ============================================================
const Ladder = (() => {
  const KINDS = {
    lv: { name: '레벨', title: 'champ_lv', what: '경험치가 가장 높은 계정' },
    tier: { name: '랭크 티어', title: 'champ_tier', what: '랭크 RP가 가장 높은 계정 (배치고사 완료)' },
    hc: { name: '하드코어', title: 'champ_hc', what: '하드코어 RP가 가장 높은 계정 (한 판 이상)' },
  };
  const ORDER = ['lv', 'tier', 'hc'];
  let data = null, at = 0, loading = null, err = '', kind = 'lv', uid = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR');

  // ---------- 1위 판정 ----------
  const topOf = (k) => (data && data[k] && data[k].top && data[k].top[0]) || null;
  // 이 계정이 지금 k 랭킹 1위인가 (랭킹을 아직 못 받았으면 마지막으로 확인한 값)
  function champ(k) {
    if (!Cloud.user) return false;
    if (data && uid === Cloud.uid) { const t = topOf(k); return !!(t && t.me); }
    return !!(STATS.champ && STATS.champ[k]);
  }
  // 다른 사람(아이디)이 k 랭킹 1위인가 — 파티원 칭호·랭킹 목록 표시 검사용. 랭킹을 못 받았으면 null(모름)
  function champName(k, name) { if (!data) return null; const t = topOf(k); return !!(t && name && t.name === name); }
  // 칭호·테두리 id 가 1위 보상이면 그 랭킹 종류
  const kindOfTitle = (id) => ORDER.find((k) => KINDS[k].title === id) || null;
  // 이 사람(name)이 이 칭호·테두리를 달 수 있나 (1위 보상이 아니면 true)
  function allowed(id, name) { const k = kindOfTitle(id); if (!k) return true; const r = champName(k, name); return r === null ? true : r; }
  // 진행 표시 (프로필 칭호 목록)
  function posText(k) {
    if (!Cloud.user) return '로그인 필요';
    if (!data) return err ? '랭킹 정보 없음' : '랭킹 불러오는 중';
    const B = data[k], mine = B && B.mine;
    return mine ? `지금 ${mine.pos}위 / ${fmt(B.n)}명` : '순위 없음';
  }

  // ---------- 서버에서 받기 ----------
  async function refresh(force) {
    if (!Cloud.user || !Cloud.client()) { data = null; render(); return null; }
    if (!force && data && uid === Cloud.uid && Date.now() - at < 30000) return data;
    if (loading) return loading;
    loading = (async () => {
      try {
        const { data: d, error } = await Cloud.client().rpc('rank_boards');
        if (error) throw error;
        if (!Cloud.user) return null;
        data = d || null; uid = Cloud.uid; at = Date.now(); err = '';
        check();
      } catch (e) {
        const m = String((e && (e.message || e.code)) || e);
        err = /could not find|PGRST202|does not exist/i.test(m) ? '서버에 랭킹 기능이 아직 없습니다 (supabase/ranking.sql 실행 필요)' : Cloud.msgOf(e);
      } finally { loading = null; render(); }
      return data;
    })();
    return loading;
  }
  // 1위를 얻었거나 잃었는지 → 알림 · 잃었으면 달고 있던 칭호·테두리를 기본으로 (회수)
  function check() {
    if (!data || !Cloud.user) return;
    const prev = STATS.champ && typeof STATS.champ === 'object' ? STATS.champ : {}, now = {}, got = [], lost = [];
    for (const k of ORDER) { const t = topOf(k); now[k] = t && t.me ? 1 : 0; if (now[k] && !prev[k]) got.push(k); if (!now[k] && prev[k]) lost.push(k); }
    if (!got.length && !lost.length) return;
    STATS.champ = now;
    const p = STATS.prof && typeof STATS.prof === 'object' ? STATS.prof : null;
    for (const k of lost) { const T = KINDS[k].title; if (p && p.ti === T) p.ti = null; if (p && p.fr === T) p.fr = 'none'; }
    saveStats();
    if (typeof Prof !== 'undefined') Prof.refresh();
    const tn = (k) => `「${Prof.titleName(KINDS[k].title)}」`;
    const msg = [];
    if (got.length) msg.push(`${got.map((k) => KINDS[k].name).join('·')} 랭킹 1위! 칭호와 테두리 ${got.map(tn).join('·')} 획득 (계정 정보에서 달 수 있음)`);
    if (lost.length) msg.push(`${lost.map((k) => KINDS[k].name).join('·')} 랭킹 1위를 빼앗겨 칭호와 테두리 ${lost.map(tn).join('·')} 회수`);
    if (typeof HUD !== 'undefined' && HUD.lobbyNote && G.state === 'lobby') HUD.lobbyNote(msg.join(' / '));
    if (typeof Audio !== 'undefined' && Audio.gacha && got.length) Audio.gacha('open', 5);
  }
  function clear() { data = null; uid = null; err = ''; render(); }

  // ---------- 화면 ----------
  function valueHTML(k, r) {
    if (k === 'lv') { const L = levelFromXp(r.xp || 0); return `<span class="lad-lv"><b>Lv ${L.lv}</b><small>${fmt(r.xp)} XP</small></span>`; }
    const T = k === 'tier' ? Rank.tierOf(r.rp || 0) : Rank.hcTierOf(r.hrp || 0), rp = k === 'tier' ? r.rp : r.hrp;
    return `<span class="lad-tier"><img src="${Rank.embOf(T, 64)}" alt=""><span><b>${esc(T.label)}</b><small>${fmt(rp)} RP</small></span></span>`;
  }
  // 목록 속 다른 사람의 사진·테두리·칭호: 1위 보상은 그 랭킹의 지금 1위만 (회수된 것은 기본으로)
  const frOf = (r) => (r.fr && allowed(r.fr, r.name) ? r.fr : 'none');
  const tiOf = (r) => (r.ti && allowed(r.ti, r.name) ? r.ti : null);
  function rowHTML(k, r) {
    const ti = tiOf(r);
    return `<li class="lad-row${r.pos <= 3 ? ' p' + r.pos : ''}${r.me ? ' me' : ''}"><span class="lad-pos">${r.pos}</span>${Prof.frameHTML(frOf(r), r.av || 'helmet', 34)}`
      + `<span class="lad-name"><b>${esc(r.name)}${r.me ? ' <i>나</i>' : ''}</b>${ti ? Prof.titleHTML(ti, 'sm') : ''}</span>${valueHTML(k, r)}</li>`;
  }
  function render() {
    const pane = document.querySelector('[data-pane=ladder]'); if (!pane || pane.hidden) return;
    document.querySelectorAll('#ladTabs button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    const K = KINDS[kind], champBox = $('ladChamp'), list = $('ladList'), meBox = $('ladMe'), note = $('ladNote');
    const reward = `<span class="lad-rw"><small>1위 보상</small>${Prof.titleHTML(K.title, 'sm')}${Prof.frameHTML(K.title, Cloud.user ? Prof.my().av : 'helmet', 34)}</span>`;
    meBox.innerHTML = ''; list.innerHTML = '';
    if (!Cloud.user) {
      champBox.innerHTML = `<div class="lad-empty"><b>로그인하면 랭킹을 볼 수 있습니다</b><small>레벨 · 랭크 티어 · 하드코어 티어 1~15위 — 각 랭킹 1위는 전용 칭호와 테두리를 받습니다</small><button class="btn amber" type="button" id="ladLogin">로그인</button></div>`;
      $('ladLogin').onclick = () => { Audio.init(); Audio.ui(); Cloud.open(); };
      note.textContent = ''; return;
    }
    if (!data) { champBox.innerHTML = `<div class="lad-empty"><b>${err ? esc(err) : '랭킹을 불러오는 중…'}</b>${reward}</div>`; note.textContent = ''; return; }
    const B = data[kind] || { n: 0, top: [] }, top = B.top || [], c = top[0];
    if (c) {
      const ti = tiOf(c);
      champBox.innerHTML = `<div class="lad-c${c.me ? ' me' : ''}"><span class="lad-crown">1</span>${Prof.frameHTML(frOf(c), c.av || 'helmet', 64)}`
        + `<span class="lad-cn"><small>${K.name} 랭킹 1위</small><b>${esc(c.name)}${c.me ? ' <i>나</i>' : ''}</b>${ti ? Prof.titleHTML(ti, 'sm') : ''}</span>${valueHTML(kind, c)}</div>${reward}`;
    } else champBox.innerHTML = `<div class="lad-empty"><b>아직 순위에 오른 계정이 없습니다</b><small>${K.what}이 1위가 됩니다</small>${reward}</div>`;
    list.innerHTML = top.map((r) => rowHTML(kind, r)).join('');
    const mine = B.mine;
    if (mine && mine.pos > 15) meBox.innerHTML = `<div class="lad-sep">내 순위</div><ol class="lad-list">${rowHTML(kind, mine)}</ol>`;
    else if (!mine) meBox.innerHTML = `<div class="lad-sep">내 순위</div><p class="micro">${data.admin ? '개발자(관리자) 계정은 랭킹에 들어가지 않습니다' : kind === 'lv' ? '경험치를 얻으면 순위에 오릅니다' : kind === 'tier' ? '랭크전 배치고사 3판을 마치면 순위에 오릅니다' : '하드코어 랭크전을 한 판 이상 하면 순위에 오릅니다 (일반 랭크 다이아 4 이상)'}</p>`;
    const ago = Math.max(0, Math.round((Date.now() - at) / 1000));
    note.textContent = `${K.what} 순 · 참가 ${fmt(B.n)}명 · ${ago < 5 ? '방금' : ago < 60 ? ago + '초 전' : Math.round(ago / 60) + '분 전'} 갱신 — 1위가 바뀌면 이전 1위의 칭호·테두리는 회수됩니다${err ? ' · ' + err : ''}`;
  }
  // 랭킹 탭을 열 때 (HUD.setTab)
  function open() { render(); refresh(Date.now() - at > 20000); }
  function setup() {
    document.querySelectorAll('#ladTabs button').forEach((b) => b.addEventListener('click', () => { Audio.init(); Audio.ui(); kind = b.dataset.k; render(); }));
    const rb = $('ladRefresh'); if (rb) rb.addEventListener('click', () => { Audio.init(); Audio.ui(); refresh(true); });
    // 로그인·로그아웃 (친구 모듈이 먼저 건 G.onAuth 뒤에 이어 붙임)
    const prev = G.onAuth;
    G.onAuth = (on) => { if (prev) try { prev(on); } catch (e) { console.warn(e); } if (on) refresh(true); else clear(); };
    setInterval(() => { if (G.state === 'lobby' && Cloud.user && document.visibilityState !== 'hidden' && Date.now() - at > 90000) refresh(true); }, 15000);
  }
  return { KINDS, champ, champName, allowed, kindOfTitle, posText, refresh, render, open, setup, get data() { return data; } };
})();
