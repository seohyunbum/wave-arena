# Wave Arena

회전 가능한 블록 디오라마 전장에서 아군과 포탑을 성장시키는 브라우저 웨이브 디펜스 게임입니다.

- 플레이: https://seohyunbum.github.io/wave-arena/
- 현재 빌드: 2026.08.25-performance-hardening
- 배포: main push → GitHub Pages
- 지원: 데스크톱 브라우저, 모바일 가로 모드, PWA 설치·오프라인 실행

## 실행

별도 빌드가 없는 정적 게임입니다.

python -m http.server 4173

그다음 http://localhost:4173/을 엽니다. 서비스 워커와 PWA 설치는 HTTPS 또는 localhost에서만 동작합니다.

## 조작

- 시작: 웨이브 시작 또는 정비 후 재개
- 끝내기: 필드를 정리하고 정비 상태로 전환
- 상점: 포탑·무기·방어구·소모품 구매
- 강화: 아군 체력·공격·연사 강화
- 포탑: 클릭/탭으로 선택, 드래그로 이동, 같은 레벨 위에 놓아 합체
- 회전: 아이소메트릭 카메라를 90도 회전
- 효과음: HUD의 스피커 버튼으로 즉시 음소거

## 아키텍처

index.html은 DOM/CSS 셸이고 게임은 runtime/config/render/core/ui로 분리했고 설치·모바일 플랫폼 처리는 src/platform/pwa.js가 담당합니다. build ID, 서비스워커 cache version, precache 목록은 src/build-meta.js가 단일 정본입니다.

게임 로직은 data-oriented JavaScript, 그래픽은 HiDPI Canvas 2D입니다. 정적 지형·배경·후처리는 캐시하고 동적 유닛·탄도·충격파만 매 프레임 합성합니다. 모바일은 DPR을 1.5로 제한하고 적 수에 따라 캐릭터 디테일과 파티클을 자동 축소합니다. 적 60마리와 구조물 30개 이상이 동시에 표시되는 극한 장면에서는 화면상 수 픽셀인 부품만 종류·방향·상태가 유지되는 실루엣 LOD로 전환합니다.

Unreal Engine은 키아트·베이크드 배경·트레일러 제작 도구로만 검토합니다. 공유 URL 조건에는 서버 GPU와 세션 인프라가 필요한 Pixel Streaming보다 정적 웹 런타임이 적합합니다.

자세한 구조는 docs/ARCHITECTURE.md, 실행 게이트는 docs/QUALITY_GATES.md, 외부 소스는 THIRD_PARTY_ASSETS.md를 참조하십시오.

## 검증

Node.js 22 이상과 Chromium 계열 브라우저가 필요합니다.

node scripts/verify-project.mjs
node scripts/smoke-test.mjs http://127.0.0.1:4173/
node scripts/perf-test.mjs http://127.0.0.1:4173/

스모크는 4개 viewport, 시작·상점·회전·음소거, 포탑 배치·합체, 저장·복원, 끝내기, reduced-motion, 전체 precache, 실제 offline 재탐색을 검사합니다. 성능 검사는 적 60마리와 최대 구조물 장면을 기본 CPU와 4배 CPU 제한에서 판정합니다. 임계값 정본은 quality-gates.json입니다.
