# 훈련장: 로딩, 더미 피해·방어구 파손/복구, 처치·부활, 무기고 재배치, 탄약 보충, 차량 재배치, 플레이어 부활
import sys, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
MOB = VW < 1000
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width':VW,'height':VH}, has_touch=MOB, is_mobile=MOB)
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:20, quality:'low', shadows:'off', view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/t00_lobby.png')
    t0 = time.time(); pg.click('#trainBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    print('load', round(time.time()-t0, 1), 's')
    print('state', pg.evaluate("()=>{const L=__LD,G=L.G,p=G.player; return {training:G.training, chars:L.CHARS.length, dummies:L.CHARS.filter(c=>c.dummy).length, items:L.fns.GROUND.filter(i=>i.alive).length, veh:L.Veh.list.map(v=>v.type).join(','), pos:[Math.round(p.pos.x),Math.round(p.pos.y),Math.round(p.pos.z)], mode:p.mode, cls:document.body.className, zone:document.getElementById('zoneInfo').textContent}}"))
    pg.evaluate("()=>__LD.sim(10)"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/t01_spawn.png')
    # 무기고: 가까운 총 줍기 → 재배치 확인
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const it=L.fns.GROUND.find(i=>i.alive&&i.id==='m416'); p.pos.set(it.x, p.pos.y, it.z-1.2); L.sim(3); const ok=L.fns.doPickup(p,it); L.sim(3);
        const before=!it.alive; L.sim(30*3.2); const again=L.fns.GROUND.some(i=>i.alive&&i.id==='m416'&&Math.hypot(i.x-it.x,i.z-it.z)<0.1);
        const x4=L.fns.GROUND.find(i=>i.alive&&i.id==='x4'); L.fns.doPickup(p,x4); L.sim(3);
        return {weapon:p.weapon&&p.weapon.id, mag:p.weapon&&p.weapon.mag, scope:p.weapon&&p.weapon.att.scope, taken:before, respawned:again, ammo:p.inv.count('a556')}; }""")
    print('armory', r)
    # 근거리 더미: Lv0~3 에 M416 몸통/머리 사격 (방어구 피해 확인)
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const ds=L.CHARS.filter(c=>c.dummy&&c.dummy.home.z===105).sort((a,b)=>a.pos.x-b.pos.x); const out=[];
        for(const d of ds){ const hp0=d.hp; const a=L.fns.applyDamage(d, 31, 'body', p, 'm416', d.pos.x, d.pos.y+1.3, d.pos.z); const b=L.fns.applyDamage(d, 31, 'head', p, 'm416', d.pos.x, d.pos.y+1.7, d.pos.z);
          out.push({lvl:d.dummy.lvl, body:Math.round(a), head:Math.round(b), hp:Math.round(d.hp), helm:d.inv.gear.helmet&&Math.round(d.inv.gear.helmet.dur), vest:d.inv.gear.vest&&Math.round(d.inv.gear.vest.dur)}); }
        return out; }""")
    print('armor dmg', r)
    # 실제 사격: 사격선에서 Lv2 더미 정조준 연사 → 처치까지 발 수
    pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const d=L.CHARS.find(c=>c.dummy&&c.dummy.lvl===2&&c.dummy.home.z===105); window.__d=d; p.pos.set(d.pos.x, L.fns.groundAt(d.pos.x,120,999), 120); p.vel.set(0,0,0); p.yaw=Math.PI; p.pitch=0; L.sim(30*5); }""")
    pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,d=__d; const ey=p.pos.y+1.64, ty=d.pos.y+1.25; p.pitch=Math.atan2(ty-ey, Math.abs(p.pos.z-d.pos.z)); L.Input.aim=true; L.sim(12); }""")
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/t02_ads.png')
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,d=__d; const shots0=G.stats.shots; let n=0; L.Input.fire=true; for(let i=0;i<60&&d.alive;i++){ L.sim(1); } L.Input.fire=false; L.sim(2);
        return {down:!d.alive, shots:G.stats.shots-shots0, last:d.dummy.last, vest:d.inv.gear.vest?Math.round(d.inv.gear.vest.dur):'broken', tags:document.querySelectorAll('#dummyTags .dtag:not([hidden])').length, nums:document.querySelectorAll('#dmgNums .dnum').length}; }""")
    print('fire to kill', r)
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/t03_kill.png')
    pg.evaluate("()=>{ __LD.Input.aim=false; __LD.sim(30*3); }")
    print('after down', pg.evaluate("()=>({alive:__d.alive, hp:__d.hp, vest:__d.inv.gear.vest&&__d.inv.gear.vest.dur})"))
    # 방어구 파손 → 5초 뒤 복구 (Lv1 헬멧: 머리 여러 발)
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const d=L.CHARS.find(c=>c.dummy&&c.dummy.lvl===1&&c.dummy.home.z===105); let k=0; while(d.inv.gear.helmet&&k<20){ L.fns.applyDamage(d, 20, 'head', p, 'm416'); if(!d.alive) break; k++; }
        const broke=!d.inv.gear.helmet; const t=[]; for(let i=0;i<8;i++){ L.sim(30); t.push(d.inv.gear.helmet?'H':'-'); } return {broke, alive:d.alive, timeline:t.join('')}; }""")
    print('helmet break/restore', r)
    # 장거리 300m 더미에 탄도·정조준 표시
    pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const d=L.CHARS.find(c=>c.dummy&&c.dummy.home.z===-180); window.__f=d; p.pos.set(d.pos.x, L.fns.groundAt(d.pos.x,120,999), 120); p.yaw=Math.PI; const ey=p.pos.y+1.64; p.pitch=Math.atan2(d.pos.y+1.3-ey, 300); L.Input.aim=true; L.sim(20); }""")
    pg.wait_for_timeout(250); pg.screenshot(path=f'{OUT}/t04_far.png')
    print('far dummy', pg.evaluate("()=>({visible:__f.root.visible, tag:!!(__f.dummy.tag&&!__f.dummy.tag.hidden), fog:__LD.G.scene.fog.far, camFar:__LD.G.camera.far})"))
    pg.evaluate("()=>{ __LD.Input.aim=false; __LD.sim(5); }")
    # 이동 표적이 움직이는지
    print('moving', pg.evaluate("()=>{ const L=__LD; const m=L.CHARS.filter(c=>c.dummy&&c.dummy.move); const a=m.map(c=>c.pos.x); L.sim(30); return m.map((c,i)=>+(c.pos.x-a[i]).toFixed(2)); }"))
    # 차량: 하나 타고 멀리 버린 뒤 재배치 / 파괴 후 재배치
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,V=L.Veh; const s=L.Training.state.park[2]; const v=s.v; v.pos.x+=40; L.sim(30*30); const moved=s.v!==v; const back=Math.hypot(s.v.pos.x-s.x,s.v.pos.z-s.z);
        const v2=L.Training.state.park[0].v; V.damage(v2, 99999, null, 'test'); L.sim(30*13); const s0=L.Training.state.park[0]; return {abandonedRespawn:moved, atSlot:+back.toFixed(2), destroyedRespawn: s0.v!==v2 && !s0.v.dead, count:V.list.length}; }""")
    print('vehicles', r)
    # 플레이어 쓰러짐 → 3초 뒤 부활 (소지품 유지)
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const w=p.weapon&&p.weapon.id; L.fns.applyDamage(p, 500, 'blast', p, 'frag'); const a=p.alive; L.sim(30*3.5); return {downAlive:a, alive:p.alive, hp:p.hp, weapon:p.weapon&&p.weapon.id, kept:w, over:G.over, state:G.state}; }""")
    print('player down', r)
    # 자기 수류탄으로 벽 너머 더미
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const ds=L.CHARS.filter(c=>c.dummy&&c.dummy.home.z===80); const hp0=ds.map(d=>d.hp); const pr={type:'frag', owner:p, x:ds[0].pos.x+1.5, y:ds[0].pos.y+0.1, z:ds[0].pos.z, vx:0,vy:0,vz:0,t:0,fuse:0.05,mesh:new THREE.Object3D()}; G.scene.add(pr.mesh); L.fns.PROJ.push(pr); L.sim(5); return ds.map((d,i)=>Math.round(hp0[i]-d.hp)+(d.alive?'':'(down)')); }""")
    print('grenade over wall', r)
    # 메뉴 → 나가기 → 로비
    pg.evaluate("()=>{ __LD.G.pause(true); }"); pg.wait_for_timeout(200)
    print('quit label', pg.evaluate("()=>document.getElementById('quitBtn').textContent"))
    pg.click('#quitBtn'); pg.wait_for_timeout(600)
    print('back to lobby', pg.evaluate("()=>({state:__LD.G.state, training:__LD.G.training, cls:document.body.className, matches:JSON.parse(localStorage.getItem('lastdrop.stats')||'{}').matches||0})"))
    print('\n'.join(logs[:20]))
    b.close()
