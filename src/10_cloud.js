// ============================================================
// 10_cloud.js — 계정(아이디·비밀번호)과 기록 동기화 (Supabase)
//  · 아이디 → 내부용 이메일 'u<UTF-8 16진수>@CLOUD_CFG.idDomain' 으로 바꿔 Supabase Auth 비밀번호 로그인 사용
//    (대소문자만 다른 아이디는 같은 계정. 표시 이름은 가입 때 쓴 그대로)
//  · 서버에 저장: 전적(STATS)·랭크·설정(기기별 설정 제외). 로컬 저장소는 캐시 역할
//  · 로그인: 서버에 기록이 있으면 그걸 불러오고, 비어 있으면(새 계정) 이 기기의 기록을 올린다
//    로그인 전 기기 기록(게스트)은 따로 보관했다가 로그아웃하면 되돌린다 → 한 기기를 가족이 같이 써도 섞이지 않음
//  · 서버가 꺼져 있거나(무료 프로젝트 7일 비활성 정지) SDK를 못 불러와도 게임은 게스트로 그대로 동작
//  · SDK는 필요할 때 CDN에서 불러온다(버전 고정 · v23 jsdelivr 가 막히면 unpkg 의 같은 버전 — CLOUD_CFG.sdk)
// ============================================================
const Cloud = (() => {
  const cfg = CLOUD_CFG, enabled = !!(cfg.url && cfg.key);
  let sb = null, loading = null, user = null, name = null, status = enabled ? 'idle' : 'off', lastSync = 0, dirty = false, syncT = null, busy = false, lastErr = '', admin = false, role = null;   // role: v23 'dev' 개발자 · 'sub' 부개발자
  const ID_RE = /^[가-힣A-Za-z0-9_]+$/;

  // ---------- 아이디 규칙 ----------
  function checkId(id) {
    id = (id || '').normalize('NFC').trim();
    if (id.length < 2 || id.length > 10) return '아이디는 2~10자로 정해 주세요';
    if (!ID_RE.test(id)) return '아이디는 한글·영문·숫자·밑줄(_)만 쓸 수 있습니다';
    if (new TextEncoder().encode(id.toLowerCase()).length > 30) return '아이디가 너무 깁니다 (한글은 10자까지)';
    return null;
  }
  function idEmail(id) {
    const b = new TextEncoder().encode(id.normalize('NFC').trim().toLowerCase());
    let hex = ''; for (const x of b) hex += x.toString(16).padStart(2, '0');
    return 'u' + hex + '@' + cfg.idDomain;
  }
  function msgOf(err) {
    const m = ((err && (err.message || err.error_description)) || String(err || '')).toLowerCase(), code = err && err.code;
    if (code === 'user_already_exists' || m.includes('already registered') || m.includes('already exists')) return '이미 사용 중인 아이디입니다';
    if (code === 'invalid_credentials' || m.includes('invalid login credentials')) return '아이디 또는 비밀번호가 맞지 않습니다';
    if (code === 'user_banned' || m.includes('banned')) return '정지된 계정입니다';   // v23 계정 밴 (admin.sql admin_ban)
    if (code === 'same_password' || m.includes('different from the old')) return '지금 비밀번호와 같습니다 — 다른 비밀번호로 정해 주세요';
    if (code === 'reauthentication_needed' || m.includes('reauthenticat')) return '보안을 위해 로그아웃 후 다시 로그인한 뒤 바꿔 주세요';
    if (code === 'weak_password' || m.includes('password should be')) return '비밀번호가 너무 짧거나 단순합니다 (6자 이상)';
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || m.includes('rate limit')) return '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요';
    if (code === 'email_not_confirmed' || m.includes('not confirmed')) return '서버 설정 필요: Supabase에서 "Confirm email"을 꺼 주세요';
    if (code === 'signup_disabled' || m.includes('signups not allowed')) return '서버에서 회원가입이 꺼져 있습니다';
    if (code === 'unexpected_failure' || m.includes('database error')) return '서버에서 계정을 만들지 못했습니다 (DB 설정 확인 필요: schema.sql 실행 여부)';
    if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return '서버에 연결할 수 없습니다 (인터넷 또는 서버 상태 확인)';
    return '오류: ' + ((err && err.message) || err);
  }

  // ---------- SDK ----------
  function loadSdk() {
    if (sb) return Promise.resolve(sb);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const done = () => {
        try {
          sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: STORE_PREFIX + 'auth' } });
          // v23: 세션 갱신이 거부돼(밴 등) SDK 가 로그아웃시키면 밴인지 확인 (콜백 안에서 SDK 를 바로 부르면 멈출 수 있어 다음 차례에)
          if (sb.auth.onAuthStateChange) sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && user && !signingOut) setTimeout(lostSession, 0); });
          res(sb);
        } catch (e) { rej(e); }
      };
      // v23 예비 CDN: cfg.sdk 의 주소(같은 버전)를 차례로 — 실패하면 다음 곳, 12초 넘게 답이 없으면 다음 곳도 같이 받아 먼저 온 것을 쓴다
      //  마지막 곳도 실패하거나 답이 없으면 실패로 돌려준다 (다시 로그인하면 처음부터 · 그사이 늦게 온 SDK 가 있으면 그것을 씀)
      const urls = [].concat(cfg.sdk || []); let n = 0, wait = 0, fin = false;
      const next = (slow, last) => {   // slow: 방금 받기 시작한 곳이 답이 없음 · last: 마지막 곳이 끝났는데 SDK 가 없음
        if (fin) return;
        if (window.supabase && window.supabase.createClient) { fin = true; done(); return; }
        if (n < urls.length) {
          const i = n++, s = document.createElement('script'), t = setTimeout(() => next(true), 12000);
          s.src = urls[i]; s.async = true; s.crossOrigin = 'anonymous'; wait++;
          s.onload = s.onerror = () => { clearTimeout(t); wait--; next(false, i === urls.length - 1); };
          document.head.appendChild(s);
        } else if (slow || last || !wait) { fin = true; rej(new Error('로그인 모듈을 불러오지 못했습니다 (인터넷 연결 확인 후 다시 시도)')); }
      };
      next(false);
    }).catch((e) => { loading = null; throw e; });
    return loading;
  }

  // ---------- 기록 묶기 / 풀기 ----------
  //  설정: 파티원·온라인 경기가 잠깐 바꿔 둔 칸(방장 설정 · 경기 설정)은 내 보관본으로 올린다 — 남의 설정이 내 계정에 저장되지 않게
  //  hold: 경기 중·파티 중이라 아직 적용하지 못한 다른 기기 설정 { from: 그때 이 기기 설정, out: 합친 설정 } → 그 뒤 이 기기에서 바꾸지 않은 칸은 받은 값으로 올림
  //  mv: 합치기를 아는 빌드가 쓴 설정 표시 — 표시 없는 설정(옛 빌드 탭이 통째로 올린 것)은 받아들이지 않는다 (setMerge)
  let hold = null;
  // 키 순서와 상관없는 JSON — 서버(jsonb)는 칸 순서를 바꿔 돌려주므로 같은 내용인지 볼 때 이것으로
  const cj = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v));
  function pack() {
    const st = {}; for (const k in SETTINGS) if (!DEVICE_SETTINGS.includes(k) && k !== 'mv') st[k] = SETTINGS[k];
    if (G.net && G.net.own) Object.assign(st, G.net.own);
    const po = Party.ownSet && Party.ownSet(); if (po) Object.assign(st, po);
    if (hold) for (const k in hold.out) if (k !== 'mv' && cj(st[k]) === cj(hold.from[k])) st[k] = hold.out[k];
    st.mv = 1;
    return { stats: STATS, rank: Rank.state, settings: st };
  }
  // 서버 설정으로 바꿈 — 기기별 설정은 이 기기 것 그대로
  function useSettings(st) { const keep = {}; for (const k of DEVICE_SETTINGS) keep[k] = SETTINGS[k]; SETTINGS = Object.assign({}, DEFAULT_SETTINGS, st, keep); store.set('settings', SETTINGS); }
  function apply(d) {
    STATS = Object.assign({ matches: 0, wins: 0, kills: 0, xp: 0, best: 99, recent: [] }, d.stats || {});
    if (!STATS.dm) STATS.dm = Object.assign({}, DM_STATS0);
    store.set('stats', STATS);
    Rank.replace(d.rank || {});
    if (d.settings) useSettings(d.settings);
  }
  // 전적이 없어도 상점 기록(뽑기·미션·스킨)이 있으면 진행한 계정으로 본다
  const hasProgress = (d) => !!(d && d.stats && ((d.stats.matches || 0) > 0 || (d.stats.xp || 0) > 0 || (d.stats.eco && (d.stats.eco.rev || 0) > 2) || (d.stats.skins || []).length || (d.stats.vskins || []).length || (d.stats.gskins || []).length));
  function refreshUi() {
    if (G.state === 'lobby') { HUD.renderLobby(); if (G.applySettings) G.applySettings('view'); if (Lobby.setLook) { Lobby.setLook(SETTINGS.look); Lobby.teamN = 0; } }
    render();
    try { Rank.settle(); } catch (e) { console.warn(e); }   // v23 랭크 개편: 4000 RP 넘던 기록 → 보상·안내 (기록을 다 불러온 뒤에만 — 10_rank.js)
  }

  // ---------- 동기화 ----------
  //  base: 마지막으로 서버와 같았던 기록 { stats, rank, settings }. 서버의 sync 표식이 base 와 다르면(다른 기기·관리자가 저장함)
  //  이 기기에서 바뀐 것만 서버 값에 얹어 합친 뒤 올린다 → 재화가 되살아나거나 얻은 스킨이 사라지지 않음
  //   · 전적: 바뀐 양을 더함 (Eco.mergeStats) · 랭크: base 이후 판 수가 늘어난 쪽 (Rank.mergeRank) · 설정: 이 기기에서 바꾼 칸만 (mergeSet)
  //   (예전엔 전적만 합치고 랭크·설정은 이 기기 값을 그대로 올려, 오래 열어 둔 탭·다른 기기가 새 RP·승급전·장착을 옛 값으로 덮었다)
  let base = null, pullT = 0, acctLoad = false;   // acctLoad: 로그인하며 계정 기록을 불러오는 중 (base 가 없어 합칠 수 없으므로 그동안은 올리지 않음)
  let pend = null;   // 올렸는데 응답을 못 받은 기록 { sync, sent } — 서버에 그 sync 가 있으면 실제로 저장된 것 (다시 합치면 두 번 더해짐)
  const snap = (o) => JSON.parse(JSON.stringify(o || {}));
  const COLS = 'stats, rank, settings';
  // base 로 둘 기록: 서버와 같아진 지금 이 기기의 랭크·설정 + 전적(st)
  const agreed = (st) => ({ stats: snap(st), rank: snap(Rank.state), settings: snap(pack().settings) });
  // 서버 설정 → 이 기기 묶음(pack)과 같은 모양 (빠진 칸은 기본값)
  const cloudSet = (st) => { const o = Object.assign({}, DEFAULT_SETTINGS, st); for (const k of DEVICE_SETTINGS) delete o[k]; return o; };
  // 관리자 초기화(supabase/admin.sql admin_reset): 서버 기록의 reset 표식이 이 기기와 다르면 이 기기의 옛 기록을 버리고 따름
  const isReset = (srv) => !!(srv && srv.reset && srv.reset !== STATS.reset);
  // 설정 합치기 (계산만): 이 기기에서 base 이후 바꾼 칸만 서버 설정 위에 얹은 것(out) · 이 기기에서 바꾼 칸이 있었는가(own → 다시 올려야 함)
  //  서버 설정이 없거나 표시(mv)가 없으면(배포 전 옛 빌드 탭이 통째로 올린 것) 받아들이지 않고 이 기기 것을 다시 올린다 — 예전처럼 다음 저장이 덮어써 고침
  function setMerge(srv) {
    const L = pack().settings;
    if (!srv || typeof srv !== 'object' || !srv.mv) return { out: null, own: true };
    const B = (base && base.settings) || {}, out = Object.assign({}, srv); let own = false;
    for (const k of new Set([...Object.keys(L), ...Object.keys(B)])) if (k !== 'mv' && cj(L[k]) !== cj(B[k])) { own = true; if (L[k] === undefined) delete out[k]; else out[k] = L[k]; }
    return { out, own };
  }
  // 받은 설정을 지금 설정에 적용 — 로비에서, 파티원·온라인 경기 설정이 걸려 있지 않을 때만. 아니면 hold 로 미룸
  //  (경기 중·불러오는 중에 map·모드가 바뀌면 승급전 판정·이어하기·리콜이 다른 맵 기준이 된다) · 돌려주는 값: 바뀐 칸
  const canApply = () => G.state === 'lobby' && !(G.net && G.net.own) && !(Party.ownSet && Party.ownSet());
  function applySet(out) {
    if (!out) return [];
    if (!canApply()) { if (!hold) hold = { from: pack().settings }; hold.out = out; return []; }
    hold = null; const st = Object.assign({}, out); delete st.mv;
    const was = SETTINGS; useSettings(st);
    return Object.keys(SETTINGS).filter((k) => cj(SETTINGS[k]) !== cj(was[k]));
  }
  // 다른 기기에서 바꾼 장착·소리·시간대를 로비에 바로 보이게 (실패해도 기록은 이미 다 합쳐 둠)
  function refreshSet(ch) {
    if (!ch.length || G.state !== 'lobby') return;
    try {
      if (G.applySettings) for (const k of ch) G.applySettings(k);
      if (ch.some((k) => ['look', 'body', 'glook', 'gshow'].includes(k)) && Lobby.setLook) Lobby.setLook(SETTINGS.look);
      if (ch.includes('vlook') && Lobby.motoProp) Lobby.motoProp();
      if (ch.includes('time') && Lobby.applyTime) Lobby.applyTime();
    } catch (e) { console.warn('Cloud settings', e); }
  }
  // 경기·파티 중에 미뤄 둔 설정을 로비에서 적용 (그 뒤 이 기기에서 바꾼 칸은 그대로 — pack 이 이미 그렇게 묶음)
  function flushHold() {
    if (!hold || !canApply()) return;
    const st = pack().settings; hold = null; refreshSet(applySet(st));
    try { HUD.renderLobby(); } catch (e) { /* 로비 화면이 없어도 기록은 적용됨 */ }
  }
  // 서버 기록이 이 기기가 마지막으로 올리려던 것(응답을 못 받음)과 같으면 실제로 저장된 것 → 그대로 base 로 (다시 합치지 않음)
  function landed(row) { if (pend && row && row.stats && row.stats.sync === pend.sync) base = pend.sent; pend = null; }
  // 다른 기기·관리자가 저장한 서버 기록(row)과 합침 → base 는 이제 그 서버 기록. 다시 올려야 하면 true
  //  먼저 모두 계산하고 기록·base 를 한꺼번에 바꾼 뒤 화면을 고친다 (화면 코드가 실패해도 base 가 어긋나 다음 합치기에서 두 번 더하지 않게)
  function merge(row) {
    const srv = row.stats, own = cj(STATS) !== cj(base.stats) || cj(Rank.state) !== cj(base.rank);
    const st = Eco.mergeStats(base.stats, STATS, srv), rk = Rank.mergeRank(Rank.state, row.rank, base.rank), sm = setMerge(row.settings);
    st.sync = srv.sync; STATS = st; Rank.replace(rk);
    base = { stats: snap(srv), rank: Rank.normOf(row.rank), settings: cloudSet(row.settings) };
    const ch = applySet(sm.out); afterMerge(); refreshSet(ch);
    // 이 기기에서 바뀐 것이 있었거나, 합친 랭크가 서버 것과 다르면(옛 탭이 되돌린 랭크를 이 기기 기록으로 지킴) 다시 올린다
    return own || sm.own || cj(Rank.state) !== cj(Rank.normOf(row.rank));
  }
  // 초기화된 기록 받기: 전적·랭크는 서버 것 그대로 (admin_reset 은 랭크를 비움). 설정은 초기화하지 않으므로 이 기기에서 바꾼 칸은 얹음 → 그런 칸이 있었으면 true
  function adoptReset(row) {
    const st = Object.assign({ matches: 0, wins: 0, kills: 0, xp: 0, best: 99, recent: [] }, snap(row.stats)); st.dm = Object.assign({}, DM_STATS0);
    const sm = setMerge(row.settings);
    STATS = st; store.set('stats', STATS); Rank.replace(row.rank || {});
    base = { stats: snap(STATS), rank: snap(Rank.state), settings: cloudSet(row.settings) };
    const ch = applySet(sm.out); afterMerge(); refreshSet(ch);
    if (G.state === 'lobby') HUD.lobbyNote('관리자가 이 계정의 기록을 초기화했습니다');
    return sm.own;
  }
  function afterMerge() {
    store.set('stats', STATS);
    if (G.state === 'lobby') { try { HUD.renderLobby(); Shop.badge(); const sp = document.querySelector('[data-pane=shop]'), mp = document.querySelector('[data-pane=mission]'); if (sp && !sp.hidden) Shop.render(); if (mp && !mp.hidden) Shop.renderMissions(); const pp = document.querySelector('[data-pane=pass]'); if (pp && !pp.hidden) Pass.render(); } catch (e) { console.warn(e); } }
  }
  async function pushNow() {
    if (!sb || !user) return false;
    if (busy || acctLoad) { dirty = true; return false; }
    busy = true; dirty = false; status = 'syncing'; render();
    const me = user;
    try {
      flushHold();
      const cur = await sb.from('player_data').select(COLS).eq('user_id', me.id).maybeSingle();
      if (cur.error) throw cur.error;   // 못 읽었으면 올리지 않는다 (합치지 않고 올리면 다른 기기의 새 기록을 덮어씀) → 나중에 다시
      if (user !== me) return false;    // 읽는 사이 로그아웃·계정 전환 → 이 기기 기록(이제 게스트)을 건드리지 않음
      const row = cur.data; landed(row);
      if (row && isReset(row.stats)) adoptReset(row);
      else if (row && row.stats && base && row.stats.sync && row.stats.sync !== base.stats.sync) merge(row);
      STATS.sync = Eco.DEV + ':' + Date.now().toString(36); store.set('stats', STATS);
      const d = pack(), sent = agreed(d.stats);   // 올린 그대로를 base 로 (올리는 사이 이 기기에서 바뀐 것은 다음 저장 때 합침)
      pend = { sync: d.stats.sync, sent };
      const { error } = await sb.from('player_data').upsert({ user_id: me.id, stats: d.stats, rank: d.rank, settings: d.settings });
      if (error) throw error;
      if (user !== me) return false;
      pend = null; base = sent;
      lastSync = Date.now(); status = 'online'; lastErr = '';
      Eco.flushGrants('saved', sent.stats.eco);   // 서버에 저장된 보상(올린 기록에 든 것만)은 대기열에서 지움 (10_eco.js)
      return true;
    } catch (e) { status = 'error'; lastErr = msgOf(e); dirty = true; return false; }
    finally { busy = false; render(); if (dirty && status !== 'error') schedule(1500); }
  }
  // 다른 기기에서 바뀐 기록(전적·랭크·설정) 받아오기 (앱으로 돌아올 때·상점/미션을 열 때, 15초에 한 번까지)
  async function pull(force) {
    if (!sb || !user || busy || acctLoad) return false;
    flushHold();   // 경기·파티 중에 받아 둔 다른 기기 설정을 로비에서 적용
    if (!force && Date.now() - pullT < 15000) return false;
    pullT = Date.now();
    const b0 = base, me = user;
    try {
      const cur = await sb.from('player_data').select(COLS).eq('user_id', me.id).maybeSingle(), row = !cur.error && cur.data, srv = row && row.stats;
      if (busy || base !== b0 || user !== me || acctLoad) return false;   // 받는 사이 저장이 시작됐거나 끝남·계정이 바뀜 → 받은 기록이 옛것일 수 있다 (저장이 서버 기록과 합친다)
      landed(row);
      if (isReset(srv)) { if (adoptReset(row)) { dirty = true; schedule(500); } return true; }
      if (!srv || !base || !srv.sync || srv.sync === base.stats.sync) return false;
      if (merge(row)) { dirty = true; schedule(500); }
      return true;
    } catch (e) { return false; }
  }
  // v22: 경기 중에는 서버 저장(조회 + 병합 + 전체 업로드)을 미뤘다가 경기가 끝나면 보낸다 — 처치·줍기마다 2초 뒤 업로드하던 것이 렉
  //  (기기에는 그때그때 저장되고, 앱을 내리거나 창을 닫으면 아래 visibilitychange 가 바로 보낸다)
  function schedule(ms) { if (!user) return; clearTimeout(syncT); syncT = setTimeout(() => { if (G.state === 'play') schedule(15000); else pushNow(); }, ms); }
  onDataSaved = () => { if (user) { dirty = true; schedule(2000); } };
  // 창을 닫거나 다른 앱으로 갈 때 밀린 저장을 바로 보냄
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && dirty) { clearTimeout(syncT); pushNow(); } else if (document.visibilityState === 'visible' && user) pull(); });

  // v23 로그인 차례: afterLogin 이 시작할 때마다 · 로그아웃할 때 올린다 — 기다리는 사이 차례가 바뀌었으면 그 로그인은 아무것도 바꾸지 않고 멈춘다(stale)
  //  (관리자 기기의 느린 세션 복원 중에 로그아웃하고 다른 계정으로 들어오면, 앞 계정의 늦은 is_admin 답이 새 계정에 관리자 도구·콘솔 핸들·스킨 지급을 붙였다
  //   · 앞 계정의 기록 불러오기(apply)·store 'account' 도 새 계정 위에 얹힐 수 있었다)
  let loginGen = 0;
  const staleErr = () => { const e = new Error('다른 로그인으로 바뀌어 멈췄습니다'); e.stale = true; return e; };
  // 로그인 직후: 게스트 기록 보관 → 서버 기록 불러오기(없으면 이 기기 기록 올리기)
  async function afterLogin(u, fresh) {
    const my = ++loginGen, live = () => { if (my !== loginGen) throw staleErr(); };   // 기다린(await) 뒤마다 확인
    if (admin) { admin = false; role = null; Dev.refresh(); }   // v23 로그아웃 없이 다른 계정으로: 앞 계정의 관리자 도구·콘솔 핸들(10_dev.js hooks)부터 뗀다
    user = u; hold = null; pend = null;
    // 계정 기록을 다 불러올 때까지(acctLoad) 저장하지 않음 — base 가 없을 때 올리면 이 기기의 옛 기록이 합쳐지지 않고 서버를 덮는다
    acctLoad = true;
    let prev = null, prof = null, row = null;
    try {
      prev = store.get('account', null);
      prof = await profOf(u.id); live();   // 조회 실패해도 진행
      // v23 밴 중인 계정 (토큰이 아직 살아 있던 세션 복원 · 로그인 직후): 아무것도 불러오지 않고 바로 로그아웃 + 안내 창
      const ban = banOf(prof);
      if (ban) {
        signingOut = true;
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* 오프라인이어도 로컬 로그아웃 */ } finally { signingOut = false; }
        live();
        user = null; store.set('account', null); status = 'idle'; render();
        showBan(ban, (prof && prof.username) || '');
        const e = new Error(`정지된 계정입니다 — ${banTime(ban.until)}까지`); e.ban = true; throw e;
      }
      name = (prof && prof.username) || (u.user_metadata && u.user_metadata.username) || '플레이어';
      if (!store.get('guestBackup', null)) store.set('guestBackup', { stats: STATS, rank: Rank.state, settings: SETTINGS });
      const r = await sb.from('player_data').select('stats, rank, settings, updated_at').eq('user_id', u.id).maybeSingle(); live();
      if (r.error) throw r.error;
      row = r.data;
    } catch (e) { live(); throw e; }   // 멈춘 로그인의 연결 오류는 stale 로 (새 로그인을 '오류'로 표시하지 않게)
    finally { if (my === loginGen) acctLoad = false; }   // 아래 apply·base 정하기는 기다림 없이 이어지므로 그 사이에 저장이 끼지 않는다 · 멈춘 로그인은 새 로그인의 것을 건드리지 않음 (로그아웃이 직접 내림)
    let note;
    if (row && isReset(row.stats) && !hasProgress(row)) { apply(row); base = agreed(row.stats); note = '관리자가 이 계정의 기록을 초기화했습니다'; }
    else if (hasProgress(row)) { apply(row); base = agreed(row.stats); note = `${name}님의 기록을 불러왔습니다`; }
    else { // 새 계정(또는 아직 기록이 없는 계정): 지금 이 기기의 기록을 계정으로 옮김
      await pushNow(); live();
      // '옮김'이므로 로그아웃 뒤 게스트 기록은 새로 시작 (같은 기록이 게스트·계정 양쪽에 복사되지 않게). 기기별 설정은 유지
      if (hasProgress(pack())) { const g = store.get('guestBackup', null); if (g) store.set('guestBackup', { stats: null, rank: null, settings: g.settings }); note = '이 기기의 기록을 계정으로 옮겼습니다'; }
      else note = `${name}님, 환영합니다`;
    }
    store.set('account', { id: u.id, name });
    status = 'online'; lastSync = Date.now();
    const ad = await checkAdmin(name); live();
    const rl = ad ? await checkRole() : null; live();
    admin = ad; role = rl;   // 답을 받은 로그인이 아직 지금 로그인일 때만 — 여기부터 끝까지는 기다림이 없다
    Eco.flushGrants('login');   // 계정을 불러오는 중에 받은 보상 · 서버에 아직 못 올린 보상을 이 계정 기록에 다시 넣음 (10_eco.js)
    EvBR.recover();             // 예전에 이 기기에서 받았는데 계정에 들어오지 않은 백룸 보상을 한 번 복구 (10_event.js)
    Dev.onLogin();   // 개발자 계정이면 모든 스킨 지급 (10_dev.js)
    refreshUi();
    if (dirty) schedule(1500);   // 계정을 불러오는 동안 미룬 저장
    if (G.onAuth) try { G.onAuth(true); } catch (e) { console.warn(e); } // 친구·파티 연결
    if (prev && prev.id === u.id && prev.name && prof && prof.username && prev.name !== prof.username) renamed(prev.name, name, prof);   // 이 기기가 모르는 사이에 아이디가 바뀜
    return note;
  }

  // ---------- 아이디가 다른 곳에서 바뀜 (v22: 운영자 강제 변경 — admin.sql admin_rename · 다른 기기에서 본인 변경) ----------
  //  프로필: 아이디 + 바꾼 시각. name_forced_at(운영자가 바꾼 시각)이 본인 변경(name_changed_at)보다 늦지 않으면 운영자 변경
  //  (서버에 그 칸이 아직 없으면 아이디만 읽는다)
  //  v23: 밴 시각·사유도 (그 칸이 아직 없는 서버면 예전 칸만)
  async function profOf(id) {
    try {
      let r = await sb.from('profiles').select('username, name_changed_at, name_forced_at, banned_until, ban_reason').eq('id', id).maybeSingle();
      if (r.error) r = await sb.from('profiles').select('username, name_changed_at, name_forced_at').eq('id', id).maybeSingle();
      if (r.error) r = await sb.from('profiles').select('username').eq('id', id).maybeSingle();
      return r.data || null;
    } catch (e) { return null; }
  }

  // ---------- v23 계정 밴 (admin.sql admin_ban) ----------
  //  실제로 막는 것은 Supabase 로그인(auth.users.banned_until — 비밀번호 로그인·세션 갱신을 'User is banned' 로 거부). 여기는 안내와 이미 로그인된 기기 정리:
  //  · 로그인이 막힘 → ban_info(아이디)로 기간·사유를 받아 창으로
  //  · 세션 복원·로그인 직후 내 프로필이 밴 중이면 → 로그아웃 + 창 (토큰이 아직 살아 있어도) — afterLogin
  //  · 운영자가 밴하면 로비 채널 알림(ban) → 서버에서 내 프로필을 다시 읽어 확인(누구나 보낼 수 있으므로 · 3초에 한 번) → 경기 중이면 로비로 · 로그아웃 + 창
  //  · 세션 갱신이 거부돼 SDK 가 로그아웃시키면(SIGNED_OUT) → 아이디로 밴인지 확인해 같은 처리
  let signingOut = false, banAt = 0, banning = false;
  const banOf = (p) => p && p.banned_until && new Date(p.banned_until).getTime() > Date.now() ? { until: p.banned_until, reason: p.ban_reason || '' } : null;
  const banTime = (t) => new Date(t).toLocaleString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  function banLeft(ms) { const m = Math.max(1, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${mm}분` : `${mm}분`; }
  async function banInfoByName(nm) {
    try { await loadSdk(); const { data, error } = await sb.rpc('ban_info', { p_name: nm }); if (!error && data) return banOf({ banned_until: data.until, ban_reason: data.reason }); } catch (e) { /* 서버에 함수가 없으면 기간 없이 안내 */ }
    return null;
  }
  function showBan(b, who) {
    $('banWho').textContent = who || '';
    $('banUntil').textContent = b ? `${banTime(b.until)}까지 로그인할 수 없습니다` : '정해진 기간 동안 로그인할 수 없습니다';
    $('banLeft').textContent = b ? `남은 시간 ${banLeft(new Date(b.until).getTime() - Date.now())}` : '';
    const rs = $('banReason'); rs.hidden = !(b && b.reason); rs.textContent = b && b.reason ? `사유: ${b.reason}` : '';
    $('banPanel').hidden = false;
  }
  // 로그인된 이 기기에서 밴을 알게 됨: 매칭·경기 정리 → 로그아웃 → 창
  async function kickBanned(b) {
    if (banning || !user) return; banning = true;
    const who = name;
    try {
      try { if (MM.searching()) MM.cancel('계정이 정지되어 매칭을 취소했습니다'); } catch (e) { console.warn(e); }
      if (G.state === 'play' || G.state === 'result') { try { toLobby(); } catch (e) { console.warn(e); } }
      await signOut();
    } finally { banning = false; }
    showBan(b, who);
  }
  async function checkBan() {
    if (!sb || !user || Date.now() - banAt < 3000) return false; banAt = Date.now();
    const b = banOf(await profOf(user.id)); if (!b) return false;
    kickBanned(b); return true;
  }
  async function lostSession() { if (!user) return; const b = await banInfoByName(name); if (b) kickBanned(b); }
  // 세션을 새로 받아 둔다 — 로그인 아이디(내부 이메일)가 바뀌었으므로 (비밀번호 변경이 옛 이메일로 다시 로그인해 확인하다 실패하지 않게)
  async function freshUser() { try { const r = await sb.auth.refreshSession(); if (r && r.data && r.data.user && user && r.data.user.id === user.id) user = r.data.user; } catch (e) { /* 다음 자동 갱신 때 */ } }
  let rnPend = null, rnT = null, rnAt = 0;
  function renamed(old, nm, p) {
    const forced = !!(p && p.name_forced_at && (!p.name_changed_at || new Date(p.name_forced_at) >= new Date(p.name_changed_at)));
    freshUser();
    rnPend = { old, nm, forced, toasted: false };
    showRenamed();
  }
  // 로비에서 창으로 알림 (경기 중·관전 화면이면 알림만 띄우고 로비로 돌아오면 창)
  function showRenamed() {
    const R = rnPend; if (!R) return;
    clearTimeout(rnT);
    if (G.state !== 'lobby' || Watch.viewing()) {
      if (!R.toasted) { R.toasted = true; HUD.toast(`${R.forced ? '운영자가 ' : ''}아이디를 '${R.nm}'(으)로 바꿨습니다 — 다음 로그인부터 새 아이디`, 'info'); }
      rnT = setTimeout(showRenamed, 1500); return;
    }
    rnPend = null;
    $('rnTitle').textContent = R.forced ? '운영자가 아이디를 바꿨습니다' : '아이디가 바뀌었습니다';
    $('rnOld').textContent = R.old; $('rnNew').textContent = R.nm;
    $('rnText').textContent = (R.forced ? '' : '다른 기기에서 아이디를 바꿨습니다. ') + `다음에 로그인할 때는 새 아이디 '${R.nm}'와 원래 비밀번호를 쓰세요. 이 기기는 지금 로그인된 그대로입니다.`;
    $('rnPanel').hidden = false;
  }
  // 운영자가 바꿨다는 신호(로비 채널 rn — 누구나 보낼 수 있으므로 서버에서 다시 읽어 보기만 함 · 3초에 한 번)
  async function refreshName() {
    if (!sb || !user || Date.now() - rnAt < 3000) return false; rnAt = Date.now();
    const p = await profOf(user.id);
    if (!p || !p.username || p.username === name || !user) return false;
    const old = name; name = p.username; store.set('account', { id: user.id, name });
    refreshUi(); renamed(old, name, p);
    return true;
  }

  // 관리자(개발자) 여부: 서버의 관리자 목록(supabase/admin.sql 의 public.admins — 계정 고유번호)으로 판단
  //  → 아이디를 바꿔도 관리자 그대로이고, 다른 사람이 '개발자' 아이디를 만들어도 관리자가 아니다
  //  서버에 admin.sql 이 아예 없을 때만 예전처럼 아이디(DEV_IDS)로 본다
  async function checkAdmin(nm) {
    try {
      const { data, error } = await sb.rpc('is_admin');
      if (!error) return data === true;
      const m = String(error.message || '').toLowerCase();
      if (error.code === 'PGRST202' || m.includes('could not find') || m.includes('does not exist')) return DEV_IDS.includes(String(nm || '').normalize('NFC').trim().toLowerCase());
    } catch (e) { /* 연결 실패: 관리자가 아닌 것으로 */ }
    return false;
  }
  // v23 역할: 'dev' 개발자 · 'sub' 부개발자 (서버 admin_role — 함수가 없는 옛 서버면 관리자 = 개발자)
  async function checkRole() {
    try { const { data, error } = await sb.rpc('admin_role'); if (!error) return data === 'sub' ? 'sub' : 'dev'; } catch (e) { /* */ }
    return 'dev';
  }
  // ---------- v23 다른 계정이 관리자(개발자·부개발자)인가 ----------
  //  파티 로비에서 개발자 전용 입장 연출과 관리자가 단 칭호를 '그 계정이 정말 관리자일 때만' 보여 주려고 다른 기기가 확인한다 (10_partyfx.js · 10_ranking.js)
  //  서버 staff_roles(supabase/admin.sql)에 계정 고유번호를 물어 { 고유번호: 'dev' | 'sub' } 를 받아 10분 동안 기억 (관리자가 아니면 '')
  //  서버에 그 함수가 아직 없으면 예약 아이디('개발자'·'부개발자' — 그 관리자 계정만 쓸 수 있음)로 본다
  const STAFF = new Map(), staffWant = new Set(), UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let staffSrv = null, staffOffT = 0, staffT = null;   // staffSrv: 서버에 staff_roles 가 있는가 (null = 아직 모름 · false = 없음 — staffOffT 에 확인한 시각)
  // 예약 아이디로 보는 역할 (직접 비교 — 객체에서 찾으면 '__proto__' 같은 아이디가 참으로 나온다)
  const staffByName = (nm) => { const k = String(nm || '').normalize('NFC').trim().toLowerCase(); return k === '개발자' ? 'dev' : k === '부개발자' ? 'sub' : ''; };
  const staffFresh = (uid) => { const c = STAFF.get(uid); return !!c && Date.now() - c.t < (c.ok ? 600e3 : 20e3); };
  // 그 계정의 역할: 'dev' · 'sub' · ''(관리자가 아님 또는 아직 모름)
  function staffRole(uid, nm) {
    if (!uid || !user) return '';
    if (uid === user.id) return admin ? role || 'dev' : '';
    if (staffSrv === false) return staffByName(nm);
    const c = STAFF.get(uid); return c ? c.r : '';
  }
  // 서버에 물어본 답이 있는가 (없으면 연출을 잠깐 미룬다)
  const staffKnown = (uid) => !uid || !user || uid === user.id || staffSrv === false || !!(STAFF.get(uid) && STAFF.get(uid).ok);
  // 모르는 계정을 모아 한 번에 묻는다 (16명씩)
  function staffAsk(uids) {
    if (!sb || !user) return;
    if (staffSrv === false) { if (Date.now() - staffOffT < 600e3) return; staffOffT = Date.now(); }   // 함수가 없던 서버: 10분마다 한 번 다시 물어본다 (그사이 설치됐으면 새로 고치지 않아도 넘어감 · 그동안은 계속 아이디로 봄)
    for (const u of uids || []) {
      if (!u || u === user.id || staffFresh(u)) continue;
      if (UUID_RE.test(u)) staffWant.add(u); else STAFF.set(u, { r: '', t: Date.now(), ok: true });   // 계정 고유번호 모양이 아니면 묻지 않고 관리자가 아닌 것으로 (하나라도 섞이면 서버가 묶음 전체를 거부한다)
    }
    if (!staffWant.size || staffT) return;
    staffT = setTimeout(async () => {
      const ids = [...staffWant].slice(0, 16); for (const u of ids) staffWant.delete(u);
      const miss = () => { for (const u of ids) STAFF.set(u, { r: (STAFF.get(u) || {}).r || '', t: Date.now(), ok: false }); };   // 연결 실패: 20초 뒤 다시
      try {
        const { data, error } = await sb.rpc('staff_roles', { p_ids: ids });
        if (error) { const m = String(error.message || '').toLowerCase(); if (error.code === 'PGRST202' || m.includes('could not find') || m.includes('does not exist')) { staffSrv = false; staffOffT = Date.now(); } else miss(); }
        else { staffSrv = true; for (const u of ids) STAFF.set(u, { r: data && (data[u] === 'dev' || data[u] === 'sub') ? data[u] : '', t: Date.now(), ok: true }); }
      } catch (e) { miss(); }
      staffT = null; if (staffWant.size) staffAsk([]);
    }, 0);
  }
  // 비밀번호 변경: 지금 비밀번호로 다시 로그인해 확인 → 새 비밀번호로 바꿈 → 이 기기를 뺀 다른 모든 기기의 로그인을 끊음
  //  돌려주는 값: 다른 기기 로그아웃까지 됐으면 true
  async function changePassword(cur, pw, pw2) {
    if (!sb || !user) throw new Error('로그인이 필요합니다');
    if (!cur) throw new Error('지금 비밀번호를 입력하세요');
    if (!pw || pw.length < 6) throw new Error('새 비밀번호는 6자 이상으로 정해 주세요');
    if (pw !== pw2) throw new Error('새 비밀번호 확인이 일치하지 않습니다');
    if (pw === cur) throw new Error('지금 비밀번호와 같습니다 — 다른 비밀번호로 정해 주세요');
    const a = await sb.auth.signInWithPassword({ email: user.email || idEmail(name), password: cur });
    if (a.error) { const m = String(a.error.message || '').toLowerCase(); throw new Error(a.error.code === 'invalid_credentials' || m.includes('invalid login credentials') ? '지금 비밀번호가 맞지 않습니다' : msgOf(a.error)); }
    if (a.data && a.data.user) user = a.data.user;
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) throw new Error(msgOf(error));
    try { const r = await sb.auth.signOut({ scope: 'others' }); return !(r && r.error); } catch (e) { return false; }
  }

  // ---------- 공개 API ----------
  async function init() {
    render();
    // 이전에 로그인했던 기기만 시작할 때 SDK를 불러 세션 복원 (게스트는 로그인 창을 열 때 불러옴)
    if (!enabled || !store.get('account', null)) { try { Rank.settle(); } catch (e) { console.warn(e); } return; }   // 게스트 기록도 v23 개편 정리
    status = 'restoring'; render();
    const g0 = loginGen;
    try {
      await loadSdk();
      const { data } = await sb.auth.getSession();
      if (g0 !== loginGen) return;   // SDK 를 받는 사이 로그인 창으로 들어옴 — 그 로그인이 이어 간다
      if (data && data.session && data.session.user) await afterLogin(data.session.user, false);
      else {
        const was = store.get('account', null);
        store.set('account', null); restoreGuest(); status = 'idle'; render(); try { Rank.settle(); } catch (e) { console.warn(e); }
        if (was && was.name) { const b = await banInfoByName(was.name); if (b) showBan(b, was.name); }   // v23 세션 갱신이 밴으로 거부돼 세션이 없어짐 → 안내
      }
    } catch (e) { if (e && e.stale) return; if (e && e.ban) { restoreGuest(); status = 'idle'; render(); return; } status = 'error'; lastErr = msgOf(e); render(); }   // e.stale: 복원 중에 로그아웃·다른 로그인 (그쪽이 화면을 정함) · e.ban: 밴 중인 계정 (afterLogin 이 로그아웃·창을 이미)
  }
  async function signUp(id, pw, pw2) {
    const bad = checkId(id); if (bad) throw new Error(bad);
    if (!pw || pw.length < 6) throw new Error('비밀번호는 6자 이상으로 정해 주세요');
    if (pw !== pw2) throw new Error('비밀번호 확인이 일치하지 않습니다');
    await loadSdk();
    const nm = id.normalize('NFC').trim();
    const { data, error } = await sb.auth.signUp({ email: idEmail(nm), password: pw, options: { data: { username: nm } } });
    if (error) throw new Error(msgOf(error));
    // 이메일 확인이 켜져 있으면 세션 없이 돌아온다 → 서버 설정 안내
    if (!data.session) throw new Error('가입은 됐지만 바로 로그인할 수 없습니다. Supabase에서 "Confirm email"을 꺼 주세요');
    // 같은 아이디로 이미 가입된 경우 Supabase는 빈 identities로 돌려준다
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('이미 사용 중인 아이디입니다');
    return afterLogin(data.user, true);
  }
  async function signIn(id, pw) {
    const bad = checkId(id); if (bad) throw new Error(bad);
    if (!pw) throw new Error('비밀번호를 입력하세요');
    await loadSdk();
    const { data, error } = await sb.auth.signInWithPassword({ email: idEmail(id), password: pw });
    if (error) {
      // v23 밴: Supabase 가 로그인을 거부 → 기간·사유를 받아 창으로
      if (error.code === 'user_banned' || /banned/i.test(String(error.message || ''))) {
        const nm = id.normalize('NFC').trim(), b = await banInfoByName(nm); showBan(b, nm);
        const e = new Error(b ? `정지된 계정입니다 — ${banTime(b.until)}까지` : '정지된 계정입니다'); e.ban = true; throw e;
      }
      throw new Error(msgOf(error));
    }
    return afterLogin(data.user, false);
  }
  function restoreGuest() {
    const g = store.get('guestBackup', null);
    if (g) { apply(g); store.set('guestBackup', null); }
  }
  async function signOut() {
    loginGen++;   // 진행 중이던 로그인(afterLogin)은 다음 await 뒤에 멈춘다 — 늦게 온 답이 로그아웃한 뒤·다음 계정에 얹히지 않게
    if (dirty) await pushNow();
    signingOut = true;
    try { if (sb) await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* 오프라인이어도 로컬 로그아웃 */ } finally { signingOut = false; }
    if (G.onAuth) try { G.onAuth(false); } catch (e) { console.warn(e); }
    user = null; name = null; admin = false; role = null; status = 'idle'; clearTimeout(syncT); dirty = false; base = null; hold = null; pend = null; acctLoad = false;
    STAFF.clear(); staffWant.clear(); staffSrv = null; staffOffT = 0;
    store.set('account', null);
    restoreGuest();
    refreshUi();
  }

  // ---------- 화면 ----------
  let mode = 'login';
  function render() {
    const chip = $('acctChip'); if (!chip) return;
    chip.hidden = !enabled;
    if (!enabled) return;
    if (typeof Prof !== 'undefined') Prof.renderChip();   // 사진·테두리 + 이름 + 칭호 (10_ui_profile.js)
    chip.classList.toggle('on', !!user); chip.classList.toggle('err', status === 'error' && !!user);
    chip.title = user ? `${name} · ${status === 'error' ? '동기화 실패' : '기록이 서버에 저장됩니다'}` : '로그인하면 기록이 서버에 저장됩니다';
    const op = $('opName'); if (op) op.textContent = user ? name : '오퍼레이터';
    Dev.refresh();
    const P = $('acctPanel'); if (!P || P.hidden) return;
    $('acctForm').hidden = !!user; $('acctInfo').hidden = !user;
    if (user) {
      $('acctWho').textContent = name;
      $('acctSync').textContent = status === 'syncing' ? '저장 중…' : status === 'error' ? `저장 실패 — ${lastErr}` : lastSync ? `마지막 저장 ${new Date(lastSync).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '';
    } else {
      document.querySelectorAll('#acctTabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      $('acctPw2Row').hidden = mode !== 'signup'; $('acctSubmit').textContent = mode === 'signup' ? '가입하고 시작' : '로그인';
      $('acctHint').textContent = mode === 'signup' ? '아이디는 게임 속 이름으로 표시됩니다 (2~10자, 한글·영문·숫자·_). 비밀번호를 잊으면 찾을 수 없으니 꼭 기억해 두세요.' : '처음이면 회원가입 탭에서 아이디를 만드세요. 로그인하지 않아도 게임은 그대로 할 수 있습니다.';
    }
  }
  // 아이디 변경 (서버 함수 change_username: 3일에 한 번, 로그인 아이디(내부 이메일)도 같이 바뀜 — supabase/profile.sql)
  async function rename(nm) {
    if (!sb || !user) throw new Error('로그인이 필요합니다');
    const bad = checkId(nm); if (bad) throw new Error(bad);
    nm = nm.normalize('NFC').trim();
    if (nm.toLowerCase() === (name || '').toLowerCase()) throw new Error('지금 아이디와 같습니다');
    const { data, error } = await sb.rpc('change_username', { p_name: nm });
    if (error) { const m = (error.message || '').toLowerCase(); throw new Error(m.includes('could not find') || m.includes('does not exist') || error.code === 'PGRST202' ? '서버 설정 필요: Supabase SQL Editor에서 supabase/profile.sql 을 실행해 주세요' : msgOf(error)); }
    const r = String(data || '');
    if (r === 'taken') throw new Error('이미 사용 중인 아이디입니다');
    if (r === 'invalid') throw new Error('아이디는 2~10자, 한글·영문·숫자·밑줄(_)만 쓸 수 있습니다');
    if (r.startsWith('wait:')) { const t = Number(r.slice(5)) * 1000, h = Math.ceil((t - Date.now()) / 36e5); throw new Error(`아이디는 3일에 한 번 바꿀 수 있습니다 (${h > 24 ? Math.floor(h / 24) + '일 ' + (h % 24) + '시간' : h + '시간'} 뒤 가능)`); }
    if (r !== 'ok') throw new Error('바꾸지 못했습니다: ' + r);
    name = nm; store.set('account', { id: user.id, name });
    refreshUi(); freshUser();
    return name;
  }
  function open() { if (!enabled) return; if (user && typeof Prof !== 'undefined') { Prof.open(); return; } $('acctPanel').hidden = false; $('acctMsg').textContent = ''; $('acctMsg').className = 'acct-msg'; render(); if (!user) { loadSdk().catch(() => {}); setTimeout(() => $('acctId').focus(), 50); } }
  function close() { $('acctPanel').hidden = true; $('acctPw').value = ''; $('acctPw2').value = ''; }
  function setup() {
    const chip = $('acctChip'); if (!chip) return;
    chip.addEventListener('click', () => { Audio.init(); Audio.ui(); open(); });
    $('acctClose').addEventListener('click', close);
    document.querySelectorAll('#acctTabs button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; $('acctMsg').textContent = ''; render(); }));
    const msg = (t, ok) => { const m = $('acctMsg'); m.textContent = t; m.className = 'acct-msg' + (ok ? ' ok' : ' bad'); };
    $('acctForm').addEventListener('submit', async (e) => {
      e.preventDefault(); if (busy) return;
      const btn = $('acctSubmit'); btn.disabled = true; msg(mode === 'signup' ? '가입 중…' : '로그인 중…', true);
      try {
        const note = mode === 'signup' ? await signUp($('acctId').value, $('acctPw').value, $('acctPw2').value) : await signIn($('acctId').value, $('acctPw').value);
        close(); HUD.lobbyNote(note || `${name}님으로 로그인했습니다`);
      } catch (err) { if (err && err.stale) return; msg(err.message || String(err), false); }   // stale: 로그인하는 사이 로그아웃함 (로그아웃이 창·알림을 이미)
      finally { btn.disabled = false; }
    });
    $('acctLogout').addEventListener('click', async () => { await signOut(); close(); HUD.lobbyNote('로그아웃했습니다 — 이 기기의 게스트 기록으로 돌아왔습니다'); });
    $('acctSyncNow').addEventListener('click', async () => { const ok = await pushNow(); render(); if (ok) msg('저장했습니다', true); });
    $('rnOk').addEventListener('click', () => { Audio.ui(); $('rnPanel').hidden = true; });
    $('banOk').addEventListener('click', () => { Audio.ui(); $('banPanel').hidden = true; });
    render();
  }
  return { init, setup, signUp, signIn, signOut, pushNow, pull, open, close, rename, refreshName, checkBan, changePassword, checkId, idEmail, client: () => sb, msgOf, staffRole, staffKnown, staffAsk, get uid() { return user && user.id; },
    get enabled() { return enabled; }, get user() { return user; }, get name() { return name; }, get admin() { return admin; }, get role() { return role; }, get status() { return status; }, get lastError() { return lastErr; } };
})();
// 게임 속 내 이름: 로그인했으면 아이디, 아니면 '나'
const playerName = () => (Cloud.user && Cloud.name) || '나';
