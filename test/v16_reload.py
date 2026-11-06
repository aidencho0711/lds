# v16 장전 동작 프레임: 훈련장에서 총을 들고 장전 → 진행 비율마다 화면 저장
#  사용: python3 test/v16_reload.py OUT fpp|tpp ids empty|tac [fracs]
import sys, json
from playwright.sync_api import sync_playwright
OUT, VIEW = sys.argv[1], sys.argv[2]
ids = sys.argv[3].split(',')
VAR = sys.argv[4] if len(sys.argv) > 4 else 'empty'
FR = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else [0.04, 0.18, 0.32, 0.46, 0.6, 0.74, 0.9]
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
    pg.evaluate("(v)=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', view:v})); }", VIEW)
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ const L=__LD; L.sim(10); document.getElementById('hud').style.visibility='hidden'; }")
    info = {}
    for id in ids:
        pg.evaluate("""([id, v])=>{ const L=__LD, p=L.G.player, d=L.ITEMS[id], slot=d.slot==='secondary'?2:0;
          p.inv.weapons=[null,null,null]; p.inv.weapons[slot]=L.fns.newWeapon(id, d.mag); p.inv.cur=slot; p.inv.items={}; p.inv.items[d.ammo]=200; p.equipT=0; p.rl=null; p.cycle=null; p.setVisibleGear();
          p.yaw=Math.PI; p.pitch=-0.06; L.sim(12); L.G.paused=true;
          const w=p.weapon; w.mag = v==='empty' ? 0 : Math.max(1, Math.floor(d.mag/2)); p.fireCd=0; L.fns.startReload(p); }""", [id, VIEW and VAR])
        tot = pg.evaluate("()=>{ const r=__LD.G.player.rl; return r ? r.total : 0; }")
        info[id] = round(tot, 2)
        t = 0.0
        for k, f in enumerate(FR):
            tt = f * tot
            n = max(0, round((tt - t) * 60))
            pg.evaluate("(n)=>{ __LD.sim(n, 1/60); __LD.G.paused=true; }", n); t += n / 60
            pg.wait_for_timeout(200)
            pg.screenshot(path=f'{OUT}/r_{VIEW}_{VAR}_{id}_{k}.png')
        st = pg.evaluate("()=>{ const L=__LD, p=L.G.player; L.sim(400, 1/60); return { mag: p.weapon.mag, rl: !!p.rl, cyc: !!p.cycle }; }")
        info[id] = (info[id], st)
    print(json.dumps(info))
    print('\n'.join(logs[:10]))
    b.close()
