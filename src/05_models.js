// ============================================================
// 05_models.js — 정밀 3D 모델과 인벤토리 아이콘
//  · 총기: 본체 + 움직이는 부품(탄창·장전손잡이·펌프·볼트·슬라이드·급탄 덮개·꺾이는 총열)
//    VK9·P-19는 여기, 나머지 12종은 05_models_guns.js
//  · 조준경 6종(레드닷·홀로·2·3·4·6배), 보정기·수직손잡이·대용량 탄창
//  · 탄약·회복·방어구·가방·투척 아이템 (라벨은 캔버스로 그린 자체 디자인)
//  · 재질은 광택 금속 / 무광 금속 / 비금속 3계열로 묶고 색은 정점 색으로 → 드로우콜 최소화
//  · 같은 부품의 지오메트리는 한 번만 만들고 모든 인스턴스가 공유
//  · 아이콘: 스튜디오 조명으로 오프스크린 렌더 → PNG data URL
// ============================================================
const Models = (() => {
  let R = null, ENV = null;
  const CLS = {}, TEXMAT = {}, TEX = {}, CL = {}, ICON = {};
  const WHITE = new THREE.Color(1, 1, 1);
  const KIND2CLS = { metal: 'metal', brass: 'metal', alu: 'metal', gunmetal: 'matte', anod: 'matte', foil: 'matte', polymer: 'diel', rubber: 'diel', wood: 'diel', cloth: 'diel', paper: 'diel' };
  const M = (kind, color) => ({ desc: true, cls: KIND2CLS[kind] || 'diel', color: new THREE.Color(color) });
  const FONT = '"Saira Condensed","Arial Narrow",Arial,sans-serif';

  // ---------- 환경광(반사) ----------
  function makeEnv(r) {
    const pm = new THREE.PMREMGenerator(r), sc = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16), col = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 10;
      if (y > 0) col.push(lerp(0.5, 0.78, y), lerp(0.55, 0.84, y), lerp(0.6, 0.95, y));
      else col.push(0.2 + 0.12 * (1 + y), 0.18 + 0.1 * (1 + y), 0.15 + 0.08 * (1 + y));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const box = (x, y, z, w, h, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i * 0.97), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
    box(0, 8, 2, 9, 5, 3.2); box(-8, 3, -1, 3, 7, 1.7); box(6, 2, -6, 5, 4, 1.3); box(3, 1, 8, 6, 2, 0.9);
    const rt = pm.fromScene(sc, 0.02);
    pm.dispose();
    return rt.texture;
  }
  function init(renderer) {
    R = renderer;
    try { ENV = makeEnv(renderer); } catch (e) { console.warn('환경맵 생성 실패', e); ENV = null; }
    const S = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap: ENV }, o));
    CLS.metal = S({ vertexColors: true, roughness: 0.32, metalness: 0.9, envMapIntensity: 0.85 });
    CLS.matte = S({ vertexColors: true, roughness: 0.52, metalness: 0.5, envMapIntensity: 0.6 });
    CLS.diel = S({ vertexColors: true, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.22 });
    CLS.glass = S({ color: 0xb4dcf5, roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.6 });
    CLS.lens = S({ color: 0x14233a, roughness: 0.02, metalness: 0.9, envMapIntensity: 1.9 });
    CLS.glow = new THREE.MeshBasicMaterial({ color: 0xff5a2e });
    CLS.shadow = new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const k in CLS) CLS[k].userData.clsKey = 'cls:' + k;
  }

  // ---------- 텍스처 ----------
  function ctex(key, w, h, draw, rep) {
    if (TEX[key]) return TEX[key];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
    return (TEX[key] = t);
  }
  function MT(tex, o = {}) {
    const k = tex.uuid + JSON.stringify(o);
    if (TEXMAT[k]) return TEXMAT[k];
    return (TEXMAT[k] = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough !== undefined ? o.rough : 0.8, metalness: o.metal || 0, envMap: ENV, envMapIntensity: 0.22, alphaTest: o.alpha ? 0.5 : 0 }));
  }
  function blobTex() {
    return ctex('blob', 64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); });
  }
  function camoTex(kind) {
    const P = { desert: ['#a48d68', '#8a7350', '#c2ad86', '#6e5a3e'], coyote: ['#7f6b4c', '#958159', '#62523a', '#a8956c'], woodland: ['#4e5636', '#3b4129', '#6a6a44', '#2b2b22'] }[kind];
    return ctex('camo:' + kind, 256, 256, (c, w, h) => {
      const rng = mulberry32(kind.length * 977);
      c.fillStyle = P[0]; c.fillRect(0, 0, w, h);
      for (let layer = 1; layer < P.length; layer++) {
        c.fillStyle = P[layer];
        for (let i = 0; i < 26; i++) {
          const x = rng() * w, y = rng() * h, r = 8 + rng() * 22;
          c.beginPath();
          for (let a = 0; a <= 10; a++) { const t = a / 10 * TAU, rr = r * (0.6 + rng() * 0.6); c.lineTo(x + Math.cos(t) * rr * 1.4, y + Math.sin(t) * rr); }
          c.closePath(); c.fill();
          // 경계에서 이어지도록 복제
          if (x < 40 || y < 40) { c.save(); c.translate(x < 40 ? w : 0, y < 40 ? h : 0); c.fill(); c.restore(); }
        }
      }
      // 직물 결
      c.globalAlpha = 0.08; c.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      c.globalAlpha = 1;
    }, 5);
  }
  function txt(c, s, x, y, size, color, weight = 700, align = 'center') { c.fillStyle = color; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y); }
  function barcode(c, x, y, w, h) { c.fillStyle = '#111'; let px = x; const rng = mulberry32(Math.round(x * 7 + y)); while (px < x + w) { const bw = 1 + Math.floor(rng() * 3); if (rng() > 0.4) c.fillRect(px, y, bw, h); px += bw + 1; } }
  const LABELS = {
    a556: (c, w, h) => { c.fillStyle = '#cdb98e'; c.fillRect(0, 0, w, h); c.fillStyle = '#3c5a32'; c.fillRect(0, 0, w, h * 0.22); txt(c, '5.56 × 45 mm', w / 2, h * 0.11, 30, '#f2ecd8'); txt(c, '5.56', w / 2, h * 0.42, 92, '#2a2418', 800); txt(c, '40 CARTRIDGES', w / 2, h * 0.62, 26, '#2a2418'); txt(c, 'BALL · 62 GR', w / 2, h * 0.72, 22, '#4a4030', 500); barcode(c, w * 0.2, h * 0.8, w * 0.6, h * 0.12); c.strokeStyle = '#2a2418'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); },
    a9: (c, w, h) => { c.fillStyle = '#ebe7dc'; c.fillRect(0, 0, w, h); c.fillStyle = '#244a7a'; c.fillRect(0, h * 0.7, w, h * 0.3); txt(c, '9 × 19', w / 2, h * 0.3, 80, '#1d2a3a', 800); txt(c, 'mm LUGER · FMJ', w / 2, h * 0.53, 26, '#1d2a3a'); txt(c, '45 ROUNDS', w / 2, h * 0.85, 30, '#f0f0f0'); },
    a12: (c, w, h) => { c.fillStyle = '#9c1f18'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f0e2c8'; c.lineWidth = 5; c.strokeRect(10, 10, w - 20, h - 20); txt(c, '12', w * 0.35, h * 0.38, 110, '#f0e2c8', 800); txt(c, 'GA', w * 0.7, h * 0.44, 50, '#f0e2c8', 800); txt(c, '00 BUCK · 9 PELLETS', w / 2, h * 0.68, 24, '#f0e2c8'); txt(c, '15 SHELLS', w / 2, h * 0.82, 26, '#f0e2c8'); },
    a300: (c, w, h) => { c.fillStyle = '#272b29'; c.fillRect(0, 0, w, h); c.fillStyle = '#c99a3c'; c.fillRect(0, h * 0.08, w, h * 0.05); c.fillRect(0, h * 0.87, w, h * 0.05); txt(c, '.300', w / 2, h * 0.3, 96, '#e7d9b4', 800); txt(c, 'MAGNUM', w / 2, h * 0.5, 50, '#c99a3c', 800); txt(c, '10 ROUNDS · MATCH', w / 2, h * 0.67, 24, '#bdb39a'); barcode(c, w * 0.25, h * 0.74, w * 0.5, h * 0.09); },
    a762: (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '7.62 MM', w / 2, h * 0.3, 78, '#e2c23a', 800); txt(c, '30 CARTRIDGES · BALL', w / 2, h * 0.62, 30, '#e2c23a'); txt(c, 'LOT 26-114', w / 2, h * 0.84, 24, '#e2c23a', 500); },
    bandage: (c, w, h) => { c.fillStyle = '#e9e4d4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6b6a'; c.fillRect(0, 0, w * 0.13, h); txt(c, 'FIELD', w * 0.57, h * 0.2, 46, '#1f2a2a', 800); txt(c, 'DRESSING', w * 0.57, h * 0.33, 46, '#1f2a2a', 800); txt(c, 'STERILE · 10 CM', w * 0.57, h * 0.47, 24, '#3a4444'); txt(c, 'PRESSURE PAD', w * 0.57, h * 0.56, 24, '#3a4444'); c.fillStyle = '#7a2e1e'; c.fillRect(w * 0.42, h * 0.66, w * 0.3, h * 0.07); txt(c, 'SINGLE USE', w * 0.57, h * 0.695, 20, '#f2ecd8'); txt(c, 'TEAR ▸', w * 0.57, h * 0.88, 26, '#1f2a2a'); },
    cross: (c, w, h) => { c.fillStyle = '#e8e2d0'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, TAU); c.fill(); c.fillStyle = '#2d7a4b'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.44, 0, TAU); c.fill(); c.fillStyle = '#f4f2ea'; const a = w * 0.1, b = w * 0.3; c.fillRect(w / 2 - a, h / 2 - b, a * 2, b * 2); c.fillRect(w / 2 - b, h / 2 - a, b * 2, a * 2); },
    med: (c, w, h) => { c.fillStyle = '#353b29'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8d2bc'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#2d7a4b'; c.beginPath(); c.arc(h * 0.5, h * 0.5, h * 0.3, 0, TAU); c.fill(); c.fillStyle = '#f4f2ea'; const a = h * 0.06, b = h * 0.19; c.fillRect(h * 0.5 - a, h * 0.5 - b, a * 2, b * 2); c.fillRect(h * 0.5 - b, h * 0.5 - a, b * 2, a * 2); txt(c, 'MED KIT', w * 0.62, h * 0.38, 56, '#ece6d2', 800); txt(c, 'TRAUMA · FIELD', w * 0.62, h * 0.66, 28, '#c8c2ae'); },
    can: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1a3a'); g.addColorStop(1, '#16306c'); c.fillStyle = g; c.fillRect(0, 0, w, h); for (const ox of [0, w / 2]) { c.fillStyle = '#f5c518'; c.beginPath(); c.moveTo(ox + w * 0.1, h * 0.12); c.lineTo(ox + w * 0.18, h * 0.12); c.lineTo(ox + w * 0.14, h * 0.45); c.lineTo(ox + w * 0.2, h * 0.45); c.lineTo(ox + w * 0.09, h * 0.88); c.lineTo(ox + w * 0.12, h * 0.55); c.lineTo(ox + w * 0.06, h * 0.55); c.closePath(); c.fill(); txt(c, 'VOLT', ox + w * 0.34, h * 0.45, 58, '#ffffff', 800); txt(c, 'RUSH', ox + w * 0.34, h * 0.68, 34, '#f5c518', 800); } c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, h * 0.06, w, 3); c.fillRect(0, h * 0.93, w, 3); },
    smoke: (c, w, h) => { c.fillStyle = '#d9dcd2'; c.fillRect(0, 0, w, h); c.fillStyle = '#2e6b3a'; c.fillRect(0, 0, w, h * 0.25); c.fillRect(0, h * 0.75, w, h * 0.25); for (const ox of [0, w / 2]) txt(c, 'SMOKE · GREEN', ox + w / 4, h / 2, 34, '#1d2a1f', 800); },
    patch3: (c, w, h) => { c.fillStyle = '#2b2c26'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a8470'; c.lineWidth = 4; c.strokeRect(5, 5, w - 10, h - 10); txt(c, 'ARMOR III', w / 2, h / 2, 46, '#d6d0b8', 800); },
    patch1: (c, w, h) => { c.fillStyle = '#20262e'; c.fillRect(0, 0, w, h); txt(c, 'ARMOR', w / 2, h / 2, 54, '#cfd6de', 800); },
  };
  function label(key, w = 256, h = 384) { return MT(ctex('lbl:' + key, w, h, LABELS[key]), key === 'a762' ? { alpha: true, rough: 0.7 } : {}); }

  // ---------- 지오메트리 도우미 ----------
  const A = (g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  const BX = (w, h, l) => new THREE.BoxGeometry(w, h, l);
  function CY(r1, r2, len, seg = 12, axis = 'z', open = false) {
    const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, open);
    if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(-Math.PI / 2);
    return g;
  }
  function rrShape(L, H, r) {
    const s = new THREE.Shape(), x = -L / 2, y = -H / 2;
    r = Math.max(0, Math.min(r, L / 2 - 1e-4, H / 2 - 1e-4));
    s.moveTo(x + r, y); s.lineTo(x + L - r, y); s.quadraticCurveTo(x + L, y, x + L, y + r);
    s.lineTo(x + L, y + H - r); s.quadraticCurveTo(x + L, y + H, x + L - r, y + H);
    s.lineTo(x + r, y + H); s.quadraticCurveTo(x, y + H, x, y + H - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // 둥근 상자: w=x(폭), h=y(높이), l=z(길이). 옆면 윤곽은 반경 r로 둥글고, 모서리는 베벨
  function RB(w, h, l, r = 0.004, bev) {
    const b = bev !== undefined ? bev : Math.min(r * 0.5, w * 0.25, 0.006);
    const d = Math.max(0.0005, w - 2 * b);
    const geo = new THREE.ExtrudeGeometry(rrShape(Math.max(0.001, l - 2 * b), Math.max(0.001, h - 2 * b), Math.max(0, r - b)), { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
    geo.rotateY(-Math.PI / 2); geo.translate(d / 2, 0, 0);
    return geo;
  }
  // 측면 윤곽(z,y) 압출. w = 두께(x)
  function PF(pts, w, bev = 0.0015) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    const d = Math.max(0.0005, w - 2 * bev);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 4 });
    g.rotateY(-Math.PI / 2); g.translate(d / 2, 0, 0);
    return g;
  }
  const SPH = (r, ws = 14, hs = 10, t0 = 0, tl = Math.PI, p0 = 0, pl = TAU) => new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl);
  const TOR = (r, t, rs = 8, ts = 16, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
  const PL = (w, h) => new THREE.PlaneGeometry(w, h);
  function flip(geo) {
    const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const a = i + 3 + k, b = i + 6 + k; let t = p[a]; p[a] = p[b]; p[b] = t; t = n[a]; n[a] = n[b]; n[b] = t; }
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
    if (uv) for (let i = 0; i < uv.length; i += 6) { let t = uv[i + 2]; uv[i + 2] = uv[i + 4]; uv[i + 4] = t; t = uv[i + 3]; uv[i + 3] = uv[i + 5]; uv[i + 5] = t; }
    return g;
  }
  function tube(g, ro, ri, len, m, x, y, z, seg = 20) {
    A(g, CY(ro, ro, len, seg, 'z', true), m, x, y, z);
    A(g, flip(CY(ri, ri, len, seg, 'z', true)), m, x, y, z);
    A(g, new THREE.RingGeometry(ri, ro, seg), m, x, y, z + len / 2);
    A(g, flip(new THREE.RingGeometry(ri, ro, seg)), m, x, y, z - len / 2);
  }
  function rail(g, z0, z1, y, w = 0.021, m = M('anod', 0x222427)) {
    A(g, BX(w, 0.006, z1 - z0), m, 0, y + 0.003, (z0 + z1) / 2);
    const t = BX(w, 0.0045, 0.0052);
    for (let z = z0 + 0.004; z < z1 - 0.002; z += 0.0105) A(g, t, m, 0, y + 0.0083, z);
  }
  function trigger(g, z, y, m) {
    A(g, BX(0.011, 0.004, 0.05), m, 0, y - 0.026, z + 0.008);
    A(g, BX(0.011, 0.026, 0.004), m, 0, y - 0.013, z + 0.032);
    A(g, BX(0.005, 0.02, 0.004), m, 0, y - 0.012, z, -0.25, 0, 0);
  }
  function magPts(len, top, curve, extra = 0.004) {
    const f = [], b = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, y = -len * t, off = curve * t * t; f.push([top / 2 + off + extra * t, y]); b.push([-top / 2 + off, y]); }
    return f.concat(b.reverse());
  }

  // ---------- 병합 ----------
  function concat(geos) {
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2); col.set(g.attributes.color.array, o * 3);
      o += c; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  const _inv = new THREE.Matrix4(), _tm = new THREE.Matrix4();
  function mergeGroup(root) {
    root.updateMatrixWorld(true);
    _inv.copy(root.matrixWorld).invert();
    const buckets = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const m = o.material; let key, real, col = null;
      if (m && m.desc) { key = 'cls:' + m.cls; real = CLS[m.cls]; col = m.color; }
      else { key = (m.userData && m.userData.clsKey) || m.uuid; real = m; }
      _tm.multiplyMatrices(_inv, o.matrixWorld);
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(_tm);
      if (_tm.determinant() < 0) flip(g);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count;
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      if (col || !g.attributes.color) {
        const c = new Float32Array(n * 3), cc = col || WHITE;
        for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      if (!buckets.has(key)) buckets.set(key, { mat: real, geos: [] });
      buckets.get(key).geos.push(g);
    });
    const out = [];
    for (const b of buckets.values()) out.push({ mat: b.mat, geo: concat(b.geos) });
    // 투명 재질은 마지막에
    out.sort((a, b) => (a.mat.transparent ? 1 : 0) - (b.mat.transparent ? 1 : 0));
    return out;
  }
  // 같은 키는 한 번만 생성 → 새 그룹은 지오메트리·재질을 공유하는 메시 몇 개
  function cluster(key, build) {
    let parts = CL[key];
    if (!parts) { const g = new THREE.Group(); build(g); parts = CL[key] = mergeGroup(g); }
    const out = new THREE.Group();
    for (const p of parts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = !p.mat.transparent && p.mat !== CLS.shadow; out.add(m); }
    return out;
  }

  // ---------- 총기 ----------
  const GUNS = {
    vk9: {
      meta: { railY: 0.078, scopeZ: 0.035, ironY: 0.09, ironRearZ: -0.1, muzzleZ: 0.297, boreY: 0.032, magPos: [0, -0.015, 0.09], chargePos: [0.031, 0.052, 0.17], chargeTravel: 0.07, chargeHand: [0.055, 0.06, 0.18],
        gripPos: [0, -0.07, -0.058], forePos: [0.035, 0.005, 0.165], vgripPos: [0, -0.0175, 0.15], vgripHand: [0.004, -0.065, 0.15], ejectPos: [-0.028, 0.04, 0.085], hip: [0.12, -0.14, -0.4] },
      body(g) {
        const pb = M('polymer', 0x2a2c2e), dk = M('polymer', 0x161718), st = M('gunmetal', 0x303236), bl = M('polymer', 0x080808);
        A(g, RB(0.052, 0.085, 0.3, 0.012), pb, 0, 0.025, 0.04);
        A(g, PF([[-0.085, -0.012], [-0.03, -0.012], [-0.042, -0.128], [-0.082, -0.128], [-0.09, -0.116], [-0.08, -0.012]], 0.032), pb);
        trigger(g, -0.012, -0.012, dk);
        A(g, BX(0.036, 0.03, 0.05), pb, 0, -0.028, 0.09);
        A(g, CY(0.017, 0.017, 0.07, 12), dk, 0, 0.032, 0.225);
        for (let i = 0; i < 4; i++) A(g, BX(0.035, 0.004, 0.006), bl, 0, 0.032, 0.2 + i * 0.015);
        A(g, CY(0.0075, 0.0075, 0.04, 10), st, 0, 0.032, 0.276);
        rail(g, -0.1, 0.18, 0.0675, 0.02, M('anod', 0x1e2022));
        A(g, TOR(0.008, 0.002, 6, 14), dk, 0, 0.09, 0.172); A(g, BX(0.003, 0.012, 0.004), dk, 0, 0.084, 0.172);
        A(g, BX(0.022, 0.014, 0.016), dk, 0, 0.083, -0.09); A(g, TOR(0.0045, 0.0014, 6, 12), dk, 0, 0.09, -0.1);
        A(g, BX(0.012, 0.012, 0.2), dk, 0, 0.042, -0.21); A(g, BX(0.012, 0.012, 0.2), dk, 0, -0.012, -0.21);
        A(g, RB(0.034, 0.11, 0.018, 0.004), dk, 0, 0.012, -0.315);
        A(g, BX(0.004, 0.02, 0.04), bl, -0.0265, 0.04, 0.085);
      },
      mag(g, ext) { const L = ext ? 0.24 : 0.18; A(g, PF([[-0.013, 0], [0.013, 0], [0.024, -L], [-0.004, -L]], 0.022), M('polymer', 0x141516)); A(g, RB(0.026, 0.01, 0.034, 0.003), M('polymer', 0x0e0f10), 0, -L - 0.003, 0.0105); },
      charge(g) { A(g, CY(0.006, 0.006, 0.06, 8), M('gunmetal', 0x26282b), 0, 0, -0.02); A(g, RB(0.016, 0.012, 0.012, 0.003), M('polymer', 0x111111), 0.01, 0, 0.008); },
    },
    p19: {
      meta: { railY: 0.035, scopeZ: -0.01, ironY: 0.041, ironRearZ: -0.055, muzzleZ: 0.11, boreY: 0.02, magPos: [0, -0.02, -0.042], slidePos: [0, 0, 0], slideTravel: 0.032, gripPos: [0, -0.06, -0.045], forePos: [0.022, -0.08, -0.03],
        chargeHand: [0, 0.05, -0.05], ejectPos: [-0.016, 0.032, 0.03], hip: [0.1, -0.12, -0.36], pistol: true },
      body(g) {
        const pf = M('polymer', 0x1b1c1e), dk = M('polymer', 0x0f1011), st = M('gunmetal', 0x2c2e31);
        A(g, RB(0.027, 0.022, 0.16, 0.004), pf, 0, -0.008, 0.02);
        A(g, PF([[-0.062, -0.017], [-0.012, -0.017], [-0.026, -0.125], [-0.074, -0.125], [-0.082, -0.112], [-0.072, -0.019]], 0.03), pf);
        A(g, BX(0.02, 0.005, 0.045), dk, 0, -0.0215, 0.07);
        trigger(g, 0.005, -0.012, pf);
        A(g, CY(0.0065, 0.0065, 0.012, 10), st, 0, 0.02, 0.104);
        for (const sx of [-1, 1]) A(g, BX(0.002, 0.05, 0.028), dk, sx * 0.0155, -0.075, -0.05, 0.13, 0, 0);
      },
      slide(g) {
        const st = M('gunmetal', 0x2a2c2f), dk = M('polymer', 0x0b0b0b), wt = M('paper', 0xf0f0e8);
        A(g, RB(0.026, 0.03, 0.17, 0.004), st, 0, 0.02, 0.02);
        for (let i = 0; i < 6; i++) A(g, BX(0.0265, 0.022, 0.0018), dk, 0, 0.02, -0.058 + i * 0.005);
        A(g, BX(0.012, 0.004, 0.032), dk, -0.005, 0.0345, 0.03);
        A(g, BX(0.004, 0.006, 0.005), dk, 0, 0.038, 0.095); A(g, BX(0.0022, 0.0022, 0.001), wt, 0, 0.039, 0.0977);
        for (const sx of [-1, 1]) A(g, BX(0.005, 0.007, 0.006), dk, sx * 0.0055, 0.0385, -0.055);
      },
      mag(g, ext) { const L = ext ? 0.135 : 0.105, m = M('polymer', 0x141516); A(g, BX(0.02, L, 0.03), m, 0, -L / 2, -L / 2 * 0.13, 0.13, 0, 0); A(g, RB(0.026, 0.008, 0.038, 0.003), M('polymer', 0x0c0d0e), 0, -L - 0.004, -L * 0.13, 0.13, 0, 0); },
    },
  };

  // ---------- 조준경 ----------
  const SC = {
    reddot: { eyeY: 0.031, len: 0.07, relief: 0.36, build(g) {
      const an = M('anod', 0x1d1f22);
      A(g, RB(0.024, 0.01, 0.046, 0.002), an, 0, 0.005, 0); A(g, BX(0.014, 0.012, 0.03), an, 0, 0.015, 0);
      tube(g, 0.0185, 0.0155, 0.062, an, 0, 0.031, 0);
      tube(g, 0.0205, 0.0165, 0.012, an, 0, 0.031, 0.031);
      A(g, CY(0.0155, 0.0155, 0.0015, 20), CLS.glass, 0, 0.031, 0.026);
      A(g, CY(0.007, 0.007, 0.014, 10, 'y'), an, 0, 0.054, 0); A(g, CY(0.007, 0.007, 0.014, 10, 'x'), an, 0.024, 0.031, 0);
    } },
    holo: { eyeY: 0.037, len: 0.1, relief: 0.36, build(g) {
      const an = M('anod', 0x1d1f22), dk = M('polymer', 0x111213);
      A(g, RB(0.03, 0.02, 0.1, 0.004), an, 0, 0.01, 0);
      for (const sx of [-1, 1]) A(g, BX(0.004, 0.036, 0.05), an, sx * 0.0155, 0.038, 0.018);
      A(g, RB(0.035, 0.005, 0.05, 0.002), an, 0, 0.0585, 0.018);
      A(g, BX(0.027, 0.032, 0.002), CLS.glass, 0, 0.037, 0.04); A(g, BX(0.027, 0.032, 0.002), CLS.glass, 0, 0.037, -0.004);
      for (let i = 0; i < 3; i++) A(g, BX(0.006, 0.004, 0.004), dk, -0.008 + i * 0.008, 0.021, -0.048);
    } },
    x2: { eyeY: 0.04, len: 0.12, relief: 0.26, build(g) {
      const an = M('anod', 0x202226), rb = M('rubber', 0x111111);
      A(g, RB(0.024, 0.012, 0.05, 0.002), an, 0, 0.006, 0); A(g, BX(0.014, 0.02, 0.03), an, 0, 0.018, 0);
      A(g, CY(0.019, 0.019, 0.08, 18), an, 0, 0.04, 0); A(g, CY(0.023, 0.019, 0.025, 18), an, 0, 0.04, 0.05); A(g, CY(0.021, 0.021, 0.02, 18), rb, 0, 0.04, -0.05);
      A(g, CY(0.0195, 0.0195, 0.002, 18), CLS.lens, 0, 0.04, 0.063); A(g, CY(0.017, 0.017, 0.002, 18), CLS.lens, 0, 0.04, -0.061);
      A(g, CY(0.008, 0.008, 0.012, 10, 'y'), an, 0, 0.064, 0);
    } },
    x3: { eyeY: 0.044, len: 0.135, relief: 0.26, build(g) {
      const an = M('anod', 0x23262a), rb = M('rubber', 0x111111);
      A(g, RB(0.024, 0.012, 0.06, 0.002), an, 0, 0.006, 0); A(g, BX(0.016, 0.014, 0.04), an, 0, 0.016, 0);
      A(g, RB(0.036, 0.042, 0.08, 0.01), an, 0, 0.04, -0.005);
      A(g, CY(0.022, 0.022, 0.035, 18), an, 0, 0.044, 0.05); A(g, CY(0.02, 0.02, 0.025, 18), rb, 0, 0.044, -0.056);
      A(g, CY(0.0195, 0.0195, 0.002, 18), CLS.lens, 0, 0.044, 0.068); A(g, CY(0.017, 0.017, 0.002, 18), CLS.lens, 0, 0.044, -0.069);
      A(g, CY(0.009, 0.009, 0.014, 10, 'x'), an, 0.024, 0.044, 0);
      rail(g, -0.025, 0.02, 0.061, 0.016, an);
    } },
    x4: { eyeY: 0.047, len: 0.16, relief: 0.26, build(g) {
      const an = M('anod', 0x2a2c2f), rb = M('rubber', 0x111111);
      A(g, RB(0.024, 0.012, 0.07, 0.002), an, 0, 0.006, 0); A(g, BX(0.018, 0.014, 0.05), an, 0, 0.016, 0);
      A(g, PF([[-0.055, 0.02], [0.05, 0.02], [0.062, 0.072], [-0.045, 0.072]], 0.042), an);
      A(g, CY(0.024, 0.024, 0.032, 18), an, 0, 0.047, 0.072); A(g, CY(0.019, 0.019, 0.026, 18), rb, 0, 0.047, -0.066);
      A(g, CY(0.0215, 0.0215, 0.002, 18), CLS.lens, 0, 0.047, 0.089); A(g, CY(0.016, 0.016, 0.002, 18), CLS.lens, 0, 0.047, -0.08);
      A(g, CY(0.0035, 0.0035, 0.085, 8), CLS.glow, 0.012, 0.075, 0.0);
      A(g, CY(0.009, 0.009, 0.014, 10, 'x'), an, 0.026, 0.05, -0.01); A(g, CY(0.008, 0.008, 0.01, 10, 'y'), an, -0.008, 0.077, -0.03);
    } },
    x6: { eyeY: 0.052, len: 0.29, relief: 0.26, build(g) {
      const an = M('anod', 0x1b1d20), rb = M('rubber', 0x101010);
      for (const z of [-0.055, 0.055]) { A(g, RB(0.022, 0.026, 0.02, 0.003), an, 0, 0.013, z); A(g, TOR(0.0142, 0.004, 8, 18), an, 0, 0.052, z); }
      A(g, CY(0.0127, 0.0127, 0.16, 18), an, 0, 0.052, 0);
      A(g, CY(0.026, 0.0127, 0.055, 20), an, 0, 0.052, 0.107); A(g, CY(0.026, 0.026, 0.02, 20), an, 0, 0.052, 0.144);
      A(g, CY(0.0127, 0.019, 0.035, 18), an, 0, 0.052, -0.097); A(g, CY(0.02, 0.02, 0.035, 18), rb, 0, 0.052, -0.13);
      A(g, CY(0.024, 0.024, 0.002, 20), CLS.lens, 0, 0.052, 0.155); A(g, CY(0.017, 0.017, 0.002, 18), CLS.lens, 0, 0.052, -0.148);
      A(g, CY(0.0105, 0.0105, 0.022, 14, 'y'), an, 0, 0.074, 0); A(g, CY(0.0105, 0.0105, 0.022, 14, 'x'), an, -0.024, 0.052, 0); A(g, CY(0.0085, 0.0085, 0.016, 12, 'x'), an, 0.022, 0.052, 0);
    } },
  };
  const ATT = {
    comp(g) { A(g, CY(0.0145, 0.0145, 0.05, 12), M('gunmetal', 0x1a1b1d), 0, 0, 0.025); for (let i = 0; i < 3; i++) A(g, BX(0.02, 0.004, 0.007), M('polymer', 0x050505), 0, 0.0135, 0.012 + i * 0.012); },
    grip(g) { const pb = M('polymer', 0x1c1e20); A(g, RB(0.02, 0.01, 0.034, 0.003), pb, 0, -0.005, 0); A(g, CY(0.0125, 0.014, 0.07, 12, 'y'), pb, 0, -0.045, 0); A(g, CY(0.0145, 0.0145, 0.006, 12, 'y'), pb, 0, -0.082, 0); },
  };

  function buildGun(id, att) {
    att = att || {};
    const D = GUNS[id], meta = Object.assign({}, D.meta), g = new THREE.Group(), parts = {};
    g.add(cluster('gb:' + id, D.body));
    const ext = att.mag ? 1 : 0;
    const mk = (name, posKey, key, fn) => { const pv = new THREE.Group(); pv.position.fromArray(meta[posKey]); pv.add(cluster(key, fn)); pv.userData.home = pv.position.clone(); g.add(pv); parts[name] = pv; return pv; };
    if (D.mag) mk('mag', 'magPos', 'gm:' + id + ext, (gg) => D.mag(gg, ext));
    if (D.charge) mk('charge', 'chargePos', 'gc:' + id, D.charge);
    if (D.pump) mk('pump', 'pumpPos', 'gp:' + id, D.pump);
    if (D.bolt) mk('bolt', 'boltPos', 'gbo:' + id, D.bolt);
    if (D.slide) mk('slide', 'slidePos', 'gs:' + id, D.slide);
    if (D.cover) mk('cover', 'coverPos', 'gcv:' + id, D.cover);
    if (D.barrel) mk('barrel', 'barrelPos', 'gbr:' + id, D.barrel);
    const host = meta.scopeOnCover && parts.cover ? parts.cover : parts.slide || g, hp = host === g ? [0, 0, 0] : host.position.toArray();
    if (D.rear) g.add(att.scope ? cluster('grf:' + id, D.rearFolded) : cluster('gr:' + id, D.rear));
    if (att.scope && SC[att.scope]) {
      if (meta.railOnScope) { const [z0, z1, y] = meta.railOnScope; g.add(cluster('rail:' + id, (gg) => (D.mount || ((g2) => rail(g2, z0, z1, y, 0.018, M('anod', 0x1e2022))))(gg))); }
      const S = SC[att.scope], s = cluster('sc:' + att.scope, S.build);
      s.position.set(-hp[0], meta.railY - hp[1], meta.scopeZ - hp[2]); host.add(s);
      meta.sightY = meta.railY + S.eyeY; meta.sightRearZ = meta.scopeZ - S.len / 2; meta.relief = S.relief;
    } else { meta.sightY = meta.ironY; meta.sightRearZ = meta.ironRearZ; meta.relief = meta.pistol ? 0.4 : 0.3; }
    if (D.front) g.add(att.scope && D.frontFolded ? cluster('gff:' + id, D.frontFolded) : cluster('gf:' + id, D.front));
    if (att.muzzle) { const m = cluster('at:comp', ATT.comp); m.position.set(0, meta.boreY, meta.muzzleZ); g.add(m); meta.muzzleZ += 0.05; }
    if (att.grip && meta.vgripPos) { const m = cluster('at:grip', ATT.grip); m.position.fromArray(meta.vgripPos); g.add(m); meta.forePos = meta.vgripHand; }
    g.userData = { id, meta, parts, att };
    return g;
  }

  // ---------- 아이템 ----------
  const CAL = { 556: [0.045, 0.0048, 0.0037, 0.019, 0.0029], 762: [0.051, 0.006, 0.0045, 0.024, 0.0039], 9: [0.019, 0.005, 0.0049, 0.011, 0.0045], 300: [0.067, 0.0068, 0.0047, 0.03, 0.0039] };
  function cart(g, cal, x, z, ry) {
    const ax = Math.sin(ry), az = Math.cos(ry);
    const P = (geo, m, off, r) => A(g, geo, m, x + ax * off, r, z + az * off, 0, ry, 0);
    const brass = M('brass', 0xc9a24a), cu = M('brass', 0xb8703a);
    if (cal === 12) { P(CY(0.0105, 0.0105, 0.05, 14), M('polymer', 0xa82020), 0.008, 0.0105); P(CY(0.011, 0.011, 0.016, 14), brass, -0.025, 0.0105); return; }
    const [L, r, rn, bl, br] = CAL[cal];
    P(CY(r, r, L * 0.82, 12), brass, -L * 0.09, r);
    P(CY(rn, r, L * 0.12, 12), brass, L * 0.38, r);
    P(CY(0.0004, br, bl, 12), cu, L * 0.44 + bl / 2, r);
    P(CY(r * 1.03, r * 1.03, 0.002, 12), brass, -L / 2, r);
  }
  const ITEMB = {
    a556(g) { A(g, RB(0.1, 0.055, 0.15, 0.004), M('paper', 0xb9a679), 0, 0.0275, 0); A(g, PL(0.094, 0.144), label('a556'), 0, 0.0557, 0, -Math.PI / 2); cart(g, 556, 0.075, -0.03, 0.35); cart(g, 556, 0.085, 0.01, 0.2); cart(g, 556, 0.07, 0.045, 0.5); },
    a762(g) {
      const od = M('anod', 0x47502f), dk = M('anod', 0x3a4227), st = M('gunmetal', 0x2a2d2a);
      A(g, RB(0.1, 0.1, 0.19, 0.006), od, 0, 0.05, 0); A(g, RB(0.104, 0.016, 0.194, 0.004), dk, 0, 0.104, 0);
      A(g, BX(0.02, 0.012, 0.11), st, 0, 0.122, 0); for (const z of [-0.05, 0.05]) A(g, BX(0.012, 0.012, 0.012), st, 0, 0.116, z);
      A(g, BX(0.03, 0.04, 0.012), st, 0, 0.085, 0.1);
      A(g, PL(0.16, 0.08), label('a762', 384, 192), 0.0506, 0.05, 0, 0, Math.PI / 2);
      cart(g, 762, 0.085, -0.02, 0.4); cart(g, 762, 0.09, 0.03, 0.15);
    },
    a300(g) {
      const od = M('polymer', 0x2f3330), dk = M('polymer', 0x1e2120), lt = M('metal', 0xa8aaa6);
      A(g, RB(0.13, 0.05, 0.19, 0.008), od, 0, 0.025, 0); A(g, RB(0.134, 0.016, 0.194, 0.006), dk, 0, 0.056, 0);
      for (const z of [-0.06, 0.06]) A(g, BX(0.03, 0.01, 0.014), lt, 0.066, 0.045, z);
      A(g, PL(0.12, 0.17), label('a300'), 0, 0.0645, 0, -Math.PI / 2);
      cart(g, 300, 0.1, -0.03, 0.25); cart(g, 300, 0.11, 0.03, 0.05);
    },
    a9(g) { A(g, RB(0.075, 0.04, 0.1, 0.003), M('paper', 0xe8e4da), 0, 0.02, 0); A(g, PL(0.07, 0.095), label('a9'), 0, 0.0405, 0, -Math.PI / 2); cart(g, 9, 0.055, -0.02, 0.6); cart(g, 9, 0.06, 0.015, 0.1); cart(g, 9, 0.05, 0.04, 1.2); },
    a12(g) { A(g, RB(0.085, 0.055, 0.115, 0.003), M('paper', 0x9a1e18), 0, 0.0275, 0); A(g, PL(0.08, 0.11), label('a12'), 0, 0.0556, 0, -Math.PI / 2); cart(g, 12, 0.075, -0.01, 0.3); cart(g, 12, 0.08, 0.04, 0.05); },
    bandage(g) { A(g, RB(0.13, 0.028, 0.19, 0.012, 0.01), M('foil', 0x5a6248), 0, 0.014, 0); A(g, PL(0.095, 0.13), label('bandage'), 0, 0.0285, 0.008, -Math.PI / 2); A(g, BX(0.132, 0.008, 0.014), M('foil', 0x4c5340), 0, 0.012, -0.094); },
    firstaid(g) {
      A(g, RB(0.24, 0.1, 0.17, 0.035, 0.02), MT(camoTex('desert'), { rough: 0.95 }), 0, 0.05, 0);
      A(g, RB(0.244, 0.008, 0.174, 0.03, 0.003), M('cloth', 0x2e2a24), 0, 0.05, 0);
      A(g, BX(0.012, 0.006, 0.026), M('metal', 0x8a8a86), 0.11, 0.057, 0.08);
      A(g, new THREE.CircleGeometry(0.036, 28), MT(ctex('lbl:cross', 128, 128, LABELS.cross)), 0, 0.1005, 0.01, -Math.PI / 2);
      A(g, RB(0.07, 0.012, 0.02, 0.005), M('cloth', 0x3a3428), 0, 0.104, -0.065);
    },
    medkit(g) {
      A(g, RB(0.34, 0.12, 0.25, 0.02), M('polymer', 0x4c5139), 0, 0.06, 0);
      A(g, RB(0.344, 0.008, 0.254, 0.02, 0.003), M('polymer', 0x2e3122), 0, 0.078, 0);
      for (const x of [-0.09, 0.09]) A(g, BX(0.04, 0.03, 0.01), M('gunmetal', 0x3a3d3f), x, 0.078, 0.128);
      A(g, RB(0.13, 0.016, 0.03, 0.006), M('rubber', 0x1b1c1a), 0, 0.137, -0.02); for (const x of [-0.055, 0.055]) A(g, BX(0.012, 0.014, 0.02), M('rubber', 0x1b1c1a), x, 0.127, -0.02);
      A(g, PL(0.2, 0.1), MT(ctex('lbl:med', 384, 192, LABELS.med)), 0, 0.1206, 0.045, -Math.PI / 2);
    },
    drink(g) {
      const al = M('alu', 0xb9bdc2);
      A(g, CY(0.033, 0.033, 0.11, 24, 'y', true), MT(ctex('lbl:can', 512, 256, LABELS.can), { rough: 0.35, metal: 0.5 }), 0, 0.062, 0);
      A(g, CY(0.03, 0.033, 0.008, 24, 'y'), al, 0, 0.121, 0); A(g, CY(0.033, 0.03, 0.006, 24, 'y'), al, 0, 0.004, 0);
      A(g, RB(0.012, 0.002, 0.022, 0.004, 0.0008), M('alu', 0xcfd3d6), 0, 0.1255, 0.006);
    },
    vest(g, id) {
      const lvl = ITEMS[id].lvl, th = lvl === 1 ? 0.04 : 0.06;
      const fab = lvl === 3 ? MT(camoTex('coyote'), { rough: 0.95 }) : M('cloth', lvl === 1 ? 0x37404c : 0x505b3c);
      const dk = M('cloth', lvl === 1 ? 0x262c34 : lvl === 2 ? 0x353d29 : 0x4a3f2c);
      A(g, RB(0.3, 0.34, th, 0.03, 0.012), fab, 0, 0.17, 0.09); A(g, RB(0.3, 0.36, th, 0.03, 0.012), fab, 0, 0.18, -0.09);
      for (const sx of [-1, 1]) { A(g, RB(0.07, 0.03, 0.2, 0.01), dk, sx * 0.09, 0.335, 0); A(g, RB(0.035, 0.17, 0.16, 0.01), dk, sx * 0.158, 0.1, 0); }
      const fz = 0.09 + th / 2;
      if (lvl >= 2) for (let i = -1; i <= 1; i++) { A(g, RB(0.075, 0.1, 0.035, 0.008), fab, i * 0.085, 0.07, fz + 0.017); A(g, RB(0.077, 0.025, 0.04, 0.006), dk, i * 0.085, 0.118, fz + 0.017); }
      if (lvl === 3) { A(g, RB(0.12, 0.07, 0.025, 0.006), fab, 0, 0.21, fz + 0.012); A(g, PL(0.075, 0.035), MT(ctex('lbl:patch3', 256, 120, LABELS.patch3)), 0, 0.21, fz + 0.0255); }
      if (lvl === 1) A(g, PL(0.14, 0.045), MT(ctex('lbl:patch1', 256, 84, LABELS.patch1)), 0, 0.24, fz + 0.001);
      if (lvl >= 2) for (let r = 0; r < 3; r++) A(g, BX(0.26, 0.006, 0.004), dk, 0, 0.2 + r * 0.035, fz + 0.001);
    },
    helmet(g, id) {
      const lvl = ITEMS[id].lvl, col = [0, 0x5f6650, 0x50544a, 0x353a40][lvl];
      const shellM = lvl === 3 ? MT(camoTex('woodland'), { rough: 0.9 }) : M('polymer', col);
      const tl = lvl === 1 ? Math.PI * 0.44 : Math.PI * 0.53;
      const sh = SPH(0.125, 24, 10, 0, tl); sh.scale(1, 0.92, 1.1); A(g, sh, shellM, 0, 0.02, 0);
      const inn = flip(SPH(0.119, 18, 8, 0, tl)); inn.scale(1, 0.92, 1.1); A(g, inn, M('cloth', 0x1c1b18), 0, 0.02, 0);
      if (lvl === 1) { A(g, RB(0.17, 0.008, 0.06, 0.02, 0.003), M('polymer', col), 0, 0.06, 0.125, -0.3, 0, 0); for (const sx of [-1, 1]) A(g, BX(0.008, 0.06, 0.012), M('cloth', 0x222222), sx * 0.11, -0.01, 0.0); }
      if (lvl >= 2) {
        for (const sx of [-1, 1]) A(g, BX(0.01, 0.014, 0.12), M('polymer', 0x23262a), sx * 0.122, 0.04, 0, 0, 0, sx * 0.35);
        A(g, RB(0.045, 0.035, 0.012, 0.006), M('gunmetal', 0x26292c), 0, 0.09, 0.128, -0.45, 0, 0);
        A(g, BX(0.06, 0.03, 0.004), M('cloth', 0x3c3a30), 0, 0.125, -0.09, 0.6, 0, 0);
      }
      if (lvl === 3) { const v = SPH(0.135, 20, 6, 1.25, 0.6, Math.PI / 2 - 0.95, 1.9); v.scale(1, 0.95, 1.12); A(g, v, CLS.glass, 0, 0.03, 0.005); A(g, flip(v.clone()), CLS.glass, 0, 0.03, 0.005); }
    },
    bag(g, id) {
      const lvl = ITEMS[id].lvl, [w, h, d] = [0, [0.26, 0.32, 0.13], [0.31, 0.42, 0.17], [0.35, 0.52, 0.2]][lvl];
      const fab = lvl === 3 ? MT(camoTex('woodland'), { rough: 0.95 }) : M('cloth', lvl === 1 ? 0x6b5a3e : 0x4e5838);
      const dk = M('cloth', lvl === 1 ? 0x3f3424 : 0x2f3524);
      A(g, RB(w, h, d, 0.05, 0.02), fab, 0, h / 2, 0);
      A(g, RB(w * 0.75, h * 0.42, 0.05, 0.03, 0.012), fab, 0, h * 0.3, d / 2 + 0.02);
      A(g, RB(w * 0.7, 0.01, 0.052, 0.01, 0.003), dk, 0, h * 0.3 + h * 0.17, d / 2 + 0.021);
      for (const sx of [-1, 1]) A(g, RB(0.045, h * 0.8, 0.02, 0.01, 0.005), dk, sx * w * 0.25, h * 0.5, -d / 2 - 0.01);
      A(g, TOR(0.025, 0.006, 6, 12, Math.PI), dk, 0, h, -d * 0.2);
      if (lvl >= 2) for (const sx of [-1, 1]) A(g, RB(0.06, h * 0.45, d * 0.6, 0.02, 0.01), fab, sx * (w / 2 + 0.025), h * 0.4, 0);
      if (lvl === 3) {
        A(g, RB(w * 1.02, 0.07, d * 1.05, 0.03, 0.015), fab, 0, h + 0.02, 0.01);
        A(g, CY(0.055, 0.055, w * 1.05, 14, 'x'), M('cloth', 0x4a4434), 0, 0.03, d * 0.15);
        for (const sx of [-1, 1]) A(g, BX(0.018, 0.115, 0.004), dk, sx * w * 0.3, 0.03, d * 0.15 + 0.056);
        for (let r = 0; r < 3; r++) A(g, BX(w * 0.62, 0.006, 0.004), dk, 0, h * 0.62 + r * 0.03, d / 2 + 0.001);
      }
    },
    frag(g) {
      const s = SPH(0.03, 16, 12); s.scale(1, 1.15, 1); A(g, s, M('polymer', 0x4a5236), 0, 0.035, 0);
      A(g, CY(0.011, 0.012, 0.02, 12, 'y'), M('gunmetal', 0x5a5c58), 0, 0.075, 0);
      A(g, BX(0.014, 0.07, 0.005), M('gunmetal', 0x6a6c66), 0, 0.045, 0.033, 0.12, 0, 0);
      A(g, TOR(0.011, 0.0018, 6, 16), M('metal', 0xa8a8a2), 0.018, 0.08, 0, 0, Math.PI / 2, 0);
    },
    smoke(g) {
      A(g, CY(0.03, 0.03, 0.11, 18, 'y'), M('polymer', 0x5a6050), 0, 0.055, 0);
      A(g, CY(0.0305, 0.0305, 0.04, 18, 'y', true), MT(ctex('lbl:smoke', 512, 128, LABELS.smoke)), 0, 0.055, 0);
      A(g, CY(0.012, 0.012, 0.02, 12, 'y'), M('gunmetal', 0x5a5c58), 0, 0.12, 0);
      A(g, BX(0.014, 0.08, 0.005), M('gunmetal', 0x6a6c66), 0, 0.08, 0.032);
      A(g, TOR(0.011, 0.0018, 6, 16), M('metal', 0xa8a8a2), 0.018, 0.125, 0, 0, Math.PI / 2, 0);
    },
  };
  function buildDisplay(id, att) {
    const d = ITEMS[id];
    if (d.type === 'weapon') return buildGun(id, att);
    if (SC[id]) return cluster('sc:' + id, SC[id].build);
    if (id === 'comp') return cluster('at:comp', ATT.comp);
    if (id === 'grip') return cluster('at:grip', ATT.grip);
    if (id === 'extmag') return cluster('gm:m4161', (gg) => GUNS.m416.mag(gg, 1));
    const fn = ITEMB[id] || ITEMB[d.type];
    return cluster('it:' + id, (g) => fn(g, id));
  }
  const POSE = {
    weapon: (o) => { o.rotation.z = Math.PI / 2; },
    vest: (o) => { o.rotation.x = -Math.PI / 2; },
    bag: (o) => { o.rotation.x = -Math.PI / 2; },
    extmag: (o) => { o.rotation.z = Math.PI / 2; },
    comp: (o) => { o.rotation.y = 0.3; },
    frag: (o) => { o.rotation.z = 1.35; },
    smoke: (o) => { o.rotation.z = Math.PI / 2; },
    drink: (o) => { o.rotation.z = Math.PI / 2; },
  };
  const attKey = (att) => att ? [att.scope, att.muzzle, att.mag, att.grip].map((x) => x || '').join(',') : '';
  const _box = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
  function ground(id, att) {
    const d = ITEMS[id], key = 'gr:' + id + ':' + (d.type === 'weapon' ? attKey(att) : '');
    const grp = cluster(key, (g) => {
      const o = buildDisplay(id, att);
      const pose = POSE[id] || POSE[d.type]; if (pose) pose(o);
      g.add(o); o.updateMatrixWorld(true);
      _box.setFromObject(o); _box.getCenter(_c); _box.getSize(_s);
      o.position.set(-_c.x, -_box.min.y + 0.002, -_c.z);
      A(g, PL(Math.max(0.12, _s.x * 1.35), Math.max(0.12, _s.z * 1.35)), CLS.shadow, 0, 0.004, 0, -Math.PI / 2);
    });
    grp.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    return grp;
  }

  // ---------- 아이콘 ----------
  let iconScene = null, iconCam = null, iconRT = null;
  const VIEW = { weapon: [-1, 0.14, -0.05], att: [-1, 0.42, 0.4], ammo: [0.75, 0.9, 1.1], heal: [0.65, 1.0, 1.0], boost: [0.6, 0.35, 1.0], vest: [0.4, 0.22, 1], helmet: [0.85, 0.45, 1], bag: [0.6, 0.3, 1], throw: [0.7, 0.55, 1], bandage: [0.25, 1.4, 0.6], firstaid: [0.5, 0.9, 1] };
  function setupIcon() {
    iconScene = new THREE.Scene();
    iconScene.add(new THREE.HemisphereLight(0xe2ebf3, 0x2a2622, 0.6));
    const key = new THREE.DirectionalLight(0xfff2e2, 1.55); key.position.set(-3, 5, 4); iconScene.add(key);
    const fill = new THREE.DirectionalLight(0xbcd2ff, 0.5); fill.position.set(4, 1, 3); iconScene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.95); rim.position.set(0.5, 3, -5); iconScene.add(rim);
    iconCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
  }
  const _v = new THREE.Vector3(), _col = new THREE.Color();
  function renderIcon(obj, W, H, dir) {
    if (!iconScene) setupIcon();
    const S = 2, rw = W * S, rh = H * S;
    if (!iconRT || iconRT.width !== rw || iconRT.height !== rh) { if (iconRT) iconRT.dispose(); iconRT = new THREE.WebGLRenderTarget(rw, rh); }
    iconScene.add(obj); obj.updateMatrixWorld(true);
    _box.setFromObject(obj); _box.getCenter(_c);
    const dv = new THREE.Vector3().fromArray(dir).normalize();
    iconCam.position.copy(_c).addScaledVector(dv, 10); iconCam.up.set(0, 1, 0); iconCam.lookAt(_c); iconCam.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).applyMatrix4(iconCam.matrixWorldInverse);
      x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
    }
    let w = x1 - x0, h = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, asp = W / H;
    if (w / h > asp) h = w / asp; else w = h * asp;
    w *= 1.08; h *= 1.08;
    iconCam.left = cx - w / 2; iconCam.right = cx + w / 2; iconCam.top = cy + h / 2; iconCam.bottom = cy - h / 2; iconCam.updateProjectionMatrix();
    const prevRT = R.getRenderTarget(), prevA = R.getClearAlpha(); R.getClearColor(_col);
    R.setRenderTarget(iconRT); R.setClearColor(0x000000, 0); R.clear(); R.render(iconScene, iconCam);
    const px = new Uint8Array(rw * rh * 4); R.readRenderTargetPixels(iconRT, 0, 0, rw, rh, px);
    R.setRenderTarget(prevRT); R.setClearColor(_col, prevA);
    iconScene.remove(obj);
    const big = document.createElement('canvas'); big.width = rw; big.height = rh;
    const bg = big.getContext('2d'), img = bg.createImageData(rw, rh);
    for (let y = 0; y < rh; y++) img.data.set(px.subarray((rh - 1 - y) * rw * 4, (rh - y) * rw * 4), y * rw * 4);
    bg.putImageData(img, 0, 0);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high'; og.drawImage(big, 0, 0, W, H);
    return out.toDataURL('image/png');
  }
  function iconKey(id, att) { return ITEMS[id].type === 'weapon' ? 'w:' + id + ':' + attKey(att) : 'i:' + id; }
  function icon(id, att) {
    if (!ITEMS[id]) return '';
    const key = iconKey(id, att);
    if (ICON[key] !== undefined) return ICON[key];
    if (!R) return '';
    try {
      const d = ITEMS[id], wide = d.type === 'weapon';
      ICON[key] = renderIcon(buildDisplay(id, att), wide ? 320 : 160, wide ? 128 : 160, VIEW[id] || VIEW[d.type] || VIEW.ammo);
    } catch (e) { console.warn('아이콘 렌더 실패', id, e); ICON[key] = ''; }
    return ICON[key];
  }
  const queue = [];
  function prewarm() { for (const id in ITEMS) queue.push(id); }
  function pump(budgetMs = 6) {
    if (!queue.length || !R) return;
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < budgetMs) icon(queue.shift());
  }

  // ---------- 손·소매(1인칭), 탄피 ----------
  function hand() { return cluster('hand', (g) => { const gl = M('cloth', 0x2a2925); A(g, RB(0.046, 0.04, 0.088, 0.016), gl); A(g, RB(0.02, 0.018, 0.045, 0.008), gl, 0.022, 0.01, 0.02, 0, -0.5, 0); A(g, RB(0.044, 0.012, 0.03, 0.005), M('cloth', 0x1c1b18), 0, -0.016, -0.03); }); }
  function sleeve(hex) { return cluster('sleeve:' + hex, (g) => { A(g, CY(0.034, 0.042, 1, 12, 'y', true), M('cloth', hex)); A(g, CY(0.03, 0.034, 0.06, 12, 'y'), M('cloth', 0x2a2925), 0, 0.5, 0); }); }
  function casing(kind) {
    return cluster('case:' + kind, (g) => {
      if (kind === 'hull') { A(g, CY(0.0105, 0.0105, 0.05, 10), M('polymer', 0xa82020), 0, 0, 0.008); A(g, CY(0.011, 0.011, 0.016, 10), M('brass', 0xc9a24a), 0, 0, -0.025); }
      else { const r = kind === '9' ? 0.0048 : kind === '762' ? 0.006 : kind === '300' ? 0.0068 : 0.0048, L = kind === '9' ? 0.019 : kind === '762' ? 0.051 : kind === '300' ? 0.067 : 0.045; A(g, CY(r, r, L, 8), M('brass', 0xd0a84e), 0, 0, 0); A(g, CY(r * 0.75, r, L * 0.15, 8), M('brass', 0xd0a84e), 0, 0, L * 0.55); }
    });
  }
  // ---------- 보급상자 ----------
  function crate() {
    return cluster('crate', (g) => {
      const od = M('anod', 0x4a5236), dk = M('anod', 0x2f3424), yl = M('polymer', 0xd8a21e), st = M('gunmetal', 0x3a3d3a), bk = M('polymer', 0x161616);
      A(g, RB(1.2, 0.8, 0.95, 0.04, 0.02), od, 0, 0.4, 0);
      for (const z of [-0.36, 0, 0.36]) A(g, RB(1.23, 0.82, 0.07, 0.02, 0.01), dk, 0, 0.4, z);
      for (const x of [-0.52, 0.52]) A(g, RB(0.07, 0.82, 0.98, 0.02, 0.01), dk, x, 0.4, 0);
      A(g, RB(1.24, 0.06, 0.99, 0.02, 0.01), dk, 0, 0.8, 0);
      // 측면 노란 V자 표시 + 손잡이
      for (const sz of [-1, 1]) {
        for (let i = 0; i < 2; i++) { A(g, BX(0.3, 0.06, 0.006), yl, -0.13 + i * 0.0, 0.44 + i * 0.16, sz * 0.479, 0, 0, 0.55); A(g, BX(0.3, 0.06, 0.006), yl, 0.13, 0.44 + i * 0.16, sz * 0.479, 0, 0, -0.55); }
        A(g, BX(0.2, 0.03, 0.03), st, 0, 0.62, sz * 0.5);
      }
      for (const sx of [-1, 1]) for (const z of [-0.2, 0.2]) A(g, BX(0.03, 0.06, 0.08), st, sx * 0.62, 0.68, z);
      A(g, RB(0.28, 0.012, 0.16, 0.01), bk, 0.3, 0.834, 0.25);
    });
  }
  function canopy() {
    return cluster('canopy', (g) => {
      const n = 12, cols = [0xd65a1e, 0xe9e2cf];
      for (let i = 0; i < n; i++) { const seg = SPH(3.2, 2, 6, 0, Math.PI * 0.38, i / n * TAU, TAU / n); seg.scale(1, 0.55, 1); A(g, seg, M('cloth', cols[i % 2]), 0, 6.2, 0); const inn = flip(seg.clone()); A(g, inn, M('cloth', cols[i % 2]), 0, 6.2, 0); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, x = Math.cos(a) * 2.9, z = Math.sin(a) * 2.9; const L = Math.hypot(x, 5.1, z); const o = A(g, CY(0.008, 0.008, L, 4, 'y'), M('cloth', 0x2a2a26), x / 2, 0.85 + 5.1 / 2, z / 2); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, 5.1, z).normalize()); }
    });
  }
  const scopeInfo = (id) => SC[id] || null;
  const kit = { A, BX, CY, RB, PF, SPH, TOR, PL, rail, trigger, magPts, tube, flip, M, cart };
  return { init, buildGun, ground, display: buildDisplay, icon, iconKey, prewarm, pump, hand, sleeve, casing, scopeInfo, cluster, M, crate, canopy, kit, _render: renderIcon, get env() { return ENV; }, GUNS, CLS };
})();
function buildGunMesh(id, att) { return Models.buildGun(id, att); }
