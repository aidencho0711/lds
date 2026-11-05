# 옷 스킨 확인: 상자별 옷을 조합해 입힌 캐릭터를 로비 장면에 세워 앞·뒤·모자를 렌더
#  사용: python3 test/skin_sheet.py OUT_DIR [dusk]
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
DUSK = len(sys.argv) > 2 and sys.argv[2] == 'dusk'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
OUTFITS = [
    # 배틀로얄
    dict(top='top_tee_sand', bottom='bottom_cargo_gray', shoes='shoes_boots_black', hat='hat_beanie_olive'),
    dict(top='top_tee_camo_w', bottom='bottom_cargo_camo_d', hat='hat_boonie_camo', gloves='gloves_tac_coyote'),
    dict(top='top_ls_black', bottom='bottom_cargo_camo_u'),
    dict(top='top_jk_snow', bottom='bottom_cargo_snow'),
    dict(top='top_jk_gold', bottom='bottom_cargo_gold', shoes='shoes_boots_black'),
    # 스페셜
    dict(top='top_tee_white', bottom='bottom_jeans_light', shoes='shoes_sneak_white', hat='hat_cap_black'),
    dict(top='top_tee_stripe', bottom='bottom_track_navy', shoes='shoes_high_red'),
    dict(top='top_ls_plaid', bottom='bottom_jeans_black', shoes='shoes_sneak_white'),
    dict(top='top_hood_gray', bottom='bottom_jeans_light', shoes='shoes_high_red'),
    dict(top='top_hood_pink', bottom='bottom_jeans_black', shoes='shoes_sneak_neon', hat='hat_cap_black'),
    dict(top='top_jk_neon', bottom='bottom_neon', shoes='shoes_sneak_neon'),
    # 보급
    dict(top='top_tank_olive', bottom='bottom_shorts_sand', shoes='shoes_boots_desert', hat='hat_bandana_black'),
    dict(top='top_jk_flight', bottom='bottom_cargo_dig', gloves='gloves_leather'),
    dict(top='top_ls_dig', bottom='bottom_cargo_tiger', gloves='gloves_fingerless', hat='hat_beret_red'),
    dict(top='top_jk_chrome', bottom='bottom_chrome', shoes='shoes_boots_black'),
]
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 800})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("(d)=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'high', shadows:'high', time: d ? 'dusk' : 'day'})); }", DUSK)
    pg.reload(); pg.wait_for_timeout(2500)
    info = pg.evaluate("""(OUT)=>{
      const L=__LD, Lb=L.Lobby, sc=Lb.scene, Body=L.Body;
      document.getElementById('lobby').style.visibility='hidden';
      for (const m of Lb.mates||[]) sc.remove(m.root); if (Lb.rig) sc.remove(Lb.rig.root);
      const rigs=[];
      OUT.forEach((eq,i)=>{ const r=L.buildRig(Body.makeLook(eq,null)); r.root.position.set((i%5)*1.25-2.5, 0, -Math.floor(i/5)*3.2); r.root.rotation.y=0.25; sc.add(r.root); rigs.push(r); });
      window.__sheet=rigs; Lb.update=function(dt){ this.t+=dt; };
      return { n: rigs.length, verts: rigs.map(r=>r.mesh.geometry.attributes.position.count), cache: Body.cache.size };
    }""", OUTFITS)
    print('info', info)
    for row in range(3):
        z = -row * 3.2
        for name, yaw in (('front', 0.25), ('back', 3.4)):
            pg.evaluate("([z,yaw])=>{ for (const r of __sheet) if (Math.abs(r.root.position.z - z) < 0.1) r.root.rotation.y = yaw; const c=__LD.Lobby.cam; c.position.set(0,1.25,z+4.3); c.lookAt(0,0.95,z); c.fov=42; c.updateProjectionMatrix(); }", [z, yaw])
            pg.wait_for_timeout(600)
            pg.screenshot(path=f'{OUT}/skins_{row}_{name}.png')
    # 모자 가까이
    for i, idx in enumerate([0, 1, 5, 11, 13]):
        pg.evaluate("(i)=>{ const r=__sheet[i]; r.root.rotation.y=0.6; const p=r.root.position; const c=__LD.Lobby.cam; c.position.set(p.x+0.25,1.72,p.z+0.75); c.lookAt(p.x,1.66,p.z); c.fov=36; c.updateProjectionMatrix(); }", idx)
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/hat_{i}.png', clip={'x': 450, 'y': 150, 'width': 500, 'height': 500})
    print('\n'.join(logs[:20]))
    b.close()
