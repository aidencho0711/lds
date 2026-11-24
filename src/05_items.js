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
  s686: { type: 'weapon', name: 'S686 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 16, pellets: 9, rpm: 400, modes: ['single'], mag: 2, rKind: 'break', rOpen: 0.42, rShell: 0.5, rClose: 0.38, spread: 2.3, recoil: 2.8, range: 45, zoom: 1.1, tier: 1, color: 0x6e4426 },
  s12k: { type: 'weapon', name: 'S12K 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 13, pellets: 9, rpm: 230, modes: ['single'], mag: 5, reload: 3.0, reloadEmpty: 3.6, rStyle: 'ak', spread: 2.8, recoil: 2.5, range: 36, zoom: 1.1, tier: 1, color: 0x1c1d1f },
  m249: { type: 'weapon', name: 'M249 경기관총', cls: 'LMG', slot: 'primary', ammo: 'a556', dmg: 29, rpm: 750, modes: ['auto'], mag: 100, rKind: 'belt', reload: 7.4, reloadEmpty: 8.0, spread: 1.25, recoil: 1.15, range: 280, zoom: 1.15, moveMul: 0.9, adsMul: 1.45, tier: 3, color: 0x2c2f2a },
  mg3: { type: 'weapon', name: 'MG3 경기관총', cls: 'LMG', slot: 'primary', ammo: 'a762', dmg: 33, rpm: 990, rpmSlow: 660, modes: ['auto', 'slow'], mag: 75, rKind: 'belt', reload: 6.4, reloadEmpty: 7.0, spread: 1.4, recoil: 1.35, range: 300, zoom: 1.15, moveMul: 0.88, adsMul: 1.5, tier: 4, supply: true, color: 0x222426 },
  p19: { type: 'weapon', name: 'P-19 권총', cls: 'PISTOL', slot: 'secondary', ammo: 'a9', dmg: 24, rpm: 420, modes: ['single'], mag: 15, reload: 1.4, reloadEmpty: 1.75, spread: 1.2, recoil: 0.9, range: 70, zoom: 1.1, tier: 1, color: 0x222222 },
  // ----- v16 추가 10종 (rTL: 총마다 다른 장전 동작 · 06_combat.js RL_TL) -----
  //  vgrip: 수직 손잡이 가능 · noExt/noScope/noMuzzle: 대용량 탄창·조준경·총구 부착물 불가
  //  fixedScope: 총에 붙어 있는 조준경 (떼거나 바꿀 수 없음; 모델은 05_models.js SC[key])
  beryl: { type: 'weapon', name: 'Beryl M762 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a762', dmg: 41, rpm: 700, burstRpm: 900, burstN: 3, burstGap: 0.24, modes: ['auto', 'burst', 'single'], mag: 30, reload: 2.6, reloadEmpty: 3.25, rStyle: 'ak', rTL: 'beryl', spread: 1.25, recoil: 2.1, range: 270, zoom: 1.2, tier: 3, vgrip: true, color: 0x1c1d1f },
  m16a4: { type: 'weapon', name: 'M16A4 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a556', dmg: 33, rpm: 800, burstRpm: 900, burstN: 3, burstGap: 0.22, modes: ['burst', 'single'], mag: 30, reload: 2.2, reloadEmpty: 2.75, rStyle: 'ar', rTL: 'm16', spread: 0.8, recoil: 1.05, range: 330, zoom: 1.2, tier: 2, color: 0x232527 },
  vector: { type: 'weapon', name: 'Vector 기관단총', cls: 'SMG', slot: 'primary', ammo: 'a9', dmg: 19, rpm: 1090, burstRpm: 1200, burstN: 2, burstGap: 0.16, modes: ['auto', 'burst', 'single'], mag: 19, reload: 1.85, reloadEmpty: 2.35, rStyle: 'ar', rTL: 'vector', spread: 1.35, recoil: 0.5, range: 100, zoom: 1.15, tier: 2, vgrip: true, color: 0x161718 },
  bizon: { type: 'weapon', name: 'PP-19 Bizon 기관단총', cls: 'SMG', slot: 'primary', ammo: 'a9', dmg: 22, rpm: 680, modes: ['auto', 'single'], mag: 53, reload: 2.9, reloadEmpty: 3.5, rStyle: 'ak', rTL: 'helix', spread: 1.3, recoil: 0.45, range: 120, zoom: 1.15, tier: 1, noExt: true, color: 0x1f2022 },
  tommy: { type: 'weapon', name: 'Tommy Gun 기관단총', cls: 'SMG', slot: 'primary', ammo: 'a45', dmg: 26, rpm: 680, modes: ['auto', 'single'], mag: 50, reload: 3.0, reloadEmpty: 3.7, rTL: 'drum', spread: 1.45, recoil: 0.75, range: 110, zoom: 1.15, tier: 1, noExt: true, noScope: true, noMuzzle: true, color: 0x5a3418 },
  kar98k: { type: 'weapon', name: 'Kar98k 저격소총', cls: 'SR', slot: 'primary', ammo: 'a762', dmg: 90, rpm: 40, modes: ['single'], mag: 5, rKind: 'bolt', rOpen: 0.5, rShell: 0.58, rClose: 0.5, clip: 5, rClipIn: 0.45, rClipPush: 0.5, cycle: 'bolt', cycleT: 1.15, spread: 0.06, recoil: 3.8, range: 650, zoom: 1.25, tier: 2, noExt: true, color: 0x6b4123 },
  win94: { type: 'weapon', name: 'Win94 레버액션 소총', cls: 'SR', slot: 'primary', ammo: 'a45', dmg: 62, rpm: 66, modes: ['single'], mag: 8, rKind: 'gate', rOpen: 0.4, rShell: 0.5, rClose: 0.3, cycle: 'lever', cycleT: 0.6, spread: 0.12, recoil: 2.2, range: 350, zoom: 1.3, tier: 1, noExt: true, noScope: true, noMuzzle: true, fixedScope: { key: 'w94', zoom: 2.7, aimT: 0.22, sens: 'x3', name: '고정 2.7배 조준경' }, color: 0x7a4826 },
  s1897: { type: 'weapon', name: 'S1897 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 17, pellets: 9, rpm: 70, modes: ['single'], mag: 5, rKind: 'shell', rOpen: 0.35, rShell: 0.5, rClose: 0.3, rCloseEmpty: 0.45, cycle: 'pump', spread: 2.2, recoil: 2.6, range: 42, zoom: 1.1, tier: 1, noExt: true, color: 0x6a3e1f },
  dp28: { type: 'weapon', name: 'DP-28 경기관총', cls: 'LMG', slot: 'primary', ammo: 'a762', dmg: 38, rpm: 550, modes: ['auto'], mag: 47, rTL: 'pan', reload: 4.4, reloadEmpty: 5.0, spread: 1.15, recoil: 1.25, range: 300, zoom: 1.15, moveMul: 0.92, adsMul: 1.35, tier: 2, color: 0x3a3f33 },
  deagle: { type: 'weapon', name: 'Deagle 권총', cls: 'PISTOL', slot: 'secondary', ammo: 'a45', dmg: 42, rpm: 230, modes: ['single'], mag: 7, reload: 1.7, reloadEmpty: 2.15, rTL: 'deagle', spread: 1.0, recoil: 2.3, range: 90, zoom: 1.12, tier: 2, color: 0x9da2a7 },
  // v20 새 총기: Groza(7.62 불펍 돌격소총 · 보급상자·최상급 지역) · AMR(.50 대물저격소총 · 보급상자 전용) · DBS(2연장 펌프 산탄총 · 14발)
  groza: { type: 'weapon', name: 'Groza 돌격소총', cls: 'AR', slot: 'primary', ammo: 'a762', dmg: 40, rpm: 750, modes: ['auto', 'single'], mag: 30, reload: 2.5, reloadEmpty: 3.1, rStyle: 'bullpup', spread: 0.85, recoil: 1.2, range: 290, zoom: 1.2, tier: 4, color: 0x262824 },
  amr: { type: 'weapon', name: 'AMR 대물저격소총', cls: 'SR', slot: 'primary', ammo: 'a50', dmg: 150, rpm: 36, modes: ['single'], mag: 5, rKind: 'boltmag', reload: 3.6, reloadEmpty: 4.5, cycle: 'bolt', cycleT: 1.35, spread: 0.025, recoil: 5.8, range: 1000, zoom: 1.25, tier: 4, supply: true, color: 0x2a2c2e },
  dbs: { type: 'weapon', name: 'DBS 산탄총', cls: 'SG', slot: 'primary', ammo: 'a12', dmg: 18, pellets: 9, rpm: 100, modes: ['single'], mag: 14, rKind: 'shell', rOpen: 0.3, rShell: 0.42, rClose: 0.28, rCloseEmpty: 0.4, cycle: 'pump', spread: 2.1, recoil: 2.7, range: 46, zoom: 1.1, tier: 3, noExt: true, color: 0x232527 },
  // v21 판처파우스트: 보급상자 전용 · 1발 쓰고 버리는 대전차 로켓 (탄약 없음, 장전 불가). 맞힌 사람·차량은 한 번에 파괴, 주변(반경 10m)도 큰 피해
  //  rocket: 06_combat.js 가 히트스캔 대신 날아가는 로켓을 쏜다 (속도 rv m/s, 중력 rg) · 쏘고 나면 빈 발사관을 버리고 다른 무기로
  pzf: { type: 'weapon', name: '판처파우스트', cls: 'RL', slot: 'primary', ammo: null, dmg: 999, rpm: 30, modes: ['single'], mag: 1, rocket: true, rv: 90, rg: 1.6, blastR: 10, spread: 0.35, recoil: 5.2, range: 180, zoom: 1.12, tier: 5, supply: true, noExt: true, noScope: true, noMuzzle: true, moveMul: 0.9, adsMul: 1.35, color: 0x4a5230 },
  // ----- 탄약 -----
  a556: { type: 'ammo', name: '5.56mm 탄', w: 0.4, stack: 40, color: 0xb0a040 },
  a762: { type: 'ammo', name: '7.62mm 탄', w: 0.5, stack: 30, color: 0xb07a30 },
  a9:   { type: 'ammo', name: '9mm 탄', w: 0.3, stack: 45, color: 0xc0c060 },
  a12:  { type: 'ammo', name: '12게이지 탄', w: 1.0, stack: 15, color: 0xb03030 },
  a300: { type: 'ammo', name: '.300 매그넘 탄', w: 1.2, stack: 10, color: 0xc89040 },
  a45:  { type: 'ammo', name: '.45 ACP 탄', w: 0.4, stack: 30, color: 0x9a8a50 },
  a50:  { type: 'ammo', name: '.50 BMG 탄', w: 1.6, stack: 10, color: 0xb89a50 },
  // ----- 회복 -----
  bandage: { type: 'heal', name: '붕대', heal: 10, cap: 75, time: 3, w: 2, color: 0xe0d8c8 },
  firstaid: { type: 'heal', name: '구급상자', heal: 75, cap: 75, time: 6, w: 10, color: 0xd04040 },
  medkit: { type: 'heal', name: '의료 키트', heal: 100, cap: 100, time: 8, w: 20, color: 0xe8e8e8 },
  drink: { type: 'boost', name: '에너지 드링크', boost: 40, time: 3, w: 4, color: 0x40a0e0 },
  // v22 진통제: 에너지 드링크의 상위 — 부스트 60 (먹는 데 6초)
  pills: { type: 'boost', name: '진통제', boost: 60, time: 6, w: 10, color: 0xe8e4dc },
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
  //  fuse: 핀을 뽑은 뒤 터지기까지(초) · impact: 처음 닿는 곳에서 바로 터짐(쥐고 있어도 손에서 터지지 않음, fuse = 최대 비행 시간)
  //  power: 던지는 힘 배율 (화염병은 무거워 덜 날아감) · short: 짧은 이름(빠른 선택·HUD)
  frag: { type: 'throw', name: '세열 수류탄', short: '수류탄', w: 15, fuse: 7, color: 0x3d5a30 },
  smoke: { type: 'throw', name: '연막탄', short: '연막탄', w: 12, fuse: 3, color: 0x8a8a8a },
  // v22: 화염병(깨지면 9초 동안 불바다) · 자기장 수류탄(10초 동안 작은 자기장) · 섬광탄(보고 있으면 눈이 멂) · 충격 수류탄(닿으면 바로 터짐, 세열보다 약함)
  molotov: { type: 'throw', name: '화염병', short: '화염병', w: 14, fuse: 8, impact: true, power: 0.88, color: 0xc0602a },
  zonegren: { type: 'throw', name: '자기장 수류탄', short: '자기장', w: 14, fuse: 2.5, color: 0x3a8ad8 },
  flash: { type: 'throw', name: '섬광탄', short: '섬광탄', w: 10, fuse: 2.2, color: 0x9aa0a4 },
  impact: { type: 'throw', name: '충격 수류탄', short: '충격탄', w: 13, fuse: 6, impact: true, color: 0xd88a2a },
  // ----- v22 근접 무기: 하나만 든다 (전용 칸 · 가방 무게 없음). 총을 넣으면(맨손 자리) 이 무기를 든다 -----
  //  style: 휘두르는 동작 — stab 찌르기 · slash 대각선 베기(번갈아 되베기) · bash 크게 가로 휘두르기 · chop 머리 위에서 내려찍기
  //  dmg: 몸통 피해(머리는 1.5배) · reach: 닿는 거리(m) · wind/strike/rec: 젖히기·휘두르기·되돌리기(초) · arc: 맞는 부채꼴 반각(도)
  knife: { type: 'melee', name: '식칼', style: 'stab', dmg: 36, reach: 1.85, wind: 0.1, strike: 0.08, rec: 0.24, arc: 28, w: 0, color: 0xb8bcc0 },
  machete: { type: 'melee', name: '마체테', style: 'slash', dmg: 52, reach: 2.25, wind: 0.17, strike: 0.11, rec: 0.3, arc: 46, w: 0, color: 0x6a6e70 },
  pan: { type: 'melee', name: '프라이팬', style: 'bash', dmg: 66, reach: 2.1, wind: 0.25, strike: 0.13, rec: 0.36, arc: 52, w: 0, color: 0x2a2a2c },
  crowbar: { type: 'melee', name: '쇠지렛대', style: 'chop', dmg: 58, reach: 2.2, wind: 0.23, strike: 0.12, rec: 0.33, arc: 34, w: 0, color: 0xa02a22 },
  // ----- 상점 재화: 줍는 즉시 계정에 들어감(가방 무게 없음). count = 골드 탄피 양 -----
  gold: { type: 'gold', name: '골드 탄피 주머니', w: 0, color: 0xd8b04a },
  // ----- 리콜 카드 (08_recall.js): 탈락한 팀원이 떨어뜨림 · 그 팀만 주울 수 있음 · 가방 무게 없음 (inst = {who, team, t}) -----
  rcard: { type: 'card', name: '리콜 카드', w: 0, color: 0x2ec4d6 },
};
const AMMO_NAMES = { a556: '5.56', a762: '7.62', a9: '9mm', a12: '12G', a300: '.300', a45: '.45', a50: '.50' };
// 탄피 모델 종류 (배출·손에 든 탄)
const CASE_KIND = { a556: '556', a762: '762', a9: '9', a12: 'hull', a300: '300', a45: '45', a50: '50' };
for (const id in ITEMS) { const d = ITEMS[id]; if (d.type === 'weapon') d.auto = d.modes.includes('auto') || d.modes.includes('slow'); }
// v22 투척 무기 순서 (T 로 바꾸기·빠른 선택) · 근접 무기
const THROWS = ['frag', 'impact', 'molotov', 'zonegren', 'flash', 'smoke'];
const MELEES = ['knife', 'machete', 'pan', 'crowbar'];
// 아이콘이 가로로 긴 것 (총·근접 무기)
const wideItem = (id) => !!ITEMS[id] && (ITEMS[id].type === 'weapon' || ITEMS[id].type === 'melee');
// 사격 모드
const MODE_NAMES = { auto: '연사', single: '단발', burst: '3점사', slow: '저속 연사' };
// 점사 발수는 총마다 다름 (Vector 2점사)
function modeName(id, m) { return m === 'burst' ? (ITEMS[id].burstN || 3) + '점사' : MODE_NAMES[m]; }
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
    this.melee = null; // v22 근접 무기 id (하나만 · 총을 넣으면 든다)
  }
  // 가진 투척 무기 중 다음 것 (없으면 지금 것)
  nextThrow(from) { const k = THROWS.indexOf(from || this.throwSel); for (let i = 1; i <= THROWS.length; i++) { const id = THROWS[(k + i) % THROWS.length]; if (this.count(id)) return id; } return from || this.throwSel; }
  // 고른 투척 무기가 없으면 가진 것 중 첫 번째
  throwPick() { return this.count(this.throwSel) ? this.throwSel : THROWS.find((id) => this.count(id)) || this.throwSel; }
  // 부스트: 부스트가 낮으면 진통제(큰 것)부터, 아니면 드링크부터
  bestBoost(boost) { const a = boost < 45 ? ['pills', 'drink'] : ['drink', 'pills']; return a.find((id) => this.count(id)) || null; }
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
function weaponScore(wi) { if (!wi) return 0; const d = ITEMS[wi.id]; return { AR: 60, LMG: 63, DMR: 55, SR: 50, SMG: 45, SG: 40, PISTOL: 15, RL: 30 }[d.cls] + (d.supply ? 12 : 0) + Object.values(wi.att).filter(Boolean).length * 4; }
function attFits(attId, wid) {
  const a = ITEMS[attId], d = ITEMS[wid];
  if (wid === 's686') return false; // 중절식 2연발: 부착 불가
  if (a.slot === 'scope') {
    if (d.noScope) return false;
    if (d.cls === 'PISTOL') return attId === 'reddot' || attId === 'holo';
    if (d.cls === 'SG') return a.zoom <= 2;
    if (d.cls === 'SMG') return a.zoom <= 4;
    if (d.cls === 'LMG' && wid === 'dp28') return a.zoom <= 4;
    return true;
  }
  if (a.slot === 'grip') return !!d.vgrip;
  if (a.slot === 'muzzle') return d.cls !== 'SG' && d.cls !== 'LMG' && !d.noMuzzle;
  return d.cls !== 'LMG' && !d.noExt; // 대용량 탄창
}
for (const k of ['m416', 'asm', 'vk9']) ITEMS[k].vgrip = true;
ITEMS.m24.noExt = true;

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
// bx (v22): 상자 key — 시체 상자·보급 상자 안의 물건 (바닥 모델 없이 상자 하나로 보이고, 줍기 목록에 상자 이름으로 묶인다)
function spawnItem(scene, id, count, x, y, z, inst, uid, bx) {
  const it = { id, count, inst: inst || null, x, y, z, ry: Math.random() * TAU, alive: true, mesh: null, scene, bx: bx || null };
  GROUND.push(it); gridPush(itemGrid, itemCell(x, z), it);
  if (bx) Crates.track(it);
  if (G.net) Net.itemAdded(it, uid); // 같이 하기: 번호를 붙이고 다른 기기에 알림
  if (id === 'rcard') Recall.track(it);
  return it;
}
function itemMesh(it) {
  if (it.mesh || !it.alive || it.bx) return it.mesh;
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
  if (it.bx) Crates.untrack(it);
}
function itemLabel(it) {
  const d = ITEMS[it.id];
  if (d.type === 'weapon') return d.name + (it.inst && it.inst.mag ? ` (${it.inst.mag}발)` : '');
  if (d.type === 'melee') return d.name;
  if (d.type === 'vest' || d.type === 'helmet') return d.name + (it.inst ? ` ${Math.round(it.inst.dur / d.dur * 100)}%` : '');
  if (d.type === 'gold') return `${d.name} (+${it.count})`;
  if (d.type === 'card') return `${d.name} · ${Recall.cardName(it)}`;
  if (it.count > 1) return `${d.name} ×${it.count}`;
  return d.name;
}

// ---------- 상자 (v22): 시체 상자 · 보급 상자 ----------
//  상자 안 물건도 평범한 바닥 아이템(GROUND)이다: it.bx = 상자 key, 위치 = 상자 자리. 물건마다 바닥 모델을 만들지 않고 상자 모델 하나만 보인다
//  key 'd<캐릭터 id>_<목숨>_<번호>' = 시체 상자(여기서 모델을 만듦 · 이름은 그 캐릭터) · 'a<번호>' = 보급 상자(모델은 08_airdrop.js)
//  같이 하기: 물건을 알릴 때 key 도 같이 보내므로(10_net.js gadd) 다른 기기에도 같은 자리에 같은 상자가 생긴다
//  다 비운 시체 상자는 뚜껑이 열린 채 남는다
const Crates = (() => {
  let scene = null, map = new Map(), seq = 0;
  function dispose() { for (const b of map.values()) if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh); map = new Map(); }
  function init(sc) { dispose(); scene = sc; }
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function ensure(key, x, y, z) {
    let b = map.get(key); if (b) return b;
    const dead = key[0] === 'd';
    b = { key, dead, x, y, z, items: new Set(), mesh: null, lid: null, name: dead ? '' : '보급 상자', open: 0 };
    if (dead) {
      const cid = parseInt(key.slice(1), 10), ch = CHARS.find((c) => c.id === cid);
      b.name = ch ? ch.name : '';
      if (scene && Models.deathCrate) {
        const m = Models.deathCrate(); m.position.set(x, y, z); m.rotation.y = (hash(key) % 628) / 100; scene.add(m);
        b.mesh = m; b.lid = m.userData.lid;
      }
    }
    map.set(key, b); return b;
  }
  function track(it) {
    const b = ensure(it.bx, it.x, it.y, it.z); b.items.add(it); it.box = b;
    if (b.dead) { const n = +it.bx.slice(it.bx.lastIndexOf('_') + 1); if (n >= seq) seq = n + 1; }   // 이어하기로 되살린 상자 · 다른 기기 상자와 번호가 겹치지 않게
  }
  function untrack(it) { const b = it.box; if (b) b.items.delete(it); }
  // 시체 상자 key: 같은 캐릭터가 리콜로 다시 죽어도 겹치지 않게 목숨·번호를 붙인다
  function newKey(c) { return 'd' + c.id + '_' + (c.life || 0) + '_' + (seq++); }
  // 매 0.25초 (11_game.js): 멀면 숨기고, 다 비우면 뚜껑을 연다
  function update(cam, far, dt) {
    for (const b of map.values()) {
      if (!b.mesh) continue;
      const d = Math.hypot(b.x - cam.x, b.z - cam.z); b.mesh.visible = d < far;
      if (b.lid && !b.items.size && b.open < 1) { b.open = Math.min(1, b.open + dt * 3); b.lid.rotation.x = -1.9 * smoothstep01(b.open); }
    }
  }
  function label(b) { return b.dead ? `시체 상자${b.name ? ' · ' + b.name : ''}` : b.name; }
  return { init, dispose, ensure, track, untrack, newKey, update, label, get map() { return map; } };
})();

