// ============================================================
// 02_world_xmas.js — 크리스마스 섬 (v22, 1.5×1.5km 눈 덮인 섬 · MAPS.xmas.v2 = 'xmas')
//  v2 생성기(02_world_v2.js)의 단계마다 끼어든다: 지형(xmLayout) · 지역(xmPlacePois) · 표면(xmSurf) · 구조물(xmBuild) · 식생(xmVegetation)
//  · 지형: 잡음 해안선 · 눈 덮인 구릉 · 둥근 산 2개(큰 산에 스키 산장) · 얼어붙은 호수(얼음판 위를 걸을 수 있음) · 강 없음
//  · 지역(자체 작명): 북극성 광장(섬 가운데 큰 트리·크리스마스 마켓) · 벨타운(격자 거리) · 산타 공방 · 은빛 호수(얼음낚시 오두막·스케이트장)
//    · 눈꽃 산장 · 프로스트 기지 · 캔디케인 공장 · 순록 목장 · 선물 물류창고 · 마을 4
//  · 집은 02_world_house.js 의 새 외형 + 지붕 눈·고드름·전구·화환·선물·마당 트리
//  · 식생: 눈 쌓인 전나무(줄기·잎·눈을 한 메시로) · 눈 덮인 활엽수 · 눈 모자 바위 · 눈 덤불 → 구역마다 그리기 4번
//  · 경기 중 내리는 눈(XmasFx) · 전구 반짝임(HTX.TW)
// ============================================================
const XM_ICE = 0.6;   // 얼음판 높이 (바다 수면 0 보다 높아 걸어 다닐 수 있다)
const XM_NAMES = {
  xsquare: ['북극성 광장'], city: ['벨타운'], xworkshop: ['산타 공방'], xlake: ['은빛 호수'], xlodge: ['눈꽃 산장'], military: ['프로스트 기지'],
  industrial: ['캔디케인 공장'], farm: ['순록 목장'], depot: ['선물 물류창고'], village: ['홀리 마을', '진저 마을', '미슬토 마을', '윈터벨 마을', '스노우드롭 마을'],
};
const XM_PAL = { house: [[0xf4efe6, 0x9c3a2e], [0xe8d8c0, 0x3a5a3a], [0xc8402e, 0xf4f0ea], [0x2f5a3a, 0xf4f0ea], [0xf2e6c8, 0x7a2a2a]] };
for (const t of ['xsquare', 'xworkshop', 'xlake', 'xlodge']) V2_GATED.add(t);

// ---------- 지형 ----------
function xmLayout(K) {
  const { R, rng } = K, H = HALF;
  const nC = makeNoise(rng), nR = makeNoise(rng), nH = makeNoise(rng), nF = makeNoise(rng);
  Object.assign(K, { nC, nR, nH, nF });
  const edgeF = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)) * 0.55 + Math.hypot(x, z) * 0.45 + fbm(nC, x * 3.6 / SIZE + 3.1, z * 3.6 / SIZE - 1.7, 4) * H * 0.2; return sstep(H * 0.74, H * 0.93, d); };
  const river = { w: 6, none: true }, riverDist = () => 1e9;
  // 둥근 산 2개: 큰 산(55~70m, 스키 산장) + 작은 언덕
  const ranges = [];
  for (let t = 0; t < 600 && ranges.length < 2; t++) {
    const big = !ranges.length, L = big ? R(160, 260) : R(90, 160), hw = big ? R(170, 220) : R(110, 150), top = big ? R(58, 70) : R(26, 36);
    const lim = H * 0.42, cx = R(-lim, lim), cz = R(-lim, lim), a = R(0, Math.PI);
    if (Math.hypot(cx, cz) < 230 || ranges.some((r) => Math.hypot(r.cx - cx, r.cz - cz) < r.hw + hw + 120)) continue;
    const pts = [[cx - Math.cos(a) * L / 2, cz - Math.sin(a) * L / 2], [cx + Math.cos(a) * L / 2, cz + Math.sin(a) * L / 2]];
    if (pts.some((q) => edgeF(q[0], q[1]) > 0)) continue;
    const dx = pts[1][0] - pts[0][0], dz = pts[1][1] - pts[0][1], m = hw * 1.6;
    ranges.push({ cx, cz, pts, segs: [[pts[0][0], pts[0][1], dx, dz, dx * dx + dz * dz]], hw, top, L, a, ph: R(0, TAU), x0: Math.min(pts[0][0], pts[1][0]) - m, x1: Math.max(pts[0][0], pts[1][0]) + m, z0: Math.min(pts[0][1], pts[1][1]) - m, z1: Math.max(pts[0][1], pts[1][1]) + m });
  }
  let lastW = 0;
  const rangeH = (x, z) => {
    let hB = 0; lastW = 0;
    for (const r of ranges) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const S = r.segs[0]; let t = ((x - S[0]) * S[2] + (z - S[1]) * S[3]) / S[4]; t = clamp(t, 0, 1);
      const d = Math.hypot(x - S[0] - S[2] * t, z - S[1] - S[3] * t) * (1 + fbm(K.n3, x * 0.004 + 7, z * 0.004 - 3, 2) * 0.4);
      if (d >= r.hw) continue;
      const v = 1 - d / r.hw, prof = v * v * (3 - 2 * v), rid = clamp(1 - Math.abs(fbm(nR, x * 0.012, z * 0.012, 3)) * 1.4, 0, 1);
      const hh = r.top * (0.82 + 0.18 * Math.sin(t * 5 + r.ph)) * Math.pow(prof, 1.3) * (0.85 + 0.15 * rid);
      if (hh > hB) hB = hh; if (prof > lastW) lastW = prof;
    }
    return hB;
  };
  const mountW = (x, z) => { rangeH(x, z); return lastW; };
  // 얼어붙은 호수: 산·해안에서 떨어진 안쪽
  let lake = null;
  for (let t = 0; t < 800 && !lake; t++) {
    const x = R(-H * 0.5, H * 0.5), z = R(-H * 0.5, H * 0.5), r = R(88, 108);
    if (Math.hypot(x, z) < 170 || mountW(x, z) > 0 || ranges.some((m) => Math.hypot(m.cx - x, m.cz - z) < m.hw + r + 40)) continue;
    let bad = false; for (let k = 0; k < 8 && !bad; k++) { const aa = k * TAU / 8; if (edgeF(x + Math.cos(aa) * (r + 90), z + Math.sin(aa) * (r + 90)) > 0) bad = true; }
    if (!bad) lake = { x, z, r };
  }
  K.xlake = lake;
  const rawH = (x, z) => {
    const hm = sstep(-0.1, 0.3, fbm(nH, x * 0.0016 + 5, z * 0.0016, 2));
    let h = 5 + fbm(K.n1, x * 0.0035, z * 0.0035, 4) * 9 + Math.max(0, fbm(nH, x * 0.006, z * 0.006, 3)) * 18 * hm + fbm(K.n2, x * 0.03, z * 0.03, 2) * 0.7;
    h = Math.max(h, 1.8);
    const mh = rangeH(x, z); if (mh > 0) h += mh;
    if (lake) { const ld = Math.hypot(x - lake.x, z - lake.z); if (ld < lake.r + 60) h = lerp(h, XM_ICE, sstep(lake.r + 52, lake.r - 2, ld)); }
    return lerp(h, -9, edgeF(x, z));
  };
  Object.assign(K, { edgeF, river, riverDist, mountW, rangeH, rawH, lakes: [], ranges });
  return { riverDist, edgeF, mountW, river, lakes: [], ranges };
}

