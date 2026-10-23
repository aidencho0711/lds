# 봇을 카메라 앞에 세워 정면에서 동작 확인: 줍기, 회복 4종, 투척(쥠·젖힘·던짐), 넘기, 공중, 구르기
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':900,'height':600})
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:3, difficulty:'easy', queue:'normal', squad:'solo', view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<60;i++){ L.sim(30); if(L.G.player.mode==='ground') break; } L.sim(10);
      const p=L.G.player; const bot=L.CHARS.find(c=>!c.isPlayer); window.B=bot; bot.brain.update=()=>{}; bot.mode='ground';
      // 평평한 곳
      let X=0,Z=0; for(let t=0;t<3000;t++){ const x=(Math.random()-0.5)*500, z=(Math.random()-0.5)*500, h=L.fns.heightAt(x,z); if(h<3) continue; let ok=true; for(let a=0;a<12&&ok;a++){ const dx=Math.cos(a)*7, dz=Math.sin(a)*7; if(Math.abs(L.fns.heightAt(x+dx,z+dz)-h)>0.2||Math.abs(L.fns.groundAt(x+dx,z+dz,h+5)-L.fns.heightAt(x+dx,z+dz))>0.01) ok=false; } if(ok){X=x;Z=z;break;} }
      window.XZ=[X,Z]; const y=L.fns.groundAt(X,Z,999); p.pos.set(X,y,Z); p.yaw=0; p.pitch=-0.1; p.vel.set(0,0,0); L.G.firstPerson=true; p.inv.cur=-1; p.setVisibleGear();
      bot.pos.set(X,y,Z+3.4); bot.yaw=Math.PI; bot.bodyYaw=Math.PI; bot.vel.set(0,0,0); bot.inv.weapons[0]=L.fns.newWeapon('m416',30); bot.inv.cur=0; bot.equipT=0; bot.setVisibleGear(); bot.hp=50;
      for(const c of L.CHARS) if(!c.isPlayer && c!==bot) c.pos.x+=900;
      L.sim(20); }""")
    def shot(name, js, frames):
        pg.evaluate("()=>{ const L=__LD,c=B; " + js + " }")
        # 봇 두뇌를 멈췄으므로 넘기 진행은 직접
        pg.evaluate(f"()=>{{ const L=__LD,c=B,y=c.pos.y; for(let i=0;i<{frames};i++){{ if(c.vault) L.fns.stepPhysics(c,1/30,0,0,0,false); L.sim(1); }} }}")
        pg.evaluate("()=>{ window.__LD.G.paused=true; }"); pg.wait_for_timeout(250)
        pg.screenshot(path=f'{OUT}/f_{name}.png', clip={'x':280,'y':60,'width':340,'height':480})
        pg.evaluate("()=>{ window.__LD.G.paused=false; }")
    shot('idle', '', 5)
    shot('pick', 'c.pickT=0.5;', 7)
    for hid, fr in (('bandage', 30), ('firstaid', 30), ('medkit', 30), ('drink', 30)):
        shot('heal_'+hid, f"c.heal=null; c.inv.add('{hid}',1); c.heal={{id:'{hid}',t:ITEMS_T('{hid}'),total:ITEMS_T('{hid}')}};".replace("ITEMS_T('%s')"%hid, "__LD.ITEMS['%s'].time"%hid), fr)
        pg.evaluate("()=>{ B.heal=null; __LD.sim(10); }")
    shot('nade_hold', "c.throwMode={type:'frag',pin:false,cook:0,armed:true};", 10)
    shot('nade_wind', "c.throwMode.pin=true;", 10)
    shot('nade_throw', "c.throwMode=null; c.throwAnim=0.35;", 4)
    pg.evaluate("()=>{ B.throwAnim=0; __LD.sim(10); }")
    # 넘기(옆에서 보이게 봇을 x 방향으로)
    shot('vault', """const y=c.pos.y; c.pos.set(XZ[0]-0.9,y,XZ[1]+3.6); c.yaw=-Math.PI/2; c.bodyYaw=c.yaw; c.onGround=true; c.vault={kind:'vault',t:0,dur:0.65,x0:c.pos.x,y0:y,z0:c.pos.z,x1:c.pos.x+1.6,y1:y,z1:c.pos.z,top:y+1.0,land:true,dx:1,dz:0};""", 9)
    pg.evaluate("()=>{ __LD.sim(30); }")
    shot('climb', """const y=c.pos.y; c.pos.set(XZ[0]-0.5,y,XZ[1]+3.6); c.onGround=true; c.vault={kind:'climb',t:0,dur:1.03,x0:c.pos.x,y0:y,z0:c.pos.z,x1:c.pos.x+0.8,y1:y+1.6,z1:c.pos.z,top:y+1.6,land:true,dx:1,dz:0};""", 14)
    pg.evaluate("()=>{ __LD.sim(30); B.pos.y=__LD.fns.groundAt(B.pos.x,B.pos.z,999); }")
    shot('air', """c.pos.set(XZ[0],c.pos.y+1.0,XZ[1]+3.6); c.onGround=false; c.vel.set(0,-6,0); c.airT=0.5; c.yaw=Math.PI; c.bodyYaw=Math.PI;""", 5)
    pg.evaluate("()=>{ const L=__LD; for(let i=0;i<60;i++){ L.sim(1); if(B.onGround) break; } }")
    shot('roll', """c.rollT=0.7; c.rollYaw=-Math.PI/2;""", 8)
    print('\n'.join(logs[:10]))
    b.close()
