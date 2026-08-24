// ---- 시각 진화 시스템 -------------------------------------------------------
// 게임 규칙과 분리된 순수 등급 해석기. 모든 결과는 캐시·동결하여 프레임당 할당을 막는다.
const VISUAL_SYSTEM_VERSION='2.0.0';
const VISUAL_GRADE_NAMES=Object.freeze(['FIELD','VANGUARD','RELIC','ARCANE','CELESTIAL','GENESIS']);
const PROJECTILE_SHAPES=Object.freeze(['slug','bolt','lance','plasma','comet','nova']);
const VISUAL_MATERIALS=Object.freeze([
  Object.freeze({armor:'#356ca8',trim:'#d6a94a',glow:'#ffd166',dark:'#1c3553',base:'#596576'}),
  Object.freeze({armor:'#59758f',trim:'#d8e4ef',glow:'#8ad3ff',dark:'#263747',base:'#566779'}),
  Object.freeze({armor:'#6754a5',trim:'#c7adff',glow:'#a98bff',dark:'#2d224e',base:'#4d466a'}),
  Object.freeze({armor:'#176a78',trim:'#8ef0ff',glow:'#5ce1ff',dark:'#0c3540',base:'#315e68'}),
  Object.freeze({armor:'#8c6315',trim:'#fff0ad',glow:'#ffd15c',dark:'#443006',base:'#756537'}),
  Object.freeze({armor:'#dce8f4',trim:'#ffffff',glow:'#bff6ff',dark:'#394858',base:'#7c8b9a'})
]);
const ENEMY_MATERIALS=Object.freeze([
  Object.freeze({armor:'#7d2630',trim:'#c66a54',glow:'#ff786d',dark:'#351017'}),
  Object.freeze({armor:'#89451e',trim:'#ffad5c',glow:'#ff7a2d',dark:'#3f1f0b'}),
  Object.freeze({armor:'#66337f',trim:'#d696ff',glow:'#c46bff',dark:'#2d1439'}),
  Object.freeze({armor:'#164f65',trim:'#7fd4ff',glow:'#55c8ff',dark:'#092a38'}),
  Object.freeze({armor:'#6d173b',trim:'#ff79b5',glow:'#ff4f9a',dark:'#32091d'}),
  Object.freeze({armor:'#33285f',trim:'#e7dbff',glow:'#bfa9ff',dark:'#150e31'})
]);
function visualClamp(value,max){ return Math.max(0,Math.min(max,value|0)); }
function visualGrade(tier,maxTier){
  tier=visualClamp(tier,maxTier);
  return Math.min(5,Math.floor(tier*6/Math.max(1,maxTier+1)));
}
function visualRankToken(prefix,tier,maxTier){
  const rank=visualClamp(tier,maxTier),grade=visualGrade(rank,maxTier);
  return prefix+'-r'+String(rank+1).padStart(2,'0')+'-'+VISUAL_GRADE_NAMES[grade].toLowerCase()+'-v'+(rank%3+1);
}
const _allyVisualCache=new Map();
function allyVisualSpec(upTotal,weaponTier,armorTier){
  const core=visualClamp(upTotal,15),weapon=visualClamp(weaponTier,15),armor=visualClamp(armorTier,15);
  const key=core+'|'+weapon+'|'+armor; let spec=_allyVisualCache.get(key); if(spec) return spec;
  const rank=Math.max(core,weapon,armor),grade=visualGrade(rank,15),m=VISUAL_MATERIALS[grade];
  spec=Object.freeze({
    id:'ally-'+core+'-'+weapon+'-'+armor+'-'+VISUAL_GRADE_NAMES[grade].toLowerCase(),
    rank,grade,enemy:false,coreTier:core,weaponTier:weapon,armorTier:armor,variant:rank%3,
    armor:m.armor,trim:m.trim,glow:m.glow,dark:m.dark,
    shoulder:armor>=2,helmet:armor>=4,reactor:rank>=7,crown:rank>=12,
    weaponForm:PROJECTILE_SHAPES[visualGrade(weapon,15)],partBudget:8+grade*2+(rank%3)
  });
  _allyVisualCache.set(key,spec); return spec;
}
const _enemyVisualCache=new Map();
function enemyVisualSpec(level,isBoss){
  const stage=Math.max(1,level|0),rank=visualClamp(Math.floor((stage-1)/2),15);
  const grade=visualGrade(rank,15),key=grade+'|'+rank+'|'+(isBoss?1:0); let spec=_enemyVisualCache.get(key); if(spec) return spec;
  const m=ENEMY_MATERIALS[grade],boss=!!isBoss;
  const palette=Object.freeze({
    skin:boss?'#bc67cc':'#c9705f',torso:m.armor,leg:m.dark,hair:boss?'#1d082b':'#2a0d14',
    shoe:'#16070c',belt:m.trim,horn:boss?'#ffe28a':m.trim
  });
  spec=Object.freeze({
    id:visualRankToken(boss?'boss':'enemy',rank,15),rank,grade,enemy:true,variant:rank%3,boss,
    armor:m.armor,trim:m.trim,glow:m.glow,dark:m.dark,palette,
    shoulder:rank>=2,helmet:rank>=4,reactor:rank>=8,crown:boss||rank>=12,
    weaponForm:boss?'crusher':grade<2?'cleaver':grade<4?'glaive':'voidblade',partBudget:(boss?13:7)+grade*2
  });
  _enemyVisualCache.set(key,spec); return spec;
}
const _turretVisualCache=new Map();
const TURRET_MAX_TIER=Object.freeze({turret:14,rapid:9,laser:5,launcher:4});
function turretVisualSpec(kind,tier){
  kind=kind||'turret'; const max=TURRET_MAX_TIER[kind]??14,rank=visualClamp(tier,max);
  const key=kind+'|'+rank; let spec=_turretVisualCache.get(key); if(spec) return spec;
  const grade=visualGrade(rank,max),m=VISUAL_MATERIALS[grade],variant=rank%3;
  spec=Object.freeze({
    id:visualRankToken(kind,rank,max),kind,rank,grade,variant,
    armor:m.armor,trim:m.trim,glow:m.glow,dark:m.dark,base:m.base,
    plinthRings:1+Math.floor(grade/2),crestCount:1+variant,pylons:grade>=1?2+variant:0,
    orbitals:grade>=3?Math.min(4,grade-1+variant):0,coreScale:1+grade*.16+variant*.07,
    projectileShape:PROJECTILE_SHAPES[grade],partBudget:10+grade*3+variant
  });
  _turretVisualCache.set(key,spec); return spec;
}
const _projectileVisualCache=new Map();
function projectileVisualSpec(kind,tier){
  kind=kind||'ally';
  const max=kind==='rapid'?9:kind==='launcher'?4:kind==='turret'?14:15;
  const rank=visualClamp(tier,max),key=kind+'|'+rank; let spec=_projectileVisualCache.get(key); if(spec) return spec;
  const grade=visualGrade(rank,max),shape=PROJECTILE_SHAPES[grade],variant=rank%3;
  spec=Object.freeze({
    id:visualRankToken(kind+'-shot',rank,max),kind,rank,grade,variant,shape,
    layers:Math.min(6,2+grade+(variant>0?1:0)),trailScale:1+grade*.34+variant*.1,
    wingScale:grade>=2?.72+variant*.18:0,satellites:grade>=3?Math.min(3,grade-2+variant):0,
    pulseRate:5+grade*1.5+variant
  });
  _projectileVisualCache.set(key,spec); return spec;
}
const _baseVisualCache=new Map();
function baseVisualSpec(upTotal){
  const rank=visualClamp(upTotal,15); let spec=_baseVisualCache.get(rank); if(spec) return spec;
  const grade=visualGrade(rank,15),m=VISUAL_MATERIALS[grade],variant=rank%3;
  spec=Object.freeze({
    id:visualRankToken('base',rank,15),rank,grade,variant,armor:m.armor,trim:m.trim,glow:m.glow,dark:m.dark,base:m.base,
    towers:grade<2?2:grade<4?3:4,wallHeight:11+rank*1.45,keepHeight:24+rank*2.15,
    shield:grade>=3,orbitals:grade>=4?1+variant:0,partBudget:9+grade*4+variant
  });
  _baseVisualCache.set(rank,spec); return spec;
}
function visualContractSnapshot(){
  return {
    version:VISUAL_SYSTEM_VERSION,
    ally:Array.from({length:16},(_,i)=>allyVisualSpec(i,i,i).id),
    enemy:[1,6,12,20,30].map(t=>enemyVisualSpec(t,false).id),
    boss:[5,15,30].map(t=>enemyVisualSpec(t,true).id),
    base:Array.from({length:16},(_,i)=>baseVisualSpec(i).id),
    turret:Array.from({length:15},(_,i)=>turretVisualSpec('turret',i).id),
    rapid:Array.from({length:10},(_,i)=>turretVisualSpec('rapid',i).id),
    laser:Array.from({length:6},(_,i)=>turretVisualSpec('laser',i).id),
    launcher:Array.from({length:5},(_,i)=>turretVisualSpec('launcher',i).id),
    projectileShapes:[0,3,6,9,12,15].map(t=>projectileVisualSpec('ally',t).shape),
    maxProjectileLayers:Math.max(...Array.from({length:16},(_,i)=>projectileVisualSpec('ally',i).layers))
  };
}