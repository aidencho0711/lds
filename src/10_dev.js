// ============================================================
// 10_dev.js — 개발자 계정: 모든 스킨 + 개발자 도구
//  · 개발자 계정 = 로그인한 아이디가 DEV_IDS(00_config.js)에 있는 계정 (지금은 '개발자')
//  · 로그인할 때마다 옷·차량·총기 스킨을 모두 그 계정 기록에 넣는다 → 서버에 저장, 새 스킨이 생기면 다음 로그인 때 추가
//  · 개발자 도구: 로비 오른쪽 위 'DEV' 버튼 · 경기 중 메뉴 → '개발자 도구'
//    재화·레벨·출석·미션 / 경기: 무적 · 무한 탄약 · 총 지급(부착물·탄약 포함) · 장비 풀세트 · 차량 소환
//    · 지도 눌러 순간이동 · 자기장 멈춤 / 다음 단계 · 적 모두 탈락 / FPS·좌표 표시
//  · 같이 하기(파티) 경기에서는 경기 치트가 꺼진다 (다른 사람의 경기에 영향을 주지 않게)
//  · 켜고 끄는 값은 이 기기에만 저장(서버로 가지 않음)
//  · 한계: 재화·판정이 모두 기기에서 돌아가는 구조라 서버가 지켜 주는 권한이 아니다. 아이디는 먼저 가입한 사람이 가진다
// ============================================================
const Dev = (() => {
  const F = Object.assign({ god: false, ammo: false, tp: false, zone: false, stats: false }, store.get('dev', null) || {});
  const save = () => store.set('dev', F);
  const is = () => !!(Cloud.user && Cloud.name && DEV_IDS.includes(String(Cloud.name).normalize('NFC').trim().toLowerCase()));
  const inMatch = () => G.state === 'play' && !!G.player;
  const cheatsOk = () => is() && inMatch() && !G.net;
  const cheat = (k) => !!F[k] && is() && !G.net;   // 경기 코드에서 부르는 검사 (같이 하기에선 항상 꺼짐)
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  // ---------- 로그인 · 표시 ----------
  function onLogin() {
    if (!is()) return refresh();
    const n = Eco.devGrantAll();
    if (n) setTimeout(() => HUD.lobbyNote(`개발자 계정 — 스킨 ${n}개를 지급했습니다 (옷·차량·총기 전부)`), 400);
    refresh();
  }
  function refresh() {
    const on = is();
    const b = $('devBtn'); if (b) b.hidden = !on;
    const pb = $('devPauseBtn'); if (pb) pb.hidden = !on;
    const chip = $('acctChip'); if (chip) chip.classList.toggle('dev', on);
    const st = $('devStats'); if (st) st.hidden = !(on && F.stats);
    if (!on && !$('devPanel').hidden) close();
  }

  // ---------- 경기 치트 ----------
  const SCOPE_FOR = { SR: ['x6', 'x4', 'x3'], DMR: ['x4', 'x3', 'x2'] };
  function giveGun(id) {
    const p = G.player, d = ITEMS[id]; if (!p || !d || d.type !== 'weapon' || !p.alive) return '지금은 줄 수 없습니다';
    const w = newWeapon(id, d.mag);
    if (!w.att.scope) for (const s of SCOPE_FOR[d.cls] || ['reddot', 'holo', 'x2']) if (attFits(s, id)) { w.att.scope = s; break; }
    for (const a of ['comp', 'extmag', 'grip']) if (attFits(a, id)) w.att[ITEMS[a].slot] = a;
    w.mag = p.inv.magSize(w);
    const inv = p.inv; let slot;
    if (d.slot === 'secondary') slot = 2;
    else slot = !inv.weapons[0] ? 0 : !inv.weapons[1] ? 1 : inv.cur === 1 ? 1 : 0;
    inv.weapons[slot] = w; inv.cur = slot;
    inv.items[d.ammo] = (inv.items[d.ammo] || 0) + w.mag * 5;
    p.rl = null; p.cycle = null; p.equipT = 0.3; p.setVisibleGear(); HUD.refreshInventory();
    return `${d.name} 지급 (${[w.att.scope, w.att.muzzle, w.att.mag, w.att.grip].filter(Boolean).map((a) => ITEMS[a].name).join(' · ') || '부착물 없음'})`;
  }
  function kit() {
    const p = G.player; if (!p || !p.alive) return '지금은 줄 수 없습니다';
    const inv = p.inv;
    inv.gear = { helmet: { id: 'helm3', dur: ITEMS.helm3.dur }, vest: { id: 'vest3', dur: ITEMS.vest3.dur }, bag: { id: 'bag3' } };
    for (const [id, n] of [['medkit', 2], ['firstaid', 5], ['bandage', 10], ['drink', 5], ['frag', 3], ['smoke', 2]]) inv.items[id] = Math.max(inv.items[id] || 0, n);
    for (const w of inv.weapons) if (w) inv.items[ITEMS[w.id].ammo] = Math.max(inv.items[ITEMS[w.id].ammo] || 0, inv.magSize(w) * 5);
    p.hp = 100; p.boost = 100; p.setVisibleGear(); HUD.refreshInventory();
    return '헬멧·조끼·가방 3레벨 + 회복 아이템·수류탄 · 체력·부스트 가득';
  }
  function spawnVeh(type) {
    const p = G.player; if (!p || !p.alive || p.mode !== 'ground' || p.veh) return '땅에 서 있을 때만 소환할 수 있습니다';
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), x = p.pos.x + fx * 5, z = p.pos.z + fz * 5;
    Veh.make(type, x, z, p.yaw);
    return `${VEH_TYPES[type].name} 소환 (앞 5m)`;
  }
  // 적 모두 탈락 (비행기 안 포함). 처치 기록·알림이 쏟아지지 않게 처치자 없이 → 배틀로얄이면 바로 우승 화면
  function killAll() {
    const p = G.player; if (!p) return '';
    if (G.training) return '훈련장 더미는 쏴서 쓰러뜨리세요';
    let n = 0;
    for (const c of CHARS.slice()) if (c !== p && c.alive && !sameTeam(p, c)) { killChar(c, null, 'dev'); n++; }
    return n ? `적 ${n}명 탈락` : '남은 적이 없습니다';
  }
  function zoneNext() {
    if (G.training || G.dm || !Zone.cur) return '자기장이 없는 모드입니다';
    if (Zone.state === 'final') return '마지막 단계입니다';
    Zone.timer = Math.min(Zone.timer, 0.05);
    return Zone.state === 'wait' ? '자기장 축소를 바로 시작합니다' : '이번 축소를 바로 끝냅니다';
  }
  // 지도(전체 지도)를 짧게 누른 자리로 이동 — 순간이동이 켜져 있을 때. 처리했으면 true
  function mapTap(x, z) {
    if (!cheat('tp') || !inMatch()) return false;
    const p = G.player; if (!p.alive || p.mode !== 'ground') { HUD.toast('땅에 있을 때만 순간이동할 수 있습니다', 'warn'); return true; }
    if (p.veh) Veh.exit(p, true, true);
    const lim = HALF - 2; x = clamp(x, -lim, lim); z = clamp(z, -lim, lim);
    p.pos.set(x, groundAt(x, z, 999) + 0.05, z); p.vel.set(0, 0, 0); p.onGround = true;
    HUD.closeMap(); HUD.toast(`순간이동 (${Math.round(x)}, ${Math.round(z)})`, 'ok');
    return true;
  }

  // ---------- FPS · 좌표 ----------
  let fpsN = 0, fpsT = 0, fpsMs = 0, fps = 0, statT = 0;
  function frame() {
    if (!F.stats) return;
    const now = performance.now();
    if (fpsT) { fpsN++; fpsMs += now - fpsT; }
    fpsT = now;
    if (now - statT < 300) return;
    statT = now; const el = $('devStats'); if (!el || el.hidden) return;
    if (fpsN) { fps = 1000 / (fpsMs / fpsN); } const ms = fpsN ? fpsMs / fpsN : 0; fpsN = 0; fpsMs = 0;
    const p = G.player, inf = G.renderer && G.renderer.info;
    let t = `FPS ${fps.toFixed(0)} · ${ms.toFixed(1)}ms`;
    if (G.state === 'play' && p) t += ` · X ${p.pos.x.toFixed(1)} Y ${p.pos.y.toFixed(1)} Z ${p.pos.z.toFixed(1)} · 생존 ${CHARS.filter((c) => c.alive).length}`;
    if (inf) t += ` · 메모리 ${inf.memory.geometries}/${inf.memory.textures}`;
    el.textContent = t;
  }

  // ---------- 패널 ----------
  function close() { $('devPanel').hidden = true; }
  function open() { if (!is()) return; render(); $('devPanel').hidden = false; Audio.ui(); }
  function render() {
    const box = $('devBody'); if (!box) return;
    box.innerHTML = '';
    const msg = h('p', 'dev-msg'); msg.id = 'devMsg';
    const say = (t, ok = true) => { msg.textContent = t || ''; msg.className = 'dev-msg' + (ok ? ' ok' : ' bad'); };
    const sec = (title, note) => { const s = h('div', 'dev-sec'); s.appendChild(h('div', 'dev-h', title)); if (note) s.appendChild(h('div', 'dev-note', note)); box.appendChild(s); const r = h('div', 'dev-row'); s.appendChild(r); return r; };
    const btn = (row, label, fn, opt = {}) => {
      const b = h('button', 'btn' + (opt.on !== undefined ? ' dev-tg' + (opt.on ? ' on' : '') : '')); b.type = 'button'; b.textContent = label; if (opt.dis) b.disabled = true;
      b.addEventListener('click', () => { Audio.ui(); const r = fn(); if (typeof r === 'string') say(r); render2(); });
      row.appendChild(b); return b;
    };
    const tg = (row, k, label, needMatch = true) => btn(row, label + (F[k] ? ' 켬' : ' 끔'), () => { F[k] = !F[k]; save(); refresh(); return `${label} ${F[k] ? '켬' : '끔'}`; }, { on: F[k], dis: needMatch && !!G.net });
    let render2 = () => {};
    const L = levelFromXp(STATS.xp || 0), own = (o, all) => `${o}/${all}`;
    box.appendChild(h('div', 'dev-who', `개발자 계정: ${Cloud.name} · 옷 ${own(Eco.ownedSkins().size, Object.keys(Body.SKINS).length)} · 차량 ${own((STATS.vskins || []).length, Object.keys(VSKINS).length)} · 총기 ${own((STATS.gskins || []).length, Object.keys(GSKINS).length)}`));
    // 재화·레벨·미션 (로비·경기 어디서나)
    let r = sec('재화', `골드 탄피 ${Eco.gold.toLocaleString()} · 차량 코인 ${Eco.coin} · 총기 코인 ${Eco.gcoin}`);
    btn(r, `${GOLD_NAME} +10,000`, () => { Eco.devAdd('gold', 10000); return `${GOLD_NAME} +10,000`; });
    btn(r, '차량 코인 +100', () => { Eco.devAdd('coin', 100); return '차량 교환 코인 +100'; });
    btn(r, '총기 코인 +100', () => { Eco.devAdd('gcoin', 100); return '총기 교환 코인 +100'; });
    r = sec('레벨 · 미션', `지금 레벨 ${L.lv} (${L.cur}/${L.need} XP)`);
    const lvUp = (k) => { for (let i = 0; i < k; i++) { const l = levelFromXp(STATS.xp || 0); STATS.xp = (STATS.xp || 0) + (l.need - l.cur); } saveStats(); HUD.renderLobby(); return `레벨 ${levelFromXp(STATS.xp).lv}`; };
    btn(r, '레벨 +1', () => lvUp(1)); btn(r, '레벨 +5', () => lvUp(5));
    btn(r, '출석 다시 받기', () => { Eco.devAttend(); HUD.renderLobby(); return '오늘 출석 보상을 다시 받을 수 있습니다'; });
    btn(r, '미션 모두 완료', () => { Eco.devQuests(); HUD.renderLobby(); return '일일·주간 미션을 모두 완료 상태로 (보상은 미션 탭에서 받기)'; });
    btn(r, '스킨 다시 지급', () => { const n = Eco.devGrantAll(); return n ? `스킨 ${n}개 지급` : '이미 모든 스킨을 가지고 있습니다'; });
    // 경기
    const note = !inMatch() ? '경기·훈련장·데스매치 중에 메뉴 → 개발자 도구에서 씁니다. 켜고 끄는 항목은 여기서 미리 켜 둘 수 있습니다'
      : G.net ? '같이 하기 경기에서는 꺼집니다 (다른 사람의 경기에 영향을 주지 않게)' : '이 경기에서 바로 적용';
    r = sec('경기', note);
    tg(r, 'god', '무적'); tg(r, 'ammo', '무한 탄약'); tg(r, 'tp', '지도 눌러 순간이동'); tg(r, 'zone', '자기장 멈춤');
    const off = !cheatsOk();
    const r2 = h('div', 'dev-row'); r.parentNode.appendChild(r2);
    const gsel = h('select', 'dev-sel'); const byCls = {};
    for (const id in ITEMS) { const d = ITEMS[id]; if (d.type === 'weapon') (byCls[d.cls] = byCls[d.cls] || []).push(id); }
    for (const cls of ['AR', 'SMG', 'SG', 'DMR', 'SR', 'LMG', 'PISTOL']) { if (!byCls[cls]) continue; const og = document.createElement('optgroup'); og.label = cls; for (const id of byCls[cls]) { const o = document.createElement('option'); o.value = id; o.textContent = ITEMS[id].name; og.appendChild(o); } gsel.appendChild(og); }
    gsel.value = F.gun && ITEMS[F.gun] ? F.gun : 'm416'; gsel.disabled = off; gsel.addEventListener('change', () => { F.gun = gsel.value; save(); });
    r2.appendChild(gsel); btn(r2, '총 지급', () => giveGun(gsel.value), { dis: off });
    const r3 = h('div', 'dev-row'); r.parentNode.appendChild(r3);
    const vsel = h('select', 'dev-sel');
    for (const k in VEH_TYPES) { const o = document.createElement('option'); o.value = k; o.textContent = VEH_TYPES[k].name; vsel.appendChild(o); }
    vsel.value = F.veh && VEH_TYPES[F.veh] ? F.veh : 'uaz'; vsel.disabled = off; vsel.addEventListener('change', () => { F.veh = vsel.value; save(); });
    r3.appendChild(vsel); btn(r3, '차량 소환', () => spawnVeh(vsel.value), { dis: off });
    const r4 = h('div', 'dev-row'); r.parentNode.appendChild(r4);
    btn(r4, '장비 풀세트', kit, { dis: off });
    btn(r4, '자기장 다음 단계', zoneNext, { dis: off || G.training || !!G.dm });
    btn(r4, '적 모두 탈락', killAll, { dis: off || G.training });
    // 표시
    r = sec('표시');
    tg(r, 'stats', 'FPS·좌표 표시', false);
    box.appendChild(msg);
    render2 = () => { const keep = msg.textContent, cls = msg.className; render(); const m = $('devMsg'); if (m) { m.textContent = keep; m.className = cls; } };
  }
  function setup() {
    $('devBtn').addEventListener('click', () => { Audio.init(); open(); });
    $('devClose').addEventListener('click', () => { Audio.ui(); close(); });
    refresh();
  }
  return { is, cheat, onLogin, refresh, open, close, setup, frame, mapTap, flags: F, _giveGun: giveGun, _kit: kit, _spawnVeh: spawnVeh, _killAll: killAll };
})();
