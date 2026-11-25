// ============================================================
// 09_player_mskin.js — v23 근접 무기 스킨 전용 동작 (식칼·마체테·프라이팬·쇠지렛대의 모든 스킨 — 스킨마다 동작표는 09_player_mskin_<무기>.js)
//  · 상태: 꺼내기(equip) · 대기(idle — 숨 쉬듯 흔들리고 가끔 손을 고쳐 쥠) · 휘두르기(attack — 이어서 휘두르면 두 동작을 번갈아)
//          · 살펴보기(inspect — N · 모바일은 든 근접 무기 칸, 여러 개면 무작위로 하나 · 방금 한 것은 빼고) · 넣기(unequip — 1인칭)
//    캐릭터마다 c.ka 하나가 상태·시간을 들고(04_motion.js animateChar 에서 프레임마다 한 번 tick), 1인칭 뷰모델(09_player.js updateMeleeVM)과
//    3인칭 몸(04_motion.js actPose · 손에 든 모델)이 같은 줄(row)을 각자의 좌표로 옮겨 그린다
//  · 줄 = 기본 자세(무기마다 원래 1인칭 자리 VMK_READY · VMK_PAN · VMK_CROW — 화면 위 자리·크기가 그대로)에서 얼마나 벗어났나:
//    [u, 손 자리 3 (m · 카메라 공간 x 오른쪽, y 위, z 앞 — 손 전체 = 뿌리 Root),
//        손목 3 (rad · 손목 관절을 중심으로 손 로컬 축: x = 손바닥 축(날이 날·등 쪽으로 기욺), y = 팔뚝 축(손목 비틀기), z = 엄지·날 축(손목 꺾기)),
//        손가락 5 (굽힘 — 가운데·약지·새끼 두 마디, 검지 두 마디, 엄지(1 = 주먹처럼 접음, 0 = 폄)),
//        부품 4 (관절 모델 — 나비 나이프 [날, 손잡이 B, 걸쇠, 손 안에서 앞으로 미끄러진 m] · 카람빗 [검지(고리) 둘레 회전]),
//        무기 회전 3 (rad · 손 안에서 회전 중심을 축으로 손 로컬 x·y·z — Euler XYZ), 무기 이동 3 (m · 손 안에서 — 던졌다 받기),
//        회전 중심 3 (모델 좌표 m — 없으면 동작표 pivot, 그것도 없으면 쥔 점), 3인칭 손 기울임 3 (동작표 tt 에서 · 키프레임에는 없음)]
//    키프레임 사이는 Catmull-Rom (kfSample) · 손 자리·손목은 상태의 amp 로 키우고 줄임
//  · 상태가 바뀌면 바뀌기 직전 줄을 붙잡아 두고 짧게 섞어 넘어간다(순간이동 없음) · 부품·무기 회전은 2π 를 더하고 빼 새 상태와 가까운 쪽에서 섞음
//  · 맞히는 시간·거리·피해·쿨타임·꺼내는 시간은 기본 무기와 똑같다 — 휘두르기 줄의 u = 휘두른 시간 / 전체 시간,
//    화면 숙임도 기본 무기 그대로(근접 판정 방향 = 카메라 앞) · 옆 기울임만 동작마다
//  · 소리: 동작표의 S = [[u, 이름], …] (내 캐릭터의 꺼내기·대기 손장난·살펴보기·넣기·휘두르기 중) — 이름은 동작표 snd 의 소리(Audio.mskin) 또는 Audio.knife 의 것
//  · 달리기 자세(선택 — 동작표 run): 대기 중 달리면 1인칭 줄(run.fp)·3인칭 자세(run.tp)로 섞어 넘어감 (없는 스킨은 기본처럼 손을 내림 · 허리 옆으로)
//    섞는 정도 ka.rw = 달리는 정도(ka.sg — 달리려 하고(내 캐릭터 = 달리기 키·모바일 달리기 + 앞으로: 사격 버튼을 누르는 동안 꺼지는 c.sprint 대신 · 다른 캐릭터 = c.sprint) 빠름 ·
//      공중에서도 그대로라 달리다 뛰어도 풀리지 않음 · 휘두르는 동안에도 따라감) × 상태마다: 대기·살펴보기 = 1 ·
//    휘두르기 = 달리며 휘두르기 줄(attack[i].run)이 있으면 휘두르기를 시작할 때의 섞는 정도(ka.sa)로 그 줄(달리기 줄에서 시작해 달리기 줄로 끝남 — 사격 버튼을 눌러도
//      손이 대기 자세 쪽으로 뒤집히지 않음) · 도중에 달리기를 멈췄으면 두 줄이 같은 손등 위·날 오른쪽 자세인 찌르기·찢기 구간(u 0.4~0.56)에서 서서 휘두르는 줄로
//      넘겨줘 대기 자세로 끝남 (달리다 멈춰 사격 버튼을 누르고 있으면 다음 휘두르기부터 서서 휘두르기 — 휘두르는 횟수·프레임 빠르기가 아니라 시간으로 풀림) /
//      없으면 달리던 자세를 붙잡고 있다가 휘두르는 줄이 그 자세를 이어받는 무렵(u 0.26~0.36) 넘겨주고 찢고 난 마무리(u 0.46~0.75)에 다시 ·
//    꺼내기 = 끝무렵(u 0.75)부터 달리기를 시작할 때처럼 · 넣기 = 0
//  · 3인칭 휘두르기(선택 — 동작표 attack[i].tp): MEL_KF 형식 줄이 있으면 손 자리·허리·왼손·팔꿈치는 그 줄로 (없으면 기본 3인칭 찌르기 궤적)
//  · 3인칭 손 기울임(선택 — 꺼내기·살펴보기·넣기·휘두르기 줄의 tt): [[u0, u1, u2, u3, rx, ry, rz], …] — u0~u1 동안 들어가고 u2~u3 동안 풀리는
//    가슴 로컬(x 왼쪽, y 위, z 앞) 회전 벡터(축 × 각 rad)로 3인칭 손 방향만 돌림 (손바닥 자리·1인칭은 그대로) — 1인칭 손목 각을 가슴 앞으로 그대로 옮기면
//    돌리는 면이 팔뚝을 가로지르거나 가슴 앞에 선 원판으로 보이는 구간을 3인칭에서만 눕힘 · 줄의 끝 3칸(ITT)이라 상태가 바뀌면 섞여 풀림(끊겨도 튀지 않음 ·
//    섞는 시간이 짧아도 이 칸만은 0.15초(TTB) 이상 — 휘두르기로 끊어도 눕힌 손이 2 프레임 만에 세워지지 않음)
//  · 달리며 꺼내기(동작표에 달리기 자세가 없는 스킨): 꺼내는 동안은 끝무렵(u 0.8~1)에야 기본처럼 손을 내림 — 달리며 꺼내도 꺼내는 동작이 서 있을 때처럼 다 보이고
//    다 꺼낼 무렵 달리기 자세로 내려감 (내리는 비율 ka.rq 는 상태가 바뀔 때 부드럽게 따라감 · 꺼내다 휘두르면 휘두르는 동안 그대로)
//  · 나비 나이프 끊김 섞기(enter → balFrom · balX, tick → balRow · balSnd): 경첩을 지키는 2π 배수 · 섞는 시간 · 손가락을 놓았다 쥠 · 소리 · 닫힌 칼 넣기 — balX 위 설명
// ============================================================
const KAnim = (() => {
  const PI = Math.PI, P2 = PI * 2, NV = 27, IR = 3, IF = 6, IP = 11, IW = 15, IT = 18, IV = 21, ITT = 24;
  const SPIN = [11, 12, 13, 14, 15, 16, 17];   // 2π 맞춤 채널 (부품 · 무기 회전)
  const F_GRIP = [1.72, 1.62, 1.58, 1.42, 1.0];   // 기본 쥠 (엄지 1 = 주먹처럼 접음)
  const SPEC = {};   // 모양 id → 동작표 (def 로 등록)
  // 무기마다 원래 1인칭 기본 자세 [u, 손 3, 날 방향 3, 때리는 쪽 3] (09_player.js) · 3인칭 준비 자세 (04_motion.js)
  const VBASE = { knife: VMK_READY, machete: VMK_READY, pan: VMK_PAN, crowbar: VMK_CROW };
  const TREADY = { knife: MEL_READY, machete: MEL_READY, pan: PAN_READY, crowbar: CROW_READY };

  // ---------- 동작표 쓰기 ----------
  //  K(u, 손[3], 손목[3], 손가락[5], 부품[4], 무기 회전[3], 무기 이동[3], 회전 중심[3]) — 빠진 것은 0 (손가락은 동작표의 기본 쥠 · 회전 중심은 동작표 pivot, 대기 손장난(fid)은 0 = 그대로)
  //   회전 중심(모델 좌표 m)도 줄마다 섞이므로, 무기 회전이 0(2π)인 줄에서 바꾸면 튀지 않는다 (손잡이 둘레 돌리기 ↔ 검지 둘레 돌리기)
  function K(u, h, r, f, p, w, t, v) { return { u, h, r, f, p, w, t, v }; }
  // 방향으로 쓰는 줄: KO(u, 손 자리[3], 날(엄지) 방향 b[3], 손가락 쪽 e[3], 손가락, 부품, 무기 회전, 무기 이동, 회전 중심) — b·e 는 카메라 공간(x 오른쪽, y 위, z 앞)
  //  → 그 방향이 되는 손목 회전과, 손바닥이 (기본 자리 + 손 자리)에 오게 하는 손 자리를 등록할 때 한 번 계산 (손목을 돌려도 무기가 제자리에)
  function KO(u, h, b, e, f, p, w, t, v) { return { u, h, ob: b, oe: e, f, p, w, t, v }; }
  const _oB = new THREE.Vector3(), _oE = new THREE.Vector3(), _oQ = new THREE.Quaternion(), _oR = new THREE.Quaternion(), _oEu = new THREE.Euler(0, 0, 0, 'YXZ'), _oW = new THREE.Vector3(), _oP = new THREE.Vector3();
  function rowOf(k, F0, add, S, prev) {
    const o = new Array(NV + 1).fill(0); o[0] = k.u;
    const put = (a, i, n) => { if (a) for (let j = 0; j < n; j++) o[1 + i + j] = a[j] || 0; };
    put(k.h, 0, 3); put(k.r, IR, 3); put(k.p, IP, 4); put(k.w, IW, 3); put(k.t, IT, 3); put(k.v || (add || !S ? null : S.pivot), IV, 3);
    for (let j = 0; j < 5; j++) o[1 + IF + j] = k.f ? k.f[j] : add ? 0 : F0[j];
    if (k.ob && S) {
      bladeQuat(_oQ, _oB.set(k.ob[0], k.ob[1], -k.ob[2]), _oE.set(k.oe[0], k.oe[1], -k.oe[2]));
      _oR.copy(S.Q0).invert().multiply(_oQ); _oEu.setFromQuaternion(_oR, 'YXZ');
      const r = [_oEu.x, _oEu.y, _oEu.z];
      // 앞 줄과 가까운 각으로 (2π 맞춤 — 손목이 반대로 한 바퀴 돌지 않게)
      for (let j = 0; j < 3; j++) { if (prev) r[j] += P2 * Math.round((prev[1 + IR + j] - r[j]) / P2); o[1 + IR + j] = r[j]; }
      // 손바닥 자리: 기본 손목 관절 + 새 방향의 손바닥 → (기본 자리 + 손 자리)와의 차이를 손 자리로
      _oW.copy(PALM.R).multiplyScalar(VM_SC).applyQuaternion(S.Q0); _oW.subVectors(S.P0, _oW);
      _oP.copy(PALM.R).multiplyScalar(VM_SC).applyQuaternion(_oQ).add(_oW);
      const h = k.h || [0, 0, 0];
      o[1] = S.P0.x + h[0] - _oP.x; o[2] = S.P0.y + h[1] - _oP.y; o[3] = -(S.P0.z - h[2] - _oP.z);
    }
    return o;
  }
  // 기본 꺼내기(아래에서 올라옴)·넣기(아래로) — 동작표에 없으면
  const DEF = {
    equip: { dur: 0.45, K: [K(0, [0.04, -0.36, -0.03], [0.5, 0, 0]), K(0.62, [0, 0.01, 0], [-0.05, 0, 0]), K(1)] },
    unequip: { dur: 0.2, K: [K(0), K(0.5, [0.02, -0.12, -0.02], [0.35, 0, 0.1]), K(1, [0.06, -0.32, -0.06], [0.7, 0, 0.25])] },
  };
  // 동작표 등록 (09_player_mskin_<무기>.js):
  //  def(모양 id, { base: { h, b, e, f }(1인칭 기본 손 자리·날 방향·때리는 쪽·쥠 — 없으면 무기 기본), pivot: [x, y, z](무기 회전 중심, 모델 좌표 m),
  //    idle: { amp, speed, part(부품 0 흔들림), fid: [손장난 줄들 — 더하는 값], every: [최소, 최대 초] }, equip, unequip: { dur, speed, amp, K, S, tt(3인칭 손 기울임 — 머리말 · 살펴보기·휘두르기 줄도) },
  //    attack: [{ K, S, roll(옆 기울임 rad), kick(맞힘 흔들림 방향 ±1), tp(선택 — 3인칭 줄 MEL_KF 형식 [u, 19개] · 가슴 로컬 · 손 방향 칸은 쓰지 않음),
  //             run(선택 — 달리며 휘두를 때의 1인칭 줄 K·KO: 처음·끝은 run.fp 와 같은 줄 · 3인칭 손 방향도 이 줄을 따름) } …](u = 휘두른 시간 비율),
  //    inspect: [{ dur, speed, amp, K, S, gl: [[u0, u1] …](날을 따라 빛이 반짝 지나감) } …],
  //    snd: { 이름: [길이(초), 소리 조각들] }(Audio.mskin), swing: 휘두르는 소리 이름 또는 [첫째, 둘째], ghost: 잔상 빠르기 기준(m/s, 0 = 없음),
  //    run: { fp: 1인칭 달리기 줄(K·KO 하나 — 기본 내림·기울임 대신 이 줄이 손 자리·방향 전부), tp: 3인칭 달리기 자세(04_motion.js MEL_RUN 형식 [u, 19개] · 가슴 로컬),
  //           sw: 3인칭 걸음에 맞춰 어깨를 축으로 흔드는 폭(rad · 기본 0.4) }(선택) })
  function def(shape, sp) {
    const D = MSHAPE[shape]; if (!D) { console.warn('KAnim: 모양 없음', shape); return null; }
    const mid = D.melee, vb = VBASE[mid], b = sp.base || {}, F0 = b.f || F_GRIP;
    const S = { shape, mid, F0, h: b.h || [vb[1], vb[2], vb[3]], B: b.b || [vb[4], vb[5], vb[6]], E: b.e || [vb[7], vb[8], vb[9]], snd: sp.snd || {}, swing: sp.swing || null,
      ghost: sp.ghost !== undefined ? sp.ghost : 1.6, pivot: sp.pivot || null, idle: sp.idle || {}, kar: D.rig === 'karambit', bal: D.rig === 'balisong' };
    // 카메라 공간(z 뒤) 기본 손바닥 자리 · 손 방향
    S.P0 = new THREE.Vector3(S.h[0], S.h[1], -S.h[2]);
    S.Q0 = bladeQuat(new THREE.Quaternion(), new THREE.Vector3(S.B[0], S.B[1], -S.B[2]), new THREE.Vector3(S.E[0], S.E[1], -S.E[2]));
    //  손목 각(Euler)은 앞 줄과 2π 맞춤으로 이어 둔다 — 방향으로 쓴 줄(KO)이 크게 돌아 2π 근처에 닿은 뒤 기본 기준 줄(K)이 0 으로 돌아가면 손목이 한 바퀴 거꾸로 감기던 것을 막음 (같은 자세, 값만 이어짐)
    const tr = (t, add) => { if (!t) return null; const R = []; for (const k of t.K) { const r = Array.isArray(k) ? k : rowOf(k, F0, add, add ? null : S, R[R.length - 1]), p = R[R.length - 1]; if (p && !add) for (let j = 1 + IR; j < 4 + IR; j++) r[j] += P2 * Math.round((p[j] - r[j]) / P2); R.push(r); } return Object.assign({}, t, { R }); };
    S.equip = tr(sp.equip || DEF.equip); S.unequip = tr(sp.unequip || DEF.unequip);
    S.attack = (sp.attack || []).map((t) => { const a = tr(t); if (t.run) a.rr = tr({ K: t.run }).R; return a; }); S.inspect = (sp.inspect || []).map((t) => tr(t)); S.fid = (S.idle.fid || []).map((t) => tr(t, true));
    S.rest = rowOf(K(0), F0, false, S, null);
    S.run = sp.run ? { v: rowOf(sp.run.fp || K(0), F0, false, S, S.rest).slice(1), tp: sp.run.tp || null, sw: sp.run.sw !== undefined ? sp.run.sw : 0.4 } : null;
    SPEC[shape] = S; return S;
  }

  // ---------- 누가 무엇을 들었나 ----------
  // 이 근접 무기(id — 없으면 든 것·가진 것)에 전용 동작이 있는 스킨이면 그 모양 id, 아니면 null
  function kindOf(c, id) {
    if (!c || !c.look) return null;
    id = id || c.melee || (c.ka && c.ka.mid) || (c.inv && c.inv.melee); if (!id) return null;
    const sk = MeleeSkin.ofChar(c, id), S = sk && Body.SKINS[sk];
    return S && SPEC[S.shape] ? S.shape : null;
  }
  const canInspect = (c, id) => { const k = kindOf(c, id); return !!k && SPEC[k].inspect.length > 0; };
  // 꺼내는 소리를 동작표가 직접 내나 (그러면 기본 꺼내는 소리는 생략)
  const ownDraw = (c, id) => { const k = kindOf(c, id); return !!k && !!(SPEC[k].equip.S && SPEC[k].equip.S.length); };

  // ---------- 상태 ----------
  const _tg = new Array(NV).fill(0), _fd = new Array(NV).fill(0);
  const trackOf = (ka, st) => { const S = SPEC[ka.kind]; return st === 'attack' ? S.attack[ka.v] || S.attack[0] || null : st === 'inspect' ? S.inspect[ka.iv] || null : st === 'idle' ? null : S[st]; };
  // 방금 한 것(last)을 빼고 무작위 하나
  const pickOther = (n, last) => { if (n <= 1) return 0; if (last < 0 || last >= n) return Math.floor(Math.random() * n); let i = Math.floor(Math.random() * (n - 1)); if (i >= last) i++; return i; };
  // 나비 나이프: 섞기 시작 줄의 날(IP)·손잡이 B(IP+1)·칼 전체의 손 안 회전 w(IW)를 2π 배수 셋(가장 가까운 것과 ±1) 중에서 다시 고른다 —
  //  가장 가까운 2π 만 맞추면(Math.round(0.5) = 1) 접힌 날(−π)·힐릭스 막대의 B(−π)가 +π 로 가서, 짧은 섞기가 경첩이 막는 각을 지나고
  //  hinge() 가 그 부품을 반대쪽 멈춤으로 한 프레임에 튀게 했다 (닫힌 칼·막대에서 휘두르기·무기 바꾸기·달리기)
  //  → 섞는 동안의 실제 줄(새 상태의 목표 줄 쪽으로 섞이는 그대로)을 16 점에서 보고 날–A(날 + π)·날–B(B − 날 − π)가 0~π 안인 것만 · 그중 손 안에서 덜 도는 것
  //   (A 는 1.25 배 — 쥔 손잡이가 제자리 · B 를 쥔 자세는 w 와 B 가 함께 움직여 B 가 손 안 제자리) · 맞는 것이 없으면 원래대로
  //   닫힌 칼 → 펼침 = 날이 펴지는 동안 B 가 한 바퀴(진짜 여는 길) · 힐릭스 막대 → B 가 반 바퀴 열려 A 에 붙음
  //   반환 = 새 상태 첫 줄까지 손 안에서 도는 양(rad · A·날·B 합 · 맞는 것이 없으면 −1) · _bM = 그중 한 부품이 가장 크게 도는 양
  const _bk = new Array(NV).fill(0), _bq = new Float64Array(40), BSH = [0, -1, 1];
  let _bM = 0;
  const hOut = (x) => { const a = ((x % P2) + P2) % P2; return a > PI ? Math.min(a - PI, P2 - a) : 0; };   // 0~π 를 넘친 각
  function balFrom(ka, S, st, t, bd) {
    const f = ka.from, N = 16, sw = st === 'attack' ? ka.sw : null;
    const dur = !t ? 1 : sw ? sw.total || 0.42 : t.dur || 0.5, sp = t && !sw ? t.speed || 1 : 1, u0 = sw ? sw.t / dur : 0;
    // 섞는 동안 목표 줄의 날·B (m = 0 … N) · 끝의 w
    for (let m = 0; m <= N; m++) {
      if (t) kfSample(t.R, clamp(u0 + (bd * m / N) * sp / dur, 0, 1), _bk); else for (let i = IP; i <= IW; i++) _bk[i] = S.rest[i + 1];
      _bq[m * 2] = _bk[IP]; _bq[m * 2 + 1] = _bk[IP + 1];
    }
    const wE = _bk[IW];
    // 시작 줄·목표 줄이 이미 넘친 만큼(키프레임 곡선이 멈춤을 살짝 지나친 것)은 봐 줌
    let tol = Math.max(hOut(f[IP] + PI), hOut(f[IP + 1] - f[IP] - PI));
    for (let m = 1; m <= N; m++) tol = Math.max(tol, hOut(_bq[m * 2] + PI), hOut(_bq[m * 2 + 1] - _bq[m * 2] - PI));
    tol += 0.15;
    let best = 1e9, ba = 0, bb = 0, bc = 0;
    for (let ia = 0; ia < 3; ia++) for (let ib = 0; ib < 3; ib++) {
      const a = BSH[ia], b = BSH[ib], th = f[IP] + P2 * a, ph = f[IP + 1] + P2 * b;
      let ok = true;
      for (let m = 1; m < N && ok; m++) { const k = sstep(0, 1, m / N), x = th + (_bq[m * 2] - th) * k, y = ph + (_bq[m * 2 + 1] - ph) * k; if (hOut(x + PI) > tol || hOut(y - x - PI) > tol) ok = false; }
      if (!ok) continue;
      const dth = _bq[N * 2] - th, dph = _bq[N * 2 + 1] - ph;
      for (let ic = 0; ic < 3; ic++) { const c = BSH[ic], dw = wE - (f[IW] + P2 * c), cost = 1.25 * Math.abs(dw) + Math.abs(dw + dth) + Math.abs(dw + dph); if (cost < best - 1e-6) { best = cost; ba = a; bb = b; bc = c; } }
    }
    if (best >= 1e9) { _bM = 0; return -1; }
    f[IP] += P2 * ba; f[IP + 1] += P2 * bb; f[IW] += P2 * bc;
    const r0 = t ? t.R[0] : S.rest, dw0 = r0[IW + 1] - f[IW], rA = Math.abs(dw0), rL = Math.abs(dw0 + r0[IP + 1] - f[IP]), rB = Math.abs(dw0 + r0[IP + 2] - f[IP + 1]);
    _bM = Math.max(rA, rL, rB);
    return 1.25 * rA + rL + rB;
  }
  // 새 상태로: 지금 줄(처음이면 기본 자세 · low 면 화면 아래)을 붙잡아 bd 초 동안 섞는다
  function enter(ka, st, bd, low) {
    const S = SPEC[ka.kind], pst = ka.st;
    //  달리며 휘두르던 중(attack[i].run 줄)에 다른 상태로(넣기 등): 그 순간의 run 줄을 붙잡아 0.1초 동안 run.fp 로 옮겨 감 — 주먹이 한 프레임에 달리기 자리로 튀지 않게 (runRow)
    if (S.run && ka.st === 'attack' && ka.sw && st !== 'attack') { const a = trackOf(ka, 'attack'); if (a && a.rr) { kfSample(a.rr, clamp(ka.sw.t / ka.sw.total, 0, 1), ka.rf || (ka.rf = new Array(NV).fill(0))); ka.rft = 0; } }
    if (!ka.st || low) { for (let i = 0; i < NV; i++) ka.from[i] = S.rest[i + 1]; if (low) ka.from[1] -= 0.42; }
    else for (let i = 0; i < NV; i++) ka.from[i] = ka.row[i];
    // 손장난 중이었거나 손장난 시간이 다 됐으면 다음 손장난까지 시간을 새로 (휘두르기·살펴보기가 끝나자마자 손장난이 붙지 않게)
    if (ka.fi >= 0 || ka.fn <= 0) { const ev = S.idle.every || [4, 8]; ka.fn = ev[0] + Math.random() * (ev[1] - ev[0]); }
    ka.st = st; ka.t = 0; ka.bt = 0; ka.bd = bd; ka.u0 = -1; ka.fi = -1; ka.bs = 0; ka.bc = 0; ka.bk = 0; ka.qs = 0;
    const t = trackOf(ka, st), r0 = t ? t.R[0] : S.rest;
    for (const i of SPIN) ka.from[i] += P2 * Math.round((r0[i + 1] - ka.from[i]) / P2);
    //  손목 각도 2π 맞춤 (바로 앞 동작이 손목을 크게 돌려 2π 근처로 끝났어도 새 동작으로 섞일 때 한 바퀴 거꾸로 감지 않게 — 같은 자세)
    for (let i = IR; i < IR + 3; i++) ka.from[i] += P2 * Math.round((r0[i + 1] - ka.from[i]) / P2);
    //  나비 나이프: 경첩을 지키는 2π 배수로 다시 (balFrom) — 섞는 시간을 늘려야 하면 늘린 시간으로 한 번 더 고름(그 길에 맞는 것이 없으면 원래 시간·고른 것으로)
    //   넣기(무기 바꾸기)를 펼친 칼이 아닌 자세(닫힘·막대·B 를 쥠·던짐)에서 시작하면 넣기 끝까지 섞음 — 0.04초 만에 칼이 확 펴졌다 다시 접히지 않고 그 자세에서 곧장 접히며 손이 내려감
    //   휘두르기를 한 부품이 손 안에서 반 바퀴 가까이 넘게 돌아야 하는 자세(닫힌 칼·힐릭스 막대·B 만 든 채플린·공중에 던진 칼)에서 시작하면 0.1초 —
    //   B 가 4 프레임 만에 한 바퀴(프레임마다 2.1 rad) 돌던 것을 6 프레임에(1.5 rad) (휘두르는 줄은 그대로 — 젖히기가 한 프레임 늦게 다 닿을 뿐 베는 구간부터 같음 ·
    //   펼친 칼·B 를 쥔 꺼내기 자세는 그대로 0.07초)
    //   넣는 도중 다시 꺼내 한 부품이 3 rad 넘게 돌아야 하면 0.12초 — 반쯤 접힌 칼이 젠 롤오버 첫 자세(닫힘)로 4 프레임 만에 B 를 한 바퀴 휘돌리던 것(프레임마다 1.9 rad)을 7 프레임에
    if (S.bal) {
      const o0 = ka.from[IP], o1 = ka.from[IP + 1], o2 = ka.from[IW], d0 = balFrom(ka, S, st, t, bd);
      const nb = st === 'unequip' && t && d0 > 0.8 ? (t.dur || 0.2) / (t.speed || 1) : st === 'attack' && _bM > 3 && bd < 0.1 ? 0.1 : st === 'equip' && pst === 'unequip' && _bM > 3 && bd < 0.12 ? 0.12 : 0;
      if (nb) { ka.bd = nb; ka.from[IP] = o0; ka.from[IP + 1] = o1; ka.from[IW] = o2; if (balFrom(ka, S, st, t, nb) < 0) { ka.bd = bd; balFrom(ka, S, st, t, bd); } }
      balX(ka, st, t, pst);
    }
  }
  // 나비 나이프 끊김 섞기의 덧붙임 (enter 끝 balX → 섞는 동안 tick 의 balRow · balSnd) — 모두 섞는 시간 안에서만, 시작·끝에서 0 이라 튀지 않음:
  //  · 닫힌 칼(날–A·날–B 가 모두 0.3 rad 안)에서 넣기 전체로 섞으면 날·B 는 넣기 마지막 줄(접힘 · 2π 를 시작 줄에 맞춤)로 곧장 (ka.bc) — 움직이는 목표 줄로 섞던 때는
  //    손이 내려가는 동안 A·B 가 43° 벌어졌다 다시 닫혔음 · 소리도 넣기 줄의 돌리는 소리·'딸깍' 대신 걸쇠가 잠기는 '틱' 하나(ka.qs — 아무것도 돌지 않음)
  //    (닫힌 칼만 — B 만 튕겨 연 자세 등은 넣기 줄을 따라 접혀야 날이 조준점 가까이 지나지 않음)
  //  · 끊길 때 한 부품이 손 안에서 크게 도는 섞기는 소리(ka.bs, 내 캐릭터만 · 소리 이름은 BAL): 2.5 rad 넘게(닫힌 칼·막대·던진 칼에서 휘두르기·달리기) = 섞는 0.15 지점에 돌리는 소리(fl)
  //    + 끝에 손잡이가 붙는 '딸깍'(cl — 휘두르기는 휘두르기 줄 자기 '딸깍'과 겹치지 않게 '틱'(tk)) · 1~2.5 rad(튕겨 연 B 가 돌아와 붙음) = 끝 소리만 ·
  //    넣다가 다시 꺼내 2.5 rad 넘게 = 끝에 '딸깍'만 (넣기 줄이 방금 돌리는 소리를 냄) · 손에 회복·투척 물건을 든 동안·춤추는 동안은 내지 않음(tick — 칼이 보이지 않음)
  //  · 휘두르기로 0.1초 섞을 때(ka.bk): 가운데에서 손가락을 폈다가 다시 쥐고(BAL.fo — 놓았다 받음 · 크게 도는 손잡이가 굽은 손가락 끝·손바닥에 묻히지 않게)
  //    칼을 손바닥에서 BAL.tp 만큼 띄움(공중에서 내려앉는 칼의 A 가 손바닥으로 파고들지 않게)
  //  · 크게 도는 섞기(휘두르기·넣기)는 손을 BAL.hx 만큼 오른쪽으로 — 날·B 가 반 바퀴 넘게 휘도는 동안 끝이 조준점 가까이(36 px 안) 지나지 않게
  //  · 손 안에서 칼 전체가 크게 돈 자세(|w| > 1 — 힐릭스 막대 굴리기 등)에서 섞으면 손을 BAL.hz 만큼 앞으로 — 도는 B·걸쇠가 카메라 쪽으로 다가오지 않게
  const BAL = { fo: [0.55, 0.45, 0.6, 0.5, 0.5], tp: [0.004, -0.015, 0], hx: 0.025, hz: 0.025, fl: 'bFlipM', cl: 'bClack', tk: 'bTick' };
  const wrapA = (a) => a - P2 * Math.round(a / P2);
  function balX(ka, st, t, pst) {
    const f = ka.from, cl = Math.abs(wrapA(f[IP] + PI)) < 0.3 && Math.abs(wrapA(f[IP + 1] - f[IP] - PI)) < 0.3;
    if (st === 'unequip' && t && ka.bd >= 0.15 && cl) { const e = t.R[t.R.length - 1]; ka.bc = 1; ka.bc0 = e[IP + 1] + P2 * Math.round((f[IP] - e[IP + 1]) / P2); ka.bc1 = e[IP + 2] + P2 * Math.round((f[IP + 1] - e[IP + 2]) / P2); ka.qs = 1; ka.bs = 3; }
    else if (st === 'equip' && pst === 'unequip' && _bM > 2.5) ka.bs = 4;
    else if (_bM > 1 && (st === 'attack' || st === 'idle')) ka.bs = (st === 'attack' ? 1 : 2) + (_bM > 2.5 ? 0 : 4);
    const op = Math.abs(wrapA(f[IP])) < 0.3 && Math.abs(wrapA(f[IP + 1])) < 0.3;
    ka.bk = st === 'attack' && ka.bd >= 0.1 ? 1 : 0;
    ka.bx = !op && (st === 'attack' || (st === 'unequip' && !ka.bc && ka.bd >= 0.15)) ? BAL.hx : 0; ka.bz = ka.bd >= 0.1 && Math.abs(wrapA(f[IW])) > 1 ? BAL.hz : 0;
  }
  //  섞는 동안 줄에 덧붙임 (w = 섞는 정도 · 끝나면 부르지 않음) — 손가락·손바닥 띄움·앞으로는 sin(πw)(가운데에서 가장 큼),
  //   오른쪽으로는 섞기 첫 1/3 에서 가장 큰 6.75·t·(1−t)² (t = 섞은 시간 비율 — 끊긴 자세에 머무는 첫 프레임들에 이미 비켜 남 · 끝은 매끈히 0)
  function balRow(ka, w) {
    const r = ka.row;
    if (ka.bc) { r[IP] = lerp(ka.from[IP], ka.bc0, w); r[IP + 1] = lerp(ka.from[IP + 1], ka.bc1, w); }
    const k = Math.sin(PI * w), t = clamp(ka.bt / ka.bd, 0, 1);
    if (ka.bk) { const F = BAL.fo; for (let j = 0; j < 5; j++) r[IF + j] += (F[j] - r[IF + j]) * k; r[IT] += BAL.tp[0] * k; r[IT + 1] += BAL.tp[1] * k; r[IT + 2] += BAL.tp[2] * k; }
    r[0] += ka.bx * 6.75 * t * (1 - t) * (1 - t); r[2] += ka.bz * k;
  }
  //  끊김 섞기 소리 ka.bs: 1 휘두르기·2 대기 = 섞는 0.15 에 돌리는 소리 + 끝 소리 · 5·6 = 1~2.5 rad 만 돌아 붙는 것(끝 소리만) · 3 닫힌 칼 넣기 = 0.5 에 '틱' · 4 다시 꺼내기 = 끝에 '딸깍'
  //   끝 소리: 휘두르기(1·5)·닫힌 칼 넣기는 '틱' · 대기(2·6)·다시 꺼내기는 '딸깍' — 섞는 시간 비율이 그 지점을 지나는 프레임에
  function balSnd(ka, S, dt) {
    const a = (ka.bt - dt) / ka.bd, b = ka.bt / ka.bd, e = ka.bs === 3 ? 0.5 : 1;
    if (ka.bs <= 2 && ka.bs !== 0 && a < 0.15 && b >= 0.15) snd(S, BAL.fl, null, true);
    if (a < e && b >= e) { snd(S, ka.bs === 1 || ka.bs === 3 || ka.bs === 5 ? BAL.tk : BAL.cl, null, true); ka.bs = 0; }
  }
  // 3인칭 손 기울임(동작표 tt — 머리말): 줄의 ITT 칸에 u 에서의 회전 벡터를 더함 (u0~u1 들어감 · u2~u3 풀림)
  //  상태가 바뀔 때 이 칸이 섞이는 가장 짧은 시간 TTB(초) — 휘두르기(0.07초 섞기)로 끊어도 눕힌 3인칭 손이 2 프레임 만에 세워지지 않고 9 프레임에 걸쳐 풀림
  //   (손 방향이 휘두르는 자세로 도는 동안 기울임까지 한꺼번에 풀던 때는 한 프레임에 50~70° — 기울임 없는 것보다 10° 넘게 더 · 1인칭은 이 칸을 쓰지 않아 그대로)
  const TTB = 0.15;
  function tiltAt(tt, u, out) {
    for (let i = 0; i < tt.length; i++) { const w = tt[i], k = sstep(w[0], w[1], u) * (1 - sstep(w[2], w[3], u)); if (k > 0) { out[ITT] += w[4] * k; out[ITT + 1] += w[5] * k; out[ITT + 2] += w[6] * k; } }
  }
  function snd(S, k, pos, own, swing) {
    const r = S.snd[k];
    if (r) { if (Audio.mskin) Audio.mskin(r[1], r[0], pos, own, swing ? null : S.shape + ':' + k, swing); }
    else if (Audio.knife) Audio.knife(k, pos, own);
  }
  // 달리려 하나 (달리기 자세 ka.sg 의 기준 — 동작표 run 이 있는 스킨만): 다른 캐릭터는 c.sprint · 내 캐릭터는 달리기 키(모바일 달리기 버튼·스틱 끝까지) + 앞으로 —
  //  09_player.js 의 p.sprint 에서 '쏘는 중'만 뺀 것 (사격 버튼 = 휘두르기를 누르는 동안은 p.sprint 가 꺼져, 달리며 누르고 있으면 손이 서서 휘두르는 쪽으로 풀렸다 돌아왔음)
  function runWant(c) {
    if (c.sprint || !c.isPlayer) return !!c.sprint;
    const I = Input, k = I.keys;
    if (!(k.ShiftLeft || k.ShiftRight || I.touchSprint || I.touchSprintBtn) || c.stance !== 'stand' || c.lean || c.heal || c.inWater || c.vault) return false;
    const mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + I.move.x, mz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + I.move.z;
    return mz / Math.max(1, Math.hypot(mx, mz)) > 0.3;
  }
  // 한 프레임: 상태 전환 → 시간 → 키프레임 → 섞기 (animateChar 에서 캐릭터마다 한 번) · 반환 = 줄(전용 동작 중) 또는 null
  function tick(c, dt) {
    let ka = c.ka;
    const held = !!c.melee && c.alive && !c.knocked && c.mode === 'ground' && !c.veh;
    const mid = held ? c.melee : ka ? ka.mid : null;
    const kind = held || (ka && (ka.held || ka.st === 'unequip')) ? kindOf(c, mid) : null;
    if (!kind) { if (ka) { ka.st = null; ka.held = false; } return null; }
    if (!ka) ka = c.ka = { kind, mid, st: null, t: 0, bt: 1, bd: 0, from: new Array(NV).fill(0), row: new Array(NV).fill(0), held: false, sw: null, v: 0, iv: 0, il: -1, req: 0, kick: 0, kdir: 1, it: Math.random() * 30, fn: 3, fi: -1, fl: -1, ft: 0, fu0: -1, u0: -1, sh: 0 };
    if (ka.kind !== kind || ka.mid !== mid) { ka.kind = kind; ka.mid = mid; ka.st = null; }
    const S = SPEC[kind], sw = c.swing && c.swing.id === mid ? c.swing : null;
    if (held) {
      if (!ka.held || !ka.st || ka.st === 'unequip') { const eq = c.equipT > 0.05; if (!ka.st) { ka.rw = 0; ka.sg = 0; } enter(ka, eq ? 'equip' : 'idle', eq ? (ka.st ? 0.08 : 0) : 0.26, !eq && !ka.st); ka.held = true; ka.sw = sw; ka.fn = 2.5 + Math.random() * 3; }
      if (sw && sw !== ka.sw) { ka.sw = sw; ka.v = S.attack.length > 1 && sw.side < 0 ? 1 : 0; ka.sa = ka.rw || 0; enter(ka, 'attack', 0.07); }
      else if (ka.st === 'attack' && !sw) enter(ka, 'idle', 0.1);
      // 살펴보기 요청 — 달리기 자세(동작표 run)로 달리다 멈추자마자 누르면 손이 대기 자세로 거의 돌아올 때까지(ka.rw 0.2 · 길어야 0.3초) 들고 기다렸다 시작
      //  (손이 아직 낮은데 손목부터 살펴보는 자세로 돌아 날이 화면 아래로 빠지고 살펴보기 첫 동작이 섞기에 묻히던 것) · 그사이 다시 달리거나 휘두르면 버림
      if (ka.req && !(S.run && ka.st === 'idle' && !c.sprint && ka.rw > 0.2 && (ka.rqt = (ka.rqt || 0) + dt) < 0.3)) {
        ka.req = 0; ka.rqt = 0;
        if (ka.st === 'idle' && S.inspect.length && !c.sprint && !sw && !c.heal && !c.throwMode && !c.revive && !c.dance) { ka.iv = ka.reqV >= 0 && ka.reqV < S.inspect.length ? ka.reqV : pickOther(S.inspect.length, ka.il); ka.il = ka.iv; enter(ka, 'inspect', 0.16); }
        ka.reqV = -1;
      }
      // 살펴보기는 달리면 · 꺼내기·살펴보기는 회복·투척·부활·춤을 시작하면 끊고 대기로 (손은 그 동작이 차지 — 꺼내는·돌리는 소리가 붕대 위로 나지 않게)
      if ((ka.st === 'inspect' && c.sprint) || ((ka.st === 'inspect' || ka.st === 'equip') && (c.heal || c.throwMode || c.throwAnim > 0 || c.nadeQ || c.revive || c.dance))) enter(ka, 'idle', 0.2);
    } else if (ka.held) {
      // 넣기(1인칭에서 보이는 손만): 근접 무기를 아직 가지고 있는 채 총·투척·회복으로 바꿈 — 손이 무기와 함께 내려간다
      //  바로 앞 프레임에 근접 무기 뷰모델을 실제로 그렸을 때만 (회복·투척 뷰모델 중이었으면 보이지 않던 무기를 꺼내 보이지 않게)
      ka.held = false;
      if (c.isPlayer && ka.vf === G.frame - 1 && G.firstPerson && c.alive && !c.knocked && c.inv.melee === mid && c.mode === 'ground' && !c.veh) enter(ka, 'unequip', 0.04);
      else { ka.st = null; return null; }
    }
    // 넣는 중에 기절·탑승·사망·3인칭으로 바뀌면 바로 끝냄
    if (ka.st === 'unequip' && (!c.alive || c.knocked || c.veh || c.mode !== 'ground' || !G.firstPerson)) { ka.st = null; return null; }
    let tr = trackOf(ka, ka.st);
    const sp = (tr && tr.speed) || (ka.st === 'idle' && S.idle.speed) || 1;
    ka.t += dt * sp; ka.bt += dt; ka.kick = Math.max(0, ka.kick - dt * 7); if (ka.rf) ka.rft += dt;
    let u = 0;
    if (ka.st === 'attack') u = ka.sw ? clamp(ka.sw.t / ka.sw.total, 0, 1) : 1;
    else if (ka.st !== 'idle') u = clamp(ka.t / ((tr && tr.dur) || 0.5), 0, 1);
    if (u >= 1 && (ka.st === 'equip' || ka.st === 'inspect')) { enter(ka, 'idle', 0.12); u = 0; tr = null; }
    else if (u >= 1 && ka.st === 'unequip') { ka.st = null; return null; }
    // 목표 줄
    if (ka.st === 'idle' || !tr) {
      const r = S.rest; for (let i = 0; i < NV; i++) _tg[i] = r[i + 1];
      // 대기: 숨 쉬듯 손이 오르내리고 손목이 조금씩 돌며 엄지·검지가 손잡이를 만지작 (주기 2~4초 여럿을 섞어 같은 모양이 되풀이되지 않음)
      const I = S.idle, a = I.amp !== undefined ? I.amp : 1, it = ka.it += dt * (I.speed || 1);
      _tg[0] += (Math.sin(it * 2.1) * 0.0022 + Math.sin(it * 3.3 + 1) * 0.0007) * a; _tg[1] += (Math.sin(it * 1.7 + 1) * 0.003 + Math.sin(it * 2.9) * 0.0008) * a; _tg[2] += Math.sin(it * 1.9 + 2) * 0.0018 * a;
      _tg[3] += Math.sin(it * 1.6 + 2) * 0.026 * a; _tg[4] += Math.sin(it * 2.3) * 0.034 * a; _tg[5] += Math.sin(it * 1.8 + 1) * 0.02 * a;
      _tg[IF + 4] += Math.sin(it * 2.6) * 0.09 * a; _tg[IF + 2] += Math.sin(it * 1.9 + 1.5) * 0.05 * a;
      if (I.part) _tg[IP] += Math.sin(it * 1.5) * I.part * a;
      // 가끔 손을 고쳐 쥠: 몇 초마다 동작표의 짧은 손장난 하나를 더한다 (방금 한 것은 빼고)
      //  손이 다른 일을 할 때(회복·투척·부활·춤)는 손장난을 멈추고 시작하지 않음 — 그 사이 손장난 소리가 나지 않게
      //  (손장난 중이었으면 지금 자세에서 섞어 풀어 줌 — 부활처럼 근접 무기 화면이 그대로 보일 때 한 프레임에 튀지 않게)
      if (c.heal || c.throwMode || c.throwAnim > 0 || c.nadeQ || c.revive || c.dance) { if (ka.fi >= 0) enter(ka, 'idle', 0.15); }
      else if (S.fid.length) {
        //  달리기 자세(동작표 run)로 달리는 동안은 시작하지 않음 (손장난이 그 자세에 가려 소리만 나지 않게 — 멈춘 뒤 1.5초 이상 지나서)
        if (ka.fi < 0) { if (ka.rw > 0.3) ka.fn = Math.max(ka.fn, 1.5); ka.fn -= dt; if (ka.fn <= 0) { ka.fi = pickOther(S.fid.length, ka.fl); ka.ft = 0; ka.fu0 = -1; } }
        if (ka.fi >= 0) {
          const F = S.fid[ka.fi]; ka.ft += dt; const fu = ka.ft / (F.dur || 0.8);
          if (fu >= 1) { ka.fl = ka.fi; ka.fi = -1; const ev = I.every || [4, 8]; ka.fn = ev[0] + Math.random() * (ev[1] - ev[0]); }
          else {
            kfSample(F.R, fu, _fd); for (let i = 0; i < NV; i++) _tg[i] += _fd[i] * (i < 6 ? a : 1);
            if (c.isPlayer && F.S) for (const [su, k] of F.S) if (ka.fu0 < su && fu >= su) snd(S, k, null, true);
            ka.fu0 = fu;
          }
        }
      }
    } else {
      kfSample(tr.R, u, _tg);
      const a = tr.amp; if (a !== undefined && a !== 1) for (let i = 0; i < 6; i++) _tg[i] *= a;
      if (tr.tt) tiltAt(tr.tt, u, _tg);
      //  줄의 소리 (나비 나이프 닫힌 칼 넣기는 대신 걸쇠 '틱' 하나 — balX)
      if (c.isPlayer && tr.S && !ka.qs) for (const [su, k] of tr.S) if (ka.u0 < su && u >= su) snd(S, k, null, true);
    }
    ka.u0 = u;
    // 달리기 자세(동작표 run)를 섞는 정도 ka.rw = 달리는 정도 ka.sg × 상태마다 (머리말)
    //  ka.sg = 달리려 하고(runWant) 빠른 정도를 늘 따라감(휘두르는 동안에도 — 시간으로 풀려 휘두르는 횟수·프레임 빠르기에 상관없음)
    //   땅에 닿았는지 보지 않음 — 달리다 뛰어올라도 손이 대기 자세로 풀렸다 다시 돌아가지 않게 (조준·사격 직후처럼 몸이 달리기 자세가 아닐 땐 0)
    //  휘두르기: 달리며 휘두르기 줄(attack[i].run)이 있으면 휘두르기를 시작할 때의 섞는 정도(ka.sa = 그때의 ka.rw)로 그 줄 — 첫 프레임부터 손등 위 그대로 장전해 휘두르고 달리기 자세로 끝남
    //   (꺼내다 바로 휘두르면 0 이라 튀지 않음) · 달리기를 멈췄으면 찌르기·찢기 구간(u 0.4~0.56 — 두 줄이 같은 손등 위·날 오른쪽 자세 · 손 자리 3 cm 안)에서
    //   min(ka.sa, 달리는 정도)로 넘겨줘 서서 휘두르는 줄의 마무리로 대기 자세에 닿음 (계속 달리면 그대로 ka.sa)
    //   — 예전엔 휘두르는 동안 ka.sg 를 ka.sa 에 묶어, 달리다 멈춰 사격 버튼을 누르고 있으면 휘두르기 사이 한 프레임씩만 풀려 서 있는데도 7번(3초)을 달리기 자세로 휘둘렀고
    //     (30 fps 는 그 한 프레임이 커서 더 빨리 풀림) 한 번 휘두르다 달리기를 놓아도 0.65초 뒤에야 손이 돌아왔음
    //   줄이 없으면: 달리던 손(손등 위)을 붙잡고 있다가 휘두르는 줄이 손등 위로 돌아오는 무렵 넘겨줌 — 손이 대기 자세 쪽으로 되돌았다 다시 엎어지지 않게
    //  꺼내기: 끝무렵(u 0.75)까지 0 이고 ka.sg 도 0 쪽으로 — 달리며 꺼내면 감아 쥔 뒤 달리기를 시작할 때처럼 천천히 손등 위로 (다 꺼내자마자 한 번에 돌지 않게)
    //  살펴보기: 줄어드는 ka.sg 그대로 (달리기를 멈추자마자 누른 살펴보기는 손이 거의 돌아온 뒤 시작 — 위 ka.req) · 넣기 = 0
    if (S.run) {
      const an = c.anim, at = ka.st === 'attack', rr = at && tr && tr.rr, eq = ka.st === 'equip' && u < 0.75;
      ka.sg = lerp(ka.sg || 0, !eq && runWant(c) && Math.hypot(c.vel.x, c.vel.z) > 3.2 && !(an && an.ready > 0.5) ? 1 : 0, clamp(dt * 6, 0, 1));
      const s = sstep(0, 1, ka.sg), sa = ka.sa || 0, g = rr ? lerp(sa, Math.min(sa, s), sstep(0.4, 0.56, u)) : ka.st === 'idle' ? (sw ? 0 : s) : at ? Math.max(1 - sstep(0.26, 0.36, u), sstep(0.46, 0.75, u)) * s : eq || ka.st === 'unequip' ? 0 : s;
      //  따라가는 빠르기: 휘두르기 40 · 그 밖 10 — 넘겨주는 구간이 지난 뒤(u 0.56~) 줄어들 때는 달리기를 멈출 때와 같은 10
      //   (늦게 멈추면 서서 휘두르는 줄이 손목을 되돌리는 동안 달리기 자세까지 한꺼번에 풀려 손이 프레임마다 19.7° · 날 끝 90 px 로 돌았음 — 찌르기보다 빠름)
      ka.rw = lerp(ka.rw || 0, g, clamp(dt * (at && !(rr && u > 0.56 && g < ka.rw) ? 40 : 10), 0, 1));
    } else ka.rw = 0;
    // 3인칭: 꺼내기·살펴보기 동안 손을 가슴 앞으로 들어 올리는 정도(멀리서도 동작이 보이게) — 부드럽게 따라감
    const shT = ka.st === 'equip' ? sstep(0.1, 0.3, u) * (1 - sstep(0.8, 1, u)) : ka.st === 'inspect' ? sstep(0, 0.08, u) * (1 - sstep(0.9, 1, u)) : 0;
    ka.sh = lerp(ka.sh || 0, shT, clamp(dt * 8, 0, 1));
    //  3인칭 손 기울임 칸(ITT)만은 섞는 시간이 짧아도 TTB 초 이상 (tiltAt 위)
    const w = ka.bd > 0 ? sstep(0, 1, ka.bt / ka.bd) : 1, wt = ka.bd > 0 ? sstep(0, 1, ka.bt / Math.max(ka.bd, TTB)) : 1;
    for (let i = 0; i < NV; i++) { const k = i < ITT ? w : wt; ka.row[i] = k >= 1 ? _tg[i] : lerp(ka.from[i], _tg[i], k); }
    //  나비 나이프 끊김 섞기의 덧붙임·소리 (balX) — 소리는 손에 다른 것을 든 동안(회복·투척: 1인칭은 그 물건 화면 · 3인칭은 손에 그 물건)·춤(우승 장면 카메라 · 칼 부품이 멈춤)엔
    //   내지 않고 지움(그 동작이 살펴보기·꺼내기를 끊어 보이지 않는 칼이 돌아감 · 그 동작이 끝난 뒤 늦게 나지도 않게) · 부활은 칼이 1인칭·3인칭에 그대로 보이며 돌아가 소리를 냄
    if (S.bal && w < 1) balRow(ka, w);
    if (S.bal && ka.bs && ka.bd > 0 && c.isPlayer) { if (c.heal || c.throwMode || c.throwAnim > 0 || c.nadeQ || c.dance) ka.bs = 0; else balSnd(ka, S, dt); }
    // 시험용: 고정 자세 (dbg.k = K(...) — 내 캐릭터만)
    if (dbg.k && c.isPlayer) { const r = rowOf(dbg.k, S.F0, false, S, null); for (let i = 0; i < NV; i++) ka.row[i] = r[i + 1]; }
    return ka.row;
  }
  const dbg = { k: null, bal: BAL };
  const on = (c) => !!(c && c.ka && c.ka.st && c.ka.held);
  // 살펴보기 요청 (N · 모바일 든 칸) — 대기 중일 때만 시작 · iv = 몇 번째 살펴보기(시험용 — 없으면 무작위)
  function inspect(c, iv) { if (c && c.ka && c.ka.held && canInspect(c, c.ka.mid)) { c.ka.req = 1; c.ka.reqV = iv >= 0 ? iv : -1; return true; } return false; }

  // ---------- 손 · 손에 든 무기 ----------
  // 줄 → 카메라 공간 손바닥 자리 P · 손 방향 Q (손목 회전은 손목 관절 = 손바닥에서 PALM 만큼 뒤를 중심으로 — 무기 전체를 돌리지 않고 손목이 꺾인다)
  const _W = new THREE.Vector3(), _pv = new THREE.Vector3(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _qe = new THREE.Quaternion();
  function handPose(S, v, P, Q, sc) {
    _eu.set(v[IR], v[IR + 1], v[IR + 2], 'YXZ'); _qe.setFromEuler(_eu);
    _pv.copy(PALM.R).multiplyScalar(sc).applyQuaternion(S.Q0); _W.copy(S.P0).sub(_pv);
    Q.copy(S.Q0).multiply(_qe);
    _pv.copy(PALM.R).multiplyScalar(sc).applyQuaternion(Q);
    P.copy(_W).add(_pv); P.x += v[0]; P.y += v[1]; P.z -= v[2];
  }
  // 카람빗: 고리 가운데 = 검지 첫 마디 가운데, 고리 축 = 첫 마디 방향 · 각 θ = 그 축 둘레 회전(0 = 손잡이가 새끼손가락 쪽 = 거꾸로 쥠)
  //  검지를 펴면 축이 손가락 끝 방향이 되어 칼이 손가락 앞에서 프로펠러처럼 돈다 — 손 모양만 바꾸면 고리가 손가락을 따라감
  const KXS = -1;   // 모델 x = KXS × 고리 축 (휜 날이 손가락 쪽(앞)으로 오게)
  const _ka = new THREE.Vector3(), _kb = new THREE.Vector3(), _kd = new THREE.Vector3(), _ku = new THREE.Vector3(), _kx = new THREE.Vector3(), _ky = new THREE.Vector3(), _kz = new THREE.Vector3(), _km = new THREE.Matrix4(), _kq = new THREE.Quaternion();
  function karamPlace(Ar, o, th) {
    const hold = Ar.hold, sc = o.scale.x;
    hold.updateWorldMatrix(true, false); Ar.idx1.updateWorldMatrix(false, false); Ar.idx2.updateWorldMatrix(false, false);
    _ka.setFromMatrixPosition(Ar.idx1.matrixWorld); _kb.setFromMatrixPosition(Ar.idx2.matrixWorld);
    hold.worldToLocal(_ka); hold.worldToLocal(_kb);
    _kd.subVectors(_kb, _ka); if (_kd.lengthSq() < 1e-10) _kd.set(1, 0, 0); _kd.normalize();
    _ka.lerp(_kb, 0.5);
    _ku.set(0, 0, -1).addScaledVector(_kd, _kd.z); if (_ku.lengthSq() < 1e-8) _ku.set(0, 1, 0); _ku.normalize();
    _kq.setFromAxisAngle(_kd, th); _kz.copy(_ku).applyQuaternion(_kq);
    _kx.copy(_kd).multiplyScalar(KXS); _ky.crossVectors(_kz, _kx);
    _km.makeBasis(_kx, _ky, _kz); o.quaternion.setFromRotationMatrix(_km);
    _kb.fromArray(KR_RING).multiplyScalar(sc).applyQuaternion(o.quaternion); o.position.copy(_ka).sub(_kb);
  }
  // 줄의 부품·무기 회전·이동을 손에 든 모델에 (매 프레임 모두 다시 — 모델이 새로 만들어져도 그대로) · sc = 모델 1m 가 손 그룹 몇 단위인지 (1인칭 1/VM_SC)
  const _we = new THREE.Euler(0, 0, 0, 'XYZ'), _wv = new THREE.Vector3();
  // 나비 나이프 경첩 멈춤: 날–손잡이 A 사이(날 + π)·날–손잡이 B 사이(B − 날 − π)는 진짜 칼처럼 0~π 를 넘지 않음 —
  //  키프레임 곡선(Catmull-Rom)이 빠르게 닫히거나 펴지는 자리를 살짝 지나쳐도 손잡이·날이 서로를 뚫지 않고 멈춤에 닿아 선다 (넘친 쪽이 0 에 가까우면 0, π 에 가까우면 π)
  const _hg = [0, 0];
  function hinge(bl, b) {
    const a = ((bl + PI) % P2 + P2) % P2; if (a > PI) bl += a > 1.5 * PI ? P2 - a : PI - a;
    const c = ((b - bl - PI) % P2 + P2) % P2; if (c > PI) b += c > 1.5 * PI ? P2 - c : PI - c;
    _hg[0] = bl; _hg[1] = b; return _hg;
  }
  function place(Ar, o, S, v, sc) {
    const rig = o.userData.rig; o.userData.kaSet = true;
    if (S.kar && rig) { karamPlace(Ar, o, v[IP]); return; }
    _we.set(v[IW], v[IW + 1], v[IW + 2], 'XYZ'); o.quaternion.setFromEuler(_we);
    _wv.set(v[IV], v[IV + 1], v[IV + 2]).applyQuaternion(o.quaternion); o.position.set(v[IV] - _wv.x, v[IV + 1] - _wv.y, v[IV + 2] - _wv.z);
    o.position.x += v[IT]; o.position.y += v[IT + 1]; o.position.z += v[IT + 2];
    if (rig && S.bal) { const hg = hinge(v[IP], v[IP + 1]); rig.blade.rotation.x = hg[0]; rig.B.rotation.x = hg[1]; rig.latch.rotation.x = v[IP + 2]; o.position.z += v[IP + 3]; }
    o.position.multiplyScalar(sc);
  }
  // 전용 동작이 끝나 기본 동작이 같은 모델을 그릴 때: 손 안 자리를 원래대로 (sc = 모델 크기 — 위치는 0)
  function unplace(o) { if (o && o.userData.kaSet) { o.userData.kaSet = false; o.position.set(0, 0, 0); o.quaternion.identity(); const rig = o.userData.rig; if (rig && rig.kind === 'balisong') { rig.blade.rotation.x = 0; rig.B.rotation.x = 0; rig.latch.rotation.x = 0; } } }
  // 허리에 찬 나비 나이프는 접힌 채
  function sheath(o) { const rig = o && o.userData.rig; if (rig && rig.kind === 'balisong') rig.blade.rotation.x = -PI; }
  // 날 끝·날 뿌리 (휘두르기 자국 · 잔상 빠르기) — 관절 모델은 날 부품에서, 아니면 모델 앞(+z)으로 무기 길이만큼 · 반환 = 잔상을 만들 부분
  const TIP = { balisong: { part: 'blade', tip: [0, 0.0036, 0.1305], base: [0, 0, 0.035] }, karambit: { part: 'spin', tip: [0, -0.059, 0.2673], base: [0, 0.0027, 0.1378] } };
  function tipBase(o, mid, sk, tip, base) {
    const rig = o.userData.rig, T = rig && TIP[rig.kind];
    if (T) { const pt = rig[T.part]; pt.updateWorldMatrix(true, false); tip.fromArray(T.tip).applyMatrix4(pt.matrixWorld); base.fromArray(T.base).applyMatrix4(pt.matrixWorld); return pt; }
    o.updateWorldMatrix(true, false); const L = MeleeSkin.tip(mid, sk);
    tip.set(0, 0, L).applyMatrix4(o.matrixWorld); base.set(0, 0, L * 0.4).applyMatrix4(o.matrixWorld); return o;
  }
  // 손가락: 네 손가락은 setFingers 그대로, 엄지는 1 = 주먹처럼 검지 옆으로 접음(setFist · 기본 근접 무기와 같음) ↔ 0 = 펴서 들어 올림
  function setK(Ar, F, w = 1) {
    setFingers(Ar, F, w);
    const s = Ar.side, R0 = Body.REST['thumb1' + (s > 0 ? 'L' : 'R')], k = clamp(F[4], 0, 1.2) * w;
    Ar.thumb1.rotation.set(R0[0] + 0.8 * k, R0[1], R0[2]); Ar.thumb2.rotation.set(0, 0, -s * 0.6 * k);
  }
  const _F5 = [0, 0, 0, 0, 0];
  const fing = (v, out) => { for (let i = 0; i < 5; i++) out[i] = v[IF + i]; return out; };

  // ---------- 1인칭 ----------
  const _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _B = new THREE.Vector3(), _E = new THREE.Vector3(), _qr = new THREE.Quaternion(), _pole = new THREE.Vector3();
  const _P2 = new THREE.Vector3(), _Q2 = new THREE.Quaternion(), _rv = new Array(NV).fill(0);
  const _tp = new THREE.Vector3(), _bp = new THREE.Vector3(), _lt = new THREE.Vector3();
  // 잔상: 빠르게 움직이는 날(관절 모델은 날 부품, 아니면 무기 전체)을 지난 몇 프레임 자리에 옅게 — 낮은 화질이면 생략
  //  메시마다 지난 자리 4개를 돌려 쓰는 행렬 고리(무기가 바뀔 때만 새로 만듦) · 잔상 3장(가까운 것일수록 진하게)
  const GH = { src: null, list: [], ms: [], ring: [], head: 0, n: 0, mats: null, lt: false, wm: null, vf: 0, st: null }, GOP = [0.15, 0.09, 0.045];
  const ghostMats = () => GH.mats || (GH.mats = GOP.map((op) => new THREE.MeshBasicMaterial({ color: 0xd8e6ff, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })));
  // 반짝임: 살펴보기 줄의 gl = [[u0, u1], …] 동안 빛 한 점이 날 뿌리 → 끝으로 미끄러짐 (금속 재질이 빛을 받는 순간) — 1인칭만 · 스프라이트 하나를 돌려 씀
  let GLS = null;
  function glintSprite() {
    if (GLS) return GLS;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), c = 32;
    const rg = g.createRadialGradient(c, c, 0, c, c, 30); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,246,220,0.75)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    // 네 갈래 빛줄기
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [w, h] of [[60, 3], [3, 60], [26, 1.6], [1.6, 26]]) g.fillRect(c - w / 2, c - h / 2, w, h);
    const tx = new THREE.CanvasTexture(cv);
    GLS = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    GLS.visible = false; GLS.renderOrder = 5; return GLS;
  }
  // 잔상·반짝임 재질을 뷰모델 장면에 미리 (보이지 않게) — 경기 시작 때 뷰모델 셰이더를 미리 만들 때 같이 만들어져, 처음 돌릴 때 화면이 멈추지 않게 (09_player.js buildViewModel)
  function warmVM(sc) {
    const m = ghostMats(); if (!GH.wm) { GH.wm = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), m[0]); GH.wm.visible = false; }
    if (sc && GH.wm.parent !== sc) sc.add(GH.wm);
    const gs = glintSprite(); if (sc && gs.parent !== sc) sc.add(gs);
  }
  const _gl = new THREE.Vector3();
  function glint(tr, u, tip, base) {
    const gs = GLS; if (!gs) return;
    let k = -1, s = 0;
    if (tr && tr.gl && SETTINGS.quality !== 'low') for (const [a, b] of tr.gl) if (u >= a && u <= b) { s = (u - a) / (b - a); k = Math.sin(Math.PI * s); break; }
    gs.visible = k > 0.02; if (!gs.visible) return;
    _gl.lerpVectors(base, tip, 0.15 + 0.8 * s); gs.position.copy(_gl).multiplyScalar(0.985);
    gs.scale.setScalar(0.035 + 0.03 * k); gs.material.opacity = k;
  }
  function ghostClear() { for (const m of GH.list) if (m.parent) m.parent.remove(m); GH.list.length = 0; GH.ms = []; GH.ring = []; GH.n = 0; GH.src = null; GH.lt = false; }
  function ghosts(src, dt, speed, th) {
    if (SETTINGS.quality === 'low') { if (GH.list.length) ghostClear(); return; }
    // 잔상을 쓰지 않는 상태(휘두르기·넣기·잔상 없는 스킨): 숨기기만 — 다시 만들지 않게 메시·행렬 고리는 그대로
    if (!th) { vmOff(); return; }
    if (GH.src !== src) {
      ghostClear(); GH.src = src; ghostMats();
      src.traverse((m) => { if (m.isMesh) GH.ms.push(m); });
      GH.ring = GH.ms.map(() => [0, 1, 2, 3].map(() => new THREE.Matrix4()));
      for (let k = 0; k < 3; k++) GH.ms.forEach((m, mi) => { const gm = new THREE.Mesh(m.geometry, GH.mats[k]); gm.matrixAutoUpdate = false; gm.visible = false; gm.userData.k = k; gm.userData.mi = mi; gm.frustumCulled = false; VM.scene.add(gm); GH.list.push(gm); });
    }
    src.updateWorldMatrix(true, true);
    GH.head = (GH.head + 1) & 3; for (let i = 0; i < GH.ms.length; i++) GH.ring[i][GH.head].copy(GH.ms[i].matrixWorld); GH.n = Math.min(4, GH.n + 1);
    const k0 = clamp((speed - th) / 3, 0, 1);
    for (let k = 0; k < 3; k++) GH.mats[k].opacity = GOP[k] * k0;
    for (const gm of GH.list) { const k = gm.userData.k; gm.visible = k0 > 0.02 && GH.n > k + 1; if (gm.visible) gm.matrix.copy(GH.ring[gm.userData.mi][(GH.head - k - 1) & 3]); }
  }
  // 달리기 줄: 대기 = run.fp 줄 · 달리며 휘두르기 = 그 휘두르기의 run 줄을 u 에서 (없으면 run.fp 줄)
  //  달리며 휘두르기가 중간에 끊겼으면(넣기 등 — enter 가 ka.rf 에 붙잡음) 0.1초 동안 그 줄에서 run.fp 로
  const _rs = new Array(NV).fill(0);
  function runRow(ka, S) {
    const at = ka.st === 'attack' && ka.sw ? trackOf(ka, 'attack') : null;
    if (at && at.rr) return kfSample(at.rr, clamp(ka.sw.t / ka.sw.total, 0, 1), _rs);
    if (ka.rf && ka.rft < 0.1) { const w = sstep(0, 0.1, ka.rft), v = S.run.v; for (let i = 0; i < NV; i++) _rs[i] = lerp(ka.rf[i], v[i], w); return _rs; }
    return S.run.v;
  }
  // 1인칭 뷰모델: 오른손 + 무기 (왼손은 09_player.js 가 그대로) — 반환 = 왼손이 참고할 { pull, low } 또는 null(기본 동작으로)
  const _vmInfo = { pull: 0, low: 0 };
  function vm(dt, p, A, run, force) {
    const ka = p.ka; if (!ka || !ka.st || (ka.st === 'unequip' && !force) || kindOf(p, ka.mid) !== ka.kind) { if (GH.list.length || GH.lt) ghostClear(); if (GLS) GLS.visible = false; return null; }
    const S = SPEC[ka.kind], sk = MeleeSkin.ofChar(p, ka.mid);
    vmHeld(A.R, ka.mid, sk);
    const o = A.R.hold.children[0]; if (!o) return null;
    if (!force) ka.vf = G.frame;   // 이 프레임에 근접 무기 뷰모델을 그렸음 (넣기 판단용)
    let v = ka.row; handPose(S, v, _P, _Q, VM_SC);
    // 달리기 자세(동작표 run): 손 자리는 직선으로 · 방향은 구면으로(손목이 엉뚱하게 돌지 않게) ka.rw 만큼 그 줄로 — 손가락·부품도 (부품·무기 회전은 2π 맞춤)
    //  손목을 먼저 돌리고 손은 나중에 내림(돌아올 땐 손을 먼저 올리고 손목은 나중에) — 손목이 반쯤 돌아 날이 아래를 볼 때 손이 이미 내려가 있으면 날이 화면 밑으로 빠짐
    //  달리며 휘두를 땐 그 휘두르기의 run 줄로 (runRow)
    const R = S.run, rw = R ? ka.rw || 0 : 0, rv = R ? runRow(ka, S) : null;
    //  부품·무기 회전(2π 채널)은 달리기 줄 쪽 2π 갈래(ka.rb)를 붙잡아 둠 — 섞는 동안 이 줄이 빠르게 돌아도(달리다 넣기·넣다가 다시 꺼내기) 갈래가 반 바퀴 지점에서 바뀌며
    //   칼이 한 프레임에 뒤집히지 않게 · 상태가 바뀌며 줄이 2π 단위로 옮겨지면(enter) 갈래도 같이 옮김 · 섞지 않을 때(rw 0)·지난 프레임에 안 그렸으면 가장 가까운 갈래로 새로
    if (R) {
      const b = ka.rb || (ka.rb = new Array(14).fill(0)), fresh = rw <= 0.001 || ka.rbf !== G.frame - 1;
      for (let j = 0; j < 7; j++) { const i = IP + j; b[j] = fresh ? Math.round((v[i] - rv[i]) / P2) : b[j] + Math.round((v[i] - b[7 + j]) / P2); b[7 + j] = v[i]; }
      ka.rbf = G.frame;
    }
    if (rw > 0.001) {
      handPose(S, rv, _P2, _Q2, VM_SC); _P.lerp(_P2, sstep(0.2, 1, rw)); _Q.slerp(_Q2, sstep(0, 0.8, rw));
      for (let i = 0; i < NV; i++) { let t = rv[i]; if (i >= IP && i < IT) t += P2 * ka.rb[i - IP]; _rv[i] = lerp(v[i], t, rw); }
      v = _rv;
    }
    // 걷는 흔들림 · 달리면 아래로 (기본 근접 무기와 같음 — 달리기 자세가 있는 스킨은 그 줄이 내림·기울임 대신)
    //  꺼내는 동안은 끝무렵(u 0.8~1)에야 내림 — 달리며 꺼내도 젠 롤오버의 손목 넘기기·착 닫힘 같은 꺼내는 동작이 화면 밖으로 내려가 버리지 않고 서서 꺼낼 때처럼 보임
    //   내리는 비율 ka.rq: 새로 꺼낼 땐(섞기 없이 화면 아래에서 시작) 그대로 · 상태가 바뀌면 부드럽게 따라감(넣다가 다시 꺼내기·꺼내다 넣기) · 꺼내다 휘두르면 휘두르는 동안 그대로
    const eq = ka.st === 'equip', tq = eq ? sstep(0.8, 1, clamp(ka.t / (S.equip.dur || 0.5), 0, 1)) : ka.st === 'attack' && ka.rq !== undefined ? ka.rq : 1;
    ka.rq = ka.rq === undefined || (eq && !ka.bd) || Math.abs(tq - ka.rq) < 1e-3 ? tq : lerp(ka.rq, tq, clamp(dt * 10, 0, 1));
    const bobAmp = clamp(p.anim.speed / 5, 0, 1), rn = R ? 0 : run * ka.rq;
    _P.x += Math.sin(p.anim.phase) * 0.012 * bobAmp + rn * 0.05; _P.y -= Math.abs(Math.cos(p.anim.phase)) * 0.014 * bobAmp + rn * 0.14;
    if (rn > 0.01) { _qr.setFromAxisAngle(AX_X, -rn * 0.5); _Q.premultiply(_qr); }
    fing(v, _F5); vmReach(A.R, _P, _Q, _pole.set(0.6, -0.7, 0.15), _F5); setK(A.R, _F5);
    place(A.R, o, S, v, 1 / VM_SC);
    // 새로 꺼내는 첫 프레임·한동안 안 그리다 다시 그릴 때: 지난 자리(잔상·빠르기)를 버림 — 전에 들고 있던 자리에 잔상이 떠 보이지 않게
    if (G.frame - (GH.vf || 0) > 1 || (ka.st === 'equip' && GH.st !== 'equip')) { GH.lt = false; GH.n = 0; }
    GH.vf = G.frame; GH.st = ka.st;
    // 휘두르기 자국(휘두르는 순간) + 잔상(빠르게 움직일 때)
    const gs = tipBase(o, ka.mid, sk, _tp, _bp);
    const spd = GH.lt ? _tp.distanceTo(_lt) / Math.max(dt, 1e-3) : 0; _lt.copy(_tp); GH.lt = true;
    const sw = ka.st === 'attack' ? ka.sw : null, D = ITEMS[ka.mid];
    if (sw && sw.t > D.wind * 0.85 && sw.t < D.wind + D.strike * 1.4) FX.trail('vm', VM.scene, _tp, _bp, MeleeSkin.trail(ka.mid, sk));
    // 잔상은 손장난(꺼내기·살펴보기·대기)의 빠른 돌기에만 — 휘두르기는 자국이 따로 있어 겹치면 번져 보임 · 달리기 자세로 손을 돌리는 동안도 없음
    //  (대기·꺼내기 끝무렵은 섞는 동안 내내 · 살펴보기는 섞는 정도가 0.15 넘게 남았을 때만 — 멈춘 직후 시작한 살펴보기의 첫 돌기 잔상은 그대로)
    ghosts(gs, dt, spd, ka.st === 'attack' || ka.st === 'unequip' || ((ka.st === 'idle' || ka.st === 'equip') && rw > 0.02) || (ka.st === 'inspect' && rw > 0.15) ? 0 : S.ghost);
    const it = ka.st === 'inspect' ? trackOf(ka, 'inspect') : null;
    glint(it, it ? clamp(ka.t / (it.dur || 1), 0, 1) : 0, _tp, _bp);
    const u = sw ? clamp(sw.t / sw.total, 0, 1) : 0;
    _vmInfo.pull = sw ? Math.sin(Math.PI * clamp((u - 0.2) / 0.55, 0, 1)) : 0;
    _vmInfo.low = it ? Math.sin(Math.PI * clamp(ka.t / (it.dur || 1), 0, 1)) : 0;
    return _vmInfo;
  }
  // 1인칭 넣기: 다른 무기로 바꾼 직후 잠깐 무기를 쥔 손이 내려가는 것을 그린다 — 그동안 새 무기 뷰모델은 기다림(새 무기 꺼내는 시간 안)
  function vmOut(dt, p) {
    const ka = p.ka; if (!ka || ka.st !== 'unequip') return false;
    const A = vmArms(); A.root.visible = true; vmResetArms(A); vmHeld(A.L, null);
    // 달리던 중이면 그 낮춘 자세 그대로 이어서 (뷰모델 달리기 값도 계속 갱신 — 바로 다시 꺼내도 튀지 않게)
    const S = VM.melS || (VM.melS = { run: 0 }); S.run = lerp(S.run, p.sprint ? 1 : 0, clamp(dt * 8, 0, 1));
    if (!vm(dt, p, A, S.run, true)) { ka.st = null; return false; }
    const ud = (SPEC[ka.kind].unequip && SPEC[ka.kind].unequip.dur) || 0.2;
    _P.set(-0.17, -0.31 - S.run * 0.1 - 0.3 * clamp(ka.t / ud, 0, 1), -0.42);
    handQuat(_Q, _B.set(0.03, 0.72, -0.69), _E.set(0.4, -0.85, 0.25), 1);
    vmReach(A.L, _P, _Q, _pole.set(-0.5, -0.8, 0.1), FING.fist); setFist(A.L);
    if (G.sunDir) { _qr.copy(G.camera.quaternion).invert(); VM.dir.position.copy(G.sunDir).applyQuaternion(_qr).multiplyScalar(5); }
    return true;
  }
  const outActive = (p) => !!(p && p.alive && !p.knocked && !p.veh && p.ka && p.ka.st === 'unequip');
  // 근접 무기 뷰모델을 안 그리는 프레임: 잔상을 숨기고 빠르기 기준을 버림 (다른 무기 화면에 잔상이 남지 않게)
  function vmOff() { if (GH.list.length) { for (const gm of GH.list) gm.visible = false; } GH.lt = false; GH.n = 0; if (GLS) GLS.visible = false; }

  // ---------- 카메라 (내 캐릭터) ----------
  //  휘두르기: 숙임(앞뒤 기울기)은 기본 무기와 똑같이 — 내 근접 판정 방향이 카메라 앞 방향이라 숙임이 다르면 맞는 자리가 달라진다
  //  옆 기울임(앞 방향은 그대로): 기본 무기 것 + 동작마다 roll · 맞히면 짧고 작은 기울임 흔들림(맞힌 방향으로) — 반환 [숙임, 기울임] 또는 null(기본 화면 효과)
  const _cam = [0, 0];
  function cam(p) {
    const ka = p.ka; if (!ka || !ka.held || !ka.st) return null;
    let cp = 0, cr = 0;
    if (ka.st === 'attack' && ka.sw) {
      const D = ITEMS[ka.mid], ub = (ka.sw.t - D.wind * 0.6) / (D.strike + D.wind * 0.4 + D.rec * 0.4);
      if (ub > 0 && ub < 1) { const kk = Math.sin(Math.PI * ub); if (D.style === 'chop') cp -= kk * 0.05; else if (D.style === 'stab') cp -= kk * 0.014; else cr += kk * 0.04 * (D.style === 'slash' ? ka.sw.side : 1); }
      const tr = trackOf(ka, 'attack'), rr = tr && tr.roll;
      if (rr) { const u = clamp(ka.sw.t / ka.sw.total, 0, 1); cr += Math.sin(Math.PI * clamp((u - 0.16) / 0.42, 0, 1)) * rr; }
    }
    if (ka.kick > 0) cr += ka.kick * ka.kick * 0.016 * ka.kdir;
    _cam[0] = cp; _cam[1] = cr; return _cam;
  }
  function hit(c) { const ka = c && c.ka; if (ka && ka.held && SPEC[ka.kind]) { const tr = trackOf(ka, 'attack'); ka.kick = 1; ka.kdir = (tr && tr.kick) || 1; } }

  // ---------- 휘두르기 ----------
  // 휘두르기 동작이 둘 이상인 스킨은 이어서 휘두르면 번갈아 (보이는 것만 — 시간·피해는 같음)
  const alt = (c) => { const k = c && c.melee ? kindOf(c, c.melee) : null; return !!k && SPEC[k].attack.length > 1; };
  function swingSound(c, sw) {
    const k = kindOf(c, sw.id); if (!k) return false;
    const S = SPEC[k], nm = Array.isArray(S.swing) ? S.swing[sw.side < 0 ? 1 : 0] : S.swing; if (!nm) return false;
    snd(S, nm, c.pos, c.isPlayer, true); return true;
  }

  // ---------- 3인칭 ----------
  //  1인칭 줄 → 가슴 로컬(x 왼쪽, y 위, z 앞): 손은 무기의 3인칭 준비 자세에서 1인칭에서 움직인 만큼 0.8배(x 는 뒤집음) · 방향은 x 만 뒤집음
  //  허리 비틀기·숙임은 손이 옆·앞으로 간 만큼 · 왼손·오른팔꿈치는 준비 자세 · 꺼내기·살펴보기는 손을 가슴 앞으로 들어 올림(ka.sh)
  //  휘두르기: 식칼은 기본 3인칭 찌르기 궤적(높이·앞뒤·허리·팔꿈치)에 옆으로 가는 것과 손 방향은 이 스킨의 줄 / 다른 무기는 기본 3인칭 휘두르기로 섞어 넘어갔다 돌아옴
  //   (손가락·부품·손 안의 무기 회전은 늘 이 스킨의 줄 — tppApply)
  const _tP = new THREE.Vector3(), _tQ = new THREE.Quaternion(), _tB = new THREE.Vector3(), _tE = new THREE.Vector3(), _kt = new Array(19).fill(0), _tP2 = new THREE.Vector3(), _tQ2 = new THREE.Quaternion();
  let _rrK = null; const _rrD = new Array(6).fill(0);
  function tppRow(c, out) {
    const ka = c.ka, S = SPEC[ka.kind], v = ka.row, rd = TREADY[S.mid], k = 0.8;
    handPose(S, v, _tP, _tQ, VM_SC);
    //  달리며 휘두르기: 그 휘두르기의 run 줄(1인칭) 손 방향을 3인칭 방향으로 옮겨 따로 둠(_rrD) — tppRun 이 달리기 자세 방향과 이어 붙여 ka.rw 만큼 섞음
    //   (손등 위 장전 → 휘두름 · 대기 중 달리기와 같은 섞기라 섞는 정도가 어중간해도 휘두르기 시작·끝에서 손 방향이 튀지 않음)
    const rw = ka.rw || 0, ra = S.run && rw > 0.001 && ka.st === 'attack' && ka.sw ? trackOf(ka, 'attack') : null;
    _rrK = ra && ra.rr ? ka : null;
    if (_rrK) {
      handPose(S, runRow(ka, S), _tP2, _tQ2, VM_SC); _tP.lerp(_tP2, sstep(0.2, 1, rw));
      _tB.set(0, 0, 1).applyQuaternion(_tQ2); _tE.set(0, -1, 0).applyQuaternion(_tQ2); _rrD[0] = -_tB.x; _rrD[1] = _tB.y; _rrD[2] = -_tB.z; _rrD[3] = -_tE.x; _rrD[4] = _tE.y; _rrD[5] = -_tE.z;
    }
    const dx = _tP.x - S.P0.x, dy = _tP.y - S.P0.y, dz = S.P0.z - _tP.z;
    _tB.set(0, 0, 1).applyQuaternion(_tQ); _tE.set(0, -1, 0).applyQuaternion(_tQ);
    out[0] = rd[1] - dx * k; out[1] = rd[2] + dy * k; out[2] = rd[3] + dz * k;
    out[3] = -_tB.x; out[4] = _tB.y; out[5] = -_tB.z; out[6] = -_tE.x; out[7] = _tE.y; out[8] = -_tE.z;
    out[9] = rd[10] + clamp(-dx * 1.5, -0.55, 0.55); out[10] = rd[11] + clamp(dz * 0.6, -0.1, 0.25); out[11] = -Math.max(0, dz) * 0.08; out[12] = Math.max(0, dz) * 0.15;
    for (let i = 13; i < 19; i++) out[i] = rd[i + 1];
    if (ka.st === 'attack' && ka.sw) {
      const D = ITEMS[S.mid], st = D.style, uu = clamp(ka.sw.t / ka.sw.total, 0, 1), at = trackOf(ka, 'attack');
      // 동작표의 3인칭 줄(attack[i].tp)이 있으면 손 자리·허리·숙임·골반·왼손·팔꿈치는 그 줄 · 손 방향은 위의 1인칭 줄 그대로 (두 휘두르기가 3인칭에서도 다른 궤적)
      if (at && at.tp) { kfSample(at.tp, uu, _kt); for (let i = 0; i < 3; i++) out[i] = _kt[i]; for (let i = 9; i < 19; i++) out[i] = _kt[i]; }
      else {
        kfSample(MEL_KF[st === 'slash' && ka.sw.side < 0 ? 'slashB' : st], uu, _kt);
        if (S.mid === 'knife') {
          out[1] = _kt[1] + dy * 0.5; out[2] = _kt[2] + Math.min(0, dz) * 0.5;
          out[9] = _kt[9] + clamp(-dx * 1.2, -0.5, 0.5); out[10] = _kt[10]; out[11] = _kt[11]; out[12] = _kt[12];
          for (let i = 13; i < 19; i++) out[i] = _kt[i];
        } else { const wv = sstep(0, 0.14, uu) * (1 - sstep(0.86, 1, uu)); for (let i = 0; i < 19; i++) out[i] = lerp(out[i], _kt[i], wv); }
      }
    }
    //  3인칭 손 기울임(동작표 tt — 줄의 ITT 칸 · 상태가 바뀌면 섞여 풀림): 손 방향 둘을 가슴 로컬 회전 벡터만큼 돌림 (손바닥 자리는 그대로 — 1인칭은 그대로)
    const qx = v[ITT], qy = v[ITT + 1], qz = v[ITT + 2], qa = Math.hypot(qx, qy, qz);
    if (qa > 1e-4) { const co = Math.cos(qa), si = Math.sin(qa); rotK(out, 3, qx / qa, qy / qa, qz / qa, co, si); rotK(out, 6, qx / qa, qy / qa, qz / qa, co, si); }
    const sh = ka.sh || 0; out[0] += 0.07 * sh; out[1] += 0.17 * sh; out[2] += 0.08 * sh;
    return out;
  }
  // 방향 v[i..i+2] 를 단위 축 (kx, ky, kz) 둘레로 (cos c, sin s) 만큼 돌림 (로드리게스)
  function rotK(v, i, kx, ky, kz, c, s) { const x = v[i], y = v[i + 1], z = v[i + 2], d = (kx * x + ky * y + kz * z) * (1 - c); v[i] = x * c + (ky * z - kz * y) * s + kx * d; v[i + 1] = y * c + (kz * x - kx * z) * s + ky * d; v[i + 2] = z * c + (kx * y - ky * x) * s + kz * d; }
  // 3인칭 달리기 자세 (동작표 run.tp): tppRow 자세를 ka.rw 만큼 그 자세로 — 동작표에 run.tp 가 없으면 false (04_motion.js 가 기본 MEL_RUN 으로)
  //  걸음에 맞춰 어깨를 축으로 팔을 흔든다: 오른팔은 왼발과 함께 앞으로(−cos 위상) · 왼손은 반대 · 뒤로는 앞의 0.6배만(팔꿈치가 등 뒤로 꺾이지 않게)
  //  손 방향도 흔든 각의 0.85배를 따라가 손목이 꺾이지 않음(주먹이 아래팔과 일직선 · 손등은 늘 위) · 팔꿈치 방향은 0.4배만 따라가 옆구리에 붙은 채
  const _rp = new Array(19).fill(0), SHR = [-0.191, 0.171, 0], SHL = [0.191, 0.171, 0];
  // 가슴 로컬 x(왼쪽) 축 둘레로 돌림 (+ = 앞으로 · 점은 C 를 중심으로, C 가 없으면 방향)
  function swingX(v, i, a, C) { const c0 = C ? C[1] : 0, c1 = C ? C[2] : 0, y = v[i + 1] - c0, z = v[i + 2] - c1, cs = Math.cos(a), sn = Math.sin(a); v[i + 1] = c0 + y * cs + z * sn; v[i + 2] = c1 - y * sn + z * cs; }
  // 손 방향 쌍(날 방향 v[i..i+2] · 손가락 쪽 v[i+3..i+5]) ↔ 사원수 — 손가락 쪽은 날 방향에 수직으로 맞춤(몸이 손 방향을 만들 때와 같음)
  const _dq1 = new THREE.Quaternion(), _dq2 = new THREE.Quaternion(), _dX = new THREE.Vector3(), _dY = new THREE.Vector3(), _dZ = new THREE.Vector3(), _dM = new THREE.Matrix4();
  function dirQ(q, v, i) {
    _dX.set(v[i], v[i + 1], v[i + 2]).normalize(); _dY.set(v[i + 3], v[i + 4], v[i + 5]); _dY.addScaledVector(_dX, -_dY.dot(_dX));
    if (_dY.lengthSq() < 1e-8) _dY.set(0, 1, 0).addScaledVector(_dX, -_dX.y); _dY.normalize(); _dZ.crossVectors(_dX, _dY);
    return q.setFromRotationMatrix(_dM.makeBasis(_dX, _dY, _dZ));
  }
  function qDir(v, i, q) { _dX.set(1, 0, 0).applyQuaternion(q); _dY.set(0, 1, 0).applyQuaternion(q); v[i] = _dX.x; v[i + 1] = _dX.y; v[i + 2] = _dX.z; v[i + 3] = _dY.x; v[i + 4] = _dY.y; v[i + 5] = _dY.z; }
  function tppRun(c, out, ph) {
    const ka = c.ka, S = ka && SPEC[ka.kind], R = S && S.run; if (!R || !R.tp) return false;
    // 휘두르는 중 — 달리며 휘두르기 줄(attack[i].run)이 있으면: 손 자리는 첫 프레임부터 휘두르는 3인칭 줄의 장전 자리로 넘겨주고(u 0~0.2) 그 줄이 돌아오는 구간(u 0.56~0.95)에 다시 달리기 자세로
    //  (걸음 흔들기도 그동안은 줄어듦) · 손 방향은 같은 때에 달리기 자세 방향 → run 줄 방향(tppRow 의 _rrD — 손등 위 장전·휘두름) → 달리기 자세 방향으로 이어 붙인 것을
    //  대기 중 달리기처럼 ka.rw 만큼 (휘두르기 시작·끝에서 대기 중 달리기와 같은 방향이라 섞는 정도가 어중간해도 튀지 않음)
    //  없으면: 손 자리는 휘두르는 3인칭 줄이 손을 끌어올리는 무렵(u 0.2~0.32) 넘겨주고 그 줄이 돌아오는 구간(u 0.56~0.95)에서만 다시 (뻗은 팔이 한 번에 끌려오지 않게)
    //   손 방향은 ka.rw 그대로 — 휘두르는 줄이 손등 위로 돌아올 때까지 달리던 손등 위 그대로 (손이 대기 자세 쪽으로 기울었다 다시 엎어지지 않게)
    const w = ka.rw || 0; let wp = w, hd = -1;
    if (ka.st === 'attack' && ka.sw) {
      const u = ka.sw.t / ka.sw.total, at = trackOf(ka, 'attack');
      if (at && at.rr) { hd = Math.max(1 - sstep(0, 0.2, u), sstep(0.56, 0.95, u)); wp = w * hd; }
      else wp = Math.min(w, Math.max(1 - sstep(0.2, 0.32, u), sstep(0.56, 0.95, u)));
    }
    if (w < 0.001) return true;
    const T = R.tp, o = T.length > 19 ? 1 : 0, s = -Math.cos(ph), q = 0.2 * s * s, a = R.sw * (0.8 * s + q), al = R.sw * (-0.8 * s + q);
    for (let i = 0; i < 19; i++) _rp[i] = T[i + o];
    swingX(_rp, 0, a, SHR); swingX(_rp, 3, a * 0.85); swingX(_rp, 6, a * 0.85); swingX(_rp, 16, a * 0.4, SHR); swingX(_rp, 13, al, SHL);
    if (hd >= 0 && _rrK === ka) for (let i = 3; i < 9; i++) _rp[i] = lerp(_rrD[i - 3], _rp[i], hd);
    //  손 방향은 사원수로 구면 섞기 — 방향 벡터를 그대로 섞으면 두 방향이 거의 반대일 때(달리기를 멈추자마자 살펴보며 칼을 눕힌 손 등) 길이가 0 근처를 지나며 한두 프레임에 뒤집힘
    //   (섞는 비율은 sstep — 대기 자세 ↔ 달리기 자세처럼 130° 쯤 떨어진 두 방향을 그대로 섞던 때와 거의 같은 빠르기로 돎)
    dirQ(_dq1, out, 3); dirQ(_dq2, _rp, 3); _dq1.slerp(_dq2, sstep(0, 1, w)); qDir(out, 3, _dq1);
    for (let i = 0; i < 19; i++) if (i < 3 || i >= 9) out[i] = lerp(out[i], _rp[i], wp);
    return true;
  }
  const fingersOf = (c) => fing(c.ka.row, _F5);
  const fingers3 = (c, Ar, w) => setK(Ar, fing(c.ka.row, _F5), w);
  // 3인칭 손에 든 모델의 부품·손 안 회전 (setHeld 뒤 매 프레임) — 전용 동작이 끝났으면 원래 자리로
  function tppApply(c, r) {
    const o = r.armR.hold.children[0]; if (!o) return;
    if (!on(c) || c.ka.mid !== c.melee) { unplace(o); return; }
    place(r.armR, o, SPEC[c.ka.kind], c.ka.row, 1);
  }
  // 3인칭 휘두르기 자국: 실제 날 끝(부품·손 안 회전 반영)에서 — 처리했으면 true
  const _t3a = new THREE.Vector3(), _t3b = new THREE.Vector3();
  function trail3(c, r, s2) {
    if (!on(c)) return false;
    const o = r.armR.hold.children[0]; if (!o) return false;
    const D = ITEMS[s2.id], sk = MeleeSkin.ofChar(c, s2.id);
    if (s2.t > D.wind * 0.85 && s2.t < D.wind + D.strike * 1.35) { tipBase(o, s2.id, sk, _t3a, _t3b); FX.trail('c' + c.id, G.scene, _t3a, _t3b, MeleeSkin.trail(s2.id, sk)); }
    return true;
  }
  return { K, KO, def, SPEC, dbg, kindOf, canInspect, ownDraw, tick, on, inspect, vm, vmOut, vmOff, outActive, cam, hit, alt, swingSound, tppRow, tppRun, fingersOf, fingers3, tppApply, trail3, sheath, unplace, place, handPose, warmVM };
})();
