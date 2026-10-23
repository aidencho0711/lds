# 2단계: 팀원 따라오기 거리, 핑 이동/공격/모여, 발견 공유, 집중 사격 우선순위
import sys, statistics
from playwright.sync_api import sync_playwright
OUT='/home/claude/br/test/shots/sq/'
MAP = sys.argv[1] if len(sys.argv) > 1 else 'kalden'
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
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{quality:'low', shadows:'off', bots:23, map:'{MAP}', squad:'squad', difficulty:'normal'}})); }}"); pg.reload(); pg.wait_for_timeout(1000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=200000)
    pg.evaluate("()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<4000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<5000 && !L.G.teams[0].members.every(m=>m.mode==='ground');i++) L.sim(1); L.G.player.hp=1e9; }")
    # 적 팀은 전부 멀리 치워 둔다(따라오기 측정 방해 방지) — 나중에 필요한 적만 불러옴
    pg.evaluate("()=>{ const G=__LD.G; for(const T of G.teams.slice(1)) for(const m of T.members){ m.pos.x+= (m.pos.x>0?1:-1)*600; m.brain.update=()=>{}; m.brain.think=()=>{}; } }")
    pg.evaluate("()=>{ const L=__LD; for(const m of L.G.teams[0].members) if(!m.isPlayer){ m.inv.weapons[0]=L.fns.newWeapon('m416',30); m.inv.items.a556=120; m.inv.cur=0; m.setVisibleGear(); } L.sim(30*5); }")  # 팀원 무장
    # 1) 따라오기: 60초 동안 걷기/달리기/방향 전환
    d = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,I=L.Input; const ds=[]; const st={};
       for(let s=0;s<60;s++){ I.keys.KeyW = s%20<14; I.keys.ShiftLeft = s%20<7; if(s%10===0) p.yaw += 1.2;
         L.sim(30); for(const m of G.teams[0].members) if(!m.isPlayer&&m.alive){ ds.push(Math.hypot(m.pos.x-p.pos.x,m.pos.z-p.pos.z)); st[m.brain.state]=(st[m.brain.state]||0)+1; } }
       I.keys.KeyW=false; I.keys.ShiftLeft=false; ds.sort((a,b)=>a-b); return {n:ds.length, med:Math.round(ds[ds.length>>1]), p90:Math.round(ds[Math.floor(ds.length*0.9)]), max:Math.round(ds[ds.length-1]), states:st}; }""")
    print('follow 60s', d)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'t2_follow.png')
    # 2) 핑 이동: 앞쪽 지면 ~35m
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; p.pitch=-0.09; L.sim(2); L.Input.press('ping'); L.sim(1); const o=G.teamOrder; return o? {kind:o.kind, dist:Math.round(Math.hypot(o.x-p.pos.x,o.z-p.pos.z))}:null; }""")
    print('ping move', r)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'t2_ping_move.png')
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,o=G.teamOrder; const out=[]; for(let s=0;s<25;s++){ L.sim(30); out.push(G.teams[0].members.filter(m=>!m.isPlayer&&m.alive).map(m=>Math.round(Math.hypot(m.pos.x-o.x,m.pos.z-o.z))).join('/')); } return {at:[out[4],out[9],out[14],out[24]], states:G.teams[0].members.filter(m=>!m.isPlayer).map(m=>m.brain.state), panel:document.querySelector('.tord').textContent}; }""")
    print('move progress (5/10/15/25s)', r)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'t2_ping_move_arrived.png')
    # 3) 길게 누르기 → 모여
    pg.evaluate("()=>{ __LD.Input.keys.KeyQ=true; __LD.Input.press('ping'); __LD.sim(1); }"); pg.wait_for_timeout(700)
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; L.sim(2); L.Input.keys.KeyQ=false; L.sim(1); const o=G.teamOrder; L.sim(30*15); return {order:o, dists:G.teams[0].members.filter(m=>!m.isPlayer&&m.alive).map(m=>Math.round(Math.hypot(m.pos.x-p.pos.x,m.pos.z-p.pos.z)))}; }""")
    print('hold ping → follow', r)
    # 4) 공격 지시: 적 1명(움직이지 않음)을 정면 55m에 세우고 핑
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const e=G.teams[1].members[0]; e.alive=true; e.hp=100; e.inv.gear.vest=null; e.inv.gear.helmet=null;
       let ok=false; for(let k=0;k<40&&!ok;k++){ const a=p.yaw+(k%2?1:-1)*k*0.08; const x=p.pos.x+Math.sin(a)*55, z=p.pos.z+Math.cos(a)*55; if(!L.Nav.isFree(x,z)) continue; const y=L.fns.groundAt(x,z,999);
         if(L.fns.losClear(p.pos.x,p.pos.y+1.6,p.pos.z,x,y+1.3,z)){ e.pos.set(x,y,z); e.vel.set(0,0,0); p.yaw=a; ok=true; } }
       if(!ok) return 'no spot'; const ey=e.pos.y+1.25, eye=p.pos.y+1.58; p.pitch=Math.atan2(ey-eye,55)+0.01; L.sim(2); L.Input.press('ping'); L.sim(1);
       window.__e=e; const o=G.teamOrder; return o?{kind:o.kind, target:o.target===e}:null; }""")
    print('ping attack', r)
    pg.wait_for_timeout(200); pg.screenshot(path=OUT+'t2_ping_attack.png')
    print('mates', pg.evaluate("()=>__LD.G.teams[0].members.filter(m=>!m.isPlayer).map(m=>[m.name, m.inv.weapons.filter(Boolean).map(w=>w.id+':'+w.mag+'/'+m.inv.count(__LD.ITEMS[w.id].ammo)).join(','), m.brain.state])"))
    pg.evaluate("""()=>{ const L=__LD,G=L.G,e=__e; window.__tr=[]; for(let t=0;t<12;t++){ L.sim(30); __tr.push(t+':'+G.teams[0].members.filter(m=>!m.isPlayer).map(m=>{const r=m.brain.aware.get(e); return m.brain.state+Math.round(Math.hypot(m.pos.x-e.pos.x,m.pos.z-e.pos.z))+(r?(r.visible?'V':'-'):'x')+(m.brain.investigate?m.brain.investigate.kind:'')}).join(' ')); } }""")
    print('\n'.join(pg.evaluate("()=>__tr")))
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,e=__e; let t=0; for(;t<40&&e.alive;t++) L.sim(30); return {killedIn:e.alive?null:t, order:G.teamOrder&&G.teamOrder.kind, toasts:[...document.querySelectorAll('#toasts .toast')].map(x=>x.textContent)}; }""")
    print('attack result', r)
    # 5) 발견 공유: 다른 적을 팀원 한 명 앞에 세우면 미니맵 표시·알림
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,m=G.teams[0].members.find(x=>!x.isPlayer&&x.alive), e=G.teams[1].members[1]; e.alive=true; e.hp=100;
       const a=m.yaw; e.pos.set(m.pos.x+Math.sin(a)*30, 0, m.pos.z+Math.cos(a)*30); e.pos.y=L.fns.groundAt(e.pos.x,e.pos.z,999); e.vel.set(0,0,0); m.brain.update=m.brain.update; 
       G.spotted.clear(); let got=null; for(let i=0;i<60 && !got;i++){ L.sim(1); if(G.spotted.has(e)) got=i; }
       const others=G.teams[0].members.filter(x=>!x.isPlayer&&x!==m&&x.alive).map(x=>{const r=x.brain.aware.get(e); return r? Math.round(G.time-r.heard):null;});
       return {spottedFrame:got, othersKnow:others, toasts:[...document.querySelectorAll('#toasts .toast')].map(x=>x.textContent)}; }""")
    print('spot share', r)
    # 6) 집중 사격: 두 적이 모두 보일 때 플레이어가 쏜 적을 우선
    r = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,m=G.teams[0].members.find(x=>!x.isPlayer&&x.alive), b=m.brain; const A=G.teams[2].members[0], B=G.teams[2].members[1];
       for(const [o,d] of [[A,20],[B,32]]){ o.alive=true; o.hp=100; o.pos.set(m.pos.x+d,m.pos.y,m.pos.z); }
       const mk=(o,d)=>({first:0,last:G.time,visible:true,x:o.pos.x,y:o.pos.y,z:o.pos.z,dist:d,react:0.1,heard:-99});
       b.aware.clear(); b.aware.set(A, mk(A,20)); b.aware.set(B, mk(B,32)); b.target=null; const before=b.pickTarget()===A?'A(가까운 적)':'B';
       p.lastTarget=B; p.lastTargetT=G.time; const after=b.pickTarget()===B?'B(플레이어가 쏜 적)':'A';
       return {before, after}; }""")
    print('focus fire', r)
    print('errs', errs[:3])
    b.close()
