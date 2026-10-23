// ============================================================
// 05_models_veh.js — 차량 3D 모델 (말·오토바이·UAZ·세단·픽업트럭)
//  · 같은 종류는 모양·색이 완전히 같다 → 종류별로 지오메트리를 한 번만 만들고 모든 차량이 공유
//  · 차체는 옆모습 윤곽을 폭만큼 돌출(바퀴 아치 포함)한 뒤 유리·범퍼·등화·실내를 붙인다
//  · 재질 4종(도장/무광/유리/등화)에 정점 색 → 차량 1대당 드로우콜 6~9개
//  · 로컬 좌표: +z 앞, +x 왼쪽(운전석), y 위, 원점은 차량 중심 아래 지면
//  · 움직이는 부품: 바퀴(회전), 앞바퀴 조향 축, 오토바이 핸들 뭉치, 말 다리·목·꼬리
// ============================================================
const VehModels = (() => {
  const GEO = {};
  let MAT = null;
  const V3 = THREE.Vector3;

  function mats() {
    if (MAT) return MAT;
    const env = Models.env, S = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap: env }, o));
    MAT = {
      paint: S({ vertexColors: true, roughness: 0.36, metalness: 0.42, envMapIntensity: 0.8 }),
      matte: S({ vertexColors: true, roughness: 0.82, metalness: 0.08, envMapIntensity: 0.25 }),
      coat: S({ vertexColors: true, roughness: 0.7, metalness: 0.0, envMapIntensity: 0.3 }),
      glass: S({ color: 0x1d2b33, roughness: 0.05, metalness: 0.55, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 1.5 }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xfff1cc }),
      tail: new THREE.MeshBasicMaterial({ color: 0xa8141a }),
      wreck: S({ color: 0x24211e, roughness: 0.95, metalness: 0.25, envMapIntensity: 0.1 }),
    };
    return MAT;
  }

  // ---------- 정점 묶음 (위치·법선·색) ----------
  class VB {
    constructor() { this.p = []; this.n = []; this.c = []; }
    add(g, m, color) {
      g = g.index ? g.toNonIndexed() : g.clone();
      if (m) g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position.array, N = g.attributes.normal.array, col = new THREE.Color(color);
      for (let i = 0; i < P.length; i += 3) { this.p.push(P[i], P[i + 1], P[i + 2]); this.n.push(N[i], N[i + 1], N[i + 2]); this.c.push(col.r, col.g, col.b); }
      g.dispose(); return this;
    }
    box(x0, y0, z0, x1, y1, z1, color, rx = 0, ry = 0, rz = 0) {
      return this.add(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mtx((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, rx, ry, rz), color);
    }
    // 좌우 대칭 상자 (x0~x1 은 양수 쪽)
    pair(x0, y0, z0, x1, y1, z1, color) { this.box(x0, y0, z0, x1, y1, z1, color); return this.box(-x1, y0, z0, -x0, y1, z1, color); }
    build() {
      if (!this.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      return g;
    }
  }
  const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')), new V3(sx, sy, sz));
  // 반원 아치 점 (뒤→앞, 위로 볼록)
  function arch(zc, yc, r, n = 9) { const o = []; for (let i = 0; i <= n; i++) { const a = Math.PI - i / n * Math.PI; o.push([zc + Math.cos(a) * r, yc + Math.sin(a) * r]); } return o; }
  // 옆모습 윤곽 [[z, y], ...] 을 폭 w로 돌출 (x 중심 cx)
  function side(pts, w, cx = 0) {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 6 });
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(cx + w / 2, 0, 0));
    return g;
  }
  // 두 점을 잇는 원기둥 (r0: a쪽, r1: b쪽)
  function tube(vb, a, b, r0, color, seg = 8, r1 = r0) {
    const A = new V3(...a), B = new V3(...b), d = new V3().subVectors(B, A), L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    vb.add(g, new THREE.Matrix4().compose(new V3().addVectors(A, B).multiplyScalar(0.5), q, new V3(1, 1, 1)), color);
  }
  function ball(vb, x, y, z, sx, sy, sz, color, seg = 12) { vb.add(new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6 | 0)), mtx(x, y, z, 0, 0, 0, sx, sy, sz), color); }
  // 바퀴: 타이어 + 휠 + 바퀴살(회전이 보이도록). 축은 x
  function wheelGeo(r, w, rim = 0xa8adb2, spokes = 5, tireC = 0x1b1b1c) {
    const vb = new VB();
    const tire = new THREE.CylinderGeometry(r, r, w, 20); tire.rotateZ(Math.PI / 2); vb.add(tire, null, tireC);
    const tread = new THREE.CylinderGeometry(r * 0.97, r * 0.97, w * 1.04, 20, 1, true); tread.rotateZ(Math.PI / 2); vb.add(tread, null, 0x0f0f10);
    const rimG = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.012, 14); rimG.rotateZ(Math.PI / 2); vb.add(rimG, null, rim);
    for (let i = 0; i < spokes; i++) { const a = i / spokes * Math.PI * 2; vb.box(-w / 2 - 0.012, -r * 0.05, -r * 0.5, w / 2 + 0.012, r * 0.05, r * 0.5, 0x55595d, a, 0, 0); }
    const hub = new THREE.CylinderGeometry(r * 0.16, r * 0.16, w + 0.03, 10); hub.rotateZ(Math.PI / 2); vb.add(hub, null, 0x2a2c2e);
    return vb.build();
  }
  const SEAT_C = 0x2b2d30, TRIM = 0x161718, CHROME = 0xb9bec2;

  // ---------- 세단 (기본 차량 1) ----------
  function buildSedan() {
    const P = 0x8e2328, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB();
    const low = [[-2.25, 0.5], [-2.2, 0.36], ...arch(-1.33, 0.34, 0.43), ...arch(1.33, 0.34, 0.43), [2.2, 0.36], [2.28, 0.5], [2.27, 0.7], [2.12, 0.84], [1.6, 0.9], [0.95, 0.96], [-1.2, 0.99], [-1.6, 1.01], [-2.15, 0.98], [-2.27, 0.86]];
    paint.add(side(low, 1.8), null, P);
    glass.add(side([[0.97, 0.95], [0.27, 1.4], [-0.8, 1.42], [-1.24, 0.98]], 1.66), null, 0xffffff);
    paint.box(-0.84, 1.39, -0.82, 0.84, 1.45, 0.29, P);                                 // 지붕
    for (const s of [1, -1]) {
      tube(paint, [s * 0.84, 0.96, 0.95], [s * 0.84, 1.42, 0.26], 0.035, P, 6);          // A 필러
      tube(paint, [s * 0.84, 1.43, -0.8], [s * 0.84, 0.99, -1.24], 0.045, P, 6);         // C 필러
      paint.box(s * 0.8, 0.96, -0.3, s * 0.86, 1.42, -0.2, P);                          // B 필러
      paint.box(s * 0.9, 0.95, 0.78, s * 1.0, 1.04, 0.92, P);                            // 사이드미러
      matte.box(s * 0.9, 0.4, -0.01, s * 0.905, 0.95, 0.01, TRIM); matte.box(s * 0.9, 0.4, -1.06, s * 0.905, 0.97, -1.04, TRIM); // 문틈
      matte.box(s * 0.903, 0.78, 0.25, s * 0.91, 0.8, 0.42, 0x555a5e); matte.box(s * 0.903, 0.8, -0.82, s * 0.91, 0.82, -0.65, 0x555a5e); // 손잡이
      lamp.box(s * 0.55, 0.66, 2.24, s * 0.83, 0.77, 2.285, 0);
      tail.box(s * 0.55, 0.78, -2.285, s * 0.86, 0.9, -2.24, 0);
    }
    matte.box(-0.87, 0.38, 2.18, 0.87, 0.6, 2.33, TRIM); matte.box(-0.87, 0.38, -2.33, 0.87, 0.58, -2.18, TRIM);   // 범퍼
    matte.box(-0.45, 0.6, 2.255, 0.45, 0.73, 2.285, 0x2a2c2f);                                                      // 그릴
    matte.box(-0.3, 0.6, -2.29, 0.3, 0.75, -2.27, 0xd8d4c4);                                                         // 번호판
    // 실내: 앞좌석 2, 뒷좌석, 대시보드, 핸들
    for (const s of [1, -1]) { matte.box(s * 0.18, 0.4, -0.48, s * 0.62, 0.62, -0.05, SEAT_C); matte.box(s * 0.18, 0.6, -0.56, s * 0.62, 1.22, -0.44, SEAT_C, -0.18); }
    matte.box(-0.72, 0.4, -1.15, 0.72, 0.62, -0.7, SEAT_C); matte.box(-0.72, 0.6, -1.25, 0.72, 1.12, -1.13, SEAT_C, -0.2);
    matte.box(-0.82, 0.72, 0.55, 0.82, 0.92, 0.98, 0x26282b);
    const wh = new THREE.TorusGeometry(0.17, 0.025, 6, 16); matte.add(wh, mtx(0.4, 0.98, 0.42, -0.45, 0, 0), 0x111213);
    return { paint, matte, glass, lamp, tail, wheel: wheelGeo(0.33, 0.22), wheels: [[0.79, 0.33, 1.33, 1], [-0.79, 0.33, 1.33, 1], [0.79, 0.33, -1.33, 0], [-0.79, 0.33, -1.33, 0]], wr: 0.33 };
  }
  // ---------- 픽업트럭 (기본 차량 2) ----------
  function buildPickup() {
    const P = 0x2f5874, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB();
    const low = [[-2.6, 0.55], [-2.55, 0.46], ...arch(-1.6, 0.46, 0.53), ...arch(1.62, 0.46, 0.53), [2.55, 0.46], [2.62, 0.58], [2.62, 1.0], [2.5, 1.12], [1.25, 1.2], [-0.45, 1.23], [-0.45, 0.86], [-2.6, 0.86]];
    paint.add(side(low, 1.95), null, P);
    glass.add(side([[1.23, 1.2], [0.56, 1.7], [-0.36, 1.72], [-0.41, 1.22]], 1.82), null, 0xffffff);
    paint.box(-0.93, 1.69, -0.43, 0.93, 1.78, 0.6, P);
    for (const s of [1, -1]) {
      tube(paint, [s * 0.92, 1.21, 1.22], [s * 0.92, 1.72, 0.55], 0.04, P, 6);
      paint.box(s * 0.88, 1.22, -0.1, s * 0.94, 1.72, 0.0, P);
      paint.box(s * 0.89, 0.86, -2.6, s * 0.975, 1.25, -0.45, P);                        // 적재함 옆벽
      paint.box(s * 0.97, 1.12, 0.92, s * 1.08, 1.24, 1.06, P);                          // 미러
      matte.box(s * 0.975, 0.5, 0.0, s * 0.98, 1.2, 0.02, TRIM);
      matte.box(s * 0.976, 0.95, -0.35, s * 0.985, 0.98, -0.18, 0x555a5e);
      // 바퀴 펜더 몰딩
      tube(matte, [s * 0.985, 0.98, -2.05], [s * 0.985, 0.98, -1.15], 0.03, TRIM, 6); tube(matte, [s * 0.985, 0.98, 1.17], [s * 0.985, 0.98, 2.07], 0.03, TRIM, 6);
      lamp.box(s * 0.6, 0.82, 2.6, s * 0.9, 0.96, 2.635, 0);
      tail.box(s * 0.87, 0.92, -2.635, s * 0.975, 1.2, -2.6, 0);
      // 롤바
      tube(matte, [s * 0.86, 1.23, -0.72], [s * 0.86, 1.78, -0.72], 0.04, TRIM, 8);
    }
    tube(matte, [-0.86, 1.78, -0.72], [0.86, 1.78, -0.72], 0.04, TRIM, 8);
    paint.box(-0.975, 0.86, -2.62, 0.975, 1.23, -2.55, P);                                   // 뒷문(테일게이트)
    matte.box(-0.89, 0.86, -2.55, 0.89, 0.885, -0.47, 0x222326);                             // 적재함 바닥
    matte.box(-0.97, 0.45, 2.58, 0.97, 0.66, 2.74, 0x9ea3a7);                                // 앞 범퍼(크롬 느낌)
    matte.box(-0.97, 0.48, -2.72, 0.97, 0.64, -2.6, 0x3a3c40);
    matte.box(-0.58, 0.66, 2.62, 0.58, 0.98, 2.645, 0x1c1d20);                               // 큰 그릴
    for (let i = -2; i <= 2; i++) matte.box(i * 0.2 - 0.07, 0.68, 2.64, i * 0.2 + 0.07, 0.96, 2.66, 0x8b9094);
    for (const s of [1, -1]) matte.box(s * 0.12, 0.75, -0.05, s * 0.75, 1.0, 0.45, SEAT_C), matte.box(s * 0.12, 0.98, -0.2, s * 0.75, 1.6, -0.08, SEAT_C, -0.12);
    matte.box(-0.9, 1.0, 0.8, 0.9, 1.18, 1.2, 0x26282b);
    matte.add(new THREE.TorusGeometry(0.18, 0.026, 6, 16), mtx(0.42, 1.24, 0.72, -0.5, 0, 0), 0x111213);
    return { paint, matte, glass, lamp, tail, wheel: wheelGeo(0.42, 0.28, 0x8d9296, 6), wheels: [[0.86, 0.42, 1.62, 1], [-0.86, 0.42, 1.62, 1], [0.86, 0.42, -1.6, 0], [-0.86, 0.42, -1.6, 0]], wr: 0.42 };
  }
  // ---------- UAZ (군용 지프) ----------
  function buildUaz() {
    const P = 0x4f5a37, CANVAS = 0x7b7457, paint = new VB(), matte = new VB(), glass = new VB(), lamp = new VB(), tail = new VB();
    const low = [[-2.05, 0.62], [-2.0, 0.5], ...arch(-1.18, 0.48, 0.56), ...arch(1.22, 0.48, 0.56), [1.98, 0.5], [2.06, 0.62], [2.06, 1.12], [1.98, 1.2], [1.0, 1.24], [-2.05, 1.27]];
    paint.add(side(low, 1.85), null, P);
    // 캔버스 지붕
    matte.add(side([[0.98, 1.27], [0.84, 1.88], [0.7, 1.95], [-1.95, 1.97], [-2.03, 1.9], [-2.04, 1.27]], 1.8), null, CANVAS);
    // 앞유리 (거의 수직) + 틀
    glass.add(side([[1.0, 1.27], [0.88, 1.84], [0.85, 1.84], [0.97, 1.27]], 1.62), null, 0xffffff);
    for (const s of [1, -1]) {
      tube(paint, [s * 0.86, 1.25, 1.0], [s * 0.86, 1.88, 0.86], 0.04, P, 6);
      glass.box(s * 0.9, 1.42, 0.06, s * 0.912, 1.8, 0.78, 0); glass.box(s * 0.9, 1.42, -0.85, s * 0.912, 1.8, -0.06, 0); glass.box(s * 0.9, 1.45, -1.85, s * 0.912, 1.78, -1.05, 0);
      paint.box(s * 0.86, 0.98, 0.6, s * 0.99, 1.08, 1.86, P);                               // 앞 펜더
      paint.box(s * 0.86, 0.98, -1.78, s * 0.99, 1.08, -0.58, P);                             // 뒤 펜더
      matte.box(s * 0.925, 0.55, 0.0, s * 0.93, 1.24, 0.02, TRIM); matte.box(s * 0.925, 0.55, -0.9, s * 0.93, 1.24, -0.88, TRIM);
      matte.box(s * 0.928, 1.1, 0.5, s * 0.94, 1.13, 0.68, 0x3a3c35);
      const hl = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14); hl.rotateX(Math.PI / 2);
      lamp.add(hl, mtx(s * 0.62, 0.96, 2.08), 0); matte.add(new THREE.CylinderGeometry(0.135, 0.135, 0.05, 14).rotateX(Math.PI / 2), mtx(s * 0.62, 0.96, 2.06), 0x2a2d25);
      tail.box(s * 0.7, 0.9, -2.07, s * 0.86, 1.02, -2.04, 0);
      paint.box(s * 0.95, 1.12, 1.05, s * 1.06, 1.26, 1.15, P);                              // 미러
    }
    for (let i = -3; i <= 3; i++) matte.box(i * 0.12 - 0.035, 0.72, 2.06, i * 0.12 + 0.035, 1.06, 2.085, 0x1a1c17);   // 세로 그릴
    matte.box(-0.98, 0.5, 2.04, 0.98, 0.68, 2.2, 0x23251f); matte.box(-0.95, 0.52, -2.18, 0.95, 0.66, -2.04, 0x23251f);
    // 뒤 스페어타이어 (+ 안테나)
    const sp = new THREE.CylinderGeometry(0.4, 0.4, 0.24, 18); sp.rotateX(Math.PI / 2); matte.add(sp, mtx(0.32, 1.02, -2.2), 0x1b1b1c);
    const spr = new THREE.CylinderGeometry(0.24, 0.24, 0.26, 12); spr.rotateX(Math.PI / 2); matte.add(spr, mtx(0.32, 1.02, -2.2), 0x4a4f3a);
    tube(matte, [-0.85, 1.25, -1.95], [-0.85, 2.85, -1.98], 0.012, 0x1a1a1a, 4);
    for (const s of [1, -1]) matte.box(s * 0.12, 0.8, -0.3, s * 0.75, 1.05, 0.25, 0x3e3a2c), matte.box(s * 0.12, 1.03, -0.42, s * 0.75, 1.62, -0.3, 0x3e3a2c, -0.1);
    matte.box(-0.86, 1.0, 0.62, 0.86, 1.2, 0.98, 0x2c2f27);
    matte.add(new THREE.TorusGeometry(0.19, 0.028, 6, 16), mtx(0.42, 1.28, 0.5, -0.65, 0, 0), 0x111213);
    return { paint, matte, glass, lamp, tail, wheel: wheelGeo(0.44, 0.3, 0x4c5238, 6), wheels: [[0.8, 0.44, 1.22, 1], [-0.8, 0.44, 1.22, 1], [0.8, 0.44, -1.18, 0], [-0.8, 0.44, -1.18, 0]], wr: 0.44 };
  }
  // ---------- 오토바이 ----------
  function buildMoto() {
    const P = 0xd0561c, FR = 0x2b2d30, paint = new VB(), matte = new VB(), lamp = new VB(), tail = new VB();
    const sPaint = new VB(), sMatte = new VB(), sLamp = new VB();
    // 프레임
    tube(matte, [0, 0.98, 0.5], [0, 0.46, -0.08], 0.035, FR); tube(matte, [0, 0.98, 0.5], [0, 0.86, -0.35], 0.03, FR); tube(matte, [0, 0.86, -0.35], [0, 0.84, -0.86], 0.025, FR);
    tube(matte, [0, 0.46, -0.08], [0, 0.86, -0.35], 0.03, FR);
    for (const s of [1, -1]) tube(matte, [s * 0.085, 0.46, -0.1], [s * 0.085, 0.32, -0.7], 0.028, FR);
    // 엔진·탱크·시트
    matte.box(-0.15, 0.3, -0.12, 0.15, 0.66, 0.32, 0x6c7176);
    for (let i = 0; i < 4; i++) matte.box(-0.17, 0.5 + i * 0.045, 0.02, 0.17, 0.52 + i * 0.045, 0.3, 0x8a8f93);
    ball(paint, 0, 0.95, 0.25, 0.19, 0.13, 0.31, P, 14);
    paint.box(-0.05, 0.86, 0.05, 0.05, 0.92, 0.45, 0x1a1a1b);
    matte.box(-0.14, 0.88, -0.62, 0.14, 0.99, 0.04, 0x161617);
    paint.box(-0.085, 0.6, -1.02, 0.085, 0.65, -0.55, P, -0.25);                         // 뒷 펜더
    paint.box(-0.16, 0.62, -0.3, 0.16, 0.86, -0.05, P);                                    // 옆 커버
    tube(matte, [0.16, 0.38, 0.12], [0.2, 0.44, -0.6], 0.04, 0x9da2a6); tube(matte, [0.2, 0.44, -0.6], [0.22, 0.5, -0.95], 0.065, 0x7c8186);   // 배기관
    tail.box(-0.06, 0.7, -1.06, 0.06, 0.76, -1.02, 0);
    matte.box(-0.1, 0.52, -1.08, 0.1, 0.66, -1.06, 0xd8d4c4);
    // 핸들 뭉치(조향 축 기준 좌표: 축 = (0, 0.98, 0.52))
    for (const s of [1, -1]) tube(sMatte, [s * 0.085, 0.0, 0.0], [s * 0.085, -0.65, 0.22], 0.028, 0xb0b4b8);
    sMatte.box(-0.11, -0.05, -0.04, 0.11, 0.04, 0.06, FR);
    tube(sMatte, [-0.36, 0.17, -0.1], [0.36, 0.17, -0.1], 0.016, 0x1a1a1b); tube(sMatte, [-0.06, 0.04, 0.0], [-0.08, 0.17, -0.08], 0.018, FR); tube(sMatte, [0.06, 0.04, 0.0], [0.08, 0.17, -0.08], 0.018, FR);
    for (const s of [1, -1]) tube(sMatte, [s * 0.36, 0.17, -0.1], [s * 0.27, 0.17, -0.1], 0.026, 0x111111);
    const hl = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 14); hl.rotateX(Math.PI / 2); sMatte.add(hl, mtx(0, 0.02, 0.12), FR);
    const hlg = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14); hlg.rotateX(Math.PI / 2); sLamp.add(hlg, mtx(0, 0.02, 0.165), 0);
    sPaint.box(-0.075, -0.33, 0.12, 0.075, -0.28, 0.48, P, -0.45);                        // 앞 펜더
    return { paint, matte, lamp, tail, steer: { paint: sPaint, matte: sMatte, lamp: sLamp, pivot: [0, 0.98, 0.52] }, wheel: wheelGeo(0.33, 0.13, 0x8d9296, 6, 0x151515), wheels: [[0, 0.33, 0.74, 1], [0, 0.32, -0.7, 0]], wr: 0.33 };
  }
  // ---------- 말 ----------
  function buildHorse() {
    const COAT = 0x6a3f22, DARK = 0x231710, HOOF = 0x2a2420, LEATH = 0x3a2213;
    const coat = new VB(), matte = new VB();
    ball(coat, 0, 1.28, -0.05, 0.36, 0.38, 0.78, COAT, 16);       // 몸통
    ball(coat, 0, 1.31, 0.55, 0.34, 0.37, 0.4, COAT, 14);         // 가슴
    ball(coat, 0, 1.34, -0.68, 0.36, 0.37, 0.44, COAT, 14);       // 엉덩이
    ball(coat, 0, 1.12, -0.05, 0.3, 0.2, 0.6, 0x5c361d, 12);       // 배
    // 안장·안장 깔개·등자
    matte.box(-0.34, 1.62, -0.42, 0.34, 1.66, 0.32, 0x7a2a22);
    matte.box(-0.25, 1.64, -0.33, 0.25, 1.74, 0.22, LEATH); matte.box(-0.12, 1.72, 0.14, 0.12, 1.82, 0.24, LEATH); matte.box(-0.14, 1.72, -0.36, 0.14, 1.79, -0.26, LEATH);
    for (const s of [1, -1]) { tube(matte, [s * 0.27, 1.64, -0.02], [s * 0.33, 1.13, 0.0], 0.012, 0x2a1a10, 4); matte.box(s * 0.28, 1.08, -0.06, s * 0.38, 1.13, 0.06, 0x8a8f93); }
    tube(matte, [-0.33, 1.28, -0.02], [0.33, 1.28, -0.02], 0.025, 0x2a1a10, 6);            // 복대
    // 목·머리 (목 기준점 = (0, 1.5, 0.72))
    const neck = new VB();
    tube(neck, [0, -0.05, -0.04], [0, 0.6, 0.42], 0.23, COAT, 12, 0.15);
    for (let i = 0; i < 7; i++) { const t = i / 6; ball(neck, 0, 0.06 + t * 0.62 + 0.08, -0.17 + t * 0.44 + 0.02, 0.045, 0.09, 0.07, DARK, 8); }   // 갈기
    tube(neck, [0, 0.66, 0.4], [0, 0.4, 0.86], 0.15, COAT, 12, 0.095);                    // 머리
    ball(neck, 0, 0.42, 0.85, 0.1, 0.08, 0.08, 0x4a2c18, 10);                             // 주둥이
    for (const s of [1, -1]) {
      tube(neck, [s * 0.06, 0.74, 0.38], [s * 0.08, 0.88, 0.36], 0.035, COAT, 6, 0.008);  // 귀
      ball(neck, s * 0.115, 0.63, 0.55, 0.025, 0.03, 0.03, 0x0c0907, 8);                  // 눈
      tube(neck, [s * 0.1, 0.42, 0.78], [s * 0.15, 0.62, 0.45], 0.01, 0x1a120c, 4);        // 굴레
    }
    tube(neck, [-0.1, 0.43, 0.76], [0.1, 0.43, 0.76], 0.012, 0x1a120c, 4);
    // 고삐 (몸통 쪽, 고정)
    for (const s of [1, -1]) { tube(matte, [s * 0.1, 1.92, 1.48], [s * 0.15, 1.66, 0.95], 0.009, 0x1a120c, 4); tube(matte, [s * 0.15, 1.66, 0.95], [s * 0.12, 1.84, 0.22], 0.009, 0x1a120c, 4); }
    // 꼬리 (기준점 (0, 1.45, -1.05))
    const tail = new VB(); tube(tail, [0, 0.02, 0], [0, -0.3, -0.16], 0.055, DARK, 8, 0.07); tube(tail, [0, -0.3, -0.16], [0, -0.8, -0.2], 0.07, DARK, 8, 0.1); ball(tail, 0, -0.8, -0.2, 0.1, 0.06, 0.1, DARK, 8);
    // 다리 (윗다리: 0 → -L1, 아랫다리: 무릎 기준 0 → -L2)
    const legU = (L, r0, r1) => { const v = new VB(); tube(v, [0, 0.04, 0], [0, -L, 0], r0, COAT, 10, r1); return v.build(); };
    const legL = (L) => { const v = new VB(); tube(v, [0, 0, 0], [0, -L + 0.08, 0], 0.065, COAT, 8, 0.05); ball(v, 0, -L + 0.11, 0, 0.06, 0.05, 0.06, 0x3a261a, 8); const h = new THREE.CylinderGeometry(0.06, 0.075, 0.08, 10); v.add(h, mtx(0, -L + 0.04, 0.01), HOOF); return v.build(); };
    return {
      coat, matte, neckVB: neck, tailVB: tail,
      legs: [
        { pos: [0.16, 1.12, 0.6], up: legU(0.52, 0.13, 0.075), low: legL(0.55), L1: 0.52, front: 1 },
        { pos: [-0.16, 1.12, 0.6], up: legU(0.52, 0.13, 0.075), low: legL(0.55), L1: 0.52, front: 1 },
        { pos: [0.18, 1.2, -0.7], up: legU(0.6, 0.165, 0.08), low: legL(0.55), L1: 0.6, front: 0 },
        { pos: [-0.18, 1.2, -0.7], up: legU(0.6, 0.165, 0.08), low: legL(0.55), L1: 0.6, front: 0 },
      ],
    };
  }

  const BUILD = { sedan: buildSedan, pickup: buildPickup, uaz: buildUaz, moto: buildMoto, horse: buildHorse };
  function geos(type) {
    if (GEO[type]) return GEO[type];
    const B = BUILD[type](), o = { raw: B };
    for (const k of ['paint', 'matte', 'glass', 'lamp', 'tail', 'coat']) if (B[k]) o[k] = B[k].build();
    if (B.steer) o.steer = { paint: B.steer.paint.build(), matte: B.steer.matte.build(), lamp: B.steer.lamp.build(), pivot: B.steer.pivot };
    if (B.neckVB) { o.neck = B.neckVB.build(); o.tailG = B.tailVB.build(); }
    return (GEO[type] = o);
  }
  const mesh = (g, m, shadow) => { if (!g) return null; const x = new THREE.Mesh(g, m); x.castShadow = !!shadow; x.receiveShadow = false; return x; };

  // 차량 1대 인스턴스 (지오메트리 공유)
  function instance(type) {
    const M = mats(), G = geos(type), B = G.raw, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const parts = { root, body, wheels: [], steerPivots: [], meshes: [] };
    const add = (parent, g, m, shadow) => { const x = mesh(g, m, shadow); if (x) { parent.add(x); parts.meshes.push(x); } return x; };
    add(body, G.paint, M.paint, true); add(body, G.matte, M.matte, true); add(body, G.coat, M.coat, true);
    add(body, G.glass, M.glass, false); add(body, G.lamp, M.lamp, false); add(body, G.tail, M.tail, false);
    if (B.wheels) for (const [x, y, z, front] of B.wheels) {
      if (front && G.steer) continue; // 오토바이 앞바퀴는 핸들 뭉치에
      let parent = body;
      if (front) { const pv = new THREE.Group(); pv.position.set(x, y, z); body.add(pv); parts.steerPivots.push(pv); parent = pv; }
      const w = mesh(B.wheel, M.matte, true); parts.meshes.push(w);
      if (parent === body) w.position.set(x, y, z); parent.add(w); parts.wheels.push(w);
    }
    if (G.steer) {
      const pv = new THREE.Group(); pv.position.fromArray(G.steer.pivot); body.add(pv); parts.steerPivots.push(pv);
      add(pv, G.steer.paint, M.paint, true); add(pv, G.steer.matte, M.matte, true); add(pv, G.steer.lamp, M.lamp, false);
      const fw = B.wheels.find((w) => w[3]), w = mesh(B.wheel, M.matte, true); parts.meshes.push(w);
      w.position.set(fw[0] - G.steer.pivot[0], fw[1] - G.steer.pivot[1], fw[2] - G.steer.pivot[2]); pv.add(w); parts.wheels.unshift(w);
    }
    if (type === 'horse') {
      const neck = new THREE.Group(); neck.position.set(0, 1.5, 0.72); body.add(neck); add(neck, G.neck, M.coat, true); parts.neck = neck;
      const tail = new THREE.Group(); tail.position.set(0, 1.45, -1.05); body.add(tail); add(tail, G.tailG, M.coat, true); parts.tail = tail;
      parts.legs = B.legs.map((L) => {
        const hip = new THREE.Group(); hip.position.fromArray(L.pos); body.add(hip); add(hip, L.up, M.coat, true);
        const knee = new THREE.Group(); knee.position.y = -L.L1; hip.add(knee); add(knee, L.low, M.coat, true);
        return { hip, knee, front: L.front, side: Math.sign(L.pos[0]) };
      });
    }
    parts.wr = B.wr || 0.33;
    return parts;
  }
  // 불탄 잔해: 도장·무광 재질을 검게, 유리·등화 숨김
  function wreck(parts) {
    const M = mats();
    for (const m of parts.meshes) {
      if (m.material === M.glass || m.material === M.lamp || m.material === M.tail) m.visible = false;
      else if (m.material === M.paint || m.material === M.coat) m.material = M.wreck;
    }
  }
  function setShadows(parts, on) { if (parts.shadowOn === on) return; parts.shadowOn = on; for (const m of parts.meshes) if (m.material !== mats().glass) m.castShadow = on; }
  return { instance, wreck, setShadows, mats };
})();
