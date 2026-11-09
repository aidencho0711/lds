// ============================================================
// 02_world_v2.js — v2 지형 생성기 (노르덴 개편 · 키나루 정글)
//  MAPS[..].v2 가 있는 맵만 generateWorld 가 이 함수들을 부른다 (칼덴·아이언리지·훈련장·아레나는 그대로)
//  · 잡음 해안선(만·곶) · 꺾은선 산맥(바위는 능선 꼭대기만) · 구릉/들판 · 두 갈래 강(정글)
//  · 지역 배치: 후보 여러 개 중 기존 지역에서 가장 먼 곳 (한쪽에 몰리지 않게)
//  · A* 도로(경사·강 건너기 비용, 기존 도로 재사용 할인) → 직선화 → Chaikin 곡선 → 다리 구간은 직선
//  · 노르덴: 길가 작은 마을 46 + 주유소 8 · 특수 지역 9 (학교·교도소·발전소·채석장·성터·레이더·병원·저택·등대)
//  · 키나루: 정글 훈련소·읍내 2·사원 유적·해변 리조트·수상 마을·부두·정글 기지 3·채석장·계단논 3·작은 마을 12
//  · 열대 식생: 키 큰 활엽수 · 중층 나무 · 야자수 · 대나무 · 고사리
// ============================================================
const V2_PAL = {
  wood: [[0x9c7a52, 0x6b4a2a], [0xb08d5f, 0x5a4026], [0xc9b48a, 0x7a5a2a], [0x8a6a48, 0x4f3a24]],
  tropic: [[0xe8d9b5, 0xa8452f], [0xcfe0d4, 0x3f6a5a], [0xf0c9a8, 0x8a4b3a], [0xd8e2ea, 0x4a6f8a], [0xe9e1c2, 0x6e8a3a], [0xf2e6d0, 0x2f6f73]],
  stone: 0x8f8a7a, moss: 0x7d8a6a, stoneD: 0x6f6a5c,
};
// 지역 이름 (자체 작명 — 실제 게임 지명·배치는 쓰지 않는다)
const V2_NAMES = {
  norden: { power: ['토르 발전소'], prison: ['그레이월 교도소'], school: ['린덴 학교'], hospital: ['화이트오크 병원'], quarry: ['스톤피트 채석장'], castle: ['올드크라운 성터'], radar: ['아이스아이 레이더 기지'], mansion: ['블랙우드 저택'], lighthouse: ['케이프 등대'] },
  jungle: { base: ['카랑 중앙 훈련기지'], camp: ['바란 정글 훈련소'], city: ['루마 읍내', '테반 읍내'], temple: ['솔라 사원 유적'], resort: ['코랄 리조트'], watervil: ['펭가 수상 마을'], docks: ['마루 부두'], military: ['독사 기지', '수리 기지', '표범 기지'],
    quarry: ['붉은 채석장'], paddy: ['윗다랑이', '안개 다랑이', '바람 다랑이'],
    village: ['아루 마을', '비농 마을', '사틴 마을', '켈루 마을', '마딘 마을', '포랑 마을', '누사 마을', '리잔 마을', '오반 마을', '타링 마을', '세무 마을', '가롱 마을'] },
};
// 입구가 있는 특수 지역 (도로가 가운데를 지나가지 않게)
const V2_GATED = new Set(['power', 'prison', 'quarry', 'castle', 'radar', 'hospital', 'school', 'mansion', 'lighthouse', 'camp', 'temple', 'resort', 'docks', 'paddy', 'base']);
// 정면(로컬 -z)이 (vx,vz) 쪽을 보게 하는 frame 회전
const v2FaceRot = (vx, vz) => Math.abs(vx) > Math.abs(vz) ? (vx < 0 ? 1 : 3) : (vz < 0 ? 0 : 2);
// 입구 쪽이 로컬 -z(정문)가 되는 회전
const v2EntRot = (p) => p.ent ? v2FaceRot(p.ent[0], p.ent[1]) : 0;

// ---------- 거시 지형: 해안선 · 강 · 산맥 · 호수 · 높이 ----------
function v2Layout(K) {
  const { R, rng, n3, JG } = K, H = HALF;
  const nC = makeNoise(rng), nR = makeNoise(rng), nH = makeNoise(rng), nF = makeNoise(rng);
  Object.assign(K, { nC, nR, nH, nF });
  // 해안선: 둥근 사각형 + 저주파 잡음 → 만·곶
  // 정글 섬은 더 들쭉날쭉(만·곶이 잦고 해변 경사가 짧게)
  const edgeF = JG ? (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) * 0.55 + Math.hypot(x, z) * 0.45 + fbm(nC, x * 4.2 / SIZE + 3.1, z * 4.2 / SIZE - 1.7, 4) * H * 0.3;
    return sstep(H * 0.72, H * 0.9, d);
  } : (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z)) * 0.6 + Math.hypot(x, z) * 0.4 + fbm(nC, x * 3.4 / SIZE + 3.1, z * 3.4 / SIZE - 1.7, 4) * H * 0.24;
    return sstep(H * 0.78, H * 0.96, d);
  };
  // 본류 (축을 따라 굽이치는 강)
  const river = JG ? { axisX: rng() < 0.5, v0: R(-260, 260), ph: R(0, TAU), ph2: R(0, TAU), w: 13, A1: 170, F1: 0.0021, A2: 55, F2: 0.0063 }
    : { axisX: rng() < 0.5, v0: R(-700, 700), ph: R(0, TAU), ph2: R(0, TAU), w: 15, A1: 330, F1: 0.0012, A2: 120, F2: 0.0037 };
  const rF = (u) => river.v0 + river.A1 * Math.sin(u * river.F1 + river.ph) + river.A2 * Math.sin(u * river.F2 + river.ph2);
  const rDF = (u) => river.A1 * river.F1 * Math.cos(u * river.F1 + river.ph) + river.A2 * river.F2 * Math.cos(u * river.F2 + river.ph2);
  const mainD = (x, z) => { const u = river.axisX ? x : z, v = river.axisX ? z : x; return Math.abs(v - rF(u)) / Math.sqrt(1 + rDF(u) ** 2); };
  let riverDist = mainD;
  if (JG) {
    // 지류: 본류의 한쪽에서만 흐르다 합류 → 땅이 셋으로 나뉜다. 굽이 바깥쪽으로 뻗게 해서 본류와 다시 만나지 않게
    const uJ = R(-H * 0.3, H * 0.3), vJ = rF(uJ), s = vJ >= (rF(uJ - 260) + rF(uJ + 260)) / 2 ? 1 : -1;
    const T = { s, uJ, vJ, k: R(-0.28, 0.28), B: R(55, 95), G: R(0.0035, 0.0055), ph: R(0, TAU), w: 9.5 };
    const fT = (v) => T.uJ + T.k * (v - T.vJ) + T.B * (Math.sin((v - T.vJ) * T.G + T.ph) - Math.sin(T.ph));
    const dT = (v) => T.k + T.B * T.G * Math.cos((v - T.vJ) * T.G + T.ph);
    const tribD = (x, z) => { const u = river.axisX ? x : z, v = river.axisX ? z : x; if (T.s * (v - T.vJ) < 0) return Math.hypot(u - T.uJ, v - T.vJ); return Math.abs(u - fT(v)) / Math.sqrt(1 + dT(v) ** 2); };
    riverDist = (x, z) => Math.min(mainD(x, z), tribD(x, z) + (river.w - T.w));
    river.trib = T;
  }
  // 산맥: 꺾은선 능선 (노르덴 3줄 1.7~2.7km · 폭 0.9~1.2km · 130~185m / 정글 둥근 녹색 산 5개)
  const ranges = [], NR = JG ? 5 : 3;
  for (let t = 0; t < 900 && ranges.length < NR; t++) {
    const L = JG ? R(220, 620) : R(1700, 2700), hw = JG ? R(280, 420) : R(450, 600), top = JG ? R(55, 95) : R(130, 185);
    const lim = H * (JG ? 0.56 : 0.6) - L * 0.3, cx = R(-lim, lim), cz = R(-lim, lim), a = R(0, Math.PI);
    if (ranges.some(r => Math.hypot(r.cx - cx, r.cz - cz) < (r.L + L) * 0.42 + (JG ? 650 : 1400))) continue;
    if (Math.hypot(cx, cz) < (JG ? 300 : 650)) continue;
    const n = JG ? 2 : 4, pts = [];
    for (let i = 0; i <= n; i++) { const s = (i / n - 0.5) * L, off = i === 0 || i === n ? 0 : R(-0.09, 0.09) * L; pts.push([cx + Math.cos(a) * s - Math.sin(a) * off, cz + Math.sin(a) * s + Math.cos(a) * off]); }
    if (pts.some(p => edgeF(p[0], p[1]) > 0 || riverDist(p[0], p[1]) < hw * 0.55)) continue;
    const segs = []; for (let i = 0; i < n; i++) { const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az; segs.push([ax, az, dx, dz, dx * dx + dz * dz]); }
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), m = hw * 1.6;
    ranges.push({ cx, cz, pts, segs, hw, top, L, a, ph: R(0, TAU), x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m });
  }
  // 산 높이 (마지막 단면값은 K._mw 에 — 배열을 만들지 않으려고)
  let lastW = 0;
  const rangeH = (x, z) => {
    let hB = 0; lastW = 0;
    for (const r of ranges) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      let best = 1e18, bt = 0;
      for (let i = 0; i < r.segs.length; i++) {
        const S = r.segs[i]; let t = ((x - S[0]) * S[2] + (z - S[1]) * S[3]) / S[4]; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - S[0] - S[2] * t, ez = z - S[1] - S[3] * t, d2 = ex * ex + ez * ez; if (d2 < best) { best = d2; bt = (i + t) / r.segs.length; }
      }
      const d = Math.sqrt(best) * (1 + fbm(n3, x * 0.0011 + 7, z * 0.0011 - 3, 2) * 0.55);   // 산기슭을 들쭉날쭉하게
      if (d >= r.hw) continue;
      const v = 1 - d / r.hw, prof = v * v * (3 - 2 * v);
      const along = 0.74 + 0.26 * Math.sin(bt * 9 + r.ph) * Math.sin(bt * 3.1 + r.ph * 1.7);        // 봉우리·안부
      const rid = clamp(1 - Math.abs(fbm(nR, x * 0.0042, z * 0.0042, 3)) * 1.8, 0, 1);            // 갈래 능선
      const hh = r.top * along * Math.pow(prof, 1.35) * (0.8 + 0.2 * rid);
      if (hh > hB) hB = hh; if (prof > lastW) lastW = prof;
    }
    return hB;
  };
  const mountW = (x, z) => { rangeH(x, z); return lastW; };
  // 호수 (노르덴 2개, 산·강에서 떨어진 곳)
  const lakes = [];
  if (!JG) for (let t = 0; t < 500 && lakes.length < 2; t++) {
    const x = R(-H * 0.6, H * 0.6), z = R(-H * 0.6, H * 0.6), r = R(230, 360);
    if (mountW(x, z) > 0 || ranges.some(m => Math.hypot(m.cx - x, m.cz - z) < m.L * 0.5 + m.hw + r)) continue;
    if (mainD(x, z) < r + 260 || lakes.some(l => Math.hypot(l.x - x, l.z - z) < 1800) || edgeF(x, z) > 0) continue;
    lakes.push({ x, z, r });
  }
  const rawH = (x, z) => {
    let h;
    if (JG) {
      const hm = sstep(-0.05, 0.35, fbm(nH, x * 0.0009 + 5, z * 0.0009, 2));   // 구릉 지대
      h = 5 + fbm(K.n1, x * 0.0016, z * 0.0016, 5) * 16 + Math.max(0, fbm(nH, x * 0.0034, z * 0.0034, 4)) * 34 * hm + fbm(K.n2, x * 0.03, z * 0.03, 2) * 0.9;
    } else {
      const hm = sstep(0.0, 0.32, fbm(nH, x * 0.00035 + 5, z * 0.00035, 2));     // 구릉 ↔ 들판
      h = 6 + fbm(K.n1, x * 0.0009, z * 0.0009, 4) * 14 + Math.max(0, fbm(nH, x * 0.0017, z * 0.0017, 4)) * 46 * hm + fbm(K.n2, x * 0.006, z * 0.006, 3) * 3.2 + fbm(K.n2, x * 0.03, z * 0.03, 2) * 0.8;
    }
    h = Math.max(h, 1.6);
    const vk = sstep(river.w + 25, river.w + (JG ? 200 : 340), riverDist(x, z));   // 강 계곡: 산·구릉이 강 쪽으로 낮아진다
    h = lerp(Math.min(h, 7), h, vk);
    const mh = rangeH(x, z); if (mh > 0) h += mh * vk;
    for (const lk of lakes) { const ld = Math.hypot(x - lk.x, z - lk.z); if (ld < lk.r + 40) h = lerp(h, -4.5, sstep(lk.r + 32, lk.r * 0.55, ld)); }
    return lerp(h, -9, edgeF(x, z));
  };
  Object.assign(K, { edgeF, river, riverDist, mountW, rangeH, rawH, lakes, ranges });
  return { riverDist, edgeF, mountW, river, lakes, ranges };
}

