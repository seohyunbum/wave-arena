const HUD=Object.freeze({
  time:document.getElementById('t'), level:document.getElementById('lv'),
  kills:document.getElementById('kills'), gold:document.getElementById('gold'),
  allies:document.getElementById('allies'), turrets:document.getElementById('turrets'),
  rapidsN:document.getElementById('rapidsN'), lasersN:document.getElementById('lasersN'),
  launchersN:document.getElementById('launchersN'), upgradeLevel:document.getElementById('uplv'),
  next:document.getElementById('next'), buffs:document.getElementById('buffs'),
  upgrade:document.getElementById('up'), start:document.getElementById('start'),
  stop:document.getElementById('stop'), shop:document.getElementById('shopBtn')
});
let hudUpdatedAt=-Infinity;
function updateHUD(force){
  const now=performance.now();
  if(!force && now-hudUpdatedAt<100) return;
  hudUpdatedAt=now;
  HUD.time.textContent=G.time.toFixed(1);
  HUD.level.textContent='Lv '+G.level;
  HUD.kills.textContent=G.kills;
  HUD.gold.textContent=Math.floor(G.gold);
  let alive=0; for(const ally of G.allies) if(!ally.dead) alive++;
  HUD.allies.textContent=alive;
  HUD.turrets.textContent=countKind('turret')+'/'+CFG.turretMax;
  const optStat=(el,n,max)=>{
    el.textContent=n+'/'+max;
    el.parentElement.style.display=n>0?'':'none';
  };
  optStat(HUD.rapidsN,countKind('rapid'),CFG.rapidMax);
  optStat(HUD.lasersN,countKind('laser'),CFG.laserMax);
  optStat(HUD.launchersN,countKind('launcher'),CFG.launcherMax);
  HUD.upgradeLevel.textContent='Lv '+G.upTotal;
  HUD.next.textContent='다음 아군 '+G.upToward+'/'+CFG.perMilestone;
  const bf=[];
  if(G.buffs.rageT>0) bf.push('🔥분노'+Math.ceil(G.buffs.rageT));
  if(G.buffs.luckT>0) bf.push('💰행운'+Math.ceil(G.buffs.luckT));
  if(G.buffs.guardT>0) bf.push('🛡수호'+Math.ceil(G.buffs.guardT));
  let coil=0;
  for(const turret of G.turrets) if(isLauncher(turret)&&turret.coilT>coil) coil=turret.coilT;
  if(coil>0) bf.push('⚡코일'+Math.ceil(coil));
  HUD.buffs.textContent=bf.join('  ');
  const cost=upgradeCost();
  HUD.upgrade.textContent='강화 💰'+cost;
  HUD.upgrade.disabled=(G.phase==='over'||G.gold<cost);
  HUD.start.textContent=(G.phase==='paused')?'재개':'시작';
  HUD.start.disabled=(G.phase==='running');
  HUD.stop.textContent=(G.stopCd>0)?('끝내기 '+Math.ceil(G.stopCd)+'초'):'끝내기';
  HUD.stop.disabled=(G.phase!=='running'||G.stopCd>0);
  HUD.shop.disabled=(G.phase==='over');
}

function doUpgrade(){
  if(G.phase==='over') return;
  const cost=upgradeCost(); if(G.gold<cost) return;
  G.gold-=cost; G.upTotal++; G.upToward++; applyAllyStats();
  const b=baseNode(); floatText(b.x,b.y,'강화! Lv'+G.upTotal,'#ffd166');
  if(G.upToward>=CFG.perMilestone){ G.upToward=0; G.allies.push(newAlly()); layoutAllies();
    floatText(b.x,b.y,'+아군 1명!','#38e8b0'); }
}
function startGame(){ if(G.phase==='over') reset(); G.phase='running';
  document.getElementById('over').style.display='none';
  window.dispatchEvent(new Event('wavearena:start')); }
function stopGame(){
  if(G.phase!=='running' || G.stopCd>0) return;      // 1분 쿨타임
  G.phase='paused'; G.stopCd=CFG.stopCooldown;
  for(const e of G.enemies){ burst(e.x,e.y,'#ff5a6a',6); e.dead=true; }   // 조준 목표도 함께 해제
  G.enemies.length=0; G.shots.length=0;
  for(const t of G.turrets) t.aimT=null;
  for(const a of G.allies) a.aimT=null;
  const b=baseNode(); floatText(b.x,b.y,'끝내기 사용 · 쿨타임 '+CFG.stopCooldown+'초','#ff8a97'); }
function endGame(){ G.phase='over';
  const t=G.time, k=G.kills, lv=G.level, up=G.upTotal;
  const isNew = t>RECORDS.bestTime || k>RECORDS.bestKills || lv>RECORDS.bestLevel;
  RECORDS.bestTime=Math.max(RECORDS.bestTime,t);
  RECORDS.bestKills=Math.max(RECORDS.bestKills,k);
  RECORDS.bestLevel=Math.max(RECORDS.bestLevel,lv);
  RECORDS.runs.push({t,k,lv,up});
  RECORDS.runs.sort((a,b)=>b.t-a.t); RECORDS.runs=RECORDS.runs.slice(0,5);
  saveRecords(RECORDS);
  document.getElementById('oT').textContent=t.toFixed(0);
  document.getElementById('oK').textContent=k;
  document.getElementById('oL').textContent=lv;
  document.getElementById('oU').textContent=up;
  document.getElementById('bT').textContent=RECORDS.bestTime.toFixed(0)+'초';
  document.getElementById('bK').textContent=RECORDS.bestKills;
  document.getElementById('bL').textContent='Lv'+RECORDS.bestLevel;
  document.getElementById('oNew').className='newrec'+(isNew?' show':'');
  document.getElementById('oRuns').innerHTML='<b>최고 기록 TOP 5</b>'+
    RECORDS.runs.map((r,i)=>'<div>'+(i+1)+'. ⏱'+r.t.toFixed(0)+'초 · 💀'+r.k+' · ⭐Lv'+r.lv+'</div>').join('');
  // 세이브포인트가 있으면 그곳에서 부활할 수 있다
  const rv=document.getElementById('revive');
  if(G.lastCp){
    const cp=Math.floor((G.lastCp.maxLevelSeen||0)/CFG.checkpointEvery)*CFG.checkpointEvery;
    rv.textContent='🚩 Lv'+cp+' 세이브포인트에서 부활';
    rv.style.display='inline-block';
  } else rv.style.display='none';
  document.getElementById('over').style.display='grid'; }

