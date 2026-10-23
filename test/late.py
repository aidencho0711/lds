import sys, json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{}'); st.mode='rapid'; st.bots=%s; st.difficulty='%s'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }" % (sys.argv[1], sys.argv[2]))
    pg.reload(); pg.wait_for_timeout(1000)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<200&&Math.abs(pl.pos.z)<200){ L.Input.press('interact'); L.sim(1); break; } } }""")
    for k in range(80):
        r = pg.evaluate("""()=>{ const L=__LD; L.sim(30*10); const Z=L.Zone; const al=L.CHARS.filter(c=>c.alive&&!c.isPlayer);
          return {t:Math.round(L.G.time), alive:al.length, z:[Z.phase,Z.state,Z.cur.x|0,Z.cur.z|0,+Z.cur.r.toFixed(1), +(Z.dps||0).toFixed(1)], st:L.G.state,
            bots: al.length<=3 ? al.map(c=>({n:c.name,s:c.brain.state,hp:Math.round(c.hp),p:[c.pos.x|0,+c.pos.y.toFixed(1),c.pos.z|0],mode:c.mode, w:c.inv.weapons.map(w=>w&&w.id+':'+w.mag), tgt:c.brain.target&&c.brain.target.name})) : null}; }""")
        print(json.dumps(r, ensure_ascii=False))
        if r['alive']<=1 or r['st']!='play': break
    b.close()
