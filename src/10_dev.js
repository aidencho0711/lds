// ============================================================
// 10_dev.js — 개발자 계정: 모든 스킨 + 개발자 도구
//  · 개발자 계정 = 서버의 관리자 목록(supabase/admin.sql public.admins)에 있는 계정 — 아이디가 아니라 계정 고유번호로 판단 (v21)
//    → 아이디를 바꿔도 개발자 그대로, 다른 사람이 '개발자' 아이디를 만들어도 개발자가 아님 (서버에 admin.sql 이 없을 때만 DEV_IDS 아이디로)
//  · 로그인할 때마다 옷·차량·총기 스킨을 모두 그 계정 기록에 넣는다 → 서버에 저장, 새 스킨이 생기면 다음 로그인 때 추가
//  · 개발자 도구: 로비 오른쪽 위 'DEV' 버튼 · 경기 중 메뉴 → '개발자 도구'
//    재화·레벨·출석·미션 / 경기: 무적 · 무한 탄약 · 총 지급(부착물·탄약 포함) · 장비 풀세트 · 차량 소환
//    · 지도 눌러 순간이동 · 자기장 멈춤 / 다음 단계 · 적 모두 탈락 / FPS·좌표 표시
//  · 같이 하기(파티) 경기에서는 경기 치트가 꺼진다 (다른 사람의 경기에 영향을 주지 않게)
//  · v22 관전: 경기 중인 모든 계정 목록 → 누르면 그 계정의 화면을 본다 (10_watch.js · 서버 supabase/spectate.sql 이 관리자인지 확인)
//  · 켜고 끄는 값은 이 기기에만 저장(서버로 가지 않음)
//  · 한계: 재화·판정이 모두 기기에서 돌아가는 구조라 서버가 지켜 주는 권한이 아니다. 아이디는 먼저 가입한 사람이 가진다
//  · v23 부개발자(서버 admins.role = 'sub'): 개발자와 같은 도구·계정 관리를 쓰지만 다른 계정에 골드 탄피를 줄 수 없고(서버 admin_gold 도 거부),
//    개발자·다른 부개발자 계정은 건드릴 수 없다 (초기화·베타 테스터·아이디 변경·밴 — 서버가 'admin' 으로 거부)
//  · v23 계정 밴 (개발자·부개발자): 계정 상세에서 기간(숫자 + 분·시간·일)과 사유 → 서버 admin_ban → 그동안 로그인할 수 없음 · 접속 중이면 바로 로그아웃
// ============================================================
const Dev = (() => {
  const F = Object.assign({ god: false, ammo: false, tp: false, zone: false, stats: false }, store.get('dev', null) || {});
  const save = () => store.set('dev', F);
  const is = () => !!(Cloud.user && Cloud.admin);   // 로그인할 때 서버에 물어본 관리자 여부 (10_cloud.js checkAdmin) — 개발자·부개발자
  const sub = () => is() && Cloud.role === 'sub';   // v23 부개발자
  const roleName = () => (sub() ? '부개발자' : '개발자');
  const inMatch = () => G.state === 'play' && !!G.player;
  const cheatsOk = () => is() && inMatch() && !G.net;
  const cheat = (k) => !!F[k] && is() && !G.net;   // 경기 코드에서 부르는 검사 (같이 하기에선 항상 꺼짐)
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  // ---------- 로그인 · 표시 ----------
  function onLogin() {
    if (!is()) return refresh();
    const n = Eco.devGrantAll();
    if (n) setTimeout(() => HUD.lobbyNote(`${roleName()} 계정 — 스킨 ${n}개를 지급했습니다 (옷·차량·총기 전부)`), 400);
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
    if (d.ammo) inv.items[d.ammo] = (inv.items[d.ammo] || 0) + w.mag * 5;   // 판처파우스트는 탄약 없음
    p.rl = null; p.cycle = null; p.equipT = 0.3; p.setVisibleGear(); HUD.refreshInventory();
    return `${d.name} 지급 (${[w.att.scope, w.att.muzzle, w.att.mag, w.att.grip].filter(Boolean).map((a) => ITEMS[a].name).join(' · ') || '부착물 없음'})`;
  }
  function kit() {
    const p = G.player; if (!p || !p.alive) return '지금은 줄 수 없습니다';
    const inv = p.inv;
    inv.gear = { helmet: { id: 'helm3', dur: ITEMS.helm3.dur }, vest: { id: 'vest3', dur: ITEMS.vest3.dur }, bag: { id: 'bag3' } };
    for (const [id, n] of [['medkit', 2], ['firstaid', 5], ['bandage', 10], ['drink', 5], ['pills', 3], ['frag', 3], ['smoke', 2], ['impact', 2], ['molotov', 2], ['zonegren', 2], ['flash', 2]]) inv.items[id] = Math.max(inv.items[id] || 0, n);
    if (!inv.melee) inv.melee = 'machete';   // v22 근접 무기
    for (const w of inv.weapons) if (w && ITEMS[w.id].ammo) inv.items[ITEMS[w.id].ammo] = Math.max(inv.items[ITEMS[w.id].ammo] || 0, inv.magSize(w) * 5);
    p.hp = 100; p.boost = 100; p.setVisibleGear(); HUD.refreshInventory();
    return '헬멧·조끼·가방 3레벨 + 회복·부스트 아이템·투척 무기 6종·마체테 · 체력·부스트 가득';
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
  const ACC = { q: '', list: null, err: '', busy: false, amt: 10000, sure: '', sureT: null, msg: '', sel: '', det: {}, rn: {}, ban: {} };
  const rpcErr = (e) => { const m = String((e && e.message) || e || ''); return e && e.code === 'PGRST202' || /could not find|does not exist/i.test(m) ? '서버 설정 필요: Supabase SQL Editor에서 supabase/admin.sql 을 실행해 주세요' : /not admin/i.test(m) ? '관리자로 등록되지 않은 계정입니다 (이 계정이 있는 상태에서 admin.sql 을 실행해야 등록됨)' : Cloud.msgOf(e); };
  const RES = { denied: '관리자만 할 수 있습니다', self: '자기 계정은 지울 수 없습니다', admin: '다른 관리자 계정은 지울 수 없습니다', notfound: '없는 계정입니다', amount: '지급 양이 올바르지 않습니다 (1 ~ 1,000,000)',
    invalid: '아이디는 2~10자, 한글·영문·숫자·밑줄(_)만 쓸 수 있습니다', taken: '이미 사용 중인 아이디입니다', same: '지금 아이디와 같습니다', reserved: "'개발자'·'부개발자'는 그 관리자 계정만 쓸 수 있습니다",
    devonly: '골드 탄피 지급은 개발자만 할 수 있습니다' };
  const SUB_RES = { admin: '부개발자는 개발자·다른 부개발자 계정을 바꿀 수 없습니다' };   // v23 초기화·베타 테스터·아이디 변경
  const BAN_RES = { self: '자기 계정은 밴할 수 없습니다', admin: '개발자 계정은 밴할 수 없습니다 (부개발자는 다른 부개발자도 · 밴 해제도 개발자만)', amount: '밴 기간이 올바르지 않습니다 (1분 ~ 3650일)' };
  // 계정 목록: v23 admin_accounts(역할·밴 포함) → 없으면(옛 서버) admin_list
  async function accLoad() {
    const sb = Cloud.client(); if (!sb || !Cloud.user) { ACC.err = '로그인이 필요합니다'; renderAcc(); return; }
    ACC.busy = true; ACC.err = ''; renderAcc();
    try {
      let r = await sb.rpc('admin_accounts', { p_q: ACC.q });
      if (r.error && (r.error.code === 'PGRST202' || /could not find|does not exist/i.test(String(r.error.message || '')))) r = await sb.rpc('admin_list', { p_q: ACC.q });
      if (r.error) throw r.error; ACC.list = r.data || [];
    }
    catch (e) { ACC.err = rpcErr(e); ACC.list = null; }
    ACC.busy = false; renderAcc();
  }
  // 돌려주는 값: 서버 함수의 답('ok' 등) · 실패하면 null · res: 이 기능의 답 문구(RES 대신)
  async function accDo(fn, args, okMsg, res0) {
    const sb = Cloud.client(); if (!sb) return null;
    ACC.busy = true; ACC.msg = '처리 중…'; renderAcc();
    let res = null;
    try { const { data, error } = await sb.rpc(fn, args); if (error) throw error; res = data; ACC.msg = data === 'ok' ? okMsg : (res0 && res0[data]) || RES[data] || `실패: ${data}`; }
    catch (e) { ACC.msg = rpcErr(e); }
    ACC.busy = false; ACC.det = {}; await accLoad();
    const su = ACC.sel && ACC.list && ACC.list.find((x) => x.id === ACC.sel); if (su) detLoad(su);   // 펼쳐 둔 상세도 새로
    return res;
  }
  // 아이디 강제 변경 (서버 함수 admin_rename — admin.sql v22): 로그인 아이디(내부 이메일)도 같이 바뀐다 → 그 사람은 다음 로그인부터 새 아이디 + 원래 비밀번호
  //  두 번 눌러야 실행 · 접속 중이면 로비 채널로 알림(rn) → 그 기기가 서버에서 다시 읽고 창으로 알려 줌 (10_cloud.js)
  function renameRow(u) {
    const rb = h('div', 'acc-rn'), k = 'rn' + u.id;
    rb.appendChild(h('span', 'acc-meta', '아이디 강제 변경'));
    const inp = h('input', 'dev-sel'); inp.placeholder = '새 아이디 (2~10자)'; inp.maxLength = 10; inp.value = ACC.rn[u.id] || ''; inp.spellcheck = false; inp.autocomplete = 'off';
    inp.oninput = () => { ACC.rn[u.id] = inp.value; if (ACC.sure === k) { ACC.sure = ''; go.textContent = '바꾸기'; } };
    const go = h('button', 'btn sm amber', ACC.sure === k ? '정말 바꾸기?' : '바꾸기'); go.type = 'button'; go.disabled = ACC.busy;
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    go.onclick = () => {
      const nm = String(inp.value || '').normalize('NFC').trim(), bad = Cloud.checkId(nm);
      if (bad || nm === u.username) { ACC.sure = ''; ACC.msg = bad || RES.same; renderAcc(); return; }
      if (ACC.sure !== k) { ACC.sure = k; clearTimeout(ACC.sureT); ACC.sureT = setTimeout(() => { ACC.sure = ''; renderAcc(); }, 3000); renderAcc(); return; }
      ACC.sure = ''; clearTimeout(ACC.sureT);
      const old = u.username, id = u.id;
      accDo('admin_rename', { p_id: id, p_name: nm }, `${old} → ${nm} 으로 아이디를 바꿨습니다 — 다음 로그인부터 '${nm}' + 원래 비밀번호 (접속 중이면 바로 알림)`, SUB_RES).then((r) => {
        if (r !== 'ok') return;
        delete ACC.rn[id];
        if (id === Cloud.uid) Cloud.refreshName(); else Social.send(id, 'rn', {});
      });
    };
    rb.append(inp, go);
    return rb;
  }
  // ---------- v23 역할 · 계정 밴 ----------
  //  상대 역할: 'dev' · 'sub' · null (옛 서버 목록은 admin 만 → 개발자로)
  const roleOf = (u, x) => (x && x.role) || u.role || (u.admin ? 'dev' : null);
  const roleTag = (u, x) => { const r = roleOf(u, x); return r === 'sub' ? ' ☆부개발자' : r === 'dev' ? ' ★개발자' : ''; };
  const canEdit = (u, x) => !sub() || u.id === Cloud.uid || !roleOf(u, x);   // 부개발자는 다른 관리자 계정을 바꿀 수 없다 (서버도 거부)
  const canBan = (u, x) => u.id !== Cloud.uid && roleOf(u, x) !== 'dev' && (!sub() || !roleOf(u, x));
  const banUntil = (t) => (t && new Date(t).getTime() > Date.now() ? t : null);
  const leftT = (t) => { const m = Math.max(1, Math.ceil((new Date(t).getTime() - Date.now()) / 60000)), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60; return d ? `${d}일 ${hh}시간` : hh ? `${hh}시간 ${mm}분` : `${mm}분`; };
  const BAN_UNIT = { m: ['분', 1], h: ['시간', 60], d: ['일', 1440] };
  //  기간(1~999 + 분·시간·일) · 사유(선택, 60자) → admin_ban (두 번 눌러야 실행) · 밴 중이면 상태와 '밴 해제'
  //  밴하면 그 사람이 접속 중일 때 로비 채널로 알림(ban) → 그 기기가 서버에서 다시 읽어 확인하고 로그아웃 + 안내 창 (10_cloud.js checkBan)
  function banRow(u, x) {
    const box = h('div', 'acc-ban'), k = 'ban' + u.id, B = ACC.ban[u.id] || (ACC.ban[u.id] = { n: 1, unit: 'd', why: '' });
    const until = banUntil(x.banned_until !== undefined ? x.banned_until : u.banned_until), why0 = x.ban_reason || u.ban_reason || '';
    if (until) {
      const st = h('div', 'acc-banned'); st.textContent = `⛔ 정지 중 — ${fmtT(until, 1)}까지 · 남은 ${leftT(until)}` + (why0 ? ` · 사유: ${why0}` : '') + (x.banned_by ? ` · ${x.banned_by}${x.banned_at ? ' ' + fmtT(x.banned_at) : ''}` : '');
      const ub = h('button', 'btn sm', '밴 해제'); ub.type = 'button'; ub.disabled = ACC.busy;
      ub.onclick = () => accDo('admin_unban', { p_id: u.id }, `${u.username} 계정의 밴을 풀었습니다 — 바로 다시 로그인할 수 있습니다`, BAN_RES);
      st.appendChild(ub); box.appendChild(st);
    }
    const row = h('div', 'acc-banrow');
    row.appendChild(h('span', 'acc-meta', until ? '다시 밴 (지금부터 새 기간)' : '계정 밴'));
    const num = h('input', 'dev-sel acc-bann'); num.type = 'number'; num.min = '1'; num.max = '999'; num.step = '1'; num.value = B.n; num.inputMode = 'numeric';
    const unit = h('select', 'dev-sel acc-banu'); for (const key in BAN_UNIT) { const o = document.createElement('option'); o.value = key; o.textContent = BAN_UNIT[key][0]; unit.appendChild(o); } unit.value = B.unit;
    const why = h('input', 'dev-sel acc-banwhy'); why.placeholder = '사유 (선택)'; why.maxLength = 60; why.value = B.why; why.spellcheck = false; why.autocomplete = 'off';
    const go = h('button', 'btn sm danger', ACC.sure === k ? '정말 밴?' : '밴하기'); go.type = 'button'; go.disabled = ACC.busy;
    const unsure = () => { if (ACC.sure === k) { ACC.sure = ''; go.textContent = '밴하기'; } };
    num.oninput = () => { B.n = num.value; unsure(); }; unit.onchange = () => { B.unit = unit.value; unsure(); }; why.oninput = () => { B.why = why.value; };
    for (const el of [num, why]) el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
    go.onclick = () => {
      const n = Number(num.value), U = BAN_UNIT[unit.value] || BAN_UNIT.d;
      if (!(n >= 1 && n <= 999 && Math.floor(n) === n)) { ACC.sure = ''; ACC.msg = '밴 기간은 1 ~ 999 (분·시간·일) 사이의 정수로 정해 주세요'; renderAcc(); return; }
      if (ACC.sure !== k) { ACC.sure = k; clearTimeout(ACC.sureT); ACC.sureT = setTimeout(() => { ACC.sure = ''; renderAcc(); }, 3000); renderAcc(); return; }
      ACC.sure = ''; clearTimeout(ACC.sureT);
      const id = u.id, reason = String(why.value || '').trim().slice(0, 60), label = `${n}${U[0]}`;
      accDo('admin_ban', { p_id: id, p_minutes: n * U[1], p_reason: reason }, `${u.username} 계정을 ${label} 밴했습니다${reason ? ` (사유: ${reason})` : ''} — 그동안 로그인할 수 없고, 접속 중이면 바로 로그아웃됩니다`, BAN_RES)
        .then((r) => { if (r === 'ok') { B.why = ''; Social.send(id, 'ban', {}); } });
    };
    row.append(num, unit, why, go); box.appendChild(row);
    return box;
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
    const nm = h('div', 'acc-dn'); nm.appendChild(h('b', '', u.username + roleTag(u, x)));
    if (P.ti) { const t = h('div', ''); t.innerHTML = Prof.titleHTML(P.ti, 'sm'); nm.appendChild(t); }
    const st = h('span', 'acc-on ' + (on.on ? on.st === 'game' ? 'game' : 'on' : 'off'), (on.on ? '● ' : '○ ') + onlineText(on) + (on.on || !lastT(x, u) ? '' : ` · 마지막 접속 ${agoT(lastT(x, u))}`));
    nm.appendChild(st); hd.appendChild(nm);
    // 티어: 엠블럼 + 이름 (레벨 3 미만 = 잠김, 배치 3판 전 = 배치고사)
    const RV = x.rank ? Rank.viewOf(R) : { now: Rank.tierOf(R.rp), peak: Rank.tierOf(R.peak) }, ti = RV.now, lock = L.lv < 3,   // v23: 개편 전 기록은 4000 RP 로 잘라서
    plc = !lock && (D.d ? (R.placed || 0) < 3 : !u.rp);
    const tierBox = h('div', 'acc-dtier');
    const em = h('img', ''); em.alt = ''; em.src = lock ? Rank.emblem(-2, 0, 96) : plc ? Rank.emblem(-1, 0, 96) : Rank.emblem(ti.t, ti.div, 96); tierBox.appendChild(em);
    const tl = h('div', ''); tl.appendChild(h('b', '', lock ? '랭크 잠김' : plc ? '배치고사' : ti.label));
    tl.appendChild(h('small', '', lock ? '레벨 3부터' : plc ? `${R.placed || 0} / 3 완료` : `${R.rp} RP` + (R.peak > R.rp ? ` · 최고 ${RV.peak.label}` : '') + (ti.series ? ` · 승급전 ${R.ss || 0}/${SUP.need[ti.sg] || 3}` : '')));
    tierBox.appendChild(tl); hd.appendChild(tierBox);
    // 하드코어 티어 (일반 랭크 최고 다이아 4 이상이면 자격 · 한 판이라도 했으면 티어)
    const HC = R.hc || null, hcOk = (R.peak || 0) >= HC_MIN_PEAK;
    if (D.d && (hcOk || HC)) {
      const hb = h('div', 'acc-dtier hc'), ht = Rank.hcTierOf(HC ? HC.rp : 0), hi = h('img', ''); hi.alt = ''; hi.src = Rank.hcEmblem(ht.t, ht.div, 96); hb.appendChild(hi);
      const hl = h('div', ''); hl.appendChild(h('b', '', HC && HC.games ? ht.label : '하드코어 자격')); hl.appendChild(h('small', '', HC && HC.games ? `${HC.rp} RP · ${HC.games}판 ${HC.wins || 0}승` + ((HC.peak || 0) > HC.rp ? ` · 최고 ${Rank.hcTierOf(HC.peak).label}` : '') : '아직 하드코어 기록 없음'));
      hb.appendChild(hl); hd.appendChild(hb);
    }
    box.appendChild(hd);
    // 베타 테스터: 칭호 부여·회수 (서버 함수 admin_beta) — 받으면 베타 테스터 사진·테두리·칭호 + 테스터 등급 총 스킨
    //  v23 부개발자는 다른 관리자 계정의 베타 테스터·아이디를 바꿀 수 없다 · 밴은 개발자 계정은 아무도, 부개발자는 다른 부개발자도 안 됨
    if (D.d) {
      if (canEdit(u, x)) {
        const isB = !!(S.beta && S.beta.on), bb = h('div', 'acc-beta');
        bb.innerHTML = isB ? Prof.titleHTML('beta') + `<span class="acc-meta">베타 테스터 · ${fmtT(S.beta.t, 1)} 부여</span>` : '<span class="acc-meta">베타 테스터 아님</span>';
        const btn = h('button', 'btn sm ' + (isB ? 'danger' : 'amber'), isB ? '베타 테스터 회수' : '베타 테스터 칭호 부여'); btn.type = 'button'; btn.disabled = ACC.busy;
        btn.onclick = () => accDo('admin_beta', { p_id: u.id, p_on: !isB }, isB ? `${u.username}님의 베타 테스터 칭호를 회수했습니다` : `${u.username}님에게 베타 테스터 칭호를 부여했습니다 — 사진·테두리·칭호·테스터 총 스킨(접속 중이면 다음 저장 때)`, SUB_RES).then(() => { if (u.id === Cloud.uid) Cloud.pushNow(); });   // 내 계정이면 바로 합쳐 받기
        bb.appendChild(btn); box.appendChild(bb);
        box.appendChild(renameRow(u));
      } else box.appendChild(h('div', 'dev-note', `${roleOf(u, x) === 'dev' ? '개발자' : '부개발자'} 계정 — 부개발자는 바꿀 수 없습니다 (보기만)`));
      if (canBan(u, x)) box.appendChild(banRow(u, x));
    }
    // 레벨 막대
    const lvb = h('div', 'acc-dlv'); lvb.appendChild(h('b', '', `Lv ${L.lv}`));
    const bar = h('div', 'acc-bar'), fill = h('i', ''); fill.style.width = (100 * L.cur / L.need).toFixed(1) + '%'; bar.appendChild(fill); lvb.appendChild(bar);
    lvb.appendChild(h('small', '', `${L.cur.toLocaleString()} / ${L.need.toLocaleString()} XP · 누적 ${xp.toLocaleString()}`)); box.appendChild(lvb);
    // 숫자 칸
    const grid = h('div', 'acc-grid');
    const cell = (k2, v) => { const c = h('div', 'acc-cell'); c.appendChild(h('small', '', k2)); c.appendChild(h('b', '', String(v))); grid.appendChild(c); };
    const own = (arr, tab) => { const L2 = (arr || []).filter((id) => tab[id] && !tab[id].tester); return `${L2.length}종` + (L2.some((id) => tab[id].rar >= 5) ? ` (울트라 ${L2.filter((id) => tab[id].rar >= 5).length})` : ''); };
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
          : `${mp}${r.ranked ? r.hc ? ' · 하드코어' : ' · 랭크' : ''}${r.sq > 1 ? ` · ${r.sq}인` : ''} · #${r.rank}/${r.total} · ${r.kills}킬${r.delta ? ` · ${r.delta > 0 ? '+' : ''}${r.delta} RP` : ''}`));
      }
      box.appendChild(rc);
    }
    // 계정
    const ac = h('div', 'acc-meta acc-dacc');
    ac.textContent = `가입 ${fmtT(u.created_at || x.created_at, 1)} · 마지막 저장 ${fmtT(u.updated_at)}` + (x.last_sign_in_at ? ` · 마지막 로그인 ${fmtT(x.last_sign_in_at)}` : '') + (x.name_changed_at ? ` · 아이디 변경 ${fmtT(x.name_changed_at)}${x.name_forced_at && x.name_forced_at >= x.name_changed_at ? '(운영자)' : ''}` : '') + ` · 고유번호 ${String(u.id).slice(0, 8)}`;
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
    top.append(q, sbtn);
    if (!sub()) {   // v23 골드 탄피 지급은 개발자만
      const amt = h('select', 'dev-sel'); for (const v of [1000, 5000, 10000, 50000, 100000]) { const o = document.createElement('option'); o.value = v; o.textContent = `골드 ${v.toLocaleString()}`; amt.appendChild(o); }
      amt.value = ACC.amt; amt.onchange = () => { ACC.amt = +amt.value; }; top.appendChild(amt);
    }
    host.appendChild(top);
    if (ACC.msg) host.appendChild(h('div', 'dev-note acc-msg', ACC.msg));
    if (ACC.busy && !ACC.list) { host.appendChild(h('div', 'dev-note', '불러오는 중…')); return; }
    if (ACC.err) { host.appendChild(h('div', 'dev-note bad', ACC.err)); return; }
    if (!ACC.list) return;
    const nBan = ACC.list.filter((u) => banUntil(u.banned_until)).length;
    host.appendChild(h('div', 'dev-note', `계정 ${ACC.list.length}개 · 접속 중 ${ACC.list.filter((u) => onlineOf(u.id).on).length}명${nBan ? ` · 정지 ${nBan}명` : ''} · 이름을 누르면 상세 정보 (최근 저장 순${ACC.q ? ` · '${ACC.q}' 검색` : ''})`));
    const L = h('div', 'acc-list');
    for (const u of ACC.list) {
      const bu = banUntil(u.banned_until);
      const r = h('div', 'acc-row' + (u.admin ? ' admin' : '') + (roleOf(u) === 'sub' ? ' sub' : '') + (bu ? ' banned' : '') + (u.id === Cloud.uid ? ' me' : '') + (ACC.sel === u.id ? ' open' : ''));
      const info = h('div', 'acc-info'), on = onlineOf(u.id);
      info.title = '눌러서 상세 정보'; info.onclick = () => { ACC.sel = ACC.sel === u.id ? '' : u.id; if (ACC.sel && !ACC.det[u.id]) detLoad(u); else renderAcc(); Audio.ui(); };
      const nm = h('b', 'acc-name'); nm.appendChild(h('i', 'acc-dot ' + (on.on ? on.st === 'game' ? 'game' : 'on' : 'off'))); nm.title = onlineText(on);
      nm.appendChild(document.createTextNode(u.username + roleTag(u) + (u.id === Cloud.uid ? ' (나)' : '')));
      if (bu) nm.appendChild(h('span', 'acc-banb', `⛔ 정지 ${leftT(bu)}`));   // v23 밴 중
      nm.appendChild(h('span', 'acc-arw', ACC.sel === u.id ? '▴' : '▾')); info.appendChild(nm);
      info.appendChild(h('span', 'acc-meta', `Lv ${levelFromXp(u.xp || 0).lv} · ${u.matches}판 ${u.wins}승 ${u.kills}킬 · 골드 ${(u.gold || 0).toLocaleString()} · RP ${u.rp} · ${u.updated_at ? '저장 ' + new Date(u.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '기록 없음'}`));
      r.appendChild(info);
      const bs = h('div', 'acc-btns');
      const mk = (label, cls, fn) => { const b = h('button', 'btn sm ' + cls, label); b.type = 'button'; b.disabled = ACC.busy; b.onclick = fn; bs.appendChild(b); return b; };
      if (!sub()) mk(`골드 +${ACC.amt.toLocaleString()}`, 'amber', () => accDo('admin_gold', { p_id: u.id, p_amount: ACC.amt }, `${u.username}님에게 ${GOLD_NAME} ${ACC.amt.toLocaleString()} 지급 — 접속 중이면 다음 저장 때 합쳐짐`));   // v23 개발자만
      const sure = (k, label, fn) => mk(ACC.sure === k + u.id ? `정말 ${label}?` : label, 'danger', () => { if (ACC.sure === k + u.id) { ACC.sure = ''; fn(); } else { ACC.sure = k + u.id; clearTimeout(ACC.sureT); ACC.sureT = setTimeout(() => { ACC.sure = ''; renderAcc(); }, 3000); renderAcc(); } });
      if (canEdit(u)) sure('reset', '초기화', () => accDo('admin_reset', { p_id: u.id }, `${u.username}님의 기록을 초기화했습니다 (전적·레벨·재화·스킨·랭크)`, SUB_RES));
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
    box.appendChild(h('div', 'dev-who', `${roleName()} 계정: ${Cloud.name} · 옷 ${own(Eco.ownedSkins().size, Object.keys(Body.SKINS).length)} · 차량 ${own((STATS.vskins || []).length, Object.keys(VSKINS).length)} · 총기 ${own(Eco.gskinsOwned().length, Object.keys(GSKINS).length)}`));
    // 재화·레벨·미션 (로비·경기 어디서나)
    let r = sec('재화', `골드 탄피 ${Eco.gold.toLocaleString()} · 차량 코인 ${Eco.coin} · 총기 코인 ${Eco.gcoin}`);
    btn(r, `${GOLD_NAME} +10,000`, () => { Eco.devAdd('gold', 10000); return `${GOLD_NAME} +10,000`; });
    btn(r, '차량 코인 +100', () => { Eco.devAdd('coin', 100); return '차량 교환 코인 +100'; });
    btn(r, '총기 코인 +100', () => { Eco.devAdd('gcoin', 100); return '총기 교환 코인 +100'; });
    btn(r, '배틀패스 +500 경험치', () => { Eco.devAdd('bp', 500); return '배틀패스 경험치 +500 (5단계)'; });
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
    for (const cls of ['AR', 'SMG', 'SG', 'DMR', 'SR', 'LMG', 'PISTOL', 'RL']) { if (!byCls[cls]) continue; const og = document.createElement('optgroup'); og.label = cls; for (const id of byCls[cls]) { const o = document.createElement('option'); o.value = id; o.textContent = ITEMS[id].name; og.appendChild(o); } gsel.appendChild(og); }
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
    // v23 티어 승급 컷신 다시 보기 (10_rankfx.js) — 그 티어로 오를 때 나오는 장면. 상위 티어(노바~제니스)는 승급전 통과 장면
    r = sec('티어 승급 컷신', '누르면 그 티어로 오르는 컷신을 바로 봅니다 (기록은 바뀌지 않음). 화면을 누르면 이름 장면으로, 한 번 더 누르면 닫힘');
    for (let t = 1; t < RANK_TIERS.length; t++) { const b = btn(r, `→ ${RANK_TIERS[t].name}`, () => { close(); setTimeout(() => RankFx.demo(t), 120); return ''; }); if (RANK_TIERS[t].sup) b.classList.add('dev-sup'); }
    btn(r, '개편 안내 미리보기', () => { close(); RankFx.cutNotice({ from: 6600, got: [{ k: 'gskin', id: 'e_m416_divine', rar: 7 }, { k: 'vskin', id: 'uaz_sleigh', rar: 8 }, { k: 'skin', id: 'top_x_frost', rar: 8 }], preview: 1 }); return ''; });
    // 관전 (v22 · 10_watch.js): 경기 중인 모든 계정 — 로비 채널 접속 표시(pl) 기준, 친구가 아니어도 볼 수 있다 (서버가 관리자인지 확인)
    const ws = h('div', 'dev-sec'); ws.appendChild(h('div', 'dev-h', '관전'));
    ws.appendChild(h('div', 'dev-note', '지금 경기 중인 모든 계정의 화면을 봅니다 (친구가 아니어도 · 로그인한 계정만 · 로비에서만). 보는 동안 상대 화면 위에 「이름(운영자) 관전 중」이 보입니다. 서버 함수 supabase/spectate.sql 필요'));
    const wl = h('div', 'dev-row'); wl.id = 'devWatch'; ws.appendChild(wl); box.appendChild(ws);
    Watch.devList(wl);
    // 계정 관리 (서버)
    const as = h('div', 'dev-sec'); as.appendChild(h('div', 'dev-h', '계정 관리'));
    as.appendChild(h('div', 'dev-note', sub() ? '모든 계정 목록 · 기록 초기화(전적·레벨·재화·스킨·랭크) · 아이디 변경 · 계정 밴(분·시간·일) · 계정 삭제(되돌릴 수 없음). 부개발자는 골드 탄피를 줄 수 없고, 개발자·다른 부개발자 계정은 바꿀 수 없습니다'
      : '모든 계정 목록 · 골드 탄피 지급 · 기록 초기화(전적·레벨·재화·스킨·랭크) · 아이디 변경 · 계정 밴(분·시간·일) · 계정 삭제(되돌릴 수 없음). 서버 함수 supabase/admin.sql 필요'));
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
