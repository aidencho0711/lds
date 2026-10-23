# 미니맵-버튼 겹침, 왼쪽 위 생존·처치, 모바일 알림, 산탄총 조준선
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots/sq/'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
OVL = """()=>{ const rect=(e)=>{const r=e.getBoundingClientRect(); return r.width&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'?r:null;};
  const items=[['minimap',document.getElementById('mini')],['counters',document.getElementById('counters')],['bag',document.getElementById('hbBag')],['menu',document.getElementById('hbMenu')],['compass',document.getElementById('compass')],['zone',document.getElementById('zoneInfo')],['team',document.getElementById('teamPanel')],['killfeed',document.getElementById('killfeed')]]
    .concat([...document.querySelectorAll('#tbtns .tbtn')].map(b=>[b.id.slice(3),b]));
  const R=items.map(([n,e])=>[n,rect(e)]).filter(x=>x[1]); const bad=[];
  for(let i=0;i<R.length;i++) for(let j=i+1;j<R.length;j++){ const a=R[i][1], b=R[j][1]; const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left), oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top); if(ox>2&&oy>2) bad.push(R[i][0]+'×'+R[j][0]+' '+Math.round(ox)+'x'+Math.round(oy)); }
  const m=rect(document.getElementById('mini')), c=rect(document.getElementById('counters'));
  const t=rect(document.getElementById('teamPanel'));
  return {team: t&&[t.left,t.top,t.width,t.height].map(Math.round), bad, mini:m&&[m.left,m.top,m.width].map(Math.round), counters:c&&[c.left,c.top,c.width,c.height].map(Math.round)}; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for (w,h,mob) in [(891,355,True),(915,411,True),(844,390,True),(780,330,True),(1280,720,False)]:
        ctx = b.new_context(viewport={'width':w,'height':h}, has_touch=mob, is_mobile=mob); pg = ctx.new_page(); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
        pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:11, map:'kalden', squad:'squad'})); }"); pg.reload(); pg.wait_for_timeout(1000)
        pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
        pg.evaluate("""()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<4000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<5000 && L.G.player.mode!=='ground';i++) L.sim(1); L.sim(20);
          const p=L.G.player; p.hp=1e9; p.inv.weapons[0]=L.fns.newWeapon('s686',2); p.inv.items.a12=20; p.inv.cur=0; p.setVisibleGear(); p.equipT=0; L.sim(5);
          for(const t of ['적 발견! 북동쪽 60m','10초 후 안전 구역이 줄어듭니다','Raven: 이동한다']) L.HUD.toast(t,'info'); L.sim(2); }""")
        pg.evaluate("()=>{ for(const t of ['Havoc: 적 발견! 북동쪽 60m','10초 후 안전 구역이 줄어듭니다','Raven: 이동한다']) __LD.HUD.toast(t,'info'); }")
        r = pg.evaluate(OVL)
        print((w,h), 'team', r['team'], 'overlaps:', r['bad'] or 'none', 'mini', r['mini'], 'counters', r['counters'], 'toasts', pg.evaluate("()=>{const b=document.getElementById('toasts').getBoundingClientRect(); return [[...document.querySelectorAll('#toasts .toast')].filter(t=>getComputedStyle(t).display!=='none').length, Math.round(b.left), Math.round(b.top), Math.round(b.width)]}"), 'sg', pg.evaluate("()=>document.getElementById('crosshair').className"), errs[:2])
        pg.screenshot(path=OUT+f'hud_{w}x{h}.png')
        if (w,h)==(1280,720):
            pg.evaluate("()=>{ __LD.Input.keys.KeyW=true; __LD.sim(20); }"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'hud_sg_moving.png'); pg.evaluate("()=>{ __LD.Input.keys.KeyW=false; }")
        if (w,h)==(891,355):
            pg.evaluate("()=>__LD.Touch.openEditor()"); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'hud_editor_891.png')
        ctx.close()
    b.close()