// ---------- 지역 ----------
function xmPlacePois(K) {
  const { w, R, rng } = K, H = HALF, lk = K.xlake, used = new Set();
  const S = [
    ['xsquare', 40, 'high', { center: true, dropW: 2.8 }], ['city', 80, 'high', { pal: XM_PAL.house, towerP: 0.18, towerH: 9, dropW: 2.4 }],
    ['xworkshop', 56, 'top', { dropW: 2.4 }], ['xlake', 0, 'mid', { dropW: 1.6 }], ['xlodge', 46, 'high', { dropW: 2 }],
    ['military', 60, 'top'], ['industrial', 56, 'mid'], ['farm', 48, 'low'], ['depot', 34, 'mid'],
    ['village', 38, 'low', { pal: XM_PAL.house }], ['village', 38, 'low', { pal: XM_PAL.house }], ['village', 38, 'low', { pal: XM_PAL.house }], ['village', 36, 'low', { pal: XM_PAL.house }],
  ];
  const nameOf = (type) => { const pool = (XM_NAMES[type] || [type]).filter((n) => !used.has(n)); const nm = pool.length ? pool[Math.floor(rng() * pool.length)] : (XM_NAMES[type] || [type])[0] + ' ' + (w.pois.length + 1); used.add(nm); return nm; };
  for (const [type, r0, tier, o0] of S) {
    const o = o0 || {};
    if (type === 'xlake') {   // 호수: 얼음판 가운데 (지역 반경 = 호수 반경 - 30 → 평탄화가 호숫가까지)
      if (!lk) continue;
      const p = Object.assign({ type, x: lk.x, z: lk.z, r: lk.r - 30, h: XM_ICE, tier, name: nameOf(type), lake: lk }, o);
      const l = Math.hypot(lk.x, lk.z) || 1; p.ent = [-lk.x / l, -lk.z / l]; p.rx = lk.x + p.ent[0] * (lk.r + 6); p.rz = lk.z + p.ent[1] * (lk.r + 6);
      w.pois.push(p); continue;
    }
    const r = r0, cands = [], gap = 64;
    const dmin = (x, z) => { let md = 1e9; for (const p of w.pois) md = Math.min(md, Math.hypot(p.x - x, p.z - z) - (p.type === 'xlake' ? p.lake.r : p.r) - r); return md; };
    for (let a = 0; a < 3000 && cands.length < 24; a++) {
      const lim = o.center ? H * (a < 1500 ? 0.2 : 0.38) : H * 0.78, x = R(-lim, lim), z = R(-lim, lim);
      if (dmin(x, z) < gap) continue;
      if (lk && Math.hypot(x - lk.x, z - lk.z) < lk.r + r + 34) continue;
      if (K.edgeF(x, z) > 0.001) continue;
      let bad = false; for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) if (K.edgeF(x + sx * r, z + sz * r) > 0.01) bad = true; if (bad) continue;
      const mw = K.mountW(x, z);
      if (type === 'xlodge') { if (mw < 0.32 || mw > 0.78) continue; } else if (type !== 'military' && mw > 0.22) continue;
      cands.push([x, z, dmin(x, z)]);
    }
    if (!cands.length) continue;
    if (o.center) cands.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1])); else cands.sort((a, b) => b[2] - a[2]);
    const c = cands[Math.floor(rng() * Math.min(3, cands.length))], hh = K.rawH(c[0], c[1]);
    const p = Object.assign({ type, x: c[0], z: c[1], r, h: type === 'xlodge' ? clamp(hh, 4, 140) : clamp(hh, 3, 30), tier, name: nameOf(type) }, o);
    if (V2_GATED.has(type)) { let ex = -p.x, ez = -p.z; const l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l; p.ent = [ex, ez]; p.rx = p.x + ex * r * 1.02; p.rz = p.z + ez * r * 1.02; }
    w.pois.push(p);
  }
}

// ---------- 표면 (0 눈밭 · 1 녹은 흙 · 2 바위 · 3 언 모래 · 4 도로 · 5 포장 · 6/7 눈 덮인 밭 · 8 숲 눈 · 9 얼음) ----------
function xmSurf(K, x, z, h, mw, rdist) {
  if (rdist < 4.6) return 4;
  const lk = K.xlake; if (lk && h < XM_ICE + 0.35 && Math.hypot(x - lk.x, z - lk.z) < lk.r + 2) return 9;
  if (h < 1.1 || (K.edgeF(x, z) > 0 && h < 2.4)) return 3;
  for (const p of K.poisNear(x, z)) {
    const d = Math.hypot(x - p.x, z - p.z);
    switch (p.type) {
      case 'farm': if (d < p.r + 50 && d > 22) return v2Parcel(x, z); break;
      case 'village': if (d < p.r * 0.85) return fbm(K.n4, x * 0.08, z * 0.08, 2) > 0.25 ? 1 : 0; break;
      case 'xlake': break;
      case 'xsquare': if (d < p.r - 4) return d < 15 ? 5 : 0; break;   // 트리 둘레만 포장, 마켓은 눈 위
      case 'city': if (d < p.r - 4) return 0; break;                   // 눈 덮인 읍내 (거리는 도로 리본)
      case 'xworkshop': case 'xlodge': if (d < p.r - 4) return d < p.r * 0.32 ? 5 : 0; break;
      default: if (d < p.r - 4) return 5;
    }
  }
  // 산꼭대기도 눈 (바위는 급경사만 — 02_world.js 경사 규칙)
  return fbm(K.n4, x * 0.0055, z * 0.0055, 3) + mw * 0.5 > -0.02 ? 8 : 0;
}

