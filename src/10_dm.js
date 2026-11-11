// ============================================================
// 10_dm.js — 팀 데스매치 / 웨폰 데스매치 (4 대 4, 컨테이너 야드)
//  · 먼저 40킬 한 팀 승리. 10분이 지나면 킬이 많은 팀 승리(같으면 무승부)
//  · 죽으면 3초 뒤 자기 팀 출발 구역에서 부활(적에게서 가장 먼 자리), 부활 직후 2초 보호(쏘면 해제)
//  · 4초 동안 안 맞으면 체력 회복, 탄약은 자동 보충, 모두 Lv2 헬멧·조끼(부활 때 새것)
//  · 팀 데스매치: 경기 시작 때 고른 총 1종 + 스코프 1종을 전원이 같이 씀
//  · 웨폰 데스매치: 처치할 때마다 자기 총·스코프가 무작위로 바뀜(직전과 다른 것). 죽어도 지금 총은 유지
//  · 같이 하기(파티): 방장이 경기를 열고 점수·시간을 정한다. 각자 자기 캐릭터의 부활·무기 교체를 처리
//  · v20 대결(1대1·2대2, GAME_TYPES.duel1·duel2): 같은 아레나에서 라운드제 — 먼저 4라운드, 라운드 90초
//    준비 3초(움직이거나 쏠 수 없음, 보호) → 싸움(죽으면 그 라운드는 끝까지 관전, 체력 회복 없음) → 한 팀이 전멸하거나 시간이 끝나면
//    (남은 인원 → 남은 체력 합으로) 승패 → 3.5초 쉬고 다음 라운드(전원 부활 · 새 무작위 총, 모두 같은 총)
//    라운드 진행은 방장(혼자면 나)이 정하고 'duel' 사건으로 알린다. 각 기기는 자기 캐릭터만 부활시킨다
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
  const loName = (lo) => ITEMS[lo.id].name + (lo.scope ? ' + ' + ITEMS[lo.scope].name : ITEMS[lo.id].fixedScope ? ' + ' + ITEMS[lo.id].fixedScope.name : '');

  // ---------- 시작 ----------
  // cfg(같이 하기): { type, seed, roster:[{id,name,team,slot,human,look,diff,owner}], loadout, myId }
  async function start(cfg) {
    if (G.state === 'loading') return;
    cfg = cfg || {};
    const type = cfg.type || (isDmGame(SETTINGS.game) ? SETTINGS.game : 'tdm');
    G.state = 'loading'; G.paused = false; G.over = false; G.training = false; G.dm = null;
    document.body.classList.remove('training');
    Audio.music(false);
    $('lobby').hidden = true; $('resultPanel').hidden = true; $('hud').hidden = true; $('loading').hidden = false; Shop.closeAll();
    const duel = isDuel(type) ? GAME_TYPES[type].duel : 0, TSZ = dmTeamSize(type);
    $('loadMap').textContent = `${GAME_TYPES[type].name} · ${MAPS.arena.name}`;
    $('loadTip').textContent = duel ? `${GAME_TYPES[type].name}: 라운드마다 모두 같은 무작위 총으로 싸웁니다. 죽으면 그 라운드는 관전, 먼저 ${DUEL_RULES.win}라운드를 이기는 팀이 승리합니다.`
      : type === 'tdm' ? '팀 데스매치: 모두 같은 총으로 싸웁니다. 먼저 40킬 하는 팀이 이깁니다.' : '웨폰 데스매치: 적을 처치할 때마다 총과 스코프가 바뀝니다. 먼저 40킬 하는 팀이 이깁니다.';
    const prog = (p, label) => { $('loadBar').style.width = Math.round(p * 100) + '%'; $('loadStep').textContent = label; };
    disposeMatch();
    const sc = new THREE.Scene(); G.scene = sc;
    const t = TIMES[SETTINGS.time], Q = QUALITY[SETTINGS.quality], far = Math.min(Q.far, 300);
    G.sky = skyDome(t, far * 0.92); sc.add(G.sky); sc.fog = new THREE.Fog(t.fog, far * 0.35, far); G.fogK = [0.35, 1];
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
    G.teamOrder = null; G.spotted = new Map(); G.danger = null; G.ranked = false; G.hc = false; G.quit = false; G.rankResult = null;
    G.teamSize = TSZ; G.teams = [{ id: 0, members: [], place: 0 }, { id: 1, members: [], place: 0 }];
    const seed = cfg.seed || ((Math.random() * 1e9) | 0);
    const rand = mulberry32(seed);
    S = { type, seed, rand, score: [0, 0], over: false, winner: null, loadout: null, myDeaths: 0, net: !!cfg.roster, duel, round: duel ? { n: 1, ph: 'prep', t0: 0 } : null, lastWin: null };
    S.loadout = cfg.loadout || (type === 'tdm' || duel ? loadout(rand, TDM_GUNS, null) : null);
    G.dm = S; G.frozen = !!duel;
    // 참가자: 혼자면 나 + 봇(데스매치 7명 · 대결은 팀 크기만큼). 같이 하기면 방장이 정한 명단
    const roster = cfg.roster || defaultRoster(TSZ);
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    // 봇 난이도·스킨 (07_bot_skin.js): 혼자면 여기서 정하고, 같이 하기면 방장이 명단에 적은 난이도(r.diff)로 모든 기기에서 같게
    if (!cfg.roster) for (const r of roster) if (!r.human && !r.diff) r.diff = botDiff();
    const BP = BotSkin.pool([...new Set(roster.filter((r) => !r.human && r.diff).map((r) => r.diff))], seed); G.botLooks = [];
    roster.forEach((r, i) => {
      const me = cfg.roster ? r.id === cfg.myId : r.human;
      const hl = r.human ? (r.look || (me ? myLook() : {})) : null, sk = !hl && r.diff ? BotSkin.forBot(BP, r.diff, seed, r.id) : null;
      const look = hl ? Body.makeLook(hl.eq, hl.body) : sk ? sk.look : Body.makeLook(null, Body.randomBody(mulberry32((seed + 7919 * (r.id + 1)) | 0)));
      const c = new Character({ id: r.id, name: r.name || names[i % names.length], isPlayer: me, look, team: r.team });
      if (hl) c.glook = hl.gun || (me ? Eco.glook() : null);   // 총기 스킨
      if (sk) { c.glook = sk.gun; G.botLooks.push(look); }
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
    $('dmScore').hidden = false; $('dmGoal').textContent = duel ? `먼저 ${DUEL_RULES.win}라운드` : `먼저 ${DM_RULES.killTarget}킬`;
    $('loading').hidden = true; $('hud').hidden = false; $('touch').hidden = !IS_TOUCH;
    G.state = 'play'; G.previewT = 0;
    Audio.wind(0.04);
    const my = G.player.team;
    HUD.toast(duel ? `${GAME_TYPES[type].name} — ${TEAM_NAMES[my]} 팀 · 먼저 ${DUEL_RULES.win}라운드` : `${GAME_TYPES[type].name} — ${TEAM_NAMES[my]} 팀 · 먼저 ${DM_RULES.killTarget}킬`, 'info');
    if (duel) banner(`라운드 1 · ${loName(S.loadout)}`, 'prep');
    else if (type === 'tdm') { const s0 = S; setTimeout(() => s0 && G.dm === s0 && HUD.toast(`이번 판 무기: ${loName(s0.loadout)}`, 'ok'), 1600); }   // 1.6초 안에 나가면 S가 비어 있으므로 시작한 판을 붙잡아 둔다
    else setTimeout(() => G.dm === S && G.player && G.player.dmLoad && HUD.toast(`시작 무기: ${loName(G.player.dmLoad)} — 처치할 때마다 바뀝니다`, 'ok'), 1600);
    if (G.net) Net.ready();
  }
  // 같이 하기: 방장이 점수·종료를 알린다
  function bcastScore() { if (G.net && Net.isHost()) Net.ev({ k: 'score', sc: S.score.slice(), over: S.over, win: S.winner, t: Math.round(G.time * 100) / 100 }); }
  const botDiff = () => SETTINGS.difficulty === 'mixed' ? pick(['easy', 'normal', 'normal', 'hard']) : SETTINGS.difficulty;
  function defaultRoster(ts = DM_RULES.teamSize) {
    const r = [{ id: 0, team: 0, human: true, name: playerName() }];
    for (let i = 1; i < ts * 2; i++) r.push({ id: i, team: i < ts ? 0 : 1 });
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
    // 대결: 준비 시간 동안 보호(싸움이 시작되면 해제) / 데스매치: 부활 직후 2초
    c.spawnProt = S.duel ? G.time + 999 : G.time + DM_RULES.protect; c.life = (c.life || 0) + 1;
    equip(c, S.type === 'tdm' || S.duel ? S.loadout : (c.dmLoad || (c.dmLoad = loadout(Math.random, ALL_GUNS, null))), true);
    if (c.brain) resetBrain(c.brain);
    if (c.isPlayer) { Cam.ads = 0; Input.fire = false; G.spec = null; if (!first && !S.duel) HUD.toast('부활 — 2초 동안 보호됩니다 (쏘면 해제)', 'info'); }
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
    if (S.duel) {
      // 대결: 그 라운드는 부활 없음 — 내가 죽으면 살아 있는 팀원(없으면 처치한 적)을 관전
      t.dmDeaths = (t.dmDeaths || 0) + 1; t.respawnAt = 0;
      if (t.isPlayer) {
        S.myDeaths++;
        const mate = CHARS.find((c) => c.alive && c !== t && c.team === t.team);
        G.spec = mate || (killer && killer !== t && killer.alive ? killer : null);
        if (!S.over) HUD.toast(`${killer && killer !== t ? killer.name + '에게 처치됨' : '쓰러졌습니다'} — 라운드가 끝나면 다시 시작합니다`, 'warn');
      }
      return;
    }
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

  // ---------- 대결: 라운드 진행 ----------
  //  방장(혼자면 나)이 단계를 바꾸고 알림 → 모든 기기가 applyDuel로 같은 단계로. 새 라운드는 각자 자기 캐릭터를 부활
  const auth = () => !S.net || (G.netAuthority && G.netAuthority());
  function duelEvent(ph, extra) {
    const e = Object.assign({ k: 'duel', r: S.round.n, ph, t: Math.round(G.time * 100) / 100, sc: S.score.slice(), w: S.lastWin }, extra || {});
    applyDuel(e);
    if (G.net && Net.isHost()) { const o = Object.assign({}, e); delete o.k; Net.ev(Object.assign({ k: 'duel' }, o)); }
  }
  // 라운드 승패: 남은 인원 → 같으면 남은 체력 합 → 같으면 무승부(-1)
  function roundWinner(timeout) {
    const alive = [0, 0], hp = [0, 0];
    for (const c of CHARS) if (c.alive && c.mode === 'ground') { alive[c.team]++; hp[c.team] += c.hp; }
    if (!timeout) return alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : !alive[0] && !alive[1] ? -1 : null;
    if (alive[0] !== alive[1]) return alive[0] > alive[1] ? 0 : 1;
    return Math.abs(hp[0] - hp[1]) < 0.5 ? -1 : hp[0] > hp[1] ? 0 : 1;
  }
  function duelUpdate(dt) {
    const R = S.round;
    G.frozen = R.ph !== 'fight';
    for (const c of CHARS) {
      if (!mine(c) || !c.alive) continue;
      const wi = c.weapon; if (wi) { const a = ITEMS[wi.id].ammo, m = c.inv.magSize(wi); if (c.inv.count(a) < m * 2) c.inv.items[a] = m * 3; }   // 탄약만 보충 (체력 회복 없음)
    }
    if (S.over || !auth()) return;
    const el = G.time - R.t0;
    if (R.ph === 'prep' && el >= DUEL_RULES.prep) duelEvent('fight');
    else if (R.ph === 'fight') {
      const w = el >= DUEL_RULES.round ? roundWinner(true) : roundWinner(false);
      if (w !== null) {
        if (w >= 0) S.score[w]++;
        S.lastWin = w;
        const over = w >= 0 && S.score[w] >= DUEL_RULES.win;
        duelEvent('gap', over ? { over: true, win: w } : null);
      }
    } else if (R.ph === 'gap' && el >= DUEL_RULES.gap && !S.over) {
      const lo = loadout(Math.random, TDM_GUNS, S.loadout);
      S.round.n++; duelEvent('prep', { lo });
    }
  }
  // 라운드 단계 적용 (방장 자신도 이 함수로)
  function applyDuel(e) {
    if (!S || !S.duel) return;
    const R = S.round;
    if (e.r < R.n || (e.r === R.n && e.ph === R.ph && !(e.over && !S.over))) return;   // 이미 반영됨 / 늦게 온 옛 단계
    S.score[0] = e.sc[0]; S.score[1] = e.sc[1]; S.lastWin = e.w === undefined ? S.lastWin : e.w;
    if (e.t !== undefined && Math.abs(e.t - G.time) > 1.5) G.time = e.t;
    R.n = e.r; R.ph = e.ph; R.t0 = e.t !== undefined ? e.t : G.time;
    G.frozen = R.ph !== 'fight';
    const my = G.player ? G.player.team : 0;
    if (e.ph === 'prep') {
      if (e.lo) S.loadout = e.lo;
      for (const c of CHARS) if (mine(c)) spawn(c, true);
      banner(`라운드 ${R.n} · ${loName(S.loadout)}`, 'prep');
    } else if (e.ph === 'fight') {
      for (const c of CHARS) if (mine(c) && c.alive) c.spawnProt = 0;
      banner('시작!', 'go'); Audio.ui();
    } else if (e.ph === 'gap') {
      const w = S.lastWin;
      banner(w < 0 ? `라운드 ${R.n} 무승부` : w === my ? `라운드 ${R.n} 승리` : `라운드 ${R.n} 패배`, w < 0 ? 'draw' : w === my ? 'win' : 'lose');
      if (e.over && !S.over) finish(e.win);
    }
  }
  // 가운데 큰 글씨 (라운드 시작·승패)
  let bannerT = 0;
  function banner(text, cls) {
    const b = $('duelBanner'); if (!b) return;
    b.textContent = text; b.className = cls || ''; b.hidden = false; bannerT = G.time + (cls === 'prep' ? DUEL_RULES.prep : 2.2);
  }

  // ---------- 매 프레임 ----------
  function update(dt) {
    if (!S) return;
    if (S.duel) { duelUpdate(dt); return; }
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
    const p = G.player, my = p.team, en = 1 - my, R = S.round;
    // 대결: 점수 = 이긴 라운드, 시간 = 이번 라운드 남은 시간(준비 중엔 라운드 길이)
    const left = S.duel ? (R.ph === 'fight' ? Math.max(0, DUEL_RULES.round - (G.time - R.t0)) : R.ph === 'prep' ? DUEL_RULES.round : 0) : Math.max(0, DM_RULES.timeLimit - G.time);
    const goal = S.duel ? DUEL_RULES.win : DM_RULES.killTarget;
    if (S.duel) {
      const bn = $('duelBanner');
      if (bn && !bn.hidden) {
        if (R.ph === 'prep') { const s = Math.max(1, Math.ceil(DUEL_RULES.prep - (G.time - R.t0))), tx = `라운드 ${R.n} · ${loName(S.loadout)} · ${s}`; if (bn.textContent !== tx) bn.textContent = tx; }
        else if (G.time > bannerT) bn.hidden = true;
      }
    }
    const key = `${S.score[my]}|${S.score[en]}|${Math.ceil(left)}|${p.kills}|${p.dmDeaths || 0}`;
    if (key !== lastKey) {
      lastKey = key;
      $('dmUs').textContent = S.score[my]; $('dmThem').textContent = S.score[en];
      $('dmUsBar').style.width = (S.score[my] / goal * 100) + '%'; $('dmThemBar').style.width = (S.score[en] / goal * 100) + '%';
      $('dmTime').textContent = fmtTime(left); $('dmTime').classList.toggle('low', left < (S.duel ? 15 : 60));
      $('dmKd').textContent = `${p.kills}킬 · ${p.dmDeaths || 0}데스`;
      $('dmUsName').textContent = TEAM_NAMES[my]; $('dmThemName').textContent = TEAM_NAMES[en];
    }
    const rb = $('dmRespawn'), dead = !p.alive && !S.over && p.respawnAt;
    rb.hidden = !dead;
    if (dead) { const s = Math.max(0, p.respawnAt - G.time); const tx = s > 0.05 ? s.toFixed(1) : '0'; if ($('dmRespawnT').textContent !== tx) $('dmRespawnT').textContent = tx; }
    const pr = $('dmProt'), prot = p.alive && p.spawnProt > G.time && !S.duel; pr.hidden = !prot;   // 대결 준비 중 보호는 배너로 대신
    if (prot) pr.textContent = `보호 중 ${(p.spawnProt - G.time).toFixed(1)}초`;
  }

  // ---------- 종료 → 결과·경험치 ----------
  function end() {
    if (!S) return;
    const p = G.player, my = p.team, en = 1 - my, win = S.winner === my, draw = S.winner < 0;
    G.state = 'result';
    const xp = Math.round(40 + p.kills * 15 + (win ? 120 : draw ? 40 : 0) + (S.duel ? S.score[my] * 15 : 0));
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
    if (S.duel) {
      // 대결 결과: 라운드 점수 · 양 팀 명단(처치·데스)
      const vs = (t) => G.teams[t].members.map((m) => `${m.isPlayer ? '나' : m.name} ${m.kills}킬 ${m.dmDeaths || 0}데스`).join(', ');
      $('resTitle').textContent = draw ? '무승부' : win ? `승리! ${S.score[my]}라운드 선취` : `패배 — ${TEAM_NAMES[en]} 팀이 ${S.score[en]}라운드 선취`;
      $('resNote').textContent = `${TEAM_NAMES[my]}(우리): ${vs(my)} / ${TEAM_NAMES[en]}: ${vs(en)} · ${S.round.n}라운드 — ${G.statsSaved ? '기록이 저장되었습니다.' : '이 브라우저에서는 기록이 저장되지 않았습니다.'}`;
    } else {
      $('resTitle').textContent = draw ? '무승부' : win ? `승리! ${TEAM_NAMES[my]} 팀이 먼저 ${S.score[my] >= DM_RULES.killTarget ? DM_RULES.killTarget + '킬' : '앞섰습니다'}` : `패배 — ${TEAM_NAMES[en]} 팀 승리`;
      const mates = G.teams[my].members.slice().sort((a, b) => b.kills - a.kills);
      $('resNote').textContent = `팀 처치 순위: ${mates.map((m) => `${m.isPlayer ? '나' : m.name} ${m.kills}`).join(' · ')} — ${G.statsSaved ? '기록이 저장되었습니다.' : '이 브라우저에서는 기록이 저장되지 않았습니다.'}`;
    }
    $('resRank').textContent = `${S.score[my]} : ${S.score[en]}`; $('resOf').textContent = S.duel ? '라운드' : '';
    setResLabels(true);
    $('resKills').textContent = p.kills; $('resTime').textContent = S.myDeaths;
    $('resDmg').textContent = Math.round(p.damageDealt); $('resXp').textContent = '+' + G.lastXp;
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
    S = null; G.dm = null; G.frozen = false; lastKey = '';
    const bn = $('duelBanner'); if (bn) bn.hidden = true;
    document.body.classList.remove('dm');
    const sb = $('dmScore'); if (sb) sb.hidden = true;
    const rb = $('dmRespawn'); if (rb) rb.hidden = true;
    const pr = $('dmProt'); if (pr) pr.hidden = true;
    setResLabels(false);
  }
  return { start, update, hud, onDeath, killedBy, applyScore, applyDuel, finish, end, dispose, huntPoint, spawn, equip, swapWeapon, loadout, loName, TDM_GUNS, ALL_GUNS, TEAM_NAMES, get state() { return S; } };
})();