// ---------- 지역 배치: 후보 여러 개 중 기존 지역에서 가장 먼 곳 ----------
function v2PlacePois(K, NAMES) {
  const { w, R, rng, JG } = K, H = HALF, NM = V2_NAMES[JG ? 'jungle' : 'norden'];
  const rep = (n, a) => Array.from({ length: n }, () => a);
  const S = JG ? [
    ['base', 135, 'top', { dropW: 6, center: true }],   // 섬 가운데 큰 훈련 기지 (첫 강하 격전지)
    ['camp', 82, 'top', { dropW: 3.2 }], ['city', 92, 'high', { pal: V2_PAL.tropic, towerP: 0.25, towerH: 9 }], ['city', 88, 'high', { pal: V2_PAL.tropic, towerP: 0.25, towerH: 9 }],
    ['temple', 72, 'high', { dropW: 3 }], ['docks', 82, 'mid', { coast: true, dropW: 2.4 }], ['resort', 78, 'mid', { coast: true, dropW: 2.4 }], ['watervil', 90, 'mid', { coast: 'sea', dropW: 1.6 }],
    ...rep(3, ['military', 62, 'top']), ['quarry', 80, 'mid', { dropW: 1.8 }], ...rep(3, ['paddy', 105, 'low', { dropW: 1.2 }]), ...rep(12, ['village', 40, 'low', { pal: V2_PAL.wood }]),
  ] : [
    ['city', 110, 'high'], ['city', 105, 'high'], ['city', 100, 'high'], ['military', 82, 'top'], ['military', 78, 'top'],
    ['power', 88, 'high', { dropW: 3 }], ['prison', 74, 'high', { dropW: 2.6 }], ['quarry', 95, 'mid', { dropW: 1.8 }], ['castle', 56, 'high', { dropW: 2.4 }], ['radar', 58, 'top', { dropW: 2.6 }],
    ['hospital', 62, 'mid', { dropW: 2.4 }], ['school', 60, 'mid', { dropW: 2.4 }], ['mansion', 56, 'high', { dropW: 2.2 }], ['lighthouse', 34, 'mid', { coast: true, dropW: 1.6 }],
    ...rep(3, ['industrial', 64, 'mid']), ...rep(3, ['depot', 36, 'mid']), ...rep(6, ['farm', 52, 'low']), ...rep(14, ['village', 44, 'low']),
  ];
  const lakes = K.lakes, used = new Set();
  const ok = (type, x, z, r, o) => {
    if (lakes.some(lk => Math.hypot(x - lk.x, z - lk.z) < lk.r + r + 26)) return null;
    if (K.riverDist(x, z) < r + 24) return null;
    if (o.coast === 'sea') {   // 수상 마을: 얕은 바다, 가까운 해안
      const e = K.edgeF(x, z); if (e < 0.2 || e > 0.45 || K.rawH(x, z) > -0.5) return null;
      const L = Math.hypot(x, z) || 1, dx = -x / L, dz = -z / L; let d = 0; while (d < r + 120 && K.rawH(x + dx * d, z + dz * d) < 3) d += 4;
      if (d >= r + 120 || d < r * 0.45) return null;
      return { shore: [x + dx * (d + 6), z + dz * (d + 6)] };
    }
    if (o.coast) {   // 해안 지역: 가장 가까운 해안선 방향을 찾아 중심을 해안에서 r*0.75 안쪽으로 옮긴다
      const h0 = K.rawH(x, z); if (h0 < 3 || h0 > 14 || K.edgeF(x, z) <= 0) return null;
      let best = null;
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16, dx = Math.cos(a), dz = Math.sin(a); for (let d = 10; d <= 320; d += 10) if (K.rawH(x + dx * d, z + dz * d) < 0.4) { if (!best || d < best[2]) best = [dx, dz, d]; break; } }
      if (!best) return null;
      const want = r * 0.75, m = best[2] - want, nx = x + best[0] * m, nz = z + best[1] * m;
      if (K.rawH(nx, nz) < 2.5 || K.rawH(nx + best[0] * (want + 60), nz + best[1] * (want + 60)) > -1.5) return null;   // 앞바다가 충분히 깊게
      if (K.riverDist(nx, nz) < r + 120 || lakes.some(lk => Math.hypot(nx - lk.x, nz - lk.z) < lk.r + r + 26)) return null;
      return { x: nx, z: nz, seaDir: [best[0], best[1]], shoreD: want };
    }
    for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) if (K.edgeF(x + sx * r, z + sz * r) > 0.01) return null;
    if (K.edgeF(x, z) > 0.001) return null;
    const mw = K.mountW(x, z);
    if (type === 'castle') return mw > 0.15 && mw < 0.7 ? {} : null;   // 산기슭 언덕
    if (type === 'radar') return mw > 0.5 ? {} : null;                  // 산 위
    if (type !== 'military' && type !== 'quarry' && mw > 0.3) return null;
    if (type === 'paddy') { const s = Math.abs(K.rawH(x + r * 0.7, z) - K.rawH(x - r * 0.7, z)) + Math.abs(K.rawH(x, z + r * 0.7) - K.rawH(x, z - r * 0.7)); if (s < 6 || s > 42) return null; }
    return {};
  };
  const gap = JG ? 130 : 320;
  for (const [type, r, tier, o0] of S) {
    const o = o0 || {}, cands = [];
    const dmin = (x, z) => { let md = 1e9; for (const p of w.pois) md = Math.min(md, Math.hypot(p.x - x, p.z - z) - p.r - r); return md; };
    for (let a = 0; a < (o.coast ? 9000 : 3000) && cands.length < 24; a++) {
      const lim = o.center ? H * (a < 1500 ? 0.3 : 0.45) : H * 0.85;   // 가운데 지역은 섬 중심 근처에서만
      let x = R(-lim, lim), z = R(-lim, lim);
      if (dmin(x, z) < gap) continue;
      const ex = ok(type, x, z, r, o); if (!ex) continue;
      if (ex.x !== undefined) { x = ex.x; z = ex.z; delete ex.x; delete ex.z; }   // 해안 쪽으로 옮긴 경우
      const md = dmin(x, z); if (md < gap) continue;
      cands.push([x, z, md, ex]);
    }
    if (!cands.length) continue;
    if (o.center) cands.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));   // 가운데 지역: 섬 중심에 가장 가까운 후보
    else cands.sort((a, b) => b[2] - a[2]);
    const c = cands[Math.floor(rng() * Math.min(3, cands.length))];   // 가장 먼 후보 (상위 3개 중 하나)
    const hh = K.rawH(c[0], c[1]);
    const h = o.coast === 'sea' ? -1.2 : type === 'castle' || type === 'radar' ? clamp(hh, 3, 400) : type === 'resort' ? clamp(hh, 2.6, 3.6) : clamp(hh, 3, type === 'quarry' ? 70 : o.coast ? 7 : 26);
    const pool = (NM[type] || NAMES[type] || [type]).filter(nm => !used.has(nm));
    const name = pool.length ? pool[Math.floor(rng() * pool.length)] : (NM[type] || NAMES[type] || [type])[0] + ' ' + (w.pois.length + 1); used.add(name);
    const p = Object.assign({ type, x: c[0], z: c[1], r, h, tier, name }, o, c[3]);
    if (p.shore) { p.rx = p.shore[0]; p.rz = p.shore[1]; }
    else if (V2_GATED.has(type)) {
      // 특수 지역: 도로는 가장자리 입구(섬 안쪽 방향, 해안 지역은 바다 반대쪽)에서 끝난다 → 건물 배치가 도로에 막히지 않게
      let ex = p.seaDir ? -p.seaDir[0] : -p.x, ez = p.seaDir ? -p.seaDir[1] : -p.z; const l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l;
      p.ent = [ex, ez]; p.rx = p.x + ex * r * 1.02; p.rz = p.z + ez * r * 1.02;   // 담장 바로 바깥
    }
    if (type === 'quarry') p.qs = clamp((h - 2) / 4.2, 1.2, 3.3);   // 구덩이 한 단 높이 (바닥이 물에 잠기지 않게)
    w.pois.push(p);
  }
}

// ---------- 지역 평탄화 + 채석장 구덩이 · 계단논 · 해안 지역 ----------
function v2AfterTowns(K) {
  const { rawH, poisNear } = K;
  return function (x, z) {
    let h = rawH(x, z);
    for (const p of poisNear(x, z)) {
      const d = Math.hypot(x - p.x, z - p.z); if (d >= p.r + 40) continue;
      if (p.type === 'paddy') { if (d < p.r + 10) h = lerp(h, Math.floor(h / 1.9) * 1.9 + 0.05, sstep(p.r + 10, p.r - 22, d)); continue; }   // 계단논: 평탄화 대신 1.9m 단
      if (p.coast === 'sea') { if (h < 2.5) h = lerp(h, -1.2, sstep(p.r + 40, p.r * 0.55, d)); continue; }   // 수상 마을: 얕은 석호
      if (d < p.r + 34) { const k = sstep(p.r + 34, p.r + 2, d); if (!p.coast) h = lerp(h, p.h, k); else if (h > 0.6) h = lerp(h, p.h, h > p.h ? k : k * clamp((h - 0.6) / Math.max(0.1, p.h - 0.6), 0, 1)); }   // 해안 지역은 바다를 메우지 않는다
      if (p.type === 'quarry') { const pr = p.r * 0.75; if (d < pr) { const u = (1 - d / pr) * 4, f = u - Math.floor(u); h -= (Math.min(4, Math.floor(u)) + (u < 4 ? sstep(0.55, 1, f) : 0)) * p.qs; } }
    }
    return h;
  };
}

// ---------- 표면 ----------
function v2Parcel(x, z) { // 46×30m 필지마다 작물 색
  const i = Math.floor((x + HALF) / 46), j = Math.floor((z + HALF) / 30), c = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 7;
  return c < 3 ? 6 : c < 6 ? 7 : 1;
}
function v2Surf(K, x, z, h, mw, rdist, carve, road) {
  const JG = K.JG, dirt = road && road.kind === 'dirt';
  if (rdist < (dirt ? 3.7 : 4.6) && carve < 0.5) return dirt ? 11 : 4;
  if (h < 1.1 && carve <= 0.4 && JG) for (const p of K.poisNear(x, z)) if (p.coast === 'sea' && Math.hypot(x - p.x, z - p.z) < p.r + 30) return 9;   // 수상 마을 석호 바닥: 어두운 청록
  if (h < 1.1 || carve > 0.4) return 3;
  if (K.edgeF(x, z) > 0 && h < (JG ? 2.3 : 2.4)) return 3;   // 해변
  for (const p of K.poisNear(x, z)) {
    const d = Math.hypot(x - p.x, z - p.z);
    switch (p.type) {
      case 'paddy': if (d < p.r - 4) return (Math.floor(h / 1.9) & 1) ? 9 : 10; break;
      case 'quarry': { const pr = p.r * 0.75; if (d < pr + 4) { const u = (1 - d / pr) * 4; return u < 0.2 ? 1 : (Math.floor(u) & 1) ? 1 : 2; } if (d < p.r) return 1; break; }
      case 'farm': if (d < p.r + 55 && d > 22) return v2Parcel(x, z); break;
      case 'village': if (d < p.r * 0.85) return fbm(K.n4, x * 0.08, z * 0.08, 2) > 0.1 ? 1 : 0; break;
      case 'castle': case 'temple': if (d < p.r - 4) return fbm(K.n4, x * 0.1, z * 0.1, 2) > 0 ? 1 : 0; break;
      case 'resort': case 'mansion': if (d < p.r - 4) return 0; break;
      case 'school': case 'hospital': case 'camp': if (d < p.r - 4) return d < p.r * 0.62 ? 5 : 0; break;
      case 'base': if (d < p.r - 4) return d < p.r * 0.5 ? 5 : fbm(K.n4, x * 0.05, z * 0.05, 2) > -0.05 ? 1 : 0; break;   // 가운데 연병장·건물은 포장, 바깥 훈련장은 흙
      case 'lighthouse': if (d < p.r) return 1; break;
      case 'watervil': break;
      default: if (d < p.r - 4) return 5;
    }
  }
  if (!JG) {
    if (mw > 0.87 + fbm(K.n4, x * 0.02, z * 0.02, 2) * 0.1) return 2;                                         // 능선 꼭대기만 바위
    // 들판: 낮은 평지의 큰 농경 지대(46×30m 필지) — 숲만 이어지지 않게 탁 트인 곳을 만든다
    if (mw < 0.04 && h < 30 && fbm(K.nF, x * 0.00075, z * 0.00075, 3) > 0.1 && fbm(K.nH, x * 0.00035 + 5, z * 0.00035, 2) < 0.12) return v2Parcel(x, z);
    return fbm(K.n4, x * 0.0032, z * 0.0032, 3) + mw * 0.6 > 0.04 ? 8 : 0;                                    // 숲 / 풀밭
  }
  return fbm(K.n4, x * 0.006, z * 0.006, 3) > -0.28 ? 8 : 0;   // 정글: 대부분 숲바닥, 군데군데 풀밭
}

