// ============================================================
// 10_resume.js — 경기 이어하기 (v23)
//  경기 중에 새로고침·뒤로가기·탭 닫기(모바일에서 앱을 바꾸는 사이 브라우저가 탭을 정리한 경우 포함)로 나갔다가 다시 들어오면,
//  그 경기가 끝나지 않았을 때 '다시 들어갈까요?' 창을 띄운다 (다시 들어가기 · 포기하기)
//  · 혼자 하는 경기(봇과): 경기가 이 기기에만 있으므로 5초마다·화면을 떠날 때 상태를 저장(store 'resume')했다가 그대로 되살린다
//    - 지형·건물은 맵마다 같고, 아이템·봇(이름·얼굴·난이도)은 경기 시드로 다시 만들면 같다 → 저장은 그 뒤로 바뀐 것만
//      (주워 간 시작 아이템 번호 · 개수가 바뀐 것 · 새로 생긴 아이템(버린 것·시체 상자·보급 상자·리콜 카드))
//    - 캐릭터(위치·체력·기절·소지품·장비·처치·리콜) · 차량 · 자기장 · 수송기(리콜 수송기 포함) · 보급(수송기·떨어지는 상자·착지한 상자) · 팀 순위
//    - 봇의 생각(AI)은 저장하지 않고 되살린 자리에서 다시 시작 (방장 넘겨받기와 같은 방식 — 10_net.js adopt)
//    - 데스매치·대결: 같은 아레나·명단·총으로 다시 열고 점수·시간·처치·데스를 되살린다 (모두 새로 부활 · 대결은 그 라운드를 처음부터)
//  · 같이 하기·온라인 매칭: 경기는 다른 기기(방장)에서 계속되고, 나간 사람 캐릭터는 그동안 봇이 이어서 한다
//    → 로비 채널로 그 경기 사람들에게 묻고(rj) 지금 방장이 답하면(rjok) 같은 경기를 열어 다시 연결, 방장이 보낸 지금 상태로 맞춘 뒤
//      내 캐릭터를 돌려받는다 (소지품은 이 기기에 저장해 둔 것 — 방장 기기는 손에 든 총·장비만 알고 있었다) — 10_net.js
//    - 10초 동안 아무도 답하지 않으면 이미 끝난 경기 → 떠날 때의 순위로 기록
//    - 그사이 새로고침으로 게임 버전(NET_VER)이 바뀌었으면 묻지 않고 떠날 때의 순위로 기록 (예전 버전 경기와는 같이 할 수 없음 — 10_ver.js)
//      스스로 나간 것이 아니라 배포 때문에 못 돌아가는 것이라 탈주가 아닌 보통 패배로 (랭크·하드코어 탈주 감점 · 승급전 '탈주' 실패 없음) · 안내는 8초
//    - 이 창이 답을 기다리는 동안은 새 버전 막대를 미룬다 (새로고침하면 다시 들어갈 수 있던 경기를 놓칠 수 있다 — 10_ver.js Ver.sync)
//  · 포기하기: 일시정지 메뉴의 '경기 포기'처럼 떠날 때의 순위로 기록 (랭크전은 RP 에도 반영 · 데스매치는 원래처럼 기록 없음)
//  · 결과가 정해진 뒤(전멸·우승 뒤 결과 화면이 뜨기 전) 떠났으면 묻지 않고 그 결과로 기록
//  · 저장하지 않는 곳: 스타트 섬(시작 전 — 떠나도 기록이 없음) · 훈련장 · 메뉴로 나간 경기(그때 이미 기록됨)
//  · 이 기기 저장소에만 둔다 (계정 동기화 없음). 다른 계정으로 들어오면 버림 · 혼자 12시간 · 같이 하기 35분이 지나면 버림
// ============================================================
const Resume = (() => {
  const KEY = 'resume', VER = 1, SOLO_MAX = 12 * 3600e3, NET_MAX = 35 * 60e3, EVERY = 5;
  let saveT = 0, pend = null, busy = false, waitT = null, hideT = null;
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const byId = (id) => { for (const c of CHARS) if (c.id === id) return c; return null; };
  const isNet = (s) => s && (s.kind === 'nbr' || s.kind === 'ndm');
  const clear = () => { try { localStorage.removeItem(STORE_PREFIX + KEY); } catch (e) { /* */ } };

  // ---------- 소지품 · 캐릭터 ----------
  function encW(w) { return w ? [w.id, w.mag | 0, w.fm || 0, w.att.scope || 0, w.att.muzzle || 0, w.att.mag || 0, w.att.grip || 0] : 0; }
  function decW(a) { if (!a || !ITEMS[a[0]]) return null; const w = newWeapon(a[0], a[1] | 0); w.fm = a[2] || 0; w.att = { scope: a[3] || null, muzzle: a[4] || null, mag: a[5] || null, grip: a[6] || null }; return w; }
  function encInv(v) { const g = v.gear; return { w: v.weapons.map(encW), c: v.cur, m: v.melee || 0, i: Object.assign({}, v.items), h: g.helmet ? [g.helmet.id, r1(g.helmet.dur)] : 0, v: g.vest ? [g.vest.id, r1(g.vest.dur)] : 0, b: g.bag ? g.bag.id : 0, t: v.throwSel }; }
  function decInv(c, o) {
    const v = c.inv; v.weapons = [0, 1, 2].map((i) => decW(o.w && o.w[i])); v.cur = o.c >= 0 && v.weapons[o.c] ? o.c : -1;
    v.melee = o.m && ITEMS[o.m] ? o.m : null; v.items = {}; for (const k in o.i || {}) if (ITEMS[k] && o.i[k] > 0) v.items[k] = o.i[k];
    v.gear = { helmet: o.h && ITEMS[o.h[0]] ? { id: o.h[0], dur: o.h[1] } : null, vest: o.v && ITEMS[o.v[0]] ? { id: o.v[0], dur: o.v[1] } : null, bag: o.b && ITEMS[o.b] ? { id: o.b } : null };
    if (o.t && ITEMS[o.t]) v.throwSel = o.t;
  }
  // vi: 탄 차량 → 번호 (혼자: 저장할 때 붙인 순서 · 같이 하기: 차량 번호 nid)
  function encChar(c, vi) {
    const o = { i: c.id, a: c.alive ? 1 : 0, p: [r2(c.pos.x), r2(c.pos.y), r2(c.pos.z)], y: r3(c.yaw), pt: r3(c.pitch || 0), m: c.mode, s: c.stance, hp: r1(c.hp), k: c.kills || 0 };
    if (c.knocks) o.kn = c.knocks; if (c.revives) o.rv = c.revives; if (c.damageDealt) o.dd = Math.round(c.damageDealt); if (c.boost) o.bo = r1(c.boost);
    if (c.knockN) o.kN = c.knockN;
    if (c.knocked) { o.ko = 1; o.kT = r2(c.knockT || G.time); o.kB = c.knockedBy ? c.knockedBy.id : -1; }
    if (!c.alive) { o.dt = r2(c.deathTime || 0); o.pl = c.place || 0; }
    if (c.life) o.lf = c.life; if (c.recallN) o.rn = c.recallN; if (c.cards && c.cards.length) o.cd = c.cards.slice();
    if (c.alive) o.iv = encInv(c.inv);   // 죽은 캐릭터의 소지품은 시체 상자(아이템)로 이미 나갔다
    const vn = c.veh && vi ? vi(c.veh) : undefined; if (vn !== undefined && vn !== null) { o.vh = vn; o.st = c.seat || 0; }
    if (c.mode === 'plane' && c.rplane && c.rplane.rsI !== undefined) o.rp = c.rplane.rsI;
    if (c.isPlayer) o.me = { hs: c.headshots || 0, lt: c.lootN || 0, hl: c.healN || 0, dr: r1(c.driveM || 0), gd: c.goldN || 0, ga: c.goldAmt || 0, dp: c.dropN || 0 };
    return o;
  }
  // 저장한 상태를 캐릭터에 (vehs: 번호 → 차량 · rps: 리콜 수송기)
  function charApply(c, o, vehs, rps) {
    c.kills = o.k || 0; c.knocks = o.kn || 0; c.revives = o.rv || 0; c.damageDealt = o.dd || 0; c.boost = o.bo || 0; c.knockN = o.kN || 0;
    c.life = o.lf || 0; c.recallN = o.rn || 0; c.cards = o.cd ? o.cd.slice() : [];
    if (o.me) { c.headshots = o.me.hs; c.lootN = o.me.lt; c.healN = o.me.hl; c.driveM = o.me.dr; c.goldN = o.me.gd; c.goldAmt = o.me.ga; c.dropN = o.me.dp; }
    if (c.veh) Veh.exit(c, true, true);
    c.heal = null; c.rl = null; c.cycle = null; c.throwMode = null; c.revive = null; c.revivedBy = null; c.recall = null; c.vault = null; c.aiming = false; c.sprint = false;
    c.pos.set(o.p[0], o.p[1], o.p[2]); c.vel.set(0, 0, 0); c.yaw = c.bodyYaw = o.y || 0; c.pitch = o.pt || 0;
    c.root.position.copy(c.pos); c.root.rotation.y = c.yaw;
    if (!o.a) {   // 탈락
      c.alive = false; c.hp = 0; c.knocked = false; c.deathTime = o.dt || 0; c.place = o.pl || 0; c.mode = 'ground'; c.stance = 'stand'; c.onGround = true; c.anim.dead = 1;
      const v = c.inv; v.weapons = [null, null, null]; v.items = {}; v.cur = -1; v.gear = { helmet: null, vest: null, bag: null }; v.melee = null;
      c.setVisibleGear(); c.root.visible = !c.isPlayer || corpseK(c) < 1;
      return;
    }
    c.alive = true; c.hp = o.hp; c.mode = o.m || 'ground'; c.stance = o.s || 'stand'; c.onGround = c.mode === 'ground'; c.anim.dead = 0;
    c.knocked = !!o.ko;
    if (c.knocked) { c.knockT = o.kT; c.knockedBy = o.kB >= 0 ? byId(o.kB) : null; c.stance = 'prone'; }
    if (o.iv) decInv(c, o.iv);
    c.equipT = 0; c.setVisibleGear();
    if (c.mode === 'plane') {
      const rp = o.rp !== undefined && rps ? rps[o.rp] : null; c.rplane = rp || null;
      const pl = rp || G.plane; if (pl) c.pos.copy(pl.pos); c.root.visible = false;
    } else {
      c.root.visible = true;
      if (c.mode === 'fall' || c.mode === 'chute') { c.vel.set(0, c.mode === 'fall' ? -30 : -5, 0); c.jumpT = G.time - 2; }
    }
    const v = o.vh !== undefined && vehs ? vehs[o.vh] : null;
    if (v && !v.dead) Veh.enter(c, v, o.st || 0);
  }
  // 봇의 생각: 되살린 자리에서 다시 (방장 넘겨받기 adopt 와 같게) — 처음 수송기에 있는 봇은 만들 때 정한 강하 계획 그대로
  function brainApply(c) {
    const b = c.brain; if (!b || c.isPlayer || !c.alive) return;
    if (c.mode === 'plane') {
      if (c.rplane) { b.followJump = false; b.jumpAt = c.rplane.t + rnd(1, 3); b.dropTarget = { x: c.rplane.tw.ix, z: c.rplane.tw.iz }; b.chuteH = rnd(80, 125); }
      else if (b.followJump && b.followC && b.followC.mode !== 'plane' && G.plane) b.jumpAt = G.plane.t + rnd(0.3, 1.4);   // 따라 뛸 사람은 이미 뛰었다
    } else if (c.mode === 'fall' || c.mode === 'chute') { if (!b.followJump) b.dropTarget = { x: c.pos.x, z: c.pos.z }; b.chuteH = 90; b.jumpAt = 0; }
    else { b.setState('EXPLORE'); b.landT = G.time - 999; b.dropTarget = { x: c.pos.x, z: c.pos.z }; }   // 이미 내린 봇: 착지 뒤 파밍 우선(07_bot.js lootPhase)을 다시 주지 않게
    if (c.knocked) b.onKnocked();
  }

  // ---------- 아이템: 시드로 다시 만든 시작 아이템에서 바뀐 것만 ----------
  // 경기 시작 때 (11_game.js startMatch — populateLoot 바로 뒤): 시작 아이템 수·개수·배치 검증값
  function mark() {
    G.loot0 = GROUND.length; G.lootC0 = GROUND.map((it) => it.count);
    let h = GROUND.length | 0; for (const it of GROUND) h = (Math.imul(h, 31) + ((it.x * 7 + it.z * 13) | 0) + it.count) | 0; G.lootH = h;
  }
  function lootSnap() {
    const n0 = G.loot0 || 0, c0 = G.lootC0 || [], g = [], cn = [], ad = [];
    for (let i = 0; i < GROUND.length; i++) {
      const it = GROUND[i];
      if (i < n0) { if (!it.alive) g.push(i); else if (it.count !== c0[i]) cn.push(i, it.count); }
      else if (it.alive) ad.push([it.id, it.count, r2(it.x), r2(it.y), r2(it.z), it.inst || 0, it.bx || 0, it.drop ? 1 : 0, it.autoNo === Infinity ? 1 : 0]);   // 마지막: 내가 버린 것(자동 줍기가 다시 줍지 않음)
    }
    return { n: n0, h: G.lootH, g, c: cn, a: ad };
  }
  function lootApply(L) {
    if (!L) return;
    if (L.n === G.loot0 && L.h === G.lootH) {
      for (const i of L.g) { const it = GROUND[i]; if (it && it.alive) removeItem(it); }
      for (let k = 0; k < L.c.length; k += 2) { const it = GROUND[L.c[k]]; if (it && it.alive) it.count = L.c[k + 1]; }
    } else console.warn('이어하기: 시작 아이템 배치가 달라(업데이트 등) 주워 간 아이템은 되살리지 못했습니다');
    for (const a of L.a) { if (!ITEMS[a[0]]) continue; const it = spawnItem(G.scene, a[0], a[1], a[2], a[3], a[4], a[5] || null, undefined, a[6] || null); if (a[7]) it.drop = 1; if (a[8]) it.autoNo = Infinity; }
  }
  // ---------- 차량 ----------
  function vehSnap() { return Veh.list.map((v, i) => { v.rsI = i; return [v.type, r2(v.pos.x), r2(v.pos.y), r2(v.pos.z), r3(v.yaw), Math.round(v.hp), v.dead ? 1 : 0, v.skin || 0, v.burnT > 0 ? r1(v.burnT) : 0]; }); }
  function vehApply(V) {
    if (!V) return [];
    for (const v of Veh.list.slice()) Veh.remove(v);
    return V.map((a) => {
      if (!VEH_TYPES[a[0]]) return null;
      const v = Veh.make(a[0], a[1], a[3], a[4]); v.hp = a[5];
      if (a[7] && VehModels.has(a[7])) Veh.setSkin(v, a[7]);
      if (a[6]) { v.dead = true; v.awake = false; if (!v.T.animal) { VehModels.wreck(v.P); v.P.root.position.y -= 0.12; } }
      else if (a[8]) { v.burnT = a[8]; v.awake = true; }
      return v;
    });
  }

  // ---------- 기록용 요약 ----------
  const settingsOf = () => ({ map: SETTINGS.map, mode: SETTINGS.mode, squad: SETTINGS.squad, queue: SETTINGS.queue, time: SETTINGS.time, difficulty: SETTINGS.difficulty, bots: SETTINGS.bots, game: SETTINGS.game, arena: SETTINGS.arena });
  // 포기했을 때 남길 결과 (일시정지 메뉴 '경기 포기'와 같은 셈 — 11_game.js G.ui('quit')) · 결과가 정해졌으면(G.over) 그 결과
  function quitSum() {
    const p = G.player, T = G.teams && G.teams[p.team]; if (!T) return null;
    let place, win = false;
    if (G.over) { win = !!G.win; place = win ? 1 : (T.place || aliveTeamCount() + (teamAlive(T) ? 0 : 1)); }
    else { const others = T.members.some((m) => m !== p && m.alive), n = aliveTeamCount() - (p.alive && !others ? 1 : 0); place = T.place || (others ? n : n + 1); }
    const surv = p.alive || (win && !p.deathTime) ? G.matchT || G.time : p.deathTime || G.time;   // matchT: 우승이 정해진 시각 (v23 우승 축하 중에 떠나면 그 결과로)
    return { place, nT: G.teams.length, total: G.total, kills: p.kills, dmg: Math.round(p.damageDealt || 0), revives: p.revives || 0, heads: p.headshots || 0, drive: Math.round(p.driveM || 0), loot: p.lootN || 0, heals: p.healN || 0, goldN: p.goldN || 0, drops: p.dropN || 0,
      surv: Math.round(surv), ranked: G.ranked ? 1 : 0, hc: G.hc ? 1 : 0, ts: G.teamSize, party: G.netCfg ? 1 : 0, map: G.netCfg ? G.netCfg.s.map : SETTINGS.map, win: win ? 1 : 0, over: G.over ? 1 : 0 };   // 같이 하기: 창을 닫을 때 10_net.js 가 내 설정을 먼저 되돌려도 경기 맵으로
  }
  // 창에 보일 요약
  function summary() {
    const p = G.player; let al = 0; for (const c of CHARS) if (c.alive) al++;
    return { t: Math.round(G.time), al, k: p.kills || 0, a: p.alive ? 1 : 0, dm: G.dm ? [G.dm.score[p.team], G.dm.score[1 - p.team]] : null };
  }

  // ---------- 저장 ----------
  //  저장하는 경기인가 — 밖에서도 can 으로 (11_game.js GLX: 새로고침 안내에 '이어서 할 수 있음'을 붙일지)
  const want = () => G.state === 'play' && !!G.scene && !!G.player && !G.training && !G.island && !G.quit && !(G.dm && G.dm.over) && !G.rjHold && !busy;
  function snapBr() {
    const rps = Recall.snapPlanes(), vh = vehSnap(), pl = G.plane, vi = (v) => v.rsI;
    return { kind: 'br', seed: G.mseed, bd: G.bd || '', nb: CHARS.length - 1, ts: G.teamSize, rk: G.ranked ? 1 : 0, hc: G.hc ? 1 : 0, t: r2(G.time),
      pl: pl ? { a: pl.a, off: pl.offN, t: r2(pl.t), on: pl.active ? 1 : 0 } : null, z: Net.zoneSnap(), tp: G.teams.map((T) => T.place || 0),
      ch: CHARS.map((c) => encChar(c, vi)), vh, rp: rps, lo: lootSnap(), ad: Airdrop.snap(), st: G.stats, kl: G.killLog, nl: G.knockLog, mk: G.marker || null, q: quitSum() };
  }
  function snapDm() {
    const S = G.dm, p = G.player;
    return { kind: 'dm', t: r2(G.time), q: null,
      dm: { type: S.type, seed: S.seed, arena: S.arena, loadout: S.loadout, myId: p.id, roster: CHARS.map((c) => ({ id: c.id, team: c.team, name: c.name, human: !!c.isPlayer, diff: c.diffKey || undefined, lo: c.dmLoad || undefined })) },
      sc: S.score.slice(), md: S.myDeaths || 0, lw: S.lastWin, rd: S.round ? S.round.n : 0, kd: CHARS.map((c) => [c.id, c.kills || 0, c.dmDeaths || 0]) };
  }
  // 같이 하기: 경기 설정 + 내 캐릭터 (소지품) — 나머지는 돌아갈 때 방장이 보내 준다
  function snapNet() {
    const cfg = G.netCfg;
    return { kind: cfg.dm ? 'ndm' : 'nbr', cfg, t: r2(G.time), me: encChar(G.player, null), q: G.dm ? null : quitSum() };
  }
  function save() {
    if (!want()) return;
    try {
      const s = G.netCfg ? snapNet() : G.dm ? snapDm() : snapBr();
      s.v = VER; s.at = Date.now(); s.uid = Cloud.uid || null; s.s = G.netCfg ? Object.assign({ game: G.netCfg.game }, G.netCfg.s) : settingsOf(); s.sum = summary();
      store.set(KEY, s);
    } catch (e) { console.warn('이어하기 저장 실패', e); }
  }
  // 매 프레임 (11_game.js G.update): 5초마다
  function tick(dt) { saveT -= dt; if (saveT <= 0) { saveT = EVERY; save(); } }
  // 화면을 떠날 때 바로 (새로고침·뒤로가기·탭 닫기·앱 전환) — 같이 하기는 10_net.js 가 나가기(leave) 전에 먼저 부른다
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', () => save());
  // 뒤로 갔다가 앞으로 와서 페이지가 그대로 살아난 경우(bfcache): 같이 하기는 이미 나간 것으로 처리됐으므로 다시 불러 이어하기 창으로
  window.addEventListener('pageshow', (e) => { if (e.persisted && G.netCfg && G.state === 'play' && !G.net) location.reload(); });

  // ---------- 되살리기 (혼자) ----------
  // 배틀로얄: startMatch({ resume }) 가 같은 시드로 맵·아이템·캐릭터를 만든 뒤 G.state = 'play' 직전에 부른다
  function apply(rs) {
    G.time = rs.t; if (rs.st) G.stats = rs.st; G.killLog = rs.kl || []; G.knockLog = rs.nl || [];
    const pl = G.plane;
    if (pl && rs.pl) { pl.t = rs.pl.t; pl.active = !!rs.pl.on; const d = pl.t * pl.speed; pl.pos.set(pl.ax + pl.dx * d, pl.alt, pl.az + pl.dz * d); pl.mesh.position.copy(pl.pos); pl.mesh.visible = pl.active; }
    Net.applyZone(rs.z);
    lootApply(rs.lo);
    const vehs = vehApply(rs.vh), rps = Recall.restorePlanes(rs.rp);
    for (const o of rs.ch || []) { const c = byId(o.i); if (c) charApply(c, o, vehs, rps); }
    for (const c of CHARS) brainApply(c);
    if (rs.tp) rs.tp.forEach((v, i) => { if (G.teams[i]) G.teams[i].place = v; });
    Airdrop.restore(rs.ad);
    G.marker = rs.mk || null; G.updateMarker();
    afterApply();
  }
  // 내 캐릭터 기준 마무리: 소리·관전·인벤토리
  function afterApply() {
    const p = G.player; if (!p) return;
    Audio.plane(p.alive && p.mode === 'plane'); Audio.wind(p.alive && p.mode !== 'ground' ? 0.1 : 0);
    if (!p.alive) { G.spec = null; nextSpectate(); }
    HUD.refreshInventory();
  }
  // 데스매치·대결: DM.start 로 같은 판을 다시 연 뒤
  function applyDm(rs) {
    const S = G.dm; if (!S) return;
    G.time = rs.t; S.score = rs.sc.slice(); S.myDeaths = rs.md || 0; S.lastWin = rs.lw === undefined ? null : rs.lw;
    for (const [id, k, d] of rs.kd || []) { const c = byId(id); if (c) { c.kills = k; c.dmDeaths = d; } }
    for (const c of CHARS) if (c.alive) c.spawnProt = S.duel ? G.time + 999 : G.time + DM_RULES.protect;
    if (S.duel) { S.round.t0 = G.time; if (rs.rd > 1) DM.applyDuel({ r: rs.rd, ph: 'prep', t: G.time, sc: S.score.slice(), w: S.lastWin, lo: S.loadout }); }   // 그 라운드를 처음부터
  }

  // ---------- 같이 하기로 돌아옴 (10_net.js) ----------
  // h: 방장이 알려 준 내 캐릭터의 지금 상태 · mine: 이 기기에 저장해 둔 내 캐릭터 (소지품은 이쪽 — 방장 기기는 손에 든 총·장비 + 봇이 쓰던 것만 안다)
  function applyMine(c, h, mine) {
    if (!c) return;
    const o = Object.assign({}, h || mine || {}); if (!o.p) return;
    if (mine) {
      if (o.a && mine.iv) o.iv = mine.iv;
      o.k = Math.max(o.k || 0, mine.k || 0); o.kn = Math.max(o.kn || 0, mine.kn || 0); o.rv = Math.max(o.rv || 0, mine.rv || 0); o.dd = Math.max(o.dd || 0, mine.dd || 0);
      if (mine.me) o.me = mine.me; o.lf = Math.max(o.lf || 0, mine.lf || 0); o.rn = Math.max(o.rn || 0, mine.rn || 0); if (!o.cd && mine.cd && o.a) o.cd = mine.cd;
    }
    const vehs = G.net ? G.net.vehs : null;
    if (G.dm) { c.kills = o.k || 0; if (o.iv && c.alive) { decInv(c, o.iv); c.setVisibleGear(); } return; }   // 데스매치: 부활한 자리 그대로 · 총(웨폰 데스매치)만
    charApply(c, o, vehs, null);
    afterApply();
    if (!c.alive) G.onDeath(c, null);   // 없는 사이 탈락 → 팀원 관전 또는 (팀 전멸이면) 결과
  }

  // ---------- 다시 들어왔을 때 ----------
  // 부팅 끝(로그인 복원 뒤) · 로그인할 때 (11_game.js boot · G.onAuth)
  function check() {
    if (pend || busy) return;
    const s = store.get(KEY, null); if (!s) return;
    const net = isNet(s), age = Date.now() - (s.at || 0);
    if (s.v !== VER || age < 0 || age > (net ? NET_MAX : SOLO_MAX)) { clear(); return; }
    if ((s.uid || null) !== (Cloud.uid || null)) { if (Cloud.uid) clear(); return; }   // 다른 계정 · (로그아웃 상태면 그대로 두었다가 로그인하면 다시 확인)
    if (s.q && s.q.over) { clear(); record(s.q, false); return; }   // 결과가 정해진 뒤에 떠남 → 묻지 않고 기록
    // 같이 하기: 그사이 게임 버전이 바뀜(새로고침으로 새 배포를 받음) → 예전 버전 경기에는 다시 들어갈 수 없다 (10_ver.js)
    //  탈주가 아닌 보통 패배로 떠날 때의 순위 그대로 (quit 없음 → 탈주 감점·승급전 '탈주' 실패 없음) · 휴대폰에서도 읽게 8초
    if (net && s.cfg && s.cfg.v !== NET_VER) { clear(); const t = '게임 버전이 바뀌어 그 경기에 다시 들어갈 수 없습니다'; if (s.q) record(s.q, false, t + ' · 떠날 때의 순위로 기록' + (s.q.ranked || s.q.hc ? ' (탈주 아님)' : ''), 8000); else HUD.lobbyNote(t, 8000); return; }
    if (G.state !== 'lobby') return;
    pend = s; show(s);
  }
  function modeLabel(s) {
    const S = s.s || {}, g = S.game || 'br';
    if (isDmGame(g)) return `${(GAME_TYPES[g] || {}).name || '데스매치'} · ${arenaLabel(s.dm ? s.dm.arena : s.cfg && s.cfg.arena)}`;
    const q = s.q || {}, ts = q.ts || s.ts || (TEAM_MODES[S.squad] || TEAM_MODES.solo).size, sq = ts === 1 ? '솔로' : (Object.values(TEAM_MODES).find((m) => m.size === ts) || TEAM_MODES.solo).name;
    return [(MAPS[S.map] || {}).name, q.hc ? '하드코어' : q.ranked ? '랭크전' : '', sq, isNet(s) ? (s.cfg && s.cfg.mm ? '온라인 매칭' : '파티') : ''].filter(Boolean).join(' · ');
  }
  function agoText(ms) { const m = Math.floor(ms / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 ${m % 60}분 전`; }
  function show(s, msg) {
    const net = isNet(s), sm = s.sum || {}, q = s.q;
    $('rjTitle').textContent = net ? '진행 중인 경기가 있습니다' : '멈춰 둔 경기가 있습니다';
    $('rjWhat').textContent = modeLabel(s);
    $('rjStat').textContent = sm.dm ? `${fmtTime(sm.t)} · 점수 ${sm.dm[0]} : ${sm.dm[1]} · 내 처치 ${sm.k}` : `경기 시간 ${fmtTime(sm.t || 0)} · 생존 ${sm.al}명 · 내 처치 ${sm.k}${sm.a ? '' : ' · 탈락 후 관전 중'}`;
    $('rjNote').textContent = (net ? `${agoText(Date.now() - s.at)} 나갔습니다. 경기는 다른 사람들 기기에서 계속되고, 그동안 내 캐릭터는 봇이 대신 움직였습니다.` : `${agoText(Date.now() - s.at)} 나간 그 순간에 멈춰 있습니다. 다시 들어가면 그대로 이어서 합니다.`)
      + (q ? ` 포기하면 ${q.place}위로 기록됩니다${q.hc || q.ranked ? ' (랭크 점수 반영)' : ''}.` : ' 포기하면 기록 없이 끝납니다.');
    const m = $('rjMsg'); m.hidden = !msg; m.textContent = msg || '';
    $('rjGo').disabled = false; $('rjNo').disabled = false; $('rjGo').textContent = msg ? '다시 시도' : '다시 들어가기';
    $('rjPanel').hidden = false; Ver.sync();   // 새 버전 막대는 답할 때까지 미룸 (10_ver.js)
  }
  function hide() { $('rjPanel').hidden = true; Ver.sync(); }
  // 경기 기록 (11_game.js recordBR — 결과 화면과 같은 셈) · quit: 포기(탈주) — 아니면 결과가 정해진 뒤 떠난 경기(win) · 게임 버전이 바뀌어 못 돌아간 경기(보통 패배)
  //  head: 알림 앞머리 · ms: 알림을 보여 줄 시간
  function record(q, quit, head, ms) {
    if (!q) return;
    try {
      const r = recordBR(Object.assign({}, q, { win: !!q.win && !quit, quit: !!quit }));
      const R = G.rankResult, rp = R && !R.placement && R.delta !== undefined ? ` · 랭크 ${R.delta >= 0 ? '+' : ''}${R.delta} RP` : '';
      HUD.lobbyNote(`${head || (quit ? '지난 경기를 포기했습니다' : '지난 경기 결과를 기록했습니다')} — ${q.win && !quit ? '우승' : q.place + '위'} · 경험치 +${r.xp}${rp}${r.notes.length ? ' · ' + r.notes.join(' · ') : ''}`, ms);
      HUD.renderLobby();
    } catch (e) { console.warn('이어하기 기록 실패', e); }
  }
  function forfeit(s) { pend = null; clear(); hide(); if (s && s.q) record(s.q, true); else HUD.lobbyNote('지난 경기를 끝냈습니다'); }
  // 새 경기를 시작함 (11_game.js startMatch · 10_dm.js start): 답하지 않은 창이 남아 있으면 그 경기는 포기로
  function fresh() { if (busy) return; if (pend) forfeit(pend); else clear(); saveT = EVERY; }

  // 다시 들어가기
  async function go() {
    const s = pend; if (!s || busy) return;
    busy = true; $('rjGo').disabled = true; $('rjNo').disabled = true;
    try {
      if (isNet(s)) { await goNet(s); return; }
      pend = null; hide();
      Object.assign(SETTINGS, s.s);
      if (s.kind === 'dm') { await DM.start(Object.assign({}, s.dm, { resume: true })); if (G.dm) applyDm(s); }
      else await startMatch({ resume: s });
      if (G.state === 'play') HUD.toast('경기를 이어서 합니다', 'ok');
    } catch (e) { console.error(e); HUD.toast('이어하기 실패: ' + e.message, 'warn'); }
    finally { busy = false; saveT = 1; }
  }
  // 같이 하기: 방장 찾기 → 같은 경기 열기 → 방장이 지금 상태를 보낼 때까지 가림막
  async function goNet(s) {
    const msg = $('rjMsg'), say = (t) => { msg.hidden = false; msg.textContent = t; };
    say('경기에 연결하는 중…');
    try {
      if (!Cloud.uid) { busy = false; show(s, '로그인이 풀려 있습니다 — 로그인한 뒤 다시 시도하세요'); return; }
      for (let i = 0; i < 40 && !Social.connected; i++) await new Promise((r) => setTimeout(r, 200));   // 로비 채널 연결을 기다림
      const ok = Social.connected ? await Net.probe(s.cfg) : null;
      if (!ok) { busy = false; pend = null; clear(); hide(); if (s.q) record(s.q, true, '그 경기는 이미 끝났습니다 · 떠날 때의 순위로 기록'); else HUD.lobbyNote('그 경기는 이미 끝났습니다'); return; }
      pend = null; hide();
      const cfg = JSON.parse(JSON.stringify(s.cfg)); cfg.host = ok.host;
      Net.join(cfg, { ep: ok.ep, isl: ok.isl, mine: s.me });
      G.rjHold = true;
      // 경기 화면이 열린 뒤 방장 상태를 받을 때까지 가림막 (25초 안에 못 받으면 실패)
      const t0 = Date.now();
      clearInterval(waitT);
      waitT = setInterval(() => {
        if (!G.rjHold) { clearInterval(waitT); return; }
        // 로딩 화면 그대로 가림막 (10_loading.js — 이미 떠 있으면 그대로) · '로비로 나가기' 단추: 기다리다 그만두면 다시 들어가기 창으로 (다시 시도 가능)
        if (G.state === 'play') Loading.hold('경기 상태를 받는 중…', () => { if (G.rjHold) { clearInterval(waitT); failNet(s, '다시 들어가기를 그만두었습니다 — 다시 시도할 수 있습니다'); } });
        if (Date.now() - t0 > 25000 || !G.net) { clearInterval(waitT); failNet(s); }
      }, 300);
    } catch (e) { console.error(e); busy = false; show(s, '연결 실패: ' + e.message); }
  }
  function failNet(s, msg) {
    G.rjHold = false; busy = false; Loading.hideNow();
    if (G.net) Net.close(true);
    if (G.state === 'play' || G.state === 'loading') toLobby();
    pend = s; store.set(KEY, s); show(s, msg || '경기에 다시 연결하지 못했습니다 (방장 기기와 연결이 되지 않음)');
  }
  // 방장이 보낸 지금 상태를 적용함 (10_net.js applyRj 끝)
  function rejoined() {
    G.rjHold = false; busy = false; clearInterval(waitT); Loading.finale({ zone: true, stamp: '경기 복귀', quick: true });   // 가림막: 지금 자기장 + 도장 뒤 바로 사라짐 (경기는 이미 진행 중)
    const p = G.player;
    HUD.toast(p && p.alive ? '경기에 다시 들어왔습니다 — 내 캐릭터를 돌려받았습니다' : '경기에 다시 들어왔습니다 — 그사이 탈락해서 팀원을 관전합니다', 'ok');
    saveT = 1;
  }

  function setup() {
    $('rjGo').addEventListener('click', go);
    $('rjNo').addEventListener('click', () => { if (!busy) forfeit(pend); });
  }
  return { setup, check, tick, save, clear, fresh, mark, apply, applyMine, encChar, rejoined, can: want, get pending() { return pend; }, get busy() { return busy; } };
})();
