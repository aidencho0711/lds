# 모바일: 회복·투척 버튼 위 선택 팝업, 터치로 핀→투척, 점프 버튼 '넘기', 소리 방향 표시
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (915, 411)
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
def center(pg, sel):
    return pg.evaluate(f"()=>{{const r=document.querySelector('{sel}').getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2, r.left, r.top, r.width, r.height]}}")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':W,'height':H}, has_touch=True, is_mobile=True); pg = ctx.new_page(); pg.route('**/*', route); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:5, map:'kalden', squad:'solo'})); }"); pg.reload(); pg.wait_for_timeout(1000)
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("""()=>{ document.querySelector('[data-ui=closeMap]').click(); const L=__LD; for(let i=0;i<4000;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<150&&Math.abs(pl.pos.z)<150){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<5000 && L.G.player.mode!=='ground';i++) L.sim(1);
      const G=L.G,p=G.player; for(const c of L.CHARS) if(!c.isPlayer){ c.brain.update=()=>{}; c.pos.x+=900; }
      p.inv.gear.bag={id:'bag3'}; p.inv.weapons[0]=L.fns.newWeapon('m416',30); p.inv.items.a556=90; p.inv.cur=0; p.setVisibleGear();
      p.inv.add('bandage',5); p.inv.add('firstaid',2); p.inv.add('medkit',1); p.inv.add('drink',2); p.inv.add('frag',3); p.inv.add('smoke',2); p.hp=62; L.sim(5); }""")
    print('labels', pg.evaluate("()=>['jump','heal','throw','fire'].map(k=>document.getElementById('tb_'+k).textContent)"))
    hb = center(pg, '#tb_heal'); pg.touchscreen.tap(hb[0], hb[1]); pg.wait_for_timeout(250)
    q = pg.evaluate("()=>{const q=document.getElementById('qpop'), r=q.getBoundingClientRect(); return {hidden:q.hidden, items:[...q.querySelectorAll('.qi')].map(e=>e.textContent), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}}")
    print('heal popup', q, 'btn', [round(v) for v in hb[2:]])
    pg.screenshot(path=f'{OUT}/q1_heal_pop.png')
    # 구급상자 선택
    fa = pg.evaluate("()=>{const e=[...document.querySelectorAll('#qpop .qi')].find(e=>e.textContent.includes('구급')); const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}")
    pg.touchscreen.tap(fa[0], fa[1]); pg.evaluate("()=>__LD.sim(3)")
    print('after pick', pg.evaluate("()=>({heal:__LD.G.player.heal&&__LD.G.player.heal.id, pop:document.getElementById('qpop').hidden, healLbl:document.getElementById('tb_heal').textContent})"))
    # 회복 중 회복 버튼 = 취소
    pg.touchscreen.tap(hb[0], hb[1]); pg.evaluate("()=>__LD.sim(2)")
    print('cancel heal', pg.evaluate("()=>({heal:!!__LD.G.player.heal, lbl:document.getElementById('tb_heal').textContent})"))
    # 투척 팝업
    tb = center(pg, '#tb_throw'); pg.touchscreen.tap(tb[0], tb[1]); pg.wait_for_timeout(250)
    q = pg.evaluate("()=>{const q=document.getElementById('qpop'), r=q.getBoundingClientRect(); return {hidden:q.hidden, items:[...q.querySelectorAll('.qi')].map(e=>e.textContent), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}}")
    print('throw popup', q, 'btn', [round(v) for v in tb[2:]])
    pg.screenshot(path=f'{OUT}/q2_throw_pop.png')
    fr = pg.evaluate("()=>{const e=[...document.querySelectorAll('#qpop .qi')].find(e=>e.textContent.includes('수류탄')); const r=e.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2]}")
    pg.touchscreen.tap(fr[0], fr[1]); pg.evaluate("()=>{ const p=__LD.G.player; p.pitch=0.2; __LD.sim(5); }")
    print('throw mode', pg.evaluate("()=>({tm:__LD.G.player.throwMode, labels:['fire','fire2','throw'].map(k=>document.getElementById('tb_'+k).textContent)})"))
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/q3_throw_ready.png')
    # 사격 버튼 누르고 있기 → 핀 → 1.5초 → 떼기
    fb = center(pg, '#tb_fire')
    pg.evaluate(f"""()=>{{ const el=document.getElementById('tb_fire'); el.dispatchEvent(new PointerEvent('pointerdown',{{pointerId:81,pointerType:'touch',clientX:{fb[0]},clientY:{fb[1]},bubbles:true}})); __LD.sim(45); }}""")
    print('cook', pg.evaluate("()=>({pin:__LD.G.player.throwMode&&__LD.G.player.throwMode.pin, num:document.getElementById('fuseNum').textContent, lbl:document.getElementById('tb_fire').textContent})"))
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/q4_cook.png')
    pg.evaluate(f"""()=>{{ const el=document.getElementById('tb_fire'); el.dispatchEvent(new PointerEvent('pointerup',{{pointerId:81,pointerType:'touch',clientX:{fb[0]},clientY:{fb[1]},bubbles:true}})); __LD.sim(3); }}""")
    print('thrown', pg.evaluate("()=>({tm:!!__LD.G.player.throwMode, nade:!!__LD.G.myNade, left:__LD.G.myNade&&+(__LD.G.myNade.fuse-__LD.G.myNade.t).toFixed(2), frag:__LD.G.player.inv.count('frag')})"))
    # 소리 방향: 왼쪽 15m 발소리, 오른쪽 뒤 80m 총소리, 앞 6m 적 수류탄
    pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const e=L.CHARS.find(c=>!c.isPlayer); e.pos.set(p.pos.x+Math.cos(p.yaw)*15, p.pos.y, p.pos.z-Math.sin(p.yaw)*15);
       const R={x:-Math.cos(p.yaw),z:Math.sin(p.yaw)}, F={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
       window.__snd=()=>{ G.noises.push({x:p.pos.x-R.x*15,y:p.pos.y,z:p.pos.z-R.z*15,t:G.time,r:18,by:e,kind:'step'}); G.noises.push({x:p.pos.x+R.x*60-F.x*50,y:p.pos.y,z:p.pos.z+R.z*60-F.z*50,t:G.time,r:260,by:L.CHARS.filter(c=>!c.isPlayer)[1],kind:'shot'}); };
       __snd(); L.sim(1); }""")
    pg.wait_for_timeout(100)
    pg.evaluate("()=>{ __snd(); __LD.sim(1); }")
    pg.screenshot(path=f'{OUT}/q5_sound.png')
    print('snd canvas', pg.evaluate("()=>{ const c=document.getElementById('sndCv'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0, L=0, R=0, B=0; for(let i=0;i<d.length;i+=4) if(d[i+3]>20){ n++; const x=(i/4)%c.width, y=Math.floor(i/4/c.width); if(x<c.width*0.35) L++; if(x>c.width*0.65) R++; if(y>c.height*0.6) B++; } return {n,L,R,B}; }"))
    # 점프 버튼: 앞에 1m 담 → '넘기'
    pg.evaluate("""()=>{ const L=__LD,W=L.W,p=L.G.player; p.throwMode=null; const fx=Math.sin(p.yaw), fz=Math.cos(p.yaw); const cx=p.pos.x+fx*0.85, cz=p.pos.z+fz*0.85, y=p.pos.y; const HALF=350,CGN=Math.round(Math.sqrt(W.grid.length));
       const x0=cx-Math.abs(fz)*1.2-Math.abs(fx)*0.12, x1=cx+Math.abs(fz)*1.2+Math.abs(fx)*0.12, z0=cz-Math.abs(fx)*1.2-Math.abs(fz)*0.12, z1=cz+Math.abs(fx)*1.2+Math.abs(fz)*0.12;
       const b={x0,y0:y,z0,x1,y1:y+1.0,z1,soft:false,nav:false,_q:0,kind:'solid'}; for(let j=Math.floor((z0+HALF)/8)-1;j<=Math.floor((z1+HALF)/8)+1;j++) for(let i=Math.floor((x0+HALF)/8)-1;i<=Math.floor((x1+HALF)/8)+1;i++){ const k=j*CGN+i; if(Object.isFrozen(W.grid[k])) W.grid[k]=[]; W.grid[k].push(b); }
       L.sim(6); }""")
    print('jump label near wall', pg.evaluate("()=>({lbl:document.getElementById('tb_jump').textContent, cls:document.getElementById('tb_jump').className, hint:__LD.G.player.vaultHint})"))
    jb = center(pg, '#tb_jump'); pg.touchscreen.tap(jb[0], jb[1]); pg.evaluate("()=>__LD.sim(2)")
    print('vaulting', pg.evaluate("()=>!!__LD.G.player.vault"))
    # 겹침 검사: 팝업이 화면 밖으로 나가지 않는지 (다른 해상도)
    print('errors', errs[:5])
    b.close()
