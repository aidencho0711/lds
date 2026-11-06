# 1인칭 장전 화면 조정 실험: 같은 장전 순간을 여러 보정값으로 렌더
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; GUN = sys.argv[2]; FR = [float(x) for x in sys.argv[3].split(',')]; SETS = json.loads(sys.argv[4])
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540}); pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'off', view:'fpp', look:{gloves:'gloves_tac_coyote'}})); localStorage.setItem('lastdrop.stats', JSON.stringify({matches:0,xp:0,skins:['gloves_tac_coyote']})); }")
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ const L=__LD; L.sim(10); document.getElementById('hud').style.visibility='hidden'; }")
    for si, S in enumerate(SETS):
        for k, f in enumerate(FR):
            pg.evaluate("""([id, S, f])=>{ const L=__LD, p=L.G.player, d=L.ITEMS[id], slot=d.slot==='secondary'?2:0; L.VM.rp.L=Object.assign({}, L.VM.rp.L, S.L||{}); L.VM.rp.R=Object.assign({}, L.VM.rp.R, S.R||{});
              p.inv.weapons=[null,null,null]; p.inv.weapons[slot]=L.fns.newWeapon(id, d.mag); p.inv.cur=slot; p.inv.items={}; p.inv.items[d.ammo]=200; p.equipT=0; p.rl=null; p.cycle=null; p.setVisibleGear();
              p.yaw=Math.PI; p.pitch=-0.06; L.sim(12); L.G.paused=true; p.weapon.mag=0; L.fns.startReload(p); const n=Math.round(f*p.rl.total*60); L.sim(n, 1/60); L.sim(30, 1/600); }""", [GUN, S, f])
            pg.wait_for_timeout(200)
            pg.screenshot(path=f'{OUT}/vt_{GUN}_{si}_{k}.png', clip={'x': 160, 'y': 60, 'width': 800, 'height': 480})
    b.close()
