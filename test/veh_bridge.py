import sys
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots'
MAP=sys.argv[1]
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1100,'height':620}); errs=[]
    pg.on('pageerror', lambda e: errs.append('PE '+str(e)))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{quality:'low', shadows:'off', bots:2, view:'tpp', map:'{MAP}'}})); }}"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=180000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(L.G.player.mode==='plane'&&Math.abs(pl.pos.x)<HALFX()){} } }""".replace("HALFX()","9999"))
    r = pg.evaluate("""()=>{ const L=__LD, W=L.W, V=L.Veh; const p=L.G.player; 
      // 강하 생략: 플레이어를 바로 지상으로
      p.mode='ground'; p.root.visible=true; for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; } p.hp=1e9; L.G.plane.active=false;
      const out=[];
      for (const br of W.bridges.slice(0,6)) {
        // 이 다리를 지나는 도로 찾기
        const road = W.roads.find(r=>{ const t=(br.cx-r.ax)*r.dx+(br.cz-r.az)*r.dz; if(t<0||t>r.len) return false; const px=r.ax+r.dx*t, pz=r.az+r.dz*t; return Math.hypot(px-br.cx,pz-br.cz)<2; });
        if(!road) { out.push('noroad'); continue; }
        for (const type of ['sedan','uaz','moto']) {
          const t0=(br.cx-road.ax)*road.dx+(br.cz-road.az)*road.dz - br.L/2 - 45; if (t0 < 5) { out.push([type,'short']); continue; }
          if (p.veh) V.exit(p,true,true);
          const v=V.make(type, road.ax+road.dx*t0, road.az+road.dz*t0, Math.atan2(road.dx,road.dz)); p.pos.set(v.pos.x, v.pos.y, v.pos.z); V.enter(p,v);
          let maxY=-99, minY=99, crossed=false, minSp=99, hp0=v.hp;
          for (let f=0; f<30*12; f++) { const ax=v.pos.x-road.ax, az=v.pos.z-road.az, along=ax*road.dx+az*road.dz, lat=ax*(-road.dz)+az*road.dx;
            const dyaw=((Math.atan2(road.dx,road.dz)-v.yaw+Math.PI*3)%(Math.PI*2))-Math.PI; L.Input.keys.KeyW = Math.hypot(v.vx,v.vz) < 14; L.Input.move.x=Math.max(-1,Math.min(1,-dyaw*2-lat*0.15));
            L.sim(1); const t=along - ((br.cx-road.ax)*road.dx+(br.cz-road.az)*road.dz);
            if (Math.abs(t) < br.L/2) { maxY=Math.max(maxY,v.pos.y); minY=Math.min(minY,v.pos.y); minSp=Math.min(minSp, Math.hypot(v.vx,v.vz)); }
            if (t > br.L/2 + 10) { crossed=true; break; } }
          L.Input.keys.KeyW=false; L.Input.move.x=0;
          out.push([type, crossed, 'deckY', +br.y.toFixed(1), 'vehY', +minY.toFixed(1), +maxY.toFixed(1), 'minSp', +minSp.toFixed(1), 'hpLoss', Math.round(hp0-v.hp)]);
          V.exit(p,true,true);
        }
      }
      return out; }""")
    for x in r: print(x)
    print('errs', errs[:4])
    b.close()
