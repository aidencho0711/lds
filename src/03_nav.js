// ============================================================
// 03_nav.js — 1m 격자 내비게이션 + A* 경로 탐색 (타일 지연 생성)
//  · 64m×64m 타일 단위로 '이동 불가/보행 높이'를 처음 필요할 때 계산 → 8km 맵도 메모리 수십 MB
//    (예전처럼 맵 전체 1m 격자를 만들면 8km에서 약 1.3GB)
//  · 세부 A*는 출발·목표 주변 160m 창 안에서만 (예산 6000 노드)
//  · 장거리는 거친 격자(6~8m)로 큰 경로를 잡고, 앞쪽 지점을 세부 목표로
//  벽/나무/바위/깊은 물/급경사/계단은 이동 불가. 문 틈(1.8m)은 캐릭터 반경을 고려해도 통과
// ============================================================
const Nav = (() => {
  const T = 64;                     // 타일 한 변 (셀=1m)
  let NT = 0, tiles = null, world = null, built = 0, N = 0;
  const _boxes = [];

  // ---------- 타일 ----------
  function makeTile(ti, tj) {
    const x0 = -HALF + ti * T, z0 = -HALF + tj * T, B = T + 2;
    const blocked = new Uint8Array(T * T), gr = new Float32Array(B * B), ground = new Float32Array(T * T);
    // 1) 보행 지면 높이 (테두리 1칸 포함: 경사 계산용)
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) gr[j * B + i] = heightAt(x0 + i - 0.5, z0 + j - 0.5);
    queryBoxes(x0 - 2, z0 - 2, x0 + T + 2, z0 + T + 2, _boxes);
    const list = _boxes.slice();
    for (const b of list) if (b.nav) rast(b, 0, x0 - 1, z0 - 1, B, (k) => { if (b.y1 > gr[k] - 4 && b.y1 < gr[k] + 9) gr[k] = Math.max(gr[k], b.y1); });
    // 2) 깊은 물, 급경사, 맵 가장자리
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const q = (j + 1) * B + (i + 1), h = gr[q], k = j * T + i;
      ground[k] = h;
      const gi = ti * T + i, gj = tj * T + j;
      if (gi <= 0 || gj <= 0 || gi >= N - 1 || gj >= N - 1) { blocked[k] = 1; continue; }
      if (h < WATER_Y - 0.9) { blocked[k] = 1; continue; }
      const sl = Math.max(Math.abs(gr[q + 1] - gr[q - 1]), Math.abs(gr[q + B] - gr[q - B])) / 2;
      if (sl > 0.95) blocked[k] = 1;
    }
    // 3) 충돌 박스: 보행 높이에서 몸통과 겹치는 것만 차단
    for (const b of list) rast(b, CHAR_R, x0, z0, T, (k) => { const gy = ground[k]; if (b.y0 < gy + 1.6 && b.y1 > gy + STEP_H - 0.08) blocked[k] = 1; });
    // 4) 계단 경사로는 걷기 판정에서 제외 (물리로 오르내림)
    const ci0 = clamp(Math.floor((x0 - 2 + HALF) / CG), 0, CGN - 1), ci1 = clamp(Math.floor((x0 + T + 2 + HALF) / CG), 0, CGN - 1);
    const cj0 = clamp(Math.floor((z0 - 2 + HALF) / CG), 0, CGN - 1), cj1 = clamp(Math.floor((z0 + T + 2 + HALF) / CG), 0, CGN - 1);
    const seen = new Set();
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) for (const r of world.rgrid[cj * CGN + ci]) { if (seen.has(r)) continue; seen.add(r); rast(r, 0.2, x0, z0, T, (k) => { blocked[k] = 1; }); }
    built++;
    return { blocked, ground };
  }
  // 박스를 (ox,oz) 원점 n×n 셀 배열에 래스터화. 얇은 벽도 최소 1m 폭으로 막는다
  function rast(b, pad, ox, oz, n, fn) {
    let x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad;
    if (pad > 0) {
      if (x1 - x0 < 1.0) { const m = (x0 + x1) / 2; x0 = m - 0.5; x1 = m + 0.5; }
      if (z1 - z0 < 1.0) { const m = (z0 + z1) / 2; z0 = m - 0.5; z1 = m + 0.5; }
    }
    const i0 = Math.max(0, Math.floor(x0 - ox)), i1 = Math.min(n - 1, Math.floor(x1 - ox));
    const j0 = Math.max(0, Math.floor(z0 - oz)), j1 = Math.min(n - 1, Math.floor(z1 - oz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = ox + i + 0.5, z = oz + j + 0.5;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) fn(j * n + i);
    }
  }
  // 타일 캐시: 큰 맵에서 2400개(약 50MB)를 넘으면 오래 안 쓴 절반을 버린다
  let useClock = 0, live = 0;
  const CAP = 2400;
  function tile(ti, tj) {
    const k = tj * NT + ti; let t = tiles[k];
    if (!t) { if (live >= CAP) evict(); t = tiles[k] = makeTile(ti, tj); live++; }
    t.use = useClock; return t;
  }
  function evict() {
    const uses = []; for (const t of tiles) if (t) uses.push(t.use);
    uses.sort((a, b) => a - b); const cut = uses[Math.floor(uses.length / 2)];
    for (let k = 0; k < tiles.length; k++) if (tiles[k] && tiles[k].use <= cut && tiles[k].use < useClock) { tiles[k] = null; live--; }
  }
  // 전역 셀 (gi,gj)의 차단 여부
  function blockedAt(gi, gj) {
    if (gi < 0 || gj < 0 || gi >= N || gj >= N) return 1;
    const t = tile((gi / T) | 0, (gj / T) | 0); return t.blocked[(gj % T) * T + (gi % T)];
  }
  function groundAtCell(gi, gj) { const t = tile((gi / T) | 0, (gj / T) | 0); return t.ground[(gj % T) * T + (gi % T)]; }
  const gcell = (v) => Math.floor(v + HALF);

  function build(w) {
    world = w; N = SIZE; NT = Math.ceil(N / T); tiles = new Array(NT * NT).fill(null); built = 0; live = 0; useClock = 0;
    // 작은 맵은 모든 타일을 미리 만들어 거친 격자를 정확히 계산, 큰 맵은 높이맵으로 근사
    const small = NT * NT <= 400;
    if (small) for (let tj = 0; tj < NT; tj++) for (let ti = 0; ti < NT; ti++) tile(ti, tj);
    buildCoarse(small);
  }

  // ----- 장거리용 거친 격자. 강·호수·산을 우회하는 전역 경로 -----
  let CS = 6, CN = 0;
  const stats = { coarse: 0, cnodes: 0, cfail: 0, fine: 0 };
  let cblocked = null, cg = null, cfrom = null, cstamp = null, cclosed = null, cur = 1;
  function buildCoarse(exact) {
    CS = exact ? 6 : 16; CN = Math.ceil(N / CS);
    cblocked = new Uint8Array(CN * CN); cg = new Float32Array(CN * CN); cfrom = new Int32Array(CN * CN); cstamp = new Uint32Array(CN * CN); cclosed = new Uint32Array(CN * CN);
    for (let cj = 0; cj < CN; cj++) for (let ci = 0; ci < CN; ci++) {
      if (exact) {
        let free = 0, tot = 0;
        for (let j = cj * CS; j < Math.min(N, cj * CS + CS); j++) for (let i = ci * CS; i < Math.min(N, ci * CS + CS); i++) { tot++; if (!blockedAt(i, j)) free++; }
        cblocked[cj * CN + ci] = free / tot < 0.28 ? 1 : 0;
      } else {
        // 깊은 물·급경사 표본 (5점) + 큰 건물 상자
        const x = -HALF + ci * CS + CS / 2, z = -HALF + cj * CS + CS / 2, o = CS * 0.35;
        const hs = [heightAt(x, z), heightAt(x - o, z - o), heightAt(x + o, z - o), heightAt(x - o, z + o), heightAt(x + o, z + o)];
        let wet = 0; for (const h of hs) if (h < WATER_Y - 0.9) wet++;
        const steep = Math.max(Math.abs(hs[1] - hs[4]), Math.abs(hs[2] - hs[3])) / (o * 2.83) > 0.95;
        cblocked[cj * CN + ci] = wet >= 3 || steep || ci === 0 || cj === 0 || ci === CN - 1 || cj === CN - 1 ? 1 : 0;
      }
    }
    if (!exact) for (const b of world.boxes) { // 탑·창고 등 큰 고체는 거친 격자에서도 막음
      if ((b.x1 - b.x0) * (b.z1 - b.z0) < CS * CS * 0.8 || b.y1 - b.y0 < 2 || b.soft) continue;
      const i0 = clamp(Math.ceil((b.x0 + HALF) / CS), 0, CN - 1), i1 = clamp(Math.floor((b.x1 + HALF) / CS) - 1, 0, CN - 1);
      const j0 = clamp(Math.ceil((b.z0 + HALF) / CS), 0, CN - 1), j1 = clamp(Math.floor((b.z1 + HALF) / CS) - 1, 0, CN - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cblocked[j * CN + i] = 1;
    }
    // 다리: 근사 격자에서 강을 막힌 벽으로 보지 않도록 다리 상판 아래 칸을 연다
    if (!exact) for (const br of world.bridges || []) {
      const along = br.rot === 1 ? [1, 0] : [0, 1];
      for (let s = -br.L / 2 - CS; s <= br.L / 2 + CS; s += CS / 2) {
        const x = br.cx + along[0] * s, z = br.cz + along[1] * s;
        const i = clamp(Math.floor((x + HALF) / CS), 0, CN - 1), j = clamp(Math.floor((z + HALF) / CS), 0, CN - 1);
        cblocked[j * CN + i] = 0;
      }
    }
  }
  function coarse(sx, sz, gx, gz) {
    const ci = (x) => clamp(Math.floor((x + HALF) / CS), 0, CN - 1);
    let s = ci(sz) * CN + ci(sx), t = ci(gz) * CN + ci(gx);
    const near = (k) => { if (!cblocked[k]) return k; const i0 = k % CN, j0 = Math.floor(k / CN); for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= CN || j >= CN) continue; if (!cblocked[j * CN + i]) return j * CN + i; } return -1; };
    s = near(s); t = near(t); if (s < 0 || t < 0) return null;
    cur++; heap.length = 0;
    const ti = t % CN, tj = Math.floor(t / CN);
    // 약간 탐욕적인 휴리스틱(×1.15): 장거리 탐색 노드 수를 크게 줄임
    const H = (k) => { const dx = Math.abs(k % CN - ti), dz = Math.abs(Math.floor(k / CN) - tj); return (dx + dz + (1.414 - 2) * Math.min(dx, dz)) * 1.15; };
    cg[s] = 0; cstamp[s] = cur; cfrom[s] = -1; hpush(s, H(s));
    let found = false, n = 0;
    while (heap.length && n < 16000) {
      const k = hpop(); if (cclosed[k] === cur) continue; cclosed[k] = cur; n++;
      if (k === t) { found = true; break; }
      const i = k % CN, j = Math.floor(k / CN);
      for (const [di, dj, c] of DIRS) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= CN || nj >= CN) continue;
        const q = nj * CN + ni; if (cblocked[q] || cclosed[q] === cur) continue;
        if (di && dj && (cblocked[j * CN + ni] || cblocked[nj * CN + i])) continue;
        const ng = cg[k] + c; if (cstamp[q] !== cur || ng < cg[q]) { cstamp[q] = cur; cg[q] = ng; cfrom[q] = k; hpush(q, ng + H(q)); }
      }
    }
    stats.coarse++; stats.cnodes += n; if (!found) stats.cfail++;
    if (!found) return null;
    const pts = []; let k = t; while (k >= 0) { pts.push([(k % CN) * CS - HALF + CS / 2, Math.floor(k / CN) * CS - HALF + CS / 2]); k = cfrom[k]; }
    return pts.reverse();
  }
  // 장거리: 거친 경로를 따라 ~55m 앞 지점을 세부 목표로
  function find(sx, sz, gx, gz, budget = 6000, cache) {
    const d = Math.hypot(gx - sx, gz - sz);
    if (d > 45 && cblocked) {
      let cp = null;
      // 같은 목표면 이전 결과(실패 포함)를 재사용 → 도달 불가 목표를 매번 다시 탐색하지 않음
      if (cache && cache.valid && Math.hypot(cache.gx - gx, cache.gz - gz) < 4) cp = cache.pts;
      else { cp = coarse(sx, sz, gx, gz); if (cache) { cache.pts = cp; cache.gx = gx; cache.gz = gz; cache.valid = true; } }
      if (cp && cp.length > 2) {
        let ni = 0, nd = 1e9;
        for (let i = 0; i < cp.length; i++) { const q = Math.hypot(cp[i][0] - sx, cp[i][1] - sz); if (q < nd) { nd = q; ni = i; } }
        let acc = 0, wx = cp[cp.length - 1][0], wz = cp[cp.length - 1][1];
        for (let i = ni + 1; i < cp.length; i++) { acc += Math.hypot(cp[i][0] - cp[i - 1][0], cp[i][1] - cp[i - 1][1]); if (acc > 55) { wx = cp[i][0]; wz = cp[i][1]; break; } }
        const r = fineFind(sx, sz, wx, wz, budget);
        if (r) { r.complete = false; return r; }
      }
    }
    return fineFind(sx, sz, gx, gz, budget);
  }
  function isFree(x, z) { return !blockedAt(gcell(x), gcell(z)); }
  // 격자 직선 통행 가능 여부 (경로 단축용)
  function walkable(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
    if (d < 0.01) return true;
    const px = -(bz - az) / d * 0.38, pz = (bx - ax) / d * 0.38;
    for (let s = 1; s <= n; s++) {
      const t = s / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!isFree(x, z) || !isFree(x + px, z + pz) || !isFree(x - px, z - pz)) return false;
    }
    return true;
  }
  // 이진 힙 (타입 배열, 할당 없음)
  const HK = new Float32Array(1 << 18), HV = new Int32Array(1 << 18);
  const heap = { length: 0 };
  function hpush(k, f) {
    let i = heap.length++; if (i >= HK.length) { heap.length--; return; }
    while (i > 0) { const p = (i - 1) >> 1; if (HK[p] <= f) break; HK[i] = HK[p]; HV[i] = HV[p]; i = p; }
    HK[i] = f; HV[i] = k;
  }
  function hpop() {
    const top = HV[0]; const n = --heap.length; if (n <= 0) return top;
    const f = HK[n], v = HV[n]; let i = 0;
    for (;;) { const l = i * 2 + 1, r = l + 1; let m = -1, mf = f; if (l < n && HK[l] < mf) { m = l; mf = HK[l]; } if (r < n && HK[r] < mf) { m = r; mf = HK[r]; } if (m < 0) break; HK[i] = HK[m]; HV[i] = HV[m]; i = m; }
    HK[i] = f; HV[i] = v; return top;
  }
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

  // ----- 세부 A*: 160m 창을 지역 배열로 복사해 탐색 -----
  const WN = 160, wBlocked = new Uint8Array(WN * WN), wGround = new Float32Array(WN * WN);
  const g = new Float32Array(WN * WN), from = new Int32Array(WN * WN), stamp = new Uint32Array(WN * WN), closed = new Uint32Array(WN * WN);
  let fcur = 1;
  function nearestFree(k, rad = 8) {
    if (!wBlocked[k]) return k;
    const i0 = k % WN, j0 = Math.floor(k / WN);
    for (let r = 1; r <= rad; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= WN || j >= WN) continue;
      const q = j * WN + i; if (!wBlocked[q]) return q;
    }
    return -1;
  }
  // 출발 칸이 막혔을 때(벽 바로 옆 등) 가장 가까운 빈 칸 — 단, 벽을 사이에 둔 칸(창문 너머 실내 등)은 제외
  function nearestFreeFrom(k, sx, sz, wi0, wj0) {
    if (!wBlocked[k]) return k;
    const i0 = k % WN, j0 = Math.floor(k / WN), y = heightAt(sx, sz) + 0.6;
    for (let r = 1; r <= 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= WN || j >= WN) continue;
      const q = j * WN + i; if (wBlocked[q]) continue;
      const cx = wi0 + i - HALF + 0.5, cz = wj0 + j - HALF + 0.5, dx = cx - sx, dz = cz - sz, L = Math.hypot(dx, dz) || 1;
      if (rayBoxes(sx, y, sz, dx / L, 0, dz / L, L).t < L) continue;
      return q;
    }
    return nearestFree(k, 10);
  }
  function fineFind(sx, sz, gx, gz, budget = 6000) {
    useClock++;
    const si = gcell(sx), sj = gcell(sz); let ti = gcell(gx), tj = gcell(gz);
    // 창 위치: 둘 다 들어가면 중점 기준, 아니면 출발점 쪽으로 (목표는 창 가장자리로 당김 → 부분 경로)
    const M = 6;
    let wi0 = Math.round((si + ti) / 2 - WN / 2), wj0 = Math.round((sj + tj) / 2 - WN / 2);
    wi0 = clamp(wi0, si - WN + M, si - M); wj0 = clamp(wj0, sj - WN + M, sj - M);
    ti = clamp(ti, wi0 + 1, wi0 + WN - 2); tj = clamp(tj, wj0 + 1, wj0 + WN - 2);
    // 창 채우기: 타일별로 행 단위 복사 (셀마다 타일을 찾는 것보다 수십 배 빠름)
    wBlocked.fill(1); wGround.fill(0);
    const ti0 = Math.max(0, Math.floor(wi0 / T)), ti1 = Math.min(NT - 1, Math.floor((wi0 + WN - 1) / T));
    const tj0 = Math.max(0, Math.floor(wj0 / T)), tj1 = Math.min(NT - 1, Math.floor((wj0 + WN - 1) / T));
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const t = tile(ti, tj), gx0 = Math.max(ti * T, wi0, 0), gx1 = Math.min(ti * T + T, wi0 + WN, N), gz0 = Math.max(tj * T, wj0, 0), gz1 = Math.min(tj * T + T, wj0 + WN, N);
      if (gx1 <= gx0) continue;
      for (let gz = gz0; gz < gz1; gz++) {
        const src = (gz - tj * T) * T + (gx0 - ti * T), dst = (gz - wj0) * WN + (gx0 - wi0), n = gx1 - gx0;
        wBlocked.set(t.blocked.subarray(src, src + n), dst); wGround.set(t.ground.subarray(src, src + n), dst);
      }
    }
    stats.fine++;
    let s = nearestFreeFrom((sj - wj0) * WN + (si - wi0), sx, sz, wi0, wj0), t = ti === gcell(gx) && tj === gcell(gz) ? nearestFreeFrom((tj - wj0) * WN + (ti - wi0), gx, gz, wi0, wj0) : nearestFree((tj - wj0) * WN + (ti - wi0), 10);
    if (s < 0 || t < 0) return null;
    fcur++; heap.length = 0;
    const tx = t % WN, tz = Math.floor(t / WN);
    const H = (k) => { const dx = Math.abs(k % WN - tx), dz = Math.abs(Math.floor(k / WN) - tz); return (dx + dz + (1.414 - 2) * Math.min(dx, dz)) * 1.25; };
    g[s] = 0; stamp[s] = fcur; from[s] = -1; hpush(s, H(s));
    let best = s, bestH = H(s), n = 0;
    while (heap.length && n < budget) {
      const k = hpop();
      if (closed[k] === fcur) continue; closed[k] = fcur; n++;
      if (k === t) { best = k; break; }
      const hk = H(k); if (hk < bestH) { bestH = hk; best = k; }
      const i = k % WN, j = Math.floor(k / WN);
      for (const [di, dj, c] of DIRS) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= WN || nj >= WN) continue;
        const q = nj * WN + ni; if (wBlocked[q] || closed[q] === fcur) continue;
        if (di && dj && (wBlocked[j * WN + ni] || wBlocked[nj * WN + i])) continue;
        const ng = g[k] + c + Math.abs(wGround[q] - wGround[k]) * 2;
        if (stamp[q] !== fcur || ng < g[q]) { stamp[q] = fcur; g[q] = ng; from[q] = k; hpush(q, ng + H(q)); }
      }
    }
    const raw = []; let k = best;
    while (k >= 0) { raw.push([wi0 + (k % WN) - HALF + 0.5, wj0 + Math.floor(k / WN) - HALF + 0.5]); k = from[k]; if (raw.length > 4000) break; }
    raw.reverse();
    const out = [raw[0]]; let a = 0;
    while (a < raw.length - 1) {
      let b = Math.min(raw.length - 1, a + 40);
      while (b > a + 1 && !walkable(raw[a][0], raw[a][1], raw[b][0], raw[b][1])) b--;
      out.push(raw[b]); a = b;
    }
    return { pts: out, complete: best === t && ti === gcell(gx) && tj === gcell(gz) };
  }
  function randomFreeNear(x, z, r, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (Math.abs(px) < HALF - 5 && Math.abs(pz) < HALF - 5 && isFree(px, pz)) return [px, pz];
    }
    return null;
  }
  return { stats, build, find, isFree, walkable, randomFreeNear, get ready() { return !!tiles; }, get tilesBuilt() { return built; }, groundAtCell };
})();
