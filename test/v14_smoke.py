# v14 빠른 확인: 로비·창고 화면, 경기 시작 → 착지 → 총 들고 서기/걷기/조준(3인칭·1인칭) 화면, 오류 수집
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:4, difficulty:'easy', queue:'normal', squad:'solo', view:'tpp', quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/s_lobby.png')
    pg.evaluate("()=>document.querySelector('[data-tab=custom]').click()"); pg.wait_for_timeout(1800)
    pg.screenshot(path=f'{OUT}/s_warehouse.png')
    pg.evaluate("()=>document.querySelector('[data-tab=play]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.getElementById('playBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ const b=document.querySelector('[data-ui=closeMap]'); if(b) b.click(); }")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } }""")
    pg.evaluate("()=>{ __LD.sim(40); }"); pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/s_fall.png')
    pg.evaluate("()=>{ const L=__LD; for(let i=0;i<60;i++){ L.sim(30); if(L.G.player.mode==='chute') break; } L.sim(25); }"); pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/s_chute.png')
    pg.evaluate("()=>{ const L=__LD; for(let i=0;i<80;i++){ L.sim(30); if(L.G.player.mode==='ground') break; } L.sim(20); for(const c of L.CHARS) if(!c.isPlayer) c.pos.x+=900; }")
    pg.evaluate("""()=>{ const L=__LD, p=L.G.player; p.inv.weapons[0]=L.fns.newWeapon('m416',30); p.inv.add(L.ITEMS.m416.ammo, 150); p.inv.cur=0; p.equipT=0; p.setVisibleGear(); p.inv.gear.helmet={id:'helm2',dur:150}; p.inv.gear.vest={id:'vest2',dur:200}; p.inv.gear.bag={id:'bag2'}; p.setVisibleGear(); p.yaw=0.6; p.pitch=-0.05; L.sim(20); }""")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/s_stand.png')
    pg.evaluate("()=>{ const L=__LD; L.Input.keys.KeyW=true; L.sim(14); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_walk.png')
    pg.evaluate("()=>{ const L=__LD; L.Input.keys.ShiftLeft=true; L.sim(20); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_sprint.png')
    pg.evaluate("()=>{ const L=__LD; L.Input.keys.KeyW=false; L.Input.keys.ShiftLeft=false; L.sim(20); L.Input.aim=true; L.sim(15); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_aim.png')
    pg.evaluate("()=>{ const L=__LD; L.Input.aim=false; L.sim(10); L.G.player.inv.weapons[0].mag=3; L.Input.press('reload'); L.sim(18); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_reload.png')
    pg.evaluate("()=>{ const L=__LD; L.sim(60); L.Input.press('view'); L.sim(10); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_fpp.png')
    pg.evaluate("()=>{ const L=__LD; L.G.player.inv.weapons[0].mag=3; L.Input.press('reload'); L.sim(16); }"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/s_fpp_reload.png')
    print('\n'.join(logs[:30]))
    print('perf', pg.evaluate("()=>{ const t0=performance.now(); for(let i=0;i<30;i++) __LD.fns.animateChar(__LD.G.player, 1/30); return ((performance.now()-t0)/30).toFixed(3)+'ms/anim'; }"))
    b.close()
