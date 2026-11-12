// ============================================================
// 04_skins.js — 옷 스킨 목록(창고·상점 뽑기) + 레어도
//  · 레어도 6단계: 기본(회색) · 희귀(초록) · 레어(파랑 — 재화 등급) · 초희귀(보라) · 슈퍼레어(핑크) · 울트라레어(빨강) + 테스터(민트 무지개 — 베타 테스터 전용 총기 스킨)
//  · box: 이 옷이 나오는 상자 (br 배틀로얄 · sp 스페셜 · sup 보급). 상자끼리 겹치는 옷은 없다
//  · kind·color·cell 등은 04_body.js 생성기 인수. ico: 창고·결과 카드 아이콘 색(무늬는 SVG 패턴 id)
// ============================================================
const RARITY = [
  { key: 'common', name: '기본', color: '#a3a8ad', hex: 0xa3a8ad },
  { key: 'uncommon', name: '희귀', color: '#5ec46e', hex: 0x5ec46e },
  { key: 'rare', name: '레어', color: '#4d8fff', hex: 0x4d8fff },
  { key: 'epic', name: '초희귀', color: '#a46bff', hex: 0xa46bff },
  { key: 'super', name: '슈퍼레어', color: '#ff5fb4', hex: 0xff5fb4 },
  { key: 'ultra', name: '울트라레어', color: '#ff3d3d', hex: 0xff3d3d },
  { key: 'tester', name: '테스터', color: '#3ff5d6', hex: 0x3ff5d6 },   // v20: 베타 테스터 전용 (개발자가 칭호를 부여한 계정만, 상자·교환소·봇에 없음)
  { key: 'epsilon', name: '엡실론', color: '#c084fc', hex: 0xc084fc },   // v20: EPSILON — THE ABSOLUTE. 울트라레어 위 최상위 (엡실론 금고 · 교환소). 전용 디자인·꺼내기·살펴보기·처치 효과·획득 컷신
];
(() => {
  const W = 0xffffff;
  const S = {
    // ---------- 배틀로얄 상자: 전장 ----------
    top_tee_sand: { slot: 'top', box: 'br', rar: 0, name: '사막색 티셔츠', desc: '모래색 면 반팔', kind: 'tee', color: 0xb59e78 },
    bottom_cargo_gray: { slot: 'bottom', box: 'br', rar: 0, name: '회색 카고 바지', desc: '주머니 많은 작업 바지', kind: 'cargo', color: 0x6c6f71, belt: 0x232323 },
    shoes_boots_black: { slot: 'shoes', box: 'br', rar: 0, name: '검정 전투화', desc: '끈 묶는 검정 가죽 부츠', kind: 'boots', color: 0x26272a, sole: 0x141414 },
    hat_beanie_olive: { slot: 'hat', box: 'br', rar: 0, name: '올리브 비니', desc: '접어 올린 니트 모자', kind: 'beanie', color: 0x4f5638 },
    top_tee_camo_w: { slot: 'top', box: 'br', rar: 1, name: '산림 위장 티셔츠', desc: '숲 무늬 반팔', kind: 'tee', color: W, cell: 'camoW', rib: 0x3b4129, ico: 'pt-camoW' },
    bottom_cargo_camo_d: { slot: 'bottom', box: 'br', rar: 1, name: '사막 위장 바지', desc: '모래 무늬 카고 바지', kind: 'cargo', color: W, cell: 'camoD', belt: 0x5a4a35, ico: 'pt-camoD' },
    hat_boonie_camo: { slot: 'hat', box: 'br', rar: 1, name: '정글 부니햇', desc: '넓은 챙 위장 모자', kind: 'boonie', color: W, cell: 'camoW', band: 0x3b4129, ico: 'pt-camoW' },
    gloves_tac_coyote: { slot: 'gloves', box: 'br', rar: 1, name: '코요테 전술 장갑', desc: '손등 보호대가 달린 장갑', kind: 'tac', color: 0x8a7352, pad: 0x4a3c2a },
    chute_camo: { slot: 'chute', box: 'br', rar: 1, name: '위장 낙하산', desc: '숲 색 세 줄 낙하산', kind: 'ramair', colors: [0x4e5636, 0x6a6a44, 0x3b4129] },
    top_ls_black: { slot: 'top', box: 'br', rar: 3, name: '특수부대 전술복', desc: '가슴 주머니·어깨 패치 긴팔', kind: 'longsleeve', color: 0x25282c, trim: 0x15171a, pockets: 1 },
    bottom_cargo_camo_u: { slot: 'bottom', box: 'br', rar: 3, name: '도시 위장 바지', desc: '무릎 보호대 회색 위장 바지', kind: 'cargo', color: W, cell: 'camoU', knee: 1, kneeCol: 0x2a2c2f, kneeCell: 'leather', belt: 0x1b1b1b, ico: 'pt-camoU' },
    top_jk_snow: { slot: 'top', box: 'br', rar: 4, name: '설원 위장 재킷', desc: '눈밭 무늬 방한 재킷', kind: 'jacket', color: W, cell: 'camoS', collar: 0xd9dcde, collarCell: 'fleece', ico: 'pt-camoS' },
    bottom_cargo_snow: { slot: 'bottom', box: 'br', rar: 4, name: '설원 위장 바지', desc: '눈밭 무늬 카고 바지', kind: 'cargo', color: W, cell: 'camoS', knee: 1, kneeCol: 0xc9cdd0, belt: 0x8e9499, ico: 'pt-camoS' },
    top_jk_gold: { slot: 'top', box: 'br', rar: 5, name: '황금 전투 재킷', desc: '금빛 광택 재킷 · 검정 깃', kind: 'jacket', color: W, cell: 'gold', collar: 0x161616, cuff: 0x161616, zip: 0x111111, ico: 'pt-gold' },
    bottom_cargo_gold: { slot: 'bottom', box: 'br', rar: 5, name: '황금 전투 바지', desc: '금빛 광택 카고 바지', kind: 'cargo', color: W, cell: 'gold', knee: 1, kneeCol: 0x161616, kneeCell: 'leather', belt: 0x111111, buckle: 0xe8c45c, ico: 'pt-gold' },
    // ---------- 스페셜 상자: 스트리트 ----------
    top_tee_white: { slot: 'top', box: 'sp', rar: 0, name: '흰 티셔츠', desc: '깨끗한 흰 반팔', kind: 'tee', color: 0xe6e4de },
    bottom_jeans_light: { slot: 'bottom', box: 'sp', rar: 0, name: '연청 바지', desc: '물 빠진 청바지', kind: 'jeans', color: 0x8ea8cc, belt: 0x3a2a1c, ico: 'pt-denim' },
    shoes_sneak_white: { slot: 'shoes', box: 'sp', rar: 0, name: '흰 운동화', desc: '흰 캔버스 운동화', kind: 'sneakers', color: 0xeeeeea, color2: 0xdcdcd6 },
    hat_cap_black: { slot: 'hat', box: 'sp', rar: 0, name: '검정 야구모자', desc: '앞챙이 둥근 캡', kind: 'cap', color: 0x1e1f22 },
    top_tee_stripe: { slot: 'top', box: 'sp', rar: 1, name: '줄무늬 티셔츠', desc: '남색 가로줄 반팔', kind: 'tee', color: W, cell: 'stripe', rib: 0x1f2b4a, ico: 'pt-stripe' },
    top_ls_plaid: { slot: 'top', box: 'sp', rar: 1, name: '체크 셔츠', desc: '빨강·검정 버펄로 체크', kind: 'longsleeve', color: W, cell: 'plaid', trim: 0x2a0f10, collar: 0xb03036, ico: 'pt-plaid' },
    bottom_track_navy: { slot: 'bottom', box: 'sp', rar: 1, name: '남색 트레이닝 바지', desc: '흰 옆줄 운동복 바지', kind: 'track', color: 0x1f2a44, stripe: 0xf2f2ee },
    shoes_high_red: { slot: 'shoes', box: 'sp', rar: 1, name: '빨간 하이탑', desc: '발목까지 오는 캔버스화', kind: 'sneakers', high: 1, color: 0xb3262b, color2: 0xf2f2ee },
    chute_rainbow: { slot: 'chute', box: 'sp', rar: 1, name: '무지개 낙하산', desc: '일곱 빛깔 칸', kind: 'ramair', colors: [0xd63a35, 0xe8862a, 0xf0cf3a, 0x4caf50, 0x2f7fd6, 0x3f3fb5, 0x8e44ad] },
    top_hood_gray: { slot: 'top', box: 'sp', rar: 3, name: '회색 후드티', desc: '캥거루 주머니 후드', kind: 'hoodie', color: 0x8b8e92, color2: 0x7a7d81 },
    bottom_jeans_black: { slot: 'bottom', box: 'sp', rar: 3, name: '검정 스키니 진', desc: '날씬한 검정 청바지', kind: 'jeans', color: 0x2b2c30, belt: 0x111111, buckle: 0xc0c4c8 },
    top_hood_pink: { slot: 'top', box: 'sp', rar: 4, name: '핑크 스트릿 후드', desc: '검정 포인트 분홍 후드', kind: 'hoodie', color: 0xe86aa2, color2: 0x26262a, cord: 0x26262a },
    shoes_sneak_neon: { slot: 'shoes', box: 'sp', rar: 4, name: '네온 운동화', desc: '빛나는 밑창 운동화', kind: 'sneakers', color: 0x1c1d22, color2: 0x2a2b31, sole: W, soleCell: 'glowC', out: 0x111111 },
    top_jk_neon: { slot: 'top', box: 'sp', rar: 5, name: '네온 사이버 재킷', desc: '회로처럼 빛나는 선', kind: 'jacket', color: W, cell: 'glowC', collar: 0x111317, cuff: 0x111317, zip: 0x46f2ff, ico: 'pt-glowC' },
    bottom_neon: { slot: 'bottom', box: 'sp', rar: 5, name: '네온 사이버 바지', desc: '회로처럼 빛나는 바지', kind: 'jeans', color: W, cell: 'glowC', belt: 0x111317, buckle: 0x46f2ff, ico: 'pt-glowC' },
    // ---------- 보급 상자: 엘리트 ----------
    top_tank_olive: { slot: 'top', box: 'sup', rar: 0, name: '국방색 민소매', desc: '팔이 드러나는 면 셔츠', kind: 'tank', color: 0x4b5134 },
    bottom_shorts_sand: { slot: 'bottom', box: 'sup', rar: 0, name: '모래색 반바지', desc: '주머니 달린 반바지', kind: 'shorts', color: 0xa48d68, belt: 0x3a2e22 },
    hat_bandana_black: { slot: 'hat', box: 'sup', rar: 0, name: '검정 두건', desc: '뒤로 묶는 천 두건', kind: 'bandana', color: 0x1d1d20 },
    shoes_boots_desert: { slot: 'shoes', box: 'sup', rar: 0, name: '사막 전투화', desc: '모래색 스웨이드 부츠', kind: 'boots', color: 0xa88e64, sole: 0x5a4a35 },
    top_jk_flight: { slot: 'top', box: 'sup', rar: 1, name: '비행 재킷', desc: '털 깃 올리브 항공 점퍼', kind: 'jacket', color: 0x46503c, collar: 0x8a6a48, collarCell: 'fleece', cuff: 0x2e3328 },
    gloves_leather: { slot: 'gloves', box: 'sup', rar: 1, name: '가죽 장갑', desc: '부드러운 갈색 가죽', kind: 'full', color: 0x5a3c26, cell: 'leather' },
    bottom_cargo_dig: { slot: 'bottom', box: 'sup', rar: 1, name: '디지털 위장 바지', desc: '픽셀 무늬 카고 바지', kind: 'cargo', color: W, cell: 'camoDig', belt: 0x2e3023, ico: 'pt-camoDig' },
    chute_supply: { slot: 'chute', box: 'sup', rar: 1, name: '보급 낙하산', desc: '주황·흰색 보급품 낙하산', kind: 'ramair', colors: [0xd65a1e, 0xe9e2cf] },
    top_ls_dig: { slot: 'top', box: 'sup', rar: 3, name: '디지털 위장 전술복', desc: '픽셀 무늬 긴팔 전투복', kind: 'longsleeve', color: W, cell: 'camoDig', trim: 0x2e3023, pockets: 1, ico: 'pt-camoDig' },
    bottom_cargo_tiger: { slot: 'bottom', box: 'sup', rar: 3, name: '타이거 스트라이프 바지', desc: '호랑이 줄무늬 위장', kind: 'cargo', color: W, cell: 'camoTiger', belt: 0x2b2b21, ico: 'pt-camoTiger' },
    gloves_fingerless: { slot: 'gloves', box: 'sup', rar: 3, name: '반장갑', desc: '손가락 끝이 나온 장갑', kind: 'fingerless', color: 0x222326 },
    hat_beret_red: { slot: 'hat', box: 'sup', rar: 4, name: '레드 베레모', desc: '금 배지 붉은 베레모', kind: 'beret', color: 0x9b1c22, badge: 0xd8b04a },
    chute_gold: { slot: 'chute', box: 'sup', rar: 4, name: '황금 낙하산', desc: '금빛 광택 낙하산', kind: 'ramair', colors: [0xd9a93a, 0x1a1a1a], metal: 1, edge: 0x2a2010 },
    top_jk_chrome: { slot: 'top', box: 'sup', rar: 5, name: '크롬 강화 슈트', desc: '육각 판에 주황 빛이 흐르는 상의', kind: 'jacket', color: W, cell: 'glowO', collar: 0x1d2024, cuff: 0x1d2024, zip: 0xff8a1e, ico: 'pt-glowO' },
    bottom_chrome: { slot: 'bottom', box: 'sup', rar: 5, name: '크롬 강화 하의', desc: '육각 판 강화 바지', kind: 'cargo', color: W, cell: 'glowO', knee: 1, kneeCol: 0x1d2024, kneeCell: 'leather', belt: 0x111214, buckle: 0xff8a1e, ico: 'pt-glowO' },
  };
  // 기본 옷도 레어도(기본)를 갖는다
  for (const k of ['top_basic', 'bottom_basic', 'shoes_basic', 'chute_basic']) Body.SKINS[k].rar = 0;
  Object.assign(Body.SKINS, S);
})();
// 레어도 이름·색
const rarOf = (n) => RARITY[clamp(n | 0, 0, RARITY.length - 1)];
