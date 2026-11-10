// ============================================================
// 10_shop.js — 상점·미션 화면 + 상자 3D 모델 + 고등급 뽑기 컷신
//  · 상점 탭: 지갑(골드 탄피·차량 교환 코인·총기 교환 코인), 뽑기 6종(총기 2 · 옷 3 · 차량, 1회·10회, 확률 공개)
//    교환소: 총기(총기 교환 코인 → 총기 스킨) · 차량(차량 교환 코인 → 차량 스킨)
//  · 미션 탭: 7일 출석 보상, 일일 미션 4개(+모두 받기 보너스), 주간 미션 4개
//  · 결과: 레어도 색 카드. 초희귀 이상이 나오면 먼저 3D 컷신(상자가 흔들리며 빛이 파랑→보라→핑크→빨강으로 바뀌고 열림)
//  · 로비 3D: 고른 상자·차량을 가운데 받침대에 올려 천천히 돌려 보여 준다 (Lobby.show)
// ============================================================
const Shop = (() => {
  let tab = 'gacha', selBox = 'g1', selVeh = 'sedan_gt_red', selGun = 'g1_m416_magma', exSub = 'gun', armed = null, armT = null, lastPull = null;
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 이 파일의 문구는 모두 게임 안 고정 목록(이름은 esc 처리) → innerHTML로 아이콘과 함께 넣는다
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const goldIco = () => `<svg class="ico-cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5 9.2 4h5.6L16 7.5V20H8z" fill="url(#g-gold)" stroke="#5a3c08" stroke-width=".8"/><rect x="7.2" y="19.2" width="9.6" height="2.6" rx=".5" fill="url(#g-gold)" stroke="#5a3c08" stroke-width=".8"/><path d="M10 9v8" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/></svg>`;
  const coinIco = () => `<svg class="ico-cur" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="url(#g-coin)" stroke="#0b3a52" stroke-width="1"/><circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"/><path d="M6.8 13.6h10.4l-.6-2-1.7-.4-1.4-1.6H10.3l-1.6 1.6-1.4.4z" fill="#e8f7ff"/><circle cx="9" cy="14.2" r="1.1" fill="#0b3a52"/><circle cx="15" cy="14.2" r="1.1" fill="#0b3a52"/></svg>`;
  // 총기 교환 코인: 붉은 동전 + 탄 모양
  const gcoinIco = () => `<svg class="ico-cur" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="url(#g-gcoin)" stroke="#5a1408" stroke-width="1"/><circle cx="12" cy="12" r="7" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".8"/><path d="M10.3 16.6V10.2c0-1.5.7-2.8 1.7-3.6 1 .8 1.7 2.1 1.7 3.6v6.4z" fill="#fff3e4"/><path d="M9.7 16.6h4.6v1.6H9.7z" fill="#ffcf9a"/></svg>`;
  const curIco = (k) => (k === 'coin' ? coinIco() : k === 'gcoin' ? gcoinIco() : goldIco());
  const curHtml = (k, n) => `<span class="amt">${curIco(k)}<b>${fmt(n)}</b></span>`;
  function wallet(el) { if (el) el.innerHTML = `<span class="cur gold" title="${GOLD_NAME}">${goldIco()}<b>${fmt(Eco.gold)}</b><i>${GOLD_NAME}</i></span><span class="cur coin" title="${COIN_NAME}">${coinIco()}<b>${fmt(Eco.coin)}</b><i>차량 코인</i></span><span class="cur gcoin" title="${GCOIN_NAME}">${gcoinIco()}<b>${fmt(Eco.gcoin)}</b><i>총기 코인</i></span>`; }

  // ---------- 3D 상자 ----------
  //  base(몸통)·lid(뚜껑) 따로 — 컷신에서 뚜껑이 날아간다. seam: 뚜껑 틈의 빛 띠(색이 바뀜)
  //  dim: 뚜껑 높이·틈 크기 (총기 상자는 길고 낮은 총 케이스)
  function crate(box) {
    const K = Models.kit, D = CRATE[box].dim || {}, lidY = D.lidY || 0.62;
    const root = new THREE.Group(), base = Models.cluster('gc:' + box + ':b', (g) => CRATE[box].base(g, K)), lid = new THREE.Group();
    lid.add(Models.cluster('gc:' + box + ':l', (g) => CRATE[box].lid(g, K))); lid.position.y = lidY;
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x4d8fff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(D.sw || 1.06, 0.035, D.sd || 0.76), seamMat); seam.position.y = lidY;
    root.add(base); root.add(lid); root.add(seam);
    return { root, base, lid, seam, seamMat, lidY };
  }
  const CRATE = {
    // 아스널(총기): 올리브 하드 총 케이스 + 검정 고무 범퍼 + 황동 걸쇠 4개 + 주황 띠 + 뚜껑 위 볼록 줄·육각 황동 엠블럼
    g1: {
      dim: { lidY: 0.4, sw: 1.56, sd: 0.6 },
      base(g, { A, BX, RB, M }) {
        const od = M('anod', 0x4b5233), dk = M('rubber', 0x1c1d1a), br = M('brass', 0xc9a24a), st = M('gunmetal', 0x2e302c), or = M('polymer', 0xe0892a);
        A(g, RB(1.5, 0.38, 0.56, 0.05), od, 0, 0.2, 0);
        for (const x of [-0.56, 0.56]) A(g, RB(0.07, 0.4, 0.58, 0.03), dk, x, 0.2, 0);
        A(g, RB(1.52, 0.04, 0.58, 0.02), dk, 0, 0.02, 0);
        for (const sz of [-1, 1]) { for (const x of [-0.4, -0.2, 0.2, 0.4]) A(g, BX(0.09, 0.08, 0.03), br, x, 0.34, sz * 0.285); A(g, BX(0.6, 0.025, 0.006), or, 0, 0.13, sz * 0.281); }
        A(g, BX(0.3, 0.035, 0.045), dk, 0, 0.26, 0.31); for (const x of [-0.14, 0.14]) A(g, BX(0.03, 0.06, 0.04), st, x, 0.27, 0.295);
      },
      lid(g, { A, BX, RB, CY, M }) {
        const od = M('anod', 0x535b39), dk = M('rubber', 0x1c1d1a), br = M('brass', 0xc9a24a);
        A(g, RB(1.53, 0.09, 0.58, 0.04), od, 0, 0.045, 0);
        for (const z of [-0.2, -0.11, 0.11, 0.2]) A(g, BX(1.3, 0.022, 0.04), dk, 0, 0.098, z);
        A(g, CY(0.075, 0.075, 0.03, 6, 'y'), br, 0, 0.11, 0); A(g, CY(0.045, 0.045, 0.034, 6, 'y'), M('anod', 0x2a2d22), 0, 0.112, 0);
      },
    },
    // 네온(총기): 광택 검정 총 케이스 + 분홍·하늘 빛 줄 + 크롬 모서리 + 뚜껑 위 사선 빛 줄·육각 엠블럼
    g2: {
      dim: { lidY: 0.4, sw: 1.56, sd: 0.6 },
      base(g, { A, BX, RB, M }) {
        const bk = M('polymer', 0x121216), ch = M('metal', 0xd6dade), pk = new THREE.MeshBasicMaterial({ color: 0xff2d95 }), cy = new THREE.MeshBasicMaterial({ color: 0x2ae8ff });
        A(g, RB(1.5, 0.38, 0.56, 0.06), bk, 0, 0.2, 0);
        for (const sz of [-1, 1]) { A(g, BX(1.36, 0.014, 0.006), pk, 0, 0.35, sz * 0.281); A(g, BX(1.36, 0.01, 0.006), cy, 0, 0.06, sz * 0.281); A(g, BX(0.12, 0.08, 0.02), ch, 0, 0.3, sz * 0.287); }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) A(g, BX(0.06, 0.4, 0.06), ch, sx * 0.73, 0.2, sz * 0.26);
        for (const sx of [-1, 1]) A(g, BX(0.006, 0.014, 0.46), pk, sx * 0.752, 0.35, 0);
      },
      lid(g, { A, BX, RB, CY, M }) {
        const bk = M('polymer', 0x17171c), ch = M('metal', 0xd6dade), pk = new THREE.MeshBasicMaterial({ color: 0xff2d95 }), cy = new THREE.MeshBasicMaterial({ color: 0x2ae8ff });
        A(g, RB(1.53, 0.09, 0.58, 0.06), bk, 0, 0.045, 0);
        for (let i = 0; i < 3; i++) A(g, BX(0.46, 0.008, 0.022), i === 1 ? cy : pk, -0.42 + i * 0.08, 0.093, 0, 0, 0.7, 0);
        A(g, CY(0.08, 0.08, 0.02, 6, 'y'), ch, 0.38, 0.1, 0); A(g, CY(0.05, 0.05, 0.024, 6, 'y'), pk, 0.38, 0.102, 0);
      },
    },
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
  // 총기 스킨 썸네일 (id 없으면 기본 총). 목록은 한꺼번에 렌더하면 휴대폰에서 끊기므로
  //  아직 없는 그림은 빈 칸으로 두고 로비 프레임마다 하나씩 그려 넣는다(<img data-th>)
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', TQ = [];
  const gkey = (gun, id) => 'gs:' + gun + ':' + (id || '');
  const gunThumb = (gun, id) => thumb(gkey(gun, id), () => buildGunMesh(gun, {}, id || null), 240, 104, [-1, 0.22, 0.12]);
  function gunSrc(gun, id) { const k = gkey(gun, id); if (THUMB[k] !== undefined) return THUMB[k] || BLANK; if (!TQ.some((q) => q[0] === k)) TQ.push([k, gun, id]); return BLANK; }
  const gunImg = (gun, id) => `<img data-th="${gkey(gun, id)}" src="${gunSrc(gun, id)}" alt="">`;
  function gunImgEl(gun, id) { const im = document.createElement('img'); im.dataset.th = gkey(gun, id); im.src = gunSrc(gun, id); im.alt = ''; return im; }
  function pump() { if (!TQ.length) return; const [k, gun, id] = TQ.shift(), src = gunThumb(gun, id) || BLANK; document.querySelectorAll(`img[data-th="${k}"]`).forEach((im) => { im.src = src; }); }
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
    if (o.k === 'gcoin') return gcoinIco();
    if (o.k === 'gskin') return gunImg(GSKINS[o.id].gun, o.id);
    if (o.k === 'vskin') { const src = vehThumb(o.id); return src ? `<img src="${src}" alt="">` : coinIco(); }
    return skinSvg(o.id);
  }
  function itemName(o) {
    if (o.k === 'gold') return `${GOLD_NAME} ×${fmt(o.n)}`;
    if (o.k === 'coin') return `${COIN_NAME} ×${o.n}`;
    if (o.k === 'gcoin') return `${GCOIN_NAME} ×${o.n}`;
    if (o.k === 'vskin') return VSKINS[o.id].name;
    if (o.k === 'gskin') return GunSkin.name(o.id);
    return Body.SKINS[o.id].name;
  }
  function itemSub(o) {
    if (o.k === 'gold' || o.k === 'coin' || o.k === 'gcoin') return '재화';
    if (o.k === 'gskin') { const S = GSKINS[o.id], cls = ITEMS[S.gun].name.replace(GunSkin.short(S.gun), '').trim(); return `총기 스킨 · ${cls}` + (S.fx ? ' · 사격·교체 효과' + (S.parts ? ' · 부속품' : '') : S.lite ? ' · 약한 사격·맞힘 효과' : ''); }
    if (o.k === 'vskin') { const V = VSKINS[o.id]; return `${VEH_SKIN_TYPES[V.veh]} 스킨 · ${VCLS_NAME[V.cls]}`; }
    return SLOT_NAME[Body.SKINS[o.id].slot] || '';
  }

  // ---------- 상점 화면 ----------
  function render() {
    wallet($('shopWallet'));
    document.querySelectorAll('#shopTabs button').forEach((b) => b.classList.toggle('on', b.dataset.st === tab));
    const body = $('shopBody'); if (!body) return;
    body.innerHTML = '';
    if (tab === 'event') { renderEvents(body); badge(); return; }
    if (tab === 'gacha') {
      const grid = h('div', 'gc-grid');
      for (const [k, B] of Object.entries(BOXES)) {
        const card = h('div', 'gc-card' + (k === selBox ? ' on' : '') + (k === 'veh' ? ' veh' : '') + (B.gun ? ' gun' : '')); card.style.setProperty('--acc', B.accent); card.tabIndex = 0; card.dataset.box = k;
        const P = Eco.pool(k), n = k === 'veh' ? Object.keys(VSKINS).length : P.filter((x) => x.k === (B.gun ? 'gskin' : 'skin')).length, gn = B.gun ? 0 : P.filter((x) => x.k === 'gskin').length;
        const sub = k === 'veh' ? `차량 교환 코인(높은 확률) · 차량 스킨 ${n}종` : B.gun ? `총기 교환 코인 70% · ${B.theme} ${n}종` : `${B.theme} ${n}종 · 총기 스킨 ${gn}종 · ${GOLD_NAME}`;
        card.innerHTML = `<span class="gc-img"><img src="${crateThumb(k)}" alt=""></span><span class="gc-txt"><b>${B.name}${B.isNew && !(Eco.E().pulls[k] > 0) ? '<em class="gc-new">NEW</em>' : ''}</b><span>${sub}</span></span>`;
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
      $('shopFoot').textContent = `총기 상자·차량 뽑기는 1회 200, 옷 상자는 1회 100 ${GOLD_NAME}. 총기 상자는 70% 확률로 총기 교환 코인, 나머지는 총기 스킨이 나오고 울트라레어 스킨은 쏠 때와 총을 바꿀 때 효과가 있습니다. 이미 가진 것이 나오면 일부를 돌려받습니다.`;
    } else {
      // 교환소: 총기 / 차량
      const subt = h('div', 'ex-subtabs');
      for (const [k, nm] of [['gun', '총기 스킨'], ['veh', '차량 스킨']]) { const b = h('button', exSub === k ? 'on' : '', nm); b.type = 'button'; b.addEventListener('click', () => { click(); exSub = k; armed = null; render(); onTab('shop'); }); subt.appendChild(b); }
      body.appendChild(subt);
    }
    if (tab !== 'gacha' && exSub === 'gun') {
      for (const r of [5, 4, 3, 1]) {
        const ids = Object.keys(GSKINS).filter((id) => GSKINS[id].rar === r && Eco.gunPrice(id)); if (!ids.length) continue;
        const R = rarOf(r), sec = h('div', 'ex-sec'); sec.appendChild(h('h4', '', `${R.name}` + (r === 5 ? ' · 사격·교체 효과' : '')));
        const grid = h('div', 'ex-grid gun');
        for (const id of ids) {
          const S = GSKINS[id], own = Eco.ownsGun(id), price = Eco.gunPrice(id), key = 'exg:' + id;
          const card = h('div', 'ex-card' + (id === selGun ? ' on' : '') + (own ? ' own' : '')); card.style.setProperty('--rc', R.color);
          card.innerHTML = `<span class="ex-img">${gunImg(S.gun, id)}</span><span class="ex-rar">${R.name} · ${esc(GunSkin.short(S.gun))}</span><b>${esc(S.name)}</b>`;
          const b = h('button', 'ex-buy' + (armed === key ? ' armed' : '') + (!own && Eco.gcoin < price ? ' poor' : '')); b.type = 'button';
          b.innerHTML = own ? '보유 중' : armed === key ? '<em>교환 확인</em>' : `<em>교환</em>${curHtml('gcoin', price)}`;
          b.disabled = own;
          b.addEventListener('click', (e) => { e.stopPropagation(); swapGun(id); });
          card.appendChild(b);
          card.addEventListener('click', () => { click(); selGun = id; render(); Lobby.show({ kind: 'gun', gun: S.gun, skin: id }); });
          grid.appendChild(card);
        }
        sec.appendChild(grid); body.appendChild(sec);
      }
      $('shopFoot').textContent = `${GCOIN_NAME}은 아스널·네온 상자에서 70% 확률로 나옵니다. 교환한 스킨은 창고 → 총기에서 장착하면 경기·훈련장에서 그 총을 들 때 적용됩니다.`;
    } else if (tab !== 'gacha') {
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
  let whGo = null;
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
  function swapGun(id) {
    click();
    const S = GSKINS[id], price = Eco.gunPrice(id); if (!S || !price || Eco.ownsGun(id)) return;
    if (Eco.gcoin < price) { HUD.lobbyNote(`${GCOIN_NAME}이 부족합니다 — 필요 ${price}, 보유 ${Eco.gcoin} (아스널·네온 상자에서 70% 확률로 나옵니다)`); return; }
    if (armed !== 'exg:' + id) { arm('exg:' + id); return; }
    armed = null; clearTimeout(armT);
    const r = Eco.exchangeGun(id); if (r.err) { HUD.lobbyNote(r.err); render(); return; }
    lastPull = null;
    reveal(r, `교환소 · ${GunSkin.name(id)}`, S.box);
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
        (o.isNew ? '<em class="gr-tag new">NEW</em>' : o.dup ? `<em class="gr-tag dup">중복 → ${o.refund ? GOLD_NAME + ' +' + o.refund : o.refundGC ? '총기 코인 +' + o.refundGC : '차량 코인 +' + o.refundCoin}</em>` : '');
      grid.appendChild(c);
    });
    const gotG = r.res.reduce((a, o) => a + (o.k === 'gold' ? o.n : 0) + (o.refund || 0), 0), gotC = r.res.reduce((a, o) => a + (o.k === 'coin' ? o.n : 0) + (o.refundCoin || 0), 0), gotGC = r.res.reduce((a, o) => a + (o.k === 'gcoin' ? o.n : 0) + (o.refundGC || 0), 0);
    $('gresNote').innerHTML = (r.cost ? `사용 ${curHtml('gold', r.cost)} · ` : '') + (gotG ? `받은 ${GOLD_NAME} ${curHtml('gold', gotG)} · ` : '') + (gotC ? `받은 차량 코인 ${curHtml('coin', gotC)} · ` : '') + (gotGC ? `받은 총기 코인 ${curHtml('gcoin', gotGC)} · ` : '') + `남은 ${curHtml('gold', Eco.gold)} ${curHtml('coin', Eco.coin)} ${curHtml('gcoin', Eco.gcoin)}`;
    // 새로 얻은 것이 있으면 창고로: 총기 스킨이면 창고 → 총기(그 총)로 바로
    const nw = r.res.filter((o) => o.isNew && (o.k === 'skin' || o.k === 'vskin' || o.k === 'gskin')), ng = nw.find((o) => o.k === 'gskin');
    whGo = ng && !nw.some((o) => o.k === 'skin') ? { cat: 'gun', gun: GSKINS[ng.id].gun, skin: ng.id } : nw.some((o) => o.k === 'vskin') && !nw.some((o) => o.k === 'skin') ? { cat: 'veh' } : null;
    $('gresAgain').hidden = !lastPull; $('gresWh').hidden = !nw.length; $('gresWh').textContent = whGo && whGo.cat === 'gun' ? '창고에서 장착' : '창고에서 입기';
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
      for (const x of rows) { const row = h('div', 'od-row' + (x.k === 'gskin' ? ' gun' : '')); row.innerHTML = `<span class="od-ico">${itemIcon(x)}</span><span class="od-name">${esc(itemName(x))}<small>${esc(itemSub(x))}</small></span><span class="od-p">${x.p.toFixed(x.p < 1 ? 3 : 2)}%</span>`; sec.appendChild(row); }
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
  // ---------- 골드 탄피 이벤트 (상점 → 골드 이벤트) ----------
  const fmtLeft = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
  let evTimer = null;
  function renderEvents(body) {
    const I = Eco.evInfo(), EV = GOLD_EV;
    const card = (cls, icon, title, sub, prog, btnTxt, can, onClick, note) => {
      const c = h('div', 'ev-card ' + cls + (can ? ' ready' : ''));
      c.innerHTML = `<span class="ev-ico">${icon}</span><span class="ev-txt"><b>${title}</b><span>${sub}</span>${prog ? `<span class="ev-prog">${prog}</span>` : ''}</span>`;
      const b = h('button', 'ev-btn' + (can ? '' : ' off')); b.type = 'button'; b.innerHTML = btnTxt; b.disabled = !can;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (can) onClick(); }); c.appendChild(b);
      if (note) c.appendChild(h('span', 'ev-note', note));
      body.appendChild(c);
    };
    const got = (r, what) => { if (r.err) { HUD.lobbyNote(r.err); return; } Audio.ui(); HUD.lobbyNote(`${what} · ${GOLD_NAME} +${fmt(r.gold)}`); wallet($('shopWallet')); render(); };
    body.appendChild(h('p', 'ev-head', `골드 탄피를 많이 모을 수 있는 상시 이벤트 — 날마다·주마다 다시 열립니다`));
    card('rush', '🎁', '골드 러시', `하루 한 번 무료로 ${fmt(EV.rush)} 골드 탄피`, I.rush ? '오늘 받을 수 있음' : '내일 다시 열림', I.rush ? `받기 ${curHtml('gold', EV.rush)}` : '받음', I.rush, () => got(Eco.evClaim('rush'), '골드 러시'));
    const lk = I.luckyIn <= 0;
    card('lucky', '🎰', '행운의 골드 상자', `4시간마다 무료 · 50 ~ 1,000 골드 탄피 무작위 (1,000은 3%)`, lk ? '지금 열 수 있음' : `다음 상자까지 ${fmtLeft(I.luckyIn)}`, lk ? '열기' : '대기 중', lk, () => got(Eco.evClaim('lucky'), '행운의 골드 상자'));
    card('match', '⚔', '매치 보너스', `배틀로얄 한 판마다 자동 지급 · 기본 ${EV.match.base} + 처치당 ${EV.match.kill} + 10위 안 ${EV.match.top10} + 우승 ${EV.match.win} (하루 ${EV.match.max}판까지)`, `오늘 ${I.mg} / ${EV.match.max}판 · 받은 양 ${fmt(I.mgGold)}`, '자동', false, () => {}, '경기가 끝나면 바로 들어옵니다 (중간에 나가면 제외)');
    const wk = h('div', 'ev-card week' + (I.weekReady ? ' ready' : ''));
    wk.innerHTML = `<span class="ev-ico">📅</span><span class="ev-txt"><b>주간 출격 챌린지</b><span>이번 주 배틀로얄 판수를 채우면 보상 · 월요일 초기화</span><span class="ev-prog">이번 주 ${I.wm}판</span></span>`;
    const steps = h('span', 'ev-steps');
    EV.week.forEach(([n, g], i) => { const done = I.wc.includes(i), can = !done && I.wm >= n, b = h('button', 'ev-btn sm' + (can ? '' : ' off')); b.type = 'button'; b.disabled = !can; b.innerHTML = done ? `${n}판 ✓` : `${n}판 ${curHtml('gold', g)}`; b.addEventListener('click', () => got(Eco.evClaim('week', i), `주간 ${n}판 달성`)); steps.appendChild(b); });
    wk.appendChild(steps); body.appendChild(wk);
    const br = I.bountyReady > 0;
    card('bounty', '🎯', '처치 현상금', `이번 주 처치 ${EV.bounty.per}명마다 ${fmt(EV.bounty.gold)} 골드 탄피 (주 ${EV.bounty.max}번까지)`, `이번 주 처치 ${I.wk}명 · 받은 횟수 ${I.bc} / ${EV.bounty.max}`, br ? `받기 ${curHtml('gold', EV.bounty.gold)}` : '대기 중', br, () => got(Eco.evClaim('bounty'), '처치 현상금'));
    $('shopFoot').textContent = `이벤트 보상은 로그인하면 계정에 저장되고, 다른 기기에서 같은 날·같은 주 보상을 다시 받을 수는 없습니다. 훈련장·데스매치는 판수·처치에 들어가지 않습니다.`;
    clearTimeout(evTimer); if (!lk) evTimer = setTimeout(() => { const P = document.querySelector('[data-pane=shop]'); if (tab === 'event' && P && !P.hidden) render(); }, Math.min(60000, I.luckyIn + 200));
  }
  function badge() { const d = $('misDot'); if (d) d.hidden = !Eco.claimable(); const ev = Eco.evClaimable(), s = $('shopDot'), e2 = $('evDot'); if (s) s.hidden = !ev; if (e2) e2.hidden = !ev; }
  // 탭이 바뀔 때 (HUD.setTab에서 호출): 로비 3D 진열
  function onTab(t) {
    if ((t === 'shop' || t === 'mission') && Cloud.user) Cloud.pull();
    if (t === 'shop') { render(); Lobby.show(tab === 'gacha' ? { kind: 'crate', box: selBox } : exSub === 'gun' ? { kind: 'gun', gun: GSKINS[selGun].gun, skin: selGun } : { kind: 'veh', type: VSKINS[selVeh].veh, skin: selVeh }); }
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
    $('gresWh').addEventListener('click', () => { click(); $('gachaRes').hidden = true; if (whGo) HUD.whOpen(whGo.cat, whGo.gun, whGo.skin); else HUD.goTab('custom'); });
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
  return { render, renderMissions, setup, onTab, closeAll, crate, crateThumb, vehThumb, vehBaseThumb, gunThumb, gunImgEl, pump, itemIcon, itemName, skinSvg, wallet, openOdds, badge, goldIco, coinIco, gcoinIco, curHtml, get sel() { return { tab, box: selBox, veh: selVeh, gun: selGun, ex: exSub }; } };
})();

