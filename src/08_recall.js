// ============================================================
// 08_recall.js — 리콜 (듀오·스쿼드 배틀로얄 전용 복귀)
//  · 팀원이 탈락하면 그 자리에 리콜 카드 (그 팀만 주울 수 있음 · 바닥에서 150초 뒤 사라짐)
//  · 카드를 들고 리콜 타워 단말기 앞에서 8초 등록(움직이면 취소) → 수송기가 타워 위를 지나가고, 복귀한 팀원이 강하
//    복귀하면 권총·9mm 30발·붕대 2개만 지급 · 한 사람은 한 경기에 한 번 · 자기장 절반 단계(작은 맵 3, 대형 맵 4)가 끝나면 마감
//  · 타워: 월드 생성 끝에서 별도 시드 난수로 배치 (8km 10 · 4km 6 · 작은 맵 3, 서로 멀리)
//    기존 생성 난수를 쓰지 않아 지형·건물·전리품·나무는 그대로 — 타워 충돌 상자는 kind 'tower' 로 맨 뒤에 붙는다
//  · 같이 하기 {k:'rc'}: 등록을 마친 기기 → 방장에게 's:reg' → 방장이 확인하고 's:go' 를 모두에게 (방장 권한)
//    복귀하는 캐릭터는 주인 기기가 되살린다 (사람은 자기 기기, 봇은 방장) · 's:st' 단말기 작동 표시 · 's:no' 거절
// ============================================================
const RECALL = { regT: 8, reach: 2.2, cardLife: 150, maxN: 1, lead: 14, kit: { gun: 'p19', ammo: 30, items: { bandage: 2 } } };

