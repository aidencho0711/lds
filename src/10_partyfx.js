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
// ============================================================
const PartyFx = (() => {
  // ---------- 대상 (자동 선택은 위에서부터) ----------
  //  t: 새 티어 번호(RANK_TIERS — 10_rank.js, 최고 도달은 칭호 tier_<id> 로 판단) · 없으면 같은 id 의 칭호(10_ui_profile.js TI)
  //  mo: [입장, 퇴장, 작별 몸짓] · c: [주색, 보조색, 밝은 색] · pal: 입자 색
  const ENT = [
    { id: 'champ_tier', name: '랭크 챔피언', mo: ['podium', 'bowOut', 'bow'], c: [0xffc93a, 0xff6a3a, 0xfff4c8], pal: [0xffd65a, 0xfff0b0, 0xff4a5a, 0x4ab8ff, 0x6aff9a, 0xffffff] },
    { id: 'zenith', t: 13, name: '제니스', mo: ['spinfall', 'spinOut', 'salute'], c: [0xffd76a, 0xa47cff, 0xffffff], pal: [0xffd76a, 0xfff2c8, 0xc8a8ff, 0xffffff] },
    { id: 'champ_hc', name: '하드코어 패왕', mo: ['slam', 'slamOut', 'flex'], c: [0xff3a1e, 0xffa030, 0xffe2c8], pal: [0xff3a1e, 0xff7a20, 0xffc04a, 0xffe2c8] },
    { id: 'eclipse', t: 12, name: '이클립스', mo: ['emerge', 'sink', 'cross'], c: [0xff4a2e, 0x8a0c1a, 0xffd8c8], pal: [0xff4a2e, 0xff8a5a, 0xffd0b0, 0xc8102a] },
    { id: 'champ_lv', name: '정점의 베테랑', mo: ['rez', 'derez', 'salute'], c: [0xcfe4ff, 0x7fb8ff, 0xffffff], pal: [0xcfe4ff, 0x9fd0ff, 0xffffff, 0xffe9a8] },
    { id: 'celestial', t: 11, name: '셀레스티얼', mo: ['descend', 'ascend', 'open'], c: [0xf3d98b, 0xfff4d8, 0xffffff], pal: [0xf3d98b, 0xffe9b0, 0xfffaf0, 0xffffff] },
    { id: 'nova', t: 10, name: '노바', mo: ['meteor', 'launch', 'wave'], c: [0x8fe3ff, 0x2f86ff, 0xffffff], pal: [0x8fe3ff, 0x4fb0ff, 0xd8f6ff, 0xffffff] },
    { id: 'hc_overlord', name: '오버로드', mo: ['fireStep', 'burnOut', 'fistPalm'], c: [0xff7a18, 0xffc040, 0xfff0c8], pal: [0xff6a12, 0xff9a2a, 0xffc04a, 0xfff0c0] },
    { id: 'tier_eternal', name: '이터널', mo: ['orbForm', 'orbOut', 'open'], c: [0xc58cff, 0x7a3cff, 0xf6eaff], pal: [0xc58cff, 0xe6c8ff, 0x9a6aff, 0xffffff] },
    { id: 'br_all', name: '백룸 정복자', mo: ['escape', 'noclip', 'shrug'], c: [0xffe066, 0xc9b27a, 0xfffbe0], pal: [0xffe066, 0xe8d8a0, 0xc9b27a, 0xfff8d0] },
    { id: 'wargod', name: '전쟁의 신', mo: ['strikeIn', 'strikeOut', 'armUp'], c: [0xff2a3a, 0xff8a8a, 0xffeef0], pal: [0xff2a3a, 0xff6a6a, 0xffd0d0, 0xffffff] },
  ];
  const byId = (id) => ENT.find((e) => e.id === id) || null;
  const tiOf = (id) => (typeof Prof !== 'undefined' && Prof.TI ? Prof.TI.find((x) => x.id === id) || null : null);
  const tiKey = (E) => (E.t != null ? 'tier_' + E.id : E.id);
  // 이 판(클라이언트)에 그 티어·칭호가 있는가 (새 티어는 10_rank.js 가 RANK_TIERS 에 더한 뒤부터)
  const avail = (E) => (E.t != null ? RANK_TIERS.length > E.t : !!tiOf(E.id));
  const nameOf = (E) => (E.t != null && RANK_TIERS[E.t] ? RANK_TIERS[E.t].name : (tiOf(tiKey(E)) || {}).name || E.name);
  function ok(E) {
    if (!E || !avail(E)) return false;
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
  function valid(ids, name) {
    for (const id of Array.isArray(ids) ? ids.slice(0, 4) : [ids]) {
      const E = byId(id); if (!E || !avail(E)) continue;
      if (/^champ_/.test(E.id) && typeof Ladder !== 'undefined' && Ladder.allowed && !Ladder.allowed(E.id, name)) continue;
      return E;
    }
    return null;
  }

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
  function label(E, gp, delay = 0, dur = 2.4) {
    at(delay, () => {
      const box = document.getElementById('lobbyTags'); if (!box) return;
      const el = document.createElement('div'); el.className = 'ent-ban'; el.style.setProperty('--ec', '#' + E.c[0].toString(16).padStart(6, '0'));
      el.innerHTML = `<i></i><b>${nameOf(E)}</b><i></i>`; box.appendChild(el);
      const top = document.querySelector('#lobby .lb-top'); BAN.push({ el, gp: { x: gp.x, y: gp.y, z: gp.z }, t: 0, dur, top: top ? top.getBoundingClientRect().bottom : 60 });
    });
  }
  function tickBan(dt) {
    const W = window.innerWidth, H = window.innerHeight, show = G.state === 'lobby' && !(document.getElementById('lobby') || {}).hidden;
    for (let i = BAN.length - 1; i >= 0; i--) {
      const b = BAN[i]; b.t += dt; const u = b.t / b.dur;
      if (u >= 1 || !CAM) { b.el.remove(); BAN.splice(i, 1); continue; }
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
    for (const t of [crownTex, corridorTex, frameTex, pitTex, sqTex, coronaTex, discTex, boltTex]) objs.push(new THREE.Mesh(g.plane, mat(t(), 0)));
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
    // 아래로 떨어짐: 두 팔을 위로 허우적 · 위(빛 쪽)를 봄
    flail(r, o) { const s = Math.sin(o.t * 13) * 0.25; r.hips.position.set(0, 0.95, 0); spineSet(r, [-0.08], [-0.12], [-0.1], [-0.3], [-0.4]); up(r); lfk(r.legL, -0.6, 0.05, 1.1, 0.3); lfk(r.legR, 0.1, 0.05, 0.3, 0.5); fk(r.armL, -0.4 + s, 0.3, 2.45, -0.7, 'open'); fk(r.armR, -0.4 - s, 0.3, 2.45, -0.7, 'open'); },
  };
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
  // ===== 노바: 유성 강하 · 한 무릎 착지 / 웅크렸다 하늘로 솟구침 =====
  MOT.meteor = { kind: 'in', dur: 3.5, keys: [[0, 'fall'], [0.5, 'land', 0.06], [1.45, 'land'], [2.05, 'rise', 0.55], [2.75, 'stand', 0.6]],
    body(t, B) { if (t < 0.5) B.y = 7 * (1 - ein(t / 0.5)); else if (t < 0.62) B.y = -0.04 * Math.sin((t - 0.5) / 0.12 * Math.PI); },
    fx(a) {
      const E = a.E, gp = a.gp;
      ring(gp, E.c[0], 2.6, 0.75, 0.5); ring(gp, E.c[2], 1.5, 0.45, 0.53); ring(gp, E.c[1], 3.6, 1.0, 0.58);
      decal(gp, tex().ice(), 2.8, 2.8, E.c[2], E.c[1], 0.5); glow(hipsAt(a, 0.35).clone(), E.c[2], 4.2, 0.4, 0.5); glow(hipsAt(a, 0.6).clone(), E.c[0], 7, 0.7, 0.5);
      pillar(gp, E.c[0], 0.5, 5.5, 0.7, 0.5, 0.1); shake(0.1, 0.5); flash(1.7, 0.35, 0.5); label(E, gp, 0.7);
      at(0.5, () => { const Q = P(); for (let i = 0; i < 70; i++) { const an = Math.random() * TAU, sp = rnd(2.5, 6.5); _a.set(gp.x + Math.cos(an) * 0.3, gp.y + 0.08, gp.z + Math.sin(an) * 0.3); EM(Q, _a, Math.cos(an) * sp, rnd(0.6, 2.6), Math.sin(an) * sp, pk(E), rnd(0.035, 0.07), rnd(0.35, 0.8), { g: -6, drag: 1.6, so: 0.6 }); }
        for (let i = 0; i < 26; i++) { const an = Math.random() * TAU, sp = rnd(1.2, 3.5); EM(Q, _a.set(gp.x, gp.y + 0.1, gp.z), Math.cos(an) * sp, rnd(2, 4.5), Math.sin(an) * sp, 0xc8d4e0, rnd(0.03, 0.05), rnd(0.6, 1.1), { g: -10, drag: 0.6, sq: 1, so: 0.9 }); } });
    },
    tick(a, r, t, dt) {   // 떨어지는 동안 꼬리 · 착지 뒤 피어오르는 빛 알갱이
      const Q = P(), E = a.E;
      if (t < 0.5) { hipsW(r, _a); const n = Math.ceil(dt * 260); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.18, 0.18), _a.y + rnd(0, 1.4), _a.z + rnd(-0.18, 0.18)), 0, rnd(1, 3), 0, i % 3 ? E.c[0] : E.c[2], rnd(0.06, 0.14), rnd(0.18, 0.4), { grow: -0.6, so: 0.25 }); }
      else if (t < 2.4 && Math.random() < dt * 30) { const an = Math.random() * TAU, rr = rnd(0.2, 1.3); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), 0, rnd(0.4, 1.1), 0, pk(E), rnd(0.025, 0.045), rnd(0.8, 1.4), { so: 0.4 }); }
    } };
  MOT.launch = { kind: 'out', dur: 2.3, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.85, 'charge', 0.45], [0.98, 'jump', 0.1]],
    body(t, B) { if (t > 0.92) { const u = t - 0.92; B.y = u * u * 55 + u * 6; B.sy = 1 + Math.min(0.8, u * 4); B.sx = B.sz = 1 / Math.sqrt(B.sy); B.vis = B.y < 16; } },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, tex().ring(), 1.8, 1.0, E.c[0], 2, 0.2, -0.4, 0.2); ring(gp, E.c[0], 2.4, 0.6, 0.95); ring(gp, E.c[2], 1.3, 0.4, 0.95); glow(hipsAt(a, 0.4).clone(), E.c[2], 3.4, 0.4, 0.95); pillar(gp, E.c[0], 0.42, 9, 1.1, 0.95, 0.15); shake(0.05, 0.95); flash(1.35, 0.3, 0.95); },
    tick(a, r, t, dt) { const Q = P(), E = a.E;
      if (t > 0.3 && t < 0.95) { const n = Math.ceil(dt * 90); hipsW(r, _a); for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.6, 1.1); _b.set(_a.x + Math.cos(an) * rr, _a.y + rnd(-0.6, 0.8), _a.z + Math.sin(an) * rr); EM(Q, _b, (_a.x - _b.x) * 3, (_a.y - _b.y) * 3, (_a.z - _b.z) * 3, pk(E), rnd(0.025, 0.045), 0.3, { so: 0.3 }); } }
      if (t > 0.95 && t < 1.5) { hipsW(r, _a); const n = Math.ceil(dt * 220); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.15, 0.15), _a.y + rnd(-1.2, 0.2), _a.z + rnd(-0.15, 0.15)), 0, rnd(-3, -1), 0, i % 3 ? E.c[0] : E.c[2], rnd(0.06, 0.13), rnd(0.2, 0.4), { grow: -0.6, so: 0.25 }); }
    } };
  // ===== 제니스: 하늘의 별이 열리고 빛줄기 속을 돌며 강하 · 착지 충격파 · 주먹을 하늘로 / 경례 후 돌며 솟아 별로 흩어짐 =====
  MOT.spinfall = { kind: 'in', dur: 4.3, keys: [[0, 'spin'], [1.32, 'spin'], [1.38, 'land', 0.06], [1.95, 'land'], [2.5, 'rise', 0.5], [2.75, 'victory', 0.3], [3.6, 'victory']],
    body(t, B) { if (t < 1.38) { const u = seg(t, 0.2, 1.38); B.y = 4.6 * (1 - eout(u)) + (t < 0.2 ? 5 : 0); B.ry = (1 - eout(u)) * TAU * 2; B.vis = t > 0.2; } },
    fx(a) {
      const E = a.E, gp = a.gp, sky = new THREE.Vector3(gp.x, gp.y + 2.6, gp.z - 0.8);
      card(sky, tex().star4(), E.c[0], 1.3, (m, u) => { m.scale.setScalar(3.2 * (0.25 + 0.75 * Math.sqrt(u))); m.rotateZ(u * 1.6); m.material.opacity = Math.min(1, u * 6) * (1 - u); });
      glow(sky, E.c[2], 4, 0.9); envFx(1.6, (u) => { const v = 1 + 0.35 * Math.sin(Math.PI * u); return [v, v]; });
      sigil(gp, sigilTex(), 3.4, 3.9, E.c[0], 0.5, 0.05); sigil(gp, sigilTex(), 2.1, 3.7, E.c[1], -1.1, 0.25);
      pillar(gp, dim(E.c[2], 0.45), 0.55, 7, 1.35, 0.15, 0.6); beam(sky, new THREE.Vector3(gp.x, gp.y, gp.z), E.c[0], 0.5, 0.8, 0.15);
      ring(gp, E.c[0], 3.1, 0.8, 1.38); ring(gp, E.c[1], 2.2, 0.6, 1.42); ring(gp, E.c[2], 4.2, 1.1, 1.5);
      glow(hipsAt(a, 0.5).clone(), E.c[2], 5, 0.45, 1.38); shake(0.12, 1.38); flash(1.8, 0.4, 1.38); label(E, gp, 1.5);
      at(1.38, () => { const Q = P(); for (let i = 0; i < 90; i++) { _a.set(rnd(-1, 1), rnd(0.2, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(2.5, 6.5)); EM(Q, hipsAt(a, 0.4), _a.x, _a.y, _a.z, pk(E), rnd(0.04, 0.08), rnd(0.5, 1.1), { g: -4, drag: 1.8, so: 0.55 }); } });
      at(2.8, () => { const Q = P(); hand0(a, _c); glow(_c, E.c[2], 2.4, 0.4); card(_c.clone(), tex().star4(), E.c[0], 0.6, (m, u) => { m.scale.setScalar(1.6 * Math.sqrt(u) + 0.01); m.rotateZ(u * 2); m.material.opacity = 1 - u; }); for (let i = 0; i < 40; i++) { _a.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 3)); EM(Q, _c, _a.x, _a.y, _a.z, pk(E), rnd(0.03, 0.06), rnd(0.6, 1.2), { g: -2.5, drag: 1.4, so: 0.5 }); } });
    },
    tick(a, r, t, dt) { const Q = P(), E = a.E;
      if (t > 0.2 && t < 1.4) { hipsW(r, _a); const n = Math.ceil(dt * 120); for (let i = 0; i < n; i++) { const an = t * 9 + i * 2.1 + Math.random() * 0.3, rr = 0.55 + Math.random() * 0.15; EM(Q, _b.set(_a.x + Math.cos(an) * rr, _a.y + rnd(-0.7, 0.9), _a.z + Math.sin(an) * rr), 0, 0.6, 0, pk(E), rnd(0.03, 0.06), rnd(0.4, 0.7), { drag: 1, so: 0.45 }); } }
      if (t > 2.75 && t < 3.6 && Math.random() < dt * 40) { hand0(a, _c); EM(Q, _c, rnd(-0.4, 0.4), rnd(0.3, 1.2), rnd(-0.4, 0.4), pk(E), rnd(0.025, 0.05), rnd(0.5, 0.9), { g: -1, so: 0.5 }); }
    } };
  MOT.spinOut = { kind: 'out', dur: 3.1, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.65, 'salute', 0.35], [1.25, 'salute'], [1.5, 'charge', 0.25], [1.62, 'spin', 0.12]],
    body(t, B) { if (t > 1.55) { const u = t - 1.55; B.y = u * u * 7 + u * 3.5; B.ry = u * u * 9 + u * 6; B.s = 1 - sstep(0.55, 0.95, u); B.vis = B.s > 0.02; } },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 3.2, 2.6, E.c[0], 0.6, 0.45); sigil(gp, sigilTex(), 2.0, 2.4, E.c[1], -1.2, 0.6); ring(gp, E.c[0], 2.8, 0.7, 1.55); pillar(gp, dim(E.c[2], 0.5), 0.5, 8, 1.3, 1.55, 0.4); flash(1.4, 0.35, 1.55); shake(0.05, 1.55);
      at(2.45, () => { const Q = P(); hipsW(a.rig, _c); glow(_c, E.c[2], 3.6, 0.5); for (let i = 0; i < 70; i++) { _a.set(rnd(-1, 1), rnd(-0.4, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.5, 4.5)); EM(Q, _c, _a.x, _a.y, _a.z, pk(E), rnd(0.035, 0.07), rnd(0.6, 1.3), { g: -1.5, drag: 1.6, so: 0.5 }); } }); },
    tick(a, r, t, dt) { if (t < 1.55 || t > 2.6) return; const Q = P(), E = a.E; hipsW(r, _a); const n = Math.ceil(dt * 160); for (let i = 0; i < n; i++) { const an = t * 12 + i * 2.4, rr = 0.5; EM(Q, _b.set(_a.x + Math.cos(an) * rr, _a.y + rnd(-0.8, 0.6), _a.z + Math.sin(an) * rr), 0, -0.8, 0, pk(E), rnd(0.03, 0.06), rnd(0.4, 0.8), { so: 0.45 }); } } };
  // ===== 셀레스티얼: 금빛 빛기둥 속으로 천천히 내려와 사뿐히 · 두 손을 펴 축복 / 빛기둥을 타고 떠올라 빛으로 =====
  MOT.descend = { kind: 'in', dur: 4.4, keys: [[0, 'float'], [2.0, 'float'], [2.35, 'stand', 0.35], [2.6, 'stand'], [3.0, 'open', 0.4], [3.75, 'open']],
    body(t, B) { if (t < 2.25) { const u = seg(t, 0, 2.25); B.y = 3.4 * (1 - eout(u)) * (1 - eout(u)); B.ry = Math.sin(t * 1.3) * 0.15 * (1 - u); } },
    fx(a) { const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.42), 0.85, 9, 3.4, 0, 0.55); envFx(4.2, (u) => { const v = 1 + 0.18 * Math.sin(Math.PI * u); return [v, 1 + 0.12 * Math.sin(Math.PI * u)]; });
      for (let i = 0; i < 4; i++) halo(gp, i % 2 ? E.c[2] : E.c[0], 3.6, 0.15, 0.55, 0.85, 1.6, i * 0.45);
      ring(gp, E.c[0], 2.0, 1.0, 2.25); sigil(gp, sigilTex(), 2.8, 2.2, E.c[0], 0.25, 2.2); glow(hipsAt(a, 0.3).clone(), E.c[2], 2.6, 0.6, 2.25); label(E, gp, 2.35);
      at(3.05, () => { const Q = P(); for (const s of [-1, 1]) { hand0(a, _c, s); for (let i = 0; i < 18; i++) EM(Q, _c, rnd(-0.3, 0.3), rnd(0.4, 1.3), rnd(-0.3, 0.3), pk(E), rnd(0.025, 0.05), rnd(0.7, 1.3), { drag: 0.8, so: 0.45 }); } }); },
    tick(a, r, t, dt) { const Q = P(), E = a.E;   // 깃털처럼 흔들리며 내려오는 금빛 조각
      if (t < 3.4 && Math.random() < dt * 26) { const an = Math.random() * TAU, rr = rnd(0.2, 1.1); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(1.6, 3.2), a.gp.z + Math.sin(an) * rr), rnd(-0.25, 0.25), rnd(-0.55, -0.3), rnd(-0.25, 0.25), pk(E), rnd(0.035, 0.06), rnd(2, 3), { sq: 1, so: 0.65 }); }
      if (t < 2.2) { hipsW(r, _a); if (Math.random() < dt * 40) EM(Q, _b.set(_a.x + rnd(-0.3, 0.3), _a.y + rnd(-0.9, 0.9), _a.z + rnd(-0.3, 0.3)), 0, 0.15, 0, E.c[2], rnd(0.03, 0.05), 0.8, { so: 0.3 }); } } };
  MOT.ascend = { kind: 'out', dur: 3.3, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.85, 'reach', 0.5], [1.4, 'reach'], [1.9, 'float', 0.5]],
    body(t, B) { if (t > 1.1) { const u = seg(t, 1.1, 2.9); B.y = 3.6 * ein(u); B.s = 1 - sstep(0.7, 1, u) * 0.98; B.vis = B.s > 0.03; } },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 2.8, 3.0, E.c[0], 0.3, 0.2); pillar(gp, dim(E.c[0], 0.42), 0.8, 9, 3.0, 0.4, 0.6); for (let i = 0; i < 3; i++) halo(gp, E.c[i % 2 ? 2 : 0], 0.2, 3.6, 0.75, 0.5, 1.7, 1.1 + i * 0.35);
      at(2.75, () => { const Q = P(); _c.set(gp.x, gp.y + 3.4, gp.z); glow(_c, E.c[2], 3.4, 0.6); for (let i = 0; i < 50; i++) { _a.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1, 3)); EM(Q, _c, _a.x, _a.y, _a.z, pk(E), rnd(0.03, 0.06), rnd(0.8, 1.4), { drag: 1.2, so: 0.5 }); } }); },
    tick(a, r, t, dt) { const Q = P(), E = a.E; if (Math.random() < dt * 24) { const an = Math.random() * TAU, rr = rnd(0.2, 1.0); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(1.5, 3), a.gp.z + Math.sin(an) * rr), rnd(-0.2, 0.2), rnd(-0.5, -0.3), rnd(-0.2, 0.2), pk(E), rnd(0.035, 0.055), rnd(1.8, 2.6), { sq: 1, so: 0.65 }); }
      if (t > 1.1 && t < 2.9) { hipsW(r, _a); const n = Math.ceil(dt * 70); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.3, 0.3), _a.y + rnd(-0.9, 0.5), _a.z + rnd(-0.3, 0.3)), 0, -0.6, 0, pk(E), rnd(0.03, 0.05), rnd(0.5, 0.9), { so: 0.4 }); } } };
  // ===== 이클립스: 해가 가려 어두워지고 땅에 열린 붉은 구멍에서 팔짱 낀 채 솟아올라 팔을 내뻗음 / 팔짱 끼고 구멍 속으로 가라앉음 =====
  const eclipseSky = (a, dur, delay = 0) => { const E = a.E, gp = a.gp, p = new THREE.Vector3(gp.x - 0.3, gp.y + 2.5, gp.z - 2.6);
    card(p, discTex(), 0x050002, dur, (m, u) => { const k = sstep(0, 0.2, u) * (1 - sstep(0.8, 1, u)); m.scale.setScalar(1.25 * k + 0.01); m.material.opacity = k; }, delay, true);
    card(p.clone(), coronaTex(), E.c[0], dur, (m, u, e) => { const k = sstep(0.05, 0.25, u) * (1 - sstep(0.78, 1, u)); m.scale.setScalar(2.9 * k + 0.01); m.rotateZ(e.t * 0.25); m.material.opacity = k; }, delay); };
  const portal = (a, size, dur, delay = 0) => { const E = a.E, gp = a.gp;
    const d = flat(discTex(), 0x0a0003, gp, 0.02); d.material.blending = THREE.NormalBlending; d.renderOrder = 2;
    add(d, dur, (e, u) => { const k = sstep(0, 0.15, u) * (1 - sstep(0.85, 1, u)); d.scale.setScalar(size * 0.75 * k + 0.01); d.material.opacity = 0.92 * k; }, delay);
    const s = flat(tex().swirl(), E.c[0], gp, 0.04); add(s, dur, (e, u) => { const k = sstep(0, 0.15, u) * (1 - sstep(0.85, 1, u)); s.scale.setScalar(size * k + 0.01); s.rotation.y = -e.t * 2.4; s.material.opacity = k; }, delay); };
  MOT.emerge = { kind: 'in', dur: 4.3, keys: [[0, 'cross'], [2.25, 'cross'], [2.45, 'burst', 0.16], [3.4, 'burst']],
    body(t, B) { const u = seg(t, 0.7, 2.2); B.y = -2.05 * (1 - eout(u)); B.vis = t > 0.6; },
    fx(a) { const E = a.E, gp = a.gp; envFx(4.0, (u) => { const k = sstep(0, 0.1, u) * (1 - sstep(0.82, 1, u)); return [1 - 0.62 * k, 1 - 0.55 * k]; }); eclipseSky(a, 3.9, 0.05); portal(a, 2.4, 2.6, 0.2);
      ring(gp, E.c[0], 2.8, 0.7, 2.45); ring(gp, E.c[2], 1.6, 0.45, 2.47); glow(hipsAt(a, 0.6).clone(), E.c[0], 4.6, 0.5, 2.45); shake(0.07, 2.45); label(E, gp, 2.5);
      at(2.45, () => { const Q = P(); for (let i = 0; i < 60; i++) { const an = Math.random() * TAU, sp = rnd(2, 5); EM(Q, hipsAt(a, rnd(0.2, 1.2)), Math.cos(an) * sp, rnd(-0.3, 1.2), Math.sin(an) * sp, pk(E), rnd(0.035, 0.07), rnd(0.4, 0.9), { drag: 2, so: 0.6 }); } }); },
    tick(a, r, t, dt) { if (t > 2.6) return; const Q = P(), E = a.E, n = Math.ceil(dt * 60);
      for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.05, 0.9); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), rnd(-0.1, 0.1), rnd(1.2, 3.2), rnd(-0.1, 0.1), pk(E), rnd(0.03, 0.06), rnd(0.4, 0.9), { drag: 0.6, so: 0.5 }); }
      if (Math.random() < dt * 14) EM(Q, _b.set(a.gp.x + rnd(-0.5, 0.5), a.gp.y + 0.1, a.gp.z + rnd(-0.5, 0.5)), 0, rnd(0.5, 1), 0, 0x1a0408, rnd(0.25, 0.4), rnd(0.9, 1.4), { grow: 1.4, so: 1, a: 0.6 }); } };
  MOT.sink = { kind: 'out', dur: 3.0, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'cross', 0.4]],
    body(t, B) { const u = seg(t, 0.8, 2.3); B.y = -2.1 * ein(u); B.vis = u < 0.98; },
    fx(a) { const E = a.E, gp = a.gp; envFx(2.9, (u) => { const k = sstep(0, 0.15, u) * (1 - sstep(0.8, 1, u)); return [1 - 0.55 * k, 1 - 0.5 * k]; }); eclipseSky(a, 2.8, 0.1); portal(a, 2.4, 2.3, 0.45); ring(gp, E.c[0], 2.4, 0.6, 2.35); glow(hipsAt(a, 0.2).clone(), E.c[0], 3.2, 0.5, 2.35); },
    tick: (a, r, t, dt) => MOT.emerge.tick(a, r, t * 0.9, dt) };
  // ===== 랭크 챔피언: 금빛 조명 속에 번쩍 나타나 두 팔 V · 양옆 색종이 대포 · 머리 위 왕관 · 주먹 / 가슴에 손 얹고 인사 후 금빛으로 =====
  MOT.podium = { kind: 'in', dur: 4.1, keys: [[0, 'tall'], [0.55, 'tall'], [0.95, 'vArms', 0.35], [2.0, 'vArms'], [2.35, 'victory', 0.3], [3.5, 'victory']],
    body(t, B, a) { const u = seg(t, 0, 0.35); B.s = u < 1 ? Math.max(0.01, eout(u) * 1.12 - 0.12 * sstep(0.7, 1, u)) : 1; if (t > 2.35 && t < 3.4) B.y = Math.max(0, Math.sin((t - 2.35) * 9)) * 0.03; },
    fx(a) { const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.38), 0.75, 7.5, 3.9, 0, 0.6); glow(hipsAt(a, 0.5).clone(), E.c[2], 4, 0.45); ring(gp, E.c[0], 2.4, 0.7, 0.05); sigil(gp, tex().ring(), 1.9, 3.8, E.c[0], 0.4, 0.1, 0, 0.2); flash(1.5, 0.35); label(E, gp, 0.4);
      const cr = new THREE.Vector3(gp.x, gp.y + 2.3, gp.z); card(cr, crownTex(), 0xffffff, 3.4, (m, u, e) => { const k = sstep(0, 0.12, u) * (1 - sstep(0.85, 1, u)); m.scale.set(0.62 * k + 0.01, 0.465 * k + 0.01, 1); m.position.y = cr.y + 0.22 + Math.sin(e.t * 3) * 0.04; m.rotateZ(Math.sin(e.t * 2) * 0.08); m.material.opacity = k; }, 0.3);
      for (const [tt, s] of [[0.6, -1], [0.75, 1], [1.4, -1], [1.55, 1]]) at(tt, () => confetti(a, s));
      for (const tt of [2.4, 2.75, 3.1]) at(tt, () => { hand0(a, _c); glow(_c, E.c[2], 1.6, 0.3); const Q = P(); for (let i = 0; i < 14; i++) EM(Q, _c, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), pk(E), rnd(0.03, 0.05), rnd(0.5, 0.8), { g: -3, drag: 1, so: 0.6 }); }); },
    tick(a, r, t, dt) { const Q = P(), E = a.E; if (t < 3.6 && Math.random() < dt * 30) { const an = Math.random() * TAU, rr = rnd(0.1, 0.8); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(2.0, 2.8), a.gp.z + Math.sin(an) * rr), 0, -0.4, 0, E.c[2], rnd(0.02, 0.04), rnd(1.2, 2), { so: 0.5 }); } } };
  // 색종이 대포: 캐릭터 옆(s = ±1)에서 비스듬히 위로
  function confetti(a, s) {
    const Q = P(), gp = a.gp, E = a.E; _c.set(gp.x + s * 1.1, gp.y + 0.2, gp.z + 0.15); glow(_c.clone(), E.c[2], 1.2, 0.25);
    for (let i = 0; i < 55; i++) EM(Q, _c, -s * rnd(0.6, 2.4), rnd(3.5, 6.5), rnd(-0.8, 0.8), pk(E), rnd(0.035, 0.06), rnd(1.4, 2.4), { g: -3.2, drag: 1.3, sq: 1, so: 0.9 });
  }
  MOT.bowOut = { kind: 'out', dur: 3.0, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'bow', 0.4], [1.35, 'bow'], [1.65, 'vArms', 0.3]],
    body(t, B) { if (t > 1.9) { const u = seg(t, 1.9, 2.4); B.s = 1 - ein(u) * 0.99; B.y = u * 0.4; B.vis = u < 0.99; } },
    fx(a) { const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.38), 0.7, 7, 2.8, 0.1, 0.6); at(1.65, () => { confetti(a, -1); confetti(a, 1); }); ring(gp, E.c[0], 2.2, 0.6, 2.35);
      at(2.35, () => { const Q = P(); hipsW(a.rig, _c); _c.y += 0.4; glow(_c, E.c[2], 3, 0.5); card(_c.clone(), crownTex(), 0xffffff, 0.9, (m, u) => { m.scale.set(0.6, 0.45, 1); m.position.y += e1(u); m.material.opacity = 1 - u; }); for (let i = 0; i < 50; i++) { _a.set(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.2, 3.4)); EM(Q, _c, _a.x, _a.y, _a.z, pk(E), rnd(0.035, 0.06), rnd(0.7, 1.2), { g: -2, drag: 1.4, sq: Math.random() < 0.5, so: 0.8 }); } }); } };
  const e1 = (u) => u * 0.012;
  // ===== 정점의 베테랑: 은빛 훑는 고리가 지나가며 몸이 짜여 나타나 경례 · 별 훈장이 돎 / 경례 후 위에서부터 훑어 사라짐 =====
  const stepQ = (u, n) => Math.floor(u * n + 1e-6) / n;
  MOT.rez = { kind: 'in', dur: 3.8, keys: [[0, 'att'], [1.2, 'att'], [1.55, 'salute', 0.35], [2.9, 'salute'], [3.2, 'att', 0.3]],
    body(t, B) { const u = seg(t, 0.1, 1.0); B.s = Math.max(0.02, stepQ(eout(u), 6)); B.vis = t > 0.1 && (u >= 1 || Math.random() < 0.8); },
    fx(a) { const E = a.E, gp = a.gp; for (let i = 0; i < 2; i++) halo(gp, i ? E.c[2] : E.c[1], 0.05, 2.0, 0.6, 0.6, 0.95, i * 0.15, sqTex()); pillar(gp, dim(E.c[1], 0.6), 0.55, 2.4, 1.3, 0, 0.5); sigil(gp, sqTex(), 1.6, 3.4, E.c[1], 0.8, 0.1);
      glow(hipsAt(a, 0.5).clone(), E.c[2], 3.2, 0.4, 1.0); ring(gp, E.c[2], 1.9, 0.55, 1.0); label(E, gp, 1.15); flash(1.25, 0.3, 1.0);
      for (let i = 0; i < 3; i++) { const ph = i * TAU / 3; card(new THREE.Vector3(), tex().star5(), E.pal[i === 1 ? 0 : 3], 2.3, (m, u, e) => { const k = sstep(0, 0.12, u) * (1 - sstep(0.85, 1, u)), an = ph + e.t * 1.6; m.position.set(gp.x + Math.cos(an) * 0.75, gp.y + 1.25 + Math.sin(e.t * 2 + ph) * 0.1, gp.z + Math.sin(an) * 0.75); m.scale.setScalar(0.32 * k + 0.01); m.material.opacity = k; }, 1.3); } },
    tick(a, r, t, dt) { if (t > 1.1) return; const Q = P(), E = a.E, n = Math.ceil(dt * 70), h = 2 * seg(t, 0.05, 1.0); for (let i = 0; i < n; i++) { const an = Math.random() * TAU; EM(Q, _b.set(a.gp.x + Math.cos(an) * 0.55, a.gp.y + h, a.gp.z + Math.sin(an) * 0.55), 0, 0, 0, pk(E), rnd(0.025, 0.045), 0.35, { sq: 1, so: 0.5 }); } } };
  MOT.derez = { kind: 'out', dur: 2.8, keys: [[0, 'stand'], [0.3, 'att', 0.3], [0.7, 'salute', 0.35], [1.45, 'salute'], [1.65, 'att', 0.2]],
    body(t, B) { const u = seg(t, 1.75, 2.45); B.s = Math.max(0.02, 1 - stepQ(ein(u), 6)); B.vis = u < 0.99 && (u <= 0 || Math.random() < 0.8); },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sqTex(), 1.6, 2.6, E.c[1], 0.8, 0.2); halo(gp, E.c[2], 2.0, 0.05, 0.6, 0.6, 0.75, 1.72, sqTex()); pillar(gp, dim(E.c[1], 0.6), 0.55, 2.4, 1.0, 1.7, 0.4); at(2.45, () => { glow(hipsAt(a, 0.2).clone(), E.c[2], 2.4, 0.4); ring(gp, E.c[2], 1.6, 0.5); }); },
    tick(a, r, t, dt) { if (t < 1.72 || t > 2.5) return; const Q = P(), E = a.E, n = Math.ceil(dt * 70), h = 2 * (1 - seg(t, 1.72, 2.47)); for (let i = 0; i < n; i++) { const an = Math.random() * TAU; EM(Q, _b.set(a.gp.x + Math.cos(an) * 0.55, a.gp.y + h, a.gp.z + Math.sin(an) * 0.55), 0, 0, 0, pk(E), rnd(0.025, 0.045), 0.35, { sq: 1, so: 0.5 }); } } };
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
  // ===== 전쟁의 신: 붉은 번개가 내리꽂히고 번쩍이는 순간 한 무릎으로 나타나 두 주먹 힘자랑 / 오른팔을 하늘로 들자 번개를 맞고 사라짐 =====
  const sky3 = (gp, k = 1) => new THREE.Vector3(gp.x + rnd(-0.8, 0.8) * k, gp.y + 9, gp.z + rnd(-1.5, -0.5) * k);
  MOT.strikeIn = { kind: 'in', dur: 3.7, keys: [[0, 'land'], [1.0, 'land'], [1.55, 'rise', 0.5], [1.95, 'flex', 0.4], [3.1, 'flex']],
    body(t, B) { B.vis = t > 0.32; },
    fx(a) { const E = a.E, gp = a.gp, g0 = new THREE.Vector3(gp.x, gp.y, gp.z);
      for (const [tt, k] of [[0.02, 0.6], [0.18, 0.8], [0.3, 1.0]]) { bolt(sky3(gp), g0.clone().add(_a.set(rnd(-0.15, 0.15), 0, rnd(-0.15, 0.15))), E.c[0], 0.42, tt, 0.13 * k + 0.05); flash(1 + 1.3 * k, 0.16, tt); }
      shake(0.12, 0.3); ring(gp, E.c[0], 2.8, 0.7, 0.32); ring(gp, E.c[2], 1.5, 0.4, 0.34); decal(gp, tex().lava(), 2.2, 2.6, E.c[2], E.c[0], 0.3); glow(hipsAt(a, 0.5).clone(), E.c[2], 5, 0.4, 0.3); label(E, gp, 0.6);
      at(0.32, () => { const Q = P(); for (let i = 0; i < 60; i++) { const an = Math.random() * TAU, sp = rnd(2.5, 6); EM(Q, _a.set(gp.x, gp.y + 0.1, gp.z), Math.cos(an) * sp, rnd(0.5, 3), Math.sin(an) * sp, pk(E), rnd(0.02, 0.045), rnd(0.2, 0.5), { drag: 3, so: 0.4 }); } });
      for (const tt of [2.0, 2.45, 2.9]) at(tt, () => { chestW(a.rig, _c); bolt(_c.clone().add(_a.set(rnd(-0.6, 0.6), rnd(0.2, 0.7), rnd(-0.3, 0.3))), _c.clone().add(_b.set(rnd(-0.6, 0.6), rnd(-0.9, -0.2), rnd(-0.3, 0.3))), E.c[0], 0.22, 0, 0.05); }); },
    tick(a, r, t, dt) { if (t < 1.9 || t > 3.2 || Math.random() > dt * 30) return; chestW(r, _c); EM(P(), _b.set(_c.x + rnd(-0.4, 0.4), _c.y + rnd(-0.6, 0.6), _c.z + rnd(-0.3, 0.3)), 0, 0.3, 0, pk(a.E), rnd(0.02, 0.04), 0.3, { so: 0.4 }); } };
  MOT.strikeOut = { kind: 'out', dur: 2.4, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.75, 'armUp', 0.4]],
    body(t, B) { B.vis = t < 1.02 || (t < 1.12 && Math.random() < 0.5); },
    fx(a) { const E = a.E, gp = a.gp; at(0.98, () => { hand0(a, _c); bolt(sky3(gp, 0.3), _c.clone(), E.c[0], 0.5, 0, 0.2); flash(2.4, 0.2); shake(0.1); ring(gp, E.c[0], 2.6, 0.6); decal(gp, tex().lava(), 2, 2.2, E.c[2], E.c[0]); glow(hipsAt(a, 0.8).clone(), E.c[2], 5, 0.45); const Q = P(); for (let i = 0; i < 50; i++) { _a.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 5)); EM(Q, hipsAt(a, rnd(0.3, 1.4)), _a.x, _a.y, _a.z, pk(E), rnd(0.02, 0.045), rnd(0.25, 0.55), { drag: 2.5, so: 0.4 }); } }); bolt(sky3(gp), new THREE.Vector3(gp.x + 0.8, gp.y, gp.z - 0.4), E.c[0], 0.3, 0.75, 0.1); } };
  // ===== 하드코어 패왕: 불꼬리를 끌며 떨어져 땅을 주먹으로 내려침 · 용암 균열 · 불 고리 / 땅을 치자 불기둥이 솟아 삼킴 =====
  MOT.slam = { kind: 'in', dur: 3.9, keys: [[0, 'fall'], [0.42, 'punch', 0.06], [1.4, 'punch'], [2.0, 'rise', 0.55], [2.35, 'flex', 0.35], [3.3, 'flex']],
    body(t, B) { if (t < 0.42) B.y = 6.5 * (1 - ein(t / 0.42)); else if (t < 0.55) B.y = -0.05 * Math.sin((t - 0.42) / 0.13 * Math.PI); },
    fx(a) { const E = a.E, gp = a.gp; decal(gp, tex().lava(), 3.6, 3.4, 0xffd0a0, E.c[0], 0.42); sigil(gp, tex().fire(), 2.6, 1.6, E.c[1], 1.5, 0.42, 0.25); ring(gp, E.c[0], 3.2, 0.8, 0.42); ring(gp, E.c[1], 2.0, 0.5, 0.45);
      glow(hipsAt(a, 0.3).clone(), E.c[2], 5.5, 0.45, 0.42); shake(0.16, 0.42); flash(1.9, 0.4, 0.42); label(E, gp, 0.65);
      at(0.42, () => { const Q = P(); for (let i = 0; i < 40; i++) { const an = Math.random() * TAU, sp = rnd(1.5, 4.5); EM(Q, _a.set(gp.x, gp.y + 0.1, gp.z), Math.cos(an) * sp, rnd(2.5, 5.5), Math.sin(an) * sp, 0x2a1a14, rnd(0.04, 0.07), rnd(0.7, 1.2), { g: -11, drag: 0.5, sq: 1, so: 1 }); }
        for (let i = 0; i < 70; i++) { const an = Math.random() * TAU, sp = rnd(1, 4); EM(Q, _a.set(gp.x + Math.cos(an) * 0.4, gp.y + 0.1, gp.z + Math.sin(an) * 0.4), Math.cos(an) * sp, rnd(1, 4), Math.sin(an) * sp, pk(E), rnd(0.03, 0.06), rnd(0.5, 1.2), { g: -2, drag: 1.2, so: 0.55 }); }
        for (let i = 0; i < 10; i++) EM(Q, _a.set(gp.x + rnd(-0.6, 0.6), gp.y + 0.2, gp.z + rnd(-0.6, 0.6)), rnd(-0.6, 0.6), rnd(0.5, 1.4), rnd(-0.6, 0.6), 0x2a2420, rnd(0.35, 0.55), rnd(1.2, 1.8), { grow: 1.3, so: 1, a: 0.55 }); }); },
    tick(a, r, t, dt) { const Q = P(), E = a.E;
      if (t < 0.42) { hipsW(r, _a); const n = Math.ceil(dt * 200); for (let i = 0; i < n; i++) EM(Q, _b.set(_a.x + rnd(-0.25, 0.25), _a.y + rnd(0, 1.3), _a.z + rnd(-0.25, 0.25)), rnd(-0.4, 0.4), rnd(1, 3), rnd(-0.4, 0.4), i % 4 ? pk(E) : 0x2a2420, rnd(0.07, 0.15), rnd(0.2, 0.45), { grow: 0.6, so: i % 4 ? 0.5 : 1 }); }
      else if (t < 3.0 && Math.random() < dt * 34) { const an = Math.random() * TAU, rr = rnd(0.1, 1.5); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + 0.05, a.gp.z + Math.sin(an) * rr), rnd(-0.1, 0.1), rnd(0.6, 1.6), rnd(-0.1, 0.1), pk(E), rnd(0.02, 0.04), rnd(0.8, 1.5), { g: 0.2, so: 0.5 }); } } };
  const firePillar = (a, dur, delay, h = 4.2) => { const E = a.E, gp = a.gp; pillar(gp, dim(E.c[0], 0.5), 0.8, h, dur, delay, 0.45); pillar(gp, dim(0xff3a10, 0.55), 0.5, h * 0.7, dur * 0.9, delay + 0.05, 0.5); sigil(gp, tex().fire(), 2.6, dur, E.c[1], 1.8, delay, 0.15); };
  const fireTick = (a, r, dt, k = 1) => { const Q = P(), E = a.E, n = Math.ceil(dt * 120 * k); for (let i = 0; i < n; i++) { const an = Math.random() * TAU, rr = rnd(0.1, 0.65); EM(Q, _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + rnd(0, 0.5), a.gp.z + Math.sin(an) * rr), -Math.sin(an) * 0.8, rnd(1.5, 4), Math.cos(an) * 0.8, pk(E), rnd(0.06, 0.13), rnd(0.35, 0.7), { grow: -0.5, so: 0.45 }); } };
  MOT.slamOut = { kind: 'out', dur: 2.6, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.62, 'punch', 0.2]],
    body(t, B) { if (t > 0.9) { const u = seg(t, 0.9, 1.45); B.s = 1 - ein(u) * 0.99; B.vis = u < 0.99; } },
    fx(a) { const E = a.E, gp = a.gp; decal(gp, tex().lava(), 3.2, 2.0, 0xffd0a0, E.c[0], 0.62); ring(gp, E.c[0], 2.6, 0.6, 0.62); shake(0.12, 0.62); flash(1.6, 0.3, 0.62); firePillar(a, 1.6, 0.66, 4.5); },
    tick(a, r, t, dt) { if (t > 0.66 && t < 2.1) fireTick(a, r, dt, 1.3); } };
  // ===== 오버로드: 불기둥이 치솟고 그 속에서 웅크린 채 나타나 일어서며 주먹을 손바닥에 탁 · 팔짱 / 팔짱 낀 채 불 소용돌이에 타 사라짐 =====
  MOT.fireStep = { kind: 'in', dur: 4.0, keys: [[0, 'land'], [0.95, 'land'], [1.5, 'rise', 0.5], [1.85, 'stand', 0.3], [2.1, 'fistPalm', 0.22], [2.75, 'fistPalm'], [3.05, 'cross', 0.3], [3.45, 'cross']],
    body(t, B) { B.vis = t > 0.3; },
    fx(a) { const E = a.E, gp = a.gp; firePillar(a, 1.5, 0, 4.6); ring(gp, E.c[0], 2.4, 0.6, 0.05); flash(1.4, 0.3, 0.05); shake(0.06, 0.05); label(E, gp, 0.8);
      at(2.1, () => { chestW(a.rig, _c); _c.y -= 0.05; const fw = _a.set(0, 0, 0.35).applyQuaternion(a.rig.root.quaternion); _c.add(fw); glow(_c, E.c[2], 2.6, 0.3); ring(a.gp, E.c[0], 2.2, 0.5); shake(0.05); const Q = P(); for (let i = 0; i < 40; i++) { const an = Math.random() * TAU; EM(Q, _c, Math.cos(an) * rnd(1.5, 3.5), rnd(-0.5, 1.5), Math.sin(an) * rnd(1.5, 3.5), pk(E), rnd(0.03, 0.05), rnd(0.3, 0.6), { drag: 2.5, so: 0.5 }); } }); },
    tick(a, r, t, dt) { if (t < 1.4) fireTick(a, r, dt, 1 - t / 1.6); else if (t < 3.6 && Math.random() < dt * 20) EM(P(), _b.set(a.gp.x + rnd(-0.8, 0.8), a.gp.y + 0.05, a.gp.z + rnd(-0.8, 0.8)), 0, rnd(0.6, 1.4), 0, pk(a.E), rnd(0.02, 0.04), rnd(0.8, 1.3), { so: 0.5 }); } };
  MOT.burnOut = { kind: 'out', dur: 2.7, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'cross', 0.4]],
    body(t, B) { if (t > 1.5) { const u = seg(t, 1.5, 2.0); B.s = 1 - ein(u) * 0.99; B.ry = ein(u) * 3; B.vis = u < 0.99; } },
    fx(a) { const E = a.E, gp = a.gp; firePillar(a, 1.7, 0.85, 4); for (let i = 0; i < 3; i++) halo(gp, E.c[i % 2], 0.1, 2.2, 0.75, 0.35, 0.9, 0.95 + i * 0.25, tex().fire()); at(2.0, () => { glow(hipsAt(a, 0.5).clone(), E.c[2], 3, 0.4); ring(gp, E.c[0], 2, 0.5); }); },
    tick(a, r, t, dt) { if (t > 0.85 && t < 2.3) fireTick(a, r, dt, 1.2); } };
  // ===== 이터널: 보랏빛 구슬들이 돌며 모여 몸이 빚어지고 두 손을 펴 하늘을 봄 / 구슬로 흩어지며 올라감 =====
  const orbs = (a, t, dt, inward) => { const Q = P(), E = a.E; for (let i = 0; i < 9; i++) { const ph = i * TAU / 9, u = inward ? seg(t, 0, 1.4) : seg(t, 1.0, 2.2), rr = inward ? 1.6 * (1 - eout(u)) + 0.05 : 0.1 + 1.8 * ein(u), an = ph + t * (inward ? 3.2 : 2.6), y = inward ? 0.4 + i * 0.16 + (1 - u) * 0.6 : 1.0 + u * 2.4 + i * 0.05;
    _b.set(a.gp.x + Math.cos(an) * rr, a.gp.y + y, a.gp.z + Math.sin(an) * rr); EM(Q, _b, 0, 0, 0, i % 3 ? E.c[0] : E.c[2], 0.2, 0.1, { so: 0.15 }); EM(Q, _b, 0, 0, 0, E.c[1], 0.34, 0.08, { so: 0, a: 0.5 }); if (Math.random() < 0.8) EM(Q, _b, rnd(-0.15, 0.15), rnd(-0.15, 0.15), rnd(-0.15, 0.15), pk(E), 0.07, 0.6, { so: 0.3 }); } };
  MOT.orbForm = { kind: 'in', dur: 4.0, keys: [[0, 'float'], [1.35, 'float'], [1.7, 'tall', 0.35], [2.0, 'tall'], [2.35, 'open', 0.35], [3.3, 'open']],
    body(t, B) { const u = seg(t, 0.25, 1.4); B.s = Math.max(0.01, eout(u)); B.ry = (1 - eout(u)) * TAU; B.y = 0.25 * (1 - eout(u)); B.vis = t > 0.25; },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 2.6, 3.8, E.c[0], -0.5, 0); glow(hipsAt(a, 0.5).clone(), E.c[2], 4, 0.5, 1.4); ring(gp, E.c[0], 2.4, 0.7, 1.4); ring(gp, E.c[1], 1.5, 0.5, 1.45); flash(1.3, 0.3, 1.4); label(E, gp, 1.5);
      for (let i = 0; i < 2; i++) halo(gp, E.c[i], 1.9, 0.1, 0.4, 0.9, 1.0, 1.4 + i * 0.2); },
    tick(a, r, t, dt) { if (t < 1.45) orbs(a, t, dt, true); else if (t > 2.3 && t < 3.4 && Math.random() < dt * 30) { const Q = P(); for (const s of [-1, 1]) { hand0(a, _c, s); EM(Q, _c, rnd(-0.1, 0.1), rnd(0.3, 0.8), rnd(-0.1, 0.1), pk(a.E), rnd(0.03, 0.05), rnd(0.5, 0.9), { so: 0.4 }); } } } };
  MOT.orbOut = { kind: 'out', dur: 2.8, keys: [[0, 'stand'], [0.3, 'stand', 0.3], [0.7, 'open', 0.4], [1.0, 'open'], [1.3, 'float', 0.3]],
    body(t, B) { if (t > 1.0) { const u = seg(t, 1.0, 1.9); B.s = Math.max(0.01, 1 - eout(u)); B.ry = eout(u) * TAU; B.y = u * 0.4; B.vis = u < 0.99; } },
    fx(a) { const E = a.E, gp = a.gp; sigil(gp, sigilTex(), 2.4, 2.6, E.c[0], 0.5, 0.15); ring(gp, E.c[0], 2.2, 0.6, 1.0); glow(hipsAt(a, 0.6).clone(), E.c[2], 3, 0.5, 1.85); },
    tick(a, r, t, dt) { if (t > 1.0 && t < 2.3) orbs(a, t, dt, false); } };
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
    const p = rig.root.position, a = { k, E, M, dir, t: 0, rig, yaw: rig.baseYaw != null ? rig.baseYaw : 0.3, gp: { x: p.x, y: p.y, z: p.z, snow: p.y < 0.05 && typeof WINTER !== 'undefined' && WINTER.on() }, o: { t: 0 }, ghost: dir === 'out' && k !== 'me' ? rig : null, back: dir === 'out' && k === 'me', gunShown: false };
    AN.set(k, a); M.fx(a);
    if (typeof Audio !== 'undefined' && Audio.partyFx) Audio.partyFx(dir === 'bye' || dir === 'back' ? 'bye' : mo);
  }
  function stop(L, k, a) { const r = rigOf(L, k, a); if (r) { r.body.scale.set(1, 1, 1); r.gunMount.visible = true; } if (a.ghost) dropGhost(L, a.ghost); AN.delete(k); }
  function dropGhost(L, g) { const i = GH.indexOf(g); if (i >= 0) GH.splice(i, 1); if (g.root.parent) g.root.parent.remove(g.root); g.skel.dispose(); }
  // 한 프레임: 이미 쉬는 자세(Lobby.pose)가 놓인 리그 위에 동작을 덮어 쓴다
  function drive(a, r, dt) {
    a.t += dt; const t = a.t, M = a.M, K = M.keys; a.rig = r;
    grab(r, IDL); const iy = r.root.rotation.y;
    const B = Object.assign(BB, B0); if (M.body) M.body(t, B, a);
    let i = 0; while (i < K.length - 1 && t >= K[i + 1][0]) i++;
    const k0 = K[i], k1 = K[i + 1]; let w = 0;
    if (k1) { const b = k1[2] || 0.35; w = sstep(k1[0] - b, k1[0], t); }
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
    const gone = new Map();
    if (ok && prev && pid && pid === lastPid) {
      for (const [u, f] of ids) if (!prev.has(u)) { const E = valid(f.ent, f.name); if (E) pend.push([u, E]); }
      for (const [u, f] of prev) if (!ids.has(u)) { const E = valid(f.ent, f.name); if (E) gone.set(u, E); }
    }
    if (ok && pid && pid !== lastPid && !Party.isLeader()) { const E = byId(mine()); if (E) pend.push(['me', E, 'in']); }   // 내가 남의 파티에 들어감
    if (ok && lastPid && !pid) { const E = byId(mine()); if (E) pend.push(['me', E, 'bye']); }   // 내가 파티에서 나옴
    lastPid = pid;
    return gone;
  }
  // 나간 파티원의 리그를 넘겨받아 퇴장 연출 (없으면 false → 부른 쪽이 정리)
  function ghost(L, rig, E) { if (!E || !rig) return false; GH.push(rig); play(L, rig.uid, E, 'out', rig); return true; }
  // 새 리그가 만들어진 뒤: 같은 uid 의 유령은 바로 치우고, 들어온 사람은 입장
  function bound(L) {
    for (const m of L.mates) { const a = AN.get(m.uid); if (m.uid && a && a.ghost) stop(L, m.uid, a); }
    for (const [u, E, dir] of pend) { if (u === 'me') play(L, 'me', E, dir, L.rig); else { const r = L.mates.find((m) => m.uid === u); if (r) play(L, u, E, 'in', r); } }
    pend = [];
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
    P();   // 로비 입자 풀을 계속 써 둔다 (안 쓰면 치워졌다가 다음 연출 때 셰이더를 다시 만들어 멈칫함)
    if (L.sc) { clear(L); return; }   // 상점 진열 중: 모두 그만
    for (const [k, a] of AN) {
      const r = rigOf(L, k, a);
      if (!r || !r.root.parent) { AN.delete(k); if (a.ghost) dropGhost(L, a.ghost); continue; }
      if (a.ghost) { L.pose(r, L.t + (r.ph || 0), r.baseYaw || 0); r.root.visible = L.fk < 0.5; }
      drive(a, r, dt);
      if (a.t >= a.M.dur) { stop(L, k, a); if (a.back) play(L, 'me', a.E, 'back', L.rig); }   // 퇴장 미리 보기: 사라진 내 캐릭터가 다시 나타남 (같은 프레임에 이어서 돌아 깜빡이지 않음)
    }
    tickFx(dt); tickEnv(dt, L); tickBan(dt);
    for (const [u] of SPOT) if (!(lastIds && lastIds.has(u)) && !GH.some((g) => g.uid === u)) SPOT.delete(u);
  }
  function clear(L) { for (const [k, a] of [...AN]) stop(L, k, a); for (const b of BAN) b.el.remove(); BAN.length = 0; for (const e of LIVE) if (e.o) { if (e.o.parent) e.o.parent.remove(e.o); free(e.o); } LIVE.length = 0; ENV.length = 0; tickEnv(0, L); }
  // 카메라 흔들림 (Lobby.update 끝에서)
  function cam(c, dt) { if (SHK < 0.002) { SHK = 0; return; } c.position.x += (Math.random() - 0.5) * SHK; c.position.y += (Math.random() - 0.5) * SHK; SHK *= Math.pow(0.015, dt); }
  // 미리 보기: 내 캐릭터로 입장(in)·작별(bye) — 계정 창에서
  function preview(id, dir = 'in') { const E = byId(id), L = LOB || (typeof Lobby !== 'undefined' ? Lobby : null); if (!E || !L || !L.rig) return false; play(L, 'me', E, dir, L.rig); return true; }

  // ---------- 계정 창 탭: 입장 연출 고르기 ----------
  function profTab(B) {
    const cur = pref(), act = mine(), list = ENT.filter(avail);
    const head = document.createElement('p'); head.className = 'micro'; head.textContent = '새 티어(노바·셀레스티얼·이클립스·제니스)나 어려운 칭호를 가진 사람은 파티에 들어오고 나갈 때 로비에서 캐릭터가 직접 등장·퇴장합니다. 같은 파티 모두의 화면에 보입니다.'; B.appendChild(head);
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
      const how = E.t != null ? `랭크 ${nameOf(E)} 도달 (최고 기록)` : (T && T.desc) || '';
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
  const MOVE = { podium: '금빛 조명 속 등장 · 두 팔 V · 색종이 · 왕관', spinfall: '하늘의 별 · 빛줄기 속을 돌며 강하 · 충격파 · 승리의 주먹', slam: '불꼬리 낙하 · 땅을 주먹으로 · 용암 균열', emerge: '일식 · 붉은 구멍에서 팔짱 낀 채 솟아오름', rez: '은빛 고리가 훑으며 나타나 경례 · 별 훈장',
    descend: '금빛 빛기둥 속으로 천천히 강림 · 축복', meteor: '유성처럼 떨어져 한 무릎 착지 · 충격파', fireStep: '불기둥 속에서 등장 · 주먹을 손바닥에', orbForm: '보랏빛 구슬이 모여 몸이 빚어짐', escape: '백룸 복도 문틈에서 몸을 던져 탈출 · 낚아채려는 검은 손', strikeIn: '붉은 번개 세 줄기 · 힘자랑' };
  const MOVE_OUT = { bowOut: '가슴에 손 얹고 인사 · 색종이 · 금빛으로 사라짐', spinOut: '경례 후 돌며 솟아올라 별로 흩어짐', slamOut: '땅을 내려쳐 솟은 불기둥에 삼켜짐', sink: '팔짱 낀 채 붉은 구멍 속으로 가라앉음', derez: '경례 후 위에서부터 훑어 사라짐',
    ascend: '빛기둥을 타고 떠올라 빛으로', launch: '웅크렸다 하늘로 솟구침', burnOut: '팔짱 낀 채 불 소용돌이에 타 사라짐', orbOut: '보랏빛 구슬로 흩어지며 올라감', noclip: '바닥에 열린 백룸 구멍으로 떨어짐', strikeOut: '팔을 하늘로 뻗자 번개를 맞고 사라짐' };

  return { ENT, MOT, KP, mine, mineList, valid, ok, avail, nameOf, owned, team, ghost, bound, spot, update, cam, clear, preview, profTab, play, get anims() { return AN; }, get ghosts() { return GH; }, get live() { return LIVE.length; },
    _rigPose(r, name, t = 0) { evalKey(r, name, Object.assign(BB, B0), { t }); } };
})();
