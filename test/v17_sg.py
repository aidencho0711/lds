# 산탄총 명중 펠릿 수: 훈련장 더미(서 있음, 가슴 조준)를 거리별로 쏴서 평균 명중 펠릿 수를 잰다
#  사용: python3 test/v17_sg.py [N]   조건: 서서/뛰며(4.6m/s) × 비조준/조준, 거리 5·10·20·30m
import sys, json
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 120
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 640, 'height': 360}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', view:'fpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    res = pg.evaluate("""(N)=>{ const L=__LD, p=L.G.player, F=L.fns; L.sim(5);
      const T = L.CHARS.find(c => c.dummy && !c.dummy.move && c.alive); if (!T) return 'no dummy';
      // 표적에서 열린 쪽(사격선 방향)으로 물러선 자리
      const out = { dummy: T.dummy.label }, V = new THREE.Vector3();
      let ang = null; for (let k = 0; k < 16 && ang === null; k++) { const a = k * Math.PI / 8; let ok = true;
        for (const D of [5, 10, 20, 30]) { const x = T.pos.x + Math.sin(a) * D, z = T.pos.z + Math.cos(a) * D, y = F.groundAt(x, z, 999);
          if (Math.abs(y - T.pos.y) > 0.6 || !F.losClear(x, y + 1.3, z, T.pos.x, T.pos.y + 1.3, T.pos.z)) { ok = false; break; } } if (ok) ang = a; }
      if (ang === null) return 'no clear line';
      for (const gid of ['s686', 's1897', 's12k']) {
        const w = F.newWeapon(gid, L.ITEMS[gid].mag); p.inv.weapons = [w, null, null]; p.inv.cur = 0; p.setVisibleGear();
        const rows = {};
        for (const [name, sp, aim] of [['서서 비조준', 0, false], ['뛰며 비조준', 4.6, false], ['서서 조준', 0, true], ['걸으며 조준', 2.6, true]]) {
          const row = [];
          for (const D of [5, 10, 20, 30]) {
            const x = T.pos.x + Math.sin(ang) * D, z = T.pos.z + Math.cos(ang) * D;
            p.pos.set(x, F.groundAt(x, z, 999), z); p.vel.set(0, 0, 0);
            let hits = 0;
            for (let i = 0; i < N; i++) {
              T.hp = 1e6; T.alive = true; T.knocked = false; if (T.dummy) T.dummy.downT = 0;
              p.stance = 'stand'; p.onGround = true; p.inWater = false; p.aiming = aim; p.anim.speed = sp; p.bloom = 0; p.fireCd = 0; p.cycle = null; p.rl = null; p.equipT = 0; w.mag = 2;
              const o = new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z), d = V.set(T.pos.x - o.x, T.pos.y + 1.3 - o.y, T.pos.z - o.z).normalize().clone();
              const h0 = L.G.stats.hits; F.fireWeapon(p, o, d); hits += L.G.stats.hits - h0;
              if (i % 20 === 19) { L.sim(1, 1 / 60); }
            }
            row.push(+(hits / N).toFixed(2));
          }
          rows[name] = row;
        }
        out[gid] = rows;
      }
      return out; }""", N)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    print('\n'.join(logs[:10]) or 'no errors')
    b.close()
