// ============================================================
// 10_watch.js — 친구 관전: 경기 중인 친구의 화면을 영상으로 보기 · 관전하면서 문자 (v22)
//  · 보는 쪽: 친구 목록·파티 막대의 '관전' · 개발자 메뉴 '관전'(관리자: 경기 중인 모든 계정, 친구가 아니어도)
//    1) 서버에 관전표 — spec_ask(상대, 이번에 만든 1회용 공개 키) (supabase/spectate.sql: 친구·관리자만)
//    2) 로비 채널로 상대에게 '보고 싶다'(spec)
//    3) 상대가 보낸 연결 정보(spof)를 내 키로 풀어 WebRTC 로 연결 → 영상·소리·정보·문자
//  · 보내는 쪽(경기 중인 사람)
//    · 로비 채널의 보낸 사람 이름은 꾸밀 수 있으므로 서버로 확인(spec_check) — 2분 안에 그 사람이 '나를 보려고' 만든 표가 있어야 한다
//    · 연결 정보(SDP, IP 주소 포함)는 그 표의 공개 키로만 풀리게 잠가서(ECDH P-256 + AES-GCM) 보낸다
//      → 로비 채널의 다른 접속자는 읽을 수 없고, 표를 만든 바로 그 기기만 연결된다 (답장도 같은 열쇠로 잠가 와야 받아 준다)
//    · 게임 화면(캔버스)을 영상으로 담는다(captureStream) — 관전자가 있을 때만. 720p·30fps·최대 3.6Mbps 쯤 (그래픽 '낮음' 480p·24fps · 엑스트라 1080p)
//      화면이 작은 휴대폰은 관전자가 있는 동안 그리는 해상도를 조금 올린다(FPS 가 떨어지면 되돌림) — 아래 '관전 화질'
//    · 친구 관전자는 3명까지(관리자는 따로) · 화면 위 '👁 ○○ 관전 중' — 두 번 누르면 이번 경기는 친구 관전을 끝냄
//    · 설정 '친구가 내 경기 관전'을 끄면 친구는 볼 수 없다 (관리자는 볼 수 있고, 표시는 그대로 보인다)
//  · 영상·정보·문자는 기기끼리 직접(WebRTC). 실시간 서버(Supabase)로는 신호 메시지 몇 개만 → 무료 플랜 실시간 한도를 쓰지 않는다
//    직접 연결이 안 되는 망(일부 모바일·회사 망)에서는 관전할 수 없다 (중계 서버 없음 — NET_ICE 는 STUN 만)
//  · 경기가 끝나면 보는 쪽은 '다음 경기를 기다리는 중' → 친구가 다시 경기에 들어가면(접속 표시 pl) 저절로 이어서 본다
//  · 로비 채널 메시지: spec(보고 싶다) · spof(잠긴 연결 정보) · span(잠긴 답장) · spno(안 됨 + 까닭) · spx(연결 전 취소)
//    관전 연결 메시지(데이터 채널): hi(경기 정보) · i(초당 2번 상태) · c(문자 줄) · end(끝) / 보는 쪽 → chat · bye
// ============================================================
const WATCH_MAX = 3;   // 친구 관전자 최대 (관리자는 세지 않음)
const WATCH_QUICK = ['힘내!', '나이스!', '뒤 조심!', '자기장 조심', 'ㅋㅋㅋ', 'GG'];
const Watch = (() => {
  const sb = () => Cloud.client();
  const me = () => Cloud.uid;
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const now = () => performance.now();
  const srvMissing = (e) => !!e && (e.code === 'PGRST202' || /could not find|does not exist|spec_ask|spec_check/i.test(String(e.message || '')));
  const errText = (e) => String((e && (e.message || e.code)) || e || '');

  // ---------- 잠금 (WebCrypto: ECDH P-256 → AES-GCM 256) ----------
  const te = new TextEncoder(), td = new TextDecoder(), EC = { name: 'ECDH', namedCurve: 'P-256' };
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(String(s || '')), (c) => c.charCodeAt(0));
  const supported = () => !!(window.RTCPeerConnection && window.crypto && crypto.subtle && window.isSecureContext !== false);
  async function newKeys() { const kp = await crypto.subtle.generateKey(EC, false, ['deriveKey']); return { kp, pub: b64(await crypto.subtle.exportKey('raw', kp.publicKey)) }; }
  async function derive(priv, pubB64) {
    const pub = await crypto.subtle.importKey('raw', unb64(pubB64), EC, false, []);
    return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))); return { iv: b64(iv), ct: b64(ct) }; }
  async function unseal(key, box) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)); return JSON.parse(td.decode(pt)); }
  // ICE 후보를 다 모은 뒤 한 번에 보낸다 (로비 채널은 접속자 모두가 받으므로 메시지 수를 줄인다)
  function gathered(pc, ms = 3000) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') { res(); return; }
      const t = setTimeout(done, ms);
      function chk() { if (pc.iceGatheringState === 'complete') done(); }
      function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); }
      pc.addEventListener('icegatheringstatechange', chk);
    });
  }
  const desc = (pc) => ({ type: pc.localDescription.type, sdp: pc.localDescription.sdp });
  const label = (name, adm) => (adm ? `${name}(운영자)` : name);

  // ============================================================
  // 보내는 쪽: 경기 중인 나를 보는 사람들
  // ============================================================
  const viewers = new Map();   // uid → { uid, name, admin, pc, dc, key, open, t0, oid }
  let cap = null, stopped = false, oidN = 0, tagSure = 0, tagT = null;
  const playing = () => G.state === 'play' && !!G.scene;
  const friendN = () => { let n = 0; for (const v of viewers.values()) if (!v.admin) n++; return n; };
  const openViewers = () => [...viewers.values()].filter((v) => v.open);

  // 화면 담기 (관전자가 있을 때만) — 같은 영상 트랙을 모든 관전자 연결이 함께 쓴다
  function capStart() {
    if (cap) return cap;
    const cv = G.renderer && G.renderer.domElement; if (!cv || !cv.captureStream) return null;
    let stream; try { stream = cv.captureStream(SETTINGS.quality === 'low' ? 24 : 30); } catch (e) { console.warn('화면 담기 실패', e); return null; }
    const vt = stream.getVideoTracks()[0]; if (!vt) return null;
    try { vt.contentHint = 'motion'; } catch (e) { /* */ }
    let at = null; try { const as = Audio.stream(); at = as && as.getAudioTracks()[0]; if (at) stream.addTrack(at); } catch (e) { at = null; }
    cap = { stream, vt, at };
    return cap;
  }
  function capStop() {
    if (!cap) return; const c = cap; cap = null;
    try { c.vt.stop(); } catch (e) { /* */ }
    if (c.at) { try { c.at.stop(); } catch (e) { /* */ } Audio.streamStop(); }
    keepRes();   // 관전용으로 올린 해상도를 되돌림
  }
  // ---------- 관전 화질 (v22 고침 — 예전 540p·24fps·1.2Mbps, 그래픽 '낮음'은 360p·15fps·0.6Mbps 라 너무 흐렸다) ----------
  //  · 보내는 높이: 그래픽 낮음 480p · 보통·높음 720p · 엑스트라 1080p (캔버스가 더 작으면 캔버스 그대로)
  //    관전자가 3명 이상이면 한 단계 낮춤 — 연결마다 따로 압축한다(관전자 수만큼 인코더)
  //  · 비트레이트 = 보내는 화소 × fps × 0.13 (1 ~ 8 Mbps). 비트가 모자라면 풀·나무가 뭉개지고 브라우저가 해상도를 스스로 더 낮춘다
  //  · 해상도를 지킨다 (degradationPreference 'maintain-resolution' — 망·기기가 버거우면 대신 fps 를 낮춤)
  //    브라우저 기본은 300kbps 로 시작하며 화면을 320×180 으로 줄여 보내고 몇십 초에 걸쳐 한 단계씩 키운다
  //    (시험: 1600×900 화면이 20초 뒤에도 640×360) → 처음부터 정한 해상도로. 그 설정을 모르는 브라우저를 위해 시작 비트레이트도 올림(withStart)
  const WQ = [{ h: 360, f: 24 }, { h: 480, f: 24 }, { h: 720, f: 30 }, { h: 1080, f: 30 }];
  function tier() { const q = SETTINGS.quality; return WQ[Math.max(0, (q === 'low' ? 1 : q === 'extra' ? 3 : 2) - (viewers.size >= 3 ? 1 : 0))]; }
  function encOf() {
    const cv = G.renderer.domElement, H = cv.height || 540, Wd = cv.width || 960, T = tier(), s = Math.max(1, H / T.h), px = (Wd / s) * (H / s);
    return { maxBitrate: Math.round(Math.min(8e6, Math.max(1e6, px * T.f * 0.13))), maxFramerate: T.f, scaleResolutionDownBy: s };
  }
  function addTracks(pc, c) {
    try { pc.addTransceiver(c.vt, { direction: 'sendonly', streams: [c.stream], sendEncodings: [encOf()] }); }
    catch (e) { pc.addTrack(c.vt, c.stream); }
    if (c.at) { try { pc.addTransceiver(c.at, { direction: 'sendonly', streams: [c.stream] }); } catch (e) { pc.addTrack(c.at, c.stream); } }
  }
  // 연결이 정해진 뒤 화질 한도를 한 번 더 (addTransceiver 의 sendEncodings 를 무시하는 브라우저) · 화면 크기·관전자 수가 바뀔 때도
  function applyEnc(v) {
    if (!cap || !v.pc) return;
    const s = v.pc.getSenders().find((x) => x.track === cap.vt); if (!s || !s.getParameters) return;
    try {
      const P = s.getParameters(), e = encOf(); if (!P.encodings || !P.encodings.length) P.encodings = [{}];
      Object.assign(P.encodings[0], e); P.degradationPreference = 'maintain-resolution';
      const r = s.setParameters(P); if (r && r.catch) r.catch(() => {});
    } catch (e) { /* */ }
  }
  // 시작 비트레이트 — 보는 쪽 답장(SDP)의 영상 코덱에 x-google-start-bitrate (Chrome 계열만 읽고 다른 브라우저는 무시)
  function withStart(sdp, kbps) {
    try {
      const L = String(sdp).split('\r\n'), pts = new Set(), fm = new Set(); let vid = false;
      for (const l of L) { if (l.startsWith('m=')) vid = l.startsWith('m=video'); else if (vid) { const m = /^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\//i.exec(l); if (m) pts.add(m[1]); } }
      vid = false; for (const l of L) { if (l.startsWith('m=')) vid = l.startsWith('m=video'); else if (vid) { const m = /^a=fmtp:(\d+) /.exec(l); if (m && pts.has(m[1])) fm.add(m[1]); } }
      const out = []; vid = false;
      for (const l of L) {
        if (l.startsWith('m=')) vid = l.startsWith('m=video');
        const f = vid && /^a=fmtp:(\d+) /.exec(l), r = vid && /^a=rtpmap:(\d+) /.exec(l);
        out.push(f && pts.has(f[1]) && !/x-google-start-bitrate/.test(l) ? l + ';x-google-start-bitrate=' + kbps : l);
        if (r && pts.has(r[1]) && !fm.has(r[1])) out.push(`a=fmtp:${r[1]} x-google-start-bitrate=${kbps}`);   // fmtp 줄이 없는 코덱(VP8)
      }
      return out.join('\r\n');
    } catch (e) { return sdp; }
  }
  // 화면이 작은 기기(휴대폰 '낮음' = 330p 쯤): 관전자가 있는 동안 그리는 배율을 올린다 (최대 1.4배 · 기기 배율까지 · 보낼 높이까지)
  //  올린 뒤 FPS 가 올리기 전의 85% 와 50 아래로 1.5초 떨어지면 되돌리고, 이번 경기는 다시 올리지 않는다
  const RB = { no: false, on: false, t: 0, base: 0, low: 0, fps: [], key: '' };
  function wantPr() {
    const base = QUALITY[SETTINGS.quality].pr, ih = window.innerHeight || 1, T = tier();
    if (!cap || RB.no || ih * base >= T.h * 0.9) return base;
    return Math.max(base, Math.min(window.devicePixelRatio || 1, base * 1.4, T.h / ih));
  }
  function keepRes() {
    const r = G.renderer; if (!r || !r.getPixelRatio) return;
    const f = FpsBox.last || 0, base = QUALITY[SETTINGS.quality].pr;
    if (!RB.on && f) { RB.fps.push(f); if (RB.fps.length > 4) RB.fps.shift(); }   // 올리기 전 FPS (최근 2초)
    if (!cap && !RB.on) { RB.key = ''; return; }   // 관전자가 없고 올려 둔 것도 없으면 손대지 않음
    if (RB.on && now() - RB.t > 2000 && RB.base && f && f < Math.min(RB.base * 0.85, 50)) { if (++RB.low >= 3) RB.no = true; }
    else if (RB.on) RB.low = 0;
    const want = wantPr(), up = want > base + 0.01;
    if (up && !RB.on) { RB.base = RB.fps.length ? RB.fps.reduce((a, b) => a + b, 0) / RB.fps.length : 0; RB.t = now(); RB.low = 0; }
    if (Math.abs(r.getPixelRatio() - want) > 0.01) { r.setPixelRatio(want); G.onResize(); }
    RB.on = up;
    // 캔버스 크기 · 관전자 수 · 그래픽 설정이 바뀌면 화질 한도를 다시
    const cv = r.domElement, k = [cv.width, cv.height, viewers.size, SETTINGS.quality].join();
    if (cap && k !== RB.key) { RB.key = k; for (const v of viewers.values()) applyEnc(v); }
    if (!cap) RB.key = '';
  }
  function dcSend(dc, o) { if (!dc || dc.readyState !== 'open') return; try { if (dc.bufferedAmount < 256e3) dc.send(JSON.stringify(o)); } catch (e) { /* */ } }
  function matchInfo() {
    const gt = GAME_TYPES[SETTINGS.game] || {}, mp = W && MAPS[W.mapId];
    const mode = G.training ? '훈련장' : gt.name || '배틀로얄', sq = !G.training && !G.dm && TEAM_MODES[SETTINGS.squad] ? TEAM_MODES[SETTINGS.squad].name : '';
    return { k: 'hi', n: Cloud.name, mode: [mode, sq].filter(Boolean).join(' · '), map: mp && !G.training ? mp.name : '', party: !!G.net };
  }
  function info() {
    const p = G.player; if (!p) return { k: 'i' };
    const w = p.weapon && ITEMS[p.weapon.id], vc = G.viewChar ? G.viewChar() : p;
    const o = { k: 'i', hp: p.alive && !p.knocked ? Math.round(p.hp) : 0, kn: p.knocked ? 1 : 0, al: p.alive ? 1 : 0, kl: p.kills || 0, w: w ? w.name : '', ps: G.paused && !G.net ? 1 : 0 };
    if (G.dm && G.dm.score) o.sc = [G.dm.score[0] | 0, G.dm.score[1] | 0];
    else if (!G.training) o.left = CHARS.filter((c) => c.alive).length;
    if (vc && vc !== p) o.sp = vc.name;
    if (G.island) o.isl = 1; else if (p.mode === 'plane') o.air = 1;
    return o;
  }

  // 보고 싶다는 요청 (로비 채널, 보낸 사람 = 꾸밀 수 있음 → 서버로 확인)
  const askT = new Map(); let askN = [];
  async function onAsk(from) {
    const uid = from && from.uid; if (!uid || uid === me()) return;
    // 요청이 쏟아지면 버린다 (한 사람 1.5초에 1번 · 모두 합쳐 10초에 12번) — 요청마다 서버 확인을 부르므로
    const tn = Date.now(); if (tn - (askT.get(uid) || 0) < 1500) return; askT.set(uid, tn);
    askN = askN.filter((x) => tn - x < 10000); if (askN.length >= 12) return; askN.push(tn);
    const no = (why) => { Social.send(uid, 'spno', { why }); };
    if (G.state === 'loading' || (G.state === 'play' && !G.scene)) { no('notyet'); return; }
    if (!playing()) { no('lobby'); return; }
    if (!supported() || !sb()) { no('err'); return; }
    let t = null;
    try { const { data, error } = await sb().rpc('spec_check', { p_viewer: uid }); if (error) throw error; t = data; }
    catch (e) { no(srvMissing(e) ? 'srv' : 'err'); return; }
    if (!t || !t.pk) { no('verify'); return; }
    if (!playing()) { no('lobby'); return; }
    const adm = !!t.admin;
    if (!adm && SETTINGS.watchOk === false) { no('off'); return; }
    if (!adm && stopped) { no('stop'); return; }
    const old = viewers.get(uid); if (old) drop(old, 'again');
    if (!adm && friendN() >= WATCH_MAX) { no('full'); return; }
    const c = capStart(); if (!c) { no('err'); return; }
    const v = { uid, name: String(t.name || (from && from.name) || '?'), admin: adm, pc: null, dc: null, key: null, open: false, t0: now(), oid: ++oidN };
    viewers.set(uid, v);
    try {
      const keys = await newKeys(); v.key = await derive(keys.kp.privateKey, t.pk);
      const pc = v.pc = new RTCPeerConnection({ iceServers: NET_ICE });
      addTracks(pc, c);
      const dc = v.dc = pc.createDataChannel('w', { ordered: true });
      dc.onopen = () => {
        if (viewers.get(uid) !== v) return;
        v.open = true; dcSend(dc, matchInfo()); dcSend(dc, info()); renderTag();
        HUD.toast(`👁 ${label(v.name, v.admin)}님이 내 경기를 관전합니다`, 'info');
      };
      dc.onmessage = (e) => fromViewer(v, e.data);
      dc.onclose = () => { if (viewers.get(uid) === v) drop(v, 'gone'); };
      pc.onconnectionstatechange = () => { if (viewers.get(uid) !== v) return; const s = pc.connectionState; if (s === 'failed' || s === 'closed') drop(v, 'gone'); };
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (viewers.get(uid) !== v) return;
      Social.send(uid, 'spof', { o: v.oid, pub: keys.pub, box: await seal(v.key, desc(pc)) });
    } catch (e) { console.warn('관전 보내기 실패', e); if (viewers.get(uid) === v) drop(v, 'err'); no('err'); }
  }
  // 보는 쪽 답장 — 같은 열쇠로 잠겨 있어야 받는다 (꾸민 답장은 풀리지 않음 → 무시)
  async function onAnswer(from, m) {
    const v = viewers.get(from.uid); if (!v || !v.pc || !v.key || m.o !== v.oid || !m.box) return;
    let d; try { d = await unseal(v.key, m.box); } catch (e) { return; }
    if (viewers.get(from.uid) !== v || !d || d.type !== 'answer' || v.pc.signalingState !== 'have-local-offer') return;
    const kb = Math.round(Math.min(2500, Math.max(800, encOf().maxBitrate * 0.6 / 1000)));
    try {
      try { await v.pc.setRemoteDescription({ type: 'answer', sdp: withStart(d.sdp, kb) }); }
      catch (e) { if (v.pc && v.pc.signalingState === 'have-local-offer') await v.pc.setRemoteDescription(d); else throw e; }   // 고친 SDP 가 안 먹으면 받은 그대로
      applyEnc(v);
    } catch (e) { console.warn('관전 연결 실패', e); drop(v, 'err'); }
  }
  // why: 'over' 경기 끝 · 'stop' 내가 끝냄 · 'gone' 연결 끊김 · 'bye' 보는 쪽이 나감 · 'again' 다시 연결 · 'err'
  function drop(v, why) {
    if (viewers.get(v.uid) === v) viewers.delete(v.uid);
    const wasOpen = v.open; v.open = false;
    if (v.dc && v.dc.readyState === 'open' && (why === 'over' || why === 'stop')) dcSend(v.dc, { k: 'end', why });
    const pc = v.pc; v.pc = null; v.dc = null;
    setTimeout(() => { try { if (pc) pc.close(); } catch (e) { /* */ } }, why === 'over' || why === 'stop' ? 300 : 0);   // 'end' 가 먼저 가도록
    if (wasOpen && (why === 'bye' || why === 'gone')) HUD.toast(`👁 ${label(v.name, v.admin)}님이 관전을 마쳤습니다`, 'info');
    if (!viewers.size) capStop();
    renderTag();
  }
  function fromViewer(v, data) {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || viewers.get(v.uid) !== v) return;
    if (m.k === 'chat') {
      const t = Chat.clean(m.t); if (!t || !Chat.allow(v.uid)) return;
      const n = label(v.name, v.admin);
      Chat.add({ kind: 'w', n, t });
      for (const o of viewers.values()) if (o !== v && o.open) dcSend(o.dc, { k: 'c', s: 'w', n, t });   // 다른 관전자도 보게
    } else if (m.k === 'bye') drop(v, 'bye');
  }
  // 경기 중 내가 쓴 문자 → 관전자에게 (10_chat.js)
  function sendChat(t) { for (const v of viewers.values()) if (v.open) dcSend(v.dc, { k: 'c', s: 'p', n: Cloud.name, t }); }
  const viewerCount = () => openViewers().length;

  // 화면 위 표시 '👁 ○○ 관전 중' — 두 번 누르면 이번 경기는 친구 관전 끝 (관리자 관전은 계속, 표시도 그대로)
  function renderTag() {
    const el = $('watchTag'); if (!el) return;
    const list = openViewers(), show = list.length > 0 && G.state === 'play';
    el.hidden = !show; if (!show) return;
    const nm = list.map((v) => label(v.name, v.admin)), friends = list.some((v) => !v.admin);
    el.querySelector('b').textContent = '👁 ' + (nm.length > 2 ? `${nm.length}명` : nm.join(', ')) + ' 관전 중';
    el.querySelector('small').textContent = !friends ? '운영자가 보는 중' : tagSure ? '한 번 더 누르면 이번 경기 친구 관전을 끝냅니다' : '두 번 누르면 관전 끝내기';
    el.classList.toggle('sure', !!tagSure && friends);
  }
  function tagClick(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!openViewers().some((v) => !v.admin)) return;
    if (!tagSure) { tagSure = 1; renderTag(); clearTimeout(tagT); tagT = setTimeout(() => { tagSure = 0; renderTag(); }, 3000); return; }
    tagSure = 0; clearTimeout(tagT); stopped = true;
    for (const v of [...viewers.values()]) if (!v.admin) drop(v, 'stop');
    HUD.toast('이번 경기는 친구 관전을 끝냈습니다 (다음 경기부터 다시 볼 수 있음)', 'info');
    renderTag();
  }
  function sendTick() {
    if (!playing()) {
      if (viewers.size) for (const v of [...viewers.values()]) drop(v, 'over');
      stopped = false; tagSure = 0; RB.no = false; RB.fps = [];
      return;
    }
    keepRes();
    if (!viewers.size) return;
    const i = info(), t = now();
    for (const v of [...viewers.values()]) {
      if (v.open) dcSend(v.dc, i);
      else if (t - v.t0 > 20000) drop(v, 'err');   // 20초 안에 연결이 안 됨
    }
  }

  // ============================================================
  // 보는 쪽
  // ============================================================
  // V.st: ask(서버에 표) · offer(상대 답 기다림) · conn(연결 중) · live(보는 중) · wait(다음 경기 기다림) · err
  let V = null, myLog = [];
  const viewing = () => !!V;
  function open(uid, name) {
    if (!Cloud.user) { HUD.lobbyNote('관전은 로그인한 뒤 할 수 있습니다'); Cloud.open(); return; }
    if (G.state !== 'lobby') { HUD.lobbyNote('관전은 로비에서만 할 수 있습니다'); return; }
    if (!supported()) { HUD.lobbyNote('이 브라우저에서는 관전을 할 수 없습니다'); return; }
    if (uid === me()) return;
    if (V) close(true);
    V = { uid, name: String(name || '친구'), st: 'ask', why: '', msg: '', t0: now(), tries: 0, info: null, hi: null, seenOff: false, retryAt: 0, askT: 0, pc: null, dc: null, keys: null, key: null, oid: 0, admin: false };
    myLog = [];
    $('friendPanel').hidden = true; $('devPanel').hidden = true;
    $('watchView').hidden = false; $('wvInput').value = '';
    Audio.init(); Audio.music(false);
    renderQuick(); render(); renderLog();
    ask();
  }
  function clearPc(v) {
    const pc = v.pc; v.pc = null; v.dc = null; v.key = null; v.oid = 0;
    if (pc) { try { pc.close(); } catch (e) { /* */ } }
  }
  function close(quiet) {
    const v = V; if (!v) return; V = null;
    if (v.dc && v.dc.readyState === 'open') dcSend(v.dc, { k: 'bye' });
    else if (v.st === 'offer' || v.st === 'conn') Social.send(v.uid, 'spx', {});   // 연결 전이면 상대가 준비한 것을 치우게
    const pc = v.pc; v.pc = null; v.dc = null; setTimeout(() => { try { if (pc) pc.close(); } catch (e) { /* */ } }, 250);
    const vid = $('wvVideo'); if (vid) { try { vid.pause(); } catch (e) { /* */ } vid.srcObject = null; }
    $('watchView').hidden = true;
    try { const i = $('wvInput'); if (i) i.blur(); } catch (e) { /* */ }
    if (G.state === 'lobby') Audio.music(true);
    if (!quiet) { HUD.renderLobby(); Social.render(); }
  }
  async function ask() {
    const v = V; if (!v) return;
    clearPc(v);
    v.st = 'ask'; v.t0 = now(); v.tries++; v.msg = ''; render();
    try {
      v.keys = await newKeys();
      const { data, error } = await sb().rpc('spec_ask', { p_target: v.uid, p_pk: v.keys.pub });
      if (V !== v) return;
      if (error) throw error;
      v.admin = !!(data && data.admin);
      if (!Social.send(v.uid, 'spec', {})) { fail(v, '실시간 서버에 연결되어 있지 않습니다 — 잠시 뒤 다시 시도해 주세요'); return; }
      v.st = 'offer'; v.askT = now(); render();
    } catch (e) {
      if (V !== v) return;
      const m = errText(e);
      if (srvMissing(e)) fail(v, Cloud.admin ? '서버 설정 필요: Supabase SQL Editor 에서 supabase/spectate.sql 을 실행해 주세요' : '관전 서버를 준비하는 중입니다 — 나중에 다시 시도해 주세요');
      else if (/\bdeny\b/.test(m)) fail(v, '친구만 관전할 수 있습니다 (친구 목록에서 수락된 친구)');
      else if (/\bauth\b/.test(m)) fail(v, '로그인이 필요합니다');
      else fail(v, '관전을 시작하지 못했습니다 — ' + Cloud.msgOf(e));
    }
  }
  function fail(v, msg) { clearPc(v); v.st = 'err'; v.msg = msg; detach(); render(); }
  // why: lobby(경기 중 아님) · loading(경기 불러오는 중) · over(경기 끝) · stop(친구가 이번 경기 관전을 끝냄) · gone(연결 끊김) · noans(응답 없음)
  function toWait(v, why) {
    clearPc(v); detach();
    v.st = 'wait'; v.why = why; v.msg = '';
    v.seenOff = !(why === 'stop' || why === 'over');   // 끝난(또는 관전을 끝낸) 경기를 다시 요청하지 않게: 한 번 '경기 밖'을 본 뒤에 다시
    if (why === 'gone' && v.tries >= 3) { fail(v, `${v.name}님과 연결이 여러 번 끊겼습니다`); return; }
    v.retryAt = now() + (why === 'loading' ? 3000 : why === 'noans' ? 2500 : 1500);
    render();
  }
  // 상대가 잠가 보낸 연결 정보 (내 키로 풀리지 않으면 다른 사람이 꾸민 것 → 무시)
  async function onOffer(from, m) {
    const v = V; if (!v || from.uid !== v.uid || v.st !== 'offer' || !v.keys || !m || !m.pub || !m.box) return;
    let key, d;
    try { key = await derive(v.keys.kp.privateKey, m.pub); d = await unseal(key, m.box); } catch (e) { return; }
    if (V !== v || v.st !== 'offer' || !d || d.type !== 'offer') return;
    v.st = 'conn'; v.key = key; v.oid = m.o; v.t0 = now(); render();
    try {
      const pc = v.pc = new RTCPeerConnection({ iceServers: NET_ICE });
      pc.ontrack = (e) => { if (V === v && v.pc === pc) attach(e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track])); };
      pc.ondatachannel = (e) => {
        if (V !== v || v.pc !== pc) return;
        const dc = v.dc = e.channel;
        dc.onmessage = (ev) => fromHost(v, ev.data);
        dc.onclose = () => { if (V === v && v.dc === dc && (v.st === 'live' || v.st === 'conn')) toWait(v, 'gone'); };
      };
      pc.onconnectionstatechange = () => {
        if (V !== v || v.pc !== pc) return;
        const s = pc.connectionState;
        if (s === 'connected') { if (v.st !== 'live') { v.st = 'live'; v.tries = 0; render(); } }
        else if (s === 'failed') fail(v, '기기끼리 직접 연결이 안 되어 관전할 수 없습니다 (일부 모바일·회사·학교 망은 바로 연결되지 않습니다)');
      };
      await pc.setRemoteDescription(d);
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      if (V !== v || v.pc !== pc) return;
      Social.send(v.uid, 'span', { o: v.oid, box: await seal(key, desc(pc)) });
    } catch (e) { console.warn('관전 연결 실패', e); if (V === v) fail(v, '연결을 만들지 못했습니다 — 다시 시도해 주세요'); }
  }
  function onNo(from, m) {
    const v = V; if (!v || from.uid !== v.uid || !(v.st === 'offer' || v.st === 'ask')) return;
    const why = m && m.why, n = v.name;
    if (why === 'lobby' || why === 'notyet') { toWait(v, why === 'notyet' ? 'loading' : 'lobby'); return; }
    if (why === 'stop') { toWait(v, 'stop'); return; }
    fail(v, ({ off: `${n}님이 친구 관전을 꺼 두었습니다 (설정 → 친구가 내 경기 관전)`, full: `${n}님의 경기를 이미 ${WATCH_MAX}명이 보고 있습니다`, verify: '관전 확인에 실패했습니다 — 다시 시도해 주세요',
      srv: '관전 서버를 준비하는 중입니다 — 나중에 다시 시도해 주세요', err: `${n}님의 기기에서 관전을 시작하지 못했습니다` })[why] || '관전할 수 없습니다');
  }
  function fromHost(v, data) {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || V !== v) return;
    if (m.k === 'i') { v.info = m; renderInfo(); }
    else if (m.k === 'hi') { v.hi = m; if (m.n) v.name = String(m.n); render(); }
    else if (m.k === 'c') { const t = Chat.clean(m.t); if (t) addLog({ kind: m.s === 'w' ? 'w' : 'p', n: Chat.clean(m.n) || '?', t }); }
    else if (m.k === 'end') toWait(v, m.why === 'stop' ? 'stop' : 'over');
  }
  // 영상
  function attach(stream) {
    const vid = $('wvVideo'); if (!vid || vid.srcObject === stream) return;
    vid.srcObject = stream; vid.muted = true;
    const p = vid.play(); if (p && p.catch) p.catch(() => {});
    // 소리: 관전 버튼을 누른 뒤라 대개 켤 수 있다 — 막히면 '소리 켜기' 버튼
    setTimeout(() => { if (V && vid.srcObject === stream && !V.mute) sound(true); }, 50);
  }
  function detach() { const vid = $('wvVideo'); if (vid && vid.srcObject) { try { vid.pause(); } catch (e) { /* */ } vid.srcObject = null; } }
  // on: 소리 켜기. user: 사람이 버튼으로 고름(끄면 다시 연결돼도 끈 채로)
  function sound(on, user) {
    const vid = $('wvVideo'), v = V; if (!vid || !v) return;
    if (user) v.mute = !on;
    vid.muted = !on;
    if (on) { const p = vid.play(); if (p && p.catch) p.catch(() => { if (V !== v) return; vid.muted = true; renderSound(); }); }   // 자동 재생이 막힘 → '소리 켜기' 버튼
    renderSound();
  }
  function renderSound() { const b = $('wvSound'); if (!b || !V) return; const vid = $('wvVideo'); const on = vid && !vid.muted; b.textContent = on ? '🔊 소리 끄기' : '🔇 소리 켜기'; }
  function viewTick() {
    const v = V; if (!v) return;
    if (G.state !== 'lobby') { close(true); return; }   // 내가 경기를 시작함 (파티 출격 등)
    const o = Social.online.get(v.uid), t = now();
    if (!o || !o.pl) v.seenOff = true;
    if (v.st === 'wait') {
      if (o && o.pl && v.seenOff && t >= v.retryAt) { ask(); return; }
      const w2 = !o ? 'offline' : !o.pl ? 'out' : '';
      if (w2 !== v.why2) { v.why2 = w2; render(); }
    } else if (v.st === 'offer' && t - v.askT > 9000) {
      if (v.tries < 3 && o && o.pl) toWait(v, 'noans');
      else fail(v, `${v.name}님의 응답이 없습니다 — 예전 버전의 게임이거나 연결이 끊겼을 수 있습니다`);
    } else if (v.st === 'conn' && t - v.t0 > 16000) fail(v, '기기끼리 직접 연결이 안 되어 관전할 수 없습니다 (일부 모바일·회사·학교 망은 바로 연결되지 않습니다)');
    else if (v.st === 'live' && (!o || !o.pl)) toWait(v, o ? 'over' : 'gone');
  }
  // 로비 채널로 온 관전 메시지 (Social.onMsg 가 넘김)
  function onLobby(m) {
    const from = m.from; if (!from || !from.uid) return;
    if (m.k === 'spec') onAsk(from);
    else if (m.k === 'spof') onOffer(from, m);
    else if (m.k === 'span') onAnswer(from, m);
    else if (m.k === 'spno') onNo(from, m);
    else if (m.k === 'spx') { const v = viewers.get(from.uid); if (v && !v.open) drop(v, 'bye'); }
  }

  // ---------- 보는 쪽 화면 (#watchView) ----------
  function render() {
    const v = V; if (!v) return;
    const hi = v.hi || {};
    $('wvName').textContent = v.name;
    $('wvMode').textContent = [v.admin ? '운영자 관전' : '관전 중', hi.mode, hi.map].filter(Boolean).join(' · ');
    const box = $('wvMsg'); box.innerHTML = '';
    let txt = '', spin = false, retry = false;
    if (v.st === 'ask' || v.st === 'offer') { txt = `${v.name}님에게 관전을 요청하는 중…`; spin = true; }
    else if (v.st === 'conn') { txt = '화면을 연결하는 중…'; spin = true; }
    else if (v.st === 'live') txt = '';
    else if (v.st === 'err') { txt = v.msg || '관전할 수 없습니다'; retry = true; }
    else if (v.st === 'wait') {
      spin = true;
      txt = v.why2 === 'offline' ? `${v.name}님이 접속해 있지 않습니다 — 다시 들어와 경기를 시작하면 이어서 봅니다`
        : v.why === 'stop' ? `${v.name}님이 이번 경기의 관전을 끝냈습니다 — 다음 경기가 시작되면 이어서 봅니다`
          : v.why === 'over' ? `${v.name}님의 경기가 끝났습니다 — 다음 경기가 시작되면 이어서 봅니다`
            : v.why === 'gone' ? `${v.name}님과 연결이 끊겼습니다 — 다시 연결하는 중…`
              : v.why === 'loading' ? `${v.name}님이 경기를 불러오는 중입니다…`
                : v.why === 'noans' ? `${v.name}님의 응답을 기다리는 중…`
                  : `${v.name}님은 지금 경기 중이 아닙니다 — 경기가 시작되면 바로 보여 드립니다`;
    }
    box.hidden = !txt;
    if (txt) {
      if (spin) box.appendChild(h('i', 'spin'));
      box.appendChild(h('p', '', txt));
      if (retry) { const b = h('button', 'btn amber sm', '다시 시도'); b.type = 'button'; b.onclick = () => { Audio.ui(); if (V) { V.tries = 0; ask(); } }; box.appendChild(b); }
    }
    $('watchView').classList.toggle('live', v.st === 'live');
    renderInfo(); renderSound();
  }
  function renderInfo() {
    const el = $('wvInfo'); if (!el) return;
    const v = V, i = v && v.st === 'live' ? v.info : null;
    if (!i || i.hp === undefined) { el.textContent = ''; return; }
    const parts = [];
    if (i.ps) parts.push('일시 정지');
    if (i.isl) parts.push('스타트 섬'); else if (i.air) parts.push('수송기');
    if (!i.al) parts.push(i.sp ? `탈락 — 팀원 ${i.sp} 관전 중` : '탈락');
    else if (i.kn) parts.push('기절');
    else parts.push(`체력 ${i.hp}`);
    parts.push(`처치 ${i.kl}`);
    if (i.sc) parts.push(`점수 ${i.sc[0]} : ${i.sc[1]}`); else if (i.left !== undefined) parts.push(`생존 ${i.left}`);
    if (i.w && i.al) parts.push(i.w);
    el.textContent = parts.join(' · ');
  }
  function addLog(e) {
    const L = myLog[myLog.length - 1]; if (e.kind === 'sys' && L && L.kind === 'sys' && L.t === e.t && Date.now() - L.at < 5000) return;   // 같은 안내를 연달아 쌓지 않음
    e.at = Date.now(); myLog.push(e); if (myLog.length > 30) myLog.shift(); renderLog();
  }
  function renderLog() {
    const box = $('wvLog'); if (!box) return; box.innerHTML = '';
    for (const e of myLog.slice(-6)) box.appendChild(Chat.line(e));
  }
  function renderQuick() {
    const q = $('wvQuick'); if (!q || q.childElementCount) return;
    for (const t of WATCH_QUICK) { const b = h('button', '', t); b.type = 'button'; b.onclick = () => say(t); q.appendChild(b); }
  }
  // 관전하면서 친구에게 문자 (관전 연결로 — 연결되어 있을 때만)
  function say(text) {
    const v = V; if (!v) return false;
    const t = Chat.clean(text); if (!t) return false;
    if (v.st !== 'live' || !v.dc || v.dc.readyState !== 'open') { addLog({ kind: 'sys', n: '', t: '화면이 연결된 뒤에 문자를 보낼 수 있습니다' }); return false; }
    const wait = Chat.wait(); if (wait) { addLog({ kind: 'sys', n: '', t: wait }); return false; }
    Chat.mark(); dcSend(v.dc, { k: 'chat', t }); addLog({ kind: 'me', n: '나', t });
    return true;
  }

  // ---------- 개발자 메뉴: 경기 중인 모든 계정 (관리자) ----------
  let devKey = '';
  function devList(box) {
    if (!box) return;
    const list = [...Social.online.values()].filter((o) => o && o.uid && o.uid !== me() && o.pl).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    devKey = JSON.stringify([G.state, list.map((o) => [o.uid, o.name, o.lv, o.pn])]);
    box.innerHTML = '';
    if (!Social.connected) { box.appendChild(h('div', 'dev-note', '실시간 서버에 연결 중…')); return; }
    if (!list.length) { box.appendChild(h('div', 'dev-note', '지금 경기 중인 계정이 없습니다 (로그인한 계정만 보입니다)')); return; }
    for (const o of list) {
      const b = h('button', 'btn', `👁 ${o.name || '?'} · Lv ${o.lv || 1}${o.pn > 1 ? ` · 파티 ${o.pn}명` : ''}`); b.type = 'button';
      b.disabled = G.state !== 'lobby'; if (b.disabled) b.title = '로비에서만 관전할 수 있습니다';
      b.onclick = () => { Audio.ui(); open(o.uid, o.name); };
      box.appendChild(b);
    }
  }
  function devTick() {
    const box = $('devWatch'); if (!box || $('devPanel').hidden) return;
    const list = [...Social.online.values()].filter((o) => o && o.uid && o.uid !== me() && o.pl);
    const k = JSON.stringify([G.state, list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map((o) => [o.uid, o.name, o.lv, o.pn])]);
    if (k !== devKey) devList(box);
  }

  // ---------- 시작 ----------
  function setup() {
    const tag = $('watchTag'); if (tag) { tag.addEventListener('pointerdown', (e) => e.stopPropagation()); tag.addEventListener('click', tagClick); }
    $('wvClose').addEventListener('click', () => { Audio.ui(); close(); });
    $('wvSound').addEventListener('click', () => { const vid = $('wvVideo'); sound(!!(vid && vid.muted), true); });
    $('wvForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('wvInput'); if (say(i.value)) i.value = ''; });
    $('wvInput').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.target.blur(); } });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && V && !(e.target && e.target.tagName === 'INPUT')) close(); });   // Esc = 관전 나가기
    setInterval(() => { try { sendTick(); viewTick(); devTick(); } catch (e) { console.warn('관전', e); } }, 500);
  }
  // 로그아웃: 모두 끊기
  function stopAll() { for (const v of [...viewers.values()]) drop(v, 'stop'); if (V) close(true); }
  return { setup, open, close, onLobby, sendChat, viewerCount, viewing, renderTag, devList, stopAll,
    get viewers() { return viewers; }, get view() { return V; }, get cap() { return cap; }, _say: say, _info: info };
})();
