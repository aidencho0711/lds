// ============================================================
// 02_world.js — 절차적 섬 맵 생성
//  높이맵(지형) · 강/호수 · 도로/다리 · 마을/도시/군사기지/산업/농장
//  · 건물(실내, 문, 창문, 계단, 2층, 발코니) · 나무/바위/풀
//  충돌 박스(AABB) + 발판(지면 위 걸을 수 있는 면) + 경사로(계단)
// ============================================================
let HF_RES = 2.5;                   // 높이맵 간격 (대형 맵 4m)
let HF_N = SIZE / HF_RES + 1;       // 281
const CG = 8;                       // 충돌 그리드 셀 크기 (m)
let CGN = Math.ceil(SIZE / CG);     // 88
// 맵에 맞춰 크기 관련 값 일괄 변경 (월드 생성 전에 호출)
function setMapSize(mapId) {
  const M = MAPS[mapId] || MAPS.kalden;
  HALF = M.half || 350; SIZE = HALF * 2; HF_RES = M.hfRes || 2.5;
  HF_N = Math.round(SIZE / HF_RES) + 1; CGN = Math.ceil(SIZE / CG); IGN = Math.ceil(SIZE / IG);
}
let W = null;                       // 현재 월드

function heightAt(x, z) {
  const hf = W.hf;
  let gx = (x + HALF) / HF_RES, gz = (z + HALF) / HF_RES;
  gx = clamp(gx, 0, HF_N - 1.001); gz = clamp(gz, 0, HF_N - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const k = j * HF_N + i;
  const h00 = hf[k], h10 = hf[k + 1], h01 = hf[k + HF_N], h11 = hf[k + HF_N + 1];
  if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
  return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
function surfaceAt(x, z) {
  const i = clamp(Math.round((x + HALF) / HF_RES), 0, HF_N - 1), j = clamp(Math.round((z + HALF) / HF_RES), 0, HF_N - 1);
  return W.surf[j * HF_N + i];
}
function cellIndex(x, z) {
  const i = clamp(Math.floor((x + HALF) / CG), 0, CGN - 1), j = clamp(Math.floor((z + HALF) / CG), 0, CGN - 1);
  return j * CGN + i;
}
// 발이 feetY에 있을 때 밟을 수 있는 가장 높은 지면
function groundAt(x, z, feetY) {
  let g = heightAt(x, z);
  const lim = feetY + STEP_H;
  const c = cellIndex(x, z);
  const list = W.grid[c];
  for (let n = 0; n < list.length; n++) {
    const b = list[n];
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= lim && b.y1 > g) g = b.y1;
  }
  const rl = W.rgrid[c];
  for (let n = 0; n < rl.length; n++) {
    const r = rl[n];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      let t = r.ax === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
      if (r.dir < 0) t = 1 - t;
      const y = r.y0 + (r.y1 - r.y0) * t;
      if (y <= lim && y > g) g = y;
    }
  }
  return g;
}
// 머리 위 천장 높이 (점프 시)
function ceilingAt(x, z, headY) {
  let c = 1e9;
  const list = W.grid[cellIndex(x, z)];
  for (const b of list) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y0 >= headY - 0.25 && b.y0 < c) c = b.y0;
  return c;
}
// 머리 위에 지붕이 있는지 (실내 판정: 소리 잔향, 비 등)
function isIndoor(x, z, y) { return ceilingAt(x, z, y + 1.6) < y + 12; }

