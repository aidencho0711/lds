// ============================================================
// 08_airdrop.js — 보급상자: 자기장 1~4단계 축소가 시작될 때마다 수송기가 다음 안전 구역 안에
//  상자를 떨어뜨린다. 낙하산 강하(약 30초) → 착지 → 주황 연막 → 상자 위에 보급 전용 무기·탄·3레벨 장비
//  AWM·MG3·SLR은 여기서만 나온다. 지도/미니맵에 위치 표시, 봇도 보고 찾아간다.
// ============================================================
const Airdrop = (() => {
  let scene = null, list = [], planes = [], lastKey = '', smokeTex = null;
  const FALL = 6.5, ALT = 210, PLANE_SPEED = 72;
  function tex() {
    if (smokeTex) return smokeTex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (smokeTex = new THREE.CanvasTexture(c));
  }
  function init(sc) { dispose(); scene = sc; list = []; planes = []; lastKey = ''; }
  function dispose() {
    if (scene) { for (const d of list) { scene.remove(d.obj); if (d.smoke) scene.remove(d.smoke.g); } for (const p of planes) scene.remove(p.mesh); }
    list = []; planes = []; scene = null; Audio.dropPlane(null);
  }
  // 상자 놓을 자리: 구역 안쪽, 육지, 지붕·물·급경사 제외
  function pickSpot(z) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r * 0.75;
      const x = clamp(z.x + Math.cos(a) * d, -HALF + 40, HALF - 40), zz = clamp(z.z + Math.sin(a) * d, -HALF + 40, HALF - 40);
      const h = heightAt(x, zz); if (h < WATER_Y + 0.6) continue;
      if (groundAt(x, zz, 999) > h + 0.3) continue;
      let ok = true; for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) { const h2 = heightAt(x + dx, zz + dz); if (Math.abs(h2 - h) > 0.9 || groundAt(x + dx, zz + dz, 999) > h2 + 0.3) ok = false; }
      if (ok) return { x, z: zz };
    }
    return null;
  }
  // remote: 같이 하기 파티원 기기 — 방장이 정한 자리·방향으로 보이기만 (내용물은 방장이 만들어 알려 준다)
  function launch(tx, tz, ang, remote) {
    if (!scene) return null;
    let spot = tx !== undefined ? { x: tx, z: tz } : pickSpot(Zone.next || Zone.cur || { x: 0, z: 0, r: 200 });
    if (!spot) return null;
    const a = ang !== undefined ? ang : Math.random() * TAU, dx = Math.cos(a), dz = Math.sin(a), L = 650;
    if (G.net && !remote) Net.ev({ k: 'air', x: spot.x, z: spot.z, a });
    const mesh = buildPlane(); mesh.scale.setScalar(0.8); scene.add(mesh);
    const pl = { x0: spot.x - dx * L, z0: spot.z - dz * L, dx, dz, t: 0, len: L * 2, dropAt: L, dropped: false, mesh, target: spot, remote: !!remote };
    mesh.rotation.y = Math.atan2(dx, dz);
    planes.push(pl);
    HUD.toast('보급품 수송기가 접근 중입니다', 'info');
    return pl;
  }
  function release(pl) {
    const obj = new THREE.Group(), crate = Models.crate(), chute = Models.canopy();
    obj.add(crate); obj.add(chute); chute.position.y = 0.85;
    const d = { x: pl.target.x, z: pl.target.z, y: ALT - 4, obj, crate, chute, landed: false, t: 0, items: [], smoke: null, gy: heightAt(pl.target.x, pl.target.z), remote: pl.remote };
    obj.position.set(d.x, d.y, d.z); scene.add(obj);
    list.push(d);
    HUD.toast('보급품이 투하되었습니다! 지도에 표시됩니다', 'warn');
  }
  function land(d) {
    d.landed = true; d.y = d.gy; d.obj.position.y = d.gy; d.landT = G.time;
    // 충돌 상자 (밟고 올라설 수 있음)
    const b = { x0: d.x - 0.62, x1: d.x + 0.62, y0: d.gy - 0.2, y1: d.gy + 0.84, z0: d.z - 0.5, z1: d.z + 0.5, soft: false, nav: false, _q: 0, kind: 'crate' };
    W.boxes.push(b);
    const i0 = clamp(Math.floor((b.x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((b.x1 + HALF) / CG), 0, CGN - 1), j0 = clamp(Math.floor((b.z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((b.z1 + HALF) / CG), 0, CGN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) gridPush(W.grid, j * CGN + i, b);
    // 내용물: 보급 전용 무기 1정 + 맞는 탄 + 장비·조준경·회복 (파티원 기기는 방장이 만든 것을 받는다)
    if (d.remote) { addSmoke(d); return; }
    const top = d.gy + 0.845, spots = [[-0.35, -0.2], [0.05, -0.22], [0.38, -0.2], [-0.35, 0.2], [0.05, 0.22], [0.38, 0.2], [-0.1, 0.0], [0.25, 0.0]];
    let k = 0; const put = (id, n, inst) => { const [ox, oz] = spots[k++ % spots.length]; d.items.push(spawnItem(scene, id, n, d.x + ox, top, d.z + oz, inst)); };
    const gun = weightedPick([['awm', 30], ['mg3', 30], ['slr', 40]]);
    put(gun, 1, newWeapon(gun, ITEMS[gun].mag));
    const am = ITEMS[gun].ammo; for (let i = 0; i < (gun === 'mg3' ? 3 : 2); i++) put(am, ITEMS[am].stack);
    if (Math.random() < 0.5) put('helm3', 1, { id: 'helm3', dur: ITEMS.helm3.dur });
    if (Math.random() < 0.5) put('vest3', 1, { id: 'vest3', dur: ITEMS.vest3.dur });
    if (Math.random() < 0.7) put(gun === 'awm' ? weightedPick([['x6', 60], ['x4', 40]]) : weightedPick([['x4', 40], ['x3', 35], ['x6', 25]]), 1);
    put(Math.random() < 0.55 ? 'medkit' : 'firstaid', 1);
    if (gun === 'slr' && Math.random() < 0.5) put('extmag', 1);
    addSmoke(d);
  }
  // 주황 연막 기둥
  function addSmoke(d) {
    const sg = new THREE.Group(), parts = [];
    for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), color: i % 3 ? 0xe2662a : 0xf08a3a, transparent: true, opacity: 0, depthWrite: false })); s.userData = { ph: Math.random(), sx: rnd(-0.6, 0.6), sz: rnd(-0.6, 0.6) }; sg.add(s); parts.push(s); }
    sg.position.set(d.x + 0.9, d.gy + 0.2, d.z); scene.add(sg); d.smoke = { g: sg, parts, t: 0 };
    Audio.impact({ x: d.x, y: d.gy, z: d.z }, false);
  }
  function update(dt) {
    if (!scene) return;
    // 자기장 1~4단계 축소 시작 → 투하
    const key = Zone.phase + ':' + Zone.state;
    if (key !== lastKey) { lastKey = key; if (Zone.state === 'shrink' && Zone.phase <= 3 && !(G.net && !Net.isHost())) launch(); }
    let nearPlane = null, nd = 1e9;
    for (let i = planes.length - 1; i >= 0; i--) {
      const p = planes[i]; p.t += dt; const s = p.t * PLANE_SPEED;
      const x = p.x0 + p.dx * s, z = p.z0 + p.dz * s; p.mesh.position.set(x, ALT, z);
      for (const pr of p.mesh.userData.props) pr.rotation.z += dt * 30;
      if (!p.dropped && s >= p.dropAt) { p.dropped = true; release(p); }
      if (s > p.len) { scene.remove(p.mesh); planes.splice(i, 1); continue; }
      const cam = G.camera.position, dd = Math.hypot(x - cam.x, z - cam.z); if (dd < nd) { nd = dd; nearPlane = p.mesh.position; }
    }
    Audio.dropPlane(nearPlane);
    for (const d of list) {
      if (!d.landed) {
        d.t += dt; d.y -= FALL * dt;
        d.obj.position.set(d.x + Math.sin(d.t * 0.7) * 0.25, d.y, d.z + Math.cos(d.t * 0.55) * 0.25); d.obj.rotation.y = Math.sin(d.t * 0.3) * 0.15;
        if (d.y <= d.gy) { d.obj.position.set(d.x, d.gy, d.z); d.obj.rotation.y = 0; land(d); }
      } else {
        // 낙하산 접힘
        if (d.chute.visible) { const k = clamp((G.time - d.landT) / 1.6, 0, 1); d.chute.scale.set(1 + k * 0.4, Math.max(0.02, 1 - k), 1 + k * 0.4); d.chute.position.y = 0.85 - k * 0.6; if (k >= 1) d.chute.visible = false; }
        const s = d.smoke; if (s) {
          s.t += dt; const life = 40, fade = s.t > life - 6 ? Math.max(0, (life - s.t) / 6) : 1;
          for (const p of s.parts) { const u = p.userData, ph = (u.ph + s.t * 0.12) % 1; p.position.set(u.sx * (0.3 + ph * 3) + ph * 2.5, ph * 16, u.sz * (0.3 + ph * 3)); p.scale.setScalar(1.2 + ph * 5); p.material.opacity = Math.min(1, s.t / 1.5) * fade * (1 - ph) * 0.85; }
          if (s.t > life) { scene.remove(s.g); d.smoke = null; }
        }
      }
    }
  }
  function remaining(d) { return d.items.filter((it) => it.alive).length; }
  // 봇용: 가까운 착지 상자(아직 무기가 남아 있음)
  function nearest(x, z, r) {
    let best = null, bd = r;
    for (const d of list) { if (!d.landed || !d.items.some((it) => it.alive && ITEMS[it.id].type === 'weapon')) continue; const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  function markers() { return list.filter((d) => !d.landed || remaining(d) > 0 || (d.remote && G.time - d.landT < 90)).map((d) => ({ x: d.x, z: d.z, falling: !d.landed })); }
  return { init, dispose, update, launch, nearest, markers, get list() { return list; }, get planes() { return planes; } };
})();
