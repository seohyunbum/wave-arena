import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { launchBrowser, metricMap, wait } from './cdp-harness.mjs';

const gates = JSON.parse(await readFile(new URL('../quality-gates.json', import.meta.url), 'utf8'));
const budget = gates.performance;
const targetUrl = new URL(process.argv[2] || 'http://127.0.0.1:4173/').href;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const browser = await launchBrowser(targetUrl, budget.viewport);
console.log('[perf] browser', browser.browserBin);

const sampleExpression = [
  'new Promise(resolve=>{',
  'const duration=' + budget.durationMs + ',intervals=[];',
  'let frames=0,previous=0,start=0;',
  'const tick=now=>{',
  'if(!start){start=now;previous=now;}else{intervals.push(now-previous);previous=now;frames++;}',
  'if(now-start<duration)requestAnimationFrame(tick);else{',
  'intervals.sort((a,b)=>a-b);',
  'const pick=q=>intervals[Math.min(intervals.length-1,Math.floor(intervals.length*q))]||0;',
  'resolve({elapsedMs:now-start,frames,fps:frames*1000/(now-start),p50Ms:pick(.5),p95Ms:pick(.95),',
  'p99Ms:pick(.99),maxMs:intervals.at(-1)||0,over33ms:intervals.filter(v=>v>33.34).length,',
  'over50ms:intervals.filter(v=>v>50).length,heapMb:performance.memory?performance.memory.usedJSHeapSize/1048576:null});',
  '}};requestAnimationFrame(tick);})'
].join('');

const sample = async () => {
  const before = metricMap(await browser.send('Performance.getMetrics'));
  const result = await browser.evaluate(sampleExpression, true);
  const after = metricMap(await browser.send('Performance.getMetrics'));
  result.taskTimeMs = (after.TaskDuration - before.TaskDuration) * 1000;
  result.scriptTimeMs = (after.ScriptDuration - before.ScriptDuration) * 1000;
  result.over33Ratio = result.over33ms / Math.max(1, result.frames);
  result.over50Ratio = result.over50ms / Math.max(1, result.frames);
  return result;
};