// 루팅 테이블 (지역 등급별)
const LOOT = { // 무기 비중: 무기마다 탄약 2묶음이 같이 생기므로 탄약 단독 비중은 낮춘다 · v22 근접 무기(melee)
  low: [['weapon', 26], ['ammo', 18], ['heal', 20], ['vest', 8], ['helmet', 8], ['bag', 7], ['att', 8], ['throw', 7], ['melee', 4], ['none', 4]],
  mid: [['weapon', 28], ['ammo', 17], ['heal', 18], ['vest', 9], ['helmet', 9], ['bag', 7], ['att', 10], ['throw', 9], ['melee', 3], ['none', 2]],
  high: [['weapon', 29], ['ammo', 15], ['heal', 18], ['vest', 10], ['helmet', 10], ['bag', 7], ['att', 11], ['throw', 10], ['melee', 2], ['none', 2]],
  top: [['weapon', 30], ['ammo', 14], ['heal', 18], ['vest', 11], ['helmet', 10], ['bag', 7], ['att', 12], ['throw', 11], ['melee', 2], ['none', 2]],
};
// v22 투척 무기·회복·근접 무기 비중
const THROW_TABLE = [['frag', 34], ['smoke', 19], ['impact', 14], ['molotov', 15], ['flash', 10], ['zonegren', 8]];
const HEAL_TABLE = [['bandage', 42], ['firstaid', 27], ['medkit', 7], ['drink', 16], ['pills', 8]];
const MELEE_TABLE = [['knife', 30], ['machete', 24], ['pan', 26], ['crowbar', 20]];
const LVL_TABLE = { low: [[1, 70], [2, 26], [3, 4]], mid: [[1, 50], [2, 40], [3, 10]], high: [[1, 35], [2, 48], [3, 17]], top: [[1, 20], [2, 50], [3, 30]] };
const WEAPON_TABLE = { // 지역 등급별 무기 비중 (v16: 10종 추가 — 흔한 총은 낮은 등급, 강한 총은 높은 등급에 많이)
  low: [['p19', 22], ['vk9', 18], ['s686', 12], ['s12k', 8], ['s1897', 10], ['m416', 8], ['akm', 7], ['m16a4', 6], ['mini14', 4], ['asm', 2], ['tommy', 8], ['bizon', 7], ['vector', 4], ['win94', 6], ['deagle', 6], ['kar98k', 2], ['beryl', 1.5], ['dp28', 1]],
  mid: [['p19', 10], ['vk9', 14], ['s686', 8], ['s12k', 8], ['s1897', 7], ['m416', 15], ['akm', 12], ['m16a4', 9], ['asm', 6], ['aug', 3], ['mini14', 6], ['m24', 1.5], ['m249', 1], ['dbs', 2], ['tommy', 6], ['bizon', 7], ['vector', 6], ['win94', 4], ['deagle', 4], ['kar98k', 4], ['beryl', 4], ['dp28', 3]],
  high: [['p19', 5], ['vk9', 11], ['s686', 6], ['s12k', 7], ['s1897', 5], ['dbs', 4], ['groza', 0.8], ['m416', 17], ['akm', 13], ['m16a4', 9], ['asm', 8], ['aug', 6], ['mini14', 8], ['m24', 3], ['m249', 2], ['tommy', 4], ['bizon', 6], ['vector', 7], ['win94', 3], ['deagle', 4], ['kar98k', 5], ['beryl', 7], ['dp28', 4]],
  top: [['vk9', 8], ['s12k', 5], ['dbs', 5], ['groza', 2], ['m416', 19], ['akm', 14], ['m16a4', 8], ['asm', 9], ['aug', 9], ['mini14', 11], ['m24', 4], ['m249', 3], ['vector', 7], ['bizon', 4], ['kar98k', 5], ['beryl', 9], ['dp28', 4], ['deagle', 2]],
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
    } else if (kind === 'ammo') { const am = pick(['a556', 'a556', 'a762', 'a762', 'a9', 'a9', 'a12', 'a45']); spawnItem(scene, am, ITEMS[am].stack, jx, s.y, jz); }
    else if (kind === 'heal') { const h = weightedPick(HEAL_TABLE); spawnItem(scene, h, h === 'bandage' ? 5 : 1, jx, s.y, jz); }
    else if (kind === 'melee') { const m = weightedPick(MELEE_TABLE); spawnItem(scene, m, 1, jx, s.y, jz); }
    else if (kind === 'vest' || kind === 'helmet' || kind === 'bag') {
      const lv = weightedPick(LVL_TABLE[s.tier]); const id = (kind === 'helmet' ? 'helm' : kind) + lv;
      spawnItem(scene, id, 1, jx, s.y, jz, kind === 'bag' ? { id } : { id, dur: ITEMS[id].dur });
    } else if (kind === 'att') { const a = weightedPick([['reddot', 16], ['holo', 13], ['x2', 11], ['x3', 8], ['x4', 7], ['x6', s.tier === 'low' ? 2 : 5], ['comp', 16], ['extmag', 14], ['grip', 11]]); spawnItem(scene, a, 1, jx, s.y, jz); }
    else if (kind === 'throw') { const t = weightedPick(THROW_TABLE); spawnItem(scene, t, 1, jx, s.y, jz); }
  }
  // 골드 탄피 주머니: 작은 맵 8개 · 대형 맵 48개 (훈련장·데스매치 맵에는 없음)
  if (W.lootSpots.length && !(MAPS[SETTINGS.map] && (MAPS[SETTINGS.map].training || MAPS[SETTINGS.map].arena))) {
    const n = MAPS[SETTINGS.map].gold || (W.big ? 48 : 8), AMT = { low: [10, 16], mid: [14, 22], high: [20, 30], top: [26, 40] };
    for (let i = 0; i < n; i++) { const s = W.lootSpots[Math.floor(Math.random() * W.lootSpots.length)], A = AMT[s.tier] || AMT.mid; spawnItem(scene, 'gold', Math.round(rnd(A[0], A[1])), s.x + rnd(-0.3, 0.3), s.y, s.z + rnd(-0.3, 0.3)); }
  }
}

