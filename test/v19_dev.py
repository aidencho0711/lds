# v19 개발자 계정: '개발자'로 가입·로그인 → 모든 스킨 지급 · DEV 버튼/개발자 도구 → 재화·레벨 → 훈련장에서 무적·무한 탄약·총 지급·풀세트·차량 소환·순간이동
#  → 데스매치에서 적 모두 탈락 → 로그아웃하면 게스트로(스킨 없음) · 다른 아이디는 개발자 아님
#  사용: python3 test/v19_dev.py OUT [W H]
import sys, re, os, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; VW, VH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1280, 720)
MOB = VW < 1000
SP = '/tmp/claude-0/-home-claude/68f8f37c-dfb0-54ca-8eee-7f216ce8c253/scratchpad/devt'; os.makedirs(SP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
html = open('/home/claude/lds/dist/index.html', encoding='utf-8').read()
html, n = re.subn(r"url: '[^']*',\s*key: '[^']*',", "url: 'https://fake.supabase.co', key: 'sb_publishable_test',", html, count=1); assert n == 1
open(SP + '/index.html', 'w', encoding='utf-8').write(html)
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
FAKE = open('/home/claude/lds/test/fake_supabase_rt.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'supabase-js' in u: return r.fulfill(body=FAKE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
errs = []; res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': VW, 'height': VH}, has_touch=MOB, is_mobile=MOB); pg = ctx.new_page(); pg.route('**/*', route)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' and 'Failed to load' not in m.text else None)
    pg.goto('file://' + SP + '/index.html'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{ localStorage.removeItem('lastdrop.dev'); }")
    STATE = """()=>{ const L=__LD; return { dev: L.Dev.is(), devBtn: !document.getElementById('devBtn').hidden, chipDev: document.getElementById('acctChip').classList.contains('dev'), name: L.Cloud.name,
      skins: (JSON.parse(localStorage.getItem('lastdrop.stats') || '{}').skins || []).length, vskins: (JSON.parse(localStorage.getItem('lastdrop.stats') || '{}').vskins || []).length, gskins: (JSON.parse(localStorage.getItem('lastdrop.stats') || '{}').gskins || []).length,
      totals: [Object.keys(L.Body.SKINS).filter(k=>!/_basic$/.test(k)).length, Object.keys(L.VSKINS).length, Object.keys(L.GSKINS).length], gold: L.Eco.gold, note: document.getElementById('lbNote').textContent }; }"""
    res['guest'] = pg.evaluate(STATE)
    def form(mode, idv, pw):
        pg.evaluate("()=>document.getElementById('acctChip').click()"); pg.wait_for_timeout(250)
        pg.evaluate(f"()=>document.querySelector('#acctTabs button[data-m={mode}]').click()")
        pg.fill('#acctId', idv); pg.fill('#acctPw', pw)
        if mode == 'signup': pg.fill('#acctPw2', pw)
        pg.evaluate("()=>document.getElementById('acctSubmit').click()"); pg.wait_for_timeout(1200)
    form('signup', '개발자', 'devpass1')
    pg.wait_for_function("()=>window.__LD.Dev.is() && (JSON.parse(localStorage.getItem('lastdrop.stats')||'{}').gskins||[]).length === Object.keys(window.__LD.GSKINS).length", timeout=15000); pg.wait_for_timeout(800)
    res['dev_login'] = pg.evaluate(STATE)
    pg.screenshot(path=f'{OUT}/d1_lobby_dev.png')
    # 창고 → 총기: 스킨 목록 보이는지
    res['wh'] = pg.evaluate("()=>{ document.querySelector('[data-tab=custom]').click(); return document.getElementById('whCount') ? document.getElementById('whCount').textContent : ''; }")
    pg.wait_for_timeout(400); pg.screenshot(path=f'{OUT}/d2_warehouse.png')
    pg.evaluate("()=>document.querySelector('[data-tab=play]').click()")
    # 개발자 도구 (로비)
    pg.evaluate("()=>document.getElementById('devBtn').click()"); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/d3_devpanel_lobby.png')
    def click_btn(text):
        return pg.evaluate("(t)=>{ const b=[...document.querySelectorAll('#devBody button')].find(x=>x.textContent.startsWith(t)); if(!b) return 'nobtn'; if (b.disabled) return 'disabled'; b.click(); return document.getElementById('devMsg').textContent; }", text)
    g0 = pg.evaluate("()=>__LD.Eco.gold")
    res['gold'] = [click_btn('골드 탄피 +10,000'), pg.evaluate("()=>__LD.Eco.gold") - g0]
    res['lv5'] = click_btn('레벨 +5')
    res['quests'] = click_btn('미션 모두 완료')
    res['lobbyCheat'] = click_btn('장비 풀세트')
    pg.evaluate("()=>document.getElementById('devClose').click()")
    # 훈련장
    pg.evaluate("()=>document.getElementById('trainBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ __LD.sim(10); __LD.G.pause(true); }"); pg.wait_for_timeout(300)
    res['pauseBtn'] = pg.evaluate("()=>!document.getElementById('devPauseBtn').hidden")
    pg.evaluate("()=>document.getElementById('devPauseBtn').click()"); pg.wait_for_timeout(400)
    for t in ['무적', '무한 탄약', '지도 눌러 순간이동', 'FPS·좌표 표시']: res['tg ' + t] = click_btn(t)
    pg.evaluate("()=>{ const s=document.querySelectorAll('#devBody select')[0]; s.value='awm'; s.dispatchEvent(new Event('change')); }")
    res['gun'] = click_btn('총 지급')
    res['kit'] = click_btn('장비 풀세트')
    pg.evaluate("()=>{ const s=document.querySelectorAll('#devBody select')[1]; s.value='sedan'; s.dispatchEvent(new Event('change')); }")
    res['veh'] = click_btn('차량 소환')
    res['killAllTraining'] = click_btn('적 모두 탈락')
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/d4_devpanel_match.png')
    pg.evaluate("()=>{ document.getElementById('devClose').click(); __LD.G.pause(false); }")
    # 무적·무한 탄약 확인
    res['god'] = pg.evaluate("()=>{ const L=__LD, p=L.G.player, h0=p.hp; L.fns.applyDamage(p, 60, 'body', null, 'zone'); return [h0, p.hp]; }")
    res['awm'] = pg.evaluate("()=>{ const w=__LD.G.player.weapon; return { gun: w.id, att: w.att, mag: w.mag }; }")
    res['ammo'] = pg.evaluate("()=>{ const L=__LD, p=L.G.player; L.Dev._giveGun('m416'); L.sim(40, 1/60); const w=p.weapon, m0=w.mag, s0=L.G.stats.shots; L.Input.fire=true; L.sim(90, 1/60); L.Input.fire=false; L.sim(5, 1/60); return { gun: w.id, att: w.att, m0, m1: w.mag, shots: L.G.stats.shots - s0, rl: !!p.rl }; }")
    res['gear'] = pg.evaluate("()=>{ const g=__LD.G.player.inv.gear; return [g.helmet&&g.helmet.id, g.vest&&g.vest.id, g.bag&&g.bag.id]; }")
    res['vehs'] = pg.evaluate("()=>__LD.Veh.list ? __LD.Veh.list.filter(v=>v.type==='sedan').length : -1")
    # 순간이동: 지도 열고 짧게 누르기 (지도 가운데 = 월드 원점 근처)
    pg.evaluate("()=>{ __LD.HUD.openMap(); }"); pg.wait_for_timeout(500)
    before = pg.evaluate("()=>{ const p=__LD.G.player.pos; return [Math.round(p.x), Math.round(p.z)]; }")
    box = pg.evaluate("()=>{ const r=document.getElementById('bigmap').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }")
    tx, ty = box[0] + box[2] * 0.3, box[1] + box[3] * 0.7
    pg.mouse.click(tx, ty); pg.wait_for_timeout(400)
    res['tp'] = {'before': before, 'after': pg.evaluate("()=>{ const p=__LD.G.player.pos; return [Math.round(p.x), Math.round(p.z), +p.y.toFixed(1)]; }"), 'mapOpen': pg.evaluate("()=>!document.getElementById('mapPanel').hidden")}
    pg.evaluate("()=>{ __LD.sim(30, 1/60); }"); pg.wait_for_timeout(400)
    res['stats'] = pg.evaluate("()=>({ shown: !document.getElementById('devStats').hidden, text: document.getElementById('devStats').textContent })")
    pg.screenshot(path=f'{OUT}/d5_match_stats.png')
    pg.evaluate("()=>{ __LD.G.ui('quit'); }"); pg.wait_for_timeout(1500)
    # 데스매치: 적 모두 탈락
    pg.evaluate("()=>{ __LD.DM.start(); }")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ __LD.sim(20); }")
    res['dmKill'] = pg.evaluate("()=>{ const L=__LD, before=L.CHARS.filter(c=>c.alive && c.team!==L.G.player.team).length; const r=L.Dev._killAll(); return { before, msg: r, after: L.CHARS.filter(c=>c.alive && c.team!==L.G.player.team).length }; }")
    pg.evaluate("()=>{ __LD.G.ui('quit'); }"); pg.wait_for_timeout(1500)
    # 로그아웃 → 게스트
    pg.evaluate("()=>document.getElementById('acctChip').click()"); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.getElementById('acctLogout').click()"); pg.wait_for_timeout(1200)
    res['logout'] = pg.evaluate(STATE)
    # 다른 아이디
    form('signup', '철수', 'abc12345')
    pg.wait_for_function("()=>window.__LD.Cloud.name==='철수'", timeout=15000); pg.wait_for_timeout(600)
    res['other'] = pg.evaluate(STATE)
    res['cheatOther'] = pg.evaluate("()=>__LD.Dev.cheat('god')")
    print(json.dumps(res, ensure_ascii=False, indent=1))
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
