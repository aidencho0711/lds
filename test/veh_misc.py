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
      for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; } L.G.player.hp=1e9; }""")
    r = pg.evaluate("""()=>{ const L=__LD, W=L.W, V=L.Veh, p=L.G.player, out={}; const r=W.roads.slice().sort((a,b)=>b.len-a.len)[0], yaw=Math.atan2(r.dx,r.dz);
      const at=(k, side=0)=>[r.ax+r.dx*k - r.dz*side, r.az+r.dz*k + r.dx*side];
      // (1) 말 사살 → 탑승자 낙마
      let [x,z]=at(30); const h=V.make('horse',x,z,yaw); p.pos.set(x+2,h.pos.y,z); V.enter(p,h); p.hp=100;
      V.damage(h, 300, null, 'm416'); L.sim(40); out.horse = { dead: h.dead, riderOff: !p.veh, riderHp: Math.round(p.hp) };
      // (2) 수류탄
      [x,z]=at(60); const s=V.make('sedan',x,z,yaw); const hp0=s.hp; const g=L.G; window.__f={x,z};
      L.fns.applyDamage; // explode via projectile path
      const owner=L.CHARS[1]; owner.alive=true; owner.pos.set(x+30, s.pos.y, z); owner.inv.items={frag:1};
      const o=new THREE.Vector3(x+1.5, s.pos.y+0.5, z), d=new THREE.Vector3(0,-1,0); L.fns.throwItem? 0:0;
      window.__LD.G.scene && 0; 
      out.fragApi = typeof L.fns.throwItem;
      V.blast(x+1.5, s.pos.y+0.3, z, 8, 420, owner); out.frag = { hpLoss: Math.round(hp0 - s.hp), burning: s.burnT>0 };
      owner.alive=false;
      // (3) 차량끼리 충돌: 픽업이 세워진 UAZ를 들이받음
      [x,z]=at(120); const u=V.make('uaz',x,z,yaw+Math.PI/2); [x,z]=at(80); const pk=V.make('pickup',x,z,yaw); p.pos.set(x+3,pk.pos.y,z); p.hp=100; V.enter(p,pk);
      const u0={x:u.pos.x,z:u.pos.z,hp:u.hp}, pk0=pk.hp; let mx=0;
      for(let f=0;f<30*6;f++){ L.Input.keys.KeyW=true; L.sim(1); mx=Math.max(mx,Math.hypot(pk.vx,pk.vz)); }
      L.Input.keys.KeyW=false;
      out.vv = { hitKmh: Math.round(mx*3.6), uazMoved: +Math.hypot(u.pos.x-u0.x,u.pos.z-u0.z).toFixed(1), uazHpLoss: Math.round(u0.hp-u.hp), pickupHpLoss: Math.round(pk0-pk.hp), riderHp: Math.round(p.hp) };
      // (4) 달리다 뛰어내리기
      L.Input.keys.Space=true; L.sim(60); L.Input.keys.Space=false;
      [x,z]=at(200); const m=V.make('moto',x,z,yaw); p.pos.set(x+2,m.pos.y,z); V.enter(p,m); p.hp=100;
      for(let f=0;f<30*4;f++){ L.Input.keys.KeyW=true; L.sim(1); } L.Input.keys.KeyW=false; const sp=Math.hypot(m.vx,m.vz);
      L.Input.press('interact'); L.sim(2); out.jump = { kmh: Math.round(sp*3.6), off: !p.veh, hp: Math.round(p.hp) };
      L.sim(90); out.motoCoast = +Math.hypot(m.vx,m.vz).toFixed(2);
      // (5) 걷는 사람은 차를 통과 못함
      p.hp=1e9; const cx=s.pos.x, cz=s.pos.z; p.pos.set(cx+Math.cos(yaw)*4, s.pos.y, cz-Math.sin(yaw)*4); p.yaw=Math.atan2(cx-p.pos.x, cz-p.pos.z);
      for(let f=0;f<60;f++){ L.Input.keys.KeyW=true; L.sim(1); } L.Input.keys.KeyW=false;
      const lx=(p.pos.x-cx)*Math.cos(yaw)+(p.pos.z-cz)*(-Math.sin(yaw)); out.block = { lateral: +lx.toFixed(2), halfW: L.VEH_TYPES.sedan.hw };
      return out; }""")
    for k,v in r.items(): print(k, v)
    print('errs', errs[:6])
    b.close()
