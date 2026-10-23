# 사운드 뱅크 측정: 피크, 구간 RMS(dBFS), 대역별 에너지 비율, -40dB 감쇠 시간
import sys, json
from playwright.sync_api import sync_playwright
NAMES = sys.argv[1].split(',') if len(sys.argv) > 1 else ['g_m416','g_akm','g_awm','g_s686','g_p19','g_vk9']
THREE = open('/home/claude/br/node_modules/three/build/three.min.js','rb').read()
def route(r):
    u = r.request.url
    if 'three' in u and 'cdnjs' in u: return r.fulfill(body=THREE, content_type='application/javascript')
    if 'fonts.g' in u: return r.abort()
    return r.continue_()
JS = r"""async (names) => {
  const A = __LD.Audio; A.init();
  for (let i = 0; i < 200 && !A.bankReady; i++) await new Promise(r => setTimeout(r, 100));
  const out = {};
  function fftMag(x) { // 실수 FFT (길이 2^n), 크기 스펙트럼
    const n = x.length, re = Float64Array.from(x), im = new Float64Array(n);
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; } }
    const m = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) m[i] = re[i] * re[i] + im[i] * im[i]; return m;
  }
  for (const nm of names) {
    const arr = A._bank[nm]; if (!arr) { out[nm] = null; continue; }
    const b = arr[0], sr = b.sampleRate, d0 = b.getChannelData(0), d1 = b.numberOfChannels > 1 ? b.getChannelData(1) : d0;
    const mono = new Float32Array(d0.length); for (let i = 0; i < d0.length; i++) mono[i] = (d0[i] + d1[i]) / 2;
    let pk = 0; for (const v of mono) pk = Math.max(pk, Math.abs(v));
    const rms = (a, b2) => { let s = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(mono.length, Math.floor(b2 * sr)); i++) { s += mono[i] * mono[i]; n++; } return n ? 10 * Math.log10(s / n + 1e-12) : -120; };
    // -40dB 감쇠: 50ms 창 RMS가 피크 대비 -40dB 아래로 떨어지는 마지막 시각
    let tail = 0; const w = Math.floor(0.05 * sr);
    for (let i = 0; i + w < mono.length; i += w) { let s = 0; for (let k = 0; k < w; k++) s += mono[i + k] ** 2; const db = 10 * Math.log10(s / w + 1e-12) - 20 * Math.log10(pk); if (db > -40) tail = (i + w) / sr; }
    const N = 16384, seg = new Float32Array(N); for (let i = 0; i < N && i < mono.length; i++) seg[i] = mono[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    const m = fftMag(seg), bands = [[20, 100], [100, 300], [300, 1000], [1000, 4000], [4000, 20000]], E = bands.map(([a, b2]) => { let s = 0; for (let k = Math.floor(a * N / sr); k < Math.min(m.length, b2 * N / sr); k++) s += m[k]; return s; });
    const tot = E.reduce((a, b2) => a + b2, 0);
    out[nm] = { dur: +b.duration.toFixed(2), peak: +pk.toFixed(2), rms0_150: +rms(0, 0.15).toFixed(1), rms150_600: +rms(0.15, 0.6).toFixed(1), crest: +(20 * Math.log10(pk) - rms(0, 0.15)).toFixed(1), tail40: +tail.toFixed(2), bands: E.map(e => Math.round(e / tot * 100)) };
  }
  return out;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width':960,'height':540})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto('file:///home/claude/br/dist/index.html'); pg.wait_for_timeout(1500)
    r = pg.evaluate(JS, NAMES)
    print('bands = % energy in [20-100, 100-300, 300-1k, 1-4k, 4k+] Hz (first 340ms)')
    for k, v in r.items(): print(k, json.dumps(v))
    print(errs[:5])
    b.close()
