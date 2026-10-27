# 데스매치(혼자): 로딩, 4대4 구성, 무기 규칙, 부활·보호, 점수, 웨폰 교체, 시간/40킬 종료, 결과·경험치
import sys, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
TYPE = sys.argv[2] if len(sys.argv) > 2 else 'tdm'
VW, VH = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1280, 720)
MOB = VW < 1000
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width':VW,'height':VH}, has_touch=MOB, is_mobile=MOB)
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'low', shadows:'off', view:'tpp', difficulty:'normal'})); }")
    pg.reload(); pg.wait_for_timeout(1300)
    # 맵 카드 → 모드 선택
    pg.click('#mapCard'); pg.wait_for_timeout(250)
    pg.click(f"#gameGrid .game-opt:nth-child({2 if TYPE=='tdm' else 3})"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}/d00_pick.png')
    pg.click('[data-ui=closeMapPick]'); pg.wait_for_timeout(200)
    print('lobby', pg.evaluate("()=>({top:mcTop.textContent, name:mcName.textContent, sub:playSub.textContent, brief:matchBrief.textContent})"))
    pg.screenshot(path=f'{OUT}/d01_lobby.png')
    t0 = time.time(); pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    print('load', round(time.time()-t0, 1), 's')
    S = "()=>{const L=__LD,G=L.G,D=G.dm,p=G.player; return {type:D.type, score:D.score.slice(), chars:L.CHARS.length, teams:G.teams.map(t=>t.members.length), alive:L.CHARS.filter(c=>c.alive).length, guns:[...new Set(L.CHARS.map(c=>c.weapon&&c.weapon.id+'/'+c.weapon.att.scope))].join(' '), p:{hp:Math.round(p.hp), alive:p.alive, k:p.kills, d:p.dmDeaths||0, gear:[p.inv.gear.helmet&&p.inv.gear.helmet.id,p.inv.gear.vest&&p.inv.gear.vest.id]}, t:Math.round(G.time), over:G.over}}"
    print('start', pg.evaluate(S))
    pg.evaluate("()=>__LD.sim(20)"); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/d02_spawn.png')
    # 봇끼리 60초 진행 (플레이어는 무적 처리하지 않음)
    for k in range(6):
        pg.evaluate("()=>__LD.sim(30*10)")
        print(f'{(k+1)*10}s', pg.evaluate(S), pg.evaluate("()=>__LD.states()"))
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/d03_fight.png')
    # 부활·보호: 플레이어를 적이 죽였다고 처리
    r = pg.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; if(!p.alive){L.sim(30*3.5);} const e=L.CHARS.find(c=>c.team!==p.team); const s0=G.dm.score[e.team];
      L.fns.applyDamage(p, 500, 'head', e, 'm416'); const dead=!p.alive, s1=G.dm.score[e.team]; L.sim(30*1.5); const mid={alive:p.alive, resp:document.getElementById('dmRespawn').hidden===false};
      L.sim(30*2); const prot=p.spawnProt>G.time; const d2=L.fns.applyDamage(p, 50, 'body', e, 'm416'); L.sim(30*2.5); const d3=L.fns.applyDamage(p, 20, 'body', e, 'm416');
      return {dead, scoreUp:s1-s0, mid, respawned:p.alive, prot, dmgDuringProt:d2, dmgAfter:Math.round(d3), z:Math.round(p.pos.z), wid:p.weapon&&p.weapon.id}; }""")
    print('respawn', r)
    pg.screenshot(path=f'{OUT}/d04_after.png')
    # 웨폰 데스매치: 처치 시 무기 교체 / 팀 데스매치: 무기 고정
    r = pg.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; L.sim(30*3); const w0=p.weapon.id+'/'+p.weapon.att.scope; const e=L.CHARS.find(c=>c.team!==p.team&&c.alive&&!(c.spawnProt>G.time)); if(!e) return 'no target';
      L.fns.applyDamage(e, 500, 'head', p, p.weapon.id); return {before:w0, after:p.weapon.id+'/'+p.weapon.att.scope, mag:p.weapon.mag, kills:p.kills}; }""")
    print('kill swap', r)
    # 40킬 종료
    r = pg.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; G.dm.score[p.team]=39; L.sim(30*3.6); if(!p.alive) L.sim(30*3.6); const e=L.CHARS.find(c=>c.team!==p.team&&c.alive&&!(c.spawnProt>G.time)); L.fns.applyDamage(e, 500, 'head', p, p.weapon.id); const ov=G.over; L.sim(30*3); return {over:ov, state:G.state, win:G.win, score:G.dm&&G.dm.score}; }""")
    print('finish', r)
    pg.wait_for_timeout(400)
    print('result', pg.evaluate("()=>({kick:resKicker.textContent, title:resTitle.textContent, rank:resRank.textContent, xp:resXp.textContent, note:resNote.textContent, dm:JSON.parse(localStorage.getItem('lastdrop.stats')).dm, xpTotal:JSON.parse(localStorage.getItem('lastdrop.stats')).xp})"))
    pg.screenshot(path=f'{OUT}/d05_result.png')
    pg.click('[data-ui=lobby]'); pg.wait_for_timeout(500)
    pg.click('[data-tab=record]'); pg.wait_for_timeout(200)
    print('record', pg.evaluate("()=>({recent:document.getElementById('recent').textContent, dm:rcDm.textContent, kd:rcDmKd.textContent})"))
    pg.screenshot(path=f'{OUT}/d06_record.png')
    print('errors', logs[:8])
