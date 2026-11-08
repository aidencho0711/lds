// ============================================================
// 06_combat.js — 레이캐스트(벽/지형/캐릭터), 사격, 피해, 사망/루팅 박스,
//                수류탄·연막탄, 시각 효과(총구화염/탄도/피격)
// ============================================================
const _ray = { t: 0, box: null, nx: 0, ny: 0, nz: 0 };
// 충돌 박스 대상 DDA 레이캐스트. soft=true면 철조망 등도 막음
function rayBoxes(ox, oy, oz, dx, dy, dz, maxD, soft) {
  let best = maxD, hit = null, nx = 0, ny = 0, nz = 0;
  _qStamp++;
  let i = Math.floor((ox + HALF) / CG), j = Math.floor((oz + HALF) / CG);
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? CG / Math.abs(dx) : Infinity, tdz = dz !== 0 ? CG / Math.abs(dz) : Infinity;
  let tmx = dx !== 0 ? (dx > 0 ? (i + 1) * CG - (ox + HALF) : (ox + HALF) - i * CG) / Math.abs(dx) : Infinity;
  let tmz = dz !== 0 ? (dz > 0 ? (j + 1) * CG - (oz + HALF) : (oz + HALF) - j * CG) / Math.abs(dz) : Infinity;
  let t = 0, guard = 0;
  while (t <= best && guard++ < 400) {
    if (i >= 0 && j >= 0 && i < CGN && j < CGN) {
      const list = W.grid[j * CGN + i];
      for (let n = 0; n < list.length; n++) {
        const b = list[n]; if (b._q === _qStamp) continue; b._q = _qStamp;
        if (b.soft && !soft) continue;
        // slab
        let t0 = -Infinity, t1 = Infinity, ax = 0;
        if (dx !== 0) { let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx; if (a > c) [a, c] = [c, a]; if (a > t0) { t0 = a; ax = 0; } if (c < t1) t1 = c; } else if (ox < b.x0 || ox > b.x1) continue;
        if (dy !== 0) { let a = (b.y0 - oy) / dy, c = (b.y1 - oy) / dy; if (a > c) [a, c] = [c, a]; if (a > t0) { t0 = a; ax = 1; } if (c < t1) t1 = c; } else if (oy < b.y0 || oy > b.y1) continue;
        if (dz !== 0) { let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz; if (a > c) [a, c] = [c, a]; if (a > t0) { t0 = a; ax = 2; } if (c < t1) t1 = c; } else if (oz < b.z0 || oz > b.z1) continue;
        if (t0 <= t1 && t0 >= 0 && t0 < best) {
          best = t0; hit = b;
          nx = ax === 0 ? -Math.sign(dx) : 0; ny = ax === 1 ? -Math.sign(dy) : 0; nz = ax === 2 ? -Math.sign(dz) : 0;
        }
      }
    } else if (t > 0) break;
    if (tmx < tmz) { t = tmx; tmx += tdx; i += si; } else { t = tmz; tmz += tdz; j += sj; }
  }
  _ray.t = hit ? best : Infinity; _ray.box = hit; _ray.nx = nx; _ray.ny = ny; _ray.nz = nz;
  return _ray;
}
function rayTerrain(ox, oy, oz, dx, dy, dz, maxD) {
  let prev = 0, t = 0.5;
  while (t <= maxD) {
    const y = oy + dy * t, h = heightAt(ox + dx * t, oz + dz * t);
    if (y < h) {
      let a = prev, b = t;
      for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (oy + dy * m < heightAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
      return b;
    }
    prev = t; t += clamp((y - h) * 0.6, 0.8, 8);
  }
  return Infinity;
}
const _hs = [];
function rayChars(ox, oy, oz, dx, dy, dz, maxD, ignore) {
  let best = maxD, hit = null, part = null;
  for (const c of CHARS) {
    if (c === ignore || !c.alive || c.mode === 'plane') continue;
    if (ignore && ignore.veh && c.veh === ignore.veh) continue; // 같은 차에 탄 사람은 내 사선에서 제외
    // 빠른 기각
    const cx = c.pos.x - ox, cy = c.pos.y + 0.9 - oy, cz = c.pos.z - oz, along = cx * dx + cy * dy + cz * dz;
    if (along < -2 || along > best + 2) continue;
    const px = cx - dx * along, py = cy - dy * along, pz = cz - dz * along;
    if (px * px + py * py + pz * pz > 4.5) continue;
    hitSpheres(c, _hs);
    for (const s of _hs) {
      const sx = s.x - ox, sy = s.y - oy, sz = s.z - oz, b = sx * dx + sy * dy + sz * dz;
      const cc = sx * sx + sy * sy + sz * sz - s.r * s.r, disc = b * b - cc;
      if (disc < 0) continue;
      const t = b - Math.sqrt(disc);
      if (t > 0 && t < best) { best = t; hit = c; part = s.part; }
    }
  }
  return { t: hit ? best : Infinity, char: hit, part };
}
// 시야 확인 (벽/지형/연막). 철조망은 통과
function losClear(ax, ay, az, bx, by, bz, exceptVeh) {
  let dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.sqrt(dx * dx + dy * dy + dz * dz); if (L < 0.01) return true;
  dx /= L; dy /= L; dz /= L;
  if (smokeBlocks(ax, ay, az, dx, dy, dz, L)) return false;
  if (rayBoxes(ax, ay, az, dx, dy, dz, L - 0.25, false).t < L - 0.25) return false;
  if (rayTerrain(ax, ay, az, dx, dy, dz, L - 0.3) < L - 0.3) return false;
  if (Veh.active && Veh.ray(ax, ay, az, dx, dy, dz, L - 0.3, exceptVeh).t < L - 0.3) return false; // 차량 차체도 시야를 가린다 (내가 탄 차는 제외)
  return true;
}
// 통합 레이캐스트 (사격용)
function raycastAll(ox, oy, oz, dx, dy, dz, maxD, ignore) {
  const wb = rayBoxes(ox, oy, oz, dx, dy, dz, maxD, false);
  let best = wb.t, type = wb.box ? 'wall' : null, n = [wb.nx, wb.ny, wb.nz], box = wb.box;
  const tt = rayTerrain(ox, oy, oz, dx, dy, dz, Math.min(best, maxD));
  if (tt < best) { best = tt; type = 'terrain'; n = [0, 1, 0]; }
  let veh = null;
  if (Veh.active) { const vh = Veh.ray(ox, oy, oz, dx, dy, dz, Math.min(best, maxD), ignore && ignore.veh); if (vh.t < best) { best = vh.t; type = 'veh'; veh = vh.v; n = [0, 1, 0]; box = null; } }
  const ch = rayChars(ox, oy, oz, dx, dy, dz, Math.min(best, maxD), ignore);
  if (ch.t < best) return { t: ch.t, type: 'char', char: ch.char, part: ch.part, n: [0, 0, 0] };
  return { t: best, type, n, box, veh };
}

// ---------- 사격 ----------
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function weaponSpread(c) {
  const wi = c.weapon; if (!wi) return 0;
  const d = ITEMS[wi.id], sg = d.cls === 'SG';
  let s = d.spread * (wi.att.grip ? ITEMS.grip.spreadMul : 1);
  if (!c.aiming && (d.cls === 'SR' || d.cls === 'DMR')) s = Math.max(s, 2.6);
  const sp = c.anim.speed;
  // 산탄총은 펠릿 묶음 크기가 거의 고정 (뛰며 쏴도 근거리에서 맞도록 이동·점프·조준 영향을 작게)
  s *= 1 + clamp(sp / 3.5, 0, 1.6) * (sg ? 0.25 : 1);
  if (!c.onGround && !c.inWater) s *= sg ? 1.6 : 3;
  if (c.veh) s *= 1 + clamp(Math.hypot(c.veh.vx, c.veh.vz) / 12, 0, 1.6); // 달리는 차에서 쏘면 퍼짐
  if (c.aiming) s *= sg ? 0.9 : 0.45;   // 산탄총은 조준해도 조금만 모인다 (중거리 위력은 예전과 비슷하게)
  if (c.stance === 'crouch') s *= 0.8; else if (c.stance === 'prone') s *= d.cls === 'LMG' ? 0.42 : 0.6;
  return s + c.bloom;
}
// ---------- 총구·배출구 위치 (1인칭이면 뷰모델, 아니면 캐릭터가 든 총) ----------
const _mz = new THREE.Vector3(), _ep = new THREE.Vector3(), _ev = new THREE.Vector3();
function gunObj(c) { if (c.isPlayer && VM.active && VM.gun) return VM.gun; const g = c.rig.gunObj; return g && c.root.visible ? g : null; }
function gunWorldPoint(c, lx, ly, lz, out) {
  const g = gunObj(c); if (!g) return null;
  out.set(lx, ly, lz); g.localToWorld(out);
  if (g === VM.gun) G.camera.localToWorld(out);
  return out;
}
function fireWeapon(c, origin, dir) {
  const wi = c.weapon; if (!wi || c.rl || c.cycle || c.equipT > 0 || c.inWater || c.heal || c.knocked || c.revive || (c.veh && !c.seat)) return false;
  const d = ITEMS[wi.id];
  if (wi.mag <= 0) { if (c.isPlayer) Audio.dryfire(); return false; }
  // 남은 시간을 이어 받아 프레임 단위 반올림으로 연사 속도가 떨어지지 않게 한다
  if (!(c.isPlayer && Dev.cheat('ammo'))) wi.mag--;   // 개발자 도구: 무한 탄약
  c.fireCd = Math.max(c.fireCd, -0.05) + 60 / fireRpm(wi); G.stats.shots++;
  if (c.spawnProt) c.spawnProt = 0; // 데스매치: 쏘면 부활 보호 해제
  const spread = weaponSpread(c) * DEG;
  const pellets = d.pellets || 1;
  const g = gunObj(c), meta = g && g.userData.meta;
  const skI = g && g.userData.skin, skFx = skI && (skI.d.fx || skI.d.lite);   // 울트라레어(lite면 슈퍼레어 약한 효과) 총기 스킨이면 맞힘 효과
  const muzzle = meta ? gunWorldPoint(c, 0, meta.boreY, meta.muzzleZ + 0.01, _mz) : null;
  const tStart = muzzle && muzzle.distanceTo(origin) < 3 ? muzzle : origin;
  // 직교 기저
  const up = Math.abs(dir.y) > 0.95 ? _v2.set(1, 0, 0) : _v2.set(0, 1, 0);
  const rx = dir.y * up.z - dir.z * up.y, ry = dir.z * up.x - dir.x * up.z, rz = dir.x * up.y - dir.y * up.x;
  const rl = Math.hypot(rx, ry, rz);
  const ax = rx / rl, ay = ry / rl, az = rz / rl;
  const bx = dir.y * az - dir.z * ay, by = dir.z * ax - dir.x * az, bz = dir.x * ay - dir.y * ax;
  // 산탄: 가운데 1발 + 안쪽·바깥쪽 고리를 번갈아 (무작위 원판보다 구멍·뭉침이 적어 근거리 피해가 고르다)
  const T = Math.tan(spread), a0 = Math.random() * TAU, ring = pellets - 1;
  for (let p = 0; p < pellets; p++) {
    let a, r;
    if (pellets === 1) { a = Math.random() * TAU; r = Math.sqrt(Math.random()) * T; }
    else if (p === 0) { a = Math.random() * TAU; r = Math.random() * 0.1 * T; }
    else { const k = p - 1; a = a0 + k * TAU / ring + (Math.random() - 0.5) * 0.5; r = (k % 2 ? 0.66 + Math.random() * 0.34 : 0.3 + Math.random() * 0.25) * T; }
    let dx = dir.x + (ax * Math.cos(a) + bx * Math.sin(a)) * r, dy = dir.y + (ay * Math.cos(a) + by * Math.sin(a)) * r, dz = dir.z + (az * Math.cos(a) + bz * Math.sin(a)) * r;
    const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    const maxD = d.range * 2.4;
    const h = raycastAll(origin.x, origin.y, origin.z, dx, dy, dz, maxD, c);
    const t = Math.min(h.t, maxD);
    const ex = origin.x + dx * t, ey = origin.y + dy * t, ez = origin.z + dz * t;
    if (p < 2) FX.tracer(c, tStart, ex, ey, ez, GunSkin.tracerCol(g));
    if (p === 0) { _shotEnd[0] = ex; _shotEnd[1] = ey; _shotEnd[2] = ez; _shotEnd[3] = h.type || 0; }
    const fall = h.t > d.range ? clamp(1 - (h.t - d.range) / (d.range * 1.4), 0.35, 1) : 1;
    if (h.type === 'char') {
      if (skFx && h.char.alive && !sameTeam(c, h.char) && !(G.dm && h.char.spawnProt > G.time)) SkinFx.hit(h.char, ex, ey, ez, dx, dy, dz, skFx, c);
      applyDamage(h.char, d.dmg * fall, h.part, c, wi.id, ex, ey, ez); G.stats.hits++;
      FX.impact(ex, ey, ez, 'blood');
    } else if (h.type === 'veh') {
      Veh.damage(h.veh, d.dmg * fall, c, wi.id);
      FX.impact(ex, ey, ez, h.veh.T.animal ? 'blood' : 'spark'); if (p === 0) Audio.impact({ x: ex, y: ey, z: ez }, !!h.veh.T.animal);
      if (c.isPlayer && !h.veh.dead) HUD.hitmarker(false, false);
    } else if (h.type) { FX.impact(ex, ey, ez, h.type === 'terrain' ? 'dirt' : 'spark'); if (p === 0) Audio.impact({ x: ex, y: ey, z: ez }, false); }
  }
  // 이 발로 처치해 웨폰 데스매치 총이 바뀌었으면(applyDamage → swapWeapon) 새 총에 레버·볼트 순환·탄피·반동을 넘기지 않는다
  const swapped = c.weapon !== wi;
  if (!swapped) c.bloom = Math.min(c.bloom + d.recoil * (wi.att.muzzle ? ITEMS.comp.recoilMul : 1) * (d.cls === 'LMG' && c.stance === 'prone' ? 0.45 : d.cls === 'SG' ? 0.5 : 1) * 0.22, 4);
  FX.flash(c, g, meta, tStart, dir, d);
  if (g && g.userData.skin && !swapped) GunSkin.shot(g, c);   // 울트라레어 총기 스킨: 색 화염·불씨/스파크·몸체 빛
  if (!swapped) {
    if (d.cycle) { if (wi.mag > 0) c.cycle = { kind: d.cycle, t: 0, ev: 0, ejected: false, total: d.cycleT || CYCLE[d.cycle].total }; }
    else if (d.rKind !== 'break') ejectCase(c, d); // 중절식은 장전할 때 꺼낸다
    if (d.cls === 'PISTOL') c.slideKick = 0.09;
  }
  Audio.gunshot(origin, wi.id, c.isPlayer, isIndoor(c.pos.x, c.pos.z, c.pos.y));
  G.noises.push({ x: origin.x, y: origin.y, z: origin.z, t: G.time, r: d.cls === 'SMG' || d.cls === 'PISTOL' ? 160 : d.ammo === 'a300' ? 360 : 260, by: c, kind: 'shot' });
  if (G.net) Net.sendShot(c, tStart, _shotEnd, wi.id, _shotEnd[3]); // 같이 하기: 다른 기기에 총성·탄도 표시
  return true;
}
const _shotEnd = [0, 0, 0, 0];
// ---------- 맨손 근접 공격 (무기·탄약이 없을 때) ----------
//  가드(주먹을 턱 높이) → 지르기(out) → 잠깐 뻗은 채(hold) → 복귀(back). 맞힘 판정은 주먹이 거의 다 뻗은 순간(hitAt)
//  누르고 있으면 cycle 간격으로 좌우 번갈아 연타, combo 안에 다시 치면 반대손. 마지막 주먹 뒤 guardT 동안 가드 유지
const PUNCH = { out: 0.11, hold: 0.05, back: 0.2, hitAt: 0.09, cycle: 0.5, combo: 0.9, guardT: 2.2, dmg: 14, reach: 1.9 };
// 주먹이 뻗은 정도 0~1 (나갈 때는 빠르게 감속, 돌아올 때는 부드럽게)
function punchExt(t) {
  const P = PUNCH, u = t / P.out;
  return t < P.out ? 1 - (1 - u) * (1 - u) : t < P.out + P.hold ? 1 : 1 - sstep(P.out + P.hold, P.out + P.hold + P.back, t);
}
// 주먹 시작. dir = 치는 방향(월드). 피해는 updatePunch에서 hitAt에 준다
function melee(c, dir) {
  if (c.fireCd > 0 || c.heal || c.inWater || c.knocked || c.revive) return false;
  c.fireCd = PUNCH.cycle;
  const side = G.time - (c.punchT || -99) < PUNCH.combo ? -(c.punchSide || -1) : 1;   // 처음은 왼손 잽, 이어 치면 좌우 번갈아
  c.punchSide = side; c.punchT = G.time;
  c.punch = { t: 0, side, hit: false, dx: dir.x, dy: dir.y, dz: dir.z, remote: false };
  Audio.punch(c.pos, 'swing', c.isPlayer);
  if (G.net) Net.sendPunch(c, side);   // 같이 하기: 다른 기기에도 지르기 동작·소리
  return true;
}
// 주먹 진행 (플레이어·봇 공용, 남의 기기 캐릭터는 동작·소리만 — 피해는 때린 쪽 기기가 'hit'으로 보냄)
const _po = new THREE.Vector3();
function updatePunch(c, dt) {
  const pu = c.punch;
  if (!c.alive || c.knocked) { c.punch = null; return; }
  pu.t += dt;
  if (!pu.hit && pu.t >= PUNCH.hitAt) {
    pu.hit = true; c.eye(_po);
    const h = rayChars(_po.x, _po.y, _po.z, pu.dx, pu.dy, pu.dz, PUNCH.reach, c);
    if (h.char) {
      if (!pu.remote) applyDamage(h.char, PUNCH.dmg, h.part === 'head' ? 'body' : h.part, c, 'fist');
      Audio.punch(h.char.pos, 'hit', c.isPlayer);
    }
  }
  if (pu.t >= PUNCH.out + PUNCH.hold + PUNCH.back) c.punch = null;
}
// 탄피/산탄피 배출 (가까운 경우만)
function ejectCase(c, d, drop) {
  if (!G.camera) return;
  const g = gunObj(c); if (!g) return;
  const dist = Math.hypot(c.pos.x - G.camera.position.x, c.pos.z - G.camera.position.z); if (dist > 28) return;
  const m = g.userData.meta;
  if (!gunWorldPoint(c, m.ejectPos[0], m.ejectPos[1], m.ejectPos[2], _ep)) return;
  const yaw = c.isPlayer ? c.yaw : c.bodyYaw, rx = -Math.cos(yaw), rz = Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const sp = 2.2 + Math.random() * 1.3;
  if (drop) _ev.set(-fx * 1.6 + rx * rnd(-0.3, 0.3) + c.vel.x, 1.6 + Math.random() * 0.6, -fz * 1.6 + rz * rnd(-0.3, 0.3) + c.vel.z);
  else _ev.set(rx * sp - fx * 0.7 + c.vel.x, 1.3 + Math.random() * 1.1, rz * sp - fz * 0.7 + c.vel.z);
  FX.casing(_ep, _ev, CASE_KIND[d.ammo], c.isPlayer || dist < 14);
}
// 떨어뜨린 탄창(Beryl·M16A4)·빈 클립(Kar98k): 총에서 빠진 자리에서 실제 바닥으로 떨어져 잠시 남는다
function dropPartFx(c, part, kind, up) {
  if (!G.camera) return;
  const g = gunObj(c); if (!g) return;
  if (Math.hypot(c.pos.x - G.camera.position.x, c.pos.z - G.camera.position.z) > 40) return;
  const P = g.userData.parts[part]; if (!P) return;
  if (!gunWorldPoint(c, P.position.x, P.position.y, P.position.z, _ep)) return;
  const yaw = c.isPlayer ? c.yaw : c.bodyYaw, rx = -Math.cos(yaw), rz = Math.sin(yaw);
  if (up) _ev.set(rx * 1.3 + c.vel.x, 1.9 + Math.random() * 0.5, rz * 1.3 + c.vel.z);
  else _ev.set(c.vel.x * 0.8, -1.4, c.vel.z * 0.8);
  FX.casing(_ep, _ev, kind, true);
}
function mechSound(c, name) {
  const id = c.weapon ? c.weapon.id : 'm416';
  if (c.isPlayer) Audio.mech(name, null, id, true);
  else if (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 26) Audio.mech(name, c.pos, id, false);
}

// ---------- 장전 상태 기계 ----------
// 탄창식: 전술(탄 남음) / 빈 탄창(장전손잡이·슬라이드 조작 추가, 더 길다)
//   rStyle 'ak' = 탄창 앞쪽을 걸고 뒤로 젖혀 끼움(로킹), 'bullpup' = 손잡이 뒤 탄창
// 볼트+탄창(AWM): 빈 탄창이면 볼트 열기 → 탄창 교체 → 볼트 닫기
// 볼트 한 발씩(M24) / 중절식(S686): 총열 꺾기 → 탄피 배출 → 한 발씩 → 닫기
// 탄띠(M249·MG3): 덮개 열기 → 탄통 교체 → 탄띠 걸기 → 덮개 닫기
const RL_TL = {
  mag: { hand: [[0, 'fore'], [0.1, 'well'], [0.28, 'pouch'], [0.42, 'pouch'], [0.56, 'well'], [0.62, 'well'], [0.8, 'fore']],
    ev: [[0.1, 'magRelease'], [0.16, 'magOut'], [0.54, 'magIn'], [0.6, 'magSeat']], out: [0.12, 0.28], hide: [0.28, 0.42], inn: [0.42, 0.56], tilt: [0.04, 0.76] },
  magEmpty: { hand: [[0, 'fore'], [0.08, 'well'], [0.22, 'pouch'], [0.34, 'pouch'], [0.46, 'well'], [0.5, 'well'], [0.58, 'charge'], [0.64, 'charge'], [0.7, 'chargeBack'], [0.73, 'charge'], [0.88, 'fore']],
    ev: [[0.08, 'magRelease'], [0.13, 'magOut'], [0.45, 'magIn'], [0.5, 'magSeat'], [0.66, 'chargeBack'], [0.73, 'chargeFwd']], out: [0.1, 0.22], hide: [0.22, 0.34], inn: [0.34, 0.46], tilt: [0.03, 0.84], charge: [0.64, 0.7, 0.73] },
  // AWM 빈 탄창: 오른손 볼트, 왼손 탄창
  boltMag: { hand: [[0, 'fore'], [0.2, 'fore'], [0.27, 'well'], [0.4, 'pouch'], [0.5, 'pouch'], [0.61, 'well'], [0.65, 'well'], [0.76, 'fore']],
    handR: [[0, 'grip'], [0.05, 'bolt'], [0.09, 'boltUp'], [0.16, 'boltBack'], [0.23, 'grip'], [0.7, 'grip'], [0.75, 'boltBack'], [0.81, 'boltUp'], [0.85, 'bolt'], [0.92, 'grip']],
    ev: [[0.08, 'boltUp'], [0.15, 'boltBack'], [0.27, 'magRelease'], [0.31, 'magOut'], [0.6, 'magIn'], [0.64, 'magSeat'], [0.79, 'boltFwd'], [0.84, 'boltDown']],
    out: [0.28, 0.4], hide: [0.4, 0.5], inn: [0.5, 0.61], tilt: [0.18, 0.72], boltUp: [0.06, 0.1, 0.8, 0.84], boltBack: [0.1, 0.16, 0.75, 0.8] },
  belt: { hand: [[0, 'fore'], [0.07, 'cover'], [0.13, 'coverUp'], [0.19, 'well'], [0.3, 'pouch'], [0.48, 'pouch'], [0.58, 'well'], [0.62, 'well'], [0.7, 'tray'], [0.76, 'tray'], [0.8, 'coverUp'], [0.86, 'cover'], [0.95, 'fore']],
    ev: [[0.12, 'coverOpen'], [0.22, 'boxOut'], [0.57, 'boxIn'], [0.61, 'boxSeat'], [0.72, 'beltLay'], [0.86, 'coverClose']],
    out: [0.21, 0.3], hide: [0.3, 0.48], inn: [0.48, 0.58], tilt: [0.03, 0.92], cover: [0.08, 0.14, 0.81, 0.87] },
};
// ---------- v16: 총마다 다른 장전 동작 (ITEMS.rTL → 전술 / +'Empty' → 빈 탄창) ----------
//  hand/handR: 왼손·오른손 위치 keyframe(비율) · ev: 소리·처리 · tilt/tiltAmt: 총 기울임 구간·크기 [z, x]
//  out/hide/inn: 탄창이 손을 따라 빠짐·숨김·들어옴 · drop: 탄창을 놓아 떨어뜨림(뒤에 바닥으로) · spare: 예비 탄창(mag2)이 손에 [보임, 걸림, 끼움 완료]
//  rock: 탄창 젖힘 {amt, out, inn} · charge/knob: 장전손잡이 · fold: 접힌 손잡이 펼침 · slideRel: 권총 슬라이드가 닫히는 시점
Object.assign(RL_TL, {
  // Beryl M762: 새 탄창을 먼저 꺼내 → 헌 탄창 뒤 멈치를 새 탄창으로 쳐서 떨어뜨리고 → 앞을 걸어 젖혀 끼움
  beryl: { hand: [[0, 'fore'], [0.06, 'fore'], [0.2, 'pouch'], [0.26, 'pouch'], [0.38, 'knock'], [0.43, 'knock'], [0.52, 'wellRock'], [0.6, 'well'], [0.64, 'well'], [0.82, 'fore']],
    ev: [[0.4, 'magKnock'], [0.5, 'magFree'], [0.55, 'magInAk'], [0.61, 'magRock']],
    drop: [0.4, 0.5], hide: [0.5, 0.61], spare: [0.22, 0.52, 0.61], rock: { amt: -0.42, out: [0.4, 0.44], inn: [0.52, 0.61] }, tilt: [0.04, 0.8], tiltAmt: [0.42, 0.14] },
  berylEmpty: { hand: [[0, 'fore'], [0.05, 'fore'], [0.17, 'pouch'], [0.22, 'pouch'], [0.32, 'knock'], [0.36, 'knock'], [0.44, 'wellRock'], [0.5, 'well'], [0.53, 'well'], [0.6, 'charge'], [0.65, 'charge'], [0.71, 'chargeBack'], [0.74, 'charge'], [0.88, 'fore']],
    ev: [[0.33, 'magKnock'], [0.42, 'magFree'], [0.46, 'magInAk'], [0.51, 'magRock'], [0.68, 'chargeBack'], [0.74, 'chargeFwd']],
    drop: [0.33, 0.42], hide: [0.42, 0.51], spare: [0.19, 0.44, 0.51], rock: { amt: -0.42, out: [0.33, 0.37], inn: [0.44, 0.51] }, tilt: [0.03, 0.84], tiltAmt: [0.42, 0.14], charge: [0.65, 0.71, 0.74] },
  // M16A4: 멈치를 눌러 헌 탄창은 그냥 떨어뜨리고(drop-free) 새 탄창을 꽂음 · 빈 탄창이면 왼손바닥으로 노리쇠 멈치를 쳐서 닫음
  m16: { hand: [[0, 'fore'], [0.05, 'fore'], [0.2, 'pouch'], [0.3, 'pouch'], [0.46, 'well'], [0.52, 'well'], [0.72, 'fore']],
    ev: [[0.05, 'magRelease'], [0.2, 'magFree'], [0.44, 'magIn'], [0.5, 'magSeat']], drop: [0.06, 0.2], hide: [0.2, 0.3], inn: [0.3, 0.46], tilt: [0.03, 0.74], tiltAmt: [0.32, 0.1] },
  m16Empty: { hand: [[0, 'fore'], [0.04, 'fore'], [0.17, 'pouch'], [0.26, 'pouch'], [0.41, 'well'], [0.46, 'well'], [0.53, 'catch'], [0.565, 'catchIn'], [0.6, 'catch'], [0.76, 'fore']],
    ev: [[0.04, 'magRelease'], [0.17, 'magFree'], [0.39, 'magIn'], [0.45, 'magSeat'], [0.565, 'boltCatch']], drop: [0.05, 0.17], hide: [0.17, 0.26], inn: [0.26, 0.41], tilt: [0.03, 0.8], tiltAmt: [0.32, 0.1] },
  // Vector: 총구를 들고 탄창을 곧게 뺌 · 빈 탄창이면 왼쪽 접힌 손잡이를 펼쳐 당김
  vector: { hand: [[0, 'fore'], [0.1, 'well'], [0.24, 'pouch'], [0.38, 'pouch'], [0.52, 'well'], [0.58, 'well'], [0.78, 'fore']],
    ev: [[0.1, 'magRelease'], [0.14, 'magOut'], [0.5, 'magIn'], [0.56, 'magSeat']], out: [0.11, 0.24], hide: [0.24, 0.38], inn: [0.38, 0.52], tilt: [0.04, 0.76], tiltAmt: [0.16, -0.13] },
  vectorEmpty: { hand: [[0, 'fore'], [0.08, 'well'], [0.2, 'pouch'], [0.31, 'pouch'], [0.43, 'well'], [0.48, 'well'], [0.56, 'charge'], [0.62, 'charge'], [0.68, 'chargeBack'], [0.71, 'charge'], [0.86, 'fore']],
    ev: [[0.08, 'magRelease'], [0.12, 'magOut'], [0.42, 'magIn'], [0.47, 'magSeat'], [0.585, 'selector'], [0.66, 'chargeBack'], [0.71, 'chargeFwd']], out: [0.09, 0.2], hide: [0.2, 0.31], inn: [0.31, 0.43],
    tilt: [0.03, 0.84], tiltAmt: [0.16, -0.13], charge: [0.62, 0.68, 0.71], fold: [0.55, 0.6, 0.73, 0.79] },
  // PP-19 Bizon: 뒤 멈치를 누르고 원통 탄창 뒤쪽을 내려(앞 고리 축) 빼고, 새 탄창은 앞을 걸고 뒤를 올려 끼움
  helix: { hand: [[0, 'fore'], [0.08, 'well'], [0.12, 'well'], [0.2, 'wellRock'], [0.32, 'pouch'], [0.44, 'pouch'], [0.56, 'wellRock'], [0.64, 'well'], [0.68, 'well'], [0.84, 'fore']],
    ev: [[0.12, 'magRelease'], [0.2, 'magOut'], [0.55, 'magInAk'], [0.64, 'magRock']], out: [0.2, 0.32], hide: [0.32, 0.44], inn: [0.44, 0.56],
    rock: { amt: -0.3, out: [0.12, 0.2], inn: [0.56, 0.64] }, tilt: [0.04, 0.82], tiltAmt: [0.36, 0.06] },
  helixEmpty: { hand: [[0, 'fore'], [0.07, 'well'], [0.1, 'well'], [0.17, 'wellRock'], [0.27, 'pouch'], [0.37, 'pouch'], [0.47, 'wellRock'], [0.54, 'well'], [0.57, 'well'], [0.64, 'charge'], [0.68, 'charge'], [0.74, 'chargeBack'], [0.77, 'charge'], [0.9, 'fore']],
    ev: [[0.1, 'magRelease'], [0.17, 'magOut'], [0.46, 'magInAk'], [0.54, 'magRock'], [0.71, 'chargeBack'], [0.77, 'chargeFwd']], out: [0.17, 0.27], hide: [0.27, 0.37], inn: [0.37, 0.47],
    rock: { amt: -0.3, out: [0.1, 0.17], inn: [0.47, 0.54] }, tilt: [0.03, 0.86], tiltAmt: [0.36, 0.06], charge: [0.68, 0.74, 0.77] },
  // Tommy Gun: 드럼을 왼쪽으로 밀어 빼고 밀어 넣음 · 빈 탄창(노리쇠가 닫힘)이면 먼저 위 손잡이를 당겨 걸어 둠(열린 노리쇠)
  drum: { hand: [[0, 'fore'], [0.1, 'drum'], [0.14, 'drum'], [0.25, 'drumOut'], [0.35, 'pouch'], [0.46, 'pouch'], [0.58, 'drumOut'], [0.68, 'drum'], [0.72, 'drum'], [0.86, 'fore']],
    ev: [[0.12, 'drumLatch'], [0.16, 'drumOut'], [0.6, 'drumIn'], [0.68, 'drumSeat']], out: [0.14, 0.35], hide: [0.35, 0.46], inn: [0.46, 0.68], tilt: [0.04, 0.84], tiltAmt: [0.3, 0.06] },
  drumEmpty: { hand: [[0, 'fore'], [0.06, 'knob'], [0.1, 'knob'], [0.16, 'knobBack'], [0.2, 'knobBack'], [0.27, 'drum'], [0.3, 'drum'], [0.39, 'drumOut'], [0.48, 'pouch'], [0.58, 'pouch'], [0.68, 'drumOut'], [0.77, 'drum'], [0.8, 'drum'], [0.91, 'fore']],
    ev: [[0.13, 'knobBack'], [0.29, 'drumLatch'], [0.32, 'drumOut'], [0.7, 'drumIn'], [0.77, 'drumSeat']], out: [0.3, 0.48], hide: [0.48, 0.58], inn: [0.58, 0.77], tilt: [0.03, 0.88], tiltAmt: [0.3, 0.06], knob: [0.1, 0.16] },
  // DP-28: 위에 얹힌 원판 탄창을 들어 앞으로 빼고, 새 원판을 얹어 눌러 끼움
  pan: { hand: [[0, 'fore'], [0.1, 'pan'], [0.14, 'pan'], [0.25, 'panOut'], [0.37, 'pouch'], [0.49, 'pouch'], [0.61, 'panOut'], [0.71, 'pan'], [0.75, 'pan'], [0.88, 'fore']],
    ev: [[0.12, 'panLatch'], [0.17, 'panOff'], [0.62, 'panOn'], [0.71, 'panSeat']], out: [0.14, 0.37], hide: [0.37, 0.49], inn: [0.49, 0.71], tilt: [0.04, 0.86], tiltAmt: [-0.22, 0.12] },
  panEmpty: { hand: [[0, 'fore'], [0.08, 'pan'], [0.11, 'pan'], [0.2, 'panOut'], [0.3, 'pouch'], [0.4, 'pouch'], [0.5, 'panOut'], [0.59, 'pan'], [0.62, 'pan'], [0.655, 'fore'], [0.69, 'charge'], [0.72, 'charge'], [0.78, 'chargeBack'], [0.81, 'charge'], [0.92, 'fore']],
    ev: [[0.09, 'panLatch'], [0.13, 'panOff'], [0.51, 'panOn'], [0.59, 'panSeat'], [0.75, 'chargeBack'], [0.81, 'chargeFwd']], out: [0.11, 0.3], hide: [0.3, 0.4], inn: [0.4, 0.59],
    tilt: [0.03, 0.9], tiltAmt: [-0.22, 0.12], charge: [0.72, 0.78, 0.81] },
  // Deagle: 무거운 권총이라 더 기울여 갈고, 빈 탄창이면 오른손 엄지로 슬라이드 멈치를 눌러 닫음
  deagle: { hand: [[0, 'fore'], [0.1, 'well'], [0.28, 'pouch'], [0.42, 'pouch'], [0.56, 'well'], [0.62, 'well'], [0.8, 'fore']],
    ev: [[0.1, 'magRelease'], [0.16, 'magOut'], [0.54, 'magIn'], [0.6, 'magSeat']], out: [0.12, 0.28], hide: [0.28, 0.42], inn: [0.42, 0.56], tilt: [0.04, 0.76], tiltAmt: [0.4, 0.22] },
  deagleEmpty: { hand: [[0, 'fore'], [0.08, 'well'], [0.22, 'pouch'], [0.34, 'pouch'], [0.48, 'well'], [0.54, 'well'], [0.7, 'fore']],
    handR: [[0, 'grip'], [0.56, 'grip'], [0.615, 'stop'], [0.66, 'stop'], [0.72, 'grip']],
    ev: [[0.08, 'magRelease'], [0.13, 'magOut'], [0.46, 'magIn'], [0.52, 'magSeat'], [0.635, 'slideStop']], out: [0.1, 0.22], hide: [0.22, 0.34], inn: [0.34, 0.48],
    tilt: [0.03, 0.8], tiltAmt: [0.4, 0.22], slideRel: 0.635 },
});
// 빈 탄띠: 맨 앞에 장전손잡이 당기기를 끼워 넣는다
RL_TL.beltEmpty = (() => {
  const B = RL_TL.belt, k = 0.13, sc = (f) => k + f * (1 - k);
  return { hand: [[0, 'fore'], [0.04, 'charge'], [0.07, 'chargeBack'], [0.095, 'charge']].concat(B.hand.slice(1).map(([f, n]) => [sc(f), n])),
    ev: [[0.07, 'chargeBack'], [0.1, 'chargeFwd']].concat(B.ev.map(([f, n]) => [sc(f), n])),
    out: B.out.map(sc), hide: B.hide.map(sc), inn: B.inn.map(sc), tilt: [0.02, sc(0.92)], cover: B.cover.map(sc), charge: [0.04, 0.07, 0.095] };
})();
const CYCLE = {
  pump: { total: 0.55, ev: [[0.2, 'pumpBack'], [0.47, 'pumpFwd']], eject: 0.3 },
  bolt: { total: 1.05, ev: [[0.18, 'boltUp'], [0.38, 'boltBack'], [0.6, 'boltFwd'], [0.75, 'boltDown']], eject: 0.42 },
  boltClose: { total: 0.45, ev: [[0.15, 'boltFwd'], [0.55, 'boltDown']], eject: -1 },
  // 레버액션(Win94): 레버를 내려 빈 탄피를 위로 튕기고, 올려 다음 탄을 약실에
  lever: { total: 0.6, ev: [[0.16, 'leverDown'], [0.56, 'leverUp']], eject: 0.3 },
};
function reloadPlan(c, wi, d) {
  const empty = wi.mag === 0, ms = c.inv.magSize(wi);
  if (d.rKind === 'shell' || d.rKind === 'bolt' || d.rKind === 'break' || d.rKind === 'gate') {
    const n = Math.min(ms - wi.mag, c.inv.count(d.ammo));
    // 클립 장전(Kar98k): 탄창이 비었고 클립 한 개 분량이 있으면 → 볼트 열기 · 클립 꽂기 · 엄지로 5발 밀어 넣기 · 볼트 닫기(빈 클립 튕겨 나감)
    if (d.clip && d.rKind === 'bolt' && n >= d.clip) {
      const open = d.rOpen, ins = d.rClipIn, push = d.rClipPush, close = d.rClose, total = open + ins + push + close;
      const ev = [[open * 0.3, 'boltUp'], [open * 0.62, 'boltBack'], [open + ins * 0.85, 'clipIn'], [open + ins + push * 0.5, 'clipStrip'], [total - close * 0.62, 'boltFwd'], [total - close * 0.58, 'clipEject'], [total - close * 0.36, 'boltDown']];
      return { kind: 'bolt', clip: true, empty, n, open, ins, push, close, per: 0, total, events: ev, t: 0, ev: 0, canCancel: false, fired: ms - wi.mag };
    }
    const brk = d.rKind === 'break', gate = d.rKind === 'gate';
    // 장전구(Win94): 빈 상태였다면 끝에 레버를 한 번 (빈 탄피 배출 + 약실 장전)
    const open = d.rOpen, per = d.rShell, close = d.rClose + (empty && d.rKind === 'shell' ? d.rCloseEmpty : 0) + (empty && gate ? CYCLE.lever.total : 0);
    const total = open + n * per + close, ev = [];
    if (d.rKind === 'bolt') ev.push([open * 0.3, 'boltUp'], [open * 0.62, 'boltBack']);
    if (brk) ev.push([open * 0.35, 'breakOpen'], [open * 0.8, 'shellEject']);
    for (let i = 0; i < n; i++) ev.push([open + per * (i + (brk ? 0.8 : 0.7)), d.rKind === 'bolt' ? 'roundIn' : gate ? 'gateIn' : 'shellIn']);
    if (d.rKind === 'bolt') ev.push([total - close * 0.62, 'boltFwd'], [total - close * 0.36, 'boltDown']);
    else if (brk) ev.push([total - close * 0.45, 'breakClose']);
    else if (gate) { if (empty) { const L = CYCLE.lever.total; ev.push([total - L * 0.84, 'leverDown'], [total - L * 0.3, 'leverUp']); } }
    else if (empty) ev.push([total - close * 0.62, 'pumpBack'], [total - close * 0.32, 'pumpFwd']);
    // 중절식은 장전이 끝날 때까지 쏠 수 없다(총열이 열려 있음)
    return { kind: d.rKind, empty, n, open, per, close, total, events: ev, t: 0, ev: 0, canCancel: !brk, fired: ms - wi.mag };
  }
  const style = d.rStyle || (d.cls === 'PISTOL' ? 'pistol' : 'ar'), pistol = style === 'pistol';
  const total = (empty ? d.reloadEmpty || d.reload * 1.25 : d.reload) * (wi.att.mag ? 1.12 : 1);
  let T = empty ? RL_TL.magEmpty : RL_TL.mag, kind = 'mag';
  if (d.rKind === 'belt') { T = empty ? RL_TL.beltEmpty : RL_TL.belt; kind = 'belt'; }
  else if (d.rKind === 'boltmag' && empty) T = RL_TL.boltMag;
  else if (d.rTL) T = RL_TL[d.rTL + (empty ? 'Empty' : '')] || RL_TL[d.rTL] || T;
  const ak = style === 'ak';
  const ev = T.ev.map(([f, n]) => [f * total, pistol && n === 'chargeBack' ? 'slideBack' : pistol && n === 'chargeFwd' ? 'slideRelease' : ak && n === 'magIn' ? 'magInAk' : ak && n === 'magSeat' ? 'magRock' : n]);
  return { kind, style, empty, total, events: ev, t: 0, ev: 0, tl: T };
}
function startReload(c) {
  const wi = c.weapon; if (!wi || c.rl || c.equipT > 0 || c.cycle) return false;
  const d = ITEMS[wi.id], ms = c.inv.magSize(wi);
  if (wi.mag >= ms || c.inv.count(d.ammo) <= 0) return false;
  c.rl = reloadPlan(c, wi, d); c.aiming = false; c.burstQ = 0;
  return true;
}
function loadMag(c) {
  const wi = c.weapon; if (!wi) return;
  const d = ITEMS[wi.id];
  wi.mag += c.inv.take(d.ammo, c.inv.magSize(wi) - wi.mag);
  if (c.rl) c.rl.loaded = true;
}
function reloadEvent(c, name) {
  const wi = c.weapon, d = ITEMS[wi.id], rl = c.rl;
  if (name === 'magIn' || name === 'magInAk' || name === 'boxIn' || name === 'drumIn' || name === 'panOn' || name === 'clipStrip') loadMag(c);
  else if (name === 'shellIn' || name === 'roundIn' || name === 'gateIn') { if (wi.mag < c.inv.magSize(wi) && c.inv.take(d.ammo, 1)) wi.mag++; }
  if (name === 'pumpBack' || ((name === 'boltBack' || name === 'leverDown') && rl.empty)) ejectCase(c, d);
  if (name === 'shellEject') for (let i = 0; i < Math.min(2, rl.fired || 0); i++) ejectCase(c, d, true);
  if (name === 'magFree') dropPartFx(c, 'mag', 'mag:' + wi.id + ':' + (wi.att.mag ? 1 : 0), false);
  if (name === 'clipEject') dropPartFx(c, 'clip', 'clip', true);
  mechSound(c, name);
}
function updateReload(c, dt) {
  const rl = c.rl; if (!rl) return;
  if (!c.weapon) { c.rl = null; return; }
  rl.t += dt;
  while (c.rl && rl.ev < rl.events.length && rl.t >= rl.events[rl.ev][0]) { const e = rl.events[rl.ev][1]; rl.ev++; reloadEvent(c, e); }
  if (c.rl && rl.t >= rl.total) { if ((rl.kind === 'mag' || rl.kind === 'belt') && !rl.loaded) loadMag(c); c.rl = null; }
}
// 산탄총·볼트액션 장전 중 사격하면 중단(넣은 탄은 유지)
function cancelReload(c) {
  const rl = c.rl; if (!rl || !rl.canCancel) return;
  c.rl = null;
  if (rl.kind === 'bolt' && rl.t > rl.open * 0.35) c.cycle = { kind: 'boltClose', t: 0, ev: 0, ejected: true, total: CYCLE.boltClose.total };
  // 빈 상태에서 넣다 만 레버액션·펌프: 약실에 빈 탄피가 있으니 한 번 당겨 장전한 뒤 쏜다
  else if (rl.empty && (rl.kind === 'gate' || rl.kind === 'shell')) { const k = rl.kind === 'gate' ? 'lever' : 'pump'; c.cycle = { kind: k, t: 0, ev: 0, ejected: false, total: CYCLE[k].total }; }
  c.fireCd = Math.max(c.fireCd, rl.kind === 'bolt' ? 0.46 : 0.22);
}
function updateCycle(c, dt) {
  const cy = c.cycle; if (!cy) return;
  if (!c.weapon) { c.cycle = null; return; }
  const C = CYCLE[cy.kind]; cy.t += dt; const f = cy.t / (cy.total || C.total);
  while (cy.ev < C.ev.length && f >= C.ev[cy.ev][0]) { mechSound(c, C.ev[cy.ev][1]); cy.ev++; }
  if (!cy.ejected && C.eject >= 0 && f >= C.eject) { cy.ejected = true; ejectCase(c, ITEMS[c.weapon.id]); }
  if (f >= 1) c.cycle = null;
}

// ---------- 무기 애니메이션 (1인칭 손·3인칭 팔·총 부품 공용) ----------
const _ap = new THREE.Vector3(), _ap2 = new THREE.Vector3(), _ap3 = new THREE.Vector3();
// 1인칭 뷰모델 계산 중인지 (탄 주머니가 몸 옆이 아니라 총 바로 아래 화면 밖 → 손이 카메라 앞을 가리지 않음)
let ANIM_VM = false;
// 점 p를 축점 c 둘레로 x축 회전 (탄창 젖힘·레버)
function rotAboutX(p, c, a) { const y = p.y - c[1], z = p.z - c[2], ca = Math.cos(a), sa = Math.sin(a); p.y = c[1] + y * ca - z * sa; p.z = c[2] + y * sa + z * ca; return p; }
const addArr = (out, d) => out.set(out.x + d[0], out.y + d[1], out.z + d[2]);
function anchorPos(meta, name, out) {
  const mp = meta.magPos || [0, -0.02, 0.1];
  switch (name) {
    case 'fore': case 'vfore': return out.fromArray(meta.forePos);
    case 'grip': return out.fromArray(meta.gripPos);
    case 'well': if (meta.wellHand) return out.fromArray(meta.wellHand); return meta.pistol ? out.set(0.02, -0.14, -0.06) : out.set(mp[0] + 0.03, mp[1] - (meta.wellDrop || 0.075), mp[2] - 0.005);
    // v16: 젖힌 탄창 뒤쪽 · 탄창 쳐내기 · 노리쇠 멈치 · 위 장전 손잡이 · 드럼 · 원판 · 슬라이드 멈치 · 장전구 · 클립
    case 'wellRock': anchorPos(meta, 'well', out); return rotAboutX(out, mp, meta.rockAmt || -0.42);
    case 'knock': return out.fromArray(meta.knockHand || meta.forePos);
    case 'catch': return out.fromArray(meta.catchHand || meta.forePos);
    case 'catchIn': out.fromArray(meta.catchHand || meta.forePos); out.x -= 0.014; return out;
    case 'knob': return out.fromArray(meta.chargeHand || meta.forePos);
    case 'knobBack': out.fromArray(meta.chargeHand || meta.forePos); out.z -= meta.chargeTravel || 0.05; return out;
    case 'drum': return out.fromArray(meta.wellHand || meta.forePos);
    case 'drumOut': return addArr(out.fromArray(meta.wellHand || meta.forePos), meta.outDir || [0.12, 0, 0]);
    case 'pan': return out.fromArray(meta.panHand || meta.forePos);
    case 'panOut': return addArr(out.fromArray(meta.panHand || meta.forePos), meta.outDir || [0, 0.08, 0]);
    case 'stop': return out.fromArray(meta.stopHand || meta.gripPos);
    case 'gate': return out.fromArray(meta.gateHand || meta.gripPos);
    case 'clip': return out.fromArray(meta.clipHand || meta.gripPos);
    case 'clipPush': out.fromArray(meta.clipHand || meta.gripPos); out.y -= 0.05; return out;
    case 'pouch': return ANIM_VM ? out.set(mp[0] + 0.06, Math.min(mp[1], 0) - 0.36, mp[2] - 0.05) : out.set(0.17, -0.42, mp[2] - 0.12);
    case 'pouchR': return ANIM_VM ? out.set(-0.05, -0.34, -0.03) : out.set(-0.16, -0.38, -0.02);
    case 'charge': return out.fromArray(meta.chargeHand || meta.forePos);
    case 'chargeBack': out.fromArray(meta.chargeHand || meta.forePos); out.z -= (meta.chargeTravel || meta.slideTravel || 0.04); return out;
    case 'port': return out.fromArray(meta.loadPort || meta.forePos).add(_ap.set(0.025, -0.035, 0));
    case 'bolt': return out.fromArray(meta.boltHand || meta.gripPos);
    case 'boltUp': return out.fromArray(meta.boltHand || meta.gripPos).add(_ap.set(0.03, 0.035, 0));
    case 'boltBack': out.fromArray(meta.boltHand || meta.gripPos).add(_ap.set(0.03, 0.035, 0)); out.z -= meta.boltTravel || 0; return out;
    // 탄띠식: 덮개 뒤쪽 걸쇠 / 열린 덮개 / 급탄 트레이
    case 'cover': return out.fromArray(meta.coverHand || meta.forePos);
    case 'coverUp': {
      // 덮개 경첩(coverPos)을 축으로 손 위치를 열린 각도만큼 회전
      out.fromArray(meta.coverHand || meta.forePos); const cp = meta.coverPos || [0, 0, 0], a = (meta.coverAngle || 1.2) * 0.92;
      const y = out.y - cp[1], z = out.z - cp[2];
      return out.set(out.x + 0.01, cp[1] + y * Math.cos(a) - z * Math.sin(a), cp[2] + y * Math.sin(a) + z * Math.cos(a));
    }
    case 'tray': return out.fromArray(meta.trayHand || meta.forePos);
    // 중절식: 상단 레버 / 열린 약실 / 내려간 총열 덮개
    case 'lever': return out.fromArray(meta.leverHand || meta.gripPos);
    case 'breech': return out.fromArray(meta.breechHand || meta.forePos);
    case 'foreOpen': {
      out.fromArray(meta.forePos); const bp = meta.barrelPos || [0, 0, 0], a = meta.breakAngle || 0.4;
      const y = out.y - bp[1], z = out.z - bp[2];
      return out.set(out.x, bp[1] + y * Math.cos(a) - z * Math.sin(a), bp[2] + y * Math.sin(a) + z * Math.cos(a));
    }
  }
  return out.set(0, 0, 0);
}
function track(kf, t, meta, out, info) {
  let i = 0; while (i < kf.length - 1 && t >= kf[i + 1][0]) i++;
  if (i >= kf.length - 1 || t < kf[0][0]) { const n = kf[i >= kf.length - 1 ? kf.length - 1 : 0][1]; anchorPos(meta, n, out); if (info) { info.a = info.b = n; info.k = 1; } return; }
  const [t0, a] = kf[i], [t1, b] = kf[i + 1];
  const k = smoothstep01(clamp((t - t0) / Math.max(1e-4, t1 - t0), 0, 1));
  anchorPos(meta, a, out); anchorPos(meta, b, _ap2); out.lerp(_ap2, k);
  if (info) { info.a = a; info.b = b; info.k = k; }
}
const win = (t, a0, a1, b0, b1) => t <= a0 || t >= b1 ? 0 : t < a1 ? smoothstep01((t - a0) / (a1 - a0)) : t <= b0 ? 1 : 1 - smoothstep01((t - b0) / (b1 - b0));
function shellKf(rl, kind) {
  // 클립(Kar98k): 볼트 열기 → 오른손이 주머니에서 클립 → 홈에 꽂기 → 엄지로 누르기 → 볼트 닫기
  if (rl.clip) {
    const o = rl.open, i = rl.ins, p = rl.push, T = rl.total, c = rl.close;
    return [[0, 'grip'], [o * 0.2, 'bolt'], [o * 0.35, 'boltUp'], [o * 0.7, 'boltBack'], [o * 0.98, 'pouchR'], [o + i * 0.7, 'clip'], [o + i, 'clip'], [o + i + p * 0.45, 'clipPush'], [o + i + p * 0.8, 'clipPush'],
      [T - c * 0.8, 'boltBack'], [T - c * 0.55, 'boltUp'], [T - c * 0.3, 'bolt'], [T, 'grip']];
  }
  // 장전구(Win94): 오른손이 주머니 → 오른쪽 장전구로 한 발씩 밀어 넣음 → (빈 상태였으면) 손잡이로 돌아가 레버
  if (kind === 'gate') {
    const kf = [[0, 'grip'], [rl.open * 0.9, 'pouchR']];
    for (let i = 0; i < rl.n; i++) { const s = rl.open + i * rl.per; kf.push([s + rl.per * 0.5, 'gate'], [s + rl.per * 0.74, 'gate'], [s + rl.per * 0.98, 'pouchR']); }
    const T = rl.total, c = rl.close;
    kf.push([T - c * (rl.empty ? 0.86 : 0.6), 'grip'], [T, 'grip']);
    return kf;
  }
  if (kind === 'break') {
    const kf = [[0, 'fore'], [rl.open * 0.55, 'foreOpen'], [rl.open * 0.95, 'pouch']];
    for (let i = 0; i < rl.n; i++) { const s = rl.open + i * rl.per; kf.push([s + rl.per * 0.45, 'pouch'], [s + rl.per * 0.78, 'breech'], [s + rl.per * 0.98, i === rl.n - 1 ? 'breech' : 'pouch']); }
    const T = rl.total, c = rl.close;
    kf.push([T - c * 0.8, 'foreOpen'], [T - c * 0.3, 'fore'], [T, 'fore']);
    return kf;
  }
  const bolt = kind === 'bolt';
  const kf = bolt ? [[0, 'grip'], [rl.open * 0.2, 'bolt'], [rl.open * 0.35, 'boltUp'], [rl.open * 0.7, 'boltBack'], [rl.open * 0.98, 'pouchR']] : [[0, 'fore'], [rl.open * 0.85, 'pouch']];
  const home = bolt ? 'pouchR' : 'pouch';
  for (let i = 0; i < rl.n; i++) { const s = rl.open + i * rl.per; kf.push([s + rl.per * 0.55, 'port'], [s + rl.per * 0.72, 'port'], [s + rl.per * 0.98, home]); }
  const T = rl.total, c = rl.close;
  if (bolt) kf.push([T - c * 0.8, 'boltBack'], [T - c * 0.55, 'boltUp'], [T - c * 0.3, 'bolt'], [T, 'grip']);
  else kf.push([T - c * 0.75, 'fore'], [T, 'fore']);
  return kf;
}
const CYC_BOLT_KF = [[0, 'grip'], [0.12, 'bolt'], [0.25, 'boltUp'], [0.42, 'boltBack'], [0.62, 'boltUp'], [0.78, 'bolt'], [1, 'grip']];
const AN = { left: new THREE.Vector3(), right: new THREE.Vector3(), magOff: new THREE.Vector3(), magVis: true, magRot: 0, mag2Off: new THREE.Vector3(), mag2Vis: false, mag2Rot: 0, clipOff: new THREE.Vector3(), clipVis: false, clipPush: 0,
  tiltX: 0, tiltZ: 0, rw: 0, rk: 'L', charge: 0, fold: 0, pump: 0, boltUp: 0, boltBack: 0, slide: 0, cover: 0, breakOpen: 0, lever: 0, shellL: false, shellR: false, li: { a: 'fore', b: 'fore', k: 0 }, ri: { a: 'grip', b: 'grip', k: 0 } };
const ss = (t, a, b) => smoothstep01(clamp((t - a) / (b - a), 0, 1));
function weaponAnim(c, meta) {
  const A = AN, rl = c.rl, cy = c.cycle, wi = c.weapon;
  A.magOff.set(0, 0, 0); A.magVis = true; A.magRot = 0; A.tiltX = A.tiltZ = A.rw = 0; A.rk = 'L'; A.charge = A.fold = A.pump = A.boltUp = A.boltBack = A.slide = A.cover = A.breakOpen = A.lever = 0; A.shellL = A.shellR = false;
  A.mag2Off.set(0, 0, 0); A.mag2Vis = false; A.mag2Rot = 0; A.clipOff.set(0, 0, 0); A.clipVis = false; A.clipPush = 0;
  anchorPos(meta, 'fore', A.left); anchorPos(meta, 'grip', A.right);
  A.li.a = A.li.b = 'fore'; A.li.k = 0; A.ri.a = A.ri.b = 'grip'; A.ri.k = 0;
  if (rl && (rl.kind === 'mag' || rl.kind === 'belt')) {
    const T = rl.tl, f = rl.t / rl.total, inPh = (r) => r && f >= r[0] && f < r[1];
    track(T.hand, f, meta, A.left, A.li);
    if (T.handR) track(T.handR, f, meta, A.right, A.ri);
    const b = win(f, T.tilt[0], T.tilt[0] + 0.12, T.tilt[1] - 0.12, T.tilt[1]); A.rw = b; if (rl.style === 'bullpup') A.rk = 'B';   // 불펍은 탄창이 어깨 쪽이라 1인칭 보정 없음
    if (T.tiltAmt) { A.tiltZ = T.tiltAmt[0] * b; A.tiltX = T.tiltAmt[1] * b; }
    else if (rl.kind === 'belt') { A.tiltZ = 0.32 * b; A.tiltX = 0.12 * b; }
    else if (rl.style === 'bullpup') { A.tiltZ = 0.55 * b; A.tiltX = -0.12 * b; }
    else if (T.handR) { A.tiltZ = 0.3 * b; A.tiltX = 0.08 * b; }
    else { A.tiltZ = 0.45 * b; A.tiltX = 0.16 * b; }
    // 헌 탄창: 놓아 떨어뜨림(drop) / 손을 따라 빠짐(out) → 숨김(hide) → 새 탄창이 손을 따라 들어옴(inn)
    if (inPh(T.drop)) { const s = (f - T.drop[0]) * rl.total; A.magOff.set(0, -(4.9 * s * s + 0.35 * s), 0.12 * s); }
    else if (inPh(T.out)) { track(T.hand, T.out[0], meta, _ap3); A.magOff.copy(A.left).sub(_ap3); }
    else if (inPh(T.hide)) A.magVis = false;
    else if (inPh(T.inn)) { track(T.hand, T.inn[1], meta, _ap3); A.magOff.copy(A.left).sub(_ap3); }
    if (T.rock) {
      // 탄창 젖힘(앞 고리·magPos 축): 빠질 때 rock.out 동안 젖혀지고, 들어올 땐 젖힌 채 걸린 뒤 rock.inn 동안 제자리로
      const R = T.rock, end = T.hide ? T.hide[0] : 1;
      if (f >= R.out[0] && f < end) A.magRot = R.amt * ss(f, R.out[0], R.out[1]);
      if (T.inn && f >= T.inn[0] && f < R.inn[1]) A.magRot = R.amt * (1 - ss(f, R.inn[0], R.inn[1]));
    } else if (rl.style === 'ak' && rl.kind === 'mag' && T.out) {
      // AK식: 탄창 앞을 걸고 뒤로 젖혀 빼고·끼운다
      const r0 = T.out[0] - 0.04, r1 = T.out[0] + 0.03;
      if (f >= r0 && f < T.hide[0]) A.magRot = -0.42 * smoothstep01(clamp((f - r0) / (r1 - r0), 0, 1));
      else if (f >= T.inn[0] && f < T.inn[1] + 0.05) A.magRot = -0.42 * (1 - smoothstep01(clamp((f - (T.inn[1] - 0.04)) / 0.09, 0, 1)));
    }
    // 예비 탄창(새 탄창): 주머니에서 손에 들려 오다가 걸린 뒤 젖혀 끼워짐 → 끝나면 원래 탄창 자리로 바뀜
    if (T.spare && f >= T.spare[0] && f < T.spare[2]) {
      const [, s1] = T.spare, amt = T.rock ? T.rock.amt : 0;
      A.mag2Vis = true;
      if (f < s1) { track(T.hand, s1, meta, _ap3); A.mag2Off.copy(A.left).sub(_ap3); A.mag2Rot = amt; }
      else A.mag2Rot = T.rock ? amt * (1 - ss(f, T.rock.inn[0], T.rock.inn[1])) : 0;
    }
    if (T.charge) { const [c0, c1, c2] = T.charge; A.charge = f < c0 ? 0 : f < c1 ? (f - c0) / (c1 - c0) : f < c2 ? 1 - (f - c1) / (c2 - c1) : 0; }
    if (T.fold) A.fold = win(f, ...T.fold);
    if (T.boltUp) { A.boltUp = win(f, ...T.boltUp); A.boltBack = win(f, ...T.boltBack); }
    if (T.cover) A.cover = win(f, ...T.cover);
    if (meta.pistol) { A.slide = rl.empty ? (f < (T.slideRel || 0.73) ? 1 + 0.15 * A.charge : 0) : 0; A.charge = 0; }
    // 열린 노리쇠(Tommy Gun): 탄이 남은 채 갈면 손잡이는 뒤에 걸린 그대로, 빈 상태면 knob 구간에 당겨 건다
    if (meta.openBolt) A.charge = rl.empty ? (T.knob ? ss(f, T.knob[0], T.knob[1]) : 0) : 1;
  } else if (rl) {
    const kind = rl.kind, t = rl.t, kf = rl.kf || (rl.kf = shellKf(rl, kind));
    const b = win(t, 0, 0.25, rl.total - 0.3, rl.total); A.rw = b; A.rk = kind === 'bolt' || kind === 'gate' ? 'R' : 'L';
    if (kind === 'bolt') {
      track(kf, t, meta, A.right, A.ri); A.tiltZ = -0.18 * b; A.tiltX = 0.08 * b;
      const T = rl.total, cl = rl.close;
      A.boltUp = win(t, rl.open * 0.22, rl.open * 0.36, T - cl * 0.5, T - cl * 0.28);
      A.boltBack = win(t, rl.open * 0.38, rl.open * 0.7, T - cl * 0.8, T - cl * 0.55);
      if (rl.clip) {
        // 클립: 주머니에서 손에 들려 옴 → 홈에 꽂힘 → 탄이 눌려 내려감 → 볼트가 닫히며 빈 클립이 튕겨 나감
        const o = rl.open, ins = rl.ins, p = rl.push;
        A.clipVis = t >= o * 0.98 && t < T - cl * 0.58;
        if (t < o + ins * 0.7) { track(kf, o + ins * 0.7, meta, _ap3); A.clipOff.copy(A.right).sub(_ap3); }
        A.clipPush = clamp((t - (o + ins + p * 0.22)) / (p * 0.55), 0, 1);
        A.tiltZ = -0.12 * b; A.tiltX = 0.12 * b;
      }
    } else if (kind === 'gate') {
      // 장전구는 오른쪽 → 총을 왼쪽으로 눕혀 오른쪽 옆면을 보이게
      track(kf, t, meta, A.right, A.ri); A.tiltZ = -0.4 * b; A.tiltX = 0.1 * b;
      if (rl.empty) { const L = CYCLE.lever.total, T = rl.total; A.lever = win(t, T - L * 0.95, T - L * 0.7, T - L * 0.42, T - L * 0.14); }
    } else if (kind === 'break') {
      track(kf, t, meta, A.left, A.li); A.tiltZ = 0.4 * b; A.tiltX = 0.2 * b;
      const T = rl.total, cl = rl.close;
      A.breakOpen = win(t, rl.open * 0.2, rl.open * 0.55, T - cl * 0.62, T - cl * 0.3);
      // 오른손 엄지로 상단 레버를 민다
      const lv = win(t, 0.02, rl.open * 0.22, rl.open * 0.45, rl.open * 0.7);
      anchorPos(meta, 'lever', _ap3); A.right.lerp(_ap3, lv); if (lv > 0.5) { A.ri.a = A.ri.b = 'lever'; A.ri.k = 1; }
    } else {
      track(kf, t, meta, A.left, A.li); A.tiltZ = 0.7 * b; A.tiltX = 0.15 * b;
      if (rl.empty) A.pump = win(t, rl.total - rl.close * 0.78, rl.total - rl.close * 0.58, rl.total - rl.close * 0.42, rl.total - rl.close * 0.22);
    }
    if (!rl.clip && t > rl.open && t < rl.open + rl.n * rl.per) {
      const ph = ((t - rl.open) % rl.per) / rl.per, lo = kind === 'break' ? 0.3 : 0.15, hi = kind === 'break' ? 0.8 : 0.72;
      if (ph > lo && ph < hi) { if (kind === 'bolt' || kind === 'gate') A.shellR = true; else A.shellL = true; }
    }
  }
  if (cy) {
    const C = CYCLE[cy.kind], f = cy.t / (cy.total || C.total);
    if (cy.kind === 'pump') A.pump = win(f, 0.12, 0.38, 0.42, 0.66);
    else if (cy.kind === 'bolt') { track(CYC_BOLT_KF, f, meta, A.right, A.ri); A.boltUp = win(f, 0.12, 0.25, 0.68, 0.8); A.boltBack = win(f, 0.28, 0.42, 0.5, 0.64); }
    else if (cy.kind === 'lever') A.lever = win(f, 0.06, 0.32, 0.46, 0.76);
    else { A.boltBack = 1 - smoothstep01(clamp(f / 0.35, 0, 1)); A.boltUp = 1 - smoothstep01(clamp((f - 0.35) / 0.4, 0, 1)); }
  }
  if (meta.pumpTravel && A.li.a === 'fore' && A.li.b === 'fore') A.left.z -= meta.pumpTravel * A.pump;
  // 레버: 손가락이 고리에 들어 있으니 오른손도 레버 축 둘레로 (손바닥은 덜 움직임)
  if (A.lever > 0 && meta.leverPos && A.ri.a === 'grip' && A.ri.b === 'grip') rotAboutX(A.right, meta.leverPos, -(meta.leverAngle || 0.9) * A.lever * 0.55);
  if (meta.pistol && !rl) { if (wi && wi.mag === 0) A.slide = 1; else if (c.slideKick > 0) A.slide = Math.sin(clamp(1 - c.slideKick / 0.09, 0, 1) * Math.PI); }
  // 연사 중 장전손잡이가 함께 움직이는 총(AK 계열·MG): 사격 직후 잠깐 뒤로
  if (meta.chargeRecip && !rl && c.fireCd > 0 && wi) { const per = 60 / fireRpm(wi), k = clamp(c.fireCd / per, 0, 1); A.charge = Math.max(A.charge, Math.sin(k * Math.PI) * 0.9); }
  // 열린 노리쇠(Tommy Gun): 탄이 있으면 뒤에 걸려 있고, 쏠 때마다 앞으로 갔다 돌아옴. 다 쏘면 닫힌 채
  if (meta.openBolt && wi && !rl) { A.charge = wi.mag > 0 ? 1 : 0; if (c.fireCd > 0 && wi.mag > 0) { const per = 60 / fireRpm(wi), k = clamp(c.fireCd / per, 0, 1); A.charge = 1 - 0.95 * Math.sin(k * Math.PI); } }
  // 앞 수직 손잡이(내장·부착): 왼손도 권총 손잡이처럼 감싸 쥔다
  if (meta.vfore) { if (A.li.a === 'fore') A.li.a = 'vfore'; if (A.li.b === 'fore') A.li.b = 'vfore'; }
  return A;
}
function applyParts(gun, A) {
  const P = gun.userData.parts, m = gun.userData.meta;
  if (P.mag) { P.mag.position.copy(P.mag.userData.home).add(A.magOff); P.mag.visible = A.magVis; P.mag.rotation.x = A.magRot; }
  if (P.mag2) { P.mag2.visible = A.mag2Vis; if (A.mag2Vis) { P.mag2.position.copy(P.mag2.userData.home).add(A.mag2Off); P.mag2.rotation.x = A.mag2Rot; } }
  if (P.charge) { P.charge.position.copy(P.charge.userData.home); P.charge.position.z -= m.chargeTravel * A.charge; if (m.chargeFold) P.charge.rotation.y = m.chargeFold * A.fold; }
  if (P.pump) { P.pump.position.copy(P.pump.userData.home); P.pump.position.z -= m.pumpTravel * A.pump; }
  if (P.bolt) { P.bolt.position.copy(P.bolt.userData.home); P.bolt.position.z -= m.boltTravel * A.boltBack; P.bolt.rotation.z = -(m.boltLift || 1.25) * A.boltUp; }
  if (P.slide) { P.slide.position.copy(P.slide.userData.home); P.slide.position.z -= m.slideTravel * A.slide; }
  if (P.cover) P.cover.rotation.x = (m.coverAngle || 1.2) * A.cover;
  if (P.barrel) P.barrel.rotation.x = (m.breakAngle || 0.4) * A.breakOpen;
  if (P.lever) P.lever.rotation.x = -(m.leverAngle || 0.9) * A.lever;
  if (P.clip) {
    P.clip.visible = A.clipVis;
    if (A.clipVis) { P.clip.position.copy(P.clip.userData.home).add(A.clipOff); const r = P.clip.userData.rounds; r.visible = A.clipPush < 0.98; r.position.y = -0.06 * smoothstep01(A.clipPush); }
  }
}

// ---------- 피해 ----------
function applyDamage(t, dmg, part, attacker, cause, hx, hy, hz) {
  if (!t.alive || t.mode === 'plane') return 0;
  if (t.isPlayer && Dev.cheat('god')) return 0;   // 개발자 도구: 무적 (같이 하기에선 꺼짐)
  if (sameTeam(attacker, t)) return 0; // 팀원 공격 없음 (총·주먹·수류탄·차량)
  if (G.dm && t.spawnProt > G.time) return 0; // 데스매치 부활 직후 보호
  if (attacker && attacker !== t) shareHit(attacker, t);
  if (attacker && attacker.isPlayer && part === 'head' && attacker !== t && !t.dummy && !sameTeam(attacker, t)) attacker.headshots = (attacker.headshots || 0) + 1;
  if (G.net && !Net.mine(t)) return Net.remoteHit(t, dmg, part, attacker, cause, hx, hy, hz); // 다른 기기 캐릭터: 주인 기기가 판정
  if (t.knocked) return damageKnocked(t, dmg, part, attacker, cause);
  let d = dmg;
  const armor = (slot, mult) => {
    const g = t.inv.gear[slot]; if (!g) return;
    const red = ITEMS[g.id].red; g.dur -= d * mult; d *= 1 - red;
    if (g.dur <= 0) { t.inv.gear[slot] = null; t.setVisibleGear(); if (t.isPlayer) HUD.toast(ITEMS[g.id].name + ' 파손'); }
  };
  if (part === 'head') { d *= 2.1; armor('helmet', 1); }
  else if (part === 'body') armor('vest', 1);
  else if (part === 'legs') d *= 0.9;
  else if (part === 'blast') armor('vest', 0.5);
  // 'impact' (차량 충돌·들이받기): 방어구 무시
  d = Math.max(0, d);
  if (t.dummy) return Training.hit(t, d, part, attacker, cause, hx, hy, hz); // 훈련장 더미: 쓰러져도 다시 일어남
  t.hp -= d; t.lastDamageT = G.time;
  if (attacker && attacker !== t) { t.lastAttacker = attacker; attacker.damageDealt += d; }
  t.anim.flinch = Math.min(1, t.anim.flinch + d / 30); t.anim.flinchDir = Math.random() < 0.5 ? -1 : 1;
  if (t.heal && cause !== 'zone') { t.heal = null; if (t.isPlayer) HUD.toast('회복이 중단되었습니다'); }
  if (t.isPlayer) { HUD.damage(attacker && attacker !== t ? attacker.pos : null, d); if (cause !== 'zone') Audio.hurt(); }
  if (attacker && attacker.isPlayer && attacker !== t) { HUD.hitmarker(part === 'head', t.hp <= 0); part === 'head' ? Audio.headshot() : Audio.hitmarker(); }
  if (t.brain) t.brain.onDamaged(attacker, cause);
  if (t.hp <= 0 && G.training && t.isPlayer) { Training.playerDown(t); return d; }
  if (t.hp <= 0) { if (canKnock(t)) knockChar(t, attacker, cause); else killChar(t, attacker, cause); }
  return d;
}
// 팀 정보: 맞은 쪽 팀원은 쏜 적의 위치를, 쏜 쪽 팀원은 맞힌 적의 위치를 안다 (집중 사격·지원용)
function shareHit(a, t) {
  a.lastTarget = t; a.lastTargetT = G.time;
  if (!(G.teamSize > 1) || G.noIntel) return;
  if (G.time - (t._shT || -9) > 1) { t._shT = G.time; for (const m of teamMembers(t)) if (m !== t && m.brain && standing(m)) m.brain.reportEnemy(a, a.pos.x, a.pos.z); }
  if (G.time - (a._shT2 || -9) > 1) { a._shT2 = G.time; for (const m of teamMembers(a)) if (m !== a && m.brain && standing(m)) m.brain.reportEnemy(t, t.pos.x, t.pos.z); }
}
// ---------- 기절·부활 (듀오·스쿼드) ----------
// 서 있는 팀원이 남아 있으면 쓰러져도 바로 죽지 않고 기절한다. 마지막 팀원이 쓰러지면 팀 전멸.
function canKnock(t) { return !G.dm && G.teamSize > 1 && t.mode === 'ground' && teamHasStanding(t.team, t); }
function damageKnocked(t, dmg, part, attacker, cause) {
  const d = Math.max(0, dmg * (part === 'head' ? 1.5 : 1)); // 기절 중엔 방어구가 막아 주지 않는다
  t.hp -= d; t.lastDamageT = G.time;
  if (attacker && attacker !== t) { t.lastAttacker = attacker; attacker.damageDealt += d; }
  t.anim.flinch = Math.min(1, t.anim.flinch + d / 40);
  if (t.isPlayer) { HUD.damage(attacker && attacker !== t ? attacker.pos : null, d); if (cause !== 'zone') Audio.hurt(); }
  if (attacker && attacker.isPlayer && attacker !== t) { HUD.hitmarker(part === 'head', t.hp <= 0); part === 'head' ? Audio.headshot() : Audio.hitmarker(); }
  if (t.brain) t.brain.onDamaged(attacker, cause);
  if (t.hp <= 0) killChar(t, attacker && attacker !== t ? attacker : t.knockedBy, cause);
  return d;
}
const causeName = (cause) => cause && ITEMS[cause] ? ITEMS[cause].name : ({ zone: '자기장', fall: '낙하', frag: '수류탄', fist: '주먹', veh: '차량', vexp: '차량 폭발', crash: '충돌', bleed: '출혈', wipe: '팀 전멸' }[cause] || '');
function knockChar(t, attacker, cause) {
  const by = attacker && attacker !== t ? attacker : null;
  t.knocked = true; t.knockN++; t.knockedBy = by; t.hp = 100; t.knockT = G.time;
  t.heal = null; t.rl = null; t.cycle = null; t.aiming = false; t.sprint = false; t.burstQ = 0; t.fireHold = false; t.combatFacing = false;
  if (t.revive) cancelRevive(t);
  if (t.veh) Veh.exit(t, true, true);
  t.stance = 'prone'; t.setVisibleGear();
  if (by) by.knocks++;
  if (G.knockLog) G.knockLog.push({ t: Math.round(G.time), cause, by: by ? (by.isPlayer ? 'player' : 'bot') : 'env' });
  HUD.killfeed(by ? by.name : null, t.name, causeName(cause), by && by.isPlayer, t.isPlayer, 'knock', G.player && sameTeam(G.player, t));
  if (t.isPlayer) { HUD.toast('기절했습니다! 팀원이 부활시켜 줄 때까지 기어서 버티세요', 'warn'); HUD.setLoot([]); Audio.hurt(); }
  else if (G.player && sameTeam(G.player, t)) HUD.toast(`팀원 ${t.name} 기절!`, 'warn');
  if (t.brain) t.brain.onKnocked();
  if (G.net) Net.sendKnock(t, by, cause);
}
function startRevive(c, m) {
  if (!c.alive || c.knocked || c.veh || c.revive || !m.alive || !m.knocked || !sameTeam(c, m)) return false;
  if (m.revivedBy && m.revivedBy !== c && m.revivedBy.revive) return false;
  c.revive = { tgt: m, t: 0, total: REVIVE_T }; m.revivedBy = c;
  if (G.net) Net.sendRevive(c, m, 'start');
  c.heal = null; c.rl = null; c.aiming = false; c.sprint = false; c.burstQ = 0; c.vel.x = c.vel.z = 0;
  if (c.stance === 'stand') c.stance = 'crouch';
  if (c.isPlayer) { HUD.toast(`${m.name} 부활 중 — 움직이면 취소됩니다`, 'info'); Audio.heal('firstaid', 'start'); }
  else if (m.isPlayer) HUD.toast(`${c.name}이(가) 부활시키는 중`, 'ok');
  return true;
}
function cancelRevive(c, quiet) {
  const r = c.revive; if (!r) return;
  c.revive = null; if (r.tgt.revivedBy === c) r.tgt.revivedBy = null;
  if (G.net && Net.mine(c)) Net.sendRevive(c, r.tgt, 'stop');
  if (!quiet && (c.isPlayer || r.tgt.isPlayer)) HUD.toast('부활이 중단되었습니다', 'warn');
}
function updateRevive(c, dt) {
  const r = c.revive, m = r.tgt;
  if (!c.alive || c.knocked || c.veh || !m.alive || !m.knocked || Math.hypot(m.pos.x - c.pos.x, m.pos.z - c.pos.z) > 2.6 || Math.abs(m.pos.y - c.pos.y) > 1.8) { cancelRevive(c); return; }
  m.revivedBy = c; r.t += dt;
  if (r.t < r.total) return;
  c.revive = null; c.revives++;
  if (G.net) Net.sendRevive(c, m, 'done');
  m.knocked = false; m.revivedBy = null; m.knockedBy = null; m.hp = REVIVE_HP; m.stance = 'crouch'; m.setVisibleGear();
  if (m.brain) m.brain.onRevived();
  if (m.isPlayer) HUD.toast(`${c.name}이(가) 부활시켰습니다`, 'ok');
  else if (c.isPlayer) HUD.toast(`${m.name} 부활 완료`, 'ok');
  else if (G.player && sameTeam(G.player, m)) HUD.toast(`팀원 ${m.name} 부활`, 'ok');
}
// 기절 중 출혈 (부활받는 동안은 멈춤)
function updateKnocked(c, dt) {
  if (G.net && !Net.mine(c)) return;
  if (c.revivedBy && c.revivedBy.revive && c.revivedBy.revive.tgt === c) return;
  c.revivedBy = null;
  c.hp -= dt * 100 / BLEED_T[Math.min(c.knockN, BLEED_T.length) - 1];
  if (c.hp <= 0) killChar(c, c.knockedBy, 'bleed');
}
function killChar(t, attacker, cause) {
  if (!t.alive) return;
  if (G.net && !Net.mine(t)) { Net.killReq(t, attacker, cause); return; } // 다른 기기 캐릭터: 주인에게 요청
  const aliveBefore = CHARS.filter(c => c.alive).length, wasKnocked = t.knocked;
  t.alive = false; t.hp = 0; t.deathTime = G.time; t.place = aliveBefore;
  t.heal = null; t.reloadT = 0; t.cycle = null; t.aiming = false; t.vel.set(0, 0, 0);
  if (t.revive) cancelRevive(t, true);
  if (t.revivedBy) { const rv = t.revivedBy; t.revivedBy = null; if (rv.revive && rv.revive.tgt === t) rv.revive = null; }
  t.knocked = false;
  if (t.veh) Veh.exit(t, true, true);
  if (attacker && attacker !== t) attacker.kills++;
  if (G.killLog) G.killLog.push({ t: Math.round(G.time), cause, kn: wasKnocked, by: attacker && attacker !== t ? (attacker.isPlayer ? 'player' : 'bot') : 'env' });
  // 사망 시 소지품을 주변에 떨어뜨림 (루팅 가능)
  const sc = G.scene, drop = (id, n, inst) => { const a = Math.random() * TAU, r = 0.4 + Math.random() * 0.9; spawnItem(sc, id, n, t.pos.x + Math.cos(a) * r, groundAt(t.pos.x + Math.cos(a) * r, t.pos.z + Math.sin(a) * r, t.pos.y + 0.5), t.pos.z + Math.sin(a) * r, inst); };
  if (!G.dm) { // 데스매치는 떨어뜨리지 않는다 (부활하면 새로 지급)
    for (const wi of t.inv.weapons) if (wi) drop(wi.id, 1, wi);
    for (const k in t.inv.gear) if (t.inv.gear[k]) drop(t.inv.gear[k].id, 1, t.inv.gear[k]);
    for (const id in t.inv.items) drop(id, t.inv.items[id]);
  }
  t.inv.weapons = [null, null, null]; t.inv.items = {}; t.inv.cur = -1; t.inv.gear = { helmet: null, vest: null, bag: null };
  t.setVisibleGear();
  HUD.killfeed(attacker && attacker !== t ? attacker.name : null, t.name, causeName(cause), attacker && attacker.isPlayer, t.isPlayer, cause === 'wipe' ? 'wipe' : '', G.player && sameTeam(G.player, t));
  Audio.death(t.pos);
  SkinFx.kill(t, attacker, cause);   // 울트라레어 스킨 총으로 처치하면 그 자리에 큰 효과
  // 팀: 서 있는 팀원이 없으면 기절한 팀원도 모두 탈락 (기절시킨 적에게 처치 인정)
  if (G.teams && G.teamSize > 1 && !teamHasStanding(t.team)) for (const m of G.teams[t.team].members) if (m.alive && m.knocked) killChar(m, m.knockedBy, 'wipe');
  if (G.teams) { const T = G.teams[t.team]; if (T && !T.place && !teamAlive(T)) T.place = aliveTeamCount() + 1; }
  if (G.net) Net.sendDeath(t, attacker, cause);
  G.onDeath(t, attacker);
}

// ---------- 투척물 ----------
let PROJ = [], SMOKES = [];
// 핀을 뽑은 뒤 터지기까지(초). fuse 인자 = 던지는 순간 남은 시간
const FUSE = { frag: 7, smoke: 3 };
function throwItem(c, type, origin, dir, power, fuse) {
  if (c.inv.take(type, 1) <= 0) return false;
  const pr = { type, owner: c, x: origin.x, y: origin.y, z: origin.z, vx: dir.x * power, vy: dir.y * power + 3.2, vz: dir.z * power, t: 0, fuse: fuse !== undefined ? fuse : FUSE[type], mesh: FX.grenadeMesh(type) };
  PROJ.push(pr);
  if (G.net) Net.sendThrow(c, pr);
  if (!c.isPlayer) { c.throwAnim = 0.35; if (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 25) Audio.spoon(c.pos, false); }
  return pr;
}
// 투척물은 1/60초 단위로 나눠 계산 → 프레임률과 상관없이 궤적 미리보기와 같은 곳에 떨어진다
function updateProjectiles(dt) {
  const n = Math.max(1, Math.ceil(dt * 60 - 1e-6));
  for (let k = 0; k < n; k++) stepProjectiles(dt / n);
  for (let i = SMOKES.length - 1; i >= 0; i--) { const s = SMOKES[i]; if (!FX.updateSmoke(s, dt)) SMOKES.splice(i, 1); }
}
function stepProjectiles(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i]; p.t += dt;
    p.vy -= GRAVITY * 0.9 * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    if (sp > 0.1) {
      const L = sp * dt, r = rayBoxes(p.x, p.y, p.z, p.vx / sp, p.vy / sp, p.vz / sp, L + 0.1, true);
      if (r.t <= L + 0.1) {
        if (sp > 3) Audio.nadeBounce(p);
        if (r.nx) p.vx *= -0.4; if (r.ny) p.vy *= -0.35; if (r.nz) p.vz *= -0.4;
        p.vx *= 0.7; p.vz *= 0.7;
      } else { p.x = nx; p.y = ny; p.z = nz; }
    }
    const g = groundAt(p.x, p.z, p.y + 0.3);
    if (p.y < g + 0.08) { if (p.vy < -3) Audio.nadeBounce(p); p.y = g + 0.08; if (p.vy < 0) p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; if (Math.abs(p.vy) < 0.6) p.vy = 0; }
    p.mesh.position.set(p.x, p.y, p.z); p.mesh.rotation.x += dt * 8;
    if (p.t >= p.fuse) {
      if (p.type === 'frag') explode(p);
      else SMOKES.push(FX.smoke(p.x, p.y, p.z));
      G.scene.remove(p.mesh); PROJ.splice(i, 1); if (G.myNade === p) G.myNade = null;
    }
  }
}
function explode(p) {
  FX.explosion(p.x, p.y, p.z); Audio.explosion(p);
  G.noises.push({ x: p.x, y: p.y, z: p.z, t: G.time, r: 220, by: p.owner, kind: 'blast' });
  if (p.remote) { if (G.player && G.player.alive) { const d = Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z); if (d < 40) G.shake = Math.max(G.shake, (1 - d / 40) * 1.2); } return; } // 다른 기기 수류탄: 피해는 던진 쪽이 판정
  for (const c of CHARS) {
    if (!c.alive || c.mode !== 'ground') continue;
    c.chest(_v1); const d = _v1.distanceTo(_v2.set(p.x, p.y + 0.3, p.z));
    if (d > 9) continue;
    const cover = losClear(p.x, p.y + 0.4, p.z, _v1.x, _v1.y, _v1.z) ? 1 : 0.15;
    // 손에 쥔 채 터지면 방탄조끼와 상관없이 치명상
    applyDamage(c, p.inHand && c === p.owner ? 400 : 160 * Math.pow(1 - d / 9, 1.35) * cover, 'blast', p.owner, 'frag');
  }
  if (G.player && G.player.alive) { const d = Math.hypot(G.player.pos.x - p.x, G.player.pos.z - p.z); if (d < 40) G.shake = Math.max(G.shake, (1 - d / 40) * 1.2); }
  Veh.blast(p.x, p.y, p.z, 8, 420, p.owner);
}
function smokeBlocks(ox, oy, oz, dx, dy, dz, L) {
  for (const s of SMOKES) {
    if (s.r < 2) continue;
    const sx = s.x - ox, sy = s.y + 1.5 - oy, sz = s.z - oz, b = sx * dx + sy * dy + sz * dz;
    if (b < 0 || b > L + s.r) continue;
    const d2 = sx * sx + sy * sy + sz * sz - b * b;
    if (d2 < s.r * s.r * 0.8) return true;
  }
  return false;
}