// ---------- 구조물 도구 ----------
const XM_SNOW = 0xf4f8fb;
function xmLitStar(K, x, y, z, s, col = 0xffd65a) {   // 별(빛남): 엇갈린 두 판 · 양면
  const B = K.getBatch(x, z, 'lit'), P = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.42 : s; P.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  for (const ax of [0, 1]) for (let i = 0; i < 10; i++) {
    const p = P[i], q = P[(i + 1) % 10], A = ax ? [x, y, z] : [x, y, z], Bp = ax ? [x, y + p[1], z + p[0]] : [x + p[0], y + p[1], z], Cq = ax ? [x, y + q[1], z + q[0]] : [x + q[0], y + q[1], z];
    B.poly([A, Bp, Cq], col, 1.0); B.poly([A, Cq, Bp], col, 1.0);
  }
}
function xmGift(K, x, z, s, collide) {   // 큰 선물 상자 (collide: 엄폐물 충돌)
  const y = heightAt(x, z), c = [0xc8202e, 0x2a7a3a, 0x2a5ac8, 0xe8c45a, 0x8a3aa8][Math.floor(K.rng() * 5)], rc = c === 0xe8c45a ? 0xc8202e : 0xf2e8c8, h = s * 0.85;
  const pat = HTX.P[['gift1', 'gift2', 'gift3'][Math.floor(K.rng() * 3)]];
  K.addBox(x - s / 2, y - 0.3, z - s / 2, x + s / 2, y + h, z + s / 2, c, collide ? { mat: 'tex', pat, uo: [x, y, z] } : { noCollide: true, mat: 'tex', pat, uo: [x, y, z] });
  K.addBox(x - s / 2 - 0.02, y, z - s * 0.08, x + s / 2 + 0.02, y + h + 0.02, z + s * 0.08, rc, { noCollide: true });
  K.addBox(x - s * 0.08, y, z - s / 2 - 0.02, x + s * 0.08, y + h + 0.02, z + s / 2 + 0.02, rc, { noCollide: true });
  K.addBox(x - s * 0.2, y + h, z - s * 0.1, x + s * 0.2, y + h + s * 0.18, z + s * 0.1, rc, { noCollide: true });
  K.addBox(x - s * 0.1, y + h, z - s * 0.2, x + s * 0.1, y + h + s * 0.16, z + s * 0.2, rc, { noCollide: true });
}
function xmBulbLine(K, a, b, n, sag = 0.25) { for (let i = 0; i <= n; i++) { const u = i / n, x = lerp(a[0], b[0], u), z = lerp(a[2], b[2], u), y = lerp(a[1], b[1], u) - Math.sin(Math.PI * u) * sag; K.getBatch(x, z, 'lit').oct(x, y, z, 0.06, BULBS[i % BULBS.length], K.rng() * TAU); } }
function xmLamp(K, x, z) {   // 가로등 (기둥 충돌) + 따뜻한 등 + 화환 띠
  const y = heightAt(x, z); K.addBox(x - 0.09, y - 0.4, z - 0.09, x + 0.09, y + 3.6, z + 0.09, 0x2a2e30);
  K.addBox(x - 0.24, y + 3.6, z - 0.24, x + 0.24, y + 3.72, z + 0.24, 0x2a2e30, { noCollide: true });
  K.getBatch(x, z, 'lit').oct(x, y + 3.45, z, 0.2, 0xffe2a0, 0);
  K.addBox(x - 0.13, y + 2.6, z - 0.13, x + 0.13, y + 2.85, z + 0.13, 0x1f5a32, { noCollide: true }); K.addBox(x - 0.05, y + 2.45, z - 0.15, x + 0.05, y + 2.62, z - 0.13, 0xc8202e, { noCollide: true });
}
// 거대 트리: 줄기·아래 가지 충돌 · 원뿔 6단 + 눈 · 나선 전구 · 장식 공 · 꼭대기 별 · 선물 더미(엄폐물)
function xmGiantTree(K, x, z, y, H) {
  K.addBox(x - 0.8, y - 0.5, z - 0.8, x + 0.8, y + 2.4, z + 0.8, 0x4a2e1a);
  K.addBox(x - 3.4, y + 1.9, z - 3.4, x + 3.4, y + H * 0.85, z + 3.4, 0, { invisible: true });
  const T = 6;
  for (let i = 0; i < T; i++) {
    const u = i / T, r = lerp(6.0, 1.3, u), h = H * 0.26, yy = y + 1.9 + u * H * 0.78;
    v2Geo(K, new THREE.ConeGeometry(r, h, 14), x, yy + h / 2, z, i % 2 ? 0x1d4a2e : 0x22543a);
    v2Geo(K, new THREE.ConeGeometry(r * 0.8, h * 0.34, 14, 1, true), x, yy + h * 0.83, z, XM_SNOW);
  }
  for (let i = 0; i < 170; i++) { const u = i / 170, yy = y + 2.2 + u * H * 0.92, rr = lerp(6.0, 0.8, (yy - y - 1.9) / (H * 1.02)) + 0.05, a = u * TAU * 7; K.getBatch(x, z, 'lit').oct(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, 0.11, BULBS[i % BULBS.length], i * 0.7); }
  const ball = new THREE.SphereGeometry(0.26, 8, 6);
  for (let i = 0; i < 34; i++) { const u = (i + 0.5) / 34, yy = y + 2.3 + u * H * 0.8, rr = lerp(5.6, 1.2, u), a = i * 2.4; v2Geo(K, ball, x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, i % 3 === 0 ? 0xd9a93a : i % 3 === 1 ? 0xc8202e : 0xe8e8f0); }
  xmLitStar(K, x, y + H + 2.4, z, 1.3);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3, d = 4.8 + (i % 2) * 1.1; xmGift(K, x + Math.cos(a) * d, z + Math.sin(a) * d, 0.9 + (i % 3) * 0.35, true); }
}
// 지역 좌표 F 로 만드는 작은 오두막 (마켓 가판대 · 얼음낚시 오두막): 문 · 창 · 박공 지붕 + 눈 · 전구 · 전리품
function xmHut(K, F, wd, dp, wallC, roofC, tier, o = {}) {
  const hw = wd / 2, hd = dp / 2, t = 0.12, H = 2.4, uo = [F.cx, F.by, F.cz], WO = { mat: 'tex', pat: HTX.P[o.wp || 'plank'], uo };
  F.box(-hw - 0.1, -0.6, -hd - 0.1, hw + 0.1, 0.12, hd + 0.1, 0x6b4a32, { nav: true, mat: 'tex', pat: HTX.P.floor, uo });
  if (o.stall) F.wallX(-hd, -hw, hw, 0.12, H, t, [{ a: -hw + 0.4, b: hw - 0.4, lo: 1.0, hi: 2.1 }], wallC, WO);   // 가판대: 앞이 계산대 (넘기 가능)
  else F.wallX(-hd, -hw, hw, 0.12, H, t, [K.WIN(-0.6, 1.2)], wallC, WO);
  F.wallX(hd, -hw, hw, 0.12, H, t, [], wallC, WO);
  F.wallZ(-hw, -hd + t / 2, hd - t / 2, 0.12, H, t, [K.DOOR(-0.9)], wallC, WO);
  F.wallZ(hw, -hd + t / 2, hd - t / 2, 0.12, H, t, o.stall ? [] : [K.WIN(-0.6, 1.2)], wallC, WO);
  F.box(-hw - 0.15, H + 0.12, -hd - 0.15, hw + 0.15, H + 0.24, hd + 0.15, 0x5a4636);
  F.geo(K.prism(wd + 0.7, dp + 0.7, 1.1), 0, H + 0.24, 0, roofC);
  F.geo(K.prism(wd + 0.6, dp + 0.7, 1.1), 0, H + 0.32, 0, XM_SNOW);   // 눈: 지붕과 같은 기울기로 8cm 위
  if (o.stall) { F.box(-hw + 0.3, 0.12, -hd + 0.15, hw - 0.3, 1.0, -hd + 0.6, 0x7a5a3a); F.box(-hw + 0.25, 0.98, -hd - 0.12, hw - 0.25, 1.06, -hd + 0.62, 0x9a7a52, { noCollide: true }); }
  const fr = [F.pt(-hw - 0.2, -hd - 0.4), F.pt(hw + 0.2, -hd - 0.4)];
  xmBulbLine(K, [fr[0][0], F.by + H + 0.1, fr[0][1]], [fr[1][0], F.by + H + 0.1, fr[1][1]], Math.round(wd / 0.32), 0.12);
  F.loot(0, 0.14, 0.4, tier); if (wd * dp > 11) F.loot(hw - 0.7, 0.14, -0.2, tier);
  if (o.sign !== undefined) { F.box(-1.08, H + 0.3, -hd - 0.44, 1.08, H + 0.84, -hd - 0.38, 0x3a2a1e, { noCollide: true }); const P = HTX.P['sign' + o.sign], a = F.pt(1.0, -hd - 0.45), b = F.pt(-1.0, -hd - 0.45), y0 = F.by + H + 0.34, y1 = F.by + H + 0.8; K.getBatch(F.cx, F.cz, 'tex').poly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], 0xf6f0e0, P, [[0, 0.999], [0.999, 0.999], [0.999, 0.001], [0, 0.001]]); }
}
function xmSleigh(K, x, z, ry) {   // 썰매 (엄폐물): 붉은 몸통 · 금빛 테 · 활주부 · 선물 자루
  const y = heightAt(x, z), c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  K.addBox(x - 2.2, y - 0.3, z - 2.2, x + 2.2, y + 1.3, z + 2.2, 0, { invisible: true });
  v2Geo(K, new THREE.BoxGeometry(1.6, 0.9, 3.0), x, y + 0.85, z, 0xb8202a, 0, ry); v2Geo(K, new THREE.BoxGeometry(1.7, 0.12, 3.1), x, y + 1.32, z, 0xd9a93a, 0, ry);
  { const q = P(0, -1.2); v2Geo(K, new THREE.BoxGeometry(1.6, 0.9, 0.7), q[0], y + 1.6, q[1], 0xb8202a, 0, ry); }
  for (const sx of [-0.75, 0.75]) { const q = P(sx, 0); v2Geo(K, new THREE.BoxGeometry(0.1, 0.12, 3.8), q[0], y + 0.12, q[1], 0xd9a93a, 0, ry); const q2 = P(sx, 1.85); v2Geo(K, new THREE.TorusGeometry(0.35, 0.05, 6, 10, Math.PI), q2[0], y + 0.45, q2[1], 0xd9a93a, 0, ry + Math.PI / 2); }
  { const q = P(0, 0.6); v2Geo(K, new THREE.SphereGeometry(0.75, 10, 8), q[0], y + 1.5, q[1], 0x8a5a2a); }
}
function xmReindeer(K, x, z, ry) {   // 순록 조형물 (충돌 없음): 몸통 · 다리 · 목 · 머리 · 뿔 · 빨간 코
  const y = heightAt(x, z), c = Math.cos(ry), s = Math.sin(ry), P = (lx, ly, lz, g, col, rx = 0) => { v2Geo(K, g, x + lx * c + lz * s, y + ly, z - lx * s + lz * c, col, rx, ry); };
  const B = 0x8a5a3a, L = 0x6b4430;
  P(0, 1.15, 0, new THREE.BoxGeometry(0.55, 0.55, 1.3), B);
  for (const [lx, lz] of [[-0.18, -0.45], [0.18, -0.45], [-0.18, 0.45], [0.18, 0.45]]) P(lx, 0.45, lz, new THREE.BoxGeometry(0.12, 0.9, 0.12), L);
  P(0, 1.6, -0.62, new THREE.BoxGeometry(0.22, 0.6, 0.22), B, -0.5); P(0, 1.95, -0.85, new THREE.BoxGeometry(0.3, 0.3, 0.48), B);
  P(0, 1.95, -1.11, new THREE.SphereGeometry(0.07, 6, 4), 0xd8202e);
  for (const sx of [-1, 1]) { P(sx * 0.14, 2.3, -0.75, new THREE.BoxGeometry(0.05, 0.45, 0.05), 0x5a4030); P(sx * 0.24, 2.48, -0.72, new THREE.BoxGeometry(0.26, 0.05, 0.05), 0x5a4030); P(sx * 0.3, 2.62, -0.7, new THREE.BoxGeometry(0.05, 0.25, 0.05), 0x5a4030); }
  P(0, 1.45, 0, new THREE.BoxGeometry(0.56, 0.06, 1.2), XM_SNOW);
}

