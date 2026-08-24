# Visual Overhaul Audit — 2026-08-24

## 검증한 정본

- 로컬: `C:\Users\서현범\Documents\wave-arena`
- 브랜치: `main`
- 로컬 HEAD: `529398daf21a4d9227897763542c702a9639e7b7`
- 원격 `refs/heads/main`: 동일 SHA
- 공개 URL: https://seohyunbum.github.io/wave-arena/
- 개편 전 구조: 151,756바이트 단일 `index.html`, Canvas 2D, PWA, 10개 경로, 4방향 회전

## 적대적 감사 결과

| 우선순위 | 결함 | 근거 | 이번 조치 |
|---|---|---|---|
| P0 | 캐릭터·포탑의 접지 그림자가 없어 높이와 전후 관계가 약함 | 데스크톱·844×390 기준 화면에서 오브젝트가 지면에 붙은 평면 도형처럼 보임 | 지형 장식·유닛·포탑별 2중 접지 그림자 추가 |
| P0 | 베이스플레이트가 한 장의 녹색 평면이라 디오라마 정체성이 약함 | 상단면 외 두께·림·바닥 투영 그림자 없음 | 34월드 단위 측면, 방향별 명암, 림라이트, 블러 그림자 추가 |
| P0 | 피격·보스·에너지 병기의 타격감이 파티클 박스와 숫자에 의존 | 충격파·탄도 잔상·화면 반응·음향 부재 | 발광 트레일, 충격파, 카메라 셰이크, CC0 SFX 연결 |
| P1 | 도로와 잔디의 재질 경계가 약함 | 단일 회색 도로가 녹색 면에 바로 접함 | 배수 숄더·커브·아스팔트 3중 밴드와 중앙선 대비 강화 |
| P1 | 모바일 HUD가 긴 가로 레일이라 시각 계층이 약함 | 844×390에서 일부 도구가 화면 밖으로 밀림 | 핵심 버튼 우선순위 유지, 높이 축소, 스냅 스크롤, 고대비 유리 패널 |
| P1 | 외부 소스의 라이선스·채택/기각 근거가 없음 | 저장소에 출처 문서 부재 | `THIRD_PARTY_ASSETS.md`와 원본 파일 매핑 추가 |
| P2 | 모바일 HiDPI에서 최대 DPR 2 고정 | 고밀도 폰에서 픽셀 비용이 PC와 동일 | coarse pointer 기기는 DPR 1.5 상한, 적 수 기반 LOD 유지 |

## 시각 벤치마크 — 참고 전용

아래 게임의 스크린샷·로고·에셋은 복사하지 않습니다. 관찰한 설계 원칙만 적용합니다.

- [Thronefall](https://www.nintendo.com/us/store/products/thronefall-switch/): 단순한 저폴리 형태를 접지 그림자, 제한 팔레트, 시간대 조명으로 고급스럽게 보이게 하는 방식.
- [Isle of Arrows](https://gridpop.co/isle/): 부유 섬의 측면 두께와 넓은 그림자, 보드게임 같은 시각 계층.
- [Kingdom Rush](https://www.kingdomrushgame.com/): 도로 가독성, 타워 실루엣 차별화, 보스·전투 정보의 즉시성.

## 외부 소스 검토

| 후보 | 장점 | 치명적 제약 | 결정 |
|---|---|---|---|
| [Kenney Tower Defense](https://kenney.nl/assets/tower-defense) | CC0, 230개, 아이소메트릭 | 2015년 고정 시점 스프라이트, 현재 4방향 회전과 불일치, 기존 절차적 포탑보다 디테일이 낮음 | 프로토타입 참고만, 미탑재 |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0, 짧고 작은 OGG, 모바일 적합 | 음악은 포함하지 않음 | UI 4종 채택 |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0, 재질별 충격음, 파일당 약 5~12KB | 연속 발사 시 중첩 제어 필요 | 피격·보스 2종 채택, 재생 간격 제한 |
| [PixiJS v8](https://pixijs.com/8.x/guides/components/renderers) | WebGL/WebGL2, 배치·필터·자산 파이프라인 | Canvas fallback 미제공, 현재 회전형 절차 렌더러 전면 이식 필요 | 적 150+ 또는 셰이더가 필수가 될 때 2단계 후보 |
| [Phaser FX](https://docs.phaser.io/phaser/concepts/fx) | Bloom·Glow·Vignette 등 내장 WebGL FX | 게임 상태·입력·렌더링 전체 재구축, WebGL 전용 FX | 신규 게임에는 적합, 현 버전 즉시 이식은 기각 |
| [Unreal Pixel Streaming](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-pixel-streaming-in-unreal-engine) | 최고 수준 실시간 3D, 브라우저·터치 입력 | 패키징 앱+GPU 호스트+시그널링+STUN/TURN 필요, 기본은 한 UE 세션을 여러 클라이언트가 공유 | 런타임 기각; 키아트·영상·베이크 제작 도구로만 검토 |

## 아키텍처 결정

현재 규모에서는 Canvas 2D 유지가 가장 실효적입니다.

1. 정적 지형은 오프스크린 캔버스에 한 번만 그립니다.
2. 동적 오브젝트는 painter's algorithm으로 깊이 정렬합니다.
3. 발광·충격파는 additive 합성하되 수량 상한을 둡니다.
4. 모바일은 DPR 1.5, 적 22/45마리에서 2단계 LOD, 파티클 260개 상한을 적용합니다.
5. 외부 CDN 의존 없이 서비스 워커가 모든 실행 파일과 효과음을 캐시합니다.

이는 MDN의 [정적 프리렌더링·레이어 분리 권고](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)와 일치합니다.

## 품질 게이트

- 1440×900, 1280×720, 844×390, 740×360에서 캔버스와 핵심 버튼이 표시될 것
- 4방향 회전 후 플랫폼 측면·그림자·클릭 좌표가 일치할 것
- 시작·상점·포탑 배치·합체·저장·불러오기·끝내기 기존 기능이 회귀하지 않을 것
- 효과음 음소거가 새로고침 후 유지될 것
- 오프라인 캐시에 신규 OGG 6개가 포함될 것
- `prefers-reduced-motion`에서 화면 흔들림과 파티클이 축소될 것
- HTML 인라인 스크립트 문법 오류 0건, 콘솔 오류 0건
- Pages 배포 HEAD와 원격 `main` SHA가 일치할 것

## 다음 고도화 조건

- 동시에 보이는 유닛이 150개를 안정적으로 넘거나 블룸·왜곡 셰이더가 핵심 게임플레이가 되면 PixiJS v8 이식 실험을 별도 브랜치에서 진행합니다.
- BGM은 단순 무료 여부가 아니라 반복 피로도, 루프 지점, 모바일 파일 크기, 상업 이용·재배포 조항까지 검증된 트랙만 채택합니다. 현재는 검증되지 않은 음악을 억지로 넣지 않습니다.
- UE5는 4K 키아트, 트레일러, 사전 렌더 배경 제작에 한정하며 런타임 전환은 동시 접속별 GPU 비용과 세션 격리가 승인될 때만 재검토합니다.