// ---- 상점 ----
function openShop(){ if(G.phase==='over') return; G.shopOpen=true;
  document.getElementById('shop').style.display='grid'; updateShop(); }
function closeShop(){ G.shopOpen=false; document.getElementById('shop').style.display='none'; }
function updateShop(){
  // 상점이 닫혀 있으면 아무것도 그리지 않는다. 이 함수는 골드 변동·설치·합체·판매 등
  // 13곳에서 불리고 전투 중에도 계속 도는데, 만지는 요소는 전부 #shop 안이라
  // 닫혀 있는 동안의 갱신은 화면에 보이지도 않으면서 프레임만 먹는다.
  // (여는 쪽 openShop() 이 곧바로 updateShop() 을 부르므로 열 때 최신 상태가 된다.)
  if(!G.shopOpen) return;
  document.getElementById('shopGold').textContent=Math.floor(G.gold);
  // 포탑 : 등급별 직접 구매 버튼
  const full=isKindFull('turret');            // 포탑 칸 전용 (레이저·발사기는 각자 따로)
  for(let i=0;i<CFG.turretTiers.length;i++){
    const T=CFG.turretTiers[i], b=document.getElementById('buyTur_'+i), c=turretCost(i);
    b.textContent='Lv'+(i+1)+' '+T.n+'\n공격 '+T.dmg+' × 초당 '+(1/T.fire).toFixed(1)+'발'
                 +'\n초당 화력 '+Math.round(T.dmg/T.fire).toLocaleString()+' · 💰'+c.toLocaleString();
    b.disabled = full || G.gold<c;
    b.style.borderLeft='4px solid '+T.top;
  }
  document.getElementById('turSlotInfo').textContent =
    full ? '⚠ 포탑은 최대 '+CFG.turretMax+'개까지 (합체하면 자리가 생깁니다)'
         : '포탑 '+countKind('turret')+'/'+CFG.turretMax+'개 · 산 포탑은 화면에서 끌어 원하는 곳에 배치';
  const maxT=CFG.turretTiers.length-1;
  let pair=-1;
  for(let i=maxT-1;i>=0;i--){ if(G.turrets.filter(t=>kindOf(t)==='turret'&&t.tier===i).length>=2){ pair=i; break; } }
  let rPair=-1;                                       // 연사 포탑 합체 짝
  for(let i=CFG.rapidTiers.length-2;i>=0;i--){ if(G.turrets.filter(t=>isRapid(t)&&t.tier===i).length>=2){ rPair=i; break; } }
  let nrgPair=null, nrgBest=-1;                       // 발사기 조합(레벨 합)
  const LL=G.turrets.filter(isLauncher);
  for(let i=0;i<LL.length;i++) for(let j=i+1;j<LL.length;j++){
    const r=mergeResult(LL[i],LL[j]); if(r>nrgBest){ nrgBest=r; nrgPair=[LL[i],LL[j]]; }
  }
  const mb=document.getElementById('mergeTurret');
  mb.textContent = pair>=0
    ? ('⚡ 합체\nLv'+(pair+1)+'×2 → '+CFG.turretTiers[pair+1].n
       +'\n연사 초당 '+(1/CFG.turretTiers[pair].fire).toFixed(1)+'→'+(1/CFG.turretTiers[pair+1].fire).toFixed(1)+'발')
    : rPair>=0
    ? ('⚡ 합체\n연사 Lv'+(rPair+1)+'×2 → '+CFG.rapidTiers[rPair+1].n
       +'\n연사 초당 '+(1/CFG.rapidTiers[rPair].fire).toFixed(1)+'→'+(1/CFG.rapidTiers[rPair+1].fire).toFixed(1)+'발')
    : (nrgPair
       ? ('⚡ 합체\n발사기 Lv'+(nrgPair[0].tier+1)+'+Lv'+(nrgPair[1].tier+1)+' → Lv'+(nrgBest+1)
          +'\n💰'+launcherMergeCost(nrgBest).toLocaleString()+' (합체금+코일)')
       : '⚡ 합체\n합칠 짝이 없음');
  mb.style.whiteSpace='pre-line';
  mb.disabled=(pair<0 && rPair<0 && (!nrgPair || G.gold<launcherMergeCost(nrgBest)));
  const sb=document.getElementById('sellTurret'), st=G.selTurret||G.turrets[G.turrets.length-1];
  sb.textContent = st ? ('♻ 판매\n'+tdef(st).n+' 💰+'+Math.round((isLauncher(st)?launcherBasePrice(st.tier)
                            :isLaser(st)?CFG.laserTiers[st.tier].cost
                            :turretBasePrice(st.tier))*CFG.turretSellFrac).toLocaleString())
                      : '♻ 판매\n보유 구조물 없음';
  sb.style.whiteSpace='pre-line'; sb.disabled=!st;
  const counts=new Array(CFG.turretTiers.length).fill(0);
  for(const t of G.turrets) if(kindOf(t)==='turret') counts[t.tier]++;
  const rCounts=new Array(CFG.rapidTiers.length).fill(0);
  for(const t of G.turrets) if(isRapid(t)) rCounts[t.tier]++;
  const lch=G.turrets.filter(isLauncher);
  const chips=counts.map((c,i)=>c?'<span class="tchip">Lv'+(i+1)+' '+CFG.turretTiers[i].n+' <b>×'+c+'</b></span>':'').join('')
    + rCounts.map((c,i)=>c?'<span class="tchip">🔫 Lv'+(i+1)+' '+CFG.rapidTiers[i].n+' <b>×'+c+'</b></span>':'').join('')
    + G.turrets.filter(isLaser).map(t=>'<span class="tchip">📡 Lv'+(t.tier+1)+' 레이저</span>').join('')
    + lch.map(t=>'<span class="tchip">⚡ Lv'+(t.tier+1)+' 발사기 <b>'+(t.coilT>0?Math.ceil(t.coilT)+'초':'코일 없음')+'</b></span>').join('');
  document.getElementById('turList').innerHTML = chips || '<span class="tchip">보유 구조물 없음</span>';

  // 특성
  // 특성 버튼은 buildTraitShop 이 만들어 둔 자식 노드에 **글자만** 갈아 끼운다.
  // 예전엔 12개 버튼마다 innerHTML 을 통째로 다시 썼는데, 그건 매번 파싱 + 레이아웃
  // 무효화라 프레임 예산을 통째로 먹었다(실측 p95 7.1ms → 28.0ms · fps 141 → 90).
  for(const t of CFG.traits){
    const b=document.getElementById('buyTrait_'+t.id);
    const own=hasTrait(t.id), open=traitUnlocked(t);
    const dis = own || !open || G.gold<t.cost;
    const sig = (own?1:0)+'|'+(open?1:0)+'|'+(dis?1:0);
    if(b._sig!==sig){                                   // 상태가 그대로면 DOM 을 건드리지 않는다
      b._sig=sig;
      b.className='buy tr'+(own?' own':(open?'':' lock'));
      b.style.borderLeft='4px solid '+t.col;
      b._tn.textContent=t.ic+' '+t.n+(own?' ✅':'');
      b._desc.textContent=(open||own ? t.desc : TRAIT[t.parent].n+'을(를) 먼저 얻어야 열립니다');
      b._cost.textContent=(own?'보유 중':'💰'+t.cost.toLocaleString());
      b.disabled=dis;
    }
  }
  if(G._traitInfoSig !== G.traits.join(',')){
    G._traitInfoSig = G.traits.join(',');
    const owned=CFG.traits.filter(t=>hasTrait(t.id));
    document.getElementById('traitInfo').innerHTML = owned.length
      ? '보유 특성 : '+owned.map(t=>'<span class="tchip">'+t.ic+' '+t.n+'</span>').join('')
        +' · 여러 개를 가지면 각각 따로 발동합니다.'
      : '아직 특성이 없습니다. 물·불·바람·땅 중 하나를 먼저 얻으세요.';
  }

  // 연사 포탑
  for(let i=0;i<CFG.rapidTiers.length;i++){
    const R=CFG.rapidTiers[i], b=document.getElementById('buyRap_'+i), c=rapidCost(i);
    b.textContent='Lv'+(i+1)+' '+R.n+'\n공격 '+R.dmg+' × 초당 '+(1/R.fire).toFixed(1)+'발'
                 +'\n초당 화력 '+Math.round(R.dmg/R.fire).toLocaleString()+' · 💰'+c.toLocaleString();
    b.disabled = isKindFull('rapid') || G.gold<c;
    b.style.borderLeft='4px solid '+R.top;
  }
  document.getElementById('rapInfo').textContent =
    (isKindFull('rapid') ? '⚠ 연사 포탑은 최대 '+CFG.rapidMax+'개까지 · ' : '')
    +'연사 포탑 '+countKind('rapid')+'/'+CFG.rapidMax+'대 (포탑 개수와 별도) · '
    +'공격력이 오르지 않으니 적이 세지는 후반에는 힘이 빠집니다. 초중반 화력용입니다.';

  // 레이저
  for(let i=0;i<CFG.laserTiers.length;i++){
    const L=CFG.laserTiers[i], b=document.getElementById('buyLsr_'+i), c=laserCost(i);
    b.textContent='Lv'+(i+1)+' 레이저\n초당 '+L.dps.toLocaleString()+' 피해\n💰'+c.toLocaleString();
    b.disabled = isKindFull('laser') || G.gold<c;
    b.style.borderLeft='4px solid '+L.top;
  }
  const nL=countKind('laser');
  document.getElementById('laserInfo').textContent =
    (isKindFull('laser') ? '⚠ 레이저는 최대 '+CFG.laserMax+'개까지 · ' : '')
    +'레이저 '+nL+'/'+CFG.laserMax+'대 (포탑 개수와 별도) · 사면 길 위에 자동으로 놓이고 빔이 길을 가로지릅니다. '
    +'좌클릭으로 고른 뒤 원하는 곳을 클릭하면 옮겨지고, 빔 방향은 그 자리의 길에 맞춰 자동으로 돌아갑니다.';

  // 에너지 병기
  const cc=coilCost(), bc=document.getElementById('buyCoil');
  for(let i=0;i<CFG.launcherTiers.length;i++){
    const L=CFG.launcherTiers[i], b=document.getElementById('buyNrg_'+i), c=launcherCost(i);
    b.textContent='Lv'+(i+1)+' 발사기\n초당 '+(1/L.fire).toFixed(2)+'발 · 코일 '+L.coilDur+'초\n💰'+c.toLocaleString();
    b.disabled = isKindFull('launcher') || G.gold<c;
    b.style.borderLeft='4px solid '+L.top;
  }
  const empty=lch.filter(t=>t.coilT<=0).length;
  bc.textContent=(empty?'🔋 에너지 코일 재장착\n':'🔋 에너지 코일\n')+CFG.coilDur+'초 가동 · 💰'+cc.toLocaleString();
  bc.style.whiteSpace='pre-line'; bc.disabled = !lch.length || G.gold<cc;
  document.getElementById('nrgInfo').textContent = !lch.length
    ? '발사기를 먼저 설치해야 코일을 넣을 수 있습니다. 발사기끼리 겹치면 레벨이 더해집니다.'
    : '발사기 '+lch.length+'/'+CFG.launcherMax+'대 (포탑·레이저와 별도)'+(empty?' · 빈 발사기 '+empty+'대':'')
      +' · 코일이 다 닳아도 새 코일을 넣으면 다시 가동됩니다(레벨이 높을수록 오래 감). '
      +'화면에서 고른 발사기에 들어가고(안 고르면 비어있는 쪽), 켜져 있으면 시간이 더해집니다.';
  const wc=CFG.weapons[G.weaponTier], wn=CFG.weapons[G.weaponTier+1];
  document.getElementById('weaponCur').textContent='· 현재 '+wc.n+' (공격 +'+wc.dmg+')';
  const bw=document.getElementById('buyWeapon');
  if(wn){ bw.textContent='▶ '+wn.n+'  (공격 +'+wn.dmg+')   💰'+wn.cost; bw.disabled=G.gold<wn.cost; }
  else { bw.textContent='최고 등급 달성'; bw.disabled=true; }
  const ac=CFG.armors[G.armorTier], an=CFG.armors[G.armorTier+1];
  document.getElementById('armorCur').textContent='· 현재 '+ac.n+' (방어 '+ac.def+')';
  const ba=document.getElementById('buyArmor');
  if(an){ ba.textContent='▶ '+an.n+'  (방어 '+an.def+')   💰'+an.cost; ba.disabled=G.gold<an.cost; }
  else { ba.textContent='최고 등급 달성'; ba.disabled=true; }
  for(const p of CFG.potions){
    const b=document.getElementById('buyPot_'+p.key), c=potionCost(p.key), n=G.potBought[p.key]||0;
    b.textContent=p.n+(n?' ×'+n:'')+'\n'+p.desc+' · 💰'+c.toLocaleString();
    b.style.whiteSpace='pre-line';
    b.disabled=G.gold<c;
  }
  for(const d of CFG.dolls){
    const b=document.getElementById('buyDoll_'+d.key), c=dollCost(d.key), n=G.dollBought[d.key]||0;
    b.textContent=d.n+(n?' ×'+n:'')+'\n'+d.desc+' · 💰'+c.toLocaleString();
    b.style.whiteSpace='pre-line';
    b.disabled=G.gold<c;
  }
}
function buyWeapon(){ const w=CFG.weapons[G.weaponTier+1]; if(!w||G.gold<w.cost) return;
  G.gold-=w.cost; G.weaponTier++; applyAllyStats();
  floatText(baseNode().x,baseNode().y,w.n+' 장착!','#ffd166'); updateShop(); }
