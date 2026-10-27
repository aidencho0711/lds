// ============================================================
// 10_social.js — 친구 · 접속 표시 · 파티 (Supabase)
//  · 친구: DB(friendships)에 저장. 요청·수락·삭제는 서버 함수(friend_*)로만 (supabase/social.sql)
//  · 접속 표시·초대: 실시간 채널 'ld-lobby' 하나 (presence: 접속 중인 사람, broadcast: 받는 사람(to)을 적은 메시지)
//  · 파티: 채널 'ld-party-<id>'. 초대한 사람이 방장 → 방장만 초대·강퇴·모드·맵 변경·출격
//    - 방장이 상태(state)를 뿌리고, 파티원은 그 설정을 따라 로비를 그린다 (파티원 자기 설정은 따로 보관했다가 나가면 되돌림)
//    - 파티원이 사라지면(접속 끊김 5초) 방장이 뺀다. 방장이 사라지면 다음 순서 파티원이 방장
//    - 경기 시작·경기 중 연결 신호(WebRTC)·중계도 이 채널로 (10_net.js)
//  · 실시간 메시지는 무료 플랜 기준 프로젝트 전체 초당 100개 — 여기서는 상태가 바뀔 때만 보낸다
// ============================================================
const PARTY_MAX = 4;
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const Social = (() => {
  let ch = null, ok = false, friends = [], online = new Map(), invites = [], busy = false, pollT = null, statT = null, lastTrack = '', msgEl = null;
  const me = () => Cloud.uid;
  const sb = () => Cloud.client();
  const lvOf = (xp) => levelFromXp(xp || 0).lv;

  // ---------- 연결 ----------
  function start() {
    if (!sb() || !me() || typeof sb().channel !== 'function') return;
    stop(true);
    try { ch = sb().channel('ld-lobby', { config: { broadcast: { self: false }, presence: { key: me() } } }); } catch (e) { console.warn('실시간 채널 실패', e); ch = null; return; }
    ch.on('presence', { event: 'sync' }, () => { readPresence(); Party.onOnline(); render(); });
    ch.on('broadcast', { event: 'm' }, (m) => onMsg(m && m.payload));
    ch.subscribe((st) => { ok = st === 'SUBSCRIBED'; if (ok) { lastTrack = ''; track(); } render(); });
    refresh();
    clearInterval(pollT); pollT = setInterval(() => { if (G.state === 'lobby' && !document.hidden) refresh(); }, 30000);
    clearInterval(statT); statT = setInterval(() => { track(); Party.tick(); expireInvites(); }, 1000);
    render();
  }
  function stop(keepUi) {
    Party.leave(true);
    if (ch && sb()) { try { sb().removeChannel(ch); } catch (e) { /* */ } }
    ch = null; ok = false; friends = []; online.clear(); invites = []; lastTrack = '';
    clearInterval(pollT); clearInterval(statT);
    if (!keepUi) { $('friendPanel').hidden = true; render(); renderInvites(); }
  }
  function myStatus() {
    return { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv, st: G.state === 'lobby' || G.state === 'loading' && !G.netLoading ? (G.state === 'lobby' ? 'lobby' : 'game') : 'game', pid: Party.id(), pn: Party.size() };
  }
  // 상태가 바뀌었을 때만 presence 갱신 (초당 제한이 있다)
  function track(force) {
    if (!ch || !ok) return;
    const s = myStatus(), k = JSON.stringify([s.name, s.lv, s.st, s.pid, s.pn]);
    if (!force && k === lastTrack) return; lastTrack = k;
    ch.track(s).catch(() => { lastTrack = ''; });
  }
  function readPresence() {
    online.clear(); if (!ch) return;
    const st = ch.presenceState();
    for (const k in st) { const a = st[k]; if (a && a.length) online.set(k, a[a.length - 1]); }
  }
  // 받는 사람(to)이 정해진 메시지 — 로비 채널에 있는 모두가 받지만 to가 아니면 버린다
  function send(to, k, data) {
    if (!ch || !ok) return false;
    ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ to, k, from: { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv } }, data || {}) });
    return true;
  }
  function onMsg(m) {
    if (!m || m.to !== me() || !m.from) return;
    if (m.k === 'inv') {
      if (G.state !== 'lobby') { send(m.from.uid, 'invno', { why: 'busy' }); return; }
      if (Party.id() === m.pid) return;
      invites = invites.filter((v) => v.from.uid !== m.from.uid);
      invites.push({ from: m.from, pid: m.pid, t: Date.now() });
      Audio.init(); Audio.ui && Audio.ui();
      renderInvites(); render();
    } else if (m.k === 'invno') HUD.lobbyNote(`${m.from.name}님이 ${m.why === 'busy' ? '게임 중이라 초대를 받지 못했습니다' : m.why === 'full' ? '— 파티가 가득 찼습니다' : '초대를 거절했습니다'}`);
    else if (m.k === 'fr') { refresh(); HUD.lobbyNote(m.what === 'accepted' ? `${m.from.name}님과 친구가 되었습니다` : `${m.from.name}님이 친구 요청을 보냈습니다`); }
  }
  function expireInvites() { const n = invites.length; invites = invites.filter((v) => Date.now() - v.t < 45000); if (invites.length !== n) { renderInvites(); render(); } }

  // ---------- 친구 (DB) ----------
  async function refresh() {
    if (!sb() || !me()) return;
    try { const { data, error } = await sb().rpc('friend_list'); if (error) throw error; friends = data || []; render(); }
    catch (e) { setMsg(sqlHint(e), false); }
  }
  const sqlHint = (e) => { const m = String((e && (e.message || e.code)) || e); return /friend_list|function|does not exist|PGRST202/.test(m) ? '서버 설정 필요: supabase/social.sql을 SQL Editor에서 실행해 주세요' : Cloud.msgOf(e); };
  async function request(nameIn) {
    const nm = (nameIn || '').normalize('NFC').trim();
    const bad = Cloud.checkId(nm); if (bad) { setMsg(bad, false); return; }
    if (busy) return; busy = true; setMsg('요청 중…', true);
    try {
      const { data, error } = await sb().rpc('friend_request', { p_name: nm }); if (error) throw error;
      const M = { sent: `${nm}님에게 친구 요청을 보냈습니다`, accepted: `${nm}님과 친구가 되었습니다`, pending: '이미 요청을 보냈습니다 — 상대가 수락하면 친구가 됩니다', already: '이미 친구입니다', notfound: '그런 아이디가 없습니다', self: '자기 자신은 추가할 수 없습니다', full: '친구는 100명까지입니다', auth: '로그인이 필요합니다' };
      setMsg(M[data] || String(data), data === 'sent' || data === 'accepted' || data === 'already');
      await refresh();
      if (data === 'sent' || data === 'accepted') { const f = friends.find((x) => x.username.toLowerCase() === nm.toLowerCase()); if (f) send(f.id, 'fr', { what: data }); }
      if (data === 'sent' || data === 'accepted') $('friendId').value = '';
    } catch (e) { setMsg(sqlHint(e), false); }
    finally { busy = false; }
  }
  async function respond(f, yes) {
    try { const { error } = await sb().rpc('friend_respond', { p_other: f.id, p_accept: !!yes }); if (error) throw error; if (yes) send(f.id, 'fr', { what: 'accepted' }); await refresh(); setMsg(yes ? `${f.username}님과 친구가 되었습니다` : '요청을 거절했습니다', true); }
    catch (e) { setMsg(sqlHint(e), false); }
  }
  async function remove(f) {
    try { const { error } = await sb().rpc('friend_remove', { p_other: f.id }); if (error) throw error; await refresh(); setMsg(f.status === 'accepted' ? `${f.username}님을 친구에서 삭제했습니다` : '요청을 취소했습니다', true); }
    catch (e) { setMsg(sqlHint(e), false); }
  }

  // ---------- 화면 ----------
  function setMsg(t, good) { const m = $('friendMsg'); if (!m) return; m.textContent = t; m.className = 'acct-msg' + (good ? ' ok' : ' bad'); }
  const statusText = (o) => !o ? '오프라인' : o.st === 'game' ? '게임 중' : o.pid && o.pn > 1 ? `로비 · 파티 ${o.pn}/${PARTY_MAX}` : '로비';
  function badgeCount() { return friends.filter((f) => f.status === 'pending' && f.incoming).length + invites.length; }
  function render() {
    const btn = $('friendBtn'); if (!btn) return;
    btn.hidden = !Cloud.enabled;
    const n = badgeCount(), bd = $('friendBadge'); bd.hidden = !n; bd.textContent = n;
    btn.classList.toggle('on', !!Cloud.user);
    Party.render();
    const P = $('friendPanel'); if (!P || P.hidden) return;
    const box = $('friendList'); box.innerHTML = '';
    const sec = (title, list, row) => { if (!list.length) return; box.appendChild(el('div', 'eyebrow fr-sec', title)); for (const f of list) box.appendChild(row(f)); };
    const inc = friends.filter((f) => f.status === 'pending' && f.incoming), out = friends.filter((f) => f.status === 'pending' && !f.incoming), acc = friends.filter((f) => f.status === 'accepted');
    acc.sort((a, b) => (online.has(b.id) ? 1 : 0) - (online.has(a.id) ? 1 : 0) || a.username.localeCompare(b.username));
    sec('받은 요청', inc, (f) => {
      const r = el('div', 'fr-row'); r.appendChild(el('b', 'fr-name', f.username)); r.appendChild(el('span', 'fr-lv', 'Lv ' + lvOf(f.xp)));
      const a = el('button', 'btn amber sm', '수락'); a.type = 'button'; a.onclick = () => respond(f, true);
      const d = el('button', 'btn sm', '거절'); d.type = 'button'; d.onclick = () => respond(f, false);
      r.appendChild(a); r.appendChild(d); return r;
    });
    sec(`친구 ${acc.length}`, acc, (f) => {
      const o = online.get(f.id), r = el('div', 'fr-row' + (o ? ' on' : ''));
      r.appendChild(el('i', 'fr-dot' + (o ? (o.st === 'game' ? ' game' : ' on') : ''))); r.appendChild(el('b', 'fr-name', f.username));
      r.appendChild(el('span', 'fr-lv', 'Lv ' + (o && o.lv ? o.lv : lvOf(f.xp)))); r.appendChild(el('span', 'fr-st', statusText(o)));
      const inParty = Party.has(f.id);
      if (inParty) r.appendChild(el('span', 'fr-tag', '파티원'));
      else {
        const iv = el('button', 'btn amber sm', '초대'); iv.type = 'button';
        iv.disabled = !o || o.st === 'game' || !Party.canInvite();
        iv.title = !o ? '접속 중일 때만 초대할 수 있습니다' : o.st === 'game' ? '게임 중입니다' : !Party.canInvite() ? (Party.id() && !Party.isLeader() ? '방장만 초대할 수 있습니다' : '파티가 가득 찼습니다') : '파티에 초대';
        iv.onclick = () => Party.invite(f, o); r.appendChild(iv);
      }
      const rm = el('button', 'btn sm ghost', '삭제'); rm.type = 'button';
      rm.onclick = () => { if (rm.dataset.sure) remove(f); else { rm.dataset.sure = '1'; rm.textContent = '정말 삭제'; setTimeout(() => { rm.dataset.sure = ''; rm.textContent = '삭제'; }, 2500); } };
      r.appendChild(rm); return r;
    });
    sec('보낸 요청', out, (f) => {
      const r = el('div', 'fr-row'); r.appendChild(el('b', 'fr-name', f.username)); r.appendChild(el('span', 'fr-st', '수락 대기'));
      const c = el('button', 'btn sm ghost', '취소'); c.type = 'button'; c.onclick = () => remove(f); r.appendChild(c); return r;
    });
    if (!friends.length) box.appendChild(el('p', 'micro', '아직 친구가 없습니다. 위에 친구의 아이디를 넣고 요청을 보내세요. 상대가 수락하면 친구 목록에 나타나고, 접속 중이면 파티에 초대할 수 있습니다.'));
    $('friendConn').textContent = ok ? '' : '실시간 서버에 연결 중…';
  }
  // 초대 카드 (로비 위쪽)
  function renderInvites() {
    const box = $('inviteBox'); if (!box) return; box.innerHTML = '';
    for (const v of invites.slice(-2)) {
      const c = el('div', 'invite-card');
      c.appendChild(el('div', 'iv-t', `${v.from.name}님이 파티에 초대했습니다`));
      c.appendChild(el('div', 'micro', `Lv ${v.from.lv || '-'} · 수락하면 ${v.from.name}님이 방장인 파티에 들어갑니다`));
      const row = el('div', 'iv-b');
      const a = el('button', 'btn amber sm', '수락'); a.type = 'button'; a.onclick = () => { invites = invites.filter((x) => x !== v); renderInvites(); render(); Party.accept(v); };
      const d = el('button', 'btn sm', '거절'); d.type = 'button'; d.onclick = () => { invites = invites.filter((x) => x !== v); send(v.from.uid, 'invno', {}); renderInvites(); render(); };
      row.appendChild(a); row.appendChild(d); c.appendChild(row); box.appendChild(c);
    }
  }
  function openPanel() {
    if (!Cloud.user) { HUD.lobbyNote('친구·파티는 로그인한 뒤 사용할 수 있습니다'); Cloud.open(); return; }
    $('friendPanel').hidden = false; setMsg('', true); refresh(); render();
    setTimeout(() => { try { $('friendId').focus(); } catch (e) { /* */ } }, 60);
  }
  function setup() {
    const b = $('friendBtn'); if (!b) return;
    b.addEventListener('click', () => { Audio.init(); Audio.ui(); openPanel(); });
    $('friendClose').addEventListener('click', () => { $('friendPanel').hidden = true; });
    $('friendForm').addEventListener('submit', (e) => { e.preventDefault(); request($('friendId').value); });
    G.onAuth = (on) => { if (on) start(); else stop(); };
    render();
  }
  return { setup, start, stop, send, refresh, render, track, openPanel, get online() { return online; }, get friends() { return friends; }, get connected() { return ok; }, get invites() { return invites; } };
})();

