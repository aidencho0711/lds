// ============================================================
// 10_social.js — 친구 · 접속 표시 · 파티 (Supabase)
//  · 친구: DB(friendships)에 저장. 요청·수락·삭제는 서버 함수(friend_*)로만 (supabase/social.sql)
//  · 접속 표시·초대: 실시간 채널 'ld-lobby' 하나 (presence: 접속 중인 사람, broadcast: 받는 사람(to)을 적은 메시지)
//  · 파티: 채널 'ld-party-<id>'. 초대한 사람이 방장 → 방장만 초대·강퇴·모드·맵 변경·출격
//    - 방장이 상태(state)를 뿌리고, 파티원은 그 설정을 따라 로비를 그린다 (파티원 자기 설정은 따로 보관했다가 나가면 되돌림)
//    - 파티원이 사라지면(접속 끊김 5초) 방장이 뺀다. 방장이 사라지면 다음 순서 파티원이 방장
//    - 경기 시작·경기 중 연결 신호(WebRTC)·중계도 이 채널로 (10_net.js)
//  · 실시간 메시지는 무료 플랜 기준 프로젝트 전체 초당 100개 — 여기서는 상태가 바뀔 때만 보낸다
//  · v22 친구 관전(10_watch.js): 접속 표시에 pl(지금 경기 화면 = 관전할 수 있음) · 관전 신호(spec·spof·span·spno·spx)는 Watch 로 넘김
//  · v22 초대 예약: 게임 중인 친구에게 '초대 예약' → 내가 들고 있다가 그 친구가 로비로 돌아오면(접속 표시 'lobby') 초대를 보낸다
//    (30분 지나면 지움) · 친구에게는 rsv 로 알려 경기 중에 토스트 · 로비로 돌아와 받은 초대 카드에 '예약해 둔 초대'
//  · v22 파티 문자(10_chat.js): 파티 채널 {k:'chat'} — 로비 파티 막대·경기 중 화면 모두
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
    clearInterval(statT); statT = setInterval(() => { track(); Party.tick(); expireInvites(); checkRsv(); }, 1000);
    render();
  }
  function stop(keepUi) {
    Party.leave(true);
    if (ch && sb()) { try { sb().removeChannel(ch); } catch (e) { /* */ } }
    ch = null; ok = false; friends = []; online.clear(); invites = []; lastTrack = ''; rsv.clear(); rsvIn.clear(); rsvSent.clear();
    clearInterval(pollT); clearInterval(statT);
    if (!keepUi) { Watch.stopAll(); $('friendPanel').hidden = true; render(); renderInvites(); }
  }
  // pl: 지금 경기 화면(관전할 수 있음) — 결과 화면·불러오는 중은 0 · nv: 같이 하기 버전 (10_ver.js — 없으면 예전 화면)
  function myStatus() {
    return { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv, st: G.state === 'lobby' || G.state === 'loading' && !G.netLoading ? (G.state === 'lobby' ? 'lobby' : 'game') : 'game', pid: Party.id(), pn: Party.size(), pl: G.state === 'play' ? 1 : 0, nv: NET_VER };
  }
  // 상태가 바뀌었을 때만 presence 갱신 (초당 제한이 있다)
  function track(force) {
    if (!ch || !ok) return;
    const s = myStatus(), k = JSON.stringify([s.name, s.lv, s.st, s.pid, s.pn, s.pl]);
    if (!force && k === lastTrack) return; lastTrack = k;
    ch.track(s).catch(() => { lastTrack = ''; });
  }
  // 한 계정이 여러 곳(휴대폰·PC 탭)에 접속해 있으면 하나를 고른다: 이 화면과 게임 버전이 같은 접속 → 그중 로비에 있는 것 → 가장 늦게 알린 것
  //  (예전 버전 탭이 남아 있어도 같은 버전 접속으로 초대할 수 있게 — 10_ver.js)
  function readPresence() {
    online.clear(); if (!ch) return;
    const st = ch.presenceState();
    for (const k in st) {
      const a = (st[k] || []).filter(Boolean); if (!a.length) continue;
      const same = a.filter((x) => x.nv === NET_VER), L = same.length ? same : a, lb = L.filter((x) => x.st === 'lobby');
      online.set(k, (lb.length ? lb : L).pop());
    }
  }
  const isFriend = (uid) => friends.some((f) => f.id === uid && f.status === 'accepted');
  // 받는 사람(to)이 정해진 메시지 — 로비 채널에 있는 모두가 받지만 to가 아니면 버린다
  function send(to, k, data) {
    if (!ch || !ok) return false;
    ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ to, k, from: { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv } }, data || {}) });
    return true;
  }
  function onMsg(m) {
    if (!m || m.to !== me() || !m.from) return;
    if (m.k === 'spec' || m.k === 'spof' || m.k === 'span' || m.k === 'spno' || m.k === 'spx') { Watch.onLobby(m); return; }   // 친구 관전 신호 (10_watch.js)
    if (m.k === 'inv') {
      // pid 없는 초대 = 게임 버전 안내뿐 (10_ver.js) — 버전이 같으면 보낸 쪽이 이 계정의 다른 접속(예전 탭 등)을 보고 보낸 것 → 무시
      if (!m.pid && m.nv === NET_VER) return;
      // 게임 버전이 다름 (버전이 없으면 예전 화면): 친구가 보낸 것만 — 초대 카드는 안내만(수락 없음) · 내 쪽이 낮으면 새로고침 막대
      //  보낸 사람이 모르고 보낸 초대(pid 있음)면 알려 준다 — 버전 안내 초대(pid 없음)는 보낸 쪽이 이미 안내를 봤다(게임 중이어도 답하지 않음)
      const nv = m.nv !== NET_VER ? m.nv || 0 : undefined;
      if (nv !== undefined && !isFriend(m.from.uid)) return;
      if (G.state !== 'lobby') { if (m.pid) send(m.from.uid, 'invno', { why: 'busy' }); return; }
      if (m.pid && Party.id() === m.pid) return;
      if (nv !== undefined) { if (m.pid) send(m.from.uid, 'invno', { why: 'ver', nv: NET_VER }); if (Ver.mineOld(nv)) Ver.bar('old'); }
      const was = rsvIn.has(m.from.uid); rsvIn.delete(m.from.uid);
      invites = invites.filter((v) => v.from.uid !== m.from.uid);
      invites.push({ from: m.from, pid: m.pid, t: Date.now(), rsv: was, nv });
      Audio.init(); Audio.ui && Audio.ui();
      renderInvites(); render();
    } else if (m.k === 'invno') {
      // 예약해 둔 초대를 보냈는데 그새 다시 경기에 들어감 → 다시 예약 (조용히)
      const s = rsvSent.get(m.from.uid);
      if (m.why === 'busy' && s && Date.now() - s.t < 60000) { rsvSent.delete(m.from.uid); rsv.set(m.from.uid, { t: s.t0, name: m.from.name }); render(); return; }
      if (m.why === 'ver') { if (isFriend(m.from.uid)) Ver.tell(m.nv, m.from.name); return; }   // 게임 버전이 달라 초대를 받을 수 없음 (10_ver.js · 친구가 보낸 것만)
      HUD.lobbyNote(`${m.from.name}님이 ${m.why === 'busy' ? '게임 중이라 초대를 받지 못했습니다' : m.why === 'full' ? '— 파티가 가득 찼습니다' : '초대를 거절했습니다'}`);
    }
    else if (m.k === 'fr') { refresh(); HUD.lobbyNote(m.what === 'accepted' ? `${m.from.name}님과 친구가 되었습니다` : `${m.from.name}님이 친구 요청을 보냈습니다`); }
    else if (m.k === 'rsv') {   // 친구가 나에게 초대를 예약함 (나는 경기 중)
      if (!isFriend(m.from.uid)) return;
      rsvIn.set(m.from.uid, { from: m.from, t: Date.now() });
      const msg = `${m.from.name}님이 파티 초대를 예약했습니다 — 경기를 마치고 로비로 돌아가면 초대가 옵니다`;
      if (G.state === 'lobby') HUD.lobbyNote(msg); else HUD.toast(msg, 'info');
    } else if (m.k === 'rsvx') rsvIn.delete(m.from.uid);
    else if (m.k === 'rn') Cloud.refreshName();   // 운영자가 내 아이디를 바꿈 (10_dev.js) — 서버에서 다시 읽어 확인만
    else if (m.k === 'ban') Cloud.checkBan();     // v23 운영자가 내 계정을 밴함 (10_dev.js) — 서버에서 내 프로필을 다시 읽어 확인만 (밴이면 로그아웃 + 안내)
    else if (m.k === 'nt') Net.onLobby(m);        // v23 경기 이어하기: 나갔다 돌아온 사람과 방장 사이 신호 (10_net.js)
  }
  function expireInvites() { const n = invites.length; invites = invites.filter((v) => Date.now() - v.t < 45000); if (invites.length !== n) { renderInvites(); render(); } }

  // ---------- 초대 예약 (게임 중인 친구) ----------
  const RSV_MS = 30 * 60e3;
  const rsv = new Map();       // 친구 uid → { t, name }  내가 건 예약
  const rsvIn = new Map();     // 보낸 사람 uid → { from, t }  나에게 걸린 예약
  const rsvSent = new Map();   // 예약으로 막 보낸 초대 uid → { t, t0 } (그새 다시 경기에 들어가 거절되면 다시 예약)
  function reserve(f) {
    if (!Party.canInvite()) { HUD.lobbyNote(Party.id() && !Party.isLeader() ? '방장만 초대할 수 있습니다' : `파티는 ${PARTY_MAX}명까지입니다`); return; }
    rsv.set(f.id, { t: Date.now(), name: f.username });
    send(f.id, 'rsv', {});
    setMsg(`${f.username}님이 경기를 마치고 로비로 돌아오면 파티 초대를 보냅니다 (30분 동안)`, true);
    HUD.lobbyNote(`${f.username}님에게 파티 초대를 예약했습니다`);
    render();
  }
  function unreserve(f) {
    if (!rsv.delete(f.id)) return;
    send(f.id, 'rsvx', {});
    setMsg(`${f.username}님 초대 예약을 취소했습니다`, true);
    render();
  }
  // 1초마다: 예약한 친구가 로비로 돌아왔으면 초대를 보낸다
  function checkRsv() {
    if (!rsv.size) return;
    const t = Date.now(); let ch2 = false;
    for (const [uid, r] of [...rsv]) {
      const f = friends.find((x) => x.id === uid && x.status === 'accepted');
      if (t - r.t > RSV_MS || !f || Party.has(uid)) { rsv.delete(uid); ch2 = true; continue; }
      const o = online.get(uid); if (!o || o.st !== 'lobby') continue;
      rsv.delete(uid); ch2 = true;
      if (!Party.canInvite()) { HUD.lobbyNote(`${r.name}님이 로비로 돌아왔지만 지금은 초대할 수 없습니다 (방장만 · ${PARTY_MAX}명까지)`); continue; }
      if (o.nv !== NET_VER) { Party.invite(f, o); continue; }   // 게임 버전이 다름: 초대 대신 버전 안내만 (10_ver.js)
      rsvSent.set(uid, { t, t0: r.t });
      Party.invite(f, o);
      setTimeout(() => HUD.lobbyNote(`${r.name}님이 경기를 마쳐 예약한 파티 초대를 보냈습니다`), 700);   // 파티를 새로 만들면 초대 알림이 조금 늦게 뜨므로 그 뒤에
    }
    for (const [uid, s] of [...rsvSent]) if (t - s.t > 60000) rsvSent.delete(uid);
    if (ch2) render();
  }

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
  const statusText = (o, uid) => !o ? '오프라인' : (o.st === 'game' ? (rsv.has(uid) ? '게임 중 · 초대 예약됨' : '게임 중') : o.pid && o.pn > 1 ? `로비 · 파티 ${o.pn}/${PARTY_MAX}` : '로비') + (o.nv !== NET_VER ? ' · 버전 다름' : '');   // 버전 다름: 같이 할 수 없음 (10_ver.js)
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
      r.appendChild(el('span', 'fr-lv', 'Lv ' + (o && o.lv ? o.lv : lvOf(f.xp)))); r.appendChild(el('span', 'fr-st', statusText(o, f.id)));
      const inParty = Party.has(f.id);
      // 관전: 지금 경기 화면에 있는 친구 (새 버전만 pl 을 알린다)
      if (o && o.pl) { const w = el('button', 'btn sm', '관전'); w.type = 'button'; w.title = '친구의 경기 화면을 봅니다'; w.onclick = () => Watch.open(f.id, f.username); r.appendChild(w); }
      if (inParty) r.appendChild(el('span', 'fr-tag', '파티원'));
      else if (o && o.st === 'game') {
        // 게임 중: 초대 예약 — 로비로 돌아오면 그때 초대가 간다
        const R = rsv.has(f.id), iv = el('button', 'btn sm' + (R ? ' ghost' : ' amber'), R ? '예약 취소' : '초대 예약'); iv.type = 'button';
        iv.disabled = !R && !Party.canInvite();
        iv.title = R ? '예약한 초대를 취소합니다' : !Party.canInvite() ? (Party.id() && !Party.isLeader() ? '방장만 초대할 수 있습니다' : '파티가 가득 찼습니다') : '경기를 마치고 로비로 돌아오면 파티에 초대합니다';
        iv.onclick = () => (R ? unreserve(f) : reserve(f)); r.appendChild(iv);
      } else {
        const iv = el('button', 'btn amber sm', '초대'); iv.type = 'button';
        iv.disabled = !o || o.st === 'game' || !Party.canInvite();
        iv.title = !o ? '접속 중일 때만 초대할 수 있습니다' : o.st === 'game' ? '게임 중입니다' : !Party.canInvite() ? (Party.id() && !Party.isLeader() ? '방장만 초대할 수 있습니다' : '파티가 가득 찼습니다') : o.nv !== NET_VER ? `게임 버전이 달라 같이 할 수 없습니다 — ${Ver.mineOld(o.nv) ? '내 게임이 예전 버전이라 새로고침해야 합니다' : '친구가 새로고침해야 합니다'}` : '파티에 초대';
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
      if (v.nv !== undefined) {   // 게임 버전이 다름 (10_ver.js): 안내만 — 낮은 쪽이 새로고침해야 같이 할 수 있다
        const old = Ver.mineOld(v.nv), row = el('div', 'iv-b');
        c.appendChild(el('div', 'iv-t', `${v.from.name}님이 파티에 초대했지만 게임 버전이 달라요`));
        c.appendChild(el('div', 'micro', old ? '내 게임이 예전 버전이에요 — 새로고침한 뒤 다시 초대받으면 같이 할 수 있어요' : `${v.from.name}님의 게임이 예전 버전이에요 — ${v.from.name}님이 새로고침해야 같이 할 수 있어요`));
        // 새로고침 단추: 이어하기 창이 답을 기다리는 동안은 숨김 (그 경기를 놓칠 수 있다 — 답하면 다시 그림 · Ver.sync)
        if (old && !Resume.pending) { const r = el('button', 'btn amber sm', '새로고침'); r.type = 'button'; r.onclick = () => location.reload(); row.appendChild(r); }
        const d = el('button', 'btn sm', '닫기'); d.type = 'button'; d.onclick = () => { invites = invites.filter((x) => x !== v); renderInvites(); render(); };
        row.appendChild(d); c.appendChild(row); box.appendChild(c); continue;
      }
      c.appendChild(el('div', 'iv-t', v.rsv ? `${v.from.name}님이 예약해 둔 파티 초대가 왔습니다` : `${v.from.name}님이 파티에 초대했습니다`));
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
  return { setup, start, stop, send, refresh, render, renderInvites, track, openPanel, reserve, unreserve, msg: (t) => setMsg(t, false), get online() { return online; }, get friends() { return friends; }, get connected() { return ok; }, get invites() { return invites; }, get rsv() { return rsv; }, get rsvIn() { return rsvIn; } };
})();

