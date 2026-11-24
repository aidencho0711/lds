// ============================================================
// 05_models_mskinfx.js — v23 근접 무기 스킨: 처치 효과 · 킬 로그 정보
//  · 울트라레어(rar 5) 다섯 모양: 그 근접 무기로 처치하면 쓰러진 자리에 모양마다 다른 효과(1~1.5초) — 그 처치를 보는 모두에게(같이 하기 기기 포함)
//    나비 나이프 = 엇갈린 두 번의 베기 + 무지갯빛 나비가 날갯짓하며 나선으로 날아오름 · 카람빗 = 검은 갈고리 초승달(금빛 날 선)이 몸 둘레를 휘감음 + 금 불티 + 바닥의 검은 고리
//    네온 블레이드 = 바닥에 퍼지는 시안 회로선 + 깜빡이는 깨진 네모 + 가는 세로 빛 베기 · 서리 결정 검 = 사방으로 튀는 얼음 조각 + 바닥 서리 고리 + 눈 안개
//    황금 프라이팬 = 빙글빙글 쏟아지는 금화·반짝이 + 밝은 고리 섬광
//    내가 처치하면 조준점 아래 휘장(10_hud.js skinKill — 모양마다 다른 테·문양) · 킬 로그 줄도 모양마다 꾸밈(10_hud.js killfeed)
//  · 슈퍼레어(rar 4): 스킨 색의 작은 바닥 고리·빛·조각 (휘장 없음) — 총 스킨의 '약한 효과'처럼
//  · 기절에는 효과 없음(킬 로그만) · 피해·거리·동작은 그대로 — 보이기만
//  · 판 메시 32장을 장면에 두고 돌려 씀(풀) → 처치할 때 지오메트리·재질을 새로 만들지 않는다 · 입자는 GunSkin 점 구름(총 스킨 효과와 같은 그리기 1번)
//    재질 설정이 총 스킨 효과(05_models_gskinfx.js addMat)와 같아 같은 셰이더 프로그램을 쓰고, 경기 시작 첫 두 프레임에 모든 그림을 투명하게 그려 텍스처까지 미리 올린다
//  · FX.init(경기·훈련장·데스매치 시작) → init · FX.update → update · disposeMatch → dispose (06_combat.js · 11_game.js)
// ============================================================
const MeleeFx = (() => {
  // ---------- 주제 ----------
  //  울트라레어 모양 → kind: 휘장·킬 로그 CSS 열쇠(k-m-…) · c / c2: 휘장·킬 로그 색(--sk1 / --sk2) · lc: 주변을 비추는 빛 · snd: 처치 소리(Audio.skinFx 의 기존 소리를 빌림)
  const THEME = {
    balisong: { kind: 'm-balisong', c: 0xff5ad8, c2: 0x9fdcff, lc: 0xff9af0, snd: 'prism' },
    karambit: { kind: 'm-karambit', c: 0xe2b04a, c2: 0xfff0c0, lc: 0xffc060, snd: 'void' },
    neon: { kind: 'm-neon', c: 0x46f2ff, c2: 0xe9feff, lc: 0x46f2ff, snd: 'zero' },
    frost: { kind: 'm-frost', c: 0x9fe8ff, c2: 0xffffff, lc: 0xbff2ff, snd: 'frost' },
    golden: { kind: 'm-golden', c: 0xffc23a, c2: 0xfff2c0, lc: 0xffd070, snd: 'frontier' },
  };
  // 슈퍼레어 모양 → [효과 색, 소리] (표에 없는 모양은 레어도 색 · 맑은 소리)
  const LITE = { icicle: [0x9fe8ff, 'frost'], waffle: [0xff7a4a, 'ember'], ginger: [0xffb070, 'frontier'], fireaxe: [0xff4a32, 'ember'], warhammer: [0xe0b450, 'chaos'] };
  // 나비 나이프 손잡이 빛깔(파랑 · 보라 · 자홍 · 금 — 05_models_mskin_knife.js)을 밝게 + 하늘색
  const IRI = [0x5a8cff, 0x9b6bff, 0xff5ad8, 0xffc85a, 0x6ae8ff];
  const isMelee = (id) => !!id && !!ITEMS[id] && ITEMS[id].type === 'melee';
  // 처치·기절에 쓴 근접 무기에 그 사람이 낀 스킨 id (없으면 null) — 나·파티원·봇 모두 c.look (봇은 07_bot_skin.js 가 골라 줌)
  const ofKill = (by, cause) => (by && isMelee(cause) && typeof MeleeSkin !== 'undefined' ? MeleeSkin.ofChar(by, cause) : null);
  // 2 = 울트라레어 효과(주제가 있는 모양) · 1 = 약한 효과(슈퍼레어 이상) · 0 = 없음
  const tierOf = (S) => (S.rar === 5 && THEME[S.shape] ? 2 : (S.rar || 0) >= 4 ? 1 : 0);
  // 킬 로그·휘장용: { name, rar, color(레어도 색), th(울트라레어 주제 → 꾸민 줄) }
  function info(id) {
    const S = id && Body.SKINS[id]; if (!S || !/^m_/.test(S.slot)) return null;
    return { name: S.name, rar: S.rar || 0, color: rarOf(S.rar || 0).color, th: tierOf(S) === 2 ? THEME[S.shape] : null };
  }
  // 스킨 id 의 효과 단계 (근접 무기 스킨이 아니면 0) · 상점 설명 한 토막
  const tier = (id) => { const S = id && Body.SKINS[id]; return S && /^m_/.test(S.slot) ? tierOf(S) : 0; };
  const perk = (id) => { const k = tier(id); return k === 2 ? '처치 효과 · 킬 로그' : k === 1 ? '약한 처치 효과' : ''; };

  // ---------- 그림 (처음 쓸 때 한 번 그림 · 경기 시작 때 미리) ----------
  const TEX = {}, K = () => SkinFx.kit;
  const ctex = (key, W, H, fn) => { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d'), W, H); return (TEX[key] = new THREE.CanvasTexture(c)); };
  // 베기 자국: 판 가운데를 지나는 아치 — 가운데가 두껍고 양 끝이 가늘어짐 (번진 빛 · 날 · 밝은 심 세 겹)
  const slashTex = () => ctex('slash', 256, 256, (g) => {
    const cx = 128, cy = 226, R = 104, a0 = -Math.PI / 2 - 1.1, a1 = -Math.PI / 2 + 1.1, n = 48;
    const cres = (w, r0, al, blur) => {
      g.save(); g.fillStyle = `rgba(255,255,255,${al})`; if (blur) { g.shadowColor = '#fff'; g.shadowBlur = blur; }
      g.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * t, r = r0 + w * Math.pow(Math.sin(Math.PI * t), 1.4); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      for (let i = n; i >= 0; i--) { const t = i / n, a = a0 + (a1 - a0) * t, r = r0 - w * 0.25 * Math.sin(Math.PI * t); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.restore();
    };
    cres(30, R, 0.3, 16); cres(18, R + 4, 0.7, 4); cres(6, R + 12, 1, 0);
  });
  // 나비: 윗날개·아랫날개 한 쌍씩 + 날개 무늬(눈알 점·줄은 흐리게 뚫음) + 몸통 — 흰색 (색은 재질 색이 무지갯빛으로 바뀜)
  const flyTex = () => ctex('fly', 128, 128, (g) => {
    g.translate(64, 64); g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(s * 16, -50, s * 64, -48, s * 57, -14); g.bezierCurveTo(s * 53, 2, s * 22, 4, 0, 1); g.fill();
      g.beginPath(); g.moveTo(0, 3); g.bezierCurveTo(s * 42, 2, s * 48, 38, s * 30, 46); g.bezierCurveTo(s * 18, 52, s * 6, 30, 0, 10); g.fill();
    }
    g.shadowBlur = 0; g.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.ellipse(s * 35, -21, 10, 7, s * 0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(s * 24, 27, 6, 5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(s * 4, -3); g.lineTo(s * 50, -31); g.lineTo(s * 47, -24); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; g.fillRect(-2.5, -17, 5, 36);
  });
  // 카람빗 갈고리 초승달: 판 가운데(몸) 둘레를 도는 날 — 꼬리에 손가락 고리, 끝은 안으로 휘어 갈고리 · 안쪽(오목한 쪽)이 날
  const hookPts = () => {
    const R = 104, a0 = -3.4, a1 = 0.5, n = 56, out = [], inn = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + (a1 - a0) * t, cu = t > 0.8 ? Math.pow((t - 0.8) / 0.2, 1.7) * 36 : 0, w = 3 + 24 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.9);
      out.push([128 + Math.cos(a) * (R - cu), 128 + Math.sin(a) * (R - cu)]); inn.push([128 + Math.cos(a) * (R - cu - w), 128 + Math.sin(a) * (R - cu - w)]);
    }
    return { out, inn, ring: [128 + Math.cos(a0) * (R - 14), 128 + Math.sin(a0) * (R - 14)] };
  };
  const line = (g, P) => { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
  // 몸통(덮어 그리기로 검게) · 테(더하기 빛으로 금빛: 안쪽 날 선은 굵게, 바깥 등은 가늘게, 고리 테두리)
  const hookTex = () => ctex('hook', 256, 256, (g) => { const H = hookPts(); g.fillStyle = '#fff'; line(g, H.out); for (let i = H.inn.length - 1; i >= 0; i--) g.lineTo(H.inn[i][0], H.inn[i][1]); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(H.ring[0], H.ring[1], 15, 0, TAU); g.stroke(); });
  const hookEdgeTex = () => ctex('hookE', 256, 256, (g) => {
    const H = hookPts(); g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 10;
    g.lineWidth = 4.5; line(g, H.inn); g.stroke(); g.lineWidth = 2; line(g, H.out); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(H.ring[0], H.ring[1], 19, 0, TAU); g.stroke(); g.beginPath(); g.arc(H.ring[0], H.ring[1], 11, 0, TAU); g.stroke();
  });
  // 갈고리 끝 (판 좌표: 가운데 0, 한 변 1) — 금 불티가 나오는 자리
  let TIP = null;
  const hookTip = () => { if (!TIP) { const H = hookPts(), p = H.inn[H.inn.length - 1]; TIP = [p[0] / 256 - 0.5, 0.5 - p[1] / 256]; } return TIP; };
  // 회로판 선: 가운데 칩에서 45° 단위로 꺾이며 바깥으로 뻗는 선 + 끝 패드 · 꺾인 자리 작은 네모 (n 줄)
  const circTex = (key, n) => ctex(key, 256, 256, (g) => {
    g.translate(128, 128);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 40); r.addColorStop(0, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-40, -40, 80, 80);
    g.strokeStyle = g.fillStyle = '#fff'; g.lineJoin = 'miter'; g.lineWidth = 3; g.strokeRect(-12, -12, 24, 24); g.fillRect(-5, -5, 10, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (Math.random() - 0.5) * 0.3, base = Math.round(a / (Math.PI / 4)); let dir = base, x = Math.cos(a) * 14, y = Math.sin(a) * 14;
      g.lineWidth = i % 3 ? 2 : 3; g.beginPath(); g.moveTo(x, y);
      for (let s = 0, S = 4 + ((Math.random() * 4) | 0); s < S; s++) {
        const L = 12 + Math.random() * 18, d = dir * Math.PI / 4; x += Math.cos(d) * L; y += Math.sin(d) * L; g.lineTo(x, y);
        if (Math.hypot(x, y) > 106) break;
        const q = Math.random(); dir = q < 0.4 ? (dir === base ? base + (Math.random() < 0.5 ? 1 : -1) : base) : dir;
        if (q < 0.15) g.fillRect(x - 3, y - 3, 6, 6);
      }
      g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.stroke();
    }
  });
  // 깨진 네모: 굵은 네모 테 + 모서리 점 + 흐린 속
  const sqTex = () => ctex('sq', 64, 64, (g) => { g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = 5; g.strokeRect(6, 6, 52, 52); for (const [x, y] of [[6, 6], [58, 6], [6, 58], [58, 58]]) g.fillRect(x - 5, y - 5, 10, 10); g.globalAlpha = 0.3; g.fillRect(14, 14, 36, 36); });
  // 세로 빛 베기: 가운데 밝은 줄(옆으로 흐려짐) · 위아래 끝도 흐려짐
  const beamTex = () => ctex('beam', 32, 128, (g) => {
    const hz = g.createLinearGradient(0, 0, 32, 0); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(0.4, 'rgba(255,255,255,0.45)'); hz.addColorStop(0.5, 'rgba(255,255,255,1)'); hz.addColorStop(0.6, 'rgba(255,255,255,0.45)'); hz.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hz; g.fillRect(0, 0, 32, 128);
    const vt = g.createLinearGradient(0, 0, 0, 128); vt.addColorStop(0, 'rgba(0,0,0,0)'); vt.addColorStop(0.15, 'rgba(0,0,0,1)'); vt.addColorStop(0.85, 'rgba(0,0,0,1)'); vt.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = vt; g.fillRect(0, 0, 32, 128);
  });
  // 얼음 조각: 위아래가 뾰족한 길쭉한 육각 결정 · 한쪽 면이 더 밝고 가운데 능선
  const shardTex = () => ctex('shard', 64, 128, (g) => {
    const P = [[32, 3], [47, 28], [43, 104], [32, 125], [21, 104], [17, 28]];
    g.fillStyle = 'rgba(255,255,255,0.45)'; line(g, P); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; line(g, [[32, 3], [47, 28], [43, 104], [32, 125]]); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; line(g, P); g.closePath(); g.stroke(); g.lineWidth = 2; line(g, [[32, 5], [33, 122]]); g.stroke();
  });
  // 서리 고리: 둥근 테 + 바깥(길게)·안쪽(짧게)으로 번갈아 뾰족한 얼음 가시 + 흐린 안쪽 테
  const fringTex = () => ctex('fring', 256, 256, (g) => {
    g.translate(128, 128); g.fillStyle = g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
    g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 90, 0, TAU); g.stroke();
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU + (Math.random() - 0.5) * 0.12, L = 12 + Math.random() * 24, w = 0.05, o = i % 2 ? 1 : -0.55; g.beginPath(); g.moveTo(Math.cos(a - w) * 90, Math.sin(a - w) * 90); g.lineTo(Math.cos(a) * (90 + L * o), Math.sin(a) * (90 + L * o)); g.lineTo(Math.cos(a + w) * 90, Math.sin(a + w) * 90); g.closePath(); g.fill(); }
    g.shadowBlur = 0; g.lineWidth = 1.5; g.globalAlpha = 0.5; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.stroke();
  });
  // 금화: 빛 받는 쪽이 밝은 금 원판 + 테 홈 + 가운데 별 + 반짝 — 색을 그대로 그림(덮어 그리기)
  const coinTex = () => ctex('coin', 64, 64, (g) => {
    const r = g.createRadialGradient(24, 22, 2, 32, 32, 31); r.addColorStop(0, '#fff7cf'); r.addColorStop(0.4, '#ffd24f'); r.addColorStop(0.82, '#cf8f17'); r.addColorStop(1, '#8a560a');
    g.fillStyle = r; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,72,6,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(32, 32, 23, 0, TAU); g.stroke();
    g.fillStyle = '#fff0a8'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 5 : 12; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); } g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(22, 19, 7, 3, -0.7, 0, TAU); g.fill();
  });
  // 이번 경기에 쓰는 모든 그림 (빛·고리·얼음 금은 총 스킨 효과의 것을 같이 씀)
  const allTex = () => [K().tex.glow(), K().tex.ring(), K().tex.ice(), slashTex(), flyTex(), hookTex(), hookEdgeTex(), circTex('circ1', 14), circTex('circ2', 9), sqTex(), beamTex(), shardTex(), fringTex(), coinTex()];

  // ---------- 판 풀 ----------
  //  같은 1×1 판(앞면 +z) 32장 — 그때그때 그림·색·혼합(더하기 빛 / 덮어 그리기)·크기·자리만 바꿔 바닥 자국·고리·카메라를 보는 카드·세운 빛으로 쓴다
  //  풀이 바닥나면(효과가 많이 겹침) 그 조각만 생략 · 판·재질·그림은 경기가 끝나도 남겨 다음 경기에 다시 씀
  const N = 32, ALL = [], FREE = [], LIVE = [], ZZ = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
  let SC = null, GRP = null, warmLeft = 0;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
  function build() {
    if (GRP) return;
    const geo = new THREE.PlaneGeometry(1, 1); GRP = new THREE.Group(); GRP.name = 'meleeFx';
    for (let i = 0; i < N; i++) {
      // 05_models_gskinfx.js addMat 과 같은 설정 → 같은 셰이더 프로그램 (덮어 그리기는 혼합 상태만 바꿈 — 프로그램은 그대로)
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: K().tex.glow(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.visible = false; GRP.add(m); ALL.push(m);
    }
  }
  // 경기·훈련장·데스매치 시작 (FX.init): 풀을 새 장면에 넣고, 첫 두 프레임은 모든 그림을 판마다 하나씩 투명하게 그려 셰이더·텍스처를 미리 올린다 (첫 처치 때 끊김 방지)
  function init(sc) {
    dispose(); if (!sc || typeof SkinFx === 'undefined' || !SkinFx.kit) return;
    build(); SC = sc; sc.add(GRP); FREE.length = 0; FREE.push(...ALL);
    const T = allTex(), cp = G.camera ? G.camera.position : UP;
    ALL.forEach((m, i) => { const M = m.material; M.map = T[i % T.length]; M.opacity = 0; M.blending = THREE.AdditiveBlending; m.position.copy(cp); m.scale.setScalar(0.001); m.frustumCulled = false; m.visible = true; });
    warmLeft = 3;
  }
  function unwarm() { for (const m of FREE) m.visible = false; for (const m of ALL) m.frustumCulled = true; }
  // 경기 끝 (disposeMatch — 장면을 정리하기 전에): 장면에서 빼고 진행 중인 효과를 지움
  function dispose() {
    LIVE.length = 0; warmLeft = 0; SC = null;
    if (GRP) { if (GRP.parent) GRP.parent.remove(GRP); for (const m of ALL) { m.visible = false; m.frustumCulled = true; } FREE.length = 0; FREE.push(...ALL); }
  }
  // 효과 하나 = 시간 진행 하나: dur 초 동안 매 프레임 upd(e, T 지난 초, dt) → 끝나면 빌린 판을 돌려줌
  const fx = (dur) => ({ t: 0, dur, ms: [], upd: null });
  function go(e, upd) { e.upd = upd; LIVE.push(e); upd(e, 0, 0); }
  // 판 하나 빌리기: tex 그림 · col 색 · add false = 덮어 그리기(검은 갈고리·금화) · ord 그리기 순서 (풀이 바닥나면 null)
  function take(e, tex, col, add, ord) {
    const m = FREE.pop(); if (!m) return null;
    const M = m.material; M.map = tex; M.color.setHex(col); M.blending = add === false ? THREE.NormalBlending : THREE.AdditiveBlending; M.opacity = 0;
    m.renderOrder = ord || 7; m.scale.setScalar(0.001); m.quaternion.identity(); m.visible = true; e.ms.push(m); return m;
  }
  // 매 프레임 (FX.update — 경기 시간으로: 멈추면 같이 멈춤)
  function update(dt) {
    if (!SC) return;
    if (warmLeft > 0 && --warmLeft === 0) unwarm();
    for (let i = LIVE.length - 1; i >= 0; i--) {
      const e = LIVE[i]; e.t = Math.min(e.dur, e.t + dt); e.upd(e, e.t, dt);
      if (e.t >= e.dur) { for (const m of e.ms) { m.visible = false; FREE.push(m); } LIVE.splice(i, 1); }
    }
  }
  // 카메라를 보는 카드 (rz: 화면에서 돌림)
  function bill(m, p, rz) { m.position.copy(p); m.quaternion.copy(G.camera.quaternion); if (rz) m.rotateZ(rz); }
  // 바닥에 누운 판 (경사면이면 땅을 따라) · rz: 바닥에서 돌림
  function flat(m, gp, lift, rz) { m.position.set(gp.x, gp.y, gp.z).addScaledVector(gp.n, lift); m.quaternion.setFromUnitVectors(ZZ, gp.n); if (rz) m.rotateZ(rz); }
  // 세운 판 (세로는 그대로 두고 카메라 쪽으로만 돎)
  function stand(m, x, y, z) { const c = G.camera.position; m.position.set(x, y, z); m.rotation.set(0, Math.atan2(c.x - x, c.z - z), 0); }
  // 멀리 있어도 보이도록 입자를 키움 (총 스킨 효과와 같은 셈)
  const farK = (p, lo, hi) => clamp((p.distanceTo(G.camera.position) * (G.camera.fov / 72)) / lo, 1, hi);
  // 주변을 잠깐 주제 색으로 비춤 (총 스킨 효과의 점광원을 빌림 — 근접 처치는 가까워서 총 스킨보다 약하고 짧게)
  const flash = (cp, th) => K().light(cp, th.lc, 2.6, 0.42);
  // a 초 동안 나타나고 b 초부터 c 초 동안 사라짐 · 끝으로 갈수록 느려지는 0 → 1
  const fade = (T, a, b, c) => (T < a ? T / a : T < b ? 1 : Math.max(0, 1 - (T - b) / c));
  const easeOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x, 0, 1), p);

  // ---------- 처치 효과 (t 쓰러진 캐릭터 · th 주제 · gp 바닥 {x,y,z,n} · cp 가슴 · k 입자 배율) ----------
  const FXS = {};
  // 베기 자국 하나: at 초에 나타나 0.3초 동안 조금 커지고 돌며 사라짐 (rz: 화면 기울기 · fl: −1 이면 좌우 뒤집음)
  function slash(m, p, T, at, rz, size, fl) {
    if (!m) return; const v = (T - at) / 0.3;
    if (v < 0 || v > 1) { m.material.opacity = 0; return; }
    bill(m, p, rz + v * 0.4 * fl); const s = size * (0.8 + 0.3 * Math.sqrt(v)); m.scale.set(s * fl, s, 1); m.material.opacity = v < 0.12 ? v / 0.12 : 1 - (v - 0.12) / 0.88;
  }
  // 나비 나이프: 엇갈린 두 번의 베기(자홍 → 하늘색) · 무지갯빛 나비 다섯 마리가 날갯짓하며 나선으로 날아오름(색이 계속 바뀌고 반짝이를 흘림) · 무지개 반짝이
  FXS.balisong = (t, th, gp, cp, k) => {
    const e = fx(1.5), P = K().pool(), E = K().E, rot = (Math.random() - 0.5) * 0.5;
    const s1 = take(e, slashTex(), 0xff5ad8, true, 8), s2 = take(e, slashTex(), 0x6ae8ff, true, 8), gl = take(e, K().tex.glow(), 0xffd6f6, true, 7);
    const fl = [];
    for (let i = 0; i < 5; i++) { const m = take(e, flyTex(), 0xffffff, true, 8); if (m) fl.push({ m, a: Math.random() * TAU, r: rnd(0.12, 0.3), w: rnd(2, 3.2) * (i % 2 ? 1 : -1), vy: rnd(0.8, 1.35), h: rnd(-0.35, 0.2), s: rnd(0.3, 0.42), ph: Math.random(), f: rnd(10, 14), d: 0.08 + i * 0.05 }); }
    flash(cp, th);
    for (let i = 0; i < 28; i++) { _v.set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(1.5, 4.2)); E(P, cp, _v.x, _v.y, _v.z, i % 7 === 0 ? 0xffffff : IRI[i % IRI.length], rnd(0.035, 0.065) * k, rnd(0.35, 0.75), { sq: i % 3 === 0, drag: 3, so: 0.45 }); }
    go(e, (e, T, dt) => {
      slash(s1, cp, T, 0, 0.62 + rot, 2.4, 1); slash(s2, cp, T, 0.12, -0.62 + rot, 2.4, -1);
      if (gl) { bill(gl, cp); gl.scale.setScalar(1.9 * (0.5 + 0.5 * easeOut(T / 0.1))); gl.material.opacity = fade(T, 0.04, 0.08, 0.3); }
      for (const b of fl) {
        const tt = T - b.d, M = b.m.material; if (tt < 0) { M.opacity = 0; continue; }
        const ang = b.a + b.w * tt, rr = b.r + 0.55 * Math.sqrt(Math.min(1, tt / 1.1));
        _a.set(cp.x + Math.cos(ang) * rr, cp.y + b.h + b.vy * tt + Math.sin(tt * 6 + b.ph * 6) * 0.07, cp.z + Math.sin(ang) * rr);
        bill(b.m, _a, Math.sin(tt * 4 + b.ph * 6) * 0.4); b.m.scale.set(b.s * (0.18 + 0.82 * Math.abs(Math.cos(tt * b.f + b.ph * 3))), b.s, 1);
        M.color.setHSL((b.ph + tt * 0.6) % 1, 0.95, 0.62); M.opacity = fade(tt, 0.1, 0.75, 0.42);
        if (dt && Math.random() < dt * 24) E(P, _a, rnd(-0.15, 0.15), rnd(-0.5, -0.1), rnd(-0.15, 0.15), IRI[(Math.random() * IRI.length) | 0], rnd(0.022, 0.038) * k, rnd(0.3, 0.55), { drag: 2, so: 0.4 });
      }
    });
  };
  // 카람빗: 검은 갈고리 초승달(금빛 날 선)이 몸 둘레를 한 바퀴 가까이 휙 감아 돎 — 카메라 쪽으로 조금 기울여 잘 보이게 · 갈고리 끝을 따라 금 불티 · 바닥에 검은 고리와 금 고리
  FXS.karambit = (t, th, gp, cp, k) => {
    const e = fx(1.3), P = K().pool(), E = K().E;
    const dk = take(e, hookTex(), 0x0a0807, false, 6), au = take(e, hookEdgeTex(), 0xf2c25a, true, 7);
    const rk = take(e, K().tex.ring(), 0x000000, false, 3), rg = take(e, K().tex.ring(), 0xe2b04a, true, 4), gl = take(e, K().tex.glow(), 0xffd890, true, 7);
    const n = new THREE.Vector3().subVectors(G.camera.position, cp).setY(0); if (n.lengthSq() < 1e-4) n.set(0, 0, 1);
    n.normalize().multiplyScalar(0.55).add(UP).normalize();
    const a0 = Math.random() * TAU, sp = Math.random() < 0.5 ? -1 : 1, y = cp.y - 0.1, tip = hookTip();
    flash(cp, th);
    for (let i = 0; i < 26; i++) { _v.set(rnd(-1, 1), rnd(0, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 5)); E(P, cp, _v.x, _v.y, _v.z, i % 4 ? 0xffc85a : 0xffffff, rnd(0.03, 0.05) * k, rnd(0.3, 0.6), { g: -6, drag: 2, so: 0.5 }); }
    go(e, (e, T, dt) => {
      const sw = easeOut(T / 0.55), ang = a0 + sp * sw * TAU * 0.9, op = fade(T, 0.05, 0.62, 0.45), s = 2.4 * (0.82 + 0.18 * sw);
      for (const m of [dk, au]) if (m) { m.position.set(cp.x, y, cp.z); m.quaternion.setFromUnitVectors(ZZ, n); m.rotateZ(ang); m.scale.set(s * sp, s, 1); }
      if (dk) dk.material.opacity = op * 0.92;
      if (au) au.material.opacity = op;
      // 갈고리 끝의 금 불티 (도는 동안)
      if (au && dt && T < 0.6) {
        au.updateMatrixWorld(); _a.set(tip[0], tip[1], 0).applyMatrix4(au.matrixWorld); _b.subVectors(_a, cp).normalize();
        for (let i = 0, c = Math.max(1, Math.round(dt * 90)); i < c; i++) E(P, _a, _b.x * rnd(0.8, 2) + rnd(-0.5, 0.5), rnd(0.2, 1.4), _b.z * rnd(0.8, 2) + rnd(-0.5, 0.5), Math.random() < 0.25 ? 0xffffff : Math.random() < 0.5 ? 0xffd27a : 0xe2a83a, rnd(0.03, 0.055) * k, rnd(0.25, 0.5), { g: -5, drag: 1.5, so: 0.5 });
      }
      if (rk) { flat(rk, gp, 0.04); rk.scale.setScalar(2 * (0.35 + 1.4 * easeOut(T / 0.6, 2))); rk.material.opacity = 0.65 * fade(T, 0.08, 0.75, 0.5); }
      if (rg) { flat(rg, gp, 0.06); const v = (T - 0.1) / 0.6; rg.scale.setScalar(2 * (0.4 + 1.8 * easeOut(v, 2.4))); rg.material.opacity = v < 0 ? 0 : 1 - Math.min(1, v); }
      if (gl) { bill(gl, cp); gl.scale.setScalar(2 * (0.5 + 0.5 * easeOut(T / 0.1))); gl.material.opacity = 0.8 * fade(T, 0.04, 0.06, 0.25); }
    });
  };
  // 네온 블레이드: 바닥에 시안 회로선이 두 겹으로 퍼져 나감(45° 어긋나게) · 가는 세로 빛이 위에서 바닥까지 몸을 가름(흰 심 + 시안 번짐) · 몸 둘레에 깨진 네모(판 2장 + 네모 입자)가 깜빡임
  FXS.neon = (t, th, gp, cp, k) => {
    const e = fx(1.3), P = K().pool(), E = K().E, r0 = Math.random() * TAU, top = gp.y + 3.2;
    const c1 = take(e, circTex('circ1', 14), 0x46f2ff, true, 3), c2 = take(e, circTex('circ2', 9), 0xb8fbff, true, 3);
    const bw = take(e, beamTex(), 0x46f2ff, true, 8), bc = take(e, beamTex(), 0xf2feff, true, 9), q1 = take(e, sqTex(), 0x46f2ff, true, 8), q2 = take(e, sqTex(), 0xff4fd8, true, 8), gl = take(e, K().tex.glow(), 0x8ff8ff, true, 7);
    let nq = 0;
    flash(cp, th);
    go(e, (e, T, dt) => {
      if (c1) { flat(c1, gp, 0.05, r0); c1.scale.setScalar(0.6 + 3.9 * easeOut(T / 0.42)); c1.material.opacity = fade(T, 0.04, 0.7, 0.55); }
      if (c2) { flat(c2, gp, 0.06, r0 + Math.PI / 4); const v = T - 0.12; c2.scale.setScalar(0.4 + 2.8 * easeOut(v / 0.4)); c2.material.opacity = v < 0 ? 0 : fade(v, 0.04, 0.55, 0.5); }
      // 세로 빛 베기: 0.04초부터 0.12초 동안 위에서 바닥까지 그어지고, 0.5초 동안 넓어지며 사라짐
      const v = T - 0.04, L = (top - gp.y) * easeOut(v / 0.12, 2), wd = v < 0.12 ? 1 : 1 + (v - 0.12) * 2.2, op = v < 0 ? 0 : v < 0.12 ? 1 : Math.max(0, 1 - (v - 0.12) / 0.5);
      if (bw) { stand(bw, cp.x, top - L / 2, cp.z); bw.scale.set(0.3 * wd, Math.max(0.01, L), 1); bw.material.opacity = op * 0.85; }
      if (bc) { stand(bc, cp.x, top - L / 2, cp.z); bc.scale.set(0.055 * wd, Math.max(0.01, L), 1); bc.material.opacity = op; }
      // 깨진 네모: 0.05초마다 몸 둘레 다른 자리로 튀며 깜빡임 (0.65초 동안)
      if (T < 0.65) {
        if (T >= nq) { nq = T + 0.05; for (const [m, s] of [[q1, 0.32], [q2, 0.22]]) if (m) { bill(m, _a.set(cp.x + rnd(-0.45, 0.45), cp.y + rnd(-0.7, 0.55), cp.z + rnd(-0.45, 0.45))); m.scale.setScalar(s * rnd(0.7, 1.3)); m.material.opacity = Math.random() < 0.8 ? 1 : 0; } }
      } else for (const m of [q1, q2]) if (m) m.material.opacity = 0;
      if (dt && T < 0.6) for (let i = 0, c = Math.round(dt * 70); i < c; i++) { _a.set(cp.x + rnd(-0.35, 0.35), gp.y + rnd(0.15, 1.75), cp.z + rnd(-0.35, 0.35)); E(P, _a, 0, rnd(0, 0.4), 0, Math.random() < 0.6 ? 0x46f2ff : Math.random() < 0.5 ? 0xffffff : 0xff4fd8, rnd(0.05, 0.11) * k, rnd(0.06, 0.18), { sq: 1, so: 0.85 }); }
      if (gl) { bill(gl, cp); gl.scale.setScalar(1.6); gl.material.opacity = 0.7 * fade(T, 0.03, 0.05, 0.25); }
    });
  };
  // 서리 결정 검: 얼음 조각(길쭉한 결정 판 6장 + 네모 얼음 입자)이 사방으로 튀었다 떨어짐 · 바닥에 서리 고리(가시 결정)가 퍼지며 돌고 얼음 금이 깔림 · 하얀 눈 안개
  FXS.frost = (t, th, gp, cp, k) => {
    const e = fx(1.45), P = K().pool(), E = K().E, r0 = Math.random() * TAU;
    const fr = take(e, fringTex(), 0x9fe8ff, true, 4), ic = take(e, K().tex.ice(), 0xeafcff, true, 3), gl = take(e, K().tex.glow(), 0xeafcff, true, 7);
    const sh = [];
    for (let i = 0; i < 6; i++) { const m = take(e, shardTex(), i % 2 ? 0xd8f6ff : 0x8fe0ff, true, 8); if (!m) break; const a = (i / 6) * TAU + rnd(-0.35, 0.35), s = rnd(1.8, 3); sh.push({ m, x: cp.x, y: cp.y, z: cp.z, vx: Math.cos(a) * s, vy: rnd(2, 3.6), vz: Math.sin(a) * s, r: Math.random() * TAU, w: rnd(-10, 10), s: rnd(0.3, 0.46), st: 0 }); }
    flash(cp, th);
    for (let i = 0; i < 36; i++) { _v.set(rnd(-1, 1), rnd(-0.1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 5)); E(P, cp, _v.x, _v.y, _v.z, i % 3 ? 0x9fe8ff : 0xffffff, rnd(0.04, 0.08) * k, rnd(0.5, 0.9), { sq: 1, g: -9.8, drag: 0.6, so: 0.85 }); }
    for (let i = 0; i < 34; i++) { const a = Math.random() * TAU, r = rnd(0.2, 1.1); _a.set(gp.x + Math.cos(a) * r, gp.y + rnd(0.1, 1.1), gp.z + Math.sin(a) * r); E(P, _a, Math.cos(a) * rnd(0.3, 0.9), rnd(0, 0.35), Math.sin(a) * rnd(0.3, 0.9), 0xeaf8ff, rnd(0.12, 0.24) * k, rnd(0.9, 1.4), { grow: 1.4, drag: 1.4, so: 0.5, a: 0.45 }); }
    go(e, (e, T, dt) => {
      if (fr) { flat(fr, gp, 0.06, r0 + T * 0.4); fr.scale.setScalar(2 * (0.25 + 1.35 * easeOut(T / 0.45))); fr.material.opacity = fade(T, 0.05, 0.6, 0.75); }
      if (ic) { flat(ic, gp, 0.04, r0); ic.scale.setScalar(3.6); ic.material.opacity = fade(T, 0.06, 0.7, 0.7); ic.material.color.setHex(0xeafcff).lerp(_c.setHex(0x4a9ad0), Math.min(1, T / 1.2)); }
      if (gl) { bill(gl, cp); gl.scale.setScalar(2.2 * (0.5 + 0.5 * easeOut(T / 0.08))); gl.material.opacity = fade(T, 0.03, 0.05, 0.28); }
      for (const b of sh) {
        if (dt && !b.st) { b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.r += b.w * dt; if (b.y < gp.y + 0.08 && b.vy < 0) { b.y = gp.y + 0.08; b.st = 1; } }
        bill(b.m, _a.set(b.x, b.y, b.z), b.r); b.m.scale.set(b.s * 0.5, b.s, 1); b.m.material.opacity = fade(T, 0.03, 0.8, 0.6);
      }
    });
  };
  // 황금 프라이팬: 금화 일곱 닢이 몸에서 튀어 올라 빙글빙글 돌며 쏟아져 바닥에 한 번 튀고 · 위에서 금빛 반짝이 비 · 바닥에 밝은 고리 섬광 두 겹
  FXS.golden = (t, th, gp, cp, k) => {
    const e = fx(1.5), P = K().pool(), E = K().E;
    const r1 = take(e, K().tex.ring(), 0xfff0b8, true, 4), r2 = take(e, K().tex.ring(), 0xffb830, true, 4), gl = take(e, K().tex.glow(), 0xfff0c0, true, 7);
    const co = [];
    for (let i = 0; i < 7; i++) { const m = take(e, coinTex(), 0xffffff, false, 6); if (!m) break; const a = (i / 7) * TAU + rnd(-0.4, 0.4), sp = rnd(0.5, 1.3); co.push({ m, x: cp.x + Math.cos(a) * 0.15, y: cp.y + rnd(-0.1, 0.25), z: cp.z + Math.sin(a) * 0.15, vx: Math.cos(a) * sp, vy: rnd(2.6, 4), vz: Math.sin(a) * sp, fa: Math.random() * TAU, w: rnd(9, 15), s: rnd(0.2, 0.27), d: i * 0.035, b: 0, st: 0 }); }
    flash(cp, th);
    for (let i = 0; i < 50; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 1.1; _a.set(cp.x + Math.cos(a) * r, cp.y + rnd(0.4, 1.9), cp.z + Math.sin(a) * r); E(P, _a, rnd(-0.3, 0.3), rnd(-0.4, 0.9), rnd(-0.3, 0.3), i % 4 === 0 ? 0xffffff : i % 2 ? 0xffd65a : 0xffb22a, rnd(0.045, 0.08) * k, rnd(0.8, 1.35), { sq: Math.random() < 0.5, g: -3.2, drag: 1.1, so: 0.75 }); }
    for (let i = 0; i < 18; i++) { _v.set(rnd(-1, 1), rnd(0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2.5, 5)); E(P, cp, _v.x, _v.y, _v.z, 0xfff0b0, rnd(0.04, 0.07) * k, rnd(0.25, 0.45), { drag: 4, so: 0.3 }); }
    go(e, (e, T, dt) => {
      if (r1) { flat(r1, gp, 0.06); r1.scale.setScalar(2 * (0.2 + 1.5 * easeOut(T / 0.35, 2.4))); r1.material.opacity = 1 - Math.min(1, T / 0.45); }
      if (r2) { flat(r2, gp, 0.07); const v = T - 0.1; r2.scale.setScalar(2 * (0.3 + 2 * easeOut(v / 0.55, 2.4))); r2.material.opacity = v < 0 ? 0 : 1 - Math.min(1, v / 0.65); }
      if (gl) { bill(gl, cp); gl.scale.setScalar(2.8 * (0.4 + 0.6 * easeOut(T / 0.08))); gl.material.opacity = fade(T, 0.03, 0.06, 0.3); }
      for (const c of co) {
        const tt = T - c.d, M = c.m.material; if (tt < 0) { M.opacity = 0; continue; }
        if (dt && !c.st) {
          c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.fa += c.w * dt;
          const fl = gp.y + c.s * 0.5; if (c.y < fl && c.vy < 0) { c.y = fl; if (c.b++ < 1) { c.vy = -c.vy * 0.38; c.vx *= 0.5; c.vz *= 0.5; } else c.st = 1; }
        }
        bill(c.m, _a.set(c.x, c.y, c.z), Math.sin(c.fa * 0.3) * 0.3); c.m.scale.set(c.s * Math.max(0.14, Math.abs(Math.cos(c.fa))), c.s, 1); M.opacity = fade(tt, 0.05, 1.05, 0.35);
      }
    });
  };
  // 슈퍼레어(약한 효과): 스킨 색 작은 바닥 고리 + 빛 + 조각 몇 개 — 휘장·조명 없음
  function lite(t, col, gp, cp, k) {
    const e = fx(0.6), P = K().pool(), E = K().E;
    const rg = take(e, K().tex.ring(), col, true, 4), gl = take(e, K().tex.glow(), col, true, 7);
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU; E(P, cp, Math.cos(a) * rnd(0.4, 1.3), rnd(0.8, 2.6), Math.sin(a) * rnd(0.4, 1.3), i % 3 ? col : 0xffffff, rnd(0.04, 0.07) * k, rnd(0.35, 0.6), { g: -4, drag: 1.5, so: 0.7 }); }
    go(e, (e, T) => {
      if (rg) { flat(rg, gp, 0.05); rg.scale.setScalar(2 * 1.4 * (0.1 + 0.9 * easeOut(T / 0.5, 2.4))); rg.material.opacity = 1 - T / 0.6; }
      if (gl) { bill(gl, cp); gl.scale.setScalar(1.4 * (0.4 + 0.6 * easeOut(T / 0.1))); gl.material.opacity = 0.85 * fade(T, 0.03, 0.05, 0.22); }
    });
  }
  // t: 쓰러진 캐릭터 · by: 처치한 캐릭터 · cause: 무기 id — 그 근접 무기에 낀 스킨이 울트라레어면 큰 효과(+ 내가 처치했으면 휘장), 슈퍼레어면 약한 효과
  //  06_combat.js killChar · 10_net.js netDeath(다른 기기의 처치) · 10_training.js 더미 — 총 스킨 효과(SkinFx.kill) 바로 옆에서 부른다
  function kill(t, by, cause) {
    if (!SC || !t || !by || by === t || typeof SkinFx === 'undefined' || !SkinFx.kit) return;
    const id = ofKill(by, cause), S = id && Body.SKINS[id], tier = S ? tierOf(S) : 0; if (!tier) return;
    const th = tier === 2 ? THEME[S.shape] : null, L = LITE[S.shape];
    // 조준점 휘장은 울트라레어만, 내가 처치했을 때
    if (th && by.isPlayer && typeof HUD !== 'undefined' && HUD.skinKill) HUD.skinKill(th, S.name, null, true);
    if (!G.camera) return;
    const cp = new THREE.Vector3(); t.chest(cp);
    if (cp.distanceTo(G.camera.position) > (th ? 220 : 120)) return;
    const gp = K().ground(t.pos.x, t.pos.y, t.pos.z), k = farK(cp, 25, 2.5);
    if (t.inWater) gp.y = t.pos.y + 0.3;
    if (th) FXS[S.shape](t, th, gp, cp, k); else lite(t, L ? L[0] : rarOf(S.rar).hex, gp, cp, k);
    if (typeof Audio !== 'undefined' && Audio.skinFx) Audio.skinFx('kill', th ? th.snd : L ? L[1] : 'frontier', by.isPlayer ? null : cp, !!by.isPlayer, !th);
  }
  return { init, update, dispose, kill, ofKill, info, tier, perk, THEME, LITE, _live: LIVE, _free: FREE };
})();