// ---------- 지역별 구조물 ----------
function xmBuild(K, p) {
  const { R, RI, rng, w } = K;
  switch (p.type) {
    case 'xsquare': {   // 북극성 광장: 거대 트리 + 크리스마스 마켓(가판대 8) + 가로등 + 순록 조형물
      xmGiantTree(K, p.x, p.z, p.h, 15); K.claim(p.x - 7.5, p.z - 7.5, p.x + 7.5, p.z + 7.5); K.mapRect(p.x - 3, p.z - 3, p.x + 3, p.z + 3);
      const walls = [0xb8352c, 0x2f6a4a, 0xe8d8b8, 0x2d5b8a, 0xd6a12e, 0x8a5a3a, 0xb8352c, 0x2f6a4a];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + 0.39, d = 23, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const F = K.placeLot(x, z, v2FaceRot(p.x - x, p.z - z), 4.2, 3.2, 'shed', 3, 0.6, 0.3);
        if (F) xmHut(K, F, 4.2, 3.2, walls[i], i % 2 ? 0x9c3a2e : 0x2f5a3a, p.tier, { stall: true, sign: 8 + (i % 4) });
      }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, d = 13.5, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (K.footprintFree(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0.2)) { xmLamp(K, x, z); K.claim(x - 0.3, z - 0.3, x + 0.3, z + 0.3); } }
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU, y = heightAt(p.x, p.z) + 3.3; xmBulbLine(K, [p.x + Math.cos(a0) * 13.5, y, p.z + Math.sin(a0) * 13.5], [p.x + Math.cos(a1) * 13.5, y, p.z + Math.sin(a1) * 13.5], 14, 0.45); }
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 1.0, x = p.x + Math.cos(a) * 33, z = p.z + Math.sin(a) * 33; if (K.footprintFree(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0.3)) { xmReindeer(K, x, z, a + Math.PI); K.claim(x - 1, z - 1, x + 1, z + 1); } }
      break;
    }
    case 'xworkshop': {   // 산타 공방: 큰 작업장(빨간 벽·초록 지붕·간판·사탕 기둥) · 요정 진저브레드 오두막 · 순록 마구간 · 썰매 · 선물 더미 · 흰 울타리
      const rot = v2EntRot(p), O = K.frame(p.x, p.z, rot, p.h), fr = p.r - 4;
      let F = v2Lot(K, O, 0, 8, 26, 16, 'warehouse');
      if (F) {
        K.buildWarehouse(F, 26, 16, 7, 0xb8352c, { bigDoor: 6, tier: 'top', roof: 0x2f5a3a });
        F.geo(K.prism(27.2, 17.2, 4.4), 0, 7.62, 0, 0x2f5a3a); F.geo(K.prism(27.0, 17.2, 4.4), 0, 7.70, 0, XM_SNOW);
        const P = HTX.P.sign12, a = F.pt(2.6, -8.27), b = F.pt(-2.6, -8.27), y0 = F.by + 5.4, y1 = F.by + 6.7;
        F.box(-2.75, 5.3, -8.25, 2.75, 6.8, -8.12, 0x3a2a1e, { noCollide: true });   // 간판 받침 (간판 면은 그 앞 -8.27)
        K.getBatch(F.cx, F.cz, 'tex').poly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], 0xfaf2dc, P, [[0, 0.999], [0.999, 0.999], [0.999, 0.001], [0, 0.001]]);
        for (const sx of [-3.6, 3.6]) F.box(sx - 0.25, 0.12, -8.6, sx + 0.25, 5.2, -8.1, 0xffffff, { mat: 'tex', pat: HTX.P.candy, uo: [F.cx, F.by, F.cz] });
        const e0 = F.pt(-13.4, -8.5), e1 = F.pt(13.4, -8.5); xmBulbLine(K, [e0[0], F.by + 7.3, e0[1]], [e1[0], F.by + 7.3, e1[1]], 80, 0.18);
      }
      for (const [lx, lz] of [[-28, -16], [28, -16], [-27, 24], [8, 30]]) { const F2 = v2Lot(K, O, lx, lz, 8, 7, 'house', 3); if (F2) K.buildHouse(F2, 8, 7, 1, XM_PAL.house[0], { tier: 'high', style: 'ginger' }); }
      F = v2Lot(K, O, 27, 26, 12, 8, 'warehouse'); if (F) { K.buildWarehouse(F, 12, 8, 4, 0x8a5a3a, { tier: 'high', roof: 0x5a3a2a, bigDoor: 5 }); F.box(-6.4, 4.5, -4.4, 6.4, 4.6, 4.4, XM_SNOW, { noCollide: true }); }
      { const q = O.pt(-8, -22); xmSleigh(K, q[0], q[1], rot * Math.PI / 2 + 0.4); K.claim(q[0] - 2.5, q[1] - 2.5, q[0] + 2.5, q[1] + 2.5); }
      for (let i = 0; i < 4; i++) { const q = O.pt(-14 + i * 2.2, -24 + (i % 2) * 1.6); xmReindeer(K, q[0], q[1], rot * Math.PI / 2); }
      for (let i = 0; i < 10; i++) { const q = O.pt(R(-fr + 4, fr - 4), R(-fr + 4, fr - 4)), s = R(0.8, 1.5); if (!K.footprintFree(q[0] - s, q[1] - s, q[0] + s, q[1] + s, 0.4)) continue; K.claim(q[0] - s / 2, q[1] - s / 2, q[0] + s / 2, q[1] + s / 2); xmGift(K, q[0], q[1], s, true); }
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 1.0, 0.14, 0xf4f0ea, { gate: [[0, -fr, 5]] });
      for (let i = 0; i < 4; i++) O.loot(R(-fr + 6, fr - 6), 0.05, R(-fr + 6, fr - 6), 'top');
      break;
    }
    case 'xlake': {   // 은빛 호수: 얼음판 무늬 · 얼음낚시 오두막 · 스케이트장(낮은 벽) · 호숫가 통나무집
      const lk = p.lake, B = K.getBatch(lk.x, lk.z, 'texo'), P = HTX.P.ice, n = 40, R0 = lk.r - 3, y = XM_ICE + 0.012;
      for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, q0 = [lk.x + Math.cos(a0) * R0, y, lk.z + Math.sin(a0) * R0], q1 = [lk.x + Math.cos(a1) * R0, y, lk.z + Math.sin(a1) * R0]; B.poly([[lk.x, y, lk.z], q1, q0], 0xa6cde6, P, [[0, 0], [(q1[0] - lk.x) / P.sx, (q1[2] - lk.z) / P.sy], [(q0[0] - lk.x) / P.sx, (q0[2] - lk.z) / P.sy]]); }
      const huts = [0xb8352c, 0x2d5b8a, 0xd6a12e, 0x2f6a4a, 0x8a3aa8, 0xe8e4da];
      for (let i = 0, t = 0; i < 6 && t < 60; t++) {
        const a = R(0, TAU), d = R(16, lk.r - 20), x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d;
        const F = K.placeLot(x, z, RI(0, 3), 3.4, 3.0, 'shed', 0.8, 2, 0.3); if (!F) continue; i++;
        xmHut(K, F, 3.4, 3.0, huts[i % huts.length], 0x4a4f56, p.tier, {});
        const h2 = F.pt(1.9, 1.6); v2Geo(K, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 10), h2[0], XM_ICE + 0.05, h2[1], 0x2a3a48);   // 얼음 구멍
      }
      // 스케이트장 (28×16m, 높이 1m 벽 — 넘을 수 있음, 입구 2곳)
      { const a = R(0, TAU), cx = lk.x + Math.cos(a) * lk.r * 0.32, cz = lk.z + Math.sin(a) * lk.r * 0.32, hx = 14, hz = 8;
        if (K.footprintFree(cx - hx, cz - hz, cx + hx, cz + hz, 0.5)) {
          K.claim(cx - hx, cz - hz, cx + hx, cz + hz);
          const yy = XM_ICE, W = 0xf4f0ea, T = 0.2;
          for (const s of [-1, 1]) { K.addBox(cx - hx, yy - 0.3, cz + s * hz - T / 2, cx - 2, yy + 1.0, cz + s * hz + T / 2, W); K.addBox(cx + 2, yy - 0.3, cz + s * hz - T / 2, cx + hx, yy + 1.0, cz + s * hz + T / 2, W); K.addBox(cx + s * hx - T / 2, yy - 0.3, cz - hz, cx + s * hx + T / 2, yy + 1.0, cz + hz, W); }
          for (const s of [-1, 1]) K.addBox(cx - hx, yy + 0.9, cz + s * hz - 0.13, cx + hx, yy + 1.04, cz + s * hz + 0.13, 0xc8202e, { noCollide: true });
          K.addBox(cx - 0.12, yy - 0.05, cz - hz, cx + 0.12, yy + 0.05, cz + hz, 0xc8202e, { noCollide: true });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = cx + sx * hx, z = cz + sz * hz; K.addBox(x - 0.08, yy - 0.3, z - 0.08, x + 0.08, yy + 3.4, z + 0.08, 0x3a3e42); }
          for (const [x0, z0, x1, z1] of [[cx - hx, cz - hz, cx + hx, cz - hz], [cx + hx, cz - hz, cx + hx, cz + hz], [cx + hx, cz + hz, cx - hx, cz + hz], [cx - hx, cz + hz, cx - hx, cz - hz]]) xmBulbLine(K, [x0, yy + 3.3, z0], [x1, yy + 3.3, z1], Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.7), 0.5);
          for (let i = 0; i < 3; i++) w.lootSpots.push({ x: cx + R(-hx + 2, hx - 2), y: yy + 0.06, z: cz + R(-hz + 2, hz - 2), tier: 'mid' });
        } }
      // 호숫가 통나무집 2채
      for (let i = 0, t = 0; i < 2 && t < 40; t++) { const a = R(0, TAU), d = lk.r + R(14, 26), x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d; const F = K.placeLot(x, z, v2FaceRot(lk.x - x, lk.z - z), 8, 7, 'house', 2.5); if (!F) continue; i++; K.buildHouse(F, 8, 7, 1, XM_PAL.house[1], { tier: 'mid', style: 'cabin' }); }
      break;
    }
    case 'xlodge': {   // 눈꽃 산장: 2층 산장(박공 지붕) · 통나무집 · 스키 리프트 철탑 · 모닥불
      const rot = v2EntRot(p), O = K.frame(p.x, p.z, rot, p.h);
      let F = v2Lot(K, O, 0, 4, 22, 11, 'house');
      if (F) {
        v2Block(K, F, 22, 11, 2, 0x9b6b41, 0x3f4b3b, { tier: 'high', pitched: true, roomW: 5.4 });
        F.geo(K.prism(22.7, 11.9, 3.08), 0, 7.08, 0, XM_SNOW);   // 지붕(22.9×11.9, 높이 3.08)과 같은 기울기로 8cm 위
        const e0 = F.pt(-11.4, -6.0), e1 = F.pt(11.4, -6.0); xmBulbLine(K, [e0[0], F.by + 6.62, e0[1]], [e1[0], F.by + 6.62, e1[1]], 70, 0.16);
      }
      for (const [lx, lz] of [[-22, 22], [22, 22], [-24, -16]]) { const F2 = v2Lot(K, O, lx, lz, 8, 7, 'house', 3); if (F2) K.buildHouse(F2, 8, 7, 1, XM_PAL.house[1], { tier: 'high', style: 'cabin' }); }
      // 스키 리프트: 산장 앞에서 내리막 방향으로 철탑 5개 + 줄 + 의자
      { let gx = K.rawH(p.x + 20, p.z) - K.rawH(p.x - 20, p.z), gz = K.rawH(p.x, p.z + 20) - K.rawH(p.x, p.z - 20); const l = Math.hypot(gx, gz) || 1; gx /= -l; gz /= -l;
        const tops = [];
        for (let i = 0; i < 5; i++) { const d = p.r + 8 + i * 30, x = p.x + gx * d, z = p.z + gz * d, y = heightAt(x, z); if (K.edgeF(x, z) > 0 || !K.footprintFree(x - 1, z - 1, x + 1, z + 1, 0.3)) break; K.claim(x - 1, z - 1, x + 1, z + 1); K.addBox(x - 0.3, y - 0.5, z - 0.3, x + 0.3, y + 9, z + 0.3, 0x8a9096); tops.push([x, y + 9.1, z]); v2Geo(K, new THREE.BoxGeometry(4.2, 0.3, 0.3), x, y + 9.1, z, 0x6a7076, 0, Math.atan2(gx, gz) + Math.PI / 2); }
        for (let i = 0; i < tops.length - 1; i++) { const a = tops[i], b = tops[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ry = Math.atan2(b[0] - a[0], b[2] - a[2]), rx = -Math.asin((b[1] - a[1]) / L); for (const s of [-1.8, 1.8]) v2Geo(K, new THREE.BoxGeometry(0.06, 0.06, L), (a[0] + b[0]) / 2 + Math.cos(ry) * s, (a[1] + b[1]) / 2 - 0.1, (a[2] + b[2]) / 2 - Math.sin(ry) * s, 0x2a2a2a, rx, ry);
          for (const u of [0.33, 0.66]) { const x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), z = lerp(a[2], b[2], u); v2Geo(K, new THREE.BoxGeometry(1.3, 0.12, 0.6), x + Math.cos(ry) * 1.8, y - 1.6, z - Math.sin(ry) * 1.8, 0xc8202e, 0, ry); v2Geo(K, new THREE.BoxGeometry(0.05, 1.5, 0.05), x + Math.cos(ry) * 1.8, y - 0.85, z - Math.sin(ry) * 1.8, 0x2a2a2a); } } }
      { const q = O.pt(0, -16), y = heightAt(q[0], q[1]); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; v2Geo(K, new THREE.BoxGeometry(0.9, 0.12, 0.12), q[0] + Math.cos(a) * 0.2, y + 0.12, q[1] + Math.sin(a) * 0.2, 0x5a3a24, 0, a); } K.getBatch(q[0], q[1], 'lit').oct(q[0], y + 0.4, q[1], 0.32, 0xff8a2a, 0.5); K.getBatch(q[0], q[1], 'lit').oct(q[0], y + 0.68, q[1], 0.2, 0xffd060, 2.0); }
      for (let i = 0; i < 3; i++) O.loot(R(-20, 20), 0.05, R(-24, -10), 'high');
      break;
    }
  }
  void rng; void w;
}

