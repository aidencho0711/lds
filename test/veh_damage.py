import sys, json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots'
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
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:6, view:'tpp', map:'kalden'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=180000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<4000 && L.CHARS.some(c=>c.mode!=='ground');i++) L.sim(1); L.sim(20);
      for (const c of L.CHARS) if(!c.isPlayer){ c.brain.update=function(){}; c.brain.think=function(){}; } }""")
    r = pg.evaluate("""()=>{ const L=__LD, W=L.W, V=L.Veh, p=L.G.player, out={}; p.hp=100;
      const bots=L.CHARS.filter(c=>!c.isPlayer);
      // (a) 벽 충돌: 건물을 향해 50m 앞에서 전속
      const b=W.buildings.find(b=>b.kind==='house'); const dx=b.x-b.door[0], dz=b.z-b.door[1], dl=Math.hypot(dx,dz);
      const sx=b.door[0]-dx/dl*60, sz=b.door[1]-dz/dl*60; // 문 반대쪽? 문 방향에서 벽 쪽으로
      let v=V.make('sedan', sx, sz, Math.atan2(dx,dz)); p.pos.set(v.pos.x+3,v.pos.y,v.pos.z); V.enter(p,v);
      let maxS=0; for(let f=0; f<30*8; f++){ L.Input.keys.KeyW=true; L.sim(1); const s=Math.hypot(v.vx,v.vz); if(s>maxS) maxS=s; }
      L.Input.keys.KeyW=false;
      out.wall = { maxKmh: Math.round(maxS*3.6), vehHp: Math.round(v.hp), riderHp: Math.round(p.hp), distToBld: Math.round(Math.hypot(v.pos.x-b.x, v.pos.z-b.z)), speedNow: +Math.hypot(v.vx,v.vz).toFixed(1) };
      // (b) 들이받기: 봇을 40m 앞에 세우고 돌진
      p.hp=100; V.exit(p,true,true); const r=W.roads.slice().sort((a,b)=>b.len-a.len)[0];
      v=V.make('pickup', r.ax+r.dx*20, r.az+r.dz*20, Math.atan2(r.dx,r.dz)); p.pos.set(v.pos.x+3,v.pos.y,v.pos.z); V.enter(p,v);
      const t=bots[0]; t.alive=true; t.hp=100; t.inv.gear.vest={id:'vest2',dur:150}; t.pos.set(r.ax+r.dx*75, L.fns.groundAt(r.ax+r.dx*75, r.az+r.dz*75, 99), r.az+r.dz*75); t.vel.set(0,0,0);
      let hitKmh=0; for(let f=0; f<30*6; f++){ L.Input.keys.KeyW=true; const hp0=t.hp; L.sim(1); if(t.hp<hp0 && !hitKmh) hitKmh=Math.round(Math.hypot(v.vx,v.vz)*3.6); }
      L.Input.keys.KeyW=false;
      out.runover = { hitKmh, botHp: Math.round(t.hp), alive: t.alive, vest: !!t.inv.gear.vest, killedBy: L.G.killLog.slice(-1)[0] };
      // (c) 사격으로 파괴: 봇이 M416으로 쏨 (플레이어 탑승 중)
      L.Input.keys.Space=true; L.sim(60); L.Input.keys.Space=false;
      p.hp=100; const sh=bots[1]; sh.alive=true; sh.hp=1e6; sh.inv.weapons[0]=L.fns.newWeapon('m416',30); sh.inv.cur=0; sh.inv.items={a556:999};
      sh.pos.set(v.pos.x+Math.sin(v.yaw)*14, v.pos.y, v.pos.z+Math.cos(v.yaw)*14); sh.pos.y=L.fns.groundAt(sh.pos.x, sh.pos.z, v.pos.y+3);
      let shots=0, burnAt=-1, boomAt=-1, f=0; const hp0=v.hp;
      for(; f<30*40; f++){ L.sim(1); if(sh.fireCd<=0 && sh.inv.weapons[0].mag>0){ const o=new THREE.Vector3(); sh.eye(o); const tgt=new THREE.Vector3(v.pos.x, v.pos.y+0.7, v.pos.z); const d=tgt.sub(o).normalize(); if(L.fns.fireWeapon(sh,o,d)) shots++; } if(sh.inv.weapons[0].mag===0){ sh.inv.weapons[0].mag=30; }
        if(v.burnT>0 && burnAt<0) burnAt=f; if(v.dead){ boomAt=f; break; } }
      out.shoot = { shots, burnSec: burnAt>0? +(burnAt/30).toFixed(1):-1, boomSec: boomAt>0? +(boomAt/30).toFixed(1):-1, riderAlive: p.alive, riderHp: Math.round(p.hp), inVeh: !!p.veh, wreckDead: v.dead, killLog: L.G.killLog.slice(-2) };
      return out; }""")
    for k,v in r.items(): print(k, v)
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/drv_boom.png')
    print('errs', errs[:6])
    b.close()
