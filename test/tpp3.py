from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
OUT='/home/claude/br/test/shots/'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:4, view:'tpp'})); }"); pg.reload(); pg.wait_for_timeout(2500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; for (const c of L.CHARS) if(!c.isPlayer){ c.hp=1e9; c.root.visible=false; c.pos.set(300,0,300); }
      for(let t=0;t<6000;t++){ const x=(Math.random()-0.5)*400, z=(Math.random()-0.5)*400, h=window.__gh(x,z); if(h<1.5) continue; let ok=true; for(let k=0;k<24 && ok;k++){ const rr=4+(k%3)*8, xx=x+Math.cos(k)*rr, zz=z+Math.sin(k)*rr; if(!L.Nav.isFree(xx,zz) || Math.abs(window.__gh(xx,zz)-h)>0.8) ok=false; } if(ok){ p.pos.set(x, h, z); break; } } p.yaw=0; p.pitch=0; L.sim(5); }""")
    for g in ['m249','mg3','awm','aug','s686','asm']:
        pg.evaluate("""(g)=>{ const L=__LD,p=L.G.player; const wi=L.fns.newWeapon(g, L.ITEMS[g].mag); if (L.fns.attFits('x4', g)) wi.att.scope='x4'; p.inv.weapons=[wi,null,null]; p.inv.cur=0; p.equipT=0; p.setVisibleGear(); for(let i=0;i<30;i++){ p.lastShotT=L.G.time; L.sim(1);} }""", g)
        pg.wait_for_timeout(300); pg.screenshot(path=OUT+f't3_{g}.png')
        pg.evaluate("""()=>{ const L=__LD,p=L.G.player; p.inv.items={a556:200,a762:200,a300:20,a12:20}; p.weapon.mag=0; L.fns.startReload(p); const T=p.rl.total; L.sim(Math.floor(T*30*0.42)); L.G.paused=true; }""")
        pg.wait_for_timeout(300); pg.screenshot(path=OUT+f't3_{g}_rl.png'); pg.evaluate("()=>{ __LD.G.paused=false; __LD.sim(300); }")
    print('errors', errs)
    b.close()
