# 재현: 시점 손가락을 끄는 중에 사격 버튼을 누르면 조준이 튀는지 (멀티터치, 합성 PointerEvent)
from playwright.sync_api import sync_playwright
import json
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route)
    pg.on('pageerror', lambda e: print('ERR', e))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:8, view:'fpp'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    res = pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; p.inWater=false; p.inv.weapons[0]=L.fns.newWeapon('vk9',30); p.inv.cur=0; p.inv.items={a9:90}; p.setVisibleGear(); L.sim(30);
      const ev=(t,el,x,y,id)=>el.dispatchEvent(new PointerEvent(t,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true,isPrimary:id===21}));
      const zone=document.getElementById('touchLayer'); const deg=r=>+(r*180/Math.PI).toFixed(2);
      const out={}; const snap=()=>({yaw:p.yaw,pitch:p.pitch});
      const step=(name, fn)=>{ const a=snap(); fn(); L.sim(1); const b2=snap(); out[name]={dYaw:deg(b2.yaw-a.yaw), dPitch:deg(b2.pitch-a.pitch)}; };
      // 시점 손가락(오른쪽)
      ev('pointerdown',zone,640,240,21); L.sim(1);
      step('look +10px', ()=>ev('pointermove',zone,650,240,21));
      for (const id of ['tb_fire2','tb_fire']) {
        const fb=document.getElementById(id); const r=fb.getBoundingClientRect(); const fx=r.left+r.width/2, fy=r.top+r.height/2;
        step(id+' down', ()=>ev('pointerdown',fb,fx,fy,22));
        step('look +10px while '+id+' held', ()=>ev('pointermove',zone,660,240,21));
        step(id+' finger +2px', ()=>ev('pointermove',fb,fx+2,fy,22));
        step('look +10px again', ()=>ev('pointermove',zone,670,240,21));
        ev('pointerup',fb,fx+2,fy,22); L.sim(1);
        ev('pointermove',zone,650,240,21); L.sim(1);
      }
      ev('pointerup',zone,650,240,21);
      // 손가락 이동 없이 사격만 1초: 반동으로 인한 조준 이동량
      for (const ads of [false,true]) { p.weapon.mag=30; L.Input.aimToggle=ads; L.sim(40); const fb=document.getElementById('tb_fire2'); const r=fb.getBoundingClientRect();
        const a=snap(); const s0=L.G.stats.shots; ev('pointerdown',fb,r.left+20,r.top+20,23); L.sim(60); ev('pointerup',fb,r.left+20,r.top+20,23); const b2=snap();
        out['burst 1s '+(ads?'ADS':'hip')]={shots:L.G.stats.shots-s0, dYaw:deg(b2.yaw-a.yaw), dPitch:deg(b2.pitch-a.pitch)}; L.sim(60); out['after 1s rest '+(ads?'ADS':'hip')]={dPitch:deg(p.pitch-a.pitch)}; }
      L.Input.aimToggle=false;
      return out; }""")
    for k,v in res.items(): print(f'{k:36s} {v}')
    b.close()
