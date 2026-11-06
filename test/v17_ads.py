# 정조준 화면 확인: 훈련장에서 총을 들고 조준(1인칭/3인칭) → 스크린샷
#  사용: python3 test/v17_ads.py OUT fpp|tpp id[,id...]   (부착물 없이; id:scope 형식이면 그 조준경을 단다)
import sys, json
from playwright.sync_api import sync_playwright
OUT, VIEW, IDS = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text[:300]) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("(v)=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', view:v})); }", VIEW)
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ __LD.sim(10); }")
    res = {}
    for spec in IDS:
        gid, sc = (spec.split(':') + [None])[:2]
        for ads in (False, True):
            info = pg.evaluate("""([gid, sc, ads])=>{ const L=__LD, p=L.G.player; L.G.paused=false;
              const w=L.fns.newWeapon(gid, L.ITEMS[gid].mag); if (sc) w.att.scope=sc; p.inv.weapons=[w, null, null]; p.inv.cur=0; p.inv.items={}; p.inv.items[L.ITEMS[gid].ammo]=100;
              p.equipT=0; p.rl=null; p.cycle=null; p.setVisibleGear(); p.yaw=Math.PI*0.5; p.pitch=0.0; L.Input.aimToggle=ads; L.sim(50, 1/60); L.G.paused=true;
              const si=L.fns.sightInfo ? L.fns.sightInfo(p) : null; return { vm: L.VM.active, si, zoom: L.Cam ? L.Cam.zoom : null }; }""", [gid, sc, ads])
            pg.wait_for_timeout(200)
            name = f'ads_{VIEW}_{gid}{"_" + sc if sc else ""}_{"ads" if ads else "hip"}'
            pg.screenshot(path=f'{OUT}/{name}.png'); res[name] = info
    pg.evaluate("()=>{ __LD.Input.aimToggle=false; }")
    print(json.dumps(res, ensure_ascii=False, default=str))
    print('\n'.join(logs[:20]) or 'no errors')
    b.close()
