// ============================================================
// 10_event.js — 로비 상단 '이벤트': THE BACKROOMS 콜라보 이벤트 2가지 (v22 — 계정마다 1번)
//  ① 탈출 이벤트: 백룸에서 어떤 방법으로든 탈출 1회 → 골드 탄피 30,000 + 칭호·테두리 '백룸 탈출자' + 사진 '스마일러'
//  ② 완전 탈출 이벤트: 12가지 방법을 모두 탈출 → 골드 탄피 150,000 + 칭호·테두리 '백룸 정복자' + 사진 'Level 0'
//  · 계정 연동 (supabase/backrooms.sql): 로그인한 계정마다 연결 코드가 하나 있고, '백룸 들어가기'가 그 코드를 주소 뒤(#ldr=코드)로 넘긴다
//    → 백룸(js/ldr.js)은 그 기기에서 탈출할 때마다 서버에 '이 계정이 이 방법으로 탈출'을 기록한다 (로그인 없이 코드로)
//    → 이 창은 서버의 기록(br_state)으로 진행을 보여 주고, 받기(br_claim)는 서버가 계정마다 한 번만 허락한다 — 기기가 아니라 계정마다
//  · 보상은 Eco.grant(보상 대기열)로 넣는다 — 계정을 불러오는 중이어도, 서버에 올리기 전에 창을 닫아도 사라지지 않음
//  · 백룸 탭이 열려 있으면 탈출하자마자 postMessage 로 알려 오고, 탈출 화면의 '보상 받기' 버튼은 ?brx=1 을 달고 돌아온다
//  · 예전 판(v20~v21, 기기마다 1번)과 이어짐
//    - 예전에 받은 계정(STATS.eco.brx)은 서버에 '받음'으로만 적는다 (br_claim mark — 보상 없음)
//    - 예전 방식으로 이 기기에서 탈출이 확인됐지만 아직 안 받은 것(기기 기록 st 'esc')은 그대로 받을 수 있다 (br_claim old)
//    - 예전 백룸이 돌려주는 서명 코드(이 기기의 참가 코드 n 에 FNV-1a 서명)도 아직 받는다 → 그래서 주소에 n 도 함께 넘긴다
//    - v21 복구(recover)·차액 지급(topUp)은 예전 기기 기록 그대로
// ============================================================
const BR_EVENT = { url: 'https://backrooms-theta.vercel.app/', origin: 'https://backrooms-theta.vercel.app', gold: 30000, salt: 'ldr-backrooms-escape-v1', title: '백룸 탈출자', gold12: 150000, title12: '백룸 정복자' };
// 백룸의 탈출 방법 12가지 — 백룸 js/escapes.js · supabase/backrooms.sql 과 같은 id · 도감 순서 [id, 이름, 레벨]
const BR_ESCAPES = [['elevator', '비상 엘리베이터', 'Level 3'], ['radio', 'M.E.G. 구조 요청', 'Level 1'], ['drain', '배수구', 'Level 37'], ['boarding', '귀가 편', 'Level 36'], ['train', '막차', 'Level -10'], ['pod', '탈출 포드', 'Level -25'],
  ['lighthouse', '등대', 'Level 7'], ['dream', '꿈에서 깨기', 'Level 18'], ['phones', '세 통의 전화', 'Level 11'], ['book', '이름이 적힌 책', 'THE END'], ['stairs', '계단 위의 문', 'Level -14'], ['mirror', '거울 너머', 'Level -3']];
