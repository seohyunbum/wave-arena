// ---- 상태 ----
const G = {
  phase:'idle', time:0, level:1, kills:0, gold:0,
  upTotal:0, upToward:0, spawnTimer:0, nextBossLevel:5, levelOffset:0,
  weaponTier:0, armorTier:0, shopOpen:false, potionField:[], buffs:{rageT:0,luckT:0,guardT:0},
  allies:[], enemies:[], shots:[], fx:[], nums:[], beams:[], rings:[],
  turrets:[], turretsBought:0, selTurret:null, stopCd:0, maxLevelSeen:1, anim:0, dropInfo:null, shake:0,
  launchersBought:0, coilsUsed:0, lasersBought:0, rapidsBought:0, pathIndex:0, potBought:{}, dollBought:{},
  lastCp:null, cpList:[],
};

// ---- 기록(하이스코어) : localStorage 영속 ----
const REC_KEY='wavearena_records_v1';
function loadRecords(){ let r=null; try{ r=JSON.parse(localStorage.getItem(REC_KEY)); }catch(e){}
  return (r&&typeof r==='object') ? Object.assign({bestTime:0,bestKills:0,bestLevel:0,runs:[]}, r)
                                  : {bestTime:0,bestKills:0,bestLevel:0,runs:[]}; }
function saveRecords(r){ try{ localStorage.setItem(REC_KEY, JSON.stringify(r)); }catch(e){} }
let RECORDS = loadRecords();

function levelFor(t){ return 1+Math.floor(t/CFG.levelSec); }
function enemyStats(){
  const L=G.level-1;
  return { hp:Math.round(CFG.eHp0*(1+CFG.eHpScale*L)*Math.pow(CFG.eHpGeo,L)),
           speed:CFG.eSpd0*Math.min(CFG.eSpdCap, 1+CFG.eSpdScale*L),
           dmg:CFG.eDmg0*(1+CFG.eDmgScale*L)*Math.pow(CFG.eDmgGeo,L),
           r:CFG.eR0+Math.min(8,L*0.4) };
}
function spawnInterval(){ return Math.max(CFG.spawnFloor, CFG.spawnBase-(G.level-1)*CFG.spawnStep); }
// 스테이지가 높을수록 처치 골드가 크게 증가
function killGold(){
  return Math.round((CFG.goldKillBase+CFG.goldKillPerLv*G.level)*Math.pow(CFG.goldKillGeo,G.level-1));
}
function upgradeCost(){ return Math.round(CFG.cost0*Math.pow(CFG.costMul,G.upTotal)); }
function allyStat(){
  return { maxHp:CFG.hp0+G.upTotal*CFG.dHp, dmg:CFG.dmg0+G.upTotal*CFG.dDmg,
           fire:Math.max(CFG.fireMin, CFG.fire0-G.upTotal*CFG.dFire) };
}
function weaponDmg(){ return CFG.weapons[G.weaponTier].dmg; }   // 상점 무기 보너스
function armorDef(){ return CFG.armors[G.armorTier].def; }      // 상점 방어구 방어력
function layoutAllies(){
  const b=baseNode(), N=G.allies.length, R=34+Math.max(0,N-4)*6;
  for(let i=0;i<N;i++){
    const a=(i/N)*Math.PI*2-Math.PI/2;
    G.allies[i].x=b.x+Math.cos(a)*R; G.allies[i].y=b.y+Math.sin(a)*R;
    G.allies[i].home=a;                       // 적이 없을 때 바라보는 방향(기지 바깥쪽)
  }
}
function newAlly(){
  const s=allyStat();
  return {x:0,y:0,hp:s.maxHp,maxHp:s.maxHp,dmg:s.dmg+weaponDmg(),fire:s.fire,def:armorDef(),
          range:CFG.range,r:15,cd:Math.random()*0.3,dead:false,phase:Math.random()*7,shootFlash:0,
          face:0,home:0,aimT:null};
}
function applyAllyStats(){
  const s=allyStat();
  for(const a of G.allies){
    if(a.dead) continue;
    const d=s.maxHp-a.maxHp; a.maxHp=s.maxHp; a.hp=Math.min(s.maxHp,a.hp+Math.max(0,d));
    a.dmg=s.dmg+weaponDmg(); a.fire=s.fire; a.def=armorDef();
  }
}
// 길 바꾸기 : 경로·포탑 기본자리·장식물을 다시 만들고 판을 초기화
function selectMap(i){
  G.pathIndex=(i%MAPS.length+MAPS.length)%MAPS.length;
  setPath(G.pathIndex);
  TSPOTS=buildTurretSlots();
  buildDecor(G.pathIndex);
  reset(); fitCamera(); buildGround(); updateHUD();
  const b=baseNode(); floatText(b.x,b.y,'🗺 '+MAPS[G.pathIndex].n,'#8ad3ff');
}
function reset(){
  G.enemies.length=G.shots.length=G.fx.length=G.nums.length=G.beams.length=G.rings.length=0;
  G.shake=0;
  G.time=0; G.level=1; G.kills=0; G.gold=CFG.goldStart;
  G.upTotal=0; G.upToward=0; G.spawnTimer=0; G.nextBossLevel=CFG.bossEvery; G.phase='idle';
  G.weaponTier=0; G.armorTier=0; G.shopOpen=false; G.potionField.length=0;
  G.levelOffset=0; G.buffs.rageT=0; G.buffs.luckT=0; G.buffs.guardT=0;
  G.turrets=[]; G.turretsBought=0; G.selTurret=null; G.stopCd=0; G.maxLevelSeen=1;
  G.launchersBought=0; G.coilsUsed=0; G.lasersBought=0; G.rapidsBought=0; G.potBought={}; G.dollBought={};
  G.allies=[]; for(let i=0;i<CFG.allyStart;i++) G.allies.push(newAlly());
  G.lastCp=null; G.cpList=[];
  hideBossLog();
  layoutAllies();
}

// ================= 저장 / 불러오기 / 세이브포인트 =================
const SAVE_KEY='wavearena_save_v1';
// 현재 판을 통째로 담는다 (적·발사체는 저장하지 않고 재개 시 새로 몰려온다)
// ※ 세이브포인트(G.lastCp)는 여기 담지 않는다 — 담으면 스냅샷이 직전 세이브포인트를 통째로 품고,
//    그것을 다시 스냅샷하면서 체인이 끝없이 겹쳐 쌓인다. 부활할 때마다 한 겹씩 벗겨져
//    부활 지점이 Lv150 → Lv100 → Lv50 으로 뒤로 밀리던 원인이었다.
function snapshot(){
  return {
    v:3, at:Date.now(),
    time:G.time, kills:G.kills, gold:G.gold, level:G.level,
    upTotal:G.upTotal, upToward:G.upToward, weaponTier:G.weaponTier, armorTier:G.armorTier,
    pathIndex:G.pathIndex, maxLevelSeen:G.maxLevelSeen, levelOffset:G.levelOffset,
    nextBossLevel:G.nextBossLevel, stopCd:G.stopCd,
    turretsBought:G.turretsBought, launchersBought:G.launchersBought, coilsUsed:G.coilsUsed,
    lasersBought:G.lasersBought, rapidsBought:G.rapidsBought,
    potBought:Object.assign({},G.potBought), dollBought:Object.assign({},G.dollBought),
    buffs:Object.assign({},G.buffs),
    allies:G.allies.map(a=>({hp:a.hp, dead:a.dead})),
    turrets:G.turrets.map(t=>({kind:t.kind||'turret', tier:t.tier, x:t.x, y:t.y, coilT:t.coilT||0, ang:t.ang||0})),
    cpList:G.cpList.slice()
  };
}
function restore(s){
  if(!s) return false;
  if(s.pathIndex!==undefined && s.pathIndex!==G.pathIndex){   // 길이 다르면 맵부터 다시 만든다
    G.pathIndex=s.pathIndex; setPath(G.pathIndex);
    TSPOTS=buildTurretSlots(); buildDecor(G.pathIndex); fitCamera(); buildGround();
  }
  const keepCp=G.lastCp;          // reset() 이 세이브포인트를 지우므로 잠시 맡아 둔다
  reset();
  G.lastCp=keepCp;                // 같은 세이브포인트에서 몇 번이든 다시 부활할 수 있어야 한다
  G.time=s.time||0; G.kills=s.kills||0; G.gold=s.gold||0;
  G.upTotal=s.upTotal||0; G.upToward=s.upToward||0;
  G.weaponTier=s.weaponTier||0; G.armorTier=s.armorTier||0;
  G.maxLevelSeen=s.maxLevelSeen||1; G.levelOffset=s.levelOffset||0;
  G.nextBossLevel=s.nextBossLevel||CFG.bossEvery; G.stopCd=s.stopCd||0;
  G.turretsBought=s.turretsBought||0; G.launchersBought=s.launchersBought||0; G.coilsUsed=s.coilsUsed||0;
  G.lasersBought=s.lasersBought||0; G.rapidsBought=s.rapidsBought||0;
  G.potBought=Object.assign({},s.potBought||{}); G.dollBought=Object.assign({},s.dollBought||{});
  if(s.buffs){ G.buffs.rageT=s.buffs.rageT||0; G.buffs.luckT=s.buffs.luckT||0; G.buffs.guardT=s.buffs.guardT||0; }
  G.level=Math.max(1, levelFor(G.time)-G.levelOffset);
  // 아군 : 강화·장비를 먼저 반영한 뒤 인원과 체력을 되살린다
  G.allies=[]; const n=Math.max(1,(s.allies||[]).length||CFG.allyStart);
  for(let i=0;i<n;i++) G.allies.push(newAlly());
  layoutAllies(); applyAllyStats();
  (s.allies||[]).forEach((a,i)=>{ if(!G.allies[i]) return;
    G.allies[i].dead=!!a.dead; G.allies[i].hp=Math.min(G.allies[i].maxHp, a.hp||G.allies[i].maxHp); });
  // 구조물
  G.turrets=(s.turrets||[]).map(t=>({
    kind:(t.kind==='launcher'||t.kind==='laser'||t.kind==='rapid')?t.kind:undefined,
    tier:t.tier|0, x:t.x, y:t.y,
    cd:0, shootFlash:0, aim:0, aimT:null, coilT:t.coilT||0, spin:0,
    ang:(t.kind==='laser'? (t.ang||pathAngleAt(t.x,t.y)) : 0), hitT:0, dealt:0 }));
  G.cpList=(s.cpList||[]).slice();
  // G.lastCp 은 일부러 건드리지 않는다 — 같은 세이브포인트에서 몇 번이든 다시 부활할 수 있어야 한다.
  // 저장 파일을 불러오는 경우에만 호출부가 sv.lastCp 로 따로 세워 준다.
  G.phase='paused'; G.selTurret=null;
  updateHUD();
  return true;
}
// 저장 파일 = 현재 판 + 세이브포인트 1개. lastCp 는 여기서 딱 한 겹만 붙인다(중첩 금지).
function saveGame(){
  try{
    const s=snapshot(); s.lastCp=G.lastCp||null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true;
  }catch(e){ return false; }
}
function loadSaved(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return null; } }
function deleteSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

