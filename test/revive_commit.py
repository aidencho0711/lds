# 부활 진행 중 적 등장/피격 시 계속하는지: 봇 A가 기절한 B를 부활, 움직이지 않는 적 E를 거리·시점별로 배치
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
SETUP = """(cfg)=>{ const L=__LD,G=L.G,C=L.CHARS; const A=G.teams[1].members[0], B=G.teams[1].members[1], E=G.teams[2].members[0];
  // 나머지는 모두 탈락, A·B·E만 남김. E와 B는 움직이지 않음
  for(const c of C) if(c!==A&&c!==B&&c!==E&&!c.isPlayer){ c.alive=false; c.root.visible=false; }
  for(const c of [A,B,E]){ c.alive=true; c.knocked=false; c.hp=100; c.revive=null; c.revivedBy=null; c.mode='ground'; c.veh=null; }
  E.brain.update=()=>{}; E.brain.think=()=>{};
  // 탁 트인 곳 찾기: A–E 사이 시야가 열리는 지점
  let ok=false, base=null, dir=null;
  for(let k=0;k<400 && !ok;k++){ const q=L.Nav.randomFreeNear((Math.random()-0.5)*500,(Math.random()-0.5)*500,40); if(!q) continue; const a=Math.random()*6.28; const dx=Math.sin(a), dz=Math.cos(a);
    const ex=q[0]+dx*(cfg.d+1.4), ez=q[1]+dz*(cfg.d+1.4); if(!L.Nav.isFree(ex,ez)||!L.Nav.isFree(q[0]+dx*1.4,q[1]+dz*1.4)) continue;
    const y0=L.fns.groundAt(q[0],q[1],999), y1=L.fns.groundAt(ex,ez,999); if(Math.abs(y0-y1)>3) continue;
    if(L.fns.losClear(q[0],y0+1.5,q[1],ex,y1+1.3,ez)){ ok=true; base=q; dir=[dx,dz]; } }
  if(!ok) return 'no spot';
  const gy=(x,z)=>L.fns.groundAt(x,z,999);
  A.pos.set(base[0],gy(base[0],base[1]),base[1]); B.pos.set(base[0]+dir[0]*1.3,0,base[1]+dir[1]*1.3); B.pos.y=gy(B.pos.x,B.pos.z);
  E.pos.set(base[0]+dir[0]*(cfg.d+1.4),0,base[1]+dir[1]*(cfg.d+1.4)); E.pos.y=gy(E.pos.x,E.pos.z); E.yaw=Math.atan2(-dir[0],-dir[1]);
  E.root.visible=!cfg.hidden; window.__E=E; window.__A=A; window.__B=B; window.__dir=dir; window.__base=base;
  if(cfg.hidden){ E.pos.y-=50; }
  for(const c of [A,B,E]) c.vel.set(0,0,0);
  delete A.inv.items.smoke; delete A.inv.items.frag; // 연막·수류탄 없음
  L.knockChar(B, E, 'm416'); B.brain.crawlGoal=null;
  A.yaw=Math.atan2(dir[0],dir[1]); A.brain.aware.clear(); A.brain.reviveTgt=B; A.brain.setState('REVIVE'); A.lastDamageT=-99;
  L.startRevive(A,B); return 'ok';
}"""
CASES0 = [
  ('적 40m, 처음부터 보임', {'d':40}, None),
  ('적 15m, 처음부터 보임', {'d':15}, None),
  ('적 15m, 7초째 등장(3초 남음)', {'d':15,'hidden':True}, 7),
  ('적 15m, 4초째 등장(6초 남음)', {'d':15,'hidden':True,'trace':True}, 4),
  ('7초째부터 계속 피격(3초 남음)', {'d':60,'hidden':True,'shoot':True}, 7),
  ('2초째부터 계속 피격(8초 남음)', {'d':60,'hidden':True,'shoot':True}, 2),
]
import sys
CASES = [c for c in CASES0 if len(sys.argv) < 2 or sys.argv[1] in c[0]]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':960,'height':540}); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:11, map:'kalden', squad:'squad'})); }"); pg.reload(); pg.wait_for_timeout(1000)
    for name, cfg, at in CASES:
        pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
        pg.evaluate("()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<3000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<4000 && L.CHARS.some(c=>c.mode!=='ground');i++) L.sim(1); L.G.player.hp=1e9; L.G.player.pos.y+=0; }")
        r = pg.evaluate(SETUP, cfg)
        if r != 'ok': print(name, r); continue
        out = pg.evaluate("""([at,cfg])=>{ const L=__LD,A=__A,B=__B,E=__E; let t=0, cancelT=null;
          for(let i=0;i<30*25;i++){ t=i/30;
            if(at!==null && Math.abs(t-at)<1e-6){ if(cfg.hidden && !cfg.shoot){ E.pos.y=L.fns.groundAt(E.pos.x,E.pos.z,999); E.root.visible=true; } }
            if(cfg.shoot && at!==null && t>=at && i%15===0 && A.alive && !A.knocked) L.fns.applyDamage(A,4,'body',E,'m416');
            L.sim(1,1/30);
            if(cancelT===null && !A.revive && B.knocked) cancelT=t.toFixed(1);
            if(cfg.trace && i%15===0){ const r=A.brain.aware.get(E); (window.__tr=window.__tr||[]).push(t.toFixed(1)+':'+A.brain.state+(r?(r.visible?'V':'-')+Math.round(r.dist||0):'x')+(A.revive?'R':'')); }
            if(!B.knocked) break; }
          return {revived:!B.knocked, at:t.toFixed(1), cancelledAt:cancelT, Eh:Math.round(E.hp), Ealive:E.alive, Astate:A.brain.state, Ahp:Math.round(A.hp), sawE: !!(A.brain.aware.get(E)&&A.brain.aware.get(E).visible)}; }""", [at, cfg])
        print(f'{name:28s}', out)
        if cfg.get('trace'): print(pg.evaluate("()=>(window.__tr||[]).join(' ')"))
        pg.evaluate("()=>__LD.G.ui('quit')"); pg.wait_for_timeout(200)
    print('errs', errs[:3])
    b.close()
