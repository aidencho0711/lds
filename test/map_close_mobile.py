# 휴대폰 가로(주소창 포함 실제 높이)에서 전체 지도 닫기 버튼이 화면 안에 있는지
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots/sq/'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for (w,h) in [(891,355),(915,340),(844,390),(780,320),(1280,720)]:
        mob = w < 1000
        ctx = b.new_context(viewport={'width':w,'height':h}, has_touch=mob, is_mobile=mob); pg = ctx.new_page(); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
        pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:4, map:'kalden'})); }"); pg.reload(); pg.wait_for_timeout(1000)
        pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
        pg.wait_for_timeout(400)
        r = pg.evaluate("""()=>{ const q=(s)=>{const e=document.querySelector(s); const r=e.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom), getComputedStyle(e).display!=='none']};
           return {x:q('.map-x'), side:q('.map-side > .btn[data-ui=closeMap]'), map:q('#bigmap'), zoom:q('[data-mz=me]')}; }""")
        inside = lambda a: a[4] and a[0] >= 0 and a[1] >= 0 and a[2] <= w and a[3] <= h
        print((w,h), {k:(v, 'OK' if inside(v) else 'OUT') for k,v in r.items()})
        pg.screenshot(path=OUT+f'mapclose_{w}x{h}.png')
        # X 버튼으로 닫히는지
        xb = r['x']; pg.mouse.click((xb[0]+xb[2])/2, (xb[1]+xb[3])/2) if not mob else pg.touchscreen.tap((xb[0]+xb[2])/2, (xb[1]+xb[3])/2)
        pg.wait_for_timeout(200)
        print('   closed by X:', pg.evaluate("()=>document.getElementById('mapPanel').hidden"), errs[:2])
        ctx.close()
    b.close()
