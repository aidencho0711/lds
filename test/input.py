from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
def land(pg):
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1);
      const p=L.G.player; p.hp=1e9; p.inv.weapons[0]={id:'m416',mag:30,att:{scope:null,muzzle:null,mag:null,grip:null}}; p.inv.cur=0; p.inv.items={a556:90}; p.setVisibleGear(); L.sim(30); }""")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    # PC
    pg = b.new_page(viewport={'width':640,'height':360}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8})); }"); pg.reload(); pg.wait_for_timeout(1200)
    land(pg)
    print('fps', pg.evaluate("()=>new Promise(r=>{let n=0;const t=performance.now();const f=()=>{n++; if(performance.now()-t<1000) requestAnimationFrame(f); else r(n);}; requestAnimationFrame(f);})"))
    t0 = pg.evaluate("()=>__LD.G.time"); pg.wait_for_timeout(500); print('time adv', pg.evaluate("()=>__LD.G.time")-t0, pg.evaluate("()=>[__LD.G.state, __LD.G.paused, document.getElementById('hud').hidden]"))
    p0 = pg.evaluate("()=>[__LD.G.player.pos.x,__LD.G.player.pos.z]")
    pg.mouse.click(320,180); pg.wait_for_timeout(300)
    pg.keyboard.down('KeyW'); pg.evaluate('()=>__LD.sim(45)'); pg.keyboard.up('KeyW')
    p1 = pg.evaluate("()=>[__LD.G.player.pos.x,__LD.G.player.pos.z, __LD.Input.locked, __LD.Input.lockFailed, __LD.G.player.inWater]")
    print('PC move', p0, p1)
    s0 = pg.evaluate("()=>__LD.G.stats.shots")
    pg.mouse.move(320,180); pg.mouse.down(); pg.evaluate('()=>__LD.sim(20)'); pg.mouse.up(); pg.evaluate('()=>__LD.sim(2)')
    print('PC shots', pg.evaluate("()=>__LD.G.stats.shots")-s0, 'mag', pg.evaluate("()=>__LD.G.player.inv.weapons[0].mag"))
    pg.keyboard.press('KeyR'); pg.evaluate('()=>__LD.sim(80)'); print('after reload mag', pg.evaluate("()=>__LD.G.player.inv.weapons[0].mag"))
    pg.keyboard.press('Tab'); pg.evaluate('()=>__LD.sim(1)'); print('inv open', pg.evaluate("()=>!document.getElementById('invPanel').hidden"))
    pg.keyboard.press('Tab'); pg.evaluate('()=>__LD.sim(1)'); print('inv closed', pg.evaluate("()=>document.getElementById('invPanel').hidden"))
    pg.keyboard.press('KeyM'); pg.evaluate('()=>__LD.sim(1)'); print('map open', pg.evaluate("()=>!document.getElementById('mapPanel').hidden"))
    pg.mouse.click(250,150); pg.wait_for_timeout(100); print('marker', pg.evaluate("()=>__LD.G.marker"))
    pg.keyboard.press('KeyM'); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.evaluate('()=>__LD.sim(1)'); print('paused', pg.evaluate("()=>__LD.G.paused"))
    pg.keyboard.press('Escape'); pg.evaluate('()=>__LD.sim(1)'); print('resumed', not pg.evaluate("()=>__LD.G.paused"))
    pg.keyboard.press('KeyC'); pg.evaluate('()=>__LD.sim(1)'); print('stance', pg.evaluate("()=>__LD.G.player.stance"))
    pg.keyboard.press('KeyZ'); pg.evaluate('()=>__LD.sim(1)'); print('stance', pg.evaluate("()=>__LD.G.player.stance"))
    pg.keyboard.press('Space'); pg.evaluate('()=>__LD.sim(1)'); print('stance', pg.evaluate("()=>__LD.G.player.stance"))
    print('PC errors', errs)
    pg.close()
    # Mobile
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8})); }"); pg.reload(); pg.wait_for_timeout(1200)
    print('touch mode', pg.evaluate("()=>document.body.classList.contains('touch')"))
    land(pg)
    r = pg.evaluate("""async ()=>{ const L=__LD; const layer=document.getElementById('touchLayer'); const ev=(t,el,x,y,id)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
       const p=L.G.player; const x0=p.pos.x, z0=p.pos.z;
       ev('pointerdown',layer,150,280,11); ev('pointermove',layer,150,220,11);
       const mv={...L.Input.move}; L.sim(36); const moved=Math.hypot(p.pos.x-x0,p.pos.z-z0);
       ev('pointerup',layer,150,220,11); const after={...L.Input.move};
       const y0=p.yaw; ev('pointerdown',layer,600,150,12); ev('pointermove',layer,660,150,12); ev('pointerup',layer,660,150,12); L.sim(1);
       const fb=document.getElementById('tb_fire'); const s0=L.G.stats.shots; ev('pointerdown',fb,770,270,13); const fireOn=L.Input.fire; L.sim(15); ev('pointerup',fb,770,270,13);
       const cb=document.getElementById('tb_crouch'); ev('pointerdown',cb,735,345,14); ev('pointerup',cb,735,345,14); L.sim(1);
       return {mv, moved:+moved.toFixed(2), after, yawChanged: Math.abs(p.yaw-y0)>0.01, fireOn, fireOff:!L.Input.fire, shots:L.G.stats.shots-s0, stance:p.stance}; }""")
    print('MOBILE', r)
    print('mobile errors', errs)
    b.close()
