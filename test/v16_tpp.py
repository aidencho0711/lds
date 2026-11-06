# v16 3인칭 장전 동작: 훈련장 더미가 총을 들고 장전 → 옆(왼쪽 앞)에서 본 프레임
#  사용: python3 test/v16_tpp.py OUT ids empty|tac [fracs] [side: L|R|F]
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; ids = sys.argv[2].split(','); VAR = sys.argv[3] if len(sys.argv) > 3 else 'empty'
FR = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 and sys.argv[4] else [0.04, 0.18, 0.32, 0.46, 0.6, 0.74, 0.9]
SIDE = sys.argv[5] if len(sys.argv) > 5 else 'L'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'off', view:'fpp'})); }")
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("""(side)=>{ const L=__LD, p=L.G.player, T=L.Training.state, c=T.dummies[0];
      document.getElementById('hud').style.visibility='hidden'; document.getElementById('dummyTags').style.display='none';
      const X=-40, Z=140, y=L.fns.groundAt(X,Z,999);
      c.dummy.home={x:X,z:Z}; c.pos.set(X,y,Z); c.vel.set(0,0,0); c.yaw=c.bodyYaw=0; window.D=c;
      p.inv.weapons=[null,null,null]; p.inv.cur=-1; p.setVisibleGear();
      const cp = side==='R' ? [X-0.95, Z+0.62] : side==='F' ? [X+0.25, Z+1.5] : [X+0.95, Z+0.62];
      p.pos.set(cp[0], L.fns.groundAt(cp[0],cp[1],999), cp[1]); p.vel.set(0,0,0); p.stance='crouch';
      L.sim(15); const e={x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;return this;}}; p.eye(e); const tx=X+0.05, ty=y+1.28, tz=Z+0.32;
      p.yaw = Math.atan2(tx-e.x, tz-e.z); p.pitch=Math.atan2(ty-e.y, Math.hypot(tx-e.x, tz-e.z)); L.sim(2); }""", SIDE)
    info = {}
    for id in ids:
        pg.evaluate("""([id, v])=>{ const L=__LD, c=D, d=L.ITEMS[id], slot=d.slot==='secondary'?2:0;
          c.inv.weapons=[null,null,null]; c.inv.weapons[slot]=L.fns.newWeapon(id, d.mag); c.inv.cur=slot; c.inv.items={}; c.inv.items[d.ammo]=200; c.equipT=0; c.rl=null; c.cycle=null; c.setVisibleGear();
          L.sim(10); const w=c.weapon; w.mag = v==='empty' ? 0 : Math.max(1, Math.floor(d.mag/2)); c.fireCd=0; L.fns.startReload(c); }""", [id, VAR])
        tot = pg.evaluate("()=>D.rl ? D.rl.total : 0")
        t = 0.0
        for k, f in enumerate(FR):
            n = max(0, round((f * tot - t) * 60))
            pg.evaluate("(n)=>{ __LD.sim(n, 1/60); __LD.G.paused=true; }", n); t += n / 60
            pg.wait_for_timeout(200)
            pg.screenshot(path=f'{OUT}/t_{SIDE}_{VAR}_{id}_{k}.png', clip={'x': 200, 'y': 30, 'width': 560, 'height': 480})
            pg.evaluate("()=>{ __LD.G.paused=false; }")
        info[id] = [round(tot, 2), pg.evaluate("()=>{ __LD.sim(400, 1/60); return D.weapon.mag; }")]
    print(json.dumps(info))
    print('\n'.join(logs[:10]))
    b.close()
