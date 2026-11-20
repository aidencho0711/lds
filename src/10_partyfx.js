// ============================================================
// 10_partyfx.js — 파티 입장·퇴장 연출 (v23)
//  새 티어 4종(노바·셀레스티얼·이클립스·제니스)이나 따기 어려운 칭호(랭크 챔피언·하드코어 패왕·정점의 베테랑·이터널·오버로드·
//  백룸 정복자·전쟁의 신)를 가진 사람이 파티에 들어오거나 나갈 때, 로비 3D 파티 줄에서 캐릭터가 직접 움직이고
//  (유성처럼 떨어져 한 무릎 착지 · 돌며 강하 · 빛기둥 속으로 내려옴 · 땅속에서 솟음 · 경례 · 노클립으로 바닥 아래로 …)
//  주변 효과(빛기둥·충격파·바닥 문양·입자·번개·불기둥·일식)가 함께 터진다
//  · 내 연출(자동 = 가진 것 중 가장 높은 것 · 직접 고르기 · 끄기)은 파티 정보 memberInfo.ent 로 전해져 같은 파티의 모든 기기에서 보인다
//  · 들어온 사람: 다른 기기에서는 그 파티원 자리에서 입장, 들어온 기기에서는 가운데 내 캐릭터가 입장
//  · 나간 사람: 남은 기기에서는 그 캐릭터가 퇴장 동작을 하고 사라지고(유령 리그), 나간 기기에서는 내 캐릭터가 작별 몸짓
//  · 캐릭터: 열쇠 자세(KP — 팔은 IK/FK, 디딘 발은 다리 IK) 사이를 이어 붙인 동작(MOT) + 몸 채널(높이·회전·크기·깜빡임)
//  · 효과: 로비 장면 전용 시간 효과(고리·기둥·바닥 문양·빛 판·빛줄기·번개) + 총기 스킨 입자 풀(GunSkin.fx)
//    새 조명을 더하지 않고(셰이더를 다시 만들지 않게) 해·하늘 밝기만 잠깐 바꾸고, 재료는 로비를 만들 때 미리 한 번 그려 둔다
//  · 개발자 전용 연출(관리자 = 개발자·부개발자 계정): 로비가 편집기가 되어 T 자세 모델을 끌어다 놓고 텍스처를 입힌 뒤 ▶ 실행 —
//    관리자 계정은 이 연출과 함께 모든 연출을 가진다. 다른 기기는 그 계정이 관리자인지 서버에 확인한 뒤에만 보여 준다 (Cloud.staffRole, supabase/admin.sql staff_roles)
// ============================================================
const PartyFx = (() => {
  // ---------- 대상 (자동 선택은 위에서부터) ----------
  //  t: 새 티어 번호(RANK_TIERS — 10_rank.js, 최고 도달은 칭호 tier_<id> 로 판단) · 없으면 같은 id 의 칭호(10_ui_profile.js TI)
  //  mo: [입장, 퇴장, 작별 몸짓] · c: [주색, 보조색, 밝은 색] · pal: 입자 색
  //  staff: 관리자(개발자·부개발자) 계정 전용 — 칭호·티어와 상관없이 그 계정만 (다른 기기는 서버에 확인: Cloud.staffRole)
  const ENT = [
    { id: 'dev', staff: true, name: '개발자', mo: ['devIn', 'devOut', 'devBye'], c: [0x4de8ff, 0x7dffb0, 0xffffff], pal: [0x4de8ff, 0x7dffb0, 0xffd866, 0xff7ab8, 0xc9a0ff, 0xffffff] },
    { id: 'champ_tier', name: '랭크 챔피언', mo: ['ceremony', 'curtain', 'bow'], c: [0xffc93a, 0xff6a3a, 0xfff4c8], pal: [0xffd65a, 0xfff0b0, 0xff4a5a, 0x4ab8ff, 0x6aff9a, 0xffffff] },
    { id: 'zenith', t: 13, name: '제니스', mo: ['armillary', 'ascendStar', 'salute'], c: [0xffd76a, 0xa47cff, 0xffffff], pal: [0xffd76a, 0xfff2c8, 0xc8a8ff, 0xffffff] },
    { id: 'champ_hc', name: '하드코어 패왕', mo: ['crater', 'devour', 'flex'], c: [0xff3a1e, 0xffa030, 0xffe2c8], pal: [0xff3a1e, 0xff7a20, 0xffc04a, 0xffe2c8] },
    { id: 'eclipse', t: 12, name: '이클립스', mo: ['eclipse', 'umbra', 'cross'], c: [0xff4a2e, 0x8a0c1a, 0xffd8c8], pal: [0xff4a2e, 0xff8a5a, 0xffd0b0, 0xc8102a] },
    { id: 'champ_lv', name: '정점의 베테랑', mo: ['smokeIn', 'smokeOut', 'salute'], c: [0xcfe4ff, 0x7fb8ff, 0xffffff], pal: [0xcfe4ff, 0x9fd0ff, 0xffffff, 0xffe9a8] },
    { id: 'celestial', t: 11, name: '셀레스티얼', mo: ['wingsIn', 'wingsOut', 'open'], c: [0xf3d98b, 0xfff4d8, 0xffffff], pal: [0xf3d98b, 0xffe9b0, 0xfffaf0, 0xffffff] },
    { id: 'nova', t: 10, name: '노바', mo: ['nova', 'novaOut', 'wave'], c: [0x8fe3ff, 0x2f86ff, 0xffffff], pal: [0x8fe3ff, 0x4fb0ff, 0xd8f6ff, 0xffffff] },
    { id: 'hc_overlord', name: '오버로드', mo: ['throne', 'throneOut', 'fistPalm'], c: [0xff7a18, 0xffc040, 0xfff0c8], pal: [0xff6a12, 0xff9a2a, 0xffc04a, 0xfff0c0] },
    { id: 'tier_eternal', name: '이터널', mo: ['clockIn', 'clockOut', 'open'], c: [0xc58cff, 0x7a3cff, 0xf6eaff], pal: [0xc58cff, 0xe6c8ff, 0x9a6aff, 0xffffff] },
    { id: 'br_all', name: '백룸 정복자', mo: ['escape', 'noclip', 'shrug'], c: [0xffe066, 0xc9b27a, 0xfffbe0], pal: [0xffe066, 0xe8d8a0, 0xc9b27a, 0xfff8d0] },
    { id: 'wargod', name: '전쟁의 신', mo: ['bladeRain', 'swordOut', 'armUp'], c: [0xff2a3a, 0xff8a8a, 0xffeef0], pal: [0xff2a3a, 0xff6a6a, 0xffd0d0, 0xffffff] },
  ];
  const byId = (id) => ENT.find((e) => e.id === id) || null;
  const tiOf = (id) => (typeof Prof !== 'undefined' && Prof.TI ? Prof.TI.find((x) => x.id === id) || null : null);
  const tiKey = (E) => (E.t != null ? 'tier_' + E.id : E.id);
  // 이 판(클라이언트)에 그 티어·칭호가 있는가 (새 티어는 10_rank.js 가 RANK_TIERS 에 더한 뒤부터)
  const avail = (E) => (E.staff ? true : E.t != null ? RANK_TIERS.length > E.t : !!tiOf(E.id));
  // 관리자 전용 대상은 역할을 붙여 쓴다 (이름 띠: 개발자 / 부개발자) — 원래 대상을 본뜬 것이라 id·동작·색은 그대로
  const myRole = () => (typeof Dev !== 'undefined' && Dev.is() ? (Dev.sub() ? 'sub' : 'dev') : '');
  const withRole = (E, role) => (E && E.staff ? Object.assign(Object.create(E), { role: role || 'dev' }) : E);
  const nameOf = (E) => (E.staff ? ((E.role || myRole()) === 'sub' ? '부개발자' : '개발자') : E.t != null && RANK_TIERS[E.t] ? RANK_TIERS[E.t].name : (tiOf(tiKey(E)) || {}).name || E.name);
  function ok(E) {
    if (!E || !avail(E)) return false;
    if (E.staff) return !!myRole();
    const T = tiOf(tiKey(E)); if (T) { try { return !!T.ok(); } catch (e) { return false; } }
    if (E.t == null || typeof Rank === 'undefined') return false;
    const pk = typeof Rank.peakTier === 'function' ? Rank.peakTier() : null, t = pk == null ? -1 : typeof pk === 'number' ? pk : pk.t;   // 칭호가 없으면 최고 도달 티어
    return Rank.placed() && t >= E.t;
  }
  // 내 설정: STATS.prof.ent = 'auto'(기본) | 'off' | 대상 id
  const pref = () => (STATS.prof && STATS.prof.ent) || 'auto';
  function mine() {
    if (typeof Cloud === 'undefined' || !Cloud.user) return null;
    const p = pref(); if (p === 'off') return null;
    const E = byId(p); if (E && ok(E)) return E.id;
    for (const e of ENT) if (ok(e)) return e.id;
    return null;
  }
  // 파티 정보로 보내는 값: 고른 것 + 가진 나머지(높은 순, 4개까지) — 받는 기기의 랭킹 자료가 늦어 1위 칭호를 못 믿으면 다음 것으로
  function mineList() { const m = mine(); if (!m) return null; const L = [m]; for (const e of ENT) if (L.length < 4 && e.id !== m && ok(e)) L.push(e.id); return L; }
  // 다른 기기에서 온 값 확인 (id 하나 또는 목록): 이 판에 있는 대상 · 랭킹 1위 칭호는 지금 1위인 이름만 (10_ranking.js)
  //  · 관리자 전용 연출은 서버가 관리자라고 확인해 준 계정(uid)만 — 관리자 계정은 1위 칭호 연출도 쓸 수 있다
  const staffOf = (uid, name) => (typeof Cloud !== 'undefined' && Cloud.staffRole ? Cloud.staffRole(uid, name) : '');
  function valid(ids, name, uid) {
    for (const id of Array.isArray(ids) ? ids.slice(0, 4) : [ids]) {
      const E = byId(id); if (!E || !avail(E)) continue;
      if (E.staff) { const r = staffOf(uid, name); if (!r) continue; return withRole(E, r); }
      if (/^champ_/.test(E.id) && typeof Ladder !== 'undefined' && Ladder.allowed && !Ladder.allowed(E.id, name, uid)) continue;
      return E;
    }
    return null;
  }
  // 관리자 전용 연출을 보냈는데 그 계정이 관리자인지 아직 모름 → 답이 올 때까지 입장을 잠깐 미룬다
  const unsure = (f) => { if (!f || !f.uid || typeof Cloud === 'undefined' || !Cloud.staffKnown) return false; return (Array.isArray(f.ent) ? f.ent : [f.ent]).includes('dev') && !Cloud.staffKnown(f.uid); };
  const mineE = () => withRole(byId(mine()), myRole());

  // ---------- 효과 (로비 장면 전용 · 시간 진행) ----------
  let SC = null, CAM = null, LOB = null, SHK = 0, alive = 0, warmed = false;
  const LIVE = [], ENV = [], TX = {};
  const kit = () => SkinFx.kit, tex = () => SkinFx.kit.tex;
  const UP = new THREE.Vector3(0, 1, 0);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _g = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ');
  const P = () => GunSkin.fx.pool(SC), EM = (...a) => GunSkin.fx.emit(...a);
  const pk = (E) => E.pal[(Math.random() * E.pal.length) | 0];
  // 색 어둡게 (더하기 혼합이라 어두울수록 옅게 겹침 — 캐릭터를 덮는 기둥이 하얗게 날아가지 않게)
  const dim = (c, k) => (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
  // 시간 효과: o(없어도 됨)를 delay 초 뒤부터 dur 초 동안 upd(e, u 0→1, dt)
  function add(o, dur, upd, delay = 0) {
    if (!SC) return null;
    if (o) { o.visible = false; o.frustumCulled = false; SC.add(o); }
    const e = { o, t: -delay, dur, upd, dt: 0, on: false }; LIVE.push(e); return e;
  }
  const at = (delay, fn) => add(null, 0.001, (e) => { if (!e.done) { e.done = true; fn(); } }, delay);
  function free(o) { o.traverse((m) => { if (m.material && !m.userData.keep) { if (m.userData.ownMap && m.material.map) m.material.map.dispose(); m.material.dispose(); } if (m.geometry && m.userData.own) m.geometry.dispose(); }); }   // keep: 같이 쓰는 재료(백룸 손)
  function tickFx(dt) {
    for (let i = LIVE.length - 1; i >= 0; i--) {
      const e = LIVE[i]; e.t += dt; e.dt = dt; if (e.t < 0) continue;
      if (!e.on) { e.on = true; if (e.o) e.o.visible = true; }
      const u = Math.min(1, e.t / e.dur); e.upd(e, u, dt);
      if (u >= 1) { if (e.o) { if (e.o.parent) e.o.parent.remove(e.o); free(e.o); } LIVE.splice(i, 1); }
    }
  }
  // ----- 그림 (처음 쓸 때 한 번) -----
  const ctex = (key, W, H, fn) => { if (TX[key]) return TX[key]; const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d'), W, H); return (TX[key] = new THREE.CanvasTexture(c)); };
  // 빛기둥: 아래가 밝고 위로 사라짐 + 세로 줄
  const colTex = () => ctex('col', 64, 128, (g) => { const r = g.createLinearGradient(0, 128, 0, 0); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 128); g.globalCompositeOperation = 'destination-out'; const R = mulberry32(7); for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + R() * 0.5})`; g.fillRect(R() * 64, 0, 2 + R() * 6, 128); } });
  // 마법진: 겹 원 · 육각별 · 룬 띠 · 눈금
  const sigilTex = () => ctex('sigil', 256, 256, (g) => {
    g.translate(128, 128); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
    circ(122, 4); circ(113, 1.5); circ(84, 3); circ(46, 2); circ(20, 1.5);
    g.lineWidth = 2.6; for (const o of [0, Math.PI]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = o - Math.PI / 2 + i * TAU / 3; i ? g.lineTo(Math.cos(a) * 84, Math.sin(a) * 84) : g.moveTo(Math.cos(a) * 84, Math.sin(a) * 84); } g.stroke(); }
    const R = mulberry32(31);
    for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; g.save(); g.rotate(a); g.translate(0, -98); g.lineWidth = 2; g.beginPath(); const k = (R() * 4) | 0; if (k === 0) { g.moveTo(-4, -6); g.lineTo(4, 6); g.moveTo(4, -6); g.lineTo(-4, 6); } else if (k === 1) { g.moveTo(0, -7); g.lineTo(0, 7); g.moveTo(-4, -2); g.lineTo(4, -2); } else if (k === 2) { g.arc(0, 0, 4.5, 0, TAU); } else { g.moveTo(-5, 6); g.lineTo(0, -6); g.lineTo(5, 6); } g.stroke(); g.restore(); }
    for (let i = 0; i < 72; i++) { const a = i / 72 * TAU, l = i % 6 ? 4 : 9; g.lineWidth = 1.4; g.beginPath(); g.moveTo(Math.cos(a) * 122, Math.sin(a) * 122); g.lineTo(Math.cos(a) * (122 - l), Math.sin(a) * (122 - l)); g.stroke(); }
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; g.beginPath(); g.arc(Math.cos(a) * 84, Math.sin(a) * 84, 5, 0, TAU); g.fill(); }
  });
  // 왕관 (랭크 챔피언)
  const crownTex = () => ctex('crown', 256, 192, (g) => {
    const gr = g.createRadialGradient(128, 110, 10, 128, 110, 120); gr.addColorStop(0, 'rgba(255,240,190,0.55)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
    g.beginPath(); g.moveTo(52, 150); g.lineTo(40, 64); g.lineTo(88, 104); g.lineTo(128, 44); g.lineTo(168, 104); g.lineTo(216, 64); g.lineTo(204, 150); g.closePath();
    const f = g.createLinearGradient(0, 44, 0, 150); f.addColorStop(0, '#fff8d8'); f.addColorStop(0.5, '#ffd65a'); f.addColorStop(1, '#c88a10'); g.fillStyle = f; g.fill(); g.lineWidth = 4; g.strokeStyle = '#fff4c0'; g.stroke();
    g.fillStyle = '#ffe9a0'; g.fillRect(50, 150, 156, 18); g.strokeRect(50, 150, 156, 18);
    for (const [x, y, c] of [[40, 64, '#ff5a6a'], [128, 44, '#6ad8ff'], [216, 64, '#7aff9a'], [128, 128, '#ff5a6a'], [88, 140, '#6ad8ff'], [168, 140, '#7aff9a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 3, y - 3, 3, 0, TAU); g.fill(); }
  });
  // 백룸 복도 (문틈 안에 보이는 그림, 한 점 투시): 형광등 판이 박힌 천장 · 노란 벽지 · 누런 카펫 · 끝의 어두운 문
  const brPoly = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
  const corridorTex = () => ctex('brc', 256, 512, (g, W, H) => {
    const x0 = 104, x1 = 152, y0 = 196, y1 = 288;   // 복도 끝(먼 벽)
    brPoly(g, [[0, 0], [W, 0], [x1, y0], [x0, y0]], '#dcd3a6'); brPoly(g, [[0, H], [W, H], [x1, y1], [x0, y1]], '#8e7d48');
    brPoly(g, [[0, 0], [x0, y0], [x0, y1], [0, H]], '#cfb866'); brPoly(g, [[W, 0], [x1, y0], [x1, y1], [W, H]], '#bea756'); brPoly(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#7e6d36');
    g.fillStyle = '#16110a'; g.fillRect(121, 238, 14, 50);
    g.strokeStyle = 'rgba(118,94,30,0.35)'; g.lineWidth = 1.2;   // 벽지 세로줄 · 천장 이음매 · 카펫 결
    for (let i = 1; i < 16; i++) { const u = i / 16; for (const [a, b] of [[0, x0], [W, x1]]) { g.beginPath(); g.moveTo(lerp(a, b, u), lerp(0, y0, u)); g.lineTo(lerp(a, b, u), lerp(H, y1, u)); g.stroke(); } }
    g.strokeStyle = 'rgba(150,140,100,0.35)'; for (let i = 1; i < 7; i++) { const u = 1 - Math.pow(0.66, i), y = lerp(0, y0, u); g.beginPath(); g.moveTo(lerp(0, x0, u), y); g.lineTo(lerp(W, x1, u), y); g.stroke(); }
    for (let i = 0; i < 6; i++) { const u = 1 - Math.pow(0.62, i + 0.5), cx = W / 2, y = lerp(0, y0, u) + 4, w = lerp(84, 8, u), h = lerp(24, 3, u); const gr = g.createRadialGradient(cx, y, 0, cx, y, w); gr.addColorStop(0, 'rgba(255,255,232,0.6)'); gr.addColorStop(1, 'rgba(255,255,232,0)'); g.fillStyle = gr; g.fillRect(cx - w * 1.3, y - w, w * 2.6, w * 2); g.fillStyle = '#fffff0'; g.fillRect(cx - w / 2, y - h / 2, w, h); }
    const v = g.createRadialGradient(W / 2, (y0 + y1) / 2, 8, W / 2, (y0 + y1) / 2, 300); v.addColorStop(0, 'rgba(28,22,6,0.6)'); v.addColorStop(0.3, 'rgba(28,22,6,0.18)'); v.addColorStop(1, 'rgba(28,22,6,0)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    const R = mulberry32(61); for (let i = 0; i < 1100; i++) { g.fillStyle = R() < 0.55 ? `rgba(60,46,14,${0.05 + R() * 0.08})` : `rgba(255,250,215,${0.04 + R() * 0.07})`; g.fillRect(R() * W, R() * H, 2, 2); }
    for (const [x, d] of [[0, 1], [W, -1]]) { const e = g.createLinearGradient(x, 0, x + d * 22, 0); e.addColorStop(0, 'rgba(20,15,4,0.55)'); e.addColorStop(1, 'rgba(20,15,4,0)'); g.fillStyle = e; g.fillRect(Math.min(x, x + d * 22), 0, 22, H); }
  });
  // 문틈 테두리 빛 (안쪽 가장자리가 가장 밝음)
  const frameTex = () => ctex('brf', 128, 256, (g, W, H) => { for (let i = 0; i < 10; i++) { g.strokeStyle = `rgba(255,255,255,${0.07 + i * 0.09})`; g.lineWidth = 24 - i * 2.2; g.strokeRect(13, 13, W - 26, H - 26); } g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(13, 13, W - 26, H - 26); });
  // 바닥 구멍으로 내려다본 백룸: 네 벽(먼 벽이 가장 밝음) · 벽지 줄이 안쪽으로 모임 · 깊은 바닥의 형광등 빛 · 노란 날
  const pitTex = () => ctex('brp', 256, 256, (g, W) => {
    const i0 = 92, i1 = 164;
    brPoly(g, [[0, 0], [W, 0], [i1, i0], [i0, i0]], '#d9c26d'); brPoly(g, [[0, 0], [i0, i0], [i0, i1], [0, W]], '#b7a052'); brPoly(g, [[W, 0], [i1, i0], [i1, i1], [W, W]], '#a68f3e'); brPoly(g, [[0, W], [W, W], [i1, i1], [i0, i1]], '#6c5d2a'); brPoly(g, [[i0, i0], [i1, i0], [i1, i1], [i0, i1]], '#7c6b38');
    g.strokeStyle = 'rgba(90,70,20,0.45)'; g.lineWidth = 1.2;
    for (let k = 1; k < 12; k++) { const u = k / 12, o = lerp(0, W, u), n = lerp(i0, i1, u); for (const [ax, ay, bx, by] of [[o, 0, n, i0], [o, W, n, i1], [0, o, i0, n], [W, o, i1, n]]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); } }
    const v = g.createRadialGradient(128, 128, 30, 128, 128, 182); v.addColorStop(0, 'rgba(18,14,4,0.55)'); v.addColorStop(0.45, 'rgba(18,14,4,0.25)'); v.addColorStop(1, 'rgba(18,14,4,0)'); g.fillStyle = v; g.fillRect(0, 0, W, W);
    const l = g.createRadialGradient(128, 128, 0, 128, 128, 40); l.addColorStop(0, 'rgba(255,252,220,0.95)'); l.addColorStop(1, 'rgba(255,252,220,0)'); g.fillStyle = l; g.fillRect(88, 88, 80, 80); g.fillStyle = '#fffff0'; g.fillRect(118, 124, 20, 8);
    g.strokeStyle = 'rgba(255,236,150,0.95)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, W - 5, W - 5);
  });
  // 네모 고리 (글리치)
  const sqTex = () => ctex('sq', 256, 256, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 12; g.strokeRect(16, 16, 224, 224); g.lineWidth = 3; g.strokeRect(44, 44, 168, 168); g.fillStyle = '#fff'; for (const [x, y] of [[16, 16], [240, 16], [16, 240], [240, 240]]) g.fillRect(x - 12, y - 12, 24, 24); });
  // 일식 코로나: 검은 원 둘레의 빛 고리 + 뻗는 줄기
  const coronaTex = () => ctex('corona', 256, 256, (g) => {
    const c = 128, gr = g.createRadialGradient(c, c, 44, c, c, 126); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const R = mulberry32(17); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineCap = 'round';
    for (let i = 0; i < 40; i++) { const a = R() * TAU, l = 60 + R() * 60; g.lineWidth = 1 + R() * 2.5; g.beginPath(); g.moveTo(c + Math.cos(a) * 46, c + Math.sin(a) * 46); g.quadraticCurveTo(c + Math.cos(a + 0.2) * (46 + l * 0.6), c + Math.sin(a + 0.2) * (46 + l * 0.6), c + Math.cos(a + 0.1) * (46 + l), c + Math.sin(a + 0.1) * (46 + l)); g.stroke(); }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); g.arc(c, c, 44, 0, TAU); g.fill();
  });
  // 검은 원 (일식의 달 · 구멍) — 덮어 그리기
  const discTex = () => ctex('disc', 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  // ----- 부품 -----
  const mat = (tx, color) => kit().addMat(tx, color);
  // 바닥에 누운 판 (gp = 바닥 점)
  function flat(tx, color, gp, lift = 0.03) { const m = new THREE.Mesh(kit().geo().plane, mat(tx, color)); if (gp.snow) m.material.blending = THREE.NormalBlending;   // 흰 눈 위: 더하기 혼합은 안 보여서 색을 덮어 그림
    m.position.set(gp.x, gp.y + lift, gp.z); m.renderOrder = 4; return m; }
  function ring(gp, color, r1, dur, delay = 0, tx) { const m = flat(tx || tex().ring(), color, gp, 0.045); add(m, dur, (e, u) => { const k = 1 - Math.pow(1 - u, 2.4); m.scale.setScalar(Math.max(0.01, r1 * 2 * (0.08 + 0.92 * k))); m.material.opacity = 1 - u; }, delay); }
  // 바닥 문양: 나타나 돌다가 사라짐 (fin: 사라지는 비율)
  function sigil(gp, tx, size, dur, color, rot, delay = 0, grow = 0, fin = 0.3) { const m = flat(tx, color, gp, 0.035); m.renderOrder = 3; add(m, dur, (e, u) => { m.rotation.y = e.t * rot; m.scale.setScalar(size * (0.85 + 0.15 * Math.min(1, u * 6)) * (1 + grow * u)); m.material.opacity = Math.min(1, u * 7) * (u < 1 - fin ? 1 : (1 - u) / fin); }, delay); return m; }
  // 바닥 자국: 빛나다 식으며(c0 → c1) 사라짐
  function decal(gp, tx, size, dur, c0, c1, delay = 0) { const m = flat(tx, c0, gp, 0.03); m.renderOrder = 3; m.rotation.y = Math.random() * TAU; m.scale.setScalar(size); const A = new THREE.Color(c0), B = new THREE.Color(c1); add(m, dur, (e, u) => { m.material.opacity = Math.min(1, u * 14) * (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45); m.material.color.copy(A).lerp(B, Math.min(1, u * 1.6)); }, delay); }
  // 빛기둥: 아래에서 솟아오른 뒤 흐려짐 (hold: 유지 비율)
  function pillar(gp, color, r, h, dur, delay = 0, hold = 0.3) { const m = new THREE.Mesh(kit().geo().col, mat(colTex(), color)); m.position.set(gp.x, gp.y, gp.z); m.renderOrder = 5; add(m, dur, (e, u) => { const up = Math.min(1, u / 0.18), k = 1 - Math.pow(1 - up, 3), w = r * (0.5 + 0.5 * k) * (1 + u * 0.25); m.scale.set(w, Math.max(0.01, h * k), w); m.rotation.y += e.dt * 1.4; m.material.opacity = u < hold ? 1 : 1 - (u - hold) / (1 - hold); }, delay); return m; }
  // 빛 (카메라를 보는 둥근 빛)
  function glow(p, color, size, dur, delay = 0) { const s = new THREE.Sprite(kit().sprMat(color)); s.position.copy(p); s.renderOrder = 7; add(s, dur, (e, u) => { s.scale.setScalar(size * (0.3 + 0.7 * Math.sqrt(u))); s.material.opacity = (1 - u) * (1 - u); }, delay); }
  // 공중에 누운 고리: 높이 y0 → y1, 반지름 r0 → r1
  function halo(gp, color, y0, y1, r0, r1, dur, delay = 0, tx) { const m = new THREE.Mesh(kit().geo().plane, mat(tx || tex().ring(), color)); m.renderOrder = 6; add(m, dur, (e, u) => { m.position.set(gp.x, gp.y + lerp(y0, y1, u), gp.z); m.scale.setScalar(Math.max(0.01, lerp(r0, r1, u) * 2)); m.rotation.y = e.t * 0.8; m.material.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85); }, delay); }
  // 카메라를 보는 판: upd(m, u, e) 에서 크기·투명도·돌림·위치
  function card(p, tx, color, dur, upd, delay = 0, normal) {
    const m = new THREE.Mesh(kit().vplane(), mat(tx, color)); if (normal) m.material.blending = THREE.NormalBlending; m.renderOrder = normal ? 6 : 8; m.position.copy(p);
    add(m, dur, (e, u) => { if (CAM) m.quaternion.copy(CAM.quaternion); upd(m, u, e); }, delay); return m;
  }
  // 이름 띠 (화면 글자 — #lobbyTags 층): 머리 위 빈자리에, 위 메뉴에 가리면(휴대폰 가로) 발아래 이름표 밑에
  const BAN = [];
  //  opt: { cls 덧붙일 클래스 · html 안쪽 내용 · upd(el, t) 매 프레임 } — 개발자 연출의 명령 줄 띠가 쓴다
  function label(E, gp, delay = 0, dur = 2.4, opt) {
    at(delay, () => {
      const box = document.getElementById('lobbyTags'); if (!box) return;
      const el = document.createElement('div'); el.className = 'ent-ban' + (opt && opt.cls ? ' ' + opt.cls : ''); el.style.setProperty('--ec', '#' + E.c[0].toString(16).padStart(6, '0'));
      el.innerHTML = opt && opt.html ? opt.html : `<i></i><b>${nameOf(E)}</b><i></i>`; box.appendChild(el);
      const top = document.querySelector('#lobby .lb-top'); BAN.push({ el, gp: { x: gp.x, y: gp.y, z: gp.z }, t: 0, dur, top: top ? top.getBoundingClientRect().bottom : 60, upd: opt && opt.upd });
    });
  }
  function tickBan(dt) {
    const W = window.innerWidth, H = window.innerHeight, show = G.state === 'lobby' && !(document.getElementById('lobby') || {}).hidden;
    for (let i = BAN.length - 1; i >= 0; i--) {
      const b = BAN[i]; b.t += dt; const u = b.t / b.dur;
      if (u >= 1 || !CAM) { b.el.remove(); BAN.splice(i, 1); continue; }
      if (b.upd) b.upd(b.el, b.t);
      _a.set(b.gp.x, b.gp.y + 2.0, b.gp.z).project(CAM); _b.set(b.gp.x, b.gp.y, b.gp.z).project(CAM);
      const h = b.el.offsetHeight || 30, x = (_a.x + 1) / 2 * W, yh = (1 - _a.y) / 2 * H, yf = (1 - _b.y) / 2 * H;
      const y = yh - h - 4 >= b.top + 6 ? yh - h - 4 : yf + 30;
      b.el.hidden = !show || _a.z > 1; b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%)`; b.el.style.opacity = (u < 0.75 ? 1 : (1 - u) / 0.25).toFixed(2);
    }
  }
  // 빛줄기·번개 (카메라를 보는 띠)
  function ribbon(n) {
    const g = new THREE.BufferGeometry(), uv = new Float32Array((n + 1) * 4), idx = [];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i <= n; i++) { uv.set([0, i / n, 1, i / n], i * 4); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  function face(g, pts, w) {
    if (!CAM) return; const pos = g.attributes.position.array, n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, n - 1)], o = pts[Math.max(i - 1, 0)];
      _a.subVectors(q, o); _b.subVectors(CAM.position, p); _s.crossVectors(_a, _b); const l = _s.length() || 1; _s.multiplyScalar(w * 0.5 / l);
      pos[i * 6] = p.x + _s.x; pos[i * 6 + 1] = p.y + _s.y; pos[i * 6 + 2] = p.z + _s.z; pos[i * 6 + 3] = p.x - _s.x; pos[i * 6 + 4] = p.y - _s.y; pos[i * 6 + 5] = p.z - _s.z;
    }
    g.attributes.position.needsUpdate = true;
  }
  const boltTex = () => ctex('bolt', 64, 4, (g) => { const r = g.createLinearGradient(0, 0, 64, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.3, 'rgba(255,255,255,0.35)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 4); });
  // a → b 를 지그재그로 (양 끝 고정)
  function jag(pts, a, b, amp) {
    const n = pts.length - 1, L = a.distanceTo(b); _a.subVectors(b, a).normalize(); _s.set(_a.z, 0, -_a.x); if (_s.lengthSq() < 1e-4) _s.set(1, 0, 0); _s.normalize(); _n.crossVectors(_a, _s);
    let ox = 0, oz = 0; for (let i = 0; i <= n; i++) { const u = i / n, env = Math.sin(Math.PI * u); ox = ox * 0.55 + (Math.random() - 0.5); oz = oz * 0.55 + (Math.random() - 0.5); pts[i].lerpVectors(a, b, u); if (i && i < n) pts[i].addScaledVector(_s, ox * amp * L * env).addScaledVector(_n, oz * amp * L * env); }
  }
  // 번개: 하늘 a → 땅 b (가지 2개) · 깜빡이며 모양이 바뀜
  function bolt(a, b, color, dur, delay = 0, w = 0.16) {
    const paths = [{ a: a.clone(), b: b.clone(), n: 22, w, gw: w * 4.5, amp: 0.08 }];
    for (let i = 0; i < 2; i++) { const s = new THREE.Vector3().lerpVectors(a, b, 0.3 + Math.random() * 0.4); paths.push({ a: s, b: s.clone().add(new THREE.Vector3(rnd(-1.6, 1.6), -rnd(0.8, 2), rnd(-1.6, 1.6))), n: 8, w: w * 0.45, gw: 0, amp: 0.16 }); }
    const grp = new THREE.Group();
    for (const Q of paths) { Q.pts = Array.from({ length: Q.n + 1 }, () => new THREE.Vector3()); Q.core = new THREE.Mesh(ribbon(Q.n), mat(boltTex(), 0xffffff)); Q.core.userData.own = true; Q.core.frustumCulled = false; Q.core.renderOrder = 9; grp.add(Q.core); if (Q.gw) { Q.glow = new THREE.Mesh(ribbon(Q.n), mat(boltTex(), color)); Q.glow.userData.own = true; Q.glow.frustumCulled = false; Q.glow.renderOrder = 8; grp.add(Q.glow); } }
    let next = 0;
    add(grp, dur, (e, u) => {
      if (e.t >= next) { next = e.t + 0.05 + Math.random() * 0.04; for (const Q of paths) jag(Q.pts, Q.a, Q.b, Q.amp); }
      const on = u < 0.3 || (u > 0.38 && u < 0.62) || (u > 0.7 && Math.random() < 0.7), op = on ? 1 - u * 0.7 : 0;
      for (const Q of paths) { face(Q.core.geometry, Q.pts, Q.w); Q.core.material.opacity = op; if (Q.glow) { face(Q.glow.geometry, Q.pts, Q.gw); Q.glow.material.opacity = op * 0.7; } }
    }, delay);
  }
  // 곧은 빛줄기 (a → b, 굵기 w)
  function beam(a, b, color, w, dur, delay = 0) { const g = ribbon(1), m = new THREE.Mesh(g, mat(boltTex(), color)); m.userData.own = true; m.renderOrder = 8; const pts = [a.clone(), b.clone()]; add(m, dur, (e, u) => { face(g, pts, w * (1 - u * 0.6)); m.material.opacity = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9; }, delay); }
  // 밝기 (해·반구광 배율, 하늘 배율): f(u) → [k, sky]
  const envFx = (dur, f, delay = 0) => ENV.push({ t: -delay, dur, f });
  const flash = (k, dur, delay = 0) => envFx(dur, (u) => { const v = 1 + (k - 1) * (1 - u) * (1 - u); return [v, 1 + (v - 1) * 0.5]; }, delay);
  const shake = (k, delay = 0) => (delay ? at(delay, () => { SHK = Math.max(SHK, k); }) : (SHK = Math.max(SHK, k)));
  let envOn = false;
  function tickEnv(dt, L) {
    let k = 1, sky = 1;
    for (let i = ENV.length - 1; i >= 0; i--) { const v = ENV[i]; v.t += dt; if (v.t < 0) continue; const u = Math.min(1, v.t / v.dur), m = v.f(u); k *= m[0]; sky *= m[1]; if (u >= 1) ENV.splice(i, 1); }
    const Lt = L.lights; if (!Lt || (!envOn && k === 1 && sky === 1)) return;
    envOn = k !== 1 || sky !== 1;
    for (const l of [Lt.sun, Lt.hemi]) { if (l.userData.b0 === undefined) l.userData.b0 = l.intensity; l.intensity = l.userData.b0 * k; }
    if (L.sky && L.sky.material) L.sky.material.color.setScalar(sky);
  }
  // 재료·그림을 미리 한 번 그려 둔다 (처음 연출 때 휴대폰이 멈칫하지 않게) — 로비를 만든 뒤 한 번
  function warm(L) {
    if (warmed || !L.scene || !G.renderer) return; warmed = true; SC = L.scene; CAM = L.cam;
    const g = kit().geo(), objs = [new THREE.Mesh(g.plane, mat(sigilTex(), 0)), new THREE.Mesh(g.col, mat(colTex(), 0)), new THREE.Sprite(kit().sprMat(0)), new THREE.Mesh(kit().vplane(), mat(tex().ring(), 0))];
    for (const t of [crownTex, corridorTex, frameTex, pitTex, sqTex, coronaTex, discTex, boltTex, podTex, curtainTex, featherTex, clockTex, beamTex]) objs.push(new THREE.Mesh(g.plane, mat(t(), 0)));
    objs.push(new THREE.Mesh(handGeo().box, new THREE.MeshBasicMaterial({ color: 0 })));   // 백룸 손 재료(지도 없는 단색)와 같은 셰이더
    for (const t of ['star4', 'star5', 'flake', 'lava', 'swirl', 'fire', 'ice', 'glow']) if (tex()[t]) objs.push(new THREE.Mesh(g.plane, mat(tex()[t](), 0)));
    const grp = new THREE.Group(); for (const o of objs) { o.frustumCulled = false; o.material.opacity = 0; o.scale.setScalar(0.001); grp.add(o); }
    grp.position.copy(L.cam.position).add(_a.set(0, 0, -1).applyQuaternion(L.cam.quaternion)); L.scene.add(grp);
    try { G.renderer.compile(L.scene, L.cam); G.renderer.render(L.scene, L.cam); } catch (e) { /* 처음 그릴 때 */ }
    L.scene.remove(grp); P();   // 재료는 버리지 않는다 (프로그램 유지) · 입자 풀도 만들어 둠
  }

  // ---------- 캐릭터: 열쇠 자세 ----------
  //  좌표: 가슴·머리·몸(r.body — 발바닥 = 0) 로컬, x 왼쪽 +, y 위, z 앞 · 팔 사양은 오른팔 기준으로 쓰고 왼팔은 x 를 뒤집는다
  const lp = (o, x, y, z, out) => out.set(x, y, z).applyMatrix4(o.matrixWorld);
  const ld = (o, x, y, z, out) => out.set(x, y, z).applyQuaternion(worldQuat(o, _q2)).normalize();
  const fing = (A, f) => (f === 'fist' ? setFist(A) : setFingers(A, FING[f || 'relax']));
  // 팔 FK: 위팔(앞뒤 x, 비틀기 y, 벌리기 z) · 팔꿈치 굽힘(음수)
  const fk = (A, x, y, z, el, f) => { A.sh.rotation.set(x, y * A.side, z * A.side); A.el.rotation.set(el, 0, 0); fing(A, f); };
  // 팔 IK: sp 로컬 손목 자리 p · 손가락 방향 fd · 손바닥 방향 pn(sp 로컬, 없으면 팔뚝과 일직선) · 팔꿈치가 향할 점 pole(가슴 로컬)
  function hand(r, A, sp, p, fd, pn, pole, f) {
    lp(sp, p[0], p[1], p[2], _c); lp(r.chest, pole[0], pole[1], pole[2], _d);
    let Q = null; if (fd) { ld(sp, fd[0], fd[1], fd[2], _e); ld(sp, pn[0], pn[1], pn[2], _f); Q = handQuat(_q, _e, _f, A.side); }
    armIK(A, _c, _d, Q, 1, null, r.body.scale.x); fing(A, f);   // 몸이 작아지는 중이면 팔 길이도 그만큼
  }
  // 오른팔 사양을 왼팔로 (x 뒤집기)
  const mx = (v) => (v ? [-v[0], v[1], v[2]] : v);
  function hands(r, sp, p, fd, pn, pole, f) { hand(r, r.armR, sp, p, fd, pn, pole, f); hand(r, r.armL, sp, mx(p), mx(fd), mx(pn), mx(pole), f); }
  // 디딘 발: 몸 로컬 발목 자리 p(선 자세 발목 높이 0.085) · 무릎 방향 kn · 발끝 벌림 splay(null = 발이 정강이를 따름 — 무릎 꿇은 발)
  function plant(r, L, p, kn, splay) {
    lp(r.body, p[0], p[1], p[2], _c); ld(r.body, kn[0], kn[1], kn[2], _d);
    const s = r.body.scale.x; if (Math.abs(s - 1) > 1e-3) { L.hip.getWorldPosition(_e); _c.sub(_e).divideScalar(s).add(_e); }   // 몸이 작아지는 중: 같은 각도가 나오게 목표를 늘림
    let Qf = null; if (splay !== null) { _eu.set(0, r.root.rotation.y + r.body.rotation.y + L.side * splay, 0); Qf = _qf.setFromEuler(_eu); }
    legIK(L, _c, _d, Qf, 1);
  }
  const feet = (r, w = 0.1, zl = 0.02, zr = 0.02) => { plant(r, r.legL, [w, 0.085, zl], [0, 0, 1], 0.14); plant(r, r.legR, [-w, 0.085, zr], [0, 0, 1], 0.14); };
  // 다리 FK (공중): 허벅지 앞뒤(음수 = 앞) · 벌림 · 무릎(양수 = 굽힘) · 발끝(양수 = 내림)
  const lfk = (L, x, z, kn, ft) => { L.hip.rotation.set(x, 0, z * L.side); L.knee.rotation.set(kn, 0, 0); L.foot.rotation.set(ft, 0, 0); };
  const up = (r) => r.root.updateMatrixWorld(true);
  const spineSet = (r, h, s, c, n, hd) => { r.hips.rotation.set(h[0], h[1] || 0, h[2] || 0); r.spine.rotation.set(s[0], s[1] || 0, s[2] || 0); r.chest.rotation.set(c[0], c[1] || 0, c[2] || 0); r.neck.rotation.set(n[0], n[1] || 0, n[2] || 0); r.head.rotation.set(hd[0], hd[1] || 0, hd[2] || 0); };
  const grounded = (r) => Math.abs(r.body.position.y) < 0.02;
  const legsStand = (r, w, zl, zr) => { if (grounded(r)) feet(r, w, zl, zr); else { lfk(r.legL, 0, 0.03, 0.04, 0); lfk(r.legR, 0, 0.03, 0.04, 0); } };
  const KP = {
    // 선 자세 (총 없이, 팔 내림)
    stand(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0.02], [0.03], [0], [-0.02], [-0.02]); up(r); legsStand(r); fk(r.armL, 0.05, 0, 0.12, -0.18); fk(r.armR, 0.05, 0, 0.12, -0.18); },
    // 차렷: 발 모으고 손가락 펴서 옆에
    att(r) { r.hips.position.set(0, 0.958, 0); spineSet(r, [0], [-0.02], [-0.03], [0], [-0.03]); up(r); legsStand(r, 0.07); fk(r.armL, 0, 0, 0.07, -0.05, 'flat'); fk(r.armR, 0, 0, 0.07, -0.05, 'flat'); },
    // 경례 (오른손 끝을 오른쪽 눈썹에)
    salute(r) { KP.att(r); up(r); hand(r, r.armR, r.head, [-0.115, 0.06, 0.07], [0.62, 0.32, 0.55], [0.12, -0.9, -0.35], [-0.55, 0.22, 0.12], 'flat'); },
    // 손 흔들기 (o.t 로 흔듦)
    wave(r, o) { KP.stand(r); const w = Math.sin(o.t * 11); up(r); r.head.rotation.set(-0.06, -0.12, 0.06); hand(r, r.armR, r.chest, [-0.36 + w * 0.06, 0.44, 0.14], [w * 0.35, 1, 0], [0, 0, 1], [-0.62, -0.12, -0.05], 'open'); },
    // 가슴에 손 얹고 인사
    bow(r) { r.hips.position.set(0, 0.93, -0.04); spineSet(r, [-0.06], [0.42], [0.2], [0.12], [0.12]); up(r); legsStand(r, 0.09); hand(r, r.armR, r.chest, [0.07, 0.06, 0.18], [1, 0.3, 0], [0, 0, -1], [-0.36, -0.32, 0.25], 'flat'); fk(r.armL, -0.55, 0, 0.12, -0.12); },
    // 축복: 두 손을 벌려 손바닥을 위로 · 하늘을 봄
    open(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.08], [-0.08], [-0.15], [-0.18]); up(r); legsStand(r, 0.1); hands(r, r.chest, [-0.42, -0.2, 0.26], [-0.3, 0.1, 1], [0, 1, 0], [-0.6, -0.25, -0.1], 'open'); },
    // 한 무릎 착지: 왼발 앞 · 오른 무릎 바닥 · 오른 주먹으로 땅 · 왼팔은 뒤로 벌려 균형 · 고개 숙임
    land(r) {
      r.hips.position.set(0, 0.5, 0.0); spineSet(r, [0.42, -0.12], [0.42, -0.06], [0.22, -0.05], [0.05], [0.08]); up(r);
      plant(r, r.legL, [0.17, 0.085, 0.34], [0.1, 0.4, 1], 0.25); plant(r, r.legR, [-0.11, 0.13, -0.4], [0, -1, 0.4], null);
      hand(r, r.armR, r.body, [-0.15, 0.17, 0.44], null, null, [-0.45, -0.1, -0.35], 'fist'); fk(r.armL, 0.75, 0, 0.8, -0.3, 'open');
    },
    // 일어서는 중 (고개를 들고)
    rise(r) { r.hips.position.set(0, 0.72, 0.0); spineSet(r, [0.3], [0.22], [0.08], [-0.12], [-0.12]); up(r); plant(r, r.legL, [0.14, 0.085, 0.22], [0.1, 0.2, 1], 0.2); plant(r, r.legR, [-0.12, 0.085, -0.16], [0, 0, 1], 0.1); fk(r.armL, 0.2, 0, 0.45, -0.3); fk(r.armR, -0.25, 0, 0.25, -0.5, 'fist'); },
    // 떨어지는 중 (무릎 굽히고 팔 벌림)
    fall(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [-0.12], [-0.1], [-0.05], [-0.1], [-0.15]); up(r); lfk(r.legL, -0.75, 0.08, 1.2, 0.25); lfk(r.legR, -0.25, 0.08, 0.7, 0.35); fk(r.armL, -0.3, 0, 1.85, -0.45, 'open'); fk(r.armR, -0.3, 0, 1.85, -0.45, 'open'); },
    // 돌며 강하: 팔을 활짝 · 다리 모아 발끝 내림
    spin(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.05], [-0.05], [-0.08], [-0.1]); up(r); lfk(r.legL, 0.02, 0.02, 0.12, 0.6); lfk(r.legR, -0.08, 0.02, 0.22, 0.6); fk(r.armL, -0.1, 0, 1.45, -0.12, 'open'); fk(r.armR, -0.1, 0, 1.45, -0.12, 'open'); },
    // 떠 있음: 팔을 조금 벌려 손바닥 아래 · 발끝 내림
    float(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0.02], [-0.04], [-0.06], [-0.1], [-0.16]); up(r); lfk(r.legL, -0.04, 0.02, 0.1, 0.65); lfk(r.legR, 0.06, 0.02, 0.24, 0.6); fk(r.armL, -0.12, 0.2, 0.6, -0.25, 'flat'); fk(r.armR, -0.12, 0.2, 0.6, -0.25, 'flat'); },
    // 두 팔을 위로 벌리고 하늘을 봄 (떠오르기)
    reach(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [-0.04], [-0.12], [-0.12], [-0.25], [-0.3]); up(r); legsStand(r, 0.08); fk(r.armL, -0.35, 0.2, 2.25, -0.2, 'open'); fk(r.armR, -0.35, 0.2, 2.25, -0.2, 'open'); },
    // 오른 주먹 하늘로 (승리)
    victory(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.06], [-0.08], [-0.12], [-0.16]); up(r); legsStand(r, 0.15); hand(r, r.armR, r.chest, [-0.2, 0.74, 0.1], null, null, [-0.6, 0.3, 0.1], 'fist'); hand(r, r.armL, r.chest, [0.25, -0.24, -0.02], [0, -1, 0.3], [1, 0, 0], [0.6, -0.1, -0.3], 'fist'); },
    // 두 팔 V (챔피언)
    vArms(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.1], [-0.1], [-0.18], [-0.22]); up(r); legsStand(r, 0.16); fk(r.armL, -0.25, 0.2, 2.55, -0.15, 'fist'); fk(r.armR, -0.25, 0.2, 2.55, -0.15, 'fist'); },
    // 팔짱 (두 손을 반대쪽 팔꿈치 위로)
    cross(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.04], [-0.06], [-0.08], [-0.1]); up(r); legsStand(r, 0.17); hand(r, r.armR, r.chest, [0.15, 0.02, 0.2], [1, 0.1, 0.1], [0, 0, -1], [-0.42, -0.12, 0.3], 'flat'); hand(r, r.armL, r.chest, [-0.14, 0.06, 0.24], [-1, 0.05, 0.1], [0, 0, 1], [0.42, -0.08, 0.32], 'flat'); },
    // 힘을 터뜨림: 팔을 아래·옆으로 뻗고 가슴을 폄
    burst(r) { r.hips.position.set(0, 0.93, 0); spineSet(r, [0], [-0.14], [-0.14], [-0.12], [-0.18]); up(r); legsStand(r, 0.2); fk(r.armL, -0.2, 0.3, 0.85, -0.12, 'fist'); fk(r.armR, -0.2, 0.3, 0.85, -0.12, 'fist'); },
    // 두 주먹 들어 힘자랑 (전쟁의 신)
    flex(r) { r.hips.position.set(0, 0.94, 0); spineSet(r, [0], [-0.1], [-0.12], [-0.12], [-0.2]); up(r); legsStand(r, 0.2); hands(r, r.chest, [-0.43, 0.44, 0.02], null, null, [-0.65, 0.12, -0.08], 'fist'); },
    // 오른팔을 하늘로 뻗음
    armUp(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.08], [-0.1], [-0.25], [-0.3]); up(r); legsStand(r, 0.13); hand(r, r.armR, r.chest, [-0.16, 0.86, 0.12], [0, 1, 0.1], [-0.5, 0, 1], [-0.6, 0.2, 0], 'flat'); fk(r.armL, 0.05, 0, 0.3, -0.2, 'fist'); },
    // 깊게 웅크림 (뛰어오르기 직전 · 팔을 뒤로)
    charge(r) { r.hips.position.set(0, 0.6, -0.04); spineSet(r, [0.4], [0.3], [0.12], [-0.25], [-0.25]); up(r); plant(r, r.legL, [0.13, 0.085, 0.08], [0.15, 0.3, 1], 0.2); plant(r, r.legR, [-0.13, 0.085, 0.04], [-0.15, 0.3, 1], 0.2); fk(r.armL, 1.0, 0, 0.2, -0.25, 'fist'); fk(r.armR, 1.0, 0, 0.2, -0.25, 'fist'); },
    // 솟구침: 몸을 쭉 펴고 팔은 머리 위로
    jump(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.06], [-0.06], [-0.2], [-0.25]); up(r); lfk(r.legL, 0.05, 0.02, 0.15, 0.7); lfk(r.legR, 0.12, 0.02, 0.3, 0.7); fk(r.armL, -0.2, 0, 2.9, -0.05, 'flat'); fk(r.armR, -0.2, 0, 2.9, -0.05, 'flat'); },
    // 땅을 내려침: 양발 넓게 깊이 앉아 오른 주먹으로 가운데
    punch(r) { r.hips.position.set(0, 0.52, -0.05); spineSet(r, [0.55], [0.4], [0.2], [-0.05], [0]); up(r); plant(r, r.legL, [0.3, 0.085, 0.12], [0.5, 0.2, 1], 0.45); plant(r, r.legR, [-0.3, 0.085, 0.12], [-0.5, 0.2, 1], 0.45); hand(r, r.armR, r.body, [-0.04, 0.17, 0.45], null, null, [-0.5, 0.0, -0.2], 'fist'); fk(r.armL, 0.55, 0, 0.9, -0.5, 'fist'); },
    // 주먹을 손바닥에 (오버로드)
    fistPalm(r) { r.hips.position.set(0, 0.94, 0); spineSet(r, [0.03], [0.05], [0], [0.04], [0.04]); up(r); legsStand(r, 0.18); hand(r, r.armR, r.chest, [-0.06, 0.04, 0.27], null, null, [-0.5, -0.32, 0.05], 'fist'); hand(r, r.armL, r.chest, [0.07, 0.02, 0.3], [-0.2, 0.75, 0.6], [-1, 0, 0.15], [0.5, -0.32, 0.05], 'flat'); },
    // 두리번 (o.t 로 좌우)
    look(r, o) { KP.stand(r); const s = Math.sin(o.t * 2.6); r.neck.rotation.y = s * 0.35; r.head.rotation.set(-0.05, s * 0.45, s * 0.05); r.chest.rotation.y = s * 0.12; },
    // 어깨 으쓱: 손바닥을 위로 · 고개 갸웃
    shrug(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [0], [-0.02], [0], [0.02, 0, 0.18]); up(r); legsStand(r, 0.11); r.armL.clav.rotation.set(0, 0, 0.22); r.armR.clav.rotation.set(0, 0, -0.22); up(r); hands(r, r.chest, [-0.34, -0.18, 0.22], [-0.6, 0, 1], [0, 1, 0], [-0.55, -0.3, -0.2], 'open'); },
    // 차렷 + 고개 들기 (이터널 · 베테랑 등장 순간)
    tall(r) { KP.att(r); r.head.rotation.x = -0.12; },
    // 몸을 던짐 (몸 채널에서 앞으로 크게 기울임): 두 팔을 머리 위로 쭉 · 한 다리는 뒤로 뻗고 한 다리는 굽힘 · 앞을 봄
    dive(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [-0.05], [-0.12], [-0.1], [-0.45], [-0.35]); up(r); lfk(r.legL, 0.28, 0.04, 0.15, 0.6); lfk(r.legR, -0.45, 0.04, 1.1, 0.5); fk(r.armL, -2.75, 0, 0.2, -0.12, 'open'); fk(r.armR, -2.75, 0, 0.2, -0.12, 'open'); },
    // 네 발로 엎드림 (무릎·손바닥이 바닥) · lk: 어깨 너머로 뒤를 돌아보는 정도 (팔을 짚기 전에 상체를 틀어 손은 그대로)
    sprawl(r, o, lk = 0) {
      r.hips.position.set(0, 0.5, 0); spineSet(r, [0.65], [0.5, -0.12 * lk], [0.25, -0.3 * lk, 0.15 * lk], [-0.6 + 0.35 * lk, -0.75 * lk, 0.1 * lk], [-0.45 + 0.4 * lk, -0.7 * lk, 0.15 * lk]); up(r);
      plant(r, r.legL, [0.13, 0.1, -0.42], [0, -1, 0.35], null); plant(r, r.legR, [-0.13, 0.1, -0.42], [0, -1, 0.35], null);
      hands(r, r.body, [-0.21, 0.05, 0.5], [0, 0, 1], [0, -1, 0], [-0.5, 0.05, -0.25], 'flat');
    },
    crawlLook(r, o) { KP.sprawl(r, o, 1); },
    // 선 채로 오른쪽 어깨 너머 뒤를 돌아봄 (왼팔은 반쯤 들어 막는 자세)
    lookBack(r) { r.hips.position.set(0, 0.94, 0); spineSet(r, [0, -0.15], [0.02, -0.3], [-0.02, -0.45], [0, -0.55], [-0.05, -0.55, -0.05]); up(r); legsStand(r, 0.14, 0.06, -0.04); fk(r.armL, -0.55, 0, 0.45, -1.1, 'open'); fk(r.armR, 0.1, 0, 0.18, -0.3); },
    // 휴 — 손등으로 이마의 땀을 훔침
    wipe(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [0], [-0.04], [-0.12], [-0.16, 0, -0.06]); up(r); legsStand(r, 0.11); hand(r, r.armR, r.head, [-0.07, 0.11, 0.13], [1, 0.12, 0.05], [0, 0.1, 1], [-0.45, 0.02, 0.22], 'relax'); fk(r.armL, 0.05, 0, 0.12, -0.2); },
    // 발밑을 내려다봄 (중심을 잃으려는 듯 팔을 조금 벌리고 무릎을 굽힘)
    lookDown(r) { r.hips.position.set(0, 0.9, 0); spineSet(r, [0.06], [0.18], [0.1], [0.4], [0.3]); up(r); legsStand(r, 0.15, 0.03, 0); fk(r.armL, -0.15, 0, 0.6, -0.35, 'open'); fk(r.armR, -0.15, 0, 0.6, -0.35, 'open'); },
    // 트로피를 가슴 앞에서 두 손으로 / 머리 위로 번쩍 (o.t 로 들썩)
    trophyHold(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.03], [-0.04], [-0.05], [-0.08]); up(r); legsStand(r, 0.12); hands(r, r.chest, [-0.15, 0.04, 0.3], null, null, [-0.5, -0.3, 0.05], 'fist'); },
    trophyUp(r, o) { const b = Math.abs(Math.sin(o.t * 5)) * 0.07; r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.08], [-0.1], [-0.2], [-0.25]); up(r); legsStand(r, 0.15); hands(r, r.chest, [-0.15, 0.62 + b, 0.14], null, null, [-0.55, 0.3, 0.1], 'fist'); },
    // 커튼콜 인사: 깊이 숙이며 오른손은 배 앞으로, 왼팔은 옆으로 펼침
    bowSweep(r) { r.hips.position.set(0, 0.92, -0.05); spineSet(r, [-0.08], [0.5], [0.25], [0.12], [0.1]); up(r); legsStand(r, 0.1, 0.06, -0.12); hand(r, r.armR, r.chest, [0.08, -0.28, 0.24], [1, -0.2, 0], [0, 0, -1], [-0.4, -0.35, 0.2], 'flat'); fk(r.armL, -0.6, 0, 1.15, -0.2, 'open'); },
    // 행진 (o.t 로 걸음 — 몸 채널로 앞으로 움직임)
    march(r, o) { const w = o.t * TAU * 1.1, s = Math.sin(w); r.hips.position.set(0, 0.93 + Math.abs(Math.cos(w)) * 0.02, 0); spineSet(r, [0.04], [0.04], [0], [-0.02], [-0.04]); up(r); lfk(r.legL, -0.42 * s, 0.03, Math.max(0, s) * 0.75 + 0.06, 0.1); lfk(r.legR, 0.42 * s, 0.03, Math.max(0, -s) * 0.75 + 0.06, 0.1); fk(r.armL, 0.38 * s, 0, 0.1, -0.25, 'fist'); fk(r.armR, -0.38 * s, 0, 0.1, -0.25, 'fist'); },
    // 목을 좌우로 꺾어 풂 (주먹 쥐고)
    neck(r, o) { KP.stand(r); const p = Math.sin(o.t * 4.2); r.neck.rotation.z = p * 0.3; r.head.rotation.set(-0.05, p * 0.1, p * 0.25); fk(r.armL, 0.05, 0, 0.14, -0.2, 'fist'); fk(r.armR, 0.05, 0, 0.14, -0.2, 'fist'); },
    // 옥좌에 앉음: 두 손을 팔걸이에 (위엄) / 오른 주먹으로 턱을 괴고 몸을 조금 숙임
    sitGrand(r) { r.hips.position.set(0, 0.6, -0.02); spineSet(r, [-0.05], [-0.04], [-0.03], [-0.04], [-0.1]); up(r); plant(r, r.legL, [0.17, 0.085, 0.42], [0.2, 0.2, 1], 0.25); plant(r, r.legR, [-0.17, 0.085, 0.42], [-0.2, 0.2, 1], 0.25); hands(r, r.body, [-0.42, 0.8, 0.02], [0, 0, 1], [0, -1, 0], [-0.6, -0.15, -0.2], 'claw'); },
    sitRest(r) { r.hips.position.set(0, 0.6, -0.02); spineSet(r, [-0.02], [0.1], [0.08, -0.08], [0.05], [0.06, -0.05, 0.12]); up(r); plant(r, r.legL, [0.17, 0.085, 0.42], [0.2, 0.2, 1], 0.25); plant(r, r.legR, [-0.12, 0.085, 0.47], [-0.1, 0.2, 1], 0.1); hand(r, r.armR, r.head, [-0.02, -0.13, 0.11], null, null, [-0.3, -0.5, 0.2], 'fist'); hand(r, r.armL, r.body, [0.42, 0.8, 0.02], [0, 0, 1], [0, -1, 0], [0.6, -0.15, -0.2], 'claw'); },
    // 땅에 꽂힌 검의 손잡이를 두 손으로 / 검을 머리 위로 치켜듦
    gripSword(r) { r.hips.position.set(0, 0.9, 0); spineSet(r, [0.08], [0.12], [0.05], [0], [0.05]); up(r); legsStand(r, 0.17, 0.05, -0.05); hand(r, r.armR, r.chest, [-0.02, -0.12, 0.42], null, null, [-0.5, -0.3, 0.1], 'fist'); hand(r, r.armL, r.chest, [0.02, -0.22, 0.4], null, null, [0.5, -0.3, 0.1], 'fist'); },
    swordUp(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [-0.1], [-0.12], [-0.3], [-0.35]); up(r); legsStand(r, 0.18); hand(r, r.armR, r.chest, [-0.03, 0.8, 0.14], null, null, [-0.5, 0.3, 0], 'fist'); hand(r, r.armL, r.chest, [0.01, 0.7, 0.16], null, null, [0.5, 0.3, 0], 'fist'); },
    // 아래로 떨어짐: 두 팔을 위로 허우적 · 위(빛 쪽)를 봄
    flail(r, o) { const s = Math.sin(o.t * 13) * 0.25; r.hips.position.set(0, 0.95, 0); spineSet(r, [-0.08], [-0.12], [-0.1], [-0.3], [-0.4]); up(r); lfk(r.legL, -0.6, 0.05, 1.1, 0.3); lfk(r.legR, 0.1, 0.05, 0.3, 0.5); fk(r.armL, -0.4 + s, 0.3, 2.45, -0.7, 'open'); fk(r.armR, -0.4 - s, 0.3, 2.45, -0.7, 'open'); },
    // ----- 개발자 -----
    // T 자세: 편집기에 막 불러온 모델 그대로 (팔을 옆으로 쭉 · 손가락 펴고 · 정면 — 숨도 쉬지 않음)
    tpose(r) { r.hips.position.set(0, 0.962, 0); spineSet(r, [0], [0], [0], [0], [0]); up(r); legsStand(r, 0.11, 0, 0); fk(r.armL, 0, 0, 1.5, 0, 'flat'); fk(r.armR, 0, 0, 1.5, 0, 'flat'); },
    // 깨어나 자기 두 손을 내려다봄 (손가락을 쥐었다 폄 — o.t)
    lookHands(r, o) { const k = 0.5 - 0.5 * Math.cos(o.t * 10); r.hips.position.set(0, 0.95, 0); spineSet(r, [0.02], [0.08], [0.06], [0.34], [0.34]); up(r); legsStand(r, 0.12);
      hands(r, r.chest, [-0.2, 0.0, 0.3], [0.3, 0.5, 1], [0.1, 0.85, -0.45], [-0.55, -0.35, -0.05], 'open'); for (const A of [r.armL, r.armR]) setFingers(A, mixFing(FING.open, FING.hold, k)); },
    // 허공의 자판을 두드림 (o.t: 두 손이 번갈아 들썩 · 손가락이 까딱)
    type(r, o) { const t = o.t; r.hips.position.set(0, 0.95, 0); spineSet(r, [0.02], [0.06], [0.04], [0.16], [0.16]); up(r); legsStand(r, 0.13);
      for (const [A, s, ph] of [[r.armR, 1, 0], [r.armL, -1, 1.7]]) { const b = Math.max(0, Math.sin(t * 31 + ph)), c = Math.sin(t * 23 + ph * 2);
        hand(r, A, r.chest, [(-0.14 + c * 0.012) * s, -0.2 + b * 0.016, 0.33 + c * 0.01], [0.1 * s, 0.05, 1], [0, -1, 0.1], [-0.5 * s, -0.4, -0.1], 'relax');
        setFingers(A, [0.45 + 0.4 * Math.max(0, Math.sin(t * 37 + ph)), 0.4, 0.35 + 0.5 * Math.max(0, Math.sin(t * 29 + ph + 1)), 0.3, 0.2]); } },
    // 실행 키를 누르려고 오른손을 치켜듦 (검지만 폄) / 내리찍음 — 왼손은 자판 위에 그대로
    enterUp(r) { r.hips.position.set(0, 0.95, 0); spineSet(r, [0], [0.02], [-0.03, 0.08], [-0.04], [-0.06]); up(r); legsStand(r, 0.13);
      hand(r, r.armR, r.chest, [-0.3, 0.4, 0.2], [0.1, 0.9, 0.4], [0.2, -0.3, 1], [-0.65, 0, -0.1], 'relax'); setFingers(r.armR, FPOINT);
      hand(r, r.armL, r.chest, [0.14, -0.2, 0.33], [-0.1, 0.05, 1], [0, -1, 0.1], [0.5, -0.4, -0.1], 'relax'); },
    enterHit(r) { r.hips.position.set(0, 0.94, 0); spineSet(r, [0.03], [0.1], [0.07, -0.06], [0.14], [0.12]); up(r); legsStand(r, 0.13);
      hand(r, r.armR, r.chest, [-0.08, -0.2, 0.39], [0.1, -0.5, 1], [0, -1, -0.2], [-0.5, -0.35, -0.1], 'relax'); setFingers(r.armR, FPOINT);
      hand(r, r.armL, r.chest, [0.14, -0.2, 0.33], [-0.1, 0.05, 1], [0, -1, 0.1], [0.5, -0.4, -0.1], 'relax'); },
    // 팔짱 끼고 고개를 끄덕 (o.t)
    crossNod(r, o) { KP.cross(r); r.head.rotation.x = -0.1 + Math.max(0, Math.sin(o.t * 7)) * 0.2; },
    // 검지 경례를 이마에서 바깥으로 툭 (o.t 0.7~0.95초에 튕김)
    devBye(r, o) { const k = sstep(0.7, 0.95, o.t); KP.stand(r); r.head.rotation.set(-0.08, -0.1, 0.05); up(r);
      hand(r, r.armR, r.head, [lerp(-0.115, -0.3, k), lerp(0.06, 0.13, k), lerp(0.07, 0.24, k)], [lerp(0.62, 0.3, k), lerp(0.32, 0.8, k), 0.55], [0.12, -0.9, -0.35], [-0.55, 0.22, 0.12], 'flat'); setFingers(r.armR, FPOINT); },
  };
  const FPOINT = [1.6, 1.55, 0.05, 0.05, 0.9];   // 검지만 편 손
  // 열쇠 자세 하나를 놓는다: 뼈 초기화 → 몸 채널 → 자세 함수
  const B0 = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sx: 1, sy: 1, sz: 1, vis: true };
  const BB = Object.assign({}, B0);
  function bodySet(r, B) { r.body.position.set(B.x, B.y, B.z); r.body.rotation.set(B.rx, B.ry, B.rz); r.body.scale.set(Math.max(1e-3, B.s * B.sx), Math.max(1e-3, B.s * B.sy), Math.max(1e-3, B.s * B.sz)); }
  function evalKey(r, name, B, o) { resetPose(r); bodySet(r, B); up(r); (KP[name] || KP.stand)(r, o); }
  const IDL = { q: [], h: new THREE.Vector3() }, KA = { q: [], h: new THREE.Vector3() };
  function grab(r, S) { const L = r.bones; for (let i = 0; i < L.length; i++) (S.q[i] || (S.q[i] = new THREE.Quaternion())).copy(L[i].quaternion); S.h.copy(r.hips.position); }
  function mixTo(r, S, k) { const L = r.bones; for (let i = 0; i < L.length; i++) L[i].quaternion.slerp(S.q[i], k); r.hips.position.lerp(S.h, k); }

  // ---------- 동작 ----------
  //  dur · keys [[시각, 열쇠 자세, 그 자세로 넘어가는 시간]] · body(t, B, a) 몸 채널 · fx(a) 시작 때 효과 예약 · tick(a, r, t, dt) 매 프레임
  //  kind: 'in' 은 끝 0.5초에 쉬는 자세로, 'out' 은 처음 0.3초를 쉬는 자세에서 (나머지는 사라짐)
  const ein = (u) => u * u, eout = (u) => 1 - (1 - u) * (1 - u), seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const hipsW = (r, out) => r.hips.getWorldPosition(out);
  const chestW = (r, out) => r.chest.getWorldPosition(out);
  const hipsAt = (a, y) => _g.set(a.gp.x, a.gp.y + y, a.gp.z);
  const MOT = {};
  const stepQ = (u, n) => Math.floor(u * n + 1e-6) / n;
  // ----- 소품: 고체는 lam(같이 쓰는 재료라 지우지 않음) · 빛나는 것은 더하기 혼합 단색 · 도형은 소품마다 새로 만들고 끝나면 지움
  const solid = (geo, col, par, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, lam(col)); m.userData.keep = true; m.userData.own = true; m.castShadow = m.receiveShadow = true; m.position.set(x, y, z); if (par) par.add(m); return m; };
  const glowM = (col, op = 1) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const lit = (geo, col, par, x = 0, y = 0, z = 0, op = 1) => { const m = new THREE.Mesh(geo, glowM(col, op)); m.userData.own = true; m.renderOrder = 6; m.position.set(x, y, z); if (par) par.add(m); return m; };
  const grpAt = (a, dz = 0) => { const g = new THREE.Group(); g.position.set(a.gp.x + Math.sin(a.yaw) * dz, a.gp.y, a.gp.z + Math.cos(a.yaw) * dz); g.rotation.y = a.yaw; return g; };
  const gpOf = (a, v) => ({ x: v.x, y: a.gp.y, z: v.z, snow: a.gp.snow });
  const burst = (p, E, n, sp, opt) => { const Q = P(); for (let i = 0; i < n; i++) { _a.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(sp * 0.4, sp)); EM(Q, p, _a.x, _a.y, _a.z, pk(E), rnd(0.03, 0.065), rnd(0.4, 0.9), Object.assign({ drag: 2, so: 0.45 }, opt)); } };
  const FLATQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  // ===== 노바: 하늘의 별 하나가 떨며 부풀다 '노바'로 터지고, 그 조각이 유성이 되어 떨어져 한 무릎 착지 · 둘레에 푸른 수정이 솟았다가 부서짐
  //        퇴장: 웅크려 가슴에 빛을 모았다가 솟구치고, 하늘에서 다시 별로 터짐
  const NOVA = [0.6, 2.6, -2.2];   // 터지는 별 자리 (캐릭터 기준 x 왼쪽 · 높이 · z 앞)
  function novaBurst(a, p, delay, k = 1) {
    const E = a.E;
    at(delay, () => { glow(p, E.c[2], 3.2 * k, 0.45); glow(p, E.c[0], 6 * k, 0.8); flash(1.35, 0.3); shake(0.03);
      for (const [s, d, c] of [[2.6, 0.7, E.c[0]], [1.6, 0.5, E.c[2]], [3.6, 1.0, E.c[1]]]) card(p.clone(), tex().ring(), c, d, (m, u) => { m.scale.setScalar(s * k * (0.1 + 0.9 * eout(u))); m.material.opacity = 1 - u; });
      burst(p, E, 60, 4.5 * k, { g: 0 }); });
  }
  function crystals(a, t0, t1) {
    const E = a.E, g = grpAt(a), geo = new THREE.OctahedronGeometry(1, 0), C = [];
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * TAU + rnd(-0.25, 0.25), rr = rnd(0.5, 0.95), h = rnd(0.35, 0.7), w = rnd(0.08, 0.13), tl = rnd(0.25, 0.55), c = new THREE.Group();
      c.position.set(Math.sin(an) * rr, 0, Math.cos(an) * rr); c.rotation.set(tl * Math.cos(an), 0, -tl * Math.sin(an));
      lit(geo, E.c[0], c, 0, 0, 0, 0.85).scale.set(w, h, w); lit(geo, 0xffffff, c, 0, 0, 0, 0.55).scale.set(w * 0.45, h * 0.8, w * 0.45);
      c.scale.setScalar(0.001); g.add(c); C.push([c, i * 0.035]);
    }
    const T = t1 - t0;
    add(g, T + 0.3, (e) => { const t = e.t; for (const [c, d] of C) c.scale.setScalar(Math.max(0.001, t < T ? eout(seg(t, d, d + 0.16)) * (1 + Math.sin(t * 6 + d * 40) * 0.04) : 1 - seg(t, T, T + 0.15))); }, t0);
    at(t1, () => { for (const [c] of C) { c.getWorldPosition(_c); _c.y += 0.15; burst(_c, E, 10, 1.6, { g: -2 }); } });
  }
  MOT.nova = { kind: 'in', dur: 4.1, keys: [[0, 'fall'], [1.05, 'land', 0.06], [1.95, 'land'], [2.5, 'rise', 0.5], [2.8, 'stand', 0.3]],
    body(t, B) { B.vis = t > 0.55; if (t < 1.05) { const k = ein(seg(t, 0.55, 1.05)); B.x = NOVA[0] * (1 - k); B.y = NOVA[1] * (1 - k); B.z = NOVA[2] * (1 - k); } else if (t < 1.17) B.y = -0.04 * Math.sin((t - 1.05) / 0.12 * Math.PI); },
    fx(a) {
      const E = a.E, gp = a.gp, p = loc(a, NOVA[0], NOVA[1] + 0.9, NOVA[2], new THREE.Vector3()), T = 1.05;
      card(p.clone(), tex().star4(), E.c[2], 0.58, (m, u) => { m.scale.setScalar(0.25 + u * u * 1.7); m.rotateZ(0.09); m.material.opacity = 0.55 + 0.45 * Math.random(); });
      glow(p, E.c[0], 1.4, 0.6); novaBurst(a, p, 0.55);
      ring(gp, E.c[0], 2.6, 0.75, T); ring(gp, E.c[2], 1.5, 0.45, T + 0.03); ring(gp, E.c[1], 3.6, 1.0, T + 0.08);
      decal(gp, tex().ice(), 2.8, 2.8, E.c[2], E.c[1], T); glow(hipsAt(a, 0.35).clone(), E.c[2], 4.2, 0.4, T); glow(hipsAt(a, 0.6).clone(), E.c[0], 7, 0.7, T);
      pillar(gp, E.c[0], 0.5, 5.5, 0.7, T, 0.1); shake(0.1, T); flash(1.7, 0.35, T); label(E, gp, T + 0.2); crystals(a, T, 3.0);
      at(T, () => { const Q = P(); for (let i = 0; i < 26; i++) { const an = Math.random() * TAU, sp = rnd(1.2, 3.5); EM(Q, _a.set(gp.x, gp.y + 0.1, gp.z), Math.cos(an) * sp, rnd(2, 4.5), Math.sin(an) * sp, 0xc8d4e0, rnd(0.03, 0.05), rnd(0.6, 1.1), { g: -10, drag: 0.6, sq: 1, so: 0.9 }); } burst(_c.set(gp.x, gp.y + 0.1, gp.z), E, 50, 5, { g: -6 }); });
    },
    tick(a, r, t, dt) {
      const Q = P(), E = a.E;
      if (t > 0.55 && t < 1.05) { hipsW(r, _a); const n = Math.ceil(dt * 260); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.18, 0.18), _a.y + rnd(0, 1.4), _a.z + rnd(-0.18, 0.18)), 0, rnd(1, 3), 0, i % 3 ? E.c[0] : E.c[2], rnd(0.06, 0.14), rnd(0.18, 0.4), { grow: -0.6, so: 0.25 }); }
      else if (t > 1.05 && t < 2.9 && Math.random() < dt * 30) { const an = Math.random() * TAU, rr = rnd(0.2, 1.1); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), 0, rnd(0.4, 1.1), 0, pk(E), rnd(0.025, 0.045), rnd(0.8, 1.4), { so: 0.4 }); }
    } };
  MOT.novaOut = { kind: 'out', dur: 2.6, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.85, 'charge', 0.45], [0.98, 'jump', 0.1]],
    body(t, B) { if (t > 0.92) { const u = t - 0.92; B.y = u * u * 55 + u * 6; B.sy = 1 + Math.min(0.8, u * 4); B.sx = B.sz = 1 / Math.sqrt(B.sy); B.vis = B.y < 3.4; } },
    fx(a) {
      const E = a.E, gp = a.gp; sigil(gp, tex().ring(), 1.8, 1.0, E.c[0], 2, 0.2, -0.4, 0.2); ring(gp, E.c[0], 2.4, 0.6, 0.95); ring(gp, E.c[2], 1.3, 0.4, 0.95); glow(hipsAt(a, 0.4).clone(), E.c[2], 3.4, 0.4, 0.95); pillar(gp, E.c[0], 0.42, 9, 1.1, 0.95, 0.15); shake(0.05, 0.95); flash(1.35, 0.3, 0.95);
      const gl = new THREE.Sprite(kit().sprMat(E.c[2])); gl.renderOrder = 7; add(gl, 0.65, (e, u) => { chestW(a.rig, gl.position); gl.position.x += Math.sin(a.yaw) * 0.18; gl.position.z += Math.cos(a.yaw) * 0.18; gl.scale.setScalar(0.2 + u * 0.9); gl.material.opacity = 0.5 + u * 0.5; }, 0.3);   // 가슴에 모이는 빛
      novaBurst(a, loc(a, 0, 2.7, -0.3, new THREE.Vector3()), 1.2, 0.75);
    },
    tick(a, r, t, dt) {
      const Q = P(), E = a.E;
      if (t > 0.3 && t < 0.95) { const n = Math.ceil(dt * 90); hipsW(r, _a); for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.6, 1.1); _b.set(_a.x + Math.cos(an) * rr, _a.y + rnd(-0.6, 0.8), _a.z + Math.sin(an) * rr); EM(Q, _b, (_a.x - _b.x) * 3, (_a.y - _b.y) * 3, (_a.z - _b.z) * 3, pk(E), rnd(0.025, 0.045), 0.3, { so: 0.3 }); } }
      if (t > 0.95 && t < 1.5) { hipsW(r, _a); const n = Math.ceil(dt * 220); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.15, 0.15), _a.y + rnd(-1.2, 0.2), _a.z + rnd(-0.15, 0.15)), 0, rnd(-3, -1), 0, i % 3 ? E.c[0] : E.c[2], rnd(0.06, 0.13), rnd(0.2, 0.4), { grow: -0.6, so: 0.25 }); }
    } };
  // ===== 제니스: 정점의 혼천의 — 세 겹 고리가 서로 다른 축으로 돌며 몸을 감싼 채 하늘에서 내려오고, 착지하면 고리가 머리 위로 올라가 별 왕관이 됨 → 승리의 주먹
  //        퇴장: 별 왕관이 다시 혼천의로 펼쳐져 점점 빠르게 돌고, 그 속에서 작아져 별이 되어 하늘로 솟음
  const RAX = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 1, 0).normalize()], RSP = [1.7, -2.2, 2.8];
  // k(t): 0 = 몸을 감싼 혼천의 · 1 = 머리 위 별 왕관 / sp(t): 도는 빠르기 배율 / op(t): 투명도
  function armillary(a, t0, dur, k, sp, op) {
    const E = a.E, g = new THREE.Group(), R = [[0.82, E.c[0]], [0.72, E.c[1]], [0.62, E.c[2]]].map(([rr, c]) => lit(new THREE.TorusGeometry(rr, 0.034, 8, 56), c, g, 0, 0, 0, 0.95));
    const stars = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(kit().vplane(), mat(tex().star5(), E.c[0])); s.renderOrder = 8; g.add(s); stars.push(s); }
    const q = new THREE.Quaternion(), ang = [0, 1, 2];
    add(g, dur, (e) => { const t = t0 + e.t, kk = k(t), o = op(t), r = a.rig;
      r.chest.getWorldPosition(_a); r.head.getWorldPosition(_b); _b.y += 0.3; g.position.copy(_a).lerp(_b, kk);
      R.forEach((m, i) => { ang[i] += e.dt * RSP[i] * sp(t); q.setFromAxisAngle(RAX[i], ang[i]); m.quaternion.copy(q).slerp(FLATQ, kk); m.scale.setScalar(lerp(1, 0.26 + i * 0.02, kk)); m.position.y = kk * i * 0.035; m.material.opacity = 0.95 * o; });
      stars.forEach((s, i) => { const an = i / 5 * TAU + e.t * 0.8, v = sstep(0.85, 1, kk); s.position.set(Math.cos(an) * 0.21, 0.07, Math.sin(an) * 0.21); if (CAM) s.quaternion.copy(CAM.quaternion); s.scale.setScalar(0.1 * v + 0.001); s.material.opacity = v * o; });
    }, t0);
  }
  MOT.armillary = { kind: 'in', dur: 4.5, keys: [[0, 'float'], [1.35, 'float'], [1.5, 'land', 0.12], [1.95, 'land'], [2.45, 'rise', 0.45], [2.7, 'victory', 0.25], [3.7, 'victory']],
    body(t, B) { B.vis = t > 0.12; if (t < 1.5) B.y = 4.4 * (1 - eout(seg(t, 0.12, 1.5))); },
    fx(a) {
      const E = a.E, gp = a.gp, sky = loc(a, 0, 2.6, -0.8, new THREE.Vector3());
      card(sky, tex().star4(), E.c[0], 1.3, (m, u) => { m.scale.setScalar(3.2 * (0.25 + 0.75 * Math.sqrt(u))); m.rotateZ(u * 1.6); m.material.opacity = Math.min(1, u * 6) * (1 - u); });
      glow(sky, E.c[2], 4, 0.9); envFx(1.8, (u) => { const v = 1 + 0.3 * Math.sin(Math.PI * u); return [v, v]; });
      sigil(gp, sigilTex(), 3.4, 4.0, E.c[0], 0.5, 0.05); sigil(gp, sigilTex(), 2.1, 3.8, E.c[1], -1.1, 0.25); pillar(gp, dim(E.c[2], 0.4), 0.55, 7, 1.5, 0.12, 0.6);
      ring(gp, E.c[0], 3.1, 0.8, 1.5); ring(gp, E.c[1], 2.2, 0.6, 1.54); ring(gp, E.c[2], 4.2, 1.1, 1.6); glow(hipsAt(a, 0.5).clone(), E.c[2], 5, 0.45, 1.5); shake(0.1, 1.5); flash(1.7, 0.4, 1.5); label(E, gp, 1.7);
      at(1.5, () => burst(hipsAt(a, 0.4), E, 80, 6, { g: -4 }));
      armillary(a, 0.12, 3.6, (t) => sstep(1.55, 2.15, t), (t) => 1 - sstep(1.6, 2.2, t) * 0.75, (t) => 1 - sstep(3.3, 3.72, t));
      at(2.8, () => { hand0(a, _c); glow(_c, E.c[2], 2.4, 0.4); card(_c.clone(), tex().star4(), E.c[0], 0.6, (m, u) => { m.scale.setScalar(1.6 * Math.sqrt(u) + 0.01); m.rotateZ(u * 2); m.material.opacity = 1 - u; }); burst(_c, E, 40, 3, { g: -2.5 }); });
    },
    tick(a, r, t, dt) { if (t > 2.75 && t < 3.6 && Math.random() < dt * 40) { hand0(a, _c); EM(P(), _c, rnd(-0.4, 0.4), rnd(0.3, 1.2), rnd(-0.4, 0.4), pk(a.E), rnd(0.025, 0.05), rnd(0.5, 0.9), { g: -1, so: 0.5 }); } } };
  MOT.ascendStar = { kind: 'out', dur: 3.1, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.8, 'reach', 0.45], [1.3, 'float', 0.4]],
    body(t, B) { if (t > 1.0) { const u = seg(t, 1.0, 2.05); B.y = 1.3 * ein(u); B.s = Math.max(0.01, 1 - sstep(0.45, 1, u)); B.ry = ein(u) * 6; B.vis = B.s > 0.02; } },
    fx(a) {
      const E = a.E, gp = a.gp, st = new THREE.Vector3(); sigil(gp, sigilTex(), 3.0, 2.6, E.c[0], 0.6, 0.3); sigil(gp, sigilTex(), 1.9, 2.4, E.c[1], -1.2, 0.45);
      armillary(a, 0.3, 1.8, (t) => 1 - sstep(0.45, 0.95, t), (t) => 1 + sstep(0.9, 2.0, t) * 5, (t) => sstep(0.3, 0.45, t) * (1 - sstep(1.95, 2.08, t)));
      at(2.05, () => { hipsW(a.rig, st); st.y += 0.3; glow(st, E.c[2], 3.4, 0.5); flash(1.4, 0.3); burst(st, E, 50, 3.5, { g: -1 });
        card(st.clone(), tex().star4(), 0xffffff, 0.75, (m, u) => { m.position.y = st.y + ein(u) * 4; m.scale.setScalar(0.9 - u * 0.4); m.rotateZ(0.2); m.material.opacity = 1 - u * 0.3; }); beam(st.clone(), st.clone().add(_a.set(0, 4.5, 0)), E.c[0], 0.35, 0.6, 0.12); });
    },
    tick(a, r, t, dt) { if (t < 1.0 || t > 2.1) return; hipsW(r, _a); const n = Math.ceil(dt * 120); for (let i = 0; i < n; i++) { const an = t * 12 + i * 2.4; EM(P(), _b.set(_a.x + Math.cos(an) * 0.5, _a.y + rnd(-0.6, 0.6), _a.z + Math.sin(an) * 0.5), 0, 0.8, 0, pk(a.E), rnd(0.03, 0.06), rnd(0.4, 0.7), { so: 0.45 }); } } };
  // ===== 셀레스티얼: 금빛 빛기둥 속으로 커다란 날개를 펴고 천천히 날갯짓하며 내려와 사뿐히 · 날개를 접자 깃털로 흩어짐 · 머리 위 광륜 · 두 손을 펴 축복
  //        퇴장: 광륜이 뜨고 등에서 날개가 펼쳐져 크게 날갯짓하며 빛기둥을 따라 날아오름 · 깃털이 흩날림
  const featherTex = () => ctex('feath', 64, 256, (g, W, H) => {
    const gr = g.createLinearGradient(0, H, 0, 0); gr.addColorStop(0, 'rgba(255,226,150,1)'); gr.addColorStop(0.35, 'rgba(255,250,236,1)'); gr.addColorStop(1, 'rgba(255,255,255,0.92)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(W / 2, H); g.quadraticCurveTo(-W * 0.1, H * 0.5, W / 2, 0); g.quadraticCurveTo(W * 1.1, H * 0.5, W / 2, H); g.fill();
    g.strokeStyle = 'rgba(205,165,80,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 8); g.stroke();
    g.strokeStyle = 'rgba(200,180,130,0.35)'; g.lineWidth = 1; for (let y = 22; y < H - 12; y += 7) { g.beginPath(); g.moveTo(W / 2, y + 7); g.lineTo(W * 0.16, y); g.moveTo(W / 2, y + 7); g.lineTo(W * 0.84, y); g.stroke(); }
  });
  // 날개 한 쌍 (가슴 뼈를 따라감): spread(t) 0 = 접힘 · 1 = 활짝 / flap(t) 날갯짓(−1~1) / op(t) 투명도
  function wings(a, t0, dur, spread, flap, op) {
    const root = new THREE.Group(), fg = new THREE.PlaneGeometry(1, 1); fg.translate(0, 0.5, 0);
    const fm = new THREE.MeshBasicMaterial({ map: featherTex(), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, color: 0xfff7e6 });
    const W = [1, -1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.09, 0.14, -0.16); w.scale.x = s; root.add(w); const F = [];
      for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(fg, fm); f.userData.own = true; f.scale.set(0.16, 0.55 + 0.62 * (i / 8), 1); f.renderOrder = 5; f.position.z = -0.004 * i; w.add(f); F.push([f, i / 8, 0]); }
      for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(fg, fm); f.userData.own = true; f.scale.set(0.13, 0.3 + 0.22 * (i / 6), 1); f.renderOrder = 6; f.position.z = 0.012; w.add(f); F.push([f, i / 6, 1]); }
      return { w, F, s }; });
    add(root, dur, (e) => { const t = t0 + e.t, k = spread(t), fl = flap(t), r = a.rig;
      r.chest.matrixWorld.decompose(root.position, root.quaternion, root.scale); fm.opacity = op(t);
      for (const { w, F, s } of W) { w.rotation.set(0.12 + fl * 0.22, s * (0.35 - fl * 0.85 + (1 - k) * 0.5), 0); for (const [f, v, row] of F) f.rotation.z = -lerp(lerp(2.75, 3.0, v), lerp(0.12, row ? 1.5 : 1.8, v), k) + row * 0.08; }
    }, t0);
  }
  function crownHalo(a, t0, dur, op) { const E = a.E, m = lit(new THREE.TorusGeometry(0.17, 0.014, 6, 40), E.c[0], null); m.quaternion.copy(FLATQ); add(m, dur, (e) => { const t = t0 + e.t; a.rig.head.getWorldPosition(m.position); m.position.y += 0.3 + Math.sin(t * 2) * 0.012; m.material.opacity = op(t); }, t0); }
  function featherFall(a, n, t0, spread) { at(t0, () => { chestW(a.rig, _c); const c0 = _c.clone(); for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-0.6, 0.6), rnd(0.2, 1.0), rnd(-0.4, 0.4)), ph = Math.random() * TAU;
    card(c0.clone().add(_a.set(rnd(-spread, spread), rnd(-0.3, 0.5), rnd(-0.3, 0.2))), featherTex(), 0xfff2d8, rnd(1.6, 2.6), (m, u, e) => { v.y = Math.max(-0.45, v.y - e.dt * 1.5); v.multiplyScalar(1 - e.dt * 0.8); m.position.addScaledVector(v, e.dt); m.position.x += Math.sin(e.t * 3 + ph) * 0.006; m.scale.set(0.07, 0.24, 1); m.rotateZ(Math.sin(e.t * 2.5 + ph) * 0.9 + ph); m.material.opacity = u < 0.7 ? 1 : (1 - u) / 0.3; }, 0, true); } }); }
  MOT.wingsIn = { kind: 'in', dur: 4.5, keys: [[0, 'float'], [2.0, 'float'], [2.35, 'stand', 0.35], [2.6, 'stand'], [3.0, 'open', 0.4], [3.75, 'open']],
    body(t, B) { if (t < 2.25) { const u = seg(t, 0, 2.25); B.y = 3.4 * (1 - eout(u)) * (1 - eout(u)) + Math.sin(t * 2.6) * 0.06 * (1 - u); } },
    fx(a) {
      const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.42), 0.85, 9, 3.4, 0, 0.55); envFx(4.2, (u) => { const v = 1 + 0.18 * Math.sin(Math.PI * u); return [v, 1 + 0.12 * Math.sin(Math.PI * u)]; });
      ring(gp, E.c[0], 2.0, 1.0, 2.25); sigil(gp, sigilTex(), 2.8, 2.2, E.c[0], 0.25, 2.2); glow(hipsAt(a, 0.3).clone(), E.c[2], 2.6, 0.6, 2.25); label(E, gp, 2.35);
      wings(a, 0, 2.95, (t) => 1 - sstep(2.35, 2.75, t) * 0.9, (t) => (t < 2.3 ? Math.sin(t * 2.6) : 0), (t) => 1 - sstep(2.8, 2.92, t));
      crownHalo(a, 0, 3.5, (t) => sstep(0, 0.3, t) * (1 - sstep(3.1, 3.5, t))); featherFall(a, 18, 2.85, 0.8);
      at(3.05, () => { const Q = P(); for (const s of [-1, 1]) { hand0(a, _c, s); for (let i = 0; i < 18; i++) EM(Q, _c, rnd(-0.3, 0.3), rnd(0.4, 1.3), rnd(-0.3, 0.3), pk(E), rnd(0.025, 0.05), rnd(0.7, 1.3), { drag: 0.8, so: 0.45 }); } });
    },
    tick(a, r, t, dt) { const Q = P(), E = a.E;
      if (t < 3.4 && Math.random() < dt * 22) { const an = Math.random() * TAU, rr = rnd(0.2, 1.1); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(1.6, 3.2), a.gp.z + Math.sin(an) * rr), rnd(-0.25, 0.25), rnd(-0.55, -0.3), rnd(-0.25, 0.25), pk(E), rnd(0.035, 0.06), rnd(2, 3), { sq: 1, so: 0.65 }); }
      if (t < 2.2) { hipsW(r, _a); if (Math.random() < dt * 40) EM(Q, _b.set(_a.x + rnd(-0.3, 0.3), _a.y + rnd(-0.9, 0.9), _a.z + rnd(-0.3, 0.3)), 0, 0.15, 0, E.c[2], rnd(0.03, 0.05), 0.8, { so: 0.3 }); } } };
  MOT.wingsOut = { kind: 'out', dur: 3.3, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.85, 'reach', 0.5], [1.4, 'reach'], [1.9, 'float', 0.5]],
    body(t, B) { if (t > 1.1) { const u = seg(t, 1.1, 2.9); B.y = 3.6 * ein(u) + Math.max(0, Math.sin((t - 0.9) * 7)) * 0.05; B.s = 1 - sstep(0.7, 1, u) * 0.98; B.vis = B.s > 0.03; } },
    fx(a) {
      const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 2.8, 3.0, E.c[0], 0.3, 0.2); pillar(gp, dim(E.c[0], 0.42), 0.8, 9, 3.0, 0.4, 0.6);
      wings(a, 0.3, 2.75, (t) => sstep(0.3, 0.9, t), (t) => (t > 0.9 ? Math.sin((t - 0.9) * 7) * 1.1 : 0), (t) => 1 - sstep(2.7, 3.0, t));
      crownHalo(a, 0.3, 2.75, (t) => sstep(0.3, 0.55, t) * (1 - sstep(2.7, 3.0, t))); ring(gp, E.c[0], 2.2, 0.6, 1.0); featherFall(a, 10, 1.05, 0.9);
      at(2.75, () => { const Q = P(); _c.set(gp.x, gp.y + 3.4, gp.z); glow(_c, E.c[2], 3.4, 0.6); for (let i = 0; i < 50; i++) { _a.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 3)); EM(Q, _c, _a.x, _a.y, _a.z, pk(E), rnd(0.03, 0.06), rnd(0.8, 1.4), { drag: 1.2, so: 0.5 }); } });
    },
    tick(a, r, t, dt) { const Q = P(), E = a.E; if (Math.random() < dt * 24) { const an = Math.random() * TAU, rr = rnd(0.2, 1.0); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(1.5, 3), a.gp.z + Math.sin(an) * rr), rnd(-0.2, 0.2), rnd(-0.5, -0.3), rnd(-0.2, 0.2), pk(E), rnd(0.035, 0.055), rnd(1.8, 2.6), { sq: 1, so: 0.65 }); }
      if (t > 1.1 && t < 2.9) { hipsW(r, _a); const n = Math.ceil(dt * 70); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.3, 0.3), _a.y + rnd(-0.9, 0.5), _a.z + rnd(-0.3, 0.3)), 0, -0.6, 0, pk(E), rnd(0.03, 0.05), rnd(0.5, 0.9), { so: 0.4 }); } } };
  // ===== 이클립스: 하늘의 해 위로 검은 달이 미끄러져 개기일식 — 세상이 붉게 어두워지고 땅의 그림자에서 팔짱 낀 채 솟아오름 → 달이 비켜나는 순간 '다이아몬드 링' 섬광과 함께 두 팔을 내뻗음
  //        퇴장: 다시 일식이 시작되어 어두워지고 팔짱 낀 채 그림자 속으로 가라앉음 → 다이아몬드 링이 번쩍이면 빈자리
  function eclipseSky(a, tIn, tTot, tDia, tEnd) {
    const E = a.E, p = loc(a, -0.3, 2.5, -2.6, new THREE.Vector3()), R = new THREE.Vector3(), cov = (t) => sstep(tIn, tTot, t) * (1 - sstep(tDia, tDia + 0.45, t)), show = (t) => sstep(0, 0.3, t) * (1 - sstep(tEnd - 0.4, tEnd, t));
    const sun = new THREE.Sprite(kit().sprMat(0xfff4c8)); sun.renderOrder = 6; sun.position.copy(p);
    add(sun, tEnd, (e) => { const v = show(e.t); sun.scale.setScalar(1.6 * v + 0.01); sun.material.opacity = v * (1 - cov(e.t) * 0.85); });
    card(p.clone(), tex().star4(), 0xffe6a0, tEnd, (m, u, e) => { const v = show(e.t) * (1 - cov(e.t)); m.scale.setScalar(2.3 * v + 0.01); m.rotateZ(e.t * 0.2); m.material.opacity = v; });
    card(p.clone(), coronaTex(), E.c[0], tEnd, (m, u, e) => { const k = sstep(tTot - 0.15, tTot + 0.1, e.t) * (1 - sstep(tDia, tDia + 0.3, e.t)); m.scale.setScalar(2.9 * k + 0.01); m.rotateZ(e.t * 0.25); m.material.opacity = k; });
    const moon = card(p.clone(), discTex(), 0x050002, tEnd, (m, u, e) => { const t = e.t; R.set(1, 0, 0).applyQuaternion(CAM.quaternion); const off = t < tDia ? 1.4 * (1 - eout(seg(t, tIn, tTot))) : -1.4 * ein(seg(t, tDia, tDia + 0.9)); m.position.copy(p).addScaledVector(R, off); m.scale.setScalar(1.25); m.material.opacity = sstep(tIn - 0.15, tIn + 0.1, t) * (1 - sstep(tEnd - 0.4, tEnd, t)); }, 0, true); moon.renderOrder = 9;
    at(tDia, () => { R.set(1, 0, 0).applyQuaternion(CAM.quaternion); const d = p.clone().addScaledVector(R, -0.5); glow(d, 0xffffff, 2, 0.5); card(d, tex().star4(), 0xffffff, 0.8, (m, u) => { m.scale.setScalar(2.4 * (1 - u) + 0.01); m.rotateZ(u * 1.2); m.material.opacity = 1 - u; }); flash(1.7, 0.35); });
    envFx(tEnd, (u) => { const k = cov(u * tEnd); return [1 - 0.62 * k, 1 - 0.55 * k]; });
  }
  const portal = (a, size, dur, delay = 0) => { const E = a.E, gp = a.gp;
    const d = flat(discTex(), 0x0a0003, gp, 0.02); d.material.blending = THREE.NormalBlending; d.renderOrder = 2;
    add(d, dur, (e, u) => { const k = sstep(0, 0.15, u) * (1 - sstep(0.85, 1, u)); d.scale.setScalar(size * 0.75 * k + 0.01); d.material.opacity = 0.92 * k; }, delay);
    const s = flat(tex().swirl(), E.c[0], gp, 0.04); add(s, dur, (e, u) => { const k = sstep(0, 0.15, u) * (1 - sstep(0.85, 1, u)); s.scale.setScalar(size * k + 0.01); s.rotation.y = -e.t * 2.4; s.material.opacity = k; }, delay); };
  MOT.eclipse = { kind: 'in', dur: 4.5, keys: [[0, 'cross'], [2.35, 'cross'], [2.55, 'burst', 0.16], [3.5, 'burst']],
    body(t, B) { const u = seg(t, 0.95, 2.35); B.y = -2.05 * (1 - eout(u)); B.vis = t > 0.85; },
    fx(a) { const E = a.E, gp = a.gp; eclipseSky(a, 0.15, 1.1, 2.55, 4.3); portal(a, 2.4, 2.4, 0.6);
      ring(gp, E.c[0], 2.8, 0.7, 2.55); ring(gp, E.c[2], 1.6, 0.45, 2.57); glow(hipsAt(a, 0.6).clone(), E.c[0], 4.6, 0.5, 2.55); shake(0.07, 2.55); label(E, gp, 2.6);
      at(2.55, () => { const Q = P(); for (let i = 0; i < 60; i++) { const an = Math.random() * TAU, sp = rnd(2, 5); EM(Q, hipsAt(a, rnd(0.2, 1.2)), Math.cos(an) * sp, rnd(-0.3, 1.2), Math.sin(an) * sp, pk(E), rnd(0.035, 0.07), rnd(0.4, 0.9), { drag: 2, so: 0.6 }); } }); },
    tick(a, r, t, dt) { if (t < 0.6 || t > 2.75) return; const Q = P(), E = a.E, n = Math.ceil(dt * 60);
      for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.05, 0.9); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), rnd(-0.1, 0.1), rnd(1.2, 3.2), rnd(-0.1, 0.1), pk(E), rnd(0.03, 0.06), rnd(0.4, 0.9), { drag: 0.6, so: 0.5 }); }
      if (Math.random() < dt * 14) EM(Q, _b.set(a.gp.x + rnd(-0.5, 0.5), a.gp.y + 0.1, a.gp.z + rnd(-0.5, 0.5)), 0, rnd(0.5, 1), 0, 0x1a0408, rnd(0.25, 0.4), rnd(0.9, 1.4), { grow: 1.4, so: 1, a: 0.6 }); } };
  MOT.umbra = { kind: 'out', dur: 3.4, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'cross', 0.4]],
    body(t, B) { const u = seg(t, 1.0, 2.4); B.y = -2.1 * ein(u); B.vis = u < 0.98; },
    fx(a) { const E = a.E, gp = a.gp; eclipseSky(a, 0.1, 1.2, 2.6, 3.35); portal(a, 2.4, 2.2, 0.75); ring(gp, E.c[0], 2.4, 0.6, 2.6); glow(hipsAt(a, 0.2).clone(), E.c[0], 3.2, 0.5, 2.5); },
    tick: (a, r, t, dt) => MOT.eclipse.tick(a, r, t * 0.95 + 0.1, dt) };
  // ===== 랭크 챔피언: 시상식 — 양쪽에서 조명이 쓸고 와 모이고, 금빛 '1' 시상대가 바닥에서 솟아 캐릭터를 들어 올림 → 하늘에서 내려온 트로피를 받아 머리 위로 번쩍 · 색종이 대포 → 트로피는 금빛으로 흩어지고 시상대는 내려감 · 손 흔들기
  //        퇴장: 커튼콜 — 조명 아래 깊이 인사하고 손을 흔들면 붉은 벨벳 커튼이 닫혔다가 다시 열리면 빈자리 · 색종이
  const podTex = () => ctex('pod1', 256, 160, (g, W, H) => {
    g.strokeStyle = '#e9c25a'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#e9c25a'; for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const a = -0.95 + i * 0.25, x = W / 2 + s * Math.cos(a) * 66, y = 86 + Math.sin(a) * 58; g.save(); g.translate(x, y); g.rotate(a + s * 0.6); g.beginPath(); g.ellipse(0, 0, 10, 4.5, 0, 0, TAU); g.fill(); g.restore(); }
    g.font = 'bold 112px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const gr = g.createLinearGradient(0, 24, 0, 140); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.5, '#ffd34d'); gr.addColorStop(1, '#a66a08'); g.fillStyle = gr; g.fillText('1', W / 2, 86);
  });
  const curtainTex = () => ctex('curt', 128, 256, (g, W, H) => {
    for (let x = 0; x < W; x++) { const f = 0.5 + 0.5 * Math.sin(x / W * Math.PI * 7); g.fillStyle = `rgb(${Math.round(110 + 80 * f)},${Math.round(8 + 14 * f)},${Math.round(18 + 18 * f)})`; g.fillRect(x, 0, 1, H); }
    const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.15, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d9a83a'; g.fillRect(0, H - 16, W, 6); for (let x = 2; x < W; x += 6) g.fillRect(x, H - 10, 2, 10);
  });
  const beamTex = () => ctex('beam', 32, 128, (g, W, H) => { const r = g.createLinearGradient(0, 0, 0, H); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0.18)'); g.fillStyle = r; g.fillRect(0, 0, W, H); });
  // 무대 조명: 위쪽 옆(side ±1)에서 바깥을 비추다가 가운데로 쓸고 옴
  function spotlight(a, side, t0, dur, col) {
    const L = 5.4, geo = new THREE.CylinderGeometry(0.05, 0.62, L, 18, 1, true); geo.translate(0, -L / 2, 0);
    const m = new THREE.Mesh(geo, mat(beamTex(), col)); m.userData.own = true; m.renderOrder = 4;
    const S = loc(a, side * 2.2, 4.3, 0.7, new THREE.Vector3()), T0 = loc(a, side * 2.4, 0, 1.3, new THREE.Vector3()), T1 = loc(a, 0, 0.3, 0, new THREE.Vector3()), T = new THREE.Vector3(), D = new THREE.Vector3(), DN = new THREE.Vector3(0, -1, 0);
    m.position.copy(S);
    add(m, dur, (e, u) => { T.copy(T0).lerp(T1, side ? eout(seg(e.t, 0, 0.55)) : 1); D.subVectors(T, S).normalize(); m.quaternion.setFromUnitVectors(DN, D); m.material.opacity = 0.15 * Math.min(1, e.t * 4) * (1 - sstep(0.85, 1, u)); }, t0);
  }
  const podY = (t, up, dn) => (t < dn[0] ? -0.56 * (1 - eout(seg(t, up[0], up[1]))) : -0.56 * ein(seg(t, dn[0], dn[1])));
  function podium(a, up, dn, dur) {
    const g = grpAt(a);
    solid(new THREE.BoxGeometry(1.15, 0.5, 0.9), 0x6a1420, g, 0, 0.25, -0.05); solid(new THREE.BoxGeometry(1.2, 0.05, 0.95), 0xd8a43a, g, 0, 0.5, -0.05); solid(new THREE.BoxGeometry(1.2, 0.05, 0.95), 0xd8a43a, g, 0, 0.025, -0.05);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.4), new THREE.MeshBasicMaterial({ map: podTex(), transparent: true, side: THREE.DoubleSide, fog: false })); f.userData.own = true; f.position.set(0, 0.26, 0.405); g.add(f);
    add(g, dur, (e) => { g.position.y = a.gp.y + podY(e.t, up, dn); });
    for (const tt of [up[0], dn[0]]) at(tt, () => { const Q = P(); for (let i = 0; i < 24; i++) { const an = Math.random() * TAU; loc(a, Math.cos(an) * 0.7, 0.05, Math.sin(an) * 0.6, _c); EM(Q, _c, Math.cos(an) * rnd(0.3, 1), rnd(0.3, 1), Math.sin(an) * rnd(0.3, 1), 0xbfb5a0, rnd(0.15, 0.3), rnd(0.6, 1.1), { grow: 1.2, so: 1, a: 0.45, drag: 1 }); } });
  }
  // 트로피: tIn 에 하늘에서 내려와 두 손 사이로 · tOut 에 금빛으로 흩어짐
  function trophy(a, tIn, tOut) {
    const E = a.E, g = new THREE.Group(), GOLD = 0xe2b443, mid = new THREE.Vector3(), sky = loc(a, 0, 3.4, 0.1, new THREE.Vector3());
    const prof = [[0, 0], [0.085, 0], [0.085, 0.018], [0.03, 0.035], [0.022, 0.11], [0.05, 0.13], [0.105, 0.19], [0.125, 0.29], [0.13, 0.34], [0.115, 0.34], [0.11, 0.3], [0.09, 0.2], [0.02, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
    solid(new THREE.LatheGeometry(prof, 18), GOLD, g, 0, -0.2, 0);
    for (const s of [-1, 1]) { const h = solid(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), GOLD, g, s * 0.12, 0.0, 0); h.rotation.z = -s * Math.PI / 2; }
    const gl = new THREE.Sprite(kit().sprMat(E.c[0])); gl.renderOrder = 7; g.add(gl); gl.position.y = 0.02;
    add(g, tOut + 0.25 - tIn, (e) => { const t = tIn + e.t, r = a.rig; r.armL.hand.getWorldPosition(_a); r.armR.hand.getWorldPosition(_b); mid.addVectors(_a, _b).multiplyScalar(0.5); mid.y -= 0.02;
      const k = eout(seg(t, tIn, tIn + 0.4)); g.position.copy(sky).lerp(mid, k); g.rotation.set(0, a.yaw + (1 - k) * 6, 0);
      const s = t < tOut ? 1 : Math.max(0.001, 1 - seg(t, tOut, tOut + 0.2)); g.scale.setScalar(s); gl.scale.setScalar(0.5 + Math.sin(t * 6) * 0.08); gl.material.opacity = 0.55 * s; }, tIn);
    at(tIn + 0.4, () => glow(mid, 0xffffff, 1.4, 0.3)); at(tOut, () => burst(mid, E, 44, 2.4, { g: -1.5 }));
  }
  function confetti(a, s) {
    const Q = P(), gp = a.gp, E = a.E; loc(a, s * 1.1, 0.2, 0.15, _c); glow(_c.clone(), E.c[2], 1.2, 0.25);
    for (let i = 0; i < 55; i++) EM(Q, _c, -s * rnd(0.6, 2.4) * Math.cos(a.yaw), rnd(3.5, 6.5), rnd(-0.8, 0.8), pk(E), rnd(0.035, 0.06), rnd(1.4, 2.4), { g: -3.2, drag: 1.3, sq: 1, so: 0.9 });
  }
  MOT.ceremony = { kind: 'in', dur: 4.7, keys: [[0, 'att'], [0.85, 'att'], [1.15, 'trophyHold', 0.3], [1.35, 'trophyHold'], [1.65, 'trophyUp', 0.3], [2.75, 'trophyUp'], [3.0, 'trophyHold', 0.25], [3.3, 'wave', 0.3], [4.0, 'wave']],
    body(t, B) { B.y = Math.max(0, podY(t, [0.05, 0.6], [3.2, 3.7]) + 0.525); },
    fx(a) { const E = a.E, gp = a.gp; spotlight(a, 1, 0, 4.3, 0xfff1c0); spotlight(a, -1, 0.1, 4.2, 0xfff1c0); podium(a, [0.05, 0.6], [3.2, 3.7], 3.8); trophy(a, 0.75, 2.95);
      ring(gp, E.c[0], 2.4, 0.7, 0.6); label(E, gp, 0.9); flash(1.35, 0.3, 1.7);
      for (const [tt, s] of [[1.7, -1], [1.82, 1], [2.3, -1], [2.42, 1]]) at(tt, () => confetti(a, s)); },
    tick(a, r, t, dt) { if (t > 1.6 && t < 3.2 && Math.random() < dt * 30) { const an = Math.random() * TAU, rr = rnd(0.1, 0.8); EM(P(), _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(2.0, 2.8), a.gp.z + Math.sin(an) * rr), 0, -0.4, 0, a.E.c[2], rnd(0.02, 0.04), rnd(1.2, 2), { so: 0.5 }); } } };
  // 커튼: tc 에 닫히고 to 에 다시 열림 (불투명 — 뒤의 캐릭터를 가림)
  function curtains(a, t0, tc, to, tEnd) {
    const g = grpAt(a), geo = new THREE.PlaneGeometry(0.82, 2.5); geo.translate(0, 1.25, 0);
    const mk = () => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: curtainTex(), side: THREE.DoubleSide, fog: false })); m.userData.own = true; g.add(m); return m; };
    const C = [[mk(), 1], [mk(), -1]], rod = solid(new THREE.BoxGeometry(1.75, 0.06, 0.06), 0xd8a43a, g, 0, 2.53, 0.48);
    add(g, tEnd - t0, (e) => { const t = t0 + e.t, c = t < to ? eout(seg(t, tc - 0.45, tc)) : 1 - eout(seg(t, to, to + 0.45)), drop = sstep(t0, t0 + 0.35, t) * (1 - sstep(tEnd - 0.35, tEnd, t));
      // 열림 = 바깥 끝에 주름을 잡아 모음(옆 사람을 가리지 않게) · 닫힘 = 가운데서 맞닿음
      for (const [m, s] of C) { m.position.set(s * lerp(0.66, 0.4, c), (1 - drop) * 2.6, 0.48); m.rotation.y = Math.sin(t * 3 + s) * 0.05 * (1 - c * 0.5); m.scale.set(lerp(0.36, 1, c), Math.max(0.01, drop), 1); }
      rod.position.y = 2.53 + (1 - drop) * 0.6; }, t0);
  }
  MOT.curtain = { kind: 'out', dur: 3.6, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.75, 'bowSweep', 0.4], [1.3, 'bowSweep'], [1.6, 'wave', 0.3], [2.25, 'wave']],
    body(t, B) { B.vis = t < 2.3; },
    fx(a) { const E = a.E, gp = a.gp; spotlight(a, 0, 0, 2.4, 0xfff1c0); curtains(a, 0.15, 2.3, 2.62, 3.55); ring(gp, E.c[0], 2.0, 0.6, 2.65);
      at(2.65, () => { confetti(a, -1); confetti(a, 1); burst(hipsAt(a, 0.9), E, 40, 2.6, { g: -2, sq: 1, so: 0.85 }); }); } };
  // ===== 정점의 베테랑: 연막탄이 날아와 구르고 은빛 연기가 피어오르면, 그 속에서 걸어 나와 차렷 → 경례 · 가슴에 훈장이 하나씩 빛남
  //        퇴장: 마지막 경례 후 발밑에 연막탄을 떨어뜨리고, 연기 속에서 돌아서 걸어가 사라짐 → 연기가 걷히면 군번줄만 반짝
  function smokeCan(a, from, to, t0, t1, tEnd) {
    const g = new THREE.Group(); solid(new THREE.CylinderGeometry(0.034, 0.034, 0.13, 10), 0x5b6450, g); solid(new THREE.CylinderGeometry(0.02, 0.026, 0.035, 8), 0x2c2f2a, g, 0, 0.08, 0); solid(new THREE.BoxGeometry(0.012, 0.09, 0.02), 0x8a8f86, g, 0.036, 0.02, 0);
    const A = loc(a, from[0], from[1], from[2], new THREE.Vector3()), Bq = loc(a, to[0], to[1], to[2], new THREE.Vector3()); a.can = Bq;
    add(g, tEnd - t0, (e) => { const t = t0 + e.t, u = seg(t, t0, t1), h = t < t1 ? Math.sin(Math.PI * u) * 0.7 : Math.max(0, Math.sin(Math.PI * seg(t, t1, t1 + 0.25))) * 0.12;
      g.position.copy(A).lerp(Bq, eout(u)); g.position.y += h + 0.035; g.rotation.set(t < t1 ? e.t * 9 : Math.PI / 2, a.yaw + 0.6, t < t1 ? e.t * 5 : 0); }, t0);
    at(t1, () => { const Q = P(); for (let i = 0; i < 30; i++) { const an = Math.random() * TAU, sp = rnd(0.4, 1.4); EM(Q, Bq, Math.cos(an) * sp, rnd(0.2, 0.9), Math.sin(an) * sp, i % 2 ? 0xe4e8e4 : 0xc2c9c5, rnd(0.4, 0.75), rnd(1.4, 2.2), { grow: 2.4, drag: 1.6, so: 1, a: 0.6 }); } });   // 터지는 순간 뭉게 연기
  }
  // 연기: 깡통에서 뿜는 줄기 + 둘레로 번진 두꺼운 구름(zb: 캐릭터 앞(+)·뒤(−) 쪽으로 더 번짐) — 덮어 그리기라 뒤의 캐릭터를 가림
  const smokeTick = (a, dt, rate, zb = 0) => { if (!a.can) return; const Q = P(), p = a.can, cy = Math.cos(a.yaw), sy = Math.sin(a.yaw), n = Math.ceil(dt * rate);
    for (let i = 0; i < n; i++) { const col = Math.random() < 0.5 ? 0xe4e8e4 : 0xc2c9c5;
      if (i % 3 === 0) { EM(Q, _b.set(p.x, p.y + 0.08, p.z), rnd(-0.25, 0.25), rnd(0.9, 1.6), rnd(-0.25, 0.25), col, rnd(0.18, 0.3), rnd(0.9, 1.4), { grow: 3.2, drag: 1.2, so: 1, a: 0.6 }); continue; }
      const x = rnd(-0.6, 0.6), z = rnd(-0.45, 0.45) + zb * Math.random(); EM(Q, _b.set(p.x + cy * x + sy * z, p.y + rnd(0.1, 0.7), p.z - sy * x + cy * z), rnd(-0.3, 0.3), rnd(0.12, 0.45), rnd(-0.3, 0.3), col, rnd(0.55, 0.95), rnd(1.6, 2.5), { grow: 2.0, drag: 0.8, so: 1, a: 0.55 }); } };
  // 가슴의 훈장 3개: 차례로 달리며 반짝
  function medals(a, ts, tEnd) {
    const E = a.E, cols = [0xffd65a, 0xdfe6ee, 0xd08a4a];
    ts.forEach((t1, i) => { const m = card(new THREE.Vector3(), tex().star5(), cols[i], tEnd - t1, (mm, u, e) => { a.rig.chest.localToWorld(mm.position.set(0.04 + i * 0.055, 0.02 - (i % 2) * 0.03, 0.17)); mm.scale.setScalar(0.07 * Math.min(1, e.t * 6) + Math.max(0, 0.2 - e.t) * 0.4); mm.material.opacity = 1 - sstep(tEnd - t1 - 0.4, tEnd - t1, e.t); }, t1);
      at(t1, () => { a.rig.chest.localToWorld(_c.set(0.04 + i * 0.055, 0.02, 0.17)); glow(_c, 0xffffff, 0.5, 0.3); }); });
  }
  MOT.smokeIn = { kind: 'in', dur: 4.4, keys: [[0, 'march'], [1.72, 'march'], [1.9, 'att', 0.18], [2.05, 'att'], [2.35, 'salute', 0.3], [3.35, 'salute'], [3.6, 'att', 0.25]],
    body(t, B) { B.vis = t > 0.7; if (t < 1.85) B.z = -1.55 * (1 - seg(t, 0.72, 1.82)); },
    fx(a) { const E = a.E, gp = a.gp; smokeCan(a, [-2.2, 1.6, 0.6], [0.18, 0.04, -0.8], 0, 0.45, 3.4); label(E, gp, 2.1); medals(a, [2.4, 2.65, 2.9], 4.2);
      at(1.9, () => { ring(gp, E.c[1], 1.2, 0.4, 0); const Q = P(); for (let i = 0; i < 14; i++) { const an = Math.random() * TAU; EM(Q, _c.set(gp.x + Math.cos(an) * 0.2, gp.y + 0.04, gp.z + Math.sin(an) * 0.2), Math.cos(an) * 0.8, 0.3, Math.sin(an) * 0.8, 0xcfd4cc, rnd(0.08, 0.14), 0.6, { grow: 1, so: 1, a: 0.5, drag: 2 }); } }); },
    tick(a, r, t, dt) { if (t > 0.45 && t < 2.8) smokeTick(a, dt, t < 1.6 ? 115 : 45 * (1 - seg(t, 1.6, 2.8)), -0.5); } };
  MOT.smokeOut = { kind: 'out', dur: 3.7, keys: [[0, 'stand'], [0.3, 'att', 0.3], [0.65, 'salute', 0.3], [1.35, 'salute'], [1.55, 'att', 0.2], [1.75, 'att'], [1.9, 'march', 0.15]],
    body(t, B) { B.ry = Math.PI * sstep(1.55, 1.9, t); if (t > 1.9) B.z = -1.6 * seg(t, 1.9, 2.95); B.vis = t < 2.55; },
    fx(a) { const E = a.E, gp = a.gp; smokeCan(a, [-0.25, 0.85, 0.12], [0.12, 0.04, 0.32], 1.42, 1.62, 3.6);
      const tags = new THREE.Group(); [[0, 0, 0.3], [0.035, 0.01, -0.25]].forEach(([x, z, ry]) => { const m = solid(new THREE.BoxGeometry(0.05, 0.005, 0.03), 0xc9ced2, tags, x, 0.004, z); m.rotation.y = ry; });
      const tp = loc(a, 0.05, 0, 0.1, new THREE.Vector3()); add(tags, 1.1, (e) => { tags.position.copy(tp); tags.rotation.y = a.yaw; }, 2.5);
      for (const tt of [2.75, 3.05, 3.35]) at(tt, () => card(_c.set(tp.x, tp.y + 0.03, tp.z).clone(), tex().star4(), 0xffffff, 0.35, (m, u) => { m.scale.setScalar(0.3 * Math.sin(Math.PI * u) + 0.01); m.material.opacity = 1; })); },
    tick(a, r, t, dt) { if (t > 1.62 && t < 3.3) smokeTick(a, dt, t < 2.6 ? 120 : 50 * (1 - seg(t, 2.6, 3.3)), -1.0); } };
  // ===== 백룸 정복자 =====
  //  입장(탈출): 등 뒤에 백룸 복도가 보이는 문틈이 찢어지듯 열리고, 그 속에서 몸을 던져 빠져나와 네 발로 구름 — 바로 뒤에서 검은 손이 문틈 밖까지 뻗어 발목을 낚아채려다
  //   허공을 움켜쥐고 더듬음 · 다른 손은 문틀을 움켜쥠 → 손이 끌려 들어가며 문틈이 닫힘 → 뒤를 돌아보고 이마의 땀을 훔침
  //  퇴장(노클립): 발밑이 지직거리며 네모 격자가 번지고 픽셀이 떠오름 → 바닥에 노란 백룸이 내려다보이는 구멍이 열리고 허우적거리며 떨어짐 → 아래에서 형광 빛이 솟고 구멍이 닫힘
  //  문틈은 불투명 그림이라 그 뒤(백룸 안)에 있는 몸·팔은 가려지고, 문틈을 넘어온 부분만 보인다
  const BR = { W: 1.25, H: 2.35, D: 0.95 };   // 문틈 너비·높이 · 캐릭터 뒤로 떨어진 거리
  // 캐릭터 기준 자리(x 왼쪽 +, z 앞) → 월드
  const loc = (a, x, y, z, out) => out.set(a.gp.x + Math.cos(a.yaw) * x + Math.sin(a.yaw) * z, a.gp.y + y, a.gp.z - Math.sin(a.yaw) * x + Math.cos(a.yaw) * z);
  // 백룸 '그것'의 검은 손: 손목이 원점 · +z = 손가락 · 손바닥은 −y · 마디 셋에 갈고리 손톱 · 팔뚝은 뒤(−z)로 arm 길이만큼
  let HG = null;
  function handGeo() { return HG || (HG = { box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(0.5, 1, 5).rotateX(Math.PI / 2), arm: new THREE.CylinderGeometry(0.5, 0.62, 1, 7).rotateX(Math.PI / 2), mat: new THREE.MeshBasicMaterial({ color: 0x060508 }) }); }
  function entityHand(arm) {
    const H = handGeo(), g = new THREE.Group();
    const part = (geo, sx, sy, sz, x, y, z, par) => { const m = new THREE.Mesh(geo, H.mat); m.userData.keep = true; m.scale.set(sx, sy, sz); m.position.set(x, y, z); (par || g).add(m); return m; };
    if (arm) part(H.arm, 0.075, 0.07, arm, 0, -0.005, -arm / 2);
    part(H.box, 0.1, 0.032, 0.12, 0, 0, 0.055);
    const F = [];
    for (const [x, L, sp] of [[-0.038, 0.85, -0.22], [-0.013, 1, -0.07], [0.013, 1.06, 0.07], [0.038, 0.9, 0.22]]) {
      const s1 = new THREE.Group(); s1.position.set(x, 0, 0.11); g.add(s1); part(H.box, 0.018, 0.018, 0.085 * L, 0, 0, 0.042 * L, s1);
      const s2 = new THREE.Group(); s2.position.z = 0.085 * L; s1.add(s2); part(H.box, 0.015, 0.015, 0.075 * L, 0, 0, 0.037 * L, s2);
      const s3 = new THREE.Group(); s3.position.z = 0.075 * L; s2.add(s3); part(H.cone, 0.016, 0.016, 0.075 * L, 0, 0, 0.037 * L, s3);
      F.push([s1, s2, s3, sp]);
    }
    const t1 = new THREE.Group(); t1.position.set(-0.05, -0.005, 0.03); t1.rotation.y = -0.9; g.add(t1); part(H.box, 0.017, 0.017, 0.075, 0, 0, 0.037, t1);
    const t2 = new THREE.Group(); t2.position.z = 0.075; t1.add(t2); part(H.cone, 0.016, 0.016, 0.065, 0, 0, 0.032, t2);
    g.userData.F = F; g.userData.T = [t1, t2]; return g;
  }
  // 쥐기: k 0 = 쫙 폄(조금 젖힘) · 1 = 꽉 쥠 — 손가락마다 조금씩 어긋나게 꿈틀
  function grip(g, k, t) {
    g.userData.F.forEach((f, i) => { const kk = clamp(k + Math.sin(t * 9 + i * 1.7) * 0.06, -0.35, 1.25); f[0].rotation.set(kk * 0.95 - 0.15, f[3] * (1 - Math.max(0, kk) * 0.7), 0); f[1].rotation.x = kk * 1.15; f[2].rotation.x = kk * 0.9; });
    const T = g.userData.T; T[0].rotation.x = k * 0.6; T[1].rotation.x = k * 0.8;
  }
  // 문틈: 복도 그림(불투명 — 뒤를 가림) + 테두리 빛 + 바닥에 쏟아지는 빛 · tc 에 닫힘
  function brPortal(a, tc) {
    const E = a.E, c = loc(a, 0, BR.H / 2, -BR.D, new THREE.Vector3()), F = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)), life = tc + 0.24;
    const m = new THREE.Mesh(kit().vplane(), new THREE.MeshBasicMaterial({ map: corridorTex(), side: THREE.DoubleSide, fog: false })); m.rotation.y = a.yaw;
    const fr = new THREE.Mesh(kit().vplane(), mat(frameTex(), E.c[0])); fr.rotation.y = a.yaw; fr.renderOrder = 7;
    const gq = loc(a, 0, 0, -BR.D + 0.55, new THREE.Vector3()); gq.snow = a.gp.snow; const sp = flat(tex().glow(), dim(E.c[0], 0.6), gq, 0.025); sp.rotation.y = a.yaw;
    const op = (t) => (t < 0.3 ? Math.max(0.03, stepQ(eout(t / 0.3), 6)) : 1);
    add(m, life, (e) => {
      const t = e.t; let sx = op(t), sy = 1; if (t > tc) { const v = seg(t, tc, tc + 0.2); sy = Math.max(0.01, 1 - stepQ(ein(v), 5)); sx *= 1 - v * 0.6; }
      const j = t < 0.35 || t > tc ? 0.03 : 0.005; m.position.copy(c); m.position.x += rnd(-j, j); m.position.y += rnd(-j, j) * 0.5;
      m.scale.set(BR.W * sx, BR.H * sy, 1); m.material.color.setScalar(Math.random() < 0.07 ? 0.55 : 0.9 + Math.random() * 0.1);
      fr.position.copy(m.position).addScaledVector(F, 0.015); fr.scale.set(BR.W * 1.18 * sx + 0.04, BR.H * 1.08 * sy, 1); fr.material.opacity = (0.7 + Math.random() * 0.3) * Math.min(1, t * 5);
      const k = Math.min(1, t / 0.3) * (t > tc ? 1 - seg(t, tc, tc + 0.2) : 1); sp.scale.set(1.7, 1, 2.3 * k + 0.01); sp.material.opacity = k * (0.65 + Math.random() * 0.35);
    });
    add(fr, life, () => {}); add(sp, life, () => {});
    at(tc + 0.18, () => { glow(c, E.c[2], 2.4, 0.3); ring(a.gp, E.c[0], 1.8, 0.5, 0, sqTex()); shake(0.035); const Q = P(); for (let i = 0; i < 40; i++) loc(a, rnd(-0.4, 0.4), rnd(0.2, 2.1), -BR.D + 0.05, _b), EM(Q, _b, rnd(-1.6, 1.6), rnd(-0.6, 1.4), rnd(-0.6, 1.2), pk(E), rnd(0.03, 0.065), rnd(0.3, 0.7), { sq: 1, drag: 2.5, so: 0.85 }); });
  }
  // 발목을 낚아채려는 손 (t0 에 문틈 밖으로 뻗음): 쭉 뻗음 → 허공을 움켜쥠 → 더듬음 → tr 에 끌려 들어감
  function brReach(a, t0, tr) {
    const h = entityHand(0.9), S = loc(a, -0.05, 1.32, -1.9, new THREE.Vector3()), T = loc(a, -0.08, 1.2, -0.4, new THREE.Vector3()), d = new THREE.Vector3().subVectors(T, S).normalize(), Lx = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw)), p = new THREE.Vector3();
    add(h, tr + 0.14 - t0, (e) => {
      const t = t0 + e.t; let reach, g;
      if (t < t0 + 0.22) { reach = eout(seg(t, t0, t0 + 0.22)) * 1.05; g = -0.3; }
      else if (t < t0 + 0.29) { reach = 1.05 - seg(t, t0 + 0.22, t0 + 0.29) * 0.05; g = sstep(t0 + 0.22, t0 + 0.27, t) * 1.1; }
      else if (t < tr) { reach = 0.98 + Math.sin(t * 6) * 0.03; g = 0.3 + 0.5 * Math.abs(Math.sin(t * 5.5)); }
      else { reach = 0.98 - ein(seg(t, tr, tr + 0.12)) * 1.2; g = 0.95; }
      p.copy(S).lerp(T, reach); if (t > t0 + 0.29 && t < tr) { const k = Math.abs(Math.sin(t * 4.6)); p.addScaledVector(Lx, Math.sin(t * 7.3) * 0.09).addScaledVector(d, k * 0.08); p.y -= k * 0.16; }
      p.x += rnd(-0.005, 0.005); p.y += rnd(-0.005, 0.005);
      h.position.copy(p); h.lookAt(_a.copy(p).add(d)); h.scale.setScalar(2.2); grip(h, g, t); h.visible = t < tr + 0.12;
    }, t0);
  }
  // 문틀을 안쪽에서 움켜쥔 손: 손바닥·팔은 문틈 그림 뒤에 가리고 손가락만 문틀 밖으로 감겨 나옴
  //  edge 'side' = 화면 왼쪽(캐릭터 오른쪽) 기둥 · 'top' = 윗변 (거대한 무언가가 문틈 뒤에서 몸을 끌어당기는 듯)
  function brGrip(a, t0, tr, edge) {
    const h = entityHand(0), Lx = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw)), F = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)), p = new THREE.Vector3(), top = edge === 'top';
    const zA = top ? new THREE.Vector3(0, 1, 0) : Lx.clone().negate(), yA = F.clone().negate(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(yA, zA), yA, zA));
    add(h, tr + 0.12 - t0, (e) => { const t = t0 + e.t, inn = t < t0 + 0.15 ? 1 - eout(seg(t, t0, t0 + 0.15)) : t > tr ? seg(t, tr, tr + 0.1) : 0;
      if (top) loc(a, 0.18 + Math.sin(t * 2.5) * 0.01, BR.H - 0.33 - inn * 0.4, -BR.D - 0.1, p); else loc(a, -0.42 + inn * 0.4, 1.45 + Math.sin(t * 3) * 0.012, -BR.D - 0.1, p);
      h.position.copy(p); h.quaternion.copy(q); h.scale.setScalar(2.0); grip(h, t < tr ? 0.85 + Math.sin(t * 8 + (top ? 2 : 0)) * 0.07 : 0.25, t); h.visible = t < tr + 0.1; }, t0);
  }
  MOT.escape = { kind: 'in', dur: 4.4, keys: [[0, 'dive'], [0.84, 'dive'], [0.98, 'sprawl', 0.14], [1.15, 'sprawl'], [1.35, 'crawlLook', 0.2], [1.85, 'crawlLook'], [2.25, 'rise', 0.35], [2.55, 'lookBack', 0.3], [3.05, 'lookBack'], [3.3, 'wipe', 0.25], [3.85, 'wipe']],
    body(t, B) { B.vis = t > 0.32; const u = seg(t, 0.32, 0.84), w = sstep(0.82, 0.98, t); B.z = lerp(-3.3, -1.0, eout(u)) * (1 - w); B.y = (0.5 + Math.sin(Math.PI * u) * 0.2) * (1 - w); B.rx = 1.2 * (1 - w); },
    fx(a) {
      const E = a.E, gp = a.gp;
      envFx(0.5, () => { const k = Math.random() < 0.4 ? 0.5 : 1; return [k, k]; }); at(1.9, () => envFx(0.3, () => { const k = Math.random() < 0.5 ? 0.55 : 1; return [k, k]; }));
      brPortal(a, 1.95); brReach(a, 0.86, 1.8); brGrip(a, 0.95, 1.8, 'side'); brGrip(a, 1.2, 1.78, 'top');
      at(0.97, () => { shake(0.04); const Q = P(); for (let i = 0; i < 28; i++) { loc(a, rnd(-0.4, 0.4), 0.05, rnd(-0.45, 0.6), _b); EM(Q, _b, rnd(-0.8, 0.8), rnd(0.4, 1.4), rnd(-0.8, 0.8), i % 3 ? 0xd9cfae : pk(E), rnd(0.025, 0.05), rnd(0.4, 0.8), { sq: 1, g: -4, drag: 1.2, so: 0.9 }); } });
      label(E, gp, 2.3);
    },
    tick(a, r, t, dt) {   // 문틈 가장자리에서 떨어져 나오는 픽셀 (열리고 닫힐 때 많이)
      if (t > 2.15 || Math.random() > dt * (t < 0.4 || t > 1.9 ? 80 : 16)) return;
      const s = Math.random() < 0.5 ? -1 : 1; loc(a, s * BR.W * 0.5 * rnd(0.85, 1.05), rnd(0.05, BR.H), -BR.D + 0.03, _b);
      EM(P(), _b, rnd(-0.3, 0.3), rnd(-0.1, 0.5), rnd(-0.3, 0.3), pk(a.E), rnd(0.025, 0.05), rnd(0.25, 0.6), { sq: 1, drag: 1.5, so: 0.85 });
    } };
  MOT.noclip = { kind: 'out', dur: 2.9, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.62, 'lookDown', 0.3], [0.94, 'lookDown'], [1.04, 'flail', 0.1]],
    body(t, B) {
      if (t > 0.45 && t < 0.98) { const k = seg(t, 0.45, 0.95); if (Math.random() < 0.35 * k) { B.x = rnd(-0.03, 0.03) * k; B.sx = 1 + rnd(-0.06, 0.06) * k; } }
      if (t > 0.98) { const u = seg(t, 0.98, 1.5); B.y = -2.5 * ein(u); B.rx = 0.18 * u; B.ry = 0.5 * u; B.vis = u < 0.97 && (u < 0.75 || Math.random() < 0.7); }
    },
    fx(a) {
      const E = a.E, gp = a.gp, open = (t) => (t < 1.06 ? stepQ(seg(t, 0.92, 1.06), 4) : t > 1.72 ? 1 - stepQ(seg(t, 1.72, 2.1), 5) : 1);
      const grid = flat(sqTex(), E.c[0], gp, 0.035); grid.rotation.y = a.yaw; add(grid, 0.7, (e, u) => { grid.scale.setScalar(0.6 + u); grid.material.opacity = (Math.random() < 0.3 ? 0.25 : 0.9) * Math.min(1, u * 4); }, 0.35);   // 발밑이 지직
      at(0.4, () => envFx(1.3, (u) => { const k = Math.random() < 0.25 + u * 0.2 ? 0.55 : 1; return [k, k]; }));
      const pit = flat(pitTex(), 0xffffff, gp, 0.04); pit.material.blending = THREE.NormalBlending; pit.rotation.y = a.yaw; pit.renderOrder = 3;   // 내려다보이는 백룸 (덮어 그림)
      add(pit, 1.2, (e) => { const s = open(0.92 + e.t); pit.scale.setScalar(Math.max(0.01, 1.55 * s)); pit.material.color.setScalar(Math.random() < 0.06 ? 0.7 : 1); }, 0.92);
      const rim = flat(sqTex(), E.c[0], gp, 0.05); rim.rotation.y = a.yaw; add(rim, 1.2, (e) => { rim.scale.setScalar(Math.max(0.01, 1.63 * open(0.92 + e.t))); rim.material.opacity = 0.8 + Math.random() * 0.2; }, 0.92);
      pillar(gp, dim(E.c[0], 0.45), 0.6, 1.4, 1.0, 0.95, 0.5);   // 구멍에서 새어 나오는 형광 빛
      at(1.5, () => { pillar(gp, dim(E.c[0], 0.55), 0.5, 4.2, 0.55, 0, 0.1); glow(_c.set(gp.x, gp.y + 0.4, gp.z), E.c[2], 2.2, 0.35); flash(1.2, 0.25); shake(0.03); const Q = P(); for (let i = 0; i < 40; i++) EM(Q, _b.set(gp.x + rnd(-0.6, 0.6), gp.y + 0.1, gp.z + rnd(-0.6, 0.6)), rnd(-0.4, 0.4), rnd(1.5, 4.5), rnd(-0.4, 0.4), pk(E), rnd(0.03, 0.06), rnd(0.5, 1.0), { sq: 1, drag: 1, so: 0.85 }); });
      at(2.1, () => { ring(gp, E.c[0], 1.4, 0.45, 0, sqTex()); decal(gp, sqTex(), 1.5, 0.8, E.c[1], 0x000000); });
    },
    tick(a, r, t, dt) {
      const Q = P(), E = a.E;
      if (t > 0.45 && t < 1.5 && Math.random() < dt * 45) { const an = Math.random() * TAU, rr = rnd(0.15, 0.75); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), 0, rnd(0.3, 1.0), 0, pk(E), rnd(0.03, 0.06), rnd(0.4, 0.9), { sq: 1, so: 0.85 }); }   // 바닥에서 떠오르는 픽셀
      if (t > 0.6 && t < 1.45 && Math.random() < dt * 30) { hipsW(r, _a); for (const c of [0xff3050, 0x30e8ff]) EM(Q, _b.set(_a.x + rnd(-0.35, 0.35), _a.y + rnd(-0.8, 0.9), _a.z + rnd(-0.2, 0.2)), rnd(-0.3, 0.3), 0, 0, c, rnd(0.02, 0.04), rnd(0.15, 0.3), { sq: 1, so: 0.7 }); }   // 몸 둘레 색 어긋남
    } };
  // ===== 전쟁의 신: 하늘에서 붉게 달아오른 칼들이 비처럼 쏟아져 둘레에 꽂히고, 가운데에 붉은 번개가 떨어지며 한 무릎으로 나타남 → 일어나 포효(힘자랑)하면 칼들이 붉게 타오르다 재가 됨
  //        퇴장: 커다란 검이 눈앞에 내리꽂히고, 두 손으로 뽑아 하늘로 치켜들면 번개가 검에 떨어지며 사라짐 → 검은 쓰러지며 불티로
  const sky3 = (gp, k = 1) => new THREE.Vector3(gp.x + rnd(-0.8, 0.8) * k, gp.y + 9, gp.z + rnd(-1.5, -0.5) * k);
  // 검: 손잡이 가운데가 원점 · 칼날은 +y (끝 1.11 × s) · 붉은 기운(glow)
  function sword(E, s) {
    const g = new THREE.Group(), steel = 0x9097a0;
    solid(new THREE.BoxGeometry(0.075 * s, 0.86 * s, 0.014 * s), steel, g, 0, 0.53 * s, 0);
    const tp = solid(new THREE.ConeGeometry(0.038 * s, 0.15 * s, 4), steel, g, 0, 1.035 * s, 0); tp.scale.z = 0.25;
    const sm = [tp, solid(new THREE.BoxGeometry(0.27 * s, 0.035 * s, 0.05 * s), 0x3a0d10, g, 0, 0.09 * s, 0), solid(new THREE.CylinderGeometry(0.017 * s, 0.02 * s, 0.17 * s, 8), 0x1d1515, g, 0, -0.005 * s, 0), solid(new THREE.SphereGeometry(0.03 * s, 8, 6), 0x3a0d10, g, 0, -0.1 * s, 0)];
    for (const m of sm) m.castShadow = false;   // 작은 부품은 그림자 생략 (칼이 7자루라 그리기 횟수 절약)
    g.userData.glow = lit(new THREE.BoxGeometry(0.03 * s, 0.84 * s, 0.024 * s), 0xff4414, g, 0, 0.55 * s, 0, 0.5);   // 칼날 가운데 홈이 주홍빛으로 달아오름 (칼날 전체를 덮으면 판자처럼 보임)
    return g;
  }
  function bladeRain(a, tEnd, tRoar) {
    const E = a.E, g = grpAt(a), S = [];
    [70, 110, 145, 180, 215, 250, 290].forEach((deg, i) => { const an = deg * Math.PI / 180, rr = rnd(0.95, 1.25), sc = rnd(1.0, 1.2), w = sword(E, sc); w.rotation.order = 'YXZ'; w.visible = false; g.add(w);
      S.push({ w, x: Math.sin(an) * rr, z: Math.cos(an) * rr, y0: 1.11 * sc - 0.28, t: 0.1 + i * 0.11, ry: rnd(0, TAU), rx: Math.PI + rnd(-0.18, 0.18), rz: rnd(-0.18, 0.18) }); });
    add(g, tEnd, (e) => { const t = e.t, sink = sstep(tEnd - 0.75, tEnd - 0.1, t), fl = Math.max(0, 1 - Math.abs(t - tRoar - 0.2) / 0.45);
      for (const s of S) { const f = seg(t, s.t, s.t + 0.22); s.w.visible = t > s.t; s.w.position.set(s.x, s.y0 + (1 - ein(f)) * 4.6 - sink * 1.5, s.z); s.w.rotation.set(s.rx, s.ry, s.rz); s.w.userData.glow.material.opacity = (0.5 + fl * 0.5 + Math.sin(t * 9 + s.ry) * 0.08) * (1 - sink * 0.8); } });
    for (const s of S) at(s.t + 0.22, () => { loc(a, s.x, 0.05, s.z, _c); ring(gpOf(a, _c), E.c[0], 0.5, 0.35); const Q = P(); for (let i = 0; i < 12; i++) EM(Q, _c, rnd(-1.5, 1.5), rnd(0.8, 2.8), rnd(-1.5, 1.5), i % 2 ? 0xffd2a0 : E.c[0], rnd(0.02, 0.04), rnd(0.25, 0.5), { g: -7, drag: 1.5, so: 0.4 }); });
    at(tEnd - 0.7, () => { for (const s of S) { loc(a, s.x, 0.4, s.z, _c); burst(_c, E, 12, 1.4, { g: 1.2 }); } });
  }
  MOT.bladeRain = { kind: 'in', dur: 4.3, keys: [[0, 'land'], [1.4, 'land'], [1.95, 'rise', 0.5], [2.35, 'flex', 0.4], [3.45, 'flex']],
    body(t, B) { B.vis = t > 0.97; },
    fx(a) { const E = a.E, gp = a.gp, g0 = new THREE.Vector3(gp.x, gp.y, gp.z); bladeRain(a, 4.0, 2.35);
      bolt(sky3(gp, 0.3), g0.clone(), E.c[0], 0.42, 0.93, 0.2); bolt(sky3(gp), g0.clone().add(_a.set(0.2, 0, -0.1)), E.c[0], 0.3, 0.85, 0.1); flash(2.4, 0.18, 0.95); shake(0.13, 0.97);
      ring(gp, E.c[0], 2.8, 0.7, 0.97); ring(gp, E.c[2], 1.5, 0.4, 0.99); decal(gp, tex().lava(), 2.2, 2.6, E.c[2], E.c[0], 0.95); glow(hipsAt(a, 0.5).clone(), E.c[2], 5, 0.4, 0.95); label(E, gp, 1.2);
      at(0.97, () => { const Q = P(); for (let i = 0; i < 60; i++) { const an = Math.random() * TAU, sp = rnd(2.5, 6); EM(Q, _a.set(gp.x, gp.y + 0.1, gp.z), Math.cos(an) * sp, rnd(0.5, 3), Math.sin(an) * sp, pk(E), rnd(0.02, 0.045), rnd(0.2, 0.5), { drag: 3, so: 0.4 }); } });
      at(2.35, () => { ring(gp, E.c[0], 2.4, 0.55); flash(1.3, 0.25); shake(0.05); chestW(a.rig, _c); bolt(_c.clone().add(_a.set(0, 0.6, 0)), _c.clone().add(_b.set(rnd(-0.6, 0.6), -0.5, 0)), E.c[0], 0.22, 0, 0.05); }); },
    tick(a, r, t, dt) { if (t < 2.3 || t > 3.5 || Math.random() > dt * 30) return; chestW(r, _c); EM(P(), _b.set(_c.x + rnd(-0.4, 0.4), _c.y + rnd(-0.6, 0.6), _c.z + rnd(-0.3, 0.3)), 0, 0.3, 0, pk(a.E), rnd(0.02, 0.04), 0.3, { so: 0.4 }); } };
  MOT.swordOut = { kind: 'out', dur: 3.2, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.9, 'gripSword', 0.35], [1.22, 'gripSword'], [1.55, 'swordUp', 0.3]],
    body(t, B) { B.vis = t < 1.76 || (t < 1.86 && Math.random() < 0.5); },
    fx(a) {
      const E = a.E, gp = a.gp, S = 1.35, sw = sword(E, S), yq = new THREE.Quaternion().setFromAxisAngle(AX_Y, a.yaw), upQ = yq.clone(), dnQ = yq.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AX_X, Math.PI));
      const stuck = loc(a, 0, 1.11 * S - 0.3, 0.46, new THREE.Vector3()), v = new THREE.Vector3(), tip = new THREE.Vector3();
      add(sw, 2.7, (e) => { const t = 0.3 + e.t, r = a.rig;
        if (t < 1.18) { sw.position.copy(stuck); sw.position.y += (1 - ein(seg(t, 0.3, 0.55))) * 4.4; sw.quaternion.copy(dnQ); }
        else if (t < 1.8) { r.armR.hand.getWorldPosition(sw.position); sw.quaternion.copy(dnQ).slerp(upQ, sstep(1.22, 1.6, t)); v.set(0, 0, 0); }
        else { v.y -= e.dt * 9; sw.position.addScaledVector(v, e.dt); sw.rotateX(e.dt * 3); sw.scale.setScalar(Math.max(0.001, 1 - seg(t, 2.3, 2.9))); }
        sw.userData.glow.material.opacity = 0.6 + (t > 1.2 && t < 1.8 ? 0.4 : 0) + Math.sin(t * 10) * 0.08; }, 0.3);
      at(0.55, () => { ring(gp, E.c[0], 1.4, 0.4); shake(0.06); const Q = P(); loc(a, 0, 0.05, 0.46, _c); for (let i = 0; i < 26; i++) EM(Q, _c, rnd(-2, 2), rnd(0.8, 3), rnd(-2, 2), i % 2 ? 0xffd2a0 : E.c[0], rnd(0.02, 0.045), rnd(0.3, 0.6), { g: -7, drag: 1.5, so: 0.4 }); });
      at(1.72, () => { tip.set(0, 1.11 * S, 0).applyQuaternion(sw.quaternion).add(sw.position); bolt(sky3(gp, 0.3), tip.clone(), E.c[0], 0.5, 0, 0.2); flash(2.4, 0.2); shake(0.1); ring(gp, E.c[0], 2.6, 0.6); decal(gp, tex().lava(), 2, 2.2, E.c[2], E.c[0]); glow(hipsAt(a, 0.8).clone(), E.c[2], 5, 0.45);
        burst(hipsAt(a, 0.9), E, 50, 5, { drag: 2.5, so: 0.4 }); });
    },
    tick(a, r, t, dt) { if (t > 1.8 && t < 2.6 && Math.random() < dt * 40) EM(P(), _b.set(a.gp.x + rnd(-0.6, 0.6), a.gp.y + rnd(0.1, 1.2), a.gp.z + rnd(-0.6, 0.6)), 0, rnd(0.5, 1.4), 0, pk(a.E), rnd(0.02, 0.04), rnd(0.5, 0.9), { g: 0.5, so: 0.5 }); } };
  // ===== 하드코어 패왕: 불꼬리를 끌며 떨어져 주먹으로 땅을 내려치면 둘레의 바닥이 깨져 바위판이 분화구처럼 솟고 용암이 갈라져 빛남 → 일어나 목을 꺾어 풀고 주먹을 꺾음 · 바위판이 가라앉음
  //        퇴장: 주먹으로 땅을 치면 바위판이 이빨처럼 솟아 안쪽으로 덮치고, 불길과 함께 땅속으로 삼켜짐
  function slabs(a, tUp, tDown, inward, tEnd, sinkTo) {
    const g = grpAt(a), S = [];
    for (let i = 0; i < 9; i++) { const an = (i / 9) * TAU + rnd(-0.15, 0.15), w = rnd(0.38, 0.55), h = rnd(0.55, 0.85), geo = new THREE.BoxGeometry(w, h, rnd(0.14, 0.2)); geo.translate(0, h / 2, 0);
      const s = new THREE.Group(); s.rotation.order = 'YXZ'; s.rotation.y = an; solid(geo, i % 2 ? 0x2a2320 : 0x342b26, s).rotation.z = rnd(-0.12, 0.12); g.add(s);
      S.push({ s, an, rr: rnd(0.78, 0.95), tilt: (inward ? -1 : 1) * rnd(0.35, 0.6), d: rnd(0, 0.06) }); }
    add(g, tEnd, (e) => { const t = e.t; for (const o of S) { const u = eout(seg(t, tUp + o.d, tUp + o.d + 0.13)), dn = ein(seg(t, tDown, tDown + 0.6)); o.s.position.set(Math.sin(o.an) * o.rr, -0.9 * (1 - u) - dn * sinkTo, Math.cos(o.an) * o.rr); o.s.rotation.x = o.tilt * u; } });
    at(tUp, () => { const Q = P(); for (const o of S) { loc(a, Math.sin(o.an) * o.rr, 0.1, Math.cos(o.an) * o.rr, _c); for (let i = 0; i < 4; i++) EM(Q, _c, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), 0x2a2420, rnd(0.04, 0.07), rnd(0.6, 1.1), { g: -10, sq: 1, so: 1 }); } });
  }
  MOT.crater = { kind: 'in', dur: 4.4, keys: [[0, 'fall'], [0.42, 'punch', 0.06], [1.35, 'punch'], [1.9, 'rise', 0.5], [2.2, 'neck', 0.3], [2.95, 'neck'], [3.2, 'fistPalm', 0.25], [3.75, 'fistPalm']],
    body(t, B) { if (t < 0.42) B.y = 6.5 * (1 - ein(t / 0.42)); else if (t < 0.55) B.y = -0.05 * Math.sin((t - 0.42) / 0.13 * Math.PI); },
    fx(a) { const E = a.E, gp = a.gp; decal(gp, tex().lava(), 3.6, 3.6, 0xffd0a0, E.c[0], 0.42); sigil(gp, tex().fire(), 2.6, 1.6, E.c[1], 1.5, 0.42, 0.25); ring(gp, E.c[0], 3.2, 0.8, 0.42); ring(gp, E.c[1], 2.0, 0.5, 0.45);
      glow(hipsAt(a, 0.3).clone(), E.c[2], 5.5, 0.45, 0.42); shake(0.18, 0.42); flash(1.9, 0.4, 0.42); label(E, gp, 0.65); slabs(a, 0.42, 3.2, false, 3.95, 1.0);
      at(0.42, () => { const Q = P(); for (let i = 0; i < 70; i++) { const an = Math.random() * TAU, sp = rnd(1, 4); EM(Q, _a.set(gp.x + Math.cos(an) * 0.4, gp.y + 0.1, gp.z + Math.sin(an) * 0.4), Math.cos(an) * sp, rnd(1, 4), Math.sin(an) * sp, pk(E), rnd(0.03, 0.06), rnd(0.5, 1.2), { g: -2, drag: 1.2, so: 0.55 }); }
        for (let i = 0; i < 10; i++) EM(Q, _a.set(gp.x + rnd(-0.6, 0.6), gp.y + 0.2, gp.z + rnd(-0.6, 0.6)), rnd(-0.6, 0.6), rnd(0.5, 1.4), rnd(-0.6, 0.6), 0x2a2420, rnd(0.35, 0.55), rnd(1.2, 1.8), { grow: 1.3, so: 1, a: 0.55 }); });
      at(3.25, () => { chestW(a.rig, _c); _c.x += Math.sin(a.yaw) * 0.3; _c.z += Math.cos(a.yaw) * 0.3; glow(_c, E.c[2], 1.6, 0.25); burst(_c, E, 24, 2.2, { drag: 2.5 }); }); },
    tick(a, r, t, dt) { const Q = P(), E = a.E;
      if (t < 0.42) { hipsW(r, _a); const n = Math.ceil(dt * 200); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.25, 0.25), _a.y + rnd(0, 1.3), _a.z + rnd(-0.25, 0.25)), rnd(-0.4, 0.4), rnd(1, 3), rnd(-0.4, 0.4), i % 4 ? pk(E) : 0x2a2420, rnd(0.07, 0.15), rnd(0.2, 0.45), { grow: 0.6, so: i % 4 ? 0.5 : 1 }); }
      else if (t < 3.3 && Math.random() < dt * 40) { const an = Math.random() * TAU, rr = rnd(0.3, 1.0); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), rnd(-0.1, 0.1), rnd(0.6, 1.6), rnd(-0.1, 0.1), pk(E), rnd(0.02, 0.04), rnd(0.8, 1.5), { g: 0.2, so: 0.5 }); } } };
  const firePillar = (a, dur, delay, h = 4.2) => { const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.5), 0.8, h, dur, delay, 0.45); pillar(gp, dim(0xff3a10, 0.55), 0.5, h * 0.7, dur * 0.9, delay + 0.05, 0.5); sigil(gp, tex().fire(), 2.6, dur, E.c[1], 1.8, delay, 0.15); };
  const fireTick = (a, r, dt, k = 1, rad = 0.65) => { const Q = P(), E = a.E, n = Math.ceil(dt * 120 * k); for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.1, rad); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(0, 0.5), a.gp.z + Math.sin(an) * rr), -Math.sin(an) * 0.8, rnd(1.5, 4), Math.cos(an) * 0.8, pk(E), rnd(0.06, 0.13), rnd(0.35, 0.7), { grow: -0.5, so: 0.45 }); } };
  MOT.devour = { kind: 'out', dur: 3.0, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.62, 'punch', 0.2]],
    body(t, B) { if (t > 1.15) { const u = seg(t, 1.15, 1.75); B.y = -1.6 * ein(u); B.vis = u < 0.98; } },
    fx(a) { const E = a.E, gp = a.gp; decal(gp, tex().lava(), 3.2, 2.2, 0xffd0a0, E.c[0], 0.62); ring(gp, E.c[0], 2.6, 0.6, 0.62); shake(0.12, 0.62); flash(1.6, 0.3, 0.62); slabs(a, 0.68, 1.15, true, 2.1, 1.3); firePillar(a, 1.4, 0.8, 3.8);
      at(1.75, () => { ring(gp, E.c[0], 1.8, 0.5); glow(hipsAt(a, 0.2).clone(), E.c[2], 3, 0.4); }); },
    tick(a, r, t, dt) { if (t > 0.7 && t < 2.0) fireTick(a, r, dt, 1.3); } };
  // ===== 오버로드: 바닥이 녹아 용암 웅덩이가 되고 불길에 휩싸인 검은 쇠 옥좌가 솟아오름 — 그 위에 턱을 괴고 앉아 내려다보다가 일어나 한 걸음 나와 주먹을 손바닥에 · 옥좌는 용암 속으로
  //        퇴장: 등 뒤 용암에서 옥좌가 솟고, 뒤로 물러나 앉아 턱을 괸 채 옥좌와 함께 용암 속으로 가라앉음
  const TZ = -0.3;   // 옥좌는 캐릭터 자리보다 뒤 (앉으면 몸도 이만큼 뒤로)
  const thY = (t, up, dn) => (t < dn[0] ? -2.3 * (1 - eout(seg(t, up[0], up[1]))) : -2.3 * ein(seg(t, dn[0], dn[1])));
  function throne(a, up, dn, tEnd) {
    const E = a.E, g = grpAt(a, TZ), I = 0x1c1818, Rd = 0x4a0c0c;
    solid(new THREE.BoxGeometry(0.8, 0.46, 0.6), I, g, 0, 0.23, -0.1); solid(new THREE.BoxGeometry(0.72, 0.07, 0.54), Rd, g, 0, 0.49, -0.08);
    solid(new THREE.BoxGeometry(0.8, 1.45, 0.12), I, g, 0, 1.19, -0.36); solid(new THREE.BoxGeometry(0.64, 1.12, 0.03), Rd, g, 0, 1.1, -0.29);
    [[-0.33, 0.28], [-0.17, 0.4], [0, 0.56], [0.17, 0.4], [0.33, 0.28]].forEach(([x, h]) => solid(new THREE.ConeGeometry(0.055, h, 6), I, g, x, 1.915 + h / 2, -0.36));
    for (const s of [-1, 1]) { solid(new THREE.BoxGeometry(0.13, 0.09, 0.56), I, g, s * 0.43, 0.73, -0.09); solid(new THREE.BoxGeometry(0.1, 0.26, 0.1), I, g, s * 0.43, 0.56, 0.13); lit(new THREE.SphereGeometry(0.055, 10, 8), E.c[1], g, s * 0.43, 0.8, 0.19, 0.9); lit(new THREE.BoxGeometry(0.03, 1.45, 0.03), E.c[0], g, s * 0.41, 1.19, -0.29, 0.8); }
    lit(new THREE.BoxGeometry(0.82, 0.03, 0.03), E.c[0], g, 0, 1.92, -0.29, 0.8); lit(new THREE.BoxGeometry(0.82, 0.03, 0.03), E.c[0], g, 0, 0.46, 0.21, 0.8);
    add(g, tEnd, (e) => { g.position.y = a.gp.y + thY(e.t, up, dn); });
  }
  const lavaPool = (a, t0, dur) => { const E = a.E, gq = loc(a, 0, 0, TZ, new THREE.Vector3()), gp = gpOf(a, gq); decal(gp, tex().lava(), 2.8, dur, 0xffd0a0, E.c[0], t0); sigil(gp, tex().fire(), 2.4, dur, E.c[1], 0.8, t0, 0.1); };
  MOT.throne = { kind: 'in', dur: 4.7, keys: [[0, 'sitGrand'], [1.25, 'sitGrand'], [1.55, 'sitRest', 0.3], [2.3, 'sitRest'], [2.75, 'stand', 0.45], [3.05, 'fistPalm', 0.25], [3.6, 'fistPalm'], [3.9, 'cross', 0.3]],
    body(t, B) { B.vis = t > 0.25; B.z = TZ * (1 - sstep(2.3, 2.75, t)); if (t < 2.6) B.y = thY(t, [0.3, 1.2], [9, 9]); },
    fx(a) { const E = a.E, gp = a.gp; lavaPool(a, 0, 3.9); throne(a, [0.3, 1.2], [2.95, 3.6], 3.7); firePillar(a, 1.3, 0.2, 3.2); flash(1.3, 0.3, 0.3); label(E, gp, 1.3);
      at(3.1, () => { chestW(a.rig, _c); _c.x += Math.sin(a.yaw) * 0.35; _c.z += Math.cos(a.yaw) * 0.35; glow(_c, E.c[2], 2.6, 0.3); ring(gp, E.c[0], 2.2, 0.5); shake(0.05); burst(_c, E, 40, 3.5, { drag: 2.5 }); }); },
    tick(a, r, t, dt) { if (t > 0.2 && t < 1.4) fireTick(a, r, dt, 1.1, 0.9); else if (t < 3.7 && Math.random() < dt * 24) EM(P(), _b.set(a.gp.x + rnd(-0.9, 0.9), a.gp.y + 0.05, a.gp.z + rnd(-0.9, 0.9)), 0, rnd(0.6, 1.4), 0, pk(a.E), rnd(0.02, 0.04), rnd(0.8, 1.3), { so: 0.5 }); } };
  MOT.throneOut = { kind: 'out', dur: 3.3, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.95, 'stand'], [1.4, 'sitGrand', 0.45], [1.75, 'sitRest', 0.3]],
    body(t, B) { B.z = TZ * sstep(0.95, 1.4, t); if (t > 2.0) B.y = thY(t, [0, 0.01], [2.0, 2.8]); B.vis = t < 2.75; },
    fx(a) { const E = a.E, gp = a.gp; lavaPool(a, 0.15, 3.1); throne(a, [0.3, 0.9], [2.0, 2.8], 2.95); firePillar(a, 1.1, 1.95, 3.2); flash(1.25, 0.3, 0.3);
      at(2.8, () => { ring(gp, E.c[0], 1.8, 0.5); glow(hipsAt(a, 0.3).clone(), E.c[2], 2.6, 0.4); }); },
    tick(a, r, t, dt) { if ((t > 0.3 && t < 0.9) || (t > 1.95 && t < 2.9)) fireTick(a, r, dt, 1.1, 0.9); } };
  // ===== 이터널: 커다란 시계가 나타나 바늘이 거꾸로 빠르게 돌고(시간이 되감김) ∞ 모양 빛이 감기며 몸이 빚어짐 → 바늘이 열두 시에 멈추며 종소리 · 두 손을 펴 하늘을 봄
  //        퇴장: 시계 바늘이 점점 빠르게 앞으로 돌고, 몸이 보랏빛 모래가 되어 흘러내리며 흩어짐
  const clockTex = () => ctex('clock', 512, 512, (g) => {
    g.translate(256, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
    circ(246, 6); circ(234, 2); circ(160, 3); circ(152, 1); circ(34, 3);
    for (let i = 0; i < 60; i++) { const an = i / 60 * TAU, l = i % 5 ? 8 : 18; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(Math.sin(an) * 230, -Math.cos(an) * 230); g.lineTo(Math.sin(an) * (230 - l), -Math.cos(an) * (230 - l)); g.stroke(); }
    g.font = 'bold 34px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const an = i / 12 * TAU; g.save(); g.translate(Math.sin(an) * 192, -Math.cos(an) * 192); g.rotate(an); g.fillText(n, 0, 0); g.restore(); });
    g.lineWidth = 1.5; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.moveTo(Math.sin(an) * 40, -Math.cos(an) * 40); g.lineTo(Math.sin(an + 0.26) * 148, -Math.cos(an + 0.26) * 148); g.stroke(); }
  });
  // 시계 (캐릭터 뒤에 세움): ang(t) → [시침, 분침] (라디안, 시계 방향 +) · op(t)
  function clock(a, t0, dur, ang, op) {
    const E = a.E, g = grpAt(a), dial = new THREE.Mesh(kit().vplane(), mat(clockTex(), E.c[0])); dial.position.set(0, 1.25, -0.8); dial.scale.setScalar(2.1); dial.renderOrder = 4; g.add(dial);
    const back = new THREE.Mesh(kit().vplane(), new THREE.MeshBasicMaterial({ map: discTex(), color: 0x1c0a36, transparent: true, depthWrite: false, fog: false })); back.position.set(0, 1.25, -0.83); back.scale.setScalar(2.0); back.renderOrder = 3; g.add(back);   // 어두운 유리 문자판 — 밝은 하늘에서도 빛나는 눈금이 보이게
    const hand = (L, w, c) => { const geo = new THREE.PlaneGeometry(w, L); geo.translate(0, L / 2 - 0.06, 0); const m = new THREE.Mesh(geo, glowM(c, 0.95)); m.userData.own = true; m.renderOrder = 6; m.position.set(0, 1.25, -0.78); g.add(m); return m; };
    const hh = hand(0.5, 0.05, E.c[2]), mh = hand(0.8, 0.035, 0xffffff);
    add(g, dur, (e) => { const t = t0 + e.t, o = op(t), [h, m] = ang(t); hh.rotation.z = -h; mh.rotation.z = -m; dial.material.opacity = o * 0.9; back.material.opacity = o * 0.5; hh.material.opacity = mh.material.opacity = o; dial.rotation.z = Math.sin(t * 0.7) * 0.02; }, t0);
  }
  // ∞ 빛: 시계 앞에 누운 8자를 따라 빛 머리 셋이 돌며 꼬리를 남김 (sc: 크기)
  const infinity = (a, t, dt, sc) => { if (sc < 0.02) return; const Q = P(), E = a.E; for (let k = 0; k < 3; k++) { const s = t * 3.2 + k * TAU / 3, d = 1 + Math.sin(s) ** 2, x = 0.85 * sc * Math.cos(s) / d, y = 0.85 * sc * Math.sin(s) * Math.cos(s) / d;
    loc(a, x, 1.15 + y, -0.35, _b); EM(Q, _b, 0, 0, 0, k ? E.c[0] : E.c[2], 0.13 * sc + 0.03, 0.09, { so: 0.2 }); EM(Q, _b, rnd(-0.05, 0.05), rnd(-0.05, 0.05), 0, pk(E), 0.05, 0.55, { so: 0.3 }); } };
  MOT.clockIn = { kind: 'in', dur: 4.2, keys: [[0, 'float'], [1.35, 'float'], [1.7, 'tall', 0.35], [2.0, 'tall'], [2.35, 'open', 0.35], [3.3, 'open']],
    body(t, B) { const u = seg(t, 0.25, 1.4); B.s = Math.max(0.01, eout(u)); B.ry = (1 - eout(u)) * TAU; B.y = 0.25 * (1 - eout(u)); B.vis = t > 0.25; },
    fx(a) { const E = a.E, gp = a.gp; clock(a, 0, 2.9, (t) => { const m = t < 1.6 ? -Math.pow(1.6 - t, 2) * 9 : 0; return [m / 12, m]; }, (t) => sstep(0, 0.3, t) * (1 - sstep(2.3, 2.85, t)));
      sigil(gp, sigilTex(), 2.6, 3.8, E.c[0], -0.5, 0); ring(gp, E.c[0], 2.4, 0.7, 1.6); ring(gp, E.c[1], 1.5, 0.5, 1.65); flash(1.35, 0.3, 1.6); label(E, gp, 1.7);
      at(1.6, () => { const p = loc(a, 0, 1.25, -0.75, new THREE.Vector3()); glow(p, E.c[2], 2.6, 0.5); card(p.clone(), tex().ring(), E.c[0], 0.6, (m, u) => { m.scale.setScalar(2.4 * eout(u) + 0.01); m.material.opacity = 1 - u; }); glow(hipsAt(a, 0.5).clone(), E.c[2], 3.2, 0.45); }); },
    tick(a, r, t, dt) { if (t > 0.3 && t < 1.65) infinity(a, t, dt, t < 1.4 ? 1 : 1 - seg(t, 1.4, 1.62));
      else if (t > 2.3 && t < 3.4 && Math.random() < dt * 30) { const Q = P(); for (const s of [-1, 1]) { hand0(a, _c, s); EM(Q, _c, rnd(-0.1, 0.1), rnd(0.3, 0.8), rnd(-0.1, 0.1), pk(a.E), rnd(0.03, 0.05), rnd(0.5, 0.9), { so: 0.4 }); } } } };
  MOT.clockOut = { kind: 'out', dur: 3.0, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'open', 0.4], [1.0, 'open'], [1.3, 'float', 0.3]],
    body(t, B) { if (t > 1.0) { const u = seg(t, 1.0, 2.0); B.s = Math.max(0.01, 1 - eout(u)); B.ry = eout(u) * TAU; B.y = u * 0.3; B.vis = u < 0.99; } },
    fx(a) { const E = a.E, gp = a.gp; clock(a, 0.15, 2.7, (t) => { const m = Math.pow(Math.max(0, t - 0.3), 2.2) * 14; return [m / 12, m]; }, (t) => sstep(0.15, 0.45, t) * (1 - sstep(2.3, 2.85, t)));
      sigil(gp, sigilTex(), 2.4, 2.6, E.c[0], 0.5, 0.15); ring(gp, E.c[0], 2.2, 0.6, 1.0); glow(hipsAt(a, 0.6).clone(), E.c[2], 3, 0.5, 1.95); },
    tick(a, r, t, dt) { if (t > 0.4 && t < 2.0) infinity(a, t, dt, t < 1.8 ? 1 : 1 - seg(t, 1.8, 2.0));
      if (t > 1.0 && t < 2.05) { const Q = P(), E = a.E, n = Math.ceil(dt * 110); hipsW(r, _a); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.28, 0.28), _a.y + rnd(-0.7, 0.8) * r.body.scale.y, _a.z + rnd(-0.2, 0.2)), rnd(-0.15, 0.15), rnd(-0.3, 0.1), rnd(-0.15, 0.15), i % 3 ? E.c[0] : 0xe8c46a, rnd(0.02, 0.035), rnd(0.6, 1.1), { g: -4.5, sq: 1, so: 0.7 }); } } };
  // ===== 개발자 (관리자 계정 전용): 로비가 잠깐 '편집기'가 된다 =====
  //  입장: 바닥에 청사진 눈금이 깔리고, 마우스 커서가 철사 상자(모델)를 끌어다 놓으면 T 자세의 재질 없는 모델이 선택 상자·이동 축과 함께 나타남
  //   → 커서가 훑는 틀을 끌어 올리면 아래부터 텍스처가 입혀지고(장비도 그 높이에서 달림) → 커서가 ▶ 를 누르는 순간 뚝뚝 끊기며 깨어나 자기 두 손을 내려다봄
  //   → 허공의 자판을 두드려 명령을 치고(이름 띠가 명령 줄처럼 찍힘) 실행 키를 내리찍으면 등 뒤에 </> 문장이 켜지고 코드 글자가 터져 나옴 → 팔짱 끼고 끄덕
  //  퇴장: 검지 경례 → 커서가 ■ 를 누르면 T 자세로 굳고, 훑는 틀이 내려오며 텍스처가 벗겨져 철사 모델로 → 커서가 집어 조그맣게 줄여 끌고 나감 → 빈자리에 글자 커서만 깜빡
  //  · 재질 없는 모델 = 같은 뼈대로 그린 남색 덩어리 + 청록 철사 (자르는 면 위쪽만 보임). 덩어리가 진짜 몸을 덮어 가리므로 면이 올라가면 아래부터 진짜 몸이 드러난다
  //    (진짜 몸은 그동안 조금 뒤로 밀어 그려 겹침 얼룩이 없게 · 새 셰이더는 '뼈대 + 자르는 면 하나' 하나뿐이고 warmDev 가 미리 만들어 둔다)
  //  · 밝은 하늘·눈밭에서도 보이게 조작 도구(선택 상자·축·단추·커서·꼬리표)는 빛을 더하지 않는 단색·어두운 판으로 그린다
  const DVB = { W: 1.86, H: 1.93, D: 0.56 };   // T 자세를 감싸는 선택 상자
  const KB = { y: 1.03, z: 0.39, tilt: 0.95 }; // 허공의 자판: 가슴 앞 높이·거리 · 화면 쪽으로 눕힌 각
  const DV = { drop: 0.85, s0: 1.2, s1: 2.4, play: 3.0, type: 4.08, enter: 4.82 };   // 입장: 놓음 · 훑기 시작/끝 · ▶ · 타자 · 실행 키
  const DX = { stop: 1.35, s0: 1.75, s1: 2.55, grab: 2.75, gone: 3.3 };              // 퇴장: ■ · 훑기 시작/끝 · 집음 · 사라짐
  const CODEFONT = 'Consolas, "Cascadia Mono", "Courier New", monospace', CLAY = 0x10263a, WIRE = 0x58e6ff;
  // ----- 그림 -----
  // 청사진 눈금: 네 칸마다 굵은 줄 · 가운데 표적 · 멀어질수록 흐려짐
  const gridTex = () => ctex('dvgrid', 512, 512, (g, W) => {
    g.strokeStyle = '#fff'; for (let i = 0; i <= 16; i++) { const p = i * 32, big = i % 4 === 0; g.globalAlpha = big ? 0.95 : 0.42; g.lineWidth = big ? 3 : 1.5; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, W); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); }
    g.globalAlpha = 1; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 22, 0, TAU); g.stroke();
    g.globalCompositeOperation = 'destination-in'; const r = g.createRadialGradient(256, 256, 30, 256, 256, 256); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.55, 'rgba(0,0,0,0.7)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W);
  });
  // 마우스 커서 (흰 화살표 · 짙은 테두리) — 화살표 끝은 그림의 (9, 4)
  const cursorTex = () => ctex('dvcur', 64, 64, (g) => { g.beginPath(); [[9, 4], [9, 49], [20, 39], [28, 58], [36, 54], [28, 36], [44, 36]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = '#06131c'; g.stroke(); g.fillStyle = '#fff'; g.fill(); });
  // 단추: 둥근 네모 판 + ▶(play) · ■(stop) — on = 눌린 뒤(초록)
  const btnTex = (kind, on) => ctex('dvb' + kind + (on ? 1 : 0), 128, 128, (g) => {
    g.beginPath(); g.moveTo(32, 8); g.arcTo(120, 8, 120, 120, 24); g.arcTo(120, 120, 8, 120, 24); g.arcTo(8, 120, 8, 8, 24); g.arcTo(8, 8, 120, 8, 24); g.closePath();
    g.fillStyle = on ? 'rgba(14,104,58,0.95)' : 'rgba(6,22,34,0.9)'; g.fill(); g.lineWidth = 6; g.strokeStyle = on ? '#b4ffd2' : '#4de8ff'; g.stroke(); g.fillStyle = on ? '#fff' : '#bff6ff';
    if (kind === 'play') { g.beginPath(); g.moveTo(47, 35); g.lineTo(93, 64); g.lineTo(47, 93); g.closePath(); g.fill(); } else g.fillRect(40, 40, 48, 48);
  });
  // 허공의 자판: 어두운 판 · 자판 세 줄 · 긴 칸 · 오른쪽 아래 초록 실행 키
  const kbdTex = () => ctex('dvkbd', 256, 96, (g, W, H) => {
    g.fillStyle = 'rgba(6,22,34,0.62)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#4de8ff'; g.lineWidth = 2.5; g.strokeRect(2, 2, W - 4, H - 4);
    g.lineWidth = 1.5; for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) g.strokeRect(9 + c * 21 + r * 4, 8 + r * 20, 17, 15.5);
    g.strokeRect(62, 70, 112, 16); g.fillStyle = 'rgba(125,255,176,0.92)'; g.fillRect(222, 28, 25, 58);
  });
  // 꺾쇠 글자 '<' · '/>' (흰 글자 · 청록 빛 · 짙은 테두리 — 밝은 하늘 앞에서도 또렷하게): 캐릭터 양옆에 서서 캐릭터를 <개발자 /> 처럼 감싼다
  const brkTex = (i) => ctex('dvbrk' + i, 256, 256, (g) => { g.font = 'bold 170px ' + CODEFONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = 'rgba(4,16,26,0.92)'; g.strokeText(i ? '/>' : '<', 128, 136); g.shadowColor = '#4de8ff'; g.shadowBlur = 16; g.fillStyle = '#eaffff'; g.fillText(i ? '/>' : '<', 128, 136); });
  // 바닥 문양: 육각 고리 · 0과 1의 띠 · 가운데 </>
  const dsigTex = () => ctex('dvsig', 256, 256, (g) => {
    g.translate(128, 128); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const hex = (r, w) => { g.lineWidth = w; g.beginPath(); for (let i = 0; i <= 6; i++) { const an = i * TAU / 6; i ? g.lineTo(Math.cos(an) * r, Math.sin(an) * r) : g.moveTo(Math.cos(an) * r, Math.sin(an) * r); } g.stroke(); };
    hex(120, 4); hex(104, 1.5); hex(58, 3);
    const R = mulberry32(9); g.font = 'bold 13px ' + CODEFONT; for (let i = 0; i < 36; i++) { g.save(); g.rotate(i / 36 * TAU); g.fillText(R() < 0.5 ? '0' : '1', 0, -82); g.restore(); }
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6; g.beginPath(); g.arc(Math.cos(an) * 120, Math.sin(an) * 120, 5, 0, TAU); g.fill(); g.lineWidth = 1.5; g.beginPath(); g.moveTo(Math.cos(an) * 58, Math.sin(an) * 58); g.lineTo(Math.cos(an) * 104, Math.sin(an) * 104); g.stroke(); }
    g.font = 'bold 40px ' + CODEFONT; g.fillText('</>', 0, 3);
  });
  // 훑는 틀 아래로 드리우는 빛 막 (위가 밝고 아래로 사라짐 · 가로 줄)
  const scanTex = () => ctex('dvscan', 32, 64, (g, W, H) => { const r = g.createLinearGradient(0, 0, 0, H); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.14, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 6; y < H; y += 6) g.fillRect(0, y, W, 2); });
  // 코드 글자 (흰 글자 · 짙은 테두리 — 색은 재료에서 입힘)
  const GLY = ['{', '}', '<', '>', '/', ';', '=', '0', '1', '(', ')', '#'];
  const glyTex = (i) => ctex('dvg' + i, 64, 64, (g) => { g.font = 'bold 54px ' + CODEFONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = 'rgba(4,14,22,0.9)'; g.strokeText(GLY[i], 32, 35); g.fillStyle = '#fff'; g.fillText(GLY[i], 32, 35); });
  // ----- 부품 -----
  // 단색 부품 (빛을 더하지 않음) · top: 다른 것에 가리지 않고 늘 위에 (편집기의 조작 도구처럼)
  const tint = (geo, col, par, x = 0, y = 0, z = 0, top = false) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: top, depthTest: !top, depthWrite: !top })); m.userData.own = true; if (top) m.renderOrder = 11; m.position.set(x, y, z); if (par) par.add(m); return m; };
  // 상자 여럿을 한 도형으로 (그리기 한 번): [[너비, 높이, 깊이, x, y, z], …]
  const boxes = (list) => { const pos = [], idx = []; let n = 0;
    for (const [w, h, d, x, y, z] of list) { const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position.array, ix = g.index.array; for (let i = 0; i < p.length; i += 3) pos.push(p[i] + x, p[i + 1] + y, p[i + 2] + z); for (let i = 0; i < ix.length; i++) idx.push(ix[i] + n); n += p.length / 3; g.dispose(); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out; };
  // 시각 → 자리 [x, y, z] 를 부드럽게 잇는 길: K = [[시각, x, y, z], …]
  const track = (K) => (t) => { let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++; const A = K[i], B = K[i + 1], u = sstep(A[0], B[0], t); return [lerp(A[1], B[1], u), lerp(A[2], B[2], u), lerp(A[3], B[3], u)]; };
  // 훑는 높이 (발바닥 기준): up = 아래 → 위 (입장) · 아니면 위 → 아래 (퇴장)
  const scanY = (t, t0, t1, up) => { const k = sstep(t0, t1, t); return up ? -0.06 + 2.16 * k : 2.1 - 2.16 * k; };
  // 커서가 다니는 길 (캐릭터 기준 자리 — 화살표 끝)
  const BTN = [0.62, 1.74, 0.3], CORNER = [DVB.W / 2 + 0.03, 0, DVB.D / 2 + 0.03];   // 단추 자리 (벌린 왼팔 위, 머리 옆 빈 곳 — 옆 사람 몸에 가리지 않게 · 상태 꼬리표는 반대쪽) · 훑는 틀의 앞쪽 모서리
  const DVP = {
    in: (() => { const A = track([[0.05, 1.7, 2.35, 0.5], [DV.drop, 0, 1.0, 0.45], [DV.drop + 0.1, 0, 1.0, 0.45], [DV.s0, CORNER[0], -0.06, CORNER[2]]]), B = track([[DV.s1, CORNER[0], 2.1, CORNER[2]], [DV.s1 + 0.08, CORNER[0], 2.1, CORNER[2]], [DV.play - 0.1, BTN[0], BTN[1] - 0.02, BTN[2]], [DV.play + 0.08, BTN[0], BTN[1] - 0.02, BTN[2]], [DV.play + 0.3, 0.95, 0.68, 0.45]]);
      return (t) => (t < DV.s0 ? A(t) : t <= DV.s1 ? [CORNER[0], scanY(t, DV.s0, DV.s1, true), CORNER[2]] : B(t)); })(),
    out: (() => { const A = track([[0.9, 1.6, 2.2, 0.5], [DX.stop - 0.08, BTN[0], BTN[1] - 0.02, BTN[2]], [DX.stop + 0.08, BTN[0], BTN[1] - 0.02, BTN[2]], [DX.s0, CORNER[0], 2.1, CORNER[2]]]), B = track([[DX.s1, CORNER[0], -0.06, CORNER[2]], [DX.s1 + 0.04, CORNER[0], -0.06, CORNER[2]], [DX.grab, 0.05, 1.2, 0.35], [DX.grab + 0.08, 0.05, 1.2, 0.35], [DX.gone, 1.7, 2.3, 0.5]]);
      return (t) => (t < DX.s0 ? A(t) : t <= DX.s1 ? [CORNER[0], scanY(t, DX.s0, DX.s1, false), CORNER[2]] : B(t)); })(),
  };
  // 퇴장 끝: 집힌 모델이 커서 끝으로 줄어들며 끌려감 → { s 크기, x, y, z 몸 자리 }
  const mini = (t) => { const k = ein(seg(t, DX.grab, DX.grab + 0.3)), c = DVP.out(t), s = lerp(1, 0.15, k); return { s, x: c[0] * k, y: (c[1] - 0.95 * s) * k, z: c[2] * k }; };
  // 청사진 눈금 바닥: 펼쳐진 뒤 pulses 시각마다 번쩍 (초록으로)
  function grid(a, t0, dur, pulses) {
    const E = a.E, m = flat(gridTex(), E.c[0], a.gp, 0.032), C0 = new THREE.Color(E.c[0]), C1 = new THREE.Color(E.c[1]); m.rotation.y = a.yaw; m.renderOrder = 3;
    add(m, dur, (e, u) => { const t = t0 + e.t; let p = 0; for (const tp of pulses) if (t >= tp) p = Math.max(p, 1 - (t - tp) / 0.4);
      m.scale.setScalar(5.6 * (0.15 + 0.85 * eout(seg(e.t, 0, 0.5)))); m.material.color.copy(C0).lerp(C1, p * 0.7);
      m.material.opacity = (0.55 + 0.45 * p) * Math.min(1, e.t * 5) * (1 - sstep(0.88, 1, u)) * (e.t < 0.3 && Math.random() < 0.3 ? 0.4 : 1); }, t0);
  }
  // 선택 상자: 모서리 꺾쇠 여덟 (그리기 한 번) — f(t) → [x, 가운데 높이, z, 크기, 색, 투명도] (캐릭터 기준)
  function selBox(a, t0, dur, f) {
    const L = [], l = 0.2, th = 0.02;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const x = sx * DVB.W / 2, y = sy * DVB.H / 2, z = sz * DVB.D / 2; L.push([l, th, th, x - sx * l / 2, y, z], [th, l, th, x, y - sy * l / 2, z], [th, th, l * 0.8, x, y, z - sz * l * 0.4]); }
    const m = tint(boxes(L), a.E.c[0], null); m.material.transparent = true; m.rotation.y = a.yaw;
    add(m, dur, (e) => { const s = f(t0 + e.t); loc(a, s[0], s[1], s[2], m.position); m.scale.setScalar(Math.max(0.001, s[3])); m.material.color.setHex(s[4]); m.material.opacity = s[5]; }, t0);
  }
  // 이동 축 (x 빨강 · y 초록 · z 파랑 화살표 — 늘 위에): 발 가운데가 원점
  function gizmo(a, t0, tOut) {
    const g = grpAt(a); g.position.y += 0.02;
    for (const [c, rot] of [[0xff5063, [0, 0, -Math.PI / 2]], [0x6dff8a, [0, 0, 0]], [0x4d9bff, [Math.PI / 2, 0, 0]]]) { const s = new THREE.Group(); s.rotation.set(rot[0], rot[1], rot[2]); g.add(s);
      const sh = new THREE.BoxGeometry(0.018, 0.5, 0.018); sh.translate(0, 0.25, 0); tint(sh, c, s, 0, 0, 0, true); tint(new THREE.ConeGeometry(0.042, 0.13, 8), c, s, 0, 0.56, 0, true); }
    tint(new THREE.BoxGeometry(0.055, 0.055, 0.055), 0xffffff, g, 0, 0, 0, true);
    add(g, tOut + 0.16 - t0, (e) => { const t = t0 + e.t; g.scale.setScalar(Math.max(0.001, t < tOut ? eout(seg(t, t0, t0 + 0.16)) * (1 + 0.25 * Math.sin(Math.PI * seg(t, t0, t0 + 0.26))) : 1 - ein(seg(t, tOut, tOut + 0.14)))); }, t0);
  }
  // 훑는 틀: 선택 상자의 가로 단면을 도는 밝은 테 + 아래로 드리운 빛 막 — t0~t1 동안 아래에서 위로(up) 또는 위에서 아래로 움직임
  function scanFrame(a, t0, t1, up) {
    const E = a.E, g = grpAt(a), W = CORNER[0] * 2, D = CORNER[2] * 2, th = 0.022, T0 = t0 - 0.12;
    const rim = tint(boxes([[W, th, th, 0, 0, D / 2], [W, th, th, 0, 0, -D / 2], [th, th, D, W / 2, 0, 0], [th, th, D, -W / 2, 0, 0]]), 0xeaffff, g); rim.material.transparent = true;
    const cg = new THREE.CylinderGeometry(0.7071, 0.7071, 1, 4, 1, true); cg.rotateY(Math.PI / 4); cg.translate(0, -0.5, 0);
    { const ix = Array.from(cg.index.array), n = ix.length; for (let i = 0; i < n; i += 3) ix.push(ix[i], ix[i + 2], ix[i + 1]); cg.setIndex(ix); }   // 안쪽 면도 (양면 재료를 쓰지 않으려고)
    const cur = new THREE.Mesh(cg, mat(scanTex(), E.c[0])); cur.userData.own = true; cur.scale.set(W, 0.32, D); cur.renderOrder = 6; g.add(cur);
    add(g, t1 + 0.2 - T0, (e) => { const t = T0 + e.t, o = sstep(T0, t0, t) * (1 - sstep(t1, t1 + 0.2, t)); g.position.y = a.gp.y + scanY(t, t0, t1, up); rim.material.opacity = o; cur.material.opacity = o * 0.8; }, T0);
  }
  // 마우스 커서: path(t) 자리에 화살표 끝 · press(t) 누르는 동안 조금 작아짐 · 늘 위에
  function cursor(a, t0, t1, path, press) {
    const m = new THREE.Mesh(kit().vplane(), mat(cursorTex(), 0xffffff)), R = new THREE.Vector3(), U = new THREE.Vector3(); m.material.blending = THREE.NormalBlending; m.material.depthTest = false; m.renderOrder = 12;
    add(m, t1 - t0, (e) => { const t = t0 + e.t, c = path(t), s = 0.24 * (press(t) ? 0.84 : 1); loc(a, c[0], c[1], c[2], m.position); if (!CAM) return;
      m.quaternion.copy(CAM.quaternion); R.set(1, 0, 0).applyQuaternion(CAM.quaternion); U.set(0, 1, 0).applyQuaternion(CAM.quaternion); m.position.addScaledVector(R, 0.36 * s).addScaledVector(U, -0.44 * s);
      m.scale.setScalar(s); m.material.opacity = Math.min(1, e.t * 8, (t1 - t) * 8); }, t0);
  }
  // 딸깍: 커서 끝에서 번지는 작은 고리
  const click = (a, c, t) => at(t, () => { const m = card(loc(a, c[0], c[1], c[2], new THREE.Vector3()), tex().ring(), a.E.c[0], 0.3, (mm, u) => { mm.scale.setScalar(0.07 + 0.34 * eout(u)); mm.material.opacity = 1 - u; }, 0, true); m.material.depthTest = false; m.renderOrder = 12; });
  // 끌려오는 철사 상자 (아직 풀리지 않은 모델): 커서 끝을 따라 돌다가 놓는 순간 커지며 사라짐
  function prefab(a, t0, t1, path) {
    const g = new THREE.Group(), w = tint(new THREE.BoxGeometry(1, 1, 1), WIRE, g); w.material.wireframe = true; w.material.transparent = true; const c = tint(new THREE.BoxGeometry(0.8, 0.8, 0.8), CLAY, g); c.material.transparent = true;
    add(g, t1 + 0.1 - t0, (e) => { const t = t0 + e.t, p = path(t), o = t < t1 ? 1 : Math.max(0, 1 - (t - t1) / 0.1); loc(a, p[0], p[1], p[2], g.position); g.rotation.set(e.t * 2.2, e.t * 3.1, 0); g.scale.setScalar(0.3 * Math.min(1, e.t * 6) * (t < t1 ? 1 : 1 + (t - t1) * 16)); w.material.opacity = o; c.material.opacity = o * 0.9; }, t0);
  }
  // 단추 (▶ 실행 · ■ 정지): tIn 에 나타나 tHit 에 눌려 초록으로 바뀌고 tOut 에 사라짐
  function button(a, kind, tIn, tHit, tOut) {
    const m = card(loc(a, BTN[0], BTN[1], BTN[2], new THREE.Vector3()), btnTex(kind, false), 0xffffff, tOut - tIn, (mm, u, e) => { const t = tIn + e.t, hit = t >= tHit;
      if (hit && !mm.userData.hit) { mm.userData.hit = true; mm.material.map = btnTex(kind, true); }
      mm.scale.setScalar(Math.max(0.001, 0.3 * eout(seg(t, tIn, tIn + 0.14)) * (1 - ein(seg(t, tOut - 0.16, tOut))) * (hit ? 1 + 0.3 * Math.max(0, 1 - (t - tHit) / 0.2) : 1 + Math.sin(t * 7) * 0.04))); mm.material.opacity = 1; }, tIn, true);
    m.renderOrder = 9;
  }
  // 상태 꼬리표: 작은 어두운 판에 mesh · rig 확인 표시와 진행 막대 — st(t) → { a, b, p 0~1, done, label, fin } (바뀔 때만 다시 그림)
  function statusChip(a, t0, dur, st) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; const g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv); let sig = '';
    const m = new THREE.Mesh(kit().vplane(), mat(tx, 0xffffff)); m.material.blending = THREE.NormalBlending; m.userData.ownMap = true; m.renderOrder = 9; loc(a, -BTN[0], BTN[1], BTN[2] - 0.06, m.position);
    const chk = (x, y, on, txt) => { g.strokeStyle = g.fillStyle = on ? '#7dffb0' : '#55707c'; g.lineWidth = 4; g.beginPath(); if (on) { g.moveTo(x, y); g.lineTo(x + 6, y + 7); g.lineTo(x + 17, y - 8); } else g.arc(x + 8, y, 3, 0, TAU); g.stroke(); g.fillText(txt, x + 26, y + 1); };
    const draw = (s) => { g.clearRect(0, 0, 256, 112); g.fillStyle = 'rgba(5,18,30,0.88)'; g.fillRect(0, 0, 256, 112); g.lineWidth = 3; g.strokeStyle = s.done ? '#7dffb0' : '#4de8ff'; g.strokeRect(1.5, 1.5, 253, 109);
      g.font = 'bold 24px ' + CODEFONT; g.textBaseline = 'middle'; g.textAlign = 'left'; chk(14, 25, s.a, 'mesh'); chk(138, 25, s.b, 'rig');
      g.fillStyle = s.done ? '#7dffb0' : '#d9fbff'; g.fillText(s.done ? s.fin : s.label, 14, 58); g.textAlign = 'right'; g.fillText(Math.round(s.p * 100) + '%', 242, 58);
      g.fillStyle = 'rgba(77,232,255,0.22)'; g.fillRect(14, 80, 228, 16); g.fillStyle = s.done ? '#7dffb0' : '#4de8ff'; g.fillRect(14, 80, 228 * s.p, 16); tx.needsUpdate = true; };
    add(m, dur, (e, u) => { const s = st(t0 + e.t), k = (s.a ? 1 : 0) + '|' + (s.b ? 1 : 0) + '|' + Math.round(s.p * 25) + '|' + (s.done ? 1 : 0); if (k !== sig) { sig = k; draw(s); }
      if (CAM) m.quaternion.copy(CAM.quaternion); const v = eout(seg(e.t, 0, 0.14)) * (1 - ein(seg(u, 0.9, 1))); m.scale.set(0.66 * v + 0.001, 0.29 * v + 0.001, 1); }, t0);
  }
  // 허공의 자판: 가슴 앞에 화면 쪽으로 눕혀 뜸 · tHit(실행 키)에 번쩍이며 눌림
  function keyboard(a, t0, tHit, tOut) {
    const g = grpAt(a, KB.z), m = new THREE.Mesh(kit().vplane(), mat(kbdTex(), 0xffffff)); m.material.blending = THREE.NormalBlending; m.rotation.x = -KB.tilt; m.renderOrder = 7; g.add(m);
    add(g, tOut - t0, (e) => { const t = t0 + e.t, k = eout(seg(t, t0, t0 + 0.18)) * (1 - ein(seg(t, tOut - 0.2, tOut))), hit = Math.max(0, 1 - Math.abs(t - tHit) / 0.12);
      m.scale.set(0.78 * k + 0.001, 0.29 * (0.3 + 0.7 * k), 1); m.material.color.setScalar(1 + hit * 0.7); g.position.y = a.gp.y + KB.y - hit * 0.02; }, t0);
  }
  // 실행된 순간: 캐릭터 양옆에 꺾쇠 '<' 와 '/>' 가 가운데에서 벌어지며 서고(캐릭터가 <개발자 /> 의 알맹이가 됨) 등 뒤에 빛
  function tagMarks(a, t0, dur) {
    const E = a.E;
    card(loc(a, 0, 1.25, -0.3, new THREE.Vector3()), tex().glow(), E.c[0], dur, (m, u, e) => { const k = eout(seg(e.t, 0, 0.2)) * (1 - sstep(0.75, 1, u)); m.scale.setScalar(3.2 * k + 0.01); m.material.opacity = 0.5 * k; }, t0);
    for (const [i, s] of [[0, -1], [1, 1]]) card(new THREE.Vector3(), brkTex(i), 0xffffff, dur, (m, u, e) => { const k = eout(seg(e.t, 0, 0.22));
      loc(a, s * lerp(0.2, i ? 0.72 : 0.6, k), 1.2 + Math.sin(e.t * 3 + i) * 0.012, 0.06, m.position); m.scale.setScalar(0.86 * k * (1 + 0.25 * Math.max(0, 1 - e.t / 0.25)) + 0.01); m.material.opacity = 1 - sstep(0.8, 1, u); }, t0, true);
  }
  // 코드 글자가 자판에서 터져 나와 포물선으로 흩어짐
  function glyphs(a, n, t0, from) {
    at(t0, () => { const E = a.E, c0 = loc(a, from[0], from[1], from[2], new THREE.Vector3()), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw);
      for (let i = 0; i < n; i++) { const an = rnd(-1.3, 1.3), sp = rnd(1.3, 3.1), vx = Math.sin(an) * sp, vz = rnd(-0.3, 0.9), v = new THREE.Vector3(cy * vx + sy * vz, rnd(2.4, 4.4), -sy * vx + cy * vz), s = rnd(0.17, 0.27), spin = rnd(-4, 4);
        card(c0.clone(), glyTex((i + ((Math.random() * 3) | 0)) % GLY.length), pk(E), rnd(1.0, 1.5), (m, u, e) => { v.y -= e.dt * 6.5; m.position.addScaledVector(v, e.dt); m.scale.setScalar(s * Math.min(1, u * 8) + 0.001); m.rotateZ(spin * e.t); m.material.opacity = u < 0.75 ? 1 : (1 - u) / 0.25; }, i * 0.012, true); } });
  }
  // 명령 줄 이름 띠: '> 명령' 이 타자 치듯 찍히고(tType 초 동안), tRun 에 실행되어 이름 띠 <개발자 /> 로 바뀜 (tRun 이 없으면 명령 줄인 채로 사라짐)
  function cmdLabel(a, delay, dur, cmd, tType, tRun) {
    const E = a.E; let n = -1, ran = false;
    label(E, a.gp, delay, dur, { cls: 'dev', html: '<span class="eb-cmd"><em>&gt;</em><u></u><s></s></span>', upd(el, t) {
      if (tRun != null && t >= tRun) { if (!ran) { ran = true; el.innerHTML = `<i></i><b><span>&lt;</span>${nameOf(E)}<span> /&gt;</span></b><i></i>`; } return; }
      const k = Math.min(cmd.length, Math.floor(cmd.length * clamp(t / tType, 0, 1))); if (k !== n) { n = k; const u = el.querySelector('u'); if (u) u.textContent = cmd.slice(0, k); } } });
  }
  // ----- 재질 없는 모델 (덩어리 + 철사) -----
  const IDM = new THREE.Matrix4(), WG = new WeakMap();
  let clipN = 0, devWarm = null;
  const clipUse = (d) => { clipN = Math.max(0, clipN + d); if (G.renderer) G.renderer.localClippingEnabled = clipN > 0; };   // 자르는 면은 이 연출이 도는 동안만 켠다
  const holoMat = (plane, wire) => new THREE.MeshBasicMaterial(wire ? { color: WIRE, skinning: true, wireframe: true, clippingPlanes: [plane] } : { color: CLAY, skinning: true, clippingPlanes: [plane], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  // 진짜 몸의 재료를 본뜬 것 + 자르는 면 — 같은 셰이더에 '자르는 면 하나'가 붙은 변형 (warmDev 가 미리 만들어 둔다)
  const bodyMat = (base, plane) => { const m = base.clone(); m.clippingPlanes = [plane]; return m; };
  // 철사 도형: 간략 모델에서 꺾인 모서리(이웃한 두 면이 WIRE_COS 보다 많이 꺾임)와 끝 모서리만 — 삼각형을 전부 그리면 멀리서는 그냥 색 덩어리로 보인다
  //  뼈대를 따라 움직이게 원래 도형의 꼭짓점·가중치를 그대로 쓰고, 모서리마다 납작한 삼각형(a, b, b)을 넣어 '철사 그리기'로 선만 나오게 한다 (외형마다 한 번)
  const WIRE_COS = 0.955;
  function wireGeo(src) {
    let g = WG.get(src); if (g) return g;
    const pos = src.attributes.position, ix = src.index ? src.index.array : null, nT = (ix ? ix.length : pos.count) / 3, weld = new Map(), id = new Int32Array(pos.count), ED = new Map(), out = [];
    for (let i = 0; i < pos.count; i++) { const k = Math.round(pos.getX(i) * 2000) + ',' + Math.round(pos.getY(i) * 2000) + ',' + Math.round(pos.getZ(i) * 2000); let v = weld.get(k); if (v === undefined) { v = i; weld.set(k, i); } id[i] = v; }   // 같은 자리의 꼭짓점은 하나로 (이음매)
    for (let t = 0; t < nT; t++) { const A = ix ? ix[t * 3] : t * 3, B = ix ? ix[t * 3 + 1] : t * 3 + 1, C = ix ? ix[t * 3 + 2] : t * 3 + 2;
      _a.fromBufferAttribute(pos, A); _b.fromBufferAttribute(pos, B); _c.fromBufferAttribute(pos, C); _d.subVectors(_b, _a); _e.subVectors(_c, _a); _d.cross(_e); if (_d.lengthSq() < 1e-14) continue; _d.normalize();
      for (const [p, q] of [[A, B], [B, C], [C, A]]) { const u = id[p], v = id[q]; if (u === v) continue; const k = u < v ? u * 1e6 + v : v * 1e6 + u, e = ED.get(k); if (e) { e.n++; e.d = Math.min(e.d, e.x * _d.x + e.y * _d.y + e.z * _d.z); } else ED.set(k, { p, q, n: 1, d: 1, x: _d.x, y: _d.y, z: _d.z }); } }
    for (const e of ED.values()) if (e.n === 1 || e.d < WIRE_COS) out.push(e.p, e.q, e.q);
    g = new THREE.BufferGeometry(); for (const k of ['position', 'skinIndex', 'skinWeight']) g.setAttribute(k, src.attributes[k]); g.setIndex(out); g.boundingSphere = src.boundingSphere; WG.set(src, g); return g;
  }
  // 캐릭터에 '재질 없는 모델'을 겹쳐 건다: 간략 모델의 남색 덩어리 + 청록 철사는 자르는 면 위쪽만, 진짜 몸은 아래쪽만 그린다 (끝나면 fin 이 되돌림)
  function holo(a) {
    const r = a.rig, up = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), dn = new THREE.Plane(new THREE.Vector3(0, -1, 0), 999), clay = holoMat(up, false), wire = holoMat(up, true), base = r.mesh.material, body = bodyMat(base, dn), lo = r.meshLo.geometry;
    const ms = [[lo, clay], [wireGeo(lo), wire]].map(([geo, mt], i) => { const m = new THREE.SkinnedMesh(geo, mt); m.bind(r.skel, IDM); m.frustumCulled = false; m.visible = false; m.renderOrder = i; r.root.add(m); return m; });
    const gear = [r.helmet, r.hat, r.vest, r.pack, r.vestL, r.vestR].filter(Boolean).map((g) => ({ g, v: g.visible, y: g === r.helmet || g === r.hat ? 1.8 : 1.5, on: true }));
    r.mesh.material = body; clipUse(1);
    a.fin.push(() => { for (const m of ms) if (m.parent) m.parent.remove(m); clay.dispose(); wire.dispose(); if (r.mesh.material === body) r.mesh.material = base; body.dispose(); for (const q of gear) q.g.visible = q.v; clipUse(-1); });
    a.holo = { up, dn, ms, gear };
  }
  // y(발바닥 기준) 위쪽이 재질 없는 모델 · on: 모델을 쓰는 중인가 · 장비(조끼·가방·헬멧)는 면이 그 높이를 지나야 보이고, 달리는 순간 반짝
  function holoCut(a, y, on) {
    const H = a.holo; if (!H || a.dead) return; const h = on ? a.gp.y + y : 999, show = on && y < 2.05; H.up.constant = -h; H.dn.constant = h; for (const m of H.ms) m.visible = show;
    for (const q of H.gear) { const vis = !on || y > q.y; if (vis && !q.on && q.v) { q.g.getWorldPosition(_c); glow(_c, 0xffffff, 0.7, 0.25); burst(_c, a.E, 8, 1.2, { sq: 1, g: 0 }); } q.on = vis; q.g.visible = q.v && vis; }
  }
  // 개발자 연출 재료를 미리 한 번 그려 둔다 (관리자 계정 · 관리자 파티원이 보일 때만): 그림 올리기 + '자르는 면'이 붙은 셰이더 둘(덩어리·진짜 몸)
  function warmDev(L) {
    if (devWarm || !L || !L.scene || !L.rig || !L.rig.root.parent || !G.renderer) return;
    const rg = L.rig, pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -999), tmp = [new THREE.SkinnedMesh(rg.meshLo.geometry, holoMat(pl, false)), new THREE.SkinnedMesh(rg.mesh.geometry, bodyMat(rg.mesh.material, pl))];
    devWarm = tmp.map((m) => m.material);   // 재료는 버리지 않는다 (프로그램 유지)
    for (const m of tmp) { m.bind(rg.skel, IDM); m.frustumCulled = false; rg.root.add(m); }
    const g = kit().geo(), grp = new THREE.Group();
    for (const t of [gridTex, cursorTex, kbdTex, dsigTex, scanTex, () => brkTex(0), () => brkTex(1), () => btnTex('play', false), () => btnTex('play', true), () => btnTex('stop', false), () => btnTex('stop', true), ...GLY.map((_, i) => () => glyTex(i))]) { const o = new THREE.Mesh(g.plane, mat(t(), 0)); o.frustumCulled = false; o.material.opacity = 0; o.scale.setScalar(0.001); grp.add(o); }
    grp.position.copy(L.cam.position).add(_a.set(0, 0, -1).applyQuaternion(L.cam.quaternion)); L.scene.add(grp);
    const R = G.renderer, clip = R.localClippingEnabled, vis = rg.root.visible; R.localClippingEnabled = true; rg.root.visible = true;
    try { R.render(L.scene, L.cam); } catch (e) { /* 처음 그릴 때 */ }
    R.localClippingEnabled = clip; rg.root.visible = vis; for (const m of tmp) rg.root.remove(m); L.scene.remove(grp);
  }
  MOT.devIn = { kind: 'in', dur: 6.3, keys: [[0, 'tpose'], [DV.play, 'tpose'], [DV.play + 0.3, 'lookHands', 0.3, 4], [3.78, 'lookHands'], [DV.type, 'type', 0.3], [4.6, 'type'], [4.74, 'enterUp', 0.14], [DV.enter + 0.02, 'enterHit', 0.08], [5.0, 'enterHit'], [5.32, 'crossNod', 0.32], [5.85, 'crossNod']],
    body(t, B) { B.vis = t > DV.drop; if (t < DV.drop + 0.24) { const u = seg(t, DV.drop, DV.drop + 0.24); B.s = 0.55 + 0.45 * eout(u) + Math.sin(Math.PI * u) * 0.07; } else if (t > DV.play && t < DV.play + 0.2) B.y = 0.04 * Math.sin((t - DV.play) / 0.2 * Math.PI); },   // 놓는 순간 통 튀며 커짐 · ▶ 에 움찔
    fx(a) {
      const E = a.E, gp = a.gp, cur = DVP.in; warmDev(LOB); holo(a);
      grid(a, 0, 6.2, [DV.drop, DV.s1, DV.play, DV.enter]);
      // 끌어다 놓기
      prefab(a, 0.05, DV.drop, cur); cursor(a, 0.05, DV.play + 0.3, cur, (t) => t < DV.drop || (t > DV.s0 && t < DV.s1) || Math.abs(t - DV.play) < 0.07);
      click(a, cur(DV.drop), DV.drop); ring(gp, E.c[0], 2.2, 0.5, DV.drop, sqTex()); shake(0.03, DV.drop);
      selBox(a, DV.drop, DV.play + 0.3 - DV.drop, (t) => { const out = seg(t, DV.play, DV.play + 0.3); return [0, DVB.H / 2, 0, eout(seg(t, DV.drop, DV.drop + 0.16)) * (1 + 0.12 * Math.sin(Math.PI * seg(t, DV.drop, DV.drop + 0.28))) * (1 + 0.55 * eout(out)), t > DV.s1 && t < DV.play ? E.c[1] : E.c[0], 1 - out]; });
      gizmo(a, DV.drop + 0.05, DV.play);
      statusChip(a, DV.drop + 0.08, DV.play + 0.22 - DV.drop, (t) => ({ a: t > DV.drop + 0.16, b: t > DV.drop + 0.28, p: seg(t, DV.s0, DV.s1), done: t >= DV.s1, label: 'tex', fin: 'build OK' }));
      // 텍스처 훑기
      scanFrame(a, DV.s0, DV.s1, true); click(a, cur(DV.s0), DV.s0);
      at(DV.s1, () => { ring(gp, E.c[1], 1.6, 0.45, 0, sqTex()); loc(a, 0, 1.95, 0, _c); glow(_c, 0xffffff, 1.6, 0.3); });
      // ▶ 실행
      button(a, 'play', DV.s1 + 0.06, DV.play, DV.play + 0.3); click(a, BTN, DV.play);
      flash(1.4, 0.3, DV.play); shake(0.04, DV.play); ring(gp, E.c[1], 3.0, 0.7, DV.play, sqTex()); ring(gp, E.c[2], 1.7, 0.45, DV.play + 0.03, sqTex());
      at(DV.play, () => { chestW(a.rig, _c); glow(_c, E.c[1], 3.2, 0.4); burst(_c, E, 46, 3.6, { sq: 1, g: 0 }); });
      // 자판 · 명령 줄 · 실행 키
      keyboard(a, DV.type - 0.25, DV.enter, 5.2);
      cmdLabel(a, DV.type - 0.12, 6.2 - (DV.type - 0.12), `party.join("${nameOf(E)}")`, 0.62, DV.enter - (DV.type - 0.12));
      tagMarks(a, DV.enter, 1.3); glyphs(a, 14, DV.enter, [0, KB.y + 0.05, KB.z]);
      ring(gp, E.c[0], 3.2, 0.75, DV.enter, sqTex()); ring(gp, E.c[1], 1.9, 0.5, DV.enter + 0.04, sqTex()); sigil(gp, dsigTex(), 3.0, 1.38, E.c[0], 0.5, DV.enter); flash(1.6, 0.35, DV.enter); shake(0.08, DV.enter);
      at(DV.enter, () => { loc(a, 0, KB.y, KB.z, _c); glow(_c, 0xffffff, 2.2, 0.3); burst(_c, E, 60, 4.2, { sq: 1, g: -3 });
        const Q = P(); for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU + rnd(-0.1, 0.1), rr = rnd(0.75, 1.05), x = gp.x + Math.cos(an) * rr, z = gp.z + Math.sin(an) * rr, c = i % 3 ? E.c[1] : E.c[0], v = rnd(2.6, 3.6);   // 둘레에서 솟는 코드 줄기 (네모 조각이 줄지어 올라감)
          for (let k = 0; k < 6; k++) EM(Q, _b.set(x, gp.y + 0.05 + k * 0.13, z), 0, v, 0, c, 0.04, 0.5 + k * 0.03, { sq: 1, so: 0.75, g: 0, drag: 1.2 }); } });
    },
    tick(a, r, t, dt) {
      const Q = P(), E = a.E; holoCut(a, t < DV.s0 ? -0.06 : scanY(t, DV.s0, DV.s1, true), t < DV.s1 + 0.02);
      if (t > DV.s0 && t < DV.s1) {   // 사방에서 날아와 훑는 틀에 꽂히는 자료 조각 + 단면에서 튀는 빛
        const y = scanY(t, DV.s0, DV.s1, true), n = Math.ceil(dt * 80);
        for (let i = 0; i < n; i++) { const s = Math.random() < 0.5 ? -1 : 1, side = Math.random() < 0.3, an = Math.random() * TAU, rr = rnd(1.1, 1.7), L = rnd(0.28, 0.45);
          loc(a, side ? s * CORNER[0] : rnd(-0.9, 0.9), y, side ? rnd(-0.3, 0.3) : s * CORNER[2], _b); _a.set(a.gp.x + Math.cos(an) * rr, a.gp.y + y + rnd(-0.5, 0.7), a.gp.z + Math.sin(an) * rr);
          EM(Q, _a, (_b.x - _a.x) / L, (_b.y - _a.y) / L, (_b.z - _a.z) / L, pk(E), rnd(0.03, 0.05), L, { sq: 1, so: 0.85, g: 0, drag: 0 }); }
        if (Math.random() < dt * 60) { loc(a, rnd(-0.28, 0.28) * (y > 1.32 && y < 1.6 ? 3 : 1), y, rnd(-0.14, 0.14), _b); EM(Q, _b, 0, rnd(0.1, 0.4), 0, 0xffffff, rnd(0.025, 0.045), rnd(0.15, 0.3), { sq: 1, so: 0.5, g: 0 }); }
      } else if (t > DV.type - 0.05 && t < DV.enter - 0.2) { if (Math.random() < dt * 34) { const v = rnd(-0.09, 0.09); loc(a, rnd(-0.27, 0.27), KB.y + v * Math.cos(KB.tilt), KB.z - v * Math.sin(KB.tilt), _b); EM(Q, _b, 0, 0.25, 0, Math.random() < 0.3 ? E.c[1] : 0xffffff, 0.035, 0.14, { sq: 1, so: 0.6, g: 0 }); } }   // 눌린 자판이 반짝
      else if (t > DV.enter && t < 6.0 && Math.random() < dt * 26) { const an = Math.random() * TAU, rr = rnd(0.3, 1.2); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), 0, rnd(0.5, 1.3), 0, pk(E), rnd(0.025, 0.045), rnd(0.8, 1.4), { sq: 1, so: 0.7, g: 0 }); }
    } };
  MOT.devOut = { kind: 'out', dur: 3.9, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.62, 'devBye', 0.3], [1.3, 'devBye'], [DX.stop + 0.25, 'tpose', 0.25, 3]],
    body(t, B) { if (t > DX.grab) { const s = mini(t); B.s = s.s; B.x = s.x; B.y = s.y; B.z = s.z; B.vis = t < DX.gone; } },
    fx(a) {
      const E = a.E, gp = a.gp, cur = DVP.out; warmDev(LOB); holo(a);
      cmdLabel(a, 0.35, 3.3, 'party.leave()', 0.7);
      // ■ 정지 → 편집 상태로
      button(a, 'stop', 0.9, DX.stop, DX.stop + 0.3); cursor(a, 0.9, DX.gone + 0.1, cur, (t) => Math.abs(t - DX.stop) < 0.07 || (t > DX.s0 && t < DX.s1) || t > DX.grab); click(a, BTN, DX.stop);
      envFx(0.45, (u) => { const k = 1 - 0.22 * (1 - u); return [k, k]; }, DX.stop); ring(gp, E.c[0], 2.6, 0.6, DX.stop, sqTex()); shake(0.03, DX.stop);
      grid(a, DX.stop - 0.08, 3.85 - (DX.stop - 0.08), [DX.stop, DX.s1, DX.gone]);
      selBox(a, DX.stop, DX.gone - DX.stop, (t) => { const s = mini(t); return [s.x, s.y + DVB.H / 2 * s.s, s.z, s.s * eout(seg(t, DX.stop, DX.stop + 0.16)), t > DX.s1 ? E.c[1] : E.c[0], 1 - sstep(DX.gone - 0.12, DX.gone, t)]; });
      gizmo(a, DX.stop + 0.05, DX.grab);
      statusChip(a, DX.stop + 0.1, DX.grab + 0.1 - DX.stop, (t) => ({ a: true, b: true, p: 1 - seg(t, DX.s0, DX.s1), done: t >= DX.s1, label: 'tex', fin: 'unloaded' }));
      // 텍스처 벗기기 → 집어서 끌고 나감
      scanFrame(a, DX.s0, DX.s1, false); click(a, cur(DX.s0), DX.s0); click(a, cur(DX.grab), DX.grab);
      at(DX.gone, () => { const c = cur(DX.gone); loc(a, c[0], c[1], c[2], _c); glow(_c, E.c[2], 1.4, 0.3); ring(gp, E.c[0], 1.6, 0.5, 0, sqTex()); });
      // 빈자리에 글자 커서만 깜빡
      const car = tint(new THREE.BoxGeometry(0.05, 0.36, 0.012), E.c[0], null); car.rotation.y = a.yaw; loc(a, 0, 0.95, 0, car.position); add(car, 0.55, (e) => { car.visible = Math.sin(e.t * 20) > -0.2; }, DX.gone);
    },
    tick(a, r, t, dt) {
      holoCut(a, t < DX.s0 ? 2.1 : scanY(t, DX.s0, DX.s1, false), t > DX.stop);
      if (t > DX.s0 && t < DX.s1) {   // 벗겨진 조각이 훑는 틀에서 밖으로 흩어짐
        const Q = P(), E = a.E, y = scanY(t, DX.s0, DX.s1, false), n = Math.ceil(dt * 70);
        for (let i = 0; i < n; i++) { const s = Math.random() < 0.5 ? -1 : 1, side = Math.random() < 0.3, x = side ? s * CORNER[0] : rnd(-0.9, 0.9), z = side ? rnd(-0.3, 0.3) : s * CORNER[2]; loc(a, x, y, z, _b); loc(a, x * 2.2, y + rnd(-0.2, 0.9), z * 3.5, _a);
          EM(Q, _b, (_a.x - _b.x) * 2.2, (_a.y - _b.y) * 2.2, (_a.z - _b.z) * 2.2, pk(E), rnd(0.03, 0.05), rnd(0.3, 0.5), { sq: 1, so: 0.85, g: 0, drag: 1.5 }); }
      }
    } };
  // ===== 작별 몸짓 (내가 파티에서 나왔을 때 내 캐릭터): 대상의 몸짓 + 바닥 문양 · 위로 흩어지는 빛 =====
  function byeMot(g) { return { kind: 'bye', dur: 2.4, keys: [[0, 'stand'], [0.4, g, 0.4], [1.8, g], [2.1, 'stand', 0.3]],
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 2.2, 2.2, E.c[0], 0.6, 0.1); ring(gp, E.c[0], 2.0, 0.6, 0.45); glow(hipsAt(a, 0.7).clone(), E.c[2], 2.4, 0.4, 0.45); label(E, gp, 0.3, 1.9);
      at(0.45, () => { const Q = P(); for (let i = 0; i < 40; i++) { const an = Math.random() * TAU, rr = rnd(0.2, 0.9); EM(Q, _a.set(gp.x + Math.cos(an) * rr, gp.y + 0.1, gp.z + Math.sin(an) * rr), 0, rnd(0.8, 2.2), 0, pk(E), rnd(0.03, 0.055), rnd(0.8, 1.4), { drag: 0.6, so: 0.5 }); } }); } }; }
  // 퇴장 미리 보기 뒤 내 캐릭터가 다시 나타남: 빛 속에서 작게 → 원래 크기
  MOT.back = { kind: 'in', dur: 1.0, keys: [[0, 'stand']], body(t, B) { B.s = Math.max(0.01, eout(seg(t, 0.05, 0.45))); B.vis = t > 0.05; },
    fx(a) { const E = a.E, gp = a.gp; glow(hipsAt(a, 0.9).clone(), E.c[2], 2.4, 0.4); ring(gp, E.c[0], 1.6, 0.5);
      at(0.05, () => { const Q = P(); for (let i = 0; i < 26; i++) { const an = Math.random() * TAU; EM(Q, hipsAt(a, rnd(0.2, 1.2)), Math.cos(an) * rnd(0.6, 1.6), rnd(0.2, 1.2), Math.sin(an) * rnd(0.6, 1.6), pk(E), rnd(0.025, 0.05), rnd(0.4, 0.8), { drag: 2, so: 0.5 }); } }); } };
  // 손목 자리 (s = -1 오른손 · +1 왼손)
  function hand0(a, out, s = -1) { const r = a.rig; return (s < 0 ? r.armR : r.armL).hand.getWorldPosition(out); }

  // ---------- 재생 ----------
  const AN = new Map();   // 'me' | uid → 재생 상태
  const GH = [];          // 퇴장 중인 유령 리그
  function rigOf(L, k, a) { return a.ghost || (k === 'me' ? L.rig : (L.mates || []).find((m) => m.uid === k)); }
  function play(L, k, E, dir, rig) {
    const mo = E.mo[dir === 'in' ? 0 : dir === 'out' ? 1 : 2], M = dir === 'back' ? MOT.back : dir === 'bye' ? byeMot(mo) : MOT[mo]; if (!M || !rig) return;
    const old = AN.get(k); if (old) stop(L, k, old);
    SC = L.scene; CAM = L.cam; LOB = L;
    const p = rig.root.position, a = { k, E, M, dir, t: 0, rig, yaw: rig.baseYaw != null ? rig.baseYaw : 0.3, gp: { x: p.x, y: p.y, z: p.z, snow: p.y < 0.05 && typeof WINTER !== 'undefined' && WINTER.on() }, o: { t: 0 }, ghost: dir === 'out' && k !== 'me' ? rig : null, back: dir === 'out' && k === 'me', gunShown: false, fin: [] };
    AN.set(k, a); M.fx(a);
    if (typeof Audio !== 'undefined' && Audio.partyFx) Audio.partyFx(dir === 'bye' || dir === 'back' ? 'bye' : mo);
  }
  // 동작이 리그에 걸어 둔 것(철사 모델 · 바꿔 낀 재료 · 숨긴 장비)을 되돌린다 — 끝났을 때 · 중간에 끊겼을 때 · 리그가 사라졌을 때
  function fin(a) { a.dead = true; const F = a.fin; a.fin = []; for (const f of F || []) { try { f(); } catch (e) { /* */ } } }
  function stop(L, k, a) { fin(a); const r = rigOf(L, k, a); if (r) { r.body.scale.set(1, 1, 1); r.gunMount.visible = true; } if (a.ghost) dropGhost(L, a.ghost); AN.delete(k); }
  function dropGhost(L, g) { const i = GH.indexOf(g); if (i >= 0) GH.splice(i, 1); if (g.root.parent) g.root.parent.remove(g.root); g.skel.dispose(); }
  // 한 프레임: 이미 쉬는 자세(Lobby.pose)가 놓인 리그 위에 동작을 덮어 쓴다
  function drive(a, r, dt) {
    a.t += dt; const t = a.t, M = a.M, K = M.keys; a.rig = r;
    grab(r, IDL); const iy = r.root.rotation.y;
    const B = Object.assign(BB, B0); if (M.body) M.body(t, B, a);
    let i = 0; while (i < K.length - 1 && t >= K[i + 1][0]) i++;
    const k0 = K[i], k1 = K[i + 1]; let w = 0;
    if (k1) { const b = k1[2] || 0.35; w = sstep(k1[0] - b, k1[0], t); if (k1[3]) w = stepQ(w, k1[3]); }   // 넷째 값: 몇 칸으로 끊어 넘어갈지 (뚝뚝 끊기는 '애니메이션 시작')
    r.root.rotation.y = a.yaw; a.o.t = t;
    if (!k1 || w <= 0) evalKey(r, k0[1], B, a.o); else if (w >= 1) evalKey(r, k1[1], B, a.o);
    else { evalKey(r, k0[1], B, a.o); grab(r, KA); evalKey(r, k1[1], B, a.o); mixTo(r, KA, 1 - w); }
    // 쉬는 자세와 섞기: 입장은 끝에서, 퇴장·작별은 처음에서(작별은 끝에서도)
    const wI = M.kind === 'in' ? sstep(M.dur - 0.55, M.dur - 0.05, t) : M.kind === 'out' ? 1 - sstep(0, 0.3, t) : Math.max(1 - sstep(0, 0.3, t), sstep(M.dur - 0.45, M.dur - 0.05, t));
    if (wI > 0) { mixTo(r, IDL, wI); r.root.rotation.y = a.yaw + angleDiff(a.yaw, iy) * wI; r.body.position.multiplyScalar(1 - wI); r.body.rotation.set(r.body.rotation.x * (1 - wI), r.body.rotation.y * (1 - wI), r.body.rotation.z * (1 - wI)); r.body.scale.lerp(_a.set(1, 1, 1), wI); }
    const gun = wI > 0.5; r.gunMount.visible = gun;
    if (gun && !a.gunShown && M.kind !== 'out') { a.gunShown = true; if (r.gunObj && r.gunObj.userData.skin) GunSkin.draw(r.gunObj, 0.55, null, true); }
    if (!B.vis && wI < 0.5) r.root.visible = false;
    if (M.tick && SC) M.tick(a, r, t, dt);
  }

  // ---------- 로비 연동 ----------
  //  Lobby.setTeam 이 파티원 리그를 다시 만들기 전에 부른다: 들어온·나간 사람을 가려 연출을 정한다 (가운데 = 나)
  let lastIds = null, lastPid = null, pend = [];
  const fresh = () => G.state === 'lobby' && performance.now() - alive < 1500;   // 로비가 돌고 있을 때만 (경기에서 돌아온 직후 지난 변화는 연출하지 않음)
  function team(L, infos) {
    const pid = typeof Party !== 'undefined' ? Party.id() : null, ids = new Map();
    for (const f of infos || []) if (f && f.uid) ids.set(f.uid, f);
    const prev = lastIds, ok = fresh() && !L.sc; lastIds = ids; pend = [];
    if (ids.size && typeof Cloud !== 'undefined' && Cloud.staffAsk) { Cloud.staffAsk([...ids.keys()]); if (fresh()) for (const f of ids.values()) if ((Array.isArray(f.ent) ? f.ent : [f.ent]).includes('dev')) { warmDev(L); break; } }   // 파티원이 관리자인지 미리 물어 두고, 개발자 연출 재료도 미리 그려 둠 (로비가 돌고 있을 때만 — 경기 화면에 로비를 그리지 않게)
    const gone = new Map();
    if (ok && prev && pid && pid === lastPid) {
      for (const [u, f] of ids) if (!prev.has(u)) { if (unsure(f)) { pend.push([u, null, 'wait', f]); continue; } const E = valid(f.ent, f.name, u); if (E) pend.push([u, E]); }
      for (const [u, f] of prev) if (!ids.has(u)) { const E = valid(f.ent, f.name, u); if (E) gone.set(u, E); }
    }
    if (ok && pid && pid !== lastPid && !Party.isLeader()) { const E = mineE(); if (E) pend.push(['me', E, 'in']); }   // 내가 남의 파티에 들어감
    if (ok && lastPid && !pid) { const E = mineE(); if (E) pend.push(['me', E, 'bye']); }   // 내가 파티에서 나옴
    lastPid = pid;
    return gone;
  }
  // 나간 파티원의 리그를 넘겨받아 퇴장 연출 (없으면 false → 부른 쪽이 정리)
  function ghost(L, rig, E) { if (!E || !rig) return false; GH.push(rig); play(L, rig.uid, E, 'out', rig); return true; }
  // 새 리그가 만들어진 뒤: 같은 uid 의 유령은 바로 치우고, 들어온 사람은 입장
  function bound(L) {
    for (const m of L.mates) { const a = AN.get(m.uid); if (m.uid && a && a.ghost) stop(L, m.uid, a); }
    for (const [u, E, dir, f] of pend) { if (u === 'me') play(L, 'me', E, dir, L.rig); else { const r = L.mates.find((m) => m.uid === u); if (!r) continue; if (dir === 'wait') { WAIT.set(u, { f, t: 0 }); r.root.visible = false; } else play(L, u, E, 'in', r); } }
    pend = [];
  }
  // 관리자인지 확인을 기다리는 입장 (uid → { f 파티 정보, t 기다린 시간 }): 답이 오면(또는 2.5초가 지나면) 확인된 연출로 입장 — 그동안 그 캐릭터는 숨김
  const WAIT = new Map();
  function tickWait(dt, L) {
    for (const [u, w] of WAIT) {
      const r = (L.mates || []).find((m) => m.uid === u); if (!r) { WAIT.delete(u); continue; }
      w.t += dt;
      if (!unsure(w.f) || w.t > 2.5) { WAIT.delete(u); const E = valid(w.f.ent, w.f.name, u); if (E) play(L, u, E, 'in', r); }
      else r.root.visible = false;
    }
  }
  // 파티원 자리: uid 마다 한 번 정하면 그대로 (나간 사람 유령과 겹치지 않게 빈자리부터)
  const SPOT = new Map();
  function spot(uid, i, n) {
    const used = new Set(); for (const [u, s] of SPOT) if (u !== uid && ((lastIds && lastIds.has(u)) || GH.some((g) => g.uid === u))) used.add(s);
    if (uid && SPOT.has(uid) && SPOT.get(uid) < n && !used.has(SPOT.get(uid))) return SPOT.get(uid);
    // 빈자리부터 — uid 없는 자리(혼자 듀오·스쿼드의 빈 팀원)도 퇴장 중인 유령 자리는 피해 i 번째 빈자리에
    let k = 0; for (let s = 0; s < n; s++) { if (used.has(s)) continue; if (!uid) { if (k++ === i) return s; continue; } SPOT.set(uid, s); return s; }
    if (uid) SPOT.set(uid, i); return i;
  }
  function update(dt, L) {
    const now = performance.now(); if (alive && now - alive > 1500 && (AN.size || LIVE.length || BAN.length)) clear(L);   // 경기·숨긴 탭에서 돌아옴: 하다 만 연출은 끝냄
    alive = now; SC = L.scene; CAM = L.cam; LOB = L;
    if (!warmed) warm(L);
    if (!devWarm && myRole()) warmDev(L);   // 관리자 계정: 개발자 연출 재료도 미리 (로그인이 끝난 뒤 한 번)
    P();   // 로비 입자 풀을 계속 써 둔다 (안 쓰면 치워졌다가 다음 연출 때 셰이더를 다시 만들어 멈칫함)
    if (L.sc) { clear(L); return; }   // 상점 진열 중: 모두 그만
    if (WAIT.size) tickWait(dt, L);
    for (const [k, a] of AN) {
      const r = rigOf(L, k, a);
      if (!r || !r.root.parent) { fin(a); AN.delete(k); if (a.ghost) dropGhost(L, a.ghost); continue; }
      if (a.ghost) { L.pose(r, L.t + (r.ph || 0), r.baseYaw || 0); r.root.visible = L.fk < 0.5; }
      drive(a, r, dt);
      if (a.t >= a.M.dur) { stop(L, k, a); if (a.back) play(L, 'me', a.E, 'back', L.rig); }   // 퇴장 미리 보기: 사라진 내 캐릭터가 다시 나타남 (같은 프레임에 이어서 돌아 깜빡이지 않음)
    }
    tickFx(dt); tickEnv(dt, L); tickBan(dt);
    for (const [u] of SPOT) if (!(lastIds && lastIds.has(u)) && !GH.some((g) => g.uid === u)) SPOT.delete(u);
  }
  function clear(L) { WAIT.clear(); for (const [k, a] of [...AN]) stop(L, k, a); for (const b of BAN) b.el.remove(); BAN.length = 0; for (const e of LIVE) if (e.o) { if (e.o.parent) e.o.parent.remove(e.o); free(e.o); } LIVE.length = 0; ENV.length = 0; tickEnv(0, L); }
  // 카메라 흔들림 (Lobby.update 끝에서)
  function cam(c, dt) { if (SHK < 0.002) { SHK = 0; return; } c.position.x += (Math.random() - 0.5) * SHK; c.position.y += (Math.random() - 0.5) * SHK; SHK *= Math.pow(0.015, dt); }
  // 미리 보기: 내 캐릭터로 입장(in)·작별(bye) — 계정 창에서
  function preview(id, dir = 'in') { const E = withRole(byId(id), myRole()), L = LOB || (typeof Lobby !== 'undefined' ? Lobby : null); if (!E || !L || !L.rig) return false; play(L, 'me', E, dir, L.rig); return true; }

  // ---------- 계정 창 탭: 입장 연출 고르기 ----------
  function profTab(B) {
    const cur = pref(), act = mine(), list = ENT.filter((E) => avail(E) && (!E.staff || ok(E)));   // 관리자 전용 연출은 관리자 계정에만 보인다
    const head = document.createElement('p'); head.className = 'micro'; head.textContent = '새 티어(노바·셀레스티얼·이클립스·제니스)나 어려운 칭호를 가진 사람은 파티에 들어오고 나갈 때 로비에서 캐릭터가 직접 등장·퇴장합니다. 같은 파티 모두의 화면에 보입니다.' + (myRole() ? ` ${nameOf(ENT[0])} 계정은 전용 연출과 함께 모든 연출을 가지고 있습니다.` : ''); B.appendChild(head);
    const L = document.createElement('div'); L.className = 'prof-ti ent-list';
    const row = (key, title, sub, on, lock, onClick, prev) => {
      const b = document.createElement('div'); b.className = 'ti-row ent-row' + (on ? ' on' : '') + (lock ? ' lock' : ''); b.tabIndex = 0;
      b.innerHTML = `<span class="ent-name">${title}</span><span class="ti-d"><b>${sub[0]}</b><small>${sub[1]}</small></span>`;
      b.onclick = onClick;
      if (prev) { const w = document.createElement('div'); w.className = 'ent-prevs'; for (const [t, d] of [['입장 미리 보기', 'in'], ['퇴장 미리 보기', 'out']]) { const p = document.createElement('button'); p.type = 'button'; p.className = 'btn sm ghost ent-prev'; p.textContent = t; p.onclick = (e) => { e.stopPropagation(); prev(d); }; w.appendChild(p); } b.appendChild(w); }
      L.appendChild(b);
    };
    const set = (v) => { if (typeof Prof !== 'undefined' && Prof.set) Prof.set('ent', v); else { STATS.prof = Object.assign({}, STATS.prof || {}, { ent: v }); saveStats(); } if (typeof Audio !== 'undefined') Audio.ui(); };
    const auto = act ? byId(act) : null;
    row('auto', '<span class="ent-auto">자동</span>', ['가진 것 중 가장 높은 연출', auto && cur === 'auto' ? `지금: ${nameOf(auto)}` : auto ? `가진 것: ${owned().map(nameOf).join(' · ')}` : '아직 가진 연출이 없습니다'], cur === 'auto', false, () => set('auto'));
    row('off', '<span class="ent-auto">끄기</span>', ['파티에 들어가고 나갈 때 연출 없음', '다른 사람의 연출은 그대로 보입니다'], cur === 'off', false, () => set('off'));
    for (const E of list) {
      const has = ok(E), T = tiOf(tiKey(E)), hex = '#' + E.c[0].toString(16).padStart(6, '0');
      const how = E.staff ? '개발자·부개발자 계정 전용' : E.t != null ? `랭크 ${nameOf(E)} 도달 (최고 기록)` : (T && T.desc) || '';
      let pr = ''; try { pr = !has && T && T.prog ? '진행: ' + T.prog() : ''; } catch (e) { pr = ''; }
      row(E.id, `<span class="ent-nm" style="--ec:${hex}">${nameOf(E)}</span>`, [`입장: ${MOVE[E.mo[0]] || ''}<br>퇴장: ${MOVE_OUT[E.mo[1]] || ''}`, has ? (cur === E.id ? '사용 중' : '얻음 · 눌러서 고르기') + ' — ' + how : `잠김 — ${how}${pr ? ' · ' + pr : ''}`], cur === E.id, !has,
        () => { if (!has) { HUD.lobbyNote(`아직 얻지 못했습니다 — ${how}`); return; } set(E.id); },
        (d) => { if (typeof Prof !== 'undefined') Prof.close(); setTimeout(() => preview(E.id, d), 120); });
    }
    B.appendChild(L);
    const tail = document.createElement('p'); tail.className = 'micro'; tail.textContent = '미리 보기는 내 화면에서만 보입니다 (퇴장 미리 보기가 끝나면 캐릭터가 다시 나타남). 파티에 들어가거나 나가면 파티원 모두에게 보입니다.'; B.appendChild(tail);
  }
  const owned = () => ENT.filter(ok);
  // 연출 한 줄 설명 (계정 창)
  const MOVE = { ceremony: '시상식 — 솟아오른 1위 시상대 · 하늘에서 내려온 트로피를 번쩍 · 조명 · 색종이', armillary: '세 겹 혼천의 고리에 싸여 강하 · 착지하면 고리가 별 왕관으로', crater: '불꼬리 낙하 · 주먹으로 땅을 쳐 바위판이 분화구처럼 솟음 · 목을 꺾어 풂', eclipse: '해를 가리는 달 · 개기일식의 그림자에서 솟아 다이아몬드 링과 함께 팔을 펼침', smokeIn: '연막탄 연기 속에서 걸어 나와 경례 · 가슴에 훈장 셋',
    devIn: '편집기에 끌어다 놓은 T 자세 모델에 텍스처가 입혀지고, ▶ 실행에 깨어나 허공의 자판으로 명령을 실행',
    wingsIn: '큰 날개로 날갯짓하며 강림 · 날개가 깃털로 흩어지고 광륜', nova: '별이 부풀어 노바로 터지고 그 조각이 떨어져 착지 · 푸른 수정이 솟음', throne: '용암에서 솟는 쇠 옥좌에 턱을 괴고 앉아 있다 일어섬', clockIn: '거꾸로 도는 큰 시계 · ∞ 빛이 감기며 몸이 빚어짐 · 열두 시 종', escape: '백룸 복도 문틈에서 몸을 던져 탈출 · 낚아채려는 검은 손', bladeRain: '하늘에서 붉은 칼이 비처럼 꽂히고 번개 속에 나타나 포효' };
  const MOVE_OUT = { curtain: '커튼콜 — 인사하고 손을 흔들면 붉은 커튼이 닫혔다 열리고 빈자리', ascendStar: '별 왕관이 혼천의로 펼쳐져 빠르게 돌고 별이 되어 하늘로', devour: '땅을 치면 바위판이 이빨처럼 덮쳐 불길과 함께 삼킴', umbra: '다시 일식 — 팔짱 낀 채 그림자 속으로 가라앉음', smokeOut: '마지막 경례 · 연막 속으로 돌아서 걸어가고 군번줄만 반짝',
    devOut: '■ 정지에 T 자세로 굳어 철사 모델이 되고, 커서에 집혀 나가면 글자 커서만 깜빡',
    wingsOut: '광륜과 날개를 펴고 날갯짓하며 빛기둥을 따라 날아오름', novaOut: '가슴에 빛을 모아 솟구치고 하늘에서 다시 별로 터짐', throneOut: '옥좌에 앉아 턱을 괸 채 용암 속으로 가라앉음', clockOut: '시계가 빨리 돌고 몸이 보랏빛 모래로 흘러내림', noclip: '바닥에 열린 백룸 구멍으로 떨어짐', swordOut: '꽂힌 큰 검을 뽑아 치켜들자 번개를 맞고 사라짐' };

  return { ENT, MOT, KP, mine, mineList, valid, ok, avail, nameOf, owned, team, ghost, bound, spot, update, cam, clear, preview, profTab, play, get anims() { return AN; }, get ghosts() { return GH; }, get live() { return LIVE.length; },
    _rigPose(r, name, t = 0) { evalKey(r, name, Object.assign(BB, B0), { t }); } };
})();
