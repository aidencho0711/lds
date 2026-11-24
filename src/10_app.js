// ============================================================
// 10_app.js — 앱 설치(PWA) · 앱 아이콘 (v23)
//  · 서비스 워커(public/sw.js → dist/sw.js · 오프라인 시작) 등록: https 에서만 — 로컬 http 는 localStorage 'lastdrop.sw' 가 '1' 일 때만(시험용 · 아니면 남은 등록을 지움) · file: 은 안 함
//  · 설치: beforeinstallprompt 를 붙잡아 두고(브라우저 기본 안내는 막음) 로비 메뉴 ▾ → '앱 설치'(처음엔 빨간 점) · 소식 카드 → 설치 창 → prompt() → 결과 알림
//    아이폰·아이패드(설치 이벤트 없음): 공유 → '홈 화면에 추가' 안내 · 카카오톡 등 앱 안 브라우저: 다른 브라우저로 열기 안내 · 그 밖의 브라우저: 메뉴 안내 (PC 파이어폭스는 설치 기능이 없어 숨김)
//    설치되면(appinstalled) 알림 + 설치 메뉴를 숨김 · 설치한 앱으로 실행 중이면(display-mode fullscreen·standalone · iOS navigator.standalone) body.app + 설치 메뉴 없음
//  · 앱 아이콘(dist/icons): 로고 기호(src/index.html #ldrDefs)를 독립 SVG 로 → 캔버스 → PNG · 링크 미리보기 og.jpg 는 작전 지도 그림 + 가로 로고 + 소개 글
//    exportIcons(): 로컬 서버의 /put?p=icons/이름 으로 그림 8장 + SOURCE.txt(로고 블록 해시 — build.js 가 낡은 아이콘을 경고)를 한 번에 씀
//    로고를 바꾼 뒤: 다시 빌드 → 로컬 서버에서 게임을 열고 콘솔에 await __LD.App.exportIcons() → dist/icons 커밋 (그림·해시 모두 그때 받은 페이지의 로고 블록에서)
// ============================================================
const App = (() => {
  const el = (id) => document.getElementById(id);
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i, UA = navigator.userAgent || '';
  // 아이패드는 Mac 이라고 알리므로 터치 지점 수로 가림
  const IOS = /iP(hone|od|ad)/.test(UA) || (/Macintosh/.test(UA) && (navigator.maxTouchPoints || 0) > 1);
  // 앱 안 브라우저(카카오톡·네이버·인스타그램·페이스북·라인·다음·에브리타임·밴드) — 설치할 수 없다
  const INAPP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|\bLine\/|DaumApps|everytimeApp|BAND\//i.test(UA);
  const BR = /SamsungBrowser/.test(UA) ? 'samsung' : /Firefox\//.test(UA) ? 'firefox' : /Safari\//.test(UA) && !/Chrome|Chromium|CriOS|Edg/.test(UA) ? 'safari' : 'chrome';
  let bip = null, ready = false, isApp = false, reg = null, swErr = '', outcome = '', newsOn = false, banner = null, watchT = null;
  const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  // 설치한 앱으로 실행 중인가 — 게임이 누를 때마다 요청하는 전체 화면(Fullscreen API)으로 fullscreen 이 맞는 경우는 빼려고 fullscreenElement 를 함께 봄
  const standalone = () => navigator.standalone === true || mq('(display-mode: standalone)') || mq('(display-mode: minimal-ui)') || mq('(display-mode: window-controls-overlay)') || (mq('(display-mode: fullscreen)') && !document.fullscreenElement && !document.webkitFullscreenElement);
  // 처음 열릴 때(누르기 전 — 아직 Fullscreen API 전) 이미 설치한 앱이었는가: standalone 으로 뜬 앱 안에서 게임이 전체 화면을 켜면 display-mode 가 fullscreen 이 되어 standalone() 이 false 로 바뀌므로 처음 판정을 기억
  //  (PC 에서 F11 전체 화면으로 연 경우도 그 접속 동안은 앱으로 봄 — 설치 메뉴가 숨을 뿐)
  const LAUNCH = standalone();
  // 설치할 수 있는 곳: https · 로컬 개발 주소 (file:·일반 http 는 브라우저가 설치를 막음)
  const secure = () => location.protocol === 'https:' || (location.protocol === 'http:' && LOCAL.test(location.hostname));
  // 이 페이지로 설치할 수 있는가: 맨 위 창(다른 페이지에 끼워 넣은 iframe 이 아님) + manifest 링크 (dist/last-drop.html 은 head.html 이 없어 manifest 가 없다)
  const TOP = (() => { try { return window.top === window; } catch (e) { return false; } })();
  const installable = () => TOP && secure() && !!document.querySelector('link[rel="manifest"]');
  const mode = () => (isApp ? 'app' : bip ? 'prompt' : INAPP ? 'inapp' : IOS ? 'ios' : 'generic');
  // 메뉴의 '앱 설치': 설치 이벤트가 왔으면 언제나 · 이 브라우저에서 이미 설치했거나(appinstalled) PC 파이어폭스면 숨김
  const canShow = () => ready && !isApp && installable() && (!!bip || (!store.get('appInst', 0) && !(BR === 'firefox' && !/Android/.test(UA))));
  // 빨간 점·소식 카드는 확실히 설치할 수 있을 때만(설치 이벤트 · 아이폰·아이패드) — 점은 설치 창을 한 번 열면 사라짐
  const sure = () => canShow() && (!!bip || (IOS && !INAPP));
  const dotOn = () => sure() && !store.get('appSeen', 0);

  // ---------- 설치 메뉴 · 점 · 소식 카드 ----------
  const CARD = { tag: '앱 설치', title: '홈 화면에 설치하면 앱처럼 — 전체 화면 · 바로 실행 · 오프라인 시작 (눌러서 설치)', img: () => banner, act: () => open() };
  function render() {
    if (!ready) return;
    isApp = LAUNCH || standalone(); document.body.classList.toggle('app', isApp);
    const b = el('appBtn'); if (b) b.hidden = !canShow();
    const d = dotOn(); for (const id of ['appDot', 'appMoreDot']) { const x = el(id); if (x) x.hidden = !d; }
    news(sure());
    if (!el('appPanel').hidden) { if (isApp) close(); else fill(); }
  }
  function news(on) {
    if (on === newsOn) return; newsOn = on;
    try { HUD.news(CARD, on); } catch (e) { /* 소식 카드 없이도 */ }
    if (on && !banner) bannerArt().then((u) => { banner = u; if (newsOn) HUD.news(CARD, true); }).catch((e) => console.warn('앱 설치 소식 그림:', e));
  }
  function note(t) { try { if (G.state === 'lobby') HUD.lobbyNote(t, 8000); else HUD.toast(t); } catch (e) { /* 알림 없이도 */ } }
  function msg(t) { const m = el('appMsg'); if (!m) return; m.textContent = t; m.hidden = !t; }

  // ---------- 설치 창 ----------
  const SVGI = (d, extra) => `<svg viewBox="0 0 24 24" aria-hidden="true"${extra || ''}>${d}</svg>`;
  const ICO = {
    full: SVGI('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    bolt: SVGI('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>'),
    off: SVGI('<path d="M2.5 8.8a14 14 0 0 1 19 0M5.6 12.2a9.5 9.5 0 0 1 12.8 0M8.8 15.6a5 5 0 0 1 6.4 0M4 3.5l16 17"/><circle cx="12" cy="19" r="1"/>'),
    upd: SVGI('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5V7H14M6.5 20.5V17H10"/>'),
    dl: SVGI('<path d="M12 4v10M8 10.5l4 4 4-4M5 19.5h14"/>'),
    // 아이폰 공유 버튼 (네모에서 위로 나가는 화살표) · 홈 화면에 추가 (네모 안 +)
    share: SVGI('<path d="M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17 9.5h-1.5"/><path d="M12 14V3.5M8.6 6.9 12 3.5l3.4 3.4"/>'),
    add: SVGI('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>'),
    kebab: SVGI('<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>', ' class="fill"'),
    web: SVGI('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  };
  const PERKS = `<ul class="app-perks"><li>${ICO.full}<b>전체 화면</b><span>주소창·탭 없이 게임 화면만</span></li><li>${ICO.bolt}<b>바로 실행</b><span>홈 화면·앱 목록의 아이콘으로 한 번에</span></li><li>${ICO.off}<b>오프라인 시작</b><span>한 번 받은 뒤엔 인터넷이 끊겨도 혼자 하는 경기·훈련장</span></li><li>${ICO.upd}<b>자동 업데이트</b><span>새 버전은 다음 실행 때 저절로</span></li></ul>`;
  const IOS_HTML = `<ol class="app-steps"><li><i class="app-key">${ICO.share}</i><span><b>공유 버튼</b>을 누르세요<small>Safari 주소창 옆 또는 화면 아래 · 안 보이면 ⋯ 메뉴 안</small></span></li><li><i class="app-key">${ICO.add}</i><span><b>홈 화면에 추가</b>를 고르세요<small>목록을 아래로 내리면 있어요</small></span></li><li><i class="app-key">추가</i><span>오른쪽 위 <b>추가</b>를 누르면 끝<small>홈 화면의 Last Drop 아이콘으로 전체 화면 실행</small></span></li></ol>`;
  // 아이폰·아이패드: 홈 화면 앱은 Safari 와 저장 공간(기록·로그인)이 따로라 처음엔 로그아웃 상태 — 게스트는 가입해 두면 지금 기록이 계정으로 옮겨진다 (10_cloud.js afterLogin)
  const acct = () => { try { return !Cloud.enabled ? 'off' : Cloud.uid ? 'in' : 'guest'; } catch (e) { return 'off'; } };
  const iosNote = () => `<p class="app-note">${{ guest: '홈 화면 앱은 Safari 와 기록이 따로예요 — <b>가입</b>해 두면 지금 기록이 계정으로 옮겨지고, 앱에서 로그인하면 이어져요.', in: '홈 화면 앱은 Safari 와 기록이 따로라 로그아웃 상태로 열려요 — 앱에서 같은 아이디로 로그인하면 이어져요.', off: '홈 화면 앱은 Safari 와 기록이 따로라 지금까지의 기록·설정은 넘어가지 않아요.' }[acct()]}</p>`;
  const INAPP_HTML = `<p class="app-lead">카카오톡·인스타그램 같은 앱 안의 브라우저에서는 설치할 수 없어요.</p><ol class="app-steps"><li><i class="app-key">${ICO.kebab}</i><span>오른쪽 위(또는 아래) 메뉴에서 <b>다른 브라우저로 열기</b></span></li><li><i class="app-key">${ICO.web}</i><span>열린 Chrome·Safari 에서 메뉴 ▾ → <b>앱 설치</b></span></li></ol>`;
  const GUIDE = [
    ['chrome', 'Chrome · Edge · 웨일', '주소창 오른쪽의 설치 아이콘 — 또는 메뉴(⋮ · …)에서 <em>앱 설치</em> · <em>홈 화면에 추가</em>'],
    ['samsung', '삼성 인터넷', '메뉴(≡) → <em>현재 페이지 추가</em> → <em>홈 화면</em>'],
    ['safari', 'Safari (Mac)', '메뉴 막대의 파일 → <em>Dock에 추가</em>'],
    ['firefox', 'Firefox (Android)', '메뉴(⋮) → <em>설치</em>'],
  ];
  // 지금 브라우저 줄을 맨 위에 강조 (나머지는 한 줄씩 — 휴대폰 가로 화면에도 들어가게) · 방금 설치 창을 닫았으면(이벤트는 접속마다 한 번) 그렇다고
  const genericHTML = () => `<p class="app-lead">${outcome === 'dismissed' ? '설치 창은 접속할 때마다 한 번만 띄울 수 있어요 — 브라우저 메뉴에서 설치하세요.' : '지금은 설치 창을 바로 띄울 수 없어요 — 브라우저 메뉴에서 설치하세요.'}</p><ul class="app-brs">${GUIDE.slice().sort((a, b) => (b[0] === BR) - (a[0] === BR)).map((r) => `<li class="${r[0] === BR ? 'on' : ''}"><b>${r[1]}</b> <span>${r[2]}</span></li>`).join('')}</ul>`;
  function fill() {
    const m = mode(), art = el('appArt'), login = m === 'ios' && acct() === 'guest';
    // 휴대폰 그림 + 아래 단계 표시(그림의 6초 장면과 함께 차례로 켜짐)
    if (!art.firstChild) art.innerHTML = `<svg class="apx" viewBox="0 0 320 180" aria-hidden="true">${phone()}</svg><div class="apx-steps"><span>아이콘 누르기</span><i></i><span>바로 실행</span><i></i><span>전체 화면</span></div>`;
    el('appTitle').textContent = m === 'ios' ? '홈 화면에 추가하기' : m === 'inapp' ? '다른 브라우저에서 설치하기' : '앱으로 설치하기';
    el('appBody').innerHTML = m === 'ios' ? IOS_HTML + iosNote() : m === 'inapp' ? INAPP_HTML : m === 'generic' ? genericHTML() : PERKS;
    el('appBtns').innerHTML = m === 'prompt' ? `<button class="btn amber" type="button" id="appGo">${ICO.dl}<span>설치하기</span></button><button class="btn" type="button" id="appLater">나중에</button>` : `${m === 'inapp' ? '<button class="btn" type="button" id="appCopy">주소 복사</button>' : ''}${login ? '<button class="btn" type="button" id="appLogin">가입 · 로그인</button>' : ''}<button class="btn amber" type="button" id="appLater">확인</button>`;
    const go = el('appGo'), cp = el('appCopy'), lg = el('appLogin');
    el('appLater').onclick = close; if (go) go.onclick = install; if (cp) cp.onclick = copy;
    if (lg) lg.onclick = () => { close(); try { Cloud.open(); } catch (e) { /* 로그인 창 없이도 */ } };
  }
  function open() {
    if (!ready) return;
    try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ }
    // 창을 보인 뒤 render 가 내용을 채움 (설치한 앱으로 실행 중이면 바로 닫음)
    store.set('appSeen', 1); msg(''); el('appPanel').hidden = false; render();
    // 열어 둔 채 경기가 시작되면(파티 방장 출격 등) 닫는다
    clearInterval(watchT); watchT = setInterval(() => { if (G.state !== 'lobby') close(); }, 500);
  }
  function close() { const p = el('appPanel'); if (p) p.hidden = true; clearInterval(watchT); watchT = null; }
  // 설치하기 → 브라우저 설치 창 (누른 순간에 불러야 함 · 이벤트는 한 번만 씀 — 두 번 눌러도 한 번만) → 결과를 알림
  //  (설치 창 안을 누를 때는 10_touch.js 가 전체 화면을 요청하지 않는다 — #appPanel data-nofs · 그 요청이 이 누름의 사용자 활성화를 써 버리면 prompt() 가 거절됨)
  async function install() {
    const ev = bip; if (!ev) { fill(); return; }
    bip = null; let r = '';
    try { const p = await ev.prompt(); const c = p && p.outcome ? p : await ev.userChoice; r = (c && c.outcome) || ''; }
    catch (e) {
      // 누른 동작 없이 불림(NotAllowedError) — 이벤트는 쓰이지 않았으니 그대로 두고 한 번 더 누르게
      if (e && e.name === 'NotAllowedError') { bip = ev; msg('한 번 더 눌러 주세요 — 설치 창은 이 단추를 직접 누를 때만 열려요'); return; }
      r = 'error';
    }
    outcome = r; close();
    if (r === 'accepted') { store.set('appInst', Date.now()); note('설치를 시작했어요 — 잠시 뒤 홈 화면(앱 목록)에 Last Drop 아이콘이 생겨요'); }
    else if (r === 'dismissed') note('설치를 취소했어요 — 나중에 브라우저 메뉴(⋮)의 「앱 설치」로 설치하거나, 다시 접속한 뒤 메뉴 ▾ → 앱 설치');
    else note('설치 창을 열지 못했어요 — 브라우저 메뉴에서 「앱 설치」를 골라 주세요');
    render();
  }
  function copy() {
    const u = location.origin + location.pathname, no = () => msg('복사하지 못했어요 — 주소: ' + u);
    try { navigator.clipboard.writeText(u).then(() => msg('주소를 복사했어요 — Chrome·Safari 주소창에 붙여 넣으세요'), no); } catch (e) { no(); }
  }

  // ---------- 서비스 워커 ----------
  //  https 에서만 · 로컬 http 는 시험용 표시가 있을 때만 (없으면 남아 있던 등록을 지움 — 다른 시험이 저장본을 보지 않게)
  //  manifest 가 있는 맨 위 창에서만 (last-drop.html · iframe 은 sw.js 도 없고 설치도 안 됨 · 샌드박스 iframe 은 serviceWorker 를 읽기만 해도 오류)
  function sw() {
    if (!installable()) return;
    let S = null; try { S = navigator.serviceWorker; } catch (e) { /* 쓸 수 없는 곳 */ } if (!S) return;
    if (location.protocol === 'http:') {
      let on = false; try { on = localStorage.getItem('lastdrop.sw') === '1'; } catch (e) { /* 저장소를 못 쓰면 끔 */ }
      if (!on) { S.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {}); return; }
    }
    S.register('sw.js', { scope: './' }).then((r) => { reg = r; }).catch((e) => { swErr = String((e && e.message) || e); console.warn('서비스 워커 등록 실패:', e); });
  }

  function setup() {
    if (!el('appPanel') || !el('appBtn')) return;
    ready = true;
    el('appBtn').addEventListener('click', open);
    el('appClose').addEventListener('click', close);
    el('appPanel').addEventListener('click', (e) => { if (e.target === el('appPanel')) close(); });
    document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !el('appPanel').hidden) { e.stopPropagation(); close(); } }, true);
    // 설치한 앱 창으로 옮겨지거나(PC Chrome 은 설치하면 이 탭을 앱 창으로 옮김) 전체 화면이 바뀔 때 다시 판정
    for (const q of ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)']) { try { const m = matchMedia(q); if (m.addEventListener) m.addEventListener('change', () => render()); else if (m.addListener) m.addListener(() => render()); } catch (e) { /* 지원 안 함 */ } }
    render();
    // 오프라인 시작(서비스 워커가 저장본으로 띄움 — 받은 바이트 0)이면 저장본의 ETag 를 새 배포 확인의 기준으로 (10_ver.js Ver.seed)
    try {
      const nv = performance.getEntriesByType('navigation')[0], S = navigator.serviceWorker;
      if (S && S.controller && nv && nv.transferSize === 0 && window.caches) caches.match(new URL('./', location.href).href, { ignoreVary: true }).then((r) => { const t = r && r.headers.get('etag'); if (t) Ver.seed(t); }).catch(() => {});
    } catch (e) { /* 확인 없이도 */ }
    const later = () => setTimeout(sw, 1500);   // 게임을 다 받은 뒤에 (저장할 것을 받느라 첫 화면이 늦어지지 않게)
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
  }
  // 브라우저가 '설치할 수 있음'을 알림 — 기본 안내(작은 띠)를 막고 붙잡아 둠 (설치 창은 사용자가 누를 때만)
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); bip = e; render(); });
  window.addEventListener('appinstalled', () => { bip = null; store.set('appInst', Date.now()); if (!ready) return; close(); note('앱이 설치되었어요 — 이제 홈 화면의 Last Drop 아이콘으로 바로 실행하세요'); render(); });

  // ---------- 그림: 가로 휴대폰 (설치 창 · 소식 카드) ----------
  //  320×180 — 홈 화면 앱 칸 14개 + 가운데 게임 아이콘 → (설치 창에서만 style.css .apx-* 애니메이션) 누름 → 둥글게 퍼지며 실행 → 전체 화면 게임
  //  실행·게임 장면은 opacity 0 이 기본이라 독립 SVG(소식 카드 그림)로 그리면 첫 장면(홈 화면)만 · XML 로도 맞게 씀
  function phone() {
    const HUE = [200, 28, 150, 265, 95, 340, 48, 182, 12, 120, 300, 70, 225, 160]; let tiles = '', n = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      if (r === 1 && c === 2) continue;
      const x = 46 + c * 50, y = 26 + r * 50;
      tiles += `<rect x="${x}" y="${y}" width="28" height="28" rx="8" fill="hsl(${HUE[n++]},24%,31%)"/><rect x="${x + 6}" y="${y + 32}" width="16" height="2.6" rx="1.3" fill="#7c8582" opacity="0.55"/>`;
    }
    const KR = 'IBM Plex Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif';
    return '<defs><clipPath id="apxScr"><rect x="20" y="12" width="280" height="156" rx="12"/></clipPath>'
      + '<linearGradient id="apxWall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e2e31"/><stop offset="1" stop-color="#0b1214"/></linearGradient>'
      + '<linearGradient id="apxSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26404c"/><stop offset="1" stop-color="#4d6670"/></linearGradient>'
      + '<radialGradient id="apxGlow"><stop offset="0" stop-color="#f0a43a" stop-opacity="0.6"/><stop offset="1" stop-color="#f0a43a" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="apxGlare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>'
      + '<rect x="3" y="3" width="314" height="174" rx="27" fill="#161c1e" stroke="#46514f" stroke-width="2"/><rect x="8.5" y="80" width="3" height="20" rx="1.5" fill="#2c3436"/>'
      + `<g clip-path="url(#apxScr)"><rect x="20" y="12" width="280" height="156" fill="url(#apxWall)"/>${tiles}`
      // 상태 막대 (시각 · 신호 · 배터리)
      + `<text x="30" y="21.5" font-size="7" font-weight="700" fill="#e9e2cf" fill-opacity="0.8" font-family="${KR}">9:41</text><path d="M268 21.5v-1.6M270.6 21.5v-3M273.2 21.5v-4.4" stroke="#e9e2cf" stroke-opacity="0.8" stroke-width="1.4" stroke-linecap="round"/><rect x="277.5" y="16" width="13" height="6" rx="1.6" fill="none" stroke="#e9e2cf" stroke-opacity="0.75" stroke-width="0.9"/><rect x="279" y="17.5" width="8" height="3" rx="0.6" fill="#86c56c"/>`
      + '<g class="apx-icon"><circle cx="160" cy="90" r="30" fill="url(#apxGlow)"/><use href="#ldr-icon" x="144" y="74" width="32" height="32"/></g>'
      + `<text x="160" y="115" text-anchor="middle" font-size="7.5" font-weight="700" fill="#e9e2cf" font-family="${KR}">Last Drop</text>`
      + '<circle class="apx-tap" cx="160" cy="90" r="18" fill="none" stroke="#fff3d6" stroke-width="2" opacity="0"/>'
      + '<g class="apx-launch" opacity="0"><circle class="apx-wipe" cx="160" cy="90" r="166" fill="#0d1113"/><g class="apx-splash"><use href="#ldr-emblem" x="138" y="58" width="44" height="44"/>'
      + '<text x="160" y="118" text-anchor="middle" font-size="10" font-weight="800" letter-spacing="2" fill="#e9e2cf" font-family="Saira Condensed, Arial Narrow, Arial, sans-serif">LAST DROP</text></g></g>'
      + '<g class="apx-game" opacity="0"><rect x="20" y="12" width="280" height="156" fill="url(#apxSky)"/>'
      + '<g class="apx-zone"><circle cx="160" cy="262" r="196" fill="none" stroke="#5aa2ff" stroke-width="12" opacity="0.18"/><circle cx="160" cy="262" r="196" fill="none" stroke="#5aa2ff" stroke-width="2.6"/></g>'
      + '<path d="M20 104l26-9 22 6 30-12 24 8 28-10 30 9 26-7 34 8 40-6v79H20z" fill="#2f3d2b"/><path d="M20 124l44-5 40 7 52-8 50 6 50-6 44 5v45H20z" fill="#212b1d"/>'
      + '<g fill="#0f1517"><circle cx="160" cy="121" r="7.5"/><path d="M146 168c0-22 4-36 14-38s14 16 14 38z"/></g><path d="M168 139l23-9" stroke="#0a0f11" stroke-width="3.4" stroke-linecap="round"/>'
      + '<path d="M160 74v4M160 86v4M152 82h4M164 82h4" stroke="#f3ead2" stroke-width="1.4" stroke-linecap="round"/>'
      + '<rect x="262" y="18" width="32" height="32" rx="3" fill="#0d1113" fill-opacity="0.75" stroke="#e9e2cf" stroke-opacity="0.25"/><circle cx="276" cy="36" r="11" fill="none" stroke="#5aa2ff" stroke-width="1.4"/><circle cx="279" cy="33" r="5" fill="none" stroke="#ffffff" stroke-width="1"/><path d="M276 33.5l2.4 5h-4.8z" fill="#f0a43a"/>'
      + `<rect x="26" y="18" width="36" height="12" rx="2" fill="#0d1113" fill-opacity="0.7"/><text x="44" y="27" text-anchor="middle" font-size="7.5" font-weight="700" fill="#e9e2cf" font-family="${KR}">생존 25</text>`
      + '<rect x="122" y="158" width="76" height="4" rx="2" fill="#0d1113" fill-opacity="0.7"/><rect x="122" y="158" width="58" height="4" rx="2" fill="#e9e2cf"/>'
      + '<circle cx="52" cy="138" r="15" fill="none" stroke="#e9e2cf" stroke-opacity="0.35" stroke-width="1.5"/><circle cx="56" cy="135" r="6" fill="#e9e2cf" fill-opacity="0.3"/><circle cx="270" cy="134" r="13" fill="none" stroke="#e5484d" stroke-opacity="0.85" stroke-width="1.6"/></g></g>'
      + '<path d="M20 12h96L58 168H20z" fill="url(#apxGlare)" clip-path="url(#apxScr)"/>';
  }

  // ---------- 그림: 앱 아이콘 · 링크 미리보기(og) · 소식 카드 — 로고 기호에서 코드로 ----------
  const NS = 'http://www.w3.org/2000/svg';
  const VB = { 'ldr-emblem': [512, 512], 'ldr-logo-h': [1200, 300], 'ldr-logo-v': [800, 640], 'ldr-icon': [512, 512], 'ldr-icon-mask': [512, 512], 'ldr-icon-micro': [512, 512] };
  const KRF = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', SAIRA = '"Saira Condensed", "Arial Narrow", Arial, sans-serif';
  // 그릴 로고 블록: 보통은 이 페이지의 #ldrDefs · 내보내기(exportIcons) 동안만 방금 받은 페이지의 블록 (SOURCE.txt 해시와 같은 글에서 그림)
  let defsSrc = null;
  // #ldrDefs 의 defs·symbol 을 통째로 XML 로 (그라데이션·다른 기호를 가리켜도 그대로 · 주석은 뺌)
  function defsXML() { const d = defsSrc || el('ldrDefs'), X = new XMLSerializer(); let s = ''; if (d) for (const n of d.childNodes) if (n.nodeType === 1) s += X.serializeToString(n); return s; }
  // 로고 기호 하나를 w×h 독립 SVG 글로 · k: 가운데를 k 배로 (viewBox 를 가운데 1/k 칸으로 — 벡터 그대로라 선명)
  function svgOf(sym, w, h, k) { const v = VB[sym] || [512, 512], z = k || 1, f = (x) => +x.toFixed(3), a = f(v[0] / z), b = f(v[1] / z); return `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="${f((v[0] - a) / 2)} ${f((v[1] - b) / 2)} ${a} ${b}">${defsXML()}<use href="#${sym}" width="${v[0]}" height="${v[1]}"/></svg>`; }
  const pic = (svg) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('SVG 그림을 읽지 못함')); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // 기호를 s×s 캔버스로 · bg: 먼저 칠할 바탕 (마스커블·애플 터치 아이콘은 불투명이어야 함) · k: 가운데 확대
  async function iconCanvas(sym, s, bg, k) { const c = canvas(s, s), g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, s, s); } g.drawImage(await pic(svgOf(sym, s, s, k)), 0, 0, s, s); return c; }
  // dist/icons 파일 [이름, 기호, 크기, 바탕, 확대] — any 아이콘·파비콘은 모서리 투명(ldr-icon) · 마스커블은 꽉 찬 불투명(ldr-icon-mask, 그림은 가운데 지름 80% 원 안)
  //  파비콘(16·32px)은 로고의 단순판 ldr-icon-micro (캐노피 · 굵은 자기장 고리 · 강하 표식만 — 작게 줄여도 뭉개지지 않게)
  //  애플 터치 아이콘: iOS 는 모서리만 둥글게 자르므로 마스커블 그림을 1.25배 — 안전 원(지름 80%)이 칸에 꼭 맞아 그림은 잘리지 않고 덜 작아 보임
  const ICONS = [['icon-192.png', 'ldr-icon', 192], ['icon-512.png', 'ldr-icon', 512], ['maskable-192.png', 'ldr-icon-mask', 192, '#0d1113'], ['maskable-512.png', 'ldr-icon-mask', 512, '#0d1113'], ['apple-touch-icon.png', 'ldr-icon-mask', 180, '#0d1113', 1.25], ['favicon-32.png', 'ldr-icon-micro', 32], ['favicon-16.png', 'ldr-icon-micro', 16]];
  // 아이콘 7장(PNG) + og.jpg → { 이름: data URL } · og 는 불투명 그림이라 JPEG (PNG 는 1MB 남짓 — 메신저가 미리보기를 건너뛸 수 있음)
  async function icons(anyFont) { const o = {}; for (const [n, sym, s, bg, k] of ICONS) o[n] = (await iconCanvas(sym, s, bg, k)).toDataURL('image/png'); o['og.jpg'] = (await og(anyFont)).toDataURL('image/jpeg', 0.86); return o; }
  // 캔버스 글자용 웹 글꼴(한글은 필요한 글자 묶음만 받음)을 받고 → 받지 못한 글꼴 목록 (10초가 넘으면 모두 못 받은 것으로)
  async function fonts(texts) {
    const all = texts.map((t) => t[0]); if (!document.fonts || !document.fonts.load) return all;
    const L = (f, t) => document.fonts.load(f, t).then((a) => (a && a.length ? '' : f), () => f);
    return (await Promise.race([Promise.all(texts.map((t) => L(t[0], t[1]))), new Promise((r) => setTimeout(() => r(all), 10000))])).filter(Boolean);
  }
  // 값 잡음(시드 고정 — 다시 만들어도 같은 그림) → 등고선 (마칭 스퀘어 · 4번째 선마다 굵게)
  function contours(g, W, H, seed, s) {
    const cs = Math.max(6, Math.round(10 * s)), nx = Math.ceil(W / cs) + 1, ny = Math.ceil(H / cs) + 1, f = new Float32Array(nx * ny), sc = 1 / (240 * s);
    const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    let lo = 1e9, hi = -1e9;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let v = 0, a = 0.55, q = 1; for (let k = 0; k < 4; k++) { v += a * vn(i * cs * sc * q + k * 17.3, j * cs * sc * q - k * 9.1); a *= 0.5; q *= 2.03; }
      f[j * nx + i] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    const N = 18, minor = new Path2D(), major = new Path2D();
    for (let L = 1; L < N; L++) {
      const t = lo + (hi - lo) * L / N, P = L % 4 === 0 ? major : minor;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = f[j * nx + i], b = f[j * nx + i + 1], c = f[(j + 1) * nx + i + 1], d = f[(j + 1) * nx + i];
        const k = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0); if (k === 0 || k === 15) continue;
        // 칸의 네 변 위 교점: 위(a→b) · 오른쪽(b→c) · 아래(d→c) · 왼쪽(a→d)
        const x0 = i * cs, y0 = j * cs, T = () => [x0 + cs * (t - a) / (b - a), y0], R = () => [x0 + cs, y0 + cs * (t - b) / (c - b)], B = () => [x0 + cs * (t - d) / (c - d), y0 + cs], Lf = () => [x0, y0 + cs * (t - a) / (d - a)];
        const seg = (p, q) => { P.moveTo(p[0], p[1]); P.lineTo(q[0], q[1]); };
        switch (k) {
          case 1: case 14: seg(Lf(), B()); break; case 2: case 13: seg(B(), R()); break; case 3: case 12: seg(Lf(), R()); break; case 4: case 11: seg(T(), R()); break;
          case 6: case 9: seg(T(), B()); break; case 7: case 8: seg(Lf(), T()); break; case 5: seg(Lf(), T()); seg(B(), R()); break; case 10: seg(T(), R()); seg(Lf(), B()); break;
        }
      }
    }
    g.save(); g.strokeStyle = 'rgba(214, 206, 178, 0.075)'; g.lineWidth = Math.max(0.8, s); g.stroke(minor); g.strokeStyle = 'rgba(214, 206, 178, 0.17)'; g.lineWidth = Math.max(1, 1.5 * s); g.stroke(major); g.restore();
  }
  // 위에서 본 수송기 (머리가 +x)
  function plane(g, x, y, ang, k) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(k, k); g.fillStyle = 'rgba(233, 226, 207, 0.94)'; g.shadowColor = 'rgba(0, 0, 0, 0.6)'; g.shadowBlur = 8 * k;
    g.beginPath(); g.moveTo(14, 0); g.quadraticCurveTo(13, -1.7, 9, -1.8); g.lineTo(2.5, -1.8); g.lineTo(-1, -13); g.lineTo(-4, -13); g.lineTo(-3.2, -1.8); g.lineTo(-10, -1.6); g.lineTo(-13, -5.5); g.lineTo(-15, -5.5); g.lineTo(-14, 0);
    g.lineTo(-15, 5.5); g.lineTo(-13, 5.5); g.lineTo(-10, 1.6); g.lineTo(-3.2, 1.8); g.lineTo(-4, 13); g.lineTo(-1, 13); g.lineTo(2.5, 1.8); g.lineTo(9, 1.8); g.quadraticCurveTo(13, 1.7, 14, 0); g.closePath(); g.fill(); g.restore();
  }
  // 강하 표식: 끝이 (x,y) 에 닿는 물방울 핀 + 퍼지는 고리
  function pin(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (const [r, al] of [[50, 0.22], [33, 0.4]]) { g.strokeStyle = `rgba(240, 164, 58, ${al})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    const gr = g.createLinearGradient(0, -42, 0, 0); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(1, '#d9821c');
    g.shadowColor = 'rgba(240, 164, 58, 0.85)'; g.shadowBlur = 18; g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-5, -9, -14, -16, -14, -27); g.arc(0, -27, 14, Math.PI, 0); g.bezierCurveTo(14, -16, 5, -9, 0, 0); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#241504'; g.beginPath(); g.arc(0, -27, 5.5, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // 작전 지도 바탕 (og · 소식 카드): 어두운 바탕 + 등고선 + 격자 + 자기장(파란 원 · 흰 점선 다음 원) + 수송기 항로 + 강하 표식 + 비네트 + 모서리 괄호
  function keyArt(g, W, H, o) {
    const s = W / 1200, zx = o.zx, zy = o.zy, zr = o.zr, TAU = Math.PI * 2;
    let gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0c1214'); gr.addColorStop(0.55, '#121c1d'); gr.addColorStop(1, '#090d0f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(zx, zy, 0, zx, zy, zr * 1.7); gr.addColorStop(0, 'rgba(70, 104, 92, 0.38)'); gr.addColorStop(1, 'rgba(70, 104, 92, 0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    contours(g, W, H, o.seed, s);
    g.save(); g.strokeStyle = 'rgba(233, 226, 207, 0.05)'; g.lineWidth = 1; g.beginPath();
    for (let x = 100 * s; x < W; x += 100 * s) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, H); }
    for (let y = 100 * s; y < H; y += 100 * s) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(W, Math.round(y) + 0.5); }
    g.stroke(); g.restore();
    // 자기장 밖은 푸른 기운 · 테두리는 빛 번짐
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.arc(zx, zy, zr, 0, TAU, true); g.fillStyle = 'rgba(46, 116, 255, 0.12)'; g.fill('evenodd'); g.restore();
    g.save(); g.shadowColor = 'rgba(90, 162, 255, 0.95)'; g.shadowBlur = 20 * s; g.strokeStyle = '#5aa2ff'; g.lineWidth = 3.4 * s; g.beginPath(); g.arc(zx, zy, zr, 0, TAU); g.stroke(); g.restore();
    const nx = zx + zr * 0.2, ny = zy + zr * 0.14, nr = zr * 0.42;
    g.save(); g.setLineDash([12 * s, 8 * s]); g.strokeStyle = 'rgba(245, 245, 240, 0.9)'; g.lineWidth = 2.2 * s; g.beginPath(); g.arc(nx, ny, nr, 0, TAU); g.stroke(); g.restore();
    // 항로 (점선) + 수송기
    const ax = zx - zr * 1.9, ay = zy - zr * 1.8, bx = zx + zr * 1.5, by = zy + zr * 0.95;
    g.save(); g.setLineDash([16 * s, 10 * s]); g.strokeStyle = 'rgba(240, 164, 58, 0.7)'; g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.restore();
    const pt = o.pt || 0.36; plane(g, ax + (bx - ax) * pt, ay + (by - ay) * pt, Math.atan2(by - ay, bx - ax), 1.5 * s);
    pin(g, nx, ny, s);
    gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.6); gr.addColorStop(0, 'rgba(0, 0, 0, 0)'); gr.addColorStop(1, 'rgba(0, 0, 0, 0.58)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.strokeStyle = 'rgba(240, 164, 58, 0.7)'; g.lineWidth = 2 * s; g.beginPath(); const m = 22 * s, L = 34 * s;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); }
    g.stroke(); g.restore();
  }
  // 링크 미리보기 1200×630: 작전 지도 + 가로 로고 + 한 줄 소개 (로고가 바뀌어도 같은 자리 — 가로형 4:1)
  //  글꼴(IBM Plex Sans KR · Saira Condensed)을 받지 못하면 멈춤 — 다른 글꼴로 그린 그림이 조용히 저장되지 않게 (anyFont 면 그래도 그림)
  async function og(anyFont) {
    const W = 1200, H = 630, c = canvas(W, H), g = c.getContext('2d'), T1 = '마지막 한 명이 될 때까지', T2 = '브라우저에서 바로 즐기는 배틀로얄 — 강하 · 파밍 · 자기장', T3 = 'PC · MOBILE · FREE TO PLAY';
    const miss = await fonts([[`600 46px "IBM Plex Sans KR"`, T1], [`500 25px "IBM Plex Sans KR"`, T2], [`700 19px "Saira Condensed"`, T3]]);
    if (miss.length && !anyFont) throw new Error('링크 미리보기 글꼴을 받지 못함 (' + miss.join(' · ') + ') — 인터넷 연결을 확인하고 다시 (그래도 그리려면 exportIcons({ anyFont: true }))');
    keyArt(g, W, H, { zx: 905, zy: 300, zr: 236, seed: 7 });
    // 왼쪽 글자 자리를 어둡게 (로고·글이 잘 읽히게)
    const gr = g.createLinearGradient(0, 0, W * 0.64, 0); gr.addColorStop(0, 'rgba(8, 12, 14, 0.9)'); gr.addColorStop(0.6, 'rgba(8, 12, 14, 0.55)'); gr.addColorStop(1, 'rgba(8, 12, 14, 0)'); g.fillStyle = gr; g.fillRect(0, 0, W * 0.64, H);
    const lx = 74, ly = 132, lw = 600, lh = 150;
    g.drawImage(await pic(svgOf('ldr-logo-h', lw, lh)), lx, ly, lw, lh);
    g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(0, 0, 0, 0.6)'; g.shadowBlur = 8;
    g.fillStyle = '#e9e2cf'; g.font = `600 46px ${KRF}`; g.fillText(T1, lx + 8, ly + lh + 86);
    g.fillStyle = '#a9b0a6'; g.font = `500 25px ${KRF}`; g.fillText(T2, lx + 8, ly + lh + 132);
    g.shadowBlur = 0; g.fillStyle = '#f0a43a'; g.fillRect(lx + 8, ly + lh + 168, 46, 4);
    g.font = `700 19px ${SAIRA}`; if ('letterSpacing' in g) g.letterSpacing = '3px'; g.fillText(T3, lx + 68, ly + lh + 176);
    return c;
  }
  // 소식 카드 그림 720×200 (JPEG): 작전 지도 + 오른쪽에 홈 화면의 게임 아이콘
  async function bannerArt() {
    const W = 720, H = 200, c = canvas(W, H), g = c.getContext('2d'), pw = 240, ph = 135;
    keyArt(g, W, H, { zx: 440, zy: 118, zr: 150, seed: 3, pt: 0.47 });
    g.save(); g.shadowColor = 'rgba(0, 0, 0, 0.7)'; g.shadowBlur = 22; g.drawImage(await pic(`<svg xmlns="${NS}" width="${pw}" height="${ph}" viewBox="0 0 320 180">${defsXML()}${phone()}</svg>`), W - pw - 44, 26, pw, ph); g.restore();
    return c.toDataURL('image/jpeg', 0.86);
  }

  // ---------- 아이콘 내보내기 (로컬 서버 전용) ----------
  // 로고 블록 글: id 가 ldrDefs 인 svg 여는 태그(속성 순서는 상관없음)부터 짝이 맞는 닫는 svg 태그까지 (CR 은 지움 · HTML 주석 안의 svg 태그는 세지 않음) — 없으면 null
  //  (찾는 정규식은 이 스크립트 안의 자기 글에는 맞지 않는다 — 그 글의 svg 와 id 사이에 '>' 가 끼어 있음 · 페이지에서는 로고 블록이 스크립트보다 앞)
  //  build.js 의 ldrDefsText · fnv1a32 와 똑같이 둔다 (SOURCE.txt 해시로 낡은 아이콘을 알아챔)
  const ldrDefsText = (s) => {
    s = s.replace(/\r/g, ''); const t = s.replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length)), o = /<svg\b[^>]*\bid=["']ldrDefs["'][^>]*>/.exec(t); if (!o) return null; const i = o.index;
    const re = /<(\/?)svg\b[^>]*?(\/?)>/g; re.lastIndex = i; let d = 0, m;
    while ((m = re.exec(t))) { if (m[1]) { if (--d === 0) return s.slice(i, m.index + m[0].length); } else if (!m[2]) d++; }
    return null;
  };
  // FNV-1a 32비트 (UTF-8 바이트) → 16진수 8자리
  const fnv1a32 = (b) => { let h = 0x811c9dc5; for (let k = 0; k < b.length; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const getPage = async () => (await fetch(location.pathname + location.search, { cache: 'no-store' })).text();
  // 지금 페이지 HTML(받은 그대로)의 로고 블록 해시 — html 을 주면 그것으로
  async function ldrHash(html) { if (html === undefined) html = await getPage(); const t = ldrDefsText(html); return t === null ? null : fnv1a32(new TextEncoder().encode(t)); }
  // 한 번에: 방금 받은 페이지의 로고 블록으로 아이콘 7장 + og.jpg 를 그려 로컬 서버(POST /put?p=icons/이름 · data URL 본문)로 dist/icons 에 쓰고 SOURCE.txt(해시·크기) — 결과 요약을 돌려줌
  //  그림도 해시도 그 받은 글에서 (다시 빌드하기 전에 열어 둔 탭이라 화면의 로고가 옛것이어도 새 로고로 그리고, SOURCE.txt 해시와 그림이 어긋나지 않음)
  //  { download: true }: 서버에 쓰지 않고 브라우저 내려받기로 9개 파일 (/put 이 없는 서버에서 — 받은 파일을 dist/icons 에 넣어 커밋)
  //  { anyFont: true }: 링크 미리보기 글꼴을 받지 못해도 그림 (기본은 멈춤)
  async function exportIcons(opt) {
    const dl = !!(opt && opt.download);
    if (!dl && !LOCAL.test(location.hostname)) throw new Error('로컬 서버(localhost)에서만 — dist/icons 는 /put?p=icons/이름 으로 씀 (다른 곳은 exportIcons({ download: true }))');
    const blk = ldrDefsText(await getPage()), box = blk === null ? null : new DOMParser().parseFromString('<!doctype html><body>' + blk, 'text/html').getElementById('ldrDefs');
    if (!box) throw new Error('페이지에서 로고 블록(#ldrDefs)을 찾지 못함');
    const hash = fnv1a32(new TextEncoder().encode(blk));
    const save = async (n, url, body) => {
      if (dl) { const a = document.createElement('a'); a.href = url; a.download = n; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 300)); return; }
      const r = await fetch('/put?p=icons/' + n, { method: 'POST', body }); if (!r.ok) throw new Error(n + ' 저장 실패 (' + r.status + ')');
    };
    let files; defsSrc = box;
    try { files = await icons(!!(opt && opt.anyFont)); } finally { defsSrc = null; }
    const out = {};
    for (const n in files) {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = files[n]; });
      await save(n, files[n], files[n]);
      out[n] = im.naturalWidth + 'x' + im.naturalHeight + ' ' + Math.round(atob(files[n].split(',')[1]).length / 1024) + 'KB';
    }
    const txt = ['# Last Drop Royale 앱 아이콘 — 로고 기호(src/index.html #ldrDefs)에서 코드로 그림 (src/10_app.js App.exportIcons)', '# 로고를 바꾸면: 다시 빌드 → 로컬 서버에서 게임을 열고 콘솔에 await __LD.App.exportIcons() → dist/icons 커밋', '# build.js 는 아래 해시가 지금 로고 블록의 해시(FNV-1a 32비트 · UTF-8 · CR 제외)와 다르면 경고한다', 'ldrDefs-fnv1a32: ' + hash, 'generated: ' + new Date().toISOString(), ...Object.keys(out).map((n) => n + ' ' + out[n])].join('\n') + '\n';
    await save('SOURCE.txt', 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt), txt);
    return { hash, files: out };
  }

  // 시험·확인용 상태
  function state() {
    let S = null; try { S = navigator.serviceWorker; } catch (e) { /* 쓸 수 없는 곳 */ }
    return { mode: mode(), app: isApp, prompt: !!bip, ios: IOS, inapp: INAPP, browser: BR, shown: canShow(), dot: dotOn(), news: newsOn, outcome, sw: reg ? (reg.active ? reg.active.state : reg.installing ? 'installing' : 'registered') : swErr || 'off', controlled: !!(S && S.controller) };
  }
  return { setup, open, close, install, render, state, icons, exportIcons, ldrHash, ldrDefsText, fnv1a32, svgOf, og, bannerArt, ICONS };
})();
