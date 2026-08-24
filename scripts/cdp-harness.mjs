import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const wait = ms => new Promise(done => setTimeout(done, ms));

async function findBrowser() {
  const candidates = [
    process.env.BROWSER_BIN,
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch {}
  }
  throw new Error('Chromium browser not found. Set BROWSER_BIN.');
}

export async function launchBrowser(targetUrl, initialViewport = { width: 844, height: 390, dpr: 1.5 }) {
  const browserBin = await findBrowser();
  const profile = await mkdtemp(join(tmpdir(), 'wave-arena-browser-'));
  const browser = spawn(browserBin, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--remote-allow-origins=*', '--user-data-dir=' + profile,
    '--window-size=' + initialViewport.width + ',' + initialViewport.height,
    targetUrl
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let browserError = '';
  browser.stderr.on('data', chunk => { browserError = (browserError + chunk).slice(-4000); });

  let port;
  let targets;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (!port) {
        const activePort = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
        port = Number(activePort.split(/\r?\n/, 1)[0]);
      }
      if (port) {
        const response = await fetch('http://127.0.0.1:' + port + '/json/list');
        if (response.ok) {
          targets = await response.json();
          if (targets.some(target => target.type === 'page')) break;
        }
      }
    } catch {}
    await wait(100);
  }

  const page = targets && targets.find(target => target.type === 'page');
  if (!page) {
    browser.kill();
    throw new Error('Browser DevTools target did not start. ' + browserError.trim());
  }

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((open, fail) => {
    socket.addEventListener('open', open, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  const errorLogs = [];
  const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectSend(new Error('CDP timeout: ' + method));
    }, 15000);
    pending.set(id, { resolveSend, rejectSend, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.rejectSend(new Error(message.error.message));
      else task.resolveSend(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errorLogs.push(message.params.entry.text);
    }
  });

  const evaluate = async (expression, awaitPromise = false) => {
    const response = await send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue: true, userGesture: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result.value;
  };

  const setViewport = viewport => send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: viewport.dpr > 1,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Performance.enable');
  await setViewport(initialViewport);

  const close = async () => {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
        await wait(400);
      } catch {}
    }
    for (const task of pending.values()) clearTimeout(task.timer);
    socket.close();
    browser.kill();
    await Promise.race([new Promise(done => browser.once('exit', done)), wait(1000)]);
    const safeProfile = resolve(profile);
    const safeTemp = resolve(tmpdir());
    if (safeProfile.startsWith(safeTemp + '\\') || safeProfile.startsWith(safeTemp + '/')) {
      await rm(safeProfile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
    }
  };

  return {
    browserBin, send, evaluate, setViewport, exceptions, errorLogs, close
  };
}

export function metricMap(result) {
  return Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));
}