function buyArmor(){ const a=CFG.armors[G.armorTier+1]; if(!a||G.gold<a.cost) return;
  G.gold-=a.cost; G.armorTier++; applyAllyStats();
  floatText(baseNode().x,baseNode().y,a.n+' 장착!','#8ad3ff'); updateShop(); }
// 소모품 가격 : 같은 종류를 살수록 상승
function potionCost(key){
  const p=CFG.potions.find(x=>x.key===key); if(!p) return 0;
  return Math.round(p.cost*Math.pow(CFG.potionCostMul, G.potBought[key]||0));
}
function dollCost(key){
  const d=CFG.dolls.find(x=>x.key===key); if(!d) return 0;
  return Math.round(d.cost*Math.pow(CFG.dollCostMul, G.dollBought[key]||0));
}
function applyPotion(e,key){
  if(key==='slow') e.slowT=Math.max(e.slowT,5);
  else if(key==='poison') e.poisonT=Math.max(e.poisonT,6);
  else if(key==='weak') e.weakT=Math.max(e.weakT,6);
  else if(key==='freeze') e.freezeT=Math.max(e.freezeT,3);
}
function buyPotion(key){
  const p=CFG.potions.find(x=>x.key===key); if(!p) return;
  const cost=potionCost(key); if(G.gold<cost) return;
  G.gold-=cost; G.potBought[key]=(G.potBought[key]||0)+1;
  const b=baseNode();
  if(p.type==='heal'){                                                                   // 치유 물약: 살아있는 아군 회복
    let n=0; for(const a of G.allies){ if(a.dead) continue; a.hp=Math.min(a.maxHp, a.hp+a.maxHp*p.healFrac); n++; }
    floatText(b.x,b.y, p.n+' → 아군 '+n+'명 회복!', '#7CFC00'); updateShop(); return;
  }
  let hit=0;
  for(const e of G.enemies){ if(Math.random()<p.prob){ hit++; applyPotion(e,key); } }  // 현재 필드의 적 전원 확률 적용
  G.potionField.push({key, prob:p.prob, t:CFG.potionLinger});                            // 잔류 물약장: 이후 스폰 적에도 확률 적용
  floatText(b.x,b.y, p.n+' → '+hit+'마리 적중 (+'+CFG.potionLinger+'초 지속)', '#c7b3ff');
  updateShop();
}
function buyDoll(key){
  const d=CFG.dolls.find(x=>x.key===key); if(!d) return;
  const cost=dollCost(key); if(G.gold<cost) return;
  G.gold-=cost; G.dollBought[key]=(G.dollBought[key]||0)+1;
  const b=baseNode();
  if(key==='revive'){ let n=0; for(const a of G.allies){ if(a.dead){ a.dead=false; a.hp=a.maxHp*CFG.reviveFrac; n++; } }
    layoutAllies(); floatText(b.x,b.y,'부활인형 → '+n+'명 부활!','#8ad3ff'); }
  else if(key==='heal'){ for(const a of G.allies){ if(!a.dead) a.hp=Math.min(a.maxHp, a.hp+a.maxHp*CFG.healDollFrac); }
    floatText(b.x,b.y,'치유인형 → 전원 HP '+Math.round(CFG.healDollFrac*100)+'% 회복!','#7CFC00'); }
  else if(key==='flame'){ for(const e of G.enemies){ e.burnT=Math.max(e.burnT,CFG.burnDur); e.burnPct=CFG.burnFrac; } floatText(b.x,b.y,'화염인형 → 전체 화상!','#ff7a1a'); }
  else if(key==='curse'){ for(const e of G.enemies){ e.hp-=e.maxHp*CFG.curseFrac; e.flash=0.15; if(e.hp<=0) e.dead=true; } floatText(b.x,b.y,'저주인형 → 전체 큰 피해!','#b06bff'); }
  else if(key==='illusion'){ G.levelOffset++; floatText(b.x,b.y,'환각인형 → 난이도 -1','#a7e0ff'); }
  else if(key==='freeze'){ for(const e of G.enemies) e.freezeT=Math.max(e.freezeT,CFG.freezeDollDur); floatText(b.x,b.y,'빙결인형 → 전체 빙결!','#7fd4ff'); }
  else if(key==='rage'){ G.buffs.rageT=CFG.rageDur; floatText(b.x,b.y,'분노인형 → 화력 상승!','#ff5a6a'); }
  else if(key==='luck'){ G.buffs.luckT=CFG.luckDur; floatText(b.x,b.y,'행운인형 → 골드 2배!','#ffd166'); }
  else if(key==='guard'){ G.buffs.guardT=CFG.guardDur; floatText(b.x,b.y,'수호인형 → 방어 상승!','#8ad3ff'); }
  updateShop();
}