const Party = (() => {
  let P = null, ch = null, chOk = false, own = null, joining = null, pushT = 0, lastShared = '', absent = new Map(), present = new Set();
  const SHARED = ['game', 'map', 'mode', 'squad', 'queue', 'time', 'difficulty', 'bots'];
  const me = () => Cloud.uid;
  const sb = () => Cloud.client();
  const isLeader = () => !!P && P.leader === me();
  const id = () => (P ? P.id : null);
  const size = () => (P ? P.members.length : 1);
  const has = (uid) => !!P && P.members.some((m) => m.uid === uid);
  const canInvite = () => !!Cloud.user && (!P || (isLeader() && size() < PARTY_MAX));
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  function memberInfo() { return { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv, outfit: SETTINGS.outfit, st: G.state === 'lobby' ? 'lobby' : 'game' }; }
  function shared() { const o = {}; for (const k of SHARED) o[k] = SETTINGS[k]; return o; }

  // ---------- 채널 ----------
  function open(pid, then) {
    close();
    ch = sb().channel('ld-party-' + pid, { config: { broadcast: { self: false }, presence: { key: me() } } });
    ch.on('broadcast', { event: 'm' }, (m) => onMsg(m && m.payload));
    ch.on('presence', { event: 'sync' }, onPresence);
    ch.subscribe((st) => {
      const was = chOk; chOk = st === 'SUBSCRIBED';
      if (chOk) { ch.track({ uid: me() }).catch(() => {}); if (!was && then) { const f = then; then = null; f(); } }
    });
  }
  function close() { if (ch && sb()) { try { sb().removeChannel(ch); } catch (e) { /* */ } } ch = null; chOk = false; present.clear(); absent.clear(); }
  function send(k, data) { if (!ch || !chOk) return false; ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ k, from: me() }, data || {}) }); return true; }

  // ---------- 만들기 · 초대 · 참가 ----------
  function create(then) {
    P = { id: uuid(), leader: me(), members: [memberInfo()], s: shared(), v: 1 };
    lastShared = JSON.stringify(P.s);
    open(P.id, then); Social.track(); renderAll();
  }
  function invite(f, o) {
    if (!Cloud.user) return;
    if (P && !isLeader()) { HUD.lobbyNote('방장만 초대할 수 있습니다'); return; }
    if (size() >= PARTY_MAX) { HUD.lobbyNote(`파티는 ${PARTY_MAX}명까지입니다`); return; }
    if (!o) { HUD.lobbyNote(`${f.username}님은 접속 중이 아닙니다`); return; }
    const go = () => { Social.send(f.id, 'inv', { pid: P.id }); HUD.lobbyNote(`${f.username}님에게 파티 초대를 보냈습니다`); };
    if (!P) create(go); else go();
  }
  function accept(v) {
    if (P) leave(true);
    joining = { pid: v.pid, leader: v.from, t: Date.now() };
    open(v.pid, () => send('hello', { m: memberInfo() }));
    HUD.lobbyNote(`${v.from.name}님의 파티에 들어가는 중…`);
  }
  function leave(quiet) {
    if (P) {
      send('bye', {});
      if (isLeader() && P.members.length > 1) { const next = P.members.find((m) => m.uid !== me()); if (next) send('lead', { uid: next.uid }); }
    }
    close();
    const was = !!P; P = null; joining = null;
    restoreOwn();
    if (was && !quiet) HUD.lobbyNote('파티에서 나왔습니다');
    Social.track(); renderAll();
  }
  function kick(uid) {
    if (!isLeader()) return;
    const m = P.members.find((x) => x.uid === uid); if (!m) return;
    send('kick', { uid }); P.members = P.members.filter((x) => x.uid !== uid); pushState(); renderAll();
    HUD.lobbyNote(`${m.name}님을 파티에서 내보냈습니다`);
  }
  // 파티원: 내 설정 보관 → 방장 설정 적용 / 나가면 복원
  function applyShared(s) {
    if (!s) return;
    if (!own) { own = {}; for (const k of SHARED) own[k] = SETTINGS[k]; }
    for (const k of SHARED) if (s[k] !== undefined) SETTINGS[k] = s[k];
  }
  function restoreOwn() { if (!own) return; for (const k of SHARED) SETTINGS[k] = own[k]; own = null; if (G.state === 'lobby') HUD.renderLobby(); }
  // 파티 인원보다 작은 팀 모드는 고를 수 없다 → 방장 쪽에서 자동으로 올린다
  function fitSquad() {
    if (!isLeader()) return;
    const n = size(), cur = TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo;
    if (cur.size < n) { const k = Object.keys(TEAM_MODES).find((key) => TEAM_MODES[key].size >= n); if (k) { SETTINGS.squad = k; saveSettings(); } }
  }
  function pushState() {
    if (!isLeader()) return;
    fitSquad(); P.s = shared(); P.v++; lastShared = JSON.stringify(P.s);
    send('state', { p: P }); pushT = Date.now();
  }

  // ---------- 수신 ----------
  function onMsg(m) {
    if (!m || m.from === me()) return;
    switch (m.k) {
      case 'hello': {
        if (!isLeader()) return;
        const idx = P.members.findIndex((x) => x.uid === m.m.uid);
        if (idx < 0 && P.members.length >= PARTY_MAX) { send('full', { to: m.m.uid }); return; }
        if (idx < 0) { P.members.push(m.m); HUD.lobbyNote(`${m.m.name}님이 파티에 들어왔습니다`); Audio.ui && Audio.ui(); }
        else P.members[idx] = Object.assign(P.members[idx], m.m);
        absent.delete(m.m.uid); pushState(); renderAll(); break;
      }
      case 'state': {
        const p = m.p; if (!p || !p.members) return;
        if (!p.members.some((x) => x.uid === me())) { if (P && P.id === p.id) { close(); P = null; restoreOwn(); HUD.lobbyNote('파티에서 빠졌습니다'); renderAll(); } return; }
        const first = !P;
        P = p; joining = null; applyShared(p.s);
        if (first) HUD.lobbyNote(`${(p.members.find((x) => x.uid === p.leader) || {}).name || '방장'}님의 파티에 들어왔습니다`);
        Social.track(); renderAll(); break;
      }
      case 'bye': {
        if (!P) return;
        const m0 = P.members.find((x) => x.uid === m.from);
        if (isLeader() && m0) { P.members = P.members.filter((x) => x.uid !== m.from); pushState(); HUD.lobbyNote(`${m0.name}님이 파티를 나갔습니다`); renderAll(); }
        if (Net.active()) Net.peerLeft(m.from);
        break;
      }
      case 'lead': { // 방장이 나가면서 다음 방장 지정
        if (!P) return;
        P.members = P.members.filter((x) => x.uid !== m.from);
        P.leader = m.uid; if (isLeader()) { HUD.lobbyNote('방장이 나가서 내가 방장이 되었습니다'); pushState(); }
        renderAll(); break;
      }
      case 'kick': if (m.uid === me()) { close(); P = null; restoreOwn(); HUD.lobbyNote('방장이 파티에서 내보냈습니다'); Social.track(); renderAll(); } break;
      case 'full': if (m.to === me()) { close(); P = null; joining = null; restoreOwn(); HUD.lobbyNote('파티가 가득 찼습니다'); renderAll(); } break;
      case 'start': if (P && m.cfg && m.cfg.humans.some((x) => x.uid === me())) Net.join(m.cfg); break;
      default: if (Net.onParty) Net.onParty(m);
    }
  }
  // 파티 채널 접속자 → 사라진 파티원 정리 (5초 유예), 방장이 사라지면 다음 파티원이 방장
  function onPresence() {
    if (!ch) return;
    const st = ch.presenceState(); present = new Set(Object.keys(st));
    if (!P) return;
    for (const m of P.members) { if (m.uid === me()) continue; if (present.has(m.uid)) absent.delete(m.uid); else if (!absent.has(m.uid)) absent.set(m.uid, Date.now()); }
  }
  function onOnline() { /* 로비 접속 목록이 바뀜: 파티 표시만 갱신 */ render(); }
  // 1초마다 (Social): 이탈 정리 · 방장 설정 변경 전파 · 내 상태 변경 알림 · 참가 시간 초과
  let lastMine = '';
  function tick() {
    if (joining && Date.now() - joining.t > 8000) { close(); joining = null; restoreOwn(); HUD.lobbyNote('파티를 찾을 수 없습니다 (방장이 나갔거나 연결이 끊김)'); renderAll(); }
    if (!P) return;
    const now = Date.now();
    for (const [uid, t] of absent) {
      if (now - t < 5000) continue;
      absent.delete(uid);
      const m = P.members.find((x) => x.uid === uid); if (!m) continue;
      if (uid === P.leader) { // 방장 연결 끊김 → 남은 순서대로 다음 방장
        P.members = P.members.filter((x) => x.uid !== uid);
        const next = P.members.find((x) => present.has(x.uid) || x.uid === me());
        if (next) P.leader = next.uid;
        HUD.lobbyNote(`방장 ${m.name}님의 연결이 끊겼습니다${isLeader() ? ' — 내가 방장이 되었습니다' : ''}`);
        if (isLeader()) pushState();
      } else if (isLeader()) { P.members = P.members.filter((x) => x.uid !== uid); HUD.lobbyNote(`${m.name}님의 연결이 끊겨 파티에서 뺐습니다`); pushState(); }
      if (Net.active()) Net.peerLeft(uid);
      renderAll();
    }
    if (isLeader()) {
      const sh = JSON.stringify(shared());
      if (sh !== lastShared || now - pushT > 15000) pushState();
    }
    const mi = memberInfo(), key = JSON.stringify([mi.lv, mi.st, mi.outfit, mi.name]);
    if (key !== lastMine) {
      lastMine = key;
      if (isLeader()) { const i = P.members.findIndex((x) => x.uid === me()); if (i >= 0) { P.members[i] = mi; pushState(); } }
      else send('hello', { m: mi });
      renderAll();
    }
  }

  // ---------- 로비 연동 ----------
  // 혼자면 null. 파티면 { leader, size, rankOk, lowNames }
  function lockInfo() {
    if (!P || P.members.length < 2) return null;
    const low = P.members.filter((m) => (m.lv || 1) < 3);
    return { leader: isLeader(), size: P.members.length, rankOk: !low.length, lowNames: low.map((m) => m.name) };
  }
  const settingsChanged = () => { if (isLeader()) pushState(); };
  function decoratePlay() {
    const L = lockInfo(); if (!L) return;
    const b = $('playBtn');
    if (!L.leader) { b.classList.add('wait'); b.querySelector('span').textContent = '방장 대기'; $('playSub').textContent = '방장이 출격하면 함께 시작합니다'; }
    else {
      const notReady = P.members.filter((m) => m.uid !== me() && m.st !== 'lobby');
      b.classList.toggle('wait', notReady.length > 0);
      if (notReady.length) $('playSub').textContent = `파티원 대기: ${notReady.map((m) => m.name).join(', ')} (게임 중)`;
    }
  }
  // 출격 (로비 출격 버튼). 파티가 아니면 false → 혼자 시작
  function tryStart() {
    const L = lockInfo(); if (!L) return false;
    if (!L.leader) { HUD.lobbyNote('방장이 출격하면 함께 시작합니다'); return true; }
    const notReady = P.members.filter((m) => m.uid !== me() && m.st !== 'lobby');
    if (notReady.length) { HUD.lobbyNote(`${notReady.map((m) => m.name).join(', ')}님이 아직 게임 중입니다`); return true; }
    if (SETTINGS.queue === 'ranked' && !isDmGame(SETTINGS.game) && !L.rankOk) { HUD.lobbyNote(`파티원 중 레벨 3 미만이 있어 랭크전을 할 수 없습니다 (${L.lowNames.join(', ')})`); return true; }
    const humans = P.members.map((m) => ({ uid: m.uid, name: m.name, outfit: m.outfit, lv: m.lv }));
    const cfg = Net.makeConfig(humans);
    send('start', { cfg });
    Net.join(cfg);
    return true;
  }
  // ---------- 화면: 파티 막대 ----------
  function render() {
    const bar = $('partyBar'); if (!bar) return;
    const show = !!Cloud.user && !!P && G.state === 'lobby';
    bar.hidden = !show; if (!show) return;
    bar.innerHTML = '';
    const hd = el('div', 'pb-head'); hd.appendChild(el('b', '', `파티 ${P.members.length}/${PARTY_MAX}`));
    const lv = el('button', 'btn sm ghost', '나가기'); lv.type = 'button'; lv.onclick = () => leave(); hd.appendChild(lv); bar.appendChild(hd);
    for (const m of P.members) {
      const o = Social.online.get(m.uid), r = el('div', 'pb-row' + (m.uid === P.leader ? ' lead' : '') + (m.uid === me() ? ' me' : ''));
      r.appendChild(el('i', 'pb-crown', m.uid === P.leader ? '♛' : ''));
      r.appendChild(el('b', 'pb-name', m.name + (m.uid === me() ? ' (나)' : '')));
      r.appendChild(el('span', 'pb-lv', 'Lv ' + (m.lv || 1)));
      r.appendChild(el('span', 'pb-st' + (m.st !== 'lobby' ? ' game' : ''), m.st !== 'lobby' ? '게임 중' : absent.has(m.uid) && m.uid !== me() ? '연결 확인 중' : '대기'));
      if (isLeader() && m.uid !== me()) { const k = el('button', 'btn sm ghost', '내보내기'); k.type = 'button'; k.onclick = () => kick(m.uid); r.appendChild(k); }
      void o; bar.appendChild(r);
    }
    if (isLeader() && P.members.length < PARTY_MAX) { const add = el('button', 'pb-add', '+ 친구 초대'); add.type = 'button'; add.onclick = () => Social.openPanel(); bar.appendChild(add); }
    else if (!isLeader()) bar.appendChild(el('p', 'micro', '모드·맵·출격은 방장이 정합니다'));
  }
  function renderAll() { render(); Social.render(); if (G.state === 'lobby') HUD.renderLobby(); }
  return { create, invite, accept, leave, kick, tryStart, lockInfo, settingsChanged, decoratePlay, render, tick, onOnline, send, id, size, has, canInvite, isLeader,
    get state() { return P; }, get present() { return present; }, members: () => (P ? P.members : []) };
})();