// ---------- 시각 효과 ----------
const FX = (() => {
  let scene = null, tracers = [], dots = [], flashes = [], dotTex = null, smokeTex = null, ti = 0, di = 0, fi = 0;
  let starTex = null, flameTex = null, vmFlash = null, cases = [];
  function tex(soft, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(soft, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c);
  }
  function init(sc) {
    scene = sc; tracers = []; dots = []; flashes = [];
    SkinFx.init(sc);
    dotTex = dotTex || tex(0.35); smokeTex = smokeTex || tex(0.6, 128);
    for (let i = 0; i < 40; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.8 }));
      l.visible = false; l.frustumCulled = false; scene.add(l); tracers.push({ l, life: 0 });
    }
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false }));
      s.visible = false; scene.add(s); dots.push({ s, life: 0, max: 1, grow: 1, vy: 0 });
    }
    starTex = starTex || makeStar(); flameTex = flameTex || makeFlame();
    for (let i = 0; i < 10; i++) { const f = flashObj(); scene.add(f); flashes.push({ o: f, life: 0 }); }
    cases = []; vmFlash = null;
  }
  // 총구 화염: 정면 별 모양 + 총열 방향 불꽃 2장(십자) — 가산 혼합, 매 발 회전·크기 변화
  function makeStar() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.18, 'rgba(255,200,110,0.9)'); gr.addColorStop(0.5, 'rgba(255,120,30,0.25)'); gr.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + Math.random() * 0.3, L = 40 + Math.random() * 22; g.strokeStyle = 'rgba(255,215,140,0.75)'; g.lineWidth = 3 + Math.random() * 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * L, 64 + Math.sin(a) * L); g.stroke(); }
    return new THREE.CanvasTexture(c);
  }
  function makeFlame() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,245,210,1)'); gr.addColorStop(0.3, 'rgba(255,190,90,0.85)'); gr.addColorStop(0.75, 'rgba(255,110,30,0.3)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 32); g.quadraticCurveTo(40, 2, 128, 26); g.lineTo(128, 38); g.quadraticCurveTo(40, 62, 0, 32); g.fill();
    return new THREE.CanvasTexture(c);
  }
  function flashObj() {
    const o = new THREE.Group(), inner = new THREE.Group(); o.add(inner);
    const sm = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sp = new THREE.Sprite(sm); sp.scale.setScalar(0.55); inner.add(sp);
    const fm = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const pg = new THREE.PlaneGeometry(1.2, 0.4); pg.translate(0.6, 0, 0); pg.rotateY(-Math.PI / 2);
    inner.add(new THREE.Mesh(pg, fm)); const p2 = new THREE.Mesh(pg, fm); p2.rotation.z = Math.PI / 2; inner.add(p2);
    o.visible = false; o.userData.inner = inner; return o;
  }
  const _fv = new THREE.Vector3();
  function flash(c, gun, meta, pos, dir, d) {
    if (!scene) return;
    const k = ({ PISTOL: 0.6, SMG: 0.7, AR: 0.9, LMG: 1.0, DMR: 1.0, SR: 1.15, SG: 1.2 }[d.cls] || 1) * (d.ammo === 'a300' ? 1.25 : 1) * (c.weapon && c.weapon.att.muzzle ? 0.6 : 1);
    if (gun && gun === VM.gun && VM.scene) {
      if (!vmFlash) { vmFlash = { o: flashObj(), life: 0 }; VM.scene.add(vmFlash.o); }
      const o = vmFlash.o; _fv.set(0, meta.boreY, meta.muzzleZ + 0.012); gun.localToWorld(_fv); o.position.copy(_fv);
      _fv.set(0, meta.boreY, meta.muzzleZ + 1); gun.localToWorld(_fv); o.lookAt(_fv);
      o.scale.setScalar(0.11 * k * (0.8 + Math.random() * 0.45)); o.userData.inner.rotation.z = Math.random() * TAU; o.visible = true; vmFlash.life = 0.04;
      if (VM.flashLight) { VM.flashLight.position.copy(o.position); VM.flashLight.intensity = 2.2; }
      return;
    }
    if (!c.isPlayer && G.player && Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z) > 230) return;
    const f = flashes[fi++ % flashes.length], o = f.o;
    o.position.copy(pos); _fv.copy(pos).add(dir); o.lookAt(_fv);
    o.scale.setScalar(0.36 * k * (0.8 + Math.random() * 0.45)); o.userData.inner.rotation.z = Math.random() * TAU; o.visible = true; f.life = 0.045;
    if (G.muzzleLight && (c.isPlayer || Math.hypot(pos.x - G.camera.position.x, pos.z - G.camera.position.z) < 40)) { G.muzzleLight.position.copy(pos); G.muzzleLight.intensity = c.isPlayer ? 2.6 : 1.8; }
  }
  // 탄피: 중력·튕김·회전, 첫 바닥 충돌 때 소리
  function casing(pos, vel, kind, sound) {
    if (!scene) return;
    let c = null, n = 0, oldest = null;
    for (const k of cases) { if (k.kind !== kind) continue; n++; if (k.life <= 0) { c = k; break; } if (!oldest || k.life < oldest.life) oldest = k; }
    if (!c) { if (n >= 16) c = oldest; else { c = { obj: Models.casing(kind), kind, life: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() }; scene.add(c.obj); cases.push(c); } }
    c.obj.position.copy(pos); c.vel.copy(vel); c.spin.set(rnd(-25, 25), rnd(-25, 25), rnd(-10, 10));
    c.life = 3.2; c.bounces = 0; c.sound = sound; c.obj.visible = true;
  }
  function updateCases(dt) {
    for (const c of cases) {
      if (c.life <= 0) continue;
      c.life -= dt; if (c.life <= 0) { c.obj.visible = false; continue; }
      const p = c.obj.position;
      c.vel.y -= 9.8 * dt; p.addScaledVector(c.vel, dt);
      c.obj.rotation.x += c.spin.x * dt; c.obj.rotation.y += c.spin.y * dt; c.obj.rotation.z += c.spin.z * dt;
      const gy = groundAt(p.x, p.z, p.y + 0.25) + 0.006;
      if (p.y < gy) {
        p.y = gy;
        if (c.vel.y < -0.6 && c.bounces < 3) { if (c.sound && c.bounces === 0) Audio.brass(p, c.kind); c.vel.y *= -0.32; c.vel.x *= 0.5; c.vel.z *= 0.5; c.spin.multiplyScalar(0.5); c.bounces++; }
        else { c.vel.set(0, 0, 0); c.spin.set(0, 0, 0); c.obj.rotation.x = Math.PI / 2; }
      }
    }
  }
  function tracer(c, o, ex, ey, ez, col) {
    if (!scene) return;
    // 멀리 있는 봇의 탄도는 생략 (성능)
    if (!c.isPlayer && G.player && Math.hypot(o.x - G.player.pos.x, o.z - G.player.pos.z) > 180) return;
    const t = tracers[ti++ % tracers.length], p = t.l.geometry.attributes.position;
    const sx = c.isPlayer ? o.x : o.x, sy = o.y, sz = o.z;
    p.setXYZ(0, sx, sy, sz); p.setXYZ(1, ex, ey, ez); p.needsUpdate = true; t.l.geometry.computeBoundingSphere();
    t.l.visible = true; t.life = 0.06; t.l.material.opacity = 0.75; t.l.material.color.setHex(col || 0xffe2a0);
  }
  function puff(x, y, z, color, size, life, grow, vy) {
    if (!scene) return; const d = dots[di++ % dots.length];
    d.s.position.set(x, y, z); d.s.material.color.setHex(color); d.s.scale.setScalar(size); d.s.visible = true;
    d.life = d.max = life; d.grow = grow; d.vy = vy || 0; d.base = size; d.s.material.opacity = 1;
  }
  function impact(x, y, z, kind) {
    if (G.player && Math.hypot(x - G.player.pos.x, z - G.player.pos.z) > 160) return;
    if (kind === 'blood') { puff(x, y, z, 0x9a1a1a, 0.35, 0.25, 2, 0); puff(x, y, z, 0x701010, 0.2, 0.35, 1.5, -1); }
    else if (kind === 'dirt') puff(x, y, z, 0x8a7a5a, 0.4, 0.5, 2.2, 0.6);
    else { puff(x, y, z, 0xffd080, 0.18, 0.08, 1, 0); puff(x, y, z, 0x9a9a9a, 0.3, 0.4, 2, 0.4); }
  }
  function explosion(x, y, z) {
    puff(x, y + 0.6, z, 0xffb050, 3.5, 0.25, 2.5, 0); puff(x, y + 1, z, 0xff7020, 2.2, 0.35, 2, 1);
    for (let i = 0; i < 6; i++) puff(x + rnd(-1.5, 1.5), y + rnd(0.3, 1.5), z + rnd(-1.5, 1.5), 0x4a4440, 2, 1.6, 2.2, 1.2);
  }
  function grenadeMesh(type) { const m = Models.display(type); scene.add(m); return m; }
  function smoke(x, y, z) {
    const g = new THREE.Group(), parts = [];
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xd8dad6, transparent: true, opacity: 0, depthWrite: false }));
      const a = Math.random() * TAU, r = Math.random();
      s.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, oy: Math.random() * 0.8 }; g.add(s); parts.push(s);
    }
    g.position.set(x, y, z); scene.add(g);
    return { x, y, z, r: 0, t: 0, life: 18, g, parts };
  }
  function updateSmoke(s, dt) {
    s.t += dt; const grow = clamp(s.t / 2.5, 0, 1), fade = s.t > s.life - 3 ? (s.life - s.t) / 3 : 1;
    s.r = 6.5 * grow * (fade > 0.4 ? 1 : fade / 0.4);
    for (const p of s.parts) { const u = p.userData; p.position.set(u.ox * s.r * 0.8, 0.8 + u.oy * s.r * 0.6, u.oz * s.r * 0.8); p.scale.setScalar(2 + s.r * 1.2); p.material.opacity = 0.85 * grow * fade; }
    if (s.t >= s.life) { scene.remove(s.g); return false; }
    return true;
  }
  function update(dt) {
    for (const t of tracers) if (t.life > 0) { t.life -= dt; t.l.material.opacity = Math.max(0, t.life / 0.06) * 0.75; if (t.life <= 0) t.l.visible = false; }
    for (const d of dots) if (d.life > 0) {
      d.life -= dt; const k = 1 - d.life / d.max;
      d.s.scale.setScalar(d.base * (1 + k * d.grow)); d.s.material.opacity = Math.max(0, 1 - k); d.s.position.y += d.vy * dt;
      if (d.life <= 0) d.s.visible = false;
    }
    for (const f of flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.o.visible = false; }
    if (vmFlash && vmFlash.life > 0) { vmFlash.life -= dt; if (vmFlash.life <= 0) vmFlash.o.visible = false; }
    if (G.muzzleLight) G.muzzleLight.intensity = Math.max(0, G.muzzleLight.intensity - dt * 60);
    if (VM.flashLight) VM.flashLight.intensity = Math.max(0, VM.flashLight.intensity - dt * 50);
    updateCases(dt);
  }
  return { init, tracer, impact, flash, casing, explosion, grenadeMesh, smoke, updateSmoke, update, puff };
})();