// ---- 보스 처치 보상 : 강할수록(스폰 스테이지↑) 좋은 랜덤 아이템 ----
// apply() 는 "실제로 무엇을 얼마나 받았는지"를 문장으로 돌려준다 (보상 창에 그대로 표시)
const BOSS_REWARDS = [
  {q:1, label:'골드 소량', apply:()=>{ const g=20+G.level*3; G.gold+=g; return '골드 +'+g.toLocaleString(); }},
  {q:1, label:'감속',     apply:()=>{ let n=0; for(const e of G.enemies){ e.slowT=Math.max(e.slowT,5); n++; }
                                      return '적 '+n+'마리 감속 5초'; }},
  {q:2, label:'독',       apply:()=>{ let n=0; for(const e of G.enemies){ e.poisonT=Math.max(e.poisonT,6); n++; }
                                      return '적 '+n+'마리 독 6초'; }},
  {q:2, label:'화상',     apply:()=>{ let n=0; for(const e of G.enemies){ e.burnT=Math.max(e.burnT,CFG.burnDur); e.burnPct=CFG.burnFrac; n++; }
                                      return '적 '+n+'마리 화상 '+CFG.burnDur+'초'; }},
  {q:3, label:'전원 치유', apply:()=>{ let n=0; for(const a of G.allies){ if(!a.dead){ a.hp=a.maxHp; n++; } }
                                      return '아군 '+n+'명 체력 완전 회복'; }},
  {q:3, label:'행운 버프', apply:()=>{ G.buffs.luckT=CFG.luckDur; return '골드 '+CFG.luckMult+'배 '+CFG.luckDur+'초'; }},
  {q:3, label:'전체 빙결', apply:()=>{ let n=0; for(const e of G.enemies){ e.freezeT=Math.max(e.freezeT,CFG.freezeDollDur); n++; }
                                      return '적 '+n+'마리 빙결 '+CFG.freezeDollDur+'초'; }},
  {q:4, label:'분노 버프', apply:()=>{ G.buffs.rageT=CFG.rageDur; return '아군 화력 상승 '+CFG.rageDur+'초'; }},
  {q:4, label:'수호 버프', apply:()=>{ G.buffs.guardT=CFG.guardDur; return '아군 방어 +'+CFG.guardDef+' '+CFG.guardDur+'초'; }},
  {q:4, label:'무기 강화', apply:()=>{ if(G.weaponTier<CFG.weapons.length-1){ G.weaponTier++; applyAllyStats();
                                        return '무기 → '+CFG.weapons[G.weaponTier].n+' (공격 +'+weaponDmg()+')'; }
                                      G.gold+=120; return '무기 최고 단계 · 골드 +120'; }},
  {q:4, label:'방어구 강화',apply:()=>{ if(G.armorTier<CFG.armors.length-1){ G.armorTier++; applyAllyStats();
                                        return '방어구 → '+CFG.armors[G.armorTier].n+' (방어 '+armorDef()+')'; }
                                      G.gold+=120; return '방어구 최고 단계 · 골드 +120'; }},
  {q:5, label:'부활+완전회복',apply:()=>{ const d=G.allies.filter(a=>a.dead).length;
                                      for(const a of G.allies){ a.dead=false; a.hp=a.maxHp; } layoutAllies();
                                      return '아군 '+d+'명 부활 + 전원 완전 회복'; }},
  {q:5, label:'대박 골드',  apply:()=>{ const g=150+G.level*10; G.gold+=g; return '골드 +'+g.toLocaleString(); }},
];
function rollReward(tier){                     // tier 근처의 q를 선호 (약한 보스=낮은 q, 강한 보스=높은 q)
  let total=0; const w=BOSS_REWARDS.map(r=>{ const v=1/(1+Math.abs(r.q-tier)); total+=v; return v; });
  let x=Math.random()*total;
  for(let i=0;i<BOSS_REWARDS.length;i++){ x-=w[i]; if(x<=0) return BOSS_REWARDS[i]; }
  return BOSS_REWARDS[BOSS_REWARDS.length-1];
}
function dropBossReward(e){
  const T=Math.max(1, Math.round((e.bossLevel||G.level)/CFG.bossEvery));   // 보스 강함 등급
  const cT=Math.min(5,T), px=e.x, py=e.y, luck=(G.buffs.luckT>0?CFG.luckMult:1);
  const gold=Math.round(CFG.bossGoldBase*T*(0.8+Math.random()*0.6))*luck;  // 대량 골드(강할수록 많음)
  G.gold+=gold;
  floatText(px,py-18,'💰 +'+gold.toLocaleString(),'#ffd166',CFG.bossFloatLife);
  const rolls=Math.min(3, Math.ceil(cT/2));                                // 강할수록 아이템 개수↑
  const items=[];
  for(let i=0;i<rolls;i++){
    const r=rollReward(cT);
    const detail=r.apply() || r.label;                                     // 실제 받은 내용
    items.push({label:r.label, detail});
    floatText(px,py-54-i*38,'🎁 '+r.label,'#8ad3ff',CFG.bossFloatLife);   // 겹치지 않게 간격
  }
  showBossLog(e.bossLevel||G.level, gold, items);                          // 화면에 오래 남는 보상 창
}

