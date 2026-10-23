import sys, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; MODE = sys.argv[2] if len(sys.argv)>2 else 'classic'; BOTS = int(sys.argv[3]) if len(sys.argv)>3 else 24; DIFF = sys.argv[4] if len(sys.argv)>4 else 'normal'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs=[]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate(f"()=>{{ const s=JSON.parse(localStorage.getItem('lastdrop.settings')||'{{}}'); }}")
    pg.evaluate(f"()=>{{ __LD.G.ui; }}")
    # 설정 주입
    pg.evaluate(f"()=>{{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{{}}'); st.mode='{MODE}'; st.bots={BOTS}; st.map='norden'; st.quality='low'; st.queue='normal'; st.difficulty='{DIFF}'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }}")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    # 플레이어는 관찰자: 무적 + 일찍 강하
    pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<1500&&Math.abs(pl.pos.z)<1500){ L.Input.press('interact'); L.sim(1); break; } } }""")
    t0=time.time(); last=0
    for step in range(200):
        r = pg.evaluate("""()=>{ const L=__LD; const t0=performance.now(); L.sim(30*30, 1/30); const ms=performance.now()-t0;
          const C=L.CHARS; const bots=C.filter(c=>!c.isPlayer);
          const alive=bots.filter(c=>c.alive);
          const armed=alive.filter(c=>c.inv.weapons.some(Boolean)).length;
          const kills=bots.reduce((a,c)=>a+c.kills,0);
          return {t:Math.round(L.G.time), ms:Math.round(ms), alive:alive.length, armed, kills, states:L.states(), zone:[L.Zone.phase, L.Zone.state, Math.round(L.Zone.cur.r)], over:L.G.over, st:L.G.state,
            shots:L.G.stats.shots, hits:L.G.stats.hits, avgHp: Math.round(alive.reduce((a,c)=>a+c.hp,0)/Math.max(1,alive.length)), vest: alive.filter(c=>c.inv.gear.vest).length, mem: performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):-1, tiles: L.Nav.tilesBuilt, crates: L.Airdrop.list.length};}""")
        print(r)
        if r['alive']<=1 or r['st']!='play': break
    pg.screenshot(path=f'{OUT}/06_late.png')
    # 사망 원인 통계
    print(pg.evaluate("()=>{const m={}; for(const k of __LD.G.killLog){const key=k.by+':'+k.cause; m[key]=(m[key]||0)+1;} return m;}"))
    print(pg.evaluate("""()=>{ const C=__LD.CHARS; const by={}; for(const c of C) if(!c.alive&&!c.isPlayer){ const k=c.lastAttacker? (c.lastAttacker.isPlayer?'player':'bot'):'zone/fall'; by[k]=(by[k]||0)+1;} return by; }"""))
    print('\n'.join(logs[:30]))
    b.close()
