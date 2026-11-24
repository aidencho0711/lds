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
//  · v23 혼자일 때 3분씩 기다리지 않게: 줄 서기 전에 로비 접속 표시(10_social.js presence)를 본다
//    - 나·파티원 말고 접속한 사람이 없으면 줄 서지 않고 바로 AI 경기 ('지금 접속한 사람이 없어 바로 시작합니다')
//    - 접속한 사람은 있지만 이 대기열에 줄 선 사람이 없으면 1분만 기다린다 (mm_join p_wait 60 — 그 1분 안에 들어온 사람은 같은 경기로,
//      줄 선 사람이 있으면 그 사람이 연 경기에 들어가 그 경기의 남은 시간대로) · 접속 표시를 3초 안에 못 받으면 예전처럼 3분
//    - 접속 표시에 내가 줄 선 대기열 키(mq)를 넣어, 출격 옆 버튼·매칭 카드에 '접속 N · 매칭 중 M'과 다른 대기열 인원,
//      맵 선택 창의 맵·모드 칸에 '매칭 중 N' 배지를 보여 준다 (접속 표시가 바뀔 때마다 다시)
//    - 매칭 시계는 서버가 알려 준 경기 나이·대기 시간(age·wait) 기준 · 매칭 중과 잡힌 경기를 불러오는 동안 화면 꺼짐 방지 · 잡히면 알림음 + 진동
//    - 접속 표시·방장의 매칭 메시지는 남이 보낸 값이라 믿지 않는다 (mq·key 는 80자 이하 문자열만 · 이름은 자기 속성만 찾음 ·
//      인원 계산이 실패해도 표시만 빠지고 로비·출격·매칭은 그대로) · 바로 시작 안내 뒤 시작하기 직전에 한 번 더 본다 (그 사이 누가 접속하면 줄 선다)
//    - 대기 시간(1분·3분)은 줄마다 한 번 정한다 (다시 줄 서도 그대로) · 3분으로 섰다가(접속 표시를 늦게 받음) 나(파티)뿐인 것이 보이면 취소하고 바로 시작
// ============================================================
const MM = (() => {
  const T = { wait: 180, short: 60, poll: 2000, sync: 3000, soon: 1200 };   // 최대 대기(초) · 줄 선 사람이 없을 때 대기(초) · 확인 간격(ms) · 접속 표시를 기다리는 최대(ms) · 혼자일 때 안내 뒤 시작(ms)
  let Q = null;      // 매칭 중(나 또는 내가 방장인 파티): { s, members, party, t0, ticket, st, stAt, wait, short, pre, busy, err, timer, cfgBusy, launched } — pre: 접속 표시를 기다리는 중(아직 줄 서지 않음) · short: 이 줄은 1분 대기
  let pv = null;     // 파티원: 방장이 매칭 중 { t0, wait, n, cap, label, dm, names, key }
  let uiT = null, lastKey = '', soonT = null;
  const sb = () => Cloud.client();
  const now = () => Date.now();
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // 대기열 키: 배틀로얄 = 버전|br|맵|모드|팀 크기|일반·랭크·하드코어 · 데스매치·대결 = 버전|종류|아레나 (맵 선택 창 배지도 같은 식)
  const brKey = (map, ts) => `v${NET_VER}|br|${map}|${SETTINGS.mode}|${ts}|${SETTINGS.queue}`;
  const dmKey = (game, arena) => `v${NET_VER}|${game}|${arena}`;
  // 지금 고른 경기의 대기열 키 · 한 경기 사람 수(cap) · 팀 크기
  function spec(partyN) {
    const game = SETTINGS.game;
    if (isDmGame(game)) { const ts = dmTeamSize(game), key = dmKey(game, arenaPick()); return { key, cap: ts * 2, dm: true, ts, label: keyLabel(key) }; }
    const ranked = SETTINGS.queue !== 'normal', hc = SETTINGS.queue === 'hardcore';
    const ts = ranked && partyN < 2 ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size;
    // 배틀로얄 한 경기 최대 사람 수 = 맵 최대 인원 (봇 자리까지 전부 사람이어도 됨) — 사실상 대기 시간 동안 들어온 사람 모두
    const key = brKey(SETTINGS.map, ts);
    return { key, cap: mapMaxBots(SETTINGS.map) + 1, dm: false, ts, ranked, hc, label: keyLabel(key) };
  }
  // 대기열 키 → 화면 이름 (남이 줄 선 대기열도 같은 이름으로) · 다른 버전이나 모르는 키는 ''
  //  남이 보낸 키일 수 있어 자기 속성만 찾는다 (MAPS['__proto__'] 같은 이름에 걸려 멈추지 않게)
  const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null);
  function keyLabel(k) {
    const a = String(k || '').split('|'); if (a[0] !== 'v' + NET_VER) return '';
    if (a[1] !== 'br') { const GT = own(GAME_TYPES, a[1]), ar = a[2] === 'random' || ARENAS.includes(a[2]); return GT && GT.dm && ar ? `${GT.name} · ${arenaLabel(a[2])}` : ''; }
    const M = own(MAPS, a[2]), md = own(MODES, a[3]), ts = +a[4]; if (!M || typeof M.name !== 'string') return '';
    const sq = ts === 1 ? '솔로' : (Object.values(TEAM_MODES).find((m) => m.size === ts) || TEAM_MODES.solo).name;
    return `${a[5] === 'hardcore' ? '하드코어 · ' : a[5] === 'ranked' ? '랭크 · ' : ''}${sq} · ${M.name.replace(/\s*\(.*\)$/, '')}${a[3] !== 'classic' && md ? ' · ' + md.name : ''}`;
  }
  // 지금 줄 선 대기열 키 (로비 접속 표시 mq) — 파티원은 방장이 줄 선 키 · 접속 표시를 기다리는 중(pre)은 아직 줄 서지 않음
  const qkey = () => (G.state !== 'lobby' ? '' : Q ? (Q.pre ? '' : Q.s.key) : pv ? pv.key || '' : '');
  // 남이 보낸 대기열 키(접속 표시 mq · 방장의 'mm' key): 80자 이하 문자열만 (서버 mm_join 도 80자까지) — 아니면 ''
  const keyOk = (v) => (typeof v === 'string' && v.length <= 80 ? v : '');
  // 로비 접속 표시로 센 사람 수 — 나는 지금 상태로 센다 (내 접속 표시는 1초쯤 늦게 바뀜) · mq 는 Social.readPresence 가 이미 걸렀다(keyOk)
  //  n: 접속(나 포함) · m: key 대기열에 줄 선 사람(파티원 포함) · ex: 나·파티원 말고 접속한 사람 · q: 대기열 키 → 줄 선 사람 수(나·파티원 빼고 · 이름이 있는 키만)
  function crowd(key) {
    const c = { key, n: 1, m: qkey() === key ? 1 : 0, ex: 0, q: new Map() };
    for (const [uid, o] of Social.online) {
      if (uid === Cloud.uid) continue;
      c.n++;
      if (!o || o.nv !== NET_VER) continue;   // 같이 매칭될 수 없는 접속(게임 버전이 다른 화면 — 10_ver.js)은 여기서만 거른다 (접속 수에만 셈 — 바로 시작·대기 시간·인원·배지가 모두 이 결과를 씀)
      const mate = Party.has(uid), mq = o.mq || '';
      if (!mate) c.ex++;
      if (!mq) continue;
      if (mq === key) c.m++;
      if (!mate && keyLabel(mq)) c.q.set(mq, (c.q.get(mq) || 0) + 1);   // 없는 맵·모드 키는 배지·다른 대기열 수에 넣지 않는다
    }
    return c;
  }
  // 나·파티원 말고 접속한 사람이 없음 — 이번 연결에서 접속 목록을 받은 뒤에만 믿는다 (계산이 실패하면 '있음' → 보통처럼 줄 선다)
  const alone = (key) => { try { return Social.synced && !crowd(key).ex; } catch (e) { return false; } };
  // 화면에 보일 인원 (로그인 · 접속 표시를 받은 뒤에만) — 매칭 중이면 그 대기열, 아니면 지금 고른 경기의 대기열
  const counts = () => (Cloud.user && Social.synced ? crowd(Q ? Q.s.key : pv && pv.key ? pv.key : spec(Party.size()).key) : null);
  // 다른 대기열 인원: 많은 순 max 개 '듀오 · 칼덴 섬 (1명)'
  const otherQs = (c, max) => [...c.q].filter(([k]) => k !== c.key).map(([k, n]) => [keyLabel(k), n]).filter((x) => x[0]).sort((a, b) => b[1] - a[1]).slice(0, max).map(([l, n]) => `${l} (${n}명)`).join(', ');
  // 인원 표시 { c, ot } — 접속 표시는 남이 보낸 것이라, 계산이 실패해도 표시만 빠지고 로비 그리기·출격·매칭은 멈추지 않는다
  const view = (max) => { try { const c = counts(); return { c, ot: c ? otherQs(c, max) : '' }; } catch (e) { return { c: null, ot: '' }; } };
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
  //  v23: 접속 표시를 이미 받았고 나·파티원 말고 아무도 없으면 줄 서지 않고 바로 AI 경기 · 아직 못 받았으면 잠깐 기다렸다가 정한다(preWait)
  function start(members, party) {
    if (Q) cancel();
    if (soonT) return;   // 혼자라서 곧 시작함 (안내를 띄운 뒤) — 휴대폰에서 두 번 눌러도 취소되지 않게 그대로 둔다
    const s = spec(members.length);
    if (alone(s.key)) { quick(); return; }
    Q = { s, members, party: !!party, t0: now(), ticket: null, st: null, stAt: 0, wait: T.wait, short: false, pre: !Social.synced, busy: false, err: 0, timer: null, cfgBusy: false, launched: false };
    tellParty(); render();
    if (Q.pre) schedule(250, preWait); else join();
  }
  // 나·파티원 말고 접속한 사람이 없음 → AI 경기로 (안내를 읽을 틈만 두고 바로 — 파티면 파티원끼리)
  //  시작하기 직전에 한 번 더 본다: 그 사이 누가 접속했거나 연결이 끊겨 알 수 없게 됐으면 보통처럼 줄 선다 (soonT 가 비었으니 start 로 감)
  function quick() {
    HUD.lobbyNote('지금 접속한 사람이 없어 바로 시작합니다');
    clearTimeout(soonT);
    soonT = setTimeout(() => {
      soonT = null; if (G.state !== 'lobby' || Q) return;
      if (alone(spec(Party.size()).key)) { G.startMatch(true); return; }
      if (Social.synced) HUD.lobbyNote('방금 접속한 사람이 있어 온라인 매칭으로 줄 섭니다');
      G.startMatch();
    }, T.soon);
  }
  // 방금 로그인해 접속 표시를 아직 못 받음 → T.sync 까지 기다렸다가 정한다 · 그래도 없으면 그냥 줄 선다
  function preWait() {
    const q = Q; if (!q || !q.pre) return;
    if (G.state !== 'lobby') { cancel(); return; }
    if (spec(q.members.length).key !== q.s.key) { cancel('경기 설정이 바뀌어 매칭을 취소했습니다'); return; }
    if (!Social.synced && now() - q.t0 < T.sync) { schedule(250, preWait); return; }
    if (alone(q.s.key)) { cancel(); quick(); return; }
    q.pre = false; q.t0 = now(); join();
  }
  // 대기 시간: 줄마다 한 번 정한다 — 접속 표시를 받았으면 1분 (그 사이 들어온 사람은 같은 경기로) · 모르면 기본(3분)
  //  한 번 1분이면 오래 끊겨 다시 줄 서도('gone') 1분 · 3분으로 섰는데 나중에 나(파티)뿐인 것이 보이면 recheck 가 바로 시작으로 바꾼다
  //  서버는 새 경기를 열 때만 이 값을 쓴다 — 이 대기열에 줄 선 사람이 있으면 그 사람이 연 경기에 들어가 그 경기의 대기 시간(st.wait)을 따른다.
  //  그런데도 새 경기가 열렸다면 그 사람들은 이미 마감(시작 직전)이거나 나와 동시에 줄 선 것이라 '줄 선 사람이 없음'과 같다 → 어느 쪽이든 1분
  function waitFor(q) { if (Social.synced) q.short = true; return q.short ? Math.min(T.short, T.wait) : T.wait; }
  async function join() {
    const q = Q; if (!q) return;
    q.busy = true; q.wait = waitFor(q); let data = null;
    try { const r = await sb().rpc('mm_join', { p_qkey: q.s.key, p_cap: q.s.cap, p_wait: q.wait, p_members: q.members }); if (r.error) throw r.error; data = r.data; }
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
  function schedule(ms, fn) { const q = Q; if (!q) return; clearTimeout(q.timer); q.timer = setTimeout(fn || poll, ms || T.poll); }
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
    q.st = st; q.stAt = now(); tellParty();
    if (st.closed) {
      if (st.cfg) { launch(st.cfg); return; }
      if (st.host === Cloud.uid && !q.cfgBusy) makeCfg(st);
    }
    if (recheck()) return;
    render();
  }
  // 3분으로 줄 섰는데(접속 표시를 늦게 받음) 이제 보니 나·파티원 말고 아무도 없고 이 경기에도 나(파티)뿐 → 취소하고 바로 시작
  //  접속 표시가 바뀔 때(onOnline)와 2초마다 확인 답(onState)에서 본다 · 1분 줄은 그대로 (줄 설 때 누가 있었음)
  function recheck() {
    const q = Q, st = q && q.st;
    if (!st || q.pre || q.busy || q.launched || st.closed || !(st.wait > T.short) || st.n > q.members.length || !alone(q.s.key)) return false;
    cancel(); quick(); return true;
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
    if (q.party) { Party.send('mm', { on: 0, go: 1 }); Party.send('start', { cfg }); }   // go: 경기가 잡힘 → 파티원도 알림음·진동
    const nh = cfg.humans.length, others = nh - q.members.length;
    HUD.lobbyNote(others > 0 ? `매칭 완료 — 다른 사람 ${others}명과 함께 시작합니다` : '같이 할 사람이 없어 AI 와 시작합니다');
    found();
    // 경기에 먼저 들어간 뒤 그린다: 화면 그리기가 경기 시작을 막지 못하고, 접속 표시도 한 번만 바뀐다 (매칭 중 → 경기 중)
    try { Net.join(cfg); } finally { render(); }
  }
  // 매칭 완료 알림: 짧은 알림음 + 진동 (화면을 보고 있지 않아도 알게) — 진동은 이 페이지를 한 번이라도 누른 뒤에만 된다
  function found() {
    wlGo = now();
    try { Audio.matchFound(); } catch (e) { /* */ }
    try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(200); } catch (e) { /* */ }
  }
  function leaveSrv() { const c = sb(); if (c && Cloud.user) c.rpc('mm_leave').then(() => {}, () => {}); }
  function cancel(msg) {
    const q = Q; if (!q) return;
    Q = null; clearTimeout(q.timer); if (!q.pre) leaveSrv();   // pre: 아직 줄 서지 않음 (서버에 지울 것이 없다)
    if (q.party) Party.send('mm', { on: 0 });
    if (msg) HUD.lobbyNote(msg);
    render();
  }
  // 매칭 취소하고 지금 바로 AI 와 시작 (파티면 파티원끼리)
  function aiNow() { if (!Q) return; cancel(); G.startMatch(true); }
  // 파티 인원이 바뀌면 줄을 다시 서야 함 → 취소
  function partyChanged() { if (Q && Q.party) cancel('파티 인원이 바뀌어 매칭을 취소했습니다 — 다시 출격을 눌러 주세요'); }
  // 파티원에게 매칭 상태: el·wait(서버 시계로 지난 시간·대기 시간) · key(파티원 접속 표시 mq, 아직 줄 서기 전이면 '') — t0 은 예전 버전 파티원용
  function tellParty() { const q = Q; if (!q || !q.party) return; const st = q.st, k = clock(); Party.send('mm', { on: 1, t0: now() - k.el * 1000, el: k.el, wait: k.w, key: q.pre ? '' : q.s.key, n: st ? st.n : q.members.length, cap: q.s.cap, label: q.s.label, dm: q.s.dm ? 1 : 0, names: names(st) }); }
  // 파티원: 방장의 매칭 상태 (예전 버전 방장은 el·wait 없이 t0 만 보냄)
  //  방장이 보낸 값도 그대로 믿지 않는다 — key 는 내 접속 표시 mq 로 나가고, names 는 이름표로 그린다
  const num = (v, d, mx) => (+v > 0 && +v <= mx ? +v : d);
  function onParty(m) {
    if (Party.isLeader()) return;
    const was = !!pv, el = Math.max(0, m.el != null ? +m.el || 0 : Math.min(T.wait, (now() - (+m.t0 || now())) / 1000)) || 0;
    pv = m.on ? { t0: now() - el * 1000, wait: num(m.wait, T.wait, 300), n: num(m.n, 1, 128), cap: num(m.cap, 2, 128), label: typeof m.label === 'string' ? m.label.slice(0, 80) : '', dm: !!m.dm,
      names: Array.isArray(m.names) ? m.names.filter((x) => x && typeof x === 'object').slice(0, 16) : [], key: keyOk(m.key) } : null;
    const go = was && !pv && !!m.go;   // 방장 쪽에서 경기가 잡힘 → 곧 'start' 로 경기에 들어간다
    if (go) found();
    render(go);   // go: 접속 표시는 경기에 들어간 뒤 한 번만 보낸다 (지금 보내면 '로비' → '경기 중' 두 번)
  }
  // 매칭 시계: 서버가 알려 준 경기 나이(age)·대기 시간(wait) 기준 — 1분 대기 · 남이 연 경기에 들어감 · 다시 줄 섬 모두 맞게 (첫 답 전에는 내 시계)
  function clock() {
    const q = Q, v = pv;
    if (q) { const st = q.st, w = st ? st.wait : q.wait; return { w, el: q.pre ? 0 : Math.min(w, Math.max(0, st ? st.age + (now() - q.stAt) / 1000 : (now() - q.t0) / 1000)) }; }
    if (v) return { w: v.wait, el: Math.min(v.wait, Math.max(0, (now() - v.t0) / 1000)) };
    return { w: T.wait, el: 0 };
  }
  function partyGone() { if (pv) { pv = null; render(); } }
  // 경기 명단(서버 — 남이 mm_join 에 보낸 members 그대로)에서 이름표: 객체가 아닌 항목은 건너뜀
  const names = (st) => (st && Array.isArray(st.tickets) ? st.tickets.flatMap((t, g) => (t && Array.isArray(t.members) ? t.members : []).filter((m) => m && typeof m === 'object').map((m) => ({ n: String(m.name || '?').slice(0, 12), g, me: m.uid === Cloud.uid }))) : []);

  // ---------- 화면 ----------
  //  noTrack: 접속 표시를 지금 보내지 않음 (곧 경기에 들어가 다시 바뀜 — 1초마다 확인에서 한 번만)
  function render(noTrack) {
    const P0 = $('mmPanel'); if (!P0) return;
    const show = (!!Q || !!pv) && G.state === 'lobby';
    P0.hidden = !show; const L0 = P0.parentElement; if (L0) L0.classList.toggle('mm', show);
    if (show && !uiT) uiT = setInterval(tick, 250);
    if (!show && uiT) { clearInterval(uiT); uiT = null; }
    if (show) tick();
    // 매칭을 시작·끝낼 때는 로비를 다시 그려 출격 버튼 글자를 되돌린다 (그 밖에는 버튼만)
    const key = (Q ? 'q' : '') + (pv ? 'p' : '');
    if (G.state === 'lobby') { if (key !== lastKey) { lastKey = key; HUD.renderLobby(); } else decorate(); }
    if (!noTrack) Social.track();   // 접속 표시 mq (바뀐 때만 보냄)
    wake();   // 화면 꺼짐 방지
  }
  // 로비 접속 표시가 바뀜 (10_social.js) → 3분 줄인데 나뿐이면 바로 시작, 아니면 인원 표시만 다시
  function onOnline() { if (G.state !== 'lobby' || recheck()) return; decorate(); if (Q || pv) tick(); }
  function tick() {
    if (!Q && !pv) return;
    const q = Q, v = pv, st = q && q.st, k = clock(), lbl = q ? q.s.label : v.label;
    const n = st ? st.n : q ? q.members.length : v.n, cap = st ? st.cap : q ? q.s.cap : v.cap, dm = q ? q.s.dm : v.dm, closed = !!(st && st.closed);
    $('mmTitle').textContent = closed ? '매칭 완료 — 경기 준비 중' : q && q.pre ? '접속한 사람 확인 중' : q ? '온라인 매칭 중' : '방장이 온라인 매칭 중';
    $('mmTime').textContent = `${fmt(k.el)} / ${fmt(k.w)}`;
    $('mmBar').style.width = (closed ? 100 : k.el / k.w * 100).toFixed(1) + '%';
    $('mmSub').textContent = dm ? `${lbl} · 사람 ${n}/${cap}명 · 다 모이면 바로 시작, ${fmt(k.w)}이 지나면 빈자리는 AI`
      : k.w < T.wait && n <= (q ? q.members.length : Party.size()) ? `${lbl} · 사람 ${n}명 · 줄 선 사람이 없어 ${fmt(k.w)}만 기다립니다 (그 사이 들어온 사람과 함께, 빈자리는 AI)`
      : `${lbl} · 사람 ${n}명 · ${fmt(k.w)} 동안 들어온 사람 모두와 시작 (빈자리는 AI)`;
    const { c, ot } = view(3);
    $('mmCnt').textContent = c ? `접속 ${c.n} · 매칭 중 ${c.m}${ot ? ` · 다른 대기열: ${ot}` : ''}` : '';
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
    // 접속 인원 (로그인한 사람 — 로비 접속 표시): 버튼에는 접속·이 대기열 인원, 다른 대기열은 풍선 도움말에
    const { c, ot } = view(6), ce = $('onlineCnt');
    if (ce) { ce.hidden = !c; ce.textContent = c ? `접속 ${c.n} · 매칭 중 ${c.m}` : ''; o.classList.toggle('cnt', !!c); }
    o.title = (member ? '방장이 정합니다' : SETTINGS.online ? '켬: 같은 모드를 고른 사람끼리 매칭 (빈자리는 AI) · 누르면 끔' : '끔: AI 와 바로 시작 · 누르면 켬')
      + (c ? `\n지금 접속 ${c.n}명 · 이 대기열에 매칭 중 ${c.m}명${ot ? `\n다른 대기열: ${ot}` : ''}` : '');
    b.classList.toggle('mm', !!Q);
    if (Q) {
      const st = Q.st;
      b.querySelector('span').textContent = '매칭 취소';
      $('playSub').textContent = `매칭 중 ${fmt(clock().el)} · 사람 ${st ? st.n : Q.members.length}${Q.s.dm ? '/' + (st ? st.cap : Q.s.cap) : '명'}`;
    }
    try { badges(c); } catch (e) { /* 배지만 빠진다 — 로비 그리기는 계속 */ }
  }
  // 맵 선택 창 배지 '매칭 중 N' (나·파티원 빼고 — crowd 의 q): 맵(아레나) 칸 = 그 맵을 고르면 같이 줄 서게 될 사람 · 모드 칸 = 그 모드 대기열 전체
  function badges(c) {
    const cnt = c ? c.q : new Map(), dm = isDmGame(SETTINGS.game), ts = spec(Party.size()).ts;
    const sum = (pre) => { let n = 0; for (const [k, v] of cnt) if (k.startsWith(pre)) n += v; return n; };
    const put = (b, n) => {
      let e = b.querySelector('.mm-n'); if (!n) { if (e) e.remove(); return; }
      if (!e) { e = document.createElement('i'); e.className = 'mm-n'; (b.querySelector('.mo-img') || b).appendChild(e); }
      e.textContent = `매칭 중 ${n}`;
    };
    document.querySelectorAll('#mapGrid .map-opt[data-k]').forEach((b) => put(b, cnt.get(dm ? dmKey(SETTINGS.game, b.dataset.k) : brKey(b.dataset.k, ts)) || 0));
    document.querySelectorAll('#gameGrid .game-opt[data-k]').forEach((b) => put(b, sum(`v${NET_VER}|${b.dataset.k}|`)));
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
    document.addEventListener('visibilitychange', () => { wlNo = false; wake(); });   // 화면이 다시 보이면 꺼짐 방지를 다시 건다 (숨겨지면 브라우저가 풂)
  }

  // ---------- 화면 꺼짐 방지 (v23) ----------
  //  매칭 중(파티원: 방장이 매칭 중) → 잡힌 경기를 불러오는 동안 → 스타트 섬이 끝날 때까지. 휴대폰 화면이 꺼지면 페이지가 멈춰
  //  매칭 확인이 끊기고, 방장이면 경기 준비가 늦어진다. 지원하지 않거나 거절되면 그냥 넘어간다 (wlNo: 다시 보일 때까지 묻지 않음)
  //  wlGo: 경기가 잡힌 시각 — 파티원은 방장의 '매칭 끝'과 '경기 시작' 사이가 잠깐 비므로 5초 동안은 그대로 둔다
  let wl = null, wlBusy = false, wlNo = false, wlT = null, wlGo = 0;
  const wakeWant = () => ((!!Q || !!pv) && G.state === 'lobby') || now() - wlGo < 5000 || (!!(G.net && G.net.cfg && G.net.cfg.mm) && (G.state === 'loading' || (G.state === 'play' && !!G.island)));
  function wake() {
    const need = wakeWant();
    if (need && !wl && !wlBusy && !wlNo && document.visibilityState === 'visible' && navigator.wakeLock) {
      wlBusy = true;
      navigator.wakeLock.request('screen').then((l) => { wlBusy = false; wl = l; l.addEventListener('release', () => { if (wl === l) wl = null; }); wake(); }, () => { wlBusy = false; wlNo = true; });
    }
    if (!need && wl) { const l = wl; wl = null; l.release().catch(() => {}); }
    if (need && !wlT && navigator.wakeLock) wlT = setInterval(wake, 1000);   // 섬이 끝나는 때 등을 1초마다 확인해 푼다
    else if (!need && wlT) { clearInterval(wlT); wlT = null; }
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

  return { T, spec, want, trySolo, start, cancel, aiNow, partyChanged, partyGone, onParty, render, decorate, setup, chOpen, chSend, chClose, qkey, keyOk, crowd, keyLabel, onOnline, clock,
    searching: () => !!Q, get state() { return Q; }, get party() { return pv; }, get wakeLock() { return wl; } };
})();
