# 모바일(844x390) 스쿼드 HUD: 팀 패널·기절·부활·관전 화면과 버튼 라벨
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots/sq'
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
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:15, view:'tpp', map:'kalden', squad:'squad'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/m_00_lobby.png')
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && !L.G.teams[0].members.every(m=>m.mode==='ground');i++) L.sim(1); L.sim(30);
      for (const c of L.CHARS) if(!c.isPlayer && c.team>1){ c.alive=false; c.root.visible=false; } for (const c of L.G.teams[1].members) c.pos.x+=400; }""")
    pg.evaluate("()=>{ for(const id of ['m416','a556','bandage','helm2']) __spawn(id, __LD.G.player.pos.x+0.8, __LD.G.player.pos.z+0.6); __LD.sim(3); }")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/m_00b_loot.png')
    # 팀원 하나 기절 → 옆으로
    pg.evaluate("()=>{const G=__LD.G,p=G.player,m=G.teams[0].members[1]; m.hp=1; __LD.knockChar(m,null,'fall'); m.pos.set(p.pos.x+Math.sin(p.yaw)*1.2,p.pos.y,p.pos.z+Math.cos(p.yaw)*1.2); m.brain.crawlGoal=null; __LD.sim(3);}")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/m_01_mateDown.png')
    print('label', pg.evaluate("()=>[document.getElementById('tb_interact').textContent, document.getElementById('vehPrompt').textContent, document.getElementById('vehPrompt').hidden]"))
    bb = pg.evaluate("()=>{ const r=document.getElementById('tb_interact').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; }")
    pg.evaluate("""([x,y])=>{ const el=document.getElementById('tb_interact'); el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true})); el.dispatchEvent(new PointerEvent('pointerup',{pointerId:31,pointerType:'touch',clientX:x,clientY:y,bubbles:true})); __LD.sim(60); }""", bb)
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/m_02_reviving.png')
    print('reviving', pg.evaluate("()=>{const p=__LD.G.player; return [!!p.revive, document.getElementById('tb_interact').textContent]}"))
    pg.evaluate("()=>__LD.sim(30*9)")
    print('revived', pg.evaluate("()=>{const m=__LD.G.teams[0].members[1]; return [m.knocked, m.hp]}"))
    # 플레이어 기절
    pg.evaluate("()=>{const p=__LD.G.player; p.hp=1; __LD.fns.applyDamage(p,20,'body',null,'fall'); __LD.sim(20);}")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/m_03_knocked.png')
    print('knocked btns', pg.evaluate("()=>[...document.querySelectorAll('#tbtns .tbtn')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.id)"), pg.evaluate("()=>getComputedStyle(document.getElementById('stick')).display"))
    # 사망 → 관전
    pg.evaluate("()=>{const p=__LD.G.player; __LD.fns.applyDamage(p,500,'body',null,'fall'); __LD.sim(30);}")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/m_04_spectate.png')
    print('spec', pg.evaluate("()=>[__LD.G.spec&&__LD.G.spec.name, document.body.className]"))
    print('errs', errs[:5])
    b.close()
