// ============================================================
// 10_ui_profile.js — 계정 꾸미기 (v20): 프로필 사진 · 테두리 · 칭호 · 계정 정보 창 · 로비 칭호 표시
//  · 사진: 기본 4장 + 레벨이 오르면 하나씩 해금 (모두 SVG 로 직접 그림 — 외부 그림 없음)
//  · 테두리: 기본 + 랭크 티어 10종(최고 도달 티어까지 해금, 티어가 높을수록 화려하고 움직임) + 칭호 테두리
//  · 칭호: 수집가(울트라레어 스킨 3종 이상) · 전쟁의 신(승률 20% 초과, 10판 이상) · 마스터 이상 티어 칭호(최고 도달 티어)
//  · 저장: STATS.prof = { av, fr, ti } — 로그인하면 서버(player_data.stats)에 같이 저장
//    파티원에게는 myLook().pf 로 전해져 로비에서 파티원 캐릭터 아래에도 칭호가 나온다
//  · 아이디 변경: 3일에 한 번 (서버 함수 change_username — supabase/profile.sql, 서버에서도 3일 제한)
// ============================================================
const Prof = (() => {
  // ---------- 프로필 사진 (64×64, 바탕 그라데이션 + 흰 그림) ----------
  // Level 0 (백룸 12가지 탈출 이벤트 보상): 한 점 투시 복도 — 천장 타일 · 형광등 · 노란 벽지 줄무늬 · 눅눅한 카펫 · 어두운 출입구
  //  복도 끝 벽 x 24..40 · y 24..38. 왼쪽 벽 위 모서리 y = x · 아래 모서리 y = 64 - x·26/24 (오른쪽 벽은 좌우 대칭)
  const L0_SVG = (() => {
    const f = (v) => +v.toFixed(2), top = (x) => (x <= 32 ? x : 64 - x), bot = (x) => (x <= 32 ? 64 - x * 26 / 24 : 64 - (64 - x) * 26 / 24);
    const door = (x0, x1, k) => `M${x0} ${f(top(x0) + (bot(x0) - top(x0)) * k)}L${x1} ${f(top(x1) + (bot(x1) - top(x1)) * k)}V${f(bot(x1))}L${x0} ${f(bot(x0))}z`;
    const pt = (t, u) => `${f(32 + u * (32 - 24 * t))} ${f(24 * t)}`, quad = (t0, t1, u) => `M${pt(t0, -u)}L${pt(t0, u)}L${pt(t1, u)}L${pt(t1, -u)}z`;
    let stripe = '', tile = '', lamp = '', halo = '';
    for (let i = 1; i <= 9; i++) { const x = 24 * (1 - Math.pow(0.78, i)); stripe += `M${f(x)} ${f(top(x))}V${f(bot(x))}M${f(64 - x)} ${f(top(x))}V${f(bot(64 - x))}`; }
    for (const x of [8, 16, 24, 40, 48, 56]) tile += `M${x} 0L${f(24 + x / 4)} 24`;
    for (let i = 1; i <= 6; i++) { const y = 24 * (1 - Math.pow(0.6, i)); tile += `M${f(y)} ${f(y)}H${f(64 - y)}`; }
    for (const [t0, t1] of [[0.08, 0.26], [0.46, 0.56], [0.68, 0.75], [0.81, 0.845], [0.885, 0.905]]) { lamp += quad(t0, t1, 0.25); halo += quad(Math.max(0, t0 - 0.03), t1 + 0.03, 0.42); }
    return '<defs><linearGradient id="l0c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efc8"/><stop offset="1" stop-color="#d6c98a"/></linearGradient>'
      + '<linearGradient id="l0f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#66541e"/><stop offset="1" stop-color="#a48e44"/></linearGradient>'
      + '<radialGradient id="l0v" cx="50%" cy="48%" r="64%"><stop offset=".5" stop-color="#140f02" stop-opacity="0"/><stop offset="1" stop-color="#140f02" stop-opacity=".62"/></radialGradient>'
      + '<filter id="l0b" x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>'
      + '<path d="M0 0H64L40 24H24z" fill="url(#l0c)"/><path d="M0 64H64L40 38H24z" fill="url(#l0f)"/>'
      + '<path d="M0 0L24 24V38L0 64z" fill="#d8c262"/><path d="M64 0L40 24V38L64 64z" fill="#c9b153"/><path d="M24 24H40V38H24z" fill="#b9a24a"/>'
      + `<path d="${stripe}" fill="none" stroke="#8a7424" stroke-width=".55" opacity=".45"/><path d="${tile}" fill="none" stroke="#a89a5c" stroke-width=".45" opacity=".6"/>`
      + `<path d="${door(17, 19.6, 0.3)}" fill="#5a4a16"/><path d="${door(45.5, 51.5, 0.3)}" fill="#3e3210"/><path d="M29.6 29.2H34.4V38H29.6z" fill="#342a0c"/>`
      + '<path d="M14 64L27.5 38M50 64L36.5 38" fill="none" stroke="#5a4a18" stroke-width=".5" opacity=".4"/><ellipse cx="21" cy="56" rx="7" ry="2.1" fill="#4e3f12" opacity=".35"/><ellipse cx="41.5" cy="46.5" rx="3.6" ry="1.1" fill="#4e3f12" opacity=".3"/>'
      + `<path d="${halo}" fill="#fff6c8" opacity=".6" filter="url(#l0b)"/><path d="${lamp}" fill="#fffdf2"/><rect width="64" height="64" fill="url(#l0v)"/>`;
  })();
  const AV = [
    { id: 'helmet', name: '전투모', lv: 1, bg: ['#5c6b4a', '#2d3626'], svg: '<path d="M12 40c0-15 9-25 22-25s20 9 20 22v3H12z"/><path d="M8 40h50v5H8z"/><path d="M20 45l-3 9h4l4-9z" opacity=".7"/><path d="M22 25c4-4 9-6 14-6" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>' },
    { id: 'scope', name: '조준선', lv: 1, bg: ['#4b5560', '#20262c'], svg: '<circle cx="32" cy="32" r="17" fill="none" stroke="#fff" stroke-width="3"/><path d="M32 8v14M32 42v14M8 32h14M42 32h14" stroke="#fff" stroke-width="3"/><circle cx="32" cy="32" r="3"/>' },
    { id: 'chute', name: '낙하산', lv: 1, bg: ['#3d7aa8', '#173a58'], svg: '<path d="M10 28c2-12 12-18 22-18s20 6 22 18c-3-3-7-3-9 0-3-3-8-3-11 0-3-3-8-3-11 0-3-3-8-3-13 0z"/><path d="M12 28l18 22M52 28L34 50M24 28l7 22M40 28l-7 22" stroke="#fff" stroke-width="1.6" fill="none"/><rect x="29" y="47" width="6" height="9" rx="2"/>' },
    { id: 'compass', name: '나침반', lv: 1, bg: ['#7a6a48', '#3a3020'], svg: '<circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="3"/><path d="M32 14l6 18-6 18-6-18z"/><path d="M32 14l6 18H26z" fill="#ff5a4a"/>' },
    { id: 'ammo', name: '탄약', lv: 3, bg: ['#8a6a2a', '#3e2c0c'], svg: '<g><path d="M17 26c0-6 3-11 5-13 2 2 5 7 5 13v26H17z"/><path d="M29 22c0-6 3-11 5-13 2 2 5 7 5 13v30H29z"/><path d="M41 26c0-6 3-11 5-13 2 2 5 7 5 13v26H41z"/></g><path d="M15 46h38v3H15z" fill="#3e2c0c" opacity=".55"/>' },
    { id: 'wolf', name: '늑대', lv: 6, bg: ['#5a6676', '#222831'], svg: '<path d="M14 12l10 14h16l10-14 2 22-8 10-12 12-12-12-8-10z"/><path d="M25 34l5 3-5 1zM39 34l-5 3 5 1z" fill="#222831"/><path d="M29 46h6l-3 4z" fill="#222831"/>' },
    { id: 'eagle', name: '독수리', lv: 9, bg: ['#a0662c', '#432508'], svg: '<path d="M12 44c4-16 14-28 30-28 6 0 10 3 12 7l-8 3c-2-2-5-2-7 0l-3 6 9 2-11 4-8 10z"/><circle cx="43" cy="22" r="2" fill="#432508"/><path d="M50 23l6 4-8 1z" fill="#ffd36b"/>' },
    { id: 'mask', name: '방독면', lv: 12, bg: ['#3e5a52', '#14231f'], svg: '<path d="M14 26c0-9 8-14 18-14s18 5 18 14v10c0 9-8 16-18 16S14 45 14 36z"/><circle cx="24" cy="29" r="6" fill="#14231f"/><circle cx="40" cy="29" r="6" fill="#14231f"/><circle cx="24" cy="29" r="3" fill="#6fe0c8" opacity=".8"/><circle cx="40" cy="29" r="3" fill="#6fe0c8" opacity=".8"/><rect x="26" y="42" width="12" height="12" rx="3" fill="#14231f"/><path d="M28 45h8M28 48h8M28 51h8" stroke="#fff" stroke-width="1.2" opacity=".6"/>' },
    { id: 'flame', name: '불꽃', lv: 16, bg: ['#c2402a', '#4a0c06'], svg: '<path d="M32 8c3 10 14 15 14 29 0 10-6 18-14 18s-14-8-14-18c0-7 4-11 6-15 1 5 3 7 5 8-1-8 1-15 3-22z"/><path d="M32 30c2 5 7 7 7 14 0 5-3 8-7 8s-7-3-7-8c0-4 3-6 4-8 1 2 2 3 3 3 0-4-1-6 0-9z" fill="#ffcf5a"/>' },
    { id: 'crown', name: '왕관', lv: 20, bg: ['#9a7a1a', '#3a2a02'], svg: '<path d="M10 22l10 10 12-18 12 18 10-10-5 26H15z"/><path d="M15 48h34v6H15z"/><circle cx="32" cy="36" r="3.5" fill="#ff4a5a"/><circle cx="21" cy="40" r="2.5" fill="#5ab8ff"/><circle cx="43" cy="40" r="2.5" fill="#5ab8ff"/>' },
    { id: 'bolt', name: '번개', lv: 25, bg: ['#5a3ab8', '#1a0c4a'], svg: '<path d="M36 6L14 36h14l-6 22 24-32H32z"/><path d="M36 6L14 36h14" fill="none" stroke="#c7b8ff" stroke-width="1.5"/>' },
    { id: 'nova', name: '초신성', lv: 30, bg: ['#1a1440', '#05030f'], svg: '<path d="M32 6l4 20 20 6-20 6-4 20-4-20-20-6 20-6z" fill="#fff"/><path d="M32 18l2 12 12 2-12 2-2 12-2-12-12-2 12-2z" fill="#ffd36b"/><circle cx="14" cy="14" r="1.6"/><circle cx="52" cy="50" r="1.4"/><circle cx="50" cy="14" r="1"/>' },
    // 베타 테스터 전용 (개발자가 칭호를 부여한 계정): 실험 플라스크 속 β
    { id: 'beta', name: '베타 테스터', lv: 1, beta: true, bg: ['#0f5560', '#03151b'], svg: '<path d="M23 8h18v4h-3v13l12 21c2 4-1 9-5 9H19c-4 0-7-5-5-9l12-21V12h-3z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 45l8-13h14l8 13c1 3-1 5-3 5H20c-2 0-4-2-3-5z" fill="#3ff5d6"/><circle cx="28" cy="38" r="1.6" fill="#fff"/><circle cx="37" cy="42" r="1.2" fill="#fff"/><text x="32" y="49" font-size="13" font-weight="900" text-anchor="middle" fill="#03151b" font-family="Arial,sans-serif">β</text><path d="M50 10l1.5 3.5L55 15l-3.5 1.5L50 20l-1.5-3.5L45 15l3.5-1.5z"/>' },
    // THE BACKROOMS 탈출 이벤트 보상 (10_event.js): 어둠 속에서 빛나는 눈과 이빨 가득한 웃음 — 엔티티 '스마일러'
    { id: 'smiler', name: '스마일러', lv: 1, ev: 'brx', bg: ['#1a1608', '#000000'], svg: '<defs><filter id="smGl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#smGl)"><path d="M14 24c3-5 9-6 13-2-4 3-9 4-13 2z"/><path d="M50 24c-3-5-9-6-13-2 4 3 9 4 13 2z"/><circle cx="20" cy="22.6" r="1.6" fill="#000"/><circle cx="44" cy="22.6" r="1.6" fill="#000"/><path d="M8 33c7 13 41 13 48 0-2 9-11 17-24 17S10 42 8 33z"/><path d="M11 35.5l2.6 5 2.6-4 2.6 6 2.6-5 2.6 6.4 2.6-5.6 2.6 6.6 2.6-5.6 2.6 6.4 2.6-5 2.6 6 2.6-4 2.6 5 2.6-6" fill="none" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 43l3-3 3 4 3-4 3 4 3-4 3 4 3-4 3 4 3-4 3 4 3-3" fill="none" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></g>' },
    // 백룸 완전 탈출(12가지) 이벤트 보상 (10_event.js): Level 0 — 끝없이 이어지는 노란 벽지 복도
    { id: 'level0', name: 'Level 0', lv: 1, ev: 'brx12', bg: ['#e4d27c', '#6a5a1e'], svg: L0_SVG },
  ];
  const avOf = (id) => AV.find((a) => a.id === id) || AV[0];
  function avatarSVG(id) {
    const a = avOf(id), g = 'pg' + a.id;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${g}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/></radialGradient></defs><rect width="64" height="64" fill="url(#${g})"/><g fill="#f4efe2">${a.svg}</g></svg>`;
  }

  // ---------- 테두리 ----------
  //  kind: base · tier(t = RANK_TIERS 번호, 최고 도달 티어 이상이면 해금) · title(그 칭호를 얻으면 해금)
  const FR = [
    { id: 'none', name: '기본', kind: 'base', desc: '처음부터' },
    ...['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'legend', 'eternal', 'nova', 'celestial', 'eclipse', 'zenith'].map((id, t) => ({ id, name: '', kind: 'tier', t, desc: '' })),   // v23: 상위 티어 4종 (pfx — 새 효과 테두리)
    { id: 'collector', name: '수집가', kind: 'title', title: 'collector', desc: '칭호 「수집가」' },
    { id: 'wargod', name: '전쟁의 신', kind: 'title', title: 'wargod', desc: '칭호 「전쟁의 신」' },
    // 하드코어 랭크 상위 3티어 (최고 도달 기준) · 베타 테스터
    ...[2, 3, 4].map((t) => ({ id: 'hc_' + HC_TIERS[t].id, name: HC_TIERS[t].name, kind: 'hc', t, desc: `하드코어 ${HC_TIERS[t].name} 도달` })),
    { id: 'beta', name: '베타 테스터', kind: 'title', title: 'beta', desc: '칭호 「베타 테스터」(개발자 부여)' },
    // 배틀패스 플러스 전용 테두리 2종
    { id: 'bp_plus', name: '패스 플러스', kind: 'title', title: 'bp_plus', desc: '칭호 「패스 플러스」(배틀패스 플러스 1단계)' },
    { id: 'bp_s1', name: '시즌 1 정복자', kind: 'title', title: 'bp_s1', desc: '칭호 「시즌 1 정복자」(배틀패스 플러스 50단계)' },
    // 랭킹 1위 (10_ranking.js) — 1위를 빼앗기면 회수
    { id: 'champ_lv', name: '정점의 베테랑', kind: 'title', title: 'champ_lv', desc: '레벨 랭킹 1위 (빼앗기면 회수)' },
    { id: 'champ_tier', name: '랭크 챔피언', kind: 'title', title: 'champ_tier', desc: '랭크 티어 랭킹 1위 (빼앗기면 회수)' },
    { id: 'champ_hc', name: '하드코어 패왕', kind: 'title', title: 'champ_hc', desc: '하드코어 랭킹 1위 (빼앗기면 회수)' },
    // 콜라보 이벤트 (10_event.js): THE BACKROOMS 탈출 — 노란 벽지 고리 + 위의 형광등 + 아래 스마일러 웃음
    { id: 'br_escape', name: '백룸 탈출자', kind: 'title', title: 'br_escape', desc: '칭호 「백룸 탈출자」(THE BACKROOMS 탈출 이벤트)' },
    // 백룸 완전 탈출 (12가지) — 노란 벽지 고리 + 양옆 초록 비상등 12개 + 위의 EXIT 표지 + 아래 12/12 명판
    { id: 'br_all', name: '백룸 정복자', kind: 'title', title: 'br_all', desc: '칭호 「백룸 정복자」(백룸 12가지 탈출 이벤트)' },
    // v24.2 우로보로스 — ‘영원과 순환’: 은빛 비늘 뱀이 제 꼬리를 무는 고리 + 형광빛 깜빡임 + 바깥 글자 고리 (백룸 숨겨진 칭호 「광인」과 함께)
    { id: 'madman', name: '우로보로스', kind: 'title', title: 'madman', desc: '백룸의 숨겨진 칭호 「???」' },
  ];
  for (const f of FR) if (f.kind === 'tier') { f.name = RANK_TIERS[f.t].name; f.desc = `랭크 ${RANK_TIERS[f.t].name} 도달`; }
  // 장식(테두리 위·옆에 붙는 그림, viewBox -16..80) — 높은 티어일수록 많아짐
  const gemAt = (x, y, r, c) => `<path d="M${x} ${y - r}l${r * 0.8} ${r}-${r * 0.8} ${r}-${r * 0.8}-${r}z" fill="${c}" stroke="#fff" stroke-width=".8"/>`;
  const ORN = {
    gold: `<circle cx="32" cy="1" r="3.2" fill="#ffd36b" stroke="#7a4e05"/><circle cx="32" cy="63" r="3.2" fill="#ffd36b" stroke="#7a4e05"/><circle cx="1" cy="32" r="3.2" fill="#ffd36b" stroke="#7a4e05"/><circle cx="63" cy="32" r="3.2" fill="#ffd36b" stroke="#7a4e05"/>`,
    platinum: gemAt(32, 1, 5, '#7ff0e0') + gemAt(9, 9, 3.5, '#5fc9bd') + gemAt(55, 9, 3.5, '#5fc9bd') + gemAt(9, 55, 3.5, '#5fc9bd') + gemAt(55, 55, 3.5, '#5fc9bd'),
    diamond: `<path d="M32 -9l9 9-9 11-9-11z" fill="#9fd4ff" stroke="#fff" stroke-width="1"/><path d="M23 0h18" stroke="#fff" stroke-width=".8"/>` + gemAt(0, 32, 5, '#5aa8f2') + gemAt(64, 32, 5, '#5aa8f2'),
    master: `<path d="M2 26c-9-6-16-4-18 4 6-2 10 0 12 4-6 0-9 3-9 7 5-3 10-3 15 0z" fill="#a45cf0" stroke="#e4ccff" stroke-width="1"/><path d="M62 26c9-6 16-4 18 4-6-2-10 0-12 4 6 0 9 3 9 7-5-3-10-3-15 0z" fill="#a45cf0" stroke="#e4ccff" stroke-width="1"/><path d="M32 -10l8 10-8 9-8-9z" fill="#d6a8ff" stroke="#fff" stroke-width="1"/>`,
    grandmaster: Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, x = 32 + Math.cos(a) * 38, y = 32 + Math.sin(a) * 38, x1 = 32 + Math.cos(a - 0.16) * 30, y1 = 32 + Math.sin(a - 0.16) * 30, x2 = 32 + Math.cos(a + 0.16) * 30, y2 = 32 + Math.sin(a + 0.16) * 30; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}z" fill="#e8384a" stroke="#ffb3a0" stroke-width=".7"/>`; }).join(''),
    legend: `<path d="M18 -4l7 8 7-12 7 12 7-8-3 14H21z" fill="#ffd36b" stroke="#9a6a08" stroke-width="1.2"/><circle cx="32" cy="-1" r="2" fill="#ff4a5a"/><path d="M0 30c-10-8-18-4-19 4 7-3 11 0 13 3-7 1-10 4-10 8 6-3 11-3 16 0z" fill="#ffe08a" stroke="#9a6a08" stroke-width="1"/><path d="M64 30c10-8 18-4 19 4-7-3-11 0-13 3 7 1 10 4 10 8-6-3-11-3-16 0z" fill="#ffe08a" stroke="#9a6a08" stroke-width="1"/>`,
    eternal: `<path d="M17 -6l8 9 7-14 7 14 8-9-3 16H20z" fill="#e8d4ff" stroke="#7a3cff" stroke-width="1.2"/><circle cx="32" cy="-4" r="2.4" fill="#fff"/><path d="M-2 28c-11-10-20-5-21 4 8-4 13 0 15 3-8 1-11 5-11 9 7-4 13-4 18 0z" fill="#c58cff" stroke="#fff" stroke-width="1"/><path d="M66 28c11-10 20-5 21 4-8-4-13 0-15 3 8 1 11 5 11 9-7-4-13-4-18 0z" fill="#c58cff" stroke="#fff" stroke-width="1"/>`,
    collector: ['#5ec46e', '#4d8fff', '#a46bff', '#ff5fb4', '#ff3d3d', '#ffd36b'].map((c, i) => { const a = -Math.PI / 2 + i / 6 * Math.PI * 2; return gemAt(32 + Math.cos(a) * 32, 32 + Math.sin(a) * 32, 4.6, c); }).join(''),
    wargod: `<path d="M-6 66L52 8l4 4L-2 70z" fill="#d8d8d8" stroke="#5d0712" stroke-width="1"/><path d="M70 66L12 8l-4 4 58 58z" fill="#d8d8d8" stroke="#5d0712" stroke-width="1"/><path d="M50 4l10 0-2 6zM14 4H4l2 6z" fill="#e8384a"/><path d="M-9 63l8 8M73 63l-8 8" stroke="#7a2a1a" stroke-width="4" stroke-linecap="round"/>`,
  };
  // 하드코어: 슬레이어 = 엇갈린 칼날 · 리퍼 = 위에 걸친 낫과 녹빛 혼불 · 오버로드 = 뿔 왕관과 불꽃 / 베타 테스터 = 회로 마디 + 아래 β 명판
  ORN.hc_slayer = `<path d="M-8 70L50 4l5 4L-3 74z" fill="#e6e9eb" stroke="#4a0610" stroke-width="1"/><path d="M72 70L14 4l-5 4 58 66z" fill="#e6e9eb" stroke="#4a0610" stroke-width="1"/><path d="M-11 66l9 9M75 66l-9 9" stroke="#2b2321" stroke-width="5" stroke-linecap="round"/><path d="M32 -9l7 9-7 9-7-9z" fill="#ff3352" stroke="#ffd6d6" stroke-width="1"/>`;
  ORN.hc_reaper = `<path d="M-4 18C2 -6 30 -14 52 -6c-14-2-30 2-40 14z" fill="#9aa8a2" stroke="#4dffa6" stroke-width="1.2"/><path d="M12 8L60 70" stroke="#2a2a2e" stroke-width="3.2" stroke-linecap="round"/><circle cx="66" cy="20" r="3.2" fill="#4dffa6"/><circle cx="-2" cy="46" r="2.4" fill="#4dffa6"/><circle cx="58" cy="60" r="2" fill="#4dffa6"/>`;
  ORN.hc_overlord = Array.from({ length: 7 }, (_, i) => { const a = -Math.PI / 2 + (i - 3) * 0.32, L = 14 - Math.abs(i - 3) * 2, x = 32 + Math.cos(a) * 30, y = 32 + Math.sin(a) * 30, x2 = 32 + Math.cos(a) * (30 + L), y2 = 32 + Math.sin(a) * (30 + L), px = -Math.sin(a) * 3.2, py = Math.cos(a) * 3.2; return `<path d="M${(x - px).toFixed(1)} ${(y - py).toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${(x + px).toFixed(1)} ${(y + py).toFixed(1)}z" fill="#2a0800" stroke="#ff9a2e" stroke-width="1"/>`; }).join('') + `<circle cx="32" cy="-6" r="3" fill="#ffb02e"/>`;
  ORN.beta = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2, x = 32 + Math.cos(a) * 34, y = 32 + Math.sin(a) * 34, x2 = 32 + Math.cos(a) * 40, y2 = 32 + Math.sin(a) * 40; return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#3ff5d6" stroke-width="1.6"/><rect x="${(x2 - 2.2).toFixed(1)}" y="${(y2 - 2.2).toFixed(1)}" width="4.4" height="4.4" fill="#e9fffb" stroke="#0f5560" stroke-width=".6"/>`; }).join('') + `<path d="M18 62h28l5 6-5 6H18l-5-6z" fill="#03151b" stroke="#3ff5d6" stroke-width="1.4"/><text x="32" y="71.5" font-size="9" font-weight="900" text-anchor="middle" fill="#3ff5d6" font-family="Arial,sans-serif">β TESTER</text>`;
  // 배틀패스: 패스 플러스 = 위의 금빛 ＋ 명판과 양옆 화살 무늬 · 시즌 1 정복자 = 월계수와 별
  ORN.bp_plus = `<path d="M22 -12h20l4 8-4 8H22l-4-8z" fill="#ffd36b" stroke="#6b4a08" stroke-width="1.2"/><path d="M32 -9v10M27 -4h10" stroke="#3a2504" stroke-width="2.4" stroke-linecap="round"/><path d="M-6 22l6 4-6 4zM-6 34l6 4-6 4zM70 22l-6 4 6 4zM70 34l-6 4 6 4z" fill="#ffb347"/>`;
  ORN.bp_s1 = [-1, 1].map((s) => [0, 1, 2, 3, 4].map((i) => { const a = Math.PI / 2 + s * (0.5 + i * 0.36), x = 32 + Math.cos(a) * 36, y = 32 + Math.sin(a) * 36; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6" ry="2.6" transform="rotate(${(a * 180 / Math.PI + s * 55).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#ffe08a" stroke="#8a5a08" stroke-width=".8"/>`; }).join('')).join('') + `<path d="M32 -14l3.4 7.4 8 .9-6 5.4 1.7 7.9-7.1-4.1-7.1 4.1 1.7-7.9-6-5.4 8-.9z" fill="#fff3c4" stroke="#b07a10" stroke-width="1.1"/>`;
  // 랭킹 1위: 정점의 베테랑 = 위의 '1' 메달 + 양옆 월계수(초록·금) · 랭크 챔피언 = 보석 박힌 왕관 + 양옆 날개 + 아래 '1ST' 띠 · 하드코어 패왕 = 휘어 오른 두 뿔 + 붉은 '1' 보석 + 아래 가시
  const laurel = (col, edge) => [-1, 1].map((s) => [0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 2 + s * (0.42 + i * 0.3), x = 32 + Math.cos(a) * 37, y = 32 + Math.sin(a) * 37; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.4" ry="2.8" transform="rotate(${(a * 180 / Math.PI + s * 62).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${col}" stroke="${edge}" stroke-width=".8"/>`; }).join('')).join('');
  const medal1 = (cy, fill, edge, txt) => `<circle cx="32" cy="${cy}" r="9.5" fill="${fill}" stroke="${edge}" stroke-width="1.6"/><circle cx="32" cy="${cy}" r="7" fill="none" stroke="#fff" stroke-width=".7" opacity=".7"/><text x="32" y="${cy + 4.2}" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="12" fill="${txt}">1</text>`;
  ORN.champ_lv = laurel('#6fd36a', '#1d5a1a') + `<path d="M24 -6l-6 -9h8l6 7zM40 -6l6 -9h-8l-6 7z" fill="#2fa84a" stroke="#0e3a14" stroke-width=".8"/>` + medal1(-3, '#ffd36b', '#7a4e05', '#3a2402');
  ORN.champ_tier = [-1, 1].map((s) => `<path d="M${32 + s * 30} 22c${s * 10}-8 ${s * 19}-7 ${s * 22}-1-${s * 6}-1-${s * 9} 1-${s * 11} 4 ${s * 6}-1 ${s * 10} 0 ${s * 12} 3-${s * 7} 0-${s * 12} 2-${s * 15} 6z" fill="#7ad7ff" stroke="#fff" stroke-width=".9"/>`).join('')
    + `<path d="M16 6l-2-15 9 7 9-12 9 12 9-7-2 15z" fill="#ffd36b" stroke="#7a4e05" stroke-width="1.2"/><circle cx="32" cy="-14" r="2.6" fill="#fff"/><path d="M32 -2l3.6 4-3.6 4-3.6-4z" fill="#c084fc" stroke="#fff" stroke-width=".7"/><circle cx="21" cy="1" r="1.8" fill="#7ad7ff"/><circle cx="43" cy="1" r="1.8" fill="#7ad7ff"/>`
    + `<path d="M14 62h36l-4 6 4 6H14l4-6z" fill="#5a2aa8" stroke="#ffd36b" stroke-width="1.1"/><text x="32" y="71.5" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="8.5" fill="#fff3c4" letter-spacing=".6">1ST</text>`;
  ORN.champ_hc = [-1, 1].map((s) => `<path d="M${32 + s * 20} 6C${32 + s * 30} -2 ${32 + s * 34} -10 ${32 + s * 30} -16C${32 + s * 40} -8 ${32 + s * 40} 6 ${32 + s * 28} 14z" fill="#2a1414" stroke="#ff3352" stroke-width="1.3"/><path d="M${32 + s * 27} -4l${s * 3} -2" stroke="#ff8a3c" stroke-width="1.2"/>`).join('')
    + [-2, -1, 0, 1, 2].map((i) => { const x = 32 + i * 9, h = 9 - Math.abs(i) * 2; return `<path d="M${x - 3.2} 63l3.2 ${h}l3.2-${h}z" fill="#1a0a0a" stroke="#ff3352" stroke-width=".9"/>`; }).join('')
    + `<path d="M32 -12l9 9-9 10-9-10z" fill="#c4203a" stroke="#ffb02e" stroke-width="1.3"/><text x="32" y="-0.6" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="10" fill="#fff">1</text>`;
  ORN.br_escape = `<rect x="12" y="-12" width="40" height="7" rx="3.5" fill="#fffbe0" stroke="#8a7a2a" stroke-width="1.1"/><rect x="15" y="-10.4" width="34" height="3.8" rx="1.9" fill="#ffffff"/><path d="M20 -5l-4 7M44 -5l4 7" stroke="#6a5a1a" stroke-width="1.1"/>`
    + `<path d="M18 63c4 7 24 7 28 0-2 5-8 9-14 9s-12-4-14-9z" fill="#0b0904" stroke="#fffbe0" stroke-width="1.1"/><path d="M20 64.5l2 2.6 2-2.2 2 2.8 2-2.4 2 3 2-2.6 2 3 2-2.4 2 2.8 2-2.2 2 2.6 2-2.2" fill="none" stroke="#fffbe0" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M-4 30c3-2 6-2 8 0-3 1-6 1-8 0zM60 30c2-2 5-2 8 0-2 1-5 1-8 0z" fill="#fffbe0"/>`;
  ORN.br_all = [40, 60, 80, 100, 120, 140, -40, -60, -80, -100, -120, -140].map((d) => { const a = (d - 90) * Math.PI / 180, x = 32 + Math.cos(a) * 37.5, y = 32 + Math.sin(a) * 37.5; return `<rect x="${(x - 3.3).toFixed(1)}" y="${(y - 1.6).toFixed(1)}" width="6.6" height="3.2" rx="1.3" transform="rotate(${d} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#dcffcc" stroke="#2f7a2a" stroke-width=".8"/>`; }).join('')
    + `<rect x="15" y="-15.5" width="34" height="12" rx="2" fill="#0c3a16" stroke="#8dff9a" stroke-width="1.3"/><text x="29" y="-6.2" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="9" fill="#c4ffbe" letter-spacing=".7">EXIT</text><path d="M39.5 -9.5h5.5m-2.2 -2.6 2.6 2.6-2.6 2.6" fill="none" stroke="#c4ffbe" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M14 62h36l-4 6 4 6H14l4-6z" fill="#2a2208" stroke="#f4e07a" stroke-width="1.1"/><text x="32" y="71.3" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="8.4" fill="#fff3b0" letter-spacing=".5">12 / 12</text>`;
  // v24.2 우로보로스 ('영원과 순환' — 칭호 「광인」 테두리): 은빛 비늘 뱀이 고리를 이루며 제 꼬리를 문다
  //  몸: 아래 오른쪽 목에서 화면상 시계 반대 방향으로 한 바퀴 돌아 꼬리 끝이 아래 왼쪽에서 입속으로 · 두께는 목 8.2 → 꼬리 2.4
  //  배 쪽 어두운 띠 위에 비늘 세 줄(안·바깥·등)을 꼬리부터 그려 머리 쪽 비늘이 위에 겹친다 · 등줄기를 따라 도는 빛(순환)
  //  머리: 아래 가운데에서 꼬리 쪽(왼쪽)을 보고 벌린 두 턱으로 꼬리를 문다 · 노란 세로 동공(백룸 형광빛) · 바깥 글자 고리와 점선 고리는 반대로 천천히 돎
  //  비늘 모양·그라데이션·글자 경로는 index.html 전역 defs(oro-*)
  ORN.madman = (() => {
    const C = 32, R = 28.6, GAP = 0.64, a0 = Math.PI / 2 - GAP / 2, SPAN = Math.PI * 2 - GAP, Y = C + R;
    // 움직임 줄이기(prefers-reduced-motion): SMIL 은 CSS 로 못 멈추므로 아예 넣지 않는다
    const SM = (x) => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? '' : x);
    const ang = (u) => a0 - u * SPAN, thick = (u) => 8.2 - 5.8 * Math.pow(u, 1.2), f = (v) => v.toFixed(2);
    const P = (u, dr) => { const a = ang(u), r = R + dr; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
    // 배 쪽 띠 (바깥 가장자리 → 안쪽 가장자리)
    const out = [], inn = []; for (let i = 0; i <= 60; i++) { const u = i / 60, t = thick(u) / 2; out.push(P(u, t)); inn.push(P(u, -t)); }
    let s = `<path d="M${out.map((p) => f(p[0]) + ' ' + f(p[1])).join('L')}L${inn.reverse().map((p) => f(p[0]) + ' ' + f(p[1])).join('L')}z" fill="#101215" stroke="#020304" stroke-width=".7"/>`;
    // 비늘: 꼬리(u = 1)부터 목 쪽으로 — 안쪽·바깥 줄은 어둡게, 등 줄은 밝게 (모양은 #oro-k: 길이 1 · 폭 1, +x 가 꼬리 쪽)
    const N = 46, scale = (u, dr, w, L, g) => { const [x, y] = P(u, dr), a = ang(u), deg = (Math.atan2(-Math.cos(a), Math.sin(a)) * 180) / Math.PI; return `<use href="#oro-k" fill="url(#${g})" transform="translate(${f(x)} ${f(y)}) rotate(${deg.toFixed(1)}) scale(${f(L)} ${f(w)})"/>`; };
    for (let i = N; i >= 0; i--) {
      const u = Math.min(1, i / N), t = thick(u), L = (SPAN * R / N) * 1.75 * (0.65 + 0.35 * (1 - u)), half = Math.min(1, (i + 0.5) / N);
      if (u < 0.985) s += scale(half, -t * 0.3, t * 0.42, L * 0.9, 'oro-s2') + scale(half, t * 0.3, t * 0.42, L * 0.9, 'oro-s2');
      s += scale(u, 0, t * 0.5, L, 'oro-s');
    }
    // 등줄기를 따라 도는 빛 (목 → 꼬리, 계속)
    const arc = `M${f(P(0, 0)[0])} ${f(P(0, 0)[1])}A${R} ${R} 0 1 0 ${f(P(1, 0)[0])} ${f(P(1, 0)[1])}`;
    s += `<path class="oro-glint" d="${arc}" fill="none" stroke="#fffdf0" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="6 200" opacity=".9">${SM('<animate attributeName="stroke-dashoffset" from="206" to="0" dur="3.4s" repeatCount="indefinite"/>')}</path>`;
    // 머리 (화면 좌표 · 바깥 = 아래 +y, 안쪽 = 위 −y): 위턱(바깥)이 길고 아래턱(안쪽)이 꼬리 위를 누름
    const hy = (d) => f(Y + d);
    s += `<path d="M40.2 ${hy(-4.5)}C36.4 ${hy(-6.6)} 30.6 ${hy(-5.6)} 25.4 ${hy(-2.9)}L30.6 ${hy(-1.4)}L31 ${hy(0.9)}L24.2 ${hy(1.9)}C28.4 ${hy(6.6)} 35.6 ${hy(6.9)} 40.2 ${hy(4.5)}C43.4 ${hy(3.2)} 43.4 ${hy(-3.2)} 40.2 ${hy(-4.5)}z" fill="url(#oro-h)" stroke="#05070a" stroke-width=".8"/>`;
    s += `<path d="M38.8 ${hy(-3.6)}C35.6 ${hy(-5.2)} 31.6 ${hy(-4.6)} 28.4 ${hy(-3)}M38.6 ${hy(3.7)}C35 ${hy(5.6)} 30.6 ${hy(5)} 27 ${hy(2.6)}" fill="none" stroke="#3a4046" stroke-width=".6"/>`;   // 턱 비늘 결
    s += [[26.2, -2.6], [27.8, -2.0], [29.3, -1.6]].map(([x, d]) => `<path d="M${x} ${hy(d)}l.55 1.5.55-1.6z" fill="#fff"/>`).join('') + [[25.2, 1.8], [26.9, 1.3], [28.5, 1.05]].map(([x, d]) => `<path d="M${x} ${hy(d)}l.55-1.5.55 1.55z" fill="#fff"/>`).join('');   // 송곳니
    s += `<path d="M37.6 ${hy(-4.9)}C35.6 ${hy(-5.6)} 33 ${hy(-5.2)} 31.2 ${hy(-4.1)}" fill="none" stroke="#05070a" stroke-width="1.1" stroke-linecap="round"/>`;   // 눈두덩
    s += `<ellipse cx="34.4" cy="${hy(-2.9)}" rx="1.9" ry="1.35" fill="url(#oro-eye)" stroke="#05070a" stroke-width=".5"/><ellipse cx="34.4" cy="${hy(-2.9)}" rx=".38" ry="1.15" fill="#120d02"/><circle cx="33.7" cy="${hy(-3.4)}" r=".35" fill="#fff"/>`;
    s += `<circle cx="26.9" cy="${hy(-2.1)}" r=".35" fill="#05070a"/>`;   // 콧구멍
    // 바깥 층: 점선 고리(시간의 흐름)와 글자 고리 「시작은 끝 · 끝은 시작」 — 서로 반대로 천천히 돎 (작은 크기에선 숨김)
    s += `<g class="oro-echo"><circle cx="32" cy="32" r="34.6" fill="none" stroke="#ffe27a" stroke-width=".55" stroke-dasharray="1.1 2.6" opacity=".5"/>${SM('<animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="26s" repeatCount="indefinite"/>')}</g>`;
    s += `<g class="oro-txt"><text font-size="3.5" font-weight="800" textLength="236" lengthAdjust="spacing" fill="#e6dcae" opacity=".8" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif"><textPath href="#oro-c">${'시작은 끝 · 끝은 시작 · '.repeat(3)}</textPath></text>${SM('<animateTransform attributeName="transform" type="rotate" from="0 32 32" to="-360 32 32" dur="48s" repeatCount="indefinite"/>')}</g>`;
    return s;
  })();
  const ORN_FX = { br_escape: '<i class="pf-scan"></i>', br_all: '<i class="pf-rays br"></i>', champ_lv: '<i class="pf-rays lv"></i>', champ_tier: '<i class="pf-rays"></i><i class="pf-orb"></i><i class="pf-orb b"></i>', champ_hc: '<i class="pf-rays hc"></i>', eternal: '<i class="pf-orb"></i><i class="pf-orb b"></i>', grandmaster: '', legend: '<i class="pf-rays"></i>', hc_overlord: '<i class="pf-rays hc"></i>', beta: '<i class="pf-scan"></i>' };
  // ---------- v23 상위 티어 테두리 (노바 · 셀레스티얼 · 이클립스 · 제니스) — 기존 테두리와 다른 새 효과 묶음 'pfx' ----------
  //  뒤: 천천히 도는 색 후광(px-aura) · 영문 이름이 새겨져 도는 고리(px-sig — 작은 크기에선 숨김)
  //  사진 위: 비스듬히 훑고 지나가는 빛(px-sheen) / 고리 위: 금속 고리를 따라 도는 반사광(px-glint)
  //  앞: 꼬리 달린 혜성 둘(px-orbit — 바깥은 시계 방향, 안쪽은 반대) · 번갈아 반짝이는 별 넷(px-spk) · 장식 선을 따라 흐르는 빛(px-flow)
  //  장식(관·날개·아래 장식)의 그라데이션은 index.html 전역 defs(pxg-*) · 글자 고리 경로는 #pxc
  const f1 = (v) => v.toFixed(1);
  // 끝이 뾰족한 수정 조각: (x,y)에서 a 방향으로 길이 L, 반폭 w
  const shard = (x, y, a, L, w, fill, edge = '#e9fbff') => {
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c, p = (k, m) => `${f1(x + c * L * k + nx * w * m)} ${f1(y + s * L * k + ny * w * m)}`;
    return `<path d="M${p(0, 1)}L${p(0.62, 0.9)}L${p(1, 0)}L${p(0.62, -0.9)}L${p(0, -1)}z" fill="${fill}" stroke="${edge}" stroke-width=".7"/>`;
  };
  // 깃털(잎) 모양: 밑동 (x,y)에서 a 방향으로 L, 폭 w
  const leaf = (x, y, a, L, w, fill, edge) => {
    const tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L, mx = (x + tx) / 2, my = (y + ty) / 2, nx = -Math.sin(a), ny = Math.cos(a);
    return `<path d="M${f1(x)} ${f1(y)}Q${f1(mx + nx * w)} ${f1(my + ny * w)} ${f1(tx)} ${f1(ty)}Q${f1(mx - nx * w * 0.4)} ${f1(my - ny * w * 0.4)} ${f1(x)} ${f1(y)}z" fill="${fill}" stroke="${edge}" stroke-width=".6"/>`;
  };
  const mirror = (s) => `${s}<g transform="translate(64 0) scale(-1 1)">${s}</g>`;   // 왼쪽 그림을 오른쪽에도
  const flow = (d) => `<path class="px-flow" d="${d}"/>`;
  const gemD = (x, y, r, fill) => `<path d="M${f1(x)} ${f1(y - r)}l${f1(r * 0.8)} ${f1(r)}-${f1(r * 0.8)} ${f1(r)}-${f1(r * 0.8)}-${f1(r)}z" fill="${fill}" stroke="#fff" stroke-width=".7"/>`;
  const star4 = (x, y, r, fill) => `<path d="M${f1(x)} ${f1(y - r)}l${f1(r * 0.25)} ${f1(r * 0.75)} ${f1(r * 0.75)} ${f1(r * 0.25)}-${f1(r * 0.75)} ${f1(r * 0.25)}-${f1(r * 0.25)} ${f1(r * 0.75)}-${f1(r * 0.25)}-${f1(r * 0.75)}-${f1(r * 0.75)}-${f1(r * 0.25)} ${f1(r * 0.75)}-${f1(r * 0.25)}z" fill="${fill}"/>`;
  // 노바: 수정 조각 관 + 양옆 수정 칼날 + 아래 보석
  ORN.nova = shard(25, 6, -Math.PI / 2 - 0.5, 14, 2.6, 'url(#pxg-nova)') + shard(39, 6, -Math.PI / 2 + 0.5, 14, 2.6, 'url(#pxg-nova)') + shard(32, 4, -Math.PI / 2, 20, 3.5, 'url(#pxg-nova)')
    + mirror(shard(5, 21, -2.5, 21, 2.7, 'url(#pxg-nova)') + shard(3, 28, -2.95, 19, 2.5, 'url(#pxg-nova)') + shard(4, 36, 2.8, 14, 2.2, 'url(#pxg-nova)') + flow('M5 21l-17-12M3 28l-18-4'))
    + flow('M32 4V-15M25 6l-6.5-12M39 6l6.5-12') + gemD(32, 4, 4, '#bff3ff') + gemD(32, 64, 4.2, '#8fe3ff') + star4(32, 64, 2.2, '#fff');
  // 셀레스티얼: 금빛 후광 + 여섯 깃 천사 날개(두 겹) + 아래 별
  ORN.celestial = mirror(Array.from({ length: 6 }, (_, i) => leaf(6 - i * 0.2, 19 + i * 3, -2.2 - i * 0.24, 26 - i * 2, 5.2, i % 2 ? 'url(#pxg-cel)' : '#fffdf3', '#a8780a')).join('')
      + Array.from({ length: 4 }, (_, i) => leaf(5, 33 + i * 3, 2.75 + i * 0.16, 16 - i * 1.6, 4, '#fff6dc', '#a8780a')).join('') + flow('M6 19l-15-14M5 28l-19-6'))
    + `<ellipse cx="32" cy="-7" rx="16" ry="4.4" fill="none" stroke="#fff6d0" stroke-width="5" opacity=".35"/><ellipse cx="32" cy="-7" rx="16" ry="4.4" fill="none" stroke="url(#pxg-cel)" stroke-width="2.4"/>`
    + `<ellipse class="px-flow" cx="32" cy="-7" rx="16" ry="4.4"/>` + gemD(32, 1, 4, '#a9d8ff') + star4(32, 65, 6, '#fffbe8') + star4(32, 65, 2.6, '#ffd76a');
  // 이클립스: 위에 검은 태양(코로나 가시 + 다이아몬드 반지 섬광) + 양옆 흑요석 불꽃 칼날 + 아래 가시
  ORN.eclipse = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2 + 0.1, L = i % 2 ? 5 : 8.5, x = 32 + Math.cos(a) * 6.5, y = -5 + Math.sin(a) * 6.5; return shard(x, y, a, L, 1.7, '#ff4a1e', 'none') + shard(x, y, a, L * 0.55, 1.1, '#ffd27a', 'none'); }).join('')
    + mirror(shard(5, 22, -2.45, 21, 2.8, 'url(#pxg-ecl)', '#ff5a2a') + shard(3, 29, -2.9, 20, 2.6, 'url(#pxg-ecl)', '#ff5a2a') + shard(4, 37, 2.75, 15, 2.3, 'url(#pxg-ecl)', '#ff5a2a') + flow('M5 22l-16-13M3 29l-19-5'))
    + `<circle cx="32" cy="-5" r="7" fill="#050102" stroke="#ffcf6a" stroke-width="1.2"/>` + star4(37.2, -9.6, 4.4, '#fffaf0')
    + shard(32, 61, Math.PI / 2, 13, 2.6, 'url(#pxg-ecl)', '#ff5a2a') + shard(26, 60, Math.PI / 2 + 0.5, 9, 2, 'url(#pxg-ecl)', '#ff5a2a') + shard(38, 60, Math.PI / 2 - 0.5, 9, 2, 'url(#pxg-ecl)', '#ff5a2a') + gemD(32, 60, 3.4, '#ff3b1f');
  // 제니스: 무지개 후광 + 보석 박힌 큰 왕관 + 무지개 칼날·금빛 깃털 이중 날개 + 아래 ZENITH 명판
  ORN.zenith = mirror(shard(4, 24, -2.55, 25, 2.8, 'url(#pxg-prism)', '#ffffff') + shard(2, 31, -2.95, 22, 2.6, 'url(#pxg-prism)', '#ffffff')
      + Array.from({ length: 5 }, (_, i) => leaf(6, 22 + i * 3.2, -2.35 - i * 0.26, 21 - i * 2.2, 3, i % 2 ? '#fffdf3' : 'url(#pxg-zen)', '#9a6a08')).join('') + flow('M4 24l-19-14M2 31l-21-4'))
    + `<circle cx="32" cy="-5" r="12" fill="none" stroke="url(#pxg-prism)" stroke-width="2.2"/>`
    + `<path d="M18 5l-3-14 8 6 9-12 9 12 8-6-3 14z" fill="url(#pxg-zen)" stroke="#7a4e05" stroke-width="1"/>` + flow('M18 5l-3-14 8 6 9-12 9 12 8-6-3 14z')
    + `<circle cx="15" cy="-9" r="1.9" fill="#fff"/><circle cx="32" cy="-15" r="2.2" fill="#fff"/><circle cx="49" cy="-9" r="1.9" fill="#fff"/>` + gemD(32, 0, 3.8, '#ff9bf0') + gemD(23.5, 1.5, 2.4, '#7fe0ff') + gemD(40.5, 1.5, 2.4, '#7fe0ff')
    + `<path d="M15 62h34l-4 5.5 4 5.5H15l4-5.5z" fill="#2a1060" stroke="#ffd76a" stroke-width="1.1"/><text x="32" y="69.6" text-anchor="middle" font-family="Saira Condensed,Arial Narrow,Arial,sans-serif" font-weight="900" font-size="7" fill="#fff3c4" letter-spacing=".9">ZENITH</text>`;
  const PXF = {};
  for (const id of ['nova', 'celestial', 'eclipse', 'zenith']) { const en = RANK_TIERS.find((T) => T.id === id).en, n = Math.max(3, Math.round(50 / (en.length + 3))); PXF[id] = `<i class="px-aura"></i><i class="px-sig"><svg viewBox="0 0 100 100" aria-hidden="true"><text><textPath href="#pxc">${(en + ' ✦ ').repeat(n)}</textPath></text></svg></i>`; }
  const PX_TOP = '<i class="px-glint"></i><i class="px-orbit"><b></b></i><i class="px-orbit b"><b></b></i><i class="px-spk s1"></i><i class="px-spk s2"></i><i class="px-spk s3"></i><i class="px-spk s4"></i>';
  function frameHTML(fr, av, size = 44, extra = '') {
    const f = FR.find((x) => x.id === fr) || FR[0], o = ORN[f.id], px = PXF[f.id];
    return `<span class="pf fr-${f.id}${px ? ' pfx' : ''}${size < 46 ? ' pf-sm' : ''}${extra ? ' ' + extra : ''}" style="--s:${size}px">${px || ORN_FX[f.id] || ''}<span class="pf-av">${avatarSVG(av)}</span>${px ? '<i class="px-sheen"></i>' : ''}<span class="pf-ring"></span>${f.id === 'grandmaster' ? '<span class="pf-spk"><svg viewBox="-16 -16 96 96">' + o + '</svg></span>' : o ? `<span class="pf-orn"><svg viewBox="-16 -16 96 96">${o}</svg></span>` : ''}${px ? PX_TOP : ''}</span>`;
  }

  // ---------- 칭호 ----------
  const ultraOwned = () => {
    let n = 0;
    for (const id of STATS.skins || []) if (Body.SKINS[id] && Body.SKINS[id].rar === 5) n++;
    for (const id of STATS.vskins || []) if (typeof VSKINS !== 'undefined' && VSKINS[id] && (VSKINS[id].rar === 5 || VSKINS[id].rar === 7)) n++;
    for (const id of STATS.gskins || []) if (typeof GSKINS !== 'undefined' && GSKINS[id] && (GSKINS[id].rar === 5 || GSKINS[id].rar === 7)) n++;   // 엡실론도 셈
    return n;
  };
  const peakT = () => Rank.peakTier().t;   // v23: 통과한 승급전 수까지 따져서
  const placedOk = () => Rank.placed();
  const TI = [
    { id: 'collector', name: '수집가', desc: '울트라레어 스킨 3종 이상 보유', prog: () => `${Math.min(3, ultraOwned())} / 3`, ok: () => ultraOwned() >= 3, fr: 'collector' },
    { id: 'wargod', name: '전쟁의 신', desc: '승률 20% 초과 (10판 이상)', prog: () => STATS.matches ? `${(STATS.wins / STATS.matches * 100).toFixed(1)}% · ${STATS.matches}판` : '0판', ok: () => STATS.matches >= 10 && STATS.wins / STATS.matches > 0.2, fr: 'wargod' },
    ...[6, 7, 8, 9, 10, 11, 12, 13].map((t) => ({ id: 'tier_' + RANK_TIERS[t].id, name: RANK_TIERS[t].name, desc: RANK_TIERS[t].sup ? `랭크 ${RANK_TIERS[t].name} 도달 — 승급전 통과 (전용 테두리 함께)` : `랭크 ${RANK_TIERS[t].name} 도달`, prog: () => placedOk() ? `최고 ${RANK_TIERS[peakT()].name}` : '배치고사 전', ok: () => placedOk() && peakT() >= t, fr: RANK_TIERS[t].id, tier: t })),
    // 하드코어 랭크 상위 3티어 (최고 도달) — 칭호와 같은 이름의 테두리
    ...[2, 3, 4].map((t) => ({ id: 'hc_' + HC_TIERS[t].id, name: HC_TIERS[t].name, desc: `하드코어 랭크 ${HC_TIERS[t].name} 도달`, prog: () => hcPeakT() >= 0 ? `최고 ${HC_TIERS[hcPeakT()].name}` : Rank.hcOk() ? '하드코어 기록 없음' : '하드코어 잠김 (일반 랭크 다이아 4 필요)', ok: () => hcPeakT() >= t, fr: 'hc_' + HC_TIERS[t].id, hc: t })),
    { id: 'beta', name: '베타 테스터', desc: '개발자가 부여한 베타 테스터 (사진·테두리·테스터 등급 총 스킨 함께)', prog: () => '개발자에게 부여받아야 함', ok: () => Eco.isBeta(), fr: 'beta' },
    // 배틀패스 (10_eco.js): 무료 줄 끝 = 선발대 · 플러스 1단계 = 패스 플러스(테두리) · 플러스 줄 끝 = 시즌 1 정복자(테두리)
    { id: 'bp_run', name: BP_TITLES.bp_run, desc: '배틀패스 시즌 1 — 50단계 달성', prog: () => `${Eco.bpInfo().lv} / ${BP.max}단계`, ok: () => Eco.bpTitle('bp_run') },
    { id: 'bp_plus', name: BP_TITLES.bp_plus, desc: '배틀패스 플러스 구매 (테두리 함께)', prog: () => '배틀패스 플러스 필요', ok: () => Eco.bpTitle('bp_plus'), fr: 'bp_plus' },
    { id: 'bp_s1', name: BP_TITLES.bp_s1, desc: '배틀패스 플러스로 시즌 1 — 50단계 달성 (테두리 함께)', prog: () => `${Eco.bpInfo().lv} / ${BP.max}단계`, ok: () => Eco.bpTitle('bp_s1'), fr: 'bp_s1' },
    // 콜라보 이벤트 (10_event.js): THE BACKROOMS 탈출 1회 · 12가지 모두 → 이벤트 창에서 받기 (계정마다 한 번)
    { id: 'br_escape', name: BR_EVENT.title, desc: 'THE BACKROOMS 탈출 이벤트 — 백룸에서 어떤 방법으로든 탈출 1회 (로비 상단 이벤트)', prog: () => EvBR.prog('one'), ok: () => !!(STATS.eco && STATS.eco.brx) },
    // v24.2 고난도 칭호: 광인 = 백룸 숨겨진 칭호(군 병원에서 정신력이 다 닳음 — 서버 br_hidden · 10_event.js) · 파쇄기 = 한 경기 근접 처치 SHRED_N 명 (06_combat.js · 기록 STATS.meleeBest)
    //  hidden: 얻기 전에는 이름·조건을 숨기고 「???」와 힌트만 (칭호 · 입장 연출 목록)
    { id: 'madman', name: '광인', hidden: true, hint: '숨겨진 칭호 — 백룸 어딘가, 끝없이 되돌아오는 복도에서', desc: '백룸 숨겨진 칭호 — 정신병원 너머 군 병원에서 정신력이 다 닳음 (우로보로스 테두리 함께)', prog: () => '숨겨진 칭호', ok: () => !!(STATS.eco && STATS.eco.brmad), fr: 'madman' },
    { id: 'shredder', name: '파쇄기', desc: `한 경기에서 근접 무기·주먹으로 ${SHRED_N}명 처치 (배틀로얄 — 같이 하기·랭크 포함 · 훈련장·데스매치 제외)`, prog: () => `최고 ${STATS.meleeBest || 0} / ${SHRED_N} (한 경기 근접 처치)`, ok: () => (STATS.meleeBest || 0) >= SHRED_N },
    { id: 'br_all', name: BR_EVENT.title12, desc: '백룸 완전 탈출 이벤트 — 12가지 방법으로 모두 탈출 (테두리 함께)', prog: () => EvBR.prog('all'), ok: () => !!(STATS.eco && STATS.eco.brx12), fr: 'br_all' },
    // 랭킹 1위 (10_ranking.js): 1위인 동안만 — 다른 계정이 1위가 되면 칭호·테두리가 회수된다
    { id: 'champ_lv', name: '정점의 베테랑', desc: '레벨 랭킹 1위 (1위를 빼앗기면 회수 · 테두리 함께)', prog: () => Ladder.posText('lv'), ok: () => Ladder.champ('lv'), fr: 'champ_lv' },
    { id: 'champ_tier', name: '랭크 챔피언', desc: '랭크 티어 랭킹 1위 (1위를 빼앗기면 회수 · 테두리 함께)', prog: () => Ladder.posText('tier'), ok: () => Ladder.champ('tier'), fr: 'champ_tier' },
    { id: 'champ_hc', name: '하드코어 패왕', desc: '하드코어 랭킹 1위 (1위를 빼앗기면 회수 · 테두리 함께)', prog: () => Ladder.posText('hc'), ok: () => Ladder.champ('hc'), fr: 'champ_hc' },
  ];
  // 하드코어 최고 티어 번호 (한 판도 안 했으면 -1)
  function hcPeakT() { const H = Rank.hc; return (H.games || 0) > 0 ? Rank.hcTierOf(Math.max(H.peak || 0, H.rp || 0)).t : -1; }
  const tiOf = (id) => TI.find((t) => t.id === id) || null;
  // v23 개발자·부개발자 계정은 모든 사진·테두리·칭호를 가진다 (파티 입장 연출도 — 10_partyfx.js 가 칭호의 ok 를 본다)
  //  own = 조건을 직접 채웠는가 (목록에 '개발자 권한'으로 구분해 보여 줌) · 다른 기기는 그 계정이 관리자인지 서버에 확인하고 보여 준다 (Cloud.staffRole)
  const staff = () => typeof Dev !== 'undefined' && Dev.is();
  for (const t of TI) { const own = t.ok; t.own = own; t.ok = () => staff() || own(); }

  // ---------- 상태 ----------
  const P0 = { av: 'helmet', fr: 'none', ti: null };
  const st = () => (STATS.prof && typeof STATS.prof === 'object' ? STATS.prof : (STATS.prof = Object.assign({}, P0)));
  const lv = () => levelFromXp(STATS.xp || 0).lv;
  const avOk = (id) => { const a = AV.find((x) => x.id === id); return !!a && (staff() || (a.ev ? !!(STATS.eco && STATS.eco[a.ev]) : a.beta ? Eco.isBeta() : lv() >= a.lv)); };
  const avEv = (a) => (a.ev === 'brx12' ? '백룸 12가지 탈출 이벤트' : '백룸 탈출 이벤트');
  const frOk = (id) => { const f = FR.find((x) => x.id === id); if (!f) return false; if (f.kind === 'base' || staff()) return true; if (f.kind === 'tier') return placedOk() && peakT() >= f.t; if (f.kind === 'hc') return hcPeakT() >= f.t; const t = tiOf(f.title); return !!t && t.ok(); };
  const tiOk = (id) => { const t = tiOf(id); return !!t && t.ok(); };
  // 지금 보여 줄 값 (조건이 사라진 것은 기본으로)
  function my() { const s = st(); return { av: avOk(s.av) ? s.av : 'helmet', fr: frOk(s.fr) ? s.fr : 'none', ti: s.ti && tiOk(s.ti) ? s.ti : null }; }
  function set(k, v) { const s = st(); s[k] = v; saveStats(); changed(); }
  function changed() { renderChip(); if (G.state === 'lobby' && typeof Party !== 'undefined' && Party.touch) Party.touch(); render(); }
  const titleName = (id) => { const t = tiOf(id); return t ? t.name : ''; };
  const titleHTML = (id, cls = '') => { const t = tiOf(id); return t ? `<span class="ttl ttl-${t.id}${cls ? ' ' + cls : ''}">${t.name}</span>` : ''; };

  // ---------- 왼쪽 위 계정 칩 ----------
  function renderChip() {
    const chip = $('acctChip'); if (!chip) return;
    const u = Cloud.user, m = my();
    const name = u ? Cloud.name : Cloud.status === 'restoring' ? '접속 중…' : '로그인';
    $('acctPf').innerHTML = frameHTML(u ? m.fr : 'none', u ? m.av : 'helmet', 40);
    $('acctName').textContent = name;
    const tt = $('acctTitle'); tt.innerHTML = u && m.ti ? titleHTML(m.ti, 'sm') : u ? `<span class="ac-sub">Lv ${lv()}</span>` : '<span class="ac-sub">기록 저장</span>';
    // 베타 테스터를 새로 받았으면 한 번 알림 (부여 시각 t 기준)
    if (u && Eco.isBeta() && STATS.betaSeen !== STATS.beta.t) { STATS.betaSeen = STATS.beta.t; saveStats(); setTimeout(() => { if (typeof HUD !== 'undefined' && HUD.lobbyNote) HUD.lobbyNote('베타 테스터 칭호를 받았습니다 — 사진·테두리·칭호와 테스터 등급 총 스킨 「프로토타입 β」(M416·AKM·Kar98k)가 해금되었습니다'); }, 500); }
  }

  // ---------- 계정 정보 창 ----------
  let tab = 'stats', nameMsg = '';
  const NAME_GAP = 3 * 864e5;
  const fmtLeft = (ms) => { const h = Math.ceil(ms / 36e5); return h > 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`; };
  function open(t) { if (!Cloud.user) { Cloud.open(); return; } if (t) tab = t; nameMsg = ''; $('profPanel').hidden = false; render(); }
  function close() { $('profPanel').hidden = true; }
  function render() {
    const P = $('profPanel'); if (!P || P.hidden) return;
    const m = my(), u = Cloud.user;
    $('profPf').innerHTML = frameHTML(m.fr, m.av, 76);
    $('profName').textContent = u ? Cloud.name : '게스트';
    $('profTtl').innerHTML = m.ti ? titleHTML(m.ti) : '<span class="micro">칭호 없음</span>';
    const rs = Rank.status();
    $('profSub').textContent = `Lv ${lv()} · ${rs.label}${placedOk() ? ` · 최고 ${RANK_TIERS[peakT()].name}` : ''}`;
    document.querySelectorAll('#profTabs button').forEach((b) => b.classList.toggle('on', b.dataset.pt === tab));
    const B = $('profBody'); B.innerHTML = '';
    if (tab === 'stats') {
      const S = STATS, D = S.dm || DM_STATS0, wr = S.matches ? (S.wins / S.matches * 100).toFixed(1) + '%' : '-';
      const g = document.createElement('div'); g.className = 'stat-grid prof-stats';
      for (const [k, v] of [['경기', S.matches], ['우승', S.wins], ['처치', S.kills], ['최고 순위', S.matches ? '#' + S.best : '-'], ['우승률', wr], ['경기당 처치', S.matches ? (S.kills / S.matches).toFixed(1) : '-'], ['랭크', rs.label], ['하드코어', Rank.hcOk() ? Rank.hcStatus().label : '잠김'], ['데스매치 승 / 판', D.matches ? `${D.wins} / ${D.matches}` : '-'], ['레벨', lv()], ['울트라레어 스킨', ultraOwned() + '종']]) {
        const d = document.createElement('div'); d.innerHTML = `<span>${k}</span><b>${v}</b>`; g.appendChild(d);
      }
      B.appendChild(g);
      const img = document.createElement('img'); img.className = 'prof-emb'; img.src = rs.emb; img.alt = ''; B.appendChild(img);
    } else if (tab === 'av') {
      const g = document.createElement('div'); g.className = 'prof-grid';
      for (const a of AV) {
        const ok = avOk(a.id), b = document.createElement('button'); b.type = 'button'; b.className = 'prof-it' + (m.av === a.id ? ' on' : '') + (ok ? '' : ' lock') + (a.beta ? ' beta' : '');
        b.innerHTML = frameHTML('none', a.id, 58) + `<b>${a.name}</b><small>${ok ? (m.av === a.id ? '사용 중' : '선택') : a.ev ? avEv(a) : a.beta ? '베타 테스터 전용' : `Lv ${a.lv} 해금`}</small>`;
        b.onclick = () => { if (!ok) { msg(a.ev ? (a.ev === 'brx12' ? '백룸 완전 탈출(12가지) 이벤트 보상입니다 (로비 위 이벤트)' : 'THE BACKROOMS 탈출 이벤트 보상입니다 (로비 위 이벤트)') : a.beta ? '베타 테스터 칭호를 받은 계정만 쓸 수 있습니다' : `레벨 ${a.lv}에 해금됩니다 (지금 Lv ${lv()})`); return; } set('av', a.id); Audio.ui(); };
        g.appendChild(b);
      }
      B.appendChild(g);
    } else if (tab === 'fr') {
      const g = document.createElement('div'); g.className = 'prof-grid';
      for (const f of FR) {
        const ok = frOk(f.id), b = document.createElement('button'); b.type = 'button'; b.className = 'prof-it' + (m.fr === f.id ? ' on' : '') + (ok ? '' : ' lock');
        b.innerHTML = frameHTML(f.id, m.av, 58) + `<b>${f.name}</b><small>${ok ? (m.fr === f.id ? '사용 중' : '선택') : f.desc}</small>`;
        b.onclick = () => { if (!ok) { msg(`잠김 — ${f.desc} 시 해금`); return; } set('fr', f.id); Audio.ui(); };
        g.appendChild(b);
      }
      B.appendChild(g);
      B.appendChild(el('p', 'micro', '랭크 테두리는 최고로 도달한 티어까지 쓸 수 있습니다. 티어가 높을수록 장식이 늘고 움직입니다. 하드코어 슬레이어·리퍼·오버로드 테두리는 하드코어 랭크 최고 기록으로 해금됩니다.'));
    } else if (tab === 'ti') {
      const L = document.createElement('div'); L.className = 'prof-ti';
      const none = document.createElement('button'); none.type = 'button'; none.className = 'ti-row' + (!m.ti ? ' on' : ''); none.innerHTML = '<span class="ti-none">칭호 달지 않기</span>'; none.onclick = () => { set('ti', null); Audio.ui(); }; L.appendChild(none);
      for (const t of TI) {
        const ok = t.ok(), b = document.createElement('button'); b.type = 'button'; b.className = 'ti-row' + (m.ti === t.id ? ' on' : '') + (ok ? '' : ' lock');
        const hid = t.hidden && !ok;   // v24.2 숨겨진 칭호: 얻기 전에는 이름·조건 대신 「???」와 힌트
        if (hid) { b.innerHTML = `<span class="ttl ttl-hidden">???</span><span class="ti-d"><b>${t.hint}</b><small>숨겨진 칭호</small></span>${frameHTML(t.fr, m.av, 34)}`; b.onclick = () => msg(t.hint); L.appendChild(b); continue; }
        b.innerHTML = `${titleHTML(t.id)}<span class="ti-d"><b>${t.desc}</b><small>${ok ? (m.ti === t.id ? '달고 있음' : (t.own() ? '얻음' : Dev.roleName() + ' 권한') + ' · 눌러서 달기') : '진행: ' + t.prog()}</small></span>${frameHTML(t.fr, m.av, 34)}`;
        b.onclick = () => { if (!ok) { msg(`아직 얻지 못했습니다 — ${t.desc}`); return; } set('ti', t.id); if (frOk(t.fr) && st().fr === 'none') set('fr', t.fr); Audio.ui(); };
        L.appendChild(b);
      }
      B.appendChild(L);
      B.appendChild(el('p', 'micro', '단 칭호는 로비에서 내 캐릭터 아래에 표시되고, 파티원 화면에도 보입니다. 칭호를 얻으면 같은 주제의 테두리도 해금됩니다.'));
    } else if (tab === 'ent' && typeof PartyFx !== 'undefined') {
      PartyFx.profTab(B);   // 파티 입장·퇴장 연출 고르기 (10_partyfx.js)
    }
    if (staff() && (tab === 'av' || tab === 'fr' || tab === 'ti')) B.appendChild(el('p', 'micro staff-note', `${Dev.roleName()} 계정은 모든 사진·테두리·칭호·입장 연출을 가지고 있습니다 — 1위 칭호처럼 조건이 있는 것도 달 수 있고, 다른 사람 화면에도 그대로 보입니다.`));
    if (tab === 'acct') {
      const left = Math.max(0, (STATS.nameT || 0) + NAME_GAP - Date.now());
      const box = document.createElement('div'); box.className = 'prof-acct';
      box.innerHTML = `<div class="eyebrow">아이디 변경</div><p class="micro">3일에 한 번 바꿀 수 있습니다. 바꾸면 다음 로그인부터 새 아이디로 로그인합니다 (비밀번호는 그대로).</p>
        <form class="fr-add" id="profNameForm" autocomplete="off"><input id="profNewName" maxlength="10" placeholder="새 아이디 (2~10자)" ${left ? 'disabled' : ''}><button class="btn amber" type="submit" ${left ? 'disabled' : ''}>변경</button></form>
        <p class="acct-msg${nameMsg.startsWith('!') ? ' bad' : nameMsg ? ' ok' : ''}" id="profNameMsg">${left ? `다음 변경까지 ${fmtLeft(left)}` : (nameMsg || '').replace(/^!/, '')}</p>
        <div class="eyebrow mt">비밀번호 변경</div><p class="micro">지금 비밀번호를 확인한 뒤 바꿉니다. 바꾸면 <b>이 기기를 뺀 다른 모든 기기의 로그인이 끊깁니다</b> — 다른 사람이 비밀번호를 알게 됐을 때 바로 바꾸세요.</p>
        <form class="pw-form" id="profPwForm" autocomplete="off"><input type="password" id="profPwCur" placeholder="지금 비밀번호" autocomplete="current-password"><input type="password" id="profPwNew" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password"><input type="password" id="profPwNew2" placeholder="새 비밀번호 확인" autocomplete="new-password"><button class="btn amber" type="submit">비밀번호 바꾸기</button></form>
        <p class="acct-msg" id="profPwMsg"></p>
        <div class="eyebrow mt">저장</div><p class="micro" id="profSync">${Cloud.status === 'error' ? '저장 실패 — ' + Cloud.lastError : '전적·레벨·랭크·꾸미기·설정이 서버에 저장되어 다른 기기에서도 이어집니다.'}</p>
        <div class="acct-btns"><button class="btn" type="button" id="profSyncNow">지금 저장</button><button class="btn danger" type="button" id="profLogout">로그아웃</button></div>`;
      B.appendChild(box);
      $('profNameForm').onsubmit = async (e) => {
        e.preventDefault(); const v = $('profNewName').value;
        nameMsg = '바꾸는 중…'; $('profNameMsg').textContent = nameMsg;
        try { await Cloud.rename(v); STATS.nameT = Date.now(); saveStats(); nameMsg = `아이디를 「${Cloud.name}」(으)로 바꿨습니다`; changed(); HUD.lobbyNote(nameMsg); }
        catch (err) { nameMsg = '!' + (err.message || String(err)); render(); }
      };
      $('profPwForm').onsubmit = async (e) => {
        e.preventDefault(); const m = $('profPwMsg'), btn = $('profPwForm').querySelector('button'); if (btn.disabled) return;
        btn.disabled = true; m.className = 'acct-msg ok'; m.textContent = '바꾸는 중…';
        try {
          const others = await Cloud.changePassword($('profPwCur').value, $('profPwNew').value, $('profPwNew2').value);
          for (const id of ['profPwCur', 'profPwNew', 'profPwNew2']) $(id).value = '';
          m.textContent = others ? '비밀번호를 바꿨습니다 — 다른 기기의 로그인은 모두 끊겼습니다 (이미 열린 화면은 최대 1시간 안에 끊김)' : '비밀번호를 바꿨습니다 (다른 기기 로그아웃은 확인하지 못했습니다)';
          HUD.lobbyNote('비밀번호를 바꿨습니다');
        } catch (err) { m.className = 'acct-msg bad'; m.textContent = err.message || String(err); }
        finally { btn.disabled = false; }
      };
      $('profSyncNow').onclick = async () => { const ok = await Cloud.pushNow(); $('profSync').textContent = ok ? '저장했습니다' : '저장 실패 — ' + Cloud.lastError; };
      $('profLogout').onclick = async () => { await Cloud.signOut(); close(); HUD.lobbyNote('로그아웃했습니다 — 이 기기의 게스트 기록으로 돌아왔습니다'); };
    }
  }
  function el(t, c, txt) { const e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; }
  function msg(t) { HUD.lobbyNote(t); }

  // ---------- 로비: 캐릭터 아래 칭호 (파티원은 이름 + 칭호) ----------
  const _v = new THREE.Vector3(), tagEls = [];
  function lobbyTags(L) {
    const box = $('lobbyTags'); if (!box) return;
    const show = G.state === 'lobby' && !$('lobby').hidden && !L.sc;
    const items = [];
    if (show) {
      const m = Cloud.user ? my() : null;
      if (m && m.ti && !(typeof PartyFx !== 'undefined' && PartyFx.meHidden)) items.push({ obj: L.rig.root, html: titleHTML(m.ti) });   // 입장·퇴장 연출이 내 캐릭터를 숨긴 동안은 칭호도 숨김 (빈자리에 떠 있지 않게)
      (L.mates || []).forEach((r, i) => { const inf = (L.mateInfo || [])[i]; if (!inf || !r.root.visible) return; const pf = inf.pf || {}, ti = pf.ti && Ladder.allowed(pf.ti, inf.name, inf.uid) ? pf.ti : null; items.push({ obj: r.root, html: `<span class="lbtag-name">${esc(inf.name || '')}</span>${ti ? titleHTML(ti) : ''}` }); });
    }
    while (tagEls.length < items.length) { const d = document.createElement('div'); d.className = 'lbtag'; box.appendChild(d); tagEls.push(d); }
    const W = window.innerWidth, H = window.innerHeight, placed = [];
    tagEls.forEach((d, i) => {
      const it = items[i]; if (!it) { d.hidden = true; return; }
      it.obj.getWorldPosition(_v); _v.y -= 0.02; _v.project(L.cam);
      if (_v.z > 1) { d.hidden = true; return; }
      d.hidden = false; if (d._h !== it.html) { d.innerHTML = it.html; d._h = it.html; d._w = 0; }
      const w = d._w || (d._w = d.offsetWidth || 100), h = d.offsetHeight || 22, x = (_v.x + 1) / 2 * W;
      let y = (1 - _v.y) / 2 * H + 6;
      // 옆 사람 칭호와 겹치면 아래로 비켜 세움
      for (let k = 0; k < 4; k++) { const hit = placed.find((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < Math.max(p.h, h) - 2); if (!hit) break; y = hit.y + hit.h + 2; }
      placed.push({ x, y, w, h });
      d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateX(-50%)`;
    });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function setup() {
    // 오른쪽 위 화살표 메뉴: 누르면 경기 설정·조작법·설정이 차례로 펼쳐짐 (바깥을 누르거나 하나를 고르면 닫힘)
    const mb = $('moreBtn'), mn = $('lbMenu');
    const setMenu = (on) => { mn.hidden = false; mn.classList.toggle('open', on); mb.classList.toggle('open', on); mb.setAttribute('aria-expanded', on ? 'true' : 'false'); if (!on) setTimeout(() => { if (!mn.classList.contains('open')) mn.hidden = true; }, 260); };
    mb.addEventListener('click', (e) => { e.stopPropagation(); Audio.init(); Audio.ui(); setMenu(!mn.classList.contains('open')); });
    mn.addEventListener('click', () => setMenu(false));
    document.addEventListener('pointerdown', (e) => { if (mn.classList.contains('open') && !$('lbMore').contains(e.target)) setMenu(false); });
    $('profClose').addEventListener('click', close);
    document.querySelectorAll('#profTabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.pt; nameMsg = ''; Audio.init(); Audio.ui(); render(); }));
    $('profPanel').addEventListener('click', (e) => { if (e.target === $('profPanel')) close(); });
    renderChip();
  }
  return { AV, FR, TI, my, set, refresh: changed, open, close, render, renderChip, setup, lobbyTags, frameHTML, avatarSVG, titleHTML, titleName, ultraOwned, earned: () => TI.filter((t) => t.ok()).map((t) => t.id) };
})();
