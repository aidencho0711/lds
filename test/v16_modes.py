# v16 모드 확인: 팀 데스매치(총 지정)·웨폰 데스매치(전 총기 순환)·훈련장 무기고, 봇이 새 장전 방식을 끝까지 쓰는지
#  사용: python3 test/v16_modes.py OUT
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
SAMPLE = """(n)=>{ const L=__LD, seen={}, shots={}; let kills0=L.G.dm?L.G.dm.score[0]+L.G.dm.score[1]:0;
  for(let i=0;i<n;i++){ L.sim(1); for(const c of L.CHARS){ if(c.rl){ const k=c.weapon.id+':'+c.rl.kind+(c.rl.clip?'+clip':'')+(c.rl.empty?'/e':'/t'); seen[k]=(seen[k]||0)+1; } if(c.cycle){ const k=c.weapon.id+':cyc:'+c.cycle.kind; seen[k]=(seen[k]||0)+1; } } }
  const sc=L.G.dm?L.G.dm.score:null; return { seen:Object.keys(seen).sort(), score:sc, time:Math.round(L.G.time), shots:L.G.stats.shots }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 960, 'height': 540}); pg.route('**/*', route)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}')); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', view:'tpp', difficulty:'hard'})); }")
    pg.reload(); pg.wait_for_timeout(2000)
    res = {}
    # 1) 팀 데스매치: 특수 장전 총들로 한 판씩 (봇 7명 + 나, 나는 가만히)
    for gun in ['win94', 'kar98k', 's1897', 'dp28', 'tommy', 'bizon', 'beryl', 'm16a4', 'vector', 'deagle']:
        pg.evaluate("(g)=>{ __LD.DM.start({ type:'tdm', loadout:{ id:g, scope: __LD.fns.attFits('x2', g) ? 'x2' : null } }); }", gun)
        pg.wait_for_function("()=>window.__LD.G.state==='play' && window.__LD.G.dm", timeout=120000)
        r = pg.evaluate(SAMPLE, 1800)   # 60초
        r['all'] = pg.evaluate("(g)=>__LD.CHARS.every(c=>!c.weapon || c.weapon.id===g)", gun)
        res['tdm_' + gun] = r
        pg.screenshot(path=f'{OUT}/m_tdm_{gun}.png')
    # 2) 웨폰 데스매치: 모두에게 24종을 차례로 쥐여 주며 진행
    pg.evaluate("()=>{ __LD.DM.start({ type:'wdm' }); }")
    pg.wait_for_function("()=>window.__LD.G.state==='play' && window.__LD.G.dm", timeout=120000)
    guns = pg.evaluate("()=>__LD.DM.ALL_GUNS")
    seen_all = set()
    for i, g in enumerate(guns):
        pg.evaluate("""([g,i])=>{ const L=__LD; for(const c of L.CHARS){ if(!c.alive) continue; const lo={ id: L.DM.ALL_GUNS[(L.DM.ALL_GUNS.indexOf(g)+L.CHARS.indexOf(c))%L.DM.ALL_GUNS.length], scope:null }; c.dmLoad=lo; L.DM.equip(c, lo, false); } }""", [g, i])
        r = pg.evaluate(SAMPLE, 240)
        seen_all.update(r['seen'])
    res['wdm'] = { 'guns': len(guns), 'seen': sorted(seen_all), 'score': pg.evaluate("()=>__LD.G.dm.score") }
    pg.screenshot(path=f'{OUT}/m_wdm.png')
    print(json.dumps(res, ensure_ascii=False, indent=1))
    print('\n'.join(logs[:20]))
    b.close()
