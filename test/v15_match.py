# v15 경기·저장 확인: 모자 스킨 로비/창고 → 여러 기기 합치기(mergeStats) 단위 확인 → 배틀로얄에서 골드 탄피 주머니 배치·줍기
#  → 봇 전멸로 우승 → 결과 화면 문구·미션 진행 → 오류 수집
#  사용: python3 test/v15_match.py OUT_DIR
import sys, json
from playwright.sync_api import sync_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
THREE = open('/home/claude/br/node_modules/three/build/three.min.js', 'rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u or 'supabase' in u: return r.abort()
    return r.continue_()
logs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/lds/dist/index.html'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{ localStorage.clear(); localStorage.setItem('lastdrop.settings', JSON.stringify({map:'kalden', bots:4, difficulty:'easy', queue:'normal', squad:'solo', view:'tpp', quality:'medium', shadows:'low'})); }")
    pg.reload(); pg.wait_for_timeout(2500)
    r = {}
    # 모자·옷 장착 → 로비(모자가 헬멧 대신) / 창고(장비 벗음)
    pg.evaluate("""()=>{ const L=__LD; L.stats.skins.push('hat_beret_red','top_jk_flight','bottom_cargo_dig','gloves_leather'); L.Eco.changed('t');
      const S=JSON.parse(localStorage.getItem('lastdrop.settings')); window.__eq={hat:'hat_beret_red', top:'top_jk_flight', bottom:'bottom_cargo_dig', gloves:'gloves_leather'};
      __LD.HUD.goTab('custom'); }""")
    pg.evaluate("()=>{ for (const [s,id] of Object.entries(__eq)) { const b=[...document.querySelectorAll('.wh-item')].find(x=>x.querySelector('b')?.textContent===__LD.Body.SKINS[id].name); if (b) b.click(); } }")
    pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/a_wh_outfit.png')
    pg.evaluate("()=>__LD.HUD.goTab('play')"); pg.wait_for_timeout(1500); pg.screenshot(path=f'{OUT}/b_lobby_hat.png')
    r['look'] = pg.evaluate("()=>({ eq: __LD.Body.normEquip(JSON.parse(localStorage.getItem('lastdrop.settings')).look), hatVisible: __LD.Lobby.rig.hat.visible, helmetKids: __LD.Lobby.rig.helmet.children.length })")
    # 여러 기기 합치기
    r['merge'] = pg.evaluate("""()=>{ const M=__LD.Eco.mergeStats, d='2026-11-06';
      const base={ matches:5, wins:1, kills:10, xp:500, best:3, recent:[], skins:['x1'], vskins:[], eco:{ v:1, gold:1000, coin:5, rev:3, pulls:{br:2}, att:{last:'2026-11-05', n:4}, q:{ d, ids:['d_kill5'], p:{kill:2}, c:[], bonus:0, w:'W2026-11-02', wp:{play:1}, wc:[] } } };
      const local=JSON.parse(JSON.stringify(base)); local.eco.gold=700; local.eco.coin=2; local.skins.push('a'); local.eco.pulls.br=5; local.eco.att={last:d, n:5}; local.eco.q.p.kill=6; local.eco.q.c=['d_kill5']; local.matches=6; local.kills=14;
      const srv=JSON.parse(JSON.stringify(base)); srv.eco.gold=1200; srv.eco.coin=9; srv.skins.push('b'); srv.vskins.push('sedan_gt_red'); srv.eco.q.p.kill=3; srv.matches=7; srv.kills=12; srv.eco.q.wp.play=3;
      const m=M(base, local, srv);
      return { gold: m.eco.gold, coin: m.eco.coin, skins: m.skins, vskins: m.vskins, att: m.eco.att, kill: m.eco.q.p.kill, claimed: m.eco.q.c, matches: m.matches, kills: m.kills, wplay: m.eco.q.wp.play, pulls: m.eco.pulls }; }""")
    # 배틀로얄: 골드 탄피 주머니
    pg.evaluate("()=>document.getElementById('playBtn').click()")
    pg.wait_for_function("()=>window.__LD.G.state==='play'", timeout=120000)
    pg.evaluate("()=>{ const b=document.querySelector('[data-ui=closeMap]'); if(b) b.click(); }")
    pg.evaluate("""()=>{ const L=__LD; for(let i=0;i<900;i++){ L.sim(1); const pl=L.G.plane; if(Math.abs(pl.pos.x)<160&&Math.abs(pl.pos.z)<160){ L.Input.press('interact'); L.sim(1); break; } } for(let i=0;i<80;i++){ L.sim(30); if(L.G.player.mode==='ground') break; } }""")
    r['gold'] = pg.evaluate("""()=>{ const L=__LD, p=L.G.player, G0=L.fns.GROUND.filter(i=>i.alive&&i.id==='gold'); const it=G0[0]; const before=L.Eco.gold;
      p.pos.set(it.x, it.y, it.z); const res=L.fns.pickupItem(p, it, L.G.scene); L.sim(3);
      return { count: G0.length, amounts: G0.map(i=>i.count), res, gain: L.Eco.gold-before, goldN: p.goldN, label: it ? L.ITEMS.gold.name : '' }; }""")
    # 주머니 모델 가까이 보기
    pg.evaluate("""()=>{ const L=__LD, it=L.fns.GROUND.find(i=>i.alive&&i.id==='gold'); const p=L.G.player; p.pos.set(it.x+1.2, it.y, it.z+1.2); L.sim(5); L.G.paused=true; const c=L.G.camera; c.position.set(it.x+0.55, it.y+0.45, it.z+0.55); c.lookAt(it.x, it.y+0.05, it.z); c.updateMatrixWorld(); window.__gi=it; }""")
    pg.wait_for_timeout(600); pg.screenshot(path=f'{OUT}/c_pouch.png')
    pg.evaluate("()=>{ __LD.G.paused=false; }")
    # 봇 전멸 → 우승 → 결과
    pg.evaluate("""()=>{ const L=__LD, p=L.G.player; p.kills=0; p.headshots=2; p.lootN=(p.lootN||0)+12; p.driveM=800; for (const c of L.CHARS) if (!c.isPlayer && c.alive) { L.killChar(c, p, 'm416'); } }""")
    pg.wait_for_function("()=>__LD.G.state==='result'", timeout=60000)
    pg.wait_for_timeout(600)
    r['result'] = pg.evaluate("()=>({ note: document.getElementById('resNote').textContent, q: __LD.Eco.questList(), dot: !document.getElementById('misDot').hidden })")
    pg.screenshot(path=f'{OUT}/d_result.png')
    print(json.dumps(r, ensure_ascii=False, indent=1)[:6000])
    print('\n'.join(logs[:30]))
    b.close()
