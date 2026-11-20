// ============================================================
// 07_bot_hunt.js — v23 잠수 추적: 승급전 · 하드코어에서 한곳에 숨어 싸우지 않는 플레이어를 봇이 찾아온다
//  (봇끼리 빠르게 싸워 줄어드는 동안 숨어만 있어도 순위가 오르던 문제 — 처치 조건은 10_rank.js)
//  · 땅에 내린 뒤 grace 초는 그냥 둔다 (처음 파밍할 시간)
//  · 그 뒤 반경 R m 안에서 idle 초 동안 피해를 한 번도 주지 않으면 '잠수' — warn 초 전에 경고하고,
//    잠수가 이어지는 동안 every 초마다 가까운 무장 봇 n명에게 대략적인 위치(±err m)를 알린다 → 그쪽을 수색 (07_bot.js think)
//    벽 너머 위치를 '아는' 것뿐 — 보이기 전에는 쏘지 않는다 (팀원 위치 공유와 같은 방식)
//  · 피해를 주거나 R m 넘게 움직이면 처음부터 다시 (차로 움직여도)
//  · 혼자 하는 경기만 — 같이 하기·온라인 매칭은 방장 기기가 봇을 움직여 빼 둠
// ============================================================
const HUNT = { grace: 60, idle: 40, warn: 10, R: 40, every: 10, n: 3, err: 18, range: 450, rangeBig: 800 };
const Hunt = {
  on: false, s: null, acc: 0,
  reset() { this.on = !G.net && !G.training && !G.dm && !!(G.hc || (G.ranked && Rank.series())); this.s = null; this.acc = 0; },
  update(dt) {
    if (!this.on) return;
    const p = G.player;
    if (!p || !p.alive || G.over || p.mode !== 'ground') return;
    this.acc += dt; if (this.acc < 0.5) return; this.acc = 0;
    const s = this.s || (this.s = { land: G.time, ax: p.pos.x, az: p.pos.z, t0: G.time, dmg: p.damageDealt, warned: false, exposed: false, next: 0, pings: 0 });
    const moved = Math.hypot(p.pos.x - s.ax, p.pos.z - s.az) > HUNT.R, fought = p.damageDealt > s.dmg + 0.5;
    // 처음 파밍할 시간 · 싸웠거나 움직였으면 처음부터
    if (G.time - s.land < HUNT.grace || moved || fought) {
      if (s.exposed && (moved || fought)) HUD.toast(fought ? '교전 — 위치 노출이 풀렸습니다' : '자리를 옮겼습니다 — 위치 노출이 풀렸습니다', 'ok');
      s.ax = p.pos.x; s.az = p.pos.z; s.t0 = G.time; s.dmg = p.damageDealt; s.warned = false; s.exposed = false; s.next = 0;
      return;
    }
    const idle = G.time - s.t0;
    if (!s.warned && idle >= HUNT.idle - HUNT.warn) { s.warned = true; HUD.toast(`⚠ 한곳에 숨어 있습니다 — ${HUNT.warn}초 안에 움직이거나 싸우지 않으면 봇들이 위치를 알아챕니다`, 'warn'); }
    if (idle >= HUNT.idle && G.time >= s.next) {
      s.next = G.time + HUNT.every;
      const n = this.ping(p);
      if (!s.exposed && n) { s.exposed = true; HUD.toast('위치가 드러났습니다 — 근처 봇들이 찾아옵니다', 'warn'); Audio.ping('danger'); }
      if (n) s.pings++;
    }
  },
  // 가까운 무장 봇 n명에게 대략적인 위치 (싸우는 중·회복 중·차 안·맨손·기절한 봇은 빼고) → 알린 봇 수
  ping(p) {
    const R = W.big ? HUNT.rangeBig : HUNT.range, L = [];
    for (const c of CHARS) {
      const b = c.brain; if (!b || !c.alive || c.knocked || c.mode !== 'ground' || c.veh || sameTeam(c, p)) continue;
      if (b.state === 'COMBAT' || b.state === 'COVER' || b.state === 'RETREAT' || b.state === 'HEAL' || b.state === 'REVIVE') continue;
      if (!b.usableWeapons().length) continue;
      const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z); if (d < R) L.push([d, b]);
    }
    L.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(HUNT.n, L.length); i++) L[i][1].hunt = { x: p.pos.x + rnd(-HUNT.err, HUNT.err), z: p.pos.z + rnd(-HUNT.err, HUNT.err), t: G.time };
    return Math.min(HUNT.n, L.length);
  },
  // 지금 상태 (테스트·개발자 도구)
  info() { const s = this.s; return { on: this.on, idle: s ? Math.round(G.time - s.t0) : 0, warned: !!(s && s.warned), exposed: !!(s && s.exposed), pings: s ? s.pings : 0 }; },
};
