// ============================================================
// 02_world_arena.js — v22 데스매치·대결 아레나 3곳 추가: 녹슨 공장 · 모래 사원 · 골목 마을
//  모두 컨테이너 야드(02_world.js buildArena)와 같은 72×72m(담 안 ±36m) · 같은 틀:
//   남쪽(z+) = 0팀(블루) 출발 구역, 북쪽(z-) = 1팀(레드). 반쪽을 짓고 원점 기준 180° 돌려 한 번 더 지어 어느 팀도 유리하지 않게
//   출발 구역 앞 가림벽(틈 3곳 + 틈 뒤 차단벽) · 출발 지점 팀마다 16곳 · 미니맵 사각형(w.mapRects) · 지역 이름(w.pois)
//  봇 길찾기(03_nav.js)는 1m 격자 + 지면 높이라 2층·제단 위는 사람(과 물리로 올라간 봇)만 — 바닥 길은 세 갈래로 이어지게 둔다
//  generateWorld 가 MAPS[id].layout 이 있는 아레나에서 K(지형 도구)를 넘겨 부른다
// ============================================================
function buildArenaLayout(K) {
  const { w, M, frame, addBox, addRamp, PAL, DOOR, WIN, buildHouse, buildCar, getBatch } = K;
  const G0 = heightAt(0, 0), A = w.arena = { half: 36, spawns: [[], []], G0 };
  w.mapRects = [];
  const P = HTX.P, T = (pat, o) => Object.assign({ mat: 'tex', pat: P[pat] }, o || {});
  const halves = [frame(0, 0, 0, G0), frame(0, 0, 2, G0)];
  const rect = (F, x0, z0, x1, z1) => { const a = F.pt(x0, z0), b = F.pt(x1, z1); w.mapRects.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]); };
  const poi = (F, name, x, z, r) => { const p = F.pt(x, z); w.pois.push({ type: 'arena', name, x: p[0], z: p[1], r: r || 6, h: G0 }); };
  // 둥근 물체(탱크·기둥·통): 보이는 원기둥 + 충돌은 상자 3개(정사각 + 십자)로 원에 가깝게
  const cyl = (F, x, z, r, y0, y1, col, o) => {
    F.geo(new THREE.CylinderGeometry(r, r, y1 - y0, Math.max(10, Math.round(r * 9))), x, (y0 + y1) / 2, z, col);
    if (o && o.noCollide) return;
    for (const [a, b] of [[0.7, 0.7], [0.93, 0.4], [0.4, 0.93]]) F.box(x - r * a, y0 - 0.3, z - r * b, x + r * a, y1, z + r * b, col, { invisible: true });
  };
  // 눕힌 원기둥(관·쓰러진 기둥): ax 'x' 또는 'z' 방향, 충돌은 상자 하나
  const log = (F, ax, a0, a1, c, r, y, col, noCol) => {
    const g = new THREE.CylinderGeometry(r, r, a1 - a0, 14); if (ax === 'x') g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
    const m = (a0 + a1) / 2;
    if (ax === 'x') { F.geo(g, m, y, c, col); if (!noCol) F.box(a0, -0.3, c - r, a1, y + r * 0.95, c + r, col, { invisible: true }); }
    else { F.geo(g, c, y, m, col); if (!noCol) F.box(c - r, -0.3, a0, c + r, y + r * 0.95, a1, col, { invisible: true }); }
  };
  // 계단 경사로: 로컬 ax 축 구간 [l0,l1] 을 따라 h0→h1 로 오름(dirL=+1 이면 + 쪽이 높음), 옆 폭은 [m0,m1]
  //  보이는 계단 + 아래 받침(옆에서 못 지나가게) — 컨테이너 야드 전망대 경사로와 같은 방식 (반쪽 틀은 회전 0·2 뿐)
  const stairs = (F, ax, l0, l1, m0, m1, h0, h1, dirL, col) => {
    const p0 = ax === 'x' ? F.pt(l0, m0) : F.pt(m0, l0), p1 = ax === 'x' ? F.pt(l1, m1) : F.pt(m1, l1), dirW = F.rot === 2 ? -dirL : dirL;
    addRamp(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), G0 + h0, G0 + h1, ax, dirW);
    const dh = h1 - h0, n = Math.max(5, Math.round(dh / 0.28)), L = l1 - l0;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, y = h0 + dh * (dirL > 0 ? t1 : 1 - t0), yb = h0 + dh * (dirL > 0 ? t0 : 1 - t1) - 0.08, a = l0 + L * t0, b = l0 + L * t1;
      if (ax === 'x') { F.box(a, h0 - 0.05, m0, b, y, m1, col, { noCollide: true }); if (yb > h0 + 0.3) F.box(a, h0 - 0.5, m0, b, yb, m1, col, { invisible: true }); }
      else { F.box(m0, h0 - 0.05, a, m1, y, b, col, { noCollide: true }); if (yb > h0 + 0.3) F.box(m0, h0 - 0.5, a, m1, yb, b, col, { invisible: true }); }
    }
  };
  const crate = (F, x, z, n, c1 = 0x7a5c35, c2 = 0x8a6a3f) => { for (let k = 0; k < n; k++) F.box(x - 0.65, -0.3 + (k ? 0.3 : 0) + k * 1.3, z - 0.65, x + 0.65, 1.3 * (k + 1), z + 0.65, k ? c2 : c1); rect(F, x - 0.65, z - 0.65, x + 0.65, z + 0.65); };
  // 반쪽 틀 기준 집: 로컬 (x,z) 에, 현관이 로컬 face('e' 동 · 'w' 서 · 'n' 가운데 쪽) 를 보게
  const house = (F, x, z, wd, dp, floors, face, o) => {
    const rr = { n: 0, e: 3, s: 2, w: 1 }[face], p = F.pt(x, z), HF = frame(p[0], p[1], (rr + F.rot) % 4, G0);
    buildHouse(HF, wd, dp, floors, o.pal, o);
    const ew = face === 'e' || face === 'w', hx = (ew ? dp : wd) / 2, hz = (ew ? wd : dp) / 2;
    rect(F, x - hx, z - hz, x + hx, z + hz);
  };
  // 공통: 바깥 담(높이 H) · 출발 구역 바닥 · 출발 지점 16곳 · 가림벽(틈 3곳)과 틈 뒤 차단벽
  const shell = (F, side, S) => {
    const H = S.wallH || 5, wo = S.wallO;
    F.box(-37.2, -1, 36, 37.2, H, 37.2, S.wall, wo); F.box(-37.2, H, 36, 37.2, H + 0.3, 37.2, S.trim);
    F.box(-37.2, -1, 0, -36, H, 36, S.wall, wo); F.box(-37.2, H, 0, -36, H + 0.3, 36, S.trim);
    F.box(36, -1, 0, 37.2, H, 36, S.wall, wo); F.box(36, H, 0, 37.2, H + 0.3, 36, S.trim);
    F.box(-36, -0.2, 25.4, 36, 0.03, 36, S.team[side], { noCollide: true });
    for (const [a, b] of [[-36, -22], [-16, -4], [4, 16], [22, 36]]) { F.box(a, -0.5, 24.75, b, S.barH, 25.25, S.bar, S.barO); F.box(a, S.barH, 24.7, b, S.barH + 0.15, 25.3, S.trim); rect(F, a, 24.75, b, 25.25); }
    for (const [a, b] of [[-2.8, 2.8], [-20.8, -17.2], [17.2, 20.8]]) { F.box(a, -0.5, 28.2, b, S.blockH || S.barH, 28.7, S.block || S.bar, S.blockO || S.barO); rect(F, a, 28.2, b, 28.7); }
    for (const z of [30.5, 33.5]) for (const x of [-31, -26, -14, -9, 9, 14, 26, 31]) { const q = F.pt(x, z); A.spawns[side].push({ x: q[0], z: q[1], yaw: side ? 0 : Math.PI }); }
    rect(F, -37.2, 36, 37.2, 37.2); rect(F, -37.2, 0, -36, 37.2); rect(F, 36, 0, 37.2, 37.2);
    poi(F, side ? '레드 출발' : '블루 출발', 0, 31, 6);
  };

  // ---------- 녹슨 공장: 가운데 지붕 작업장(프레스·컨베이어) · 서쪽 저장 탱크 · 동쪽 2층 사무동 · 지게차·팔레트 ----------
  function factory(F, side) {
    const STEEL = 0x5b6168, YEL = 0xc9a227, CONC = 0x8d8a83, PIPE = 0x6f7f86, TANK = 0xb9b4a8, DARK = 0x3f4448;
    shell(F, side, { wall: 0x857a6e, wallO: T('metal'), trim: 0x4b4640, bar: 0x6d747a, barO: T('metal'), barH: 2.6, block: 0x7d6f63, blockO: T('metal'), team: [0x6f7a84, 0x86716c] });
    // 가운데 작업장: 지붕(높이 6.2m) · 기둥 · 지붕 보 · 크레인 레일
    F.box(-13.4, 6.2, 0, 13.4, 6.5, 6.8, 0x50565c, T('metal'));
    for (const x of [-13, -6.5, 6.5, 13]) F.box(x - 0.25, -0.3, 6.1, x + 0.25, 6.2, 6.6, STEEL);
    F.box(-13.4, 5.75, 3.25, 13.4, 6.2, 3.55, STEEL, { noCollide: true }); F.box(-13.4, 5.3, 0.4, 13.4, 5.55, 0.7, YEL, { noCollide: true });
    F.box(-1.2, 4.6, 0.25, 1.2, 5.3, 0.85, YEL, { noCollide: true }); F.box(-0.08, 2.9, 0.47, 0.08, 4.6, 0.63, 0x2b2b2b, { noCollide: true });   // 크레인 갈고리
    // 프레스 기계(완전 엄폐) · 컨베이어(낮은 엄폐, 넘기 가능) · 작업대
    F.box(-9.7, -0.3, 1.2, -5.3, 0.25, 4.8, YEL, { noCollide: true });
    F.box(-9.5, -0.3, 1.4, -5.5, 2.7, 4.6, 0x6b7076, T('metal')); F.box(-8.2, 2.7, 2.3, -6.8, 4.4, 3.7, 0x8a8f94, { noCollide: true }); F.box(-9.8, 4.4, 1.9, -5.2, 4.8, 4.1, 0x6b7076, { noCollide: true });
    F.box(-1.5, -0.3, 2.5, 8.5, 0.95, 3.5, DARK); for (let x = -1.2; x < 8.3; x += 0.7) F.box(x, 0.95, 2.55, x + 0.28, 1.04, 3.45, 0x8a8f94, { noCollide: true });
    F.box(1.6, 1.0, 2.6, 2.7, 1.8, 3.4, 0x7a5c35); F.box(5.1, 1.0, 2.6, 5.9, 1.5, 3.4, 0x8a6a3f);
    F.box(9.8, -0.3, 0.6, 12.2, 0.92, 1.8, 0x5a4a3a); F.box(10.2, 0.92, 0.8, 10.8, 1.25, 1.3, 0xb84a2a, { noCollide: true });
    rect(F, -9.5, 1.4, -5.5, 4.6); rect(F, -1.5, 2.5, 8.5, 3.5); rect(F, 9.8, 0.6, 12.2, 1.8);
    for (const x of [-13, -6.5, 6.5, 13]) rect(F, x - 0.25, 6.1, x + 0.25, 6.6);
    // 서쪽: 저장 탱크 두 개(사다리·받침) + 사이 배관 · 바닥 배관(낮은 엄폐) · 드럼통
    cyl(F, -28.5, 6.5, 3.3, -0.3, 7.4, TANK); F.geo(new THREE.CylinderGeometry(3.45, 3.45, 0.35, 28), -28.5, 7.45, 6.5, 0x8d8a83);
    F.box(-25.25, 0, 6.2, -25.05, 7.4, 6.8, STEEL, { noCollide: true });
    cyl(F, -20.5, 16, 2.4, -0.3, 5.4, 0xa9a397); F.geo(new THREE.CylinderGeometry(2.55, 2.55, 0.3, 24), -20.5, 5.45, 16, 0x8d8a83);
    log(F, 'z', 9.6, 13.6, -24.6, 0.32, 4.6, PIPE, true); F.box(-24.95, 0, 11.4, -24.25, 4.3, 11.8, STEEL, { noCollide: true });
    log(F, 'x', -34.2, -25.5, 21.5, 0.55, 0.58, PIPE); for (const x of [-33, -29.5, -26.5]) F.box(x - 0.2, -0.3, 20.8, x + 0.2, 0.3, 22.2, STEEL, { noCollide: true });
    for (const [x, z] of [[-15.4, 19.2], [-14.6, 19.8], [-15.5, 20.4], [-30.5, 15.5]]) cyl(F, x, z, 0.33, -0.3, 0.95, z > 20 ? 0x2f5a8a : 0x8a3a2a);
    F.box(-16.5, -0.3, 7.6, -14.06, 2.6, 13.7, PAL.container[side ? 4 : 1]);
    rect(F, -31.8, 3.2, -25.2, 9.8); rect(F, -22.9, 13.6, -18.1, 18.4); rect(F, -34.2, 21, -25.5, 22); rect(F, -16.5, 7.6, -14.06, 13.7);
    // 동쪽: 2층 사무동 (현관은 가운데 쪽, 2층 창으로 가운데를 내려다봄)
    house(F, 25.5, 12.5, 12, 8, 2, 'w', { pal: PAL.city[0], style: 'modern', flatRoof: true, tier: 'mid' });
    // 가운데 길: 지게차 · 팔레트 더미 · 콘크리트 방호벽(넘기 가능)
    F.box(11.8, -0.3, 16.6, 14.4, 1.45, 18.4, YEL); F.box(12.1, 1.45, 17.2, 13.5, 2.3, 18.2, 0x2d3438, { noCollide: true }); F.box(11.2, -0.3, 16.9, 11.8, 2.6, 17.1, DARK); F.box(11.2, -0.3, 17.9, 11.8, 2.6, 18.1, DARK); F.box(10.2, -0.3, 16.8, 11.2, 0.18, 18.2, 0x7d7f80);
    rect(F, 10.2, 16.6, 14.4, 18.4);
    crate(F, -11, 14, 2); crate(F, -9.7, 14.3, 1); crate(F, 3, 12.5, 1); crate(F, 4.3, 12.2, 2); crate(F, 9.5, 9, 1); crate(F, -3, 19.5, 2); crate(F, 16.5, 3, 1); crate(F, -4.2, 9.5, 1);
    F.box(-6.5, -0.3, 17, -1.5, 1.0, 17.6, CONC, T('concrete')); F.box(5.5, -0.3, 21.2, 10.5, 1.0, 21.8, CONC, T('concrete')); F.box(-13.5, -0.3, 21.4, -9.5, 1.0, 22, CONC, T('concrete'));
    rect(F, -6.5, 17, -1.5, 17.6); rect(F, 5.5, 21.2, 10.5, 21.8); rect(F, -13.5, 21.4, -9.5, 22);
    poi(F, '저장 탱크', -26, 10, 6); poi(F, '사무동', 25.5, 12.5, 6);
    if (!side) poi(F, '작업장', 0, 0, 9);
  }

  // ---------- 모래 사원: 가운데 2단 제단(계단 4곳 · 꼭대기 오벨리스크) · 서쪽 폐허 집 · 동쪽 기둥 회랑 · 야자나무 ----------
  function ruins(F, side) {
    const SA = 0xc8ad7f, SB = 0xb89c6e, SC = 0xd4bc90, STEP = 0xbfa475, sO = T('stone');
    shell(F, side, { wall: 0xc2a77c, wallO: sO, trim: 0x9e8560, bar: SA, barO: sO, barH: 2.8, block: SB, blockO: sO, blockH: 2.2, team: [0x9aa3a6, 0xab9384] });
    // 가림벽 틈 위 아치(머리 위 2.3m 부터)
    for (const [a, b] of [[-22, -16], [-4, 4], [16, 22]]) F.box(a, 2.35, 24.75, b, 2.8, 25.25, SA, sO);
    // 1) 제단: 1단(1.5m, 16×16m) · 2단(3m, 8×8m) · 계단 — 1단: 동쪽(x방향)·남서쪽(z방향) · 2단: 동쪽 (반대편은 180° 돌아 서쪽·북동쪽)
    F.box(-8, -0.3, 0, 8, 1.5, 8, SB, sO); F.box(-8.15, 1.5, 7.85, 8.15, 1.62, 8.15, SC, { noCollide: true });
    F.box(-4, 1.5, 0, 4, 3.0, 4, SA, sO); F.box(-4.12, 3.0, 3.88, 4.12, 3.1, 4.12, SC, { noCollide: true });
    stairs(F, 'x', 8, 13.4, 1.2, 4.6, 0, 1.5, -1, STEP);
    stairs(F, 'z', 8, 12.2, -6.6, -3.4, 0, 1.5, -1, STEP);
    stairs(F, 'x', 4, 6.9, 0.6, 3.2, 1.5, 3.0, -1, STEP);
    F.box(-0.7, 3.0, 0, 0.7, 6.4, 0.7, SA, sO);   // 오벨리스크 (반쪽씩 → 1.4m 정사각)
    if (!side) F.geo(new THREE.ConeGeometry(1.0, 1.1, 4).rotateY(Math.PI / 4), 0, 6.95, 0, SC);
    for (const [x, h] of [[-7.2, 2.3], [7.2, 1.0]]) F.box(x - 0.42, 1.5, 6.78, x + 0.42, 1.5 + h, 7.62, SC, sO);   // 1단 모서리 기둥(하나는 부서짐)
    rect(F, -8, 0, 8, 8); rect(F, 8, 1.2, 13.4, 4.6); rect(F, -6.6, 8, -3.4, 12.2);
    // 2) 서쪽 폐허 집 (지붕 없음, 두꺼운 돌벽: 창 구멍·무너진 남쪽 벽·동쪽 입구)
    F.wallX(5, -32, -22, -0.3, 3.3, 0.6, [{ a: -28.6, b: -26.8, lo: 1.3, hi: 2.4 }], SA, sO);
    F.wallZ(-22, 5.3, 14.7, -0.3, 2.9, 0.6, [{ a: 8.4, b: 10.6, lo: 0, hi: 2.9 }], SA, sO);
    F.wallZ(-32, 5.3, 14.7, -0.3, 3.1, 0.6, [{ a: 9.2, b: 10.8, lo: 1.3, hi: 2.4 }], SA, sO);
    F.wallX(15, -32, -22, -0.3, 1.25, 0.6, [{ a: -26.4, b: -24.2, lo: 0, hi: 1.25 }], SB, sO);
    F.box(-32.3, 3.3, 4.7, -28.4, 3.9, 5.3, SA, sO); F.box(-22.3, 2.9, 5.3, -21.7, 3.6, 7.6, SA, sO);   // 높이가 들쭉날쭉한 벽 윗단
    F.box(-30.8, -0.3, 11.6, -28.6, 0.75, 13.6, SB); F.box(-30.3, 0.75, 12.1, -29.2, 1.25, 13.0, SB, { noCollide: true });   // 무너진 돌 더미
    rect(F, -32.3, 4.7, -21.7, 5.3); rect(F, -32.3, 5.3, -31.7, 14.7); rect(F, -22.3, 5.3, -21.7, 14.7); rect(F, -32.3, 14.7, -21.7, 15.3);
    // 3) 동쪽 기둥 회랑: 두 줄 기둥(일부 부서짐) · 위 보 · 쓰러진 기둥(낮은 엄폐)
    const col = (x, z, h) => { F.box(x - 0.45, -0.3, z - 0.45, x + 0.45, h, z + 0.45, SC, sO); F.box(x - 0.6, -0.3, z - 0.6, x + 0.6, 0.3, z + 0.6, SB, { noCollide: true }); rect(F, x - 0.45, z - 0.45, x + 0.45, z + 0.45); };
    const H1 = [4.4, 4.4, 1.6, 4.4], H2 = [4.4, 2.4, 4.4, 4.4];
    [5, 10, 15, 20].forEach((z, i) => { col(19, z, H1[i]); col(27, z, H2[i]); });
    F.box(18.45, 4.4, 4.5, 19.55, 4.95, 10.5, SA, sO); F.box(26.45, 4.4, 14.5, 27.55, 4.95, 20.5, SA, sO);
    log(F, 'x', 20.4, 25.6, 12.5, 0.46, 0.46, SC);
    // 4) 가운데 길: 낮은 무너진 벽(넘기 가능) · 돌 더미 · 야자나무
    F.box(-14, -0.3, 11.2, -8, 1.1, 11.9, SB, sO); F.box(5, -0.3, 17.2, 11, 1.1, 17.9, SB, sO); F.box(-3, -0.3, 20.6, 2, 0.9, 21.3, SB, sO); F.box(-27, -0.3, 19.4, -21, 1.15, 20.1, SB, sO);
    rect(F, -14, 11.2, -8, 11.9); rect(F, 5, 17.2, 11, 17.9); rect(F, -3, 20.6, 2, 21.3); rect(F, -27, 19.4, -21, 20.1);
    for (const [x, z] of [[-15, 20.5], [12.5, 6], [31.5, 23]]) {
      F.geo(new THREE.CylinderGeometry(0.16, 0.26, 6.4, 7), x, 3.2, z, 0x8a6a46); F.box(x - 0.24, -0.3, z - 0.24, x + 0.24, 6.2, z + 0.24, 0x8a6a46, { invisible: true });
      for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, g = new THREE.BoxGeometry(0.5, 0.06, 2.8); g.translate(0, 0, 1.25); g.rotateX(0.38); g.rotateY(a); F.geo(g, x, 6.35, z, k % 2 ? 0x4f7a3a : 0x5f8a3f); }
    }
    for (const [x, z, r] of [[-33, 27.5, 1.6], [33, 2, 1.3], [-6, 14.5, 1.1]]) F.geo(new THREE.SphereGeometry(r, 10, 6, 0, TAU, 0, Math.PI / 2).scale(1.6, 0.35, 1.2), x, -0.05, z, 0xcdb68a);   // 모래 둔덕(보이기만)
    poi(F, '폐허 집', -27, 10, 6); poi(F, '기둥 회랑', 23, 12.5, 6);
    if (!side) poi(F, '제단', 0, 0, 9);
  }

  // ---------- 골목 마을: 가운데 분수 광장 · 양쪽 2층 집(발코니로 광장을 내려다봄) · 1층 가게 · 시장 가판대 · 골목 ----------
  function town(F, side) {
    const STONE = 0xa9a39a, HEDGE = 0x3f6b35, WOOD = 0x6b4f37, AWN = [0xb8352c, 0x2f5a3a, 0x2d4a7a];
    shell(F, side, { wall: 0x9b6151, wallO: T('brick'), trim: 0xd9d0c0, bar: 0xd8cdb8, barO: T('stucco'), barH: 2.4, block: HEDGE, blockH: 2.0, team: [0x7b8590, 0x92807a] });
    // 분수: 사각 수반(벽 0.75m, 넘기 가능) · 물 · 가운데 기둥과 위 그릇
    F.box(-4, -0.3, 3.55, 4, 0.75, 4, STONE, T('stone')); F.box(3.55, -0.3, 0, 4, 0.75, 3.55, STONE, T('stone')); F.box(-4, -0.3, 0, -3.55, 0.75, 3.55, STONE, T('stone'));
    F.box(-3.55, -0.3, 0, 3.55, 0.32, 3.55, 0x4f8fb0, { noCollide: true });
    F.box(-0.6, -0.3, 0, 0.6, 2.2, 0.6, STONE, T('stone')); F.box(-1.4, 2.0, 0, 1.4, 2.3, 1.4, STONE, { noCollide: true });
    rect(F, -4, 0, 4, 4);
    // 집: 서쪽 2층(발코니 · 현관이 광장 쪽) + 서쪽 1층 가게, 동쪽 2층(현관이 가운데 쪽) — 반대편은 180° 돌아 마주 보는 골목이 된다
    const pal = PAL.city;
    house(F, -27, 8.75, 10.5, 8, 2, 'e', { pal: pal[1], style: 'town', balcony: true, tier: 'mid' });
    house(F, -27, 19.5, 6, 7, 1, 'e', { pal: pal[3], style: 'town', flatRoof: true, tier: 'low' });
    house(F, 27.5, 4.5, 9, 8, 2, 'w', { pal: pal[0], style: 'town', tier: 'mid' });
    // 시장 가판대 (계산대 0.95m + 기둥 + 차양)
    const stall = (x0, z0, x1, z1, c) => {
      F.box(x0, -0.3, z0, x1, 0.95, z1, WOOD); rect(F, x0, z0, x1, z1);
      for (const x of [x0 + 0.1, x1 - 0.25]) F.box(x, 0.95, z0 + 0.05, x + 0.15, 2.45, z0 + 0.2, WOOD, { noCollide: true });
      F.box(x0 - 0.3, 2.45, z0 - 0.6, x1 + 0.3, 2.55, z1 + 0.5, c, { noCollide: true });
      for (let x = x0 + 0.3; x < x1 - 0.3; x += 0.7) F.box(x, 0.95, z0 + 0.25, x + 0.45, 1.2, z1 - 0.25, [0xc8402a, 0xe0b040, 0x6a9a3a][((Math.round(x * 3) % 3) + 3) % 3], { noCollide: true });
    };
    stall(16.5, 13, 20.5, 14.2, AWN[side ? 1 : 0]); stall(23.5, 17.6, 27.5, 18.8, AWN[2]); stall(-12, 22, -8.5, 23.2, AWN[side ? 0 : 1]);
    // 화단(1m) · 산울타리(1.1m) · 벤치 · 가로등 · 주차한 차
    F.box(-11.2, -0.3, 8.4, -8.8, 0.9, 9.6, STONE, T('stone')); F.box(-11, 0.9, 8.6, -9, 1.35, 9.4, HEDGE, { noCollide: true });
    F.box(8.8, -0.3, 4.4, 11.2, 0.9, 5.6, STONE, T('stone')); F.box(9, 0.9, 4.6, 11, 1.35, 5.4, HEDGE, { noCollide: true });
    F.box(-16, -0.3, 16.8, -10.5, 1.1, 17.6, HEDGE); F.box(3.5, -0.3, 20.6, 9, 1.1, 21.4, HEDGE); F.box(12.5, -0.3, 8.6, 13.3, 1.1, 11.4, HEDGE);
    rect(F, -11.2, 8.4, -8.8, 9.6); rect(F, 8.8, 4.4, 11.2, 5.6); rect(F, -16, 16.8, -10.5, 17.6); rect(F, 3.5, 20.6, 9, 21.4); rect(F, 12.5, 8.6, 13.3, 11.4);
    for (const [x, z] of [[-6, 6.5], [6, 13]]) { F.box(x - 1, -0.3, z - 0.25, x + 1, 0.45, z + 0.25, WOOD); F.box(x - 1, 0.45, z + 0.15, x + 1, 0.85, z + 0.25, WOOD, { noCollide: true }); }
    for (const [x, z] of [[-6.5, 0.5], [6.5, 9.5], [-18, 12], [18, 21.5]]) { F.box(x - 0.09, -0.3, z - 0.09, x + 0.09, 3.6, z + 0.09, 0x2b2d30); F.box(x - 0.28, 3.6, z - 0.28, x + 0.28, 3.95, z + 0.28, 0xf1e2b0, { noCollide: true }); }
    buildCar(F, 4.5, 16.5, side ? 0x2a4a7b : 0x7b2a2a, Math.PI / 2); rect(F, 2.35, 15.6, 6.65, 17.4);
    buildCar(F, -19.5, 2.5, 0x8a8a8a, 0); rect(F, -20.4, 0.35, -18.6, 4.65);
    crate(F, 20.5, 9.5, 1, 0x7a5c35); crate(F, -15.5, 4.5, 2);
    // 신문 가판대(완전 엄폐) · 길가에 세운 차 한 대 더 (광장이 너무 트이지 않게)
    F.box(-10.7, -0.3, 13.3, -8.3, 2.5, 15.7, 0x2f5a3a); F.box(-11, 2.5, 13, -8, 2.75, 16, 0xd8cdb8, { noCollide: true }); F.box(-10.6, 1.0, 15.7, -8.4, 1.9, 15.8, 0xf1e2b0, { noCollide: true });
    rect(F, -10.7, 13.3, -8.3, 15.7);
    buildCar(F, 15.8, 2.2, 0x3a3a3a, 0); rect(F, 14.9, 0.05, 16.7, 4.35);
    poi(F, '2층집', -27, 8.75, 6); poi(F, '시장', 22, 16, 6);
    if (!side) poi(F, '분수 광장', 0, 0, 7);
  }

  const L = { factory, ruins, town }[M.layout];
  halves.forEach((F, side) => L(F, side));
}
