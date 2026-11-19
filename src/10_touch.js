// ============================================================
// 10_touch.js — 모바일 터치 조작
//  · 버튼 정의를 한곳에서 관리 → 게임 HUD와 배치 편집기가 같은 정의를 쓴다
//  · 위치는 '가까운 화면 모서리 + 거리(px)'로 저장 → 화면 비율이 달라도 모서리 기준으로 유지
//  · 버튼별 크기(50~200%), 전체 크기, 조이스틱 고정/유동 설정
//  · 화면 밖으로 나가지 않도록 항상 안전 영역 안으로 잘라 넣음
//  · 전체 화면: 휴대폰·태블릿에서 화면을 누르면(버튼이든 빈 곳이든) 전체 화면으로 — 브라우저는 누르는 동작 안에서만 허락하므로
//    누를 때마다 '전체 화면이 아니면' 다시 요청한다 (iPhone Safari 처럼 지원하지 않는 곳은 그대로)
// ============================================================
(() => {
  if (!IS_TOUCH || typeof document === 'undefined') return;
  const go = () => {
    const d = document, el = d.documentElement; if (d.fullscreenElement || d.webkitFullscreenElement) return;
    const rq = el.requestFullscreen || el.webkitRequestFullscreen; if (!rq) return;
    try { const p = rq.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => { /* 거절되면 다음 터치에서 다시 */ }); } catch (e) { /* 지원 안 함 */ }
  };
  for (const ev of ['pointerup', 'touchend', 'click']) document.addEventListener(ev, go, { capture: true, passive: true });
})();
// v22 모바일 버튼: 글자 대신 그림 (icon = 아래 TOUCH_ICONS 이름 · label 은 길게 누름 안내·읽어 주기·배치 편집기에만)
const TOUCH_BTNS = [
  { id: 'fire', label: '사격', icon: 'fire', hold: 'fire', size: 84, cls: 'fire', def: { ax: 'r', ay: 'b', x: 66, y: 122 } },
  { id: 'aim', label: '조준', icon: 'aim', hold: 'aim', size: 54, def: { ax: 'r', ay: 'b', x: 147, y: 169 } },
  { id: 'jump', label: '점프', icon: 'jump', tap: 'jump', size: 54, def: { ax: 'r', ay: 'b', x: 43, y: 43 } },
  { id: 'crouch', label: '앉기', icon: 'crouch', tap: 'crouch', size: 54, def: { ax: 'r', ay: 'b', x: 107, y: 43 } },
  { id: 'prone', label: '엎드리기', icon: 'prone', tap: 'prone', size: 54, def: { ax: 'r', ay: 'b', x: 171, y: 43 } },
  { id: 'reload', label: '장전', icon: 'reload', tap: 'reload', size: 54, def: { ax: 'r', ay: 'b', x: 147, y: 107 } },
  // (v21) '무기' 교체 버튼은 없앰 — HP 바 위 무기 실루엣을 눌러 바꾼다 (10_hud.js touchWeapons)
  { id: 'interact', label: '줍기', icon: 'pickup', tap: 'interact', size: 54, cls: 'interact', def: { ax: 'r', ay: 'b', x: 213, y: 143 } },
  { id: 'mode', label: '사격 모드', icon: 'mode_auto', tap: 'fireMode', size: 44, def: { ax: 'r', ay: 'b', x: 213, y: 205 } },
  { id: 'sprint', label: '달리기', icon: 'sprint', hold: 'sprint', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 73 } },
  { id: 'heal', label: '회복', icon: 'heal', menu: 'heal', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 133 } },
  { id: 'throw', label: '투척', icon: 'throw', menu: 'throw', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 193 } },
  { id: 'fire2', label: '사격', icon: 'fire', hold: 'fire', size: 54, cls: 'fire', def: { ax: 'l', ay: 't', x: 39, y: 253 } },
  { id: 'ping', label: '핑', icon: 'ping', tap: 'ping', size: 44, cls: 'ping', def: { ax: 'l', ay: 't', x: 39, y: 312 } },
  { id: 'seat', label: '좌석', icon: 'seat', tap: 'seat', size: 48, cls: 'seat', def: { ax: 'r', ay: 'b', x: 275, y: 143 } },
  // 기울이기: 누르면 그쪽으로 기울고 다시 누르면 바로 섬 (반대쪽을 누르면 바꿔 기울임)
  { id: 'leanL', label: '왼쪽 기울이기', icon: 'leanL', hold: 'leanL', size: 46, cls: 'lean', def: { ax: 'l', ay: 'b', x: 62, y: 214 } },
  { id: 'leanR', label: '오른쪽 기울이기', icon: 'leanR', hold: 'leanR', size: 46, cls: 'lean', def: { ax: 'l', ay: 'b', x: 238, y: 214 } },
  { id: 'stick', label: '이동', kind: 'stick', size: 112, def: { ax: 'l', ay: 'b', x: 150, y: 120 } },
];
// 버튼 그림 (24×24, 선 = 글자색) — 모두 자체 디자인
const _bul = (x, y = 5, s = 1) => `<path d="M${x} ${y}c${1.3 * s} ${1.1 * s} ${1.9 * s} ${2.6 * s} ${1.9 * s} ${4.3 * s}V${y + 12 * s}h${-3.8 * s}V${y + 4.3 * s}c0-${1.7 * s} ${0.6 * s}-${3.2 * s} ${1.9 * s}-${4.3 * s}z" fill="currentColor" stroke="none"/><path d="M${x - 1.9 * s} ${y + 13 * s}h${3.8 * s}v${1.6 * s}h${-3.8 * s}z" fill="currentColor" stroke="none"/>`;
const _car = '<path d="M2.5 16.5v-3.2l2.4-4.8h9.7l2.4 4.8v3.2z"/><circle cx="6.3" cy="17.3" r="1.7" fill="currentColor" stroke="none"/><circle cx="13.2" cy="17.3" r="1.7" fill="currentColor" stroke="none"/>';
const _lean = '<circle cx="8.6" cy="5" r="2.3" fill="currentColor" stroke="none"/><path d="M9.6 8.4l3.2 6.6M12.8 15l-2.4 6M12.8 15l3.8 5.6M10.9 10.9l4.6 1.1"/><path d="M5.6 3.2L2.4 6l3.2 2.8"/>';
const TOUCH_ICONS = {
  fire: `<g transform="rotate(35 12 12)">${_bul(12, 2.5, 1.25)}</g>`,
  aim: '<circle cx="12" cy="12" r="7.5"/><path d="M12 1.8v5.4M12 16.8v5.4M1.8 12h5.4M16.8 12h5.4"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  jump: '<path d="M12 2.8l6.2 6.6h-3.9v5.8H9.7V9.4H5.8z" fill="currentColor" stroke="none"/><path d="M4 20h16"/>',
  vault: '<rect x="8.8" y="14.2" width="6.4" height="6.2" rx=".6" fill="currentColor" stroke="none"/><path d="M2.8 17.5C3.8 9.5 8.6 5.2 12.6 5.2c3.7 0 6.4 2.4 7.6 6"/><path d="M22 7.6l-1.6 4.2-4.1-1.7"/>',
  climb: '<path d="M3 20.5h8.5v-8.2H21"/><path d="M16 9.5V2.8M12.8 6l3.2-3.2L19.2 6"/>',
  crouch: '<circle cx="13.2" cy="4.6" r="2.3" fill="currentColor" stroke="none"/><path d="M12.6 8.2L10 13.4l5.4 1.2V21M10 13.4L7.8 21M11.8 9.8l4.4 1.8"/>',
  prone: '<circle cx="4.8" cy="12.6" r="2.3" fill="currentColor" stroke="none"/><path d="M8 14.2l12.4 1.6M10.6 14.6l2.2-3.4 4.2.4M2.5 19.2h19"/>',
  reload: '<path d="M20 11.5a8 8 0 1 0-2.4 5.9"/><path d="M20.4 4.2v7.2h-7.2"/><rect x="10.1" y="8.6" width="3.8" height="7" rx=".7" fill="currentColor" stroke="none"/>',
  pickup: '<path d="M12 2.8v10.4M7.4 8.8l4.6 4.6 4.6-4.6"/><path d="M4 13.8v6h16v-6"/>',
  board: _car + '<path d="M22 2.6l-4.6 4.6M17.2 3.2v4.2h4.2"/>',
  exit: _car + '<path d="M17.4 7.2L22 2.6M18 2.6h4v4"/>',
  revive: '<path d="M12 20.4s-7.4-4.6-7.4-10.4a4.2 4.2 0 0 1 7.4-2.7A4.2 4.2 0 0 1 19.4 10c0 5.8-7.4 10.4-7.4 10.4z"/><path d="M12 9.2v6.4M8.8 12.4h6.4"/>',
  recall: '<rect x="2.8" y="9.2" width="12.4" height="10" rx="1.6"/><path d="M6 13.2h6M6 16h4"/><path d="M17.6 8.2a4.2 4.2 0 0 1 0 6.2M20.2 5.6a8 8 0 0 1 0 11.4"/>',
  cancel: '<circle cx="12" cy="12" r="9"/><path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2"/>',
  mode_single: _bul(12, 3.5),
  mode_burst: _bul(6.5, 3.5) + _bul(12, 3.5) + _bul(17.5, 3.5),
  mode_auto: _bul(7, 1.5, 0.8) + _bul(12, 1.5, 0.8) + _bul(17, 1.5, 0.8) + '<path d="M4 18.2h16M6.5 21.2h11"/>',
  mode_slow: _bul(8.5, 3.5) + _bul(15.5, 3.5),
  sprint: '<circle cx="14.6" cy="3.9" r="2.3" fill="currentColor" stroke="none"/><path d="M13.4 7.6L10.9 13l4.1 2.6-1.6 5.2M10.9 13l-3.6 6.6M13 8.6l3.6 3 3.2-1M13.2 8L8.9 9.6l-1.6 3.1"/>',
  heal: '<path d="M9.4 3.2h5.2v6.2h6.2v5.2h-6.2v6.2H9.4v-6.2H3.2V9.4h6.2z" fill="currentColor" stroke="none"/>',
  throw: '<ellipse cx="10.6" cy="14.6" rx="5.6" ry="6.6" fill="currentColor" stroke="none"/><path d="M8.2 7.4h5l1.1-2.2H7.2z" fill="currentColor" stroke="none"/><path d="M13.6 6.2c2.6-.6 4.6.4 5.2 3.1"/><circle cx="17.8" cy="4.2" r="2.1"/>',
  pin: '<circle cx="8.6" cy="15" r="5.2"/><path d="M12.4 11.2L20 3.6M15.6 3.6H20V8"/>',
  toss: '<path d="M3.5 20C5.5 11 12.4 6.6 19.6 7.4" stroke-dasharray="2.6 2.4"/><circle cx="19.2" cy="7.2" r="2.8" fill="currentColor" stroke="none"/>',
  slash: '<path d="M4.6 19.4L15.8 8.2l3-.8-.8 3L6.8 21.6z" fill="currentColor" stroke="none"/><path d="M5.4 7.2a9.6 9.6 0 0 1 7.6-4.6M3.2 11.4a9.6 9.6 0 0 1 .8-2.2" stroke-dasharray="2 2"/>',
  fist: '<path d="M7.2 11.2V8.6a1.6 1.6 0 0 1 3.2 0v2.2M10.4 10.6V7.6a1.6 1.6 0 0 1 3.2 0v3M13.6 10.6V8.2a1.6 1.6 0 0 1 3.2 0v3.2M16.8 11a1.6 1.6 0 0 1 3.2 0v3.2c0 4-3 7-7 7h-1.4c-3 0-5.4-2.4-5.4-5.4v-3.6a1.6 1.6 0 0 1 3.2 0"/>',
  ping: '<path d="M12 21.2s-6.6-6.4-6.6-11.4a6.6 6.6 0 0 1 13.2 0c0 5-6.6 11.4-6.6 11.4z"/><circle cx="12" cy="9.8" r="2.5" fill="currentColor" stroke="none"/>',
  seat: '<path d="M7.6 3.2h3.2l1.2 9.4h6.6l1.4 5.8h-3.1l-1-3.2H9.6z" fill="currentColor" stroke="none"/><path d="M4.6 21h14.8"/>',
  leanL: _lean,
  leanR: `<g transform="translate(24 0) scale(-1 1)">${_lean}</g>`,
  bag: '<path d="M8 6.2V4.6A1.6 1.6 0 0 1 9.6 3h4.8A1.6 1.6 0 0 1 16 4.6v1.6"/><rect x="4.8" y="6.2" width="14.4" height="15" rx="3.2"/><path d="M8.6 13h6.8v4.4H8.6zM4.8 11h14.4"/>',
  chute: '<path d="M2.6 11.2a9.4 7.2 0 0 1 18.8 0z" fill="currentColor" stroke="none"/><path d="M3.6 11.2l8.4 9 8.4-9M8.8 11.2l3.2 9 3.2-9"/>',
  skydive: '<path d="M3 4.6h18l-3.2 2.2H6.2z" fill="currentColor" stroke="none"/><path d="M12 9v11M7.6 15.6L12 20l4.4-4.4"/>',
  // 빈 무기 칸: 총 윤곽선
  rifle: '<path d="M1.6 10.2h4.2l1.2-1.2h9.4l.8-1.4h2.4V9h2.8v1.6h-2.8l-.6 1.4h-3.2l-1.2 4.6h-2.6l.8-4.6H8.4l-1.2 2.4H4.4l.6-2.4H1.6z" stroke-width="1.4"/>',
  pistol: '<path d="M4.6 7.4h14v3.2h-2.2l-1 1.6h-3.2l-1.4 5.4H7.4l1.2-5.4H4.6z" stroke-width="1.5"/>',
};
const touchIcon = (name) => `<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOUCH_ICONS[name] || ''}</svg>`;
// 모바일에서 위치·크기를 바꿀 수 있는 HUD 창·버튼 (사각형). 저장 방식은 원형 버튼과 같다(가까운 모서리 + 중심까지 거리)
const TOUCH_PANELS = [
  { id: 'bag', label: '가방', el: 'hbBag', w: 50, h: 28, btn: true, def: { ax: 'l', ay: 't', x: 35, y: 22 } },
  { id: 'menu', label: '메뉴', el: 'hbMenu', w: 50, h: 28, btn: true, def: { ax: 'l', ay: 't', x: 91, y: 22 } },
  { id: 'killfeed', label: '킬 로그', el: 'killfeed', w: 210, h: 48, def: { ax: 'l', ay: 't', x: 191, y: 64 } },
  { id: 'team', label: '팀 목록', el: 'teamPanel', w: 132, h: 102, def: { ax: 'l', ay: 't', x: 152, y: 143 } },
  // 미니맵: 기본은 오른쪽 위, 화면이 낮으면 자동으로 작아짐(오른쪽 버튼과 겹치지 않게). 크기는 확대 대신 실제 픽셀로
  { id: 'minimap', label: '미니맵', el: 'mini', w: 120, h: 120, wh: true, fit: true, def: { ax: 'r', ay: 't', x: 70, y: 68 } },
  { id: 'counters', label: '생존·처치', el: 'counters', w: 176, h: 30, def: { ax: 'l', ay: 't', x: 210, y: 22 } },
  { id: 'toasts', label: '알림 메시지', el: 'toasts', w: 300, h: 50, keepW: true, def: { ax: 'c', ay: 't', x: 0, y: 84 } },
];
const Touch = (() => {
  const SAFE = { l: 0, r: 0, t: 0, b: 0 };
  let probe = null, stickId = null, sx = 0, sy = 0, lookId = null, fireLookId = null;
  // 시점 회전은 손가락(pointerId)마다 마지막 위치를 따로 기억한다.
  // (예전엔 시점 손가락과 사격 버튼 손가락이 위치 변수를 공유해서, 사격 버튼을 누르는 순간
  //  두 손가락 사이 거리만큼 시점이 한 번에 튀었다)
  const lastPt = new Map();
  const lookStart = (e) => lastPt.set(e.pointerId, [e.clientX, e.clientY]);
  const lookEnd = (e) => lastPt.delete(e.pointerId);
  const lookMove = (e) => {
    const q = lastPt.get(e.pointerId); lastPt.set(e.pointerId, [e.clientX, e.clientY]);
    if (!q) return;
    const dx = e.clientX - q[0], dy = e.clientY - q[1];
    // 이벤트 한 번에 200px 넘게 움직였다면 손가락 식별이 꼬인 것 → 버린다(정상 플릭은 프레임당 수십 px)
    if (Math.abs(dx) > 200 || Math.abs(dy) > 200) return;
    const k = 1.6 * SETTINGS.touchSens; Input.lookX += dx * k; Input.lookY += dy * k;
  };
  function measureSafe() {
    if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(probe); }
    const cs = getComputedStyle(probe);
    SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0; SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
  }
  const layoutOf = (def, layout) => Object.assign({ s: 1 }, def.def, (layout || SETTINGS.touchLayout || {})[def.id] || {});
  // 저장 값 → 화면 좌표(중심, 지름)
  function place(def, layout, W = window.innerWidth, H = window.innerHeight) {
    const o = layoutOf(def, layout), size = def.size * (o.s || 1) * SETTINGS.btnScale;
    let cx = o.ax === 'l' ? SAFE.l + o.x : o.ax === 'c' ? W / 2 + o.x : W - SAFE.r - o.x, cy = o.ay === 't' ? SAFE.t + o.y : H - SAFE.b - o.y;
    cx = clamp(cx, SAFE.l + size / 2 + 4, W - SAFE.r - size / 2 - 4); cy = clamp(cy, SAFE.t + size / 2 + 4, H - SAFE.b - size / 2 - 4);
    return { cx, cy, size };
  }
  // 사각형 창: 저장 값 → 화면 중심·크기 (크기 배율 s만 따로, 원형 버튼 전체 크기와는 무관)
  function placeRect(def, layout, W = window.innerWidth, H = window.innerHeight) {
    const custom = (layout || SETTINGS.touchLayout || {})[def.id];
    const o = layoutOf(def, layout);
    // 자동 맞춤(미니맵): 직접 옮기지 않았으면 화면 높이의 29%(84~120px), 오른쪽 위 모서리에 붙임
    const s = def.fit && !custom ? clamp(H * 0.29, 84, def.h) / def.h : (o.s || 1), w = def.w * s, h = def.h * s;
    let cx = o.ax === 'l' ? SAFE.l + o.x : o.ax === 'c' ? W / 2 + o.x : W - SAFE.r - o.x, cy = o.ay === 't' ? SAFE.t + o.y : H - SAFE.b - o.y;
    if (def.fit && !custom) { cx = W - SAFE.r - 10 - w / 2; cy = SAFE.t + 8 + h / 2; }
    cx = clamp(cx, SAFE.l + w / 2 + 2, W - SAFE.r - w / 2 - 2); cy = clamp(cy, SAFE.t + h / 2 + 2, H - SAFE.b - h / 2 - 2);
    return { cx, cy, w, h, s, rect: true };
  }
  const defOf = (id) => TOUCH_BTNS.find((b) => b.id === id) || TOUCH_PANELS.find((b) => b.id === id);
  const placeAny = (def, layout) => def.w ? placeRect(def, layout) : place(def, layout);
  // 실제 HUD 요소에 적용 (모바일만 — PC는 기본 배치)
  function applyPanel(def, p) {
    const el = $(def.el); if (!el) return;
    const st = el.style;
    st.position = 'fixed'; st.left = (p.cx - p.w / 2) + 'px'; st.top = (p.cy - p.h / 2) + 'px'; st.right = 'auto'; st.bottom = 'auto';
    if (def.wh) { st.width = p.w + 'px'; st.height = p.h + 'px'; st.transform = 'none'; return; }
    st.transformOrigin = '0 0'; st.transform = `scale(${p.s})`;
    if (def.btn || def.keepW) st.width = def.w + 'px';
    if (def.btn) { st.height = def.h + 'px'; st.padding = '0'; }
  }
  function stylePanelEd(el, def, p) {
    el.style.left = (p.cx - p.w / 2) + 'px'; el.style.top = (p.cy - p.h / 2) + 'px'; el.style.width = p.w + 'px'; el.style.height = p.h + 'px';
    el.style.fontSize = Math.max(10, Math.min(p.h * 0.42, 15)) + 'px';
  }
  const styleAny = (el, def, p) => def.w ? stylePanelEd(el, def, p) : styleBtn(el, def, p);
  // 화면 좌표 → 저장 값 (가까운 모서리 기준)
  function toLayout(cx, cy, s, W = window.innerWidth, H = window.innerHeight) {
    // 화면 가운데 근처(±12%)면 가운데 기준 → 화면 폭이 달라도 가운데에 유지
    const ax = Math.abs(cx - W / 2) < W * 0.12 ? 'c' : cx < W / 2 ? 'l' : 'r', ay = cy < H / 2 ? 't' : 'b';
    return { ax, ay, x: Math.round(ax === 'l' ? cx - SAFE.l : ax === 'c' ? cx - W / 2 : W - SAFE.r - cx), y: Math.round(ay === 't' ? cy - SAFE.t : H - SAFE.b - cy), s };
  }
  function styleBtn(el, def, p) {
    el.style.left = (p.cx - p.size / 2) + 'px'; el.style.top = (p.cy - p.size / 2) + 'px';
    el.style.width = el.style.height = p.size + 'px';
    el.style.fontSize = Math.max(10, p.size * (def.id === 'fire' ? 0.2 : 0.23)) + 'px';
  }
  function apply() {
    measureSafe();
    for (const def of TOUCH_BTNS) {
      const p = place(def);
      if (def.kind === 'stick') { const st = $('stick'); st.style.width = st.style.height = p.size + 'px'; st.style.margin = `${-p.size / 2}px 0 0 ${-p.size / 2}px`; st.dataset.cx = p.cx; st.dataset.cy = p.cy; if (stickId === null) { st.style.left = p.cx + 'px'; st.style.top = p.cy + 'px'; } st.classList.toggle('fixed', !!SETTINGS.stickFixed); continue; }
      const el = $('tb_' + def.id); if (el) styleBtn(el, def, p);
    }
    if (IS_TOUCH) for (const def of TOUCH_PANELS) applyPanel(def, placeRect(def));
  }
  function stickR() { const d = TOUCH_BTNS.find((b) => b.id === 'stick'); return place(d).size / 2; }

  // v22 그림 버튼: 그림이 바뀔 때만 다시 그린다 (매 프레임 부름)
  function setIcon(el, name, label) {
    if (!el) return;
    if (el.dataset.ic !== name) { el.dataset.ic = name; el.innerHTML = touchIcon(name); }
    if (label && el._lbl !== label) { el._lbl = label; el.setAttribute('aria-label', label); el.title = label; }
  }
  // v22: 버튼(무기 칸 등)을 누른 채 끌어도 화면이 돈다 — 손가락(pointerId)마다 따로
  function dragLook(el) {
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; el._lp = e.pointerId; lookStart(e); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === el._lp) lookMove(e); });
    const end = (e) => { if (e.pointerId === el._lp) { el._lp = null; lookEnd(e); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  function setup() {
    const box = $('tbtns');
    for (const def of TOUCH_BTNS) {
      if (def.kind === 'stick') continue;
      const b = document.createElement('button'); b.className = 'tbtn' + (def.cls ? ' ' + def.cls : ''); b.id = 'tb_' + def.id; setIcon(b, def.icon || def.id, def.label);
      if (def.hold) b.dataset.hold = def.hold; if (def.tap) b.dataset.tap = def.tap;
      box.appendChild(b); bindBtn(b, def);
    }
    // 가방·강하·낙하산 버튼도 그림으로 (메뉴는 글자 그대로)
    const bag = $('hbBag'); if (bag) bag.insertAdjacentHTML('afterbegin', touchIcon('bag'));
    for (const [id, ic] of [['jumpBtn', 'skydive'], ['chuteBtn', 'chute']]) { const e = $(id); if (e) e.insertAdjacentHTML('afterbegin', touchIcon(ic)); }
    const stick = $('stick'), knob = $('stickKnob'), zone = $('touchLayer');
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      Audio.init(); HUD.closeQuick();
      if (G.state !== 'play' || G.paused) return;
      e.preventDefault();
      const W = window.innerWidth, R = stickR();
      const fcx = +stick.dataset.cx, fcy = +stick.dataset.cy;
      const nearFixed = Math.hypot(e.clientX - fcx, e.clientY - fcy) < R * 1.6;
      if (stickId === null && (SETTINGS.stickFixed ? nearFixed : e.clientX < W * 0.42)) {
        stickId = e.pointerId;
        if (SETTINGS.stickFixed) { sx = fcx; sy = fcy; } else { sx = e.clientX; sy = e.clientY; }
        stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
        moveStick(e.clientX, e.clientY);
      } else if (lookId === null) { lookId = e.pointerId; lookStart(e); }
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    });
    const moveStick = (x, y) => {
      let dx = x - sx, dy = y - sy; const L = Math.hypot(dx, dy), r = stickR();
      Input.touchSprint = L > r * 1.35 && dy < -r * 0.6; // 위로 길게 밀면 달리기 (사격 중엔 자동 해제)
      if (L > r) { dx = dx / L * r; dy = dy / L * r; }
      Input.move.x = dx / r; Input.move.z = -dy / r;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickId) moveStick(e.clientX, e.clientY);
      else if (e.pointerId === lookId) lookMove(e);
    });
    const end = (e) => {
      if (e.pointerId === stickId) {
        stickId = null; Input.move.x = Input.move.z = 0; Input.touchSprint = false; stick.classList.remove('on');
        knob.style.transform = 'translate(-50%,-50%)'; stick.style.left = stick.dataset.cx + 'px'; stick.style.top = stick.dataset.cy + 'px';
      }
      if (e.pointerId === lookId) { lookId = null; lookEnd(e); }
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
    apply();
    window.addEventListener('resize', apply);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
  }
  // 버튼: 누르고 있는 동안 유지되는 입력(사격) + 토글(조준·달리기) + 단발
  //  v22: 모든 버튼 — 누른 채 끌면 화면(조준점)이 따라간다 (예전엔 사격 버튼만). 손가락마다 따로 기억하므로 여러 손가락이 함께 돌려도 튀지 않음
  function bindBtn(b, def) {
    const hold = def.hold, tap = def.tap;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); Audio.init(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('down');
      b._lp = e.pointerId; lookStart(e);
      if (hold === 'fire') { Input.fire = true; fireLookId = e.pointerId; }
      else if (hold === 'sprint') { Input.touchSprintBtn = !Input.touchSprintBtn; b.classList.toggle('active', Input.touchSprintBtn); }
      else if (hold === 'aim') { Input.aimToggle = !Input.aimToggle; b.classList.toggle('active', Input.aimToggle); }
      else if (hold === 'leanL' || hold === 'leanR') { const s = hold === 'leanR' ? 1 : -1; Input.touchLean = Input.touchLean === s ? 0 : s; syncLean(); }
      if (tap) Input.press(tap);
      if (def.menu) HUD.quick(def.menu, b); // 회복·투척: 버튼 위에 아이템 선택 (진행 중이면 취소)
      if (def.id === 'ping') Input.pingDown = true; // 길게 누르기 = 모여
    });
    b.addEventListener('pointermove', (e) => { if (e.pointerId === b._lp) lookMove(e); });
    const up = (e) => {
      b.classList.remove('down'); if (def.id === 'ping') Input.pingDown = false;
      if (e.pointerId === b._lp) { b._lp = null; lookEnd(e); }
      if (hold === 'fire' && e.pointerId === fireLookId) { Input.fire = false; fireLookId = null; }
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  function syncLean() { for (const [id, s] of [['tb_leanL', -1], ['tb_leanR', 1]]) { const e = document.getElementById(id); if (e) e.classList.toggle('active', Input.touchLean === s); } }
  function resetToggles() { Input.aimToggle = false; Input.touchSprintBtn = false; Input.touchLean = 0; document.querySelectorAll('#tbtns .tbtn').forEach((b) => b.classList.remove('active', 'down')); }

  // ---------- 배치 편집기 ----------
  let draft = null, sel = null, drag = null, prevPaused = false;
  function openEditor() {
    measureSafe();
    draft = JSON.parse(JSON.stringify(SETTINGS.touchLayout || {}));
    prevPaused = G.paused; if (G.state === 'play') G.paused = true;
    releaseLock();
    $('layoutEditor').hidden = false; $('tbtns').style.visibility = 'hidden'; $('stick').style.visibility = 'hidden'; document.body.classList.add('editing');
    $('edGlobal').value = SETTINGS.btnScale; $('edGlobalVal').textContent = Math.round(SETTINGS.btnScale * 100) + '%';
    $('edStickFixed').checked = !!SETTINGS.stickFixed;
    renderEditor(); select(null);
  }
  function renderEditor() {
    const st = $('edStage'); st.innerHTML = '';
    for (const def of TOUCH_BTNS) {
      const el = document.createElement('div'); el.className = 'tbtn ed' + (def.cls ? ' ' + def.cls : '') + (def.kind === 'stick' ? ' stick' : ''); el.id = 'ed_' + def.id;
      if (def.icon) el.innerHTML = touchIcon(def.icon) + `<small class="ed-lbl">${def.label}</small>`; else el.textContent = def.label;   // 편집기: 그림 + 작은 이름
      el.dataset.id = def.id;
      styleBtn(el, def, place(def, draft));
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); select(def.id);
        const p = place(def, draft); drag = { id: def.id, dx: e.clientX - p.cx, dy: e.clientY - p.cy, pid: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        $('layoutEditor').classList.add('dragging');
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag || drag.pid !== e.pointerId) return;
        const cur = layoutOf(def, draft), size = def.size * (cur.s || 1) * SETTINGS.btnScale, W = window.innerWidth, H = window.innerHeight;
        const cx = clamp(e.clientX - drag.dx, SAFE.l + size / 2 + 4, W - SAFE.r - size / 2 - 4), cy = clamp(e.clientY - drag.dy, SAFE.t + size / 2 + 4, H - SAFE.b - size / 2 - 4);
        draft[def.id] = toLayout(cx, cy, cur.s || 1);
        styleBtn(el, def, place(def, draft)); checkOverlap();
      });
      const end = () => { drag = null; $('layoutEditor').classList.remove('dragging'); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      st.appendChild(el);
    }
    for (const def of TOUCH_PANELS) {
      const el = document.createElement('div'); el.className = 'edpanel' + (def.btn ? ' hb' : ''); el.id = 'ed_' + def.id; el.dataset.id = def.id;
      el.textContent = def.label; stylePanelEd(el, def, placeRect(def, draft));
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); select(def.id);
        const p = placeRect(def, draft); drag = { id: def.id, dx: e.clientX - p.cx, dy: e.clientY - p.cy, pid: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        $('layoutEditor').classList.add('dragging');
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag || drag.pid !== e.pointerId) return;
        const s = placeRect(def, draft).s, w = def.w * s, h = def.h * s, W = window.innerWidth, H = window.innerHeight;
        const cx = clamp(e.clientX - drag.dx, SAFE.l + w / 2 + 2, W - SAFE.r - w / 2 - 2), cy = clamp(e.clientY - drag.dy, SAFE.t + h / 2 + 2, H - SAFE.b - h / 2 - 2);
        draft[def.id] = toLayout(cx, cy, s);
        stylePanelEd(el, def, placeRect(def, draft)); checkOverlap();
      });
      const end = () => { drag = null; $('layoutEditor').classList.remove('dragging'); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      st.appendChild(el);
    }
    checkOverlap();
  }
  function select(id) {
    sel = id;
    document.querySelectorAll('#edStage .tbtn, #edStage .edpanel').forEach((e) => e.classList.toggle('sel', e.dataset.id === id));
    const def = defOf(id);
    $('edName').textContent = def ? def.label + (def.kind === 'stick' ? ' 조이스틱' : def.w && !def.btn ? ' 창' : ' 버튼') : '버튼·창을 눌러 선택하세요';
    $('edSize').disabled = !def; $('edResetOne').disabled = !def;
    const s = def ? (def.w ? placeRect(def, draft).s : (layoutOf(def, draft).s || 1)) : 1;
    $('edSize').min = def && def.w && !def.btn ? 0.6 : 0.5; $('edSize').max = def && def.w && !def.btn ? 1.6 : 2;
    $('edSize').value = s; $('edSizeVal').textContent = Math.round(s * 100) + '%';
  }
  // 겹침 검사: 원-원(지름 기준), 사각형-사각형, 원-사각형
  function hits(a, b) {
    if (!a.rect && !b.rect) return Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.size + b.size) / 2 * 0.92;
    if (a.rect && b.rect) return Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 - 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 - 2;
    const r = a.rect ? a : b, c = a.rect ? b : a, px = clamp(c.cx, r.cx - r.w / 2, r.cx + r.w / 2), py = clamp(c.cy, r.cy - r.h / 2, r.cy + r.h / 2);
    return Math.hypot(c.cx - px, c.cy - py) < c.size / 2 * 0.92;
  }
  function checkOverlap() {
    const ps = TOUCH_BTNS.concat(TOUCH_PANELS).map((d) => ({ d, p: placeAny(d, draft) }));
    const bad = new Set();
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (hits(ps[i].p, ps[j].p)) { bad.add(ps[i].d.id); bad.add(ps[j].d.id); }
    document.querySelectorAll('#edStage .tbtn, #edStage .edpanel').forEach((e) => e.classList.toggle('overlap', bad.has(e.dataset.id)));
    $('edWarn').textContent = bad.size ? `겹치는 항목 ${bad.size}개 — 빨간 테두리를 떼어 놓으세요` : '';
  }
  function setupEditor() {
    $('edSize').addEventListener('input', (e) => {
      if (!sel) return; const def = defOf(sel), v = parseFloat(e.target.value);
      const p = placeAny(def, draft); draft[sel] = toLayout(p.cx, p.cy, v);
      $('edSizeVal').textContent = Math.round(v * 100) + '%';
      styleAny($('ed_' + sel), def, placeAny(def, draft)); checkOverlap();
    });
    $('edGlobal').addEventListener('input', (e) => { SETTINGS.btnScale = parseFloat(e.target.value); $('edGlobalVal').textContent = Math.round(SETTINGS.btnScale * 100) + '%'; renderEditor(); select(sel); });
    $('edResetOne').addEventListener('click', () => { if (sel) { delete draft[sel]; renderEditor(); select(sel); } });
    $('edResetAll').addEventListener('click', () => { draft = {}; SETTINGS.btnScale = 1; $('edGlobal').value = 1; $('edGlobalVal').textContent = '100%'; renderEditor(); select(null); });
    $('edCancel').addEventListener('click', () => closeEditor(false));
    $('edSave').addEventListener('click', () => closeEditor(true));
    $('edStage').addEventListener('pointerdown', (e) => { if (e.target.id === 'edStage') select(null); });
  }
  function closeEditor(save) {
    if (save) { SETTINGS.touchLayout = draft; SETTINGS.stickFixed = $('edStickFixed').checked; saveSettings(); HUD.toast('버튼 배치를 저장했습니다', 'ok'); }
    else { const st = store.get('settings', {}); SETTINGS.btnScale = st.btnScale !== undefined ? st.btnScale : 1; }
    $('layoutEditor').hidden = true; $('tbtns').style.visibility = ''; $('stick').style.visibility = ''; document.body.classList.remove('editing'); G.paused = prevPaused && G.state === 'play' && !$('pausePanel').hidden;
    apply(); if (G.applySettings) G.applySettings('btnScale');
  }
  return { setup, apply, openEditor, setupEditor, resetToggles, place, placeRect, setIcon, dragLook, icon: touchIcon };
})();
function setupTouch() { Touch.setup(); Touch.setupEditor(); }
