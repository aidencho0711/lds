# 새 캐릭터 모델 확인: 로비 장면에 여러 각도·장비·외형으로 세워 렌더 (앞·옆·뒤·3/4 + 장비 + 봇 변형)
#  사용: python3 test/model_sheet.py OUT_DIR [pose]   pose: idle(기본) | apose | tpose
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
POSE = sys.argv[2] if len(sys.argv) > 2 else 'idle'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 800})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'high', shadows:'high'})); }")
    pg.reload(); pg.wait_for_timeout(2500)
    info = pg.evaluate("""(POSE)=>{
      const L=__LD, Lb=L.Lobby, sc=Lb.scene, Body=L.Body;
      document.getElementById('lobby').style.visibility='hidden';
      for (const m of Lb.mates||[]) sc.remove(m.root); if (Lb.rig) sc.remove(Lb.rig.root);
      const rigs=[]; const add=(look, x, yaw, gear)=>{ const r=L.buildRig(look); r.root.position.set(x,0,0); r.root.rotation.y=yaw; if(gear) r.setGear(gear[0],gear[1],gear[2]); sc.add(r.root); rigs.push(r); return r; };
      const base=Body.makeLook(null,null);
      add(base,-3.0,0); add(base,-1.8,Math.PI/2); add(base,-0.6,Math.PI); add(base,0.6,-0.6);
      add(base,1.8,0.4,[3,3,3]); add(base,3.0,0.5,[2,2,2]);
      const r1=Body.makeLook(null,{tone:0x7d5034,hair:'crew',hairColor:0x15110e,beard:'beard',eye:0x3a2a1e}); add(r1,4.2,0.3,[1,1,1]);
      const r2=Body.makeLook(null,{tone:0xf1c9a5,hair:'buzz',hairColor:0x8a6a45,beard:'stubble',eye:0x2f4a5e}); add(r2,5.4,-0.3,[0,2,0]);
      for (const r of rigs) {
        if (POSE==='apose') { r.armL.sh.rotation.z=0.75; r.armR.sh.rotation.z=-0.75; }
        if (POSE==='tpose') { r.armL.sh.rotation.z=1.5; r.armR.sh.rotation.z=-1.5; }
        if (POSE==='bend') { r.armL.sh.rotation.x=-1.4; r.armL.el.rotation.x=-1.6; r.armR.sh.rotation.x=-0.6; r.armR.el.rotation.x=-2.0; r.legL.hip.rotation.x=-1.3; r.legL.knee.rotation.x=1.9; r.legR.hip.rotation.x=0.3; r.legR.knee.rotation.x=0.4; r.spine.rotation.x=0.3; for(const a of [r.armL,r.armR]){ a.fin1.rotation.z=a.side*-1.2; a.fin2.rotation.z=a.side*-1.2; a.idx1.rotation.z=a.side*-1.0; a.idx2.rotation.z=a.side*-1.1; } }
      }
      window.__sheet = rigs;
      Lb.update = function(dt){ this.t+=dt; };
      const g=rigs[0].mesh.geometry, gl=rigs[0].meshLo.geometry;
      return { verts: g.attributes.position.count, tris: g.index.count/3, vertsLo: gl.attributes.position.count, cache: Body.cache.size };
    }""", POSE)
    print('geo', info)
    shots = [('full', [1.2, 1.15, 7.6], [1.2, 0.95, 0]), ('front', [-3.0, 1.35, 2.4], [-3.0, 1.0, 0]), ('face', [-3.0, 1.66, 0.75], [-3.0, 1.64, 0]),
             ('side', [-1.8 + 0.0, 1.35, 2.4], [-1.8, 1.0, 0]), ('back', [-0.6, 1.35, 2.4], [-0.6, 1.0, 0]), ('gear3', [1.8, 1.4, 2.3], [1.8, 1.05, 0]),
             ('bots', [4.8, 1.5, 1.9], [4.8, 1.35, 0]), ('hands', [-3.0, 0.95, 0.9], [-3.0, 0.85, 0])]
    for name, cp, la in shots:
        pg.evaluate("([cp,la])=>{ const c=__LD.Lobby.cam; c.position.set(cp[0],cp[1],cp[2]); c.lookAt(la[0],la[1],la[2]); c.fov=name==='face'?30:42; c.updateProjectionMatrix(); }".replace("name==='face'", "true" if name == 'face' else "false"), [cp, la])
        pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/sheet_{POSE}_{name}.png')
    print('\n'.join(logs[:20]))
    b.close()
