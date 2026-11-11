// ============================================================
// 05_models_gskin.js — 총기 스킨 (v17)
//  · 목록 GSKINS: 총 · 상자(총기 상자 g1 아스널 · g2 네온 / 옷 상자 br·sp·sup에 2개씩) · 레어도
//    등급이 높을수록 화려하게: 희귀 = 단색 도장 → 초희귀 = 무늬(위장·체크·홀로) → 슈퍼레어 = 금속 광택·빛나는 선 + 약한 효과(lite)
//    → 울트라레어(빨강) = 움직이는 빛 + 사격·꺼내기·넣기·맞힘·처치 효과 + 꺼내면 돋아나는 부속품(05_models_gparts.js, v20)
//  · 슈퍼레어 lite: 스킨 색 작은 섬광·조각 몇 개(사격·맞힘), 작은 고리(처치). 몸체 빛·탄도 색·휘장·꺼내기 효과는 울트라레어만
//  · 재질: 합친 지오메트리의 정점마다 재질 종류(kd: 플라스틱·나무·무광 금속·광택 금속…)를 남겨 두고(05_models.js)
//    셰이더가 종류별로 스킨 색·무늬·금속감을 고른다. 무늬는 물체 공간 3방향 투영(삼평면) → 부품 UV와 무관하게 크기가 같다
//  · 총 인스턴스마다 재질을 따로 만든다(프로그램은 공유) → 내 총만 번쩍이고, 1인칭·3인칭 총이 따로 사라지고 나타난다
//  · 효과(울트라레어): 사격 = 색 총구 화염 + 불씨/스파크/불꽃/파편 + 탄도 색 + 몸체 빛 번쩍
//    꺼내기 = 개머리판→총구로 빛 띠가 지나가며 총이 나타남, 넣기 = 총구→개머리판으로 빛 띠가 지나가며 사라짐(손에서 떨어진 자리에서)
//  · 실제 회사 이름·로고·다른 게임의 스킨 디자인은 쓰지 않는다
// ============================================================
const GSKINS = (() => {
  const S = {
    // ---------- 아스널 상자 (g1): 전술 테마 ----------
    g1_akm_sand: { gun: 'akm', box: 'g1', rar: 1, name: '사막 모래', body: { c: 0x9c8664, mr: [0.3, 0.6] }, furn: { c: 0xc2a77c, mr: [0, 0.72] } },
    g1_vector_od: { gun: 'vector', box: 'g1', rar: 1, name: '올리브 드랩', body: { c: 0x535b3a, mr: [0.1, 0.68] } },
    g1_s12k_tundra: { gun: 's12k', box: 'g1', rar: 1, name: '툰드라', body: { c: 0xb4babd, mr: [0.2, 0.58] } },
    g1_mini14_ebony: { gun: 'mini14', box: 'g1', rar: 1, name: '블랙 우드', body: { c: 0x1d1e21, mr: [0.4, 0.45] }, furn: { c: 0x2b1d16, mr: [0, 0.45] } },
    g1_m416_digi: { gun: 'm416', box: 'g1', rar: 3, name: '디지털 사막', pat: 'digital', pal: ['#b39e78', '#8f7a55', '#d1bf98', '#6a5a40'], sc: 4.5, body: { p: 1, mr: [0.12, 0.72] } },
    g1_kar98k_tiger: { gun: 'kar98k', box: 'g1', rar: 3, name: '타이거 스트라이프', pat: 'tiger', pal: ['#7d7a52', '#232319', '#4e4c2c', '#9a9468'], sc: 3.6, furn: { p: 1, mr: [0, 0.65] } },
    g1_dp28_snow: { gun: 'dp28', box: 'g1', rar: 3, name: '설원', pat: 'camo', pal: ['#e4e8eb', '#b9bfc4', '#8b9298', '#f7f9fa'], sc: 3.5, body: { p: 1, mr: [0.1, 0.62] }, furn: { p: 1, mr: [0, 0.66] } },
    g1_akm_gold: { gun: 'akm', box: 'g1', rar: 4, name: '황금 각인', pat: 'engrave', pal: ['#c8962f', '#f3d77e', '#7a5414', '#4a3008'], sc: 4, env: 1.0, body: { p: 1, mr: [1, 0.26] }, furn: { c: 0x17110e, mr: [0.15, 0.32] }, steel: { c: 0xe2bd58, mr: [1, 0.22] },
      lite: { kind: 'spark', c: 0xffc94a, c2: 0xfff1b8, lite: 1 } },
    g1_m24_carbon: { gun: 'm24', box: 'g1', rar: 4, name: '카본 블랙', pat: 'carbon', pal: ['#0c0d10', '#4c525c', '#1a1c21'], sc: 7, env: 0.9, body: { p: 1, mr: [0.35, 0.3] }, furn: { p: 1, mr: [0.35, 0.3] }, steel: { c: 0xd8b04a, mr: [1, 0.24] },
      glow: { pat: 'lines', c: 0xffa63a, k: 1.4, anim: 0 }, lite: { kind: 'ember', c: 0xffa63a, c2: 0xffdc96, lite: 1 } },
    g1_m416_magma: { gun: 'm416', box: 'g1', rar: 5, name: '마그마 코어', pat: 'lava', pal: ['#17110f', '#3a2620', '#ff6a1e'], sc: 3.2, env: 0.5, body: { p: 1, mr: [0.25, 0.62] }, steel: { c: 0x2a2220, mr: [0.8, 0.45] },
      glow: { pat: 'lava', c: 0xff5414, k: 2.8, anim: 2 }, fx: { kind: 'ember', c: 0xff5a1e, c2: 0xffc04a, tr: 0xff6a2a },
      parts: 'magma', en: 0xff6a1e, enK: 2.6, enAnim: 2, desc: '갈라진 틈으로 용암이 흐르는 몸체 · 꺼내면 용암 바위 장갑이 돋음 · 쏠 때 불씨' },
    g1_beryl_dragon: { gun: 'beryl', box: 'g1', rar: 5, name: '홍룡', pat: 'scales', pal: ['#4a080d', '#a51c25', '#d9b04c', '#1c0306'], sc: 3.4, env: 0.85, body: { p: 1, mr: [0.65, 0.32] }, furn: { p: 1, mr: [0.65, 0.32] }, steel: { c: 0xe6c25a, mr: [1, 0.22] },
      glow: { pat: 'scales', c: 0xff3a1a, k: 1.25, anim: 1 }, fx: { kind: 'flame', c: 0xff3a1a, c2: 0xffc24a, tr: 0xff4a22 },
      parts: 'dragon', en: 0xff3a1a, enK: 2.4, enAnim: 1, desc: '금테 붉은 비늘이 숨 쉬듯 빛남 · 꺼내면 금빛 뿔·날개가 펼쳐짐 · 쏠 때 불꽃' },
    g1_awm_frost: { gun: 'awm', box: 'g1', rar: 5, name: '서리 결정', pat: 'digital', pal: ['#9fc3dc', '#6f95b4', '#c9e1f0', '#4d6f8c'], sc: 4.2, env: 1.0, body: { p: 1, mr: [0.55, 0.3] }, furn: { p: 1, mr: [0.35, 0.34] }, steel: { c: 0xbfe6ff, mr: [1, 0.16] },
      glow: { pat: 'veins', c: 0x6fdcff, k: 1.7, anim: 1 }, fx: { kind: 'frost', c: 0x7fe4ff, c2: 0xeafcff, tr: 0x9be9ff },
      parts: 'frost', en: 0x7fe4ff, enK: 2.6, enAnim: 1, desc: '얼음 금이 간 서릿빛 몸체 · 꺼내면 얼음 결정이 돋음 · 쏠 때 얼음 파편' },
    // ---------- 네온 상자 (g2): 사이버·스트리트 테마 ----------
    g2_vk9_mint: { gun: 'vk9', box: 'g2', rar: 1, name: '민트 팝', body: { c: 0x74d6b9, mr: [0.08, 0.5] } },
    g2_deagle_pink: { gun: 'deagle', box: 'g2', rar: 1, name: '핑크 크롬', env: 1.0, body: { c: 0x232227, mr: [0.3, 0.5] }, steel: { c: 0xff9ccc, mr: [0.55, 0.28] } },
    g2_bizon_sunset: { gun: 'bizon', box: 'g2', rar: 1, name: '선셋 오렌지', body: { c: 0xe2702c, mr: [0.12, 0.5] } },
    g2_m16a4_ice: { gun: 'm16a4', box: 'g2', rar: 1, name: '아이스 블루', body: { c: 0x8cc6ec, mr: [0.18, 0.45] } },
    g2_vector_graffiti: { gun: 'vector', box: 'g2', rar: 3, name: '그래피티', pat: 'graffiti', pal: ['#ecebe4', '#ff3d8b', '#2ad4ff', '#ffd23f', '#16181c'], sc: 3, body: { p: 1, mr: [0.05, 0.55] } },
    g2_aug_holo: { gun: 'aug', box: 'g2', rar: 3, name: '홀로그램', pat: 'holo', sc: 2.4, env: 1.1, body: { p: 1, mr: [0.85, 0.2] } },
    g2_s686_checker: { gun: 's686', box: 'g2', rar: 3, name: '레이싱 체커', pat: 'checker', pal: ['#f2f2ee', '#141416'], sc: 7, body: { c: 0xc61e26, mr: [0.4, 0.38] }, furn: { p: 1, mr: [0.05, 0.42] } },
    g2_m416_circuit: { gun: 'm416', box: 'g2', rar: 4, name: '사이버 회로', env: 0.8, body: { c: 0x15181d, mr: [0.45, 0.38] }, glow: { pat: 'circuit', c: 0x2ae8ff, k: 1.6, anim: 0 }, sc: 2.6, lite: { kind: 'glitch', c: 0x2ae8ff, c2: 0xb8fbff, lite: 1 } },
    g2_kar98k_wave: { gun: 'kar98k', box: 'g2', rar: 4, name: '네온 웨이브', env: 0.7, body: { c: 0x101015, mr: [0.4, 0.4] }, furn: { c: 0x1c1424, mr: [0.1, 0.38] }, glow: { pat: 'wave', c: 0xff3df0, k: 1.7, anim: 0 }, sc: 3, lite: { kind: 'spark', c: 0xff3df0, c2: 0xffc2f8, lite: 1 } },
    g2_akm_plasma: { gun: 'akm', box: 'g2', rar: 5, name: '플라즈마', pat: 'camo', pal: ['#140709', '#2a0b12', '#0c0507', '#3a0d18'], sc: 3, env: 0.7, body: { p: 1, mr: [0.55, 0.35] }, furn: { p: 1, mr: [0.3, 0.38] }, steel: { c: 0x2a1418, mr: [0.9, 0.3] },
      glow: { pat: 'veins', c: 0xff2448, k: 2.6, anim: 2 }, fx: { kind: 'spark', c: 0xff2a5a, c2: 0xffc8d8, tr: 0xff3a66 },
      parts: 'plasma', en: 0xff2a5a, enK: 2.8, enAnim: 2, desc: '검붉은 몸체에 번개 같은 혈관이 흐름 · 꺼내면 총열에 코일이 감김 · 쏠 때 전기 스파크' },
    g2_vector_glitch: { gun: 'vector', box: 'g2', rar: 5, name: '크림슨 글리치', pat: 'glitch', pal: ['#1a0a0d', '#3d0d14', '#0d0d10', '#6e1420', '#262629'], sc: 3.4, env: 0.6, body: { p: 1, mr: [0.3, 0.42] }, steel: { c: 0x1d1d22, mr: [0.8, 0.35] },
      glow: { pat: 'glitch', c: 0xff2436, k: 2.4, anim: 3 }, fx: { kind: 'glitch', c: 0xff2436, c2: 0x3ff0ff, tr: 0xff3046 },
      parts: 'glitch', en: 0xff2436, enK: 2.4, enAnim: 3, desc: '화면이 깨지듯 깜빡이는 붉은 블록 · 꺼내면 몸체 둘레에 블록이 떠오름 · 쏠 때 디지털 파편' },
    g2_s12k_void: { gun: 's12k', box: 'g2', rar: 5, name: '공허', pat: 'camo', pal: ['#0d0714', '#1b0e29', '#08050d', '#2b1442'], sc: 3.2, env: 0.7, body: { p: 1, mr: [0.45, 0.32] }, furn: { p: 1, mr: [0.3, 0.4] }, steel: { c: 0x1a1024, mr: [0.9, 0.26] },
      glow: { pat: 'wave', c: 0xa64bff, k: 2.2, anim: 2 }, fx: { kind: 'void', c: 0xa64bff, c2: 0xe6c8ff, tr: 0xb45cff },
      parts: 'void', en: 0xb04aff, enK: 2.8, enAnim: 2, desc: '보랏빛 물결이 일렁이는 칠흑 몸체 · 꺼내면 총열 둘레에 고리가 돎 · 쏠 때 빨려 드는 빛' },
    // ---------- 테스터 (v20): 베타 테스터 한정 컬렉션 — 상자·교환소·봇에 없음. 개발자가 '베타 테스터' 칭호를 준 계정만 가짐 ----------
    //  공통: 육각 BETA 엠블럼 + 고유 번호(No.001~003, 05_models_gdeco.js) · 공중에서 회전하며 손에 붙는 전용 꺼내기 · 살펴보기(N / 무기 칸 누르기) 연출
    //  pal: 효과 입자 색 · glowMask: 빛 지도를 쓰는 부위(몸체·손잡이·강철) · flashK: 쏠 때 몸체 번쩍임 세기
    // ZERO PROTOCOL — 미래형 실험 병기: 티타늄 흰 장갑판 + 검은 기계 패널, 판 사이 틈·총열을 따라 시안 회로가 천천히 차례로 점등
    //  탄창 옆 에너지 표시등과 BETA-001 · 조준 장치 둘레 홀로그램 · 비스듬히 볼 때만 보이는 FIRST TESTER · 재장전 때 시안 스캔 · 살펴보면 SYSTEM ONLINE
    t_m416_beta: { gun: 'm416', box: 'beta', rar: 6, tester: 1, no: '001', name: 'ZERO PROTOCOL', pat: 'armor', pal: ['#14181c', '#e8ecef', '#c3cbd2', '#0a0c0e'], sc: 2.6, env: 1.1,
      body: { p: 1, mr: [0.55, 0.32] }, furn: { p: 1, mr: [0.5, 0.35] }, steel: { c: 0x14171a, mr: [0.85, 0.3] },
      glow: { pat: 'armor', c: 0x3ff5ff, k: 2.4, anim: 5 }, glowMask: [1, 1, 1], fx: { kind: 'zero', c: 0x3ff5ff, c2: 0xe9feff, tr: 0x8ffcff, pal: [0x3ff5ff, 0x8ffcff, 0xe9feff, 0x1fb8d8] },
      parts: 'zero', en: 0x3ff5ff, enK: 2.6, enAnim: 5,
      deco: [{ kind: 'emblem', no: '001', side: 'LR', z: 0.4, dy: -0.006, w: 0.04 }, { kind: 'text', on: 'mag', side: 'LR', text: 'BETA-001', style: 'neon', col: '#3ff5ff', w: 0.045, dy: -0.012 }, { kind: 'pips', on: 'mag', side: 'LR', col: '#3ff5ff', w: 0.028, h: 0.007, dy: 0.012 },
        { kind: 'text', side: 'LR', z: 0.73, dy: -0.004, text: 'ZERO PROTOCOL', style: 'neon', col: '#3ff5ff', w: 0.07 }, { kind: 'hidden', side: 'L', z: 0.15, dy: -0.036, text: 'FIRST TESTER', col: 0xbff8ff, w: 0.09 }, { kind: 'holo', col: '#5ff8ff', w: 0.05 }],
      desc: '티타늄 흰 장갑판과 검은 기계 패널 · 시안 회로가 천천히 차례로 점등 · 재장전 때 시안 스캔 · 살펴보면 SYSTEM ONLINE · EXCLUSIVE — NEVER AVAILABLE AGAIN' },
    // CHAOS CORE — 통제되지 않은 실험 에너지: 다크 건메탈에 갈라진 틈으로 주황 빛 · 검은 총열에 붉은 열전도 무늬 · 붉은 금속으로 바뀐 개머리판·손잡이
    //  몸통 옆 불안정한 코어와 UNSTABLE CORE 경고 · 탄창의 경고 표시와 실험 번호 · 붉은빛이 불규칙하게 점멸 · 탄창 갈 때 코어 둘레 붉은 입자 · 쏠 때 작은 붉은 잔광
    t_akm_beta: { gun: 'akm', box: 'beta', rar: 6, tester: 1, no: '002', name: 'CHAOS CORE', pat: 'fracture', pal: ['#17181a', '#2a2c30', '#ff5a12', '#0d0d0e'], sc: 3.0, env: 0.9,
      body: { p: 1, mr: [0.75, 0.38] }, furn: { c: 0x6a0d09, mr: [0.85, 0.3] }, steel: { p: 1, mr: [0.85, 0.34] },
      glow: { pat: 'fracture', c: 0xff5a14, k: 2.2, anim: 6 }, glowMask: [1, 0, 1], flashK: 0.45, fx: { kind: 'chaos', c: 0xff4a12, c2: 0xffb04a, tr: 0xff6a2a, pal: [0xff3a0e, 0xff6a1e, 0xffb04a, 0xd81e10] },
      parts: 'chaos', en: 0xff5014, enK: 3.0, enAnim: 6,
      deco: [{ kind: 'emblem', no: '002', side: 'LR', z: 0.5, dy: -0.004, w: 0.04 }, { kind: 'text', side: 'LR', z: 0.43, dy: -0.022, text: 'UNSTABLE CORE', style: 'warn', col: '#ff8a2a', w: 0.06 },
        { kind: 'text', on: 'mag', side: 'LR', text: '⚠ EXP-002', style: 'warn', col: '#ffb21e', w: 0.042, dy: 0.004 }],
      desc: '갈라진 건메탈 틈으로 주황 빛 · 붉은빛이 불규칙하게 점멸 · 탄창 갈 때 코어에서 붉은 입자 · 살펴보면 코어가 강하게 빛남 · EXCLUSIVE — NEVER AVAILABLE AGAIN' },
    // LAST FRONTIER — 전설적인 초기 테스트 모델: 아이보리·은 총몸 · 짙은 남색 개머리판의 금빛 기하 문양과 별자리 · 총열을 따라 길게 이어진 금 상감 · 조준경 금테
    //  THE FIRST GENERATION 각인 · BETA-003 일련번호 · 개발 초기 테스트 기록 각인 · 별자리가 은은하게 반짝 · 살펴보면 별빛이 총몸을 따라 지나감 · 재장전 끝나면 금빛이 한 번
    t_kar98k_beta: { gun: 'kar98k', box: 'beta', rar: 6, tester: 1, no: '003', name: 'LAST FRONTIER', pat: 'frontier', pal: ['#0d1838', '#16275a', '#e2c27a', '#f6e6b8'], sc: 2.2, env: 1.15,
      body: { c: 0xe9e1cc, mr: [0.55, 0.26] }, furn: { p: 1, mr: [0.35, 0.3] }, steel: { c: 0xc8ced6, mr: [1, 0.16] },
      glow: { pat: 'frontier', c: 0xfff0c0, k: 2.0, anim: 7 }, glowMask: [0, 1, 0], flashK: 0.6, fx: { kind: 'frontier', c: 0xf2d590, c2: 0xffffff, tr: 0xffe9b0, pal: [0xf2d590, 0xffe9b0, 0xffffff, 0xc9a24a] },
      parts: 'frontier', en: 0xe9c87a, enK: 1.1, enAnim: 7,
      deco: [{ kind: 'emblem', no: '003', side: 'LR', z: 0.5, dy: 0.0, w: 0.036 }, { kind: 'text', side: 'LR', z: 0.63, dy: -0.03, text: 'THE FIRST GENERATION', style: 'engrave', col: '#e2c27a', w: 0.12 },
        { kind: 'text', side: 'LR', z: 0.43, dy: -0.032, text: 'BETA-003', style: 'engrave', col: '#e2c27a', w: 0.05 }, { kind: 'text', side: 'L', z: 0.13, dy: -0.03, text: 'TEST LOG v0.0.1 · 2026', style: 'engrave', col: '#cfae64', w: 0.06 },
        { kind: 'rim', col: 0xe9cf8a }],
      desc: '아이보리·은 총몸 · 남색 개머리판의 금빛 문양과 별자리 · 살펴보면 별빛이 총몸을 따라 지나감 · 재장전 끝나면 금빛 · EXCLUSIVE — NEVER AVAILABLE AGAIN' },
    // ---------- 옷 상자에 2개씩 ----------
    br_s686_hunter: { gun: 's686', box: 'br', rar: 1, name: '사냥꾼', body: { c: 0x3b3e33, mr: [0.45, 0.45] }, furn: { c: 0x7a4626, mr: [0, 0.5] } },
    br_mini14_wood: { gun: 'mini14', box: 'br', rar: 3, name: '산림 위장', pat: 'camo', pal: ['#4e5636', '#3b4129', '#6a6a44', '#2b2b22'], sc: 3.5, body: { p: 1, mr: [0.1, 0.7] }, furn: { p: 1, mr: [0, 0.72] } },
    sp_p19_bubble: { gun: 'p19', box: 'sp', rar: 1, name: '버블검', body: { c: 0xff8cc8, mr: [0.05, 0.45] } },
    sp_tommy_plaid: { gun: 'tommy', box: 'sp', rar: 3, name: '버펄로 체크', pat: 'plaid', pal: ['#a3262c', '#1a0c0c', '#d84a44'], sc: 6, furn: { p: 1, mr: [0, 0.7] } },
    sup_win94_nickel: { gun: 'win94', box: 'sup', rar: 1, name: '니켈 실버', env: 1.0, body: { c: 0xc5c9ce, mr: [1, 0.3] } },
    sup_slr_digi: { gun: 'slr', box: 'sup', rar: 3, name: '디지털 정글', pat: 'digital', pal: ['#6b6e4b', '#4a4d33', '#8b8661', '#2e3023'], sc: 4.5, body: { p: 1, mr: [0.12, 0.7] }, furn: { p: 1, mr: [0, 0.7] } },
  };
  return S;
})();

