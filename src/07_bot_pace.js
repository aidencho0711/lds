// ============================================================
// 07_bot_pace.js — v23 교전 템포 감독: 봇끼리 너무 빨리 싸워 칼덴 75명이 착지 2분 만에 10명으로 줄던 문제
//  (경기의 2/3 이상이 10명 이하로 진행되어 중반·막판 자기장이 텅 비었다)
//  · 일반 경기만 — 랭크전·하드코어는 예전 템포 그대로(Pace.on = false: k 1 · 봇 표시 없음 · 작은 맵 착지 분산·파밍 우선도 없음).
//    RP·배치 점수·승급전 순위 조건이 예전 탈락 속도에 맞춰져 있어서 — 다시 맞추는 것은 따로 정한다
//  · 목표 생존 곡선(PACE.curve): 자기장 단계가 끝날 때 70% → 45% → 28% → 16% → 8% → 최종 3% — 단계 안은 그 단계 시간(대기 + 축소)으로 잇고,
//    단계 수가 다른 맵(대형 맵 7~8단계)은 단계 진행 비율로 같은 곡선에 맞춘다. 첫 단계는 수송기가 섬을 다 지나간 뒤부터 잇는다
//    (그 전엔 아무도 죽을 수 없으니 곡선을 미리 깎아 두면 착지 난투를 그만큼 봐주게 된다)
//  · 0.5초마다 실제 생존 비율과 비교해 템포 k (0.25 ~ 1.15): 목표보다 빨리 줄면 1 아래(봇끼리 싸움을 늦춤), 많이 남으면 1 위로 조금.
//    지금 비율과 최근 10초 빠르기로 본 10초 뒤 비율 중 낮은 쪽으로 정하고, 빨리 내리고 천천히 올린다. 첫 원이 닫히기 전에는 1 위로 올리지 않고,
//    마지막 두 단계(칼덴 반지름 34m → 14m → 7m)와 최종 원에서는 1 아래로 내리지 않는다 — 남은 사람끼리는 예전처럼 싸운다
//    (바닥 0.25 — 사람 대신 움직이는 봇 하나를 기준점으로 둔 칼덴 75명 솔로: 착지 뒤 10명까지 평균 2.1분 → 2.5분(폰 '낮음' 화질 기준 2.2 → 2.7분),
//     경기 길이 4.9 → 5.3분. 사람 둘레의 봇은 예전 그대로라 사람이 안 보는 곳의 싸움만 늦출 수 있어 효과가 그만큼 작다 · 듀오는 차이 없음.
//     사람이 경기에 없을 때(맵 밖에 세워 둠)는 2.2 → 4.5분)
//  · k 는 봇 대 봇에만 — 두 봇 모두 사람이 보고 있을 수 있는 곳 밖일 때만(c._pf, 매 프레임 봇을 움직이기 전에):
//    - 이 기기 화면(G.viewChar): 화질 설정의 봇 표시 거리(낮음 160 · 보통 230 · 높음 320 · 엑스트라 420m, 최소 150m) 안 — 화면에 그려지는 봇은 늘 예전 그대로.
//      배율 조준경으로 볼 때는 바라보는 쪽 ±40° 를 안개 거리까지 (봇은 표시 거리 밖엔 그리지 않지만 차량·폭발은 보인다)
//    - 사람 팀의 살아 있는 캐릭터(사람 · 사람의 팀원 봇 — 죽은 사람은 팀원을 관전한다): 150m 안 + 바라보는 쪽 ±40° 는 230m 까지
//      (다른 기기의 화질은 모른다 — 폰 기본 '낮음' 160m · PC 기본 '보통' 230m)
//    - 예전 그대로가 된 봇은 25m 더 멀어져야(시야는 10° 더 벗어나야) 다시 늦춘다 — 경계에서 싸웠다 멈췄다 하지 않게
//    사람의 팀원 봇과 사람을 상대하는 봇은 늘 예전 그대로.
//    적용하는 곳(07_bot.js): think 교전 분기(상대마다 8~12초 동안 (1−k) 확률로 모른 척하고 하던 일 — 파밍·이동·회복·차·부활 — 을 계속,
//    그 상대에게 맞으면 바로 풀고 맞서 싸움) · 조준 오차 ÷k · 사격 쉬는 시간이 k 배 느리게 줄어듦 · 시야 거리와 봇 총성을 듣는 반경 ×(0.6 + 0.4k)
//    · 작은 맵 착지 뒤 파밍 우선 · 자기장 밖에서는 싸우기보다 자기장으로
//  · 봇을 움직이는 기기에서만 (혼자 · 같이 하기·온라인 매칭은 방장 — 다른 기기에는 봇 뇌가 없다)
// ============================================================
const PACE = { curve: [1, 0.7, 0.45, 0.28, 0.16, 0.08, 0.03], kMin: 0.25, kMax: 1.15, R: 150, Rr: 230, hys: 25, cone: 40, every: 0.5, down: 5, up: 1, dead: 0.05, fall: 0.5, rise: 0.1, lastN: 2 };
const Pace = {
  on: true, k: 1, raw: 1, acc: 0, tgt: 1, act: 1, paced: 0, near: 0, e0: -1, A: new Float64Array(8 * 16), an: 0, hist: [],
  // 랭크전·하드코어는 예전 템포 그대로 (11_game.js pickDropTarget 도 이것으로 — startMatch 에서 reset 보다 먼저 불린다)
  live() { return !G.ranked && !G.hc; },
  reset() {
    this.on = this.live(); this.k = this.raw = this.tgt = this.act = 1; this.acc = 0; this.e0 = -1; this.paced = this.near = this.an = 0; this.hist.length = 0;
    for (const c of CHARS) c._pf = false;
  },
  // 자기장 진행도 → 목표 생존 비율 (곡선 점 사이를 단계 진행 비율로 잇는다)
  target() {
    const Z = Zone, P = Z.phases, C = PACE.curve; if (!Z.cur || !P || !P.length) return 1;
    const n = P.length, sc = Z.scale || 1; let u = n;
    if (Z.state !== 'final' && Z.phase < n) {
      const i = Z.phase, w = i ? P[i].wait * sc : Math.max(P[0].wait * sc, (MAPS[SETTINGS.map] || {}).wait0Min || 0), s = P[i].shrink * sc;
      let el = Z.state === 'wait' ? w - Z.timer : w + s - Z.timer, len = w + s;
      // 첫 단계: 수송기가 날고 있는 동안은 1, 다 지나간 뒤부터 이 단계 끝까지 잇는다
      //  (이어하기·방장 넘겨받기로 수송기가 다 지나간 뒤에 맡았으면 수송기 비행 시간 + 비행 경로 보기 4.5초로 한 번 정함)
      if (!i) { if (G.plane && G.plane.active) { this.e0 = el; return 1; } if (this.e0 < 0) this.e0 = G.plane ? Math.min(el, G.plane.t + 4.5) : 0; el -= this.e0; len -= this.e0; }
      u = i + clamp(el / Math.max(1, len), 0, 1);
    }
    u *= (C.length - 1) / n; const j = Math.min(C.length - 2, Math.floor(u));
    return lerp(C[j], C[j + 1], u - j);
  },
  update(dt) {
    if (!this.on || (G.net && !Net.isHost())) return;
    this.mark();
    if ((this.acc += dt) < PACE.every) return;
    this.acc = 0;
    let n = 0; for (const c of CHARS) if (c.alive) n++;
    this.act = n / Math.max(1, G.total); this.tgt = this.target();
    // 비율 r (1 아래 = 목표보다 빨리 줄어듦): 지금, 또는 최근 10초 빠르기로 10초 뒤 — 착지하자마자 몰려 죽는 것에 늦지 않게
    const h = this.hist; h.push(this.act, this.tgt); if (h.length > 40) h.splice(0, 2);
    const r = Math.min(this.act / Math.max(0.005, this.tgt), (2 * this.act - h[0]) / Math.max(0.005, 2 * this.tgt - h[1]));
    let kr = r < 1 ? 1 - (1 - r) * PACE.down : 1 + Math.max(0, r - 1 - PACE.dead) * PACE.up;
    // 마지막 원들은 늦추지 않는다 — 천천히 올리지 않고 바로 (작은 원 안에서 2m 앞의 적을 모른 척하다 둘 다 자기장에 죽던 것)
    const late = Zone.state === 'final' || Zone.phase >= (Zone.phases || []).length - PACE.lastN;
    if (Zone.phase < 1) kr = Math.min(kr, 1); else if (late) kr = Math.max(kr, 1);
    this.raw = clamp(kr, PACE.kMin, PACE.kMax); this.k += (this.raw - this.k) * (this.raw < this.k ? PACE.fall : PACE.rise);
    if (late) this.k = Math.max(this.k, 1);
  },
  // 기준점 하나 = 숫자 8개 [x, z, 반지름², (반지름 + 25)², 바라보는 방향 x, z, 시야 거리², (시야 거리 + 25)²] — 시야 거리가 반지름 이하면 원만.
  //  매 프레임 새 배열을 만들지 않게 한 Float64Array 에 (모자라면 두 배로)
  ap(n, x, z, r, fx, fz, rc) {
    if (n + 8 > this.A.length) { const B = new Float64Array(this.A.length * 2); B.set(this.A); this.A = B; }
    const A = this.A, h = PACE.hys, cn = rc > r;
    A[n] = x; A[n + 1] = z; A[n + 2] = r * r; A[n + 3] = (r + h) * (r + h); A[n + 4] = fx; A[n + 5] = fz; A[n + 6] = cn ? rc * rc : 0; A[n + 7] = cn ? (rc + h) * (rc + h) : 0;
    return n + 8;
  },
  // 봇마다 k 를 쓸지(_pf) — 매 프레임 봇을 움직이기 전에 (봇 75 × 기준점 몇 개, 거리 비교와 내적 하나씩이라 가볍다 · 관전 대상이 바뀌거나 차로 다가와도 바로 예전 그대로)
  mark() {
    const T = G.teams, v = G.viewChar(), R = PACE.R; let n = 0;
    // 이 기기 화면: 봇 표시 거리 안 전부 · 배율 조준경이면 카메라가 보는 쪽 ±40° 를 안개 거리까지
    if (v) {
      const Q = QUALITY[SETTINGS.quality] || QUALITY.medium, q = G.camera.quaternion, fx = -2 * (q.x * q.z + q.w * q.y), fz = 2 * (q.x * q.x + q.y * q.y) - 1, fl = Math.hypot(fx, fz) || 1;
      n = this.ap(n, v.pos.x, v.pos.z, Math.max(R, Q.botDraw), fx / fl, fz / fl, Cam.zoom > 1.5 ? Math.max(Q.far * (G.fogK ? G.fogK[1] : 1), BOT_SCOPE + 25) : 0);   // 배율 조준: 조준경으로 캐릭터를 그리는 거리(BOT_SCOPE 320m — 11_game.js charView)까지 + 25m
    }
    // 사람 팀의 살아 있는 캐릭터 (다른 기기 사람 · 사람의 팀원 봇): 150m 안 + 바라보는 쪽(차에 타면 차의 방향 — 관전 카메라와 같게) ±40° 230m 까지
    for (const c of CHARS) if (c.alive && c !== v && (c.human || (T && T[c.team] && T[c.team].human))) { const y = c.veh ? c.veh.yaw : c.yaw; n = this.ap(n, c.pos.x, c.pos.z, R, Math.sin(y), Math.cos(y), PACE.Rr); }
    this.an = n;
    const A = this.A, c1 = Math.cos(PACE.cone * DEG), c2 = Math.cos((PACE.cone + 10) * DEG), k1 = c1 * c1, k2 = c2 * c2;
    let pc = 0, nr = 0;
    for (const c of CHARS) {
      if (!c.brain || !c.alive || c.human || (T && T[c.team] && T[c.team].human)) { c._pf = false; continue; }
      // 지금 예전 그대로인 봇(h = 1)은 반지름·시야 거리 + 25m, 시야각 + 10° 밖이어야 다시 늦춘다
      const h = c._pf ? 0 : 1, kc = h ? k2 : k1; let f = true;
      for (let i = 0; i < n; i += 8) {
        const dx = c.pos.x - A[i], dz = c.pos.z - A[i + 1], d2 = dx * dx + dz * dz;
        if (d2 < A[i + 2 + h]) { f = false; break; }
        if (d2 < A[i + 6 + h]) { const dp = dx * A[i + 4] + dz * A[i + 5]; if (dp > 0 && dp * dp > kc * d2) { f = false; break; } }
      }
      c._pf = f; if (f) pc++; else nr++;
    }
    this.paced = pc; this.near = nr;
  },
  // 봇 a 가 봇 o 를 상대할 때의 k (둘 중 하나라도 사람 가까이 있거나 사람이면 1 — 예전 그대로)
  pk(a, o) { return a._pf && o._pf ? this.k : 1; },
  // 시야 거리·총성을 듣는 반경 배율
  vk(a, o) { return a._pf && o._pf ? 0.6 + 0.4 * this.k : 1; },
  // 이 상대와의 교전을 미룰지: 상대마다 8~12초 동안 같은 결정(aware 기록 r.pT·r.pS) — 판단(0.1~0.34초)마다 다시 굴리면 1초 안에 거의 확실히 교전하게 된다.
  //  상대가 나에 대해 내린 결정이 아직 유효하면 그것을 따른다 (둘이 같이 모른 척하거나 같이 싸움 — 한쪽만 모른 척하면 다른 쪽이 쏘는 순간 풀려 결국 싸운다).
  //  그 상대에게 맞으면 onDamaged 가 바로 '싸움'으로 8~12초 (모른 척하던 중이거나 아직 정하지 않았을 때 — 맞고도 모른 척하지 않게)
  skip(b, o, r) {
    if (this.k >= 1 || !b.c._pf || !o._pf) return false;
    if (G.time >= (r.pT || 0)) {
      if (!r.visible) return false;
      const q = o.brain && o.brain.aware.get(b.c);
      if (q && q.pT > G.time) { r.pT = q.pT; r.pS = q.pS; } else { r.pT = G.time + rnd(8, 12); r.pS = Math.random() >= this.k; }
    }
    return !!r.pS;
  },
  // 모른 척하기로 한 상대인지 (새로 정하지 않고 보기만 — 07_bot.js think 의 가장 가까운 적 거리: 회복·부활을 막지 않게)
  ign(a, o, r) { return this.k < 1 && !!a._pf && !!o._pf && !!r.pS && r.pT > G.time; },
  // 지금 상태 (테스트·개발자 도구): 켜짐 · k · 목표/실제 생존 비율 · 자기장 단계 · k 를 쓰는 봇/쓰지 않는 봇 수
  info() { return { on: this.on, k: +this.k.toFixed(3), raw: +this.raw.toFixed(3), target: +this.tgt.toFixed(3), actual: +this.act.toFixed(3), phase: Zone.phase + 1, zone: Zone.state, paced: this.paced, near: this.near, host: !G.net || Net.isHost() }; },
};
