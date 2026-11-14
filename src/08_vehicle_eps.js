// ============================================================
// 08_vehicle_eps.js — 엡실론 차량 연출 (IMPERIAL X-01): 시동 · 주행 · 정차 · 절전 (보이는 것과 소리만, 성능·충돌·좌석은 기본 SUV 그대로)
//  · 모델(05_models_vskin.js buildImperial)이 빛나는 부분을 차량마다 따로 준다(parts.fx): 헤드램프 칸 hl0~hl4 · 엠블럼 emb · 테일 띠 tail · 브레이크 brake · 실내 앰비언트 amb
//    여기서 더 붙이는 것: 계기판·가운데 화면(캔버스 — 차량 이름·일련번호·속도) · 바닥 조명 · 헤드램프 빛줄기
//  · 시동(운전석에 누가 앉는 순간): 헤드램프가 안쪽부터 한 칸씩 켜짐 → 그릴·후드·뒤 엠블럼이 빛남 → 실내 조명·계기판이 켜짐 · 전용 시동음
//  · 주행: 휠 가운데 엠블럼은 바퀴와 함께 돎(모델) · 감속하면 테일 띠가 밝아지고 브레이크 등이 켜짐 · 저녁엔 헤드램프 빛줄기가 또렷
//          빠르게 달리면 차체 옆선을 따라 은은한 빛 잔상
//  · 정차: 헤드램프가 서서히 어두워지고 바닥 조명이 켜짐 · 엠블럼이 일정한 간격으로 점등
//  · 내린 뒤: 실내·헤드램프가 꺼지고 바닥 조명·엠블럼만 → 20초가 지나면 절전(바닥 조명 끔, 엠블럼만 가끔 희미하게)
//  · 다른 기기의 차량도 위치 변화로 속도·감속을 재므로 똑같이 보인다
// ============================================================
const VehFx = (() => {
  const TEX = {};
  const FONT = (w, px) => `${w} ${px}px "Saira Condensed","Arial Narrow",Arial,sans-serif`;
  const ctex = (key, W, H, draw) => { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H); return (TEX[key] = new THREE.CanvasTexture(c)); };
  // 바닥 조명: 가운데가 밝고 가장자리로 사라지는 긴 타원
  const underTex = () => ctex('under', 128, 256, (g, W, H) => { g.save(); g.scale(1, H / W); const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.45, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W); g.restore(); });
  // 헤드램프 빛줄기: 램프 쪽이 밝고 멀어질수록 사라짐
  const beamTex = () => ctex('beam', 8, 128, (g, W, H) => { const r = g.createLinearGradient(0, 0, 0, H); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.25, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); });
  const hash5 = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return String((h >>> 0) % 100000).padStart(5, '0'); };
  const mkL = () => ({ hl: [0, 0, 0, 0, 0], emb: 0, tail: 0, brake: 0, amb: 0, dash: 0, under: 0, beam: 0 });

  // ---------- 화면 그리기 ----------
  function drawCluster(cv, kmh, gear) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1024'); bg.addColorStop(1, '#03050c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(216,180,90,0.7)'; g.lineWidth = 2; g.strokeRect(3, 3, W - 6, H - 6);
    // 왼쪽: 속도 호 · 오른쪽: 출력 호
    const arc = (cx, v, col, label, txt) => {
      g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.arc(cx, H * 0.58, 58, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.arc(cx, H * 0.58, 58, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * clamp(v, 0, 1))); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.font = FONT(800, 38); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, H * 0.56);
      g.fillStyle = 'rgba(255,230,170,0.8)'; g.font = FONT(700, 15); g.fillText(label, cx, H * 0.56 + 30);
    };
    arc(92, kmh / 120, '#d8b45a', 'km/h', String(Math.round(kmh)));
    arc(W - 92, Math.min(1, kmh / 90 + 0.12), '#7fb0ff', 'POWER', gear);
    // 가운데: ε 마름모 + IMPERIAL
    const cx = W / 2, cy = H * 0.46; g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 27, cy); g.lineTo(cx, cy + 34); g.lineTo(cx - 27, cy); g.closePath();
    g.fillStyle = '#141c33'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d8b45a'; g.stroke();
    g.fillStyle = '#ffe9b0'; g.font = FONT(900, 34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ε', cx, cy + 2);
    g.font = FONT(800, 18); g.fillStyle = '#e8ecf4'; g.fillText('IMPERIAL', cx, H - 26);
  }
  function drawCenter(cv, serial) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#141c33'); bg.addColorStop(1, '#05070e'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(216,180,90,0.75)'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    const dx = 84, dy = H / 2; g.beginPath(); g.moveTo(dx, dy - 52); g.lineTo(dx + 42, dy); g.lineTo(dx, dy + 52); g.lineTo(dx - 42, dy); g.closePath();
    const gd = g.createLinearGradient(0, dy - 52, 0, dy + 52); gd.addColorStop(0, '#fff3c4'); gd.addColorStop(0.5, '#d9a93e'); gd.addColorStop(1, '#7a5212'); g.lineWidth = 5; g.strokeStyle = gd; g.stroke();
    g.fillStyle = '#ffe9b0'; g.font = FONT(900, 54); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ε', dx, dy + 3);
    g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = FONT(900, 52); g.fillText('IMPERIAL X-01', 152, H * 0.36);
    g.fillStyle = '#d8b45a'; g.font = FONT(700, 24); g.fillText('EPSILON  ·  EP-V001', 154, H * 0.62);
    g.fillStyle = 'rgba(200,214,255,0.85)'; g.font = FONT(700, 22); g.fillText(serial ? `SERIAL No. ${serial}` : 'SERIAL No. -----', 154, H * 0.82);
  }

  // ---------- 붙이기 (한 대마다 한 번): 화면 · 바닥 조명 · 빛줄기 ----------
  function attach(P) {
    if (!P || !P.fx || !P.efx) return null;
    if (P.efxA) return P.efxA;
    const E = P.efx, A = { screens: [], beams: [] };
    for (const s of E.screens) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * s.h / s.w);
      if (s.id === 'cluster') drawCluster(cv, 0, 'P'); else drawCenter(cv, '');
      const tex = new THREE.CanvasTexture(cv), m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
      m.position.fromArray(s.p); m.rotation.order = 'YXZ'; m.rotation.set(s.rx, Math.PI, 0); m.visible = false; m.userData.fx = true; m.userData.cv = cv; m.userData.id = s.id;
      P.body.add(m); A.screens.push(m); if (s.id === 'cluster') A.cluster = m; else A.center = m;
    }
    const ug = new THREE.PlaneGeometry(E.under.w, E.under.l); ug.rotateX(-Math.PI / 2);
    A.under = new THREE.Mesh(ug, new THREE.MeshBasicMaterial({ map: underTex(), color: 0xffdca0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    A.under.position.y = 0.035; A.under.renderOrder = 2; A.under.visible = false; A.under.userData.fx = true; P.body.add(A.under);
    for (const b of E.beams) {
      const g = new THREE.ConeGeometry(1.25, 8, 18, 1, true); g.translate(0, -4, 0); g.rotateX(-Math.PI / 2 + 0.05);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xfff3dc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.position.fromArray(b); m.visible = false; m.renderOrder = 3; m.userData.fx = true; P.body.add(m); A.beams.push(m);
    }
    for (const m of [...A.screens, A.under, ...A.beams]) P.meshes.push(m);
    return (P.efxA = A);
  }
  // 밝기 L(0~1)을 재질에 반영
  function apply(P, L) {
    const F = P.fx; if (!F) return;
    for (let i = 0; i < 5; i++) { const m = F['hl' + i]; if (m) m.material.color.setScalar(0.1 + 0.9 * L.hl[i]); }
    if (F.emb) F.emb.material.color.setScalar(0.22 + 0.78 * L.emb);
    if (F.tail) F.tail.material.color.setScalar(0.12 + 0.88 * Math.max(L.tail, L.brake));
    if (F.brake) { F.brake.visible = L.brake > 0.02; F.brake.material.color.setScalar(L.brake); }
    if (F.amb) F.amb.material.color.setScalar(0.06 + 0.94 * L.amb);
    const A = P.efxA; if (!A) return;
    for (const s of A.screens) { s.material.opacity = L.dash; s.visible = L.dash > 0.01; }
    A.under.material.opacity = 0.6 * L.under; A.under.visible = L.under > 0.01;
    for (const b of A.beams) { b.material.opacity = 0.13 * L.beam; b.visible = L.beam > 0.01; }
  }
  function setSerial(P, serial) { const A = P.efxA; if (!A || !A.center || A.serial === serial) return; A.serial = serial; drawCenter(A.center.userData.cv, serial); A.center.material.map.needsUpdate = true; }
  const stOf = (P) => P.efxSt || (P.efxSt = { t: 0, drv: null, parkT: 99, stillT: 0, sp: 0, px: null, pz: 0, vx: 0, vz: 0, brake: 0, hl: 0, under: 0, trail: 0, dashT: 0, L: mkL() });
  const pulseOf = (t, per, sharp = 8) => Math.pow(Math.max(0, Math.sin(t * TAU / per)), sharp);

  // ---------- 경기 중 (Veh.update 가 매 프레임) ----------
  function update(v, dt) {
    const P = v.P; if (!P.fx) return;
    attach(P); const st = stOf(P), L = st.L, k = (rate) => Math.min(1, dt * rate);
    if (v.dead) { if (!st.dead) { st.dead = true; Object.assign(L, mkL()); apply(P, L); } return; }
    // 속도·감속: 위치 변화로 (다른 기기가 움직이는 차량도 같게)
    const ddt = Math.max(dt, 1e-3);
    if (st.px === null) { st.px = v.pos.x; st.pz = v.pos.z; }
    const vx = (v.pos.x - st.px) / ddt, vz = (v.pos.z - st.pz) / ddt; st.px = v.pos.x; st.pz = v.pos.z;
    st.vx += (vx - st.vx) * k(10); st.vz += (vz - st.vz) * k(10);
    const sp = Math.hypot(st.vx, st.vz), dec = (st.sp - sp) / ddt; st.sp = sp;
    const drv = v.driver && v.driver.alive ? v.driver : null, moving = sp > 1.2;
    const cam = G.camera, near = !!cam && cam.position.distanceTo(v.pos) < 90;
    // 시동: 운전석에 누가 앉는 순간
    if (drv && !st.drv) {
      st.t = 0; st.hl = 1; st.parkT = 0; st.brake = 0;
      setSerial(P, drv.isPlayer && typeof Eco !== 'undefined' ? Eco.serialOf(v.skin) : hash5((drv.name || '') + '|' + v.skin));
      if (near && typeof Audio !== 'undefined' && Audio.vehStart) Audio.vehStart('imperial', v.pos, !!drv.isPlayer);
    }
    if (!drv && st.drv) st.parkT = 0;
    st.drv = drv; st.t += dt; st.stillT = moving ? 0 : st.stillT + dt;
    if (drv) {
      const t = st.t;
      st.hl += ((moving || st.stillT < 1.2 ? 1 : 0.38) - st.hl) * k(moving ? 6 : 0.7);     // 정차하면 서서히 어두워짐
      for (let i = 0; i < 5; i++) L.hl[i] = Math.min(clamp((t - 0.15 - i * 0.13) / 0.08, 0, 1), st.hl);   // 시동: 안쪽부터 한 칸씩
      const flash = t > 0.72 && t < 1.45 ? Math.sin((t - 0.72) / 0.73 * Math.PI) : 0;
      const pulse = !moving && st.stillT > 1.2 ? pulseOf(st.stillT, 2.6) : 0;
      L.emb = Math.max(t > 0.72 ? 0.45 : 0, flash, pulse);
      L.amb = clamp((t - 0.8) / 0.6, 0, 1); L.dash = clamp((t - 0.95) / 0.35, 0, 1);
      const brk = dec > 2.2 && sp > 0.8 ? 1 : 0; st.brake += (brk - st.brake) * k(brk ? 20 : 5); L.brake = st.brake;
      L.tail = clamp((t - 0.3) / 0.25, 0, 1) * 0.55;
      st.under += ((moving ? 0.12 : st.stillT > 0.8 ? 0.85 : 0.3) - st.under) * k(2); L.under = st.under;
      L.beam = SETTINGS.time === 'dusk' ? st.hl * clamp((t - 0.6) / 0.3, 0, 1) : 0;
      // 계기판 속도 (내 차만, 초당 4번)
      if (drv.isPlayer && P.efxA && P.efxA.cluster && (st.dashT -= dt) <= 0) { st.dashT = 0.25; const kmh = sp * 3.6; drawCluster(P.efxA.cluster.userData.cv, kmh, moving ? 'D' : 'P'); P.efxA.cluster.material.map.needsUpdate = true; }
    } else {
      const pt = st.parkT += dt, save = pt > 20;
      st.hl += (0 - st.hl) * k(1.2); L.hl.fill(st.hl);
      L.dash = Math.max(0, L.dash - dt * 1.5); L.amb = Math.max(0, L.amb - dt * 0.7); L.brake = st.brake = 0;
      L.tail = Math.max(0, 0.55 - pt * 0.35); L.beam = 0;
      st.under += ((save ? 0 : 0.7) - st.under) * k(save ? 1 : 2); L.under = st.under;
      L.emb = Math.max(save ? 0.04 : 0.2, pulseOf(pt, save ? 6 : 2.6) * (save ? 0.45 : 1));
    }
    apply(P, L);
    // 빠른 주행: 차체 옆선을 따라 은은한 빛 잔상
    if (drv && near && sp > v.T.vmax * 0.55 && P.root.visible && typeof GunSkin !== 'undefined' && P.root.parent) {
      const E = P.efx.trail, pool = GunSkin.fx.pool(P.root.parent), r = clamp((sp / v.T.vmax - 0.55) / 0.45, 0, 1);
      st.trail += dt * (22 + 48 * r);
      for (; st.trail >= 1; st.trail--) {
        const s = Math.random() < 0.5 ? 1 : -1, p = new THREE.Vector3(s * E.x, E.y + (Math.random() - 0.5) * 0.5, lerp(E.z0, E.z1, Math.random()));
        P.body.localToWorld(p);
        const c = Math.random() < 0.5 ? 0xffe6b0 : Math.random() < 0.5 ? 0xffffff : 0x9fb4ff;
        GunSkin.fx.emit(pool, p, st.vx * 0.82, 0.05, st.vz * 0.82, c, 0.09 + Math.random() * 0.07, 0.3 + Math.random() * 0.25, { so: 0.55, grow: -0.6, drag: 1.5 });
      }
    }
  }
  // ---------- 진열장 (로비 창고·상점): 시동이 걸린 채 정차한 모습 ----------
  function showroom(P, dt) {
    if (!P || !P.fx) return; attach(P);
    const st = stOf(P), L = st.L; st.t += dt;
    L.hl.fill(1); L.emb = Math.max(0.45, pulseOf(st.t, 2.6)); L.tail = 0.55; L.brake = 0; L.amb = 1; L.dash = 1; L.under = 0.8; L.beam = 0;
    if (!P.efxA.serial) setSerial(P, typeof Eco !== 'undefined' && P.skin ? Eco.serialOf(P.skin) : '');
    apply(P, L);
  }
  return { attach, apply, update, showroom, setSerial, mkL, hash5 };
})();
