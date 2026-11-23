// ============================================================
// 10_victory.js — v23 우승 축하: 마지막 적을 처치해도 바로 결산하지 않는다
//  화면 위 승리 창에서 (PC 단축키)
//   · 동상 세우기 (B): 내 모습(입은 옷·헬멧·조끼·가방·든 총)을 금으로 본뜬 동상이 대리석 받침과 함께 앞 땅에서 솟아오름
//     땅이 갈라지고 흙먼지 → 다 솟으면 금빛 섬광 고리 · 빛기둥 · 색종이 · 반짝임 + 팡파르. 받침 앞 금 명판에 이름·처치·맵·날짜 (경기마다 하나)
//   · 춤추기 (K — 누를 때마다 다음 춤): 환호 · 스텝 & 박수 · 로봇 · 디스코. 박자(120 BPM)에 맞춘 동작 + 코드로 만든 음악,
//     30m 안의 팀원 봇도 따라 춤. 춤추는 동안은 카메라가 나를 천천히 돌며 비춤(끌어서 돌리기) · 움직이거나 쏘면 멈춤
//   · 즉시 결산 (Enter): 바로 결과 화면. 가만히 두면 2분 뒤 자동 결산
//  · 축하 중에는 내 팀 모두 다치지 않고(자기장·불 포함), 기절해 있던 팀원은 일어남. 생존 시간 기록은 마지막 적이 쓰러진 때로
//  · 같이 하기: 동상·춤이 파티원 화면에도 보인다 (Net 사건 'vic')
// ============================================================
const Victory = (() => {
  const AUTO = 120, BEAT = 0.5, RISE = 3.4, CINE = RISE + 1.6, SC = 1.15, DEPTH = 5.6;   // SC: 동상 전체 크기 (받침 ≈ 2m 폭, 꼭대기 ≈ 5m)
  const DANCES = [{ id: 'cheer', name: '환호' }, { id: 'step', name: '스텝 & 박수' }, { id: 'robot', name: '로봇' }, { id: 'disco', name: '디스코' }];
  let S = null;   // 축하 중 상태 { t, left, statues, cine, oy, el, ... }
  const $id = (id) => document.getElementById(id);

  // ---------- 춤 동작 (04_motion.js 의 IK·손가락 도우미를 그대로 씀) ----------
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _qh2 = new THREE.Quaternion(), _fw2 = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const POINT = [1.6, 1.5, 0.05, 0.05, 0.9];
  const ease = (x) => x * x * (3 - 2 * x);
  // 팔: 손목 목표 h · 팔꿈치가 향할 점 p (가슴 로컬: x 왼쪽, y 위, z 앞) · 손 모양 · (있으면) 손가락 방향 fd·손바닥 방향 pn (가슴 로컬)
  function arm(r, A, h, p, hand, fd, pn) {
    chestPt(r, h[0], h[1], h[2], _a); chestPt(r, p[0], p[1], p[2], _b);
    let Q = null; if (fd) { chestDir(r, fd[0], fd[1], fd[2], _c1); chestDir(r, pn[0], pn[1], pn[2], _c2); Q = handQuat(_qh2, _c1, _c2, A.side); }
    armIK(A, _a, _b, Q, 1);
    if (hand === 'fist') setFist(A); else setFingers(A, hand === 'point' ? POINT : hand === 'flat' ? FING.flat : hand === 'open' ? FING.open : hand === 'grip' ? FING.grip : FING.relax);
  }
  // 다리: 몸 로컬 (x, z) 자리 땅에 발을 디딤 (lift = 들어 올림, turn = 발끝 바깥으로)
  function leg(r, L, x, z, lift, yaw, gy, turn = 0) {
    bodyPt(r, x, 0, z, _a); _a.y = gy + 0.085 + lift;
    _fw2.set(Math.sin(yaw), 0, Math.cos(yaw)); _e.set(0, yaw + L.side * (0.14 + turn), 0); _q.setFromEuler(_e);
    legIK(L, _a, _fw2, _q, 1);
  }
  // 로봇 자세 (반 박자마다 탁 바뀜): [오른손 x,y,z, 오른팔꿈치 x,y,z, 왼손 x,y,z, 왼팔꿈치 x,y,z, 허리 비틀기, 고개 좌우, 고개 숙임]
  const GP = (s) => [s * 0.47, 0.43, 0.02, s * 0.9, 0.05, 0], DN = (s) => [s * 0.47, -0.09, 0.02, s * 0.9, 0.35, 0], FW = (s) => [s * 0.21, -0.1, 0.26, s * 0.45, -0.35, -0.3], ZB = (s) => [s * 0.16, 0.17, 0.53, s * 0.3, -0.2, 0.2];
  const ROBO = [
    [...GP(-1), ...GP(1), 0, 0, 0], [...GP(-1), ...DN(1), 0.2, 0.5, 0], [...DN(-1), ...GP(1), -0.2, -0.5, 0], [...FW(-1), ...FW(1), 0, 0, 0.12],
    [...ZB(-1), ...ZB(1), 0.35, -0.4, -0.05], [...ZB(-1), ...ZB(1), -0.35, 0.4, -0.05], [...ZB(-1), ...GP(1), 0.15, 0.3, 0], [-0.06, 0.45, 0.13, -0.6, 0.3, 0.2, 0.22, -0.3, 0.02, 0.5, 0, -0.3, 0, 0, -0.12],
  ];
  const POSES = {
    // 환호: 박자마다 무릎을 툭 굽히며, 두 박자씩 주먹을 번갈아 하늘로 (오른손부터)
    cheer(r, t, b, yaw, gy) {
      const ph = b % 1, dip = 0.5 + 0.5 * Math.cos(ph * TAU), side = Math.floor(b / 2) % 2 ? 1 : -1, pump = Math.max(0, Math.cos((ph - 0.1) * Math.PI));
      r.hips.position.set(0.012 * Math.sin(b * Math.PI), 0.958 - 0.05 * dip, 0); r.hips.rotation.set(0.04 * dip, side * 0.08, 0);
      r.spine.rotation.set(-0.04 - 0.05 * pump, side * 0.12, -side * 0.04); r.chest.rotation.set(-0.06 * pump, side * 0.06, 0);
      r.neck.rotation.set(0.12 * dip - 0.1, -side * 0.1, 0); r.head.rotation.set(-0.12 * pump, -side * 0.12, 0);
      r.root.updateMatrixWorld(true);
      leg(r, r.legL, 0.14, 0.03, 0, yaw, gy); leg(r, r.legR, -0.14, -0.01, 0, yaw, gy);
      r.root.updateMatrixWorld(true);
      for (const A of [r.armL, r.armR]) {
        const s = A.side;
        if (s === side) arm(r, A, [s * lerp(0.21, 0.15, pump), lerp(0.24, 0.68, pump), lerp(0.12, 0.08, pump)], [s * 0.55, lerp(-0.35, 0.2, pump), lerp(0.02, -0.3, pump)], 'fist');   // 내릴 때는 팔꿈치를 아래로 (어깨 앞 주먹)
        else arm(r, A, [s * 0.13, 0.04 + 0.03 * dip, 0.24], [s * 0.5, -0.25, -0.2], 'fist');
      }
    },
    // 스텝 & 박수: 박자마다 옆으로 한 발씩(무게를 옮기며), 박자에 맞춰 손뼉
    step(r, t, b, yaw, gy) {
      const k = Math.floor(b), ph = b - k, to = k % 2, tr = ease(clamp(ph / 0.38, 0, 1)), w = to ? tr : 1 - tr, lift = 0.07 * Math.sin(Math.PI * tr);
      const clap = Math.pow(0.5 + 0.5 * Math.cos(ph * TAU), 3);
      r.hips.position.set(lerp(-0.1, 0.1, w), 0.955 - 0.035 * Math.sin(Math.PI * tr), 0); r.hips.rotation.set(0.02, 0, lerp(0.07, -0.07, w));
      r.spine.rotation.set(0.05, 0, lerp(-0.08, 0.08, w)); r.chest.rotation.set(0.02, lerp(0.1, -0.1, w), 0);
      r.neck.rotation.set(0.1 * clap - 0.05, lerp(0.15, -0.15, w), 0); r.head.rotation.set(0, 0, lerp(0.06, -0.06, w));
      r.root.updateMatrixWorld(true);
      leg(r, r.legL, lerp(-0.02, 0.24, w), 0.02, to ? lift : 0.012 * (1 - w), yaw, gy); leg(r, r.legR, lerp(-0.24, 0.02, w), 0, to ? 0.012 * w : lift, yaw, gy);
      r.root.updateMatrixWorld(true);
      for (const A of [r.armL, r.armR]) { const s = A.side; arm(r, A, [s * lerp(0.3, 0.04, clap), 0.08 + 0.06 * clap, lerp(0.16, 0.27, clap)], [s * 0.55, -0.3, -0.1], 'open', [0, 0.45, 1], [-s, 0, 0]); }
    },
    // 로봇: 반 박자마다 각진 자세로 탁 바뀌고 잠깐 떨림
    robot(r, t, b, yaw, gy) {
      const hb = b * 2, i = Math.floor(hb), f = hb - i, k = ease(clamp(f / 0.16, 0, 1)), P0 = ROBO[(i + ROBO.length - 1) % ROBO.length], P1 = ROBO[i % ROBO.length];
      const v = (j) => lerp(P0[j], P1[j], k), jit = f < 0.16 ? 0 : 0.006 * Math.sin(f * 60) * (1 - f);
      r.hips.position.set(0, 0.945 - 0.012 * (1 - k), 0); r.hips.rotation.set(0.02, v(12) * 0.4, 0);
      r.spine.rotation.set(0, v(12) * 0.6, 0); r.chest.rotation.set(0, v(12) * 0.4 + jit, 0);
      r.neck.rotation.set(0, v(13) * 0.6, 0); r.head.rotation.set(v(14), v(13) * 0.6, 0);
      r.root.updateMatrixWorld(true);
      leg(r, r.legL, 0.16, 0.02, 0, yaw, gy); leg(r, r.legR, -0.16, 0.02, 0, yaw, gy);
      r.root.updateMatrixWorld(true);
      arm(r, r.armR, [v(0), v(1), v(2)], [v(3), v(4), v(5)], 'flat'); arm(r, r.armL, [v(6), v(7), v(8)], [v(9), v(10), v(11)], 'flat');
    },
    // 디스코: 골반을 흔들며 오른손 검지로 하늘 → 아래(몸 건너) 번갈아 찌르기, 왼손은 허리에
    disco(r, t, b, yaw, gy) {
      const k = Math.floor(b), ph = b - k, sn = ease(clamp(ph / 0.22, 0, 1)), u = k % 2 === 0 ? sn : 1 - sn, sway = Math.sin(b * Math.PI), dip = 0.5 + 0.5 * Math.cos(ph * TAU);
      r.hips.position.set(0.045 * sway, 0.952 - 0.03 * dip, 0); r.hips.rotation.set(0.03, 0.12 * sway, -0.09 * sway);
      r.spine.rotation.set(lerp(0.08, -0.08, u), -0.15 * sway, 0.08 * sway); r.chest.rotation.set(0, lerp(0.2, -0.25, u), lerp(0.1, -0.12, u));
      r.neck.rotation.set(lerp(0.2, -0.25, u), lerp(0.3, -0.35, u), 0); r.head.rotation.set(lerp(0.15, -0.2, u), lerp(0.2, -0.25, u), 0);
      r.root.updateMatrixWorld(true);
      leg(r, r.legL, 0.15, 0.04, 0, yaw, gy, 0.2); leg(r, r.legR, -0.15, -0.02, 0.02 * Math.max(0, -sway), yaw, gy, 0.2);
      r.root.updateMatrixWorld(true);
      arm(r, r.armR, [lerp(0.12, -0.37, u), lerp(-0.2, 0.62, u), lerp(0.26, 0.2, u)], [lerp(-0.4, -0.7, u), lerp(-0.3, 0.1, u), -0.3], 'point');
      arm(r, r.armL, [0.2, -0.2, -0.01], [0.62, -0.05, -0.25], 'fist');
    },
  };
  // 04_motion.js animateChar 가 춤추는 캐릭터마다 부름 (총은 등에, 손에 든 것은 치움)
  function pose(c, dt) {
    const r = c.rig, D = c.dance; D.t += dt;
    c.root.position.copy(c.pos); c.root.rotation.set(0, c.bodyYaw, 0);
    resetPose(r); setHeld(c, null, null); setSheath(r, c.inv.melee || null, c.inv.melee ? MeleeSkin.ofChar(c, c.inv.melee) : null);
    (POSES[D.kind] || POSES.cheer)(r, D.t, Math.max(0, D.t) / BEAT, c.bodyYaw, c.pos.y);
  }

  // ---------- 동상 ----------
  let GOLD = null, GOLD_SK = null;
  function golds() {
    if (!GOLD) { GOLD = new THREE.MeshStandardMaterial({ color: 0xffc64a, metalness: 1, roughness: 0.27, envMap: Models.env || null, envMapIntensity: 1.35 }); GOLD_SK = GOLD.clone(); GOLD_SK.skinning = true; }
    return GOLD;
  }
  const TEX = {};
  function canvasTex(key, w, h, draw) { if (TEX[key]) return TEX[key]; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return (TEX[key] = t); }
  // 대리석: 밝은 바탕 + 회색 결 + 가는 금 결
  const marbleTex = () => canvasTex('marble', 256, 256, (g, w, h) => {
    const R = mulberry32(2024); g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.035})`; g.fillRect(R() * w, R() * h, 2, 2); }
    for (let k = 0; k < 9; k++) { let x = R() * w, y = R() * h, a = R() * TAU; g.strokeStyle = k < 2 ? 'rgba(200,160,70,0.55)' : `rgba(120,116,108,${0.25 + R() * 0.3})`; g.lineWidth = k < 2 ? 1.2 : 0.8 + R() * 2; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 40; i++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); } g.stroke(); }
  });
  // 땅 갈라짐 (투명 바탕에 검은 갈래)
  const crackTex = () => canvasTex('crack', 256, 256, (g, w, h) => {
    const R = mulberry32(77); g.clearRect(0, 0, w, h);
    const rg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); rg.addColorStop(0, 'rgba(30,24,18,0.75)'); rg.addColorStop(0.55, 'rgba(40,32,24,0.35)'); rg.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(12,10,8,0.9)'; g.lineCap = 'round';
    for (let k = 0; k < 14; k++) { let a = k / 14 * TAU + R() * 0.3, x = w / 2, y = h / 2, r = 0; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); while (r < w * 0.47) { a += (R() - 0.5) * 0.5; r += 6 + R() * 8; x = w / 2 + Math.cos(a) * r; y = h / 2 + Math.sin(a) * r; g.lineTo(x, y); g.lineWidth = Math.max(0.6, 3 - r / 40); } g.stroke(); }
  });
  // 빛기둥: 아래가 밝고 위로 사라지는 세로 그러데이션
  const beamTex = () => canvasTex('beam', 4, 128, (g, w, h) => { const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, 'rgba(255,240,190,0)'); lg.addColorStop(0.6, 'rgba(255,220,130,0.35)'); lg.addColorStop(1, 'rgba(255,230,160,0.95)'); g.fillStyle = lg; g.fillRect(0, 0, w, h); });
  // 월계관 문장 (받침 옆·뒤)
  const laurelTex = () => canvasTex('laurel', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#e8c25a'; g.strokeStyle = '#7a5418'; g.lineWidth = 2;
    for (const s of [1, -1]) for (let i = 0; i < 9; i++) { const a = Math.PI * (0.62 + i * 0.085), r = 86, x = w / 2 + s * Math.cos(a) * r, y = h * 0.56 - Math.sin(a) * r * -1; g.save(); g.translate(x, y); g.rotate(s * (a - Math.PI / 2) + (s > 0 ? Math.PI : 0)); g.beginPath(); g.ellipse(0, 0, 9, 20, 0.5 * s, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    // 가운데 별
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42; g.lineTo(w / 2 + Math.cos(a) * r, h * 0.48 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
  });
  const FONT_KR = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  // 앞 명판: 금판에 새긴 글씨 (제목 · 이름 · 처치·맵·날짜)
  function plaqueTex(info) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 224; const g = cv.getContext('2d'), w = 512, h = 224;
    const lg = g.createLinearGradient(0, 0, w, h); lg.addColorStop(0, '#f6dc8a'); lg.addColorStop(0.5, '#d9a93e'); lg.addColorStop(1, '#a87a22'); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b4a14'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.lineWidth = 2; g.strokeRect(18, 18, w - 36, h - 36);
    const carve = (s, x, y, size, wt) => { let px = size; g.font = `${wt} ${px}px ${FONT_KR}`; while (g.measureText(s).width > w - 70 && px > 14) { px -= 2; g.font = `${wt} ${px}px ${FONT_KR}`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,245,205,0.85)'; g.fillText(s, x + 1.5, y + 1.5); g.fillStyle = '#4a3210'; g.fillText(s, x, y); };
    carve(info.title, w / 2, 58, 46, 800); carve(info.name, w / 2, 118, 42, 800); carve(info.line, w / 2, 172, 24, 600);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  const RBk = (w, h, l, r) => Models.kit.RB(w, h, l, r, Math.min(r * 0.5, 0.02));
  // 동상 (원점 = 받침 바닥 가운데, +z = 동상 정면). info: { look, gear:[h,v,b], gun:{id, att, skin}|null, melee, title, name, line }
  function buildStatue(info) {
    golds();
    const root = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: 0x313338, roughness: 0.38, metalness: 0.15, envMap: Models.env || null, envMapIntensity: 0.6 });
    const marble = new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: 0.22, metalness: 0.05, envMap: Models.env || null, envMapIntensity: 0.75 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
    add(RBk(1.78, 0.2, 1.78, 0.03), stone, 0, 0.1, 0);
    add(RBk(1.52, 0.1, 1.52, 0.02), stone, 0, 0.25, 0);
    add(RBk(1.26, 0.6, 1.26, 0.02), marble, 0, 0.6, 0);
    add(RBk(1.3, 0.04, 1.3, 0.01), GOLD, 0, 0.32, 0); add(RBk(1.3, 0.04, 1.3, 0.01), GOLD, 0, 0.885, 0);
    add(RBk(1.46, 0.12, 1.46, 0.02), stone, 0, 0.96, 0);
    // 명판 (앞) · 월계관 (옆·뒤)
    const pm = new THREE.MeshStandardMaterial({ map: plaqueTex(info), metalness: 0.75, roughness: 0.35, envMap: Models.env || null, envMapIntensity: 1 });
    add(new THREE.PlaneGeometry(1.0, 0.44), pm, 0, 0.6, 0.632);
    const lm = new THREE.MeshStandardMaterial({ map: laurelTex(), transparent: true, alphaTest: 0.4, metalness: 0.9, roughness: 0.3, envMap: Models.env || null, envMapIntensity: 1.2 });
    for (const [x, z, ry] of [[0.632, 0, Math.PI / 2], [-0.632, 0, -Math.PI / 2], [0, -0.632, Math.PI]]) { const o = add(new THREE.PlaneGeometry(0.5, 0.5), lm, x, 0.6, z); o.rotation.y = ry; o.castShadow = false; }
    // 인물: 내 모습 그대로 → 금
    const fig = buildRig(info.look), r = fig;
    fig.setLod(0); fig.setGear(info.gear[0] || 0, info.gear[1] || 0, info.gear[2] || 0); fig.chute.visible = false;
    poseStatue(fig, info);
    fig.root.traverse((o) => { if (o.isMesh) { o.material = o.isSkinnedMesh ? GOLD_SK : GOLD; o.castShadow = true; o.receiveShadow = true; } if (o.isLineSegments) o.visible = false; });
    const fg = new THREE.Group(); fg.position.y = 1.02; fg.scale.setScalar(1.35); fg.add(r.root); root.add(fg);
    root.userData.fig = fig; root.scale.setScalar(SC);
    return root;
  }
  // 동상 자세: 넓게 버티고 서서 오른손으로 총을 하늘로 들고, 왼손 주먹은 허리에 · 고개를 들어 위를 봄
  function poseStatue(r, info) {
    resetPose(r); r.root.position.set(0, 0, 0); r.root.rotation.set(0, 0, 0);
    r.hips.position.set(0, 0.925, 0); r.hips.rotation.set(0, 0.12, 0);
    r.spine.rotation.set(-0.07, -0.06, 0.02); r.chest.rotation.set(-0.08, -0.08, 0.03);
    r.neck.rotation.set(-0.1, -0.16, 0); r.head.rotation.set(-0.2, -0.12, 0.04);
    r.root.updateMatrixWorld(true);
    leg(r, r.legL, 0.22, 0.1, 0, 0, 0, 0.18); leg(r, r.legR, -0.21, -0.07, 0, 0, 0, 0.12);
    r.root.updateMatrixWorld(true);
    arm(r, r.armR, [-0.17, 0.62, 0.07], [-0.65, 0.35, -0.25], info.gun || info.melee ? 'grip' : 'fist');
    arm(r, r.armL, [0.2, -0.2, 0.0], [0.62, -0.05, -0.2], 'fist');
    r.root.updateMatrixWorld(true);
    // 든 것: 총은 손잡이를 손바닥에 두고 총구가 하늘로 (조금 앞으로) · 근접 무기는 날이 위로
    const palm = (r.armR.side > 0 ? PALM.L : PALM.R).clone().applyMatrix4(r.armR.hand.matrixWorld);
    if (info.gun) {
      const g = buildGunMesh(info.gun.id, info.gun.att || {}, info.gun.skin || null), meta = g.userData.meta || {}, gp = meta.gripPos || [0, -0.06, -0.05];
      const Z = new THREE.Vector3(0.06, 1, 0.14).normalize(), X = new THREE.Vector3(1, 0, 0).addScaledVector(Z, -Z.x).normalize(), Y = new THREE.Vector3().crossVectors(Z, X);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      g.position.copy(palm).sub(new THREE.Vector3(gp[0], gp[1], gp[2]).applyQuaternion(g.quaternion));
      r.root.add(g);
    } else if (info.melee) {
      // v23 근접 무기 스킨 모양 그대로 (동상 재질로 칠해짐)
      const m = MeleeSkin.model(info.melee, MeleeSkin.ofLook(info.look, info.melee)); m.position.copy(palm); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.05, 1, 0.12).normalize()); r.root.add(m);
    }
  }
  // 동상 하나 세우기 (나·파티원 공통): x·z 자리, yaw = 동상이 바라볼 방향
  function raise(c, x, z, yaw, info, remote, gy0) {
    if (!G.scene) return null;
    const gy = gy0 !== undefined && gy0 !== null ? gy0 : groundAt(x, z, c.pos.y + 1.5), root = buildStatue(info);
    root.position.set(x, gy - DEPTH, z); root.rotation.y = yaw; G.scene.add(root);
    // 땅 갈라짐
    const ck = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40), new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3 }));
    ck.rotation.x = -Math.PI / 2; ck.position.set(x, gy + 0.03, z); G.scene.add(ck);
    const st = { c, x, z, gy, yaw, root, ck, t: 0, done: false, ring: null, beam: null, fxT: 0, remote: !!remote };
    if (S) { S.statues.push(st); Audio.statue && Audio.statue('rise'); }
    else { st.done = true; st.ck.material.opacity = 1; finishStatue(st, true); clearFx(st); }   // 내 축하가 없을 때(파티원이 세움): 바로 서 있게
    return st;
  }
  const _p = new THREE.Vector3();
  function stepStatue(st, dt) {
    st.t += dt; const k = clamp(st.t / RISE, 0, 1), e = k * k * (3 - 2 * k);   // 천천히 → 빠르게 → 천천히: 하늘로 든 총이 먼저 땅을 뚫고, 머리 · 몸 · 받침 순으로
    if (!st.done) {
      st.root.position.y = st.gy - DEPTH * (1 - e) + (k < 1 ? (Math.random() - 0.5) * 0.03 : 0);
      st.ck.material.opacity = Math.min(1, st.t * 3);
      // 흙먼지 (솟는 동안)
      const P = GunSkin.fx.pool(G.scene), E = GunSkin.fx.emit;
      for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, rr = 1.05 + Math.random() * 0.6; _p.set(st.x + Math.cos(a) * rr, st.gy + 0.1, st.z + Math.sin(a) * rr); E(P, _p, Math.cos(a) * (0.6 + Math.random()), 0.6 + Math.random() * 1.2, Math.sin(a) * (0.6 + Math.random()), Math.random() < 0.5 ? 0x8a7a62 : 0x6a5c48, 0.16 + Math.random() * 0.2, 1.2 + Math.random() * 0.8, { g: -0.6, drag: 1.4, grow: 1.6, a: 0.55, so: 1 }); }
      if (k >= 1) { st.done = true; finishStatue(st); }
      return;
    }
    // 다 솟은 뒤: 섬광 고리·빛기둥이 사라지고, 반짝임이 동상 둘레를 천천히 오름
    if (st.ring) { const u = clamp((st.t - RISE) / 0.9, 0, 1); st.ring.scale.setScalar(1 + u * 5); st.ring.material.opacity = 0.9 * (1 - u); if (u >= 1) { G.scene.remove(st.ring); st.ring.geometry.dispose(); st.ring.material.dispose(); st.ring = null; } }
    if (st.beam) { const u = clamp((st.t - RISE) / 2.4, 0, 1); st.beam.material.opacity = 0.42 * (1 - u) * Math.min(1, (st.t - RISE) * 6); st.beam.scale.x = st.beam.scale.z = 1 + u * 0.6; if (u >= 1) { G.scene.remove(st.beam); st.beam.geometry.dispose(); st.beam.material.dispose(); st.beam = null; } }
    if (G.camera && Math.hypot(st.x - G.camera.position.x, st.z - G.camera.position.z) < 60) {
      st.fxT -= dt;
      if (st.fxT <= 0) { st.fxT = 0.12; const P = GunSkin.fx.pool(G.scene), a = Math.random() * TAU, rr = 0.45 + Math.random() * 0.7; _p.set(st.x + Math.cos(a) * rr, st.gy + 1.3 + Math.random() * 3.2, st.z + Math.sin(a) * rr); GunSkin.fx.emit(P, _p, -Math.sin(a) * 0.25, 0.25 + Math.random() * 0.3, Math.cos(a) * 0.25, Math.random() < 0.7 ? 0xffd65a : 0xffffff, 0.035 + Math.random() * 0.03, 1.2 + Math.random() * 0.6, { grow: -0.5 }); }
    }
  }
  function clearFx(st) {
    for (const k of ['ring', 'beam']) if (st[k]) { G.scene && G.scene.remove(st[k]); st[k].geometry.dispose(); st[k].material.dispose(); st[k] = null; }
  }
  function finishStatue(st, quiet) {
    st.root.position.y = st.gy;
    // 충돌: 받침 + 인물 (밟고 올라설 수 있음)
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), box = (hx, hz, y0, y1) => { const ex = Math.abs(cy) * hx + Math.abs(sy) * hz, ez = Math.abs(sy) * hx + Math.abs(cy) * hz, b = { x0: st.x - ex, x1: st.x + ex, y0: st.gy + y0, y1: st.gy + y1, z0: st.z - ez, z1: st.z + ez, soft: false, nav: false, _q: 0, kind: 'statue' }; W.boxes.push(b); const i0 = clamp(Math.floor((b.x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((b.x1 + HALF) / CG), 0, CGN - 1), j0 = clamp(Math.floor((b.z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((b.z1 + HALF) / CG), 0, CGN - 1); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(W.grid, j * CGN + i, b); };
    if (W && W.boxes) { box(0.89 * SC, 0.89 * SC, -0.3, 1.02 * SC); box(0.32 * SC, 0.26 * SC, 1.02 * SC, 3.6 * SC); }
    // 금빛 섬광 고리 · 빛기둥 · 반짝임 · 색종이
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.45, 48), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(st.x, st.gy + 0.08, st.z); G.scene.add(ring); st.ring = ring;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 26, 28, 1, true), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(st.x, st.gy + 13, st.z); G.scene.add(beam); st.beam = beam;
    const P = GunSkin.fx.pool(G.scene), E = GunSkin.fx.emit, cols = [0xff4a5a, 0xffd65a, 0x4ae0ff, 0x7aff6a, 0xff7ad8, 0xffffff];
    for (let i = 0; i < 70; i++) { const a = Math.random() * TAU, v = 1.5 + Math.random() * 3.5; _p.set(st.x, st.gy + 2.8 + Math.random() * 1.4, st.z); E(P, _p, Math.cos(a) * v, 1 + Math.random() * 3, Math.sin(a) * v, Math.random() < 0.75 ? 0xffd65a : 0xffffff, 0.05 + Math.random() * 0.05, 0.9 + Math.random() * 0.8, { g: -3, drag: 1.2, grow: -0.6 }); }
    for (let i = 0; i < 110; i++) { const a = Math.random() * TAU, v = 1 + Math.random() * 3; _p.set(st.x + Math.cos(a) * 0.3, st.gy + 4.2, st.z + Math.sin(a) * 0.3); E(P, _p, Math.cos(a) * v, 4 + Math.random() * 5, Math.sin(a) * v, cols[i % cols.length], 0.05 + Math.random() * 0.04, 3.2 + Math.random() * 1.5, { g: -2.6, drag: 1.6, sq: 1, so: 1 }); }
    if (quiet) return;
    Audio.statue && Audio.statue('done');
    if (st.c === G.player) HUD.toast('승리의 동상이 섰습니다!', 'ok');
  }

  // ---------- 축하 시작 · 진행 · 끝 ----------
  const lv = (g) => (g && ITEMS[g.id] && ITEMS[g.id].lvl) || 0;
  function start() {
    const p = G.player; if (!p) return;
    setupHud();
    const team = G.teamSize > 1;
    G.over = true; G.win = true; G.endT = 1e9; G.matchT = G.time;
    S = { t: 0, left: AUTO, statues: [], cine: null, oy: p.yaw + Math.PI, el: 0.16, dance: -1, raised: false, team, keyK: false, keyEnter: false, drag: 0 };
    G.victory = S;
    // 기절한 팀원(나 포함)은 일어남
    for (const m of teamMembers(p)) if (m.alive && m.knocked && (!G.net || Net.mine(m))) { m.knocked = false; m.revivedBy = null; m.knockedBy = null; m.hp = Math.max(m.hp, REVIVE_HP); m.stance = 'stand'; m.setVisibleGear(); if (G.net) Net.sendRevive(m, m, 'done'); }
    p.aiming = false; p.fireHold = false; Input.fire = false; Input.aim = false; if (p.throwMode) exitThrow(p, true);
    if (HUD.closeInv) HUD.closeInv(); if (HUD.closeMap) HUD.closeMap();
    releaseLock();
    document.body.classList.add('victory');
    showHud();
    Audio.victory ? Audio.victory() : Audio.win();
    HUD.toast(team ? '최후의 팀! 동상을 세우고 춤을 춰 보세요' : '최후의 1인! 동상을 세우고 춤을 춰 보세요', 'ok');
  }
  function canAct(p, what) {
    if (!p || !p.alive || p.knocked) return '쓰러져 있습니다';
    if (p.veh) return `차에서 내린 뒤 ${what}`;
    if (p.mode !== 'ground' || !p.onGround) return `땅에 내려선 뒤 ${what}`;
    if (p.inWater) return `물 밖에서 ${what}`;
    return null;
  }
  // 동상 자리: 바라보는 쪽부터(막혔으면 옆 → 뒤로 돌려 가며) 4.2 → 3.6 → 3.1m 중 벽·물·지붕이 없는 곳
  //  비탈이면 받침을 낮은 쪽 땅에 맞춰 높은 쪽은 땅에 묻히게 (받침 안 높이 차 1m 까지)
  function statueSpot(p) {
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const fx = Math.sin(p.yaw + da), fz = Math.cos(p.yaw + da);
      for (const d of [4.2, 3.6, 3.1]) {
        const x = p.pos.x + fx * d, z = p.pos.z + fz * d, g0 = groundAt(x, z, p.pos.y + 2);
        if (Math.abs(g0 - p.pos.y) > 1.6 || g0 < WATER_Y + 0.05) continue;
        if (rayBoxes(p.pos.x, p.pos.y + 1.2, p.pos.z, fx, 0, fz, d + 1.1, true).t < d + 1.05) continue;
        if (isIndoor(x, z, g0 + 0.5) || rayBoxes(x, g0 + 0.6, z, 0, 1, 0, 5.2, true).t < 5.1) continue;
        let lo = g0, hi = g0;
        for (const [ox, oz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const h = groundAt(x + ox, z + oz, g0 + 2); if (h < lo) lo = h; if (h > hi) hi = h; }
        if (hi - lo > 1.0 || lo < WATER_Y + 0.05) continue;
        return { x, z, gy: lo - 0.04, yaw: Math.atan2(p.pos.x - x, p.pos.z - z) };   // 동상은 나를 바라봄
      }
    }
    return null;
  }
  function raiseMine() {
    if (!S) return; const p = G.player;
    if (S.raised) { HUD.toast('동상은 경기마다 하나만 세울 수 있습니다', 'warn'); return; }
    const why = canAct(p, '세울 수 있습니다'); if (why) { HUD.toast(why, 'warn'); return; }
    const spot = statueSpot(p); if (!spot) { HUD.toast('앞이 막혀 있습니다 — 넓고 평평한 바깥에서 세워 보세요', 'warn'); return; }
    if (p.dance) stopDance(p);
    const w = p.weapon || p.inv.weapons.find(Boolean) || null;
    const info = statueInfo(p, w);
    const st = raise(p, spot.x, spot.z, spot.yaw, info, false, spot.gy); if (!st) return;
    S.raised = true; S.cine = { st, t: 0, dur: CINE, yaw: Math.atan2(p.pos.x - spot.x, p.pos.z - spot.z) + 0.6 };
    if (G.net) Net.ev({ k: 'vic', a: 'st', c: p.id, x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), gy: +spot.gy.toFixed(2), y: +spot.yaw.toFixed(3), g: info.gear, w: w ? { id: w.id, att: w.att, skin: p.skinOf(w.id) } : null, m: p.inv.melee || null, n: info.name, k: p.kills });
    showHud();
  }
  function statueInfo(c, w) {
    const d = new Date(), pad = (n) => String(n).padStart(2, '0'), mp = MAPS[SETTINGS.map] ? MAPS[SETTINGS.map].name.replace(/\s*\(.*\)$/, '') : '';
    return { look: c.look, gear: [lv(c.inv.gear.helmet), lv(c.inv.gear.vest), lv(c.inv.gear.bag)], gun: w ? { id: w.id, att: w.att, skin: c.skinOf ? c.skinOf(w.id) : null } : null, melee: c.inv.melee || null,
      title: G.teamSize > 1 ? '최후의 팀' : '최후의 1인', name: c.name || '이름 없음', line: `처치 ${c.kills} · ${mp} · ${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` };
  }
  // 춤: i = 0~3 (-1 = 멈춤). 30m 안의 팀원 봇도 다른 춤으로 따라 춤
  function dance(i) {
    if (!S) return; const p = G.player;
    if (i < 0 || (p.dance && S.dance === i)) { stopDance(p); showHud(); return; }
    const why = canAct(p, '출 수 있습니다'); if (why) { HUD.toast(why, 'warn'); return; }
    const lead = Audio.dance ? Audio.dance(DANCES[i].id) || 0 : 0;
    p.dance = { kind: DANCES[i].id, t: -lead }; S.dance = i; p.vel.x = p.vel.z = 0; p.sprint = false; p.setVisibleGear();
    for (const m of CHARS) if (m !== p && m.alive && !m.knocked && !m.human && sameTeam(m, p) && m.mode === 'ground' && !m.veh && Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) < 30 && (!G.net || Net.mine(m))) { m.dance = { kind: DANCES[(i + 1 + (m.id % 3)) % 4].id, t: Math.random() * BEAT * 2 }; m.vel.x = m.vel.z = 0; m.setVisibleGear(); }
    if (G.net) Net.ev({ k: 'vic', a: 'd', c: p.id, d: DANCES[i].id });
    showHud();
  }
  function stopDance(p, quiet) {
    if (!p || !p.dance) return;
    p.dance = null; if (S) S.dance = -1; p.setVisibleGear(); if (Audio.danceStop) Audio.danceStop();
    for (const m of CHARS) if (m !== p && m.dance && !m.human && (!G.net || Net.mine(m))) { m.dance = null; m.setVisibleGear(); }
    if (G.net && !quiet) Net.ev({ k: 'vic', a: 'd', c: p.id, d: null });
    if (S) showHud();
  }
  // 춤추는 동안의 입력 (11_game.js 플레이어 갱신 대신): 움직이거나 쏘거나 뛰면 멈춤 · 끌면 카메라가 돎
  function danceInput(dt, modal) {
    const p = G.player, K = Input.keys;
    const mv = K.KeyW || K.KeyA || K.KeyS || K.KeyD || Math.abs(Input.move.x) + Math.abs(Input.move.z) > 0.3;
    if (!modal && (mv || Input.fire || Input.aim || Input.consume('jump') || Input.consume('crouch') || Input.consume('prone'))) { stopDance(p); stepPhysics(p, dt, 0, 0, 0, false); return; }
    if (S && (Input.lookX || Input.lookY)) { S.oy -= Input.lookX * 0.004 * SETTINGS.lookSens; S.el = clamp(S.el + Input.lookY * 0.003 * SETTINGS.lookSens, -0.05, 0.85); S.drag = 1.5; }
    Input.lookX = Input.lookY = 0;
    stepPhysics(p, dt, 0, 0, 0, false);
  }
  function update(dt) {
    if (!S) return;
    const p = G.player; S.t += dt; S.left -= dt; if (S.drag > 0) S.drag -= dt;
    // 단축키: B 동상 · K 춤(다음) · Enter 즉시 결산
    if (Input.consume('fireMode')) raiseMine();
    const kk = !!Input.keys.KeyK; if (kk && !S.keyK) dance(S.dance + 1 >= DANCES.length ? -1 : S.dance + 1); S.keyK = kk;
    const ke = !!(Input.keys.Enter || Input.keys.NumpadEnter); if (ke && !S.keyEnter && !(typeof Chat !== 'undefined' && Chat.typing && Chat.typing())) { settle(); return; } S.keyEnter = ke;
    for (const st of S.statues) stepStatue(st, dt);
    if (S.cine && S.cine.t >= S.cine.dur) S.cine = null;
    if (p && !p.alive) { settle(); return; }
    if (S.left <= 0) { settle(); return; }
    const sec = Math.ceil(S.left); if (sec !== S.sec) { S.sec = sec; const el = $id('vhAuto'); if (el) el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} 뒤 자동 결산`; }
  }
  function settle(quiet) {
    if (!S) return;
    const p = G.player; stopDance(p, true); if (Audio.danceStop) Audio.danceStop();
    for (const st of S.statues) { if (!st.done) { st.done = true; finishStatue(st, true); } clearFx(st); }
    S = null; G.victory = null; hideHud();
    if (G.state === 'play') { endMatch(); if (quiet) $id('resultPanel').hidden = true; }
  }
  function reset() { if (S && G.player) stopDance(G.player, true); if (Audio.danceStop) Audio.danceStop(); S = null; G.victory = null; hideHud(); }

  // ---------- 카메라: 춤추는 동안 나를 돌며 비춤 · 동상이 솟는 동안은 동상과 나를 함께 ----------
  const camOn = () => !!S && (!!S.cine || !!(G.player && G.player.dance && G.player.alive));
  const _cp = new THREE.Vector3(), _ct = new THREE.Vector3();
  function camera(dt) {
    const cam = G.camera, p = G.player, C = S.cine;
    let yaw, el, dist;
    if (C) {
      C.t += dt; const st = C.st, k = clamp(C.t / C.dur, 0, 1);
      _ct.set(lerp(st.x, p.pos.x, 0.22), st.gy + 1.9 + 0.8 * k, lerp(st.z, p.pos.z, 0.22)); yaw = C.yaw + 0.4 * k; el = 0.1 + 0.1 * k; dist = lerp(11.5, 8.8, smoothstep01(k));
    } else {
      _ct.set(p.pos.x, p.pos.y + 1.0, p.pos.z); if (S.drag <= 0) S.oy += dt * 0.16; yaw = S.oy; el = S.el; dist = 3.5;
    }
    const bx = Math.sin(yaw) * Math.cos(el), by = Math.sin(el), bz = Math.cos(yaw) * Math.cos(el);
    let d = dist;
    const hb = rayBoxes(_ct.x, _ct.y, _ct.z, bx, by, bz, d + 0.3, true); if (hb.t < d + 0.25) d = Math.max(0.8, hb.t - 0.3);
    const ht = rayTerrain(_ct.x, _ct.y, _ct.z, bx, by, bz, d + 0.4); if (ht < d + 0.35) d = Math.max(0.8, ht - 0.4);
    _cp.set(_ct.x + bx * d, _ct.y + by * d, _ct.z + bz * d);
    const g = heightAt(_cp.x, _cp.z) + 0.4; if (_cp.y < g) _cp.y = g;
    if (cam.position.distanceTo(_cp) > 30) cam.position.copy(_cp); else cam.position.lerp(_cp, clamp(dt * 4, 0, 1));
    if (C && C.t < RISE) { cam.position.x += (Math.random() - 0.5) * 0.05; cam.position.y += (Math.random() - 0.5) * 0.05; }   // 땅 울림
    cam.fov = 62; cam.updateProjectionMatrix(); cam.lookAt(_ct);
    p.root.visible = true; VM.active = false; VM.root.visible = false;
  }

  // ---------- 같이 하기 (Net 'vic') ----------
  function onNet(e) {
    const c = CHARS.find((x) => x.id === e.c); if (!c || !G.scene) return;
    if (e.a === 'd') { c.dance = e.d ? { kind: e.d, t: 0 } : null; c.setVisibleGear(); }
    else if (e.a === 'st') {
      const d = new Date(), pad = (n) => String(n).padStart(2, '0'), mp = MAPS[SETTINGS.map] ? MAPS[SETTINGS.map].name.replace(/\s*\(.*\)$/, '') : '';
      raise(c, e.x, e.z, e.y, { look: c.look, gear: e.g || [0, 0, 0], gun: e.w || null, melee: e.m || null, title: G.teamSize > 1 ? '최후의 팀' : '최후의 1인', name: e.n || c.name, line: `처치 ${e.k || 0} · ${mp} · ${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` }, true, e.gy);
    }
  }

  // ---------- 화면 (위 가운데 승리 창) ----------
  function showHud() {
    const el = $id('victoryHud'); if (!el) return; el.hidden = false;
    const p = G.player; if (!S || !p) return;
    $id('vhTitle').textContent = S.team ? '최후의 팀' : '최후의 1인';
    $id('vhSub').textContent = `우승 · 처치 ${p.kills} · 생존 ${fmtTime(G.matchT || G.time)}`;
    const sb = $id('vhStatue'); sb.disabled = S.raised; sb.querySelector('span').textContent = S.raised ? '동상을 세웠습니다' : '동상 세우기';
    const db = $id('vhDance'); db.classList.toggle('on', S.dance >= 0); db.querySelector('span').textContent = S.dance >= 0 ? DANCES[S.dance].name : '춤추기';
    document.querySelectorAll('#vhDances button').forEach((b, i) => b.classList.toggle('on', i === S.dance));
  }
  function hideHud() { const el = $id('victoryHud'); if (el) { el.hidden = true; $id('vhDances').hidden = true; } document.body.classList.remove('victory'); }
  function setupHud() {
    const el = $id('victoryHud'); if (!el || el.dataset.ok) return; el.dataset.ok = '1';
    const tap = (b, fn) => { b.addEventListener('click', (e) => { e.preventDefault(); Audio.init(); Audio.ui && Audio.ui(); fn(); }); if (typeof Touch !== 'undefined' && Touch.dragLook) Touch.dragLook(b); };
    tap($id('vhStatue'), raiseMine);
    tap($id('vhDance'), () => { const m = $id('vhDances'); m.hidden = !m.hidden; });
    tap($id('vhSettle'), () => settle());
    const box = $id('vhDances'); box.innerHTML = '';
    DANCES.forEach((D, i) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<b>${i + 1}</b>${D.name}`; tap(b, () => { dance(i); $id('vhDances').hidden = true; }); box.appendChild(b); });
  }
  return { start, update, settle, reset, pose, camera, camOn, danceInput, onNet, setupHud, raise: raiseMine, dance, stopDance, DANCES, buildStatue, statueInfo, get state() { return S; } };
})();
