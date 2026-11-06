# v17 총기 스킨 상점: 지갑(3 재화) → 상자 6종 → 확률표(총기·옷) → 총기 상자 1회 → 울트라레어 컷신(총 케이스·총이 떠오름)
#  → 10회 → 차량 1회 200 → 교환소(총기) → 교환 컷신 → 창고 총기 장착 → 로비 캐릭터 → 중복 환급·합치기 → 확률 시뮬 20만 회
#  사용: python3 test/v17_shop.py OUT_DIR [W H]
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
PHONE = W < 900
TAG = 'p' if PHONE else 'd'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
def shot(pg, name): pg.screenshot(path=f'{OUT}/s{TAG}_{name}.png')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, has_touch=PHONE, is_mobile=False)
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text[:300]}') if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(2600)
    r = {}
    pg.evaluate("()=>document.querySelector('[data-tab=shop]').click()"); pg.wait_for_timeout(1800)
    r['wallet'] = pg.evaluate("()=>[...document.querySelectorAll('#shopWallet .cur')].map(e=>e.className+':'+e.textContent)")
    r['cards'] = pg.evaluate("()=>[...document.querySelectorAll('.gc-card')].map(c=>c.dataset.box+' | '+c.querySelector('.gc-txt').textContent+' | '+[...c.querySelectorAll('.gc-buy')].map(x=>x.textContent).join(' / '))")
    shot(pg, 'a_shop')
    # 확률표
    r['odds'] = pg.evaluate("""()=>{ const o={}; for (const k of Object.keys(__LD.BOXES)) { const P=__LD.Eco.pool(k);
        o[k]={ n:P.length, sum:+P.reduce((a,x)=>a+x.p,0).toFixed(6), tiers:[0,1,2,3,4,5].map(t=>+P.filter(x=>x.rar===t).reduce((a,x)=>a+x.p,0).toFixed(3)), gun:P.filter(x=>x.k==='gskin').map(x=>x.id+':'+x.p.toFixed(3)).join(' '), coin:+P.filter(x=>x.k==='gcoin').reduce((a,x)=>a+x.p,0).toFixed(3), ev:+P.filter(x=>x.k==='gcoin'||x.k==='coin').reduce((a,x)=>a+x.n*x.p/100,0).toFixed(3) }; } return o; }""")
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=g1] .gc-odds').click()"); pg.wait_for_timeout(1500); shot(pg, 'b_odds_g1')
    pg.evaluate("()=>document.getElementById('oddsClose').click()")
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=br] .gc-odds').click()"); pg.wait_for_timeout(800); shot(pg, 'b_odds_br')
    pg.evaluate("()=>document.getElementById('oddsClose').click()")
    # 총기 상자 1회
    g0 = pg.evaluate("()=>__LD.Eco.gold")
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=g1] .gc-buy').click()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(600)
    r['pull1'] = pg.evaluate("(g0)=>({ spent: g0-__LD.Eco.gold+(__LD.Eco.gold-g0+200), gold: __LD.Eco.gold, gcoin: __LD.Eco.gcoin, card: document.querySelector('.gr-card')?.textContent })", g0)
    shot(pg, 'c_res1'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 울트라레어 컷신 (아스널 상자 → 마지막 = 울트라레어 총기 스킨)
    # 컷신은 실제 시간으로 진행 → 스크린숏이 느린 환경에서는 시계를 고정해 두고 원하는 시각마다 찍는다
    pg.evaluate("()=>{ window.__PN = performance.now.bind(performance); window.__T0 = window.__PN(); window.__T = window.__T0; performance.now = () => window.__T; }")
    pg.evaluate("()=>{ __LD.Eco.E().gold = 30000; __LD.Shop.render(); window.__R = Math.random; Math.random = () => 0.99995; document.querySelector('.gc-card[data-box=g1] .gc-buy').click(); Math.random = window.__R; }")
    for i, t in enumerate([0.5, 1.5, 2.6, 3.45, 3.75, 4.1, 4.6]):
        # 시각 t까지 프레임마다 0.04초씩 진행 (입자·빛 띠가 프레임 수만큼 움직이게)
        pg.evaluate("(t)=>new Promise(res=>{ const step=()=>{ if (window.__T - window.__T0 >= t*1000) return res(); window.__T += 40; requestAnimationFrame(step); }; step(); })", t)
        pg.wait_for_timeout(250); shot(pg, f'd_cs{i}')
    pg.evaluate("()=>{ window.__T += 2000; performance.now = window.__PN; }")
    pg.wait_for_function("()=>!__LD.Cutscene.active && !document.getElementById('gachaRes').hidden", timeout=60000); pg.wait_for_timeout(700)
    r['ultra'] = pg.evaluate("()=>({ title: document.getElementById('gresTitle').textContent, card: document.querySelector('.gr-card')?.textContent, wh: document.getElementById('gresWh').textContent, whShown: !document.getElementById('gresWh').hidden, own: __LD.stats.gskins.slice() })")
    shot(pg, 'e_res_ultra'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 네온 상자 10회 (두 번 눌러 확인)
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=g2]').querySelectorAll('.gc-buy')[1].click()"); pg.wait_for_timeout(200)
    r['armed'] = pg.evaluate("()=>!!document.querySelector('.gc-buy.armed')")
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=g2]').querySelectorAll('.gc-buy')[1].click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(1500)
    r['pull10'] = pg.evaluate("()=>({ cards: document.querySelectorAll('.gr-card').length, names: [...document.querySelectorAll('.gr-card .gr-name')].map(e=>e.textContent), note: document.getElementById('gresNote').textContent })")
    shot(pg, 'f_res10'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 차량 1회 = 200
    g1 = pg.evaluate("()=>__LD.Eco.gold")
    pg.evaluate("()=>document.querySelector('.gc-card[data-box=veh] .gc-buy').click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(500)
    r['veh'] = pg.evaluate("(g1)=>({ spent: g1 - __LD.Eco.gold, armed: !!document.querySelector('.gc-buy.armed'), res: !document.getElementById('gachaRes').hidden })", g1)
    pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 교환소: 총기
    pg.evaluate("()=>{ __LD.Eco.E().gcoin = 200; document.querySelector('#shopTabs [data-st=exch]').click(); }"); pg.wait_for_timeout(2500)
    r['exch'] = pg.evaluate("()=>({ sub: [...document.querySelectorAll('.ex-subtabs button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')), secs: [...document.querySelectorAll('.ex-sec h4')].map(e=>e.textContent), cards: document.querySelectorAll('.ex-card').length })")
    shot(pg, 'g_exch_gun')
    # 아직 없는 울트라레어 하나 고르기 (앞 단계 뽑기에서 나왔을 수 있음)
    pick = pg.evaluate("()=>{ const c=[...document.querySelectorAll('.ex-card')].find(x=>x.textContent.includes('울트라레어') && !x.querySelector('.ex-buy').disabled); c.click(); return c.querySelector('b').textContent; }"); pg.wait_for_timeout(1800)
    r['pick'] = pick
    shot(pg, 'h_exch_sel')
    pg.evaluate("()=>{ document.querySelector('.ex-card.on .ex-buy').click(); }"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{ document.querySelector('.ex-card.on .ex-buy').click(); }"); pg.wait_for_timeout(3600)
    shot(pg, 'i_cs_exch')
    pg.wait_for_function("()=>!__LD.Cutscene.active && !document.getElementById('gachaRes').hidden", timeout=60000); pg.wait_for_timeout(700)
    r['exchDone'] = pg.evaluate("()=>({ gcoin: __LD.Eco.gcoin, own: __LD.stats.gskins.length, wh: document.getElementById('gresWh').textContent, card: document.querySelector('.gr-card')?.textContent })")
    shot(pg, 'j_res_exch')
    # 창고에서 장착 → 창고 총기
    pg.evaluate("()=>document.getElementById('gresWh').click()"); pg.wait_for_timeout(1500)
    r['wh'] = pg.evaluate("()=>({ cat: [...document.querySelectorAll('#whCats button')].find(b=>b.classList.contains('on'))?.textContent, heads: [...document.querySelectorAll('.wh-ghead')].map(e=>e.textContent), items: document.querySelectorAll('.wh-item.gun').length, count: document.getElementById('whCount').textContent })")
    shot(pg, 'k_wh_gun')
    pg.evaluate("(nm)=>{ const b=[...document.querySelectorAll('.wh-item.gun')].find(x=>x.textContent.includes(nm) && !x.classList.contains('on')) || [...document.querySelectorAll('.wh-item.gun')].find(x=>!x.classList.contains('on')); if (b) b.click(); }", pick); pg.wait_for_timeout(1800)
    r['glook'] = pg.evaluate("()=>({ glook: __LD.Eco.glook(), show: __LD.Eco.showGun() })")
    shot(pg, 'l_wh_equip')
    pg.evaluate("()=>document.querySelector('[data-tab=play]').click()"); pg.wait_for_timeout(1500)
    r['lobbyGun'] = pg.evaluate("()=>{ const g=__LD.Lobby.rig.gunObj; return { id: g.userData.id, skin: g.userData.skin ? g.userData.skin.id : null }; }")
    shot(pg, 'm_lobby')
    # 중복 환급 · 합치기
    r['dup'] = pg.evaluate("""()=>{ const E=__LD.Eco, e=E.E(); e.gcoin=500; const c0=e.gcoin, g0=e.gold;
        const a=E.exchangeGun('g1_m24_carbon'); const own=E.ownsGun('g1_m24_carbon');
        // 이미 가진 총기 상자 스킨이 다시 나오면: 교환가 절반을 코인으로
        const P=E.pool('g1'), x=P.find(q=>q.id==='g1_m24_carbon'); const R=Math.random; let pick=0; for (const q of P) { if (q===x) break; pick+=q.p; } Math.random=()=> (pick + x.p/2)/100; const d=E.pull('g1',1); Math.random=R;
        // 옷 상자 속 총기 스킨 중복은 골드로
        if (!__LD.stats.gskins.includes('br_mini14_wood')) __LD.stats.gskins.push('br_mini14_wood');
        const P2=E.pool('br'), y=P2.find(q=>q.id==='br_mini14_wood'); let pk2=0; for (const q of P2) { if (q===y) break; pk2+=q.p; } Math.random=()=> (pk2 + y.p/2)/100; const d2=E.pull('br',1); Math.random=R;
        const m=E.mergeStats({ gskins:['a'], eco:{ gold:100, coin:5, gcoin:10, v:1 } }, { gskins:['a','b'], eco:{ gold:150, coin:5, gcoin:4, v:1 } }, { gskins:['a','c'], eco:{ gold:300, coin:9, gcoin:30, v:1 } });
        return { exch: a.res[0], own, spent: c0 - E.gcoin, dupG1: d.res[0], dupBr: d2.res[0], merge: { gskins: m.gskins, gcoin: m.eco.gcoin, gold: m.eco.gold } }; }""")
    # 확률 시뮬 20만 회
    r['sim'] = pg.evaluate("""()=>{ const out={}; for (const k of Object.keys(__LD.BOXES)) { const P=__LD.Eco.pool(k), cnt=new Map(); const N=200000; for (let i=0;i<N;i++){ const x=__LD.Eco.draw(k); cnt.set(x,(cnt.get(x)||0)+1); }
        let worst=0, worstZ=0; const tiers=[0,0,0,0,0,0]; let coin=0; for (const x of P){ const f=(cnt.get(x)||0)/N*100, sd=Math.sqrt(x.p/100*(1-x.p/100)/N)*100; worst=Math.max(worst, Math.abs(f-x.p)); worstZ=Math.max(worstZ, Math.abs(f-x.p)/sd); tiers[x.rar]+=f; if (x.k==='gcoin') coin+=f; }
        out[k]={ worstAbsPct:+worst.toFixed(3), worstZ:+worstZ.toFixed(2), tiers: tiers.map(v=>+v.toFixed(2)), gcoinPct: +coin.toFixed(2) }; } return out; }""")
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('\n'.join(logs[:30]) or 'no errors')
    b.close()
