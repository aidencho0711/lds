// ============================================================
// 10_hud.js — HUD, 미니맵/전체지도, 인벤토리, 메뉴/설정/결과, 로비 UI
//  모든 표시값은 실제 게임 상태(G, 캐릭터, Zone)에서 매 프레임 읽어 온다.
// ============================================================
const $ = (id) => document.getElementById(id);
const HUD = (() => {
  let loot = [], focusIdx = 0, lastHp = 100, lastLootKey = '', toastQ = [];
  const modals = ['devPanel', 'mapPanel', 'invPanel', 'pausePanel', 'settingsPanel', 'helpPanel', 'resultPanel', 'layoutEditor', 'rankPanel', 'matchCfgPanel', 'mapPickPanel', 'acctPanel', 'friendPanel', 'oddsPanel', 'gachaRes'];
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
  // 울트라레어 총기 스킨으로 처치했을 때 조준점 아래 휘장 (fx: 스킨 효과 색·종류, name: 'M416 · 마그마 코어')
  // 엡실론 문양 (총마다 외형 키트의 모양): 별 창날 · 에너지 코어 · 불꽃 왕관 · 낫 · 날개 · 터빈 · 왕관 · Ω — 처치 휘장과 킬 로그에 씀
  const EPS_ICO = {
    celestial: '<path d="M12 1l2.2 8.8L23 12l-8.8 2.2L12 23l-2.2-8.8L1 12l8.8-2.2z"/>',
    divine: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.6"/>',
    infernal: '<path d="M3 20h18l1.5-12-5.5 5L12 3 7 13 1.5 8z"/>',
    voidr: '<path d="M22 3C11 2 3 8 2 20c4-7 10-10 20-10z"/>',
    seraph: '<path d="M2 20c2-9 8-15 20-17-2 3-4 4-6 5 2 0 3 0 5-.5-2 3-5 4.5-8 5 2 .5 3 .5 5 .2-3 3-7 4.5-11 4.5z"/>',
    apocalypse: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5M4.2 4.2l3.5 3.5M16.3 16.3l3.5 3.5M19.8 4.2l-3.5 3.5M7.7 16.3l-3.5 3.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    dynasty: '<path d="M3 19h18v2H3zM3 17L1.5 7l5.5 4.5L12 4l5 7.5L22.5 7 21 17z"/>',
    omega: '<path d="M5 20h5v-2.4C7.6 16.3 6 14 6 11.3 6 7.8 8.7 5 12 5s6 2.8 6 6.3c0 2.7-1.6 5-4 6.3V20h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>',
  };
  const epsIco = (kind) => `<svg class="eps-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${EPS_ICO[kind] || EPS_ICO.celestial}</svg>`;
  const hex6 = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
  // eps: 엡실론 스킨이면 그 스킨 정보(GSKINS 항목) → 더 큰 휘장(도는 빛 테 · 총마다 다른 문양 · EPSILON 번호)
  function skinKill(fx, name, eps) {
    const e = $('skinKill'); if (!e || !fx) return;
    e.style.setProperty('--sk1', hex6(fx.c)); e.style.setProperty('--sk2', hex6(fx.c2));
    e.className = 'k-' + fx.kind + (eps ? ' eps' : ''); e.innerHTML = '';
    if (eps) { e.appendChild(h('i', 'sk-ring')); const ic = h('i', 'sk-ico'); ic.innerHTML = epsIco(fx.kind); e.appendChild(ic); }
    e.appendChild(h('b', '', '처치')); e.appendChild(h('small', '', name || ''));
    if (eps) e.appendChild(h('u', '', `EPSILON · Ε-${eps.no}`));
    void e.offsetWidth; e.classList.add('on');
  }
  // sk: 처치한 총에 장착한 스킨 id (엡실론이면 킬 로그 줄이 그 스킨의 색·문양·이름으로 꾸며지고 더 오래 남는다)
  function killfeed(killer, victim, weapon, byPlayer, playerDied, kind, mate, sk) {
    const sd = sk && typeof GSKINS !== 'undefined' ? GSKINS[sk] : null, eps = killer && sd && sd.eps && sd.fx ? sd : null;
    const box = $('killfeed'), e = h('div', 'kf' + (byPlayer ? ' mine' : '') + (playerDied || mate ? ' dead' : '') + (kind === 'knock' ? ' knock' : '') + (eps ? ' eps k-' + eps.fx.kind : ''));
    if (eps) {
      e.style.setProperty('--sk1', hex6(eps.fx.c)); e.style.setProperty('--sk2', hex6(eps.fx.c2));
      const w = h('em', 'kf-eps'); w.innerHTML = epsIco(eps.fx.kind); w.appendChild(h('b', '', `${weapon || ''} · ${eps.name}` + (kind === 'knock' ? ' · 기절' : '')));
      e.append(h('i', 'kf-tag', 'Ε'), h('span', 'kf-n', killer), w, h('span', 'kf-n', victim));
    } else if (killer) { e.append(killer); e.appendChild(h('em', '', (weapon || '▸') + (kind === 'knock' ? ' · 기절' : kind === 'wipe' ? '' : ''))); e.append(victim); }
    else { e.append(victim); e.appendChild(h('em', '', kind === 'knock' ? (weapon ? weapon + '(으)로 기절' : '기절') : weapon ? weapon + '(으)로 탈락' : '탈락')); }
    box.prepend(e); while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => e.remove(), eps ? 9500 : 7000);
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
    panel.hidden = !on; tags.hidden = !on; if (!on) { updateMarkTag(p); return; }   // 솔로: 내 지도 마커만
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
      panel.appendChild(h('div', 'trc'));   // 리콜 상황 한 줄 (팀원 줄 뒤 — 줄 번호는 그대로)
    }
    const rc = panel.lastChild, rt = Recall.hudLine(p); if (rc.textContent !== rt) rc.textContent = rt; rc.hidden = !rt;
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
  // 화면 표식: 화면 안이면 그 자리, 밖(또는 뒤)이면 화면 가장자리에 붙여 방향 화살표 — 수송기 위처럼 멀리서도 놓치지 않게
  const _cv = new THREE.Vector3();
  function placeTag(tg, x, y, z) {
    const W = innerWidth, H = innerHeight;
    _tp.set(x, y, z).project(G.camera);
    if (_tp.z < 1 && Math.abs(_tp.x) < 0.97 && Math.abs(_tp.y) < 0.95) { tg.classList.remove('edge'); tg.style.visibility = ''; tg.style.transform = `translate(${((_tp.x + 1) / 2 * W).toFixed(0)}px, ${((1 - _tp.y) / 2 * H).toFixed(0)}px)`; return; }
    _cv.set(x, y, z).applyMatrix4(G.camera.matrixWorldInverse);
    let dx = _cv.x, dy = _cv.y; if (_cv.z > 0 && Math.hypot(dx, dy) < 1e-3) dy = -1;   // 바로 뒤 → 아래쪽
    const mx = W / 2 - 46, my = H / 2 - 40, k = Math.min(mx / Math.max(1e-6, Math.abs(dx)), my / Math.max(1e-6, Math.abs(dy)));
    tg.classList.add('edge'); tg.style.visibility = '';
    tg.style.transform = `translate(${(W / 2 + dx * k).toFixed(0)}px, ${(H / 2 - dy * k).toFixed(0)}px)`;
    tg.style.setProperty('--ang', Math.atan2(-dy, dx).toFixed(3) + 'rad');
  }
  // 3D 기둥: 시야 거리(카메라 far)보다 멀면 같은 방향·같은 화면 크기로 당겨 와서 그리고, 멀수록 굵게 (수송기 고도에서도 보이게)
  function pillarAt(m, x, gy, z, h) {
    const cam = G.camera, cp = cam.position, g = m.geometry.parameters, d = Math.hypot(x - cp.x, z - cp.z), lim = cam.far * 0.8, k = d > lim ? lim / d : 1;
    const r = Math.max(g.radiusTop, d * 0.003) * k, hh = h * k;
    m.position.set(cp.x + (x - cp.x) * k, cp.y + (gy - cp.y) * k + hh / 2, cp.z + (z - cp.z) * k);
    m.scale.set(r / g.radiusTop, hh / g.height, r / g.radiusTop);
  }
  const fmtDist = (d) => d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm';
  // 내 지도 마커: 화면 표식(거리) + 기둥
  function updateMarkTag(p) {
    const mk = G.marker, tg = $('markTag'); if (!tg) return;
    tg.hidden = !mk; if (!mk) return;
    const gy = heightAt(mk.x, mk.z);
    if (G.markerMesh && G.markerMesh.visible) pillarAt(G.markerMesh, mk.x, gy, mk.z, 220);
    placeTag(tg, mk.x, gy + 2.5, mk.z);
    const vc = p.mode === 'plane' && G.plane ? G.plane.pos : (G.viewChar ? G.viewChar() : p).pos, txt = `마커 · ${fmtDist(Math.hypot(mk.x - vc.x, mk.z - vc.z))}`;
    if (tg.lastChild.textContent !== txt) tg.lastChild.textContent = txt;
  }
  function updateDanger(p) {
    const dg = G.danger, tg = $('dangerTag');
    if (!dangerMesh) dangerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xe0453a, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    if (G.scene && dangerMesh.parent !== G.scene) G.scene.add(dangerMesh);
    dangerMesh.visible = !!dg; tg.hidden = !dg; if (!dg) return;
    const gy = dg.y !== undefined ? dg.y : heightAt(dg.x, dg.z);
    pillarAt(dangerMesh, dg.x, gy, dg.z, 90); dangerMesh.material.opacity = 0.3 + (Math.floor(G.time * 4) % 2) * 0.3;
    placeTag(tg, dg.x, gy + 2.4, dg.z);
    const vc = p.mode === 'plane' && G.plane ? { pos: G.plane.pos } : G.viewChar ? G.viewChar() : p, txt = `위험 · ${fmtDist(Math.hypot(dg.x - vc.pos.x, dg.z - vc.pos.z))}`;
    if (tg.lastChild.textContent !== txt) tg.lastChild.textContent = txt;
  }
  function updatePing(p) {
    updateDanger(p); updateMarkTag(p);
    const ord = G.teamOrder, tg = $('pingTag');
    if (!pingMesh) pingMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    if (G.scene && pingMesh.parent !== G.scene) G.scene.add(pingMesh);
    pingMesh.visible = !!ord; tg.hidden = !ord; if (!ord) return;
    const atk = ord.kind === 'attack', gy = ord.y !== undefined && !atk ? ord.y : heightAt(ord.x, ord.z);
    pingMesh.material.color.setHex(atk ? 0xe0453a : 0xf2c94c); pillarAt(pingMesh, ord.x, gy, ord.z, 140);
    pingMesh.material.opacity = 0.35 + Math.sin(G.time * 6) * 0.12;
    placeTag(tg, ord.x, gy + 2.2, ord.z);
    const vc = p.mode === 'plane' && G.plane ? { pos: G.plane.pos } : G.viewChar ? G.viewChar() : p, txt = `${atk ? '공격' : '이동'} · ${fmtDist(Math.hypot(ord.x - vc.pos.x, ord.z - vc.pos.z))}`;
    if (tg.lastChild.textContent !== txt) tg.lastChild.textContent = txt; tg.classList.toggle('atk', atk);
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
    if (spec) { const rl = Recall.specLine(p), t = `관전 중 · ${G.spec.name}${G.spec.knocked ? ' (기절)' : ''}${rl ? ' · ' + rl : ''}`; if ($('specName').textContent !== t) $('specName').textContent = t; }
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
        if (!w) return; const d = ITEMS[w.id], sk = p.skinOf(w.id), tst = !!sk && !!GSKINS[sk].tester, eps = !!sk && GSKINS[sk].rar === 7, e = h('div', 'wslot' + (i === inv.cur ? ' cur' : '') + (tst ? ' tester' : '') + (eps ? ' epsilon' : ''));
        if (i === inv.cur) { e.title = '눌러서 총 살펴보기 (N)'; e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); Input.press('inspect'); }); }   // 모바일: 지금 무기 칸을 누르면 살펴보기
        if (tst) e.appendChild(h('i', 'beta-badge', 'β' + (GSKINS[sk].no || '')));   // 베타 테스터 한정 컬렉션 표시
        if (eps) e.appendChild(h('i', 'eps-badge', 'ε' + (GSKINS[sk].no || '')));   // 엡실론 컬렉션 표시
        e.appendChild(ico(w.id, w.att, 'ico wide wi'));
        e.appendChild(h('span', 'wn', `${i + 1}  ${d.name}`));
        if (d.modes.length > 1 || i === inv.cur) e.appendChild(h('span', 'wm', modeName(w.id, fireMode(w))));
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
    if (G.dm) zt = '';
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
        $('vehKeys').textContent = p.seat === 0 ? 'W/S 가속·후진 · A/D 조향 · Space 핸드브레이크 · C 좌석 · F 하차' : '우클릭 조준 = 창밖으로 몸 내밀기 · 사격 · R 장전 · C 좌석 · F 하차';
      }
      $('vehSpd').textContent = kmh; $('vehHp').style.width = hpP + '%'; vh.classList.toggle('low', hpP < 30 || v.burnT > 0);
    }
    const free = !v && p.alive && !p.knocked && p.mode === 'ground';
    const riding = !!v && p.seat > 0;
    const km = free && !p.revive ? nearestKnockedMate(p, 1.9) : null;
    const rp = free && !km && !p.revive && !p.recall ? Recall.promptFor(p) : null;   // 리콜 타워 단말기 앞
    const nv = free && !km && !(rp && rp.act) ? Veh.nearestBoardable(p) : null, vp = $('vehPrompt');
    vp.hidden = !(nv || km || rp);
    if (!vp.hidden) { const fs = nv ? Veh.freeSeats(nv) : 0, t = km ? `${IS_TOUCH ? '부활 버튼' : 'F'} · ${km.name} 부활 (${REVIVE_T}초)` : rp && (rp.act || !nv) ? rp.text : (IS_TOUCH ? '탑승 버튼' : 'F') + ' · ' + nv.T.name + ' ' + (!fs ? '동승 (봇 팀원과 자리 바꾸기)' : nv.seats[0] ? `동승 (빈자리 ${fs})` : '탑승'); if (vp.textContent !== t) vp.textContent = t; vp.classList.toggle('rc', !!rp && t === rp.text); }
    document.body.classList.toggle('driving', !!v && !riding); document.body.classList.toggle('riding', riding);
    const ib = $('tb_interact'); if (ib) { const lb = v ? '하차' : p.revive || p.recall ? '취소' : km ? '부활' : rp && rp.act ? '리콜' : nv ? '탑승' : '줍기'; if (ib.textContent !== lb) ib.textContent = lb; }
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
    const br = $('breath'); br.hidden = !(scopeOn && !IS_TOUCH && (si.key === 'x3' || si.key === 'x4' || si.key === 'x6' || si.key === 'w94'));
    if (!br.hidden) br.firstElementChild.style.width = Math.round(Cam.breath * 100) + '%';
    if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('hitmark').style.opacity = 0; }
    // 진행 표시 (재장전/회복/장착)
    let prog = null;
    if (p.revive) prog = [`${p.revive.tgt.name} 부활 중 · 움직이면 취소`, p.revive.t / p.revive.total];
    else if (p.recall) prog = ['리콜 등록 중 · 움직이면 취소', p.recall.t / p.recall.total];
    else if (p.rl) prog = [p.rl.kind === 'mag' || p.rl.kind === 'belt' ? '재장전' : `장전 ${p.weapon ? p.weapon.mag : 0}/${p.weapon ? p.inv.magSize(p.weapon) : 0}`, p.rl.t / p.rl.total];
    else if (p.heal) prog = [ITEMS[p.heal.id].name + ' 사용 중', 1 - p.heal.t / p.heal.total];
    $('progress').hidden = !prog;
    if (prog) { $('progLabel').textContent = prog[0]; $('progArc').style.strokeDashoffset = 106.8 * (1 - clamp(prog[1], 0, 1)); }
    // 강하 패널
    const dp = $('dropPanel');
    if (p.mode === 'plane' || p.mode === 'fall' || p.mode === 'chute') {
      dp.hidden = false;
      $('jumpBtn').hidden = p.mode !== 'plane'; $('chuteBtn').hidden = p.mode !== 'fall';
      const pp = planeOf(p), gh = p.mode === 'plane' ? pp.pos.y - heightAt(pp.pos.x, pp.pos.z) : p.pos.y - heightAt(p.pos.x, p.pos.z);
      $('dropInfo').textContent = p.mode === 'plane' ? `${p.rplane ? '리콜 수송기' : '수송기'} 탑승 중 · 고도 ${Math.round(gh)}m · ${IS_TOUCH ? '미니맵을 눌러' : '지도(M)에서'} 착지 지점을 고르세요` : `고도 ${Math.round(gh)}m · 낙하 속도 ${Math.round(-p.vel.y)}m/s`;
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
    // 리콜 타워 · 팀원 리콜 카드 · 리콜 수송기 (듀오·스쿼드)
    Recall.drawMap(ctx, toPx, opts);
    // 마커
    if (G.marker) { const [mx, my] = toPx(G.marker.x, G.marker.z); ctx.fillStyle = '#f0a43a'; ctx.beginPath(); ctx.moveTo(mx, my); ctx.arc(mx, my - 9, 5, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath(); ctx.fill(); }
    if (opts.labels) {
      ctx.font = `600 ${Math.round(S / 52)}px 'IBM Plex Sans KR', sans-serif`; ctx.textAlign = 'center';
      // 길가 마을·주유소(minor)는 확대했을 때만 (2km 이하가 보일 때) — 전체 지도에서는 글자가 겹친다
      const showMinor = (opts.span || SIZE) <= 2100;
      for (const poi of W.pois) {
        if (poi.minor && !showMinor) continue;
        const [lx, ly] = toPx(poi.x, poi.z); if (lx < -60 || ly < -20 || lx > S + 60 || ly > S + 20) continue;
        if (poi.minor) { ctx.save(); ctx.font = `500 ${Math.round(S / 66)}px 'IBM Plex Sans KR', sans-serif`; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(poi.name, lx + 1, ly + 1); ctx.fillStyle = '#d9d3bf'; ctx.fillText(poi.name, lx, ly); ctx.restore(); continue; }
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(poi.name, lx + 1, ly + 1); ctx.fillStyle = '#f2ecd8'; ctx.fillText(poi.name, lx, ly);
      }
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
      const src = p.mode === 'plane' ? planeOf(p).pos : p.pos, [x, y] = toPx(src.x, src.z);
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
    const src = p.mode === 'plane' ? planeOf(p).pos : p.pos;
    const R = W.isArena ? 42 : p.mode === 'ground' ? (p.veh ? 240 : 110) : 260, scale = S / (R * 2);
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
  const mapMaxZ = () => (W ? Math.max(6, Math.round(SIZE / 333)) : 6);   // 8km 24배 · 4km 12배 · 작은 맵 6배
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
          if (Dev.mapTap(x, z)) { drag = null; return; }   // 개발자 도구: 순간이동
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
      card.appendChild(h('div', 'micro', `${AMMO_NAMES[d.ammo]} · 탄창 ${w.mag}/${inv.magSize(w)} · 보유 ${inv.count(d.ammo)} · 피해 ${d.dmg}${d.pellets ? '×' + d.pellets : ''} · ${d.modes.map(m => modeName(w.id, m)).join('/')}${d.supply ? ' · 보급 전용' : ''}`));
      const chips = h('div', 'chips');
      for (const slot of ['scope', 'muzzle', 'mag', 'grip']) {
        if (slot === 'scope' && d.fixedScope) { const c = h('button', 'chip'); c.disabled = true; c.title = '총에 붙어 있어 뗄 수 없음'; c.append(d.fixedScope.name); chips.appendChild(c); continue; }
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
    ['quality', '그래픽 품질', 'seg', [['low', '낮음'], ['medium', '중간'], ['high', '높음'], ['extra', '엑스트라']]],
    ['shadows', '그림자 품질', 'seg', [['off', '끔'], ['low', '낮음'], ['high', '높음'], ['ultra', '최고']]],
    ['fps', '프레임 제한 (FPS)', 'seg', [[30, '30'], [60, '60'], [120, '120'], [0, '무제한']]],
    ['showFps', 'FPS 표시', 'seg', [[false, '끔'], [true, '켬']]],
    ['_note', 'fps'],
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
    ['difficulty', '봇 난이도', 'seg', [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움'], ['extreme', '익스트림'], ['mixed', '혼합']]],
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
      if (key === '_note') {
        // 엑스트라 품질·120fps 주의 (둘 다 고르면 강조)
        const both = SETTINGS.quality === 'extra' && SETTINGS.fps === 120, n = h('div', 'set-note' + (both ? ' warn' : ''));
        n.textContent = (both ? '⚠ 지금 엑스트라 품질과 120fps를 같이 골랐습니다. ' : '') + '엑스트라 품질과 120fps는 서로 상충합니다 — 둘 다 켜면 기기가 버거워 오히려 프레임이 떨어지거나 발열이 커질 수 있습니다. ' +
          '120fps는 화면이 120Hz이고 브라우저가 허용할 때만 적용됩니다(절전 모드·일부 브라우저는 60Hz로 묶음). 무제한은 화면 주사율까지 그립니다.';
        g.appendChild(n); continue;
      }
      const r = h('div', 'set-row'), hdr = h('div', 'hdr'); hdr.append(label);
      const val = h('b', '', type === 'range' ? fmtSet(key, SETTINGS[key]) : ''); hdr.appendChild(val); r.appendChild(hdr);
      if (type === 'seg') {
        const s = h('div', 'seg');
        for (const [v, l] of opt) {
          const b = h('button', SETTINGS[key] === v ? 'on' : '', l);
          b.addEventListener('click', () => {
            SETTINGS[key] = v;
            // 엑스트라 품질을 고르면 그림자도 최고로 (그림자가 꺼져 있지 않을 때) — 따로 낮출 수 있음
            if (key === 'quality' && v === 'extra' && SETTINGS.shadows !== 'off' && SETTINGS.shadows !== 'ultra') { SETTINGS.shadows = 'ultra'; G.applySettings('shadows'); }
            saveSettings(); G.applySettings(key); renderSettings(); Audio.ui();
          });
          s.appendChild(b);
        }
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
    const R = Math.min(W, H) * ({ x2: 0.47, x3: 0.45, x4: 0.43, x6: 0.41, w94: 0.44 }[key] || 0.43), cx = W / 2, cy = H / 2;
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
    } else if (key === 'w94') {
      // 고전 듀플렉스: 바깥쪽 굵은 기둥 + 가운데 가는 십자 (빛나는 점 없음)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line(cx + dx * R, cy + dy * R, cx + dx * R * 0.3, cy + dy * R * 0.3, 5, ink); line(cx + dx * R * 0.3, cy + dy * R * 0.3, cx, cy, 1.1, ink); }
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
  // 파티: 방장만 공통 설정(모드·팀 구성·시간대·난이도)을 바꾼다. 팀 구성은 파티 인원보다 작은 것을 고를 수 없다
  const PARTY_KEYS = ['mode', 'squad', 'time', 'difficulty'];
  function seg(id, options, key, after) {
    const box = $(id); box.innerHTML = '';
    const L = Party.lockInfo();
    for (const [v, l] of options) {
      const small = key === 'squad' && L && TEAM_MODES[v] && TEAM_MODES[v].size < L.size;
      const b = h('button', (SETTINGS[key] === v ? 'on' : '') + (small || (L && !L.leader && PARTY_KEYS.includes(key)) ? ' lock' : ''), l); b.type = 'button';
      b.addEventListener('click', (e) => {
        e.preventDefault(); Audio.init(); Audio.ui();
        if (L && !L.leader && PARTY_KEYS.includes(key)) { showLobbyNote('파티 설정은 방장만 바꿀 수 있습니다'); return; }
        if (small) { showLobbyNote(`파티가 ${L.size}명이라 ${TEAM_MODES[v].name}를 고를 수 없습니다`); return; }
        SETTINGS[key] = v; saveSettings(); renderLobby(); after && after(); if (L) Party.settingsChanged();
      });
      box.appendChild(b);
    }
  }
  // ---------- 창고: 슬롯별 스킨 장착 ----------
  //  보유 = 기본 스킨 + STATS.skins(나중에 얻는 스킨 id 목록). 선택 슬롯(모자·장갑)은 '없음'도 고를 수 있다
  let whCat = 'all';
  const hexs = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  const SKIN_ICON = {
    top: (c) => `<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.6 1.5-2.2 2.4-4 2.4S8.6 4.5 8 3z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/>`,
    bottom: (c) => `<path d="M6 3h12l1.2 18h-5L12 10l-2.2 11h-5z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/><path d="M6 5.5h12" stroke="rgba(0,0,0,.5)" stroke-width="1.6"/>`,
    shoes: (c, k) => `<path d="M6 3h7v10l5 2.4c1.3.6 2 1.7 2 3V20H5z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/><path d="M5 20h15v1.6H5z" fill="${k || '#222'}"/><path d="M9 6h4M9 8.5h4M9 11h4" stroke="rgba(0,0,0,.45)" stroke-width="0.9"/>`,
    hat: (c) => `<path d="M4 15c0-5 3.6-8 8-8s8 3 8 8z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/><path d="M3 16h15l3 2H3z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/>`,
    gloves: (c) => `<path d="M7 21v-8L5 9.5 6.5 8 9 11V4h2v6h1V3h2v7h1V4h2v9c0 4-2 8-6 8z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/>`,
    chute: (c, k) => `<path d="M2 10c3-5.5 17-5.5 20 0l-1 1.2H3z" fill="${c}" stroke="rgba(0,0,0,.45)" stroke-width="0.8"/><path d="M8 5.6 7 11M16 5.6l1 5.4M12 4.8v6.4" stroke="${k || '#555'}" stroke-width="1.6"/><path d="M4 11.5l7.4 8.5M20 11.5l-7.4 8.5M12 11.5V20" stroke="#bbb" stroke-width="0.6"/><circle cx="12" cy="20.5" r="1.2" fill="#ddd"/>`,
    none: () => `<circle cx="12" cy="12" r="7.5" fill="none" stroke="#777" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M7 17 17 7" stroke="#777" stroke-width="1.4"/>`,
  };
  function ownedSkins() { return Eco.ownedSkins(); }
  function equipSkin(slot, id) {
    const eq = Body.normEquip(SETTINGS.look); eq[slot] = id; SETTINGS.look = eq; saveSettings();
    Lobby.setLook(SETTINGS.look); renderWarehouse(); Audio.init(); Audio.ui();
  }
  // 무늬 옷은 SVG 패턴(index.html의 pt-*)으로 칠한다
  const skinFill = (S) => (S.ico ? `url(#${S.ico})` : hexs(S.color !== undefined ? S.color : (S.colors ? S.colors[0] : 0x888888)));
  let whVeh = 'sedan', whGun = null;
  function renderWarehouse() {
    const eq = Body.normEquip(SETTINGS.look), own = ownedSkins(), cats = $('whCats'), grid = $('whGrid');
    if (!cats || !grid) return;
    cats.innerHTML = ''; grid.innerHTML = '';
    for (const [k, n] of [['all', '전체']].concat(Body.SLOTS.map((s) => [s.id, s.name]), [['gun', '총기'], ['veh', '차량']])) {
      const b = h('button', whCat === k ? 'on' : '', n); b.type = 'button';
      b.addEventListener('click', () => { whCat = k; renderWarehouse(); Audio.init(); Audio.ui(); showcase(); }); cats.appendChild(b);
    }
    const card = (slot, id) => {
      const S = id ? Body.SKINS[id] : null, on = (eq[slot.id] || null) === (id || null), R = S ? rarOf(S.rar || 0) : null;
      const b = h('button', 'wh-item' + (on ? ' on' : '') + (S && S.rar ? ' rar' : '')); b.type = 'button';
      if (R) b.style.setProperty('--rc', R.color);
      const ico = h('i', 'wh-ico');
      ico.innerHTML = `<svg viewBox="0 0 24 24">${S ? SKIN_ICON[slot.id](skinFill(S), S.sole !== undefined ? hexs(S.sole) : S.colors ? hexs(S.colors[1]) : S.color2 !== undefined ? hexs(S.color2) : null) : SKIN_ICON.none()}</svg>`;
      b.appendChild(ico); b.appendChild(h('b', '', S ? S.name : slot.name + ' 없음')); b.appendChild(h('span', '', (R ? R.name + ' · ' : '') + slot.name + ' · ' + (on ? '장착 중' : S ? '장착하기' : '벗기')));
      b.title = S ? `${S.name} — ${S.desc || ''}` : `${slot.name} 벗기`;
      b.addEventListener('click', () => { if (!on) equipSkin(slot.id, id || null); });
      return b;
    };
    let n = 0;
    if (whCat === 'gun') {
      // 총기: 스킨을 가진 총마다 '기본' + 가진 스킨. 장착하면 경기에서 그 총을 들 때 내 스킨, 로비 캐릭터도 그 총을 든다
      const gl = Eco.glook(), owned = Eco.gskinsOwned(), order = Object.keys(ITEMS);   // 테스터 스킨은 베타 테스터인 동안만
      const guns = [...new Set(owned.map((id) => GSKINS[id].gun))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const gcard = (gun, id) => {
        const S = id ? GSKINS[id] : null, on = (gl[gun] || null) === (id || null), R = S ? rarOf(S.rar) : null;
        const b = h('button', 'wh-item gun' + (on ? ' on' : '') + (S ? ' rar' : '') + (S && S.tester ? ' tester' : '') + (S && S.rar === 7 ? ' epsilon' : '') + (whGun === gun && on ? ' sel' : '')); b.type = 'button'; if (R) b.style.setProperty('--rc', R.color);
        const ico = h('i', 'wh-ico'); ico.appendChild(Shop.gunImgEl(gun, id));
        b.appendChild(ico); b.appendChild(h('b', '', S ? S.name : '기본')); b.appendChild(h('span', '', (R ? R.name + ' · ' : '') + (S && S.fx ? '효과 · ' : '') + (on ? '장착 중' : '장착하기')));
        if (S && S.tester) { b.appendChild(h('i', 'beta-badge', 'β' + (S.no || ''))); b.appendChild(h('em', 'excl', 'EXCLUSIVE — NEVER AVAILABLE AGAIN')); }   // 베타 테스터 한정 컬렉션
        if (S && S.rar === 7) { b.appendChild(h('i', 'eps-badge', 'ε' + (S.no || ''))); b.appendChild(h('em', 'excl eps', `EPSILON · Ε-${S.no} · 소유 #${Eco.serialOf(id)}`)); b.title = `${GunSkin.name(id)} — EPSILON Ε-${S.no} · 소유 번호 #${Eco.serialOf(id)}
${S.lore || ''}
${S.desc || ''}`; }   // 엡실론: 컬렉션 번호 + 계정마다 다른 소유 번호
        b.title = S ? GunSkin.name(id) + (S.desc ? ' — ' + S.desc : '') : GunSkin.short(gun) + ' 기본';
        b.addEventListener('click', () => { whGun = gun; if (!on) Eco.equipGun(gun, id); else { SETTINGS.gshow = gun; saveSettings(); Lobby.setGun(false); } renderWarehouse(); showcase(); Audio.init(); Audio.ui(); });
        return b;
      };
      for (const gun of guns) {
        grid.appendChild(h('div', 'wh-ghead', GunSkin.short(gun)));
        grid.appendChild(gcard(gun, null));
        for (const id of owned.filter((x) => GSKINS[x].gun === gun).sort((a, b) => GSKINS[b].rar - GSKINS[a].rar)) { grid.appendChild(gcard(gun, id)); n++; }
      }
      if (!guns.length) grid.appendChild(h('div', 'wh-empty', '아직 가진 총기 스킨이 없습니다. 상점의 아스널·네온 상자, 교환소(총기 교환 코인), 옷 상자(드물게)에서 얻을 수 있습니다.'));
    } else if (whCat === 'veh') {
      // 차량: 차종별 기본 + 가진 스킨. 장착하면 경기에서 그 차종 운전석에 탈 때 스킨으로 바뀜
      const vl = Eco.vlook(), tabs = h('div', 'wh-vtabs');
      for (const [t, nm] of Object.entries(VEH_SKIN_TYPES)) { const b = h('button', whVeh === t ? 'on' : '', nm); b.type = 'button'; b.addEventListener('click', () => { whVeh = t; renderWarehouse(); showcase(); Audio.init(); Audio.ui(); }); tabs.appendChild(b); }
      grid.appendChild(tabs);
      const vcard = (id) => {
        const V = id ? VSKINS[id] : null, on = (vl[whVeh] || null) === (id || null), R = V ? rarOf(V.rar) : null;
        const b = h('button', 'wh-item veh' + (on ? ' on' : '') + (V ? ' rar' : '')); b.type = 'button'; if (R) b.style.setProperty('--rc', R.color);
        const ico = h('i', 'wh-ico'), src = V ? Shop.vehThumb(id) : Shop.vehBaseThumb(whVeh); if (src) { const im = h('img'); im.src = src; im.alt = ''; ico.appendChild(im); }
        b.appendChild(ico); b.appendChild(h('b', '', V ? V.name : `기본 ${VEH_SKIN_TYPES[whVeh]}`)); b.appendChild(h('span', '', (R ? R.name + ' · ' + VCLS_NAME[V.cls] + ' · ' : '') + (on ? '장착 중' : '장착하기')));
        b.addEventListener('click', () => { if (!on) { Eco.equipVeh(whVeh, id); renderWarehouse(); showcase(); Audio.init(); Audio.ui(); } });
        return b;
      };
      grid.appendChild(vcard(null));
      const ids = Object.keys(VSKINS).filter((k) => VSKINS[k].veh === whVeh && Eco.ownsVeh(k));
      for (const id of ids) grid.appendChild(vcard(id));
      if (!ids.length) grid.appendChild(h('div', 'wh-empty', `아직 가진 ${VEH_SKIN_TYPES[whVeh]} 스킨이 없습니다. 상점의 차량 뽑기나 교환소에서 얻을 수 있습니다.`));
    } else for (const slot of Body.SLOTS) {
      if (whCat !== 'all' && whCat !== slot.id) continue;
      const ids = Object.keys(Body.SKINS).filter((k) => Body.SKINS[k].slot === slot.id && own.has(k)).sort((a, b) => (Body.SKINS[b].rar || 0) - (Body.SKINS[a].rar || 0));
      if (slot.optional) grid.appendChild(card(slot, null));
      for (const id of ids) { grid.appendChild(card(slot, id)); n++; }
      if (whCat === slot.id && !ids.length) grid.appendChild(h('div', 'wh-empty', `아직 가진 ${slot.name} 스킨이 없습니다. 상점의 상자에서 얻을 수 있습니다.`));
    }
    $('whCount').textContent = `옷 ${own.size}벌 · 차량 스킨 ${(STATS.vskins || []).length}종 · 총기 스킨 ${Eco.gskinsOwned().length}종`;
  }
  // 창고 3D: 차량 분류면 장착한(없으면 기본) 차량을, 아니면 캐릭터
  function showcase() {
    if (lobbyTab !== 'custom') return;
    if (whCat === 'veh') { const vl = Eco.vlook(); Lobby.show({ kind: 'veh', type: whVeh, skin: vl[whVeh] }); }
    else if (whCat === 'gun') { const gun = whGun || Eco.showGun(); Lobby.show({ kind: 'gun', gun, skin: Eco.glook()[gun] || null }); }
    else Lobby.show(null);
  }
  // 로비 탭: 플레이 / 전적 / 창고 / 상점 / 미션
  let lobbyTab = 'play';
  function setTab(t) {
    const prev = lobbyTab;
    lobbyTab = t; Lobby.focus = t === 'custom';
    document.querySelectorAll('#lbTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('#lobby .pane').forEach((p) => { p.hidden = p.dataset.pane !== t; });
    $('segQueue').style.visibility = t === 'play' ? '' : 'hidden';
    const L = document.querySelector('.lb-left'); L.className = 'lb-left tab-' + t + ((SETTINGS.queue === 'ranked' || SETTINGS.queue === 'hardcore') && Rank.unlocked() ? ' ranked' : '');
    document.body.classList.toggle('lobby-wide', t === 'shop' || t === 'mission' || t === 'pass');
    if (prev !== t || t === 'shop' || t === 'mission' || t === 'pass') Shop.onTab(t);
    if (t === 'custom') { if (prev !== t) renderWarehouse(); showcase(); }   // 뽑기로 얻은 옷이 바로 보이게
  }
  const ringSet = (id, f) => { $(id).style.strokeDashoffset = (100.5 * (1 - clamp(f, 0, 1))).toFixed(1); };
  const mapSize = (k) => mapKm(k);
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
    $('opOutfit').textContent = '창고';
    // 전적
    $('rcMatches').textContent = STATS.matches; $('rcWins').textContent = STATS.wins; $('rcKills').textContent = STATS.kills; $('stBest').textContent = STATS.matches ? '#' + STATS.best : '-';
    $('rcWinRate').textContent = STATS.matches ? Math.round(STATS.wins / STATS.matches * 100) + '%' : '-'; $('rcKpm').textContent = STATS.matches ? (STATS.kills / STATS.matches).toFixed(1) : '-';
    const rc = $('recent'); rc.innerHTML = '';
    if (!STATS.recent.length) rc.appendChild(h('li', 'micro', '아직 경기 기록이 없습니다'));
    for (const r of STATS.recent) {
      if (r.dm) { // 데스매치 기록
        const li = h('li', r.win ? 'win' : ''); li.appendChild(h('b', '', `${r.win ? '승' : r.draw ? '무' : '패'} ${r.us}:${r.them}`));
        li.append(`${GAME_TYPES[r.dm] ? GAME_TYPES[r.dm].name : '데스매치'}${r.party ? ' · 파티' : ''} · ${r.kills}킬 ${r.deaths}데스 · ${fmtTime(r.time)}`); rc.appendChild(li); continue;
      }
      const li = h('li', r.rank === 1 ? 'win' : ''); li.appendChild(h('b', '', `#${r.rank}/${r.total}`));
      li.append(`${r.sq > 1 ? ({ 2: '듀오', 3: '트리오', 4: '스쿼드' }[r.sq] || '팀') + ' · ' : ''}${r.party ? '파티 · ' : ''}${r.kills}킬 · ${fmtTime(r.time)} · ${MAPS[r.map] ? MAPS[r.map].name : ''}${r.ranked ? (r.hc ? ' · 하드코어' : ' · 랭크') + (r.delta !== undefined ? ` ${r.delta >= 0 ? '+' : ''}${r.delta}RP` : ' 배치') : ''}`); rc.appendChild(li);
    }
    const D = STATS.dm || DM_STATS0;
    $('rcDm').textContent = D.matches ? `${D.wins} / ${D.matches}` : '-'; $('rcDmKd').textContent = D.matches ? (D.kills / Math.max(1, D.deaths)).toFixed(2) : '-';
    renderWarehouse();
    // 경기 설정 창
    seg('segMode', Object.entries(MODES).map(([k, v]) => [k, v.name]), 'mode');
    seg('segSquad', Object.entries(TEAM_MODES).map(([k, v]) => [k, `${v.name}${v.size > 1 ? ' (' + v.size + '인)' : ''}`]), 'squad');
    seg('segTime', [['day', '낮'], ['dusk', '저녁']], 'time', () => Lobby.applyTime());
    seg('segView', [['tpp', '3인칭'], ['fpp', '1인칭']], 'view');
    seg('segDiff', Object.entries(DIFFICULTY_NAMES), 'difficulty');
    const MP = MAPS[SETTINGS.map], maxB = mapMaxBots(SETTINGS.map);
    if (SETTINGS.bots > maxB) { SETTINGS.bots = maxB; saveSettings(); }
    const br = $('botsRange'); br.max = maxB; br.value = SETTINGS.bots; $('botsVal').textContent = SETTINGS.bots;
    // 대기열(하위 탭): 일반 / 랭크 (레벨 3 미만 잠김, 배틀로얄만). 파티면 파티원 모두 레벨 3 이상이어야 한다
    const dm = isDmGame(SETTINGS.game), GT = GAME_TYPES[SETTINGS.game] || GAME_TYPES.br;
    const lock = typeof Party !== 'undefined' ? Party.lockInfo() : null;   // 파티: 방장이 아니면 설정 잠김, 랭크 가능 여부
    const unlocked = Rank.unlocked() && (!lock || lock.rankOk), hcUn = unlocked && Rank.hcOk() && (!lock || lock.hcOk);
    const hc = SETTINGS.queue === 'hardcore' && hcUn && !dm, ranked = (SETTINGS.queue === 'ranked' && unlocked || hc) && !dm;
    const q = $('segQueue'); q.innerHTML = '';
    // 대기열: 일반 / 랭크 / 하드코어 (일반 랭크 최고 다이아 4 이상만 — 파티면 파티원 모두)
    for (const [v, l] of [['normal', '일반'], ['ranked', unlocked ? '랭크' : '랭크 🔒'], ['hardcore', hcUn ? '하드코어' : '하드코어 🔒']]) {
      const on = v === 'hardcore' ? hc : v === 'ranked' ? ranked && !hc : !ranked, ok = v === 'hardcore' ? hcUn : v === 'ranked' ? unlocked : true;
      const b = h('button', (v !== 'normal' ? v : '') + (on ? ' on' : '') + (!ok ? ' lock' : ''), l); b.type = 'button';
      b.addEventListener('click', (e) => {
        e.preventDefault(); Audio.init(); Audio.ui();
        if (lock && !lock.leader) { showLobbyNote('파티 설정은 방장만 바꿀 수 있습니다'); return; }
        if (v !== 'normal' && !Rank.unlocked()) { showLobbyNote(`랭크전은 레벨 3부터 할 수 있습니다 (현재 레벨 ${levelFromXp(STATS.xp).lv})`); return; }
        if (v !== 'normal' && lock && !lock.rankOk) { showLobbyNote(`파티원 중 레벨 3 미만이 있어 랭크전을 할 수 없습니다 (${lock.lowNames.join(', ')})`); return; }
        if (v === 'hardcore' && !Rank.hcOk()) { showLobbyNote(`하드코어 랭크전은 일반 랭크 최고 기록이 다이아 4 이상이어야 합니다 (내 최고 ${Rank.placed() ? Rank.tierOf(Rank.state.peak || 0).label : '배치고사 전'})`); return; }
        if (v === 'hardcore' && lock && !lock.hcOk) { showLobbyNote(`파티원 중 다이아 4를 찍어 보지 못한 사람이 있어 하드코어를 할 수 없습니다 (${lock.hcLow.join(', ')})`); return; }
        if (v !== 'normal' && dm) { SETTINGS.game = 'br'; showLobbyNote('랭크전은 배틀로얄만 있습니다 — 배틀로얄로 바꿨습니다'); }
        SETTINGS.queue = v; saveSettings(); renderLobby(); if (lock) Party.settingsChanged();
      });
      q.appendChild(b);
    }
    const partyN = lock ? lock.size : 1;
    $('segDiff').parentElement.classList.toggle('locked', ranked); $('fldBots').classList.toggle('locked', ranked || dm); $('segSquad').parentElement.classList.toggle('locked', dm || (ranked && partyN < 2)); $('segMode').parentElement.classList.toggle('locked', dm);
    const duel = isDuel(SETTINGS.game), DTS = dmTeamSize(SETTINGS.game);
    const TS = dm ? DTS : ranked && partyN < 2 ? 1 : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).size;
    if (Lobby.setTeam) { const pm = lock ? Party.members() : null, others = pm ? pm.filter((m) => m.uid !== Cloud.uid) : null; Lobby.setTeam(pm ? pm.length : dm ? 1 : TS, others ? others.map((m) => m.look || {}) : null, others ? others.map((m) => ({ name: m.name, pf: (m.look || {}).pf || null })) : null); }
    const sqName = dm ? `${DTS} 대 ${DTS}` : ranked && partyN < 2 ? '솔로' : (TEAM_MODES[SETTINGS.squad] || TEAM_MODES.solo).name;
    $('cfgNote').hidden = !(ranked || dm);
    if (duel) {
      // 대결: 파티원은 번갈아 양 팀으로 (방장이 블루) — 미리 보여 줌
      const pm = lock ? Party.members() : null, team = [[], []];
      if (pm) pm.forEach((m, i) => team[i % 2].push(m.uid === Cloud.uid ? '나' : m.name));
      const fill = (t) => team[t].concat(Array(Math.max(0, DTS - team[t].length)).fill('봇')).join(' · ');
      $('cfgNote').textContent = `${GT.name}: ${pm ? `블루 [${fill(0)}] vs 레드 [${fill(1)}]` : `나${DTS > 1 ? ' · 봇' : ''} vs 봇 ${DTS}명 (친구를 파티에 초대하면 상대 팀으로)`} · 먼저 ${DUEL_RULES.win}라운드 · 라운드 ${DUEL_RULES.round}초 · 라운드마다 모두 같은 무작위 총` +
        (pm && pm.length > DTS * 2 ? ` · ⚠ ${DTS * 2}명까지 가능 (지금 ${pm.length}명)` : '');
    } else if (dm) $('cfgNote').textContent = `${GT.name}: 4 대 4 고정(빈자리는 봇) · 먼저 ${DM_RULES.killTarget}킬 · 최대 ${DM_RULES.timeLimit / 60}분 · 봇 난이도·시간대·시점만 적용`;
    else if (hc) $('cfgNote').textContent = `하드코어 랭크전: ${sqName} · 봇 ${Rank.botCount(SETTINGS.map)}명 전원 익스트림 · 스토커 4부터 시작 · 일반 랭크보다 RP가 크게 깎입니다`;
    else if (ranked) $('cfgNote').textContent = `랭크전: ${sqName} · 봇 ${Rank.botCount(SETTINGS.map)}명 고정 · 봇 난이도는 ${Rank.placed() ? '현재 티어' : '배치고사 기준(혼합)'}에 맞춰 자동 설정`;
    // 랭크 카드 (랭크·하드코어 대기열에서만)
    const rs = hc ? Rank.hcStatus() : Rank.status(), rc0 = $('rankCard');
    rc0.hidden = !ranked;
    $('rankEmb').src = rs.emb; $('rankLabel').textContent = rs.label; $('rankSub').textContent = rs.sub;
    $('rankBar').style.width = rs.kind === 'ranked' ? (rs.tier.top ? 100 : rs.tier.into) + '%' : rs.kind === 'placement' ? (Rank.state.placed / 3 * 100) + '%' : (levelFromXp(STATS.xp).lv >= 2 ? 50 : 0) + '%';
    rc0.className = 'rank-card' + (hc ? ' hc' : '') + (rs.kind === 'locked' ? ' locked' : '') + (rs.kind === 'ranked' && rs.tier.t >= (hc ? 3 : 8) ? ' glow' : '') + (rs.kind === 'ranked' && !hc && rs.tier.t === 9 ? ' tier-top' : '');
    // 맵 카드 (왼쪽 아래)
    const nb = ranked ? Rank.botCount(SETTINGS.map) : SETTINGS.bots, total = nb + 1, mins = Math.round(matchMinutes()), nTeams = Math.ceil(total / TS);
    const viewKo = SETTINGS.view === 'fpp' ? '1인칭' : '3인칭';
    if (dm) {
      $('mcImg').style.backgroundImage = `url(${LOBBY_ART.arena || LOBBY_ART.kalden})`;
      $('mcTop').textContent = `${GT.name} · ${DTS} 대 ${DTS} · ${viewKo}`; $('mcName').textContent = MAPS.arena.name;
      $('mcTime').textContent = duel ? `먼저 ${DUEL_RULES.win}라운드 · 라운드 ${DUEL_RULES.round}초` : `최대 ${DM_RULES.timeLimit / 60}분`; $('mcPlayers').textContent = `${DTS * 2}명 · 2팀`; $('mcWarn').hidden = true;
    } else {
      $('mcImg').style.backgroundImage = `url(${LOBBY_ART[SETTINGS.map]})`;
      $('mcTop').textContent = `${ranked ? '랭크 · ' + sqName : sqName} · ${viewKo} · ${MODES[SETTINGS.mode].name}`;
      $('mcName').textContent = MP.name.replace(/\s*\(.*\)$/, '');
      $('mcTime').textContent = `약 ${mins}분`; $('mcPlayers').textContent = TS > 1 ? `${total}명 · ${nTeams}팀` : `${total}명`; $('mcWarn').hidden = !MP.big;
    }
    // 모드 선택 (맵 선택 창 위쪽)
    const gg = $('gameGrid'); gg.innerHTML = '';
    for (const [k, T] of Object.entries(GAME_TYPES)) {
      const b = h('button', 'game-opt' + (k === SETTINGS.game ? ' on' : '') + (lock && !lock.leader ? ' lock' : '')); b.type = 'button';
      b.appendChild(h('b', '', T.name)); b.appendChild(h('span', '', T.desc));
      b.addEventListener('click', () => {
        Audio.init(); Audio.ui();
        if (lock && !lock.leader) { showLobbyNote('모드와 맵은 방장만 바꿀 수 있습니다'); return; }
        SETTINGS.game = k; if (T.dm && SETTINGS.queue !== 'normal') SETTINGS.queue = 'normal';
        saveSettings(); renderLobby(); if (lock) Party.settingsChanged();
      });
      gg.appendChild(b);
    }
    // 맵 선택 창
    const mg = $('mapGrid'); mg.innerHTML = '';
    for (const [k, M] of Object.entries(MAPS)) {
      if (M.training) continue; // 훈련장은 로비의 별도 버튼
      if (!!M.arena !== dm) continue; // 데스매치는 전용 맵 하나
      const on = dm || k === SETTINGS.map, b = h('button', 'map-opt' + (on ? ' on' : '') + (dm ? ' fixed' : '')); b.type = 'button';
      const im = h('div', 'mo-img'); im.style.backgroundImage = `url(${LOBBY_ART[k] || LOBBY_ART.kalden})`; im.appendChild(h('em', M.big ? 'big' : '', M.big ? `${mapSize(k)} · 렉 주의` : M.arena ? '72×72m' : mapSize(k)));
      const tx = h('div', 'mo-txt'); tx.appendChild(h('b', '', M.name.replace(/\s*\(.*\)$/, ''))); tx.appendChild(h('span', '', M.desc)); tx.appendChild(h('span', '', M.arena ? '데스매치·대결 전용' : `봇 최대 ${mapMaxBots(k)}명`));
      b.appendChild(im); b.appendChild(tx);
      if (!dm) b.addEventListener('click', () => {
        if (lock && !lock.leader) { showLobbyNote('모드와 맵은 방장만 바꿀 수 있습니다'); return; }
        SETTINGS.map = k; saveSettings(); Audio.init(); Audio.ui(); renderLobby(); if (lock) Party.settingsChanged();
        if (M.big) { const mw = $('mapWarn'); mw.classList.remove('flash'); void mw.offsetWidth; mw.classList.add('flash'); }
      });
      mg.appendChild(b);
    }
    $('mapWarn').hidden = dm || !MP.big;
    if (!dm && MP.big) $('mapWarn').textContent = `⚠ 대형 맵(${mapSize(SETTINGS.map)})은 기기 성능에 따라 렉이 걸릴 수 있습니다. 로딩에 ${MP.half >= 4000 ? '수십 초' : '십여 초'}가 걸리고 메모리를 많이 씁니다(휴대폰은 경기 설정에서 봇 수를 줄이는 것을 권장). 봇 최대 ${maxB}명 · 차량 ${MP.veh || 170}대 · 한 판 약 ${mins}분.`;
    // 출격 버튼 · 요약
    const humans = Math.min(partyN, TS), mateBots = Math.max(0, Math.min(TS, total) - humans);
    if (dm) { const dts = dmTeamSize(SETTINGS.game), dg = isDuel(SETTINGS.game); $('matchBrief').textContent = `${GT.name} · ${MAPS.arena.name} · ${TIMES_KO[SETTINGS.time] || ''} · ${dts} 대 ${dts} (${partyN > 1 ? `파티 ${partyN}명 + ` : ''}봇 ${Math.max(0, dts * 2 - partyN)}명, ${DIFFICULTY_NAMES[SETTINGS.difficulty]}) · 목표: ${dg ? `먼저 ${DUEL_RULES.win}라운드 (라운드 ${DUEL_RULES.round}초)` : `먼저 ${DM_RULES.killTarget}킬 (최대 ${DM_RULES.timeLimit / 60}분)`}`; }
    else $('matchBrief').textContent = `${hc ? '하드코어 랭크전 · ' : ranked ? '랭크전 · ' : ''}${MAPS[SETTINGS.map].name} · ${MODES[SETTINGS.mode].name} · ${TIMES_KO[SETTINGS.time] || ''} · 봇 ${nb}명(${ranked ? '자동' : DIFFICULTY_NAMES[SETTINGS.difficulty]}) · ${TS > 1 ? `${sqName}(${TS}인 팀 · ${partyN > 1 ? `파티 ${humans}명` : '나'}${mateBots ? ` + 봇 ${mateBots}명` : ''}) · 목표: ${nTeams}팀 중 최후의 팀` : `목표: ${total}명 중 최후의 1인`}`;
    $('playBtn').classList.toggle('ranked', ranked); $('playBtn').classList.toggle('hc', hc); $('playBtn').querySelector('span').textContent = hc ? '하드코어 출격' : ranked ? '랭크 출격' : '출격';
    $('playSub').textContent = dm ? `${GT.name} · ${MAPS.arena.name}` : ranked ? `${MAPS[SETTINGS.map].name} · ${rs.label}` : `${sqName} · ${MAPS[SETTINGS.map].name} · ${DIFFICULTY_NAMES[SETTINGS.difficulty]}`;
    if (lock) Party.decoratePlay();
    setTab(lobbyTab);
  }
  const TIMES_KO = { day: '낮', dusk: '저녁' };
  // 소식 카드: 6초마다 바뀜, 누르면 해당 화면으로
  let newsI = 0, newsT = null, rankBanner = null;
  const NEWS = [
    { tag: '이벤트', title: '골드 탄피 이벤트 — 골드 러시 · 행운의 골드 상자 · 매치 보너스 · 주간 챌린지 · 현상금', img: () => LOBBY_ART.vehicles, act: () => { setTab('shop'); const b = document.querySelector('#shopTabs [data-st=event]'); if (b) b.click(); } },
    { tag: '신규', title: '상점 오픈 — 상자 3종 · 차량 뽑기 · 교환소, 미션·출석 보상', img: () => LOBBY_ART.vehicles, act: () => setTab('shop') },
    { tag: '신규', title: '친구·파티 — 친구와 같은 팀으로 출격 (로그인 후 친구 버튼)', img: () => LOBBY_ART.kalden, act: () => Social.openPanel() },
    { tag: '신규 모드', title: '팀 데스매치 · 웨폰 데스매치 — 4 대 4, 먼저 40킬', img: () => LOBBY_ART.arena, act: () => G.ui('mapPick') },
    { tag: '업데이트', title: '팀원과 함께 차량 탑승 — 동승석에서 사격', img: () => LOBBY_ART.vehicles, act: () => G.ui('help') },
    { tag: '신규 모드', title: '듀오·스쿼드 — 기절·부활, 핑(Y)으로 팀원 지휘', img: () => LOBBY_ART.kalden, act: () => G.ui('matchCfg') },
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
    $('botsRange').addEventListener('input', (e) => { const L = Party.lockInfo(); if (L && !L.leader) { e.target.value = SETTINGS.bots; showLobbyNote('파티 설정은 방장만 바꿀 수 있습니다'); return; } SETTINGS.bots = parseInt(e.target.value, 10); $('botsVal').textContent = SETTINGS.bots; saveSettings(); renderLobby(); });
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
      d.appendChild(im); d.appendChild(h('b', '', T.name)); d.appendChild(h('span', '', t === 9 ? '3600 RP 이상' : `${t * 400}–${t * 400 + 399} RP`));
      const mx = Rank.mixOf(t); if (mx && mx[3]) d.appendChild(h('span', 'tier-ext', `익스트림 봇 ${mx[3]}%`));
      g.appendChild(d);
    });
    const ul = $('rankRules'); ul.innerHTML = '';
    const st = Rank.state;
    [`레벨 3부터 참여할 수 있습니다. 처음 3판은 배치고사이며, 결과에 따라 시작 티어가 정해집니다(최대 플래티넘 1).`,
      `각 티어는 4 → 3 → 2 → 1 단계로 올라갑니다. 한 단계는 100 RP, 한 티어는 400 RP입니다.`,
      `RP는 순위(상위일수록 크게), 우승, 처치, 가한 피해로 오르고, 하위권이면 내려갑니다. 높은 티어일수록 오르기 어렵습니다.`,
      `봇 수는 고정(기본 맵·키나루 74명, 노르덴 99명)이고 봇 난이도는 티어가 높을수록 어려워집니다. 골드부터 익스트림 봇(어려움보다 조준·반응·무빙·판단이 한 단계 위)이 섞이고, 이터널은 절반이 익스트림입니다. 경기 도중 나가면 패배 처리와 추가 감점이 있습니다.`,
      Rank.placed() ? `현재 ${Rank.tierOf(st.rp).label} · ${st.rp} RP · 최고 ${Rank.tierOf(st.peak).label} · 랭크 ${st.games}판 ${st.wins}승` : `배치고사 ${st.placed} / 3 진행`].forEach((t) => ul.appendChild(h('li', '', t)));
    // 하드코어 티어표
    const hg = $('hcGrid'); if (!hg) return; hg.innerHTML = '';
    const ok = Rank.hcOk(), H = Rank.hc, hcur = ok ? Rank.hcTierOf(H.rp) : null, PERK = ['', '', '칭호·테두리', '칭호·테두리', '칭호·테두리'];
    HC_TIERS.forEach((T, t) => {
      const d = h('div', 'tier' + (hcur && hcur.t === t ? ' me' : '')), im = h('img'); im.src = Rank.hcEmblem(t, hcur && hcur.t === t ? hcur.div : 1, 160); im.alt = '';
      d.appendChild(im); d.appendChild(h('b', '', T.name)); d.appendChild(h('span', '', t === 4 ? '1600 RP 이상' : `${t * 400}–${t * 400 + 399} RP`));
      if (PERK[t]) d.appendChild(h('span', 'tier-perk', PERK[t]));
      hg.appendChild(d);
    });
    const hl = $('hcRules'); hl.innerHTML = '';
    [`일반 랭크에서 최고 다이아 4 이상을 찍어 본 사람만 참여할 수 있습니다 (파티면 파티원 모두). 배치고사 없이 스토커 4부터 시작합니다.`,
      `티어는 스토커 · 헌터 · 슬레이어 · 리퍼 · 오버로드 5종, 각 4 → 3 → 2 → 1 단계(한 단계 100 RP). 오버로드 1부터는 RP만 쌓입니다.`,
      `봇은 전원 익스트림. 일반 랭크보다 티어 세금과 하위권·탈주 감점이 큽니다. 슬레이어 · 리퍼 · 오버로드에 오르면 그 티어의 칭호와 테두리를 얻습니다(최고 기록 기준, 계정 정보에서 장착).`,
      ok ? `현재 ${hcur.label} · ${H.rp} RP · 최고 ${Rank.hcTierOf(H.peak || 0).label} · 하드코어 ${H.games || 0}판 ${H.wins || 0}승` : `잠김 — 일반 랭크 최고 ${Rank.placed() ? Rank.tierOf(st.peak || 0).label : '배치고사 전'}`].forEach((t) => hl.appendChild(h('li', '', t)));
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
    if (G.hostGone) note = '방장의 연결이 끊겨 경기가 끝났습니다. ' + note;
    if (p.goldAmt) note = `${GOLD_NAME} +${p.goldAmt} 주움 · ` + note;
    if (Eco.claimable()) note += ' 미션 탭에서 받을 보상이 있습니다.';
    { const B = Eco.bpLast; if (B && B.xp) note = `배틀패스 +${B.xp}` + (B.lv > B.lv0 ? ` (${B.lv}단계 달성 · 보상 지급)` : '') + ' · ' + note; }
    $('resNote').textContent = note;
    // 랭크 결과
    const R = G.rankResult, box = $('resRanked'); box.hidden = !R; box.classList.remove('promo');
    if (R) {
      const dEl = $('resRkDelta'); dEl.className = 'rp-delta';
      if (R.placement) {
        if (R.revealed) { const a = R.after; $('resEmb').src = Rank.emblem(a.t, a.div, 160); $('resRkKicker').textContent = '배치고사 완료'; $('resRkLabel').textContent = a.label; $('resRkSub').textContent = `시작 티어가 정해졌습니다 · ${a.rp} RP`; $('resRkBar').style.width = (a.top ? 100 : a.into) + '%'; dEl.textContent = ''; void box.offsetWidth; box.classList.add('promo'); }
        else { $('resEmb').src = Rank.emblem(-1, 0, 160); $('resRkKicker').textContent = '배치고사'; $('resRkLabel').textContent = `${R.step} / 3 완료`; $('resRkSub').textContent = `이번 판 점수 ${R.score} · ${3 - R.step}판 남음`; $('resRkBar').style.width = (R.step / 3 * 100) + '%'; dEl.textContent = ''; }
      } else {
        const a = R.after; $('resEmb').src = Rank.embOf(a, 160);
        $('resRkKicker').textContent = (R.hc ? '하드코어 · ' : '') + (R.tierUp ? '티어 승급!' : R.promoted ? '승급' : R.demoted ? '강등' : '랭크');
        $('resRkLabel').textContent = a.label; $('resRkSub').textContent = a.top ? `${a.rp} RP` : `${a.into} / 100 RP · 총 ${a.rp} RP`;
        dEl.textContent = (R.delta >= 0 ? '+' : '') + R.delta; dEl.classList.add(R.delta >= 0 ? 'up' : 'down');
        // 막대: 이전 값에서 새 값으로
        const bar = $('resRkBar'); bar.style.transition = 'none'; bar.style.width = (R.promoted || R.demoted ? (R.promoted ? 0 : 100) : (R.before.top ? 100 : R.before.into)) + '%'; void bar.offsetWidth; bar.style.transition = 'width 1.2s ease-out'; bar.style.width = (a.top ? 100 : a.into) + '%';
        if (R.promoted) { void box.offsetWidth; box.classList.add('promo'); }
      }
    }
  }
  return { lobbyNote: (m) => showLobbyNote(m), goTab: (t) => setTab(t), whOpen: (cat, gun, skin) => { whCat = cat; if (gun) whGun = gun; setTab('custom'); renderWarehouse(); showcase(); if (gun && skin) Lobby.show({ kind: 'gun', gun, skin }); }, skinIcon: (slot, c, k) => SKIN_ICON[slot](c, k), renderWarehouse, quick, closeQuick, spot, renderRanks, modalOpen, toast, damage, hitmarker, killfeed, setLoot, focusItem, update, refreshInventory, renderInventory, openInv, closeInv, openMap, closeMap, skinKill, drawBig, renderSettings, renderLobby, setupLobby, showResult, reset() { MV.z = 1; MV.cx = MV.cz = 0; spotCallT = -99; $('pingTag').hidden = true; $('dangerTag').hidden = true; document.body.classList.remove('driving', 'riding'); $('teamPanel').dataset.k = ''; $('teamPanel').innerHTML = ''; $('teamTags').innerHTML = ''; document.body.classList.remove('knocked', 'spectating', 'teammode'); $('killfeed').innerHTML = ''; $('toasts').innerHTML = ''; $('dmgRing').innerHTML = ''; closeQuick(); $('fuseHud').hidden = true; lastLootKey = ''; loot = []; $('lootList').innerHTML = ''; $('weaponPanel').dataset.k = ''; $('gearRow').dataset.k = ''; } };
})();