// ============================================================
// 고등급 뽑기 컷신 (초희귀·슈퍼레어·울트라레어)
//  어두운 무대 → 카메라가 다가감 → 상자가 흔들리며 뚜껑 틈 빛이 파랑→보라→핑크→빨강으로 단계 상승(등급까지)
//  → 뚜껑이 튀어 오르고 빛기둥·불꽃 → 등급·이름 표시 → 결과 카드. 화면을 누르면 건너뛴다
//  총기 상자는 상자만 총 케이스로 바뀌고, 총기 스킨이 나오면 열린 케이스에서 그 총이 떠올라 돈다(울트라레어는 빛 띠와 함께 나타남)
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
      S.pos[i * 3] = Math.cos(a) * r; S.pos[i * 3 + 1] = burst ? (S.crate ? S.crate.lidY : 0.62) + 0.08 : Math.random() * 0.4; S.pos[i * 3 + 2] = Math.sin(a) * r;
      const sp = burst ? 2 + Math.random() * 4 : 0.2 + Math.random() * 0.5;
      S.vel[i * 3] = burst ? Math.cos(a) * sp * 0.5 : -Math.sin(a) * sp; S.vel[i * 3 + 1] = burst ? 2 + Math.random() * 5 : 0.4 + Math.random() * 0.8; S.vel[i * 3 + 2] = burst ? Math.sin(a) * sp * 0.5 : Math.cos(a) * sp;
    }
    S.pts.geometry.attributes.position.needsUpdate = true;
  }
  function play(box, best, top, done) {
    if (!S) build();
    if (S.crate) S.sc.remove(S.crate.root);
    S.crates = S.crates || {}; S.crate = S.crates[box] = S.crates[box] || Shop.crate(box); S.sc.add(S.crate.root); S.box = box;
    const C = S.crate; C.root.position.set(0, 0, 0); C.root.rotation.set(0, 0, 0); C.lid.position.set(0, C.lidY, 0); C.lid.rotation.set(0, 0, 0); C.seamMat.opacity = 0;
    // 총기 스킨이 나오면 케이스에서 떠오를 총 (가운데를 축으로 돌게 감쌈)
    if (S.gun) { S.sc.remove(S.gun); S.gun = null; }
    if (top && top.k === 'gskin' && GSKINS[top.id]) {
      const g = buildGunMesh(GSKINS[top.id].gun, {}, top.id), bb = new THREE.Box3().setFromObject(g), pv = new THREE.Group();
      g.position.sub(bb.getCenter(new THREE.Vector3())); pv.add(g); pv.scale.setScalar(Math.min(2.6, 1.75 / Math.max(0.3, bb.max.z - bb.min.z)));
      pv.visible = false; pv.userData.gun = g; S.sc.add(pv); S.gun = pv;
    }
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
    if (S.gun) { S.gun.visible = true; S.gunT = 0; S.gun.position.set(0, S.crate.lidY - 0.1, 0); if (!silent) GunSkin.draw(S.gun.userData.gun, 0.9, null); }
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
      C.lid.position.y = C.lidY + sh * 0.025 * pulse; C.seamMat.opacity = t > 0.5 ? 0.35 + 0.65 * sh * pulse : 0;
      S.glow.intensity = t > 0.5 ? (0.6 + sh * 2.2) * (0.6 + 0.4 * pulse) : 0;
      S.raysM.opacity = t > 0.5 ? 0.12 + sh * 0.35 * pulse : 0; S.rays.rotation.y += dt * 0.6;
      S.pm.opacity = Math.min(0.85, t * 0.5);
      if (t >= tOpen) open();
    } else {
      const u = t - tOpen;
      C.root.position.x = 0; C.root.rotation.z = 0;
      // 총이 떠오를 때는 뚜껑이 멀리 뒤로 날아가 총을 가리지 않게
      if (S.gun) { C.lid.position.y = C.lidY + u * 2.6 - u * u * 3.2; C.lid.rotation.x = -u * 3.2; C.lid.position.z = -u * 2.6; }
      else { C.lid.position.y = C.lidY + u * 3.2 - u * u * 2.2; C.lid.rotation.x = -u * 2.4; C.lid.position.z = -u * 0.8; }
      // 총: 빛기둥 앞쪽으로 떠올라 천천히 돈다
      if (S.gun) { S.gunT += dt; const k = smoothstep01(clamp(S.gunT / 0.9, 0, 1)); S.gun.position.set(0, lerp(C.lidY - 0.1, C.lidY + 0.85, k), lerp(0, 0.55, k)); S.gun.rotation.set(0.12 * (1 - k), 0.5 + S.gunT * 0.9, 0); }
      C.seamMat.opacity = Math.max(0, 1 - u * 1.5);
      S.pillar.scale.y = Math.min(1, u * 3.5); S.pillar.position.y = C.lidY - 0.02 + 4.5 * S.pillar.scale.y; S.pillarM.opacity = Math.min(S.gun ? 0.42 : 0.7, u * 3) * (0.85 + 0.15 * Math.sin(u * 20));
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
