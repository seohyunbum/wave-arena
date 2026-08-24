# Wave Arena Architecture

Status: accepted
Last reviewed: 2026-08-25

## Product constraints

1. GitHub Pages 정적 호스팅과 공유 URL을 유지한다.
2. 데스크톱과 모바일 가로 모드에서 같은 게임 규칙을 실행한다.
3. 첫 온라인 실행 뒤 PWA 오프라인 실행이 가능해야 한다.
4. 외부 CDN, 세션 서버, GPU 스트리밍에 의존하지 않는다.

## Runtime boundaries

- index.html: DOM, CSS, script ordering만 담당한다.
- src/build-meta.js: 배포 식별자와 precache 계약의 단일 정본이다.
- src/game/runtime.js: Canvas·오디오 런타임을 초기화한다.
- src/game/config.js: CFG 밸런스의 단일 정본이다.
- src/game/render.js: 월드·카메라·Canvas 렌더러를 담당한다.
- src/game.js: 상태·저장·전투 시뮬레이션 core를 담당한다.
- src/game/ui.js: HUD·상점·입력·게임 시작 bootstrap을 담당한다.
- src/platform/pwa.js: 설치, 서비스워커, wake lock, 터치 브라우저 제약을 담당한다.

이번 분리는 위험이 큰 전면 재작성 대신 배포·플랫폼 경계를 먼저 떼어낸 1단계다. 다음 분리는 동작 불변 테스트를 유지하면서 core/state, systems, render, ui 순으로 진행한다.

## State and simulation

CFG는 밸런스 정본이고 G는 런타임 상태다. entity는 상속 계층 대신 plain object 배열로 유지한다. 이는 최대 60개 적과 다수 탄도체를 순차 처리하는 현재 규모에서 class hierarchy보다 단순하고 캐시 친화적이다.

프레임 간격은 최대 250ms를 받아 33.3ms 이하 substep으로 최대 8회 처리한다. 저사양 장치에서 50ms 초과 시간을 버려 게임 시계와 난이도가 느려지던 기존 동작을 제거한다.

## Rendering strategy

- backdrop, ground, post-FX는 resize 또는 카메라 변화 시 캐시한다.
- 동적 entity는 painter sort한다.
- 모바일 DPR은 1.5로 제한한다.
- 적 22/45에서 캐릭터 LOD를 낮춘다.
- 적 45 초과와 구조물 30개 이상이 겹치는 극한 장면에서는 캐릭터와 포탑을 실루엣 LOD로 전환한다. 종류·방향·충전 상태는 보존하며 평상시 렌더에는 적용하지 않는다.
- 적 60, 파티클 260, ring 80 상한을 둔다.
- HUD는 최대 10Hz로 갱신하고 상점 DOM은 상태 변경 시에만 다시 계산한다.

## Decision record

ADR-001: Canvas 2D 유지. 정적 URL과 모바일 독립 실행 비용이 Pixi/Phaser/UE 런타임 전환 이익보다 크다.
ADR-002: Data-oriented entities 유지. OOP는 클래스 개수가 아니라 책임·의존 경계로 평가한다.
ADR-003: Build metadata와 precache를 한 파일에서 관리한다.
ADR-004: 문서 품질 게이트는 quality-gates.json과 scripts에서 실행되지 않으면 gate로 인정하지 않는다.
ADR-005: 고밀도 LOD는 작은 화면에서 식별되지 않는 미세 부품만 줄이고 실루엣·종류·방향·상태 신호를 보존한다.

## Change rules

- game 변경: verify-project, smoke, perf 필수.
- PWA/asset 변경: build-meta precache와 offline navigation 필수.
- save 구조 변경: version bump, migration, save/load fixture 필수.
- renderer 변경: 4 viewport와 performance budget 필수.
