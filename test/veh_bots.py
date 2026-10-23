import sys
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
MAP=sys.argv[1]; BOTS=int(sys.argv[2]); SECS=int(sys.argv[3]) if len(sys.argv)>3 else 400
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info'])
    pg = b.new_page(viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate(f"()=>{{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{{}}'); st.mode='rapid'; st.bots={BOTS}; st.map='{MAP}'; st.quality='low'; st.queue='normal'; st.difficulty='mixed'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }}")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=180000)
    r = pg.evaluate(f"""()=>{{ const L=__LD, V=L.Veh; L.G.player.hp=1e9; const ev={{enter:0, exit:{{}}, rides:[]}};
      const oe=V.enter, ox=V.exit; 
      V.enter=function(c,v){{ const ok=oe(c,v); if(ok&&!c.isPlayer){{ ev.enter++; c._ride={{t:L.G.time, x:c.pos.x, z:c.pos.z, type:v.type}}; }} return ok; }};
      V.exit=function(c,q,f){{ const why=c.brain? (c.brain.exitReq||(c.alive?'?':'dead')) : '-'; const ok=ox(c,q,f); if(ok&&!c.isPlayer&&c._ride){{ ev.exit[why]=(ev.exit[why]||0)+1; ev.rides.push([c._ride.type, Math.round(L.G.time-c._ride.t), Math.round(Math.hypot(c.pos.x-c._ride.x, c.pos.z-c._ride.z)), why]); c._ride=null; }} return ok; }};
      const tl=[]; const t0=performance.now();
      while(L.G.time<{SECS} && L.G.state==='play'){{ L.sim(30*20,1/30); const bots=L.CHARS.filter(c=>!c.isPlayer&&c.alive); tl.push([Math.round(L.G.time), bots.length, bots.filter(c=>c.veh).length, bots.filter(c=>c.brain.state==='TOVEH').length, V.list.filter(v=>v.dead).length]); }}
      const kl={{}}; for(const k of L.G.killLog) kl[k.cause]=(kl[k.cause]||0)+1;
      return {{ev, tl, kl, ms: Math.round((performance.now()-t0)/(L.G.time*30)*100)/100, mem: Math.round(performance.memory.usedJSHeapSize/1048576)}}; }}""")
    print('enters', r['ev']['enter'], 'exits', r['ev']['exit'])
    for x in r['tl']: print(x)
    print('rides (type, sec, dist, why):', r['ev']['rides'][:40])
    print('kills', r['kl'], 'ms/frame', r['ms'], 'mem', r['mem'])
    print('errs', errs[:5])
    b.close()
