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
  { key: 'exclusive', name: 'EXCLUSIVE', color: '#ffcf3f', hex: 0xffcf3f },   // v20 크리스마스: 크리스마스 상자 한정 — 총(대기·살펴보기·사격·처치 효과·킬 로그) · 옷(몸 둘레 효과) · 루돌프 썰매
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
    // ---------- 크리스마스 상자 (v20): 겨울 테마 · fx = 입으면 몸 둘레 효과 (EXCLUSIVE, 05_outfitfx.js) ----------
    hat_beanie_xred: { slot: 'hat', box: 'xmas', rar: 0, name: '빨간 방울 비니', desc: '흰 방울이 달린 니트 모자', kind: 'beanie', color: 0xb3202c, pom: 0xf2f2ee },
    top_ls_xgreen: { slot: 'top', box: 'xmas', rar: 0, name: '초록 니트 긴팔', desc: '따뜻한 초록 니트', kind: 'longsleeve', color: 0x245a34, cell: 'knit', trim: 0x163a22 },
    gloves_mitten_red: { slot: 'gloves', box: 'xmas', rar: 0, name: '빨간 벙어리장갑', desc: '도톰한 니트 장갑', kind: 'full', color: 0xb3202c, cell: 'knit' },
    shoes_boots_fur: { slot: 'shoes', box: 'xmas', rar: 0, name: '털 부츠', desc: '양털 안감 겨울 부츠', kind: 'boots', color: 0x7a5232, sole: 0x2a2018 },
    top_xsweater: { slot: 'top', box: 'xmas', rar: 1, name: '눈꽃 스웨터', desc: '흰 눈꽃 띠 빨간 스웨터', kind: 'longsleeve', color: W, cell: 'xknit', trim: 0x7a1018, ico: 'pt-xknit' },
    bottom_xtrack: { slot: 'bottom', box: 'xmas', rar: 1, name: '겨울 트레이닝 바지', desc: '빨간 옆줄 흰 운동복 바지', kind: 'track', color: 0xe6e8ea, stripe: 0xc8202e },
    hat_beanie_xgreen: { slot: 'hat', box: 'xmas', rar: 1, name: '초록 방울 비니', desc: '금빛 방울 초록 니트 모자', kind: 'beanie', color: 0x245a34, pom: 0xe8c45a },
    chute_xmas: { slot: 'chute', box: 'xmas', rar: 1, name: '크리스마스 낙하산', desc: '빨강·흰·초록 칸', kind: 'ramair', colors: [0xc8202e, 0xf2f2ee, 0x2a7a3a, 0xf2f2ee] },
    top_hood_rudolph: { slot: 'top', box: 'xmas', rar: 3, name: '루돌프 후드', desc: '갈색 털 후드티', kind: 'hoodie', color: 0x7a5232, color2: 0xd8c4a8, cord: 0xc8202e },
    hat_antlers: { slot: 'hat', box: 'xmas', rar: 3, name: '루돌프 머리띠', desc: '뿔 달린 머리띠', kind: 'antlers', color: 0x8a5e38, band: 0x1d1d20 },
    bottom_xcandy: { slot: 'bottom', box: 'xmas', rar: 3, name: '캔디 케인 바지', desc: '빨강·흰 사선 줄무늬', kind: 'jeans', color: W, cell: 'xcandy', belt: 0x1b1b1b, buckle: 0xe8c45a, ico: 'pt-xcandy' },
    top_jk_xwhite: { slot: 'top', box: 'xmas', rar: 4, name: '스노우 파카', desc: '털 깃 흰 방한 파카', kind: 'jacket', color: 0xe8ecef, collar: 0xf4f2ee, collarCell: 'fleece', cuff: 0xd8dde2 },
    hat_santa: { slot: 'hat', box: 'xmas', rar: 4, name: '산타 모자', desc: '흰 털 테두리와 방울', kind: 'santa', color: 0xc41a24 },
    shoes_xelf: { slot: 'shoes', box: 'xmas', rar: 4, name: '엘프 부츠', desc: '초록 가죽 부츠', kind: 'boots', color: 0x245a34, sole: 0x1a1410 },
    top_jk_xlights: { slot: 'top', box: 'xmas', rar: 5, name: '트리 라이트 재킷', desc: '색색 전구가 빛나는 재킷', kind: 'jacket', color: W, cell: 'xlights', collar: 0x0e1a12, cuff: 0x0e1a12, zip: 0xffd65a, ico: 'pt-xlights' },
    bottom_xlights: { slot: 'bottom', box: 'xmas', rar: 5, name: '트리 라이트 바지', desc: '색색 전구가 빛나는 바지', kind: 'cargo', color: W, cell: 'xlights', belt: 0x0e1a12, buckle: 0xffd65a, ico: 'pt-xlights' },
    // EXCLUSIVE: 산타 클로스(금빛 반짝임 + 눈송이) · 겨울 여왕(빛나는 서리 결정 + 찬 기운)
    top_x_santa: { slot: 'top', box: 'xmas', rar: 8, name: 'SANTA CLAUS 코트', desc: '흰 털 깃 붉은 벨벳 코트 · 입으면 금빛 반짝임과 눈송이가 몸 둘레를 돎', kind: 'jacket', color: 0xb8141e, collar: 0xf6f4ee, collarCell: 'fleece', cuff: 0xf6f4ee, zip: 0x1a1a1a, fx: 'santa' },
    bottom_x_santa: { slot: 'bottom', box: 'xmas', rar: 8, name: 'SANTA CLAUS 바지', desc: '금 버클 검정 벨트 붉은 바지 · 금빛 반짝임', kind: 'cargo', color: 0xb8141e, belt: 0x141414, buckle: 0xf2c84a, fx: 'santa' },
    hat_x_santa: { slot: 'hat', box: 'xmas', rar: 8, name: 'SANTA CLAUS 모자', desc: '금빛 방울 산타 모자 · 금빛 반짝임', kind: 'santa', color: 0xb8141e, pom: 0xf2c84a, fx: 'santa' },
    top_x_frost: { slot: 'top', box: 'xmas', rar: 8, name: 'FROST QUEEN 코트', desc: '서리 결정이 빛나는 코트 · 입으면 빛나는 얼음 결정과 찬 기운이 몸 둘레에 맴돎', kind: 'jacket', color: W, cell: 'xfrost', collar: 0xf4f8fb, collarCell: 'fleece', cuff: 0x9fd8f0, zip: 0x9fe8ff, ico: 'pt-xfrost', fx: 'frost' },
    bottom_x_frost: { slot: 'bottom', box: 'xmas', rar: 8, name: 'FROST QUEEN 바지', desc: '서리 결정이 빛나는 바지 · 얼음 결정', kind: 'jeans', color: W, cell: 'xfrost', belt: 0x1a2a3a, buckle: 0x9fe8ff, ico: 'pt-xfrost', fx: 'frost' },

    // ---------- v23 헬멧·가방 스킨 (slot 'helmet'·'pack') ----------
    //  경기에서 주운 헬멧·가방의 겉모습만 바뀐다 — 레벨마다 다른 모양(1 통풍 헬멧 · 2 커버+고글 · 3 헤드셋+야간 투시경 / 작은 데이팩 · 몰리 배낭 · 대형 배낭)은 그대로
    //  필드(05_models_gear.js pal): color 본색 · cell 무늬 칸(옷 아틀라스 — 위장·니트·빛나는 선) · kind 본 재질(polymer·cloth·brass …) · color2 주머니·덮개
    //   strap 끈 · dark 버클·레일 등 검은 부품(darkKind) · trim 테두리(trimKind) · lens 렌즈 · roll 침낭 말이 · ribbon 리본 · pom 방울
    //   deco 장식: santa(흰 털 테·방울) · antlers(뿔·빨간 코) · lights(전구 줄) · bow(선물 리본) · frost(고드름·얼음 결정) · fx = EXCLUSIVE 몸 둘레 효과
    // 배틀로얄 상자: 전장 위장
    helm_br_wood: { slot: 'helmet', box: 'br', rar: 1, name: '산림 위장 헬멧', desc: '숲 무늬 위장 헬멧', cell: 'camoW', strap: 0x3b4129, dark: 0x23261c, trim: 0x2a2e20 },
    pack_br_desert: { slot: 'pack', box: 'br', rar: 1, name: '사막 위장 가방', desc: '모래 무늬 배낭', cell: 'camoD', strap: 0x5a4a35, dark: 0x2a2218, roll: 0x8a7350 },
    helm_br_urban: { slot: 'helmet', box: 'br', rar: 3, name: '도시 위장 헬멧', desc: '회색 도시 위장 무늬', cell: 'camoU', strap: 0x2a2c2f, dark: 0x16171a, lens: 0x3a6a8a },
    pack_br_urban: { slot: 'pack', box: 'br', rar: 3, name: '도시 위장 가방', desc: '회색 도시 위장 무늬 배낭', cell: 'camoU', strap: 0x2a2c2f, dark: 0x16171a, roll: 0x3a3d40 },
    helm_br_snow: { slot: 'helmet', box: 'br', rar: 4, name: '설원 위장 헬멧', desc: '눈밭 무늬 · 흰 끈', cell: 'camoS', strap: 0xd9dcde, dark: 0x8e9499, trim: 0xc9cdd0, lens: 0x9fd0e8 },
    pack_br_snow: { slot: 'pack', box: 'br', rar: 4, name: '설원 위장 가방', desc: '눈밭 무늬 배낭 · 흰 끈', cell: 'camoS', strap: 0xd9dcde, dark: 0x8e9499, roll: 0xe8eaec },
    helm_br_gold: { slot: 'helmet', box: 'br', rar: 5, name: '황금 전투 헬멧', desc: '금빛 광택 껍데기 · 검정 부품', kind: 'brass', color: 0xd9a93a, color2: 0x161616, strap: 0x161616, dark: 0x111111, trim: 0x111111, lens: 0xd9a93a, nvg: 0x111111, cup: 0x111111 },
    pack_br_gold: { slot: 'pack', box: 'br', rar: 5, name: '황금 전투 가방', desc: '금빛 광택 배낭 · 검정 끈 · 금 버클', cell: 'gold', color2: 0x161616, strap: 0x111111, dark: 0xe8c45c, darkKind: 'brass', roll: 0x161616 },
    // 스페셜 상자: 스트리트
    helm_sp_white: { slot: 'helmet', box: 'sp', rar: 1, name: '화이트 헬멧', desc: '깨끗한 흰 껍데기 · 검정 끈', color: 0xe8e6e0, strap: 0x1e1f22, dark: 0x1e1f22, trim: 0x2a2b2e },
    pack_sp_denim: { slot: 'pack', box: 'sp', rar: 1, name: '데님 가방', desc: '물 빠진 청 배낭 · 갈색 가죽 끈', cell: 'denim', color: 0x8ea8cc, strap: 0x5a3c26, dark: 0x3a2a1c, roll: 0x5a3c26 },
    helm_sp_pink: { slot: 'helmet', box: 'sp', rar: 3, name: '핑크 스트릿 헬멧', desc: '검정 포인트 분홍 헬멧', color: 0xe86aa2, color2: 0x26262a, strap: 0x26262a, dark: 0x26262a, trim: 0x26262a, lens: 0xff8ad0 },
    pack_sp_plaid: { slot: 'pack', box: 'sp', rar: 3, name: '체크 가방', desc: '빨강·검정 버펄로 체크 배낭', cell: 'plaid', color2: 0x1e1e20, strap: 0x1e1e20, dark: 0x111111, roll: 0x1e1e20 },
    helm_sp_wave: { slot: 'helmet', box: 'sp', rar: 4, name: '네온 웨이브 헬멧', desc: '분홍 물결이 빛나는 헬멧', cell: 'glowP', strap: 0x1b151a, dark: 0x111111, lens: 0xff4fd0 },
    pack_sp_wave: { slot: 'pack', box: 'sp', rar: 4, name: '네온 웨이브 가방', desc: '분홍 물결이 빛나는 배낭', cell: 'glowP', strap: 0x1b151a, dark: 0x111111, roll: 0x1b151a },
    helm_sp_neon: { slot: 'helmet', box: 'sp', rar: 5, name: '네온 사이버 헬멧', desc: '회로처럼 빛나는 선', cell: 'glowC', strap: 0x111317, dark: 0x111317, lens: 0x46f2ff, nvg: 0x111317 },
    pack_sp_neon: { slot: 'pack', box: 'sp', rar: 5, name: '네온 사이버 가방', desc: '회로처럼 빛나는 선이 흐르는 배낭', cell: 'glowC', strap: 0x111317, dark: 0x111317, roll: 0x111317 },
    // 보급 상자: 엘리트
    helm_sup_dig: { slot: 'helmet', box: 'sup', rar: 1, name: '디지털 위장 헬멧', desc: '픽셀 무늬 위장 헬멧', cell: 'camoDig', strap: 0x2e3023, dark: 0x1c1d16 },
    pack_sup_dig: { slot: 'pack', box: 'sup', rar: 1, name: '디지털 위장 가방', desc: '픽셀 무늬 위장 배낭', cell: 'camoDig', strap: 0x2e3023, dark: 0x1c1d16, roll: 0x4b5134 },
    helm_sup_tiger: { slot: 'helmet', box: 'sup', rar: 3, name: '타이거 스트라이프 헬멧', desc: '호랑이 줄무늬 위장', cell: 'camoTiger', strap: 0x2b2b21, dark: 0x1a1a14 },
    pack_sup_tiger: { slot: 'pack', box: 'sup', rar: 3, name: '타이거 스트라이프 가방', desc: '호랑이 줄무늬 위장 배낭', cell: 'camoTiger', strap: 0x2b2b21, dark: 0x1a1a14, roll: 0x46503c },
    helm_sup_red: { slot: 'helmet', box: 'sup', rar: 4, name: '레드 엘리트 헬멧', desc: '붉은 껍데기 · 금 테두리', color: 0x9b1c22, color2: 0x5a1014, strap: 0x1d1d1d, dark: 0x1d1d1d, trim: 0xd8b04a, trimKind: 'brass', lens: 0xd8b04a },
    pack_sup_red: { slot: 'pack', box: 'sup', rar: 4, name: '레드 엘리트 가방', desc: '붉은 배낭 · 금 버클', color: 0x8a1a20, color2: 0x5e1216, strap: 0x1d1d1d, dark: 0xd8b04a, darkKind: 'brass', roll: 0x2a1012 },
    helm_sup_chrome: { slot: 'helmet', box: 'sup', rar: 5, name: '크롬 강화 헬멧', desc: '육각 판에 주황 빛이 흐르는 헬멧', cell: 'glowO', strap: 0x1d2024, dark: 0x1d2024, lens: 0xff8a1e, nvg: 0x1d2024 },
    pack_sup_chrome: { slot: 'pack', box: 'sup', rar: 5, name: '크롬 강화 가방', desc: '육각 판에 주황 빛이 흐르는 배낭', cell: 'glowO', strap: 0x1d2024, dark: 0x111214, roll: 0x1d2024 },
    // 크리스마스 상자: 겨울 (EXCLUSIVE = 산타 헬멧 · 프로스트 가방)
    helm_x_knit: { slot: 'helmet', box: 'xmas', rar: 0, name: '빨간 니트 헬멧', desc: '털실로 뜬 빨간 커버', cell: 'knit', color: 0xb3202c, strap: 0xf2f2ee, dark: 0x2a1012 },
    pack_x_knit: { slot: 'pack', box: 'xmas', rar: 0, name: '초록 니트 가방', desc: '털실로 뜬 초록 배낭 · 빨간 끈', cell: 'knit', color: 0x245a34, strap: 0xb3202c, dark: 0x163a22, roll: 0xb3202c },
    helm_x_snowflake: { slot: 'helmet', box: 'xmas', rar: 1, name: '눈꽃 헬멧', desc: '흰 눈꽃 띠 빨간 니트 커버', cell: 'xknit', strap: 0xf2efe6, dark: 0x7a1018 },
    pack_x_gift: { slot: 'pack', box: 'xmas', rar: 1, name: '선물 포장 가방', desc: '금 리본을 두른 빨간 선물 상자', color: 0xc8202e, color2: 0xa8182a, strap: 0x2a7a3a, dark: 0x1a1a1a, deco: 'bow', ribbon: 0xe8c45a, roll: 0x2a7a3a },
    helm_x_rudolph: { slot: 'helmet', box: 'xmas', rar: 3, name: '루돌프 헬멧', desc: '뿔 달린 갈색 헬멧 · 빛나는 빨간 코', kind: 'cloth', color: 0x7a5232, color2: 0x5e3e24, strap: 0xc8202e, dark: 0x2a1c12, deco: 'antlers' },
    pack_x_candy: { slot: 'pack', box: 'xmas', rar: 3, name: '캔디 케인 가방', desc: '빨강·흰 사선 줄무늬 배낭', cell: 'xcandy', strap: 0xc8141e, dark: 0x1a1a1a, roll: 0xf4f0e8 },
    helm_x_santa: { slot: 'helmet', box: 'xmas', rar: 4, name: '산타 헬멧', desc: '흰 털 테두리와 방울 꼬리', cell: 'knit', color: 0xc41a24, strap: 0xf4f2ee, dark: 0x2a1012, deco: 'santa' },
    pack_x_sack: { slot: 'pack', box: 'xmas', rar: 4, name: '산타 선물 자루', desc: '흰 털 테 · 금 버클 붉은 자루', color: 0xb8141e, color2: 0x9a1018, strap: 0x141414, dark: 0xf2c84a, darkKind: 'brass', deco: 'santa', roll: 0xf4f2ee },
    helm_x_lights: { slot: 'helmet', box: 'xmas', rar: 5, name: '트리 라이트 헬멧', desc: '색색 전구와 금빛 별이 빛나는 헬멧', cell: 'xlights', strap: 0x0e1a12, dark: 0x0e1a12, deco: 'lights' },
    pack_x_lights: { slot: 'pack', box: 'xmas', rar: 5, name: '트리 라이트 가방', desc: '색색 전구 줄이 빛나는 배낭', cell: 'xlights', strap: 0x0e1a12, dark: 0x0e1a12, deco: 'lights', roll: 0x13281a },
    helm_x_santa8: { slot: 'helmet', box: 'xmas', rar: 8, name: 'SANTA CLAUS 헬멧', desc: '금빛 방울 산타 헬멧 · 쓰면 금빛 반짝임과 눈송이가 몸 둘레를 돎', cell: 'knit', color: 0xb8141e, strap: 0xf6f4ee, dark: 0x1a1a1a, trim: 0xf2c84a, trimKind: 'brass', lens: 0xf2c84a, pom: 0xf2c84a, deco: 'santa', fx: 'santa' },
    pack_x_frost8: { slot: 'pack', box: 'xmas', rar: 8, name: 'FROST QUEEN 가방', desc: '서리 결정이 빛나는 배낭 · 메면 얼음 결정과 찬 기운이 몸 둘레에 맴돎', cell: 'xfrost', strap: 0x1a2a3a, dark: 0x9fe8ff, darkKind: 'metal', deco: 'frost', roll: 0x9fd8f0, fx: 'frost' },
  };
  // 기본 옷도 레어도(기본)를 갖는다
  for (const k of ['top_basic', 'bottom_basic', 'shoes_basic', 'chute_basic']) Body.SKINS[k].rar = 0;
  Object.assign(Body.SKINS, S);
})();
// 레어도 이름·색
const rarOf = (n) => RARITY[clamp(n | 0, 0, RARITY.length - 1)];
