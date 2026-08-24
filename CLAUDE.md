# Wave Arena — 작업 지침

이 파일과 CLAUDE.md는 동일한 프로젝트 헌법이다. 정적 웹 게임의 URL 공유성, 모바일 플레이, PWA 오프라인 실행, 데스크톱 바로가기를 동시에 보존한다.

## 목적

Wave Arena는 별도 계정·서버·GPU 없이 GitHub Pages URL에서 실행되는 회전형 아이소메트릭 웨이브 디펜스 게임이다. 데스크톱을 주 플레이 환경으로 하되 모바일 가로 모드와 설치형 PWA를 지원한다.

## 코드 하이어라키

| 경로 | 책임 |
|---|---|
| index.html | 접근성 있는 DOM/CSS 셸. 게임 로직을 넣지 않는다 |
| src/build-meta.js | build ID, 서비스워커 cache version, precache 목록의 단일 정본 |
| src/game/runtime.js | Canvas·오디오·브라우저 런타임 초기화 |
| src/game/config.js | CFG 밸런스 정본 |
| src/game/render.js | 월드·카메라·Canvas 렌더링 |
| src/game.js | 상태·저장·전투 시뮬레이션 core |
| src/game/ui.js | HUD·상점·입력·게임 시작 bootstrap |
| src/platform/pwa.js | 서비스워커, 설치 안내, wake lock, 모바일 브라우저 제약 |
| quality-gates.json | viewport와 성능 예산의 기계 판독 정본 |
| scripts | 정적 검증, 브라우저 E2E, 성능 회귀 |
| docs | 아키텍처 결정, 품질 게이트, 외부 소스 근거 |

의존 방향은 platform → browser API, game → Canvas/DOM, index → build-meta → game → platform 순서다. platform은 게임 함수를 재대입하지 않고 wavearena:start 이벤트만 구독한다.

## 엔지니어링 가드레일

- 외부 CDN과 서버 런타임을 추가하지 않는다. 친구가 URL만으로 독립 실행할 수 있어야 한다.
- Unreal Engine은 키아트·영상·베이크 자산 제작에만 사용한다. Pixel Streaming을 런타임 기본값으로 도입하지 않는다.
- 데이터 지향 entity 배열을 유지한다. 클래스 상속 전환은 목표가 아니며 책임 경계와 순수 시스템 분리를 우선한다.
- CFG는 게임 밸런스 정본이다. 수치를 바꾸면 스모크와 성능 게이트를 함께 실행한다.
- 저장 스키마 v3의 하위 호환을 보존한다. breaking change는 마이그레이션과 fixture 없이는 금지한다.
- build ID, cache version, precache는 src/build-meta.js에서만 변경한다.
- 서비스워커 core precache 실패는 설치 실패로 처리한다. 오프라인 false-green을 허용하지 않는다.
- 실패한 검증 결과를 커밋·배포하지 않는다. commit은 pathspec으로 이번 변경만 포함한다.
- worktree를 만들지 않고 이 메인 저장소에서 직접 작업한다.

## 성공 게이트

- node scripts/verify-project.mjs
- 로컬 서버에서 node scripts/smoke-test.mjs http://127.0.0.1:4173/
- 로컬 서버에서 node scripts/perf-test.mjs http://127.0.0.1:4173/
- quality-gates.json의 모든 viewport, flow, offline, reduced-motion, performance budget 통과
- 콘솔 오류와 런타임 예외 0
- main push 뒤 GitHub Pages 공개 URL 스모크 통과

새 명령이나 게이트를 추가하면 README, docs/QUALITY_GATES.md, GitHub Actions를 같은 변경에서 동기화한다.
