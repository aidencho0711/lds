# 부활 직후 돌진 여부: 봇 스쿼드 경기에서 부활한 봇이 20초 안에 다시 기절하는 비율, 10초 동안 가장 가까운 적에게 다가간 거리
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'file:///home/claude/br/dist/index.html'
RUNS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
tot = {'rev':0, 're':0, 'closer':0, 'dd':[]}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for run in range(RUNS):
        pg = b.new_page(viewport={'width':800,'height':450}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/*', route)
        pg.goto(URL); pg.wait_for_timeout(800)
        pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:47, difficulty:'normal', queue:'normal', squad:'squad', quality:'low', shadows:'off'})); }")
        pg.reload(); pg.wait_for_timeout(1000)
        pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
        pg.evaluate("()=>document.querySelector('[data-ui=closeMap]').click()")
        pg.evaluate("""()=>{ const L=__LD,G=L.G,p=G.player; const T0=G.teams[p.team]; T0.members.splice(T0.members.indexOf(p),1); T0.members.forEach((m,i)=>{m.slot=i; m.brain.followJump=false; m.brain.dropTarget={x:(Math.random()-0.5)*30,z:(Math.random()-0.5)*30}; m.brain.jumpAt=20+i*0.4;});
          G.teams.push({id:G.teams.length, members:[p], place:0}); p.team=G.teams.length-1; p.hp=1e9;
          window.__ev=[]; const B=L.Brain.prototype, oR=B.onRevived, oK=B.onKnocked;
          const nearest=(c)=>{ let bd=1e9; for(const o of L.CHARS) if(o.alive&&!o.knocked&&o.team!==c.team&&!o.isPlayer&&o.mode==='ground'){ const d=Math.hypot(o.pos.x-c.pos.x,o.pos.z-c.pos.z); if(d<bd) bd=d; } return bd; };
          window.__nearest=nearest;
          B.onRevived=function(){ __ev.push({k:'rev', t:G.time, c:this.c, d0:nearest(this.c)}); return oR.call(this); };
          B.onKnocked=function(){ __ev.push({k:'kn', t:G.time, c:this.c}); return oK.call(this); };
          for(let i=0;i<3000;i++){ L.sim(1); const pl=G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } }""")
        for step in range(60):
            r = pg.evaluate("""()=>{ const L=__LD,G=L.G; for(let i=0;i<300;i++){ L.sim(1,1/30); if(i%15===0) for(const e of __ev){ if(e.k==='rev' && e.d10===undefined && G.time-e.t>=10) e.d10=e.c.alive&&!e.c.knocked? __nearest(e.c) : -1; if(e.k==='rev' && G.time-e.t<20 && e.c.alive && !e.c.knocked){ e.st=e.st||[]; const s=e.c.brain.state+(e.c.heal?'+h':'')+(e.c.brain.cautious?'':'!'); if(e.st[e.st.length-1]!==s) e.st.push(s); } } }
               const alive=G.teams.filter(T=>!T.members.includes(G.player)&&T.members.some(m=>m.alive)).length; return alive; }""")
            if r <= 1: break
        res = pg.evaluate("""()=>{ const revs=__ev.filter(e=>e.k==='rev'); let re=0, closer=0; const dd=[];
            for(const e of revs){ if(__ev.some(k=>k.k==='kn'&&k.c===e.c&&k.t>e.t&&k.t-e.t<20)) re++; if(e.d10!==undefined && e.d10>0 && e.d0<300){ dd.push(Math.round(e.d0-e.d10)); if(e.d0-e.d10>8) closer++; } }
            const seq=revs.filter(e=>__ev.some(k=>k.k==='kn'&&k.c===e.c&&k.t>e.t&&k.t-e.t<20)).map(e=>Math.round(e.d0)+'m:'+(e.st||[]).join('>')+' hp'+Math.round(e.c.hp)+' heals'+e.c.inv.healCount());
            return {revives:revs.length, reknock20:re, closer8:closer, dd, t:Math.round(__LD.G.time), seq}; }""")
        print(run, res, errs[:2])
        tot['rev'] += res['revives']; tot['re'] += res['reknock20']; tot['closer'] += res['closer8']; tot['dd'] += res['dd']
        pg.close()
    b.close()
print('TOTAL revives', tot['rev'], 'reknock<20s', tot['re'], f"({tot['re']/max(1,tot['rev'])*100:.0f}%)", 'moved >8m closer', tot['closer'], 'of', len(tot['dd']), 'median closer', sorted(tot['dd'])[len(tot['dd'])//2] if tot['dd'] else None)