// ---------- 타워 배치·모델 (02_world.js generateWorld 끝에서 호출, 생성용 함수를 받아 쓴다) ----------
function placeRecallTowers(K) {
  const { M, w } = K; w.towers = [];
  if (K.flat) return;
  const rng = mulberry32((M.seed ^ 0x5ec0a11) >>> 0), R = (a, b) => a + rng() * (b - a);   // 생성 난수(rng)와 별개
  const n = HALF >= 3000 ? 10 : HALF >= 1500 ? 6 : 3;
  let minD = HALF >= 3000 ? 1500 : HALF >= 1500 ? 950 : 250;
  const roadMax = HALF >= 1500 ? 80 : 40, cands = [], _b = [];
  // 패드(7×7m) 밑 지면이 평평한지: 높이 차 0.42m 미만이면 패드 윗면(최고점 + 0.14)까지 어느 쪽에서도 걸어 오를 수 있다
  const flatTop = (x, z) => { let lo = 1e9, hi = -1e9; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const h = heightAt(x + i * 1.9, z + j * 1.9); if (h < lo) lo = h; if (h > hi) hi = h; } return hi - lo < 0.42 && lo > 2.2 ? hi : null; };
  for (let t = 0; t < 8000 && cands.length < n * 30; t++) {
    const x = R(-HALF * 0.82, HALF * 0.82), z = R(-HALF * 0.82, HALF * 0.82);
    if (heightAt(x, z) < 2.5) continue;
    const rd = w.roadDist(x, z); if (rd < 10 || rd > roadMax) continue;              // 길에서 보이고 차로 닿는 곳
    if (K.RV && K.riverDist(x, z) < (K.RV.w || 10) + 12) continue;
    if (K.poisNear(x, z).some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 10)) continue;
    if (!K.footprintFree(x - 5, z - 5, x + 5, z + 5, 2)) continue;
    queryBoxes(x - 6, z - 6, x + 6, z + 6, _b); if (_b.some((b) => b.x1 > x - 6 && b.x0 < x + 6 && b.z1 > z - 6 && b.z0 < z + 6)) continue;   // 나무·바위·담
    const top = flatTop(x, z); if (top === null) continue;
    cands.push([x, z, top]);
  }
  // 서로 minD 넘게 떨어진 곳부터 (모자라면 간격을 줄여 가며)
  const pts = [];
  for (let pass = 0; pass < 10 && pts.length < n; pass++, minD *= 0.82)
    for (const c of cands) { if (pts.length >= n) break; if (pts.includes(c)) continue; if (pts.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) >= minD)) pts.push(c); }
  const C = { pad: 0x8e8b84, edge: 0x67645e, steel: 0x9ba1a6, steelD: 0x6d737a, red: 0xb5412f, white: 0xd8dad5, box: 0x30363c, boxL: 0x48505a, cab: 0x56634f, yel: 0xd8a21e };
  const up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
  const rod = (B, ax, ay, az, bx, by, bz, r, col) => {
    _d.set(bx - ax, by - ay, bz - az); const L = _d.length(); _d.normalize();
    const g = new THREE.CylinderGeometry(r, r, L, 5, 1, true), m = new THREE.Matrix4().compose(_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), _q.setFromUnitVectors(up, _d), one);
    B.geo(g, m, col); g.dispose();
  };
  pts.forEach(([x, z, top], id) => {
    const B = K.getBatch(x, z), y = top + 0.14, H = 22;
    // 단말기는 가장 가까운 길 쪽을 본다 (90° 단위 — 충돌 상자가 축 정렬)
    let fa = 0, fb = 1e9; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, d = w.roadDist(x + Math.cos(a) * 14, z + Math.sin(a) * 14); if (d < fb) { fb = d; fa = a; } }
    fa = Math.round(fa / (Math.PI / 2)) * (Math.PI / 2);
    const fx = Math.round(Math.cos(fa)), fz = Math.round(Math.sin(fa)), px = fz, pz = -fx;   // (p, 위, f) 오른손 좌표계
    // 콘크리트 패드 + 둘레
    K.addBox(x - 3.5, top - 0.8, z - 3.5, x + 3.5, y, z + 3.5, C.pad, { nav: true, kind: 'tower' });
    B.box(x - 3.62, top - 0.8, z - 3.62, x + 3.62, y - 0.05, z + 3.62, C.edge);
    // 철탑: 기울어진 다리 4개 + 단마다 가로대·X자 사선 (위 두 단은 빨강)
    const LB = 2.3, LT = 0.55, hw = (h) => lerp(LB, LT, h / H), NL = 6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      rod(B, x + sx * LB, y, z + sz * LB, x + sx * LT, y + H, z + sz * LT, 0.13, C.steel);
      B.box(x + sx * LB - 0.32, y, z + sz * LB - 0.32, x + sx * LB + 0.32, y + 0.22, z + sz * LB + 0.32, C.steelD);
      const a3 = hw(3.2), lo = Math.min(sx * LB, sx * a3), hi = Math.max(sx * LB, sx * a3), lo2 = Math.min(sz * LB, sz * a3), hi2 = Math.max(sz * LB, sz * a3);
      K.addCollider(x + lo - 0.16, y, z + lo2 - 0.16, x + hi + 0.16, y + 3.2, z + hi2 + 0.16, { kind: 'tower' });
    }
    for (let k = 1; k <= NL; k++) {
      const h0 = (k - 1) / NL * H, h1 = k / NL * H, a0 = hw(h0), a1 = hw(h1), col = k >= NL - 1 ? C.red : C.steel, t = 0.06;
      for (const s of [-1, 1]) {
        B.box(x - a1, y + h1 - t, z + s * a1 - t, x + a1, y + h1 + t, z + s * a1 + t, col); B.box(x + s * a1 - t, y + h1 - t, z - a1, x + s * a1 + t, y + h1 + t, z + a1, col);
        rod(B, x - a0, y + h0, z + s * a0, x + a1, y + h1, z + s * a1, 0.045, C.steelD); rod(B, x + a0, y + h0, z + s * a0, x - a1, y + h1, z + s * a1, 0.045, C.steelD);
        rod(B, x + s * a0, y + h0, z - a0, x + s * a1, y + h1, z + a1, 0.045, C.steelD); rod(B, x + s * a0, y + h0, z + a0, x + s * a1, y + h1, z - a1, 0.045, C.steelD);
      }
    }
    // 꼭대기: 작업대·난간 · 돛대(빨강 띠) · 패널 안테나 3 · 접시 안테나 2 (길 쪽과 그 반대)
    B.box(x - 1.0, y + H - 0.05, z - 1.0, x + 1.0, y + H + 0.16, z + 1.0, C.steelD);
    for (const s of [-1, 1]) { B.box(x - 1.0, y + H + 0.9, z + s * 0.97 - 0.03, x + 1.0, y + H + 0.96, z + s * 0.97 + 0.03, C.steel); B.box(x + s * 0.97 - 0.03, y + H + 0.9, z - 1.0, x + s * 0.97 + 0.03, y + H + 0.96, z + 1.0, C.steel); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(x + sx * 0.97 - 0.03, y + H + 0.16, z + sz * 0.97 - 0.03, x + sx * 0.97 + 0.03, y + H + 0.96, z + sz * 0.97 + 0.03, C.steel);
    rod(B, x, y + H, z, x, y + H + 3, z, 0.1, C.white); rod(B, x, y + H + 3, z, x, y + H + 4.6, z, 0.09, C.red); rod(B, x, y + H + 4.6, z, x, y + H + 6, z, 0.08, C.white);
    for (let k = 0; k < 3; k++) { const a = fa + k * TAU / 3 + 0.5, ax = x + Math.cos(a) * 0.42, az = z + Math.sin(a) * 0.42, tx = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 0.1 : 0.32, tz = tx === 0.1 ? 0.32 : 0.1; B.box(ax - tx, y + H + 1.2, az - tz, ax + tx, y + H + 2.9, az + tz, C.white); }
    for (const s of [1, -1]) {
      const dx = fx * s, dz = fz * s, cx = x + dx * (hw(H - 3) + 0.35), cz = z + dz * (hw(H - 3) + 0.35);
      const g = new THREE.CylinderGeometry(0.72, 0.16, 0.42, 14, 1, true), m = new THREE.Matrix4().compose(_p.set(cx, y + H - 3, cz), _q.setFromUnitVectors(up, _d.set(dx, 0.12, dz).normalize()), one);
      B.geo(g, m, C.white); g.dispose();
      rod(B, x + dx * hw(H - 3), y + H - 3, z + dz * hw(H - 3), cx, y + H - 3, cz, 0.07, C.steelD);
    }
    // 단말기(키오스크): 아래 몸통 + 위 화면 상자 + 차양 + 노란 경고 띠 — 화면(빛나는 판)은 경기마다 Recall.init 이 붙인다
    const cx = x + fx * 2.75, cz = z + fz * 2.75;
    const lbox = (u, v, wv, su, sv, sw, col, tilt = 0) => { const g = new THREE.BoxGeometry(su, sv, sw), m = new THREE.Matrix4().makeBasis(new THREE.Vector3(px, 0, pz), up, new THREE.Vector3(fx, 0, fz)); if (tilt) m.multiply(new THREE.Matrix4().makeRotationX(tilt)); m.setPosition(cx + px * u + fx * wv, y + v, cz + pz * u + fz * wv); B.geo(g, m, col); g.dispose(); };
    lbox(0, 0.5, 0, 1.1, 1.0, 0.55, C.box); lbox(0, 1.02, 0.12, 1.06, 0.09, 0.38, C.boxL, 0.38); lbox(0, 1.36, -0.1, 0.98, 0.66, 0.34, C.box);
    lbox(0, 1.73, -0.02, 1.1, 0.06, 0.52, C.boxL); lbox(0, 0.12, 0.28, 1.12, 0.06, 0.02, C.yel); lbox(0, 0.3, 0.28, 1.12, 0.06, 0.02, C.yel);
    const ex = Math.abs(px) * 0.56 + Math.abs(fx) * 0.3, ez = Math.abs(pz) * 0.56 + Math.abs(fz) * 0.3;
    K.addCollider(cx - ex, y, cz - ez, cx + ex, y + 1.76, cz + ez, { kind: 'tower' });
    // 뒤쪽 배전함 + 단말기까지 이어진 전선관
    const bx = x - fx * 2.85, bz = z - fz * 2.85, qx = Math.abs(px) * 0.48 + Math.abs(fx) * 0.27, qz = Math.abs(pz) * 0.48 + Math.abs(fz) * 0.27;
    K.addBox(bx - qx, y, bz - qz, bx + qx, y + 1.3, bz + qz, C.cab, { kind: 'tower' });
    B.box(Math.min(bx, cx) - 0.09 * Math.abs(px), y, Math.min(bz, cz) - 0.09 * Math.abs(pz), Math.max(bx, cx) + 0.09 * Math.abs(px), y + 0.12, Math.max(bz, cz) + 0.09 * Math.abs(pz), C.edge);
    w.towers.push({ id, x, z, y, h: H, fx, fz, cx, cz, ix: cx + fx * 0.95, iz: cz + fz * 0.95, flashT: -99 });
  });
}

