import sys
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
    pg = b.new_page(viewport={'width':900,'height':560}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(2500)
    for t in sys.argv[1].split(','):
      for ang in [0.75, 2.4]:
        pg.evaluate("""([t,ang])=>{ const L=__LD, R=L.G.renderer; L.G.state='x'; document.getElementById('lobby').hidden=true; const sc=new THREE.Scene(); sc.background=new THREE.Color(0xa9bcc6);
          sc.add(new THREE.HemisphereLight(0xdfe8f0,0x5a5040,0.7)); const sun=new THREE.DirectionalLight(0xfff2da,1.0); sun.position.set(5,9,6); sc.add(sun);
          const g=new THREE.Mesh(new THREE.PlaneGeometry(60,60), new THREE.MeshLambertMaterial({color:0x6b6a58})); g.rotation.x=-Math.PI/2; sc.add(g);
          const P=L.VehModels.instance(t); sc.add(P.root); P.root.rotation.y=ang; if(P.steerPivots[0]) P.steerPivots.forEach(s=>s.rotation.y=0.3);
          const D={horse:5.2,moto:4.2,uaz:7.5,sedan:7.5,pickup:8.5}[t]; const cam=new THREE.PerspectiveCamera(40, 900/560, 0.1, 200); cam.position.set(0, D*0.32, D); cam.lookAt(0, {horse:1.2,moto:0.65}[t]||0.9, 0);
          R.setSize(900,560,false); R.render(sc,cam); }""", [t, ang])
        pg.wait_for_timeout(250); pg.screenshot(path=f'{OUT}/v_{t}_{int(ang*10)}.png')
    print('errs', errs[:5])
    b.close()
