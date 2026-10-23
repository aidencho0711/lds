from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':800,'height':450}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:24, view:'tpp', difficulty:'hard'})); }"); pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    for k in range(10):
        r = pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; L.G.player.pos.y = Math.max(L.G.player.pos.y, -50); for(let i=0;i<900;i++) L.sim(1);
          const crates=L.Airdrop.list.map(d=>({landed:d.landed, left:d.items.filter(i=>i.alive).map(i=>i.id), at:[Math.round(d.x),Math.round(d.z)]}));
          const holders=L.CHARS.filter(c=>c.alive && !c.isPlayer && c.inv.weapons.some(w=>w&&L.ITEMS[w.id].supply)).map(c=>c.inv.weapons.filter(Boolean).map(w=>w.id).join('+'));
          const crateMove=L.CHARS.filter(c=>c.alive && c.brain && c.brain.investigate && c.brain.investigate.kind==='crate').length;
          return {t:Math.round(L.G.time), alive:L.CHARS.filter(c=>c.alive).length, crates, holders, crateMove}; }""")
        print(r)
        if r['alive'] <= 2: break
    print('errors', errs[:5])
    b.close()
