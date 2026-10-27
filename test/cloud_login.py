# 로그인·동기화 테스트 (가짜 Supabase SDK). 설정값을 넣은 테스트용 빌드로 실행
import sys, re, os
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
MOB = VW < 1000
html = open('/home/claude/lds/dist/index.html', encoding='utf-8').read()
html, n = re.subn(r"url: '[^']*',\s*key: '[^']*',", "url: 'https://fake.supabase.co', key: 'sb_publishable_test',", html, count=1)
assert n == 1
os.makedirs('/tmp/claude-0/-home-claude/68f8f37c-dfb0-54ca-8eee-7f216ce8c253/scratchpad/cl', exist_ok=True)
TEST = '/tmp/claude-0/-home-claude/68f8f37c-dfb0-54ca-8eee-7f216ce8c253/scratchpad/cl/index.html'
open(TEST, 'w', encoding='utf-8').write(html)
THREE = open('/home/claude/lds/node_modules/three/build/three.min.js','rb').read() if os.path.exists('/home/claude/lds/node_modules/three/build/three.min.js') else open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
FAKE = open('/home/claude/lds/test/fake_supabase_rt.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'supabase-js' in u: return r.fulfill(body=FAKE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':VW,'height':VH}, has_touch=MOB, is_mobile=MOB); pg = ctx.new_page(); pg.route('**/*', route)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + TEST); pg.wait_for_timeout(1200)
    S = "()=>({chip:document.getElementById('acctChip').textContent, hidden:document.getElementById('acctChip').hidden, op:document.getElementById('opName').textContent, xp:__LD.Cloud && JSON.parse(localStorage.getItem('lastdrop.stats')||'{}').xp, user:__LD.Cloud.user&&__LD.Cloud.name, status:__LD.Cloud.status})"
    print('guest', pg.evaluate(S))
    # 게스트 기록 만들기 (레벨 3쯤)
    pg.evaluate("()=>{ localStorage.setItem('lastdrop.stats', JSON.stringify({matches:3,wins:1,kills:7,xp:620,best:1,recent:[]})); }"); pg.reload(); pg.wait_for_timeout(1000)
    def form(mode, idv, pw, pw2=''):
        pg.click('#acctChip'); pg.wait_for_timeout(200)
        pg.click(f'#acctTabs button[data-m={mode}]')
        pg.fill('#acctId', idv); pg.fill('#acctPw', pw)
        if mode == 'signup': pg.fill('#acctPw2', pw2 or pw)
        pg.click('#acctSubmit'); pg.wait_for_timeout(600)
        return pg.evaluate("()=>({panel:!document.getElementById('acctPanel').hidden, msg:document.getElementById('acctMsg').textContent, note:document.getElementById('lbNote').textContent})")
    print('bad id', form('signup', 'a', 'abc123'))
    pg.screenshot(path=f'{OUT}/c1_signup_err.png'); pg.click('#acctClose')
    print('pw mismatch', form('signup', '철수', 'abc123', 'abc124')); pg.click('#acctClose')
    print('signup', form('signup', '철수', 'abc123'))
    print('after signup', pg.evaluate(S), pg.evaluate("()=>{ const d=__fakeSB.DB(); const k=Object.keys(d.player_data)[0]; return {email:Object.keys(d.users)[0], profile:Object.values(d.profiles)[0].username, serverXp:d.player_data[k].stats&&d.player_data[k].stats.xp, touchSynced:!!(d.player_data[k].settings&&'touchLayout' in d.player_data[k].settings)}; }"))
    pg.screenshot(path=f'{OUT}/c2_loggedin.png')
    # 경기 끝난 셈: 기록 변경 → 2초 뒤 서버 반영
    pg.evaluate("()=>{ const L=__LD; }")
    pg.evaluate("()=>{ localStorage.setItem('x','1'); }")
    pg.evaluate("""()=>{ /* STATS 변경 후 saveStats */ const s=JSON.parse(localStorage.getItem('lastdrop.stats')); }""")
    pg.evaluate("()=>window.__LD.G && 0")
    pg.evaluate("""()=>{ const st=JSON.parse(localStorage.getItem('lastdrop.stats')); st.xp=900; st.matches=4; localStorage.setItem('lastdrop.stats', JSON.stringify(st)); }""")
    # 게임 코드 경로로 저장: 설정 변경(saveSettings)과 STATS 갱신을 실제 함수로
    pg.evaluate("()=>{ __LD.G.__test = 1; }")
    r = pg.evaluate("""async ()=>{ const L=__LD; L.Cloud; window.__s0=__fakeSB.calls.filter(c=>c[0]==='upsert').length;
        document.querySelector('[data-tab-go=custom]').click(); document.querySelectorAll('#outfits button')[2].click(); await new Promise(r=>setTimeout(r,2600));
        const d=__fakeSB.DB(); const row=Object.values(d.player_data)[0]; return {upserts:__fakeSB.calls.filter(c=>c[0]==='upsert').length-__s0, outfit:row.settings.outfit}; }""")
    print('auto sync on save', r)
    # 로그아웃 → 게스트 기록 복원
    pg.click('#acctChip'); pg.wait_for_timeout(200); pg.click('#acctLogout'); pg.wait_for_timeout(500)
    print('logout', pg.evaluate(S), pg.evaluate("()=>JSON.parse(localStorage.getItem('lastdrop.settings')).outfit"))
    # 다른 기기: 로컬 비우고(서버는 유지) 로그인 → 서버 기록 불러옴. 대소문자·공백 무시는 영문 아이디로
    pg.evaluate("()=>{ for(const k of Object.keys(localStorage)) if(k.startsWith('lastdrop.')) localStorage.removeItem(k); }"); pg.reload(); pg.wait_for_timeout(1000)
    print('device B guest', pg.evaluate(S))
    print('wrong pw', form('login', '철수', 'nope99')); pg.click('#acctClose')
    print('login', form('login', ' 철수 ', 'abc123'))
    print('device B after login', pg.evaluate(S), pg.evaluate("()=>JSON.parse(localStorage.getItem('lastdrop.settings')).outfit"))
    # 새로고침 → 세션 복원
    pg.reload(); pg.wait_for_timeout(1500)
    print('restore', pg.evaluate(S))
    # 중복 가입 / 대소문자
    pg.click('#acctChip'); pg.wait_for_timeout(200); pg.click('#acctLogout'); pg.wait_for_timeout(400)
    print('dup', form('signup', '철수', 'zzz999')); pg.click('#acctClose')
    print('case', pg.evaluate("()=>[__LD.Cloud.idEmail('Aiden'), __LD.Cloud.idEmail('aiden'), __LD.Cloud.idEmail('조민수')]"))
    print('signup2', form('signup', 'Aiden_7', 'pass77'))
    pg.screenshot(path=f'{OUT}/c3_lobby_name.png')
    # 게임 속 이름
    pg.evaluate("()=>__LD.Training.start()"); pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    print('in-game name', pg.evaluate("()=>__LD.G.player.name"))
    pg.evaluate("()=>{ document.querySelector('#quitBtn').click(); }"); pg.wait_for_timeout(400)
    pg.click('#acctChip'); pg.wait_for_timeout(250); pg.screenshot(path=f'{OUT}/c4_panel_in.png')
    print('errors', errs[:5])
    b.close()
