// ============================================================
// 10_loading.js — v23 경기 로딩 화면 「위성 정찰 스캔」 (배틀로얄 · 훈련장 · 데스매치·대결 · 같이 하기로 돌아오기 · 이어하기)
//  맵을 만드는 동안 generateWorld 가 알려 주는 진짜 생성 자료로 위성 화면을 그린다 (02_world.js yieldUI → progress(p, label, info))
//   · 지형 설계: 잡음 낀 어두운 바다에서 신호를 잡는 중
//   · 높이맵 계산: 끝난 줄(W.hf · W.surf)을 표면 색 + 음영(미니맵과 같은 식 · 비탈 암석도 같게)으로 칠하고, 위에서 내려오는 주사선이 지나간 곳만 드러남
//     주사선이 지나가는 줄의 지역(W.pois)에 표식과 이름이 뜬다 · 색표는 첫 줄을 칠할 때 정함 (정글·크리스마스 섬 표시 w.v2·w.xmas 는 '지형 설계' 보고 뒤에 정해짐)
//   · 그 뒤: 도로(W.roads) → 건물·구조물(W.buildings · W.mapRects — 호박색 '식별') → 나무(W.trees 점 · 큰 맵은 심는 대로) · 그동안 회전 탐지(분석 중)
//   · 미니맵 렌더링이 끝나면 진짜 미니맵(w.minimap)으로 천천히 바뀜
//   · 시작(finale): 첫 자기장(Zone.cur 파랑 · Zone.next 흰 원)이 좁혀 들어오고 비행 경로(G.plane) 점선 · 「강하 준비 완료」 도장 → 사라짐 — 경기는 이미 시작해 그 밑에서 돈다
//     연출 시계는 마지막 화면이 실제로 화면에서 시작한 때부터 잰다 (도장 애니메이션 startTime — 경기 첫 화면이 그려진 뒤) — 첫 화면(셰이더 준비)이 오래 걸려도 도장이 다 보인 뒤 사라짐
//     같이 하기 파티원은 방장이 보낸 자기장이 와야 맞으므로 그때 그린다 (zone — 10_net.js applyZone) · 이어하기·다시 들어오기·데스매치는 빠른 마무리(quick: 바로 도장 · 짧게 사라짐)
//  오른쪽: 맵 이름 · 모드 · 생성 기록(경과 시간 · 타자 효과 · 앞 단계 '완료' + 결과 수) · 진행률(가는 선은 보조) · 작전 메모(배틀로얄은 TIPS 를 6초마다)
//  움직임은 거의 CSS(transform·opacity → 합성 스레드)라 맵 생성이 주 스레드를 오래 잡아도 잡음·주사선·탐지·타자 효과·녹화 시계·도장·사라짐이 끊기지 않는다
//   주사선: 직전 보고 간격(= 다음 보고까지 걸릴 시간)만큼 이미 칠한 줄까지 미끄러짐 → 칠한 곳보다 앞서지 않고, 지역 표식은 주사선이 닿는 순간 뜨도록 지연을 미리 줌
//  그리는 양: 새 줄만(축소 캔버스 · 큰 맵은 표본), 도로·건물·나무는 단계마다 한 번 · 화면을 덮는 동안 로비 3D 는 그리지 않음(11_game.js loop → covers)
//  꾸밈 화면이라 경기를 막지 않는다: 밖에서 부르는 함수는 모두 try 로 감싸 오류가 나면 화면만 걷는다(hideNow)
//  API: show({ title, sub, tip, tips, mapId, kind }) · prog(p, label, info) · hold(label, onCancel) · finale({ zone, plane, stamp, sub, quick }) · zone() · hide() · hideNow() · covers() · brSub · marks(테스트: 단계 시작 시각)
// ============================================================
const Loading = (() => {
  // 단계 → 위성 화면 위 상태 글 (없으면 단계 이름 그대로)
  const PHASE = { '지형 설계': '궤도 진입 · 신호 수신', '높이맵 계산': '지형 스캔 중', '건물 배치': '구조물 식별 중', '지형 메시 생성': '지형 모델링', '숲과 바위 생성': '식생 분석', '눈 덮인 숲 생성': '식생 분석',
    '미니맵 렌더링': '영상 합성', '경로 탐색망 구축': '이동 경로 분석', '준비 완료': '분석 완료', '아이템 배치': '보급품 위치 표시', '차량 배치': '차량 위치 표시', '무기고 정리': '무기고 점검', '부대 배치': '부대 배치' };
  const NO_ROCK = new Set([2, 3, 4, 9, 10, 11]);   // 비탈이어도 암석으로 바꾸지 않는 표면 (02_world.js 높이맵 뒤 경사 처리와 같게)
  const TYPE_MS = 26;   // 타자 효과: 글자 하나 간격
  // 마지막 연출 (화면에 오른 때부터 ms): 도장이 '쾅' 닿는 때(CSS ldStamp 지연 + 0.2초) · 사라지기 시작 · 자기장 고정음
  const FIN = { zone: { stamp: 790, out: 1350, lock: 300 }, nz: { stamp: 290, out: 800, lock: 0 }, quick: { stamp: 140, out: 560, lock: 0 } };
  let E = null, S = null, marks = {};
  const now = () => performance.now();
  const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const fmtN = (n) => Math.round(n).toLocaleString('ko-KR');
  const clock = (ms) => { const s = Math.max(0, ms) / 1000, m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + (s - m * 60).toFixed(2).padStart(5, '0'); };
  const sgn = (v) => (v < 0 ? '−' : '+') + String(Math.abs(Math.round(v))).padStart(3, '0');
  // 소리 (dl: 몇 초 뒤 — WebAudio 시계로 예약해 화면과 맞춤)
  const sfx = (k, dl) => { try { if (Audio.loadFx) Audio.loadFx(k, dl); } catch (e) { /* 소리 없음 */ } };
  // 시간 예약: 화면이 바뀌면(다른 show · 숨김) 저절로 취소
  function later(fn, ms) { const s = S; if (!s) return; const id = setTimeout(() => { s.timers.delete(id); if (S === s) try { fn(); } catch (e) { fail(e); } }, ms); s.timers.add(id); }
  // 배틀로얄 모드 줄 (로비 맵 카드와 같은 글): 솔로 · 3인칭 · 클래식 — 랭크·하드코어는 앞에
  const brSub = (rk, hc, ts) => { const tm = Object.values(TEAM_MODES).find((m) => m.size === ts) || TEAM_MODES.solo; return `${hc ? '하드코어 · ' : rk ? '랭크 · ' : ''}${tm.name} · ${SETTINGS.view === 'fpp' ? '1인칭' : '3인칭'} · ${(MODES[SETTINGS.mode] || MODES.classic).name}`; };
  // 녹화 시계 숫자 띠 (0~n-1 을 세로로 — CSS 가 steps 로 올림)
  const dg = (n, k) => `<span class="ld-dg ${k}"><i>${[...Array(n).keys()].join('<br>')}</i></span>`;

  function els() {
    if (E) return E;
    E = {};
    for (const k of ['loading', 'ldSat', 'ldTerr', 'ldTree', 'ldRoad', 'ldBld', 'ldMap', 'ldCur', 'ldNoise', 'ldProf', 'ldTag', 'ldSweep', 'ldPois', 'ldZt', 'ldZtP', 'ldZf', 'ldZfl', 'ldZc', 'ldZn', 'ldZp', 'ldZx', 'ldZl', 'ldRec', 'ldPos', 'ldGsd', 'ldPhase', 'ldStamp', 'ldStampT', 'ldStampS', 'ldTick', 'ldOp', 'ldTitle', 'ldSub', 'ldKm', 'ldLog', 'ldPct', 'ldRule', 'ldTip', 'ldTipN', 'ldMemo', 'ldCancel']) E[k] = document.getElementById(k);
    // 한 번만 그리는 작은 그림 (CSS 가 크게 늘려 움직임 — 큰 층을 새로 그리지 않는다)
    //  잡음: 푸른 점이 드문드문(가끔 밝은 가로 줄 — 전파 간섭) · 도장 얼룩(가면): 16% 칸만 옅게 · 회전 탐지 부채꼴 (앞쪽 선은 또렷하게 CSS .ld-swl)
    { const c = E.ldNoise, g = c.getContext('2d'), im = g.createImageData(c.width, c.height), d = im.data, cw = c.width;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random(), y = (i / 4 / cw) | 0, band = (y * 7919) % 23 === 0 ? 0.2 : 0; d[i] = 140 + 90 * v; d[i + 1] = 182 + 64 * v; d[i + 2] = 210 + 45 * v; d[i + 3] = (v * v * 0.62 + band * v) * 255; }
      g.putImageData(im, 0, 0); }
    { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), im = g.createImageData(64, 64), d = im.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random(); d[i + 3] = v < 0.16 ? 30 + v * 600 : 255; }
      g.putImageData(im, 0, 0); const u = 'url(' + c.toDataURL() + ')', st = E.ldStamp.style; st.webkitMaskImage = st.maskImage = u; st.webkitMaskSize = st.maskSize = '64px 64px'; }
    { const c = E.ldSweep, g = c.getContext('2d'), R = c.width / 2, A = 1.5, N = 90;
      for (let i = 0; i < N; i++) { const a1 = -Math.PI / 2 - A + (i + 1) / N * A; g.fillStyle = `rgba(130, 200, 255, ${(i / N) ** 2.2 * 0.34})`; g.beginPath(); g.moveTo(R, R); g.arc(R, R, R, a1 - A / N - 0.004, a1); g.closePath(); g.fill(); } }
    // 같이 하기로 돌아오는 중 가림막의 '로비로' (hold 의 onCancel)
    E.ldCancel.addEventListener('click', () => { const f = S && S.onCancel; if (!f) return; S.onCancel = null; E.ldCancel.hidden = true; try { f(); } catch (e) { console.error(e); } });
    return E;
  }

  // ---------- 보이기 ----------
  // o: { title, sub, tip(고정 글) | tips(돌아가며), mapId, kind: 'br'|'training'|'dm'|'hold' }
  function show(o) {
    o = o || {}; const e = els(); teardown();
    const t = now(), rm = mq('(prefers-reduced-motion: reduce)'); marks = {};
    S = { o, t0: t, kind: o.kind || 'br', rm, maxLines: mq('(max-height: 520px), (max-width: 860px)') ? 4 : 6, target: 0, shown: 0, pc: -1, label: '', lines: [], timers: new Set(), raf: 0, ft: t, txtT: 0, hdg: -1,
      w: null, view: null, R: 0, idx: null, pal: null, py: 0, rows: 0, scan: false, scanned: false, curF: 0, lastT: t, hmax: 0, roads: false, bldN: 0, rectN: 0, treeN: 0, treeImg: null, mini: false,
      pois: new Map(), tgtI: 0, tgtT: 0, tips: o.tips && o.tips.length ? o.tips : null, tipI: 0, tipT: 0, fin: false, out: false, onCancel: null };
    const r = e.loading; r.classList.remove('fin', 'out', 'q'); r.hidden = false;
    e.ldSat.className = 'ld-sat acq';
    e.ldTitle.textContent = String(o.title || '').replace(/\s*\(.*\)$/, '');
    e.ldSub.textContent = o.sub || '';
    const M = o.mapId && MAPS[o.mapId]; e.ldKm.textContent = !M ? '' : M.arena ? '72×72m' : mapKm(o.mapId); e.ldKm.hidden = !M;
    e.ldOp.textContent = 'OP-' + String(((M ? M.seed : 4093) * 7 + 1009) % 10000).padStart(4, '0');
    e.ldLog.textContent = ''; e.ldPois.textContent = ''; e.ldTag.textContent = ''; e.ldPos.textContent = 'X +000 · Z +000'; e.ldGsd.textContent = 'GSD —';
    e.ldPhase.textContent = '위성 연결 중'; e.ldPct.textContent = '0'; e.ldRule.style.transform = 'scaleX(0)'; e.ldCancel.hidden = true;
    // 녹화 시계: 숫자 띠를 CSS 로 올림(합성 스레드 — 맵 생성이 주 스레드를 잡아도 흐름) · 새 요소라 0부터 · 동작 줄이기는 frame 이 글로
    if (rm) e.ldRec.textContent = 'REC 00:00.0'; else e.ldRec.innerHTML = 'REC 0' + dg(10, 'm') + ':' + dg(6, 's6') + dg(10, 's') + '.' + dg(10, 't');
    const cu = e.ldCur.style; cu.transition = 'none'; cu.transform = 'translateY(0)'; cu.opacity = '';
    // 캔버스: 도로·건물·미니맵은 위성 화면 실제 크기 × 화면 배율(최대 2) · 지형·나무는 맵을 알게 되면(attach) 높이맵 칸 수에 맞춰
    const cw = e.ldSat.clientWidth || 480, V = Math.round(clamp(cw * Math.min(2, window.devicePixelRatio || 1), 256, 1024));
    for (const c of [e.ldRoad, e.ldBld, e.ldMap]) { c.width = c.height = V; c.classList.remove('on'); }
    for (const c of [e.ldTerr, e.ldTree]) { c.width = c.height = 1; c.classList.remove('on'); }
    // 작전 메모: 배틀로얄은 TIPS 를 6초마다 (처음은 무작위), 훈련장·데스매치는 넘겨받은 글 하나
    e.ldMemo.hidden = !S.tips && !o.tip;
    if (S.tips) { S.tipI = Math.floor(Math.random() * S.tips.length); setTip(); S.tipT = setInterval(nextTip, 6000); }
    else { e.ldTip.textContent = o.tip || ''; e.ldTipN.textContent = ''; }
    // 기록 첫 줄: 위성에 내린 명령 (진짜 맵 시드)
    { const li = document.createElement('li'); li.className = 'cmd'; li.innerHTML = '<time></time><span></span>'; li.firstChild.textContent = clock(0);
      li.lastChild.textContent = `SAT-1 › ${o.kind === 'hold' ? '경기 상태 요청' : '지형 생성 명령'}` + (M ? ` · 시드 ${M.seed}` : ''); e.ldLog.appendChild(li); }
    ticker();
    S.raf = requestAnimationFrame(frame);
  }
  function setTip() { E.ldTip.textContent = S.tips[S.tipI]; E.ldTipN.textContent = String(S.tipI + 1).padStart(2, '0') + ' / ' + String(S.tips.length).padStart(2, '0'); }
  // 다음 메모: 글은 바로 바꾸고 나타나는 움직임만 (합성 스레드 — 생성이 길게 잡아도 빈칸이 생기지 않음)
  function nextTip() {
    try {
      if (!S || !S.tips || S.fin) return;
      S.tipI = (S.tipI + 1) % S.tips.length; setTip();
      if (!S.rm && E.ldTip.animate) E.ldTip.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
    } catch (e) { fail(e); }
  }
  // 위성 화면 아래 흐르는 원격 측정 줄 (같은 글 두 벌 — 절반 옮기면 처음과 같아 끊김 없이 돈다)
  function ticker() {
    const w = S.w, v = S.view, a = ['LDR SAT-1', '궤도 412KM'];
    if (v) a.push(`관측 폭 ${v.span >= 1000 ? (v.span / 1000).toFixed(1) + 'KM' : v.span + 'M'}`, `해상도 ${HF_RES}M`);
    if (w) { if (w.pois.length) a.push(`지역 ${w.pois.length}곳`); if (S.roads) a.push(`도로 ${w.roads.length}구간`); if (S.bldN) a.push(`건물 ${fmtN(S.bldN)}동`); if (S.treeN) a.push(`나무 ${fmtN(S.treeN)}그루`); }
    a.push(`수신율 ${(97.2 + Math.random() * 2.6).toFixed(1)}%`);
    const s = a.join('   ▸   '); E.ldTick.innerHTML = '<span></span><span></span>'; E.ldTick.firstChild.textContent = s; E.ldTick.lastChild.textContent = s;
  }

  // ---------- 진행 (generateWorld progress) ----------
  function prog(p, label, info) {
    if (!S || S.fin || S.out) return;
    const t = now();
    if (label && !(label in marks)) marks[label] = t;
    if (p > S.target) S.target = Math.min(1, p);
    if (W && W !== S.w && W.hf && W.surf) attach(W);   // 지금 만드는 월드 (startMatch 가 setMapSize 뒤에 부름)
    if (label && label !== S.label) stage(label, t);
    if (S.w) feed(label, info, t);
  }
  // 맵을 알게 됨: 보이는 범위(아레나는 72m 경기장만 크게) · 지형 캔버스 크기 = 보이는 높이맵 칸 수(96~512) · 열/줄 → 높이맵 칸 번호
  function attach(w) {
    S.w = w; S.pal = null;   // 색표는 첫 줄을 칠할 때 (paint)
    const M = MAPS[w.mapId] || {}, span = M.arena ? 100 : SIZE, x0 = -span / 2;
    S.view = { x0, z0: x0, span }; E.ldSat.classList.toggle('zoom', !!M.arena);   // zoom: 아레나 — 미니맵 뒤에도 구조물 표시를 남김 (미니맵만으로는 바닥 무늬에 묻힘)
    const R = S.R = Math.round(clamp(Math.ceil(span / HF_RES) + 1, 96, 512));
    E.ldTerr.width = E.ldTerr.height = R; E.ldTree.width = E.ldTree.height = R; S.treeImg = null; S.treeN = 0; S.py = 0;
    S.idx = new Int32Array(R); for (let q = 0; q < R; q++) S.idx[q] = clamp(Math.round((x0 + (q + 0.5) / R * span + HALF) / HF_RES), 0, HF_N - 1);
    ticker();
  }
  function grid(x, z) { const v = S.view; return 'ABCDEFGH'[clamp(Math.floor((x - v.x0) / v.span * 8), 0, 7)] + (clamp(Math.floor((z - v.z0) / v.span * 8), 0, 7) + 1); }
  // 선분 (x0,y0)→(x1,y1) 을 0~1 정사각형 안으로 자름 (Liang–Barsky) — 밖이면 null
  function clipUnit(x0, y0, x1, y1) {
    let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0], [dx, 1 - x0], [-dy, y0], [dy, 1 - y0]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t1 - t0 > 0.02 ? [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1] : null;
  }
  const fx = (x) => (x - S.view.x0) / S.view.span, fz = (z) => (z - S.view.z0) / S.view.span;

  // 새 단계: 앞 줄은 '완료' + 결과 수, 새 줄은 타자 효과
  //  타자 효과는 글자마다 늦게 나타나는 CSS(opacity · 합성 스레드) — 글은 처음부터 다 들어 있어 생성이 주 스레드를 오래 잡아도 끝까지 쳐진다 · 커서는 다 친 뒤 깜빡임(--td)
  function stage(label, t) {
    const prev = S.lines[S.lines.length - 1]; if (prev) closeLine(prev);
    S.label = label;
    const li = document.createElement('li'); li.className = 'now';
    li.innerHTML = '<time></time><span class="l"></span><i class="d"></i><span class="x"></span><b class="ok">완료</b>';
    li.firstChild.textContent = clock(t - S.t0);
    const L = { label, li, sp: li.children[1], x: li.children[3], done: false };
    if (S.rm) L.sp.textContent = label;
    else { const ch = [...label], f = document.createDocumentFragment(); ch.forEach((c, i) => { const s = document.createElement('span'); s.textContent = c; s.style.animationDelay = i * TYPE_MS + 'ms'; f.appendChild(s); }); L.sp.appendChild(f); li.style.setProperty('--td', ch.length * TYPE_MS + 'ms'); }
    S.lines.push(L); E.ldLog.appendChild(li);
    // 위에서부터 쌓이고, 칸이 넘치면 오래된 줄부터 지움 (PC 6줄 · 휴대폰 4줄 — 높이는 CSS · 레이아웃을 묻지 않고 줄 수로)
    while (E.ldLog.children.length > S.maxLines) E.ldLog.removeChild(E.ldLog.firstChild);
    E.ldPhase.textContent = PHASE[label] || label;
    if (S.lines.length > 1) sfx('tick');
  }
  function closeLine(L) {
    if (L.done) return; L.done = true;
    L.sp.textContent = L.label; L.x.textContent = detail(L.label);
    L.li.classList.remove('now'); L.li.classList.add('done');
    if (/완료$/.test(L.label)) L.li.classList.add('nok');   // '준비 완료 ··· 완료' 처럼 겹치지 않게
  }
  // 끝난 단계의 결과 (그 단계가 만든 자료를 센다)
  function detail(label) {
    const w = S.w; if (!w) return '';
    switch (label) {
      case '지형 설계': { let m = 0; for (const r of w.roads) m += r.len || 0; return [w.pois.length ? `지역 ${w.pois.length}곳` : '', m > 0 ? `도로 ${(m / 1000).toFixed(1)}km` : ''].filter(Boolean).join(' · '); }
      case '높이맵 계산': return `${HF_N}×${HF_N}`;
      case '건물 배치': return w.buildings.length ? `건물 ${fmtN(w.buildings.length)}동` : '';
      case '숲과 바위 생성': case '눈 덮인 숲 생성': return w.trees && w.trees.length ? `나무 ${fmtN(w.trees.length)}그루` : '';
      case '미니맵 렌더링': return w.minimap ? `${w.minimap.width}px` : '';
      case '아이템 배치': return GROUND.length ? `보급품 ${fmtN(GROUND.length)}개` : '';
    }
    return '';
  }

  function feed(label, info, t) {
    const w = S.w;
    syncPois(w);
    if (label === '높이맵 계산') {
      if (!S.scan) { S.scan = true; S.lastT = t; E.ldSat.classList.remove('acq'); ticker(); }
      const rows = info && info.rows ? info.rows : 0;
      if (rows > S.rows) {
        S.rows = rows; paint(rows - 2);   // 마지막 줄은 다음 줄이 있어야 비탈을 앎 → 한 줄 늦게
        glide(t);
        E.ldTag.textContent = `ROW ${rows}/${HF_N}`;
        E.ldPos.textContent = `SCAN Z ${sgn(S.view.z0 + S.curF * S.view.span)} · ${grid(0, S.view.z0 + S.curF * S.view.span).slice(1)}행`;
      }
      return;
    }
    if (label === '지형 설계') return;
    if (!S.scanned) finishScan(t);   // 높이맵이 끝남 (다음 단계가 옴)
    if (!S.roads && w.roads.length) drawRoads(w);
    drawBlds(w);
    const tr = info && info.trees ? info.trees : w.trees;
    if (tr && tr.length) drawTrees(tr);
    if (!S.mini && w.minimap) showMini(w);
    revealRest();
    if (label === '준비 완료') E.ldSat.classList.remove('sweep');
  }

  // 높이맵 줄 칠하기: 아직 안 칠한 캔버스 줄 중 높이맵 칸 줄이 jMax 이하인 것 (미니맵 buildMinimapImage 와 같은 색·음영 · 물은 깊이로)
  function paint(jMax) {
    const R = S.R, idx = S.idx, w = S.w; let py1 = S.py;
    while (py1 < R && idx[py1] <= jMax) py1++;
    if (py1 <= S.py) return;
    const g = E.ldTerr.getContext('2d'), n = py1 - S.py, img = g.createImageData(R, n), d = img.data;
    const pal = S.pal || (S.pal = mapPalette(w));   // 여기서 정함: w.v2·w.xmas 는 첫 '높이맵 계산' 보고 전에 정해져 있음 (크리스마스 섬 눈 · 정글 숲바닥)
    const hf = w.hf, sf = w.surf, N = HF_N, k0 = 0.18 / HF_RES, inv = 1 / (2 * HF_RES), slT = w.v2 ? 1.05 : 0.75;
    for (let y = 0; y < n; y++) {
      const j = idx[S.py + y], jm = j > 0 ? j - 1 : 0, edgeJ = j < 1 || j > N - 2;
      for (let px = 0; px < R; px++) {
        const i = idx[px], k = j * N + i, h = hf[k], o = (y * R + px) * 4;
        if (h < WATER_Y) { const dd = Math.min(1, -h / 6); d[o] = 70 - 36 * dd; d[o + 1] = 130 - 52 * dd; d[o + 2] = 150 - 40 * dd; }
        else {
          let s = sf[k];
          if (!edgeJ && i > 0 && i < N - 1 && !NO_ROCK.has(s) && Math.max(Math.abs(hf[k + 1] - hf[k - 1]), Math.abs(hf[k + N] - hf[k - N])) * inv > slT) s = 2;
          const c = pal[s] || pal[0], hn = hf[jm * N + (i > 0 ? i - 1 : 0)];
          const sh = Math.min(1.25, Math.max(0.7, 1 + (hn - h) * k0)) * (0.9 + Math.min(0.25, Math.max(0, h / 80)));
          d[o] = c[0] * sh; d[o + 1] = c[1] * sh; d[o + 2] = c[2] * sh;
        }
        d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, S.py);
    S.py = py1;
  }
  // 주사선(가림막 윗변)을 칠한 곳까지 — 직전 보고 간격만큼 걸려 다음 보고가 올 즈음 닿는다
  function glide(t) {
    const f = S.py / S.R, dt = S.rm ? 0 : clamp(t - S.lastT, 60, 1600); S.lastT = t;
    revealUpTo(S.curF, f, dt);
    const cu = E.ldCur.style; cu.transition = dt ? `transform ${Math.round(dt)}ms linear` : 'none'; cu.transform = `translateY(${(f * 100).toFixed(3)}%)`;
    S.curF = f;
    if (S.py > 0) profile(S.idx[S.py - 1]);
  }
  // 고도 단면: 주사선 바로 밑에 방금 칠한 줄의 높이를 파형으로 (가림막과 함께 움직임) — 바다는 바닥선, 높이 눈금은 지금까지 본 가장 높은 곳
  function profile(j) {
    const c = E.ldProf, g = c.getContext('2d'), Wd = c.width, Hd = c.height, hf = S.w.hf, N = HF_N, v = S.view;
    let mx = S.hmax || 24; const hs = new Float32Array(Wd);
    for (let q = 0; q < Wd; q++) { const i = clamp(Math.round((v.x0 + (q + 0.5) / Wd * v.span + HALF) / HF_RES), 0, N - 1), h = hf[j * N + i]; hs[q] = h; if (h > mx) mx = h; }
    S.hmax = mx;
    const y = (h) => Hd - 1.5 - Math.max(0, h) / mx * (Hd - 6);
    g.clearRect(0, 0, Wd, Hd); g.beginPath(); g.moveTo(0, Hd);
    for (let q = 0; q < Wd; q++) g.lineTo(q + 0.5, y(hs[q]));
    g.lineTo(Wd, Hd); g.closePath(); g.fillStyle = 'rgba(120, 196, 255, 0.16)'; g.fill();
    g.beginPath(); for (let q = 0; q < Wd; q++) g[q ? 'lineTo' : 'moveTo'](q + 0.5, y(hs[q]));
    g.strokeStyle = 'rgba(200, 236, 255, 0.95)'; g.lineWidth = 1.2; g.stroke();
  }
  function finishScan(t) {
    S.scanned = true; S.scan = true; S.rows = HF_N; paint(HF_N - 1);
    const d = S.rm ? 0 : 420; revealUpTo(S.curF, 1.0001, d); S.curF = 1;
    const cu = E.ldCur.style; cu.transition = d ? `transform ${d}ms cubic-bezier(.45, 0, .85, .6), opacity .3s ${d}ms` : 'none'; cu.transform = 'translateY(100%)'; cu.opacity = '0';
    E.ldSat.classList.remove('acq'); E.ldSat.classList.add('sweep');
    E.ldTag.textContent = ''; ticker();
  }

  // 지역 표식 (DOM · 표식은 처음엔 숨김 — 주사선이 닿을 때 on)
  //  이름: 큰 지역(도시·군사기지 등 tier high/top)은 항상, 나머지는 지역이 14곳 이하일 때만 · 길가 마을·주유소(minor)는 작은 점만
  function syncPois(w) {
    if (S.pois.size >= w.pois.length) return;
    const major = w.pois.filter((p) => !p.minor).length;
    for (const p of w.pois) {
      if (S.pois.has(p)) continue;
      const a = fx(p.x), b = fz(p.z), el = document.createElement('div');
      if (a < -0.02 || a > 1.02 || b < -0.02 || b > 1.02) { S.pois.set(p, { on: true, el: null }); continue; }
      const hi = p.tier === 'high' || p.tier === 'top', lab = !p.minor && (hi || major <= 14);
      el.className = 'ld-poi' + (p.minor ? ' mi' : hi ? ' hi' : '') + (a > 0.72 ? ' l' : '');
      el.style.left = (a * 100).toFixed(2) + '%'; el.style.top = (b * 100).toFixed(2) + '%';
      el.appendChild(document.createElement('i'));
      if (lab && p.name) { const s = document.createElement('span'); s.textContent = p.name; el.appendChild(s); }
      E.ldPois.appendChild(el);
      S.pois.set(p, { on: false, el, fy: b, p });
    }
  }
  function revealUpTo(f0, f1, dt) {
    for (const P of S.pois.values()) if (!P.on && P.fy <= f1) {
      P.on = true; const dl = f1 > f0 ? clamp((P.fy - f0) / (f1 - f0), 0, 1) * dt : 0;
      P.el.style.setProperty('--d', Math.round(dl) + 'ms'); P.el.classList.add('on');
    }
  }
  // 주사선이 지나간 뒤에 생긴 지역 (훈련장 시설·아레나 구역 등) — 조금씩 시간차
  function revealRest() { let n = 0; for (const P of S.pois.values()) if (!P.on) { P.on = true; P.el.style.setProperty('--d', (S.rm ? 0 : n++ * 70) + 'ms'); P.el.classList.add('on'); } }

  // 도로: 종류·폭마다 경로 한 벌 → 어두운 테두리 + 밝은 심
  function drawRoads(w) {
    S.roads = true;
    const c = E.ldRoad, g = c.getContext('2d'), V = c.width, v = S.view, k = V / v.span, groups = new Map();
    for (const r of w.roads) { const key = (r.kind || 'main') + '|' + (r.width || 7); let P = groups.get(key); if (!P) groups.set(key, P = new Path2D()); P.moveTo((r.ax - v.x0) * k, (r.az - v.z0) * k); P.lineTo((r.bx - v.x0) * k, (r.bz - v.z0) * k); }
    const col = { main: '#f1e6c4', street: '#b3b0a4', dirt: '#d4b27e' }, edge = Math.max(1.4, V / 420);
    g.lineCap = g.lineJoin = 'round';
    for (const pass of [0, 1]) for (const [key, P] of groups) {
      const [kind, wd] = key.split('|'), lw = Math.max(1, +wd * k * 0.6);
      g.lineWidth = pass ? lw : lw + edge; g.strokeStyle = pass ? col[kind] || col.main : 'rgba(6, 12, 14, 0.7)'; g.stroke(P);
    }
    c.classList.add('on'); ticker();
  }
  // 건물·구조물: 호박색 칸 (처음 보일 때 깜빡이며 '식별') — 새로 생긴 것만 더 그림
  function drawBlds(w) {
    const B = w.buildings, MR = w.mapRects || [];
    if (B.length <= S.bldN && MR.length <= S.rectN) return;
    const c = E.ldBld, g = c.getContext('2d'), V = c.width, v = S.view, k = V / v.span, lw = Math.max(1, V / 640);
    g.fillStyle = 'rgba(240, 164, 58, 0.45)'; g.strokeStyle = 'rgba(255, 204, 128, 0.95)'; g.lineWidth = lw;
    const box = (x0, z0, x1, z1) => {
      let x = (x0 - v.x0) * k, y = (z0 - v.z0) * k, ww = (x1 - x0) * k, hh = (z1 - z0) * k;
      if (ww < 2) { x -= (2 - ww) / 2; ww = 2; } if (hh < 2) { y -= (2 - hh) / 2; hh = 2; }
      g.fillRect(x, y, ww, hh); if (ww > 5 && hh > 5) g.strokeRect(x + lw / 2, y + lw / 2, ww - lw, hh - lw);
    };
    for (let i = S.bldN; i < B.length; i++) { const r = B[i].rect; if (r) box(r[0], r[1], r[2], r[3]); }
    for (let i = S.rectN; i < MR.length; i++) { const r = MR[i]; box(r[0], r[1], r[2], r[3]); }
    S.bldN = B.length; S.rectN = MR.length;
    if (!c.classList.contains('on')) { c.classList.add('on'); sfx('scan'); }
    ticker();
  }
  // 나무: 지형 해상도의 점 (픽셀 버퍼에 새 나무만 찍고 한 번에 올림)
  function drawTrees(list) {
    if (list.length <= S.treeN) return;
    const R = S.R, v = S.view, k = R / v.span, g = E.ldTree.getContext('2d');
    if (!S.treeImg) S.treeImg = g.createImageData(R, R);
    const d = S.treeImg.data, snow = !!S.w.xmas, cr = snow ? 46 : 16, cg = snow ? 78 : 50, cb = snow ? 64 : 22;
    for (let i = S.treeN; i < list.length; i++) {
      const t = list[i], px = Math.floor((t.x - v.x0) * k), py = Math.floor((t.z - v.z0) * k);
      if (px < 0 || py < 0 || px >= R || py >= R) continue;
      const o = (py * R + px) * 4; d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = 220;
    }
    S.treeN = list.length; g.putImageData(S.treeImg, 0, 0);
    E.ldTree.classList.add('on');
  }
  // 진짜 미니맵으로 (보이는 범위만 잘라 위성 화면 크기로)
  function showMini(w) {
    S.mini = true;
    const c = E.ldMap, g = c.getContext('2d'), V = c.width, m = w.minimap, v = S.view, k = m.width / SIZE;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(m, (v.x0 + HALF) * k, (v.z0 + HALF) * k, v.span * k, v.span * k, 0, 0, V, V);
    E.ldSat.classList.add('mini'); E.ldSat.classList.remove('sweep');
  }

  // ---------- 매 화면 (글자만 · 0.045초마다) ----------
  function frame(ts) {
    if (!S) return;
    S.raf = requestAnimationFrame(frame);
    try {
      const t = now(), dt = Math.max(0, (t - S.ft) / 1000); S.ft = t;
      if (S.fin && !S.out) finTick(ts, t);
      // 진행률: 실제로 지난 시간만큼 따라감 — 생성 중에는 화면이 드물게 그려지므로 오래 비었으면 한 번에 따라잡음
      S.shown += (S.target - S.shown) * (1 - Math.exp(-dt * 7)); if (Math.abs(S.target - S.shown) < 0.002) S.shown = S.target;
      if (t - S.txtT < 45) return; S.txtT = t;
      const pc = Math.min(100, Math.floor(S.shown * 100 + 1e-6));
      if (pc !== S.pc) { S.pc = pc; E.ldPct.textContent = pc; }
      E.ldRule.style.transform = `scaleX(${S.shown.toFixed(3)})`;
      if (S.rm) E.ldRec.textContent = 'REC ' + clock(t - S.t0).slice(0, -1);
      if (!S.w || S.fin) return;
      const hd = Math.floor(47 + (t - S.t0) / 1000 * 1.7) % 360;
      if (hd !== S.hdg) { S.hdg = hd; E.ldGsd.textContent = `GSD ${HF_RES}M · HDG ${String(hd).padStart(3, '0')}°`; }
      // 스캔이 끝나면 왼쪽 아래 읽음값이 드러난 지역을 차례로 겨눔
      if (S.scanned && t - S.tgtT > 1300) {
        S.tgtT = t; const ps = [...S.pois.values()].filter((P) => P.el && P.p && !P.p.minor);
        if (ps.length) { const P = ps[S.tgtI++ % ps.length]; E.ldPos.textContent = `TGT ${P.p.name} · ${grid(P.p.x, P.p.z)}`; }
      }
    } catch (e) { fail(e); }
  }
  // 마지막 연출 시계: 연출이 실제로 화면에서 시작한 때부터 잰다 — 도장 애니메이션의 startTime (합성 스레드가 시작하며 알려 줌 · 경기 첫 화면(셰이더 준비)이 오래 걸리면 그만큼 늦음)
  //  아직 모르면 finale 뒤 두 번째 화면의 시작(ts)을 임시 기준으로 0.6초까지 기다림 (동작 줄이기는 애니메이션이 없어 바로 ts)
  //  소리도 같은 기준으로 WebAudio 에 예약 (자기장 고정음 · 도장 '쾅') · 사라짐은 경기 화면이 3번 그려지고 도장이 다 보인 뒤
  function finTick(ts, t) {
    S.finN++;
    if (S.finN === 2) S.finT = Math.min(t, ts || t);
    if (S.finN >= 2 && !S.finOk) {
      let st = null; try { const a = E.ldStamp.getAnimations()[0]; if (a && a.startTime != null) st = a.startTime; } catch (e) { /* 모름 */ }
      if (st != null || S.rm || t - S.finT > 600) {
        S.finOk = true; if (st != null) S.finT = st;
        const late = t - S.finT, F = S.F;
        if (S.Z0) sfx('lock', Math.max(0, F.lock - late) / 1000);
        sfx('stamp', Math.max(0, F.stamp - late) / 1000);
      }
    }
    if (S.finOk && S.finN >= 3 && t - S.finT >= S.finMin) fadeOut();
  }

  // ---------- 끝 ----------
  const zoneOk = () => !!(S.view && Zone.cur && Zone.next);
  // 이어하기·다시 들어오기는 지금 단계의 구역일 수 있음
  const zoneWord = () => (Zone.phase > 0 ? '다음 안전 구역' : '첫 안전 구역');
  const zoneSub = () => `${zoneWord()} ${grid(Zone.next.x, Zone.next.z)} · 반경 ${Math.round(Zone.next.r)}m`;
  const pc = (f) => (f * 100).toFixed(2) + '%';
  // 자기장: 파란 원(Zone.cur · 바깥은 푸르게) · 흰 원(Zone.next) + 십자 + 이름표 — .zon 이 붙는 때 움직임 시작 (CSS)
  function drawZone() {
    const e = E, v = S.view, Z = Zone;
    const place = (el, c) => { const s = el.style; s.left = pc(fx(c.x - c.r)); s.top = pc(fz(c.z - c.r)); s.width = s.height = pc(c.r * 2 / v.span); };
    place(e.ldZc, Z.cur); place(e.ldZn, Z.next); place(e.ldZp, Z.next);
    e.ldZx.style.left = pc(fx(Z.next.x)); e.ldZx.style.top = pc(fz(Z.next.z));
    // 이름표는 흰 원 윗변 바깥 (가운데 도장과 겹치지 않게) · 윗변이 위성 화면 맨 위(상태 글 자리)에 가까우면 아랫변 바깥 · 화면 안으로
    const up = fz(Z.next.z - Z.next.r) > 0.16; e.ldZl.textContent = `${zoneWord()} ${grid(Z.next.x, Z.next.z)}`;
    e.ldZl.style.left = pc(clamp(fx(Z.next.x), 0.12, 0.88)); e.ldZl.style.top = pc(clamp(fz(Z.next.z + (up ? -Z.next.r : Z.next.r)), 0.08, 0.92)); e.ldZl.classList.toggle('dn', !up);
    const c = Z.cur; e.ldZt.setAttribute('viewBox', `${v.x0} ${v.z0} ${v.span} ${v.span}`);
    e.ldZtP.setAttribute('d', `M${v.x0} ${v.z0}h${v.span}v${v.span}h${-v.span}Z M${c.x - c.r} ${c.z}a${c.r} ${c.r} 0 1 0 ${2 * c.r} 0a${c.r} ${c.r} 0 1 0 ${-2 * c.r} 0Z`);
    e.ldPos.textContent = `ZONE ${grid(Z.next.x, Z.next.z)} · R ${Math.round(Z.next.r)}M`;
    e.ldSat.classList.add('zon'); S.Z = true;
  }
  // 경기 시작 직전 (startMatch · Training.start · DM.start 끝 — 그 뒤 바로 G.state = 'play'): 첫 자기장 → 도장 → 사라짐 (경기 진행은 기다리지 않고 화면만 겹친다)
  //  zone: true = 지금 Zone.cur·next 를 그림 · 'wait' = 같이 하기 파티원(이 기기의 Zone 은 아직 방장 것이 아님) — 방장 자기장이 오면 zone() 이 그림
  //  plane: 비행 경로(G.plane) · stamp: 도장 글 · sub: 도장 아래 작은 글 · quick: 진행 중인 경기를 여는 경우(이어하기·다시 들어오기)와 데스매치 — 바로 도장 · 짧게
  function finale(o) {
    if (!S || S.fin || S.out) return;
    o = o || {}; const e = E, t = now(), q = !!o.quick;
    if (S.w) { if (!S.scanned) finishScan(t); if (!S.roads && S.w.roads.length) drawRoads(S.w); drawBlds(S.w); if (!S.mini && S.w.minimap) showMini(S.w); revealRest(); }
    S.fin = true; S.target = 1; S.Z = false; S.sub = o.sub || ''; S.quick = q; S.zWait = o.zone === 'wait';
    if (o.zone === true && zoneOk()) drawZone();
    // 비행 경로 (배틀로얄 시작): 수송기가 지나갈 직선을 위성 화면 가장자리까지 잘라 점선 + 화살표 — 바깥 div 는 회전만, 안쪽이 늘어남(합성 스레드)
    const v = S.view, pl = o.plane && v && G.plane, seg = pl ? clipUnit(fx(pl.ax), fz(pl.az), fx(pl.bx), fz(pl.bz)) : null;
    e.ldZf.hidden = e.ldZfl.hidden = !seg;
    if (seg) {
      const [x0, y0, x1, y1] = seg, len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), s = e.ldZf.style;
      s.left = pc(x0); s.top = pc(y0); s.width = pc(len); s.transform = `rotate(${a.toFixed(4)}rad)`;
      const lx = x0 + (x1 - x0) * 0.14 - Math.sin(a) * 0.035, ly = y0 + (y1 - y0) * 0.14 + Math.cos(a) * 0.035;
      e.ldZfl.style.left = pc(clamp(lx, 0.08, 0.92)); e.ldZfl.style.top = pc(clamp(ly, 0.05, 0.95));
    }
    const st = o.stamp || '준비 완료';
    stage(st, t); const L = S.lines[S.lines.length - 1]; closeLine(L); L.li.classList.add('fin');
    e.ldPhase.textContent = S.Z ? '자기장 정보 수신' : '작전 개시';
    e.ldStampT.textContent = st; e.ldStampS.textContent = S.sub || (S.Z ? zoneSub() : '');
    e.ldSat.classList.remove('sweep', 'acq'); e.ldSat.classList.add('fin'); if (!S.Z) e.ldSat.classList.add('nz'); if (q) e.ldSat.classList.add('q');
    e.loading.classList.add('fin'); e.loading.classList.toggle('q', q); e.ldCancel.hidden = true; S.onCancel = null;
    clearInterval(S.tipT);
    // 시계는 finTick 이 화면에 오른 때부터 · 화면이 아예 그려지지 않는 상태(탭 숨김 등)가 길면 그래도 사라짐
    S.F = q ? FIN.quick : S.Z ? FIN.zone : FIN.nz; S.Z0 = S.Z; S.finN = 0; S.finT = 0; S.finOk = false; S.finMin = S.F.out;
    later(fadeOut, 9000);
  }
  // 같이 하기 파티원: 방장이 보낸 자기장이 도착함 (10_net.js applyZone — welcome · zone) — 마지막 연출 중이면 그때 그림
  function zone() {
    if (!S || !S.fin || S.out || !S.zWait || !zoneOk()) return;
    S.zWait = false; drawZone();
    E.ldPhase.textContent = '자기장 정보 수신';
    if (!S.sub) E.ldStampS.textContent = zoneSub();
    if (S.finN < 1) { E.ldSat.classList.remove('nz'); S.F = S.quick ? FIN.quick : FIN.zone; S.Z0 = true; S.finMin = S.F.out; return; }   // 아직 화면에 오르기 전: 처음부터 자기장 순서대로
    // 이미 도장이 나오는 중(도장 지연은 그대로 — 바꾸면 깜빡임): 자기장이 다 그려지고 잠깐 보일 때까지 (화면에 오른 뒤 최대 2.1초)
    sfx('lock', S.quick ? 0 : 0.3);
    S.finMin = Math.min(2100, Math.max(S.finMin, (S.finT ? now() - S.finT : 0) + (S.quick ? 450 : 900)));
  }
  function fadeOut() { if (!S || S.out) return; S.out = true; E.loading.classList.add('out'); later(hideNow, S.quick ? 340 : 540); }
  // 같이 하기로 돌아온 사람: 방장이 지금 상태를 보낼 때까지 가림막 (10_resume.js — 0.3초마다 불려도 같음) · onCancel: '로비로' 단추 (기다리다 그만두기)
  function hold(label, onCancel) {
    label = label || '경기 상태를 받는 중…';
    if (!S || S.fin || S.out) {
      const w = W, M = w && MAPS[w.mapId];
      show({ title: M ? M.name : '', sub: '경기에 다시 연결', mapId: w ? w.mapId : null, kind: 'hold' });
      if (w && w.hf && w.surf) { attach(w); syncPois(w); S.scan = true; finishScan(now()); E.ldCur.style.transition = 'none'; if (w.minimap) showMini(w); revealRest(); }
    }
    if (S.label !== label) stage(label, now());
    S.target = Math.max(S.target, 0.99);
    E.ldPhase.textContent = '경기 상태 수신 중';
    if (onCancel) { S.onCancel = onCancel; if (E.ldCancel.hidden) { E.ldCancel.hidden = false; E.ldMemo.hidden = true; clearInterval(S.tipT); } }
  }
  // 도장 없이 사라짐 / 바로 숨김(오류 · 로비로)
  const hide = () => fadeOut();
  function hideNow() {
    const e = els(); teardown();
    e.loading.hidden = true; e.loading.classList.remove('fin', 'out', 'q');
    e.ldSat.className = 'ld-sat'; e.ldPois.textContent = ''; e.ldLog.textContent = ''; e.ldCancel.hidden = true;
    for (const c of [e.ldTerr, e.ldTree, e.ldRoad, e.ldBld, e.ldMap]) { c.width = c.height = 1; c.classList.remove('on'); }   // 큰 캔버스 메모리 반납
    const cu = e.ldCur.style; cu.transition = 'none'; cu.transform = ''; cu.opacity = '';
  }
  function teardown() {
    if (!S) return; const s = S; S = null;
    cancelAnimationFrame(s.raf); for (const id of s.timers) clearTimeout(id); s.timers.clear(); clearInterval(s.tipT);
  }
  // 꾸밈 화면 오류: 경기는 그대로 두고 화면만 걷음
  function fail(err) { console.warn('로딩 화면 오류 — 화면만 걷음', err); try { hideNow(); } catch (e) { try { teardown(); document.getElementById('loading').hidden = true; } catch (e2) { /* 그대로 */ } } }
  const safe = (fn) => (...a) => { try { return fn(...a); } catch (e) { fail(e); } };
  // 로딩 화면이 화면을 다 덮고 있음 (도장·사라지는 중이면 아님) — 11_game.js loop 가 로비 3D 를 건너뜀
  const covers = () => !!S && !S.fin && !S.out;
  return { show: safe(show), prog: safe(prog), hold: safe(hold), finale: safe(finale), zone: safe(zone), hide: safe(hide), hideNow: safe(hideNow), covers, brSub, get marks() { return marks; } };
})();
