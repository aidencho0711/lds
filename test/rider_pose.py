# 탑승 자세 확인 (훈련장 차량): 차 운전(핸들 잡기)·오토바이·말·동승자 사격. 옆에서 본 화면
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({view:'tpp', quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    print(pg.evaluate("()=>__LD.Veh.list.map(v=>v.type).join(',')"))
    for typ, seat in (('sedan', 0), ('uaz', 0), ('pickup', 0), ('moto', 0), ('horse', 0), ('uaz', 1)):
        ok = pg.evaluate(f"""()=>{{ const L=__LD,p=L.G.player; if(p.veh) L.Veh.exit(p,false,true); L.sim(3);
          const v=L.Veh.list.find(v=>v.type==='{typ}' && !v.dead); if(!v) return false;
          p.inv.weapons[0]=L.fns.newWeapon('m416',30); p.inv.cur=0; p.equipT=0; p.setVisibleGear();
          L.Veh.enter(p,v,{seat}); L.sim(4); v.ctrl.steer=0.6; if({seat}>0) {{ p.yaw=v.yaw+1.2; p.pitch=0.05; }} L.sim(10);
          // 옆에서 보이게 카메라 고정: 차 왼쪽 앞
          L.G.camOverride = {{ v }};
          return true; }}""")
        if not ok: print('skip', typ); continue
        pg.evaluate("""()=>{ const L=__LD,v=L.G.camOverride.v, cam=L.G.camera; L.G.paused=true;
          const a=v.yaw+1.05, d=v.type==='moto'||v.type==='horse'?3.0:3.6; cam.position.set(v.pos.x+Math.sin(a)*d, v.pos.y+1.9, v.pos.z+Math.cos(a)*d); cam.lookAt(v.pos.x, v.pos.y+1.0, v.pos.z); cam.updateMatrixWorld(); }""")
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/r_{typ}{seat}.png', clip={'x': 150, 'y': 60, 'width': 600, 'height': 480})
        pg.evaluate("()=>{ __LD.G.paused=false; }")
    print('\n'.join(logs[:10]))
    b.close()
