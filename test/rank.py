# 랭크전: 계산 단위 테스트 + 로비/티어표/결과 화면 스크린샷
from playwright.sync_api import sync_playwright
import json
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
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', bots:10, view:'tpp'})); }"); pg.reload(); pg.wait_for_timeout(1500)
    # 1) 잠김 상태
    pg.click('#segQueue button.ranked'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'r1_locked.png')
    print('queue after locked click', pg.evaluate("()=>JSON.parse(localStorage.getItem('lastdrop.settings')).queue"))
    # 2) 단위 계산
    print(pg.evaluate("""()=>{ const R=__LD.Rank; const t=(rp)=>R.tierOf(rp).label + (R.tierOf(rp).top?'(top)':'');
      return { b: [0,99,100,399,400,1199,1200,1999,2000,2399,2400,3599,3600,3899,3900,5000].map(v=>v+':'+t(v)),
        d: [[1,41,6,800,true],[2,41,3,400,false],[5,41,2,300,false],[10,41,1,150,false],[21,41,0,40,false],[41,41,0,0,false]].map(([pl,tot,k,dm,w])=>[pl,k, ...[0,3,6,9].map(ti=>R.rpDelta({place:pl,total:tot,kills:k,dmg:dm,win:w}, ti))]),
        quit: R.rpDelta({place:5,total:41,kills:3,dmg:300,win:false,quit:true},3) }; }"""))
    # 3) 레벨 3으로 → 배치고사 3판 시뮬레이션 (apply 직접)
    print(pg.evaluate("""()=>{ const L=__LD; localStorage.setItem('lastdrop.stats', JSON.stringify({matches:6,wins:0,kills:9,xp:560,best:4,recent:[]})); return 0; }"""))
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#segQueue button.ranked'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'r2_placement_lobby.png')
    out = pg.evaluate("""()=>{ const R=__LD.Rank; const res=[]; for (const g of [{place:3,total:41,kills:4,dmg:520,win:false},{place:1,total:41,kills:7,dmg:900,win:true},{place:12,total:41,kills:1,dmg:150,win:false}]) res.push(R.apply(g)); return {res, state: R.state}; }""")
    print(json.dumps(out, ensure_ascii=False)[:900])
    print('after 10 avg games', pg.evaluate("""()=>{ const R=__LD.Rank; const seq=[]; for(let i=0;i<10;i++){ const r=R.apply({place:1+Math.floor(i*3.7)%20,total:41,kills:i%4,dmg:200+i*40,win:false}); seq.push(r.delta); } return [seq, R.tierOf(R.state.rp).label, R.state.rp]; }"""))
    pg.evaluate("()=>{ __LD.HUD.renderLobby(); }"); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'r3_ranked_lobby.png')
    pg.click('#rankCard'); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'r4_tiers.png'); pg.click('[data-ui=closeRanks]')
    # 4) 대형 맵 경고
    pg.click('#mapCard'); pg.evaluate("()=>{ [...document.querySelectorAll('#mapGrid .map-opt')].find(b=>b.textContent.includes('노르덴')).click(); }"); pg.wait_for_timeout(400); pg.screenshot(path=OUT+'r5_bigwarn.png')
    pg.evaluate("()=>{ [...document.querySelectorAll('#mapGrid .map-opt')][0].click(); __LD.G.ui('closeMapPick'); }")
    # 5) 실제 랭크 경기 → 결과 화면 (빠르게: 시작 후 플레이어 사망 처리)
    pg.evaluate("()=>{ const R=__LD.Rank; R._set({rp: 1590}); }")
    pg.evaluate("()=>__LD.G.startMatch()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    print('ranked match', pg.evaluate("()=>({ranked: __LD.G.ranked, chars: __LD.CHARS.length, diffs: __LD.CHARS.filter(c=>c.brain).reduce((m,c)=>{const k=c.brain.d.key; m[k]=(m[k]||0)+1; return m;},{})})"))
    pg.evaluate("""()=>{ const L=__LD; document.querySelector('[data-ui=closeMap]').click(); for(let i=0;i<900 && L.G.player.mode==='plane';i++){ L.sim(1); if(L.G.plane.t>6) L.Input.press('interact'); } for(let i=0;i<3000 && L.G.player.mode!=='ground';i++) L.sim(1);
      const p=L.G.player; p.kills=5; p.damageDealt=700; for(const c of L.CHARS) if(!c.isPlayer && Math.random()<0.85) { c.alive=false; } L.fns.applyDamage(p, 1e4, 'body', null, 'zone'); for(let i=0;i<200 && L.G.state==='play';i++) L.sim(1); }""")
    pg.wait_for_timeout(1500); pg.screenshot(path=OUT+'r6_result.png')
    print('result', json.dumps(pg.evaluate("()=>__LD.G.rankResult"), ensure_ascii=False))
    print('errors', errs)
    b.close()
