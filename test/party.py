# 같이 하기 통합 테스트: 브라우저 탭 2개(서로 다른 계정, ?slot=1/2) + 가짜 Supabase(실시간 포함) + 실제 WebRTC
#  가입 → 친구 요청·수락 → 파티 초대·수락 → 방장 설정 동기화·랭크 제한 → 팀 데스매치(같이) → 배틀로얄 듀오(같이)
import sys, os, re, time, json, threading, http.server, functools
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
MODE = sys.argv[2] if len(sys.argv) > 2 else 'all'      # all | dm | br
RELAY = 'relay' in sys.argv                             # B 탭의 WebRTC를 꺼서 서버 중계 경로 시험
SP = '/tmp/claude-0/-home-claude/68f8f37c-dfb0-54ca-8eee-7f216ce8c253/scratchpad/party_srv'
os.makedirs(SP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
html = open('/home/claude/lds/dist/index.html', encoding='utf-8').read()
html, n = re.subn(r"url: '[^']*',\s*key: '[^']*',", "url: 'https://fake.supabase.co', key: 'sb_publishable_test',", html, count=1); assert n == 1
open(SP + '/index.html', 'w', encoding='utf-8').write(html)
PORT = 8765
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(http.server.SimpleHTTPRequestHandler, directory=SP))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
FAKE = open('/home/claude/lds/test/fake_supabase_rt.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'supabase-js' in u: return r.fulfill(body=FAKE, content_type='application/javascript')
    if 'fonts.g' in u or 'stun' in u: return r.abort()
    return r.continue_()
errs = {'A': [], 'B': []}
def jsclick(pg, sel):
    pg.evaluate("(s)=>{ const e=document.querySelector(s); if(!e) throw new Error('no '+s); e.click(); }", sel)
def wait(pg, js, t=20000):
    pg.wait_for_function(js, timeout=t)
# 경기 진행: 두 탭을 번갈아 고정 간격으로 돌린다 (SwiftShader 화면 그리기가 느려 실시간으로는 초당 몇 프레임뿐)
def run(sec, step=3):
    for k in range(max(1, int(sec * 30 / step))):
        A.evaluate(f"()=>__LD.sim({step})"); B.evaluate(f"()=>__LD.sim({step})")
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
                                '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
    ctx = b.new_context(viewport={'width': 640, 'height': 360})
    ctx.route('**/*', route)
    A = ctx.new_page(); B = ctx.new_page()
    for nm, pg in (('A', A), ('B', B)):
        pg.on('pageerror', lambda e, nm=nm: errs[nm].append(str(e)))
        pg.on('console', lambda m, nm=nm: errs[nm].append(m.text) if m.type == 'error' and 'Failed to load' not in m.text else None)
    if RELAY: B.add_init_script("window.RTCPeerConnection = undefined;")
    A.goto(f'http://127.0.0.1:{PORT}/index.html?slot=1'); A.wait_for_timeout(600)
    A.evaluate("()=>{ localStorage.clear(); for (const s of ['1','2']) localStorage.setItem('lastdrop'+s+'.settings', JSON.stringify({quality:'low', shadows:'off', view:'tpp', bots:10, map:'kalden'})); }")
    A.reload(); B.goto(f'http://127.0.0.1:{PORT}/index.html?slot=2'); A.wait_for_timeout(1500)
    # 1) 가입
    def signup(pg, name):
        jsclick(pg, "#acctChip"); pg.wait_for_timeout(150); jsclick(pg, "#acctTabs [data-m=signup]")
        pg.fill('#acctId', name); pg.fill('#acctPw', 'pass1234'); pg.fill('#acctPw2', 'pass1234'); jsclick(pg, "#acctSubmit")
        wait(pg, "()=>__LD.Cloud.user && __LD.Social.connected")
    signup(A, '방장A'); signup(B, '친구B')
    print('signed', A.evaluate("()=>[__LD.Cloud.name, __LD.Cloud.uid]"), B.evaluate("()=>[__LD.Cloud.name, __LD.Cloud.uid]"))
    # 2) 친구 요청 → 수락
    jsclick(A, "#friendBtn"); A.wait_for_timeout(200); A.fill('#friendId', '친구B'); jsclick(A, "#friendForm button"); A.wait_for_timeout(600)
    print('A request', A.evaluate("()=>document.getElementById('friendMsg').textContent"))
    wait(B, "()=>__LD.Social.friends.some(f=>f.status==='pending'&&f.incoming)")
    print('B badge', B.evaluate("()=>document.getElementById('friendBadge').textContent"))
    jsclick(B, "#friendBtn"); B.wait_for_timeout(300); B.screenshot(path=f'{OUT}/p01_B_request.png')
    jsclick(B, ".fr-row .btn.amber"); B.wait_for_timeout(600)
    wait(A, "()=>__LD.Social.friends.some(f=>f.status==='accepted')")
    A.evaluate("()=>__LD.Social.render()"); A.wait_for_timeout(300); A.screenshot(path=f'{OUT}/p02_A_friends.png')
    print('friends', A.evaluate("()=>__LD.Social.friends.map(f=>[f.username,f.status, __LD.Social.online.has(f.id)])"), B.evaluate("()=>__LD.Social.friends.map(f=>[f.username,f.status])"))
    jsclick(B, "#friendClose")
    # 3) 파티 초대 → 수락
    jsclick(A, ".fr-row .btn.amber"); A.wait_for_timeout(500); jsclick(A, "#friendClose")
    wait(B, "()=>__LD.Social.invites.length>0")
    B.wait_for_timeout(200); B.screenshot(path=f'{OUT}/p03_B_invite.png')
    jsclick(B, ".invite-card .btn.amber")
    wait(B, "()=>__LD.Party.size()===2"); wait(A, "()=>__LD.Party.size()===2")
    A.wait_for_timeout(500)
    print('party', A.evaluate("()=>({size:__LD.Party.size(), leader:__LD.Party.isLeader(), m:__LD.Party.members().map(m=>m.name)})"), B.evaluate("()=>({size:__LD.Party.size(), leader:__LD.Party.isLeader(), play:document.querySelector('#playBtn span').textContent, sub:playSub.textContent})"))
    A.screenshot(path=f'{OUT}/p04_A_party.png'); B.screenshot(path=f'{OUT}/p05_B_party.png')
    # 4) 파티원은 설정을 못 바꾼다 · 방장 설정이 따라온다 · 랭크 제한(레벨 3 미만)
    jsclick(B, "#mapCard"); B.wait_for_timeout(200); jsclick(B, "#gameGrid .game-opt:nth-child(2)"); B.wait_for_timeout(200)
    print('B blocked', B.evaluate("()=>({game:__LD.Party.state.s.game, note:document.getElementById('lbNote').textContent})")); jsclick(B, "[data-ui=closeMapPick]")
    # 방장 레벨 3 이상으로 (랭크 버튼 활성), 파티원은 레벨 1 → 파티 랭크 불가
    # STATS 는 전역 let 이라 __LD로 못 바꾼다 → 테스트용으로 경험치를 많이 준 저장값을 넣고 새로고침 대신 직접 등급 확인만
    jsclick(A, "#segQueue button.ranked"); A.wait_for_timeout(200)
    print('A ranked click', A.evaluate("()=>document.getElementById('lbNote').textContent"))
    def run_dm():
        jsclick(A, "#mapCard"); A.wait_for_timeout(200); jsclick(A, "#gameGrid .game-opt:nth-child(2)"); A.wait_for_timeout(200); jsclick(A, "[data-ui=closeMapPick]")
        wait(B, "()=>__LD.Party.state && __LD.Party.state.s.game==='tdm'", 8000)
        B.wait_for_timeout(300)
        print('B follows', B.evaluate("()=>({top:mcTop.textContent, sub:playSub.textContent, play:document.querySelector('#playBtn span').textContent})"))
        t0 = time.time(); jsclick(A, "#playBtn")
        wait(A, "()=>__LD.G.state==='play'", 60000); wait(B, "()=>__LD.G.state==='play'", 60000)
        print('dm loaded', round(time.time() - t0, 1), 's')
        wait(A, "()=>{const s=__LD.Net.status(); return s && s.peers.every(p=>p.open||p.relay)}", 30000)
        run(3.0)
        S = "()=>{const L=__LD,G=L.G,N=L.Net.status(); return {net:N&&N.peers.map(p=>[p.name,p.open?'p2p':p.relay?'relay':'-']), me:G.player&&G.player.name, team:G.player.team, chars:L.CHARS.map(c=>c.name+':'+(c.net?(c.net.mine?'M':'R'):'L')+':'+c.team).join(' '), score:G.dm&&G.dm.score, t:Math.round(G.time)}}"
        print('A', A.evaluate(S)); print('B', B.evaluate(S))
        # 위치 동기화: 각자 자기 캐릭터를 옮기고 상대 화면에서 확인
        A.evaluate("()=>{const p=__LD.G.player; p.pos.x=-20; p.pos.z=30.5;}"); B.evaluate("()=>{const p=__LD.G.player; p.pos.x=20; p.pos.z=30.5;}")
        run(1.5)
        print('pos sync', A.evaluate("()=>{const c=__LD.CHARS.find(c=>c.name==='친구B'); return [Math.round(c.pos.x), Math.round(c.pos.z), c.alive]}"), B.evaluate("()=>{const c=__LD.CHARS.find(c=>c.name==='방장A'); return [Math.round(c.pos.x), Math.round(c.pos.z), c.alive]}"))
        print('bot sync', A.evaluate("()=>{const c=__LD.CHARS.find(c=>c.team===1); return [c.name, Math.round(c.pos.x), Math.round(c.pos.z)]}"), B.evaluate("()=>{const c=__LD.CHARS.find(c=>c.team===1); return [c.name, Math.round(c.pos.x), Math.round(c.pos.z)]}"))
        A.screenshot(path=f'{OUT}/p10_A_dm.png'); B.screenshot(path=f'{OUT}/p11_B_dm.png')
        # 파티원(B)이 적 봇을 처치 → 방장 점수 → B에 점수 반영 · (웨폰이면) B 무기 교체
        r = B.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; const e=L.CHARS.find(c=>c.team!==p.team&&c.alive); window.__e=e.name; const s0=G.dm.score.slice(); L.fns.applyDamage(e, 600, 'head', p, p.weapon.id); return {target:e.name, s0}}""")
        run(1.5)
        print('B kill', r, 'A sees', A.evaluate("()=>{const L=__LD,e=L.CHARS.find(c=>c.name===window.__e||false); return {score:L.G.dm.score}}"), 'B score', B.evaluate("()=>({score:__LD.G.dm.score, kills:__LD.G.player.kills, feed:document.getElementById('killfeed').textContent.slice(0,80)})"))
        # 봇이 파티원(B)을 공격 → B가 맞음 (방장 기기가 판정한 피해가 B로)
        r = A.evaluate("""()=>{try{const L=__LD,G=L.G; const bp=L.CHARS.find(c=>c.name==='친구B'); const e=L.CHARS.find(c=>c.team!==bp.team&&c.alive); bp.spawnProt=0; L.fns.applyDamage(bp, 40, 'body', e, 'm416'); return e.name}catch(err){return 'ERR '+err.stack}}""")
        run(1.2)
        print('bot hits B', r, B.evaluate("()=>({hp:Math.round(__LD.G.player.hp), vest:__LD.G.player.inv.gear.vest&&Math.round(__LD.G.player.inv.gear.vest.dur)})"))
        # 실시간 몇 초 진행 (봇 교전) → 양쪽 점수 같은지
        run(8.0)
        print('scores', A.evaluate("()=>__LD.G.dm.score"), B.evaluate("()=>__LD.G.dm.score"), 'net', A.evaluate("()=>{const s=__LD.Net.status(); return {tx:s.tx, rx:s.rx}}"))
        A.screenshot(path=f'{OUT}/p12_A_dm2.png'); B.screenshot(path=f'{OUT}/p13_B_dm2.png')
        # 방장이 40킬 → 둘 다 종료·결과
        A.evaluate("()=>{const L=__LD,G=L.G; G.dm.score[G.player.team]=39; const e=L.CHARS.find(c=>c.team!==G.player.team&&c.alive&&!(c.spawnProt>G.time)); L.fns.applyDamage(e, 600, 'head', G.player, G.player.weapon.id);}")
        for k in range(40):
            run(0.5)
            if A.evaluate("()=>__LD.G.state==='result'") and B.evaluate("()=>__LD.G.state==='result'"): break
        print('dm result A', A.evaluate("()=>[resTitle.textContent, resRank.textContent, resXp.textContent]"), 'B', B.evaluate("()=>[resTitle.textContent, resRank.textContent, resXp.textContent]"))
        B.screenshot(path=f'{OUT}/p14_B_result.png')
        jsclick(B, "[data-ui=lobby]"); jsclick(A, "[data-ui=lobby]"); A.wait_for_timeout(800)
        wait(A, "()=>__LD.G.state==='lobby'"); wait(B, "()=>__LD.G.state==='lobby'")
        A.wait_for_timeout(2500)
        print('back lobby', A.evaluate("()=>({party:__LD.Party.size(), st:__LD.Party.members().map(m=>m.st)})"), B.evaluate("()=>({party:__LD.Party.size(), game:__LD.Party.state.s.game})"))
    def run_br():
        jsclick(A, "#mapCard"); A.wait_for_timeout(200); jsclick(A, "#gameGrid .game-opt:nth-child(1)"); A.wait_for_timeout(200); jsclick(A, "[data-ui=closeMapPick]")
        wait(B, "()=>__LD.Party.state && __LD.Party.state.s.game==='br'", 8000)
        # 듀오 미만(솔로) 선택 불가
        jsclick(A, "[data-ui=matchCfg]"); A.wait_for_timeout(200); jsclick(A, "#segSquad button:nth-child(1)"); A.wait_for_timeout(150)
        print('solo blocked', A.evaluate("()=>({note:document.getElementById('lbNote').textContent, squad:__LD.Party.state.s.squad})")); jsclick(A, "[data-ui=closeMatchCfg]")
        t0 = time.time(); jsclick(A, "#playBtn")
        wait(A, "()=>__LD.G.state==='play'", 120000); wait(B, "()=>__LD.G.state==='play'", 120000)
        print('br loaded', round(time.time() - t0, 1), 's')
        wait(A, "()=>{const s=__LD.Net.status(); return s && s.peers.every(p=>p.open||p.relay)}", 30000)
        run(2.5)
        W = "()=>{const L=__LD,G=L.G,s=L.Net.status(); return {chars:L.CHARS.length, team:G.teams[0].members.map(m=>m.name), items:L.fns.GROUND.filter(i=>i.alive).length, veh:L.Veh.list.length, plane:G.plane&&Math.round(G.plane.t), zone:L.Zone.cur&&[Math.round(L.Zone.cur.x),Math.round(L.Zone.cur.z),Math.round(L.Zone.cur.r)], net:s&&s.peers.map(p=>p.open?'p2p':p.relay?'relay':'-'), sumOk:!L.Net.state.hostSum||JSON.stringify(L.Net.state.hostSum)===JSON.stringify(L.Net.state.baseSum)}}"
        print('A', A.evaluate(W)); print('B', B.evaluate(W))
        # 둘 다 강하 → 착지까지
        for pg in (A, B): pg.evaluate("()=>{const L=__LD,G=L.G; G.previewT=0; L.HUD.closeMap();}")
        run(1.5)
        for pg in (A, B): pg.evaluate("()=>{const L=__LD,G=L.G,p=G.player; for(let i=0;i<600&&!(Math.abs(G.plane.pos.x)<150&&Math.abs(G.plane.pos.z)<150);i++) L.sim(1); L.Input.press('interact'); }")
        run(0.6)
        for pg in (A, B): pg.evaluate("()=>{const L=__LD,G=L.G,p=G.player; for(let i=0;i<30*90&&p.mode!=='ground';i++){ if(p.mode==='fall'&&G.time-p.jumpT>1.2) L.Input.press('interact'); L.sim(1);} }")
        run(2.5)
        print('landed', A.evaluate("()=>{const L=__LD,p=L.G.player,o=L.CHARS.find(c=>c.name==='친구B'); return {me:[p.mode,Math.round(p.pos.x),Math.round(p.pos.z)], B:[o.mode,Math.round(o.pos.x),Math.round(o.pos.z)]}}"), B.evaluate("()=>{const L=__LD,p=L.G.player,o=L.CHARS.find(c=>c.name==='방장A'); return {me:[p.mode,Math.round(p.pos.x),Math.round(p.pos.z)], A:[o.mode,Math.round(o.pos.x),Math.round(o.pos.z)]}}"))
        # 아이템: B가 가까운 아이템을 줍는다 → A에서 사라짐
        r = B.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; const it=L.fns.GROUND.filter(i=>i.alive&&L.ITEMS[i.id].type==='weapon').sort((a,b)=>Math.hypot(a.x-p.pos.x,a.z-p.pos.z)-Math.hypot(b.x-p.pos.x,b.z-p.pos.z))[0]; p.pos.set(it.x, it.y, it.z); const r=L.fns.doPickup(p,it); return {u:it.u, id:it.id, alive:it.alive, w:p.weapon&&p.weapon.id}}""")
        run(1.2)
        print('dbg proxyB on A', A.evaluate("()=>{const o=__LD.CHARS.find(c=>c.name==='친구B'); const n=o.net; return {wk:n.wk, lastA:n.lastA&&n.lastA.slice(6,12), age:(performance.now()/1000-n.rxT).toFixed(2), buf:n.buf.length}}"), 'B self', B.evaluate("()=>{const p=__LD.G.player; return {equipT:p.equipT, cur:p.inv.cur, w:p.weapon&&p.weapon.id, enc:null}}"))
        print('B pickup', r, 'A item alive?', A.evaluate(f"()=>{{const it=__LD.Net.state.items.get({r['u']}); return it?it.alive:'none'}}"), 'A sees B gun', A.evaluate("()=>{const o=__LD.CHARS.find(c=>c.name==='친구B'); return o.weapon&&o.weapon.id}"))
        # 버리기: B가 무기를 버림 → A에 새 아이템
        r = B.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; const n0=L.fns.GROUND.length; window.__dropBefore=n0; const H=L.HUD; const inv=p.inv; const slot=inv.weapons.findIndex(Boolean); if(slot<0) return 'no weapon'; const wi=inv.weapons[slot]; inv.weapons[slot]=null; const it=window.__spawn? null:null; return slot}""")
        # 차량: B가 가까운 차를 타고 달림 → A 화면에서 차가 움직인다
        r = B.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; const V=L.Veh; const v=V.list.filter(v=>!v.dead&&!v.T.animal).sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.z-p.pos.z)-Math.hypot(b.pos.x-p.pos.x,b.pos.z-p.pos.z))[0]; p.pos.set(v.pos.x+2, v.pos.y, v.pos.z); const ok=V.enter(p, v, 0); window.__v=v; return {ok, nid:v.nid, type:v.type, x:Math.round(v.pos.x), z:Math.round(v.pos.z)}}""")
        print('B enters', r)
        B.evaluate("()=>{ __LD.Input.keys.KeyW=true; }")
        run(4.0)
        print('dbg veh B', B.evaluate("()=>{const L=__LD,G=L.G,p=G.player,v=window.__v; return {modal:L.HUD.modalOpen(), open:[...document.querySelectorAll('.overlay')].filter(e=>!e.hidden).map(e=>e.id), thr:v.ctrl.throttle, awake:v.awake, drv:v.driver===p, rem:L.Net.vehRemote(v), keyW:L.Input.keys.KeyW, alive:p.alive, kn:p.knocked, over:G.over, veh:!!p.veh}}"))
        print('veh sync', B.evaluate("()=>{const v=window.__v; return [Math.round(v.pos.x),Math.round(v.pos.z),Math.round(Math.hypot(v.vx,v.vz)*3.6)]}"), A.evaluate(f"()=>{{const v=__LD.Veh.list.find(v=>v.nid==={r['nid']}); const o=__LD.CHARS.find(c=>c.name==='친구B'); return [Math.round(v.pos.x),Math.round(v.pos.z),Math.round(Math.hypot(v.vx,v.vz)*3.6), !!o.veh, __LD.Net.vehRemote(v)]}}"))
        B.evaluate("()=>{ __LD.Input.keys.KeyW=false; }")
        A.screenshot(path=f'{OUT}/p20_A_br.png'); B.screenshot(path=f'{OUT}/p21_B_br.png')
        B.evaluate("()=>{ const L=__LD; L.Veh.exit(L.G.player, true, true); }")
        run(1.5)
        print('B exits', A.evaluate(f"()=>{{const v=__LD.Veh.list.find(v=>v.nid==={r['nid']}); const o=__LD.CHARS.find(c=>c.name==='친구B'); return [!!o.veh, __LD.Net.vehRemote(v), Math.round(v.pos.x)]}}"))
        # 기절·부활: 봇이 B를 기절시킴 → A가 살림
        r = A.evaluate("""()=>{const L=__LD,G=L.G; const bp=L.CHARS.find(c=>c.name==='친구B'); const e=L.CHARS.find(c=>c.team!==bp.team&&c.alive); L.fns.applyDamage(bp, 300, 'impact', e, 'akm'); return e.name}""")
        run(1.5)
        print('B knocked', B.evaluate("()=>({knocked:__LD.G.player.knocked, alive:__LD.G.player.alive, hp:Math.round(__LD.G.player.hp)})"), A.evaluate("()=>{const o=__LD.CHARS.find(c=>c.name==='친구B'); return {knocked:o.knocked}}"))
        A.evaluate("()=>{const L=__LD,G=L.G,p=G.player,bp=L.CHARS.find(c=>c.name==='친구B'); p.pos.set(bp.pos.x+0.8,bp.pos.y,bp.pos.z); p.vel.set(0,0,0); window.__rv=L.startRevive(p,bp); }")
        run(1.2)
        print('revive progress on B', B.evaluate("()=>{const p=__LD.G.player; return {by:p.revivedBy&&p.revivedBy.name, t:p.revivedBy&&p.revivedBy.revive&&p.revivedBy.revive.t.toFixed(1)}}"))
        A.evaluate("()=>{const L=__LD; for(let i=0;i<30*11;i++){ const p=L.G.player; p.vel.set(0,0,0); L.sim(1);} }")
        run(1.5)
        print('B revived', B.evaluate("()=>({knocked:__LD.G.player.knocked, hp:Math.round(__LD.G.player.hp)})"), 'A revives', A.evaluate("()=>__LD.G.player.revives"))
        # 수류탄: B가 봇에게 던짐 → 방장 기기에서 봇 피해
        r = B.evaluate("""()=>{const L=__LD,G=L.G,p=G.player; const e=L.CHARS.filter(c=>c.team!==p.team&&c.alive&&c.mode==='ground').sort((a,b)=>Math.hypot(a.pos.x-p.pos.x,a.pos.z-p.pos.z)-Math.hypot(b.pos.x-p.pos.x,b.pos.z-p.pos.z))[0]; if(!e) return null; p.inv.items.frag=2; const pr={x:e.pos.x,y:e.pos.y+0.5,z:e.pos.z}; const o=new THREE.Vector3(e.pos.x,e.pos.y+0.6,e.pos.z), d=new THREE.Vector3(0,-1,0); window.__nade=e.name; const P=L.fns.PROJ; const r=__LD.fns; return e.name}""")
        print('grenade target', r)
        # 결과까지는 진행하지 않고 방장이 나감 → B 경기 종료
        print('before quit', A.evaluate("()=>({others:__LD.Net.othersPlaying(), st:__LD.G.state})"))
        A.evaluate("()=>{ __LD.G.ui('quit'); }"); run(0.3); A.evaluate("()=>{ __LD.G.ui('quit'); }")
        print('after quit A', A.evaluate("()=>({st:__LD.G.state, net:!!__LD.Net.state})"))
        B.wait_for_timeout(1000)
        print('B net', B.evaluate("()=>{const s=__LD.Net.status(); return s && {peers:s.peers, ended:__LD.Net.state.ended}}"))
        for k in range(40):
            B.evaluate("()=>__LD.G.state==='play' && __LD.sim(3)"); B.wait_for_timeout(100)
            if B.evaluate("()=>__LD.G.state==='result' || __LD.G.over"): break
        B.wait_for_timeout(1500)
        for k in range(20):
            B.evaluate("()=>__LD.G.state==='play' && __LD.sim(3)")
            if B.evaluate("()=>__LD.G.state==='result'"): break
        print('host left → B', B.evaluate("()=>({state:__LD.G.state, over:__LD.G.over, hostGone:__LD.G.hostGone, note:resNote.textContent.slice(0,60), title:resTitle.textContent})"))
    if MODE in ('all', 'dm'): run_dm()
    if MODE in ('all', 'br'): run_br()
    print('errors A', errs['A'][:8]); print('errors B', errs['B'][:8])
    b.close()
srv.shutdown()