const Recall = (() => {
  let scene = null, planes = [], fx = [], cards = [], upT = 0, closedSaid = false, beamPool = [];
  const charById = (id) => CHARS.find((c) => c.id === id) || null;
  const enabled = () => !!(W && W.towers && W.towers.length && G.teams && G.teamSize > 1 && !G.dm && !G.training);
  // 자기장 절반 단계까지 (작은 맵 6단계 → 3단계 축소가 끝나면 마감, 대형 맵 8단계 → 4단계)
  const cutPhase = () => Math.floor(((Zone.phases && Zone.phases.length) || 6) / 2);
  const open = () => enabled() && Zone.phase < cutPhase();
  const recallable = (m) => !!m && !m.alive && (m.recallN || 0) < RECALL.maxN && !!G.teams[m.team] && teamAlive(G.teams[m.team]);
  const validCards = (c) => (c.cards || []).filter((id, i, a) => { if (a.indexOf(id) !== i) return false; const m = charById(id); return recallable(m) && m.team === c.team; });
  const nameOf = (id) => { const m = charById(id); return !m ? '?' : m.isPlayer ? '나' : m.name; };
  const names = (ids) => ids.map(nameOf).join(', ');

  // ---------- 경기 시작·끝 ----------
  let scrTex = null;
  function screenTex() {
    if (scrTex) return scrTex;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 154; const g = cv.getContext('2d');
    g.fillStyle = '#0b1f2c'; g.fillRect(0, 0, 256, 154); g.strokeStyle = '#8fe8ff'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 142);
    // 안테나 그림 (전파 호 3개)
    g.lineWidth = 5; g.beginPath(); g.moveTo(52, 112); g.lineTo(52, 60); g.stroke(); g.beginPath(); g.arc(52, 56, 6, 0, TAU); g.fillStyle = '#8fe8ff'; g.fill();
    for (let i = 1; i <= 3; i++) { g.lineWidth = 3.5; g.beginPath(); g.arc(52, 56, 8 + i * 9, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke(); }
    g.fillStyle = '#e8fbff'; g.font = "700 40px 'Saira Condensed', sans-serif"; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('RECALL', 96, 58);
    g.font = "600 20px 'IBM Plex Sans KR', sans-serif"; g.fillStyle = '#9fd6e6'; g.fillText('카드를 등록하세요', 96, 100);
    scrTex = new THREE.CanvasTexture(cv); return scrTex;
  }
  function init(sc) {
    scene = sc; planes = []; fx = []; cards = []; upT = 0; closedSaid = false; beamPool = [];
    const sg = new THREE.PlaneGeometry(0.8, 0.48), bg = new THREE.SphereGeometry(0.34, 10, 8), cg = new THREE.CylinderGeometry(0.55, 0.55, 1, 14, 1, true);
    for (const tw of (W && W.towers) || []) {
      const scr = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: screenTex(), color: 0xbff3ff }));
      scr.position.set(tw.cx - tw.fx * 0.1 + tw.fx * 0.176, tw.y + 1.37, tw.cz - tw.fz * 0.1 + tw.fz * 0.176); scr.rotation.y = Math.atan2(tw.fx, tw.fz);
      const bea = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xff3a24 })); bea.position.set(tw.x, tw.y + tw.h + 6.3, tw.z);
      const beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      beam.visible = false; beam.renderOrder = 6;
      sc.add(scr); sc.add(bea); sc.add(beam); fx.push({ tw, scr, bea, beam });
    }
  }
  function dispose() { for (const pl of planes) if (pl.mesh.parent) pl.mesh.parent.remove(pl.mesh); planes = []; fx = []; cards = []; beamPool = []; scene = null; }

  // ---------- 카드 ----------
  function track(it) { cards.push(it); }
  // 같이 하기: 누가 어떤 카드를 들고 있는지 다른 기기에도 (팀 HUD·관전 안내용) — 들고 있는 목록이 바뀔 때마다
  function held(c) { if (G.net && Net.mine(c)) Net.ev({ k: 'rc', s: 'hd', by: c.id, v: (c.cards || []).slice() }); }
  const cardName = (it) => (it.inst ? nameOf(it.inst.who) : '?');
  const canTake = (c, it) => enabled() && !!it.inst && it.inst.team === c.team && c.alive && !c.knocked;
  const useful = (it) => recallable(charById(it.inst && it.inst.who));
  // 탈락(주인 기기의 killChar): 내 카드 + 들고 있던 팀원 카드를 그 자리에 떨어뜨린다 (팀 전멸·마감이면 없음)
  function onDeath(t) {
    if (!enabled()) return;
    const had = validCards(t); if (t.cards && t.cards.length) { t.cards = []; held(t); } if (t.recall) cancel(t, true);
    if (!teamHasStanding(t.team) || !open()) return;
    const sc = G.scene, put = (id, k) => { const a = k * 2.1 + Math.random(), r = 0.5 + Math.random() * 0.5, x = t.pos.x + Math.cos(a) * r, z = t.pos.z + Math.sin(a) * r; spawnItem(sc, 'rcard', 1, x, groundAt(x, z, t.pos.y + 0.5), z, { who: id, team: t.team, t: Math.round(G.time * 10) / 10 }); };
    const mine = (t.recallN || 0) < RECALL.maxN; if (mine) put(t.id, 0);
    had.forEach((id, i) => put(id, i + 1));
    if (t.isPlayer) HUD.toast(mine ? '리콜 카드를 떨어뜨렸습니다 — 팀원이 리콜 타워에 등록하면 수송기로 복귀합니다' : '이미 한 번 리콜되어 더는 복귀할 수 없습니다', 'info');
    else if (mine && G.player && sameTeam(G.player, t) && G.player.alive) HUD.toast(`${t.name}의 리콜 카드를 주워 리콜 타워에 등록하세요`, 'info');
  }
  // 봇: 주울 만한 팀원 카드 (다른 봇이 가지러 가는 중이면 제외)
  function nearCard(c, R) {
    let best = null, bd = R;
    for (const it of cards) {
      if (!it.alive || !canTake(c, it) || !useful(it) || Math.abs(it.y - c.pos.y) > 3) continue;
      const o = it.claim; if (o && o !== c && o.alive && !o.knocked && o.brain && o.brain.lootTarget === it) continue;
      const d = Math.hypot(it.x - c.pos.x, it.z - c.pos.z); if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // ---------- 타워 ----------
  function towerAt(c) {
    if (!W || !W.towers) return null;
    for (const tw of W.towers) if (Math.hypot(tw.ix - c.pos.x, tw.iz - c.pos.z) < RECALL.reach && Math.abs(tw.y - c.pos.y) < 1.6) return tw;
    return null;
  }
  // 봇이 갈 타워: 가까운 순 — 지금 안전구역 밖이면 맵 반 변만큼, 다음 구역 밖이면 그 1/4만큼 멀게 친다
  function bestTower(c, skip) {
    let best = null, bs = 1e9; const zc = Zone.cur, zn = Zone.next;
    for (const tw of W.towers) {
      if (skip && skip.has(tw)) continue;
      const s = Math.hypot(tw.x - c.pos.x, tw.z - c.pos.z) + (zc && !Zone.inside(tw.x, tw.z, zc, 0) ? HALF : zn && !Zone.inside(tw.x, tw.z, zn, 0) ? HALF * 0.25 : 0);
      if (s < bs) { bs = s; best = tw; }
    }
    return best;
  }
  // 플레이어 안내 문구: 타워 앞이면 {tw, text, act}
  function promptFor(p) {
    if (!enabled()) return null;
    const tw = towerAt(p); if (!tw) return null;
    if (!open()) return { tw, text: `리콜 타워 · 마감 (자기장 ${cutPhase() + 1}단계부터는 리콜할 수 없습니다)` };
    const ids = validCards(p);
    if (!ids.length) return { tw, text: '리콜 타워 · 탈락한 팀원의 리콜 카드가 있어야 등록할 수 있습니다' };
    return { tw, act: true, text: `${IS_TOUCH ? '리콜 버튼' : 'F'} · ${names(ids)} 리콜 등록 (${RECALL.regT}초)` };
  }

  // ---------- 등록 (단말기 앞에서 8초) ----------
  function start(c, tw) {
    if (!open() || !tw || c.recall || c.revive || !c.alive || c.knocked || c.veh || c.mode !== 'ground') return false;
    const ids = validCards(c); if (!ids.length) return false;
    c.recall = { tw, t: 0, total: RECALL.regT };
    c.heal = null; c.rl = null; c.aiming = false; c.sprint = false; c.burstQ = 0; c.throwMode = null; c.vel.x = c.vel.z = 0;
    if (G.net) Net.ev({ k: 'rc', s: 'st', by: c.id, tw: tw.id, on: 1 });
    if (c.isPlayer) { HUD.toast(`리콜 등록 중 — ${names(ids)} · 움직이면 취소됩니다`, 'info'); Audio.recall('start'); }
    return true;
  }
  function cancel(c, quiet) {
    const r = c.recall; if (!r) return;
    c.recall = null;
    if (G.net && Net.mine(c)) Net.ev({ k: 'rc', s: 'st', by: c.id, tw: r.tw.id, on: 0 });
    if (!quiet && c.isPlayer) HUD.toast('리콜 등록이 중단되었습니다', 'warn');
  }
  // 주인 기기에서 매 프레임 (updateCharTimers)
  function updateReg(c, dt) {
    const r = c.recall, tw = r.tw;
    if (!c.alive || c.knocked || c.veh || c.mode !== 'ground' || !open() || Math.hypot(tw.ix - c.pos.x, tw.iz - c.pos.z) > RECALL.reach + 0.8 || !validCards(c).length) { cancel(c); return; }
    r.t += dt; if (r.t < r.total) return;
    const ids = validCards(c);
    c.recall = null; c.cards = (c.cards || []).filter((id) => !ids.includes(id)); held(c);
    if (G.net) Net.ev({ k: 'rc', s: 'st', by: c.id, tw: tw.id, on: 0 });
    if (c.isPlayer) Audio.recall('done');
    request(c, ids, tw);
  }
  // 등록 완료 → 방장이 확인 (혼자면 바로)
  function request(by, ids, tw) {
    if (G.net && !Net.isHost()) { Net.ev({ k: 'rc', s: 'reg', by: by.id, v: ids, tw: tw.id }, Net.state.cfg.host); if (by.isPlayer) HUD.toast('리콜 요청 중…', 'info'); return; }
    approve(by, ids, tw.id, null);
  }
  function approve(by, ids, twi, from) {
    const tw = W.towers[twi], ok = tw && by && open() ? ids.filter((id) => { const m = charById(id); return recallable(m) && m.team === by.team; }) : [];
    if (!ok.length) { if (from && G.net) Net.ev({ k: 'rc', s: 'no', by: by ? by.id : -1 }, from); else if (by && by.isPlayer) { HUD.toast('리콜 실패 — 이미 복귀했거나 마감되었습니다', 'warn'); Audio.recall('fail'); } return; }
    const e = { k: 'rc', s: 'go', by: by.id, v: ok, tw: twi, a: Math.round(Math.random() * TAU * 1000) / 1000, t0: Math.round(G.time * 100) / 100 };
    go(e); if (G.net) Net.ev(e);
  }
  // 모든 기기: 수송기를 띄우고, 내 기기 캐릭터면 되살려 태운다
  function go(e) {
    const tw = W && W.towers[e.tw]; if (!tw || !scene) return;
    const by = charById(e.by), pl = makePlane(tw, e.a, Math.max(0, G.time - (e.t0 || G.time)));
    for (const id of e.v) {
      const m = charById(id); if (!m) continue;
      m.recallN = (m.recallN || 0) + 1; m.rplane = pl;
      for (const c of CHARS) if (c.cards && c.cards.length) c.cards = c.cards.filter((x) => x !== id);
      if (Net.mine(m)) revive(m, pl, by, tw); else m.root.visible = false;
    }
    tw.flashT = G.time + 4;
    const p = G.player;
    if (p && by && p.team === by.team && !e.v.includes(p.id)) { HUD.toast(`${by.isPlayer ? '' : by.name + ': '}${names(e.v)} 리콜 — 수송기가 리콜 타워 쪽으로 옵니다`, 'ok'); if (!by.isPlayer) Audio.recall('done'); }
    if (!G.net || Net.isHost()) upkeep();
  }
  function revive(m, pl, by, tw) {
    m.alive = true; m.hp = 100; m.boost = 0; m.knocked = false; m.knockN = 0; m.knockedBy = null; m.revivedBy = null; m.revive = null; m.recall = null; m.cards = [];
    m.deathTime = 0; m.place = 0; m.life = (m.life || 0) + 1; m.lastAttacker = null; m.lastDamageT = -99; m.outsideZoneT = 0;
    m.heal = null; m.rl = null; m.cycle = null; m.throwMode = null; m.punch = null; m.vault = null; m.rollT = 0; m.aiming = false; m.sprint = false; m.fireHold = false; m.burstQ = 0;
    m.mode = 'plane'; m.rplane = pl; m.stance = 'stand'; m.vel.set(0, 0, 0); m.pos.copy(pl.pos); m.onGround = false; m.root.visible = false;
    Object.assign(m.anim, { dead: 0, land: 0, fall: 0, chute: 0, prone: 0, crouch: 0, flinch: 0 });
    // 기본 장비: 권총(장전) + 9mm 30발 + 붕대 2개
    const K = RECALL.kit, inv = m.inv; inv.weapons = [null, null, newWeapon(K.gun, ITEMS[K.gun].mag)]; inv.cur = 2;
    inv.items = Object.assign({ [ITEMS[K.gun].ammo]: K.ammo }, K.items); inv.gear = { helmet: null, vest: null, bag: null };
    m.setVisibleGear();
    if (m.isPlayer) {
      G.spec = null; Audio.plane(true); Audio.wind(0.1); HUD.setLoot([]); HUD.refreshInventory();
      HUD.toast(`${by && !by.isPlayer ? by.name + '이(가) ' : ''}리콜했습니다! 수송기에서 원하는 곳에 강하하세요 (권총·붕대 지급)`, 'ok');
      return;
    }
    const b = m.brain || new Brain(m, 'normal');
    b.state = 'LANDING'; b.stateT = 0; b.thinkT = 0.3; b.goal = null; b.path = null; b.wantPath = null; b.aware.clear(); b.target = null;
    b.lootTarget = null; b.reviveTgt = null; b.cover = null; b.investigate = null; b.vehTarget = null; b.rcTower = null; b.recoverUntil = 0; b.building = null;
    b.followJump = false; b.chuteH = rnd(80, 125);
    // 등록한 팀원(없으면 타워) 근처에 내린다 — 수송기가 타워 위를 지나기 조금 전에 뛰어 활강
    const o = by && by.alive && by.mode === 'ground' ? by.pos : tw; let tg = null;
    for (let k = 0; k < 16 && !tg; k++) { const a = Math.random() * TAU, d = rnd(8, 22), x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d; if (Nav.isFree(x, z) && heightAt(x, z) > 0.8 && groundAt(x, z, 9999) - heightAt(x, z) < 1) tg = { x, z }; }
    b.dropTarget = tg || { x: tw.ix, z: tw.iz }; b.jumpAt = pl.lead - rnd(1.5, 4.5);
  }

  // ---------- 리콜 수송기 (타워 위를 지나간다) ----------
  function makePlane(tw, a, t0) {
    const PC = MAPS[SETTINGS.map].plane || { L: 470, speed: 38, alt: 300, off: 110 };
    const sp = PC.speed, dx = Math.cos(a), dz = Math.sin(a), L0 = sp * RECALL.lead, L1 = sp * (RECALL.lead + 12);
    const pl = { ax: tw.x - dx * L0, az: tw.z - dz * L0, bx: tw.x + dx * L1, bz: tw.z + dz * L1, dx, dz, t: t0, L0, len: L0 + L1, lead: RECALL.lead, speed: sp, alt: Math.round(PC.alt * 0.75), active: true, pos: new THREE.Vector3(), mesh: buildPlane(), tw, rc: true };
    pl.pos.set(pl.ax + dx * sp * t0, pl.alt, pl.az + dz * sp * t0); pl.mesh.position.copy(pl.pos); pl.mesh.rotation.y = Math.atan2(dx, dz);
    scene.add(pl.mesh); planes.push(pl);
    return pl;
  }
  function updatePlane(pl, dt) {
    if (!pl.active) return;
    pl.t += dt; const d = pl.t * pl.speed;
    pl.pos.set(pl.ax + pl.dx * d, pl.alt, pl.az + pl.dz * d); pl.mesh.position.copy(pl.pos);
    for (const pr of pl.mesh.userData.props) pr.rotation.z += dt * 30;
    const ahead = d + 60, out = d > pl.L0 && !overIsland(pl.ax + pl.dx * ahead, pl.az + pl.dz * ahead);
    for (const c of CHARS) {
      if (c.rplane !== pl || c.mode !== 'plane' || !c.alive || !Net.mine(c)) continue;
      c.pos.copy(pl.pos);
      if (out || d > pl.len - 30) { if (c.isPlayer) HUD.toast('수송기가 섬을 벗어나 자동 강하합니다', 'warn'); jumpOut(c); }
      else if (!c.isPlayer && c.brain && pl.t >= c.brain.jumpAt && overIsland(pl.pos.x, pl.pos.z)) jumpOut(c);
    }
    if (d > pl.len + 400) { pl.active = false; if (pl.mesh.parent) pl.mesh.parent.remove(pl.mesh); }
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    if (!enabled() || !scene) return;
    for (const pl of planes) updatePlane(pl, dt);
    if (planes.length > 4) planes = planes.filter((pl) => pl.active);
    for (const c of CHARS) { if (c.recall && c.recall.net) c.recall.t += dt; if (c.rplane && c.alive && c.mode !== 'plane') c.rplane = null; }   // 다른 기기 캐릭터는 되살아난 상태가 오기 전까지 rplane 유지
    upT -= dt; if (upT <= 0) { upT = 0.5; upkeep(); }
    // 타워: 꼭대기 경고등 깜빡임 · 화면 색(대기 하늘색 / 등록 중 초록 / 마감 회색) · 등록 중이면 하늘로 빛기둥
    const on = open(), tb = G.time % 1.6 < 0.22;
    for (const f of fx) {
      let act = null; for (const c of CHARS) if (c.recall && c.recall.tw === f.tw && c.alive) { act = c; break; }
      f.bea.material.color.setHex(tb ? 0xff3a24 : 0x4a0c08);
      f.scr.material.color.setHex(!on ? 0x50585c : act ? (Math.floor(G.time * 4) % 2 ? 0x9dff9a : 0x5ad66a) : 0xbff3ff);
      const flash = G.time < f.tw.flashT, k = act ? clamp(act.recall.t / act.recall.total, 0, 1) : 0;
      f.beam.visible = !!act || flash;
      if (f.beam.visible) { const hgt = flash ? 260 : 30 + k * 200, r = flash ? 1.2 + Math.sin(G.time * 9) * 0.25 : 0.45 + k * 0.4; f.beam.scale.set(r, hgt, r); f.beam.position.set(f.tw.x, f.tw.y + f.tw.h + 6 + hgt / 2, f.tw.z); f.beam.material.opacity = flash ? 0.5 * clamp((f.tw.flashT - G.time) / 1.5, 0, 1) : 0.22 + k * 0.2; }
    }
    // 내 팀원의 카드: 바닥에서 위로 하늘색 빛기둥 (내 팀에게만 보임)
    const p = G.player; let bi = 0;
    if (p) for (const it of cards) {
      if (!it.alive || !it.inst || it.inst.team !== p.team || Math.hypot(it.x - G.camera.position.x, it.z - G.camera.position.z) > 400) continue;
      let b = beamPool[bi]; if (!b) { b = beamPool[bi] = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); scene.add(b); }
      b.visible = true; b.scale.set(1, 14, 1); b.position.set(it.x, it.y + 7, it.z); b.material.opacity = 0.32 + Math.sin(G.time * 4 + it.x) * 0.14; bi++;
    }
    for (; bi < beamPool.length; bi++) beamPool[bi].visible = false;
  }
  // 0.5초마다: 마감 알림 · 쓸모없어진 카드 정리 (방장만 — 지우면 다른 기기에도 알림)
  function upkeep() {
    cards = cards.filter((it) => it.alive);
    const on = open();
    if (!on && !closedSaid) { closedSaid = true; const p = G.player; if (p && teamMembers(p).some((m) => recallable(m) || (m.cards && m.cards.length))) HUD.toast('리콜 마감 — 이제 탈락한 팀원을 리콜할 수 없습니다', 'warn'); }
    if (G.net && !Net.isHost()) return;
    for (const it of cards.slice()) if (!on || !useful(it) || G.time - (it.inst.t || 0) > RECALL.cardLife) removeItem(it);
  }

  // ---------- 같이 하기 ----------
  function onNet(e, from) {
    const c = charById(e.by);
    if (e.s === 'reg') { if (Net.isHost()) approve(c, e.v || [], e.tw, from); }
    else if (e.s === 'go') go(e);
    else if (e.s === 'st') { if (c && !Net.mine(c)) { const tw = W && W.towers[e.tw]; c.recall = e.on && tw ? { tw, t: 0, total: RECALL.regT, net: true } : null; } }
    else if (e.s === 'hd') { if (c && !Net.mine(c)) c.cards = (e.v || []).slice(); }
    else if (e.s === 'no') { if (c && c.isPlayer) { HUD.toast('리콜 실패 — 이미 복귀했거나 마감되었습니다', 'warn'); Audio.recall('fail'); } }
  }

  // ---------- HUD ----------
  // 팀 패널 아래 한 줄: 들고 있는 카드 · 떨어진 카드 · 등록 중 · 복귀 중 · 마감
  function hudLine(p) {
    if (!enabled()) return '';
    const ms = teamMembers(p), mine = validCards(p);
    if (mine.length && open()) { let d = 1e9; for (const tw of W.towers) d = Math.min(d, Math.hypot(tw.x - p.pos.x, tw.z - p.pos.z)); return `리콜 카드 ${names(mine)} · 가까운 타워 ${Math.round(d)}m`; }
    for (const m of ms) if (m.recall && m.alive) return `${m.isPlayer ? '나' : m.name} 리콜 등록 중 ${Math.ceil(Math.max(0, m.recall.total - m.recall.t))}초`;
    for (const m of ms) if (m.alive && m.mode === 'plane' && m.rplane) return `${nameOf(m.id)} 수송기로 복귀 중`;
    if (!open()) return ms.some((m) => !m.alive && (m.recallN || 0) < RECALL.maxN) && teamAlive(G.teams[p.team]) ? '리콜 마감' : '';
    for (const it of cards) if (it.alive && it.inst.team === p.team && useful(it)) return `리콜 카드 바닥에 있음 · ${cardName(it)} (${Math.max(0, Math.ceil(RECALL.cardLife - (G.time - it.inst.t)))}초)`;
    for (const m of ms) if (m !== p && m.alive && validCards(m).length) return `${m.name}이(가) 리콜 카드를 가지고 있음`;
    return '';
  }
  // 관전 중인 나의 리콜 상황
  function specLine(p) {
    if (!enabled() || p.alive) return '';
    if ((p.recallN || 0) >= RECALL.maxN) return '리콜 불가 (이미 한 번 복귀)';
    if (!open()) return '리콜 마감';
    for (const m of teamMembers(p)) if (m.alive && m.recall) return `${m.name}이(가) 리콜 등록 중`;
    for (const m of teamMembers(p)) if (m !== p && m.alive && validCards(m).includes(p.id)) return `${m.name}이(가) 내 리콜 카드를 가지고 있음`;
    for (const it of cards) if (it.alive && it.inst.who === p.id) return `내 리콜 카드가 바닥에 있음 (${Math.max(0, Math.ceil(RECALL.cardLife - (G.time - it.inst.t)))}초)`;
    return '';
  }
  // 지도: 타워(안테나 표시, 마감이면 회색) · 내 팀 카드(깜빡이는 하늘색 마름모) · 리콜 수송기 경로
  function drawMap(ctx, toPx, opts) {
    if (!enabled()) return;
    const on = open(), s = opts.labels ? 8 : 6;
    for (const tw of W.towers) {
      const [x, y] = toPx(tw.x, tw.z);
      ctx.fillStyle = on ? '#2bb7d6' : '#6b7377'; ctx.strokeStyle = '#0b1a22'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.25); ctx.lineTo(x + s * 0.8, y + s * 0.75); ctx.lineTo(x - s * 0.8, y + s * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = on ? '#e6fbff' : '#c9cfd1'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x, y + s * 0.6); ctx.stroke();
      if (G.time < tw.flashT || CHARS.some((c) => c.recall && c.recall.tw === tw && c.alive)) { ctx.strokeStyle = '#7fe9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * (1.6 + (G.time * 2 % 1)), 0, TAU); ctx.stroke(); }
    }
    const p = G.player;
    if (p && Math.floor(G.time * 3) % 2) for (const it of cards) {
      if (!it.alive || it.inst.team !== p.team) continue;
      const [x, y] = toPx(it.x, it.z), r = opts.labels ? 6 : 5;
      ctx.fillStyle = '#7fe9ff'; ctx.strokeStyle = '#0b1a22'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const pl of planes) {
      if (!pl.active) continue;
      const [ax, ay] = toPx(pl.ax, pl.az), [bx, by] = toPx(pl.bx, pl.bz), [px2, py2] = toPx(pl.pos.x, pl.pos.z);
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(127,233,255,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#7fe9ff'; ctx.beginPath(); ctx.arc(px2, py2, 4, 0, TAU); ctx.fill();
    }
  }

  return { init, dispose, update, track, held, onDeath, nearCard, canTake, useful, cardName, validCards, towerAt, bestTower, promptFor, start, cancel, updateReg, onNet, hudLine, specLine, drawMap, open, enabled, cutPhase,
    get planes() { return planes; }, get cards() { return cards; } };
})();
