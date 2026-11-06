# v16 훈련장 무기고: 총 24종·.45 탄이 탁자에 놓였는지, 탁자에서 집어 쏘고 장전 → 탁자 다시 채움
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    info = pg.evaluate("""()=>{ const L=__LD, T=L.Training.state; L.sim(20);
      const guns = T.spots.filter(s=>L.ITEMS[s.id].type==='weapon'), ammo = T.spots.filter(s=>L.ITEMS[s.id].type==='ammo').map(s=>s.id);
      const rows = {}; for (const s of guns) { const k = s.z.toFixed(1); (rows[k] = rows[k] || []).push(s.id); }
      const xs = guns.map(s=>s.x); return { guns: guns.length, all: Object.keys(L.ITEMS).filter(k=>L.ITEMS[k].type==='weapon').every(id=>guns.some(s=>s.id===id)), rows, ammo, xmin: Math.min(...xs), xmax: Math.max(...xs) }; }""")
    print(json.dumps(info, ensure_ascii=False))
    # 무기고 전경 (탁자 위)
    pg.evaluate("()=>{ const L=__LD, p=L.G.player; p.pos.z -= 1.2; p.yaw=0; p.pitch=-0.42; L.sim(30); document.getElementById('hud').style.visibility='hidden'; }")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/arm_tables.png')
    pg.evaluate("()=>{ const L=__LD, p=L.G.player; p.pos.x = 12; p.pos.z = 154.2; p.yaw=0; p.pitch=-0.5; L.sim(30); }")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/arm_tables_r.png')
    pg.evaluate("()=>{ document.getElementById('hud').style.visibility='visible'; }")
    # 탁자에서 새 총을 하나씩 집어 → 쏘고 → 빈 탄창 장전 → 탁자 다시 채움 확인
    res = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, T=L.Training.state, out={};
      for (const id of ['beryl','m16a4','vector','bizon','tommy','kar98k','win94','s1897','dp28','deagle']) {
        const s = T.spots.find(x=>x.id===id); if (!s || !s.it || !s.it.alive) { out[id]='no spot'; continue; }
        p.pos.set(s.x, p.pos.y, s.z - 1.0); L.sim(2);
        const r = L.fns.pickupItem(p, s.it, L.G.scene); const w = p.weapon; if (!r.ok || !w || w.id !== id) { out[id] = 'pick fail ' + r.msg; continue; }
        p.equipT = 0; L.sim(5); let shots = 0;
        for (let i=0;i<400 && w.mag>0;i++){ L.Input.fire=true; L.sim(1); L.Input.fire=false; L.sim(1); }
        shots = L.G.stats.shots; L.sim(5);
        const ok1 = w.mag === 0; L.fns.startReload(p); const kind = p.rl ? p.rl.kind + (p.rl.clip ? '+clip' : '') : 'none';
        for (let i=0;i<600 && p.rl;i++) L.sim(1);
        L.sim(100);
        out[id] = { empty: ok1, kind, mag: w.mag + '/' + p.inv.magSize(w), back: !!(s.it && s.it.alive) };
      }
      return out; }""")
    print(json.dumps(res, ensure_ascii=False))
    pg.screenshot(path=f'{OUT}/arm_after.png')
    print('\n'.join(logs[:20]))
    b.close()
