import json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{}'); st.mode='classic'; st.bots=30; st.difficulty='normal'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }")
    pg.reload(); pg.wait_for_timeout(1000)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    print(pg.evaluate("""()=>{ const L=__LD; L.G.player.hp=1e9; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<200&&Math.abs(pl.pos.z)<200){ L.Input.press('interact'); L.sim(1); break; } }
      L.sim(30*40);
      const T={}, N={}; const wrap=(obj,name,key)=>{ const f=obj[name]; obj[name]=function(){ const t=performance.now(); const r=f.apply(this,arguments); T[key]=(T[key]||0)+performance.now()-t; N[key]=(N[key]||0)+1; return r; }; }; window.__N=N; const kinds={}; const mg=L.Brain.prototype.moveGoal; L.Brain.prototype.moveGoal=function(x,z,k){ const before=this.wantPath; const r=mg.apply(this,arguments); if(this.wantPath&&this.wantPath!==before) kinds[k]=(kinds[k]||0)+1; return r; }; window.__K=kinds;
      const B=L.Brain.prototype; wrap(B,'perceive','perceive'); wrap(B,'think','think(total)'); wrap(B,'update','botUpdate(total)'); wrap(B,'findLoot','findLoot'); wrap(B,'findCover','findCover'); wrap(B,'solvePath','path');
      const t0=performance.now(); L.sim(30*30); const tot=performance.now()-t0;
      return {N:window.__N, K:window.__K, totalMs:Math.round(tot), perFrame:(tot/900).toFixed(2), T:Object.fromEntries(Object.entries(T).map(([k,v])=>[k,Math.round(v)]))}; }"""))
    b.close()
