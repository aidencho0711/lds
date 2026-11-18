// ============================================================
// 10_net.js — 같이 하기(파티) 경기 동기화
//  구조: 방장 기기 = 서버 역할(별 모양 연결). 각자 자기 캐릭터는 자기 기기에서 움직이고 결과(상태)를 보낸다
//   · 방장: 봇·자기장·보급·데스매치 점수·빈 차량을 계산, 다른 파티원 상태를 모아 다시 나눠 준다
//   · 파티원: 내 캐릭터·내가 운전하는 차량·내가 던진 수류탄만 계산, 나머지는 받은 상태를 보간해서 그린다
//  연결: WebRTC 데이터 채널(기기끼리 직접). 신호(offer/answer/ICE)는 파티 실시간 채널로
//   · 온라인 매칭 경기(10_mm.js, cfg.mm)는 그 경기 전용 채널(ld-mm-*)로 — 파티원이 'hi'를 보내면 방장이 연결을 시작한다
//  방장 넘겨주기(v22): 방장이 나가거나(로비·창 닫기 — 다음 방장을 골라 알림) 연결이 끊겨도(20초) 남은 사람 중 한 명이
//   방장을 넘겨받아 봇·자기장·보급·빈 차량·점수를 이어서 계산하고, 다른 사람은 새 방장에게 다시 연결 → 경기는 계속
//   · 12초 안에 직접 연결이 안 되면(일부 모바일 망) 파티 채널로 중계 — 초당 5회로 줄여 보낸다
//     (Supabase 무료 플랜 실시간 메시지 한도가 프로젝트 전체 초당 100개라 직접 연결이 기본)
//  피해: 쏜 쪽이 맞힌 것을 판정 → 맞은 캐릭터의 주인 기기로 'hit' → 주인이 방어구 계산·기절·사망 처리 후 결과를 알림
//  아이템: 시작 아이템·차량은 같은 시드로 각자 생성(방장이 개수·위치 합계로 검증, 다르면 목록 전송), 이후 줍기·버리기는 사건으로
//  리콜(08_recall.js): 'rc' — 등록 요청은 방장에게, 방장이 확인해 승인을 모두에게. 되살리기는 그 캐릭터의 주인 기기
// ============================================================
const NET_VER = 2;   // v22: 2 = 데스매치 아레나(cfg.arena) — 버전이 다르면 매칭 대기열이 갈린다
const NET_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }].concat(CLOUD_CFG.turn || []);
const Net = (() => {
  let N = null;
  const now = () => performance.now() / 1000;
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const active = () => !!N;
  const isHost = () => !!N && N.host;
  const isGuest = () => !!N && !N.host;
  const mine = (c) => !N || !c || !c.net || c.net.mine;
  const ownerOf = (c) => (c && c.net ? c.net.owner : N ? N.cfg.host : null);

  // ---------- 경기 설정 (방장) ----------
  // opt.mm: 온라인 매칭 경기 번호 (10_mm.js) — humans[].g = 줄(파티) 번호: 같은 줄은 같은 팀, 다른 줄과는 팀이 되지 않는다
  function makeConfig(humans, opt) {
    opt = opt || {};
    const game = SETTINGS.game, dm = isDmGame(game), seed = (Math.random() * 2147483647) | 0, mm = !!opt.mm;
    const cfg = { v: NET_VER, mid: (Math.random() * 1e9).toString(36), host: Cloud.uid, game, dm, seed, humans,
      s: { map: SETTINGS.map, mode: SETTINGS.mode, squad: SETTINGS.squad, queue: SETTINGS.queue, time: SETTINGS.time, difficulty: SETTINGS.difficulty, bots: SETTINGS.bots } };
    if (mm) cfg.mm = opt.mm;
    const groups = new Map(); humans.forEach((h, i) => { const g = mm ? h.g || 0 : 0; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
    const gMax = Math.max(...[...groups.values()].map((l) => l.length));
    if (dm) {
      const duel = isDuel(game), ts = dmTeamSize(game);
      cfg.loadout = game === 'tdm' || duel ? DM.loadout(mulberry32(seed), DM.TDM_GUNS, null) : null;
      cfg.arena = arenaResolve(arenaPick(), mulberry32(seed ^ 0x2545f491));   // v22: 아레나 (무작위면 시드로 뽑음 → 모두 같은 곳)
      // 데스매치: 파티원은 모두 같은 팀(블루) · 대결: 파티원을 번갈아 양 팀으로 (1대1 = 서로 상대)
      // 온라인 매칭: 같은 줄(파티)은 같은 팀, 큰 줄부터 사람이 적은 팀에 (양 팀 인원을 고르게)
      let teamOf = null;
      if (mm) {
        const cnt = [0, 0]; teamOf = [];
        [...groups.values()].sort((a, b) => b.length - a.length).forEach((ix) => { let t = cnt[0] <= cnt[1] ? 0 : 1; if (cnt[t] + ix.length > ts) t = 1 - t; for (const i of ix) { const tt = cnt[t] < ts ? t : 1 - t; teamOf[i] = tt; cnt[tt]++; } });
      }
      const roster = humans.map((hm, i) => ({ id: i, team: teamOf ? teamOf[i] : duel ? i % 2 : 0, human: true, name: hm.name, look: hm.look, uid: hm.uid }));
      const nm = shuffled(BOT_NAMES, mulberry32(seed ^ 0x5bd1e995)), cnt = [0, 0]; for (const r of roster) cnt[r.team]++;
      let id = humans.length;
      for (const t of [0, 1]) while (cnt[t] < ts) { roster.push({ id, team: t, name: nm[id % nm.length], diff: BotSkin.pickDiff(false) }); id++; cnt[t]++; }
      cfg.roster = roster;
    } else {
      // 온라인 매칭: 대기열(일반·랭크·하드코어)은 각자 줄 서기 전에 자격을 확인했으므로 대기열 그대로
      cfg.hc = mm ? SETTINGS.queue === 'hardcore' : SETTINGS.queue === 'hardcore' && Rank.hcOk();
      cfg.ranked = mm ? SETTINGS.queue !== 'normal' : (SETTINGS.queue === 'ranked' || cfg.hc) && Rank.unlocked();
      const want = mm && opt.spec ? opt.spec.ts : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.duo).size;
      cfg.teamSize = mm ? Math.max(want, gMax) : Math.max(want, humans.length);
      cfg.nBots = cfg.ranked ? Rank.botCount(SETTINGS.map) : clamp(SETTINGS.bots, humans.length, mapMaxBots(SETTINGS.map));
      // 매칭: 사람 팀마다 빈자리(팀원 봇)를 채우고도 다른 팀이 하나 이상 있게
      if (mm) cfg.nBots = Math.min(mapMaxBots(SETTINGS.map), Math.max(cfg.nBots, groups.size * cfg.teamSize + cfg.teamSize - 1));
      cfg.bd = BotSkin.diffCodes(Math.max(0, cfg.nBots - humans.length + 1), cfg.ranked, cfg.hc);   // 봇 난이도(한 글자씩) — 파티원 기기도 봇 스킨을 같게 입힌다
      cfg.plane = { a: Math.random() * TAU, off: Math.random() * 2 - 1 };
    }
    return cfg;
  }

  function shuffled(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // ---------- 시작 (방장·파티원 공통) ----------
  function join(cfg) {
    if (!Cloud.uid || G.state === 'loading') return;
    if (N) close(true);
    if (G.state === 'play' || G.state === 'result') { $('resultPanel').hidden = true; disposeMatch(); G.state = 'lobby'; }
    // 이번 경기만 방장 설정 (저장하지 않음). 온라인 매칭은 모르는 사람의 설정이므로 끝나면 내 설정으로 되돌린다
    const own = cfg.mm ? Object.assign({ game: SETTINGS.game }, ...Object.keys(cfg.s).map((k) => ({ [k]: SETTINGS[k] }))) : null;
    for (const k in cfg.s) SETTINGS[k] = cfg.s[k];
    SETTINGS.game = cfg.game;
    const myIdx = cfg.humans.findIndex((h) => h.uid === Cloud.uid);
    N = { cfg, host: cfg.host === Cloud.uid, me: Cloud.uid, myIdx, peers: new Map(), quiet: 0, applying: 0, seq: 0, uidBase: (myIdx + 1) * 1e7, uidN: 0, own,
      items: new Map(), vehs: [], outB: [], tickT: 0, zoneT: 0, t0: now(), welcomed: false, ended: false, ready: false, hiT: 0, gone: new Set(), epoch: 0, mig: false, claimN: 0, claimT: 0, stats: { tx: 0, rx: 0 } };   // gone: 나간 사람 · epoch·mig: 방장 넘겨받은 횟수 · claim: 새 방장 알림
    G.net = N; G.netAuthority = () => !N || N.host;
    // 온라인 매칭: 이 경기 채널로 신호. 방장은 파티원이 '들어왔다(hi)'고 알릴 때 연결을 시작한다 (채널에 늦게 들어온 사람이 신호를 놓치지 않게)
    if (cfg.mm) MM.chOpen(cfg.mm, onMM, () => { if (N && !N.host) hi(); });
    if (N.host) { for (const hm of cfg.humans) if (hm.uid !== N.me) N.peers.set(hm.uid, newPeer(hm.uid, true, !!cfg.mm)); }
    else N.peers.set(cfg.host, newPeer(cfg.host, false));
    if (pendBuf) { const b = pendBuf; pendBuf = null; for (const m of b) if (m.from === cfg.host || N.host) onSig(m); }
    if (cfg.dm) DM.start(dmCfg(cfg)); else G.startMatchNet(cfg);
  }
  const viaMM = () => !!(N && N.cfg.mm);
  // 신호·중계 보내기: 온라인 매칭은 경기 채널, 파티는 파티 채널
  function bus(k, d) { return viaMM() ? MM.chSend(k, d) : Party.send(k, d); }
  function hi() { if (N && !N.host) { N.hiT = now(); bus('hi', { to: N.cfg.host }); } }
  // 경기 채널로 온 메시지 (나머지 sig·g·hi·host 는 파티 채널과 같이 onParty)
  function onMM(m) {
    if (!N || (m.to && m.to !== Cloud.uid)) return;
    if (m.k === 'bye') { peerLeft(m.from, m.next); return; }
    onParty(m);
  }
  // 파티원이 '연결해 주세요(hi)' → 방장이 offer (온라인 매칭 처음 · 방장을 넘겨받은 뒤)
  function onHi(m) {
    if (!N || !N.host) return;
    const p = N.peers.get(m.from);
    if (p && !p.open && !p.relay && (!p.pc || (p.offerT && now() - p.offerT > 5))) offer(p);
  }
  // 이번 경기만 쓴 방장 설정을 내 설정으로 되돌림 (온라인 매칭)
  function restoreOwn(n0) { if (n0 && n0.own) { Object.assign(SETTINGS, n0.own); n0.own = null; } }
  function dmCfg(cfg) {
    const host = cfg.host, me = Cloud.uid;
    const roster = cfg.roster.map((r) => { const o = Object.assign({}, r); if (r.human) o.net = charNet(r.uid); else if (host !== me) o.net = charNet(host); return o; });
    const mr = cfg.roster.find((r) => r.uid === me);
    return { type: cfg.game, seed: cfg.seed, arena: cfg.arena, roster, loadout: cfg.loadout, myId: mr ? mr.id : 0 };
  }
  // 배틀로얄 캐릭터의 net 정보
  function charNet(owner) { return { owner, mine: owner === Cloud.uid, buf: [], life: -1 }; }

  // ---------- 연결 ----------
  // defer: 연결은 나중에 (온라인 매칭 방장 — 상대의 'hi'를 받으면 offer)
  function newPeer(uid, offerer, defer) {
    const p = { uid, pc: null, r: null, u: null, open: false, relay: false, t0: now(), lastRx: now(), pend: [], oid: 0, offerT: 0, name: (N.cfg.humans.find((h) => h.uid === uid) || {}).name || '?' };
    if (!defer) makePc(p, offerer);
    return p;
  }
  // WebRTC 연결 만들기. oid = 연결 번호: 방장이 다시 시작(offer)하면 번호가 바뀌고, 받는 쪽도 새 연결로 바꾼다 · 지난 번호의 신호는 버림
  function makePc(p, offerer) {
    const uid = p.uid, oid = p.oid;
    try {
      const pc = p.pc = new RTCPeerConnection({ iceServers: NET_ICE });
      pc.onicecandidate = (e) => { if (e.candidate && p.pc === pc) sig(uid, { ice: e.candidate.toJSON ? e.candidate.toJSON() : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } }, oid); };
      pc.onconnectionstatechange = () => { if (p.pc === pc && pc.connectionState === 'failed' && !p.relay) toRelay(p, 'failed'); };
      if (offerer) {
        p.r = pc.createDataChannel('r', { ordered: true }); p.u = pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 });
        setupDc(p, p.r); setupDc(p, p.u);
        pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => { if (p.pc === pc) sig(uid, { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }, oid); }).catch((e) => { console.warn('offer', e); toRelay(p, 'offer'); });
      } else pc.ondatachannel = (e) => { if (p.pc !== pc) return; if (e.channel.label === 'r') p.r = e.channel; else p.u = e.channel; setupDc(p, e.channel); };
    } catch (e) { console.warn('WebRTC 사용 불가', e); p.relay = true; p.needHello = true; }
  }
  // 방장: (다시) 연결 시작
  function offer(p) { try { if (p.pc) p.pc.close(); } catch (e) { /* */ } p.oid++; p.offerT = now(); p.pend = []; p.r = p.u = null; makePc(p, true); }
  function setupDc(p, dc) {
    dc.onopen = () => { if (p.r && p.r.readyState === 'open') { p.open = true; if (p.relay) { p.relay = false; } hello(p); linkUp(p); } };
    dc.onmessage = (e) => recv(p, e.data);
    dc.onclose = () => { if (p.open) { p.open = false; if (N && !N.ended) toRelay(p, 'closed'); } };
  }
  function toRelay(p, why) { if (p.relay) return; p.relay = true; console.warn('중계 전환', p.uid, why); if (N && !N.ended) { HUD.toast(`${p.name}님과 직접 연결이 안 되어 서버 중계로 전환합니다 (움직임이 덜 부드러울 수 있음)`, 'warn'); hello(p); linkUp(p); } }
  // 연결이 생기면: 밀린 사건 전송, 방장은 인사를 받았던 파티원에게 현재 상태
  function linkUp(p) {
    if (p.q && p.q.length) { const q = p.q.splice(0); for (const m of q) sendTo(p, m, true); }
    if (N.host && p.helloSeen) welcome(p);
  }
  function sig(to, d, o) { bus('sig', { to, d, o: o || 0 }); }
  async function onSig(m) {
    if (!N) { (pendBuf || (pendBuf = [])).push(m); return; }
    const p = N.peers.get(m.from); if (!p) return;
    const d = m.d, o = m.o || 0;
    // 방장이 연결을 새로 시작함 → 나도 새 연결 (온라인 매칭: 내가 채널에 늦게 들어와 처음 offer 를 놓친 경우 등)
    if (!N.host && d.sdp && d.sdp.type === 'offer' && o !== p.oid) { try { if (p.pc) p.pc.close(); } catch (e) { /* */ } p.oid = o; p.pend = []; p.open = false; p.r = p.u = null; makePc(p, false); }
    if (o !== p.oid || !p.pc) return;   // 지난 연결의 신호
    const pc = p.pc;
    try {
      if (d.sdp) {
        await pc.setRemoteDescription(d.sdp);
        if (d.sdp.type === 'offer') { const a = await pc.createAnswer(); await pc.setLocalDescription(a); if (p.pc === pc) sig(m.from, { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }, o); }
        for (const c of p.pend.splice(0)) pc.addIceCandidate(c).catch(() => {});
      } else if (d.ice) { if (pc.remoteDescription) await pc.addIceCandidate(d.ice).catch(() => {}); else p.pend.push(d.ice); }
    } catch (e) { console.warn('신호 처리', e); }
  }
  let pendBuf = null;
  // 파티 채널로 온 메시지: 신호(sig) · 중계(g)
  function onParty(m) {
    if (m.to && m.to !== Cloud.uid) return;
    if (m.k === 'sig') { if (!N) { (pendBuf || (pendBuf = [])).push(m); setTimeout(() => { pendBuf = null; }, 15000); return; } onSig(m); }
    else if (m.k === 'g' && N) { const p = N.peers.get(m.from); if (p) { if (!p.relay && !p.open) toRelay(p, 'peer-relay'); recv(p, m.d); } }
    else if (m.k === 'hi') onHi(m);
    else if (m.k === 'host') onHostClaim(m);
  }
  function sendTo(p, obj, reliable) {
    if (!p.open && !p.relay) { if (reliable) { (p.q || (p.q = [])).push(obj); if (p.q.length > 300) p.q.shift(); } return; } // 아직 연결 전: 중요한 것만 모아 둔다
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    N.stats.tx += s.length;
    if (p.open && !p.relay) {
      const dc = reliable || !p.u || p.u.readyState !== 'open' ? p.r : p.u;
      if (dc && dc.readyState === 'open') { if (dc.bufferedAmount < 2e6 || reliable) { try { dc.send(s); } catch (e) { console.warn(e); } } return; }
    }
    if (p.relay) bus('g', { to: p.uid, d: s });
  }
  // 큰 목록(아이템 등)은 나눠 보낸다
  function sendBig(p, kind, list, per = 400) {
    for (let i = 0; i < list.length; i += per) sendTo(p, { e: [{ k: kind, i, n: list.length, l: list.slice(i, i + per) }] }, true);
    if (!list.length) sendTo(p, { e: [{ k: kind, i: 0, n: 0, l: [] }] }, true);
  }
  // 파티원: 내 경기가 준비되고 연결되면 방장에게 인사 → 방장이 현재 상태(시간·자기장·검증값)를 보낸다
  function hello(p) { if (!N.ready) { p.needHello = true; return; } p.needHello = false; if (!N.host) sendTo(p, { e: [{ k: 'hello', uid: N.me, v: NET_VER }] }, true); }
  // 경기 화면이 준비됨 (startMatch / DM.start 끝)
  function ready() {
    if (!N) return; N.ready = true;
    for (const p of N.peers.values()) { if ((p.open || p.relay) && p.needHello) hello(p); if (p.needWelcome) welcome(p); }
    checkSum();
  }
  function checkSum() {
    if (!N || N.host || !N.hostSum || !N.baseSum || N.sumChecked) return;
    N.sumChecked = true;
    const a = N.hostSum, b = N.baseSum;
    if (a.n !== b.n || a.s !== b.s || a.vn !== b.vn || a.vs !== b.vs) { console.warn('월드 불일치 → 목록 요청', a, b); ev({ k: 'lootReq' }, N.cfg.host); }
  }

  // ---------- 사건(이벤트) 큐 ----------
  // to: 받을 사람 uid (없으면 모두). 파티원은 방장에게만 보내고, 방장이 받는 사람에게 넘긴다
  function ev(e, to) { if (!N) return; if (to && to === N.me) { handle(e, N.me); return; } e.to = to || undefined; N.outB.push(e); }
  function flush(force) {
    if (!N || !N.outB.length) return;
    const list = N.outB.splice(0);
    if (N.host) {
      for (const [uid, p] of N.peers) { const mine2 = list.filter((e) => (!e.to || e.to === uid) && e.from !== uid); if (mine2.length) { if (p.relay && !force) { (p.held || (p.held = [])).push(...mine2); continue; } sendTo(p, { e: mine2 }, true); } }
    } else { const p = N.peers.get(N.cfg.host); if (p) { if (p.relay && !force) { (p.held || (p.held = [])).push(...list); return; } sendTo(p, { e: list }, true); } }
  }

  // ---------- 받기 ----------
  function recv(p, data) {
    if (!N) return;
    let m; try { m = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
    p.lastRx = now(); N.stats.rx += (data && data.length) || 0;
    if (m.s) for (const a of m.s) applyChar(a, p);
    if (m.v) for (const a of m.v) applyVeh(a);
    if (m.w) applyWorld(m.w);
    if (m.e) for (const e of m.e) {
      e.from = e.from || p.uid;
      if (N.host && e.to && e.to !== N.me) { const tp = N.peers.get(e.to); if (!tp || tp.left) e.to = N.me; } // 떠난 사람 앞 사건은 방장이 대신 처리
      // 방장: 다른 파티원에게 넘길 것
      if (N.host && (!e.to || e.to !== N.me)) { const fw = Object.assign({}, e); N.outB.push(fw); }
      if (!e.to || e.to === N.me) handle(e, p.uid);
    }
  }
  // 번호 → 캐릭터 (CHARS 가 바뀌거나 늘면 다시 만든다 — 받은 상태마다 배열 전체를 훑지 않게)
  let cmA = null, cmN = -1, cmM = null;
  const charById = (id) => { if (cmA !== CHARS || cmN !== CHARS.length) { cmA = CHARS; cmN = CHARS.length; cmM = new Map(); for (const c of CHARS) cmM.set(c.id, c); } return cmM.get(id) || null; };
  function handle(e, from) {
    switch (e.k) {
      case 'hello': { if (N.host) { const p = N.peers.get(from); if (p) { p.helloSeen = true; welcome(p); } } break; }
      case 'welcome': applyWelcome(e); break;
      case 'hit': { const t = charById(e.v); if (!t || !mine(t)) return; const a = e.a >= 0 ? charById(e.a) : null; const d = applyDamage(t, e.d, e.p, a, e.c, e.h && e.h[0], e.h && e.h[1], e.h && e.h[2]); if (a && d > 0 && !mine(a)) ev({ k: 'dealt', a: a.id, d: r2(d) }, ownerOf(a)); break; }
      case 'own': { const c = charById(e.c); if (c && c.net) { c.net.owner = e.o; c.net.mine = e.o === N.me; } break; }
      case 'dealt': { const a = charById(e.a); if (a && mine(a)) a.damageDealt += e.d; break; }
      case 'kreq': { const t = charById(e.v); if (t && mine(t) && t.alive) killChar(t, e.a >= 0 ? charById(e.a) : null, e.c); break; }
      case 'knock': netKnock(e); break;
      case 'death': netDeath(e); break;
      case 'rev': netRevive(e); break;
      case 'shot': remoteShot(e); break;
      case 'throw': remoteThrow(e); break;
      case 'rkt': { const c = charById(e.c); if (c && !mine(c) && G.scene) { const p = new THREE.Vector3(e.p[0], e.p[1], e.p[2]), D = new THREE.Vector3(e.v[0], e.v[1], e.v[2]); spawnRocket(c, p, D, p, ITEMS.pzf, true); backblast(p.clone().addScaledVector(D, -1.1), D); Audio.rocket('launch', p, false); c.lastShotT = G.time; } break; }   // 판처파우스트: 보이기·소리만
      case 'pu': remotePunch(e); break;
      case 'rc': Recall.onNet(e, from); break;   // 리콜: 등록 요청(→방장)·승인(방장→모두)·단말기 작동·거절
      case 'gadd': { if (N.items.has(e.u)) break; N.applying++; spawnItem(G.scene, e.i, e.n, e.x, e.y, e.z, e.in || null, e.u); N.applying--; break; }
      case 'gdel': { const it = N.items.get(e.u); if (it && it.alive) { N.applying++; removeItem(it); N.applying--; } break; }
      case 'gcnt': { const it = N.items.get(e.u); if (it) it.count = e.n; break; }
      case 'vhit': { const v = N.vehs[e.n]; if (v && !vehRemote(v)) Veh.damage(v, e.d, e.a >= 0 ? charById(e.a) : null, e.c); break; }
      case 'vseat': { const v = N.vehs[e.n], who = charById(e.c); if (v && who) Veh.yieldSeat(v, who); break; }   // 파티원이 봇이 앉은 차에 타려 함 → 방장이 봇을 내리게 함
      case 'vboom': { const v = N.vehs[e.n]; if (v && vehRemote(v)) Veh.netBoom(v); break; }
      case 'zone': applyZone(e.z); break;
      case 'air': if (!N.host) Airdrop.launch(e.x, e.z, e.a, true); break;
      case 'score': if (G.dm) DM.applyScore(e.sc, e.over, e.win, e.t); break;
      case 'duel': if (G.dm) DM.applyDuel(e); break;   // 대결 라운드 진행 (방장이 정함)
      case 'loot': recvLoot(e); break;
      case 'lootReq': if (N.host) sendLoot(N.peers.get(from)); break;
      case 'vehs': recvVehs(e); break;
      case 'bye': peerLeft(from === N.me ? e.from : (e.uid || from), e.next); break;
      case 'isl': if (!N.host && G.island) Island.end(); break;   // 방장의 스타트 섬이 끝남 → 모두 수송기로
    }
  }

  // ---------- 방장 → 새로 붙은 파티원: 현재 상태 ----------
  function worldSum() {
    let n = 0, s = 0; for (const it of GROUND) if (it.alive) { n++; s += (it.x * 7 + it.z * 13) | 0; }
    let vn = 0, vs = 0; for (const v of N.vehs) { vn++; vs += (v.pos.x * 7 + v.pos.z * 13) | 0; }
    return { n, s, vn, vs };
  }
  function welcome(p) {
    if (!p) return;
    if (!N.ready) { p.needWelcome = true; return; }
    p.needWelcome = false;
    const w = { k: 'welcome', t: G.time, sum: G.dm ? null : N.baseSum, zone: G.dm ? null : zoneSnap(), sc: G.dm ? G.dm.score : null };
    sendTo(p, { e: [w] }, true);
    p.welcomed = true;
  }
  function applyWelcome(e) {
    N.welcomed = true;
    if (Math.abs(G.time - e.t) > 1) G.time = e.t;
    if (e.zone) applyZone(e.zone);
    if (e.sc && G.dm) DM.applyScore(e.sc, false, null, e.t);
    if (e.sum) { N.hostSum = e.sum; checkSum(); }
  }
  // 시작 아이템·차량 목록 (불일치할 때만)
  function sendLoot(p) {
    if (!p) return;
    const L = []; for (const it of GROUND) if (it.alive) L.push([it.u, it.id, it.count, r2(it.x), r2(it.y), r2(it.z), it.inst || 0]);
    sendBig(p, 'loot', L);
    const V = N.vehs.map((v) => [v.nid, v.type, r2(v.pos.x), r2(v.pos.z), r3(v.yaw)]);
    sendTo(p, { e: [{ k: 'vehs', l: V }] }, true);
  }
  let lootBuf = null;
  function recvLoot(e) {
    if (e.i === 0) { lootBuf = []; N.applying++; for (const it of GROUND.slice()) if (it.alive) removeItem(it); N.applying--; N.items.clear(); }
    if (!lootBuf) return;
    N.applying++;
    for (const a of e.l) spawnItem(G.scene, a[1], a[2], a[3], a[4], a[5], a[6] || null, a[0]);
    N.applying--;
    if (e.i + e.l.length >= e.n) lootBuf = null;
  }
  function recvVehs(e) {
    for (const v of Veh.list.slice()) Veh.remove(v);
    N.vehs = [];
    for (const a of e.l) { const v = Veh.make(a[1], a[2], a[3], a[4]); v.nid = a[0]; N.vehs[a[0]] = v; }
  }

  // ---------- 상태 인코딩 ----------
  const FL = { alive: 1, knocked: 2, aiming: 4, sprint: 8, ground: 16, water: 32, ready: 64, heal: 128, nade: 256, crouch: 512, prone: 1024, fall: 2048, chute: 4096, plane: 8192, pin: 16384, reload: 32768, leanL: 65536, leanR: 131072 };
  function encChar(c) {
    let f = 0;
    if (c.alive) f |= FL.alive; if (c.knocked) f |= FL.knocked; if (c.aiming) f |= FL.aiming; if (c.sprint) f |= FL.sprint; if (c.onGround) f |= FL.ground; if (c.inWater) f |= FL.water;
    if (c.combatFacing || c.fireHold || G.time - (c.lastShotT || -99) < 1.5) f |= FL.ready;
    if (c.heal) f |= FL.heal; if (c.throwMode || c.throwAnim > 0) f |= FL.nade; if (c.throwMode && c.throwMode.pin) f |= FL.pin; if (c.rl) f |= FL.reload;
    if (c.stance === 'crouch') f |= FL.crouch; else if (c.stance === 'prone') f |= FL.prone;
    if (c.lean < 0) f |= FL.leanL; else if (c.lean > 0) f |= FL.leanR;   // 기울이기
    if (c.mode === 'fall') f |= FL.fall; else if (c.mode === 'chute') f |= FL.chute; else if (c.mode === 'plane') f |= FL.plane;
    const w = c.weapon, a = w && w.att;
    const wk = w && c.equipT <= 0.25 ? [w.id, a.scope || '', a.muzzle || '', a.mag || '', a.grip || ''].join('.') : '';
    const g = c.inv.gear, gk = (g.helmet ? ITEMS[g.helmet.id].lvl : 0) * 100 + (g.vest ? ITEMS[g.vest.id].lvl : 0) * 10 + (g.bag ? ITEMS[g.bag.id].lvl : 0);
    const x = c.heal ? c.heal.id : c.throwMode ? c.throwMode.type : 0;
    return [c.id, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r3(c.yaw), r3(c.pitch), f, Math.round(c.hp * 10) / 10, wk, gk, c.veh && c.veh.nid !== undefined ? c.veh.nid : -1, c.seat || 0, c.life || 0, x, c.kills, c.knocks || 0];
  }
  function applyChar(a, p) {
    let c = charById(a[0]); if (!c) return;
    if (N.host && p && c.botized && c.origOwner === p.uid) unbotize(c, p);  // 잠깐 끊겼던 파티원이 돌아옴
    if (mine(c)) return;
    if (N.host && p && ownerOf(c) !== p.uid) return;                // 남의 캐릭터를 대신 보내는 것은 무시
    const n = c.net, t = now(), f = a[6];
    const life = a[12], snap = life !== n.life || !n.buf.length;
    n.life = life; n.lastA = a; n.rxT = t;
    const alive = !!(f & FL.alive);
    if (alive && !c.alive) { c.alive = true; c.anim.dead = 0; c.root.visible = !(f & FL.plane); c.hp = a[7]; }   // 리콜로 되살아나면 수송기 안(숨김)
    else if (!alive && c.alive && !n.deathSeen) { n.pendDead = t; }   // 사망 사건이 곧 온다 (못 받으면 아래에서 처리)
    c.knocked = !!(f & FL.knocked) && alive; c.aiming = !!(f & FL.aiming); c.sprint = !!(f & FL.sprint); c.onGround = !!(f & FL.ground); c.inWater = !!(f & FL.water);
    c.combatFacing = !!(f & FL.ready); if (f & FL.ready) c.lastShotT = Math.max(c.lastShotT || -99, G.time - 1.2);
    c.stance = f & FL.prone ? 'prone' : f & FL.crouch ? 'crouch' : 'stand'; c.lean = f & FL.leanL ? -1 : f & FL.leanR ? 1 : 0; c.leanCap = 1;
    const mode = f & FL.plane ? 'plane' : f & FL.chute ? 'chute' : f & FL.fall ? 'fall' : 'ground';
    if (c.mode !== mode) {
      const was = c.mode; c.mode = mode; if (mode !== 'plane') c.root.visible = true;
      if (N.host && c.human && was === 'plane' && (mode === 'fall' || mode === 'chute')) G.mateJump(c);   // 다른 기기 사람이 뛰어내림 → 그 팀원 봇도 따라 뜀
    }
    if (alive) c.hp = a[7];
    c.heal = f & FL.heal ? { id: a[13] || 'bandage', t: 1, total: 2 } : null;
    c.throwMode = f & FL.nade && a[13] ? { type: a[13], pin: !!(f & FL.pin) } : null;
    c.rl = null;
    // 무기·장비 (바뀔 때만 모델 교체)
    if (a[8] !== n.wk) {
      n.wk = a[8]; const inv = c.inv;
      inv.weapons = [null, null, null]; inv.cur = -1;
      if (a[8]) { const [id, sc, mz, mg, gp] = a[8].split('.'); if (ITEMS[id]) { const wi = newWeapon(id, ITEMS[id].mag); wi.att = { scope: sc || null, muzzle: mz || null, mag: mg || null, grip: gp || null }; inv.weapons[0] = wi; inv.cur = 0; } }
      c.equipT = 0; c.setVisibleGear();
    }
    if (a[9] !== n.gk) {
      n.gk = a[9]; const hl = Math.floor(a[9] / 100), vl = Math.floor(a[9] / 10) % 10, bl = a[9] % 10, g = c.inv.gear;
      g.helmet = hl ? { id: 'helm' + hl, dur: ITEMS['helm' + hl].dur } : null; g.vest = vl ? { id: 'vest' + vl, dur: ITEMS['vest' + vl].dur } : null; g.bag = bl ? { id: 'bag' + bl } : null;
      c.setVisibleGear();
    }
    if (p) c.kills = Math.max(c.kills, a[14] || 0);
    c.knocks = Math.max(c.knocks || 0, a[15] || 0);
    // 차량 좌석
    const vn = a[10], v = vn >= 0 ? N.vehs[vn] : null;
    if (v) { if (c.veh !== v || c.seat !== a[11]) { if (c.veh) Veh.exit(c, true, true); if (!v.seats[a[11]]) Veh.enter(c, v, a[11]); } }
    else if (c.veh) Veh.exit(c, true, true);
    // 위치 보간 버퍼
    const s = { t, x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5] };
    if (snap) { n.buf = [s]; c.pos.set(s.x, s.y, s.z); c.yaw = c.bodyYaw = s.yaw; c.pitch = s.pitch; c.vel.set(0, 0, 0); }
    else { n.buf.push(s); if (n.buf.length > 8) n.buf.shift(); }
  }
  // 받은 상태 사이를 보간 (직접 연결 0.1초, 중계 0.3초 늦게 그림)
  function updateProxy(c, dt) {
    const n = c.net, b = n.buf;
    if (c.pickT > 0) c.pickT = Math.max(0, c.pickT - dt); if (c.throwAnim > 0) c.throwAnim = Math.max(0, c.throwAnim - dt); if (c.equipT > 0) c.equipT -= dt;
    if (c.revive && c.revive.net) c.revive.t += dt;
    if (n.pendDead && now() - n.pendDead > 2 && c.alive) { n.pendDead = 0; netDeath({ v: c.id, a: -1, c: '', lost: true }); }
    if (!b.length || !c.alive && c.mode === 'ground' && c.anim.dead >= 1) return;
    const delay = linkRelay(ownerOf(c)) ? 0.32 : 0.11, rt = now() - delay;
    let x, y, z, yaw, pitch;
    const L = b[b.length - 1];
    if (b.length < 2) { x = L.x; y = L.y; z = L.z; yaw = L.yaw; pitch = L.pitch; }
    else if (rt >= L.t) { // 최근 것보다 늦음 → 짧게 외삽
      const P = b.length > 1 ? b[b.length - 2] : L, span = Math.max(1e-3, L.t - P.t), k = Math.min(rt - L.t, 0.3) / span;
      x = L.x + (L.x - P.x) * k; y = L.y + (L.y - P.y) * k * 0.5; z = L.z + (L.z - P.z) * k; yaw = L.yaw; pitch = L.pitch;
    } else {
      let i = b.length - 2; while (i > 0 && b[i].t > rt) i--;
      const A = b[i], B = b[i + 1] || A, k = clamp((rt - A.t) / Math.max(1e-3, B.t - A.t), 0, 1);
      x = lerp(A.x, B.x, k); y = lerp(A.y, B.y, k); z = lerp(A.z, B.z, k); yaw = A.yaw + angleDiff(A.yaw, B.yaw) * k; pitch = lerp(A.pitch, B.pitch, k);
    }
    if (c.veh) { c.yaw = yaw; c.pitch = pitch; return; }
    if (Math.hypot(x - c.pos.x, z - c.pos.z) > 12) c.pos.set(x, y, z);
    const vx = (x - c.pos.x) / Math.max(dt, 1e-3), vy = (y - c.pos.y) / Math.max(dt, 1e-3), vz = (z - c.pos.z) / Math.max(dt, 1e-3);
    const sm = clamp(dt * 12, 0, 1);
    c.vel.x = lerp(c.vel.x, clamp(vx, -60, 60), sm); c.vel.y = lerp(c.vel.y, clamp(vy, -60, 60), sm); c.vel.z = lerp(c.vel.z, clamp(vz, -60, 60), sm);
    c.pos.set(x, y, z); c.yaw = yaw; c.pitch = pitch;
    c.airT = c.onGround ? 0 : (c.airT || 0) + dt;
    if (c.mode === 'fall' || c.mode === 'chute') { c.bodyYaw = c.yaw; c.root.position.copy(c.pos); c.root.rotation.y = c.bodyYaw; }
  }
  const linkRelay = (uid) => { if (!N) return false; const p = N.peers.get(N.host ? uid : N.cfg.host); return !!p && p.relay; };

  // ---------- 차량 ----------
  function indexVehicles() { if (!N) return; N.vehs = Veh.list.slice(); N.vehs.forEach((v, i) => { v.nid = i; }); }
  function vehOwner(v) { return v.seats[0] ? ownerOf(v.seats[0]) : N.cfg.host; }
  function vehRemote(v) { return !!N && vehOwner(v) !== N.me; }
  function encVeh(v) { return [v.nid, r2(v.pos.x), r2(v.pos.y), r2(v.pos.z), r3(v.yaw), r3(v.pitch), r3(v.roll), r3(v.lean || 0), r2(v.vx), r2(v.vy), r2(v.vz), r2(v.f), r3(v.steer), Math.round(v.hp), (v.dead ? 1 : 0) | (v.burnT > 0 ? 2 : 0) | (v.onGround ? 4 : 0), r2(v.ctrl.throttle || 0)]; }
  function applyVeh(a) {
    const v = N.vehs[a[0]]; if (!v || !vehRemote(v)) return;
    const vb = v.netBuf || (v.netBuf = []), t = now();
    vb.push({ t, x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5], roll: a[6], lean: a[7] }); if (vb.length > 8) vb.shift();
    v.vx = a[8]; v.vy = a[9]; v.vz = a[10]; v.f = a[11]; v.steer = a[12]; v.hp = a[13]; v.ctrl.throttle = a[15]; v.onGround = !!(a[14] & 4); v.awake = true; v.netRxT = t;
    const dead = !!(a[14] & 1);
    if (dead && !v.dead) { v.dead = true; v.deadT = 0; if (v.T.animal) for (const r of Veh.riders(v)) if (mine(r)) Veh.exit(r, false, true); }
    v.burnT = a[14] & 2 ? Math.max(v.burnT, 0.5) : 0;
  }
  function vehInterp(v, dt) {
    const b = v.netBuf; if (!b || !b.length) return;
    const rt = now() - 0.11, L = b[b.length - 1];
    let s = L;
    if (rt < L.t && b.length > 1) { let i = b.length - 2; while (i > 0 && b[i].t > rt) i--; const A = b[i], B = b[i + 1] || A, k = clamp((rt - A.t) / Math.max(1e-3, B.t - A.t), 0, 1); s = { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), z: lerp(A.z, B.z, k), yaw: A.yaw + angleDiff(A.yaw, B.yaw) * k, pitch: lerp(A.pitch, B.pitch, k), roll: lerp(A.roll, B.roll, k), lean: lerp(A.lean, B.lean, k) }; }
    else if (rt >= L.t) { const k = Math.min(rt - L.t, 0.25); s = Object.assign({}, L, { x: L.x + v.vx * k, z: L.z + v.vz * k }); }
    v.pos.set(s.x, s.y, s.z); v.yaw = s.yaw; v.pitch = s.pitch; v.roll = s.roll; v.lean = s.lean;
    v.wheelRot += v.f * dt / v.P.wr;
    if (now() - (v.netRxT || 0) > 1.5 && Math.hypot(v.vx, v.vz) < 0.2) v.awake = false;
  }
  function vehHit(v, dmg, attacker, cause) { ev({ k: 'vhit', n: v.nid, d: r2(dmg), a: attacker ? attacker.id : -1, c: cause }, vehOwner(v)); }

  // ---------- 피해 · 기절 · 사망 · 부활 ----------
  // applyDamage(남의 캐릭터) → 주인에게 보냄. 내 화면에는 바로 맞힘 표시
  function remoteHit(t, dmg, part, attacker, cause, hx, hy, hz) {
    ev({ k: 'hit', v: t.id, d: r2(dmg), p: part, a: attacker ? attacker.id : -1, c: cause, h: hx !== undefined ? [r2(hx), r2(hy), r2(hz)] : undefined }, ownerOf(t));
    if (attacker && attacker.isPlayer && attacker !== t && cause !== 'zone') { HUD.hitmarker(part === 'head', false); part === 'head' ? Audio.headshot() : Audio.hitmarker(); }
    if (t.brain) t.brain.onDamaged(attacker, cause);
    t.anim.flinch = Math.min(1, t.anim.flinch + dmg / 40); t.anim.flinchDir = Math.random() < 0.5 ? -1 : 1;
    return dmg;
  }
  function killReq(t, attacker, cause) { ev({ k: 'kreq', v: t.id, a: attacker ? attacker.id : -1, c: cause }, ownerOf(t)); }
  function sendKnock(t, attacker, cause) { if (mine(t)) ev({ k: 'knock', v: t.id, a: attacker ? attacker.id : -1, c: cause }); }
  function sendDeath(t, attacker, cause) { ev({ k: 'death', v: t.id, a: attacker && attacker !== t ? attacker.id : -1, c: cause, pl: t.place }); }
  function netKnock(e) {
    const t = charById(e.v); if (!t || mine(t) || t.knocked && t.knockSeen === t.knockN) return;
    const by = e.a >= 0 ? charById(e.a) : null;
    t.knocked = true; t.knockN++; t.knockSeen = t.knockN; t.knockedBy = by; t.hp = 100; t.knockT = G.time; t.heal = null; t.aiming = false; t.stance = 'prone';
    if (t.veh) Veh.exit(t, true, true);
    t.setVisibleGear();
    if (by && !mine(by)) by.knocks = (by.knocks || 0) + 1; else if (by && mine(by)) by.knocks++;
    HUD.killfeed(by ? by.name : null, t.name, causeName(e.c), by && by.isPlayer, t.isPlayer, 'knock', G.player && sameTeam(G.player, t), by && by.skinOf ? by.skinOf(e.c) : null);
    if (G.player && sameTeam(G.player, t)) HUD.toast(`팀원 ${t.name} 기절!`, 'warn');
  }
  function netDeath(e) {
    const t = charById(e.v); if (!t || mine(t)) return;
    if (t.net.deathLife === t.net.life && !t.alive) return;  // 같은 목숨에 두 번 처리하지 않음
    t.net.deathLife = t.net.life; t.net.pendDead = 0;
    const by = e.a >= 0 ? charById(e.a) : null, wasKnocked = t.knocked;
    t.alive = false; t.hp = 0; t.deathTime = G.time; t.place = e.pl || CHARS.filter((c) => c.alive).length + 1; t.heal = null; t.aiming = false; t.vel.set(0, 0, 0);
    t.knocked = false; if (t.revivedBy) { const rv = t.revivedBy; t.revivedBy = null; if (rv.revive && rv.revive.tgt === t) rv.revive = null; }
    if (t.veh) Veh.exit(t, true, true);
    if (by) by.kills++;
    if (G.killLog) G.killLog.push({ t: Math.round(G.time), cause: e.c, kn: wasKnocked, by: by ? (by.isPlayer ? 'player' : 'bot') : 'env' });
    if (!e.lost) HUD.killfeed(by ? by.name : null, t.name, causeName(e.c), by && by.isPlayer, false, e.c === 'wipe' ? 'wipe' : '', G.player && sameTeam(G.player, t), by && by.skinOf ? by.skinOf(e.c) : null);
    Audio.death(t.pos);
    if (!e.lost) SkinFx.kill(t, by, e.c);
    if (G.teams) { const T = G.teams[t.team]; if (T && !T.place && !teamAlive(T)) T.place = aliveTeamCount() + 1; }
    G.onDeath(t, by);
  }
  // 부활: 시작·중단·완료를 알림 (살리는 쪽 기기가 진행, 살아나는 캐릭터의 주인이 적용)
  function sendRevive(c, m, s) { ev({ k: 'rev', by: c.id, v: m.id, s }); }
  function netRevive(e) {
    const c = charById(e.by), m = charById(e.v); if (!c || !m) return;
    if (e.s === 'start') { if (!mine(c)) c.revive = { tgt: m, t: 0, total: REVIVE_T, net: true }; m.revivedBy = c; if (m.isPlayer) HUD.toast(`${c.name}이(가) 부활시키는 중`, 'ok'); }
    else if (e.s === 'stop') { if (!mine(c)) c.revive = null; if (m.revivedBy === c) m.revivedBy = null; }
    else if (e.s === 'done') {
      if (!mine(c)) { c.revive = null; c.revives++; }
      if (m.alive && m.knocked) {
        m.knocked = false; m.revivedBy = null; m.knockedBy = null; m.hp = REVIVE_HP; m.stance = 'crouch'; m.setVisibleGear();
        if (m.brain) m.brain.onRevived();
        if (m.isPlayer) HUD.toast(`${c.name}이(가) 부활시켰습니다`, 'ok');
      }
    }
  }

  // ---------- 사격·투척 (보이기·소리) ----------
  function sendShot(c, origin, end, wid, imp) { ev({ k: 'shot', c: c.id, o: [r2(origin.x), r2(origin.y), r2(origin.z)], e: [r2(end[0]), r2(end[1]), r2(end[2])], w: wid, i: imp || 0 }); }
  const _o = new THREE.Vector3(), _dv = new THREE.Vector3();
  function remoteShot(e) {
    const c = charById(e.c); if (!c || mine(c) || !G.scene) return;
    const d = ITEMS[e.w]; if (!d) return;
    _o.set(e.o[0], e.o[1], e.o[2]); _dv.set(e.e[0] - e.o[0], e.e[1] - e.o[1], e.e[2] - e.o[2]).normalize();
    const g = gunObj(c), meta = g && g.userData.meta;
    const muzzle = meta ? gunWorldPoint(c, 0, meta.boreY, meta.muzzleZ + 0.01, new THREE.Vector3()) : null;
    const start = muzzle && muzzle.distanceTo(_o) < 3 ? muzzle : _o;
    FX.tracer(c, start, e.e[0], e.e[1], e.e[2], GunSkin.tracerCol(g));
    if (e.i) FX.impact(e.e[0], e.e[1], e.e[2], e.i === 'char' ? 'blood' : e.i === 'terrain' ? 'dirt' : 'spark');
    const skd = g && g.userData.skin && g.userData.skin.d, skfx = skd && (skd.fx || skd.lite);
    if (e.i === 'char' && skfx) SkinFx.hit(null, e.e[0], e.e[1], e.e[2], _dv.x, _dv.y, _dv.z, skfx, c);
    FX.flash(c, g, meta, start, _dv, d);
    if (g && g.userData.skin) GunSkin.shot(g, c);
    Audio.gunshot(_o, e.w, false, isIndoor(c.pos.x, c.pos.z, c.pos.y));
    c.lastShotT = G.time;
    G.noises.push({ x: _o.x, y: _o.y, z: _o.z, t: G.time, r: d.cls === 'SMG' || d.cls === 'PISTOL' ? 160 : d.ammo === 'a300' || d.ammo === 'a50' ? 380 : 260, by: c, kind: 'shot' });
  }
  function sendThrow(c, pr) { ev({ k: 'throw', c: c.id, t: pr.type, p: [r2(pr.x), r2(pr.y), r2(pr.z)], v: [r2(pr.vx), r2(pr.vy), r2(pr.vz)], f: r2(pr.fuse) }); }
  function remoteThrow(e) {
    const c = charById(e.c); if (!c || !G.scene) return;
    const pr = { type: e.t, owner: c, x: e.p[0], y: e.p[1], z: e.p[2], vx: e.v[0], vy: e.v[1], vz: e.v[2], t: 0, fuse: e.f, mesh: FX.grenadeMesh(e.t), remote: true };
    PROJ.push(pr); c.throwAnim = 0.35;
    if (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 25) Audio.spoon(c.pos, false);
  }

  // 주먹: 지르기 동작·휘두르는 소리만 (맞힘 소리는 받은 쪽에서 판정만 따로, 피해는 때린 쪽 기기가 'hit'으로 보냄)
  function sendPunch(c, side) { if (mine(c)) ev({ k: 'pu', c: c.id, s: side }); }
  function remotePunch(e) {
    const c = charById(e.c); if (!c || mine(c) || !c.alive || c.knocked) return;
    const pt = c.pitch || 0, cp = Math.cos(pt);
    c.punch = { t: 0, side: e.s > 0 ? 1 : -1, hit: false, dx: Math.sin(c.yaw) * cp, dy: Math.sin(pt), dz: Math.cos(c.yaw) * cp, remote: true };
    c.punchSide = c.punch.side; c.punchT = G.time;
    Audio.punch(c.pos, 'swing', false);
  }

  // ---------- 아이템 ----------
  function itemAdded(it, uid) {
    if (uid !== undefined && uid !== null) it.u = uid;
    else if (N.quiet) it.u = N.seq++;
    else { it.u = N.uidBase + N.uidN++; if (!N.applying) ev({ k: 'gadd', u: it.u, i: it.id, n: it.count, x: r2(it.x), y: r2(it.y), z: r2(it.z), in: it.inst || undefined }); }
    N.items.set(it.u, it);
  }
  function itemRemoved(it) { if (!N.applying && !N.quiet) ev({ k: 'gdel', u: it.u }); }
  function itemCount(it) { if (!N.applying) ev({ k: 'gcnt', u: it.u, n: it.count }); }
  // 같은 시드로 생성 (Math.random 대신 시드 난수) — 아이템·차량 배치가 모든 기기에서 같아진다
  function seeded(seed, fn) {
    const orig = Math.random; Math.random = mulberry32(seed >>> 0); if (N) N.quiet++;
    try { fn(); } finally { Math.random = orig; if (N) N.quiet--; }
  }
  function baseline() { if (N) { N.baseSum = worldSum(); checkSum(); } }

  // ---------- 자기장 ----------
  function zoneSnap() {
    const Z = Zone; if (!Z.cur) return null;
    return { c: Object.assign({}, Z.cur), n: Z.next ? Object.assign({}, Z.next) : null, f: Z.from ? Object.assign({}, Z.from) : null, p: Z.phase, s: Z.state, t: r2(Z.timer), d: Z.dps, st: Z.shrinkTotal || 0, ft: Z.finalT || 0, w: !!Z.warned };
  }
  function applyZone(z) {
    if (!z || !Zone.mesh) return;
    const nk = JSON.stringify(z.n), ok = JSON.stringify(Zone.next);
    Zone.cur = z.c; Zone.next = z.n; Zone.from = z.f; Zone.phase = z.p; Zone.state = z.s; Zone.timer = z.t; Zone.dps = z.d; Zone.shrinkTotal = z.st; Zone.finalT = z.ft; Zone.warned = z.w;
    Zone.updateMeshes(); if (nk !== ok) Zone.updateRing();
  }
  function applyWorld(w) {
    if (N.host) return;
    // 스타트 섬: 방장이 남은 시간(isl)을 보낸다. 방장 쪽 섬이 끝났으면(isl 없음) 나도 수송기로
    if (G.island) { if (w.isl === undefined) Island.end(); else { Island.sync(w.isl); return; } }
    if (w.t !== undefined && Math.abs(G.time - w.t) > 1.2) G.time = w.t;
    if (w.pt !== undefined && G.plane && G.plane.active && Math.abs(G.plane.t - w.pt) > 0.4) { G.plane.t = w.pt; if (G.previewT > 0 && w.pt > 0) { G.previewT = 0; HUD.closeMap(); } }
  }

  // ---------- 매 프레임 ----------
  function tick(dt) {
    if (!N) return;
    const t = now();
    // 온라인 매칭 파티원: 방장의 offer 가 올 때까지 'hi'를 2.5초마다 다시 (방장이 채널에 늦게 들어온 경우)
    if ((viaMM() || N.mig) && !N.host) { const hp = N.peers.get(N.cfg.host); if (hp && !hp.open && !hp.relay && !hp.oid && t - N.hiT > 2.5) hi(); }
    // 방장을 넘겨받은 기기: 3초마다 5번 '내가 방장' 알림 (다른 사람을 고른 파티원도 이쪽으로)
    if (N.host && N.claimN > 0 && t - N.claimT > 3) { N.claimN--; N.claimT = t; bus('host', { uid: N.me, ep: N.epoch }); }
    // 연결 시간 초과 → 중계
    for (const p of N.peers.values()) {
      if (!p.open && !p.relay && t - p.t0 > 12) toRelay(p, 'timeout');
      if ((p.open || p.relay) && t - p.lastRx > 20 && !p.gone && t - N.t0 > 30) { p.gone = true; peerLeft(p.uid); }
    }
    N.tickT -= dt;
    const anyRelay = [...N.peers.values()].some((p) => p.relay);
    if (N.tickT <= 0) {
      N.tickT = 0.05;
      N.tickN = (N.tickN || 0) + 1;
      // 중계: 1명이면 0.2초마다, 2명 이상이면 0.35초마다 (Supabase 무료 플랜 초당 100개 한도 안에서)
      let nRelay = 0; for (const p of N.peers.values()) if (p.relay) nRelay++;
      const relayTick = N.tickN % (nRelay >= 2 || (!N.host && N.cfg.humans.length > 2) ? 7 : 4) === 0;
      // 내 것: 캐릭터(+방장: 봇·다른 파티원) · 차량
      const mineS = [], others = [];
      for (const c of CHARS) { if (mine(c)) mineS.push(c); else if (N.host) others.push(c); }
      const myVeh = []; for (const v of N.vehs) if (!vehRemote(v) && (v.awake || v.burnT > 0 || v.netDirty)) { myVeh.push(encVeh(v)); v.netDirty = v.awake; }
      const w = N.host ? { t: r2(G.time), pt: G.plane && G.plane.active ? r2(G.plane.t) : undefined, isl: G.island ? r2(Island.left()) : undefined } : undefined;
      // v22: 캐릭터 상태는 틱마다 한 번만 JSON 으로 만들고, 사람마다 거리로 골라 이어 붙인다 (사람이 많아도 방장 부담이 덜 늘게)
      //  받는 사람 캐릭터에서 150m 안 = 초당 20번, 150~260m = 10번, 그 밖 = 2번 (멀리 있는 캐릭터는 작게 보여 덜 자주 보내도 티가 안 남)
      const EM = [], EO = [];
      for (const c of mineS) EM.push(c, JSON.stringify(encChar(c)));
      if (N.host) for (const c of others) if (c.net.lastA) EO.push(c, JSON.stringify(c.net.lastA));
      const tail = (myVeh.length ? ',"v":' + JSON.stringify(myVeh) : '') + (w ? ',"w":' + JSON.stringify(w) : ''), me0 = G.player, tn = N.tickN;
      for (const p of N.peers.values()) {
        if (!(p.open || p.relay) || (p.relay && !relayTick)) continue;
        const pc = N.host ? charById2(p.uid) : null, px = pc ? pc.pos.x : 0, pz = pc ? pc.pos.z : 0;
        const send = (c) => { if (!pc || !c.alive) return true; const d = Math.hypot(c.pos.x - px, c.pos.z - pz); return d <= 150 || (d <= 260 ? tn % 2 === 0 : tn % 10 === 0); };
        const S = [];
        for (let i = 0; i < EM.length; i += 2) if (EM[i] === me0 || send(EM[i])) S.push(EM[i + 1]);
        for (let i = 0; i < EO.length; i += 2) if (ownerOf(EO[i]) !== p.uid && send(EO[i])) S.push(EO[i + 1]);
        let pkt = '{"s":[' + S.join(',') + ']' + tail;
        if (p.relay && p.held && p.held.length) pkt += ',"e":' + JSON.stringify(p.held.splice(0));
        sendTo(p, pkt + '}', false);
      }
      // 방장: 자기장 1초마다
      if (N.host && !G.dm && Zone.cur) { N.zoneT -= 0.05; if (N.zoneT <= 0) { N.zoneT = 1; ev({ k: 'zone', z: zoneSnap() }); } }
    }
    flush(!anyRelay);
    // 경기가 끝났는데 다른 사람이 아직 하는 중: 별다른 처리 없음
  }
  const charById2 = (uid) => CHARS.find((c) => c.net && c.net.owner === uid && N.cfg.humans.some((h) => h.uid === uid) && !c.botized) || null;

  // ---------- 나가기 ----------
  // next: 나가는 방장이 고른 다음 방장 (없으면 남은 사람 중 정해진 순서)
  function peerLeft(uid, next) {
    if (!N || N.ended || !uid || uid === N.me) return;
    const p = N.peers.get(uid); if (p && p.left) return; if (p) p.left = true;
    if (N.gone.has(uid)) return;
    N.gone.add(uid);
    const hm = N.cfg.humans.find((h) => h.uid === uid);
    if (!N.host && uid === N.cfg.host) { migrate(uid, next); return; }   // 방장이 나감 → 경기는 계속, 다음 사람이 방장
    if (N.host && hm) {
      // 떠난 파티원 캐릭터는 봇이 이어받는다
      const c = CHARS.find((x) => x.net && x.net.owner === uid && !x.botized);
      if (c) botize(c);
      HUD.toast(`${hm.name}님이 경기를 떠났습니다${c && c.alive ? ' — 봇이 이어서 합니다' : ''}`, 'warn');
    }
  }

  // ---------- 방장 넘겨주기 (v22) ----------
  //  방장이 로비로 나가거나 연결이 끊겨도 경기는 계속된다: 남은 사람 중 한 명이 방장(서버 역할)을 넘겨받는다
  //  · 다음 방장 = 나가는 방장이 고른 사람(살아 있는 사람 우선) · 연결이 끊긴 경우는 남은 사람 중 살아 있는 사람 → 처음 명단 순서
  //  · 새 방장: 봇·나간 사람 캐릭터를 맡아 AI 로 움직이고(보이던 총 + 예비 탄약), 자기장·보급·빈 차량·점수를 이어서 계산,
  //    남은 사람에게 새로 연결(파티원이 'hi' → offer) · 3초마다 '내가 방장' 알림
  //  · 다른 사람: 봇·나간 사람 캐릭터의 주인을 새 방장으로 바꾸고 새 방장에게 다시 연결
  function successors(oldHost) {
    const alive = (uid) => CHARS.some((c) => c.human && c.net && c.net.owner === uid && c.alive && !c.botized);
    const list = N.cfg.humans.map((h) => h.uid).filter((u) => u !== oldHost && !N.gone.has(u));
    return list.filter(alive).concat(list.filter((u) => !alive(u)));
  }
  function migrate(oldHost, next) {
    const cand = successors(oldHost), nh = next && cand.includes(next) ? next : cand[0];
    if (!nh) { hostGone(); return; }
    if (nh === N.me) takeOver(oldHost); else follow(nh, oldHost);
  }
  function closePeer(p) { try { if (p.pc) p.pc.close(); } catch (e) { /* */ } }
  function takeOver(oldHost) {
    N.host = true; N.cfg.host = N.me; N.mig = true; N.epoch++;
    G.netAuthority = () => !N || N.host;
    for (const c of CHARS) {
      if (!c.net || c.net.mine) continue;
      const o = c.net.owner;
      if (o !== oldHost && !N.gone.has(o) && N.cfg.humans.some((h) => h.uid === o)) continue;   // 다른 사람이 움직이는 캐릭터는 그대로
      adopt(c);
    }
    for (const p of N.peers.values()) closePeer(p);
    N.peers.clear();
    for (const hm of N.cfg.humans) if (hm.uid !== N.me && !N.gone.has(hm.uid)) N.peers.set(hm.uid, newPeer(hm.uid, true, true));   // 상대가 'hi'를 보내면 offer
    N.zoneT = 0; N.claimN = 5; N.claimT = 0; N.t0 = now();
    if (G.state === 'result') G.bgSim = true;   // 결과 화면에 있던 사람이 넘겨받으면 뒤에서 경기를 돌린다
    HUD.toast('방장이 나가서 이 기기가 경기를 이어받았습니다 — 경기는 계속됩니다', 'ok');
  }
  // 봇·나간 사람 캐릭터를 이 기기가 맡음 (다른 기기에는 지금 든 총·장비만 보였으므로 예비 탄약·붕대를 채워 준다)
  function adopt(c) {
    if (c.human) { c.origOwner = c.net.owner; c.botized = true; }
    c.net = { owner: N.me, mine: true, buf: [], life: c.net.life };
    ev({ k: 'own', c: c.id, o: N.me });
    if (!c.alive) return;
    c.revive = null; c.heal = null; c.rl = null;
    const wi = c.weapon; if (wi && ITEMS[wi.id] && ITEMS[wi.id].ammo) { const a = ITEMS[wi.id].ammo; c.inv.items[a] = (c.inv.items[a] || 0) + ITEMS[wi.id].mag * 3; }
    if (!c.inv.items.bandage) c.inv.items.bandage = 3;
    const b = c.brain || new Brain(c, DIFF[c.diffKey] ? c.diffKey : 'normal');
    if (G.dm) { b.state = 'LANDING'; b.stateT = 0; b.landT = G.time; b.lookYaw = c.yaw; }
    else {
      const mate = teamMembers(c).find((m) => m !== c && m.human && m.alive && !m.botized);
      if (mate) b.followC = mate;
      if (G.island || c.mode === 'plane') G.planDrop(b, mate);
      else if (c.mode === 'fall' || c.mode === 'chute') { b.dropTarget = { x: c.pos.x, z: c.pos.z }; b.chuteH = 90; b.jumpAt = 0; }
      else { b.setState('EXPLORE'); b.landT = G.time; b.dropTarget = { x: c.pos.x, z: c.pos.z }; }
    }
    if (c.knocked) b.onKnocked();
  }
  function follow(nh, oldHost) {
    N.host = false; N.cfg.host = nh; N.mig = true; N.epoch++;
    for (const c of CHARS) if (c.net && !c.net.mine) { const o = c.net.owner; if (o === oldHost || N.gone.has(o) || !N.cfg.humans.some((h) => h.uid === o)) c.net.owner = nh; }
    for (const p of N.peers.values()) closePeer(p);
    N.peers.clear(); N.peers.set(nh, newPeer(nh, false)); N.hiT = 0; N.t0 = now();
    hi();
    HUD.toast(`방장이 나가서 ${(N.cfg.humans.find((h) => h.uid === nh) || {}).name || '다른 사람'}님이 경기를 이어받습니다 — 경기는 계속됩니다`, 'warn');
  }
  // 다른 기기가 '내가 방장'이라고 알림: 내가 따르던 방장과 연결이 안 되어 있으면 그쪽으로
  function onHostClaim(m) {
    if (!N || N.host || m.uid === N.cfg.host || m.uid === N.me || (m.ep || 0) < N.epoch || N.gone.has(m.uid)) return;
    const hp = N.peers.get(N.cfg.host); if (hp && (hp.open || hp.relay)) return;
    const old = N.cfg.host; N.gone.add(old); follow(m.uid, old);
  }
  function unbotize(c, p) {
    N.gone.delete(p.uid);
    c.botized = false; c.brain = null; c.net = charNet(p.uid); p.gone = false; p.left = false;
    ev({ k: 'own', c: c.id, o: p.uid });
    HUD.toast(`${p.name}님이 다시 연결되었습니다`, 'ok');
  }
  function botize(c) {
    c.origOwner = c.net ? c.net.owner : null;
    c.botized = true; c.net = { owner: N.cfg.host, mine: true, buf: [], life: c.net ? c.net.life : 0 };
    ev({ k: 'own', c: c.id, o: N.cfg.host });
    if (c.alive) {
      const wi = c.weapon; if (wi && ITEMS[wi.id].ammo) { const a = ITEMS[wi.id].ammo; c.inv.items[a] = (c.inv.items[a] || 0) + ITEMS[wi.id].mag * 3; }
      if (!c.inv.items.bandage) c.inv.items.bandage = 3;
      const b = new Brain(c, 'normal'); b.state = c.mode === 'ground' ? 'EXPLORE' : 'LANDING'; b.landT = G.time; b.dropTarget = { x: c.pos.x, z: c.pos.z }; b.chuteH = 90; b.jumpAt = 0;
    }
  }
  function hostGone() {
    if (!N || N.ended) return;
    N.ended = true;
    // 스타트 섬(경기 시작 전)에서 끊기면 기록 없이 로비로
    if (G.island && G.state === 'play') { HUD.toast('방장의 연결이 끊겨 경기를 시작하지 못했습니다 — 로비로 돌아갑니다', 'warn'); setTimeout(() => { if (G.state === 'play' && G.island) toLobby(); }, 1500); return; }
    HUD.toast('방장의 연결이 끊겨 경기가 끝났습니다', 'warn');
    if (G.state !== 'play') return;
    if (G.dm) { const S = G.dm; if (!S.over) DM.finish(S.score[0] === S.score[1] ? -1 : S.score[0] > S.score[1] ? 0 : 1); }
    else if (!G.over) { const p = G.player, T = G.teams[p.team]; if (!T.place) T.place = aliveTeamCount(); G.win = false; G.over = true; G.endT = 1.2; G.hostGone = true; }
  }
  function leave() {
    if (!N) return;
    // 방장이 나가면 다음 방장을 골라 알린다 (연결된 사람 중 살아 있는 사람 우선) → 남은 사람의 경기는 계속
    let next;
    if (N.host) { const ok = (u) => { const p = N.peers.get(u); return !!p && (p.open || p.relay) && !p.left; }; next = successors(N.me).find(ok) || successors(N.me)[0]; }
    try { ev({ k: 'bye', uid: N.me, next }); flush(true); if (viaMM()) bus('bye', { next }); } catch (e) { /* */ }
    const n0 = N, mm = n0.cfg.mm; setTimeout(() => { closePeers(n0); if (mm) MM.chClose(mm); }, 400);
    N = null; G.net = null; restoreOwn(n0);
  }
  function closePeers(n0) { for (const p of n0.peers.values()) { try { p.pc && p.pc.close(); } catch (e) { /* */ } } }
  function close(quiet) { if (!N) return; if (!quiet) leave(); else { const n0 = N; closePeers(n0); if (n0.cfg.mm) MM.chClose(n0.cfg.mm); N = null; G.net = null; restoreOwn(n0); } }
  // 방장이 로비로 나가려 할 때 아직 살아 있는 파티원이 있는지
  function othersPlaying() { if (!N || !N.host) return false; return N.cfg.humans.some((hm) => hm.uid !== N.me && CHARS.some((c) => c.net && c.net.owner === hm.uid && c.alive && !c.botized)); }
  // 방장: 아직 인사(hello)가 없는 사람 수 — 스타트 섬을 조금 더 기다린다
  function waiting() { if (!N || !N.host) return 0; let n = 0; for (const p of N.peers.values()) if (!p.helloSeen && !p.left && !p.gone) n++; return n; }
  function status() { if (!N) return null; return { host: N.host, peers: [...N.peers.values()].map((p) => ({ uid: p.uid, name: p.name, open: p.open, relay: p.relay, rx: Math.round(now() - p.lastRx) })), tx: N.stats.tx, rx: N.stats.rx, items: N.items.size, vehs: N.vehs.length }; }

  // 창을 닫거나 새로고침할 때도 나간다고 알린다 (방장이면 다음 방장을 골라 넘김 → 남은 사람의 경기는 계속)
  window.addEventListener('pagehide', () => { try { if (N) leave(); } catch (e) { /* */ } });
  return { makeConfig, join, ready, onParty, tick, active, isHost, isGuest, mine, ownerOf, charNet, updateProxy, indexVehicles, vehRemote, vehInterp, vehHit, encVeh,
    remoteHit, killReq, sendKnock, sendDeath, sendRevive, sendShot, sendThrow, sendPunch, itemAdded, itemRemoved, itemCount, seeded, baseline, peerLeft, leave, close, othersPlaying, waiting, status, ev, flush,
    get state() { return N; } };
})();