// 박스 질의 (중복 제거)
let _qStamp = 1;
function queryBoxes(x0, z0, x1, z1, out) {
  out.length = 0; _qStamp++;
  const i0 = clamp(Math.floor((x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((x1 + HALF) / CG), 0, CGN - 1);
  const j0 = clamp(Math.floor((z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((z1 + HALF) / CG), 0, CGN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const l = W.grid[j * CGN + i];
    for (let n = 0; n < l.length; n++) { const b = l[n]; if (b._q !== _qStamp) { b._q = _qStamp; out.push(b); } }
  }
  return out;
}

// ---------- 지오메트리 병합 배치 (드로우콜 절감) ----------
class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; }
  get vcount() { return this.pos.length / 3; }
  box(x0, y0, z0, x1, y1, z1, color) {
    const c = new THREE.Color(color), b = this.vcount;
    const P = this.pos, N = this.nor, C = this.col, I = this.idx;
    const faces = [
      [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], 0.88],
      [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], 0.82],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], 1.04],
      [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], 0.6],
      [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [0, 0, 1], 0.93],
      [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1], 0.86],
    ];
    let v = b;
    for (const f of faces) {
      for (let k = 0; k < 4; k++) { P.push(f[k][0], f[k][1], f[k][2]); N.push(f[4][0], f[4][1], f[4][2]); C.push(c.r * f[5], c.g * f[5], c.b * f[5]); }
      I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
  }
  geo(g, matrix, color) {
    const c = new THREE.Color(color);
    g = g.index ? g.toNonIndexed() : g.clone();
    g.applyMatrix4(matrix); g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, b = this.vcount;
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]); this.nor.push(n[i], n[i + 1], n[i + 2]);
      const shade = 0.85 + 0.15 * Math.max(0, n[i + 1]);
      this.col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    for (let i = 0; i < p.length / 3; i++) this.idx.push(b + i);
    g.dispose();
  }
  build(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vcount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ---------- 월드 생성 ----------
async function generateWorld(mapId, scene, progress) {
  const M = MAPS[mapId];
  const rng = mulberry32(M.seed);
  const R = (a = 0, b = 1) => a + rng() * (b - a);
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const RP = (arr) => arr[Math.floor(rng() * arr.length)];
  const n1 = makeNoise(rng), n2 = makeNoise(rng), n3 = makeNoise(rng), n4 = makeNoise(rng);
  const yieldUI = async (p, label) => { progress && progress(p, label); await new Promise(r => setTimeout(r, 0)); };

  const w = W = {
    mapId, hf: new Float32Array(HF_N * HF_N), surf: new Uint8Array(HF_N * HF_N),
    boxes: [], grid: [], rgrid: [], ramps: [], navSurf: [], pois: [], buildings: [], lootSpots: [],
    roads: [], bridges: [], footprints: [], objects: new THREE.Group(), labels: [], parking: [],
  };
  w.grid = new Array(CGN * CGN).fill(EMPTY_LIST); w.rgrid = new Array(CGN * CGN).fill(EMPTY_LIST);
  scene.add(w.objects);

  await yieldUI(0.05, '지형 설계');
  // ----- 거시 레이아웃 -----
  const big = !!M.big, SC_ = HALF / 350, TR = !!M.training, AR = !!M.arena, FLAT = TR || AR;
  w.big = big; w.isTraining = TR; w.isArena = AR;
  // 산(여러 개 가능)·호수·강. 대형 맵은 산맥 4개, 호수 3개, 큰 강 1개
  const mounts = [], lakes = [];
  const mA = R(0, TAU);
  if (FLAT) { /* 훈련장·아레나: 평지 */ }
  else if (!big) {
    mounts.push({ x: Math.cos(mA) * R(170, 220), z: Math.sin(mA) * R(170, 220), r: R(150, 190) });
    const lA = mA + Math.PI + R(-0.9, 0.9);
    lakes.push({ x: Math.cos(lA) * R(110, 190), z: Math.sin(lA) * R(110, 190), r: R(42, 60) });
  } else {
    for (let i = 0; i < 4; i++) { const a = mA + i * TAU / 4 + R(-0.5, 0.5), d = R(0.35, 0.62) * HALF; mounts.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: R(520, 900) }); }
    for (let i = 0, t = 0; i < 3 && t < 200; t++) {
      const x = R(-HALF * 0.6, HALF * 0.6), z = R(-HALF * 0.6, HALF * 0.6), r = R(230, 420);
      if (mounts.some(m => Math.hypot(m.x - x, m.z - z) < m.r * 0.7) || lakes.some(l => Math.hypot(l.x - x, l.z - z) < 900)) continue;
      lakes.push({ x, z, r }); i++;
    }
  }
  const mount = mounts[0], lake = lakes[0];
  const river = big ? { axisX: rng() < 0.5, v0: R(-600, 600), ph: R(0, TAU), ph2: R(0, TAU), w: 15, A1: 330, F1: 0.0012, A2: 120, F2: 0.0037 }
    : { axisX: rng() < 0.5, v0: FLAT ? 1e6 : R(-60, 60), ph: R(0, TAU), ph2: R(0, TAU), w: 9, A1: 42, F1: 0.011, A2: 16, F2: 0.029 };
  w.mount = mount; w.lake = lake; w.river = river; w.mounts = mounts; w.lakes = lakes;
  const riverF = (u) => river.v0 + river.A1 * Math.sin(u * river.F1 + river.ph) + river.A2 * Math.sin(u * river.F2 + river.ph2);
  const riverDF = (u) => river.A1 * river.F1 * Math.cos(u * river.F1 + river.ph) + river.A2 * river.F2 * Math.cos(u * river.F2 + river.ph2);
  function riverDist(x, z) {
    const u = river.axisX ? x : z, v = river.axisX ? z : x;
    return Math.abs(v - riverF(u)) / Math.sqrt(1 + riverDF(u) ** 2);
  }
  w.riverDist = riverDist;
  w.riverPt = (u) => river.axisX ? [u, riverF(u)] : [riverF(u), u];
  const edgeF = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)) * 0.65 + Math.hypot(x, z) * 0.35; return sstep(HALF * 0.8, HALF * 0.98, d); };
  // 대형 맵 산맥은 저주파 잡음으로 반경을 비틀어 둥근 덩어리 대신 길게 뻗은 능선 모양으로
  const mountW = (x, z) => { let m = 0; for (const mt of mounts) { let d = Math.hypot(x - mt.x, z - mt.z); if (d > mt.r * 1.7) continue; if (big) d *= 1 + fbm(n3, x * 0.0009 + 7, z * 0.0009 - 3, 2) * 0.9; const v = sstep(mt.r, mt.r * 0.2, d); if (v > m) m = v; } return m; };
  // 훈련장 지형: 6m 평지 + 서쪽 오프로드 언덕 몇 개
  const TR_HILLS = [[-150, -90, 34, 5], [-135, 15, 24, 3.2], [-115, -155, 38, 6.5], [-170, -20, 20, 2.4], [-95, -40, 16, 1.8]];
  function rawH(x, z) {
    if (AR) return lerp(6, -9, edgeF(x, z));
    if (TR) {
      let h = 6;
      for (const [hx, hz, r, a] of TR_HILLS) { const d = Math.hypot(x - hx, z - hz); if (d < r) h += a * 0.5 * (1 + Math.cos(Math.PI * d / r)); }
      return lerp(h, -9, edgeF(x, z));
    }
    let h;
    if (big) h = 6 + fbm(n1, x * 0.0011, z * 0.0011, 5) * 22 + fbm(n2, x * 0.0065, z * 0.0065, 3) * 4.5 + fbm(n2, x * 0.03, z * 0.03, 2) * 1.0;
    else h = 5 + fbm(n1, x * 0.0055, z * 0.0055, 4) * 9 + fbm(n2, x * 0.03, z * 0.03, 2) * 1.0;
    h = Math.max(h, 1.6);
    const mw = mountW(x, z);
    if (mw > 0) { const r = 1 - Math.abs(fbm(n3, x * 0.011 / (big ? 3 : 1), z * 0.011 / (big ? 3 : 1), 4)) * 1.7; h += mw * M.mountain * clamp(r, 0.12, 1) + mw * 6; }
    for (const lk of lakes) { const ld = Math.hypot(x - lk.x, z - lk.z); if (ld < lk.r + 40) h = lerp(h, -4.5, sstep(lk.r + 32, lk.r * 0.55, ld)); }
    h = lerp(h, -9, edgeF(x, z));
    return h;
  }

  // ----- 관심 지점(POI) 배치 -----
  const NAMES = {
    city: ['베르겐 시', '노르하임', '카스텔 시티', '오스트라 시', '벨모어 시'], military: ['블랙록 기지', '아이언게이트 기지', '레드밸리 기지'], industrial: ['스틸워크 공단', '레드크레인 항만', '콜드포지 제련소', '하버라인 공단'],
    farm: ['하이필드 농장', '골든팜', '윈드밀 농장', '선플레인 농장', '클로버 농장', '앰버필드', '레이크뷰 농장'],
    village: ['솔레 마을', '오크린 마을', '리베 마을', '파인홀', '브룩사이드', '모스글렌', '애쉬포드', '실버크릭', '톨브리지', '하트우드', '스톤웰', '펀우드', '밀브룩', '레드윅', '로웰', '케스윅', '던모어', '글렌포트', '하이턴', '이스트밀'],
    depot: ['북부 물류창고', '그레이야드 창고', '남부 보급창', '이스트게이트 창고'],
  };
  const poiSpec = FLAT ? [] : big
    ? [['city', 110, 'high'], ['city', 105, 'high'], ['city', 100, 'high'], ['military', 82, 'top'], ['military', 78, 'top'], ['industrial', 64, 'mid'], ['industrial', 62, 'mid'], ['industrial', 60, 'mid'],
      ['depot', 36, 'mid'], ['depot', 34, 'mid'], ['depot', 34, 'mid']].concat(Array.from({ length: 6 }, () => ['farm', 52, 'low']), Array.from({ length: 18 }, () => ['village', 44, 'low']))
    : [['city', 88, 'high'], ['military', 70, 'top'], ['industrial', 60, 'mid'], ['farm', 52, 'low'], ['village', 42, 'low'], ['village', 40, 'low'], ['village', 40, 'low'], ['depot', 34, 'mid']];
  const used = new Set();
  for (const [type, r, tier] of poiSpec) {
    for (let a = 0; a < (big ? 1500 : 600); a++) {
      const x = R(-HALF * (big ? 0.78 : 0.7), HALF * (big ? 0.78 : 0.7)), z = R(-HALF * (big ? 0.78 : 0.7), HALF * (big ? 0.78 : 0.7));
      if (lakes.some(lk => Math.hypot(x - lk.x, z - lk.z) < lk.r + r + 26)) continue;
      if (riverDist(x, z) < r + 20) continue;
      if (edgeF(x, z) > 0.001 || edgeF(x + r, z + r) > 0.01 || edgeF(x - r, z - r) > 0.01 || edgeF(x + r, z - r) > 0.01 || edgeF(x - r, z + r) > 0.01) continue;
      const mw = mountW(x, z);
      if (type !== 'military' && mw > 0.35) continue;
      if (w.pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 34 + (big ? 330 : 0))) continue;
      const h = clamp(rawH(x, z), 3, 26);
      const names = NAMES[type].filter(nm => !used.has(nm)); const name = names.length ? names[Math.floor(rng() * names.length)] : NAMES[type][0] + ' ' + (w.pois.length + 1); used.add(name);
      w.pois.push({ type, x, z, r, h, tier, name });
      break;
    }
  }
  // POI 공간 색인 (64m 칸, 영향 반경 r+60) — 높이맵·표면·식생 계산에서 전체 POI 순회를 피함
  const PC = 64, PN = Math.ceil(SIZE / PC), poiGrid = new Array(PN * PN).fill(EMPTY_LIST);
  for (const p of w.pois) {
    const rr = p.r + 60, i0 = clamp(Math.floor((p.x - rr + HALF) / PC), 0, PN - 1), i1 = clamp(Math.floor((p.x + rr + HALF) / PC), 0, PN - 1);
    const j0 = clamp(Math.floor((p.z - rr + HALF) / PC), 0, PN - 1), j1 = clamp(Math.floor((p.z + rr + HALF) / PC), 0, PN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(poiGrid, j * PN + i, p);
  }
  const poisNear = (x, z) => poiGrid[clamp(Math.floor((z + HALF) / PC), 0, PN - 1) * PN + clamp(Math.floor((x + HALF) / PC), 0, PN - 1)];
  w.poisNear = poisNear;
  function afterTowns(x, z) {
    let h = rawH(x, z);
    for (const p of poisNear(x, z)) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 34) h = lerp(h, p.h, sstep(p.r + 34, p.r + 2, d)); }
    return h;
  }

  // ----- 도로망: 최소신장트리 + 보조 연결 -----
  const P = w.pois, inTree = [0], edges = [];
  while (inTree.length < P.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < P.length; b++) if (!inTree.includes(b)) {
      const d = Math.hypot(P[a].x - P[b].x, P[a].z - P[b].z);
      if (!best || d < best[2]) best = [a, b, d];
    }
    edges.push(best); inTree.push(best[1]);
  }
  for (let a = 0; a < P.length; a++) { // 여분 연결
    let bb = -1, bd = 1e9;
    for (let b = 0; b < P.length; b++) if (b !== a && !edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) {
      const d = Math.hypot(P[a].x - P[b].x, P[a].z - P[b].z); if (d < bd) { bd = d; bb = b; }
    }
    if (bb >= 0 && bd < (big ? 1500 : 330) && rng() < 0.45) edges.push([a, bb, bd]);
  }
  function addRoad(ax, az, bx, bz, width, kind) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(len / 2));
    const prof = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) { const t = i / n; prof[i] = afterTowns(ax + (bx - ax) * t, az + (bz - az) * t); }
    const sm = new Float32Array(n + 1), win = 11;
    for (let i = 0; i <= n; i++) { let s = 0, c = 0; for (let k = -win; k <= win; k++) { const q = clamp(i + k, 0, n); s += prof[q]; c++; } sm[i] = Math.max(1.6, s / c); }
    const road = { ax, az, bx, bz, len, n, prof: sm, width, kind, dx: (bx - ax) / len, dz: (bz - az) / len };
    w.roads.push(road); return road;
  }
  for (const [a, b] of edges) addRoad(P[a].x, P[a].z, P[b].x, P[b].z, 7, 'main');
  if (TR) {
    const L = 205, c4 = [[-L, -L], [L, -L], [L, L], [-L, L]];
    for (let i = 0; i < 4; i++) addRoad(c4[i][0], c4[i][1], c4[(i + 1) % 4][0], c4[(i + 1) % 4][1], 9, 'main');
    addRoad(-52, 142, -L, 142, 8, 'main');           // 주차장 → 서쪽 트랙
    addRoad(0, 182, 0, L, 7, 'main');                // 무기고 뒤 → 남쪽 트랙
  }
  // 도시 격자 도로
  for (const city of P.filter(p => p.type === 'city')) {
    const cell = 44, n = city.r >= 100 ? 5 : 4, o = -cell * n / 2;
    for (let k = 0; k <= n; k++) {
      addRoad(city.x + o, city.z + o + k * cell, city.x - o, city.z + o + k * cell, 8, 'street');
      addRoad(city.x + o + k * cell, city.z + o, city.x + o + k * cell, city.z - o, 8, 'street');
    }
    city.grid = { cell, n, o };
  }
  // 도로 공간 색인 (32m 칸): 각 칸에서 32m 이내를 지나는 도로만. 그보다 먼 곳은 '멀다'(1e9)로 본다
  const RC = 32, RN = Math.ceil(SIZE / RC), roadGrid = new Array(RN * RN).fill(EMPTY_LIST);
  for (const r of w.roads) {
    for (let t = 0; t <= r.len + 16; t += 16) {
      const tt = Math.min(t, r.len), x = r.ax + r.dx * tt, z = r.az + r.dz * tt;
      const ci = Math.floor((x + HALF) / RC), cj = Math.floor((z + HALF) / RC);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= RN || j >= RN) continue;
        const k = j * RN + i, l = roadGrid[k]; if (l[l.length - 1] !== r) gridPush(roadGrid, k, r);
      }
    }
  }
  function roadInfo(x, z) {
    let best = 1e9, bh = 0, br = null;
    const list = roadGrid[clamp(Math.floor((z + HALF) / RC), 0, RN - 1) * RN + clamp(Math.floor((x + HALF) / RC), 0, RN - 1)];
    for (const r of list) {
      let t = ((x - r.ax) * r.dx + (z - r.az) * r.dz); t = clamp(t, 0, r.len);
      const px = r.ax + r.dx * t, pz = r.az + r.dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; const f = t / r.len * r.n, i = Math.floor(f); bh = lerp(r.prof[i], r.prof[Math.min(r.n, i + 1)], f - i); br = r; }
    }
    return [best, bh, br];
  }
  w.roadDist = (x, z) => roadInfo(x, z)[0];

  await yieldUI(0.15, '높이맵 계산');
  // ----- 최종 높이맵 + 표면 종류 -----
  // 표면: 0 풀, 1 흙, 2 암석, 3 모래, 4 도로, 5 포장, 6 밭A, 7 밭B, 8 숲바닥
  for (let j = 0; j < HF_N; j++) {
    const z = -HALF + j * HF_RES;
    for (let i = 0; i < HF_N; i++) {
      const x = -HALF + i * HF_RES;
      let h = afterTowns(x, z);
      const rd = riverDist(x, z), carve = sstep(river.w + 8, river.w * 0.55, rd);
      const [rdist, rh] = roadInfo(x, z);
      const rw = sstep(7.5, 3.6, rdist) * (1 - carve);
      h = lerp(h, rh, rw);
      h = lerp(h, -2.8, carve);
      w.hf[j * HF_N + i] = h;
      let s = 0;
      const mw = mountW(x, z);
      if (AR) { // 아레나: 담 안은 콘크리트, 밖은 풀·흙
        const m = Math.max(Math.abs(x), Math.abs(z));
        s = m < 37.5 ? 5 : m < 44 ? 1 : (fbm(n4, x * 0.02, z * 0.02, 3) > 0.2 ? 8 : 0);
        w.surf[j * HF_N + i] = s; continue;
      }
      if (TR) {
        const inR = (x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
        if (rdist < 4.6) s = 4;
        else if (h < 1.1) s = 3;
        else if (inR(-30, 30, 147, 175) || inR(-98, -46, 136, 178) || inR(-82, 66, 116, 126)) s = 5;
        else if (inR(24, 68, -190, 116) || inR(-76, -34, 30, 116) || inR(78, 172, 50, 172)) s = 1;
        else if (TR_HILLS.some(([hx, hz, r]) => Math.hypot(x - hx, z - hz) < r * 0.8)) s = 1;
        else if (fbm(n4, x * 0.012, z * 0.012, 3) > 0.25) s = 8;
        w.surf[j * HF_N + i] = s; continue;
      }
      if (rdist < 4.6 && carve < 0.5) s = 4;
      else if (h < 1.1 || carve > 0.4) s = 3;
      else if (mw > 0.45 && h > 22 + fbm(n4, x * 0.05, z * 0.05, 2) * 6) s = 2;
      else {
        for (const p of poisNear(x, z)) {
          const d = Math.hypot(x - p.x, z - p.z);
          if (p.type === 'farm' && d < p.r + 50 && d > 22) { const u = (x * 0.8 + z * 0.6); s = (Math.floor(u / 7) & 1) ? 6 : 7; break; }
          if (d < p.r - 4 && (p.type === 'city' || p.type === 'military' || p.type === 'industrial' || p.type === 'depot')) { s = 5; break; }
          if (d < p.r * 0.85 && p.type === 'village') { s = fbm(n4, x * 0.08, z * 0.08, 2) > 0.1 ? 1 : 0; break; }
        }
        if (s === 0 && fbm(n4, x * 0.012, z * 0.012, 3) > 0.12) s = 8;
      }
      w.surf[j * HF_N + i] = s;
    }
    if (j % (big ? 60 : 40) === 0) await yieldUI(0.15 + 0.2 * j / HF_N, '높이맵 계산');
  }
  // 경사 급한 곳은 암석
  for (let j = 1; j < HF_N - 1; j++) for (let i = 1; i < HF_N - 1; i++) {
    const k = j * HF_N + i, hf = w.hf;
    const sl = Math.max(Math.abs(hf[k + 1] - hf[k - 1]), Math.abs(hf[k + HF_N] - hf[k - HF_N])) / (2 * HF_RES);
    if (sl > 0.75 && w.surf[k] !== 4 && w.surf[k] !== 3) w.surf[k] = 2;
  }

  // ----- 충돌 박스 API -----
  const batches = new Map();
  const CH = big ? 16 : 4, chunk = (x, z) => clamp(Math.floor((x + HALF) / (SIZE / CH)), 0, CH - 1) + clamp(Math.floor((z + HALF) / (SIZE / CH)), 0, CH - 1) * CH;
  // 대형 맵: 구역(500m)별 물체 목록 → 카메라에서 먼 구역은 숨김
  w.chunkObjs = new Map();
  const regChunk = (k, obj) => { if (!big) return; let e = w.chunkObjs.get(k); if (!e) { const ci = k % CH, cj = Math.floor(k / CH); e = { x: -HALF + (ci + 0.5) * SIZE / CH, z: -HALF + (cj + 0.5) * SIZE / CH, objs: [] }; w.chunkObjs.set(k, e); } e.objs.push(obj); };
  const getBatch = (x, z, key = 'solid') => { const c = chunk(x, z), k = key + c; if (!batches.has(k)) batches.set(k, { key, b: new Batch(), c }); return batches.get(k).b; };
  function addCollider(x0, y0, z0, x1, y1, z1, o = {}) {
    const b = { x0, y0, z0, x1, y1, z1, soft: !!o.soft, nav: !!o.nav, _q: 0, kind: o.kind || 'solid' };
    w.boxes.push(b);
    const i0 = clamp(Math.floor((x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((x1 + HALF) / CG), 0, CGN - 1);
    const j0 = clamp(Math.floor((z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((z1 + HALF) / CG), 0, CGN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(w.grid, j * CGN + i, b);
    if (o.nav) w.navSurf.push(b);
    return b;
  }
  function addBox(x0, y0, z0, x1, y1, z1, color, o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0];
    if (!o.invisible) getBatch((x0 + x1) / 2, (z0 + z1) / 2, o.mat).box(x0, y0, z0, x1, y1, z1, color);
    if (!o.noCollide) return addCollider(x0, y0, z0, x1, y1, z1, o);
    return null;
  }
  function addRamp(x0, z0, x1, z1, y0, y1, ax, dir) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0];
    const r = { x0, z0, x1, z1, y0, y1, ax, dir };
    w.ramps.push(r);
    const i0 = clamp(Math.floor((x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((x1 + HALF) / CG), 0, CGN - 1);
    const j0 = clamp(Math.floor((z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((z1 + HALF) / CG), 0, CGN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(w.rgrid, j * CGN + i, r);
  }
  // 로컬 좌표계(회전 0~3 x 90°) 프레임
  function frame(cx, cz, rot, by) {
    const pt = (lx, lz) => rot === 0 ? [cx + lx, cz + lz] : rot === 1 ? [cx + lz, cz - lx] : rot === 2 ? [cx - lx, cz - lz] : [cx - lz, cz + lx];
    const F = {
      cx, cz, rot, by, pt,
      box(lx0, ly0, lz0, lx1, ly1, lz1, color, o) { const a = pt(lx0, lz0), b = pt(lx1, lz1); return addBox(Math.min(a[0], b[0]), by + ly0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), by + ly1, Math.max(a[1], b[1]), color, o); },
      // z 고정, x 방향 벽. ops: [{a,b,lo,hi}] (로컬 x 구간, 벽 하단 기준 높이)
      wallX(lz, lx0, lx1, y0, h, t, ops, color, o) {
        ops = (ops || []).slice().sort((p, q) => p.a - q.a); let cur = lx0;
        for (const op of ops) {
          if (op.a > cur) F.box(cur, y0, lz - t / 2, op.a, y0 + h, lz + t / 2, color, o);
          if (op.lo > 0) F.box(op.a, y0, lz - t / 2, op.b, y0 + op.lo, lz + t / 2, color, o);
          if (op.hi < h) F.box(op.a, y0 + op.hi, lz - t / 2, op.b, y0 + h, lz + t / 2, color, o);
          cur = op.b;
        }
        if (cur < lx1) F.box(cur, y0, lz - t / 2, lx1, y0 + h, lz + t / 2, color, o);
      },
      wallZ(lx, lz0, lz1, y0, h, t, ops, color, o) {
        ops = (ops || []).slice().sort((p, q) => p.a - q.a); let cur = lz0;
        for (const op of ops) {
          if (op.a > cur) F.box(lx - t / 2, y0, cur, lx + t / 2, y0 + h, op.a, color, o);
          if (op.lo > 0) F.box(lx - t / 2, y0, op.a, lx + t / 2, y0 + op.lo, op.b, color, o);
          if (op.hi < h) F.box(lx - t / 2, y0 + op.hi, op.a, lx + t / 2, y0 + h, op.b, color, o);
          cur = op.b;
        }
        if (cur < lz1) F.box(lx - t / 2, y0, cur, lx + t / 2, y0 + h, lz1, color, o);
      },
      // 경사로: 로컬 축 ax('x'|'z') 양의 방향으로 올라감
      ramp(lx0, lz0, lx1, lz1, ly0, ly1, ax, stepColor) {
        const a = pt(lx0, lz0), b = pt(lx1, lz1);
        let wax, wdir;
        if (ax === 'z') { wax = (rot === 0 || rot === 2) ? 'z' : 'x'; wdir = (rot === 0 || rot === 1) ? 1 : -1; }
        else { wax = (rot === 0 || rot === 2) ? 'x' : 'z'; wdir = (rot === 0 || rot === 3) ? 1 : -1; }
        addRamp(a[0], a[1], b[0], b[1], by + ly0, by + ly1, wax, wdir);
        if (stepColor !== undefined) { // 계단 시각 요소
          const steps = Math.max(4, Math.round((ly1 - ly0) / 0.3));
          for (let s = 0; s < steps; s++) {
            const t0 = s / steps, t1 = (s + 1) / steps, y = ly0 + (ly1 - ly0) * t1;
            if (ax === 'z') F.box(lx0, ly0 - 0.05, lerp(lz0, lz1, t0), lx1, y, lerp(lz0, lz1, t1), stepColor, { noCollide: true });
            else F.box(lerp(lx0, lx1, t0), ly0 - 0.05, lz0, lerp(lx0, lx1, t1), y, lz1, stepColor, { noCollide: true });
          }
        }
      },
      geo(g, lx, ly, lz, color, ry = 0) {
        const p = pt(lx, lz), m = new THREE.Matrix4().makeRotationY(-rot * Math.PI / 2 + ry);
        m.setPosition(p[0], by + ly, p[1]);
        getBatch(p[0], p[1]).geo(g, m, color);
      },
      loot(lx, ly, lz, tier) { const p = pt(lx, lz); w.lootSpots.push({ x: p[0], y: by + ly, z: p[1], tier }); },
    };
    return F;
  }
  // 점유 영역 색인 (16m 칸)
  const FC = 16, FN = Math.ceil(SIZE / FC), fpGrid = new Array(FN * FN).fill(EMPTY_LIST);
  const fcell = (v) => clamp(Math.floor((v + HALF) / FC), 0, FN - 1);
  let fpStamp = 0;
  function footprintFree(x0, z0, x1, z1, margin = 2) {
    fpStamp++;
    for (let j = fcell(z0 - margin - 1); j <= fcell(z1 + margin + 1); j++) for (let i = fcell(x0 - margin - 1); i <= fcell(x1 + margin + 1); i++)
      for (const f of fpGrid[j * FN + i]) { if (f.s === fpStamp) continue; f.s = fpStamp; if (x0 - margin < f[2] && x1 + margin > f[0] && z0 - margin < f[3] && z1 + margin > f[1]) return false; }
    return true;
  }
  function claim(x0, z0, x1, z1) {
    const f = [x0, z0, x1, z1]; f.s = 0; w.footprints.push(f);
    for (let j = fcell(z0); j <= fcell(z1); j++) for (let i = fcell(x0); i <= fcell(x1); i++) gridPush(fpGrid, j * FN + i, f);
  }
  function worldRect(cx, cz, rot, w2, d2) { // 회전 고려 외곽
    const hw = (rot % 2 ? d2 : w2) / 2, hd = (rot % 2 ? w2 : d2) / 2;
    return [cx - hw, cz - hd, cx + hw, cz + hd];
  }
  function baseHeight(r) {
    let mx = -1e9, mn = 1e9;
    for (let x = r[0]; x <= r[2] + 0.01; x += (r[2] - r[0]) / 4) for (let z = r[1]; z <= r[3] + 0.01; z += (r[3] - r[1]) / 4) {
      const h = heightAt(x, z); mx = Math.max(mx, h); mn = Math.min(mn, h);
    }
    return [mx, mn];
  }
  // 건물 주변 지면을 바닥 높이에 맞춤 (현관 턱이 넘을 수 없는 높이가 되지 않도록)
  function flattenRect(r, y) {
    const M = 4.5, i0 = clamp(Math.floor((r[0] - M + HALF) / HF_RES), 0, HF_N - 1), i1 = clamp(Math.ceil((r[2] + M + HALF) / HF_RES), 0, HF_N - 1);
    const j0 = clamp(Math.floor((r[1] - M + HALF) / HF_RES), 0, HF_N - 1), j1 = clamp(Math.ceil((r[3] + M + HALF) / HF_RES), 0, HF_N - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -HALF + i * HF_RES, z = -HALF + j * HF_RES;
      const dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]), d = Math.hypot(dx, dz);
      const k = j * HF_N + i, t = sstep(M, 0.5, d);
      w.hf[k] = lerp(w.hf[k], y - 0.03, t);
    }
  }
  function roadClear(r, m) { // 건물 사각형이 도로와 겹치지 않는지
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2, hd = Math.hypot(r[2] - r[0], r[3] - r[1]) / 2;
    if (w.roadDist(cx, cz) < hd + m) {
      for (let x = r[0]; x <= r[2] + 0.01; x += (r[2] - r[0]) / 3) for (let z = r[1]; z <= r[3] + 0.01; z += (r[3] - r[1]) / 3)
        if (w.roadDist(x, z) < 4.6 + m * 0.5) return false;
    }
    return true;
  }

  // ----- 색상 팔레트 -----
  const PAL = {
    house: [[0xcfc3a8, 0x8a4b3a], [0xb9c0b0, 0x5d6b78], [0xd9d2c2, 0x6e4a3a], [0xa9a08e, 0x4d5a3e], [0xe0d6c0, 0x7d3f33], [0xc2b59b, 0x3e4a5a]],
    city: [[0x8f949a, 0x2f3a46], [0xa4988a, 0x3a3631], [0x7b8792, 0x24303b], [0xb0a99c, 0x4b4741], [0x6d7a73, 0x2a3530]],
    military: [[0x5f6650, 0x3d4434], [0x6b6a56, 0x44443a]],
    metal: [0x7f8a8f, 0x6b7a83, 0x8c8577, 0x5e6c74], barn: [0x8e3b2e, 0x6e2e25],
    found: 0x77736a, floor: 0x9a8f7e, floorWood: 0x8d6e4f, roofDark: 0x3d3a37,
    container: [0xa8452f, 0x2f6a8a, 0x4f7a3a, 0xc08a2a, 0x6a6f74, 0x8a3a5a],
    furn: 0x6b4f37, furn2: 0x5a6068, sand: 0xa89670, rail: 0x55524c,
  };
  const DOOR = (a) => ({ a, b: a + 1.8, lo: 0, hi: 2.35 });
  const WIN = (a, wd = 1.4) => ({ a, b: a + wd, lo: 1.0, hi: 2.15 });

  // ----- 주택 (1~2층, 실내, 문, 창문, 계단, 발코니) -----
  function buildHouse(F, wd, dp, floors, pal, o = {}) {
    const t = 0.24, fh = 3.2, hw = wd / 2, hd = dp / 2, tier = o.tier || 'low';
    const wallC = pal[0], roofC = pal[1];
    F.box(-hw - 0.15, -1.6, -hd - 0.15, hw + 0.15, 0.15, hd + 0.15, PAL.found, { nav: true });
    // 현관 앞 발판
    F.box(-1.4, -1.2, -hd - 1.4, 1.4, 0.05, -hd - 0.15, PAL.found, {});
    // 내부 칸막이 위치: 현관문(로컬 x -0.9~0.9)을 가르지 않도록 문 폭 밖으로 (예전엔 칸막이가 현관 한가운데로 이어져 봇이 못 들어가는 집이 15%)
    let xs = clamp(R(-hw * 0.3, hw * 0.3), -hw + 2.6, hw - 2.6);
    if (Math.abs(xs) < 1.3) xs = (xs < 0 ? -1 : 1) * Math.min(1.3, hw - 2.6);
    const hasStair = floors > 1;
    const sx0 = hw - 1.45, sx1 = hw - t / 2, sz0 = -hd + 0.9, sz1 = sz0 + clamp(dp - 2.4, 3.6, 5.6);
    for (let fl = 0; fl < floors; fl++) {
      const y0 = fl * fh + 0.15, h = fh - 0.15;
      const frontOps = fl === 0 ? [DOOR(-0.9)] : (o.balcony ? [DOOR(-0.9)] : [WIN(-0.7)]);
      if (wd > 7.5) { frontOps.push(WIN(-hw + 1.0)); if (!(hasStair && fl === 0)) frontOps.push(WIN(hw - 2.4)); }
      F.wallX(-hd, -hw, hw, y0, h, t, frontOps, wallC);
      // 뒷문도 칸막이와 겹치면 창문으로
      const backOps = [WIN(-hw + 1.2)]; if (wd > 7) backOps.push(fl === 0 && rng() < 0.6 && (xs < hw - 3.6 || xs > hw - 0.6) ? DOOR(hw - 3.0) : WIN(hw - 2.6));
      F.wallX(hd, -hw, hw, y0, h, t, backOps, wallC);
      F.wallZ(-hw, -hd + t / 2, hd - t / 2, y0, h, t, [WIN(-0.7)], wallC);
      F.wallZ(hw, -hd + t / 2, hd - t / 2, y0, h, t, hasStair ? [WIN(hd - 2.4)] : [WIN(-0.7)], wallC);
      // 칸막이 벽 (문 포함)
      const dz = clamp(R(-hd + 0.6, hd - 2.6), -hd + 0.5, hd - 2.5);
      F.wallZ(xs, -hd + t / 2, hd - t / 2, y0, h, 0.14, [DOOR(dz)], 0xd8d0c0);
      // 봇용 계단 동선 (2층 주택): 계단 옆 A → 계단 발치 B → 계단 위 T → 난간 끝 T2, 위층 칸막이 문 양쪽 Dl/Dr
      if (hasStair && fl === 1 && F.bld) {
        const sxm = (sx0 + sx1) / 2, O = F.pt(0, 0), E = F.pt(1, 0);
        F.bld.st = { A: F.pt(sx0 - 0.75, sz0 + 0.25), B: F.pt(sxm, sz0 + 0.45), T: F.pt(sxm, sz1 + 0.75), T2: F.pt(sx0 - 0.6, sz1 + 0.75),
          Dl: F.pt(xs - 0.6, dz + 0.9), Dr: F.pt(xs + 0.6, dz + 0.9), O, ex: [E[0] - O[0], E[1] - O[1]], xs, y: F.by + fh + 0.15 };
      }
      // 가구
      if (fl === 0) {
        F.box(xs - 2.4, y0, hd - 1.2, xs - 0.6, y0 + 0.78, hd - 0.4, PAL.furn);        // 테이블
        F.box(-hw + 0.3, y0, -hd + 0.4, -hw + 0.8, y0 + 1.9, -hd + 2.0, PAL.furn2);     // 선반
      } else {
        F.box(-hw + 0.4, y0, hd - 2.4, -hw + 1.9, y0 + 0.55, hd - 0.4, 0x7a7f86);        // 침대
      }
      F.loot((-hw + xs) / 2 + R(-0.6, 0.6), y0 + 0.02, R(-hd + 1.5, hd - 1.5), tier);
      if (wd * dp > 70) F.loot((-hw + xs) / 2 + R(-0.6, 0.6), y0 + 0.02, R(-hd + 1.2, hd - 1.2), tier);
      F.loot((xs + hw) / 2 - (hasStair ? 0.8 : 0) + R(-0.4, 0.4), y0 + 0.02, hasStair ? hd - 1.4 : R(-hd + 1.5, hd - 1.5), tier);
      // 위층 바닥 (계단 구멍 제외)
      if (fl > 0) {
        const fy = fl * fh;
        F.box(-hw, fy - 0.12, -hd, sx0, fy + 0.15, hd, PAL.floorWood);
        F.box(sx0, fy - 0.12, sz1, hw, fy + 0.15, hd, PAL.floorWood);
        F.box(sx0, fy - 0.12, -hd, hw, fy + 0.15, sz0, PAL.floorWood);
        F.box(sx0 - 0.08, fy + 0.15, sz0, sx0, fy + 1.1, sz1, PAL.rail); // 난간
      }
    }
    if (hasStair) F.ramp(sx0 + 0.05, sz0, sx1 - 0.05, sz1, 0.15, fh + 0.15, 'z', 0x8a7a66);
    // 발코니
    if (floors > 1 && o.balcony) {
      const fy = fh;
      F.box(-2.2, fy - 0.12, -hd - 2.2, 2.2, fy + 0.15, -hd - t / 2, PAL.found);
      F.box(-2.2, fy + 0.15, -hd - 2.2, 2.2, fy + 1.15, -hd - 2.05, PAL.rail);
      F.box(-2.2, fy + 0.15, -hd - 2.2, -2.05, fy + 1.15, -hd - t / 2, PAL.rail);
      F.box(2.05, fy + 0.15, -hd - 2.2, 2.2, fy + 1.15, -hd - t / 2, PAL.rail);
    }
    // 지붕
    const ry = floors * fh;
    if (o.flatRoof || floors > 1) {
      F.box(-hw - 0.2, ry - 0.12, -hd - 0.2, hw + 0.2, ry + 0.2, hd + 0.2, roofC);
      F.box(-hw - 0.2, ry + 0.2, -hd - 0.2, hw + 0.2, ry + 0.75, -hd + 0.05, wallC);
      F.box(-hw - 0.2, ry + 0.2, hd - 0.05, hw + 0.2, ry + 0.75, hd + 0.2, wallC);
      F.box(-hw - 0.2, ry + 0.2, -hd + 0.05, -hw + 0.05, ry + 0.75, hd - 0.05, wallC);
      F.box(hw - 0.05, ry + 0.2, -hd + 0.05, hw + 0.2, ry + 0.75, hd - 0.05, wallC);
    } else {
      F.box(-hw - 0.1, ry - 0.12, -hd - 0.1, hw + 0.1, ry + 0.1, hd + 0.1, 0x6f6658);
      F.geo(prism(wd + 0.9, dp + 0.9, 1.9), 0, ry + 0.1, 0, roofC);
    }
  }
  function prism(wd, dp, h) { // 박공 지붕
    const g = new THREE.BufferGeometry(), hw = wd / 2, hd = dp / 2;
    const v = [
      -hw, 0, -hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, hw, h, 0, -hw, h, 0,
      -hw, 0, hd, -hw, h, 0, hw, h, 0, -hw, 0, hd, hw, h, 0, hw, 0, hd,
      -hw, 0, -hd, -hw, h, 0, -hw, 0, hd, hw, 0, -hd, hw, 0, hd, hw, h, 0,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
  }
  // ----- 창고 -----
  function buildWarehouse(F, wd, dp, ht, color, o = {}) {
    const t = 0.3, hw = wd / 2, hd = dp / 2, tier = o.tier || 'mid';
    F.box(-hw - 0.2, -1.6, -hd - 0.2, hw + 0.2, 0.12, hd + 0.2, 0x6e6c66, { nav: true });
    const bigW = o.bigDoor || 4.6;
    F.wallX(-hd, -hw, hw, 0.12, ht, t, [{ a: -bigW / 2, b: bigW / 2, lo: 0, hi: Math.min(ht - 1, 5) }, { a: -hw + 1.2, b: -hw + 3.2, lo: ht - 2.4, hi: ht - 1.2 }, { a: hw - 3.2, b: hw - 1.2, lo: ht - 2.4, hi: ht - 1.2 }], color);
    F.wallX(hd, -hw, hw, 0.12, ht, t, [DOOR(R(-hw + 2, hw - 4)), { a: -1, b: 1, lo: ht - 2.4, hi: ht - 1.2 }], color);
    F.wallZ(-hw, -hd + t / 2, hd - t / 2, 0.12, ht, t, [{ a: -2, b: 0, lo: ht - 2.4, hi: ht - 1.2 }, DOOR(1.4)], color);
    F.wallZ(hw, -hd + t / 2, hd - t / 2, 0.12, ht, t, [{ a: 0, b: 2, lo: ht - 2.4, hi: ht - 1.2 }], color);
    F.box(-hw - 0.4, ht + 0.12, -hd - 0.4, hw + 0.4, ht + 0.5, hd + 0.4, o.roof || 0x4a4f52);
    // 내부: 상자 더미, 선반
    const n = Math.floor(wd * dp / 70);
    for (let i = 0; i < n; i++) {
      const x = R(-hw + 2, hw - 2.5), z = R(-hd + 3.5, hd - 2.5);
      if (Math.abs(x) < bigW / 2 + 0.5 && z < -hd + 5) continue;
      const s = R(1.1, 1.6), stack = RI(1, 2);
      for (let k = 0; k < stack; k++) F.box(x, 0.12 + k * s, z, x + s, 0.12 + (k + 1) * s, z + s, k ? 0x8a6a3f : 0x7a5c35);
      F.loot(x + s + 0.8, 0.14, z + s / 2, tier);
    }
    F.box(-hw + 0.6, 0.12, hd - 1.6, -hw + 0.6 + Math.min(8, wd * 0.4), 2.6, hd - 0.6, 0x5f646a);
    F.loot(0, 0.14, 0, tier); F.loot(-hw + 2, 0.14, hd - 2.6, tier);
  }
  // ----- 고층 건물 (진입 불가, 외관) -----
  function buildTower(F, wd, dp, ht, pal) {
    const hw = wd / 2, hd = dp / 2;
    F.box(-hw, -1.5, -hd, hw, ht, hd, pal[0], { invisible: true });
    F.box(-hw + 0.25, -1.5, -hd + 0.25, hw - 0.25, ht, hd - 0.25, pal[1], { noCollide: true });
    for (let y = 0; y < ht; y += 3.4) F.box(-hw, y, -hd, hw, y + (y === 0 ? 1.2 : 0.75), hd, pal[0], { noCollide: true });
    for (let x = -hw; x <= hw + 0.01; x += wd / Math.max(2, Math.round(wd / 4))) F.box(x - 0.25, 0, -hd - 0.02, x + 0.25, ht, -hd + 0.4, pal[0], { noCollide: true });
    F.box(-hw - 0.2, ht, -hd - 0.2, hw + 0.2, ht + 0.8, hd + 0.2, pal[0], { noCollide: true });
    F.box(-2, ht + 0.8, -2, 2, ht + 3, 2, 0x5a5f63, { noCollide: true });
  }
  function buildContainer(F, lx, lz, ly, color, open, tier) {
    const L = 6.1, Wd = 2.44, H = 2.6;
    if (!open) { F.box(lx, ly, lz, lx + Wd, ly + H, lz + L, color); return; }
    F.box(lx, ly, lz, lx + Wd, ly + 0.15, lz + L, 0x4a4a4a, { nav: false });
    F.box(lx, ly + 0.15, lz, lx + 0.12, ly + H, lz + L, color);
    F.box(lx + Wd - 0.12, ly + 0.15, lz, lx + Wd, ly + H, lz + L, color);
    F.box(lx, ly + 0.15, lz + L - 0.12, lx + Wd, ly + H, lz + L, color);
    F.box(lx, ly + H - 0.12, lz, lx + Wd, ly + H, lz + L - 0.12, color);
    F.loot(lx + Wd / 2, ly + 0.17, lz + L * 0.6, tier);
  }
  function buildCar(F, lx, lz, color, ry = 0) { // 폐차량 (엄폐물)
    const along = Math.abs(Math.sin(ry)) > 0.5; // 90도 회전이면 x축
    const L = 4.3, Wd = 1.85;
    const x0 = along ? lx - L / 2 : lx - Wd / 2, x1 = along ? lx + L / 2 : lx + Wd / 2;
    const z0 = along ? lz - Wd / 2 : lz - L / 2, z1 = along ? lz + Wd / 2 : lz + L / 2;
    F.box(x0, 0.35, z0, x1, 1.1, z1, color);
    const cx0 = along ? lx - 1.1 : x0 + 0.12, cx1 = along ? lx + 0.9 : x1 - 0.12, cz0 = along ? z0 + 0.12 : lz - 1.1, cz1 = along ? z1 - 0.12 : lz + 0.9;
    F.box(cx0, 1.1, cz0, cx1, 1.7, cz1, 0x2d3438);
    const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 10); wheel.rotateZ(Math.PI / 2);
    for (const s of [-1, 1]) for (const e of [-1, 1]) {
      if (along) F.geo(wheel.clone().rotateY(Math.PI / 2), lx + e * 1.35, 0.36, lz + s * 0.85, 0x1d1d1d);
      else F.geo(wheel, lx + s * 0.85, 0.36, lz + e * 1.35, 0x1d1d1d);
    }
  }
  function placeLot(cx, cz, rot, wd, dp, kind, maxSlope = 1.2, margin = 1.5, roadM = 1.5) {
    const r = worldRect(cx, cz, rot, wd + 3, dp + 3);
    if (Math.abs(r[0]) > HALF - 20 || Math.abs(r[2]) > HALF - 20 || Math.abs(r[1]) > HALF - 20 || Math.abs(r[3]) > HALF - 20) return null;
    if (!footprintFree(r[0], r[1], r[2], r[3], margin)) return null;
    if (!roadClear(r, roadM)) return null;
    const [mx, mn] = baseHeight(r);
    if (mx - mn > maxSlope || mn < 1.4) return null;
    if (riverDist(cx, cz) < river.w + 10 + Math.max(wd, dp) / 2) return null;
    claim(r[0], r[1], r[2], r[3]);
    flattenRect(r, mx);
    const F = frame(cx, cz, rot, mx);
    const bld = { x: cx, z: cz, rect: r, kind, y: mx, door: F.pt(0, -(dp / 2) - 2.2), visits: 0 };
    w.buildings.push(bld); F.bld = bld;
    return F;
  }

  // ----- 훈련장 구조물 -----
  // 좌표: 북쪽 = -z. 무기고(남쪽, z≈161)에서 시작 → 사격선(z=120)에서 북쪽으로 쏜다
  function buildTraining() {
    const T = w.training = { spawn: { x: 0, z: 153.4, yaw: 0 }, spots: [], dummies: [], park: [], signs: [] };
    w.mapRects = [];
    const gy = (x, z) => heightAt(x, z), PAD = 0x6f6c66, TABLE = 0x6b5640, POST = 0x4b4f52, ROOF = 0xa9aca4;
    const sign = (x, y, z, ry, title, sub, wd = 3.2, ht = 1.1) => T.signs.push({ x, y, z, ry, title, sub, w: wd, h: ht });
    const poi = (name, x, z) => w.pois.push({ type: 'train', name, x, z, r: 20, h: gy(x, z) });
    // 1) 무기고: 지붕 덮인 콘크리트 바닥 + 탁자 3줄 (총기 / 부착물·탄약 / 회복·투척·방어구)
    {
      const cx = 0, cz = 161, y = gy(cx, cz), F = frame(cx, cz, 0, y);
      F.box(-26, -1.2, -9, 26, 0.12, 9, PAD, { nav: true });
      for (const x of [-26, -19.5, 19.5, 26]) for (const z of [-9, 9]) F.box(x - 0.18, 0.12, z - 0.18, x + 0.18, 3.6, z + 0.18, POST); // 가운데 기둥 없음(시작 시점 카메라를 가리지 않게)
      F.box(-26.6, 3.6, -9.6, 26.6, 3.85, 9.6, ROOF);
      F.box(-26, 0.12, 8.7, 26, 1.2, 9, 0x5a5f55); // 뒤쪽 낮은 벽
      const rows = [
        { lz: -5, ids: Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'weapon'), title: '총기', sub: '탄창 가득 · 가져가면 잠시 뒤 다시 놓임' },
        { lz: 0, ids: ['reddot', 'holo', 'x2', 'x3', 'x4', 'x6', 'comp', 'extmag', 'grip', 'a556', 'a762', 'a9', 'a12', 'a300'], title: '부착물 · 탄약', sub: '훈련장에서는 쏜 만큼 탄약이 자동으로 채워짐' },
        { lz: 5, ids: ['bandage', 'firstaid', 'medkit', 'drink', 'frag', 'smoke', 'helm1', 'helm2', 'helm3', 'vest1', 'vest2', 'vest3', 'bag1', 'bag2', 'bag3'], title: '회복 · 투척 · 방어구', sub: '수류탄은 북쪽 벽 너머 더미에게 연습' },
      ];
      for (const R0 of rows) {
        const n = R0.ids.length, gap = 3.0, x0 = -(n - 1) * gap / 2;
        F.box(x0 - 1.1, 0.12, R0.lz - 0.5, -x0 + 1.1, 0.86, R0.lz + 0.5, TABLE);
        R0.ids.forEach((id, i) => { const d = ITEMS[id]; T.spots.push({ id, count: d.type === 'ammo' ? d.stack : ({ bandage: 5, firstaid: 3, medkit: 1, drink: 3, frag: 3, smoke: 3 }[id] || 1), x: cx + x0 + i * gap, y: y + 0.87, z: cz + R0.lz }); });
        sign(cx, y + 2.7, cz + R0.lz - 0.55, Math.PI, R0.title, R0.sub, 4.2, 1.15);
      }
      sign(cx, y + 3.15, cz - 9.75, Math.PI, '무기고', '총을 고른 뒤 북쪽 사격선으로', 5, 1.2);
      sign(cx, y + 3.15, cz - 9.45, 0, '사격선 ↑ 북쪽 30m', '차량 ← 서쪽 · 장애물 코스 → 동쪽', 5, 1.2);
      w.mapRects.push([-26, 152, 26, 170]); poi('무기고', 0, 161);
    }
    // 2) 사격선 + 근거리 방어구 더미 (15m) + 방탄 벽 + 벽 너머 투척 연습 더미
    {
      const y = gy(0, 120);
      addBox(-80, y - 0.2, 119.82, 66, y + 0.03, 120.18, 0xd9b44a, { noCollide: true });
      sign(-60, y + 1.7, 121, 0, '사격선', '여기서 북쪽(-) 방향으로', 3, 1);
      const L = [['방어구 없음', '헬멧·조끼 미착용', 0], ['Lv1 헬멧·조끼', '감소 30%', 1], ['Lv2 헬멧·조끼', '감소 40%', 2], ['Lv3 헬멧·조끼', '감소 55%', 3]];
      L.forEach(([t, s, lvl], i) => {
        const x = -15 + i * 10, z = 105, yy = gy(x, z);
        addBox(x - 0.7, yy - 0.3, z - 0.7, x + 0.7, yy + 0.06, z + 0.7, 0x55524c, { nav: true });
        T.dummies.push({ x, z, lvl, yaw: 0, label: t });
        addBox(x + 2.3, yy, z - 0.06, x + 2.42, yy + 1.5, z + 0.06, POST);
        sign(x + 2.36, yy + 1.85, z + 0.1, 0, t, s + ' · 15m', 2.4, 0.78);
      });
      const by = gy(0, 96); addBox(-22, by - 0.5, 95.6, 22, by + 3.5, 96.4, 0x8a8a82); w.mapRects.push([-22, 95.6, 22, 96.4]);
      sign(0, by + 4.3, 96.6, 0, '투척 연습', '벽 너머 40m에 더미 2개 — 수류탄을 넘겨 보세요', 5.2, 1.1);
      for (const x of [-7, 7]) T.dummies.push({ x, z: 80, lvl: 2, yaw: 0, label: '투척 연습 (Lv2)' });
      poi('근거리 사격장', 0, 105);
    }
    // 3) 장거리 사격장: 50~300m, 50m 간격 (배율 조준경 연습)
    {
      // 앞 표적이 뒤 표적을 가리지 않도록 좌우로 엇갈리게 (x 30~60)
      [50, 100, 150, 200, 250, 300].forEach((D, k) => {
        const x = 30 + k * 6, z = 120 - D, yy = gy(x, z);
        addBox(x - 0.7, yy - 0.3, z - 0.7, x + 0.7, yy + 0.06, z + 0.7, 0x55524c, { nav: true });
        T.dummies.push({ x, z, lvl: 0, yaw: 0, label: '장거리 표적' });
        addBox(x + 2.6, yy, z - 0.1, x + 2.85, yy + 3.6, z + 0.1, POST);
        sign(x + 2.72, yy + 3.6 + 0.8 * D / 100, z + 0.15, 0, `${D}m`, '', 2.4 + D / 100, 1.05 + D / 300);
      });
      poi('장거리 사격장', 42, -40);
    }
    // 4) 이동 표적: 25m 걷기 · 50m 달리기 · 80m 달리기 (좌우 왕복)
    {
      [[25, 3.0, 7, '걷는 표적'], [50, 6.3, 9, '달리는 표적'], [80, 6.3, 10, '달리는 표적']].forEach(([D, sp, rg, t]) => {
        const z = 120 - D, x = -55;
        T.dummies.push({ x, z, lvl: 0, yaw: 0, label: `${t} ${D}m`, move: { range: rg, speed: sp } });
        sign(x, gy(x, z) + 3.4, z - 2, 0, `${t} ${D}m`, `${sp < 4 ? '걷기' : '달리기'} 속도로 좌우 왕복`, 3.6, 0.95);
      });
      poi('이동 표적', -55, 70);
    }
    // 5) 차량: 모든 종류 (파괴되거나 오래 방치되면 제자리에 다시 생김)
    {
      [['uaz', -90], ['pickup', -83], ['sedan', -76], ['moto', -69.5], ['moto', -65], ['horse', -59]].forEach(([type, x]) => T.park.push({ type, x, z: 160, yaw: Math.PI }));
      const y = gy(-74, 172); sign(-74, y + 2.6, 171, Math.PI, '차량', '말·오토바이·세단·픽업·UAZ — 외곽 순환 트랙과 서쪽 언덕', 5, 1.1);
      addBox(-96, y, 171.6, -52, y + 0.9, 172.0, 0x5a5f55);
      poi('차량', -74, 160); poi('오프로드 언덕', -140, -60); poi('순환 트랙', 205, 0);
    }
    // 6) 장애물 코스: 담 넘기 → 모래주머니 → 창문 → 상자 오르기(2단) → 컨테이너 → 폐차 → 2층 집
    {
      const C = 0x8f8a7e, SAND = PAL.sand, CR = 0x7a5c35;
      const yb = (x, z) => gy(x, z);
      addBox(88.9, yb(89, 166), 165.9, 89.1, yb(89, 166) + 1.6, 166.1, POST);
      sign(89, yb(89, 166) + 2.05, 166.12, 0, '장애물 코스', '점프 버튼: 넘기(≤1.4m) · 오르기(≤2m)', 3.4, 0.9);
      let y = yb(95, 156); addBox(92.5, y - 0.3, 155.85, 97.5, y + 1.0, 156.15, C);              // 1m 담
      y = yb(95, 147); addBox(92.5, y - 0.3, 146.6, 97.5, y + 0.95, 147.4, SAND);               // 모래주머니
      { const F = frame(95, 137, 0, yb(95, 137)); F.wallX(0, -7, 7, 0, 3.2, 0.24, [WIN(-0.7)], C); w.mapRects.push([88, 136.8, 102, 137.2]); } // 창문
      y = yb(95, 124); addBox(93.8, y - 0.3, 122.8, 96.2, y + 1.6, 125.2, CR); addBox(93.8, y + 1.6, 122.8, 96.2, y + 2.8, 123.9, 0x8a6a3f); // 상자 2단
      y = yb(112, 124); addBox(110.8, y - 0.3, 125.3, 113.2, y + 1.3, 127.2, CR); buildContainer(frame(110.78, 119.2, 0, y), 0, 0, 0, PAL.container[1], false); // 상자 → 컨테이너
      { const F = frame(128, 150, 0, yb(128, 150)); buildCar(F, 0, 0, 0x2a4a7b, Math.PI / 2); }      // 폐차
      for (const [x, z] of [[120, 112], [128, 104], [136, 112]]) { const yy = yb(x, z); addBox(x - 2, yy - 0.3, z - 0.15, x + 2, yy + 1.2, z + 0.15, C); } // 낮은 벽
      const F = placeLot(145, 80, 0, 10, 9, 'house', 3, 0.5, 0.5);
      if (F) buildHouse(F, 10, 9, 2, PAL.house[0], { balcony: true, tier: 'low' });
      w.mapRects.push([92, 118, 115, 128]); poi('장애물 코스', 112, 125);
    }
  }

  // ----- 데스매치 아레나: 72×72m 컨테이너 야드 -----
  // 남쪽(z+) = 0팀 출발 구역, 북쪽(z-) = 1팀. 원점 기준 180° 회전 대칭(어느 팀도 유리하지 않게)
  // 가운데 2층 전망대(경사로 2개) · 양쪽 창고 · 컨테이너 · 낮은 벽(넘기 가능) · 출발 구역 앞 가림벽
  function buildArena() {
    const G0 = heightAt(0, 0);
    const A = w.arena = { half: 36, spawns: [[], []], G0 };
    w.mapRects = [];
    const WALL = 0x8b8a84, TRIM = 0x5d5f5a, BAR = 0x6f7369, DECK = 0x6e6c66, STEP = 0x7d7a72, CRATE = 0x7a5c35, CRATE2 = 0x8a6a3f, SANDC = PAL.sand;
    const TEAMC = [0x6f7a84, 0x86716c];   // 출발 구역 바닥: 옅은 파랑 / 옅은 빨강 콘크리트
    // 반쪽을 짓고 180° 돌려 한 번 더 짓는다 (F.box/F.pt가 회전을 처리)
    const halves = [frame(0, 0, 0, G0), frame(0, 0, 2, G0)];
    // x축 방향 경사로(계단): 로컬 x 구간 [lx0,lx1], 로컬 z 구간, dirL=+1이면 +x로 올라감. 아래는 단단한 받침(옆에서 못 지나감)
    const xRamp = (F, lx0, lx1, lz0, lz1, h, dirL) => {
      const a = F.pt(lx0, lz0), b = F.pt(lx1, lz1), dirW = F.rot === 2 ? -dirL : dirL;
      addRamp(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), G0, G0 + h, 'x', dirW);
      const n = Math.max(6, Math.round(h / 0.28)), L = lx1 - lx0;
      for (let k = 0; k < n; k++) { // 계단 모양(보이기만) + 받침(충돌)
        const t0 = k / n, t1 = (k + 1) / n, y = h * (dirL > 0 ? t1 : 1 - t0);
        const xa = lx0 + L * t0, xb = lx0 + L * t1;
        F.box(xa, -0.05, lz0, xb, y, lz1, STEP, { noCollide: true });
        const yb = h * (dirL > 0 ? t0 : 1 - t1) - 0.08;
        if (yb > 0.3) F.box(xa, -0.5, lz0, xb, yb, lz1, STEP, { invisible: true });
      }
    };
    halves.forEach((F, side) => {
      // 1) 외곽 담 (높이 5m) — 남쪽 담 + 동·서 담의 남쪽 절반
      F.box(-37.2, -1, 36, 37.2, 5, 37.2, WALL); F.box(-37.2, 5, 36, 37.2, 5.3, 37.2, TRIM);
      F.box(-37.2, -1, 0, -36, 5, 36, WALL); F.box(-37.2, 5, 0, -36, 5.3, 36, TRIM);
      F.box(36, -1, 0, 37.2, 5, 36, WALL); F.box(36, 5, 0, 37.2, 5.3, 36, TRIM);
      // 2) 출발 구역: 바닥 색 + 가림벽(높이 2.4m, 넘을 수 없음, 틈 3곳) + 틈 뒤 차단벽
      F.box(-36, -0.2, 25.4, 36, 0.03, 36, TEAMC[side], { noCollide: true });
      for (const [a, b] of [[-36, -23], [-17, -4.5], [4.5, 17], [23, 36]]) { F.box(a, -0.5, 24.75, b, 2.4, 25.25, BAR); F.box(a, 2.4, 24.7, b, 2.55, 25.3, TRIM); }
      F.box(-3.2, -0.5, 28.2, 3.2, 2.4, 28.7, BAR); F.box(-21.8, -0.5, 28.2, -18.2, 2.4, 28.7, BAR); F.box(18.2, -0.5, 28.2, 21.8, 2.4, 28.7, BAR);
      // 3) 가운데 전망대 (반쪽): 바닥판 3.2m, 기둥, 난간(1.1m 엄폐), 아래층 낮은 벽, 동쪽 경사로
      F.box(-7, 3.2, 0, 7, 3.45, 5, DECK);
      for (const x of [-6.6, 6.6]) F.box(x - 0.35, -0.3, 4.25, x + 0.35, 3.2, 4.95, TRIM);
      F.box(-0.35, -0.3, 0.3, 0.35, 3.2, 1.0, TRIM);
      F.box(-7, 3.45, 4.7, -1.8, 4.55, 5, BAR); F.box(1.8, 3.45, 4.7, 7, 4.55, 5, BAR);   // 남쪽 난간 (가운데 틈)
      F.box(-7, 3.45, 0, -6.7, 4.55, 5, BAR);                                             // 서쪽 난간
      F.box(6.7, 3.45, 0, 7, 4.55, 1.2, BAR); F.box(6.7, 3.45, 4.2, 7, 4.55, 5, BAR);     // 동쪽 난간 (경사로 입구)
      F.box(-3, -0.3, 2.2, 3, 1.05, 2.6, SANDC);                                          // 아래층 엄폐(넘기 가능)
      xRamp(F, 7, 15, 1.2, 4.2, 3.45, -1);
      F.box(7, -0.3, 0.9, 15, 0.9, 1.2, TRIM, { noCollide: true }); F.box(7, -0.3, 4.2, 15, 0.9, 4.5, TRIM, { noCollide: true });
      // 4) 서쪽 창고 (8×7m, 문은 동쪽, 창문은 남·북) — 반대편은 북동쪽
      {
        const H = 3.3, c = 0x9a8f7e, t = 0.25;
        F.box(-34, -0.3, 8, -26, 0.1, 15, 0x77736a, { nav: true });
        F.wallX(8, -34, -26, 0.1, H, t, [WIN(-31.5, 1.6)], c);
        F.wallX(15, -34, -26, 0.1, H, t, [WIN(-31.5, 1.6)], c);
        F.wallZ(-34, 8 + t / 2, 15 - t / 2, 0.1, H, t, [], c);
        F.wallZ(-26, 8 + t / 2, 15 - t / 2, 0.1, H, t, [DOOR(10.6)], c);
        F.box(-34.2, H + 0.1, 7.8, -25.8, H + 0.35, 15.2, 0x4a4f52);
        F.box(-33.6, 0.1, 13.2, -31.4, 1.0, 14.6, CRATE);                                 // 안쪽 상자
        const p = F.pt(-30, 11.5); w.mapRects.push([Math.min(p[0] - 4, p[0] + 4), Math.min(p[1] - 3.5, p[1] + 3.5), Math.max(p[0] - 4, p[0] + 4), Math.max(p[1] - 3.5, p[1] + 3.5)]);
      }
      // 5) 컨테이너: 서쪽 가운데(단층), 동쪽(2단 쌓기), 동쪽 가운데(옆으로 누운 통과형)
      const CN = PAL.container;
      F.box(-17, -0.3, 3, -14.56, 2.6, 9.1, CN[side ? 3 : 0]);
      F.box(28, -0.3, 3, 30.44, 2.6, 9.1, CN[1]); F.box(28, 2.6, 3.2, 30.44, 5.2, 9.3, CN[side ? 0 : 2]);
      F.box(10, -0.3, 9, 16.1, 0.12, 11.44, 0x4a4a4a, { noCollide: true });
      F.box(10, 0.12, 9, 16.1, 2.6, 9.12, CN[4]); F.box(10, 0.12, 11.32, 16.1, 2.6, 11.44, CN[4]); F.box(10, 2.48, 9, 16.1, 2.6, 11.44, CN[4]);
      for (const r of [[-17, 3, -14.56, 9.1], [28, 3, 30.44, 9.3], [10, 9, 16.1, 11.44]]) { const a = F.pt(r[0], r[1]), b = F.pt(r[2], r[3]); w.mapRects.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]); }
      // 6) 낮은 벽(1m, 넘기 가능) · 모래주머니 · 상자 더미
      F.box(-18, -0.3, 19.5, -10, 1.0, 19.9, TRIM); F.box(22, -0.3, 17, 30, 1.0, 17.4, TRIM);
      F.box(-3, -0.3, 14, 3, 0.9, 14.8, SANDC); F.box(-12, -0.3, 11.6, -7.5, 0.9, 12.4, SANDC);
      const crate = (x, z, n) => { for (let k = 0; k < n; k++) F.box(x - 0.65, -0.3 + (k ? 0.3 : 0) + k * 1.3, z - 0.65, x + 0.65, 1.3 * (k + 1), z + 0.65, k ? CRATE2 : CRATE); };
      crate(-30, 20, 2); crate(-28.7, 20, 1); crate(-24, 18.5, 1); crate(-12, 16, 2); crate(-10.7, 16.3, 1);
      crate(12, 18, 1); crate(13.3, 18, 2); crate(24, 12, 1); crate(20, 4, 2); crate(-22, 2, 1); crate(5, 9, 1);
      // 7) 출발 지점 (북쪽을 바라봄; 반대편은 남쪽)
      for (const z of [30.5, 33.5]) for (const x of [-31, -26, -14, -9, 9, 14, 26, 31]) { const q = F.pt(x, z); A.spawns[side].push({ x: q[0], z: q[1], yaw: side ? 0 : Math.PI }); }
    });
    // 전체 지도: 외곽 담·가림벽 표시
    for (const s of [1, -1]) { w.mapRects.push([-37.2, s > 0 ? 36 : -37.2, 37.2, s > 0 ? 37.2 : -36]); w.mapRects.push([s > 0 ? 36 : -37.2, -37.2, s > 0 ? 37.2 : -36, 37.2]); for (const [a, b] of [[-36, -23], [-17, -4.5], [4.5, 17], [23, 36]]) w.mapRects.push([s > 0 ? a : -b, s > 0 ? 24.75 : -25.25, s > 0 ? b : -a, s > 0 ? 25.25 : -24.75]); }
    w.mapRects.push([-7, -5, 7, 5]);
    w.pois.push({ type: 'arena', name: '전망대', x: 0, z: 0, r: 8, h: G0 }, { type: 'arena', name: '블루 출발', x: 0, z: 31, r: 6, h: G0 }, { type: 'arena', name: '레드 출발', x: 0, z: -31, r: 6, h: G0 });
  }
  if (TR) buildTraining();
  if (AR) buildArena();

  await yieldUI(0.4, '건물 배치');
  // ----- POI 별 구조물 -----
  for (const p of w.pois) {
    if (p.type === 'city') {
      const { cell, n, o } = p.grid;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const bx = p.x + o + a * cell + cell / 2, bz = p.z + o + b * cell + cell / 2;
        // 블록 하나에 건물 2~4채
        const slots = [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]];
        const central = Math.abs(a - 1.5) < 1 && Math.abs(b - 1.5) < 1;
        for (const [ox, oz] of slots) {
          if (rng() < 0.18) { // 주차 공간
            const F = placeLot(bx + ox, bz + oz, 0, 10, 10, 'park', 3, 1, 0.5); if (F) { F.box(-5, -0.2, -5, 5, 0.04, 5, 0x3a3c3e, { noCollide: true }); for (let c = 0; c < RI(1, 3); c++) buildCar(F, R(-3, 3), R(-2.5, 2.5), RP([0x7b2a2a, 0x2a4a7b, 0x8a8a8a, 0x3a3a3a, 0x6a7a3a]), RP([0, Math.PI / 2])); w.parking.push(F.pt(0, 0)); }
            continue;
          }
          const rot = RI(0, 3);
          if (central && rng() < 0.55) {
            const F = placeLot(bx + ox, bz + oz, rot, 12, 12, 'tower', 3, 1, 0.5); if (F) buildTower(F, R(10, 13), R(10, 13), R(16, 38), RP(PAL.city));
          } else {
            const wd = R(9, 12), dp = R(8, 11), F = placeLot(bx + ox, bz + oz, rot, wd, dp, 'house', 3, 1, 0.5);
            if (F) buildHouse(F, wd, dp, rng() < 0.65 ? 2 : 1, RP(PAL.city), { flatRoof: true, balcony: rng() < 0.4, tier: p.tier });
          }
        }
      }
      for (let c = 0; c < 10; c++) { // 길가 폐차
        const r = RP(w.roads.filter(r => r.kind === 'street')), t = R(0.1, 0.9);
        const x = r.ax + (r.bx - r.ax) * t + (Math.abs(r.dx) > 0.5 ? 0 : 2.6), z = r.az + (r.bz - r.az) * t + (Math.abs(r.dx) > 0.5 ? 2.6 : 0);
        const F = frame(x, z, 0, heightAt(x, z)); buildCar(F, 0, 0, RP([0x7b2a2a, 0x2a4a7b, 0x8a8a8a, 0x5a4a3a]), Math.abs(r.dx) > 0.5 ? Math.PI / 2 : 0);
      }
    } else if (p.type === 'military') {
      const fr = p.r - 6, fy = p.h;
      const F0 = frame(p.x, p.z, 0, fy);
      const gate = 9;
      for (const s of [-1, 1]) { // 철조망 울타리 (총알 통과, 이동 차단)
        F0.box(-fr, 0, s * fr - 0.08, -gate / 2, 2.6, s * fr + 0.08, 0x8a8f8a, { soft: true, mat: 'fence' });
        F0.box(gate / 2, 0, s * fr - 0.08, fr, 2.6, s * fr + 0.08, 0x8a8f8a, { soft: true, mat: 'fence' });
        F0.box(s * fr - 0.08, 0, -fr, s * fr + 0.08, 2.6, -gate / 2, 0x8a8f8a, { soft: true, mat: 'fence' });
        F0.box(s * fr - 0.08, 0, gate / 2, s * fr + 0.08, 2.6, fr, 0x8a8f8a, { soft: true, mat: 'fence' });
      }
      let F = placeLot(p.x + R(-12, 12), p.z + R(-12, 12), RI(0, 3), 28, 18, 'hangar', 3); if (F) buildWarehouse(F, 26, 18, 8.5, 0x6a7060, { bigDoor: 10, tier: 'top', roof: 0x3e4438 });
      for (let i = 0; i < 4; i++) { const wd = R(13, 17); F = placeLot(p.x + R(-fr + 12, fr - 12), p.z + R(-fr + 12, fr - 12), RI(0, 3), wd, 7, 'barracks', 3); if (F) buildHouse(F, wd, 7, 1, RP(PAL.military), { flatRoof: true, tier: 'top' }); }
      for (let i = 0; i < 4; i++) { // 벙커
        F = placeLot(p.x + R(-fr + 8, fr - 8), p.z + R(-fr + 8, fr - 8), RI(0, 3), 8, 6, 'bunker', 3);
        if (F) { const c = 0x8a8a82; F.box(-4.2, -1, -3.2, 4.2, 0.1, 3.2, c, { nav: true }); F.wallX(-3, -4, 4, 0.1, 2.6, 0.5, [DOOR(-0.9)], c); F.wallX(3, -4, 4, 0.1, 2.6, 0.5, [{ a: -2, b: 2, lo: 1.3, hi: 1.8 }], c); F.wallZ(-4, -2.75, 2.75, 0.1, 2.6, 0.5, [{ a: -1, b: 1, lo: 1.3, hi: 1.8 }], c); F.wallZ(4, -2.75, 2.75, 0.1, 2.6, 0.5, [], c); F.box(-4.3, 2.7, -3.3, 4.3, 3.1, 3.3, c); F.loot(-1.5, 0.12, 0.8, 'top'); F.loot(1.8, 0.12, 0.8, 'top'); }
      }
      for (const [cx, cz] of [[-fr + 4, -fr + 4], [fr - 4, fr - 4], [fr - 4, -fr + 4], [-fr + 4, fr - 4]]) { // 감시탑
        const x = p.x + cx, z = p.z + cz; claim(x - 3, z - 5, x + 3, z + 3);
        const T = frame(x, z, 0, heightAt(x, z)), c = 0x6a5a45, H = 6;
        for (const [a, b] of [[-1.5, -1.5], [1.3, -1.5], [-1.5, 1.3], [1.3, 1.3]]) T.box(a, 0, b, a + 0.2, H, b + 0.2, c);
        T.box(-1.7, H, -1.7, 1.7, H + 0.2, 1.7, c, { nav: false });
        T.box(-1.7, H + 0.2, 1.55, 1.7, H + 1.2, 1.7, c); T.box(-1.7, H + 0.2, -1.7, -1.55, H + 1.2, 1.7, c); T.box(1.55, H + 0.2, -1.7, 1.7, H + 1.2, 1.7, c);
        T.box(-1.7, H + 0.2, -1.7, -0.5, H + 1.2, -1.55, c); T.box(0.5, H + 0.2, -1.7, 1.7, H + 1.2, -1.55, c);
        T.box(-1.7, H + 2.6, -1.7, 1.7, H + 2.8, 1.7, 0x4a4036, { noCollide: true });
        T.ramp(-0.45, -5.6, 0.45, -1.7, 0, H + 0.2, 'z');
        for (let k = 0; k < 14; k++) T.box(-0.5, (H / 14) * k, -5.6 + 3.9 * k / 14, 0.5, (H / 14) * k + 0.08, -5.6 + 3.9 * k / 14 + 0.12, 0x3a3a3a, { noCollide: true });
        T.loot(0, H + 0.22, 0.6, 'top');
      }
      for (let i = 0; i < 10; i++) { // 모래주머니
        const x = p.x + R(-fr + 4, fr - 4), z = p.z + R(-fr + 4, fr - 4), ax = rng() < 0.5, L = R(3, 6);
        if (!footprintFree(x - L / 2, z - L / 2, x + L / 2, z + L / 2, 1)) continue;
        const F2 = frame(x, z, 0, heightAt(x, z)); ax ? F2.box(-L / 2, -0.3, -0.4, L / 2, 0.95, 0.4, PAL.sand) : F2.box(-0.4, -0.3, -L / 2, 0.4, 0.95, L / 2, PAL.sand);
      }
    } else if (p.type === 'industrial' || p.type === 'depot') {
      const nW = p.type === 'industrial' ? 3 : 3;
      for (let i = 0; i < nW; i++) { const wd = R(18, 26), dp = R(12, 16); const F = placeLot(p.x + R(-p.r + 15, p.r - 15), p.z + R(-p.r + 15, p.r - 15), RI(0, 3), wd, dp, 'warehouse', 3); if (F) buildWarehouse(F, wd, dp, R(6, 8), RP(PAL.metal), { tier: p.tier }); }
      for (let i = 0; i < 5; i++) { // 컨테이너 더미
        const F = placeLot(p.x + R(-p.r + 8, p.r - 8), p.z + R(-p.r + 8, p.r - 8), RI(0, 3), 8, 7, 'containers', 3);
        if (!F) continue;
        for (let c = 0; c < 3; c++) { buildContainer(F, -3.8 + c * 2.6, -3.05, 0, RP(PAL.container), c === 1 && rng() < 0.7, p.tier); if (rng() < 0.5) buildContainer(F, -3.8 + c * 2.6, -3.05, 2.6, RP(PAL.container), false); }
      }
      if (p.type === 'industrial') for (let i = 0; i < 4; i++) { // 사일로
        const x = p.x + R(-p.r + 6, p.r - 6), z = p.z + R(-p.r + 6, p.r - 6);
        if (!footprintFree(x - 3, z - 3, x + 3, z + 3, 1) || !roadClear([x - 3, z - 3, x + 3, z + 3], 1)) continue;
        claim(x - 3, z - 3, x + 3, z + 3);
        const F = frame(x, z, 0, heightAt(x, z)), h = R(9, 14);
        F.geo(new THREE.CylinderGeometry(2.6, 2.6, h, 16), 0, h / 2 - 0.5, 0, 0x9aa0a4);
        F.geo(new THREE.ConeGeometry(2.7, 1.6, 16), 0, h + 0.3, 0, 0x7a8084);
        F.box(-1.85, -0.5, -1.85, 1.85, h, 1.85, 0, { invisible: true });
      }
    } else if (p.type === 'farm') {
      let F = placeLot(p.x + R(-8, 8), p.z + R(-8, 8), RI(0, 3), 18, 13, 'barn', 3);
      if (F) { buildWarehouse(F, 16, 12, 5.5, RP(PAL.barn), { tier: 'low', roof: 0x4a3a33 }); F.geo(prism(17, 13, 3), 0, 6.1, 0, 0x4a3a33); }
      for (let i = 0; i < 3; i++) { const wd = R(8, 10), dp = R(7, 9); F = placeLot(p.x + R(-p.r + 10, p.r - 10), p.z + R(-p.r + 10, p.r - 10), RI(0, 3), wd, dp, 'house', 1.5); if (F) buildHouse(F, wd, dp, rng() < 0.5 ? 2 : 1, RP(PAL.house), { balcony: rng() < 0.5, tier: 'low' }); }
      for (let i = 0; i < 18; i++) { // 건초더미
        const x = p.x + R(-p.r - 30, p.r + 30), z = p.z + R(-p.r - 30, p.r + 30);
        if (!footprintFree(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0.5) || w.roadDist(x, z) < 6 || riverDist(x, z) < 16) continue;
        claim(x - 1, z - 1, x + 1, z + 1);
        const T = frame(x, z, 0, heightAt(x, z)), g = new THREE.CylinderGeometry(0.85, 0.85, 1.3, 12); g.rotateZ(Math.PI / 2);
        T.geo(g, 0, 0.8, 0, 0xc9a85a, rng() * 3); T.box(-0.7, 0, -0.7, 0.7, 1.55, 0.7, 0, { invisible: true });
      }
    } else if (p.type === 'village') {
      const n = RI(6, 9);
      for (let i = 0, tries = 0; i < n && tries < 80; tries++) {
        const a = R(0, TAU), d = R(8, p.r - 6), wd = R(7, 11), dp = R(6.5, 9.5);
        const F = placeLot(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, RI(0, 3), wd, dp, 'house', 1.5);
        if (!F) continue; i++;
        buildHouse(F, wd, dp, rng() < 0.45 ? 2 : 1, RP(PAL.house), { balcony: rng() < 0.5, tier: 'low' });
      }
      for (let i = 0; i < 3; i++) { const F = placeLot(p.x + R(-p.r, p.r), p.z + R(-p.r, p.r), RI(0, 3), 4, 3.5, 'shed', 1.2); if (F) { const c = 0x7a6248; F.box(-2.1, -1, -1.85, 2.1, 0.1, 1.85, PAL.found, { nav: true }); F.wallX(-1.75, -2, 2, 0.1, 2.5, 0.15, [DOOR(-0.9)], c); F.wallX(1.75, -2, 2, 0.1, 2.5, 0.15, [], c); F.wallZ(-2, -1.68, 1.68, 0.1, 2.5, 0.15, [], c); F.wallZ(2, -1.68, 1.68, 0.1, 2.5, 0.15, [WIN(-0.6, 1.2)], c); F.box(-2.3, 2.6, -2.1, 2.3, 2.8, 2.1, 0x4a4036); F.loot(0, 0.12, 0.6, 'low'); } }
    }
  }
  // ----- 외딴 집/오두막 -----
  for (let i = 0, tries = 0; !FLAT && i < (big ? 240 : 26) && tries < (big ? 9000 : 900); tries++) {
    const x = R(-HALF * 0.78, HALF * 0.78), z = R(-HALF * 0.78, HALF * 0.78);
    if (poisNear(x, z).some(p => Math.hypot(p.x - x, p.z - z) < p.r + 25)) continue;
    const wd = R(6.5, 9), dp = R(6, 8.5), F = placeLot(x, z, RI(0, 3), wd, dp, 'house', 1.0, 3, 2);
    if (!F) continue; i++;
    buildHouse(F, wd, dp, rng() < 0.3 ? 2 : 1, RP(PAL.house), { balcony: rng() < 0.4, tier: 'low' });
  }
  // ----- 다리 -----
  for (const r of w.roads) {
    let first = -1, last = -1;
    for (let s = 0; s <= r.len; s += 1) { const x = r.ax + r.dx * s, z = r.az + r.dz * s; if (riverDist(x, z) < river.w + 7) { if (first < 0) first = s; last = s; } }
    if (first < 0) continue;
    first = Math.max(0, first - 3); last = Math.min(r.len, last + 3);
    const at = (s) => { const f = s / r.len * r.n, i = Math.floor(f); return lerp(r.prof[i], r.prof[Math.min(r.n, i + 1)], f - i); };
    const y = Math.max(at(first), at(last)) + 0.05;
    const cx = r.ax + r.dx * (first + last) / 2, cz = r.az + r.dz * (first + last) / 2, L = last - first;
    const alongX = Math.abs(r.dx) > Math.abs(r.dz);
    // 다리 데크는 도로 방향 축에 정렬 (사선 도로는 근사)
    const rot = alongX ? 1 : 0;
    const slope = Math.min(Math.abs(r.dx), Math.abs(r.dz)) / Math.max(Math.abs(r.dx), Math.abs(r.dz));
    const F = frame(cx, cz, rot, y), hw = 4 + slope * L / 2;
    F.box(-hw, -0.6, -L / 2, hw, 0.05, L / 2, 0x5d5b57, { nav: true });
    F.box(-hw, 0.05, -L / 2, -hw + 0.3, 1.0, L / 2, 0x77746e); F.box(hw - 0.3, 0.05, -L / 2, hw, 1.0, L / 2, 0x77746e);
    for (let s = -L / 2 + 3; s < L / 2 - 2; s += 8) F.box(-0.8, -8, s, 0.8, -0.6, s + 1.4, 0x6a6862, { noCollide: true });
    w.bridges.push({ cx, cz, L, y, rot, hw });
    // 진입로: 데크보다 낮은 쪽 도로를 16m에 걸쳐 데크 높이까지 완만하게 돋운다 (차량이 턱에 막히지 않게)
    const ramp = (s0, s1) => {
      const x0 = r.ax + r.dx * s0, z0 = r.az + r.dz * s0, x1 = r.ax + r.dx * s1, z1 = r.az + r.dz * s1, m = r.width / 2 + 4;
      const i0 = clamp(Math.floor((Math.min(x0, x1) - m + HALF) / HF_RES), 0, HF_N - 1), i1 = clamp(Math.ceil((Math.max(x0, x1) + m + HALF) / HF_RES), 0, HF_N - 1);
      const j0 = clamp(Math.floor((Math.min(z0, z1) - m + HALF) / HF_RES), 0, HF_N - 1), j1 = clamp(Math.ceil((Math.max(z0, z1) + m + HALF) / HF_RES), 0, HF_N - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -HALF + i * HF_RES, z = -HALF + j * HF_RES, t = (x - r.ax) * r.dx + (z - r.az) * r.dz, lat = Math.abs((x - r.ax) * -r.dz + (z - r.az) * r.dx);
        if (lat > m || (t - s0) * (t - s1) > 0) continue;
        const k = 1 - Math.abs(t - s0) / Math.abs(s1 - s0), target = lerp(at(clamp(t, 0, r.len)), y - 0.03, sstep(0, 1, k)), lw = sstep(m, r.width / 2 + 0.5, lat), q = j * HF_N + i;
        if (target > w.hf[q]) w.hf[q] = lerp(w.hf[q], target, lw);
      }
    };
    ramp(first, Math.max(0, first - 16)); ramp(last, Math.min(r.len, last + 16));
  }
  await yieldUI(0.55, '지형 메시 생성');

  // ----- 지형 메시 -----
  // 기본 맵: 4x4 청크를 미리 생성. 대형 맵: 500m 청크를 카메라 주변에서만 만들고 멀어지면 해제(스트리밍)
  const SC = [[0.32, 0.47, 0.22], [0.48, 0.40, 0.28], [0.47, 0.45, 0.42], [0.76, 0.69, 0.50], [0.30, 0.29, 0.27], [0.50, 0.49, 0.46], [0.62, 0.55, 0.26], [0.42, 0.50, 0.21], [0.27, 0.38, 0.19]];
  const terrMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const TCH = big ? 16 : 4, per = (HF_N - 1) / TCH;
  function terrainChunk(ci, cj) {
    const pos = new Float32Array((per + 1) * (per + 1) * 3), col = new Float32Array((per + 1) * (per + 1) * 3), idx = [], i0 = ci * per, j0 = cj * per;
    let v = 0;
    for (let j = 0; j <= per; j++) for (let i = 0; i <= per; i++) {
      const gi = i0 + i, gj = j0 + j, k = gj * HF_N + gi, x = -HALF + gi * HF_RES, z = -HALF + gj * HF_RES, h = w.hf[k];
      pos[v] = x; pos[v + 1] = h; pos[v + 2] = z;
      const s = w.surf[k], c = SC[s], nv = 0.88 + fbm(n2, x * 0.07, z * 0.07, 2) * 0.22, hv = s === 2 ? 1 : (s === 0 || s === 8 ? 0.9 + clamp(h / 60, 0, 0.2) : 1);
      const under = h < -0.2 ? 0.75 : 1;
      col[v] = c[0] * nv * hv * under; col[v + 1] = c[1] * nv * hv * under; col[v + 2] = c[2] * nv * under; v += 3;
    }
    for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
      const a = j * (per + 1) + i, b = a + 1, c = a + per + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, terrMat); m.receiveShadow = true;
    return m;
  }
  w.terrain = [];
  if (!big) { for (let cj = 0; cj < TCH; cj++) for (let ci = 0; ci < TCH; ci++) { const m = terrainChunk(ci, cj); w.objects.add(m); w.terrain.push(m); } }
  else {
    const live = new Map(), cs = SIZE / TCH;
    // 카메라 주변 청크 유지: 반경 안은 생성(한 번에 최대 maxNew개), 멀어진 것은 해제
    w.streamTerrain = (cx, cz, keep, maxNew = 2) => {
      let made = 0;
      const want = [];
      for (let cj = 0; cj < TCH; cj++) for (let ci = 0; ci < TCH; ci++) {
        const x = -HALF + (ci + 0.5) * cs, z = -HALF + (cj + 0.5) * cs, d = Math.max(0, Math.hypot(x - cx, z - cz) - cs * 0.71), k = cj * TCH + ci;
        if (d < keep && !live.has(k)) want.push([d, ci, cj, k]);
        else if (d > keep + 600 && live.has(k)) { const m = live.get(k); w.objects.remove(m); m.geometry.dispose(); live.delete(k); }
      }
      want.sort((a, b) => a[0] - b[0]);
      for (const [, ci, cj, k] of want) { if (made >= maxNew) break; const m = terrainChunk(ci, cj); w.objects.add(m); live.set(k, m); made++; }
      return want.length - made;
    };
    w.terrainLive = live;
  }
  // 바다/강/호수 수면
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 3, SIZE * 3), new THREE.MeshPhongMaterial({ color: 0x2c6474, transparent: true, opacity: 0.78, shininess: 80, specular: 0x88aabb }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; w.objects.add(water); w.water = water;
  // 도로 리본
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3b3c3d, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xc9b25a, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const rp = [], ri = [], lp = [], li = [];
  for (const r of w.roads) {
    const nx = -r.dz, nz = r.dx, hw = r.width / 2, steps = Math.ceil(r.len / 3);
    const base = rp.length / 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps * r.len, x = r.ax + r.dx * t, z = r.az + r.dz * t;
      for (const sd of [-1, 1]) { const px = x + nx * hw * sd, pz = z + nz * hw * sd; rp.push(px, Math.max(heightAt(px, pz), heightAt(x, z)) + 0.07, pz); }
      if (s < steps && w.riverDist(x, z) > river.w + 6) { const a = base + s * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      if (r.kind === 'main' && s % 3 === 0 && s < steps) { // 중앙 점선
        const t2 = Math.min(r.len, t + 2.2), x2 = r.ax + r.dx * t2, z2 = r.az + r.dz * t2, lb = lp.length / 3;
        for (const [qx, qz] of [[x, z], [x2, z2]]) for (const sd of [-1, 1]) lp.push(qx + nx * 0.12 * sd, Math.max(heightAt(qx, qz), heightAt(qx + nx * 0.12 * sd, qz + nz * 0.12 * sd)) + 0.09, qz + nz * 0.12 * sd);
        li.push(lb, lb + 1, lb + 2, lb + 1, lb + 3, lb + 2);
      }
    }
  }
  for (const [p, i, mat] of [[rp, ri, roadMat], [lp, li, lineMat]]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(i);
    // 법선은 위쪽 고정 (뒤집힘 방지)
    const nrm = new Float32Array(p.length); for (let k = 1; k < nrm.length; k += 3) nrm[k] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; mat.side = THREE.DoubleSide; w.objects.add(m);
  }

  await yieldUI(0.68, '숲과 바위 생성');
  // ----- 나무 / 바위 / 덤불 / 풀 -----
  const Q = QUALITY[SETTINGS.quality] || QUALITY.medium;
  const trees = [], rocks = [], bushes = [];
  const treeTarget = Math.floor((big ? 42000 : 1500) * Q.trees);
  for (let t = 0; t < treeTarget * 6 && trees.length < treeTarget; t++) {
    if (big && t % 20000 === 0) await yieldUI(0.68 + 0.08 * trees.length / treeTarget, '숲과 바위 생성');
    const x = R(-HALF * 0.9, HALF * 0.9), z = R(-HALF * 0.9, HALF * 0.9);
    const dens = sstep(-0.15, 0.35, fbm(n4, x * 0.008 / (big ? 2.5 : 1), z * 0.008 / (big ? 2.5 : 1), 3)) + mountW(x, z) * 0.5;
    if (rng() > dens * 0.9) continue;
    const h = heightAt(x, z), s = surfaceAt(x, z);
    if (h < 1.4 || s === 4 || s === 5 || s === 6 || s === 7 || s === 3) continue;
    if (riverDist(x, z) < river.w + 9 || w.roadDist(x, z) < 6.5) continue;
    if (poisNear(x, z).some(p => Math.hypot(p.x - x, p.z - z) < p.r + (p.type === 'village' ? -4 : 6))) continue;
    if (!footprintFree(x - 0.6, z - 0.6, x + 0.6, z + 0.6, 1.2)) continue;
    if (TR && Math.max(Math.abs(x), Math.abs(z)) < 222) continue;
    if (AR && Math.max(Math.abs(x), Math.abs(z)) < 47) continue;
    const pine = h > 14 || mountW(x, z) > 0.3 ? rng() < 0.85 : rng() < 0.3;
    const sc = R(0.8, 1.35);
    trees.push({ x, z, y: h, pine, sc, rot: R(0, TAU) });
    addCollider(x - 0.28 * sc, h - 0.5, z - 0.28 * sc, x + 0.28 * sc, h + 6.5 * sc, z + 0.28 * sc, { kind: 'tree' });
  }
  for (let t = 0; t < (big ? 50000 : 2500) && rocks.length < (big ? 5000 : 340); t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z);
    if (h < 1.2 || s === 4 || s === 5 || riverDist(x, z) < river.w + 4 || w.roadDist(x, z) < 6) continue;
    if (rng() > 0.25 + mountW(x, z) * 0.8 + (s === 2 ? 0.4 : 0)) continue;
    if (poisNear(x, z).some(p => Math.hypot(p.x - x, p.z - z) < p.r)) continue;
    if (TR && Math.max(Math.abs(x), Math.abs(z)) < 222) continue;
    if (AR && Math.max(Math.abs(x), Math.abs(z)) < 47) continue;
    if (!footprintFree(x - 1.5, z - 1.5, x + 1.5, z + 1.5, 0.5)) continue;
    const sx = R(1.0, 2.6), sy = R(0.7, 1.9), sz = R(1.0, 2.6);
    rocks.push({ x, z, y: h, sx, sy, sz, rot: R(0, TAU) });
    claim(x - sx * 0.7, z - sz * 0.7, x + sx * 0.7, z + sz * 0.7);
    addCollider(x - sx * 0.68, h - 0.6, z - sz * 0.68, x + sx * 0.68, h + sy * 0.85, z + sz * 0.68, { kind: 'rock' });
  }
  for (let t = 0; t < (big ? 60000 : 4000) && bushes.length < (big ? 14000 : 700) * Q.trees; t++) {
    const x = R(-HALF * 0.88, HALF * 0.88), z = R(-HALF * 0.88, HALF * 0.88), h = heightAt(x, z), s = surfaceAt(x, z);
    if (h < 1.3 || s === 4 || s === 5 || s === 3 || w.roadDist(x, z) < 5) continue;
    if (TR && Math.max(Math.abs(x), Math.abs(z)) < 222) continue;
    if (AR && Math.max(Math.abs(x), Math.abs(z)) < 47) continue;
    if (!footprintFree(x - 0.8, z - 0.8, x + 0.8, z + 0.8, 0.3)) continue;
    bushes.push({ x, z, y: h, sc: R(0.6, 1.3) });
  }
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  const mk1 = (geo, mat, list, fn) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { fn(it, dummy, tc); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, tc); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; w.objects.add(im); return im;
  };
  // 대형 맵: 구역별 인스턴스 메시로 나눠 먼 구역은 통째로 숨긴다
  const mk = (geo, mat, list, fn) => {
    if (!big) return mk1(geo, mat, list, fn);
    const by = new Map(); for (const it of list) { const k = chunk(it.x, it.z); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
    let last = null; for (const [k, l] of by) { last = mk1(geo, mat, l, fn); regChunk(k, last); }
    return last;
  };
  const vegMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 4, 6); trunkG.translate(0, 2, 0);
  mk(trunkG, vegMat, trees, (t, d, c) => { d.position.set(t.x, t.y - 0.2, t.z); d.scale.set(t.sc, t.sc * (t.pine ? 1.4 : 1), t.sc); d.rotation.set(0, t.rot, 0); c.setHex(0x5a4330); });
  const pineG = new THREE.ConeGeometry(1.9, 6.2, 7); pineG.translate(0, 6.2, 0);
  mk(pineG, vegMat, trees.filter(t => t.pine), (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc, t.sc, t.sc); d.rotation.set(0, t.rot, 0); c.setHSL(0.3 + rng() * 0.04, 0.35, 0.2 + rng() * 0.06); });
  const leafG = new THREE.IcosahedronGeometry(2.4, 0); leafG.translate(0, 5.0, 0);
  mk(leafG, vegMat, trees.filter(t => !t.pine), (t, d, c) => { d.position.set(t.x, t.y, t.z); d.scale.set(t.sc * R(0.9, 1.2), t.sc, t.sc * R(0.9, 1.2)); d.rotation.set(0, t.rot, 0); c.setHSL(0.22 + rng() * 0.07, 0.42, 0.26 + rng() * 0.08); });
  mk(new THREE.DodecahedronGeometry(1, 0), vegMat, rocks, (r, d, c) => { d.position.set(r.x, r.y + r.sy * 0.25, r.z); d.scale.set(r.sx, r.sy, r.sz); d.rotation.set(rng() * 0.4, r.rot, rng() * 0.4); const g = 0.42 + rng() * 0.12; c.setRGB(g, g * 0.98, g * 0.93); });
  mk(new THREE.IcosahedronGeometry(0.9, 0), vegMat, bushes, (b, d, c) => { d.position.set(b.x, b.y + 0.35 * b.sc, b.z); d.scale.set(b.sc, b.sc * 0.75, b.sc); d.rotation.set(0, rng() * 3, 0); c.setHSL(0.25 + rng() * 0.06, 0.4, 0.22 + rng() * 0.06); });
  if (Q.grass > 0 && !big) {
    const grass = [];
    for (let t = 0; t < Q.grass * 4 && grass.length < Q.grass; t++) {
      const x = R(-HALF * 0.85, HALF * 0.85), z = R(-HALF * 0.85, HALF * 0.85), s = surfaceAt(x, z), h = heightAt(x, z);
      if ((s === 0 || s === 8 || s === 7) && h > 1.3 && w.roadDist(x, z) > 4.5) grass.push({ x, z, y: h });
    }
    const gg = new THREE.ConeGeometry(0.25, 0.7, 3); gg.translate(0, 0.3, 0);
    const im = mk(gg, vegMat, grass, (g, d, c) => { d.position.set(g.x, g.y, g.z); const s = R(0.7, 1.5); d.scale.set(s, s, s); d.rotation.set(0, rng() * 3, 0); c.setHSL(0.22 + rng() * 0.06, 0.45, 0.28 + rng() * 0.1); });
    if (im) im.castShadow = false;
  }
  w.trees = trees; w.rocks = rocks;

  // ----- 병합 메시 확정 -----
  const solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const fenceMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
  for (const [, v] of batches) { const m = v.b.build(v.key === 'fence' ? fenceMat : solidMat); if (m) { if (v.key === 'fence') m.castShadow = false; w.objects.add(m); regChunk(v.c, m); } }
  // 생성용 임시 자료 해제 (스트리밍 클로저가 이 함수 범위를 붙잡고 있어 직접 비워야 GC된다)
  batches.clear(); fpGrid.length = 0; w.footprints.length = 0;
  // 대형 맵 구역 숨김 (카메라 거리 기준)
  w.cullChunks = (cx, cz, far) => { if (!big) return; for (const e of w.chunkObjs.values()) { const vis = Math.hypot(e.x - cx, e.z - cz) < far + SIZE / CH * 0.75; for (const o of e.objs) o.visible = vis; } };

  await yieldUI(0.8, '미니맵 렌더링');
  buildMinimapImage(w);
  await yieldUI(0.86, '경로 탐색망 구축');
  Nav.build(w);
  await yieldUI(0.95, '준비 완료');
  return w;
}

