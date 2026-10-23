# 3단계: 핑(한 번/두 번/길게), 팀원 동승·하차, 좌석 이동, 동승석 사격, 봇 동승자 사격
from playwright.sync_api import sync_playwright
OUT='/home/claude/br/test/shots/sq/'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:23, map:'kalden', squad:'squad', difficulty:'normal'})); }"); pg.reload(); pg.wait_for_timeout(1000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=200000)
    pg.evaluate("()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<4000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<5000 && !L.G.teams[0].members.every(m=>m.mode==='ground');i++) L.sim(1); L.G.player.hp=1e9; }")
    pg.evaluate("()=>{ const G=__LD.G; for(const T of G.teams.slice(1)) for(const m of T.members){ m.pos.x+=(m.pos.x>0?1:-1)*600; m.brain.update=()=>{}; m.brain.think=()=>{}; } const L=__LD; for(const m of G.teams[0].members){ m.inv.weapons[0]=L.fns.newWeapon('m416',30); m.inv.items.a556=150; m.inv.cur=0; m.setVisibleGear(); } L.sim(30*3); }")
    # --- 핑 ---
    r = pg.evaluate("()=>{ const L=__LD,G=L.G,p=G.player; p.pitch=-0.1; L.sim(2); L.playerPing(p); L.sim(1); return G.teamOrder&&G.teamOrder.kind; }")
    print('single ping →', r)
    pg.wait_for_timeout(500)
    r = pg.evaluate("()=>{ const L=__LD,G=L.G,p=G.player; L.playerPing(p); L.sim(1); L.playerPing(p); L.sim(1); return {order:G.teamOrder&&G.teamOrder.kind, danger:!!G.danger}; }")
    print('double ping → (order restored, danger)', r)
    r = pg.evaluate("()=>{ const L=__LD,G=L.G; L.sim(30*6); return G.teams[0].members.filter(m=>!m.isPlayer).map(m=>m.brain.state+'/'+m.stance); }")
    print('mates after danger 6s', r)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'v3_danger.png')
    pg.evaluate("()=>{ __LD.Input.keys.KeyQ=true; __LD.Input.press('ping'); __LD.sim(1); }"); pg.wait_for_timeout(750); pg.evaluate("()=>{ __LD.sim(2); __LD.Input.keys.KeyQ=false; __LD.sim(1); }")
    print('hold Q → order', pg.evaluate("()=>__LD.G.teamOrder"), 'toasts', pg.evaluate("()=>[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent)"))
    # --- 차량 ---
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; G.danger=null; const r=L.W.roads.slice().sort((a,b)=>b.len-a.len)[0];
       const v=L.Veh.make('uaz', r.ax+r.dx*40, r.az+r.dz*40, Math.atan2(r.dx,r.dz)); window.__v=v;
       p.pos.set(v.pos.x+Math.cos(v.yaw)*2.2, v.pos.y, v.pos.z-Math.sin(v.yaw)*2.2); for(const m of G.teams[0].members) if(!m.isPlayer){ m.pos.set(p.pos.x+(Math.random()-0.5)*20, p.pos.y, p.pos.z+(Math.random()-0.5)*20); m.pos.y=L.fns.groundAt(m.pos.x,m.pos.z,999); }
       L.sim(3); const dbg={near:!!L.Veh.nearestEnterable(p), km:!!L.nearestKnockedMate(p,1.9), knocked:G.teams[0].members.map(m=>m.knocked), modal:L.HUD.modalOpen(), mode:p.mode, alive:p.alive, dy:(p.pos.y-v.pos.y).toFixed(2)};
       L.Input.press('interact'); L.sim(2); return {inVeh:!!p.veh, seat:p.seat, dbg}; }""")
    print('player enter', r)
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,v=__v; let t=0; for(;t<20;t++){ L.sim(30); if(v.seats.every(Boolean)) break; } return {sec:t+1, seats:v.seats.map(s=>s?s.name:'-'), states:G.teams[0].members.filter(m=>!m.isPlayer).map(m=>m.brain.state)}; }""")
    print('mates boarding', r)
    pg.wait_for_timeout(300); pg.screenshot(path=OUT+'v3_boarded.png')
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,v=__v; L.Input.keys.KeyW=true; L.sim(30*6); L.Input.keys.KeyW=false; return {kmh:Math.round(Math.hypot(v.vx,v.vz)*3.6), seats:v.seats.map(s=>s?s.name:'-')}; }""")
    print('drive 6s', r)
    pg.wait_for_timeout(300); pg.screenshot(path=OUT+'v3_driving.png')
    pg.evaluate("""()=>{ window.__place=(e, from, d)=>{ const L=__LD; const eye=new THREE.Vector3(); from.eye(eye);
       for(let k=0;k<72;k++){ const a=k/72*6.283; const x=from.pos.x+Math.sin(a)*d, z=from.pos.z+Math.cos(a)*d; if(!L.Nav.isFree(x,z)) continue; const y=L.fns.groundAt(x,z,999);
         if(L.fns.losClear(eye.x,eye.y,eye.z,x,y+1.3,z,from.veh)){ e.pos.set(x,y,z); e.vel.set(0,0,0); return true; } } return false; }; }""")
    # 동승자 봇이 적을 쏘는지: 움직이지 않는 적을 차 옆 25m에
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,v=__v; L.Input.keys.KeyS=true; L.sim(30*3); L.Input.keys.KeyS=false; L.sim(30*2);
       const e=G.teams[1].members[0]; e.alive=true; e.hp=100; e.inv.gear.vest=null; e.inv.gear.helmet=null; const placed=__place(e, v.seats[1], 22); if(!placed) return 'no spot';
       const tr=[]; let t=0; for(;t<15&&e.alive;t++){ L.sim(30); tr.push(v.seats.slice(1).map(m=>{ if(!m) return '-'; const r=m.brain.aware.get(e); return (r?(r.visible?'V':'-')+(G.time-r.first).toFixed(1)+'/'+r.react.toFixed(2):'x')+':'+(m.weapon?m.weapon.mag:'nw')+(m.rl?'R':'')+':'+Math.round(m.yaw*57)+'/'+Math.round(Math.atan2(e.pos.x-m.pos.x,e.pos.z-m.pos.z)*57); }).join(' ')+' hp'+Math.round(e.hp)); } window.__tr=tr; return {trace:tr.slice(0,6), killedIn:e.alive?null:t+1, enemyHp:Math.round(e.hp), riders:v.seats.map(s=>s?(s.name+':'+(s.brain?s.brain.state:'P')):'-')}; }""")
    print('passenger bots vs enemy', r)
    # 좌석 이동 + 동승석 사격
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,v=__v; for(const m of G.teams[0].members) if(m.brain){ m.brain.update=()=>{}; m.brain.think=()=>{}; } const ex=v.seats.slice(1).find(Boolean); if(ex) L.Veh.exit(ex,true,true); L.sim(2); L.Input.press('crouch'); L.sim(2); const seat=p.seat;
       const e=G.teams[1].members[1]; e.alive=true; e.hp=100; e.inv.gear.vest=null; e.inv.gear.helmet=null; if(!__place(e, p, 15)) return 'no spot';
       for(const m of G.teams[0].members) if(m.brain){ m.brain.update=()=>{}; m.brain.think=()=>{}; }
       p.yaw=Math.atan2(e.pos.x-p.pos.x, e.pos.z-p.pos.z); const eye=new THREE.Vector3(); p.eye(eye); p.pitch=Math.atan2(e.pos.y+1.2-eye.y, Math.hypot(e.pos.x-eye.x,e.pos.z-eye.z));
       L.sim(3); const cam=G.camera, d=new THREE.Vector3(); cam.getWorldDirection(d); const h=L.fns.raycastAll(cam.position.x,cam.position.y,cam.position.z,d.x,d.y,d.z,600,p);
       const dbg={camType:h.type, camT:h.t&&h.t.toFixed(1), hitChar:h.char&&h.char.name, camPos:[cam.position.x-p.pos.x, cam.position.y-p.pos.y, cam.position.z-p.pos.z].map(v=>v.toFixed(1)), eDist:Math.hypot(e.pos.x-p.pos.x,e.pos.z-p.pos.z).toFixed(1)};
       const hp0=e.hp; L.Input.fire=true; L.sim(20); L.Input.fire=false; L.sim(2); return {dbg, seat, isDriver:v.driver===p, cls:document.body.className, enemyHpLoss:Math.round(hp0-e.hp), ammo:p.weapon&&p.weapon.mag}; }""")
    print('switch seat + passenger fire', r)
    pg.wait_for_timeout(300); pg.screenshot(path=OUT+'v3_passenger.png')
    r = pg.evaluate("()=>{ const L=__LD,G=L.G,p=G.player; for(const m of G.teams[0].members) if(m.brain){ delete m.brain.update; delete m.brain.think; } L.Input.press('interact'); L.sim(2); L.sim(30*5); return {pVeh:!!p.veh, mates:G.teams[0].members.filter(m=>!m.isPlayer).map(m=>(m.veh?'IN':'out')+':'+m.brain.state)}; }")
    print('player exit → mates', r)
    print('errs', errs[:3])
    b.close()
