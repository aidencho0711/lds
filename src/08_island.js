// ============================================================
// 08_island.js — 스타트 섬 (v21)
//  배틀로얄(일반·랭크·하드코어, 온라인·AI 매칭 모두) 시작 전 25초: 사람·봇 모두 작은 섬에 모여 있다가 수송기에 탄다
//  · 섬은 지도 한가운데 1100m 하늘에 띄운 섬 + 둘레 바다. 카메라 시야(최대 840m)보다 높아 진짜 지도는 보이지 않는다
//  · 모든 피해 없음 (06_combat.js applyDamage) · 섬 밖으로 못 나감 (04_character.js collideChar → Island.clamp)
//  · 머리 위 표시: 사람은 이름 + 칭호, 봇은 이름 + 봇 난이도 (#islandTags)
//  · 광장 둘레의 총은 주워서 쏴 볼 수 있다 (피해 없음). 수송기에 탈 때 가방·무기·장비는 비우고 체력은 100
//  · 같이 하기·온라인 매칭: 방장이 남은 시간을 보내고(w.isl), 방장 섬이 끝나면('isl' 사건) 모두 수송기로.
//    방장은 아직 연결되지 않은 사람이 있으면 최대 7초 더 기다린다
// ============================================================
const Island = (() => {
  const DUR = 25, EXTRA = 7, Y0 = 1100, R = 40;   // 시간(초) · 연결 기다림(초) · 높이 · 걸을 수 있는 반지름
  let I = null;   // { x, z, r, left, grp, boxes, cells, items, tags, rand }

  // ---------- 충돌 박스 (월드 격자에 끼워 넣고, 끝나면 뺀다) ----------
  function box(x0, y0, z0, x1, y1, z1) {
    const b = { x0, y0, z0, x1, y1, z1, soft: false, nav: false, _q: 0, kind: 'solid', isl: true };
    W.boxes.push(b); I.boxes.push(b);
    const i0 = clamp(Math.floor((x0 + HALF) / CG), 0, CGN - 1), i1 = clamp(Math.floor((x1 + HALF) / CG), 0, CGN - 1);
    const j0 = clamp(Math.floor((z0 + HALF) / CG), 0, CGN - 1), j1 = clamp(Math.floor((z1 + HALF) / CG), 0, CGN - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * CGN + i; gridPush(W.grid, k, b); I.cells.add(k); }
    return b;
  }
  const mat = (hex, o) => new THREE.MeshLambertMaterial(Object.assign({ color: hex }, o || {}));
  function add(geo, m, x, y, z, ry, shadow) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (ry) o.rotation.y = ry;
    o.castShadow = shadow !== false; o.receiveShadow = true; I.grp.add(o); return o;
  }
  // 나무 상자 (판자 무늬 텍스처 하나를 같이 씀)
  let crateTex = null;
  function crateMat() {
    if (!crateTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#9a6b3c'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#7b5129'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 14, 64, 2);
      g.strokeStyle = '#5e3c1c'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58); g.beginPath(); g.moveTo(4, 4); g.lineTo(60, 60); g.stroke();
      crateTex = new THREE.CanvasTexture(c);
    }
    return new THREE.MeshLambertMaterial({ map: crateTex });
  }
  // 풀밭: 진하고 옅은 풀잎 점을 흩뿌린 텍스처 (반복)
  let grassTex = null;
  function grassMat() {
    if (!grassTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = mulberry32(4242);
      g.fillStyle = '#5b8a42'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 900; i++) { const v = r(); g.fillStyle = v < 0.45 ? 'rgba(52, 92, 40, 0.55)' : v < 0.8 ? 'rgba(120, 160, 80, 0.45)' : 'rgba(150, 140, 80, 0.35)'; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 2 + r() * 4); }
      grassTex = new THREE.CanvasTexture(c); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(14, 14);
    }
    return new THREE.MeshLambertMaterial({ map: grassTex });
  }
  function crate(x, z, s, y) { y = y || Y0; add(new THREE.BoxGeometry(s, s, s), crateMat(), x, y + s / 2, z, 0); box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2); }
  // 안내판: 'LAST DROP · 스타트 섬'
  function sign(x, z) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#2b3238'); gr.addColorStop(1, '#14191c'); g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#f0a43a'; g.fillRect(0, 0, 512, 8); g.fillRect(0, 152, 512, 8);
    g.textAlign = 'center'; g.fillStyle = '#f0a43a'; g.font = '900 64px sans-serif'; g.fillText('LAST DROP', 256, 78);
    g.fillStyle = '#e8e2d4'; g.font = '700 34px sans-serif'; g.fillText('스타트 섬 · 피해 없음', 256, 128);
    const tex = new THREE.CanvasTexture(c);
    const post = mat(0x3a3f44);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.22, 3.3, 0.22), post, x + s * 2.5, Y0 + 1.65, z, 0); box(x + s * 2.5 - 0.11, Y0, z - 0.11, x + s * 2.5 + 0.11, Y0 + 3.3, z + 0.11); }
    const bd = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.75, 0.14), [post, post, post, post, new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
    bd.position.set(x, Y0 + 2.55, z); bd.castShadow = true; I.grp.add(bd);
  }
  function tree(x, z, k) {
    add(new THREE.CylinderGeometry(0.14 * k, 0.2 * k, 2.2 * k, 6), mat(0x5a3d22), x, Y0 + 1.1 * k, z, 0);
    const lf = mat(0x2f6b3a);
    for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry((1.7 - i * 0.42) * k, 1.9 * k, 8), lf, x, Y0 + (1.9 + i * 1.05) * k, z, i);
    box(x - 0.25 * k, Y0, z - 0.25 * k, x + 0.25 * k, Y0 + 3 * k, z + 0.25 * k);
  }
  // 모래주머니 낮은 벽 (축 방향만 — 충돌 박스가 축 정렬)
  function wall(x, z, alongX) {
    const w = alongX ? 3.4 : 0.7, d = alongX ? 0.7 : 3.4, h = 0.95;
    add(new THREE.BoxGeometry(w, h, d), mat(0xb59e6a), x, Y0 + h / 2, z, 0);
    box(x - w / 2, Y0, z - d / 2, x + w / 2, Y0 + h, z + d / 2);
  }

  // ---------- 시작 ----------
  // 배틀로얄이면 섬을 만들고 모두를 섬에 세운다 (true). seed: 같이 하기면 경기 시드 → 모든 기기에서 같은 섬·총 배치
  function start(sc, seed) {
    dispose();
    if (G.dm || G.training || !W || !G.plane) return false;
    const rand = mulberry32((seed ^ 0x51ed270b) >>> 0);
    I = { x: 0, z: 0, r: R, left: DUR, grp: new THREE.Group(), boxes: [], cells: new Set(), items: [], tags: [], rand };
    sc.add(I.grp);
    // 바다 · 얕은 물 · 모래 · 풀밭 · 광장
    add(new THREE.CircleGeometry(1600, 48).rotateX(-Math.PI / 2), mat(0x245e70), I.x, Y0 - 0.65, I.z, 0, false);
    add(new THREE.RingGeometry(R + 1, R + 18, 64).rotateX(-Math.PI / 2), mat(0x3f97a0, { transparent: true, opacity: 0.85 }), I.x, Y0 - 0.6, I.z, 0, false);
    add(new THREE.CylinderGeometry(R + 3.5, R + 10, 5, 64), mat(0xd9c48f), I.x, Y0 - 2.55, I.z, 0, false);
    add(new THREE.CircleGeometry(R - 5, 64).rotateX(-Math.PI / 2), grassMat(), I.x, Y0 + 0.01, I.z, 0, false);
    add(new THREE.CircleGeometry(7.2, 40).rotateX(-Math.PI / 2), mat(0x9d9a92), I.x, Y0 + 0.02, I.z, 0, false);
    add(new THREE.RingGeometry(7.2, 7.8, 40).rotateX(-Math.PI / 2), mat(0x6f6c66), I.x, Y0 + 0.025, I.z, 0, false);
    box(I.x - R - 6, Y0 - 3, I.z - R - 6, I.x + R + 6, Y0, I.z + R + 6);   // 땅
    sign(I.x, I.z - 4.2);
    // 나무 (가장자리) · 모래주머니 벽 4개 · 나무 상자 (일부는 2단)
    for (let i = 0; i < 9; i++) { const a = (i + rand() * 0.5) / 9 * TAU, r = R - 4.5 - rand() * 3; tree(I.x + Math.cos(a) * r, I.z + Math.sin(a) * r, 0.85 + rand() * 0.4); }
    wall(I.x, I.z + 19, true); wall(I.x, I.z - 19, true); wall(I.x + 19, I.z, false); wall(I.x - 19, I.z, false);
    for (let i = 0; i < 11; i++) {
      const a = rand() * TAU, r = 13 + rand() * 18, x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r, s = 1.1 + rand() * 0.35;
      if (I.boxes.some((b) => b !== I.boxes[0] && x > b.x0 - 1.8 && x < b.x1 + 1.8 && z > b.z0 - 1.8 && z < b.z1 + 1.8)) continue;
      crate(x, z, s); if (rand() < 0.3) crate(x + (rand() - 0.5) * 0.2, z + (rand() - 0.5) * 0.2, s * 0.85, Y0 + s);
    }
    // 광장 둘레의 총 + 탄약 (같이 하기: 시드로 모든 기기에서 같은 번호)
    const guns = Object.keys(ITEMS).filter((k) => { const d = ITEMS[k]; return d.type === 'weapon' && !d.rocket && !d.supply && d.cls !== 'PISTOL' && d.ammo; });
    const place = () => {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const id = guns[Math.floor(rand() * guns.length)], a = i / n * TAU + 0.2, r = 9.5 + (i % 2) * 1.6, x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
        I.items.push(spawnItem(sc, id, 1, x, Y0, z, newWeapon(id, ITEMS[id].mag)));   // 장전된 채로
        const am = ITEMS[id].ammo; if (am) I.items.push(spawnItem(sc, am, ITEMS[id].mag * 3, x + Math.cos(a) * 0.9, Y0, z + Math.sin(a) * 0.9));
      }
    };
    if (G.net) Net.seeded(seed + 7, place); else place();
    // 모두 섬에 (나선형으로 고르게, 광장을 바라보게)
    const N0 = CHARS.length;
    CHARS.forEach((c, i) => {
      const a = i * 2.39996 + rand() * 0.3, r = 4 + Math.sqrt((i + 0.5) / N0) * (R - 8), x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
      c.mode = 'ground'; c.pos.set(x, Y0, z); c.vel.set(0, 0, 0); c.onGround = true; c.root.visible = true;
      c.yaw = c.bodyYaw = Math.atan2(I.x - x, I.z - z); c.root.position.copy(c.pos); c.root.rotation.set(0, c.bodyYaw, 0);
      if (c.net) c.net.buf = [];
    });
    G.island = I;
    // 머리 위 표시 · 위쪽 안내
    const box0 = $('islandTags');
    if (box0) for (const c of CHARS) { const d = document.createElement('div'); d.className = 'itag' + (c.human ? ' human' : ' bot') + (c.isPlayer ? ' me' : ''); d.innerHTML = tagHTML(c); d.hidden = true; box0.appendChild(d); I.tags.push({ c, d, w: 0 }); }
    const bar = $('islandBar'); if (bar) bar.hidden = false;
    document.body.classList.add('island');
    HUD.toast('스타트 섬 — 출발 전까지 모든 피해가 없습니다. 광장 둘레의 총을 주워 쏴 보세요', 'info');
    return true;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function tagHTML(c) {
    if (c.human) {
      const pf = c.pf || {}, ti = pf.ti && (typeof Ladder === 'undefined' || Ladder.allowed(pf.ti, c.name)) ? pf.ti : null;
      return `<span class="itag-name">${esc(c.name)}</span>${ti ? Prof.titleHTML(ti, 'sm') : ''}`;
    }
    const k = c.diffKey || 'normal';
    return `<span class="itag-name">${esc(c.name)}</span><span class="itag-diff d-${k}">AI · ${DIFFICULTY_NAMES[k] || '보통'}</span>`;
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    if (!I) return;
    I.left -= dt;
    const host = !G.net || Net.isHost();
    if (host) { if (I.left <= 0 && (!G.net || !Net.waiting() || I.left <= -EXTRA)) { end(); return; } }
    else if (I.left < -EXTRA - 5) { end(); return; }   // 방장 소식이 끊김 → 스스로 출발
    tags(); barUi();
  }
  let barK = '';
  function barUi() {
    const t = Math.max(0, Math.ceil(I.left)), wait = I.left <= 0;
    let nh = 0; for (const c of CHARS) if (c.human) nh++;
    const k = t + '|' + wait + '|' + nh; if (k === barK) return; barK = k;
    $('islandT').textContent = wait ? '…' : t;
    $('islandSub').textContent = wait ? '다른 사람의 연결을 기다리는 중' : `출발까지 · 사람 ${nh}명 · AI ${CHARS.length - nh}명 · 모든 피해 없음`;
  }
  const _v = new THREE.Vector3();
  function tags() {
    const cam = G.camera, Wd = window.innerWidth, Hd = window.innerHeight, me = G.player;
    for (const t of I.tags) {
      const c = t.c, d = t.d;
      const dist = Math.hypot(c.pos.x - cam.position.x, c.pos.z - cam.position.z);
      if (!c.alive || c.mode !== 'ground' || !c.root.visible || dist > 42 || (c === me && G.firstPerson)) { if (!d.hidden) d.hidden = true; continue; }
      _v.set(c.pos.x, c.pos.y + c.height + 0.42, c.pos.z).project(cam);
      if (_v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2) { if (!d.hidden) d.hidden = true; continue; }
      if (d.hidden) d.hidden = false;
      const x = (_v.x + 1) / 2 * Wd, y = (1 - _v.y) / 2 * Hd, s = clamp(1.25 - dist / 45, 0.55, 1.1);
      // v22: 바뀐 것만 쓴다 (75명 이름표를 매 프레임 다시 쓰면 태블릿에서 무거움) · 겹침 순서는 0.5m 단위
      const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(2)})`, zi = String(1000 - Math.round(dist * 2));
      if (t.tf !== tf) { t.tf = tf; d.style.transform = tf; }
      if (t.zi !== zi) { t.zi = zi; d.style.zIndex = zi; }
    }
  }
  // 봇: 섬 안을 걷고·뛰고·멈춰 둘러보기 (방장·혼자 기기)
  function bot(c, dt) {
    if (!I) return;
    const s = c._isl || (c._isl = { tx: c.pos.x, tz: c.pos.z, wait: 0.3 + Math.random() * 2.5, stuck: 0, sp: 4, look: c.yaw });
    let wx = 0, wz = 0, jump = false;
    const dx = s.tx - c.pos.x, dz = s.tz - c.pos.z, d = Math.hypot(dx, dz);
    if (s.wait > 0) {
      s.wait -= dt; if (Math.random() < dt * 0.6) s.look = c.yaw + (Math.random() - 0.5) * 2.4;
      c.yaw += angleDiff(c.yaw, s.look) * Math.min(1, dt * 3);
      if (s.wait <= 0) goal(s, c);
    } else if (d < 1) { s.wait = 0.6 + Math.random() * 3.5; if (Math.random() < 0.2) c.stance = c.stance === 'crouch' ? 'stand' : 'crouch'; }
    else {
      wx = dx / d; wz = dz / d;
      c.yaw += angleDiff(c.yaw, Math.atan2(wx, wz)) * Math.min(1, dt * 7);
      if (Math.hypot(c.vel.x, c.vel.z) < 0.5) { s.stuck += dt; if (s.stuck > 1) { s.stuck = 0; jump = true; if (Math.random() < 0.5) goal(s, c); } } else s.stuck = 0;
      if (Math.random() < dt * 0.08) jump = true;
    }
    c.sprint = s.sp > 5.2 && c.stance === 'stand' && (wx || wz);
    stepPhysics(c, dt, wx, wz, c.stance === 'crouch' ? Math.min(s.sp, 2.4) : s.sp, jump);
  }
  function goal(s, c) {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (R - 3);
    s.tx = I.x + Math.cos(a) * r; s.tz = I.z + Math.sin(a) * r;
    s.sp = Math.random() < 0.3 ? 2.2 : Math.random() < 0.6 ? 4.6 : 6;
    if (c.stance !== 'stand' && Math.random() < 0.7) c.stance = 'stand';
  }
  // 섬 밖(바다)으로 못 나가게
  function keepIn(c) {
    if (!I || c.mode !== 'ground') return;
    const dx = c.pos.x - I.x, dz = c.pos.z - I.z, d = Math.hypot(dx, dz), m = I.r - CHAR_R;
    if (d <= m) return;
    c.pos.x = I.x + dx / d * m; c.pos.z = I.z + dz / d * m;
    const vn = (c.vel.x * dx + c.vel.z * dz) / d; if (vn > 0) { c.vel.x -= vn * dx / d; c.vel.z -= vn * dz / d; }
  }

  // ---------- 끝: 모두 수송기에 ----------
  function end() {
    if (!I) return;
    if (G.net && Net.isHost()) Net.ev({ k: 'isl' });
    const pl = G.plane;
    for (const c of CHARS) {
      c.mode = 'plane'; c.root.visible = false; c.vel.set(0, 0, 0); c.onGround = false; c.airT = 0;
      if (pl) { c.pos.copy(pl.pos); c.yaw = c.bodyYaw = Math.atan2(pl.dx, pl.dz); }
      c.stance = 'stand'; c.heal = null; c.rl = null; c.cycle = null; c.throwMode = null; c.throwAnim = 0; c.punch = null; c.aiming = false; c.sprint = false;
      c.vault = null; c.rollT = 0; c.lean = 0; c.leanA = 0; c.revive = null; c.revivedBy = null; c.knocked = false; c.hp = 100; c.boost = 0; c._isl = null;
      if (!c.net || c.net.mine) { const inv = c.inv; inv.weapons = [null, null, null]; inv.cur = -1; inv.items = {}; inv.gear.helmet = inv.gear.vest = inv.gear.bag = null; c.equipT = 0; }
      if (c.net && !c.net.mine) c.net.buf = [];
      c.setVisibleGear();
    }
    // 섬에 있던 물건(처음 놓인 총·탄약, 누가 버린 것) 정리 — 기기마다 각자 (서로 알리지 않음)
    const clean = () => { for (const it of GROUND.slice()) if (it.alive && it.y > Y0 - 80) removeItem(it); };
    if (G.net) Net.seeded(1, clean); else clean();
    PROJ = []; SMOKES = []; G.noises = []; G.myNade = null;
    dispose();
    G.time = 0;
    if (typeof Audio !== 'undefined') Audio.wind(0.1);
    G.planeIntro();
  }
  function dispose() {
    if (!I) { G.island = null; return; }
    if (I.grp.parent) I.grp.parent.remove(I.grp);
    I.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map !== crateTex && m.map !== grassTex) m.map.dispose(); m.dispose(); }); });
    if (W && W.grid) {
      for (const k of I.cells) { const l = W.grid[k]; if (l && l !== EMPTY_LIST) { for (let i = l.length - 1; i >= 0; i--) if (l[i].isl) l.splice(i, 1); } }
      if (W.boxes) for (let i = W.boxes.length - 1; i >= 0; i--) if (W.boxes[i].isl) W.boxes.splice(i, 1);
    }
    for (const t of I.tags) t.d.remove();
    const bar = $('islandBar'); if (bar) bar.hidden = true;
    document.body.classList.remove('island'); barK = '';
    I = null; G.island = null;
  }
  return { start, update, bot, end, dispose, sync: (left) => { if (I) I.left = left; }, left: () => (I ? I.left : 0), clamp: keepIn, Y0, R, DUR };
})();
