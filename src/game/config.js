// ---- 튜닝 값 ----
const CFG = {
  allyStart:3,
  hp0:100, dmg0:13, fire0:0.34, range:255,
  dHp:45, dDmg:7, dFire:0.028, fireMin:0.16,   // fireMin = 아군 최소 공격 간격(초)
  perMilestone:5,
  goldStart:10, cost0:15, costMul:1.28,
  eHp0:38, eSpd0:54, eDmg0:9, eR0:13,          // 적 기본 스탯 (상향)
  eHpScale:0.50, eSpdScale:0.06, eDmgScale:0.30, // 레벨당 선형 증가폭
  eHpGeo:1.055, eDmgGeo:1.045, eSpdCap:2.4,     // 후반 기하급수 성장(HP/공격력) + 속도 상한
  spawnBase:1.05, spawnFloor:0.22, spawnStep:0.08, // 스폰: 더 촘촘하게
  enemyMax:60,                                  // 동시 생존 적 수 상한(넘으면 스폰 멈춤 → 렉/메모리 폭주 방지)
  levelSec:8,
  // ---- 스테이지 보상(레벨이 높을수록 골드 大) ----
  goldKillBase:4, goldKillPerLv:3, goldKillGeo:1.06,       // 처치 골드 = (base + lv*perLv) * geo^(lv-1)
  stageBonusBase:15, stageBonusPerLv:14,                   // 새 스테이지 도달 시 보너스 골드
  // ---- 끝내기 쿨타임 ----
  stopCooldown:60,
  checkpointEvery:50,                           // 난이도 50 간격으로 세이브포인트
  // ---- 포탑 ----
  // 상위 레벨 직접 구매가 = 그 레벨을 합체로 만드는 데 드는 비용 x launcherBuyPremium
  // (구매 횟수도 Lv1 환산 개수만큼 올라가므로, 사든 합치든 이후 가격 상승까지 동일하다)
  // 종류별로 따로 세는 보유 상한 (자리는 고정되지 않고 어디든 자유 배치)
  turretMax:14, laserMax:10, launcherMax:6,
  turretGap:5, turretEdge:14,                  // 받침끼리 띄울 여유 간격 / 맵 가장자리 여백
  // 편의 프리미엄(x1.15)을 기본가에 녹여 두었다(110 -> 127).
  // 덕분에 모든 단계가 "기본가 x 2^단계" 하나의 식으로 완전히 동일하게 계산되고,
  // 같은 단계 2개를 합치든 다음 단계를 사든 값이 정확히 똑같다.
  turretCost0:600, turretCostMul:1.06, turretSellFrac:0.5, turretTierMul:2.35,
  // style = 등급별 외형 / base·body·hh = 크기 / bl·bw·bn = 총열 길이·굵기·개수
  // 등급이 오를수록 연사가 크게 빨라진다 (초당 1.1발 → 10발)
  // DPS는 단계당 x1.85 (가격은 x2) → 상위 단계는 "골드당 효율"이 점점 나빠지는 편의 구매
  turretTiers:[
    {n:'목재 포탑', dmg:15, range:165, fire:0.95, col:'#a9743a', top:'#d0964e', style:'wood',
     base:30, body:17, hh:15, bl:16, bw:5, bn:1},
    {n:'석재 포탑', dmg:22, range:171, fire:0.85, col:'#8d949f', top:'#b8bfc9', style:'stone',
     base:33, body:19, hh:19, bl:19, bw:5.8, bn:1},
    {n:'강철 포탑', dmg:34, range:178, fire:0.76, col:'#6d7f96', top:'#9bb2cc', style:'steel',
     base:35, body:20, hh:22, bl:21, bw:6.6, bn:2},
    {n:'마법 포탑', dmg:51, range:184, fire:0.68, col:'#6d4bb0', top:'#a98bff', style:'magic',
     base:38, body:22, hh:26, bl:24, bw:7.4, bn:2, splash:26},
    {n:'화염 포탑', dmg:76, range:191, fire:0.609, col:'#b8461c', top:'#ff8a3a', style:'flame',
     base:41, body:24, hh:30, bl:27, bw:8.1, bn:2, splash:29, burn:3},
    {n:'번개 포탑', dmg:114, range:197, fire:0.545, col:'#2a6fa8', top:'#7fd4ff', style:'thunder',
     base:44, body:25, hh:34, bl:30, bw:8.9, bn:3, splash:32, burn:3, slow:1.2},
    {n:'용의 포탑', dmg:171, range:203, fire:0.487, col:'#7a1030', top:'#ff3b6b', style:'dragon',
     base:46, body:27, hh:37, bl:32, bw:9.7, bn:3, splash:36, burn:3, slow:1.2},
    {n:'수정 포탑', dmg:256, range:210, fire:0.436, col:'#125c6b', top:'#8ef0ff', style:'wood',
     base:49, body:28, hh:41, bl:35, bw:10.5, bn:3, splash:39, burn:3, slow:1.2},
    {n:'흑철 포탑', dmg:384, range:216, fire:0.39, col:'#2f2652', top:'#c9b6ff', style:'stone',
     base:52, body:30, hh:45, bl:38, bw:11.3, bn:3, splash:43, burn:3, slow:1.2},
    {n:'성역 포탑', dmg:577, range:223, fire:0.349, col:'#6b551a', top:'#ffe9a3', style:'steel',
     base:54, body:32, hh:48, bl:40, bw:12.1, bn:3, splash:46, burn:3, slow:1.2},
    {n:'심연 포탑', dmg:865, range:229, fire:0.312, col:'#3f1560', top:'#b06bff', style:'magic',
     base:57, body:33, hh:52, bl:43, bw:12.9, bn:3, splash:50, burn:4, slow:1.8},
    {n:'태양 포탑', dmg:1297, range:235, fire:0.279, col:'#6b4a08', top:'#ffd15c', style:'flame',
     base:60, body:35, hh:56, bl:46, bw:13.6, bn:3, splash:53, burn:4, slow:1.8},
    {n:'폭풍 포탑', dmg:1946, range:242, fire:0.25, col:'#0f5c45', top:'#7cf3c8', style:'thunder',
     base:63, body:37, hh:60, bl:49, bw:14.4, bn:3, splash:56, burn:4, slow:1.8},
    {n:'천공 포탑', dmg:2919, range:248, fire:0.224, col:'#1f4370', top:'#a3d8ff', style:'dragon',
     base:65, body:38, hh:63, bl:51, bw:15.2, bn:3, splash:59, burn:4, slow:1.8},
    {n:'창조 포탑', dmg:4379, range:255, fire:0.2, col:'#4a4f60', top:'#f2f7ff', style:'wood',
     base:68, body:40, hh:67, bl:54, bw:16, bn:3, splash:63, burn:4, slow:1.8},
  ],
  turretSplashFrac:0.18,
  // ---- 연사 포탑 : 기관총 계열 ----
  // 일반 포탑과 똑같이 동작하지만 공격력이 낮고 연사가 아주 빠르다.
  // 레벨이 올라도 공격력은 그대로(30 고정) — 연사 속도만 빨라진다.
  // 그래서 초중반엔 강하지만 적 체력이 오르는 후반엔 자연스럽게 밀린다.
  rapidMax:8,
  rapidCost0:420, rapidTierMul:2.05, rapidCostMul:1.05,
  rapidTiers:[
    {n:'우지', dmg:12, range:150, fire:0.3, col:'#4a4f57', top:'#9aa3ae', style:'rapid',
     base:26, body:14, hh:13, bl:18, bw:3.6, bn:1},
    {n:'AK47', dmg:12, range:159, fire:0.2244, col:'#5a4326', top:'#c08a4a', style:'rapid',
     base:28, body:15.3, hh:15, bl:20, bw:4.1, bn:1},
    {n:'M16', dmg:12, range:168, fire:0.1679, col:'#2f3a33', top:'#7f9a86', style:'rapid',
     base:30, body:16.7, hh:18, bl:23, bw:4.7, bn:1},
    {n:'MP5', dmg:12, range:177, fire:0.1256, col:'#33383f', top:'#8f98a5', style:'rapid',
     base:32, body:18, hh:20, bl:25, bw:5.2, bn:2},
    {n:'P90', dmg:12, range:186, fire:0.0939, col:'#2b3340', top:'#7fa8d8', style:'rapid',
     base:34, body:19.3, hh:22, bl:28, bw:5.8, bn:2},
    {n:'M4A1', dmg:12, range:194, fire:0.0702, col:'#3a4230', top:'#9db06f', style:'rapid',
     base:36, body:20.6, hh:25, bl:30, bw:6.3, bn:2},
    {n:'MG42', dmg:12, range:203, fire:0.0525, col:'#40342c', top:'#b08a63', style:'rapid',
     base:38, body:22, hh:27, bl:33, bw:6.9, bn:3},
    {n:'M60', dmg:12, range:212, fire:0.0393, col:'#2d3b33', top:'#6fae86', style:'rapid',
     base:40, body:23.3, hh:29, bl:35, bw:7.4, bn:3},
    {n:'M249', dmg:12, range:221, fire:0.0294, col:'#3a3320', top:'#c2b45a', style:'rapid',
     base:42, body:24.6, hh:32, bl:38, bw:8, bn:3, rotor:1},
    {n:'미니건', dmg:12, range:230, fire:0.022, col:'#5c2a12', top:'#ffb040', style:'rapid',
     base:44, body:26, hh:34, bl:40, bw:8.5, bn:3, rotor:1},
  ],
  // ---- 에너지 병기 ----
  // 코일을 넣으면 일정 시간 동안 자동 발사, 맞으면 무엇이든 즉시 소멸
  // 합체 규칙이 포탑과 다르다 : 레벨이 더해진다 (Lv1+Lv1=Lv2, Lv2+Lv1=Lv3, Lv2+Lv2=Lv4)
  // 한 번에 나가는 건 언제나 1발. 레벨이 오르면 '연사'가 빨라진다 (동시에 여러 마리를 지우지 않는다)
  launcherTiers:[
    {n:'에너지 발사기 I', range:520, fire:1, coilDur:60, col:'#16365c', top:'#5ce1ff',
     base:58, body:30, hh:46, bl:36, bw:12, bn:1, style:'energy'},
    {n:'에너지 발사기 II', range:560, fire:0.8, coilDur:70, col:'#144270', top:'#7ce9ff',
     base:63, body:33, hh:52, bl:40, bw:13, bn:2, style:'energy'},
    {n:'에너지 발사기 III', range:600, fire:0.65, coilDur:80, col:'#124d84', top:'#9df0ff',
     base:68, body:36, hh:58, bl:44, bw:14, bn:3, style:'energy'},
    {n:'에너지 발사기 IV', range:650, fire:0.55, coilDur:90, col:'#0f5897', top:'#bff6ff',
     base:73, body:39, hh:64, bl:48, bw:15, bn:3, style:'energy'},
    {n:'에너지 발사기 V', range:700, fire:0.45, coilDur:100, col:'#0b63aa', top:'#e6fcff',
     base:78, body:42, hh:70, bl:52, bw:16, bn:3, style:'energy'},
  ],
  // ---- 레이저 : 길을 가로지르는 빔. 지나가는 적이 닿아 있는 동안 계속 피해 ----
  laserTiers:[
    {n:'레이저 I',   dps:180,    width:26, len:96,  cost:2000,    col:'#5c1030', top:'#ff4d7a', base:26, hh:26},
    {n:'레이저 II',  dps:700,    width:29, len:104, cost:8000,    col:'#6b0f3e', top:'#ff5fa0', base:29, hh:30},
    {n:'레이저 III', dps:2650,   width:32, len:112, cost:32000,   col:'#4a0f6b', top:'#c46bff', base:32, hh:34},
    {n:'레이저 IV',  dps:10000,  width:35, len:120, cost:130000,  col:'#0f3f6b', top:'#5fb0ff', base:35, hh:38},
    {n:'레이저 V',   dps:38000,  width:38, len:128, cost:520000,  col:'#0f6b5a', top:'#3ef0c0', base:38, hh:42},
    {n:'레이저 VI',  dps:145000, width:42, len:138, cost:2080000, col:'#6b5a0f', top:'#ffe066', base:42, hh:46},
  ],
  laserCostMul:1.03,                            // 살수록 조금씩 비싸짐(포탑과 동일)
  launcherCost:500000, launcherTierMul:3.4,     // 발사기 : Lv1 정가 / 레벨마다 정가 x3.4
  launcherCostMul:1.12,                         // 살수록 비싸짐 (Lv1 환산 1대당 +12%)
  launcherBuyPremium:1.3,                       // 상위 레벨 직접 구매 = 합체 비용 x1.3
  // 합체 비용은 "만들어지는 레벨"에 따라 뛴다 : Lv2로 합칠 땐 600만, Lv5로 합칠 땐 6,390만
  launcherMergeGold:6000000, launcherMergeMul:2.2,
  coilCost:90000, coilCostMul:1.25,             // 코일(소모품) : 쓸수록 비싸짐
  coilDur:60,                                   // 기본 지속(레벨이 오르면 launcherTiers.coilDur 사용)
  // ---- 보스 (스테이지 5마다) ----
  bossLogDur:9, bossFloatLife:4,                 // 보스 보상 창 표시(초) / 떠오르는 글자 지속(초)
  bossEvery:5, bossHpMult:12, bossDmgMult:2.6, bossSpeedMult:0.72, bossRMult:2.4, bossReward:60, bossGoldBase:90,
  // ---- 상점 ----
  defK:60, defMaxCut:0.95, poisonFrac:0.025,  // 방어 경감 상한 95% / 독 초당 피해(최대체력 비율)                         // 방어력 경감 계수 / 독 초당 피해(최대체력 비율)
  weapons:[{n:'맨손',dmg:0},
           {n:'목검',dmg:8,cost:40},
           {n:'단검',dmg:13,cost:94},
           {n:'철검',dmg:20,cost:221},
           {n:'강철검',dmg:33,cost:519},
           {n:'미스릴 검',dmg:52,cost:1220},
           {n:'용검',dmg:84,cost:2867},
           {n:'성검',dmg:134,cost:6737},
           {n:'마검',dmg:215,cost:15832},
           {n:'뇌전검',dmg:344,cost:37205},
           {n:'화염검',dmg:550,cost:87432},
           {n:'심연검',dmg:880,cost:205465},
           {n:'태양검',dmg:1407,cost:482844},
           {n:'폭풍검',dmg:2252,cost:1134682},
           {n:'천공검',dmg:3603,cost:2666504},
           {n:'창조검',dmg:5765,cost:6266284}],
  armors:[{n:'평상복',def:0},
          {n:'천 갑옷',def:15,cost:40},   // 피해 경감 20%
          {n:'가죽 갑옷',def:26,cost:78},   // 피해 경감 30%
          {n:'사슬 갑옷',def:40,cost:152},   // 피해 경감 40%
          {n:'판금 갑옷',def:60,cost:297},   // 피해 경감 50%
          {n:'강철 갑옷',def:83,cost:578},   // 피해 경감 58%
          {n:'미스릴 갑옷',def:111,cost:1128},   // 피해 경감 65%
          {n:'용 갑옷',def:147,cost:2199},   // 피해 경감 71%
          {n:'수정 갑옷',def:190,cost:4288},   // 피해 경감 76%
          {n:'흑철 갑옷',def:240,cost:8363},   // 피해 경감 80%
          {n:'성역 갑옷',def:315,cost:16307},   // 피해 경감 84%
          {n:'심연 갑옷',def:402,cost:31798},   // 피해 경감 87%
          {n:'태양 갑옷',def:540,cost:62007},   // 피해 경감 90%
          {n:'폭풍 갑옷',def:690,cost:120914},   // 피해 경감 92%
          {n:'천공 갑옷',def:940,cost:235782},   // 피해 경감 94%
          {n:'창조 갑옷',def:1140,cost:459774}],   // 피해 경감 95%
  potionLinger:4,                                   // 물약 장 지속(초): 이 시간 동안 스폰되는 적도 확률 적용
  potionCostMul:1.16, dollCostMul:1.35,             // 소모품은 같은 종류를 살수록 비싸진다(인형은 더 가파르게)
  potions:[{key:'slow',n:'감속 물약',desc:'이속 -50%·5초',cost:30,prob:0.65},
           {key:'poison',n:'독 물약',desc:'지속 피해·6초',cost:55,prob:0.70},
           {key:'weak',n:'약화 물약',desc:'공격력 -50%·6초',cost:70,prob:0.60},
           {key:'freeze',n:'빙결 물약',desc:'완전 정지·3초',cost:130,prob:0.50},
           {key:'heal',n:'치유 물약',desc:'아군 전체 HP 60% 회복',cost:90,type:'heal',healFrac:0.6}],
  // ---- 인형(부적) : 포션보다 강력한 상위 아이템 ----
  burnFrac:0.03, burnDur:4,                          // 인형·보스보상 화상 : 초당 최대체력 비율 (1회성)
  // 포탑 화상은 "최대체력 비율"이면 적 체력이 아무리 올라도 똑같이 녹아버려서
  // 포탑 혼자 무한정 버티게 된다. 그래서 포탑 화상만 그 포탑 한 발 피해의 비율(고정값)로 준다.
  turretBurnFrac:0.30,
  //  ↑ 화상·독은 적 최대 체력의 비율로 들어가 난이도를 무시하므로 낮게 유지한다
  //    (예전 9.5%x5초 = 한 번에 47.5% 삭제 → 적 HP가 아무리 커도 두 번이면 즉사)
  reviveFrac:0.4, curseFrac:0.33, freezeDollDur:3.2, // 부활 회복률·저주 즉발피해율·빙결인형 지속
  healDollFrac:0.8,                                  // 치유인형 회복률(완전회복 → 80%)
  rageDur:8, rageDmg:1.5, rageFire:0.65,             // 분노: 지속·공격력배율·공격간격배율(↓=빠름)
  luckDur:10, luckMult:2, guardDur:8, guardDef:100,  // 행운: 지속·골드배율 / 수호: 지속·추가방어
  dolls:[{key:'revive',  n:'부활인형', desc:'죽은 아군 전원 부활(HP 40%)', cost:20000},
         {key:'heal',    n:'치유인형', desc:'아군 전원 HP 80% 회복', cost:9000},
         {key:'flame',   n:'화염인형', desc:'모든 적에게 화상·5초', cost:7000},
         {key:'curse',   n:'저주인형', desc:'모든 적 즉시 큰 피해', cost:11000},
         {key:'illusion',n:'환각인형', desc:'난이도 1레벨 감소', cost:25000},
         {key:'freeze',  n:'빙결인형', desc:'모든 적 확정 빙결·3.2초', cost:12000},
         {key:'rage',    n:'분노인형', desc:'8초간 아군 화력↑', cost:9000},
         {key:'luck',    n:'행운인형', desc:'10초간 골드 2배', cost:6000},
         {key:'guard',   n:'수호인형', desc:'8초간 아군 피해↓', cost:8000}],
};
