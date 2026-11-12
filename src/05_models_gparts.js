// ============================================================
// 05_models_gparts.js — 울트라레어·테스터 총기 스킨 부속품 (v20)
//  · 색만 바뀌는 게 아니라 외형이 바뀌도록, 스킨마다 총에 돋아나는 부속품 세트(용암 바위 장갑 · 금빛 뿔과 날개 · 테슬라 코일 ·
//    떠다니는 블록 · 얼음 결정 · 공허 고리)를 붙인다. 모두 자체 디자인
//  · 자리: 총마다 모양이 달라서 고정 좌표로 두면 공중에 뜬다 → 총 몸체에 광선을 쏴서 그 높이(z)의 윤곽(위·아래·옆 표면, 총열 반지름)을
//    재고 그 위에 올린다. 조준경·손잡이 자리(몸체 위쪽 레일, 아래 손잡이)는 피한다
//  · 재질: 총에 입힌 스킨 재질을 그대로 쓴다(정점마다 kd) → 무늬·금속감이 몸체와 같고, 꺼내기·넣기 빛 띠에 같이 나타나고 사라진다
//    kd 0·2 = 몸체 무늬 · 1 = 손잡이 · 3 = 강철(스킨 강철 색) · 7 = 발광(스킨 에너지 색, 셰이더가 빛나게)
//  · 전개 순서·시간은 05_models_gskin.js(GunSkin.draw)가 정한다: 빛 띠가 총구에 닿을 즈음 총 앞쪽 부속품부터 차례로 튀어나옴
// ============================================================
const GunParts = (() => {
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
  const ray = new THREE.Raycaster();
  // ---------- 조각 모음 → 지오메트리 하나 (position · normal · color · kd) ----------
  function Geo() {
    const L = [];
    const B = {
      // geo: 기본 도형 / kd: 재질 종류 / 위치·회전·크기 / dark: 어두운 작은 부품(셰이더가 조금 어둡게)
      add(geo, kd, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, dark = false) {
        _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
        const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose(); g.applyMatrix4(_m);
        L.push({ g, kd, dark }); return B;
      },
      done() {
        let n = 0; for (const e of L) n += e.g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), kd = new Float32Array(n);
        let o = 0;
        for (const e of L) {
          const c = e.g.attributes.position.count, v = e.dark ? 0.07 : 1;
          pos.set(e.g.attributes.position.array, o * 3); nor.set(e.g.attributes.normal.array, o * 3);
          col.fill(v, o * 3, (o + c) * 3); kd.fill(e.kd, o, o + c); o += c; e.g.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('kd', new THREE.BufferAttribute(kd, 1));
        out.computeBoundingSphere(); out.computeBoundingBox();
        return out;
      },
    };
    return B;
  }
  // 기본 도형 (원기둥·원뿔은 +y 방향, 고리는 z축을 감음 = 총열을 감는 방향)
  const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CY = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
  const CO = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
  const OC = (r) => new THREE.OctahedronGeometry(r, 0);
  const IC = (r, det = 0) => new THREE.IcosahedronGeometry(r, det);
  const TE = (r) => new THREE.TetrahedronGeometry(r, 0);
  const TO = (R, r, rs = 6, ts = 18) => new THREE.TorusGeometry(R, r, rs, ts);
  const HP = Math.PI / 2;
  // 고리 둘레에 n개 (a: 각도) — 원뿔의 +y가 바깥을 보게 z축으로 돌림
  const around = (n, a0, fn) => { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; fn(a, Math.cos(a), Math.sin(a), a - HP); } };

  // ---------- 부속품 세트 ----------
  //  at: 'top'(위) · 'bot'(아래) · 'L'/'R'/'LR'(옆, 한쪽·양쪽) · 'ring'(총열을 감음)
  //  z: 몸체 길이 비율(0 = 개머리판 끝, 1 = 총구) 또는 mz: 총구에서 앞(+)·뒤(−) 거리(m)
  //  build(B, r): 바깥쪽이 +y, 총 앞쪽이 +z인 좌표로 짓는다. 'ring'은 총열 중심이 원점이고 r = 그 자리 총열 반지름
  const SETS = {
    // 마그마 코어(M416): 총구 쪽 용암 바위 고리와 가시 · 총열 덮개 양옆 바위 장갑(빛나는 틈) · 몸통 옆 열 코어 · 개머리판 위 냉각 핀
    magma: [
      { at: 'ring', mz: -0.035, build(B, r) {
        B.add(TO(r + 0.012, 0.011, 6, 14), 0, 0, 0, 0, 0, 0, 0, 1, 1, 1.7);
        B.add(TO(r + 0.0135, 0.0032, 4, 18), 7, 0, 0, 0.006);
        around(5, 0.3, (a, c, s, rz) => B.add(CO(0.008, 0.042, 4), 0, c * (r + 0.026), s * (r + 0.026), -0.01, -0.35, 0, rz));
      } },
      { at: 'LR', z: 0.7, build(B) {
        B.add(IC(0.02, 0), 0, 0, 0.004, 0, 0.3, 0.5, 0, 1.5, 0.42, 2.6);
        B.add(IC(0.014, 0), 0, 0.006, 0.006, -0.05, 0.6, 0.2, 0.4, 1.4, 0.45, 1.8);
        B.add(BX(0.0025, 0.0035, 0.06), 7, 0.002, 0.0118, 0.004, 0, 0.12, 0);
        B.add(BX(0.0022, 0.003, 0.03), 7, -0.007, 0.0105, -0.03, 0, -0.5, 0);
      } },
      { at: 'L', z: 0.43, build(B) {
        for (const z of [-0.022, 0.022]) B.add(CY(0.0125, 0.0125, 0.008, 8), 3, 0, 0.0115, z, HP);
        B.add(CY(0.0108, 0.0108, 0.036, 8), 7, 0, 0.0115, 0, HP);
        for (const z of [-0.01, 0.01]) B.add(TO(0.0112, 0.0016, 4, 10), 0, 0, 0.0115, z, 0, 0, 0, 1, 1, 1, true);
      } },
      { at: 'top', z: 0.07, build(B) {
        for (let i = 0; i < 3; i++) { const z = -0.022 + i * 0.022; B.add(BX(0.003, 0.02, 0.026), 0, 0, 0.009, z, -0.45); B.add(BX(0.0034, 0.003, 0.024), 7, 0, 0.0175, z - 0.004, -0.45); }
      } },
    ],
    // 홍룡(Beryl M762): 총구를 문 금빛 턱(위아래 뿔)과 붉은 눈 · 총열 덮개 양옆 날개 · 몸통 옆 비늘판과 보석 · 개머리판 등지느러미
    dragon: [
      { at: 'ring', mz: -0.02, build(B, r) {
        B.add(TO(r + 0.008, 0.0058, 6, 16), 3, 0, 0, 0);
        for (const s of [1, -1]) { B.add(CO(0.009, 0.11, 5), 3, 0, s * (r + 0.014), 0.035, HP - s * 0.32, 0, 0); B.add(CO(0.006, 0.05, 4), 3, 0, s * (r + 0.009), -0.018, -HP - s * 0.5, 0, 0); }
        for (const s of [1, -1]) B.add(OC(0.0075), 7, s * (r + 0.011), r * 0.55 + 0.006, -0.004, 0, 0, 0, 1, 1, 1.5);
      } },
      { at: 'LR', z: 0.64, build(B) {
        B.add(BX(0.0022, 0.034, 0.085), 3, 0, 0.016, -0.012, -0.55, 0, 0);
        B.add(BX(0.0022, 0.022, 0.05), 3, 0, 0.011, -0.05, -0.75, 0, 0);
        B.add(BX(0.0026, 0.0028, 0.085), 7, 0, 0.033, -0.022, -0.55, 0, 0);
      } },
      { at: 'LR', z: 0.4, build(B) {
        B.add(OC(0.016), 0, 0, 0.003, 0, 0, 0, 0, 1.2, 0.32, 1.7);
        B.add(OC(0.0048), 7, 0, 0.0075, 0.004);
      } },
      { at: 'top', z: 0.07, build(B) {
        for (let i = 0; i < 4; i++) B.add(CO(0.005, 0.022 - i * 0.003, 4), 3, 0, 0.009, 0.03 - i * 0.02, -0.55);
      } },
    ],
    // 플라즈마(AKM): 총열에 감긴 테슬라 코일 3겹 · 총구 앞 전극 세 갈래 · 몸통 옆 축전기 · 개머리판 위 안테나
    plasma: [
      ...[-0.07, -0.11, -0.15].map((mz) => ({ at: 'ring', mz, build(B, r) { B.add(TO(r + 0.011, 0.0055, 6, 18), 3, 0, 0, 0); B.add(TO(r + 0.0168, 0.0024, 4, 18), 7, 0, 0, 0); } })),
      { at: 'ring', mz: 0.004, build(B, r) {
        around(3, HP, (a, c, s) => { B.add(BX(0.004, 0.004, 0.05), 3, c * (r + 0.009), s * (r + 0.009), 0.022); B.add(OC(0.0065), 7, c * (r + 0.009), s * (r + 0.009), 0.05); });
      } },
      { at: 'L', z: 0.44, build(B) {
        B.add(BX(0.011, 0.015, 0.062), 3, 0, 0.0075, 0);
        for (const z of [-0.02, 0, 0.02]) B.add(BX(0.0118, 0.0158, 0.005), 7, 0, 0.0075, z);
      } },
      { at: 'top', z: 0.07, build(B) {
        for (const x of [-0.008, 0.008]) { B.add(CY(0.0015, 0.0015, 0.036, 4), 3, x, 0.016, 0, -0.35); B.add(OC(0.0042), 7, x, 0.033, -0.006); }
      } },
    ],
    // 크림슨 글리치(Vector): 몸체 둘레에 떠오른 블록(틈을 두고 떠 있음, 깜빡임) · 총구 앞 네모 틀
    glitch: [
      { at: 'LR', z: 0.32, build(B) { B.add(BX(0.014, 0.014, 0.014), 0, 0, 0.013, 0); B.add(BX(0.008, 0.008, 0.008), 7, 0.004, 0.026, 0.016); B.add(BX(0.006, 0.006, 0.006), 0, -0.006, 0.022, -0.016); } },
      { at: 'LR', z: 0.72, build(B) { B.add(BX(0.011, 0.011, 0.02), 0, 0, 0.012, 0); B.add(BX(0.0065, 0.0065, 0.0065), 7, 0, 0.024, -0.014); } },
      { at: 'top', z: 0.1, build(B) { B.add(BX(0.012, 0.012, 0.012), 7, 0, 0.016, 0); B.add(BX(0.008, 0.008, 0.008), 0, 0.006, 0.028, -0.012); } },
      { at: 'ring', mz: 0.012, build(B, r) {
        const R = r + 0.02;
        for (const [x, y, w, h] of [[0, R, 2 * R, 0.003], [0, -R, 2 * R, 0.003], [R, 0, 0.003, 2 * R], [-R, 0, 0.003, 2 * R]]) B.add(BX(w + 0.005, h * 1.7, 0.006), 7, x, y, 0);
        B.add(BX(0.011, 0.011, 0.011), 0, R + 0.014, R * 0.4, -0.014); B.add(BX(0.008, 0.008, 0.008), 7, -R - 0.012, -R * 0.5, -0.006);
      } },
    ],
    // 서리 결정(AWM): 총열 양옆 얼음 결정 무더기 · 총구 서리 고리와 고드름 · 몸통 왼쪽 육각 서리판 · 개머리판 위 작은 결정
    frost: [
      { at: 'LR', z: 0.74, build(B) {
        B.add(OC(0.01), 3, 0, 0.018, 0.004, -0.55, 0, 0.15, 0.6, 2.6, 0.6);
        B.add(OC(0.008), 7, 0.007, 0.013, -0.014, -0.8, 0, -0.35, 0.55, 2.2, 0.55);
        B.add(OC(0.007), 3, -0.007, 0.011, 0.02, -0.25, 0, 0.45, 0.55, 2, 0.55);
      } },
      { at: 'ring', mz: -0.025, build(B, r) {
        B.add(TO(r + 0.008, 0.0052, 6, 18), 3, 0, 0, 0);
        around(6, 0, (a, c, s, rz) => { const odd = Math.round(a * 6 / TAU) % 2; B.add(CO(0.0058, 0.034 + odd * 0.018, 4), odd ? 7 : 3, c * (r + 0.024), s * (r + 0.024), -0.006, -0.3, 0, rz); });
      } },
      { at: 'L', z: 0.47, build(B) { B.add(CY(0.019, 0.019, 0.003, 6), 3, 0, 0.0015, 0); B.add(OC(0.0062), 7, 0, 0.004, 0, 0, 0, 0, 1, 0.8, 1); } },
      { at: 'top', z: 0.05, build(B) { for (let i = 0; i < 3; i++) B.add(OC(0.006), i === 1 ? 7 : 3, (i - 1) * 0.007, 0.012, -0.004 + i * 0.006, -0.45, 0, (i - 1) * 0.3, 0.6, 2.4 - Math.abs(i - 1) * 0.6, 0.6); } },
    ],
    // 공허(S12K): 총열 둘레를 기울어져 도는 고리 두 개와 흑요석 조각 · 몸통 양옆 흑요석 가시 · 개머리판 위 공허 구슬과 받침 발톱
    void: [
      ...[[-0.06, 0.35], [-0.15, -0.3]].map(([mz, t]) => ({ at: 'ring', mz, build(B, r) {
        B.add(TO(r + 0.034, 0.0042, 6, 28), 7, 0, 0, 0, t, 0, 0);
        around(3, 0.8, (a, c, s) => B.add(IC(0.009, 0), 0, c * (r + 0.034), s * (r + 0.034) * Math.cos(t), s * (r + 0.034) * Math.sin(t), 0, 0, 0, 1, 1, 1, true));
      } })),
      { at: 'LR', z: 0.45, build(B) {
        B.add(TE(0.012), 0, 0, 0.008, 0, 0.3, 0, 0.2, 0.7, 1.9, 1.1, true);
        B.add(TE(0.009), 0, 0.004, 0.006, -0.022, -0.5, 0.4, -0.2, 0.7, 1.6, 1, true);
        B.add(BX(0.0022, 0.012, 0.0022), 7, 0.0012, 0.009, 0.001, 0.3, 0, 0.2);
      } },
      { at: 'top', z: 0.08, build(B) {
        B.add(IC(0.0105, 1), 7, 0, 0.022, 0);
        around(3, 0, (a, c, s) => B.add(CO(0.003, 0.024, 4), 3, c * 0.011, 0.012, s * 0.011, s * 0.5, 0, -c * 0.5));
      } },
    ],
    // 프로토타입 β(테스터): 총열을 서로 반대로 도는 홀로 고리 두 겹(앞 고리엔 프리즘 여섯 개) · 총열 덮개 양옆 비스듬한 방열 지느러미(빛 테두리)
    //  · 몸통 왼쪽 육각 β 판(빛나는 심) · 개머리판 위 안테나와 신호 구슬. spin: 들고 있는 동안 총열 축으로 도는 속도(rad/s)
    proto: [
      { at: 'ring', mz: -0.05, spin: 1.7, build(B, r) {
        B.add(TO(r + 0.027, 0.0024, 4, 30), 7, 0, 0, 0);
        around(6, 0, (a, c, s) => B.add(OC(0.0058), 7, c * (r + 0.027), s * (r + 0.027), 0, 0, 0, a, 1, 1, 1.7));
      } },
      { at: 'ring', mz: -0.13, spin: -1.15, build(B, r) {
        B.add(TO(r + 0.016, 0.0036, 4, 26), 3, 0, 0, 0, 0.28, 0, 0);
        B.add(TO(r + 0.0205, 0.0014, 4, 26), 7, 0, 0, 0, 0.28, 0, 0);
        around(3, 0.5, (a, c, s) => B.add(BX(0.005, 0.005, 0.005), 0, c * (r + 0.016), s * (r + 0.016) * Math.cos(0.28), s * (r + 0.016) * Math.sin(0.28), 0.6, 0.6, 0));
      } },
      { at: 'LR', z: 0.66, build(B) {
        B.add(BX(0.0022, 0.026, 0.07), 0, 0, 0.012, 0, -0.5, 0, 0);
        B.add(BX(0.0026, 0.003, 0.072), 7, 0, 0.0255, -0.006, -0.5, 0, 0);
        B.add(BX(0.0022, 0.016, 0.042), 0, 0, 0.008, -0.042, -0.72, 0, 0);
        B.add(BX(0.0026, 0.0026, 0.042), 7, 0, 0.0165, -0.047, -0.72, 0, 0);
      } },
      { at: 'L', z: 0.42, build(B) {
        B.add(CY(0.017, 0.017, 0.003, 6), 3, 0, 0.0015, 0, 0, HP / 3, 0);
        B.add(CY(0.012, 0.012, 0.0036, 6), 0, 0, 0.002, 0, 0, HP / 3, 0);
        B.add(BX(0.0034, 0.0042, 0.017), 7, -0.003, 0.0042, 0);                 // β 세로획
        B.add(BX(0.0074, 0.0042, 0.0032), 7, 0.0008, 0.0042, 0.0062);           // 위 고리
        B.add(BX(0.0084, 0.0042, 0.0032), 7, 0.0012, 0.0042, -0.0004);          // 가운데
        B.add(BX(0.0034, 0.0042, 0.0118), 7, 0.0046, 0.0042, 0.0028);           // 오른쪽 배
      } },
      { at: 'top', z: 0.08, build(B) {
        B.add(CY(0.0065, 0.0085, 0.004, 6), 3, 0, 0.002, 0);
        B.add(CY(0.0014, 0.0014, 0.042, 4), 3, 0, 0.022, -0.004, -0.22);
        B.add(OC(0.0052), 7, 0, 0.042, -0.0085);
      } },
    ],
    // ---------- 테스터 (v20 개편): 베타 테스터 한정 컬렉션 ----------
    // ZERO PROTOCOL(M416): 총구 쪽 빛나는 칼라 · 총열덮개 양옆 시안 광선 띠(하우징 포함) · 개머리판 양옆 짧은 광선 막대
    zero: [
      { at: 'ring', mz: -0.035, build(B, r) { B.add(TO(r + 0.007, 0.0034, 6, 22), 3, 0, 0, 0); B.add(TO(r + 0.0098, 0.0011, 4, 26), 7, 0, 0, 0.003); B.add(TO(r + 0.0098, 0.0011, 4, 26), 7, 0, 0, -0.003); } },
      { at: 'LR', z: 0.66, build(B) { B.add(BX(0.0018, 0.0072, 0.15), 3, 0, 0.0009, 0); B.add(BX(0.0016, 0.0026, 0.142), 7, 0, 0.0021, 0); } },
      { at: 'LR', z: 0.12, build(B) { B.add(BX(0.0018, 0.006, 0.058), 3, 0, 0.0009, 0); B.add(BX(0.0016, 0.0022, 0.052), 7, 0, 0.0021, 0); } },
    ],
    // CHAOS CORE(AKM): 총열을 감은 방열 고리 세 겹(붉게 달아오름) · 몸통 양옆 불안정한 에너지 코어(검은 받침 + 빛나는 구 + 덮개 살)
    chaos: [
      ...[-0.07, -0.115, -0.16].map((mz) => ({ at: 'ring', mz, build(B, r) { B.add(TO(r + 0.0062, 0.0042, 6, 18), 3, 0, 0, 0); B.add(TO(r + 0.0088, 0.0013, 4, 20), 7, 0, 0, 0); } })),
      { at: 'LR', z: 0.36, core: true, build(B) {
        B.add(CY(0.0135, 0.0135, 0.004, 10), 3, 0, 0.002, 0);
        B.add(IC(0.0078, 1), 7, 0, 0.0062, 0);
        around(4, Math.PI / 4, (a, c, s) => B.add(BX(0.0016, 0.0105, 0.0016), 3, c * 0.0098, 0.0055, s * 0.0098, s * 0.35, 0, -c * 0.35));
        B.add(TO(0.0098, 0.0012, 4, 16), 7, 0, 0.0042, 0, HP);
      } },
    ],
    // LAST FRONTIER(Kar98k): 드러난 총열의 샴페인 골드 띠 세 줄과 위·양옆으로 이어진 금 상감 · 개머리 덮개 위 금 상감선 (개머리가 총열 아래 길게 깔려 있어 총구 쪽 15cm 안에만)
    frontier: [
      { at: 'ring', mz: -0.025, build(B, r) { B.add(TO(r + 0.0026, 0.0019, 6, 22), 7, 0, 0, 0); } },
      { at: 'ring', mz: -0.075, build(B, r) { B.add(TO(r + 0.0024, 0.0016, 6, 22), 7, 0, 0, 0); B.add(BX(0.0018, 0.0011, 0.095), 7, 0, r + 0.0004, 0); for (const s of [1, -1]) B.add(BX(0.0011, 0.0011, 0.07), 7, s * (r + 0.0003), 0, 0.005); } },
      { at: 'ring', mz: -0.125, build(B, r) { B.add(TO(r + 0.0024, 0.0016, 6, 22), 7, 0, 0, 0); } },
      { at: 'top', z: 0.62, build(B) { B.add(BX(0.0016, 0.0012, 0.16), 7, 0, 0.0006, 0); } },   // 총몸 위 금 상감선
    ],
    // ---------- 엡실론 (v20): 총마다 다른 주제, 겹치는 모양 없음 ----------
    // CELESTIAL JUDGMENT(AWM): 몸통 둘레를 서로 기울어져 도는 궤도 고리 두 개(별 다섯·셋) · 총구 금빛 띠와 작은 별
    celestial: [
      { at: 'ring', mz: -0.48, spin: 0.7, build(B, r) { const R = r + 0.034; B.add(TO(R, 0.0013, 4, 40), 7, 0, 0, 0, 0.42, 0, 0); around(5, 0, (a, c, s) => B.add(OC(0.0052), 7, c * R, s * R * Math.cos(0.42), s * R * Math.sin(0.42), 0, 0, a, 1, 1, 1)); } },
      { at: 'ring', mz: -0.58, spin: -0.45, build(B, r) { const R = r + 0.046; B.add(TO(R, 0.001, 4, 44), 7, 0, 0, 0, -0.5, 0.2, 0); around(3, 0.6, (a, c, s) => B.add(OC(0.0042), 7, c * R, s * R * Math.cos(0.5), -s * R * Math.sin(0.5))); } },
      { at: 'ring', mz: -0.03, build(B, r) { B.add(TO(r + 0.004, 0.0024, 6, 24), 7, 0, 0, 0); around(4, Math.PI / 4, (a, c, s) => B.add(OC(0.0035), 7, c * (r + 0.008), s * (r + 0.008), -0.012, 0, 0, a, 0.6, 0.6, 1.6)); } },
    ],
    // DIVINE OVERDRIVE(M416): 몸통 가운데 푸른 에너지 코어(흰 받침 · 빛 고리 · 가운데 빛) · 총열 둘레 발광 판 네 장 두 줄
    divine: [
      { at: 'LR', z: 0.44, core: true, build(B) { B.add(CY(0.017, 0.017, 0.004, 24), 0, 0, 0.002, 0); B.add(TO(0.0125, 0.0018, 6, 28), 7, 0, 0.0045, 0, HP); B.add(CY(0.0068, 0.0068, 0.0052, 18), 7, 0, 0.0035, 0); around(6, 0, (a, c, s) => B.add(BX(0.0018, 0.0028, 0.004), 3, c * 0.0152, 0.005, s * 0.0152, 0, -a, 0)); } },
      ...[-0.07, -0.13].map((mz) => ({ at: 'ring', mz, build(B, r) { B.add(TO(r + 0.004, 0.002, 6, 22), 3, 0, 0, 0); around(4, Math.PI / 4, (a, c, s, rz) => { B.add(BX(0.012, 0.0028, 0.03), 0, c * (r + 0.007), s * (r + 0.007), 0, 0, 0, rz + HP); B.add(BX(0.008, 0.0012, 0.024), 7, c * (r + 0.0088), s * (r + 0.0088), 0, 0, 0, rz + HP); }); } })),
    ],
    // INFERNAL SOVEREIGN(AKM): 총구를 문 왕관 모양 금빛 가시 고리 · 몸통 양옆 붉은 배출구 · 개머리판 위 작은 뿔 셋
    infernal: [
      { at: 'ring', mz: -0.04, build(B, r) { B.add(TO(r + 0.006, 0.0034, 6, 22), 3, 0, 0, 0); around(5, HP, (a, c, s, rz) => B.add(CO(0.0045, 0.022 + (Math.round(a * 5 / TAU) % 2) * 0.01, 4), 7, c * (r + 0.012), s * (r + 0.012), 0.004, 0.2, 0, rz)); } },
      { at: 'LR', z: 0.5, build(B) { for (let i = 0; i < 4; i++) B.add(BX(0.0018, 0.0022, 0.03), 7, 0, 0.0011, -0.018 + i * 0.012, 0, 0.5, 0); } },
      { at: 'top', z: 0.1, build(B) { for (let i = 0; i < 3; i++) B.add(CO(0.004, 0.02 - Math.abs(i - 1) * 0.005, 4), 7, (i - 1) * 0.008, 0.009, 0, -0.35, 0, (i - 1) * 0.25); } },
    ],
    // VOID REAPER(Groza): 총구 앞 서로 반대로 도는 보라 고리 두 겹 · 총열 둘레를 떠도는 흑요석 조각 · 몸통 옆 들쭉날쭉한 파편
    void2: [
      { at: 'ring', mz: -0.02, spin: 1.9, build(B, r) { B.add(TO(r + 0.022, 0.0013, 4, 30), 7, 0, 0, 0, 0.3, 0, 0); } },
      { at: 'ring', mz: -0.05, spin: -1.3, build(B, r) { B.add(TO(r + 0.016, 0.0017, 4, 28), 7, 0, 0, 0, -0.35, 0, 0); around(4, 0.3, (a, c, s) => B.add(TE(0.005), 3, c * (r + 0.026), s * (r + 0.026), 0, a, a * 2, 0)); } },
      { at: 'LR', z: 0.62, build(B) { B.add(TE(0.012), 3, 0, 0.012, 0, 0.3, 0.6, 0.2, 0.6, 2, 1.1); B.add(TE(0.008), 7, 0.003, 0.018, -0.02, -0.5, 0.3, 0, 0.5, 1.5, 0.9); } },
    ],
    // PHANTOM SERAPH(AUG): 몸통 양옆 펼쳐진 금속 날개 장식(깃 다섯 장, 끝이 빛남) · 총구 위 작은 헤일로 고리
    seraph: [
      { at: 'LR', z: 0.36, build(B) { for (let i = 0; i < 5; i++) { const an = -0.95 + i * 0.22, L = 0.05 - i * 0.004; B.add(BX(0.0016, 0.0085, L), 3, 0, 0.004 + i * 0.0012, -L * 0.45 - 0.006 * i, an, 0, 0); B.add(BX(0.0018, 0.0016, L * 0.9), 7, 0, 0.0085 + i * 0.0012, -L * 0.45 - 0.006 * i, an, 0, 0); } } },
      { at: 'ring', mz: -0.03, build(B, r) { B.add(TO(r + 0.006, 0.0015, 4, 26), 7, 0, 0, 0); B.add(TO(r + 0.0105, 0.0009, 4, 26), 7, 0, 0, -0.006); } },
    ],
    // APOCALYPSE ENGINE(AMR): 몸통 양옆 대형 에너지 코어(받침 · 빛나는 구 · 덮개 살 여섯 · 고리) · 총열의 기계식 금속 판 세 줄(빛나는 틈) · 위쪽 금 테
    apocalypse: [
      { at: 'LR', z: 0.47, core: true, build(B) { B.add(CY(0.021, 0.021, 0.005, 12), 3, 0, 0.0025, 0); B.add(IC(0.011, 1), 7, 0, 0.0085, 0); around(6, 0, (a, c, s) => B.add(BX(0.0018, 0.014, 0.0018), 3, c * 0.0145, 0.0075, s * 0.0145, s * 0.3, 0, -c * 0.3)); B.add(TO(0.0145, 0.0014, 4, 18), 7, 0, 0.0055, 0, HP); B.add(TO(0.0195, 0.0011, 4, 20), 0, 0, 0.004, 0, HP); } },
      ...[-0.22, -0.32, -0.42].map((mz) => ({ at: 'ring', mz, build(B, r) { around(6, 0, (a, c, s, rz) => { B.add(BX(0.014, 0.0034, 0.05), 3, c * (r + 0.005), s * (r + 0.005), 0, 0, 0, rz + HP); B.add(BX(0.0022, 0.0014, 0.044), 7, c * (r + 0.0072), s * (r + 0.0072), 0, 0, 0, rz + HP); }); } })),
      { at: 'top', z: 0.62, build(B) { B.add(BX(0.003, 0.0016, 0.18), 7, 0, 0.0008, 0); } },
    ],
    // ETERNAL DYNASTY(Kar98k): 총구 쪽 금 띠 두 겹과 루비 · 총열 위 긴 금 상감 · 총몸 위 금 상감선
    dynasty: [
      { at: 'ring', mz: -0.025, build(B, r) { B.add(TO(r + 0.0028, 0.002, 6, 22), 7, 0, 0, 0); B.add(TO(r + 0.0028, 0.0013, 6, 22), 7, 0, 0, -0.008); B.add(OC(0.0032), 0, 0, r + 0.004, -0.004, 0, 0, 0, 1, 1, 1.4); } },
      { at: 'ring', mz: -0.08, build(B, r) { B.add(TO(r + 0.0024, 0.0016, 6, 22), 7, 0, 0, 0.04); B.add(BX(0.0016, 0.001, 0.09), 7, 0, r + 0.0004, 0); for (const s of [1, -1]) B.add(BX(0.001, 0.001, 0.07), 7, s * (r + 0.0003), 0, 0); } },
      { at: 'top', z: 0.6, build(B) { B.add(BX(0.0016, 0.0012, 0.18), 7, 0, 0.0006, 0); for (const z of [-0.08, 0, 0.08]) B.add(OC(0.0026), 7, 0, 0.0015, z, 0, 0, 0, 1, 0.6, 1.4); } },
    ],
    // OMEGA BREAKER(DBS): 총구 쪽 마젠타 전기 코일 두 줄(은 칼라) · 몸통 양옆 갈라진 패널 사이 마젠타 띠 · 위쪽 Ω 방출구
    omega: [
      ...[-0.025, -0.11].map((mz) => ({ at: 'ring', mz, build(B, r) { B.add(TO(r + 0.006, 0.0028, 6, 20), 3, 0, 0, 0); B.add(TO(r + 0.0095, 0.0012, 4, 24), 7, 0, 0, 0.004); B.add(TO(r + 0.0095, 0.0012, 4, 24), 7, 0, 0, -0.004); } })),
      { at: 'LR', z: 0.4, build(B) { B.add(BX(0.002, 0.004, 0.11), 7, 0, 0.0012, 0); B.add(BX(0.0016, 0.012, 0.004), 7, 0, 0.0012, 0.03); B.add(BX(0.0016, 0.012, 0.004), 7, 0, 0.0012, -0.03); } },
      { at: 'top', z: 0.55, build(B) { B.add(TO(0.0055, 0.0016, 4, 12), 7, 0, 0.007, 0, 0, HP, 0); B.add(BX(0.003, 0.002, 0.006), 7, -0.004, 0.0015, 0); B.add(BX(0.003, 0.002, 0.006), 7, 0.004, 0.0015, 0); } },
    ],
  };

  // ---------- 총 몸체 옆면 재기 (각인·엠블럼 자리, 05_models_gdeco.js) ----------
  //  side: 'L'(+x) · 'R'(−x) · 'top'. zn: 몸체 길이 비율, dy: 총열 높이에서 위아래(m). 그 높이에서 몸체에 광선을 쏴 표면 위치를 돌려준다
  const PROBE = {};
  function probe(g, side, zn, dy, z0, z1) {
    const key = g.userData.id + '|' + side + '|' + zn + '|' + dy; if (key in PROBE) return PROBE[key];
    const m = g.userData.meta, body = g.children[0], meshes = []; g.updateMatrixWorld(true);
    body.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const z = z0 + (z1 - z0) * zn, y = (m.boreY || 0) + (dy || 0); let out = null;
    for (const dz of [0, 0.006, -0.006, 0.012, -0.012, 0.02, -0.02]) {
      if (side === 'top') { ray.set(_o.set(0, y + 0.5, z + dz), _d.set(0, -1, 0)); }
      else { const s = side === 'L' ? 1 : -1; ray.set(_o.set(s * 0.5, y, z + dz), _d.set(-s, 0, 0)); }
      ray.far = 1; const h = ray.intersectObjects(meshes, false)[0];
      if (h) { out = [h.point.x, h.point.y, h.point.z]; break; }
    }
    return (PROBE[key] = out);
  }

  // ---------- 총 윤곽 재기 (총마다 한 번, 몸체 메시에 광선) ----------
  const ANCH = {};   // `${총}|${세트}` → 자리 목록
  function anchors(g, set, z0, z1) {
    const key = g.userData.id + '|' + set; if (ANCH[key]) return ANCH[key];
    // 총구 위치는 부착물(보정기)로 늘어나기 전 값 — 자리는 총마다 한 번 재서 모든 부착물 조합에 같이 쓴다
    const m = Object.assign({}, g.userData.meta, { muzzleZ: Models.GUNS[g.userData.id].meta.muzzleZ }), body = g.children[0], meshes = [];
    g.updateMatrixWorld(true);   // 아직 장면 밖이라 총 공간 = 월드
    body.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const hit = (ox, oy, oz, dx, dy, dz) => { ray.set(_o.set(ox, oy, oz), _d.set(dx, dy, dz)); ray.far = 1; const h = ray.intersectObjects(meshes, false)[0]; return h ? h.point : null; };
    const yAt = (z, dir) => { const h = hit(0, dir * 0.5, z, 0, -dir, 0); return h ? h.y : null; };
    // 그 높이(z)에서 표면을 못 찾으면(틈) 조금씩 앞뒤로 옮겨 다시
    const near = (z, fn) => { for (const dz of [0, 0.006, -0.006, 0.012, -0.012, 0.02, -0.02, 0.03, -0.03]) { const r = fn(z + dz); if (r) return r; } return null; };
    const out = [];
    for (const P of SETS[set]) {
      const zz = P.mz !== undefined ? m.muzzleZ + P.mz : z0 + (z1 - z0) * P.z;
      const zn = clamp((zz - z0) / Math.max(0.01, z1 - z0), 0, 1);
      if (P.at === 'ring') {
        // 총열 반지름: 총열 중심(0, boreY)을 향해 네 방향에서
        let r = 0; for (const [cx, cy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const h = hit(cx * 0.3, m.boreY + cy * 0.3, Math.min(zz, m.muzzleZ - 0.004), -cx, -cy, 0); if (h) r = Math.max(r, Math.hypot(h.x, h.y - m.boreY)); }
        out.push({ P, p: [0, m.boreY, zz], rz: 0, r: clamp(r || 0.012, 0.008, 0.04), zn, ring: true });
        continue;
      }
      for (const side of P.at === 'LR' ? ['L', 'R'] : [P.at]) {
        let a = null;
        if (side === 'top' || side === 'bot') { const dir = side === 'top' ? 1 : -1; a = near(zz, (z) => { const y = yAt(z, dir); return y === null ? null : { p: [0, y, z], rz: dir > 0 ? 0 : Math.PI }; }); }
        else {
          const s = side === 'L' ? 1 : -1;
          a = near(zz, (z) => { const yt = yAt(z, 1), yb = yAt(z, -1); if (yt === null || yb === null) return null; const ym = (yt + yb) / 2, h = hit(s * 0.5, ym, z, -s, 0, 0); return h ? { p: [h.x, ym, z], rz: -s * HP } : null; });
        }
        if (a) out.push({ P, p: a.p, rz: a.rz, r: 0, zn, ring: false });
      }
    }
    return (ANCH[key] = out);
  }
  // 옆·위 부속품 배율 (세트마다)
  const SIZE = { magma: 2.1, dragon: 2.0, plasma: 1.8, glitch: 2.0, frost: 2.3, void: 2.1, proto: 2.0, zero: 1.6, chaos: 1.9, frontier: 1.7, celestial: 1.0, divine: 1.7, infernal: 1.8, void2: 1.8, seraph: 2.0, apocalypse: 1.9, dynasty: 1.7, omega: 1.7 };
  // 지오메트리는 (세트 · 부속품 · 반지름)마다 한 번
  const GEO = {};
  function geoOf(set, a) {
    const key = set + '|' + SETS[set].indexOf(a.P) + '|' + (a.ring ? a.r.toFixed(3) : '');
    if (!GEO[key]) { const B = Geo(); a.P.build(B, a.r); GEO[key] = B.done(); }
    return GEO[key];
  }
  // 총(그룹)에 부속품을 붙인다. mat: 이 총의 스킨 재질 · z0~z1: 몸체 길이. 돌려준 목록으로 GunSkin이 전개 애니메이션
  // 정조준 시야를 가리는 부속품인가 (총 공간 경계 상자로 판정)
  //  · 조준선 기둥: 가운데(|x| < 4.5cm)에서 가늠자 높이 바로 아래부터 위로 올라온 것
  //  · 눈앞: 뒤 가늠자보다 뒤쪽(눈과 가늠자 사이)에서 총열 높이 위로 올라온 것
  const _bx = new THREE.Box3();
  function blocksSight(m, box) {
    const sightY = m.ironY || (m.railY || 0.06) + 0.012, rearZ = m.ironRearZ !== undefined ? m.ironRearZ : -0.1;
    if (box.max.y > sightY - 0.014 && box.min.x < 0.045 && box.max.x > -0.045) return true;
    return box.max.z < rearZ + 0.03 && box.max.y > (m.boreY || 0) - 0.01 && box.min.x < 0.1 && box.max.x > -0.1;
  }
  function attach(g, set, mat, z0, z1) {
    if (!SETS[set] || !g.children[0]) return null;
    const list = [], comp = g.userData.att && g.userData.att.muzzle, meta = Models.GUNS[g.userData.id].meta;
    for (const a of anchors(g, set, z0, z1)) {
      if (comp && a.P.mz > 0) continue;   // 보정기를 달면 총구 앞 부속품은 생략 (보정기와 겹침)
      const geo = geoOf(set, a), outer = new THREE.Group(), inner = new THREE.Group(), mesh = new THREE.Mesh(geo, mat);
      outer.position.fromArray(a.p); outer.rotation.z = a.rz; outer.add(inner); inner.add(mesh);
      if (!a.ring) outer.scale.setScalar(SIZE[set] || 1);   // 옆·위 부속품은 실루엣이 바뀌어 보일 만큼 키움 (고리는 총열 반지름에 맞춰 지음)
      outer.name = 'gpart'; g.add(outer);
      outer.updateMatrix(); _bx.copy(geo.boundingBox).applyMatrix4(outer.matrix);
      // sight: 1인칭 정조준 때 접어 넣는 부속품 (GunSkin.update 가 Cam.ads 에 맞춰 접고 편다)
      list.push({ outer, inner, mesh, zn: a.zn, ring: a.ring, popped: true, sight: blocksSight(meta, _bx), spin: a.P.spin || 0, core: !!a.P.core });
    }
    return list.length ? list : null;
  }
  return { attach, probe, SETS, _anch: ANCH };
})();
