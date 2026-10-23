# v3 검증: 총기 12종 장전 탄약 계산·사격 모드·AWM 헤드샷·뷰모델 스크린샷·보급상자
import sys, json
from playwright.sync_api import sync_playwright
OUT = '/home/claude/br/test/shots'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
GUNS = ['m416','aug','akm','asm','vk9','mini14','slr','m24','awm','s686','s12k','m249','mg3','p19']
errs = []
SHOTS = '--shots' in sys.argv
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.on('console', lambda m: errs.append(m.type + ' ' + m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text and 'GPU stall' not in m.text else None)
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', shadows:'low', bots:10, view:'fpp'})); }")
    pg.reload(); pg.wait_for_timeout(4000)
    print('icons', pg.evaluate("()=>Object.keys(__LD.ITEMS).filter(id=>__LD.Models.icon(id)).length"), '/', pg.evaluate("()=>Object.keys(__LD.ITEMS).length"))
    pg.evaluate("()=>__LD.Audio.init()")
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<120&&Math.abs(pl.pos.z)<120){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(30);
      const p=L.G.player; p.hp=1e9; for (const c of L.CHARS) if(!c.isPlayer){ c.alive=false; c.root.visible=false; }
      for(let t=0;t<3000;t++){ const x=(Math.random()-0.5)*400, z=(Math.random()-0.5)*400; let ok=true; for(let k=0;k<12;k++){ if(!L.Nav.isFree(x+Math.cos(k)*7, z+Math.sin(k)*7)){ok=false;break;} } if(ok && window.__gh(x,z)>2){ p.pos.set(x, window.__gh(x,z), z); break; } }
      p.yaw = 0.6; p.pitch = -0.02; L.sim(10); }""")
    def gear(w, att=None, mag=None):
        pg.evaluate("""([w,att,mag])=>{ const L=__LD, p=L.G.player, I=L.ITEMS; const wi=L.fns.newWeapon(w, mag===null?I[w].mag:mag); Object.assign(wi.att, att||{});
          p.inv.weapons=[wi,null,w==='p19'?null:L.fns.newWeapon('p19',15)]; if(w==='p19'){p.inv.weapons[2]=wi; p.inv.weapons[0]=null;} p.inv.cur=w==='p19'?2:0;
          p.inv.items={a556:200,a762:200,a9:120,a12:60,a300:40}; p.inv.gear={helmet:{id:'helm2',dur:150},vest:{id:'vest3',dur:250},bag:{id:'bag3'}}; p.rl=null; p.cycle=null; p.equipT=0; p.fireCd=0; p.burstQ=0; p.setVisibleGear(); L.Input.fire=false; L.Input.aim=false; L.sim(5); }""", [w, att, mag])
    def shot(name, wait=450): pg.wait_for_timeout(wait); pg.screenshot(path=f'{OUT}/{name}.png')
    # ---- 1. 장전 탄약 계산 ----
    print('--- reload accounting (tactical / empty): [mag, magSize, ammo used, expected, total s] ---')
    bad = 0
    for w in GUNS:
        for start in ['half', 0]:
            gear(w)
            r = pg.evaluate("""([w,start])=>{ const L=__LD, p=L.G.player, wi=p.weapon, I=L.ITEMS[w]; const ms=p.inv.magSize(wi); wi.mag = start==='half' ? Math.floor(ms/2) : 0; const before=wi.mag, a0=p.inv.count(I.ammo);
              const ok=L.fns.startReload(p); const tot=p.rl?p.rl.total:0, kind=p.rl?p.rl.kind:null; let n=0; while(p.rl && n<2000){ L.sim(1); n++; } L.sim(2);
              return {mag: wi.mag, ms, used: a0-p.inv.count(I.ammo), exp: ms-before, tot: +tot.toFixed(2), kind, ok}; }""", [w, start])
            flag = 'OK' if r['mag'] == r['ms'] and r['used'] == r['exp'] else 'BAD'
            if flag == 'BAD': bad += 1
            print(f"{w:7s} {str(start):5s} {r['kind']:6s} mag {r['mag']}/{r['ms']} used {r['used']} exp {r['exp']} t={r['tot']} {flag}")
    print('reload BAD count', bad)
    # ---- 2. 사격 모드 ----
    def press_count(w, mode_cycles, hold_frames, wait=40):
        gear(w)
        return pg.evaluate("""([cyc,hold,wait])=>{ const L=__LD, p=L.G.player; for(let i=0;i<cyc;i++){ L.Input.press('fireMode'); L.sim(1); } const s0=L.G.stats.shots, m0=p.weapon.mag;
          L.Input.fire=true; L.sim(hold); L.Input.fire=false; L.sim(wait); return {mode: L.fns.fireMode(p.weapon), shots: m0-p.weapon.mag}; }""", [mode_cycles, hold_frames, wait])
    print('--- fire modes ---')
    print('ASM burst tap(1f)', press_count('asm', 0, 1))
    print('ASM burst 2 taps', pg.evaluate("()=>{ const L=__LD,p=L.G.player,m0=p.weapon.mag; for(let k=0;k<2;k++){ L.Input.fire=true; L.sim(1); L.Input.fire=false; L.sim(30);} return m0-p.weapon.mag; }"))
    print('ASM single tap', press_count('asm', 1, 1))
    print('M416 auto 1s', press_count('m416', 0, 30))
    print('M416 single hold 1s', press_count('m416', 1, 30))
    print('MG3 auto 1s', press_count('mg3', 0, 30))
    print('MG3 slow 1s', press_count('mg3', 1, 30))
    print('M249 auto 1s', press_count('m249', 0, 30))
    print('S686 hold 1s', press_count('s686', 0, 30))
    print('S686 two taps', pg.evaluate("()=>{ const L=__LD,p=L.G.player; p.weapon.mag=2; p.fireCd=0; let n=0; for(let k=0;k<2;k++){ const m=p.weapon.mag; L.Input.fire=true; L.sim(1); L.Input.fire=false; L.sim(6); n+=m-p.weapon.mag;} return n; }"))
    print('VK9 mode cycle', pg.evaluate("()=>{ const L=__LD; L.fns.newWeapon; return 0 }"), press_count('vk9', 1, 30))
    # ---- 4. 뷰모델 스크린샷 ----
    if SHOTS:
        for w in GUNS:
            gear(w)
            pg.evaluate("()=>{ __LD.G.firstPerson=true; __LD.sim(12); }"); shot(f'v3_hip_{w}', 350)
            pg.evaluate("()=>{ __LD.Input.aim=true; __LD.sim(30); }"); shot(f'v3_ads_{w}', 350)
            pg.evaluate("()=>{ __LD.Input.aim=false; __LD.sim(10); }")
        def frames(w, start, fracs, att=None):
            gear(w, att, start)
            tot = pg.evaluate("()=>{ const L=__LD,p=L.G.player; L.G.firstPerson=true; L.sim(8); L.Input.press('reload'); L.sim(1); return p.rl? p.rl.total : -1; }")
            done = 0
            for f in fracs:
                steps = int((f*tot - done) * 30)
                if steps > 0: pg.evaluate(f"()=>__LD.sim({steps})")
                done += steps/30
                pg.evaluate("()=>{ __LD.G.paused=true; }"); shot(f'v3_rl_{w}_{int(f*100):02d}', 350); pg.evaluate("()=>{ __LD.G.paused=false; }")
            pg.evaluate("()=>__LD.sim(300)")
        frames('m249', 0, [0.1, 0.17, 0.4, 0.72, 0.84])
        frames('mg3', 20, [0.15, 0.72])
        frames('s686', 0, [0.25, 0.6, 0.85])
        frames('awm', 0, [0.12, 0.35, 0.83])
        frames('akm', 10, [0.14, 0.52])
        frames('aug', 10, [0.2, 0.5])
        frames('asm', 10, [0.3])
        frames('m24', 0, [0.1, 0.4])
    # ---- 5. 보급상자 ----
    print('--- airdrop ---')
    r = pg.evaluate("""()=>{ const L=__LD, p=L.G.player; const x=p.pos.x+Math.sin(p.yaw)*14, z=p.pos.z+Math.cos(p.yaw)*14; const k0=L.Airdrop.list.length; const pl=L.Airdrop.launch(x, z);
      let n=0; while(L.Airdrop.list.length===k0 && n<3000){ L.sim(1); n++; } const t0=n, d=L.Airdrop.list[k0]; while(d && !d.landed && n<6000){ L.sim(1); n++; } L.sim(60); return { planeFrames: t0, fallFrames: n-t0, landed: d && d.landed, items: d ? d.items.map(i=>i.id) : null, markers: L.Airdrop.markers().length }; }""")
    print(r)
    pg.evaluate("()=>{ const L=__LD,p=L.G.player; L.G.firstPerson=false; p.pitch=-0.12; L.sim(20); }"); shot('v3_crate', 700)
    pg.evaluate("()=>{ const L=__LD,p=L.G.player,d=L.Airdrop.list[L.Airdrop.list.length-1]; p.pos.set(d.x-1.6, window.__gh(d.x-1.6,d.z), d.z); p.yaw=Math.PI/2; p.pitch=-0.5; L.sim(20); }"); shot('v3_crate_close', 700)
    print('pickup crate weapon', pg.evaluate("()=>{ const L=__LD,p=L.G.player,d=L.Airdrop.list[0]; const it=d.items.find(i=>L.ITEMS[i.id].type==='weapon'); L.HUD; const r=window.__pick ? 0 : 0; return it ? it.id : null; }"))
    # ---- 3. AWM 헤드샷 ----
    print('--- one-shot test (100 hp target) ---')
    for (w, helm) in [('awm','helm3'), ('m24','helm3'), ('m24','helm2'), ('slr','helm1'), ('awm', None)]:
        r = pg.evaluate("""([w,helm])=>{ const L=__LD; const t=L.CHARS.find(c=>!c.isPlayer); t.alive=true; t.hp=100; t.inv.gear.helmet = helm?{id:helm,dur:L.ITEMS[helm].dur}:null; t.inv.gear.vest=null;
          const d=L.fns.applyDamage(t, L.ITEMS[w].dmg, 'head', L.G.player, w); const out={dealt:+d.toFixed(1), alive:t.alive}; t.alive=false; return out; }""", [w, helm])
        print(w, helm, r)
    print('errors', errs[:20])
    b.close()
