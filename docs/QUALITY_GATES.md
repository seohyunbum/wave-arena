# Wave Arena Quality Gates

Status: enforced
Canonical config: quality-gates.json

## Release contract

1. 정적 계약: 프로젝트 헌법 동등성, build metadata 단일성, precache 파일 존재, inline game script 부재.
2. 기능 계약: 시작, 상점, 회전, 음소거 저장, 포탑 배치·합체, 저장·복원, 끝내기.
3. 화면 계약: 1440×900, 1280×720, 844×390, 740×360에서 canvas와 핵심 조작이 렌더링된다.
4. 접근성 계약: prefers-reduced-motion에서 REDUCE가 활성화되고 파티클 수가 축소된다.
5. PWA 계약: precache 전 항목이 존재하고, 최초 설치는 일시 실패 시 최대 3회 재시도하며, 네트워크 차단 후 재탐색해 같은 build ID가 실행된다.
6. 시각 진화 계약: 캐릭터·기지 16단계, 일반 포탑 15단계, 전문 구조물 전 단계의 시각 서명이 중복되지 않고 6개 발사체 형상과 최대 6레이어 예산을 지킨다.
7. 성능 계약: quality-gates.json의 정상/CPU 4배 제한 예산을 모두 통과하고 CI가 perf-result.json artifact를 보존한다.
8. 러프 밸런스 계약: 시작 화력, 적 HP 대비 보상, 무기군 성장률, 보스 체력, 방어 상한이 느슨한 밴드를 벗어나지 않는다.
9. 배포 계약: main CI 통과 뒤 GitHub Pages 공개 URL에서 smoke가 다시 통과한다.

## Performance scene

844×390에서 두 장면을 계측한다. 첫째는 적 20마리와 최고 등급 구조물 30개 이상으로 pressure LOD, DPR 1.25 상한, 등급 코어·발사체 식별성을 검증한다. 둘째는 적 60마리와 같은 구조물 부하로 dense LOD 및 DPR 1.25 상한을 검증한다. 기본 CPU와 DevTools 4배 CPU 제한을 각각 계측한다. FPS만 보지 않고 p95 frame time과 long-frame 비율을 함께 판정한다. 이 장면은 고밀도 LOD와 내부 DPR 1.25 상한의 발동도 검증하며, 평상시 렌더 품질과 분리된 최악 부하 예산으로 관리한다.

발사체·장갑·포탑 디테일은 평상시 장면에서 검증하고, 고밀도 장면은 동일 종류·방향·등급 코어를 유지한 LOD로 검증한다. 시각 진화 정본은 docs/VISUAL_PROGRESSION.md다.

CPU 제한은 실제 휴대폰 인증을 대체하지 않는다. 릴리스 후보는 중급 Android와 iPhone 가로 모드에서 10분 soak를 별도 수행한다.

## Commands

python -m http.server 4173
node scripts/verify-project.mjs
node scripts/balance-report.mjs --check
node scripts/smoke-test.mjs http://127.0.0.1:4173/
node scripts/capture-visual-progression.mjs http://127.0.0.1:4173/
node scripts/perf-test.mjs http://127.0.0.1:4173/