const EvBR = (() => {
  const K = 'evBR', el = (id) => document.getElementById(id);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  // 기기 기록 (예전 판에서 이어짐): st = new · go(백룸으로 감) · esc(예전 방식으로 탈출 확인 · 받기 전) · done(예전 방식으로 받음)
  //  n = 이 기기의 참가 코드 · seen / seen2 = 이벤트 창을 열어 봄 (seen2 = 12가지 이벤트가 생긴 뒤)
  const get = () => { const s = store.get(K, null); return s && typeof s === 'object' && s.st ? s : { st: 'new', n: null, seen: 0 }; };
  const put = (s) => store.set(K, s);
  const fnv = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  const sign = (n) => n + '.' + fnv(n + '|escaped|' + BR_EVENT.salt) + fnv(BR_EVENT.salt + '|' + n);
  const local = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const okOrigin = (o) => o === BR_EVENT.origin || (local() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));   // 로컬 개발 때는 로컬 백룸도
  const art = {};
  let msgT = null;

  // ---------- 계정 상태 (서버 br_state) ----------
  //  st: idle · guest(로그인 안 함) · wait(계정 불러오는 중) · load · ok · off(서버에 backrooms.sql 이 아직 없음) · err
  const A0 = (uid) => ({ st: 'idle', uid, code: null, esc: new Map(), claims: new Set(), t: 0, err: '' });
  let A = A0(null), syncP = null, busy = '';
  function sync(force) {
    const uid = (typeof Cloud !== 'undefined' && Cloud.uid) || null;
    if (A.uid !== uid) A = A0(uid);
    if (!uid) { A.st = typeof Cloud !== 'undefined' && Cloud.status === 'restoring' ? 'wait' : 'guest'; return Promise.resolve(A); }
    const sb = Cloud.client(); if (!sb) { A.st = 'wait'; return Promise.resolve(A); }
    if (syncP) return syncP;
    if (!force && A.st === 'ok' && Date.now() - A.t < 20000) return Promise.resolve(A);
    if (A.st !== 'ok') A.st = 'load';
    syncP = (async () => {
      try {
        const { data, error } = await sb.rpc('br_state');
        if (Cloud.uid !== uid) return A;   // 그사이 계정이 바뀜
        if (error) throw error;
        A.code = (data && data.code) || null;
        A.esc = new Map(((data && data.esc) || []).map((x) => [x.m, x.at]));
        A.claims = new Set((data && data.claims) || []);
        A.st = 'ok'; A.t = Date.now(); A.err = '';
        await legacy(sb);
      } catch (e) {
        const m = String((e && e.message) || e).toLowerCase();
        A.st = e && (e.code === 'PGRST202' || m.includes('could not find') || m.includes('does not exist')) ? 'off' : 'err';
        A.err = Cloud.msgOf(e);
      } finally { syncP = null; }
      return A;
    })();
    return syncP;
  }
  // 예전 판에서 이미 받은 계정(STATS.eco.brx) → 서버에 '받음'으로만 적는다 (다른 기기에서도 받음으로 보이게)
  async function legacy(sb) {
    if (A.claims.has('one') || !(STATS.eco && STATS.eco.brx)) return;
    try { const { data, error } = await sb.rpc('br_claim', { p_ev: 'one', p_how: 'mark' }); if (!error && (data === 'marked' || data === 'already')) A.claims.add('one'); } catch (e) { /* 다음에 다시 */ }
  }
  const n12 = () => BR_ESCAPES.filter(([id]) => A.esc.has(id)).length;
  const nameOf = (m) => { const e = BR_ESCAPES.find(([id]) => id === m); return e ? e[1] : ''; };
  // 이벤트 하나의 상태: lock(로그인·서버 확인 전) · run(진행 중) · ready(받을 수 있음) · done(받음)
  function evSt(ev) {
    if (A.st !== 'ok') return 'lock';
    const e = STATS.eco || {};
    if (A.claims.has(ev) || (ev === 'one' ? e.brx : e.brx12)) return 'done';
    if (ev === 'one') return A.esc.size > 0 || get().st === 'esc' ? 'ready' : 'run';
    return n12() >= BR_ESCAPES.length ? 'ready' : 'run';
  }

  // ---------- 백룸 배너 그림 (외부 이미지 없이 캔버스로: 노란 벽지 · 형광등 · 끝없는 복도) ----------
  //  kind 'one' = 탈출 이벤트 · 'all' = 완전 탈출(12가지) — 소실점을 반대로 두고 복도 끝에 초록 EXIT 표지
  function banner(kind) {
    const all = kind === 'all', key = all ? 'all' : 'one';
    if (art[key]) return art[key];
    const W = 720, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const vx = W * (all ? 0.36 : 0.62), vy = H * 0.47;   // 소실점
    g.fillStyle = '#c8b560'; g.fillRect(0, 0, W, H);
    // 벽지: 세로 줄 + 작은 V 무늬
    for (let x = 0; x < W; x += 14) { g.fillStyle = x % 28 ? 'rgba(120,100,30,0.10)' : 'rgba(255,245,180,0.10)'; g.fillRect(x, 0, 7, H); }
    g.strokeStyle = 'rgba(110,90,25,0.18)'; g.lineWidth = 1;
    for (let y = 8; y < H; y += 18) for (let x = (y / 18 % 2) * 7; x < W; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3.5, y + 4); g.lineTo(x + 7, y); g.stroke(); }
    // 천장(위) · 카펫(아래) 쐐기
    g.fillStyle = '#ddd2a0'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(vx + 46, vy - 26); g.lineTo(vx - 46, vy - 26); g.closePath(); g.fill();
    g.fillStyle = '#8a7a42'; g.beginPath(); g.moveTo(0, H); g.lineTo(W, H); g.lineTo(vx + 46, vy + 26); g.lineTo(vx - 46, vy + 26); g.closePath(); g.fill();
    // 형광등: 소실점으로 갈수록 작아짐
    for (let i = 0; i < 7; i++) { const k = Math.pow(0.62, i), y = vy - 26 - (vy - 26) * k * 0.82, w = 120 * k, cx = vx + (W * 0.5 - vx) * k;
      g.fillStyle = `rgba(255,255,236,${0.95 - i * 0.08})`; g.fillRect(cx - w / 2, y, w, Math.max(2, 10 * k)); g.fillStyle = `rgba(255,252,210,${0.18 - i * 0.02})`; g.fillRect(cx - w, y - 4 * k, w * 2, 22 * k); }
    // 복도 끝 문 (어두움) — 완전 탈출은 문 위에 초록 EXIT 표지와 새어 나오는 빛
    g.fillStyle = '#2b2510'; g.fillRect(vx - 16, vy - 22, 32, 48); g.fillStyle = 'rgba(255,240,170,0.25)'; g.fillRect(vx - 16, vy - 22, 32, 3);
    if (all) {
      const gl = g.createRadialGradient(vx, vy - 30, 2, vx, vy - 30, 60); gl.addColorStop(0, 'rgba(120,255,140,0.55)'); gl.addColorStop(1, 'rgba(120,255,140,0)'); g.fillStyle = gl; g.fillRect(vx - 70, vy - 90, 140, 120);
      g.fillStyle = '#0d3a16'; g.fillRect(vx - 21, vy - 39, 42, 14); g.strokeStyle = '#8dff9a'; g.lineWidth = 1.5; g.strokeRect(vx - 21, vy - 39, 42, 14);
      g.font = '800 11px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#c4ffbe'; g.fillText('EXIT', vx, vy - 28); g.textAlign = 'left';
      g.fillStyle = 'rgba(150,255,150,0.18)'; g.fillRect(vx - 16, vy - 22, 32, 48);
    }
    // 가장자리 어둡게
    const vg = g.createRadialGradient(vx, vy, 30, vx, vy, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,16,4,0.62)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // 제목 (살짝 어긋난 잔상) — 완전 탈출은 오른쪽 정렬
    const tx = all ? W - 28 : 28; g.textAlign = all ? 'right' : 'left';
    g.font = '800 54px "Saira Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'alphabetic';
    const T = all ? '12 EXITS' : 'THE BACKROOMS';
    g.fillStyle = 'rgba(255,40,40,0.45)'; g.fillText(T, tx + 3, 196); g.fillStyle = all ? 'rgba(80,255,120,0.45)' : 'rgba(40,220,255,0.4)'; g.fillText(T, tx - 3, 194);
    g.fillStyle = '#f7f0cf'; g.fillText(T, tx, 195);
    g.font = '600 17px "IBM Plex Sans KR", sans-serif'; g.fillStyle = 'rgba(247,240,207,0.9)'; g.fillText(all ? 'THE BACKROOMS — 12가지 방법으로 모두 탈출하라' : '어떤 출구든 찾아 탈출하라', tx + (all ? -2 : 2), 222);
    return (art[key] = c.toDataURL('image/jpeg', 0.86));
  }

  // ---------- 흐름 ----------
  // 백룸 열기: 계정 연결 코드(#ldr=) + 예전 백룸용 참가 코드(n) + 돌아올 주소(r) 를 달고 새 탭으로
  //  (window.open 은 누른 그 순간에 불러야 팝업이 막히지 않는다 → 연결 코드는 창을 열 때 미리 받아 둠)
  function go() {
    if (A.st !== 'ok' || !A.code) { sync(true).then(() => render()); return; }
    const s = get();
    if (!s.n) s.n = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 16);
    if (s.st === 'new') s.st = 'go'; s.goT = Date.now(); put(s);
    const u = new URL(BR_EVENT.url); u.searchParams.set('from', 'ldr'); u.searchParams.set('n', s.n); u.searchParams.set('r', location.origin + location.pathname); u.hash = 'ldr=' + A.code;
    const w = window.open(u.toString(), '_blank');   // opener 를 남겨 둠 → 탈출하면 백룸 탭이 이 창에 바로 알림
    if (!w) location.href = u.toString();             // 팝업이 막혔으면 이 탭에서 이동 (탈출 화면의 돌아오기 버튼으로 확인)
    render(); dots();
  }
  // 예전 백룸의 탈출 코드 (postMessage 또는 ?brx=코드) — 이 기기의 참가 코드와 서명이 맞아야
  function accept(code) {
    const s = get();
    if (!s.n || typeof code !== 'string' || code !== sign(s.n)) { flash('이 기기에서 시작한 이벤트 기록과 맞지 않습니다 — 이벤트 창에서 ‘백룸 들어가기’를 눌러 시작한 뒤 탈출해 주세요'); open(); return false; }
    if (s.st !== 'esc') { s.st = 'esc'; s.escT = Date.now(); put(s); }
    open(); flash('백룸 탈출 확인! 보상을 받으세요'); try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ }
    return true;
  }
  // 새 백룸: 서버에 기록했다는 알림 → 다시 불러와 보여 줌
  function escaped(m) {
    open().then(() => { const nm = nameOf(m); if (A.st === 'ok' && (A.esc.size || !m)) flash(m ? `백룸 탈출이 계정에 기록됐습니다 — ‘${nm || m}’ · 12가지 중 ${n12()}가지` : `백룸에서 돌아왔습니다 — 계정에 기록된 탈출 ${n12()} / 12가지`); });
    try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ }
  }
  // 보상이 늘었을 때(1,000 → 30,000): 예전 방식으로 받은 기기에는 차액을 한 번 더 (s.gold = 이 기기에서 받은 양)
  function topUp() {
    const s = get(); if (s.st !== 'done') return;
    const had = s.gold || 1000; if (had >= BR_EVENT.gold) return;
    s.gold = BR_EVENT.gold; put(s); Eco.grant({ id: 'brxup:' + s.n + ':' + BR_EVENT.gold, gold: BR_EVENT.gold - had, brx: 1 });
    flash(`백룸 탈출 이벤트 보상이 늘었습니다 — 차액 골드 탄피 ${(BR_EVENT.gold - had).toLocaleString()}개를 더 드렸고, 사진 ‘스마일러’와 테두리 ‘백룸 탈출자’도 열렸습니다`); open();
  }
  // 보상 받기: 서버가 계정마다 한 번만 'ok' → 보상 대기열에 넣음
  async function claim(ev) {
    if (busy || evSt(ev) !== 'ready') return;
    busy = ev; render();
    const s0 = get(), how = ev === 'one' && !A.esc.size && s0.st === 'esc' ? 'old' : 'new';
    try {
      const { data, error } = await Cloud.client().rpc('br_claim', { p_ev: ev, p_how: how });
      if (error) throw error;
      if (data === 'ok') {
        A.claims.add(ev);
        const s = get(); if (ev === 'one' && s.st === 'esc') { s.st = 'done'; s.doneT = Date.now(); s.gold = BR_EVENT.gold; s.fix = 1; s.who = Cloud.name || ''; put(s); }
        const r = Eco.grant(ev === 'one' ? { id: 'brx1:' + A.uid, gold: BR_EVENT.gold, brx: 1 } : { id: 'brx12:' + A.uid, gold: BR_EVENT.gold12, brx12: 1 });
        busy = ''; const m = el('evMsg'); if (m) m.hidden = true;
        render(ev); dots();
        if (r === 'wait') flash('계정을 불러오는 중입니다 — 다 불러오면 보상이 계정에 들어갑니다');
        return;
      }
      if (data === 'already') { A.claims.add(ev); flash('이 계정은 이미 이 이벤트 보상을 받았습니다'); }
      else if (data === 'not-yet') { A.t = 0; await sync(true); flash(ev === 'all' ? `아직 12가지를 다 탈출하지 않았습니다 (${n12()} / 12)` : '아직 계정에 기록된 탈출이 없습니다'); }
      else flash('보상을 받지 못했습니다 (' + data + ')');
    } catch (e) { flash('보상을 받지 못했습니다 — ' + Cloud.msgOf(e)); }
    busy = ''; render(); dots();
  }
  // v21 복구: 예전 판에서는 계정을 불러오는 중에 받으면 보상이 사라졌다 → 이 기기는 받았는데 로그인한 계정에 '백룸 탈출자'가 없으면 한 번 다시 넣는다
  //  기기마다 한 번만 (s.fix). 로그인한 계정을 다 불러온 뒤 10_cloud.js 가 부름 — v22: 그때 서버의 이벤트 기록도 새로 불러옴
  function recover() {
    setTimeout(() => sync(true).then(() => { dots(); if (!el('evPanel').hidden) render(); }), 0);
    const s = get(); if (s.st !== 'done' || s.fix || typeof Cloud === 'undefined' || !Cloud.user) return;
    s.fix = 1; put(s);
    if (STATS.eco && STATS.eco.brx) return;   // 이 계정에 이미 들어와 있음
    Eco.grant({ id: 'brxfix:' + s.n, gold: s.gold || BR_EVENT.gold, brx: 1 });
    setTimeout(() => { try { HUD.lobbyNote(`백룸 탈출 이벤트 보상이 계정에 들어오지 않은 것을 확인해 다시 드렸습니다 — 골드 탄피 ${(s.gold || BR_EVENT.gold).toLocaleString()} · 칭호·사진·테두리`); } catch (e) { /* 로비 밖이면 생략 */ } }, 600);
  }
  // 프로필 칭호 목록의 진행 표시 (10_ui_profile.js)
  function prog(ev) {
    if (typeof Cloud === 'undefined' || !Cloud.user) return '로그인 후 로비 위 이벤트에서';
    const st = evSt(ev);
    return st === 'done' ? '받음' : st === 'ready' ? '이벤트 창에서 보상 받기' : st === 'lock' ? '이벤트 창을 열어 확인' : ev === 'one' ? '백룸에서 탈출 1회' : `탈출 ${n12()} / ${BR_ESCAPES.length}가지`;
  }

  // ---------- 화면 ----------
  function flash(msg) { const m = el('evMsg'); if (!m) return; m.textContent = msg; m.hidden = false; clearTimeout(msgT); msgT = setTimeout(() => { m.hidden = true; }, 6000); }
  const GOLD_SVG = '<svg viewBox="0 0 24 24" class="evb-cur"><circle cx="12" cy="12" r="9" fill="url(#g-gold)" stroke="#5a3a08" stroke-width="1.2"/><path d="M9 8h6M9 12h6M9 16h6" stroke="#5a3a08" stroke-width="1.4" stroke-linecap="round"/></svg>';
  function render(justClaimed) {
    const box = el('evBody'); if (!box) return;
    box.innerHTML = '';
    box.appendChild(card('all', justClaimed === 'all'));
    box.appendChild(card('one', justClaimed === 'one'));
    box.appendChild(h('p', 'micro evb-foot', '보상은 <b>계정마다</b> 이벤트 하나에 한 번 받을 수 있습니다 — 다른 기기에서 받았어도 같은 계정이면 끝. 이 창의 ‘백룸 들어가기’로 연 백룸은 로그인한 계정과 연결되어, 그 기기에서 탈출할 때마다 계정에 기록됩니다 (연결하기 전에 그 기기에서 한 탈출도 처음 연결한 계정 한 곳에 한 번 옮겨짐). 사진·테두리·칭호는 프로필에서 바꿀 수 있습니다.'));
  }
  function card(ev, just) {
    const one = ev === 'one', st = evSt(ev), gold = one ? BR_EVENT.gold : BR_EVENT.gold12, n = n12(), s = get();
    const c = h('div', 'evb' + (one ? '' : ' evb-all') + (st === 'ready' ? ' ready' : st === 'done' ? ' done' : ''));
    const top = h('div', 'evb-art'); top.style.backgroundImage = `url(${banner(ev)})`;
    top.appendChild(h('span', 'evb-tag', one ? '콜라보 이벤트 · 다른 게임' : 'NEW · 고난도 이벤트'));
    c.appendChild(top);
    const txt = h('div', 'evb-txt');
    txt.appendChild(h('b', 'evb-title', one ? 'THE BACKROOMS 탈출 이벤트' : '백룸 완전 탈출 — 12가지 출구'));
    txt.appendChild(h('p', 'evb-desc', one
      ? '끝없는 노란 방, <b>THE BACKROOMS</b> 에서 <b>어떤 방법으로든 탈출 1회</b>에 성공하면 이 게임에서 보상을 드립니다. 엘리베이터가 아니어도 됩니다 — 탈출 방법은 12가지.'
      : 'THE BACKROOMS 를 빠져나가는 <b>12가지 방법을 모두</b> 찾아 탈출하세요. 계정에 기록된 탈출 방법이 12가지가 되면 큰 보상을 드립니다. 상당히 어렵습니다 — 백룸의 📖 탈출 도감에서 아직 못 찾은 방법의 힌트를 볼 수 있어요.'));
    if (one) {
      const p = st === 'done' ? 4 : st === 'ready' ? 3 : s.goT ? 1 : 0, steps = h('ol', 'evb-steps');
      [['백룸 들어가기', '아래 버튼으로 새 탭에서 — 이 계정과 연결됨'], ['탈출 1회', '12가지 방법 중 아무거나'], ['계정에 기록', '탈출하면 자동 · 이 창이 열려 있으면 바로'], ['보상 받기', '여기서 받기 — 계정마다 한 번']]
        .forEach(([a, b], i) => steps.appendChild(h('li', i < p ? 'on' : '', `<b>${a}</b><span>${b}</span>`)));
      txt.appendChild(steps);
    } else {
      const pg = h('div', 'evb-prog');
      pg.appendChild(h('div', 'evb-bar', `<i style="width:${(n / BR_ESCAPES.length * 100).toFixed(1)}%"></i><b>탈출 ${n} / ${BR_ESCAPES.length}</b>`));
      const g = h('div', 'evb-esc');
      BR_ESCAPES.forEach(([id, nm, lv], i) => { const ok = A.esc.has(id); g.appendChild(h('span', 'evb-e' + (ok ? ' on' : ''), `<i>No.${String(i + 1).padStart(2, '0')}</i><b>${ok ? nm : '???'}</b><small>${ok ? lv : '아직 못 찾음'}</small>`)); });
      pg.appendChild(g); txt.appendChild(pg);
    }
    const rw = h('div', 'evb-rw'); rw.appendChild(h('span', 'evb-rw-k', '보상'));
    rw.appendChild(h('span', 'evb-chip', `${GOLD_SVG}<b>${gold.toLocaleString()}</b> 골드 탄피`));
    rw.appendChild(h('span', 'evb-chip', `<span class="ttl sm ttl-${one ? 'br_escape' : 'br_all'}">${one ? BR_EVENT.title : BR_EVENT.title12}</span> 칭호`));
    rw.appendChild(h('span', 'evb-chip', `${Prof.frameHTML('none', one ? 'smiler' : 'level0', 26)} 사진 ‘${one ? '스마일러' : 'Level 0'}’`));
    rw.appendChild(h('span', 'evb-chip', `${Prof.frameHTML(one ? 'br_escape' : 'br_all', 'helmet', 26)} 테두리 ‘${one ? BR_EVENT.title : BR_EVENT.title12}’`));
    txt.appendChild(rw);
    const act = h('div', 'evb-act'), se = h('span', 'evb-st');
    const goBtn = (cls) => { const b = btn('백룸 들어가기 ↗', cls, go); if (!A.code) b.disabled = true; return b; };
    if (A.st === 'guest') { se.textContent = '로그인한 계정마다 한 번 받을 수 있습니다'; act.appendChild(btn('로그인하고 참여', 'amber', () => { close(); Cloud.open(); })); }
    else if (A.st !== 'ok' && A.st !== 'off' && A.st !== 'err') se.innerHTML = '<i class="evb-wait"></i>계정의 이벤트 기록을 불러오는 중…';
    else if (A.st === 'off') { se.textContent = '이벤트 서버 준비 중입니다 — 잠시 뒤 다시 열어 주세요'; act.appendChild(btn('다시 확인', '', () => { sync(true).then(() => render()); })); }
    else if (A.st === 'err') { se.textContent = '이벤트 기록을 불러오지 못했습니다 — ' + A.err; act.appendChild(btn('다시 시도', '', () => { sync(true).then(() => render()); })); }
    else if (st === 'done') {
      se.textContent = just ? `받았습니다 — 골드 탄피 ${gold.toLocaleString()} · 칭호·사진·테두리 (프로필에서 바꿀 수 있음)` : '이 계정은 받았습니다 — 사진·테두리·칭호는 프로필에서';
      const b = btn('받음 ✓', '', null); b.disabled = true; act.appendChild(b);
    } else if (st === 'ready') { se.textContent = one ? '탈출 확인 완료!' : '12가지 탈출 완료!'; const b = btn(busy === ev ? '받는 중…' : '보상 받기', 'amber pulse', () => claim(ev)); if (busy) b.disabled = true; act.appendChild(b); }
    else if (one) { if (s.goT) se.innerHTML = '<i class="evb-wait"></i>백룸에서 탈출을 기다리는 중…'; else se.textContent = '아직 참여하지 않았습니다'; act.appendChild(goBtn(s.goT ? '' : 'amber')); }
    else { se.textContent = n ? `${BR_ESCAPES.length - n}가지 남음` : '아직 계정에 기록된 탈출이 없습니다'; act.appendChild(btn('↻', 'ghost', () => { A.t = 0; sync(true).then(() => render()); })); act.appendChild(goBtn('amber')); }
    act.prepend(se); txt.appendChild(act);
    if (just) { const p = h('div', 'evb-pop', `+${gold.toLocaleString()}`); c.appendChild(p); setTimeout(() => p.remove(), 1600); }
    c.appendChild(txt);
    return c;
  }
  function btn(label, cls, fn) { const b = h('button', 'btn ' + cls, label); b.type = 'button'; if (fn) b.addEventListener('click', () => { try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ } fn(); }); return b; }
  // 상단 버튼의 빨간 점: 받을 보상이 있거나, 12가지 이벤트가 생긴 뒤 아직 열어 보지 않았을 때
  function dots() {
    const s = get(), ready = evSt('one') === 'ready' || evSt('all') === 'ready', d = el('evTopDot');
    if (d) d.hidden = !(ready || (!s.seen2 && evSt('all') !== 'done'));
    const b = el('evTopBtn'); if (b) b.classList.toggle('ready', ready);
  }
  function open() {
    const s = get(); if (!s.seen || !s.seen2) { s.seen = 1; s.seen2 = 1; put(s); }
    render(); el('evPanel').hidden = false; dots();
    return sync(true).then(() => { if (!el('evPanel').hidden && !busy) render(); dots(); });
  }
  function close() { el('evPanel').hidden = true; }

  // ---------- 시작 (로비 준비 때 한 번) ----------
  let pending = null;   // 경기 중에 온 알림 · 돌아오기 링크 → 로비에 들어오면 처리 ('1' = 새 방식, 그 밖 = 예전 탈출 코드)
  function init() {
    el('evTopBtn').addEventListener('click', () => { try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ } open(); });
    el('evClose').addEventListener('click', close);
    el('evPanel').addEventListener('click', (e) => { if (e.target === el('evPanel')) close(); });
    // 백룸 탭이 이 창에 바로 알림 (window.opener.postMessage): 새 방식 { m: 탈출 방법 } · 예전 방식 { code }
    window.addEventListener('message', (e) => {
      const d = e.data; if (!okOrigin(e.origin) || !d || d.type !== 'ldr-br-escape') return;
      if (d.code) { if (G.state === 'lobby') accept(String(d.code)); else pending = String(d.code); return; }
      if (G.state === 'lobby') escaped(String(d.m || '')); else pending = '1';
    });
    // 탈출 화면의 버튼으로 돌아옴: ?brx=1 (새 방식) · ?brx=코드 (예전) → 로비에서 처리하고 주소에서 지움
    try { const q = new URLSearchParams(location.search), code = q.get('brx'); if (code) { pending = code; q.delete('brx'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } } catch (e) { /* 주소 못 읽으면 건너뜀 */ }
    // 백룸 탭에서 돌아오면 기록을 다시 불러옴
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || G.state !== 'lobby' || typeof Cloud === 'undefined' || !Cloud.uid) return; A.t = 0; sync(true).then(() => { dots(); if (!el('evPanel').hidden && !busy) render(); }); });
    dots();
  }
  // 로비에 들어올 때마다: 경기 중에 온 알림 · 돌아오기 링크를 처리하고, 서버 기록을 (20초에 한 번까지) 새로
  function lobby() {
    dots();
    if (pending) { const c = pending; pending = null; if (c === '1') escaped(''); else accept(c); }
    else topUp();
    sync().then(() => { dots(); if (!el('evPanel').hidden && !busy) render(); });
  }
  return { init, lobby, open, banner, recover, prog, sync, state: () => get().st, get acct() { return A; }, _sign: sign, _accept: accept };
})();
