from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:4, view:'tpp', map:'kalden'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; } const p=L.G.player; p.hp=1e9;
      const r=L.W.roads.slice().sort((a,b)=>b.len-a.len)[0]; const v=L.Veh.make('uaz', r.ax+r.dx*30, r.az+r.dz*30, Math.atan2(r.dx,r.dz)); window.__v=v;
      p.pos.set(v.pos.x+Math.cos(v.yaw)*2.2, v.pos.y, v.pos.z-Math.sin(v.yaw)*2.2); L.sim(5); }""")
    print('label near', pg.evaluate("()=>document.getElementById('tb_interact').textContent"), pg.evaluate("()=>document.getElementById('vehPrompt').textContent"))
    pg.screenshot(path=f'{OUT}/mob_near.png')
    # 탑승 버튼 탭
    bb = pg.evaluate("()=>{ const r=document.getElementById('tb_interact').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }")
    pg.evaluate("""([x,y])=>{ const el=document.getElementById('tb_interact'); el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true})); el.dispatchEvent(new PointerEvent('pointerup',{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true})); __LD.sim(3); }""", bb)
    st = pg.evaluate("()=>({inVeh: !!__LD.G.player.veh, label: document.getElementById('tb_interact').textContent, fireVisible: getComputedStyle(document.getElementById('tb_fire')).display, driving: document.body.classList.contains('driving')})")
    print('after tap', st)
    # 조이스틱 위로 밀기
    pg.evaluate("""()=>{ const z=document.getElementById('touchLayer'); const ev=(t,x,y)=>z.dispatchEvent(new PointerEvent(t,{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
      ev('pointerdown',150,280); ev('pointermove',165,215); for(let i=0;i<150;i++) __LD.sim(1); window.__spd=Math.hypot(__v.vx,__v.vz); ev('pointerup',165,215); }""")
    print('speed after stick 5s (km/h)', round(pg.evaluate("()=>window.__spd")*3.6,1))
    pg.evaluate("()=>{ const z=document.getElementById('touchLayer'); z.dispatchEvent(new PointerEvent('pointerdown',{pointerId:42,pointerType:'touch',clientX:150,clientY:280,bubbles:true})); z.dispatchEvent(new PointerEvent('pointermove',{pointerId:42,pointerType:'touch',clientX:165,clientY:220,bubbles:true})); for(let i=0;i<20;i++) __LD.sim(1); }")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/mob_drive.png')
    print('errs', errs[:5])
    b.close()
