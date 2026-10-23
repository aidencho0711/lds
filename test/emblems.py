from playwright.sync_api import sync_playwright
import base64
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1400,'height':760}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{ const L=__LD; document.body.innerHTML=''; document.body.style.background='#1b2024'; const wrap=document.createElement('div'); wrap.style.cssText='display:grid;grid-template-columns:repeat(5,260px);gap:10px;padding:16px;color:#eee;font:14px sans-serif';
      for(let t=0;t<10;t++){ const d=document.createElement('div'); d.style.textAlign='center'; const im=new Image(); im.src=L.Rank.emblem(t, 4-(t%4), 256); im.width=240; d.appendChild(im); const s=document.createElement('div'); s.textContent=L.RANK_TIERS[t].name; d.appendChild(s); wrap.appendChild(d); }
      document.body.appendChild(wrap); }""")
    pg.wait_for_timeout(500); pg.screenshot(path='/home/claude/br/test/shots/emblems.png')
    print(errs)
    b.close()
