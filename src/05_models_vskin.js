// ============================================================
// 05_models_vskin.js — 차량 스킨 모델 + 목록 (상점 차량 뽑기·교환소)
//  · 승용차(세단) 스킨: 스포츠카(스트라이커 GT, 미드십 쿠페) · 럭셔리카(엠버서더 L, 3박스 세단) · 하이퍼카(펄스 X9, 캐노피 쿠페)
//    v20: 단면 로프트 차체(아래 '승용차 스킨' 설명) — 너무 둥글지도 각지지도 않게, 유리는 필러로 나눔
//  · 오토바이 스킨: 레이서 R(앞 카울) · 크루저(크롬·물방울 탱크) / 말 스킨: 백마 · 흑마(금장 마구)
//  · 실제 자동차 회사의 이름·로고·디자인은 쓰지 않는다 (모양은 일반적인 장르 특징만)
//  · 좌석·핸들 위치·물리는 원래 차종과 같다 (스킨은 겉모습만) → 운전 자세·탑승·충돌이 그대로 맞는다
// ============================================================
const VSKINS = {
  sedan_gt_red: { veh: 'sedan', cls: 'sport', name: '스트라이커 GT · 레이싱 레드', rar: 4, price: 30, paint: 0xc4161c, accent: 0xffffff },
  sedan_gt_yellow: { veh: 'sedan', cls: 'sport', name: '스트라이커 GT · 선셋 옐로', rar: 4, price: 30, paint: 0xf2b705, accent: 0x111111 },
  sedan_lux_black: { veh: 'sedan', cls: 'lux', name: '엠버서더 L · 블랙 오닉스', rar: 4, price: 30, paint: 0x0e1013, roof: 0x0e1013 },
  sedan_lux_gold: { veh: 'sedan', cls: 'lux', name: '엠버서더 L · 샴페인 골드', rar: 4, price: 30, paint: 0xbfa36a, roof: 0x2a2622 },
  sedan_hyper_green: { veh: 'sedan', cls: 'hyper', name: '펄스 X9 · 네온 그린', rar: 5, price: 50, paint: 0x2fd35a, glow: 0x6dff8e, carbon: 0x16181a },
  sedan_hyper_white: { veh: 'sedan', cls: 'hyper', name: '펄스 X9 · 화이트 카본', rar: 5, price: 50, paint: 0xeeeeee, glow: 0x46c8ff, carbon: 0x16181a },
  moto_racer_blue: { veh: 'moto', cls: 'racer', name: '레이서 R · 블루', rar: 3, price: 15, paint: 0x1d4fd8, paint2: 0xf2f2f2 },
  moto_cruiser_black: { veh: 'moto', cls: 'cruiser', name: '크루저 · 블랙 크롬', rar: 3, price: 15, paint: 0x141416, paint2: 0x5a1a1a },
  horse_white: { veh: 'horse', cls: 'white', name: '백마 · 은빛 갈기', rar: 3, price: 15 },
  horse_black: { veh: 'horse', cls: 'black', name: '흑마 · 금장 마구', rar: 3, price: 15 },
};
const VEH_SKIN_TYPES = { sedan: '승용차', moto: '오토바이', horse: '말' };
const VCLS_NAME = { sport: '스포츠카', lux: '럭셔리카', hyper: '하이퍼카', racer: '오토바이', cruiser: '오토바이', white: '말', black: '말' };
(() => {
  const K = VehModels.kit, { VB, mtx, arch, side, tube, ball, wheelGeo, SEAT_C, TRIM } = K;
  // 크롬 휠 살(바퀴와 함께 돈다): 테 + 바퀴살 + 허브
  // 같은 바퀴 메시를 왼쪽·오른쪽에 쓰므로 양쪽 면에 모두 만든다
  function rimGeo(r, w, spokes, thin) {
    const vb = new VB(), c = 0xe8ecef, t = r * (thin ? 0.025 : 0.045);
    for (const sd of [1, -1]) {
      const ring = new THREE.CylinderGeometry(r * 0.66, r * 0.66, w * 0.16, 22, 1, true); ring.rotateZ(Math.PI / 2); vb.add(ring, mtx(sd * w * 0.44, 0, 0), c);
      for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; vb.box(sd * w * 0.42, -t, -r * 0.6, sd * w * 0.53, t, r * 0.6, c, a, 0, 0); }
      const hub = new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.03, 12); hub.rotateZ(Math.PI / 2); vb.add(hub, mtx(sd * w * 0.53, 0, 0), c);
    }
    return vb.build();
  }
  const tire = (r, w) => wheelGeo(r, w, 0x222426, 0, 0x151516);
  const steering = (matte) => matte.add(new THREE.TorusGeometry(0.17, 0.025, 6, 16), mtx(0.4, 0.98, 0.42, -0.45, 0, 0), 0x111213);   // 세단과 같은 자리(운전 자세)
  // 실내 기본: 앞좌석 2 + 뒷좌석(2+2) + 대시보드. o: 좁은 쿠페 실내가 차체 밖으로 나오지 않게 (dashW 대시보드 반폭 · rearW·rearH 뒷좌석 반폭·등받이 높이)
  function interior(matte, seatC, rear = true, backH = 1.2, o = {}) {
    const dw = o.dashW || 0.8, rw = o.rearW || 0.7, rh = o.rearH || 1.02;
    for (const s of [1, -1]) { matte.box(s * 0.18, 0.4, -0.48, s * 0.62, 0.6, -0.05, seatC); matte.box(s * 0.18, 0.58, -0.56, s * 0.62, backH, -0.44, seatC, -0.2); }
    if (rear) { matte.box(-rw, 0.4, -1.42, rw, 0.6, -0.98, seatC); matte.box(-rw, 0.58, -1.5, rw, rh, -1.4, seatC, -0.22); }
    matte.box(-dw, 0.72, 0.5, dw, o.dashY || 0.9, 0.95, 0x1b1c1e);
    steering(matte);
  }

  // ============================================================
  // 승용차 스킨 (v20): 단면 로프트 차체
  //  · 차체 = 길이 방향 키 값(폭·바닥·어깨 높이·단면 지수)을 단조 3차 보간(넘침 없이 부드럽게)한 단면들을 이어 붙임
  //    단면은 초타원 — 지수 2 = 타원(너무 둥긂), 클수록 상자(너무 각짐) → 3~4로 그 사이. 바닥 쪽은 평평하게, 위로 갈수록 안쪽으로(텀블홈)
  //  · 바퀴 아치: 아치 원 안의 단면 점을 바퀴 안쪽 면까지 밀어 넣어 파고(어둡게), 아치 바깥 테두리는 살짝 부풀림(펜더)
  //  · 지붕(그린하우스)도 위쪽 반 단면 로프트. 유리는 면 분류기로 나눔: 아래 테두리 = 창틀 / 모서리 띠 = A·C 필러·지붕 옆선 /
  //    옆 = 옆 유리(B 필러 자리는 검게, 뒤쪽은 C 필러 판) / 위 = 지붕(앞뒤는 앞·뒤 유리) — 통유리로 하면 거품처럼 보임
  //  · 유리는 옅게(sglass) — 안에 탄 사람이 보여야 한다. 등화·그릴·날개·미러는 차체 표면 높이를 재서 그 위에 붙인다
  //  · 바퀴살은 바퀴 축을 중심으로 돌려 배치(제 중심에서 돌리면 한쪽에 뭉침). 회사 이름·로고·엠블럼·차명 글자는 넣지 않는다
  // ============================================================
  // 단조 3차 보간(Fritsch–Carlson): 키 [[z, 값], ...] 또는 숫자 → f(z)
  function mono(keys) {
    if (typeof keys === 'number') return () => keys;
    const n = keys.length, X = keys.map((k) => k[0]), Y = keys.map((k) => k[1]), d = [], m = [];
    if (n === 1) return () => Y[0];
    for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return (x) => {
      if (x <= X[0]) return Y[0]; if (x >= X[n - 1]) return Y[n - 1];
      let i = 0; while (x > X[i + 1]) i++;
      const h = X[i + 1] - X[i], t = (x - X[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * Y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * Y[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  // 차체: S = { z0, z1, hw(반폭), y0(바닥), y1(어깨·보닛·트렁크 윗면), n(단면 지수), tb(텀블홈), mid(가장 넓은 높이 비율), valley(보닛 골짜기 깊이), wheels }
  //  valley: 윗면 가운데를 낮춰 양옆 펜더 봉우리가 보닛보다 높게 — 슈퍼카다운 앞모습 (0이면 가운데가 가장 높은 둥근 지붕)
  function makeBody(S) {
    const F = { S, z0: S.z0, z1: S.z1 }, D = { n: 3.5, tb: 0.15, mid: 0.4, valley: 0 };
    for (const k of ['hw', 'y0', 'y1', 'n', 'tb', 'mid', 'valley']) F[k] = mono(S[k] === undefined ? D[k] : S[k]);
    F.sec = (z) => { const y0 = F.y0(z), y1 = F.y1(z), yc = y0 + (y1 - y0) * F.mid(z); return { hw: F.hw(z), yc, hu: y1 - yc, hl: yc - y0, n: F.n(z), tb: F.tb(z), v: F.valley(z) }; };
    const dip = (q, x, u) => { const t = x / q.hw, w = Math.max(0, 1 - t * t); return q.v * w * w * u * u; };
    // 단면 한 점: t = −π/2(바닥 가운데) → 0(옆, +x) → π/2(위 가운데) → π → 3π/2
    F.ring = (z, t) => {
      const q = F.sec(z), c = Math.cos(t), s = Math.sin(t), e = 2 / q.n, cx = q.hw * Math.sign(c) * Math.pow(Math.abs(c), e);
      if (s >= 0) { const u = Math.pow(s, e), x = cx * (1 - q.tb * u); return [x, q.yc + q.hu * u - dip(q, x, u)]; }
      return [cx, q.yc - q.hl * Math.pow(-s, e * 0.55)];   // 아래는 더 평평하게
    };
    // 윗면 높이 (z, x) · 옆면 x (z, y) — 부품을 표면에 붙일 때
    F.topY = (z, x) => {
      const q = F.sec(z), ax = Math.abs(x); let u = 0;
      for (let it = 0; it < 4; it++) { const xe = ax / (q.hw * (1 - q.tb * u)); u = xe >= 1 ? 0 : Math.pow(1 - Math.pow(xe, q.n), 1 / q.n); }
      return q.yc + q.hu * u - dip(q, x, u);
    };
    F.sideX = (z, y) => {
      const q = F.sec(z);
      if (y >= q.yc) { const u = clamp((y - q.yc) / q.hu, 0, 1), s = Math.pow(u, q.n / 2), c = Math.sqrt(Math.max(0, 1 - s * s)); return q.hw * Math.pow(c, 2 / q.n) * (1 - q.tb * u); }
      const u = clamp((q.yc - y) / q.hl, 0, 1), s = Math.pow(u, q.n / 1.1), c = Math.sqrt(Math.max(0, 1 - s * s)); return q.hw * Math.pow(c, 2 / q.n);
    };
    return F;
  }
  // 그린하우스: C = { z0, z1, wc(밑변 반폭), roof(지붕 높이), n, tb } — 밑변은 차체 윗면에 살짝 묻힘
  function makeCabin(B, C) {
    const wc = mono(C.wc), roof = mono(C.roof), n = C.n || 3, tb = C.tb === undefined ? 0.1 : C.tb;
    const base = (z) => B.topY(z, wc(z)) - 0.025;
    // v = 0(오른쪽 밑변) → 0.5(지붕 가운데) → 1(왼쪽 밑변)
    const pt = (z, v) => {
      const t = Math.PI * (1 - v), c = Math.cos(t), s = Math.sin(t), e = 2 / n, b = base(z), h = Math.max(0.003, roof(z) - b), u = Math.pow(Math.abs(s), e);
      return [wc(z) * Math.sign(c) * Math.pow(Math.abs(c), e) * (1 - tb * u), b + h * u];
    };
    return { S: C, wc, roof, base, pt };
  }
  // ---------- 격자 → 삼각형 (정점마다 색, 면마다 재질) ----------
  const _cc = new THREE.Color();
  function put(vb, p, n, hex) { vb.p.push(p[0], p[1], p[2]); vb.n.push(n[0], n[1], n[2]); _cc.setHex(hex); vb.c.push(_cc.r, _cc.g, _cc.b); }
  //  P[i][j] 점 · C[i][j] 색 · pick(i, j) → VB 또는 [VB, 면 색] (없으면 건너뜀) · out(p) 바깥 방향(감는 방향·법선 맞춤)
  function grid(P, C, closed, pick, out) {
    const nu = P.length, nv = P[0].length;
    const N = P.map((row, i) => row.map((p, j) => {
      const a = P[Math.min(nu - 1, i + 1)][j], b = P[Math.max(0, i - 1)][j];
      const c = P[i][closed ? (j + 1) % nv : Math.min(nv - 1, j + 1)], d = P[i][closed ? (j - 1 + nv) % nv : Math.max(0, j - 1)];
      const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz) || 1;
      return [nx / L, ny / L, nz / L];
    }));
    const im = nu >> 1, jm = closed ? nv >> 2 : nv >> 1, o = out(P[im][jm]), r = N[im][jm], flip = r[0] * o[0] + r[1] * o[1] + r[2] * o[2] < 0;
    if (flip) for (const row of N) for (const n of row) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < (closed ? nv : nv - 1); j++) {
      const k = pick(i, j); if (!k) continue;
      const vb = Array.isArray(k) ? k[0] : k, fc = Array.isArray(k) ? k[1] : null, j1 = (j + 1) % nv;
      const q = flip ? [[i, j], [i + 1, j1], [i + 1, j], [i, j], [i, j1], [i + 1, j1]] : [[i, j], [i + 1, j], [i + 1, j1], [i, j], [i + 1, j1], [i, j1]];
      for (const [a, b] of q) put(vb, P[a][b], N[a][b], fc === null ? C[a][b] : fc);
    }
  }
  // 끝 마개(부채꼴): 앞뒤 면
  function cap(vb, ring, cols, center, dz) {
    const n = ring.length, nr = [0, 0, dz];
    for (let j = 0; j < n; j++) {
      const a = ring[j], b = ring[(j + 1) % n], ux = a[0] - center[0], uy = a[1] - center[1], vx = b[0] - center[0], vy = b[1] - center[1];
      const ccw = (ux * vy - uy * vx) * dz > 0;
      const tri = ccw ? [[center, cols[j]], [a, cols[j]], [b, cols[(j + 1) % n]]] : [[center, cols[j]], [b, cols[(j + 1) % n]], [a, cols[j]]];
      for (const [p, c] of tri) put(vb, p, nr, c);
    }
  }
  // 차체 로프트: colorAt(x, y, z) → 도장 색(검은 스커트 등)
  //  S.dents: 옆 흡입구 — 타원(z·y 반지름 rz·ry, 기울기 a) 안쪽 점을 깊이 d만큼 밀어 넣고 안쪽으로 갈수록 어둡게 (색만 칠하면 얼룩처럼 보임)
  const _ca = new THREE.Color(), _cb2 = new THREE.Color();
  const mixHex = (a, b, k) => _ca.setHex(a).lerp(_cb2.setHex(b), k).getHex();
  function loftBody(B, vb, colorAt, nu = 72, nv = 60) {
    const P = [], C = [];
    for (let i = 0; i < nu; i++) {
      const z = B.z0 + (B.z1 - B.z0) * i / (nu - 1), row = [], crow = [];
      for (let j = 0; j < nv; j++) {
        let [x, y] = B.ring(z, -Math.PI / 2 + j / nv * TAU), well = 0, dent = 0;
        for (const W of B.S.wheels) {
          if (Math.abs(x) < W.inX - 0.02) continue;
          const d = Math.hypot(z - W.z, y - W.y), k = sstep(W.R + 0.012, W.R - 0.035, d);
          if (k > 0) { x = Math.sign(x) * lerp(Math.abs(x), W.inX, k); well = Math.max(well, k); }
          else if (d < W.R + W.lip && y > W.y - 0.1) x += Math.sign(x) * W.flare * Math.sin(Math.PI * (d - W.R) / W.lip);   // 펜더 테두리
        }
        for (const D of B.S.dents || []) {
          if (Math.abs(x) < 0.4) continue;
          const dz = z - D.z, dy = y - D.y, ca = Math.cos(D.a || 0), sa = Math.sin(D.a || 0), u = (ca * dz + sa * dy) / D.rz, w = (-sa * dz + ca * dy) / D.ry, e = u * u + w * w;
          if (e < 1) { const k = sstep(1, 0.5, e); x -= Math.sign(x) * D.d * k; dent = Math.max(dent, k); }
        }
        let c = colorAt(x, y, z); if (well > 0) c = mixHex(c, 0x0c0c0d, clamp((well - 0.25) / 0.4, 0, 1));   // 바퀴 우물: 테두리에서 서서히 어둡게(계단 무늬 방지)
        row.push([x, y, z]); crow.push(c);   // 흡입구 벽은 차체 색 그대로(굴곡 음영) — 정점 색으로 어둡게 하면 격자 때문에 얼룩처럼 번짐
      }
      P.push(row); C.push(crow);
    }
    grid(P, C, true, () => vb, (p) => [p[0], p[1] - B.sec(p[2]).yc, 0]);
    for (const [i, dz] of [[nu - 1, 1], [0, -1]]) { const z = P[i][0][2]; cap(vb, P[i], C[i], [0, B.sec(z).yc, z + dz * 0.012], dz); }   // 끝면은 살짝 볼록하게
  }
  // 흡입구 바닥: 오목하게 판 자리의 가장 깊은 곳에 검은 타원(또렷한 구멍) — dark: 넣을 VB(무광)
  function dentHoles(B, dark) {
    for (const D of B.S.dents || []) for (const s of [1, -1]) {
      const g = new THREE.CircleGeometry(1, 22); g.scale(D.rz * 0.66, D.ry * 0.66, 1); g.rotateZ(-s * (D.a || 0)); g.rotateY(s * Math.PI / 2);
      g.translate(s * (B.sideX(D.z, D.y) - D.d + 0.006), D.y, D.z); dark.add(g, null, 0x0a0a0b);
    }
  }
  // 그린하우스 로프트: keyOf(z, vv(0 밑변 ~ 0.5 지붕 가운데), dy(밑변에서 높이)) → [VB, 색]
  function loftCabin(Cb, keyOf, nu = 40, nv = 28) {
    const P = [], C = [], { z0, z1 } = Cb.S;
    for (let i = 0; i < nu; i++) { const z = z0 + (z1 - z0) * i / (nu - 1), row = []; for (let j = 0; j < nv; j++) { const [x, y] = Cb.pt(z, j / (nv - 1)); row.push([x, y, z]); } P.push(row); C.push(row.map(() => 0xffffff)); }
    grid(P, C, false, (i, j) => {
      const z = (P[i][j][2] + P[i + 1][j][2]) / 2, v = (j + 0.5) / (nv - 1), y = (P[i][j][1] + P[i + 1][j][1] + P[i][j + 1][1] + P[i + 1][j + 1][1]) / 4;
      return keyOf(z, Math.min(v, 1 - v), y - Cb.base(z));
    }, (p) => [p[0], p[1] - Cb.base(p[2]) + 0.3, 0]);
  }
  // 그린하우스 면 분류: K = { vS(옆 유리 끝), vP(필러 띠 폭), trimH(창틀 높이), zC(C 필러 시작), zB·bw(B 필러), zRF·zRR(지붕 앞·뒤 끝), glass, trim, pillar, bpil, roof, rear }
  const cabinKey = (K) => (z, vv, dy) => {
    if (dy < K.trimH) return K.trim;
    if (vv < K.vS) { if (z < K.zC) return K.pillar; if (K.zB !== undefined && Math.abs(z - K.zB) < K.bw) return K.bpil; return K.glass; }
    if (vv < K.vS + K.vP) return K.pillar;
    if (z > K.zRF) return K.glass;
    if (z < K.zRR) return K.rear || K.glass;
    return K.roof;
  };
  // 표면을 따라가는 가는 줄(등화·몰딩): 점 목록을 잇는 원기둥
  function curve(vb, pts, r, color, seg = 6) { for (let i = 0; i < pts.length - 1; i++) tube(vb, pts[i], pts[i + 1], r, color, seg); for (let i = 1; i < pts.length - 1; i++) ball(vb, pts[i][0], pts[i][1], pts[i][2], r, r, r, color, seg); }
  // 윗면을 따라 깔리는 띠(줄무늬): x0~x1, z0~z1
  function topStrip(vb, B, x0, x1, z0, z1, color, n = 14) {
    const P = [], C = [];
    for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; P.push([x0, x1].map((x) => [x, B.topY(z, x) + 0.004, z])); C.push([color, color]); }
    grid(P, C, false, () => vb, () => [0, 1, 0]);
  }
  // 사이드미러: 받침 + 납작한 거울 몸통
  function mirror(vb, s, x, y, z, color) {
    tube(vb, [s * x, y, z], [s * (x + 0.08), y + 0.035, z - 0.02], 0.014, color, 5);
    ball(vb, s * (x + 0.11), y + 0.05, z - 0.03, 0.065, 0.042, 0.05, color, 10);
  }
  // ---------- 바퀴: 둥근 어깨 타이어 + 축 기준으로 돌린 바퀴살 ----------
  function tireGeo(r, w) {
    const vb = new VB(), ri = r * 0.7;
    const prof = [[ri, -w * 0.5], [r * 0.88, -w * 0.5], [r * 0.96, -w * 0.46], [r, -w * 0.36], [r, w * 0.36], [r * 0.96, w * 0.46], [r * 0.88, w * 0.5], [ri, w * 0.5]];
    const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 28); g.rotateZ(Math.PI / 2);
    vb.add(g, null, 0x19191a);
    return vb.build();
  }
  //  st = { n: 바퀴살 수, twin: 쌍살, c: 휠 색, lip: 테 색, blade: 비틀림(터빈) }
  function rimGeo2(r, w, st) {
    const vb = new VB(), ri = r * 0.7, rh = r * 0.17;
    for (const sd of [1, -1]) {
      const x0 = sd * w * 0.42;
      const lip = new THREE.TorusGeometry(ri * 0.985, 0.011, 5, 26); lip.rotateY(Math.PI / 2); vb.add(lip, mtx(x0, 0, 0), st.lip);
      const back = new THREE.CircleGeometry(ri * 0.97, 24); back.rotateY(sd * Math.PI / 2); vb.add(back, mtx(sd * w * 0.18, 0, 0), 0x0b0b0c);   // 안쪽(어두운 통)
      const hub = new THREE.CylinderGeometry(rh, rh * 1.1, 0.03, 12); hub.rotateZ(Math.PI / 2); vb.add(hub, mtx(x0, 0, 0), st.c);
      for (let i = 0; i < st.n; i++) {
        const a0 = i / st.n * TAU;
        for (const off of st.twin ? [-0.09, 0.09] : [0]) {
          const g = new THREE.BoxGeometry(0.022, ri - rh, st.wd || 0.026);
          if (st.blade) g.rotateY(st.blade);                                        // 터빈 날처럼 비틀기 (제 축)
          g.translate(x0 - sd * 0.006, (ri + rh) / 2, 0); g.rotateX(a0 + off);     // 바퀴 축 기준으로 돌림
          vb.add(g, null, st.c);
        }
      }
    }
    return vb.build();
  }
  // 브레이크 캘리퍼(차체에 고정, 바퀴 안쪽 위): 바퀴살 사이로 보이는 색
  function calipers(vb, wheels, w, color) { for (const [x, y, z] of wheels) { const s = Math.sign(x); vb.box(s * (Math.abs(x) - w * 0.32), y + 0.04, z - 0.16, s * (Math.abs(x) - w * 0.1), y + 0.2, z - 0.02, color); } }
  const archW = (z, y, r, wx, w) => ({ z, y, R: r + 0.055, inX: Math.abs(wx) - w / 2 - 0.035, lip: 0.11, flare: 0.022 });

  // ---------- 하이퍼카(펄스 X9): 낮고 넓은 차체 · 바퀴 위로 솟은 펜더와 그 사이 낮은 보닛 · 물방울 캐노피 · 깊게 판 옆 흡입구 · 큰 뒷날개 · 빛나는 선 ----------
  //  v20 수정: 앞이 바닥까지 꺾여 내려가는 쐐기('/' 모양)를 버리고 차체 선을 거의 수평으로 — 낮아 보이는 건 보닛 골짜기·넓은 폭·큰 바퀴로
  function buildHyper(sk) {
    const P = sk.paint, CB = sk.carbon, G = sk.glow, gloss = new VB(), matte = new VB(), sglass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB(), glow = new VB();
    const WR = 0.38, WW = 0.32, WX = 0.85, wheels = [[WX, WR, 1.45, 1], [-WX, WR, 1.45, 1], [WX, WR, -1.38, 0], [-WX, WR, -1.38, 0]];
    const B = makeBody({ z0: -2.34, z1: 2.4,
      hw: [[-2.34, 0.86], [-2.15, 0.95], [-1.9, 0.99], [-1.4, 1.01], [-0.7, 0.95], [0.2, 0.93], [1.0, 0.97], [1.45, 0.99], [1.95, 0.94], [2.25, 0.84], [2.4, 0.74]],
      y0: [[-2.34, 0.3], [-2.15, 0.22], [-1.95, 0.2], [2.0, 0.2], [2.4, 0.26]],
      y1: [[-2.34, 0.86], [-2.1, 0.9], [-1.7, 0.93], [-1.38, 0.95], [-0.9, 0.9], [-0.3, 0.85], [0.5, 0.85], [1.0, 0.89], [1.45, 0.95], [1.9, 0.88], [2.2, 0.77], [2.4, 0.66]],
      valley: [[-2.34, 0.02], [-1.8, 0.06], [-1.0, 0.02], [0.4, 0.03], [1.0, 0.11], [1.45, 0.14], [1.9, 0.12], [2.4, 0.06]],
      n: [[-2.34, 4.6], [-1.9, 3.7], [0, 3.6], [1.9, 3.4], [2.4, 3.3]], tb: 0.24, mid: 0.36,
      dents: [{ z: -0.62, y: 0.57, rz: 0.42, ry: 0.13, a: 0.5, d: 0.09 }],   // 문 뒤 사선 흡입구
      wheels: [archW(1.45, WR, WR, WX, WW), archW(-1.38, WR, WR, WX, WW)] });
    const col = (x, y, z) => {
      const ax = Math.abs(x);
      if (y < 0.3) return CB;                                                              // 탄소 스커트·바닥
      if (z > 2.08 && y < 0.4 && ax < 0.82) return 0x0a0a0b;                               // 앞 흡입구
      if (z > 1.3 && z < 1.9 && ax > 0.22 && ax < 0.5 && y > B.topY(z, x) - 0.03) return 0x0a0a0b;   // 보닛 배출구
      return P;
    };
    loftBody(B, gloss, col); dentHoles(B, matte);
    const Cb = makeCabin(B, { z0: -1.65, z1: 1.12, n: 2.6, tb: 0.08,
      wc: [[-1.65, 0.5], [-1.15, 0.65], [-0.35, 0.72], [0.5, 0.7], [1.12, 0.58]],
      roof: [[-1.65, 0.9], [-1.3, 1.12], [-0.85, 1.32], [-0.36, 1.385], [0.1, 1.37], [0.5, 1.2], [0.85, 1.0], [1.12, 0.82]] });
    loftCabin(Cb, cabinKey({ vS: 0.19, vP: 0.07, trimH: 0.025, zC: -0.82, trim: [matte, CB], pillar: [gloss, CB], bpil: [gloss, CB], glass: [sglass, 0x8fa3b3], roof: [gloss, CB], zRF: 0.15, zRR: -0.85, rear: [sglass, 0x8fa3b3] }));
    for (const s of [1, -1]) {
      // 전조등: 코 위 모서리를 따라 가는 빛 줄 + 앞면 송곳니
      curve(glow, [0, 1, 2, 3, 4, 5].map((k) => { const z = 2.28 - k * 0.075, x = 0.36 + k * 0.095; return [s * x, B.topY(z, x) + 0.006, z]; }), 0.011, G);
      glow.box(s * 0.5, 0.3, 2.405, s * 0.58, 0.42, 2.415, G);
      // 옆 흡입구 위 날(탄소) + 빛 줄, 바닥 조명
      curve(glow, [-0.95, -0.75, -0.55, -0.35].map((z) => { const y = 0.665 + (z + 0.68) * 0.546; return [s * (B.sideX(z, y) + 0.006), y, z]; }), 0.007, G);   // 흡입구 윗날을 따라
      curve(glow, [-0.9, -0.3, 0.3, 0.9].map((z) => [s * (B.sideX(z, 0.3) + 0.02), 0.205, z]), 0.008, G);
      matte.box(s * (B.sideX(0, 0.3) - 0.02), 0.19, -0.95, s * (B.sideX(0, 0.3) + 0.05), 0.225, 0.95, CB);   // 옆 스커트 날
      mirror(gloss, s, Cb.wc(0.62) - 0.02, Cb.base(0.62) + 0.09, 0.62, P);
      // 뒷날개 기둥
      tube(matte, [s * 0.42, B.topY(-2.02, 0.42) - 0.01, -2.02], [s * 0.42, 1.27, -2.12], 0.022, CB, 6);
      matte.box(s * 0.965, 1.13, -2.38, s * 1.0, 1.37, -1.94, CB);                       // 날개 끝판
      // 후미등: 가로 빛 띠 + 양 끝 세로
      tail.box(s * 0.72, 0.6, -2.354, s * 0.76, 0.8, -2.346, 0);
      // 엔진 덮개 루버
      for (let k = 0; k < 6; k++) { const z = -1.98 + k * 0.07; matte.box(s * 0.1, B.topY(z, 0.3) - 0.004, z - 0.012, s * 0.48, B.topY(z, 0.3) + 0.006, z + 0.012, CB, -0.35); }
    }
    tail.box(-0.76, 0.77, -2.355, 0.76, 0.8, -2.346, 0);
    glow.box(-0.6, 0.52, -2.355, 0.6, 0.535, -2.347, G);
    // 앞 스플리터 · 디퓨저 지느러미 · 배기구
    matte.box(-0.76, 0.17, 2.12, 0.76, 0.2, 2.44, CB);
    for (let i = -3; i <= 3; i++) matte.box(i * 0.13 - 0.008, 0.19, -2.36, i * 0.13 + 0.008, 0.38, -2.0, CB);
    for (const x of [-0.1, 0.1]) { const ex = new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14); ex.rotateX(Math.PI / 2); chrome.add(ex, mtx(x, 0.46, -2.33), 0xb8bdc1); }
    // 큰 뒷날개: 주 날개 + 위 보조 날개
    gloss.box(-0.98, 1.265, -2.3, 0.98, 1.3, -1.98, P, -0.08);
    matte.box(-0.96, 1.315, -2.36, 0.96, 1.33, -2.2, CB, -0.32);
    interior(matte, 0x141416, true, 1.12, { dashW: 0.5, dashY: 0.84, rearW: 0.48, rearH: 0.86 });
    calipers(matte, wheels, WW, G);
    return { gloss, matte, sglass, lamp, tail, chrome, glow, wheel: tireGeo(WR, WW), rim: rimGeo2(WR, WW, { n: 7, c: 0x17181a, lip: 0x2a2c2f, wd: 0.03 }), wheels, wr: WR };
  }

  // ---------- 스포츠카(스트라이커 GT): 미드십 쿠페 · 바퀴 위로 볼록한 앞뒤 펜더 · 옆 공기 흡입 · 날카로운 LED · 덕테일 ----------
  //  v20 수정: 차체 선을 거의 수평으로(뒤 0.95 → 문 0.86 → 앞 펜더 0.94), 앞 끝만 둥글게 내려감
  function buildSport(sk) {
    const P = sk.paint, K = 0x111214, gloss = new VB(), matte = new VB(), sglass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB();
    const WR = 0.37, WW = 0.3, WX = 0.84, wheels = [[WX, WR, 1.42, 1], [-WX, WR, 1.42, 1], [WX, WR, -1.36, 0], [-WX, WR, -1.36, 0]];
    const B = makeBody({ z0: -2.3, z1: 2.36,
      hw: [[-2.3, 0.84], [-2.12, 0.93], [-1.9, 0.97], [-1.35, 0.99], [-0.6, 0.93], [0.4, 0.9], [1.0, 0.93], [1.42, 0.96], [2.0, 0.9], [2.22, 0.8], [2.36, 0.7]],
      y0: [[-2.3, 0.32], [-2.12, 0.26], [-1.9, 0.24], [2.0, 0.23], [2.36, 0.28]],
      y1: [[-2.3, 0.88], [-2.1, 0.93], [-1.7, 0.95], [-1.36, 0.95], [-0.8, 0.9], [-0.2, 0.86], [0.6, 0.86], [1.0, 0.89], [1.42, 0.94], [1.9, 0.86], [2.2, 0.74], [2.36, 0.62]],
      valley: [[-2.3, 0.02], [-1.5, 0.04], [-0.6, 0.02], [0.6, 0.04], [1.1, 0.11], [1.8, 0.12], [2.36, 0.06]],
      n: [[-2.3, 4.6], [-1.9, 3.7], [0, 3.6], [2.0, 3.3], [2.36, 3.3]], tb: 0.2, mid: 0.38,
      dents: [{ z: -0.72, y: 0.6, rz: 0.36, ry: 0.15, a: 0.12, d: 0.07 }],   // 뒷바퀴 앞 공기 흡입구
      wheels: [archW(1.42, WR, WR, WX, WW), archW(-1.36, WR, WR, WX, WW)] });
    const col = (x, y, z) => {
      const ax = Math.abs(x);
      if (y < 0.29) return K;                                        // 스커트·바닥
      if (z > 2.1 && y < 0.44 && ax < 0.7) return 0x0b0b0c;           // 앞 흡입구
      return P;
    };
    loftBody(B, gloss, col); dentHoles(B, matte);
    const Cb = makeCabin(B, { z0: -1.8, z1: 1.08, n: 2.9, tb: 0.1,
      wc: [[-1.8, 0.56], [-1.25, 0.7], [-0.35, 0.75], [0.5, 0.73], [1.08, 0.6]],
      roof: [[-1.8, 0.93], [-1.4, 1.12], [-0.95, 1.3], [-0.4, 1.39], [0.1, 1.38], [0.5, 1.22], [0.85, 1.02], [1.08, 0.86]] });
    loftCabin(Cb, cabinKey({ vS: 0.2, vP: 0.07, trimH: 0.025, zC: -0.95, zB: -0.62, bw: 0.05, trim: [matte, K], pillar: [gloss, P], bpil: [gloss, K], glass: [sglass, 0x8fa3b3], roof: [gloss, P], zRF: 0.15, zRR: -0.9 }));
    for (const s of [1, -1]) {
      // 날카로운 전조등: 코 위 모서리 LED 줄 두 개
      curve(lamp, [0, 1, 2, 3, 4].map((k) => { const z = 2.22 - k * 0.07, x = 0.42 + k * 0.1; return [s * x, B.topY(z, x) + 0.006, z]; }), 0.012, 0);
      curve(lamp, [0, 1, 2].map((k) => { const z = 2.3 - k * 0.04, x = 0.5 + k * 0.1; return [s * x, B.topY(z, x) - 0.03, z]; }), 0.008, 0);
      // 흡입구 위로 넘어오는 날(차체 색)
      curve(gloss, [-1.02, -0.85, -0.66, -0.45].map((z) => { const y = 0.75 - (z + 0.45) * 0.08; return [s * (B.sideX(z, y) + 0.004), y, z]; }), 0.016, P);
      mirror(gloss, s, Cb.wc(0.6) - 0.02, Cb.base(0.6) + 0.09, 0.6, P);
      // 가는 후미등: 위 띠 + 바깥 꺾임
      tail.box(s * 0.36, 0.78, -2.314, s * 0.7, 0.805, -2.306, 0);
      tail.box(s * 0.68, 0.68, -2.314, s * 0.71, 0.805, -2.306, 0);
      // 쌍 배기구(가운데)
      const ex = new THREE.CylinderGeometry(0.042, 0.042, 0.1, 14); ex.rotateX(Math.PI / 2); chrome.add(ex, mtx(s * 0.12, 0.4, -2.29), 0xc8ccd0);
      // 레이싱 줄(보닛·트렁크 덮개)
      if (sk.accent !== undefined) { topStrip(gloss, B, s * 0.06, s * 0.17, 1.1, 2.24, sk.accent); topStrip(gloss, B, s * 0.06, s * 0.17, -2.2, -1.84, sk.accent, 6); }
    }
    // 덕테일 · 앞 스플리터 · 디퓨저
    gloss.box(-0.7, B.topY(-2.2, 0) - 0.01, -2.3, 0.7, B.topY(-2.2, 0) + 0.035, -2.12, P, 0.3);
    matte.box(-0.68, 0.2, 2.1, 0.68, 0.23, 2.37, K);
    for (let i = -2; i <= 2; i++) matte.box(i * 0.16 - 0.008, 0.22, -2.31, i * 0.16 + 0.008, 0.36, -2.04, K);
    interior(matte, 0x2a1414, true, 1.16, { dashW: 0.56, dashY: 0.86, rearW: 0.5, rearH: 0.9 });
    calipers(matte, wheels, WW, sk.caliper || 0xd01818);
    return { gloss, matte, sglass, lamp, tail, chrome, wheel: tireGeo(WR, WW), rim: rimGeo2(WR, WW, { n: 5, twin: true, c: 0x161719, lip: 0x2b2d30 }), wheels, wr: WR };
  }

  // ---------- 럭셔리카(엠버서더 L): 긴 보닛의 3박스 세단 · 곧게 선 세로 크롬 그릴 · 크롬 창틀 · 넓은 C 필러 · 가로 빛 띠 ----------
  function buildLux(sk) {
    const P = sk.paint, RF = sk.roof !== undefined ? sk.roof : P, CR = 0xe3e7ea, gloss = new VB(), matte = new VB(), sglass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB();
    const WR = 0.39, WW = 0.27, WX = 0.8, wheels = [[WX, WR, 1.5, 1], [-WX, WR, 1.5, 1], [WX, WR, -1.48, 0], [-WX, WR, -1.48, 0]];
    const B = makeBody({ z0: -2.36, z1: 2.4,
      hw: [[-2.36, 0.84], [-2.15, 0.91], [-1.4, 0.94], [0, 0.93], [1.5, 0.93], [2.12, 0.9], [2.4, 0.81]],
      y0: [[-2.36, 0.38], [-2.15, 0.32], [-2.0, 0.3], [2.0, 0.3], [2.4, 0.36]],
      y1: [[-2.36, 0.94], [-2.1, 0.99], [-1.3, 1.0], [-0.2, 0.97], [1.2, 0.96], [2.0, 0.91], [2.4, 0.84]],
      n: [[-2.36, 4.6], [-2.0, 3.8], [0, 3.6], [2.0, 3.8], [2.4, 4.6]], tb: 0.14, mid: 0.44,
      wheels: [archW(1.5, WR, WR, WX, WW), archW(-1.48, WR, WR, WX, WW)].map((w) => Object.assign(w, { flare: 0.01 })) });   // 펜더는 얌전하게
    loftBody(B, gloss, (x, y) => (y < 0.37 ? 0x0d0e0f : P));
    const Cb = makeCabin(B, { z0: -1.78, z1: 1.05, n: 3.0, tb: 0.16,
      wc: [[-1.78, 0.72], [-1.3, 0.84], [0, 0.86], [0.6, 0.84], [1.05, 0.72]],
      roof: [[-1.78, 0.96], [-1.45, 1.24], [-1.08, 1.43], [-0.3, 1.49], [0.3, 1.47], [0.72, 1.28], [1.05, 0.95]] });
    loftCabin(Cb, cabinKey({ vS: 0.21, vP: 0.06, trimH: 0.03, zC: -1.12, zB: -0.3, bw: 0.045, trim: [chrome, CR], pillar: [gloss, P], bpil: [gloss, 0x0b0b0c], glass: [sglass, 0x8a9aa6], roof: [gloss, RF], zRF: 0.44, zRR: -1.12 }));
    const fz = B.z1 + 0.012;
    // 곧게 선 그릴: 크롬 테 + 어두운 바탕 + 세로 크롬 살 13개
    chrome.box(-0.32, 0.44, fz, 0.32, 0.81, fz + 0.03, CR);
    matte.box(-0.29, 0.47, fz + 0.026, 0.29, 0.78, fz + 0.034, 0x0b0c0d);
    for (let i = -6; i <= 6; i++) chrome.box(i * 0.045 - 0.006, 0.48, fz + 0.03, i * 0.045 + 0.006, 0.77, fz + 0.046, CR);
    chrome.add(new THREE.OctahedronGeometry(0.03, 0), mtx(0, B.topY(2.28, 0) + 0.03, 2.28, 0, 0, 0, 0.7, 1.2, 0.5), CR);   // 보닛 장식(추상 다이아몬드)
    matte.box(-0.6, 0.36, fz, 0.6, 0.42, fz + 0.02, 0x0b0c0d);                                                   // 아래 흡입구
    for (const s of [1, -1]) {
      lamp.box(s * 0.36, 0.74, fz - 0.005, s * 0.72, 0.77, fz + 0.012, 0, 0, s * 0.12, 0);    // 가늘고 긴 전조등 (바깥쪽이 뒤로)
      lamp.box(s * 0.7, 0.44, fz - 0.03, s * 0.725, 0.68, fz - 0.005, 0);                     // 세로 주간등
      curve(chrome, [-1.9, -1.0, 0, 1.0, 1.9].map((z) => [s * (B.sideX(z, 0.44) + 0.004), 0.44, z]), 0.008, CR);   // 옆 크롬 몰딩
      for (const z of [0.38, -0.72]) chrome.box(s * (B.sideX(z, 0.88) + 0.002), 0.87, z - 0.09, s * (B.sideX(z, 0.88) + 0.018), 0.89, z + 0.09, CR);   // 문 손잡이
      mirror(gloss, s, Cb.wc(0.66) - 0.02, Cb.base(0.66) + 0.09, 0.66, P);
    }
    // 뒤: 가로 빛 띠 + 크롬 띠
    tail.box(-0.72, 0.86, -2.374, 0.72, 0.9, -2.366, 0);
    chrome.box(-0.6, 0.6, -2.375, 0.6, 0.62, -2.366, CR);
    chrome.box(-0.74, 0.44, -2.375, 0.74, 0.455, -2.36, CR);   // 뒤 범퍼 가는 크롬 띠
    interior(matte, 0xc9b79a, true, 1.28);
    calipers(matte, wheels, WW, 0x2a2c2f);
    return { gloss, matte, sglass, lamp, tail, chrome, wheel: tireGeo(WR, WW), rim: rimGeo2(WR, WW, { n: 16, c: 0xd8dcdf, lip: CR, wd: 0.02, blade: 0.5 }), wheels, wr: WR };
  }
  // ---------- 오토바이 스킨 ----------
  // 핸들 손잡이·앞바퀴 축은 기본 오토바이와 같은 자리 (운전 자세가 맞도록)
  function buildMotoSkin(sk, style) {
    const P = sk.paint, P2 = sk.paint2, FR = 0x1d1e20, paint = new VB(), matte = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB(), glass = new VB(), gloss = new VB();
    const st = { pivot: [0, 0.98, 0.52], paint: new VB(), matte: new VB(), lamp: new VB(), chrome: new VB(), glass: new VB() };
    // 공통 프레임·엔진
    tube(matte, [0, 0.98, 0.5], [0, 0.46, -0.08], 0.035, FR); tube(matte, [0, 0.98, 0.5], [0, 0.86, -0.35], 0.03, FR); tube(matte, [0, 0.46, -0.08], [0, 0.86, -0.35], 0.03, FR);
    for (const s of [1, -1]) tube(matte, [s * 0.085, 0.46, -0.1], [s * 0.085, 0.32, -0.7], 0.028, FR);
    for (const s of [1, -1]) tube(st.chrome, [s * 0.085, 0.0, 0.0], [s * 0.085, -0.65, 0.22], 0.03, 0xe0e4e7);
    st.matte.box(-0.11, -0.05, -0.04, 0.11, 0.04, 0.06, FR);
    tube(st.chrome, [-0.36, 0.17, -0.1], [0.36, 0.17, -0.1], 0.017, 0xd0d4d7);
    for (const s of [1, -1]) tube(st.matte, [s * 0.36, 0.17, -0.1], [s * 0.27, 0.17, -0.1], 0.026, 0x111111);
    tube(st.matte, [-0.06, 0.04, 0.0], [-0.08, 0.17, -0.08], 0.018, FR); tube(st.matte, [0.06, 0.04, 0.0], [0.08, 0.17, -0.08], 0.018, FR);
    if (style === 'racer') {
      // 앞 카울(프레임 고정) + 투명 스크린 + 두 눈 전조등
      ball(paint, 0, 0.98, 0.66, 0.2, 0.2, 0.2, P, 14);
      paint.box(-0.2, 0.62, 0.42, 0.2, 0.96, 0.72, P, 0.35);
      glass.add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mtx(0, 1.06, 0.62, -0.6, 0, 0, 1, 0.9, 0.6), 0xffffff);
      for (const s of [1, -1]) lamp.box(s * 0.04, 0.9, 0.84, s * 0.13, 0.95, 0.86, 0);
      // 옆 카울(흰 줄) + 배 덮개
      for (const s of [1, -1]) { paint.box(s * 0.15, 0.34, -0.25, s * 0.2, 0.8, 0.4, P, 0.15); gloss.box(s * 0.2, 0.5, -0.1, s * 0.205, 0.56, 0.38, P2, 0.15); }
      paint.box(-0.17, 0.22, -0.2, 0.17, 0.34, 0.3, P);
      matte.box(-0.15, 0.32, -0.1, 0.15, 0.62, 0.3, 0x55595d);
      // 탱크·짧고 높은 꼬리·좌석
      ball(paint, 0, 0.95, 0.2, 0.18, 0.12, 0.28, P, 14); gloss.box(-0.04, 1.05, 0.02, 0.04, 1.07, 0.42, P2);
      paint.box(-0.12, 0.88, -0.95, 0.12, 1.04, -0.5, P, -0.35); gloss.box(-0.125, 0.9, -0.95, 0.125, 0.94, -0.52, P2, -0.35);
      matte.box(-0.13, 0.9, -0.55, 0.13, 0.98, 0.0, 0x161617);
      tail.box(-0.07, 0.98, -1.0, 0.07, 1.02, -0.97, 0);
      // 짧은 배기(엔진 아래 → 오른쪽 위)
      tube(chrome, [0.12, 0.3, 0.0], [0.2, 0.55, -0.62], 0.05, 0xb8bdc1);
      st.paint.box(-0.075, -0.33, 0.12, 0.075, -0.28, 0.46, P, -0.45);
    } else {
      // 크루저: 크롬 V형 엔진, 물방울 탱크, 넓은 뒤 흙받이, 낮은 1인 좌석, 굵은 크롬 배기 2개, 큰 둥근 전조등
      for (const a of [0.45, -0.45]) { const cy = new THREE.CylinderGeometry(0.075, 0.085, 0.3, 14); chrome.add(cy, mtx(0, 0.52, 0.06 + a * 0.12, a, 0, 0), 0xd6dadd); for (let i = 0; i < 5; i++) chrome.add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 14), mtx(0, 0.47 + i * 0.03, 0.06 + a * 0.12 + Math.sin(a) * i * 0.03, a, 0, 0), 0xe6e9eb); }
      matte.box(-0.12, 0.3, -0.15, 0.12, 0.44, 0.25, 0x2a2b2d);
      ball(gloss, 0, 0.93, 0.22, 0.16, 0.12, 0.3, P, 16); gloss.box(-0.02, 1.04, 0.0, 0.02, 1.05, 0.45, P2);
      matte.box(-0.15, 0.8, -0.62, 0.15, 0.88, -0.05, 0x2a1810);
      gloss.add(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16, 1, true, -Math.PI * 0.1, Math.PI * 0.75), mtx(0, 0.36, -0.72, 0, 0, Math.PI / 2), P);
      for (const y of [0.3, 0.4]) tube(chrome, [0.16, y, 0.15], [0.22, y + 0.06, -1.05], 0.045, 0xd6dadd);
      st.chrome.add(new THREE.SphereGeometry(0.11, 14, 10), mtx(0, 0.0, 0.14, 0, 0, 0, 1, 1, 0.75), 0xd6dadd);
      st.lamp.add(new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16).rotateX(Math.PI / 2), mtx(0, 0.0, 0.225), 0);
      st.paint.add(new THREE.CylinderGeometry(0.36, 0.36, 0.15, 18, 1, true, -Math.PI * 0.05, Math.PI * 0.55), mtx(0, -0.66, 0.22, 0, 0, Math.PI / 2), P);
      tail.box(-0.07, 0.58, -0.93, 0.07, 0.63, -0.9, 0);
    }
    return { paint, matte, lamp, tail, chrome, glass, gloss, steer: st, wheel: wheelGeo(0.33, style === 'cruiser' ? 0.16 : 0.14, 0x222426, 0, 0x151515), rim: rimGeo(0.33, style === 'cruiser' ? 0.16 : 0.14, style === 'cruiser' ? 12 : 5, true),
      wheels: [[0, 0.33, 0.74, 1], [0, 0.32, -0.7, 0]], wr: 0.33 };
  }
  // ---------- 말 스킨: 털 색·갈기·마구 ----------
  const HORSE = {
    white: { coat: 0xe3dfd6, belly: 0xd4cfc4, dark: 0xd8d4cc, muzzle: 0x9a9088, hoof: 0x5a554e, fetlock: 0xcac4b8, cloth: 0x274a7a, leath: 0x2a2018, metal: 0xd6dadd, bridle: 0x2a2018, trim: 0xd6dadd },
    black: { coat: 0x1d1a18, belly: 0x171513, dark: 0x0a0908, muzzle: 0x2a2522, hoof: 0x1a1816, fetlock: 0x151312, cloth: 0x5a1012, leath: 0x1a1210, metal: 0xd8b04a, bridle: 0x120d0b, trim: 0xd8b04a },
  };
  for (const [id, sk] of Object.entries(VSKINS)) {
    if (sk.cls === 'sport') VehModels.register(id, () => buildSport(sk));
    else if (sk.cls === 'lux') VehModels.register(id, () => buildLux(sk));
    else if (sk.cls === 'hyper') VehModels.register(id, () => buildHyper(sk));
    else if (sk.cls === 'racer' || sk.cls === 'cruiser') VehModels.register(id, () => buildMotoSkin(sk, sk.cls));
    else if (sk.veh === 'horse') VehModels.register(id, () => K.buildHorse(HORSE[sk.cls]));
  }
})();
