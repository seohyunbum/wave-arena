import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser, wait } from './cdp-harness.mjs';

const targetUrl=new URL(process.argv[2]||'http://127.0.0.1:4173/').href;
const browser=await launchBrowser(targetUrl,{width:1440,height:900,dpr:1});
const setup=high=>'(() => {'+
  'G.phase="paused";G.shopOpen=true;document.getElementById("shop").style.display="none";'+
  'G.enemies.length=0;G.turrets.length=0;G.shots.length=0;G.beams.length=0;G.fx.length=0;G.nums.length=0;G.rings.length=0;'+
  'G.upTotal='+(high?15:0)+';G.weaponTier='+(high?15:0)+';G.armorTier='+(high?15:0)+';'+
  'G.allies=[];for(let i=0;i<3;i++)G.allies.push(newAlly());layoutAllies();applyAllyStats();'+
  'const b=baseNode(),mk=(kind,tier,x,y,extra)=>Object.assign({kind:kind==="turret"?undefined:kind,tier,x,y,cd:99,shootFlash:0,aim:-2.35,aimT:null,spin:0,hitT:0,dealt:0,coilT:0,ang:-.8},extra||{});'+
  (high
    ? 'G.turrets.push(mk("turret",14,b.x-170,b.y-120),mk("rapid",9,b.x+185,b.y-115),mk("laser",5,b.x-190,b.y+120,{ang:-.78}),mk("launcher",4,b.x+190,b.y+120,{coilT:80}));'
    : 'G.turrets.push(mk("turret",0,b.x-170,b.y-120),mk("rapid",0,b.x+185,b.y-115),mk("laser",0,b.x-190,b.y+120,{ang:-.78}),mk("launcher",0,b.x+190,b.y+120,{coilT:50}));')+
  'const levels='+(high?'[30,24,18,12]':'[1,1,1,1]')+';levels.forEach((lv,i)=>{G.level=lv;spawnEnemy();const e=G.enemies.at(-1);e.x=b.x-250+i*72;e.y=b.y-10-i*42;e.speed=0;e.hp=e.maxHp=999999;e.face=.72;});'+
  (high?'G.level=30;spawnBoss();const boss=G.enemies.at(-1);boss.x=b.x+25;boss.y=b.y-190;boss.speed=0;boss.hp=boss.maxHp=999999;':'')+
  'const target=G.enemies[0],tiers='+(high?'[3,6,9,12,15]':'[0,0,0,0,0]')+';tiers.forEach((tier,i)=>G.shots.push({x:b.x-210+i*78,y:b.y+205-i*15,z:36,target,dmg:1,speed:0,size:6+tier*.25,col:["#ffd166","#8ad3ff","#a98bff","#5ce1ff","#ffd15c"][i],visual:projectileVisualSpec("ally",tier)}));'+
  (high?'G.beams.push({x1:b.x+190,y1:b.y+120,z1:80,x2:b.x+20,y2:b.y-190,z2:40,t:0.05,life:.3,visual:projectileVisualSpec("launcher",4)});':'')+
  'G.level='+(high?30:1)+';CAM.rot=0;CAM.cos=1;CAM.sin=0;resize();return visualContractSnapshot();})()';

try{
  await browser.send('Page.navigate',{url:targetUrl}); await wait(1200);
  await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
  for(const high of [false,true]){
    await browser.evaluate(setup(high)); await wait(350);
    const shot=await browser.send('Page.captureScreenshot',{format:'png',fromSurface:true});
    const file=new URL('../artifacts/visual-'+(high?'high':'low')+'.png',import.meta.url);
    await writeFile(file,Buffer.from(shot.data,'base64'));
    console.log(fileURL(file));
  }
  if(browser.exceptions.length) throw new Error(browser.exceptions.join(' | '));
  if(browser.errorLogs.length) throw new Error(browser.errorLogs.join(' | '));
  console.log('WAVE_ARENA_VISUAL_CAPTURE_OK');
} finally { await browser.close(); }
function fileURL(url){ return decodeURIComponent(url.pathname).replace(/^\/(?:([A-Za-z]:))/, '$1').replaceAll('/','\\'); }