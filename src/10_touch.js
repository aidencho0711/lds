// ============================================================
// 10_touch.js — 모바일 터치 조작
//  · 버튼 정의를 한곳에서 관리 → 게임 HUD와 배치 편집기가 같은 정의를 쓴다
//  · 위치는 '가까운 화면 모서리 + 거리(px)'로 저장 → 화면 비율이 달라도 모서리 기준으로 유지
//  · 버튼별 크기(50~200%), 전체 크기, 조이스틱 고정/유동 설정
//  · 화면 밖으로 나가지 않도록 항상 안전 영역 안으로 잘라 넣음
// ============================================================
const TOUCH_BTNS = [
  { id: 'fire', label: '사격', hold: 'fire', size: 84, cls: 'fire', def: { ax: 'r', ay: 'b', x: 66, y: 122 } },
  { id: 'aim', label: '조준', hold: 'aim', size: 54, def: { ax: 'r', ay: 'b', x: 147, y: 169 } },
  { id: 'jump', label: '점프', tap: 'jump', size: 54, def: { ax: 'r', ay: 'b', x: 43, y: 43 } },
  { id: 'crouch', label: '앉기', tap: 'crouch', size: 54, def: { ax: 'r', ay: 'b', x: 107, y: 43 } },
  { id: 'prone', label: '엎드', tap: 'prone', size: 54, def: { ax: 'r', ay: 'b', x: 171, y: 43 } },
  { id: 'reload', label: '장전', tap: 'reload', size: 54, def: { ax: 'r', ay: 'b', x: 147, y: 107 } },
  { id: 'swap', label: '무기', tap: 'weaponCycle', size: 54, def: { ax: 'r', ay: 'b', x: 63, y: 196 } },
  { id: 'interact', label: '줍기', tap: 'interact', size: 54, cls: 'interact', def: { ax: 'r', ay: 'b', x: 213, y: 143 } },
  { id: 'mode', label: '모드', tap: 'fireMode', size: 44, def: { ax: 'r', ay: 'b', x: 213, y: 205 } },
  { id: 'sprint', label: '달리기', hold: 'sprint', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 73 } },
  { id: 'heal', label: '회복', menu: 'heal', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 133 } },
  { id: 'throw', label: '투척', menu: 'throw', size: 54, def: { ax: 'l', ay: 't', x: 39, y: 193 } },
  { id: 'fire2', label: '사격', hold: 'fire', size: 54, cls: 'fire', def: { ax: 'l', ay: 't', x: 39, y: 253 } },
  { id: 'ping', label: '핑', tap: 'ping', size: 44, cls: 'ping', def: { ax: 'l', ay: 't', x: 39, y: 312 } },
  { id: 'seat', label: '좌석', tap: 'seat', size: 48, cls: 'seat', def: { ax: 'r', ay: 'b', x: 275, y: 143 } },
  { id: 'stick', label: '이동', kind: 'stick', size: 112, def: { ax: 'l', ay: 'b', x: 150, y: 120 } },
];
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

  function setup() {
    const box = $('tbtns');
    for (const def of TOUCH_BTNS) {
      if (def.kind === 'stick') continue;
      const b = document.createElement('button'); b.className = 'tbtn' + (def.cls ? ' ' + def.cls : ''); b.id = 'tb_' + def.id; b.textContent = def.label;
      if (def.hold) b.dataset.hold = def.hold; if (def.tap) b.dataset.tap = def.tap;
      box.appendChild(b); bindBtn(b, def);
    }
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
  function bindBtn(b, def) {
    const hold = def.hold, tap = def.tap;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); Audio.init(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('down');
      if (hold === 'fire') { Input.fire = true; fireLookId = e.pointerId; lookStart(e); }
      else if (hold === 'sprint') { Input.touchSprintBtn = !Input.touchSprintBtn; b.classList.toggle('active', Input.touchSprintBtn); }
      else if (hold === 'aim') { Input.aimToggle = !Input.aimToggle; b.classList.toggle('active', Input.aimToggle); }
      if (tap) Input.press(tap);
      if (def.menu) HUD.quick(def.menu, b); // 회복·투척: 버튼 위에 아이템 선택 (진행 중이면 취소)
      if (def.id === 'ping') Input.pingDown = true; // 길게 누르기 = 모여
    });
    b.addEventListener('pointermove', (e) => {
      // 사격 버튼을 누른 채 끌면 조준점이 따라간다
      if (hold === 'fire' && e.pointerId === fireLookId) lookMove(e);
    });
    const up = (e) => { b.classList.remove('down'); if (def.id === 'ping') Input.pingDown = false; if (hold === 'fire' && e.pointerId === fireLookId) { Input.fire = false; fireLookId = null; lookEnd(e); } };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  function resetToggles() { Input.aimToggle = false; Input.touchSprintBtn = false; document.querySelectorAll('#tbtns .tbtn').forEach((b) => b.classList.remove('active', 'down')); }

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
      el.textContent = def.label; el.dataset.id = def.id;
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
  return { setup, apply, openEditor, setupEditor, resetToggles, place, placeRect };
})();
function setupTouch() { Touch.setup(); Touch.setupEditor(); }
