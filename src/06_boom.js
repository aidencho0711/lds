// ============================================================
// 06_boom.js — 폭발 효과 (v21): 판처파우스트 로켓 · 수류탄 · 차량 폭발
//  · 섬광(흰 빛 · 별 섬광 · 주변을 비추는 빛 · 가까우면 화면이 번쩍) → 불덩이(겹친 불꽃 덩이가 부풀며 노랑 → 주황 → 검붉게 식음)
//    → 충격파(빠르게 퍼지는 빛 껍질 · 바닥 고리) → 흙먼지 고리(바닥을 따라 퍼짐) → 파편(흙·돌 덩이 포물선 · 불티 · 연기 꼬리를 끄는 불붙은 조각)
//    → 검은 연기 기둥(몇 초 동안 솟으며 퍼지고 옅어짐) · 바닥 그을음 자국(오래 남음)과 달아오른 균열 · 잔불
//  · 물 위면 물기둥·물보라·물결 고리 · 공중에서 터지면 바닥 효과 없이
//  · 판처파우스트 스킨(모양만 — 피해는 같음): 핵탄두 = 버섯구름 · SANTA'S DELIVERY = 큰 선물 상자가 솟아 터지며 크리스마스 불꽃놀이
//    · EVENT HORIZON = 큰 블랙홀이 1.5초 동안 빛과 흙을 빨아들이다 무너진 뒤 폭발
//  · 큰 모양은 SkinFx 도구(시간 진행 효과 add · 고리 · 돔 · 바닥 자국 — 05_models_gskinfx.js), 작은 입자는 GunSkin 점 구름(그리기 1번)
//  · 멀수록 덩이·입자 수를 줄인다 (140m · 320m), 900m 넘으면 생략
// ============================================================
const Boom = (() => {
  let K = null;
  const TEX = {}, UP = new THREE.Vector3(0, 1, 0);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3();
  function ctex(key, S, fn) { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = c.height = S; fn(c.getContext('2d'), S); return (TEX[key] = new THREE.CanvasTexture(c)); }
  // 뭉게뭉게한 덩이(연기·먼지·물보라): 흰 덩이 여럿을 겹쳐 가장자리가 울퉁불퉁 · 위가 밝고 아래가 어두움(입체감)
  const puffTex = () => ctex('puff', 128, (g, S) => {
    const R = mulberry32(11);
    for (let i = 0; i < 30; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * S * 0.24, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = S * (0.1 + R() * 0.14), sh = Math.round(255 * (0.62 + 0.38 * (1 - y / S)));
      const gr = g.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r); gr.addColorStop(0, `rgba(${sh},${sh},${sh},0.5)`); gr.addColorStop(0.6, `rgba(${sh},${sh},${sh},0.24)`); gr.addColorStop(1, `rgba(${sh},${sh},${sh},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  // 불꽃 덩이: 밝은 속 + 울퉁불퉁한 가장자리
  const fireTex = () => ctex('fireball', 128, (g, S) => {
    const R = mulberry32(23), base = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    base.addColorStop(0, 'rgba(255,255,255,1)'); base.addColorStop(0.35, 'rgba(255,255,255,0.75)'); base.addColorStop(0.7, 'rgba(255,255,255,0.2)'); base.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 22; i++) { const a = R() * TAU, d = S * (0.15 + R() * 0.2), x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = S * (0.08 + R() * 0.12), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
  // 그을음 자국: 가운데가 진하고 가장자리가 들쭉날쭉 + 바깥으로 뻗는 검은 줄
  const scorchTex = () => ctex('scorch', 256, (g, S) => {
    const R = mulberry32(5), c = S / 2;
    for (let i = 0; i < 40; i++) { const a = R() * TAU, d = Math.sqrt(R()) * S * 0.28, x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, r = S * (0.08 + R() * 0.12), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const a = R() * TAU, r0 = S * (0.08 + R() * 0.1), r1 = S * (0.3 + R() * 0.18), a1 = a + (R() - 0.5) * 0.2; g.lineWidth = 1 + R() * 4; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a1) * r1, c + Math.sin(a1) * r1); g.stroke(); }
    const gr = g.createRadialGradient(c, c, 0, c, c, S * 0.2); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 색 단계 (u 0 → 1)
  const ST = (arr) => arr.map(([u, h]) => [u, new THREE.Color(h)]);
  const FIRE = ST([[0, 0xfff4d6], [0.12, 0xffc35a], [0.3, 0xff7a24], [0.55, 0xb8340e], [0.8, 0x4a2014], [1, 0x261612]]);
  const SMOKE = ST([[0, 0x6a3418], [0.15, 0x2a2522], [0.6, 0x4a4542], [1, 0x77716c]]);
  const NUKE = ST([[0, 0xfff2c0], [0.15, 0xffb040], [0.35, 0xd0581a], [0.55, 0x6a3a24], [0.8, 0x5a4c44], [1, 0x6e6660]]);
  function stops(S, u, out) { for (let i = 1; i < S.length; i++) if (u <= S[i][0]) { const a = S[i - 1], b = S[i]; return out.copy(a[1]).lerp(b[1], (u - a[0]) / (b[0] - a[0])); } return out.copy(S[S.length - 1][1]); }
  const DIRT = [0x3a3026, 0x5a4a38, 0x2a2622, 0x6a5a44], SPARK = [0xffd27a, 0xff9a3a, 0xfff2c0], XM = [0xff3a4a, 0x3aff7a, 0xffd65a, 0xffffff, 0x4aa8ff];
  // 덮어 그리는 덩이(불꽃·연기·먼지 — FX 연기 점과 같은 셰이더) / 더해 그리는 빛(SkinFx 빛 번짐과 같은 셰이더)
  const solid = (map, col, ro) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: col, transparent: true, depthWrite: false })); s.renderOrder = ro; s.visible = false; return s; };
  const glowS = (map, col, ro) => { const s = new THREE.Sprite(K.sprMat(col)); if (map) s.material.map = map; s.renderOrder = ro; return s; };

  // ---------- 섬광 · 빛 ----------
  // 주변을 비추는 빛: 총구 화염용 점광원을 빌려 씀(조명 개수가 그대로라 셰이더를 다시 만들지 않음) — 크게(거리 dist) 비췄다가 깜빡이며 꺼짐
  function lightUp(p, col, i0, dur, dist) {
    if (!G.muzzleLight || !G.camera || p.distanceTo(G.camera.position) > 160) return;
    const P0 = p.clone(), cc = new THREE.Color(col);
    K.add(null, dur, (e, u) => { const L = G.muzzleLight; if (!L) return; if (u >= 1) { L.color.setHex(0xffb060); L.distance = 9; L.intensity = 0; return; } L.position.copy(P0); L.color.copy(cc); L.distance = dist; L.intensity = i0 * (1 - u) * (1 - u) * (0.85 + 0.15 * Math.sin(e.t * 40)); });
  }
  // 가까이에서 터지면 화면이 잠깐 하얗게 (바라보는 쪽일수록 세게)
  let fl = null;
  function screenFlash(c, k, col) {
    if (!G.camera) return;
    const d = c.distanceTo(G.camera.position), R = 34 * k; if (d > R) return;
    _v.copy(c).sub(G.camera.position).normalize(); G.camera.getWorldDirection(_b);
    const a = Math.min(0.55, (1 - d / R) * (0.2 + 0.65 * Math.max(0, _v.dot(_b)))); if (a < 0.04) return;
    if (!fl) { fl = document.createElement('div'); fl.id = 'boomFlash'; fl.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:2;opacity:0;mix-blend-mode:screen'; document.body.appendChild(fl); }
    fl.style.background = `radial-gradient(circle at 50% 45%, ${col || 'rgba(255,238,205,0.95)'} 0%, rgba(255,170,90,0.5) 48%, rgba(255,120,40,0) 82%)`;
    fl.style.transition = 'none'; fl.style.opacity = a.toFixed(2); void fl.offsetWidth; fl.style.transition = 'opacity .55s ease-out'; fl.style.opacity = '0';
  }
  function flash(c, k, col, scr) {
    K.glow(c, col || 0xfff4dc, 12 * k, 0.24); K.glow(c, 0xffb050, 7 * k, 0.5);
    K.card(c, K.tex.star4(), 0xffe6b8, 0.2, (m, u) => { m.scale.setScalar(8 * k * (0.4 + 0.6 * u)); m.material.opacity = (1 - u) * (1 - u); });
    lightUp(_a.set(c.x, c.y + 1.5, c.z), col || 0xffa050, 16 * Math.sqrt(k), 0.8, 26 * k);
    screenFlash(c, k, scr);
  }
  // 불덩이 속 뜨거운 빛 (더하기)
  function core(c, k) {
    for (const [col, sz, dur] of [[0xfff2c8, 8, 0.35], [0xffa040, 11, 0.65]]) { const s = glowS(null, col, 7); s.position.set(c.x, c.y + 0.6 * k, c.z); K.add(s, dur, (e, u) => { s.scale.setScalar(sz * k * (0.5 + 0.5 * Math.sqrt(u))); s.material.opacity = (1 - u) * (1 - u) * 0.9; }); }
  }

  // ---------- 불덩이 · 연기 · 먼지 ----------
  function fireball(c, k, n) {
    for (let i = 0; i < n; i++) {
      const s = solid(fireTex(), 0xffffff, 6), dir = new THREE.Vector3(rnd(-1, 1), rnd(0, 1.4), rnd(-1, 1)).normalize(), sp = rnd(3, 8) * k, life = rnd(0.6, 1.1), s0 = rnd(1.8, 2.8) * k, s1 = rnd(4.6, 6.8) * k, rot = rnd(0, TAU), spin = rnd(-1.2, 1.2), delay = i < 3 ? 0 : rnd(0, 0.06);
      const p0 = c.clone().addScaledVector(dir, rnd(0.2, 0.8) * k);
      K.add(s, life + delay, (e) => {
        const t = e.t - delay; if (t < 0) return; s.visible = true;
        const u = clamp(t / life, 0, 1), ease = 1 - Math.pow(1 - u, 3), d = sp * (1 - Math.exp(-t * 4)) / 4;
        s.position.copy(p0).addScaledVector(dir, d); s.position.y += t * t * 1.8 * k;   // 뜨거워서 위로
        s.scale.setScalar(s0 + (s1 - s0) * ease); s.material.rotation = rot + spin * t;
        stops(FIRE, u, s.material.color); s.material.opacity = (u < 0.06 ? u / 0.06 : 1) * (u > 0.55 ? Math.max(0, 1 - (u - 0.55) / 0.45) : 1);
      });
    }
  }
  // 검은 연기 기둥: 불덩이가 식을 즈음 나타나 솟으며 퍼지고 옅어짐 (처음엔 불빛을 받아 붉음) · 바람에 조금 흘러감
  function smoke(c, k, n, wind) {
    for (let i = 0; i < n; i++) {
      const s = solid(puffTex(), 0x2a2522, 5), delay = rnd(0.05, 0.35), life = rnd(4, 7), up = rnd(1.8, 3.6) * k, out = rnd(0.6, 1.8) * k, a = rnd(0, TAU), s0 = rnd(2.6, 3.8) * k, s1 = rnd(8, 12) * k, rot = rnd(0, TAU), spin = rnd(-0.3, 0.3), dk = rnd(0.75, 1.15);
      const p0 = new THREE.Vector3(c.x + Math.cos(a) * rnd(0, 1) * k, c.y + rnd(0.2, 1.2) * k, c.z + Math.sin(a) * rnd(0, 1) * k);
      K.add(s, life + delay, (e) => {
        const t = e.t - delay; if (t < 0) return; s.visible = true;
        const u = clamp(t / life, 0, 1), ease = 1 - (1 - u) * (1 - u);
        s.position.set(p0.x + Math.cos(a) * out * ease + wind.x * t, p0.y + up * (1 - Math.exp(-t * 0.6)) / 0.6, p0.z + Math.sin(a) * out * ease + wind.z * t);
        s.scale.setScalar(s0 + (s1 - s0) * ease); s.material.rotation = rot + spin * t;
        stops(SMOKE, u, s.material.color).multiplyScalar(dk); s.material.opacity = (u < 0.08 ? u / 0.08 : 1) * Math.pow(1 - u, 1.3) * 0.88;
      });
    }
  }
  // 흙먼지 고리: 바닥을 따라 바깥으로 빠르게 퍼졌다가 멈추며 옅어짐
  function dust(gp, k, n, col = 0x9a8a70) {
    for (let i = 0; i < n; i++) {
      const s = solid(puffTex(), col, 5), a = i / n * TAU + rnd(-0.2, 0.2), sp = rnd(7, 12) * k, life = rnd(1.4, 2.2), s0 = rnd(1, 1.6) * k, s1 = rnd(3.5, 5.5) * k, rot = rnd(0, TAU);
      K.add(s, life, (e) => {
        const t = e.t, u = clamp(t / life, 0, 1), d = sp * (1 - Math.exp(-t * 3.2)) / 3.2; s.visible = true;
        s.position.set(gp.x + Math.cos(a) * d, gp.y + 0.35 * k + t * 0.5, gp.z + Math.sin(a) * d);
        s.scale.setScalar(s0 + (s1 - s0) * Math.sqrt(u)); s.material.rotation = rot + t * 0.2;
        s.material.opacity = (u < 0.05 ? u / 0.05 : 1) * Math.pow(1 - u, 1.4) * 0.7;
      });
    }
  }

  // ---------- 파편 · 불티 · 잔불 ----------
  function debris(c, k, nChunk, nSpark, air) {
    const P = K.pool();
    for (let i = 0; i < nChunk; i++) { _v.set(rnd(-1, 1), air ? rnd(-1, 1) : rnd(0.35, 1.3), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 13) * k); K.E(P, c, _v.x, _v.y, _v.z, DIRT[(Math.random() * 4) | 0], rnd(0.08, 0.16) * k, rnd(1.1, 1.9), { sq: 1, g: -11, drag: 0.4, so: 1 }); }
    for (let i = 0; i < nSpark; i++) { _v.set(rnd(-1, 1), rnd(-0.3, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(8, 22) * k); K.E(P, c, _v.x, _v.y, _v.z, SPARK[(Math.random() * 3) | 0], rnd(0.04, 0.08) * k, rnd(0.35, 1.0), { g: -7, drag: 2.2, so: 0.35 }); }
  }
  // 떠오르는 불씨
  function embers(c, k, n) { const P = K.pool(); for (let i = 0; i < n; i++) { _a.set(c.x + rnd(-1.5, 1.5) * k, c.y + rnd(0, 1.5) * k, c.z + rnd(-1.5, 1.5) * k); K.E(P, _a, rnd(-0.6, 0.6), rnd(0.5, 2.2), rnd(-0.6, 0.6), Math.random() < 0.6 ? 0xff8a2a : 0xffc060, rnd(0.03, 0.06) * k, rnd(1.4, 2.6), { g: 0.4, drag: 0.8, so: 0.5 }); } }
  // 불붙은 조각: 포물선으로 날아가며 연기 꼬리와 불꽃을 남기고, 땅에 닿으면 꺼짐
  function trails(c, k, n) {
    const P = K.pool();
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd(-1, 1), rnd(0.6, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(7, 12) * k), p = c.clone(); let acc = 0, done = false;
      K.add(null, rnd(1.1, 1.7), (e, u, dt) => {
        if (done || !dt) return; v.y -= 9.8 * dt; p.addScaledVector(v, dt);
        if (p.y < groundAt(p.x, p.z, p.y + 1)) { done = true; return; }
        acc += dt; while (acc > 0.05) { acc -= 0.05; K.E(P, p, rnd(-0.2, 0.2), rnd(0.2, 0.6), rnd(-0.2, 0.2), 0x3a3430, rnd(0.18, 0.3) * k, rnd(0.6, 1.1), { grow: 2.2, drag: 1.5, so: 0.9 }); K.E(P, p, 0, 0, 0, Math.random() < 0.5 ? 0xffa040 : 0xffd27a, rnd(0.1, 0.16) * k, 0.12, { grow: -0.5, so: 0.3 }); }
      });
    }
  }
  // 잔불: 둘레 바닥에서 몇 초 일렁이며 연기를 피움
  function fires(gp, k, n) {
    const P = K.pool();
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), r = rnd(0.6, 2.6) * k, x = gp.x + Math.cos(a) * r, z = gp.z + Math.sin(a) * r, y = groundAt(x, z, gp.y + 1) + 0.05, life = rnd(1.6, 3.2), sz = rnd(0.5, 0.9) * k, s = glowS(fireTex(), 0xff9a3a, 7); let acc = 0;
      s.position.set(x, y + sz * 0.45, z);
      K.add(s, life, (e, u, dt) => {
        const f = 0.75 + 0.25 * Math.sin(e.t * 23 + i * 7) * Math.sin(e.t * 13 + i); s.scale.set(sz * f, sz * 1.5 * f, 1); s.material.opacity = (u < 0.1 ? u / 0.1 : 1) * (1 - u) * 0.9;
        acc += dt; if (acc > 0.12) { acc = 0; K.E(P, s.position, rnd(-0.1, 0.1), rnd(0.6, 1.1), rnd(-0.1, 0.1), 0x34302c, rnd(0.25, 0.4) * k, rnd(0.8, 1.4), { grow: 1.8, drag: 0.6, so: 0.9 }); }
      });
    }
  }
  // 바닥 그을음(20초 넘게 남음) + 달아오른 균열(금방 식음)
  function scorch(gp, k) {
    const m = new THREE.Mesh(K.geo().plane, K.addMat(scorchTex(), 0x0e0b08)); m.material.blending = THREE.NormalBlending; m.material.opacity = 0;
    K.lay(m, gp, 0.03); m.rotateY(Math.random() * TAU); m.scale.setScalar(4.6 * k); m.renderOrder = 2;
    K.add(m, 22, (e, u) => { m.material.opacity = Math.min(1, e.t * 6) * (u < 0.7 ? 0.9 : 0.9 * (1 - (u - 0.7) / 0.3)); });
    K.decal(gp, K.tex.lava(), 2.6 * k, 2.4, 0xffd090, 0x5a1000);
  }

  // ---------- 물 위 ----------
  function water(c, k, lod) {
    const P = K.pool(), wy = WATER_Y, wp = { x: c.x, y: wy, z: c.z, n: UP };
    K.ring(wp, 0xffffff, 7 * k, 0.9); K.ring(wp, 0xcfeaf5, 10 * k, 1.3, null, 0.2);
    for (let i = 0; i < (lod > 1 ? 10 : 5); i++) {   // 물기둥: 흰 물보라 덩이가 솟았다가 떨어짐
      const s = solid(puffTex(), 0xe6f2f6, 5), v0 = rnd(6, 12) * k, a = rnd(0, TAU), r = rnd(0, 1.2) * k, life = rnd(1.3, 1.9), s0 = rnd(1.2, 1.8) * k, s1 = rnd(2.6, 3.6) * k, rot = rnd(0, TAU);
      K.add(s, life, (e) => { const t = e.t, u = clamp(t / life, 0, 1); s.visible = true; s.position.set(c.x + Math.cos(a) * (r + t * 0.8 * k), wy + Math.max(0, v0 * t - 4.9 * t * t), c.z + Math.sin(a) * (r + t * 0.8 * k)); s.scale.setScalar(s0 + (s1 - s0) * u); s.material.rotation = rot + t * 0.3; s.material.opacity = (u < 0.05 ? u / 0.05 : 1) * Math.pow(1 - u, 1.2) * 0.85; });
    }
    for (let i = 0; i < (lod > 1 ? 60 : 25); i++) { _v.set(rnd(-1, 1), rnd(1.2, 3), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 13) * k); K.E(P, _a.set(c.x, wy + 0.2, c.z), _v.x, _v.y, _v.z, Math.random() < 0.6 ? 0xf2fbff : 0xa8d4e6, rnd(0.06, 0.12) * k, rnd(0.9, 1.6), { g: -9.8, drag: 0.5, so: 0.85 }); }
    for (let i = 0; i < (lod > 1 ? 5 : 2); i++) {   // 수면 위 물안개
      const s = solid(puffTex(), 0xdfeef2, 5), a = rnd(0, TAU), life = rnd(2.2, 3.2), sp = rnd(1.5, 3) * k;
      K.add(s, life, (e) => { const t = e.t, u = clamp(t / life, 0, 1), d = sp * (1 - Math.exp(-t * 1.2)); s.visible = true; s.position.set(c.x + Math.cos(a) * d, wy + 0.6 * k + t * 0.25, c.z + Math.sin(a) * d); s.scale.setScalar((2.4 + 3 * Math.sqrt(u)) * k); s.material.opacity = (u < 0.1 ? u / 0.1 : 1) * Math.pow(1 - u, 1.5) * 0.55; });
    }
  }

  // ---------- 판처파우스트 스킨 ----------
  // 핵탄두: 버섯구름 — 하얀·초록 섬광과 큰 충격파 → 불기둥이 빠르게 솟고(위부터 식어 갈색 연기) 꼭대기에서 둘레가 말려 도는 버섯 머리(약 18m)
  //  · 머리 속 불빛과 초록 방사능 빛 · 기둥 중간에 수평으로 퍼지는 흰 응결 고리 · 바닥을 따라 크게 퍼지는 먼지 치마 · 빛나는 방사능 표지 · 떠오르는 초록 가루 · 7초 남짓
  function nuke(c, gp, k, lod) {
    const P = K.pool(), H = 18 * k, cx = gp.x, cz = gp.z, gy = gp.y, h = (t) => H * (1 - Math.exp(-t * 1.1));
    K.glow(c, 0xf2ffe0, 26 * k, 0.45); K.glow(c, 0x9dff4a, 15 * k, 1.0);
    K.ring(gp, 0xffffff, 20 * k, 1.0); K.ring(gp, 0x9dff4a, 13 * k, 0.9, null, 0.08); K.ring(gp, 0xfff0c0, 28 * k, 1.5, null, 0.22);
    K.spinDecal(gp, K.tex.trefoil(), 7 * k, 6, 0x8dff3a, 0.3, 0.15);
    lightUp(c, 0xc8ff90, 26 * k, 1.8, 38 * k);
    // 기둥: 아래는 굵은 흙먼지, 위로 갈수록 가늘게 · 꼭대기를 따라 솟음
    const NS = lod > 1 ? 15 : 7;
    for (let i = 0; i < NS; i++) {
      const f = (i + 0.5) / NS, s = solid(puffTex(), 0xffffff, 5), rot = rnd(0, TAU), life = 6.2 + rnd(0, 0.8), w = (4.6 - f * 2.0) * k, ph = rnd(0, TAU);
      K.add(s, life, (e) => { const t = e.t, u = t / life; s.visible = true; s.position.set(cx + Math.sin(t * 1.3 + ph) * 0.15 * k, gy + h(t) * f * 0.97, cz + Math.cos(t * 1.1 + ph) * 0.15 * k); s.scale.setScalar(w * (0.6 + 0.4 * Math.min(1, t * 2)) * (1 + u * 0.35)); s.material.rotation = rot + t * 0.4; stops(NUKE, clamp(t / 2.6 + f * 0.25 - (f < 0.2 ? 0.3 : 0), 0, 1), s.material.color); s.material.opacity = Math.min(1, t * 5) * (u > 0.62 ? Math.max(0, 1 - (u - 0.62) / 0.38) : 1) * 0.93; });
    }
    // 버섯 머리: 둘레 두 겹이 말려 돌고(바깥은 아래로 처짐) · 가운데 위로 부푼 덩이
    const NC = lod > 1 ? 24 : 12;
    for (let i = 0; i < NC; i++) {
      const top = i >= NC - 6, outer = !top && i % 2 === 0, a0 = i / NC * TAU, s = solid(puffTex(), 0xffffff, 5), rot = rnd(0, TAU), life = 6.6 + rnd(0, 0.8), roll = rnd(0, TAU);
      K.add(s, life, (e) => {
        const t = e.t, u = t / life, gr = 1 - Math.exp(-t * 1.4), R = (top ? 1.6 : outer ? 6.4 : 4.2) * k * (0.3 + 0.7 * gr), a = a0 + t * 0.22, rl = roll + t * 1.3;
        const rr = R + (top ? 0 : Math.cos(rl) * 1.0 * k), yy = h(t) + (top ? 2.0 * k : outer ? -0.8 * k * gr + Math.sin(rl) * 0.8 * k : 0.5 * k + Math.sin(rl) * 1.0 * k);
        s.visible = true; s.position.set(cx + Math.cos(a) * rr, gy + yy, cz + Math.sin(a) * rr);
        s.scale.setScalar((top ? 5.8 : outer ? 4.6 : 5.2) * k * (0.4 + 0.6 * Math.min(1, t * 1.4)) * (1 + u * 0.3)); s.material.rotation = rot + t * 0.3;
        stops(NUKE, clamp(t / 2.6 + (top ? 0.04 : outer ? 0.14 : 0.08), 0, 1), s.material.color); s.material.opacity = Math.min(1, t * 4) * (u > 0.62 ? Math.max(0, 1 - (u - 0.62) / 0.38) : 1) * 0.95;
      });
    }
    for (const [col, sz, dur] of [[0xffd070, 9, 2.0], [0xff8a30, 12, 2.8], [0x9dff4a, 12, 3.4]]) { const s = glowS(null, col, 7); K.add(s, dur, (e, u) => { s.position.set(cx, gy + h(e.t) + 0.6 * k, cz); s.scale.setScalar(sz * k * (0.6 + 0.4 * Math.min(1, e.t * 2))); s.material.opacity = (1 - u) * 0.8; }); }
    K.halo3(new THREE.Vector3(cx, gy, cz), 0xffffff, H * 0.42, H * 0.5, 2.5 * k, 12 * k, 1.9, 0.3);
    K.halo3(new THREE.Vector3(cx, gy, cz), 0xe8fff0, H * 0.62, H * 0.68, 2 * k, 9 * k, 1.6, 0.55);
    K.add(null, 4.2, () => { if (Math.random() < 0.75) { const a = rnd(0, TAU), r = rnd(0.5, 7) * k; K.E(P, _a.set(cx + Math.cos(a) * r, gy + rnd(0.2, 2.5) * k, cz + Math.sin(a) * r), rnd(-0.2, 0.2), rnd(0.8, 2.4), rnd(-0.2, 0.2), Math.random() < 0.7 ? 0x9dff4a : 0xfff27a, rnd(0.06, 0.12) * k, rnd(1.4, 2.6), { sq: Math.random() < 0.5, drag: 0.6, so: 0.6 }); } });
    dust(gp, k * 1.9, lod > 1 ? 22 : 10, 0x6e6258);
  }
  // SANTA'S DELIVERY: 크리스마스 불꽃놀이 — 폭발 위 공중에서 금빛 별 섬광과 함께 다섯 색 국화가 터지고 → 금빛 버들 불꽃이 꼬리를 끌며 천천히 떨어짐
  //  · 색종이가 흩날리고 바닥에 화환이 돎
  function xmas(c, gp, k, lod) {
    const P = K.pool(), top = c.clone(); top.y += 3.5 * k;
    K.delayed(0.12, () => {
      K.glow(top, 0xfff0d0, 9 * k, 0.4);
      K.card(top, K.tex.star5(), 0xffe6a0, 0.9, (m, u) => { m.scale.setScalar(5 * k * (0.3 + 0.7 * Math.sqrt(u))); m.rotateZ(u * 1.4); m.material.opacity = (1 - u) * (1 - u); });
      for (let i = 0, n = lod > 1 ? 110 : 50; i < n; i++) { _v.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(9, 13) * k); K.E(P, top, _v.x, _v.y, _v.z, XM[i % 5], rnd(0.3, 0.42) * k, rnd(1.3, 2.0), { g: -2.5, drag: 1.7, so: 0.8 }); }   // 덮어 그려 낮 하늘에서도 색이 또렷하게
      lightUp(top, 0xffd0a0, 14 * k, 1.0, 30 * k);
    });
    K.delayed(0.45, () => {
      const top2 = top.clone(); top2.y += 0.8 * k;
      for (let i = 0; i < (lod > 1 ? 14 : 7); i++) {
        const v = new THREE.Vector3(rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 8) * k), p = top2.clone(); let acc = 0;
        K.add(null, rnd(1.8, 2.4), (e, u, dt) => { if (!dt) return; v.multiplyScalar(Math.max(0, 1 - 1.5 * dt)); v.y -= 2.2 * dt; p.addScaledVector(v, dt); acc += dt; while (acc > 0.04) { acc -= 0.04; K.E(P, p, rnd(-0.1, 0.1), rnd(-0.4, -0.1), rnd(-0.1, 0.1), Math.random() < 0.7 ? 0xffd65a : 0xffffff, rnd(0.14, 0.2) * k, rnd(0.5, 0.9), { g: -1.5, drag: 1, so: 0.7 }); } });
      }
    });
    for (let i = 0; i < (lod > 1 ? 60 : 30); i++) { _v.set(rnd(-1, 1), rnd(0.5, 1.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(4, 9) * k); K.E(P, c, _v.x, _v.y, _v.z, XM[i % 5], rnd(0.14, 0.22) * k, rnd(2, 3), { sq: 1, g: -1.8, drag: 2.2, so: 0.9 }); }
    K.ring(gp, 0xff3a4a, 7 * k, 0.7); K.ring(gp, 0x3aff7a, 9.5 * k, 0.9, null, 0.12);
    if (typeof GunDeco !== 'undefined' && GunDeco.wreathTex) K.spinDecal(gp, GunDeco.wreathTex(), 5 * k, 3.4, 0xffffff, 0.45, 0.12);
  }
  // EVENT HORIZON: 큰 블랙홀 — 1.5초 동안 터진 자리에 지름 6m 남짓한 검은 구가 생겨 빛을 삼킨다
  //  · 가장자리의 빛나는 광자 고리 · 바깥의 옅은 보라 렌즈 테(천천히 돎) · 기울어진 큰 강착 원반 두 겹(지름 20m · 13m)이 빠르게 돎
  //  · 둘레의 빛 가루가 소용돌이치며 빨려 들고 · 바닥 흙먼지와 돌 조각이 끌려 올라감 · 바닥에 안으로 감기는 소용돌이 · 가까우면 화면 가장자리가 어두워짐
  //  → 무너지는 순간 보랏빛 큰 섬광 · 위아래로 뻗는 제트 · 보라 충격파 → 이어서 보통 폭발(rest)
  const HZ_T = 1.5;
  // 테가 또렷한 검은 원 (블랙홀) — 덮어 그리기
  const discTex = () => ctex('disc', 128, (g, S) => { const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.8, 'rgba(255,255,255,1)'); r.addColorStop(0.9, 'rgba(255,255,255,0.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, S, S); });
  // 가까이에서 블랙홀이 생기면 화면 가장자리가 어둡게 빨려 드는 듯 (dur 초 뒤 풀림)
  let tint = null;
  function screenTint(c, k, dur) {
    if (!G.camera) return; const d = c.distanceTo(G.camera.position), R = 55 * k; if (d > R) return;
    if (!tint) { tint = document.createElement('div'); tint.id = 'boomTint'; tint.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(circle at 50% 45%, rgba(20,0,40,0) 38%, rgba(26,6,48,0.85) 100%)'; document.body.appendChild(tint); }
    tint.style.transition = 'opacity .35s ease-in'; tint.style.opacity = (0.75 * (1 - d / R) + 0.15).toFixed(2);
    clearTimeout(tint._t); tint._t = setTimeout(() => { tint.style.transition = 'opacity .5s ease-out'; tint.style.opacity = '0'; }, dur * 1000);
  }
  function horizon(c0h, gp, k, lod, rest) {
    // 블랙홀은 땅에 묻히지 않게 터진 자리 위로 띄운다 (지름 7m 남짓)
    const c = new THREE.Vector3(c0h.x, Math.max(c0h.y, gp.y + 4.6 * k), c0h.z);
    const P = K.pool(), T = HZ_T, sh = (t) => (t < T - 0.12 ? Math.min(1, t / 0.25) : Math.max(0, (T - t) / 0.12));
    K.glow(c, 0xe0d0ff, 7 * k, 0.3); lightUp(c, 0x9a70ff, 9 * k, T, 26 * k); screenTint(c, k, T);
    // 기울어진 강착 원반 두 겹 (검은 구 뒤에 그림) — 바깥 원반은 덮어 그려 밝은 낮 하늘에서도 주황이 또렷하게
    const tilt = rnd(0.85, 1.0), yaw = rnd(0, TAU);   // 비스듬히 누운 원반 — 땅 높이에서 봐도 타원으로 보이게
    for (const [col, S, sp, dt, nb] of [[0xff8a2a, 22, 9, 0, true], [0xffe8c0, 15, -14, 0.06, false]]) {
      const grp = new THREE.Group(), disk = new THREE.Mesh(K.geo().plane, K.addMat(K.tex.disk(), col)); if (nb) disk.material.blending = THREE.NormalBlending; disk.renderOrder = 8; grp.add(disk); grp.position.copy(c); grp.rotation.set(tilt + dt, yaw, 0.12);
      K.add(grp, T, (e) => { const s = sh(e.t); disk.rotation.y = e.t * sp; disk.scale.setScalar(Math.max(0.01, S * k * (0.25 + 0.75 * s))); disk.material.opacity = s * (nb ? 0.9 : 0.85 + 0.15 * Math.sin(e.t * 13)); });
    }
    // 검은 구 · 그 뒤의 어두운 그늘 · 광자 고리 · 렌즈 테
    const shade = glowS(null, 0x000000, 9); shade.material.blending = THREE.NormalBlending; shade.position.copy(c);
    K.add(shade, T, (e) => { const s = sh(e.t); shade.scale.setScalar(15 * k * s + 0.01); shade.material.opacity = 0.75 * s; });
    const core = glowS(discTex(), 0x000000, 9); core.material.blending = THREE.NormalBlending; core.position.copy(c);
    K.add(core, T, (e) => { const s = sh(e.t), p = 1 + 0.025 * Math.sin(e.t * 11); core.scale.setScalar(8.4 * k * s * p + 0.01); core.material.opacity = Math.min(1, s * 1.4); });
    const ringS = glowS(K.tex.ring(), 0xffd8a8, 10); ringS.position.copy(c);
    K.add(ringS, T, (e) => { const s = sh(e.t); ringS.scale.setScalar(11.2 * k * s + 0.01); ringS.material.opacity = s * (0.8 + 0.2 * Math.sin(e.t * 23)); });
    const lens = glowS(K.tex.ring(), 0x8a6cff, 10); lens.position.copy(c);
    K.add(lens, T, (e) => { const s = sh(e.t); lens.scale.setScalar(19 * k * s + 0.01); lens.material.rotation = e.t * 0.8; lens.material.opacity = 0.4 * s; });
    // 빨려 드는 빛 가루 · 끌려 올라가는 흙과 돌
    K.add(null, T - 0.1, (e, u, dt) => {
      if (!dt) return; const n = Math.max(1, Math.round(dt * (lod > 1 ? 90 : 35)));
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), R = rnd(6, 12) * k, y = rnd(-1.2, 1.2) * k, life = rnd(0.35, 0.7); _a.set(c.x + Math.cos(a) * R, c.y + y, c.z + Math.sin(a) * R);
        K.E(P, _a, (-Math.cos(a) - Math.sin(a) * 0.6) * R / life, -y / life, (-Math.sin(a) + Math.cos(a) * 0.6) * R / life, Math.random() < 0.3 ? 0xffffff : Math.random() < 0.55 ? 0xffa34a : 0xb58cff, rnd(0.13, 0.2) * k, life, { so: 0.45 });
      }
      if (lod > 1 && Math.random() < dt * 30) { const a = rnd(0, TAU), R = rnd(3, 9) * k, gx = c.x + Math.cos(a) * R, gz = c.z + Math.sin(a) * R, gy0 = groundAt(gx, gz, c.y + 2) + 0.1, life = rnd(0.5, 0.9); K.E(P, _a.set(gx, gy0, gz), (c.x - gx) / life, (c.y - gy0) / life, (c.z - gz) / life, DIRT[(Math.random() * 4) | 0], rnd(0.1, 0.18) * k, life, { sq: 1, so: 1 }); }
    });
    if (gp.y > c.y - 6 * k) {   // 바닥이 가까우면: 흙먼지가 안으로 끌려 들고 바닥 소용돌이
      K.spinDecal(gp, K.tex.swirl(), 13 * k, T + 0.3, 0xb58cff, -3.2, -0.35);
      for (let i = 0, n = lod > 1 ? 12 : 6; i < n; i++) {
        const s = solid(puffTex(), 0x6a5a6a, 5), a = i / n * TAU + rnd(-0.2, 0.2), R0 = rnd(8, 12) * k, life = T, rot = rnd(0, TAU);
        K.add(s, life, (e) => { const t = e.t, u = clamp(t / life, 0, 1), R = R0 * (1 - u * 0.85), an = a + u * 2.2; s.visible = true; s.position.set(gp.x + Math.cos(an) * R, gp.y + 0.5 * k + u * (c.y - gp.y) * 0.6, gp.z + Math.sin(an) * R); s.scale.setScalar((3 - u * 1.6) * k); s.material.rotation = rot - t * 2; s.material.opacity = Math.min(1, t * 4) * (1 - u) * 0.6; });
      }
    }
    K.delayed(T, () => {
      K.glow(c, 0xffffff, 24 * k, 0.4); K.glow(c, 0xc8a8ff, 16 * k, 0.8);
      K.ring(gp, 0xb58cff, 16 * k, 0.9); K.ring(gp, 0xffa34a, 10 * k, 0.7, null, 0.06); K.ring(gp, 0xffffff, 22 * k, 1.1, null, 0.18);
      K.beam(c, new THREE.Vector3(c.x, c.y + 34 * k, c.z), 0xffffff, 1.1 * k, 0.8); K.beam(c, new THREE.Vector3(c.x, c.y + 28 * k, c.z), 0xb58cff, 3 * k, 0.95);
      K.beam(c, new THREE.Vector3(c.x, Math.min(gp.y, c.y - 8 * k), c.z), 0xffffff, 0.9 * k, 0.5);
      K.spinDecal(gp, K.tex.swirl(), 8 * k, 3.6, 0xd8c0ff, -2.2, -0.2);
      for (let i = 0; i < (lod > 1 ? 80 : 30); i++) { _v.set(rnd(-1, 1), rnd(-0.25, 0.25), rnd(-1, 1)).normalize().multiplyScalar(rnd(10, 22) * k); K.E(P, c, _v.x, _v.y, _v.z, Math.random() < 0.3 ? 0xffffff : Math.random() < 0.5 ? 0xb58cff : 0xffa34a, rnd(0.14, 0.22) * k, rnd(0.4, 0.8), { drag: 2.5, so: 0.45 }); }   // 원반이 터져 납작하게 퍼지는 빛
      rest(c);   // 블랙홀이 무너진 자리에서 폭발
    });
  }
  // SANTA'S DELIVERY: 큰 선물 상자 모델 — 빨간 포장 상자(흰 물방울무늬) + 네 면을 감은 금 리본 / 뚜껑 + 금 리본 + 큰 금빛 나비 리본
  //  총기와 같은 재질 3종(Models.cluster)을 같이 써서 셰이더를 새로 만들지 않는다 → 지울 때 재질을 버리지 않음
  const giftBody = () => Models.cluster('boom:giftbody', (g) => {
    const { A, BX, CY, M } = Models.kit, red = M('polymer', 0xc4121c), gold = M('metal', 0xe6bc4c), wt = M('paper', 0xf6f1e6);
    A(g, BX(2.4, 2.0, 2.4), red, 0, 1.0, 0);
    A(g, BX(0.4, 2.02, 2.42), gold, 0, 1.0, 0); A(g, BX(2.42, 2.02, 0.4), gold, 0, 1.0, 0);
    for (const [u, y, r] of [[-0.72, 0.5, 0.13], [0.72, 1.45, 0.13], [-0.72, 1.45, 0.13], [0.72, 0.5, 0.13], [-0.9, 1.0, 0.08], [0.9, 1.0, 0.08]]) {
      A(g, CY(r, r, 0.01, 14, 'z'), wt, u, y, 1.205); A(g, CY(r, r, 0.01, 14, 'z'), wt, -u, y, -1.205); A(g, CY(r, r, 0.01, 14, 'x'), wt, 1.205, y, u); A(g, CY(r, r, 0.01, 14, 'x'), wt, -1.205, y, -u);
    }
  });
  const giftLid = () => Models.cluster('boom:giftlid', (g) => {
    const { A, BX, SPH, TOR, M } = Models.kit, red = M('polymer', 0xa80e18), gold = M('metal', 0xe6bc4c);
    A(g, BX(2.6, 0.42, 2.6), red, 0, 0.21, 0);
    A(g, BX(0.42, 0.44, 2.62), gold, 0, 0.21, 0); A(g, BX(2.62, 0.44, 0.42), gold, 0, 0.21, 0);
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {   // 나비 고리 넷: 가운데 매듭에서 바깥·위로 비스듬히
      const e = 0.62, R = 0.44, o = A(g, TOR(R, 0.12, 8, 22), gold, Math.cos(e) * R * Math.cos(ry), 0.52 + Math.sin(e) * R, -Math.cos(e) * R * Math.sin(ry));
      o.rotation.order = 'YXZ'; o.rotation.set(0, ry, e); o.scale.set(1, 0.6, 0.7);
    }
    for (const ry of [Math.PI / 4, -Math.PI * 3 / 4]) A(g, BX(0.3, 0.05, 1.0), gold, Math.sin(ry) * 0.58, 0.45, Math.cos(ry) * 0.58, 0, ry, 0);   // 리본 꼬리
    A(g, SPH(0.22, 14, 10), gold, 0, 0.56, 0);
  });
  const backOut = (u) => { const a = 1.9, v = u - 1; return 1 + (a + 1) * v * v * v + a * v * v; };
  // SANTA'S DELIVERY: 터진 자리 바닥에서 큰 선물 상자가 통통 튀며 솟아나(약 3.5m) 부르르 떨다가 → 0.9초에 뚜껑이 하늘로 날아가며 펑!
  //  상자 속에서 진짜 폭발 + 크리스마스 불꽃놀이 · 상자 입구에서 색종이가 솟구침 · 상자는 옆으로 퍼지며 쭈그러들어 사라지고 뚜껑은 떨어져 튄 뒤 사라짐
  const GIFT_T = 0.9;
  function gift(c, gp, k, lod, air, rest) {
    const P = K.pool(), grp = new THREE.Group(), body = giftBody(), lid = giftLid(), S = 1.5 * k, base = new THREE.Vector3(gp.x, air ? c.y - 1.2 * S : gp.y, gp.z);
    grp.add(body); lid.position.y = 2.0; grp.add(lid); grp.position.copy(base); grp.rotation.y = rnd(0, TAU); grp.scale.setScalar(0.001); G.scene.add(grp);
    K.glow(_a.set(base.x, base.y + 1.2 * k, base.z), 0xfff0d0, 9 * k, 0.32); K.ring(gp, 0xffd65a, 7 * k, 0.5); if (!air) dust(gp, k * 0.7, lod > 1 ? 8 : 4);
    lightUp(_a.set(base.x, base.y + 1.5 * k, base.z), 0xffc890, 10 * k, 0.6, 22 * k);
    for (let i = 0; i < (lod > 1 ? 30 : 12); i++) { _v.set(rnd(-1, 1), rnd(0.3, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 7) * k); K.E(P, _a.set(base.x, base.y + 0.5 * k, base.z), _v.x, _v.y, _v.z, XM[i % 5], rnd(0.06, 0.1) * k, rnd(0.5, 0.9), { sq: 1, g: -6, drag: 1.5, so: 0.6 }); }
    let burst = false; const lv = new THREE.Vector3(), lw = new THREE.Vector3();
    K.add(null, GIFT_T + 2.3, (e, u, dt) => {
      const t = e.t;
      if (t < GIFT_T) {
        const pu = Math.min(1, t / 0.32), s = pu < 1 ? Math.max(0.001, backOut(pu)) : 1, w = clamp((t - 0.3) / (GIFT_T - 0.3), 0, 1);
        grp.scale.set(S * s, S * s * (1 + 0.07 * Math.sin(t * 34) * w), S * s); grp.rotation.x = Math.sin(t * 27) * 0.07 * w; grp.rotation.z = Math.cos(t * 23) * 0.07 * w;
        grp.position.set(base.x, base.y - 0.3 * k * (1 - pu) + Math.abs(Math.sin(t * 17)) * 0.1 * k * w, base.z);
        if (dt && w > 0 && Math.random() < dt * 40) { const a = rnd(0, TAU); K.E(P, _a.set(base.x + Math.cos(a) * 1.3 * S, base.y + rnd(0.2, 2.2) * S, base.z + Math.sin(a) * 1.3 * S), Math.cos(a) * 0.6, rnd(0.2, 0.8), Math.sin(a) * 0.6, Math.random() < 0.5 ? 0xffd65a : 0xffffff, rnd(0.05, 0.08) * k, 0.5, { so: 0.4 }); }   // 리본에서 반짝이
        return;
      }
      if (!burst) {
        burst = true; G.scene.attach(lid); lv.set(rnd(-2.5, 2.5) * k, rnd(10, 13) * k, rnd(-2.5, 2.5) * k); lw.set(rnd(-6, 6), rnd(-4, 4), rnd(-6, 6));
        rest(new THREE.Vector3(base.x, base.y + 1.6 * S, base.z));   // 상자 속에서 진짜 폭발 + 불꽃놀이
        _b.set(base.x, base.y + 2.2 * S, base.z);
        for (let i = 0; i < (lod > 1 ? 80 : 30); i++) { _v.set(rnd(-0.6, 0.6), rnd(1, 2), rnd(-0.6, 0.6)).normalize().multiplyScalar(rnd(6, 14) * k); K.E(P, _b, _v.x, _v.y, _v.z, XM[i % 5], rnd(0.16, 0.26) * k, rnd(1.6, 2.8), { sq: 1, g: -3, drag: 1.4, so: 0.9 }); }   // 상자 입구에서 색종이
      }
      if (!dt) return;
      const tb = t - GIFT_T, sq = Math.max(0, 1 - tb / 0.35), sw = 1 + (1 - sq) * 0.3;
      grp.scale.set(S * sw * sq + 0.001, S * sq * sq + 0.001, S * sw * sq + 0.001); grp.visible = sq > 0;
      lv.y -= 9.8 * dt; lid.position.addScaledVector(lv, dt); lid.rotation.x += lw.x * dt; lid.rotation.y += lw.y * dt; lid.rotation.z += lw.z * dt;
      const gl = groundAt(lid.position.x, lid.position.z, lid.position.y + 2) + 0.3; if (lid.position.y < gl && lv.y < 0) { lid.position.y = gl; lv.multiplyScalar(0.35); lv.y = Math.abs(lv.y) * 0.6; lw.multiplyScalar(0.5); }
      lid.scale.setScalar(S * (tb < 1.8 ? 1 : Math.max(0.001, 1 - (tb - 1.8) / 0.45)));
      if (u >= 1) { G.scene.remove(grp); G.scene.remove(lid); }
    });
  }

  // ---------- 폭발 ----------
  //  o: { k 크기(로켓 1 · 수류탄 0.62 · 차량 1.15), style 'nuke'|'xsanta'|'horizon'(판처파우스트 스킨), car(차량 — 불붙은 조각·잔불이 더 많이) }
  //  스킨 폭발 중 블랙홀(1.5초)·선물 상자(0.9초)는 그 뒤에 진짜 폭발이 이어진다 — 모양만, 피해는 맞은 순간 그대로
  function blast(x, y, z, o = {}) {
    if (!G.scene || !G.camera || typeof SkinFx === 'undefined' || !SkinFx.kit) return false;
    K = SkinFx.kit;
    const k = o.k || 1, c0 = new THREE.Vector3(x, y, z), d = c0.distanceTo(G.camera.position); if (d > 900) return true;
    const lod = d > 320 ? 0 : d > 140 ? 1 : 2, gh = groundAt(x, z, y + 1), wet = y < WATER_Y + 0.8 && heightAt(x, z) < WATER_Y - 0.2, air = !wet && y - gh > 3.2 * k;
    const gp = wet ? { x, y: WATER_Y, z, n: UP } : K.ground(x, Math.min(y, gh + 0.5), z), st = o.style;
    const wa = rnd(0, TAU), wind = { x: Math.cos(wa) * 0.35, z: Math.sin(wa) * 0.35 };
    const main = (cc) => {
      const c = cc || c0;
      flash(c, k, st === 'nuke' ? 0xf2ffe0 : st === 'horizon' ? 0xf0e6ff : 0, st === 'nuke' ? 'rgba(235,255,215,0.95)' : st === 'horizon' ? 'rgba(235,220,255,0.95)' : null);
      if (wet) { water(c, k, lod); fireball(c, k * 0.55, lod > 1 ? 4 : 2); core(c, k * 0.6); if (lod) debris(c, k, 0, lod > 1 ? 20 : 8, true); }
      else {
        fireball(c, k * (st === 'nuke' ? 1.3 : 1), lod > 1 ? 9 : lod ? 6 : 3); core(c, k);
        if (st !== 'nuke') smoke(c, k, lod > 1 ? 12 : lod ? 7 : 4, wind);
        if (!air && lod) { dust(gp, k, lod > 1 ? 10 : 6); scorch(gp, k * (st === 'nuke' ? 1.4 : 1)); K.ring(gp, 0xfff0d8, 10 * k, 0.5); }
        if (lod) debris(c, k, lod > 1 ? 28 : 12, lod > 1 ? 36 : 16, air);
        if (lod > 1) { embers(c, k, 18); trails(c, k, o.car ? 6 : 4); if (!air) fires(gp, k, o.car ? 6 : 4); }
      }
      if (st === 'nuke' && !wet) nuke(c, gp, k, lod); else if (st === 'xsanta') xmas(c, gp, k, lod);
    };
    if (st === 'horizon') horizon(c0, gp, k, lod, main);
    else if (st === 'xsanta') gift(c0, gp, k, lod, air, main);
    else main();
    return true;
  }
  return { blast, HZ_T, GIFT_T };
})();
