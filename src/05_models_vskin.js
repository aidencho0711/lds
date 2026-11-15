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
  // EPSILON VEHICLE COLLECTION (v20) — 엡실론 금고(0.1%) · 교환소(차량 교환 코인 400). 기본 SUV(UAZ)에 적용, 성능은 그대로
  uaz_imperial: { veh: 'uaz', cls: 'imperial', name: 'IMPERIAL X-01', rar: 7, eps: 1, no: 'V001', box: 'eps', price: 400, eng: 'imperial', paint: 0x0b0c0f, ti: 0xa9adb3, gold: 0xc9a24a, navy: 0x141c33,
    desc: '미래의 최상위 VIP를 위해 만든 초고급 전천후 퍼포먼스 SUV. 옵시디언 블랙 · 티타늄 실버 · 임페리얼 골드 · 미드나이트 네이비' },
  sedan_aurelion: { veh: 'sedan', cls: 'aurelion', name: 'AURELION GT', rar: 7, eps: 1, no: 'V002', box: 'eps', price: 400, eng: 'aurelion', paint: 0xc9cdd3, gold: 0xd8c08a,
    desc: '낮고 날렵한 하이퍼 GT. 리퀴드 실버와 샴페인 골드, 고속에서 솟아오르는 액티브 리어 윙' },
  pickup_titan: { veh: 'pickup', cls: 'titan', name: 'TITAN VANGUARD', rar: 7, eps: 1, no: 'V003', box: 'eps', price: 400, eng: 'titan', paint: 0x464a50, ti: 0xa9adb3, accent: 0xc46a2a,
    desc: '묵직하고 웅장한 럭셔리 오프로드. 티타늄과 건메탈, 지붕 LED 바와 비드록 휠' },
  // 크리스마스 상자 (v20, box 'xmas'): 교환소에는 없음
  moto_cruiser_xmas: { veh: 'moto', cls: 'cruiser', name: '크루저 · 캔디 레드', rar: 3, price: 15, box: 'xmas', paint: 0xc8141e, paint2: 0xf4f0e8 },
  sedan_gt_xmas: { veh: 'sedan', cls: 'sport', name: '스트라이커 GT · 홀리 그린', rar: 4, price: 30, box: 'xmas', paint: 0x1d5a33, accent: 0xc8202e },
  sedan_hyper_xmas: { veh: 'sedan', cls: 'hyper', name: '펄스 X9 · 프로스트', rar: 5, price: 50, box: 'xmas', paint: 0xe8f2f8, glow: 0x9fe8ff, carbon: 0x1a2a3a },
  uaz_sleigh: { veh: 'uaz', cls: 'sleigh', name: 'RUDOLPH EXPRESS', rar: 8, no: 'X4', box: 'xmas', price: 400, eng: 'sleigh',
    desc: '루돌프가 끄는 산타 썰매 — 달리면 루돌프가 다리를 움직이고 코가 빛나며, 썰매 날에서 금빛 가루와 방울 소리' },
  sedan_sovereign: { veh: 'sedan', cls: 'sovereign', name: 'SOVEREIGN ECLIPSE', rar: 7, eps: 1, no: 'V004', box: 'eps', price: 400, eng: 'sovereign', paint: 0x17141d, silver: 0xb9bec6,
    desc: '길고 우아한 초호화 의전 세단. 블랙 펄과 실버 투톤, 솟아오르는 보닛 장식과 이클립스 원형 등' },
};
const VEH_SKIN_TYPES = { sedan: '승용차', uaz: 'SUV', pickup: '픽업트럭', moto: '오토바이', horse: '말' };
const VCLS_NAME = { sleigh: '산타 썰매', imperial: '럭셔리 퍼포먼스 SUV', aurelion: '하이퍼카', titan: '럭셔리 오프로드', sovereign: '초호화 세단', sport: '스포츠카', lux: '럭셔리카', hyper: '하이퍼카', racer: '오토바이', cruiser: '오토바이', white: '말', black: '말' };
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
  // ---------- 엡실론 IMPERIAL X-01 (EP-V001): 초고급 퍼포먼스 SUV — UAZ 자리(좌석·바퀴 축·충돌)에 겉모습만 바꿈 ----------
  //  옵시디언 블랙 차체 · 티타늄 실버 장식(그릴 테·캐릭터 라인·창틀·루프 레일·배기구) · 임페리얼 골드는 엠블럼·휠 테·대시 선에만 아껴 씀
  //  미드나이트 네이비 실내 포인트·유리 틴트 · 문 아래·범퍼 아래 카본 · 날카로운 5칸 LED 헤드램프 · 좌우를 잇는 테일램프 띠 · 사각 배기구 · 파노라마 지붕
  //  fx(차량마다 따로 빛나는 부분, 08_vehicle_eps.js 가 시동·주행·정차 연출): hl0~hl4 헤드램프 칸(안쪽→바깥) · emb 엠블럼 · tail 테일 띠 · brake 브레이크 · amb 실내 앰비언트
  //  실제 자동차 회사의 이름·로고·모양은 쓰지 않는다 (장르 특징만)
  function rimImperial(r, w) {
    const vb = new VB(), ri = r * 0.7, rh = r * 0.19, SP = 0x34373c, GD = 0xd8b45a;
    for (const sd of [1, -1]) {
      const x0 = sd * w * 0.42;
      const lip = new THREE.TorusGeometry(ri * 0.985, 0.012, 5, 30); lip.rotateY(Math.PI / 2); vb.add(lip, mtx(x0, 0, 0), GD);            // 골드 테
      const back = new THREE.CircleGeometry(ri * 0.97, 26); back.rotateY(sd * Math.PI / 2); vb.add(back, mtx(sd * w * 0.18, 0, 0), 0x0b0b0c);
      const hub = new THREE.CylinderGeometry(rh, rh * 1.08, 0.03, 16); hub.rotateZ(Math.PI / 2); vb.add(hub, mtx(x0, 0, 0), SP);
      // 가운데 캡: 골드 마름모 엠블럼(바퀴와 함께 돎) + 네이비 속
      const cap = new THREE.CylinderGeometry(rh * 0.62, rh * 0.62, 0.012, 4); cap.rotateZ(Math.PI / 2); vb.add(cap, mtx(x0 + sd * 0.016, 0, 0), GD);
      const capIn = new THREE.CylinderGeometry(rh * 0.36, rh * 0.36, 0.012, 4); capIn.rotateZ(Math.PI / 2); vb.add(capIn, mtx(x0 + sd * 0.019, 0, 0), 0x141c33);
      // 바퀴살 10개 (얇은 쌍살, 끝이 넓어짐) — 다크 티타늄
      for (let i = 0; i < 10; i++) {
        const a0 = i / 10 * TAU;
        for (const off of [-0.07, 0.07]) {
          const g = new THREE.BoxGeometry(0.02, ri - rh, 0.022); g.translate(x0 - sd * 0.006, (ri + rh) / 2, 0); g.rotateX(a0 + off); vb.add(g, null, SP);
        }
      }
    }
    return vb.build();
  }
  function buildImperial(sk) {
    const BK = sk.paint, TI = sk.ti, GD = sk.gold, NV = sk.navy, CB = 0x15171a, DK = 0x0a0a0c, SEAT = 0x111215, GL = 0x3e4a62;
    const gloss = new VB(), matte = new VB(), sglass = new VB(), chrome = new VB();
    const fx = { hl0: new VB(), hl1: new VB(), hl2: new VB(), hl3: new VB(), hl4: new VB(), emb: new VB(), tail: new VB(), brake: new VB(), amb: new VB() };
    const HLC = 0xeaf4ff, EMB = 0xffd27a, RED = 0xff2030, AMB = 0xffc864;
    const WR = 0.46, WW = 0.32, WX = 0.84, ZF = 1.25, ZR = -1.2, wheels = [[WX, WR, ZF, 1], [-WX, WR, ZF, 1], [WX, WR, ZR, 0], [-WX, WR, ZR, 0]];
    const arF = archW(ZF, WR, WR, WX, WW), arR = archW(ZR, WR, WR, WX, WW); arF.flare = arR.flare = 0.032;
    const B = makeBody({ z0: -2.2, z1: 2.26,
      hw: [[-2.2, 0.88], [-2.02, 0.95], [-1.6, 0.99], [-1.2, 1.0], [-0.6, 0.97], [0.3, 0.96], [0.9, 0.99], [1.25, 1.0], [1.7, 0.98], [2.05, 0.94], [2.26, 0.88]],
      y0: [[-2.2, 0.5], [-1.98, 0.4], [-1.6, 0.36], [1.6, 0.36], [1.98, 0.38], [2.26, 0.42]],
      y1: [[-2.2, 1.14], [-2.0, 1.2], [-1.5, 1.23], [-0.5, 1.2], [0.6, 1.17], [1.0, 1.15], [1.5, 1.12], [1.9, 1.08], [2.1, 1.04], [2.26, 0.99]],
      valley: [[-2.2, 0], [0.9, 0], [1.2, -0.022], [1.9, -0.022], [2.26, 0]],
      n: [[-2.2, 4.4], [-1.9, 3.8], [0, 3.6], [1.9, 3.8], [2.26, 4.6]], tb: 0.12, mid: 0.42,
      wheels: [arF, arR] });
    // 차체 색: 아래(스커트·범퍼 아래)와 문 아래 띠는 카본, 나머지는 옵시디언 블랙
    const col = (x, y, z) => { const ax = Math.abs(x); if (y < 0.46) return CB; if (ax > 0.5 && y < 0.6 && z > -1.75 && z < 1.75) return CB; return BK; };
    loftBody(B, gloss, col);
    const side = (z, y, d = 0.004) => B.sideX(z, y) + d;
    // ----- 앞: 넓은 그릴(티타늄 테 · 가로 살) · 그릴 엠블럼 · 5칸 LED 헤드램프 · 카본 립과 옆 공기 커튼 -----
    const ZF0 = 2.282;
    matte.box(-0.56, 0.52, ZF0 - 0.02, 0.56, 0.84, ZF0, DK);
    for (let i = 0; i < 6; i++) { const y = 0.552 + i * 0.05; matte.box(-0.535, y, ZF0, 0.535, y + 0.011, ZF0 + 0.012, 0x2a2c31); }
    for (let i = -6; i <= 6; i++) matte.box(i * 0.08 - 0.0035, 0.53, ZF0 - 0.004, i * 0.08 + 0.0035, 0.83, ZF0 + 0.008, 0x1b1c20);
    chrome.box(-0.6, 0.836, ZF0 - 0.01, 0.6, 0.862, ZF0 + 0.02, TI); chrome.box(-0.6, 0.498, ZF0 - 0.01, 0.6, 0.524, ZF0 + 0.02, TI);
    for (const s of [1, -1]) chrome.box(s * 0.572, 0.498, ZF0 - 0.01, s * 0.6, 0.862, ZF0 + 0.02, TI);
    // 그릴 가운데 엠블럼: 골드 마름모 테 + 빛나는 속
    chrome.box(-0.058, 0.632, ZF0 + 0.012, 0.058, 0.748, ZF0 + 0.03, GD, 0, 0, Math.PI / 4);
    fx.emb.box(-0.036, 0.654, ZF0 + 0.024, 0.036, 0.726, ZF0 + 0.036, EMB, 0, 0, Math.PI / 4);
    // 헤드램프: 바깥으로 갈수록 살짝 올라가는 다섯 칸 + 바깥 끝의 아래로 꺾인 송곳니 · 어두운 하우징
    for (const s of [1, -1]) {
      matte.box(s * 0.25, 0.874, ZF0 - 0.012, s * 0.7, 0.978, ZF0 + 0.004, 0x101114, 0, 0, s * 0.12);
      for (let i = 0; i < 4; i++) { const x = 0.33 + i * 0.09, y = 0.9 + i * 0.011; fx['hl' + i].box(s * (x - 0.04), y - 0.012, ZF0, s * (x + 0.04), y + 0.012, ZF0 + 0.012, HLC, 0, 0, s * 0.12); }
      fx.hl3.box(s * 0.655, 0.83, ZF0, s * 0.672, 0.92, ZF0 + 0.012, HLC, 0, 0, s * 0.25);
      // 모서리를 감아 옆으로 이어지는 빛 줄 (hl4)
      curve(fx.hl4, [2.18, 2.12, 2.06, 2.0].map((z, k) => [s * side(z, 0.94 + k * 0.004, 0.006), 0.94 + k * 0.004, z]), 0.008, HLC);
      // 아래 옆 공기 커튼(세로 홈 + 티타늄 날)
      matte.box(s * 0.62, 0.44, ZF0 - 0.02, s * 0.78, 0.62, ZF0 + 0.002, DK);
      chrome.box(s * 0.612, 0.43, ZF0 - 0.01, s * 0.624, 0.63, ZF0 + 0.012, TI);
    }
    matte.box(-0.8, 0.355, 2.14, 0.8, 0.39, 2.3, CB);                                       // 카본 립
    chrome.box(-0.5, 0.405, ZF0 - 0.012, 0.5, 0.418, ZF0 + 0.01, TI);
    // 후드: 가운데 입체 EPSILON 엠블럼(골드 마름모 + 빛나는 속) · 티타늄 가는 선 두 줄
    { const z = 1.98, y = B.topY(z, 0) + 0.01;
      chrome.box(-0.055, y - 0.006, z - 0.055, 0.055, y + 0.012, z + 0.055, GD, 0, Math.PI / 4, 0);
      matte.box(-0.04, y + 0.004, z - 0.04, 0.04, y + 0.016, z + 0.04, NV, 0, Math.PI / 4, 0);
      fx.emb.box(-0.022, y + 0.014, z - 0.022, 0.022, y + 0.02, z + 0.022, EMB, 0, Math.PI / 4, 0); }
    topStrip(chrome, B, 0.2, 0.215, 1.15, 2.1, TI); topStrip(chrome, B, -0.215, -0.2, 1.15, 2.1, TI);
    // ----- 옆: 티타늄 캐릭터 라인 · 문 아래 티타늄 선 · 매립 손잡이 · 앞바퀴 뒤 공기 배출구 -----
    for (const s of [1, -1]) {
      curve(chrome, [1.95, 1.5, 0.9, 0.2, -0.5, -1.2, -1.75, -2.0].map((z) => [s * side(z, 1.0), 1.0, z]), 0.006, TI);
      curve(chrome, [1.55, 0.8, 0, -0.8, -1.55].map((z) => [s * side(z, 0.61), 0.61, z]), 0.005, TI);
      for (const z of [0.42, -0.62]) chrome.box(s * side(z, 1.07, 0), 1.06, z - 0.08, s * side(z, 1.07, 0.012), 1.082, z + 0.08, TI);
      matte.box(s * side(0.66, 0.82, -0.012), 0.74, 0.58, s * side(0.66, 0.82, 0.008), 0.9, 0.74, DK);
      chrome.box(s * side(0.66, 0.82, 0.006), 0.81, 0.57, s * side(0.66, 0.82, 0.014), 0.825, 0.75, TI);
      // 옆 스커트 날(카본) + 티타늄 끝
      matte.box(s * side(0, 0.42, -0.03), 0.37, -0.75, s * side(0, 0.42, 0.04), 0.405, 0.72, CB);
    }
    // ----- 그린하우스: 빠르게 누운 앞유리 · 티타늄 창틀 · 블랙 필러 · 파노라마 유리 지붕 · 티타늄 루프 레일 -----
    const Cb = makeCabin(B, { z0: -1.98, z1: 1.0, n: 4.6, tb: 0.14,
      wc: [[-1.98, 0.8], [-1.6, 0.88], [-0.6, 0.9], [0.4, 0.89], [1.0, 0.8]],
      roof: [[-1.98, 1.3], [-1.9, 1.7], [-1.6, 1.88], [-0.8, 1.95], [0.1, 1.95], [0.5, 1.84], [0.78, 1.55], [1.0, 1.25]] });
    const base = cabinKey({ vS: 0.2, vP: 0.06, trimH: 0.03, zC: -1.55, zB: -0.35, bw: 0.06, trim: [chrome, TI], pillar: [gloss, BK], bpil: [gloss, BK], glass: [sglass, GL], roof: [gloss, BK], zRF: 0.45, zRR: -1.7, rear: [sglass, GL] });
    loftCabin(Cb, (z, vv, dy) => (vv > 0.33 && z > -1.4 && z < 0.32 ? [sglass, 0x1e2638] : base(z, vv, dy)));
    for (const s of [1, -1]) {
      const rail = [-1.7, -1.2, -0.6, 0, 0.35].map((z) => { const [x, y] = Cb.pt(z, s > 0 ? 0.3 : 0.7); return [x, y + 0.028, z]; });
      curve(chrome, rail, 0.011, TI);
      for (const z of [-1.6, 0.25]) { const [x, y] = Cb.pt(z, s > 0 ? 0.3 : 0.7); tube(chrome, [x, y - 0.01, z], [x, y + 0.028, z], 0.01, TI, 5); }
      mirror(gloss, s, Cb.wc(0.82) - 0.02, Cb.base(0.82) + 0.1, 0.82, BK);
    }
    // 지붕 끝 작은 스포일러 + 그 아래 보조 브레이크등
    { const y = Cb.roof(-1.85); gloss.box(-0.62, y - 0.012, -2.0, 0.62, y + 0.012, -1.78, BK, 0.12); fx.brake.box(-0.32, y - 0.03, -2.0, 0.32, y - 0.012, -1.98, RED); }
    // ----- 뒤: 좌우를 잇는 테일램프 띠 · 브레이크 칸 · 작은 엠블럼 · 사각 배기구 · 카본 디퓨저 -----
    const ZR0 = -2.226;
    matte.box(-0.8, 0.982, ZR0 - 0.004, 0.8, 1.048, ZR0 + 0.008, DK);
    fx.tail.box(-0.77, 1.005, ZR0 - 0.012, 0.77, 1.022, ZR0 - 0.002, RED);
    for (const s of [1, -1]) { fx.tail.box(s * 0.72, 0.92, ZR0 - 0.012, s * 0.775, 1.04, ZR0 - 0.002, RED); fx.brake.box(s * 0.36, 0.988, ZR0 - 0.014, s * 0.68, 1.0, ZR0 - 0.004, RED); }
    chrome.box(-0.05, 0.85, ZR0 - 0.016, 0.05, 0.95, ZR0, GD, 0, 0, Math.PI / 4);           // 뒤 엠블럼
    fx.emb.box(-0.028, 0.872, ZR0 - 0.024, 0.028, 0.928, ZR0 - 0.012, EMB, 0, 0, Math.PI / 4);
    chrome.box(-0.62, 0.72, ZR0 - 0.008, 0.62, 0.732, ZR0 + 0.004, TI);
    matte.box(-0.84, 0.36, -2.26, 0.84, 0.5, -2.06, CB);
    for (let i = -3; i <= 3; i++) matte.box(i * 0.11 - 0.008, 0.36, -2.27, i * 0.11 + 0.008, 0.52, -2.1, CB);
    for (const s of [1, -1]) {
      chrome.box(s * 0.44, 0.4, -2.29, s * 0.66, 0.5, -2.18, TI);                                // 사각 배기구 (티타늄 테)
      matte.box(s * 0.455, 0.412, -2.296, s * 0.645, 0.488, -2.2, DK);
    }
    // ----- 실내: 블랙 나파 시트(퀼팅 선) · 카본 대시 + 골드 선 · X-01 스티어링 휠 · 골드 앰비언트 · 가운데 콘솔 -----
    for (const s of [1, -1]) {
      matte.box(s * 0.18, 0.8, -0.3, s * 0.66, 1.0, 0.24, SEAT);
      matte.box(s * 0.2, 0.98, -0.44, s * 0.64, 1.62, -0.3, SEAT, -0.1);
      matte.box(s * 0.3, 1.62, -0.46, s * 0.54, 1.76, -0.36, SEAT, -0.1);
      for (let k = 0; k < 5; k++) matte.box(s * 0.24, 1.08 + k * 0.1, -0.296 - k * 0.01, s * 0.6, 1.088 + k * 0.1, -0.29 - k * 0.01, 0x22262e, -0.1);
      matte.box(s * 0.2, 1.0, -0.31, s * 0.215, 1.6, -0.29, NV, -0.1); matte.box(s * 0.625, 1.0, -0.31, s * 0.64, 1.6, -0.29, NV, -0.1);   // 네이비 테두리
    }
    matte.box(-0.7, 0.8, -1.25, 0.7, 1.0, -0.72, SEAT); matte.box(-0.7, 0.98, -1.38, 0.7, 1.6, -1.25, SEAT, -0.12);
    for (let k = 0; k < 5; k++) matte.box(-0.66, 1.06 + k * 0.1, -1.246 - k * 0.012, 0.66, 1.068 + k * 0.1, -1.24 - k * 0.012, 0x22262e, -0.12);
    matte.box(-0.12, 0.8, -0.35, 0.12, 1.04, 0.62, CB); chrome.box(-0.124, 1.035, -0.3, 0.124, 1.042, 0.6, GD);
    matte.box(-0.7, 1.0, 0.6, 0.7, 1.17, 0.96, CB);
    chrome.box(-0.68, 1.118, 0.594, 0.68, 1.128, 0.602, GD);
    fx.amb.box(-0.68, 1.086, 0.592, 0.68, 1.094, 0.598, AMB);
    for (const s of [1, -1]) { const zs = [-1.35, -0.9, -0.3, 0.3, 0.55]; curve(fx.amb, zs.map((z) => [s * (Cb.wc(z) - 0.05), Cb.base(z) + 0.035, z]), 0.006, AMB); }
    // 스티어링 휠 (UAZ 와 같은 자리): 림 · 살 둘 · 가운데 X-01 골드 엠블럼
    matte.add(new THREE.TorusGeometry(0.19, 0.026, 6, 20), mtx(0.42, 1.28, 0.5, -0.65, 0, 0), 0x121315);
    for (const a of [0, Math.PI]) { const g = new THREE.BoxGeometry(0.16, 0.022, 0.02); g.translate(Math.cos(a) * 0.09, 0, 0); g.rotateX(-0.65); matte.add(g, mtx(0.42, 1.28, 0.5), 0x1c1d20); }
    { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.024, 4); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 4); g.rotateX(-0.65); chrome.add(g, mtx(0.42, 1.28, 0.5), GD); }
    calipers(chrome, wheels, WW, TI);
    return { gloss, matte, sglass, chrome, fx, wheel: tireGeo(WR, WW), rim: rimImperial(WR, WW), wheels, wr: WR,
      // 08_vehicle_eps.js 가 붙이는 것: 계기판·가운데 화면 · 바닥 조명 · 헤드램프 빛줄기 · 빠른 주행 잔상 자리
      efx: { kind: 'imperial', screens: [{ id: 'cluster', p: [0.42, 1.255, 0.735], w: 0.3, h: 0.11, rx: -0.42 }, { id: 'center', p: [0, 1.255, 0.75], w: 0.36, h: 0.15, rx: -0.38 }],
        under: { w: 2.1, l: 4.6 }, beams: [[0.5, 0.92, 2.29], [-0.5, 0.92, 2.29]], trail: { y: 1.0, z0: -1.9, z1: 1.9, x: 1.0 } } };
  }
  // ---------- 엡실론 AURELION GT (EP-V002) — v20 전면 재설계: 미드십 하이퍼카 ----------
  //  비율: 낮고 넓은 차체 · 길고 날카로운 노즈 · 앞뒤 바퀴 위로 솟은 펜더와 그 사이 낮은 보닛 · 앞바퀴 뒤에 앉은 캐빈 · 넓은 뒤 헌치 사이로 흘러내리는 엔진 덮개
  //  캐빈: 보닛에서 이어지는 경사 앞유리 → 낮고 긴 파노라마 캐노피(스모크 유리 지붕 + 실버 지붕 테 + 샴페인 창틀) → 엔진 덮개로 이어지는 패스트백 · 옆 유리는 B 필러로 나뉨
  //  디테일은 상자 대신 윤곽을 돌출(둥근 모서리)하거나 차체 표면을 따라 깐다:
  //   (3차 전면) 화살촉 헤드램프(다크 스모크 하우징 · 프로젝터 3개 · Y자 주간등) · 보닛 능선/채널/펜더 능선(실제 표면 높이) · 육각 가운데·사각 좌우 흡입구(깊은 안판·핀·실버 테)
  //   · 노즈 곡선을 따르는 카본 스플리터와 윙렛·카나드 · 문 뒤 깊은 사이드 흡입구와 샴페인 날 · 바퀴 아치 테
  //   엔진 덮개 속에서 올라오는 스완넥 지지대의 액티브 윙(익형 단면 블레이드 · 곡선 엔드플레이트) · 뒤를 감싸는 얇은 테일 LED · 곡선 핀의 깊은 디퓨저와 베젤 속 4구 배기 · 터빈형 단조 휠
  //  재질: 리퀴드 실버 = 메탈릭 도장(metal) · 샴페인 골드 = 크롬 장식 · 카본 블랙 · 다크 스모크 유리
  //  좌석·핸들·바퀴 축(세단과 같은 자리) · 액티브 윙 피벗(mov.wing) · fx 이름(hl0~4 · line0~5 · emb · tail · brake · brake2 · amb) · efx 는 그대로
  //  2D 윤곽을 돌출해 둥근 모서리 부품으로: plane 'xz' = 윤곽 [x, z] 를 수평으로 깔고 위로 두께 d · 'zy' = 윤곽 [z, y] 를 x 방향으로 두께 d · 'xy' = 윤곽 [x, y] 를 z 방향으로
  function aurShape(pts, d, plane, bevel = 0.006) {
    const sh = new THREE.Shape(), P = plane === 'xz' ? pts.map(([x, z]) => [x, -z]) : plane === 'zy' ? pts.map(([z, y]) => [-z, y]) : pts;
    P.forEach(([a, b], i) => (i ? sh.lineTo(a, b) : sh.moveTo(a, b)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
    if (plane === 'xz') g.rotateX(-Math.PI / 2); else if (plane === 'zy') g.rotateY(Math.PI / 2);
    return g;
  }
  // 익형 단면 (NACA 4자리 식, 아래로 휜 다운포스 날개): 앞전 z = +c/2 → 뒷전 z = −c/2
  function aurAirfoil(c, t, m, p = 0.4, n = 18) {
    const up = [], lo = [];
    for (let i = 0; i <= n; i++) {
      const x = (1 - Math.cos(i / n * Math.PI)) / 2, yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      const yc = -(x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x)), z = c / 2 - x * c;
      up.push([z, (yc + yt) * c]); lo.push([z, (yc - yt) * c]);
    }
    return [...up, ...lo.reverse().slice(1, -1)];
  }
  // 곡선을 따라 폭 w 의 띠 윤곽 (스완넥 지지대)
  function aurBand(path, w) {
    const L = [], R = [];
    for (let i = 0; i < path.length; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1, nz = -dy / l * w / 2, ny = dz / l * w / 2;
      L.push([path[i][0] + nz, path[i][1] + ny]); R.push([path[i][0] - nz, path[i][1] - ny]);
    }
    return [...L, ...R.reverse()];
  }
  // 터빈형 단조 휠: 비틀린 날 14장 · 실버 · 샴페인 테 · 가운데 EPSILON 엠블럼 (바퀴와 함께 돎)
  function rimTurbine(r, w, lipC) {
    const vb = new VB(), ri = r * 0.74, rh = r * 0.19, SPc = 0xc9cdd3, HB = 0x2a2c30;
    for (const sd of [1, -1]) {
      const x0 = sd * w * 0.42;
      const lip = new THREE.TorusGeometry(ri * 0.985, 0.012, 6, 30); lip.rotateY(Math.PI / 2); vb.add(lip, mtx(x0, 0, 0), lipC);
      const shroud = new THREE.TorusGeometry(ri * 0.84, 0.006, 4, 30); shroud.rotateY(Math.PI / 2); vb.add(shroud, mtx(x0 - sd * 0.004, 0, 0), SPc);
      const back = new THREE.CircleGeometry(ri * 0.97, 28); back.rotateY(sd * Math.PI / 2); vb.add(back, mtx(sd * w * 0.18, 0, 0), 0x0b0b0c);
      const hub = new THREE.CylinderGeometry(rh, rh * 1.1, 0.034, 18); hub.rotateZ(Math.PI / 2); vb.add(hub, mtx(x0, 0, 0), HB);
      const cap = new THREE.CylinderGeometry(rh * 0.62, rh * 0.62, 0.012, 4); cap.rotateZ(Math.PI / 2); vb.add(cap, mtx(x0 + sd * 0.019, 0, 0), lipC);
      const capIn = new THREE.CylinderGeometry(rh * 0.36, rh * 0.36, 0.012, 4); capIn.rotateZ(Math.PI / 2); vb.add(capIn, mtx(x0 + sd * 0.022, 0, 0), 0x16130d);
      for (let i = 0; i < 14; i++) {
        const g = new THREE.BoxGeometry(0.016, ri - rh, 0.042); g.rotateY(sd * 0.62); g.translate(x0 - sd * 0.006, (ri + rh) / 2, 0); g.rotateX(i / 14 * TAU); vb.add(g, null, SPc);
      }
    }
    return vb.build();
  }
  // ----- AURELION 전면 조형 도구: 해석적 차체 표면에 부품을 투영해 붙임 (정점 색으로 칠하면 격자 때문에 경계가 얼룩, 상자를 얹으면 떠 보임) -----
  //  aurSurf(B, sc): ① B.ring 을 둘레 길이로 고르게 다시 매개 (초타원 각도 매개는 윗면 가운데 점이 성겨 보닛 굴곡이 뭉개짐)
  //                  ② 윗면 높이 조각 sc(z, x) 를 ring · topY 에 똑같이 더함 (보닛 능선·채널·펜더 능선·배출구 오목) ③ B.inside(x, y, z) 안팎 판정
  function aurSurf(B, sc) {
    const ring0 = B.ring, top0 = B.topY, T = [], S = [], N = 160; let zc = null;
    const w = (z, y) => { const q = B.sec(z), u = clamp((y - q.yc) / q.hu, 0, 1); return u * u; };
    B.ring = (z, t) => {
      // 둘레 길이에 높이 가중: 윗면(보닛 굴곡)은 촘촘히 · 아랫면은 성기게
      if (zc !== z) { zc = z; T.length = S.length = 0; const s0 = B.sec(z), wt = (y) => y > s0.yc ? 1 + 1.3 * ((y - s0.yc) / s0.hu) ** 2 : 0.55 + 0.45 * clamp(1 - (s0.yc - y) / s0.hl, 0, 1); let p = ring0(z, -Math.PI / 2); for (let i = 0; i <= N; i++) { const tt = -Math.PI / 2 + i / N * TAU, q = ring0(z, tt); T.push(tt); S.push(i ? S[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]) * wt((q[1] + p[1]) / 2) : 0); p = q; } }
      const L = ((((t + Math.PI / 2) / TAU) % 1) + 1) % 1 * S[N]; let a = 0, b = N;
      while (b - a > 1) { const m = (a + b) >> 1; if (S[m] < L) a = m; else b = m; }
      const p = ring0(z, T[a] + (T[b] - T[a]) * (L - S[a]) / ((S[b] - S[a]) || 1)); p[1] += sc(z, p[0]) * w(z, p[1]); return p;
    };
    B.topY = (z, x) => { const y = top0(z, x); return y + sc(z, x) * w(z, y); };
    // 윗면 높이 (이분법 — topY 의 반복식은 텀블홈이 큰 옆 가까이에서 수렴하지 않음): x(u) = hw·(1 − uⁿ)^(1/n)·(1 − tb·u) 를 풀어 단면 식 그대로
    B.topR = (z, x) => {
      const q = B.sec(z), ax = Math.abs(x); if (ax >= q.hw) return q.yc; let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) { const u = (lo + hi) / 2; if (q.hw * Math.pow(1 - Math.pow(u, q.n), 1 / q.n) * (1 - q.tb * u) > ax) lo = u; else hi = u; }
      const u = (lo + hi) / 2, t = ax / q.hw, k = Math.max(0, 1 - t * t), y = q.yc + q.hu * u - q.v * k * k * u * u; return y + sc(z, x) * w(z, y);
    };
    B.inside = (x, y, z) => { if (z <= B.z0 || z >= B.z1 || y <= B.y0(z)) return false; const q = B.sec(z); if (Math.abs(x) >= q.hw || y > q.yc + q.hu + 0.06) return false; return y >= q.yc ? y < B.topR(z, x) : Math.abs(x) < B.sideX(z, y); };
    return B;
  }
  //  aurProj: 투영면 (X = x, Y = ey 방향 거리) 에서 d 방향으로 쏴 처음 만나는 차체 표면 점 (d·ey 의 x 성분 0 · |x| 로만 판정 → 좌우 정확히 대칭) · f.ax = 보는 쪽
  function aurProj(B, d, ey, c, back, len) {
    const at = (X, Y, s) => [X, c[1] + Y * ey[1] + (s - back) * d[1], c[2] + Y * ey[2] + (s - back) * d[2]], memo = new Map(); let last = 0;
    // 기억: 테·벽·핀이 같은 점을 다시 묻고, 왼쪽(X < 0)은 오른쪽 결과를 x 만 뒤집어 씀 (차체가 좌우 대칭 → 계산도 절반 · 대칭도 정확)
    const f = (X, Y) => {
      const ax = Math.abs(X), key = Math.round(ax * 1e6) + ',' + Math.round(Y * 1e6); let r = memo.get(key);
      if (r === undefined) {
        let a = 0, b = -1, s0 = 0; r = null;
        if (last > 0.14) { const p = at(ax, Y, last - 0.14); if (!B.inside(p[0], p[1], p[2])) s0 = last - 0.14; }   // 이웃 점은 거의 같은 깊이 → 바로 앞에서 시작
        for (let s = s0; s <= len; s += 0.04) { const p = at(ax, Y, s); if (B.inside(p[0], p[1], p[2])) { b = s; break; } a = s; }
        if (b > 0) { for (let i = 0; i < 10; i++) { const m = (a + b) / 2, p = at(ax, Y, m); if (B.inside(p[0], p[1], p[2])) b = m; else a = m; } r = at(ax, Y, (a + b) / 2); last = b; }
        memo.set(key, r);
      }
      return r && X < 0 ? [-r[0], r[1], r[2]] : r;
    };
    f.ax = [-d[0], -d[1], -d[2]]; f.ey = ey; return f;
  }
  //  투영 표면 법선 (유한 차분 · 보는 쪽으로)
  function aurN(f, X, Y, e = 0.005) {
    const a = f(X + e, Y), b = f(X - e, Y), c = f(X, Y + e), d = f(X, Y - e), u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(n[0], n[1], n[2]) || 1, sg = n[0] * f.ax[0] + n[1] * f.ax[1] + n[2] * f.ax[2] < 0 ? -1 : 1;
    return n.map((k) => k / L * sg);
  }
  //  조각 격자: uv(u, v) → [X, Y] 를 표면에 붙이고 보는 쪽으로 off(수 또는 점 → 수) 만큼 띄움
  function aurPatch(vb, f, uv, nu, nv, off, color) {
    const P = [];
    for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j <= nv; j++) { const [X, Y] = uv(i / nu, j / nv), p = f(X, Y); if (!p) return; const o = typeof off === 'function' ? off(p) : off; row.push([p[0] + f.ax[0] * o, p[1] + f.ax[1] * o, p[2] + f.ax[2] * o]); } P.push(row); }
    grid(P, P.map((r) => r.map(() => color)), false, () => vb, () => f.ax);
  }
  //  닫힌 윤곽 poly(투영면 좌표)를 따라 단면 prof [[바깥쪽 거리, 높이], ...] 를 쓸어 입체 테 (꼭짓점은 마이터) · out: 면 방향 기준 (기본 = 보는 쪽)
  function aurRim(vb, f, poly, prof, color, out, per = 0.02) {
    const n = poly.length; let A = 0;
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    const sg = A > 0 ? 1 : -1, en = (i) => { const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [sg * dy / l, -sg * dx / l]; }, S = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], e0 = en((i + n - 1) % n), e1 = en(i), mx = e0[0] + e1[0], my = e0[1] + e1[1], ml = Math.hypot(mx, my) || 1, k = Math.min(2.2, 1 / Math.max(0.3, (mx * e1[0] + my * e1[1]) / ml));
      S.push([a[0], a[1], mx / ml * k, my / ml * k]);
      const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / per)); for (let t = 1; t < m; t++) S.push([lerp(a[0], b[0], t / m), lerp(a[1], b[1], t / m), e1[0], e1[1]]);
    }
    // 단면 점마다 투영하지 않고 바깥쪽 0 · 1.5 · 3cm 세 점만 투영해 2차 보간 (같은 윤곽의 벽·테가 같은 점을 공유)
    const H = 0.015, Q = S.map(([X, Y, bx, by]) => { const p0 = f(X, Y), p1 = f(X + bx * H, Y + by * H) || p0, p2 = f(X + bx * 2 * H, Y + by * 2 * H) || [2 * p1[0] - p0[0], 2 * p1[1] - p0[1], 2 * p1[2] - p0[2]]; return [p0, p1, p2]; });
    const P = prof.map(([o, h]) => { const l0 = (o - H) * (o - 2 * H) / (2 * H * H), l1 = -o * (o - 2 * H) / (H * H), l2 = o * (o - H) / (2 * H * H);
      return Q.map(([a, b, c]) => [0, 1, 2].map((k) => a[k] * l0 + b[k] * l1 + c[k] * l2 + f.ax[k] * h)); });
    grid(P, P.map((r) => r.map(() => color)), true, () => vb, out || (() => f.ax));
  }
  //  흡입구·배출구 날: 투영면 선분 a→b 를 따라 표면에서 보는 쪽으로 dep 만큼 선 얇은 판 (두께 th)
  function aurFin(vb, f, a, b, dep, th, color, m = 10) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, tx = -dy / l * th / 2, ty = dx / l * th / 2, ax = f.ax;
    const at = (k, sd, h) => { const X = lerp(a[0], b[0], k / m), Y = lerp(a[1], b[1], k / m), p = f(X + sd * tx, Y + sd * ty) || f(X, Y); return [p[0] + ax[0] * h, p[1] + ax[1] * h, p[2] + ax[2] * h]; };
    const P = []; for (let k = 0; k <= m; k++) P.push([at(k, 1, -0.004), at(k, 1, dep), at(k, -1, dep), at(k, -1, -0.004)]);
    const tw = [tx, ty * f.ey[1], ty * f.ey[2]], tl = Math.hypot(tw[0], tw[1], tw[2]) || 1;
    grid(P, P.map((r) => r.map(() => color)), false, () => vb, () => [ax[0] - tw[0] / tl, ax[1] - tw[1] / tl, ax[2] - tw[2] / tl]);
  }
  //  빛 띠: 투영면 경로 pts 를 따라 폭 w 의 얇은 띠 (표면에서 off)
  function aurStrip(vb, f, pts, w, off, color, m = 16) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const T = L[L.length - 1], at = (s) => { s = clamp(s, 0, T); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]; };
    aurPatch(vb, f, (u, v) => { const p = at(u * T), q = at(u * T + 0.004), r = at(u * T - 0.004), dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1; return [p[0] - dy / l * (v - 0.5) * w, p[1] + dx / l * (v - 0.5) * w]; }, m, 1, off, color);
  }
  //  프로젝터: 표면점 p · 축 a — 어두운 통(하우징에 묻힘) + 빛 렌즈(fx) + 렌즈 칸막이 고리 + 크롬 테 (테가 렌즈보다 높아 깊이감)
  function aurLens(can, lens, rim, p, a, r, h, lc) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(a[0], a[1], a[2]).normalize()), P = new THREE.Vector3(p[0], p[1], p[2]);
    const M = (dz) => new THREE.Matrix4().compose(P.clone().add(new THREE.Vector3(0, 0, dz).applyQuaternion(q)), q, new THREE.Vector3(1, 1, 1)), top = h - 0.006;
    const c = new THREE.CylinderGeometry(r * 1.06, r * 1.12, h, 24); c.rotateX(Math.PI / 2); can.add(c, M(h / 2 - 0.006), 0x0c0d10);
    lens.add(new THREE.CircleGeometry(r * 0.8, 24), M(top + 0.0008), lc);
    can.add(new THREE.TorusGeometry(r * 0.46, 0.0024, 5, 20), M(top + 0.0016), 0x15171a);
    rim.add(new THREE.TorusGeometry(r, 0.0042, 6, 26), M(top + 0.0006), 0xb9bfc7);
  }
  function buildAurelion(sk) {
    // 2차 수정: 장식보다 차체 형상 — 앞뒤 끝에서 폭·높이가 충분히 수렴해 cap() 의 평평한 면이 거의 남지 않게(뒤 끝의 작은 마개는 배기 베젤 안)
    //  · 끝부분 보간 지점을 촘촘히 · 링 수를 늘림(120) · 뒤 헌치(뒷바퀴 펜더)가 꼬리까지 감싸고 그 사이 엔진 덮개는 낮게 · 아래면이 뒤로 올라가며 그대로 디퓨저가 됨
    //  · 실버는 조금 어두운 값 + 반사를 줄인 메탈릭(metal) · 캐노피는 기존 'glass'(다크 스모크) 재질 · 카본은 무광(matte) · 샴페인은 창틀·흡입구 날·휠 테·캘리퍼·엠블럼만
    const SV = mixHex(sk.paint, 0x8a9098, 0.38), CH = sk.gold, CB = 0x16171a, DK = 0x0a0b0d, SM = 0x15181d;
    const metal = new VB(), gloss = new VB(), matte = new VB(), sglass = new VB(), glass = new VB(), chrome = new VB();
    const fx = { hl0: new VB(), hl1: new VB(), hl2: new VB(), hl3: new VB(), hl4: new VB(), emb: new VB(), tail: new VB(), brake: new VB(), amb: new VB() };
    for (let i = 0; i < 6; i++) fx['line' + i] = new VB();
    const HLC = 0xf2f6ff, EMB = 0xffe2a8, RED = 0xff2030, LN = 0xffdca0;
    const WR = 0.37, WW = 0.33, WX = 0.87, ZF = 1.42, ZR = -1.36, wheels = [[WX, WR, ZF, 1], [-WX, WR, ZF, 1], [WX, WR, ZR, 0], [-WX, WR, ZR, 0]];
    const arF = archW(ZF, WR, WR, WX, WW), arR = archW(ZR, WR, WR, WX, WW); arF.flare = 0.024; arR.flare = 0.03; arF.lip = arR.lip = 0.17;   // 펜더 테두리를 넓고 완만하게(급한 볼록은 메탈릭에서 하얀 얼룩)
    const INT = { z: -0.55, y: 0.55, rz: 0.36, ry: 0.15, a: 0.3, d: 0.15 };                 // 문 뒤 깊은 사이드 흡입구 (뒷바퀴 아치 앞에서 끝남)
    const B = makeBody({ z0: -2.4, z1: 2.5,
      // 폭: 뒤 헌치가 꼬리 직전까지 넓게 유지되다 둥글게 수렴 · 앞은 펜더에서 노즈 끝까지 날렵하게 수렴
      // 앞은 펜더 폭을 노즈 가까이까지 유지하다 빠르게 수렴 (낮고 넓은 하이퍼카 앞모습)
      hw: [[-2.4, 0.42], [-2.385, 0.6], [-2.36, 0.72], [-2.32, 0.82], [-2.26, 0.9], [-2.16, 0.97], [-2.0, 1.02], [-1.7, 1.05], [-1.36, 1.06], [-0.95, 1.0], [-0.3, 0.95], [0.4, 0.94], [0.95, 0.97], [1.42, 1.0],
        [1.8, 0.99], [2.05, 0.95], [2.2, 0.89], [2.3, 0.81], [2.38, 0.7], [2.44, 0.57], [2.48, 0.43], [2.5, 0.3]],
      y0: [[-2.4, 0.36], [-2.3, 0.33], [-2.15, 0.27], [-1.95, 0.22], [-1.7, 0.19], [2.3, 0.19], [2.45, 0.2], [2.5, 0.21]],   // 앞 아랫면은 스플리터와 맞닿게 낮게
      // 높이: 엔진 덮개가 꼬리로 흘러내려 배기 높이에서 끝남 · 앞은 헤드램프 자리(모서리)가 높고 가운데로 갈수록 낮아짐
      y1: [[-2.4, 0.52], [-2.385, 0.6], [-2.36, 0.67], [-2.32, 0.74], [-2.26, 0.8], [-2.16, 0.86], [-2.0, 0.91], [-1.7, 0.95], [-1.36, 0.97], [-0.95, 0.91], [-0.4, 0.84], [0.3, 0.8], [0.95, 0.79],
        [1.42, 0.81], [1.8, 0.75], [2.05, 0.68], [2.22, 0.6], [2.34, 0.53], [2.42, 0.46], [2.47, 0.4], [2.5, 0.34]],
      // 가운데를 낮춰 양쪽 펜더가 솟게: 앞 = 보닛 골짜기(노즈 끝까지 깊게) · 뒤 = 헌치 사이 엔진 덮개
      valley: [[-2.4, 0.0], [-2.28, 0.0], [-2.12, 0.05], [-1.9, 0.09], [-1.5, 0.11], [-1.1, 0.06], [-0.5, 0.02], [0.6, 0.03], [1.0, 0.1], [1.4, 0.15], [1.8, 0.15], [2.1, 0.13], [2.3, 0.1], [2.42, 0.06], [2.5, 0.02]],
      n: [[-2.4, 2.4], [-2.33, 3.0], [-2.2, 3.4], [-1.9, 3.5], [0, 3.4], [1.9, 3.3], [2.3, 3.0], [2.5, 2.4]], tb: 0.27, mid: 0.38,
      dents: [INT], wheels: [arF, arR] });
    // 앞 윗면 조각 (실제 표면 높이): 보닛 가운데 길고 낮은 능선 · 능선과 펜더 사이 음각 채널(앞유리 쪽으로 흐르는 캐릭터 라인) · 근육질 앞 펜더 능선 · 배출구 자리 오목
    const gs = (v, s) => Math.exp(-(v * v) / (s * s)), zw = (z, a, b, c, d) => sstep(a, b, z) * (1 - sstep(c, d, z)), VT = { x: 0.555, z: 1.435, rx: 0.115, rz: 0.15 };
    aurSurf(B, (z, x) => { const ax = Math.abs(x), ev = ((ax - VT.x) / VT.rx) ** 2 + ((z - VT.z) / VT.rz) ** 2;
      return (0.026 + 0.012 * sstep(1.9, 2.3, z)) * gs(ax, 0.055) * zw(z, 1.05, 1.3, 2.36, 2.48) - 0.04 * gs(ax - 0.31, 0.06) * zw(z, 1.05, 1.35, 2.28, 2.46) + 0.05 * gs(ax - 0.7, 0.11) * zw(z, 1.0, 1.25, 2.02, 2.28) - 0.013 * sstep(1.15, 0.7, ev); });
    const side = (z, y, d = 0.004) => B.sideX(z, y) + d;
    const CWK = [[-1.85, 0.52], [-1.5, 0.68], [-1.0, 0.77], [-0.3, 0.79], [0.4, 0.77], [1.0, 0.6]], CWC = mono(CWK);   // 캐빈 밑변 반폭
    const col = (x, y, z) => {
      const ax = Math.abs(x), k = sstep(1.85, 2.25, z);
      if (y < B.y0(z) + lerp(0.035, 0.012, k) || y < lerp(0.25, 0, k)) return CB;                                  // 카본 아래면·스커트 (뒤로 올라가며 디퓨저가 됨 · 앞은 아랫면만 — 범퍼 부품이 경계를 맡음)
      if (z > -1.8 && z < 0.95 && ax < CWC(z) - 0.05 && y > 0.6) return 0x1b1c1f;                                 // 캐빈 안 바닥
      return SV;
    };
    loftBody(B, metal, col, 150, 104); dentHoles(B, matte);
    // ----- 캐빈: 길게 누운 앞유리 → 낮은 파노라마 캐노피(다크 스모크) → 엔진 덮개로 흐르는 패스트백 -----
    const Cb = makeCabin(B, { z0: -1.85, z1: 1.0, n: 4.2, tb: 0.24, wc: CWK,
      roof: [[-1.85, 0.93], [-1.6, 1.05], [-1.25, 1.2], [-0.85, 1.27], [-0.35, 1.3], [0.05, 1.29], [0.4, 1.17], [0.72, 0.98], [1.0, 0.8]] });
    loftCabin(Cb, cabinKey({ vS: 0.22, vP: 0.055, trimH: 0.022, zC: -1.42, zB: -0.42, bw: 0.04, trim: [chrome, CH], pillar: [metal, SV], bpil: [gloss, CB], glass: [glass, 0xffffff], roof: [glass, 0xffffff], zRF: 0.36, zRR: -1.5, rear: [glass, 0xffffff] }), 48, 32);
    // ----- 앞 (3차 전면 재설계): 해석적 차체 표면에 투영해 붙인 부품 — 정면 FR(X = x, Y = y) · 헤드램프 HL(앞 위 45°) · 윗면 TP(X = x, Y = z) -----
    //  화살촉 헤드램프(다크 스모크 하우징 · 실버 테 · 프로젝터 3개 · Y자 주간등: hl0 바깥 가지 → hl1 줄기·안쪽 가지 → hl2~4 프로젝터 순서로 켜짐)
    //  · 육각 가운데 흡입구(깊은 카본 안판 · 가로/사선 핀 · 실버 테) · 사각 좌우 흡입구(세로 카본 핀 · 헤드램프 아래) · 오목한 보닛 배출구와 날
    //  · 노즈 곡선을 따르는 카본 스플리터와 윙렛 · 카나드 · 엠블럼 / 좌우는 |x| 로만 계산해 정확히 대칭
    const FR = aurProj(B, [0, 0, -1], [0, 1, 0], [0, 0, 2.5], 0.45, 1.1);
    const HL = aurProj(B, [0, -0.6222, -0.7828], [0, 0.7828, -0.6222], [0, 0.5, 2.25], 0.5, 1.15);
    const TP = (X, Y) => [X, B.topR(Y, X), Y]; TP.ax = [0, 1, 0]; TP.ey = [0, 0, 1];
    const pl = (P) => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return (u) => { const s = u * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [lerp(P[i - 1][0], P[i][0], t), lerp(P[i - 1][1], P[i][1], t)]; }; };
    // 헤드램프 윤곽 (HL 좌표, 오른쪽): 안쪽 가장자리 · 바깥 가장자리 — 앞 모서리에서 넓게 시작해 보닛 옆으로 날카롭게 뻗어 끝이 뾰족
    const HI = [[0.58, -0.11], [0.5, -0.06], [0.465, 0.06], [0.45, 0.2], [0.44, 0.34]], HO = [[0.78, -0.03], [0.73, 0.04], [0.63, 0.12], [0.53, 0.23], [0.446, 0.343]];
    const HIe = pl(HI), HOe = pl(HO), HU = (u, v) => { const a = HIe(u), b = HOe(u); return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)]; };
    // 프로젝터 [u, v, 반지름] (안쪽 줄) · Y자 주간등: 줄기(끝 → 갈림) + 바깥 가지(앞 바깥 모서리) + 안쪽 가지(앞 안쪽 모서리)
    const LENS = [[0.28, 0.24, 0.028], [0.44, 0.3, 0.024], [0.6, 0.36, 0.02]], DRLa = [[0.4, 0.78], [0.2, 0.86], [0.03, 0.93]], DRLb = [[0.95, 0.55], [0.62, 0.7], [0.4, 0.78], [0.2, 0.5], [0.03, 0.12]];
    // 흡입구 윤곽 (FR 좌표): 가운데 = 넓고 낮은 육각 · 좌우 = 헤드램프 아래 사각 (A 위안 · B 위밖 · D 밖 · C 아래)
    const CI = [[0.3, 0.335], [0.46, 0.285], [0.42, 0.225], [-0.42, 0.225], [-0.46, 0.285], [-0.3, 0.335]], SQ = [[0.5, 0.33], [0.75, 0.405], [0.79, 0.33], [0.6, 0.225]];
    const VQ = [[0.46, 1.57], [0.63, 1.53], [0.66, 1.3], [0.49, 1.33]];   // 보닛 배출구 (TP 좌표)
    const RIM = [[-0.002, 0.0], [0.005, 0.005], [0.013, 0.001], [0.021, -0.018], [0.026, -0.034], [0.03, -0.052]];   // 흡입구 실버 테 단면 (높이는 벽 깊이에 더함)
    const beam = [];
    for (const s of [1, -1]) {
      const Hs = (u, v) => { const [X, Y] = HU(u, v); return [s * X, Y]; }, M = (P) => P.map(([X, Y]) => [s * X, Y]);
      // 헤드램프: 하우징(차체 표면에 묻힌 다크 스모크) → 실버 테(경계) → 프로젝터 3개 → Y자 주간등
      aurPatch(gloss, HL, Hs, 26, 8, 0.002, 0x0b0d10);
      aurRim(metal, HL, M([...HO, ...HI.slice().reverse()]), [[-0.004, -0.004], [-0.004, 0.006], [0.002, 0.0095], [0.009, 0.008], [0.016, 0.002], [0.021, -0.004]], SV);
      LENS.forEach(([u, v, r], i) => { const [X, Y] = Hs(u, v), p = HL(X, Y), n = aurN(HL, X, Y); aurLens(matte, fx['hl' + (2 + i)], chrome, p, [n[0], n[1], n[2] + 0.7], r, 0.016, HLC); if (i === 1) beam.push([p[0], p[1], p[2] + 0.02]); });
      aurStrip(fx.hl0, HL, DRLa.map(([u, v]) => Hs(u, v)), s * 0.011, 0.0045, HLC);        // 폭에 s: 왼쪽 띠도 같은 순서의 거울상 (삼각형 대각선까지 대칭)
      aurStrip(fx.hl1, HL, DRLb.map(([u, v]) => Hs(u, v)), s * 0.011, 0.0045, HLC, 24);
      // 좌우 흡입구: 깊은 카본 안판 · 카본 안벽 · 실버 테 · 세로 카본 핀
      const Q = M(SQ), [A, Bq, D, C] = Q, cx = s * 0.66, dep = 0.034;
      aurPatch(matte, FR, (u, v) => { const t = [lerp(A[0], Bq[0], u), lerp(A[1], Bq[1], u)], b = [lerp(C[0], D[0], u), lerp(C[1], D[1], u)]; return [lerp(t[0], b[0], v), lerp(t[1], b[1], v)]; }, 12, 6, 0.003, 0x111215);
      aurRim(matte, FR, Q, [[-0.002, -0.006], [-0.002, dep]], CB, (p) => [cx - p[0], 0.32 - p[1], 0]);
      aurRim(metal, FR, Q, RIM.map(([o, h]) => [o, dep + h]), SV);
      for (const u of [0.25, 0.5, 0.75]) aurFin(matte, FR, [lerp(A[0], Bq[0], u), lerp(A[1], Bq[1], u) - 0.003], [lerp(C[0], D[0], u), lerp(C[1], D[1], u) + 0.003], dep - 0.006, 0.0055, CB, 8);
      // 보닛 배출구: 오목한 자리에 어두운 바닥 · 실버 날 4장 · 실버 테
      const V = M(VQ), [va, vb2, vd, vc] = V;
      aurPatch(matte, TP, (u, v) => { const t = [lerp(va[0], vb2[0], u), lerp(va[1], vb2[1], u)], b = [lerp(vc[0], vd[0], u), lerp(vc[1], vd[1], u)]; return [lerp(t[0], b[0], v), lerp(t[1], b[1], v)]; }, 8, 6, 0.0015, 0x0c0d0f);
      aurRim(metal, TP, V, [[-0.003, -0.004], [-0.003, 0.007], [0.003, 0.01], [0.01, 0.007], [0.016, 0.0], [0.02, -0.005]], SV);
      for (const v of [0.2, 0.4, 0.6, 0.8]) aurFin(metal, TP, [lerp(va[0], vc[0], v) + s * 0.004, lerp(va[1], vc[1], v)], [lerp(vb2[0], vd[0], v) - s * 0.004, lerp(vb2[1], vd[1], v)], 0.01, 0.007, SV, 6);
      // 카나드: 범퍼 옆 모서리 (뿌리는 차체에 묻힘)
      for (const [y, L] of [[0.31, 0.065], [0.26, 0.05]]) { const sx = side(2.08, y, -0.012); matte.add(aurShape([[0, 1.99], [s * L, 2.07], [s * (L + 0.005), 2.1], [0, 2.17]], 0.007, 'xz', 0.003), mtx(s * sx, y, 0), CB); }
      mirror(metal, s, Cb.wc(0.6) - 0.02, Cb.base(0.6) + 0.08, 0.6, SV);
    }
    // 가운데 흡입구: 깊은 카본 안판(노즈 끝 마개보다 앞) · 카본 안벽 · 실버 테 · 가로 핀 2장(광택) · 사선 핀 6장(카본)
    { const yt = (x) => { const a = Math.abs(x); return a <= 0.3 ? 0.335 : lerp(0.335, 0.285, (a - 0.3) / 0.16); }, yb = (x) => { const a = Math.abs(x); return a <= 0.42 ? 0.225 : lerp(0.225, 0.285, (a - 0.42) / 0.04); }, dep = 0.044;
      aurPatch(matte, FR, (u, v) => { const x = (u * 2 - 1) * 0.457; return [x, lerp(yb(x) + 0.001, yt(x) - 0.001, v)]; }, 36, 6, (p) => 0.003 + 0.013 * sstep(2.47, 2.5, p[2]), 0x111215);
      aurRim(matte, FR, CI, [[-0.002, -0.006], [-0.002, dep]], CB, (p) => [-p[0], 0.28 - p[1], 0]);
      aurRim(metal, FR, CI, RIM.map(([o, h]) => [o, dep + h]), SV);
      for (const y of [0.258, 0.298]) { const xe = (y < 0.285 ? lerp(0.42, 0.46, (y - 0.225) / 0.06) : lerp(0.46, 0.3, (y - 0.285) / 0.05)) - 0.004; aurFin(gloss, FR, [-xe, y], [xe, y], dep - 0.008, 0.006, 0x1c1e22, 18); }
      for (const x0 of [0.08, 0.19, 0.3]) for (const s of [1, -1]) { const x1 = x0 * 1.1; aurFin(matte, FR, [s * x0, yb(x0) + 0.002], [s * x1, yt(x1) - 0.002], dep - 0.014, 0.005, CB, 6); } }
    // 스플리터: 노즈 곡선을 따라 아랫면과 맞닿음 (가운데 낮고 넓게 · 앞으로 3cm) + 양 끝 위로 휜 윙렛
    { const R = []; for (let i = 0; i <= 14; i++) { const z = 1.9 + (B.z1 - 1.9) * i / 14; R.push([B.hw(z) * 0.97 + 0.012, z]); }
      const xe = R[R.length - 1][0], F = []; for (let i = 1; i < 10; i++) { const x = xe - 2 * xe * i / 10; F.push([x, B.z1 + 0.03 - 0.02 * (x / xe) ** 2]); }
      matte.add(aurShape([...R, ...F, ...R.slice().reverse().map(([x, z]) => [-x, z])], 0.014, 'xz', 0.007), mtx(0, 0.176, 0), CB);
      for (const s of [1, -1]) { const x = B.hw(2.14) * 0.97 + 0.01; matte.add(aurShape([[1.94, 0.18], [2.34, 0.18], [2.33, 0.206], [2.22, 0.236], [2.0, 0.218]], 0.01, 'zy', 0.004), mtx(s > 0 ? x : -x - 0.01, 0, 0), CB); } }
    // 엠블럼: 노즈 윗면 가운데(가운데 흡입구 위) 작은 날개 달린 셰브론 — 샴페인 + 빛나는 다이아(fx.emb)
    { let Y = -0.42, p = null; for (; Y < 0; Y += 0.004) { p = HL(0, Y); if (p && p[1] > 0.385) break; }
      const n = aurN(HL, 0, Y), nz = new THREE.Vector3(n[0], n[1], n[2]), ex = new THREE.Vector3(1, 0, 0), ey = new THREE.Vector3().crossVectors(nz, ex);
      const Me = new THREE.Matrix4().makeBasis(ex, ey, nz).setPosition(p[0] + n[0] * 0.0015, p[1] + n[1] * 0.0015, p[2] + n[2] * 0.0015);
      const W = [[0, 0.032], [0.015, 0.008], [0.056, 0.0], [0.04, -0.008], [0.012, -0.003], [0, 0.013]];
      chrome.add(aurShape([...W, ...W.slice(1, -1).reverse().map(([x, y]) => [-x, y])], 0.003, 'xy', 0.0012), Me, CH);
      fx.emb.add(aurShape([[0, 0.025], [0.0075, 0.0145], [0, 0.018], [-0.0075, 0.0145]], 0.002, 'xy', 0), Me.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0048)), EMB); }
    // ----- 옆: 깊은 흡입구(파인 덕트 · 샴페인 윗날 · 카본 아랫날 · 안쪽 가로 날개) · 빛 선 · 패널 경계 · 카본 사이드 스커트 -----
    for (const s of [1, -1]) {
      const ca = Math.cos(INT.a), sa = Math.sin(INT.a), at = (ph) => { const dz = INT.rz * Math.cos(ph) * ca - INT.ry * Math.sin(ph) * sa, dy = INT.rz * Math.cos(ph) * sa + INT.ry * Math.sin(ph) * ca; return [INT.z + dz, INT.y + dy]; };
      curve(chrome, Array.from({ length: 11 }, (_, k) => { const [z, y] = at(Math.PI * (0.06 + k / 10 * 0.88)); return [s * side(z, y, 0.006), y, z]; }), 0.007, CH);
      curve(matte, Array.from({ length: 9 }, (_, k) => { const [z, y] = at(-Math.PI * (0.1 + k / 8 * 0.8)); return [s * side(z, y, 0.008), y, z]; }), 0.009, CB);
      for (const dy of [-0.045, 0, 0.045]) {   // 덕트 안쪽 가로 날개: 파인 바닥 가까이
        const y = INT.y + dy, z0d = INT.z + INT.rz * 0.55, z1d = INT.z - INT.rz * 0.55, xi = (z) => side(z, y, -INT.d * 0.75);
        curve(matte, [z0d, INT.z, z1d].map((z) => [s * xi(z), y + (z - INT.z) * Math.tan(INT.a) * 0.5, z]), 0.006, 0x101113);
      }
      const zs = [0.95, 0.6, 0.25, -0.1, -0.45, -0.8, -1.05];
      for (let j = 0; j < 6; j++) curve(fx['line' + j], [zs[j], (zs[j] + zs[j + 1]) / 2, zs[j + 1]].map((z) => [s * side(z, 0.33, 0.006), 0.33, z]), 0.006, LN);
      // 패널 경계: 앞 범퍼 · 도어 앞뒤 · 뒤 범퍼 (옆면) / 보닛 · 엔진 덮개 (윗면)
      for (const [z, y0, y1] of [[2.04, 0.27, 0.56], [0.9, 0.3, 0.74], [-0.12, 0.3, 0.76], [-2.1, 0.32, 0.8]]) curve(matte, Array.from({ length: 5 }, (_, k) => lerp(y0, y1, k / 4)).map((y) => [s * side(z, y, 0.002), y, z]), 0.0035, DK);
      curve(matte, [-1.86, -2.0, -2.14, -2.24].map((z) => { const x = lerp(0.44, 0.36, (-1.86 - z) / 0.38); return [s * x, B.topY(z, x) + 0.002, z]; }), 0.0035, DK);
      // 카본 사이드 스커트: 앞바퀴 뒤 → 뒷바퀴 앞, 차체 아래 곡면을 따라 바깥으로 살짝 나온 날
      curve(matte, [1.02, 0.6, 0.1, -0.4, -0.8, -0.98].map((z) => [s * side(z, 0.24, 0.016), 0.22, z]), 0.02, CB);
      curve(matte, [1.02, 0.6, 0.1, -0.4, -0.8, -0.98].map((z) => [s * side(z, 0.24, 0.03), 0.205, z]), 0.006, 0x2a2b2e);
    }
    curve(matte, [-0.36, 0, 0.36].map((x) => [x, B.topY(-2.24, Math.abs(x)) + 0.002, -2.24]), 0.0035, DK);
    // ----- 뒤: 차체 표면을 따라 감싸는 테일 LED · 브레이크 선 · 꼬리 끝(작은 마개 자리)의 깊은 배기 베젤과 4구 배기 · 아래면을 따르는 디퓨저 핀 -----
    const z0 = B.z0, TY = 0.71;
    const wrap = (y, n0, n1) => { const P = []; for (let i = n0; i <= n1; i++) { const z = z0 + 0.012 + i * 0.02; if (y > B.y1(z) - 0.006 || y < B.y0(z) + 0.01) continue; P.push([B.sideX(z, y) + 0.006, y, z]); } return P; };
    { const R = wrap(TY, 0, 18), Lp = R.slice().reverse().map(([x, y, z]) => [-x, y, z]); if (R.length > 1) curve(fx.tail, [...Lp, ...R], 0.009, RED);
      const R2 = wrap(TY - 0.04, 0, 6); if (R2.length > 1) curve(fx.brake, [...R2.slice().reverse().map(([x, y, z]) => [-x, y, z]), ...R2], 0.008, RED); }
    { const ez = (y) => { let z = z0; while (z < z0 + 0.3 && y > B.topY(z, 0) - 0.01) z += 0.004; return z; }, z = ez(0.6);
      chrome.box(-0.035, 0.565, z - 0.016, 0.035, 0.635, z - 0.002, CH, 0.55, 0, Math.PI / 4); fx.emb.box(-0.02, 0.58, z - 0.022, 0.02, 0.62, z - 0.012, EMB, 0.55, 0, Math.PI / 4); }
    { const bez = []; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, cx = Math.cos(a), cy = Math.sin(a); bez.push([Math.sign(cx) * Math.pow(Math.abs(cx), 0.32) * 0.46, 0.44 + Math.sign(cy) * Math.pow(Math.abs(cy), 0.32) * 0.088]); }
      matte.add(aurShape(bez, 0.06, 'xy', 0.008), mtx(0, 0, z0 - 0.03), DK);
      for (const x of [-0.29, -0.17, 0.17, 0.29]) {
        chrome.add(new THREE.TorusGeometry(0.035, 0.007, 6, 20), mtx(x, 0.44, z0 - 0.047), 0xc8ccd2);
        const inner = new THREE.CircleGeometry(0.03, 18); inner.rotateY(Math.PI); matte.add(inner, mtx(x, 0.44, z0 - 0.043), 0x050506);
      }
      for (const x of [-0.04, 0.04]) matte.box(x - 0.006, 0.36, z0 - 0.045, x + 0.006, 0.52, z0 - 0.025, 0x1c1d20); }   // 가운데 세로 받침(구조)
    for (const x of [-0.4, -0.25, -0.1, 0.1, 0.25, 0.4]) {
      const zEnd = Math.abs(x) > 0.3 ? z0 + 0.08 : z0 - 0.04, top = []; for (let i = 0; i <= 10; i++) { const z = lerp(-1.75, zEnd, i / 10); top.push([z, B.y0(z) - 0.002]); }
      matte.add(aurShape([...top, [zEnd - 0.02, 0.23], [-1.75, 0.172]], 0.012, 'zy', 0.004), mtx(x - 0.006, 0, 0), CB);
    }
    // ----- 실내 -----
    interior(matte, 0x17181b, true, 1.06, { dashW: 0.52, dashY: 0.82, rearW: 0.46, rearH: 0.86 });
    chrome.box(-0.5, 0.79, 0.548, 0.5, 0.796, 0.552, CH); fx.amb.box(-0.5, 0.768, 0.546, 0.5, 0.774, 0.55, LN);
    for (const s of [1, -1]) curve(fx.amb, [-1.3, -0.6, 0.1, 0.5].map((z) => [s * (Cb.wc(z) - 0.05), Cb.base(z) + 0.03, z]), 0.005, LN);
    calipers(matte, wheels, WW, CH);
    // 바퀴 아치 테: 아치를 파낸 경계(격자 톱니 · 메탈릭에서 하얀 얼룩)를 따라 차체색 말린 테 — 옆면 위 = 옆 표면, 아치 꼭대기 = 펜더 윗면의 파인 자리
    for (const W of [arF, arR]) for (const s of [1, -1]) {
      const P = []; for (let k = 0; k <= 18; k++) { const a = lerp(-0.22, Math.PI + 0.22, k / 18), z = W.z + Math.cos(a) * (W.R + 0.004), y = W.y + Math.sin(a) * (W.R + 0.004); if (y < B.y0(z) + 0.02) continue; const x = Math.max(B.sideX(z, y), W.inX - 0.012); P.push([s * (x + 0.003), Math.min(y, B.topR(z, x) - 0.004), z]); }
      if (P.length > 1) curve(metal, P, 0.012, SV, 7);
    }
    // ----- 액티브 리어 윙 (pivot·움직임 그대로): 길고 얇은 익형 블레이드 · 차체색 스완넥 지지대가 엔진 덮개 위 유선형 받침에서 올라옴 · 실버 엔드플레이트 -----
    const wingZ = -2.04, wy = B.topY(wingZ, 0) + 0.004, wing = { pivot: [0, wy, wingZ], metal: new VB(), matte: new VB(), chrome: new VB(), fx: { brake2: new VB() } };
    wing.metal.add(aurShape(aurAirfoil(0.3, 0.09, 0.05).map(([z, y]) => [z, y + 0.05]), 1.8, 'zy', 0.004), mtx(-0.9, 0, 0), SV);
    curve(wing.chrome, [[-0.89, 0.051, -0.148], [0.89, 0.051, -0.148]], 0.0035, CH);
    const neck = aurBand([[0.045, -0.27], [0.05, -0.08], [0.046, 0.015], [0.026, 0.07], [-0.012, 0.094], [-0.052, 0.09], [-0.078, 0.074], [-0.082, 0.058]], 0.026);
    for (const x of [-0.3, 0.3]) wing.metal.add(aurShape(neck, 0.018, 'zy', 0.006), mtx(x - 0.009, 0, 0), SV);
    const EP = [[0.15, 0.0], [0.155, 0.05], [0.115, 0.085], [-0.1, 0.098], [-0.16, 0.072], [-0.165, 0.005], [-0.09, -0.024], [0.09, -0.024]];
    for (const s of [1, -1]) wing.metal.add(aurShape(EP, 0.01, 'zy', 0.004), mtx(s > 0 ? 0.902 : -0.912, 0, 0), SV);
    wing.fx.brake2.box(-0.55, 0.053, -0.146, 0.55, 0.06, -0.134, RED);
    for (const s of [1, -1]) { const x = s * 0.3, z = wingZ + 0.045; ball(metal, x, B.topY(z, 0.3) + 0.004, z, 0.028, 0.02, 0.085, SV); }   // 지지대 받침 (엔진 덮개 위 유선형)
    return { gloss, matte, sglass, glass, chrome, metal, fx, mov: { wing }, wheel: tireGeo(WR, WW), rim: rimTurbine(WR, WW, CH), wheels, wr: WR,
      efx: { kind: 'aurelion', screens: [{ id: 'cluster', p: [0.4, 0.93, 0.62], w: 0.28, h: 0.1, rx: -0.5 }, { id: 'center', p: [0, 0.9, 0.62], w: 0.3, h: 0.12, rx: -0.45 }],
        under: { w: 1.9, l: 4.4 }, beams: beam, trail: { y: 0.55, z0: -2.0, z1: 1.8, x: 1.0 } } };
  }

  // ---------- 엡실론 TITAN VANGUARD (EP-V003): 묵직하고 웅장한 럭셔리 오프로드 — 픽업트럭 자리(좌석 · 적재함 좌석 · 물리)에 겉모습만 ----------
  //  건메탈 차체 · 티타늄 장식(그릴 살 · 스키드 플레이트 · 스포츠 바 · 레일) · 구리색 포인트 · 큰 오프로드 타이어와 비드록 휠 · 각진 펜더
  //  fx: hl0~4 C자 헤드램프 · bar0~5 지붕 LED 바(왼→오) · amber 지붕 앞 마커등 · emb · tail 세로 테일 · brake · amb
  function tireKnob(r, w) {   // 오프로드 타이어: 둥근 타이어 + 바깥 테 블록 무늬
    const vb = new VB(), ri = r * 0.68;
    const prof = [[ri, -w * 0.5], [r * 0.9, -w * 0.5], [r * 0.97, -w * 0.45], [r, -w * 0.32], [r, w * 0.32], [r * 0.97, w * 0.45], [r * 0.9, w * 0.5], [ri, w * 0.5]];
    const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 28); g.rotateZ(Math.PI / 2); vb.add(g, null, 0x19191a);
    for (let i = 0; i < 26; i++) for (const sd of [1, -1]) { const k = new THREE.BoxGeometry(w * 0.3, 0.035, 0.07); k.translate(sd * w * 0.3, r + 0.005, 0); k.rotateX(i / 26 * TAU + (sd > 0 ? 0 : TAU / 52)); vb.add(k, null, 0x141415); }
    return vb.build();
  }
  function rimTitan(r, w) {
    const vb = new VB(), ri = r * 0.68, GM = 0x3a3d42, TIc = 0xaab0b6;
    for (const sd of [1, -1]) {
      const x0 = sd * w * 0.42;
      const lip = new THREE.TorusGeometry(ri * 0.97, 0.022, 6, 26); lip.rotateY(Math.PI / 2); vb.add(lip, mtx(x0, 0, 0), TIc);   // 비드록 링
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, b = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6); b.rotateZ(Math.PI / 2); vb.add(b, mtx(x0 + sd * 0.016, Math.cos(a) * ri * 0.97, Math.sin(a) * ri * 0.97), 0xd6dadf); }
      const back = new THREE.CircleGeometry(ri * 0.95, 24); back.rotateY(sd * Math.PI / 2); vb.add(back, mtx(sd * w * 0.18, 0, 0), 0x0b0b0c);
      const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.22, 0.05, 8); hub.rotateZ(Math.PI / 2); vb.add(hub, mtx(x0, 0, 0), GM);
      const cap = new THREE.CylinderGeometry(r * 0.1, r * 0.1, 0.02, 4); cap.rotateZ(Math.PI / 2); vb.add(cap, mtx(x0 + sd * 0.03, 0, 0), 0xc46a2a);
      for (let i = 0; i < 6; i++) { const g = new THREE.BoxGeometry(0.03, ri - r * 0.2, 0.07); g.translate(x0 - sd * 0.008, (ri + r * 0.2) / 2, 0); g.rotateX(i / 6 * TAU); vb.add(g, null, GM); }
    }
    return vb.build();
  }
  function buildTitan(sk) {
    const GM = sk.paint, TI = sk.ti, CU = sk.accent, CB = 0x1a1b1e, DK = 0x0b0b0c, SEAT = 0x1d1e21;
    const gloss = new VB(), matte = new VB(), sglass = new VB(), chrome = new VB();
    const fx = { hl0: new VB(), hl1: new VB(), hl2: new VB(), hl3: new VB(), hl4: new VB(), amber: new VB(), emb: new VB(), tail: new VB(), brake: new VB(), amb: new VB() };
    for (let i = 0; i < 6; i++) fx['bar' + i] = new VB();
    const HLC = 0xf0f6ff, EMB = 0xffc890, RED = 0xff2030, AMB = 0xffb050, AMBER = 0xffa020;
    const WR = 0.47, WW = 0.36, WX = 0.9, ZF = 1.62, ZR = -1.6, wheels = [[WX, WR, ZF, 1], [-WX, WR, ZF, 1], [WX, WR, ZR, 0], [-WX, WR, ZR, 0]];
    const arF = archW(ZF, WR, WR, WX, WW); arF.flare = 0.05; arF.R = WR + 0.09;
    // 앞 차체 + 캐빈 아래 (뒤 끝 z −0.5 의 마개가 캐빈 뒷벽 아래)
    const B = makeBody({ z0: -0.5, z1: 2.8,
      hw: [[-0.5, 0.99], [0.5, 1.0], [1.62, 1.03], [2.4, 1.0], [2.8, 0.96]],
      y0: [[-0.5, 0.62], [2.5, 0.6], [2.8, 0.64]],
      y1: [[-0.5, 1.3], [0.6, 1.3], [1.1, 1.3], [1.4, 1.29], [2.3, 1.26], [2.62, 1.2], [2.8, 1.12]],
      valley: [[1.2, 0], [1.6, -0.018], [2.3, -0.018], [2.8, 0]], n: 5.6, tb: 0.05, mid: 0.45, wheels: [arF] });
    loftBody(B, gloss, (x, y, z) => (y < 0.7 ? CB : GM));
    const sx = (z, y, d = 0.004) => B.sideX(z, y) + d;
    // 캐빈: 각진 그린하우스 + 뒷벽(뒷유리)
    const Cb = makeCabin(B, { z0: -0.5, z1: 1.3, n: 5, tb: 0.08, wc: [[-0.5, 0.93], [0.6, 0.94], [1.3, 0.9]], roof: [[-0.5, 1.86], [-0.3, 1.88], [0.5, 1.88], [0.85, 1.8], [1.15, 1.5], [1.3, 1.32]] });
    loftCabin(Cb, cabinKey({ vS: 0.22, vP: 0.05, trimH: 0.03, zC: -0.42, zB: 0.32, bw: 0.06, trim: [chrome, TI], pillar: [gloss, GM], bpil: [gloss, CB], glass: [sglass, 0x4a5360], roof: [gloss, GM], zRF: 0.62, zRR: -0.6, rear: [sglass, 0x4a5360] }));
    gloss.box(-0.92, 1.28, -0.53, 0.92, 1.87, -0.49, GM); sglass.box(-0.6, 1.4, -0.535, 0.6, 1.76, -0.525, 0x4a5360);
    // 적재함: 바닥 · 옆벽(뒷바퀴 아치를 판 옆모습) · 레일 · 테일게이트 · 바퀴 우물
    matte.box(-0.9, 0.9, -2.66, 0.9, 0.94, -0.53, 0x26282c);
    const wall = [[-2.72, 0.6], ...arch(ZR, 0.6, 0.62), [-0.55, 0.6], [-0.55, 1.32], [-2.72, 1.32]];
    for (const s of [1, -1]) {
      gloss.add(side(wall, 0.09, s * 0.955), null, GM); matte.add(side([[-2.72, 0.6], ...arch(ZR, 0.6, 0.62), [-0.55, 0.6], [-0.55, 0.72], [-2.72, 0.72]], 0.1, s * 0.96), null, CB);
      chrome.box(s * 0.9, 1.32, -2.72, s * 1.0, 1.36, -0.55, TI);
      matte.box(s * 0.62, 0.94, -2.2, s * 0.91, 1.2, -1.0, 0x202226);
      curve(matte, arch(ZR, 0.6, 0.7, 12).map(([z, y]) => [s * 1.02, y, z]), 0.05, CB);            // 뒤 펜더 플레어
      curve(matte, arch(ZF, 0.5, 0.66, 12).map(([z, y]) => [s * sx(z, Math.min(1.2, y), 0.03), y, z]), 0.05, CB);   // 앞 펜더 플레어
      // 스포츠 바(티타늄) · 사이드 스텝 · 손잡이 · 큰 미러
      tube(chrome, [s * 0.88, 1.32, -0.8], [s * 0.76, 2.0, -0.74], 0.04, TI, 8); tube(chrome, [s * 0.88, 1.32, -1.5], [s * 0.82, 1.92, -0.78], 0.032, TI, 8);
      matte.box(s * 0.98, 0.52, -0.4, s * 1.1, 0.56, 1.1, CB); chrome.box(s * 0.98, 0.56, -0.4, s * 1.1, 0.57, 1.1, TI);
      for (const z of [0.6, -0.15]) chrome.box(s * sx(z, 1.12, 0), 1.1, z - 0.1, s * sx(z, 1.12, 0.016), 1.13, z + 0.1, TI);
      gloss.box(s * 1.0, 1.32, 1.02, s * 1.16, 1.5, 1.14, GM); matte.box(s * 1.155, 1.34, 1.03, s * 1.165, 1.48, 1.13, 0x30343a);
      // 세로 테일등 · 적재함 끝 고리
      fx.tail.box(s * 0.89, 0.78, -2.744, s * 0.99, 1.26, -2.73, RED); matte.box(s * 0.88, 0.76, -2.74, s * 1.0, 1.28, -2.722, DK);
    }
    tube(chrome, [-0.76, 2.0, -0.74], [0.76, 2.0, -0.74], 0.04, TI, 8);
    gloss.box(-0.955, 0.6, -2.74, 0.955, 1.32, -2.66, GM); chrome.box(-0.5, 1.12, -2.75, 0.5, 1.15, -2.74, TI);
    fx.brake.box(-0.25, 1.9, -0.55, 0.25, 1.94, -0.53, RED); fx.brake.box(-0.86, 0.95, -2.75, -0.62, 0.98, -2.744, RED); fx.brake.box(0.62, 0.95, -2.75, 0.86, 0.98, -2.744, RED);
    chrome.box(-0.06, 0.92, -2.762, 0.06, 1.04, -2.744, CU, 0, 0, Math.PI / 4); fx.emb.box(-0.034, 0.946, -2.77, 0.034, 1.014, -2.76, EMB, 0, 0, Math.PI / 4);
    matte.box(-0.96, 0.5, -2.86, 0.96, 0.66, -2.72, CB); chrome.box(-0.3, 0.5, -2.88, 0.3, 0.58, -2.84, TI);   // 뒤 범퍼 + 견인 고리 판
    // 앞: 큰 그릴(티타늄 가로 살 셋) · 가운데 엠블럼 · C자 헤드램프 · 티타늄 스키드 플레이트 · 견인 고리(구리색)
    const ZF0 = 2.822;
    matte.box(-0.62, 0.7, ZF0 - 0.02, 0.62, 1.08, ZF0, DK);
    for (const y of [0.76, 0.88, 1.0]) chrome.box(-0.6, y, ZF0, 0.6, y + 0.045, ZF0 + 0.022, TI);
    chrome.box(-0.08, 0.83, ZF0 + 0.016, 0.08, 0.99, ZF0 + 0.036, CU, 0, 0, Math.PI / 4); fx.emb.box(-0.05, 0.86, ZF0 + 0.03, 0.05, 0.96, ZF0 + 0.042, EMB, 0, 0, Math.PI / 4);
    for (const s of [1, -1]) {
      matte.box(s * 0.66, 0.74, ZF0 - 0.014, s * 0.9, 1.08, ZF0 + 0.002, 0x101114);
      const cx = s * 0.78, cy = 0.91;
      fx.hl0.box(cx - 0.012, cy - 0.11, ZF0, cx + 0.012, cy + 0.11, ZF0 + 0.012, HLC);                                   // 세로 기둥
      fx.hl1.box(cx - 0.0, cy + 0.1, ZF0, cx + s * 0.1, cy + 0.124, ZF0 + 0.012, HLC);                                  // 위 가로
      fx.hl2.box(cx - 0.0, cy - 0.124, ZF0, cx + s * 0.1, cy - 0.1, ZF0 + 0.012, HLC);                                  // 아래 가로
      const pj = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16); pj.rotateX(Math.PI / 2); fx.hl3.add(pj, mtx(cx + s * 0.055, cy, ZF0 + 0.006), HLC);   // 프로젝터
      fx.hl4.box(s * 0.36, 0.55, ZF0 + 0.07, s * 0.62, 0.575, ZF0 + 0.082, HLC);                                       // 범퍼 안 안개등 띠
      chrome.box(s * 0.5, 0.48, ZF0 + 0.06, s * 0.58, 0.56, ZF0 + 0.12, CU);                                            // 견인 고리
    }
    matte.box(-0.98, 0.46, 2.7, 0.98, 0.66, 2.92, CB); chrome.box(-0.72, 0.4, 2.62, 0.72, 0.47, 2.95, TI, -0.25);     // 범퍼 · 스키드 플레이트
    topStrip(chrome, B, 0.34, 0.355, 1.4, 2.6, TI); topStrip(chrome, B, -0.355, -0.34, 1.4, 2.6, TI);
    // 지붕: 앞쪽 LED 바(여섯 칸) · 그 앞 마커등 · 루프 레일
    const ry = Cb.roof(0.6);
    matte.box(-0.86, ry, 0.5, 0.86, ry + 0.07, 0.64, 0x16171a);
    for (let j = 0; j < 6; j++) { const x0 = -0.82 + j * 0.275; fx['bar' + j].box(x0, ry + 0.012, 0.642, x0 + 0.26, ry + 0.058, 0.652, HLC); }
    for (let i = -2; i <= 2; i++) fx.amber.box(i * 0.16 - 0.03, ry - 0.03, 0.78, i * 0.16 + 0.03, ry - 0.005, 0.83, AMBER);
    for (const s of [1, -1]) { const rail = [-0.35, 0.1, 0.45].map((z) => { const [x, y] = Cb.pt(z, s > 0 ? 0.28 : 0.72); return [x, y + 0.03, z]; }); curve(chrome, rail, 0.014, TI); }
    // 실내: 차콜 가죽 + 구리색 바느질 · 티타늄 대시 선 · 앰버 앰비언트 (픽업과 같은 좌석·핸들 자리)
    for (const s of [1, -1]) {
      matte.box(s * 0.12, 0.75, -0.05, s * 0.75, 1.0, 0.45, SEAT); matte.box(s * 0.12, 0.98, -0.2, s * 0.75, 1.6, -0.08, SEAT, -0.12);
      for (let k = 0; k < 4; k++) matte.box(s * 0.16, 1.08 + k * 0.12, -0.075 - k * 0.012, s * 0.71, 1.088 + k * 0.12, -0.07 - k * 0.012, CU, -0.12);
    }
    matte.box(-0.88, 1.0, 0.8, 0.88, 1.18, 1.2, 0x202226); chrome.box(-0.86, 1.12, 0.795, 0.86, 1.13, 0.8, TI); fx.amb.box(-0.86, 1.09, 0.792, 0.86, 1.098, 0.797, AMB);
    for (const s of [1, -1]) curve(fx.amb, [-0.4, 0.2, 0.8].map((z) => [s * (Cb.wc(z) - 0.05), Cb.base(z) + 0.035, z]), 0.006, AMB);
    matte.add(new THREE.TorusGeometry(0.18, 0.028, 6, 16), mtx(0.42, 1.24, 0.72, -0.5, 0, 0), 0x121315);
    { const g = new THREE.CylinderGeometry(0.05, 0.05, 0.024, 4); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 4); g.rotateX(-0.5); chrome.add(g, mtx(0.42, 1.24, 0.72), CU); }
    calipers(chrome, wheels, WW, CU);
    return { gloss, matte, sglass, chrome, fx, wheel: tireKnob(WR, WW), rim: rimTitan(WR, WW), wheels, wr: WR,
      efx: { kind: 'titan', screens: [{ id: 'cluster', p: [0.42, 1.235, 0.93], w: 0.3, h: 0.11, rx: -0.4 }, { id: 'center', p: [0, 1.235, 0.95], w: 0.36, h: 0.15, rx: -0.36 }],
        under: { w: 2.5, l: 3.4, z: 0.4 }, beams: [[0.78, 0.91, 2.84], [-0.78, 0.91, 2.84]], trail: null } };
  }

  // ---------- 엡실론 SOVEREIGN ECLIPSE (EP-V004): 길고 우아한 초호화 의전 세단 — 세단 자리(좌석·물리)에 겉모습만 ----------
  //  위는 블랙 펄 · 아래는 실버 투톤(경계에 크롬 코치 라인) · 곧게 선 크롬 그릴(빛이 아래에서 위로 차오름) · 두꺼운 C 필러와 짙은 프라이버시 유리
  //  움직이는 부품: 보닛 장식(mov.orn — 시동 때 솟아오르고 내리면 들어감) · 뒤 '이클립스' 원형 등 · 실내 스타라이트 천장 · 문 옆 바닥에 엠블럼 조명(웰컴 라이트)
  //  fx: hl0~4 · grille0~4(아래→위) · ring 원형 테일 · emb · brake(원 안을 채움) · amb(스타라이트 · 앰비언트)
  function buildSovereign(sk) {
    const BKP = sk.paint, SL = sk.silver, CB = 0x121214, DK = 0x08080a, IV = 0xd8cfc0;
    const gloss = new VB(), matte = new VB(), sglass = new VB(), chrome = new VB();
    const fx = { hl0: new VB(), hl1: new VB(), hl2: new VB(), hl3: new VB(), hl4: new VB(), ring: new VB(), emb: new VB(), brake: new VB(), amb: new VB() };
    for (let i = 0; i < 5; i++) fx['grille' + i] = new VB();
    const HLC = 0xf4f8ff, EMB = 0xe8eeff, RED = 0xff2a36, AMB = 0xe8f0ff;
    const WR = 0.36, WW = 0.26, WX = 0.82, ZF = 1.55, ZR = -1.42, wheels = [[WX, WR, ZF, 1], [-WX, WR, ZF, 1], [WX, WR, ZR, 0], [-WX, WR, ZR, 0]];
    const B = makeBody({ z0: -2.48, z1: 2.52,
      hw: [[-2.48, 0.86], [-2.2, 0.93], [-1.4, 0.95], [0, 0.95], [1.55, 0.95], [2.2, 0.93], [2.52, 0.88]],
      y0: [[-2.48, 0.36], [-2.2, 0.28], [2.2, 0.28], [2.52, 0.34]],
      y1: [[-2.48, 0.92], [-2.2, 0.98], [-1.6, 1.0], [-1.0, 0.98], [0.8, 0.97], [1.6, 0.95], [2.2, 0.93], [2.52, 0.9]],
      n: 4.4, tb: 0.14, mid: 0.42, wheels: [archW(ZF, WR, WR, WX, WW), archW(ZR, WR, WR, WX, WW)] });
    loftBody(B, gloss, (x, y, z) => (y < 0.3 ? CB : y < 0.66 ? SL : BKP));
    const side = (z, y, d = 0.004) => B.sideX(z, y) + d;
    const Cb = makeCabin(B, { z0: -1.62, z1: 0.85, n: 3.8, tb: 0.1,
      wc: [[-1.62, 0.7], [-1.3, 0.8], [-0.4, 0.83], [0.4, 0.82], [0.85, 0.72]],
      roof: [[-1.62, 1.0], [-1.45, 1.3], [-1.2, 1.43], [-0.4, 1.47], [0.25, 1.46], [0.55, 1.3], [0.85, 1.0]] });
    loftCabin(Cb, cabinKey({ vS: 0.2, vP: 0.05, trimH: 0.03, zC: -0.95, zB: -0.32, bw: 0.06, trim: [chrome, SL], pillar: [gloss, BKP], bpil: [gloss, BKP], glass: [sglass, 0x2a2f3c], roof: [gloss, BKP], zRF: 0.4, zRR: -1.25, rear: [sglass, 0x2a2f3c] }));
    for (const s of [1, -1]) {
      curve(chrome, [2.3, 1.6, 0.8, 0, -0.8, -1.6, -2.3].map((z) => [s * side(z, 0.66), 0.66, z]), 0.006, SL);   // 코치 라인 (투톤 경계)
      curve(chrome, [2.2, 1.0, -0.2, -1.4, -2.2].map((z) => [s * side(z, 0.33), 0.33, z]), 0.005, SL);
      for (const z of [0.35, -0.7]) chrome.box(s * side(z, 0.86, 0), 0.85, z - 0.09, s * side(z, 0.86, 0.014), 0.87, z + 0.09, SL);
      mirror(gloss, s, Cb.wc(0.62) - 0.02, Cb.base(0.62) + 0.09, 0.62, BKP);
      // 헤드램프: 그릴 옆으로 가늘게 펼쳐지는 다섯 칸 + 아래 눈썹
      matte.box(s * 0.36, 0.72, 2.505, s * 0.86, 0.84, 2.52, 0x101114);
      for (let i = 0; i < 5; i++) { const x = 0.4 + i * 0.09; fx['hl' + i].box(s * x, 0.77, 2.52, s * (x + 0.08), 0.8, 2.53, HLC); }
      fx.hl4.box(s * 0.4, 0.735, 2.522, s * 0.84, 0.745, 2.53, HLC);
      // 뒤: 이클립스 원형 등 (빛나는 고리 + 브레이크 때 채워지는 원)
      const rg = new THREE.TorusGeometry(0.1, 0.014, 6, 28); fx.ring.add(rg, mtx(s * 0.62, 0.8, -2.49), RED);
      const dg = new THREE.CircleGeometry(0.084, 24); dg.rotateY(Math.PI); fx.brake.add(dg, mtx(s * 0.62, 0.8, -2.492), RED);
      matte.add(new THREE.CircleGeometry(0.12, 24).rotateY(Math.PI), mtx(s * 0.62, 0.8, -2.486), DK);
      chrome.add(new THREE.TorusGeometry(0.124, 0.006, 4, 28), mtx(s * 0.62, 0.8, -2.488), SL);
    }
    // 그릴: 곧게 선 크롬 테 + 세로 살 + 빛나는 가로 줄(아래→위로 차오름)
    const ZF0 = 2.528;
    matte.box(-0.31, 0.42, ZF0 - 0.012, 0.31, 0.9, ZF0, DK);
    for (let i = 0; i < 5; i++) { const y = 0.47 + i * 0.09; fx['grille' + i].box(-0.28, y, ZF0, 0.28, y + 0.012, ZF0 + 0.006, AMB); }
    for (let i = -6; i <= 6; i++) chrome.box(i * 0.044 - 0.006, 0.43, ZF0 + 0.006, i * 0.044 + 0.006, 0.89, ZF0 + 0.02, SL);
    chrome.box(-0.34, 0.89, ZF0 - 0.006, 0.34, 0.93, ZF0 + 0.03, SL); chrome.box(-0.34, 0.39, ZF0 - 0.006, 0.34, 0.43, ZF0 + 0.03, SL);
    for (const s of [1, -1]) chrome.box(s * 0.31, 0.39, ZF0 - 0.006, s * 0.345, 0.93, ZF0 + 0.03, SL);
    fx.emb.box(-0.03, 0.64, ZF0 + 0.02, 0.03, 0.7, ZF0 + 0.032, EMB, 0, 0, Math.PI / 4);
    chrome.box(-0.86, 0.3, 2.5, 0.86, 0.36, 2.58, SL); matte.box(-0.6, 0.31, 2.55, 0.6, 0.37, 2.58, DK);
    // 뒤: 엠블럼 · 크롬 띠 · 타원 배기 테
    chrome.box(-0.05, 0.76, -2.505, 0.05, 0.86, -2.488, SL, 0, 0, Math.PI / 4); fx.emb.box(-0.028, 0.782, -2.512, 0.028, 0.838, -2.502, EMB, 0, 0, Math.PI / 4);
    chrome.box(-0.42, 0.66, -2.5, 0.42, 0.672, -2.486, SL);
    for (const s of [1, -1]) { const e = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16); e.rotateX(Math.PI / 2); e.scale(1.6, 1, 1); chrome.add(e, mtx(s * 0.5, 0.36, -2.48), SL); }
    // 실내: 아이보리 가죽(검은 테두리) · 뒷좌석 독립 시트 · 스타라이트 천장 · 은빛 앰비언트
    for (const s of [1, -1]) { matte.box(s * 0.18, 0.4, -0.48, s * 0.62, 0.62, -0.05, IV); matte.box(s * 0.18, 0.6, -0.56, s * 0.62, 1.2, -0.44, IV, -0.18); matte.box(s * 0.17, 0.6, -0.565, s * 0.19, 1.2, -0.44, CB, -0.18); }
    for (const s of [1, -1]) { matte.box(s * 0.16, 0.4, -1.4, s * 0.6, 0.6, -0.95, IV); matte.box(s * 0.18, 0.58, -1.44, s * 0.58, 1.1, -1.34, IV, -0.12); }
    matte.box(-0.12, 0.4, -1.42, 0.12, 0.72, -0.95, CB);
    matte.box(-0.7, 0.72, 0.5, 0.7, 0.9, 0.9, CB); chrome.box(-0.68, 0.84, 0.494, 0.68, 0.85, 0.5, SL); fx.amb.box(-0.68, 0.81, 0.492, 0.68, 0.818, 0.497, AMB);
    steering(matte);
    { let seed = 7; const rnd2 = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 70; i++) { const z = -1.3 + rnd2() * 1.6, x = (rnd2() - 0.5) * 1.1, y = Cb.roof(z) - 0.05 - Math.abs(x) * 0.08; fx.amb.box(x - 0.005, y - 0.005, z - 0.005, x + 0.005, y + 0.002, z + 0.005, 0xffffff); } }
    calipers(matte, wheels, WW, SL);
    // 보닛 장식: 은빛 네 갈래 별 (pivot = 보닛 앞 윗면, 시동 때 솟아오름)
    const oz = 2.38, orn = { pivot: [0, B.topY(oz, 0) - 0.005, oz], chrome: new VB(), fx: { emb2: new VB() } };
    tube(orn.chrome, [0, -0.1, 0], [0, 0.05, 0], 0.01, SL, 8);
    orn.chrome.box(-0.006, 0.03, -0.004, 0.006, 0.15, 0.004, SL); orn.chrome.box(-0.05, 0.084, -0.004, 0.05, 0.096, 0.004, SL);
    orn.chrome.box(-0.03, 0.06, -0.004, 0.03, 0.12, 0.004, SL, 0, 0, Math.PI / 4);
    orn.fx.emb2.box(-0.012, 0.078, 0.005, 0.012, 0.102, 0.011, EMB, 0, 0, Math.PI / 4);
    return { gloss, matte, sglass, chrome, fx, mov: { orn }, wheel: tireGeo(WR, WW), rim: rimGeo2(WR, WW, { n: 7, twin: true, c: 0xd6dadf, lip: 0xeef0f2, wd: 0.022 }), wheels, wr: WR,
      efx: { kind: 'sovereign', screens: [{ id: 'cluster', p: [0.4, 0.93, 0.56], w: 0.28, h: 0.1, rx: -0.5 }, { id: 'center', p: [0, 0.94, 0.58], w: 0.32, h: 0.13, rx: -0.45 }],
        under: null, puddle: [[1.25, -0.55], [-1.25, -0.55]], beams: [[0.6, 0.78, 2.54], [-0.6, 0.78, 2.54]], trail: { y: 0.7, z0: -2.2, z1: 2.0, x: 0.97 } } };
  }
  // ---------- 크리스마스 EXCLUSIVE: RUDOLPH EXPRESS (UAZ 자리 — 좌석·물리·충돌은 UAZ 그대로) ----------
  //  붉은 옻칠 썰매(금 테 · 앞으로 말린 금 날 · 벨벳 의자 둘 · 뒤 선물 자루 · 앞 랜턴 둘 · 둘레 요정 전구 · 뒤 금별) + 앞에서 끄는 루돌프
  //  움직이는 부품(mov): 루돌프 다리 넷(어깨·엉덩이 축) · 머리(목 축, 빛나는 코 fx 포함) → 08_vehicle_eps.js 'sleigh' 가 달리기에 맞춰 흔듦
  //  fx: hl0 루돌프 코 · hl1·hl2 랜턴 · hl3·hl4 요정 전구 · emb 뒤 금별 · amb 의자 둘레 빛 / 바퀴는 날 사이에 숨긴 작은 바퀴(보이지 않음)
  function buildSleigh(sk) {
    const RD = 0x9e0f1a, RD2 = 0x6a0a14, GD = 0xe2bd58, FUR = 0x7a5232, FUR2 = 0xb08a5a, DK = 0x1a1210, VEL = 0x5a0a14, CR = 0xf4f2ee;
    const gloss = new VB(), matte = new VB(), chrome = new VB();
    const fx = { hl0: new VB(), hl1: new VB(), hl2: new VB(), hl3: new VB(), hl4: new VB(), emb: new VB(), amb: new VB() };
    const WR = 0.03, WW = 0.03, wheels = [[0.5, 0.44, 0.6, 1], [-0.5, 0.44, 0.6, 1], [0.5, 0.44, -1.2, 0], [-0.5, 0.44, -1.2, 0]];   // 바닥판 속에 숨김
    // ----- 금 날(앞이 위로 말림) + 받침대 -----
    const RUN = [[-2.05, 0.34], [-2.12, 0.2], [-1.98, 0.07], [-1.0, 0.06], [0.4, 0.06], [0.95, 0.1], [1.2, 0.26], [1.3, 0.5], [1.22, 0.68], [1.07, 0.7], [1.02, 0.58]];
    for (const s of [1, -1]) {
      curve(chrome, RUN.map(([z, y]) => [s * 0.74, y, z]), 0.04, GD, 8);
      for (const z of [-1.6, -0.6, 0.3]) tube(chrome, [s * 0.74, 0.08, z], [s * 0.7, 0.44, z], 0.028, GD, 6);
    }
    // ----- 썰매 몸통: 바닥 · 옆판(윤곽을 돌출) · 앞판 · 등판 -----
    gloss.box(-0.72, 0.4, -1.95, 0.72, 0.48, 0.92, RD2);
    const SIDE = [[0.95, 0.42], [-1.95, 0.42], [-2.05, 0.6], [-2.08, 0.95], [-2.0, 1.3], [-1.86, 1.5], [-1.7, 1.52], [-1.62, 1.38], [-1.4, 1.12], [-0.9, 1.0], [0.1, 0.98], [0.5, 0.92], [0.75, 0.98], [0.92, 1.12], [1.02, 1.08], [1.04, 0.9], [1.0, 0.6]];
    for (const s of [1, -1]) gloss.add(aurShape(SIDE, 0.05, 'zy', 0.01), mtx(s > 0 ? 0.71 : -0.76, 0, 0), RD);
    const TOP = [[-1.7, 1.53], [-1.62, 1.39], [-1.4, 1.13], [-0.9, 1.01], [0.1, 0.99], [0.5, 0.93], [0.75, 0.99], [0.92, 1.13], [1.02, 1.09]];
    for (const s of [1, -1]) { curve(chrome, TOP.map(([z, y]) => [s * 0.77, y, z]), 0.018, GD, 6); curve(chrome, [[-1.95, 0.5], [0.95, 0.5]].map(([z, y]) => [s * 0.775, y, z]), 0.012, GD, 6); }
    gloss.box(-0.71, 0.48, 0.86, 0.71, 0.96, 0.94, RD); curve(chrome, [[-0.7, 0.97, 0.9], [0, 1.0, 0.92], [0.7, 0.97, 0.9]], 0.016, GD, 6);
    gloss.box(-0.71, 0.48, -2.0, 0.71, 1.42, -1.92, RD);
    // 앞 소용돌이 장식 · 뒤 금별(빛남)
    for (const s of [1, -1]) chrome.add(new THREE.TorusGeometry(0.07, 0.016, 6, 16), mtx(s * 0.78, 1.0, 1.0, 0, Math.PI / 2, 0), GD);
    { const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.07 : 0.17; i ? st.lineTo(Math.cos(a) * r, Math.sin(a) * r) : st.moveTo(Math.cos(a) * r, Math.sin(a) * r); } st.closePath();
      const sg = new THREE.ExtrudeGeometry(st, { depth: 0.02, bevelEnabled: false }); chrome.add(sg, mtx(0, 1.1, -2.03, 0, Math.PI, 0), GD);
      const sg2 = new THREE.ShapeGeometry(st); sg2.scale(0.6, 0.6, 1); fx.emb.add(sg2, mtx(0, 1.1, -2.035, 0, Math.PI, 0), 0xfff0c0); }
    // ----- 벨벳 의자 둘(UAZ 좌석 높이) · 금 테두리 · 뒤 선물 자루 -----
    for (const [z0, z1, bz] of [[-0.35, 0.3, -0.38], [-1.3, -0.72, -1.36]]) {
      matte.box(-0.68, 0.48, z0, 0.68, 0.86, z1, VEL); matte.box(-0.68, 0.86, bz - 0.06, 0.68, 1.32, bz + 0.04, VEL, -0.12);
      curve(chrome, [[-0.68, 0.87, z1], [0.68, 0.87, z1]], 0.012, GD, 5); curve(chrome, [[-0.68, 1.33, bz], [0.68, 1.33, bz]], 0.014, GD, 5);
      for (let i = -2; i <= 2; i++) ball(matte, i * 0.26, 1.08, bz + 0.05, 0.02, 0.02, 0.01, 0x3a0610, 6);
      for (const x of [-0.5, 0.5]) fx.amb.box(x - 0.12, 0.47, z1 - 0.02, x + 0.12, 0.49, z1 + 0.005, 0xffe0a0);
    }
    ball(matte, 0, 1.0, -1.68, 0.52, 0.46, 0.2, 0x7a5a32, 12); ball(matte, 0, 1.42, -1.68, 0.16, 0.08, 0.12, 0x6a4a28, 10);
    for (const [x, y, s, c] of [[-0.25, 1.4, 0.16, 0x2a7a3a], [0.2, 1.45, 0.14, 0x2a5ac8], [0.02, 1.52, 0.12, 0xe8c45a]]) { matte.box(x - s / 2, y - s / 2, -1.76, x + s / 2, y + s / 2, -1.76 + s, c, 0.2, x * 2, 0); chrome.box(x - 0.012, y - s / 2, -1.77, x + 0.012, y + s / 2 + 0.005, -1.76 + s + 0.01, GD, 0.2, x * 2, 0); }
    // ----- 앞 랜턴 둘 (금 기둥 · 빛나는 등) + 고삐 손잡이(운전석 핸들 자리) -----
    for (const s of [1, -1]) {
      tube(chrome, [s * 0.72, 0.96, 0.9], [s * 0.72, 1.26, 0.9], 0.015, GD, 6);
      chrome.box(s * 0.72 - 0.07, 1.26, 0.83, s * 0.72 + 0.07, 1.28, 0.97, GD); chrome.box(s * 0.72 - 0.06, 1.44, 0.84, s * 0.72 + 0.06, 1.46, 0.96, GD);
      for (const dx of [-0.055, 0.055]) for (const dz of [-0.055, 0.055]) tube(chrome, [s * 0.72 + dx, 1.28, 0.9 + dz], [s * 0.72 + dx, 1.44, 0.9 + dz], 0.006, GD, 4);
      fx[s > 0 ? 'hl1' : 'hl2'].box(s * 0.72 - 0.045, 1.29, 0.855, s * 0.72 + 0.045, 1.43, 0.945, 0xffd890);
    }
    chrome.add(new THREE.TorusGeometry(0.1, 0.014, 6, 16), mtx(0.42, 1.25, 0.5, -0.6, 0, 0), GD);
    // 요정 전구: 옆판 위 금 테를 따라 (hl3·hl4 번갈아)
    for (const s of [1, -1]) TOP.forEach(([z, y], i) => { if (i % 1 === 0) ball(fx[(i + (s > 0 ? 0 : 1)) % 2 ? 'hl3' : 'hl4'], s * 0.78, y + 0.03, z, 0.026, 0.026, 0.026, i % 3 === 0 ? 0xff5a5a : i % 3 === 1 ? 0x7aff9a : 0xffe08a, 6); });
    // ----- 루돌프 (z 1.35 ~ 3.0): 몸통 · 목 · 고정 부분 / 다리 넷과 머리는 움직이는 부품 -----
    ball(matte, 0, 1.02, 1.95, 0.26, 0.3, 0.6, FUR, 16); ball(matte, 0, 0.9, 1.95, 0.22, 0.2, 0.5, FUR2, 12); ball(matte, 0, 1.08, 2.38, 0.24, 0.28, 0.24, FUR, 12);
    tube(matte, [0, 1.18, 2.42], [0, 1.52, 2.6], 0.12, FUR, 10, 0.09); ball(matte, 0, 1.12, 1.36, 0.06, 0.07, 0.06, CR, 8);
    { const col = new THREE.TorusGeometry(0.16, 0.03, 8, 20); col.rotateX(-0.55); chrome.add(col, mtx(0, 1.3, 2.47), 0xc8202e); }
    for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; ball(chrome, Math.sin(a) * 0.17, 1.22 + Math.cos(a) * 0.02, 2.55 + Math.cos(a) * 0.06, 0.03, 0.03, 0.03, GD, 8); }
    { const hb = new THREE.TorusGeometry(0.29, 0.024, 6, 24); chrome.add(hb, mtx(0, 1.02, 2.15), 0xc8202e); }
    for (const s of [1, -1]) { tube(chrome, [s * 0.42, 0.72, 0.95], [s * 0.3, 1.0, 1.8], 0.022, GD, 6); tube(matte, [0.42, 1.24, 0.52], [s * 0.13, 1.3, 2.47], 0.008, 0xc8202e, 4); }
    const leg = (x, y, z) => { const L = { pivot: [x, y, z], matte: new VB() }; tube(L.matte, [0, 0, 0], [0, -0.42, 0.03], 0.06, FUR, 8, 0.045); tube(L.matte, [0, -0.42, 0.03], [0, -0.82, 0], 0.036, FUR, 6, 0.03); L.matte.add(new THREE.CylinderGeometry(0.04, 0.046, 0.07, 8), mtx(0, -0.85, 0.005), DK); return L; };
    const head = { pivot: [0, 1.45, 2.56], matte: new VB(), chrome: new VB(), fx: { hl0: new VB() } };
    { const H = head, P0 = H.pivot, at = (x, y, z) => [x - P0[0], y - P0[1], z - P0[2]];
      ball(H.matte, ...at(0, 1.66, 2.72), 0.12, 0.12, 0.18, FUR, 14); ball(H.matte, ...at(0, 1.6, 2.86), 0.08, 0.075, 0.1, FUR2, 10);
      for (const s of [1, -1]) { ball(H.matte, ...at(s * 0.075, 1.71, 2.8), 0.02, 0.02, 0.016, 0x0a0a0c, 6); ball(H.matte, ...at(s * 0.13, 1.76, 2.66), 0.06, 0.022, 0.035, FUR2, 8);
        const A = [[s * 0.06, 1.77, 2.68], [s * 0.14, 1.98, 2.6], [s * 0.2, 2.12, 2.5]].map((p) => at(...p)); curve(H.matte, A, 0.016, 0x4a2e1a, 6);
        tube(H.matte, at(s * 0.14, 1.98, 2.6), at(s * 0.08, 2.1, 2.7), 0.011, 0x4a2e1a, 5); tube(H.matte, at(s * 0.18, 2.06, 2.55), at(s * 0.29, 2.14, 2.6), 0.011, 0x4a2e1a, 5); }
      ball(H.fx.hl0, ...at(0, 1.61, 2.97), 0.052, 0.05, 0.05, 0xff2a2a, 12); }
    const mov = { head, legFL: leg(0.14, 0.92, 2.3), legFR: leg(-0.14, 0.92, 2.3), legBL: leg(0.14, 0.92, 1.55), legBR: leg(-0.14, 0.92, 1.55) };
    return { gloss, matte, chrome, fx, mov, wheel: tireGeo(WR, WW), rim: rimGeo(WR, WW, 3, true), wheels, wr: WR,
      efx: { kind: 'sleigh', screens: [], under: { w: 1.7, l: 3.4, z: -0.5 }, beams: [], trail: { y: 0.12, z0: -1.9, z1: 0.9, x: 0.74 } } };
  }
  for (const [id, sk] of Object.entries(VSKINS)) {
    if (sk.cls === 'sleigh') { VehModels.register(id, () => buildSleigh(sk)); continue; }
    if (sk.cls === 'sport') VehModels.register(id, () => buildSport(sk));
    else if (sk.cls === 'lux') VehModels.register(id, () => buildLux(sk));
    else if (sk.cls === 'hyper') VehModels.register(id, () => buildHyper(sk));
    else if (sk.cls === 'imperial') VehModels.register(id, () => buildImperial(sk));
    else if (sk.cls === 'aurelion') VehModels.register(id, () => buildAurelion(sk));
    else if (sk.cls === 'titan') VehModels.register(id, () => buildTitan(sk));
    else if (sk.cls === 'sovereign') VehModels.register(id, () => buildSovereign(sk));
    else if (sk.cls === 'racer' || sk.cls === 'cruiser') VehModels.register(id, () => buildMotoSkin(sk, sk.cls));
    else if (sk.veh === 'horse') VehModels.register(id, () => K.buildHorse(HORSE[sk.cls]));
  }
})();