// ---- 세이브포인트 : 난이도 50 간격 (50,100,150,...) ----
function checkpointAt(level){
  G.lastCp=snapshot();
  if(G.cpList.indexOf(level)<0) G.cpList.push(level);
  G.lastCp.cpList=G.cpList.slice();
  saveGame();                                      // 세이브포인트마다 자동 저장
  const b=baseNode();
  floatText(b.x,b.y,'🚩 세이브포인트 Lv'+level+' (자동 저장)','#7cf3ff');
  burst(b.x,b.y,'#7cf3ff',20);
}
function reviveAtCheckpoint(){
  if(!G.lastCp) return;
  const lv=G.lastCp.maxLevelSeen;
  restore(G.lastCp);
  document.getElementById('over').style.display='none';
  const b=baseNode();
  floatText(b.x,b.y,'🚩 Lv'+Math.floor(lv/CFG.checkpointEvery)*CFG.checkpointEvery+' 세이브포인트에서 부활!','#38e8b0');
  burst(b.x,b.y,'#38e8b0',24);
}
// ---- 포탑 ----
// 구조물 정의 : 일반 포탑은 등급표, 에너지 발사기는 전용 정의를 쓴다
function kindOf(t){ return (t&&t.kind) || 'turret'; }
function countKind(kind){ let n=0; for(const t of G.turrets) if(kindOf(t)===kind) n++; return n; }
function maxOfKind(kind){
  return kind==='laser' ? CFG.laserMax : kind==='launcher' ? CFG.launcherMax
       : kind==='rapid' ? CFG.rapidMax : CFG.turretMax;
}
function kindName(kind){ return kind==='laser' ? '레이저' : kind==='launcher' ? '에너지 발사기'
                              : kind==='rapid' ? '연사 포탑' : '포탑'; }
function isKindFull(kind){ return countKind(kind)>=maxOfKind(kind); }
function tdef(t){
  const k=kindOf(t);
  return k==='launcher' ? CFG.launcherTiers[t.tier]
       : k==='laser'    ? CFG.laserTiers[t.tier]
       : k==='rapid'    ? CFG.rapidTiers[t.tier]
                        : CFG.turretTiers[t.tier];
}
function isLauncher(t){ return kindOf(t)==='launcher'; }
function isLaser(t){ return kindOf(t)==='laser'; }
function isRapid(t){ return kindOf(t)==='rapid'; }
function tiersOf(t){ return isLauncher(t)?CFG.launcherTiers : isRapid(t)?CFG.rapidTiers
                          : isLaser(t)?CFG.laserTiers : CFG.turretTiers; }
function maxTier(t){ return tiersOf(t).length-1; }
function coilDurOf(t){ return tdef(t).coilDur || CFG.coilDur; }
// 합체 결과 등급 (합칠 수 없으면 -1)
//  포탑   : 같은 레벨 2개 → 한 단계 위          (Lv3+Lv3 = Lv4)
//  발사기 : 레벨이 더해진다                      (Lv1+Lv1 = Lv2, Lv2+Lv1 = Lv3, Lv2+Lv2 = Lv4)
function mergeResult(a,b){
  if(!a||!b||a===b) return -1;
  if(kindOf(a)!==kindOf(b)) return -1;                      // 서로 다른 종류는 섞이지 않음
  if(isLaser(a)) return -1;                                 // 레이저는 합체하지 않는다
  if(isLauncher(a)){
    const r=a.tier+b.tier+1;                                 // 0-based tier = 레벨-1
    return r<=maxTier(a) ? r : -1;                           // 최고 레벨을 넘으면 합체 불가
  }
  return (a.tier===b.tier && a.tier<maxTier(a)) ? a.tier+1 : -1;
}
// 발사기 합체 비용 : 만들어지는 레벨이 높을수록 비싸진다 + 에너지 코일 1개(현재 시세)
//   resTier = 0-based (Lv2로 합치면 1). Lv2 600만 · Lv3 1,320만 · Lv4 2,904만 · Lv5 6,389만
function launcherMergeCost(resTier){
  const n=Math.max(0,(resTier==null?1:resTier)-1);
  return Math.round(CFG.launcherMergeGold*Math.pow(CFG.launcherMergeMul,n)) + coilCost();
}
function canMerge(a,b){
  const r=mergeResult(a,b);
  if(r<0) return false;
  if(isLauncher(a) && G.gold<launcherMergeCost(r)) return false;   // 비용이 모자라면 합체 불가
  return true;
}
// 합체가 안 되는 이유 안내
function mergeFailMsg(a,b){
  if(!a||!b||a===b) return null;
  if(kindOf(a)!==kindOf(b)) return kindName(kindOf(a))+'와(과) '+kindName(kindOf(b))+'는 합쳐지지 않습니다';
  if(isLauncher(a)){
    if(mergeResult(a,b)<0) return 'Lv'+(a.tier+1)+'+Lv'+(b.tier+1)+'=Lv'+(a.tier+b.tier+2)
                                  +' — 최고 Lv'+(maxTier(a)+1)+'까지만 가능합니다';
    return 'Lv'+(a.tier+b.tier+2)+' 합체엔 💰'+launcherMergeCost(mergeResult(a,b)).toLocaleString()
           +' 필요 (합체금 + 코일 1개)';
  }
  if(isLaser(a)) return '레이저는 합체할 수 없습니다';
  if(a.tier!==b.tier) return kindName(kindOf(a))+'은(는) 같은 레벨끼리만 합체됩니다';
  return '최고 등급은 합체할 수 없습니다';
}
// 단계가 오를수록 정가가 turretTierMul 배씩 뛴다 (2배보다 크게 잡아 고단계를 비싸게 만든다)
//   합체는 2개 -> 1개이므로 합체 비용은 정가의 2/turretTierMul 배 = 조금 더 싸다.
//   대신 합체하려면 구매를 2번 해야 해서 구매횟수 상승분이 그만큼 더 붙어 서로 상쇄된다.
function turretUnits(tier){ return Math.pow(CFG.turretTierMul, tier||0); }
// 가격 = 기본가 x 단계배수 x 구매횟수 상승  — 전 단계가 완전히 같은 식
function turretCost(tier){
  return Math.round(CFG.turretCost0*turretUnits(tier)*Math.pow(CFG.turretCostMul,G.turretsBought));
}
function turretBasePrice(tier){ return Math.round(CFG.turretCost0*turretUnits(tier)); }
// 받침 크기 (겹침 판정 기준). 놓으려는 구조물의 정의 또는 등급으로 구한다.
function baseSizeOf(t){ return t ? tdef(t).base : CFG.turretTiers[0].base; }
// 그 자리에 놓을 수 있는지 : 맵 안 + 다른 구조물과 받침이 겹치지 않음 (길 위에는 놓을 수 있다)
// 받침은 정사각형이므로 두 축 모두 겹칠 때만 실제로 겹친다(AABB 판정)
function canPlace(x,y,exclude,size){
  const half=(size||CFG.turretTiers[0].base)/2;
  const m=CFG.turretEdge+half;
  if(x<m || y<m || x>WORLD.w-m || y>WORLD.h-m) return false;
  for(const t of G.turrets){
    if(t===exclude) continue;
    const need=half + baseSizeOf(t)/2 + CFG.turretGap;      // 두 받침 반폭 + 여유
    if(Math.abs(t.x-x)<need && Math.abs(t.y-y)<need) return false;
  }
  return true;
}
// 놓고 싶은 곳에 최대한 가까운 실제 배치 지점 (맵 밖이면 안으로 당기고, 겹치면 옆으로 밀어냄)
// → 어디에 놓든 실패하지 않는다
function placeSpot(x,y,exclude,size){
  size=size||baseSizeOf(exclude);
  const m=CFG.turretEdge+size/2;
  x=Math.max(m,Math.min(WORLD.w-m,x));
  y=Math.max(m,Math.min(WORLD.h-m,y));
  if(canPlace(x,y,exclude,size)) return {x,y};
  for(let r=6; r<=320; r+=6){                      // 드롭 지점 주변을 나선형으로 탐색
    for(let a=0;a<16;a++){
      const th=a*Math.PI/8 + r*0.35;
      const nx=Math.max(m,Math.min(WORLD.w-m, x+Math.cos(th)*r));
      const ny=Math.max(m,Math.min(WORLD.h-m, y+Math.sin(th)*r));
      if(canPlace(nx,ny,exclude,size)) return {x:nx,y:ny};
    }
  }
  return null;
}
// 구매한 구조물이 처음 놓일 자리
function spawnSpot(size){
  for(const s of TSPOTS){ if(canPlace(s.x,s.y,null,size)) return {x:s.x,y:s.y}; }
  return placeSpot(TSPOTS[0].x, TSPOTS[0].y, null, size);
}
function buyTurret(tier){
  tier=Math.max(0,Math.min(CFG.turretTiers.length-1, tier|0));
  if(G.phase==='over') return;
  if(isKindFull('turret')){
    floatText(baseNode().x,baseNode().y,'포탑은 최대 '+CFG.turretMax+'개까지','#ff8a97'); return; }
  const cost=turretCost(tier);
  if(G.gold<cost) return;
  const s=spawnSpot(CFG.turretTiers[tier].base);
  if(!s){ floatText(baseNode().x,baseNode().y,'놓을 공간이 없습니다','#ff8a97'); return; }
  G.gold-=cost; G.turretsBought++;
  G.turrets.push({tier, x:s.x, y:s.y, cd:Math.random()*0.4, shootFlash:0, aim:0, aimT:null});
  floatText(s.x,s.y,'🏰 '+CFG.turretTiers[tier].n+' 건설!','#8ad3ff');
  burst(s.x,s.y,CFG.turretTiers[tier].top,10);
  updateShop();
}
// ---- 연사 포탑 : 값은 포탑과 같은 방식(정가 x단계배수, 살수록 상승) ----
function rapidBasePrice(tier){ return Math.round(CFG.rapidCost0*Math.pow(CFG.rapidTierMul, tier||0)); }
function rapidCost(tier){
  return Math.round(rapidBasePrice(tier)*Math.pow(CFG.rapidCostMul, G.rapidsBought));
}
function buyRapid(tier){
  tier=Math.max(0,Math.min(CFG.rapidTiers.length-1, tier|0));
  if(G.phase==='over') return;
  if(isKindFull('rapid')){
    floatText(baseNode().x,baseNode().y,'연사 포탑은 최대 '+CFG.rapidMax+'개까지','#ff8a97'); return; }
  const cost=rapidCost(tier); if(G.gold<cost) return;
  const R=CFG.rapidTiers[tier];
  const s=spawnSpot(R.base);
  if(!s){ floatText(baseNode().x,baseNode().y,'놓을 공간이 없습니다','#ff8a97'); return; }
  G.gold-=cost; G.rapidsBought++;
  G.turrets.push({kind:'rapid', tier, x:s.x, y:s.y, cd:Math.random()*0.2,
                  shootFlash:0, aim:0, aimT:null, hitT:0, dealt:0, spin:0});
  floatText(s.x,s.y,'🔫 '+R.n+' 배치!',R.top);
  burst(s.x,s.y,R.top,10);
  updateShop();
}
// ---- 레이저 ----
function laserCost(tier){
  return Math.round(CFG.laserTiers[tier||0].cost*Math.pow(CFG.laserCostMul, G.lasersBought));
}
function buyLaser(tier){
  tier=Math.max(0,Math.min(CFG.laserTiers.length-1, tier|0));
  if(G.phase==='over') return;
  if(isKindFull('laser')){
    floatText(baseNode().x,baseNode().y,'레이저는 최대 '+CFG.laserMax+'개까지','#ff8a97'); return; }
  const cost=laserCost(tier); if(G.gold<cost) return;
  const L=CFG.laserTiers[tier];
  // 길 위(빔이 길을 가로지르도록)에 우선 배치
  let sp=null;
  for(const q of TSPOTS){
    const c=nearestPathPoint(q.x,q.y);
    if(canPlace(c.x,c.y,null,L.base)){ sp={x:c.x,y:c.y}; break; }
  }
  if(!sp) sp=spawnSpot(L.base);
  if(!sp){ floatText(baseNode().x,baseNode().y,'놓을 공간이 없습니다','#ff8a97'); return; }
  G.gold-=cost; G.lasersBought++;
  G.turrets.push({kind:'laser', tier, x:sp.x, y:sp.y, ang:pathAngleAt(sp.x,sp.y), hitT:0, dealt:0});
  floatText(sp.x,sp.y,'📡 '+L.n+' 설치!',L.top);
  burst(sp.x,sp.y,L.top,16);
  updateShop();
}
// 길 위에서 가장 가까운 점 (레이저를 길 한가운데 놓기 위해)
function nearestPathPoint(x,y){
  let best=1e9, bx=x, by=y;
  for(let i=0;i<WP.length-1;i++){
    const a=WP[i], b=WP[i+1], dx=b.x-a.x, dy=b.y-a.y, L2=dx*dx+dy*dy||1;
    let u=((x-a.x)*dx+(y-a.y)*dy)/L2; u=Math.max(0,Math.min(1,u));
    const px=a.x+dx*u, py=a.y+dy*u, d=Math.hypot(x-px,y-py);
    if(d<best){ best=d; bx=px; by=py; }
  }
  return {x:bx, y:by};
}

