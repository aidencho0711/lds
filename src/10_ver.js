// ============================================================
// 10_ver.js — 게임 버전 확인 (v23)
//  · 같이 하기 버전(NET_VER · 10_net.js)이 서로 다르면 같이 하지 않는다. 할 수 있는 가장 이른 곳에서 확인:
//    로비 접속 표시(nv → 친구 목록 '버전 다름') → 파티 초대(inv nv) → 파티 참가(파티원 정보 nv — 방장이 거절하면 'ver', 파티원은 방장 버전을 보고 나감)
//    → 온라인 매칭(대기열 키에 버전 · 받은 경기 설정 cfg.v) → 경기 연결(Net.join 의 cfg.v · 방장이 받는 인사 hello 의 v) · 이어하기(저장한 경기 설정 cfg.v)
//    버전 표시가 없는 상대 = 이 확인이 생기기 전 화면(버전 2 이하)
//  · 안내: 버전이 낮은 쪽(예전 화면)에는 '게임 버전이 달라요 — 새로고침해 주세요' + 로비 새로고침 막대, 높은 쪽에는 '상대가 새로고침해야'
//    로비 채널로 온 버전 안내(초대 inv · invno 'ver')는 친구가 보낸 것만 믿는다 (10_social.js — 아무나 막대를 띄우지 못하게) · 막대는 ✕ 로 닫을 수 있다
//  · 새 배포 알림: 서버 없는 정적 페이지라 열어 둔 탭은 새 배포를 모른다 → 로비에 있을 때만 이 페이지 주소를 HEAD 로 물어,
//    ETag 가 부팅 직후 값과 달라지면 '새 버전이 나왔어요 · 새로고침' 막대 (5분마다 · 화면으로 돌아오면 · 경기를 마치고 로비로 오면 — 60초에 한 번까지)
//    ETag 는 약한 표시 W/ 를 떼고 견준다 (Vercel: 압축해 보내면 W/"…", 아니면 "…" — 같은 파일 · 중간 프록시도 붙였다 뗐다 한다)
//    ETag 가 없으면 아무것도 하지 않는다 (Last-Modified 는 Vercel 에서 캐시를 채운 시각이라 쓰지 않음) · file:// 도 · 경기 중에는 묻지 않는다(막대도 로비 안에만 있다)
//    한 번 알면 더 묻지 않고, 막대를 닫아 두었으면 경기를 마치고 로비로 올 때마다 다시 띄운다
//  · 이어하기 창(10_resume.js)이 답을 기다리는 동안은 막대를 미룬다 — 그때 새로고침하면 다시 들어갈 수 있던 경기를 놓칠 수 있다 → 답한 뒤에 띄움
// ============================================================
const Ver = (() => {
  const EVERY = 300e3, GAP = 60e3;
  let base, lastT = 0, busy = false, off = false, iv = null, want = '', found = false, held = false;
  const OLD = '게임 버전이 달라요 — 새로고침해 주세요', NEW = '새 버전이 나왔어요';
  const mineOld = (nv) => (nv || 0) > NET_VER;   // 상대(nv)가 나보다 새 버전 → 내가 새로고침해야 함
  // 상대 버전(nv · 없으면 예전 화면)과 다를 때 안내 · name: 상대(방장·파티원) 이름
  //  로비: 알림(8초) + 친구 창 안내 줄(창이 로비를 가리므로) · 내 쪽이 낮으면 새로고침 막대도(✕ 로 닫을 때까지) · 경기 중: 알림 띠(토스트)
  function tell(nv, name) {
    const old = mineOld(nv), msg = old ? OLD : `게임 버전이 달라요 — ${name ? name + '님이' : '상대가'} 새로고침해야 같이 할 수 있어요`;
    if (old) bar('old');
    if (G.state !== 'lobby') { HUD.toast(msg, 'warn'); return; }
    HUD.lobbyNote(old ? `${name ? name + '님과' : '상대와'} 게임 버전이 달라 같이 할 수 없어요` : msg, 8000); Social.msg(msg);
  }
  // 로비 막대: 'new' 새 배포 · 'old' 같이 하려던 상대보다 내 버전이 낮음 (둘 다 새로고침하면 풀린다 — 'old' 문구가 먼저) — 부를 때마다 나타나는 효과를 다시
  function bar(k) { if (k === 'old' || !want) want = k; sync(true); }
  // 막대를 보이거나 미룸 — 이어하기 창이 답을 기다리는 동안(Resume.pending)은 숨겨 두었다가 답한 뒤에 (10_resume.js 가 창을 열고 닫을 때 부름)
  //  그동안은 버전 안내 카드의 새로고침 단추도 숨긴다 (10_social.js renderInvites)
  function sync(fx) {
    const b = $('verBar'); if (!b) return;
    const h = !!Resume.pending; if (h !== held) { held = h; Social.renderInvites(); }
    if (!want || h) { b.hidden = true; return; }
    $('verTxt').textContent = want === 'old' ? OLD : NEW;
    if (fx || b.hidden) { b.hidden = true; void b.offsetWidth; b.hidden = false; }
  }
  // 이 페이지의 ETag (W/ 는 뗌) · ETag 가 없으면 null · 실패하면 undefined (15초 안에 답이 없어도 — 망이 바뀌는 휴대폰에서 걸린 채 남지 않게)
  async function tag() {
    const ac = typeof AbortController === 'function' ? new AbortController() : null, to = ac && setTimeout(() => ac.abort(), 15e3);
    try { const r = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store', signal: ac ? ac.signal : undefined }); if (!r.ok) return undefined; const e = r.headers.get('etag'); return e ? e.trim().replace(/^W\//i, '') : null; }
    catch (e) { return undefined; } finally { clearTimeout(to); }
  }
  // force: 부팅 직후 처음 값 (로비·화면·간격 조건 없이)
  async function check(force) {
    if (off || busy || (!force && (G.state !== 'lobby' || document.hidden || Date.now() - lastT < GAP))) return;
    busy = true; lastT = Date.now();
    const t = await tag(); busy = false;
    if (t === undefined) return;   // 연결 실패 → 다음 확인 때 다시
    if (t === null) { if (base === undefined) stop(); return; }   // 이 서버는 알려 주지 않음 → 그만
    if (base === undefined) { base = t; return; }
    if (t !== base) { found = true; bar('new'); stop(); }   // 한 번 알면 더 묻지 않음
  }
  function stop() { off = true; clearInterval(iv); iv = null; }
  // 경기를 마치고 로비로 (11_game.js toLobby): 새 배포를 다시 묻는다 (60초에 한 번까지) · 이미 알았으면 닫아 둔 막대도 다시
  function lobby() { if (found) bar('new'); else check(); }
  function setup() {
    $('verGo').addEventListener('click', () => location.reload());
    $('verX').addEventListener('click', () => { want = ''; $('verBar').hidden = true; });
    if (location.protocol !== 'http:' && location.protocol !== 'https:') { off = true; return; }   // file:// 등
    check(true);
    iv = setInterval(() => check(), EVERY);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }
  return { setup, tell, mineOld, check, bar, sync, lobby, get base() { return base; }, get off() { return off; }, get found() { return found; }, get want() { return want; } };
})();
