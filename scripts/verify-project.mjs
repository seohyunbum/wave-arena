import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(join(root, relative), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await import('../src/build-meta.js');
const meta = globalThis.WA_BUILD_META;
const gates = JSON.parse(await read('quality-gates.json'));
const agents = await read('AGENTS.md');
const claude = await read('CLAUDE.md');
const index = await read('index.html');
const readme = await read('README.md');
const sw = await read('sw.js');

assert(meta && meta.buildId && meta.cacheVersion, 'Build metadata is incomplete.');
assert(agents === claude, 'AGENTS.md and CLAUDE.md drifted.');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(index), 'Inline script found in index.html.');
for (const source of ['src/build-meta.js', 'src/game/runtime.js', 'src/game/config.js', 'src/game/render.js', 'src/game.js', 'src/game/ui.js', 'src/platform/pwa.js']) {
  assert(index.includes('src="' + source + '"'), 'Script order is missing ' + source);
}
assert(readme.includes(meta.buildId), 'README build ID drifted from build metadata.');
assert(sw.includes('WA_BUILD_META.cacheVersion') && sw.includes('WA_BUILD_META.precache'),
  'Service worker is not using canonical build metadata.');
assert(gates.viewports.length === 4, 'Four canonical viewports are required.');
assert(gates.flows.includes('offline-navigation') && gates.flows.includes('save-restore'),
  'Critical flow gates are missing.');
assert(gates.performance.normal.minFps > gates.performance.cpu4x.minFps,
  'Performance budgets are not ordered by CPU profile.');

for (const asset of meta.precache) {
  if (asset === './') continue;
  const relative = asset.replace(/^\.\//, '');
  await access(join(root, relative), constants.R_OK).catch(() => {
    throw new Error('Precache asset does not exist: ' + relative);
  });
}

for (const required of ['docs/ARCHITECTURE.md', 'docs/QUALITY_GATES.md', 'THIRD_PARTY_ASSETS.md']) {
  await access(join(root, required), constants.R_OK);
}

console.log(JSON.stringify({
  buildId: meta.buildId,
  cacheVersion: meta.cacheVersion,
  precache: meta.precache.length,
  viewports: gates.viewports.map(viewport => viewport.name),
  flows: gates.flows
}, null, 2));
console.log('WAVE_ARENA_PROJECT_OK');
