import sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1]
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
def run(p, name, vp, touch, time='day'):
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport=vp, has_touch=touch, is_mobile=touch, device_scale_factor=1)
    pg = ctx.new_page(); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1000)
    pg.evaluate("(t)=>{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{}'); st.time=t; st.bots=16; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }", time)
    pg.reload(); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/{name}_lobby.png')
    pg.evaluate("()=>__LD.G.startMatch()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ document.querySelector('[data-ui=closeMap]').click(); }")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } }""")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/{name}_fall.png')
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(40);
       const p=L.G.player; p.hp=1e9; p.inv.weapons[0]={id:'ar7',mag:30,att:{scope:'reddot',muzzle:'comp',mag:null,grip:null}}; p.inv.weapons[2]={id:'p19',mag:15,att:{scope:null,muzzle:null,mag:null,grip:null}}; p.inv.cur=0; p.inv.items={a556:90,a9:30,bandage:5,firstaid:1,frag:2,drink:1,x4:1}; p.inv.gear={helmet:{id:'helm2',dur:150},vest:{id:'vest2',dur:180},bag:{id:'bag2'}}; p.setVisibleGear(); L.sim(20); }""")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/{name}_ground.png')
    pg.evaluate("()=>{ __LD.Input.fire=true; __LD.sim(8); __LD.Input.fire=false; }"); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{OUT}/{name}_fire.png')
    pg.evaluate("()=>{ __LD.Input.press('inventory'); __LD.sim(1); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/{name}_inv.png')
    pg.evaluate("()=>{ __LD.Input.press('inventory'); __LD.sim(1); __LD.G.firstPerson=true; __LD.Input.aim=true; __LD.sim(15); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/{name}_fpp_aim.png')
    pg.evaluate("()=>{ __LD.Input.aim=false; __LD.G.firstPerson=false; __LD.G.ui('settings'); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/{name}_settings.png')
    pg.evaluate("()=>{ __LD.G.ui('closeSettings'); __LD.G.paused=false; const p=__LD.G.player; p.hp=5; p.alive=true; }")
    pg.evaluate("()=>{ const L=__LD; const p=L.G.player; p.place=7; p.kills=3; p.deathTime=L.G.time; L.G.onDeath(p); p.alive=false; L.sim(90); }"); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/{name}_result.png')
    print(name, 'errors:', errs[:5])
    b.close()
with sync_playwright() as p:
    run(p, 'pc', {'width':1366,'height':768}, False)
    run(p, 'mob', {'width':844,'height':390}, True, 'dusk')
