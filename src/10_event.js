// ============================================================
// 10_event.js — 로비 상단 '이벤트': 다른 게임 홍보 · THE BACKROOMS 탈출 이벤트 (기기마다 1번)
//  · '백룸 들어가기' → 이 기기의 참가 코드 n 을 만들어 기억하고 새 탭으로 backrooms-theta.vercel.app/?from=ldr&n=..&r=(돌아올 주소)
//  · 백룸에서 엘리베이터로 탈출하면 그쪽(js/ldr.js)이 n 에 서명한 탈출 코드를 돌려준다:
//      이 창이 열려 있으면 postMessage 로 바로 · 아니면 탈출 화면의 '보상 받기' 링크로 ?brx=코드 를 달고 돌아옴
//  · 코드가 이 기기의 n 과 서명이 맞아야 인정(링크를 남에게 나눠 줘도 다른 기기에서는 안 됨) → '보상 받기' 로 골드 탄피 + 칭호 '백룸 탈출자'
//  · 받은 기록은 이 기기(localStorage)에 — 기기마다 1번. 칭호는 계정(STATS.eco.brx)에 남는다
//  · 서명은 두 게임이 같은 식(FNV-1a)으로 만든다 — 실제 돈이 오가지 않는 홍보 보상이라 가볍게 막는 정도
// ============================================================
const BR_EVENT = { url: 'https://backrooms-theta.vercel.app/', origin: 'https://backrooms-theta.vercel.app', gold: 1000, salt: 'ldr-backrooms-escape-v1', title: '백룸 탈출자' };
const EvBR = (() => {
  const K = 'evBR', el = (id) => document.getElementById(id);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  // 상태: st = new(아직) · go(백룸으로 감 · 탈출 기다림) · esc(탈출 확인 · 받기 전) · done(받음) / n = 이 기기의 참가 코드 / seen = 이벤트 창을 연 적 있음
  const get = () => { const s = store.get(K, null); return s && typeof s === 'object' && s.st ? s : { st: 'new', n: null, seen: 0 }; };
  const put = (s) => store.set(K, s);
  const fnv = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  const sign = (n) => n + '.' + fnv(n + '|escaped|' + BR_EVENT.salt) + fnv(BR_EVENT.salt + '|' + n);
  const local = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const okOrigin = (o) => o === BR_EVENT.origin || (local() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));   // 로컬 개발 때는 로컬 백룸도
  let art = null, msgT = null;

  // ---------- 백룸 배너 그림 (외부 이미지 없이 캔버스로: 노란 벽지 · 형광등 · 끝없는 복도) ----------
  function banner() {
    if (art) return art;
    const W = 720, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const vx = W * 0.62, vy = H * 0.47;   // 소실점
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
    // 복도 끝 문 (어두움)
    g.fillStyle = '#2b2510'; g.fillRect(vx - 16, vy - 22, 32, 48); g.fillStyle = 'rgba(255,240,170,0.25)'; g.fillRect(vx - 16, vy - 22, 32, 3);
    // 가장자리 어둡게
    const vg = g.createRadialGradient(vx, vy, 30, vx, vy, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,16,4,0.62)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // 제목 (살짝 어긋난 잔상)
    g.font = '800 54px "Saira Condensed", "Arial Narrow", sans-serif'; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(255,40,40,0.45)'; g.fillText('THE BACKROOMS', 31, 196); g.fillStyle = 'rgba(40,220,255,0.4)'; g.fillText('THE BACKROOMS', 25, 194);
    g.fillStyle = '#f7f0cf'; g.fillText('THE BACKROOMS', 28, 195);
    g.font = '600 17px "IBM Plex Sans KR", sans-serif'; g.fillStyle = 'rgba(247,240,207,0.9)'; g.fillText('엘리베이터를 찾아 탈출하라', 30, 222);
    return (art = c.toDataURL('image/jpeg', 0.86));
  }

  // ---------- 흐름 ----------
  // 백룸 열기: 참가 코드를 만들고 새 탭으로 (돌아올 주소 = 지금 이 게임 주소)
  function go() {
    const s = get(); if (s.st === 'done') return;
    if (!s.n) s.n = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 16);
    if (s.st === 'new') s.st = 'go'; s.goT = Date.now(); put(s);
    const u = new URL(BR_EVENT.url); u.searchParams.set('from', 'ldr'); u.searchParams.set('n', s.n); u.searchParams.set('r', location.origin + location.pathname);
    const w = window.open(u.toString(), '_blank');   // opener 를 남겨 둠 → 탈출하면 백룸 탭이 이 창에 바로 알림
    if (!w) location.href = u.toString();             // 팝업이 막혔으면 이 탭에서 이동 (돌아오기 링크로 확인)
    render(); dots();
  }
  // 탈출 코드 받음 (postMessage 또는 ?brx=)
  function accept(code) {
    const s = get();
    if (s.st === 'done') { flash('이 기기에서는 이미 백룸 탈출 보상을 받았습니다'); open(); return false; }
    if (!s.n || typeof code !== 'string' || code !== sign(s.n)) { flash('이 기기에서 시작한 이벤트 기록과 맞지 않습니다 — 이벤트 창에서 ‘백룸 들어가기’를 눌러 시작한 뒤 탈출해 주세요'); open(); return false; }
    if (s.st !== 'esc') { s.st = 'esc'; s.escT = Date.now(); put(s); }
    open(); flash('백룸 탈출 확인! 보상을 받으세요'); try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ }
    return true;
  }
  function claim() {
    const s = get(); if (s.st !== 'esc') return;
    s.st = 'done'; s.doneT = Date.now(); put(s);
    Eco.brClaim(BR_EVENT.gold);
    const m = el('evMsg'); if (m) m.hidden = true;
    render(true); dots();
  }

  // ---------- 화면 ----------
  function flash(msg) { const m = el('evMsg'); if (!m) return; m.textContent = msg; m.hidden = false; clearTimeout(msgT); msgT = setTimeout(() => { m.hidden = true; }, 6000); }
  const GOLD_SVG = '<svg viewBox="0 0 24 24" class="evb-cur"><circle cx="12" cy="12" r="9" fill="url(#g-gold)" stroke="#5a3a08" stroke-width="1.2"/><path d="M9 8h6M9 12h6M9 16h6" stroke="#5a3a08" stroke-width="1.4" stroke-linecap="round"/></svg>';
  function render(justClaimed) {
    const box = el('evBody'); if (!box) return;
    const s = get(); box.innerHTML = '';
    const card = h('div', 'evb' + (s.st === 'esc' ? ' ready' : s.st === 'done' ? ' done' : ''));
    const top = h('div', 'evb-art'); top.style.backgroundImage = `url(${banner()})`;
    top.appendChild(h('span', 'evb-tag', '콜라보 이벤트 · 다른 게임'));
    card.appendChild(top);
    const txt = h('div', 'evb-txt');
    txt.appendChild(h('b', 'evb-title', 'THE BACKROOMS 탈출 이벤트'));
    txt.appendChild(h('p', 'evb-desc', '끝없는 노란 방, <b>THE BACKROOMS</b> 에서 Level 3 어딘가의 엘리베이터를 🗝️ 열쇠로 열고 <b>탈출 1회</b>에 성공하면 이 게임에서 보상을 드립니다.'));
    const steps = h('ol', 'evb-steps');
    [['백룸 들어가기', '아래 버튼으로 새 탭에서 THE BACKROOMS 열기'], ['탈출 1회', '열쇠를 찾아 엘리베이터로 탈출'], ['탈출 확인', '이 창이 열려 있으면 자동 확인 · 아니면 탈출 화면의 ‘Last Drop Royale 보상 받기’'], ['보상 받기', '여기서 받기 — 기기마다 한 번']]
      .forEach(([a, b], i) => { const li = h('li', i < ({ new: 0, go: 1, esc: 3, done: 4 })[s.st] ? 'on' : '', `<b>${a}</b><span>${b}</span>`); steps.appendChild(li); });
    txt.appendChild(steps);
    const rw = h('div', 'evb-rw'); rw.appendChild(h('span', 'evb-rw-k', '보상'));
    rw.appendChild(h('span', 'evb-chip', `${GOLD_SVG}<b>${BR_EVENT.gold.toLocaleString()}</b> 골드 탄피`));
    rw.appendChild(h('span', 'evb-chip', `<span class="ttl sm ttl-br_escape">${BR_EVENT.title}</span> 칭호`));
    txt.appendChild(rw);
    const act = h('div', 'evb-act');
    const st = h('span', 'evb-st');
    if (s.st === 'new') { st.textContent = '아직 참여하지 않았습니다'; act.appendChild(btn('백룸 들어가기 ↗', 'amber', go)); }
    else if (s.st === 'go') { st.innerHTML = '<i class="evb-wait"></i>백룸에서 탈출을 기다리는 중…'; act.appendChild(btn('백룸 다시 열기 ↗', '', go)); }
    else if (s.st === 'esc') { st.textContent = '탈출 확인 완료!'; act.appendChild(btn('보상 받기', 'amber pulse', claim)); }
    else { st.textContent = justClaimed ? `받았습니다 — 골드 탄피 ${BR_EVENT.gold.toLocaleString()} · 칭호 ‘${BR_EVENT.title}’ (프로필에서 달 수 있음)` : '이 기기에서 받은 이벤트입니다'; const b = btn('받음 ✓', '', null); b.disabled = true; act.appendChild(b); act.appendChild(btn('백룸 또 하러 가기 ↗', 'ghost', () => window.open(BR_EVENT.url, '_blank'))); }
    act.prepend(st); txt.appendChild(act);
    if (justClaimed) { const p = h('div', 'evb-pop', `+${BR_EVENT.gold.toLocaleString()}`); card.appendChild(p); setTimeout(() => p.remove(), 1600); }
    card.appendChild(txt); box.appendChild(card);
    box.appendChild(h('p', 'micro evb-foot', '보상은 기기마다 한 번 받을 수 있습니다. 이 기기에서 ‘백룸 들어가기’로 시작한 탈출만 인정됩니다. 칭호는 로그인하면 계정에 저장됩니다.'));
  }
  function btn(label, cls, fn) { const b = h('button', 'btn ' + cls, label); b.type = 'button'; if (fn) b.addEventListener('click', () => { try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ } fn(); }); return b; }
  // 상단 버튼의 빨간 점: 아직 열어 보지 않았거나, 받을 보상이 있을 때
  function dots() { const s = get(), d = el('evTopDot'); if (d) d.hidden = !(s.st === 'esc' || (!s.seen && s.st !== 'done')); const b = el('evTopBtn'); if (b) b.classList.toggle('ready', s.st === 'esc'); }
  function open() { const s = get(); if (!s.seen) { s.seen = 1; put(s); } render(); el('evPanel').hidden = false; dots(); }
  function close() { el('evPanel').hidden = true; }

  // ---------- 시작 (로비 준비 때 한 번) ----------
  function init() {
    el('evTopBtn').addEventListener('click', () => { try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ } open(); });
    el('evClose').addEventListener('click', close);
    el('evPanel').addEventListener('click', (e) => { if (e.target === el('evPanel')) close(); });
    // 백룸 탭이 이 창에 바로 알림 (window.opener.postMessage)
    window.addEventListener('message', (e) => { const d = e.data; if (!okOrigin(e.origin) || !d || d.type !== 'ldr-br-escape') return; if (G.state === 'lobby') accept(String(d.code || '')); else pendingCode = String(d.code || ''); });
    // 탈출 화면의 링크로 돌아옴: ?brx=코드 → 확인하고 주소에서 지움
    try { const q = new URLSearchParams(location.search), code = q.get('brx'); if (code) { pendingCode = code; q.delete('brx'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } } catch (e) { /* 주소 못 읽으면 건너뜀 */ }
    dots();
  }
  let pendingCode = null;
  // 로비에 들어올 때마다: 경기 중에 온 탈출 알림 · 돌아오기 링크로 온 코드를 처리
  function lobby() { dots(); if (pendingCode) { const c = pendingCode; pendingCode = null; accept(c); } }
  return { init, lobby, open, banner, state: () => get().st, _sign: sign, _accept: accept };
})();
