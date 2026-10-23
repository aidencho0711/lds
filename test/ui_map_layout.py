# 미니맵 → 전체 지도, 확대/이동/마커, 모바일 배치 편집(가방·메뉴·킬 로그·팀 목록)
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots/sq/'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
def start(pg, mapid='kalden'):
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(800)
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{quality:'low', shadows:'off', bots:15, map:'{mapid}', squad:'squad'}})); }}"); pg.reload(); pg.wait_for_timeout(1200)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=200000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<3000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<4000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(60); L.G.player.hp=1e9; }""")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    # ---- PC ----
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    print('hud buttons', pg.evaluate("()=>[...document.querySelectorAll('#hudButtons .hbtn')].map(b=>b.textContent)"))
    box = pg.evaluate("()=>{const r=document.getElementById('mini').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}")
    pg.mouse.click(box[0], box[1]); pg.wait_for_timeout(300)
    print('PC minimap click → map open', pg.evaluate("()=>!document.getElementById('mapPanel').hidden"))
    mb = pg.evaluate("()=>{const r=document.getElementById('bigmap').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]}")
    cx, cy = mb[0]+mb[2]*0.6, mb[1]+mb[3]*0.4
    pg.mouse.move(cx, cy)
    for i in range(4): pg.mouse.wheel(0, -120); pg.wait_for_timeout(60)
    print('after wheel', pg.evaluate("()=>document.getElementById('mapZoomVal').textContent"))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'map_zoom.png')
    # 드래그 이동
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx-120, cy+60, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    print('marker after drag (should be unchanged)', pg.evaluate("()=>__LD.G.marker"))
    pg.mouse.click(mb[0]+mb[2]*0.5, mb[1]+mb[3]*0.5); pg.wait_for_timeout(200)
    print('marker after tap', pg.evaluate("()=>__LD.G.marker && [Math.round(__LD.G.marker.x), Math.round(__LD.G.marker.z)]"))
    pg.click('[data-mz=me]'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'map_me.png')
    pg.click('[data-mz=out]'); pg.click('[data-mz=out]'); pg.click('[data-mz=out]'); pg.click('[data-mz=out]')
    print('zoom after out x4', pg.evaluate("()=>document.getElementById('mapZoomVal').textContent"))
    print('errs', errs[:3]); pg.close()
    # ---- 모바일 ----
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    start(pg)
    pg.evaluate("()=>{ const G=__LD.G; const e=G.teams[1].members[0]; __LD.fns.applyDamage(G.teams[2].members[0], 999, 'body', e, 'm416'); __LD.sim(2); }")
    pg.wait_for_timeout(300); pg.screenshot(path=OUT+'m_hud_default.png')
    print('positions', pg.evaluate("()=>['hbBag','hbMenu','killfeed','teamPanel'].map(id=>{const r=document.getElementById(id).getBoundingClientRect(); return id+':'+[r.left,r.top,r.width,r.height].map(Math.round).join(',')})"))
    # 미니맵 탭 → 지도
    mm = pg.evaluate("()=>{const r=document.getElementById('mini').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}")
    pg.touchscreen.tap(mm[0], mm[1]); pg.wait_for_timeout(300)
    print('mobile minimap tap → map open', pg.evaluate("()=>!document.getElementById('mapPanel').hidden"))
    # 두 손가락 확대 (PointerEvent 직접)
    pg.evaluate("""()=>{ const cv=document.getElementById('bigmap'), r=cv.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
      const ev=(t,id,x,y)=>cv.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
      ev('pointerdown',51,cx-20,cy); ev('pointerdown',52,cx+20,cy); for(let i=1;i<=8;i++){ ev('pointermove',51,cx-20-i*10,cy); ev('pointermove',52,cx+20+i*10,cy); } ev('pointerup',51,cx-100,cy); ev('pointerup',52,cx+100,cy); }""")
    print('pinch zoom', pg.evaluate("()=>document.getElementById('mapZoomVal').textContent"), 'marker', pg.evaluate("()=>__LD.G.marker"))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m_map_pinch.png')
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    # 배치 편집기
    pg.evaluate("()=>__LD.Touch.openEditor()"); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+'m_editor.png')
    def drag(id, dx, dy):
        bx = pg.evaluate(f"()=>{{const r=document.getElementById('ed_{id}').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}}")
        pg.evaluate(f"""()=>{{ const el=document.getElementById('ed_{id}'); const ev=(t,x,y)=>el.dispatchEvent(new PointerEvent(t,{{pointerId:61,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}}));
          ev('pointerdown',{bx[0]},{bx[1]}); for(let i=1;i<=5;i++) ev('pointermove',{bx[0]}+{dx}*i/5,{bx[1]}+{dy}*i/5); ev('pointerup',{bx[0]+dx},{bx[1]+dy}); }}""")
    drag('team', 300, -40)      # 팀 목록을 화면 가운데 쪽으로
    drag('killfeed', 250, 0)
    drag('bag', 330, 150)       # 가방 버튼을 화면 가운데 아래쪽으로
    # 팀 목록 크기 130%
    pg.evaluate("()=>{ const s=document.getElementById('edSize'); s.value=1.3; s.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m_editor_moved.png')
    print('editor warn', pg.evaluate("()=>document.getElementById('edWarn').textContent"), 'sel', pg.evaluate("()=>document.getElementById('edName').textContent"))
    pg.evaluate("()=>document.getElementById('edSave').click()"); pg.wait_for_timeout(300)
    print('saved layout', pg.evaluate("()=>{const t=JSON.parse(localStorage.getItem('lastdrop.settings')).touchLayout; return {team:t.team, killfeed:t.killfeed, bag:t.bag}}"))
    print('positions after', pg.evaluate("()=>['hbBag','hbMenu','killfeed','teamPanel'].map(id=>{const r=document.getElementById(id).getBoundingClientRect(); return id+':'+[r.left,r.top,r.width,r.height].map(Math.round).join(',')})"))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m_hud_moved.png')
    # 가방 버튼이 옮긴 자리에서 눌리는지
    bb = pg.evaluate("()=>{const r=document.getElementById('hbBag').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]}")
    pg.touchscreen.tap(bb[0], bb[1]); pg.evaluate("()=>__LD.sim(2)"); pg.wait_for_timeout(200)
    print('bag tap → inventory open', pg.evaluate("()=>!document.getElementById('invPanel').hidden"))
    print('errs', errs[:3])
    b.close()
