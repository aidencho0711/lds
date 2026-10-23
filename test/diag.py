import sys, time, json
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
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{}'); st.mode='rapid'; st.bots=24; st.difficulty='normal'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }")
    pg.reload(); pg.wait_for_timeout(1200)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<200&&Math.abs(pl.pos.z)<200){ L.Input.press('interact'); L.sim(1); break; } } }""")
    pg.evaluate("()=>__LD.sim(30*%d)" % int(sys.argv[1] if len(sys.argv)>1 else 50))
    R=(pg.evaluate("""()=>{ const out=[]; for(const c of __LD.CHARS){ if(c.isPlayer||!c.alive) continue; const b=c.brain; const it=b.lootTarget;
      out.push({n:c.name, st:b.state, stT:+b.stateT.toFixed(1), pos:[c.pos.x|0,+c.pos.y.toFixed(1),c.pos.z|0], w:c.inv.weapons.map(w=>w&&w.id+':'+w.mag), items:c.inv.items,
        loot: it? {id:it.id, alive:it.alive, d:+Math.hypot(it.x-c.pos.x,it.z-c.pos.z).toFixed(1), dy:+(it.y-c.pos.y).toFixed(2)}:null,
        path: b.path? {n:b.path.pts.length, i:b.pathI, comp:b.path.complete}: null, want:!!b.wantPath, arrived:!!b.arrived, goal: b.goal&&[b.goal.x|0,b.goal.z|0], kind:b.goalKind, stuck:b.stuckCount, vel:+Math.hypot(c.vel.x,c.vel.z).toFixed(2), ign:b.ignore.size, zd: Math.round(Math.hypot(c.pos.x-__LD.Zone.cur.x,c.pos.z-__LD.Zone.cur.z)), zr: Math.round(__LD.Zone.cur.r), tgt: b.target&&b.target.name, aw: b.aware.size, t: Math.round(__LD.G.time), mode: c.mode}); } return out; }""")); [print(json.dumps(x,ensure_ascii=False,separators=(",",":"))) for x in R]
    b.close()
