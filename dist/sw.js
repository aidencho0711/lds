// ============================================================
// sw.js — 서비스 워커 (v23 앱 설치 · 오프라인 시작) · 원본은 public/sw.js, 빌드가 dist/sw.js 로 복사
//  등록: src/10_app.js — https 에서만 (로컬 http 는 localStorage 'lastdrop.sw' 가 '1' 일 때만 · file: 은 안 함)
//  · 페이지 이동: 네트워크 먼저 → 받은 게임 페이지(범위 맨 위 · index.html)는 주소 꼬리(?slot=2 등)를 떼고 HOME 한 칸에 저장
//    → 네트워크가 안 되면 저장본 (같은 출처의 어느 페이지로 가든 게임 페이지)
//  · 주소에 버전이 박힌 CDN 파일(three.js · supabase-js · 구글 글꼴 파일): 캐시 먼저 — 같은 주소의 내용은 바뀌지 않는다
//  · 구글 글꼴 CSS(fonts.googleapis.com): 네트워크 먼저 — 페이지는 no-cors 로 불러 불투명(저장 안 함)이라 워커가 cors 로 받아 저장 (오프라인 시작에도 글꼴)
//  · 같은 출처의 다른 GET(manifest · 아이콘 등): 네트워크 먼저, 안 되면 저장본
//  · 건드리지 않음(브라우저가 그대로): GET 이 아닌 요청(10_ver.js 새 배포 확인 HEAD 등) · Supabase(*.supabase.co) · 그 밖의 다른 출처
//  · 저장하지 않음: 불투명(opaque)·리디렉트·200 이 아닌 응답 · 페이지를 억지로 새로고침하지 않는다 (새 배포는 10_ver.js 막대가 알림)
//  · 캐시는 덤: 캐시 저장소가 고장 나도(저장 공간 부족 · 브라우저 내부 오류) 열기·읽기·쓰기 실패는 삼키고 네트워크 응답을 그대로 — 온라인이면 캐시 없이도 늘 뜬다
//  · 저장 방식을 바꾸면 V 를 올린다 → 새 워커가 켜질 때 옛 'ldr-' 캐시를 지움
// ============================================================
const V = 'ldr-v1';
// 게임 페이지 저장 칸 = 등록 범위 주소 (배포: https://…/ · 하위 경로에 올려도 그 경로)
const HOME = self.registration.scope;
// 설치 때 미리 저장할 three.js — src/index.html 받기 코드의 첫 주소와 같게
const THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const LIB = [/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r\d+\//, /^https:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/(three|@supabase\/supabase-js)@\d+\.\d+\.\d+\//, /^https:\/\/fonts\.gstatic\.com\//];
const FONT_CSS = /^https:\/\/fonts\.googleapis\.com\/css2?\?/;
const ok = (r) => !!r && r.status === 200 && !r.redirected && (r.type === 'basic' || r.type === 'cors');
// 캐시 저장소를 쓰는 일: 바로 나는 오류(저장소를 아예 못 씀)도 거절로 바꿔 받는 쪽의 catch 가 함께 삼키게
const cs = (f) => new Promise((res) => res(f()));
// 저장본 찾기 — 오류는 '없음'으로
const hit = (k) => cs(() => caches.match(k, { ignoreVary: true, cacheName: V })).catch(() => null);
// 응답을 돌려주면서 (저장해도 되는 것이면) 사본을 캐시에 — 사본은 지금 바로 떠 두고, 저장이 끝날 때까지 워커를 살려 둔다 (실패는 무시)
const keep = (e, k, r) => { if (ok(r)) { const c = r.clone(); e.waitUntil(cs(() => caches.open(V)).then((x) => x.put(k, c)).catch(() => 0)); } return r; };

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // 게임 페이지 · three.js 를 미리 (대개 브라우저 캐시에서 바로 옴) — 실패해도(캐시 오류 포함) 설치는 계속, 다음 방문 때 저절로 채워짐
  e.waitUntil(cs(() => caches.open(V)).then((c) => Promise.all([HOME, THREE].map((u) => fetch(u).then((r) => (ok(r) ? c.put(u, r) : 0)).catch(() => 0)))).catch(() => 0));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(cs(() => caches.keys()).then((ks) => Promise.all(ks.filter((k) => k.indexOf('ldr-') === 0 && k !== V).map((k) => caches.delete(k)))).catch(() => 0).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const q = e.request; if (q.method !== 'GET') return;
  if (q.cache === 'only-if-cached' && q.mode !== 'same-origin') return;   // 개발자 도구가 만드는 요청 — 워커에서 fetch 하면 실패하므로 그대로
  const u = new URL(q.url), same = u.origin === self.location.origin;
  if (q.mode === 'navigate') { if (same) e.respondWith(page(e, u)); return; }
  if (same) e.respondWith(net(e, q));
  else if (LIB.some((re) => re.test(q.url))) e.respondWith(lib(e, q));
  else if (FONT_CSS.test(q.url)) e.respondWith(css(e, q));
});
// 모두 네트워크를 먼저 (lib 만 저장본 먼저) — 캐시를 열지 못해도 네트워크 응답은 그대로 간다
async function page(e, u) {
  const p = u.origin + u.pathname, home = p === HOME || p === HOME + 'index.html';
  try { const r = await fetch(e.request); return home ? keep(e, HOME, r) : r; }
  catch (err) { const h = await hit(HOME); if (h) return h; throw err; }
}
async function net(e, q) {
  try { return keep(e, q, await fetch(q)); }
  catch (err) { const h = await hit(q); if (h) return h; throw err; }
}
async function lib(e, q) { return (await hit(q)) || keep(e, q, await fetch(q)); }
// 구글 글꼴 CSS: cors 로 받아 저장 (구글은 Access-Control-Allow-Origin: * · 쿠키 없이) → 안 되면 저장본 → 그것도 없으면 페이지의 원래 요청 그대로 (저장 안 함)
async function css(e, q) {
  try { return keep(e, q.url, await fetch(q.url, { mode: 'cors', credentials: 'omit' })); }
  catch (err) { return (await hit(q.url)) || fetch(q); }
}