const GunSkin = (() => {
  // ---------- 무늬 텍스처 (캔버스, 이어 붙여도 이음매 없음) ----------
  const TEX = {};
  const cv = (S) => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const W9 = (S, fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function vnoise(rng, G) {
    const v = []; for (let i = 0; i < G * G; i++) v.push(rng());
    return (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, X0 = ((x0 % G) + G) % G, Y0 = ((y0 % G) + G) % G, X1 = (X0 + 1) % G, Y1 = (Y0 + 1) % G;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(v[Y0 * G + X0], v[Y0 * G + X1], sx), lerp(v[Y1 * G + X0], v[Y1 * G + X1], sx), sy);
    };
  }
  function blob(c, S, x, y, r, rng) {
    const pts = []; for (let a = 0; a < 11; a++) { const t = a / 11 * TAU, rr = r * (0.55 + rng() * 0.7); pts.push([Math.cos(t) * rr * 1.5, Math.sin(t) * rr]); }
    W9(S, (dx, dy) => { c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(x + dx + px, y + dy + py) : c.moveTo(x + dx + px, y + dy + py))); c.closePath(); c.fill(); });
  }
  const PAT = {
    camo(c, S, pal, rng) {
      c.fillStyle = pal[0]; c.fillRect(0, 0, S, S);
      for (let L = 1; L < pal.length; L++) { c.fillStyle = pal[L]; for (let i = 0; i < 22; i++) blob(c, S, rng() * S, rng() * S, S * (0.035 + rng() * 0.065), rng); }
    },
    digital(c, S, pal, rng) {
      const n1 = vnoise(rng, 6), n2 = vnoise(rng, 14), N = 64, cs = S / N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u = i / N, v = j / N, val = n1(u * 6, v * 6) * 0.62 + n2(u * 14, v * 14) * 0.38 + (rng() - 0.5) * 0.09;
        c.fillStyle = pal[val < 0.4 ? 0 : val < 0.52 ? 1 : val < 0.63 ? 2 : 3]; c.fillRect(i * cs, j * cs, cs + 0.6, cs + 0.6);
      }
    },
    tiger(c, S, pal, rng) {
      c.fillStyle = pal[0]; c.fillRect(0, 0, S, S);
      for (let i = 0; i < 28; i++) {
        const y = rng() * S, th = S * (0.012 + rng() * 0.026), f1 = 1 + Math.floor(rng() * 3), f2 = 3 + Math.floor(rng() * 4), p1 = rng() * TAU, p2 = rng() * TAU, x0 = rng() * S, len = S * (0.3 + rng() * 0.5);
        c.fillStyle = pal[rng() < 0.7 ? 1 : 2];
        const top = [], bot = [];
        for (let k = 0; k <= 24; k++) { const t = k / 24, x = x0 + t * len, b = y + Math.sin(t * TAU * f1 + p1) * th * 0.8, w = th * Math.sin(t * Math.PI); top.push([x, b - w * (0.8 + 0.4 * Math.sin(t * f2 * 5 + p2))]); bot.push([x, b + w * (0.5 + 0.5 * Math.sin(t * 13 + p1))]); }
        W9(S, (dx, dy) => { c.beginPath(); top.forEach(([x, yy], k) => (k ? c.lineTo(x + dx, yy + dy) : c.moveTo(x + dx, yy + dy))); for (let k = bot.length - 1; k >= 0; k--) c.lineTo(bot[k][0] + dx, bot[k][1] + dy); c.closePath(); c.fill(); });
      }
    },
    carbon(c, S, pal) {
      const n = 16, cs = S / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const hor = ((i + j) % 4) < 2, g = hor ? c.createLinearGradient(0, j * cs, 0, j * cs + cs) : c.createLinearGradient(i * cs, 0, i * cs + cs, 0);
        g.addColorStop(0, pal[0]); g.addColorStop(0.45, pal[1]); g.addColorStop(1, pal[2]);
        c.fillStyle = g; c.fillRect(i * cs, j * cs, cs, cs);
      }
    },
    engrave(c, S, pal, rng) {
      const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[0]); c.fillStyle = g; c.fillRect(0, 0, S, S);
      c.globalAlpha = 0.16; for (let y = 0; y < S; y += 2) { c.fillStyle = rng() < 0.5 ? pal[1] : pal[2]; c.fillRect(0, y, S, 1); } c.globalAlpha = 1;
      const lw = S / 256;
      for (let i = 0; i < 10; i++) {
        const x = rng() * S, y = rng() * S, r = S * (0.045 + rng() * 0.05), turns = 1.5 + rng() * 0.9, dir = rng() < 0.5 ? 1 : -1, a0 = rng() * TAU;
        const pts = []; for (let k = 0; k <= 70; k++) { const t = k / 70, a = a0 + dir * t * turns * TAU, rr = r * (1 - t * 0.82); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
        // 잎사귀 꼬리
        const tail = []; for (let k = 0; k <= 20; k++) { const t = k / 20, a = a0 - dir * t * 1.4; tail.push([Math.cos(a) * r * (1 + t * 1.2), Math.sin(a) * r * (1 + t * 1.2) + t * r * 0.4]); }
        W9(S, (dx, dy) => {
          for (const [col, off, w] of [[pal[3], 1.2, 2.6], [pal[2], 0, 1.6], [pal[1], -0.8, 0.7]]) {
            c.strokeStyle = col; c.lineWidth = w * lw; c.lineCap = 'round';
            for (const P of [pts, tail]) { c.beginPath(); P.forEach(([px, py], k) => (k ? c.lineTo(x + dx + px + off, y + dy + py + off) : c.moveTo(x + dx + px + off, y + dy + py + off))); c.stroke(); }
          }
        });
      }
    },
    graffiti(c, S, pal, rng) {
      c.fillStyle = pal[0]; c.fillRect(0, 0, S, S);
      const cols = pal.slice(1);
      for (let i = 0; i < 16; i++) {
        const col = cols[Math.floor(rng() * cols.length)], x = rng() * S, y = rng() * S, r = S * (0.025 + rng() * 0.06), drips = [];
        for (let d = 0; d < 3; d++) drips.push([(rng() - 0.5) * r * 1.4, r * (1 + rng() * 2.4), S * (0.006 + rng() * 0.008)]);
        const dots = []; for (let d = 0; d < 7; d++) { const a = rng() * TAU, rr = r * (1.2 + rng() * 0.9); dots.push([Math.cos(a) * rr, Math.sin(a) * rr, S * (0.003 + rng() * 0.006)]); }
        W9(S, (dx, dy) => {
          c.fillStyle = col; c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill();
          for (const [ox, len, w] of drips) { c.fillRect(x + dx + ox - w / 2, y + dy, w, len); c.beginPath(); c.arc(x + dx + ox, y + dy + len, w * 0.8, 0, TAU); c.fill(); }
          for (const [ox, oy, rr] of dots) { c.beginPath(); c.arc(x + dx + ox, y + dy + oy, rr, 0, TAU); c.fill(); }
        });
      }
      // 굵은 붓질 (검은 테 + 색)
      for (let i = 0; i < 7; i++) {
        const col = cols[Math.floor(rng() * (cols.length - 1))], P = [[rng() * S, rng() * S]]; for (let k = 0; k < 3; k++) P.push([P[0][0] + (rng() - 0.3) * S * 0.35, P[0][1] + (rng() - 0.5) * S * 0.25]);
        W9(S, (dx, dy) => {
          for (const [cc, w] of [[pal[pal.length - 1], 0.034], [col, 0.022]]) { c.strokeStyle = cc; c.lineWidth = S * w; c.lineCap = 'round'; c.beginPath(); c.moveTo(P[0][0] + dx, P[0][1] + dy); c.bezierCurveTo(P[1][0] + dx, P[1][1] + dy, P[2][0] + dx, P[2][1] + dy, P[3][0] + dx, P[3][1] + dy); c.stroke(); }
        });
      }
    },
    holo(c, S, pal, rng) {
      c.lineWidth = 2;
      for (let x = -S; x < S; x += 1) { c.strokeStyle = `hsl(${((x / S) * 720 % 360 + 360) % 360},88%,62%)`; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + S, S); c.stroke(); }
      for (let i = 0; i < 160; i++) { const x = rng() * S, y = rng() * S, r = S * (0.002 + rng() * 0.004); c.fillStyle = `rgba(255,255,255,${0.35 + rng() * 0.5})`; W9(S, (dx, dy) => { c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill(); }); }
    },
    checker(c, S, pal) { const n = 8, cs = S / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { c.fillStyle = pal[(i + j) % 2]; c.fillRect(i * cs, j * cs, cs, cs); } },
    plaid(c, S, pal) {
      c.fillStyle = pal[0]; c.fillRect(0, 0, S, S);
      c.fillStyle = 'rgba(14,6,6,0.55)'; for (const k of [0, S / 2]) { c.fillRect(0, k, S, S / 4); c.fillRect(k, 0, S / 4, S); }
      c.fillStyle = pal[2]; for (const k of [S * 0.375, S * 0.875]) { c.globalAlpha = 0.5; c.fillRect(0, k, S, S / 64); c.fillRect(k, 0, S / 64, S); c.globalAlpha = 1; }
    },
  };
  // 무늬 + 빛 지도를 같이 만드는 것들 (빛 지도는 흰 = 빛남)
  const PAT2 = {
    lava(S, pal, rng) {
      const N = 24, P = []; for (let i = 0; i < N; i++) P.push([rng() * S, rng() * S]);
      const a = cv(S), g = cv(S), ac = a.getContext('2d'), gc = g.getContext('2d'), A = ac.createImageData(S, S), Gd = gc.createImageData(S, S), n1 = vnoise(rng, 8);
      const c0 = rgb(pal[0]), c1 = rgb(pal[1]), c2 = rgb(pal[2]), H = S / 2;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of P) { let dx = Math.abs(x - px), dy = Math.abs(y - py); if (dx > H) dx = S - dx; if (dy > H) dy = S - dy; const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        const e = Math.sqrt(d2) - Math.sqrt(d1), crack = clamp(1 - e / (S * 0.016), 0, 1), heat = clamp(1 - e / (S * 0.07), 0, 1), nz = n1(x / S * 8, y / S * 8);
        const i4 = (y * S + x) * 4, k = nz * 0.7 + 0.15, hot = Math.max(crack, heat * 0.25);
        for (let ch = 0; ch < 3; ch++) A.data[i4 + ch] = lerp(lerp(c0[ch], c1[ch], k), c2[ch], hot);
        A.data[i4 + 3] = 255;
        const gv = clamp(Math.pow(crack, 1.3) + heat * heat * 0.3, 0, 1) * 255; Gd.data[i4] = Gd.data[i4 + 1] = Gd.data[i4 + 2] = gv; Gd.data[i4 + 3] = 255;
      }
      ac.putImageData(A, 0, 0); gc.putImageData(Gd, 0, 0);
      return { alb: a, glow: g };
    },
    scales(S, pal) {
      const a = cv(S), g = cv(S), c = a.getContext('2d'), gc = g.getContext('2d'), n = 8, s = S / n, lw = S / 256;
      c.fillStyle = pal[3]; c.fillRect(0, 0, S, S); gc.fillStyle = '#000'; gc.fillRect(0, 0, S, S);
      // 아래 줄부터 그려서 위 줄 비늘의 둥근 끝이 아래 줄 비늘 윗부분을 덮게 (물고기 비늘)
      for (let row = n * 2 + 1; row >= -2; row--) {
        const y = row * s * 0.5, off = (((row % 2) + 2) % 2) * s * 0.5;
        for (let col = -1; col <= n; col++) {
          const x = col * s + off, path = (cx) => { cx.beginPath(); cx.moveTo(x - s / 2, y - s * 0.22); cx.quadraticCurveTo(x - s / 2, y + s * 0.42, x, y + s * 0.5); cx.quadraticCurveTo(x + s / 2, y + s * 0.42, x + s / 2, y - s * 0.22); cx.closePath(); };
          const gr = c.createRadialGradient(x, y - s * 0.1, s * 0.05, x, y + s * 0.1, s * 0.62); gr.addColorStop(0, pal[1]); gr.addColorStop(0.75, pal[0]); gr.addColorStop(1, pal[3]);
          path(c); c.fillStyle = gr; c.fill(); c.strokeStyle = pal[2]; c.lineWidth = 1.8 * lw; c.stroke();
          path(gc); gc.fillStyle = '#000'; gc.fill(); gc.strokeStyle = '#fff'; gc.lineWidth = 1.5 * lw; gc.stroke();
        }
      }
      return { alb: a, glow: g };
    },
    glitch(S, pal, rng) {
      const a = cv(S), g = cv(S), c = a.getContext('2d'), gc = g.getContext('2d');
      c.fillStyle = pal[0]; c.fillRect(0, 0, S, S); gc.fillStyle = '#000'; gc.fillRect(0, 0, S, S);
      for (let i = 0; i < 70; i++) {
        const w = S * (0.03 + rng() * 0.22), h = S * (0.008 + rng() * 0.05), x = rng() * S, y = rng() * S, col = pal[1 + Math.floor(rng() * (pal.length - 1))], lit = rng() < 0.32;
        W9(S, (dx, dy) => { c.fillStyle = col; c.fillRect(x + dx, y + dy, w, h); if (lit) { gc.fillStyle = `rgba(255,255,255,${0.55 + rng() * 0.45})`; gc.fillRect(x + dx, y + dy, w, h); } });
      }
      gc.fillStyle = 'rgba(255,255,255,0.22)'; for (let y = 0; y < S; y += 6) gc.fillRect(0, y, S, 1);
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < S; y += 3) c.fillRect(0, y, S, 1);
      return { alb: a, glow: g };
    },
    // ---------- 테스터 무늬 (v20) ----------
    // ZERO PROTOCOL: 티타늄 흰 장갑판(모서리 깎임·위쪽 반사·나사) + 검은 기계 패널(통풍 슬롯). 줄·판 경계가 정확히 S 로 나뉘어 이어 붙여도 맞음
    //  빛 지도 = 판 사이 틈(옅게) + 검은 패널 안의 직각 회로와 마디(밝게)
    armor(S, pal, rng) {
      const a = cv(S), g = cv(S), c = a.getContext('2d'), gc = g.getContext('2d'), lw = S / 256, gap = 2.6 * lw;
      c.fillStyle = pal[3]; c.fillRect(0, 0, S, S); gc.fillStyle = '#000'; gc.fillRect(0, 0, S, S);
      const split = (L, n) => { const w = []; let s = 0; for (let i = 0; i < n; i++) { const v = 0.6 + rng(); w.push(v); s += v; } let acc = 0; return w.map((v) => { const o = [acc, v / s * L]; acc += v / s * L; return o; }); };
      for (const [y, h] of split(S, 5)) for (const [x, w] of split(S, 2 + Math.floor(rng() * 3))) {
        const x0 = x + gap / 2, y0 = y + gap / 2, W = w - gap, H = h - gap, cut = Math.min(W, H) * 0.18, dark = rng() < 0.32;
        const plate = (cx) => { cx.beginPath(); cx.moveTo(x0 + cut, y0); cx.lineTo(x0 + W, y0); cx.lineTo(x0 + W, y0 + H - cut); cx.lineTo(x0 + W - cut, y0 + H); cx.lineTo(x0, y0 + H); cx.lineTo(x0, y0 + cut); cx.closePath(); };
        gc.strokeStyle = 'rgba(255,255,255,0.45)'; gc.lineWidth = 1.2 * lw; plate(gc); gc.stroke();
        if (!dark) {
          const gr = c.createLinearGradient(0, y0, 0, y0 + H); gr.addColorStop(0, '#fbfdfe'); gr.addColorStop(0.18, pal[1]); gr.addColorStop(1, pal[2]); plate(c); c.fillStyle = gr; c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.4 * lw; c.beginPath(); c.moveTo(x0 + cut, y0 + 1.5 * lw); c.lineTo(x0 + W - 2 * lw, y0 + 1.5 * lw); c.stroke();
          c.strokeStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(x0 + 2 * lw, y0 + H - 1.5 * lw); c.lineTo(x0 + W - cut, y0 + H - 1.5 * lw); c.stroke();
          if (rng() < 0.5) { c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = lw; const yy = y0 + H * (0.3 + rng() * 0.4); c.beginPath(); c.moveTo(x0 + W * 0.1, yy); c.lineTo(x0 + W * 0.9, yy); c.stroke(); }
          c.fillStyle = '#8a939b'; for (const [sx, sy] of [[x0 + 4 * lw + cut * 0.4, y0 + 4 * lw], [x0 + W - 4 * lw, y0 + H - 4 * lw - cut * 0.4]]) { c.beginPath(); c.arc(sx, sy, 1.6 * lw, 0, TAU); c.fill(); }
        } else {
          plate(c); c.fillStyle = pal[0]; c.fill();
          c.fillStyle = '#060708'; const n = Math.max(2, Math.floor(W / (9 * lw))); for (let i = 0; i < n; i++) c.fillRect(x0 + W * 0.12 + i * (W * 0.76 / n), y0 + H * 0.25, W * 0.76 / n * 0.45, H * 0.5);
          // 직각 회로: 패널 안을 몇 번 꺾으며 지나감 + 끝 마디
          gc.strokeStyle = '#fff'; gc.fillStyle = '#fff'; gc.lineWidth = 1.5 * lw; gc.lineJoin = 'round';
          for (let k = 0; k < 2; k++) {
            let px = x0 + W * (0.1 + rng() * 0.2), py = y0 + H * (0.2 + rng() * 0.6); gc.beginPath(); gc.moveTo(px, py);
            for (let s2 = 0; s2 < 3; s2++) { if (s2 % 2 === 0) px = Math.min(x0 + W * 0.92, px + W * (0.15 + rng() * 0.3)); else py = clamp(py + (rng() - 0.5) * H * 0.6, y0 + H * 0.12, y0 + H * 0.88); gc.lineTo(px, py); }
            gc.stroke(); gc.beginPath(); gc.arc(px, py, 2.4 * lw, 0, TAU); gc.fill();
          }
        }
      }
      return { alb: a, glow: g };
    },
    // CHAOS CORE: 다크 건메탈(가로로 긁힌 결) + 가늘게 갈라진 틈(셀 경계)에서 주황 빛. 틈 둘레만 살짝 달아오름
    fracture(S, pal, rng) {
      const N = 30, P = []; for (let i = 0; i < N; i++) P.push([rng() * S, rng() * S]);
      const a = cv(S), g = cv(S), ac = a.getContext('2d'), gc = g.getContext('2d'), A = ac.createImageData(S, S), Gd = gc.createImageData(S, S), n1 = vnoise(rng, 10), n2 = vnoise(rng, 40);
      const c0 = rgb(pal[0]), c1 = rgb(pal[1]), c2 = rgb(pal[2]), H = S / 2;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of P) { let dx = Math.abs(x - px), dy = Math.abs(y - py); if (dx > H) dx = S - dx; if (dy > H) dy = S - dy; const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        const e = Math.sqrt(d2) - Math.sqrt(d1), crack = clamp(1 - e / (S * 0.008), 0, 1), heat = clamp(1 - e / (S * 0.028), 0, 1);
        const k = n1(x / S * 10, y / S * 10) * 0.55 + n2(x / S * 40, y / S * 4) * 0.35, i4 = (y * S + x) * 4, hot = Math.pow(crack, 1.4) * 0.95 + heat * heat * 0.12;
        for (let ch = 0; ch < 3; ch++) A.data[i4 + ch] = lerp(lerp(c0[ch], c1[ch], k), c2[ch], hot);
        A.data[i4 + 3] = 255;
        const gv = clamp(Math.pow(crack, 1.3) + heat * heat * 0.22, 0, 1) * 255; Gd.data[i4] = Gd.data[i4 + 1] = Gd.data[i4 + 2] = gv; Gd.data[i4 + 3] = 255;
      }
      ac.putImageData(A, 0, 0); gc.putImageData(Gd, 0, 0);
      return { alb: a, glow: g };
    },
    // LAST FRONTIER: 짙은 남색 + 샴페인 골드 기하 문양(사선 겹줄 · 지그재그 띠 · 계단 마름모) + 별과 별자리(점을 잇는 가는 선)
    //  빛 지도 = 별(빛 번짐) + 별자리 선(옅게). 금 문양은 빛나지 않고 금속처럼
    frontier(S, pal, rng) {
      const a = cv(S), g = cv(S), c = a.getContext('2d'), gc = g.getContext('2d'), lw = S / 256;
      const bg = c.createLinearGradient(0, 0, S, S); bg.addColorStop(0, pal[0]); bg.addColorStop(0.5, pal[1]); bg.addColorStop(1, pal[0]); c.fillStyle = bg; c.fillRect(0, 0, S, S);
      gc.fillStyle = '#000'; gc.fillRect(0, 0, S, S);
      c.strokeStyle = pal[2]; c.lineCap = 'square';
      // 사선 겹줄 (기울기 1 → S 마다 반복되어 이어짐)
      for (const off of [0, S / 2]) for (const dd of [0, 5 * lw]) { c.lineWidth = (dd ? 1.2 : 2.4) * lw; for (const k of [-S, 0, S]) { c.beginPath(); c.moveTo(off + dd + k, 0); c.lineTo(off + dd + k + S, S); c.stroke(); } }
      // 지그재그 띠 두 줄
      for (const y0 of [S * 0.25, S * 0.75]) { c.lineWidth = 2 * lw; for (const dy of [-6 * lw, 6 * lw]) { c.beginPath(); for (let x = 0; x <= S; x += S / 16) { const yy = y0 + dy + ((x / (S / 16)) % 2 ? -8 * lw : 8 * lw); x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); } }
      // 계단 마름모 (가로·세로 S/4 간격)
      c.fillStyle = pal[2];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const cx = (i + 0.5) * S / 4 + (j % 2) * S / 8, cy = (j + 0.5) * S / 4, s = 3 * lw;
        W9(S, (dx, dy) => { for (let r = 0; r < 3; r++) for (let q = -r; q <= r; q++) { const sx = cx + dx + q * s * 2; c.fillRect(sx - s * 0.8, cy + dy + (r - 2) * s * 2 - s * 0.8, s * 1.6, s * 1.6); if (r < 2) c.fillRect(sx - s * 0.8, cy + dy + (2 - r) * s * 2 - s * 0.8, s * 1.6, s * 1.6); } });
      }
      // 별과 별자리
      const star = (x, y, r, b) => W9(S, (dx, dy) => {
        c.fillStyle = b > 0.7 ? pal[3] : 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(x + dx, y + dy, r * 0.7, 0, TAU); c.fill();
        const gr = gc.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r * 3); gr.addColorStop(0, `rgba(255,255,255,${b})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); gc.fillStyle = gr; gc.fillRect(x + dx - r * 3, y + dy - r * 3, r * 6, r * 6);
        if (b > 0.75) { gc.strokeStyle = `rgba(255,255,255,${b * 0.8})`; gc.lineWidth = 0.8 * lw; gc.beginPath(); gc.moveTo(x + dx - r * 4, y + dy); gc.lineTo(x + dx + r * 4, y + dy); gc.moveTo(x + dx, y + dy - r * 4); gc.lineTo(x + dx, y + dy + r * 4); gc.stroke(); }
      });
      for (let i = 0; i < 70; i++) star(rng() * S, rng() * S, (0.8 + rng() * 1.2) * lw, 0.25 + rng() * 0.45);
      for (let k = 0; k < 4; k++) {
        const pts = []; let x = rng() * S, y = rng() * S; for (let i = 0; i < 5 + Math.floor(rng() * 3); i++) { pts.push([x, y]); x += (rng() - 0.3) * S * 0.12; y += (rng() - 0.5) * S * 0.12; }
        W9(S, (dx, dy) => { for (const [cx2, col, w2, al] of [[c, pal[3], 1, 0.55], [gc, '#fff', 1.1, 0.35]]) { cx2.strokeStyle = col; cx2.globalAlpha = al; cx2.lineWidth = w2 * lw; cx2.beginPath(); pts.forEach(([px, py], i) => (i ? cx2.lineTo(px + dx, py + dy) : cx2.moveTo(px + dx, py + dy))); cx2.stroke(); cx2.globalAlpha = 1; } });
        for (const [px, py] of pts) star(px, py, (1.6 + rng()) * lw, 0.8 + rng() * 0.2);
      }
      return { alb: a, glow: g };
    },
  };
  // 빛 지도만 (흰 선 = 빛남)
  const GLOW = {
    lines(gc, S) { gc.fillStyle = '#fff'; const h = Math.max(1, S / 160); for (const y of [0.3, 0.7]) gc.fillRect(0, S * y, S, h); for (let x = 0; x < S; x += S / 8) gc.fillRect(x, S * 0.3, S / 64, S * 0.4 * 0.08); },
    circuit(gc, S, rng) {
      const st = S / 32, lw = S / 256 * 1.6;
      gc.strokeStyle = '#fff'; gc.fillStyle = '#fff'; gc.lineWidth = lw; gc.lineJoin = 'round';
      for (let i = 0; i < 24; i++) {
        let x = Math.floor(rng() * 32) * st, y = Math.floor(rng() * 32) * st, dir = Math.floor(rng() * 4); const P = [[x, y]];
        for (let k = 0, n = 3 + Math.floor(rng() * 4); k < n; k++) { if (k) dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4; const L = (2 + Math.floor(rng() * 5)) * st; x += [L, 0, -L, 0][dir]; y += [0, L, 0, -L][dir]; P.push([x, y]); }
        const pad = rng() < 0.5;
        W9(S, (dx, dy) => {
          gc.beginPath(); P.forEach(([px, py], k) => (k ? gc.lineTo(px + dx, py + dy) : gc.moveTo(px + dx, py + dy))); gc.stroke();
          const [ex, ey] = P[P.length - 1]; if (pad) gc.fillRect(ex + dx - st * 0.3, ey + dy - st * 0.3, st * 0.6, st * 0.6); else { gc.beginPath(); gc.arc(ex + dx, ey + dy, st * 0.32, 0, TAU); gc.fill(); }
          gc.beginPath(); gc.arc(P[0][0] + dx, P[0][1] + dy, st * 0.2, 0, TAU); gc.fill();
        });
      }
    },
    wave(gc, S, rng) {
      gc.strokeStyle = '#fff'; const lw = S / 256;
      for (let k = 0; k < 5; k++) {
        const y0 = (k + 0.2 + rng() * 0.5) * S / 5, amp = S * (0.02 + rng() * 0.035), f = 1 + Math.floor(rng() * 2), ph = rng() * TAU;
        for (const [w, o, al] of [[2.4, 0, 1], [1, S * 0.012, 0.55]]) { gc.globalAlpha = al; gc.lineWidth = w * lw; for (const dy of [-S, 0, S]) { gc.beginPath(); for (let x = 0; x <= S; x += 2) { const y = y0 + o + dy + Math.sin(x / S * TAU * f + ph) * amp; x ? gc.lineTo(x, y) : gc.moveTo(x, y); } gc.stroke(); } }
      }
      gc.globalAlpha = 1;
    },
    veins(gc, S, rng) {
      const lw = S / 256;
      const bolt = (x, y, a, n, w) => {
        for (let i = 0; i < n; i++) {
          const nx = x + Math.cos(a) * S * 0.022, ny = y + Math.sin(a) * S * 0.022;
          W9(S, (dx, dy) => { gc.lineWidth = w * lw; gc.beginPath(); gc.moveTo(x + dx, y + dy); gc.lineTo(nx + dx, ny + dy); gc.stroke(); });
          x = nx; y = ny; a += (rng() - 0.5) * 0.9; w = Math.max(0.7, w * 0.985);
          if (rng() < 0.06 && n > 8) bolt(x, y, a + (rng() < 0.5 ? 0.8 : -0.8), Math.floor(n * 0.4), w * 0.6);
        }
      };
      gc.strokeStyle = '#fff'; gc.lineCap = 'round';
      for (let b = 0; b < 8; b++) bolt(rng() * S, rng() * S, rng() * TAU, 26 + Math.floor(rng() * 20), 2.6);
    },
  };
  const blank = (() => { let t = null; return () => t || (t = (() => { const c = cv(4), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4); return new THREE.CanvasTexture(c); })()); })();
  function toTex(c) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
  // 스킨 하나의 텍스처(무늬·빛) — 처음 쓸 때 한 번 만든다
  function texOf(id) {
    if (TEX[id]) return TEX[id];
    const d = GSKINS[id], S = d.rar >= 4 ? 512 : 256, seed = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 17), out = { pat: null, glow: null };
    if (d.pat && PAT2[d.pat]) { const r = PAT2[d.pat](d.pat === 'lava' || d.pat === 'fracture' ? 256 : S, d.pal, mulberry32(seed)); out.pat = toTex(r.alb); if (d.glow && d.glow.pat === d.pat) out.glow = toTex(r.glow); }
    else if (d.pat && PAT[d.pat]) { const c = cv(S); PAT[d.pat](c.getContext('2d'), S, d.pal || [], mulberry32(seed)); out.pat = toTex(c); }
    if (d.glow && !out.glow) {
      const c = cv(S), gc = c.getContext('2d'); gc.fillStyle = '#000'; gc.fillRect(0, 0, S, S);
      if (GLOW[d.glow.pat]) GLOW[d.glow.pat](gc, S, mulberry32(seed ^ 0x5bd1e995)); else if (PAT2[d.glow.pat]) { const r = PAT2[d.glow.pat](S, d.pal || ['#000', '#000', '#fff'], mulberry32(seed)); gc.drawImage(r.glow, 0, 0); }
      out.glow = toTex(c);
    }
    return (TEX[id] = out);
  }

  // ---------- 셰이더 ----------
  //  부위: kd 0 플라스틱·2 무광 금속 → 몸체(body) / 1 나무 → 손잡이·개머리(furn) / 3 광택 금속 → 강철(steel) / 4~6 황동·고무·천 → 그대로
  //  모드: 0 원래 색 · 1 단색 · 2 무늬. 디테일(어두운 작은 부품)은 원래 정점 색의 밝기만큼 조금 어둡게
  const V_HEAD = 'attribute float kd;\nvarying float vKd;\nvarying vec3 vOP;\nvarying vec3 vON;\nvarying float vGZ;\nuniform mat4 uGunInv;\n';
  const V_BODY = '\n\tvKd = kd; vOP = position; vON = normal; vGZ = (uGunInv * (modelMatrix * vec4(position, 1.0))).z;\n';
  const F_HEAD = `varying float vKd; varying vec3 vOP; varying vec3 vON; varying float vGZ;
uniform sampler2D uPat; uniform sampler2D uGlow; uniform float uScale;
uniform vec3 uBodyCol; uniform vec3 uFurnCol; uniform vec3 uSteelCol; uniform vec3 uMode;
uniform vec4 uMR; uniform vec2 uSteelMR;
uniform vec3 uGlowCol; uniform float uGlowAmt; uniform float uGlowAnim; uniform vec3 uGlowMask; uniform float uScanOn; uniform float uScanZ; uniform vec3 uScanCol;
uniform float uTime; uniform float uFlash; uniform float uSweepOn; uniform float uSweepZ; uniform vec3 uFxCol;
uniform vec3 uEnCol; uniform float uEnAmt; uniform float uEnAnim; uniform float uDeploy;
vec3 gsTri(sampler2D t, vec3 p, vec3 n) {
  vec3 w = abs(n); w = w * w; w = w * w; w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(t, p.zy * uScale).rgb * w.x + texture2D(t, p.zx * uScale).rgb * w.y + texture2D(t, p.xy * uScale).rgb * w.z;
}
float gsHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 gsHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
`;
  const F_SWEEP = `
	float gsEdge = 0.0;
	if (uSweepOn > 0.5) {
		float gsD = vGZ - uSweepZ + (gsHash(floor(vOP * 160.0)) - 0.5) * 0.035;
		if (gsD > 0.0) discard;
		gsEdge = smoothstep(0.07, 0.0, -gsD);
	}
`;
  const F_COLOR = `
	float gsR = floor(vKd + 0.5);
	float gsRole = gsR < 0.5 ? 0.0 : gsR < 1.5 ? 1.0 : gsR < 2.5 ? 0.0 : gsR < 3.5 ? 2.0 : 3.0;
	float gsMode = gsRole < 0.5 ? uMode.x : gsRole < 1.5 ? uMode.y : gsRole < 2.5 ? uMode.z : 0.0;
	vec3 gsNrm = normalize(vON);
	float gsDet = mix(0.45, 1.0, smoothstep(0.035, 0.14, dot(vColor, vec3(0.3, 0.59, 0.11))));
	if (gsMode > 1.5) diffuseColor.rgb = gsTri(uPat, vOP, gsNrm) * gsDet;
	else if (gsMode > 0.5) diffuseColor.rgb = (gsRole < 0.5 ? uBodyCol : gsRole < 1.5 ? uFurnCol : uSteelCol) * gsDet;
	if (gsR > 6.5) diffuseColor.rgb = uEnCol * 0.3;
`;
  const F_MR = `
	if (gsMode > 0.5) { if (gsRole < 0.5) { metalnessFactor = uMR.x; roughnessFactor = uMR.y; } else if (gsRole < 1.5) { metalnessFactor = uMR.z; roughnessFactor = uMR.w; } else { metalnessFactor = uSteelMR.x; roughnessFactor = uSteelMR.y; } }
	if (gsR > 6.5) { metalnessFactor = 0.0; roughnessFactor = 0.3; }
`;
  const F_EMIT = `
	float gsGM = gsRole < 0.5 ? uGlowMask.x : gsRole < 1.5 ? uGlowMask.y : gsRole < 2.5 ? uGlowMask.z : 0.0;
	if (uGlowAmt > 0.0 && gsGM > 0.0) {
		float gsG = gsTri(uGlow, vOP, gsNrm).r;
		float gsA = 1.0; vec3 gsGC = uGlowCol;
		if (uGlowAnim > 6.5) { float gsH = gsHash(floor(vOP * 70.0)); gsA = 0.2 + 0.8 * pow(0.5 + 0.5 * sin(uTime * (0.9 + gsH * 1.8) + gsH * 6.283), 3.0); }	// 별 반짝임 (LAST FRONTIER)
		else if (uGlowAnim > 5.5) { float gsF = gsHash(vec3(floor(uTime * 9.0), 1.0, 0.0)), gsF2 = gsHash(vec3(floor(uTime * 2.3), 2.0, 0.0)); gsA = 0.3 + 0.7 * mix(gsF * gsF, 1.0, step(0.72, gsF2)); }	// 불규칙 점멸 (CHAOS CORE)
		else if (uGlowAnim > 4.5) { float gsW = 0.5 + 0.5 * sin(uTime * 1.25 - vOP.z * 7.0 - vOP.y * 3.0); gsA = 0.16 + 0.84 * gsW * gsW * gsW; }	// 회로가 천천히 차례로 점등 (ZERO PROTOCOL)
		else if (uGlowAnim > 3.5) { gsGC = mix(uGlowCol, gsHue(fract(uTime * 0.16 + vOP.z * 2.4 + vOP.y * 1.4)), 0.85); float gsW = 0.5 + 0.5 * sin(uTime * 3.2 - vOP.z * 24.0); gsA = 0.5 + 0.5 * gsW; }	// 테스터: 무지개가 총 길이를 따라 흐름
		else if (uGlowAnim > 2.5) { float gsB = floor(uTime * 13.0) + floor(vOP.z * 22.0) * 7.0 + floor(vOP.y * 30.0); gsA = 0.3 + 0.7 * step(0.28, gsHash(vec3(gsB, 1.0, 2.0))); }
		else if (uGlowAnim > 1.5) { float gsW = 0.5 + 0.5 * sin(uTime * 4.2 - vOP.z * 16.0); gsA = 0.4 + 0.6 * gsW * gsW; }
		else if (uGlowAnim > 0.5) gsA = 0.72 + 0.28 * sin(uTime * 2.4 + vOP.z * 3.0);
		totalEmissiveRadiance += gsGC * gsG * uGlowAmt * gsGM * (gsA + uFlash * 1.8);
	}
	totalEmissiveRadiance += (uGlowAnim > 3.5 && uGlowAnim < 4.5 ? gsHue(fract(vOP.z * 3.0 + uTime * 0.6)) : uFxCol) * gsEdge * 2.6;
	// 스캔 띠 (테스터: 재장전·살펴보기 때 총을 따라 지나가는 빛)
	if (uScanOn > 0.5) totalEmissiveRadiance += uScanCol * smoothstep(0.035, 0.0, abs(vGZ - uScanZ)) * 3.2;
	// 부속품의 발광 부품(kd 7 = energy): 스킨 색으로 빛나고, 펼쳐질 때(uDeploy) 번쩍
	if (gsR > 6.5) {
		float gsE = 1.0; vec3 gsEC = uEnCol;
		if (uEnAnim > 6.5) gsE = 0.85 + 0.15 * sin(uTime * 1.6);
		else if (uEnAnim > 5.5) { float gsF = gsHash(vec3(floor(uTime * 11.0), 5.0, 0.0)); gsE = 0.3 + 0.9 * gsF * gsF; }
		else if (uEnAnim > 4.5) gsE = 0.5 + 0.5 * (0.5 + 0.5 * sin(uTime * 1.25));
		else if (uEnAnim > 3.5) { gsEC = mix(uEnCol, gsHue(fract(uTime * 0.22 + vOP.z * 6.0 + vOP.x * 4.0 + vOP.y * 3.0)), 0.8); gsE = 0.82 + 0.18 * sin(uTime * 5.0 - vOP.z * 40.0); }
		else if (uEnAnim > 2.5) { float gsB = floor(uTime * 11.0) + floor(vOP.y * 40.0) * 5.0 + floor(vOP.z * 30.0) * 3.0; gsE = 0.3 + 0.7 * step(0.25, gsHash(vec3(gsB, 3.0, 1.0))); }
		else if (uEnAnim > 1.5) { float gsW = 0.5 + 0.5 * sin(uTime * 4.0 - vOP.z * 40.0 - vOP.x * 20.0); gsE = 0.55 + 0.45 * gsW; }
		else if (uEnAnim > 0.5) gsE = 0.78 + 0.22 * sin(uTime * 2.2);
		totalEmissiveRadiance += gsEC * uEnAmt * (gsE + uFlash * 1.2 + uDeploy * 2.5);
	}
`;
  function patchV(s) { return s.replace('void main() {', V_HEAD + 'void main() {').replace('#include <begin_vertex>', '#include <begin_vertex>' + V_BODY); }
  function patchF(s) {
    return s.replace('void main() {', F_HEAD + 'void main() {')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + F_SWEEP)
      .replace('#include <color_fragment>', '#include <color_fragment>' + F_COLOR)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>' + F_MR)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + F_EMIT);
  }
  // 셰이더 시간은 10분마다 되감음(float 정밀도). 입자 정리는 되감지 않는 CLOCK
  const TIME = { value: 0 }; let CLOCK = 0;
  // 스킨마다 바뀌지 않는 값(텍스처·색·모드) — 인스턴스끼리 같은 객체를 공유
  const STATIC = {};
  function staticU(id) {
    if (STATIC[id]) return STATIC[id];
    const d = GSKINS[id], T = texOf(id), b = d.body || {}, f = d.furn || {}, s = d.steel || {};
    const mode = (r) => (r.p ? 2 : r.c !== undefined ? 1 : 0), gl = d.glow;
    return (STATIC[id] = {
      uPat: { value: T.pat || blank() }, uGlow: { value: T.glow || blank() }, uScale: { value: d.sc || 3 },
      uBodyCol: { value: new THREE.Color(b.c !== undefined ? b.c : 0x888888) }, uFurnCol: { value: new THREE.Color(f.c !== undefined ? f.c : 0x888888) }, uSteelCol: { value: new THREE.Color(s.c !== undefined ? s.c : 0x888888) },
      uMode: { value: new THREE.Vector3(mode(b), mode(f), mode(s)) },
      uMR: { value: new THREE.Vector4((b.mr || [0.15, 0.6])[0], (b.mr || [0.15, 0.6])[1], (f.mr || [0, 0.7])[0], (f.mr || [0, 0.7])[1]) }, uSteelMR: { value: new THREE.Vector2((s.mr || [0.9, 0.3])[0], (s.mr || [0.9, 0.3])[1]) },
      uGlowCol: { value: new THREE.Color(gl ? gl.c : 0) }, uGlowAmt: { value: gl ? gl.k : 0 }, uGlowAnim: { value: gl ? gl.anim || 0 : 0 }, uGlowMask: { value: new THREE.Vector3(...(d.glowMask || [1, 1, 0])) },
      uEnCol: { value: new THREE.Color(d.en || 0) }, uEnAmt: { value: d.enK || 2.2 }, uEnAnim: { value: d.enAnim || 1 },
    });
  }
  function makeMat(base, U, d) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: base.roughness, metalness: base.metalness, envMap: base.envMap, envMapIntensity: d.env !== undefined ? Math.max(d.env, base.envMapIntensity) : base.envMapIntensity });
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U); sh.vertexShader = patchV(sh.vertexShader); sh.fragmentShader = patchF(sh.fragmentShader); };
    m.customProgramCacheKey = () => 'gskin-v4';
    return m;
  }
  // 그리기 직전에 총 공간 행렬(빛 띠 위치 계산용) — 효과가 진행 중일 때만
  let FRM = 0;
  function beforeRender() { const I = this.userData.gsInst; if (I && (I.U.uSweepOn.value > 0.5 || I.U.uScanOn.value > 0.5) && I.frm !== FRM) { I.frm = FRM; I.U.uGunInv.value.copy(I.g.matrixWorld).invert(); } }
  const _bb = new THREE.Box3();
  // 만들어진 총(그룹)에 스킨을 입힌다
  function apply(g, id) {
    const d = GSKINS[id]; if (!d || d.gun !== g.userData.id) return g;
    const U = Object.assign({ uTime: TIME, uFlash: { value: 0 }, uSweepOn: { value: 0 }, uSweepZ: { value: 0 }, uScanOn: { value: 0 }, uScanZ: { value: 0 }, uScanCol: { value: new THREE.Color(0x3ff5ff) }, uGunInv: { value: new THREE.Matrix4() }, uFxCol: { value: new THREE.Color(d.fx ? d.fx.c : rarOf(d.rar).hex) }, uDeploy: { value: 0 } }, staticU(id));
    const I = { g, id, d, U, flash: 0, sweep: null, dep: null, parts: null, frm: -1, z0: -0.4, z1: 0.6 }, mats = {};
    const walk = (o) => {
      if (o.userData.noSkin) return;
      if (o.isMesh && o.material && o.material.userData) {
        const k = o.material.userData.clsKey;
        if (k === 'cls:metal' || k === 'cls:matte' || k === 'cls:diel') { o.material = mats[k] || (mats[k] = makeMat(o.material, U, d)); o.userData.gsInst = I; o.onBeforeRender = beforeRender; }
      }
      for (const ch of o.children) walk(ch);
    };
    walk(g);
    // 몸체 길이(개머리판 끝 ~ 총구) — 빛 띠가 지나가는 구간
    const body = g.children[0]; let z0 = 1e9, z1 = -1e9;
    if (body) for (const m of body.children) { const gb = m.geometry && m.geometry.boundingBox; if (gb) { z0 = Math.min(z0, gb.min.z); z1 = Math.max(z1, gb.max.z); } }
    if (z0 < z1) { I.z0 = z0; I.z1 = z1; } else { _bb.setFromObject(g); I.z0 = _bb.min.z; I.z1 = _bb.max.z; }
    // 울트라레어 부속품 (05_models_gparts.js): 같은 스킨 재질을 써서 꺼내기·넣기 빛 띠에 같이 나타나고 사라진다
    const pm = mats['cls:metal'] || mats['cls:matte'] || mats['cls:diel'];
    if (d.parts && pm && typeof GunParts !== 'undefined') {
      I.parts = GunParts.attach(g, d.parts, pm, I.z0, I.z1);
      if (I.parts) for (const p of I.parts) { p.mesh.userData.gsInst = I; p.mesh.onBeforeRender = beforeRender; }
    }
    g.userData.skin = I;
    if (d.deco && typeof GunDeco !== 'undefined') I.deco = GunDeco.attach(g, d, I.z0, I.z1);   // 테스터: 엠블럼·각인·홀로그램 (05_models_gdeco.js)
    if (d.tester) IDLE.add(I);
    return g;
  }
  // ---------- 부속품 전개: 빛 띠가 총구에 닿을 즈음부터 총 앞쪽 부속품부터 차례로 튀어나옴 ----------
  const DEP = { at: 0.8, wave: 0.26, each: 0.2, flare: 0.4 };   // at: 빛 띠 진행의 몇 % 에서 시작 · wave: 총구→개머리판까지 걸리는 시간 · each: 부속품 하나가 펼쳐지는 시간
  const backOut = (u) => { const a = 1.9, v = u - 1; return 1 + (a + 1) * v * v * v + a * v * v; };
  function setParts(I, k) { if (I.parts) for (const p of I.parts) { p.inner.scale.setScalar(Math.max(0.001, k)); p.inner.position.y = 0; p.popped = k > 0.5; } }
  function updateDeploy(I, dt) {
    const D = I.dep; D.t += dt; const t0 = D.dur * DEP.at; let done = true;
    for (const p of I.parts) {
      const u = clamp((D.t - t0 - (1 - p.zn) * DEP.wave) / DEP.each, 0, 1);
      if (u < 1) done = false;
      if (u > 0 && !p.popped) { p.popped = true; partPop(I, p); }
      p.inner.scale.setScalar(u > 0 ? Math.max(0.001, backOut(u)) : 0.001);
      p.inner.position.y = p.ring ? 0 : -0.014 * (1 - Math.min(1, u * 1.5));   // 몸체 안쪽에서 밀려 나옴
    }
    const fl = D.t < t0 ? 0 : clamp(1 - (D.t - t0 - DEP.wave) / DEP.flare, 0, 1);
    I.U.uDeploy.value = fl;
    if (done && fl <= 0) { I.dep = null; I.U.uDeploy.value = 0; }
  }
  // 부속품이 튀어나올 때 그 자리에 작은 빛 조각
  function partPop(I, p) {
    const g = I.g, sc = sceneOf(g); if (!sc || !shown(g) || !I.d.fx) return;
    const vm = isVM(sc), k = vm ? 0.8 : 1.8, fx = I.d.fx, P = pool(sc);
    p.outer.getWorldPosition(_p);
    for (let i = 0; i < 5; i++) { _r.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(0.3 + Math.random() * 0.5); emit(P, _p, _r.x, _r.y, _r.z, pick(fx), (0.008 + Math.random() * 0.008) * k, 0.2 + Math.random() * 0.2, { drag: 3, sq: fx.kind === 'glitch' || fx.kind === 'frost' }); }
  }

  // ---------- 입자: 장면마다 점 구름 하나(그리기 1번) — 동그란 빛 / 네모 파편 ----------
  //  solid(0~1): 0 = 더하기(빛), 1 = 덮어 그리기(밝은 하늘·땅 위에서도 색이 하얗게 날아가지 않음). 미리 곱한 알파 혼합 하나로 둘 다
  const PV = `attribute float size; attribute float alpha; attribute float shape; attribute float solid; attribute vec3 pcol;
uniform float uVH; varying vec3 vC; varying float vA; varying float vS; varying float vO;
void main() { vC = pcol; vA = alpha; vS = shape; vO = solid; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = alpha > 0.0 ? clamp(size * projectionMatrix[1][1] * uVH * 0.5 / max(0.02, -mv.z), 1.0, 256.0) : 0.0; }`;
  const PF = `varying vec3 vC; varying float vA; varying float vS; varying float vO;
void main() { vec2 q = gl_PointCoord - 0.5; float a;
  if (vS > 0.5) { vec2 r = abs(q); a = step(max(r.x, r.y), 0.36); } else { float d = clamp(1.0 - length(q) * 2.0, 0.0, 1.0); a = d * d * (0.6 + 0.4 * d); }
  if (a * vA < 0.004) discard; float k = vA * a; gl_FragColor = vec4(vC * k, k * vO); }`;
  const POOLS = new Map(), _vs = new THREE.Vector2(), _col = new THREE.Color();
  function pool(sc) {
    let P = POOLS.get(sc);
    if (!P) {
      const N_POOL = isVM(sc) ? 128 : 768;   // 월드 장면은 맞힘·처치 효과(05_models_gskinfx.js)도 같이 씀
      const geo = new THREE.BufferGeometry(), A = (n) => new THREE.BufferAttribute(new Float32Array(N_POOL * n), n).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', A(3)); geo.setAttribute('pcol', A(3)); geo.setAttribute('size', A(1)); geo.setAttribute('alpha', A(1)); geo.setAttribute('shape', A(1)); geo.setAttribute('solid', A(1));
      const mat = new THREE.ShaderMaterial({ uniforms: { uVH: { value: 720 } }, vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
      pts.onBeforeRender = (r) => { r.getDrawingBufferSize(_vs); mat.uniforms.uVH.value = _vs.y; };
      sc.add(pts);
      P = { sc, pts, geo, list: [], i: 0, used: 0, warm: 0 };
      for (let i = 0; i < N_POOL; i++) P.list.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), c: [1, 1, 1], life: 0, max: 1, g: 0, drag: 0, size: 0, grow: 0, a: 1, sq: 0, so: 0 });
      POOLS.set(sc, P);
    }
    P.used = CLOCK; return P;
  }
  function emit(P, pos, vx, vy, vz, col, size, life, o = {}) {
    const q = P.list[P.i++ % P.list.length];
    q.p.copy(pos); q.v.set(vx, vy, vz); _col.setHex(col); q.c[0] = _col.r; q.c[1] = _col.g; q.c[2] = _col.b;
    q.life = q.max = life; q.g = o.g || 0; q.drag = o.drag || 0; q.size = size; q.grow = o.grow || 0; q.a = o.a || 1; q.sq = o.sq ? 1 : 0; q.so = o.so || 0;
  }
  function updateParticles(dt) {
    for (const [sc, P] of POOLS) {
      let alive = 0;
      const at = P.geo.attributes, pos = at.position.array, col = at.pcol.array, sz = at.size.array, al = at.alpha.array, sh = at.shape.array, so = at.solid.array;
      for (let i = 0; i < P.list.length; i++) {
        const q = P.list[i];
        if (q.life > 0) {
          q.life -= dt;
          if (q.life > 0) {
            alive++; const k = q.life / q.max;
            q.v.y += q.g * dt; if (q.drag) q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt));
            q.p.addScaledVector(q.v, dt);
            pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; col[i * 3] = q.c[0]; col[i * 3 + 1] = q.c[1]; col[i * 3 + 2] = q.c[2];
            sz[i] = q.size * (1 + q.grow * (1 - k)); al[i] = q.a * Math.pow(k, 0.7); sh[i] = q.sq; so[i] = q.so; continue;
          }
        }
        al[i] = 0;
      }
      if (alive || P.was) for (const k of ['position', 'pcol', 'size', 'alpha', 'shape', 'solid']) at[k].needsUpdate = true;
      P.was = alive > 0; P.pts.visible = alive > 0 || P.warm > 0; if (P.warm > 0) P.warm--;
      // 쓰지 않는 장면(끝난 경기 등)의 입자는 정리
      if (!alive && CLOCK - P.used > 6 && sc !== G.scene && !isVM(sc)) { sc.remove(P.pts); P.geo.dispose(); P.pts.material.dispose(); POOLS.delete(sc); }
    }
  }
  const sceneOf = (o) => { while (o.parent) o = o.parent; return o.isScene ? o : null; };
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const isVM = (sc) => typeof VM !== 'undefined' && sc === VM.scene;
  const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
  // 테스터(rainbow): 무지개 여섯 색 중 하나
  const PRISM = [0xff5ad8, 0x9b7bff, 0x45d8ff, 0x4dffc4, 0xfff07a, 0xffa34a];
  const pick = (fx) => (fx.pal ? fx.pal[(Math.random() * fx.pal.length) | 0] : fx.rainbow ? PRISM[(Math.random() * 6) | 0] : Math.random() < 0.55 ? fx.c : fx.c2);   // 테스터: 스킨마다 정한 색 묶음
  const own = (c) => !c || !!c.isPlayer;
  // ---------- 사격 ----------
  const SHOT = {
    // 마그마: 주황 고리 화염 + 위로 떠오르다 떨어지는 불씨
    ember(P, k, fx) {
      emit(P, _p, _d.x * 0.4, _d.y * 0.4, _d.z * 0.4, fx.c, 0.2 * k, 0.08, { grow: 0.9 });
      emit(P, _p, _d.x * 1.2, _d.y * 1.2, _d.z * 1.2, 0xffd27a, 0.09 * k, 0.06, { grow: 1.5 });
      for (let i = 0; i < 14; i++) { const sp = 1.2 + Math.random() * 2.6; emit(P, _p, _d.x * sp + (Math.random() - 0.5) * 1.3, _d.y * sp + 0.4 + Math.random() * 1.0, _d.z * sp + (Math.random() - 0.5) * 1.3, pick(fx), (0.016 + Math.random() * 0.016) * k, 0.4 + Math.random() * 0.4, { g: -1.6, drag: 1.4 }); }
    },
    // 홍룡: 앞으로 길게 뻗는 불꽃 혀 + 금빛 불티
    flame(P, k, fx) {
      for (let i = 0; i < 6; i++) { const sp = 0.8 + i * 0.6; emit(P, _p, _d.x * sp + (Math.random() - 0.5) * 0.2, _d.y * sp + 0.15, _d.z * sp + (Math.random() - 0.5) * 0.2, i < 2 ? 0xffd27a : fx.c, (0.045 + i * 0.012) * k, 0.14 + i * 0.03, { grow: 2.2, drag: 3 }); }
      for (let i = 0; i < 9; i++) { const sp = 2 + Math.random() * 3; emit(P, _p, _d.x * sp + (Math.random() - 0.5) * 1.5, _d.y * sp + (Math.random() - 0.3) * 1.5, _d.z * sp + (Math.random() - 0.5) * 1.5, fx.c2, (0.01 + Math.random() * 0.008) * k, 0.3 + Math.random() * 0.2, { g: -3, drag: 2 }); }
    },
    // 플라즈마: 분홍 고리 + 아주 빠르고 짧은 전기 스파크
    spark(P, k, fx) {
      emit(P, _p, 0, 0, 0, fx.c, 0.22 * k, 0.07, { grow: 1.4 });
      emit(P, _p, 0, 0, 0, 0xffffff, 0.07 * k, 0.04, { grow: 1 });
      for (let i = 0; i < 16; i++) { const sp = 4 + Math.random() * 5; _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(2.6); emit(P, _p, _d.x * sp + _r.x, _d.y * sp + _r.y, _d.z * sp + _r.z, pick(fx), (0.009 + Math.random() * 0.009) * k, 0.12 + Math.random() * 0.14, { drag: 8 }); }
    },
    // 글리치: 붉은·하늘색 네모 파편이 사방으로 튐
    glitch(P, k, fx) {
      emit(P, _p, 0, 0, 0, fx.c, 0.16 * k, 0.06, { grow: 0.6 });
      for (let i = 0; i < 12; i++) { const sp = 0.8 + Math.random() * 1.8; _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.8); emit(P, _p, _d.x * sp + _r.x, _d.y * sp + _r.y, _d.z * sp + _r.z, pick(fx), (0.014 + Math.random() * 0.016) * k, 0.18 + Math.random() * 0.22, { sq: 1, drag: 4 }); }
    },
    // 서리: 하얀 고리 + 앞으로 흩어지며 떨어지는 얼음 조각 + 옅은 서리 김
    frost(P, k, fx) {
      emit(P, _p, 0, 0, 0, fx.c2, 0.2 * k, 0.07, { grow: 1.1 });
      emit(P, _p, _d.x * 0.5, _d.y * 0.5, _d.z * 0.5, fx.c, 0.12 * k, 0.32, { grow: 1.6, drag: 2.5 });
      for (let i = 0; i < 12; i++) { const sp = 1.5 + Math.random() * 3; _r.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(1.4); emit(P, _p, _d.x * sp + _r.x, _d.y * sp + _r.y, _d.z * sp + _r.z, pick(fx), (0.009 + Math.random() * 0.012) * k, 0.3 + Math.random() * 0.3, { sq: 1, g: -4, drag: 2 }); }
    },
    // 공허: 보랏빛이 총구로 빨려 들었다가(안쪽으로 모이는 입자) 짧게 터짐
    void(P, k, fx) {
      emit(P, _p, 0, 0, 0, fx.c, 0.24 * k, 0.08, { grow: -0.6 });
      emit(P, _p, 0, 0, 0, fx.c2, 0.08 * k, 0.05, { grow: 1.2 });
      for (let i = 0; i < 12; i++) { _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); const R = 0.09 + Math.random() * 0.08; _q.copy(_p).addScaledVector(_r, R); emit(P, _q, -_r.x * R * 5, -_r.y * R * 5, -_r.z * R * 5, pick(fx), (0.01 + Math.random() * 0.01) * k, 0.2, { drag: 0 }); }
      for (let i = 0; i < 6; i++) { const sp = 2 + Math.random() * 3; emit(P, _p, _d.x * sp + (Math.random() - 0.5), _d.y * sp + (Math.random() - 0.5), _d.z * sp + (Math.random() - 0.5), fx.c, (0.012 + Math.random() * 0.01) * k, 0.25 + Math.random() * 0.15, { drag: 5 }); }
    },
  };
  // 테스터(프로토타입 β): 하얀 섬광 + 총구 둘레로 무지개 여섯 빛이 육각으로 퍼짐 + 앞으로 뻗는 프리즘 조각 + 옅은 잔광 고리
  SHOT.prism = function (P, k, fx) {
    emit(P, _p, 0, 0, 0, 0xffffff, 0.2 * k, 0.06, { grow: 1.3 });
    emit(P, _p, _d.x * 0.6, _d.y * 0.6, _d.z * 0.6, fx.c, 0.13 * k, 0.16, { grow: 1.8, drag: 4 });
    _u.set(0, 1, 0); if (Math.abs(_d.y) > 0.9) _u.set(1, 0, 0);
    _r.crossVectors(_d, _u).normalize(); _u.crossVectors(_r, _d).normalize();
    const a0 = Math.random() * TAU;
    for (let i = 0; i < 6; i++) {
      const a = a0 + i * TAU / 6, ca = Math.cos(a), sa = Math.sin(a);
      for (const sp of [1.4, 2.4]) emit(P, _p, (_r.x * ca + _u.x * sa) * sp + _d.x * 1.4, (_r.y * ca + _u.y * sa) * sp + _d.y * 1.4, (_r.z * ca + _u.z * sa) * sp + _d.z * 1.4, PRISM[i], (sp > 2 ? 0.012 : 0.02) * k, 0.2, { drag: 6, sq: 1 });
    }
    for (let i = 0; i < 10; i++) { const sp = 3 + Math.random() * 5; _q.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.4); emit(P, _p, _d.x * sp + _q.x, _d.y * sp + _q.y, _d.z * sp + _q.z, PRISM[(Math.random() * 6) | 0], (0.008 + Math.random() * 0.008) * k, 0.14 + Math.random() * 0.14, { drag: 5, sq: Math.random() < 0.5 }); }
  };
  // ZERO PROTOCOL: 하얀 섬광 + 총구 둘레 시안 육각 고리(여섯 점) + 앞으로 곧게 뻗는 시안 조각
  SHOT.zero = function (P, k, fx) {
    emit(P, _p, 0, 0, 0, 0xffffff, 0.16 * k, 0.05, { grow: 1.2 });
    _u.set(0, 1, 0); if (Math.abs(_d.y) > 0.9) _u.set(1, 0, 0); _r.crossVectors(_d, _u).normalize(); _u.crossVectors(_r, _d).normalize();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.26, ca = Math.cos(a), sa = Math.sin(a); emit(P, _p, (_r.x * ca + _u.x * sa) * 1.3 + _d.x, (_r.y * ca + _u.y * sa) * 1.3 + _d.y, (_r.z * ca + _u.z * sa) * 1.3 + _d.z, fx.c, 0.012 * k, 0.16, { drag: 7, sq: 1 }); }
    for (let i = 0; i < 7; i++) { const sp = 4 + Math.random() * 5; emit(P, _p, _d.x * sp, _d.y * sp, _d.z * sp, pick(fx), (0.006 + Math.random() * 0.006) * k, 0.1 + Math.random() * 0.08, { drag: 6, sq: 1 }); }
  };
  // CHAOS CORE: 총구 화염은 그대로 두고 작은 붉은 잔광이 잠깐 남음 + 불티 몇 개
  SHOT.chaos = function (P, k, fx) {
    emit(P, _p, _d.x * 0.15, _d.y * 0.15 + 0.03, _d.z * 0.15, fx.c, 0.07 * k, 0.45, { grow: 0.6, drag: 3 });
    for (let i = 0; i < 4; i++) { const sp = 1 + Math.random() * 2; emit(P, _p, _d.x * sp + (Math.random() - 0.5) * 0.8, _d.y * sp + 0.3 + Math.random() * 0.5, _d.z * sp + (Math.random() - 0.5) * 0.8, pick(fx), (0.006 + Math.random() * 0.005) * k, 0.3 + Math.random() * 0.25, { g: -1.2, drag: 2 }); }
  };
  // LAST FRONTIER: 금빛 작은 섬광 + 천천히 흩어지는 별 반짝임
  SHOT.frontier = function (P, k, fx) {
    emit(P, _p, 0, 0, 0, 0xfff0c0, 0.12 * k, 0.06, { grow: 1 });
    for (let i = 0; i < 6; i++) { _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.4 + Math.random() * 0.5); emit(P, _p, _d.x * 1.5 + _r.x, _d.y * 1.5 + _r.y, _d.z * 1.5 + _r.z, pick(fx), (0.005 + Math.random() * 0.004) * k, 0.5 + Math.random() * 0.4, { drag: 3, grow: -0.4 }); }
  };
  // 슈퍼레어(약한 효과): 스킨 색 작은 섬광 + 조각 몇 개. 몸체 빛·탄도 색·효과음 없음 — 울트라레어와 등급 차이가 보이게
  function liteShot(P, k, fx) {
    emit(P, _p, 0, 0, 0, fx.c, 0.1 * k, 0.05, { grow: 0.8 });
    const sq = fx.kind === 'glitch';
    for (let i = 0; i < 4; i++) { const sp = 1 + Math.random() * 2; _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1.2); emit(P, _p, _d.x * sp + _r.x, _d.y * sp + _r.y + (fx.kind === 'ember' ? 0.6 : 0), _d.z * sp + _r.z, pick(fx), (0.007 + Math.random() * 0.006) * k, 0.12 + Math.random() * 0.12, { sq, drag: 5, g: fx.kind === 'ember' ? -1.5 : 0 }); }
  }
  function shot(g, c) {
    const I = g && g.userData.skin, fx = I && (I.d.fx || I.d.lite); if (!fx) return;
    if (!fx.lite) { I.flash = I.d.flashK !== undefined ? I.d.flashK : 1; ACTIVE.add(I); }
    const sc = sceneOf(g); if (!sc || !shown(g)) return;
    const vm = isVM(sc), k = vm ? 1.45 : 2.4, m = g.userData.meta;   // 1인칭은 총구가 화면 구석이라 조금 크게
    if (!vm && G.camera && _q.setFromMatrixPosition(g.matrixWorld).distanceTo(G.camera.position) > (fx.lite ? 40 : 70)) return;
    _p.set(0, m.boreY, m.muzzleZ + 0.015); g.localToWorld(_p); _d.set(0, m.boreY, m.muzzleZ + 1); g.localToWorld(_d); _d.sub(_p).normalize();
    if (fx.lite) { liteShot(pool(sc), k, fx); return; }
    (SHOT[fx.kind] || SHOT.ember)(pool(sc), k, fx);
    if (typeof Audio !== 'undefined' && Audio.skinFx) Audio.skinFx('shot', fx.kind, c && !own(c) ? c.pos : null, own(c));
  }
  // ---------- 꺼내기·넣기 (빛 띠) ----------
  const ACTIVE = new Set();
  function draw(g, dur = 0.35, c = null, quiet = false) {
    const I = g && g.userData.skin; if (!I || !I.d.fx) return;
    g.updateWorldMatrix(true, true); I.U.uGunInv.value.copy(g.matrixWorld).invert();
    I.sweep = { t: 0, dur, out: false, c }; I.U.uSweepOn.value = 1; I.U.uSweepZ.value = I.z0 - 0.05; ACTIVE.add(I);
    if (I.parts) { setParts(I, 0); I.dep = { t: 0, dur }; }   // 부속품은 접어 두었다가 빛 띠를 따라 펼침
    if (I.deco) for (const e of I.deco) e.mesh.visible = false;   // 각인·엠블럼도 빛 띠를 따라 나타남
    if (I.d.tester) spinStart(I, dur);
    if (!quiet && typeof Audio !== 'undefined' && Audio.skinFx && shown(g)) Audio.skinFx('draw', I.d.fx.kind, c && !own(c) ? c.pos : null, own(c));
  }
  // ---------- 테스터 전용 꺼내기 동작 ----------
  //  1인칭: 총이 손을 떠나 살짝 떠오른 채 세로축으로 한 바퀴 돌며 옆으로 한 번 구르고, 제자리로 내려와 손에 착 붙음 (도는 동안 손은 숨김)
  //  3인칭·로비·진열: 손(받침)에 붙은 채 총열 축으로 두 바퀴 굴렀다가 멈춤
  //  둘 다 둘레에서 무지개 육각 조각이 총으로 빨려 들며 조립되는 모습
  function spinStart(I, dur) {
    const g = I.g, sc = sceneOf(g), vm = !!sc && isVM(sc);
    if (I.spin) { g.position.copy(I.spin.p0); g.rotation.copy(I.spin.r0); }
    I.spin = { t: 0, dur: vm ? Math.max(0.62, dur * 1.35) : Math.max(0.55, dur * 1.5), vm, p0: g.position.clone(), r0: g.rotation.clone() }; ACTIVE.add(I);
    if (!sc || !shown(g)) return;
    const k = vm ? 1 : 2.4, R0 = vm ? 0.16 : 0.32, P = pool(sc), m = g.userData.meta;
    for (let i = 0; i < (vm ? 22 : 28); i++) {
      _q.set(0, m.boreY, lerp(I.z0, I.z1, Math.random())); g.localToWorld(_q);
      _r.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize(); const R = R0 * (0.6 + Math.random() * 0.6), T = 0.22 + Math.random() * 0.16;
      _p.copy(_q).addScaledVector(_r, R);
      emit(P, _p, -_r.x * R / T, -_r.y * R / T, -_r.z * R / T, I.d.fx.pal ? I.d.fx.pal[i % I.d.fx.pal.length] : PRISM[i % 6], (0.012 + Math.random() * 0.01) * k, T, { sq: 1 });
    }
  }
  function spinUpdate(I, dt) {
    const s = I.spin, g = I.g; s.t += dt;
    const u = clamp(s.t / s.dur, 0, 1), e = 1 - Math.pow(1 - u, 3);
    if (s.vm) {
      const lift = Math.sin(Math.min(1, u * 1.25) * Math.PI);
      g.position.set(s.p0.x, s.p0.y + 0.055 * lift, s.p0.z - 0.03 * lift);
      g.rotation.set(s.r0.x + 0.25 * lift, s.r0.y + (1 - e) * TAU, s.r0.z + (1 - Math.min(1, e * 1.3)) * TAU);
      I.spinHide = u < 0.7;
    } else g.rotation.set(s.r0.x, s.r0.y, s.r0.z + (1 - e) * TAU * 2);
    if (u >= 1) { g.position.copy(s.p0); g.rotation.copy(s.r0); I.spin = null; I.spinHide = false; }
  }
  // 들고 있는 동안: 홀로 고리가 돌고(부속품 spin), 둘레에 작은 프리즘 빛이 떠다님
  const IDLE = new Set();
  function idleUpdate(dt) {
    for (const I of IDLE) {
      const g = I.g, sc = sceneOf(g);
      if (!sc) { I.gone = (I.gone || 0) + dt; if (I.gone > 8) IDLE.delete(I); continue; }
      I.gone = 0; if (!shown(g)) continue;
      if (I.parts) for (const p of I.parts) if (p.spin) p.inner.rotation.z += p.spin * dt;
      const vm = isVM(sc);
      if (!vm && G.camera && _q.setFromMatrixPosition(g.matrixWorld).distanceTo(G.camera.position) > 22) continue;
      I.moteT = (I.moteT || 0) - dt; if (I.moteT > 0) continue;
      // 주제별: ZERO = 시안 데이터 조각이 천천히 떠오름 · CHAOS = 코어 둘레에서 붉은 불티가 튐(불규칙) · FRONTIER = 개머리판 둘레 금빛 별 반짝임
      const kind = I.d.fx && I.d.fx.kind, m = g.userData.meta, k = vm ? 1 : 2.2, P = pool(sc), col = pick(I.d.fx);
      if (kind === 'chaos') {
        I.moteT = (vm ? 0.08 : 0.16) * (0.4 + Math.random() * 1.6);
        const core = I.parts && I.parts.find((p) => p.core); if (core) core.outer.getWorldPosition(_p); else { _p.set(0, m.boreY, lerp(I.z0, I.z1, 0.4)); g.localToWorld(_p); }
        emit(P, _p, (Math.random() - 0.5) * 0.25, 0.08 + Math.random() * 0.22, (Math.random() - 0.5) * 0.25, col, (0.004 + Math.random() * 0.004) * k, 0.35 + Math.random() * 0.3, { g: -0.4, drag: 1.5 });
      } else if (kind === 'frontier') {
        I.moteT = vm ? 0.12 : 0.24;
        const a = Math.random() * TAU, r = 0.03 + Math.random() * 0.04; _p.set(Math.cos(a) * r, m.boreY - 0.02 + Math.sin(a) * r, lerp(I.z0, lerp(I.z0, I.z1, 0.55), Math.random())); g.localToWorld(_p);
        emit(P, _p, 0, 0.01, 0, col, (0.004 + Math.random() * 0.004) * k, 0.6 + Math.random() * 0.5, { grow: -0.5 });
      } else {
        I.moteT = vm ? 0.14 : 0.28;
        const a = Math.random() * TAU, r = 0.03 + Math.random() * 0.035; _p.set(Math.cos(a) * r, m.boreY + Math.sin(a) * r, lerp(I.z0, I.z1, Math.random())); g.localToWorld(_p);
        emit(P, _p, (Math.random() - 0.5) * 0.02, 0.04 + Math.random() * 0.05, (Math.random() - 0.5) * 0.02, col, (0.0035 + Math.random() * 0.003) * k, 0.6 + Math.random() * 0.5, { sq: 1 });
      }
    }
  }
  // ---------- 테스터: 재장전 · 살펴보기 ----------
  //  재장전(06_combat.js 가 부름): ZERO = 시작할 때 시안 스캔 띠 · CHAOS = 탄창 갈 때 코어 둘레 붉은 입자 · FRONTIER = 끝나면 금빛 한 번
  //  살펴보기(09_player.js · 진열장): ZERO = 옆에 SYSTEM ONLINE 홀로그램 · CHAOS = 코어가 강하게 빛나며 맥박 · FRONTIER = 별빛 띠가 총몸을 따라 천천히 지나감
  function gunsOf(c) {
    const out = [];
    if (c && c.isPlayer && typeof VM !== 'undefined' && VM.active && VM.gun) out.push(VM.gun);
    if (c && c.rig && c.rig.gunObj) out.push(c.rig.gunObj);
    return out.filter((g) => g.userData.skin && g.userData.skin.d.tester);
  }
  function scan(I, dur, col, slow) { I.scan = { t: 0, dur, slow }; I.U.uScanCol.value.setHex(col); I.U.uScanOn.value = 1; I.U.uScanZ.value = I.z0 - 0.05; I.g.updateWorldMatrix(true, false); I.U.uGunInv.value.copy(I.g.matrixWorld).invert(); ACTIVE.add(I); }
  function reload(c, phase) {
    for (const g of gunsOf(c)) {
      const I = g.userData.skin, kind = I.d.fx.kind, sc = sceneOf(g); if (!sc || !shown(g)) continue;
      const vm = isVM(sc), k = vm ? 1 : 2.4, P = pool(sc), m = g.userData.meta;
      if (kind === 'zero' && phase === 'start') scan(I, 0.5, 0x3ff5ff);
      else if (kind === 'chaos' && phase === 'mag') {
        const core = I.parts && I.parts.find((p) => p.core); if (core) core.outer.getWorldPosition(_q); else { _q.set(0, m.boreY, lerp(I.z0, I.z1, 0.4)); g.localToWorld(_q); }
        for (let i = 0; i < 18; i++) { _r.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(0.25 + Math.random() * 0.5); emit(P, _q, _r.x, _r.y, _r.z, pick(I.d.fx), (0.005 + Math.random() * 0.006) * k, 0.25 + Math.random() * 0.25, { drag: 3, sq: Math.random() < 0.3 }); }
        I.U.uDeploy.value = 0.8; I.coreT = 0.35; ACTIVE.add(I);
      } else if (kind === 'frontier' && phase === 'done') {
        I.flash = 0.9; ACTIVE.add(I); _q.set(0, m.boreY + 0.01, lerp(I.z0, I.z1, 0.5)); g.localToWorld(_q);
        emit(P, _q, 0, 0, 0, 0xfff0c0, 0.05 * k, 0.3, { grow: 1.4 });
        for (let i = 0; i < 8; i++) { _r.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(0.15 + Math.random() * 0.2); emit(P, _q, _r.x, _r.y, _r.z, pick(I.d.fx), (0.004 + Math.random() * 0.004) * k, 0.5, { drag: 2 }); }
      }
      if (typeof Audio !== 'undefined' && Audio.skinFx && ((kind === 'zero' && phase === 'start') || (kind === 'chaos' && phase === 'mag') || (kind === 'frontier' && phase === 'done'))) Audio.skinFx('reload', kind, c && !own(c) ? c.pos : null, own(c));
    }
  }
  // delay: 진열장처럼 꺼내기 연출이 끝난 뒤에 시작 · loop: 진열장에서 몇 초마다 다시
  function inspect(g, c, delay = 0, loop = 0) {
    const I = g && g.userData.skin; if (!I || !I.d.tester) return false;
    inspectStop(g); I.insp = { t: -delay, dur: 2.3, c, on: false, loop }; ACTIVE.add(I); return true;
  }
  function inspectStop(g) {
    const I = g && g.userData.skin; if (!I || !I.insp) return;
    if (I.insp.panel) { I.g.remove(I.insp.panel); I.insp.panel.material.dispose(); }
    if (I.insp.scan && I.scan) { I.scan = null; I.U.uScanOn.value = 0; }
    I.U.uDeploy.value = 0; I.U.uFlash.value = Math.max(0, I.flash || 0); I.insp = null;
  }
  function inspUpdate(I, dt) {
    const s = I.insp, g = I.g; s.t += dt; if (s.t < 0) return;
    const sc = sceneOf(g); if (!sc) { inspectStop(g); return; }
    const kind = I.d.fx.kind, u = s.t / s.dur, vm = isVM(sc), k = vm ? 1 : 2.4, P = pool(sc), m = g.userData.meta;
    if (!s.on) {
      s.on = true;
      if (kind === 'zero') s.panel = GunDeco.panel(g);
      if (kind === 'frontier') { scan(I, s.dur * 0.85, 0xfff0c0, true); s.scan = true; }
      if (typeof Audio !== 'undefined' && Audio.skinFx && shown(g)) Audio.skinFx('inspect', kind, s.c && !own(s.c) ? s.c.pos : null, own(s.c));
    }
    if (kind === 'zero' && s.panel) {
      const inK = clamp(u / 0.12, 0, 1), outK = clamp((1 - u) / 0.12, 0, 1), fl = Math.random() < 0.06 ? 0.4 : 1;
      s.panel.scale.set(0.16 * (0.2 + 0.8 * inK), 0.08 * inK * outK + 0.0005, 1); s.panel.material.opacity = Math.min(inK, outK) * fl;
      I.U.uFlash.value = Math.max(I.U.uFlash.value, 0.25 * Math.sin(Math.min(1, u * 2) * Math.PI));
    } else if (kind === 'chaos') {
      const pulse = 0.5 + 0.5 * Math.sin(s.t * 18), env = Math.sin(Math.min(1, u) * Math.PI);
      I.U.uDeploy.value = env * (0.6 + 0.6 * pulse);
      if (Math.random() < dt * 40 * env) { const core = I.parts && I.parts.find((p) => p.core); if (core) core.outer.getWorldPosition(_q); else { _q.set(0, m.boreY, lerp(I.z0, I.z1, 0.4)); g.localToWorld(_q); } _r.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(0.2 + Math.random() * 0.35); emit(P, _q, _r.x, _r.y, _r.z, pick(I.d.fx), (0.004 + Math.random() * 0.005) * k, 0.3, { drag: 2 }); }
    } else if (kind === 'frontier' && I.scan) {
      if (Math.random() < dt * 30) { const a = Math.random() * TAU, r = 0.02 + Math.random() * 0.03; _q.set(Math.cos(a) * r, m.boreY - 0.01 + Math.sin(a) * r, I.U.uScanZ.value); g.localToWorld(_q); emit(P, _q, 0, 0.02, 0, pick(I.d.fx), (0.004 + Math.random() * 0.004) * k, 0.6, { grow: -0.4 }); }
    }
    if (u >= 1) { const loop = s.loop, c = s.c; inspectStop(g); if (loop) inspect(g, c, loop, loop); }
  }
  // 손에서 떠난 총: 장면에 그대로 두고(지금 자리·자세) 총구부터 사라지게 한 뒤 지운다. 효과가 없는 총이면 false
  function holster(g, dur = 0.32, c = null) {
    const I = g && g.userData.skin; if (!I || !I.d.fx) return false;
    const sc = sceneOf(g); if (!sc || !shown(g)) return false;
    if (I.spin) { I.spin = null; I.spinHide = false; }   // 테스터 꺼내기 동작 중에 넣으면 그 자세 그대로 사라짐
    sc.attach(g); g.updateMatrixWorld(true); I.U.uGunInv.value.copy(g.matrixWorld).invert();
    if (I.dep) { I.dep = null; I.U.uDeploy.value = 0; setParts(I, 1); }   // 부속품은 빛 띠가 지나가며 몸체와 같이 사라짐
    // 1인칭: 화면 아래로 가라앉으며 사라짐 (총구가 멀어 앞에서부터 사라지는 게 잘 안 보이므로)
    I.sweep = { t: 0, dur, out: true, c, sink: isVM(sc) ? 0.32 : 0 }; I.U.uSweepOn.value = 1; I.U.uSweepZ.value = I.z1 + 0.05; ACTIVE.add(I);
    if (typeof Audio !== 'undefined' && Audio.skinFx) Audio.skinFx('holster', I.d.fx.kind, c && !own(c) ? c.pos : null, own(c));
    return true;
  }
  function sweepParticles(I, z, dt) {
    const g = I.g, sc = sceneOf(g); if (!sc || !shown(g)) return;
    const vm = isVM(sc), k = vm ? 1 : 2.4, fx = I.d.fx, m = g.userData.meta, P = pool(sc), n = Math.max(1, Math.round(dt * 90));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = 0.025 + Math.random() * 0.035;
      _p.set(Math.cos(a) * r, m.boreY + Math.sin(a) * r * 1.4 - 0.02, z); g.localToWorld(_p);
      _q.set(Math.cos(a) * (r + 0.05), m.boreY + Math.sin(a) * (r + 0.05) * 1.4 - 0.02, z); g.localToWorld(_q); _q.sub(_p).normalize().multiplyScalar(0.25 + Math.random() * 0.45);
      emit(P, _p, _q.x, _q.y + 0.15, _q.z, pick(fx), (0.011 + Math.random() * 0.011) * k, 0.25 + Math.random() * 0.25, { drag: 2, sq: fx.kind === 'glitch' });
    }
  }
  // 1인칭 정조준: 조준선·눈앞을 가리는 부속품(GunParts 의 sight)은 몸체 안으로 접어 넣고, 조준을 풀면 다시 편다
  function adsFold(dt) {
    const vg = typeof VM !== 'undefined' && VM.gun, I = vg && vg.userData.skin; if (!I || (!I.parts && !I.deco)) return;
    const want = typeof Cam !== 'undefined' ? Cam.ads : 0;
    I.adsK = I.adsK === undefined ? want : I.adsK + (want - I.adsK) * Math.min(1, dt * 16);
    const f = clamp(I.adsK * 1.6, 0, 1), k = f * f * (3 - 2 * f);   // 조준이 반쯤 들어오면 이미 다 접힘
    if (I.deco) for (const e of I.deco) if (e.kind === 'holo') e.mesh.material.opacity = 0.85 * (1 - k);   // 조준 장치 둘레 홀로그램은 정조준 때 사라짐
    if (!I.parts) return;
    if (k <= 0.001 && !I.folded) return;
    I.folded = k > 0.001;
    for (const p of I.parts) {
      if (!p.sight) continue;
      const base = I.dep ? p.inner.scale.x : 1;
      p.inner.scale.setScalar(Math.max(0.001, base * (1 - k)));
      if (!I.dep) p.inner.position.y = p.ring ? 0 : -0.014 * k;
    }
  }
  function update(dt) {
    CLOCK += dt; TIME.value = CLOCK % 600; FRM++; if (typeof GunDeco_T !== 'undefined') GunDeco_T.value = TIME.value;
    for (const I of ACTIVE) {
      if (I.flash > 0) { I.flash = Math.max(0, I.flash - dt * 7); I.U.uFlash.value = I.flash; }
      const s = I.sweep;
      if (s) {
        s.t += dt; const u = clamp(s.t / s.dur, 0, 1), e = u * u * (3 - 2 * u);
        const z = s.out ? lerp(I.z1 + 0.05, I.z0 - 0.05, e) : lerp(I.z0 - 0.05, I.z1 + 0.05, e);
        I.U.uSweepZ.value = z;
        if (s.sink) { I.g.position.y -= s.sink * dt / s.dur; I.g.rotation.x += 0.5 * dt / s.dur; }
        if (u < 1) sweepParticles(I, z, dt);
        else { I.U.uSweepOn.value = 0; I.sweep = null; if (s.out && I.g.parent) I.g.parent.remove(I.g); }
      }
      if (I.dep) updateDeploy(I, dt);
      if (I.spin) spinUpdate(I, dt);
      if (I.deco) for (const e of I.deco) e.mesh.visible = !I.sweep || e.zg < I.U.uSweepZ.value;   // 각인·엠블럼은 빛 띠가 지나간 만큼만
      if (I.scan) { const sc2 = I.scan; sc2.t += dt; const u2 = clamp(sc2.t / sc2.dur, 0, 1), e2 = sc2.slow ? u2 : u2 * u2 * (3 - 2 * u2); I.U.uScanZ.value = lerp(I.z0 - 0.04, I.z1 + 0.04, e2); if (u2 >= 1) { I.scan = null; I.U.uScanOn.value = 0; } }
      if (I.coreT > 0) { I.coreT -= dt; if (!I.insp) I.U.uDeploy.value = Math.max(0, I.coreT / 0.35) * 0.8; }
      if (I.insp) inspUpdate(I, dt);
      if (!I.sweep && !I.dep && !I.spin && !I.scan && !I.insp && !(I.coreT > 0) && I.flash <= 0) ACTIVE.delete(I);
    }
    idleUpdate(dt);
    adsFold(dt);
    SkinFx.update(dt);   // 맞힘·처치 효과 (입자를 내보낸 뒤 같은 프레임에 갱신)
    updateParticles(dt);
  }
  // ---------- 이름 ----------
  const short = (gun) => (ITEMS[gun] ? ITEMS[gun].name.replace(/(\s[가-힣]+)+$/, '') : gun);
  const name = (id) => { const d = GSKINS[id]; return d ? `${short(d.gun)} · ${d.name}` : ''; };
  const tracerCol = (g) => { const I = g && g.userData.skin; return I && I.d.fx ? I.d.fx.tr : 0; };
  return { apply, shot, draw, holster, update, reload, inspect, inspectStop, name, short, tracerCol, texOf, PRISM, fx: { pool, emit }, get time() { return TIME.value; }, _active: ACTIVE, _pools: POOLS, _idle: IDLE };
})();
