# 총기 모델 렌더 확인: 오른쪽/왼쪽 측면, 부착물 장착 상태
from playwright.sync_api import sync_playwright
import base64, sys
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
ids = sys.argv[1].split(',') if len(sys.argv) > 1 else ['m416','aug','akm','asm','mini14','slr','m24','awm','s686','s12k','m249','mg3','vk9','p19']
OUT = '/home/claude/br/test/shots/'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ window.RG = (id, att, d, W, H) => { const L = __LD; return L.Models._render(L.Models.display(id, att), W || 1000, H || 400, d); };
      window.ATT = (id) => { const L = __LD, f = L.fns.attFits, a = { scope: null, muzzle: null, mag: null, grip: null };
        for (const s of ['x4', 'x2', 'reddot']) if (f(s, id)) { a.scope = s; break; } if (f('comp', id)) a.muzzle = 'comp'; if (f('grip', id)) a.grip = 'grip'; if (f('extmag', id)) a.mag = 'extmag'; return a; }; }""")
    for id in ids:
        for side, d in (('R', [-1, 0.1, 0.02]), ('L', [1, 0.1, 0.02])):
            url = pg.evaluate(f"()=>RG('{id}', null, {d})")
            open(OUT + f'g_{id}_{side}.png','wb').write(base64.b64decode(url.split(',')[1]))
        url = pg.evaluate(f"()=>RG('{id}', ATT('{id}'), [-1, 0.25, 0.02])")
        open(OUT + f'g_{id}_att.png','wb').write(base64.b64decode(url.split(',')[1]))
    print('errors', errs[:5])
    b.close()
