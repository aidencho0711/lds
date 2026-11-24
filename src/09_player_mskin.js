// ============================================================
// 09_player_mskin.js — v23 나비 나이프 · 카람빗 전용 동작 (식칼 스킨 knife_sp_bfly · knife_sup_karam — 관절 모델은 05_models_mskin_knife.js)
//  · 상태: 꺼내기(equip) · 대기(idle) · 휘두르기(attack) · 살펴보기(inspect — N · 모바일은 든 근접 무기 칸) · 넣기(unequip — 1인칭)
//    캐릭터마다 c.ka 하나가 상태·시간을 들고(04_motion.js animateChar 에서 프레임마다 한 번 tick), 1인칭 뷰모델(09_player.js
//    updateMeleeVM)과 3인칭 몸(04_motion.js actPose · 손에 든 모델)이 같은 키프레임 줄(row)을 각자의 좌표로 옮겨 그린다
//  · 키프레임 한 줄 = [u, 손(x 오른쪽, y 위, d 앞 — 1인칭 카메라 공간 m), 엄지 쪽 방향(= 칼 모델 +z: x, y, 앞), 손가락 쪽 방향(= 모델 −y),
//                     손가락 5개(가운데·약지·새끼 두 마디, 검지 두 마디, 엄지), 부품 4개]
//    나비 나이프 부품 = [날 각, 손잡이 B 각, 걸쇠 각, 손 안에서 앞으로 미끄러진 거리(m)] — 모두 0 = 펼침, 날 −π = 접힘(날이 손잡이 A 홈 안)
//    카람빗 부품 = [검지 둘레 회전 각, -, -, -] — 0 = 거꾸로 쥠(고리에 검지, 날은 새끼손가락 아래로 나와 앞으로 휨), 2π 마다 한 바퀴
//  · 상태가 바뀌면 바뀌기 직전 줄을 붙잡아 두고 짧게 섞어 넘어간다(순간이동 없음) · 각도는 2π 를 더하고 빼 새 상태와 가까운 쪽에서 섞음
//  · 맞히는 시간·거리·피해·쿨타임·꺼내는 시간(equipT 0.35초)은 기본 식칼과 똑같다 — 꺼내기 연출이 더 길어도 휘두르면 그 자리에서 끊고 휘두름
//  · 소리(Audio.knife)는 내 캐릭터의 꺼내기·살펴보기·넣기만 이곳에서 (휘두르는 소리는 updateSwing — 모든 캐릭터)
// ============================================================
const KAnim = (() => {
  const PI = Math.PI, NV = 18;
  // ---------- 설정: 상태마다 길이(dur 초) · 재생 속도(speed) · 강도(amp — 손 움직임을 대기 자세 기준으로 키우고 줄임, 부품 회전은 그대로) ----------
  //  휘두르기 길이는 게임 규칙(식칼 0.42초)이라 speed 가 없다 · 대기의 amp 는 미세한 흔들림 크기
  const CFG = {
    balisong: { equip: { dur: 1.05, speed: 1, amp: 1 }, idle: { speed: 1, amp: 1 }, attack: { amp: 1 }, inspect: { dur: 3.4, speed: 1, amp: 1 }, unequip: { dur: 0.2, speed: 1, amp: 1 } },
    karambit: { equip: { dur: 0.95, speed: 1, amp: 1 }, idle: { speed: 1, amp: 1 }, attack: { amp: 1 }, inspect: { dur: 3.2, speed: 1, amp: 1 }, unequip: { dur: 0.2, speed: 1, amp: 1 } },
  };
  const R = (u, h, b, e, f, x) => [u, h[0], h[1], h[2], b[0], b[1], b[2], e[0], e[1], e[2], f[0], f[1], f[2], f[3], f[4], x[0], x[1], x[2], x[3]];
  // 손가락: 나비 = 쥠 · 느슨히(돌아오는 손잡이를 받음) · 엄지 들기(걸쇠) / 카람빗 = 쥠(검지는 고리 안) · 검지 펴고 돌림 · 받기
  const GB = [1.72, 1.62, 1.58, 1.42, 1.0], GBL = [1.05, 0.9, 1.35, 1.2, 0.85], GBT = [1.72, 1.62, 1.58, 1.42, 0.4];
  const GK = [1.75, 1.65, 1.5, 1.38, 0.75], GKS = [1.82, 1.74, 0.12, 0.08, 1.05], GKO = [1.2, 1.05, 0.45, 0.3, 0.6];
  const P2 = PI * 2, S5 = 0.035;   // 한 바퀴 · 나비 나이프를 돌릴 때 손 안에서 앞으로 미끄러지는 거리(회전 핀이 검지 앞으로 나와 손잡이가 손가락에 걸리지 않음)

  // ---------- 나비 나이프 ----------
  // 대기: 칼끝은 왼쪽 위 · 손바닥이 화면 쪽으로 조금 돌아 날 옆면과 무지갯빛 손잡이 B 가 보이게
  const BH = [0.155, -0.175, 0.39], BB = [-0.3, 0.8, 0.52], BE = [-0.584, -0.585, 0.562];
  const BI = R(0, BH, BB, BE, GB, [0, 0, 0, 0]);
  const bi = (u, x) => R(u, BH, BB, BE, GB, x || [0, 0, 0, 0]);
  // 뒤집는 손 자세(칼끝이 위, 손가락이 앞-아래) — 손목을 조금씩 튕겨 부품을 돌린다
  const FH = [0.165, -0.165, 0.39], FB = [-0.05, 0.86, 0.5], FE = [-0.3, -0.5, 0.81];
  const BAL = {
    idle: BI,
    // 꺼내기: 접힌 칼을 쥔 손이 화면 아래에서 올라옴 → 엄지로 걸쇠를 튕겨 풂 → 손잡이 B 가 손등 위로 넘어가 앞으로 →
    //  손목을 튕겨 날과 B 를 함께 위로 넘김(B 는 검지 앞을 지나 손바닥으로) → 손가락이 B 를 받아 쥠(딸깍) → 엄지로 걸쇠를 잠금 → 기본 자세
    equip: { K: [
      R(0, [0.25, -0.64, 0.33], [0.22, 0.9, 0.38], [-0.62, -0.2, 0.76], GB, [-PI, 0, 0, S5]),
      R(0.15, [0.19, -0.2, 0.38], [0.06, 0.88, 0.47], [-0.5, -0.36, 0.79], GB, [-PI, 0, 0, S5]),
      R(0.2, [0.19, -0.19, 0.38], [0.04, 0.88, 0.47], [-0.5, -0.36, 0.79], GBT, [-PI, 0, 0.5, S5]),
      R(0.25, [0.19, -0.185, 0.38], [0.06, 0.88, 0.47], [-0.52, -0.33, 0.79], GBT, [-PI, 0, 2.3, S5]),
      R(0.29, [0.2, -0.19, 0.37], [0.2, 0.92, 0.33], [-0.62, -0.16, 0.77], [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, 0.15, 2.3, S5]),
      R(0.41, [0.18, -0.17, 0.4], [-0.14, 0.8, 0.58], [-0.28, -0.6, 0.75], [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, PI, 2.3, S5]),
      R(0.46, [0.18, -0.175, 0.4], [-0.08, 0.82, 0.57], [-0.34, -0.54, 0.77], [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, PI, 2.3, S5]),
      R(0.6, [0.17, -0.175, 0.41], [-0.3, 0.6, 0.74], [0.16, -0.82, 0.55], GBL, [-0.25, P2 - 0.25, 2.3, S5]),
      R(0.68, [0.158, -0.178, 0.392], [-0.26, 0.78, 0.57], [-0.5, -0.62, 0.6], GB, [0, P2, 2.3, S5]),
      R(0.76, BH, BB, BE, GBT, [0, P2, 0.6, 0.02]),
      R(0.82, [0.155, -0.174, 0.392], [-0.29, 0.8, 0.53], BE, GB, [0, P2, 0, 0]),
      R(0.9, [0.154, -0.173, 0.393], [-0.31, 0.79, 0.53], [-0.59, -0.58, 0.56], GB, [0, P2, 0, 0]),
      bi(1, [0, P2, 0, 0])],
      S: [[0.21, 'bOpen'], [0.3, 'bFlip'], [0.47, 'bFlip'], [0.67, 'bClack'], [0.78, 'bClick']] },
    // 휘두르기 0 = 손목을 꺾었다 튕기는 대각선 베기(오른쪽 위 → 왼쪽 아래) · 1 = 비틀어 찌르기(찌르는 동안 손목을 90° 돌림)
    attack: [
      { K: [BI,
        R(0.2, [0.27, -0.07, 0.38], [0.26, 0.62, 0.74], [-0.62, -0.55, 0.56], GB, [0, 0, 0, 0]),
        R(0.35, [0.06, -0.155, 0.56], [-0.1, 0.3, 0.95], [-0.72, -0.66, 0.2], GB, [0, 0, 0, 0]),
        R(0.46, [-0.14, -0.2, 0.48], [-0.45, -0.1, 0.89], [-0.5, -0.8, -0.3], GB, [0, 0, 0, 0]),
        R(0.62, [-0.1, -0.21, 0.45], [-0.4, 0.02, 0.92], [-0.45, -0.85, -0.2], GB, [0, 0, 0, 0]), bi(1)] },
      { K: [BI,
        R(0.2, [0.2, -0.165, 0.33], [-0.05, 0.38, 0.92], [-0.05, -0.92, 0.38], GB, [0, 0, 0, 0]),
        R(0.35, [0.07, -0.1, 0.6], [-0.2, 0.32, 0.92], [-0.93, -0.3, -0.1], GB, [0, 0, 0, 0]),
        R(0.45, [0.075, -0.105, 0.59], [-0.2, 0.3, 0.93], [-0.94, -0.28, -0.1], GB, [0, 0, 0, 0]),
        R(0.7, [0.13, -0.16, 0.47], [-0.25, 0.6, 0.76], [-0.5, -0.68, 0.53], GB, [0, 0, 0, 0]), bi(1)] },
    ],
    // 살펴보기: 손바닥을 화면으로 돌려 날·무지갯빛 손잡이를 보여 주고 천천히 기울임(빛이 날을 따라 흐름) → 걸쇠를 풀고 →
    //  날을 넘겨 접음 → B 를 손등 위로 넘겨 닫음(딸깍) → 닫힌 칼로 손목을 한 번 돌림 → 앞쪽으로 다시 펼침 → 날·B 를 통째로 한 바퀴 → 잠그고 제자리
    inspect: { K: [BI,
      R(0.06, [0.1, -0.15, 0.36], [-0.5, 0.86, 0.1], [-0.86, -0.5, 0], GB, [0, 0, 0, 0]),
      R(0.17, [0.095, -0.145, 0.355], [-0.35, 0.92, 0.16], [-0.92, -0.35, 0.08], [1.72, 1.62, 1.58, 1.42, 1.15], [0, 0, 0, 0]),
      R(0.27, [0.1, -0.15, 0.36], [-0.62, 0.77, 0.06], [-0.77, -0.62, -0.08], [1.72, 1.62, 1.58, 1.42, 0.9], [0, 0, 0, 0]),
      R(0.33, [0.16, -0.2, 0.4], FB, FE, GBT, [0, 0, 0.4, 0.01]),
      R(0.37, FH, FB, FE, GBT, [0, 0, 2.3, S5]),
      R(0.47, [0.17, -0.205, 0.4], [0.08, 0.88, 0.46], [-0.42, -0.4, 0.81], [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, -PI, 2.3, S5]),
      R(0.555, FH, FB, FE, GB, [-PI, -P2, 2.3, S5]),
      R(0.6, [0.17, -0.2, 0.4], [-0.45, 0.8, 0.4], [-0.1, -0.5, 0.86], GB, [-PI, -P2, 2.3, S5]),
      R(0.64, FH, FB, FE, [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, -P2, 2.3, S5]),
      R(0.72, [0.175, -0.215, 0.4], [0.12, 0.85, 0.5], [-0.42, -0.45, 0.79], [1.5, 1.4, 1.5, 1.35, 0.85], [-PI, -3 * PI, 2.3, S5]),
      R(0.815, FH, [-0.12, 0.84, 0.53], [-0.24, -0.53, 0.81], GB, [-P2, -4 * PI, 2.3, S5]),
      R(0.9, FH, [-0.02, 0.86, 0.5], [-0.34, -0.47, 0.81], GBL, [-4 * PI, -6 * PI, 2.3, S5]),
      R(0.94, [0.168, -0.205, 0.41], [-0.15, 0.7, 0.7], [-0.05, -0.7, 0.71], GBT, [-4 * PI, -6 * PI, 0, 0.015]),
      bi(1, [-4 * PI, -6 * PI, 0, 0])],
      S: [[0.33, 'bOpen'], [0.38, 'bFlip'], [0.48, 'bFlip'], [0.553, 'bClack'], [0.61, 'bTick'], [0.65, 'bFlip'], [0.73, 'bFlip'], [0.812, 'bClack'], [0.83, 'bFlip'], [0.898, 'bClack'], [0.935, 'bClick']] },
    // 넣기: 날을 접으며 손이 화면 아래로
    unequip: { K: [BI,
      R(0.55, [0.2, -0.29, 0.38], [0.1, 0.85, 0.5], [-0.4, -0.4, 0.82], GB, [-PI, 0, 0, 0.02]),
      R(1, [0.24, -0.5, 0.34], [0.22, 0.9, 0.38], [-0.62, -0.2, 0.76], GB, [-PI, 0, 0, S5])],
      S: [[0.45, 'bClack']] },
  };

  // ---------- 카람빗 ----------
  // 대기: 거꾸로 쥔 주먹을 가슴 앞에 — 엄지 쪽은 뒤(나) 위, 주먹 마디는 앞 위 → 새끼손가락 아래로 나온 날이 앞-왼쪽으로 나와 갈고리처럼 휨, 고리는 주먹 위
  const KH = [0.16, -0.12, 0.4], KB = [0.45, 0.75, -0.48], KE = [-0.35, 0.55, 0.76];
  const KI = R(0, KH, KB, KE, GK, [0, 0, 0, 0]);
  const ki = (u, x) => R(u, KH, KB, KE, GK, x || [0, 0, 0, 0]);
  // 검지를 앞으로 펴서(손가락 방향 = 화면 안쪽 위) 고리에 건 칼을 돌리는 손 자세
  const SH = [0.16, -0.18, 0.4], SB = [0.05, 0.95, -0.3], SE = [-0.15, 0.3, 0.94];
  const KAR = {
    idle: KI,
    // 꺼내기: 거꾸로 쥔 칼이 화면 아래에서 올라옴 → 검지만 펴서 고리에 건 칼을 두 바퀴 돌림 → 손바닥으로 받아 거꾸로 쥠
    equip: { K: [
      R(0, [0.25, -0.6, 0.33], KB, KE, GK, [0, 0, 0, 0]),
      R(0.16, [0.19, -0.2, 0.38], [0.3, 0.85, -0.42], [-0.28, 0.45, 0.85], GKO, [0, 0, 0, 0]),
      R(0.25, SH, SB, SE, GKS, [0.35, 0, 0, 0]),
      R(0.45, [0.162, -0.168, 0.4], SB, SE, GKS, [P2 + 0.6, 0, 0, 0]),
      R(0.64, [0.165, -0.17, 0.4], SB, SE, GKS, [2 * P2 - 0.25, 0, 0, 0]),
      R(0.69, [0.165, -0.135, 0.4], [0.4, 0.78, -0.45], [-0.33, 0.52, 0.78], GKO, [2 * P2 + 0.12, 0, 0, 0]),
      R(0.76, KH, KB, KE, GK, [2 * P2 - 0.05, 0, 0, 0]),
      R(0.88, [0.16, -0.118, 0.402], KB, KE, GK, [2 * P2, 0, 0, 0]),
      ki(1, [2 * P2, 0, 0, 0])],
      S: [[0.02, 'kDraw'], [0.27, 'kSpin'], [0.47, 'kSpin'], [0.68, 'kCatch']] },
    // 휘두르기 0 = 갈고리 베기(오른쪽 → 왼쪽, 휜 날이 앞장서 걸어 당김) · 1 = 올려 긋기(왼쪽 아래 → 오른쪽 위, 손등으로)
    attack: [
      { K: [KI,
        R(0.2, [0.3, -0.09, 0.36], [0.035, 0.75, -0.657], [0.221, 0.55, 0.806], GK, [0, 0, 0, 0]),
        R(0.35, [0.06, -0.08, 0.56], [0.555, 0.75, -0.354], [-0.527, 0.55, 0.65], GK, [0, 0, 0, 0]),
        R(0.46, [-0.17, -0.12, 0.47], [0.651, 0.75, -0.093], [-0.823, 0.55, 0.149], GK, [0, 0, 0, 0]),
        R(0.66, [-0.1, -0.15, 0.43], [0.62, 0.75, -0.2], [-0.72, 0.55, 0.42], GK, [0, 0, 0, 0]), ki(1)] },
      { K: [KI,
        R(0.2, [0.03, -0.2, 0.42], [0.45, 0.883, 0.116], [-0.35, -0.07, 0.935], GK, [0, 0, 0, 0]),
        R(0.35, [0.15, -0.08, 0.58], [0.45, 0.574, -0.68], [-0.35, 0.75, 0.563], GK, [0, 0, 0, 0]),
        R(0.46, [0.27, 0.02, 0.46], [0.45, 0.179, -0.873], [-0.35, 0.928, 0.136], GK, [0, 0, 0, 0]),
        R(0.68, [0.22, -0.07, 0.42], [0.45, 0.5, -0.74], [-0.35, 0.8, 0.49], GK, [0, 0, 0, 0]), ki(1)] },
    ],
    // 살펴보기: 화면 가운데로 올리며 검지만 펴서 칼을 고리째 늘어뜨림 → 손목을 천천히 돌려 칼이 시계추처럼 흔들리며 휜 날·고리 옆모습이 보이고 빛이 흐름 →
    //  두 바퀴 돌려 받고 → 반대로 한 바퀴 돌려 다시 받음 → 제자리 (나비 나이프는 손바닥을 돌려 보여 주고 부품을 접었다 폄 — 서로 다른 동작)
    inspect: { K: [KI,
      R(0.08, [0.11, -0.09, 0.38], SB, SE, GKS, [0, 0, 0, 0]),
      R(0.15, [0.105, -0.088, 0.38], [0, 0.95, -0.3], [-0.2, 0.3, 0.93], GKS, [0.75, 0, 0, 0]),
      R(0.22, [0.11, -0.09, 0.38], [0.08, 0.95, -0.3], [-0.1, 0.3, 0.95], GKS, [-0.55, 0, 0, 0]),
      R(0.28, [0.108, -0.089, 0.38], SB, SE, GKS, [0.3, 0, 0, 0]),
      R(0.33, [0.11, -0.09, 0.38], SB, SE, GKS, [-0.1, 0, 0, 0]),
      R(0.38, SH, SB, SE, GKS, [0.2, 0, 0, 0]),
      R(0.48, [0.158, -0.168, 0.4], SB, SE, GKS, [P2 + 0.4, 0, 0, 0]),
      R(0.58, [0.16, -0.17, 0.4], SB, SE, GKS, [2 * P2 - 0.2, 0, 0, 0]),
      R(0.62, [0.165, -0.135, 0.4], [0.4, 0.78, -0.45], [-0.33, 0.52, 0.78], GKO, [2 * P2 + 0.1, 0, 0, 0]),
      R(0.66, KH, KB, KE, GK, [2 * P2, 0, 0, 0]),
      R(0.69, SH, SB, SE, GKS, [2 * P2 - 0.15, 0, 0, 0]),
      R(0.78, [0.162, -0.169, 0.4], SB, SE, GKS, [P2 + 0.2, 0, 0, 0]),
      R(0.81, [0.165, -0.135, 0.4], [0.4, 0.78, -0.45], [-0.33, 0.52, 0.78], GKO, [P2 - 0.08, 0, 0, 0]),
      R(0.85, KH, KB, KE, GK, [P2, 0, 0, 0]),
      ki(1, [P2, 0, 0, 0])],
      S: [[0.06, 'kTick'], [0.16, 'kTick'], [0.39, 'kSpin'], [0.5, 'kSpin'], [0.61, 'kCatch'], [0.7, 'kSpin'], [0.8, 'kCatch']] },
    unequip: { K: [KI,
      R(0.5, [0.21, -0.28, 0.37], SB, SE, GKS, [-PI, 0, 0, 0]),
      R(1, [0.24, -0.5, 0.33], KB, KE, GK, [-P2, 0, 0, 0])],
      S: [[0.1, 'kSpin']] },
  };
  const TR = { balisong: BAL, karambit: KAR };

  // ---------- 누가 무엇을 들었나 ----------
  // 식칼에 전용 동작이 있는 스킨이면 'balisong' · 'karambit', 아니면 null
  function kindOf(c) {
    if (!c || !c.look) return null;
    const sk = MeleeSkin.ofChar(c, 'knife'), S = sk && Body.SKINS[sk], D = S && MSHAPE[S.shape];
    return D && D.rig && TR[D.rig] ? D.rig : null;
  }

  // ---------- 상태 ----------
  const _tg = new Array(NV).fill(0), _f0 = new Array(NV).fill(0);
  const trackOf = (ka, st) => st === 'attack' ? TR[ka.kind].attack[ka.v] : TR[ka.kind][st];
  function startRow(ka, st, out) { const t = trackOf(ka, st); const src = st === 'idle' ? t : t.K[0]; for (let i = 0; i < NV; i++) out[i] = src[i + 1]; return out; }
  // 새 상태로: 지금 줄(처음이면 대기 자세 · low 면 화면 아래)을 붙잡아 bd 초 동안 섞는다 — 부품 각은 새 상태 첫 줄과 가까운 쪽으로 2π 맞춤
  function enter(ka, st, bd, low) {
    const T = TR[ka.kind];
    if (!ka.st || low) { for (let i = 0; i < NV; i++) ka.from[i] = T.idle[i + 1]; if (low) ka.from[1] -= 0.42; }
    else for (let i = 0; i < NV; i++) ka.from[i] = ka.row[i];
    ka.st = st; ka.t = 0; ka.bt = 0; ka.bd = bd; ka.u0 = -1;
    startRow(ka, st, _f0);
    for (let i = 14; i < 17; i++) ka.from[i] += P2 * Math.round((_f0[i] - ka.from[i]) / P2);
  }
  // 한 프레임: 상태 전환 → 시간 → 키프레임 → 섞기 (animateChar 에서 캐릭터마다 한 번) · 반환 = 줄(전용 동작 중) 또는 null
  function tick(c, dt) {
    const held = c.melee === 'knife' && c.alive && !c.knocked && c.mode === 'ground' && !c.veh;
    let ka = c.ka;
    const kind = held || (ka && (ka.held || ka.st === 'unequip')) ? kindOf(c) : null;
    if (!kind) { if (ka) { ka.st = null; ka.held = false; } return null; }
    if (!ka) ka = c.ka = { kind, st: null, t: 0, bt: 1, bd: 0, from: new Array(NV).fill(0), row: new Array(NV).fill(0), held: false, sw: null, v: 0, req: 0, kick: 0, kdir: 1, it: 0, u0: -1 };
    if (ka.kind !== kind) { ka.kind = kind; ka.st = null; }
    const sw = c.swing && c.swing.id === 'knife' ? c.swing : null;
    if (held) {
      if (!ka.held || !ka.st || ka.st === 'unequip') { const eq = c.equipT > 0.05; enter(ka, eq ? 'equip' : 'idle', eq ? (ka.st ? 0.08 : 0) : 0.26, !eq && !ka.st); ka.held = true; ka.sw = sw; }
      if (sw && sw !== ka.sw) { ka.sw = sw; ka.v = sw.side < 0 ? 1 : 0; enter(ka, 'attack', 0.07); }
      else if (ka.st === 'attack' && !sw) enter(ka, 'idle', 0.1);
      if (ka.req) { ka.req = 0; if (ka.st === 'idle' && !c.sprint && !sw && !c.heal && !c.throwMode) enter(ka, 'inspect', 0.16); }
      // 살펴보기는 달리면 · 꺼내기·살펴보기는 회복·투척을 시작하면 끊고 대기로 (손은 회복·투척 동작이 차지 — 꺼내는 소리가 붕대 위로 나지 않게)
      if ((ka.st === 'inspect' && c.sprint) || ((ka.st === 'inspect' || ka.st === 'equip') && (c.heal || c.throwMode || c.throwAnim > 0 || c.nadeQ))) enter(ka, 'idle', 0.2);
    } else if (ka.held) {
      // 넣기(1인칭에서 보이는 손만): 칼을 아직 가지고 있는 채 총·투척·회복으로 바꿈 — 칼을 접으며 손이 내려간다
      //  바로 앞 프레임에 칼 뷰모델을 실제로 그렸을 때만 (회복·투척 뷰모델 중이었으면 보이지 않던 칼을 꺼내 보이지 않게)
      ka.held = false;
      if (c.isPlayer && ka.vf === G.frame - 1 && G.firstPerson && c.alive && !c.knocked && c.inv.melee === 'knife' && c.mode === 'ground' && !c.veh) enter(ka, 'unequip', 0.04);
      else { ka.st = null; return null; }
    }
    // 넣는 중에 기절·탑승·사망·3인칭으로 바뀌면 바로 끝냄
    if (ka.st === 'unequip' && (!c.alive || c.knocked || c.veh || c.mode !== 'ground' || !G.firstPerson)) { ka.st = null; return null; }
    const C = CFG[kind], cs = C[ka.st] || C.idle, T = TR[kind];
    ka.t += dt * (cs.speed || 1); ka.bt += dt; ka.kick = Math.max(0, ka.kick - dt * 7);
    let u = 0;
    if (ka.st === 'attack') u = ka.sw ? clamp(ka.sw.t / ka.sw.total, 0, 1) : 1;
    else if (ka.st !== 'idle') u = clamp(ka.t / cs.dur, 0, 1);
    if (u >= 1 && (ka.st === 'equip' || ka.st === 'inspect')) { enter(ka, 'idle', 0.12); u = 0; }
    else if (u >= 1 && ka.st === 'unequip') { ka.st = null; return null; }
    // 목표 줄
    if (ka.st === 'idle') {
      for (let i = 0; i < NV; i++) _tg[i] = T.idle[i + 1];
      // 대기: 숨 쉬듯 손이 아주 조금 오르내리고 손목이 살짝 돌며, 엄지·검지가 손잡이를 만지작 (강도 amp · 속도 speed)
      const a = cs.amp, it = ka.it += dt * (cs.speed || 1);
      _tg[0] += Math.sin(it * 0.9) * 0.003 * a; _tg[1] += Math.sin(it * 1.3 + 1) * 0.0025 * a; _tg[2] += Math.sin(it * 0.6 + 2) * 0.002 * a;
      _tg[3] += Math.sin(it * 0.7 + 2) * 0.022 * a; _tg[6] += Math.sin(it * 0.8) * 0.022 * a; _tg[7] += Math.sin(it * 0.55 + 1) * 0.015 * a;
      _tg[13] += Math.sin(it * 1.1) * 0.09 * a; _tg[11] += Math.sin(it * 0.6 + 1.5) * 0.05 * a;
      if (kind === 'karambit') _tg[14] += Math.sin(it * 0.75) * 0.03 * a;   // 고리에 걸린 칼이 살짝 흔들림
    } else {
      const tr = trackOf(ka, ka.st); kfSample(tr.K, u, _tg);
      const a = cs.amp; if (a !== undefined && a !== 1) { const b = T.idle; for (let i = 0; i < 14; i++) _tg[i] = b[i + 1] + (_tg[i] - b[i + 1]) * a; }
      if (c.isPlayer && tr.S && Audio.knife) for (const [su, k] of tr.S) if (ka.u0 < su && u >= su) Audio.knife(k, null, true);
    }
    ka.u0 = u;
    // 3인칭: 꺼내기·살펴보기 동안 손을 가슴 앞으로 들어 올리는 정도(멀리서도 부품 동작이 보이게) — 부드럽게 따라감
    const shT = ka.st === 'equip' ? sstep(0.1, 0.3, u) * (1 - sstep(0.8, 1, u)) : ka.st === 'inspect' ? sstep(0, 0.08, u) * (1 - sstep(0.9, 1, u)) : 0;
    ka.sh = lerp(ka.sh || 0, shT, clamp(dt * 8, 0, 1));
    const w = ka.bd > 0 ? sstep(0, 1, ka.bt / ka.bd) : 1;
    for (let i = 0; i < NV; i++) ka.row[i] = w >= 1 ? _tg[i] : lerp(ka.from[i], _tg[i], w);
    return ka.row;
  }
  const on = (c) => !!(c && c.ka && c.ka.st && c.ka.held);
  // 살펴보기 요청 (N · 모바일 든 칸) — 대기 중일 때만 시작
  function inspect(c) { if (c && c.ka && c.ka.held && kindOf(c)) { c.ka.req = 1; return true; } return false; }

  // ---------- 손에 든 칼 부품 ----------
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
  // 줄의 부품 값을 모델에 (매 프레임 모두 다시 — 모델이 새로 만들어져도 그대로) · sc = 손 그룹 1단위가 실제 몇 m 인지의 역수
  function parts(Ar, o, v, sc) {
    const rig = o.userData.rig;
    if (rig.kind === 'balisong') { rig.blade.rotation.x = v[14]; rig.B.rotation.x = v[15]; rig.latch.rotation.x = v[16]; o.quaternion.identity(); o.position.set(0, 0, v[17] * sc); }
    else karamPlace(Ar, o, v[14]);
  }
  // 허리에 찬 나비 나이프는 접힌 채
  function sheath(o) { const rig = o && o.userData.rig; if (rig && rig.kind === 'balisong') rig.blade.rotation.x = -PI; }
  // 날 끝·날 뿌리 (부품 로컬) — 휘두르기 자국 · 잔상 빠르기
  const TIP = { balisong: { part: 'blade', tip: [0, 0.0036, 0.1305], base: [0, 0, 0.035] }, karambit: { part: 'spin', tip: [0, -0.059, 0.2673], base: [0, 0.0027, 0.1378] } };
  function tipBase(o, tip, base) {
    const rig = o.userData.rig, T = TIP[rig.kind], pt = rig[T.part]; pt.updateWorldMatrix(true, false);
    tip.fromArray(T.tip).applyMatrix4(pt.matrixWorld); base.fromArray(T.base).applyMatrix4(pt.matrixWorld);
  }
  const fing = (v, out) => { for (let i = 0; i < 5; i++) out[i] = v[9 + i]; return out; };
  // 손가락: 네 손가락은 setFingers 그대로, 엄지는 1 = 주먹처럼 검지 옆으로 접음(setFist · 기본 칼과 같음) ↔ 0 = 펴서 들어 올림(걸쇠를 튕길 때)
  function setK(Ar, F, w = 1) {
    setFingers(Ar, F, w);
    const s = Ar.side, R0 = Body.REST['thumb1' + (s > 0 ? 'L' : 'R')], k = clamp(F[4], 0, 1.2) * w;
    Ar.thumb1.rotation.set(R0[0] + 0.8 * k, R0[1], R0[2]); Ar.thumb2.rotation.set(0, 0, -s * 0.6 * k);
  }

  // ---------- 1인칭 ----------
  const _P = new THREE.Vector3(), _B = new THREE.Vector3(), _E = new THREE.Vector3(), _Q = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _pole = new THREE.Vector3(), _F5 = [0, 0, 0, 0, 0];
  const _tp = new THREE.Vector3(), _bp = new THREE.Vector3(), _lt = new THREE.Vector3();
  // 줄 → 카메라 공간 손 자리·방향 (+ 걷는 흔들림 · 달리면 아래로)
  function vmPose(p, v, run) {
    const bobAmp = clamp(p.anim.speed / 5, 0, 1);
    _P.set(v[0] + Math.sin(p.anim.phase) * 0.012 * bobAmp + run * 0.05, v[1] - Math.abs(Math.cos(p.anim.phase)) * 0.014 * bobAmp - run * 0.14, -v[2]);
    _B.set(v[3], v[4], -v[5]); _E.set(v[6], v[7], -v[8]); bladeQuat(_Q, _B, _E);
    if (run > 0.01) { _qr.setFromAxisAngle(AX_X, -run * 0.5); _Q.premultiply(_qr); }
  }
  // 잔상: 빠르게 도는 칼날(나비 = 날 부품, 카람빗 = 칼 전체)을 지난 몇 프레임 자리에 옅게 — 낮은 화질이면 생략
  //  지난 자리 4개를 돌려 쓰는 행렬 고리(프레임마다 새로 만들지 않음) · 잔상 3장(가까운 것일수록 진하게)
  const GH = { src: null, list: [], ring: [0, 1, 2, 3].map(() => new THREE.Matrix4()), head: 0, n: 0, mats: null, lt: false, wm: null }, GOP = [0.2, 0.12, 0.06];
  const ghostMats = () => GH.mats || (GH.mats = GOP.map((op) => new THREE.MeshBasicMaterial({ color: 0xd8e6ff, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })));
  // 잔상 재질을 뷰모델 장면에 미리 (보이지 않는 작은 판) — 경기 시작 때 뷰모델 셰이더를 미리 만들 때 같이 만들어져, 처음 돌릴 때 화면이 멈추지 않게 (09_player.js buildViewModel)
  function warmVM(sc) { const m = ghostMats(); if (!GH.wm) { GH.wm = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), m[0]); GH.wm.visible = false; } if (sc && GH.wm.parent !== sc) sc.add(GH.wm); }
  function ghostClear() { for (const m of GH.list) if (m.parent) m.parent.remove(m); GH.list.length = 0; GH.n = 0; GH.src = null; GH.lt = false; }
  function ghosts(o, dt, speed) {
    if (SETTINGS.quality === 'low') { if (GH.list.length) ghostClear(); return; }
    const rig = o.userData.rig, pt = rig[TIP[rig.kind].part];
    if (GH.src !== pt) {
      ghostClear(); GH.src = pt; ghostMats();
      const geos = []; pt.traverse((m) => { if (m.isMesh) geos.push(m.geometry); });
      for (let k = 0; k < 3; k++) for (const g of geos) { const gm = new THREE.Mesh(g, GH.mats[k]); gm.matrixAutoUpdate = false; gm.visible = false; gm.userData.k = k; gm.frustumCulled = false; VM.scene.add(gm); GH.list.push(gm); }
    }
    pt.updateWorldMatrix(true, false);
    GH.head = (GH.head + 1) & 3; GH.ring[GH.head].copy(pt.matrixWorld); GH.n = Math.min(4, GH.n + 1);
    const k0 = clamp((speed - 1.6) / 3, 0, 1);
    for (let k = 0; k < 3; k++) GH.mats[k].opacity = GOP[k] * k0;
    for (const gm of GH.list) { const k = gm.userData.k; gm.visible = k0 > 0.02 && GH.n > k + 1; if (gm.visible) gm.matrix.copy(GH.ring[(GH.head - k - 1) & 3]); }
  }
  // 1인칭 뷰모델: 오른손 + 칼 (왼손은 09_player.js 가 그대로) — 반환 = 왼손이 참고할 { pull, low } 또는 null(기본 동작으로)
  const _vmInfo = { pull: 0, low: 0 };
  function vm(dt, p, A, run, force) {
    const ka = p.ka; if (!ka || !ka.st || (ka.st === 'unequip' && !force) || kindOf(p) !== ka.kind) { if (GH.list.length || GH.lt) ghostClear(); return null; }
    vmHeld(A.R, 'knife', MeleeSkin.ofChar(p, 'knife'));
    const o = A.R.hold.children[0], rig = o && o.userData.rig; if (!rig || rig.kind !== ka.kind) return null;
    if (!force) ka.vf = G.frame;   // 이 프레임에 칼 뷰모델을 그렸음 (넣기 판단용)
    const v = ka.row; vmPose(p, v, run);
    vmReach(A.R, _P, _Q, _pole.set(0.6, -0.7, 0.15), fing(v, _F5)); setK(A.R, _F5);
    parts(A.R, o, v, 1 / VM_SC);
    // 휘두르기 자국 (휘두르는 순간) + 잔상(빠르게 움직일 때)
    tipBase(o, _tp, _bp);
    const sp = GH.lt ? _tp.distanceTo(_lt) / Math.max(dt, 1e-3) : 0; _lt.copy(_tp); GH.lt = true;
    const sw = ka.st === 'attack' ? ka.sw : null, D = ITEMS.knife;
    if (sw && sw.t > D.wind * 0.85 && sw.t < D.wind + D.strike * 1.4) FX.trail('vm', VM.scene, _tp, _bp, MeleeSkin.trail('knife', MeleeSkin.ofChar(p, 'knife')));
    ghosts(o, dt, sp);
    const u = sw ? clamp(sw.t / sw.total, 0, 1) : 0;
    _vmInfo.pull = sw ? Math.sin(Math.PI * clamp((u - 0.2) / 0.55, 0, 1)) : 0;
    _vmInfo.low = ka.st === 'inspect' ? Math.sin(Math.PI * clamp(ka.t / CFG[ka.kind].inspect.dur, 0, 1)) : 0;
    return _vmInfo;
  }
  // 1인칭 넣기: 다른 무기로 바꾼 직후 잠깐(0.2초) 칼을 접으며 내리는 손을 그린다 — 그동안 새 무기 뷰모델은 기다림(새 무기 꺼내는 시간 안)
  function vmOut(dt, p) {
    const ka = p.ka; if (!ka || ka.st !== 'unequip') return false;
    const A = vmArms(); A.root.visible = true; vmResetArms(A); vmHeld(A.L, null);
    // 달리던 중이면 그 낮춘 자세 그대로 이어서 (뷰모델 달리기 값도 계속 갱신 — 바로 다시 꺼내도 튀지 않게)
    const S = VM.melS || (VM.melS = { run: 0 }); S.run = lerp(S.run, p.sprint ? 1 : 0, clamp(dt * 8, 0, 1));
    if (!vm(dt, p, A, S.run, true)) { ka.st = null; return false; }
    _P.set(-0.17, -0.31 - S.run * 0.1 - 0.3 * clamp(ka.t / CFG[ka.kind].unequip.dur, 0, 1), -0.42);
    handQuat(_Q, _B.set(0.03, 0.72, -0.69), _E.set(0.4, -0.85, 0.25), 1);
    vmReach(A.L, _P, _Q, _pole.set(-0.5, -0.8, 0.1), FING.fist); setFist(A.L);
    if (G.sunDir) { _qr.copy(G.camera.quaternion).invert(); VM.dir.position.copy(G.sunDir).applyQuaternion(_qr).multiplyScalar(5); }
    return true;
  }
  const outActive = (p) => !!(p && p.alive && !p.knocked && !p.veh && p.ka && p.ka.st === 'unequip');
  // 칼 뷰모델을 안 그리는 프레임: 잔상을 숨기고 빠르기 기준을 버림 (다른 무기 화면에 잔상이 남지 않게)
  function vmOff() { if (GH.list.length) { for (const gm of GH.list) gm.visible = false; } GH.lt = false; GH.n = 0; }

  // ---------- 카메라 (내 캐릭터) ----------
  //  휘두르기: 숙임(앞뒤 기울기)은 기본 식칼과 똑같이 — 내 근접 판정 방향이 카메라 앞 방향이라 숙임이 다르면 맞는 자리가 달라진다
  //  옆 기울임(앞 방향은 그대로)만 동작마다: 나비 베기 = 베는 쪽으로 · 카람빗 갈고리 = 당기는 쪽으로 · 올려 긋기 = 반대쪽으로
  //  맞히면 짧고 작은 기울임 흔들림(맞힌 방향으로) — 반환 [숙임, 기울임] 또는 null(기본 근접 무기 화면 효과)
  const _cam = [0, 0];
  function cam(p) {
    const ka = p.ka; if (!ka || !ka.held || !ka.st) return null;
    let cp = 0, cr = 0;
    if (ka.st === 'attack' && ka.sw) {
      const D = ITEMS.knife, ub = (ka.sw.t - D.wind * 0.6) / (D.strike + D.wind * 0.4 + D.rec * 0.4);
      if (ub > 0 && ub < 1) cp -= Math.sin(Math.PI * ub) * 0.014;   // 기본 식칼(찌르기) 숙임 그대로 (09_player.js updateCamera)
      const u = clamp(ka.sw.t / ka.sw.total, 0, 1), kk = Math.sin(Math.PI * clamp((u - 0.16) / 0.42, 0, 1));
      if (ka.kind === 'balisong') { if (ka.v === 0) cr += kk * 0.035; else cr -= kk * 0.012; }
      else if (ka.v === 0) cr += kk * 0.042; else cr -= kk * 0.022;
    }
    if (ka.kick > 0) cr += ka.kick * ka.kick * 0.016 * ka.kdir;
    _cam[0] = cp; _cam[1] = cr; return _cam;
  }
  function hit(c) { if (c && c.ka && c.ka.held) { c.ka.kick = 1; c.ka.kdir = c.ka.kind === 'karambit' ? (c.ka.v ? -1 : 1) : (c.ka.v ? 0.4 : 1); } }

  // ---------- 휘두르기 ----------
  // 전용 동작 칼은 이어서 휘두르면 두 동작을 번갈아 (보이는 것만 — 시간·피해는 같음)
  const alt = (c) => c && c.melee === 'knife' && !!kindOf(c);
  function swingSound(c, sw) { if (sw.id !== 'knife' || !Audio.knife) return false; const k = kindOf(c); if (!k) return false; Audio.knife(k === 'balisong' ? 'bSwing' : 'kSwing', c.pos, c.isPlayer); return true; }

  // ---------- 3인칭 ----------
  //  1인칭 줄 → 가슴 로컬(x 왼쪽, y 위, z 앞): 손은 기준 자리에서 움직인 만큼 0.8배(x 는 뒤집음) · 방향은 x 만 뒤집음
  //  허리 비틀기·숙임은 손이 옆·앞으로 간 만큼 · 왼손·오른팔꿈치는 기본 준비 자세(MEL_READY)
  //  꺼내기·살펴보기는 손을 가슴 앞으로 들어 올림(ka.sh) · 휘두르기의 높이·앞뒤·허리·팔꿈치는 기본 식칼 3인칭 찌르기 궤적(가슴 높이로 내지름)을 따르고
  //  옆으로 가는 것(베기·갈고리·올려 긋기의 방향)과 손 방향·손가락·부품은 이 칼의 줄 그대로
  const TBASE = [-0.2, -0.12, 0.25], _kt = new Array(19).fill(0);
  function tppRow(c, out) {
    const ka = c.ka, v = ka.row, b = TR[ka.kind].idle, k = 0.8, dx = v[0] - b[1], dy = v[1] - b[2], dz = v[2] - b[3];
    out[0] = TBASE[0] - dx * k; out[1] = TBASE[1] + dy * k; out[2] = TBASE[2] + dz * k;
    out[3] = -v[3]; out[4] = v[4]; out[5] = v[5]; out[6] = -v[6]; out[7] = v[7]; out[8] = v[8];
    out[9] = -0.12 + clamp(-dx * 1.5, -0.55, 0.55); out[10] = 0.05 + clamp(dz * 0.6, -0.1, 0.25); out[11] = -Math.max(0, dz) * 0.08; out[12] = Math.max(0, dz) * 0.15;
    out[13] = 0.15; out[14] = 0.05; out[15] = 0.25; out[16] = -0.5; out[17] = -0.35; out[18] = -0.05;
    if (ka.st === 'attack' && ka.sw) {
      kfSample(MEL_KF.stab, clamp(ka.sw.t / ka.sw.total, 0, 1), _kt);
      out[1] = _kt[1] + dy * 0.5; out[2] = _kt[2] + Math.min(0, dz) * 0.5;
      out[9] = _kt[9] + clamp(-dx * 1.2, -0.5, 0.5); out[10] = _kt[10]; out[11] = _kt[11]; out[12] = _kt[12];
      for (let i = 13; i < 19; i++) out[i] = _kt[i];
    }
    const sh = ka.sh || 0; out[0] += 0.07 * sh; out[1] += 0.17 * sh; out[2] += 0.08 * sh;
    return out;
  }
  const fingersOf = (c) => fing(c.ka.row, _F5);
  const fingers3 = (c, Ar, w) => setK(Ar, fing(c.ka.row, _F5), w);
  // 3인칭 손에 든 모델의 부품 (setHeld 뒤 매 프레임)
  function tppApply(c, r) {
    if (!on(c)) return;
    const o = r.armR.hold.children[0], rig = o && o.userData.rig; if (!rig || rig.kind !== c.ka.kind) return;
    parts(r.armR, o, c.ka.row, 1);
  }
  // 3인칭 휘두르기 자국: 실제 날 끝(부품 위치)에서 — 처리했으면 true
  const _t3a = new THREE.Vector3(), _t3b = new THREE.Vector3();
  function trail3(c, r, s2) {
    if (!on(c)) return false;
    const o = r.armR.hold.children[0], rig = o && o.userData.rig; if (!rig) return false;
    const D = ITEMS[s2.id];
    if (s2.t > D.wind * 0.85 && s2.t < D.wind + D.strike * 1.35) { tipBase(o, _t3a, _t3b); FX.trail('c' + c.id, G.scene, _t3a, _t3b, MeleeSkin.trail(s2.id, MeleeSkin.ofChar(c, s2.id))); }
    return true;
  }
  return { CFG, TR, kindOf, tick, on, inspect, vm, vmOut, vmOff, outActive, cam, hit, alt, swingSound, tppRow, fingersOf, fingers3, tppApply, trail3, sheath, parts, warmVM };
})();
