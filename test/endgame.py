from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':640,'height':360}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1000)
    for run in range(1):
        pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:20, mode:'rapid', difficulty:'hard', map:'ironridge'})); }")
        if run==0: pg.reload(); pg.wait_for_timeout(1000)
        pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
        pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
        r = pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; for(let i=0;i<30*900 && L.G.state==='play';i++) L.sim(1);
           return {state:L.G.state, t:Math.round(L.G.time), alive:L.CHARS.filter(c=>c.alive).length, place:L.G.player.place, win:L.G.win, resultShown:!document.getElementById('resultPanel').hidden, rank:document.getElementById('resRank').textContent, stats:JSON.parse(localStorage.getItem('lastdrop.stats'))}; }""")
        print(r)
        if run==0: pg.evaluate("()=>document.querySelector('[data-ui=again]').click()")
    print('errors', errs)
    b.close()
