from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route)
    pg.on('pageerror', lambda e: print('ERR', e))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    print(pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1);
      const p=L.G.player; p.hp=1e9; p.inv.weapons[0]={id:'m416',mag:30,att:{scope:null,muzzle:null,mag:null,grip:null}}; p.inv.cur=0; p.inv.items={a556:90}; p.setVisibleGear(); L.sim(30);
      const ev=(t,el,x,y,id)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
      const fb=document.getElementById('tb_fire'); const s0=L.G.stats.shots;
      ev('pointerdown',fb,770,270,13); const st={fire:L.Input.fire, weapon:!!p.weapon, cd:p.fireCd, sprint:p.sprint, rl:p.rl, cycle:p.cycle, equipT:p.equipT, mode:p.mode, modal:L.HUD.modalOpen(), inWater:p.inWater, heal:p.heal, paused:L.G.paused, over:L.G.over, alive:p.alive};
      L.sim(15); const shots=L.G.stats.shots-s0; ev('pointerup',fb,770,270,13);
      const cb=document.getElementById('tb_crouch'); ev('pointerdown',cb,735,345,14); const edge=[...L.Input.edge]; ev('pointerup',cb,735,345,14); L.sim(1);
      return {st, shots, edge, stance:p.stance, mag:p.weapon.mag}; }"""))
    b.close()
