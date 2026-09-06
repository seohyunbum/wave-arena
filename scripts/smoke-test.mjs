import { readFile } from 'node:fs/promises';
import { launchBrowser, wait } from './cdp-harness.mjs';

const gates = JSON.parse(await readFile(new URL('../quality-gates.json', import.meta.url), 'utf8'));
const targetUrl = new URL(process.argv[2] || 'http://127.0.0.1:4173/').href;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pwaWaitMs=Math.max(5000,Number(process.env.PWA_WAIT_MS)||20000);

await fetch(targetUrl, { cache: 'no-store' }).then(response => {
  if (!response.ok) throw new Error('Game server returned ' + response.status);
});

const browser = await launchBrowser(targetUrl, gates.viewports[2]);
console.log('[smoke] browser', browser.browserBin);
const watchdog = setTimeout(() => {
  console.error('SMOKE_TIMEOUT after 60 seconds');
  process.exitCode = 2;
}, 60000);

try {
  await browser.send('Page.navigate', { url: targetUrl });
  await wait(1300);

  const viewportResults = [];
  for (const viewport of gates.viewports) {
    await browser.setViewport(viewport);
    await wait(120);
    const result = await browser.evaluate('(() => {' +
      'resize();' +
      'const controls=' + JSON.stringify(gates.requiredControls) + '.map(id=>{' +
        'const el=document.getElementById(id); const r=el&&el.getBoundingClientRect();' +
        'return {id,display:!!el&&getComputedStyle(el).display!=="none",width:r?r.width:0,height:r?r.height:0};' +
      '});' +
      'return {canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight},controls};' +
    '})()');
    assert(result.canvas.width > 0 && result.canvas.height > 0, viewport.name + ': canvas backing store missing.');
    assert(result.canvas.cssWidth >= viewport.width - 2, viewport.name + ': canvas width mismatch.');
    assert(result.canvas.cssHeight > 250, viewport.name + ': canvas height too small.');
    assert(result.controls.every(control => control.display && control.width > 0 && control.height > 0),
      viewport.name + ': a required control is not rendered.');
    viewportResults.push({ name: viewport.name, canvas: result.canvas });
  }

  await browser.setViewport(gates.viewports[2]);
  await wait(150);
  const initial = await browser.evaluate('({' +
    'build:BUILD_ID,meta:WA_BUILD_META,phase:G.phase,reduce:REDUCE,' +
    'canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}' +
  '})');

  const started = await browser.evaluate('(() => {' +
    'document.getElementById("start").click(); return {phase:G.phase,time:G.time};' +
  '})()');
  await wait(2200);
  const running = await browser.evaluate('({phase:G.phase,time:G.time,enemies:G.enemies.length,allies:G.allies.length})');

  const shop = await browser.evaluate('(() => {' +
    'document.getElementById("shopBtn").click();' +
    'const opened=G.shopOpen&&getComputedStyle(document.getElementById("shop")).display!=="none";' +
    'document.getElementById("shopClose").click();' +
    'return {opened,closed:!G.shopOpen&&getComputedStyle(document.getElementById("shop")).display==="none"};' +
  '})()');

  const rotation = await browser.evaluate('(() => {' +
    'const before=CAM.rot; document.getElementById("rotBtn").click(); return {before,after:CAM.rot};' +
  '})()');

  const audio = await browser.evaluate('(() => {' +
    'document.getElementById("audioBtn").click();' +
    'return {stored:localStorage.getItem("wavearena_muted_v1"),label:document.getElementById("audioBtn").getAttribute("aria-label")};' +
  '})()');

  const gameplay = await browser.evaluate('(() => {' +
    'G.phase="paused"; G.gold=1e12; G.turrets.length=0;' +
    'buyTurret(0); buyTurret(0);' +
    'const before=G.turrets.length,first=G.turrets[0],second=G.turrets[1];' +
    'const oldX=first.x,oldY=first.y; const moved=moveTurret(first,oldX+120,oldY+80);' +
    'const merged=mergeTurrets(first,second);' +
    'G.time=42.5; G.gold=123456; const saved=saveGame();' +
    'G.time=1; G.gold=1; const restored=restore(loadSaved());' +
    'const restoredState={time:G.time,gold:G.gold,turrets:G.turrets.length,tier:G.turrets[0]&&G.turrets[0].tier};' +
    'G.phase="running"; G.stopCd=0; spawnEnemy(); stopGame(); updateHUD(true);' +
    'return {before,moved,merged,saved,restored,restoredState,stopped:G.phase==="paused"&&G.enemies.length===0&&G.stopCd===CFG.stopCooldown};' +
  '})()');

  const visuals = await browser.evaluate('visualContractSnapshot()');

  const assets = await browser.evaluate('Promise.all(Object.values(SFX_FILES).map(async url=>{' +
    'const response=await fetch(url); return {url,status:response.status,type:response.headers.get("content-type")};' +
  '}))', true);

  let pwa = await browser.evaluate('Promise.race([' +
    'navigator.serviceWorker.ready.then(async registration=>{' +
      'await new Promise(done=>setTimeout(done,300));' +
      'const cache=await caches.open(WA_BUILD_META.cacheVersion); const requests=await cache.keys();' +
      'return {active:Boolean(registration.active),controller:Boolean(navigator.serviceWorker.controller),' +
        'script:registration.active&&registration.active.scriptURL||"",diagnostic:globalThis.WA_SW_DIAGNOSTIC||null,cache:WA_BUILD_META.cacheVersion,' +
        'cached:requests.map(request=>request.url),expected:WA_BUILD_META.precache.map(path=>new URL(path,location.href).href)};' +
    '}),' +
    'new Promise(done=>setTimeout(()=>done({active:false,controller:false,cached:[],expected:[]}),'+pwaWaitMs+'))' +
  '])', true);

  if (!pwa.controller) {
    await browser.send('Page.reload', { ignoreCache: true });
    await wait(1000);
    pwa = await browser.evaluate('Promise.race([' +
      'navigator.serviceWorker.ready.then(async registration=>{' +
        'const cache=await caches.open(WA_BUILD_META.cacheVersion); const requests=await cache.keys();' +
        'return {active:Boolean(registration.active),controller:Boolean(navigator.serviceWorker.controller),' +
          'script:registration.active&&registration.active.scriptURL||"",diagnostic:globalThis.WA_SW_DIAGNOSTIC||null,cache:WA_BUILD_META.cacheVersion,' +
          'cached:requests.map(request=>request.url),expected:WA_BUILD_META.precache.map(path=>new URL(path,location.href).href)};' +
      '}),' +
      'new Promise(done=>setTimeout(()=>done({active:false,controller:false,cached:[],expected:[]}),'+pwaWaitMs+'))' +
    '])', true);
  }

  assert(initial.build === initial.meta.buildId, 'Runtime build differs from canonical metadata.');
  assert(initial.phase === 'idle', 'Initial phase is ' + initial.phase);
  assert(started.phase === 'running' && running.phase === 'running', 'Wave did not enter running state.');
  assert(running.time > 1 && running.enemies > 0, 'Wave did not advance or spawn enemies.');
  assert(shop.opened && shop.closed, 'Shop open/close flow failed.');
  assert(Math.abs(rotation.after - rotation.before - Math.PI / 2) < 0.001, 'Camera did not rotate 90 degrees.');
  assert(audio.stored === '1' && audio.label === '효과음 켜기', 'Mute persistence or label failed.');
  assert(gameplay.before === 2 && gameplay.moved && gameplay.merged, 'Turret placement or merge failed.');
  assert(gameplay.saved && gameplay.restored && gameplay.restoredState.time === 42.5 &&
    gameplay.restoredState.gold === 123456 && gameplay.restoredState.turrets === 1 &&
    gameplay.restoredState.tier === 1, 'Save/restore contract failed.');
  assert(gameplay.stopped, 'Stop flow failed.');
  assert(visuals.version === '2.0.0', 'Visual system version is missing.');
  const unique = values => new Set(values).size === values.length;
  assert(visuals.ally.length === gates.visuals.allyRanks && unique(visuals.ally),
    'Ally evolution stages are not distinct.');
  assert(visuals.base.length === gates.visuals.baseRanks && unique(visuals.base),
    'Every base upgrade must have a unique visual signature.');
  assert(visuals.turret.length === gates.visuals.turretRanks && unique(visuals.turret),
    'Every standard turret tier must have a unique visual signature.');
  assert(unique(visuals.rapid) && unique(visuals.laser) && unique(visuals.launcher),
    'A specialist structure reuses an upgrade signature.');
  assert(visuals.projectileShapes.length === gates.visuals.projectileArchetypes && unique(visuals.projectileShapes),
    'Projectile archetypes do not visibly evolve across grades.');
  assert(visuals.maxProjectileLayers <= gates.visuals.maxProjectileLayers,
    'Projectile layer budget exceeds the mobile performance contract.');
  assert(assets.length === 6 && assets.every(asset => asset.status === 200), 'A CC0 audio file failed.');
  assert(pwa.active && pwa.controller && pwa.script.endsWith('/sw.js'),
    'Service worker did not control the page: ' + JSON.stringify(pwa.diagnostic));
  assert(pwa.diagnostic?.status === 'ready',
    'Service worker registration diagnostic is not ready: ' + JSON.stringify(pwa.diagnostic));
  assert(pwa.cache === initial.meta.cacheVersion, 'Service worker cache version drifted.');
  assert(pwa.expected.every(url => pwa.cached.includes(url)), 'A canonical precache asset is missing.');

  await browser.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  await browser.send('Page.navigate', { url: targetUrl });
  await wait(1200);
  let offline;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      offline = await browser.evaluate('({build:BUILD_ID,meta:WA_BUILD_META.buildId,controller:Boolean(navigator.serviceWorker.controller)})');
      break;
    } catch { await wait(150); }
  }
  await browser.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
  });
  assert(offline && offline.build === initial.build && offline.meta === initial.build && offline.controller,
    'Offline navigation did not boot the same controlled build.');

  await browser.send('Emulation.setEmulatedMedia', {
    media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await browser.send('Page.reload', { ignoreCache: true });
  await wait(1000);
  const reduced = await browser.evaluate('(() => {' +
    'G.fx.length=0; burst(baseNode().x,baseNode().y,"#fff",10);' +
    'return {reduce:REDUCE,particles:G.fx.length};' +
  '})()');
  assert(reduced.reduce && reduced.particles <= 3, 'Reduced-motion particle gate failed.');

  // ---- 프레임 루프 생존 -----------------------------------------------------
  // 배포본 실측 결함(2026-09-06): 창 높이가 0이 되면 fitCamera 가 음수 배율을 내고
  // ctx.ellipse 가 IndexSizeError 를 던졌다. frame() 이 마지막 줄에서 rAF 를 예약하던 탓에
  // 그 한 번으로 루프가 영구히 죽어 검은 화면만 남았다. 둘 다 실측으로 잠근다.
  const MUTATION_MARK = 'WA_SMOKE_FRAME_MUTATION';

  // (a) 어떤 창 크기에서도 배율은 양수다 — 패딩(32px)보다 작은 24x24 로 직접 줄여서 잰다
  await browser.setViewport({ name: 'degenerate', width: 24, height: 24, dpr: 1 });
  await wait(250);
  const tinyView = await browser.evaluate('(() => { resize(); return {scale:CAM.scale,w:c.clientWidth,h:c.clientHeight}; })()');
  await browser.setViewport(gates.viewports[0]);
  await wait(250);
  const wideView = await browser.evaluate('(() => { resize(); return {scale:CAM.scale}; })()');

  // (b) 한 프레임이 예외를 던져도 다음 프레임이 계속 돈다 — 실제로 한 번 던져서 확인한다
  const resilience = await browser.evaluate('(() => {' +
    'const proto=CanvasRenderingContext2D.prototype, real=proto.ellipse; let fired=false;' +
    'proto.ellipse=function(){ if(!fired){ fired=true; throw new Error("' + MUTATION_MARK + '"); }' +
      'return real.apply(this,arguments); };' +
    'const errorsBefore=FRAME_ERRORS, animBefore=G.anim;' +
    'return new Promise(done=>setTimeout(()=>{ proto.ellipse=real;' +
      'done({fired,errors:FRAME_ERRORS-errorsBefore,advanced:G.anim>animBefore,drawing:CAM.scale>0});' +
    '},500));' +
  '})()', true);

  assert(tinyView.scale > 0, '창을 24x24 로 줄이자 카메라 배율이 양수가 아니다: ' + JSON.stringify(tinyView));
  assert(wideView.scale > 0.05, '창을 되돌린 뒤 배율이 복구되지 않았다: ' + JSON.stringify(wideView));
  assert(resilience.fired, '변이(일부러 던진 예외)가 실행되지 않아 이 검사는 아무것도 증명하지 못한다.');
  assert(resilience.errors === 1 && resilience.advanced && resilience.drawing,
    '한 프레임의 예외가 루프를 죽였다: ' + JSON.stringify(resilience));

  // 위 (b)는 일부러 던진 예외다. 표식이 붙은 것만 걷어내고 나머지는 그대로 판정한다.
  const dropMutation = list => {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].includes(MUTATION_MARK)) list.splice(i, 1);
  };
  dropMutation(browser.exceptions);
  dropMutation(browser.errorLogs);

  assert(browser.exceptions.length === 0, 'Runtime exceptions: ' + browser.exceptions.join(' | '));
  assert(browser.errorLogs.length === 0, 'Browser errors: ' + browser.errorLogs.join(' | '));

  console.log(JSON.stringify({
    build: initial.build,
    viewportResults,
    running,
    shop,
    rotation,
    audio,
    gameplay,
    visuals,
    pwa: { active: pwa.active, controller: pwa.controller, cached: pwa.cached.length, diagnostic: pwa.diagnostic },
    offline,
    reduced,
    tinyView,
    resilience,
    exceptions: browser.exceptions,
    errorLogs: browser.errorLogs
  }, null, 2));
  console.log('WAVE_ARENA_SMOKE_OK');
} finally {
  clearTimeout(watchdog);
  await browser.close();
}
