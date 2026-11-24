// ============================================================
// 10_mm.js — 온라인 매칭 (v21)
//  로비 출격 버튼 옆 '온라인 매칭'(기본 켬): 켜면 같은 모드·맵·팀 구성을 고른 사람끼리 한 경기로 묶고, 끄면 지금처럼 AI 와 바로 시작
//  · 서버(supabase/matchmaking.sql): 줄 서기(mm_join) → 2초마다 확인(mm_poll) → 마감되면 먼저 줄 선 사람이 방장
//    → 방장이 경기 설정(Net.makeConfig)을 올리고(mm_cfg) 모두 같은 경기에 들어간다. 빈자리는 봇(AI)
//  · 배틀로얄(일반·랭크·하드코어): 3분 동안 줄 선 사람은 모두 한 경기로 (v22: 8명 제한 없앰 — 한 경기 최대 인원은 맵 최대 인원
//    75명·노르덴 100명, 그만큼 차면 바로 시작) → 3분이 지나면 모인 사람 + AI 로 시작 (시작 전 스타트 섬)
//  · 1대1·2대2·팀 데스매치·웨폰 데스매치: 모드 인원(2·4·8명)이 차면 바로 시작, 3분이 지나면 빈자리는 AI (스타트 섬 없음)
//    대기열은 아레나(맵)별 — '무작위'를 고른 사람끼리는 방장이 아레나를 뽑는다
//  · 파티: 방장이 파티째 줄 선다 (파티원은 같은 팀). 파티원 화면에는 '방장이 온라인 매칭 중'
//  · 경기 연결: 이 경기 전용 실시간 채널(ld-mm-<경기 번호>)로 WebRTC 신호를 주고받는다 (10_net.js)
//  · 게임 버전(NET_VER)이 대기열 키에 들어 있어 버전이 다른 사람끼리는 묶이지 않는다 · 받은 경기 설정의 버전도 다시 확인 (10_ver.js)
// ============================================================
const MM = (() => {
  const T = { wait: 180, poll: 2000 };   // 최대 대기(초) · 확인 간격(ms)
  let Q = null;      // 매칭 중(나 또는 내가 방장인 파티): { s, members, party, t0, ticket, st, busy, err, timer, cfgBusy, launched }
  let pv = null;     // 파티원: 방장이 매칭 중 { t0, n, cap, label, dm }
  let uiT = null, lastKey = '';
  const sb = () => Cloud.client();
  const now = () => Date.now();
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // 지금 고른 경기의 대기열 키 · 한 경기 사람 수(cap) · 팀 크기
  function spec(partyN) {
    const game = SETTINGS.game;
    if (isDmGame(game)) { const ts = dmTeamSize(game), am = arenaPick(); return { key: `v${NET_VER}|${game}|${am}`, cap: ts * 2, dm: true, ts, label: `${GAME_TYPES[game].name} · ${arenaLabel(am)}` }; }
    const ranked = SETTINGS.queue !== 'normal', hc = SETTINGS.queue === 'hardcore';
    const ts = ranked && partyN < 2 ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size;
    const sq = ts === 1 ? '솔로' : (Object.values(TEAM_MODES).find((m) => m.size === ts) || TEAM_MODES.solo).name;
    // 배틀로얄 한 경기 최대 사람 수 = 맵 최대 인원 (봇 자리까지 전부 사람이어도 됨) — 사실상 3분 동안 들어온 사람 모두
    return { key: `v${NET_VER}|br|${SETTINGS.map}|${SETTINGS.mode}|${ts}|${SETTINGS.queue}`, cap: mapMaxBots(SETTINGS.map) + 1, dm: false, ts, ranked, hc,
      label: `${hc ? '하드코어 · ' : ranked ? '랭크 · ' : ''}${sq} · ${MAPS[SETTINGS.map].name.replace(/\s*\(.*\)$/, '')}` };
  }
  // 이 인원으로 온라인 매칭을 할지: 켜져 있고, 파티만으로 다 차지 않고, (데스매치) 파티가 한 팀에 들어감
  function want(partyN) {
    if (!SETTINGS.online || !Cloud.user || !sb()) return false;
    const s = spec(partyN);
    if (partyN >= s.cap) return false;
    if (s.dm && partyN > s.ts) return false;
    if (partyN < 2 && ((s.ranked && !Rank.unlocked()) || (s.hc && !Rank.hcOk()))) return false;   // 자격 없는 랭크 대기열 → 지금처럼 (일반으로 시작)
    return true;
  }
  const meInfo = () => ({ uid: Cloud.uid, name: Cloud.name, look: myLook(), lv: levelFromXp(STATS.xp).lv });

  // ---------- 출격 (혼자) ----------
  // 켜져 있으면 줄 서기(true). 로그인 전이면 알리고 AI 경기(false)
  function trySolo() {
    if (Q) { cancel('매칭을 취소했습니다'); return true; }
    if (!SETTINGS.online) return false;
    if (!Cloud.user || !sb()) { HUD.lobbyNote('온라인 매칭은 로그인해야 쓸 수 있습니다 — 이번 판은 AI 매칭으로 시작합니다'); return false; }
    if (!want(1)) return false;
    start([meInfo()], false);
    return true;
  }
  // 줄 서기 시작 (혼자: [나] · 파티 방장: 파티원 전원)
  function start(members, party) {
    if (Q) cancel();
    const s = spec(members.length);
    Q = { s, members, party: !!party, t0: now(), ticket: null, st: null, busy: false, err: 0, timer: null, cfgBusy: false, launched: false };
    tellParty(); render(); join();
  }
  async function join() {
    const q = Q; if (!q) return;
    q.busy = true; let data = null;
    try { const r = await sb().rpc('mm_join', { p_qkey: q.s.key, p_cap: q.s.cap, p_wait: T.wait, p_members: q.members }); if (r.error) throw r.error; data = r.data; }
    catch (e) {
      q.busy = false; if (Q !== q) return; console.warn('mm_join', e);
      if (q.s.cap > 16 && /cap/.test(String(e && e.message || ''))) { q.s.cap = 16; schedule(300); return; }   // 서버 SQL 이 아직 예전 것(한 경기 최대 16명)이면 16명으로 다시
      if (missing(e) || ++q.err >= 3) { fail(); return; } schedule(1500); return;
    }
    q.busy = false;
    if (Q !== q) { leaveSrv(); return; }   // 그 사이 취소함
    q.err = 0; q.ticket = data.ticket; onState(data);
    if (Q === q && !q.launched) schedule();
  }
  function schedule(ms) { const q = Q; if (!q) return; clearTimeout(q.timer); q.timer = setTimeout(poll, ms || T.poll); }
  async function poll() {
    const q = Q; if (!q || q.busy || q.launched) return;
    if (G.state !== 'lobby') { cancel(); return; }
    if (spec(q.members.length).key !== q.s.key) { cancel('경기 설정이 바뀌어 매칭을 취소했습니다'); return; }
    if (!q.ticket) { join(); return; }
    q.busy = true; let data = null;
    try { const r = await sb().rpc('mm_poll', { p_ticket: q.ticket }); if (r.error) throw r.error; data = r.data; }
    catch (e) { q.busy = false; if (Q !== q) return; console.warn('mm_poll', e); if (++q.err >= 5) { fail(); return; } schedule(); return; }
    q.busy = false;
    if (Q !== q) return;
    q.err = 0;
    if (!data || data.gone) { q.ticket = null; join(); return; }   // 오래 끊겨 줄에서 빠짐 → 다시 줄 선다
    onState(data);
    if (Q === q && !q.launched) schedule();
  }
  const missing = (e) => !!e && (e.code === 'PGRST202' || /could not find|does not exist/i.test(String(e.message || '')));
  // 서버에 닿지 않음 → 이번 판은 AI 매칭으로 (누른 사람이 바로 게임을 할 수 있게)
  function fail() {
    const q = Q; if (!q) return;
    cancel(); HUD.lobbyNote('온라인 매칭 서버에 연결하지 못해 이번 판은 AI 매칭으로 시작합니다');
    setTimeout(() => { if (G.state === 'lobby') G.startMatch(true); }, 400);
  }
  function onState(st) {
    const q = Q; if (!q || !st) return;
    q.st = st; tellParty();
    if (st.closed) {
      if (st.cfg) { launch(st.cfg); return; }
      if (st.host === Cloud.uid && !q.cfgBusy) makeCfg(st);
    }
    render();
  }
  // 방장: 마감된 명단으로 경기 설정을 만들어 올림 → 성공하면 바로 시작
  async function makeCfg(st) {
    const q = Q; if (!q) return; q.cfgBusy = true;
    const humans = [];
    (st.tickets || []).forEach((t, g) => { for (const m of t.members || []) if (m && m.uid && !humans.some((h) => h.uid === m.uid)) humans.push({ uid: m.uid, name: String(m.name || '?').slice(0, 12), look: m.look || null, lv: m.lv || 1, g }); });
    if (!humans.some((h) => h.uid === Cloud.uid)) { q.cfgBusy = false; return; }
    const cfg = Net.makeConfig(humans, { mm: st.mid, spec: q.s });
    try {
      const r = await sb().rpc('mm_cfg', { p_match: st.mid, p_cfg: cfg }); if (r.error) throw r.error;
      if (Q !== q) return;
      if (r.data === 'ok') launch(cfg); else q.cfgBusy = false;   // 'no': 그 사이 방장이 바뀜 → 다음 확인에서 받음
    } catch (e) { console.warn('mm_cfg', e); q.cfgBusy = false; }
  }
  function launch(cfg) {
    const q = Q; if (!q || q.launched) return;
    // 매칭된 경기의 방장과 게임 버전이 다름 (대기열 키에 버전이 들어 있어 보통은 갈림) → 같이 하지 않음 (10_ver.js)
    if (cfg.v !== NET_VER) { cancel(); Ver.tell(cfg.v, (cfg.humans.find((h) => h.uid === cfg.host) || {}).name); return; }
    q.launched = true; clearTimeout(q.timer); Q = null;
    if (q.party) { Party.send('mm', { on: 0 }); Party.send('start', { cfg }); }
    const nh = cfg.humans.length, others = nh - q.members.length;
    HUD.lobbyNote(others > 0 ? `매칭 완료 — 다른 사람 ${others}명과 함께 시작합니다` : '같이 할 사람이 없어 AI 와 시작합니다');
    render();
    Net.join(cfg);
  }
  function leaveSrv() { const c = sb(); if (c && Cloud.user) c.rpc('mm_leave').then(() => {}, () => {}); }
  function cancel(msg) {
    const q = Q; if (!q) return;
    Q = null; clearTimeout(q.timer); leaveSrv();
    if (q.party) Party.send('mm', { on: 0 });
    if (msg) HUD.lobbyNote(msg);
    render();
  }
  // 매칭 취소하고 지금 바로 AI 와 시작 (파티면 파티원끼리)
  function aiNow() { if (!Q) return; cancel(); G.startMatch(true); }
  // 파티 인원이 바뀌면 줄을 다시 서야 함 → 취소
  function partyChanged() { if (Q && Q.party) cancel('파티 인원이 바뀌어 매칭을 취소했습니다 — 다시 출격을 눌러 주세요'); }
  function tellParty() { const q = Q; if (!q || !q.party) return; const st = q.st; Party.send('mm', { on: 1, t0: q.t0, n: st ? st.n : q.members.length, cap: q.s.cap, label: q.s.label, dm: q.s.dm ? 1 : 0, names: names(st) }); }
  // 파티원: 방장의 매칭 상태
  function onParty(m) {
    if (Party.isLeader()) return;
    pv = m.on ? { t0: Date.now() - Math.max(0, Math.min(T.wait * 1000, Date.now() - (m.t0 || Date.now()))), n: m.n || 1, cap: m.cap || 2, label: m.label || '', dm: !!m.dm, names: m.names || [] } : null;
    render();
  }
  function partyGone() { if (pv) { pv = null; render(); } }
  const names = (st) => (st && st.tickets ? st.tickets.flatMap((t, g) => (t.members || []).map((m) => ({ n: String(m.name || '?').slice(0, 12), g, me: m.uid === Cloud.uid }))) : []);

  // ---------- 화면 ----------
  function render() {
    const P0 = $('mmPanel'); if (!P0) return;
    const show = (!!Q || !!pv) && G.state === 'lobby';
    P0.hidden = !show; const L0 = P0.parentElement; if (L0) L0.classList.toggle('mm', show);
    if (show && !uiT) uiT = setInterval(tick, 250);
    if (!show && uiT) { clearInterval(uiT); uiT = null; }
    if (show) tick();
    // 매칭을 시작·끝낼 때는 로비를 다시 그려 출격 버튼 글자를 되돌린다 (그 밖에는 버튼만)
    const key = (Q ? 'q' : '') + (pv ? 'p' : '');
    if (G.state === 'lobby') { if (key !== lastKey) { lastKey = key; HUD.renderLobby(); } else decorate(); }
  }
  function tick() {
    if (!Q && !pv) return;
    const q = Q, v = pv, st = q && q.st, el = Math.min(T.wait, Math.max(0, (now() - (q ? q.t0 : v.t0)) / 1000));
    const n = st ? st.n : q ? q.members.length : v.n, cap = st ? st.cap : q ? q.s.cap : v.cap, dm = q ? q.s.dm : v.dm, closed = !!(st && st.closed);
    $('mmTitle').textContent = closed ? '매칭 완료 — 경기 준비 중' : q ? '온라인 매칭 중' : '방장이 온라인 매칭 중';
    $('mmTime').textContent = `${fmt(el)} / ${fmt(T.wait)}`;
    $('mmBar').style.width = (closed ? 100 : el / T.wait * 100).toFixed(1) + '%';
    $('mmSub').textContent = dm ? `${q ? q.s.label : v.label} · 사람 ${n}/${cap}명 · 다 모이면 바로 시작, ${fmt(T.wait)}이 지나면 빈자리는 AI`
      : `${q ? q.s.label : v.label} · 사람 ${n}명 · ${fmt(T.wait)} 동안 들어온 사람 모두와 시작 (빈자리는 AI)`;
    const who = $('mmWho'), list = q ? names(st) : v.names || [], key = JSON.stringify(list);
    if (who._k !== key) {
      who._k = key; who.innerHTML = '';
      for (const x of list.slice(0, 16)) { const s = document.createElement('span'); s.className = 'mm-chip' + (x.me ? ' me' : '') + ' g' + (x.g % 6); s.textContent = x.n; who.appendChild(s); }
    }
    $('mmBtns').hidden = !q || closed;
    if (q) decorate();
  }
  // 출격 버튼: 매칭 중이면 '매칭 취소' · 온라인 매칭 켬/끔 버튼
  function decorate() {
    const b = $('playBtn'), o = $('onlineBtn'); if (!b || !o) return;
    const L = Party.lockInfo(), member = !!(L && !L.leader);
    o.classList.toggle('on', !!SETTINGS.online); o.classList.toggle('lock', member);
    o.querySelector('small').textContent = SETTINGS.online ? (Cloud.user ? '켬' : '켬 · 로그인 필요') : '끔 · AI 매칭';
    o.title = member ? '방장이 정합니다' : SETTINGS.online ? '켬: 같은 모드를 고른 사람끼리 매칭 (빈자리는 AI) · 누르면 끔' : '끔: AI 와 바로 시작 · 누르면 켬';
    b.classList.toggle('mm', !!Q);
    if (Q) {
      const st = Q.st, el = Math.min(T.wait, Math.max(0, (now() - Q.t0) / 1000));
      b.querySelector('span').textContent = '매칭 취소';
      $('playSub').textContent = `매칭 중 ${fmt(el)} · 사람 ${st ? st.n : Q.members.length}${Q.s.dm ? '/' + (st ? st.cap : Q.s.cap) : '명'}`;
    }
  }
  function toggle() {
    const L = Party.lockInfo(); if (L && !L.leader) { HUD.lobbyNote('온라인 매칭은 방장이 정합니다'); return; }
    SETTINGS.online = !SETTINGS.online; saveSettings();
    if (!SETTINGS.online && Q) cancel('온라인 매칭을 꺼서 매칭을 취소했습니다');
    HUD.lobbyNote(SETTINGS.online ? '온라인 매칭 켬 — 같은 모드를 고른 사람끼리 한 경기로 묶고, 빈자리는 AI 로 채웁니다' : '온라인 매칭 끔 — AI 와 바로 시작합니다');
    HUD.renderLobby(); if (L) Party.settingsChanged();
  }
  function setup() {
    $('onlineBtn').addEventListener('click', () => { Audio.init(); Audio.ui(); toggle(); });
    $('mmCancel').addEventListener('click', () => { Audio.init(); Audio.ui(); cancel('매칭을 취소했습니다'); });
    $('mmAi').addEventListener('click', () => { Audio.init(); Audio.ui(); aiNow(); });
    window.addEventListener('pagehide', () => { if (Q) leaveSrv(); });
  }

  // ---------- 경기 채널 (10_net.js 가 신호·중계에 씀) ----------
  let ch = null, chOk = false, chQ = [], chMid = null;
  function chOpen(mid, onMsg, onReady) {
    chClose(); const c = sb(); if (!c) return;
    chMid = mid; ch = c.channel('ld-mm-' + mid, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'm' }, (m) => { const p = m && m.payload; if (p && p.from !== Cloud.uid) onMsg(p); });
    const mine = ch;
    ch.subscribe((st) => {
      if (ch !== mine) return;
      const was = chOk; chOk = st === 'SUBSCRIBED';
      if (chOk && !was) { const q = chQ.splice(0); for (const x of q) chSend(x.k, x.d); if (onReady) onReady(); }
    });
  }
  function chSend(k, data) {
    if (!ch) return false;
    if (!chOk) { chQ.push({ k, d: data }); if (chQ.length > 300) chQ.shift(); return true; }
    ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ k, from: Cloud.uid }, data || {}) });
    return true;
  }
  // mid 를 주면 그 경기 채널일 때만 닫는다 (그 사이 다음 경기 채널을 열었으면 그대로)
  function chClose(mid) { if (mid && mid !== chMid) return; const c = sb(); if (ch && c) { try { c.removeChannel(ch); } catch (e) { /* */ } } ch = null; chOk = false; chQ = []; chMid = null; }

  return { T, spec, want, trySolo, start, cancel, aiNow, partyChanged, partyGone, onParty, render, decorate, setup, chOpen, chSend, chClose,
    searching: () => !!Q, get state() { return Q; }, get party() { return pv; } };
})();