// ---- 에너지 병기 ----
// 레벨이 더해지는 합체라 Lv(n) = Lv1 n대 분량 (합체 환산에 쓰는 단위)
function launcherUnits(tier){ return (tier||0)+1; }
// 정가 = 기본가 x 레벨배수^레벨 x (상위 레벨은 직접구매 할증)
function launcherBasePrice(tier){
  const prem = tier>0 ? CFG.launcherBuyPremium : 1;
  return Math.round(CFG.launcherCost*Math.pow(CFG.launcherTierMul, tier||0)*prem);
}
// 실제 구매가 = 정가 x 지금까지 산 단위 수만큼의 상승분
function launcherCost(tier){
  return Math.round(launcherBasePrice(tier)*Math.pow(CFG.launcherCostMul, G.launchersBought));
}
function coilCost(){ return Math.round(CFG.coilCost*Math.pow(CFG.coilCostMul,G.coilsUsed)); }
function buyLauncher(tier){
  tier=Math.max(0,Math.min(CFG.launcherTiers.length-1, tier|0));
  if(G.phase==='over') return;
  if(isKindFull('launcher')){
    floatText(baseNode().x,baseNode().y,'에너지 발사기는 최대 '+CFG.launcherMax+'대까지','#ff8a97'); return; }
  const cost=launcherCost(tier); if(G.gold<cost) return;
  const s=spawnSpot(CFG.launcherTiers[tier].base);
  if(!s){ floatText(baseNode().x,baseNode().y,'놓을 공간이 없습니다','#ff8a97'); return; }
  G.gold-=cost; G.launchersBought+=launcherUnits(tier);   // 합체 경로와 동일하게 환산
  G.turrets.push({kind:'launcher', tier, x:s.x, y:s.y, cd:0, shootFlash:0, aim:0, aimT:null, coilT:0});
  floatText(s.x,s.y,'⚡ '+CFG.launcherTiers[tier].n+' 설치!','#5ce1ff');
  burst(s.x,s.y,'#5ce1ff',16);
  updateShop();
}
function buyCoil(){
  const L=G.turrets.filter(isLauncher);
  if(!L.length){ floatText(baseNode().x,baseNode().y,'먼저 에너지 발사기를 설치하세요','#ff8a97'); return; }
  const cost=coilCost(); if(G.gold<cost) return;
  // 고른 발사기 우선 → 없으면 비어있는 발사기 → 그것도 없으면 남은 시간이 가장 적은 것
  let t = isLauncher(G.selTurret) ? G.selTurret
        : (L.find(x=>x.coilT<=0) || L.slice().sort((a,b)=>a.coilT-b.coilT)[0]);
  G.gold-=cost; G.coilsUsed++;
  t.coilT+=coilDurOf(t);                      // 레벨이 높을수록 오래 간다(충전 중이면 연장)
  t.cd=0;
  floatText(t.x,t.y,'⚡ 코일 장착! '+Math.round(t.coilT)+'초','#7cf3ff');
  burst(t.x,t.y,'#7cf3ff',24);
  updateShop();
}
// 총구 높이 : 발사체가 총열 끝에서 나가도록
function muzzleZ(t){ const T=tdef(t);                      // drawTurret 의 총열 높이와 동일
  return 8+t.tier*0.8 + T.hh + (10+t.tier*1.4)*0.30; }
function mergeTurrets(src,dst){
  const r=mergeResult(src,dst); if(r<0) return false;
  const nrg=isLauncher(dst);
  if(nrg){
    const cost=launcherMergeCost(r);
    if(G.gold<cost){                                        // 합체금 + 코일 1개가 있어야 합체
      floatText(dst.x,dst.y,'합체엔 💰'+cost.toLocaleString()+' 필요','#ff8a97');
      return false;
    }
    G.gold-=cost; G.coilsUsed++;                            // 코일 1개를 합체에 소모
  }
  dst.tier=r; dst.cd=0;
  if(nrg) dst.coilT=coilDurOf(dst);                         // 코일을 넣었으니 완충 상태로 나온다
  G.turrets=G.turrets.filter(t=>t!==src);
  if(!canPlace(dst.x,dst.y,dst,tdef(dst).base)){            // 합체로 받침이 커져 겹치면 옆으로 밀어냄
    const sp=placeSpot(dst.x,dst.y,dst,tdef(dst).base);
    if(sp){ dst.x=sp.x; dst.y=sp.y; }
  }
  G.selTurret=null;
  floatText(dst.x,dst.y,'✨ '+tdef(dst).n+(nrg?' (코일 '+Math.round(dst.coilT)+'초)':' Lv'+(dst.tier+1))+'!',
            nrg?'#7cf3ff':'#ffd166');
  burst(dst.x,dst.y, nrg?'#7cf3ff':'#ffd166', 22);
  return true;
}
function moveTurret(t,x,y){                             // 포탑을 원하는 위치로 이동(항상 성공)
  if(!t) return false;
  const s=placeSpot(x,y,t); if(!s) return false;
  burst(t.x,t.y,'#8ad3ff',6);
  t.x=s.x; t.y=s.y;
  if(isLaser(t)) t.ang=pathAngleAt(t.x,t.y);       // 빔은 항상 길을 가로지르게
  floatText(s.x,s.y,'↔ '+(isLaser(t)?'레이저':'포탑')+' 이동','#8ad3ff');
  G.selTurret=null;
  return true;
}
function autoMerge(){                                   // 가능한 쌍 중 가장 좋은 조합으로 합체
  for(const kind of ['turret','rapid']){               // 같은 레벨 2개 → 한 단계 위
    const max=(kind==='rapid'?CFG.rapidTiers:CFG.turretTiers).length-1;
    for(let tier=max-1; tier>=0; tier--){
      const list=G.turrets.filter(t=>kindOf(t)===kind && t.tier===tier);
      if(list.length>=2) return mergeTurrets(list[0],list[1]);
    }
  }
  const L=G.turrets.filter(isLauncher);                 // 발사기 : 합쳐서 가장 높아지는 조합
  let best=null, bestR=-1;
  for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){
    const r=mergeResult(L[i],L[j]);
    if(r>bestR){ bestR=r; best=[L[i],L[j]]; }
  }
  if(best) return mergeTurrets(best[0],best[1]);
  floatText(baseNode().x,baseNode().y,'합체할 짝이 없습니다','#ff8a97');
  return false;
}
// 판매 환불 기준가 (종류별 정가)
function basePriceOf(t){
  return isLauncher(t) ? launcherBasePrice(t.tier)
       : isLaser(t)    ? CFG.laserTiers[t.tier].cost
       : isRapid(t)    ? rapidBasePrice(t.tier)
                       : turretBasePrice(t.tier);
}
function sellTurret(){
  const t=G.selTurret || G.turrets[G.turrets.length-1];
  if(!t) return;
  const refund=Math.round(basePriceOf(t)*CFG.turretSellFrac);
  G.gold+=refund; G.turrets=G.turrets.filter(x=>x!==t); G.selTurret=null;
  floatText(t.x,t.y,kindName(kindOf(t))+' 판매 💰+'+refund,'#ffd166');
  updateShop();
}

function spawnEnemy(){
  const s=enemyStats(), st=WP[0];
  const e={x:st.x,y:st.y,hp:s.hp,maxHp:s.hp,speed:s.speed,dmg:s.dmg,r:s.r,
           seg:1,target:null,atk:0,flash:0,phase:Math.random()*7,face:0,atkPose:0,
           slowT:0,weakT:0,freezeT:0,poisonT:0,burnT:0,burnPct:0,burnDps:0,visual:enemyVisualSpec(G.level,false)};
  for(const f of G.potionField){ if(Math.random()<f.prob) applyPotion(e,f.key); } // 잔류 물약장 → 신규 적에도 확률 적용
  G.enemies.push(e);
}
function spawnBoss(){
  const s=enemyStats(), st=WP[0], hp=Math.round(s.hp*CFG.bossHpMult);
  const e={x:st.x,y:st.y,hp,maxHp:hp,speed:s.speed*CFG.bossSpeedMult,dmg:s.dmg*CFG.bossDmgMult,
           r:CFG.eR0*CFG.bossRMult,seg:1,target:null,atk:0,flash:0,phase:Math.random()*7,face:0,atkPose:0,
           slowT:0,weakT:0,freezeT:0,poisonT:0,burnT:0,burnPct:0,burnDps:0,isBoss:true,bossLevel:G.level,visual:enemyVisualSpec(G.level,true)};
  for(const f of G.potionField){ if(Math.random()<f.prob) applyPotion(e,f.key); }
  G.enemies.push(e);
  floatText(st.x,st.y,'⚠ 보스 등장! (스테이지 '+G.level+')','#ff3b6b');
  ringFx(st.x,st.y,'rgb(255,74,108)',72,.85); G.shake=Math.max(G.shake,7);
  playSfx('warning',.58,600);
}
function lerpAng(a,b,k){                      // 각도 보간(최단 회전)
  a=a||0; let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  return a+d*k;
}
function nearestAlly(x,y){
  let best=null,bd=1e9;
  for(const a of G.allies){ if(a.dead)continue; const d=(a.x-x)**2+(a.y-y)**2; if(d<bd){bd=d;best=a;} }
  return best;
}
// 조준 목표 유지 : 쏘던 적이 살아있고 아직 범위 안이면 계속 그 적을 겨눈다
// (매 프레임 "가장 가까운 적"으로 바꾸면 적이 몰릴 때 몸이 홱홱 돌아감)
function keepTarget(cur,x,y,range){
  if(cur && !cur.dead){
    const dx=cur.x-x, dy=cur.y-y;
    if(dx*dx+dy*dy<=range*range) return cur;
  }
  return nearestEnemy(x,y,range);
}
// 가장 가까운 적 n마리 (에너지 발사기가 한 번에 여러 발 쏠 때 사용)
function nearestEnemies(x,y,range,n){
  if(n===1){ const e=nearestEnemy(x,y,range); return e?[e]:[]; }
  const r2=range*range, arr=[];
  for(const e of G.enemies){
    const d=(e.x-x)**2+(e.y-y)**2;
    if(d<=r2) arr.push({e,d});
  }
  arr.sort((a,b)=>a.d-b.d);
  const out=[]; for(let i=0;i<arr.length&&i<n;i++) out.push(arr[i].e);
  return out;
}
function nearestEnemy(x,y,range){
  let best=null,bd=range*range;
  for(const e of G.enemies){ const d=(e.x-x)**2+(e.y-y)**2; if(d<bd){bd=d;best=e;} }
  return best;
}
function hitEnemy(e,dmg,p,direct){
  e.hp-=dmg; e.flash=.12;
  if(p){ if(p.burn){ e.burnT=Math.max(e.burnT,p.burn);
                     // 포탑 화상 = 고정 피해. 인형 화상(비율)과 겹치면 둘 다 들어간다.
                     e.burnDps=Math.max(e.burnDps||0, (p.dmg||0)*CFG.turretBurnFrac); }
         if(p.slow) e.slowT=Math.max(e.slowT,p.slow); }
  if(direct){ damageNum(e.x,e.y,dmg,'#ffe08a'); burst(e.x,e.y,(p&&p.col)||'#ffd166',4);
    ringFx(e.x,e.y,'rgb(255,210,92)',10,.22); playSfx('hit',.12,65); }
  if(e.hp<=0) e.dead=true;
}
function damageNum(x,y,v,c){
  if(G.nums.length>60) return;                 // 적이 많을 때 숫자 폭주 방지
  G.nums.push({x,y,val:Math.round(v),color:c,t:0,rise:0}); }