// ---------- 도로: A* → 직선화 → Chaikin → 다리 구간 직선 ----------
function v2AddPolyRoad(K, pts, width, kind) {
  const { w } = K, P = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const q = P[P.length - 1]; if (Math.hypot(pts[i][0] - q[0], pts[i][1] - q[1]) > 0.8) P.push(pts[i]); }
  if (P.length < 2) return null;
  const segL = [], acc = [0];
  for (let i = 0; i < P.length - 1; i++) { const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); segL.push(L); acc.push(acc[i] + L); }
  const tot = acc[acc.length - 1], n = Math.max(2, Math.ceil(tot / 2)), prof = new Float32Array(n + 1);
  let si = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n * tot; while (si < segL.length - 1 && acc[si + 1] < s) si++;
    const t = segL[si] ? clamp((s - acc[si]) / segL[si], 0, 1) : 0;
    prof[i] = K.afterTowns(P[si][0] + (P[si + 1][0] - P[si][0]) * t, P[si][1] + (P[si + 1][1] - P[si][1]) * t);
  }
  const win = 11, sm = new Float32Array(n + 1);   // 앞뒤 22m 이동 평균 (오르내림을 부드럽게)
  for (let i = 0; i <= n; i++) { let s = 0; for (let k = -win; k <= win; k++) s += prof[clamp(i + k, 0, n)]; sm[i] = Math.max(1.6, s / (2 * win + 1)); }
  const line = { pts: P, width, kind };
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], len = segL[i]; if (len < 0.5) continue;
    const m = Math.max(2, Math.ceil(len / 2)), p = new Float32Array(m + 1);
    for (let q = 0; q <= m; q++) { const f = (acc[i] + q / m * len) / tot * n, fi = Math.floor(f); p[q] = lerp(sm[fi], sm[Math.min(n, fi + 1)], f - fi); }
    w.roads.push({ ax, az, bx, bz, len, n: m, prof: p, width, kind, dx: (bx - ax) / len, dz: (bz - az) / len, line });
  }
  w.roadLines.push(line);
  return line;
}
function v2Roads(K) {
  const { w, rng, JG } = K, P = w.pois;
  const GC = JG ? 25 : 50, GN = Math.ceil(SIZE / GC), NN = GN * GN, RW = K.river.w;
  const hN = new Float32Array(NN), blk = new Uint8Array(NN), rv = new Uint8Array(NN), used = new Uint8Array(NN), pc = new Float32Array(NN).fill(1);
  const cc = (i) => -HALF + (i + 0.5) * GC, cell = (x, z) => clamp(Math.floor((z + HALF) / GC), 0, GN - 1) * GN + clamp(Math.floor((x + HALF) / GC), 0, GN - 1);
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const x = cc(i), z = cc(j), k = j * GN + i, h = K.afterTowns(x, z);
    hN[k] = h; blk[k] = h < 1.3 || K.edgeF(x, z) > 0.02 && h < 3 ? 1 : 0; rv[k] = K.riverDist(x, z) < RW + GC * 0.72 ? 1 : 0;
  }
  // 입구가 있는 특수 지역 안쪽은 비싸게 → 다른 지역으로 가는 도로가 가로지르지 않는다
  for (const p of P) if (p.ent) for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) if (Math.hypot(cc(i) - p.x, cc(j) - p.z) < p.r * 0.97) pc[j * GN + i] = 8;   // 담장 안쪽 전체
  // 이진 힙 A*
  const g = new Float32Array(NN), from = new Int32Array(NN), stamp = new Uint32Array(NN), closed = new Uint32Array(NN); let cur = 0;
  const hk = [], hf = [];
  const hpush = (k, f) => { let i = hk.length; hk.push(k); hf.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hk[i] = hk[p]; hf[i] = hf[p]; i = p; } hk[i] = k; hf[i] = f; };
  const hpop = () => { const top = hk[0], lk = hk.pop(), lf = hf.pop(); if (hk.length) { let i = 0; const n = hk.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hk[i] = hk[c]; hf[i] = hf[c]; i = c; } hk[i] = lk; hf[i] = lf; } return top; };
  const CROSS = JG ? 520 : 900, NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  const free = (k) => { if (!blk[k]) return k; const i0 = k % GN, j0 = Math.floor(k / GN); for (let r = 1; r < 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= GN || j >= GN) continue; if (!blk[j * GN + i]) return j * GN + i; } return -1; };
  function astar(s, t) {
    cur++; hk.length = hf.length = 0; g[s] = 0; stamp[s] = cur; from[s] = -1; hpush(s, 0);
    const ti = t % GN, tj = Math.floor(t / GN);
    while (hk.length) {
      const a = hpop(); if (closed[a] === cur) continue; closed[a] = cur;
      if (a === t) { const out = []; let k = t; while (k >= 0) { out.push(k); k = from[k]; } return out.reverse(); }
      const ai = a % GN, aj = Math.floor(a / GN);
      for (const [di, dj, dd] of NB) {
        const i = ai + di, j = aj + dj; if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
        const b = j * GN + i; if (blk[b] || closed[b] === cur) continue;
        const step = GC * dd, sl = Math.abs(hN[b] - hN[a]) / step;
        let c = step * (1 + 22 * sl * sl + (sl > 0.14 ? 60 * (sl - 0.14) : 0));
        if (rv[b]) c += rv[a] ? step * 6 : CROSS;            // 강: 건너기는 비싸게, 강 따라 가기는 더 비싸게
        if (used[b] && used[a]) c *= 0.4;                    // 기존 도로 재사용 할인
        c *= pc[b];
        const ng = g[a] + c;
        if (stamp[b] !== cur || ng < g[b]) { stamp[b] = cur; g[b] = ng; from[b] = a; hpush(b, ng + Math.hypot(i - ti, j - tj) * GC * 0.4); }
      }
    }
    return null;
  }
  // 연결할 쌍: 최소신장트리 + 가까운 보조 연결
  const Q = P.filter(p => !p.noRoad), pt = (p) => [p.rx !== undefined ? p.rx : p.x, p.rz !== undefined ? p.rz : p.z];
  const inT = [0], edges = [];
  while (Q.length && inT.length < Q.length) {
    let best = null;
    for (const a of inT) for (let b = 0; b < Q.length; b++) if (!inT.includes(b)) { const d = Math.hypot(Q[a].x - Q[b].x, Q[a].z - Q[b].z); if (!best || d < best[2]) best = [a, b, d]; }
    edges.push(best); inT.push(best[1]);
  }
  for (let a = 0; a < Q.length; a++) {
    let bb = -1, bd = 1e9;
    for (let b = 0; b < Q.length; b++) if (b !== a && !edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) { const d = Math.hypot(Q[a].x - Q[b].x, Q[a].z - Q[b].z); if (d < bd) { bd = d; bb = b; } }
    if (bb >= 0 && bd < (JG ? 1100 : 1800) && rng() < 0.5) edges.push([a, bb, bd]);
  }
  edges.sort((a, b) => a[2] - b[2]);
  // 직선 구간 검사: 막힌 칸(물·해안)을 지나거나 강을 원래 경로와 다르게 건너면 안 된다
  const crossings = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 8)); let c = 0, inR = false; for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), r = K.riverDist(x, z) < RW + 4; if (r && !inR) c++; inR = r; } return c; };
  const clearLine = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / (GC * 0.4))); for (let i = 0; i <= n; i++) { const t = i / n; if (blk[cell(lerp(x0, x1, t), lerp(z0, z1, t))]) return false; } return true; };
  function simplify(pts) { // Douglas-Peucker + 유효성
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const cr = pts.map((p, i) => i ? crossings(pts[i - 1][0], pts[i - 1][1], p[0], p[1]) : 0), ccum = []; let s = 0; for (const c of cr) { s += c; ccum.push(s); }
    const rec = (a, b) => {
      if (b - a < 2) return;
      const [ax, az] = pts[a], [bx, bz] = pts[b], L = Math.hypot(bx - ax, bz - az) || 1;
      let md = -1, mi = -1; for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * (bz - az) - (pts[i][1] - az) * (bx - ax)) / L; if (d > md) { md = d; mi = i; } }
      const okLine = md <= GC * 0.38 && clearLine(ax, az, bx, bz) && crossings(ax, az, bx, bz) === ccum[b] - ccum[a];
      if (okLine) return;
      keep[mi] = 1; rec(a, mi); rec(mi, b);
    };
    rec(0, pts.length - 1);
    return pts.filter((_, i) => keep[i]);
  }
  const chaikin = (pts) => { if (pts.length < 3) return pts; const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; if (i > 0) o.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]); if (i < pts.length - 2) o.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } o.push(pts[pts.length - 1]); return o; };
  // 다리 구간: 강을 건너는 부분 앞뒤 24m 를 한 직선으로 (다리 상판·진입로가 한 도로 조각 위에 놓이게)
  function straightCross(pts) {
    const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = acc[acc.length - 1];
    const at = (s) => { let i = 0; while (i < pts.length - 2 && acc[i + 1] < s) i++; const L = acc[i + 1] - acc[i], t = L ? (s - acc[i]) / L : 0; return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]; };
    const iv = []; let st = -1;
    for (let s = 0; s <= tot; s += 2) { const [x, z] = at(s), r = K.riverDist(x, z) < RW + 7; if (r && st < 0) st = s; if (!r && st >= 0) { iv.push([st - 24, s + 24]); st = -1; } }
    if (st >= 0) iv.push([st - 24, tot]);
    const mg = []; for (const v of iv) { v[0] = Math.max(0, v[0]); v[1] = Math.min(tot, v[1]); if (mg.length && v[0] <= mg[mg.length - 1][1]) mg[mg.length - 1][1] = Math.max(mg[mg.length - 1][1], v[1]); else mg.push(v); }
    if (!mg.length) return pts;
    // 구간 안의 꼭짓점은 버리고 구간 양 끝점만 남긴다 → 그 사이가 한 직선 조각
    const out = []; let i = 0, k = 0;
    while (i < pts.length) {
      if (k < mg.length && acc[i] >= mg[k][0]) {
        const a = at(mg[k][0]), b = at(mg[k][1]), l = out[out.length - 1];
        if (!l || Math.hypot(l[0] - a[0], l[1] - a[1]) > 0.5) out.push(a);
        out.push(b);
        while (i < pts.length && acc[i] <= mg[k][1] + 1e-6) i++;
        k++; continue;
      }
      out.push(pts[i]); i++;
    }
    return out;
  }
  // 기존 도로 위 가장 가까운 점 (새 도로를 T자로 붙이기)
  const snap = (x, z) => {
    let best = null, bd = GC * 1.6;
    for (const L of w.roadLines) for (let i = 0; i < L.pts.length - 1; i++) {
      const [ax, az] = L.pts[i], [bx, bz] = L.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      if (Math.min(ax, bx) - bd > x || Math.max(ax, bx) + bd < x || Math.min(az, bz) - bd > z || Math.max(az, bz) + bd < z) continue;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = [px, pz]; }
    }
    return best || [x, z];
  };
  const W_ = JG ? 6 : 7, KIND = JG ? 'dirt' : 'main';
  for (const [a, b] of edges) {
    const A = pt(Q[a]), B = pt(Q[b]), s = free(cell(A[0], A[1])), t = free(cell(B[0], B[1]));
    if (s < 0 || t < 0 || s === t) continue;
    const path = astar(s, t); if (!path) continue;
    // 이미 도로가 있는 칸은 건너뛰고 새 칸 구간만 도로로 만든다 (양 끝은 지역 중심 또는 기존 도로에 붙임)
    let q = 0;
    while (q < path.length) {
      while (q < path.length && used[path[q]] && q !== 0) q++;
      if (q >= path.length) break;
      let e = q; while (e + 1 < path.length && !used[path[e + 1]]) e++;
      const pts = [];
      if (q === 0) pts.push(A); else { const c = path[q - 1]; pts.push(snap(cc(c % GN), cc(Math.floor(c / GN)))); }
      for (let i = q === 0 ? 1 : q; i <= e && i < path.length - 1; i++) { const c = path[i]; pts.push([cc(c % GN), cc(Math.floor(c / GN))]); }
      if (e === path.length - 1) pts.push(B); else { const c = path[e + 1]; pts.push(snap(cc(c % GN), cc(Math.floor(c / GN)))); }
      if (pts.length >= 2) v2AddPolyRoad(K, straightCross(chaikin(chaikin(simplify(pts)))), W_, KIND);
      q = e + 1;
    }
    for (const c of path) used[c] = 1;
  }
}
// 도로 리본: 꺾은선 한 줄을 이어서 그리고 꼭짓점은 마이터(이음매가 벌어지지 않게)
function v2Ribbons(K, rp, ri, lp, li, dp, di) {
  const RW = K.RV.w;
  for (const L of K.w.roadLines) {
    const P = L.pts, n = P.length, hw = L.width / 2, dirt = L.kind === 'dirt', pos = dirt ? dp : rp, idx = dirt ? di : ri;
    const sn = []; for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; sn.push([-dz / l, dx / l]); }
    const vn = (i) => { if (i === 0) return sn[0]; if (i === n - 1) return sn[n - 2]; const a = sn[i - 1], b = sn[i]; let mx = a[0] + b[0], mz = a[1] + b[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const c = Math.max(0.5, mx * a[0] + mz * a[1]); return [mx / c, mz / c]; };
    const base = pos.length / 3; let k = 0, px = 0, pz = 0, dash = 0;
    for (let i = 0; i < n - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(len / 3));
      for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
        const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t, nr = s === 0 ? vn(i) : s === steps ? vn(i + 1) : sn[i];
        for (const sd of [-1, 1]) { const qx = x + nr[0] * hw * sd, qz = z + nr[1] * hw * sd; pos.push(qx, Math.max(heightAt(qx, qz), heightAt(x, z)) + 0.07, qz); }
        if (k > 0 && K.riverDist((x + px) / 2, (z + pz) / 2) > RW + 6) { const a = base + (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        px = x; pz = z; k++;
      }
      if (L.kind === 'main' && len > 0.1) { // 중앙 점선 (6.6m 마다 2.2m)
        let t = dash;
        for (; t < len; t += 6.6) {
          const t2 = Math.min(len, t + 2.2), q0x = ax + (bx - ax) * t / len, q0z = az + (bz - az) * t / len;
          if (K.riverDist(q0x, q0z) < RW + 6) continue;
          const lb = lp.length / 3;
          for (const tt of [t, t2]) { const qx = ax + (bx - ax) * tt / len, qz = az + (bz - az) * tt / len; for (const sd of [-1, 1]) { const ox = qx + sn[i][0] * 0.12 * sd, oz = qz + sn[i][1] * 0.12 * sd; lp.push(ox, Math.max(heightAt(qx, qz), heightAt(ox, oz)) + 0.09, oz); } }
          li.push(lb, lb + 1, lb + 2, lb + 1, lb + 3, lb + 2);
        }
        dash = t - len;
      }
    }
  }
}

// ---------- 길가 작은 마을 · 주유소 (노르덴) ----------
function v2Roadside(K) {
  const { w, R, rng, JG } = K; if (JG) return;
  const mains = w.roads.filter(r => r.kind === 'main' && r.len > 8), tot = mains.reduce((s, r) => s + r.len, 0); if (!tot) return;
  const pickPt = () => { let s = rng() * tot; for (const r of mains) { if (s < r.len) return [r, s]; s -= r.len; } return [mains[0], 0]; };
  const taken = new Set(w.pois.map(p => p.name)), A = ['엘름', '버치', '애쉬', '오크', '파인', '윌로', '메이플', '시더', '헤이즐', '로완', '린든', '헤더', '클로버', '브라이어', '솔트', '스톤', '브룩', '웨스트', '노스', '그린', '폭스', '래빗', '아울', '크로'],
    B = ['턴', '비', '필드', '웨이', '게이트', '홈', '데일', '코트', '엔드', '워스', '스테드', '리지', '크로스', '포드', '허스트'];
  const nameOf = () => { for (let k = 0; k < 200; k++) { const n = A[Math.floor(rng() * A.length)] + B[Math.floor(rng() * B.length)]; if (!taken.has(n)) { taken.add(n); return n; } } return '작은 마을'; };
  let nh = 0, ng = 0;
  for (let a = 0; a < 9000 && (nh < 46 || ng < 8); a++) {
    const [r, s] = pickPt(), side = rng() < 0.5 ? -1 : 1, nx = -r.dz * side, nz = r.dx * side, rx = r.ax + r.dx * s, rz = r.az + r.dz * s;
    const gas = ng < 8 && (nh >= 46 || rng() < 0.18), off = gas ? r.width / 2 + 13.5 : R(25, 55), x = rx + nx * off, z = rz + nz * off;
    if (K.edgeF(x, z) > 0.0005 || K.riverDist(x, z) < K.river.w + 40 || K.mountW(x, z) > 0.35) continue;
    const h = K.rawH(x, z); if (h < 2.5) continue;
    if (Math.abs(K.rawH(x + 18, z) - K.rawH(x - 18, z)) + Math.abs(K.rawH(x, z + 18) - K.rawH(x, z - 18)) > 9) continue;
    if (w.pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + (p.type === 'gas' ? (gas ? 1300 : 120) : p.type === 'hamlet' ? (gas ? 120 : 360) : 140))) continue;
    if (gas) { ng++; w.pois.push({ type: 'gas', x, z, r: 16, h, tier: 'mid', name: '주유소', minor: true, noRoad: true, road: [rx, rz], dropW: 0.7 }); }
    else { nh++; w.pois.push({ type: 'hamlet', x, z, r: 28, h, tier: 'low', name: nameOf(), minor: true, noRoad: true, road: [rx, rz], dropW: 0.9 }); }
  }
}

