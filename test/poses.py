# 새 캐릭터 동작 확인: 봇을 카메라 앞에 세우고 동작별로 3/4 정면에서 촬영
#  사용: python3 test/poses.py OUT [이름 필터(쉼표)]
import sys, os
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
ONLY = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 900, 'height': 600})
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:3, difficulty:'easy', queue:'normal', squad:'solo', view:'fpp', quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>document.getElementById('playBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ const b=document.querySelector('[data-ui=closeMap]'); if(b) b.click(); }")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<80;i++){ L.sim(30); if(L.G.player.mode==='ground') break; } L.sim(10);
      const p=L.G.player; const bots=L.CHARS.filter(c=>!c.isPlayer); window.B=bots[0]; window.B2=bots[1];
      for(const c of bots){ c.brain.update=()=>{}; c.mode='ground'; }
      let X=0,Z=0; for(let t=0;t<3000;t++){ const x=(Math.random()-0.5)*500, z=(Math.random()-0.5)*500, h=L.fns.heightAt(x,z); if(h<3) continue; let ok=true; for(let a=0;a<12&&ok;a++){ const dx=Math.cos(a)*8, dz=Math.sin(a)*8; if(Math.abs(L.fns.heightAt(x+dx,z+dz)-h)>0.15||Math.abs(L.fns.groundAt(x+dx,z+dz,h+5)-L.fns.heightAt(x+dx,z+dz))>0.01) ok=false; } if(ok && L.Veh.list.some(v=>Math.hypot(v.pos.x-x,v.pos.z-z)<14)) ok=false; if(ok){X=x;Z=z;break;} }
      window.XZ=[X,Z]; const y=L.fns.groundAt(X,Z,999); window.GY=y; p.pos.set(X,y,Z); p.yaw=0; p.pitch=-0.12; p.vel.set(0,0,0); L.G.firstPerson=true; p.inv.cur=-1; p.setVisibleGear();
      for(const c of L.CHARS) if(!c.isPlayer && c!==B && c!==B2) c.pos.x+=900; B2.pos.x+=900;
      window.RESET=()=>{ const c=B; c.alive=true; c.knocked=false; c.stance='stand'; c.vault=null; c.heal=null; c.throwMode=null; c.throwAnim=0; c.rollT=0; c.pickT=0; c.rl=null; c.cycle=null; c.aiming=false; c.sprint=false; c.revive=null; c.mode='ground'; c.onGround=true; c.airT=0; c.vel.set(0,0,0);
        c.inv.items={}; c.pos.set(XZ[0],GY,XZ[1]+2.5); c.yaw=Math.PI-(window.YAWOFF||0.55); c.bodyYaw=c.yaw; c.pitch=0; c.anim.dead=0; c.anim.land=0; c.inv.weapons[0]=L.fns.newWeapon('m416',30); c.inv.cur=0; c.equipT=0; c.setVisibleGear(); };
      RESET(); L.sim(20); }""")
    def airshot(name, js, frames, yaw=0.55):
        if ONLY and name not in ONLY: return
        pg.evaluate(f"()=>{{ window.YAWOFF={yaw}; RESET(); __LD.G.paused=true; const L=__LD,c=B; " + js + f" for(let i=0;i<{frames};i++){{ L.G.time+=1/30; L.fns.animateChar(c,1/30); }} }}")
        pg.wait_for_timeout(350)
        pg.screenshot(path=f'{OUT}/p_{name}.png', clip={'x': 250, 'y': 40, 'width': 400, 'height': 520})
        pg.evaluate("()=>{ window.__LD.G.paused=false; }")
    def shot(name, js, frames, move=None, each='', yaw=0.55):
        if ONLY and name not in ONLY: return
        pg.evaluate(f"()=>{{ window.YAWOFF={yaw}; RESET(); const L=__LD,c=B; " + js + " }")
        mv = move or [0, 0, 0]
        # move: 몸 기준 [옆, 앞] 방향 속도(m/s) — 제자리에서 걷는 '러닝머신' (위치는 고정, 속도만 줌)
        pg.evaluate(f"""()=>{{ const L=__LD,c=B,P=c.pos.clone(); for(let i=0;i<{frames};i++){{ if(c.vault || c.rollT>0) L.fns.stepPhysics(c,1/30,0,0,0,false);
           if({mv[2]}>0){{ const by=c.bodyYaw, sx={mv[0]}, sz={mv[1]}; c.vel.set((Math.cos(by)*sx+Math.sin(by)*sz)*{mv[2]},0,(-Math.sin(by)*sx+Math.cos(by)*sz)*{mv[2]}); c.onGround=true; c.moving=true; }}
           {each}
           L.sim(1); if({mv[2]}>0) c.pos.copy(P); }} }}""")
        pg.evaluate("()=>{ window.__LD.G.paused=true; }"); pg.wait_for_timeout(300)
        if os.environ.get('DBG'): print(name, pg.evaluate("()=>{ const c=B,a=c.anim,g=c.rig.gunObj; return {ready:+a.ready.toFixed(2), armed:+a.armed.toFixed(2), rl:c.rl&&c.rl.kind, t:c.rl&&+c.rl.t.toFixed(2), carry:+(a.carry||0).toFixed(2), spr:+(a.sprint||0).toFixed(2), gm:c.rig.gunMount.rotation.toArray().slice(0,3).map(v=>+v.toFixed(2)), butt:g&&g.userData.meta.buttZ, vis:c.rig.gunMount.visible}; }"))
        pg.screenshot(path=f'{OUT}/p_{name}.png', clip={'x': 250, 'y': 40, 'width': 400, 'height': 520})
        pg.evaluate("()=>{ window.__LD.G.paused=false; }")
    shot('idle', '', 8)
    shot('idle_side', '', 8, yaw=1.45)
    shot('aim', 'c.aiming=true;', 12)
    shot('aim_side', 'c.aiming=true;', 12, yaw=1.35)
    shot('reload_out', "c.weapon.mag=5; c.inv.add('a556',60); L.fns.startReload(c);", 18)
    shot('reload_pouch', "c.weapon.mag=5; c.inv.add('a556',60); L.fns.startReload(c);", 30)
    shot('reload_in', "c.weapon.mag=5; c.inv.add('a556',60); L.fns.startReload(c);", 36)
    shot('reload_charge', "c.weapon.mag=0; c.inv.add('a556',60); L.fns.startReload(c);", 55)
    shot('walk', "", 22, [0, 1, 1.5], yaw=1.4)
    shot('walk_f', "", 25, [0, 1, 1.5])
    shot('run', "", 22, [0, 1, 4.6], yaw=1.4)
    shot('sprint', "c.sprint=true;", 22, [0, 1, 6.2], yaw=1.4)
    shot('strafe', "c.aiming=true;", 22, [1, 0, 1.6], yaw=0.3)
    shot('backpedal', "c.aiming=true;", 24, [0, -1, 1.4], yaw=0.9)
    shot('crouch', "c.stance='crouch';", 20)
    shot('crouch_aim', "c.stance='crouch'; c.aiming=true;", 20)
    shot('prone', "c.stance='prone'; c.aiming=true; c.pos.x+=0.8;", 30, yaw=-1.57)
    shot('crawl', "c.stance='prone'; c.pos.x+=0.8;", 30, [0, 1, 1.0], yaw=-1.57)
    shot('pick', "c.pickT=0.5;", 7)
    shot('bandage', "c.inv.add('bandage',1); c.heal={id:'bandage',t:4,total:4};", 20)
    shot('drink', "c.inv.add('drink',1); c.heal={id:'drink',t:3,total:4};", 20)
    shot('medkit', "c.inv.add('medkit',1); c.heal={id:'medkit',t:6,total:8};", 20)
    shot('nade_hold', "c.throwMode={type:'frag',pin:false,cook:0,armed:true};", 12)
    shot('nade_wind', "c.throwMode={type:'frag',pin:true,cook:0,armed:true};", 12)
    shot('nade_throw', "c.throwAnim=0.35;", 4)
    shot('vault', "c.pos.set(XZ[0]-0.9,GY,XZ[1]+3.4); c.yaw=-Math.PI/2; c.bodyYaw=c.yaw; c.vault={kind:'vault',t:0,dur:0.65,x0:c.pos.x,y0:GY,z0:c.pos.z,x1:c.pos.x+1.6,y1:GY,z1:c.pos.z,top:GY+1.0,land:true,dx:1,dz:0,d0:0.5};", 8)
    shot('climb', "c.pos.set(XZ[0]-0.5,GY,XZ[1]+3.4); c.yaw=-Math.PI/2; c.bodyYaw=c.yaw; c.vault={kind:'climb',t:0,dur:1.03,x0:c.pos.x,y0:GY,z0:c.pos.z,x1:c.pos.x+0.8,y1:GY+1.6,z1:c.pos.z,top:GY+1.6,land:true,dx:1,dz:0,d0:0.4};", 12)
    shot('air', "c.pos.y+=1.0; c.onGround=false; c.vel.set(0,-6,0); c.airT=0.5;", 6)
    shot('roll', "c.rollT=0.7; c.rollYaw=-Math.PI/2;", 8)
    shot('knocked', "c.knocked=true; c.stance='prone'; c.inv.cur=-1; c.pos.x+=0.8;", 30, [0, 1, 0.9], yaw=-1.57)
    shot('dead', "c.alive=false; c.anim.dead=0;", 30)
    shot('pistol', "c.inv.weapons[0]=L.fns.newWeapon('p19',15); c.setVisibleGear(); c.aiming=true;", 12)
    shot('pistol_low', "c.inv.weapons[0]=L.fns.newWeapon('p19',15); c.setVisibleGear();", 12)
    shot('awm_bolt', "c.inv.weapons[0]=L.fns.newWeapon('awm',5); c.setVisibleGear(); c.aiming=true; c.cycle={kind:'bolt',t:0.45,ev:9,ejected:true,total:1.2};", 2)
    shot('m249_cover', "c.inv.weapons[0]=L.fns.newWeapon('m249',20); c.setVisibleGear(); c.inv.add('a556',200); L.fns.startReload(c);", 40)
    shot('s686_break', "c.inv.weapons[0]=L.fns.newWeapon('s686',0); c.setVisibleGear(); c.inv.add('a12',10); L.fns.startReload(c);", 22)
    airshot('skydive', "c.inv.cur=-1; c.setVisibleGear(); c.mode='fall'; c.pos.set(XZ[0],GY+0.6,XZ[1]+3.2); c.vel.set(0,-36,0); c.onGround=false;", 40, yaw=1.2)
    airshot('dive', "c.inv.cur=-1; c.setVisibleGear(); c.mode='fall'; c.pos.set(XZ[0],GY+0.6,XZ[1]+3.2); c.vel.set(0,-48,0); c.onGround=false;", 40, yaw=1.2)
    airshot('chute', "c.inv.cur=-1; c.setVisibleGear(); c.mode='chute'; c.pos.set(XZ[0],GY-2.6,XZ[1]+7.5); c.vel.set(0,-5.2,0); c.onGround=false;", 50)
    airshot('chute_turn', "c.inv.cur=-1; c.setVisibleGear(); c.mode='chute'; c.pos.set(XZ[0],GY-2.6,XZ[1]+7.5); c.vel.set(Math.cos(c.yaw)*3,-5.2,-Math.sin(c.yaw)*3); c.onGround=false;", 50)
    print('\n'.join(logs[:20]))
    b.close()