// ---------- 식생: 눈 쌓인 전나무 · 눈 덮인 활엽수 · 눈 모자 바위 · 눈 덤불 ----------
// 색이 다른 조각을 정점 색으로 한 메시에 → 인스턴스 색(밝기 변화)과 곱해진다 (구역마다 그리기 1번)
// 원뿔(밑면 없음, 꼭짓점 하나에 삼각형 n개 — THREE.ConeGeometry 는 꼭짓점 줄에 넓이 0 삼각형을 더 만든다)
const xmCone = (r, h, n, y0) => { const p = []; for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; p.push(0, y0 + h, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r, Math.cos(a0) * r, y0, Math.sin(a0) * r); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; };
function xmMerge(parts) {
  const pos = [], col = [], c = new THREE.Color();
  for (const [g0, hex] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, a = g.attributes.position.array; c.setHex(hex); for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(c.r, c.g, c.b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
async function xmVegetation(K) {
  const { w, R, rng, Q, mk } = K;
  const PC = 64, PN = Math.ceil(SIZE / PC), pg = new Array(PN * PN).fill(EMPTY_LIST);
  for (const p of w.pois) {
    const cr = p.type === 'village' ? p.r - 4 : p.type === 'xlake' ? p.lake.r + 4 : p.r + 6;
    const q = { x: p.x, z: p.z, cr }, i0 = clamp(Math.floor((p.x - cr + HALF) / PC), 0, PN - 1), i1 = clamp(Math.floor((p.x + cr + HALF) / PC), 0, PN - 1), j0 = clamp(Math.floor((p.z - cr + HALF) / PC), 0, PN - 1), j1 = clamp(Math.floor((p.z + cr + HALF) / PC), 0, PN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(pg, j * PN + i, q);
  }
  const nearPoi = (x, z) => { for (const q of pg[clamp(Math.floor((z + HALF) / PC), 0, PN - 1) * PN + clamp(Math.floor((x + HALF) / PC), 0, PN - 1)]) if (Math.hypot(q.x - x, q.z - z) < q.cr) return true; return false; };
  const NO_TREE = new Set([2, 3, 4, 5, 6, 7, 9]);
  const trees = [], rocks = [], bushes = [], A = HALF * 0.9, tick = async (f) => K.yieldUI(0.68 + 0.1 * f, '눈 덮인 숲 생성');
  const target = Math.floor(5500 * Q.trees);
  for (let t = 0; t < target * 7 && trees.length < target; t++) {
    if (t % 30000 === 0) await tick(trees.length / target * 0.6);
    const x = R(-A, A), z = R(-A, A), s = surfaceAt(x, z), mw = K.mountW(x, z);
    const dens = s === 8 ? 0.95 : s === 0 ? 0.06 + mw * 0.5 : s === 1 ? 0.1 : 0;
    if (rng() > dens) continue;
    const h = heightAt(x, z);
    if (h < 1.4 || NO_TREE.has(s) || w.roadDist(x, z) < 6.5 || nearPoi(x, z) || !K.footprintFree(x - 0.6, z - 0.6, x + 0.6, z + 0.6, 1.0)) continue;
    const pine = rng() < 0.86, sc = R(0.8, 1.4);
    trees.push({ x, z, y: h, pine, sc, rot: R(0, TAU) });
    K.addCollider(x - 0.28 * sc, h - 0.5, z - 0.28 * sc, x + 0.28 * sc, h + 6.5 * sc, z + 0.28 * sc, { kind: 'tree' });
  }
  await tick(0.7);
  for (let t = 0; t < 9000 && rocks.length < 900; t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z), mw = K.mountW(x, z);
    if (h < 1.2 || s === 4 || s === 5 || s === 9 || w.roadDist(x, z) < 6 || nearPoi(x, z)) continue;
    if (rng() > 0.1 + mw * 0.8 + (s === 2 ? 0.5 : 0)) continue;
    if (!K.footprintFree(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0.5)) continue;
    const sx = R(1.0, 2.4), sy = R(0.7, 1.7), sz = R(1.0, 2.4);
    rocks.push({ x, z, y: h, sx, sy, sz, rot: R(0, TAU) });
    K.claim(x - sx * 0.7, z - sz * 0.7, x + sx * 0.7, z + sz * 0.7);
    K.addCollider(x - sx * 0.68, h - 0.6, z - sz * 0.68, x + sx * 0.68, h + sy * 0.85, z + sz * 0.68, { kind: 'rock' });
  }
  const bushT = Math.floor(1800 * Q.trees);
  for (let t = 0; t < bushT * 5 && bushes.length < bushT; t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z);
    if (h < 1.3 || s === 4 || s === 5 || s === 3 || s === 9 || w.roadDist(x, z) < 5) continue;
    if (!K.footprintFree(x - 0.8, z - 0.8, x + 0.8, z + 0.8, 0.3)) continue;
    bushes.push({ x, z, y: h, sc: R(0.6, 1.3) });
  }
  await tick(0.85);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });   // 열린 원뿔(밑면 없음)도 아래에서 보이게 — 삼각형 수를 줄임
  // 전나무: 줄기 + 잎 3단 + 단마다 눈 (높이 약 7.2m — 충돌 상자 6.5m×크기)
  const pineParts = [[new THREE.CylinderGeometry(0.16, 0.28, 2.2, 5, 1, true).translate(0, 1.0, 0), 0x5a4330]];   // 나무 한 그루 52 삼각형
  for (const [r, h, y] of [[2.1, 2.8, 1.5], [1.6, 2.5, 3.2], [1.05, 2.3, 4.8]]) { pineParts.push([xmCone(r, h, 7, y), 0x1f4a32]); pineParts.push([xmCone(r * 0.7, h * 0.6 + 0.05, 7, y + h * 0.4), 0xf2f6fa]); }
  const pineG = xmMerge(pineParts);
  // 활엽수: 줄기 + 눈 덮인 둥근 수관
  const broadG = xmMerge([[new THREE.CylinderGeometry(0.15, 0.26, 3.6, 5, 1, true).translate(0, 1.8, 0), 0x5a4a3a], [new THREE.IcosahedronGeometry(2.1, 0).translate(0, 4.6, 0), 0x8a9a8a], [new THREE.IcosahedronGeometry(1.75, 0).scale(1, 0.55, 1).translate(0, 5.6, 0), 0xf2f6fa]]);
  const rockG = xmMerge([[new THREE.DodecahedronGeometry(1, 0), 0x7a7c80], [new THREE.DodecahedronGeometry(0.86, 0).scale(1, 0.38, 1).translate(0, 0.62, 0), 0xf2f6fa]]);
  const bushG = xmMerge([[new THREE.IcosahedronGeometry(0.9, 0), 0x2f5a3a], [new THREE.IcosahedronGeometry(0.78, 0).scale(1, 0.5, 1).translate(0, 0.42, 0), 0xf2f6fa]]);
  const tint = (c) => { const v = 0.92 + rng() * 0.12; c.setRGB(v, v, v * 1.02); };
  mk(pineG, mat, trees.filter((t) => t.pine), (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc * 0.92, t.sc); d.rotation.set(0, t.rot, 0); tint(c); });
  mk(broadG, mat, trees.filter((t) => !t.pine), (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); tint(c); });
  mk(rockG, mat, rocks, (r, d, c) => { d.position.set(r.x, r.y + r.sy * 0.25, r.z); d.scale.set(r.sx, r.sy, r.sz); d.rotation.set(rng() * 0.3, r.rot, rng() * 0.3); tint(c); });
  mk(bushG, mat, bushes, (b, d, c) => { d.position.set(b.x, b.y + 0.35 * b.sc, b.z); d.scale.set(b.sc, b.sc * 0.75, b.sc); d.rotation.set(0, rng() * 3, 0); tint(c); });
  w.trees = trees; w.rocks = rocks;
}

