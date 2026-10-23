# 줍기·넘기·오르기·낙하·회복·투척·소리 방향 표시 기능 테스트 (PC 화면)
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
HELP = r"""
window.T = {
  addBox(x0,y0,z0,x1,y1,z1,col){ const L=__LD, W=L.W, CGN=Math.round(Math.sqrt(W.grid.length)), HALF=350; const b={x0,y0,z0,x1,y1,z1,soft:false,nav:false,_q:0,kind:'solid'}; W.boxes.push(b);
    for(let j=Math.floor((z0+HALF)/8)-1;j<=Math.floor((z1+HALF)/8)+1;j++) for(let i=Math.floor((x0+HALF)/8)-1;i<=Math.floor((x1+HALF)/8)+1;i++){ const k=j*CGN+i; if(Object.isFrozen(W.grid[k])) W.grid[k]=[]; W.grid[k].push(b); }
    const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0), new THREE.MeshLambertMaterial({color:col||0x8a7a66})); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); L.G.scene.add(m); return b; },
  // 플레이어를 평평한 곳(x,z)에 세우고 +z를 보게
  place(x,z,yaw){ const p=__LD.G.player, y=__LD.fns.groundAt(x,z,999); p.pos.set(x,y,z); p.vel.set(0,0,0); p.yaw=yaw||0; p.bodyYaw=p.yaw; p.pitch=-0.05; p.onGround=true; p.stance='stand'; p.vault=null; p.heal=null; p.throwMode=null; return y; },
  flat(){ // 지형이 평평하고 주변에 박스가 없는 지점 찾기
    const L=__LD, W=L.W; for(let t=0;t<4000;t++){ const x=(Math.random()-0.5)*500, z=(Math.random()-0.5)*500, h=L.fns.heightAt(x,z); if(h<3) continue; let ok=true; for(let a=0;a<8&&ok;a++){ const dx=Math.cos(a)*6, dz=Math.sin(a)*6; if(Math.abs(L.fns.heightAt(x+dx,z+dz)-h)>0.25) ok=false; if(Math.abs(L.fns.groundAt(x+dx,z+dz,h+5)-L.fns.heightAt(x+dx,z+dz))>0.01) ok=false; } if(ok) return [x,z]; } return null; },
};
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:6, difficulty:'easy', queue:'normal', squad:'solo', view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    pg.evaluate(HELP)
    pg.evaluate("""()=>{ const L=__LD; L.Audio.init(); for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<60;i++){ L.sim(30); if(L.G.player.mode==='ground') break; } L.sim(10); }""")
    pg.wait_for_function("()=>__LD.Audio.bankReady", timeout=60000)
    print('bank', pg.evaluate("()=>Object.keys(__LD.Audio._bank).filter(k=>/^(pk_|heal_|vault|land|roll|pin|spoon|nade)/.test(k)).length"))
    # 봇은 멀리 (방해 금지)
    pg.evaluate("()=>{ for(const c of __LD.CHARS) if(!c.isPlayer){ c.pos.x+=1000; } }")
    xz = pg.evaluate("()=>T.flat()"); print('flat', xz)
    X, Z = xz
    # ---- 1. 줍기: 종류별 ----
    res = pg.evaluate(f"""()=>{{ const L=__LD, p=L.G.player; T.place(({X}),({Z}),0); const out=[];
      for(const id of ['m416','a556','a12','bandage','firstaid','medkit','drink','vest2','helm2','bag2','x2','frag','p19']){{ const it=window.__spawn(id,p.pos.x+0.5,p.pos.z+0.5); const r=L.fns.doPickup(p,it); out.push(id+':'+(p.pickT>0?'anim':'-')); L.sim(20); }} return out; }}""")
    print('pickup', res)
    pg.evaluate("()=>{ const p=__LD.G.player; const it=window.__spawn('a762',p.pos.x+0.4,p.pos.z+0.6); __LD.fns.doPickup(p,it); __LD.sim(6); }")
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m01_pickup.png')
    # ---- 2. 넘기: 1.0m 높이·0.25m 두께 담 ----
    pg.evaluate(f"()=>{{ const y=T.place(({X}),({Z}),0); T.addBox(({X})-1.2,y,({Z})+0.75,({X})+1.2,y+1.0,({Z})+1.0,0x9a8a70); }}")
    r = pg.evaluate("()=>{ const p=__LD.G.player; const pl=__LD.fns.vaultPlan(p,0,1); return pl && {kind:pl.kind, top:+(pl.top-p.pos.y).toFixed(2), dur:+pl.dur.toFixed(2), land:pl.land}; }")
    print('vault plan', r)
    print('vault trace', pg.evaluate(f"()=>{{ const p=__LD.G.player, out=[]; __LD.Input.press('jump'); for(let i=0;i<9;i++){{ __LD.sim(1); out.push([+(p.pos.z-({Z})).toFixed(2), +(p.pos.y-__LD.fns.heightAt(p.pos.x,p.pos.z)).toFixed(2), p.vault?+p.vault.t.toFixed(2):null]); }} return out; }}"))
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m02_vault_mid.png')
    r = pg.evaluate(f"()=>{{ const p=__LD.G.player; const mid={{z:+(p.pos.z-({Z})).toFixed(2), y:+(p.pos.y-__LD.fns.heightAt(p.pos.x,p.pos.z)).toFixed(2), v:!!p.vault}}; __LD.sim(40); return {{mid, end:{{z:+(p.pos.z-({Z})).toFixed(2), onGround:p.onGround, vault:!!p.vault, hp:p.hp}}}}; }}")
    print('vault run', r)
    # 대각선·높은 벽은 안 됨
    pg.evaluate(f"()=>{{ const y=T.place(({X})+6,({Z}),0); T.addBox(({X})+4.8,y,({Z})+0.75,({X})+7.2,y+2.8,({Z})+1.0,0x777777); }}")
    print('tall wall plan', pg.evaluate("()=>__LD.fns.vaultPlan(__LD.G.player,0,1)"))
    # ---- 3. 오르기: 1.6m 높이·2m 깊이 상자 ----
    pg.evaluate(f"()=>{{ const y=T.place(({X})-6,({Z}),0); T.addBox(({X})-7.2,y,({Z})+0.75,({X})-4.8,y+1.6,({Z})+2.8,0x7a5c35); }}")
    print('climb plan', pg.evaluate("()=>{ const p=__LD.G.player, pl=__LD.fns.vaultPlan(p,0,1); return pl && {kind:pl.kind, h:+(pl.top-p.pos.y).toFixed(2), dur:+pl.dur.toFixed(2)}; }"))
    pg.evaluate("()=>{ __LD.Input.press('jump'); __LD.sim(14); }")
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m03_climb_mid.png')
    print('climb end', pg.evaluate(f"()=>{{ const p=__LD.G.player; __LD.sim(40); return {{dy:+(p.pos.y-__LD.fns.heightAt(p.pos.x,p.pos.z)).toFixed(2), z:+(p.pos.z-({Z})).toFixed(2), onGround:p.onGround}}; }}"))
    # ---- 4. 실제 집 창문 넘기 ----
    r = pg.evaluate("""()=>{ const L=__LD, W=L.W; const bs=W.boxes;
      // 창틀(높이 1.0, 두께 0.24, 폭 1.4) 찾기 → 위에 상인방이 있는 것
      for(const b of bs){ const h=b.y1-b.y0, tx=b.x1-b.x0, tz=b.z1-b.z0; if(Math.abs(h-1.0)>0.02) continue; const thin=Math.min(tx,tz), wide=Math.max(tx,tz); if(Math.abs(thin-0.24)>0.02||Math.abs(wide-1.4)>0.02) continue;
        const cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2; const ax= tx<tz ? 'x':'z';
        for(const s of [-1,1]){ const px= ax==='x'? cx+s*0.75 : cx, pz= ax==='z'? cz+s*0.75 : cz; const g=L.fns.groundAt(px,pz,b.y0+0.3); if(Math.abs(g-b.y0)>0.05) continue;
          const p=L.G.player; p.pos.set(px,g,pz); p.vel.set(0,0,0); p.onGround=true; p.stance='stand'; const dx= ax==='x'? -s:0, dz= ax==='z'? -s:0; p.yaw=Math.atan2(dx,dz); p.bodyYaw=p.yaw;
          const pl=L.fns.vaultPlan(p,dx,dz); if(pl && pl.kind==='vault'){ return {ok:true, px, pz, dx, dz, top:+(pl.top-g).toFixed(2), land:pl.land, inside: s}; } } }
      return {ok:false}; }""")
    print('window', r)
    if r.get('ok'):
        pg.evaluate("()=>{ __LD.Input.press('jump'); __LD.sim(8); }")
        pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m04_window.png')
        print('window end', pg.evaluate(f"()=>{{ const p=__LD.G.player; __LD.sim(45); return {{moved:+(Math.hypot(p.pos.x-({r['px']}),p.pos.z-({r['pz']}))).toFixed(2), onGround:p.onGround, hp:Math.round(p.hp)}}; }}"))
    # ---- 5. 낙하: 6.4m / 10m / 20m ----
    for hgt in (3.0, 6.4, 10, 20):
        out = pg.evaluate(f"""()=>{{ const L=__LD,p=L.G.player; const y=T.place(({X}),({Z})-5,0); p.hp=100; p.pos.y=y+{hgt}; p.onGround=false; p.vel.set(0,0,2.2); let air=0, roll=0, minY=0;
            for(let i=0;i<120;i++){{ L.sim(1); air=Math.max(air,p.anim.air||0); if(p.rollT>0) roll=1; if(p.onGround&&i>5) break; }}
            const land=p.anim.land; L.sim(30); return {{h:{hgt}, hp:Math.round(p.hp), air:+air.toFixed(2), roll, land:+land.toFixed(2), alive:p.alive}}; }}""")
        print('fall', out)
    pg.evaluate(f"""()=>{{ const L=__LD,p=L.G.player; const y=T.place(({X}),({Z})-5,0); p.hp=100; p.pos.y=y+12; p.onGround=false; p.vel.set(0,0,1.5); L.sim(16); }}""")
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m05_fall_air.png')
    pg.evaluate("()=>{ const L=__LD,p=L.G.player; for(let i=0;i<60;i++){ L.sim(1); if(p.onGround) break; } L.sim(7); }")
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m06_roll.png')
    # ---- 6. 회복 동작 ----
    for hid in ('bandage','firstaid','medkit','drink'):
        pg.evaluate(f"()=>{{ const L=__LD,p=L.G.player; T.place(({X})+3,({Z})-8,Math.PI*0.75); p.hp={'60' if hid!='medkit' else '50'}; p.inv.add('{hid}',2); L.fns.useConsumable(p,'{hid}'); L.sim(40); }}")
        pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m07_heal_{hid}.png')
        print('heal', hid, pg.evaluate("()=>{ const p=__LD.G.player; return {heal:p.heal&&p.heal.id, held:p.rig.heldKey, gunVis:p.rig.gunMount.visible} }"))
        pg.evaluate("()=>{ __LD.sim(30*9); }")
    # 1인칭 회복
    pg.evaluate(f"()=>{{ const L=__LD,p=L.G.player; L.G.firstPerson=true; T.place(({X})+3,({Z})-8,0); p.hp=60; L.fns.useConsumable(p,'bandage'); L.sim(30); }}")
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/m08_heal_fpp.png')
    pg.evaluate("()=>{ __LD.sim(30*4); __LD.G.firstPerson=false; }")
    # ---- 7. 투척: 궤적, 핀, 7초, 손에서 폭발 ----
    pg.evaluate(f"()=>{{ const L=__LD,p=L.G.player; T.place(({X}),({Z})-8,0); p.pitch=0.25; p.inv.add('frag',4); p.inv.add('smoke',2); L.Input.press('throw'); L.sim(10); }}")
    print('throw mode', pg.evaluate("()=>{ const p=__LD.G.player; return {tm:p.throwMode, held:p.rig.heldKey, gun:p.rig.gunMount.visible, fuse:!document.getElementById('fuseHud').hidden, fuseTxt:document.getElementById('fuseTxt').textContent} }"))
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m09_throw_ready.png')
    pg.evaluate("()=>{ __LD.Input.fire=true; __LD.sim(60); }")  # 2초 쿠킹
    print('cooking', pg.evaluate("()=>{ const p=__LD.G.player; return {pin:p.throwMode&&p.throwMode.pin, cook:p.throwMode&&+p.throwMode.cook.toFixed(2), num:document.getElementById('fuseNum').textContent, cls:document.getElementById('fuseHud').className} }"))
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/m10_throw_cook.png')
    pg.evaluate("()=>{ __LD.Input.fire=false; __LD.sim(2); }")
    r = pg.evaluate("""()=>{ const L=__LD; const pr=L.fns.PROJ.find(q=>q.owner===L.G.player); const f=pr?+(pr.fuse-pr.t).toFixed(2):null; let t=0; while(pr && L.fns.PROJ.includes(pr) && t<300){ L.sim(1); t++; } return {left:f, exploded_after:+(t/30).toFixed(2), anim:+L.G.player.throwAnim.toFixed(2)}; }""")
    print('thrown', r)
    # 예측 착지점과 실제 첫 착지점 비교
    r = pg.evaluate(f"""()=>{{ const L=__LD,p=L.G.player; T.place(({X}),({Z})-8,0.3); p.pitch=0.15; L.sim(2); L.fns.enterThrow(p,'smoke'); L.sim(3);
        const o=new THREE.Vector3(), d=new THREE.Vector3(); L.G.camera.getWorldDirection(d); p.eye(o); o.addScaledVector(d,0.5); const arr=new Float32Array(500*3); const pr=L.fns.ThrowViz.predict(o,d,17,arr);
        L.Input.fire=true; L.sim(1); L.Input.fire=false; L.sim(1); const q=L.fns.PROJ[L.fns.PROJ.length-1]; let land=null; for(let i=0;i<200;i++){{ const vy=q.vy; L.sim(1); if(vy<0&&q.vy>=0){{ land={{x:q.x,z:q.z}}; break; }} }}
        return {{pred:[+pr.x.toFixed(1),+pr.z.toFixed(1)], real: land&&[+land.x.toFixed(1),+land.z.toFixed(1)], err: land&&+Math.hypot(land.x-pr.x,land.z-pr.z).toFixed(2)}}; }}""")
    print('predict', r)
    pg.evaluate("()=>__LD.sim(30*4)")
    r = pg.evaluate(f"""()=>{{ const L=__LD,p=L.G.player; T.place(({X}),({Z})-8,0); p.hp=100; L.fns.enterThrow(p,'frag'); L.sim(2); L.Input.fire=true; L.sim(30*7+12); L.Input.fire=false; L.sim(5); return {{alive:p.alive, hp:Math.round(p.hp), tm:!!p.throwMode}}; }}""")
    print('cook too long', r)
    print('\n'.join(logs[:30]))
    b.close()
