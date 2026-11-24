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
//        회전 중심 3 (모델 좌표 m — 없으면 동작표 pivot, 그것도 없으면 쥔 점)]
//    키프레임 사이는 Catmull-Rom (kfSample) · 손 자리·손목은 상태의 amp 로 키우고 줄임
//  · 상태가 바뀌면 바뀌기 직전 줄을 붙잡아 두고 짧게 섞어 넘어간다(순간이동 없음) · 부품·무기 회전은 2π 를 더하고 빼 새 상태와 가까운 쪽에서 섞음
//  · 맞히는 시간·거리·피해·쿨타임·꺼내는 시간은 기본 무기와 똑같다 — 휘두르기 줄의 u = 휘두른 시간 / 전체 시간,
//    화면 숙임도 기본 무기 그대로(근접 판정 방향 = 카메라 앞) · 옆 기울임만 동작마다
//  · 소리: 동작표의 S = [[u, 이름], …] (내 캐릭터의 꺼내기·대기 손장난·살펴보기·넣기·휘두르기 중) — 이름은 동작표 snd 의 소리(Audio.mskin) 또는 Audio.knife 의 것
// ============================================================
const KAnim = (() => {
  const PI = Math.PI, P2 = PI * 2, NV = 24, IR = 3, IF = 6, IP = 11, IW = 15, IT = 18, IV = 21;
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
  //    idle: { amp, speed, part(부품 0 흔들림), fid: [손장난 줄들 — 더하는 값], every: [최소, 최대 초] }, equip, unequip: { dur, speed, amp, K, S },
  //    attack: [{ K, S, roll(옆 기울임 rad), kick(맞힘 흔들림 방향 ±1) } …](u = 휘두른 시간 비율), inspect: [{ dur, speed, amp, K, S, gl: [[u0, u1] …](날을 따라 빛이 반짝 지나감) } …],
  //    snd: { 이름: [길이(초), 소리 조각들] }(Audio.mskin), swing: 휘두르는 소리 이름 또는 [첫째, 둘째], ghost: 잔상 빠르기 기준(m/s, 0 = 없음) })
  function def(shape, sp) {
    const D = MSHAPE[shape]; if (!D) { console.warn('KAnim: 모양 없음', shape); return null; }
    const mid = D.melee, vb = VBASE[mid], b = sp.base || {}, F0 = b.f || F_GRIP;
    const S = { shape, mid, F0, h: b.h || [vb[1], vb[2], vb[3]], B: b.b || [vb[4], vb[5], vb[6]], E: b.e || [vb[7], vb[8], vb[9]], snd: sp.snd || {}, swing: sp.swing || null,
      ghost: sp.ghost !== undefined ? sp.ghost : 1.6, pivot: sp.pivot || null, idle: sp.idle || {}, kar: D.rig === 'karambit', bal: D.rig === 'balisong' };
    // 카메라 공간(z 뒤) 기본 손바닥 자리 · 손 방향
    S.P0 = new THREE.Vector3(S.h[0], S.h[1], -S.h[2]);
    S.Q0 = bladeQuat(new THREE.Quaternion(), new THREE.Vector3(S.B[0], S.B[1], -S.B[2]), new THREE.Vector3(S.E[0], S.E[1], -S.E[2]));
    const tr = (t, add) => { if (!t) return null; const R = []; for (const k of t.K) R.push(Array.isArray(k) ? k : rowOf(k, F0, add, add ? null : S, R[R.length - 1])); return Object.assign({}, t, { R }); };
    S.equip = tr(sp.equip || DEF.equip); S.unequip = tr(sp.unequip || DEF.unequip);
    S.attack = (sp.attack || []).map((t) => tr(t)); S.inspect = (sp.inspect || []).map((t) => tr(t)); S.fid = (S.idle.fid || []).map((t) => tr(t, true));
    S.rest = rowOf(K(0), F0, false, S, null);
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
  // 새 상태로: 지금 줄(처음이면 기본 자세 · low 면 화면 아래)을 붙잡아 bd 초 동안 섞는다
  function enter(ka, st, bd, low) {
    const S = SPEC[ka.kind];
    if (!ka.st || low) { for (let i = 0; i < NV; i++) ka.from[i] = S.rest[i + 1]; if (low) ka.from[1] -= 0.42; }
    else for (let i = 0; i < NV; i++) ka.from[i] = ka.row[i];
    ka.st = st; ka.t = 0; ka.bt = 0; ka.bd = bd; ka.u0 = -1; ka.fi = -1;
    const t = trackOf(ka, st), r0 = t ? t.R[0] : S.rest;
    for (const i of SPIN) ka.from[i] += P2 * Math.round((r0[i + 1] - ka.from[i]) / P2);
  }
  function snd(S, k, pos, own, swing) {
    const r = S.snd[k];
    if (r) { if (Audio.mskin) Audio.mskin(r[1], r[0], pos, own, swing ? null : S.shape + ':' + k, swing); }
    else if (Audio.knife) Audio.knife(k, pos, own);
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
      if (!ka.held || !ka.st || ka.st === 'unequip') { const eq = c.equipT > 0.05; enter(ka, eq ? 'equip' : 'idle', eq ? (ka.st ? 0.08 : 0) : 0.26, !eq && !ka.st); ka.held = true; ka.sw = sw; ka.fn = 2.5 + Math.random() * 3; }
      if (sw && sw !== ka.sw) { ka.sw = sw; ka.v = S.attack.length > 1 && sw.side < 0 ? 1 : 0; enter(ka, 'attack', 0.07); }
      else if (ka.st === 'attack' && !sw) enter(ka, 'idle', 0.1);
      if (ka.req) {
        ka.req = 0;
        if (ka.st === 'idle' && S.inspect.length && !c.sprint && !sw && !c.heal && !c.throwMode) { ka.iv = ka.reqV >= 0 && ka.reqV < S.inspect.length ? ka.reqV : pickOther(S.inspect.length, ka.il); ka.il = ka.iv; enter(ka, 'inspect', 0.16); }
        ka.reqV = -1;
      }
      // 살펴보기는 달리면 · 꺼내기·살펴보기는 회복·투척을 시작하면 끊고 대기로 (손은 회복·투척 동작이 차지 — 꺼내는 소리가 붕대 위로 나지 않게)
      if ((ka.st === 'inspect' && c.sprint) || ((ka.st === 'inspect' || ka.st === 'equip') && (c.heal || c.throwMode || c.throwAnim > 0 || c.nadeQ))) enter(ka, 'idle', 0.2);
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
    ka.t += dt * sp; ka.bt += dt; ka.kick = Math.max(0, ka.kick - dt * 7);
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
      if (S.fid.length) {
        if (ka.fi < 0) { ka.fn -= dt; if (ka.fn <= 0) { ka.fi = pickOther(S.fid.length, ka.fl); ka.ft = 0; ka.fu0 = -1; } }
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
      if (c.isPlayer && tr.S) for (const [su, k] of tr.S) if (ka.u0 < su && u >= su) snd(S, k, null, true);
    }
    ka.u0 = u;
    // 3인칭: 꺼내기·살펴보기 동안 손을 가슴 앞으로 들어 올리는 정도(멀리서도 동작이 보이게) — 부드럽게 따라감
    const shT = ka.st === 'equip' ? sstep(0.1, 0.3, u) * (1 - sstep(0.8, 1, u)) : ka.st === 'inspect' ? sstep(0, 0.08, u) * (1 - sstep(0.9, 1, u)) : 0;
    ka.sh = lerp(ka.sh || 0, shT, clamp(dt * 8, 0, 1));
    const w = ka.bd > 0 ? sstep(0, 1, ka.bt / ka.bd) : 1;
    for (let i = 0; i < NV; i++) ka.row[i] = w >= 1 ? _tg[i] : lerp(ka.from[i], _tg[i], w);
    // 시험용: 고정 자세 (dbg.k = K(...) — 내 캐릭터만)
    if (dbg.k && c.isPlayer) { const r = rowOf(dbg.k, S.F0, false, S, null); for (let i = 0; i < NV; i++) ka.row[i] = r[i + 1]; }
    return ka.row;
  }
  const dbg = { k: null };
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
  function place(Ar, o, S, v, sc) {
    const rig = o.userData.rig; o.userData.kaSet = true;
    if (S.kar && rig) { karamPlace(Ar, o, v[IP]); return; }
    _we.set(v[IW], v[IW + 1], v[IW + 2], 'XYZ'); o.quaternion.setFromEuler(_we);
    _wv.set(v[IV], v[IV + 1], v[IV + 2]).applyQuaternion(o.quaternion); o.position.set(v[IV] - _wv.x, v[IV + 1] - _wv.y, v[IV + 2] - _wv.z);
    o.position.x += v[IT]; o.position.y += v[IT + 1]; o.position.z += v[IT + 2];
    if (rig && S.bal) { rig.blade.rotation.x = v[IP]; rig.B.rotation.x = v[IP + 1]; rig.latch.rotation.x = v[IP + 2]; o.position.z += v[IP + 3]; }
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
  const _tp = new THREE.Vector3(), _bp = new THREE.Vector3(), _lt = new THREE.Vector3();
  // 잔상: 빠르게 움직이는 날(관절 모델은 날 부품, 아니면 무기 전체)을 지난 몇 프레임 자리에 옅게 — 낮은 화질이면 생략
  //  메시마다 지난 자리 4개를 돌려 쓰는 행렬 고리(무기가 바뀔 때만 새로 만듦) · 잔상 3장(가까운 것일수록 진하게)
  const GH = { src: null, list: [], ms: [], ring: [], head: 0, n: 0, mats: null, lt: false, wm: null }, GOP = [0.15, 0.09, 0.045];
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
    if (SETTINGS.quality === 'low' || !th) { if (GH.list.length) ghostClear(); return; }
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
  // 1인칭 뷰모델: 오른손 + 무기 (왼손은 09_player.js 가 그대로) — 반환 = 왼손이 참고할 { pull, low } 또는 null(기본 동작으로)
  const _vmInfo = { pull: 0, low: 0 };
  function vm(dt, p, A, run, force) {
    const ka = p.ka; if (!ka || !ka.st || (ka.st === 'unequip' && !force) || kindOf(p, ka.mid) !== ka.kind) { if (GH.list.length || GH.lt) ghostClear(); if (GLS) GLS.visible = false; return null; }
    const S = SPEC[ka.kind], sk = MeleeSkin.ofChar(p, ka.mid);
    vmHeld(A.R, ka.mid, sk);
    const o = A.R.hold.children[0]; if (!o) return null;
    if (!force) ka.vf = G.frame;   // 이 프레임에 근접 무기 뷰모델을 그렸음 (넣기 판단용)
    const v = ka.row; handPose(S, v, _P, _Q, VM_SC);
    // 걷는 흔들림 · 달리면 아래로 (기본 근접 무기와 같음)
    const bobAmp = clamp(p.anim.speed / 5, 0, 1);
    _P.x += Math.sin(p.anim.phase) * 0.012 * bobAmp + run * 0.05; _P.y -= Math.abs(Math.cos(p.anim.phase)) * 0.014 * bobAmp + run * 0.14;
    if (run > 0.01) { _qr.setFromAxisAngle(AX_X, -run * 0.5); _Q.premultiply(_qr); }
    fing(v, _F5); vmReach(A.R, _P, _Q, _pole.set(0.6, -0.7, 0.15), _F5); setK(A.R, _F5);
    place(A.R, o, S, v, 1 / VM_SC);
    // 휘두르기 자국(휘두르는 순간) + 잔상(빠르게 움직일 때)
    const gs = tipBase(o, ka.mid, sk, _tp, _bp);
    const spd = GH.lt ? _tp.distanceTo(_lt) / Math.max(dt, 1e-3) : 0; _lt.copy(_tp); GH.lt = true;
    const sw = ka.st === 'attack' ? ka.sw : null, D = ITEMS[ka.mid];
    if (sw && sw.t > D.wind * 0.85 && sw.t < D.wind + D.strike * 1.4) FX.trail('vm', VM.scene, _tp, _bp, MeleeSkin.trail(ka.mid, sk));
    // 잔상은 손장난(꺼내기·살펴보기·대기)의 빠른 돌기에만 — 휘두르기는 자국이 따로 있어 겹치면 번져 보임
    ghosts(gs, dt, spd, ka.st === 'attack' || ka.st === 'unequip' ? 0 : S.ghost);
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
  const _tP = new THREE.Vector3(), _tQ = new THREE.Quaternion(), _tB = new THREE.Vector3(), _tE = new THREE.Vector3(), _kt = new Array(19).fill(0);
  function tppRow(c, out) {
    const ka = c.ka, S = SPEC[ka.kind], v = ka.row, rd = TREADY[S.mid], k = 0.8;
    handPose(S, v, _tP, _tQ, VM_SC);
    const dx = _tP.x - S.P0.x, dy = _tP.y - S.P0.y, dz = S.P0.z - _tP.z;
    _tB.set(0, 0, 1).applyQuaternion(_tQ); _tE.set(0, -1, 0).applyQuaternion(_tQ);
    out[0] = rd[1] - dx * k; out[1] = rd[2] + dy * k; out[2] = rd[3] + dz * k;
    out[3] = -_tB.x; out[4] = _tB.y; out[5] = -_tB.z; out[6] = -_tE.x; out[7] = _tE.y; out[8] = -_tE.z;
    out[9] = rd[10] + clamp(-dx * 1.5, -0.55, 0.55); out[10] = rd[11] + clamp(dz * 0.6, -0.1, 0.25); out[11] = -Math.max(0, dz) * 0.08; out[12] = Math.max(0, dz) * 0.15;
    for (let i = 13; i < 19; i++) out[i] = rd[i + 1];
    if (ka.st === 'attack' && ka.sw) {
      const D = ITEMS[S.mid], st = D.style, uu = clamp(ka.sw.t / ka.sw.total, 0, 1);
      kfSample(MEL_KF[st === 'slash' && ka.sw.side < 0 ? 'slashB' : st], uu, _kt);
      if (S.mid === 'knife') {
        out[1] = _kt[1] + dy * 0.5; out[2] = _kt[2] + Math.min(0, dz) * 0.5;
        out[9] = _kt[9] + clamp(-dx * 1.2, -0.5, 0.5); out[10] = _kt[10]; out[11] = _kt[11]; out[12] = _kt[12];
        for (let i = 13; i < 19; i++) out[i] = _kt[i];
      } else { const wv = sstep(0, 0.14, uu) * (1 - sstep(0.86, 1, uu)); for (let i = 0; i < 19; i++) out[i] = lerp(out[i], _kt[i], wv); }
    }
    const sh = ka.sh || 0; out[0] += 0.07 * sh; out[1] += 0.17 * sh; out[2] += 0.08 * sh;
    return out;
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
  return { K, KO, def, SPEC, dbg, kindOf, canInspect, ownDraw, tick, on, inspect, vm, vmOut, vmOff, outActive, cam, hit, alt, swingSound, tppRow, fingersOf, fingers3, tppApply, trail3, sheath, unplace, place, handPose, warmVM };
})();
