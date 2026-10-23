from playwright.sync_api import sync_playwright
import json
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
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:4, view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; p.inv.weapons=[{id:'ar7',mag:30,att:{scope:'x2',muzzle:null,mag:null,grip:null}},null,null]; p.inv.cur=0; p.equipT=0; p.setVisibleGear(); L.sim(60); }""")
    res = pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player,r=p.rig,g=r.gunObj;
      const rt=new THREE.WebGLRenderTarget(640,360); const buf=new Uint8Array(640*360*4);
      const red=new THREE.MeshBasicMaterial({color:0xff0000}); const saved=[]; g.traverse(o=>{ if(o.isMesh){ saved.push([o,o.material]); } });
      function count(){ G.renderer.setRenderTarget(rt); G.renderer.render(G.scene,G.camera); G.renderer.setRenderTarget(null); G.renderer.readRenderTargetPixels(rt,0,0,640,360,buf); let n=0; for(let i=0;i<buf.length;i+=4) if(buf[i]>200&&buf[i+1]<40&&buf[i+2]<40) n++; return n; }
      function total(){ // gun alone
        const vis=[]; G.scene.traverse(o=>{ if(o.isMesh||o.isPoints||o.isSprite||o.isLine){ vis.push([o,o.visible]); } });
        G.scene.traverse(o=>{ if((o.isMesh||o.isSprite||o.isLine||o.isPoints)) { let q=o, inGun=false; while(q){ if(q===g) inGun=true; q=q.parent; } if(!inGun) o.visible=false; } });
        const n=count(); vis.forEach(([o,v])=>o.visible=v); return n; }
      saved.forEach(([o])=>o.material=red);
      const out=[]; const base={x:r.gunMount.position.x,y:r.gunMount.position.y,z:r.gunMount.position.z,ry:r.gunMount.rotation.y,rx:r.gunMount.rotation.x};
      const cands=[];
      for(const x of [-0.22,-0.3]) for(const y of [0.3,0.4]) for(const ry of [-0.5,0,0.42,0.9]) for(const rx of [0.25,0.55]) cands.push({x,y,z:0.2,ry,rx});
      for(const c of cands){ r.gunMount.position.set(c.x,c.y,c.z); r.gunMount.rotation.set(c.rx,c.ry,0); r.gunMount.updateMatrixWorld(true); const v=count(), t=total(); out.push([c.x,c.y,c.ry,c.rx,v,t,+(v/Math.max(1,t)).toFixed(2)]); }
      saved.forEach(([o,m])=>o.material=m);
      return {base, out}; }""")
    print(json.dumps(res['base']))
    for row in sorted(res['out'], key=lambda r:-r[4]): print(row)
    b.close()