// ---- 보스 보상 창 : 무엇을 받았는지 충분히 오래 보여준다 ----
let bossLogT=0;
function showBossLog(level, gold, items){
  const el=document.getElementById('bossLog');
  if(!el) return;
  el.innerHTML='<h4>👑 보스 처치!  <span class="lv">스테이지 '+level+'</span></h4>'
    +'<div class="row"><span class="ic">💰</span><span class="g">골드 +'+gold.toLocaleString()+'</span></div>'
    +items.map(it=>'<div class="row"><span class="ic">🎁</span><span class="it">'+it.label+'</span>'
                  +'<span class="dt">'+it.detail+'</span></div>').join('')
    +'<div class="tm">누르면 닫기 · '+CFG.bossLogDur+'초 뒤 자동으로 사라집니다</div>';
  el.style.display='block';
  bossLogT=CFG.bossLogDur;
}
function hideBossLog(){ bossLogT=0; const el=document.getElementById('bossLog'); if(el) el.style.display='none'; }

// ---- 포탑 조작 : 끌어서 아무 곳으로나 이동 / 같은 레벨 위에 놓으면 합체 ----
function ptOf(ev){ const r=cv.getBoundingClientRect(); return {mx:ev.clientX-r.left, my:ev.clientY-r.top}; }
// 클릭 판정 : 포탑이 실제로 그려진 범위(받침~머리 꼭대기) 전체를 잡는다.
// 예전엔 총구 높이 한 점에서 46px 이내만 인식해서, 받침이 큰 용의 포탑은 몸통을 눌러도 안 잡혔다.
function turretHitBox(t){
  const T=tdef(t), sc=CAM.scale;
  const topZ=8+t.tier*0.8 + T.hh + (10+t.tier*1.4) + (T.style==='dragon'?14:6);
  // 용의 포탑 날개처럼 받침 밖으로 튀어나온 장식까지 덮도록 넉넉하게 잡는다
  const halfW=(T.base*1.05)*ISO_X*1.42*sc + 10;         // 좌우 반폭(화면 px)
  const foot =(T.base*0.62)*ISO_Y*1.42*sc + 6;          // 받침 다이아몬드 아래 여유
  const cx=isoX(t.x,t.y);
  return {cx, x0:cx-halfW, x1:cx+halfW,
          y0:isoY(t.x,t.y,topZ)-22, y1:isoY(t.x,t.y,0)+foot,   // -22 = 머리 위 레벨 라벨까지
          cy:(isoY(t.x,t.y,topZ)+isoY(t.x,t.y,0))/2};
}
function turretAt(mx,my,exclude){
  let hit=null, bd=Infinity;
  for(const t of G.turrets){
    if(t===exclude) continue;
    const b=turretHitBox(t);
    if(mx<b.x0||mx>b.x1||my<b.y0||my>b.y1) continue;     // 그려진 범위 밖
    const d=(b.cx-mx)**2+(b.cy-my)**2;                   // 겹치면 중심에 가까운 쪽
    if(d<bd){ bd=d; hit=t; }
  }
  if(hit) return hit;
  let bd2=44*44;                                         // 못 맞혔으면 가까운 구조물을 관대하게
  for(const t of G.turrets){
    if(t===exclude) continue;
    const b=turretHitBox(t);
    const d=(b.cx-mx)**2+(b.cy-my)**2; if(d<bd2){ bd2=d; hit=t; }
  }
  return hit;
}
let dragT=null, dragOn=false, dpx=0, dpy=0, grabX=0, grabY=0, dragFrom=null;
cv.addEventListener('pointerdown', ev=>{
  if(G.shopOpen||G.phase==='over') return;
  const {mx,my}=ptOf(ev);
  const hit=turretAt(mx,my);
  if(!hit){                                                  // 빈 곳을 탭 → 고른 포탑을 그 자리로
    if(G.selTurret){ const w=screenToWorld(mx,my); moveTurret(G.selTurret,w.x,w.y); return; }
    return;
  }
  const w=screenToWorld(mx,my);
  dragT=hit; dragOn=false; dpx=mx; dpy=my;
  grabX=hit.x-w.x; grabY=hit.y-w.y;                          // 잡은 지점과의 상대 위치 유지
  dragFrom={x:hit.x, y:hit.y};                               // 못 놓으면 되돌릴 원래 자리
  if(!G.selTurret || G.selTurret===hit){ G.selTurret=(G.selTurret===hit)?null:hit; return; }
  if(canMerge(G.selTurret,hit)){ mergeTurrets(G.selTurret,hit); dragT=null; }
  else {
    const msg=mergeFailMsg(G.selTurret,hit);
    if(msg) floatText(hit.x,hit.y,msg,'#ff8a97');
    G.selTurret=hit;                                   // 못 합치면 그 구조물을 대신 고른다
  }
});
cv.addEventListener('pointermove', ev=>{
  if(!dragT) return;
  const {mx,my}=ptOf(ev);
  if(!dragOn && Math.hypot(mx-dpx,my-dpy)>10) dragOn=true;   // 10px 이상 움직이면 드래그 시작
  if(!dragOn) return;
  const w=screenToWorld(mx,my);
  dragT.x=w.x+grabX; dragT.y=w.y+grabY;                      // 포탑이 손가락을 따라옴
  G.selTurret=dragT;
  const over=turretAt(mx,my,dragT);
  const merge=canMerge(dragT,over) ? over : null;
  G.dropInfo={ merge, land: merge?null:placeSpot(dragT.x,dragT.y,dragT) };   // 실제로 놓일 위치
});
function endDrag(ev){
  if(dragT && dragOn){
    const {mx,my}=ptOf(ev), over=turretAt(mx,my,dragT);
    if(canMerge(dragT,over)){
      dragT.x=dragFrom.x; dragT.y=dragFrom.y;                // 합체는 대상 자리에서
      mergeTurrets(dragT,over);
    } else {
      const s=placeSpot(dragT.x,dragT.y,dragT);              // 어디에 놓든 그 자리(또는 바로 옆)에 배치
      if(s){ dragT.x=s.x; dragT.y=s.y;
        if(isLaser(dragT)) dragT.ang=pathAngleAt(dragT.x,dragT.y);
        burst(s.x,s.y,'#8ad3ff',6); floatText(s.x,s.y,'↔ 포탑 이동','#8ad3ff'); G.selTurret=null;
        if(over){ const msg=mergeFailMsg(dragT,over); if(msg) floatText(over.x,over.y,msg,'#c8b4ff'); }
      } else { dragT.x=dragFrom.x; dragT.y=dragFrom.y; }     // (맵이 꽉 찬 극단적 경우만)
    }
  }
  dragT=null; dragOn=false; G.dropInfo=null;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', ()=>{
  if(dragT&&dragOn&&dragFrom){ dragT.x=dragFrom.x; dragT.y=dragFrom.y; }
  dragT=null; dragOn=false; G.dropInfo=null;
});

