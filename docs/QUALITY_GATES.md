# Wave Arena Quality Gates

Status: enforced
Canonical config: quality-gates.json

## Release contract

1. 정적 계약: 프로젝트 헌법 동등성, build metadata 단일성, precache 파일 존재, inline game script 부재.
2. 기능 계약: 시작, 상점, 회전, 음소거 저장, 포탑 배치·합체, 저장·복원, 끝내기.
3. 화면 계약: 1440×900, 1280×720, 844×390, 740×360에서 canvas와 핵심 조작이 렌더링된다.
4. 접근성 계약: prefers-reduced-motion에서 REDUCE가 활성화되고 파티클 수가 축소된다.
5. PWA 계약: precache 전 항목이 존재하고 네트워크 차단 후 재탐색해 같은 build ID가 실행된다.
6. 성능 계약: quality-gates.json의 정상/CPU 4배 제한 예산을 모두 통과하고 CI가 perf-result.json artifact를 보존한다.
7. 배포 계약: main CI 통과 뒤 GitHub Pages 공개 URL에서 smoke가 다시 통과한다.

## Performance scene

844×390, DPR 1.5에서 적 60마리와 정상 구매 경로로 배치 가능한 최고 등급 구조물을 최대한 채운다. 기본 CPU와 DevTools 4배 CPU 제한을 각각 계측한다. FPS만 보지 않고 p95 frame time과 long-frame 비율을 함께 판정한다. 이 장면은 고밀도 LOD의 발동 조건도 검증하며, 평상시 렌더 품질과 분리된 최악 부하 예산으로 관리한다.

CPU 제한은 실제 휴대폰 인증을 대체하지 않는다. 릴리스 후보는 중급 Android와 iPhone 가로 모드에서 10분 soak를 별도 수행한다.

## Commands

python -m http.server 4173
node scripts/verify-project.mjs
node scripts/smoke-test.mjs http://127.0.0.1:4173/
node scripts/perf-test.mjs http://127.0.0.1:4173/
