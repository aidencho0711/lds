# v15 상점·미션 확인: 첫 선물 → 상점(뽑기·확률표) → 1회·10회 → 울트라레어 컷신 → 교환소 → 창고(차량) → 미션(출석·받기)
#  → 확률 시뮬(상자마다 20만 회) → 훈련장에서 차량 스킨 적용 → 오류 수집
#  사용: python3 test/v15_shop.py OUT_DIR [W H]
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
PHONE = W < 900
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
def shot(pg, name): pg.screenshot(path=f'{OUT}/{name}.png')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, has_touch=PHONE, is_mobile=False)
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(2600)
    r = {}
    r['welcome'] = pg.evaluate("()=>({ gold: __LD.Eco.gold, coin: __LD.Eco.coin, note: document.getElementById('lbNote').textContent, dot: !document.getElementById('misDot').hidden })")
    shot(pg, 'a_lobby')
    # 상점
    pg.evaluate("()=>document.querySelector('[data-tab=shop]').click()"); pg.wait_for_timeout(1500)
    shot(pg, 'b_shop')
    # 확률표 합계
    r['odds'] = pg.evaluate("()=>{ const o={}; for (const k of Object.keys(__LD.BOXES)) { const P=__LD.Eco.pool(k); o[k]={ n:P.length, sum:+P.reduce((a,x)=>a+x.p,0).toFixed(6), tiers:[0,1,2,3,4,5].map(t=>+P.filter(x=>x.rar===t).reduce((a,x)=>a+x.p,0).toFixed(3)) }; } return o; }")
    pg.evaluate("()=>document.querySelector('.gc-card .gc-odds').click()"); pg.wait_for_timeout(400); shot(pg, 'c_odds')
    pg.evaluate("()=>document.getElementById('oddsClose').click()")
    # 1회 뽑기 (일반 확률)
    pg.evaluate("()=>document.querySelector('.gc-card .gc-buy').click()"); pg.wait_for_timeout(500)
    r['pull1'] = pg.evaluate("()=>({ gold: __LD.Eco.gold, cs: __LD.Cutscene.active, res: !document.getElementById('gachaRes').hidden })")
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(500)
    shot(pg, 'd_res1'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 울트라레어 컷신: 무작위를 0.9999로 고정 → 표의 마지막(빨강)
    pg.evaluate("()=>{ __LD.Eco.E().gold = 20000; __LD.Shop.render(); window.__R = Math.random; Math.random = () => 0.99995; document.querySelectorAll('.gc-card')[1].querySelector('.gc-buy').click(); Math.random = window.__R; }")
    for i, t in enumerate([0.6, 1.6, 2.6, 3.6, 4.2]):
        pg.wait_for_timeout(int((t - (0 if i == 0 else [0.6, 1.6, 2.6, 3.6, 4.2][i - 1])) * 1000))
        shot(pg, f'e_cs{i}')
    pg.wait_for_function("()=>!__LD.Cutscene.active && !document.getElementById('gachaRes').hidden", timeout=60000); pg.wait_for_timeout(700)
    r['ultra'] = pg.evaluate("()=>({ cs: __LD.Cutscene.active, res: !document.getElementById('gachaRes').hidden, title: document.getElementById('gresTitle').textContent, card: document.querySelector('.gr-card')?.className, own: __LD.stats.skins.slice() })")
    shot(pg, 'f_res_ultra'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 10회 뽑기 (보급 상자) — 1,000 이상은 두 번 눌러 확인
    pg.evaluate("()=>{ const b=document.querySelectorAll('.gc-card')[2].querySelectorAll('.gc-buy')[1]; b.click(); }"); pg.wait_for_timeout(200)
    r['armed'] = pg.evaluate("()=>!!document.querySelector('.gc-buy.armed')")
    pg.evaluate("()=>{ document.querySelectorAll('.gc-card')[2].querySelectorAll('.gc-buy')[1].click(); }"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(900)
    r['pull10'] = pg.evaluate("()=>({ cards: document.querySelectorAll('.gr-card').length, gold: __LD.Eco.gold })")
    shot(pg, 'g_res10'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 차량 뽑기 1회 + 교환소
    pg.evaluate("()=>{ const b=document.querySelectorAll('.gc-card')[3].querySelector('.gc-buy'); b.click(); b.click(); }"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ const bb=document.querySelectorAll('.gc-card')[3].querySelector('.gc-buy'); if (bb) bb.click(); }"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ if (__LD.Cutscene.active) __LD.Cutscene.skip(); }"); pg.wait_for_timeout(700)
    r['veh1'] = pg.evaluate("()=>({ coin: __LD.Eco.coin, card: document.querySelector('.gr-card .gr-name')?.textContent })")
    shot(pg, 'h_res_veh'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    pg.evaluate("()=>{ __LD.Eco.E().coin = 120; document.querySelector('#shopTabs [data-st=exch]').click(); }"); pg.wait_for_timeout(1500)
    shot(pg, 'i_exch')
    pg.evaluate("()=>{ const c=[...document.querySelectorAll('.ex-card')].find(x=>x.textContent.includes('펄스 X9 · 네온')); c.click(); }"); pg.wait_for_timeout(1200)
    shot(pg, 'i_exch_sel')
    pg.evaluate("()=>{ const c=[...document.querySelectorAll('.ex-card')].find(x=>x.textContent.includes('펄스 X9 · 네온')); c.querySelector('.ex-buy').click(); c.querySelector('.ex-buy') && document.querySelector('.ex-card.on .ex-buy').click(); }"); pg.wait_for_timeout(2500)
    shot(pg, 'j_cs_hyper')
    pg.wait_for_function("()=>!__LD.Cutscene.active && !document.getElementById('gachaRes').hidden", timeout=60000); pg.wait_for_timeout(700)
    r['exch'] = pg.evaluate("()=>({ coin: __LD.Eco.coin, own: __LD.stats.vskins.slice(), res: !document.getElementById('gachaRes').hidden })")
    shot(pg, 'k_res_hyper'); pg.evaluate("()=>document.getElementById('gresOk').click()")
    # 창고: 차량 장착
    pg.evaluate("()=>document.querySelector('[data-tab=custom]').click()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('#whCats button')].find(x=>x.textContent==='차량'); b.click(); }"); pg.wait_for_timeout(500)
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('.wh-item.veh')].find(x=>x.textContent.includes('펄스')); if (b) b.click(); }"); pg.wait_for_timeout(1500)
    r['vlook'] = pg.evaluate("()=>__LD.Eco.vlook()")
    shot(pg, 'l_wh_veh')
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('#whCats button')].find(x=>x.textContent==='전체'); b.click(); }"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{ const b=[...document.querySelectorAll('.wh-item')].find(x=>x.textContent.includes('상의') && !x.classList.contains('on') && x.classList.contains('rar')); if (b) b.click(); }"); pg.wait_for_timeout(1500)
    shot(pg, 'm_wh_cloth')
    # 미션: 출석 받기
    pg.evaluate("()=>document.querySelector('[data-tab=mission]').click()"); pg.wait_for_timeout(800)
    shot(pg, 'n_mission')
    g0 = pg.evaluate("()=>__LD.Eco.gold")
    pg.evaluate("()=>document.querySelector('.att-cell.now').click()"); pg.wait_for_timeout(400)
    r['attend'] = pg.evaluate("(g0)=>({ got: __LD.Eco.gold - g0, again: __LD.Eco.attendInfo().can, n: __LD.Eco.attendInfo().n })", g0)
    # 미션 진행 → 받기
    r['quests'] = pg.evaluate("""()=>{ const E=__LD.Eco; E.matchEnd({quit:false,win:true,place:1,kills:12,heads:5,dmg:1500,drive:2500,loot:40,heals:6,goldN:1,drops:1,surv:700});
      const L=E.questList(); const g0=E.gold; for (const q of L.daily.concat(L.weekly)) if (q.done && !q.claimed) E.claim(q.id); const g1=E.gold; const bo=E.claimBonus();
      return { daily: L.daily.map(q=>[q.id,q.cur,q.goal,q.done]), weekly: L.weekly.map(q=>[q.id,q.cur,q.done]), claimed: g1-g0, bonus: bo }; }""")
    pg.evaluate("()=>__LD.Shop.renderMissions()"); pg.wait_for_timeout(300)
    shot(pg, 'o_mission_done')
    # 확률 시뮬
    r['sim'] = pg.evaluate("""()=>{ const out={}; for (const k of Object.keys(__LD.BOXES)) { const P=__LD.Eco.pool(k), cnt=new Map(); const N=200000; for (let i=0;i<N;i++){ const x=__LD.Eco.draw(k); cnt.set(x,(cnt.get(x)||0)+1); }
        let worst=0, worstZ=0; const tiers=[0,0,0,0,0,0]; for (const x of P){ const f=(cnt.get(x)||0)/N*100, sd=Math.sqrt(x.p/100*(1-x.p/100)/N)*100; worst=Math.max(worst, Math.abs(f-x.p)); worstZ=Math.max(worstZ, Math.abs(f-x.p)/sd); tiers[x.rar]+=f; }
        out[k]={ worstAbsPct:+worst.toFixed(3), worstZ:+worstZ.toFixed(2), tiers: tiers.map(v=>+v.toFixed(2)) }; } return out; }""")
    # 훈련장: 승용차 운전석에 타면 하이퍼카
    pg.evaluate("()=>document.querySelector('[data-tab=play]').click()")
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    r['train'] = pg.evaluate("""()=>{ const L=__LD,p=L.G.player; const v=L.Veh.list.find(v=>v.type==='sedan'); if(!v) return 'no sedan'; L.Veh.enter(p,v,0); L.sim(20);
        const cam=L.G.camera; L.G.paused=true; const a=v.yaw+0.9; cam.position.set(v.pos.x+Math.sin(a)*7, v.pos.y+2.6, v.pos.z+Math.cos(a)*7); cam.lookAt(v.pos.x, v.pos.y+0.8, v.pos.z); cam.updateMatrixWorld();
        return { skin: v.skin, meshes: v.P.meshes.length, p: p.vlook }; }""")
    pg.wait_for_timeout(500); shot(pg, 'p_train_hyper')
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('\n'.join(logs[:30]))
    b.close()
