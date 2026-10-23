# 보급상자 단독 확인: 낙하 중/착지 후 화면, 내용물, 줍기
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
OUT='/home/claude/br/test/shots/'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720}); pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:6, view:'tpp'})); }"); pg.reload(); pg.wait_for_timeout(2500)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; for (const c of L.CHARS) if(!c.isPlayer){ c.hp=1e9; c.root.visible=false; c.pos.set(300,0,300); }
      for(let t=0;t<6000;t++){ const x=(Math.random()-0.5)*400, z=(Math.random()-0.5)*400, h=window.__gh(x,z); if(h<1.5) continue; let ok=true; for(let k=0;k<24 && ok;k++){ const rr=4+(k%3)*8, xx=x+Math.cos(k)*rr, zz=z+Math.sin(k)*rr+(k%2?10:0); if(!L.Nav.isFree(xx,zz) || Math.abs(window.__gh(xx,zz)-h)>0.8) ok=false; } if(ok){ p.pos.set(x, h, z); break; } }
      p.yaw=0; p.pitch=0.25; L.sim(5); }""")
    r = pg.evaluate("""()=>{ const L=__LD,p=L.G.player; const x=p.pos.x, z=p.pos.z+16; const k0=L.Airdrop.list.length; L.Airdrop.launch(x, z);
      let n=0; while(L.Airdrop.list.length===k0 && n<2000){ L.sim(1); n++; } const d=L.Airdrop.list[k0]; window.__crate=d; let m=0; while(d && d.y > p.pos.y + 22 && m<3000){ L.sim(1); m++; } return {plane:n, fall:m, y:d&&d.y}; }""")
    print(r); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'c1_falling.png')
    print(pg.evaluate("""()=>{ const L=__LD,d=window.__crate,p=L.G.player; let n=0; while(!d.landed && n<3000){ L.sim(1); n++; } L.sim(90); p.pitch=-0.1; L.sim(3); return {landed:d.landed, items:d.items.map(i=>[i.id, +(i.y-d.gy).toFixed(2), i.mesh.visible]), crateVis: d.obj.visible, pos:[d.x-p.pos.x, d.gy-p.pos.y, d.z-p.pos.z].map(v=>+v.toFixed(1))}; }"""))
    pg.wait_for_timeout(600); pg.screenshot(path=OUT+'c2_landed.png')
    pg.evaluate("()=>{ const L=__LD,d=window.__crate,p=L.G.player; p.pos.set(d.x, window.__gh(d.x, d.z-2.2), d.z-2.2); p.yaw=0; p.pitch=-0.55; L.G.firstPerson=true; L.sim(10); }")
    pg.wait_for_timeout(600); pg.screenshot(path=OUT+'c3_close.png')
    print(pg.evaluate("""()=>{ const L=__LD,d=window.__crate,p=L.G.player; const w=d.items.find(i=>L.ITEMS[i.id].type==='weapon'); const before=p.inv.weapons.map(x=>x&&x.id); L.HUD; 
      // 상자 위 물건을 줍기 (일반 줍기 경로)
      L.sim(2); const f=L.HUD.focusItem(); L.Input.press('interact'); L.sim(2); return {focus: f && f.id, before, after: p.inv.weapons.map(x=>x&&x.id), gy: +(p.pos.y - d.gy).toFixed(2)}; }"""))
    pg.evaluate("()=>{ const L=__LD; L.Input.press('map'); L.sim(1); }"); pg.wait_for_timeout(600); pg.screenshot(path=OUT+'c4_map.png')
    print('errors', errs)
    b.close()
