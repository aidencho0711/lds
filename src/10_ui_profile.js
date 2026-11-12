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
    ...['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'legend', 'eternal'].map((id, t) => ({ id, name: '', kind: 'tier', t, desc: '' })),
    { id: 'collector', name: '수집가', kind: 'title', title: 'collector', desc: '칭호 「수집가」' },
    { id: 'wargod', name: '전쟁의 신', kind: 'title', title: 'wargod', desc: '칭호 「전쟁의 신」' },
    // 하드코어 랭크 상위 3티어 (최고 도달 기준) · 베타 테스터
    ...[2, 3, 4].map((t) => ({ id: 'hc_' + HC_TIERS[t].id, name: HC_TIERS[t].name, kind: 'hc', t, desc: `하드코어 ${HC_TIERS[t].name} 도달` })),
    { id: 'beta', name: '베타 테스터', kind: 'title', title: 'beta', desc: '칭호 「베타 테스터」(개발자 부여)' },
    // 배틀패스 플러스 전용 테두리 2종
    { id: 'bp_plus', name: '패스 플러스', kind: 'title', title: 'bp_plus', desc: '칭호 「패스 플러스」(배틀패스 플러스 1단계)' },
    { id: 'bp_s1', name: '시즌 1 정복자', kind: 'title', title: 'bp_s1', desc: '칭호 「시즌 1 정복자」(배틀패스 플러스 50단계)' },
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
  const ORN_FX = { eternal: '<i class="pf-orb"></i><i class="pf-orb b"></i>', grandmaster: '', legend: '<i class="pf-rays"></i>', hc_overlord: '<i class="pf-rays hc"></i>', beta: '<i class="pf-scan"></i>' };
  function frameHTML(fr, av, size = 44, extra = '') {
    const f = FR.find((x) => x.id === fr) || FR[0], o = ORN[f.id];
    return `<span class="pf fr-${f.id}${extra ? ' ' + extra : ''}" style="--s:${size}px">${ORN_FX[f.id] || ''}<span class="pf-av">${avatarSVG(av)}</span><span class="pf-ring"></span>${f.id === 'grandmaster' ? '<span class="pf-spk"><svg viewBox="-16 -16 96 96">' + o + '</svg></span>' : o ? `<span class="pf-orn"><svg viewBox="-16 -16 96 96">${o}</svg></span>` : ''}</span>`;
  }

  // ---------- 칭호 ----------
  const ultraOwned = () => {
    let n = 0;
    for (const id of STATS.skins || []) if (Body.SKINS[id] && Body.SKINS[id].rar === 5) n++;
    for (const id of STATS.vskins || []) if (typeof VSKINS !== 'undefined' && VSKINS[id] && VSKINS[id].rar === 5) n++;
    for (const id of STATS.gskins || []) if (typeof GSKINS !== 'undefined' && GSKINS[id] && (GSKINS[id].rar === 5 || GSKINS[id].rar === 7)) n++;   // 엡실론도 셈
    return n;
  };
  const peakT = () => Rank.tierOf(Math.max(Rank.state.peak || 0, Rank.state.rp || 0)).t;
  const placedOk = () => Rank.placed();
  const TI = [
    { id: 'collector', name: '수집가', desc: '울트라레어 스킨 3종 이상 보유', prog: () => `${Math.min(3, ultraOwned())} / 3`, ok: () => ultraOwned() >= 3, fr: 'collector' },
    { id: 'wargod', name: '전쟁의 신', desc: '승률 20% 초과 (10판 이상)', prog: () => STATS.matches ? `${(STATS.wins / STATS.matches * 100).toFixed(1)}% · ${STATS.matches}판` : '0판', ok: () => STATS.matches >= 10 && STATS.wins / STATS.matches > 0.2, fr: 'wargod' },
    ...[6, 7, 8, 9].map((t) => ({ id: 'tier_' + RANK_TIERS[t].id, name: RANK_TIERS[t].name, desc: `랭크 ${RANK_TIERS[t].name} 도달`, prog: () => placedOk() ? `최고 ${RANK_TIERS[peakT()].name}` : '배치고사 전', ok: () => placedOk() && peakT() >= t, fr: RANK_TIERS[t].id, tier: t })),
    // 하드코어 랭크 상위 3티어 (최고 도달) — 칭호와 같은 이름의 테두리
    ...[2, 3, 4].map((t) => ({ id: 'hc_' + HC_TIERS[t].id, name: HC_TIERS[t].name, desc: `하드코어 랭크 ${HC_TIERS[t].name} 도달`, prog: () => hcPeakT() >= 0 ? `최고 ${HC_TIERS[hcPeakT()].name}` : Rank.hcOk() ? '하드코어 기록 없음' : '하드코어 잠김 (일반 랭크 다이아 4 필요)', ok: () => hcPeakT() >= t, fr: 'hc_' + HC_TIERS[t].id, hc: t })),
    { id: 'beta', name: '베타 테스터', desc: '개발자가 부여한 베타 테스터 (사진·테두리·테스터 등급 총 스킨 함께)', prog: () => '개발자에게 부여받아야 함', ok: () => Eco.isBeta(), fr: 'beta' },
    // 배틀패스 (10_eco.js): 무료 줄 끝 = 선발대 · 플러스 1단계 = 패스 플러스(테두리) · 플러스 줄 끝 = 시즌 1 정복자(테두리)
    { id: 'bp_run', name: BP_TITLES.bp_run, desc: '배틀패스 시즌 1 — 50단계 달성', prog: () => `${Eco.bpInfo().lv} / ${BP.max}단계`, ok: () => Eco.bpTitle('bp_run') },
    { id: 'bp_plus', name: BP_TITLES.bp_plus, desc: '배틀패스 플러스 구매 (테두리 함께)', prog: () => '배틀패스 플러스 필요', ok: () => Eco.bpTitle('bp_plus'), fr: 'bp_plus' },
    { id: 'bp_s1', name: BP_TITLES.bp_s1, desc: '배틀패스 플러스로 시즌 1 — 50단계 달성 (테두리 함께)', prog: () => `${Eco.bpInfo().lv} / ${BP.max}단계`, ok: () => Eco.bpTitle('bp_s1'), fr: 'bp_s1' },
  ];
  // 하드코어 최고 티어 번호 (한 판도 안 했으면 -1)
  function hcPeakT() { const H = Rank.hc; return (H.games || 0) > 0 ? Rank.hcTierOf(Math.max(H.peak || 0, H.rp || 0)).t : -1; }
  const tiOf = (id) => TI.find((t) => t.id === id) || null;

  // ---------- 상태 ----------
  const P0 = { av: 'helmet', fr: 'none', ti: null };
  const st = () => (STATS.prof && typeof STATS.prof === 'object' ? STATS.prof : (STATS.prof = Object.assign({}, P0)));
  const lv = () => levelFromXp(STATS.xp || 0).lv;
  const avOk = (id) => { const a = AV.find((x) => x.id === id); return !!a && (a.beta ? Eco.isBeta() : lv() >= a.lv); };
  const frOk = (id) => { const f = FR.find((x) => x.id === id); if (!f) return false; if (f.kind === 'base') return true; if (f.kind === 'tier') return placedOk() && peakT() >= f.t; if (f.kind === 'hc') return hcPeakT() >= f.t; const t = tiOf(f.title); return !!t && t.ok(); };
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
        b.innerHTML = frameHTML('none', a.id, 58) + `<b>${a.name}</b><small>${ok ? (m.av === a.id ? '사용 중' : '선택') : a.beta ? '베타 테스터 전용' : `Lv ${a.lv} 해금`}</small>`;
        b.onclick = () => { if (!ok) { msg(a.beta ? '베타 테스터 칭호를 받은 계정만 쓸 수 있습니다' : `레벨 ${a.lv}에 해금됩니다 (지금 Lv ${lv()})`); return; } set('av', a.id); Audio.ui(); };
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
        b.innerHTML = `${titleHTML(t.id)}<span class="ti-d"><b>${t.desc}</b><small>${ok ? (m.ti === t.id ? '달고 있음' : '얻음 · 눌러서 달기') : '진행: ' + t.prog()}</small></span>${frameHTML(t.fr, m.av, 34)}`;
        b.onclick = () => { if (!ok) { msg(`아직 얻지 못했습니다 — ${t.desc}`); return; } set('ti', t.id); if (frOk(t.fr) && st().fr === 'none') set('fr', t.fr); Audio.ui(); };
        L.appendChild(b);
      }
      B.appendChild(L);
      B.appendChild(el('p', 'micro', '단 칭호는 로비에서 내 캐릭터 아래에 표시되고, 파티원 화면에도 보입니다. 칭호를 얻으면 같은 주제의 테두리도 해금됩니다.'));
    } else if (tab === 'acct') {
      const left = Math.max(0, (STATS.nameT || 0) + NAME_GAP - Date.now());
      const box = document.createElement('div'); box.className = 'prof-acct';
      box.innerHTML = `<div class="eyebrow">아이디 변경</div><p class="micro">3일에 한 번 바꿀 수 있습니다. 바꾸면 다음 로그인부터 새 아이디로 로그인합니다 (비밀번호는 그대로).</p>
        <form class="fr-add" id="profNameForm" autocomplete="off"><input id="profNewName" maxlength="10" placeholder="새 아이디 (2~10자)" ${left ? 'disabled' : ''}><button class="btn amber" type="submit" ${left ? 'disabled' : ''}>변경</button></form>
        <p class="acct-msg${nameMsg.startsWith('!') ? ' bad' : nameMsg ? ' ok' : ''}" id="profNameMsg">${left ? `다음 변경까지 ${fmtLeft(left)}` : (nameMsg || '').replace(/^!/, '')}</p>
        <div class="eyebrow mt">저장</div><p class="micro" id="profSync">${Cloud.status === 'error' ? '저장 실패 — ' + Cloud.lastError : '전적·레벨·랭크·꾸미기·설정이 서버에 저장되어 다른 기기에서도 이어집니다.'}</p>
        <div class="acct-btns"><button class="btn" type="button" id="profSyncNow">지금 저장</button><button class="btn danger" type="button" id="profLogout">로그아웃</button></div>`;
      B.appendChild(box);
      $('profNameForm').onsubmit = async (e) => {
        e.preventDefault(); const v = $('profNewName').value;
        nameMsg = '바꾸는 중…'; $('profNameMsg').textContent = nameMsg;
        try { await Cloud.rename(v); STATS.nameT = Date.now(); saveStats(); nameMsg = `아이디를 「${Cloud.name}」(으)로 바꿨습니다`; changed(); HUD.lobbyNote(nameMsg); }
        catch (err) { nameMsg = '!' + (err.message || String(err)); render(); }
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
      if (m && m.ti) items.push({ obj: L.rig.root, html: titleHTML(m.ti) });
      (L.mates || []).forEach((r, i) => { const inf = (L.mateInfo || [])[i]; if (!inf || !r.root.visible) return; const pf = inf.pf || {}; items.push({ obj: r.root, html: `<span class="lbtag-name">${esc(inf.name || '')}</span>${pf.ti ? titleHTML(pf.ti) : ''}` }); });
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
  return { AV, FR, TI, my, set, open, close, render, renderChip, setup, lobbyTags, frameHTML, avatarSVG, titleHTML, titleName, ultraOwned, earned: () => TI.filter((t) => t.ok()).map((t) => t.id) };
})();
