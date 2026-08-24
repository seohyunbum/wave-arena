import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const targetUrl = new URL(process.argv[2] || 'http://127.0.0.1:4173/').href;
const expectedBuild = '2026.08.24-visual-overhaul';
const wait = ms => new Promise(done => setTimeout(done, ms));

async function findBrowser(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  throw new Error('Chromium browser not found. Set BROWSER_BIN.');
}

const browserBin = await findBrowser([
  process.env.BROWSER_BIN,
  process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]);

await fetch(targetUrl, { cache: 'no-store' }).then(response => {
  if (!response.ok) throw new Error(`Game server returned ${response.status}`);
});

const port = 9333 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), 'wave-arena-smoke-'));
const browser = spawn(browserBin, [
  '--headless=new', '--disable-gpu-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=844,390', targetUrl,
], { stdio: 'ignore' });

let socket;
const pending = new Map(), exceptions = [], errorLogs = [];
let nextId = 0;
const watchdog = setTimeout(() => {
  console.error('SMOKE_TIMEOUT after 45 seconds');
  try {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
    }
  } catch {}
  browser.kill();
  process.exit(2);
}, 45000);
const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
  const id = ++nextId;
  const timer = setTimeout(() => {
    pending.delete(id);
    rejectSend(new Error(`CDP timeout: ${method}`));
  }, 10000);
  pending.set(id, { resolveSend, rejectSend, timer });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, awaitPromise = false) => {
  const response = await send('Runtime.evaluate', {
    expression, awaitPromise, returnByValue: true, userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result.value;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  let targets;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        targets = await response.json();
        if (targets.some(target => target.type === 'page')) break;
      }
    } catch {}
    await wait(100);
  }
  const page = targets?.find(target => target.type === 'page');
  if (!page) throw new Error('Browser DevTools target did not start.');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open, fail) => {
    socket.addEventListener('open', open, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      message.error ? task.rejectSend(new Error(message.error.message)) : task.resolveSend(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.text);
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errorLogs.push(message.params.entry.text);
    }
  });

  console.log('[smoke] devtools-connected');
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 844, height: 390, deviceScaleFactor: 1.5, mobile: true,
    screenWidth: 844, screenHeight: 390,
  });
  await send('Page.navigate', { url: targetUrl });
  await wait(1300);
  console.log('[smoke] page-ready');

  const initial = await evaluate(`({
    build: BUILD_ID, phase: G.phase,
    canvas: { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight },
    audioFiles: Object.values(SFX_FILES)
  })`);
  const started = await evaluate(`(() => {
    document.getElementById('start').click();
    return { phase: G.phase, time: G.time };
  })()`);
  await wait(2200);
  const running = await evaluate(`({ phase: G.phase, time: G.time, enemies: G.enemies.length, allies: G.allies.length })`);
  console.log('[smoke] wave-running');
  const shop = await evaluate(`(() => {
    document.getElementById('shopBtn').click();
    const opened = G.shopOpen && getComputedStyle(document.getElementById('shop')).display !== 'none';
    document.getElementById('shopClose').click();
    return { opened, closed: !G.shopOpen && getComputedStyle(document.getElementById('shop')).display === 'none' };
  })()`);
  const rotation = await evaluate(`(() => {
    const before = CAM.rot; document.getElementById('rotBtn').click();
    return { before, after: CAM.rot };
  })()`);
  const audio = await evaluate(`(() => {
    document.getElementById('audioBtn').click();
    return {
      stored: localStorage.getItem('wavearena_muted_v1'),
      label: document.getElementById('audioBtn').getAttribute('aria-label')
    };
  })()`);
  const assets = await evaluate(`Promise.all(Object.values(SFX_FILES).map(async url => {
    const response = await fetch(url);
    return { url, status: response.status, type: response.headers.get('content-type') };
  }))`, true);
  const pwa = await evaluate(`Promise.race([
    navigator.serviceWorker.ready.then(async registration => {
      await new Promise(done => setTimeout(done, 300));
      return {
        active: Boolean(registration.active),
        script: registration.active?.scriptURL || '',
        caches: await caches.keys()
      };
    }),
    new Promise(done => setTimeout(() => done({ active: false, script: '', caches: [] }), 5000))
  ])`, true);
  console.log('[smoke] interactions-and-pwa-ready');

  assert(initial.build === expectedBuild, `Unexpected build: ${initial.build}`);
  assert(initial.phase === 'idle', `Initial phase is ${initial.phase}`);
  assert(initial.canvas.width > 0 && initial.canvas.height > 0, 'Canvas has no backing resolution.');
  assert(initial.canvas.cssWidth >= 800 && initial.canvas.cssHeight >= 300,
    `Mobile canvas is undersized: ${initial.canvas.cssWidth}x${initial.canvas.cssHeight}`);
  assert(started.phase === 'running' && running.phase === 'running', 'Wave did not enter running state.');
  assert(running.time > 1 && running.enemies > 0, 'Wave did not advance or spawn enemies.');
  assert(shop.opened && shop.closed, 'Shop open/close flow failed.');
  assert(Math.abs(rotation.after - rotation.before - Math.PI / 2) < 0.001, 'Camera did not rotate 90 degrees.');
  assert(audio.stored === '1' && audio.label === '효과음 켜기', 'Mute persistence or label failed.');
  assert(assets.length === 6 && assets.every(asset => asset.status === 200), 'A CC0 audio file failed.');
  assert(pwa.active && pwa.script.endsWith('/sw.js'), 'Service worker did not activate.');
  assert(pwa.caches.includes('wave-arena-v3-visual-20260824'), 'Visual build cache was not created.');
  assert(exceptions.length === 0, `Runtime exceptions: ${exceptions.join(' | ')}`);
  assert(errorLogs.length === 0, `Browser errors: ${errorLogs.join(' | ')}`);

  console.log(JSON.stringify({ initial, running, shop, rotation, audio, assets, pwa, exceptions, errorLogs }, null, 2));
  console.log('WAVE_ARENA_SMOKE_OK');
} finally {
  clearTimeout(watchdog);
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ id: 999998, method: 'Browser.close' }));
      await wait(500);
    } catch {}
  }
  for (const task of pending.values()) {
    clearTimeout(task.timer);
    task.rejectSend(new Error('Browser test closed.'));
  }
  socket?.close();
  browser.kill();
  await Promise.race([
    new Promise(done => browser.once('exit', done)),
    wait(1000),
  ]);
  const safeProfile = resolve(profile), safeTemp = resolve(tmpdir());
  if (safeProfile.startsWith(safeTemp + '\\') || safeProfile.startsWith(safeTemp + '/')) {
    await rm(safeProfile, {
      recursive: true, force: true, maxRetries: 8, retryDelay: 150,
    }).catch(error => console.warn('Temporary browser profile cleanup deferred:', error.code));
  }
}