const createLoad = enemyCount => browser.evaluate('(() => {' +
  'G.phase="paused";G.enemies.length=0;G.turrets.length=0;G.shots.length=0;' +
  'G.fx.length=0;G.rings.length=0;G.nums.length=0;G.gold=Number.MAX_SAFE_INTEGER;' +
  'for(let i=0;i<CFG.turretMax;i++)buyTurret(CFG.turretTiers.length-1);' +
  'for(let i=0;i<CFG.rapidMax;i++)buyRapid(CFG.rapidTiers.length-1);' +
  'for(let i=0;i<CFG.laserMax;i++)buyLaser(CFG.laserTiers.length-1);' +
  'for(let i=0;i<CFG.launcherMax;i++)buyLauncher(CFG.launcherTiers.length-1);' +
  'for(let i=0;i<' + enemyCount + ';i++)spawnEnemy();' +
  'const guns=G.turrets.filter(t=>!isLaser(t));' +
  'G.enemies.forEach((enemy,i)=>{const turret=guns[i%Math.max(1,guns.length)];' +
    'if(turret){enemy.x=turret.x+45+(i%3)*8;enemy.y=turret.y+((i%5)-2)*11;}' +
    'enemy.hp=enemy.maxHp=1e15;enemy.speed=0;});' +
  'return {enemies:G.enemies.length,turrets:G.turrets.length,' +
    'byKind:Object.fromEntries(["turret","rapid","laser","launcher"].map(kind=>[kind,G.turrets.filter(t=>kindOf(t)===kind).length]))};' +
'})()');
try {
  await browser.send('Page.navigate', { url: targetUrl });
  await wait(1300);
  await browser.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await browser.evaluate('document.getElementById("start").click()');
  await wait(1200);
  const baseline = await sample();

  // 최고 디테일 부하: dense LOD가 켜지지 않는 적 수에서 최대 구조물과 고단계 VFX를 계측한다.
  const detailLoad=await createLoad(budget.detailEnemyCount);
  assert(detailLoad.enemies === budget.detailEnemyCount, 'High-detail enemy load was not created.');
  assert(detailLoad.turrets >= budget.minStructures, 'High-detail structure load is too small: ' + detailLoad.turrets);
  await wait(700);
  const detailRenderMode=await browser.evaluate('({dense:RENDER_DENSE,dpr:DPR,backingWidth:c.width,backingHeight:c.height})');
  assert(!detailRenderMode.dense && detailRenderMode.dpr > budget.maxDenseDpr,
    'High-detail scene unexpectedly entered dense LOD: ' + JSON.stringify(detailRenderMode));
  const detailNormal=await sample();
  assert(detailNormal.fps >= budget.normal.minFps, 'Normal high-detail FPS failed: ' + detailNormal.fps.toFixed(1));
  assert(detailNormal.p95Ms <= budget.normal.maxP95FrameMs, 'Normal high-detail p95 failed: ' + detailNormal.p95Ms.toFixed(1));
  assert(detailNormal.over33Ratio <= budget.normal.maxOver33Ratio, 'Normal high-detail long-frame ratio failed.');
  await browser.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await wait(500);
  const detailCpu4x=await sample();
  assert(detailCpu4x.fps >= budget.cpu4x.minFps, 'CPU4x high-detail FPS failed: ' + detailCpu4x.fps.toFixed(1));
  assert(detailCpu4x.p95Ms <= budget.cpu4x.maxP95FrameMs, 'CPU4x high-detail p95 failed: ' + detailCpu4x.p95Ms.toFixed(1));
  assert(detailCpu4x.over50Ratio <= budget.cpu4x.maxOver50Ratio, 'CPU4x high-detail long-frame ratio failed.');

  await browser.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await wait(500);
  const load=await createLoad(budget.enemyCount);
  assert(load.enemies === budget.enemyCount, 'Performance enemy load was not created.');
  assert(load.turrets >= budget.minStructures, 'Performance structure load is too small: ' + load.turrets);
  await wait(700);
  const renderMode=await browser.evaluate('({dense:RENDER_DENSE,dpr:DPR,backingWidth:c.width,backingHeight:c.height})');
  assert(renderMode.dense && renderMode.dpr <= budget.maxDenseDpr,
    'Dense rendering contract did not activate: ' + JSON.stringify(renderMode));

  const normal = await sample();
  assert(normal.fps >= budget.normal.minFps, 'Normal max-load FPS failed: ' + normal.fps.toFixed(1));
  assert(normal.p95Ms <= budget.normal.maxP95FrameMs, 'Normal max-load p95 failed: ' + normal.p95Ms.toFixed(1));
  assert(normal.over33Ratio <= budget.normal.maxOver33Ratio, 'Normal long-frame ratio failed.');

  await browser.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await wait(500);
  const cpu4x = await sample();
  assert(cpu4x.fps >= budget.cpu4x.minFps, 'CPU4x FPS failed: ' + cpu4x.fps.toFixed(1));
  assert(cpu4x.p95Ms <= budget.cpu4x.maxP95FrameMs, 'CPU4x p95 failed: ' + cpu4x.p95Ms.toFixed(1));
  assert(cpu4x.over50Ratio <= budget.cpu4x.maxOver50Ratio, 'CPU4x long-frame ratio failed.');
  assert(browser.exceptions.length === 0, 'Runtime exceptions: ' + browser.exceptions.join(' | '));
  assert(browser.errorLogs.length === 0, 'Browser errors: ' + browser.errorLogs.join(' | '));

  const report={
    measuredAt:new Date().toISOString(),
    targetUrl,
    viewport:budget.viewport,
    budget,
    detail:{load:detailLoad,renderMode:detailRenderMode,normal:detailNormal,cpu4x:detailCpu4x},
    load,
    renderMode,
    baseline,
    normal,
    cpu4x
  };  const serialized=JSON.stringify(report,null,2);
  console.log(serialized);
  if(process.env.PERF_OUTPUT){
    await mkdir(dirname(process.env.PERF_OUTPUT),{recursive:true});
    await writeFile(process.env.PERF_OUTPUT,serialized+'\n','utf8');
  }
  console.log('WAVE_ARENA_PERF_OK');
} finally {
  await browser.close();
}
