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
    if (!ctx || !bankReady) return false;
    const arr = bank[name]; if (!arr || !arr.length) return false;
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
  // 기계음 레시피
  const MECH = {
    mech_rifle: (o, b) => { metal(o, b, 0.0, [2400, 3800, 5600], 0.045, 0.5); metal(o, b, 0.045, [1900, 3100, 4700], 0.05, 0.42); },
    mech_smg: (o, b) => { metal(o, b, 0.0, [2900, 4400, 6600], 0.035, 0.5); metal(o, b, 0.03, [2300, 3600, 5200], 0.035, 0.4); },
    mech_pistol: (o, b) => { metal(o, b, 0.0, [2800, 4600, 7100], 0.04, 0.55); metal(o, b, 0.028, [2400, 3900, 6000], 0.04, 0.45); },
    // 무거운 노리쇠 뭉치(AK 계열): 낮고 둔탁한 철컥
    mech_ak: (o, b) => { metal(o, b, 0.0, [1700, 2900, 4300], 0.06, 0.55); thunk(o, b, 0.0, 180, 0.05, 0.4); metal(o, b, 0.05, [1500, 2500, 3800], 0.06, 0.45); },
    // 탄띠식: 탄띠 떨림 + 노리쇠
    mech_lmg: (o, b) => { metal(o, b, 0.0, [2000, 3300, 5000], 0.04, 0.45); scrape(o, b, 0.01, 0.05, 3000, 2000, 0.3); thunk(o, b, 0.03, 160, 0.04, 0.35); },
    magInAk: (o, b) => { scrape(o, b, 0.0, 0.06, 1100, 1500, 0.5); metal(o, b, 0.055, [1900, 3100, 4700], 0.05, 0.55); },
    magRock: (o, b) => { thunk(o, b, 0.0, 140, 0.09, 0.9); metal(o, b, 0.005, [1600, 2700, 4100], 0.07, 0.8); },
    coverOpen: (o, b) => { metal(o, b, 0.0, [2500, 4000], 0.04, 0.6); scrape(o, b, 0.02, 0.1, 900, 1400, 0.45); metal(o, b, 0.11, [1300, 2200], 0.08, 0.55); },
    coverClose: (o, b) => { thunk(o, b, 0.0, 130, 0.08, 1.0); metal(o, b, 0.0, [1500, 2600, 3900], 0.09, 0.9); },
    boxOut: (o, b) => { scrape(o, b, 0.0, 0.12, 700, 500, 0.6); nz(o, b, 0.02, 0.1, 'lowpass', 1200, 600, 0.6, 0.3, 0.02); for (let i = 0; i < 4; i++) metal(o, b, 0.08 + i * 0.022, [3000 + i * 170, 4700], 0.02, 0.3); },
    boxIn: (o, b) => { thunk(o, b, 0.0, 160, 0.06, 0.7); metal(o, b, 0.0, [1800, 2900], 0.05, 0.5); metal(o, b, 0.06, [2600, 4200], 0.04, 0.5); },
    boxSeat: (o, b) => { thunk(o, b, 0.0, 150, 0.06, 0.6); metal(o, b, 0.0, [2200, 3500], 0.04, 0.5); },
    beltLay: (o, b) => { for (let i = 0; i < 6; i++) metal(o, b, i * 0.024, [3200 + Math.random() * 600, 5200 + Math.random() * 600], 0.025, 0.4); thunk(o, b, 0.14, 260, 0.03, 0.3); },
    breakOpen: (o, b) => { metal(o, b, 0.0, [2200, 3600], 0.04, 0.6); scrape(o, b, 0.05, 0.08, 1200, 800, 0.4); thunk(o, b, 0.1, 170, 0.06, 0.6); },
    breakClose: (o, b) => { thunk(o, b, 0.0, 150, 0.07, 1.0); metal(o, b, 0.0, [1900, 3200, 4800], 0.08, 0.95); },
    shellEject: (o, b) => { nz(o, b, 0.0, 0.03, 'bandpass', 800, 500, 2, 0.6, 0.001); thunk(o, b, 0.0, 300, 0.03, 0.5); metal(o, b, 0.012, [1500, 2400], 0.03, 0.4); },
    selector: (o, b) => { metal(o, b, 0.0, [3400, 5600], 0.025, 0.7); metal(o, b, 0.04, [3000, 5000], 0.02, 0.45); },
    magRelease: (o, b) => { metal(o, b, 0.005, [3200, 5100, 7400], 0.04, 0.5); },
    magOut: (o, b) => { scrape(o, b, 0.0, 0.12, 1800, 900, 0.6); thunk(o, b, 0.1, 220, 0.06, 0.4); },
    magIn: (o, b) => { scrape(o, b, 0.0, 0.09, 900, 1700, 0.55); metal(o, b, 0.085, [2400, 3900, 6100], 0.06, 0.8); thunk(o, b, 0.085, 180, 0.07, 0.6); },
    magSeat: (o, b) => { thunk(o, b, 0.0, 150, 0.08, 0.9); metal(o, b, 0.002, [2000, 3300], 0.05, 0.5); nz(o, b, 0, 0.05, 'lowpass', 900, 400, 0.7, 0.4); },
    chargeBack: (o, b) => { scrape(o, b, 0.0, 0.08, 2200, 1500, 0.55); metal(o, b, 0.075, [2800, 4600, 7000], 0.05, 0.6); },
    chargeFwd: (o, b) => { metal(o, b, 0.0, [2600, 4100, 6600, 8900], 0.09, 1.0); thunk(o, b, 0.0, 260, 0.05, 0.5); },
    slideBack: (o, b) => { scrape(o, b, 0.0, 0.05, 2600, 1800, 0.4); },
    slideRelease: (o, b) => { metal(o, b, 0.0, [3000, 5200, 7600], 0.07, 1.0); thunk(o, b, 0.0, 300, 0.04, 0.5); },
    shellIn: (o, b) => { scrape(o, b, 0.0, 0.05, 1200, 1800, 0.35); metal(o, b, 0.045, [1700, 2900], 0.05, 0.6); thunk(o, b, 0.045, 240, 0.05, 0.5); },
    roundIn: (o, b) => { scrape(o, b, 0.0, 0.04, 1600, 2400, 0.3); metal(o, b, 0.035, [2600, 4100, 5900], 0.05, 0.7); },
    pumpBack: (o, b) => { scrape(o, b, 0.0, 0.12, 900, 600, 0.65); metal(o, b, 0.11, [1500, 2600], 0.06, 0.6); },
    pumpFwd: (o, b) => { scrape(o, b, 0.0, 0.1, 600, 1000, 0.6); metal(o, b, 0.09, [1800, 3100, 4700], 0.07, 0.95); thunk(o, b, 0.09, 200, 0.05, 0.5); },
    boltUp: (o, b) => { metal(o, b, 0.0, [2100, 3700], 0.05, 0.6); },
    boltBack: (o, b) => { scrape(o, b, 0.0, 0.13, 1400, 900, 0.6); metal(o, b, 0.12, [1900, 3300], 0.06, 0.55); },
    boltFwd: (o, b) => { scrape(o, b, 0.0, 0.11, 900, 1500, 0.55); metal(o, b, 0.1, [2500, 4300, 6400], 0.08, 0.9); },
    boltDown: (o, b) => { metal(o, b, 0.0, [2300, 3900], 0.05, 0.7); thunk(o, b, 0.0, 200, 0.05, 0.5); },
    equip: (o, b) => { nz(o, b, 0.0, 0.18, 'lowpass', 1400, 600, 0.6, 0.45, 0.04); metal(o, b, 0.14, [2200, 3600, 5400], 0.05, 0.7); },
    aimIn: (o, b) => { nz(o, b, 0.0, 0.14, 'bandpass', 900, 600, 0.8, 0.5, 0.03); },
    attach: (o, b) => { metal(o, b, 0.0, [2800, 4500], 0.05, 0.8); thunk(o, b, 0.03, 220, 0.04, 0.5); metal(o, b, 0.06, [3300, 5200], 0.04, 0.5); },
    dry: (o, b) => { metal(o, b, 0.0, [3500, 6000], 0.03, 0.8); },
    brass: (o, b) => { [0, 0.06 + Math.random() * 0.03, 0.12 + Math.random() * 0.05].forEach((t, i) => { const k = 1 - i * 0.3, f = 4100 + Math.random() * 600; os(o, b, t, 0.06, 'sine', f, f * 0.99, 0.4 * k); os(o, b, t, 0.04, 'sine', f * 1.53, f * 1.52, 0.25 * k); os(o, b, t, 0.03, 'sine', f * 2.24, f * 2.23, 0.15 * k); }); },
    hull: (o, b) => { thunk(o, b, 0.0, 420, 0.04, 0.6); metal(o, b, 0.0, [1500, 2400], 0.03, 0.4); thunk(o, b, 0.08, 380, 0.03, 0.3); },
  };
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
    const jobs = [];
    for (const id in GUN) for (let v = 0; v < 2; v++) jobs.push(['g_' + id, GUN[id].sec || 1.5, shotGraph(GUN[id]), 0.95, 1.15]);
    for (const k in MECH) { const n = k === 'brass' ? 3 : (k.startsWith('mech') ? 2 : 1); for (let v = 0; v < n; v++) jobs.push([k, MECH_SEC[k] || (k === 'equip' ? 0.3 : 0.25), MECH[k], 0.8, 0]); }
    for (const [name, sec, fn, peak, loud] of jobs) { const b = await render(sec, fn, peak, loud); (bank[name] || (bank[name] = [])).push(b); }
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
      if (bankReady) {
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
      if (!ctx || !bankReady || !bank[name]) return;
      const rate = { m416: 1, aug: 1.05, akm: 0.88, asm: 0.95, vk9: 1.1, mini14: 1.02, slr: 0.9, m24: 1, awm: 0.92, s686: 1, s12k: 0.9, m249: 0.95, mg3: 0.88, p19: 1.14 }[weapon] || 1;
      playBuf(name, isOwn ? null : pos, isOwn ? 0.55 : 0.6, { own: isOwn, rate, range: 26, ref: 4, send: isOwn ? 0.12 : 0.2, room: listener.indoor > 0.5, jitter: 0.05 });
    },
    brass(pos, kind) { if (!ctx || !throttle('brass', 0.05)) return; playBuf(kind === 'hull' ? 'hull' : 'brass', pos, 0.32, { range: 22, ref: 3, jitter: 0.15, send: 0.08 }); },
    impact(pos, flesh) {
      if (!ctx || !throttle('imp', 0.03) || !voice(0.1)) return;
      const out = spatial(pos, flesh ? 0.5 : 0.35, 60); if (!out) return;
      const t = ctx.currentTime;
      if (flesh) noise(out, t, 0.09, 'lowpass', 900, 1, 1); else { noise(out, t, 0.07, 'highpass', 2800, 1, 0.8); tone(out, t, 0.05, 'sine', 2600 + Math.random() * 1500, 1800, 0.12); }
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