// ---- 저장 / 불러오기 화면 ----
function fmtWhen(ms){
  const d=new Date(ms), z=n=>String(n).padStart(2,'0');
  return (d.getMonth()+1)+'/'+d.getDate()+' '+z(d.getHours())+':'+z(d.getMinutes());
}
function updateSaves(){
  const sv=loadSaved();
  const ds=document.getElementById('doSave'), dl=document.getElementById('doLoad'), dd=document.getElementById('doDelete');
  ds.textContent='💾 지금 저장하기\n난이도 Lv'+G.level+' · 골드 '+Math.floor(G.gold).toLocaleString();
  ds.style.whiteSpace='pre-line'; ds.disabled=(G.phase==='over');
  if(sv){
    dl.textContent='📂 불러오기\nLv'+(sv.maxLevelSeen||1)+' · '+Math.floor(sv.gold||0).toLocaleString()+'골드 · '+fmtWhen(sv.at);
    dl.disabled=false; dd.textContent='🗑 저장 삭제'; dd.disabled=false;
  } else {
    dl.textContent='📂 불러오기\n저장된 기록 없음'; dl.disabled=true;
    dd.textContent='🗑 저장 삭제\n없음'; dd.disabled=true;
  }
  dl.style.whiteSpace='pre-line'; dd.style.whiteSpace='pre-line';
  document.getElementById('saveInfo').textContent = sv
    ? '저장한 판을 그대로 이어서 합니다(적은 새로 몰려옵니다). 세이브포인트에 도달하면 자동으로도 저장됩니다.'
    : '아직 저장된 판이 없습니다. 세이브포인트(난이도 '+CFG.checkpointEvery+' 간격)에 도달하면 자동 저장됩니다.';
  const done=(sv&&sv.cpList||G.cpList||[]);
  document.getElementById('cpInfo').textContent =
    '🚩 세이브포인트 : 난이도 '+CFG.checkpointEvery+' 간격 (50·100·150·200·250·300…) — '
    + (done.length ? '도달함 Lv'+done.join(', Lv') : '아직 도달한 곳 없음')
    + ' · 기지가 함락되면 마지막 세이브포인트에서 부활할 수 있습니다.';
}
function openSaves(){ updateSaves(); document.getElementById('saves').style.display='grid'; }
function closeSaves(){ document.getElementById('saves').style.display='none'; }
document.getElementById('bossLog').onclick=hideBossLog;
document.getElementById('saveBtn').onclick=openSaves;
document.getElementById('savesClose').onclick=closeSaves;
document.getElementById('doSave').onclick=()=>{
  const ok=saveGame(); const b=baseNode();
  floatText(b.x,b.y, ok?'💾 저장 완료':'저장 실패(브라우저 저장공간)', ok?'#38e8b0':'#ff8a97');
  updateSaves();
};
document.getElementById('doLoad').onclick=()=>{
  const sv=loadSaved(); if(!sv) return;
  if(restore(sv)){ G.lastCp=sv.lastCp||null;        // 세이브포인트는 저장 파일에서만 세운다
    closeSaves();
    const b=baseNode(); floatText(b.x,b.y,'📂 불러왔습니다 — "재개"를 누르세요','#8ad3ff'); }
};
document.getElementById('doDelete').onclick=()=>{ deleteSave(); updateSaves(); };
document.getElementById('revive').onclick=reviveAtCheckpoint;

