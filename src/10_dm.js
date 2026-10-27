// ============================================================
// 10_dm.js — 팀 데스매치 / 웨폰 데스매치 (4 대 4, 컨테이너 야드)
//  · 먼저 40킬 한 팀 승리. 10분이 지나면 킬이 많은 팀 승리(같으면 무승부)
//  · 죽으면 3초 뒤 자기 팀 출발 구역에서 부활(적에게서 가장 먼 자리), 부활 직후 2초 보호(쏘면 해제)
//  · 4초 동안 안 맞으면 체력 회복, 탄약은 자동 보충, 모두 Lv2 헬멧·조끼(부활 때 새것)
//  · 팀 데스매치: 경기 시작 때 고른 총 1종 + 스코프 1종을 전원이 같이 씀
//  · 웨폰 데스매치: 처치할 때마다 자기 총·스코프가 무작위로 바뀜(직전과 다른 것). 죽어도 지금 총은 유지
//  · 같이 하기(파티): 방장이 경기를 열고 점수·시간을 정한다. 각자 자기 캐릭터의 부활·무기 교체를 처리
// ============================================================
const DM = (() => {
  let S = null;
  const ALL_GUNS = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'weapon');
  const TDM_GUNS = ALL_GUNS.filter((k) => ITEMS[k].cls !== 'PISTOL');          // 전원 권총만 드는 판은 제외
  const SCOPES = ['reddot', 'holo', 'x2', 'x3', 'x4', 'x6'];
  const TEAM_NAMES = ['블루', '레드'];

  // 무작위 장비: 총 + 그 총에 맞는 스코프(없으면 기본 가늠자). prev와 다른 조합
  function loadout(rand, pool, prev) {
    let id = pool[0];
    for (let i = 0; i < 24; i++) { id = pool[Math.floor(rand() * pool.length)]; if (!prev || id !== prev.id) break; }
    const fits = SCOPES.filter((s) => attFits(s, id));
    const scope = fits.length ? fits[Math.floor(rand() * fits.length)] : null;
    return { id, scope };
  }
  const loName = (lo) => ITEMS[lo.id].name + (lo.scope ? ' + ' + ITEMS[lo.scope].name : '');

  // ---------- 시작 ----------
  // cfg(같이 하기): { type, seed, roster:[{id,name,team,slot,human,outfit,diff,owner}], loadout, myId }
  async function start(cfg) {
    if (G.state === 'loading') return;
    cfg = cfg || {};
    const type = cfg.type || (isDmGame(SETTINGS.game) ? SETTINGS.game : 'tdm');
    G.state = 'loading'; G.paused = false; G.over = false; G.training = false; G.dm = null;
    document.body.classList.remove('training');
    Audio.music(false);
    $('lobby').hidden = true; $('resultPanel').hidden = true; $('hud').hidden = true; $('loading').hidden = false;
    $('loadMap').textContent = `${GAME_TYPES[type].name} · ${MAPS.arena.name}`;
    $('loadTip').textContent = type === 'tdm' ? '팀 데스매치: 모두 같은 총으로 싸웁니다. 먼저 40킬 하는 팀이 이깁니다.' : '웨폰 데스매치: 적을 처치할 때마다 총과 스코프가 바뀝니다. 먼저 40킬 하는 팀이 이깁니다.';
    const prog = (p, label) => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadStep').textContent = label; };
    disposeMatch();
    const sc = new THREE.Scene(); G.scene = sc;
    const t = TIMES[SETTINGS.time], Q = QUALITY[SETTINGS.quality], far = Math.min(Q.far, 300);
    G.sky = skyDome(t, far * 0.92); sc.add(G.sky); sc.fog = new THREE.Fog(t.fog, far * 0.35, far);
    const L = addLights(sc, t, SHADOW_SIZE[SETTINGS.shadows]); G.sun = L.sun; G.hemi = L.hemi; G.sunDir = new THREE.Vector3(...t.dir).normalize();
    G.renderer.shadowMap.enabled = SHADOW_SIZE[SETTINGS.shadows] > 0;
    G.camera.far = far + 200; G.camera.updateProjectionMatrix(); sc.add(G.camera);
    G.muzzleLight = SETTINGS.quality === 'low' ? null : new THREE.PointLight(0xffb060, 0, 9, 2);
    if (G.muzzleLight) sc.add(G.muzzleLight);
    VM.hemi.color.setHex(t.hemiS); VM.hemi.groundColor.setHex(t.hemiG); VM.dir.color.setHex(t.sun); VM.dir.intensity = t.sunI * 0.8; VM.hemi.intensity = t.hemiI * 0.9;
    G.focusRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0c060, transparent: true, opacity: 0.6, depthWrite: false }));
    G.focusRing.visible = false; sc.add(G.focusRing);
    setMapSize('arena');
    try { await generateWorld('arena', sc, prog); }
    catch (e) { console.error(e); fatal('맵 생성 중 오류: ' + e.message); return; }
    prog(0.98, '부대 배치');
    Veh.init(sc); FX.init(sc); ThrowViz.init(sc); PROJ = []; SMOKES = []; PathQ.clear(); G.myNade = null;
    Zone.cur = Zone.next = null; Zone.state = 'wait'; Airdrop.init(sc); G.plane = null;
    GROUND = []; itemGrid = new Array(IGN * IGN).fill(EMPTY_LIST);
    CHARS = []; G.noises = []; G.time = 0; G.stats = { shots: 0, hits: 0 }; G.killLog = []; G.knockLog = []; G.marker = null; G.updateMarker(); G.spec = null;
    G.teamOrder = null; G.spotted = new Map(); G.danger = null; G.ranked = false; G.quit = false; G.rankResult = null;
    G.teamSize = DM_RULES.teamSize; G.teams = [{ id: 0, members: [], place: 0 }, { id: 1, members: [], place: 0 }];
    const seed = cfg.seed || ((Math.random() * 1e9) | 0);
    const rand = mulberry32(seed);
    S = { type, seed, rand, score: [0, 0], over: false, winner: null, loadout: null, myDeaths: 0, net: !!cfg.roster };
    S.loadout = cfg.loadout || (type === 'tdm' ? loadout(rand, TDM_GUNS, null) : null);
    G.dm = S;
    // 참가자: 혼자면 나 + 봇 7명(팀원 3·적 4). 같이 하기면 방장이 정한 명단
    const roster = cfg.roster || defaultRoster();
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    roster.forEach((r, i) => {
      const me = cfg.roster ? r.id === cfg.myId : r.human;
      const outfit = r.human ? OUTFITS[r.outfit !== undefined ? r.outfit : SETTINGS.outfit] || OUTFITS[0] : Object.assign({}, OUTFITS[(i + 1) % OUTFITS.length]);
      const c = new Character({ id: r.id, name: r.name || names[i % names.length], isPlayer: me, outfit, team: r.team });
      c.slot = G.teams[r.team].members.length; G.teams[r.team].members.push(c); CHARS.push(c); sc.add(c.root);
      if (me) G.player = c;
      if (r.net) { c.net = r.net; if (!c.net.mine) c.root.visible = false; } // 같이 하기: 다른 기기가 움직이는 캐릭터 (받은 상태로 그림)
      else if (!me) new Brain(c, r.diff || botDiff());
      if (S.type === 'wdm' && (!c.net || c.net.mine)) c.dmLoad = loadout(Math.random, ALL_GUNS, null);
    });
    for (const c of CHARS) if (!c.net || c.net.mine) spawn(c, true);
    G.total = CHARS.length;
    G.firstPerson = SETTINGS.view === 'fpp'; Cam.ads = 0; VM.key = null;
    HUD.reset(); Input.reset(); Touch.resetToggles(); Touch.apply();
    document.body.classList.add('dm'); $('quitBtn').textContent = '경기 나가기 (로비로)';
    $('dmScore').hidden = false; $('dmGoal').textContent = `먼저 ${DM_RULES.killTarget}킬`;
    $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !IS_TOUCH;
    G.state = 'play'; G.previewT = 0;
    Audio.wind(0.04);
    const my = G.player.team;
    HUD.toast(`${GAME_TYPES[type].name} — ${TEAM_NAMES[my]} 팀 · 먼저 ${DM_RULES.killTarget}킬`, 'info');
    if (type === 'tdm') setTimeout(() => G.dm === S && HUD.toast(`이번 판 무기: ${loName(S.loadout)}`, 'ok'), 1600);
    else setTimeout(() => G.dm === S && G.player && G.player.dmLoad && HUD.toast(`시작 무기: ${loName(G.player.dmLoad)} — 처치할 때마다 바뀝니다`, 'ok'), 1600);
    if (G.net) Net.ready();
  }
  // 같이 하기: 방장이 점수·종료를 알린다
  function bcastScore() { if (G.net && Net.isHost()) Net.ev({ k: 'score', sc: S.score.slice(), over: S.over, win: S.winner, t: Math.round(G.time * 100) / 100 }); }
  const botDiff = () => SETTINGS.difficulty === 'mixed' ? pick(['easy', 'normal', 'normal', 'hard']) : SETTINGS.difficulty;
  function defaultRoster() {
    const r = [{ id: 0, team: 0, human: true, name: playerName() }];
    for (let i = 1; i < DM_RULES.teamSize * 2; i++) r.push({ id: i, team: i < DM_RULES.teamSize ? 0 : 1 });
    return r;
  }
  // 이 기기가 움직이는 캐릭터인가 (혼자 하기면 전부)
  const mine = (c) => !c.net || c.net.mine;

  // ---------- 부활 ----------
  function spawnPoint(c) {
    const list = W.arena.spawns[c.team]; let best = list[0], bs = -1e9;
    for (const sp of list) {
      let md = 999, crowd = 0;
      for (const o of CHARS) {
        if (!o.alive || o === c || o.mode !== 'ground') continue;
        const d = Math.hypot(o.pos.x - sp.x, o.pos.z - sp.z);
        if (o.team !== c.team) md = Math.min(md, d); else if (d < 1.6) crowd++;
      }
      const s = Math.min(md, 60) - crowd * 80 + Math.random() * 8;
      if (s > bs) { bs = s; best = sp; }
    }
    return best;
  }
  function spawn(c, first) {
    const sp = spawnPoint(c), y = groundAt(sp.x, sp.z, heightAt(sp.x, sp.z) + 0.3);
    if (c.veh) Veh.exit(c, false, true);
    c.alive = true; c.knocked = false; c.hp = 100; c.boost = 0; c.mode = 'ground'; c.stance = 'stand';
    c.pos.set(sp.x + rnd(-0.4, 0.4), y, sp.z + rnd(-0.4, 0.4)); c.vel.set(0, 0, 0); c.yaw = c.bodyYaw = sp.yaw; c.pitch = 0; c.onGround = true;
    c.vault = null; c.rollT = 0; c.throwMode = null; c.heal = null; c.rl = null; c.cycle = null; c.revive = null; c.revivedBy = null; c.knockedBy = null;
    c.anim.dead = 0; c.anim.air = 0; c.anim.flinch = 0; c.anim.prone = 0; c.anim.crouch = 0; c.root.visible = true;
    c.lastDamageT = -99; c.lastAttacker = null; c.outsideZoneT = 0; c.respawnAt = 0;
    c.spawnProt = G.time + DM_RULES.protect; c.life = (c.life || 0) + 1;
    equip(c, S.type === 'tdm' ? S.loadout : (c.dmLoad || (c.dmLoad = loadout(Math.random, ALL_GUNS, null))), true);
    if (c.brain) resetBrain(c.brain);
    if (c.isPlayer) { Cam.ads = 0; Input.fire = false; if (!first) HUD.toast('부활 — 2초 동안 보호됩니다 (쏘면 해제)', 'info'); }
  }
  function resetBrain(b) {
    b.aware.clear(); b.target = null; b.goal = null; b.path = null; b.wantPath = null; b.investigate = null; b.intel = null;
    b.cover = null; b.lootTarget = null; b.burstLeft = 0; b.pauseT = 0; b.track = 0; b.reviveTgt = null; b.building = null;
    b.recoverUntil = 0; b.stuckT = 0; b.state = 'LANDING'; b.stateT = 0; b.landT = G.time; b.thinkT = 0; b.lookYaw = b.c.yaw; b.huntT = 0;
  }
  // 장비 지급: 총(탄창 가득) + 예비탄 + Lv2 헬멧·조끼 (armor=false면 방어구는 그대로)
  function equip(c, lo, armor) {
    const inv = c.inv, d = ITEMS[lo.id];
    inv.weapons = [null, null, null]; inv.items = {};
    const wi = newWeapon(lo.id, 0); wi.att.scope = lo.scope && attFits(lo.scope, lo.id) ? lo.scope : null;
    wi.mag = inv.magSize(wi);
    const slot = d.slot === 'secondary' ? 2 : 0;
    inv.weapons[slot] = wi; inv.cur = slot;
    inv.items[d.ammo] = inv.magSize(wi) * 3;
    if (armor) inv.gear = { helmet: { id: 'helm2', dur: ITEMS.helm2.dur }, vest: { id: 'vest2', dur: ITEMS.vest2.dur }, bag: null };
    c.rl = null; c.cycle = null; c.equipT = 0.45; c.fireCd = 0; c.bloom = 0; c.burstQ = 0;
    c.setVisibleGear();
  }
  // 웨폰 데스매치: 처치하면 새 총·스코프 (직전과 다른 것)
  function swapWeapon(c) {
    if (!S || S.type !== 'wdm' || !c.alive || !mine(c)) return;
    const lo = loadout(Math.random, ALL_GUNS, c.dmLoad); c.dmLoad = lo;
    equip(c, lo, false);
    if (c.brain) c.brain.burstLeft = 0;
    if (c.isPlayer) { HUD.toast(`무기 교체 → ${loName(lo)}`, 'ok'); Cam.ads = 0; setTimeout(() => Audio.mech('equip', null, lo.id, true), 200); }
  }

  // ---------- 처치 (killChar → G.onDeath에서 호출) ----------
  function onDeath(t, killer) {
    if (!S) return;
    t.respawnAt = G.time + DM_RULES.respawn; t.dmDeaths = (t.dmDeaths || 0) + 1;
    if (t.isPlayer) S.myDeaths++;
    const valid = killer && killer !== t && killer.team !== t.team;
    // 점수는 방장(혼자면 나)이 센다. 같이 하기에서 다른 기기는 방장이 보내는 점수를 받는다
    if (valid && !S.over && (!S.net || (G.netAuthority && G.netAuthority()))) {
      S.score[killer.team]++;
      if (S.score[killer.team] >= DM_RULES.killTarget) finish(killer.team);
      bcastScore();
    }
    if (valid) killedBy(killer);
    if (t.isPlayer && !S.over) HUD.toast(`${valid ? killer.name + '에게 처치됨' : '쓰러졌습니다'} — ${DM_RULES.respawn}초 뒤 부활`, 'warn');
  }
  // 처치한 캐릭터가 이 기기 것이면 무기 교체 (다른 기기 것은 그 기기가 처리)
  function killedBy(killer) { if (S && S.type === 'wdm' && mine(killer)) swapWeapon(killer); }

  // ---------- 매 프레임 ----------
  function update(dt) {
    if (!S) return;
    for (const c of CHARS) {
      if (!mine(c)) continue;
      if (!c.alive) { if (!S.over && c.respawnAt && G.time >= c.respawnAt) spawn(c); continue; }
      if (c.spawnProt && G.time > c.spawnProt) c.spawnProt = 0;
      if (c.hp < 100 && G.time - c.lastDamageT > DM_RULES.regenDelay) c.hp = Math.min(100, c.hp + DM_RULES.regenRate * dt);
      const wi = c.weapon; if (wi) { const a = ITEMS[wi.id].ammo, m = c.inv.magSize(wi); if (c.inv.count(a) < m * 2) c.inv.items[a] = m * 3; }
    }
    // 시간 종료 (점수 판정은 방장)
    if (!S.over && G.time >= DM_RULES.timeLimit && (!S.net || (G.netAuthority && G.netAuthority()))) {
      finish(S.score[0] === S.score[1] ? -1 : S.score[0] > S.score[1] ? 0 : 1);
      bcastScore();
    }
  }
  function finish(winner) {
    if (!S || S.over) return;
    S.over = true; S.winner = winner;
    const my = G.player ? G.player.team : 0;
    G.over = true; G.endT = 2.6; G.win = winner === my;
    if (winner === my) Audio.win(); else Audio.lose();
    HUD.toast(winner < 0 ? '시간 종료 — 무승부' : winner === my ? '승리!' : '패배', winner === my ? 'ok' : 'warn');
  }
  // 방장이 보낸 점수 적용 (같이 하기)
  function applyScore(score, over, winner, time) {
    if (!S) return;
    S.score[0] = score[0]; S.score[1] = score[1];
    if (time !== undefined && Math.abs(time - G.time) > 1.5) G.time = time;
    if (over && !S.over) finish(winner);
  }

  // ---------- 화면: 점수판 · 부활 대기 · 보호 ----------
  let lastKey = '';
  function hud() {
    if (!S || !G.player) return;
    const p = G.player, my = p.team, en = 1 - my, left = Math.max(0, DM_RULES.timeLimit - G.time);
    const key = `${S.score[my]}|${S.score[en]}|${Math.ceil(left)}|${p.kills}|${p.dmDeaths || 0}`;
    if (key !== lastKey) {
      lastKey = key;
      $('dmUs').textContent = S.score[my]; $('dmThem').textContent = S.score[en];
      $('dmUsBar').style.width = (S.score[my] / DM_RULES.killTarget * 100) + '%'; $('dmThemBar').style.width = (S.score[en] / DM_RULES.killTarget * 100) + '%';
      $('dmTime').textContent = fmtTime(left); $('dmTime').classList.toggle('low', left < 60);
      $('dmKd').textContent = `${p.kills}킬 · ${p.dmDeaths || 0}데스`;
      $('dmUsName').textContent = TEAM_NAMES[my]; $('dmThemName').textContent = TEAM_NAMES[en];
    }
    const rb = $('dmRespawn'), dead = !p.alive && !S.over && p.respawnAt;
    rb.hidden = !dead;
    if (dead) { const s = Math.max(0, p.respawnAt - G.time); const tx = s > 0.05 ? s.toFixed(1) : '0'; if ($('dmRespawnT').textContent !== tx) $('dmRespawnT').textContent = tx; }
    const pr = $('dmProt'), prot = p.alive && p.spawnProt > G.time; pr.hidden = !prot;
    if (prot) pr.textContent = `보호 중 ${(p.spawnProt - G.time).toFixed(1)}초`;
  }

  // ---------- 종료 → 결과·경험치 ----------
  function end() {
    if (!S) return;
    const p = G.player, my = p.team, en = 1 - my, win = S.winner === my, draw = S.winner < 0;
    G.state = 'result';
    const xp = Math.round(40 + p.kills * 15 + (win ? 120 : draw ? 40 : 0));
    G.lastXp = xp;
    STATS.xp += xp;
    const D = STATS.dm || (STATS.dm = Object.assign({}, DM_STATS0));
    D.matches++; D.kills += p.kills; D.deaths += S.myDeaths; if (win) D.wins++;
    STATS.recent.unshift({ dm: S.type, us: S.score[my], them: S.score[en], win, draw, kills: p.kills, deaths: S.myDeaths, time: Math.round(G.time), map: 'arena', party: S.net ? 1 : 0 });
    STATS.recent = STATS.recent.slice(0, 5);
    G.statsSaved = saveStats();
    showResult(win, draw);
  }
  function showResult(win, draw) {
    const p = G.player, my = p.team, en = 1 - my;
    $('resultPanel').hidden = false; releaseLock();
    $('resKicker').textContent = GAME_TYPES[S.type].name;
    $('resTitle').textContent = draw ? '무승부' : win ? `승리! ${TEAM_NAMES[my]} 팀이 먼저 ${S.score[my] >= DM_RULES.killTarget ? DM_RULES.killTarget + '킬' : '앞섰습니다'}` : `패배 — ${TEAM_NAMES[en]} 팀 승리`;
    $('resRank').textContent = `${S.score[my]} : ${S.score[en]}`; $('resOf').textContent = '';
    setResLabels(true);
    $('resKills').textContent = p.kills; $('resTime').textContent = S.myDeaths;
    $('resDmg').textContent = Math.round(p.damageDealt); $('resXp').textContent = '+' + G.lastXp;
    const mates = G.teams[my].members.slice().sort((a, b) => b.kills - a.kills);
    $('resNote').textContent = `팀 처치 순위: ${mates.map((m) => `${m.isPlayer ? '나' : m.name} ${m.kills}`).join(' · ')} — ${G.statsSaved ? '기록이 저장되었습니다.' : '이 브라우저에서는 기록이 저장되지 않았습니다.'}`;
    $('resRanked').hidden = true;
  }
  function setResLabels(dm) {
    const lab = (id, t) => { const e = $(id).previousElementSibling; if (e) e.textContent = t; };
    lab('resKills', '처치'); lab('resTime', dm ? '데스' : '생존 시간'); lab('resDmg', '가한 피해'); lab('resXp', '획득 경험치');
  }

  // ---------- 봇: 사냥 지점 (건물 대신 적 근처·아레나 곳곳) ----------
  function huntPoint(c) {
    const foes = CHARS.filter((o) => o.alive && o.team !== c.team && o.mode === 'ground');
    if (foes.length && Math.random() < 0.6) {
      const f = pick(foes), q = Nav.randomFreeNear(f.pos.x + rnd(-9, 9), f.pos.z + rnd(-9, 9), 6);
      if (q) return q;
    }
    return Nav.randomFreeNear(rnd(-30, 30), rnd(-22, 22), 6) || [rnd(-10, 10), rnd(-10, 10)];
  }

  function dispose() {
    S = null; G.dm = null; lastKey = '';
    document.body.classList.remove('dm');
    const sb = $('dmScore'); if (sb) sb.hidden = true;
    const rb = $('dmRespawn'); if (rb) rb.hidden = true;
    const pr = $('dmProt'); if (pr) pr.hidden = true;
    setResLabels(false);
  }
  return { start, update, hud, onDeath, killedBy, applyScore, finish, end, dispose, huntPoint, spawn, equip, swapWeapon, loadout, loName, TDM_GUNS, ALL_GUNS, TEAM_NAMES, get state() { return S; } };
})();
