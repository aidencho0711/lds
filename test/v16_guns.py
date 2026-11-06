# v16 총기 모델 시트: 오른쪽·왼쪽 측면 + 부착물 장착 / 사용: python3 test/v16_guns.py OUT [ids]
import sys, base64
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
ids = sys.argv[2].split(',') if len(sys.argv) > 2 else ['beryl', 'm16a4', 'vector', 'bizon', 'tommy', 'kar98k', 'win94', 's1897', 'dp28', 'deagle']
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ window.RG = (id, att, d, W, H) => { const L = __LD; return L.Models._render(L.Models.display(id, att), W || 900, H || 360, d); };
      window.ATT = (id) => { const L = __LD, f = L.fns.attFits, a = { scope: null, muzzle: null, mag: null, grip: null };
        for (const s of ['x4', 'x2', 'reddot']) if (f(s, id)) { a.scope = s; break; } if (f('comp', id)) a.muzzle = 'comp'; if (f('grip', id)) a.grip = 'grip'; if (f('extmag', id)) a.mag = 'extmag'; return a; }; }""")
    for id in ids:
        for side, d in (('R', [-1, 0.1, 0.02]), ('L', [1, 0.1, 0.02]), ('T', [-0.5, 0.8, 0.3])):
            url = pg.evaluate(f"()=>RG('{id}', null, {d})")
            open(f'{OUT}/g_{id}_{side}.png', 'wb').write(base64.b64decode(url.split(',')[1]))
        url = pg.evaluate(f"()=>RG('{id}', ATT('{id}'), [-1, 0.25, 0.02])")
        open(f'{OUT}/g_{id}_att.png', 'wb').write(base64.b64decode(url.split(',')[1]))
    print('att', pg.evaluate("(ids)=>ids.map(id=>id+':'+JSON.stringify(ATT(id)))", ids))
    print('errors', logs[:8])
    b.close()