// ---- 길 고르기 ----
function drawMapPreview(cv2, m, on){                 // 미니 경로 미리보기
  const g=cv2.getContext('2d'), W2=cv2.width, H2=cv2.height, pad=7;
  g.clearRect(0,0,W2,H2);
  g.fillStyle=on?'#1c4a2c':'#14301c'; g.fillRect(0,0,W2,H2);
  const sx=(W2-pad*2)/13, sy=(H2-pad*2)/7;
  g.strokeStyle=on?'#7cf3ff':'#9aa6c4'; g.lineWidth=3; g.lineJoin='round'; g.lineCap='round';
  g.beginPath();
  m.pts.forEach(([gx,gy],i)=>{ const x=pad+gx*sx, y=pad+gy*sy; i?g.lineTo(x,y):g.moveTo(x,y); });
  g.stroke();
  const s=m.pts[0], e=m.pts[m.pts.length-1];
  g.fillStyle='#ff5a6a'; g.beginPath(); g.arc(pad+s[0]*sx,pad+s[1]*sy,4,0,7); g.fill();   // 시작
  g.fillStyle='#38e8b0'; g.beginPath(); g.arc(pad+e[0]*sx,pad+e[1]*sy,4.5,0,7); g.fill(); // 기지
}
function buildMapList(){
  document.getElementById('mapCount').textContent=MAPS.length;
  const list=document.getElementById('mapList');
  list.innerHTML='';
  MAPS.forEach((m,i)=>{
    const b=document.createElement('button');
    b.className='mapopt'+(i===G.pathIndex?' sel':'');
    const c=document.createElement('canvas'); c.width=196; c.height=112;
    const txt=document.createElement('div'); txt.className='mt';
    txt.innerHTML='<div class="mn">'+m.n+'</div><div class="md">'+m.desc+
                  ' · 길이 '+pathLength(m.pts)+'칸</div>';
    b.appendChild(c); b.appendChild(txt);
    b.onclick=()=>{ if(i!==G.pathIndex) selectMap(i); buildMapList(); closeMaps(); };
    list.appendChild(b);
    drawMapPreview(c,m,i===G.pathIndex);
  });
}
function openMaps(){ buildMapList(); document.getElementById('maps').style.display='grid'; }
function closeMaps(){ document.getElementById('maps').style.display='none'; }
document.getElementById('mapBtn').onclick=openMaps;
document.getElementById('mapsClose').onclick=closeMaps;

