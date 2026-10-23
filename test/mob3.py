from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True, device_scale_factor=2); pg = ctx.new_page(); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8, view:'fpp'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; p.inWater=false; const w=L.fns.newWeapon('asm',30); w.att.scope='reddot'; p.inv.weapons=[w, L.fns.newWeapon('m249',100), L.fns.newWeapon('p19',15)]; p.inv.cur=0; p.inv.items={a556:120,a9:30}; p.setVisibleGear(); L.sim(20); }""")
    ev = "(a)=>{ const [t,id,x,y,pid]=a; document.getElementById(id).dispatchEvent(new PointerEvent(t,{pointerId:pid,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})); }"
    r = pg.evaluate("()=>{ const e=document.getElementById('tb_mode'); const r=e.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2, r.width]; }")
    print('mode btn', r)
    m0 = pg.evaluate("()=>__LD.fns.fireMode(__LD.G.player.weapon)")
    pg.evaluate(ev, ['pointerdown','tb_mode',r[0],r[1],31]); pg.evaluate(ev, ['pointerup','tb_mode',r[0],r[1],31]); pg.evaluate("()=>__LD.sim(2)")
    print('mode', m0, '->', pg.evaluate("()=>__LD.fns.fireMode(__LD.G.player.weapon)"))
    pg.wait_for_timeout(500); pg.screenshot(path='/home/claude/br/test/shots/m3_hud.png')
    print('errors', errs)
    b.close()
