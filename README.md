# Wave Arena

회전 가능한 블록 디오라마 전장에서 아군과 포탑을 성장시키는 브라우저 웨이브 디펜스 게임입니다.

- 플레이: https://seohyunbum.github.io/wave-arena/
- 현재 빌드: `2026.08.24-visual-overhaul`
- 배포: `main` 푸시 → GitHub Pages
- 지원: 데스크톱 브라우저, 모바일 가로 모드, PWA 설치·오프라인 실행

## 실행

별도 빌드가 없는 정적 게임입니다.

```powershell
python -m http.server 4173
```

그다음 `http://localhost:4173/`을 엽니다. 서비스 워커와 PWA 설치는 HTTPS 또는 localhost에서만 동작합니다.

## 조작

- 시작: 웨이브 시작 또는 정비 후 재개
- 끝내기: 필드를 정리하고 정비 상태로 전환
- 상점: 포탑·무기·방어구·소모품 구매
- 강화: 아군 체력·공격·연사 강화
- 포탑: 클릭/탭으로 선택, 드래그로 이동, 같은 레벨 위에 놓아 합체
- 회전: 아이소메트릭 카메라를 90도 회전
- 효과음: HUD의 스피커 버튼으로 즉시 음소거

## 렌더링 원칙

게임 로직은 순수 JavaScript, 그래픽은 HiDPI Canvas 2D로 유지합니다. 정적 지형은 오프스크린 캐시에 렌더링하고, 동적 유닛·탄도·충격파·후처리만 매 프레임 합성합니다. 모바일은 DPR을 1.5로 제한하고 적 수에 따라 캐릭터 디테일과 파티클을 자동 축소합니다.

Unreal Engine은 향후 키아트·베이크드 배경·트레일러 제작 도구로만 검토합니다. 친구가 URL을 열 때마다 독립 실행되어야 하는 현재 제품 조건에는 서버 GPU와 세션 인프라가 필요한 Pixel Streaming보다 정적 웹 런타임이 적합합니다.

자세한 판단 근거와 검증 기준은 [docs/VISUAL_OVERHAUL.md](docs/VISUAL_OVERHAUL.md), 외부 소스는 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)를 참조하십시오.

## 자동 검증

로컬 서버를 실행한 상태에서 Node.js 22 이상과 Chromium 계열 브라우저로 핵심 동선을 검사합니다.

```powershell
node scripts/smoke-test.mjs http://127.0.0.1:4173/
```

브라우저 경로를 자동으로 찾지 못하면 `BROWSER_BIN` 환경변수로 지정할 수 있습니다.
검사는 빌드 ID, 모바일 캔버스, 웨이브 진행, 상점, 90도 회전, 음소거 저장,
6개 효과음 응답, 서비스워커 활성화, 오프라인 캐시, 런타임 예외를 함께 판정합니다.
