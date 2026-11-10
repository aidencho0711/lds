// ============================================================
// 00_core.js — 공통 유틸, 난수/노이즈, 설정·통계 저장, 상수
// ============================================================
'use strict';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const now = () => performance.now() / 1000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angleDiff(a, b) { // b - a 를 [-PI, PI]로
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function fmtTime(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function weightedPick(table, r = Math.random) { // [[value, weight], ...]
  let tot = 0; for (const e of table) tot += e[1];
  let x = r() * tot;
  for (const e of table) { x -= e[1]; if (x <= 0) return e[0]; }
  return table[table.length - 1][0];
}

// 2D value noise (seeded)
function makeNoise(rng) {
  const perm = new Uint16Array(512), val = new Float32Array(256);
  const p = []; for (let i = 0; i < 256; i++) { p.push(i); val[i] = rng() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
    const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}
function fbm(n, x, y, oct = 4, lac = 2, gain = 0.5) {
  let s = 0, a = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; norm += a; a *= gain; f *= lac; }
  return s / norm;
}

// ---------- 맵 상수 ----------
// 맵 반경/크기는 경기마다 setMapSize()로 바뀐다 (기본 700m 섬, 대형 8km)
let HALF = 350;
let SIZE = HALF * 2;
// 공간 격자의 빈 칸은 하나의 공유 배열을 가리킨다 → 대형 맵에서 수백만 개의 빈 배열 생성을 피함
const EMPTY_LIST = Object.freeze([]);
function gridPush(arr, k, v) { let l = arr[k]; if (l === EMPTY_LIST) l = arr[k] = []; l.push(v); }
const WATER_Y = 0;
const GRAVITY = 20;
const STEP_H = 0.6;          // 올라설 수 있는 턱 높이
const CHAR_R = 0.34;         // 캐릭터 충돌 반경

// ---------- 저장소 (실패해도 게임은 동작) ----------
// 주소 끝에 ?slot=2 를 붙이면 같은 브라우저에서 저장소·로그인을 따로 쓴다 (한 컴퓨터에서 계정 두 개로 파티 시험용)
const STORE_SLOT = (() => { try { return (new URLSearchParams(location.search).get('slot') || '').replace(/[^0-9]/g, '').slice(0, 2); } catch (e) { return ''; } })();
const STORE_PREFIX = 'lastdrop' + STORE_SLOT + '.';
const store = {
  get(k, d) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

const IS_TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

const DEFAULT_SETTINGS = {
  quality: IS_TOUCH ? 'low' : 'medium',
  shadows: IS_TOUCH ? 'off' : 'low',
  lookSens: 1.0, aimSens: 0.65, touchSens: 1.0,
  sfx: 0.8, music: 0.35,
  view: 'tpp', difficulty: 'normal', bots: 24,
  btnScale: 1.0, hudOpacity: 0.95, hudScale: 1.0,
  mode: 'classic', map: 'kalden', time: 'day', look: null, body: null, vlook: null, glook: null, gshow: null,
  sens_iron: 1, sens_reddot: 1, sens_holo: 1, sens_x2: 1, sens_x3: 1, sens_x4: 1, sens_x6: 1,
  touchLayout: {}, stickFixed: false, queue: 'normal', squad: 'solo', game: 'br',
  fps: 0, showFps: false,   // v20: 프레임 제한(30·60·120, 0 = 제한 없음 — 화면 주사율까지) · FPS 표시
};
let SETTINGS = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
delete SETTINGS.outfit;   // v14: 옛 복장 번호는 창고 장착 정보(look)로 대체
// 로그인 상태면 저장할 때마다 서버 동기화 예약 (10_cloud.js가 연결)
let onDataSaved = null;
const dataSaved = (what) => { if (onDataSaved) try { onDataSaved(what); } catch (e) { console.warn(e); } };
function saveSettings() { store.set('settings', SETTINGS); dataSaved('settings'); }
// 기기마다 다른 설정(화면 품질·버튼 배치 등)은 서버에 올리지 않는다
const DEVICE_SETTINGS = ['quality', 'shadows', 'touchLayout', 'btnScale', 'hudScale', 'hudOpacity', 'stickFixed', 'touchSens', 'fps', 'showFps'];

let STATS = Object.assign({ matches: 0, wins: 0, kills: 0, xp: 0, best: 99, recent: [] }, store.get('stats', {}));
// 데스매치 전적은 배틀로얄 전적(경기·우승·처치)과 따로 센다 — 경험치만 공유
const DM_STATS0 = { matches: 0, wins: 0, kills: 0, deaths: 0 };
if (!STATS.dm) STATS.dm = Object.assign({}, DM_STATS0);
function saveStats() { const ok = store.set('stats', STATS); dataSaved('stats'); return ok; }
function levelFromXp(xp) {
  let lv = 1, need = 250, x = xp;
  while (x >= need) { x -= need; lv++; need = Math.round(need * 1.15); }
  return { lv, cur: x, need };
}

const QUALITY = {
  low:    { pr: 0.8, grass: 0,    trees: 0.65, far: 260, near: 60,  botDraw: 160 },
  medium: { pr: 1.0, grass: 1600, trees: 1.0,  far: 380, near: 90,  botDraw: 230 },
  high:   { pr: Math.min(window.devicePixelRatio || 1, 1.75), grass: 4000, trees: 1.25, far: 520, near: 120, botDraw: 320 },
  // v20 엑스트라: '높음'보다 선명(해상도 배율 최대 2)·멀리(시야 640m, 봇 420m)·풀 많이, 정밀 캐릭터·캐릭터 그림자를 더 멀리(lod·shadow).
  //  나무 수는 '높음'과 같게 — 맵 생성 시간·메모리를 늘리지 않는다
  extra:  { pr: Math.min(window.devicePixelRatio || 1, 2), grass: 6500, trees: 1.25, far: 640, near: 150, botDraw: 420, lod: 70, shadow: 90 },
};
// 그림자 지도 해상도 · 'ultra'(최고 4096)는 그림자 범위도 넓힌다(SHADOW_HALF)
const SHADOW_SIZE = { off: 0, low: 1024, high: 2048, ultra: 4096 };
const SHADOW_HALF = (size) => (size >= 4096 ? 80 : 55);

const MAPS = {
  kalden:    { name: '칼덴 섬',   seed: 1337, desc: '강이 섬을 가르고 도시와 군사기지가 마주 보는 섬', mountain: 32, lakes: 1 },
  ironridge: { name: '아이언리지', seed: 90817, desc: '북쪽 산맥과 큰 호수, 산업 단지가 있는 거친 섬', mountain: 46, lakes: 1 },
  // 대형 맵: 8km x 8km. 높이맵 4m 간격, 지형 스트리밍, 최대 봇 99
  //  v2: 새 생성기(02_world_v2.js) — 꺾은선 산맥·A* 도로·길가 마을·특수 지역. veh/horses/gold: 차량·말·골드 주머니 수
  norden: { name: '노르덴 (8km)', seed: 40417, desc: '8×8km 대륙형 섬 · 산맥 3줄 · 도시 3 · 특수 지역 9 · 길가 마을 46 · 주유소 8', mountain: 70, big: true, v2: 'norden', half: 4000, hfRes: 4, maxBots: 99, wait0Min: 230,
    veh: 170, horses: 34, gold: 48,
    plane: { L: 5200, speed: 120, alt: 460, off: 1600 }, zone0: 3900, zoneOff: 500,
    zone: [{ wait: 270, shrink: 270, r: 2300, dps: 0.4 }, { wait: 150, shrink: 150, r: 1300, dps: 1.0 }, { wait: 120, shrink: 110, r: 700, dps: 2 }, { wait: 90, shrink: 80, r: 350, dps: 3.5 },
      { wait: 70, shrink: 60, r: 170, dps: 6 }, { wait: 50, shrink: 45, r: 80, dps: 9 }, { wait: 35, shrink: 35, r: 30, dps: 13 }, { wait: 25, shrink: 30, r: 10, dps: 16 }] },
  // 4km 열대 정글 섬: 두 갈래 강으로 땅이 셋으로 나뉨. 빽빽한 숲 · 자기장이 8km 맵보다 빨리 줄어든다
  kinaru: { name: '키나루 (4km)', seed: 72091, desc: '4×4km 열대 정글 섬 · 중앙 훈련기지 · 두 갈래 강 · 사원 유적 · 계단논 · 수상 마을', big: true, v2: 'jungle', half: 2000, hfRes: 2.5, maxBots: 74, wait0Min: 150,
    veh: 64, horses: 8, gold: 24, fog: { color: 0x9db8b4, near: 0.12, far: 0.8 },
    plane: { L: 2700, speed: 95, alt: 400, off: 800 }, zone0: 1950, zoneOff: 260,
    zone: [{ wait: 200, shrink: 200, r: 1150, dps: 0.5 }, { wait: 120, shrink: 110, r: 650, dps: 1.2 }, { wait: 100, shrink: 85, r: 350, dps: 2.5 }, { wait: 75, shrink: 60, r: 180, dps: 4 },
      { wait: 55, shrink: 45, r: 90, dps: 7 }, { wait: 40, shrink: 35, r: 40, dps: 10 }, { wait: 30, shrink: 30, r: 15, dps: 14 }, { wait: 20, shrink: 25, r: 5, dps: 16 }] },
  // 훈련장: 봇·자기장 없는 평지. 로비의 '훈련장' 버튼으로만 들어간다 (맵 선택 목록에는 없음)
  training: { name: '훈련장', seed: 2468, desc: '사격장·더미·차량·장애물 코스', training: true, half: 320, mountain: 0 },
  // 데스매치 전용: 72×72m 컨테이너 야드 (팀 데스매치·웨폰 데스매치 공용, 맵 선택 목록에는 없음)
  arena: { name: '컨테이너 야드', seed: 7123, desc: '72×72m · 2층 전망대 · 컨테이너 · 창고', arena: true, half: 100, mountain: 0 },
};
// 게임 종류: 배틀로얄 / 팀 데스매치 / 웨폰 데스매치
const GAME_TYPES = {
  br:  { name: '배틀로얄', short: '배틀로얄', desc: '자기장 · 파밍 · 최후의 1인(팀)' },
  tdm: { name: '팀 데스매치', short: '팀 데스매치', desc: '4 대 4 · 전원 같은 무작위 총과 스코프 · 40킬 먼저', dm: true },
  wdm: { name: '웨폰 데스매치', short: '웨폰 데스매치', desc: '4 대 4 · 처치할 때마다 총·스코프가 바뀜 · 40킬 먼저', dm: true },
  // v20 대결: 친구와 라운드제 (파티원은 번갈아 양 팀으로, 빈자리는 봇) — 10_dm.js가 데스매치 규칙 대신 라운드 규칙으로 진행
  duel1: { name: '1대1 대결', short: '1:1 대결', desc: '친구와 1 대 1 · 먼저 4라운드 · 라운드 90초 · 매 라운드 같은 무작위 총', dm: true, duel: 1 },
  duel2: { name: '2대2 대결', short: '2:2 대결', desc: '친구와 2 대 2 · 먼저 4라운드 · 라운드 90초 · 빈자리는 봇', dm: true, duel: 2 },
};
const DM_RULES = { killTarget: 40, timeLimit: 600, respawn: 3, protect: 2, teamSize: 4, regenDelay: 4, regenRate: 22 };
// 대결: 먼저 이길 라운드 수 · 라운드 시간 · 시작 전 준비(움직일 수 없음) · 라운드 사이 쉬는 시간(초)
const DUEL_RULES = { win: 4, round: 90, prep: 3, gap: 3.5 };
const dmTeamSize = (g) => (GAME_TYPES[g] && GAME_TYPES[g].duel) || DM_RULES.teamSize;
const isDuel = (g) => !!(GAME_TYPES[g] && GAME_TYPES[g].duel);
const isDmGame = (g) => !!(GAME_TYPES[g] && GAME_TYPES[g].dm);
// 한 판 최대 인원: 기본 75명(봇 74 + 나) · 노르덴 100명
const MATCH_BOTS = 74;
const mapMaxBots = (id) => (MAPS[id] && MAPS[id].maxBots) || MATCH_BOTS;
// 맵 한 변 길이(km) 표기: 8×8km, 4×4km, 0.7×0.7km
const mapKm = (id) => { const M = MAPS[id] || {}, k = (M.half || 350) * 2 / 1000; return `${k >= 2 ? k : k.toFixed(1)}×${k >= 2 ? k : k.toFixed(1)}km`; };
const MODES = {
  classic: { name: '클래식', zoneScale: 1.0, desc: '자기장 6단계 · 약 12분' },
  rapid:   { name: '쾌속전', zoneScale: 0.55, desc: '자기장 6단계 · 약 7분' },
};
// 팀 구성: 솔로는 기절 없이 바로 탈락, 듀오·스쿼드는 기절 → 팀원이 부활
const TEAM_MODES = {
  solo:  { name: '솔로', size: 1 },
  duo:   { name: '듀오', size: 2 },
  trio:  { name: '트리오', size: 3 },
  squad: { name: '스쿼드', size: 4 },
};
const TEAM_COLORS = ['#f2c94c', '#f2994a', '#5ab8f0', '#6fcf97'];   // 팀 안 번호(1~4)별 색
const REVIVE_T = 10;                 // 부활에 걸리는 시간(초)
const REVIVE_HP = 15;                // 부활 직후 체력
const BLEED_T = [40, 25, 15];        // 기절 후 출혈로 쓰러질 때까지(초): 첫 기절 / 두 번째 / 세 번째부터
const CRAWL_SPEED = 0.95;
const DIFFICULTY_NAMES ={ easy: '쉬움', normal: '보통', hard: '어려움', extreme: '익스트림', mixed: '혼합' };
// 내 외형: 장착 스킨(SETTINGS.look) + 몸(SETTINGS.body) — 파티·같이 하기에서 이 묶음을 주고받는다
// veh: 장착한 차량 스킨(차종별) — 경기에서 운전석에 탈 때 그 차량을 내 스킨으로 바꾼다
// 파티원에게 보내는 외형 묶음: 옷·몸 · 차량 스킨(veh) · 총기 스킨(gun) · 로비에서 들고 있는 총(sg — 파티원 화면의 로비에도 그 총·스킨으로)
const myLook = () => ({ eq: SETTINGS.look || null, body: SETTINGS.body || null, veh: typeof Eco !== 'undefined' ? Eco.vlook() : null, gun: typeof Eco !== 'undefined' ? Eco.glook() : null, sg: typeof Eco !== 'undefined' ? Eco.showGun() : null, pf: typeof Prof !== 'undefined' ? Prof.my() : null });   // pf: 프로필 사진·테두리·칭호 (10_ui_profile.js)
