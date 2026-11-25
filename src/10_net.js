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
//  봇에게 넘긴 파티원(v24): 방장이 아직 경기 중인 파티원을 나간 것으로 보고 캐릭터를 봇에게 넘겨도(파티 채널만 끊김 · 상태가 20초 안 닿음) 그 기기는
//   자기 캐릭터를 계속 움직이며 상태를 보낸다 → 방장이 그 상태를 받으면 돌려준다 (그사이 방장 기기에서 생긴 기절·사망은 그 기기도 따른다 — lostMe)
//  피해: 쏜 쪽이 맞힌 것을 판정 → 맞은 캐릭터의 주인 기기로 'hit' → 주인이 방어구 계산·기절·사망 처리 후 결과를 알림
//  아이템: 시작 아이템·차량은 같은 시드로 각자 생성(방장이 개수·위치 합계로 검증, 다르면 목록 전송), 이후 줍기·버리기는 사건으로
//  리콜(08_recall.js): 'rc' — 등록 요청은 방장에게, 방장이 확인해 승인을 모두에게. 되살리기는 그 캐릭터의 주인 기기
//  팀 핑(09_player_ping.js, v23): 'pg' — 찍은 사람의 핑·마커 상태 통째로, 같은 팀 사람마다(to) + 방장(팀원 봇). 방장이 받는 사람에게 넘긴다
//   (옛 화면은 모르는 사건을 버릴 뿐 깨지지 않아 NET_VER 는 올리지 않음 — 서로 핑만 안 보인다)
//  채널 서명(v24): 채널(파티·로비·매칭)은 들어온 누구나 읽고 보내며 보낸 사람(from)도 보내는 화면이 적는다 → 직접 연결이 열리면 그 연결로만
//   서로 무작위 키(ky)를 건네고, 중계('g')·매칭 채널 'bye' 에 그 키로 만든 서명을 붙인다 (아래 '채널 메시지 서명')
// ============================================================
// 같이 하기 버전: 경기 사건·설정의 모양이 바뀌면 올린다 — 다르면 파티·온라인 매칭·경기 연결에서 같이 하지 않는다 (10_ver.js)
//  2 = v22 데스매치 아레나(cfg.arena) · 3 = v22 시체·보급 상자(gadd bx)·근접 무기(pu w)·새 투척 무기 + v23 이어하기(로비 rj·rjok · rjs)·우승 축하(vic)
const NET_VER = 3;
// 받은 피해('hit')의 상한 = 이 게임에서 한 번에 줄 수 있는 가장 큰 피해 — 불러올 때 표에서 계산 (판처파우스트 직격 ITEMS.pzf.dmg 가 가장 큼)
//  보내는 값은 머리(×2.1)·기절 중 머리(×1.5)·방어구를 셈하기 전 피해(맞은 쪽 applyDamage 가 곱함)라 그 전 값끼리 견준다:
//  총 ITEMS dmg(산탄은 한 알씩 · 거리 감쇠 ≤ 1 · pzf = 직격) · 근접 무기 ITEMS dmg(머리는 ×0.72 로 줄여 보냄) · 주먹 PUNCH · 폭발 BLAST_DMG ·
//  차량 들이받기 (상대 속도 - 2.5) × hit — 상대 속도 ≤ 가장 빠른 차 최고속의 두 배(차 + 다른 차에 튕겨 날아온 사람) · 탑승자 충돌·착지·내리기 피해도 이 안
//  (낙하·자기장 피해는 그 캐릭터 주인 기기만 셈해 오가지 않음 · 화염병·자기장 수류탄은 0.2초마다 몇 점)
//  표에 숫자가 아닌 값이 섞여 계산이 NaN 이 되면 받은 피해가 모두 NaN 이 되므로 → 999 (지금 표의 최댓값 = 판처파우스트 직격)
const NET_HIT_MAX = (() => {
  const vmax = Math.max(...Object.values(VEH_TYPES).map((T) => T.vmax)), m = Math.max(PUNCH.dmg, ...Object.values(ITEMS).map((d) => d.dmg || 0), ...Object.values(BLAST_DMG), ...Object.values(VEH_TYPES).map((T) => 2 * vmax * T.hit));
  if (Number.isFinite(m) && m > 0) return m;
  console.warn('NET_HIT_MAX: 피해 표에 숫자가 아닌 값이 있어 999 로 둡니다'); return 999;
})();
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

  // ---------- 채널 메시지 서명 (v24) ----------
  //  파티·로비·매칭 채널은 그 채널에 들어온 누구나 보내고 읽는다. 보낸 사람(from)도 보내는 화면이 적으므로 고친 화면은 남의 이름으로 보낼 수 있다
  //   (중계 'g' 를 방장 이름으로 → 그 안 사건이 모두 방장 것 · 매칭 채널 'bye' 를 방장·파티원 이름으로 → 방장을 떠나거나 그 사람을 봇에게 넘김)
  //  → 직접 연결(암호화된 데이터 채널)이 열리면 양쪽이 그 상대에게만 쓰는 무작위 키를 건넨다: { ky: [키, 보낸 중계 번호] } — 그 연결로 온 것만 받음(채널로 온 키는 버림)
  //   · 중계('g')에 번호(sq) · 서명(tg) = HMAC-SHA-256(보내는 쪽 키, 'g|보낸 사람|받는 사람|번호|내용') 앞 16자 — 받는 쪽은 상대 키를 받은 뒤부터 서명이 맞고 처음 보는 번호만 받는다
  //     (채널은 모두 읽으므로 서명·번호를 엿볼 수 있지만, 키 없이는 다른 내용·번호의 서명을 만들 수 없고 같은 메시지를 다시 보내면 번호가 겹쳐 버려진다)
  //   · 매칭 채널 'bye' 에는 받는 사람마다 서명(tg: { uid: 서명 }) — 나가는 방장의 다음 방장(next)·나간 사람 목록(g)까지 넣어 서명
  //   · 키를 건네지 않는 화면(이번 업데이트 전)·직접 연결이 한 번도 안 된 상대(중계로만 — 일부 모바일 망)는 예전처럼 서명 없이 받는다 (배포하는 동안에도 같이 하기가 끊기지 않게)
  //     다만 그 상대와 직접 연결로 방금(0.8초 안)까지 받고 있었으면 그 이름의 중계는 버린다 — 그 사람은 직접 연결로 보내는 중
  const SHA_K = new Uint32Array(64), SHA_H = new Uint32Array(8);   // SHA-256 상수: 소수 64개 세제곱근 · 8개 제곱근의 소수 부분 32비트 (불러올 때 계산 — 시험: hmac('Jefe', …) = RFC 4231)
  { let n = 0; for (let c = 2; n < 64; c++) { let pr = true; for (let d = 2; d * d <= c; d++) if (c % d === 0) { pr = false; break; } if (!pr) continue; if (n < 8) SHA_H[n] = (Math.sqrt(c) % 1) * 4294967296; SHA_K[n++] = (Math.cbrt(c) % 1) * 4294967296; } }
  function sha256(b) {   // Uint8Array → Uint8Array(32)
    const l = b.length, nb = (l + 72) & ~63, m = new Uint8Array(nb), dv = new DataView(m.buffer), W = new Uint32Array(64), H = SHA_H.slice();
    m.set(b); m[l] = 0x80; dv.setUint32(nb - 4, l * 8); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const x = W[i - 15], y = W[i - 2]; W[i] = ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3) + W[i - 16] + ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10) + W[i - 7]; }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + (e & f ^ ~e & g) + SHA_K[i] + W[i]) | 0;
        const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + (a & bb ^ a & c ^ bb & c)) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer); for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
    return out;
  }
  const te = new TextEncoder(), hex = (b, n) => { let s = ''; for (let i = 0; i < n; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; };
  const padK = new Map();   // 키 → [안쪽 패드, 바깥 패드] (키는 연결마다 하나라 몇 개 안 된다)
  // HMAC-SHA-256(키, 메시지) 앞 8바이트 = 16자 (64비트 — 키 없이 맞힐 수 없고, 채널로 한 번씩만 시도할 수 있다)
  function hmac(key, msg) {
    let P = padK.get(key);
    if (!P) { let k = te.encode(String(key)); if (k.length > 64) k = sha256(k); const ip = new Uint8Array(64), op = new Uint8Array(64); for (let i = 0; i < 64; i++) { const v = i < k.length ? k[i] : 0; ip[i] = v ^ 0x36; op[i] = v ^ 0x5c; } P = [ip, op]; if (padK.size > 64) padK.clear(); padK.set(key, P); }   // 64바이트 넘는 키는 먼저 해시 (RFC 2104 — 이 게임 키는 32자)
    const mb = te.encode(String(msg)), a = new Uint8Array(64 + mb.length); a.set(P[0]); a.set(mb, 64);
    const o = new Uint8Array(96); o.set(P[1]); o.set(sha256(a), 64);
    return hex(sha256(o), 8);
  }
  // 연결마다 새 키 (128비트 → 32자)
  function newKey() { const b = new Uint8Array(16); try { crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0; } return hex(b, 16); }
  // 직접 연결로 온 상대 키 { ky: [키, kn] } — kn: 상대가 그때까지 보낸 중계 번호. 그 근처(kn-64 초과)부터 받는다 (키보다 늦게 도착한 그 전 중계도 받게)
  //  키를 받기 전에 받은 번호 중 kn 이하만 남긴다 — 엿본 예전 중계를 키를 받은 뒤 다시 보내도 받지 않게 · 꾸민 큰 번호가 뒤의 진짜 번호를 막지 않게
  function setKey(p, ky) {
    if (!Array.isArray(ky) || typeof ky[0] !== 'string' || !/^[0-9a-f]{32}$/.test(ky[0]) || p.kr === ky[0]) return;   // 같은 키(r·u 채널이 열릴 때 두 번)
    const kn = Number.isSafeInteger(ky[1]) && ky[1] >= 0 ? ky[1] : 0, s = new Set();
    p.kr = ky[0]; p.rb = Math.max(0, kn - 64); p.rm = p.rb;
    if (p.rs) for (const v of p.rs) if (v > p.rb && v <= kn) { s.add(v); if (v > p.rm) p.rm = v; }
    p.rs = s;
  }
  // 받은 중계 번호 적기: 키를 받은 뒤에는 오래된 번호를 밀어낸다(rb — 그 아래는 받지 않음) · 받기 전에는 먼저 적은 것부터 버림 (꾸민 번호로 창이 밀리지 않게)
  function seenSq(p, sq, keyed) {
    const s = p.rs || (p.rs = new Set()); s.add(sq);
    if (keyed) { if (sq > p.rm) p.rm = sq; if (s.size > 300) { p.rb = Math.max(p.rb, p.rm - 200); for (const v of s) if (v <= p.rb) s.delete(v); } }
    else if (s.size > 300) for (const v of s) { s.delete(v); if (s.size <= 200) break; }
  }
  const gStr = (from, to, sq, d) => 'g|' + from + '|' + to + '|' + sq + '|' + d;
  const byeStr = (from, to, next, g) => 'bye|' + from + '|' + to + '|' + JSON.stringify([next || null, Array.isArray(g) ? g : null]);
  // 중계('g')를 받을지 — 상대 키가 있으면 서명이 맞고 처음 보는 번호만 · 없으면(예전 화면 · 직접 연결이 안 됨) 받는다,
  //  단 그 상대와 직접 연결로 방금까지 받고 있었으면 버림 (진짜 그 사람은 직접 연결로 보내는 중 — 중계로 바꾸면 그쪽 직접 연결로는 아무것도 오지 않는다)
  function relayOk(p, m) {
    const sq = m.sq, okN = Number.isSafeInteger(sq) && sq > 0;
    if (!p.kr) {
      if (p.open && !p.relay && now() - p.dcRx < 0.8 && now() - (p.openT || 0) > 1.5) { N.stats.bad++; return false; }   // 막 열린 연결(1.5초)은 그 전에 보낸 중계가 늦게 올 수 있어 받는다
      if (okN) seenSq(p, sq, false);
      return true;
    }
    // 모양·크기를 먼저 보고 해시 (꾸민 큰 내용으로 해시를 시키지 못하게 — 진짜 중계는 아이템 목록 묶음도 수십 KB)
    if (!okN || sq <= p.rb || p.rs.has(sq) || typeof m.d !== 'string' || m.d.length > 120000 || typeof m.tg !== 'string' || m.tg.length !== 16 || m.tg !== hmac(p.kr, gStr(p.uid, N.me, sq, m.d))) { N.stats.bad++; return false; }
    seenSq(p, sq, true); return true;
  }
  // 나가는 사람의 매칭 채널 'bye' 서명 — 연결 상대마다 (방장 = 모든 파티원 · 파티원 = 방장)
  function byeTags(next, g) { const t = {}; for (const p of N.peers.values()) t[p.uid] = hmac(p.ks, byeStr(N.me, p.uid, next, g)); return t; }
  // 매칭 채널 'bye' 를 받을지: 보낸 사람이 연결 상대이고 그 키가 있으면 내 서명이 맞아야 · 키가 없으면(예전 화면 등) 그대로
  //  파티원 기기에서 연결 상대가 아닌 사람(다른 파티원)의 'bye' 는 서명을 확인할 수 없으므로 그 사람이 아직 자기 캐릭터를 움직이면 버림 (진짜로 나갔으면 방장이 연결로 넘겨준다)
  function byeOk(m) {
    const p = N.peers.get(m.from);
    if (!p) return N.host || !playing(m.from);
    if (!p.kr) return true;
    const t = m.tg && typeof m.tg === 'object' ? m.tg[N.me] : null;
    if (typeof t === 'string' && t.length === 16) { let s = null; try { s = byeStr(m.from, N.me, m.next, m.g); } catch (e) { /* 너무 깊은 g 등 */ } if (s && s.length < 20000 && t === hmac(p.kr, s)) return true; }
    N.stats.bad++; return false;   // 서명이 안 맞음 (stats.bad 는 서명이 틀린 것만 센다)
  }
  // ---------- 다시 들어오기 증명 (v24) ----------
  //  돌아온 사람의 'rj' 는 로비 채널(접속한 모두가 읽음)로 그 경기 사람 모두에게 간다. 방장이 그 사람과 키를 주고받은 자리(peer)를 갖고 있으면
  //  그 사람의 예전 키로 만든 증명(rk — 새로고침 전 페이지가 이어하기 저장에 남긴 내 보내기 키 목록 rjKeys 로)이 맞아야 받아 준다 → 꾸민 'rj' 로 살아 있는 사람 연결을 끊고 키 없는 새 자리로 바꾸지 못하게
  //   · 방장의 답 'rjok' 에도 그 키로 만든 서명(tg) — 돌아온 사람은 서명이 맞는 답을 먼저 믿는다 (아무나 '내가 방장'이라고 답해 가로채지 못하게)
  //   · 증명은 그 키로만 맞으므로, 돌아온 뒤 새 연결로 새 키를 주고받으면 엿본 예전 증명을 다시 보내도 맞지 않는다
  //   · 키 없는 자리(예전 화면 · 직접 연결이 한 번도 안 된 사람 · 방장이 바뀌어 그 사람 자리가 새로 생김)는 예전처럼 증명 없이
  //   · 'rjok' 서명에는 넘겨받은 횟수(ep)·스타트 섬(isl)·그 물음의 1회용 번호(rn)까지 — 엿본 서명된 답을 다른 값으로 바꿔 다시 보내지 못하게
  const rjStr = (uid, mid) => 'rj|' + uid + '|' + mid;
  const rjokStr = (host, uid, mid, ep, isl, rn) => 'rjok|' + host + '|' + uid + '|' + mid + '|' + (+ep || 0) + '|' + (isl ? 1 : 0) + '|' + (typeof rn === 'string' ? rn.slice(0, 24) : '');
  function rjProof(p, from, m) { return Array.isArray(m.rk) && m.rk.slice(0, 6).some((t) => typeof t === 'string' && t.length === 16 && t === hmac(p.kr, rjStr(from, N.cfg.mid))); }
  // 이어하기 저장에 남길 내 보내기 키 (방장 자리마다 하나 — 처음 방장 · 넘겨받은 방장들 · 최근 4개) · mid: 그 경기 것만
  //  경기를 나간 뒤에도 마지막 경기 것을 돌려준다 — 창을 닫을 때 이어하기 저장이 나가기(leave) 뒤에 한 번 더 불려도(10_resume.js pagehide) 키가 비지 않게
  let rjMid = null, rjMine = [];
  function rjKeys(mid) { return mid && mid === rjMid ? rjMine.slice(-4) : []; }
  // 이 사람이 아직 이 경기에서 자기 캐릭터를 움직이는지 (방장이 봇에게 넘기지 않음) — 파티 채널 'bye'(10_social.js)는 경기를 떠난 뒤 로비에서만 보내므로 그 전에 온 것은 꾸민 것
  function playing(uid) { return !!N && !N.ended && typeof uid === 'string' && uid !== N.me && CHARS.some((c) => c.human && c.uid === uid && c.net && c.net.owner === uid && !c.botized); }

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
  // rj (v23 이어하기 — 10_resume.js): 나갔다가 같은 경기로 돌아옴 { ep: 방장 넘겨받은 횟수, isl: 방장이 아직 스타트 섬, mine: 저장해 둔 내 캐릭터 }
  //  → 방장에게 연결해 지금 상태(rjs)를 받을 때까지 내 캐릭터 상태를 보내지 않는다(hold)
  function join(cfg, rj) {
    if (!Cloud.uid || G.state === 'loading') return;
    if (cfg.v !== NET_VER) { Ver.tell(cfg.v, (cfg.humans.find((h) => h.uid === cfg.host) || {}).name); return; }   // 방장(경기 설정)과 게임 버전이 다름 → 들어가지 않음
    if (N) close(true);
    if (G.state === 'play' || G.state === 'result') { $('resultPanel').hidden = true; disposeMatch(); G.state = 'lobby'; }
    // 이번 경기만 방장 설정 (저장하지 않음). 온라인 매칭은 모르는 사람의 설정이므로 끝나면 내 설정으로 되돌린다
    const own = cfg.mm ? Object.assign({ game: SETTINGS.game }, ...Object.keys(cfg.s).map((k) => ({ [k]: SETTINGS[k] }))) : null;
    for (const k in cfg.s) SETTINGS[k] = cfg.s[k];
    SETTINGS.game = cfg.game;
    const myIdx = cfg.humans.findIndex((h) => h.uid === Cloud.uid);
    N = { cfg, host: cfg.host === Cloud.uid, me: Cloud.uid, myIdx, peers: new Map(), quiet: 0, applying: 0, seq: 0, uidBase: (myIdx + 1) * 1e7, uidN: 0, own,
      items: new Map(), vehs: [], outB: [], tickT: 0, zoneT: 0, t0: now(), welcomed: false, ended: false, ready: false, hiT: 0, gone: new Set(), epoch: 0, mig: false, claimN: 0, claimT: 0, lost: 0, lostDt: 0, lostQ: 0, lostTold: false, stats: { tx: 0, rx: 0, bad: 0 }, myKeys: [] };   // gone: 나간 사람 · epoch·mig: 방장 넘겨받은 횟수 · claim: 새 방장 알림 · lost: 파티원 — 방장이 아직 경기 중인 내 캐릭터를 봇에게 넘긴 시각('own' · 0 = 아님) · stats.bad: 서명이 안 맞아 버린 채널 메시지 · myKeys: 방장에게 쓴 내 키들 (다시 들어오기 증명 — rjKeys)
    // 돌아온 사람: 'hi'를 방장이 offer 할 때까지 되풀이(mig) · 파티 경기는 파티 채널에 없으므로 신호를 로비 채널로(lob)
    if (rj) { N.rj = rj; N.hold = true; N.mig = true; N.epoch = rj.ep || 0; N.lob = !cfg.mm; }
    G.net = N; G.netAuthority = () => !N || N.host;
    // 온라인 매칭: 이 경기 채널로 신호. 방장은 파티원이 '들어왔다(hi)'고 알릴 때 연결을 시작한다 (채널에 늦게 들어온 사람이 신호를 놓치지 않게)
    if (cfg.mm) MM.chOpen(cfg.mm, onMM, () => { if (N && !N.host) hi(); });
    if (N.host) { for (const hm of cfg.humans) if (hm.uid !== N.me) N.peers.set(hm.uid, newPeer(hm.uid, true, !!cfg.mm)); }
    else { const hp = newPeer(cfg.host, false); N.peers.set(cfg.host, hp); N.myKeys.push(hp.ks); }
    rjMid = cfg.mid; rjMine = N.myKeys;   // 다시 들어오기 증명 키 (follow 가 같은 배열에 더함 — rjKeys)
    if (pendBuf) { const b = pendBuf; pendBuf = null; for (const m of b) if (m.from === cfg.host || N.host) onSig(m); }
    if (N.lob) hi();
    if (cfg.dm) DM.start(dmCfg(cfg)); else G.startMatchNet(cfg);
  }
  const viaMM = () => !!(N && N.cfg.mm);
  // 신호·중계 보내기: 온라인 매칭은 경기 채널, 파티는 파티 채널
  //  v23: 파티 경기에 다시 들어온 사람(파티 채널에 없음)과는 로비 채널로 — 받는 사람(to)이 그런 사람이거나 내가 돌아온 사람이면
  function bus(k, d) {
    if (N && !viaMM()) {
      const to = d && d.to;
      if (to) { const p = N.peers.get(to); if (N.lob || (p && p.lob)) return lobSend(to, k, d); }
      else {   // 모두에게(방장 알림 등): 로비로 붙은 사람에게도 따로
        for (const p of N.peers.values()) if (p.lob && !N.lob) lobSend(p.uid, k, d);
        if (N.lob) { for (const h of N.cfg.humans) if (h.uid !== N.me && !N.gone.has(h.uid)) lobSend(h.uid, k, d); return true; }
      }
    }
    return viaMM() ? MM.chSend(k, d) : Party.send(k, d);
  }
  function lobSend(to, k, d) { const o = Object.assign({}, d); delete o.to; o.nk = k; o.mid = N.cfg.mid; return Social.send(to, 'nt', o); }
  function hi() { if (N && !N.host) { N.hiT = now(); bus('hi', { to: N.cfg.host }); } }
  // 경기 채널로 온 메시지 (나머지 sig·g·hi·host 는 파티 채널과 같이 onParty)
  function onMM(m) {
    if (!N || typeof m.from !== 'string' || (m.to && m.to !== Cloud.uid)) return;
    if (m.k === 'bye') {   // v24: 서명이 맞아야 (byeOk — 키를 건넨 상대 · 다른 파티원의 'bye' 는 그 사람이 정말 떠났을 때만)
      if (!byeOk(m)) return;
      const bp = N.peers.get(m.from);
      if (!N.host && m.from === N.cfg.host) keepGone(m.g); peerLeft(m.from, m.next, !!(bp && bp.kr)); return;   // 나가는 방장의 나간 사람 목록(g) — keepGone · sure: 서명을 확인한 'bye' 만 (방장이 다른 파티원에게 알림)
    }
    onParty(m);
  }
  // 파티원이 '연결해 주세요(hi)' → 방장이 offer (온라인 매칭 처음 · 방장을 넘겨받은 뒤)
  //  v24: 직접 연결을 한 번도 시작하지 않은 채 12초가 지나 중계로 바뀐 자리(온라인 매칭 — 늦게 들어온 사람의 'hi')에도 처음 offer 는 보낸다
  //   (전에는 경기 내내 중계 = 느리고 서명 키도 없음) · 키를 주고받은 자리에는 다시 offer 하지 않는다 (파티원 기기도 받지 않음 — onSig)
  function onHi(m) {
    if (!N || !N.host) return;
    const p = N.peers.get(m.from);
    if (p && !p.open && !p.kr && (!p.relay || !p.pc) && (!p.pc || (p.offerT && now() - p.offerT > 5))) offer(p);
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
  // v24 채널 서명: ks 내 키(이 상대에게 보내는 중계·'bye' 서명) · tn 보낸 중계 번호 · kr 상대 키(직접 연결로 받음 — 없으면 서명 확인 없이) · rb·rm·rs 받은 중계 번호 창 · dcRx 직접 연결로 마지막으로 받은 때
  function newPeer(uid, offerer, defer) {
    const p = { uid, pc: null, r: null, u: null, open: false, relay: false, t0: now(), lastRx: now(), pend: [], oid: 0, offerT: 0, name: (N.cfg.humans.find((h) => h.uid === uid) || {}).name || '?',
      ks: newKey(), tn: 0, kr: null, rb: 0, rm: 0, rs: null, dcRx: 0 };
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
    // 열리면 먼저 이 연결로 내 키를 건넨다 (v24 채널 서명 — 이 뒤 중계·'bye' 를 상대가 확인할 수 있게)
    //  openT: 열린 때 (키 없는 상대의 늦게 온 중계를 1.5초 동안은 받는다 — relayOk) · held: 중계 틱을 기다리던 사건은 이 연결로 바로 (중계가 끝나 다음 중계 틱이 오지 않으므로 — 전에는 사라졌다)
    dc.onopen = () => { if (!N) return; if (p.r && p.r.readyState === 'open') { p.open = true; p.openT = now(); if (p.relay) { p.relay = false; } sendTo(p, { ky: [p.ks, p.tn] }, true); if (p.held && p.held.length) sendTo(p, { e: p.held.splice(0) }, true); hello(p); linkUp(p); } };   // N 없음: 나간 뒤 0.4초 안에 열린 연결 (곧 닫힘)
    dc.onmessage = (e) => recv(p, e.data, true);
    dc.onclose = () => { if (p.open) { p.open = false; if (N && !N.ended) toRelay(p, 'closed'); } };
  }
  // 중계로 바꾸지 않는 연결: 나간 사람(left — 'bye' · 20초 끊김 · 파티 채널 알림 · 버전 다름 · 넘겨받을 때 봇이던 사람) · 지금 자리가 아닌 지난 연결(다시 들어오기·방장 넘겨받기로 바뀐 자리에 늦게 온 닫힘 알림)
  //  예전엔 나간 사람의 연결이 닫히면 중계로 바꿔 「서버 중계로 전환」 알림을 띄우고 경기 끝까지 0.2초마다 보냈다 (실시간 메시지 한도 = 프로젝트 전체 초당 100개)
  //  예외: 'bye' 없이 나간 것으로 본 사람이 중계로 보내오면(peer-relay — 잠깐 끊겼다 돌아옴) 바꾼다 · 알림 없이 (곧 unbotize 의 「다시 연결되었습니다」)
  function toRelay(p, why) { if (p.relay || p.bad || !N || N.peers.get(p.uid) !== p || (p.left && (p.bye || why !== 'peer-relay'))) return; p.relay = true; console.warn('중계 전환', p.uid, why); if (!N.ended) { if (!p.left) HUD.toast(`${p.name}님과 직접 연결이 안 되어 서버 중계로 전환합니다 (움직임이 덜 부드러울 수 있음)`, 'warn'); hello(p); linkUp(p); } }
  // 연결이 생기면: 밀린 사건 전송, 방장은 인사를 받았던 파티원에게 현재 상태
  function linkUp(p) {
    if (p.q && p.q.length) { const q = p.q.splice(0); for (const m of q) sendTo(p, m, true); }
    if (N.host && p.helloSeen) welcome(p);
  }
  function sig(to, d, o) { bus('sig', { to, d, o: o || 0 }); }
  async function onSig(m) {
    if (!N) { (pendBuf || (pendBuf = [])).push(m); return; }
    const p = N.peers.get(m.from), d = m.d; if (!p || !d || typeof d !== 'object') return;
    const o = m.o || 0, isOffer = !!(d.sdp && d.sdp.type === 'offer');
    // v24: 연결 제안(offer)은 방장만 보낸다 · 키를 주고받은 상대(직접 연결이 됐던 연결)에게는 방장도 다시 제안하지 않는다 (한 번 열린 연결은 열려 있거나 중계 — 방장의 onHi 는 둘 다 아닐 때만)
    //  → 채널로 꾸민 제안(방장 이름)으로 연결을 끊고 가로채 키를 받아 가지 못하게. 새 방장·다시 들어오기는 새 자리(peer)라 키가 없어 그대로 받는다
    if (isOffer && (N.host || p.kr)) return;
    // 방장이 연결을 새로 시작함 → 나도 새 연결 (온라인 매칭: 내가 채널에 늦게 들어와 처음 offer 를 놓친 경우 등)
    if (!N.host && isOffer && o !== p.oid) { try { if (p.pc) p.pc.close(); } catch (e) { /* */ } p.oid = o; p.pend = []; p.open = false; p.r = p.u = null; makePc(p, false); }
    if (o !== p.oid || !p.pc) return;   // 지난 연결의 신호
    const pc = p.pc;
    if (isOffer) { if (p.offO === o) return; p.offO = o; }   // 같은 연결 번호의 두 번째 제안 = 다시 협상 (이 게임은 하지 않는다 — 먼저 온 것만)
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
    else if (m.k === 'g' && N) { const p = N.peers.get(m.from); if (p && relayOk(p, m)) { if (m.lob) p.lob = true; if (!p.relay && !p.open) toRelay(p, 'peer-relay'); recv(p, m.d, false); } }   // v24: 서명·번호 확인 (relayOk) · lob: 로비 채널로 온 맞는 중계 → 그 사람과는 로비 채널로
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
    if (p.relay) { const sq = ++p.tn; bus('g', { to: p.uid, d: s, sq, tg: hmac(p.ks, gStr(N.me, p.uid, sq, s)) }); }   // v24: 번호·서명 (키를 받은 상대만 확인 — 예전 화면은 모르는 칸을 무시)
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
    for (const p of N.peers.values()) { if (p.bad) { verDrop(p, p.badV); continue; } if ((p.open || p.relay) && p.needHello) hello(p); if (p.needWelcome) welcome(p); }
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
  // 나간 사람(left)에게 보내지 않을 때(quiet): 'bye' 를 보낸 사람 · 중계 · 연결이 닫힌 사람 (파티원 기기는 방장이 left 면 늘)
  //  'bye' 없이 나간 것으로 본 사람(20초 끊김 · 파티 채널 알림 · 넘겨받을 때 봇이던 사람)과 데이터 채널이 아직 열려 있으면 그대로 보낸다 — 데이터 채널은 실시간 한도와 상관없고,
  //  화면만 멈췄던(받기는 그대로) 그 기기가 아이템·보급·주인 바뀜을 놓치지 않고, 받은 지 20초 판정으로 방장을 넘겨받지도 않게
  const quiet = (p) => !!p.left && (!N.host || !!p.bye || p.relay || !p.open);
  const humanOf = (id) => { const c = charById(id); return c ? c.uid || c.origOwner : null; };   // 캐릭터 번호 → 그 사람 uid (봇이면 null)
  function flush(force) {
    if (!N || !N.outB.length) return;
    const list = N.outB.splice(0);
    if (N.host) {
      // 나간 사람(left): 조용한 사람(quiet)에게는 'bye' 사건만 (한 번씩이라 중계여도 바로 — 'bye' 없이 나간 것으로 본 사람이 돌아오면 그사이 나간 사람·나가는 방장이 고른 다음 방장을 안다) · 'bye' 를 보낸 사람에게는 아무것도
      //  데이터 채널이 열린 사람에게는 다 보내되 그 사람 캐릭터의 'own'(botize · 넘겨받은 방장의 adopt)만 뺀다 → 그 기기는 자기 캐릭터를 계속 움직여 상태를 보내고 방장이 그 상태로 unbotize
      //  v24 rs: 봇이 맡은 사이 죽은 캐릭터의 주인에게 다시 보내는 'own'·사망(lostAgain — 그 사람에게만)은 막지 않는다 (그 사람이 지금 살아 있다는 상태를 보내오는 중 = 연결은 살아 있음)
      for (const [uid, p] of N.peers) { const q = quiet(p), mine2 = list.filter((e) => (!e.to || e.to === uid) && e.from !== uid && (e.rs || (q ? e.k === 'bye' && !p.bye : !(p.left && e.k === 'own' && humanOf(e.c) === uid)))); if (mine2.length) { if (p.relay && !force && !p.left) { (p.held || (p.held = [])).push(...mine2); continue; } sendTo(p, { e: mine2 }, true); } }
    } else { const p = N.peers.get(N.cfg.host); if (p && !p.left) { if (p.relay && !force) { (p.held || (p.held = [])).push(...list); return; } sendTo(p, { e: list }, true); } }
  }

  // ---------- 받기 ----------
  // dc: 직접 연결(데이터 채널)로 옴 — 상대 키(ky)는 이렇게 온 것만 받는다 (중계는 채널이라 모두가 읽는다)
  function recv(p, data, dc) {
    if (!N || p.bad) return;   // bad: 게임 버전이 달라 내보낸 사람 (verDrop)
    let m; try { m = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    p.lastRx = now(); N.stats.rx += (data && data.length) || 0;
    if (dc) { p.dcRx = p.lastRx; if (m.ky) setKey(p, m.ky); }   // 맵을 만드는 중(아래 rj)이어도 키는 먼저
    if (N.rj && !N.ready) return;   // 다시 들어오는 중 · 아직 맵을 만드는 중: 버림 (인사한 뒤 방장이 지금 상태를 통째로 보낸다 — 그 전 사건을 적용하면 아이템 칸이 없어 오류)
    if (m.s) for (const a of m.s) applyChar(a, p);
    if (m.v) for (const a of m.v) applyVeh(a);
    if (m.w) applyWorld(m.w);
    if (m.e) for (const e of m.e) {
      e.from = N.host ? p.uid : e.from || p.uid;   // 보낸 사람: 방장은 실제로 보낸 파티원으로 (파티원은 남의 사건을 넘기지 않음 — v23 핑처럼 보낸 사람을 믿는 사건을 다른 사람 이름으로 꾸며 넘기지 못하게)
      if (N.host && e.k === 'bye') e.uid = p.uid;   // 'bye' 를 넘길 때 나간 사람(uid)도 실제로 보낸 파티원으로 — 이번 업데이트 전 화면(파티원)은 e.uid 를 읽으므로 꾸민 이름이 그대로 넘어가지 않게
      if (N.host && e.to && e.to !== N.me) { const tp = N.peers.get(e.to); if (!tp || tp.left) e.to = N.me; } // 떠난 사람 앞 사건은 방장이 대신 처리
      // 방장: 다른 파티원에게 넘길 것 ('bye' 는 peerLeft 가 따로 알림 — v24, 어떻게 알았든 한 번)
      if (N.host && (!e.to || e.to !== N.me) && e.k !== 'bye') { const fw = Object.assign({}, e); N.outB.push(fw); }
      if (!e.to || e.to === N.me) handle(e, p.uid);
    }
  }
  // 번호 → 캐릭터 (CHARS 가 바뀌거나 늘면 다시 만든다 — 받은 상태마다 배열 전체를 훑지 않게)
  let cmA = null, cmN = -1, cmM = null;
  const charById = (id) => { if (cmA !== CHARS || cmN !== CHARS.length) { cmA = CHARS; cmN = CHARS.length; cmM = new Map(); for (const c of CHARS) cmM.set(c.id, c); } return cmM.get(id) || null; };
  // 받은 피해: 숫자가 아니거나 음수·무한이면 -1(버림), 아니면 NET_HIT_MAX 까지 (내 기기에서 준 피해는 그대로)
  const hitDmg = (d) => (Number.isFinite(d) && d >= 0 ? Math.min(d, NET_HIT_MAX) : -1);
  function handle(e, from) {
    switch (e.k) {
      case 'hello': { if (N.host) { const p = N.peers.get(from); if (p) { if (e.v !== NET_VER) { verDrop(p, e.v); break; } p.helloSeen = true; welcome(p); } } break; }
      case 'welcome': applyWelcome(e); break;
      case 'hit': { const t = charById(e.v); if (!t || !mine(t)) return; const dm = hitDmg(e.d); if (dm < 0) return; const a = e.a >= 0 ? charById(e.a) : null; const d = applyDamage(t, dm, e.p, a, e.c, e.h && e.h[0], e.h && e.h[1], e.h && e.h[2]); if (a && d > 0 && !mine(a)) ev({ k: 'dealt', a: a.id, d: r2(d) }, ownerOf(a)); break; }
      case 'own': { if (N.host || e.from !== N.cfg.host) break; const c = charById(e.c); if (c && c.net) { if (c.isPlayer) { if (e.o !== N.me) { if (!N.lost) N.lost = now(); break; } if (N.lost) lostEnd(); } c.net.owner = e.o; c.net.mine = e.o === N.me; if (c.uid && c.uid === e.o) N.gone.delete(e.o); } break; }   // v24 아직 경기 중인 내 캐릭터를 방장이 봇에게 넘김(botize — 파티 채널만 5초 끊김 · 내 상태가 20초 안 닿음 · 꾸민 채널 'bye' · 새 방장 adopt): 넘겨주지 않고 계속 내가 움직이며 상태를 보낸다 → 방장이 그 상태를 받으면 돌려준다(applyChar unbotize → 'own' 이 나에게) · 예전엔 여기서 내 캐릭터가 남의 것이 되어 상태를 안 보냈고, 방장은 상태가 와야 돌려주므로 영영 봇이 움직였다 (lost 동안: 방장 기기 쪽 기절·사망은 따름 — lostMe · 다음 방장 순서는 다른 기기처럼 봇으로 — successors) · 캐릭터 주인 바뀜은 방장이 보낸 것만 (botize·unbotize · 넘겨받은 새 방장의 adopt — 파티원이 꾸며 보낸 'own' 으로 남의 캐릭터를 가져가지 못하게) · 사람 캐릭터가 주인에게 돌아오면(unbotize — 이어하기·잠깐 끊김) 파티원 기기도 나간 사람(gone)에서 지운다 → 그 뒤 방장이 바뀌어도 다음 방장 후보·다시 연결할 사람에 든다
      case 'dealt': { const a = charById(e.a); if (a && mine(a) && Number.isFinite(e.d) && e.d > 0) a.damageDealt += e.d; break; }   // 숫자가 아니거나 무한이면 버림 (기록이 망가지지 않게)
      case 'kreq': { const t = charById(e.v); if (t && mine(t) && t.alive) killChar(t, e.a >= 0 ? charById(e.a) : null, e.c); break; }
      case 'knock': netKnock(e); break;
      case 'death': netDeath(e); break;
      case 'rev': netRevive(e); break;
      case 'shot': remoteShot(e); break;
      case 'throw': remoteThrow(e); break;
      case 'rkt': { const c = charById(e.c); if (c && !mine(c) && G.scene) { const p = new THREE.Vector3(e.p[0], e.p[1], e.p[2]), D = new THREE.Vector3(e.v[0], e.v[1], e.v[2]); spawnRocket(c, p, D, p, ITEMS.pzf, true); backblast(p.clone().addScaledVector(D, -1.1), D); Audio.rocket('launch', p, false); c.lastShotT = G.time; } break; }   // 판처파우스트: 보이기·소리만
      case 'pu': remotePunch(e); break;
      case 'rc': Recall.onNet(e, from); break;   // 리콜: 등록 요청(→방장)·승인(방장→모두)·단말기 작동·거절
      case 'gadd': { if (N.items.has(e.u)) break; N.applying++; spawnItem(G.scene, e.i, e.n, e.x, e.y, e.z, e.in || null, e.u, e.bx || null); N.applying--; break; }
      case 'gdel': { const it = N.items.get(e.u); if (it && it.alive) { N.applying++; removeItem(it); N.applying--; } break; }
      case 'gcnt': { const it = N.items.get(e.u); if (it) it.count = e.n; break; }
      case 'vhit': { const v = N.vehs[e.n]; if (v && !vehRemote(v) && Number.isFinite(e.d)) Veh.damage(v, e.d, e.a >= 0 ? charById(e.a) : null, e.c); break; }   // 차량은 판처파우스트 직격(1e6)까지 받으므로 숫자인지만
      case 'vseat': { const v = N.vehs[e.n], who = charById(e.c); if (v && who) Veh.yieldSeat(v, who); break; }   // 파티원이 봇이 앉은 차에 타려 함 → 방장이 봇을 내리게 함
      case 'vboom': { const v = N.vehs[e.n]; if (v && vehRemote(v)) Veh.netBoom(v); break; }
      case 'zone': applyZone(e.z); break;
      case 'air': if (!N.host) Airdrop.launch(e.x, e.z, e.a, true); break;
      case 'score': if (G.dm) DM.applyScore(e.sc, e.over, e.win, e.t); break;
      case 'duel': if (G.dm) DM.applyDuel(e); break;   // 대결 라운드 진행 (방장이 정함)
      case 'loot': recvLoot(e); break;
      case 'lootReq': if (N.host) sendLoot(N.peers.get(from)); break;
      case 'vehs': recvVehs(e); break;
      case 'bye': { const u = N.host ? from : e.from || from; if (N.host) { const bp = N.peers.get(from); if (bp) bp.bye = true; } else if (u === N.cfg.host) keepGone(e.g); peerLeft(u, e.next, N.host); break; }   // 나간 사람 = 실제로 보낸 사람: 방장은 보낸 파티원(from) · 파티원은 방장이 적어 넘긴 보낸 사람(e.from — 방장 자신의 'bye' 면 방장). e.uid 는 믿지 않는다 (꾸민 화면이 다른 사람이 나간 것처럼 만들어 그 캐릭터를 봇에게 넘기지 못하게 — 예전 화면이 읽도록 보내기만) · 방장: 'bye' 를 보낸 연결(bye)의 늦게 온 상태로는 봇을 되돌리지 않음 (applyChar) · 파티원: 나가는 방장의 나간 사람 목록(g — keepGone)
      case 'isl': if (!N.host && G.island) Island.end(); break;   // 방장의 스타트 섬이 끝남 → 모두 수송기로
      case 'rjs': applyRj(e); break;   // v23 다시 들어옴: 방장이 보낸 지금 상태
      case 'vic': Victory.onNet(e); break;   // v23 우승 축하: 파티원의 동상 세우기·춤
      case 'pg': try { TeamPing.onNet(e); } catch (er) { console.warn('핑 받기', er); } break;   // v23 팀 핑·지도 마커 (09_player_ping.js — 같은 팀 사람 + 팀원 봇을 움직이는 방장에게만 온다 · 이상한 값으로 이 묶음의 다른 사건을 놓치지 않게)
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
    const w = { k: 'welcome', t: G.time, sum: G.dm || p.rj ? null : N.baseSum, zone: G.dm ? null : zoneSnap(), sc: G.dm ? G.dm.score : null };
    sendTo(p, { e: [w] }, true);
    p.welcomed = true;
    if (p.rj) rjPack(p);
  }

  // ---------- 다시 들어오기 (v23 · 10_resume.js) ----------
  //  나갔던 사람(새로고침·뒤로가기·탭 닫힘)이 같은 경기로 돌아옴. 그동안 그 사람 캐릭터는 방장 기기에서 봇이 이어서 했다(botize)
  //  1. 돌아온 사람 → 로비 채널로 그 경기 사람들 모두에게 'rj' (지금 방장이 누군지 모름 — 그사이 바뀌었을 수 있다)
  //  2. 지금 방장만 답함 'rjok' { 방장 · 넘겨받은 횟수 · 스타트 섬 } + 그 사람 자리(peer)를 새로 만듦
  //  3. 돌아온 사람이 같은 설정으로 경기를 열고 방장에게 연결 (온라인 매칭: 그 경기 채널 · 파티: 로비 채널로 신호)
  //  4. 인사(hello)를 받은 방장 → welcome + 지금 상태 'rjs' (아이템·차량 목록 · 죽은 캐릭터 · 팀 순위 · 누가 어느 캐릭터를 맡는지 · 그 사람 캐릭터)
  //  5. 돌아온 사람이 맞춘 뒤에야 자기 캐릭터 상태를 보냄 → 방장이 봇을 멈추고 돌려줌(unbotize)
  //  아무도 답하지 않으면(경기가 끝났거나 모두 나감) 돌아온 사람 쪽에서 '이미 끝남'
  function onLobby(m) {
    const k = m.nk, from = m.from && m.from.uid; if (!k || typeof from !== 'string') return;
    if (k === 'rj') { onRejoinReq(from, m); return; }
    if (k === 'rjok') { if (probeP && m.mid === probeP.mid) probeP.ans(from, m); return; }   // v24: 그 경기 사람의 답만 · 서명이 맞는 답을 먼저 (probe)
    if (k === 'rjno') { if (probeP && m.mid === probeP.mid) probeP.no(from); return; }   // v24: 방장이 증명을 확인하지 못해 거절 — 끝난 경기로 기록하지 않고 '다시 시도'
    if (!N || m.mid !== N.cfg.mid || N.cfg.mm) return;   // v24: 온라인 매칭 경기는 로비 채널로 신호·중계를 하지 않는다(bus — 경기 채널) → 받지 않음 (로비 채널은 접속한 모두가 보낼 수 있다)
    // 이 사람과는 로비 채널로 — 키를 주고받은 상대는 서명이 맞는 중계가 로비로 왔을 때만 (onParty) · 꾸민 메시지로 그 사람 길을 로비 채널로 돌리지 못하게
    const p = N.peers.get(from); if (p && !p.kr) p.lob = true;
    onParty({ k, from, to: Cloud.uid, d: m.d, o: m.o, uid: m.uid, ep: m.ep, next: m.next, sq: m.sq, tg: m.tg, lob: 1 });   // sq·tg: 중계 번호·서명 (v24)
  }
  function onRejoinReq(from, m) {
    if (!N || N.ended || !N.host || m.mid !== N.cfg.mid || from === N.me || !N.cfg.humans.some((h) => h.uid === from)) return;
    let p = N.peers.get(from);
    // v24: 그 사람과 키를 주고받은 자리면 예전 키로 만든 증명(rk)이 있어야 — 없으면 꾸민 것 (살아 있는 연결을 끊고 키 없는 새 자리로 바꾸거나, 나간 사람 캐릭터를 가져가지 못하게)
    if (p && p.kr && !rjProof(p, from, m)) { Social.send(from, 'nt', { nk: 'rjno', mid: N.cfg.mid }); return; }   // 거절도 알림 — 그 사람 기기가 다시 들어오는 중이면 '끝난 경기'로 기록하지 않게 (꾸민 'rj' 였으면 그 사람은 묻지 않았으므로 무시)
    if (!p || !p.rj || now() - p.t0 > 8) {   // 새 자리 (8초 안에 다시 물으면 그대로) — 키는 새로 (예전 키로 서명된 지난 중계를 새 연결에 다시 보내지 못하게)
      const rjK = p && p.kr ? p.kr : null;   // 답 서명에 쓸 그 사람 예전 키 (돌아온 사람이 진짜 방장의 답을 알아보게 — 새 자리는 답에만 씀)
      if (p) closePeer(p);
      p = newPeer(from, true, true); p.rj = true; p.rjK = rjK; N.peers.set(from, p);
    }
    p.lob = !N.cfg.mm; p.bye = false; p.rjAt = now(); N.gone.delete(from);   // rjAt: 그 전 접속의 늦은 파티 채널 알림을 15초 동안 무시 (partyLeft)
    if (G.state === 'result') G.bgSim = true;   // 결과 화면 뒤에서 경기를 다시 돌린다 (돌아온 사람이 할 경기)
    N.rjKeep = now() + 40;
    const isl = G.island ? 1 : 0;
    Social.send(from, 'nt', { nk: 'rjok', mid: N.cfg.mid, host: N.me, ep: N.epoch, isl, tg: p.rjK ? hmac(p.rjK, rjokStr(N.me, from, N.cfg.mid, N.epoch, isl, m.rn)) : undefined });
  }
  // 돌아온 사람: 지금 방장 찾기 (10초 동안 2초마다 물음) → { host, ep, isl } 또는 null(끝난 경기)
  //  keys: 이어하기 저장에 남긴 예전 페이지의 내 키들(rjKeys) → 'rj' 에 증명(rk) · 'rjok' 서명 확인
  //  답(rjok)은 그 경기 사람에게서 · 방장도 그 경기 사람만. 내 예전 키로 서명이 맞는 답이면 바로, 아니면 처음 답을 1.2초 들고 있다가(그사이 서명 맞는 답이 오면 그것)
  //  — 키 없는 방장(예전 화면 · 내가 나간 사이 바뀐 방장)의 답은 서명이 없으므로 처음 답을 따른다
  let probeP = null;
  function probe(cfg, keys, ms = 10000) {
    return new Promise((res) => {
      const me = Cloud.uid, ks = (Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && /^[0-9a-f]{32}$/.test(k)).slice(-4);
      const rk = ks.map((k) => hmac(k, rjStr(me, cfg.mid))), rn = newKey().slice(0, 16);   // rn: 이번 물음의 1회용 번호 — 방장 답 서명에 들어간다
      const P = probeP = { mid: cfg.mid, done: false, first: null };
      const others = cfg.humans.map((h) => h.uid).filter((u) => u && u !== me);
      const ask = () => { if (!P.done) for (const u of others) Social.send(u, 'nt', { nk: 'rj', mid: cfg.mid, rk: rk.length ? rk : undefined, rn }); };
      const iv = setInterval(ask, 2000), to = setTimeout(() => P.fin(P.first || (P.refused ? { refused: true } : null)), ms);   // refused: 그 경기 사람(방장)이 거절만 함 → 끝난 경기가 아님
      P.fin = (v) => { if (P.done) return; P.done = true; clearInterval(iv); clearTimeout(to); if (probeP === P) probeP = null; res(v); };
      P.ans = (from, m) => {
        const host = typeof m.host === 'string' ? m.host : from; if (P.done || !others.includes(from) || !others.includes(host)) return;
        const v = { host, ep: m.ep || 0, isl: !!m.isl };
        if (typeof m.tg === 'string' && m.tg.length === 16 && ks.some((k) => hmac(k, rjokStr(host, me, cfg.mid, m.ep, m.isl, rn)) === m.tg)) { P.fin(v); return; }
        if (!P.first) { P.first = v; setTimeout(() => P.fin(P.first), 1200); }
      };
      P.no = (from) => { if (others.includes(from)) P.refused = true; };
      if (!others.length) { P.fin(null); return; }
      ask();
    });
  }
  // 방장: 돌아온 사람에게 지금 상태
  function rjPack(p) {
    p.rj = false;
    if (!G.dm) sendLoot(p);   // 지금 바닥 아이템 전부 · 차량 목록(자리)
    const c0 = CHARS.find((c) => c.human && c.uid === p.uid);
    const e = { k: 'rjs', gone: [...N.gone], own: [], dead: [], tp: G.teams && !G.dm ? G.teams.map((T) => T.place || 0) : null, vst: G.dm ? [] : N.vehs.map(encVeh),
      pt: G.plane ? [r2(G.plane.t), G.plane.active ? 1 : 0] : null, me: c0 ? Resume.encChar(c0, (v) => v.nid) : null,
      duel: G.dm && G.dm.duel ? { r: G.dm.round.n, ph: G.dm.round.ph, t: r2(G.dm.round.t0), sc: G.dm.score.slice(), w: G.dm.lastWin, lo: G.dm.loadout } : null };
    for (const c of CHARS) {
      if (c.human && c.net) e.own.push([c.id, c.net.owner]);
      if (!c.alive && !G.dm) e.dead.push([c.id, c.place || 0, r2(c.deathTime || 0), c.kills || 0]);
    }
    sendTo(p, { e: [e] }, true);
  }
  // 돌아온 사람: 받은 상태 적용 → 내 캐릭터 상태를 보내기 시작
  function applyRj(e) {
    const R = N.rj; if (!R || R.done) return; R.done = true;
    N.gone = new Set((e.gone || []).filter((u) => u !== N.me));
    for (const [id, o] of e.own || []) { const c = charById(id); if (!c || !c.net) continue; if (c.isPlayer) { if (o !== N.me && !N.lost) N.lost = now(); continue; } c.net.owner = o; c.net.mine = o === N.me; }   // 내 캐릭터는 그대로 내 것 (방장 기기에서는 아직 봇 — 곧 내 상태를 받고 돌려준다 · 그동안 lost: 'own' 과 같게)
    for (const [id, pl, dt, k] of e.dead || []) {   // 그사이 탈락한 캐릭터 (알림·소리 없이)
      const c = charById(id); if (!c || c.isPlayer || !c.alive) continue;
      if (c.veh) Veh.exit(c, true, true);
      c.alive = false; c.hp = 0; c.knocked = false; c.place = pl; c.deathTime = dt; c.kills = Math.max(c.kills, k); c.heal = null; c.vel.set(0, 0, 0); c.anim.dead = 1; c.mode = 'ground'; c.root.visible = false;
      if (c.net) { c.net.deathLife = c.net.life; c.net.pendDead = 0; }
      c.inv.weapons = [null, null, null]; c.inv.cur = -1; c.inv.melee = null; c.setVisibleGear();
    }
    if (e.tp && G.teams) e.tp.forEach((v, i) => { if (G.teams[i] && v) G.teams[i].place = v; });
    for (const a of e.vst || []) {
      applyVeh(a); const v = N.vehs[a[0]];
      if (v && (a[14] & 1) && !v.T.animal && !v.wreck0) { v.dead = true; v.wreck0 = true; VehModels.wreck(v.P); v.P.root.position.y -= 0.12; }   // 부서진 차량 모양
    }
    if (e.pt && G.plane) { G.plane.t = e.pt[0]; if (!e.pt[1]) { G.plane.active = false; G.plane.mesh.visible = false; Audio.plane(false); } }
    if (e.duel && G.dm) DM.applyDuel(Object.assign({ k: 'duel' }, e.duel));
    Resume.applyMine(G.player, e.me, R.mine);
    N.hold = false;
    Resume.rejoined();
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
    const L = []; for (const it of GROUND) if (it.alive) L.push([it.u, it.id, it.count, r2(it.x), r2(it.y), r2(it.z), it.inst || 0, it.bx || 0]);
    sendBig(p, 'loot', L);
    const V = N.vehs.map((v) => [v.nid, v.type, r2(v.pos.x), r2(v.pos.z), r3(v.yaw)]);
    sendTo(p, { e: [{ k: 'vehs', l: V }] }, true);
  }
  let lootBuf = null;
  function recvLoot(e) {
    if (e.i === 0) { lootBuf = []; N.applying++; for (const it of GROUND.slice()) if (it.alive) removeItem(it); N.applying--; N.items.clear(); }
    if (!lootBuf) return;
    N.applying++;
    for (const a of e.l) spawnItem(G.scene, a[1], a[2], a[3], a[4], a[5], a[6] || null, a[0], a[7] || null);
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
    // v22 근접 무기: 총을 들었으면 6번째 칸에(허리에 찬 모습) · 총이 없으면 'm.<id>' (손에 듦)
    const wk = w && c.equipT <= 0.25 ? [w.id, a.scope || '', a.muzzle || '', a.mag || '', a.grip || '', c.inv.melee || ''].join('.') : c.inv.melee ? 'm.' + c.inv.melee : '';
    const g = c.inv.gear, gk = (g.helmet ? ITEMS[g.helmet.id].lvl : 0) * 100 + (g.vest ? ITEMS[g.vest.id].lvl : 0) * 10 + (g.bag ? ITEMS[g.bag.id].lvl : 0);
    const x = c.heal ? c.heal.id : c.throwMode ? c.throwMode.type : 0;
    return [c.id, r2(c.pos.x), r2(c.pos.y), r2(c.pos.z), r3(c.yaw), r3(c.pitch), f, Math.round(c.hp * 10) / 10, wk, gk, c.veh && c.veh.nid !== undefined ? c.veh.nid : -1, c.seat || 0, c.life || 0, x, c.kills, c.knocks || 0];
  }
  function applyChar(a, p) {
    let c = charById(a[0]); if (!c) return;
    // 나간 것으로 봤지만 봇에게 넘긴 캐릭터가 없던 사람(경기를 만드는 동안 온 파티 채널 알림 등)이 자기 캐릭터 상태를 보냄 → 다시 같이 하는 사람으로 (unbotize 처럼 — 안 그러면 경기 내내 left 로 남아 보내지 않음)
    if (N.host && p && p.left && !p.bye && !c.botized && c.uid === p.uid && N.peers.get(p.uid) === p) { p.left = false; p.gone = false; N.gone.delete(p.uid); HUD.toast(`${p.name}님이 다시 연결되었습니다`, 'ok'); }
    if (N.host && p && c.botized && !p.bye && (c.uid || c.origOwner) === p.uid) { if (c.alive || !(a[6] & FL.alive)) unbotize(c, p); else if (!G.dm || G.dm.duel) lostAgain(c, p); }  // 잠깐 끊겼던 파티원 · 나갔다가 다시 들어온 사람이 돌아옴 (v23: 방장이 바뀌었어도 캐릭터의 사람 uid 로) · 'bye' 를 보낸 연결(p.bye)이 그 뒤에 늦게 도착한 상태로는 되돌리지 않음 (순서 없는 채널 — 다시 들어오면 새 연결) · v24 봇이 맡은 사이 죽은 캐릭터는 살아 있다는 상태로는 돌려주지 않음 (그 사람 기기가 이 사망을 받기 전에 보낸 상태 — 받으면 죽은 상태를 보내 그때 돌려준다 · 그 사망을 놓친 기기에는 다시 보냄 lostAgain · 팀·웨폰 데스매치는 3초 뒤 봇이 부활하면 돌려줌)
    if (!N.host && c.isPlayer) { N.meT = now(); N.meA = a; if (!N.lost) N.lost = N.meT; }   // v24 방장이 내 캐릭터 상태를 보냄 = 방장 기기에서 봇이 움직이는 중 (방장은 주인이 움직이는 캐릭터를 그 주인에게 보내지 않는다 — tick EO) → lost 시작('own' 은 데이터 채널이 열린 나간 사람에게 방장이 보내지 않으므로 — flush) · tick 의 lost 끝내기 · 마지막 상태는 lost 사망 때 몸 자리
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
      const isMel = (id) => !!id && !!ITEMS[id] && ITEMS[id].type === 'melee';
      inv.melee = null;
      if (a[8] && a[8].startsWith('m.')) { const id = a[8].slice(2); inv.melee = isMel(id) ? id : null; }   // 근접 무기를 손에 듦
      else if (a[8]) { const [id, sc, mz, mg, gp, ml] = a[8].split('.'); if (ITEMS[id]) { const wi = newWeapon(id, ITEMS[id].mag); wi.att = { scope: sc || null, muzzle: mz || null, mag: mg || null, grip: gp || null }; inv.weapons[0] = wi; inv.cur = 0; } inv.melee = isMel(ml) ? ml : null; }
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
    if (attacker && attacker.isPlayer && attacker !== t && cause !== 'zone' && hmOk(attacker, cause, false)) { HUD.hitmarker(part === 'head', false); part === 'head' ? Audio.headshot() : Audio.hitmarker(); }
    if (t.brain) t.brain.onDamaged(attacker, cause);
    t.anim.flinch = Math.min(1, t.anim.flinch + dmg / 40); t.anim.flinchDir = Math.random() < 0.5 ? -1 : 1;
    return dmg;
  }
  function killReq(t, attacker, cause) { ev({ k: 'kreq', v: t.id, a: attacker ? attacker.id : -1, c: cause }, ownerOf(t)); }
  function sendKnock(t, attacker, cause) { if (mine(t) && !hostKO) ev({ k: 'knock', v: t.id, a: attacker ? attacker.id : -1, c: cause }); }
  function sendDeath(t, attacker, cause) { const e = { k: 'death', v: t.id, a: attacker && attacker !== t ? attacker.id : -1, c: cause, pl: t.place }; if (N && N.host && t.botized) t.botDeath = Object.assign({}, e); ev(e); }   // v24 방장: 봇이 맡은 사람 캐릭터의 사망은 남겨 둔다 (lostAgain)
  // v24 방장: 봇이 맡은 사이 죽은 캐릭터인데 그 사람이 아직 살아 있다는 상태를 보냄 — 넘긴 것('own')도 그 사망도 못 받은 기기(중계 메시지 유실 · 연결이 바뀌며 사라짐).
  //  그대로 두면 그 사람은 다른 화면에서는 죽은 채 혼자 계속 움직이고(맞힌 것도 그대로 들어감) 돌려받지도 못한다 → 2초마다 둘 다 그 사람에게만 다시 보냄 → 죽은 상태를 보내면 돌려줌
  //  (넘겨받은 새 방장은 그 사망을 모르므로 알림 없는 사망으로)
  function lostAgain(c, p) { const t = now(); if (t - (c.lostRs || 0) < 2) return; c.lostRs = t; ev({ k: 'own', c: c.id, o: N.me, rs: 1 }, p.uid); ev(Object.assign({}, c.botDeath || { k: 'death', v: c.id, a: -1, c: '', pl: c.place || 0, lost: true }, { rs: 1 }), p.uid); }   // rs: flush 가 나간 사람(left·quiet)에게도 보냄
  // v24 파티원: 방장이 아직 경기 중인 내 캐릭터를 봇에게 넘긴 사이(N.lost) 방장 기기의 그 캐릭터가 기절·사망함 — 다른 사람 화면에는 이미 그렇게 보였으므로 내 화면도 따른다
  //  (따르지 않으면 돌려받을 때 내 상태가 방장 기기로 가서 기절한 캐릭터가 일어나고 죽은 캐릭터가 되살아나 보인다) · 방장이 보낸 것만
  const lostMe = (t, e) => !!N && !N.host && !!N.lost && !!t.isPlayer && e.from === N.cfg.host;
  const held = (c) => !!N && !N.host && !!N.lost && !!c && !!c.isPlayer;   // 06_combat.js killChar: 그동안 내 기기는 내 캐릭터를 쓰러뜨리지 않는다 (방장 기기 쪽 사망을 받거나 돌려받은 뒤에)
  // lost 끝: 방장이 돌려줌('own' 나) · 방장이 내 캐릭터 상태를 더는 보내지 않음(그 'own' 을 놓침 · 새 방장이 넘겨받지 않음 — tick)
  function lostEnd() { if (N.lostTold && G.player && G.player.alive) HUD.toast('연결이 돌아와 내 캐릭터를 다시 직접 움직입니다', 'ok'); N.lost = 0; N.lostDt = 0; N.lostQ = 0; N.lostTold = false; N.meA = null; }
  let hostKO = false;   // 방장 기기에서 생긴 내 캐릭터의 기절을 옮기는 중 — 다시 알리지 않는다 (sendKnock)
  function netKnock(e) {
    const t = charById(e.v); if (!t) return;
    if (lostMe(t, e)) { if (t.alive && !t.knocked) { hostKO = true; try { knockChar(t, e.a >= 0 ? charById(e.a) : null, e.c); } finally { hostKO = false; } } return; }   // 내 기기에서 기절 (쓰러지는 것은 그동안 방장 기기가 — held · 부활은 그대로 · 돌려받으면 출혈도 이어서 내 기기가)
    if (mine(t) || t.knocked && t.knockSeen === t.knockN) return;
    const by = e.a >= 0 ? charById(e.a) : null;
    t.knocked = true; t.knockN++; t.knockSeen = t.knockN; t.knockedBy = by; t.hp = 100; t.knockT = G.time; t.heal = null; t.aiming = false; t.stance = 'prone';
    if (t.veh) Veh.exit(t, true, true);
    t.setVisibleGear();
    if (by && !mine(by)) by.knocks = (by.knocks || 0) + 1; else if (by && mine(by)) by.knocks++;
    HUD.killfeed(by ? by.name : null, t.name, causeName(e.c), by && by.isPlayer, t.isPlayer, 'knock', G.player && sameTeam(G.player, t), by && by.skinOf ? by.skinOf(e.c) : null, MeleeFx.ofKill(by, e.c));
    if (G.player && sameTeam(G.player, t)) HUD.toast(`팀원 ${t.name} 기절!`, 'warn');
  }
  function netDeath(e) {
    const t = charById(e.v); if (!t) return;
    const lost = lostMe(t, e);   // v24 봇이 맡은 사이 방장 기기에서 죽은 내 캐릭터 → 내 기기도 죽음으로 (시체 상자·리콜 카드는 방장 기기가 이미 냈다 · 다시 알리지 않음)
    if (lost ? !t.alive : mine(t) || t.net.deathLife === t.net.life && !t.alive) return;  // 같은 목숨에 두 번 처리하지 않음
    t.net.deathLife = t.net.life; t.net.pendDead = 0;
    const by = e.a >= 0 ? charById(e.a) : null, wasKnocked = t.knocked;
    t.alive = false; t.hp = 0; t.deathTime = G.time; t.place = e.pl || CHARS.filter((c) => c.alive).length + 1; t.heal = null; t.aiming = false; t.vel.set(0, 0, 0);
    t.knocked = false; if (t.revivedBy) { const rv = t.revivedBy; t.revivedBy = null; if (rv.revive && rv.revive.tgt === t) rv.revive = null; }
    if (t.veh) Veh.exit(t, true, true);
    if (lost) {
      // 내 소지품·리콜 카드: 시체 상자와 카드는 방장 기기가 이미 냈으므로(그 기기가 알던 총·장비 · 들고 있던 팀원 카드) killChar 처럼 비우기만 · 리콜 등록 중이었으면 그만
      if (t.revive) cancelRevive(t, true); if (t.recall) Recall.cancel(t, true); t.cards = [];
      t.reloadT = 0; t.cycle = null; t.swing = null; t.nadeQ = null; const v = t.inv; v.weapons = [null, null, null]; v.items = {}; v.cur = -1; v.gear = { helmet: null, vest: null, bag: null }; v.melee = null; t.setVisibleGear();
      // 몸은 방장 기기 쪽 봇이 쓰러진 자리(마지막으로 받은 그 캐릭터 상태 meA)에 — 다른 화면의 시체·상자 자리와 같게 · 수송기·낙하 중이던 내 캐릭터도 (수송기에 남으면 자동 강하·수송기 화면이 이어진다)
      const h = N.meA, air = t.mode !== 'ground'; if (h) { t.pos.set(h[1], h[2], h[3]); t.yaw = t.bodyYaw = h[4]; } else if (air) t.pos.y = groundAt(t.pos.x, t.pos.z, t.pos.y);
      t.mode = 'ground'; t.rplane = null; t.onGround = true; t.root.position.copy(t.pos); if (air) { Audio.plane(false); Audio.wind(0); }
    }
    if (by) by.kills++;
    if (G.killLog) G.killLog.push({ t: Math.round(G.time), cause: e.c, kn: wasKnocked, by: by ? (by.isPlayer ? 'player' : 'bot') : 'env' });
    if (!e.lost) HUD.killfeed(by ? by.name : null, t.name, causeName(e.c), by && by.isPlayer, !!t.isPlayer, e.c === 'wipe' ? 'wipe' : '', G.player && sameTeam(G.player, t), by && by.skinOf ? by.skinOf(e.c) : null, MeleeFx.ofKill(by, e.c));
    Audio.death(t.pos);
    // v23 근접 무기 스킨 처치 효과도 다른 기기의 처치에
    if (!e.lost) { SkinFx.kill(t, by, e.c); MeleeFx.kill(t, by, e.c); }
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
    PROJ.push(pr); c.throwAnim = THROW_ANIM - THROW_REL;   // 손을 떠나는 순간부터 (v22 던지는 동작)
    if (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 25) Audio.spoon(c.pos, false);
  }

  // 주먹: 지르기 동작·휘두르는 소리만 (맞힘 소리는 받은 쪽에서 판정만 따로, 피해는 때린 쪽 기기가 'hit'으로 보냄)
  // v22: w = 근접 무기 id (있으면 그 무기로 휘두르는 동작)
  function sendPunch(c, side, w) { if (mine(c)) ev({ k: 'pu', c: c.id, s: side, w: w || undefined }); }
  function remotePunch(e) {
    const c = charById(e.c); if (!c || mine(c) || !c.alive || c.knocked) return;
    const pt = c.pitch || 0, cp = Math.cos(pt), dx = Math.sin(c.yaw) * cp, dy = Math.sin(pt), dz = Math.cos(c.yaw) * cp;
    if (e.w && ITEMS[e.w] && ITEMS[e.w].type === 'melee') {
      const D = ITEMS[e.w]; if (!c.inv.weapons[c.inv.cur]) c.inv.melee = e.w;
      c.swing = { id: e.w, t: 0, total: meleeTotal(D), hitAt: D.wind + D.strike * 0.6, hit: false, dx, dy, dz, side: e.s > 0 ? 1 : -1, remote: true };
      c.swingSide = c.swing.side; c.swingT = c.punchT = G.time;
      return;
    }
    c.punch = { t: 0, side: e.s > 0 ? 1 : -1, hit: false, dx, dy, dz, remote: true };
    c.punchSide = c.punch.side; c.punchT = G.time;
    Audio.punch(c.pos, 'swing', false);
  }

  // ---------- 아이템 ----------
  function itemAdded(it, uid) {
    if (uid !== undefined && uid !== null) it.u = uid;
    else if (N.quiet) it.u = N.seq++;
    else { it.u = N.uidBase + N.uidN++; if (!N.applying) ev({ k: 'gadd', u: it.u, i: it.id, n: it.count, x: r2(it.x), y: r2(it.y), z: r2(it.z), in: it.inst || undefined, bx: it.bx || undefined }); }   // bx: v22 시체·보급 상자
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
    Loading.zone();   // v23 로딩 화면 마지막 연출 중이면 방장 자기장을 그림 (파티원은 이때부터 맞는 자기장)
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
    // 이 기기의 틱이 5초 넘게 멈췄다 돌아옴(다른 앱·탭 · 화면 꺼짐): 그동안 못 받은 것을 상대 탓으로 보지 않고 5초 더 기다린다 — 내가 멈춘 사이 방장은 나를 나간 사람으로 보고
    //  중계로는 보내지 않는다(아래 quiet). 돌아와 보낸 상태로 방장이 unbotize 하면 다시 받음 · 정말 끊긴 상대면 5초 뒤 판정 (예전: 돌아오자마자 방장이 나간 줄 알고 넘겨받아 경기가 둘로)
    const gap = t - (N.tickAt || t); N.tickAt = t;
    if (gap > 5) for (const p of N.peers.values()) p.lastRx = Math.max(p.lastRx, t - 15);
    // 온라인 매칭 파티원: 방장의 offer 가 올 때까지 'hi'를 2.5초마다 다시 (방장이 채널에 늦게 들어온 경우)
    //  v24: offer 를 한 번도 못 받은 채 중계가 됐어도(방장이 12초 안에 offer 하지 못함 → 방장 중계를 받아 이쪽도 중계) 6초마다 5번까지 — 방장이 처음 offer 를 보낸다 (onHi)
    //   · 키를 받은 연결은 묻지 않음 · 5번: 이미 offer 했던 방장 · 이번 업데이트 전 방장은 중계 자리에 offer 하지 않으므로 경기 내내 채널 메시지를 쓰지 않게
    if ((viaMM() || N.mig) && !N.host) { const hp = N.peers.get(N.cfg.host); if (hp && !hp.open && !hp.kr && !hp.oid && (!hp.relay || (hp.hiR || 0) < 5) && t - N.hiT > (hp.relay ? 6 : 2.5)) { if (hp.relay) hp.hiR = (hp.hiR || 0) + 1; hi(); } }
    // v24 파티원: 방장이 내 캐릭터를 봇에게 넘긴 채 경기 시간으로 2.5초 (내 상태가 방장에게 닿지 않는 중) → 한 번 알림. 곧 돌려받으면 알리지 않는다
    //  (파티 채널만 잠깐 끊김 · 앱을 바꿨다 돌아옴 — 화면이 멈춘 동안은 세지 않아 돌아오자마자 돌려받으면 조용히)
    //  v24: 방장과는 주고받는데 방장이 내 캐릭터 상태를 1.5초째 보내지 않으면(= 방장 기기에서 더는 봇이 아님) lost 를 끝냄 — 돌려준다는 'own' 을 놓쳤거나 새 방장이 내 캐릭터를 넘겨받지 않은 경우
    //   (그대로 두면 다음 방장 순서를 나만 다르게 셈 · 거짓 알림 · 내 기기가 내 캐릭터를 끝내 쓰러뜨리지 않음)
    if (N.lost && !N.host) {
      // lostQ: 방장이 계속 말하는데(1초 안) 내 캐릭터 상태는 0.6초째 없는 상태가 시작된 시각 — 1.5초 이어지면 끝 (방장과 막 다시 이어진 순간·사건만 온 순간에 끝내지 않게)
      const hp = N.peers.get(N.cfg.host), talking = !!hp && (hp.open || hp.relay) && t - hp.lastRx < 1;
      if (!talking || t - (N.meT || 0) < 0.6) N.lostQ = 0; else if (!N.lostQ) N.lostQ = t;
      if (N.lostQ && t - N.lostQ > 1.5) lostEnd();
      else { N.lostDt = (N.lostDt || 0) + dt; if (!N.lostTold && N.lostDt > 2.5 && G.player && G.player.alive) { N.lostTold = true; HUD.toast('연결이 불안정해 다른 사람 화면에서는 봇이 내 캐릭터를 대신 움직입니다 — 연결되면 바로 돌려받습니다', 'warn'); } }
    }
    // 방장을 넘겨받은 기기: 3초마다 5번 '내가 방장' 알림 (다른 사람을 고른 파티원도 이쪽으로)
    if (N.host && N.claimN > 0 && t - N.claimT > 3) { N.claimN--; N.claimT = t; bus('host', { uid: N.me, ep: N.epoch, mid: N.cfg.mid }); }   // mid: 이 경기 알림 (v24 — 파티 채널을 두 경기가 함께 쓸 때)
    // 연결 시간 초과 → 중계
    for (const p of N.peers.values()) {
      if (!p.open && !p.relay && t - p.t0 > 12) toRelay(p, 'timeout');
      if ((p.open || p.relay) && t - p.lastRx > 20 && !p.gone && t - N.t0 > 30) { p.gone = true; peerLeft(p.uid); }
    }
    N.tickT -= dt;
    const anyRelay = [...N.peers.values()].some((p) => p.relay && !p.left);   // 나간 사람(아래에서 건너뜀)은 세지 않음
    if (N.tickT <= 0) {
      N.tickT = 0.05;
      N.tickN = (N.tickN || 0) + 1;
      // 중계: 1명이면 0.2초마다, 2명 이상이면 0.35초마다 (Supabase 무료 플랜 초당 100개 한도 안에서)
      let nRelay = 0; for (const p of N.peers.values()) if (p.relay && !p.left) nRelay++;
      const relayTick = N.tickN % (nRelay >= 2 || (!N.host && N.cfg.humans.length > 2) ? 7 : 4) === 0;
      // 내 것: 캐릭터(+방장: 봇·다른 파티원) · 차량
      const mineS = [], others = [];
      for (const c of CHARS) { if (mine(c)) mineS.push(c); else if (N.host) others.push(c); }
      const myVeh = []; for (const v of N.vehs) if (!vehRemote(v) && (v.awake || v.burnT > 0 || v.netDirty)) { myVeh.push(encVeh(v)); v.netDirty = v.awake; }
      const w = N.host ? { t: r2(G.time), pt: G.plane && G.plane.active ? r2(G.plane.t) : undefined, isl: G.island ? r2(Island.left()) : undefined } : undefined;
      // v22: 캐릭터 상태는 틱마다 한 번만 JSON 으로 만들고, 사람마다 거리로 골라 이어 붙인다 (사람이 많아도 방장 부담이 덜 늘게)
      //  받는 사람 캐릭터에서 150m 안 = 초당 20번, 150~260m = 10번, 그 밖 = 2번 (멀리 있는 캐릭터는 작게 보여 덜 자주 보내도 티가 안 남)
      const EM = [], EO = [];
      for (const c of mineS) { if (N.hold && c.isPlayer) continue; EM.push(c, JSON.stringify(encChar(c))); }   // 돌아오는 중: 방장 상태를 맞추기 전에는 내 캐릭터를 보내지 않음
      if (N.host) for (const c of others) if (c.net.lastA) EO.push(c, JSON.stringify(c.net.lastA));
      const tail = (myVeh.length ? ',"v":' + JSON.stringify(myVeh) : '') + (w ? ',"w":' + JSON.stringify(w) : ''), me0 = G.player, tn = N.tickN;
      for (const p of N.peers.values()) {
        if (quiet(p)) continue;   // 나간 사람: 'bye' 를 보냄 · 중계 · 연결이 닫힘 → 보내지 않음 (데이터 채널이 열린 사람은 그대로 — quiet)
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
  // sure: 그 사람이 정말 나갔음 (그 사람의 'bye' — 연결 · 서명이 맞는 매칭 채널 · 버전 다름). 연결 끊김(20초)·파티 채널 알림은 아님 — 잠깐 끊겼다 돌아올 수 있다
  function peerLeft(uid, next, sure) {
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
      // v24: 정말 나갔으면(sure) 다른 파티원 기기에도 알림 — 연결 'bye' · 서명이 맞는 매칭 채널 'bye'(파티원은 다른 파티원의 채널 'bye' 를 확인할 수 없어 버림 — byeOk) · 버전 다름
      //  → 파티원 N.gone 도 방장과 같아 방장이 바뀔 때 같은 사람을 고른다 · 이번 업데이트 전 화면은 uid 를 읽음. 연결 끊김(20초)·파티 채널 알림으로는 보내지 않는다 —
      //  잠깐 끊긴 사람이 모두의 N.gone 에 들어가면 그사이 방장이 바뀔 때 새 방장이 그 사람 자리를 만들지 않아 돌아와도 붙지 못한다 (keepGone 이 넣지 않는 것과 같은 까닭)
      if (sure) ev({ k: 'bye', uid, from: uid });
      HUD.toast(`${hm.name}님이 경기를 떠났습니다${c && c.alive ? ' — 봇이 이어서 합니다' : ''}`, 'warn');
    }
  }
  // 파티 채널(10_social.js — 파티를 나감 · 접속 표시가 5초 사라짐)이 알린 사람. 파티원 기기에서는 방장이 아닌 사람이 아직 자기 캐릭터를 움직이면
  //  (방장이 봇에게 넘기지 않았거나 넘겼다가 돌려줌) 나간 사람(N.gone)으로 두지 않는다 — 경기 연결은 그대로인데 파티 채널만 끊긴 사람 · 돌려받은 뒤 늦게 온 알림이
  //  남으면 그 뒤 방장이 바뀔 때 다음 방장 후보·다시 연결할 사람에서 빠진다 (방장 기기는 그대로: 봇에게 넘기고, 그 사람 상태가 오면 돌려준다)
  //  방장 기기는 다시 들어오기로 만든 새 자리(onRejoinReq · 15초 안)면 무시 — 새로고침한 그 전 접속의 늦은 알림(5초)이 새 자리를 나간 사람으로 만들면
  //  그 자리에는 상태·사건도 중계 전환도 막혀(tick·flush·toRelay 가 left 를 봄) 돌려받을 때까지 비게 된다
  function partyLeft(uid) { if (N && !N.host && uid !== N.cfg.host && CHARS.some((c) => c.human && c.uid === uid && c.net && c.net.owner === uid)) return; if (N && N.host) { const p = N.peers.get(uid); if (p && p.rjAt && now() - p.rjAt < 15) return; } peerLeft(uid); }
  // 나가는 방장이 보낸 나간 사람 목록(g)에 없는 사람을 이 기기 N.gone 에서 지움 — 파티원 기기에만 남은 옛 기록(파티 채널 알림 · 돌아오는 중인 사람)으로
  //  다음 방장 후보가 방장 기기와 달라져 둘이 방장이 되거나 돌아온 사람이 연결하지 못하지 않게. 넣지는 않는다 (방장이 연결 끊김으로 봇에게 넘긴 사람도 새 방장에게 다시 연결할 수 있게)
  //  예전 방장(g 없음)이면 그대로
  function keepGone(g) { if (!N || !Array.isArray(g)) return; const s = new Set(g); for (const u of [...N.gone]) if (!s.has(u)) N.gone.delete(u); }
  // 방장: 인사(hello)의 게임 버전이 다름 (버전 확인이 없는 예전 화면) → 같이 하지 않음: 그 사람이 보내는 것은 바로 버리고(bad),
  //  떠난 사람처럼 캐릭터는 봇이 잇는다 — 내 경기를 아직 만드는 중이면 준비된 뒤(ready)에
  function verDrop(p, v) {
    if (p.dropped) return; p.bad = true; p.badV = v; if (!N.ready) return;
    p.dropped = true; peerLeft(p.uid, undefined, true); Ver.tell(v, p.name);
    setTimeout(() => { closePeer(p); if (N && N.peers.get(p.uid) === p) N.peers.delete(p.uid); }, 300);
  }

  // ---------- 방장 넘겨주기 (v22) ----------
  //  방장이 로비로 나가거나 연결이 끊겨도 경기는 계속된다: 남은 사람 중 한 명이 방장(서버 역할)을 넘겨받는다
  //  · 다음 방장 = 나가는 방장이 고른 사람(살아 있는 사람 우선) · 연결이 끊긴 경우는 남은 사람 중 살아 있는 사람 → 처음 명단 순서
  //  · 새 방장: 봇·나간 사람 캐릭터를 맡아 AI 로 움직이고(보이던 총 + 예비 탄약), 자기장·보급·빈 차량·점수를 이어서 계산,
  //    남은 사람에게 새로 연결(파티원이 'hi' → offer) · 3초마다 '내가 방장' 알림
  //  · 다른 사람: 봇·나간 사람 캐릭터의 주인을 새 방장으로 바꾸고 새 방장에게 다시 연결
  function successors(oldHost) {
    const alive = (uid) => CHARS.some((c) => c.human && c.net && c.net.owner === uid && c.alive && !c.botized && !(c.isPlayer && N.lost));   // v24: 방장이 봇에게 넘긴 내 캐릭터(lost)는 다른 기기에서처럼 봇으로 셈 — 다음 방장 순서가 기기마다 같게 (내 기기에서만 살아 있는 사람으로 세면 나와 다른 사람이 함께 방장이 될 수 있다)
    const list = N.cfg.humans.map((h) => h.uid).filter((u) => u !== oldHost && !N.gone.has(u));
    return list.filter(alive).concat(list.filter((u) => !alive(u)));
  }
  function migrate(oldHost, next) {
    // 다음 방장: 나가는 방장이 고른 사람(next) → 첫 연결 중에 받아 둔 '내가 방장' 알림(claim — 40초 안 · onHostClaim) → 정해진 순서
    const cand = successors(oldHost), cl = N.claim && now() - N.claim.t < 40 && cand.includes(N.claim.uid) ? N.claim.uid : null, nh = next && cand.includes(next) ? next : cl || cand[0];
    N.claim = null;
    if (!nh) { hostGone(); return; }
    if (nh === N.me) takeOver(oldHost); else follow(nh, oldHost);
  }
  function closePeer(p) { try { if (p.pc) p.pc.close(); } catch (e) { /* */ } }
  function takeOver(oldHost) {
    N.host = true; N.cfg.host = N.me; N.mig = true; N.epoch++; N.lost = 0; N.lostDt = 0; N.lostQ = 0; N.lostTold = false;   // 이제 내가 방장 — 내 캐릭터를 맡을 다른 방장은 없다
    G.netAuthority = () => !N || N.host;
    for (const c of CHARS) {
      if (!c.net || c.net.mine) continue;
      const o = c.net.owner;
      if (o !== oldHost && !N.gone.has(o) && N.cfg.humans.some((h) => h.uid === o)) continue;   // 다른 사람이 움직이는 캐릭터는 그대로
      adopt(c);
    }
    for (const p of N.peers.values()) closePeer(p);
    N.peers.clear();
    // 상대가 'hi'를 보내면 offer · 봇이 맡은 사람(예전 방장이 나간 것으로 본 사람 — 나갔거나 화면만 멈춤)의 자리는 나간 사람(left)으로 시작:
    //  12초 뒤 중계로 바꾸지 않고(알림·중계 없음) adopt 의 'own' 도 그 사람에게 가지 않음 (flush) — 살아 있으면 'hi'·중계로 붙고, 상태를 보내면 unbotize
    for (const hm of N.cfg.humans) if (hm.uid !== N.me && !N.gone.has(hm.uid)) { const p = newPeer(hm.uid, true, true); if (CHARS.some((c) => c.human && c.uid === hm.uid && c.botized)) p.left = true; N.peers.set(hm.uid, p); }
    N.zoneT = 0; N.claimN = 5; N.claimT = 0; N.t0 = now();
    if (G.state === 'result') G.bgSim = true;   // 결과 화면에 있던 사람이 넘겨받으면 뒤에서 경기를 돌린다
    HUD.toast('방장이 나가서 이 기기가 경기를 이어받았습니다 — 경기는 계속됩니다', 'ok');
  }
  // 봇·나간 사람 캐릭터를 이 기기가 맡음 (다른 기기에는 지금 든 총·장비만 보였으므로 예비 탄약·붕대를 채워 준다)
  function adopt(c) {
    if (c.human) { c.origOwner = c.uid || c.net.owner; c.botized = true; }
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
      else { b.setState('EXPLORE'); b.landT = G.time - 999; b.dropTarget = { x: c.pos.x, z: c.pos.z }; }   // 이미 내린 캐릭터: 착지 뒤 파밍 우선(07_bot.js lootPhase)을 다시 주지 않게
    }
    if (c.knocked) b.onKnocked();
  }
  function follow(nh, oldHost) {
    N.host = false; N.cfg.host = nh; N.mig = true; N.epoch++;
    for (const c of CHARS) if (c.net && !c.net.mine) { const o = c.net.owner; if (o === oldHost || N.gone.has(o) || !N.cfg.humans.some((h) => h.uid === o)) c.net.owner = nh; }
    for (const p of N.peers.values()) closePeer(p);
    N.peers.clear(); const np = newPeer(nh, false); N.peers.set(nh, np); N.myKeys.push(np.ks); if (N.myKeys.length > 8) N.myKeys.shift(); N.hiT = 0; N.t0 = now();   // myKeys: 새 방장에게 쓸 내 키도 다시 들어오기 증명에
    try { Resume.keys(N.cfg.mid, N.myKeys.slice(-4)); } catch (e) { /* */ }   // 이어하기 기록에 바로 (화면이 숨겨져 5초 저장이 없는 사이 탭이 정리돼도 새 방장에게 증명할 수 있게)
    hi();
    HUD.toast(`방장이 나가서 ${(N.cfg.humans.find((h) => h.uid === nh) || {}).name || '다른 사람'}님이 경기를 이어받습니다 — 경기는 계속됩니다`, 'warn');
  }
  // 다른 기기가 '내가 방장'이라고 알림: 내가 따르던 방장과 연결이 안 되어 있으면 그쪽으로
  //  v24: 이 경기 사람이 넘겨받은 알림만(ep ≥ 1 — 처음 방장은 알리지 않음 · mid 가 있으면 이 경기) · 아직 방장을 넘겨받은 적 없이 첫 연결 중이거나 다시 들어오는 중이면
  //   따르지 않고 기억만 한다(claim) → 방장이 정말 사라지면(migrate) 그 사람을 먼저 고름. 서명할 수 없는 알림이라, 경기 시작 직후 꾸민 알림 하나로 모두가 진짜 방장을 버리고 따라가지 않게
  function onHostClaim(m) {
    if (!N || N.host || typeof m.uid !== 'string' || m.uid === N.cfg.host || m.uid === N.me || !(m.ep >= 1) || m.ep < N.epoch || N.gone.has(m.uid)) return;
    if ((m.mid && m.mid !== N.cfg.mid) || !N.cfg.humans.some((h) => h.uid === m.uid)) return;
    const hp = N.peers.get(N.cfg.host); if (hp && (hp.open || hp.relay)) return;
    if (N.epoch < 1 || (N.rj && !N.rj.done)) { N.claim = { uid: m.uid, t: now() }; return; }
    const old = N.cfg.host; N.gone.add(old); follow(m.uid, old);
  }
  function unbotize(c, p) {
    N.gone.delete(p.uid);
    c.botized = false; c.brain = null; c.net = charNet(p.uid); p.gone = false; p.left = false; c.botDeath = null; c.lostRs = 0;
    ev({ k: 'own', c: c.id, o: p.uid });
    HUD.toast(`${p.name}님이 다시 연결되었습니다`, 'ok');
  }
  function botize(c) {
    c.origOwner = c.net ? c.net.owner : null;
    c.botized = true; c.net = { owner: N.cfg.host, mine: true, buf: [], life: c.net ? c.net.life : 0 }; c.botDeath = null; c.lostRs = 0;
    ev({ k: 'own', c: c.id, o: N.cfg.host });
    if (c.alive) {
      const wi = c.weapon; if (wi && ITEMS[wi.id].ammo) { const a = ITEMS[wi.id].ammo; c.inv.items[a] = (c.inv.items[a] || 0) + ITEMS[wi.id].mag * 3; }
      if (!c.inv.items.bandage) c.inv.items.bandage = 3;
      const b = new Brain(c, 'normal'); b.state = c.mode === 'ground' ? 'EXPLORE' : 'LANDING'; b.landT = c.mode === 'ground' ? G.time - 999 : G.time; b.dropTarget = { x: c.pos.x, z: c.pos.z }; b.chuteH = 90; b.jumpAt = 0;   // (이미 내렸으면 착지 뒤 파밍 우선을 다시 주지 않게)
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
    const g = N.host ? [...N.gone] : undefined;   // 방장: 나간 사람 목록도 — 파티원은 여기에 없는 옛 기록을 지우고 같은 다음 방장을 고른다 (keepGone)
    try { ev({ k: 'bye', uid: N.me, next, g }); flush(true); if (viaMM()) bus('bye', { next, g, tg: byeTags(next, g) }); } catch (e) { /* */ }   // tg: 받는 사람마다 서명 (v24)
    const n0 = N, mm = n0.cfg.mm; setTimeout(() => { closePeers(n0); if (mm) MM.chClose(mm); }, 400);
    N = null; G.net = null; restoreOwn(n0);
  }
  function closePeers(n0) { for (const p of n0.peers.values()) { try { p.pc && p.pc.close(); } catch (e) { /* */ } } }
  function close(quiet) { if (!N) return; if (!quiet) leave(); else { const n0 = N; closePeers(n0); if (n0.cfg.mm) MM.chClose(n0.cfg.mm); N = null; G.net = null; restoreOwn(n0); } }
  // 방장이 로비로 나가려 할 때 아직 살아 있는 파티원이 있는지
  function othersPlaying() { if (!N || !N.host) return false; return (N.rjKeep || 0) > now() || N.cfg.humans.some((hm) => hm.uid !== N.me && CHARS.some((c) => c.net && c.net.owner === hm.uid && c.alive && !c.botized)); }   // rjKeep: 다시 들어오는 사람을 기다리는 동안 (40초)
  // 방장: 아직 인사(hello)가 없는 사람 수 — 스타트 섬을 조금 더 기다린다
  function waiting() { if (!N || !N.host) return 0; let n = 0; for (const p of N.peers.values()) if (!p.helloSeen && !p.left && !p.gone) n++; return n; }
  function status() { if (!N) return null; return { host: N.host, peers: [...N.peers.values()].map((p) => ({ uid: p.uid, name: p.name, open: p.open, relay: p.relay, left: !!p.left, rx: Math.round(now() - p.lastRx), key: !!p.kr })), tx: N.stats.tx, rx: N.stats.rx, bad: N.stats.bad, items: N.items.size, vehs: N.vehs.length }; }   // key: 상대 키를 받음 (채널 서명 확인) · bad: 서명이 안 맞아 버린 채널 메시지

  // 창을 닫거나 새로고침할 때도 나간다고 알린다 (방장이면 다음 방장을 골라 넘김 → 남은 사람의 경기는 계속)
  //  v23: 나가기 전에 이어하기 저장 (돌아오면 같은 경기로 — 10_resume.js)
  window.addEventListener('pagehide', () => { try { if (N) { Resume.save(); leave(); } } catch (e) { /* */ } });
  return { makeConfig, join, ready, onParty, onLobby, probe, tick, active, isHost, isGuest, mine, held, ownerOf, charNet, updateProxy, indexVehicles, vehRemote, vehInterp, vehHit, encVeh,
    remoteHit, killReq, sendKnock, sendDeath, sendRevive, sendShot, sendThrow, sendPunch, itemAdded, itemRemoved, itemCount, seeded, baseline, peerLeft: partyLeft, leave, close, othersPlaying, waiting, status, ev, flush, zoneSnap, applyZone,
    playing, hmac, rjKeys, get state() { return N; } };   // playing: 파티 채널 'bye' 확인 (10_social.js) · hmac: 채널 서명 (시험용) · rjKeys: 이어하기 저장에 남길 다시 들어오기 증명 키 (10_resume.js)
})();
