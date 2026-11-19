// ============================================================
// 10_chat.js — 문자: 파티원끼리(로비·경기 중 모두) · 경기 중인 나 ↔ 내 관전자 (v22)
//  · 파티 문자: 파티 채널('ld-party-<id>' — 경기 중에도 열려 있음, 10_social.js)로 {k:'chat'}
//    로비 = 파티 막대 아래 문자 줄·입력 · 경기 중 = 화면 왼쪽 문자 줄 (10초 뒤 사라짐, 입력창을 열면 다시 보임)
//  · 관전 문자: 관전 연결(WebRTC 데이터 채널, 10_watch.js)로 — 내 화면에 '👁 이름: …', 보는 쪽 화면에 내 답장
//  · 경기 중 입력: PC 는 Enter 로 열고 Enter 로 보냄(Esc 닫기) · 모바일은 왼쪽 위 💬 버튼 → 빠른 문구 또는 입력
//    받을 사람(파티원·관전자)이 있을 때만 💬 가 보인다 · 경기 중에 쓴 문자는 파티원과 내 관전자 모두에게 간다
//  · 80자 · 1초에 1개 · 10초에 5개까지 (실시간 서버 한도를 아끼고 도배를 막는다) · 받는 쪽도 한 사람이 10초에 8개를 넘기면 버린다
//  · 글자는 textContent 로만 넣는다 (HTML 로 해석하지 않음)
// ============================================================
const CHAT_QUICK = ['도와줘!', '적 발견!', '여기로 와', '기다려', '고마워', 'GG'];
const Chat = (() => {
  const MAXLEN = 80;
  let log = [], sent = [], boxOpen = false, lastKey = '', pbEl = null, pbKey = '';
  const rx = new Map();
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  // ---------- 글자 다듬기 · 도배 막기 ----------
  // 제어 문자(U+0000–001F · 007F–009F) · 폭 없는 문자(200B–200F) · 줄·방향 바꾸기 문자(2028–202E · 2060–2069) · BOM(FEFF) 은 지운다 — 글자 코드로 걸러 정규식에 특수 문자를 넣지 않음
  const badCh = (c) => c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x2069) || c === 0xfeff;
  const clean = (t) => { let s = ''; for (const ch of String(t == null ? '' : t)) if (!badCh(ch.codePointAt(0))) s += ch; return Array.from(s.replace(/\s+/g, ' ').trim()).slice(0, MAXLEN).join(''); };
  function allow(uid) {
    const t = Date.now(), a = (rx.get(uid) || []).filter((x) => t - x < 10000);
    if (a.length >= 8) { rx.set(uid, a); return false; }
    a.push(t); rx.set(uid, a); return true;
  }
  function wait() {
    const t = Date.now(); sent = sent.filter((x) => t - x < 10000);
    if (sent.length >= 5) return '잠시 뒤에 보내 주세요 (10초에 5개까지)';
    if (sent.length && t - sent[sent.length - 1] < 1000) return '조금 천천히 보내 주세요';
    return '';
  }
  const mark = () => { sent.push(Date.now()); };

  // ---------- 보내기 ----------
  const partyOn = () => !!Party.state && Party.size() > 1;
  const canOpen = () => G.state === 'play' && (partyOn() || Watch.viewerCount() > 0);
  // 내가 쓴 문자: 파티원(파티 채널) + 경기 중이면 내 관전자(관전 연결)
  function say(text) {
    const t = clean(text); if (!t) return false;
    const play = G.state === 'play', toParty = partyOn(), toWatch = play && Watch.viewerCount() > 0;
    if (!toParty && !toWatch) { sys('문자를 받을 파티원이나 관전자가 없습니다'); return false; }
    const w = wait(); if (w) { sys(w); return false; }
    mark();
    if (toParty) Party.send('chat', { n: Cloud.name, t });
    if (toWatch) Watch.sendChat(t);
    add({ kind: 'me', n: '나', t, pid: Party.id(), to: [toParty ? '파티' : '', toWatch ? '관전자' : ''].filter(Boolean).join('·') });
    return true;
  }
  // 파티 채널로 받은 문자 (Party.onMsg) — 지금 파티원이 보낸 것만
  function onParty(m) {
    if (!m || !m.from || !Party.has(m.from)) return;
    const t = clean(m.t); if (!t || !allow(m.from)) return;
    const mem = Party.members().find((x) => x.uid === m.from);
    add({ kind: 'p', n: (mem && mem.name) || clean(m.n) || '파티원', t, pid: Party.id() });
    try { Audio.ui(); } catch (e) { /* */ }
  }
  function sys(t) { const L = log[log.length - 1]; if (L && L.kind === 'sys' && L.t === t && Date.now() - L.at < 5000) return; add({ kind: 'sys', n: '', t, pid: Party.id() }); }   // 같은 안내를 연달아 쌓지 않음
  function add(e) { e.at = Date.now(); log.push(e); if (log.length > 60) log.shift(); render(); }

  // ---------- 그리기 ----------
  // 한 줄: kind p(파티) · w(관전자) · me(나) · sys(안내)
  function line(e) {
    const d = h('div', 'cl k-' + (e.kind || 'p'));
    if (e.kind !== 'sys') d.appendChild(h('b', '', (e.kind === 'w' ? '👁 ' : '') + (e.n || '?')));
    d.appendChild(document.createTextNode(e.t));
    if (e.kind === 'me' && e.to) d.appendChild(h('small', '', ' → ' + e.to));
    return d;
  }
  // 경기 화면: 10초 안의 줄만 (입력창을 열면 최근 8줄)
  function renderHud() {
    const box = $('chatLog'); if (!box) return;
    const t = Date.now(), small = window.innerHeight < 500, list = G.state !== 'play' ? [] : boxOpen ? log.slice(small ? -5 : -8) : log.filter((e) => t - e.at < 10000).slice(small ? -3 : -5);   // 휴대폰(가로 화면)은 줄 수를 줄인다
    const key = list.map((e) => e.at + e.t).join('|') + (boxOpen ? '1' : '0');
    if (key === lastKey) return; lastKey = key;
    box.innerHTML = ''; for (const e of list) box.appendChild(line(e));
    box.classList.toggle('open', boxOpen);
  }
  // 로비 파티 막대: 이 파티의 문자 (파티원·나) — 막대를 다시 그려도 입력하던 글자가 지워지지 않게 같은 요소를 계속 쓴다
  function partyEl() {
    if (!pbEl) {
      pbEl = h('div', 'pb-chat');
      const lg = h('div', 'chat-log'); lg.id = 'pbLog'; pbEl.appendChild(lg);
      const f = h('form', 'chat-form'); f.autocomplete = 'off';
      const i = h('input'); i.id = 'pbInput'; i.maxLength = MAXLEN; i.placeholder = '파티원에게 문자'; i.setAttribute('enterkeyhint', 'send');
      const b = h('button', 'btn amber sm', '보내기'); b.type = 'submit';
      f.append(i, b);
      f.addEventListener('submit', (e) => { e.preventDefault(); if (say(i.value)) i.value = ''; });
      i.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); i.blur(); } });
      pbEl.appendChild(f);
    }
    pbKey = ''; renderParty();
    return pbEl;
  }
  function renderParty() {
    if (!pbEl) return;
    const pid = Party.id(), list = log.filter((e) => e.pid && e.pid === pid && (e.kind === 'p' || e.kind === 'me' || e.kind === 'sys')).slice(-4);
    const key = pid + list.map((e) => e.at + e.t).join('|');
    if (key === pbKey) return; pbKey = key;
    const lg = pbEl.querySelector('#pbLog'); lg.innerHTML = '';
    if (!list.length) lg.appendChild(h('div', 'cl k-sys', '파티원끼리 문자를 주고받을 수 있습니다 (경기 중에도)'));
    for (const e of list) lg.appendChild(line(e));
    lg.scrollTop = lg.scrollHeight;
  }
  function render() { renderHud(); renderParty(); }

  // ---------- 경기 중 입력창 (#chatBox) ----------
  function openBox(focus = true) {
    if (!canOpen()) return false;
    boxOpen = true; $('chatBox').hidden = false; lastKey = ''; renderHud();
    if (focus) setTimeout(() => { try { $('chatInput').focus(); } catch (e) { /* */ } }, 0);
    return true;
  }
  function closeBox() {
    if (!boxOpen) return;
    boxOpen = false; $('chatBox').hidden = true;
    const i = $('chatInput'); try { i.blur(); } catch (e) { /* */ }
    lastKey = ''; renderHud();
  }
  const typing = () => !!document.activeElement && document.activeElement.id === 'chatInput';
  function tick() {
    const b = $('hbChat'), can = canOpen();
    if (b && b.hidden === can) b.hidden = !can;
    if (boxOpen && !can) closeBox();
    renderHud();
  }
  function setup() {
    const q = $('chatQuick');
    for (const t of CHAT_QUICK) { const b = h('button', '', t); b.type = 'button'; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = () => { if (say(t)) closeBox(); }; q.appendChild(b); }
    $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('chatInput'); if (!clean(i.value)) { closeBox(); return; } if (say(i.value)) { i.value = ''; closeBox(); } });
    $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeBox(); } });
    $('chatX').addEventListener('click', () => closeBox());
    for (const id of ['chatBox', 'hbChat']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());   // 화면 터치(시점 돌리기)로 넘어가지 않게
    $('hbChat').addEventListener('click', () => { Audio.ui(); if (boxOpen) closeBox(); else openBox(!IS_TOUCH); });   // 모바일은 빠른 문구부터 (자판은 입력칸을 누르면)
    setInterval(tick, 1000);
  }
  return { setup, say, onParty, add, sys, line, clean, allow, wait, mark, openBox, closeBox, typing, canOpen, partyEl, renderParty, get log() { return log; }, get open() { return boxOpen; } };
})();