// ---------- 구조물 공용 도구 ----------
// 로컬 축 방향 담장: 2.4m 조각으로 나눠 지면을 따르고, 도로가 지나는 조각·gate 근처는 비워 문을 낸다
function v2Wall(K, O, lx0, lz0, lx1, lz1, H, T, color, o = {}) {
  const L = Math.hypot(lx1 - lx0, lz1 - lz0), n = Math.max(1, Math.round(L / 2.4));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, lc = [lerp(lx0, lx1, (t0 + t1) / 2), lerp(lz0, lz1, (t0 + t1) / 2)];
    if (o.gate && o.gate.some(([gx, gz, gr]) => Math.hypot(lc[0] - gx, lc[1] - gz) < gr)) continue;
    const a = O.pt(lerp(lx0, lx1, t0), lerp(lz0, lz1, t0)), b = O.pt(lerp(lx0, lx1, t1), lerp(lz0, lz1, t1)), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    if (K.w.roadDist(cx, cz) < (o.gateW || 5.5)) continue;
    const hh = o.hFn ? o.hFn(lc[0], lc[1], i) : H; if (hh <= 0) continue;
    const wx = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
    const x0 = wx ? Math.min(a[0], b[0]) : cx - T / 2, x1 = wx ? Math.max(a[0], b[0]) : cx + T / 2, z0 = wx ? cz - T / 2 : Math.min(a[1], b[1]), z1 = wx ? cz + T / 2 : Math.max(a[1], b[1]);
    const g0 = heightAt(x0, z0), g1 = heightAt(x1, z1), gc = heightAt(cx, cz);
    const top = o.topY !== undefined ? o.topY : Math.max(g0, g1, gc) + hh;
    K.addBox(x0, Math.min(g0, g1, gc) - 0.4, z0, x1, top, z1, color, o.box || {});
    K.claim(x0, z0, x1, z1);
  }
}
// 감시탑 (군사기지와 같은 모양)
function v2Watchtower(K, x, z, H = 6, tier = 'top') {
  K.claim(x - 3, z - 5, x + 3, z + 3);
  const T = K.frame(x, z, 0, heightAt(x, z)), c = 0x6a5a45;
  for (const [a, b] of [[-1.5, -1.5], [1.3, -1.5], [-1.5, 1.3], [1.3, 1.3]]) T.box(a, 0, b, a + 0.2, H, b + 0.2, c);
  T.box(-1.7, H, -1.7, 1.7, H + 0.2, 1.7, c, { nav: false });
  T.box(-1.7, H + 0.2, 1.55, 1.7, H + 1.2, 1.7, c); T.box(-1.7, H + 0.2, -1.7, -1.55, H + 1.2, 1.7, c); T.box(1.55, H + 0.2, -1.7, 1.7, H + 1.2, 1.7, c);
  T.box(-1.7, H + 0.2, -1.7, -0.5, H + 1.2, -1.55, c); T.box(0.5, H + 0.2, -1.7, 1.7, H + 1.2, -1.55, c);
  T.box(-1.7, H + 2.6, -1.7, 1.7, H + 2.8, 1.7, 0x4a4036, { noCollide: true });
  T.ramp(-0.45, -5.6, 0.45, -1.7, 0, H + 0.2, 'z');
  for (let k = 0; k < 14; k++) T.box(-0.5, (H / 14) * k, -5.6 + 3.9 * k / 14, 0.5, (H / 14) * k + 0.08, -5.6 + 3.9 * k / 14 + 0.12, 0x3a3a3a, { noCollide: true });
  T.loot(0, H + 0.22, 0.6, tier);
}
// 큰 건물 (1~3층): 앞쪽 복도 + 뒤쪽 방들 + 오른쪽 끝 계단(얇은 디딤판). 학교·병원·교도소·저택·호텔 등
function v2Block(K, F, wd, dp, floors, wallC, roofC, o = {}) {
  const { DOOR, WIN, PAL } = K, t = 0.25, fh = 3.4, hw = wd / 2, hd = dp / 2, tier = o.tier || 'mid';
  F.box(-hw - 0.2, -1.6, -hd - 0.2, hw + 0.2, 0.15, hd + 0.2, PAL.found, { nav: true });
  F.box(-1.6, -1.2, -hd - 1.6, 1.6, 0.05, -hd - 0.2, PAL.found, {});
  const cw = 2.6, zc = -hd + cw, sw = 1.55, sx = hw - t / 2 - sw, x0 = -hw + t / 2, x1 = sx - 1.3;
  const nR = Math.max(1, Math.round((x1 - x0) / (o.roomW || 5.2))), rw = (x1 - x0) / nR;
  for (let fl = 0; fl < floors; fl++) {
    const y0 = fl * fh + 0.15, h = fh - 0.15;
    const front = []; for (let x = -hw + 1.2; x < hw - 2.8; x += 3.4) if (fl > 0 || x + 1.4 < -1.1 || x > 1.1) front.push(WIN(x));
    if (fl === 0) front.push(DOOR(-0.9));
    F.wallX(-hd, -hw, hw, y0, h, t, front, wallC);
    const back = []; for (let i = 0; i < nR; i++) back.push(WIN(x0 + rw * (i + 0.5) - 0.7));
    F.wallX(hd, -hw, hw, y0, h, t, back, wallC);
    F.wallZ(-hw, -hd + t / 2, hd - t / 2, y0, h, t, fl === 0 ? [DOOR(-hd + 0.45), WIN(hd - 2.4)] : [WIN(-hd + 0.6), WIN(hd - 2.4)], wallC);
    F.wallZ(hw, -hd + t / 2, hd - t / 2, y0, h, t, [WIN(-0.7)], wallC);
    // 복도 벽(방마다 문) + 방 칸막이 + 계단참 쪽 벽
    const doors = []; for (let i = 0; i < nR; i++) doors.push(DOOR(x0 + rw * (i + 0.5) - 0.9));
    F.wallX(zc, x0, x1, y0, h, 0.16, doors, 0xd8d0c0);
    for (let i = 1; i < nR; i++) F.wallZ(x0 + rw * i, zc + 0.08, hd - t / 2, y0, h, 0.14, [], 0xd8d0c0);
    F.wallZ(x1, zc + 0.08, hd - t / 2, y0, h, 0.14, [], 0xd8d0c0);
    for (let i = 0; i < nR; i++) {
      const cx = x0 + rw * (i + 0.5);
      if (rw > 3.6) F.box(cx - 0.8, y0, hd - 1.3, cx + 0.8, y0 + 0.78, hd - 0.55, i % 2 ? PAL.furn : PAL.furn2);
      F.loot(cx + R0(K, -0.6, 0.6), y0 + 0.02, (zc + hd) / 2 + R0(K, -0.6, 0.4), tier);
    }
    F.loot(R0(K, -hw + 2, x1 - 1), y0 + 0.02, -hd + 1.3, tier);
    if (fl > 0) { // 위층 바닥 (계단 칸 제외) + 맨 위층 난간
      const fy = fl * fh;
      F.box(-hw, fy - 0.12, -hd, sx, fy + 0.15, hd, PAL.floorWood);
      if (fl === floors - 1) F.box(sx - 0.08, fy + 0.15, -hd, sx, fy + 1.1, hd - 2.4, PAL.rail);
    }
    if (fl < floors - 1) { // 계단: 앞→뒤로 오르는 경사로 + 얇은 디딤판
      const ya = fl * fh + 0.15, yb = (fl + 1) * fh + 0.15, za = -hd + 0.5, zb = hd - 0.5;
      F.ramp(sx + 0.05, za, hw - t / 2 - 0.05, zb, ya, yb, 'z');
      const ns = Math.round((yb - ya) / 0.28);
      for (let s = 0; s < ns; s++) { const y = ya + (yb - ya) * (s + 1) / ns; F.box(sx + 0.05, y - 0.14, lerp(za, zb, s / ns), hw - t / 2 - 0.05, y, lerp(za, zb, (s + 1) / ns), 0x8a7a66, { noCollide: true }); }
    }
  }
  const ry = floors * fh;
  F.box(-hw - 0.2, ry - 0.12, -hd - 0.2, hw + 0.2, ry + 0.2, hd + 0.2, roofC);
  if (o.pitched) F.geo(K.prism(wd + 0.9, dp + 0.9, Math.min(3.2, dp * 0.28)), 0, ry + 0.2, 0, roofC);
  else { F.box(-hw - 0.2, ry + 0.2, -hd - 0.2, hw + 0.2, ry + 0.8, -hd + 0.05, wallC); F.box(-hw - 0.2, ry + 0.2, hd - 0.05, hw + 0.2, ry + 0.8, hd + 0.2, wallC); F.box(-hw - 0.2, ry + 0.2, -hd + 0.05, -hw + 0.05, ry + 0.8, hd - 0.05, wallC); F.box(hw - 0.05, ry + 0.2, -hd + 0.05, hw + 0.2, ry + 0.8, hd - 0.05, wallC); }
}
const R0 = (K, a, b) => K.R(a, b);
// 로컬 사각형 점유 (회전하면 모서리 순서가 바뀌므로 정렬해서)
function v2ClaimL(K, O, lx0, lz0, lx1, lz1) { const a = O.pt(lx0, lz0), b = O.pt(lx1, lz1); K.claim(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])); }
// 로컬 배치 도우미: 지역 중심 기준 회전 rot 의 로컬 좌표로 건물 터 잡기
function v2Lot(K, O, lx, lz, wd, dp, kind, slope = 3) { const [x, z] = O.pt(lx, lz); return K.placeLot(x, z, O.rot, wd, dp, kind, slope, 1, 0.5); }
// 아무 방향 직육면체/원통 장식 (세계 행렬) — 충돌 없음
function v2Geo(K, g, x, y, z, color, rx = 0, ry = 0, rz = 0) { const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')); m.setPosition(x, y, z); K.getBatch(x, z).geo(g, m, color); }

// ---------- 지역별 구조물 ----------
function v2Build(K, p) {
  const { R, RI, RP, rng, PAL, w } = K, G = (rot, by = p.h) => K.frame(p.x, p.z, rot, by);
  switch (p.type) {
    case 'hamlet': { // 길가 작은 마을: 길을 향한 집 3~5채 + 헛간
      const n = RI(3, 5), [rx, rz] = p.road;
      for (let i = 0, t = 0; i < n && t < 40; t++) {
        const a = R(0, TAU), d = R(4, 22), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, wd = R(7, 10), dp = R(6.5, 9);
        const F = K.placeLot(x, z, v2FaceRot(rx - x, rz - z), wd, dp, 'house', 1.6); if (!F) continue; i++;
        K.buildHouse(F, wd, dp, rng() < 0.35 ? 2 : 1, RP(PAL.house), { balcony: rng() < 0.4, tier: 'low' });
      }
      if (rng() < 0.6) { const a = R(0, TAU), F = K.placeLot(p.x + Math.cos(a) * 24, p.z + Math.sin(a) * 24, RI(0, 3), 4, 3.5, 'shed', 1.2); if (F) { const c = 0x7a6248; F.box(-2.1, -1, -1.85, 2.1, 0.1, 1.85, PAL.found, { nav: true }); F.wallX(-1.75, -2, 2, 0.1, 2.5, 0.15, [K.DOOR(-0.9)], c); F.wallX(1.75, -2, 2, 0.1, 2.5, 0.15, [], c); F.wallZ(-2, -1.68, 1.68, 0.1, 2.5, 0.15, [], c); F.wallZ(2, -1.68, 1.68, 0.1, 2.5, 0.15, [], c); F.box(-2.3, 2.6, -2.1, 2.3, 2.8, 2.1, 0x4a4036); F.loot(0, 0.12, 0.6, 'low'); } }
      break;
    }
    case 'gas': { // 주유소: 지붕(캐노피) · 주유기 2 · 매점 · 간판
      const [rx, rz] = p.road, rot = v2FaceRot(rx - p.x, rz - p.z);
      const F = K.placeLot(p.x, p.z, rot, 24, 20, 'park', 2.5, 1, 0.3); if (!F) break;
      F.box(-12, -0.25, -10, 12, 0.06, 3, 0x6a6864, { noCollide: true });
      for (const x of [-5.5, 5.5]) for (const z of [-8, -3]) F.box(x - 0.2, 0, z - 0.2, x + 0.2, 4.6, z + 0.2, 0xd8d8d8);
      F.box(-7.5, 4.6, -9.8, 7.5, 5.3, -1.2, 0xe9e7e2);
      F.box(-7.6, 4.75, -9.95, 7.6, 5.2, -9.8, 0xb8352c, { noCollide: true }); F.box(-7.6, 4.75, -1.2, 7.6, 5.2, -1.05, 0xb8352c, { noCollide: true });
      for (const x of [-2.6, 2.6]) { F.box(x - 0.7, 0, -6.6, x + 0.7, 0.22, -4.4, 0x8a8a86); F.box(x - 0.35, 0.22, -5.9, x + 0.35, 1.75, -5.1, 0xc23a30); F.loot(x + 1.3, 0.08, -5.5, 'low'); }
      const sp = F.pt(0, 5.6), F2 = K.frame(sp[0], sp[1], rot, F.by);
      K.buildHouse(F2, 11, 7, 1, [0xdedad0, 0x3e4a5a], { flatRoof: true, tier: 'mid' });
      w.buildings.push({ x: sp[0], z: sp[1], rect: K.worldRect(sp[0], sp[1], rot, 11, 7), kind: 'house', y: F.by, door: F2.pt(0, -3.5 - 2.2), visits: 0 });
      F.box(10, 0, -9.2, 10.3, 7, -8.9, 0x8a8f94); F.box(9.1, 5.4, -9.3, 11.2, 7.3, -8.8, 0xc23a30, { noCollide: true });
      break;
    }
    case 'school': {
      const rot = v2EntRot(p), O = G(rot);
      let F = v2Lot(K, O, -6, -16, 34, 11, 'house'); if (F) v2Block(K, F, 34, 11, 2, 0xd8c4a0, 0x5a3a30, { tier: 'mid' });
      F = v2Lot(K, O, 22, 18, 18, 14, 'warehouse'); if (F) K.buildWarehouse(F, 18, 14, 7, 0xb8b0a0, { tier: 'mid', roof: 0x5d6168 });
      for (const gx of [-36, -4]) { const c = 0xe8e8e8; O.box(gx - 0.1, 0, 14, gx + 0.1, 2.4, 14.2, c); O.box(gx - 0.1, 0, 21.8, gx + 0.1, 2.4, 22, c); O.box(gx - 0.1, 2.3, 14, gx + 0.1, 2.5, 22, c, { noCollide: true }); }
      const fr = p.r - 5; for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 1.1, 0.3, 0x8f8a80, { gate: [[0, -fr, 5]] });
      break;
    }
    case 'prison': {
      const rot = v2EntRot(p), O = G(rot), fr = p.r - 10;
      let F = v2Lot(K, O, 0, 14, 34, 10, 'house'); if (F) v2Block(K, F, 34, 10, 2, 0x9a958c, 0x55524c, { tier: 'high', roomW: 3.4 });
      F = v2Lot(K, O, -28, -32, 14, 10, 'house'); if (F) v2Block(K, F, 14, 10, 2, 0xb7ae9c, 0x4d4a44, { tier: 'high' });
      F = v2Lot(K, O, 26, -30, 16, 12, 'warehouse'); if (F) K.buildWarehouse(F, 16, 12, 5, 0xa49c8c, { tier: 'high', roof: 0x4d4a44 });
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 5.5, 0.8, 0x9b9790, { gate: [[0, -fr, 5]] });
      v2Wall(K, O, -fr + 2, -2, fr - 2, -2, 3.2, 0.08, 0x8a8f8a, { box: { soft: true, mat: 'fence' }, gate: [[0, -2, 3], [-30, -2, 3]] });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const q = O.pt(sx * (fr - 5), sz * (fr - 5)); v2Watchtower(K, q[0], q[1], 7, 'high'); }
      O.box(16, 0, 34, 16.3, 3.2, 34.3, 0x6a6e72); O.box(15.2, 3.0, 34.3, 17.1, 4.1, 34.45, 0xe0e0e0, { noCollide: true });
      break;
    }
    case 'power': {
      const rot = v2EntRot(p), O = G(rot);
      { const q = O.pt(-38, -30); v2CoolingTower(K, q[0], q[1], heightAt(q[0], q[1])); }
      { const q = O.pt(36, -44); v2Chimney(K, q[0], q[1], heightAt(q[0], q[1]), 62); }
      let F = v2Lot(K, O, 8, -6, 40, 20, 'warehouse'); if (F) K.buildWarehouse(F, 40, 20, 12, 0x8c9094, { bigDoor: 8, tier: 'high', roof: 0x4d5257 });
      F = v2Lot(K, O, -34, 32, 18, 9, 'house'); if (F) v2Block(K, F, 18, 9, 2, 0xc6c0b4, 0x50545a, { tier: 'high' });
      // 변전 설비: 변압기 3×3 + 철골 문형 기둥 + 철망 울타리
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const lx = 24 + i * 9, lz = 26 + j * 9; O.box(lx - 1.3, 0, lz - 1, lx + 1.3, 2.8, lz + 1, 0x7d8388); O.box(lx - 1.5, 2.8, lz - 0.2, lx + 1.5, 3.4, lz + 0.2, 0x5e646a, { noCollide: true }); v2ClaimL(K, O, lx - 2, lz - 2, lx + 2, lz + 2); }
      for (let i = 0; i < 4; i++) { const lx = 20 + i * 9; O.box(lx - 0.15, 0, 20, lx + 0.15, 9, 20.3, 0x6b7177); O.box(lx - 0.15, 0, 52, lx + 0.15, 9, 52.3, 0x6b7177); O.box(lx - 0.1, 8.6, 20, lx + 0.1, 8.9, 52.3, 0x6b7177, { noCollide: true }); }
      for (const [a, b, c, d] of [[17, 17, 50, 17], [17, 56, 50, 56], [17, 17, 17, 56], [50, 17, 50, 56]]) v2Wall(K, O, a, b, c, d, 2.6, 0.08, 0x8a8f8a, { box: { soft: true, mat: 'fence' }, gate: [[17, 36, 3]] });
      // 배관: 터빈 건물 → 냉각탑
      const pg = new THREE.CylinderGeometry(0.7, 0.7, 30, 10); pg.rotateZ(Math.PI / 2);
      { const q = O.pt(-21, -26); v2Geo(K, pg, q[0], p.h + 4.2, q[1], 0xa0a6aa, 0, rot % 2 ? Math.PI / 2 : 0); for (const s of [-12, 0, 12]) { const r = O.pt(-21 + s, -26); K.addBox(r[0] - 0.25, p.h - 0.5, r[1] - 0.25, r[0] + 0.25, p.h + 3.6, r[1] + 0.25, 0x6b7177); } }
      break;
    }
    case 'quarry': {
      const rot = v2EntRot(p), O = G(rot), pr = p.r * 0.75, bot = p.h - 4 * p.qs;
      // 컨베이어: 구덩이 바닥 → 가장자리 호퍼
      const ax = 8, ay = bot + 1.2, bx = pr + 8, by = p.h + 9, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
      { const m = O.pt((ax + bx) / 2, 0), e = O.pt(1, 0), belt = new THREE.BoxGeometry(L, 0.35, 1.6); v2Geo(K, belt, m[0], (ay + by) / 2, m[1], 0x3e4246, 0, Math.atan2(-(e[1] - p.z), e[0] - p.x), ang); }
      for (let s = 6; s < L; s += 8) { const lx = ax + (bx - ax) * s / L, y = ay + (by - ay) * s / L, q = O.pt(lx, 0); K.addBox(q[0] - 0.25, heightAt(q[0], q[1]) - 0.5, q[1] - 0.25, q[0] + 0.25, y - 0.2, q[1] + 0.25, 0xb08a2a); }
      { const T = K.frame(...O.pt(bx + 3, 0), rot, p.h); for (const [a, b] of [[-3, -3], [2.6, -3], [-3, 2.6], [2.6, 2.6]]) T.box(a, 0, b, a + 0.4, 8, b + 0.4, 0xb08a2a); T.box(-3.4, 8, -3.4, 3.4, 13, 3.4, 0x8c8f92); T.box(-1.2, 4.5, -1.2, 1.2, 8, 1.2, 0x6e7276, { noCollide: true }); v2ClaimL(K, O, bx - 1, -5, bx + 7, 5); }
      let F = v2Lot(K, O, 0, pr + 13, 16, 10, 'warehouse'); if (F) K.buildWarehouse(F, 16, 10, 6, RP(PAL.metal), { tier: 'mid' });
      F = v2Lot(K, O, -(pr + 12), 10, 12, 9, 'warehouse'); if (F) K.buildWarehouse(F, 12, 9, 5, RP(PAL.metal), { tier: 'mid' });
      F = v2Lot(K, O, pr + 10, 24, 8, 7, 'house'); if (F) K.buildHouse(F, 8, 7, 1, RP(PAL.house), { flatRoof: true, tier: 'mid' });
      for (let i = 0; i < 4; i++) { const a = R(0, TAU), d = R(pr + 6, p.r - 4), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (!K.footprintFree(x - 4, z - 4, x + 4, z + 4, 1)) continue; K.claim(x - 4, z - 4, x + 4, z + 4); const y = heightAt(x, z); v2Geo(K, new THREE.ConeGeometry(5.5, 4.2, 9), x, y + 1.9, z, 0x9a948a); K.addBox(x - 3, y - 0.5, z - 3, x + 3, y + 2.6, z + 3, 0, { invisible: true }); }
      for (let i = 0; i < 6; i++) { const a = R(0, TAU), d = R(8, pr - 4), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; w.lootSpots.push({ x, y: heightAt(x, z) + 0.05, z, tier: 'mid' }); }
      { const q = O.pt(-pr * 0.4, pr * 0.3), T = K.frame(q[0], q[1], 0, heightAt(q[0], q[1])); K.buildCar(T, 0, 0, 0xd8a82a, 0); }
      break;
    }
    case 'castle': {
      const rot = v2EntRot(p), O = G(rot), stone = V2_PAL.stone, moss = V2_PAL.moss;
      // 성벽: 군데군데 무너져 낮아짐(넘기 가능) · 뒤쪽 성벽은 6m 로 고정(성벽 위 통로)
      const brk = (lx, lz) => fbm(K.n4, lx * 0.09 + p.x * 0.01, lz * 0.09 + p.z * 0.01, 2);
      const hF = (lx, lz) => { if (lz > 18) return -1; const b = brk(lx, lz); return b > 0.18 ? 1.1 : b > 0.05 ? 3.2 : 6 + b * 6; };
      // 모서리 탑(7×7) 안으로 성벽이 들어가지 않게 탑 바깥에서 끊는다
      v2Wall(K, O, -20.4, -19, 20.4, -19, 6, 1.8, stone, { hFn: hF, gate: [[0, -19, 3]] });
      v2Wall(K, O, -24, -15.4, -24, 15.4, 6, 1.8, moss, { hFn: hF });
      v2Wall(K, O, 24, -15.4, 24, 15.4, 6, 1.8, stone, { hFn: hF });
      v2Wall(K, O, -20.4, 19, 20.4, 19, 6, 1.8, stone, { topY: p.h + 6 });
      O.ramp(4, 15.6, 18, 18.1, 0, 6, 'x', V2_PAL.stoneD);                        // 성벽 위로 오르는 돌계단
      O.loot(14, 6.05, 19, 'high'); O.loot(-12, 6.05, 19, 'high');
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {           // 모서리 탑 (속이 빈 네모 탑, 안쪽으로 문)
        const q = O.pt(sx * 24, sz * 19), T = K.frame(q[0], q[1], rot, heightAt(q[0], q[1])), H = sx > 0 && sz < 0 ? 4 : R(10, 13);
        T.box(-3.4, -0.6, -3.4, 3.4, 0.1, 3.4, V2_PAL.stoneD, { nav: true });
        T.wallX(-3.5, -3.5, 3.5, 0.1, H, 1, sz < 0 ? [] : [K.DOOR(-0.9)], stone); T.wallX(3.5, -3.5, 3.5, 0.1, H, 1, sz > 0 ? [] : [K.DOOR(-0.9)], stone);
        T.wallZ(-3.5, -3, 3, 0.1, H, 1, [{ a: -0.6, b: 0.6, lo: 3, hi: 4.2 }], moss); T.wallZ(3.5, -3, 3, 0.1, H, 1, [{ a: -0.6, b: 0.6, lo: 3, hi: 4.2 }], stone);
        T.loot(0, 0.12, 0.4, 'high'); K.claim(q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4);
      }
      const F = v2Lot(K, O, 0, 3, 11, 10, 'house'); if (F) K.buildHouse(F, 11, 10, 2, [stone, V2_PAL.stoneD], { flatRoof: true, tier: 'high' });
      for (let i = 0; i < 14; i++) { const lx = R(-30, 30), lz = R(-26, 26), q = O.pt(lx, lz), s = R(0.8, 1.8); if (!K.footprintFree(q[0] - s, q[1] - s, q[0] + s, q[1] + s, 0.3)) continue; K.claim(q[0] - s, q[1] - s, q[0] + s, q[1] + s); const y = heightAt(q[0], q[1]); K.addBox(q[0] - s, y - 0.4, q[1] - s * 0.7, q[0] + s, y + R(0.5, 1.3), q[1] + s * 0.7, rng() < 0.5 ? stone : moss); }
      break;
    }
    case 'radar': {
      const rot = v2EntRot(p), O = G(rot), fr = p.r - 6;
      { const q = O.pt(-14, -8); const y = heightAt(q[0], q[1]); v2Geo(K, new THREE.CylinderGeometry(6, 6.4, 6, 18), q[0], y + 2.8, q[1], 0x9aa0a4); v2Geo(K, new THREE.SphereGeometry(7, 18, 12), q[0], y + 9.5, q[1], 0xe8e8e2); K.addBox(q[0] - 6, y - 0.5, q[1] - 6, q[0] + 6, y + 15.5, q[1] + 6, 0, { invisible: true }); K.claim(q[0] - 7, q[1] - 7, q[0] + 7, q[1] + 7); }
      for (const lz of [-16, 10]) { const q = O.pt(18, lz), y = heightAt(q[0], q[1]); K.addBox(q[0] - 0.9, y - 0.5, q[1] - 0.9, q[0] + 0.9, y + 5, q[1] + 0.9, 0x8c9094); const dish = new THREE.SphereGeometry(4.6, 16, 6, 0, TAU, 0, 0.85); v2Geo(K, dish, q[0], y + 8.2, q[1], 0xdcdcd6, -0.9, R(0, TAU), 0); K.claim(q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3); }
      const F = v2Lot(K, O, -6, 24, 16, 9, 'house'); if (F) v2Block(K, F, 16, 9, 2, 0x6b6a56, 0x44443a, { tier: 'top' });
      { const q = O.pt(4, -2), y = heightAt(q[0], q[1]); K.addBox(q[0] - 0.2, y - 0.5, q[1] - 0.2, q[0] + 0.2, y + 28, q[1] + 0.2, 0x9aa0a4); v2Geo(K, new THREE.SphereGeometry(0.45, 8, 6), q[0], y + 28.4, q[1], 0xd03a2a); }
      for (const [sx, sz] of [[1, 1], [-1, -1]]) { const q = O.pt(sx * (fr - 5), sz * (fr - 5)); v2Watchtower(K, q[0], q[1], 6, 'top'); }
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 2.6, 0.08, 0x8a8f8a, { box: { soft: true, mat: 'fence' }, gate: [[0, -fr, 4]] });
      for (let i = 0; i < 4; i++) O.loot(R(-20, 20), 0.05, R(-20, 20), 'top');
      break;
    }
    case 'hospital': {
      const rot = v2EntRot(p), O = G(rot);
      let F = v2Lot(K, O, 0, -8, 32, 12, 'house'); if (F) { v2Block(K, F, 32, 12, 3, 0xe6e3dc, 0x7a8790, { tier: 'mid' }); F.box(-0.35, 7.6, -6.35, 0.35, 9.8, -6.15, 0xc8302a, { noCollide: true }); F.box(-1.1, 8.35, -6.35, 1.1, 9.05, -6.15, 0xc8302a, { noCollide: true }); }
      F = v2Lot(K, O, -24, 22, 14, 10, 'house'); if (F) v2Block(K, F, 14, 10, 2, 0xd8d6cf, 0x6a7680, { tier: 'mid' });
      { const T = K.frame(...O.pt(22, 24), rot, p.h); T.box(-7, -0.4, -7, 7, 0.3, 7, 0x5d5f62, { nav: true }); T.box(-2.4, 0.3, -2.6, -1.6, 0.34, 2.6, 0xf0f0f0, { noCollide: true }); T.box(1.6, 0.3, -2.6, 2.4, 0.34, 2.6, 0xf0f0f0, { noCollide: true }); T.box(-1.6, 0.3, -0.4, 1.6, 0.34, 0.4, 0xf0f0f0, { noCollide: true }); v2ClaimL(K, O, 15, 17, 29, 31); }
      { const T = K.frame(...O.pt(4, 26), rot, p.h); T.box(-8, -0.2, -5, 8, 0.04, 5, 0x3a3c3e, { noCollide: true }); K.buildCar(T, -4, 0, 0xe8e8e8, 0); K.buildCar(T, 0, 0, 0xe8e8e8, 0); w.parking.push(T.pt(4, 0)); }
      break;
    }
    case 'mansion': {
      const rot = v2EntRot(p), O = G(rot), fr = p.r - 8;
      let F = v2Lot(K, O, 0, 6, 22, 13, 'house'); if (F) v2Block(K, F, 22, 13, 2, 0xe8dfca, 0x4b3a33, { tier: 'high', pitched: true, roomW: 5.6 });
      F = v2Lot(K, O, 18, -18, 9, 7, 'warehouse'); if (F) K.buildWarehouse(F, 9, 7, 3.6, 0xc9bfa8, { tier: 'mid', bigDoor: 3.6 });
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 2.4, 0.5, 0xb8ad98, { gate: [[0, -fr, 4]] });
      for (const s of [-1, 1]) v2Wall(K, O, s * 4, -fr + 3, s * 4, -10, 1.3, 1.0, 0x3f6a32);   // 산울타리 길
      { const q = O.pt(0, -20), y = heightAt(q[0], q[1]); v2Geo(K, new THREE.CylinderGeometry(3.2, 3.4, 0.8, 18), q[0], y + 0.2, q[1], 0xbab2a2); v2Geo(K, new THREE.CylinderGeometry(2.8, 2.8, 0.1, 18), q[0], y + 0.58, q[1], 0x4f8fa8); v2Geo(K, new THREE.CylinderGeometry(0.4, 0.6, 2.2, 10), q[0], y + 1.3, q[1], 0xbab2a2); K.addBox(q[0] - 2.6, y - 0.4, q[1] - 2.6, q[0] + 2.6, y + 0.65, q[1] + 2.6, 0, { invisible: true }); K.claim(q[0] - 3.4, q[1] - 3.4, q[0] + 3.4, q[1] + 3.4); }
      { const T = K.frame(...O.pt(-20, -16), rot, p.h); T.box(-6, -0.1, -3.5, 6, 0.03, 3.5, 0x4a9ab8, { noCollide: true }); for (const [a, b, c, d] of [[-6.4, -3.9, 6.4, -3.5], [-6.4, 3.5, 6.4, 3.9], [-6.4, -3.5, -6, 3.5], [6, -3.5, 6.4, 3.5]]) T.box(a, -0.3, b, c, 0.25, d, 0xd8d0c0); v2ClaimL(K, O, -27, -20, -13, -12); }
      { const T = K.frame(...O.pt(-22, 22), rot, p.h); for (const [a, b] of [[-2, -2], [1.8, -2], [-2, 1.8], [1.8, 1.8]]) T.box(a, 0, b, a + 0.2, 2.6, b + 0.2, 0xe8e2d4); T.geo(K.prism(5.2, 5.2, 1.4), 0, 2.6, 0, 0x5a3a30); T.loot(0, 0.05, 0, 'high'); v2ClaimL(K, O, -25, 19, -19, 25); }
      break;
    }
    case 'lighthouse': {
      const [dx, dz] = p.seaDir, tx = p.x + dx * Math.min(14, p.shoreD * 0.5), tz = p.z + dz * Math.min(14, p.shoreD * 0.5), y = heightAt(tx, tz);
      const bands = [0xe8e4dc, 0xc23a30, 0xe8e4dc, 0xc23a30];
      for (let i = 0; i < 4; i++) { const r0 = 3.2 - i * 0.25, r1 = r0 - 0.25; v2Geo(K, new THREE.CylinderGeometry(r1, r0, 6, 16), tx, y + 3 + i * 6, tz, bands[i]); }
      v2Geo(K, new THREE.CylinderGeometry(3.0, 3.0, 0.4, 16), tx, y + 24.2, tz, 0x3a3c3e); v2Geo(K, new THREE.CylinderGeometry(1.8, 1.8, 3, 12), tx, y + 25.9, tz, 0x9fd0e0); v2Geo(K, new THREE.ConeGeometry(2.2, 1.8, 12), tx, y + 28.3, tz, 0xc23a30);
      K.addBox(tx - 2.6, y - 0.5, tz - 2.6, tx + 2.6, y + 29, tz + 2.6, 0, { invisible: true }); K.claim(tx - 3.5, tz - 3.5, tx + 3.5, tz + 3.5); K.mapRect(tx - 3, tz - 3, tx + 3, tz + 3);
      const hx = p.x - dx * 10, hz = p.z - dz * 10, F = K.placeLot(hx, hz, v2FaceRot(-dx, -dz), 9, 7.5, 'house', 2.5);
      if (F) K.buildHouse(F, 9, 7.5, 2, [0xe8e4da, 0x9a3a2e], { tier: 'mid', balcony: true });
      w.lootSpots.push({ x: tx - dx * 4, y: heightAt(tx - dx * 4, tz - dz * 4) + 0.05, z: tz - dz * 4, tier: 'mid' });
      break;
    }
    // ----- 정글 -----
    case 'base': { // 중앙 훈련기지(자체 설계): 담장 · 가운데 연병장 둘레 큰 막사·본부 · 바깥 둘레 식당·격납고·체육관·창고·사격장·장애물 코스·급수탑
      const rot = v2EntRot(p), O = G(rot), fr = p.r - 8, MIL = PAL.military;
      const face = (lx, lz) => { const a = O.pt(0, 0), b = O.pt(lx, lz); return v2FaceRot(b[0] - a[0], b[1] - a[1]); };   // 로컬 방향 → 정면 회전
      const lot = (lx, lz, wd, dp, kind, fx, fz) => { const q = O.pt(lx, lz); return K.placeLot(q[0], q[1], face(fx, fz), wd, dp, kind, 3, 1, 0.5); };
      // 가운데 연병장 둘레: 큰 막사 2(3층) · 본부(2층) · 의무동(2층) — 모두 연병장 쪽을 봄 (본부는 정문 쪽)
      let F = lot(0, 54, 34, 11, 'house', 0, -1); if (F) v2Block(K, F, 34, 11, 3, 0x7a7a62, 0x3d4434, { tier: 'top' });
      F = lot(-56, 0, 32, 11, 'house', 1, 0); if (F) v2Block(K, F, 32, 11, 3, 0x6f6f58, 0x3d4434, { tier: 'top' });
      F = lot(0, -52, 26, 11, 'house', 0, -1); if (F) v2Block(K, F, 26, 11, 2, 0x8a8670, 0x44443a, { tier: 'top' });
      F = lot(56, 2, 20, 10, 'house', -1, 0); if (F) { v2Block(K, F, 20, 10, 2, 0xd8d6cc, 0x5d6168, { tier: 'high' }); F.box(-0.3, 5.0, -5.35, 0.3, 6.6, -5.15, 0xc8302a, { noCollide: true }); F.box(-0.8, 5.5, -5.35, 0.8, 6.1, -5.15, 0xc8302a, { noCollide: true }); }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { F = lot(sx * 40, sz * 34, 14, 7, 'barracks', -sx, -sz); if (F) K.buildHouse(F, 14, 7, 1, RP(MIL), { flatRoof: true, tier: 'top' }); }
      // 연병장: 국기 게양대 · 사열대(지붕 덮인 단)
      O.box(-0.12, 0, -16, 0.12, 14, -15.76, 0x9aa0a4); O.box(0.12, 11.8, -15.92, 2.6, 13.4, -15.84, 0x3d6a3a, { noCollide: true });
      { const T = K.frame(...O.pt(0, 30), rot, p.h); T.box(-7, -0.4, -2.5, 7, 1.0, 2.5, 0x77736a, { nav: true }); T.ramp(-1.2, -5.2, 1.2, -2.5, 0, 1.0, 'z', 0x6e6c66); for (const x of [-6.6, 6.6]) T.box(x - 0.15, 1.0, 1.9, x + 0.15, 4.0, 2.2, 0x6a6e72); T.box(-7.4, 4.0, -1.2, 7.4, 4.3, 2.6, 0x4a4f52); T.loot(-3, 1.02, 0, 'top'); T.loot(3, 1.02, 0, 'top'); v2ClaimL(K, O, -7.5, 24.5, 7.5, 33); }
      // 바깥 둘레: 식당 · 격납고(차량) · 체육관 · 창고 컨테이너
      F = lot(-84, -62, 22, 14, 'warehouse', 1, 0); if (F) K.buildWarehouse(F, 22, 14, 6, 0x8c8a7a, { tier: 'high', roof: 0x4a4f52 });
      F = lot(84, -64, 28, 18, 'hangar', -1, 0); if (F) K.buildWarehouse(F, 28, 18, 8.5, 0x6a7060, { bigDoor: 10, tier: 'top', roof: 0x3e4438 });
      F = lot(-86, 64, 22, 16, 'warehouse', 1, 0); if (F) K.buildWarehouse(F, 22, 16, 8, 0x7d7a68, { tier: 'high', roof: 0x44443a });
      for (const lz of [44, 66, 88]) { F = lot(92, lz, 8, 7, 'containers', -1, 0); if (!F) continue; for (let c = 0; c < 3; c++) { K.buildContainer(F, -3.8 + c * 2.6, -3.05, 0, RP(PAL.container), c === 1 && rng() < 0.75, 'top'); if (rng() < 0.5) K.buildContainer(F, -3.8 + c * 2.6, -3.05, 2.6, RP(PAL.container), false); } }
      { const q = O.pt(84, -36), T = K.frame(q[0], q[1], rot, p.h); T.box(-10, -0.2, -6, 10, 0.04, 6, 0x3a3c3e, { noCollide: true }); w.parking.push(T.pt(-5, 0), T.pt(5, 0)); }
      // 사격장: 지붕 덮인 사대 + 25·50m 표적 + 모래주머니
      { const T = K.frame(...O.pt(0, 92), rot, p.h);
        T.box(-24, -0.2, -2, 24, 0.06, 2, 0x6e6c66, { noCollide: true }); for (const x of [-24, -8, 8, 24]) T.box(x - 0.15, 0, 1.6, x + 0.15, 3.2, 1.9, 0x6a5a45); T.box(-24.5, 3.2, -2.2, 24.5, 3.45, 2.4, 0x5d6648);
        for (let i = -3; i <= 3; i++) { T.box(i * 6.5 - 1.6, 0, -0.4, i * 6.5 + 1.6, 1.0, 0.4, PAL.sand); for (const D of [14, 26]) { T.box(i * 6.5 - 0.06, 0, D, i * 6.5 + 0.06, 1.2, D + 0.12, 0x6a5a45); T.box(i * 6.5 - 0.5, 1.2, D, i * 6.5 + 0.5, 2.1, D + 0.06, 0xe8e2d4, { noCollide: true }); } }
        T.loot(-12, 0.08, -1.2, 'high'); T.loot(12, 0.08, -1.2, 'high'); v2ClaimL(K, O, -25, 89, 25, 120); }
      // 장애물 코스: 높낮이가 다른 벽 · 오르는 탑(경사로) · 기어가는 틀
      for (let i = 0; i < 7; i++) { const lx = -104 + i * 7; O.box(lx, 0, -14, lx + 0.4, i % 3 === 2 ? 2.0 : i % 2 ? 1.0 : 1.4, 14, 0x7a5c35); }
      { const T = K.frame(...O.pt(-62, 0), rot, p.h); for (const [a, b] of [[-2, -2], [1.8, -2], [-2, 1.8], [1.8, 1.8]]) T.box(a, 0, b, a + 0.25, 4.2, b + 0.25, 0x6a5a45); T.box(-2.2, 4.0, -2.2, 2.2, 4.25, 2.2, 0x6a5a45); T.ramp(-0.6, -8, 0.6, -2.2, 0, 4.25, 'z', 0x6a5a45); T.loot(0, 4.3, 0.5, 'top'); v2ClaimL(K, O, -65, -9, -59, 3); }
      for (let i = 0; i < 4; i++) { const lz = -40 - i * 6; O.box(-104, 0.6, lz, -76, 0.8, lz + 0.3, 0x6a5a45, { noCollide: true }); for (const lx of [-104, -76]) O.box(lx, 0, lz, lx + 0.3, 0.8, lz + 0.3, 0x6a5a45); }
      // 급수탑 (멀리서 보이는 표지) · 천막
      { const q = O.pt(104, 4), y = heightAt(q[0], q[1]); for (const [a, b] of [[-2.4, -2.4], [2.1, -2.4], [-2.4, 2.1], [2.1, 2.1]]) K.addBox(q[0] + a, y - 0.5, q[1] + b, q[0] + a + 0.3, y + 14, q[1] + b + 0.3, 0x6a6e72); v2Geo(K, new THREE.CylinderGeometry(3.4, 3.4, 4.5, 14), q[0], y + 16.2, q[1], 0x7d8a6a); v2Geo(K, new THREE.ConeGeometry(3.6, 1.6, 14), q[0], y + 19.2, q[1], 0x4a5240); K.addBox(q[0] - 3, y + 13.9, q[1] - 3, q[0] + 3, y + 18.5, q[1] + 3, 0, { invisible: true }); K.claim(q[0] - 3.5, q[1] - 3.5, q[0] + 3.5, q[1] + 3.5); K.mapRect(q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3); }
      for (const lx of [36, 50, 64]) { const q = O.pt(lx, -100), T = K.frame(q[0], q[1], rot, heightAt(q[0], q[1])); T.box(-2.2, 0, -3, 2.2, 0.1, 3, 0x4a4a3a, { noCollide: true }); T.geo(K.prism(4.6, 6.2, 2.4), 0, 0, 0, 0x5d6648); T.box(-1.6, 0, -2.6, 1.6, 1.6, 2.6, 0, { invisible: true }); T.loot(0, 0.12, 0, 'high'); K.claim(q[0] - 3.2, q[1] - 3.2, q[0] + 3.2, q[1] + 3.2); }
      // 담장(2.8m, 넘을 수 없음) · 문 4곳 · 모서리 감시탑
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 2.8, 0.5, 0x8f8b7e, { gate: [[0, -fr, 7], [-fr, 0, 5], [fr, 0, 5], [0, fr, 5]] });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const q = O.pt(sx * (fr - 6), sz * (fr - 6)); v2Watchtower(K, q[0], q[1], 7, 'top'); }
      for (let i = 0; i < 6; i++) { const lx = R(-30, 30), lz = R(-30, 22); O.loot(lx, 0.05, lz, 'high'); }
      break;
    }
    case 'camp': { // 정글 훈련소: 본부·막사·장애물 코스·감시탑·천막
      const rot = v2EntRot(p), O = G(rot), fr = p.r - 6;
      let F = v2Lot(K, O, 0, -22, 18, 9, 'house'); if (F) v2Block(K, F, 18, 9, 2, 0x6b6a56, 0x3d4434, { tier: 'top' });
      for (const [lx, lz] of [[-26, 4], [26, 4], [-26, 24], [26, 24]]) { F = v2Lot(K, O, lx, lz, 14, 7, 'barracks'); if (F) K.buildHouse(F, 14, 7, 1, RP(PAL.military), { flatRoof: true, tier: 'top' }); }
      for (let i = 0; i < 6; i++) { const lz = -6 + i * 7; O.box(-6, 0, lz, 6, i % 2 ? 1.0 : 1.9, lz + 0.4, 0x7a5c35); }   // 장애물: 낮은 벽·높은 벽 번갈아
      { const T = K.frame(...O.pt(0, 42), rot, p.h); for (const [a, b] of [[-2, -2], [1.8, -2], [-2, 1.8], [1.8, 1.8]]) T.box(a, 0, b, a + 0.25, 3.4, b + 0.25, 0x6a5a45); T.box(-2.2, 3.2, -2.2, 2.2, 3.45, 2.2, 0x6a5a45); T.ramp(-0.6, -7, 0.6, -2.2, 0, 3.45, 'z', 0x6a5a45); T.loot(0, 3.5, 0.5, 'top'); v2ClaimL(K, O, -3, 34, 3, 45); }
      for (const lx of [36, 46, 56]) { const q = O.pt(lx > fr - 6 ? fr - 8 : lx, -40), T = K.frame(q[0], q[1], rot, heightAt(q[0], q[1])); T.box(-2.2, 0, -3, 2.2, 0.1, 3, 0x4a4a3a, { noCollide: true }); T.geo(K.prism(4.6, 6.2, 2.4), 0, 0, 0, 0x5d6648); T.box(-1.6, 0, -2.6, 1.6, 1.6, 2.6, 0, { invisible: true }); K.claim(q[0] - 3.2, q[1] - 3.2, q[0] + 3.2, q[1] + 3.2); }
      for (const [sx, sz] of [[-1, -1], [1, 1]]) { const q = O.pt(sx * (fr - 5), sz * (fr - 5)); v2Watchtower(K, q[0], q[1], 6, 'top'); }
      O.box(10, 0, -34, 10.2, 9, -33.8, 0x8a8f94); O.box(10.2, 7.4, -33.95, 12.6, 8.9, -33.85, 0x3d6a3a, { noCollide: true });
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 2.6, 0.08, 0x8a8f8a, { box: { soft: true, mat: 'fence' }, gate: [[0, -fr, 5]] });
      break;
    }
    case 'temple': { // 사원 유적: 4단 계단식 기단(단마다 2.4m, 앞뒤 돌계단) + 꼭대기 사당 + 기둥 길·무너진 담
      const rot = v2EntRot(p), O = G(rot), O2 = G((rot + 2) % 4), S = [34, 26, 18, 10], st = [V2_PAL.stone, V2_PAL.moss, V2_PAL.stone, V2_PAL.moss];
      for (let k = 0; k < 4; k++) {
        const s = S[k] / 2, y0 = k ? k * 2.4 : -1.5, y1 = (k + 1) * 2.4;
        O.box(-s, y0, -s, s, y1, s, st[k], k === 3 ? { nav: true } : {});
        const L = k ? 4 : 4.5;
        for (const F of [O, O2]) F.ramp(-2, -s - L, 2, -s, k * 2.4, y1, 'z', V2_PAL.stoneD);
        if (k) { O.loot(-s + 1.6, y0 + 0.02, -s - 2, 'high'); O.loot(s - 1.6, y0 + 0.02, s + 2, 'high'); }
      }
      v2ClaimL(K, O, -17, -22, 17, 22);
      { const y = 9.6; for (const [a, b] of [[-4.4, -4.4], [3.6, -4.4], [-4.4, 3.6], [3.6, 3.6]]) O.box(a, y, b, a + 0.8, y + 3.2, b + 0.8, V2_PAL.stoneD); O.box(-5.5, y + 3.2, -5.5, 5.5, y + 3.7, 5.5, V2_PAL.stone); O.box(-3.5, y + 3.7, -3.5, 3.5, y + 4.6, 3.5, V2_PAL.moss, { noCollide: true }); O.box(-0.8, y, -0.5, 0.8, y + 1.0, 0.5, V2_PAL.stoneD); O.loot(-2, y + 0.02, 1.6, 'top'); O.loot(2, y + 0.02, -1.6, 'top'); }
      for (let lz = -60; lz <= -26; lz += 6.5) for (const lx of [-8, 8]) {   // 기둥 길 (일부는 쓰러짐)
        const q = O.pt(lx, lz), y = heightAt(q[0], q[1]);
        if (rng() < 0.3) { v2Geo(K, new THREE.CylinderGeometry(0.6, 0.6, 4.4, 10), q[0] + 1.2, y + 0.55, q[1], V2_PAL.moss, 0, 0, Math.PI / 2); K.addBox(q[0] - 1, y - 0.3, q[1] - 1, q[0] + 3.4, y + 1.1, q[1] + 1, 0, { invisible: true }); }
        else { const hh = R(2, 5); v2Geo(K, new THREE.CylinderGeometry(0.55, 0.65, hh, 10), q[0], y + hh / 2 - 0.2, q[1], V2_PAL.stone); K.addBox(q[0] - 0.55, y - 0.3, q[1] - 0.55, q[0] + 0.55, y + hh, q[1] + 0.55, 0, { invisible: true }); }
        K.claim(q[0] - 1.2, q[1] - 1.2, q[0] + 3.5, q[1] + 1.2);
      }
      const fr = p.r - 10, hF = () => rng() < 0.3 ? -1 : R(1.1, 3.2);
      for (const [a, b, c, d] of [[-fr, -fr, fr, -fr], [-fr, fr, fr, fr], [-fr, -fr, -fr, fr], [fr, -fr, fr, fr]]) v2Wall(K, O, a, b, c, d, 2, 1.2, V2_PAL.moss, { hFn: hF, gate: [[0, -fr, 5], [0, fr, 5]] });
      for (const [lx, lz] of [[-22, -20], [22, -20], [-22, 22], [22, 22]]) { const q = O.pt(lx, lz), y = heightAt(q[0], q[1]); K.addBox(q[0] - 1, y - 0.3, q[1] - 1, q[0] + 1, y + 1.2, q[1] + 1, V2_PAL.stoneD); K.addBox(q[0] - 0.6, y + 1.2, q[1] - 0.6, q[0] + 0.6, y + 3.0, q[1] + 0.6, V2_PAL.stone); K.claim(q[0] - 1.2, q[1] - 1.2, q[0] + 1.2, q[1] + 1.2); }
      break;
    }
    case 'resort': { // 해변 리조트: 호텔(바다 쪽 객실) · 해변 빌라 · 수영장 · 파라솔
      const [dx, dz] = p.seaDir, rot = v2FaceRot(-dx, -dz), O = G(rot);   // 로컬 +z 가 바다
      let F = v2Lot(K, O, 0, -24, 28, 10, 'house'); if (F) v2Block(K, F, 28, 10, 2, RP(V2_PAL.tropic)[0], 0x2f6f73, { tier: 'mid' });
      for (let i = 0; i < 4; i++) { F = v2Lot(K, O, -33 + i * 22, 8, 9, 8, 'house', 2.5); if (F) K.buildHouse(F, 9, 8, 1, [0xf2ece0, 0x8a6a3a], { tier: 'mid' }); }
      { const T = K.frame(...O.pt(0, -6), rot, p.h); T.box(-8, -0.1, -4, 8, 0.03, 4, 0x3fa0c0, { noCollide: true }); for (const [a, b, c, d] of [[-9, -5, 9, -4], [-9, 4, 9, 5], [-9, -4, -8, 4], [8, -4, 9, 4]]) T.box(a, -0.3, b, c, 0.22, d, 0xe8e0cc); v2ClaimL(K, O, -9.5, -11.5, 9.5, -0.5); }
      for (let i = 0; i < 6; i++) { const q = O.pt(-30 + i * 12, Math.min(p.shoreD - 6, 30)), y = heightAt(q[0], q[1]); if (y < 0.4) continue; K.addBox(q[0] - 0.06, y - 0.3, q[1] - 0.06, q[0] + 0.06, y + 2.3, q[1] + 0.06, 0xd8d0c0); v2Geo(K, new THREE.ConeGeometry(1.7, 0.7, 10), q[0], y + 2.45, q[1], i % 2 ? 0xd85a3a : 0x2f8a9a); K.addBox(q[0] + 0.6, y - 0.2, q[1] - 0.4, q[0] + 2.4, y + 0.4, q[1] + 0.4, 0xe8e0cc); }
      break;
    }
    case 'watervil': { // 수상 마을: 해안에서 뻗은 판자 길 + 기둥 위 집
      const [sx, sz] = p.shore, rot = v2FaceRot(sx - p.x, sz - p.z), O = G(rot, 0), D = Math.hypot(sx - p.x, sz - p.z) + 4, DECK = 1.4, plank = 0x8a6a46, post = 0x5a4632;
      const walk = (x0, z0, x1, z1) => { O.box(x0, DECK - 0.3, z0, x1, DECK, z1, plank, { nav: true }); const ax = x1 - x0 > z1 - z0; for (let s = ax ? x0 : z0; s <= (ax ? x1 : z1); s += 5) for (const e of [-1, 1]) { const px = ax ? s : (x0 + x1) / 2 + e * (x1 - x0) / 2, pz = ax ? (z0 + z1) / 2 + e * (z1 - z0) / 2 : s; O.box(px - 0.12, -3, pz - 0.12, px + 0.12, DECK - 0.3, pz + 0.12, post, { noCollide: true }); } const a = O.pt(x0, z0), b = O.pt(x1, z1); K.claim(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])); };
      walk(-1.1, -D, 1.1, 46);
      const lanes = [-28, 4, 34];
      for (const lz of lanes) walk(-54, lz - 1.1, 54, lz + 1.1);
      for (const lz of lanes) for (const lx of [-46, -32, -18, 18, 32, 46]) for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        const wd = R(6.5, 8), dp = R(6, 7), cz = lz + side * (1.2 + dp / 2 + 0.15), q = O.pt(lx, cz);
        if (heightAt(q[0], q[1]) > 0.3) continue;
        const r = K.worldRect(q[0], q[1], (rot + (side > 0 ? 0 : 2)) % 4, wd, dp); if (!K.footprintFree(r[0], r[1], r[2], r[3], 0.05)) continue;
        K.claim(r[0], r[1], r[2], r[3]);
        const hr = side > 0 ? rot : (rot + 2) % 4, F = K.frame(q[0], q[1], hr, DECK);
        for (const [a, b] of [[-wd / 2, -dp / 2], [wd / 2, -dp / 2], [-wd / 2, dp / 2], [wd / 2, dp / 2]]) F.box(a - 0.15, -3.2, b - 0.15, a + 0.15, -1.6, b + 0.15, post, { noCollide: true });
        K.buildHouse(F, wd, dp, 1, RP(V2_PAL.wood), { tier: 'mid' });
        w.buildings.push({ x: q[0], z: q[1], rect: r, kind: 'house', y: DECK, door: F.pt(0, -dp / 2 - 1.0), visits: 0 });
      }
      for (let i = 0; i < 5; i++) { const q = O.pt(R(-50, 50), R(-40, 44)); if (heightAt(q[0], q[1]) > -0.4 || !K.footprintFree(q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3, 0.5)) continue; const T = K.frame(q[0], q[1], RI(0, 3), 0); T.box(-0.8, -0.4, -2.6, 0.8, 0.35, 2.6, 0x7a5236, { noCollide: true }); }
      break;
    }
    case 'docks': { // 부두: 바다로 뻗은 콘크리트 부두 · 창고 · 컨테이너 · 크레인
      const [dx, dz] = p.seaDir, rot = v2FaceRot(-dx, -dz), O = G(rot), z0 = Math.max(6, p.shoreD - 14), z1 = p.shoreD + 72;
      O.box(-15, -10, z0, 15, 0.12, z1, 0x77736a, { nav: true }); v2ClaimL(K, O, -15, z0, 15, z1); K.mapRect(...O.pt(-15, z0), ...O.pt(15, z1));
      for (let s = z0 + 4; s < z1; s += 9) for (const e of [-14.6, 14.6]) O.box(e - 0.25, 0.12, s, e + 0.25, 0.8, s + 0.5, 0x3a3c3e);
      let F = v2Lot(K, O, -24, -22, 22, 14, 'warehouse'); if (F) K.buildWarehouse(F, 22, 14, R(7, 9), RP(PAL.metal), { tier: 'mid' });
      F = v2Lot(K, O, 24, -22, 22, 14, 'warehouse'); if (F) K.buildWarehouse(F, 22, 14, R(7, 9), RP(PAL.metal), { tier: 'mid' });
      for (let i = 0; i < 3; i++) { F = v2Lot(K, O, -26 + i * 26, 6, 8, 7, 'containers'); if (!F) continue; for (let c = 0; c < 3; c++) { K.buildContainer(F, -3.8 + c * 2.6, -3.05, 0, RP(PAL.container), c === 1 && rng() < 0.7, 'mid'); if (rng() < 0.5) K.buildContainer(F, -3.8 + c * 2.6, -3.05, 2.6, RP(PAL.container), false); } }
      { const T = K.frame(...O.pt(0, z0 + 30), rot, p.h + 0.12); for (let c = 0; c < 4; c++) K.buildContainer(T, -9 + c * 3, -3, 0, RP(PAL.container), c === 2, 'mid'); K.buildContainer(T, -9, -3, 2.6, RP(PAL.container), false); }
      { const T = K.frame(...O.pt(0, z1 - 22), rot, p.h + 0.12), c = 0xd0a02a; for (const [a, b] of [[-11, -6], [10, -6], [-11, 6], [10, 6]]) T.box(a, 0, b, a + 1, 22, b + 1, c); T.box(-12, 22, -7, 12, 24, 8, c); T.box(-1, 22.2, 8, 1, 23.4, 30, c, { noCollide: true }); T.box(-1.6, 20, -2, 1.6, 22, 2, 0x3a3c3e, { noCollide: true }); }
      break;
    }
    case 'paddy': { // 계단논: 지형은 v2AfterTowns 가 1.9m 단으로 끊는다. 가장자리에 오두막
      for (let i = 0, t = 0; i < 3 && t < 30; t++) {
        const a = R(0, TAU), d = R(p.r * 0.75, p.r * 1.0), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        const F = K.placeLot(x, z, RI(0, 3), 6.5, 5.5, 'house', 2.2); if (!F) continue; i++;
        K.buildHouse(F, 6.5, 5.5, 1, RP(V2_PAL.wood), { tier: 'low' });
      }
      break;
    }
  }
}
// 다리 (v2 도로): 도로 방향으로 돌린 상판·난간·교각. 충돌은 도로를 따라 촘촘한 축정렬 상자로 근사
function v2Bridge(K, r, s0, s1, y) {
  const L = s1 - s0, dx = r.dx, dz = r.dz, px = dz, pz = -dx, ry = Math.atan2(dx, dz), hw = r.width / 2 + 0.9;
  const cx = r.ax + dx * (s0 + s1) / 2, cz = r.az + dz * (s0 + s1) / 2;
  v2Geo(K, new THREE.BoxGeometry(hw * 2, 0.65, L), cx, y - 0.275, cz, 0x5d5b57, 0, ry, 0);
  for (const sd of [-1, 1]) v2Geo(K, new THREE.BoxGeometry(0.3, 0.95, L), cx + px * (hw - 0.15) * sd, y + 0.5, cz + pz * (hw - 0.15) * sd, 0x77746e, 0, ry, 0);
  for (let s = 3; s < L - 2; s += 8) v2Geo(K, new THREE.BoxGeometry(1.6, 7.4, 1.4), r.ax + dx * (s0 + s), y - 4.3, r.az + dz * (s0 + s), 0x6a6862, 0, ry, 0);
  const ex = hw * Math.abs(dz) + 0.8, ez = hw * Math.abs(dx) + 0.8;
  for (let s = 0; s <= L; s += 1.6) { const x = r.ax + dx * (s0 + s), z = r.az + dz * (s0 + s); K.addBox(x - ex, y - 0.6, z - ez, x + ex, y + 0.05, z + ez, 0, { invisible: true, nav: true }); }
  for (const sd of [-1, 1]) for (let s = 0; s <= L; s += 1.2) { const x = r.ax + dx * (s0 + s) + px * (hw - 0.15) * sd, z = r.az + dz * (s0 + s) + pz * (hw - 0.15) * sd; K.addBox(x - 0.2, y + 0.05, z - 0.2, x + 0.2, y + 1.0, z + 0.2, 0, { invisible: true }); }
}
// 냉각탑: 쌍곡면 껍데기(안·밖 두 겹) + 근사 충돌 상자 3단
function v2CoolingTower(K, x, z, y) {
  const pts = [], inn = [];
  for (let h = 0; h <= 46; h += 2) { const r = 12.5 + 8.5 * ((h - 31) / 31) ** 2; pts.push(new THREE.Vector2(r, h)); inn.push(new THREE.Vector2(r - 0.6, h)); }
  inn.reverse();
  v2Geo(K, new THREE.LatheGeometry(pts, 32), x, y - 0.5, z, 0xc9c6bd); v2Geo(K, new THREE.LatheGeometry(inn, 32), x, y - 0.5, z, 0x8f8c84);
  for (const [h0, h1, r] of [[0, 12, 17], [12, 30, 11.5], [30, 46, 11]]) K.addBox(x - r, y - 0.5 + h0, z - r, x + r, y - 0.5 + h1, z + r, 0, { invisible: true });
  K.claim(x - 21, z - 21, x + 21, z + 21); K.mapRect(x - 18, z - 18, x + 18, z + 18);
}
// 굴뚝: 빨강·흰 띠
function v2Chimney(K, x, z, y, H) {
  const n = 6, seg = H / n;
  for (let i = 0; i < n; i++) { const r0 = 2.6 - i * 0.12, r1 = r0 - 0.12; v2Geo(K, new THREE.CylinderGeometry(r1, r0, seg, 14), x, y + seg * (i + 0.5), z, i % 2 ? 0xe8e4dc : 0xb03a2e); }
  v2Geo(K, new THREE.CylinderGeometry(1.8, 1.8, 0.6, 14), x, y + H + 0.3, z, 0x2e3032);
  K.addBox(x - 2.2, y - 0.5, z - 2.2, x + 2.2, y + H, z + 2.2, 0, { invisible: true }); K.claim(x - 3, z - 3, x + 3, z + 3); K.mapRect(x - 2.5, z - 2.5, x + 2.5, z + 2.5);
}

