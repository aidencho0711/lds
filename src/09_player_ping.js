// ============================================================
// 09_player_ping.js — 팀 핑·지도 마커를 같은 팀 사람에게도 (v23)
//  · 내 핑(Y·핑 버튼: 이동·공격·위험)과 지도 마커(G.teamOrder · G.danger · G.marker)를 같은 팀의 다른 기기 사람(같이 하기·온라인 매칭)에게 'pg' 사건으로 보낸다
//    상태를 통째로 보내므로 덮어쓰기·지우기·시간이 지나 사라짐(위험 25초 · 공격 40초 · 이동 150초)이 모든 기기에서 같다
//    바뀐 뒤 0.6초 그대로일 때 보냄 — 두 번 누르기(위험)·길게 누르기(모여)가 잠깐 찍었다 되돌리는 핑은 보내지 않게
//    남아 있으면 3초마다 다시(h: 알림·소리 없이) — 늦게 붙은 사람 · 방장이 바뀐 뒤 · 공격 목표의 새 위치
//  · 받는 사람: 같은 팀 사람 + 방장(내 팀원 봇을 움직이는 기기 — 온라인 매칭에서는 다른 팀일 수 있음 · 방장 화면에는 같은 팀 것만 보임)
//    옛 화면은 모르는 사건을 그냥 버리므로(깨지지 않음) 같이 하기 버전(NET_VER)은 그대로 둔다
//  · 받은 핑은 그 사람 캐릭터에 (c.pg = { s 화면, n 순서, mk, o, dg }) — 나가서 봇이 이어받으면 지운다
//  · 색: 찍은 팀원의 번호 색(TEAM_COLORS · 팀 목록의 1·2·3·4) — 지도 · 화면 표식 · 3D 점 (혼자면 예전 주황 마커)
//  · 화면 표식(#pingTags): 안개·카메라 시야 끝(far)·봇 표시 거리와 상관없이 그 자리에 점 + 거리 · 화면 밖이면 가장자리에 방향 화살표
//  · 3D: 예전 기둥(세로 빔) 대신 그 지점에 점 + 바닥에서 퍼지는 링 (안개 없이)
//  · 팀원 봇(방장 기기): 따라다니는 사람(followC)의 이동·공격 지시를 받는다 — 그 사람이 다른 기기여도 · 위험 표시는 같은 팀 사람 것 중 가장 가까운 것
// ============================================================
const TeamPing = (() => {
  const SID = Math.random().toString(36).slice(2, 8);   // 이 화면 (새로고침하면 바뀜) — 받는 쪽은 같은 화면의 더 작은 순서 번호를 늦게 온 예전 상태로 버린다
  const LIFE = { move: 150, attack: 40 }, DG_LIFE = 25, HOLD = 0.6, BEAT = 3, SLOT = { mk: 0, o: 1, dg: 2 };
  const NAME = { mk: '마커', mv: '이동', at: '공격', dg: '위험' }, DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  const r1 = (v) => Math.round(v * 10) / 10, num = (v) => typeof v === 'number' && Number.isFinite(v);
  const okXZ = (x, z) => num(x) && num(z) && Math.abs(x) < HALF + 100 && Math.abs(z) < HALF + 100;
  const okT = (t) => num(t) && t <= G.time + 5;   // 찍은 시각: 앞날(시계가 크게 앞선 값)이면 영영 안 사라지므로 버림
  const okY = (y, x, z) => (num(y) ? clamp(y, -100, 2500) : heightAt(x, z));   // 높이: 숫자가 아니면 땅 · 스타트 섬(1100m)까지
  const fmt = (d) => (d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm');
  let acc = 0, lastT = 0, seq = 0, chgT = 0, sentT = -99, follow = false, frame = 0, dotG = null, ringG = null, warmM = null, warmN = 0;
  const seen = [null, null, null], sent = [null, null, null], held = new Set(), tags = new Map();
  // 다른 기기 사람이 아직 자기 캐릭터를 움직이는지 (나가면 방장 봇이 이어받아 주인이 바뀐다)
  const live = (c) => !!c && !!c.human && !c.isPlayer && !!c.uid && !!c.net && c.net.owner === c.uid && !c.botized;
  const mkOf = (c) => (c === G.player ? G.marker : c.pg && c.pg.mk) || null;
  const ordOf = (c) => (c === G.player ? G.teamOrder : c.pg && c.pg.o) || null;
  const dgOf = (c) => (c === G.player ? G.danger : c.pg && c.pg.dg) || null;
  const colorOf = (c) => (G.teamSize > 1 ? TEAM_COLORS[c.slot % TEAM_COLORS.length] : '#f0a43a');
  const byId = (id) => CHARS.find((x) => x.id === id) || null;
  // 지금 보는 자리 (수송기·리콜 수송기 안 · 관전 중이면 그 팀원)
  const viewPos = () => { const p = G.player, pl = p.mode === 'plane' && planeOf(p); return pl ? pl.pos : (G.viewChar ? G.viewChar() : p).pos; };
  function where(x, z) { const v = viewPos(), dx = x - v.x, dz = z - v.z; let deg = (180 - Math.atan2(dx, dz) * 180 / Math.PI) % 360; if (deg < 0) deg += 360; return `${DIRS[Math.round(deg / 45) % 8]}쪽 ${fmt(Math.hypot(dx, dz))}`; }
  // 핑을 볼 팀원이 있는지: 서 있는 팀원(봇·사람) · 다른 기기 사람(쓰러져 관전 중이어도)
  function hasMates(p) { for (const m of teamMembers(p)) if (m !== p && (standing(m) || live(m))) return true; return false; }
  // '모여'(길게 누르기 · 지시 취소): 다음에 보낼 때 알림
  function followed() { follow = true; }

  // ---------- 보내기 (매 프레임 · 09_player.js updateTeamOrder) ----------
  function update() {
    const t = G.time, dt = t - lastT; lastT = t; if (dt > 0 && dt < 0.5) acc += dt;
    for (const c of held) expire(c);
    sync();
  }
  // 받은 핑: 시간이 지나거나 공격 목표가 쓰러지면 지움 (보낸 쪽도 같은 때 지워 다시 보낸다) · 나간 사람 것은 통째로
  function expire(c) {
    const S = c.pg; if (!S) { held.delete(c); return; }
    if (!live(c)) { c.pg = null; held.delete(c); return; }
    if (S.o && (G.time - S.o.t > LIFE[S.o.kind] || (S.o.target && !S.o.target.alive))) S.o = null;
    if (S.dg && G.time - S.dg.t > DG_LIFE) S.dg = null;
  }
  function sync() {
    const p = G.player; if (!p) return;
    const mk = G.marker || null, o = G.teamOrder || null, dg = G.danger || null;
    if (mk !== seen[0] || o !== seen[1] || dg !== seen[2]) { seen[0] = mk; seen[1] = o; seen[2] = dg; chgT = acc; }
    const N = Net.state;
    if (!N || !G.teams) { sent[0] = mk; sent[1] = o; sent[2] = dg; follow = false; return; }   // 혼자·봇만: 보낼 곳 없음
    if (mk !== sent[0] || o !== sent[1] || dg !== sent[2] || follow) { if (acc - chgT >= HOLD) send(N, p, mk, o, dg, false); }
    else if ((mk || o || dg) && acc - sentT >= BEAT) send(N, p, mk, o, dg, true);
  }
  // 받을 사람: 같은 팀 사람(다른 기기 · 아직 자기 캐릭터를 움직이는 사람 — 나갔다 돌아오면 다시) + 방장(bot: 내 팀원 봇을 움직임 — 다른 팀이어도)
  //  (N.gone 은 쓰지 않는다 — 연결이 끊겨 방장이 봇에게 넘긴 사람은 파티원 기기의 N.gone 에 없을 수 있다 · 봇이 이어받은 사람도 방장 기기가 움직이는 '봇')
  function targets(N, p) {
    const out = [], ms = teamMembers(p);
    for (const m of ms) if (m !== p && live(m) && !out.includes(m.uid)) out.push(m.uid);
    const h = N.cfg.host, bot = !N.host && h && h !== N.me && !out.includes(h) && ms.some((m) => m !== p && m.alive && !live(m)) ? h : null;
    return { out, bot };
  }
  // { k:'pg', c: 내 캐릭터, s·n, mk: [x, z] | 0, o: [1 이동 · 2 공격, x, y, z, 목표 캐릭터, 찍은 시각] | 0, dg: [x, y, z, 찍은 시각] | 0, h: 다시 보냄, f: 모여 }
  function send(N, p, mk, o, dg, beat) {
    sent[0] = mk; sent[1] = o; sent[2] = dg; sentT = acc;
    if (!beat) seq++;
    const to = targets(N, p);
    if (to.out.length || to.bot) {
      const e = { k: 'pg', c: p.id, s: SID, n: seq, mk: mk ? [r1(mk.x), r1(mk.z)] : 0,
        o: o ? [o.kind === 'attack' ? 2 : 1, r1(o.x), num(o.y) ? r1(o.y) : null, r1(o.z), o.kind === 'attack' && o.target ? o.target.id : -1, r1(o.t || 0)] : 0,
        dg: dg ? [r1(dg.x), num(dg.y) ? r1(dg.y) : null, r1(dg.z), r1(dg.t || 0)] : 0 };
      if (beat) e.h = 1;
      if (follow) e.f = 1;
      for (const u of to.out) Net.ev(Object.assign({}, e), u);   // 받는 사람마다 따로 (ev 가 e.to 를 붙인다)
      if (to.bot) Net.ev(Object.assign({}, e, { mk: 0 }), to.bot);   // 다른 팀 방장: 봇이 쓰는 지시·위험만 (마커는 그 화면에 보이지 않으므로 보내지 않음)
    }
    follow = false;
  }

  // ---------- 받기 (10_net.js 'pg') ----------
  function onNet(e) {
    const p = G.player; if (!p || !num(e.c) || !num(e.n)) return;
    const c = byId(e.c); if (!live(c) || c.uid !== e.from) return;   // 그 사람 기기가 보낸 것만
    const S0 = c.pg || null, s = typeof e.s === 'string' ? e.s.slice(0, 12) : '';
    if (S0 && S0.s === s && e.n < S0.n) return;   // 늦게 온 예전 상태
    const fresh = !S0 || S0.s !== s || e.n > S0.n;   // 같은 순서 번호를 또 받음(다시 보내기 · 방장이 대신 받은 사본) → 모여 알림은 한 번만
    const S = { s, n: e.n, mk: null, o: null, dg: null };
    // 바뀌지 않은 표시는 같은 물건을 그대로 (봇이 같은 위험·지시로 알고 엄폐 자리를 다시 찾지 않게)
    const a = e.mk; if (Array.isArray(a) && okXZ(a[0], a[1])) { const m0 = S0 && S0.mk; S.mk = m0 && m0.x === a[0] && m0.z === a[1] ? m0 : { x: a[0], z: a[1] }; }
    const b = e.o;
    if (Array.isArray(b) && okXZ(b[1], b[3]) && okT(b[5])) {
      const atk = b[0] === 2, tg = atk && num(b[4]) ? byId(b[4]) : null, kind = atk ? 'attack' : 'move';
      if ((!atk || (tg && tg.alive && tg.team !== c.team)) && G.time - b[5] <= LIFE[kind]) {
        const y = okY(b[2], b[1], b[3]), o0 = S0 && S0.o;
        // 같은 지시: 보낸 쪽 좌표가 바뀔 때만 따른다 — 이 기기(방장) 봇이 목표를 보고 옮긴 공격 위치(track)를 3초마다 예전 자리로 되돌리지 않게
        if (o0 && o0.kind === kind && o0.t === b[5] && (o0.target || null) === tg) { if (o0.sx !== b[1] || o0.sz !== b[3]) { o0.x = o0.sx = b[1]; o0.y = y; o0.z = o0.sz = b[3]; } S.o = o0; }
        else S.o = { kind, x: b[1], y, z: b[3], t: b[5], target: tg || undefined, sx: b[1], sz: b[3] };
      }
    }
    const d = e.dg;
    if (Array.isArray(d) && okXZ(d[0], d[2]) && okT(d[3]) && G.time - d[3] <= DG_LIFE) {
      const g0 = S0 && S0.dg;
      S.dg = g0 && g0.t === d[3] && g0.x === d[0] && g0.z === d[2] ? g0 : { x: d[0], y: okY(d[1], d[0], d[2]), z: d[2], t: d[3] };
    }
    c.pg = S; held.add(c);
    const o0 = S0 && S0.o, newO = !!S.o && S.o !== o0, newDg = !!S.dg && S.dg !== (S0 && S0.dg), newMk = !!S.mk && S.mk !== (S0 && S0.mk), fol = !!e.f && fresh;
    if (newO || (o0 && !S.o) || fol) wake(c, true);
    if (newDg) wake(c, false);
    if (e.h || !sameTeam(p, c) || G.state !== 'play') return;   // 다시 보낸 것 · 다른 팀(방장 기기 — 봇 지시만) · 결과 화면: 조용히
    if (newDg) { HUD.toast(`${c.name}: 위험! ${where(S.dg.x, S.dg.z)}`, 'warn'); Audio.ping('danger'); }
    else if (newO) {
      if (S.o.kind === 'attack') { if (G.spotted) G.spotted.set(S.o.target, { x: S.o.x, z: S.o.z, t: G.time }); HUD.toast(`${c.name}: 적 위치 · ${where(S.o.x, S.o.z)}`, 'warn'); }
      else HUD.toast(`${c.name}: 이동 지점 · ${where(S.o.x, S.o.z)}`, 'info');
      Audio.ping(S.o.kind);
    } else if (fol) { HUD.toast(`${c.name}: 모여!`, 'info'); Audio.ping('follow'); }
    else if (newMk) { HUD.toast(`${c.name}: 지도 마커 · ${where(S.mk.x, S.mk.z)}`, 'info'); Audio.ui(); }
  }
  // 방장 기기: 핑을 찍은 사람의 팀원 봇이 바로 다시 생각하게 (09_player.js setTeamOrder · setDanger 와 같게)
  //  ord: 이동·공격·모여 → 그 사람을 따라다니는 봇만 · 위험 → 그 팀 봇 모두
  function wake(c, ord) {
    for (const m of teamMembers(c)) {
      const br = m.brain; if (!br || m === G.player || !standing(m)) continue;
      if (!ord) { br.thinkT = 0; br.holdCover = null; continue; }
      if ((br.followC || G.player) !== c) continue;
      br.thinkT = 0; br.goal = null; br.path = null; br.wantPath = null;
      if (br.investigate && br.investigate.kind === 'order') br.investigate = null;
      if (br.state === 'ORDER' || br.state === 'FOLLOW' || br.state === 'MOVE' || br.state === 'EXPLORE' || br.state === 'LOOT') br.setState('EXPLORE');
    }
  }

  // ---------- 팀원 봇 (07_bot.js) ----------
  // 봇이 적을 보면: 그 적을 노린 같은 팀 사람의 공격 지시 위치를 새로 (내 것은 다음 다시 보내기 때 팀원에게도)
  function track(c, o) {
    for (const m of teamMembers(c)) {
      if (m !== G.player && !m.human) continue;
      const ord = ordOf(m); if (ord && ord.kind === 'attack' && ord.target === o) { ord.x = o.pos.x; ord.z = o.pos.z; }
    }
  }
  // 이 봇이 경계할 위험 표시: 같은 팀 사람(나 · 다른 기기 사람) 것 중 가장 가까운 것
  function dangerFor(c) {
    let best = null, bd = Infinity;
    for (const m of teamMembers(c)) {
      if (m !== G.player && !m.human) continue;
      const dg = dgOf(m); if (!dg) continue;
      const d = Math.hypot(dg.x - c.pos.x, dg.z - c.pos.z); if (d < bd) { bd = d; best = dg; }
    }
    return best;
  }

  // ---------- 화면 표식 + 3D 점 (매 프레임 · 10_hud.js updateTeam) ----------
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  // 점·링 재질은 모두 같은 셰이더 (링도 위를 보는 앞면만 — 양면이면 셰이더가 하나 더 생긴다)
  const mat = (op) => new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: op, depthWrite: false });
  function geo() { if (!dotG) { dotG = new THREE.SphereGeometry(1, 12, 8); ringG = new THREE.RingGeometry(0.72, 1, 32).rotateX(-Math.PI / 2); } }
  function mkTag(box) {
    const el = document.createElement('div'), i = document.createElement('i'), b = document.createElement('b'), s = document.createElement('span');
    el.className = 'pg'; el.hidden = true; i.appendChild(b); el.appendChild(i); el.appendChild(s); box.appendChild(el);
    geo(); const dm = mat(0.95), rm = mat(0.6), dot = new THREE.Mesh(dotG, dm), ring = new THREE.Mesh(ringG, rm); dot.visible = ring.visible = false;
    return { el, b, s, dm, rm, dot, ring, f: -1, on: false, kind: '', col: '', m: null, tx: '', tf: '', ang: '', edge: false, flip: false, x: NaN, z: NaN, y0: NaN, gy: 0, ph: Math.random() };
  }
  // 첫 핑 때 셰이더를 만드느라 한 박자 멈추지 않게: 경기 시작 뒤 처음 몇 프레임 동안 보이지 않는(투명) 점 하나를 카메라 앞에 그려 둔다
  function warmUp() {
    if (warmN > 3 || !G.scene || !G.camera) return;
    if (!warmM) { geo(); warmM = new THREE.Mesh(dotG, mat(0)); warmM.scale.setScalar(0.01); }
    if (warmM.parent !== G.scene) G.scene.add(warmM);
    G.camera.getWorldDirection(_v); warmM.position.copy(G.camera.position).addScaledVector(_v, 2);
    if (++warmN > 3) G.scene.remove(warmM);
  }
  // 화면 자리: 카메라 앞이면 투영한 x·y (시야 끝 far 너머여도 x·y 는 맞다 — project() 의 z<1 대신 앞뒤만 본다), 화면 밖·뒤면 가장자리 + 방향
  //  W2·H2: 화면 크기 (hud 가 한 번 읽어 넘김 — 표식마다 읽으면 앞 표식의 글자·위치 변경 때문에 배치 계산을 강제할 수 있음)
  function place(T, x, y, z, W2, H2) {
    const cam = G.camera;
    _v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    let edge = true, sx = 0, sy = 0;
    if (_v.z < -0.3) { _w.copy(_v).applyMatrix4(cam.projectionMatrix); if (Math.abs(_w.x) < 0.97 && Math.abs(_w.y) < 0.95) { edge = false; sx = (_w.x + 1) / 2 * W2; sy = (1 - _w.y) / 2 * H2; } }
    if (edge) {
      let dx = _v.x, dy = _v.y; if (Math.hypot(dx, dy) < 1e-3) { dx = 0; dy = -1; }   // 바로 뒤 → 아래쪽
      const mx = W2 / 2 - 46, my = H2 / 2 - 40, k = Math.min(mx / Math.max(1e-6, Math.abs(dx)), my / Math.max(1e-6, Math.abs(dy)));
      sx = W2 / 2 + dx * k; sy = H2 / 2 - dy * k;
      const a = Math.atan2(-dy, dx).toFixed(2) + 'rad'; if (T.ang !== a) { T.ang = a; T.el.style.setProperty('--ang', a); }
    }
    if (edge !== T.edge) { T.edge = edge; T.el.classList.toggle('edge', edge); }
    const flip = sx > W2 - 110; if (flip !== T.flip) { T.flip = flip; T.el.classList.toggle('flip', flip); }   // 오른쪽 끝: 글자를 점 왼쪽에
    const tf = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px)`; if (T.tf !== tf) { T.tf = tf; T.el.style.transform = tf; }
  }
  // 한 표시: slot = 'mk' | 'o' | 'dg' (사람마다 하나씩), kind = 'mk' | 'mv' | 'at' | 'dg', y 가 없으면 땅(지붕 · 물 위) 높이
  function put(box, m, slot, kind, col, x, y, z, vp, W2, H2) {
    const key = m.id * 4 + SLOT[slot]; let T = tags.get(key);
    if (!T) { T = mkTag(box); tags.set(key, T); }
    T.f = frame; if (!T.on) { T.on = true; T.el.hidden = false; }
    if (T.kind !== kind || T.m !== m) { T.kind = kind; T.m = m; T.el.className = 'pg pg-' + kind + (T.edge ? ' edge' : '') + (T.flip ? ' flip' : ''); T.b.textContent = kind === 'dg' ? '!' : kind === 'mk' && G.teamSize > 1 ? String(m.slot + 1) : ''; T.tx = ''; }
    if (T.col !== col) { T.col = col; T.el.style.setProperty('--pc', col); T.dm.color.set(col); T.rm.color.set(col); }
    if (T.x !== x || T.z !== z || T.y0 !== y) { T.x = x; T.z = z; T.y0 = y; T.gy = num(y) ? y : kind === 'mk' ? Math.max(groundAt(x, z, 9999), WATER_Y) : Math.max(heightAt(x, z), WATER_Y); }
    const gy = T.gy, cam = G.camera, cp = cam.position, d = Math.hypot(x - cp.x, gy - cp.y, z - cp.z), sc = G.scene;
    // 3D: 점(멀수록 조금 크게 — 화면에서 몇 화소는 되게) + 바닥에서 퍼지는 링 · 시야 끝 너머는 화면 표식만
    const near = !!sc && d < cam.far * 0.95; T.dot.visible = T.ring.visible = near;
    if (near) {
      if (T.dot.parent !== sc) { sc.add(T.dot); sc.add(T.ring); }
      const r = clamp(d * 0.0045, 0.2, 1.4), ph = (G.time * 0.8 + T.ph) % 1, rr = Math.max(0.9, d * 0.006) * (0.45 + ph * 1.5);
      T.dot.position.set(x, gy + 0.3 + r, z); T.dot.scale.setScalar(r);
      T.dm.opacity = kind === 'dg' && Math.floor(G.time * 4) % 2 ? 0.4 : 0.95;
      T.ring.position.set(x, gy + 0.12, z); T.ring.scale.set(rr, 1, rr); T.rm.opacity = 0.75 * (1 - ph);
    }
    place(T, x, gy + 1.3, z, W2, H2);
    const txt = NAME[kind] + ' · ' + fmt(Math.hypot(x - vp.x, z - vp.z)); if (T.tx !== txt) { T.tx = txt; T.s.textContent = txt; }
  }
  function hud(p) {
    const box = $('pingTags'); if (!box || !G.camera) return;
    frame++; G.camera.updateMatrixWorld(); warmUp();
    const vp = viewPos(), team = G.teams && G.teams[p.team] ? G.teams[p.team].members : [p], W2 = innerWidth, H2 = innerHeight;
    for (const m of team) {
      if (m !== p && !(m.pg && live(m))) continue;
      const col = colorOf(m), mk = mkOf(m), o = ordOf(m), dg = dgOf(m);
      if (mk) put(box, m, 'mk', 'mk', col, mk.x, undefined, mk.z, vp, W2, H2);
      if (o) put(box, m, 'o', o.kind === 'attack' ? 'at' : 'mv', col, o.x, o.kind === 'attack' ? undefined : o.y, o.z, vp, W2, H2);
      if (dg) put(box, m, 'dg', 'dg', col, dg.x, dg.y, dg.z, vp, W2, H2);
    }
    for (const T of tags.values()) if (T.on && T.f !== frame) { T.on = false; T.el.hidden = true; T.dot.visible = T.ring.visible = false; }
  }

  // ---------- 지도 (10_hud.js drawMapLayer — 미니맵·전체 지도) ----------
  //  마커 = 핀 · 이동 = 마름모 · 공격 = 붉은 테 마름모 · 위험 = 깜빡이는 붉은 테 원 + ! — 모두 찍은 팀원 번호 색 (전체 지도의 핀에는 번호)
  function drawMap(ctx, toPx, opts) {
    const p = G.player; if (!p) return;
    const team = G.teams && G.teams[p.team] ? G.teams[p.team].members : [p], big = !!opts.labels, blink = Math.floor(G.time * 4) % 2;
    for (let pass = 0; pass < 3; pass++) for (const m of team) {
      if (m !== p && !(m.pg && live(m))) continue;
      const col = colorOf(m);
      ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      if (pass === 0) {
        const mk = mkOf(m); if (!mk) continue;
        const [x, y] = toPx(mk.x, mk.z), r = big ? 7 : 5, cy = y - r * 1.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, cy, r, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (big && G.teamSize > 1) { ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(r * 1.5)}px 'Saira Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(m.slot + 1), x, cy + 0.5); ctx.textBaseline = 'alphabetic'; }
      } else if (pass === 1) {
        const o = ordOf(m); if (!o) continue;
        const [x, y] = toPx(o.x, o.z), r = big ? 8 : 6, atk = o.kind === 'attack';
        if (atk) { ctx.strokeStyle = '#e0453a'; ctx.lineWidth = 2.5; }
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (atk) { ctx.fillStyle = '#e0453a'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill(); }
      } else {
        const dg = dgOf(m); if (!dg) continue;
        const [x, y] = toPx(dg.x, dg.z), r = big ? 9 : 7;
        ctx.strokeStyle = blink ? '#e0453a' : '#111'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.font = `800 ${Math.round(r * 1.5)}px 'Saira Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 0.5); ctx.textBaseline = 'alphabetic';
      }
    }
  }
  // 경기 시작(HUD.reset)·경기 정리(disposeMatch): 표식을 숨기고 보낸·받은 상태를 비움 (캐릭터는 경기마다 새로 — c.pg 도 없음)
  //  점·링은 장면에서 떼어 둔다 — 붙어 있으면 지난 경기 장면 전체가 메모리에 남는다 (다음에 그 표식을 쓸 때 새 장면에 다시 붙음)
  function reset() {
    for (const T of tags.values()) { T.on = false; T.el.hidden = true; T.dot.visible = T.ring.visible = false; T.m = null; T.kind = ''; if (T.dot.parent) T.dot.parent.remove(T.dot); if (T.ring.parent) T.ring.parent.remove(T.ring); }
    if (warmM && warmM.parent) warmM.parent.remove(warmM);
    held.clear(); seen.fill(null); sent.fill(null); follow = false; sentT = -99; chgT = acc; warmN = 0;
  }
  return { hasMates, followed, update, onNet, track, dangerFor, ordOf, hud, drawMap, reset, live, get tags() { return tags; }, get seq() { return seq; } };
})();
