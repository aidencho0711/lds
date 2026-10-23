// 모듈 소스(src/*.js, style.css, index.html)를 단일 HTML로 묶는 빌드 스크립트
// 사용: node build.js  →  dist/last-drop.html
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
const js = fs.readdirSync(src).filter(f => /^\d\d_.*\.js$/.test(f)).sort()
  .map(f => `// ---------- ${f} ----------\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace('/*STYLE*/', () => css).replace('/*SCRIPT*/', () => `(() => {\n${js}\n})();`);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'last-drop.html'), html);
// 로컬 단독 실행용 (DOCTYPE 포함)
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), '<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"></head><body>\n' + html + '\n</body></html>');
console.log('built', (html.length / 1024).toFixed(1) + 'KB');
