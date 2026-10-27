// ============================================================
// 10_cloud.js — 계정(아이디·비밀번호)과 기록 동기화 (Supabase)
//  · 아이디 → 내부용 이메일 'u<UTF-8 16진수>@CLOUD_CFG.idDomain' 으로 바꿔 Supabase Auth 비밀번호 로그인 사용
//    (대소문자만 다른 아이디는 같은 계정. 표시 이름은 가입 때 쓴 그대로)
//  · 서버에 저장: 전적(STATS)·랭크·설정(기기별 설정 제외). 로컬 저장소는 캐시 역할
//  · 로그인: 서버에 기록이 있으면 그걸 불러오고, 비어 있으면(새 계정) 이 기기의 기록을 올린다
//    로그인 전 기기 기록(게스트)은 따로 보관했다가 로그아웃하면 되돌린다 → 한 기기를 가족이 같이 써도 섞이지 않음
//  · 서버가 꺼져 있거나(무료 프로젝트 7일 비활성 정지) SDK를 못 불러와도 게임은 게스트로 그대로 동작
//  · SDK는 필요할 때 CDN에서 불러온다(버전 고정)
// ============================================================
const Cloud = (() => {
  const cfg = CLOUD_CFG, enabled = !!(cfg.url && cfg.key);
  let sb = null, loading = null, user = null, name = null, status = enabled ? 'idle' : 'off', lastSync = 0, dirty = false, syncT = null, busy = false, lastErr = '';
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
          res(sb);
        } catch (e) { rej(e); }
      };
      if (window.supabase && window.supabase.createClient) return done();
      const s = document.createElement('script'); s.src = cfg.sdk; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = done; s.onerror = () => rej(new Error('로그인 모듈을 불러오지 못했습니다 (인터넷 연결 확인 후 다시 시도)'));
      document.head.appendChild(s);
    }).catch((e) => { loading = null; throw e; });
    return loading;
  }

  // ---------- 기록 묶기 / 풀기 ----------
  function pack() {
    const st = {}; for (const k in SETTINGS) if (!DEVICE_SETTINGS.includes(k)) st[k] = SETTINGS[k];
    return { stats: STATS, rank: Rank.state, settings: st };
  }
  function apply(d) {
    STATS = Object.assign({ matches: 0, wins: 0, kills: 0, xp: 0, best: 99, recent: [] }, d.stats || {});
    if (!STATS.dm) STATS.dm = Object.assign({}, DM_STATS0);
    store.set('stats', STATS);
    Rank.replace(d.rank || {});
    if (d.settings) { const keep = {}; for (const k of DEVICE_SETTINGS) keep[k] = SETTINGS[k]; SETTINGS = Object.assign({}, DEFAULT_SETTINGS, d.settings, keep); store.set('settings', SETTINGS); }
  }
  const hasProgress = (d) => !!(d && d.stats && ((d.stats.matches || 0) > 0 || (d.stats.xp || 0) > 0));
  function refreshUi() {
    if (G.state === 'lobby') { HUD.renderLobby(); if (G.applySettings) G.applySettings('view'); if (Lobby.setOutfit) { Lobby.setOutfit(SETTINGS.outfit); Lobby.teamN = 0; } }
    render();
  }

  // ---------- 동기화 ----------
  async function pushNow() {
    if (!sb || !user) return false;
    if (busy) { dirty = true; return false; }
    busy = true; dirty = false; status = 'syncing'; render();
    try {
      const d = pack();
      const { error } = await sb.from('player_data').upsert({ user_id: user.id, stats: d.stats, rank: d.rank, settings: d.settings });
      if (error) throw error;
      lastSync = Date.now(); status = 'online'; lastErr = '';
      return true;
    } catch (e) { status = 'error'; lastErr = msgOf(e); dirty = true; return false; }
    finally { busy = false; render(); if (dirty && status !== 'error') schedule(1500); }
  }
  function schedule(ms) { if (!user) return; clearTimeout(syncT); syncT = setTimeout(pushNow, ms); }
  onDataSaved = () => { if (user) { dirty = true; schedule(2000); } };
  // 창을 닫거나 다른 앱으로 갈 때 밀린 저장을 바로 보냄
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && dirty) { clearTimeout(syncT); pushNow(); } });

  // 로그인 직후: 게스트 기록 보관 → 서버 기록 불러오기(없으면 이 기기 기록 올리기)
  async function afterLogin(u, fresh) {
    user = u;
    let prof = null;
    try { const r = await sb.from('profiles').select('username').eq('id', u.id).maybeSingle(); prof = r.data; } catch (e) { /* 프로필 조회 실패해도 진행 */ }
    name = (prof && prof.username) || (u.user_metadata && u.user_metadata.username) || '플레이어';
    if (!store.get('guestBackup', null)) store.set('guestBackup', { stats: STATS, rank: Rank.state, settings: SETTINGS });
    let row = null;
    const r = await sb.from('player_data').select('stats, rank, settings, updated_at').eq('user_id', u.id).maybeSingle();
    if (r.error) throw r.error;
    row = r.data;
    let note;
    if (hasProgress(row)) { apply(row); note = `${name}님의 기록을 불러왔습니다`; }
    else { // 새 계정(또는 아직 기록이 없는 계정): 지금 이 기기의 기록을 계정으로 옮김
      await pushNow();
      // '옮김'이므로 로그아웃 뒤 게스트 기록은 새로 시작 (같은 기록이 게스트·계정 양쪽에 복사되지 않게). 기기별 설정은 유지
      if (hasProgress(pack())) { const g = store.get('guestBackup', null); if (g) store.set('guestBackup', { stats: null, rank: null, settings: g.settings }); note = '이 기기의 기록을 계정으로 옮겼습니다'; }
      else note = `${name}님, 환영합니다`;
    }
    store.set('account', { id: u.id, name });
    status = 'online'; lastSync = Date.now();
    refreshUi();
    if (G.onAuth) try { G.onAuth(true); } catch (e) { console.warn(e); } // 친구·파티 연결
    return note;
  }

  // ---------- 공개 API ----------
  async function init() {
    render();
    if (!enabled) return;
    // 이전에 로그인했던 기기만 시작할 때 SDK를 불러 세션 복원 (게스트는 로그인 창을 열 때 불러옴)
    if (!store.get('account', null)) return;
    status = 'restoring'; render();
    try {
      await loadSdk();
      const { data } = await sb.auth.getSession();
      if (data && data.session && data.session.user) await afterLogin(data.session.user, false);
      else { store.set('account', null); restoreGuest(); status = 'idle'; render(); }
    } catch (e) { status = 'error'; lastErr = msgOf(e); render(); }
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
    if (error) throw new Error(msgOf(error));
    return afterLogin(data.user, false);
  }
  function restoreGuest() {
    const g = store.get('guestBackup', null);
    if (g) { apply(g); store.set('guestBackup', null); }
  }
  async function signOut() {
    if (dirty) await pushNow();
    try { if (sb) await sb.auth.signOut({ scope: 'local' }); } catch (e) { /* 오프라인이어도 로컬 로그아웃 */ }
    if (G.onAuth) try { G.onAuth(false); } catch (e) { console.warn(e); }
    user = null; name = null; status = 'idle'; clearTimeout(syncT); dirty = false;
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
    const t = user ? name : status === 'restoring' ? '접속 중…' : '로그인';
    chip.querySelector('span').textContent = t;
    chip.classList.toggle('on', !!user); chip.classList.toggle('err', status === 'error' && !!user);
    chip.title = user ? `${name} · ${status === 'error' ? '동기화 실패' : '기록이 서버에 저장됩니다'}` : '로그인하면 기록이 서버에 저장됩니다';
    const op = $('opName'); if (op) op.textContent = user ? name : '오퍼레이터';
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
  function open() { if (!enabled) return; $('acctPanel').hidden = false; $('acctMsg').textContent = ''; $('acctMsg').className = 'acct-msg'; render(); if (!user) { loadSdk().catch(() => {}); setTimeout(() => $('acctId').focus(), 50); } }
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
      } catch (err) { msg(err.message || String(err), false); }
      finally { btn.disabled = false; }
    });
    $('acctLogout').addEventListener('click', async () => { await signOut(); close(); HUD.lobbyNote('로그아웃했습니다 — 이 기기의 게스트 기록으로 돌아왔습니다'); });
    $('acctSyncNow').addEventListener('click', async () => { const ok = await pushNow(); render(); if (ok) msg('저장했습니다', true); });
    render();
  }
  return { init, setup, signUp, signIn, signOut, pushNow, open, close, checkId, idEmail, client: () => sb, msgOf, get uid() { return user && user.id; },
    get enabled() { return enabled; }, get user() { return user; }, get name() { return name; }, get status() { return status; }, get lastError() { return lastErr; } };
})();
// 게임 속 내 이름: 로그인했으면 아이디, 아니면 '나'
const playerName = () => (Cloud.user && Cloud.name) || '나';
