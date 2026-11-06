# v17 울트라레어 총기 스킨 효과: 대기(빛) · 연사 · 총 바꾸기(헌 총 사라짐 → 새 총 빛 띠) 프레임
#  사용: python3 test/v17_fx.py OUT fpp|tpp skinA,skinB   (A를 1번, B를 2번 칸에 들고 시작 → 2번으로 바꿈)
import sys, json
from playwright.sync_api import sync_playwright
OUT, VIEW = sys.argv[1], sys.argv[2]
A, B = sys.argv[3].split(',')
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
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text[:300]) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("(v)=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', view:v})); }", VIEW)
    pg.reload(); pg.wait_for_timeout(2000)
    # 스킨 갖기·장착 (교환소 경로)
    eq = pg.evaluate("""([a, b])=>{ const L=__LD, E=L.Eco.E(); E.gcoin=99999; for (const id of Object.keys(L.GSKINS)) if (L.Eco.gunPrice(id)) L.Eco.exchangeGun(id);
      for (const id of [a, b]) L.Eco.equipGun(L.GSKINS[id].gun, id); return L.Eco.glook(); }""", [A, B])
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    info = pg.evaluate("""([a, b])=>{ const L=__LD, p=L.G.player, ga=L.GSKINS[a].gun, gb=L.GSKINS[b].gun; L.sim(10); document.getElementById('hud').style.visibility='hidden';
      p.inv.weapons=[L.fns.newWeapon(ga, L.ITEMS[ga].mag), L.fns.newWeapon(gb, L.ITEMS[gb].mag), null]; p.inv.cur=0; p.inv.items={}; p.inv.items[L.ITEMS[ga].ammo]=300; p.inv.items[L.ITEMS[gb].ammo]=300;
      p.equipT=0; p.rl=null; p.cycle=null; p.setVisibleGear(); p.yaw=Math.PI; p.pitch=-0.04; L.sim(30, 1/60); L.G.paused=true;
      const g = L.fns.weaponAnim && (L.VM.gun || p.rig.gunObj); return { glook: p.glook, vm: !!L.VM.gun, skin: g && g.userData.skin ? g.userData.skin.id : null }; }""", [A, B])
    shots = []
    # 3인칭은 옆에서 본다 (기본 카메라는 등 뒤라 손에 든 총이 몸에 가림): 멈춘 상태에서 카메라만 옮김
    SIDE = "()=>{ const L=__LD, p=L.G.player, c=L.G.camera, rx=-Math.cos(p.yaw), rz=Math.sin(p.yaw), fx=Math.sin(p.yaw), fz=Math.cos(p.yaw); c.position.set(p.pos.x - rx*1.7 + fx*1.1, p.pos.y+1.45, p.pos.z - rz*1.7 + fz*1.1); c.lookAt(p.pos.x + fx*0.45, p.pos.y+1.15, p.pos.z + fz*0.45); c.updateMatrixWorld(); }"
    def snap(name):
        if VIEW == 'tpp': pg.evaluate(SIDE)
        pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/fx_{VIEW}_{name}.png'); shots.append(name)
    snap('0_idle')
    # 연사: 6프레임 쏘고 찍기
    # 쏜 직후(2프레임 뒤)와 조금 뒤(입자가 퍼진 뒤)
    pg.evaluate("()=>{ const L=__LD; L.G.player.fireCd=0; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(1, 1/60); L.G.paused=true; }"); snap('1_fire_a')
    pg.evaluate("()=>{ const L=__LD; L.sim(5, 1/60); L.G.paused=true; }"); snap('2_fire_b')
    pg.evaluate("()=>{ const L=__LD; L.sim(30, 1/60); L.G.paused=true; }")
    # 2번 칸으로 바꾸기
    pg.evaluate("()=>{ const L=__LD; L.Input.edge.add('w2'); L.sim(1, 1/60); L.G.paused=true; }")
    t = 1 / 60
    for k, tt in enumerate([0.06, 0.14, 0.24, 0.36, 0.46, 0.6]):
        n = max(0, round((tt - t) * 60)); pg.evaluate("(n)=>{ __LD.sim(n, 1/60); __LD.G.paused=true; }", n); t += n / 60
        snap(f'3_swap_{k}')
    st = pg.evaluate("()=>{ const L=__LD, p=L.G.player, g=L.VM.active ? L.VM.gun : p.rig.gunObj; return { cur: p.inv.cur, wid: p.weapon.id, skin: g && g.userData.skin ? g.userData.skin.id : null, active: L.GunSkin._active.size, pools: L.GunSkin._pools.size }; }")
    print(json.dumps({'equip': eq, 'start': info, 'end': st, 'shots': shots}, ensure_ascii=False))
    print('\n'.join(logs[:20]) or 'no errors')
    b.close()
