// 모듈 소스(src/*.js, style.css, index.html)를 단일 HTML로 묶는 빌드 스크립트
// 사용: node build.js  →  dist/last-drop.html · dist/index.html (+ src/head.html 을 <head> 에) · public/** 를 dist/ 로 복사
//  · 쓰기 전에 문법 검사: main push 가 곧 운영 배포(vercel.json)라, 문법이 깨진 코드는 dist 를 쓰지 않고 빌드를 실패시킨다
//    (Vercel 은 실패한 배포를 올리지 않으므로 운영은 이전 버전 그대로 남는다)
//  · v23 앱 설치(PWA): head.html = manifest·아이콘·링크 미리보기 태그 · public/ = manifest.webmanifest · sw.js
//    앱 아이콘(dist/icons)은 로고에서 코드로 만들어 커밋해 둔 것 — 로고가 바뀌었는데 다시 만들지 않았으면 경고만 한다 (빌드는 계속)
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, 'src');
const js = fs.readdirSync(src).filter(f => /^\d\d_.*\.js$/.test(f)).sort()
  .map(f => `// ---------- ${f} ----------\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace('/*STYLE*/', () => css).replace('/*SCRIPT*/', () => `(() => {\n${js}\n})();`);
// 문법 검사: 페이지의 인라인 <script> 를 모두 파싱만 한다(실행 안 함). 오류 줄은 '// ---------- 파일 ----------' 머리로 원래 파일·줄로 되돌린다
const syntaxErrors = (doc) => {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; const errs = []; let m;
  while ((m = re.exec(doc))) {
    const attrs = m[1], code = m[2]; if (/\bsrc\s*=/i.test(attrs) || !code.trim()) continue;
    const ty = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1]; if (ty && !/^(text|application)\/javascript$/i.test(ty)) continue;
    try { new vm.Script(code, { filename: 'inline-script' }); } catch (e) {
      const ln = +((String(e.stack).match(/inline-script:(\d+)/) || [])[1] || 0), lines = code.split('\n'); let where = 'index.html 인라인 스크립트';
      for (let i = Math.min(ln, lines.length) - 1; i >= 0; i--) { const h = /^\/\/ ---------- (\d\d_[^ ]*\.js) ----------\r?$/.exec(lines[i]); if (h) { where = `src/${h[1]}:${ln - i - 1}`; break; } }
      errs.push(`${where} — ${e.message}` + (ln ? `\n    ${(lines[ln - 1] || '').trim().slice(0, 200)}` : ''));
    }
  }
  return errs;
};
const errs = syntaxErrors(html);
if (errs.length) { console.error('빌드 실패 — 문법 오류 ' + errs.length + '곳 (dist 를 쓰지 않음):\n  ' + errs.join('\n  ')); process.exit(1); }
const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'last-drop.html'), html);
// 로컬 단독 실행용 (DOCTYPE 포함) · v23 src/head.html 이 있으면 앞뒤 공백을 잘라 <head> 안 viewport 바로 뒤에 (last-drop.html 에는 넣지 않음)
const headFile = path.join(src, 'head.html'), head = fs.existsSync(headFile) ? fs.readFileSync(headFile, 'utf8').trim() : '';
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">' + head + '</head><body>\n' + html + '\n</body></html>');
// v23 public/** 를 dist/ 로 그대로 복사 — 폴더는 만들고 같은 이름은 덮어쓴다 (dist 의 다른 파일 · 아이콘은 지우지 않음)
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
  }
};
const pub = path.join(__dirname, 'public');
if (fs.existsSync(pub)) copyDir(pub, dist);
// v23 앱 아이콘이 지금 로고로 만든 것인지: dist/icons/SOURCE.txt 의 'ldrDefs-fnv1a32: …' = src/index.html 로고 블록(#ldrDefs)의 해시
//  ldrDefsText · fnv1a32 는 src/10_app.js 의 같은 이름 함수와 똑같이 둔다 (내보내기가 SOURCE.txt 에 쓰는 해시와 같은 계산)
//  로고 블록 글: id 가 ldrDefs 인 svg 여는 태그(속성 순서는 상관없음)부터 짝이 맞는 닫는 svg 태그까지 (CR 은 지움 · HTML 주석 안의 svg 태그는 세지 않음) — 없으면 null
const ldrDefsText = (s) => {
  s = s.replace(/\r/g, ''); const t = s.replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length)), o = /<svg\b[^>]*\bid=["']ldrDefs["'][^>]*>/.exec(t); if (!o) return null; const i = o.index;
  const re = /<(\/?)svg\b[^>]*?(\/?)>/g; re.lastIndex = i; let d = 0, m;
  while ((m = re.exec(t))) { if (m[1]) { if (--d === 0) return s.slice(i, m.index + m[0].length); } else if (!m[2]) d++; }
  return null;
};
// FNV-1a 32비트 (UTF-8 바이트) → 16진수 8자리
const fnv1a32 = (b) => { let h = 0x811c9dc5; for (let k = 0; k < b.length; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
try {
  const blk = ldrDefsText(fs.readFileSync(path.join(src, 'index.html'), 'utf8')), sf = path.join(dist, 'icons', 'SOURCE.txt');
  if (blk === null) console.warn('경고: src/index.html 에 로고 블록(#ldrDefs)이 없어 앱 아이콘을 확인하지 않음');
  else if (!fs.existsSync(sf)) console.warn('경고: dist/icons/SOURCE.txt 가 없음 — 앱 아이콘을 아직 만들지 않았음 (로컬 서버에서 __LD.App.exportIcons() 후 dist/icons 커밋)');
  else {
    const want = fnv1a32(Buffer.from(blk, 'utf8')), got = (/ldrDefs-fnv1a32:\s*([0-9a-f]{8})/.exec(fs.readFileSync(sf, 'utf8')) || [])[1];
    if (got !== want) console.warn('경고: 앱 아이콘이 지금 로고와 다름 (dist/icons ' + (got || '해시 없음') + ' · #ldrDefs ' + want + ') — 로컬 서버에서 __LD.App.exportIcons() 로 다시 만들어 dist/icons 커밋');
  }
} catch (e) { console.warn('경고: 앱 아이콘 확인을 건너뜀 — ' + e.message); }
console.log('built', (html.length / 1024).toFixed(1) + 'KB · 문법 검사 통과');
