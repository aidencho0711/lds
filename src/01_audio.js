// ============================================================
// 01_audio.js — WebAudio 사운드 엔진 (외부 음원 없음, 전부 합성)
//  · 총성: 무기별 파라미터로 '초음속 크랙 + 폭압 + 저역 펀치 + 총몸 공명 + 근거리 반사'를
//    OfflineAudioContext에서 미리 렌더(무기당 3가지 변형) → 재생 시 비용이 낮다
//  · 거리: 음속 지연(거리/343초), 거리 감쇠, 고역 감쇠, 좌우 패닝, 멀수록 잔향 비율 증가
//  · 잔향: 야외(길고 성긴 반사) / 실내(짧고 밀도 높은 반사) 컨볼루션
//  · 장전·볼트·펌프·탄피 등 기계음도 미리 렌더
//  · 마스터 리미터(컴프레서)로 연사 시 클리핑 방지, 동시 재생 수 제한
// ============================================================
const Audio = (() => {
  let ctx = null, master, comp, sfxBus, musicBus, outIn, roomIn, noiseBuf;
  let active = 0, ambient = null, music = null, bankReady = false;
  const MAX_VOICES = 48, bank = {}, lastPlay = {};
  const listener = { x: 0, y: 0, z: 0, yaw: 0, indoor: 0 };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // 버스 압축(가벼운 글루) → 마스터 → 리미터(클리핑 방지). 예전엔 압축이 2ms 만에 걸려 총성의 '몸통'을 깎아 먹었다
    master = ctx.createGain(); master.gain.value = 1.0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -9; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.22;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
    comp.connect(master); master.connect(lim); lim.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.connect(master);
    const outVerb = ctx.createConvolver(); outVerb.buffer = impulse(2.6, 'out');
    const roomVerb = ctx.createConvolver(); roomVerb.buffer = impulse(0.8, 'room');
    outIn = ctx.createGain(); outIn.gain.value = 0.55; outIn.connect(outVerb); outVerb.connect(sfxBus);
    roomIn = ctx.createGain(); roomIn.gain.value = 0.7; roomIn.connect(roomVerb); roomVerb.connect(sfxBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    renderBank().catch((e) => console.warn('사운드 뱅크 렌더 실패, 실시간 합성으로 대체', e));
  }
  // 잔향 임펄스: 야외는 띄엄띄엄한 초기 반사 + 긴 저역 꼬리, 실내는 촘촘하고 밝다
  function impulse(sec, kind) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      const decay = kind === 'out' ? 2.4 : 7, smooth = kind === 'out' ? 0.82 : 0.4;
      for (let i = 0; i < len; i++) { const t = i / sr, x = Math.random() * 2 - 1; lp = lp * smooth + x * (1 - smooth); d[i] = lp * Math.exp(-t * decay) * (kind === 'out' ? 0.9 : 0.6); }
      if (kind === 'out') for (let k = 0; k < 14; k++) { const t = 0.03 + Math.random() * 0.45, i = Math.floor(t * sr); if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * 0.9 * Math.exp(-t * 3); }
      for (let i = 0; i < Math.min(len, sr * 0.004); i++) d[i] *= i / (sr * 0.004);
    }
    return b;
  }
  function applyVolumes() { if (!ctx) return; sfxBus.gain.value = SETTINGS.sfx; musicBus.gain.value = SETTINGS.music; }
  function setListener(x, y, z, yaw, indoor) {
    listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw;
    listener.indoor = lerp(listener.indoor, indoor ? 1 : 0, 0.1);
  }
  function voice(dur) { if (active >= MAX_VOICES) return false; active++; setTimeout(() => active--, dur * 1000 + 60); return true; }
  function throttle(key, gap) { const t = now(); if (lastPlay[key] && t - lastPlay[key] < gap) return false; lastPlay[key] = t; return true; }
  function geom(pos) {
    const dx = pos.x - listener.x, dz = pos.z - listener.z, dy = (pos.y || 0) - listener.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    const pan = clamp(-Math.sin(angleDiff(listener.yaw, Math.atan2(dx, dz))), -1, 1) * clamp(d / 6, 0, 0.85);
    return { d, pan };
  }
  // 출력 체인: gain → pan → lowpass → bus (+ 잔향 송출)
  function chain(gain, pan, cutoff, send, room, when) {
    const g = ctx.createGain(); g.gain.value = gain;
    let tail = g;
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; tail.connect(lp); lp.connect(sfxBus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; lp.connect(s); s.connect(room ? roomIn : outIn); }
    return g;
  }
  // 미리 렌더한 버퍼 재생
  function playBuf(name, pos, gain, o = {}) {
    if (!ctx) return false;
    const arr = bank[name]; if (!arr || !arr.length) return false;   // 만들어진 소리부터 바로 사용
    const buf = arr[Math.floor(Math.random() * arr.length)];
    let g = gain, pan = 0, cutoff = 20000, delay = 0, d = 0;
    if (pos && !o.own) {
      const r = geom(pos); d = r.d; pan = r.pan;
      const range = o.range || 60; if (d > range) return false;
      g = gain / (1 + d / (o.ref || 12)) * Math.pow(1 - d / range, 0.5);
      cutoff = clamp(20000 / (1 + d / (o.lpRef || 40)), 450, 20000);
      if (o.sonic) delay = Math.min(d / 343, 1.8);
    }
    if (g < 0.002) return false;
    const rate = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.jitter !== undefined ? o.jitter : 0.06));
    if (!voice(Math.min(buf.duration, o.vdur || 9) / rate + delay)) return false;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    src.connect(chain(g, pan, cutoff, o.send || 0, o.room, delay));
    src.start(ctx.currentTime + delay + (o.at || 0));
    return true;
  }

  // ---------- 오프라인 합성 ----------
  function tanhCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; }
  function oNoise(oc) { if (oc._nb) return oc._nb; const b = oc.createBuffer(1, oc.sampleRate * 2, oc.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (oc._nb = b); }
  function nz(oc, out, t0, dur, type, f0, f1, q, g0, att = 0.001) {
    const s = oc.createBufferSource(); s.buffer = oNoise(oc);
    const f = oc.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }
  function os(oc, out, t0, dur, type, f0, f1, g0, att = 0.001) {
    const o = oc.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // 금속성 '딸깍': 짧은 잡음으로 여러 개의 고Q 공진을 때림 (비정수배 주파수 → 금속 느낌)
  function metal(oc, out, t0, freqs, decay, g0) { for (const f of freqs) nz(oc, out, t0, decay * (0.8 + Math.random() * 0.5), 'bandpass', f, f * 0.985, 22 + Math.random() * 14, g0 * 3.2 / Math.sqrt(freqs.length), 0.0004); nz(oc, out, t0, 0.008, 'highpass', 3000, 3000, 0.7, g0 * 0.5, 0.0002); }
  function scrape(oc, out, t0, dur, f0, f1, g0) { nz(oc, out, t0, dur, 'bandpass', f0, f1, 3.5, g0, dur * 0.3); }
  function thunk(oc, out, t0, f, dur, g0) { os(oc, out, t0, dur, 'sine', f, f * 0.6, g0, 0.001); nz(oc, out, t0, dur * 0.6, 'lowpass', f * 4, f * 2, 0.7, g0 * 0.5, 0.0005); }
  function normalize(buf, peak) {
    let m = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
    if (m > 0) { const k = peak / m; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    return buf;
  }
  async function render(sec, fn, peak = 0.9, loud = 0) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new OAC(2, Math.ceil(ctx.sampleRate * sec), ctx.sampleRate);
    const out = oc.createGain(); out.connect(oc.destination);
    fn(oc, out);
    const b = await oc.startRendering();
    if (loud) loudness(b, loud);
    return normalize(b, peak);
  }
  // 무기별 총성 파라미터
  //  tf→te: 저역 펀치(킥) 시작·끝 주파수 / lo: 저중역 폭압 대역(휴대폰 스피커에서도 '묵직함'이 들리는 150~350Hz)
  //  body: 중역 스냅 / tail: 야외 잔향 꼬리 길이(초) / drv: 포화(밀도·음압) / sec: 렌더 길이
  const GUN = {
    m416: { crack: 1.0, hp: 3100, cl: 1, boom: 1.0, lp: 3300, bd: 0.17, th: 0.9, tf: 118, te: 46, tl: 1, lo: 230, body: 1300, bq: 1.6, bdc: 0.06, er: 1, tail: 1.05, drv: 1.0, gain: 1.0, own: 0.95, range: 850, mech: 'mech_rifle' },
    aug: { crack: 1.1, hp: 3400, cl: 0.9, boom: 0.95, lp: 3800, bd: 0.15, th: 0.85, tf: 125, te: 50, tl: 0.9, lo: 250, body: 1650, bq: 1.9, bdc: 0.05, er: 0.95, tail: 1.0, drv: 0.95, gain: 1.0, own: 0.95, range: 850, mech: 'mech_rifle' },
    akm: { crack: 1.05, hp: 2500, cl: 1.15, boom: 1.15, lp: 2300, bd: 0.24, th: 1.1, tf: 88, te: 36, tl: 1.15, lo: 190, body: 760, bq: 1.25, bdc: 0.09, er: 1.12, tail: 1.25, drv: 1.08, gain: 1.07, own: 1.0, range: 850, mech: 'mech_ak' },
    asm: { crack: 0.95, hp: 3300, cl: 0.9, boom: 0.95, lp: 3000, bd: 0.15, th: 0.85, tf: 122, te: 48, tl: 0.85, lo: 240, body: 1450, bq: 1.8, bdc: 0.05, er: 0.95, tail: 0.95, drv: 0.95, gain: 0.98, own: 0.92, range: 820, mech: 'mech_ak' },
    vk9: { crack: 0.45, hp: 3600, cl: 0.8, boom: 0.8, lp: 4200, bd: 0.1, th: 0.7, tf: 150, te: 60, tl: 0.8, lo: 300, body: 1700, bq: 2, bdc: 0.04, er: 0.8, tail: 0.6, drv: 0.85, gain: 0.78, own: 0.78, range: 450, mech: 'mech_smg', sec: 1.0 },
    mini14: { crack: 1.0, hp: 3300, cl: 0.95, boom: 0.9, lp: 3500, bd: 0.16, th: 0.8, tf: 130, te: 52, tl: 0.9, lo: 245, body: 1500, bq: 1.7, bdc: 0.055, er: 1.0, tail: 1.1, drv: 0.95, gain: 0.97, own: 0.95, range: 900, mech: 'mech_rifle' },
    slr: { crack: 1.25, hp: 2600, cl: 1.2, boom: 1.2, lp: 2200, bd: 0.28, th: 1.15, tf: 92, te: 34, tl: 1.25, lo: 180, body: 850, bq: 1.25, bdc: 0.1, er: 1.2, tail: 1.45, drv: 1.1, gain: 1.12, own: 1.05, range: 1000, mech: 'mech_ak' },
    m24: { crack: 1.35, hp: 2500, cl: 1.25, boom: 1.2, lp: 2000, bd: 0.32, th: 1.2, tf: 84, te: 32, tl: 1.3, lo: 175, body: 760, bq: 1.2, bdc: 0.1, er: 1.4, tail: 1.7, drv: 1.1, gain: 1.2, own: 1.08, range: 1100, mech: null, sec: 2.0 },
    awm: { crack: 1.6, hp: 2200, cl: 1.5, boom: 1.45, lp: 1600, bd: 0.42, th: 1.45, tf: 70, te: 26, tl: 1.6, lo: 165, body: 600, bq: 1.0, bdc: 0.13, er: 1.6, tail: 2.0, drv: 1.15, gain: 1.35, own: 1.12, range: 1300, mech: null, sec: 2.4 },
    s686: { crack: 0.55, hp: 2000, cl: 1.7, boom: 1.35, lp: 1600, bd: 0.4, th: 1.4, tf: 66, te: 28, tl: 1.7, lo: 175, body: 520, bq: 1.0, bdc: 0.12, er: 1.35, tail: 1.4, drv: 1.15, gain: 1.2, own: 1.05, range: 720, mech: null },
    s12k: { crack: 0.65, hp: 2300, cl: 1.5, boom: 1.2, lp: 1900, bd: 0.33, th: 1.25, tf: 76, te: 32, tl: 1.5, lo: 180, body: 640, bq: 1.1, bdc: 0.1, er: 1.25, tail: 1.3, drv: 1.1, gain: 1.12, own: 1.02, range: 700, mech: 'mech_ak' },
    m249: { crack: 0.95, hp: 2900, cl: 1.0, boom: 1.05, lp: 2900, bd: 0.18, th: 0.95, tf: 110, te: 44, tl: 0.95, lo: 215, body: 1100, bq: 1.5, bdc: 0.07, er: 1.05, tail: 1.1, drv: 1.05, gain: 1.02, own: 0.95, range: 880, mech: 'mech_lmg' },
    mg3: { crack: 1.1, hp: 2600, cl: 0.95, boom: 1.1, lp: 2500, bd: 0.14, th: 1.0, tf: 96, te: 40, tl: 0.8, lo: 200, body: 900, bq: 1.4, bdc: 0.06, er: 0.9, tail: 1.05, drv: 1.05, gain: 1.05, own: 0.95, range: 900, mech: 'mech_lmg' },
    p19: { crack: 0.6, hp: 3400, cl: 0.9, boom: 0.75, lp: 4000, bd: 0.09, th: 0.75, tf: 165, te: 65, tl: 0.8, lo: 320, body: 1850, bq: 2.2, bdc: 0.035, er: 0.8, tail: 0.55, drv: 0.85, gain: 0.75, own: 0.75, range: 400, mech: 'mech_pistol', sec: 1.0 },
    // v16 — Beryl: AKM보다 조금 밝고 날카로움 / M16A4: 건조한 5.56 / Vector·Bizon: 가벼운 9mm(Vector가 더 높고 짧음)
    //  Tommy·Win94: .45는 음속보다 느려 크랙이 거의 없고 둔탁한 '퍽' / Kar98k: 긴 꼬리의 큰 소총 / DP-28: 느린 7.62 / Deagle: 묵직한 권총
    beryl: { crack: 1.1, hp: 2700, cl: 1.1, boom: 1.15, lp: 2400, bd: 0.23, th: 1.08, tf: 92, te: 37, tl: 1.1, lo: 195, body: 820, bq: 1.3, bdc: 0.085, er: 1.1, tail: 1.22, drv: 1.08, gain: 1.07, own: 1.0, range: 850, mech: 'mech_ak' },
    m16a4: { crack: 1.05, hp: 3200, cl: 0.95, boom: 0.95, lp: 3400, bd: 0.16, th: 0.88, tf: 122, te: 48, tl: 0.95, lo: 235, body: 1400, bq: 1.7, bdc: 0.055, er: 1.0, tail: 1.1, drv: 0.98, gain: 1.0, own: 0.95, range: 880, mech: 'mech_rifle' },
    vector: { crack: 0.42, hp: 3800, cl: 0.75, boom: 0.75, lp: 4400, bd: 0.09, th: 0.65, tf: 160, te: 64, tl: 0.75, lo: 310, body: 1900, bq: 2.1, bdc: 0.035, er: 0.75, tail: 0.55, drv: 0.85, gain: 0.74, own: 0.74, range: 430, mech: 'mech_smg', sec: 1.0 },
    bizon: { crack: 0.45, hp: 3500, cl: 0.82, boom: 0.82, lp: 4000, bd: 0.11, th: 0.72, tf: 145, te: 58, tl: 0.82, lo: 290, body: 1550, bq: 1.9, bdc: 0.045, er: 0.82, tail: 0.62, drv: 0.86, gain: 0.8, own: 0.78, range: 450, mech: 'mech_smg', sec: 1.0 },
    tommy: { crack: 0.15, hp: 2900, cl: 1.0, boom: 1.0, lp: 2600, bd: 0.15, th: 0.95, tf: 112, te: 46, tl: 1.0, lo: 235, body: 1050, bq: 1.5, bdc: 0.07, er: 0.95, tail: 0.75, drv: 0.95, gain: 0.86, own: 0.85, range: 480, mech: 'mech_smg', sec: 1.1 },
    kar98k: { crack: 1.4, hp: 2400, cl: 1.3, boom: 1.25, lp: 1900, bd: 0.34, th: 1.25, tf: 80, te: 30, tl: 1.35, lo: 170, body: 720, bq: 1.15, bdc: 0.11, er: 1.45, tail: 1.8, drv: 1.12, gain: 1.22, own: 1.08, range: 1100, mech: null, sec: 2.0 },
    win94: { crack: 0.35, hp: 2600, cl: 1.15, boom: 1.1, lp: 2200, bd: 0.24, th: 1.05, tf: 95, te: 38, tl: 1.15, lo: 200, body: 880, bq: 1.3, bdc: 0.09, er: 1.15, tail: 1.25, drv: 1.05, gain: 1.05, own: 1.0, range: 750, mech: null, sec: 1.6 },
    s1897: { crack: 0.55, hp: 2000, cl: 1.65, boom: 1.3, lp: 1650, bd: 0.38, th: 1.35, tf: 68, te: 29, tl: 1.65, lo: 178, body: 540, bq: 1.0, bdc: 0.12, er: 1.3, tail: 1.35, drv: 1.15, gain: 1.18, own: 1.04, range: 720, mech: null },
    dp28: { crack: 1.15, hp: 2500, cl: 1.05, boom: 1.15, lp: 2300, bd: 0.2, th: 1.05, tf: 90, te: 37, tl: 1.0, lo: 192, body: 800, bq: 1.3, bdc: 0.08, er: 1.05, tail: 1.2, drv: 1.07, gain: 1.07, own: 0.98, range: 900, mech: 'mech_lmg' },
    deagle: { crack: 0.85, hp: 2900, cl: 1.1, boom: 1.1, lp: 2700, bd: 0.17, th: 1.0, tf: 110, te: 45, tl: 1.05, lo: 240, body: 1150, bq: 1.6, bdc: 0.07, er: 1.0, tail: 0.95, drv: 1.0, gain: 0.95, own: 0.9, range: 600, mech: 'mech_pistol', sec: 1.3 },
  };
  // 총성 합성 (실제 녹음의 구조를 흉내):
  //  ① 초음속 크랙(아주 짧은 고역) ② 폭압: 광대역 잡음 + 150~350Hz 저중역 덩어리 ③ 피치가 빠르게 떨어지는 저역 킥
  //  ④ 중역 스냅(총몸 공명) ⑤ 가스 '훅' ⑥ 근거리 반사 + 지형 메아리 + 0.6~2초 굴러가는 저역 꼬리('탕~')
  //  ①은 깨끗하게, 나머지는 tanh 포화로 밀도를 높여 같은 피크에서 체감 음량을 키운다
  function shotGraph(P) {
    return (oc, out) => {
      const j = () => 0.94 + Math.random() * 0.12, t = 0.004;
      const pre = oc.createGain(); pre.gain.value = 1;
      const sat = oc.createWaveShaper(); sat.curve = tanhCurve(1.5 * P.drv); sat.oversample = '2x';
      const post = oc.createGain(); post.gain.value = 0.85; pre.connect(sat); sat.connect(post); post.connect(out);
      // 근거리 반사 (좌우 다른 지연)
      const merger = oc.createChannelMerger(2); merger.connect(out);
      [[0.019, 0.24, 3200, 0], [0.033, 0.19, 2600, 1], [0.047, 0.16, 2100, 0], [0.071, 0.12, 1700, 1], [0.098, 0.09, 1300, 0]].forEach(([dt, g, f, ch]) => {
        const d = oc.createDelay(0.3); d.delayTime.value = dt * (0.9 + Math.random() * 0.2);
        const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f;
        const gn = oc.createGain(); gn.gain.value = g * P.er; post.connect(d); d.connect(lp); lp.connect(gn); gn.connect(merger, 0, ch);
      });
      // 지형 메아리: 멀리서 되돌아오는 둔탁한 반사 (좌우 번갈아)
      [[0.12, 0.3, 1500, 1], [0.24, 0.21, 1100, 0], [0.43, 0.14, 850, 1], [0.7, 0.085, 650, 0]].forEach(([dt, g, f, ch]) => {
        if (dt > P.tail * 0.8) return;
        const d = oc.createDelay(1.0); d.delayTime.value = dt * (0.85 + Math.random() * 0.3);
        const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.5;
        const gn = oc.createGain(); gn.gain.value = g * P.er; post.connect(d); d.connect(lp); lp.connect(gn); gn.connect(merger, 0, ch);
      });
      // ① 크랙 (포화 전, 바로 출력)
      nz(oc, out, t, 0.012 * P.cl, 'highpass', P.hp * j(), P.hp, 0.7, 0.9 * P.crack, 0.0002);
      nz(oc, out, t, 0.007, 'bandpass', 5600 * j(), 3800, 1.3, 0.55 * P.crack, 0.0002);
      // ② 폭압: 광대역 + 저중역 덩어리(휴대폰에서도 '쿵'이 들리는 대역)
      nz(oc, pre, t, P.bd * 1.3 * j(), 'lowpass', P.lp * j(), P.lp * 0.3, 0.8, 1.0 * P.boom, 0.0006);
      nz(oc, pre, t, 0.2 * P.tl * j(), 'bandpass', P.lo * j(), P.lo * 0.75, 1.1, 2.2 * P.boom, 0.0012);
      nz(oc, pre, t + 0.001, 0.13 * P.tl, 'bandpass', P.lo * 2.3 * j(), P.lo * 1.6, 1.2, 1.5 * P.boom, 0.001);
      // ③ 저역 킥: 피치가 60ms 안에 급강하 → 지수 감쇠
      {
        const o = oc.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(P.tf * 2.2 * j(), t); o.frequency.exponentialRampToValueAtTime(P.te * 1.3, t + 0.06 * P.tl);
        const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.75 * Math.min(P.th, 1) * (P.te < 36 ? 0.75 : 1), t + 0.0015); g.gain.setTargetAtTime(0.0001, t + 0.008, 0.042 * P.tl);
        o.connect(g); g.connect(pre); o.start(t); o.stop(t + 0.6 * P.tl);
      }
      // ④ 중역 스냅 (총몸·총구 공명)
      nz(oc, pre, t, P.bdc * 1.6, 'bandpass', P.body * j(), P.body * 0.85, P.bq, 1.45, 0.0005);
      // ⑤ 가스 '훅' (조금 늦게, 낮게)
      nz(oc, pre, t + 0.01, 0.3 * P.tl, 'bandpass', 420 * j(), 200, 0.8, 0.8 * P.boom, 0.006);
      // ⑥ 굴러가는 꼬리: 저역 잡음이 서서히 사라짐 (포화 뒤에 섞어 왜곡 없이)
      {
        const s = oc.createBufferSource(); s.buffer = oNoise(oc);
        const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6; f.frequency.setValueAtTime(900 * j(), t + 0.02); f.frequency.exponentialRampToValueAtTime(260, t + P.tail);
        const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110; f.connect(hp);
        const g = oc.createGain(); g.gain.setValueAtTime(0.0001, t + 0.015); g.gain.linearRampToValueAtTime(0.36 * P.boom, t + 0.06); g.gain.setTargetAtTime(0.0001, t + 0.07, P.tail * 0.26);
        s.connect(f); hp.connect(g); g.connect(out); s.start(t + 0.015, Math.random() * 0.5); s.stop(t + P.tail + 0.4);
      }
    };
  }
  // 렌더 후 처리: 부드러운 리미터(tanh)로 피크를 눌러 평균 음압을 올린다
  function loudness(buf, k) {
    let m = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
    if (!m) return buf; const n = Math.tanh(k);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] / m * k) / n; }
    return buf;
  }
  // ---------- 기계음 (장전·볼트·덮개 등) ----------
  //  예전 소리가 '레고' 같았던 이유: 높은 대역의 짧은 딸깍 소리만 있고, 금속 부품의 무게(중저역 몸체 울림)·
  //  마찰음(미끄러짐)·스프링 울림이 없었고, 모든 소리를 같은 최대 음량으로 맞췄다.
  //  지금: ① 접촉 순간 넓은 대역의 짧은 충격음 ② 부품별 고유 진동(비정수배 주파수, 높을수록 빨리 사라짐)
  //        ③ 총몸(리시버) 공명 ④ 마찰(스틱-슬립 알갱이 잡음) ⑤ 스프링 울림 ⑥ 손·천 소리 + 좌우 위치 + 소리별 상대 음량
  function pan(oc, out, p) { if (!p || !oc.createStereoPanner) return out; const n = oc.createStereoPanner(); n.pan.value = p; n.connect(out); return n; }
  // 고유 진동 묶음: list = [[주파수, 감쇠 시간상수(s), 크기], ...] — 사인파가 지수적으로 사라짐
  function modal(oc, out, t0, list, g0, p = 0, fm = 1) {
    const dst = pan(oc, out, p);
    for (const [f0, d, a] of list) {
      const o = oc.createOscillator(); o.frequency.value = f0 * fm * (1 + (Math.random() - 0.5) * 0.012);
      const g = oc.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(g0 * a, t0 + 0.0006); g.gain.setTargetAtTime(0, t0 + 0.0006, d);
      o.connect(g); g.connect(dst); o.start(t0); o.stop(t0 + d * 6 + 0.01);
    }
  }
  // 접촉 충격음: 아주 짧은 넓은 대역 잡음 (hp 이상만)
  function tick(oc, out, t0, hp, g0, dur = 0.0025, p = 0) { nz(oc, pan(oc, out, p), t0, dur, 'highpass', hp, hp, 0.7, g0, 0.0002); }
  // 무게감: 낮은 사인 + 저역 잡음 (부품이 멈추며 총 전체가 울림)
  function body(oc, out, t0, f, g0, dur, p = 0) { const d = pan(oc, out, p); os(oc, d, t0, dur, 'sine', f, f * 0.7, g0, 0.0015); nz(oc, d, t0, dur * 0.5, 'lowpass', f * 3.5, f * 1.5, 0.8, g0 * 0.6, 0.0008); }
  // 마찰(미끄러짐): 대역 잡음 + 스틱-슬립 알갱이. f0→f1로 음색이 변함
  function slide(oc, out, t0, dur, f0, f1, g0, grit = 1, p = 0) {
    const d = pan(oc, out, p);
    nz(oc, d, t0, dur, 'bandpass', f0, f1, 2.2, g0 * 0.55, dur * 0.25);
    const n = Math.round(dur * 260 * grit);
    for (let i = 0; i < n; i++) { const t = Math.random(), f = lerp(f0, f1, t) * (0.8 + Math.random() * 0.5); nz(oc, d, t0 + t * dur, 0.0015 + Math.random() * 0.003, 'bandpass', f, f, 4, g0 * (0.3 + Math.random() * 0.9) * Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.0002); }
  }
  // 스프링: 금속 코일이 눌리거나 튕기며 내는 '징' — 짧은 처프 + 떨리는 공명
  function spring(oc, out, t0, f0, f1, dur, g0, p = 0) {
    const d = pan(oc, out, p), o = oc.createOscillator(), g = oc.createGain(), v = oc.createOscillator(), vg = oc.createGain();
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.6);
    v.frequency.value = 38 + Math.random() * 20; vg.gain.value = f1 * 0.012; v.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(g0, t0 + 0.002); g.gain.setTargetAtTime(0, t0 + 0.002, dur * 0.35);
    const bp = oc.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f1; bp.Q.value = 3;
    o.connect(g); g.connect(bp); bp.connect(d); o.start(t0); v.start(t0); o.stop(t0 + dur * 2.5); v.stop(t0 + dur * 2.5);
  }
  // 재질별 고유 진동표 (주파수 비는 실측 금속 부품처럼 비정수배)
  const M_SMALL = (f) => [[f, 0.022, 1], [f * 1.59, 0.016, 0.7], [f * 2.37, 0.012, 0.5], [f * 3.31, 0.008, 0.35], [f * 4.62, 0.006, 0.22]];   // 걸쇠·버튼·볼트 같은 작은 강철
  const M_RECV = (k = 1) => [[340 * k, 0.03, 0.55], [610 * k, 0.045, 0.8], [1040 * k, 0.04, 1], [1580 * k, 0.03, 0.75], [2260 * k, 0.022, 0.55], [3150 * k, 0.016, 0.4], [4400 * k, 0.01, 0.25]];   // 총몸
  const M_POLY = (k = 1) => [[420 * k, 0.012, 1], [760 * k, 0.01, 0.75], [1230 * k, 0.008, 0.5], [1900 * k, 0.006, 0.3]];   // 플라스틱 탄창
  const M_STEELMAG = (k = 1) => [[560 * k, 0.025, 0.8], [1180 * k, 0.022, 1], [1900 * k, 0.018, 0.7], [2950 * k, 0.012, 0.45], [4300 * k, 0.008, 0.3]];   // 강철 탄창(AK)
  const M_BRASS = (k = 1) => [[3800 * k, 0.05, 1], [6050 * k, 0.035, 0.6], [8400 * k, 0.022, 0.35]];
  const M_PISTOL = (k = 1) => [[880 * k, 0.02, 0.7], [1650 * k, 0.025, 1], [2550 * k, 0.018, 0.7], [3800 * k, 0.012, 0.45], [5200 * k, 0.008, 0.3]];
  const cloth = (o, b, t0, dur, g0, p = 0) => nz(o, pan(o, b, p), t0, dur, 'bandpass', 1100, 700, 0.9, g0, dur * 0.4);
  const MECH = {
    // 사격 때 겹치는 노리쇠 왕복(작게): 총몸 울림 + 작은 금속 부딪힘
    mech_rifle: (o, b) => { modal(o, b, 0, M_RECV(1.1), 0.45); tick(o, b, 0, 2500, 0.3); modal(o, b, 0.035, M_SMALL(2600), 0.4); body(o, b, 0.035, 210, 0.25, 0.04); },
    mech_smg: (o, b) => { modal(o, b, 0, M_RECV(1.35), 0.4); tick(o, b, 0, 3000, 0.3); modal(o, b, 0.026, M_SMALL(3100), 0.35); },
    mech_pistol: (o, b) => { modal(o, b, 0, M_PISTOL(1.05), 0.55); tick(o, b, 0, 3000, 0.35); modal(o, b, 0.024, M_SMALL(3300), 0.35); },
    mech_ak: (o, b) => { modal(o, b, 0, M_RECV(0.85), 0.55); body(o, b, 0, 160, 0.4, 0.05); tick(o, b, 0, 1800, 0.35); modal(o, b, 0.045, M_SMALL(2200), 0.45); body(o, b, 0.045, 180, 0.3, 0.05); },
    mech_lmg: (o, b) => { modal(o, b, 0, M_RECV(0.95), 0.5); tick(o, b, 0, 2200, 0.3); for (let i = 0; i < 3; i++) modal(o, b, 0.012 + i * 0.011, M_SMALL(3500 + i * 300), 0.15); body(o, b, 0.03, 170, 0.3, 0.04); },
    // ----- 탄창식 -----
    // 탄창 멈치 버튼: 작은 딸깍 + 탄창이 풀리며 살짝 떨어지는 소리
    magRelease: (o, b) => { tick(o, b, 0, 2600, 0.45, 0.002, -0.2); modal(o, b, 0, M_SMALL(2350), 0.5, -0.2); modal(o, b, 0.012, M_POLY(1.1), 0.35, -0.2); slide(o, b, 0.012, 0.03, 1500, 1100, 0.25, 0.6, -0.2); },
    // 탄창 빼기: 탄창이 탄창 우물을 긁으며 빠짐 → 빠지는 순간 '툭'
    magOut: (o, b) => { slide(o, b, 0, 0.1, 1700, 900, 0.5, 1, -0.25); modal(o, b, 0.095, M_POLY(), 0.55, -0.3); tick(o, b, 0.095, 1500, 0.25, 0.002, -0.3); cloth(o, b, 0.06, 0.16, 0.18, -0.35); },
    // 탄창 넣기: 긁으며 들어감 → 탄창이 우물에 닿음(둔탁) → 멈치가 걸림(밝은 '철컥')
    magIn: (o, b) => { slide(o, b, 0, 0.075, 900, 1600, 0.45, 1, -0.2); modal(o, b, 0.072, M_POLY(), 0.6, -0.15); body(o, b, 0.072, 190, 0.6, 0.05, -0.1); tick(o, b, 0.086, 3200, 0.55); tick(o, b, 0.0865, 6000, 0.25, 0.0012); modal(o, b, 0.086, M_SMALL(2450), 0.8); modal(o, b, 0.086, M_RECV(), 0.5); },
    // 탄창 바닥 치기: 손바닥 '퍽' + 총몸 전체 울림 + 멈치 떨림
    magSeat: (o, b) => { body(o, b, 0, 105, 1.5, 0.09, -0.1); nz(o, b, 0, 0.05, 'lowpass', 800, 300, 0.7, 0.6, 0.001); modal(o, b, 0.002, M_RECV(0.95), 0.6); modal(o, b, 0.006, M_SMALL(2600), 0.3); },
    // AK식: 강철 탄창 앞을 걸고 젖혀 넣기 → '철-컥' 두 단계
    magInAk: (o, b) => { slide(o, b, 0, 0.06, 1000, 1500, 0.45, 1.2, -0.2); modal(o, b, 0.055, M_STEELMAG(), 0.7, -0.15); tick(o, b, 0.055, 2200, 0.4); body(o, b, 0.055, 170, 0.35, 0.05); },
    magRock: (o, b) => { slide(o, b, 0, 0.04, 800, 1300, 0.3, 1, -0.1); tick(o, b, 0.04, 2400, 0.6); body(o, b, 0.04, 140, 1.3, 0.08); modal(o, b, 0.04, M_STEELMAG(0.95), 0.7); modal(o, b, 0.042, M_SMALL(2000), 0.8); modal(o, b, 0.042, M_RECV(0.85), 0.6); },
    // 장전손잡이: 걸쇠 풀림 → 노리쇠 뭉치가 스프링을 누르며 미끄러짐 → 끝에 닿음
    chargeBack: (o, b) => { tick(o, b, 0, 2200, 0.35, 0.002, 0.1); modal(o, b, 0, M_SMALL(2050), 0.35, 0.1); slide(o, b, 0.008, 0.1, 1200, 2300, 0.5, 1.2, 0.1); spring(o, b, 0.01, 1700, 3300, 0.1, 0.07, 0.1); modal(o, b, 0.105, M_RECV(1.05), 0.4, 0.1); tick(o, b, 0.105, 1800, 0.3, 0.002, 0.1); },
    // 놓기: 노리쇠가 스프링 힘으로 앞으로 '쾅' — 큰 충격 + 총몸 울림 + 스프링 '징' + 부품이 자리 잡는 떨림
    chargeFwd: (o, b) => { tick(o, b, 0, 1300, 0.9, 0.004); body(o, b, 0, 175, 1.3, 0.08); tick(o, b, 0.0005, 5200, 0.35, 0.0015); modal(o, b, 0, M_RECV(), 1.0); modal(o, b, 0.001, M_SMALL(3050), 0.6); spring(o, b, 0.002, 3200, 2800, 0.22, 0.1); for (const t of [0.018, 0.031, 0.047]) modal(o, b, t, M_SMALL(3400 + Math.random() * 900), 0.12); },
    // 권총 슬라이드
    slideBack: (o, b) => { slide(o, b, 0, 0.06, 1900, 2900, 0.45, 1.1, 0.05); spring(o, b, 0.005, 2100, 3600, 0.06, 0.06); modal(o, b, 0.058, M_PISTOL(), 0.35); },
    slideRelease: (o, b) => { tick(o, b, 0, 1800, 0.85, 0.003); body(o, b, 0, 260, 0.95, 0.05); tick(o, b, 0.0005, 5500, 0.35, 0.0015); modal(o, b, 0, M_PISTOL(), 1.0); modal(o, b, 0.001, M_SMALL(3500), 0.5); spring(o, b, 0.002, 3600, 3100, 0.12, 0.07); },
    // ----- 볼트 액션 -----
    boltUp: (o, b) => { tick(o, b, 0, 2400, 0.4, 0.002, 0.25); modal(o, b, 0, M_SMALL(2200), 0.55, 0.25); slide(o, b, 0.004, 0.035, 1400, 1800, 0.2, 0.7, 0.25); },
    boltBack: (o, b) => { slide(o, b, 0, 0.14, 1150, 700, 0.55, 0.7, 0.25); modal(o, b, 0.135, M_RECV(0.9), 0.45, 0.25); tick(o, b, 0.135, 1500, 0.3, 0.002, 0.25); },
    boltFwd: (o, b) => { slide(o, b, 0, 0.12, 700, 1250, 0.5, 0.7, 0.25); body(o, b, 0.115, 200, 0.5, 0.05, 0.2); modal(o, b, 0.115, M_RECV(0.95), 0.6, 0.2); tick(o, b, 0.115, 2000, 0.4); },
    boltDown: (o, b) => { tick(o, b, 0, 1800, 0.7, 0.003, 0.2); body(o, b, 0, 190, 1.0, 0.06, 0.2); tick(o, b, 0.0005, 5000, 0.3, 0.0015, 0.2); modal(o, b, 0, M_RECV(0.9), 0.75, 0.2); modal(o, b, 0, M_SMALL(2600), 0.6, 0.2); },
    roundIn: (o, b) => { slide(o, b, 0, 0.04, 1700, 2600, 0.3, 1, 0.15); modal(o, b, 0.035, M_BRASS(), 0.45, 0.1); tick(o, b, 0.035, 3000, 0.4); spring(o, b, 0.036, 2500, 3200, 0.05, 0.05); modal(o, b, 0.036, M_SMALL(2700), 0.35); },
    // ----- 펌프·관형 탄창 -----
    pumpBack: (o, b) => { slide(o, b, 0, 0.12, 950, 620, 0.6, 0.8, -0.15); modal(o, b, 0.11, M_RECV(0.8), 0.55, -0.1); tick(o, b, 0.11, 1600, 0.35); },
    pumpFwd: (o, b) => { slide(o, b, 0, 0.1, 620, 1050, 0.55, 0.8, -0.15); tick(o, b, 0.092, 1500, 0.7, 0.003); body(o, b, 0.092, 180, 1.0, 0.06); modal(o, b, 0.092, M_RECV(0.85), 0.85); modal(o, b, 0.094, M_SMALL(2400), 0.5); },
    shellIn: (o, b) => { slide(o, b, 0, 0.05, 950, 1500, 0.35, 0.8, -0.15); modal(o, b, 0.045, [[650, 0.03, 1], [1480, 0.022, 0.6], [2650, 0.014, 0.4]], 0.6, -0.1); tick(o, b, 0.047, 2600, 0.45); spring(o, b, 0.048, 1800, 2400, 0.06, 0.06); modal(o, b, 0.05, M_BRASS(0.8), 0.25); },
    // ----- 중절식(꺾는 총열) -----
    breakOpen: (o, b) => { tick(o, b, 0, 2300, 0.5, 0.002, 0.15); modal(o, b, 0, M_SMALL(2100), 0.6, 0.15); slide(o, b, 0.035, 0.08, 650, 420, 0.35, 0.5); body(o, b, 0.11, 140, 0.55, 0.06); modal(o, b, 0.11, M_RECV(0.75), 0.6); },
    breakClose: (o, b) => { tick(o, b, 0, 1200, 0.85, 0.004); body(o, b, 0, 120, 1.7, 0.09); tick(o, b, 0.0005, 4800, 0.3, 0.0015); modal(o, b, 0, M_RECV(0.72), 1.0); modal(o, b, 0.004, M_SMALL(1900), 0.7, 0.15); },
    shellEject: (o, b) => { body(o, b, 0, 480, 0.35, 0.03); nz(o, b, 0, 0.03, 'bandpass', 900, 600, 2, 0.5); modal(o, b, 0.012, [[1150, 0.012, 1], [2300, 0.008, 0.5]], 0.4); modal(o, b, 0.06, [[980, 0.01, 1], [2100, 0.007, 0.5]], 0.25); },
    // ----- 탄띠식(경기관총) -----
    coverOpen: (o, b) => { tick(o, b, 0, 2400, 0.45, 0.002, -0.1); modal(o, b, 0, M_SMALL(2300), 0.5, -0.1); slide(o, b, 0.02, 0.09, 900, 1400, 0.3, 0.6, -0.1); modal(o, b, 0.11, [[780, 0.03, 1], [1550, 0.024, 0.7], [2700, 0.016, 0.45]], 0.6, -0.1); body(o, b, 0.11, 170, 0.35, 0.05); },
    coverClose: (o, b) => { tick(o, b, 0, 1300, 0.85, 0.004); body(o, b, 0, 130, 1.6, 0.09); tick(o, b, 0.0005, 4800, 0.3, 0.0015); modal(o, b, 0, M_RECV(0.8), 1.0); modal(o, b, 0.006, M_SMALL(2100), 0.6); },
    boxOut: (o, b) => { cloth(o, b, 0, 0.14, 0.35, -0.3); slide(o, b, 0.01, 0.11, 700, 500, 0.4, 0.6, -0.3); modal(o, b, 0.1, M_POLY(0.7), 0.45, -0.3); for (let i = 0; i < 6; i++) modal(o, b, 0.06 + i * 0.019 + Math.random() * 0.01, M_BRASS(0.9 + Math.random() * 0.2), 0.12, -0.2); },
    boxIn: (o, b) => { slide(o, b, 0, 0.06, 600, 900, 0.35, 0.6, -0.25); body(o, b, 0.058, 150, 0.55, 0.06, -0.2); modal(o, b, 0.058, M_POLY(0.7), 0.6, -0.2); tick(o, b, 0.07, 2600, 0.4); modal(o, b, 0.07, M_SMALL(2500), 0.5); },
    boxSeat: (o, b) => { body(o, b, 0, 140, 0.6, 0.06, -0.15); modal(o, b, 0, M_POLY(0.75), 0.5, -0.15); tick(o, b, 0.01, 2500, 0.4); modal(o, b, 0.01, M_SMALL(2350), 0.45); },
    beltLay: (o, b) => { for (let i = 0; i < 8; i++) modal(o, b, i * 0.02 + Math.random() * 0.008, M_BRASS(0.85 + Math.random() * 0.25), 0.22 * (1 - i / 10)); slide(o, b, 0, 0.16, 2400, 3000, 0.15, 0.8); body(o, b, 0.15, 250, 0.25, 0.03); },
    // ----- v16 -----
    // Beryl: 새 강철 탄창이 헌 탄창·멈치를 '쾅' 치고 헌 탄창이 미끄러져 빠짐
    magKnock: (o, b) => { tick(o, b, 0, 2000, 0.8, 0.003, -0.15); modal(o, b, 0, M_STEELMAG(1.05), 0.9, -0.15); modal(o, b, 0.002, M_POLY(0.95), 0.5); body(o, b, 0, 170, 0.6, 0.05); slide(o, b, 0.012, 0.05, 1500, 900, 0.3, 1, -0.2); },
    // 떨어진 탄창이 바닥에: 둔탁한 '툭' + 안의 탄이 흔들리는 소리
    magDrop: (o, b) => { body(o, b, 0, 95, 0.9, 0.08); nz(o, b, 0, 0.06, 'lowpass', 700, 260, 0.7, 0.6, 0.002); modal(o, b, 0.004, M_POLY(0.8), 0.5); for (let i = 0; i < 3; i++) modal(o, b, 0.03 + i * 0.025, M_BRASS(0.7 + Math.random() * 0.2), 0.08); },
    // Tommy 드럼: 걸쇠 → 레일을 따라 무겁게 미끄러짐(속의 탄이 출렁) → 끝에 걸림
    drumLatch: (o, b) => { tick(o, b, 0, 2400, 0.5, 0.002, -0.2); modal(o, b, 0, M_SMALL(2100), 0.6, -0.2); },
    drumOut: (o, b) => { slide(o, b, 0, 0.16, 700, 500, 0.55, 0.9, -0.3); modal(o, b, 0.02, [[310, 0.05, 1], [690, 0.04, 0.7], [1240, 0.03, 0.5], [2100, 0.02, 0.3]], 0.5, -0.3); for (let i = 0; i < 4; i++) modal(o, b, 0.03 + i * 0.03, M_BRASS(0.8), 0.07, -0.25); },
    drumIn: (o, b) => { slide(o, b, 0, 0.12, 500, 800, 0.5, 0.9, -0.25); modal(o, b, 0.11, [[300, 0.06, 1], [650, 0.045, 0.7], [1200, 0.03, 0.5]], 0.8, -0.2); body(o, b, 0.11, 150, 0.8, 0.07, -0.15); },
    drumSeat: (o, b) => { tick(o, b, 0, 2200, 0.7, 0.003); modal(o, b, 0, M_SMALL(2300), 0.7); modal(o, b, 0.002, M_RECV(0.8), 0.6); body(o, b, 0, 130, 1.0, 0.07); },
    // Tommy 위 손잡이: 스프링을 누르며 당김 → 노리쇠가 뒤에 '딸깍' 걸림(열린 노리쇠라 앞으로 가지 않음)
    knobBack: (o, b) => { slide(o, b, 0, 0.09, 1000, 2000, 0.5, 1.1, 0.05); spring(o, b, 0.01, 1500, 2900, 0.09, 0.06); modal(o, b, 0.09, M_RECV(0.95), 0.55); tick(o, b, 0.09, 2600, 0.6); modal(o, b, 0.092, M_SMALL(2700), 0.6); },
    // DP-28 원판: 걸쇠 → 넓은 강판이 울리며 들림 / 얹힘 → 눌러 걸림
    panLatch: (o, b) => { tick(o, b, 0, 2600, 0.5, 0.002, -0.1); modal(o, b, 0, M_SMALL(2500), 0.55, -0.1); },
    panOff: (o, b) => { slide(o, b, 0, 0.07, 900, 600, 0.35, 0.6, -0.2); modal(o, b, 0.03, [[180, 0.09, 0.8], [420, 0.07, 1], [930, 0.05, 0.7], [1650, 0.035, 0.45], [2600, 0.02, 0.3]], 0.7, -0.2); cloth(o, b, 0.08, 0.14, 0.2, -0.3); },
    panOn: (o, b) => { modal(o, b, 0, [[180, 0.1, 0.8], [420, 0.08, 1], [930, 0.06, 0.7], [1650, 0.04, 0.45]], 0.75, -0.15); body(o, b, 0, 120, 0.7, 0.07); tick(o, b, 0.004, 1600, 0.4); },
    panSeat: (o, b) => { tick(o, b, 0, 2200, 0.7, 0.003); modal(o, b, 0, M_SMALL(2300), 0.65); body(o, b, 0, 140, 0.9, 0.06); modal(o, b, 0.003, M_RECV(0.85), 0.5); },
    // M16A4 노리쇠 멈치: 손바닥 '탁' → 노리쇠가 앞으로 '쾅'
    boltCatch: (o, b) => { nz(o, b, 0, 0.02, 'bandpass', 900, 700, 1, 0.4, 0.001); body(o, b, 0, 200, 0.5, 0.03); tick(o, b, 0.006, 1300, 0.9, 0.004); body(o, b, 0.006, 175, 1.3, 0.08); modal(o, b, 0.006, M_RECV(), 1.0); modal(o, b, 0.007, M_SMALL(3050), 0.6); spring(o, b, 0.008, 3200, 2800, 0.2, 0.1); },
    // Deagle 슬라이드 멈치: 작은 레버 딸깍 → 무거운 슬라이드가 닫힘
    slideStop: (o, b) => { tick(o, b, 0, 3000, 0.4, 0.002); modal(o, b, 0, M_SMALL(3200), 0.4); tick(o, b, 0.012, 1800, 0.85, 0.003); body(o, b, 0.012, 230, 1.1, 0.06); modal(o, b, 0.012, M_PISTOL(0.85), 1.0); spring(o, b, 0.014, 3400, 2900, 0.12, 0.07); },
    // Kar98k 클립: 홈에 꽂힘 → 엄지로 5발을 밀어 넣음(탄이 차례로 미끄러짐) → 빈 클립이 튕겨 나감
    clipIn: (o, b) => { slide(o, b, 0, 0.05, 2000, 2800, 0.35, 1.2, 0.15); tick(o, b, 0.048, 2600, 0.55); modal(o, b, 0.048, M_SMALL(2800), 0.6); modal(o, b, 0.05, M_BRASS(0.9), 0.2); },
    clipStrip: (o, b) => { for (let i = 0; i < 5; i++) { const t = i * 0.035; slide(o, b, t, 0.03, 1800, 1300, 0.18, 0.8, 0.1); modal(o, b, t + 0.025, M_BRASS(0.85 + i * 0.03), 0.22, 0.1); } spring(o, b, 0.02, 1400, 2200, 0.16, 0.07); tick(o, b, 0.17, 2200, 0.4); },
    clipEject: (o, b) => { modal(o, b, 0, [[2400, 0.04, 1], [3900, 0.03, 0.6], [6100, 0.02, 0.35]], 0.45, 0.2); tick(o, b, 0, 3500, 0.3); },
    // Win94 레버: 내림(노리쇠가 뒤로 미끄러짐) / 올림(앞으로 닫히며 '철컥') · 장전구로 한 발
    leverDown: (o, b) => { tick(o, b, 0, 2000, 0.45, 0.002, 0.15); slide(o, b, 0.005, 0.09, 900, 1500, 0.45, 0.9, 0.15); modal(o, b, 0.09, M_RECV(0.9), 0.55, 0.1); tick(o, b, 0.09, 1700, 0.4); },
    leverUp: (o, b) => { slide(o, b, 0, 0.08, 1500, 900, 0.4, 0.9, 0.15); tick(o, b, 0.075, 1400, 0.8, 0.003); body(o, b, 0.075, 190, 1.0, 0.06); modal(o, b, 0.075, M_RECV(0.95), 0.85); modal(o, b, 0.077, M_SMALL(2500), 0.6); },
    gateIn: (o, b) => { slide(o, b, 0, 0.045, 1600, 2300, 0.3, 1, 0.2); spring(o, b, 0.01, 1800, 2600, 0.06, 0.06, 0.2); tick(o, b, 0.042, 2800, 0.45); modal(o, b, 0.042, M_BRASS(0.95), 0.4); modal(o, b, 0.044, M_SMALL(2600), 0.4); },
    // ----- 그 밖 -----
    selector: (o, b) => { tick(o, b, 0, 2800, 0.45, 0.002, 0.2); modal(o, b, 0, M_SMALL(2900), 0.5, 0.2); tick(o, b, 0.045, 3000, 0.3, 0.002, 0.2); modal(o, b, 0.045, M_SMALL(3100), 0.32, 0.2); },
    equip: (o, b) => { cloth(o, b, 0, 0.2, 0.45); for (let i = 0; i < 3; i++) modal(o, b, 0.05 + i * 0.03 + Math.random() * 0.02, M_SMALL(3300 + Math.random() * 1200), 0.12); body(o, b, 0.15, 200, 0.4, 0.05); modal(o, b, 0.15, M_RECV(1.1), 0.4); },
    aimIn: (o, b) => { cloth(o, b, 0, 0.13, 0.4); modal(o, b, 0.1, M_RECV(1.2), 0.08); },
    attach: (o, b) => { slide(o, b, 0, 0.04, 1800, 2400, 0.25); tick(o, b, 0.04, 2600, 0.5); modal(o, b, 0.04, M_SMALL(2700), 0.6); modal(o, b, 0.045, M_RECV(1.2), 0.25); modal(o, b, 0.09, M_SMALL(3200), 0.35); },
    dry: (o, b) => { tick(o, b, 0, 2600, 0.55); modal(o, b, 0, M_SMALL(2900), 0.6); modal(o, b, 0.001, M_RECV(1.15), 0.18); },
    brass: (o, b) => { [0, 0.06 + Math.random() * 0.03, 0.12 + Math.random() * 0.05].forEach((t, i) => { const k = 1 - i * 0.3, f = 4100 + Math.random() * 600; os(o, b, t, 0.06, 'sine', f, f * 0.99, 0.4 * k); os(o, b, t, 0.04, 'sine', f * 1.53, f * 1.52, 0.25 * k); os(o, b, t, 0.03, 'sine', f * 2.24, f * 2.23, 0.15 * k); }); },
    hull: (o, b) => { thunk(o, b, 0.0, 420, 0.04, 0.6); metal(o, b, 0.0, [1500, 2400], 0.03, 0.4); thunk(o, b, 0.08, 380, 0.03, 0.3); },
  };
  // 소리별 상대 음량(최댓값) — 작은 딸깍과 노리쇠 '쾅'이 같은 크기로 들리지 않게
  const MPEAK = { magRelease: 0.4, magOut: 0.5, magIn: 0.78, magSeat: 0.85, magInAk: 0.7, magRock: 0.9, chargeBack: 0.6, chargeFwd: 0.95, slideBack: 0.5, slideRelease: 0.88,
    boltUp: 0.5, boltBack: 0.62, boltFwd: 0.72, boltDown: 0.85, roundIn: 0.55, pumpBack: 0.65, pumpFwd: 0.88, shellIn: 0.6, breakOpen: 0.7, breakClose: 0.95, shellEject: 0.5,
    coverOpen: 0.65, coverClose: 0.95, boxOut: 0.6, boxIn: 0.75, boxSeat: 0.7, beltLay: 0.55, selector: 0.45, equip: 0.6, aimIn: 0.35, attach: 0.6, dry: 0.55,
    mech_rifle: 0.8, mech_smg: 0.8, mech_pistol: 0.8, mech_ak: 0.8, mech_lmg: 0.8,
    magKnock: 0.85, magDrop: 0.6, drumLatch: 0.45, drumOut: 0.65, drumIn: 0.8, drumSeat: 0.85, knobBack: 0.7, panLatch: 0.45, panOff: 0.6, panOn: 0.75, panSeat: 0.85,
    boltCatch: 0.95, slideStop: 0.9, clipIn: 0.6, clipStrip: 0.65, clipEject: 0.45, leverDown: 0.65, leverUp: 0.9, gateIn: 0.55 };
  // 장전 한 번에 한 번만 나는 v16 소리는 1가지로 (시작할 때 소리 만드는 시간 절약). 매 발 반복되는 레버·장전구는 2가지
  const ONE_VAR = new Set(['magKnock', 'magDrop', 'drumLatch', 'drumOut', 'drumIn', 'drumSeat', 'knobBack', 'panLatch', 'panOff', 'panOn', 'panSeat', 'boltCatch', 'slideStop', 'clipIn', 'clipStrip', 'clipEject']);
  // ---------- 줍기·회복·넘기·투척 효과음 재료 ----------
  const swish = (o, b, t0, dur, f0, f1, g0) => nz(o, b, t0, dur, 'bandpass', f0, f1, 1.2, g0, dur * 0.45);           // 옷·팔 스치는 소리
  function zipper(o, b, t0, dur, f0, g0) { const n = Math.round(dur / 0.011); for (let i = 0; i < n; i++) nz(o, b, t0 + i * dur / n * (0.9 + Math.random() * 0.2), 0.006, 'bandpass', f0 * (1 + i / n * 0.35), f0, 2.5, g0 * (0.6 + Math.random() * 0.4), 0.0005); }
  function crinkle(o, b, t0, dur, g0) { const n = Math.round(dur * 70); for (let i = 0; i < n; i++) nz(o, b, t0 + Math.random() * dur, 0.004 + Math.random() * 0.01, 'highpass', 2500 + Math.random() * 4000, 2500, 0.8, g0 * Math.random(), 0.0004); }
  function velcro(o, b, t0, dur, g0) { const n = Math.round(dur / 0.005); for (let i = 0; i < n; i++) nz(o, b, t0 + i * dur / n, 0.006, 'bandpass', 1800 + Math.random() * 2400, 2000, 1.4, g0 * (0.35 + Math.random() * 0.65) * Math.sin(Math.PI * (i + 0.5) / n), 0.0004); }
  function gulp(o, b, t0, g0) { os(o, b, t0, 0.09, 'sine', 210, 120, g0, 0.006); nz(o, b, t0, 0.08, 'lowpass', 500, 260, 1.2, g0 * 0.6, 0.005); }
  function rattle(o, b, t0, n, f0, g0) { for (let i = 0; i < n; i++) metal(o, b, t0 + i * 0.018 + Math.random() * 0.012, [f0 * (0.85 + Math.random() * 0.3), f0 * 1.6 * (0.9 + Math.random() * 0.2)], 0.025, g0 * (1 - i / n * 0.5)); }
  const SFX = {
    // 줍기: 물건 종류마다 다른 소리
    pk_ammo: (o, b) => { swish(o, b, 0, 0.12, 700, 1300, 0.25); rattle(o, b, 0.05, 6, 3600, 0.38); thunk(o, b, 0.06, 260, 0.05, 0.35); },
    pk_shell: (o, b) => { swish(o, b, 0, 0.12, 700, 1300, 0.25); for (let i = 0; i < 4; i++) thunk(o, b, 0.05 + i * 0.03, 520 + Math.random() * 160, 0.03, 0.3); nz(o, b, 0.05, 0.1, 'bandpass', 1600, 1200, 2, 0.2); },
    pk_gun: (o, b) => { swish(o, b, 0, 0.2, 500, 1400, 0.45); thunk(o, b, 0.13, 130, 0.09, 0.8); metal(o, b, 0.13, [1500, 2600, 3900], 0.09, 0.7); metal(o, b, 0.24, [4200, 6100], 0.05, 0.25); metal(o, b, 0.29, [3900, 5800], 0.04, 0.18); },
    pk_pistol: (o, b) => { swish(o, b, 0, 0.12, 700, 1600, 0.3); metal(o, b, 0.09, [2400, 4100, 6200], 0.06, 0.6); thunk(o, b, 0.09, 220, 0.05, 0.45); },
    pk_cloth: (o, b) => { swish(o, b, 0, 0.14, 900, 1700, 0.25); crinkle(o, b, 0.04, 0.22, 0.32); thunk(o, b, 0.2, 300, 0.03, 0.15); },
    pk_kit: (o, b) => { swish(o, b, 0, 0.16, 600, 1300, 0.35); thunk(o, b, 0.1, 160, 0.07, 0.6); zipper(o, b, 0.16, 0.14, 2600, 0.22); },
    pk_medkit: (o, b) => { swish(o, b, 0, 0.16, 500, 1200, 0.35); thunk(o, b, 0.1, 120, 0.09, 0.85); nz(o, b, 0.1, 0.06, 'bandpass', 900, 700, 4, 0.35); metal(o, b, 0.2, [2000, 3400], 0.04, 0.4); metal(o, b, 0.26, [2100, 3500], 0.04, 0.35); },
    pk_can: (o, b) => { swish(o, b, 0, 0.1, 800, 1500, 0.2); metal(o, b, 0.07, [2500, 4300, 7000], 0.16, 0.55); nz(o, b, 0.1, 0.22, 'lowpass', 520, 380, 3, 0.22, 0.04); },
    pk_armor: (o, b) => { swish(o, b, 0, 0.3, 350, 1000, 0.55); thunk(o, b, 0.16, 90, 0.14, 0.9); velcro(o, b, 0.28, 0.2, 0.32); },
    pk_helmet: (o, b) => { swish(o, b, 0, 0.14, 600, 1300, 0.3); thunk(o, b, 0.11, 300, 0.06, 0.6); nz(o, b, 0.11, 0.18, 'bandpass', 880, 860, 7, 0.5, 0.001); metal(o, b, 0.22, [3000, 4700], 0.03, 0.3); },
    pk_bag: (o, b) => { swish(o, b, 0, 0.25, 400, 1100, 0.45); thunk(o, b, 0.15, 110, 0.1, 0.6); zipper(o, b, 0.24, 0.3, 2300, 0.24); },
    pk_att: (o, b) => { swish(o, b, 0, 0.1, 900, 1600, 0.2); metal(o, b, 0.07, [3200, 5200], 0.04, 0.55); thunk(o, b, 0.07, 260, 0.04, 0.35); metal(o, b, 0.14, [2600, 4400], 0.05, 0.4); },
    pk_nade: (o, b) => { swish(o, b, 0, 0.12, 700, 1400, 0.25); thunk(o, b, 0.08, 180, 0.06, 0.55); metal(o, b, 0.08, [3000, 4800, 7200], 0.07, 0.45); metal(o, b, 0.16, [5200, 7900], 0.04, 0.2); },
    // 회복: 붕대(찢고 감기) / 구급상자(지퍼·테이프) / 의료 키트(걸쇠·주사) / 음료(따기·마시기)
    heal_bandage: (o, b) => { crinkle(o, b, 0, 0.18, 0.4); velcro(o, b, 0.22, 0.28, 0.36); for (let i = 0; i < 3; i++) swish(o, b, 0.65 + i * 0.42, 0.3, 700, 1500, 0.32); },
    heal_kit: (o, b) => { zipper(o, b, 0, 0.42, 2400, 0.3); swish(o, b, 0.5, 0.3, 600, 1300, 0.35); crinkle(o, b, 0.8, 0.3, 0.3); velcro(o, b, 1.25, 0.25, 0.3); },
    heal_medkit: (o, b) => { metal(o, b, 0, [2000, 3400], 0.04, 0.55); metal(o, b, 0.07, [2100, 3500], 0.04, 0.5); thunk(o, b, 0.16, 140, 0.1, 0.7); swish(o, b, 0.3, 0.35, 500, 1200, 0.35); metal(o, b, 0.9, [4200, 6900], 0.03, 0.35); nz(o, b, 0.95, 0.4, 'highpass', 5000, 5000, 0.7, 0.12, 0.05); },
    heal_drink: (o, b) => { metal(o, b, 0, [1900, 3300], 0.03, 0.6); nz(o, b, 0.012, 0.03, 'highpass', 2500, 2500, 0.7, 0.6, 0.0005); nz(o, b, 0.02, 0.7, 'highpass', 4200, 6000, 0.7, 0.22, 0.01); for (const t of [0.95, 1.38, 1.8]) gulp(o, b, t, 0.55); },
    heal_done: (o, b) => { swish(o, b, 0, 0.2, 600, 1300, 0.3); thunk(o, b, 0.12, 180, 0.05, 0.35); },
    // 넘기·착지
    vault: (o, b) => { swish(o, b, 0, 0.3, 400, 1400, 0.5); thunk(o, b, 0.09, 170, 0.06, 0.6); nz(o, b, 0.09, 0.012, 'highpass', 2200, 2200, 0.8, 0.35, 0.0005); swish(o, b, 0.22, 0.2, 900, 600, 0.25); },
    land: (o, b) => { thunk(o, b, 0, 85, 0.16, 1.0); nz(o, b, 0, 0.12, 'lowpass', 600, 220, 0.8, 0.6, 0.002); swish(o, b, 0.01, 0.18, 800, 500, 0.3); nz(o, b, 0.02, 0.1, 'bandpass', 1800, 1400, 1.5, 0.2, 0.002); },
    roll: (o, b) => { swish(o, b, 0, 0.45, 300, 900, 0.5); thunk(o, b, 0.12, 110, 0.1, 0.55); thunk(o, b, 0.34, 100, 0.08, 0.45); },
    // 수류탄: 핀 뽑기 / 안전손잡이 튕김 + 팔 휘두름 / 바닥에 튕김
    pin: (o, b) => { scrape(o, b, 0, 0.05, 2600, 3600, 0.3); metal(o, b, 0.045, [3800, 5600, 8200], 0.12, 0.6); metal(o, b, 0.06, [2900, 4700], 0.05, 0.3); },
    spoon: (o, b) => { swish(o, b, 0, 0.22, 500, 1600, 0.45); metal(o, b, 0.03, [2400, 4700, 6900], 0.18, 0.45); },
    nadeBounce: (o, b) => { thunk(o, b, 0, 240, 0.05, 0.7); metal(o, b, 0, [1700, 2900, 4300], 0.06, 0.45); },
  };
  const MECH_SEC = { heal_bandage: 1.9, heal_kit: 1.7, heal_medkit: 1.45, heal_drink: 2.05, vault: 0.5, land: 0.3, roll: 0.55, pin: 0.25, spoon: 0.35, pk_armor: 0.55, pk_bag: 0.6, pk_gun: 0.4, pk_cloth: 0.32, pk_kit: 0.36, pk_medkit: 0.36, pk_can: 0.36 };
  Object.assign(MECH, SFX);
  async function renderBank() {
    if (!(window.OfflineAudioContext || window.webkitOfflineAudioContext)) return;
    // 소리마다 첫 번째 버전을 먼저 모두 만들고(그 소리는 바로 쓸 수 있음), 두 번째 이후 버전은 나중에 → 총이 많아져도 시작 직후 빈 소리 구간이 짧다
    const first = [], rest = [];
    for (const id in GUN) for (let v = 0; v < 2; v++) (v ? rest : first).push(['g_' + id, GUN[id].sec || 1.5, shotGraph(GUN[id]), 0.95, 1.15]);
    for (const k in MECH) { const n = k === 'brass' ? 3 : ONE_VAR.has(k) ? 1 : (k.startsWith('mech') || MPEAK[k] ? 2 : 1); for (let v = 0; v < n; v++) (v ? rest : first).push([k, MECH_SEC[k] || (k === 'equip' ? 0.35 : MPEAK[k] ? 0.45 : 0.25), MECH[k], MPEAK[k] || 0.8, 0]); }
    for (const [name, sec, fn, peak, loud] of first.concat(rest)) { const b = await render(sec, fn, peak, loud); (bank[name] || (bank[name] = [])).push(b); }
    bankReady = true;
  }

  // ---------- 실시간 합성 (뱅크 준비 전·발소리·UI 등) ----------
  function spatial(pos, base, range) {
    let gain = base, pan = 0, cutoff = 18000;
    if (pos) { const r = geom(pos); if (r.d > range) return null; gain = base / (1 + r.d / 14) * (1 - r.d / range); pan = r.pan; cutoff = clamp(18000 / (1 + r.d / 40), 700, 18000); if (gain < 0.004) return null; }
    return chain(gain, pan, cutoff, 0, false);
  }
  function noise(out, t0, dur, type, freq, q, g0) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t0, Math.random()); src.stop(t0 + dur + 0.02);
  }
  function tone(out, t0, dur, type, f0, f1, g0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const CLS_ID = { AR: 'm416', SMG: 'vk9', SG: 's12k', DMR: 'mini14', SR: 'm24', PISTOL: 'p19', LMG: 'm249' };
  // ---------- 차량 엔진 (실시간 합성, 차량별 목소리) ----------
  //  톱니파(기본) + 반 옥타브 아래 사각파(점화 펄스) + 흡배기 잡음 → 포화 → 저역통과. rpm은 기어 변속을 흉내 낸 값
  const ENG = {
    sedan: { f0: 34, f1: 92, lp: 950, g: 0.2, w2: 'square' },
    pickup: { f0: 28, f1: 78, lp: 820, g: 0.24, w2: 'square' },
    uaz: { f0: 24, f1: 66, lp: 700, g: 0.27, w2: 'sawtooth' },
    moto: { f0: 50, f1: 165, lp: 1800, g: 0.19, w2: 'square' },
  };
  const engines = new Map();
  function stopEng(id, e) { engines.delete(id); if (!ctx) return; e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => e.nodes.forEach((n) => { try { n.stop(); } catch (_) {} }), 600); }

  const api = {
    init, applyVolumes, setListener,
    get ready() { return !!ctx; }, get bankReady() { return bankReady; }, get _bank() { return bank; },
    // weapon: 무기 id (또는 예전 방식의 계열 이름)
    gunshot(pos, weapon, isOwn, indoor) {
      if (!ctx) return;
      const id = GUN[weapon] ? weapon : (CLS_ID[weapon] || 'm416'), P = GUN[id];
      if (bank['g_' + id]) {
        const d = isOwn ? 0 : geom(pos).d;
        const send = isOwn ? (indoor ? 0.6 : 0.4) : clamp(0.3 + d / 260, 0.3, 1.15);
        playBuf('g_' + id, isOwn ? null : pos, isOwn ? P.own : P.gain, { own: isOwn, sonic: true, range: P.range, ref: 18, lpRef: 75, send, room: indoor && d < 80, jitter: 0.05, vdur: 0.6 });
        if (isOwn && P.mech) playBuf(P.mech, null, 0.32, { own: true, jitter: 0.08, at: 0.012 });
        return;
      }
      if (!voice(0.4)) return;
      const out = spatial(isOwn ? null : pos, P.gain * (isOwn ? 0.55 : 1), 650); if (!out) return;
      const t = ctx.currentTime;
      noise(out, t, P.bd + 0.05, 'bandpass', P.hp * 0.6, 0.7, 1.0); noise(out, t, P.bd * 0.5, 'lowpass', 600, 0.5, 0.8); tone(out, t, 0.12, 'sine', P.tf, 40, 0.9);
    },
    // 장전·볼트·펌프 등 기계음. weapon id로 피치를 살짝 바꿔 무기마다 다른 질감
    mech(name, pos, weapon, isOwn) {
      if (!ctx || !bank[name]) return;
      const rate = { m416: 1, aug: 1.05, akm: 0.88, asm: 0.95, vk9: 1.1, mini14: 1.02, slr: 0.9, m24: 1, awm: 0.92, s686: 1, s12k: 0.9, m249: 0.95, mg3: 0.88, p19: 1.14,
        beryl: 0.9, m16a4: 1.0, vector: 1.12, bizon: 1.04, tommy: 0.86, kar98k: 0.97, win94: 1.0, s1897: 0.95, dp28: 0.84, deagle: 0.8 }[weapon] || 1;
      playBuf(name, isOwn ? null : pos, isOwn ? 0.72 : 0.7, { own: isOwn, rate, range: 26, ref: 4, send: isOwn ? 0.1 : 0.2, room: listener.indoor > 0.5, jitter: 0.04 });
    },
    brass(pos, kind) {
      if (!ctx) return;
      if (kind && kind.startsWith('mag:')) { playBuf('magDrop', pos, 0.5, { range: 26, ref: 3, jitter: 0.1, send: 0.1 }); return; }   // 떨어뜨린 탄창
      if (!throttle('brass', 0.05)) return; playBuf(kind === 'hull' ? 'hull' : 'brass', pos, 0.32, { range: 22, ref: 3, jitter: 0.15, send: 0.08 });
    },
    impact(pos, flesh) {
      if (!ctx || !throttle('imp', 0.03) || !voice(0.1)) return;
      const out = spatial(pos, flesh ? 0.5 : 0.35, 60); if (!out) return;
      const t = ctx.currentTime;
      if (flesh) noise(out, t, 0.09, 'lowpass', 900, 1, 1); else { noise(out, t, 0.07, 'highpass', 2800, 1, 0.8); tone(out, t, 0.05, 'sine', 2600 + Math.random() * 1500, 1800, 0.12); }
    },
    // 주먹: 'swing' = 휘두르는 바람(대역 잡음이 위로 쓸렸다 내려감) / 'hit' = 몸통 울림(저역 사인) + 둔탁한 퍽 + 살 맞는 찰싹
    punch(pos, kind, own) {
      const hit = kind === 'hit', range = hit ? 45 : 22;
      if (!ctx || (!own && geom(pos).d > range) || (hit && !throttle('punch', 0.04)) || !voice(0.2)) return;   // 먼 주먹은 목소리 자리를 차지하지 않게
      const out = spatial(own ? null : pos, hit ? 0.62 : (own ? 0.16 : 0.22), range); if (!out) return;
      const t = ctx.currentTime, j = 0.9 + Math.random() * 0.2;
      if (hit) { tone(out, t, 0.12, 'sine', 125 * j, 52, 0.9); noise(out, t, 0.07, 'lowpass', 1100 * j, 0.9, 0.9); noise(out, t, 0.025, 'bandpass', 2400 * j, 1.4, 0.45); return; }
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = j;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(480 * j, t); f.frequency.exponentialRampToValueAtTime(1500 * j, t + 0.08); f.frequency.exponentialRampToValueAtTime(650 * j, t + 0.17);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.055); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + 0.2);
    },
    hitmarker() { if (!ctx) return; const t = ctx.currentTime; tone(sfxBus, t, 0.06, 'square', 1800, 1500, 0.08); },
    headshot() { if (!ctx) return; const t = ctx.currentTime; tone(sfxBus, t, 0.09, 'square', 2600, 2200, 0.09); },
    hurt() { if (!ctx || !throttle('hurt', 0.12)) return; const t = ctx.currentTime; noise(sfxBus, t, 0.18, 'lowpass', 400, 1, 0.5); },
    step(pos, surface, isOwn, loud) {
      if (!ctx || !voice(0.08)) return;
      const out = spatial(isOwn ? null : pos, (isOwn ? 0.12 : 0.35) * (loud || 1), 30); if (!out) return;
      const t = ctx.currentTime;
      if (surface === 'hard') noise(out, t, 0.06, 'bandpass', 1800, 2, 0.8);
      else if (surface === 'water') noise(out, t, 0.18, 'lowpass', 900, 0.7, 0.8);
      else noise(out, t, 0.08, 'lowpass', 700, 0.8, 0.9);
    },
    reload() {},
    dryfire() { if (!ctx || !throttle('dry', 0.2)) return; if (!playBuf('dry', null, 0.5, { own: true })) { const t = ctx.currentTime; noise(sfxBus, t, 0.03, 'highpass', 4000, 2, 0.3); } },
    // 줍기: kind = ammo/shell/gun/pistol/cloth/kit/medkit/can/armor/helmet/bag/att/nade · 다른 캐릭터는 위치에서 작게
    pickup(kind, pos, own = true) {
      if (!ctx) return;
      if (!playBuf('pk_' + (kind || 'att'), own ? null : pos, own ? 0.62 : 0.55, { own, range: 22, ref: 3, send: own ? 0.05 : 0.12, room: listener.indoor > 0.5, jitter: 0.08 })) {
        if (!own) return; const t = ctx.currentTime; tone(sfxBus, t, 0.06, 'triangle', 500, 700, 0.1); noise(sfxBus, t, 0.08, 'bandpass', 1500, 1, 0.12);
      }
    },
    attach() { if (!playBuf('attach', null, 0.6, { own: true })) api.pickup('att'); },
    ui() { if (!ctx) return; const t = ctx.currentTime; tone(sfxBus, t, 0.05, 'triangle', 700, 760, 0.1); },
    // 팀 핑: 이동(올라가는 두 음) / 공격(짧고 높은 경고음 두 번) / 모여(내려가는 두 음)
    ping(kind) {
      if (!ctx) return; const t = ctx.currentTime;
      if (kind === 'attack') { tone(sfxBus, t, 0.07, 'square', 1250, 1200, 0.09); tone(sfxBus, t + 0.1, 0.07, 'square', 1250, 1200, 0.09); }
      else if (kind === 'danger') { for (let i = 0; i < 3; i++) tone(sfxBus, t + i * 0.09, 0.07, 'sawtooth', 880, 860, 0.08); }
      else if (kind === 'follow') { tone(sfxBus, t, 0.08, 'sine', 990, 980, 0.16); tone(sfxBus, t + 0.09, 0.1, 'sine', 740, 730, 0.16); }
      else { tone(sfxBus, t, 0.08, 'sine', 740, 760, 0.16); tone(sfxBus, t + 0.09, 0.1, 'sine', 990, 1010, 0.16); }
    },
    // 리콜 타워 단말기: 등록 시작(짧은 두 음) · 완료(올라가는 세 음 + 전파 잡음) · 실패(낮은 경고음)
    recall(kind) {
      if (!ctx) return; const t = ctx.currentTime;
      if (kind === 'done') { for (let i = 0; i < 3; i++) tone(sfxBus, t + i * 0.11, 0.1, 'sine', 660 + i * 220, 680 + i * 220, 0.14); noise(sfxBus, t + 0.34, 0.3, 'bandpass', 2600, 2, 0.05); }
      else if (kind === 'fail') tone(sfxBus, t, 0.16, 'square', 320, 290, 0.08);
      else { tone(sfxBus, t, 0.06, 'square', 880, 880, 0.07); tone(sfxBus, t + 0.08, 0.06, 'square', 1175, 1175, 0.07); }
    },
    zoneWarn() { if (!ctx) return; const t = ctx.currentTime; tone(sfxBus, t, 0.25, 'sawtooth', 440, 430, 0.12); tone(sfxBus, t + 0.3, 0.35, 'sawtooth', 330, 320, 0.12); },
    zoneTick() { if (!ctx || !throttle('ztick', 0.9)) return; const t = ctx.currentTime; tone(sfxBus, t, 0.12, 'sine', 160, 120, 0.25); },
    explosion(pos) {
      if (!ctx || !voice(1.5)) return;
      const r = geom(pos), delay = Math.min(r.d / 343, 1.8);
      const out = chain(1.3 / (1 + r.d / 30), r.pan, clamp(9000 / (1 + r.d / 60), 300, 9000), clamp(0.4 + r.d / 200, 0.4, 1.2), false);
      const t = ctx.currentTime + delay; noise(out, t, 1.1, 'lowpass', 500, 0.6, 1.2); tone(out, t, 0.6, 'sine', 90, 30, 1.2);
    },
    pin(pos, own = true) { if (!ctx) return; if (!playBuf('pin', own ? null : pos, own ? 0.6 : 0.5, { own, range: 20, ref: 3 })) { const t = ctx.currentTime; tone(sfxBus, t, 0.04, 'square', 2400, 2400, 0.06); } },
    spoon(pos, own = true) { if (!ctx) return; playBuf('spoon', own ? null : pos, own ? 0.55 : 0.5, { own, range: 25, ref: 3 }); },
    nadeBounce(pos) { if (!ctx || !throttle('nb', 0.06)) return; playBuf('nadeBounce', pos, 0.6, { range: 40, ref: 5, send: 0.1 }); },
    // 회복: phase 'start'(아이템별) / 'done'
    heal(id, phase, pos, own = true) {
      if (!ctx) return;
      const name = phase === 'done' ? 'heal_done' : 'heal_' + ({ bandage: 'bandage', firstaid: 'kit', medkit: 'medkit', drink: 'drink' }[id] || 'kit');
      if (!playBuf(name, own ? null : pos, own ? 0.55 : 0.5, { own, range: 18, ref: 3, send: 0.06, room: listener.indoor > 0.5, jitter: 0.04 }) && own) { const t = ctx.currentTime; noise(sfxBus, t, 0.3, 'bandpass', 2400, 1, 0.12); }
    },
    vault(pos, own = true) { if (!ctx) return; playBuf('vault', own ? null : pos, own ? 0.55 : 0.5, { own, range: 25, ref: 3, send: 0.05 }); },
    land(pos, own, k) { if (!ctx) return; playBuf(k > 1.2 ? 'roll' : 'land', own ? null : pos, (own ? 0.4 : 0.5) * clamp(k, 0.4, 1.4), { own, range: 30, ref: 4, send: 0.05 }); },
    death(pos) { if (!ctx) return; const out = spatial(pos, 0.5, 80); if (!out) return; const t = ctx.currentTime; tone(out, t, 0.4, 'sine', 180, 60, 0.4); },
    win() { if (!ctx) return; const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(sfxBus, t + i * 0.14, 0.5, 'triangle', f, f, 0.2)); },
    // 상점 뽑기: start(상자 울림) · tick(빛 단계 상승) · open(뚜껑 터짐 + 등급만큼 화음) · show(결과) · small(작은 보상)
    gacha(ph, tier = 3) {
      if (!ctx) return; const t = ctx.currentTime, T = clamp(tier | 0, 0, 5);
      if (ph === 'start') { noise(sfxBus, t, 1.6 + T * 0.4, 'lowpass', 140, 0.8, 0.32); tone(sfxBus, t, 1.4, 'sine', 52, 74, 0.22); }
      else if (ph === 'tick') { const f = [440, 494, 523, 659, 784, 988][T]; tone(sfxBus, t, 0.28, 'triangle', f, f * 1.01, 0.17); tone(sfxBus, t, 0.4, 'sine', f * 2, f * 2, 0.05); noise(sfxBus, t, 0.14, 'highpass', 3200, 1, 0.07); }
      else if (ph === 'open') {
        noise(sfxBus, t, 0.55, 'bandpass', 900, 0.6, 0.5); noise(sfxBus, t, 1.5, 'highpass', 5200, 0.7, 0.14); tone(sfxBus, t, 0.5, 'sine', 90, 40, 0.4);
        const base = [262, 262, 294, 392, 440, 523][T]; [1, 1.26, 1.5, 2, 2.52].slice(0, Math.max(2, T)).forEach((m, i) => tone(sfxBus, t + 0.05 + i * 0.07, 1.3, 'triangle', base * m, base * m, 0.13));
      }
      else if (ph === 'show') { [784, 988, 1175].forEach((f, i) => tone(sfxBus, t + i * 0.09, 0.45, 'triangle', f, f, 0.09)); }
      else if (ph === 'small') { [880, 1318].forEach((f, i) => tone(sfxBus, t + i * 0.08, 0.25, 'triangle', f, f, 0.1)); }
    },
    // 총기 스킨(울트라레어) 효과음: draw(빛 띠가 올라가며 나타남) · holster(내려가며 사라짐) · shot(종류별로 총성에 얹는 소리) · hit(맞힘) · kill(처치)
    //  lite: 슈퍼레어(약한 효과) — 작게, 처치도 맞힘 소리 정도로
    skinFx(ph, kind, pos, own, lite) {
      if (!ctx) return;
      let out = own ? sfxBus : spatial(pos, ph === 'kill' && !lite ? 1.1 : 0.9, ph === 'kill' && !lite ? 140 : 60); if (!out) return;
      if (lite) { const gn = ctx.createGain(); gn.gain.value = 0.5; gn.connect(out); out = gn; if (ph === 'kill') ph = 'hit'; }
      const t = ctx.currentTime;
      if (ph === 'draw' || ph === 'holster') {
        if (!throttle('skin' + ph, 0.12) || !voice(0.5)) return;
        const up = ph === 'draw', f0 = up ? 520 : 1700, f1 = up ? 1900 : 420;
        tone(out, t, 0.42, 'triangle', f0, f1, 0.07); tone(out, t + 0.03, 0.36, 'sine', f0 * 2, f1 * 2, 0.04);
        noise(out, t, 0.38, 'bandpass', up ? 2600 : 1800, 0.8, 0.09);
        if (kind === 'ember' || kind === 'flame') noise(out, t, 0.45, 'lowpass', 380, 0.7, 0.16);
        else if (kind === 'spark') { tone(out, t + 0.05, 0.06, 'square', 2400, 900, 0.035); tone(out, t + 0.16, 0.05, 'square', 3100, 1200, 0.03); }
        else if (kind === 'glitch') for (let i = 0; i < 4; i++) tone(out, t + i * 0.07, 0.035, 'square', 300 + Math.random() * 1500, 200 + Math.random() * 900, 0.035);
        else if (kind === 'frost') [2093, 2637, 3136].forEach((f, i) => tone(out, t + 0.04 + i * 0.06, 0.25, 'sine', f, f * 1.01, 0.035));
        else if (kind === 'void') { tone(out, t, 0.45, 'sine', up ? 70 : 140, up ? 140 : 60, 0.16); noise(out, t, 0.4, 'lowpass', 500, 0.8, 0.1); }
        return;
      }
      // 맞힘: 총성에 묻히지 않게 짧고 높은 소리 (지글 · 화르륵 · 지직 · 삑)
      if (ph === 'hit') {
        if (!throttle('skinhit', 0.06) || !voice(0.2)) return;
        if (kind === 'ember') { noise(out, t, 0.14, 'highpass', 3200, 0.7, 0.07); noise(out, t, 0.09, 'lowpass', 700, 0.7, 0.06); }
        else if (kind === 'flame') noise(out, t, 0.18, 'bandpass', 900, 0.9, 0.1);
        else if (kind === 'spark') { tone(out, t, 0.05, 'square', 2600 + Math.random() * 900, 650, 0.035); noise(out, t, 0.05, 'highpass', 6000, 0.9, 0.06); }
        else if (kind === 'glitch') { tone(out, t, 0.03, 'square', 1200 + Math.random() * 1400, 300, 0.035); tone(out, t + 0.035, 0.025, 'square', 2400 + Math.random() * 800, 900, 0.025); }
        else if (kind === 'frost') { noise(out, t, 0.06, 'highpass', 5200, 1.2, 0.08); tone(out, t, 0.12, 'sine', 3300 + Math.random() * 600, 2800, 0.03); }
        else if (kind === 'void') { tone(out, t, 0.12, 'sine', 900, 160, 0.06); noise(out, t, 0.1, 'lowpass', 600, 0.8, 0.06); }
        return;
      }
      // 처치: 크게 (용암 분출 · 불꽃 용의 포효 · 낙뢰 · 데이터 붕괴)
      if (ph === 'kill') {
        if (!throttle('skinkill', 0.15) || !voice(1.4)) return;
        if (kind === 'ember') {
          tone(out, t, 0.7, 'sine', 90, 34, 0.38); noise(out, t, 0.9, 'lowpass', 300, 0.8, 0.32);
          noise(out, t + 0.05, 1.1, 'highpass', 3600, 0.7, 0.07); for (let i = 0; i < 5; i++) noise(out, t + 0.25 + i * 0.13, 0.08, 'bandpass', 1400 + Math.random() * 1600, 2, 0.06);
        } else if (kind === 'flame') {
          tone(out, t, 0.9, 'sawtooth', 110, 52, 0.07); noise(out, t, 1.1, 'bandpass', 520, 0.7, 0.3); noise(out, t + 0.15, 0.8, 'lowpass', 1600, 0.6, 0.15);
          tone(out, t + 0.85, 0.45, 'sine', 140, 48, 0.24); noise(out, t + 0.85, 0.45, 'lowpass', 600, 0.8, 0.25);
        } else if (kind === 'spark') {
          noise(out, t, 0.12, 'highpass', 1800, 0.6, 0.4); tone(out, t, 0.14, 'square', 3400, 300, 0.06);
          noise(out, t + 0.06, 1.6, 'lowpass', 160, 0.7, 0.4); tone(out, t + 0.04, 1.0, 'sine', 70, 30, 0.28);
          for (let i = 0; i < 6; i++) tone(out, t + 0.18 + i * 0.09, 0.04, 'square', 2200 + Math.random() * 1600, 700, 0.03);
        } else if (kind === 'glitch') {
          noise(out, t, 0.25, 'bandpass', 2400, 1.5, 0.22); tone(out, t, 0.5, 'sine', 120, 40, 0.24);
          [1760, 1320, 1046, 784, 587, 440, 330].forEach((f, i) => tone(out, t + 0.05 + i * 0.055, 0.05, 'square', f * (0.97 + Math.random() * 0.06), f * 0.9, 0.04));
        } else if (kind === 'frost') {
          // 쩍 얼어붙는 소리 + 얼음 결정 부서지는 높은 울림
          noise(out, t, 0.18, 'highpass', 2600, 0.8, 0.3); tone(out, t, 0.6, 'sine', 120, 50, 0.22);
          for (let i = 0; i < 7; i++) tone(out, t + 0.12 + i * 0.07, 0.35, 'sine', 1800 + Math.random() * 2200, 1700, 0.035);
        } else if (kind === 'void') {
          // 빨려 드는 낮은 소리(음이 올라감) → 터짐
          tone(out, t, 0.5, 'sine', 45, 220, 0.3); noise(out, t, 0.5, 'bandpass', 300, 0.6, 0.18);
          tone(out, t + 0.5, 0.6, 'sine', 110, 35, 0.34); noise(out, t + 0.5, 0.5, 'lowpass', 900, 0.7, 0.28);
        }
        return;
      }
      if (!throttle('skinshot', 0.05) || !voice(0.2)) return;
      if (kind === 'ember') { noise(out, t, 0.16, 'lowpass', 520, 0.7, 0.12); noise(out, t + 0.02, 0.12, 'highpass', 4200, 0.8, 0.05); }
      else if (kind === 'flame') noise(out, t, 0.2, 'bandpass', 380, 0.6, 0.16);
      else if (kind === 'spark') { tone(out, t, 0.07, 'square', 3200, 700, 0.045); noise(out, t, 0.06, 'highpass', 5000, 0.9, 0.06); }
      else if (kind === 'glitch') { tone(out, t, 0.035, 'square', 900 + Math.random() * 900, 400, 0.04); tone(out, t + 0.04, 0.03, 'square', 1800 + Math.random() * 800, 600, 0.03); }
      else if (kind === 'frost') { noise(out, t, 0.08, 'highpass', 4800, 1, 0.07); tone(out, t, 0.18, 'sine', 2600, 2400, 0.03); }
      else if (kind === 'void') tone(out, t, 0.14, 'sine', 600, 90, 0.08);
    },
    lose() { if (!ctx) return; const t = ctx.currentTime; [392, 330, 262].forEach((f, i) => tone(sfxBus, t + i * 0.2, 0.6, 'triangle', f, f * 0.98, 0.18)); },
    engine(id, pos, type, rpm, load, own, skid) {
      if (!ctx) return;
      const P = ENG[type]; if (!P) return;
      let e = engines.get(id);
      if (!e) {
        if (engines.size >= 5) return;
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
        const o2 = ctx.createOscillator(); o2.type = P.w2;
        const g1 = ctx.createGain(); g1.gain.value = 0.55; const g2 = ctx.createGain(); g2.gain.value = 0.38;
        const ws = ctx.createWaveShaper(); ws.curve = tanhCurve(2.4);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
        const nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
        const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 1.1; const ng = ctx.createGain(); ng.gain.value = 0.3;
        const sk = ctx.createBufferSource(); sk.buffer = noiseBuf; sk.loop = true;
        const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1250; sf.Q.value = 2.5; const sg = ctx.createGain(); sg.gain.value = 0;
        const out = ctx.createGain(); out.gain.value = 0;
        let tail = out; const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        o1.connect(g1); o2.connect(g2); g1.connect(ws); g2.connect(ws); nz.connect(nf); nf.connect(ng); ng.connect(ws); ws.connect(lp); lp.connect(out);
        sk.connect(sf); sf.connect(sg); sg.connect(out);
        if (pn) { out.connect(pn); tail = pn; } tail.connect(sfxBus);
        o1.start(); o2.start(); nz.start(); sk.start();
        e = { o1, o2, nf, lp, out, sg, pn, nodes: [o1, o2, nz, sk] }; engines.set(id, e);
      }
      const t = ctx.currentTime, f = P.f0 + rpm * P.f1;
      e.o1.frequency.setTargetAtTime(f, t, 0.04); e.o2.frequency.setTargetAtTime(f * 0.505, t, 0.04);
      e.nf.frequency.setTargetAtTime(f * 3.2, t, 0.05);
      let gain = P.g * (0.45 + load * 0.4 + rpm * 0.25), pan = 0, cut = P.lp * (0.5 + load * 0.35 + rpm * 0.45);
      if (!own) { const r = geom(pos); gain *= Math.pow(clamp(1 - r.d / 180, 0, 1), 1.5) / (1 + r.d / 25); pan = r.pan; cut *= clamp(1 - r.d / 300, 0.3, 1); }
      e.out.gain.setTargetAtTime(gain, t, 0.05); e.lp.frequency.setTargetAtTime(cut, t, 0.05);
      e.sg.gain.setTargetAtTime(skid * (own ? 0.35 : 0.15), t, 0.05);
      if (e.pn) e.pn.pan.setTargetAtTime(pan, t, 0.05);
    },
    engineSweep(keep) { for (const [id, e] of engines) if (!keep.has(id)) stopEng(id, e); },
    engineStopAll() { for (const [id, e] of engines) stopEng(id, e); },
    crash(pos, k, soft) {
      if (!ctx || !throttle('crash', 0.12) || !voice(0.5)) return;
      const out = spatial(pos, 0.25 + k * 0.7, 160); if (!out) return;
      const t = ctx.currentTime;
      noise(out, t, 0.25 + k * 0.35, 'lowpass', soft ? 380 : 700, 0.8, 1.0); tone(out, t, 0.18, 'sine', 70, 40, 0.8);
      if (!soft) { noise(out, t + 0.01, 0.2 + k * 0.3, 'bandpass', 2600, 4, 0.5 * k); tone(out, t + 0.02, 0.25, 'triangle', 900 + Math.random() * 500, 600, 0.12 * k); }
    },
    hoof(pos, own, gal) {
      if (!ctx || !voice(0.12)) return;
      const out = spatial(own ? null : pos, (own ? 0.22 : 0.4) * (0.7 + gal * 0.5), 60); if (!out) return;
      const t = ctx.currentTime; tone(out, t, 0.09, 'sine', 110, 55, 0.7); noise(out, t, 0.06, 'lowpass', 900, 0.8, 0.6);
    },
    vehDoor(animal) {
      if (!ctx) return; const t = ctx.currentTime;
      if (animal) { tone(sfxBus, t, 0.35, 'sawtooth', 620, 380, 0.04); noise(sfxBus, t, 0.2, 'lowpass', 700, 0.7, 0.2); }
      else { tone(sfxBus, t, 0.08, 'sine', 140, 80, 0.4); noise(sfxBus, t, 0.07, 'bandpass', 1500, 1.5, 0.25); }
    },
    plane(on) {
      if (!ctx) return;
      if (on && !api._plane) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
        const g = ctx.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
        api._plane = { s, g };
      } else if (!on && api._plane) { const p = api._plane; p.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => p.s.stop(), 1200); api._plane = null; }
    },
    // 보급 수송기: 가장 가까운 기체 위치로 거리 감쇠·패닝 (null이면 서서히 끔)
    dropPlane(pos) {
      if (!ctx) return;
      if (!pos) { if (api._dp) { const p = api._dp; p.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5); if (!p.stopT) p.stopT = setTimeout(() => { try { p.s.stop(); } catch (e) {} if (api._dp === p) api._dp = null; }, 2500); } return; }
      if (!api._dp || api._dp.stopT) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        const g = ctx.createGain(); g.gain.value = 0; let tail = g;
        const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null; s.connect(f); f.connect(g); if (pn) { g.connect(pn); tail = pn; } tail.connect(sfxBus); s.start();
        api._dp = { s, f, g, pn };
      }
      const r = geom(pos), p = api._dp;
      p.g.gain.setTargetAtTime(0.5 * clamp(1 - r.d / 900, 0, 1) ** 2, ctx.currentTime, 0.3);
      p.f.frequency.setTargetAtTime(clamp(900 - r.d * 0.9, 180, 900), ctx.currentTime, 0.3);
      if (p.pn) p.pn.pan.setTargetAtTime(r.pan, ctx.currentTime, 0.2);
    },
    wind(level) {
      if (!ctx) return;
      if (!ambient) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.4;
        const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
        ambient = { s, f, g };
      }
      ambient.g.gain.setTargetAtTime(0.03 + level * 0.4, ctx.currentTime, 0.4);
      ambient.f.frequency.setTargetAtTime(300 + level * 900, ctx.currentTime, 0.4);
    },
    music(on) {
      if (!ctx) return;
      if (on && !music) {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(musicBus);
        const oscs = [110, 164.8, 220, 277.2].map((f, i) => {
          const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f;
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
          const lg = ctx.createGain(); lg.gain.value = 1.5; lfo.connect(lg); lg.connect(o.detune); lfo.start();
          const og = ctx.createGain(); og.gain.value = 0.06; o.connect(og); og.connect(g); o.start(); return [o, lfo];
        });
        g.gain.setTargetAtTime(0.6, ctx.currentTime, 1.5);
        music = { g, oscs };
      } else if (!on && music) {
        const m = music; music = null; m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        setTimeout(() => m.oscs.forEach(([o, l]) => { o.stop(); l.stop(); }), 2500);
      }
    },
  };
  return api;
})();
