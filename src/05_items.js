// ============================================================
// 05_items.js — 아이템 정의, 인벤토리(무게/가방 용량), 월드 아이템, 무기 모델
// ============================================================
const ITEMS = {
  // ----- 무기 -----
  // modes: 사격 모드 순서(첫 번째가 기본). rKind: 장전 방식(없으면 탄창식) · rStyle: 탄창 장전 동작(ar/ak 로킹/bullpup)
  // supply: 보급상자 전용 · moveMul/adsMul: 이동 속도·정조준 시간 배율(경기관총)
  m416: { type: 'weapon', name: 'M416 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a556', dmg: 31, rpm: 700, modes: ['auto', 'single'], mag: 30, reload: 2.1, reloadEmpty: 2.7, rStyle: 'ar', spread: 0.95, recoil: 1.0, range: 290, zoom: 1.2, tier: 2, color: 0x2e3134 },
  aug: { type: 'weapon', name: 'AUG 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a556', dmg: 32, rpm: 720, modes: ['auto', 'single'], mag: 30, reload: 2.6, reloadEmpty: 3.2, rStyle: 'bullpup', spread: 0.8, recoil: 0.85, range: 300, zoom: 1.2, tier: 3, color: 0x4a5236 },
  akm: { type: 'weapon', name: 'AKM 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a762', dmg: 39, rpm: 600, modes: ['auto', 'single'], mag: 30, reload: 2.4, reloadEmpty: 3.0, rStyle: 'ak', spread: 1.3, recoil: 1.8, range: 260, zoom: 1.2, tier: 2, color: 0x6a4a2a },
  asm: { type: 'weapon', name: 'ASM Abakan 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a556', dmg: 34, rpm: 620, burstRpm: 1100, burstN: 3, burstGap: 0.26, modes: ['burst', 'single'], mag: 30, reload: 2.5, reloadEmpty: 3.1, rStyle: 'ak', spread: 0.85, recoil: 1.3, range: 280, zoom: 1.2, tier: 3, color: 0x23262a },
  vk9: { type: 'weapon', name: 'VK9 기관단총', cls: 'SMG', slot: 'primary', ammo: 'a9', dmg: 21, rpm: 800, modes: ['auto', 'single'], mag: 30, reload: 1.9, reloadEmpty: 2.4, rStyle: 'ar', spread: 1.5, recoil: 0.55, range: 110, zoom: 1.15, tier: 1, color: 0x2a2c2e },
  mini14: { type: 'weapon', name: 'Mini14 지정사수소총', cls: 'DMR', slot: 'primary', ammo: 'a556', dmg: 44, rpm: 300, modes: ['single'], mag: 20, reload: 2.4, reloadEmpty: 3.0, rStyle: 'ak', spread: 0.25, recoil: 1.5, range: 450, zoom: 1.25, tier: 2, color: 0x6b4a2c },
  slr: { type: 'weapon', name: 'SLR 지정사수소총', cls: 'DMR', slot: 'primary', ammo: 'a762', dmg: 56, rpm: 230, modes: ['single'], mag: 10, reload: 2.6, reloadEmpty: 3.3, rStyle: 'ak', spread: 0.22, recoil: 2.6, range: 500, zoom: 1.25, tier: 4, supply: true, color: 0x26282b },
  m24: { type: 'weapon', name: 'M24 저격소총', cls: 'SR', slot: 'primary', ammo: 'a762', dmg: 88, rpm: 46, modes: ['single'], mag: 5, rKind: 'bolt', rOpen: 0.5, rShell: 0.6, rClose: 0.5, cycle: 'bolt', spread: 0.05, recoil: 3.6, range: 700, zoom: 1.25, tier: 3, color: 0x4b5338 },
  awm: { type: 'weapon', name: 'AWM 저격소총', cls: 'SR', slot: 'primary', ammo: 'a300', dmg: 120, rpm: 40, modes: ['single'], mag: 5, rKind: 'boltmag', reload: 3.2, reloadEmpty: 4.1, cycle: 'bolt', cycleT: 1.2, spread: 0.03, recoil: 4.6, range: 900, zoom: 1.25, tier: 4, supply: true, color: 0x3f4a2e },
  s686: { type: 'weapon', name: 'S686 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 16, pellets: 9, rpm: 400, modes: ['single'], mag: 2, rKind: 'break', rOpen: 0.42, rShell: 0.5, rClose: 0.38, spread: 4.2, recoil: 2.8, range: 45, zoom: 1.1, tier: 1, color: 0x6e4426 },
  s12k: { type: 'weapon', name: 'S12K 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 13, pellets: 9, rpm: 230, modes: ['single'], mag: 5, reload: 3.0, reloadEmpty: 3.6, rStyle: 'ak', spread: 5.0, recoil: 2.5, range: 36, zoom: 1.1, tier: 1, color: 0x1c1d1f },
  m249: { type: 'weapon', name: 'M249 경기관총', cls: 'LMG', slot: 'primary', ammo: 'a556', dmg: 29, rpm: 750, modes: ['auto'], mag: 100, rKind: 'belt', reload: 7.4, reloadEmpty: 8.0, spread: 1.25, recoil: 1.15, range: 280, zoom: 1.15, moveMul: 0.9, adsMul: 1.45, tier: 3, color: 0x2c2f2a },
  mg3: { type: 'weapon', name: 'MG3 경기관총', cls: 'LMG', slot: 'primary', ammo: 'a762', dmg: 33, rpm: 990, rpmSlow: 660, modes: ['auto', 'slow'], mag: 75, rKind: 'belt', reload: 6.4, reloadEmpty: 7.0, spread: 1.4, recoil: 1.35, range: 300, zoom: 1.15, moveMul: 0.88, adsMul: 1.5, tier: 4, supply: true, color: 0x222426 },
  p19: { type: 'weapon', name: 'P-19 권총', cls: 'PISTOL', slot: 'secondary', ammo: 'a9', dmg: 24, rpm: 420, modes: ['single'], mag: 15, reload: 1.4, reloadEmpty: 1.75, spread: 1.2, recoil: 0.9, range: 70, zoom: 1.1, tier: 1, color: 0x222222 },
  // ----- 탄약 -----
  a556: { type: 'ammo', name: '5.56mm 탄', w: 0.4, stack: 40, color: 0xb0a040 },
  a762: { type: 'ammo', name: '7.62mm 탄', w: 0.5, stack: 30, color: 0xb07a30 },
  a9:   { type: 'ammo', name: '9mm 탄', w: 0.3, stack: 45, color: 0xc0c060 },
  a12:  { type: 'ammo', name: '12게이지 탄', w: 1.0, stack: 15, color: 0xb03030 },
  a300: { type: 'ammo', name: '.300 매그넘 탄', w: 1.2, stack: 10, color: 0xc89040 },
  // ----- 회복 -----
  bandage: { type: 'heal', name: '붕대', heal: 10, cap: 75, time: 3, w: 2, color: 0xe0d8c8 },
  firstaid: { type: 'heal', name: '구급상자', heal: 75, cap: 75, time: 6, w: 10, color: 0xd04040 },
  medkit: { type: 'heal', name: '의료 키트', heal: 100, cap: 100, time: 8, w: 20, color: 0xe8e8e8 },
  drink: { type: 'boost', name: '에너지 드링크', boost: 40, time: 3, w: 4, color: 0x40a0e0 },
  // ----- 장비 -----
  vest1: { type: 'vest', name: '방탄조끼 Lv1', lvl: 1, red: 0.3, dur: 200, color: 0x6a6f55 },
  vest2: { type: 'vest', name: '방탄조끼 Lv2', lvl: 2, red: 0.4, dur: 220, color: 0x4a5a45 },
  vest3: { type: 'vest', name: '방탄조끼 Lv3', lvl: 3, red: 0.55, dur: 250, color: 0x2f3438 },
  helm1: { type: 'helmet', name: '헬멧 Lv1', lvl: 1, red: 0.3, dur: 80, color: 0x6b7260 },
  helm2: { type: 'helmet', name: '헬멧 Lv2', lvl: 2, red: 0.4, dur: 150, color: 0x5a5a52 },
  helm3: { type: 'helmet', name: '헬멧 Lv3', lvl: 3, red: 0.55, dur: 230, color: 0x3a4048 },
  bag1: { type: 'bag', name: '가방 Lv1', lvl: 1, cap: 160, color: 0x7a6a4a },
  bag2: { type: 'bag', name: '가방 Lv2', lvl: 2, cap: 210, color: 0x5a6a4a },
  bag3: { type: 'bag', name: '가방 Lv3', lvl: 3, cap: 260, color: 0x3a3a3a },
  // ----- 부착물 -----
  reddot: { type: 'att', slot: 'scope', name: '레드닷 사이트', zoom: 1.3, aimT: 0.17, w: 5, color: 0x903030 },
  holo: { type: 'att', slot: 'scope', name: '홀로그램 사이트', zoom: 1.3, aimT: 0.18, w: 5, color: 0x903030 },
  x2: { type: 'att', slot: 'scope', name: '2배율 스코프', zoom: 2, aimT: 0.2, w: 5, color: 0x305090 },
  x3: { type: 'att', slot: 'scope', name: '3배율 스코프', zoom: 3, aimT: 0.23, w: 5, color: 0x305090 },
  x4: { type: 'att', slot: 'scope', name: '4배율 스코프', zoom: 4, aimT: 0.26, w: 5, color: 0x309050 },
  x6: { type: 'att', slot: 'scope', name: '6배율 스코프', zoom: 6, aimT: 0.3, w: 5, color: 0x309050 },
  comp: { type: 'att', slot: 'muzzle', name: '보정기', recoilMul: 0.72, w: 5, color: 0x707070 },
  extmag: { type: 'att', slot: 'mag', name: '대용량 탄창', magMul: 1.4, w: 5, color: 0x505030 },
  grip: { type: 'att', slot: 'grip', name: '수직 손잡이', spreadMul: 0.8, w: 5, color: 0x4a4a4a },
  // ----- 투척 -----
  frag: { type: 'throw', name: '세열 수류탄', w: 15, color: 0x3d5a30 },
  smoke: { type: 'throw', name: '연막탄', w: 12, color: 0x8a8a8a },
};
const AMMO_NAMES = { a556: '5.56', a762: '7.62', a9: '9mm', a12: '12G', a300: '.300' };
for (const id in ITEMS) { const d = ITEMS[id]; if (d.type === 'weapon') d.auto = d.modes.includes('auto') || d.modes.includes('slow'); }
// 사격 모드
const MODE_NAMES = { auto: '연사', single: '단발', burst: '3점사', slow: '저속 연사' };
function fireMode(wi) { const d = ITEMS[wi.id]; return d.modes[(wi.fm || 0) % d.modes.length]; }
function fireRpm(wi) { const d = ITEMS[wi.id], m = fireMode(wi); return m === 'burst' ? d.burstRpm : m === 'slow' ? d.rpmSlow : d.rpm; }
function cycleFireMode(wi) { const d = ITEMS[wi.id]; if (d.modes.length < 2) return false; wi.fm = ((wi.fm || 0) + 1) % d.modes.length; return true; }
const BASE_CAP = 70;

class Inventory {
  constructor(owner) {
    this.owner = owner;
    this.weapons = [null, null, null]; // [주무기1, 주무기2, 보조무기]
    this.cur = -1;
    this.gear = { helmet: null, vest: null, bag: null };
    this.items = {}; // id -> 수량 (탄약/회복/투척/여분 부착물)
    this.throwSel = 'frag';
  }
  current() { return this.cur >= 0 ? this.weapons[this.cur] : null; }
  capacity() { return G.training ? 9999 : this.gear.bag ? ITEMS[this.gear.bag.id].cap : BASE_CAP; } // 훈련장은 무게 제한 없음
  weight() { let s = 0; for (const id in this.items) s += (ITEMS[id].w || 1) * this.items[id]; return s; }
  count(id) { return this.items[id] || 0; }
  room(id) { const w = ITEMS[id].w || 1; return Math.floor((this.capacity() - this.weight()) / w + 1e-6); }
  add(id, n) { const k = Math.min(n, this.room(id)); if (k > 0) this.items[id] = (this.items[id] || 0) + k; return k; }
  take(id, n) { const k = Math.min(n, this.count(id)); this.items[id] = this.count(id) - k; if (!this.items[id]) delete this.items[id]; return k; }
  magSize(wi) { const d = ITEMS[wi.id]; return Math.round(d.mag * (wi.att.mag ? ITEMS[wi.att.mag].magMul : 1)); }
  bestHeal(hp) {
    if (hp < 70 && this.count('firstaid')) return 'firstaid';
    if (hp < 40 && this.count('medkit')) return 'medkit';
    if (hp < 75 && this.count('bandage')) return 'bandage';
    if (hp < 75 && this.count('firstaid')) return 'firstaid';
    if (hp < 100 && this.count('medkit')) return 'medkit';
    return null;
  }
  healCount() { return this.count('bandage') + this.count('firstaid') * 3 + this.count('medkit') * 4; }
}
function newWeapon(id, loaded = 0) { const d = ITEMS[id]; return { id, mag: loaded, fm: 0, att: { scope: d.defScope || null, muzzle: null, mag: null, grip: null } }; }
function weaponScore(wi) { if (!wi) return 0; const d = ITEMS[wi.id]; return { AR: 60, LMG: 63, DMR: 55, SR: 50, SMG: 45, SG: 40, PISTOL: 15 }[d.cls] + (d.supply ? 12 : 0) + Object.values(wi.att).filter(Boolean).length * 4; }
function attFits(attId, wid) {
  const a = ITEMS[attId], d = ITEMS[wid];
  if (wid === 's686') return false; // 중절식 2연발: 부착 불가
  if (a.slot === 'scope') {
    if (d.cls === 'PISTOL') return attId === 'reddot' || attId === 'holo';
    if (d.cls === 'SG') return a.zoom <= 2;
    if (d.cls === 'SMG') return a.zoom <= 4;
    return true;
  }
  if (a.slot === 'grip') return wid === 'm416' || wid === 'asm' || wid === 'vk9';
  if (a.slot === 'muzzle') return d.cls !== 'SG' && d.cls !== 'LMG';
  return d.cls !== 'LMG' && wid !== 'm24'; // 대용량 탄창
}

// ---------- 월드 아이템 ----------
let GROUND = [];          // {id, count, inst, x, y, z, mesh, alive}
const IG = 16; let IGN = Math.ceil(SIZE / IG);
let itemGrid = [];
function itemCell(x, z) { return clamp(Math.floor((z + HALF) / IG), 0, IGN - 1) * IGN + clamp(Math.floor((x + HALF) / IG), 0, IGN - 1); }
function itemsNear(x, z, r, out) {
  out.length = 0;
  const i0 = clamp(Math.floor((x - r + HALF) / IG), 0, IGN - 1), i1 = clamp(Math.floor((x + r + HALF) / IG), 0, IGN - 1);
  const j0 = clamp(Math.floor((z - r + HALF) / IG), 0, IGN - 1), j1 = clamp(Math.floor((z + r + HALF) / IG), 0, IGN - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const it of itemGrid[j * IGN + i]) {
    if (it.alive && (it.x - x) ** 2 + (it.z - z) ** 2 <= r * r) out.push(it);
  }
  return out;
}
// 바닥 아이템: 정밀 모델 + 접지 그림자 (Models.ground가 지오메트리 공유)
// 메시는 플레이어 근처에 처음 들어올 때 만든다(itemMesh) → 대형 맵의 수천 개 아이템도 가볍게
function spawnItem(scene, id, count, x, y, z, inst, uid) {
  const it = { id, count, inst: inst || null, x, y, z, ry: Math.random() * TAU, alive: true, mesh: null, scene };
  GROUND.push(it); gridPush(itemGrid, itemCell(x, z), it);
  if (G.net) Net.itemAdded(it, uid); // 같이 하기: 번호를 붙이고 다른 기기에 알림
  return it;
}
function itemMesh(it) {
  if (it.mesh || !it.alive) return it.mesh;
  it.mesh = Models.ground(it.id, it.inst && it.inst.att);
  it.mesh.position.set(it.x, it.y + 0.004, it.z); it.mesh.rotation.y = it.ry; it.mesh.visible = false;
  it.scene.add(it.mesh);
  return it.mesh;
}
function removeItem(it) {
  if (!it.alive) return;
  if (G.net) Net.itemRemoved(it);
  it.alive = false; if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
  const l = itemGrid[itemCell(it.x, it.z)]; const k = l.indexOf(it); if (k >= 0) l.splice(k, 1);
}
function itemLabel(it) {
  const d = ITEMS[it.id];
  if (d.type === 'weapon') return d.name + (it.inst && it.inst.mag ? ` (${it.inst.mag}발)` : '');
  if (d.type === 'vest' || d.type === 'helmet') return d.name + (it.inst ? ` ${Math.round(it.inst.dur / d.dur * 100)}%` : '');
  if (it.count > 1) return `${d.name} ×${it.count}`;
  return d.name;
}

// 루팅 테이블 (지역 등급별)
const LOOT = { // 무기 비중: 무기마다 탄약 2묶음이 같이 생기므로 탄약 단독 비중은 낮춘다
  low: [['weapon', 26], ['ammo', 18], ['heal', 20], ['vest', 8], ['helmet', 8], ['bag', 7], ['att', 8], ['throw', 6], ['none', 5]],
  mid: [['weapon', 28], ['ammo', 17], ['heal', 18], ['vest', 9], ['helmet', 9], ['bag', 7], ['att', 10], ['throw', 8], ['none', 3]],
  high: [['weapon', 29], ['ammo', 15], ['heal', 18], ['vest', 10], ['helmet', 10], ['bag', 7], ['att', 11], ['throw', 9], ['none', 2]],
  top: [['weapon', 30], ['ammo', 14], ['heal', 18], ['vest', 11], ['helmet', 10], ['bag', 7], ['att', 12], ['throw', 10], ['none', 2]],
};
const LVL_TABLE = { low: [[1, 70], [2, 26], [3, 4]], mid: [[1, 50], [2, 40], [3, 10]], high: [[1, 35], [2, 48], [3, 17]], top: [[1, 20], [2, 50], [3, 30]] };
const WEAPON_TABLE = {
  low: [['p19', 28], ['vk9', 24], ['s686', 14], ['s12k', 10], ['m416', 10], ['akm', 8], ['mini14', 4], ['asm', 2]],
  mid: [['p19', 12], ['vk9', 18], ['s686', 10], ['s12k', 10], ['m416', 18], ['akm', 14], ['asm', 7], ['aug', 3], ['mini14', 6], ['m24', 1.5], ['m249', 1]],
  high: [['p19', 6], ['vk9', 14], ['s686', 8], ['s12k', 8], ['m416', 20], ['akm', 15], ['asm', 9], ['aug', 6], ['mini14', 9], ['m24', 3], ['m249', 2]],
  top: [['vk9', 10], ['s12k', 6], ['m416', 22], ['akm', 16], ['asm', 10], ['aug', 9], ['mini14', 12], ['m24', 4], ['m249', 3]],
};
function populateLoot(scene) {
  GROUND = []; itemGrid = new Array(IGN * IGN).fill(EMPTY_LIST);
  for (const s of W.lootSpots) {
    const kind = weightedPick(LOOT[s.tier]);
    if (kind === 'none') continue;
    const jx = s.x + rnd(-0.4, 0.4), jz = s.z + rnd(-0.4, 0.4);
    if (kind === 'weapon') {
      const id = weightedPick(WEAPON_TABLE[s.tier]);
      spawnItem(scene, id, 1, jx, s.y, jz, newWeapon(id, Math.random() < 0.6 ? ITEMS[id].mag : 0));
      const am = ITEMS[id].ammo; spawnItem(scene, am, ITEMS[am].stack, jx + 0.55, s.y, jz + 0.2);
      spawnItem(scene, am, ITEMS[am].stack, jx + 0.4, s.y, jz - 0.45);
    } else if (kind === 'ammo') { const am = pick(['a556', 'a762', 'a9', 'a9', 'a12', 'a556']); spawnItem(scene, am, ITEMS[am].stack, jx, s.y, jz); }
    else if (kind === 'heal') { const h = weightedPick([['bandage', 45], ['firstaid', 28], ['medkit', 7], ['drink', 20]]); spawnItem(scene, h, h === 'bandage' ? 5 : 1, jx, s.y, jz); }
    else if (kind === 'vest' || kind === 'helmet' || kind === 'bag') {
      const lv = weightedPick(LVL_TABLE[s.tier]); const id = (kind === 'helmet' ? 'helm' : kind) + lv;
      spawnItem(scene, id, 1, jx, s.y, jz, kind === 'bag' ? { id } : { id, dur: ITEMS[id].dur });
    } else if (kind === 'att') { const a = weightedPick([['reddot', 16], ['holo', 13], ['x2', 11], ['x3', 8], ['x4', 7], ['x6', s.tier === 'low' ? 2 : 5], ['comp', 16], ['extmag', 14], ['grip', 11]]); spawnItem(scene, a, 1, jx, s.y, jz); }
    else if (kind === 'throw') { const t = Math.random() < 0.65 ? 'frag' : 'smoke'; spawnItem(scene, t, 1, jx, s.y, jz); }
  }
}

// ---------- 줍기 (플레이어/봇 공용 규칙) ----------
// 줍는 소리 종류
function pickupKind(id) {
  const d = ITEMS[id];
  if (d.type === 'weapon') return d.cls === 'PISTOL' ? 'pistol' : 'gun';
  if (d.type === 'ammo') return id === 'a12' ? 'shell' : 'ammo';
  if (d.type === 'heal') return id === 'bandage' ? 'cloth' : id === 'medkit' ? 'medkit' : 'kit';
  if (d.type === 'boost') return 'can';
  if (d.type === 'vest') return 'armor';
  return { helmet: 'helmet', bag: 'bag', att: 'att', throw: 'nade' }[d.type] || 'att';
}
// 반환: {ok, msg}. 성공하면 허리를 굽혀 줍는 동작 + 물건별 소리(봇은 가까이 있으면 들린다)
function pickupItem(c, it, scene, opts = {}) {
  const id = it.id, r = pickupItemRaw(c, it, scene, opts);
  if (r.ok) {
    c.pickT = PICK_T;
    if (c.isPlayer || (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 22)) Audio.pickup(pickupKind(id), c.pos, c.isPlayer);
  }
  return r;
}
function pickupItemRaw(c, it, scene, opts = {}) {
  if (!it.alive) return { ok: false, msg: '이미 사라진 아이템' };
  const inv = c.inv, d = ITEMS[it.id];
  const dropAt = (id, count, inst) => spawnItem(scene, id, count, c.pos.x + rnd(-0.6, 0.6), c.pos.y, c.pos.z + rnd(-0.6, 0.6), inst);
  if (d.type === 'weapon') {
    const inst = it.inst || newWeapon(it.id, 0);
    let slot;
    if (d.slot === 'secondary') slot = 2;
    else if (opts.slot !== undefined) slot = opts.slot;
    else if (!inv.weapons[0]) slot = 0; else if (!inv.weapons[1]) slot = 1;
    else slot = (inv.cur === 0 || inv.cur === 1) ? inv.cur : 0;
    const old = inv.weapons[slot];
    if (old) { // 교체: 기존 무기 장전 탄은 회수 후 버림
      const rec = inv.add(ITEMS[old.id].ammo, old.mag); old.mag -= rec;
      // 부착물 이전
      for (const k in old.att) if (old.att[k] && !inst.att[k] && attFits(old.att[k], inst.id)) { inst.att[k] = old.att[k]; old.att[k] = null; }
      dropAt(old.id, 1, old);
    }
    inv.weapons[slot] = inst; removeItem(it);
    if (inv.cur < 0 || inv.cur === slot || !old) { inv.cur = slot; c.equipT = 0.6; c.reloadT = 0; c.cycle = null; if (c.isPlayer) setTimeout(() => Audio.mech('equip', null, it.id, true), 260); }
    c.setVisibleGear();
    return { ok: true, msg: d.name + ' 획득' };
  }
  if (d.type === 'vest' || d.type === 'helmet' || d.type === 'bag') {
    const old = inv.gear[d.type];
    if (old && d.type === 'bag' && ITEMS[old.id].cap > d.cap && inv.weight() > d.cap) return { ok: false, msg: '가방을 바꾸면 소지품이 넘칩니다' };
    if (old) dropAt(old.id, 1, old);
    inv.gear[d.type] = it.inst || { id: it.id, dur: d.dur };
    removeItem(it); c.setVisibleGear();
    return { ok: true, msg: d.name + ' 장착' };
  }
  if (d.type === 'att') { // 장착 가능한 무기에 바로 부착
    const order = [inv.cur, 0, 1, 2].filter(i => i >= 0);
    for (const i of order) {
      const wi = inv.weapons[i]; if (!wi || !attFits(it.id, wi.id)) continue;
      const cur = wi.att[d.slot];
      if (!cur || (d.slot === 'scope' && (ITEMS[cur].zoom < d.zoom) && !opts.keep)) {
        if (cur) { if (!inv.add(cur, 1)) dropAt(cur, 1); }
        wi.att[d.slot] = it.id; removeItem(it); c.setVisibleGear(); if (c.isPlayer) setTimeout(() => Audio.attach(), 180);
        return { ok: true, msg: `${d.name} → ${ITEMS[wi.id].name}` };
      }
    }
  }
  // 소모품/탄약/여분 부착물
  const n = inv.add(it.id, it.count);
  if (n <= 0) return { ok: false, msg: '가방 공간이 부족합니다' };
  it.count -= n;
  if (it.count <= 0) removeItem(it); else if (G.net) Net.itemCount(it);
  return { ok: true, msg: `${d.name} ${n > 1 ? '×' + n : ''} 획득${it.count > 0 ? ' (일부)' : ''}` };
}
function dropFromInventory(c, scene, what) {
  const inv = c.inv, x = c.pos.x + rnd(-0.5, 0.5), z = c.pos.z + rnd(-0.5, 0.5), y = c.pos.y;
  if (what.weapon !== undefined) {
    const wi = inv.weapons[what.weapon]; if (!wi) return;
    inv.weapons[what.weapon] = null;
    spawnItem(scene, wi.id, 1, x, y, z, wi);
    if (inv.cur === what.weapon) inv.cur = inv.weapons.findIndex(Boolean);
    c.reloadT = 0;
  } else if (what.gear) {
    const g = inv.gear[what.gear]; if (!g) return;
    if (what.gear === 'bag' && inv.weight() > BASE_CAP) return { ok: false, msg: '가방을 벗기 전에 짐을 줄이세요' };
    inv.gear[what.gear] = null; spawnItem(scene, g.id, 1, x, y, z, g);
  } else if (what.item) {
    const n = inv.take(what.item, what.count || inv.count(what.item));
    if (n > 0) spawnItem(scene, what.item, n, x, y, z);
  } else if (what.att) {
    const wi = inv.weapons[what.att.w]; const id = wi && wi.att[what.att.slot]; if (!id) return;
    wi.att[what.att.slot] = null;
    if (!inv.add(id, 1)) spawnItem(scene, id, 1, x, y, z);
    if (what.att.slot === 'mag') { const m = inv.magSize(wi); if (wi.mag > m) { inv.add(ITEMS[wi.id].ammo, wi.mag - m); wi.mag = m; } }
  }
  c.setVisibleGear();
  return { ok: true };
}
function attachFromBag(c, attId) {
  const inv = c.inv, d = ITEMS[attId];
  for (const i of [inv.cur, 0, 1, 2]) {
    const wi = i >= 0 && inv.weapons[i]; if (!wi || !attFits(attId, wi.id)) continue;
    const old = wi.att[d.slot]; inv.take(attId, 1); wi.att[d.slot] = attId; if (old) inv.add(old, 1);
    c.setVisibleGear(); if (c.isPlayer) Audio.attach(); return true;
  }
  return false;
}

