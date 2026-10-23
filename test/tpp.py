from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: print('ERR', e))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:8, view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    print(pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; p.inv.weapons=[{id:'ar7',mag:30,att:{scope:'x2',muzzle:null,mag:null,grip:null}},null,null]; p.inv.cur=0; p.equipT=0; p.setVisibleGear(); L.sim(10);
      const g=p.rig.gunObj; const v=new THREE.Vector3(); g.getWorldPosition(v);
      return { has: !!g, mountVis: p.rig.gunMount.visible, rootVis: p.root.visible, gunVis: g && g.visible, rel: [v.x-p.pos.x, v.y-p.pos.y, v.z-p.pos.z].map(x=>+x.toFixed(2)), children: g.children.length, cam: [L.G.camera.position.x-p.pos.x, L.G.camera.position.y-p.pos.y, L.G.camera.position.z-p.pos.z].map(x=>+x.toFixed(2)), yaw: p.yaw, body: p.bodyYaw }; }"""))
    pg.wait_for_timeout(600); pg.screenshot(path='/home/claude/br/test/shots/08_tpp_dbg.png')
    pg.evaluate("()=>{ const L=__LD,p=L.G.player; for(let i=0;i<40;i++){ p.lastShotT=L.G.time; L.sim(1);} }"); pg.screenshot(path='/home/claude/br/test/shots/08_tpp_ready.png')
    pg.evaluate("()=>{ const L=__LD,p=L.G.player; p.lastShotT=-99; L.sim(60); }")
    pg.evaluate("()=>{ const L=__LD,p=L.G.player; p.yaw += 1.4; L.sim(20); }"); pg.wait_for_timeout(600); pg.screenshot(path='/home/claude/br/test/shots/08_tpp_side.png')
    print(pg.evaluate("""()=>{ const L=__LD,p=L.G.player; L.G.paused=true; p.root.rotation.y = p.bodyYaw + Math.PI; p.root.updateMatrixWorld(true);
      const g=p.rig.gunObj; const out=[]; g.traverse(o=>{ if(o.isMesh){ const v=new THREE.Vector3(); o.getWorldPosition(v); out.push([o.material.type, o.visible, o.geometry.attributes.position.count, +v.distanceTo(p.pos).toFixed(2)]); } });
      let vis=true, o=g; while(o){ if(!o.visible) vis=false; o=o.parent; }
      return {meshes: out.slice(0,6), chainVisible: vis, scale: g.getWorldScale(new THREE.Vector3()).toArray()}; }"""))
    pg.wait_for_timeout(700); pg.screenshot(path='/home/claude/br/test/shots/08_tpp_front.png')
    b.close()
