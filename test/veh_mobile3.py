# 모바일: 운전석/동승석 버튼 구성, 좌석 버튼, 핑 길게 누르기
from playwright.sync_api import sync_playwright
OUT='/home/claude/br/test/shots/sq/'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
VIS = "()=>[...document.querySelectorAll('#tbtns .tbtn')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.id.slice(3)).join(',')"
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':891,'height':355}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:11, map:'kalden', squad:'squad'})); }"); pg.reload(); pg.wait_for_timeout(1000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("""()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<4000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<5000 && L.G.player.mode!=='ground';i++) L.sim(1);
      const G=L.G,p=G.player; p.hp=1e9; for(const c of L.CHARS) if(!c.isPlayer){ c.brain.update=()=>{}; c.brain.think=()=>{}; } p.inv.weapons[0]=L.fns.newWeapon('m416',30); p.inv.items.a556=90; p.inv.cur=0; p.setVisibleGear();
      const r=L.W.roads.slice().sort((a,b)=>b.len-a.len)[0]; const v=L.Veh.make('pickup', r.ax+r.dx*40, r.az+r.dz*40, Math.atan2(r.dx,r.dz)); window.__v=v; L.Veh.enter(p, v); L.sim(10); }""")
    print('driver buttons:', pg.evaluate(VIS))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m3_driver.png')
    sb = pg.evaluate("()=>{const r=document.getElementById('tb_seat').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}")
    pg.touchscreen.tap(sb[0], sb[1]); pg.evaluate("()=>__LD.sim(5)")
    print('after seat tap: seat', pg.evaluate("()=>__LD.G.player.seat"), 'buttons:', pg.evaluate(VIS), 'label', pg.evaluate("()=>document.getElementById('tb_interact').textContent"))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m3_passenger.png')
    # 핑 버튼 길게 누르기 → 모여 (먼저 이동 핑을 하나 찍어 둠)
    pg.evaluate("()=>{ __LD.Veh.exit(__LD.G.player,true,true); __LD.sim(3); __LD.G.player.pitch=-0.1; __LD.sim(2); }")
    pb = pg.evaluate("()=>{const r=document.getElementById('tb_ping').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}")
    pg.touchscreen.tap(pb[0], pb[1]); pg.evaluate("()=>__LD.sim(2)")
    o1 = pg.evaluate("()=>__LD.G.teamOrder&&__LD.G.teamOrder.kind")
    pg.wait_for_timeout(600)
    pg.evaluate(f"""()=>{{ const el=document.getElementById('tb_ping'); el.dispatchEvent(new PointerEvent('pointerdown',{{pointerId:71,pointerType:'touch',clientX:{pb[0]},clientY:{pb[1]},bubbles:true}})); __LD.sim(1); }}""")
    pg.wait_for_timeout(800)
    pg.evaluate(f"""()=>{{ __LD.sim(2); const el=document.getElementById('tb_ping'); el.dispatchEvent(new PointerEvent('pointerup',{{pointerId:71,pointerType:'touch',clientX:{pb[0]},clientY:{pb[1]},bubbles:true}})); __LD.sim(1); }}""")
    print('tap ping →', o1, '| long press →', pg.evaluate("()=>__LD.G.teamOrder"))
    # 두 번 탭 → 위험
    pg.wait_for_timeout(500)
    pg.touchscreen.tap(pb[0], pb[1]); pg.touchscreen.tap(pb[0], pb[1]); print("pingQ", pg.evaluate("()=>[__LD.Input.pingQ.map(t=>t.toFixed(3)), [...__LD.Input.edge]]")); pg.evaluate("()=>__LD.sim(2)")
    print('double tap →', pg.evaluate("()=>({danger:!!__LD.G.danger, order:__LD.G.teamOrder&&__LD.G.teamOrder.kind})"))
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m3_danger.png')
    print('errs', errs[:3])
    b.close()
