// ============================================================
// 10_shop.js — 상점·미션 화면 + 상자 3D 모델 + 고등급 뽑기 컷신
//  · 상점 탭: 지갑(골드 탄피·차량 교환 코인), 뽑기 4종(1회·10회, 확률 공개), 교환소(차량 교환 코인 → 차량 스킨)
//  · 미션 탭: 7일 출석 보상, 일일 미션 4개(+모두 받기 보너스), 주간 미션 4개
//  · 결과: 레어도 색 카드. 초희귀 이상이 나오면 먼저 3D 컷신(상자가 흔들리며 빛이 파랑→보라→핑크→빨강으로 바뀌고 열림)
//  · 로비 3D: 고른 상자·차량을 가운데 받침대에 올려 천천히 돌려 보여 준다 (Lobby.show)
// ============================================================
const Shop = (() => {
  let tab = 'gacha', selBox = 'br', selVeh = 'sedan_gt_red', armed = null, armT = null, lastPull = null;
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 이 파일의 문구는 모두 게임 안 고정 목록(이름은 esc 처리) → innerHTML로 아이콘과 함께 넣는다
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const goldIco = () => `<svg class="ico-cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5 9.2 4h5.6L16 7.5V20H8z" fill="url(#g-gold)" stroke="#5a3c08" stroke-width=".8"/><rect x="7.2" y="19.2" width="9.6" height="2.6" rx=".5" fill="url(#g-gold)" stroke="#5a3c08" stroke-width=".8"/><path d="M10 9v8" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/></svg>`;
  const coinIco = () => `<svg class="ico-cur" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="url(#g-coin)" stroke="#0b3a52" stroke-width="1"/><circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"/><path d="M6.8 13.6h10.4l-.6-2-1.7-.4-1.4-1.6H10.3l-1.6 1.6-1.4.4z" fill="#e8f7ff"/><circle cx="9" cy="14.2" r="1.1" fill="#0b3a52"/><circle cx="15" cy="14.2" r="1.1" fill="#0b3a52"/></svg>`;
  const curHtml = (k, n) => `<span class="amt">${k === 'coin' ? coinIco() : goldIco()}<b>${fmt(n)}</b></span>`;
  function wallet(el) { if (el) el.innerHTML = `<span class="cur gold" title="${GOLD_NAME}">${goldIco()}<b>${fmt(Eco.gold)}</b><i>${GOLD_NAME}</i></span><span class="cur coin" title="${COIN_NAME}">${coinIco()}<b>${fmt(Eco.coin)}</b><i>교환 코인</i></span>`; }

  // ---------- 3D 상자 ----------
  //  base(몸통)·lid(뚜껑) 따로 — 컷신에서 뚜껑이 날아간다. seam: 뚜껑 틈의 빛 띠(색이 바뀜)
  function crate(box) {
    const K = Models.kit, { A, BX, CY, RB, SPH, TOR } = K, M = K.M;
    const root = new THREE.Group(), base = Models.cluster('gc:' + box + ':b', (g) => CRATE[box].base(g, K)), lid = new THREE.Group();
    lid.add(Models.cluster('gc:' + box + ':l', (g) => CRATE[box].lid(g, K))); lid.position.y = 0.62;
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x4d8fff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.035, 0.76), seamMat); seam.position.y = 0.62;
    root.add(base); root.add(lid); root.add(seam);
    return { root, base, lid, seam, seamMat };
  }
  const CRATE = {
    // 배틀로얄: 올리브 탄약 상자 + 철 띠 + 주황 줄 + 마름모 표식 + 걸쇠
    br: {
      base(g, { A, BX, RB, M }) {
        const od = M('anod', 0x4f5a34), dk = M('anod', 0x2f3622), am = M('polymer', 0xf0a43a), st = M('gunmetal', 0x3a3d3a);
        A(g, RB(1.0, 0.6, 0.7, 0.03), od, 0, 0.31, 0);
        for (const x of [-0.42, 0.42]) A(g, RB(0.07, 0.62, 0.73, 0.01), dk, x, 0.31, 0);
        A(g, BX(1.02, 0.05, 0.72), dk, 0, 0.04, 0);
        for (const sz of [-1, 1]) { A(g, BX(0.6, 0.05, 0.006), am, 0, 0.47, sz * 0.352); A(g, BX(0.12, 0.12, 0.006), am, 0, 0.27, sz * 0.352, 0, 0, Math.PI / 4); A(g, BX(0.07, 0.07, 0.008), od, 0, 0.27, sz * 0.352, 0, 0, Math.PI / 4); }
        for (const x of [-0.25, 0.25]) A(g, BX(0.08, 0.1, 0.03), st, x, 0.56, 0.365);
        for (const sx of [-1, 1]) A(g, BX(0.03, 0.05, 0.22), st, sx * 0.515, 0.42, 0);
      },
      lid(g, { A, BX, RB, M }) {
        const od = M('anod', 0x56623a), dk = M('anod', 0x2f3622), st = M('gunmetal', 0x3a3d3a);
        A(g, RB(1.04, 0.1, 0.74, 0.03), od, 0, 0.05, 0);
        A(g, BX(1.05, 0.03, 0.06), dk, 0, 0.1, 0); A(g, BX(0.06, 0.03, 0.75), dk, 0, 0.1, 0);
        A(g, BX(0.26, 0.03, 0.05), st, 0, 0.13, 0.18); for (const x of [-0.12, 0.12]) A(g, BX(0.03, 0.05, 0.05), st, x, 0.115, 0.18);
      },
    },
    // 스페셜: 광택 검정 케이스 + 핑크·하늘 빛 테두리 + 크롬 모서리 + 마름모 엠블럼
    sp: {
      base(g, { A, BX, RB, M }) {
        const bk = M('polymer', 0x15151a), ch = M('metal', 0xd8dce0), pk = new THREE.MeshBasicMaterial({ color: 0xff4fb0 }), cy = new THREE.MeshBasicMaterial({ color: 0x46e6ff });
        A(g, RB(1.0, 0.6, 0.7, 0.06), bk, 0, 0.31, 0);
        for (const sz of [-1, 1]) { A(g, BX(0.9, 0.012, 0.006), pk, 0, 0.12, sz * 0.352); A(g, BX(0.9, 0.012, 0.006), cy, 0, 0.5, sz * 0.352); }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) A(g, BX(0.06, 0.6, 0.06), ch, sx * 0.48, 0.31, sz * 0.33);
        for (const sx of [-1, 1]) { A(g, BX(0.006, 0.012, 0.6), pk, sx * 0.502, 0.12, 0); A(g, BX(0.006, 0.012, 0.6), cy, sx * 0.502, 0.5, 0); }
      },
      lid(g, { A, BX, RB, M }) {
        const bk = M('polymer', 0x1c1c22), ch = M('metal', 0xd8dce0), pk = new THREE.MeshBasicMaterial({ color: 0xff4fb0 });
        A(g, RB(1.04, 0.1, 0.74, 0.06), bk, 0, 0.05, 0);
        A(g, BX(0.2, 0.02, 0.2), ch, 0, 0.105, 0, 0, Math.PI / 4, 0); A(g, BX(0.13, 0.024, 0.13), pk, 0, 0.11, 0, 0, Math.PI / 4, 0);
      },
    },
    // 보급: 청회색 철 상자 + 주황 V 표시 + 뚜껑 위 묶인 낙하산 꾸러미
    sup: {
      base(g, { A, BX, RB, M }) {
        const bl = M('anod', 0x3d4c5a), dk = M('anod', 0x23303a), or = M('polymer', 0xff8a1e), st = M('gunmetal', 0x3a3d3a);
        A(g, RB(1.0, 0.6, 0.7, 0.02), bl, 0, 0.31, 0);
        for (const z of [-0.2, 0.2]) A(g, RB(1.03, 0.62, 0.05, 0.01), dk, 0, 0.31, z);
        for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) { A(g, BX(0.26, 0.05, 0.006), or, -0.11, 0.26 + i * 0.14, sz * 0.352, 0, 0, 0.55); A(g, BX(0.26, 0.05, 0.006), or, 0.11, 0.26 + i * 0.14, sz * 0.352, 0, 0, -0.55); }
        for (const sx of [-1, 1]) A(g, BX(0.03, 0.06, 0.2), st, sx * 0.515, 0.45, 0);
      },
      lid(g, { A, BX, RB, CY, M }) {
        const bl = M('anod', 0x45566a), cl = M('cloth', 0xe9e2cf), or = M('cloth', 0xd65a1e), sp = M('cloth', 0x2a2a26);
        A(g, RB(1.04, 0.08, 0.74, 0.02), bl, 0, 0.04, 0);
        A(g, RB(0.6, 0.16, 0.42, 0.06), or, 0, 0.16, 0); A(g, RB(0.62, 0.05, 0.44, 0.02), cl, 0, 0.2, 0);
        for (const x of [-0.18, 0.18]) A(g, BX(0.04, 0.18, 0.45), sp, x, 0.15, 0);
      },
    },
    // 차량: 탄소 케이스 + 금 테 + 뚜껑 위 금 핸들 엠블럼 + 하늘색 빛 줄
    veh: {
      base(g, { A, BX, RB, M }) {
        const cb = M('polymer', 0x18191c), gd = M('brass', 0xd8b04a), cy = new THREE.MeshBasicMaterial({ color: 0x46c8ff });
        A(g, RB(1.0, 0.6, 0.7, 0.04), cb, 0, 0.31, 0);
        for (const sz of [-1, 1]) { A(g, BX(1.0, 0.025, 0.012), gd, 0, 0.6, sz * 0.352); A(g, BX(1.0, 0.025, 0.012), gd, 0, 0.03, sz * 0.352); A(g, BX(0.7, 0.012, 0.006), cy, 0, 0.32, sz * 0.355); }
        for (const sx of [-1, 1]) A(g, BX(0.012, 0.58, 0.72), gd, sx * 0.5, 0.31, 0);
      },
      lid(g, { A, BX, RB, CY, TOR, M }) {
        const cb = M('polymer', 0x1d1e22), gd = M('brass', 0xd8b04a);
        A(g, RB(1.04, 0.1, 0.74, 0.04), cb, 0, 0.05, 0);
        A(g, TOR(0.14, 0.02, 8, 28), gd, 0, 0.11, 0, Math.PI / 2, 0, 0); A(g, CY(0.04, 0.04, 0.03, 16, 'y'), gd, 0, 0.11, 0);
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; A(g, BX(0.13, 0.015, 0.025), gd, Math.cos(a) * 0.075, 0.11, Math.sin(a) * 0.075, 0, -a, 0); }
      },
    },
  };
  // ---------- 썸네일(오프스크린 렌더 → 그림) ----------
  const THUMB = {};
  function thumb(key, make, W, H, dir) {
    if (THUMB[key] !== undefined) return THUMB[key];
    try { THUMB[key] = Models._render(make(), W, H, dir); } catch (e) { console.warn('썸네일 실패', key, e); THUMB[key] = ''; }
    return THUMB[key];
  }
  const crateThumb = (box) => thumb('crate:' + box, () => crate(box).root, 200, 160, [0.9, 0.75, 1.3]);
  const vehThumb = (id) => { const V = VSKINS[id]; return thumb('veh:' + id, () => VehModels.instance(V.veh, id).root, 240, 140, V.veh === 'sedan' ? [1.2, 0.55, 1.0] : [1.3, 0.45, 0.6]); };
  const vehBaseThumb = (type) => thumb('vehb:' + type, () => VehModels.instance(type).root, 240, 140, type === 'sedan' ? [1.2, 0.55, 1.0] : [1.3, 0.45, 0.6]);
  // ---------- 아이콘 ----------
  const SLOT_NAME = { hat: '모자', top: '상의', bottom: '하의', shoes: '신발', gloves: '장갑', chute: '낙하산' };
  const hexs = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  function skinFill(S) { if (S.ico) return `url(#${S.ico})`; const c = S.color !== undefined ? S.color : (S.colors ? S.colors[0] : 0x888888); return hexs(c); }
  function skinSvg(id) {
    const S = Body.SKINS[id]; if (!S) return '';
    const second = S.sole !== undefined ? hexs(S.sole) : S.colors ? hexs(S.colors[1]) : S.color2 !== undefined ? hexs(S.color2) : null;
    return `<svg viewBox="0 0 24 24">${HUD.skinIcon(S.slot, skinFill(S), second)}</svg>`;
  }
  function itemIcon(o) {
    if (o.k === 'gold') return goldIco();
    if (o.k === 'coin') return coinIco();
    if (o.k === 'vskin') { const src = vehThumb(o.id); return src ? `<img src="${src}" alt="">` : coinIco(); }
    return skinSvg(o.id);
  }
  function itemName(o) {
    if (o.k === 'gold') return `${GOLD_NAME} ×${fmt(o.n)}`;
    if (o.k === 'coin') return `${COIN_NAME} ×${o.n}`;
    if (o.k === 'vskin') return VSKINS[o.id].name;
    return Body.SKINS[o.id].name;
  }
  function itemSub(o) {
    if (o.k === 'gold' || o.k === 'coin') return '재화';
    if (o.k === 'vskin') { const V = VSKINS[o.id]; return `${VEH_SKIN_TYPES[V.veh]} 스킨 · ${VCLS_NAME[V.cls]}`; }
    return SLOT_NAME[Body.SKINS[o.id].slot] || '';
  }

  // ---------- 상점 화면 ----------
  function render() {
    wallet($('shopWallet'));
    document.querySelectorAll('#shopTabs button').forEach((b) => b.classList.toggle('on', b.dataset.st === tab));
    const body = $('shopBody'); if (!body) return;
    body.innerHTML = '';
    if (tab === 'gacha') {
      const grid = h('div', 'gc-grid');
      for (const [k, B] of Object.entries(BOXES)) {
        const card = h('div', 'gc-card' + (k === selBox ? ' on' : '') + (k === 'veh' ? ' veh' : '')); card.style.setProperty('--acc', B.accent); card.tabIndex = 0;
        const n = k === 'veh' ? Object.keys(VSKINS).length : Eco.pool(k).filter((x) => x.k === 'skin').length;
        card.innerHTML = `<span class="gc-img"><img src="${crateThumb(k)}" alt=""></span><span class="gc-txt"><b>${B.name}</b><span>${k === 'veh' ? `차량 교환 코인(높은 확률) · 차량 스킨 ${n}종` : `${B.theme} ${n}종 · ${GOLD_NAME}`}</span></span>`;
        const odds = h('button', 'gc-odds', '확률'); odds.type = 'button'; odds.addEventListener('click', (e) => { e.stopPropagation(); click(); openOdds(k); }); card.appendChild(odds);
        const btns = h('span', 'gc-btns');
        for (const n2 of [1, 10]) {
          const cost = B.cost * n2, key = k + ':' + n2, b = h('button', 'gc-buy' + (armed === key ? ' armed' : '') + (Eco.gold < cost ? ' poor' : '')); b.type = 'button';
          b.innerHTML = armed === key ? `<em>${fmt(cost)} 사용 — 한 번 더</em>` : `<em>${n2}회</em>${curHtml('gold', cost)}`;
          b.addEventListener('click', (e) => { e.stopPropagation(); buy(k, n2); }); btns.appendChild(b);
        }
        card.appendChild(btns);
        card.addEventListener('click', () => { click(); selBox = k; render(); Lobby.show({ kind: 'crate', box: k }); });
        grid.appendChild(card);
      }
      body.appendChild(grid);
      $('shopFoot').textContent = `옷 상자는 1회 100, 차량 뽑기는 1회 1,000 ${GOLD_NAME}. 이미 가진 옷이 나오면 ${GOLD_NAME}로, 가진 차량이 나오면 교환 코인으로 일부 돌려받습니다. 상자마다 나오는 옷이 모두 다릅니다.`;
    } else {
      for (const t of Object.keys(VEH_SKIN_TYPES)) {
        const sec = h('div', 'ex-sec'); sec.appendChild(h('h4', '', VEH_SKIN_TYPES[t] + (t === 'sedan' ? ' (세단에 적용)' : '')));
        const grid = h('div', 'ex-grid');
        for (const [id, V] of Object.entries(VSKINS).filter(([, v]) => v.veh === t)) {
          const own = Eco.ownsVeh(id), R = rarOf(V.rar), key = 'ex:' + id;
          const card = h('div', 'ex-card' + (id === selVeh ? ' on' : '') + (own ? ' own' : '')); card.style.setProperty('--rc', R.color);
          card.innerHTML = `<span class="ex-img"><img src="${vehThumb(id)}" alt=""></span><span class="ex-rar">${R.name} · ${VCLS_NAME[V.cls]}</span><b>${esc(V.name)}</b>`;
          const b = h('button', 'ex-buy' + (armed === key ? ' armed' : '') + (!own && Eco.coin < V.price ? ' poor' : '')); b.type = 'button';
          b.innerHTML = own ? '보유 중' : armed === key ? '<em>교환 확인</em>' : `<em>교환</em>${curHtml('coin', V.price)}`;
          b.disabled = own;
          b.addEventListener('click', (e) => { e.stopPropagation(); swap(id); });
          card.appendChild(b);
          card.addEventListener('click', () => { click(); selVeh = id; render(); Lobby.show({ kind: 'veh', type: V.veh, skin: id }); });
          grid.appendChild(card);
        }
        sec.appendChild(grid); body.appendChild(sec);
      }
      $('shopFoot').textContent = `${COIN_NAME}은 차량 뽑기(높은 확률)와 출석 6일째 보상으로 얻습니다. 교환한 차량은 창고 → 차량에서 장착하면, 경기 중 그 차종의 운전석에 탈 때 내 스킨으로 바뀝니다.`;
    }
  }
  const click = () => { Audio.init(); Audio.ui(); };
  // 1,000 이상 쓰는 버튼은 두 번 눌러 확인
  function arm(key) { armed = key; clearTimeout(armT); armT = setTimeout(() => { armed = null; if (tab) render(); }, 3500); render(); }
  function buy(box, n) {
    click();
    const cost = BOXES[box].cost * n;
    if (Eco.gold < cost) { HUD.lobbyNote(`${GOLD_NAME}이(가) 부족합니다 — 필요 ${fmt(cost)}, 보유 ${fmt(Eco.gold)} (미션·출석 보상·경기 중 주머니로 모을 수 있습니다)`); return; }
    if (cost >= 1000 && armed !== box + ':' + n) { arm(box + ':' + n); return; }
    armed = null; clearTimeout(armT);
    const r = Eco.pull(box, n); if (r.err) { HUD.lobbyNote(r.err); render(); return; }
    lastPull = { box, n };
    reveal(r, `${BOXES[box].name} × ${n}`, box);
  }
  function swap(id) {
    click();
    const V = VSKINS[id]; if (Eco.ownsVeh(id)) return;
    if (Eco.coin < V.price) { HUD.lobbyNote(`${COIN_NAME}이 부족합니다 — 필요 ${V.price}, 보유 ${Eco.coin} (차량 뽑기·출석 보상으로 모을 수 있습니다)`); return; }
    if (armed !== 'ex:' + id) { arm('ex:' + id); return; }
    armed = null; clearTimeout(armT);
    const r = Eco.exchange(id); if (r.err) { HUD.lobbyNote(r.err); render(); return; }
    lastPull = null;
    reveal(r, `교환소 · ${V.name}`, 'veh');
  }
  // 결과: 초희귀 이상이면 컷신 → 카드
  function reveal(r, title, box) {
    render(); renderMissions(); badge();
    const top = r.res.reduce((m, x) => (x.rar > m.rar ? x : m), r.res[0]);
    const show = () => showResults(r, title);
    if (r.best >= 3) Cutscene.play(box, r.best, top, show); else show();
  }
  function showResults(r, title) {
    const P = $('gachaRes'), grid = $('gresGrid'); grid.innerHTML = '';
    $('gresTitle').textContent = title;
    grid.classList.toggle('one', r.res.length === 1);
    r.res.forEach((o, i) => {
      const R = rarOf(o.rar), c = h('div', 'gr-card r' + o.rar); c.style.setProperty('--rc', R.color); c.style.animationDelay = (i * 0.07) + 's';
      c.innerHTML = `<span class="gr-ico">${itemIcon(o)}</span><span class="gr-rar">${R.name}</span><b class="gr-name">${esc(itemName(o))}</b><span class="gr-sub">${esc(itemSub(o))}</span>` +
        (o.isNew ? '<em class="gr-tag new">NEW</em>' : o.dup ? `<em class="gr-tag dup">중복 → ${o.refund ? GOLD_NAME + ' +' + o.refund : '코인 +' + o.refundCoin}</em>` : '');
      grid.appendChild(c);
    });
    const gotG = r.res.reduce((a, o) => a + (o.k === 'gold' ? o.n : 0) + (o.refund || 0), 0), gotC = r.res.reduce((a, o) => a + (o.k === 'coin' ? o.n : 0) + (o.refundCoin || 0), 0);
    $('gresNote').innerHTML = (r.cost ? `사용 ${curHtml('gold', r.cost)} · ` : '') + (gotG ? `받은 ${GOLD_NAME} ${curHtml('gold', gotG)} · ` : '') + (gotC ? `받은 코인 ${curHtml('coin', gotC)} · ` : '') + `남은 ${curHtml('gold', Eco.gold)} ${curHtml('coin', Eco.coin)}`;
    $('gresAgain').hidden = !lastPull; $('gresWh').hidden = !r.res.some((o) => o.isNew && (o.k === 'skin' || o.k === 'vskin'));
    P.hidden = false;
    if (r.best >= 3) Audio.gacha && Audio.gacha('show', r.best); else Audio.gacha && Audio.gacha('small', r.best);
  }
  // ---------- 확률 공개 ----------
  function openOdds(box) {
    const B = BOXES[box], P = Eco.pool(box), grid = $('oddsGrid'); grid.innerHTML = '';
    $('oddsTitle').textContent = `${B.name} 확률`;
    $('oddsNote').textContent = `1회 ${fmt(B.cost)} ${GOLD_NAME}. 한 번 뽑을 때마다 아래 확률로 하나가 나옵니다(10회는 10번 각각). 합계 100%.`;
    for (let r = RARITY.length - 1; r >= 0; r--) {
      const rows = P.filter((x) => x.rar === r); if (!rows.length) continue;
      const R = rarOf(r), sum = rows.reduce((a, x) => a + x.p, 0), sec = h('div', 'od-sec'); sec.style.setProperty('--rc', R.color);
      sec.appendChild(h('div', 'od-head', `<b>${R.name}</b><span>${sum.toFixed(2)}%</span>`));
      for (const x of rows) { const row = h('div', 'od-row'); row.innerHTML = `<span class="od-ico">${itemIcon(x)}</span><span class="od-name">${esc(itemName(x))}<small>${esc(itemSub(x))}</small></span><span class="od-p">${x.p.toFixed(x.p < 1 ? 3 : 2)}%</span>`; sec.appendChild(row); }
      grid.appendChild(sec);
    }
    $('oddsPanel').hidden = false;
  }
  // ---------- 미션 화면 ----------
  function renderMissions() {
    wallet($('misWallet'));
    const A = Eco.attendInfo(), row = $('attRow'); if (!row) return;
    row.innerHTML = '';
    let done = A.n % 7; if (!A.can && done === 0 && A.n > 0) done = 7;
    $('attSub').textContent = `누적 ${A.n}일`;
    ATTEND.forEach((R, i) => {
      const st = i < done ? 'got' : i === done && A.can ? 'now' : 'later', c = h('button', 'att-cell ' + st + (i === 6 ? ' big' : '')); c.type = 'button';
      c.innerHTML = `<span>${i + 1}일</span>${R.coin ? curHtml('coin', R.coin) : curHtml('gold', R.gold)}<em>${st === 'got' ? '받음' : st === 'now' ? '받기' : ''}</em>`;
      if (st === 'now') c.addEventListener('click', () => { click(); const r = Eco.attend(); if (r.err) return HUD.lobbyNote(r.err); Audio.gacha && Audio.gacha('small', 2); HUD.lobbyNote(`출석 ${r.day}일째 보상: ${r.reward.coin ? COIN_NAME + ' +' + r.reward.coin : GOLD_NAME + ' +' + r.reward.gold}`); });
      else c.disabled = true;
      row.appendChild(c);
    });
    const L = Eco.questList();
    const list = (el, items) => {
      el.innerHTML = '';
      for (const q of items) {
        const r = h('div', 'mq' + (q.claimed ? ' claimed' : q.done ? ' done' : ''));
        const cur = q.unit === 'm' ? `${(q.cur / 1000).toFixed(1)} / ${q.goal / 1000}km` : q.unit === 's' ? `${Math.floor(q.cur / 60)} / ${q.goal / 60}분` : `${fmt(q.cur)} / ${fmt(q.goal)}`;
        r.innerHTML = `<span class="mq-txt"><b>${esc(q.name)}</b><span class="bar"><i style="width:${(q.cur / q.goal * 100).toFixed(1)}%"></i></span><small>${cur}</small></span>${curHtml('gold', q.gold)}`;
        const b = h('button', 'btn mq-btn', q.claimed ? '완료' : q.done ? '받기' : '진행 중'); b.type = 'button'; b.disabled = !q.done || q.claimed;
        b.addEventListener('click', () => { click(); const x = Eco.claim(q.id); if (x.err) return HUD.lobbyNote(x.err); Audio.gacha && Audio.gacha('small', 2); });
        r.appendChild(b); el.appendChild(r);
      }
    };
    list($('misDaily'), L.daily); list($('misWeekly'), L.weekly);
    const bo = $('misBonus'); bo.innerHTML = `<span>일일 미션 4개를 모두 받으면 보너스</span>${curHtml('gold', L.bonus.gold)}`;
    const bb = h('button', 'btn mq-btn', L.bonus.got ? '완료' : L.bonus.can ? '받기' : '잠김'); bb.type = 'button'; bb.disabled = !L.bonus.can;
    bb.addEventListener('click', () => { click(); const x = Eco.claimBonus(); if (x.err) return HUD.lobbyNote(x.err); Audio.gacha && Audio.gacha('small', 3); });
    bo.appendChild(bb);
    const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), left = Math.max(0, mid - now) / 60000;
    $('misReset').textContent = `초기화까지 ${Math.floor(left / 60)}시간 ${Math.floor(left % 60)}분`;
  }
  function badge() { const d = $('misDot'); if (d) d.hidden = !Eco.claimable(); }
  // 탭이 바뀔 때 (HUD.setTab에서 호출): 로비 3D 진열
  function onTab(t) {
    if ((t === 'shop' || t === 'mission') && Cloud.user) Cloud.pull();
    if (t === 'shop') { render(); Lobby.show(tab === 'gacha' ? { kind: 'crate', box: selBox } : { kind: 'veh', type: VSKINS[selVeh].veh, skin: selVeh }); }
    else if (t === 'mission') { renderMissions(); Lobby.show(null); }
    else if (t !== 'custom') Lobby.show(null);
    badge();
  }
  function setup() {
    document.querySelectorAll('#shopTabs button').forEach((b) => b.addEventListener('click', () => { click(); tab = b.dataset.st; armed = null; render(); onTab('shop'); }));
    $('oddsClose').addEventListener('click', () => { click(); $('oddsPanel').hidden = true; });
    $('oddsPanel').addEventListener('click', (e) => { if (e.target === $('oddsPanel')) $('oddsPanel').hidden = true; });
    $('gresOk').addEventListener('click', () => { click(); $('gachaRes').hidden = true; });
    $('gresAgain').addEventListener('click', () => { $('gachaRes').hidden = true; if (lastPull) buy(lastPull.box, lastPull.n); });
    $('gresWh').addEventListener('click', () => { click(); $('gachaRes').hidden = true; HUD.goTab('custom'); });
    $('csSkip').addEventListener('click', (e) => { e.stopPropagation(); Cutscene.skip(); });
    $('csLayer').addEventListener('click', () => Cutscene.skip());
    Eco.on(() => { wallet($('shopWallet')); wallet($('misWallet')); badge(); if (!$('lobby').hidden) { const P = document.querySelector('[data-pane=mission]'); if (P && !P.hidden) renderMissions(); } });
    badge();
    // 첫 접속 선물 안내 (재화가 새로 생긴 경우)
    const e = Eco.E(); if (e.welcome === 1 && !e.welcomed) { e.welcomed = 1; saveStats(); setTimeout(() => HUD.lobbyNote(`첫 접속 선물: ${GOLD_NAME} ${fmt(WELCOME_GOLD)} — 상점에서 상자를 뽑아 보세요`), 1200); }
    setInterval(() => { if (G.state === 'lobby') badge(); }, 30000);
  }
  // 경기가 시작되면 상점 창·컷신을 닫는다 (파티 방장이 시작하는 경우 등)
  function closeAll() { if (Cutscene.active) Cutscene.skip(); for (const id of ['gachaRes', 'oddsPanel']) { const e = $(id); if (e) e.hidden = true; } armed = null; }
  return { render, renderMissions, setup, onTab, closeAll, crate, crateThumb, vehThumb, vehBaseThumb, itemIcon, itemName, skinSvg, wallet, openOdds, badge, goldIco, coinIco, curHtml, get sel() { return { tab, box: selBox, veh: selVeh }; } };
})();

