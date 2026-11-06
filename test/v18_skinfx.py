# v18 울트라레어 스킨 맞힘·처치 효과: 훈련장 더미를 쏴서 맞힘(1·3발 뒤) → 처치 후 시간대별 프레임
#  사용: python3 test/v18_skinfx.py OUT fpp|tpp skin[,skin...] [W H]
#  각 스킨: 관찰 카메라(더미 옆 비스듬히)로 맞힘 2장 + 처치 6장, 쏘는 사람 시점으로 처치 1장
import sys, json
from playwright.sync_api import sync_playwright
OUT, VIEW, SKINS = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
VW, VH = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (960, 540)
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': VW, 'height': VH}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.on('console', lambda m: logs.append(m.text[:300]) if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("(v)=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', view:v})); }", VIEW)
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("""(ids)=>{ const L=__LD, E=L.Eco.E(); E.gcoin=99999; for (const id of ids) { L.Eco.exchangeGun(id); L.Eco.equipGun(L.GSKINS[id].gun, id); } }""", SKINS)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    # 서 있는 더미 하나 + 9m 떨어진 평평한 자리
    setup = pg.evaluate("""()=>{ const L=__LD, F=L.fns; L.sim(10);
      const T = L.CHARS.find(c => c.dummy && !c.dummy.move && c.alive && c.dummy.lvl === 0) || L.CHARS.find(c => c.dummy && !c.dummy.move);
      let ang = null; for (let k = 0; k < 16 && ang === null; k++) { const a = k * Math.PI / 8, x = T.pos.x + Math.sin(a) * 9, z = T.pos.z + Math.cos(a) * 9, y = F.groundAt(x, z, 999);
        if (Math.abs(y - T.pos.y) < 0.5 && F.losClear(x, y + 1.5, z, T.pos.x, T.pos.y + 1.3, T.pos.z)) ang = a; }
      window.__T = T; window.__ang = ang; return { dummy: T.dummy.label, ang }; }""")
    AIM = """()=>{ const L=__LD, p=L.G.player, T=__T, a=__ang, F=L.fns; const x = T.pos.x + Math.sin(a) * 9, z = T.pos.z + Math.cos(a) * 9;
      p.pos.set(x, F.groundAt(x, z, 999), z); p.vel.set(0, 0, 0); const e = new THREE.Vector3(); p.eye(e);
      const dx = T.pos.x - e.x, dy = T.pos.y + 1.25 - e.y, dz = T.pos.z - e.z; p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }"""
    # 관찰 카메라: 더미 옆 4.5m, 조금 위에서 (처치 때는 기둥이 보이게 더 멀리)
    OBS = """(far)=>{ const L=__LD, T=__T, a=__ang, c=L.G.camera, F=L.fns, d = far ? 6.5 : 2.7;
      // 더미 옆(왼쪽/오른쪽 중 가리는 것 없는 쪽), 쏘는 쪽으로 조금 치우쳐서
      let best = null; for (const sd of [1, -1]) for (const ex of [0.6, 0.35, 0.9]) { const s = a + sd * Math.PI * ex;
        const x = T.pos.x + Math.sin(s) * d, z = T.pos.z + Math.cos(s) * d, y = T.pos.y + (far ? 2.3 : 1.45);
        if (F.losClear(x, y, z, T.pos.x, T.pos.y + 1.2, T.pos.z)) { best = [x, y, z]; break; } if (best) break; }
      if (!best) best = [T.pos.x + Math.sin(a) * d, T.pos.y + 1.6, T.pos.z + Math.cos(a) * d];
      c.position.set(best[0], best[1], best[2]); c.lookAt(T.pos.x, T.pos.y + (far ? 1.7 : 1.15), T.pos.z); c.fov = 72; c.updateProjectionMatrix(); c.updateMatrixWorld(); L.VM.active = false;
      document.getElementById('hud').style.visibility = 'hidden'; }"""
    res = {'setup': setup}
    def snap(name, far=None):
        if far is not None: pg.evaluate(OBS, far)
        pg.wait_for_timeout(120); pg.screenshot(path=f'{OUT}/{name}.png')
    for sk in SKINS:
        gid = pg.evaluate("(id)=>__LD.GSKINS[id].gun", sk)
        r = pg.evaluate("""(gid)=>{ const L=__LD, p=L.G.player, T=__T; L.G.paused=false; document.getElementById('hud').style.visibility='visible';
          T.alive = true; T.hp = 1e6; if (T.dummy) T.dummy.downT = 0;
          p.inv.weapons=[L.fns.newWeapon(gid, L.ITEMS[gid].mag), null, null]; p.inv.cur=0; p.inv.items={}; p.inv.items[L.ITEMS[gid].ammo]=300;
          p.equipT=0; p.rl=null; p.cycle=null; p.setVisibleGear(); L.Input.aimToggle=true; L.sim(40, 1/60); return { skin: p.skinOf(gid) }; }""", gid)
        pg.evaluate(AIM)
        # 맞힘: 한 발 → 1프레임 뒤, 세 발 → 0.25초 뒤(몸에 남은 효과)
        h = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=__T; L.G.paused=false; p.fireCd=0; const h0 = L.G.stats.hits; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(1, 1/60); L.G.paused=true; return { hits: L.G.stats.hits - h0, body: L.GunSkin._body ? 0 : 0 }; }""")
        snap(f'{VIEW}_{sk}_hit1', False)
        h2 = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=__T; L.G.paused=false; const h0 = L.G.stats.hits; for (let i = 0; i < 3; i++) { const e = new THREE.Vector3(); p.eye(e); const dx = T.pos.x - e.x, dy = T.pos.y + 1.2 - e.y, dz = T.pos.z - e.z; p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); L.Cam.recoilP = 0; p.fireCd=0; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(5, 1/60); } L.sim(9, 1/60); L.G.paused=true; return { hits: L.G.stats.hits - h0 }; }""")
        snap(f'{VIEW}_{sk}_hit2', False)
        # 쏘는 사람 화면(9m): 연사하며 맞히는 중
        pg.evaluate("()=>{ const L=__LD; document.getElementById('hud').style.visibility='visible'; L.G.paused=false; L.Input.aimToggle=false; L.sim(25, 1/60); }")
        pg.evaluate(AIM)
        pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=__T; for (let i = 0; i < 4; i++) { const e = new THREE.Vector3(); p.eye(e); const dx = T.pos.x - e.x, dy = T.pos.y + 1.2 - e.y, dz = T.pos.z - e.z; p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); L.Cam.recoilP = 0; p.fireCd=0; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(4, 1/60); } L.G.paused=true; }""")
        pg.wait_for_timeout(120); pg.screenshot(path=f'{OUT}/{VIEW}_{sk}_hit3_shooter.png')
        # 처치: 체력 1로 두고 한 발
        pg.evaluate("()=>{ const L=__LD; L.G.paused=false; L.Input.aimToggle=true; L.sim(60, 1/60); }")
        pg.evaluate(AIM)
        k = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=__T; T.hp = 1; L.G.paused=false; p.fireCd=0; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(2, 1/60); L.G.paused=true; return { dead: !T.alive, live: L.SkinFx ? L.SkinFx._live.length : -1 }; }""")
        snap(f'{VIEW}_{sk}_kill0', True)
        t = 3 / 60
        for i, tt in enumerate([0.15, 0.35, 0.6, 1.0, 1.6]):
            n = max(1, round((tt - t) * 60)); pg.evaluate("(n)=>{ const L=__LD; L.G.paused=false; L.sim(n, 1/60); L.G.paused=true; }", n); t += n / 60
            snap(f'{VIEW}_{sk}_kill{i + 1}', True)
        res[sk] = {'gun': gid, 'equip': r, 'hit1': h, 'hit3': h2, 'kill': k}
        # 다음 스킨 전에 더미가 일어나고 효과가 끝나도록
        pg.evaluate("()=>{ const L=__LD; L.G.paused=false; L.sim(200, 1/60); }")
    # 쏘는 사람 시점: 처치 0.3초 뒤 (마지막 스킨)
    pg.evaluate("()=>{ const L=__LD, T=__T; T.alive = true; T.hp = 1; if (T.dummy) T.dummy.downT = 0; L.G.paused=false; L.Input.aimToggle=false; L.sim(30, 1/60); }")
    pg.evaluate(AIM)
    res['shooterKill'] = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=__T; document.getElementById('hud').style.visibility='visible'; T.hp = 1; let n = 0;
      for (; n < 10 && T.alive; n++) { const e = new THREE.Vector3(); p.eye(e); const dx = T.pos.x - e.x, dy = T.pos.y + 1.2 - e.y, dz = T.pos.z - e.z; p.yaw = Math.atan2(dx, dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); L.Cam.recoilP = 0; p.bloom = 0; p.fireCd=0; L.Input.fire=true; L.sim(1, 1/60); L.Input.fire=false; L.sim(3, 1/60); }
      L.sim(16, 1/60); L.G.paused=true; return { shots: n, dead: !T.alive }; }""")
    pg.wait_for_timeout(150); pg.screenshot(path=f'{OUT}/{VIEW}_shooter_kill.png')
    res['badge'] = pg.evaluate("()=>{ const e=document.getElementById('skinKill'); return { cls: e.className, text: e.textContent, op: getComputedStyle(e).opacity }; }")
    res['pools'] = pg.evaluate("()=>{ const out = []; for (const [sc, P] of __LD.GunSkin._pools) out.push(P.list.length); return out; }")
    print(json.dumps(res, ensure_ascii=False))
    print('\n'.join(logs[:20]) or 'no errors')
    b.close()
# 스킨마다 한 장으로 (맞힘 2 + 처치 6)
from PIL import Image
for sk in SKINS:
    fs = [f'{OUT}/{VIEW}_{sk}_{n}.png' for n in ['hit1', 'hit2', 'kill0', 'kill1', 'kill2', 'kill3', 'kill4', 'kill5']]
    W = Image.new('RGB', (960, 1080))
    for i, f in enumerate(fs): W.paste(Image.open(f).convert('RGB').resize((480, 270)), ((i % 2) * 480, (i // 2) * 270))
    W.save(f'{OUT}/sheet_{VIEW}_{sk}.png')
