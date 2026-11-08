# CLAUDE.md — Last Drop Royale 작업 지침

이 파일은 Claude Code 가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 메모리입니다.
새로 알게 된 규칙이나 자주 쓰는 명령이 생기면 여기에 추가하세요.

## 프로젝트

브라우저에서 돌아가는 배틀로얄 게임. Three.js r128, 서버 없이 단일 HTML 로 실행됩니다.
외부 에셋(이미지·모델·사운드 파일) 없이 **모든 모델·텍스처·효과음을 코드로 생성**하는 것이 이 프로젝트의 핵심 제약입니다.

- 저장소: `github.com/aidencho0711/lds`
- 배포: main 에 push 하면 Vercel 이 자동 배포 (`vercel.json`: `node build.js` → `dist/`)
- 온라인 기능(친구·파티·랭크)은 Supabase. 스키마는 `supabase/schema.sql`, `supabase/social.sql`
- 주 테스트 기기: Galaxy S26 Ultra (모바일 성능·터치 UI 를 항상 염두에 둘 것)

## 명령

```bash
node build.js        # src/*.js 를 합쳐 dist/index.html, dist/last-drop.html 생성
npm install          # three (테스트용), 실행 자체는 cdnjs 에서 three 로드
```

`dist/index.html` 을 브라우저로 열면 바로 실행됩니다.

빌드 중 다른 프로세스가 dist 를 읽는 경우가 있으므로, 원자적으로 쓰려면:

```bash
node -e "const fs=require('fs');const w=fs.writeFileSync;fs.writeFileSync=(p,d)=>{w(p+'.tmp',d);fs.renameSync(p+'.tmp',p)};require('./build.js')"
```

빌드 결과의 문법 검사(가장 큰 `<script>` 를 떼어내 `node --check`):

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');let b='';const re=/<script\b[^>]*>([\s\S]*?)<\/script>/g;let m;while((m=re.exec(h)))if(m[1].length>b.length)b=m[1];fs.writeFileSync('/tmp/chk.js',b)" && node --check /tmp/chk.js
```

## 구조

`src/NN_이름.js` 파일들이 **파일명 정렬 순서대로** 하나의 IIFE 로 연결됩니다.
따라서 파일 사이에 `import`/`export` 가 없고, 앞 파일의 `const`/`function` 을 뒤 파일이 그대로 씁니다.
번호는 로드 순서를 뜻하므로 새 모듈을 추가할 때 번호를 신중히 고르세요 (예: `02_world_lm.js` 는 `02_world.js` 다음).

모듈별 상세 설명은 `README.md` 의 표를 보세요. 자주 건드리는 곳:

| 파일 | 역할 |
|---|---|
| `00_core.js` | 설정 기본값, 품질 단계, `MAPS`(맵 정의), `GAME_TYPES`, 시드 난수·노이즈 |
| `02_world.js` | 절차적 월드 생성 전부 (높이맵·도로·POI·건물·식생·미니맵) |
| `05_models*.js` | 총·차량·장비 모델과 스킨 |
| `07_bot.js` | 봇 AI 상태머신 |
| `09_player.js` / `10_touch.js` | 조작 (PC / 모바일) |
| `10_hud.js` | HUD·로비·지도·설정 UI |
| `11_game.js` | 렌더러, 경기 흐름, 디버그 훅 `window.__LD` |

## 테스트

Playwright + SwiftShader(소프트웨어 GL)로 헤드리스 실행합니다. `test/*.py` 77 개.

```bash
pip install playwright && playwright install chromium
python3 test/big.py /tmp/out          # 예: 8km 맵 생성 확인
```

**⚠ 알려진 문제:** 기존 테스트들이 three.js 경로를 `/home/claude/br/node_modules/three/build/three.min.js` 로,
일부는 대상 HTML 을 `/home/claude/br/dist/index.html` 로 **하드코딩**하고 있습니다 (예전 작업 환경의 경로).
로컬에서 돌리려면 그 경로를 이 저장소 기준으로 바꿔야 합니다. 한 번에 고치려면:

```bash
grep -rl "/home/claude/br" test/ | xargs sed -i "s#/home/claude/br/node_modules#$(pwd)/node_modules#g; s#/home/claude/br/dist#$(pwd)/dist#g; s#/home/claude/br/test#$(pwd)/test#g"
```

테스트에서 쓰는 디버그 훅은 `11_game.js` 끝의 `window.__LD` 입니다
(`__LD.sim(n, dt)` 로 n 프레임 진행, `__LD.G`, `__LD.W`, `__LD.CHARS`, `__LD.states()` 등).
오래 걸리는 생성/시뮬레이션은 백그라운드로 돌리고 출력 파일을 확인하세요.

## 규칙

**저작권** — PUBG MOBILE 의 로고·공식 UI 이미지·게임 에셋을 그대로 복사하지 않습니다.
장르적 특징(강하, 자기장, 파밍 등)과 일반적인 건물 유형만 참고하고, 지명·배치·고유 디자인은 자체적으로 만듭니다.

**코드 스타일** — 주석과 UI 문자열은 한국어. 기존 파일의 들여쓰기(2칸)와 조밀한 한 줄 스타일을 따릅니다.
새 기능은 가능한 한 기존 생성기·헬퍼를 재사용하고, 외부 에셋이나 라이브러리를 새로 끌어오지 않습니다.

**Git** — 커밋·푸시는 요청받았을 때만 합니다. 작업은 버전 브랜치(`v20`, `v21` …)에서 하고,
main 병합은 사용자가 배포를 원할 때만 (main push = 프로덕션 배포).

> **중요:** 작업 중인 브랜치는 **하루 작업이 끝날 때마다 `git push -u origin <브랜치>`** 해 두세요.
> 2026-11-08 에 작업 환경이 초기화되면서 푸시하지 않은 v20 작업 전체가 사라진 적이 있습니다.

**커밋 메시지 꼬리말** (Claude 가 작성한 커밋에 붙임):

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## 지금 할 일

`docs/v20-roadmap.md` 에 v20 에서 만들려던 기능 8 가지가 정리되어 있습니다. 거기서 이어가면 됩니다.
