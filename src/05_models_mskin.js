// ============================================================
// 05_models_mskin.js — v23 근접 무기 스킨: 색이 아니라 모양이 바뀐다 (식칼·마체테·프라이팬·쇠지렛대)
//  · 스킨 표는 04_skins.js (Body.SKINS — slot 'm_knife'·'m_machete'·'m_pan'·'m_crowbar', shape = 아래 MSHAPE 의 열쇠)
//  · 모양 생성기는 무기마다 05_models_mskin_<무기>.js 가 MSHAPE 에 등록한다
//    좌표 = 손 좌표계 그대로(05_models.js 기본 모델과 같음): 손잡이 가운데 = 원점, 날·머리는 +z, 때리는 쪽(날·팬 바닥·도끼날)은 -y, 두께는 x
//  · 캐릭터가 낀 스킨 = c.look['m_' + 무기] (창고에서 장착 → SETTINGS.look → 파티원·봇도 같은 길)
//  · 바닥에 떨어진 무기·시체 상자 속 무기는 기본 모양 (스킨은 그 사람의 꾸밈) · 맞히는 거리(ITEMS.reach)는 모양과 상관없음
// ============================================================
const MSHAPE = {};   // 모양 id → { melee: 무기 id, tip: 휘두르기 자국 끝(손잡이 가운데부터 m), build(g, K, S) }
const MeleeSkin = (() => {
  const MELEES_ = ['knife', 'machete', 'pan', 'crowbar'];
  const slotOf = (meleeId) => 'm_' + meleeId;
  // 이 무기의 스킨이면 스킨 표 항목, 아니면 null
  function skinOf(meleeId, skinId) {
    const S = skinId && Body.SKINS[skinId], D = S && MSHAPE[S.shape];
    return S && S.slot === slotOf(meleeId) && D && D.melee === meleeId ? S : null;
  }
  const ofLook = (look, meleeId) => { const id = look && meleeId ? look[slotOf(meleeId)] : null; return skinOf(meleeId, id) ? id : null; };
  const ofChar = (c, meleeId) => (c ? ofLook(c.look, meleeId) : null);

  // ---------- 모양 생성기가 쓰는 도구 (K) ----------
  //  Models.kit(A, BX, CY, RB, PF, SPH, TOR, PL, M, tube …) + put({glow}) · lathe · slab · rod · glow · shade
  let GLOW = null;
  const glowMat = () => { if (!GLOW) { GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); GLOW.userData.clsKey = 'mskin:glow'; } return GLOW; };
  function tint(geo, color) {
    const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  }
  // 메시 추가: m = M(kind, color) 또는 glow(색) — 스스로 빛나는 부분(네온 날·얼음 결정)
  function put(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    if (m && m.glow !== undefined) { tint(geo, m.glow); return Models.kit.A(g, geo, glowMat(), x, y, z, rx, ry, rz); }
    return Models.kit.A(g, geo, m, x, y, z, rx, ry, rz);
  }
  const glow = (hex) => ({ glow: hex });
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };
  // 회전체: pts = [[반지름, 높이], …] (아래 → 위) — axis 'y'(기본) · 'z'(앞으로 눕힘) · 'x'
  function lathe(pts, seg = 24, axis = 'y') {
    const geo = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(0, r), h)), seg);
    if (axis === 'z') geo.rotateX(Math.PI / 2); else if (axis === 'x') geo.rotateZ(-Math.PI / 2);
    return geo;
  }
  // 납작한 판(팬 머리·도끼날 옆모습이 아닌 '위에서 본' 모양): pts = [[x, z], …] 윤곽 → 두께 th 는 y 방향(가운데 0)
  //  holes = [[[x, z], …], …] 구멍 윤곽들
  function slab(pts, th, bev = 0.0012, holes = null, curveSegs = 4) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    if (holes) for (const hp of holes) { const p = new THREE.Path(); p.moveTo(hp[0][0], hp[0][1]); for (let i = 1; i < hp.length; i++) p.lineTo(hp[i][0], hp[i][1]); p.closePath(); s.holes.push(p); }
    const d = Math.max(0.0005, th - 2 * bev);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: curveSegs });
    geo.rotateX(Math.PI / 2); geo.translate(0, d / 2, 0);   // 도형 (x, y) → (x, z) 평면, 압출은 -y 로 → 가운데로
    return geo;
  }
  // 원 둘레 점 (slab 구멍·고리용): 가운데 (cx, cz), 반지름 r
  const circlePts = (cx, cz, r, n = 18) => { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; };
  // 두 점 사이 원통(막대·자루): 반지름 r0 → r1
  const _ra = new THREE.Vector3(0, 1, 0), _rb = new THREE.Vector3();
  function rod(g, m, p0, p1, r0, r1 = r0, seg = 8) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], L = Math.hypot(dx, dy, dz) || 1e-4;
    const o = put(g, new THREE.CylinderGeometry(r1, r0, L, seg), m, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
    o.quaternion.setFromUnitVectors(_ra, _rb.set(dx / L, dy / L, dz / L)); return o;
  }
  // 곡선을 따라 가는 관 (휜 손잡이·고리·사탕 지팡이 줄무늬)
  function tubeAlong(pts, r, seg = 0, rad = 8, closed = false) {
    const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed);
    return new THREE.TubeGeometry(cv, seg || Math.max(8, pts.length * 4), r, rad, closed);
  }
  const KIT = Object.assign({}, Models.kit, { put, glow, shade, lathe, slab, circlePts, rod, tubeAlong, tint });

  // ---------- 모델 ----------
  // v23 관절 모델(나비 나이프·카람빗 전용 동작 — 09_player_mskin.js): 모양에 parts 가 있으면 부품마다 따로 합쳐 그룹으로 잇는다
  //  parts = { 이름: { at: [x, y, z](부모 기준 자리 = 회전 축), parent: 부모 부품 이름(없으면 뿌리), build(g, K, S) } } — 부모가 먼저 오게 적는다
  //  root.userData.rig = { kind: 모양의 rig, 이름: 그룹 … } · 아무것도 돌리지 않으면 펼친(기본) 모양 그대로
  function rigModel(skinId, S, D) {
    const root = new THREE.Group(), rig = { kind: D.rig };
    for (const name in D.parts) {
      const P = D.parts[name], grp = new THREE.Group();
      if (P.at) grp.position.fromArray(P.at);
      (P.parent ? rig[P.parent] : root).add(grp);
      grp.add(Models.cluster('mskin:' + skinId + ':' + name, (g) => P.build(g, KIT, S)));
      rig[name] = grp;
    }
    root.userData.rig = rig; return root;
  }
  // 이 무기 + 스킨의 손에 드는 모델 (스킨이 없거나 다른 무기 것이면 기본 모델) — 같은 스킨은 지오메트리를 한 번만 만들어 공유
  const BAD = new Set();   // 만들다 실패한 스킨 → 기본 모델로 (한 번만 경고)
  function model(meleeId, skinId) {
    const S = skinOf(meleeId, skinId);
    if (!S || BAD.has(skinId)) return Models.display(meleeId);
    const D = MSHAPE[S.shape];
    try { return D.parts ? rigModel(skinId, S, D) : Models.cluster('mskin:' + skinId, (g) => D.build(g, KIT, S)); }
    catch (e) { BAD.add(skinId); console.warn('근접 무기 스킨 모양 실패', skinId, e); return Models.display(meleeId); }
  }
  // 경기 시작(로딩 화면) 때 이번 경기에 나오는 스킨 모양을 미리 만들고, 내 무기 칸 그림도 미리 그려 둠
  //  — 경기 중에는 그림을 그 자리에서 그리지 않는다(화면 멈춤). 10_hud.js 는 미리 그린 것만 씀(Shop.meleeThumbCached)
  function warm(chars, me) {
    for (const c of chars || []) for (const m of MELEES_) { const s = ofChar(c, m); if (s) model(m, s); }
    if (me && typeof Shop !== 'undefined') for (const m of MELEES_) { const s = ofChar(me, m); if (s) try { Shop.meleeThumb(m, s); } catch (e) { console.warn(e); } }
  }
  // 휘두르기 자국 끝 거리 (모양마다 날 길이가 조금씩 다름)
  const tip = (meleeId, skinId) => { const S = skinOf(meleeId, skinId); return (S && MSHAPE[S.shape].tip) || MEL_TIP[meleeId] || 0.3; };
  // 휘두르기 자국 색: 빛나는 날(네온·얼음)은 그 빛 색, 나머지는 null(흰빛) — 모양 생성기에 trail 이 있으면 그것
  const TRAIL = { neon: 0x46f2ff, frost: 0x9fe8ff, icicle: 0x9fe8ff };
  const trail = (meleeId, skinId) => { const S = skinOf(meleeId, skinId); if (!S) return null; const D = MSHAPE[S.shape]; return D.trail !== undefined ? D.trail : (TRAIL[S.shape] !== undefined ? TRAIL[S.shape] : null); };
  return { model, tip, trail, warm, ofChar, ofLook, skinOf, slotOf, KIT, MELEES: MELEES_ };
})();
