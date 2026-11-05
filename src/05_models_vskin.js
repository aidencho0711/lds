// ============================================================
// 05_models_vskin.js — 차량 스킨 모델 + 목록 (상점 차량 뽑기·교환소)
//  · 승용차(세단) 스킨: 스포츠카(스트라이커 GT) · 럭셔리카(엠버서더 L) · 하이퍼카(펄스 X9, 지붕 없는 스피드스터)
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
  // 실내 기본: 앞좌석 2 + 뒷좌석(2+2) + 대시보드
  function interior(matte, seatC, rear = true, backH = 1.2) {
    for (const s of [1, -1]) { matte.box(s * 0.18, 0.4, -0.48, s * 0.62, 0.6, -0.05, seatC); matte.box(s * 0.18, 0.58, -0.56, s * 0.62, backH, -0.44, seatC, -0.2); }
    if (rear) { matte.box(-0.7, 0.4, -1.42, 0.7, 0.6, -0.98, seatC); matte.box(-0.7, 0.58, -1.5, 0.7, 1.02, -1.4, seatC, -0.22); }
    matte.box(-0.8, 0.72, 0.5, 0.8, 0.9, 0.95, 0x1b1c1e);
    steering(matte);
  }

  // ---------- 스포츠카: 낮은 쿠페, 긴 보닛·짧은 꼬리, 넓은 뒤 펜더, 덕테일 스포일러, 둥근 등 4개 ----------
  function buildSport(sk) {
    const P = sk.paint, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB(), gloss = new VB();
    const low = [[-2.28, 0.42], [-2.22, 0.32], ...arch(-1.4, 0.33, 0.44), ...arch(1.38, 0.32, 0.42), [2.24, 0.3], [2.34, 0.4], [2.33, 0.53], [2.2, 0.64], [1.7, 0.77], [0.95, 0.84], [0.2, 0.9], [-1.0, 0.93], [-1.75, 0.92], [-2.2, 0.9], [-2.3, 0.78]];
    paint.add(side(low, 1.84), null, P);
    // 넓은 뒤 펜더(어깨) + 앞 펜더 볼륨
    for (const s of [1, -1]) { ball(paint, s * 0.86, 0.66, -1.38, 0.1, 0.22, 0.62, P, 12); ball(paint, s * 0.84, 0.64, 1.38, 0.08, 0.17, 0.55, P, 12); }
    // 낮은 지붕(패스트백) 유리 + 지붕
    glass.add(side([[0.9, 0.84], [0.25, 1.3], [-0.55, 1.36], [-1.75, 0.95]], 1.56), null, 0xffffff);
    paint.box(-0.76, 1.32, -0.62, 0.76, 1.38, 0.22, P);
    for (const s of [1, -1]) {
      tube(paint, [s * 0.77, 0.86, 0.88], [s * 0.77, 1.33, 0.22], 0.03, P, 6);
      tube(paint, [s * 0.77, 1.35, -0.6], [s * 0.8, 0.93, -1.72], 0.05, P, 6);
      paint.box(s * 0.92, 0.88, 0.62, s * 1.0, 0.95, 0.76, P);   // 미러
      matte.box(s * 0.915, 0.4, -0.12, s * 0.92, 0.88, -0.1, TRIM);  // 문틈
      // 둥근 전조등 2개씩 + 가는 후미등 줄
      const hl = new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14); hl.rotateX(Math.PI / 2 - 0.35); lamp.add(hl, mtx(s * 0.6, 0.6, 2.24), 0); chrome.add(new THREE.TorusGeometry(0.074, 0.01, 6, 16), mtx(s * 0.6, 0.6, 2.25, -0.35, 0, 0), 0xdde2e5);
      tail.box(s * 0.35, 0.8, -2.31, s * 0.84, 0.84, -2.27, 0);
      // 옆 공기 흡입구
      matte.box(s * 0.925, 0.5, -0.95, s * 0.93, 0.62, -0.6, 0x111111);
      // 쌍 배기구
      const ex = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12); ex.rotateX(Math.PI / 2); chrome.add(ex, mtx(s * 0.3, 0.36, -2.29), 0xdde2e5);
    }
    // 앞 그릴(낮고 넓은 입) + 범퍼 립
    matte.box(-0.55, 0.36, 2.29, 0.55, 0.5, 2.335, 0x101112);
    matte.box(-0.9, 0.28, 2.2, 0.9, 0.33, 2.36, 0x111111);
    // 덕테일 + 레이싱 줄(가운데 두 줄)
    paint.box(-0.82, 0.9, -2.3, 0.82, 0.96, -2.05, P, 0.12);
    if (sk.accent !== undefined) for (const x of [-0.14, 0.14]) { gloss.box(x - 0.08, 0.905, 0.95, x + 0.08, 0.915, 2.2, sk.accent, -0.12); gloss.box(x - 0.08, 1.383, -0.6, x + 0.08, 1.388, 0.2, sk.accent); gloss.box(x - 0.08, 0.93, -2.0, x + 0.08, 0.94, -1.78, sk.accent); }
    interior(matte, 0x2a1414);
    matte.box(-0.3, 0.6, -2.3, 0.3, 0.75, -2.28, 0xd8d4c4);
    return { paint, matte, glass, lamp, tail, chrome, gloss, wheel: tire(0.34, 0.26), rim: rimGeo(0.34, 0.26, 5), wheels: [[0.82, 0.34, 1.38, 1], [-0.82, 0.34, 1.38, 1], [0.84, 0.34, -1.4, 0], [-0.84, 0.34, -1.4, 0]], wr: 0.34 };
  }
  // ---------- 럭셔리카: 길고 높은 세단, 곧게 선 크롬 그릴, 크롬 창틀, 넓은 C필러, 투톤 지붕 ----------
  function buildLux(sk) {
    const P = sk.paint, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB(), gloss = new VB();
    const low = [[-2.32, 0.5], [-2.27, 0.36], ...arch(-1.45, 0.36, 0.45), ...arch(1.45, 0.36, 0.45), [2.25, 0.36], [2.34, 0.5], [2.34, 0.86], [2.25, 0.96], [1.2, 1.0], [-1.6, 1.02], [-2.25, 1.0], [-2.33, 0.86]];
    paint.add(side(low, 1.84), null, P);
    glass.add(side([[1.0, 1.0], [0.3, 1.47], [-1.0, 1.5], [-1.45, 1.02]], 1.7), null, 0xffffff);
    gloss.box(-0.86, 1.47, -1.02, 0.86, 1.54, 0.32, sk.roof !== undefined ? sk.roof : P);   // 지붕(투톤)
    for (const s of [1, -1]) {
      tube(paint, [s * 0.86, 1.0, 0.98], [s * 0.86, 1.49, 0.3], 0.035, P, 6);
      paint.box(s * 0.82, 1.0, -1.5, s * 0.88, 1.5, -0.98, P);                 // 넓은 C필러
      paint.box(s * 0.82, 1.0, -0.3, s * 0.88, 1.49, -0.2, P);                 // B필러
      chrome.box(s * 0.875, 1.0, -1.0, s * 0.89, 1.02, 0.95, 0xe8ecef);      // 크롬 창틀 아래
      tube(chrome, [s * 0.87, 1.48, 0.32], [s * 0.87, 1.5, -0.98], 0.012, 0xe8ecef, 6);
      chrome.box(s * 0.92, 0.55, -1.9, s * 0.925, 0.58, 1.9, 0xe8ecef);       // 옆 크롬 몰딩
      paint.box(s * 0.92, 0.98, 0.78, s * 1.0, 1.07, 0.92, P);
      matte.box(s * 0.92, 0.42, 0.0, s * 0.925, 0.98, 0.02, TRIM); matte.box(s * 0.92, 0.42, -1.02, s * 0.925, 1.0, -1.0, TRIM);
      chrome.box(s * 0.925, 0.8, 0.25, s * 0.935, 0.82, 0.45, 0xe8ecef); chrome.box(s * 0.925, 0.82, -0.82, s * 0.935, 0.84, -0.62, 0xe8ecef);
      // 가늘고 긴 전조등 + 세로 후미등
      lamp.box(s * 0.55, 0.78, 2.3, s * 0.86, 0.86, 2.345, 0);
      tail.box(s * 0.7, 0.62, -2.345, s * 0.88, 0.94, -2.3, 0);
    }
    // 곧게 선 그릴: 크롬 테 + 세로 살
    chrome.box(-0.36, 0.5, 2.33, 0.36, 0.94, 2.36, 0xe8ecef);
    matte.box(-0.32, 0.53, 2.355, 0.32, 0.91, 2.365, 0x0d0e0f);
    for (let i = -6; i <= 6; i++) chrome.box(i * 0.05 - 0.008, 0.54, 2.36, i * 0.05 + 0.008, 0.9, 2.375, 0xe8ecef);
    ball(chrome, 0, 0.99, 2.28, 0.03, 0.05, 0.02, 0xe8ecef, 10);   // 보닛 장식(추상 날개 모양 대신 둥근 표식)
    chrome.box(-0.92, 0.4, 2.3, 0.92, 0.46, 2.4, 0xe8ecef); chrome.box(-0.92, 0.4, -2.4, 0.92, 0.46, -2.3, 0xe8ecef);   // 크롬 범퍼
    interior(matte, 0xc9b79a, true, 1.28);
    matte.box(-0.3, 0.6, -2.36, 0.3, 0.75, -2.345, 0xd8d4c4);
    return { paint, matte, glass, lamp, tail, chrome, gloss, wheel: tire(0.36, 0.25), rim: rimGeo(0.36, 0.25, 8, true), wheels: [[0.8, 0.36, 1.45, 1], [-0.8, 0.36, 1.45, 1], [0.8, 0.36, -1.45, 0], [-0.8, 0.36, -1.45, 0]], wr: 0.36 };
  }
  // ---------- 하이퍼카: 지붕 없는 스피드스터. 쐐기 차체, 낮은 바람막이, 롤 후프, 큰 뒷날개, 빛나는 띠 ----------
  function buildHyper(sk) {
    const P = sk.paint, CB = sk.carbon, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB(), chrome = new VB(), gloss = new VB(), glow = new VB();
    const low = [[-2.3, 0.4], [-2.25, 0.28], ...arch(-1.36, 0.3, 0.45), ...arch(1.42, 0.3, 0.42), [2.26, 0.26], [2.36, 0.3], [2.3, 0.42], [2.0, 0.6], [1.42, 0.76], [0.8, 0.79], [0.45, 0.8], [-0.5, 0.8], [-1.4, 0.84], [-2.0, 0.86], [-2.3, 0.7]];
    gloss.add(side(low, 1.9), null, P);
    // 탄소 부품: 앞 날개(스플리터)·옆 흡입구·디퓨저
    matte.box(-0.98, 0.22, 2.1, 0.98, 0.26, 2.42, CB);
    for (const s of [1, -1]) {
      matte.box(s * 0.94, 0.36, -1.0, s * 0.97, 0.66, -0.3, CB);
      ball(gloss, s * 0.88, 0.6, -1.36, 0.12, 0.24, 0.66, P, 12);
      ball(gloss, s * 0.86, 0.52, 1.42, 0.1, 0.2, 0.6, P, 12);
      // 롤 후프(좌석 뒤) + 낮은 바람막이 틀
      tube(matte, [s * 0.4, 0.8, -0.72], [s * 0.4, 1.32, -0.74], 0.05, CB, 8);
      ball(matte, s * 0.4, 1.33, -0.74, 0.07, 0.05, 0.07, CB, 10);
      tube(matte, [s * 0.4, 1.3, -0.76], [s * 0.4, 0.86, -1.5], 0.035, CB, 6);
      // 뒷날개 기둥
      tube(matte, [s * 0.55, 0.86, -1.95], [s * 0.55, 1.22, -2.1], 0.025, CB, 6);
      // 전조등: 가는 빛 띠, 후미등: 빛 띠
      glow.box(s * 0.45, 0.47, 2.2, s * 0.88, 0.5, 2.28, sk.glow, 0, s * 0.25, 0);
      tail.box(s * 0.25, 0.7, -2.31, s * 0.9, 0.73, -2.29, 0);
      // 바닥 조명(차체 아래 옆)
      glow.box(s * 0.9, 0.2, -1.0, s * 0.93, 0.215, 1.0, sk.glow);
      paint.box(s * 0.94, 0.72, 0.42, s * 1.02, 0.8, 0.56, P);
    }
    glass.add(side([[0.6, 0.79], [0.25, 1.02], [0.18, 1.02], [0.5, 0.79]], 1.5), null, 0xffffff);   // 낮은 바람막이
    // 실내(어두운 통) + 좌석 등받이 + 머리받이 혹(뒤 데크)
    matte.box(-0.78, 0.805, -1.5, 0.78, 0.815, 0.45, 0x0f1012);
    for (const s of [1, -1]) { matte.box(s * 0.18, 0.4, -0.48, s * 0.62, 0.6, -0.05, 0x141416); matte.box(s * 0.18, 0.58, -0.62, s * 0.62, 1.16, -0.5, 0x141416, -0.25); ball(gloss, s * 0.4, 0.88, -1.15, 0.24, 0.12, 0.4, P, 12); }
    matte.box(-0.7, 0.4, -1.42, 0.7, 0.6, -0.98, 0x141416);
    matte.box(-0.78, 0.72, 0.42, 0.78, 0.86, 0.8, 0x111214);
    steering(matte);
    // 큰 뒷날개
    gloss.box(-0.98, 1.2, -2.24, 0.98, 1.24, -1.96, P, 0.12);
    for (const s of [1, -1]) matte.box(s * 0.97, 1.08, -2.26, s * 1.0, 1.3, -1.94, CB);
    // 디퓨저 지느러미
    for (let i = -3; i <= 3; i++) matte.box(i * 0.14 - 0.01, 0.2, -2.32, i * 0.14 + 0.01, 0.34, -2.0, CB);
    const ex = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14); ex.rotateX(Math.PI / 2); chrome.add(ex, mtx(0, 0.5, -2.3), 0xbfc4c8);
    return { paint, matte, glass, lamp, tail, chrome, gloss, glow, wheel: tire(0.35, 0.3), rim: rimGeo(0.35, 0.3, 10, true), wheels: [[0.85, 0.35, 1.42, 1], [-0.85, 0.35, 1.42, 1], [0.87, 0.35, -1.36, 0], [-0.87, 0.35, -1.36, 0]], wr: 0.35 };
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
