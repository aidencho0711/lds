# 차량 스킨 확인: 로비 장면에 기본 차량과 스킨 차량을 세워 렌더 (앞 3/4 · 뒤 3/4) + 운전자 자세
#  사용: python3 test/vskin_sheet.py OUT_DIR
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
    pg = b.new_page(viewport={'width': 1400, 'height': 800})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'high', shadows:'high'})); }")
    pg.reload(); pg.wait_for_timeout(2500)
    ids = pg.evaluate("""()=>{
      const L=__LD, Lb=L.Lobby, sc=Lb.scene;
      document.getElementById('lobby').style.visibility='hidden';
      for (const m of Lb.mates||[]) sc.remove(m.root); if (Lb.rig) sc.remove(Lb.rig.root);
      sc.children.filter(o=>o.type==='Group').forEach(o=>{ if(o!==Lb.rig?.root) o.visible=false; });
      const ids=['sedan','sedan_gt_red','sedan_lux_black','sedan_hyper_green','sedan_gt_yellow','sedan_lux_gold','sedan_hyper_white','moto','moto_racer_blue','moto_cruiser_black','horse','horse_white','horse_black'];
      const out=[]; window.__veh=[];
      ids.forEach((id,i)=>{ const type=id.split('_')[0]; const P=L.VehModels.instance(type, id===type?null:id); const row=i<7?0:1, k=row?i-7:i; P.root.position.set((k-3)*5.2, 0, -row*7); P.root.rotation.y=0.7; sc.add(P.root); window.__veh.push(P); out.push([id, P.skin, P.meshes.length]); });
      Lb.update=function(dt){ this.t+=dt; };
      return out;
    }""")
    print(ids)
    shots = [('cars_front', [0, 3.2, 10], [0, 0.7, 0]), ('cars_back', [0, 3.2, -9], [0, 0.7, 0]), ('bikes', [-10.4, 1.9, -3.2], [-10.4, 0.7, -7]), ('bikes2', [-13.0, 1.6, -3.6], [-10.4, 0.7, -7])]
    for name, cp, la in shots:
        pg.evaluate("([cp,la])=>{ const c=__LD.Lobby.cam; c.position.set(cp[0],cp[1],cp[2]); c.lookAt(la[0],la[1],la[2]); c.fov=50; c.updateProjectionMatrix(); }", [cp, la])
        pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}.png')
    for i, (cp, la) in enumerate([([-12.5, 1.6, 4.0], [-15.6, 0.7, 0]), ([-7.2, 1.6, 4.0], [-10.4, 0.7, 0]), ([-2.0, 1.6, 4.0], [-5.2, 0.7, 0]), ([3.2, 1.6, 4.0], [0, 0.7, 0])]):
        pg.evaluate("([cp,la])=>{ const c=__LD.Lobby.cam; c.position.set(cp[0],cp[1],cp[2]); c.lookAt(la[0],la[1],la[2]); c.fov=40; c.updateProjectionMatrix(); }", [cp, la])
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/car_{i}.png')
    print('\n'.join(logs[:20]))
    b.close()
