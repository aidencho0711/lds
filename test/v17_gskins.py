# v17 총기 스킨 시트: 스킨마다 옆모습(+ 기본 총) 렌더 → 한 장으로 / 사용: python3 test/v17_gskins.py OUT [ids]
import sys, base64, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
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
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text[:300]) if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(2500)
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else pg.evaluate("()=>Object.keys(__LD.GSKINS)")
    res = pg.evaluate("""(ids)=>{ const L=__LD, out={};
      for (const id of ids) { const d=L.GSKINS[id]; const t0=performance.now();
        out[id] = { img: L.Models._render(L.Models.buildGun(d.gun, {}, id), 480, 190, [-1, 0.22, 0.12]), base: L.Models._render(L.Models.buildGun(d.gun, {}), 480, 190, [-1, 0.22, 0.12]), ms: Math.round(performance.now()-t0), name: L.GunSkin.name(id), rar: d.rar, box: d.box }; }
      return out; }""", ids)
    for id, r in res.items():
        for k in ('img', 'base'):
            if r[k]: open(f'{OUT}/gs_{id}_{k}.png', 'wb').write(base64.b64decode(r[k].split(',')[1]))
    print(json.dumps({k: [v['name'], v['rar'], v['box'], v['ms']] for k, v in res.items()}, ensure_ascii=False))
    print('\n'.join(logs[:30]) or 'no errors')
    b.close()
