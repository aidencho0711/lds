from playwright.sync_api import sync_playwright
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
OUT='/home/claude/br/test/shots'
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for (w,h,name,mob) in [(1280,720,'d',False),(844,390,'m',True)]:
        ctx = b.new_context(viewport={'width':w,'height':h}, has_touch=mob, is_mobile=mob); pg = ctx.new_page(); pg.route('**/*', route)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1000)
        pg.evaluate("()=>{ localStorage.setItem('lastdrop.stats', JSON.stringify({matches:12,wins:2,kills:31,xp:2600,best:1,recent:[{rank:1,total:25,kills:6,time:540,map:'kalden'},{rank:7,total:100,kills:3,time:820,map:'norden',ranked:true,delta:22}]})); localStorage.setItem('lastdrop.rank', JSON.stringify({rp:1730,placed:3,placements:[50,60,70],games:5,wins:1,peak:1730,history:[]})); localStorage.setItem('lastdrop.settings', JSON.stringify({quality:'medium', map:'kalden', queue:'normal'})); }")
        pg.reload(); pg.wait_for_timeout(2600)
        pg.screenshot(path=f'{OUT}/lb_{name}_play.png')
        pg.click('#segQueue button.ranked'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_ranked.png')
        pg.click('#lbTabs [data-tab=record]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_record.png')
        pg.click('#lbTabs [data-tab=custom]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_custom.png')
        pg.click('#lbTabs [data-tab=play]'); pg.click('[data-ui=matchCfg]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_cfg.png')
        pg.click('[data-ui=closeMatchCfg]'); pg.click('#mapCard'); pg.wait_for_timeout(200); pg.click('#mapGrid .map-opt:nth-child(3)'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_map.png')
        pg.click('[data-ui=closeMapPick]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/lb_{name}_after.png')
        st = pg.evaluate("()=>({map: JSON.parse(localStorage.getItem('lastdrop.settings')).map, overflowX: document.documentElement.scrollWidth > innerWidth, lbLeftH: document.querySelector('.lb-left').scrollHeight, lbLeftClient: document.querySelector('.lb-left').clientHeight})")
        print(name, st, errs[:3])
        ctx.close()
    b.close()