// ---------- 경기 중 효과: 내리는 눈 + 전구 반짝임 ----------
const XmasFx = (() => {
  let pts = null, pos = null, sp = null, ph = null, n = 0, tex = null;
  const BX = 42, BY = 26, BD = 10;
  const flake = () => { if (tex) return tex; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return (tex = new THREE.CanvasTexture(c)); };
  return {
    init(scene, cam) {
      n = SETTINGS.quality === 'low' ? 900 : SETTINGS.quality === 'medium' ? 1500 : 2400;
      pos = new Float32Array(n * 3); sp = new Float32Array(n); ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = cam.x + rnd(-BX, BX); pos[i * 3 + 1] = cam.y + rnd(-BD, BY); pos[i * 3 + 2] = cam.z + rnd(-BX, BX); sp[i] = rnd(1.1, 2.3); ph[i] = rnd(0, TAU); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.15, map: flake(), color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, sizeAttenuation: true }));
      pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
    },
    // 눈송이는 세계 좌표로 떨어지고, 카메라 둘레 상자 밖으로 나가면 반대편으로 (달리면 눈이 스쳐 지나간다)
    update(dt, t, cam) {
      HTX.TW.value = t;
      if (!pts) return;
      for (let i = 0; i < n; i++) {
        const j = i * 3; let x = pos[j], y = pos[j + 1] - sp[i] * dt, z = pos[j + 2];
        x += Math.sin(t * 0.7 + ph[i]) * 0.45 * dt;
        if (x - cam.x > BX) x -= 2 * BX; else if (x - cam.x < -BX) x += 2 * BX;
        if (z - cam.z > BX) z -= 2 * BX; else if (z - cam.z < -BX) z += 2 * BX;
        if (y < cam.y - BD) y += BY + BD; else if (y > cam.y + BY) y -= BY + BD;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    },
    dispose() { pts = null; },
  };
})();
