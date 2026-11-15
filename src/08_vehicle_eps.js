// ============================================================
// 08_vehicle_eps.js — 엡실론 차량 연출: 시동 · 주행 · 정차 · 절전 (보이는 것과 소리만, 성능·충돌·좌석은 기본 차종 그대로)
//  · 모델(05_models_vskin.js)이 빛나는 부분을 차량마다 따로 준다(parts.fx): hl0~4 헤드램프 칸 · emb 엠블럼 · tail 테일 · brake* 브레이크 · amb 실내
//    차종에 따라 더: line0~5 옆 빛 선 · bar0~5 지붕 LED 바 · amber 마커등 · grille0~4 그릴 빛 · ring 원형 테일
//    움직이는 부품(parts.mov): wing 액티브 리어 윙 · orn 보닛 장식
//    여기서 더 붙이는 것: 계기판·가운데 화면(캔버스 — 차량 이름·번호·일련번호·속도) · 바닥 조명 · 헤드램프 빛줄기 · 문 옆 바닥 엠블럼 조명
//  · 차량마다 연출이 다르다 (SCRIPT[kind]):
//    IMPERIAL X-01 : 헤드램프가 안쪽부터 한 칸씩 → 그릴·후드·뒤 엠블럼 → 실내·계기판 / 정차 때 바닥 조명 / 고속 빛 잔상(금·흰·푸름)
//    AURELION GT   : 부메랑 헤드램프가 바깥에서 안쪽으로 빠르게 → 옆 샴페인 빛 선이 앞에서 뒤로 흐름 / 고속에서 리어 윙이 솟고 브레이크 때 세워짐 / 정차 때 빛 선이 숨 쉬듯
//    TITAN VANGUARD: 지붕 마커등 두 번 깜빡 → 지붕 LED 바가 왼쪽에서 오른쪽으로 훑음 → C자 헤드램프 / 저녁엔 LED 바가 켜진 채 주행 / 정차 때 발판 조명
//    SOVEREIGN     : 문 옆 바닥에 엠블럼 조명 → 보닛 장식이 솟아오름 → 그릴 빛이 아래에서 위로 차오름 → 헤드램프 · 이클립스 원형 등 · 스타라이트 천장
//  · 공통: 감속하면 브레이크 등 · 저녁엔 헤드램프 빛줄기 · 정차하면 헤드램프가 서서히 어두워짐 · 엠블럼이 일정한 간격으로 점등
//          내린 뒤 실내·헤드램프가 꺼지고 20초 뒤 절전(엠블럼만 가끔 희미하게) · 다른 기기의 차량도 위치 변화로 속도·감속을 재서 똑같이 보임
// ============================================================
const VehFx = (() => {
  const TEX = {};
  const FONT = (w, px) => `${w} ${px}px "Saira Condensed","Arial Narrow",Arial,sans-serif`;
  const ctex = (key, W, H, draw) => { if (TEX[key]) return TEX[key]; const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H); return (TEX[key] = new THREE.CanvasTexture(c)); };
  const underTex = () => ctex('under', 128, 256, (g, W, H) => { g.save(); g.scale(1, H / W); const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.45, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W); g.restore(); });
  const beamTex = () => ctex('beam', 8, 128, (g, W, H) => { const r = g.createLinearGradient(0, 0, 0, H); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.25, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); });
  // 문 옆 바닥 조명: 고리 + 마름모 ε + 이름
  const puddleTex = (name) => ctex('pud|' + name, 256, 256, (g) => {
    g.translate(128, 128); const r = g.createRadialGradient(0, 0, 0, 0, 0, 124); r.addColorStop(0, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-128, -128, 256, 256);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(0, -60); g.lineTo(44, 0); g.lineTo(0, 60); g.lineTo(-44, 0); g.closePath(); g.stroke();
    g.font = FONT(900, 58); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ε', 0, 4);
    g.font = FONT(800, 17); const s = name + '  ·  EPSILON  ·  '; for (let i = 0; i < s.length; i++) { g.save(); g.rotate(i / s.length * TAU); g.translate(0, -84); g.fillText(s[i], 0, 0); g.restore(); }
  });
  const hash5 = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return String((h >>> 0) % 100000).padStart(5, '0'); };
  const mkL = () => ({ hl: [0, 0, 0, 0, 0], line: [0, 0, 0, 0, 0, 0], bar: [0, 0, 0, 0, 0, 0], grille: [0, 0, 0, 0, 0], emb: 0, tail: 0, brake: 0, amb: 0, dash: 0, under: 0, beam: 0, amber: 0, ring: 0, puddle: 0, wing: 0, wtilt: 0, orn: 0, gal: 0, gph: 0 });   // gal·gph: 루돌프 달리기 세기·위상
  const skinOf = (P) => (P && P.skin && typeof VSKINS !== 'undefined' ? VSKINS[P.skin] : null);
  const ACC = { sleigh: '#ffd65a', imperial: '#d8b45a', aurelion: '#e6cf9a', titan: '#c47a3a', sovereign: '#dfe5ee' };

  // ---------- 화면 그리기 (색은 차량마다) ----------
  function drawCluster(cv, kmh, gear, kind, label) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, A = ACC[kind] || '#d8b45a';
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, kind === 'titan' ? '#14100c' : '#0a1024'); bg.addColorStop(1, '#03050c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = A; g.globalAlpha = 0.7; g.lineWidth = 2; g.strokeRect(3, 3, W - 6, H - 6); g.globalAlpha = 1;
    const arc = (cx, v, col, lab, txt) => {
      g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.arc(cx, H * 0.58, 58, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.arc(cx, H * 0.58, 58, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * clamp(v, 0, 1))); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.font = FONT(800, 38); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, H * 0.56);
      g.fillStyle = 'rgba(255,240,210,0.8)'; g.font = FONT(700, 15); g.fillText(lab, cx, H * 0.56 + 30);
    };
    arc(92, kmh / 140, A, 'km/h', String(Math.round(kmh)));
    arc(W - 92, Math.min(1, kmh / 100 + 0.12), '#7fb0ff', 'POWER', gear);
    const cx = W / 2, cy = H * 0.46; g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 27, cy); g.lineTo(cx, cy + 34); g.lineTo(cx - 27, cy); g.closePath();
    g.fillStyle = '#141c33'; g.fill(); g.lineWidth = 3; g.strokeStyle = A; g.stroke();
    g.fillStyle = '#fff3d8'; g.font = FONT(900, 34); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ε', cx, cy + 2);
    g.font = FONT(800, 18); g.fillStyle = '#e8ecf4'; g.fillText(label, cx, H - 26);
  }
  function drawCenter(cv, serial, name, no, kind) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, A = ACC[kind] || '#d8b45a';
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, kind === 'titan' ? '#22180f' : kind === 'sovereign' ? '#1a1724' : '#141c33'); bg.addColorStop(1, '#05070e'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = A; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    const dx = 84, dy = H / 2; g.beginPath(); g.moveTo(dx, dy - 52); g.lineTo(dx + 42, dy); g.lineTo(dx, dy + 52); g.lineTo(dx - 42, dy); g.closePath();
    g.lineWidth = 5; g.strokeStyle = A; g.stroke();
    g.fillStyle = '#fff3d8'; g.font = FONT(900, 54); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ε', dx, dy + 3);
    g.textAlign = 'left'; g.fillStyle = '#ffffff'; let px = 52; g.font = FONT(900, px); const w = g.measureText(name).width; if (w > W - 176) { px *= (W - 176) / w; g.font = FONT(900, px); } g.fillText(name, 152, H * 0.36);
    g.fillStyle = A; g.font = FONT(700, 24); g.fillText(`EPSILON  ·  EP-${no}`, 154, H * 0.62);
    g.fillStyle = 'rgba(200,214,255,0.85)'; g.font = FONT(700, 22); g.fillText(serial ? `SERIAL No. ${serial}` : 'SERIAL No. -----', 154, H * 0.82);
  }
  const labelOf = (S) => (S ? S.name.split(' ')[0] : 'EPSILON');

  // ---------- 붙이기 (한 대마다 한 번): 화면 · 바닥 조명 · 빛줄기 · 바닥 엠블럼 ----------
  function attach(P) {
    if (!P || !P.fx || !P.efx) return null;
    if (P.efxA) return P.efxA;
    const E = P.efx, S = skinOf(P), A = { screens: [], beams: [], puddles: [], kind: E.kind };
    for (const s of E.screens) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * s.h / s.w);
      if (s.id === 'cluster') drawCluster(cv, 0, 'P', E.kind, labelOf(S)); else drawCenter(cv, '', S ? S.name : '', S ? S.no : '', E.kind);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthWrite: false }));
      m.position.fromArray(s.p); m.rotation.order = 'YXZ'; m.rotation.set(s.rx, Math.PI, 0); m.visible = false; m.userData.fx = true; m.userData.cv = cv;
      P.body.add(m); A.screens.push(m); if (s.id === 'cluster') A.cluster = m; else A.center = m;
    }
    if (E.under) {
      const ug = new THREE.PlaneGeometry(E.under.w, E.under.l); ug.rotateX(-Math.PI / 2);
      A.under = new THREE.Mesh(ug, new THREE.MeshBasicMaterial({ map: underTex(), color: E.kind === 'titan' ? 0xffd2a0 : 0xffdca0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      A.under.position.set(0, 0.035, E.under.z || 0); A.under.renderOrder = 2; A.under.visible = false; A.under.userData.fx = true; P.body.add(A.under);
    }
    for (const [x, z] of E.puddle || []) {
      const pg = new THREE.PlaneGeometry(1.0, 1.0); pg.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: puddleTex(S ? S.name : 'EPSILON'), color: 0xe8eeff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(x, 0.04, z); m.renderOrder = 2; m.visible = false; m.userData.fx = true; P.body.add(m); A.puddles.push(m);
    }
    for (const b of E.beams) {
      const g = new THREE.ConeGeometry(1.25, 8, 18, 1, true); g.translate(0, -4, 0); g.rotateX(-Math.PI / 2 + 0.05);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xfff3dc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.position.fromArray(b); m.visible = false; m.renderOrder = 3; m.userData.fx = true; P.body.add(m); A.beams.push(m);
    }
    for (const m of [...A.screens, ...A.beams, ...A.puddles]) P.meshes.push(m);
    if (A.under) P.meshes.push(A.under);
    return (P.efxA = A);
  }
  // 꺼진 상태의 밝기(렌즈가 완전히 검지 않게)
  const BASE = { hl: 0.1, line: 0.12, bar: 0.1, grille: 0.12, emb: 0.22, tail: 0.12, ring: 0.14, amb: 0.06, amber: 0.15 };
  // 밝기 L(0~1)을 재질·부품에 반영
  function apply(P, L) {
    const F = P.fx; if (!F) return;
    for (const k in F) {
      const m = F[k], g = /^(hl|line|bar|grille)(\d)$/.exec(k);
      if (k.startsWith('brake')) { m.visible = L.brake > 0.02; m.material.color.setScalar(L.brake); continue; }
      let v, base;
      if (g) { v = L[g[1]][+g[2]]; base = BASE[g[1]]; }
      else if (k === 'tail') { v = Math.max(L.tail, L.brake); base = BASE.tail; }
      else if (k === 'ring') { v = Math.max(L.ring, L.brake); base = BASE.ring; }
      else if (k.startsWith('emb')) { v = L.emb; base = BASE.emb; }
      else { v = L[k] || 0; base = BASE[k] || 0.1; }
      m.material.color.setScalar(base + (1 - base) * v);
    }
    const M = P.mov;
    if (M) {
      if (M.wing) { const p0 = M.wing.userData.p0; M.wing.position.y = p0[1] + 0.2 * L.wing; M.wing.position.z = p0[2] - 0.04 * L.wing; M.wing.rotation.x = -0.55 * L.wtilt; }
      if (M.orn) { const p0 = M.orn.userData.p0; M.orn.position.y = p0[1] - 0.13 * (1 - L.orn); M.orn.visible = L.orn > 0.02; }
      // 루돌프(썰매): 대각선 두 다리씩 앞뒤로 · 머리는 두 배 빠르게 끄덕임
      if (M.legFL) { const a = L.gal || 0, ph = L.gph || 0, s1 = Math.sin(ph) * 0.72 * a, s2 = Math.sin(ph + Math.PI) * 0.72 * a; M.legFL.rotation.x = s1; M.legBR.rotation.x = s1; M.legFR.rotation.x = s2; M.legBL.rotation.x = s2; if (M.head) M.head.rotation.x = Math.sin(ph * 2) * 0.1 * a; }
    }
    const A = P.efxA; if (!A) return;
    for (const s of A.screens) { s.material.opacity = L.dash; s.visible = L.dash > 0.01; }
    if (A.under) { A.under.material.opacity = 0.6 * L.under; A.under.visible = L.under > 0.01; }
    for (const p of A.puddles) { p.material.opacity = 0.75 * L.puddle; p.visible = L.puddle > 0.01; }
    for (const b of A.beams) { b.material.opacity = 0.13 * L.beam; b.visible = L.beam > 0.01; }
  }
  function setSerial(P, serial) { const A = P.efxA; if (!A || !A.center || A.serial === serial) return; const S = skinOf(P); A.serial = serial; drawCenter(A.center.userData.cv, serial, S ? S.name : '', S ? S.no : '', A.kind); A.center.material.map.needsUpdate = true; }
  const stOf = (P) => P.efxSt || (P.efxSt = { t: 0, drv: null, parkT: 99, stillT: 0, sp: 0, px: null, pz: 0, vx: 0, vz: 0, brake: 0, hl: 0, under: 0, wing: 0, pud: 0, orn: 0, trail: 0, dashT: 0, L: mkL() });
  const pulseOf = (t, per, sharp = 8) => Math.pow(Math.max(0, Math.sin(t * TAU / per)), sharp);

  // ---------- 차량마다의 연출 (c: 상태 · 운전자 · 속도 등) ----------
  //  공통: 헤드램프 정차 디밍(st.hl) · 브레이크(st.brake) · 저녁 빛줄기
  function common(c, o) {
    const { st, L, k } = c;
    st.hl += ((c.moving || c.stillT < 1.2 ? 1 : 0.38) - st.hl) * k(c.moving ? 6 : 0.7);
    L.brake = st.brake; L.beam = c.night ? st.hl * clamp((c.t - (o.beamT || 0.6)) / 0.3, 0, 1) : 0;
  }
  // 내린 뒤(운전자 없음): 실내·헤드램프 꺼짐 → 바닥 조명·엠블럼 → 20초 뒤 절전
  function parked(c, o = {}) {
    const { st, L, k, dt } = c, pt = st.parkT, save = pt > 20;
    st.hl += (0 - st.hl) * k(1.2); L.hl.fill(st.hl);
    L.dash = Math.max(0, L.dash - dt * 1.5); L.amb = Math.max(0, L.amb - dt * 0.7); L.brake = st.brake = 0; L.beam = 0;
    L.tail = Math.max(0, L.tail - dt * 0.35); L.ring = Math.max(0, L.ring - dt * 0.35); L.amber = 0;
    for (const a of [L.line, L.bar, L.grille]) for (let i = 0; i < a.length; i++) a[i] = Math.max(0, a[i] - dt * 0.8);
    st.under += ((save || !o.under ? 0 : o.under) - st.under) * k(save ? 1 : 2); L.under = st.under;
    st.pud += ((o.puddle && !save ? 1 : 0) - st.pud) * k(2); L.puddle = st.pud;
    L.emb = Math.max(save ? 0.04 : 0.2, pulseOf(pt, save ? 6 : 2.6) * (save ? 0.45 : 1));
    st.wing += (0 - st.wing) * k(2); L.wing = st.wing; L.wtilt = 0;
    st.orn += ((pt < 1.5 ? 1 : 0) - st.orn) * k(1.6); L.orn = st.orn;
  }
  const SCRIPT = {
    // IMPERIAL X-01: 헤드램프 안쪽부터 한 칸씩 → 엠블럼 → 실내 · 정차 때 바닥 조명
    imperial(c) {
      if (!c.drv) return parked(c, { under: 0.7 });
      const { st, L, t, k } = c; common(c, {});
      for (let i = 0; i < 5; i++) L.hl[i] = Math.min(clamp((t - 0.15 - i * 0.13) / 0.08, 0, 1), st.hl);
      const flash = t > 0.72 && t < 1.45 ? Math.sin((t - 0.72) / 0.73 * Math.PI) : 0;
      L.emb = Math.max(t > 0.72 ? 0.45 : 0, flash, !c.moving && c.stillT > 1.2 ? pulseOf(c.stillT, 2.6) : 0);
      L.amb = clamp((t - 0.8) / 0.6, 0, 1); L.dash = clamp((t - 0.95) / 0.35, 0, 1); L.tail = clamp((t - 0.3) / 0.25, 0, 1) * 0.55;
      st.under += ((c.moving ? 0.12 : c.stillT > 0.8 ? 0.85 : 0.3) - st.under) * k(2); L.under = st.under;
    },
    // AURELION GT: 부메랑 헤드램프가 바깥→안 빠르게 → 옆 샴페인 빛 선이 앞→뒤로 흐름 · 고속 액티브 윙 · 정차 때 빛 선이 숨 쉬듯
    aurelion(c) {
      if (!c.drv) return parked(c, { under: 0.4 });
      const { st, L, t, k } = c; common(c, { beamT: 0.35 });
      for (let i = 0; i < 5; i++) L.hl[i] = Math.min(clamp((t - 0.1 - i * 0.07) / 0.06, 0, 1), st.hl);
      const br = c.moving ? 1 : c.stillT > 1 ? 0.5 + 0.3 * Math.sin(c.stillT * 2.2) : 1;
      for (let j = 0; j < 6; j++) L.line[j] = clamp((t - 0.45 - j * 0.09) / 0.08, 0, 1) * br;
      const flash = t > 0.95 && t < 1.6 ? Math.sin((t - 0.95) / 0.65 * Math.PI) : 0;
      L.emb = Math.max(t > 0.95 ? 0.45 : 0, flash, !c.moving && c.stillT > 1.2 ? pulseOf(c.stillT, 2.6) : 0);
      L.amb = clamp((t - 1.0) / 0.5, 0, 1); L.dash = clamp((t - 1.15) / 0.3, 0, 1); L.tail = clamp((t - 0.4) / 0.2, 0, 1) * 0.6;
      st.wing += ((c.ratio > 0.45 || (st.wing > 0.5 && st.brake > 0.3 && c.ratio > 0.2) ? 1 : 0) - st.wing) * k(3); L.wing = st.wing; L.wtilt = st.brake * st.wing;
      st.under += ((c.moving ? 0.1 : 0.5) - st.under) * k(2); L.under = st.under;
    },
    // TITAN VANGUARD: 마커등 두 번 깜빡 → 지붕 LED 바 왼→오 → C자 헤드램프 · 저녁엔 LED 바를 켠 채 주행 · 정차 때 발판 조명
    titan(c) {
      if (!c.drv) return parked(c, { under: 0.75 });
      const { st, L, t, k } = c; common(c, { beamT: 1.0 });
      L.amber = t < 0.7 ? (Math.sin(t * TAU * 2.9) > 0 ? 1 : 0.05) : 0.55;
      const keep = c.night ? 1 : clamp(1 - (t - 1.7) / 0.5, 0, 1);
      for (let j = 0; j < 6; j++) L.bar[j] = clamp((t - 0.6 - j * 0.08) / 0.06, 0, 1) * keep;
      for (let i = 0; i < 5; i++) L.hl[i] = Math.min(clamp((t - 0.9 - i * 0.09) / 0.07, 0, 1), st.hl);
      const flash = t > 1.3 && t < 1.9 ? Math.sin((t - 1.3) / 0.6 * Math.PI) : 0;
      L.emb = Math.max(t > 1.3 ? 0.4 : 0, flash, !c.moving && c.stillT > 1.2 ? pulseOf(c.stillT, 3) : 0);
      L.amb = clamp((t - 1.1) / 0.6, 0, 1); L.dash = clamp((t - 1.3) / 0.3, 0, 1); L.tail = clamp((t - 0.9) / 0.2, 0, 1) * 0.6;
      st.under += ((c.moving ? 0 : c.stillT > 0.6 ? 0.8 : 0.2) - st.under) * k(2.5); L.under = st.under;
    },
    // SOVEREIGN ECLIPSE: 문 옆 바닥 엠블럼 → 보닛 장식이 솟음 → 그릴 빛이 아래→위로 차오름 → 헤드램프 · 이클립스 원형 등 · 스타라이트
    sovereign(c) {
      if (!c.drv) return parked(c, { puddle: true });
      const { st, L, t, k } = c; common(c, { beamT: 1.3 });
      st.pud += ((t < 3 || (!c.moving && c.stillT > 1.5) ? 1 : 0) - st.pud) * k(2); L.puddle = st.pud;
      st.orn = clamp((t - 0.2) / 0.8, 0, 1); L.orn = st.orn;
      const gb = c.moving ? 0.45 : c.stillT > 1 ? 0.55 + 0.25 * Math.sin(c.stillT * 1.6) : 1;
      for (let j = 0; j < 5; j++) L.grille[j] = clamp((t - 0.55 - j * 0.12) / 0.1, 0, 1) * gb;
      for (let i = 0; i < 5; i++) L.hl[i] = Math.min(clamp((t - 1.0 - i * 0.06) / 0.08, 0, 1), st.hl);
      L.ring = clamp((t - 1.25) / 0.4, 0, 1) * 0.65; L.tail = 0;
      const flash = t > 1.45 && t < 2.1 ? Math.sin((t - 1.45) / 0.65 * Math.PI) : 0;
      L.emb = Math.max(t > 1.45 ? 0.5 : 0, flash, !c.moving && c.stillT > 1.2 ? pulseOf(c.stillT, 3.2) : 0);
      L.amb = clamp((t - 0.6) / 1.0, 0, 1); L.dash = clamp((t - 1.2) / 0.35, 0, 1);
    },
    // RUDOLPH EXPRESS(크리스마스 EXCLUSIVE 썰매): 루돌프 코가 두 번 깜빡이고 켜짐 → 랜턴 → 요정 전구가 번갈아 반짝 · 금빛 바닥 빛
    //  달리면 속도만큼 루돌프 다리가 빨라지고 날에서 금빛 가루 · 방울 소리(update) / 내리면 코만 은은하게
    sleigh(c) {
      const { st, L, k, dt } = c;
      if (!c.drv) { parked(c, { under: 0.3 }); st.gal = (st.gal || 0) * Math.max(0, 1 - dt * 4); L.gal = st.gal; L.gph = st.gph || 0; L.hl[0] = Math.max(L.hl[0], 0.3 + 0.15 * Math.sin((st.parkT || 0) * 2)); return; }
      const { t } = c; common(c, {});
      L.hl[0] = (t < 0.6 ? (Math.sin(t * TAU * 2.5) > 0 ? 1 : 0.15) : 1) * (0.85 + 0.15 * Math.sin(t * 6));
      L.hl[1] = L.hl[2] = clamp((t - 0.5) / 0.3, 0, 1) * Math.max(0.6, st.hl);
      L.hl[3] = clamp((t - 0.8) / 0.3, 0, 1) * (0.55 + 0.45 * Math.sin(t * 5)); L.hl[4] = clamp((t - 0.9) / 0.3, 0, 1) * (0.55 + 0.45 * Math.sin(t * 5 + 2.1));
      L.emb = Math.max(t > 1.1 ? 0.55 : 0, !c.moving && c.stillT > 1.2 ? pulseOf(c.stillT, 2.4) : 0);
      L.amb = clamp((t - 1.0) / 0.5, 0, 1);
      st.under += ((c.moving ? 0.55 : 0.35) - st.under) * k(2); L.under = st.under;
      const want = c.moving ? clamp(c.ratio * 2.2 + 0.25, 0, 1) : 0; st.gal = (st.gal || 0) + (want - (st.gal || 0)) * k(4);
      st.gph = (st.gph || 0) + dt * TAU * (1.1 + 2.4 * clamp(c.ratio, 0, 1)) * (st.gal > 0.02 ? 1 : 0);
      L.gal = st.gal; L.gph = st.gph;
    },
  };
  // 빠른 주행 빛 잔상 (차량마다 색·문턱) — TITAN 은 없음 · 썰매는 천천히 달려도 날에서 금빛 가루
  const TRAIL = { sleigh: { th: 0.12, rate: [18, 40], cols: [0xffe08a, 0xffffff, 0xff7a7a] }, imperial: { th: 0.55, rate: [22, 48], cols: [0xffe6b0, 0xffffff, 0x9fb4ff] }, aurelion: { th: 0.5, rate: [30, 60], cols: [0xf2dcae, 0xffffff, 0xffe9c4] }, sovereign: { th: 0.6, rate: [16, 30], cols: [0xe8eeff, 0xffffff, 0xc9d2e0] } };

  // ---------- 경기 중 (Veh.update 가 매 프레임) ----------
  function update(v, dt) {
    const P = v.P; if (!P.fx || !P.efx) return;
    attach(P); const st = stOf(P), L = st.L, k = (rate) => Math.min(1, dt * rate), kind = P.efx.kind;
    if (v.dead) { if (!st.dead) { st.dead = true; Object.assign(L, mkL()); apply(P, L); } return; }
    const ddt = Math.max(dt, 1e-3);
    if (st.px === null) { st.px = v.pos.x; st.pz = v.pos.z; }
    const vx = (v.pos.x - st.px) / ddt, vz = (v.pos.z - st.pz) / ddt; st.px = v.pos.x; st.pz = v.pos.z;
    st.vx += (vx - st.vx) * k(10); st.vz += (vz - st.vz) * k(10);
    const sp = Math.hypot(st.vx, st.vz), dec = (st.sp - sp) / ddt; st.sp = sp;
    const drv = v.driver && v.driver.alive ? v.driver : null, moving = sp > 1.2;
    const cam = G.camera, near = !!cam && cam.position.distanceTo(v.pos) < 90;
    if (drv && !st.drv) {
      st.t = 0; st.hl = 1; st.parkT = 0; st.brake = 0;
      setSerial(P, drv.isPlayer && typeof Eco !== 'undefined' ? Eco.serialOf(v.skin) : hash5((drv.name || '') + '|' + v.skin));
      if (near && typeof Audio !== 'undefined' && Audio.vehStart) Audio.vehStart(kind, v.pos, !!drv.isPlayer);
    }
    if (!drv && st.drv) st.parkT = 0;
    st.drv = drv; st.t += dt; st.stillT = moving ? 0 : st.stillT + dt; if (!drv) st.parkT += dt;
    const brk = drv && dec > 2.2 && sp > 0.8 ? 1 : 0; st.brake += (brk - st.brake) * k(brk ? 20 : 5);
    (SCRIPT[kind] || SCRIPT.imperial)({ st, L, k, dt, t: st.t, drv, moving, stillT: st.stillT, sp, ratio: sp / v.T.vmax, night: SETTINGS.time === 'dusk' });
    apply(P, L);
    // 썰매: 달리는 동안 방울 소리 (빠를수록 촘촘히)
    if (kind === 'sleigh' && drv && moving && near && typeof Audio !== 'undefined' && Audio.jingle && (st.bellT = (st.bellT || 0) - dt) <= 0) { const r = clamp(sp / v.T.vmax, 0, 1); st.bellT = 0.34 - 0.16 * r; Audio.jingle(v.pos, !!drv.isPlayer, r); }
    if (drv && drv.isPlayer && P.efxA && P.efxA.cluster && (st.dashT -= dt) <= 0) { st.dashT = 0.25; drawCluster(P.efxA.cluster.userData.cv, sp * 3.6, moving ? 'D' : 'P', kind, labelOf(skinOf(P))); P.efxA.cluster.material.map.needsUpdate = true; }
    // 빠른 주행: 차체 옆선을 따라 빛 잔상
    const TR = TRAIL[kind], E = P.efx.trail;
    if (TR && E && drv && near && sp > v.T.vmax * TR.th && P.root.visible && typeof GunSkin !== 'undefined' && P.root.parent) {
      const pool = GunSkin.fx.pool(P.root.parent), r = clamp((sp / v.T.vmax - TR.th) / (1 - TR.th), 0, 1);
      st.trail += dt * (TR.rate[0] + TR.rate[1] * r);
      for (; st.trail >= 1; st.trail--) {
        const s = Math.random() < 0.5 ? 1 : -1, p = new THREE.Vector3(s * E.x, E.y + (Math.random() - 0.5) * 0.5, lerp(E.z0, E.z1, Math.random()));
        P.body.localToWorld(p);
        GunSkin.fx.emit(pool, p, st.vx * 0.82, 0.05, st.vz * 0.82, TR.cols[(Math.random() * TR.cols.length) | 0], 0.09 + Math.random() * 0.07, 0.3 + Math.random() * 0.25, { so: 0.55, grow: -0.6, drag: 1.5 });
      }
    }
  }
  // ---------- 컷신·진열장: 운전자가 막 시동을 건 것처럼 (t = 시동 뒤 시간) ----------
  function preview(P, t, o = {}) {
    if (!P || !P.fx || !P.efx) return; attach(P);
    const st = stOf(P), L = st.L; st.t = t; st.hl = 1; st.brake = 0;
    (SCRIPT[P.efx.kind] || SCRIPT.imperial)({ st, L, k: () => 1, dt: 1 / 60, t, drv: true, moving: false, stillT: o.still === undefined ? 0.5 : o.still, sp: 0, ratio: 0, night: !!o.night });
    if (o.wing !== undefined) { L.wing = o.wing; L.wtilt = 0; }
    apply(P, L);
  }
  function showroom(P, dt) {
    if (!P || !P.fx || !P.efx) return; attach(P);
    const st = stOf(P); st.show = (st.show || 0) + dt;
    if (!P.efxA.serial) setSerial(P, typeof Eco !== 'undefined' && P.skin ? Eco.serialOf(P.skin) : '');
    preview(P, 6 + st.show, { still: 1.0 });
  }
  return { attach, apply, update, preview, showroom, setSerial, mkL, hash5 };
})();
