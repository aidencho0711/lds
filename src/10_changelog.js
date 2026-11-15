// ============================================================
// 10_changelog.js — 업데이트 로그 (로비 오른쪽 위 메뉴 → 업데이트 로그)
//  · 새 것이 위. 무언가를 고치거나 더할 때마다 여기에 한 줄씩 더한다 (README 는 개발 기록, 이곳은 플레이어용 요약)
//  · 마지막으로 본 항목(store 'clSeen')보다 새 항목이 있으면 메뉴 버튼에 빨간 점
// ============================================================
const CHANGELOG = [
  { v: 'v20', d: '2026-11-15', t: '크리스마스 업데이트', items: [
    '로비가 겨울로 — 눈 내리는 기지 · 눈 덮인 숲과 상자 · 장식 트리와 반짝이는 전구 · 선물 상자 · 눈사람',
    '상점에 크리스마스 상자 — 겨울 테마 옷 · 총기 · 차량 스킨, 새 등급 EXCLUSIVE',
    'EXCLUSIVE 총기 스킨: 전용 디자인 · 대기 효과 · 살펴보기 · 사격 효과 · 처치 효과 · 킬 로그',
    'EXCLUSIVE 옷: 입으면 몸 주위에 눈꽃·반짝임 효과',
    'EXCLUSIVE 차량: 루돌프가 끄는 산타 썰매 (UAZ) — 달리면 다리를 움직이고 코가 빛남',
  ] },
  { v: 'v20', d: '2026-11-15', t: 'THE BACKROOMS 콜라보 이벤트 · 편의', items: [
    '로비 위 「이벤트」: THE BACKROOMS 에서 엘리베이터로 탈출하면 골드 탄피 30,000 + 칭호·사진(스마일러)·테두리 「백룸 탈출자」 (기기마다 1번)',
    '이미 받은 기기에는 늘어난 차액을 자동으로 지급',
    '휴대폰·태블릿에서 화면을 누르면 전체 화면으로',
    '업데이트 로그 추가 (로비 오른쪽 위 메뉴)',
  ] },
  { v: 'v20', d: '2026-11-15', t: 'EPSILON VEHICLE COLLECTION', items: [
    '엡실론 차량 4종: IMPERIAL X-01(SUV) · AURELION GT(하이퍼카) · TITAN VANGUARD(픽업) · SOVEREIGN ECLIPSE(세단)',
    '차량마다 고유한 시동·주행·정차 연출과 엔진음, 획득 컷신',
    'AURELION GT 정밀 재설계: 화살촉 헤드램프 · 다층 범퍼 · 감싸는 테일 LED · 액티브 리어 윙',
    '엡실론 금고에서 각 0.1% · 교환소 차량 교환 코인 400',
  ] },
  { v: 'v20', d: '2026-11-15', t: '랭킹', items: ['레벨 · 랭크 티어 · 하드코어 랭킹 1~15위', '각 랭킹 1위에게 전용 칭호·테두리 (1위를 빼앗기면 회수)'] },
  { v: 'v20', d: '2026-11-14', t: '엡실론 처치 효과 · 킬 로그 개편', items: ['엡실론 총마다 외형을 살린 처치 효과와 킬 로그', '배틀패스 플러스 50단계 보상: 총기 교환 코인 1,000'] },
  { v: 'v20', d: '2026-11-13', t: '배틀패스 · 이동 동작', items: ['배틀패스(무료) + 배틀패스 플러스', '앉기·엎드리기 상태로 이동, 좌우 기울이기', '엡실론 외형 키트와 살펴보기 효과'] },
  { v: 'v20', d: '2026-11-12', t: '새 총기 · EPSILON 등급', items: ['새 총 3종: Groza · AMR · DBS', '울트라레어 위 최상위 등급 EPSILON — 총기 스킨 8종(엡실론 금고)', '베타 테스터 한정 컬렉션 개편 · 총 살펴보기'] },
  { v: 'v20', d: '2026-11-11', t: '하드코어 랭크전 · 프로필 꾸미기', items: [
    '하드코어 랭크전(다이아 4 이상 경험자, 익스트림 봇)', '로비 개편 · 프로필 사진 · 테두리 · 칭호 · 아이디 변경',
    '친구와 차량 동승 · 동승석에서 창밖으로 몸을 내밀어 사격', '골드 탄피 이벤트(골드 러시 · 행운의 상자 · 매치 보너스 · 주간 챌린지 · 현상금)',
    '익스트림 난이도 봇 · 봇 난이도별 스킨 · 수송기에서도 보이는 핑',
  ] },
  { v: 'v20', d: '2026-11-09', t: '새 맵 키나루 · 리콜', items: [
    '새 맵 키나루(4km 정글 섬) · 노르덴 개편', '1:1 / 2:2 대결 모드', '리콜 시스템(듀오·스쿼드): 리콜 카드 · 타워 · 수송기',
    '한 판 최대 75명 · 중앙 훈련기지', '엑스트라 품질 · 그림자 최고 · FPS 제한과 표시', '차량 스킨 개편(하이퍼카 · 스포츠카 · 럭셔리카)',
  ] },
  { v: 'v20', d: '2026-11-08', t: '총기 스킨 효과', items: ['슈퍼레어: 약한 사격·맞힘 효과 · 울트라레어: 꺼낼 때 부속품 전개', '손 동작(팔꿈치·손목) 자연스럽게 수정'] },
  { v: 'v19', d: '2026-11-07', t: '개발자 계정', items: ['개발자 도구 · 계정 관리'] },
  { v: 'v18', d: '2026-11-07', t: '울트라레어 맞힘 · 처치 효과', items: ['울트라레어 총기 스킨으로 맞히거나 처치하면 스킨 색의 효과'] },
  { v: 'v17', d: '2026-11-07', t: '총기 스킨', items: ['총기 스킨 28종 · 총기 상자 2종(아스널 · 네온) · 총기 교환 코인 · 교환소', '울트라레어: 사격·교체 효과', '산탄총 탄 퍼짐 축소 · Win94 2.7배 조준경'] },
  { v: 'v16', d: '2026-11-06', t: '총기 10종 추가', items: ['총기 24종으로 확장 · 총마다 다른 장전 동작 · .45 ACP'] },
  { v: 'v15', d: '2026-11-06', t: '상점', items: ['골드 탄피 · 옷 상자 3종 · 차량 뽑기 · 차량 스킨 · 교환소', '일일·주간 미션 · 7일 출석 보상'] },
  { v: 'v14', d: '2026-11-05', t: '새 캐릭터 · 창고', items: ['캐릭터 모델과 동작 전면 개편', '실제 같은 장전 소리', '창고(옷 갈아입기)'] },
  { v: 'v13', d: '2026-10-28', t: '친구 · 파티', items: ['친구 · 파티(같이 하기)', '팀 데스매치 · 웨폰 데스매치 · 트리오'] },
  { v: 'v12', d: '2026-10-25', t: '로그인', items: ['아이디·비밀번호 로그인 · 전적·레벨·랭크·설정 서버 저장'] },
  { v: 'v11', d: '2026-10-23', t: '훈련장', items: ['모든 총·차량을 시험하는 훈련장'] },
  { v: 'v10', d: '', t: '동작 · 소리 다듬기', items: ['줍기 동작·소리 · 넘기·오르기 · 낙하 자세와 앞구르기', '총소리 재설계(휴대폰에서도 묵직하게) · 회복 동작 · 투척 궤적 · 소리 방향 표시'] },
  { v: 'v9', d: '', t: '동승석 사격 · 핑', items: ['차량 동승석에서 조준·사격', '핑: 한 번 이동/공격 · 두 번 위험 · 길게 모여'] },
  { v: 'v8', d: '', t: '팀원 AI', items: ['팀원이 따라오고 핑 지휘를 따름 · 적 정보 공유 · HUD 정리'] },
  { v: 'v7', d: '', t: '듀오 · 스쿼드', items: ['팀 구성(솔로·듀오·스쿼드) · 기절과 부활 · 관전'] },
  { v: 'v6', d: '', t: '로비 개편', items: ['새 로비(탭 · 오퍼레이터 카드 · 소식 · 맵 카드 · 출격)'] },
  { v: 'v5', d: '', t: '차량', items: ['말 · UAZ · 픽업트럭 · 세단 · 오토바이 · 충돌·폭발·들이받기'] },
  { v: 'v4', d: '', t: '랭크전 · 노르덴', items: ['랭크전(아이언~이터널 10티어)', '8×8km 노르덴 · 봇 최대 99명'] },
  { v: 'v3', d: '', t: '총기 확장', items: ['M416 · AUG · AKM · M24 · AWM · S686 · M249 등 총 14종 · 사격 모드'] },
  { v: 'v2', d: '', t: '장전 · 조준경', items: ['무기별 장전 동작 · 총성 · 조준경 6종 · 아이템 사진 · 모바일 버튼 편집'] },
  { v: 'v1', d: '', t: '첫 버전', items: ['브라우저 배틀로얄: 강하 · 파밍 · 자기장 · 봇'] },
];
const ChangeLog = (() => {
  const el = (id) => document.getElementById(id);
  const key = (e) => e.v + '|' + e.d + '|' + e.t;
  const unseen = () => store.get('clSeen', '') !== key(CHANGELOG[0]);
  function dot() { const d = el('clDot'); if (d) d.hidden = !unseen(); const m = el('moreDot'); if (m) m.hidden = !unseen(); }
  function render() {
    const box = el('clBody'); if (!box) return; box.innerHTML = '';
    CHANGELOG.forEach((e, i) => {
      const det = document.createElement('details'); det.className = 'cl-ent'; if (i < 2) det.open = true;
      const sum = document.createElement('summary'); sum.innerHTML = `<span class="cl-v">${e.v}</span><b>${e.t}</b><span class="cl-d">${e.d || '초기'}</span>`;
      const ul = document.createElement('ul'); for (const it of e.items) { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); }
      det.appendChild(sum); det.appendChild(ul); box.appendChild(det);
    });
  }
  function open() { render(); el('clPanel').hidden = false; store.set('clSeen', key(CHANGELOG[0])); dot(); }
  function close() { el('clPanel').hidden = true; }
  function init() {
    el('clBtn').addEventListener('click', () => { try { Audio.init(); Audio.ui(); } catch (e) { /* 소리 없이도 */ } open(); });
    el('clClose').addEventListener('click', close);
    el('clPanel').addEventListener('click', (e) => { if (e.target === el('clPanel')) close(); });
    dot();
  }
  return { init, open, close, latest: () => CHANGELOG[0] };
})();
