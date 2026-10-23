import sys, json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
DIFF = sys.argv[1] if len(sys.argv)>1 else 'normal'; DIST=float(sys.argv[2]) if len(sys.argv)>2 else 40; WEP=sys.argv[3] if len(sys.argv)>3 else 'ar7'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('pageerror', lambda e: print('PAGEERR', e))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate(f"()=>{{ const st=JSON.parse(localStorage.getItem('lastdrop.settings')||'{{}}'); st.bots=4; st.difficulty='{DIFF}'; localStorage.setItem('lastdrop.settings', JSON.stringify(st)); }}")
    pg.reload(); pg.wait_for_timeout(1000)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    r = pg.evaluate(f"""()=>{{ const L=__LD; const C=L.CHARS; const P=C[0];
      // 모두 강하/착지시키기
      for(let i=0;i<2000 && C.some(c=>c.mode!=='ground'); i++){{ L.sim(1); if(P.mode==='plane'&&Math.abs(L.G.plane.pos.x)<250&&Math.abs(L.G.plane.pos.z)<250) L.Input.press('interact'); }}
      // 넓은 평지 찾기
      let best=null; for(let t=0;t<4000;t++){{ const x=(Math.random()-0.5)*500, z=(Math.random()-0.5)*500; let ok=true; for(let k=0;k<=12;k++){{ const xx=x+{DIST}*k/12; if(!L.Nav.isFree(xx,z)||Math.abs(L.W && 0)) {{ok=false;break;}} }} if(!ok) continue; const h0=L.W? 0:0; best=[x,z]; break; }}
      const [x,z]=best; P.pos.set(x+{DIST}/2, window.__gh(x+{DIST}/2,z+30), z+30); P.hp=1e9; P.stance='prone';
      const A=C[1], B=C[2]; for(const c of C.slice(3)) {{ c.alive=false; c.root.visible=false; }}
      const setup=(c,px)=>{{ c.pos.set(px, 60, z); c.pos.y = Math.max(0, __LD.W ? 0 : 0); c.pos.y = (window.__gh ? window.__gh(px,z) : 0); c.vel.set(0,0,0); c.mode='ground'; c.inv.weapons=[{{id:'{WEP}',mag:__LD.ITEMS['{WEP}'].mag,att:{{}}}},null,null]; c.inv.weapons[0].att={{scope:null,muzzle:null,mag:null,grip:null}}; c.inv.cur=0; c.inv.items={{a556:120,a762:120,a9:120,a12:40}}; c.hp=100; c.brain.aware.clear(); c.brain.setState('EXPLORE'); c.brain.landT=-9; c.setVisibleGear(); }};
      setup(A,x); setup(B,x+{DIST}); A.yaw=Math.PI/2; B.yaw=-Math.PI/2;
      L.sim(5);
      const log=[]; const s0=L.G.stats.shots, h0=L.G.stats.hits;
      const ev=[]; for(let s=0;s<40;s++){{ L.sim(15); if(A.rl) ev.push('A:'+A.rl.kind); if(A.cycle) ev.push('A:'+A.cycle.kind); log.push([s/2, A.brain.state, Math.round(A.hp), B.brain.state, Math.round(B.hp), Math.round(Math.hypot(A.pos.x-B.pos.x,A.pos.z-B.pos.z))]); if(!A.alive||!B.alive) break; }}
      return {{log, shots:L.G.stats.shots-s0, hits:L.G.stats.hits-h0, ev:[...new Set(ev)]}};
    }}""")
    for l in r['log']: print(l)
    print('shots', r['shots'], 'hits', r['hits'], r['ev'])
    b.close()
