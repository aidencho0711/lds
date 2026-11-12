// ============================================================
// 10_shop_pass.js — 배틀패스 화면 (로비 '패스' 탭) + 단계 보상 알림
//  · 규칙·보상표는 10_eco.js (BP · bpReward · Eco.bpInfo / bpBuy / bpTake)
//  · 위: 시즌 이름 · 지금 단계 · 경험치 막대 · 배틀패스 플러스 구매(골드 탄피)
//  · 가운데: 1~50단계 보상 두 줄(기본 · PLUS)을 옆으로 넘겨 봄 — 지난 단계는 '받음', 플러스를 안 샀으면 자물쇠
//  · 아래: 단계 올리는 방법(경험치 표)
// ============================================================
const Pass = (() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const click = () => { Audio.init(); Audio.ui(); };
  let armed = false, lastLv = -1;
  const LOCK = '<svg class="bp-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke-width="2"/></svg>';
  const RIBBON = '<svg class="bp-rib" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 13.6 6.5 22l5.5-3 5.5 3-1.7-8.4" fill="#e8483f" stroke="#5a1408" stroke-linejoin="round"/><circle cx="12" cy="9" r="6.2" fill="#ffd36b" stroke="#6b4a08"/><path d="m12 5.4 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3z" fill="#fff"/></svg>';
  // 보상 한 칸: 그림 + 양 (+ 칭호)
  function cellHtml(R) {
    let ico, txt;
    if (R.k === 'box') { ico = `<span class="bp-box" style="--c:${BOXES[R.box].accent}"><i></i></span>`; txt = `${BOXES[R.box].name}<small>무료 ${R.n}회</small>`; }
    else { ico = R.k === 'coin' ? Shop.coinIco() : R.k === 'gcoin' ? Shop.gcoinIco() : Shop.goldIco(); txt = `${fmt(R.n)}<small>${R.k === 'coin' ? '차량 코인' : R.k === 'gcoin' ? '총기 코인' : GOLD_NAME}</small>`; }
    return `<span class="bp-ico">${ico}</span><b>${txt}</b>` + (R.title ? `<em>${RIBBON}${BP_TITLES[R.title]}</em>` : '');
  }
  function render(scroll) {
    const pane = document.querySelector('[data-pane=pass]'); if (!pane) return;
    const I = Eco.bpInfo(), X = BP.xp;
    Shop.wallet($('passWallet'));
    $('bpSeason').textContent = '배틀패스 · ' + I.name;
    // ----- 위: 단계 · 경험치 · 플러스 -----
    const head = $('bpHead'); head.innerHTML = '';
    const lvBox = h('div', 'bp-lv', `<small>단계</small><b>${I.lv}</b><i>/ ${I.max}</i>`);
    const bar = h('div', 'bp-prog', `<div class="bp-prog-top"><span>${I.lv >= I.max ? '최고 단계 달성' : `다음 단계까지 ${fmt(I.per - I.cur)} 경험치`}</span><span>${fmt(I.cur)} / ${fmt(I.per)}</span></div><div class="bar"><i style="width:${(I.cur / I.per * 100).toFixed(1)}%"></i></div><div class="bp-prog-sub">누적 ${fmt(I.xp)} 경험치 · ${I.everyLeft}판 더 하면 누적 보너스 +${X.everyXp}</div>`);
    const buy = h('div', 'bp-buy' + (I.plus ? ' own' : ''));
    if (I.plus) buy.innerHTML = '<b class="bp-plus-tag">PLUS</b><span class="bp-buy-txt">배틀패스 플러스 사용 중<small>단계가 오르면 플러스 보상도 함께 들어옵니다</small></span>';
    else {
      buy.innerHTML = `<b class="bp-plus-tag">PLUS</b><span class="bp-buy-txt">배틀패스 플러스<small>플러스 보상 줄 전체${I.lv > 0 ? ` · 지금 ${I.lv}단계까지의 보상을 바로 받음` : ''} · 전용 칭호·테두리</small></span>`;
      const b = h('button', 'btn bp-buy-btn' + (armed ? ' armed' : ''), armed ? `<em>${fmt(I.cost)} 사용 — 한 번 더 눌러 구매</em>` : `<em>구매</em>${Shop.curHtml('gold', I.cost)}`); b.type = 'button';
      b.addEventListener('click', () => {
        click();
        if (!armed) { if (Eco.gold < I.cost) return HUD.lobbyNote(`${GOLD_NAME}이(가) 부족합니다 (필요 ${fmt(I.cost)} · 보유 ${fmt(Eco.gold)})`); armed = true; render(); return; }
        armed = false; const r = Eco.bpBuy(); if (r.err) { HUD.lobbyNote(r.err); render(); return; }
        if (Audio.gacha) Audio.gacha('open', 5);
        if (!notify()) HUD.lobbyNote('배틀패스 플러스를 샀습니다 — 단계가 오르면 플러스 보상도 함께 들어옵니다');
      });
      buy.appendChild(b);
    }
    head.append(lvBox, bar, buy);
    // ----- 가운데: 보상 두 줄 -----
    const tr = $('bpTrack'), old = tr.querySelector('.bp-scroll'), keep = old ? old.scrollLeft : -1; tr.innerHTML = '';
    tr.appendChild(h('div', 'bp-col bp-col-head', `<span class="bp-n"></span><span class="bp-cell free"><b>기본</b><small>모두에게</small></span><span class="bp-cell plus"><b>PLUS</b><small>${I.plus ? '사용 중' : '잠김'}</small></span>`));
    const sc = h('div', 'bp-scroll'); tr.appendChild(sc);
    for (let lv = 1; lv <= I.max; lv++) {
      const F = bpReward(lv, false), P = bpReward(lv, true), got = lv <= I.lv;
      const col = h('div', 'bp-col' + (got ? ' got' : lv === I.lv + 1 ? ' next' : '') + (lv % 10 === 0 || lv === 1 ? ' big' : lv % 5 === 0 ? ' mid' : ''));
      col.innerHTML = `<span class="bp-n">${lv}</span><span class="bp-cell free${got ? ' got' : ''}">${cellHtml(F)}${got ? '<i class="bp-ok">받음</i>' : ''}</span>`
        + `<span class="bp-cell plus${got && I.plus ? ' got' : ''}${I.plus ? '' : ' lock'}">${cellHtml(P)}${I.plus ? (got ? '<i class="bp-ok">받음</i>' : '') : LOCK}</span>`;
      sc.appendChild(col);
    }
    if (scroll || keep < 0 || lastLv !== I.lv) { const c = sc.children[Math.max(0, Math.min(I.max - 1, I.lv))]; if (c) sc.scrollLeft = Math.max(0, c.offsetLeft - sc.clientWidth * 0.35); } else sc.scrollLeft = keep;
    lastLv = I.lv;
    // ----- 아래: 경험치 표 -----
    $('bpHow').innerHTML = `<h4>단계 올리는 방법 <small>${I.per} 경험치마다 1단계 · 보상은 단계가 오르는 순간 바로 들어옵니다</small></h4><div class="bp-how-grid">`
      + [['상자 뽑기 1회', X.pull], ['배틀로얄 한 판 완료', X.play], [`처치 1명 (한 판 ${X.killMax}명까지)`, X.kill], ['10위 안에 들기', X.top10], ['우승', X.win], [`${X.every}판 플레이할 때마다`, X.everyXp], [`데스매치 한 판 (처치 +${X.dmKill} · 승리 +${X.dmWin})`, X.dm]].map(([n, v]) => `<span><i>${n}</i><b>+${v}</b></span>`).join('') + '</div>';
  }
  // 방금 들어온 단계 보상을 한 줄로 알림 (로비에서만 — 경기에서 오른 단계는 로비로 돌아왔을 때). 알렸으면 true
  function notify() {
    if (G.state !== 'lobby') return false;
    const N = Eco.bpTake(); if (!N.length) return false;
    let gold = 0, coin = 0, gcoin = 0; const etc = [];
    const add = (o) => {
      if (o.k === 'gold') gold += o.n; else if (o.k === 'coin') coin += o.n; else if (o.k === 'gcoin') gcoin += o.n;
      else { etc.push(Shop.itemName(o) + (o.dup ? '(중복)' : '')); gold += o.refund || 0; gcoin += o.refundGC || 0; coin += o.refundCoin || 0; }
    };
    for (const o of N) { if (o.k === 'box') (o.res || []).forEach(add); else add(o); if (o.title) etc.push(`칭호 「${BP_TITLES[o.title]}」`); }
    const lv = Math.max(...N.map((o) => o.lv));
    HUD.lobbyNote(`배틀패스 ${lv}단계 보상 — ` + [gold && `${GOLD_NAME} +${fmt(gold)}`, coin && `${COIN_NAME} +${coin}`, gcoin && `${GCOIN_NAME} +${gcoin}`, ...etc.slice(0, 4), etc.length > 4 && `외 ${etc.length - 4}개`].filter(Boolean).join(' · '));
    return true;
  }
  const shown = () => { const P = document.querySelector('[data-pane=pass]'); return !!P && !P.hidden && !$('lobby').hidden; };
  function setup() {
    Eco.on(() => { if (G.state !== 'lobby') return; notify(); if (shown()) render(); });
    setInterval(() => { if (G.state === 'lobby') notify(); }, 1500);   // 경기에서 오른 단계는 로비로 돌아온 뒤 알림
  }
  return { render, notify, setup };
})();
