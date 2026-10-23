# 대형 맵: 생성 시간·메모리·타일 수, 수송기/지상 스크린샷, 프레임 시간
import sys, time
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
BOTS = int(sys.argv[1]) if len(sys.argv) > 1 else 20
OUT='/home/claude/br/test/shots/'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info','--js-flags=--expose-gc'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{quality:'medium', shadows:'low', bots:{BOTS}, view:'tpp', map:'norden'}})); }}"); pg.reload(); pg.wait_for_timeout(2000)
    t0 = time.time()
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=600000)
    print('gen seconds', round(time.time()-t0,1))
    print(pg.evaluate("""()=>{ const L=__LD, W=L.W; return { pois: W.pois.length, cities: W.pois.filter(p=>p.type==='city').length, buildings: W.buildings.length, boxes: W.boxes.length, roads: W.roads.length, loot: W.lootSpots.length, trees: W.trees.length, rocks: W.rocks.length, chunks: W.chunkObjs.size, terrainLive: W.terrainLive.size, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : -1, tiles: L.Nav.tilesBuilt, chars: L.CHARS.length }; }"""))
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("()=>__LD.sim(60)"); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'big_plane.png')
    pg.evaluate("()=>{ __LD.Input.press('map'); __LD.sim(1); }"); pg.wait_for_timeout(700); pg.screenshot(path=OUT+'big_map.png'); pg.evaluate("()=>{ __LD.Input.press('map'); __LD.sim(1); }")
    r = pg.evaluate("""()=>{ const L=__LD; const t0=performance.now(); let n=0; for(let i=0;i<4000;i++){ L.sim(1); n++; const pl=L.G.plane; const c=L.W.pois.find(p=>p.type==='city'); if(Math.hypot(pl.pos.x-c.x, pl.pos.z-c.z)<900){ L.Input.press('interact'); L.sim(1); break; } }
      for(let i=0;i<6000 && L.G.player.mode!=='ground';i++) { L.sim(1); n++; } return {frames:n, ms: Math.round(performance.now()-t0), mode: L.G.player.mode, pos: [Math.round(L.G.player.pos.x), Math.round(L.G.player.pos.z)]}; }""")
    print('drop', r)
    pg.evaluate("()=>{ const p=__LD.G.player; p.hp=1e9; p.pitch=-0.05; __LD.sim(30); }"); pg.wait_for_timeout(800); pg.screenshot(path=OUT+'big_ground.png')
    pg.evaluate("()=>{ const L=__LD,p=L.G.player,c=L.W.pois.find(q=>q.type==='city'); p.pos.set(c.x+c.r+30, window.__gh(c.x+c.r+30,c.z), c.z); p.yaw=-Math.PI/2; p.pitch=0.05; for(let i=0;i<40;i++) L.sim(1); }"); pg.wait_for_timeout(1200); pg.screenshot(path=OUT+'big_city.png')
    pg.evaluate("()=>{ const L=__LD,p=L.G.player,m=L.W.mounts[0]; const x=m.x+m.r*0.9, z=m.z; p.pos.set(x, window.__gh(x,z), z); p.yaw=Math.atan2(m.x-x, m.z-z); p.pitch=0.12; for(let i=0;i<40;i++) L.sim(1); }"); pg.wait_for_timeout(1200); pg.screenshot(path=OUT+'big_mount.png')
    # 프레임 비용: 시뮬 + 렌더
    r = pg.evaluate("""()=>{ const L=__LD; const t0=performance.now(); for(let i=0;i<90;i++) L.sim(1); const sim=(performance.now()-t0)/90; 
      const r=L.G.renderer; const t1=performance.now(); for(let i=0;i<10;i++) r.render(L.G.scene, L.G.camera); const ren=(performance.now()-t1)/10;
      return { simMs: +sim.toFixed(2), renderMs: +ren.toFixed(1), calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tiles: L.Nav.tilesBuilt, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : -1, terrainLive: L.W.terrainLive.size }; }""")
    print('frame', r)
    print('errors', errs[:8])
    b.close()