const Party = (() => {
  let P = null, ch = null, chOk = false, own = null, joining = null, pushT = 0, lastShared = '', absent = new Map(), present = new Set(), silent = false;   // silent: 조용히 나가는 중 (leave(true)) — 로비의 내 퇴장 연출을 건너뛴다
  const SHARED = ['game', 'map', 'mode', 'squad', 'queue', 'time', 'difficulty', 'bots', 'online', 'arena'];   // online: 온라인 매칭 켬/끔 · arena: 데스매치 아레나 (방장이 정함)
  const me = () => Cloud.uid;
  const sb = () => Cloud.client();
  const isLeader = () => !!P && P.leader === me();
  const id = () => (P ? P.id : null);
  const size = () => (P ? P.members.length : 1);
  const has = (uid) => !!P && P.members.some((m) => m.uid === uid);
  const canInvite = () => !!Cloud.user && (!P || (isLeader() && size() < PARTY_MAX));
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  function memberInfo() { return { uid: me(), name: Cloud.name, lv: levelFromXp(STATS.xp).lv, hc: Rank.hcOk() ? 1 : 0, look: myLook(), st: G.state === 'lobby' ? 'lobby' : 'game', ent: typeof PartyFx !== 'undefined' ? PartyFx.mineList() : null, nv: NET_VER }; }   // ent: 파티 입장·퇴장 연출 (10_partyfx.js) · nv: 같이 하기 버전 (10_ver.js)
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
    // 게임 버전이 다름 (접속 표시 nv · 10_ver.js): 파티를 만들지 않고 바로 안내. 버전을 아는 화면에는 수락 없는 안내 카드가 뜨게 알림(pid 없음)
    //  버전 확인이 없는 예전 화면(nv 없음)에는 보내지 않는다 — 수락하면 파티에 들어오려다 막힘
    if (o.nv !== NET_VER) { if (o.nv) Social.send(f.id, 'inv', { nv: NET_VER }); Ver.tell(o.nv || 0, f.username); return; }
    const go = () => { Social.send(f.id, 'inv', { pid: P.id, nv: NET_VER }); HUD.lobbyNote(`${f.username}님에게 파티 초대를 보냈습니다`); };
    if (!P) create(go); else go();
  }
  function accept(v) {
    // 게임 버전이 다른 초대(안내 카드)는 수락할 수 없음 (10_ver.js) · 파티 번호(pid)가 없는 초대도 — 들어갈 파티가 없다 (버전 안내뿐)
    if (v.nv !== undefined || !v.pid) { if (v.nv !== undefined) Ver.tell(v.nv, v.from.name); return; }
    if (P) leave(true);
    joining = { pid: v.pid, leader: v.from, t: Date.now() };
    open(v.pid, () => send('hello', { m: memberInfo() }));
    HUD.lobbyNote(`${v.from.name}님의 파티에 들어가는 중…`);
  }
  function leave(quiet) {
    if (P) {
      if (isLeader()) MM.partyChanged();   // 파티째 매칭 중이면 취소
      send('bye', {});
      if (isLeader() && P.members.length > 1) { const next = P.members.find((m) => m.uid !== me()); if (next) send('lead', { uid: next.uid }); }
    }
    close(); MM.partyGone();
    const was = !!P; P = null; joining = null;
    silent = !!quiet;   // 다른 파티의 초대를 수락하느라 나가거나(accept) 로그아웃(Social.stop): 아래 화면 갱신에서 PartyFx 가 내 퇴장 연출을 건너뛴다 (10_partyfx.js team)
    try { restoreOwn(); if (was && !quiet) HUD.lobbyNote('파티에서 나왔습니다'); Social.track(); renderAll(); } finally { silent = false; }
  }
  // 게임 버전이 달라 파티에 들어가지 못함·나옴 (10_ver.js) — nv: 방장 버전 · name: 방장 이름
  function verOut(nv, name) { close(); P = null; joining = null; MM.partyGone(); restoreOwn(); Ver.tell(nv, name); Social.track(); renderAll(); }
  function kick(uid) {
    if (!isLeader()) return;
    const m = P.members.find((x) => x.uid === uid); if (!m) return;
    send('kick', { uid }); P.members = P.members.filter((x) => x.uid !== uid); MM.partyChanged(); pushState(); renderAll();
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
        if (idx < 0 && m.m.nv !== NET_VER) { send('ver', { to: m.m.uid, nv: NET_VER }); Ver.tell(m.m.nv, m.m.name); return; }   // 게임 버전이 다른 사람은 들이지 않음 (10_ver.js)
        if (idx < 0 && P.members.length >= PARTY_MAX) { send('full', { to: m.m.uid }); return; }
        if (idx < 0) { P.members.push(m.m); MM.partyChanged(); HUD.lobbyNote(`${m.m.name}님이 파티에 들어왔습니다`); Audio.ui && Audio.ui(); }
        else P.members[idx] = Object.assign(P.members[idx], m.m);
        absent.delete(m.m.uid); pushState(); renderAll(); break;
      }
      case 'state': {
        const p = m.p; if (!p || !p.members) return;
        if (!p.members.some((x) => x.uid === me())) { if (P && P.id === p.id) { close(); P = null; MM.partyGone(); restoreOwn(); HUD.lobbyNote('파티에서 빠졌습니다'); renderAll(); } return; }
        const ld = p.members.find((x) => x.uid === p.leader);
        if (ld && ld.uid !== me() && ld.nv !== NET_VER) { send('bye', {}); verOut(ld.nv, ld.name); return; }   // 방장과 게임 버전이 다름 (버전 확인이 없는 예전 방장 등) → 설정을 받기 전에 나감
        const first = !P;
        P = p; joining = null; applyShared(p.s);
        if (first) HUD.lobbyNote(`${(p.members.find((x) => x.uid === p.leader) || {}).name || '방장'}님의 파티에 들어왔습니다`);
        Social.track(); renderAll(); break;
      }
      case 'bye': {
        if (!P) return;
        const m0 = P.members.find((x) => x.uid === m.from);
        if (isLeader() && m0) { P.members = P.members.filter((x) => x.uid !== m.from); MM.partyChanged(); pushState(); HUD.lobbyNote(`${m0.name}님이 파티를 나갔습니다`); renderAll(); }
        if (Net.active()) Net.peerLeft(m.from);
        break;
      }
      case 'lead': { // 방장이 나가면서 다음 방장 지정
        if (!P) return;
        P.members = P.members.filter((x) => x.uid !== m.from);
        P.leader = m.uid; MM.partyGone(); if (isLeader()) { HUD.lobbyNote('방장이 나가서 내가 방장이 되었습니다'); pushState(); }
        renderAll(); break;
      }
      case 'kick': if (m.uid === me()) { close(); P = null; MM.partyGone(); restoreOwn(); HUD.lobbyNote('방장이 파티에서 내보냈습니다'); Social.track(); renderAll(); } break;
      case 'full': if (m.to === me()) { close(); P = null; joining = null; restoreOwn(); HUD.lobbyNote('파티가 가득 찼습니다'); renderAll(); } break;
      case 'ver': if (m.to === me()) verOut(m.nv, joining && joining.leader ? joining.leader.name : ''); break;   // 방장이 게임 버전이 달라 들이지 않음
      case 'start': if (P && m.cfg && m.cfg.humans.some((x) => x.uid === me())) { MM.partyGone(); Net.join(m.cfg); } break;
      case 'mm': if (P && m.from === P.leader) MM.onParty(m); break;   // 방장이 온라인 매칭 중 (10_mm.js)
      case 'chat': Chat.onParty(m); break;   // 파티 문자 (10_chat.js) — 로비·경기 중 모두
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
        MM.partyGone();
        HUD.lobbyNote(`방장 ${m.name}님의 연결이 끊겼습니다${isLeader() ? ' — 내가 방장이 되었습니다' : ''}`);
        if (isLeader()) pushState();
      } else if (isLeader()) { P.members = P.members.filter((x) => x.uid !== uid); MM.partyChanged(); HUD.lobbyNote(`${m.name}님의 연결이 끊겨 파티에서 뺐습니다`); pushState(); }
      if (Net.active()) Net.peerLeft(uid);
      renderAll();
    }
    if (isLeader()) {
      const sh = JSON.stringify(shared());
      if (sh !== lastShared || now - pushT > 15000) pushState();
    }
    const mi = memberInfo(), key = JSON.stringify([mi.lv, mi.hc, mi.st, mi.look, mi.name, mi.ent]);
    if (key !== lastMine) {
      lastMine = key;
      if (isLeader()) { const i = P.members.findIndex((x) => x.uid === me()); if (i >= 0) { P.members[i] = mi; pushState(); } }
      else send('hello', { m: mi });
      renderAll();
    }
  }

  // ---------- 로비 연동 ----------
  // 혼자면 null. 파티면 { leader, size, rankOk, lowNames, hcOk, hcLow } — hcOk: 모두 하드코어 자격(일반 랭크 최고 다이아 4 이상)
  function lockInfo() {
    if (!P || P.members.length < 2) return null;
    const low = P.members.filter((m) => (m.lv || 1) < 3);
    const hcLow = P.members.filter((m) => m.uid === me() ? !Rank.hcOk() : !m.hc);
    return { leader: isLeader(), size: P.members.length, rankOk: !low.length, lowNames: low.map((m) => m.name), hcOk: !hcLow.length, hcLow: hcLow.map((m) => m.name) };
  }
  const settingsChanged = () => { if (isLeader()) pushState(); };
  function decoratePlay() {
    const L = lockInfo(); if (!L) return;
    const b = $('playBtn');
    if (!L.leader) { b.classList.add('wait'); b.querySelector('span').textContent = MM.party ? '방장 매칭 중' : '방장 대기'; $('playSub').textContent = MM.party ? '방장이 온라인 매칭 중입니다 — 경기가 잡히면 함께 시작합니다' : '방장이 출격하면 함께 시작합니다'; }
    else {
      const notReady = P.members.filter((m) => m.uid !== me() && m.st !== 'lobby');
      b.classList.toggle('wait', notReady.length > 0);
      if (notReady.length) $('playSub').textContent = `파티원 대기: ${notReady.map((m) => m.name).join(', ')} (게임 중)`;
    }
  }
  // 출격 (로비 출격 버튼). 파티가 아니면 false → 혼자 시작
  //  온라인 매칭이 켜져 있으면 파티째 줄 서기 (10_mm.js) · noMM: 매칭 없이 파티원끼리 바로 (AI로 바로 시작 · 매칭 서버 연결 실패)
  function tryStart(noMM) {
    const L = lockInfo(); if (!L) return false;
    if (!L.leader) { HUD.lobbyNote(MM.party ? '방장이 온라인 매칭 중입니다' : '방장이 출격하면 함께 시작합니다'); return true; }
    if (MM.searching()) { MM.cancel('매칭을 취소했습니다'); return true; }
    const notReady = P.members.filter((m) => m.uid !== me() && m.st !== 'lobby');
    if (notReady.length) { HUD.lobbyNote(`${notReady.map((m) => m.name).join(', ')}님이 아직 게임 중입니다`); return true; }
    if (SETTINGS.queue !== 'normal' && !isDmGame(SETTINGS.game) && !L.rankOk) { HUD.lobbyNote(`파티원 중 레벨 3 미만이 있어 랭크전을 할 수 없습니다 (${L.lowNames.join(', ')})`); return true; }
    if (SETTINGS.queue === 'hardcore' && !isDmGame(SETTINGS.game) && !L.hcOk) { HUD.lobbyNote(`파티원 중 다이아 4를 찍어 보지 못한 사람이 있어 하드코어를 할 수 없습니다 (${L.hcLow.join(', ')})`); return true; }
    if (isDuel(SETTINGS.game) && P.members.length > dmTeamSize(SETTINGS.game) * 2) { HUD.lobbyNote(`${GAME_TYPES[SETTINGS.game].name}은 ${dmTeamSize(SETTINGS.game) * 2}명까지 할 수 있습니다 (지금 파티 ${P.members.length}명)`); return true; }
    const humans = P.members.map((m) => ({ uid: m.uid, name: m.name, look: m.look, lv: m.lv }));
    if (!noMM && MM.want(humans.length)) { MM.start(humans, true); return true; }
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
    // 파티원 줄만 다시 그린다 — 아래 문자 칸(10_chat.js)은 같은 요소를 계속 써서 입력하던 글자가 지워지지 않게
    let rows = bar.querySelector('.pb-rows');
    if (!rows) { bar.innerHTML = ''; rows = el('div', 'pb-rows'); bar.appendChild(rows); bar.appendChild(Chat.partyEl()); }
    rows.innerHTML = '';
    const hd = el('div', 'pb-head'); hd.appendChild(el('b', '', `파티 ${P.members.length}/${PARTY_MAX}`));
    const lv = el('button', 'btn sm ghost', '나가기'); lv.type = 'button'; lv.onclick = () => leave(); hd.appendChild(lv); rows.appendChild(hd);
    for (const m of P.members) {
      const o = Social.online.get(m.uid), r = el('div', 'pb-row' + (m.uid === P.leader ? ' lead' : '') + (m.uid === me() ? ' me' : ''));
      r.appendChild(el('i', 'pb-crown', m.uid === P.leader ? '♛' : ''));
      r.appendChild(el('b', 'pb-name', m.name + (m.uid === me() ? ' (나)' : '')));
      r.appendChild(el('span', 'pb-lv', 'Lv ' + (m.lv || 1)));
      r.appendChild(el('span', 'pb-st' + (m.st !== 'lobby' ? ' game' : ''), m.st !== 'lobby' ? '게임 중' : absent.has(m.uid) && m.uid !== me() ? '연결 확인 중' : '대기'));
      // 관전: 경기 화면에 있는 파티원 (내가 로비에 있을 때)
      if (m.uid !== me() && o && o.pl) { const w = el('button', 'btn sm', '관전'); w.type = 'button'; w.title = '파티원의 경기 화면을 봅니다'; w.onclick = () => Watch.open(m.uid, m.name); r.appendChild(w); }
      if (isLeader() && m.uid !== me()) { const k = el('button', 'btn sm ghost', '내보내기'); k.type = 'button'; k.onclick = () => kick(m.uid); r.appendChild(k); }
      rows.appendChild(r);
    }
    if (isLeader() && P.members.length < PARTY_MAX) { const add = el('button', 'pb-add', '+ 친구 초대'); add.type = 'button'; add.onclick = () => Social.openPanel(); rows.appendChild(add); }
    else if (!isLeader()) rows.appendChild(el('p', 'micro', '모드·맵·출격은 방장이 정합니다'));
    Chat.renderParty();
  }
  function renderAll() { render(); Social.render(); if (G.state === 'lobby') HUD.renderLobby(); }
  return { create, invite, accept, leave, kick, tryStart, lockInfo, settingsChanged, decoratePlay, render, tick, onOnline, send, id, size, has, canInvite, isLeader,
    get state() { return P; }, get present() { return present; }, get silent() { return silent; }, members: () => (P ? P.members : []), ownSet: () => own };   // ownSet: 파티원일 때 방장 설정에 가려 둔 내 설정 (10_cloud.js 가 내 설정으로 저장)
})();