function floatText(x,y,txt,c,life){ G.nums.push({x,y,txt,color:c,t:0,rise:0,big:true,life:life||0.9}); }
function burst(x,y,c,n){
  if(REDUCE) n=Math.ceil(n*0.3);
  if(G.enemies.length>30) n=Math.ceil(n*0.35);           // 적이 많으면 파티클 줄임
  if(G.fx.length>260) return;                            // 파티클 총량 상한
  for(let i=0;i<n;i++){ const a=Math.random()*7, sp=40+Math.random()*150;
    G.fx.push({x,y,z:16+Math.random()*14,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
               vz:70+Math.random()*130,life:.55+Math.random()*.3,t:0,color:c}); }
}

function retainInPlace(list,keep){
  let write=0;
  for(let read=0;read<list.length;read++){
    const value=list[read];
    if(keep(value)) list[write++]=value;
  }
  list.length=write;
}
const keepShot=p=>!p.dead;
const keepEnemy=e=>!e.dead;
const keepFx=f=>f.t<f.life;
const keepRing=r=>r.t<r.life;
const keepBeam=b=>b.t<b.life;
const keepNumber=n=>n.t<(n.life||(n.big?0.9:0.7));
// ---- 루프 ----
let last=0;
function frame(ts){
  const elapsed=last?Math.min(.25,(ts-last)/1000):0;
  last=ts;
  if(elapsed<=0) update(0);
  else {
    let remaining=elapsed, steps=0;
    while(remaining>0.00001 && steps<8){
      const dt=Math.min(1/30,remaining);
      update(dt); remaining-=dt; steps++;
    }
  }
  draw();
  requestAnimationFrame(frame);
}

