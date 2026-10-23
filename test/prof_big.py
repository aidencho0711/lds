# 대형 맵 99봇: CPU 프로파일 (함수별 self time)
import json
from collections import Counter
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':960,'height':540}); pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:99, view:'tpp', map:'norden'})); }"); pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=600000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<5000 && L.G.player.mode!=='ground';i++){ L.sim(1); if(L.G.player.mode==='plane' && L.G.plane.t>8) L.Input.press('interact'); } for(let i=0;i<6000 && L.CHARS.filter(c=>c.mode!=='ground'&&c.alive).length;i++) L.sim(1); L.G.player.hp=1e9; L.sim(300); }""")
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start'); pg.evaluate('()=>{ const s=__LD.Nav.stats; s.coarse=s.cnodes=s.cfail=s.fine=0; }')
    t = pg.evaluate("()=>{ const L=__LD; const t0=performance.now(); for(let i=0;i<300;i++) L.sim(1); return (performance.now()-t0)/300; }")
    prof = cdp.send('Profiler.stop')['profile']
    print('nav', pg.evaluate('()=>JSON.stringify(__LD.Nav.stats)')); print('ms/frame', round(t,2), 'alive', pg.evaluate("()=>__LD.CHARS.filter(c=>c.alive).length"), 'tiles', pg.evaluate("()=>__LD.Nav.tilesBuilt"))
    nodes = {n['id']: n for n in prof['nodes']}
    self = Counter()
    dt = prof['timeDeltas']; samples = prof['samples']
    for s, d in zip(samples, dt): self[nodes[s]['callFrame']['functionName'] or '(anon)'] += d
    tot = sum(self.values())
    for name, v in self.most_common(25): print(f'{name:28s} {v/tot*100:5.1f}%')
    b.close()
