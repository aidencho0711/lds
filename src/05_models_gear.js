// ============================================================
// 05_models_gear.js — 몸에 붙는 장비: 헬멧 3종 · 조끼 3종 · 가방 3종 · 사각(램에어) 낙하산
//  실제 장비의 일반적인 형태를 참고한 자체 모델링 (다른 게임의 디자인을 따르지 않음)
//  v23: 레벨마다 실루엣이 확 다르다 — 멀리서 이름을 보지 않아도 모양만으로 레벨을 알 수 있게
//   헬멧 1 작고 낮은 통풍 헬멧(귀 드러남 · 옆에 아무것도 없음) · 2 귀까지 덮는 천 커버 헬멧 + 고무 밴드 + 고글
//        3 하이컷 헬멧 + 큰 귀덮개 헤드셋 + 앞 위로 젖힌 쌍안 야간 투시경 + 옆 레일 + 뒤 균형추
//   조끼 1 얇은 소프트 조끼(주머니 없이 매끈) · 2 판형 조끼 + 앞 탄창 주머니 3 + 어깨 위로 솟은 무전기 안테나
//        3 두꺼운 중장 조끼 + 목 칼라 + 어깨 보호대(어깨가 넓어 보임) + 골반 보호대 + 주머니 가득
//   가방 1 등에 붙는 작은 데이팩 · 2 옆 물병 주머니가 튀어나온 몰리 배낭 · 3 어깨 위로 솟는 대형 배낭 + 덮개 + 아래 침낭 말이 + 허리 벨트
//  · 스킨(04_skins.js slot 'helmet'·'pack'): 레벨 모양은 그대로 두고 색·무늬(옷 아틀라스 셀 — 위장·빛나는 선도)·장식(산타 털·뿔·리본·전구·고드름)만 바뀐다
//  · LOD: 멀리(lo)는 작은 부품을 뺀 간략 모델 — 레벨을 알리는 큰 모양(투시경·헤드셋·어깨 보호대·안테나·가방 크기)은 그대로
//  · 바닥 아이템(item)은 턱끈·어깨끈을 뺀다 (끈 때문에 공중에 뜨지 않게)
//  좌표: 헬멧 = 머리 뼈 로컬, 조끼·가방 = 가슴 뼈 로컬, 낙하산 = 캐릭터 발 기준 (+z 앞, +y 위, +x 왼쪽)
// ============================================================
const Gear = (() => {
  const { A, BX, CY, RB, SPH, TOR, M } = Models.kit;
  const V3 = THREE.Vector3;
  // ---------- 공통 지오메트리 ----------
  // 같은 자리 정점끼리 법선을 평균 (상자 면 사이·껍데기 이음매가 각지지 않게)
  function smooth(geo) {
    geo.computeVertexNormals();
    const P = geo.attributes.position, N = geo.attributes.normal, map = new Map(), keys = new Array(P.count);
    for (let i = 0; i < P.count; i++) {
      const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); keys[i] = k;
      const a = map.get(k); if (a) { a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i); } else map.set(k, [N.getX(i), N.getY(i), N.getZ(i)]);
    }
    for (let i = 0; i < P.count; i++) { const a = map.get(keys[i]), l = Math.hypot(a[0], a[1], a[2]) || 1; N.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    N.needsUpdate = true; return geo;
  }
  // 푹신한 상자(가방 몸통·주머니·패드·판): w×h×d · r = 모서리 둥글기(축마다 반폭에 대한 비율) · b = 면 가운데 부풂 [x, y, z]
  //  top = [kx, kz]: 위로 갈수록 폭·두께가 줄어듦 (둥근 가방 윗부분)
  function pillow(w, h, d, r = 0.3, b = 0, seg = [6, 6, 4], top = null) {
    const rr = (Array.isArray(r) ? r : [r, r, r]).map((v) => Math.max(0.02, Math.min(0.98, v))), bb = Array.isArray(b) ? b : [0, 0, b];
    const g = new THREE.BoxGeometry(2, 2, 2, seg[0], seg[1], seg[2]), P = g.attributes.position;
    const wp = (v) => Math.sin(v * Math.PI / 2);   // 가장자리 쪽에 정점을 모음 → 둥근 모서리가 매끈
    for (let i = 0; i < P.count; i++) {
      let x = wp(P.getX(i)), y = wp(P.getY(i)), z = wp(P.getZ(i));
      const ix = clamp(x, rr[0] - 1, 1 - rr[0]), iy = clamp(y, rr[1] - 1, 1 - rr[1]), iz = clamp(z, rr[2] - 1, 1 - rr[2]);
      const dx = (x - ix) / rr[0], dy = (y - iy) / rr[1], dz = (z - iz) / rr[2], dl = Math.hypot(dx, dy, dz);
      if (dl > 1e-6) { x = ix + dx / dl * rr[0]; y = iy + dy / dl * rr[1]; z = iz + dz / dl * rr[2]; }
      let X = x * (1 + bb[0] * (1 - y * y) * (1 - z * z)), Y = y * (1 + bb[1] * (1 - x * x) * (1 - z * z)), Z = z * (1 + bb[2] * (1 - x * x) * (1 - y * y));
      if (top) { const k = Math.max(0, y) * Math.max(0, y); X *= 1 - top[0] * k; Z *= 1 - top[1] * k; }
      P.setXYZ(i, X * w / 2, Y * h / 2, Z * d / 2);
    }
    return smooth(g);
  }
  // 곡선을 따라 가는 납작한 띠(끈·밴드·칼라): nf(p) = 그 점에서 띠 넓은 면이 향할 바깥 방향
  function ribbon(pts, nf, w, t, segs = 0, closed = false) {
    const cv = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])), closed), N = segs || Math.max(8, pts.length * 4);
    const P = [], U = [], I = [], tg = new V3(), nn = new V3(), bb = new V3(), p = new V3(), rings = closed ? N : N + 1;
    for (let i = 0; i < rings; i++) {
      const u = i / N; cv.getPointAt(u, p); cv.getTangentAt(u, tg);
      const n0 = nf(p); nn.set(n0[0], n0[1], n0[2]); nn.addScaledVector(tg, -nn.dot(tg)).normalize(); bb.crossVectors(tg, nn).normalize();
      for (const [sw, st] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
        P.push(p.x + bb.x * sw * w / 2 + nn.x * st * t / 2, p.y + bb.y * sw * w / 2 + nn.y * st * t / 2, p.z + bb.z * sw * w / 2 + nn.z * st * t / 2); U.push(sw > 0 ? 1 : 0, u);
      }
    }
    for (let i = 0; i < N; i++) { const a = i * 4, b = ((i + 1) % rings) * 4; for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; I.push(a + k, a + k2, b + k, a + k2, b + k2, b + k); } }
    if (!closed) { const e = N * 4; I.push(0, 2, 1, 0, 3, 2, e, e + 1, e + 2, e, e + 2, e + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    g.computeVertexNormals(); return g;
  }
  // 곡선을 따라 가는 둥근 줄(고무줄·전선·안테나·끈 테두리)
  function cord(pts, r, rad = 5, closed = false, segs = 0) {
    const cv = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])), closed);
    return new THREE.TubeGeometry(cv, segs || Math.max(6, pts.length * 3), r, rad, closed);
  }
  // 두 점 사이 띠(짧은 끈): 폭 w, 두께 t
  function strap(g, m, p0, p1, w, t) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dx, dy, dz);
    const o = put(g, BX(w, t, L), m, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
    o.quaternion.setFromUnitVectors(new V3(0, 0, 1), new V3(dx / L, dy / L, dz / L));
    return o;
  }
  // 로컬 +z 가 n 을 보게 (위쪽 힌트 up)
  const _m4 = new THREE.Matrix4(), _vx = new V3(), _vy = new V3(), _vz = new V3();
  function orient(o, n, up = [0, 1, 0]) {
    _vz.set(n[0], n[1], n[2]).normalize(); _vy.set(up[0], up[1], up[2]); _vx.crossVectors(_vy, _vz);
    if (_vx.lengthSq() < 1e-8) _vx.set(1, 0, 0); _vx.normalize(); _vy.crossVectors(_vz, _vx);
    o.quaternion.setFromRotationMatrix(_m4.makeBasis(_vx, _vy, _vz)); return o;
  }

  // ---------- 재질 ----------
  //  Models.kit M(kind, color): 정점 색 + 3계열 재질로 합쳐짐 / { cell, color }: 옷 아틀라스의 무늬 칸(위장·니트·빛나는 선 …)을 색으로 물들임
  //  { glow }: 스스로 빛나는 점(전구·빨간 코) — 정점 색 하나의 재질
  let GLOWM = null;
  function glowMat() { if (!GLOWM) { GLOWM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); GLOWM.userData.clsKey = 'gear:glow'; } return GLOWM; }
  function tint(geo, color) {
    const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  }
  // uv 를 셀 칸 안으로 (0~1 을 벗어난 uv 는 그 지오메트리 범위로 맞춤)
  function cellify(geo, cell, color) {
    const uv = geo.attributes.uv, n = geo.attributes.position.count, out = new Float32Array(n * 2);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    if (uv) for (let i = 0; i < n; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const norm = uv && (u0 < -0.001 || u1 > 1.001 || v0 < -0.001 || v1 > 1.001);
    for (let i = 0; i < n; i++) {
      let u = uv ? uv.getX(i) : 0.5, v = uv ? uv.getY(i) : 0.5;
      if (norm) { u = (u - u0) / Math.max(1e-6, u1 - u0); v = (v - v0) / Math.max(1e-6, v1 - v0); }
      const q = Body.cellUV(cell, u, v); out[i * 2] = q[0]; out[i * 2 + 1] = q[1];
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(out, 2)); return tint(geo, color);
  }
  function put(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    if (m && m.cell) { cellify(geo, m.cell, m.color); return A(g, geo, Body.rigidMaterial(), x, y, z, rx, ry, rz); }
    if (m && m.glow !== undefined) { tint(geo, m.glow); return A(g, geo, glowMat(), x, y, z, rx, ry, rz); }
    return A(g, geo, m, x, y, z, rx, ry, rz);
  }
  const FUR = { cell: 'fleece', color: 0xf4f2ee };

  // ---------- 몸통 둘레 (가슴 뼈 로컬, 조끼·가방 끈) ----------
  //  단면 = 초타원: 중심 z = TZ, 반폭 TX, 반깊이 TZR, 지수 TE (재킷까지 덮는 크기). 각도 a: 0 = 정면(+z), +π/2 = 왼쪽(+x), ±π = 등
  const TZ = 0.012, TX = 0.2, TZR = 0.135, TE = 2.5;
  const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  const _tp = [0, 0, 0, 0];
  function tpt(a, off, out = _tp) {
    const s = Math.sin(a), c = Math.cos(a), x = TX * spow(s, 2 / TE), z = TZ + TZR * spow(c, 2 / TE);
    let nx = Math.sign(x) * Math.pow(Math.abs(x / TX), TE - 1) / TX, nz = Math.sign(z - TZ) * Math.pow(Math.abs((z - TZ) / TZR), TE - 1) / TZR;
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    out[0] = x + nx * off; out[1] = z + nz * off; out[2] = nx; out[3] = nz; return out;
  }
  // 각도 ↔ 둘레 길이 표 (거리 off 마다)
  const ARC = new Map();
  function arcT(off) {
    const k = off.toFixed(3); let t = ARC.get(k); if (t) return t;
    const N = 720, A2 = new Float32Array(N + 1), S = new Float32Array(N + 1), p = [0, 0, 0, 0]; let px = 0, pz = 0, s = 0;
    for (let i = 0; i <= N; i++) { const a = -Math.PI + i / N * TAU; tpt(a, off, p); if (i) s += Math.hypot(p[0] - px, p[1] - pz); px = p[0]; pz = p[1]; A2[i] = a; S[i] = s; }
    t = { A: A2, S, N }; ARC.set(k, t); return t;
  }
  const sAt = (t, a) => { const f = (a + Math.PI) / TAU * t.N, i = clamp(Math.floor(f), 0, t.N - 1); return lerp(t.S[i], t.S[i + 1], f - i); };
  function aAt(t, s) { let lo = 0, hi = t.N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.S[m] < s) lo = m; else hi = m; } return lerp(t.A[lo], t.A[hi], (s - t.S[lo]) / Math.max(1e-9, t.S[hi] - t.S[lo])); }
  // 평평한 지오메트리(x = 둘레 방향 길이, y = 높이, z = 몸에서 떨어진 거리)를 몸통에 감는다 — 가운데 각도 ac, 기준 거리 off, 높이 yc
  function bendT(geo, ac, off, yc = 0) {
    const t = arcT(off), Sc = sAt(t, ac), tot = t.S[t.N], P = geo.attributes.position, p = [0, 0, 0, 0];
    for (let i = 0; i < P.count; i++) { const s = (((Sc + P.getX(i)) % tot) + tot) % tot; tpt(aAt(t, s), off + P.getZ(i), p); P.setXYZ(i, p[0], P.getY(i) + yc, p[1]); }
    P.needsUpdate = true; return smooth(geo);
  }
  // 판 윗부분 모양: 바깥 위 모서리를 깎고(팔 구멍) 가운데를 파냄(목) — cut = [팔 깎기 비율, 깎기 시작 x, 목 파기 비율, 목 폭]
  function cutTop(geo, w, h, cut) {
    if (!cut) return geo;
    const P = geo.attributes.position, [arm, x0, neck, xs] = cut;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i); if (y <= 0) continue;
      const ax = clamp((Math.abs(x) - x0) / Math.max(0.01, w / 2 - x0), 0, 1), nk = Math.max(0, 1 - (x / xs) * (x / xs));
      P.setY(i, y * (1 - arm * ax * ax - neck * nk));
    }
    P.needsUpdate = true; return geo;
  }
  // 몸에 감은 판: 안쪽 면이 off 에 닿게 (두께 th 는 바깥으로)
  const panel = (g, m, w, h, th, ac, off, yc, seg, r = [0.12, 0.14, 0.6], b = [0, 0, 0.05], cut = null) => put(g, bendT(cutTop(pillow(w, h, th, r, b, seg), w, h, cut).translate(0, 0, th / 2), ac, off, yc), m);
  // 몸통 위 한 자리에 붙는 묶음(주머니 등): 로컬 +z = 바깥
  function grpT(g, a, off, y, tilt = 0) { const q = tpt(a, off), o = new THREE.Group(); o.position.set(q[0], y, q[1]); o.rotation.set(tilt, Math.atan2(q[2], q[3]), 0, 'YXZ'); g.add(o); return o; }
  // 몰리 웨빙: 몸에 감긴 가로 띠 줄 (hi 면 박음질 칸도)
  function molle(g, P, ac, off, y0, arc, rows, gap = 0.034) {
    for (let k = 0; k < rows; k++) {
      const y = y0 + k * gap;
      put(g, bendT(pillow(arc, 0.024, 0.0045, [0.04, 0.3, 0.5], 0, [P.lo ? 4 : 10, 1, 1]).translate(0, 0, 0.002), ac, off, y), P.strap);
      if (!P.lo && !P.cheap) for (let x = -arc / 2 + 0.019; x < arc / 2 - 0.01; x += 0.038) put(g, bendT(BX(0.0035, 0.025, 0.002).translate(x, 0, 0.0048), ac, off, y), P.seam);
    }
  }

  // ---------- 헬멧 껍데기 (머리 뼈 로컬) ----------
  const HC = [0, 0.082, -0.004], HR = [0.106, 0.142, 0.122];
  const wrapA = (a) => (a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a);
  // 타원체(c, r) — 정수리에서 테두리 rim(a)(단위구 y, 방위각 a: 0 정면·+왼쪽)까지, 테두리는 두께만큼 안으로 접음
  //  uv: 앞쪽 반(옆 → 정면 → 옆)과 뒤쪽 반이 각각 0~1 (둘레를 한 번에 펴면 무늬가 옆으로 너무 늘어남)
  function shell(c, r, rim, th = 0.07, AN = 30, RN = 10) {
    const P = [], U = [], I = [], rows = [];
    for (let i = 0; i <= RN; i++) rows.push([i / RN, 1]);
    rows.push([1.02, 1 - th * 0.5], [1.12, 1 - th]);
    const H = AN / 2;
    for (let s = 0; s < 2; s++) {
      const base = P.length / 3;
      for (const [t, k] of rows) for (let j = 0; j <= H; j++) {
        const a = wrapA(-Math.PI / 2 + (s * H + j) / AN * TAU), lim = rim(a), uy = t <= 1 ? lerp(1, lim, Math.pow(t, 0.85)) : lim + (t - 1) * 0.25, cb = Math.sqrt(Math.max(0, 1 - uy * uy));
        P.push(c[0] + Math.sin(a) * cb * r[0] * k, c[1] + uy * r[1] * k, c[2] + Math.cos(a) * cb * r[2] * k); U.push(j / H, 1 - Math.min(1, t));
      }
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < H; j++) { const a = base + i * (H + 1) + j, b = a + H + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    return smooth(g);
  }
  // 껍데기 위 한 점 (+ 바깥 법선) — [x, y, z, nx, ny, nz]
  function sp(c, r, a, uy, off = 0) {
    const cb = Math.sqrt(Math.max(0, 1 - uy * uy)), ux = Math.sin(a) * cb, uz = Math.cos(a) * cb;
    let nx = ux / r[0], ny = uy / r[1], nz = uz / r[2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    return [c[0] + ux * r[0] + nx * off, c[1] + uy * r[1] + ny * off, c[2] + uz * r[2] + nz * off, nx, ny, nz];
  }
  // 평평한 조각(x = 옆으로(왼쪽 +), y = 위로, z = 껍데기에서 떨어진 거리)을 껍데기의 (a0, uy0) 자리에 감는다
  function bendS(geo, c, r, a0, uy0, off = 0) {
    const P = geo.attributes.position, f0 = Math.asin(clamp(uy0, -0.99, 0.99)), rhE = Math.abs(Math.sin(a0)) * r[0] + Math.abs(Math.cos(a0)) * r[2];
    const Lv = Math.hypot(r[1] * Math.cos(f0), rhE * Math.sin(f0)), Lh = Math.max(0.02, rhE * Math.cos(f0));
    for (let i = 0; i < P.count; i++) { const f = clamp(f0 + P.getY(i) / Lv, -1.5, 1.52), q = sp(c, r, a0 + P.getX(i) / Lh, Math.sin(f), off + P.getZ(i)); P.setXYZ(i, q[0], q[1], q[2]); }
    P.needsUpdate = true; return smooth(geo);
  }
  const rimPts = (c, r, rim, off, n = 40, dy = 0) => { const o = []; for (let j = 0; j < n; j++) { const a = -Math.PI + j / n * TAU, q = sp(c, r, a, rim(a) + dy, off); o.push([q[0], q[1], q[2]]); } return o; };
  const ringPts = (c, r, uyf, off, n = 40) => { const o = []; for (let j = 0; j < n; j++) { const a = -Math.PI + j / n * TAU, q = sp(c, r, a, uyf(a), off); o.push([q[0], q[1], q[2]]); } return o; };
  const nS = (c, r) => (p) => { const x = (p.x - c[0]) / (r[0] * r[0]), y = (p.y - c[1]) / (r[1] * r[1]), z = (p.z - c[2]) / (r[2] * r[2]), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const nHead = (p) => { const x = p.x, y = p.y - 0.04, z = p.z - 0.005, l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  // 턱끈: 귀 앞·뒤 두 갈래가 턱 옆에서 만나 턱 아래로 (n4 = 4점식이면 뒤 갈래도)
  function chin(g, P, front, back, cup = true) {
    if (P.item) return;
    for (const s of [1, -1]) {
      const j = [s * 0.084, 0.0, 0.03];
      put(g, ribbon([[s * front[0], front[1], front[2]], [s * (front[0] - 0.004), (front[1] + j[1]) / 2 + 0.01, (front[2] + j[2]) / 2 + 0.006], j], nHead, 0.016, 0.003, P.lo ? 4 : 8), P.strap);
      if (back) put(g, ribbon([[s * back[0], back[1], back[2]], [s * (back[0] - 0.002), (back[1] + j[1]) / 2, (back[2] + j[2]) / 2 - 0.004], j], nHead, 0.016, 0.003, P.lo ? 4 : 8), P.strap);
      put(g, ribbon([j, [s * 0.066, -0.012, 0.038], [s * 0.03, -0.028, 0.047], [0, -0.032, 0.051]], nHead, 0.017, 0.003, P.lo ? 4 : 10), P.strap);
      if (!P.lo && s === 1) put(g, pillow(0.026, 0.018, 0.011, 0.35, 0, [2, 2, 1]), P.dark, j[0] + 0.004, j[1] - 0.004, j[2] + 0.004, 0, 0.5, 0);   // 버클
    }
    if (cup) put(g, pillow(0.05, 0.02, 0.016, [0.5, 0.6, 0.6], [0, 0, 0.1], [3, 2, 2]), P.pad, 0, -0.034, 0.053, -0.95, 0, 0);   // 턱받이
  }
  // 헬멧 장식 (스킨): c·r = 껍데기, rim = 테두리, front = 코(빨간 빛) 자리 [x, y, z]
  function decoHelm(g, P, c, r, rim, front) {
    const D = P.deco; if (!D) return;
    const ty = c[1] + r[1];
    if (D === 'santa') {
      put(g, cord(rimPts(c, r, rim, 0.008, P.lo ? 20 : 40), 0.017, P.lo ? 5 : 8, true), FUR);
      const T = [[0, ty + 0.006, -0.02, 0.05], [0.014, ty + 0.03, -0.058, 0.042], [0.032, ty + 0.034, -0.096, 0.034], [0.05, ty + 0.018, -0.13, 0.027], [0.064, ty - 0.008, -0.154, 0.021]];
      for (const [x, y, z, rr] of T) put(g, SPH(rr, P.lo ? 8 : 12, P.lo ? 6 : 9), P.tail, x, y, z);
      put(g, SPH(0.03, P.lo ? 8 : 12, P.lo ? 6 : 9), P.pom ? { cell: 'fleece', color: P.pom } : FUR, 0.074, ty - 0.03, -0.17);
    } else if (D === 'antlers') {
      // 뿔: 굵기가 줄어드는 매끈한 가지 (마디마다 원뿔대 + 이음매 구) + 앞으로 뻗은 갈래 둘
      const ac = P.antler, seg = P.lo ? 5 : 8;
      for (const s of [1, -1]) {
        const bx = s * 0.05, by = ty - 0.018, bz = -0.01, beam = [[0, 0, 0, 0.016], [0.012, 0.032, -0.004, 0.014], [0.028, 0.062, -0.014, 0.012], [0.042, 0.09, -0.024, 0.0105], [0.052, 0.114, -0.036, 0.009], [0.058, 0.134, -0.048, 0.007]];
        const W = (L) => L.map(([x, y, z, rr]) => [bx + s * x, by + y, bz + z, rr]);
        limb(g, ac, W(beam), seg);
        for (const [k, dx, dy, dz] of [[1, 0.012, 0.062, 0.07], [3, 0.018, 0.066, 0.06]]) { const [x, y, z, rr] = beam[k]; limb(g, ac, W([[x, y, z, rr * 0.8], [x + dx * 0.5, y + dy * 0.55, z + dz * 0.45, rr * 0.6], [x + dx, y + dy, z + dz, 0.005]]), seg); }
      }
      put(g, SPH(0.017, 12, 9), { glow: 0xff2a2a }, front[0], front[1], front[2]);   // 빛나는 빨간 코
    } else if (D === 'lights') {
      const L = ringPts(c, r, (a) => 0.42 - 0.1 * Math.abs(Math.sin(a * 0.5)), 0.004, 36);
      if (!P.lo) put(g, cord(L, 0.0016, 3, true), M('rubber', 0x101410));
      const cols = [0xff3a3a, 0xffc93a, 0x3aff7a, 0x3aa8ff, 0xfff2d8, 0xff5ad8];
      for (let i = 0; i < L.length; i += 3) put(g, SPH(0.0075, 6, 5), { glow: cols[(i / 3) % cols.length] }, L[i][0], L[i][1] - 0.006, L[i][2]);
      put(g, star(0.03, 0.008), M('brass', 0xf2c84a), 0, ty + 0.03, -0.005);
    }
  }
  // 굵기가 줄어드는 가지(뿔): pts = [[x, y, z, r], ...] — 마디마다 원뿔대 + 이음매 구
  function limb(g, m, pts, seg = 8) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4;
      const o = put(g, new THREE.CylinderGeometry(b[3], a[3], L, seg, 1, true), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(dx / L, dy / L, dz / L));
      put(g, SPH(a[3], seg, 5), m, a[0], a[1], a[2]);
    }
    const e = pts[pts.length - 1]; put(g, SPH(e[3], seg, 4), m, e[0], e[1], e[2]);
  }
  // 금빛 별 (트리 꼭대기)
  function star(R, t) {
    const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.3, bevelSegments: 1 }); g.translate(0, 0, -t / 2); return g;
  }

  const HELMETS = {
    // ===== 1: 작은 통풍 헬멧 — 낮고 매끈한 껍데기(귀가 다 드러남) · 위로 지나는 능선 두 줄 · 통풍 구멍 · 앞 작은 거치판 · 뒤 조절 다이얼 =====
    1(g, P) {
      const c = HC, r = [HR[0] - 0.003, HR[1] - 0.012, HR[2] - 0.004];
      const rim = (a) => { const t = Math.abs(a); return t < 0.8 ? 0.44 : t < 1.9 ? lerp(0.44, 0.2, sstep(0.8, 1.6, t)) : lerp(0.2, 0.04, sstep(1.9, 3, t)); };
      put(g, shell(c, r, rim, 0.06, P.lo ? 18 : 32, P.lo ? 6 : 10), P.main);
      const nf = nS(c, r);
      // 능선 두 줄 (앞 → 정수리 → 뒤)
      for (const s of [1, -1]) {
        const pts = []; for (let k = 0; k <= 12; k++) { const th = lerp(0.5, 2.8, k / 12); let ux = s * 0.27, uy = Math.sin(th), uz = Math.cos(th); const l = Math.hypot(ux, uy, uz); pts.push([c[0] + ux / l * r[0], c[1] + uy / l * r[1], c[2] + uz / l * r[2]]); }
        put(g, ribbon(pts, nf, 0.026, 0.013, P.lo ? 8 : 20), P.main);
      }
      // 앞 거치판 (작음) + 가운데 홈
      put(g, bendS(pillow(0.056, 0.03, 0.008, [0.25, 0.3, 0.5], 0, [4, 3, 1]), c, r, 0, 0.53, 0.002), P.dark);
      if (P.lo) { chin(g, P, [0.094, 0.11, 0.02], null, false); decoHelm(g, P, c, r, rim, sp(c, r, 0, 0.7, 0.012)); return; }
      put(g, bendS(BX(0.024, 0.007, 0.004).translate(0, 0, 0.009), c, r, 0, 0.53, 0.002), M('polymer', 0x0c0c0c));
      // 통풍 구멍: 능선 사이·옆·뒤에 길쭉한 어두운 구멍
      for (const [a, uy, w, hh] of [[0, 0.8, 0.013, 0.04], [Math.PI, 0.72, 0.013, 0.04], [0.62, 0.62, 0.034, 0.012], [-0.62, 0.62, 0.034, 0.012], [1.25, 0.5, 0.034, 0.012], [-1.25, 0.5, 0.034, 0.012], [2.25, 0.5, 0.032, 0.012], [-2.25, 0.5, 0.032, 0.012], [0.95, 0.78, 0.026, 0.011], [-0.95, 0.78, 0.026, 0.011]])
        put(g, bendS(pillow(w, hh, 0.006, [0.6, 0.9, 0.5], 0, [3, 2, 1]), c, r, a, uy, -0.0012), P.hole);
      // 옆 작은 고리(장비 고정) — 레일 없음 (1레벨은 옆이 매끈)
      for (const s of [1, -1]) put(g, bendS(pillow(0.026, 0.014, 0.006, 0.4, 0, [2, 2, 1]), c, r, s * 1.3, 0.34, 0.001), P.dark);
      // 테두리 고무
      put(g, cord(rimPts(c, r, rim, 0.0005, 48), 0.004, 4, true), P.trim);
      // 뒤 조절 다이얼 + 머리띠
      const q = sp(c, r, Math.PI, 0.0, 0.004);
      const dl = put(g, CY(0.017, 0.017, 0.013, 14, 'z'), P.dark, q[0], q[1] - 0.012, q[2]); orient(dl, [q[3], q[4], q[5]]);
      const dk = put(g, TOR(0.0165, 0.0028, 4, 14), P.dark, q[0], q[1] - 0.012, q[2]); orient(dk, [q[3], q[4], q[5]]);
      for (const s of [1, -1]) put(g, ribbon([[0, q[1] - 0.012, q[2] + 0.004], [s * 0.06, 0.08, -0.095], [s * 0.096, 0.1, -0.03]], nHead, 0.014, 0.003, 8), P.strap);
      chin(g, P, [0.094, 0.11, 0.02], [0.088, 0.085, -0.075], false);
      decoHelm(g, P, c, r, rim, sp(c, r, 0, 0.7, 0.012));
    },
    // ===== 2: 귀까지 덮는 전투 헬멧 — 천 커버(박음선·조임 밑단) · 고무 밴드 · 앞 위에 고글 · 뒤 표식 =====
    2(g, P) {
      const c = HC, r = [HR[0] + 0.009, HR[1] + 0.002, HR[2] + 0.008];
      const rim = (a) => { const t = Math.abs(a); return t < 0.75 ? 0.36 : t < 1.25 ? lerp(0.36, 0.05, sstep(0.75, 1.2, t)) : t < 2.2 ? lerp(0.05, -0.32, sstep(1.25, 1.7, t)) : lerp(-0.32, -0.36, sstep(2.2, 3, t)); };
      put(g, shell(c, r, rim, 0.08, P.lo ? 18 : 32, P.lo ? 6 : 11), P.main);
      const nf = nS(c, r);
      // 고무 밴드: 앞에서는 고글 높이, 뒤로 갈수록 낮게
      const bandUy = (a) => lerp(0.6, 0.24, sstep(0.35, 2.7, Math.abs(a)));
      put(g, ribbon(ringPts(c, r, bandUy, 0.003, P.lo ? 24 : 44), nf, 0.026, 0.005, P.lo ? 24 : 44, true), P.strap);
      // 고글: 고무 테 + 렌즈 둘 (앞 위)
      put(g, bendS(pillow(0.17, 0.054, 0.024, [0.3, 0.55, 0.5], [0, 0, 0.05], P.lo ? [4, 2, 1] : [10, 3, 2]), c, r, 0, 0.6, 0.004), P.rubber);
      for (const s of [1, -1]) put(g, bendS(pillow(0.068, 0.038, 0.006, [0.6, 0.8, 0.6], [0, 0, 0.2], [4, 3, 1]).translate(s * 0.039, 0, 0.026), c, r, 0, 0.6, 0.004), P.lens);
      if (P.lo) { chin(g, P, [0.112, 0.05, 0.035], null, false); decoHelm(g, P, c, r, rim, sp(c, r, 0, 0.46, 0.012)); return; }
      // 커버 밑단(조임 고무줄) + 박음선
      put(g, cord(rimPts(c, r, rim, 0.002, 48), 0.0058, 5, true), P.sub);
      for (const a of [0.62, -0.62, 2.35, -2.35]) { const pts = []; for (let k = 0; k <= 8; k++) { const q = sp(c, r, a, lerp(rim(a) + 0.04, 0.95, k / 8), 0.0004); pts.push([q[0], q[1], q[2]]); } put(g, cord(pts, 0.0016, 3), P.seam); }
      // 코 받침 자국 + 고글 끈 고리
      put(g, bendS(BX(0.02, 0.012, 0.004).translate(0, -0.024, 0.024), c, r, 0, 0.6, 0.004), P.rubber);
      for (const s of [1, -1]) put(g, bendS(pillow(0.016, 0.03, 0.01, 0.4, 0, [2, 2, 1]), c, r, s * 0.95, 0.56, 0.006), P.rubber);
      // 뒤: 반사 표식 둘(밴드 위) + 적외선 표식 패치
      for (const s of [1, -1]) put(g, bendS(pillow(0.018, 0.012, 0.004, 0.3, 0, [2, 2, 1]), c, r, Math.PI + s * 0.32, bandUy(Math.PI), 0.007), P.reflect);
      put(g, bendS(pillow(0.046, 0.044, 0.004, 0.25, 0, [3, 3, 1]), c, r, Math.PI, 0.56, 0.001), P.sub);
      put(g, bendS(pillow(0.022, 0.016, 0.012, 0.3, 0, [2, 2, 1]).translate(0, 0, 0.004), c, r, Math.PI, 0.56, 0.001), P.dark);
      chin(g, P, [0.112, 0.05, 0.035], [0.105, 0.02, -0.08], true);
      decoHelm(g, P, c, r, rim, sp(c, r, 0, 0.46, 0.012));
    },
    // ===== 3: 하이컷 헬멧 — 귀가 드러나게 깎은 껍데기 · 큰 귀덮개 헤드셋 + 마이크 · 앞 위로 젖힌 쌍안 야간 투시경 · 옆 레일 · 뒤 균형추 =====
    3(g, P) {
      const c = HC, r = [HR[0] + 0.005, HR[1] + 0.006, HR[2] + 0.004];
      const rim = (a) => { const t = Math.abs(a); return t < 0.75 ? 0.36 : t < 1.0 ? lerp(0.36, 0.3, sstep(0.75, 1.0, t)) : t < 2.05 ? 0.3 : lerp(0.3, -0.3, sstep(2.05, 2.6, t)); };
      put(g, shell(c, r, rim, 0.08, P.lo ? 18 : 32, P.lo ? 6 : 11), P.main);
      // 옆 레일 (껍데기를 따라 휨)
      for (const s of [1, -1]) {
        put(g, bendS(pillow(0.16, 0.024, 0.011, [0.12, 0.35, 0.5], 0, [P.lo ? 4 : 8, 2, 1]), c, r, s * 1.55, 0.37, 0.002), P.dark);
        if (!P.lo) for (let k = 0; k < 6; k++) put(g, bendS(BX(0.012, 0.009, 0.003).translate((k - 2.5) * 0.024, 0, 0.012), c, r, s * 1.55, 0.37, 0.002), P.hole);
      }
      // 헤드셋: 둥근 귀덮개 + 쿠션 + 레일에 거는 팔
      for (const s of [1, -1]) {
        put(g, pillow(0.036, 0.08, 0.068, [0.9, 0.85, 0.85], [0.2, 0, 0], P.lo ? [2, 3, 3] : [3, 5, 5]), P.cup, s * 0.106, 0.064, -0.006);
        put(g, BX(0.009, 0.046, 0.016), P.dark, s * 0.11, 0.12, -0.004, 0, 0, s * 0.12);
        if (!P.lo) { put(g, pillow(0.014, 0.07, 0.058, [0.8, 0.8, 0.8], 0, [2, 3, 3]), P.rubber, s * 0.09, 0.064, -0.006); put(g, CY(0.016, 0.016, 0.004, 12, 'x'), P.dark, s * 0.125, 0.064, -0.006); }
      }
      // 마이크 (오른쪽)
      put(g, cord([[-0.112, 0.05, 0.02], [-0.103, 0.022, 0.058], [-0.074, 0.002, 0.09], [-0.038, -0.008, 0.104]], 0.0032, 4, false, P.lo ? 6 : 12), P.dark);
      put(g, SPH(0.0085, 8, 6), P.rubber, -0.032, -0.009, 0.106);
      // 야간 투시경: 앞 거치판 + 팔 + 위로 젖힌 쌍안 본체 (껍데기 앞을 따라 눕힘)
      put(g, bendS(pillow(0.064, 0.042, 0.013, [0.25, 0.3, 0.5], 0, [4, 3, 1]), c, r, 0, 0.47, 0.002), P.dark);
      const nb = sp(c, r, 0, 0.75, 0.024), nv = new THREE.Group(); nv.position.set(nb[0], nb[1], nb[2]); nv.rotation.x = -Math.atan2(nb[4], nb[5]); g.add(nv);   // 로컬 y = 껍데기를 따라 위로, z = 바깥
      put(nv, BX(0.03, 0.05, 0.022), P.dark, 0, -0.045, -0.01);                   // 거치 팔
      put(nv, pillow(0.094, 0.03, 0.03, 0.35, 0, [3, 2, 2]), P.dark, 0, -0.004, -0.002);    // 가운데 다리
      for (const s of [1, -1]) {
        put(nv, CY(0.019, 0.018, 0.076, P.lo ? 8 : 14, 'y'), P.nvg, s * 0.033, 0.004, 0.004);
        put(nv, CY(0.0172, 0.0172, 0.003, P.lo ? 8 : 14, 'y'), P.lens, s * 0.033, 0.0435, 0.004);           // 대물렌즈
        if (!P.lo) { put(nv, CY(0.015, 0.018, 0.014, 12, 'y'), P.rubber, s * 0.033, -0.039, 0.004); put(nv, TOR(0.0185, 0.0025, 4, 14), P.dark, s * 0.033, 0.028, 0.004, Math.PI / 2, 0, 0); }
      }
      // 뒤 균형추 주머니
      put(g, bendS(pillow(0.1, 0.06, 0.034, [0.3, 0.4, 0.6], [0, 0, 0.15], P.lo ? [3, 2, 1] : [4, 3, 2]), c, r, Math.PI, 0.12, 0.002), P.sub);
      if (P.lo) { chin(g, P, [0.098, 0.12, 0.04], null, false); decoHelm(g, P, c, r, rim, [0, 0.172, 0.135]); return; }
      put(g, cord(rimPts(c, r, rim, 0.0, 48), 0.0045, 4, true), P.trim);
      put(g, bendS(pillow(0.1, 0.012, 0.006, 0.3, 0, [3, 1, 1]).translate(0, 0.024, 0.034), c, r, Math.PI, 0.12, 0.002), P.seam);
      // 찍찍이 판: 위·옆·뒤
      put(g, bendS(pillow(0.1, 0.07, 0.003, 0.2, 0, [4, 3, 1]), c, r, 0, 0.8, 0.001), P.velcro);
      for (const s of [1, -1]) put(g, bendS(pillow(0.05, 0.04, 0.003, 0.25, 0, [3, 2, 1]), c, r, s * 0.95, 0.62, 0.001), P.velcro);
      put(g, bendS(pillow(0.07, 0.04, 0.003, 0.25, 0, [3, 2, 1]), c, r, Math.PI, 0.5, 0.001), P.velcro);
      // 위 뒤 점멸등 + 왼쪽 레일 손전등
      { const q = sp(c, r, Math.PI, 0.78, 0.004); const o = put(g, pillow(0.026, 0.016, 0.022, 0.3, 0, [2, 2, 2]), P.dark, q[0], q[1], q[2]); orient(o, [q[3], q[4], q[5]]); put(g, SPH(0.008, 8, 5, 0, Math.PI / 2), M('metal', 0x9aa4a8), q[0] + q[3] * 0.01, q[1] + q[4] * 0.01, q[2] + q[5] * 0.01); }
      { const a = 1.3, q = sp(c, r, a, 0.37, 0.026), ry = Math.atan2(-Math.cos(a), Math.sin(a)); put(g, CY(0.013, 0.013, 0.048, 10, 'z'), P.dark, q[0], q[1], q[2], 0, ry, 0); put(g, CY(0.0145, 0.0145, 0.004, 10, 'z'), M('metal', 0xb8c0c4), q[0] - Math.cos(a) * 0.026, q[1], q[2] + Math.sin(a) * 0.026, 0, ry, 0); }
      chin(g, P, [0.098, 0.12, 0.04], [0.09, 0.08, -0.07], true);
      decoHelm(g, P, c, r, rim, [0, 0.172, 0.135]);
    },
  };

  // ---------- 조끼 (가슴 뼈 로컬) ----------
  // 어깨 위 몸 겉면 (x = ±0.108 단면, 재킷 두께까지 · [z, y]) — 앞 가슴 → 승모근 꼭대기(y≈0.274) → 등. 어깨끈은 이 면에서 법선 방향으로 띄운다
  const SHP = [[0.13, 0.13], [0.122, 0.16], [0.101, 0.2], [0.064, 0.24], [0.03, 0.262], [0, 0.274], [-0.03, 0.27], [-0.06, 0.257], [-0.085, 0.238], [-0.104, 0.205], [-0.112, 0.16], [-0.112, 0.13]];
  function overShoulder(x, off) {
    const out = [];
    for (let i = 1; i < SHP.length - 1; i++) { const a = SHP[i - 1], b = SHP[i + 1], tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1; out.push([x, SHP[i][1] - tz / l * off, SHP[i][0] + ty / l * off]); }
    return out;   // 앞 → 뒤
  }
  // 조끼 어깨끈: 앞판 위(zf, yf) → 어깨 위 → 등판 위(zb, yb). lift = 두꺼운 조끼일수록 몸에서 조금 더 띄움
  function shoulders(g, P, w, t, zf, zb, lift = 0, yf = 0.13, yb = 0.15) {
    for (const s of [1, -1]) {
      const x = s * 0.108, mid = overShoulder(x, t / 2 + 0.003 + lift).filter((p) => p[1] > yf + 0.025 && p[1] > yb + 0.025);
      put(g, ribbon([[x, yf, zf]].concat(mid, [[x, yb, zb]]), (p) => [0, p.y - 0.15, p.z + 0.004], w, t, P.lo ? 10 : 22), P.strap);
    }
  }
  // 3레벨 어깨 보호대: 위팔 뼈(shL·shR)에 붙어 팔과 함께 움직인다 — 팔 둘레로 휜 두 겹 패드 (가슴 뼈 바인드 자세 기준으로 만들고 위팔 뼈 로컬로 옮김)
  //  팔 축: 어깨 관절 (±0.191, 0.171, 0) → 팔꿈치 (±0.392, -0.045, 0)
  function armPad(g, P, s) {
    const J = [s * 0.191, 0.171, 0], d = new V3(s * 0.681, -0.732, 0), e3 = new V3(s * 0.732, 0.681, 0), e2 = new V3(0, 0, s);
    // 평평한 패드(x = 팔 둘레, y = 팔 아래로, z = 바깥 두께)를 반지름 R 원통에 감아 팔 축에 맞춤 (x→e2, y→d, z→e3 = 오른손 좌표 유지)
    const wrap = (geo, R, yc) => {
      const Pp = geo.attributes.position;
      for (let i = 0; i < Pp.count; i++) {
        const x = Pp.getX(i), y = Pp.getY(i) + yc, rr = R + Pp.getZ(i), f = x / R, a = rr * Math.sin(f), b = rr * Math.cos(f);
        Pp.setXYZ(i, J[0] + d.x * y + e2.x * a + e3.x * b, J[1] + d.y * y + e2.y * a + e3.y * b, J[2] + d.z * y + e2.z * a + e3.z * b);
      }
      Pp.needsUpdate = true; return smooth(geo);
    };
    put(g, wrap(pillow(0.18, 0.12, 0.024, [0.3, 0.3, 0.6], [0, 0, 0.06], P.lo ? [4, 3, 1] : [8, 5, 2]).translate(0, 0, 0.012), 0.068, 0.07), P.main);
    put(g, wrap(pillow(0.16, 0.07, 0.022, [0.3, 0.4, 0.6], [0, 0, 0.06], P.lo ? [4, 2, 1] : [8, 3, 2]).translate(0, 0, 0.011), 0.086, 0.0), P.main);
    if (!P.lo) { put(g, wrap(pillow(0.17, 0.01, 0.006, [0.2, 0.4, 0.5], 0, [8, 1, 1]), 0.0945, 0.118), P.trim); put(g, wrap(pillow(0.15, 0.01, 0.006, [0.2, 0.4, 0.5], 0, [8, 1, 1]), 0.1085, 0.026), P.trim); }
  }
  const VESTS = {
    // ===== 1: 얇은 소프트 조끼 — 몸에 붙는 앞·뒤판(팔 구멍·목 파임) · 옆은 고무 띠 둘로 연결 · 넓은 어깨끈 · 주머니 없음(매끈) =====
    1(g, P) {
      const off = 0.016, th = 0.022, F = off + th, cf = [0.4, 0.1, 0.2, 0.075], cb = [0.32, 0.1, 0.08, 0.075];
      panel(g, P.main, 0.42, 0.34, th, 0, off, -0.03, P.lo ? [6, 3, 1] : [14, 6, 2], undefined, undefined, cf);
      panel(g, P.main, 0.42, 0.35, th, Math.PI, off, -0.02, P.lo ? [6, 3, 1] : [14, 6, 2], undefined, undefined, cb);
      shoulders(g, P, 0.058, 0.012, 0.172, -0.152, 0, 0.12, 0.14);
      // 옆 고무 띠 (앞·뒤판 사이 틈을 건너감)
      for (const s of [1, -1]) for (const y of [-0.15, -0.05]) put(g, bendT(pillow(0.26, 0.042, 0.006, [0.05, 0.3, 0.5], 0, [P.lo ? 4 : 10, 1, 1]).translate(0, 0, 0.003), s * Math.PI / 2, off + 0.001, y), P.sub);
      if (P.lo) return;
      // 가장자리 바이어스(조금 크고 어두운 판이 테두리로 비침)
      panel(g, P.trim, 0.428, 0.348, th * 0.75, 0, off - 0.0005, -0.03, [10, 4, 1], undefined, undefined, cf);
      panel(g, P.trim, 0.428, 0.358, th * 0.75, Math.PI, off - 0.0005, -0.02, [10, 4, 1], undefined, undefined, cb);
      // 가슴 이름표 찍찍이 + 왼쪽 가슴 작은 펜 주머니
      put(g, bendT(pillow(0.13, 0.044, 0.004, 0.2, 0, [6, 2, 1]).translate(0, 0, 0.002), 0, F, 0.06), P.velcro);
      { const o = grpT(g, 0.5, F, 0.0); put(o, pillow(0.05, 0.075, 0.015, [0.3, 0.2, 0.5], [0, 0, 0.1], [3, 3, 2]), P.sub, 0, 0, 0.0075); put(o, BX(0.006, 0.03, 0.006), P.dark, 0.012, 0.05, 0.006); }
      // 어깨끈 앞 찍찍이 조절 탭
      for (const s of [1, -1]) put(g, pillow(0.062, 0.045, 0.006, 0.3, 0, [2, 2, 1]), P.velcro, s * 0.108, 0.17, 0.168, -0.45, 0, 0);
    },
    // ===== 2: 판형 조끼 — 두꺼운 앞·뒤판 · 옆 커머번드 · 앞 탄창 주머니 3(탄창이 보임) · 서류 주머니 · 왼쪽 무전기 + 어깨 위로 솟은 안테나 =====
    2(g, P) {
      const off = 0.018, th = 0.04, F = off + th, cf = [0.3, 0.1, 0.1, 0.07], cb = [0.24, 0.1, 0.0, 0.07];
      panel(g, P.main, 0.36, 0.34, th, 0, off, -0.02, P.lo ? [6, 3, 2] : [12, 6, 2], [0.15, 0.12, 0.5], [0, 0, 0.08], cf);
      panel(g, P.main, 0.36, 0.35, th, Math.PI, off, -0.01, P.lo ? [6, 3, 2] : [12, 6, 2], [0.15, 0.12, 0.5], [0, 0, 0.08], cb);
      for (const s of [1, -1]) panel(g, P.sub, 0.32, 0.15, 0.016, s * Math.PI / 2, off, -0.1, P.lo ? [4, 2, 1] : [10, 3, 1], [0.05, 0.2, 0.5], 0);
      shoulders(g, P, 0.06, 0.016, 0.19, -0.168, 0.002, 0.125, 0.15);
      // 앞 탄창 주머니 3 (위로 탄창이 보임)
      for (const k of [-1, 0, 1]) {
        const o = grpT(g, k * 0.37, F, -0.085, 0.04);
        put(o, pillow(0.074, 0.1, 0.036, [0.25, 0.2, 0.5], [0, 0, 0.12], P.lo ? [2, 2, 1] : [3, 3, 2]), P.sub, 0, 0, 0.018);
        put(o, BX(0.06, 0.03, 0.022), P.mag, 0, 0.062, 0.016);
        if (!P.lo) { put(o, cord([[-0.03, 0.054, 0.037], [0, 0.07, 0.04], [0.03, 0.054, 0.037]], 0.0025, 4), P.dark); put(o, pillow(0.022, 0.016, 0.006, 0.3, 0, [2, 2, 1]), P.dark, 0, 0.078, 0.032); put(o, BX(0.056, 0.004, 0.004), P.seam, 0, 0.02, 0.0375); }
      }
      // 서류 주머니 (가슴 위)
      { const o = grpT(g, 0, F, 0.075); put(o, pillow(0.15, 0.075, 0.026, [0.2, 0.25, 0.5], [0, 0, 0.1], P.lo ? [2, 2, 1] : [4, 3, 2]), P.sub, 0, 0, 0.013); if (!P.lo) { put(o, BX(0.13, 0.003, 0.004), P.dark, 0, 0.028, 0.026); put(o, pillow(0.07, 0.034, 0.004, 0.25, 0, [3, 2, 1]), P.velcro, 0, -0.006, 0.027); } }
      // 왼쪽 옆 무전기 + 긴 안테나 (어깨 위로 솟아 멀리서도 보임)
      { const o = grpT(g, 1.9, off + 0.016, -0.07); put(o, pillow(0.064, 0.13, 0.04, [0.25, 0.2, 0.5], [0, 0, 0.08], P.lo ? [2, 2, 1] : [3, 3, 2]), P.sub, 0, 0, 0.02); put(o, BX(0.042, 0.03, 0.026), P.dark, 0, 0.078, 0.02);
        put(o, cord([[0.008, 0.09, 0.02], [0.006, 0.2, 0.012], [-0.004, 0.33, -0.004], [-0.018, 0.46, -0.03]], 0.0034, 4, false, P.lo ? 4 : 12), P.dark); put(o, SPH(0.0055, 6, 4), P.dark, -0.018, 0.462, -0.03);
        if (!P.lo) put(o, CY(0.006, 0.006, 0.014, 8, 'y'), P.dark, -0.012, 0.1, 0.02); }
      // 등 끌기 손잡이
      put(g, TOR(0.026, 0.0065, 4, P.lo ? 6 : 10, Math.PI), P.strap, 0, 0.15, -0.176);
      if (P.lo) return;
      // 몰리: 앞 위(서류 주머니 옆)·앞 아래 · 커머번드 · 등
      molle(g, P, 0, F, 0.03, 0.3, 2, 0.032); molle(g, P, 0, F, -0.168, 0.3, 1);
      for (const s of [1, -1]) molle(g, P, s * Math.PI / 2, off + 0.016, -0.145, 0.2, 3);
      molle(g, P, Math.PI, F, -0.13, 0.32, 5, 0.04);
      // 판 가장자리 박음선
      panel(g, P.trim, 0.364, 0.344, th * 0.8, 0, off - 0.0005, -0.02, [8, 4, 1], undefined, undefined, cf);
      panel(g, P.trim, 0.364, 0.354, th * 0.8, Math.PI, off - 0.0005, -0.01, [8, 4, 1], undefined, undefined, cb);
    },
    // ===== 3: 중장 조끼 — 아주 두꺼운 판 · 목 칼라 · 어깨 보호대(팔에 붙음 · armPad) · 골반 보호대 · 옆 판 · 탄창 4 + 수류탄 2 + 의무 주머니 · 등 큰 주머니 =====
    3(g, P) {
      const off = 0.018, th = 0.052, F = off + th, cf = [0.24, 0.12, 0.08, 0.07], cb = [0.2, 0.12, 0.0, 0.07];
      panel(g, P.main, 0.4, 0.37, th, 0, off, -0.025, P.lo ? [6, 3, 2] : [12, 6, 2], [0.15, 0.12, 0.5], [0, 0, 0.08], cf);
      panel(g, P.main, 0.4, 0.38, th, Math.PI, off, -0.02, P.lo ? [6, 3, 2] : [12, 6, 2], [0.15, 0.12, 0.5], [0, 0, 0.08], cb);
      for (const s of [1, -1]) panel(g, P.sub, 0.3, 0.25, 0.028, s * Math.PI / 2, off, -0.075, P.lo ? [4, 2, 1] : [10, 4, 2], [0.08, 0.15, 0.5], [0, 0, 0.06]);
      shoulders(g, P, 0.07, 0.02, 0.2, -0.18, 0.004, 0.13, 0.155);
      // 목 칼라: 목 뒤·옆을 감싸고 앞은 열림, 위가 살짝 벌어짐
      { const pts = []; for (let k = 0; k <= 12; k++) { const a = lerp(0.95, TAU - 0.95, k / 12); pts.push([Math.sin(a) * 0.112, 0.238, -0.012 + Math.cos(a) * 0.104]); }
        put(g, ribbon(pts, (p) => { const x = p.x / (0.112 * 0.112), z = (p.z + 0.012) / (0.104 * 0.104), l = Math.hypot(x, z) || 1; return [x / l, -0.32, z / l]; }, 0.078, 0.03, P.lo ? 10 : 24), P.main);
        if (!P.lo) put(g, ribbon(pts.map((p) => [p[0] * 1.02, p[1] + 0.038, (p[2] + 0.012) * 1.02 - 0.012]), (p) => [p.x, 0.6, p.z + 0.012], 0.018, 0.024, 24), P.trim); }
      // 바닥 아이템: 어깨 보호대를 몸통 쪽에 같이 둠 (경기에서는 위팔 뼈에 따로 붙음)
      if (P.item) for (const s of [1, -1]) armPad(g, P, s);
      // 골반 보호대 (앞판 아래로 내려옴)
      panel(g, P.main, 0.17, 0.12, 0.024, 0, off + 0.012, -0.26, P.lo ? [4, 2, 1] : [8, 4, 2], [0.25, 0.3, 0.5], [0, 0, 0.06]);
      // 앞 탄창 주머니 4
      for (const k of [-1.5, -0.5, 0.5, 1.5]) {
        const o = grpT(g, k * 0.4, F, -0.1, 0.04);
        put(o, pillow(0.068, 0.1, 0.038, [0.25, 0.2, 0.5], [0, 0, 0.12], P.lo ? [2, 2, 1] : [3, 3, 2]), P.sub, 0, 0, 0.019);
        put(o, BX(0.054, 0.028, 0.022), P.mag, 0, 0.06, 0.017);
        if (!P.lo) { put(o, pillow(0.07, 0.03, 0.04, [0.3, 0.5, 0.5], 0, [2, 2, 2]), P.sub, 0, 0.045, 0.02); put(o, pillow(0.02, 0.015, 0.006, 0.3, 0, [2, 2, 1]), P.dark, 0, 0.04, 0.042); }
      }
      // 옆 수류탄 주머니 2 (덮개 달린 둥근 통)
      for (const s of [1, -1]) { const o = grpT(g, s * 0.98, F, -0.085); put(o, CY(0.027, 0.027, 0.07, P.lo ? 8 : 14, 'y'), P.sub, 0, 0, 0.027); put(o, CY(0.029, 0.029, 0.014, P.lo ? 8 : 14, 'y'), P.trim, 0, 0.04, 0.027); }
      // 가슴 의무 주머니 (초록 바탕 흰 십자)
      { const o = grpT(g, 0, F, 0.08); put(o, pillow(0.16, 0.085, 0.032, [0.2, 0.25, 0.5], [0, 0, 0.1], P.lo ? [2, 2, 1] : [4, 3, 2]), P.sub, 0, 0, 0.016);
        if (!P.lo) { put(o, pillow(0.036, 0.036, 0.004, 0.2, 0, [2, 2, 1]), M('cloth', 0x2d7a4b), 0, 0, 0.033); put(o, BX(0.022, 0.007, 0.002), M('cloth', 0xf2f0e6), 0, 0, 0.036); put(o, BX(0.007, 0.022, 0.002), M('cloth', 0xf2f0e6), 0, 0, 0.036); put(o, BX(0.14, 0.003, 0.004), P.dark, 0, 0.034, 0.032); } }
      // 등 큰 주머니 + 끌기 손잡이
      { const o = grpT(g, Math.PI, F, -0.085); put(o, pillow(0.22, 0.13, 0.05, [0.2, 0.25, 0.5], [0, 0, 0.12], P.lo ? [3, 2, 1] : [5, 3, 2]), P.sub, 0, 0, 0.025); if (!P.lo) put(o, BX(0.19, 0.003, 0.004), P.dark, 0, 0.05, 0.05); }
      put(g, TOR(0.028, 0.007, 4, P.lo ? 6 : 10, Math.PI), P.strap, 0, 0.15, -0.19);
      if (P.lo) return;
      molle(g, P, Math.PI, F, 0.0, 0.34, 4, 0.036);
      for (const s of [1, -1]) molle(g, P, s * Math.PI / 2, off + 0.028, -0.17, 0.2, 4, 0.036);
      molle(g, P, 0, F, -0.2, 0.34, 1);
      panel(g, P.trim, 0.404, 0.374, th * 0.8, 0, off - 0.0005, -0.025, [8, 4, 1], undefined, undefined, cf);
      panel(g, P.trim, 0.404, 0.384, th * 0.8, Math.PI, off - 0.0005, -0.02, [8, 4, 1], undefined, undefined, cb);
    },
  };
  // 위팔 뼈에 붙는 조끼 부품 (3레벨 어깨 보호대): side 'L'·'R' → 위팔 뼈 로컬 모델 (없으면 null)
  function vestArm(lvl, side, lo) {
    if (lvl !== 3) return null;
    return Models.cluster('gear:vestarm' + lvl + side + (lo ? '|lo' : ''), (g) => {
      const BPm = Body.bindPose().M, w = new THREE.Group(); w.matrixAutoUpdate = false;
      w.matrix.copy(BPm['sh' + side]).invert().multiply(BPm.chest); g.add(w);
      armPad(w, pal('vest', lvl, null, lo, false), side === 'L' ? 1 : -1);
    });
  }
  // 조끼 등 바깥 면 z (가방·등에 멘 총 자리)
  const VBACK = [-0.123, -0.163, -0.18, -0.245];   // 3레벨은 등 큰 주머니까지

  // ---------- 가방 (가슴 뼈 로컬, 등 뒤) ----------
  //  v = 함께 입은 조끼 레벨: 가방은 조끼 등판 위에, 어깨끈은 조끼 앞판 위로 지나가게 뒤·앞으로 민다
  const PZ = [-0.138, -0.166, -0.187, -0.2], PZS = [0.158, 0.188, 0.208, 0.218], PLIFT = [0, 0.012, 0.017, 0.022], PSO = [0.004, 0.02, 0.025, 0.03];
  // 가방 몸통 (pillow 와 같은 식) 의 등 쪽 면 z — 그 위에 붙이는 주머니·몰리용
  function rearZ(B, X, Y) {
    const yn = clamp((Y - B.cy) / (B.h / 2), -1, 1), k = Math.max(0, yn) * Math.max(0, yn), xn = clamp(X / (B.w / 2 * (1 - B.tx * k)), -1, 1);
    return B.cz - B.d / 2 * (1 + B.bz * (1 - xn * xn) * (1 - yn * yn)) * (1 - B.tz * k);
  }
  // 평평한 조각(로컬 +z = 바깥)을 등 쪽 면 (x0, y0) 자리에 붙인다 (y축으로 180° 돌려 붙임)
  function onRear(geo, B, x0, y0) {
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const X = x0 - P.getX(i), Y = y0 + P.getY(i); P.setXYZ(i, X, Y, rearZ(B, X, Y) - P.getZ(i)); }
    P.needsUpdate = true; return smooth(geo);
  }
  function body(g, P, B, seg) { put(g, pillow(B.w, B.h, B.d, B.r, [B.bx || 0, 0.02, B.bz], seg, [B.tx, B.tz]), P.main, 0, B.cy, B.cz); }
  // 어깨끈: 가방 위 → 어깨 위 → 가슴 앞(패드) → 겨드랑이 아래로 웨빙 → 가방 아래 옆
  function packStraps(g, P, B, v, w, t) {
    const z0 = PZ[v], zs = PZS[v], lf = PLIFT[v];
    if (P.item) { for (const s of [1, -1]) put(g, ribbon([[s * 0.085, B.top - 0.04, z0 + 0.004], [s * 0.1, B.top - 0.14, z0 + 0.012], [s * 0.12, B.cy - B.h / 2 + 0.03, z0 + 0.006]], () => [0, 0, 1], w, t, 8), P.strap); return; }   // 바닥: 등판에 붙은 짧은 끈만
    for (const s of [1, -1]) {
      // 가방 위 → (조끼 어깨끈 위로) 어깨 → 가슴 앞(조끼 앞판 위)
      const ya = B.top - 0.05, mid = overShoulder(s * 0.1, PSO[v] + t / 2).reverse().filter((p) => (p[2] < 0 ? p[1] > ya + 0.03 : p[1] > 0.19));
      put(g, ribbon([[s * 0.085, ya, z0 + 0.004]].concat(mid, [[s * 0.114, 0.15, Math.max(zs, mid[mid.length - 1][2])], [s * 0.118, 0.1, zs], [s * 0.12, 0.03, zs - 0.004]]), (p) => [0, p.y - 0.15, p.z], w, t, P.lo ? 10 : 22), P.strap);
      put(g, ribbon([[s * 0.12, 0.04, zs - 0.006], [s * 0.168, -0.05, 0.1], [s * 0.2, -0.12, -0.01], [s * 0.15, B.cy - B.h / 2 + 0.04, z0 + 0.004]], (p) => [p.x / 0.04, 0, (p.z - TZ) / 0.018], 0.024, 0.004, P.lo ? 6 : 14), P.web);
    }
    put(g, BX(0.205, 0.016, 0.005), P.web, 0, 0.11, zs + 0.004);   // 가슴끈
    if (!P.lo) put(g, pillow(0.034, 0.022, 0.012, 0.35, 0, [2, 2, 1]), P.dark, 0, 0.11, zs + 0.01);
  }
  // 가방 장식 (스킨)
  function decoPack(g, P, B) {
    const D = P.deco; if (!D) return;
    if (D === 'bow') {
      // 리본 십자 + 위 나비 리본
      put(g, onRear(pillow(0.045, B.h * 0.96, 0.006, [0.2, 0.05, 0.5], 0, [2, 8, 1]), B, 0, B.cy), P.ribbon);
      put(g, onRear(pillow(B.w * 0.96, 0.045, 0.006, [0.05, 0.2, 0.5], 0, [8, 2, 1]), B, 0, B.cy - 0.02), P.ribbon);
      put(g, BX(0.045, 0.007, B.d * 0.9), P.ribbon, 0, B.top - 0.004, B.cz);
      for (const s of [1, -1]) put(g, BX(0.007, 0.045, B.d * 0.9), P.ribbon, s * (B.w / 2 + 0.004), B.cy - 0.02, B.cz);
      const bz = B.cz - B.d * 0.2, by = B.top + 0.015;
      for (const s of [1, -1]) put(g, TOR(0.032, 0.011, 6, P.lo ? 8 : 14), P.ribbon, s * 0.034, by + 0.014, bz, 0, 0, s * 0.5);
      put(g, SPH(0.016, 10, 8), P.ribbon, 0, by + 0.006, bz);
      if (!P.lo) for (const s of [1, -1]) put(g, BX(0.02, 0.06, 0.005), P.ribbon, s * 0.022, by - 0.02, bz - 0.03, 0.4, 0, s * 0.35);
    } else if (D === 'santa') {
      // 위 둘레 흰 털 + 가운데 검은 벨트와 금 버클
      const L = []; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, cs = Math.cos(a), sn = Math.sin(a); L.push([spow(sn, 0.6) * (B.w / 2 * (1 - B.tx * 0.64) + 0.006), B.top - 0.05, B.cz + spow(cs, 0.6) * (B.d / 2 * (1 - B.tz * 0.64) + 0.006)]); }
      put(g, cord(L, 0.02, P.lo ? 5 : 8, true, P.lo ? 16 : 40), FUR);
      put(g, onRear(pillow(B.w * 0.98, 0.04, 0.008, [0.04, 0.2, 0.5], 0, [8, 2, 1]), B, 0, B.cy - 0.02), M('cloth', 0x141414));
      for (const s of [1, -1]) put(g, BX(0.008, 0.04, B.d * 0.92), M('cloth', 0x141414), s * (B.w / 2 + 0.004), B.cy - 0.02, B.cz);
      put(g, onRear(pillow(0.06, 0.05, 0.01, 0.2, 0, [2, 2, 1]), B, 0, B.cy - 0.02), M('brass', 0xf2c84a));
      if (!P.lo) put(g, onRear(pillow(0.036, 0.028, 0.014, 0.2, 0, [2, 2, 1]), B, 0, B.cy - 0.02), M('cloth', 0x141414));
    } else if (D === 'lights') {
      // 등 쪽 면에 두 줄로 늘어진 전구 줄
      const cols = [0xff3a3a, 0xffc93a, 0x3aff7a, 0x3aa8ff, 0xfff2d8, 0xff5ad8];
      for (const [y0, sag] of [[B.cy + B.h * 0.28, 0.06], [B.cy - B.h * 0.05, 0.05]]) {
        const pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10, x = lerp(-B.w * 0.46, B.w * 0.46, u), y = y0 - sag * 4 * u * (1 - u); pts.push([x, y, rearZ(B, x, y) - 0.008]); }
        if (!P.lo) put(g, cord(pts, 0.0016, 3), M('rubber', 0x101410));
        for (let k = 1; k < 10; k++) { const p = pts[k]; put(g, SPH(0.0085, 6, 5), { glow: cols[(k + (y0 > B.cy ? 0 : 3)) % cols.length] }, p[0], p[1] - 0.008, p[2] - 0.002); }
      }
    } else if (D === 'frost') {
      // 위 가장자리에 매달린 고드름 + 등 쪽 면에 빛나는 얼음 결정
      const ice = M('metal', 0xbfe9ff);
      for (let k = 0; k < (P.lo ? 5 : 9); k++) { const u = (k + 0.5) / (P.lo ? 5 : 9), x = lerp(-B.w * 0.44, B.w * 0.44, u), L = 0.03 + 0.03 * Math.abs(Math.sin(k * 2.3)); put(g, new THREE.ConeGeometry(0.008, L, 6), ice, x, B.top - 0.06 - L / 2, rearZ(B, x, B.top - 0.06) - 0.004, Math.PI, 0, 0); }
      for (const [x, y, s] of [[-0.06, B.cy + 0.06, 1], [0.07, B.cy - 0.04, 0.8], [-0.02, B.cy - 0.12, 0.65]]) for (let k = 0; k < 3; k++) put(g, BX(0.06 * s, 0.006, 0.004), { glow: 0x9fe8ff }, x, y, rearZ(B, x, y) - 0.012, 0, 0, k * Math.PI / 3);
    }
  }
  const PACKS = {
    // ===== 1: 작은 데이팩 — 등에 딱 붙는 둥근 가방 · 아래 앞주머니 · 위 손잡이 · 가슴끈 (어깨선 아래로 작게) =====
    1(g, P, v) {
      const B = { w: 0.27, h: 0.34, d: 0.11, cy: 0.0, cz: PZ[v] - 0.055, bz: 0.14, bx: 0.04, tx: 0.2, tz: 0.25, r: [0.32, 0.4, 0.45] }; B.top = B.cy + B.h / 2;
      body(g, P, B, P.lo ? [4, 4, 2] : [8, 8, 5]);
      put(g, onRear(pillow(0.21, 0.15, 0.04, [0.35, 0.4, 0.6], [0.02, 0, 0.18], P.lo ? [3, 3, 1] : [6, 4, 2]).translate(0, 0, 0.014), B, 0, -0.075), P.sub);
      put(g, TOR(0.024, 0.0055, 4, P.lo ? 6 : 10, Math.PI), P.web, 0, B.top - 0.026, B.cz);
      packStraps(g, P, B, v, 0.05, 0.013);
      if (!P.lo) {
        // 지퍼 손잡이 둘 · 앞주머니 지퍼 줄 · 옆 압축끈 + 버클
        put(g, onRear(BX(0.19, 0.004, 0.004).translate(0, 0, 0.05), B, 0, -0.004), P.dark);
        for (const s of [1, -1]) { const x = s * 0.07, y = B.top - 0.06; put(g, BX(0.008, 0.03, 0.005), P.dark, x, y, rearZ(B, x, y) - 0.006, 0, 0, s * 0.3); }
        for (const s of [1, -1]) for (const y of [-0.06, 0.06]) { put(g, BX(0.004, 0.018, B.d * 0.86), P.web, s * (B.w / 2 * 1.04 + 0.002), y, B.cz); put(g, pillow(0.006, 0.024, 0.026, 0.3, 0, [1, 2, 2]), P.dark, s * (B.w / 2 * 1.04 + 0.004), y, B.cz - B.d * 0.3); }
      }
      decoPack(g, P, B);
    },
    // ===== 2: 몰리 돌격 배낭 — 더 크고 각진 몸통 · 등 쪽 몰리 · 아래 서류 주머니 · 양옆 물병 주머니(옆으로 튀어나옴) · 위 덮개와 끈 =====
    2(g, P, v) {
      const B = { w: 0.31, h: 0.44, d: 0.15, cy: -0.02, cz: PZ[v] - 0.075, bz: 0.08, bx: 0.05, tx: 0.1, tz: 0.12, r: [0.22, 0.2, 0.35] }; B.top = B.cy + B.h / 2;
      body(g, P, B, P.lo ? [4, 4, 2] : [8, 8, 5]);
      put(g, onRear(pillow(0.21, 0.15, 0.05, [0.25, 0.3, 0.6], [0, 0, 0.14], P.lo ? [3, 3, 1] : [6, 4, 2]).translate(0, 0, 0.018), B, 0, -0.14), P.sub);
      // 위 덮개
      put(g, pillow(0.3, 0.055, 0.165, [0.3, 0.5, 0.3], [0, 0.15, 0], P.lo ? [3, 2, 2] : [6, 2, 4]), P.sub, 0, B.top - 0.005, B.cz);
      for (const s of [1, -1]) put(g, onRear(BX(0.024, 0.13, 0.004).translate(0, 0, 0.003), B, s * 0.075, B.top - 0.075), P.web);
      // 양옆 물병 주머니
      for (const s of [1, -1]) { put(g, pillow(0.075, 0.15, 0.105, [0.35, 0.3, 0.4], [0.1, 0, 0.05], P.lo ? [2, 2, 2] : [3, 4, 3]), P.sub, s * (B.w / 2 * 1.05 + 0.03), -0.12, B.cz); if (!P.lo) put(g, CY(0.019, 0.019, 0.022, 10, 'y'), P.dark, s * (B.w / 2 * 1.05 + 0.03), -0.034, B.cz); }
      put(g, TOR(0.026, 0.006, 4, P.lo ? 6 : 10, Math.PI), P.web, 0, B.top + 0.02, B.cz + B.d * 0.25);
      packStraps(g, P, B, v, 0.058, 0.015);
      if (!P.lo) {
        for (let k = 0; k < 4; k++) { const y = 0.0 + k * 0.038; put(g, onRear(pillow(0.25, 0.022, 0.004, [0.04, 0.3, 0.5], 0, [8, 1, 1]).translate(0, 0, 0.002), B, 0, y), P.web); for (let x = -0.11; x <= 0.115; x += 0.038) put(g, onRear(BX(0.0035, 0.023, 0.002).translate(0, 0, 0.0045), B, x, y), P.seam); }
        put(g, onRear(BX(0.19, 0.004, 0.004).translate(0, 0, 0.052), B, 0, -0.07), P.dark);
        for (const s of [1, -1]) { put(g, onRear(pillow(0.032, 0.022, 0.012, 0.3, 0, [2, 2, 1]).translate(0, 0, 0.006), B, s * 0.075, B.top - 0.14), P.dark); put(g, BX(0.004, 0.02, 0.06), P.web, s * (B.w / 2 * 1.05 + 0.068), -0.1, B.cz); }
        // 허리끈 끝 (늘어진 웨빙)
        for (const s of [1, -1]) put(g, ribbon([[s * 0.15, B.cy - B.h / 2 + 0.03, PZ[v] - 0.005], [s * 0.2, -0.235, -0.07], [s * 0.2, -0.27, 0.02]], (p) => [p.x, 0, 0.3], 0.024, 0.004, 10), P.web);
        put(g, CY(0.008, 0.008, 0.02, 8, 'y'), P.dark, 0.06, B.top - 0.01, B.cz - B.d * 0.25);   // 물 호스 구멍
      }
      decoPack(g, P, B);
    },
    // ===== 3: 대형 배낭 — 키가 커서 어깨 위로 솟음(앞에서도 보임) · 위 덮개 · 아래 침낭 말이 · 양옆 큰 주머니 + 물병 · 허리 벨트 =====
    3(g, P, v) {
      const B = { w: 0.34, h: 0.5, d: 0.19, cy: 0.03, cz: PZ[v] - 0.095, bz: 0.1, bx: 0.05, tx: 0.06, tz: 0.1, r: [0.2, 0.18, 0.3] }; B.top = B.cy + B.h / 2;
      body(g, P, B, P.lo ? [4, 4, 2] : [8, 8, 5]);
      // 위 덮개 (어깨 위로)
      put(g, pillow(0.36, 0.088, 0.225, [0.3, 0.45, 0.3], [0.02, 0.18, 0.02], P.lo ? [3, 2, 2] : [6, 3, 4]), P.sub, 0, B.top + 0.06, B.cz - 0.012);
      for (const s of [1, -1]) put(g, onRear(BX(0.026, 0.2, 0.005).translate(0, 0, 0.003), B, s * 0.085, B.top - 0.1), P.web);
      // 아래 침낭 말이
      put(g, CY(0.068, 0.068, 0.46, P.lo ? 8 : 16, 'x'), P.roll, 0, B.cy - B.h / 2 - 0.05, B.cz - 0.01);
      // 양옆 큰 주머니
      for (const s of [1, -1]) put(g, pillow(0.085, 0.24, 0.14, [0.35, 0.25, 0.4], [0.12, 0, 0.05], P.lo ? [2, 3, 2] : [3, 5, 3]), P.sub, s * (B.w / 2 * 1.05 + 0.035), -0.04, B.cz);
      // 등 쪽 아래 큰 주머니
      put(g, onRear(pillow(0.26, 0.18, 0.055, [0.25, 0.3, 0.6], [0, 0, 0.14], P.lo ? [3, 3, 1] : [6, 4, 2]).translate(0, 0, 0.02), B, 0, -0.1), P.sub);
      // 허리 벨트 날개
      for (const s of [1, -1]) put(g, pillow(0.17, 0.085, 0.034, [0.3, 0.4, 0.5], [0, 0, 0.1], P.lo ? [3, 2, 1] : [5, 3, 2]), P.strap, s * 0.2, -0.215, -0.07, 0, s > 0 ? 1.86 : -1.86, 0);
      put(g, TOR(0.028, 0.007, 4, P.lo ? 6 : 10, Math.PI), P.web, 0, B.top + 0.1, B.cz);
      packStraps(g, P, B, v, 0.064, 0.02);
      if (!P.lo) {
        // 덮개 아래 조임 자락 · 덮개 지퍼 · 끈 버클 · 침낭 끈 · 물병 · 등 몰리 · 짐 당김끈
        put(g, pillow(0.3, 0.05, 0.17, [0.3, 0.5, 0.3], 0, [6, 2, 4]), P.sub, 0, B.top + 0.012, B.cz);
        put(g, BX(0.28, 0.004, 0.004), P.dark, 0, B.top + 0.06, B.cz - 0.012 - 0.114);
        for (const s of [1, -1]) { put(g, onRear(pillow(0.034, 0.024, 0.012, 0.3, 0, [2, 2, 1]).translate(0, 0, 0.007), B, s * 0.085, B.top - 0.19), P.dark); put(g, CY(0.07, 0.07, 0.022, 16, 'x'), P.web, s * 0.14, B.cy - B.h / 2 - 0.05, B.cz - 0.01); }
        for (const s of [1, -1]) { const x = s * (B.w / 2 * 1.05 + 0.035); put(g, CY(0.034, 0.034, 0.12, 12, 'y'), M('polymer', 0x3c4a3a), x, 0.11, B.cz + 0.01); put(g, CY(0.02, 0.02, 0.02, 10, 'y'), P.dark, x, 0.18, B.cz + 0.01); for (const y of [-0.1, 0.0]) put(g, BX(0.004, 0.02, 0.12), P.web, x + s * 0.044, y, B.cz); }
        for (let k = 0; k < 3; k++) { const y = 0.03 + k * 0.04; put(g, onRear(pillow(0.26, 0.022, 0.004, [0.04, 0.3, 0.5], 0, [8, 1, 1]).translate(0, 0, 0.002), B, 0, y), P.web); for (let x = -0.114; x <= 0.115; x += 0.038) put(g, onRear(BX(0.0035, 0.023, 0.002).translate(0, 0, 0.0045), B, x, y), P.seam); }
        put(g, onRear(BX(0.23, 0.004, 0.004).translate(0, 0, 0.058), B, 0, -0.03), P.dark);
        if (!P.item) for (const s of [1, -1]) put(g, ribbon([[s * 0.1, 0.262 + PLIFT[v], -0.07], [s * 0.11, 0.27, PZ[v] - 0.02], [s * 0.12, B.top - 0.04, PZ[v] - 0.03]], () => [0, 1, 0], 0.02, 0.004, 8), P.web);
      }
      decoPack(g, P, B);
    },
  };
  // 가방 등 쪽 바깥 끝 z (등에 멘 총 자리) — 가장 튀어나온 주머니까지
  const PDEPTH = { 1: 0.11 * 1.07 + 0.055, 2: 0.15 * 1.04 + 0.07, 3: 0.19 * 1.05 + 0.075 };
  const packBack = (lvl, v = 0) => PZ[v] - (PDEPTH[lvl] || 0.17);

  // ---------- 색 · 재질 (레벨 기본 + 스킨) ----------
  const DEF = {
    helmet: {
      1: { main: 0x9a8664, sub: 0x7d6c50, dark: 0x24221f, strap: 0x3b3731, trim: 0x2a2826, kind: 'polymer' },
      2: { main: 0x5d6146, sub: 0x4b4f38, dark: 0x1e1f1c, strap: 0x34372a, trim: 0x44472f, kind: 'cloth' },
      3: { main: 0x3b3f42, sub: 0x2e3235, dark: 0x18191b, strap: 0x2a2c2e, trim: 0x1e2022, kind: 'polymer' },
    },
    vest: {
      1: { main: 0x2b3038, sub: 0x353b44, dark: 0x15171a, strap: 0x23272e, trim: 0x181b20, kind: 'cloth' },
      2: { main: 0x5c5f45, sub: 0x51543d, dark: 0x1c1c1a, strap: 0x45473a, trim: 0x404230, kind: 'cloth' },
      3: { main: 0x34383a, sub: 0x2c3032, dark: 0x161718, strap: 0x262a2c, trim: 0x1f2224, kind: 'cloth' },
    },
    pack: {
      1: { main: 0x3a4048, sub: 0x30353c, dark: 0x15171a, strap: 0x25292e, trim: 0x2a2f35, kind: 'cloth' },
      2: { main: 0x585a43, sub: 0x4e5039, dark: 0x161616, strap: 0x41432f, trim: 0x3e402e, kind: 'cloth' },
      3: { main: 0x7a6a4f, sub: 0x6e5f46, dark: 0x2a2d2a, strap: 0x5c4f3a, trim: 0x54493a, kind: 'cloth', roll: 0x4a5040 },
    },
  };
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };
  // 이 부위의 스킨 (없거나 슬롯이 다르면 null)
  const skinOf = (kind, id) => { const S = id && Body.SKINS[id]; return S && S.slot === (kind === 'pack' ? 'pack' : 'helmet') ? S : null; };
  function pal(kind, lvl, S, lo, item) {
    const b = DEF[kind][lvl] || DEF[kind][1], has = (k) => S && S[k] !== undefined;
    const mainHex = has('color') ? S.color : b.main, kd = (S && S.kind) || b.kind;
    const main = S && S.cell ? { cell: S.cell, color: has('color') ? S.color : 0xffffff } : M(kd, mainHex);
    // 주머니·덮개: 따로 정하지 않으면 본 무늬를 조금 어둡게 (색을 물들이는 무늬 — 니트·데님 — 는 그 색을 어둡게)
    const sub = S && S.cell2 ? { cell: S.cell2, color: has('color2') ? S.color2 : 0xffffff } : has('color2') ? M(S.kind2 || 'cloth', S.color2) : S && S.cell ? { cell: S.cell, color: has('color') ? shade(S.color, 0.8) : 0xd2d2d2 } : S ? M('cloth', shade(mainHex, 0.78)) : M('cloth', b.sub);
    const strapHex = has('strap') ? S.strap : b.strap, darkHex = has('dark') ? S.dark : b.dark;
    return {
      lo: !!lo, item: !!item, deco: S && S.deco || null,
      main, sub, strap: M('cloth', strapHex), web: M('cloth', shade(strapHex, 0.92)), dark: M(S && S.darkKind || 'polymer', darkHex),
      trim: M(S && S.trimKind || (kind === 'helmet' ? 'rubber' : 'cloth'), has('trim') ? S.trim : (S && !S.cell ? shade(mainHex, 0.7) : b.trim)),
      seam: M('cloth', S && S.cell ? 0x1d1d1a : shade(mainHex, 0.6)), hole: M('polymer', 0x0b0b0a),
      pad: M('cloth', shade(strapHex, 0.85)), velcro: S && S.cell ? sub : M('cloth', shade(mainHex, 0.82)),
      rubber: M('rubber', has('rubber') ? S.rubber : 0x1c1d1c), cup: M('polymer', has('cup') ? S.cup : (S ? darkHex : 0x26282a)), nvg: M('polymer', has('nvg') ? S.nvg : 0x1d1f1e),
      lens: M('metal', has('lens') ? S.lens : 0x2a3a42), mag: M('polymer', 0x1a1b1c), reflect: M('metal', 0xc8ccc8),
      roll: M('cloth', has('roll') ? S.roll : (b.roll || 0x4a5040)), ribbon: M(S && S.ribbonKind || 'brass', has('ribbon') ? S.ribbon : 0xe8c45a),
      tail: S && S.cell ? main : M('cloth', mainHex), pom: has('pom') ? S.pom : null, antler: M('cloth', has('antler') ? S.antler : 0x8a5e38),
    };
  }
  // 모델 (같은 열쇠는 한 번만 만들고 지오메트리 공유) — skin: 04_skins.js 의 헬멧·가방 스킨 id · lo: 멀리용 간략 · v: (가방) 함께 입은 조끼 레벨
  function make(tbl, kind, lvl, skin, lo, v, item) {
    if (!tbl[lvl]) return null;
    const S = kind === 'vest' ? null : skinOf(kind, skin);
    const key = 'gear:' + kind + lvl + '|' + (S ? skin : '') + (lo ? '|lo' : '') + (kind === 'pack' ? '|v' + (v || 0) : '') + (item ? '|it' : '');
    return Models.cluster(key, (g) => tbl[lvl](g, pal(kind, lvl, S, lo, item), v || 0));
  }
  // 바닥 아이템·아이콘용 (기본 모양, 끈 뺌)
  function item(kind, lvl, g) { const tbl = kind === 'helmet' ? HELMETS : kind === 'vest' ? VESTS : PACKS, P = pal(kind, lvl, null, false, true); if (tbl[lvl]) tbl[lvl](g, P, 0); }
  // ---------- 사각 낙하산 (램에어) ----------
  // 9칸 날개를 아치 모양으로 배치 + 칸마다 색 교대 + 앞쪽 공기 흡입구 + 줄(어깨 고리로 모임)
  function canopy(skinId) {
    const sk = (Body.SKINS[skinId] && Body.SKINS[skinId].colors) ? Body.SKINS[skinId] : Body.SKINS.chute_basic;
    const g = Models.cluster('chute:' + (Body.SKINS[skinId] ? skinId : 'chute_basic'), (G) => {
      const N = 9, R = 4.6, span = 1.5, H = 4.6, chord = 2.7, th = 0.36;
      // 칸 색: colors를 차례로 반복(2색 줄무늬 · 무지개 등). metal이면 광택 금속 천
      const kind = sk.metal ? 'brass' : 'cloth', cols = sk.colors.map((c) => M(kind, c)), dk = M('cloth', sk.edge !== undefined ? sk.edge : 0x1a1a18);
      const cellM = (i) => cols[(sk.mirror ? Math.min(i, N - 1 - i) : i) % cols.length];
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N - 0.5, a = t * span, x = Math.sin(a) * R, y = H + Math.cos(a) * R - R, w = 2 * R * Math.sin(span / N / 2) * 1.02;
        A(G, RB(w, th, chord, 0.15), cellM(i), x, y, 0.35, 0, 0, -a);
        A(G, RB(w * 0.82, th * 0.55, 0.05, 0.03), dk, x, y - 0.02, 0.35 + chord / 2 - 0.01, 0, 0, -a);
      }
      // 꼬리 쪽 얇은 날
      for (let i = 0; i < N; i++) { const t = (i + 0.5) / N - 0.5, a = t * span, x = Math.sin(a) * R, y = H + Math.cos(a) * R - R; A(G, BX(2 * R * Math.sin(span / N / 2), 0.03, 0.4), cellM(i), x, y - 0.05, 0.35 - chord / 2 - 0.15, 0, 0, -a); }
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
  return {
    helmet: (l, skin, lo) => make(HELMETS, 'helmet', l, skin, lo),
    vest: (l, lo) => make(VESTS, 'vest', l, null, lo), vestArm,
    // 상점·창고 썸네일: 끈을 뺀 모양 (slot 'helmet'·'pack')
    thumb: (slot, l, skin) => (slot === 'pack' ? make(PACKS, 'pack', l, skin, false, 0, true) : make(HELMETS, 'helmet', l, skin, false, 0, true)),
    pack: (l, skin, lo, v) => make(PACKS, 'pack', l, skin, lo, v),
    item, packBack, vestBack: (v) => VBACK[v] || -0.123, canopy, shell, skinOf,
    build: { helmet: HELMETS, vest: VESTS, pack: PACKS },
  };
})();