// ============================================================
// 고등급 뽑기 컷신 (초희귀·슈퍼레어·울트라레어)
//  어두운 무대 → 카메라가 다가감 → 상자가 흔들리며 뚜껑 틈 빛이 파랑→보라→핑크→빨강으로 단계 상승(등급까지)
//  → 뚜껑이 튀어 오르고 빛기둥·불꽃 → 등급·이름 표시 → 결과 카드. 화면을 누르면 건너뛴다
// ============================================================
const Cutscene = (() => {
  let S = null, active = false, t = 0, t0 = 0, last = 0, D = 3, tier = 3, cb = null, steps = [], stepI = 0, opened = false, item = null;
  const DUR = { 3: 3.0, 4: 3.8, 5: 4.9 };
  function texDot() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  function texBeam() { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); }
  function texFloor() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, '#2a2f33'); gr.addColorStop(0.6, '#121517'); gr.addColorStop(1, '#07090b'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.05)'; for (let r = 20; r < 128; r += 18) { g.beginPath(); g.arc(128, 128, r, 0, TAU); g.stroke(); } return new THREE.CanvasTexture(c); }
  function build() {
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x07090b); sc.fog = new THREE.Fog(0x07090b, 8, 22);
    const cam = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 60);
    sc.add(new THREE.HemisphereLight(0x8090a0, 0x101010, 0.55));
    const key = new THREE.SpotLight(0xffffff, 1.6, 14, 0.6, 0.5); key.position.set(1.5, 5, 3); sc.add(key); sc.add(key.target);
    const glow = new THREE.PointLight(0x4d8fff, 0, 6, 2); glow.position.set(0, 0.9, 0); sc.add(glow);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshBasicMaterial({ map: texFloor() })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
    const ringM = new THREE.MeshBasicMaterial({ color: 0x4d8fff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 48), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; sc.add(ring);
    const pillarM = new THREE.MeshBasicMaterial({ map: texBeam(), color: 0x4d8fff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 9, 24, 1, true), pillarM); pillar.position.y = 0.6 + 4.5; pillar.scale.y = 0.01; sc.add(pillar);
    // 뚜껑 틈에서 새는 빛살 (방사형 판)
    const raysM = new THREE.MeshBasicMaterial({ map: texBeam(), color: 0x4d8fff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const rays = new THREE.Group(); for (let i = 0; i < 10; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.2), raysM); p.position.y = 1.1; p.rotation.set(0, i / 10 * Math.PI, (i % 2 ? 1 : -1) * 0.35); rays.add(p); } sc.add(rays);
    // 불꽃 입자
    const N = 260, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: texDot(), color: 0x4d8fff, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; sc.add(pts);
    S = { sc, cam, key, glow, ring, ringM, pillar, pillarM, rays, raysM, pts, pm, pos, vel, N, box: null, crate: null };
  }
  const colOf = (r) => rarOf(r).hex;
  function setCol(hex) { for (const m of [S.ringM, S.pillarM, S.raysM, S.pm]) m.color.setHex(hex); S.glow.color.setHex(hex); if (S.crate) S.crate.seamMat.color.setHex(hex); }
  function resetParticles(burst) {
    for (let i = 0; i < S.N; i++) {
      const a = Math.random() * TAU, r = burst ? 0.1 : 0.9 + Math.random() * 0.8;
      S.pos[i * 3] = Math.cos(a) * r; S.pos[i * 3 + 1] = burst ? 0.7 : Math.random() * 0.4; S.pos[i * 3 + 2] = Math.sin(a) * r;
      const sp = burst ? 2 + Math.random() * 4 : 0.2 + Math.random() * 0.5;
      S.vel[i * 3] = burst ? Math.cos(a) * sp * 0.5 : -Math.sin(a) * sp; S.vel[i * 3 + 1] = burst ? 2 + Math.random() * 5 : 0.4 + Math.random() * 0.8; S.vel[i * 3 + 2] = burst ? Math.sin(a) * sp * 0.5 : Math.cos(a) * sp;
    }
    S.pts.geometry.attributes.position.needsUpdate = true;
  }
  function play(box, best, top, done) {
    if (!S) build();
    if (S.crate) S.sc.remove(S.crate.root);
    S.crates = S.crates || {}; S.crate = S.crates[box] = S.crates[box] || Shop.crate(box); S.sc.add(S.crate.root); S.box = box;
    const C = S.crate; C.root.position.set(0, 0, 0); C.root.rotation.set(0, 0, 0); C.lid.position.set(0, 0.62, 0); C.lid.rotation.set(0, 0, 0); C.seamMat.opacity = 0;
    tier = clamp(best, 3, 5); D = DUR[tier]; t = 0; t0 = last = performance.now(); cb = done; opened = false; item = top;
    // 빛 단계: 레어(파랑)부터 결과 등급까지
    steps = []; for (let r = 2; r <= tier; r++) steps.push(r); stepI = 0; setCol(colOf(2));
    S.ringM.opacity = 0; S.pillarM.opacity = 0; S.pillar.scale.y = 0.01; S.raysM.opacity = 0; S.pm.opacity = 0; S.glow.intensity = 0;
    resetParticles(false);
    active = true;
    $('csLayer').hidden = false; $('csText').className = 'cs-text'; $('csFlash').className = 'cs-flash';
    $('csRar').textContent = ''; $('csName').textContent = '';
    $('lobby').classList.add('cs-hide');
    Audio.gacha && Audio.gacha('start', tier);
  }
  function finish() {
    if (!active) return; active = false;
    $('csLayer').hidden = true; $('lobby').classList.remove('cs-hide');
    const f = cb; cb = null; if (f) f();
  }
  function skip() { if (!active) return; if (!opened) open(true); finish(); }
  function open(silent) {
    opened = true; setCol(colOf(tier));
    resetParticles(true); S.pm.opacity = 1;
    $('csFlash').className = 'cs-flash on';
    const R = rarOf(tier); $('csRar').textContent = R.name; $('csRar').style.color = R.color; $('csName').textContent = item ? Shop.itemName(item) : '';
    $('csText').className = 'cs-text on r' + tier;
    if (!silent) Audio.gacha && Audio.gacha('open', tier);
  }
  function update() {
    if (!active) return;
    // 프레임이 느려도 실제 시간대로 진행(장면 길이가 기기와 무관)
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; t = (now - t0) / 1000;
    const C = S.crate, cam = S.cam, tOpen = D - 1.35;
    // 카메라: 멀리 위에서 → 상자 앞으로
    const k = smoothstep01(clamp(t / 1.1, 0, 1)), sh = !opened ? clamp((t - 0.5) / Math.max(0.1, tOpen - 0.5), 0, 1) : 0;
    const shake = sh * sh * (0.012 + tier * 0.006), back = opened ? smoothstep01(clamp((t - tOpen) / 0.8, 0, 1)) : 0;   // 열린 뒤 뒤로 빠져 빛기둥까지 보이게
    cam.position.set(lerp(lerp(2.6, 1.2, k), 2.0, back) + (Math.random() - 0.5) * shake * 0.5, lerp(lerp(3.4, 1.35, k), 1.9, back), lerp(lerp(5.6, 2.9, k), 4.6, back));
    cam.lookAt(0, opened ? lerp(0.6, 1.25, back) : 0.55, 0);
    S.ringM.opacity = Math.min(0.8, t * 0.8);
    if (!opened) {
      // 단계별 색 바꾸기 (각 단계에서 번쩍)
      const segT = (tOpen - 0.5) / steps.length, want = clamp(Math.floor((t - 0.5) / segT), 0, steps.length - 1);
      if (t > 0.5 && want !== stepI) { stepI = want; setCol(colOf(steps[stepI])); Audio.gacha && Audio.gacha('tick', steps[stepI]); }
      const pulse = 0.5 + 0.5 * Math.sin(t * (10 + sh * 18));
      C.root.position.x = (Math.random() - 0.5) * shake; C.root.rotation.z = (Math.random() - 0.5) * shake * 1.6; C.root.rotation.y = Math.sin(t * 1.3) * 0.15;
      C.lid.position.y = 0.62 + sh * 0.025 * pulse; C.seamMat.opacity = t > 0.5 ? 0.35 + 0.65 * sh * pulse : 0;
      S.glow.intensity = t > 0.5 ? (0.6 + sh * 2.2) * (0.6 + 0.4 * pulse) : 0;
      S.raysM.opacity = t > 0.5 ? 0.12 + sh * 0.35 * pulse : 0; S.rays.rotation.y += dt * 0.6;
      S.pm.opacity = Math.min(0.85, t * 0.5);
      if (t >= tOpen) open();
    } else {
      const u = t - tOpen;
      C.root.position.x = 0; C.root.rotation.z = 0;
      C.lid.position.y = 0.62 + u * 3.2 - u * u * 2.2; C.lid.rotation.x = -u * 2.4; C.lid.position.z = -u * 0.8;
      C.seamMat.opacity = Math.max(0, 1 - u * 1.5);
      S.pillar.scale.y = Math.min(1, u * 3.5); S.pillar.position.y = 0.6 + 4.5 * S.pillar.scale.y; S.pillarM.opacity = Math.min(0.7, u * 3) * (0.85 + 0.15 * Math.sin(u * 20));
      S.glow.intensity = 3.2 + Math.sin(u * 14) * 0.6; S.raysM.opacity = Math.max(0, 0.7 - u * 0.4); S.rays.rotation.y += dt * 1.4;
      S.pm.opacity = Math.max(0, 1 - u * 0.55);
      if (u > 0.25 && $('csFlash').className === 'cs-flash on') $('csFlash').className = 'cs-flash';
      if (t >= D) finish();
    }
    // 입자
    const P = S.pos, V = S.vel;
    for (let i = 0; i < S.N; i++) {
      const j = i * 3;
      if (opened) { V[j + 1] -= 3.5 * dt; P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt; if (P[j + 1] < 0) { P[j + 1] = 0; V[j + 1] *= -0.3; } }
      else { const x = P[j], z = P[j + 2]; P[j] += (V[j] - x * 0.25) * dt; P[j + 2] += (V[j + 2] - z * 0.25) * dt; P[j + 1] += V[j + 1] * dt; if (P[j + 1] > 2.2) { P[j + 1] = 0; } }
    }
    S.pts.geometry.attributes.position.needsUpdate = true;
  }
  function render(R) { if (!active || !S) return false; R.render(S.sc, S.cam); return true; }
  function resize(w, h) { if (S) { S.cam.aspect = w / h; S.cam.updateProjectionMatrix(); } }
  return { play, skip, update, render, resize, get active() { return active; } };
})();