document.getElementById('rotBtn').onclick=rotateView;
document.getElementById('shopBtn').onclick=openShop;
document.getElementById('shopClose').onclick=closeShop;
(function buildTurretShop(){                     // 등급별 구매 버튼 생성
  const grid=document.getElementById('turBuyGrid');
  CFG.turretTiers.forEach((T,i)=>{
    const b=document.createElement('button');
    b.id='buyTur_'+i; b.className='buy tur'; b.style.whiteSpace='pre-line';
    b.onclick=()=>buyTurret(i);
    grid.appendChild(b);
  });
})();
document.getElementById('mergeTurret').onclick=()=>{ autoMerge(); updateShop(); };
(function buildTraitShop(){                      // 특성 : 기본 원소 한 줄 + 그 아래 두 갈래
  const grid=document.getElementById('traitGrid');
  for(const base of CFG.traits.filter(t=>!t.parent)){
    const row=document.createElement('div'); row.className='trrow';
    for(const t of [base, ...CFG.traits.filter(k=>k.parent===base.id)]){
      const b=document.createElement('button');
      b.id='buyTrait_'+t.id; b.className='buy tr'; b.style.whiteSpace='normal';
      // 자식 3개를 여기서 한 번만 만든다 — 갱신은 textContent 로만 한다(위 updateShop 참조).
      b._tn=document.createElement('div');   b._tn.className='tn';
      b._desc=document.createElement('div'); b._desc.className='td';
      b._cost=document.createElement('div'); b._cost.className='td';
      b.appendChild(b._tn); b.appendChild(b._desc); b.appendChild(b._cost);
      b.onclick=()=>buyTrait(t.id);
      row.appendChild(b);
    }
    grid.appendChild(row);
  }
})();
(function buildRapidShop(){                      // 레벨별 연사 포탑 구매 버튼
  const grid=document.getElementById('rapBuyGrid');
  CFG.rapidTiers.forEach((R,i)=>{
    const b=document.createElement('button');
    b.id='buyRap_'+i; b.className='buy rap'; b.style.whiteSpace='pre-line';
    b.onclick=()=>buyRapid(i);
    grid.appendChild(b);
  });
})();
(function buildLaserShop(){                      // 레벨별 레이저 구매 버튼
  const grid=document.getElementById('laserBuyGrid');
  CFG.laserTiers.forEach((L,i)=>{
    const b=document.createElement('button');
    b.id='buyLsr_'+i; b.className='buy lsr'; b.style.whiteSpace='pre-line';
    b.onclick=()=>buyLaser(i);
    grid.appendChild(b);
  });
})();
(function buildLauncherShop(){                    // 레벨별 발사기 구매 버튼
  const grid=document.getElementById('nrgBuyGrid');
  CFG.launcherTiers.forEach((L,i)=>{
    const b=document.createElement('button');
    b.id='buyNrg_'+i; b.className='buy nrg'; b.style.whiteSpace='pre-line';
    b.onclick=()=>buyLauncher(i);
    grid.appendChild(b);
  });
})();
document.getElementById('buyCoil').onclick=buyCoil;
document.getElementById('sellTurret').onclick=sellTurret;
document.getElementById('buyWeapon').onclick=buyWeapon;
document.getElementById('buyArmor').onclick=buyArmor;
for(const p of CFG.potions){ document.getElementById('buyPot_'+p.key).onclick=()=>buyPotion(p.key); }
for(const d of CFG.dolls){ document.getElementById('buyDoll_'+d.key).onclick=()=>buyDoll(d.key); }
document.getElementById('up').onclick=doUpgrade;
document.getElementById('start').onclick=startGame;
document.getElementById('stop').onclick=stopGame;
document.getElementById('again').onclick=startGame;

GAME_READY=true;
buildDecor(0);
resize(); reset(); updateHUD();
requestAnimationFrame(frame);
