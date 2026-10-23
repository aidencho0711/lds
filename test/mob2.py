from playwright.sync_api import sync_playwright
OUT='/home/claude/br/test/shots'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
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
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
       const p=L.G.player; p.hp=1e9; p.inv.weapons=[{id:'m416',mag:30,att:{scope:'reddot',muzzle:null,mag:null,grip:null}},null,null]; p.inv.cur=0; p.inv.items={a556:200}; p.equipT=0; p.setVisibleGear(); L.sim(5); }""")
    pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/10_mob_hud.png')
    # 조이스틱을 위로 끝까지 밀어 달리기 상태 → 사격 버튼 누름: 이동하면서 사격되는지
    r = pg.evaluate("""()=>{ const L=__LD; const layer=document.getElementById('touchLayer'); const ev=(t,el,x,y,id)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
       const p=L.G.player; const st=document.getElementById('stick'); const cx=+st.dataset.cx, cy=+st.dataset.cy;
       ev('pointerdown',layer,cx,cy,21); ev('pointermove',layer,cx,cy-160,21); L.sim(20);
       const sprintBefore=p.sprint, x0=p.pos.x, z0=p.pos.z, s0=L.G.stats.shots;
       const fb=document.getElementById('tb_fire'); const r=fb.getBoundingClientRect(); ev('pointerdown',fb,r.x+r.width/2,r.y+r.height/2,22);
       L.sim(30); const moved=Math.hypot(p.pos.x-x0,p.pos.z-z0), shots=L.G.stats.shots-s0, sprintDuring=p.sprint;
       ev('pointerup',fb,0,0,22); L.sim(10); const sprintAfter=p.sprint; ev('pointerup',layer,cx,cy-160,21); L.sim(2);
       return {sprintBefore, sprintDuring, sprintAfter, moved:+moved.toFixed(2), shots}; }""")
    print('move+fire', r)
    # 배치 편집기: 사격 버튼 이동 + 크기 변경 → 저장 → 실제 버튼 반영
    pg.evaluate("()=>{ __LD.G.ui('layout'); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/11_editor_open.png')
    box = pg.evaluate("()=>{ const r=document.getElementById('ed_fire').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width]; }")
    pg.touchscreen.tap(box[0], box[1])
    pg.evaluate("""([x,y])=>{ const el=document.getElementById('ed_fire'); const ev=(t,cx,cy)=>el.dispatchEvent(new PointerEvent(t,{pointerId:31,pointerType:'touch',clientX:cx,clientY:cy,bubbles:true,cancelable:true})); ev('pointerdown',x,y); ev('pointermove',x-140,y-40); ev('pointermove',x-200,y-60); ev('pointerup',x-200,y-60);
       const s=document.getElementById('edSize'); s.value=1.4; s.dispatchEvent(new Event('input')); }""", box[:2])
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/11_editor_moved.png')
    pg.evaluate("()=>document.getElementById('edSave').click()"); pg.wait_for_timeout(300)
    after = pg.evaluate("()=>{ const r=document.getElementById('tb_fire').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, JSON.stringify(JSON.parse(localStorage.getItem('lastdrop.settings')).touchLayout)]; }")
    print('fire before', box, 'after', after)
    pg.screenshot(path=f'{OUT}/12_mob_after_layout.png')
    # 새로고침 후에도 유지
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ document.getElementById('touch').hidden=false; document.getElementById('hud').hidden=false; __LD.Touch.apply(); }")
    print('after reload', pg.evaluate("()=>{ const r=document.getElementById('tb_fire').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width]; }"))
    # 설정 화면
    pg.evaluate("()=>{ document.getElementById('touch').hidden=true; document.getElementById('hud').hidden=true; __LD.G.ui('settings'); }"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/13_settings_mob.png')
    print('errors', errs)
    b.close()