function update(dt){
  G.anim+=dt;                                    // 장식 애니메이션용 시계(항상 진행)
  if(G.phase==='running' && !G.shopOpen){
    G.time+=dt; G.level=Math.max(1, levelFor(G.time)-G.levelOffset);   // 환각인형 = 난이도 감소
    if(G.stopCd>0) G.stopCd=Math.max(0,G.stopCd-dt);                   // 끝내기 쿨타임(게임 진행 중에만 감소)
    while(G.level>G.maxLevelSeen){                                     // 새 스테이지 도달 = 보너스 골드
      G.maxLevelSeen++;
      const bonus=Math.round(CFG.stageBonusBase+CFG.stageBonusPerLv*G.maxLevelSeen)
                  *(G.buffs.luckT>0?CFG.luckMult:1);
      G.gold+=bonus;
      const b=baseNode(); floatText(b.x,b.y,'스테이지 '+G.maxLevelSeen+' 💰+'+bonus,'#ffd166');
      if(G.maxLevelSeen%CFG.checkpointEvery===0) checkpointAt(G.maxLevelSeen);   // 50 간격 세이브포인트
    }
    while(G.level>=G.nextBossLevel){ spawnBoss(); G.nextBossLevel+=CFG.bossEvery; }  // 5스테이지마다 보스
    G.spawnTimer-=dt;                                   // 적이 상한만큼 쌓였으면 잠시 스폰 중단
    if(G.spawnTimer<=0){ if(G.enemies.length<CFG.enemyMax) spawnEnemy(); G.spawnTimer=spawnInterval(); }
    if(G.potionField.length){ for(const f of G.potionField) f.t-=dt; G.potionField=G.potionField.filter(f=>f.t>0); }
    for(const k in G.buffs){ if(G.buffs[k]>0) G.buffs[k]-=dt; }        // 인형 버프 타이머
  }
  const active = (G.phase==='running'||G.phase==='paused') && !G.shopOpen;

  const rage=G.buffs.rageT>0;
  if(active) for(const a of G.allies){
    if(a.dead) continue; a.cd-=dt; if(a.shootFlash>0) a.shootFlash-=dt;
    const tgt=a.aimT=keepTarget(a.aimT,a.x,a.y,a.range);     // 사거리 안의 목표(쓰러질 때까지 유지)
    const look=tgt||nearestEnemy(a.x,a.y,a.range*1.8);       // 사거리 밖이면 다가오는 적을 미리 봄
    if(look) a.face=lerpAng(a.face, Math.atan2(look.y-a.y, look.x-a.x), 1-Math.pow(1e-9,dt));
    else     a.face=lerpAng(a.face, a.home, 1-Math.pow(0.02,dt));        // 적이 없으면 바깥쪽
    if(a.cd<=0 && tgt){                                      // 발사 : 쏘는 쪽을 정확히 바라봄
      a.face=Math.atan2(tgt.y-a.y, tgt.x-a.x);
      a.cd=a.fire*(rage?CFG.rageFire:1); a.shootFlash=0.08;
      const visualTier=Math.max(visualClamp(G.upTotal,15),visualClamp(G.weaponTier,15));
      G.shots.push({x:a.x,y:a.y,target:tgt,dmg:a.dmg*(rage?CFG.rageDmg:1),speed:540,col:'#ffd166',
                    visual:projectileVisualSpec('ally',visualTier)});
    }
  }
  for(const t of G.turrets){                     // 총구 조준(정지 중에도 계속 목표를 향함)
    if(isLaser(t)) continue;
    const T=tdef(t);
    t.aimT=keepTarget(t.aimT,t.x,t.y,T.range);   // 사거리 안의 목표를 유지
    const aim=t.aimT||nearestEnemy(t.x,t.y,T.range*1.5);
    if(aim) t.aim=lerpAng(t.aim, Math.atan2(aim.y-t.y, aim.x-t.x), 1-Math.pow(1e-9,dt));
  }
  // ---- 레이저 : 빔에 닿아 있는 적에게 계속 피해 ----
  if(active) for(const t of G.turrets){
    if(!isLaser(t)) continue;
    const L=tdef(t), hl=L.len/2, hw=L.width/2;
    const ca=Math.cos(t.ang), sa=Math.sin(t.ang);
    let hit=0;
    for(const e of G.enemies){
      if(e.dead) continue;
      const dx=e.x-t.x, dy=e.y-t.y;
      if(Math.abs(dx*ca+dy*sa) > hl+e.r) continue;          // 빔 길이 밖
      if(Math.abs(-dx*sa+dy*ca) > hw+e.r) continue;         // 빔 두께 밖
      const dmg=L.dps*dt;
      e.hp-=dmg; e.flash=Math.max(e.flash,0.06); t.dealt+=dmg; hit++;
      if(e.hp<=0) e.dead=true;
    }
    t.hitT-=dt;
    if(hit && t.hitT<=0){                                    // 누적 피해를 가끔 숫자로 표시
      t.hitT=0.45; damageNum(t.x,t.y,t.dealt,L.top); t.dealt=0;
      if(!REDUCE) burst(t.x,t.y,L.top,2);
    }
  }
  if(active) for(const t of G.turrets){          // 포탑도 함께 사격
    if(isLaser(t)) continue;
    const T=tdef(t);
    t.cd-=dt; if(t.shootFlash>0) t.shootFlash-=dt;
    if(isLauncher(t)){                           // ---- 에너지 발사기 : 코일이 있어야 발사 ----
      if(t.coilT>0 && G.phase==='running'){      // 정비 중(끝내기)에는 코일이 닳지 않는다
        t.coilT-=dt;
        if(t.coilT<=0){ t.coilT=0; floatText(t.x,t.y,'에너지 코일 소진 — 새 코일을 넣으면 재가동','#ff8a97'); }
      }
      if(t.coilT>0 && t.cd<=0){
        const e=nearestEnemies(t.x,t.y,T.range,1)[0];   // 언제나 1발 — 레벨은 연사 속도만 올린다
        if(e){
          t.cd=T.fire; t.shootFlash=0.3;
          t.aim=Math.atan2(e.y-t.y, e.x-t.x);
          const mz=muzzleZ(t), off=T.base*0.2+T.bl;
          const bx=t.x+Math.cos(t.aim)*off, by=t.y+Math.sin(t.aim)*off;
          G.beams.push({x1:bx, y1:by, z1:mz, x2:e.x, y2:e.y, z2:26, t:0, life:0.3,
                        visual:projectileVisualSpec('launcher',t.tier)});
          e.hp=-1; e.dead=true; e.flash=0.2;   // 무한 데미지 : 보스도 한 방
          ringFx(e.x,e.y,'rgb(104,235,255)',58,.55); G.shake=Math.max(G.shake,e.isBoss?8:4);
          playSfx(e.isBoss?'heavy':'confirm',e.isBoss ? .62 : .24,180);
          burst(e.x,e.y,'#7cf3ff',14);
          floatText(e.x,e.y,'⚡ 소멸','#7cf3ff');
        }
      }
      continue;
    }
    const rap=isRapid(t);
    if(rap){                                     // 연사 포탑 : 초당 수십 발이라 피해 숫자를 모아 표시
      t.hitT-=dt;
      if(t.dealt>0 && t.hitT<=0){ t.hitT=0.4; damageNum(t.x,t.y,Math.round(t.dealt),T.top); t.dealt=0; }
      if(T.rotor) t.spin=(t.spin||0)+dt*(t.shootFlash>0?26:4);     // 미니건 총열 회전
    }
    if(t.cd<=0){ const e=t.aimT;                 // 바라보고 있는 그 적을 쏜다
      if(e){ t.cd=T.fire*(rage?CFG.rageFire:1); t.shootFlash=rap?0.05:0.1;
        t.aim=Math.atan2(e.y-t.y, e.x-t.x);                        // 발사 순간엔 정확히 조준
        const mz=muzzleZ(t), off=T.base*0.2+T.bl;          // drawTurret 의 총구 위치와 동일
        G.shots.push({x:t.x+Math.cos(t.aim)*off, y:t.y+Math.sin(t.aim)*off, z:mz,
                      target:e,dmg:T.dmg*(rage?CFG.rageDmg:1),speed:rap?1400:640,
                      col:T.top,splash:T.splash||0,burn:T.burn||0,slow:T.slow||0,
                      size:rap?3.2:5+t.tier, src:rap?t:null,
                      visual:projectileVisualSpec(rap?'rapid':'turret',t.tier)});
        if(!rap || !REDUCE) burst(t.x+Math.cos(t.aim)*off, t.y+Math.sin(t.aim)*off, T.top, rap?1:2); } }
  }
  if(active){
    for(const p of G.shots){
      if(!p.target||p.target.hp<=0){ p.dead=true; continue; }
      const dx=p.target.x-p.x, dy=p.target.y-p.y, d=Math.hypot(dx,dy)||1, step=p.speed*dt;
      if(d<=step+p.target.r){
        p.dead=true;
        const cx=p.target.x, cy=p.target.y;
        if(p.src){ p.src.dealt+=p.dmg; hitEnemy(p.target,p.dmg,p,false); }  // 연사탄은 숫자를 모아서
        else hitEnemy(p.target,p.dmg,p,true);
        if(p.splash>0){ const r2=p.splash*p.splash;
          for(const e of G.enemies){ if(e===p.target||e.dead) continue;
            if((e.x-cx)**2+(e.y-cy)**2<=r2) hitEnemy(e,p.dmg*CFG.turretSplashFrac,p,false); }
          burst(cx,cy,p.col||'#ffd166',8);
        }
      } else { p.x+=dx/d*step; p.y+=dy/d*step; }
    }
    retainInPlace(G.shots,keepShot);
  }

  if(active) for(const e of G.enemies){
    if(e.dead) continue; if(e.flash>0) e.flash-=dt;
    // 디버프 처리
    if(e.slowT>0) e.slowT-=dt;
    if(e.weakT>0) e.weakT-=dt;
    if(e.poisonT>0){ e.poisonT-=dt; e.hp-=e.maxHp*CFG.poisonFrac*dt;
      if(e.hp<=0){ e.dead=true; continue; } }
    if(e.burnT>0){ e.burnT-=dt;                                     // 화상 : 비율(인형) + 고정(포탑)
      e.hp-=(e.maxHp*(e.burnPct||0) + (e.burnDps||0))*dt;
      if(e.burnT<=0){ e.burnPct=0; e.burnDps=0; }
      if(e.hp<=0){ e.dead=true; continue; } }
    if(e.freezeT>0){ e.freezeT-=dt; continue; }   // 빙결: 이동·공격 정지
    e.phase+=dt*7;
    if(e.atkPose>0) e.atkPose-=dt;
    const sp = e.slowT>0 ? e.speed*0.5 : e.speed;
    if(e.seg<WP.length){
      const w=WP[e.seg], dx=w.x-e.x, dy=w.y-e.y, d=Math.hypot(dx,dy)||1;
      e.face=lerpAng(e.face, Math.atan2(dy,dx), 1-Math.pow(0.002,dt));   // 진행 방향을 바라봄
      if(d<6){ e.seg++; } else { e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
    } else {
      let t=e.target; if(!t||t.dead) t=e.target=nearestAlly(e.x,e.y);
      if(t){
        const dx=t.x-e.x, dy=t.y-e.y, d=Math.hypot(dx,dy)||1, contact=e.r+t.r;
        e.face=lerpAng(e.face, Math.atan2(dy,dx), 1-Math.pow(0.002,dt));
        if(d>contact-2){ e.x+=dx/d*sp*dt; e.y+=dy/d*sp*dt; }
        else { e.atk-=dt; if(e.atk<=0){ e.atk=.8; e.atkPose=0.35;
          const ed=e.dmg*(e.weakT>0?0.5:1);              // 약화 = 공격력 절반
          const edef=t.def+(G.buffs.guardT>0?CFG.guardDef:0);          // 수호인형 = 추가 방어
          const cut=edef>0 ? Math.min(CFG.defMaxCut, edef/(edef+CFG.defK)) : 0;
          const taken=ed*(1-cut);                                      // 방어력 경감(상한 95%)
          t.hp-=taken; damageNum(t.x,t.y,taken,'#ff8a97');
          if(t.hp<=0){ t.dead=true; burst(t.x,t.y,'#38e8b0',18); } } }
      }
    }
  }
  if(active){
    const luck=G.buffs.luckT>0?CFG.luckMult:1, kg=killGold();
    for(const e of G.enemies){ if(e.dead){ G.kills++; G.gold+=kg*luck;
      burst(e.x,e.y, e.isBoss?'#ff3b6b':'#ff5a6a', e.isBoss?28:10);
      ringFx(e.x,e.y,e.isBoss?'rgb(255,65,112)':'rgb(255,92,112)',e.isBoss?90:24,e.isBoss ? .95 : .38);
      if(e.isBoss){ G.shake=Math.max(G.shake,11); playSfx('heavy',.68,450); playSfx('reward',.44,450); dropBossReward(e); } } }   // 보스: 대량 골드 + 랜덤 아이템(강할수록 좋음)
    retainInPlace(G.enemies,keepEnemy);
  }

  for(const f of G.fx){ f.t+=dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.z+=f.vz*dt; f.vz-=320*dt;
    if(f.z<0){ f.z=0; f.vz*=-0.35; } f.vx*=.93; f.vy*=.93; }
  retainInPlace(G.fx,keepFx);
  for(const r of G.rings) r.t+=dt;
  retainInPlace(G.rings,keepRing);
  G.shake=Math.max(0,G.shake-dt*28);
  if(G.beams.length){ for(const bm of G.beams) bm.t+=dt; retainInPlace(G.beams,keepBeam); }
  for(const n of G.nums){ n.t+=dt; n.rise+=(n.big?34:26)*dt; }
  retainInPlace(G.nums,keepNumber);
  if(bossLogT>0 && !G.shopOpen){ bossLogT-=dt; if(bossLogT<=0) hideBossLog(); }   // 상점 보는 동안은 유지

  if(active && G.allies.every(a=>a.dead)) endGame();
  updateHUD();
}

// ---- 등급별 방어 기지·발사체 렌더러 ---------------------------------------
function drawBaseFortress(g,compact){
  const b=baseNode(),V=baseVisualSpec(G.upTotal),pulse=.5+.5*Math.sin(G.anim*(2.1+V.grade*.22));
  if(V.shield&&!compact){
    g.save(); g.globalCompositeOperation='lighter';
    screenEllipse(g,b.x,b.y,5,70+pulse*5,70+pulse*5,V.glow+'10',V.glow+'88',Math.max(1,1.7*CAM.scale));
    g.restore();
  }
  if(compact){
    box(g,b.x,b.y,0,54,54,8,V.base); box(g,b.x,b.y,8,24,24,V.keepHeight,V.armor);
    box(g,b.x,b.y,8+V.keepHeight,13,13,7,V.glow); return;
  }
  const P=[],add=(x,y,z,len,wid,h,c,a)=>P.push({x,y,z,len,wid,h,c,a:a||0});
  add(b.x,b.y,0,78,78,7,V.base,0);
  for(let i=0;i<V.grade+1;i++) add(b.x,b.y,6+i*2.2,70-i*4,70-i*4,2,V.trim,0);
  const corners=[[-54,-54],[54,-54],[54,54],[-54,54]];
  for(let i=0;i<V.towers;i++){
    const q=corners[i],h=V.wallHeight+7+(i%2)*3;
    add(b.x+q[0],b.y+q[1],0,17+V.variant,17+V.variant,h,V.dark,0);
    add(b.x+q[0],b.y+q[1],h,21+V.grade,21+V.grade,5,V.armor,G.anim*.18*(i%2?1:-1));
    add(b.x+q[0],b.y+q[1],h+5,8,8,6+V.grade,V.glow,0);
  }
  add(b.x,b.y-54,2,88,7,V.wallHeight,V.armor,0);
  add(b.x,b.y+54,2,88,7,V.wallHeight,V.armor,0);
  add(b.x-54,b.y,2,88,7,V.wallHeight,V.armor,Math.PI/2);
  add(b.x+54,b.y,2,88,7,V.wallHeight,V.armor,Math.PI/2);
  add(b.x,b.y,7,27+V.grade*2,27+V.grade*2,V.keepHeight,V.dark,0);
  add(b.x,b.y,7+V.keepHeight*.42,34+V.variant*3,34+V.variant*3,5,V.armor,G.anim*.12);
  add(b.x,b.y,7+V.keepHeight,20+V.grade,20+V.grade,7,V.trim,-G.anim*.18);
  add(b.x,b.y,14+V.keepHeight,10+V.grade*.8,10+V.grade*.8,9+V.grade,V.glow,G.anim*.36);
  for(let i=0;i<V.orbitals;i++){
    const a=G.anim*(.45+i*.08)+i*Math.PI*2/V.orbitals,r=27+V.grade*3;
    add(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r,20+V.keepHeight+i*3,9,5,4,V.glow,a);
  }
  P.sort((q,r)=>(depthOf(q.x,q.y)-depthOf(r.x,r.y))||q.z-r.z);
  for(const q of P) rbox(g,q.x,q.y,q.z,q.len,q.wid,q.h,q.a,q.c);
  if(V.grade>=2){
    const sx=isoX(b.x,b.y),sy=isoY(b.x,b.y,22+V.keepHeight);
    g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=.18+.15*pulse; g.fillStyle=V.glow;
    g.beginPath(); g.arc(sx,sy,Math.max(3,(6+V.grade*1.5)*CAM.scale),0,7); g.fill(); g.restore();
  }
}
function drawProjectile(g,o,compact){
  const v=o.visual||projectileVisualSpec('ally',0),ps=o.size||7,z=o.z==null?30:o.z;
  const sx=isoX(o.x,o.y),sy=isoY(o.x,o.y,z);
  const tx=o.target?isoX(o.target.x,o.target.y):sx,ty=o.target?isoY(o.target.x,o.target.y,22):sy;
  const bx=sx-tx,by=sy-ty,dl=Math.hypot(bx,by)||1,ux=-bx/dl,uy=-by/dl,px=-uy,py=ux;
  const col=o.col||'#ffd166',trail=Math.max(7,(16+v.grade*5)*v.trailScale*CAM.scale);
  const radius=Math.max(1.35,(ps*.28+v.grade*.28)*CAM.scale),rapid=v.kind==='rapid';
  g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
  if(!compact&&!rapid){
    g.globalAlpha=.14+.025*v.grade; g.strokeStyle=col; g.lineWidth=Math.max(3,(ps*1.35+v.grade)*CAM.scale);
    g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx-ux*trail,sy-uy*trail); g.stroke();
  }
  g.globalAlpha=.72; g.strokeStyle=col; g.lineWidth=Math.max(1.3,(rapid?1.7:2.2+v.grade*.28)*CAM.scale);
  g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx-ux*trail*(rapid?.58:.82),sy-uy*trail*(rapid?.58:.82)); g.stroke();
  g.globalAlpha=.98; g.fillStyle='#ffffff';
  if(v.shape==='slug'){
    g.beginPath(); g.arc(sx,sy,radius,0,7); g.fill();
  } else if(v.shape==='bolt'){
    g.beginPath(); g.moveTo(sx+ux*radius*2.2,sy+uy*radius*2.2); g.lineTo(sx+px*radius,sy+py*radius);
    g.lineTo(sx-ux*radius*2,sy-uy*radius*2); g.lineTo(sx-px*radius,sy-py*radius); g.closePath(); g.fill();
  } else if(v.shape==='lance'){
    g.strokeStyle='#ffffff'; g.lineWidth=Math.max(1.4,radius*.75); g.beginPath();
    g.moveTo(sx+ux*radius*3,sy+uy*radius*3); g.lineTo(sx-ux*radius*3,sy-uy*radius*3); g.stroke();
    if(!compact){ g.strokeStyle=col; g.globalAlpha=.75; for(const q of [-1,1]){ g.beginPath();
      g.moveTo(sx+px*radius*q*1.6,sy+py*radius*q*1.6); g.lineTo(sx-ux*radius*3,sy-uy*radius*3); g.stroke(); } }
  } else if(v.shape==='plasma'){
    g.fillStyle=col; g.globalAlpha=.25; g.beginPath(); g.arc(sx,sy,radius*2.8,0,7); g.fill();
    g.globalAlpha=1; g.fillStyle='#ffffff'; g.beginPath(); g.arc(sx,sy,radius*1.15,0,7); g.fill();
  } else if(v.shape==='comet'){
    g.fillStyle=col; g.globalAlpha=.82; g.beginPath(); g.moveTo(sx+ux*radius*3.4,sy+uy*radius*3.4);
    g.lineTo(sx-ux*radius*2+px*radius*2.5,sy-uy*radius*2+py*radius*2.5);
    g.lineTo(sx-ux*radius*.5,sy-uy*radius*.5); g.lineTo(sx-ux*radius*2-px*radius*2.5,sy-uy*radius*2-py*radius*2.5); g.closePath(); g.fill();
    g.globalAlpha=1; g.fillStyle='#ffffff'; g.beginPath(); g.arc(sx,sy,radius*.85,0,7); g.fill();
  } else {
    g.fillStyle=col; g.globalAlpha=.28; g.beginPath(); g.arc(sx,sy,radius*3.4,0,7); g.fill();
    g.globalAlpha=.9; g.strokeStyle='#ffffff'; g.lineWidth=Math.max(1,radius*.5); g.beginPath(); g.arc(sx,sy,radius*1.8,0,7); g.stroke();
    g.beginPath(); g.moveTo(sx-ux*radius*3.3,sy-uy*radius*3.3); g.lineTo(sx+ux*radius*3.3,sy+uy*radius*3.3);
    g.moveTo(sx-px*radius*3.3,sy-py*radius*3.3); g.lineTo(sx+px*radius*3.3,sy+py*radius*3.3); g.stroke();
    g.fillStyle='#ffffff'; g.beginPath(); g.arc(sx,sy,radius*.9,0,7); g.fill();
  }
  if(!compact&&!rapid&&v.satellites){
    g.fillStyle=col; g.globalAlpha=.86;
    for(let i=0;i<v.satellites;i++){
      const a=G.anim*v.pulseRate+i*Math.PI*2/v.satellites,r=radius*(2.2+v.variant*.25);
      g.beginPath(); g.arc(sx+Math.cos(a)*r,sy+Math.sin(a)*r,Math.max(.7,radius*.42),0,7); g.fill();
    }
  }
  g.restore();
}
function drawAnnihilationBeam(g,bm,compact){
  const v=bm.visual||projectileVisualSpec('launcher',0),a=Math.max(0,1-bm.t/bm.life);
  const x1=isoX(bm.x1,bm.y1),y1=isoY(bm.x1,bm.y1,bm.z1),x2=isoX(bm.x2,bm.y2),y2=isoY(bm.x2,bm.y2,bm.z2);
  const col=VISUAL_MATERIALS[v.grade].glow;
  g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
  g.globalAlpha=a*(.34+.04*v.grade); g.strokeStyle=col; g.lineWidth=(Math.max(4,10*CAM.scale)+v.grade*2.2)*a+2;
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  if(!compact&&v.grade>=2){
    const dx=x2-x1,dy=y2-y1,dl=Math.hypot(dx,dy)||1,px=-dy/dl,py=dx/dl,off=3+v.grade;
    g.globalAlpha=a*.72; g.lineWidth=Math.max(1,1.4*CAM.scale); g.strokeStyle=v.grade>=4?'#ffe9a3':col;
    for(const q of [-1,1]){ g.beginPath(); g.moveTo(x1+px*off*q,y1+py*off*q); g.lineTo(x2+px*off*q,y2+py*off*q); g.stroke(); }
  }
  g.globalAlpha=a; g.strokeStyle='#ffffff'; g.lineWidth=(Math.max(1,3.2*CAM.scale)+v.grade*.4)*a+1;
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  if(!compact&&v.grade>=3){
    g.fillStyle='#ffffff'; for(let i=1;i<=v.grade-1;i++){
      const u=(i/(v.grade))+.04*Math.sin(G.anim*8+i),x=x1+(x2-x1)*u,y=y1+(y2-y1)*u;
      g.globalAlpha=a*.85; g.beginPath(); g.arc(x,y,Math.max(1.5,(2+v.grade*.35)*CAM.scale),0,7); g.fill();
    }
  }
  g.restore();
}
function draw(){
  const EN=G.enemies.length;
  const SCENE_DENSE=EN>45 && G.turrets.length>=30;
  const SCENE_DETAIL_PRESSURE=!SCENE_DENSE && EN>=18 && G.turrets.length>=28;
  if(RENDER_DENSE!==SCENE_DENSE){ RENDER_DENSE=SCENE_DENSE; resize(); }
  if(backdrop) ctx.drawImage(backdrop,0,0,W,H);
  const shake=REDUCE?0:G.shake, sx=shake?(Math.random()*2-1)*shake:0, sy=shake?(Math.random()*2-1)*shake*.65:0;
  ctx.save(); ctx.translate(sx,sy);
  if(ground) ctx.drawImage(ground,0,0,W,H);
  drawWorldAtmosphere(ctx);

  // 끌고 있는 포탑이 "실제로 놓일 자리" 표시 (초록=배치, 노랑=합체)
  if(G.dropInfo && G.selTurret){
    const t=G.selTurret, d=G.dropInfo;
    const col = d.merge ? '255,209,102' : '56,232,176';
    const ring=(x,y,tier)=>{
      const R=Math.max(CFG.turretGap, tier.base*0.8);   // 받침보다 크게 → 가려지지 않음
      const rx=R*ISO_X*1.42*CAM.scale, ry=R*ISO_Y*1.42*CAM.scale;
      ctx.fillStyle='rgba('+col+',.22)';
      ctx.beginPath(); ctx.ellipse(isoX(x,y),isoY(x,y,1), rx, ry,0,0,7); ctx.fill();
      ctx.strokeStyle='rgba('+col+',.95)'; ctx.lineWidth=Math.max(1,2.5*CAM.scale);
      ctx.beginPath(); ctx.ellipse(isoX(x,y),isoY(x,y,1), rx, ry,0,0,7); ctx.stroke();
    };
    if(d.merge){ ring(t.x,t.y,tdef(t)); ring(d.merge.x,d.merge.y,tdef(d.merge)); }
    else if(d.land) ring(d.land.x, d.land.y, tdef(t));
  }

  // 극한 개체 수에서는 화면상 몇 픽셀뿐인 세부 부품을 실루엣 LOD로 대체한다.
  // 평상시에는 기존 전체 디테일을 유지하고, 60적+30구조물급에서만 프레임 예산을 우선한다.
  const LOD = SCENE_DENSE ? 3 : SCENE_DETAIL_PRESSURE ? 1 : EN>45 ? 2 : EN>22 ? 1 : 0;
  const allyVisual=allyVisualSpec(G.upTotal,G.weaponTier,G.armorTier);

  // 접지 그림자는 유닛보다 먼저 그려 높이감과 가독성을 확보
  for(const t of G.turrets) drawEntityShadow(ctx,t,'t',SCENE_DENSE);
  for(const a of G.allies) if(!a.dead) drawEntityShadow(ctx,a,'a',SCENE_DENSE);
  for(const e of G.enemies) drawEntityShadow(ctx,e,'e',SCENE_DENSE);

  // 깊이 정렬(painter's algorithm)
  const items=[],base=baseNode();
  items.push({d:depthOf(base.x,base.y), k:'b', o:base});
  for(const t of G.turrets) items.push({d:depthOf(t.x,t.y), k:'t', o:t});
  for(const a of G.allies) items.push({d:depthOf(a.x,a.y), k:'a', o:a});
  for(const e of G.enemies) items.push({d:depthOf(e.x,e.y), k:'e', o:e});
  for(const p of G.shots)  items.push({d:depthOf(p.x,p.y), k:'p', o:p});
  for(const f of G.fx)     items.push({d:depthOf(f.x,f.y), k:'f', o:f});
  items.sort((m,n)=>m.d-n.d);

  for(const it of items){
    const o=it.o;
    if(it.k==='b'){
      drawBaseFortress(ctx,SCENE_DENSE);
    } else if(it.k==='t'){
      drawTurret(ctx,o,SCENE_DENSE?2:(SCENE_DETAIL_PRESSURE?1:0));
    } else if(it.k==='a'){
      if(o.dead){ // 쓰러진 아군 = 납작한 회색 블록
        box(ctx,o.x,o.y,0,22,14,5,'#5b6478');
      } else {
        const C=o.shootFlash>0?ALLY_FLASH_C:ALLY_C;
        const top=character(ctx,o.x,o.y,1.05,C,o.phase,false,o.face||0,o.shootFlash>0?1:0,LOD,allyVisual);
        hpBar(o.x,o.y,top+10,o.hp/o.maxHp,'#38e8b0');
      }
    } else if(it.k==='e'){
      const s=o.r/CFG.eR0, C=enemyPalette(o),visual=o.visual||enemyVisualSpec(o.bossLevel||G.level,!!o.isBoss);
      const top=character(ctx,o.x,o.y,s,C,o.phase,o.freezeT<=0,o.face||0,o.atkPose>0?1:0,o.isBoss?0:LOD,visual);
      if(o.isBoss||o.hp<o.maxHp) hpBar(o.x,o.y,top+8,o.hp/o.maxHp, o.isBoss?'#ff3b6b':'#ff8a97');
    } else if(it.k==='p'){
      drawProjectile(ctx,o,SCENE_DENSE||(o.visual&&o.visual.kind==='rapid'&&G.shots.length>90));
    } else {
      const al=Math.max(0,1-o.t/o.life),sx0=isoX(o.x,o.y),sy0=isoY(o.x,o.y,o.z);
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=al;
      ctx.fillStyle=o.color; ctx.beginPath(); ctx.arc(sx0,sy0,Math.max(1.5,4.2*CAM.scale*al),0,7); ctx.fill();
      ctx.globalAlpha=al*.24; ctx.beginPath(); ctx.arc(sx0,sy0,Math.max(3,9*CAM.scale*al),0,7); ctx.fill(); ctx.restore();
    }
  }

  drawRings(ctx);

  // 에너지 빔 (등급이 오를수록 외곽 레일·에너지 노드가 추가됨)
  for(const bm of G.beams) drawAnnihilationBeam(ctx,bm,SCENE_DENSE);

  // 데미지 숫자 (화면공간)
  ctx.textAlign='center';
  for(const n of G.nums){
    const nl=n.life||(n.big?0.9:0.7);
    ctx.globalAlpha=Math.min(1, (1-n.t/nl)*2.5);   // 오래 뜨는 글자는 끝에서만 흐려짐
    ctx.fillStyle=n.color; ctx.font='bold '+(n.big?17:14)+'px Segoe UI';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.55)';
    const sx=isoX(n.x,n.y), sy=isoY(n.x,n.y,58)-n.rise;
    ctx.strokeText(n.txt??n.val,sx,sy); ctx.fillText(n.txt??n.val,sx,sy);
  }
  ctx.globalAlpha=1;

  ctx.restore();
  drawPostFx(ctx);

  if(G.phase==='idle'){ banner('“시작”을 누르면 적이 길을 따라 몰려옵니다','rgba(232,236,246,.95)');
    subline(W<560 ? '상점에서 구매 · 끌어서 배치 · 같은 레벨 겹치면 합체'
                  : '상점에서 포탑 구매 · 끌어서 원하는 곳에 배치 · 같은 레벨끼리 겹치면 합체!','#c8b4ff',52);
    if(RECORDS.bestTime>0){ ctx.textAlign='center'; ctx.font='bold 14px Segoe UI'; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)';
      const s='🏆 최고 기록  '+RECORDS.bestTime.toFixed(0)+'초 · '+RECORDS.bestKills+'킬 · Lv'+RECORDS.bestLevel;
      ctx.strokeText(s,W/2,74); ctx.fillStyle='#ffd166'; ctx.fillText(s,W/2,74); } }
  if(G.phase==='paused'){ banner('정비 중 — 골드로 강화하고 “시작”으로 재개','#ffd166');
    if(G.stopCd>0) subline('끝내기 쿨타임 '+Math.ceil(G.stopCd)+'초 (게임 진행 중 감소)','#ff8a97',52); }
}
// ---- 레이저 그리기 : 양쪽 기둥 + 길을 가로지르는 빔 ----
function drawLaser(g,t,lod){
  const L=tdef(t), sel=(G.selTurret===t), ang=t.ang||0,V=turretVisualSpec('laser',t.tier),mid=lod>=1;
  const ca=Math.cos(ang), sa=Math.sin(ang), hl=L.len/2;
  const ax=t.x-ca*hl, ay=t.y-sa*hl, bx=t.x+ca*hl, by=t.y+sa*hl;   // 빔 양끝
  const pulse=0.72+0.28*Math.sin(G.anim*11);
  if(sel){
    g.strokeStyle='#ffd166'; g.lineWidth=Math.max(1,2.5*CAM.scale);
    g.beginPath(); g.ellipse(isoX(t.x,t.y),isoY(t.x,t.y,1),
      (L.base*0.8)*ISO_X*1.42*CAM.scale,(L.base*0.8)*ISO_Y*1.42*CAM.scale,0,0,7); g.stroke();
  }
  const P=[], add=(x,y,z,len,wid,h,c,a)=>P.push({x,y,z,len,wid,h,c,a:(a===undefined?0:a)});
  for(const [px,py] of [[ax,ay],[bx,by]]){                        // 등급별 발신기·반사기 파일런
    add(px,py,0,L.base*0.66,L.base*0.66,7,V.base);
    add(px,py,7,L.base*(.44+V.grade*.025),L.base*(.44+V.grade*.025),L.hh,L.col,ang);
    add(px,py,7+L.hh,L.base*(.52+V.variant*.035),L.base*(.52+V.variant*.035),6+V.grade*.8,V.trim,ang);
    if(V.grade>=2&&!mid){
      for(const q of [-1,1]){ const ox=-sa*q*(L.base*.34),oy=ca*q*(L.base*.34);
        add(px+ox,py+oy,11+L.hh*.3,5,5,10+V.grade*2,V.glow,ang); }
    }
  }
  add(t.x,t.y,7+L.hh*0.55,L.len,L.width*0.5,3.5,L.col,ang);       // 빔 받침(어두운 심)
  P.sort((q,r)=> (depthOf(q.x,q.y)-depthOf(r.x,r.y)) || q.z-r.z);
  for(const q of P) rbox(g,q.x,q.y,q.z,q.len,q.wid,q.h,q.a,q.c);
  // 빔 : 화면 공간에 굵은 발광선으로
  const z=7+L.hh*0.55+3;
  const x1=isoX(ax,ay), y1=isoY(ax,ay,z), x2=isoX(bx,by), y2=isoY(bx,by,z);
  g.lineCap='round';
  g.globalAlpha=0.34*pulse; g.strokeStyle=L.top;
  g.lineWidth=Math.max(4, L.width*0.9*ISO_Y*1.42*CAM.scale);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  g.globalAlpha=0.95*pulse; g.lineWidth=Math.max(2, L.width*0.30*ISO_Y*1.42*CAM.scale);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  g.globalAlpha=1; g.strokeStyle='#ffffff';
  g.lineWidth=Math.max(1, L.width*0.10*ISO_Y*1.42*CAM.scale);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  if(V.grade>=3&&!mid){
    const dx=x2-x1,dy=y2-y1,dl=Math.hypot(dx,dy)||1,px=-dy/dl,py=dx/dl,off=3+V.grade;
    g.globalAlpha=.62*pulse; g.strokeStyle=V.glow; g.lineWidth=Math.max(1,1.2*CAM.scale);
    for(const q of [-1,1]){ g.beginPath(); g.moveTo(x1+px*off*q,y1+py*off*q); g.lineTo(x2+px*off*q,y2+py*off*q); g.stroke(); }
    g.fillStyle='#ffffff'; for(let i=1;i<=V.grade-2;i++){ const u=(i/(V.grade-1)+G.anim*.34)%1;
      g.beginPath(); g.arc(x1+dx*u,y1+dy*u,Math.max(1.3,(2+V.variant*.45)*CAM.scale),0,7); g.fill(); }
    g.globalAlpha=1;
  }
  g.lineCap='butt';
  // 라벨
  const sx=isoX(t.x,t.y), sy=isoY(t.x,t.y,7+L.hh+26);
  g.textAlign='center'; g.font='bold '+Math.max(9,11*CAM.scale)+'px Segoe UI';
  g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.65)';
  const lb='Lv'+(t.tier+1)+' · '+VISUAL_GRADE_NAMES[V.grade]+' 레이저';
  g.strokeText(lb,sx,sy); g.fillStyle=L.top; g.fillText(lb,sx,sy);
}
// 극한 부하용 포탑 LOD. 작은 화면에서도 종류·방향·충전 상태는 남기고 미세 부품만 생략한다.
function drawLaserCompact(g,t){
  const L=tdef(t),V=turretVisualSpec('laser',t.tier),ang=t.ang||0,ca=Math.cos(ang),sa=Math.sin(ang),hl=L.len/2;
  const ax=t.x-ca*hl,ay=t.y-sa*hl,bx=t.x+ca*hl,by=t.y+sa*hl,z=7+L.hh*.55+3;
  box(g,ax,ay,0,L.base*.58,L.base*.58,7+L.hh,V.armor);
  box(g,bx,by,0,L.base*.58,L.base*.58,7+L.hh,V.armor);
  const x1=isoX(ax,ay),y1=isoY(ax,ay,z),x2=isoX(bx,by),y2=isoY(bx,by,z);
  g.save(); g.lineCap='round'; g.strokeStyle=L.top;
  g.globalAlpha=.34; g.lineWidth=Math.max(4,L.width*.78*ISO_Y*1.42*CAM.scale);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  g.globalAlpha=.95; g.strokeStyle='#ffffff'; g.lineWidth=Math.max(1.5,L.width*.2*ISO_Y*1.42*CAM.scale);
  g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.restore();
}
function drawTurretCompact(g,t){
  if(isLaser(t)){ drawLaserCompact(g,t); return; }
  const T=tdef(t),V=turretVisualSpec(kindOf(t),t.tier),ang=t.aim||0,ca=Math.cos(ang),sa=Math.sin(ang);
  const baseH=8+t.tier*.8,bodyH=Math.max(12,T.hh*.82),headZ=baseH+bodyH;
  box(g,t.x,t.y,0,T.base,T.base,baseH,V.base);
  box(g,t.x,t.y,baseH,T.body*.9,T.body*.9,bodyH,T.col);
  box(g,t.x,t.y,baseH+bodyH*.48,Math.max(7,T.body*.45),Math.max(7,T.body*.45),5,V.glow);
  rbox(g,t.x,t.y,headZ,T.base*.64,T.base*.58,10+t.tier*1.2,ang,T.top);
  const barrelLen=Math.max(12,T.bl||T.len*.3),forward=T.base*.18+barrelLen*.5;
  const bx=t.x+ca*forward,by=t.y+sa*forward,bz=headZ+3;
  rbox(g,bx,by,bz,barrelLen,Math.max(3,T.bw||T.width*.28),Math.max(3,T.bw||T.width*.28),ang,isLauncher(t)&&t.coilT>0?'#7cf3ff':'#3f4b5f');
  if(isRapid(t)){
    const off=Math.max(3,(T.bw||4)*1.25),x=t.x+ca*forward-sa*off,y=t.y+sa*forward+ca*off;
    rbox(g,x,y,bz,barrelLen,Math.max(2.5,T.bw*.75),Math.max(2.5,T.bw*.75),ang,'#c2b45a');
  }
  if(isLauncher(t)&&t.coilT>0) box(g,t.x,t.y,baseH+bodyH*.45,13,13,7,'#9df3ff');
}
// ---- 포탑 그리기 : 등급마다 크기·모양이 다르고, 총구가 적을 향해 돌아감 ----
function drawTurret(g,t,lod){
  if(lod>=2){ drawTurretCompact(g,t); return; }
  if(isLaser(t)){ drawLaser(g,t,lod); return; }
  const T=tdef(t), sel=(G.selTurret===t),V=turretVisualSpec(kindOf(t),t.tier),mid=lod>=1;
  const ang=t.aim||0, ca=Math.cos(ang), sa=Math.sin(ang);
  const recoil=(t.shootFlash>0? t.shootFlash*26 : 0);         // 발사 반동(총열이 뒤로 밀림)
  const hot=t.shootFlash>0;
  const baseH=8+t.tier*0.8, headZ=baseH+T.hh, headH=10+t.tier*1.4;
  const side=(o,f)=>[t.x+ca*(f||0)-sa*o, t.y+sa*(f||0)+ca*o]; // (좌우 o, 앞뒤 f) → 월드 좌표

  if(sel && !G.dropInfo){                                     // 선택 링(드래그 중엔 드롭 표시로 대체)
    g.strokeStyle='#ffd166'; g.lineWidth=Math.max(1,2.5*CAM.scale);
    g.beginPath(); g.ellipse(isoX(t.x,t.y),isoY(t.x,t.y,1), (T.base*0.8)*ISO_X*1.42*CAM.scale, (T.base*0.8)*ISO_Y*1.42*CAM.scale,0,0,7); g.stroke();
  }

  // 부위를 모아 깊이 정렬 후 그린다(뒤쪽 총열이 머리에 가려지도록)
  const P=[], add=(x,y,z,len,wid,h,c,a)=>P.push({x,y,z,len,wid,h,c,a:(a===undefined?0:a)});
  add(t.x,t.y,0,T.base,T.base,baseH,V.base);                              // 등급 재질 받침대
  add(t.x,t.y,baseH-1.5,T.base*0.86,T.base*0.86,2,V.trim);

  // ---- 등급별 기둥 외형 ----
  const S=T.style, bw=T.body;
  if(S==='wood'){                                             // Lv1 : 통나무 기둥 + 버팀목
    add(t.x,t.y,baseH,bw,bw,T.hh,T.col);
    for(const q of [-1,1]){ const p=side(bw*0.62*q); add(p[0],p[1],baseH,4,4,T.hh*0.62,'#8a5c2c'); }
  } else if(S==='stone'){                                     // Lv2 : 돌기둥 + 성가퀴(요철)
    add(t.x,t.y,baseH,bw,bw,T.hh,T.col);
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4, r=bw*0.52;
      add(t.x+Math.cos(a)*r,t.y+Math.sin(a)*r,baseH+T.hh-2,6,6,7,'#9ba3ae'); }
  } else if(S==='steel'){                                     // Lv3 : 철골 4기둥 + 보강판
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+Math.PI/4, r=bw*0.5;
      add(t.x+Math.cos(a)*r,t.y+Math.sin(a)*r,baseH,6,6,T.hh,T.col); }
    add(t.x,t.y,baseH+T.hh*0.42,bw*1.05,bw*1.05,4,'#59677c');
    add(t.x,t.y,baseH+T.hh-4,bw*1.15,bw*1.15,4,'#59677c');
  } else if(S==='magic'){                                     // Lv4 : 마법 기둥 + 떠 있는 크리스탈
    add(t.x,t.y,baseH,bw*0.8,bw*0.8,T.hh,T.col);
    add(t.x,t.y,baseH+T.hh*0.5,bw*1.15,bw*1.15,5,'#4a2f8a');
    const fl=Math.sin(G.anim*2)*3;
    add(t.x,t.y,headZ+headH+8+fl,11,11,13,'#c9a6ff',G.anim*1.4);          // 회전하며 떠 있는 크리스탈
  } else if(S==='flame'){                                     // Lv5 : 용광로 기둥 + 양옆 연료탱크
    add(t.x,t.y,baseH,bw*0.85,bw*0.85,T.hh,T.col);
    for(const q of [-1,1]){ const p=side(bw*0.78*q,-2);
      add(p[0],p[1],baseH+T.hh*0.22,10,10,18,'#7a2a10',ang); }
    add(t.x,t.y,baseH+T.hh*0.2,bw*1.1,bw*1.1,6,'#e2601f');                // 화로 링
  } else if(S==='thunder'){                                   // Lv6 : 발전기 + 피뢰침 + 스파크
    add(t.x,t.y,baseH,bw*0.82,bw*0.82,T.hh,T.col);
    add(t.x,t.y,baseH+T.hh*0.5,bw*1.2,bw*1.2,6,'#1c4f78');
    for(const q of [-1,1]){ const p=side(bw*0.7*q,-3);
      add(p[0],p[1],headZ-2,4,4,22,'#9fe4ff',ang); }
    if(Math.sin(G.anim*9)>0.4) add(t.x,t.y,headZ+headH+20,7,7,7,'#e8f9ff');
  } else if(S==='rapid'){                                   // 연사 포탑 : 삼각대 + 탄약통 + 탄띠
    for(let i=0;i<3;i++){                                   // 삼각대 다리
      const a=i*(Math.PI*2/3)+Math.PI/2, r=T.base*0.30;
      add(t.x+Math.cos(a)*r, t.y+Math.sin(a)*r, baseH, 5, 5, T.hh*0.9, '#3c424c');
    }
    add(t.x,t.y,baseH+T.hh*0.72,bw*0.86,bw*0.86,T.hh*0.28,T.col);        // 회전대
    for(const q of [-1,1]){ const p=side(bw*0.86*q,-5);                  // 양옆 탄약통
      add(p[0],p[1],baseH+T.hh*0.5,12,9,11,'#4c5a3a',ang);
      add(p[0],p[1],baseH+T.hh*0.5+11,10,7,2.5,'#c2b45a',ang); }         // 탄띠(황동)
    add(t.x,t.y,baseH+T.hh*0.55,bw*1.12,bw*0.5,4,'#c2b45a',ang);         // 급탄 탄띠
  } else if(S==='energy'){                                    // 에너지 발사기 : 코일 챔버 + 방출구
    const on=t.coilT>0, pulse=0.5+0.5*Math.sin(G.anim*(on?7:1.5));
    add(t.x,t.y,baseH,bw*0.86,bw*0.86,T.hh,T.col);                        // 본체 기둥
    for(const q of [-1,1]){ const p=side(bw*0.8*q,-4);                    // 양옆 방열 파일런
      add(p[0],p[1],baseH+4,11,9,T.hh*0.72,'#0e2745',ang); }
    // 코일 챔버 : 코일이 들어있으면 밝게 빛나며 회전
    const coilCol = on ? (pulse>0.5?'#9df3ff':'#5ce1ff') : '#2b3f5c';
    add(t.x,t.y,baseH+T.hh*0.34,bw*1.18,bw*1.18,7,'#0b1c33');
    add(t.x,t.y,baseH+T.hh*0.45,13,13,15,coilCol, on?G.anim*2.2:0);       // 코일 본체
    if(on){                                                               // 충전 링(레벨이 높을수록 많다)
      const rings=1+t.tier;
      for(let i=0;i<rings;i++){
        const rz=baseH+T.hh*0.45-4+i*7, rw=18+i*2.2, dir=(i%2?1:-1);
        add(t.x,t.y,rz,rw,rw,3,'#9df3ff', dir*G.anim*(1.3+i*0.25));
      }
    }
    for(let i=0;i<t.tier;i++){                                            // 레벨 표식(옆면 발광 블록)
      const q=side(T.body*0.62*(i%2?1:-1), -10+Math.floor(i/2)*9);
      add(q[0],q[1],baseH+T.hh*0.62,5,5,5, on?'#bff6ff':'#33506e', ang);
    }
  } else {                                                    // Lv7 : 용의 포탑 - 날개 + 뿔
    add(t.x,t.y,baseH,bw*0.9,bw*0.9,T.hh,T.col);
    add(t.x,t.y,baseH+T.hh*0.46,bw*1.25,bw*1.25,7,'#4d0a1f');
    for(const q of [-1,1]){ const p=side(bw*0.92*q,-6);                   // 날개
      add(p[0],p[1],headZ-10,15,6,20,'#5e0c22',ang); }
    for(const q of [-1,1]){ const p=side(T.base*0.16*q, T.base*0.1);      // 뿔
      add(p[0],p[1],headZ+headH-2,5,5,12,'#ffd166',ang); }
  }

  // 공통 진화 키트: 모든 정확한 레벨에 서로 다른 받침 링·문장·파일런·오비탈을 부여한다.
  const ringCount=mid?1:V.plinthRings,pylonCount=mid?Math.min(2,V.pylons):V.pylons;
  for(let i=0;i<ringCount;i++) add(t.x,t.y,baseH+2+i*4,T.base*(.78-i*.06),T.base*(.78-i*.06),2.4,i===ringCount-1?V.trim:V.dark,G.anim*.08*(i%2?1:-1));
  for(let i=0;i<pylonCount;i++){
    const a=i*Math.PI*2/pylonCount+Math.PI/4,r=T.base*.4,pw=4.5+V.variant;
    add(t.x+Math.cos(a)*r,t.y+Math.sin(a)*r,baseH+3,pw,pw,9+V.grade*2,V.armor,a);
    add(t.x+Math.cos(a)*r,t.y+Math.sin(a)*r,baseH+12+V.grade*2,pw*.72,pw*.72,3,V.glow,a);
  }
  add(t.x,t.y,baseH+T.hh*.52,7+V.grade*1.2,7+V.grade*1.2,5+V.variant,V.glow,G.anim*(.25+V.grade*.04));
  for(let i=0;i<V.crestCount;i++){
    const q=side((i-(V.crestCount-1)/2)*(6+V.grade),-T.body*.28);
    add(q[0],q[1],headZ-4,4+V.variant,4,7+V.grade,V.trim,ang);
  }
  for(let i=0;i<(mid?0:V.orbitals);i++){
    const a=G.anim*(.55+i*.07)+i*Math.PI*2/V.orbitals,r=T.body*.85+V.grade*2;
    add(t.x+Math.cos(a)*r,t.y+Math.sin(a)*r,headZ+headH+8+i*2,8+V.variant,4,4,V.glow,a);
  }
  // ---- 포탑 머리 + 총열(적을 향해 회전) ----
  add(t.x,t.y,headZ,T.base*0.64,T.base*0.58,headH, hot?'#ffffff':T.top, ang);
  const bl=T.bl, bwid=T.bw, bz=headZ+headH*0.30, root=T.base*0.2-recoil*0.35;
  const offs = T.bn===1 ? [0] : T.bn===2 ? [-bwid*0.8, bwid*0.8] : [-bwid*1.45,0,bwid*1.45];
  const nrg=isLauncher(t), charged=nrg&&t.coilT>0;
  if(T.rotor){                                                          // 미니건 : 돌아가는 총열 뭉치
    const spin=t.spin||0, R=bwid*1.25;
    add(t.x,t.y,bz,bl*0.34,bwid*2.5,bwid*2.5, hot?'#ffe9a3':'#3a3f49', ang);   // 로터 하우징
    const rotorParts=mid?3:6;
    for(let i=0;i<rotorParts;i++){
      const a=spin+i*Math.PI*2/rotorParts, c=side(Math.cos(a)*R, root+bl*0.5);
      add(c[0],c[1],bz+Math.sin(a)*R, bl, bwid*0.72, bwid*0.72, hot?'#fff3c4':'#5a616e', ang);
    }
    if(hot){ const f=side(0, root+bl+bwid*1.4);
      add(f[0],f[1],bz,10,bwid*1.9,bwid*1.9,'#ffd166',ang); }
    P.sort((a,b)=> (depthOf(a.x,a.y)-depthOf(b.x,b.y)) || a.z-b.z);
    for(const q of P) rbox(g,q.x,q.y,q.z,q.len,q.wid,q.h,q.a,q.c);
    turretLabel(g,t,T,headZ,headH);
    return;
  }
  for(const so of offs){
    const c=side(so, root+bl*0.5);
    add(c[0],c[1],bz,bl,bwid,bwid, hot?'#fff3c4':(nrg?V.armor:V.dark), ang);   // 총열/방출관
    const m=side(so, root+bl);
    add(m[0],m[1],bz-bwid*0.25,bwid*0.9,bwid*1.45,bwid*1.45,
        hot?'#ffffff':(charged?V.glow:(nrg?V.dark:V.trim)), ang);          // 총구/방출구
    if(nrg&&charged){                                                     // 방출관 에너지 링
      for(const u of [0.35,0.62,0.88]){ const r=side(so, root+bl*u);
        add(r[0],r[1],bz-1,3.5,bwid*1.3,bwid*1.3,'#7cf3ff', ang); }
    }
    if(hot){ const f=side(so, root+bl+bwid*1.2);                          // 총구 화염 / 방출 섬광
      add(f[0],f[1],bz-bwid*0.25,8,bwid*1.15,bwid*1.15, nrg?'#e8ffff':'#ffe08a', ang); }
  }
  P.sort((a,b)=> (depthOf(a.x,a.y)-depthOf(b.x,b.y)) || a.z-b.z);
  for(const q of P) rbox(g,q.x,q.y,q.z,q.len,q.wid,q.h,q.a,q.c);

  turretLabel(g,t,T,headZ,headH);
}
// 라벨 : 일반/연사 포탑=등급 / 에너지 발사기=남은 코일 시간
function turretLabel(g,t,T,headZ,headH){
  const sx=isoX(t.x,t.y), sy=isoY(t.x,t.y,headZ+headH+(T.style==='dragon'?34:22));
  const V=turretVisualSpec(kindOf(t),t.tier);
  const label = isLauncher(t) ? ('Lv'+(t.tier+1)+' '+VISUAL_GRADE_NAMES[V.grade]+(t.coilT>0 ? ' ⚡'+Math.ceil(t.coilT)+'초' : ' 코일없음'))
              : isRapid(t)    ? ('Lv'+(t.tier+1)+' '+VISUAL_GRADE_NAMES[V.grade])
                              : 'Lv'+(t.tier+1)+' · '+VISUAL_GRADE_NAMES[V.grade];
  const lcol  = isLauncher(t) ? (t.coilT>0?'#7cf3ff':'#8b97b8') : T.top;
  g.textAlign='center'; g.font='bold '+Math.max(9,11*CAM.scale)+'px Segoe UI';
  g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.65)';
  g.strokeText(label,sx,sy); g.fillStyle=lcol; g.fillText(label,sx,sy);
}
function hpBar(x,y,z,frac,col){
  const sx=isoX(x,y), sy=isoY(x,y,z), w=34*CAM.scale, h=5*CAM.scale;
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(sx-w/2,sy,w,h);
  ctx.fillStyle=col; ctx.fillRect(sx-w/2,sy,w*Math.max(0,frac),h);
}
function banner(txt,col){
  ctx.textAlign='center'; ctx.font='bold 17px Segoe UI';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)';
  ctx.strokeText(txt,W/2,30); ctx.fillStyle=col; ctx.fillText(txt,W/2,30);
}
function subline(txt,col,y){
  ctx.textAlign='center'; ctx.font='bold 13px Segoe UI';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)';
  ctx.strokeText(txt,W/2,y); ctx.fillStyle=col; ctx.fillText(txt,W/2,y);
}
