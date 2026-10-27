# 3명 파티: 방장 A + B + C (C는 WebRTC 끔 → 중계). 방장을 거친 파티원끼리 동기화, 파티 랭크 레벨 제한, 트리오 배틀로얄
import sys, os, re, time, threading, http.server, functools
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
SP = '/tmp/claude-0/-home-claude/68f8f37c-dfb0-54ca-8eee-7f216ce8c253/scratchpad/party_srv'
os.makedirs(SP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
html = open('/home/claude/lds/dist/index.html', encoding='utf-8').read()
html, n = re.subn(r"url: '[^']*',\s*key: '[^']*',", "url: 'https://fake.supabase.co', key: 'sb_publishable_test',", html, count=1); assert n == 1
open(SP + '/index.html', 'w', encoding='utf-8').write(html)
PORT = 8766
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
errs = {}
def jsclick(pg, sel): pg.evaluate("(s)=>{ const e=document.querySelector(s); if(!e) throw new Error('no '+s); e.click(); }", sel)
def wait(pg, js, t=20000): pg.wait_for_function(js, timeout=t)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
    ctx = b.new_context(viewport={'width': 560, 'height': 315}); ctx.route('**/*', route)
    P = {k: ctx.new_page() for k in 'ABC'}
    for k, pg in P.items():
        errs[k] = []
        pg.on('pageerror', lambda e, k=k: errs[k].append(str(e)))
    P['C'].add_init_script("window.RTCPeerConnection = undefined;")
    A, B, C = P['A'], P['B'], P['C']
    A.goto(f'http://127.0.0.1:{PORT}/index.html?slot=1'); A.wait_for_timeout(500)
    A.evaluate("()=>{ localStorage.clear(); for (const s of ['1','2','3']) localStorage.setItem('lastdrop'+s+'.settings', JSON.stringify({quality:'low', shadows:'off', view:'tpp', bots:12, map:'kalden'})); }")
    A.reload(); B.goto(f'http://127.0.0.1:{PORT}/index.html?slot=2'); C.goto(f'http://127.0.0.1:{PORT}/index.html?slot=3'); A.wait_for_timeout(1500)
    def run(sec, step=3):
        for k in range(max(1, int(sec * 30 / step))):
            for pg in (A, B, C): pg.evaluate(f"()=>__LD.G.state==='play' && __LD.sim({step})")
    names = {'A': '방장A', 'B': '친구B', 'C': '친구C'}
    for k, pg in P.items():
        jsclick(pg, '#acctChip'); jsclick(pg, '#acctTabs [data-m=signup]')
        pg.fill('#acctId', names[k]); pg.fill('#acctPw', 'pass1234'); pg.fill('#acctPw2', 'pass1234'); jsclick(pg, '#acctSubmit')
        wait(pg, "()=>__LD.Cloud.user && __LD.Social.connected")
    # 친구: A → B, A → C (수락)
    jsclick(A, '#friendBtn')
    for k in 'BC':
        A.fill('#friendId', names[k]); jsclick(A, '#friendForm button'); A.wait_for_timeout(500)
    for k in 'BC':
        pg = P[k]; wait(pg, "()=>__LD.Social.friends.some(f=>f.status==='pending'&&f.incoming)"); jsclick(pg, '#friendBtn'); pg.wait_for_timeout(200); jsclick(pg, '.fr-row .btn.amber'); pg.wait_for_timeout(400); jsclick(pg, '#friendClose')
    wait(A, "()=>__LD.Social.friends.filter(f=>f.status==='accepted').length===2")
    A.evaluate("()=>__LD.Social.render()"); A.wait_for_timeout(300)
    # 둘 다 초대
    A.evaluate("()=>{ for (const b of document.querySelectorAll('.fr-row .btn.amber')) b.click(); }"); A.wait_for_timeout(800)
    for k in 'BC': wait(P[k], "()=>__LD.Social.invites.length>0"); jsclick(P[k], '.invite-card .btn.amber')
    wait(A, "()=>__LD.Party.size()===3", 15000); wait(C, "()=>__LD.Party.size()===3", 15000)
    jsclick(A, '#friendClose'); A.wait_for_timeout(1200)
    print('party3', A.evaluate("()=>({m:__LD.Party.members().map(m=>m.name), squad:__LD.Party.state.s.squad})"), C.evaluate("()=>({m:__LD.Party.members().map(m=>m.name), sub:playSub.textContent})"))
    A.screenshot(path=f'{OUT}/q01_A_party3.png')
    # 파티 랭크: A·B 레벨 3+, C 레벨 1 → 불가 / C도 3+ → 가능
    A.evaluate("()=>__LD.setXp(1200)"); B.evaluate("()=>__LD.setXp(1200)"); A.wait_for_timeout(2500)
    jsclick(A, '#segQueue button.ranked'); A.wait_for_timeout(200)
    print('rank w/ low C', A.evaluate("()=>({note:document.getElementById('lbNote').textContent, q:__LD.Party.state.s.queue})"))
    C.evaluate("()=>__LD.setXp(1200)"); A.wait_for_timeout(2600)
    jsclick(A, '#segQueue button.ranked'); A.wait_for_timeout(1500)
    print('rank all 3+', A.evaluate("()=>({q:__LD.Party.state.s.queue, top:mcTop.textContent})"), C.evaluate("()=>({top:mcTop.textContent, play:document.querySelector('#playBtn span').textContent})"))
    jsclick(A, '#segQueue button:not(.ranked)'); A.wait_for_timeout(1200)
    # 웨폰 데스매치 3명
    jsclick(A, '#mapCard'); jsclick(A, '#gameGrid .game-opt:nth-child(3)'); jsclick(A, '[data-ui=closeMapPick]')
    wait(C, "()=>__LD.Party.state && __LD.Party.state.s.game==='wdm'", 8000)
    jsclick(A, '#playBtn')
    for pg in (A, B, C): wait(pg, "()=>__LD.G.state==='play'", 60000)
    for k in range(30):
        run(0.3)
        if C.evaluate("()=>{const s=__LD.Net.status(); return s.peers.every(p=>p.open||p.relay)}") and A.evaluate("()=>{const s=__LD.Net.status(); return s.peers.every(p=>p.open||p.relay)}"): break
    run(2.0)
    for k in 'ABC': print(k, P[k].evaluate("()=>{const L=__LD,G=L.G,s=L.Net.status(); return {net:s.peers.map(p=>p.name+':'+(p.open?'p2p':p.relay?'relay':'-')), chars:L.CHARS.map(c=>c.name+(c.net?(c.net.mine?'*':''):'*')).join(' '), score:G.dm.score, gun:G.player.weapon&&G.player.weapon.id}}"))
    # B를 옮김 → C 화면 (방장을 거친 전달)
    B.evaluate("()=>{const p=__LD.G.player; p.pos.x=-25; p.pos.z=31;}"); run(1.5)
    print('B on C', C.evaluate("()=>{const c=__LD.CHARS.find(c=>c.name==='친구B'); return [Math.round(c.pos.x), Math.round(c.pos.z), c.weapon&&c.weapon.id]}"), 'B gun', B.evaluate("()=>__LD.G.player.weapon.id"))
    # C(중계)가 적 처치 → 점수 · C 무기 교체 · B 화면의 킬 피드
    r = C.evaluate("()=>{const L=__LD,G=L.G,p=G.player; const e=L.CHARS.find(c=>c.team!==p.team&&c.alive); const w0=p.weapon.id; L.fns.applyDamage(e, 700, 'head', p, w0); return {t:e.name, w0}}")
    run(2.0)
    print('C kill', r, 'C', C.evaluate("()=>({score:__LD.G.dm.score, kills:__LD.G.player.kills, gun:__LD.G.player.weapon.id})"), 'A', A.evaluate("()=>__LD.G.dm.score"), 'B', B.evaluate("()=>({score:__LD.G.dm.score, cKills:__LD.CHARS.find(c=>c.name==='친구C').kills, feed:document.getElementById('killfeed').textContent.slice(0,60)})"))
    # 봇 → C 피해 (방장 판정 → 중계로 C)
    A.evaluate("()=>{const L=__LD; const cp=L.CHARS.find(c=>c.name==='친구C'); const e=L.CHARS.find(c=>c.team!==cp.team&&c.alive); L.fns.applyDamage(cp, 30, 'body', e, 'm416');}"); run(2.0)
    print('bot→C', C.evaluate("()=>Math.round(__LD.G.player.hp)"))
    run(6.0)
    print('scores', [P[k].evaluate("()=>__LD.G.dm.score") for k in 'ABC'], 'C relay msgs', C.evaluate("()=>window.__fakeRT.sent"))
    A.screenshot(path=f'{OUT}/q02_A_wdm.png'); C.screenshot(path=f'{OUT}/q03_C_wdm.png')
    # 파티원 B가 경기 도중 나감 → 방장 쪽은 봇이 이어받음
    B.evaluate("()=>{ __LD.G.ui('quit'); }"); run(1.5)
    print('B left', A.evaluate("()=>{const c=__LD.CHARS.find(c=>c.name==='친구B'); return {botized:!!c.botized, brain:!!c.brain}}"), C.evaluate("()=>{const c=__LD.CHARS.find(c=>c.name==='친구B'); return {owner:c.net.owner===__LD.Net.state.cfg.host}}"))
    print('errors', {k: v[:5] for k, v in errs.items()})
    b.close()
srv.shutdown()