// ---------- 줍기 (플레이어/봇 공용 규칙) ----------
// 줍는 소리 종류
function pickupKind(id) {
  const d = ITEMS[id];
  if (d.type === 'weapon') return d.cls === 'PISTOL' ? 'pistol' : 'gun';
  if (d.type === 'ammo') return id === 'a12' ? 'shell' : 'ammo';
  if (d.type === 'heal') return id === 'bandage' ? 'cloth' : id === 'medkit' ? 'medkit' : 'kit';
  if (d.type === 'boost') return id === 'pills' ? 'pills' : 'can';
  if (d.type === 'gold') return 'ammo';
  if (d.type === 'vest') return 'armor';
  if (id === 'molotov') return 'bottle';
  if (d.type === 'melee') return id === 'pan' ? 'pan' : 'blade';
  return { helmet: 'helmet', bag: 'bag', att: 'att', throw: 'nade' }[d.type] || 'att';
}
// 반환: {ok, msg}. 성공하면 허리를 굽혀 줍는 동작 + 물건별 소리(봇은 가까이 있으면 들린다)
function pickupItem(c, it, scene, opts = {}) {
  const id = it.id, drop = !!it.drop, r = pickupItemRaw(c, it, scene, opts);
  if (r.ok) {
    if (!(opts.auto && c.pickT > PICK_T * 0.4)) c.pickT = PICK_T;   // 자동 줍기로 여러 개를 연달아 주우면 허리를 한 번만 굽힌다
    c.pickId = id;   // v23 1인칭 줍기: 줍는 손에 잠깐 보여 줄 물건
    if (c.isPlayer) { c.lootN = (c.lootN || 0) + 1; if (drop) c.dropN = (c.dropN || 0) + 1; }
    if (c.isPlayer || (G.player && Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < 22)) Audio.pickup(pickupKind(id), c.pos, c.isPlayer);
  }
  return r;
}
function pickupItemRaw(c, it, scene, opts = {}) {
  if (!it.alive) return { ok: false, msg: '이미 사라진 아이템' };
  const inv = c.inv, d = ITEMS[it.id];
  const dropAt = (id, count, inst) => spawnItem(scene, id, count, c.pos.x + rnd(-0.6, 0.6), c.pos.y, c.pos.z + rnd(-0.6, 0.6), inst);
  if (d.type === 'gold') {
    // 내 캐릭터만 계정에 넣는다 (봇은 줍지 않음, 파티원은 자기 기기에서 처리)
    const n = it.count; removeItem(it);
    if (c.isPlayer) { c.goldN = (c.goldN || 0) + 1; c.goldAmt = (c.goldAmt || 0) + n; Eco.found(n); if (Audio.gacha) Audio.gacha('small', 2); }
    return { ok: true, msg: `${GOLD_NAME} +${n}` };
  }
  if (d.type === 'card') {
    // 리콜 카드: 같은 팀만 · 들고 있으면 리콜 타워 단말기에서 등록할 수 있다 (가방과 무관)
    if (!Recall.canTake(c, it)) return { ok: false, msg: '팀원의 리콜 카드만 주울 수 있습니다' };
    const who = it.inst.who, nm = Recall.cardName(it); removeItem(it); (c.cards || (c.cards = [])).push(who); Recall.held(c);
    return { ok: true, msg: Recall.useful(it) ? `${nm}의 리콜 카드 — 지도의 리콜 타워에서 등록하세요` : `${nm}의 리콜 카드 (리콜할 수 없음)` };
  }
  if (d.type === 'weapon') {
    const inst = it.inst || newWeapon(it.id, 0), had = inv.weapons.some(Boolean);
    let slot;
    if (d.slot === 'secondary') slot = 2;
    else if (opts.slot !== undefined) slot = opts.slot;
    else if (!inv.weapons[0]) slot = 0; else if (!inv.weapons[1]) slot = 1;
    else slot = (inv.cur === 0 || inv.cur === 1) ? inv.cur : 0;
    const old = inv.weapons[slot];
    if (old) { // 교체: 기존 무기 장전 탄은 회수 후 버림
      const oa = ITEMS[old.id].ammo, rec = oa ? inv.add(oa, old.mag) : 0; old.mag -= rec;   // 판처파우스트(탄약 없음)는 장전된 채 그대로 버림
      // 부착물 이전
      for (const k in old.att) if (old.att[k] && !inst.att[k] && attFits(old.att[k], inst.id)) { inst.att[k] = old.att[k]; old.att[k] = null; }
      dropAt(old.id, 1, old);
    }
    inv.weapons[slot] = inst; removeItem(it);
    // v23 자동 줍기로 두 번째 총을 주우면 손에 든 것은 그대로 (총이 하나도 없었을 때만 바로 든다)
    if (!(opts.auto && had && inv.cur !== slot) && (inv.cur < 0 || inv.cur === slot || !old)) { inv.cur = slot; c.equipT = 0.6; c.reloadT = 0; c.cycle = null; if (c.isPlayer) setTimeout(() => Audio.mech('equip', null, it.id, true), 260); }
    c.setVisibleGear();
    return { ok: true, msg: d.name + ' 획득' };
  }
  if (d.type === 'melee') {
    // v22 근접 무기는 하나만: 이미 있으면 바꿔 들고 헌 것은 발밑에 버림. 총을 들고 있지 않으면 바로 든다
    const old = inv.melee; inv.melee = it.id; removeItem(it);
    if (old) dropAt(old, 1);
    if (!c.weapon) {
      c.equipT = Math.max(c.equipT, 0.35); c.swing = null;
      if (old === 'knife' && c.ka) c.ka.held = false;   // v23 들고 있던 식칼을 식칼로 바꿔 주워도 꺼내는 동작을 다시 (나비 나이프·카람빗)
      if (c.isPlayer && !(it.id === 'knife' && KAnim.kindOf(c) && !c.veh)) setTimeout(() => Audio.melee('draw', it.id, null, true), 120);   // v23 나비 나이프·카람빗은 꺼내는 동작의 전용 소리
    }
    c.setVisibleGear();
    return { ok: true, msg: d.name + (old ? ` 획득 (${ITEMS[old].name} 버림)` : ' 획득') };
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
      if (!cur || (d.slot === 'scope' && (ITEMS[cur].zoom < d.zoom) && !opts.keep && !opts.auto)) {   // 자동 줍기는 빈자리에만 단다
        if (cur) { if (!inv.add(cur, 1)) dropAt(cur, 1); }
        wi.att[d.slot] = it.id; removeItem(it); c.setVisibleGear(); if (c.isPlayer) setTimeout(() => Audio.attach(), 180);
        return { ok: true, msg: `${d.name} → ${ITEMS[wi.id].name}` };
      }
    }
  }
  // 소모품/탄약/여분 부착물 (opts.max: 이만큼만 — 자동 줍기)
  const n = inv.add(it.id, opts.max !== undefined ? Math.min(it.count, opts.max) : it.count);
  if (n <= 0) return { ok: false, msg: '가방 공간이 부족합니다' };
  it.count -= n;
  if (it.count <= 0) removeItem(it); else if (G.net) Net.itemCount(it);
  return { ok: true, msg: `${d.name} ${n > 1 ? '×' + n : ''} 획득${it.count > 0 ? ' (일부)' : ''}` };
}
function dropFromInventory(c, scene, what) {
  const inv = c.inv, x = c.pos.x + rnd(-0.5, 0.5), z = c.pos.z + rnd(-0.5, 0.5), y = c.pos.y;
  // v23 내가 버린 것은 내 자동 줍기가 다시 줍지 않는다 (손으로는 주울 수 있음 · 파티원의 자동 줍기는 주움)
  const put = (id, n, inst) => { const it = spawnItem(scene, id, n, x, y, z, inst); if (c.isPlayer) it.autoNo = Infinity; return it; };
  if (what.weapon !== undefined) {
    const wi = inv.weapons[what.weapon]; if (!wi) return;
    inv.weapons[what.weapon] = null;
    put(wi.id, 1, wi);
    if (inv.cur === what.weapon) { inv.cur = inv.weapons.findIndex(Boolean); c.cycle = null; }   // 버린 총의 볼트·펌프 동작이 다른 총으로 이어지지 않게 (장전은 아래 reloadT = 0이 끊음)
    c.reloadT = 0;
  } else if (what.melee) {
    if (!inv.melee) return; put(inv.melee, 1); inv.melee = null; c.swing = null;
  } else if (what.gear) {
    const g = inv.gear[what.gear]; if (!g) return;
    if (what.gear === 'bag' && inv.weight() > BASE_CAP) return { ok: false, msg: '가방을 벗기 전에 짐을 줄이세요' };
    inv.gear[what.gear] = null; put(g.id, 1, g);
  } else if (what.item) {
    const n = inv.take(what.item, what.count || inv.count(what.item));
    if (n > 0) put(what.item, n);
  } else if (what.att) {
    const wi = inv.weapons[what.att.w]; const id = wi && wi.att[what.att.slot]; if (!id) return;
    wi.att[what.att.slot] = null;
    if (!inv.add(id, 1)) put(id, 1);
    if (what.att.slot === 'mag') { const m = inv.magSize(wi); if (wi.mag > m) { inv.add(ITEMS[wi.id].ammo, wi.mag - m); wi.mag = m; } }
  }
  c.setVisibleGear();
  return { ok: true };
}
// ---------- 자동 줍기 규칙 (v22 · 09_player.js autoPickup 이 쓴다) ----------
//  총: 빈 주무기 칸이 있으면 (v23 — 첫 총도, 두 번째 총도. 들고 있는 것과 같은 총은 또 줍지 않음) · 아무 총도 없으면 권총도
//  탄: 가진 총에 맞는 것만 (총을 바꾸면 줍는 탄도 바뀜) · 투척 무기: 종류마다 2개 · 근접 무기: 없으면 1개
//  회복: 붕대 5 · 드링크 2 · 구급상자 3 · 의료 키트 3 · 진통제 3
//  v23 헬멧·조끼·가방: 없거나 더 높은 레벨 · 부착물: 가진 총의 빈자리에 맞는 것 (이미 단 것을 바꾸지는 않음)
const AUTO_KEEP = { bandage: 5, drink: 2, firstaid: 3, medkit: 3, pills: 3 }, AUTO_THROW = 2;
const AUTO_AMMO = { a556: 180, a762: 150, a9: 150, a45: 120, a12: 40, a300: 30, a50: 20 };
// 헬멧·조끼·가방이 지금 것보다 나은가: 없으면 무엇이든 · 더 높은 레벨(헬멧·조끼는 내구도 25% 이상) · 같은 레벨이면 내구도가 40%p 이상 많을 때
const durF = (g, d) => (g && g.dur !== undefined && d.dur ? g.dur / d.dur : 1);
function gearBetter(c, it) {
  const d = ITEMS[it.id], g = c.inv.gear[d.type]; if (!g) return true;
  const gd = ITEMS[g.id]; if (!gd) return true;
  if (d.type === 'bag') return d.lvl > gd.lvl;
  const nf = durF(it.inst, d);
  return d.lvl > gd.lvl ? nf >= 0.25 : d.lvl === gd.lvl && nf - durF(g, gd) >= 0.4;
}
// 이 부착물을 달 빈자리가 있는 총
const attFree = (c, it) => { const d = ITEMS[it.id]; return c.inv.weapons.some((w) => w && attFits(it.id, w.id) && !w.att[d.slot]); };
// 몇 개 주울지 (0 = 안 주움)
function autoWant(c, it) {
  const inv = c.inv, d = ITEMS[it.id]; if (!d) return 0;
  switch (d.type) {
    case 'weapon': {
      if (d.rocket) return 0;
      const W = inv.weapons; if (d.slot === 'secondary') return W.some(Boolean) ? 0 : 1;
      if (W[0] && W[1]) return 0; const has = W[0] || W[1];
      return has && has.id === it.id ? 0 : 1;
    }
    case 'ammo': return inv.weapons.some((w) => w && ITEMS[w.id].ammo === it.id) ? Math.max(0, (AUTO_AMMO[it.id] || 60) - inv.count(it.id)) : 0;
    case 'throw': return Math.max(0, AUTO_THROW - inv.count(it.id));
    case 'melee': return inv.melee ? 0 : 1;
    case 'heal': case 'boost': return Math.max(0, (AUTO_KEEP[it.id] || 0) - inv.count(it.id));
    case 'vest': case 'helmet': case 'bag': return gearBetter(c, it) ? 1 : 0;
    case 'att': return attFree(c, it) ? 1 : 0;
    case 'gold': return it.count;
    case 'card': return Recall.canTake(c, it) ? 1 : 0;
  }
  return 0;
}
// 줍는 순서 (클수록 먼저): 총(좋은 총부터) > 리콜 카드·골드 > 조끼·헬멧·가방(높은 레벨부터) > 근접 무기 > 탄 > 부착물 > 회복 > 투척
function autoRank(it) { const d = ITEMS[it.id]; return d.type === 'weapon' ? 100 + weaponScore(it.inst || newWeapon(it.id)) : ({ card: 90, gold: 85, vest: 72, helmet: 71, bag: 70, melee: 60, ammo: 50, att: 45, heal: 40, boost: 38, throw: 30 }[d.type] || 0) + (d.lvl || 0); }
// 노란색 표시 = 주워야 할 것: 자동으로 줍는 것 + 지금보다 좋은 장비 (헬멧·조끼·가방 레벨 · 빈 주무기 칸 · 더 좋은 총 · 비어 있는 부착물 자리 · 더 높은 배율)
function lootWant(c, it) {
  const inv = c.inv, d = ITEMS[it.id]; if (!d) return false;
  if (autoWant(c, it) > 0 && (d.type === 'weapon' || d.type === 'melee' || d.type === 'gold' || d.type === 'card' || d.type === 'vest' || d.type === 'helmet' || d.type === 'bag' || d.type === 'att' || inv.room(it.id) > 0)) return true;
  if (d.type === 'vest' || d.type === 'helmet' || d.type === 'bag') return false;
  if (d.type === 'weapon' && !d.rocket) {
    if (d.slot === 'secondary') return !inv.weapons[2];
    const a = inv.weapons[0], b = inv.weapons[1]; if (!a || !b) return !((a || b) && (a || b).id === it.id);
    return weaponScore(it.inst || newWeapon(it.id)) > Math.min(weaponScore(a), weaponScore(b)) + 10;
  }
  if (d.type === 'att') return inv.weapons.some((w) => w && attFits(it.id, w.id) && (!w.att[d.slot] || (d.slot === 'scope' && ITEMS[w.att.scope].zoom < d.zoom)));
  return false;
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