// 미니맵 배경 이미지 (실제 높이맵/표면/도로/건물에서 생성)
function buildMinimapImage(w) {
  const S = w.big ? 2048 : 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  const SC = [[86, 120, 62], [124, 104, 74], [128, 122, 114], [196, 180, 132], [70, 70, 70], [140, 138, 132], [160, 142, 70], [110, 128, 56], [72, 100, 54]];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = -HALF + (px + 0.5) / S * SIZE, z = -HALF + (py + 0.5) / S * SIZE, h = heightAt(x, z);
    let c;
    if (h < WATER_Y) { const dd = clamp(-h / 6, 0, 1); c = [lerp(70, 34, dd), lerp(130, 78, dd), lerp(150, 110, dd)]; }
    else {
      const s = surfaceAt(x, z), base = SC[s], sh = clamp(1 + (heightAt(x - 1.5, z - 1.5) - h) * 0.12, 0.7, 1.25) * (0.9 + clamp(h / 80, 0, 0.25));
      c = [base[0] * sh, base[1] * sh, base[2] * sh];
    }
    const k = (py * S + px) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const toP = (v) => (v + HALF) / SIZE * S;
  g.lineCap = 'round';
  for (const r of w.roads) { g.strokeStyle = r.kind === 'street' ? '#5c5c5c' : '#d8cfb0'; g.lineWidth = r.width / SIZE * S * 0.9; g.beginPath(); g.moveTo(toP(r.ax), toP(r.az)); g.lineTo(toP(r.bx), toP(r.bz)); g.stroke(); }
  g.fillStyle = '#3a3633';
  for (const b of w.buildings) { const r = b.rect; g.fillRect(toP(r[0] + 1.5), toP(r[1] + 1.5), (r[2] - r[0] - 3) / SIZE * S, (r[3] - r[1] - 3) / SIZE * S); }
  for (const r of w.mapRects || []) g.fillRect(toP(r[0]), toP(r[1]), Math.max(2, (r[2] - r[0]) / SIZE * S), Math.max(2, (r[3] - r[1]) / SIZE * S));
  w.minimap = cv;
}
