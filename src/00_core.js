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
const store = {
  get(k, d) { try { const v = localStorage.getItem('lastdrop.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lastdrop.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

const IS_TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

const DEFAULT_SETTINGS = {
  quality: IS_TOUCH ? 'low' : 'medium',
  shadows: IS_TOUCH ? 'off' : 'low',
  lookSens: 1.0, aimSens: 0.65, touchSens: 1.0,
  sfx: 0.8, music: 0.35,
  view: 'tpp', difficulty: 'normal', bots: 24,
  btnScale: 1.0, hudOpacity: 0.95, hudScale: 1.0,
  mode: 'classic', map: 'kalden', time: 'day', outfit: 0,
  sens_iron: 1, sens_reddot: 1, sens_holo: 1, sens_x2: 1, sens_x3: 1, sens_x4: 1, sens_x6: 1,
  touchLayout: {}, stickFixed: false, queue: 'normal', squad: 'solo',
};
let SETTINGS = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
function saveSettings() { store.set('settings', SETTINGS); }

let STATS = Object.assign({ matches: 0, wins: 0, kills: 0, xp: 0, best: 99, recent: [] }, store.get('stats', {}));
function saveStats() { return store.set('stats', STATS); }
function levelFromXp(xp) {
  let lv = 1, need = 250, x = xp;
  while (x >= need) { x -= need; lv++; need = Math.round(need * 1.15); }
  return { lv, cur: x, need };
}

const QUALITY = {
  low:    { pr: 0.8, grass: 0,    trees: 0.65, far: 260, near: 60,  botDraw: 160 },
  medium: { pr: 1.0, grass: 1600, trees: 1.0,  far: 380, near: 90,  botDraw: 230 },
  high:   { pr: Math.min(window.devicePixelRatio || 1, 1.75), grass: 4000, trees: 1.25, far: 520, near: 120, botDraw: 320 },
};
const SHADOW_SIZE = { off: 0, low: 1024, high: 2048 };

const MAPS = {
  kalden:    { name: '칼덴 섬',   seed: 1337, desc: '강이 섬을 가르고 도시와 군사기지가 마주 보는 섬', mountain: 32, lakes: 1 },
  ironridge: { name: '아이언리지', seed: 90817, desc: '북쪽 산맥과 큰 호수, 산업 단지가 있는 거친 섬', mountain: 46, lakes: 1 },
  // 대형 맵: 8km x 8km. 높이맵 4m 간격, 지형 스트리밍, 최대 봇 99
  norden: { name: '노르덴 (8km)', seed: 40417, desc: '8×8km 대륙형 섬 · 도시 3 · 군사기지 2 · 마을 18 · 산맥 4', mountain: 70, big: true, half: 4000, hfRes: 4, maxBots: 99, wait0Min: 230,
    plane: { L: 5200, speed: 120, alt: 460, off: 1600 }, zone0: 3900, zoneOff: 500,
    zone: [{ wait: 270, shrink: 270, r: 2300, dps: 0.4 }, { wait: 150, shrink: 150, r: 1300, dps: 1.0 }, { wait: 120, shrink: 110, r: 700, dps: 2 }, { wait: 90, shrink: 80, r: 350, dps: 3.5 },
      { wait: 70, shrink: 60, r: 170, dps: 6 }, { wait: 50, shrink: 45, r: 80, dps: 9 }, { wait: 35, shrink: 35, r: 30, dps: 13 }, { wait: 25, shrink: 30, r: 10, dps: 16 }] },
  // 훈련장: 봇·자기장 없는 평지. 로비의 '훈련장' 버튼으로만 들어간다 (맵 선택 목록에는 없음)
  training: { name: '훈련장', seed: 2468, desc: '사격장·더미·차량·장애물 코스', training: true, half: 320, mountain: 0 },
};
const mapMaxBots = (id) => (MAPS[id] && MAPS[id].maxBots) || 48;
const MODES = {
  classic: { name: '클래식', zoneScale: 1.0, desc: '자기장 6단계 · 약 12분' },
  rapid:   { name: '쾌속전', zoneScale: 0.55, desc: '자기장 6단계 · 약 7분' },
};
// 팀 구성: 솔로는 기절 없이 바로 탈락, 듀오·스쿼드는 기절 → 팀원이 부활
const TEAM_MODES = {
  solo:  { name: '솔로', size: 1 },
  duo:   { name: '듀오', size: 2 },
  squad: { name: '스쿼드', size: 4 },
};
const TEAM_COLORS = ['#f2c94c', '#f2994a', '#5ab8f0', '#6fcf97'];   // 팀 안 번호(1~4)별 색
const REVIVE_T = 10;                 // 부활에 걸리는 시간(초)
const REVIVE_HP = 15;                // 부활 직후 체력
const BLEED_T = [40, 25, 15];        // 기절 후 출혈로 쓰러질 때까지(초): 첫 기절 / 두 번째 / 세 번째부터
const CRAWL_SPEED = 0.95;
const DIFFICULTY_NAMES ={ easy: '쉬움', normal: '보통', hard: '어려움', mixed: '혼합' };
const OUTFITS = [
  { name: '산림 위장', shirt: 0x55603f, pants: 0x3b4231, skin: 0xd8b08c, boots: 0x2a2620, accent: 0x7a6a45 },
  { name: '사막 작전', shirt: 0xb59a6a, pants: 0x8a7552, skin: 0xc99a74, boots: 0x4a3a2a, accent: 0x6d5a3a },
  { name: '야간 침투', shirt: 0x2d3440, pants: 0x22262e, skin: 0xe0bc9a, boots: 0x15171b, accent: 0x4a5566 },
  { name: '도시 회색', shirt: 0x7d8288, pants: 0x4b4f55, skin: 0xb98a66, boots: 0x222222, accent: 0xa34a3a },
];
