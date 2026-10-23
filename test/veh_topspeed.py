import sys, json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots'
MAP = sys.argv[1] if len(sys.argv)>1 else 'kalden'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1100,'height':620}); errs=[]
    pg.on('pageerror', lambda e: errs.append('PE '+str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{quality:'medium', shadows:'low', bots:4, view:'tpp', map:'{MAP}'}})); }}"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=180000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    r = pg.evaluate("""()=>{ const L=__LD; const cnt={}; for(const v of L.Veh.list) cnt[v.type]=(cnt[v.type]||0)+1; 
      for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(20);
      for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; }
      return {cnt, n: L.Veh.list.length}; }""")
    print('spawned', r)
    # 각 종류: 가장 긴 도로 위에 놓고 20초 전속
    res = pg.evaluate("""()=>{ const L=__LD, W=L.W, V=L.Veh, p=L.G.player; p.hp=1e9; const out={};
      const roads=W.roads.slice().sort((a,b)=>b.len-a.len);
      for (const type of ['horse','moto','uaz','sedan','pickup']) {
        let v=null, r=null;
        for (const rr of roads) { const x=rr.ax+rr.dx*20, z=rr.az+rr.dz*20; const yaw=Math.atan2(rr.dx,rr.dz); v=V.make(type,x,z,yaw); r=rr; break; }
        p.pos.set(v.pos.x+3, v.pos.y, v.pos.z); V.enter(p, v);
        let maxS=0, t=0; const s0={x:v.pos.x,z:v.pos.z}; const tr=[];
        for (let f=0; f<30*22; f++) { L.Input.keys.KeyW=true; // 도로를 따라가도록 간단 조향
          const ax=v.pos.x-r.ax, az=v.pos.z-r.az, along=ax*r.dx+az*r.dz, lat=ax*(-r.dz)+az*r.dx; const want=Math.atan2(r.dx,r.dz); let e=L.fns.angleDiff? 0:0;
          let dyaw = ((want - v.yaw + Math.PI*3) % (Math.PI*2)) - Math.PI; // + 오른쪽 필요 → steer
          const st = Math.max(-1, Math.min(1, -dyaw*2 + lat*0.08*(1)));
          v.ctrl.steer=st; L.Input.keys.KeyD = false; L.Input.keys.KeyA=false;
          L.Input.move.x = st; L.sim(1); const sp=Math.hypot(v.vx,v.vz); if(sp>maxS) maxS=sp; if(f%30===0) tr.push(Math.round(sp*3.6)); if(along > r.len-60) break; }
        L.Input.keys.KeyW=false; L.Input.move.x=0;
        out[type] = { maxKmh: +(maxS*3.6).toFixed(1), spec: L.VEH_TYPES[type].kmh, dist: Math.round(Math.hypot(v.pos.x-s0.x, v.pos.z-s0.z)), roadLen: Math.round(r.len), trace: tr.join(','), hp: Math.round(v.hp) };
        L.Input.press('interact'); L.sim(2); out[type].exited = !p.veh;
      }
      return out; }""")
    for k,v in res.items(): print(k, v)
    print('errs', errs[:6])
    b.close()