// ---------- 식생 ----------
// 여러 지오메트리를 하나로 (비색인, 법선 재계산)
function v2Merge(list) {
  const pos = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) pos.push(a[i]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
async function v2Vegetation(K) {
  const { w, R, rng, Q, mk, vegMat, JG } = K, RW = K.RV.w;
  // 지역 근처(작은 마을·주유소 포함)는 나무를 비운다: 64m 칸 색인
  const PC = 64, PN = Math.ceil(SIZE / PC), pg = new Array(PN * PN).fill(EMPTY_LIST);
  for (const p of w.pois) {
    const cr = p.type === 'village' || p.type === 'hamlet' ? p.r - 4 : p.type === 'paddy' ? p.r - 6 : p.coast === 'sea' ? 0 : p.r + 6; if (cr <= 0) continue;
    const q = { x: p.x, z: p.z, cr }, i0 = clamp(Math.floor((p.x - cr + HALF) / PC), 0, PN - 1), i1 = clamp(Math.floor((p.x + cr + HALF) / PC), 0, PN - 1), j0 = clamp(Math.floor((p.z - cr + HALF) / PC), 0, PN - 1), j1 = clamp(Math.floor((p.z + cr + HALF) / PC), 0, PN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(pg, j * PN + i, q);
  }
  const nearPoi = (x, z) => { for (const q of pg[clamp(Math.floor((z + HALF) / PC), 0, PN - 1) * PN + clamp(Math.floor((x + HALF) / PC), 0, PN - 1)]) if (Math.hypot(q.x - x, q.z - z) < q.cr) return true; return false; };
  const NO_TREE = new Set([2, 3, 4, 5, 6, 7, 9, 10, 11]);
  const okSpot = (x, z, h, s, rr, rd) => !(h < 1.4 || NO_TREE.has(s) || K.riverDist(x, z) < RW + rd || w.roadDist(x, z) < 6.5 || nearPoi(x, z) || !K.footprintFree(x - rr, z - rr, x + rr, z + rr, 1.0));
  const trees = [], rocks = [], bushes = [], palms = [], bamboo = [], ferns = [], tick = async (f) => K.yieldUI(0.68 + 0.1 * f, '숲과 바위 생성');
  const A = HALF * 0.9;
  if (!JG) { // 노르덴: 숲바닥(8)은 빽빽, 풀밭은 드문드문, 산비탈은 침엽수
    const target = Math.floor(34000 * Q.trees);
    for (let t = 0; t < target * 7 && trees.length < target; t++) {
      if (t % 40000 === 0) await tick(trees.length / target * 0.6);
      const x = R(-A, A), z = R(-A, A), s = surfaceAt(x, z), mw = K.mountW(x, z);
      // 밭: 필지 경계 일부에 나무 울타리(산울타리) — 탁 트인 들판에 엄폐물과 길잡이
      const fx = (x + HALF) % 46, fz = (z + HALF) % 30, hedge = (s === 6 || s === 7) && ((fx < 2.2 && (Math.floor((x + HALF) / 46) * 7 + Math.floor((z + HALF) / 90)) % 3 === 0) || (fz < 2.2 && (Math.floor((z + HALF) / 30) * 5 + Math.floor((x + HALF) / 138)) % 3 === 0));
      const dens = hedge ? 0.9 : s === 8 ? 0.95 : s === 1 ? 0.12 : s === 0 ? 0.05 + mw * 0.6 : 0;
      if (rng() > dens) continue;
      const h = heightAt(x, z); if (!okSpot(x, z, h, hedge ? 0 : s, 0.6, 9)) continue;
      const pine = h > 30 || mw > 0.25 ? rng() < 0.85 : rng() < 0.3, sc = R(0.8, 1.35);
      trees.push({ x, z, y: h, pine, sc, rot: R(0, TAU) });
      K.addCollider(x - 0.28 * sc, h - 0.5, z - 0.28 * sc, x + 0.28 * sc, h + 6.5 * sc, z + 0.28 * sc, { kind: 'tree' });
    }
  } else {   // 정글: 키 큰 활엽수 · 중층 나무 (노르덴보다 훨씬 빽빽)
    const target = Math.floor(30000 * Q.trees);
    for (let t = 0; t < target * 6 && trees.length < target; t++) {
      if (t % 40000 === 0) await tick(trees.length / target * 0.5);
      const x = R(-A, A), z = R(-A, A), s = surfaceAt(x, z), dens = s === 8 ? 1 : s === 0 ? 0.3 : s === 1 ? 0.08 : 0;
      if (rng() > dens) continue;
      const h = heightAt(x, z); if (!okSpot(x, z, h, s, 0.7, 7)) continue;
      const broad = rng() < 0.42, sc = broad ? R(0.85, 1.3) : R(0.9, 1.45);
      trees.push({ x, z, y: h, broad, sc, rot: R(0, TAU) });
      const r = (broad ? 0.42 : 0.28) * sc; K.addCollider(x - r, h - 0.5, z - r, x + r, h + (broad ? 13 : 6.5) * sc, z + r, { kind: 'tree' });
    }
    // 야자수: 해변 · 강가 · 마을 둘레
    const palmT = Math.floor(3200 * Q.trees);
    for (let t = 0; t < palmT * 14 && palms.length < palmT; t++) {
      const x = R(-A, A), z = R(-A, A), h = heightAt(x, z); if (h < 0.9 || h > 40) continue;
      const s = surfaceAt(x, z), rd = K.riverDist(x, z), beach = s === 3 && K.edgeF(x, z) > 0, bank = rd < RW + 40 && rd > RW + 6;
      if (!beach && !bank && !(s === 0 && rng() < 0.25)) continue;
      if (s === 4 || s === 5 || s === 11 || s === 9 || s === 10 || w.roadDist(x, z) < 5.5 || nearPoi(x, z) || !K.footprintFree(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.8)) continue;
      const sc = R(0.8, 1.25); palms.push({ x, z, y: h, sc, rot: R(0, TAU), tx: R(-0.18, 0.18), tz: R(-0.18, 0.18) });
      K.addCollider(x - 0.24 * sc, h - 0.5, z - 0.24 * sc, x + 0.24 * sc, h + 8 * sc, z + 0.24 * sc, { kind: 'tree' });
    }
    // 대나무 덤불: 강가·비탈 군락
    const bamT = Math.floor(2400 * Q.trees);
    for (let t = 0; t < bamT * 12 && bamboo.length < bamT; t++) {
      const x = R(-A, A), z = R(-A, A); if (fbm(K.nF, x * 0.004, z * 0.004, 2) < 0.12) continue;
      const h = heightAt(x, z), s = surfaceAt(x, z); if (!okSpot(x, z, h, s, 1.0, 8)) continue;
      const sc = R(0.8, 1.2); bamboo.push({ x, z, y: h, sc, rot: R(0, TAU) }); K.claim(x - 1.1, z - 1.1, x + 1.1, z + 1.1);
      K.addCollider(x - 0.9 * sc, h - 0.5, z - 0.9 * sc, x + 0.9 * sc, h + 8 * sc, z + 0.9 * sc, { kind: 'tree' });
    }
    // 고사리 (충돌 없음, 그림자 없음)
    const fernT = Math.floor(16000 * Q.trees);
    for (let t = 0; t < fernT * 4 && ferns.length < fernT; t++) {
      const x = R(-A, A), z = R(-A, A), s = surfaceAt(x, z); if (s !== 8 && s !== 0) continue;
      const h = heightAt(x, z); if (h < 1.3 || w.roadDist(x, z) < 4.5 || nearPoi(x, z)) continue;
      ferns.push({ x, z, y: h, sc: R(0.7, 1.4), rot: R(0, TAU) });
    }
  }
  await tick(0.7);
  // 바위 (노르덴은 산에 많이, 정글은 이끼 낀 바위 조금)
  const rockT = JG ? 1600 : 4800;
  for (let t = 0; t < rockT * 10 && rocks.length < rockT; t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z), mw = K.mountW(x, z);
    if (h < 1.2 || s === 4 || s === 5 || s === 11 || s === 9 || s === 10 || K.riverDist(x, z) < RW + 4 || w.roadDist(x, z) < 6 || nearPoi(x, z)) continue;
    if (rng() > (JG ? 0.2 : 0.12) + mw * 0.8 + (s === 2 ? 0.5 : 0)) continue;
    if (!K.footprintFree(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0.5)) continue;
    const sx = R(1.0, 2.6), sy = R(0.7, 1.9), sz = R(1.0, 2.6);
    rocks.push({ x, z, y: h, sx, sy, sz, rot: R(0, TAU) });
    K.claim(x - sx * 0.7, z - sz * 0.7, x + sx * 0.7, z + sz * 0.7);
    K.addCollider(x - sx * 0.68, h - 0.6, z - sz * 0.68, x + sx * 0.68, h + sy * 0.85, z + sz * 0.68, { kind: 'rock' });
  }
  const bushT = Math.floor((JG ? 11000 : 12000) * Q.trees);
  for (let t = 0; t < bushT * 5 && bushes.length < bushT; t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z);
    if (h < 1.3 || s === 4 || s === 5 || s === 3 || s === 11 || s === 9 || s === 10 || w.roadDist(x, z) < 5) continue;
    if (!K.footprintFree(x - 0.8, z - 0.8, x + 0.8, z + 0.8, 0.3)) continue;
    bushes.push({ x, z, y: h, sc: R(0.6, 1.3) });
  }
  await tick(0.85);
  // ----- 인스턴스 메시 -----
  const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 4, 6); trunkG.translate(0, 2, 0);
  const leafG = new THREE.IcosahedronGeometry(2.4, 0); leafG.translate(0, 5.0, 0);
  if (!JG) {
    mk(trunkG, vegMat, trees, (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc * (t.pine ? 1.4 : 1), t.sc); d.rotation.set(0, t.rot, 0); c.setHex(0x5a4330); });
    const pineG = new THREE.ConeGeometry(1.9, 6.2, 7); pineG.translate(0, 6.2, 0);
    mk(pineG, vegMat, trees.filter(t => t.pine), (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.3 + rng() * 0.04, 0.35, 0.2 + rng() * 0.06); });
    mk(leafG, vegMat, trees.filter(t => !t.pine), (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc * R(0.9, 1.2), t.sc, t.sc * R(0.9, 1.2)); d.rotation.set(0, t.rot, 0); c.setHSL(0.22 + rng() * 0.07, 0.42, 0.26 + rng() * 0.08); });
  } else {
    const mid = trees.filter(t => !t.broad), brd = trees.filter(t => t.broad);
    mk(trunkG, vegMat, mid, (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHex(0x4e3a2a); });
    mk(leafG, vegMat, mid, (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc * R(1.0, 1.3), t.sc * R(0.9, 1.15), t.sc * R(1.0, 1.3)); d.rotation.set(0, t.rot, 0); c.setHSL(0.27 + rng() * 0.06, 0.5, 0.2 + rng() * 0.07); });
    const bT = new THREE.CylinderGeometry(0.26, 0.5, 13, 7); bT.translate(0, 6.3, 0);
    mk(bT, vegMat, brd, (t, d, c) => { d.position.set(t.x, t.y - 0.3, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHex(rng() < 0.5 ? 0x8a8070 : 0x6b5a46); });
    const c1 = new THREE.IcosahedronGeometry(1, 1); c1.scale(5.4, 1.9, 5.4); c1.translate(0, 13.4, 0);
    const c2 = new THREE.IcosahedronGeometry(1, 0); c2.scale(3.4, 1.5, 3.2); c2.translate(1.8, 11.6, 0.6);
    const crownG = v2Merge([c1, c2]);
    mk(crownG, vegMat, brd, (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc, t.sc * R(0.9, 1.1), t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.25 + rng() * 0.07, 0.48, 0.17 + rng() * 0.08); });
    // 야자수: 줄기(기울기) + 잎 7장
    const pT = new THREE.CylinderGeometry(0.16, 0.26, 8.4, 6); pT.translate(0, 4.2, 0);
    const fr = []; for (let k = 0; k < 7; k++) { const f = new THREE.ConeGeometry(0.55, 4.4, 4); f.scale(1, 1, 0.22); f.rotateZ(-Math.PI / 2 - 0.42); f.translate(2.0, 7.7, 0); f.rotateY(k * TAU / 7 + 0.3); fr.push(f); }
    const pC = v2Merge(fr);
    const palmFn = (col) => (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(t.tx, t.rot, t.tz, 'YXZ'); col(c); };
    mk(pT, vegMat, palms, palmFn((c) => c.setHex(0x8a7558)));
    mk(pC, vegMat, palms, palmFn((c) => c.setHSL(0.24 + rng() * 0.05, 0.55, 0.26 + rng() * 0.06)));
    // 대나무: 줄기 9개 + 잎 뭉치
    const st = [], lv = [];
    for (let k = 0; k < 7; k++) { const a = k * 2.4, r = 0.25 + (k % 3) * 0.3, hh = 7 + (k * 1.7) % 3, g = new THREE.CylinderGeometry(0.06, 0.09, hh, 5); g.translate(0, hh / 2, 0); g.rotateZ(Math.cos(a) * 0.08); g.rotateX(Math.sin(a) * 0.08); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); st.push(g); if (k % 3 === 0) { const l = new THREE.IcosahedronGeometry(0.9, 0); l.scale(1, 2.0, 1); l.translate(Math.cos(a) * (r + 0.4), hh - 0.6, Math.sin(a) * (r + 0.4)); lv.push(l); } }
    const bS = v2Merge(st), bL = v2Merge(lv);
    mk(bS, vegMat, bamboo, (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.17 + rng() * 0.04, 0.45, 0.38 + rng() * 0.06); });
    mk(bL, vegMat, bamboo, (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.23 + rng() * 0.05, 0.5, 0.3 + rng() * 0.06); });
    // 고사리: 잎 6장 (그림자 없음)
    const ff = []; for (let k = 0; k < 6; k++) { const f = new THREE.ConeGeometry(0.32, 1.4, 3); f.scale(1, 1, 0.25); f.rotateZ(-Math.PI / 2 + 0.75); f.translate(0.5, 0.35, 0); f.rotateY(k * TAU / 6); ff.push(f); }
    const fernG = v2Merge(ff);
    mk(fernG, vegMat, ferns, (t, d, c) => { d.position.set(t.x, t.y - 0.05, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.26 + rng() * 0.06, 0.5, 0.24 + rng() * 0.08); });
    w.objects.traverse((o) => { if (o.isInstancedMesh && o.geometry === fernG) o.castShadow = false; });
    for (const p of palms) trees.push(p);
  }
  mk(new THREE.DodecahedronGeometry(1, 0), vegMat, rocks, (r, d, c) => { d.position.set(r.x, r.y + r.sy * 0.25, r.z); d.scale.set(r.sx, r.sy, r.sz); d.rotation.set(rng() * 0.4, r.rot, rng() * 0.4); if (JG) c.setRGB(0.36 + rng() * 0.06, 0.42 + rng() * 0.06, 0.32); else { const g = 0.42 + rng() * 0.12; c.setRGB(g, g * 0.98, g * 0.93); } });
  mk(new THREE.IcosahedronGeometry(0.9, 0), vegMat, bushes, (b, d, c) => { d.position.set(b.x, b.y + 0.35 * b.sc, b.z); d.scale.set(b.sc, b.sc * 0.75, b.sc); d.rotation.set(0, rng() * 3, 0); c.setHSL(0.25 + rng() * 0.06, JG ? 0.5 : 0.4, (JG ? 0.18 : 0.22) + rng() * 0.06); });
  w.trees = trees; w.rocks = rocks;
}
