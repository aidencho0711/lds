// ============================================================
// 10_hud.js — HUD, 미니맵/전체지도, 인벤토리, 메뉴/설정/결과, 로비 UI
//  모든 표시값은 실제 게임 상태(G, 캐릭터, Zone)에서 매 프레임 읽어 온다.
// ============================================================
const $ = (id) => document.getElementById(id);
const HUD = (() => {
  let loot = [], focusIdx = 0, lastHp = 100, lastLootKey = '', toastQ = [];
  const modals = ['mapPanel', 'invPanel', 'pausePanel', 'settingsPanel', 'helpPanel', 'resultPanel', 'layoutEditor', 'rankPanel', 'matchCfgPanel', 'mapPickPanel'];
  const ico = (id, att, cls = 'ico') => { const w = h('span', cls), src = Models.icon(id, att); if (src) { const im = h('img'); im.src = src; im.alt = ''; im.draggable = false; w.appendChild(im); } return w; };
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  function modalOpen() { return modals.some(id => !$(id).hidden); }
  function toast(msg, kind = '') {
    if (!msg) return;
    const box = $('toasts');
    if (toastQ.length && toastQ[toastQ.length - 1].msg === msg) return;
    const e = h('div', 'toast ' + kind, msg); box.appendChild(e);
    const item = { msg, e }; toastQ.push(item);
    const max = IS_TOUCH ? 2 : 3; // 모바일은 화면을 덜 가리게 2줄·짧게
    while (box.children.length > max) { box.removeChild(box.firstChild); toastQ.shift(); }
    setTimeout(() => { if (e.parentNode) e.parentNode.removeChild(e); toastQ = toastQ.filter(t => t !== item); }, IS_TOUCH ? 1900 : 2400);
  }
  function damage(fromPos, amount) {
    if (!fromPos || !G.player) return;
    const p = G.player, ang = Math.atan2(fromPos.x - p.pos.x, fromPos.z - p.pos.z);
    const rel = angleDiff(p.yaw, ang); // 왼쪽(+)/오른쪽(-)
    const e = h('div', 'dmg'); e.style.transform = `rotate(${-rel}rad)`; e.style.opacity = clamp(amount / 25, 0.4, 1);
    $('dmgRing').appendChild(e); setTimeout(() => e.remove(), 1400);
  }
  let hmT = 0;
  function hitmarker(head, kill) { const e = $('hitmark'); e.className = kill ? 'kill' : head ? 'head' : ''; e.style.opacity = 1; hmT = kill ? 0.45 : 0.18; }
  // kind: '' 처치 / 'knock' 기절 / 'wipe' 팀 전멸로 탈락. mate: 피해자가 내 팀원
  function killfeed(killer, victim, weapon, byPlayer, playerDied, kind, mate) {
    const box = $('killfeed'), e = h('div', 'kf' + (byPlayer ? ' mine' : '') + (playerDied || mate ? ' dead' : '') + (kind === 'knock' ? ' knock' : ''));
    if (killer) { e.append(killer); e.appendChild(h('em', '', (weapon || '▸') + (kind === 'knock' ? ' · 기절' : kind === 'wipe' ? '' : ''))); e.append(victim); }
    else { e.append(victim); e.appendChild(h('em', '', kind === 'knock' ? (weapon ? weapon + '(으)로 기절' : '기절') : weapon ? weapon + '(으)로 탈락' : '탈락')); }
    box.prepend(e); while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => e.remove(), 7000);
    if (byPlayer) toast(kind === 'knock' ? `${victim} 기절` : `${victim} 처치`, 'ok');
  }
  function setLoot(list) {
    loot = list; const key = list.map(i => i.id + i.count).join(',');
    if (focusIdx >= list.length) focusIdx = 0;
    if (key === lastLootKey) return; lastLootKey = key;
    const box = $('lootList'); box.innerHTML = '';
    list.forEach((it, i) => {
      const b = h('button', 'loot' + (i === focusIdx ? ' focus' : ''));
      b.appendChild(ico(it.id, it.inst && it.inst.att, ITEMS[it.id].type === 'weapon' ? 'ico wide sm' : 'ico sm'));
      b.appendChild(h('span', 'lt', itemLabel(it))); b.appendChild(h('span', 'micro', i === 0 ? (IS_TOUCH ? '줍기' : 'F') : ''));
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (it.alive && G.player) doPickup(G.player, it); });
      box.appendChild(b);
    });
    if (!$('invPanel').hidden) renderInventory();
  }
  function focusItem() { return loot[focusIdx] && loot[focusIdx].alive ? loot[focusIdx] : null; }

  // ---------- 모바일 회복·투척 빠른 선택 (버튼 위에 펼침) ----------
  const QUICK = { heal: ['bandage', 'firstaid', 'medkit', 'drink'], throw: ['frag', 'smoke'] };
  const SHORT = { bandage: '붕대', firstaid: '구급상자', medkit: '의료 키트', drink: '드링크', frag: '수류탄', smoke: '연막탄' };
  let quickT = 0;
  function closeQuick() { const q = $('qpop'); if (q && !q.hidden) { q.hidden = true; q.dataset.kind = ''; } quickT = 0; }
  function quick(kind, el) {
    const p = G.player; if (!p || !p.alive || p.knocked || G.state !== 'play') return;
    if (kind === 'heal' && p.heal) { p.heal = null; toast('회복 취소'); closeQuick(); return; }
    if (kind === 'throw' && p.throwMode) { exitThrow(p); closeQuick(); return; }
    const pop = $('qpop');
    if (!pop.hidden && pop.dataset.kind === kind) { closeQuick(); return; }
    if (kind === 'throw' && (p.veh || p.mode !== 'ground')) { toast('차량에서는 투척할 수 없습니다'); return; }
    const have = QUICK[kind].filter((id) => p.inv.count(id) > 0);
    if (!have.length) { toast(kind === 'heal' ? '회복 아이템이 없습니다' : '투척 무기가 없습니다'); return; }
    pop.innerHTML = ''; pop.dataset.kind = kind;
    for (const id of have) {
      const d = ITEMS[id], capped = d.type === 'heal' && p.hp >= d.cap;
      const b = h('button', 'qi' + (capped ? ' off' : '') + (kind === 'throw' && p.inv.throwSel === id ? ' sel' : ''));
      b.appendChild(ico(id, null, 'ico'));
      b.appendChild(h('span', 'qn', SHORT[id])); b.appendChild(h('b', 'qc', String(p.inv.count(id))));
      if (capped) b.appendChild(h('small', 'qx', d.cap === 100 ? '가득' : d.cap + '까지'));
      else if (d.type === 'heal') b.appendChild(h('small', 'qx', `+${d.heal} · ${d.time}초`));
      else if (d.type === 'boost') b.appendChild(h('small', 'qx', `부스트 · ${d.time}초`));
      else b.appendChild(h('small', 'qx', `${FUSE[id]}초 신관`));
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); closeQuick();
        if (kind === 'heal') { if (p.veh && p.seat === 0 && Math.hypot(p.veh.vx, p.veh.vz) > 0.8) toast('차량을 멈춘 뒤 사용할 수 있습니다'); else useConsumable(p, id); }
        else enterThrow(p, id);
      });
      pop.appendChild(b);
    }
    pop.hidden = false;
    // 버튼 바로 위에 가로로. 위 공간이 없으면(버튼이 화면 위쪽) 버튼 옆으로
    const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, W = innerWidth, H = innerHeight;
    let x = r.left + r.width / 2 - pw / 2, y = r.top - ph - 8;
    if (y < 6) { y = r.top + r.height / 2 - ph / 2; x = r.left + r.width / 2 < W / 2 ? r.right + 8 : r.left - pw - 8; }
    pop.style.left = clamp(x, 6, W - pw - 6) + 'px'; pop.style.top = clamp(y, 6, H - ph - 6) + 'px';
    quickT = 6;
  }
  // ---------- 소리 방향 표시: 조준점 둘레에 주황 호 (발소리·총소리), 가까운 적 수류탄은 빨강 ----------
  let sndW = 0;
  function drawSound(p, dt) {
    const cv = $('sndCv'); if (!cv) return;
    const on = p.alive && !p.knocked && p.mode === 'ground' && !G.over && G.noises;
    const marks = [];
    if (on) {
      const best = new Map();
      for (const n of G.noises) {
        if (n.by === p || (n.by && sameTeam(p, n.by)) || n.kind === 'engine') continue;
        const age = G.time - n.t, step = n.kind === 'step', life = step ? 0.9 : 1.5; if (age < 0 || age > life) continue;
        const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z), maxD = step ? Math.min(n.r || 18, 30) : n.kind === 'blast' ? 260 : 230;
        if (d > maxD || d < 1.2) continue;
        const key = (n.by ? n.by.id : n.x.toFixed(0) + n.z.toFixed(0)) + (step ? 's' : 'g'), prev = best.get(key);
        if (!prev || prev.age > age) best.set(key, { n, age, d, step, life, maxD });
      }
      for (const m of best.values()) marks.push({ kind: m.step ? 'step' : 'shot', ang: Math.atan2(m.n.x - p.pos.x, m.n.z - p.pos.z), a: Math.min(1, (1 - m.age / m.life) * 1.25) * (m.step ? 0.78 * (1 - m.d / m.maxD * 0.45) : 0.9 * (1 - m.d / m.maxD * 0.5)) });
      for (const pr of PROJ) {
        if (pr.type !== 'frag' || pr.owner === p) continue;
        const d = Math.hypot(pr.x - p.pos.x, pr.z - p.pos.z); if (d > 11 || d < 0.3) continue;
        marks.push({ kind: 'nade', ang: Math.atan2(pr.x - p.pos.x, pr.z - p.pos.z), a: 0.65 + Math.sin(G.time * 14) * 0.3 });
      }
    }
    if (!marks.length) { if (sndW) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); sndW = 0; } return; }
    const S = 240, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S); sndW = 1;
    g.lineCap = 'round';
    for (const m of marks) {
      const rel = angleDiff(p.yaw, m.ang), phi = -Math.PI / 2 - rel;
      const R = m.kind === 'step' ? 70 : m.kind === 'shot' ? 82 : 56, span = (m.kind === 'step' ? 9 : m.kind === 'shot' ? 13 : 18) * DEG;
      const al = clamp(m.a, 0, 1), lw = m.kind === 'step' ? 3.5 : 5;
      // 밝은 하늘에서도 보이도록 옅은 그림자 테두리
      g.strokeStyle = `rgba(0,0,0,${al * 0.3})`; g.lineWidth = lw + 2.5; g.beginPath(); g.arc(S / 2, S / 2, R, phi - span, phi + span); g.stroke();
      g.strokeStyle = m.kind === 'nade' ? `rgba(255,70,50,${al})` : `rgba(255,145,45,${al})`;
      g.lineWidth = lw;
      g.beginPath(); g.arc(S / 2, S / 2, R, phi - span, phi + span); g.stroke();
      if (m.kind === 'shot') { g.lineWidth = 2; g.beginPath(); g.moveTo(S / 2 + Math.cos(phi) * (R + 5), S / 2 + Math.sin(phi) * (R + 5)); g.lineTo(S / 2 + Math.cos(phi) * (R + 13), S / 2 + Math.sin(phi) * (R + 13)); g.stroke(); }
      if (m.kind === 'step') for (const o of [-0.5, 0.5]) { g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(S / 2 + Math.cos(phi + o * span) * (R + 8), S / 2 + Math.sin(phi + o * span) * (R + 8), 1.8, 0, TAU); g.fill(); }
    }
  }
  // 신관 카운트다운: 핀을 뽑고 쥐고 있을 때 / 내가 던진 수류탄이 터지기 전까지
  function updateFuse(p) {
    const fh = $('fuseHud'), tm = p.alive && p.throwMode, nd = G.myNade;
    let left = null, total = 7, txt = '';
    if (tm) { total = FUSE[tm.type]; left = tm.pin ? FUSE[tm.type] - tm.cook : total; txt = IS_TOUCH ? (tm.pin ? '떼면 투척' : '누르면 핀 뽑기') : tm.pin ? `${ITEMS[tm.type].name} · 버튼을 떼면 투척` : `${ITEMS[tm.type].name} · 좌클릭: 누르면 핀 뽑기, 떼면 투척 · G 취소`; }
    else if (nd && PROJ.includes(nd)) { total = FUSE[nd.type]; left = nd.fuse - nd.t; txt = nd.type === 'frag' ? '폭발까지' : '연막까지'; }
    fh.hidden = left === null; if (left === null) return;
    const v = Math.max(0, left).toFixed(1); if ($('fuseNum').textContent !== v) $('fuseNum').textContent = v;
    if ($('fuseTxt').textContent !== txt) $('fuseTxt').textContent = txt;
    fh.classList.toggle('armed', !!(tm && tm.pin) || !tm); fh.classList.toggle('hot', left < 2 && (!tm || tm.pin));
    $('fuseArc').style.strokeDashoffset = (106.8 * (1 - clamp(left / total, 0, 1))).toFixed(1);
  }
  const setLbl = (id, t) => { const b = $(id); if (b && b.textContent !== t) b.textContent = t; };
  // ---------- 매 프레임 갱신 ----------
  let compassBuilt = false, bigT = 0, sgR = -1;
  function buildCompass() {
    const s = $('compassStrip'); s.innerHTML = '';
    const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let k = -2; k <= 2; k++) for (let d = 0; d < 360; d += 15) { const e = h('span', lab[d] ? 'c' : '', lab[d] || String(d)); s.appendChild(e); }
    compassBuilt = true;
  }
  // ---------- 팀 HUD ----------
  const _tp = new THREE.Vector3();
  function teamColor(c) { return TEAM_COLORS[c.slot % TEAM_COLORS.length]; }
  function updateTeam(p) {
    const on = G.teamSize > 1 && G.teams, panel = $('teamPanel'), tags = $('teamTags');
    panel.hidden = !on; tags.hidden = !on; if (!on) return;
    const ms = G.teams[p.team].members;
    if (panel.dataset.k !== String(ms.length)) {
      panel.dataset.k = String(ms.length); panel.innerHTML = ''; tags.innerHTML = '';
      const hd = h('div', 'tord'); hd.appendChild(h('span', 'tol', '따라오기'));
      const x = h('button', 'tox', '✕'); x.type = 'button'; x.title = '지시 취소 (모여)';
      x.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.teamOrder) setTeamOrder({ kind: 'follow' }); });
      hd.appendChild(x); panel.appendChild(hd);
      for (const m of ms) {
        const r = h('div', 'tm'); r.style.setProperty('--tc', teamColor(m));
        r.appendChild(h('b', 'tn', String(m.slot + 1))); const nm = h('span', 'tnm', m.isPlayer ? '나' : m.name); r.appendChild(nm);
        const bar = h('div', 'thp'); bar.appendChild(h('i')); r.appendChild(bar); panel.appendChild(r);
        if (!m.isPlayer) { const t = h('div', 'ttag'); t.style.setProperty('--tc', teamColor(m)); t.appendChild(h('b', '', String(m.slot + 1))); t.appendChild(h('span')); tags.appendChild(t); }
      }
    }
    const cam = G.camera, W2 = window.innerWidth, H2 = window.innerHeight;
    let ti = 0;
    const ord = G.teamOrder, hd = panel.firstChild, ol = ord ? (ord.kind === 'attack' ? `공격 · ${ord.target.name}` : '이동 지점 경계') : '따라오기';
    if (hd.firstChild.textContent !== '명령: ' + ol) hd.firstChild.textContent = '명령: ' + ol;
    hd.className = 'tord' + (ord ? ' on ' + ord.kind : '');
    ms.forEach((m, i) => {
      const r = panel.children[i + 1], st = !m.alive ? 'dead' : m.knocked ? 'down' : m.revivedBy && m.revivedBy.revive ? 'down rev' : '';
      const cls = 'tm ' + st + (m === G.spec ? ' spec' : '');
      if (r.className !== cls) r.className = cls;
      r.lastChild.firstChild.style.width = (m.alive ? clamp(m.hp, 0, 100) : 0) + '%';
      if (m.isPlayer) return;
      const t = tags.children[ti++];
      const show = m.alive && m.mode !== 'plane' && (p.alive || m !== G.spec);
      if (show) {
        _tp.set(m.pos.x, m.pos.y + (m.anim.prone > 0.5 ? 1.0 : m.veh ? 2.4 : 2.15), m.pos.z).project(cam);
        const vis = _tp.z < 1 && Math.abs(_tp.x) < 1.05 && Math.abs(_tp.y) < 1.05;
        t.hidden = !vis;
        if (vis) {
          t.style.transform = `translate(${((_tp.x + 1) / 2 * W2).toFixed(0)}px, ${((1 - _tp.y) / 2 * H2).toFixed(0)}px)`;
          const vc = G.viewChar(), d = Math.round(Math.hypot(m.pos.x - vc.pos.x, m.pos.z - vc.pos.z));
          const txt = (m.knocked ? '✚ 기절 · ' : '') + m.name + (d > 25 ? ` ${d}m` : '');
          if (t.lastChild.textContent !== txt) t.lastChild.textContent = txt;
          t.classList.toggle('down', m.knocked);
        }
      } else t.hidden = true;
    });
    updatePing(p);
  }
  // 핑 표시: 3D 기둥 + 화면 표식(종류·거리)
  let pingMesh = null;
  let dangerMesh = null;
  function updateDanger(p) {
    const dg = G.danger, tg = $('dangerTag');
    if (!dangerMesh) dangerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xe0453a, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    if (G.scene && dangerMesh.parent !== G.scene) G.scene.add(dangerMesh);
    dangerMesh.visible = !!dg; tg.hidden = !dg; if (!dg) return;
    const gy = dg.y !== undefined ? dg.y : heightAt(dg.x, dg.z);
    dangerMesh.position.set(dg.x, gy + 35, dg.z); dangerMesh.material.opacity = 0.3 + (Math.floor(G.time * 4) % 2) * 0.3;
    _tp.set(dg.x, gy + 2.4, dg.z).project(G.camera);
    const vis = _tp.z < 1 && Math.abs(_tp.x) < 1.1 && Math.abs(_tp.y) < 1.1; tg.style.visibility = vis ? '' : 'hidden';
    if (vis) tg.style.transform = `translate(${((_tp.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - _tp.y) / 2 * innerHeight).toFixed(0)}px)`;
    const vc = G.viewChar ? G.viewChar() : p, txt = `위험 · ${Math.round(Math.hypot(dg.x - vc.pos.x, dg.z - vc.pos.z))}m`;
    if (tg.lastChild.textContent !== txt) tg.lastChild.textContent = txt;
  }
  function updatePing(p) {
    updateDanger(p);
    const ord = G.teamOrder, tg = $('pingTag');
    if (!pingMesh) pingMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    if (G.scene && pingMesh.parent !== G.scene) G.scene.add(pingMesh);
    pingMesh.visible = !!ord; tg.hidden = !ord; if (!ord) return;
    const atk = ord.kind === 'attack', gy = ord.y !== undefined && !atk ? ord.y : heightAt(ord.x, ord.z);
    pingMesh.material.color.setHex(atk ? 0xe0453a : 0xf2c94c); pingMesh.position.set(ord.x, gy + 30, ord.z);
    pingMesh.material.opacity = 0.35 + Math.sin(G.time * 6) * 0.12;
    _tp.set(ord.x, gy + 2.2, ord.z).project(G.camera);
    const vis = _tp.z < 1 && Math.abs(_tp.x) < 1.1 && Math.abs(_tp.y) < 1.1; tg.style.visibility = vis ? '' : 'hidden';
    if (vis) tg.style.transform = `translate(${((_tp.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - _tp.y) / 2 * innerHeight).toFixed(0)}px)`;
    const vc = G.viewChar ? G.viewChar() : p, d = Math.round(Math.hypot(ord.x - vc.pos.x, ord.z - vc.pos.z)), txt = `${atk ? '공격' : '이동'} · ${d}m`;
    if (tg.lastChild.textContent !== txt) tg.lastChild.textContent = txt; tg.className = atk ? 'atk' : '';
  }
  // 팀원(또는 내가 핑으로) 발견한 적: 미니맵에 6초 표시, 팀원이 발견하면 '적 발견' 알림 (8초에 한 번)
  let spotCallT = -99;
  const DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  function dirName(dx, dz) { let deg = (180 - Math.atan2(dx, dz) * 180 / Math.PI) % 360; if (deg < 0) deg += 360; return DIRS[Math.round(deg / 45) % 8]; }
  function spot(o, by) {
    if (!G.spotted) return; G.spotted.set(o, { x: o.pos.x, z: o.pos.z, t: G.time });
    const p = G.player;
    if (by !== p && p && G.time - spotCallT > 8) {
      spotCallT = G.time; const vc = G.viewChar ? G.viewChar() : p, dx = o.pos.x - vc.pos.x, dz = o.pos.z - vc.pos.z;
      toast(`${by.name}: 적 발견! ${dirName(dx, dz)}쪽 ${Math.round(Math.hypot(dx, dz))}m`, 'warn');
    }
  }
  function update(dt) {
    const p = G.player; if (!p) return;
    const spec = !p.alive && G.spec && G.spec.alive && !G.over;
    document.body.classList.toggle('knocked', p.alive && p.knocked);
    document.body.classList.toggle('teammode', G.teamSize > 1);
    document.body.classList.toggle('spectating', !!spec);
    updateTeam(p);
    // 기절 / 관전 표시
    const kh = $('knockHud'); kh.hidden = !(p.alive && p.knocked);
    if (!kh.hidden) {
      // 부활받는 중이면 막대가 초록 부활 진행도로 바뀐다
      const rv = p.revivedBy && p.revivedBy.revive, kb = $('knockBar');
      kb.style.width = (rv ? clamp(rv.t / rv.total, 0, 1) * 100 : clamp(p.hp, 0, 100)) + '%'; kb.classList.toggle('rev', !!rv);
      const t = rv ? `${p.revivedBy.name}이(가) 부활시키는 중… ${Math.ceil(rv.total - rv.t)}초` : '기절 — 팀원이 부활시켜 줄 때까지 버티세요';
      if ($('knockTxt').textContent !== t) $('knockTxt').textContent = t;
    }
    const sb = $('specBar'); sb.hidden = !spec;
    if (spec) { const t = `관전 중 · ${G.spec.name}${G.spec.knocked ? ' (기절)' : ''}`; if ($('specName').textContent !== t) $('specName').textContent = t; }
    // 체력
    const hp = Math.max(0, p.hp);
    $('hpFill').style.width = hp + '%'; $('hpLag').style.width = hp + '%';
    $('hpBar').classList.toggle('low', hp < 30);
    $('boostBar').style.width = p.boost + '%';
    // 장비
    const gr = $('gearRow'), g = p.inv.gear;
    const gearKey = ['helmet', 'vest', 'bag'].map(k => g[k] ? g[k].id + Math.round((g[k].dur || 0) / 10) : '-').join();
    if (gr.dataset.k !== gearKey) {
      gr.dataset.k = gearKey; gr.innerHTML = '';
      for (const k of ['helmet', 'vest', 'bag']) {
        if (!g[k]) continue; const d = ITEMS[g[k].id], e = h('div', 'gear');
        e.append({ helmet: '헬멧', vest: '조끼', bag: '가방' }[k] + ' ' + d.lvl);
        if (d.dur) { const bar = h('i'); bar.style.setProperty('--p', Math.round(g[k].dur / d.dur * 100) + '%'); e.appendChild(bar); }
        gr.appendChild(e);
      }
    }
    // 무기
    const wp = $('weaponPanel'), inv = p.inv;
    const wkey = inv.weapons.map(w => w ? w.id + ':' + w.mag + ':' + (w.fm || 0) + ':' + inv.count(ITEMS[w.id].ammo) + ':' + Object.values(w.att).join(',') : '-').join('|') + inv.cur + '|' + inv.count('frag') + inv.count('smoke') + inv.healCount() + inv.throwSel;
    if (wp.dataset.k !== wkey) {
      wp.dataset.k = wkey; wp.innerHTML = '';
      inv.weapons.forEach((w, i) => {
        if (!w) return; const d = ITEMS[w.id], e = h('div', 'wslot' + (i === inv.cur ? ' cur' : ''));
        e.appendChild(ico(w.id, w.att, 'ico wide wi'));
        e.appendChild(h('span', 'wn', `${i + 1}  ${d.name}`));
        if (d.modes.length > 1 || i === inv.cur) e.appendChild(h('span', 'wm', MODE_NAMES[fireMode(w)]));
        const a = h('span', 'wa'); a.append(String(w.mag)); a.appendChild(h('small', '', ' / ' + inv.count(d.ammo))); e.appendChild(a);
        wp.appendChild(e);
      });
      const meta = h('div', 'wmeta');
      meta.append(`${ITEMS[inv.throwSel].name.split(' ').pop()} ${inv.count(inv.throwSel)}`, ' · ', `회복 ${inv.count('bandage')}/${inv.count('firstaid')}/${inv.count('medkit')}`, ' · ', `음료 ${inv.count('drink')}`);
      wp.appendChild(meta);
    }
    // 카운터
    const alive = CHARS.filter(c => c.alive).length;
    $('alive').textContent = alive;
    const tc = $('teamsCtr'); tc.hidden = !(G.teamSize > 1); if (!tc.hidden) $('teamsAlive').textContent = aliveTeamCount(); $('kills').textContent = p.kills; $('mtime').textContent = fmtTime(G.time);
    // 자기장
    const zi = $('zoneInfo'), out = Zone.cur && !Zone.inside(p.pos.x, p.pos.z, Zone.cur);
    let zt = '';
    if (Zone.state === 'wait') zt = `자기장 대기 ${fmtTime(Zone.timer)}`;
    else if (Zone.state === 'shrink') zt = `자기장 축소 중 ${fmtTime(Zone.timer)}`;
    else zt = '최종 구역';
    if (Zone.next && p.mode === 'ground') { const d = Math.max(0, Math.hypot(p.pos.x - Zone.next.x, p.pos.z - Zone.next.z) - Zone.next.r); if (d > 0) zt += ` · 다음 구역까지 ${Math.round(d)}m`; }
    if (G.training) zt = '훈련장 · 메뉴에서 나가기';
    zi.textContent = zt; zi.className = 'zone-info' + (out ? ' out' : Zone.state === 'shrink' ? ' shrink' : '');
    $('zoneVignette').style.opacity = out && p.mode === 'ground' ? 1 : 0;
    // 나침반
    if (!compassBuilt) buildCompass();
    let deg = (180 - (p.yaw * 180 / Math.PI)) % 360; if (deg < 0) deg += 360; // 북쪽(-z) 기준 시계방향
    const px = 30 / 15, half = $('compass').clientWidth / 2;
    $('compassStrip').style.transform = `translateX(${half - (deg + 360 * 2) * px - 15}px)`;
    // 조준점
    const adsE = smoothstep01(Cam.ads), si = Cam.si, ground = p.mode === 'ground' && p.alive && (!p.veh || p.seat > 0) && !p.knocked;
    // 차량: 속도계·내구도 / 탑승 안내
    const v = p.alive ? p.veh : null, vh = $('vehHud');
    vh.hidden = !v;
    if (v) {
      const kmh = Math.round(Math.abs(v.f) * 3.6), hpP = Math.max(0, v.hp / v.T.hp * 100), key = v.type + p.seat + v.seats.map(Boolean).join();
      if (vh.dataset.k !== key) {
        vh.dataset.k = key; const occ = v.seats.filter(Boolean).length;
        $('vehName').textContent = p.seat === 0 ? `${v.T.name} · 최고 ${v.T.kmh}km/h · ${occ}/${v.seats.length}명` : `${v.T.name} · ${p.seat + 1}번 좌석(동승) · ${occ}/${v.seats.length}명`;
        $('vehKeys').textContent = p.seat === 0 ? 'W/S 가속·후진 · A/D 조향 · Space 핸드브레이크 · C 좌석 · F 하차' : '마우스 조준·사격 · R 장전 · C 좌석 · F 하차';
      }
      $('vehSpd').textContent = kmh; $('vehHp').style.width = hpP + '%'; vh.classList.toggle('low', hpP < 30 || v.burnT > 0);
    }
    const free = !v && p.alive && !p.knocked && p.mode === 'ground';
    const riding = !!v && p.seat > 0;
    const km = free && !p.revive ? nearestKnockedMate(p, 1.9) : null;
    const nv = free && !km ? Veh.nearestEnterable(p) : null, vp = $('vehPrompt');
    vp.hidden = !(nv || km);
    if (!vp.hidden) { const fs = nv ? Veh.freeSeats(nv) : 0, t = km ? `${IS_TOUCH ? '부활 버튼' : 'F'} · ${km.name} 부활 (${REVIVE_T}초)` : (IS_TOUCH ? '탑승 버튼' : 'F') + ' · ' + nv.T.name + ' ' + (nv.seats[0] ? `동승 (빈자리 ${fs})` : '탑승'); if (vp.textContent !== t) vp.textContent = t; }
    document.body.classList.toggle('driving', !!v && !riding); document.body.classList.toggle('riding', riding);
    const ib = $('tb_interact'); if (ib) { const lb = v ? '하차' : p.revive ? '취소' : km ? '부활' : nv ? '탑승' : '줍기'; if (ib.textContent !== lb) ib.textContent = lb; }
    if (IS_TOUCH || $('tb_jump')) {
      setLbl('tb_jump', p.vaultHint === 'vault' ? '넘기' : p.vaultHint === 'climb' ? '오르기' : '점프'); const jb = $('tb_jump'); if (jb) jb.classList.toggle('hint', !!p.vaultHint);
      setLbl('tb_heal', p.heal ? '취소' : '회복'); setLbl('tb_throw', p.throwMode ? '취소' : '투척');
      const fl = p.throwMode ? (p.throwMode.pin ? '던지기' : '핀 뽑기') : '사격'; setLbl('tb_fire', fl); setLbl('tb_fire2', fl);
      $('tbtns').classList.toggle('throwing', !!p.throwMode);
    }
    if (quickT > 0) { quickT -= dt; if (quickT <= 0 || !p.alive || p.knocked) closeQuick(); }
    drawSound(p, dt); updateFuse(p);
    const ch = $('crosshair'), spread = weaponSpread(p) || 1.5, gap = 4 + spread * 9;
    ch.style.display = ground && adsE < 0.3 ? '' : 'none'; ch.classList.toggle('nade', !!p.throwMode);
    // 산탄총: 펠릿이 퍼지는 실제 원(화면 px)에 맞춘 상하좌우 호
    const sg = !!(p.weapon && ITEMS[p.weapon.id].cls === 'SG');
    if (ch.classList.contains('sg') !== sg) ch.classList.toggle('sg', sg);
    if (sg) {
      const R = Math.round(clamp(window.innerHeight / 2 * Math.tan(spread * DEG) / Math.tan(G.camera.fov / 2 * DEG), 12, 150));
      if (sgR !== R) {
        sgR = R; const a = 25 * DEG; let d = '';
        for (const c of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) { const x0 = Math.cos(c - a) * R, y0 = Math.sin(c - a) * R, x1 = Math.cos(c + a) * R, y1 = Math.sin(c + a) * R; d += `M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
        ch.querySelector('.sgo').setAttribute('d', d); ch.querySelector('.sgi').setAttribute('d', d);
      }
    } else {
      ch.querySelector('.t').style.top = -(gap + 9) + 'px'; ch.querySelector('.b').style.top = gap + 'px';
      ch.querySelector('.l').style.left = -(gap + 9) + 'px'; ch.querySelector('.r').style.left = gap + 'px';
    }
    // 배율 조준경: 렌즈 밖은 검게, 안쪽에 조준선 / 레드닷·홀로: 유리 위에 빛나는 조준점
    const scopeOn = ground && si && si.mag && adsE > 0.72;
    const sc = $('scopeCv'); sc.hidden = !scopeOn;
    if (scopeOn) { if (scopeKey !== si.key + innerWidth + 'x' + innerHeight) { drawScope(si.key); scopeKey = si.key + innerWidth + 'x' + innerHeight; } sc.style.opacity = clamp((adsE - 0.72) / 0.22, 0, 1); }
    const rt = $('reticle'), dotOn = ground && si && (si.key === 'reddot' || si.key === 'holo') && adsE > 0.8 && !p.rl;
    rt.hidden = !dotOn;
    if (dotOn) { if (reticleKey !== si.key) { drawDot(si.key); reticleKey = si.key; } rt.style.opacity = clamp((adsE - 0.8) / 0.15, 0, 1); }
    const br = $('breath'); br.hidden = !(scopeOn && !IS_TOUCH && (si.key === 'x3' || si.key === 'x4' || si.key === 'x6'));
    if (!br.hidden) br.firstElementChild.style.width = Math.round(Cam.breath * 100) + '%';
    if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('hitmark').style.opacity = 0; }
    // 진행 표시 (재장전/회복/장착)
    let prog = null;
    if (p.revive) prog = [`${p.revive.tgt.name} 부활 중 · 움직이면 취소`, p.revive.t / p.revive.total];
    else if (p.rl) prog = [p.rl.kind === 'mag' || p.rl.kind === 'belt' ? '재장전' : `장전 ${p.weapon ? p.weapon.mag : 0}/${p.weapon ? p.inv.magSize(p.weapon) : 0}`, p.rl.t / p.rl.total];
    else if (p.heal) prog = [ITEMS[p.heal.id].name + ' 사용 중', 1 - p.heal.t / p.heal.total];
    $('progress').hidden = !prog;
    if (prog) { $('progLabel').textContent = prog[0]; $('progArc').style.strokeDashoffset = 106.8 * (1 - clamp(prog[1], 0, 1)); }
    // 강하 패널
    const dp = $('dropPanel');
    if (p.mode === 'plane' || p.mode === 'fall' || p.mode === 'chute') {
      dp.hidden = false;
      $('jumpBtn').hidden = p.mode !== 'plane'; $('chuteBtn').hidden = p.mode !== 'fall';
      const gh = p.mode === 'plane' ? G.plane.pos.y - heightAt(G.plane.pos.x, G.plane.pos.z) : p.pos.y - heightAt(p.pos.x, p.pos.z);
      $('dropInfo').textContent = p.mode === 'plane' ? `수송기 탑승 중 · 고도 ${Math.round(gh)}m · ${IS_TOUCH ? '미니맵을 눌러' : '지도(M)에서'} 착지 지점을 고르세요` : `고도 ${Math.round(gh)}m · 낙하 속도 ${Math.round(-p.vel.y)}m/s`;
    } else dp.hidden = true;
    const vc = G.viewChar ? G.viewChar() : p;
    if (!$('mapPanel').hidden) { bigT -= dt; if (bigT <= 0) { bigT = 0.3; drawBig(); } }
    $('coord').textContent = `X ${Math.round(vc.pos.x)}  Z ${Math.round(vc.pos.z)}  ·  ${gridRef(vc.pos.x, vc.pos.z)}`;
    drawMini();
  }
  function gridRef(x, z) { const c = 'ABCDEFGH'[clamp(Math.floor((x + HALF) / (SIZE / 8)), 0, 7)], r = clamp(Math.floor((z + HALF) / (SIZE / 8)), 0, 7) + 1; return c + r; }

  // ---------- 지도 그리기 ----------
  function drawMapLayer(ctx, S, toPx, scale, opts) {
    const p = G.player;
    // 자기장 밖 어둡게 + 현재/다음 구역
    if (Zone.cur) {
      const [zx, zy] = toPx(Zone.cur.x, Zone.cur.z);
      ctx.save(); ctx.fillStyle = 'rgba(30,70,170,0.32)'; ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.arc(zx, zy, Zone.cur.r * scale, 0, TAU, true); ctx.fill('evenodd'); ctx.restore();
      ctx.strokeStyle = '#5aa2ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(zx, zy, Zone.cur.r * scale, 0, TAU); ctx.stroke();
    }
    if (Zone.next) { const [nx, ny] = toPx(Zone.next.x, Zone.next.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(nx, ny, Zone.next.r * scale, 0, TAU); ctx.stroke(); }
    // 비행 경로
    if (G.plane && G.plane.active) {
      const pl = G.plane, [ax, ay] = toPx(pl.ax, pl.az), [bx, by] = toPx(pl.bx, pl.bz);
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      const [px2, py2] = toPx(pl.pos.x, pl.pos.z); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px2, py2, 4, 0, TAU); ctx.fill();
    }
    // 보급상자 (낙하 중엔 깜빡임)
    for (const m of Airdrop.markers()) {
      if (m.falling && Math.floor(G.time * 3) % 2) continue;
      const [cx, cy] = toPx(m.x, m.z), s = opts.labels ? 7 : 5;
      ctx.fillStyle = '#e2662a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.fillRect(cx - s, cy - s, s * 2, s * 2); ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
      ctx.fillStyle = '#f2ecd8'; ctx.fillRect(cx - s * 0.6, cy - 1, s * 1.2, 2); ctx.fillRect(cx - 1, cy - s * 0.6, 2, s * 1.2);
    }
    // 마커
    if (G.marker) { const [mx, my] = toPx(G.marker.x, G.marker.z); ctx.fillStyle = '#f0a43a'; ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my - 9, 5, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath(); ctx.fill(); }
    if (opts.labels) {
      ctx.font = `600 ${Math.round(S / 52)}px 'IBM Plex Sans KR', sans-serif`; ctx.textAlign = 'center';
      for (const poi of W.pois) { const [lx, ly] = toPx(poi.x, poi.z); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(poi.name, lx + 1, ly + 1); ctx.fillStyle = '#f2ecd8'; ctx.fillText(poi.name, lx, ly); }
      // 격자: 8×8 구역(A~H, 1~8) + 확대하면 100m/500m 보조선
      const span = opts.span || SIZE, cell = SIZE / 8, sub = span <= 1400 ? 100 : span <= 3200 ? 500 : 0;
      if (sub && sub < cell) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let v = -HALF + sub; v < HALF; v += sub) { const [a] = toPx(v, 0), [, b] = toPx(0, v); ctx.moveTo(a, 0); ctx.lineTo(a, S); ctx.moveTo(0, b); ctx.lineTo(S, b); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 1; i < 8; i++) { const [a] = toPx(-HALF + i * cell, 0), [, b] = toPx(0, -HALF + i * cell); ctx.moveTo(a, 0); ctx.lineTo(a, S); ctx.moveTo(0, b); ctx.lineTo(S, b); }
      ctx.stroke();
      ctx.font = `${Math.round(S / 70)}px 'Saira Condensed', sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 8; i++) { const [a] = toPx(-HALF + (i + 0.5) * cell, 0), [, b] = toPx(0, -HALF + (i + 0.5) * cell); if (a > 0 && a < S) ctx.fillText('ABCDEFGH'[i], a, 12); if (b > 0 && b < S) ctx.fillText(String(i + 1), 8, b); }
      // 축척 막대
      const bar = [50, 100, 200, 500, 1000, 2000].find((m) => m * scale > S * 0.12) || 2000, bx = S - 14 - bar * scale, by = S - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(bx - 6, by - 16, bar * scale + 12, 22);
      ctx.strokeStyle = '#f2ecd8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by); ctx.lineTo(bx + bar * scale, by); ctx.lineTo(bx + bar * scale, by - 4); ctx.stroke();
      ctx.fillStyle = '#f2ecd8'; ctx.fillText(bar >= 1000 ? bar / 1000 + 'km' : bar + 'm', bx + bar * scale / 2, by - 5);
    }
    // 팀원이 발견한 적 (빨간 삼각형, 6초) · 핑
    if (G.spotted && G.spotted.size) for (const [o, s0] of G.spotted) {
      const age = G.time - s0.t; if (age > 6 || !o.alive) { G.spotted.delete(o); continue; }
      const [x, y] = toPx(s0.x, s0.z), r = opts.labels ? 7 : 5;
      ctx.globalAlpha = clamp(1.4 - age / 6, 0.25, 1); ctx.fillStyle = '#e0453a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.87, y + r * 0.5); ctx.lineTo(x - r * 0.87, y + r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (G.danger) { // 위험 표시: 빨간 원 + 느낌표
      const [x, y] = toPx(G.danger.x, G.danger.z), r = opts.labels ? 9 : 7;
      ctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#e0453a' : '#ff8a7d'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${r * 1.5}px 'Saira Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 0.5); ctx.textBaseline = 'alphabetic';
    }
    if (G.teamOrder) {
      const o = G.teamOrder, [x, y] = toPx(o.x, o.z), r = opts.labels ? 8 : 6;
      ctx.fillStyle = o.kind === 'attack' ? '#e0453a' : '#f2c94c'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 팀원 (번호 색 점, 기절은 붉게 깜빡임)
    if (G.teamSize > 1 && G.teams && p) for (const m of G.teams[p.team].members) {
      if (m === p || !m.alive || m.mode === 'plane') continue;
      const [x, y] = toPx(m.pos.x, m.pos.z), r = opts.labels ? 6 : 5;
      ctx.fillStyle = m.knocked && Math.floor(G.time * 3) % 2 ? '#e0453a' : TEAM_COLORS[m.slot % TEAM_COLORS.length];
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      if (opts.labels) { ctx.fillStyle = '#111'; ctx.font = `700 ${r * 1.6}px 'Saira Condensed', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(m.slot + 1), x, y + 0.5); ctx.textBaseline = 'alphabetic'; }
    }
    // 플레이어 (위치 + 방향)
    if (p && p.alive) {
      const src = p.mode === 'plane' ? G.plane.pos : p.pos, [x, y] = toPx(src.x, src.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - p.yaw);
      if (opts.cone) { ctx.fillStyle = 'rgba(240,164,58,0.18)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, opts.cone, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#f0a43a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  function drawMini() {
    const cv = $('mini'), p0 = G.player; if (!W || !W.minimap || !p0) return;
    const p = G.viewChar ? G.viewChar() : p0;
    const S = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (cv.width !== S) { cv.width = cv.height = S; }
    const ctx = cv.getContext('2d');
    const src = p.mode === 'plane' ? G.plane.pos : p.pos;
    const R = p.mode === 'ground' ? (p.veh ? 240 : 110) : 260, scale = S / (R * 2);
    const img = W.minimap, k = img.width / SIZE;
    ctx.fillStyle = '#2c6474'; ctx.fillRect(0, 0, S, S);
    ctx.drawImage(img, (src.x - R + HALF) * k, (src.z - R + HALF) * k, R * 2 * k, R * 2 * k, 0, 0, S, S);
    const toPx = (x, z) => [(x - src.x + R) * scale, (z - src.z + R) * scale];
    drawMapLayer(ctx, S, toPx, scale, { cone: S * 0.22 });
    // 남은 자기장까지 방향 표시 (화면 밖이면 가장자리에 화살표)
    if (Zone.next && p.mode === 'ground') {
      const dx = Zone.next.x - p.pos.x, dz = Zone.next.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > Zone.next.r && d > R * 0.9) { const a = Math.atan2(dz, dx), ex = S / 2 + Math.cos(a) * S * 0.44, ey = S / 2 + Math.sin(a) * S * 0.44; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }
  // ---------- 전체 지도: 확대(휠·두 손가락·버튼)와 끌어서 이동 ----------
  const MV = { z: 1, cx: 0, cz: 0 };
  const mapMaxZ = () => (W && W.big ? 24 : 6);
  function clampView() { const h = SIZE / 2 / MV.z; MV.cx = clamp(MV.cx, -HALF + h, HALF - h); MV.cz = clamp(MV.cz, -HALF + h, HALF - h); }
  function viewToWorld(fx, fy) { const span = SIZE / MV.z; return [MV.cx + (fx - 0.5) * span, MV.cz + (fy - 0.5) * span]; } // fx,fy: 지도 안 비율(0~1)
  function zoomAt(f, fx, fy) {
    const [wx, wz] = viewToWorld(fx, fy);
    MV.z = clamp(MV.z * f, 1, mapMaxZ()); const span = SIZE / MV.z;
    MV.cx = wx - (fx - 0.5) * span; MV.cz = wz - (fy - 0.5) * span; clampView(); drawBig();
  }
  function centerOn(x, z) { MV.cx = x; MV.cz = z; clampView(); }
  function drawBig() {
    const cv = $('bigmap'); if (!W) return;
    const S = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)); if (cv.width !== S) cv.width = cv.height = S;
    clampView();
    const ctx = cv.getContext('2d'), span = SIZE / MV.z, x0 = MV.cx - span / 2, z0 = MV.cz - span / 2, scale = S / span;
    const img = W.minimap, k = img.width / SIZE;
    ctx.fillStyle = '#2c6474'; ctx.fillRect(0, 0, S, S); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, (x0 + HALF) * k, (z0 + HALF) * k, span * k, span * k, 0, 0, S, S);
    drawMapLayer(ctx, S, (x, z) => [(x - x0) * scale, (z - z0) * scale], scale, { labels: true, cone: 0, span });
    const mo = $('mapOrder'), showMo = G.teamSize > 1 && !!G.marker && !!G.player && G.player.alive; if (mo.hidden === showMo) mo.hidden = !showMo;
    const zv = $('mapZoomVal'), t = '×' + (MV.z < 10 ? MV.z.toFixed(1).replace(/\.0$/, '') : Math.round(MV.z)); if (zv.textContent !== t) zv.textContent = t;
  }
  function setupMapClick() {
    const cv = $('bigmap'), ptrs = new Map(); let drag = null, pinch = null;
    if (IS_TOUCH) $('mapHelp').textContent = '두 손가락으로 확대·축소, 끌어서 이동. 짧게 눌러 마커를 찍고, 같은 곳을 다시 누르면 지웁니다.';
    const frac = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: MV.cx, cz: MV.cz, moved: false };
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect();
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: MV.z }; if (drag) drag.moved = true;
        const mx = ((a[0] + b[0]) / 2 - r.left) / r.width, my = ((a[1] + b[1]) / 2 - r.top) / r.height; pinch.w = viewToWorld(mx, my);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const r = cv.getBoundingClientRect();
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        MV.z = clamp(pinch.z * d / pinch.d, 1, mapMaxZ()); const span = SIZE / MV.z;
        const mx = ((a[0] + b[0]) / 2 - r.left) / r.width, my = ((a[1] + b[1]) / 2 - r.top) / r.height;
        MV.cx = pinch.w[0] - (mx - 0.5) * span; MV.cz = pinch.w[1] - (my - 0.5) * span; clampView(); drawBig();
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved && MV.z > 1) { const span = SIZE / MV.z; MV.cx = drag.cx - dx / r.width * span; MV.cz = drag.cz - dy / r.height * span; clampView(); drawBig(); }
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        // 짧게 누르면 마커 찍기/지우기
        if (drag && !drag.moved && e.type === 'pointerup') {
          const [fx, fy] = frac(e), [x, z] = viewToWorld(fx, fy), near = 14 / Math.max(1, MV.z * 0.6);
          if (G.marker && Math.hypot(G.marker.x - x, G.marker.z - z) < near * (SIZE / 700)) G.marker = null; else G.marker = { x, z };
          G.updateMarker(); drawBig(); Audio.ui();
        }
        drag = null;
      } else if (ptrs.size === 1) { const [q] = [...ptrs.values()]; drag = { x: q[0], y: q[1], cx: MV.cx, cz: MV.cz, moved: true }; }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [fx, fy] = frac(e); zoomAt(e.deltaY < 0 ? 1.3 : 1 / 1.3, fx, fy); }, { passive: false });
    document.querySelectorAll('[data-mz]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); Audio.ui(); const k = b.dataset.mz;
      if (k === 'in') zoomAt(1.6, 0.5, 0.5); else if (k === 'out') zoomAt(1 / 1.6, 0.5, 0.5);
      else { const v = G.viewChar ? G.viewChar() : G.player, src = v && v.mode === 'plane' && G.plane ? G.plane.pos : v && v.pos; if (src) { if (MV.z < 2) MV.z = Math.min(4, mapMaxZ()); centerOn(src.x, src.z); drawBig(); } }
    }));
    // 지도 마커 → 팀원 이동 지시
    $('mapOrder').addEventListener('click', (e) => { e.stopPropagation(); if (G.marker && G.player) { setTeamOrder({ kind: 'move', x: G.marker.x, z: G.marker.z, y: heightAt(G.marker.x, G.marker.z) }); drawBig(); } });
    // 미니맵을 누르면 전체 지도
    $('mini').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Audio.init(); if (G.state === 'play' && !G.paused && $('mapPanel').hidden) openMap(); });
    $('mapLegend').innerHTML = '<div><i style="background:#5aa2ff"></i>현재 안전 구역</div><div><i style="background:#fff"></i>다음 안전 구역</div><div><i style="background:#f0a43a"></i>나 / 마커</div><div><i style="background:#d8cfb0"></i>도로</div>';
  }

  // ---------- 인벤토리 ----------
  function btn(label, fn) { const b = h('button', '', label); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); Audio.ui(); renderInventory(); }); return b; }
  function row(name, sub, acts, icon) { const r = h('div', 'irow'); if (icon) r.appendChild(icon); const n = h('div', 'nm'); n.append(name); if (sub) n.appendChild(h('small', '', sub)); r.appendChild(n); const a = h('div', 'acts'); acts.forEach(x => a.appendChild(x)); r.appendChild(a); return r; }
  function renderInventory() {
    const p = G.player; if (!p) return; const inv = p.inv;
    // 주변 아이템
    const gbox = $('invGround'); gbox.innerHTML = '';
    if (!loot.length) gbox.appendChild(h('div', 'micro', '주변에 아이템이 없습니다'));
    loot.forEach(it => gbox.appendChild(row(itemLabel(it), '', [btn('줍기', () => doPickup(p, it))], ico(it.id, it.inst && it.inst.att, ITEMS[it.id].type === 'weapon' ? 'ico wide' : 'ico'))));
    // 가방
    const cap = inv.capacity(), wgt = inv.weight();
    $('invCap').textContent = `${Math.round(wgt)} / ${cap}`; $('capBar').style.width = clamp(wgt / cap * 100, 0, 100) + '%';
    const ibox = $('invItems'); ibox.innerHTML = '';
    const ids = Object.keys(inv.items).sort((a, b) => ITEMS[a].type.localeCompare(ITEMS[b].type));
    if (!ids.length) ibox.appendChild(h('div', 'micro', '비어 있음'));
    for (const id of ids) {
      const d = ITEMS[id], acts = [];
      if (d.type === 'heal' || d.type === 'boost') acts.push(btn('사용', () => { useConsumable(p, id); closeInv(); }));
      if (d.type === 'att') acts.push(btn('장착', () => { if (!attachFromBag(p, id)) toast('장착할 수 있는 무기가 없습니다', 'warn'); }));
      if (d.type === 'throw') acts.push(btn('선택', () => { inv.throwSel = id; }));
      acts.push(btn('1개 버리기', () => dropFromInventory(p, G.scene, { item: id, count: 1 })));
      if (inv.count(id) > 1) acts.push(btn('모두', () => dropFromInventory(p, G.scene, { item: id })));
      ibox.appendChild(row(`${d.name} ×${inv.count(id)}`, `무게 ${(d.w * inv.count(id)).toFixed(1)}`, acts, ico(id)));
    }
    // 장비
    const gb = $('invGear'); gb.innerHTML = '';
    for (const k of ['helmet', 'vest', 'bag']) {
      const g = inv.gear[k], nm = { helmet: '헬멧', vest: '방탄조끼', bag: '가방' }[k];
      if (!g) { gb.appendChild(row(nm + ' 없음', '', [], h('span', 'ico empty'))); continue; }
      const d = ITEMS[g.id];
      gb.appendChild(row(d.name, d.dur ? `내구도 ${Math.round(g.dur / d.dur * 100)}%` : `용량 ${d.cap}`, [btn('버리기', () => { const r = dropFromInventory(p, G.scene, { gear: k }); if (r && !r.ok) toast(r.msg, 'warn'); })], ico(g.id)));
    }
    // 무기
    const wb = $('invWeapons'); wb.innerHTML = '';
    inv.weapons.forEach((w, i) => {
      const card = h('div', 'wcard' + (i === inv.cur ? ' cur' : ''));
      const top = h('div', 'top');
      if (!w) { top.append(`${i + 1}. ${i === 2 ? '보조 무기' : '주무기'} 비어 있음`); card.appendChild(top); wb.appendChild(card); return; }
      const d = ITEMS[w.id];
      top.append(`${i + 1}. ${d.name}`);
      const acts = h('div', 'acts'); acts.style.display = 'flex'; acts.style.gap = '4px';
      if (i !== inv.cur) acts.appendChild(btn('들기', () => switchWeapon(p, i)));
      acts.appendChild(btn('버리기', () => dropFromInventory(p, G.scene, { weapon: i })));
      top.appendChild(acts); card.appendChild(top);
      card.appendChild(ico(w.id, w.att, 'ico wide big'));
      card.appendChild(h('div', 'micro', `${AMMO_NAMES[d.ammo]} · 탄창 ${w.mag}/${inv.magSize(w)} · 보유 ${inv.count(d.ammo)} · 피해 ${d.dmg}${d.pellets ? '×' + d.pellets : ''} · ${d.modes.map(m => MODE_NAMES[m]).join('/')}${d.supply ? ' · 보급 전용' : ''}`));
      const chips = h('div', 'chips');
      for (const slot of ['scope', 'muzzle', 'mag', 'grip']) {
        const a = w.att[slot], c = h('button', 'chip' + (a ? '' : ' empty'));
        if (a) c.appendChild(ico(a, null, 'ico xs'));
        c.append(a ? ITEMS[a].name + ' ✕' : { scope: '조준경', muzzle: '총구', mag: '탄창', grip: '손잡이' }[slot]);
        if (a) c.addEventListener('click', () => { dropFromInventory(p, G.scene, { att: { w: i, slot } }); renderInventory(); });
        chips.appendChild(c);
      }
      card.appendChild(chips); wb.appendChild(card);
    });
  }
  function refreshInventory() { if (!$('invPanel').hidden) renderInventory(); }
  function openInv() { if (!G.player || G.player.mode !== 'ground') return; $('invPanel').hidden = false; releaseLock(); renderInventory(); Audio.ui(); }
  function closeInv() { $('invPanel').hidden = true; Audio.ui(); }
  function openMap() {
    $('mapPanel').hidden = false; releaseLock();
    // 확대해 둔 상태면 내 위치(관전 중이면 팀원)를 가운데로
    const v = G.viewChar ? G.viewChar() : G.player; if (MV.z > 1 && v && v.mode !== 'plane') centerOn(v.pos.x, v.pos.z);
    requestAnimationFrame(drawBig); Audio.ui();
  }
  function closeMap() { $('mapPanel').hidden = true; Audio.ui(); }

  // ---------- 설정 ----------
  const SET_DEFS = [
    ['quality', '그래픽 품질', 'seg', [['low', '낮음'], ['medium', '중간'], ['high', '높음']]],
    ['shadows', '그림자 품질', 'seg', [['off', '끔'], ['low', '낮음'], ['high', '높음']]],
    ['lookSens', '시야 감도 (마우스)', 'range', [0.3, 2.5, 0.05]],
    ['touchSens', '카메라 감도 (터치)', 'range', [0.3, 2.5, 0.05]],
    ['_h', '조준 감도 — 조준경별 · 100% = 배율과 관계없이 화면에서 같은 속도'],
    ['sens_iron', '가늠자(조준경 없음)', 'range', [0.2, 2, 0.05]],
    ['sens_reddot', '레드닷 사이트', 'range', [0.2, 2, 0.05]],
    ['sens_holo', '홀로그램 사이트', 'range', [0.2, 2, 0.05]],
    ['sens_x2', '2배율 스코프', 'range', [0.2, 2, 0.05]],
    ['sens_x3', '3배율 스코프', 'range', [0.2, 2, 0.05]],
    ['sens_x4', '4배율 스코프', 'range', [0.2, 2, 0.05]],
    ['sens_x6', '6배율 스코프', 'range', [0.2, 2, 0.05]],
    ['_h', '소리 · 시점 · 경기'],
    ['sfx', '효과음 음량', 'range', [0, 1, 0.05]],
    ['music', '배경음 음량', 'range', [0, 1, 0.05]],
    ['view', '시점', 'seg', [['tpp', '3인칭'], ['fpp', '1인칭']]],
    ['difficulty', '봇 난이도', 'seg', [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움'], ['mixed', '혼합']]],
    ['bots', '봇 수', 'range', [8, 48, 1]],
    ['_h', '화면 · 모바일 조작'],
    ['btnScale', '모바일 버튼 전체 크기', 'range', [0.7, 1.5, 0.05]],
    ['_layout', '모바일 버튼 위치·크기 편집'],
    ['hudScale', 'HUD 크기', 'range', [0.75, 1.3, 0.05]],
    ['hudOpacity', 'HUD 투명도', 'range', [0.4, 1, 0.05]],
  ];
  function renderSettings() {
    const g = $('setGrid'); g.innerHTML = '';
    for (const [key, label, type, opt] of SET_DEFS) {
      if (key === '_h') { g.appendChild(h('div', 'set-head', label)); continue; }
      if (key === '_layout') { const r = h('div', 'set-row'); const b = h('button', 'btn', label); b.addEventListener('click', () => { Audio.ui(); Touch.openEditor(); }); r.appendChild(b); g.appendChild(r); continue; }
      const r = h('div', 'set-row'), hdr = h('div', 'hdr'); hdr.append(label);
      const val = h('b', '', type === 'range' ? fmtSet(key, SETTINGS[key]) : ''); hdr.appendChild(val); r.appendChild(hdr);
      if (type === 'seg') {
        const s = h('div', 'seg');
        for (const [v, l] of opt) { const b = h('button', SETTINGS[key] === v ? 'on' : '', l); b.addEventListener('click', () => { SETTINGS[key] = v; saveSettings(); G.applySettings(key); renderSettings(); Audio.ui(); }); s.appendChild(b); }
        r.appendChild(s);
      } else {
        const inp = h('input'); inp.type = 'range'; inp.id = 'set_' + key; inp.min = opt[0]; inp.max = opt[1]; inp.step = opt[2]; inp.value = SETTINGS[key];
        inp.addEventListener('input', () => { SETTINGS[key] = parseFloat(inp.value); val.textContent = fmtSet(key, SETTINGS[key]); G.applySettings(key); });
        inp.addEventListener('change', saveSettings);
        r.appendChild(inp);
      }
      g.appendChild(r);
    }
  }
  function fmtSet(k, v) { return k === 'bots' ? String(v) : (k === 'sfx' || k === 'music' || k === 'hudOpacity' || k === 'btnScale' || k.startsWith('sens_')) ? Math.round(v * 100) + '%' : v.toFixed(2); }

  // ---------- 조준경 화면 ----------
  let scopeKey = '', reticleKey = '';
  function drawScope(key) {
    const cv = $('scopeCv'), dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.min(W, H) * ({ x2: 0.47, x3: 0.45, x4: 0.43, x6: 0.41 }[key] || 0.43), cx = W / 2, cy = H / 2;
    c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H); c.arc(cx, cy, R, 0, TAU, true); c.fill('evenodd');
    const edge = c.createRadialGradient(cx, cy, R * 0.72, cx, cy, R); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.82, 'rgba(0,0,0,0.3)'); edge.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = edge; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.fillStyle = 'rgba(110,160,190,0.05)'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    const hl = c.createLinearGradient(cx - R, cy - R, cx, cy); hl.addColorStop(0, 'rgba(255,255,255,0.09)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
    c.fillStyle = hl; c.beginPath(); c.arc(cx, cy, R * 0.97, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(40,40,40,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R - 1.5, 0, TAU); c.stroke();
    const line = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const red = (fn) => { c.save(); c.shadowColor = 'rgba(255,50,30,0.85)'; c.shadowBlur = 6; c.strokeStyle = c.fillStyle = '#ff3b2f'; fn(); c.restore(); };
    const ink = 'rgba(8,8,8,0.92)'; c.lineCap = 'round';
    if (key === 'x2') {
      line(cx - R, cy, cx - R * 0.06, cy, 1.6, ink); line(cx + R * 0.06, cy, cx + R, cy, 1.6, ink); line(cx, cy + R * 0.06, cx, cy + R, 2.2, ink);
      red(() => { c.beginPath(); c.arc(cx, cy, 2.6, 0, TAU); c.fill(); });
    } else if (key === 'x3') {
      line(cx - R, cy, cx - R * 0.12, cy, 1.2, ink); line(cx + R * 0.12, cy, cx + R, cy, 1.2, ink);
      red(() => { c.lineWidth = 2.6; c.beginPath(); c.moveTo(cx - 10, cy + 11); c.lineTo(cx, cy); c.lineTo(cx + 10, cy + 11); c.stroke(); });
      line(cx, cy + 16, cx, cy + R * 0.62, 1.4, ink);
      [0.16, 0.27, 0.38, 0.49].forEach((f, i) => line(cx - (16 - i * 3), cy + R * f, cx + (16 - i * 3), cy + R * f, 1.4, ink));
    } else if (key === 'x4') {
      line(cx - R, cy, cx - R * 0.5, cy, 4, ink); line(cx + R * 0.5, cy, cx + R, cy, 4, ink);
      line(cx - R * 0.5, cy, cx - R * 0.08, cy, 1.1, ink); line(cx + R * 0.08, cy, cx + R * 0.5, cy, 1.1, ink);
      red(() => { c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 13, cy + 15); c.lineTo(cx, cy); c.lineTo(cx + 13, cy + 15); c.stroke(); });
      line(cx, cy + 20, cx, cy + R * 0.58, 1.3, ink);
      c.fillStyle = ink; c.font = '600 11px "Saira Condensed", Arial, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
      [[0.12, 26, '2'], [0.22, 21, '4'], [0.32, 16, '6'], [0.42, 11, '8']].forEach(([f, w, n]) => { line(cx - w, cy + R * f, cx + w, cy + R * f, 1.4, ink); c.fillText(n, cx - w - 5, cy + R * f); });
    } else {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line(cx + dx * R, cy + dy * R, cx + dx * R * 0.42, cy + dy * R * 0.42, 4.5, ink); line(cx + dx * R * 0.42, cy + dy * R * 0.42, cx + dx * 3, cy + dy * 3, 1, ink); }
      c.fillStyle = ink; for (let i = 1; i <= 5; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.arc(cx + dx * R * 0.075 * i, cy + dy * R * 0.075 * i, 1.8, 0, TAU); c.fill(); }
      red(() => { c.beginPath(); c.arc(cx, cy, 2.2, 0, TAU); c.fill(); });
    }
  }
  function drawDot(key) {
    const cv = $('reticle'), dpr = Math.min(2, window.devicePixelRatio || 1), S = 120;
    cv.width = cv.height = S * dpr; cv.style.width = cv.style.height = S + 'px';
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
    c.shadowColor = 'rgba(255,50,30,0.9)'; c.shadowBlur = 5; c.fillStyle = c.strokeStyle = '#ff3d30';
    if (key === 'reddot') { c.beginPath(); c.arc(S / 2, S / 2, 2.4, 0, TAU); c.fill(); }
    else {
      c.lineWidth = 1.8; c.beginPath(); c.arc(S / 2, S / 2, 26, 0, TAU); c.stroke();
      c.beginPath(); c.arc(S / 2, S / 2, 1.8, 0, TAU); c.fill();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(S / 2 + dx * 26, S / 2 + dy * 26); c.lineTo(S / 2 + dx * 20, S / 2 + dy * 20); c.stroke(); }
    }
  }

  // ---------- 로비 ----------
  function seg(id, options, key, after) {
    const box = $(id); box.innerHTML = '';
    for (const [v, l] of options) {
      const b = h('button', SETTINGS[key] === v ? 'on' : '', l); b.type = 'button';
      b.addEventListener('click', (e) => { e.preventDefault(); SETTINGS[key] = v; saveSettings(); Audio.init(); Audio.ui(); renderLobby(); after && after(); });
      box.appendChild(b);
    }
  }
  // 로비 탭: 플레이 / 전적 / 커스터마이즈
  let lobbyTab = 'play';
  function setTab(t) {
    lobbyTab = t;
    document.querySelectorAll('#lbTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('#lobby .pane').forEach((p) => { p.hidden = p.dataset.pane !== t; });
    $('segQueue').style.visibility = t === 'play' ? '' : 'hidden';
    const L = document.querySelector('.lb-left'); L.className = 'lb-left tab-' + t + (SETTINGS.queue === 'ranked' && Rank.unlocked() ? ' ranked' : '');
  }
  const ringSet = (id, f) => { $(id).style.strokeDashoffset = (100.5 * (1 - clamp(f, 0, 1))).toFixed(1); };
  const mapSize = (k) => MAPS[k].big ? '8×8km' : `${(HALF0 * 2 / 1000).toFixed(1)}×${(HALF0 * 2 / 1000).toFixed(1)}km`;
  const HALF0 = 350;
  function renderLobby() {
    const L = levelFromXp(STATS.xp);
    $('lvBadge').textContent = L.lv; $('lvNum').textContent = L.lv; $('xpBar').style.width = (L.cur / L.need * 100) + '%';
    $('opLv').textContent = L.lv; $('opXpBar').style.width = (L.cur / L.need * 100) + '%'; $('xpText').textContent = `${L.cur} / ${L.need} XP`;
    // 오퍼레이터 링: 경기 = 다음 레벨까지 XP, 우승 = 우승률, 처치 = 경기당 처치(5킬 = 가득)
    $('stMatches').textContent = STATS.matches; $('stWins').textContent = STATS.wins; $('stKills').textContent = STATS.kills;
    ringSet('rgMatches', L.cur / L.need); ringSet('rgWins', STATS.matches ? STATS.wins / STATS.matches : 0); ringSet('rgKills', STATS.matches ? STATS.kills / STATS.matches / 5 : 0);
    $('rgMatches').parentElement.parentElement.title = `다음 레벨까지 ${L.need - L.cur} XP`;
    $('rgWins').parentElement.parentElement.title = STATS.matches ? `우승률 ${Math.round(STATS.wins / STATS.matches * 100)}%` : '';
    $('rgKills').parentElement.parentElement.title = STATS.matches ? `경기당 처치 ${(STATS.kills / STATS.matches).toFixed(1)}` : '';
    const O = OUTFITS[SETTINGS.outfit] || OUTFITS[0], hex = (n) => '#' + n.toString(16).padStart(6, '0');
    $('opSwatch').style.background = `linear-gradient(135deg, ${hex(O.shirt)} 50%, ${hex(O.pants)} 50%)`; $('opOutfit').textContent = O.name;
    // 전적
    $('rcMatches').textContent = STATS.matches; $('rcWins').textContent = STATS.wins; $('rcKills').textContent = STATS.kills; $('stBest').textContent = STATS.matches ? '#' + STATS.best : '-';
    $('rcWinRate').textContent = STATS.matches ? Math.round(STATS.wins / STATS.matches * 100) + '%' : '-'; $('rcKpm').textContent = STATS.matches ? (STATS.kills / STATS.matches).toFixed(1) : '-';
    const rc = $('recent'); rc.innerHTML = '';
    if (!STATS.recent.length) rc.appendChild(h('li', 'micro', '아직 경기 기록이 없습니다'));
    for (const r of STATS.recent) {
      const li = h('li', r.rank === 1 ? 'win' : ''); li.appendChild(h('b', '', `#${r.rank}/${r.total}`));
      li.append(`${r.sq > 1 ? (r.sq === 2 ? '듀오' : '스쿼드') + ' · ' : ''}${r.kills}킬 · ${fmtTime(r.time)} · ${MAPS[r.map] ? MAPS[r.map].name : ''}${r.ranked ? ' · 랭크' + (r.delta !== undefined ? ` ${r.delta >= 0 ? '+' : ''}${r.delta}RP` : ' 배치') : ''}`); rc.appendChild(li);
    }
    // 커스터마이즈
    const of = $('outfits'); of.innerHTML = '';
    OUTFITS.forEach((o, i) => {
      const b = h('button', 'outfit' + (SETTINGS.outfit === i ? ' on' : '')); b.type = 'button'; const sw = h('i'); sw.style.background = `linear-gradient(135deg, ${hex(o.shirt)} 50%, ${hex(o.pants)} 50%)`;
      b.appendChild(sw); b.append(o.name);
      b.addEventListener('click', () => { SETTINGS.outfit = i; saveSettings(); Lobby.setOutfit(i); Lobby.teamN = 0; renderLobby(); Audio.init(); Audio.ui(); });
      of.appendChild(b);
    });
    // 경기 설정 창
    seg('segMode', Object.entries(MODES).map(([k, v]) => [k, v.name]), 'mode');
    seg('segSquad', Object.entries(TEAM_MODES).map(([k, v]) => [k, `${v.name}${v.size > 1 ? ' (' + v.size + '인)' : ''}`]), 'squad');
    seg('segTime', [['day', '낮'], ['dusk', '저녁']], 'time', () => Lobby.applyTime());
    seg('segView', [['tpp', '3인칭'], ['fpp', '1인칭']], 'view');
    seg('segDiff', Object.entries(DIFFICULTY_NAMES), 'difficulty');
    const MP = MAPS[SETTINGS.map], maxB = mapMaxBots(SETTINGS.map);
    if (SETTINGS.bots > maxB) { SETTINGS.bots = maxB; saveSettings(); }
    const br = $('botsRange'); br.max = maxB; br.value = SETTINGS.bots; $('botsVal').textContent = SETTINGS.bots;
    // 대기열(하위 탭): 일반 / 랭크 (레벨 3 미만 잠김)
    const unlocked = Rank.unlocked(), ranked = SETTINGS.queue === 'ranked' && unlocked;
    const q = $('segQueue'); q.innerHTML = '';
    for (const [v, l] of [['normal', '일반'], ['ranked', unlocked ? '랭크' : '랭크 🔒']]) {
      const b = h('button', (v === 'ranked' ? 'ranked' : '') + ((v === 'ranked') === ranked ? ' on' : '') + (v === 'ranked' && !unlocked ? ' lock' : ''), l); b.type = 'button';
      b.addEventListener('click', (e) => { e.preventDefault(); Audio.init(); Audio.ui(); if (v === 'ranked' && !unlocked) { showLobbyNote(`랭크전은 레벨 3부터 할 수 있습니다 (현재 레벨 ${levelFromXp(STATS.xp).lv})`); return; } SETTINGS.queue = v; saveSettings(); renderLobby(); });
      q.appendChild(b);
    }
    $('segDiff').parentElement.classList.toggle('locked', ranked); $('fldBots').classList.toggle('locked', ranked); $('segSquad').parentElement.classList.toggle('locked', ranked);
    const TS = ranked ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size; if (Lobby.setTeam) Lobby.setTeam(TS);
    const sqName = ranked ? '솔로' : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).name;
    $('cfgNote').hidden = !ranked;
    if (ranked) $('cfgNote').textContent = `랭크전: 솔로 · 봇 ${Rank.botCount(SETTINGS.map)}명 고정 · 봇 난이도는 ${Rank.placed() ? '현재 티어' : '배치고사 기준(혼합)'}에 맞춰 자동 설정`;
    // 랭크 카드 (랭크 대기열에서만)
    const rs = Rank.status(), rc0 = $('rankCard');
    rc0.hidden = !ranked;
    $('rankEmb').src = rs.emb; $('rankLabel').textContent = rs.label; $('rankSub').textContent = rs.sub;
    $('rankBar').style.width = rs.kind === 'ranked' ? (rs.tier.top ? 100 : rs.tier.into) + '%' : rs.kind === 'placement' ? (Rank.state.placed / 3 * 100) + '%' : (levelFromXp(STATS.xp).lv >= 2 ? 50 : 0) + '%';
    rc0.className = 'rank-card' + (rs.kind === 'locked' ? ' locked' : '') + (rs.kind === 'ranked' && rs.tier.t >= 8 ? ' glow' : '') + (rs.kind === 'ranked' && rs.tier.t === 9 ? ' tier-top' : '');
    // 맵 카드 (왼쪽 아래)
    const nb = ranked ? Rank.botCount(SETTINGS.map) : SETTINGS.bots, total = nb + 1, mins = Math.round(matchMinutes()), nTeams = Math.ceil(total / TS);
    $('mcImg').style.backgroundImage = `url(${LOBBY_ART[SETTINGS.map]})`;
    $('mcTop').textContent = `${ranked ? '랭크 · 솔로' : sqName} · ${SETTINGS.view === 'fpp' ? '1인칭' : '3인칭'} · ${MODES[SETTINGS.mode].name}`;
    $('mcName').textContent = MP.name.replace(/\s*\(.*\)$/, '');
    $('mcTime').textContent = `약 ${mins}분`; $('mcPlayers').textContent = TS > 1 ? `${total}명 · ${nTeams}팀` : `${total}명`; $('mcWarn').hidden = !MP.big;
    // 맵 선택 창
    const mg = $('mapGrid'); mg.innerHTML = '';
    for (const [k, M] of Object.entries(MAPS)) {
      if (M.training) continue; // 훈련장은 로비의 별도 버튼
      const b = h('button', 'map-opt' + (k === SETTINGS.map ? ' on' : '')); b.type = 'button';
      const im = h('div', 'mo-img'); im.style.backgroundImage = `url(${LOBBY_ART[k]})`; im.appendChild(h('em', M.big ? 'big' : '', M.big ? '8×8km · 렉 주의' : mapSize(k)));
      const tx = h('div', 'mo-txt'); tx.appendChild(h('b', '', M.name.replace(/\s*\(.*\)$/, ''))); tx.appendChild(h('span', '', M.desc)); tx.appendChild(h('span', '', `봇 최대 ${mapMaxBots(k)}명`));
      b.appendChild(im); b.appendChild(tx);
      b.addEventListener('click', () => { SETTINGS.map = k; saveSettings(); Audio.init(); Audio.ui(); renderLobby(); if (M.big) { const mw = $('mapWarn'); mw.classList.remove('flash'); void mw.offsetWidth; mw.classList.add('flash'); } });
      mg.appendChild(b);
    }
    $('mapWarn').hidden = !MP.big;
    if (MP.big) $('mapWarn').textContent = `⚠ 대형 맵(8×8km)은 기기 성능에 따라 렉이 걸릴 수 있습니다. 로딩에 수십 초가 걸리고 메모리를 많이 씁니다(휴대폰은 경기 설정에서 봇 수를 줄이는 것을 권장). 봇 최대 ${maxB}명 · 차량 170대 · 한 판 약 ${mins}분.`;
    // 출격 버튼 · 요약
    $('matchBrief').textContent = `${ranked ? '랭크전 · ' : ''}${MAPS[SETTINGS.map].name} · ${MODES[SETTINGS.mode].name} · ${TIMES_KO[SETTINGS.time] || ''} · 봇 ${nb}명(${ranked ? '자동' : DIFFICULTY_NAMES[SETTINGS.difficulty]}) · ${TS > 1 ? `${sqName}(${TS}인 팀 · 팀원 ${Math.min(TS, total) - 1}명은 봇) · 목표: ${nTeams}팀 중 최후의 팀` : `목표: ${total}명 중 최후의 1인`}`;
    $('playBtn').classList.toggle('ranked', ranked); $('playBtn').querySelector('span').textContent = ranked ? '랭크 출격' : '출격';
    $('playSub').textContent = ranked ? `${MAPS[SETTINGS.map].name} · ${rs.label}` : `${sqName} · ${MAPS[SETTINGS.map].name} · ${DIFFICULTY_NAMES[SETTINGS.difficulty]}`;
    setTab(lobbyTab);
  }
  const TIMES_KO = { day: '낮', dusk: '저녁' };
  // 소식 카드: 6초마다 바뀜, 누르면 해당 화면으로
  let newsI = 0, newsT = null, rankBanner = null;
  const NEWS = [
    { tag: '신규', title: '팀원과 함께 차량 탑승 — 동승석에서 사격', img: () => LOBBY_ART.vehicles, act: () => G.ui('help') },
    { tag: '신규 모드', title: '듀오·스쿼드 — 기절·부활, 핑(Q)으로 팀원 지휘', img: () => LOBBY_ART.kalden, act: () => G.ui('matchCfg') },
    { tag: '업데이트', title: '차량 5종 출격 — 말부터 오토바이까지', img: () => LOBBY_ART.vehicles, act: () => G.ui('help') },
    { tag: '대형 맵', title: '8×8km 노르덴 — 봇 99명과 출격', img: () => LOBBY_ART.norden, act: () => G.ui('mapPick') },
    { tag: '랭크전', title: '배치고사 3판 · 아이언부터 이터널까지', img: () => rankBanner, act: () => G.ui('ranks') },
  ];
  function makeRankBanner() {
    const c = document.createElement('canvas'); c.width = 720; c.height = 240; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 720, 240); gr.addColorStop(0, '#1a1230'); gr.addColorStop(1, '#3a2363'); g.fillStyle = gr; g.fillRect(0, 0, 720, 240);
    const tiers = [1, 3, 5, 7, 9]; let n = 0;
    tiers.forEach((t, i) => { const im = new Image(); im.onload = () => { const s = 96 + i * 14; g.drawImage(im, 60 + i * 130 - s / 2 + 30, 112 - s / 2, s, s); if (++n === tiers.length) { rankBanner = c.toDataURL('image/jpeg', 0.85); showNews(); } }; im.src = Rank.emblem(t, 1, 160); });
  }
  function showNews() {
    const N = NEWS[newsI % NEWS.length], src = N.img();
    $('newsImg').style.backgroundImage = src ? `url(${src})` : 'none'; $('newsTag').textContent = N.tag; $('newsTitle').textContent = N.title;
    const d = $('newsDots'); d.innerHTML = ''; NEWS.forEach((_, i) => d.appendChild(h('i', i === newsI % NEWS.length ? 'on' : '')));
  }
  function setupLobby() {
    $('botsRange').addEventListener('input', (e) => { SETTINGS.bots = parseInt(e.target.value, 10); $('botsVal').textContent = SETTINGS.bots; saveSettings(); renderLobby(); });
    $('playBtn').addEventListener('click', () => { Audio.init(); Audio.ui(); G.startMatch(); });
    $('jumpBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); Input.press('interact'); });
    $('chuteBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); Input.press('interact'); });
    document.querySelectorAll('[data-ui]').forEach(b => b.addEventListener('click', () => { Audio.init(); Audio.ui(); G.ui(b.dataset.ui); }));
    document.querySelectorAll('#hudButtons [data-tap]').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); Input.press(b.dataset.tap); }));
    document.querySelectorAll('#lbTabs button').forEach((b) => b.addEventListener('click', () => { Audio.init(); Audio.ui(); setTab(b.dataset.tab); }));
    document.querySelectorAll('[data-tab-go]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); Audio.init(); Audio.ui(); setTab(b.dataset.tabGo); }));
    $('newsCard').addEventListener('click', () => { Audio.init(); Audio.ui(); NEWS[newsI % NEWS.length].act(); });
    if (!store.set('probe', 1)) $('storeNote').textContent = '이 브라우저에서는 기록을 저장할 수 없어 이번 세션에만 유지됩니다.';
    showNews(); clearInterval(newsT); newsT = setInterval(() => { if (G.state === 'lobby' && !$('lobby').hidden) { newsI++; showNews(); } }, 6000);
    try { makeRankBanner(); } catch (e) { /* 엠블럼 없이도 동작 */ }
    renderLobby(); setupMapClick();
  }
  // 예상 경기 시간(분): 자기장 단계 합 × 모드 배율
  function matchMinutes() {
    const M = MAPS[SETTINGS.map], ph = M.zone || Zone.basePhases, sc = MODES[SETTINGS.mode].zoneScale;
    const tot = ph.reduce((a, q) => a + q.wait + q.shrink, 0) * sc, w0 = ph[0].wait * sc;
    return (tot + Math.max(0, (M.wait0Min || 0) - w0)) / 60 + 1;
  }
  let noteT = null;
  function showLobbyNote(msg) { const n = $('lbNote'); n.hidden = false; n.textContent = msg; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, 3500); }
  // 티어표
  function renderRanks() {
    const g = $('tierGrid'); g.innerHTML = ''; const cur = Rank.placed() ? Rank.tierOf(Rank.state.rp) : null;
    RANK_TIERS.forEach((T, t) => {
      const d = h('div', 'tier' + (cur && cur.t === t ? ' me' : '')), im = h('img'); im.src = Rank.emblem(t, cur && cur.t === t ? cur.div : 1, 160); im.alt = '';
      d.appendChild(im); d.appendChild(h('b', '', T.name)); d.appendChild(h('span', '', t === 9 ? '3600 RP 이상' : `${t * 400}–${t * 400 + 399} RP`)); g.appendChild(d);
    });
    const ul = $('rankRules'); ul.innerHTML = '';
    const st = Rank.state;
    [`레벨 3부터 참여할 수 있습니다. 처음 3판은 배치고사이며, 결과에 따라 시작 티어가 정해집니다(최대 플래티넘 1).`,
      `각 티어는 4 → 3 → 2 → 1 단계로 올라갑니다. 한 단계는 100 RP, 한 티어는 400 RP입니다.`,
      `RP는 순위(상위일수록 크게), 우승, 처치, 가한 피해로 오르고, 하위권이면 내려갑니다. 높은 티어일수록 오르기 어렵습니다.`,
      `봇 수는 고정(기본 맵 40명, 대형 맵 99명)이고 봇 난이도는 티어가 높을수록 어려워집니다. 경기 도중 나가면 패배 처리와 추가 감점이 있습니다.`,
      Rank.placed() ? `현재 ${Rank.tierOf(st.rp).label} · ${st.rp} RP · 최고 ${Rank.tierOf(st.peak).label} · 랭크 ${st.games}판 ${st.wins}승` : `배치고사 ${st.placed} / 3 진행`].forEach((t) => ul.appendChild(h('li', '', t)));
  }
  function showResult(win, p, total) {
    $('resultPanel').hidden = false; releaseLock();
    const team = G.teamSize > 1, place = win ? 1 : G.place;
    $('resKicker').textContent = win ? (team ? '최후의 팀' : '최후의 1인') : (team ? '팀 탈락' : '탈락');
    $('resTitle').textContent = win ? (team ? (p.alive ? '우승! 팀이 마지막까지 살아남았습니다' : '팀 우승! 팀원이 끝까지 버텼습니다') : '우승! 마지막까지 살아남았습니다') : (place <= Math.max(2, Math.round(total / 5)) ? '아깝습니다. 상위권 생존' : '다음 강하에서 다시 도전하세요');
    $('resRank').textContent = '#' + place; $('resOf').textContent = '/ ' + total + (team ? '팀' : '');
    $('resKills').textContent = p.kills; $('resTime').textContent = fmtTime(p.alive ? G.time : p.deathTime);
    $('resDmg').textContent = Math.round(p.damageDealt); $('resXp').textContent = '+' + G.lastXp;
    let note = G.statsSaved ? '기록이 저장되었습니다.' : '이 브라우저에서는 기록이 저장되지 않았습니다 (게임은 계속 가능).';
    if (team) { const ms = G.teams[p.team].members; note = `팀 처치 ${ms.reduce((a, m) => a + m.kills, 0)} · 내가 기절시킴 ${p.knocks} · 부활시킴 ${p.revives} — ` + note; }
    $('resNote').textContent = note;
    // 랭크 결과
    const R = G.rankResult, box = $('resRanked'); box.hidden = !R; box.classList.remove('promo');
    if (R) {
      const dEl = $('resRkDelta'); dEl.className = 'rp-delta';
      if (R.placement) {
        if (R.revealed) { const a = R.after; $('resEmb').src = Rank.emblem(a.t, a.div, 160); $('resRkKicker').textContent = '배치고사 완료'; $('resRkLabel').textContent = a.label; $('resRkSub').textContent = `시작 티어가 정해졌습니다 · ${a.rp} RP`; $('resRkBar').style.width = (a.top ? 100 : a.into) + '%'; dEl.textContent = ''; void box.offsetWidth; box.classList.add('promo'); }
        else { $('resEmb').src = Rank.emblem(-1, 0, 160); $('resRkKicker').textContent = '배치고사'; $('resRkLabel').textContent = `${R.step} / 3 완료`; $('resRkSub').textContent = `이번 판 점수 ${R.score} · ${3 - R.step}판 남음`; $('resRkBar').style.width = (R.step / 3 * 100) + '%'; dEl.textContent = ''; }
      } else {
        const a = R.after; $('resEmb').src = Rank.emblem(a.t, a.div, 160);
        $('resRkKicker').textContent = R.tierUp ? '티어 승급!' : R.promoted ? '승급' : R.demoted ? '강등' : '랭크';
        $('resRkLabel').textContent = a.label; $('resRkSub').textContent = a.top ? `${a.rp} RP` : `${a.into} / 100 RP · 총 ${a.rp} RP`;
        dEl.textContent = (R.delta >= 0 ? '+' : '') + R.delta; dEl.classList.add(R.delta >= 0 ? 'up' : 'down');
        // 막대: 이전 값에서 새 값으로
        const bar = $('resRkBar'); bar.style.transition = 'none'; bar.style.width = (R.promoted || R.demoted ? (R.promoted ? 0 : 100) : (R.before.top ? 100 : R.before.into)) + '%'; void bar.offsetWidth; bar.style.transition = 'width 1.2s ease-out'; bar.style.width = (a.top ? 100 : a.into) + '%';
        if (R.promoted) { void box.offsetWidth; box.classList.add('promo'); }
      }
    }
  }
  return { quick, closeQuick, spot, renderRanks, modalOpen, toast, damage, hitmarker, killfeed, setLoot, focusItem, update, refreshInventory, renderInventory, openInv, closeInv, openMap, closeMap, drawBig, renderSettings, renderLobby, setupLobby, showResult, reset() { MV.z = 1; MV.cx = MV.cz = 0; spotCallT = -99; $('pingTag').hidden = true; $('dangerTag').hidden = true; document.body.classList.remove('driving', 'riding'); $('teamPanel').dataset.k = ''; $('teamPanel').innerHTML = ''; $('teamTags').innerHTML = ''; document.body.classList.remove('knocked', 'spectating', 'teammode'); $('killfeed').innerHTML = ''; $('toasts').innerHTML = ''; $('dmgRing').innerHTML = ''; closeQuick(); $('fuseHud').hidden = true; lastLootKey = ''; loot = []; $('lootList').innerHTML = ''; $('weaponPanel').dataset.k = ''; $('gearRow').dataset.k = ''; } };
})();
