# 팀전 밸런스 시뮬레이션: 플레이어는 무적 관찰자(별도 1인 팀), 봇 팀끼리 끝까지
import sys, time
from playwright.sync_api import sync_playwright
MAP = sys.argv[1] if len(sys.argv) > 1 else 'kalden'
SQ = sys.argv[2] if len(sys.argv) > 2 else 'squad'
BOTS = int(sys.argv[3]) if len(sys.argv) > 3 else 47
FLAG = sys.argv[4] if len(sys.argv) > 4 else ''
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':960,'height':540})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1000)
    pg.evaluate(f"()=>{{ localStorage.setItem('lastdrop.settings', JSON.stringify({{map:'{MAP}', bots:{BOTS}, difficulty:'normal', queue:'normal', squad:'{SQ}', quality:'low', shadows:'off'}})); }}")
    pg.reload(); pg.wait_for_timeout(1200)
    t0 = time.time()
    if FLAG == 'nointel': pg.evaluate("()=>{ __LD.G.noIntel = true; }")
    pg.evaluate("()=>{ const V=__LD.Veh, oe=V.enter; window.__rides={drive:0, pass:0, maxCrew:0}; V.enter=function(c,v,seat,po){ const r=oe.apply(this,arguments); if(r&&!c.isPlayer){ if(c.seat===0) __rides.drive++; else __rides.pass++; __rides.maxCrew=Math.max(__rides.maxCrew, v.seats.filter(Boolean).length); } return r; }; }")
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=300000)
    print('load', round(time.time() - t0, 1))
    pg.click('[data-ui=closeMap]')
    # 플레이어를 자기 팀에서 빼 1인 팀으로 (봇 팀만 남게)
    pg.evaluate("""()=>{ const G=__LD.G,p=G.player; const T0=G.teams[p.team]; T0.members.splice(T0.members.indexOf(p),1); T0.members.forEach((m,i)=>{m.slot=i; m.brain.followJump=false;});
       const lead=T0.members[0]; if(lead){ lead.brain.dropTarget={x:0,z:0}; lead.brain.jumpAt=20; lead.brain.chuteH=100; T0.members.forEach((m,i)=>{ m.brain.followJump=false; m.brain.dropTarget={x:rnd0(),z:rnd0()}; m.brain.jumpAt=20+i*0.4; }); }
       function rnd0(){ return (Math.random()-0.5)*30; }
       G.teams.push({id:G.teams.length, members:[p], place:0}); p.team=G.teams.length-1; p.slot=0; p.hp=1e9; }""")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<3000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } }""")
    print('teams', pg.evaluate("()=>({n:__LD.G.teams.length-1, size:__LD.G.teamSize})"))
    hist = []
    for step in range(120):
        r = pg.evaluate("""()=>{const L=__LD,G=L.G; const t0=performance.now(); L.sim(30*15,1/30); const ms=performance.now()-t0; const C=L.CHARS.filter(c=>!c.isPlayer);
          const bt=G.teams.filter(T=>!T.members.includes(G.player));
          const sp=bt.filter(T=>T.members.some(m=>m.alive)).map(T=>{const al=T.members.filter(m=>m.alive&&m.mode==='ground'); if(al.length<2) return 0; let mx=0; for(const a of al) for(const b of al) mx=Math.max(mx,Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)); return Math.round(mx);});
          return {t:Math.round(G.time), ms:Math.round(ms), alive:C.filter(c=>c.alive).length, knocked:C.filter(c=>c.alive&&c.knocked).length, teams:bt.filter(T=>T.members.some(m=>m.alive)).length,
           armed:C.filter(c=>c.alive&&c.inv.weapons.some(Boolean)).length, knocks:G.knockLog.length, revives:C.reduce((a,c)=>a+c.revives,0), spread:sp.sort((a,b)=>a-b), zone:[L.Zone.phase,Math.round(L.Zone.cur.r)], states:L.states()}}""")
        hist.append(r)
        if step % 2 == 0: print({k: r[k] for k in ('t','ms','alive','knocked','teams','armed','knocks','revives','spread','zone')})
        if r['teams'] <= 1: print('END', r); break
    print('causes', pg.evaluate("()=>{const m={}; for(const k of __LD.G.killLog){const key=(k.kn?'K:':'')+(['bleed','wipe','zone','fall','fist','frag','veh','vexp'].includes(k.cause)?k.cause:'gun'); m[key]=(m[key]||0)+1;} return m;}"))
    print('knock causes', pg.evaluate("()=>{const m={}; for(const k of __LD.G.knockLog){const key=['zone','fall','fist','frag','veh','vexp'].includes(k.cause)?k.cause:'gun'; m[key]=(m[key]||0)+1;} return m;}"))
    print('knocks', pg.evaluate("()=>__LD.G.knockLog.length"), 'revives', pg.evaluate("()=>__LD.CHARS.reduce((a,c)=>a+c.revives,0)"))
    print('places', pg.evaluate("()=>__LD.G.teams.map(t=>t.place)"))
    print('rides', pg.evaluate("()=>window.__rides"))
    print('\n'.join(logs[:20]))
    b.close()
