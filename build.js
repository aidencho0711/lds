// 모듈 소스(src/*.js, style.css, index.html)를 단일 HTML로 묶는 빌드 스크립트
// 사용: node build.js  →  dist/last-drop.html
//  · 쓰기 전에 문법 검사: main push 가 곧 운영 배포(vercel.json)라, 문법이 깨진 코드는 dist 를 쓰지 않고 빌드를 실패시킨다
//    (Vercel 은 실패한 배포를 올리지 않으므로 운영은 이전 버전 그대로 남는다)
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
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'last-drop.html'), html);
// 로컬 단독 실행용 (DOCTYPE 포함)
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"></head><body>\n' + html + '\n</body></html>');
console.log('built', (html.length / 1024).toFixed(1) + 'KB · 문법 검사 통과');
