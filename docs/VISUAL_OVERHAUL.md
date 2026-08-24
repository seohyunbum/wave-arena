# Visual Overhaul Audit — 2026-08-24

## 정본과 검증 상태

- 저장소: C:\Users\서현범\Documents\wave-arena
- 브랜치: main
- 개편 전 감사 기준선: 529398daf21a4d9227897763542c702a9639e7b7
- 현재 build ID 정본: src/build-meta.js
- 품질 게이트 정본: quality-gates.json
- 공개 URL: https://seohyunbum.github.io/wave-arena/

고정 SHA를 현재값처럼 복제하지 않습니다. CI가 checkout한 SHA에서 정적 계약, E2E, 성능을 실행하고 배포 job이 같은 artifact를 게시합니다.

## 최초 적대감사에서 닫은 시각 결함

| 우선순위 | 결함 | 조치 |
|---|---|---|
| P0 | 캐릭터·포탑 접지감 부족 | 지형 장식·유닛·포탑별 이중 접지 그림자 |
| P0 | 평면 베이스플레이트 | 측면 두께·방향별 명암·림라이트·투영 그림자 |
| P0 | 타격감 부족 | 발광 트레일·충격파·카메라 셰이크·CC0 효과음 |
| P1 | 도로 재질 경계 부족 | 배수 숄더·커브·아스팔트 3중 밴드 |
| P1 | 모바일 HUD 계층 부족 | 핵심 버튼 우선·높이 축소·스냅 스크롤 |
| P1 | 외부 소스 근거 부재 | THIRD_PARTY_ASSETS.md에서 파일별 출처·라이선스 추적 |
| P2 | 모바일 DPR 2 고정 | coarse pointer DPR 1.5와 적 수 기반 LOD |

## 시각 벤치마크

아래 게임의 에셋을 복사하지 않고 설계 원칙만 참고했습니다.

- Thronefall: 제한 팔레트, 접지 그림자, 시간대 조명
- Isle of Arrows: 부유 섬 측면 두께, 넓은 그림자, 보드게임 계층
- Kingdom Rush: 도로 가독성, 타워 실루엣, 전투 정보 즉시성

## 외부 기술·소스 판단

| 후보 | 장점 | 제약 | 결정 |
|---|---|---|---|
| Kenney Tower Defense | CC0 아이소메트릭 에셋 | 고정 시점·현재 회전 렌더러와 불일치 | 참고만 |
| Kenney Interface/Impact Sounds | CC0, 소형 OGG | 중첩 제어 필요 | 6종 채택 |
| PixiJS v8 | WebGL 배치·필터 | 현재 절차 렌더러 전면 이식 | 150+ 유닛 또는 shader 필수 시 실험 |
| Phaser FX | FX 파이프라인 | 전체 상태·입력 재구축 | 신규 게임 후보 |
| Unreal Pixel Streaming | 최고급 3D | 사용자별 GPU 세션·시그널링 필요 | 런타임 기각, 키아트·영상 도구 |

## 아키텍처 결정

1. Canvas 2D와 data-oriented entity를 유지합니다.
2. backdrop, ground, post-FX는 캐시합니다.
3. 모바일 DPR 1.5, 적 22/45 LOD, 적 60, 파티클 260 상한을 적용합니다.
4. HUD는 최대 10Hz로 갱신합니다.
5. 게임/PWA/build metadata 책임을 파일로 분리합니다.
6. 서비스워커 core precache는 하나라도 실패하면 설치를 실패시킵니다.

세부 결정은 docs/ARCHITECTURE.md를 따릅니다.

## 강제 품질 게이트

- 1440×900, 1280×720, 844×390, 740×360 canvas·핵심 조작 렌더
- 시작·상점·포탑 배치·합체·저장·복원·끝내기·90도 회전
- 음소거 새로고침 지속
- reduced-motion 파티클 축소
- precache 전 파일 존재와 네트워크 차단 후 같은 build 재실행
- 콘솔 오류·런타임 예외 0
- 최대부하 성능: 기본 CPU 40fps 이상, p95 40ms 이하, 33ms 초과 비율 8% 이하
- 최대부하 CPU 4배 제한: 24fps 이상, p95 80ms 이하, 50ms 초과 비율 20% 이하

기계 판정은 quality-gates.json, scripts/smoke-test.mjs, scripts/perf-test.mjs가 수행합니다.

## 다음 고도화 조건

- 동시 유닛이 150개를 안정적으로 넘거나 bloom·왜곡 shader가 핵심 게임플레이가 되면 PixiJS 이식을 별도 브랜치에서 검증합니다.
- BGM은 반복 피로도, loop point, 파일 크기, 상업 이용·재배포 권한을 통과한 트랙만 채택합니다.
- UE5 런타임은 동시 접속별 GPU 비용과 사용자별 세션 격리가 승인될 때만 재검토합니다.
