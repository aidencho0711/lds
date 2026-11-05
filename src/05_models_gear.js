// ============================================================
// 05_models_gear.js — 몸에 붙는 장비: 헬멧 3종 · 조끼 3종 · 가방 3종 · 사각(램에어) 낙하산
//  실제 장비의 일반적인 형태를 참고한 자체 모델링 (다른 게임의 디자인을 따르지 않음)
//  좌표: 헬멧 = 머리 뼈 로컬, 조끼·가방 = 가슴 뼈 로컬, 낙하산 = 캐릭터 발 기준 (+z 앞, +y 위, +x 왼쪽)
// ============================================================
const Gear = (() => {
  const { A, BX, CY, RB, SPH, TOR, M } = Models.kit;
  // 헬멧 껍데기: 타원체(c, r) — 정수리에서 테두리 rim(a)(단위구 y, 방위각 a: 0 정면·+왼쪽)까지, 테두리는 두께만큼 안으로 접음
  function shell(c, r, rim, th = 0.07, AN = 30, RN = 10) {
    const P = [], I = [], rows = [];
    for (let i = 0; i <= RN; i++) rows.push([i / RN, 1]);
    rows.push([1.02, 1 - th * 0.5], [1.12, 1 - th]);
    for (const [t, k] of rows) for (let j = 0; j <= AN; j++) {
      const a = -Math.PI + j / AN * TAU, lim = rim(a), uy = t <= 1 ? lerp(1, lim, Math.pow(t, 0.85)) : lim + (t - 1) * 0.25, cb = Math.sqrt(Math.max(0, 1 - uy * uy));
      P.push(c[0] + Math.sin(a) * cb * r[0] * k, c[1] + uy * r[1] * k, c[2] + Math.cos(a) * cb * r[2] * k);
    }
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < AN; j++) { const a = i * (AN + 1) + j, b = a + AN + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
    const N = g.attributes.normal;
    for (let i = 0; i < rows.length; i++) { const a = i * (AN + 1), b = a + AN; const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1; N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l); }
    return g;
  }
  // 두 점 사이 띠(끈): 폭 w, 두께 t
  function strap(g, m, p0, p1, w, t) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dx, dy, dz);
    const o = A(g, BX(w, t, L), m, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx / L, dy / L, dz / L));
    return o;
  }
  const HC = [0, 0.082, -0.004], HR = [0.106, 0.142, 0.122];
  const HELMETS = {
    // 1: 범프 헬멧(통풍구 있는 가벼운 껍데기)
    1(g) {
      const sh = M('polymer', 0x8c8778), dk = M('polymer', 0x2b2a27), st = M('cloth', 0x3a3a34);
      A(g, shell(HC, HR, (a) => { const t = Math.abs(a); return t < 0.8 ? 0.4 : t < 1.9 ? lerp(0.4, 0.12, sstep(0.8, 1.6, t)) : lerp(0.12, -0.02, sstep(1.9, 3, t)); }), sh);
      for (const [x, z, ry] of [[0.035, 0.045, 0.3], [-0.035, 0.045, -0.3], [0.05, -0.02, 0.2], [-0.05, -0.02, -0.2], [0, -0.06, 0]]) A(g, RB(0.012, 0.006, 0.04, 0.003), dk, x, HC[1] + 0.135, z, -0.35 * Math.sign(z || 1) * 0, ry, 0);
      for (const s of [1, -1]) { strap(g, st, [s * 0.085, 0.095, 0.02], [s * 0.06, -0.02, 0.05], 0.014, 0.004); strap(g, st, [s * 0.06, -0.02, 0.05], [0, -0.05, 0.06], 0.012, 0.004); }
      A(g, RB(0.026, 0.01, 0.03, 0.004), dk, 0, HC[1] + 0.095, 0.112, -0.5, 0, 0);
    },
    // 2: 귀까지 덮는 전투 헬멧(천 커버) + 야간 투시경 거치대 + 옆 레일 + 뒤 패치
    2(g) {
      const cv = M('cloth', 0x5d6146), dk = M('polymer', 0x22231f), st = M('cloth', 0x2f3128);
      A(g, shell(HC, [HR[0] + 0.004, HR[1], HR[2] + 0.002], (a) => { const t = Math.abs(a); return t < 0.75 ? 0.36 : t < 1.25 ? lerp(0.36, 0.05, sstep(0.75, 1.2, t)) : t < 2.2 ? lerp(0.05, -0.32, sstep(1.25, 1.7, t)) : lerp(-0.32, -0.36, sstep(2.2, 3, t)); }, 0.08), cv);
      A(g, RB(0.05, 0.034, 0.016, 0.006), dk, 0, HC[1] + 0.07, 0.118, -0.3, 0, 0);
      A(g, RB(0.032, 0.02, 0.012, 0.004), M('metal', 0x3a3d40), 0, HC[1] + 0.06, 0.125, -0.3, 0, 0);
      for (const s of [1, -1]) { A(g, RB(0.012, 0.016, 0.085, 0.004), dk, s * 0.106, HC[1] + 0.035, 0.0, 0, s * 0.08, s * 0.25); strap(g, st, [s * 0.09, 0.0, 0.03], [s * 0.05, -0.05, 0.06], 0.014, 0.004); }
      strap(g, st, [0.05, -0.05, 0.06], [-0.05, -0.05, 0.06], 0.012, 0.004);
      A(g, RB(0.06, 0.04, 0.012, 0.005), M('cloth', 0x4a4e38), 0, HC[1] + 0.05, -0.122, 0.25, 0, 0);
    },
    // 3: 귀가 드러나는 하이컷 헬멧 + 귀마개 헤드셋 + 레일 + 균형추 파우치
    3(g) {
      const sh = M('polymer', 0x3b3f42), dk = M('polymer', 0x1c1e20), cup = M('rubber', 0x26282a);
      A(g, shell(HC, [HR[0] + 0.003, HR[1] + 0.004, HR[2] + 0.003], (a) => { const t = Math.abs(a); return t < 0.75 ? 0.36 : t < 1.0 ? lerp(0.36, 0.3, sstep(0.75, 1.0, t)) : t < 2.05 ? 0.3 : lerp(0.3, -0.3, sstep(2.05, 2.6, t)); }, 0.08), sh);
      A(g, RB(0.056, 0.036, 0.016, 0.006), dk, 0, HC[1] + 0.072, 0.12, -0.3, 0, 0);
      for (const s of [1, -1]) {
        A(g, RB(0.012, 0.018, 0.1, 0.004), dk, s * 0.104, HC[1] + 0.05, -0.005, 0, 0, s * 0.3);
        A(g, CY(0.034, 0.036, 0.03, 16, 'x'), cup, s * 0.092, 0.068, -0.006);
        A(g, CY(0.026, 0.026, 0.006, 14, 'x'), dk, s * 0.108, 0.068, -0.006);
        strap(g, dk, [s * 0.098, 0.1, -0.006], [s * 0.096, 0.15, -0.006], 0.018, 0.006);
        A(g, CY(0.004, 0.003, 0.06, 6, 'z'), dk, s * 0.08, 0.035, 0.04, 0.3, 0, 0);
      }
      A(g, RB(0.08, 0.05, 0.03, 0.008), M('cloth', 0x2a2d30), 0, HC[1] + 0.03, -0.128, 0.15, 0, 0);
    },
  };
  // 조끼(가슴 뼈 로컬): 1 부드러운 방탄조끼 / 2 판형 조끼 + 탄창 주머니 / 3 무거운 판형 조끼 + 목·골반 보호대
  const VESTS = {
    1(g) {
      const c = M('cloth', 0x2b3038), dk = M('cloth', 0x1d2026), vel = M('cloth', 0x3a3f48);
      A(g, RB(0.3, 0.3, 0.032, 0.03), c, 0, 0.025, 0.152); A(g, RB(0.3, 0.32, 0.03, 0.03), c, 0, 0.03, -0.12);
      for (const s of [1, -1]) { strap(g, dk, [s * 0.1, 0.17, 0.15], [s * 0.1, 0.25, 0.02], 0.05, 0.012); strap(g, dk, [s * 0.1, 0.25, 0.02], [s * 0.1, 0.18, -0.12], 0.05, 0.012); A(g, RB(0.022, 0.12, 0.2, 0.01), dk, s * 0.168, -0.035, 0.012); }
      A(g, RB(0.12, 0.05, 0.008, 0.006), vel, 0, 0.12, 0.17);
    },
    2(g) {
      const c = M('cloth', 0x5e5f45), dk = M('cloth', 0x45473a), pk = M('cloth', 0x55573f), bk = M('polymer', 0x1c1c1a);
      A(g, RB(0.3, 0.31, 0.045, 0.025), c, 0, 0.03, 0.158); A(g, RB(0.3, 0.33, 0.042, 0.025), c, 0, 0.03, -0.128);
      for (const s of [1, -1]) {
        strap(g, dk, [s * 0.1, 0.18, 0.16], [s * 0.1, 0.26, 0.02], 0.06, 0.016); strap(g, dk, [s * 0.1, 0.26, 0.02], [s * 0.1, 0.19, -0.13], 0.06, 0.016);
        A(g, RB(0.03, 0.15, 0.24, 0.012), dk, s * 0.17, -0.04, 0.015);
      }
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.085; A(g, RB(0.075, 0.1, 0.045, 0.01), pk, x, -0.07, 0.2); A(g, RB(0.078, 0.03, 0.05, 0.008), dk, x, -0.02, 0.202); A(g, BX(0.02, 0.012, 0.006), bk, x, -0.005, 0.228); }
      A(g, RB(0.13, 0.08, 0.025, 0.01), pk, 0, 0.1, 0.19);
      for (let k = 0; k < 4; k++) A(g, BX(0.26, 0.008, 0.004), dk, 0, -0.08 + k * 0.03, -0.151);
    },
    3(g) {
      const c = M('cloth', 0x34383a), dk = M('cloth', 0x262a2c), pk = M('cloth', 0x2e3234), bk = M('polymer', 0x161718);
      A(g, RB(0.32, 0.34, 0.055, 0.028), c, 0, 0.02, 0.163); A(g, RB(0.32, 0.36, 0.05, 0.028), c, 0, 0.025, -0.133);
      for (const s of [1, -1]) {
        strap(g, dk, [s * 0.1, 0.18, 0.17], [s * 0.1, 0.27, 0.02], 0.07, 0.02); strap(g, dk, [s * 0.1, 0.27, 0.02], [s * 0.1, 0.19, -0.14], 0.07, 0.02);
        A(g, RB(0.04, 0.2, 0.26, 0.015), dk, s * 0.172, -0.03, 0.012);
        A(g, RB(0.07, 0.03, 0.12, 0.012), dk, s * 0.2, 0.23, 0.0, 0, 0, s * -0.55);           // 어깨 보호대
      }
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.09; A(g, RB(0.08, 0.11, 0.05, 0.01), pk, x, -0.07, 0.212); A(g, RB(0.082, 0.032, 0.055, 0.008), dk, x, -0.015, 0.214); }
      A(g, RB(0.14, 0.09, 0.03, 0.012), pk, 0, 0.11, 0.2);
      A(g, RB(0.2, 0.09, 0.03, 0.012), dk, 0, -0.205, 0.165, 0.08, 0, 0);                      // 골반 보호대
      A(g, RB(0.22, 0.06, 0.13, 0.02), dk, 0, 0.255, -0.035, -0.2, 0, 0);                      // 목 보호 칼라
      A(g, BX(0.03, 0.02, 0.008), bk, 0.09, 0.15, 0.192);
    },
  };
  // 가방(가슴 뼈 로컬, 등 뒤)
  const PACKS = {
    1(g) {
      const c = M('cloth', 0x3a4048), dk = M('cloth', 0x25292e), zp = M('polymer', 0x15171a);
      A(g, RB(0.26, 0.36, 0.12, 0.05), c, 0, 0.02, -0.2); A(g, RB(0.2, 0.18, 0.04, 0.03), dk, 0, -0.04, -0.272);
      A(g, BX(0.2, 0.006, 0.006), zp, 0, 0.17, -0.235);
      for (const s of [1, -1]) { strap(g, dk, [s * 0.08, 0.2, -0.15], [s * 0.09, 0.255, 0.0], 0.045, 0.012); strap(g, dk, [s * 0.09, 0.255, 0.0], [s * 0.12, 0.12, 0.155], 0.045, 0.012); strap(g, dk, [s * 0.12, 0.12, 0.155], [s * 0.15, -0.08, 0.1], 0.035, 0.01); }
    },
    2(g) {
      const c = M('cloth', 0x585a43), dk = M('cloth', 0x41432f), pk = M('cloth', 0x4e5039), zp = M('polymer', 0x161616);
      A(g, RB(0.3, 0.42, 0.17, 0.05), c, 0, 0.0, -0.225);
      for (let k = 0; k < 5; k++) A(g, BX(0.22, 0.012, 0.006), dk, 0, -0.15 + k * 0.05, -0.312);
      A(g, RB(0.22, 0.16, 0.05, 0.03), pk, 0, -0.07, -0.33);
      for (const s of [1, -1]) {
        A(g, RB(0.06, 0.16, 0.1, 0.02), pk, s * 0.175, -0.07, -0.225);
        strap(g, dk, [s * 0.08, 0.2, -0.15], [s * 0.09, 0.26, 0.0], 0.05, 0.014); strap(g, dk, [s * 0.09, 0.26, 0.0], [s * 0.12, 0.12, 0.16], 0.05, 0.014); strap(g, dk, [s * 0.12, 0.12, 0.16], [s * 0.155, -0.08, 0.1], 0.04, 0.012);
      }
      A(g, BX(0.24, 0.006, 0.006), zp, 0, 0.2, -0.27);
      strap(g, dk, [-0.1, 0.03, 0.17], [0.1, 0.03, 0.17], 0.02, 0.006);
    },
    3(g) {
      const c = M('cloth', 0x7a6a4f), dk = M('cloth', 0x5c4f3a), pk = M('cloth', 0x6e5f46), rl = M('cloth', 0x4a5040), bt = M('polymer', 0x2a2d2a);
      A(g, RB(0.34, 0.52, 0.21, 0.06), c, 0, 0.01, -0.245);
      A(g, RB(0.32, 0.08, 0.22, 0.04), dk, 0, 0.29, -0.245);                                       // 덮개
      A(g, CY(0.07, 0.07, 0.38, 14, 'x'), rl, 0, -0.29, -0.23);                                     // 침낭 말이
      for (const s of [1, -1]) {
        A(g, RB(0.07, 0.22, 0.12, 0.025), pk, s * 0.2, -0.04, -0.245);
        A(g, CY(0.032, 0.032, 0.17, 12, 'y'), bt, s * 0.205, 0.17, -0.2);
        strap(g, dk, [s * 0.08, 0.22, -0.15], [s * 0.09, 0.27, 0.0], 0.055, 0.016); strap(g, dk, [s * 0.09, 0.27, 0.0], [s * 0.12, 0.12, 0.165], 0.055, 0.016); strap(g, dk, [s * 0.12, 0.12, 0.165], [s * 0.16, -0.1, 0.1], 0.045, 0.014);
      }
      for (let k = 0; k < 4; k++) A(g, BX(0.26, 0.012, 0.006), dk, 0, -0.17 + k * 0.08, -0.357);
      strap(g, dk, [-0.12, -0.16, 0.16], [0.12, -0.16, 0.16], 0.04, 0.012);
    },
  };
  const make = (tbl, kind, lvl) => tbl[lvl] ? Models.cluster('gear:' + kind + lvl, tbl[lvl]) : null;
  // ---------- 사각 낙하산 (램에어) ----------
  // 9칸 날개를 아치 모양으로 배치 + 칸마다 색 교대 + 앞쪽 공기 흡입구 + 줄(어깨 고리로 모임)
  function canopy(skinId) {
    const sk = (Body.SKINS[skinId] && Body.SKINS[skinId].colors) ? Body.SKINS[skinId] : Body.SKINS.chute_basic;
    const g = Models.cluster('chute:' + (Body.SKINS[skinId] ? skinId : 'chute_basic'), (G) => {
      const N = 9, R = 4.6, span = 1.5, H = 4.6, chord = 2.7, th = 0.36;
      const ca = M('cloth', sk.colors[0]), cb = M('cloth', sk.colors[1]), dk = M('cloth', 0x1a1a18);
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N - 0.5, a = t * span, x = Math.sin(a) * R, y = H + Math.cos(a) * R - R, w = 2 * R * Math.sin(span / N / 2) * 1.02;
        A(G, RB(w, th, chord, 0.15), i % 2 ? cb : ca, x, y, 0.35, 0, 0, -a);
        A(G, RB(w * 0.82, th * 0.55, 0.05, 0.03), dk, x, y - 0.02, 0.35 + chord / 2 - 0.01, 0, 0, -a);
      }
      // 꼬리 쪽 얇은 날
      for (let i = 0; i < N; i++) { const t = (i + 0.5) / N - 0.5, a = t * span, x = Math.sin(a) * R, y = H + Math.cos(a) * R - R; A(G, BX(2 * R * Math.sin(span / N / 2), 0.03, 0.4), i % 2 ? cb : ca, x, y - 0.05, 0.35 - chord / 2 - 0.15, 0, 0, -a); }
    });
    // 줄: 칸 경계 아래 3곳 → 같은 쪽 어깨 고리
    const pts = [], N = 9, R = 4.6, span = 1.5, H = 4.6;
    for (let i = 0; i <= N; i++) {
      const a = (i / N - 0.5) * span, x = Math.sin(a) * R, y = H + Math.cos(a) * R - R - 0.17, side = x >= 0 ? 1 : -1;
      for (const z of [1.5, 0.35, -0.8]) { pts.push(x * 0.97, y, z, side * 0.15, 1.58, z > 1 ? 0.06 : z > 0 ? 0.0 : -0.06); }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a2a26 }));
    g.add(lines);
    // 조종줄(브레이크): 양쪽 끝 칸 뒷전 → 손 (매 프레임 손 위치로 갱신)
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const brakes = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x3a3a34 }));
    brakes.frustumCulled = false; g.add(brakes);
    const tip = (s) => { const a = s * span * 0.47; return [Math.sin(a) * R, H + Math.cos(a) * R - R - 0.1, 0.35 - 1.3]; };
    g.userData.brakes = brakes; g.userData.tipL = tip(1); g.userData.tipR = tip(-1);
    return g;
  }
  return { helmet: (l) => make(HELMETS, 'helmet', l), vest: (l) => make(VESTS, 'vest', l), pack: (l) => make(PACKS, 'pack', l), canopy, shell, build: { helmet: HELMETS, vest: VESTS, pack: PACKS } };
})();
