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

  // ---------- 계정 관리 (서버 함수 — supabase/admin.sql) ----------
  //  목록(최근 저장 순·이름 검색) · 골드 탄피 지급 · 기록 초기화 · 계정 삭제. 초기화·삭제는 두 번 눌러야 실행
  const ACC = { q: '', list: null, err: '', busy: false, amt: 10000, sure: '', sureT: null, msg: '', sel: '', det: {} };
  const rpcErr = (e) => { const m = String((e && e.message) || e || ''); return e && e.code === 'PGRST202' || /could not find|does not exist/i.test(m) ? '서버 설정 필요: Supabase SQL Editor에서 supabase/admin.sql 을 실행해 주세요' : /not admin/i.test(m) ? '관리자로 등록되지 않은 계정입니다 (이 계정이 있는 상태에서 admin.sql 을 실행해야 등록됨)' : Cloud.msgOf(e); };
  const RES = { denied: '관리자만 할 수 있습니다', self: '자기 계정은 지울 수 없습니다', admin: '다른 관리자 계정은 지울 수 없습니다', notfound: '없는 계정입니다', amount: '지급 양이 올바르지 않습니다 (1 ~ 1,000,000)' };
  async function accLoad() {
    const sb = Cloud.client(); if (!sb || !Cloud.user) { ACC.err = '로그인이 필요합니다'; renderAcc(); return; }
    ACC.busy = true; ACC.err = ''; renderAcc();
    try { const { data, error } = await sb.rpc('admin_list', { p_q: ACC.q }); if (error) throw error; ACC.list = data || []; }
    catch (e) { ACC.err = rpcErr(e); ACC.list = null; }
    ACC.busy = false; renderAcc();
  }
  async function accDo(fn, args, okMsg) {
    const sb = Cloud.client(); if (!sb) return;
    ACC.busy = true; ACC.msg = '처리 중…'; renderAcc();
    try { const { data, error } = await sb.rpc(fn, args); if (error) throw error; ACC.msg = data === 'ok' ? okMsg : RES[data] || `실패: ${data}`; }
    catch (e) { ACC.msg = rpcErr(e); }
    ACC.busy = false; ACC.det = {}; await accLoad();
  }
  // ---------- 계정 상세 (목록에서 계정을 누르면 그 아래에 펼침) ----------
  //  서버 함수 admin_get 이 있으면 전체 기록(stats·rank)까지, 없으면(옛 admin.sql) 목록 값만 보여 준다
  async function detLoad(u) {
    const sb = Cloud.client(); if (!sb) return;
    ACC.det[u.id] = { busy: true }; renderAcc();
    try { const { data, error } = await sb.rpc('admin_get', { p_id: u.id }); if (error) throw error; ACC.det[u.id] = data ? { d: data } : { err: '없는 계정입니다' }; }
    catch (e) { ACC.det[u.id] = e && e.code === 'PGRST202' || /could not find|does not exist/i.test(String((e && e.message) || '')) ? { old: true } : { err: rpcErr(e) }; }
    if (ACC.sel === u.id) renderAcc();
  }
  const fmtT = (t, y) => t ? new Date(t).toLocaleString('ko-KR', Object.assign(y ? { year: '2-digit' } : {}, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : '-';
  const agoT = (t) => { if (!t) return ''; const s = (Date.now() - new Date(t).getTime()) / 1000; return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
  // 접속 상태: 로비 채널 presence (Social.online) — 내 계정은 항상 접속 중
  function onlineOf(id) {
    if (id === Cloud.uid) return { on: true, st: G.state === 'play' ? 'game' : 'lobby' };
    const o = Social.online && Social.online.get(id); return o ? { on: true, st: o.st, pn: o.pn } : { on: false };
  }
  const lastT = (x, u) => Math.max(x.last_sign_in_at ? +new Date(x.last_sign_in_at) : 0, u.updated_at ? +new Date(u.updated_at) : 0);   // 마지막 흔적 = 로그인·저장 중 늦은 쪽
  const onlineText = (o) => !o.on ? '오프라인' : o.st === 'game' ? '게임 중' : '로비' + (o.pn > 1 ? ` · 파티 ${o.pn}명` : '');
  function detailCard(u) {
    const D = ACC.det[u.id] || {}, box = h('div', 'acc-det');
    if (D.busy) { box.appendChild(h('div', 'dev-note', '상세 정보 불러오는 중…')); return box; }
    if (D.err) { box.appendChild(h('div', 'dev-note bad', D.err)); return box; }
    const x = D.d || {}, S = x.stats || {}, R = Object.assign({ rp: u.rp || 0, placed: 0, games: 0, wins: 0, peak: 0 }, x.rank || {});
    const xp = S.xp != null ? S.xp : u.xp || 0, L = levelFromXp(xp), m = S.matches != null ? S.matches : u.matches, w = S.wins != null ? S.wins : u.wins, k = S.kills != null ? S.kills : u.kills;
    const E = S.eco || {}, P = S.prof || {}, on = onlineOf(u.id);
    // 머리: 계정 사진 · 이름 · 칭호 · 접속 상태
    const hd = h('div', 'acc-dh');
    const pf = h('div', 'acc-dpf'); pf.innerHTML = Prof.frameHTML(P.fr || 'none', P.av || 'helmet', 54); hd.appendChild(pf);
    const nm = h('div', 'acc-dn'); nm.appendChild(h('b', '', u.username + (u.admin ? ' ★관리자' : '')));
    if (P.ti) { const t = h('div', ''); t.innerHTML = Prof.titleHTML(P.ti, 'sm'); nm.appendChild(t); }
    const st = h('span', 'acc-on ' + (on.on ? on.st === 'game' ? 'game' : 'on' : 'off'), (on.on ? '● ' : '○ ') + onlineText(on) + (on.on || !lastT(x, u) ? '' : ` · 마지막 접속 ${agoT(lastT(x, u))}`));
    nm.appendChild(st); hd.appendChild(nm);
    // 티어: 엠블럼 + 이름 (레벨 3 미만 = 잠김, 배치 3판 전 = 배치고사)
    const ti = Rank.tierOf(R.rp), lock = L.lv < 3, plc = !lock && (D.d ? (R.placed || 0) < 3 : !u.rp);
    const tierBox = h('div', 'acc-dtier');
    const em = h('img', ''); em.alt = ''; em.src = lock ? Rank.emblem(-2, 0, 96) : plc ? Rank.emblem(-1, 0, 96) : Rank.emblem(ti.t, ti.div, 96); tierBox.appendChild(em);
    const tl = h('div', ''); tl.appendChild(h('b', '', lock ? '랭크 잠김' : plc ? '배치고사' : ti.label));
    tl.appendChild(h('small', '', lock ? '레벨 3부터' : plc ? `${R.placed || 0} / 3 완료` : `${R.rp} RP` + (R.peak > R.rp ? ` · 최고 ${Rank.tierOf(R.peak).label}` : '')));
    tierBox.appendChild(tl); hd.appendChild(tierBox);
    box.appendChild(hd);
    // 레벨 막대
    const lvb = h('div', 'acc-dlv'); lvb.appendChild(h('b', '', `Lv ${L.lv}`));
    const bar = h('div', 'acc-bar'), fill = h('i', ''); fill.style.width = (100 * L.cur / L.need).toFixed(1) + '%'; bar.appendChild(fill); lvb.appendChild(bar);
    lvb.appendChild(h('small', '', `${L.cur.toLocaleString()} / ${L.need.toLocaleString()} XP · 누적 ${xp.toLocaleString()}`)); box.appendChild(lvb);
    // 숫자 칸
    const grid = h('div', 'acc-grid');
    const cell = (k2, v) => { const c = h('div', 'acc-cell'); c.appendChild(h('small', '', k2)); c.appendChild(h('b', '', String(v))); grid.appendChild(c); };
    const own = (arr, tab) => { const L2 = (arr || []).filter((id) => tab[id]); return `${L2.length}종` + (L2.some((id) => tab[id].rar >= 5) ? ` (울트라 ${L2.filter((id) => tab[id].rar >= 5).length})` : ''); };
    cell('경기', m); cell('우승', w); cell('우승률', m ? (100 * w / m).toFixed(1) + '%' : '-'); cell('처치', k); cell('경기당 처치', m ? (k / m).toFixed(1) : '-');
    cell('최고 순위', m && S.best && S.best < 99 ? '#' + S.best : '-'); cell('랭크 경기', R.games ? `${R.games}판 ${R.wins || 0}승` : '-');
    if (S.dm && S.dm.matches) cell('데스매치', `${S.dm.wins || 0}승 / ${S.dm.matches}판`);
    cell(GOLD_NAME, (E.gold != null ? E.gold : u.gold || 0).toLocaleString()); if (D.d) { cell(COIN_NAME, (E.coin || 0).toLocaleString()); cell(GCOIN_NAME, (E.gcoin || 0).toLocaleString()); }
    if (D.d) { cell('옷 스킨', own(S.skins, Body.SKINS)); cell('총 스킨', own(S.gskins, GSKINS)); cell('차량 스킨', own(S.vskins, VSKINS)); }
    box.appendChild(grid);
    // 최근 경기
    if (S.recent && S.recent.length) {
      const rc = h('div', 'acc-recent'); rc.appendChild(h('small', 'acc-sub', '최근 경기'));
      for (const r of S.recent.slice(0, 5)) {
        const mp = MAPS[r.map] ? MAPS[r.map].name.replace(/\s*\(.*\)/, '') : r.map || '';
        rc.appendChild(h('div', 'acc-rrow', r.dm ? `${GAME_TYPES[r.dm] ? GAME_TYPES[r.dm].short || GAME_TYPES[r.dm].name : '데스매치'} · ${r.win ? '승리' : r.draw ? '무승부' : '패배'} ${r.us}:${r.them} · ${r.kills}킬`
          : `${mp}${r.ranked ? ' · 랭크' : ''}${r.sq > 1 ? ` · ${r.sq}인` : ''} · #${r.rank}/${r.total} · ${r.kills}킬${r.delta ? ` · ${r.delta > 0 ? '+' : ''}${r.delta} RP` : ''}`));
      }
      box.appendChild(rc);
    }
    // 계정
    const ac = h('div', 'acc-meta acc-dacc');
    ac.textContent = `가입 ${fmtT(u.created_at || x.created_at, 1)} · 마지막 저장 ${fmtT(u.updated_at)}` + (x.last_sign_in_at ? ` · 마지막 로그인 ${fmtT(x.last_sign_in_at)}` : '') + (x.name_changed_at ? ` · 아이디 변경 ${fmtT(x.name_changed_at)}` : '') + ` · 고유번호 ${String(u.id).slice(0, 8)}`;
    box.appendChild(ac);
    if (D.old) box.appendChild(h('div', 'dev-note', '재화·스킨·최근 경기·랭크 상세는 Supabase SQL Editor에서 supabase/admin.sql 을 다시 실행하면 보입니다'));
    return box;
  }
  function renderAcc() {
    const host = $('devAcc'); if (!host) return; host.innerHTML = '';
    const top = h('div', 'dev-row acc-top');
    const q = h('input', 'dev-sel acc-q'); q.placeholder = '아이디 검색'; q.value = ACC.q; q.maxLength = 10;
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { ACC.q = q.value.trim(); accLoad(); } });
    const sbtn = h('button', 'btn', '검색'); sbtn.type = 'button'; sbtn.onclick = () => { ACC.q = q.value.trim(); accLoad(); };
    const amt = h('select', 'dev-sel'); for (const v of [1000, 5000, 10000, 50000, 100000]) { const o = document.createElement('option'); o.value = v; o.textContent = `골드 ${v.toLocaleString()}`; amt.appendChild(o); }
    amt.value = ACC.amt; amt.onchange = () => { ACC.amt = +amt.value; };
    top.append(q, sbtn, amt); host.appendChild(top);
    if (ACC.msg) host.appendChild(h('div', 'dev-note acc-msg', ACC.msg));
    if (ACC.busy && !ACC.list) { host.appendChild(h('div', 'dev-note', '불러오는 중…')); return; }
    if (ACC.err) { host.appendChild(h('div', 'dev-note bad', ACC.err)); return; }
    if (!ACC.list) return;
    host.appendChild(h('div', 'dev-note', `계정 ${ACC.list.length}개 · 접속 중 ${ACC.list.filter((u) => onlineOf(u.id).on).length}명 · 이름을 누르면 상세 정보 (최근 저장 순${ACC.q ? ` · '${ACC.q}' 검색` : ''})`));
    const L = h('div', 'acc-list');
    for (const u of ACC.list) {
      const r = h('div', 'acc-row' + (u.admin ? ' admin' : '') + (u.id === Cloud.uid ? ' me' : '') + (ACC.sel === u.id ? ' open' : ''));
      const info = h('div', 'acc-info'), on = onlineOf(u.id);
      info.title = '눌러서 상세 정보'; info.onclick = () => { ACC.sel = ACC.sel === u.id ? '' : u.id; if (ACC.sel && !ACC.det[u.id]) detLoad(u); else renderAcc(); Audio.ui(); };
      const nm = h('b', 'acc-name'); nm.appendChild(h('i', 'acc-dot ' + (on.on ? on.st === 'game' ? 'game' : 'on' : 'off'))); nm.title = onlineText(on);
      nm.appendChild(document.createTextNode(u.username + (u.admin ? ' ★관리자' : '') + (u.id === Cloud.uid ? ' (나)' : '')));
      nm.appendChild(h('span', 'acc-arw', ACC.sel === u.id ? '▴' : '▾')); info.appendChild(nm);
      info.appendChild(h('span', 'acc-meta', `Lv ${levelFromXp(u.xp || 0).lv} · ${u.matches}판 ${u.wins}승 ${u.kills}킬 · 골드 ${(u.gold || 0).toLocaleString()} · RP ${u.rp} · ${u.updated_at ? '저장 ' + new Date(u.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '기록 없음'}`));
      r.appendChild(info);
      const bs = h('div', 'acc-btns');
      const mk = (label, cls, fn) => { const b = h('button', 'btn sm ' + cls, label); b.type = 'button'; b.disabled = ACC.busy; b.onclick = fn; bs.appendChild(b); return b; };
      mk(`골드 +${ACC.amt.toLocaleString()}`, 'amber', () => accDo('admin_gold', { p_id: u.id, p_amount: ACC.amt }, `${u.username}님에게 ${GOLD_NAME} ${ACC.amt.toLocaleString()} 지급 — 접속 중이면 다음 저장 때 합쳐짐`));
      const sure = (k, label, fn) => mk(ACC.sure === k + u.id ? `정말 ${label}?` : label, 'danger', () => { if (ACC.sure === k + u.id) { ACC.sure = ''; fn(); } else { ACC.sure = k + u.id; clearTimeout(ACC.sureT); ACC.sureT = setTimeout(() => { ACC.sure = ''; renderAcc(); }, 3000); renderAcc(); } });
      sure('reset', '초기화', () => accDo('admin_reset', { p_id: u.id }, `${u.username}님의 기록을 초기화했습니다 (전적·레벨·재화·스킨·랭크)`));
      if (!u.admin && u.id !== Cloud.uid) sure('del', '삭제', () => accDo('admin_delete', { p_id: u.id }, `${u.username} 계정을 삭제했습니다 (되돌릴 수 없음)`));
      r.appendChild(bs); L.appendChild(r);
      if (ACC.sel === u.id) L.appendChild(detailCard(u));
    }
    host.appendChild(L);
  }

  // ---------- 패널 ----------
  function close() { $('devPanel').hidden = true; }
  function open() { if (!is()) return; ACC.list = null; ACC.err = ''; ACC.msg = ''; ACC.sel = ''; ACC.det = {}; render(); $('devPanel').hidden = false; Audio.ui(); }   // 열 때마다 계정 목록을 새로
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
    // 계정 관리 (서버)
    const as = h('div', 'dev-sec'); as.appendChild(h('div', 'dev-h', '계정 관리'));
    as.appendChild(h('div', 'dev-note', '모든 계정 목록 · 골드 탄피 지급 · 기록 초기화(전적·레벨·재화·스킨·랭크) · 계정 삭제(되돌릴 수 없음). 서버 함수 supabase/admin.sql 필요'));
    const acc = h('div', 'acc-box'); acc.id = 'devAcc'; as.appendChild(acc); box.appendChild(as);
    renderAcc(); if (ACC.list === null && !ACC.busy && !ACC.err) accLoad();
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
