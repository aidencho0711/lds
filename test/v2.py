import sys, json
from playwright.sync_api import sync_playwright
OUT = '/home/claude/br/test/shots'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:10, view:'tpp'})); }")
    pg.reload(); pg.wait_for_timeout(6000)
    print('icons ready', pg.evaluate("()=>Object.keys(__LD.ITEMS).filter(id=>__LD.Models.icon(id)).length"), '/', pg.evaluate("()=>Object.keys(__LD.ITEMS).length"))
    print('audio bank', pg.evaluate("()=>{__LD.Audio.init(); return 1}"))
    pg.screenshot(path=f'{OUT}/00_lobby.png')
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; }
      // 넓은 평지로 이동
      for(let t=0;t<3000;t++){ const x=(Math.random()-0.5)*400, z=(Math.random()-0.5)*400; let ok=true; for(let k=0;k<12;k++){ if(!L.Nav.isFree(x+Math.cos(k)*6, z+Math.sin(k)*6)){ok=false;break;} } if(ok && window.__gh(x,z)>2){ p.pos.set(x, window.__gh(x,z), z); break; } }
      p.yaw = 0.6; p.pitch = -0.05; L.sim(10); }""")
    def gear(w, att, items):
        pg.evaluate("""([w,att,items])=>{ const L=__LD, p=L.G.player; p.inv.weapons=[{id:w,mag:L.ITEMS[w].mag,att:Object.assign({scope:null,muzzle:null,mag:null,grip:null},att)},null,{id:'p19',mag:15,att:{scope:null,muzzle:null,mag:null,grip:null}}]; p.inv.cur=0; p.inv.items=items; p.inv.gear={helmet:{id:'helm2',dur:150},vest:{id:'vest3',dur:250},bag:{id:'bag3'}}; p.rl=null; p.cycle=null; p.equipT=0; p.setVisibleGear(); L.sim(5); }""", [w, att, items])
    def shot(name, wait=600): pg.wait_for_timeout(wait); pg.screenshot(path=f'{OUT}/{name}.png')
    gear('ar7', {'scope':'reddot','muzzle':'comp','grip':'grip'}, {'a556':120,'a9':30,'bandage':5,'firstaid':2,'medkit':1,'drink':2,'frag':2,'smoke':1,'x6':1,'holo':1,'extmag':1})
    shot('01_tpp')
    pg.evaluate("()=>{ __LD.G.firstPerson=true; __LD.sim(10); }"); shot('02_fpp_hip')
    for sc in ['iron','reddot','holo','x2','x3','x4','x6']:
        w = 'dm14' if sc in ('x4','x6') else 'ar7'
        gear(w, {'scope': None if sc=='iron' else sc}, {'a556':120,'a762':60})
        pg.evaluate("()=>{ __LD.G.firstPerson=false; __LD.Input.aim=true; __LD.sim(25); }")
        shot('03_ads_'+sc)
        pg.evaluate("()=>{ __LD.Input.aim=false; __LD.sim(15); }")
    # 장전 프레임
    def reload_frames(w, att, mag, fracs, tag):
        gear(w, att, {'a556':120,'a762':60,'a12':30,'a9':60})
        pg.evaluate("([w,mag])=>{ const L=__LD,p=L.G.player; p.inv.weapons[0].mag=mag; L.G.firstPerson=true; L.sim(5); }", [w, mag])
        tot = pg.evaluate("()=>{ const L=__LD,p=L.G.player; L.Input.press('reload'); L.sim(1); return p.rl? p.rl.total : -1; }")
        done = 0
        for f in fracs:
            steps = int((f*tot - done) * 30); 
            if steps>0: pg.evaluate(f"()=>__LD.sim({steps})")
            done += steps/30
            pg.evaluate("()=>{ __LD.G.paused=true; }"); shot(f'04_rl_{tag}_{int(f*100):02d}', 500); pg.evaluate("()=>{ __LD.G.paused=false; }")
        pg.evaluate("()=>__LD.sim(120)")
        return pg.evaluate("()=>{ const p=__LD.G.player; return [p.inv.weapons[0].mag, p.rl, p.inv.items]; }")
    print('AR tactical', reload_frames('ar7', {}, 12, [0.15, 0.35, 0.58], 'ar'))
    print('AR empty', reload_frames('ar7', {}, 0, [0.68], 'arE'))
    print('SK empty', reload_frames('sk74', {}, 0, [0.2, 0.7], 'sk'))
    print('SG', reload_frames('sg12', {}, 1, [0.2, 0.5], 'sg'))
    print('BR', reload_frames('br98', {'scope':'x6'}, 0, [0.12, 0.5, 0.92], 'br'))
    print('P19 empty', reload_frames('p19', {}, 0, [0.3, 0.7], 'p19'))
    # 연사 → 탄피, 섬광
    gear('ar7', {'scope':'holo'}, {'a556':120})
    pg.evaluate("()=>{ const L=__LD; L.G.firstPerson=false; L.Input.fire=true; L.sim(6); L.Input.fire=false; }"); shot('05_fire_tpp', 200)
    pg.evaluate("()=>{ const L=__LD; L.G.firstPerson=true; L.Input.fire=true; L.sim(4); L.Input.fire=false; }"); shot('05_fire_fpp', 200)
    print('stats', pg.evaluate("()=>__LD.G.stats"))
    # 인벤토리
    pg.evaluate("()=>{ const L=__LD; L.G.firstPerson=false; L.Input.press('inventory'); L.sim(1); }"); shot('06_inventory', 800)
    pg.evaluate("()=>{ const L=__LD; L.Input.press('inventory'); L.sim(1); }")
    # 바닥 아이템 근접 (주변에 모든 종류 뿌리기)
    pg.evaluate("""()=>{ const L=__LD, p=L.G.player; const ids=['ar7','sk74','vk9','sg12','dm14','br98','p19','a556','a762','a9','a12','bandage','firstaid','medkit','drink','vest1','vest2','vest3','helm1','helm2','helm3','bag1','bag2','bag3','reddot','holo','x2','x3','x4','x6','comp','extmag','grip','frag','smoke'];
      const fx=Math.sin(p.yaw), fz=Math.cos(p.yaw), rx=-Math.cos(p.yaw), rz=Math.sin(p.yaw);
      ids.forEach((id,i)=>{ const row=Math.floor(i/7), col=i%7; const x=p.pos.x+fx*(2.2+row*0.9)+rx*(col-3)*0.75, z=p.pos.z+fz*(2.2+row*0.9)+rz*(col-3)*0.75; const it = window.__spawn(id, x, z); });
      p.pitch=-0.55; L.G.firstPerson=true; L.sim(12); }""")
    shot('07_ground_items', 900)
    pg.evaluate("()=>{ const p=__LD.G.player; p.pitch=-0.35; __LD.G.firstPerson=false; __LD.sim(10); }"); shot('07_ground_items_tpp', 900)
    print('errors', errs[:20])
    b.close()
