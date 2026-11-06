# v16 보충 검사: 점사 이름(Vector 2점사) · 볼트/레버/펌프 동작 중 든 총을 버리면 다음 총에 동작이 이어지지 않음
import sys, json
from playwright.sync_api import sync_playwright
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
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(2000)
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    res = pg.evaluate("""()=>{ const L=__LD, F=L.fns, p=L.G.player, out={};
      L.sim(20);
      out.names = ['vector','m16a4','beryl','asm','m416'].map(id => id + ':' + L.ITEMS[id].modes.map(m => F.modeName(id, m)).join('/'));
      // 손에 든 총 → 두 번째 칸 총으로: 볼트·레버·펌프 동작 도중 버리기
      const give = (slot, id) => { const w = F.newWeapon(id, L.ITEMS[id].mag); p.inv.weapons[slot] = w; p.inv.add(L.ITEMS[id].ammo, 60); return w; };
      out.drop = {};
      for (const id of ['kar98k', 'win94', 's1897', 'm24']) {
        give(0, id); give(1, 'm416'); p.inv.cur = 0; p.equipT = 0; p.fireCd = 0; p.rl = null; p.cycle = null; L.sim(3);
        L.Input.fire = true; L.sim(1); L.Input.fire = false; L.sim(2);
        const during = p.cycle ? p.cycle.kind : null;
        F.dropFromInventory(p, L.G.scene, { weapon: 0 });
        const after = { cur: p.inv.cur, wid: p.weapon && p.weapon.id, cycle: p.cycle ? p.cycle.kind : null };
        const mag0 = p.weapon.mag; p.equipT = 0; L.sim(60);
        out.drop[id] = { during, after, magSame: p.weapon.mag === mag0 };
        p.inv.weapons[0] = null; p.inv.weapons[1] = null;
      }
      // 장전 도중 버리기(다른 칸)도 그대로 끊김
      give(0, 'beryl'); give(1, 'vector'); p.inv.cur = 0; p.weapon.mag = 3; p.equipT = 0; L.sim(2); F.startReload(p);
      L.sim(20); const rlBefore = !!p.rl; F.dropFromInventory(p, L.G.scene, { weapon: 0 });
      out.reloadDrop = { rlBefore, rlAfter: !!p.rl, wid: p.weapon && p.weapon.id };
      return out; }""")
    print(json.dumps(res, ensure_ascii=False, indent=1))
    # 사격 모드 바꾸기 → 토스트 문구
    pg.evaluate("()=>{ const L=__LD, F=L.fns, p=L.G.player; const w=F.newWeapon('vector', 19); p.inv.weapons[0]=w; p.inv.cur=0; p.equipT=0; L.sim(2); }")
    toasts = []
    for i in range(3):
        pg.keyboard.press('b'); pg.wait_for_timeout(250)
        toasts.append(pg.evaluate("()=>{ const t=[...document.querySelectorAll('.toast, #toast, .toasts > *')].map(e=>e.textContent).filter(Boolean); return t.slice(-1)[0] || ''; }"))
    print('toasts', toasts)
    print('\n'.join(logs[:20]) or 'no errors')
    b.close()
