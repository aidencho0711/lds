// ============================================================
// 10_training.js — 훈련장
//  · 봇·자기장·수송기 없이 무기고 앞에서 바로 시작
//  · 더미: 방어구 없음 / Lv1 / Lv2 / Lv3 (15m), 장거리 50~300m, 이동 표적(걷기·달리기), 벽 너머 투척 연습
//    - 맞은 피해를 숫자로 띄움(머리 노랑), 머리 위에 체력·방어구 내구도·최근 처치 기록(발 수·시간)
//    - 쓰러지면 2.6초 뒤 일어남, 4초 동안 안 맞으면 체력·내구도 회복, 파손된 방어구는 5초 뒤 복구
//  · 무기고 물건은 가져가면 2.5초 뒤 다시 놓이고, 훈련장에서는 탄약이 자동으로 채워진다
//  · 차량은 파괴되면 8초, 제자리를 떠나 25초 방치되면 주차 자리에 새로 생긴다
//  · 플레이어: 3초 동안 안 맞으면 체력 회복, 쓰러지면 3초 뒤 무기고에서 소지품 그대로 다시 시작
// ============================================================
const Training = (() => {
  const DUMMY_OUTFIT = { name: '훈련 더미', shirt: 0xc9a46a, pants: 0x8c7350, skin: 0xcaa77a, boots: 0x4a3a2a, accent: 0x9a5a3a };
  const DUMMY_BRAIN = { state: 'DUMMY', update() {}, onDamaged() {}, onKnocked() {}, onRevived() {}, reportEnemy() {}, setState() {} };
  const BROKEN_T = 5, IDLE_T = 4, DOWN_T = 2.6, ITEM_T = 2.5, LITTER_T = 45;
  let S = null;            // 훈련장 상태
  const nums = [];         // 떠오르는 피해 숫자 { x,y,z, el, t }
  const _p = new THREE.Vector3();

  // ---------- 시작 ----------
  async function start() {
    if (G.state === 'loading') return;
    G.state = 'loading'; G.paused = false; G.over = false; G.training = true;
    Audio.music(false);
    $('lobby').hidden = true; $('resultPanel').hidden = true; $('hud').hidden = true; $('loading').hidden = false;
    $('loadMap').textContent = MAPS.training.name; $('loadTip').textContent = '훈련장: 무기고에서 총을 고르고 사격선에서 더미를 쏴 보세요. 차량과 장애물 코스도 있습니다.';
    const prog = (p, label) => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadStep').textContent = label; };
    disposeMatch();
    const sc = new THREE.Scene(); G.scene = sc;
    const t = TIMES[SETTINGS.time], far = viewFar();
    G.sky = skyDome(t, far * 0.92); sc.add(G.sky); sc.fog = new THREE.Fog(t.fog, far * 0.3, far);
    const L = addLights(sc, t, SHADOW_SIZE[SETTINGS.shadows]); G.sun = L.sun; G.hemi = L.hemi; G.sunDir = new THREE.Vector3(...t.dir).normalize();
    G.renderer.shadowMap.enabled = SHADOW_SIZE[SETTINGS.shadows] > 0;
    G.camera.far = far + 200; G.camera.updateProjectionMatrix(); sc.add(G.camera);
    G.muzzleLight = SETTINGS.quality === 'low' ? null : new THREE.PointLight(0xffb060, 0, 9, 2);
    if (G.muzzleLight) sc.add(G.muzzleLight);
    VM.hemi.color.setHex(t.hemiS); VM.hemi.groundColor.setHex(t.hemiG); VM.dir.color.setHex(t.sun); VM.dir.intensity = t.sunI * 0.8; VM.hemi.intensity = t.hemiI * 0.9;
    G.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0c060, transparent: true, opacity: 0.6, depthWrite: false }));
    G.focusRing.visible = false; sc.add(G.focusRing);
    setMapSize('training');
    try { await generateWorld('training', sc, prog); }
    catch (e) { console.error(e); fatal('훈련장 생성 중 오류: ' + e.message); return; }
    prog(0.97, '무기고 정리');
    Veh.init(sc); FX.init(sc); ThrowViz.init(sc); PROJ = []; SMOKES = []; PathQ.clear(); G.myNade = null;
    Zone.cur = Zone.next = null; Zone.state = 'wait'; Airdrop.init(sc); G.plane = null;
    CHARS = []; G.noises = []; G.time = 0; G.stats = { shots: 0, hits: 0 }; G.killLog = []; G.knockLog = []; G.marker = null; G.updateMarker(); G.spec = null;
    G.teamOrder = null; G.spotted = new Map(); G.danger = null; G.ranked = false; G.quit = false; G.rankResult = null;
    G.teamSize = 1; G.teams = [{ id: 0, members: [], place: 0 }, { id: 1, members: [], place: 0 }];
    const p = new Character({ id: 0, name: playerName(), isPlayer: true, outfit: OUTFITS[SETTINGS.outfit], team: 0 });
    G.teams[0].members.push(p); CHARS.push(p); G.player = p; sc.add(p.root);
    setup(sc);
    respawnPlayer(p, true);
    G.total = 1;
    G.firstPerson = SETTINGS.view === 'fpp'; Cam.ads = 0; VM.key = null;
    HUD.reset(); Input.reset(); Touch.resetToggles(); Touch.apply();
    document.body.classList.add('training'); $('quitBtn').textContent = '훈련장 나가기 (로비로)';
    $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !IS_TOUCH;
    G.state = 'play'; G.previewT = 0;
    Audio.wind(0.05);
    HUD.toast('훈련장 — 뒤의 무기고 탁자에서 총을 고르세요', 'info');
    setTimeout(() => G.training && G.state === 'play' && HUD.toast('사격선은 북쪽(무기고 반대편) 30m · 차량은 서쪽 · 장애물 코스는 동쪽', 'info'), 2600);
  }
  // 훈련장은 300m 표적이 보이도록 시야 거리를 늘린다
  function viewFar() { return Math.max(QUALITY[SETTINGS.quality].far, 480); }
  function setup(sc) {
    const TW = W.training;
    S = { dummies: [], spots: [], park: [], signs: new THREE.Group(), tick: 0, respawnT: 0, litterT: 0 };
    sc.add(S.signs);
    for (const s of TW.signs) S.signs.add(makeSign(s));
    // 더미
    TW.dummies.forEach((d, i) => {
      const c = new Character({ id: 100 + i, name: d.label, outfit: DUMMY_OUTFIT, team: 1 });
      c.mode = 'ground'; c.brain = DUMMY_BRAIN; c.onGround = true;
      c.dummy = { lvl: d.lvl, label: d.label, home: { x: d.x, z: d.z }, move: d.move ? { range: d.move.range, speed: d.move.speed, dir: 1 } : null,
        brokeT: { helmet: 0, vest: 0 }, lastHitT: -99, downT: 0, burst: 0, shots: 0, firstT: 0, last: null, tag: null };
      c.pos.set(d.x, groundAt(d.x, d.z, 999), d.z); c.yaw = c.bodyYaw = d.yaw;
      equip(c); sc.add(c.root); CHARS.push(c); G.teams[1].members.push(c); S.dummies.push(c);
    });
    // 무기고 물건
    GROUND = []; itemGrid = new Array(IGN * IGN).fill(EMPTY_LIST);
    for (const sp of TW.spots) { const s = Object.assign({ it: null, t: 0 }, sp); placeSpot(s); S.spots.push(s); }
    // 차량
    for (const pk of TW.park) { const s = Object.assign({ v: null, idle: 0, deadT: 0 }, pk); s.v = Veh.make(s.type, s.x, s.z, s.yaw); S.park.push(s); }
  }
  function equip(c) {
    const L = c.dummy.lvl, inv = c.inv;
    inv.gear.helmet = L ? { id: 'helm' + L, dur: ITEMS['helm' + L].dur } : null;
    inv.gear.vest = L ? { id: 'vest' + L, dur: ITEMS['vest' + L].dur } : null;
    c.dummy.brokeT.helmet = c.dummy.brokeT.vest = 0;
    c.setVisibleGear();
  }
  function placeSpot(s) {
    const d = ITEMS[s.id];
    const inst = d.type === 'weapon' ? newWeapon(s.id, d.mag) : d.dur ? { id: s.id, dur: d.dur } : d.type === 'bag' ? { id: s.id } : null;
    s.it = spawnItem(G.scene, s.id, s.count, s.x, s.y, s.z, inst); s.t = 0;
  }
  // 표지판: 판자 + 글자(캔버스 텍스처)
  function makeSign(s) {
    const g = new THREE.Group(), cw = 512, ch = Math.round(512 * s.h / s.w);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const x = cv.getContext('2d');
    x.fillStyle = '#1d2124'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#f0a43a'; x.fillRect(0, 0, 10, ch);
    x.fillStyle = '#f2ecd8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const big = s.sub ? ch * 0.42 : ch * 0.62;
    x.font = `700 ${Math.round(big)}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
    x.fillText(s.title, cw / 2 + 5, s.sub ? ch * 0.36 : ch * 0.52, cw - 40);
    if (s.sub) { x.fillStyle = '#b9b3a2'; x.font = `500 ${Math.round(ch * 0.2)}px "Noto Sans KR", sans-serif`; x.fillText(s.sub, cw / 2 + 5, ch * 0.76, cw - 36); }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
    face.position.z = 0.04; g.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.08, s.h + 0.08, 0.06), new THREE.MeshLambertMaterial({ color: 0x2b2f31 })); g.add(back);
    g.position.set(s.x, s.y, s.z); g.rotation.y = s.ry; return g;
  }

  // ---------- 플레이어 ----------
  function respawnPlayer(p, first) {
    const sp = W.training.spawn, y = groundAt(sp.x, sp.z, heightAt(sp.x, sp.z) + 0.3); // 지붕 위가 아니라 바닥
    if (p.veh) Veh.exit(p, false, true);
    p.alive = true; p.knocked = false; p.hp = 100; p.boost = 0; p.mode = 'ground'; p.stance = 'stand';
    p.pos.set(sp.x, y, sp.z); p.vel.set(0, 0, 0); p.yaw = p.bodyYaw = sp.yaw; p.pitch = -0.05; p.onGround = true;
    p.vault = null; p.rollT = 0; p.throwMode = null; p.heal = null; p.rl = null; p.cycle = null; p.revive = null;
    p.anim.dead = 0; p.anim.air = 0; p.root.visible = true; p.setVisibleGear();
    if (!first) HUD.toast('무기고에서 다시 시작합니다', 'info');
  }
  // 훈련장에서 플레이어가 쓰러짐 (자기 수류탄·차량 폭발·추락): 소지품 그대로 3초 뒤 부활
  function playerDown(p) {
    if (!S || S.respawnT > 0) return;
    if (p.veh) Veh.exit(p, false, true);
    p.alive = false; p.hp = 0; p.throwMode = null; p.heal = null; p.deathTime = G.time;
    S.respawnT = 3; HUD.toast('쓰러졌습니다 — 3초 뒤 무기고에서 다시 시작', 'warn'); Audio.death(p.pos);
  }

  // ---------- 더미 피격 (applyDamage에서 방어구 계산 뒤 호출) ----------
  function hit(t, d, part, attacker, cause, hx, hy, hz) {
    const D = t.dummy; if (D.downT > 0) return 0;
    const now = G.time;
    if (now - D.lastHitT > 3) { D.burst = 0; D.shots = 0; D.firstT = now; }
    D.lastHitT = now; D.burst += d; D.shots++;
    t.hp -= d; t.lastDamageT = now;
    t.anim.flinch = Math.min(1, t.anim.flinch + d / 30); t.anim.flinchDir = Math.random() < 0.5 ? -1 : 1;
    const kill = t.hp <= 0;
    if (hx === undefined) { t.chest(_p); hx = _p.x; hy = part === 'head' ? t.pos.y + 1.7 : _p.y; hz = _p.z; }
    // 연사로 같은 자리에 겹치지 않도록 0.25초 안의 숫자는 위로 쌓는다
    D.numK = now - (D.numT || -9) < 0.25 ? (D.numK + 1) % 5 : 0; D.numT = now;
    number(hx, hy + D.numK * 0.2, hz, Math.round(d), part === 'head' ? 'head' : part === 'blast' ? 'blast' : '');
    if (attacker && attacker.isPlayer) { HUD.hitmarker(part === 'head', kill); part === 'head' ? Audio.headshot() : Audio.hitmarker(); }
    if (kill) {
      D.downT = DOWN_T; t.alive = false; t.hp = 0; t.vel.set(0, 0, 0);
      D.last = { shots: D.shots, time: now - D.firstT, dmg: Math.round(D.burst), cause };
      const w = cause && ITEMS[cause] ? ITEMS[cause].name : causeName(cause);
      if (attacker && attacker.isPlayer) HUD.toast(`${D.label} 처치 — ${D.shots}발 · ${(now - D.firstT).toFixed(2)}초${w ? ' · ' + w : ''}`, 'ok');
    }
    return d;
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    if (!S) return;
    const p = G.player;
    // 더미
    for (const c of S.dummies) {
      const D = c.dummy;
      if (D.downT > 0) {
        D.downT -= dt;
        if (D.downT <= 0) { c.alive = true; c.hp = 100; c.anim.dead = 0; c.anim.flinch = 0; equip(c); D.burst = 0; D.shots = 0; }
        continue;
      }
      // 파손된 방어구: 5초 뒤 복구
      for (const slot of ['helmet', 'vest']) {
        if (!D.lvl) continue;
        if (!c.inv.gear[slot]) {
          if (!D.brokeT[slot]) { D.brokeT[slot] = BROKEN_T; t3d(c, slot === 'helmet' ? '헬멧 파손!' : '조끼 파손!', 'warn'); }
          D.brokeT[slot] -= dt;
          if (D.brokeT[slot] <= 0) { const id = (slot === 'helmet' ? 'helm' : 'vest') + D.lvl; c.inv.gear[slot] = { id, dur: ITEMS[id].dur }; D.brokeT[slot] = 0; c.setVisibleGear(); t3d(c, slot === 'helmet' ? '헬멧 복구' : '조끼 복구', 'ok'); }
        }
      }
      // 한동안 안 맞으면 체력·내구도 회복
      if (G.time - D.lastHitT > IDLE_T && c.hp < 100) { c.hp = 100; for (const slot of ['helmet', 'vest']) { const g = c.inv.gear[slot]; if (g) g.dur = ITEMS[g.id].dur; } }
      // 이동 표적: 좌우 왕복 (발소리도 난다)
      if (D.move) {
        const M = D.move, hx = D.home.x;
        c.pos.x += M.dir * M.speed * dt;
        if (c.pos.x > hx + M.range) { c.pos.x = hx + M.range; M.dir = -1; } else if (c.pos.x < hx - M.range) { c.pos.x = hx - M.range; M.dir = 1; }
        c.pos.y = groundAt(c.pos.x, c.pos.z, c.pos.y + 1); c.vel.set(M.dir * M.speed, 0, 0); c.onGround = true;
        c.sprint = M.speed > 5; c.yaw = Math.atan2(M.dir, 0);
      } else { c.vel.set(0, 0, 0); c.yaw = 0; }
    }
    // 플레이어: 회복 / 부활 / 탄약 자동 보충
    if (p) {
      if (!p.alive) { S.respawnT -= dt; if (S.respawnT <= 0) { S.respawnT = 0; respawnPlayer(p); } }
      else {
        if (p.hp < 100 && G.time - p.lastDamageT > 3) p.hp = Math.min(100, p.hp + dt * 30);
        for (const wi of p.inv.weapons) if (wi) { const a = ITEMS[wi.id].ammo, m = p.inv.magSize(wi); if (p.inv.count(a) < m * 2) p.inv.items[a] = m * 3; }
      }
    }
    S.tick -= dt; if (S.tick > 0) return; S.tick = 0.5;
    // 무기고 물건 다시 놓기
    for (const s of S.spots) { if (s.it && s.it.alive) continue; s.t += 0.5; if (s.t >= ITEM_T) placeSpot(s); }
    // 바닥에 버려진 물건(무기 교체 등) 45초 뒤 정리
    const mine = new Set(S.spots.map((s) => s.it));
    for (const it of GROUND) if (it.alive && !mine.has(it)) { it._born = it._born || G.time; if (G.time - it._born > LITTER_T) removeItem(it); }
    // 차량 다시 놓기
    for (const s of S.park) {
      const v = s.v, live = v && Veh.list.includes(v);
      if (live && v.seats.some(Boolean)) { s.idle = 0; s.deadT = 0; continue; }
      const away = live && Math.hypot(v.pos.x - s.x, v.pos.z - s.z) > 12;
      if (live && v.dead) s.deadT += 0.5; else s.deadT = 0;
      if (away && !v.dead) s.idle += 0.5; else s.idle = 0;
      if (!live || s.deadT > 8 || s.idle > 25) {
        if (p && Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < 4) continue;
        if (Veh.list.some((o) => o !== v && !o.dead && Math.hypot(o.pos.x - s.x, o.pos.z - s.z) < 3.5)) continue;
        if (live) Veh.remove(v);
        s.v = Veh.make(s.type, s.x, s.z, s.yaw); s.idle = 0; s.deadT = 0;
      }
    }
  }

  // ---------- 화면 표시: 떠오르는 피해 숫자 + 더미 머리 위 정보 ----------
  function number(x, y, z, val, cls) {
    const box = $('dmgNums'); if (!box) return;
    const el = document.createElement('div'); el.className = 'dnum ' + cls; el.textContent = val; box.appendChild(el);
    nums.push({ x: x + rnd(-0.12, 0.12), y, z: z + rnd(-0.12, 0.12), el, t: 0, life: 1.1, dx: rnd(-14, 14) });
    while (nums.length > 40) { const n = nums.shift(); n.el.remove(); }
  }
  function t3d(c, text, cls) {
    const box = $('dmgNums'); if (!box) return;
    const el = document.createElement('div'); el.className = 'dnum msg ' + (cls || ''); el.textContent = text; box.appendChild(el);
    nums.push({ x: c.pos.x, y: c.pos.y + 2.25, z: c.pos.z, el, t: 0, life: 1.6, dx: 0 });
  }
  function project(x, y, z, out) {
    _p.set(x, y, z).project(G.camera);
    if (_p.z > 1 || _p.z < -1) return false;
    out[0] = (_p.x * 0.5 + 0.5) * innerWidth; out[1] = (-_p.y * 0.5 + 0.5) * innerHeight; return true;
  }
  const _s = [0, 0], _cf = new THREE.Vector3();
  function hud(dt) {
    if (!S) return;
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = nums[i]; n.t += dt;
      if (n.t > n.life) { n.el.remove(); nums.splice(i, 1); continue; }
      if (!project(n.x, n.y, n.z, _s)) { n.el.style.opacity = 0; continue; }
      const k = n.t / n.life;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      n.el.style.transform = `translate(${(_s[0] + n.dx * k).toFixed(1)}px, ${(_s[1] - 34 * k).toFixed(1)}px) translate(-50%, -50%) scale(${n.t < 0.08 ? 1.35 : 1})`;
    }
    // 더미 정보: 60m 안, 또는 정조준 중 조준점 근처(장거리 표적)
    const cam = G.camera; cam.getWorldDirection(_cf);
    const ads = Cam.ads > 0.5, box = $('dummyTags');
    for (const c of S.dummies) {
      const D = c.dummy, dx = c.pos.x - cam.position.x, dy = c.pos.y + 2 - cam.position.y, dz = c.pos.z - cam.position.z, dist = Math.hypot(dx, dz);
      const ang = Math.acos(clamp((dx * _cf.x + dy * _cf.y + dz * _cf.z) / Math.max(0.01, Math.hypot(dx, dy, dz)), -1, 1));
      let show = (dist < 60 && ang < 1.0) || (ads && ang < 0.12 && dist < 400);
      // 벽 뒤(투척 연습) 더미는 보일 때만 — 시야 검사는 0.25초마다
      if (show && G.time - (D.losAt || -9) > 0.25) { D.losAt = G.time; D.los = losClear(cam.position.x, cam.position.y, cam.position.z, c.pos.x, c.pos.y + 1.5, c.pos.z); }
      if (show && !D.los) show = false;
      if (show && !project(c.pos.x, c.pos.y + 2.05, c.pos.z, _s)) show = false;
      if (!show) { if (D.tag) D.tag.hidden = true; continue; }
      if (!D.tag) {
        D.tag = document.createElement('div'); D.tag.className = 'dtag';
        D.tag.innerHTML = '<b></b><div class="dhp"><i></i></div><div class="darm"><span class="h"><i></i></span><span class="v"><i></i></span></div><small></small>';
        box.appendChild(D.tag);
      }
      const el = D.tag; el.hidden = false;
      el.style.transform = `translate(${_s[0].toFixed(1)}px, ${_s[1].toFixed(1)}px) translate(-50%, -100%) scale(${(clamp(1.25 - dist / 80, 0.7, 1) * (IS_TOUCH ? 0.82 : 1)).toFixed(3)})`;
      const title = `${D.label}${dist > 20 ? ` · ${Math.round(dist)}m` : ''}`; // 거리는 카메라 기준 실측
      if (el.firstChild.textContent !== title) el.firstChild.textContent = title;
      el.querySelector('.dhp i').style.width = Math.max(0, c.hp) + '%';
      const arm = el.querySelector('.darm'); arm.hidden = !D.lvl;
      if (D.lvl) for (const [slot, cls] of [['helmet', '.h'], ['vest', '.v']]) {
        const g = c.inv.gear[slot], e = arm.querySelector(cls);
        e.classList.toggle('broken', !g); e.firstChild.style.width = g ? (g.dur / ITEMS[g.id].dur * 100) + '%' : '0%';
        e.dataset.t = !g ? `${slot === 'helmet' ? '헬멧' : '조끼'} 복구 ${Math.ceil(D.brokeT[slot])}초` : `${slot === 'helmet' ? '헬멧' : '조끼'} Lv${D.lvl}`;
      }
      const live = G.time - D.lastHitT < 3 && D.burst > 0;
      const sm = D.downT > 0 ? `처치 · ${D.last.shots}발 · ${D.last.time.toFixed(2)}초` : live ? `누적 ${Math.round(D.burst)} · ${D.shots}발` : D.last ? `최근: ${D.last.shots}발 · ${D.last.time.toFixed(2)}초` : '';
      const st = el.lastChild; if (st.textContent !== sm) st.textContent = sm;
      el.classList.toggle('down', D.downT > 0);
    }
  }
  function dispose() {
    if (S && S.dummies) for (const c of S.dummies) if (c.dummy.tag) c.dummy.tag.remove();
    for (const n of nums) n.el.remove(); nums.length = 0;
    const a = $('dmgNums'), b = $('dummyTags'); if (a) a.innerHTML = ''; if (b) b.innerHTML = '';
    S = null;
  }
  function setupLobby() { const b = $('trainBtn'); if (b) b.addEventListener('click', () => { Audio.init(); Audio.ui(); start(); }); }
  return { start, update, hud, hit, playerDown, dispose, setupLobby, viewFar, get state() { return S; } };
})();
