import sys, time, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
SQ = sys.argv[2] if len(sys.argv) > 2 else 'squad'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:23, difficulty:'normal', queue:'normal'})); }")
    pg.reload(); pg.wait_for_timeout(1500)
    # 경기 설정에서 팀 구성 선택
    pg.click('[data-ui=matchCfg]'); pg.wait_for_timeout(300)
    pg.click(f"#segSquad button:nth-child({ {'solo':1,'duo':2,'squad':3}[SQ] })"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/sq_01_cfg.png')
    pg.click('[data-ui=closeMatchCfg]'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/sq_02_lobby.png')
    print('lobby', pg.evaluate("()=>({top:document.getElementById('mcTop').textContent, players:document.getElementById('mcPlayers').textContent, brief:document.getElementById('matchBrief').textContent, sub:document.getElementById('playSub').textContent})"))
    pg.click('#playBtn'); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.click('[data-ui=closeMap]')
    print('teams', pg.evaluate("()=>{const G=__LD.G; return {size:G.teamSize, n:G.teams.length, sizes:G.teams.map(t=>t.members.length), mine:G.teams[0].members.map(m=>m.name+':'+m.slot)}}"))
    # 섬 위에서 강하, 착지까지
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } }""")
    pg.evaluate("()=>__LD.sim(40)")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/sq_03_fall.png')
    for i in range(40):
        if pg.evaluate("()=>{const L=__LD; L.sim(30); return L.G.teams[0].members.every(m=>m.mode==='ground');}"): break
    print('landed', pg.evaluate("()=>{const G=__LD.G,p=G.player; return G.teams[0].members.map(m=>[m.name, m.mode, Math.round(Math.hypot(m.pos.x-p.pos.x,m.pos.z-p.pos.z))])}"))
    # 다른 팀의 착지 분포: 팀원끼리 거리
    print('enemy team spread', pg.evaluate("()=>{const G=__LD.G; return G.teams.slice(1).map(T=>{const a=T.members[0]; return Math.round(Math.max(...T.members.map(m=>Math.hypot(m.brain.dropTarget.x-a.brain.dropTarget.x,m.brain.dropTarget.z-a.brain.dropTarget.z))));})}"))
    pg.evaluate("()=>__LD.sim(30*3)")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/sq_04_ground.png')
    # 아군 사격 무효
    print('friendly fire dmg', pg.evaluate("()=>{const G=__LD.G,p=G.player,m=G.teams[0].members[1]; const hp=m.hp; const d=__LD.fns.applyDamage(m,50,'body',p,'m416'); return [d, hp, m.hp]}"))
    # 플레이어가 기절한 팀원 부활
    pg.evaluate("()=>{const G=__LD.G,p=G.player; const m=G.teams[0].members[1]; const e=G.teams[1].members[0]; m.hp=1; __LD.fns.applyDamage(m,30,'body',e,'m416'); m.pos.set(p.pos.x+1.0,p.pos.y,p.pos.z); m.vel.set(0,0,0); m.brain.crawlGoal=null; }")
    pg.evaluate("()=>__LD.sim(2)")
    print('mate knocked', pg.evaluate("()=>{const G=__LD.G,m=G.teams[0].members[1]; return {knocked:m.knocked, near:!!__LD.nearestKnockedMate(G.player,1.9), prompt:document.getElementById('vehPrompt').textContent, hidden:document.getElementById('vehPrompt').hidden}}"))
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/sq_05_revivePrompt.png')
    pg.evaluate("()=>{__LD.Input.press('interact'); __LD.sim(30*4);}")
    pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/sq_06_reviving.png')
    print('reviving', pg.evaluate("()=>{const p=__LD.G.player; return p.revive?{t:p.revive.t.toFixed(1), tgt:p.revive.tgt.name}:null}"))
    pg.evaluate("()=>__LD.sim(30*7)")
    print('after revive', pg.evaluate("()=>{const G=__LD.G,m=G.teams[0].members[1],p=G.player; return {knocked:m.knocked, hp:m.hp, revives:p.revives, state:m.brain.state}}"))
    # 플레이어 기절 → HUD → 봇 팀원이 부활
    pg.evaluate("()=>{const G=__LD.G,p=G.player,e=G.teams[1].members[0]; p.hp=5; __LD.fns.applyDamage(p,40,'body',e,'m416');}")
    print('player knocked', pg.evaluate("()=>{const p=__LD.G.player; return {alive:p.alive, knocked:p.knocked, hp:p.hp, stance:p.stance, by:p.knockedBy&&p.knockedBy.name}}"))
    pg.evaluate("()=>{__LD.Input.keys.KeyW=true; __LD.sim(45); __LD.Input.keys.KeyW=false;}")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/sq_07_knocked.png')
    res = None
    for i in range(45):
        r = pg.evaluate("()=>{const L=__LD,G=L.G,p=G.player; L.sim(30); return {t:Math.round(G.time), hp:Math.round(p.hp), knocked:p.knocked, alive:p.alive, rev:p.revivedBy?p.revivedBy.name:null, mates:G.teams[0].members.slice(1).map(m=>m.brain.state+':'+Math.round(Math.hypot(m.pos.x-p.pos.x,m.pos.z-p.pos.z)))}}")
        if i % 4 == 0 or not r['knocked']: print(r)
        if r['rev'] and not res: pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/sq_08_beingRevived.png'); res = 1
        if not r['knocked'] or not r['alive']: break
    # 팀 전멸: 적 팀 하나 — 1명 기절, 나머지 처치
    print('wipe', pg.evaluate("""()=>{const G=__LD.G,T=G.teams[2],p=G.player; const al=T.members.filter(m=>m.alive); if(al.length<2) return 'skip';
       al[0].hp=1; __LD.fns.applyDamage(al[0],20,'body',p,'m416'); const k0=al[0].knocked;
       for(const m of al.slice(1)){ if(!m.alive) continue; m.hp=1; __LD.fns.applyDamage(m,20,'body',p,'m416'); }
       return {firstKnocked:k0, after:T.members.map(m=>(m.alive?'A':'D')+(m.knocked?'K':'')), place:T.place, kills:p.kills, knocks:p.knocks, aliveTeams:G.teams.filter(t=>t.members.some(m=>m.alive)).length}}"""))
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/sq_09_feed.png')
    # 플레이어 사망 → 관전
    pg.evaluate("()=>{const G=__LD.G,p=G.player,e=G.teams[1].members.find(m=>m.alive)||null; p.hp=1; __LD.fns.applyDamage(p,50,'body',e,'m416'); if(p.alive){ p.hp=1; __LD.fns.applyDamage(p,500,'body',e,'m416'); } __LD.sim(30);}")
    print('spectate', pg.evaluate("()=>{const G=__LD.G,p=G.player; return {alive:p.alive, spec:G.spec&&G.spec.name, over:G.over, cls:document.body.className}}"))
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/sq_10_spectate.png')
    # 나머지 경기 진행 (팀원 관전 상태로 끝까지)
    t0 = time.time()
    for step in range(80):
        r = pg.evaluate("""()=>{const L=__LD,G=L.G; L.sim(30*15,1/30); const C=L.CHARS;
          return {t:Math.round(G.time), alive:C.filter(c=>c.alive).length, knocked:C.filter(c=>c.alive&&c.knocked).length, teams:G.teams.filter(T=>T.members.some(m=>m.alive)).length,
           mine:G.teams[G.player.team].members.map(m=>m.alive?(m.knocked?'K':'A'):'D').join(''), st:G.state, over:G.over, knocks:G.knockLog.length, revives:C.reduce((a,c)=>a+c.revives,0), states:L.states()}}""")
        if step % 3 == 0 or r['st'] != 'play': print(r)
        if r['st'] != 'play': break
    pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/sq_11_result.png')
    print('result', pg.evaluate("()=>({kicker:document.getElementById('resKicker').textContent, title:document.getElementById('resTitle').textContent, rank:document.getElementById('resRank').textContent+document.getElementById('resOf').textContent, note:document.getElementById('resNote').textContent, places:__LD.G.teams.map(t=>t.place)})"))
    print('causes', pg.evaluate("()=>{const m={}; for(const k of __LD.G.killLog){const key=(k.kn?'K:':'')+k.cause; m[key]=(m[key]||0)+1;} return m;}"))
    print('knocks', pg.evaluate("()=>__LD.G.knockLog.length"), 'revives', pg.evaluate("()=>__LD.CHARS.reduce((a,c)=>a+c.revives,0)"))
    print('\n'.join(logs[:30]))
    b.close()
