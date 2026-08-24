import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const inBand = (value, band) => value >= band[0] && value <= band[1];

async function loadConfig() {
  const filename = join(root, 'src/game/config.js');
  const source = await readFile(filename, 'utf8');
  const sandbox = {};
  runInNewContext(source + '\n;globalThis.__WAVE_ARENA_CFG__ = CFG;', sandbox, { filename });
  return sandbox.__WAVE_ARENA_CFG__;
}

function enemyAt(cfg, stage) {
  const level = stage - 1;
  const hp = Math.round(cfg.eHp0 * (1 + cfg.eHpScale * level) * Math.pow(cfg.eHpGeo, level));
  const damage = cfg.eDmg0 * (1 + cfg.eDmgScale * level) * Math.pow(cfg.eDmgGeo, level);
  const speed = cfg.eSpd0 * Math.min(cfg.eSpdCap, 1 + cfg.eSpdScale * level);
  const spawnSeconds = Math.max(cfg.spawnFloor, cfg.spawnBase - level * cfg.spawnStep);
  const killGold = Math.round((cfg.goldKillBase + cfg.goldKillPerLv * stage) * Math.pow(cfg.goldKillGeo, level));
  return {
    stage,
    hp,
    damage: round(damage, 1),
    speed: round(speed, 1),
    spawnSeconds: round(spawnSeconds, 2),
    hpPressure: round(hp / spawnSeconds, 1),
    killGold,
    goldPerHp: round(killGold / hp),
    bossHp: stage % cfg.bossEvery === 0 ? hp * cfg.bossHpMult : null
  };
}

const dps = tier => tier.dmg / tier.fire;
const adjacentGrowth = (tiers, value) => tiers.slice(1).map((tier, index) => value(tier) / value(tiers[index]));

export async function evaluateBalance(gatesOverride) {
  const cfg = await loadConfig();
  const gates = gatesOverride || JSON.parse(await readFile(join(root, 'quality-gates.json'), 'utf8'));
  const balance = gates.balance;
  if (!balance || !balance.bands || !Array.isArray(balance.sampleStages)) {
    throw new Error('Balance quality gate is missing.');
  }

  const stages = balance.sampleStages.map(stage => enemyAt(cfg, stage));
  const normalGrowth = adjacentGrowth(cfg.turretTiers, dps);
  const rapidGrowth = adjacentGrowth(cfg.rapidTiers, dps);
  const laserValueRetention = adjacentGrowth(cfg.laserTiers, tier => tier.dps)
    .map((growth, index) => growth / (cfg.laserTiers[index + 1].cost / cfg.laserTiers[index].cost));
  const startTeamDps = cfg.allyStart * cfg.dmg0 / cfg.fire0;
  const startPressure = cfg.eHp0 / cfg.spawnBase;
  const normalEntryValue = dps(cfg.turretTiers[0]) / cfg.turretCost0;
  const rapidEntryValue = dps(cfg.rapidTiers[0]) / cfg.rapidCost0;
  const strongestArmor = cfg.armors[cfg.armors.length - 1].def;
  const maxArmorDamageCut = Math.min(cfg.defMaxCut, strongestArmor / (strongestArmor + cfg.defK));

  const metrics = {
    startTeamDpsToSpawnPressure: startTeamDps / startPressure,
    bossHpMultiplier: cfg.bossHpMult,
    normalTurretDpsGrowth: normalGrowth,
    rapidTurretDpsGrowth: rapidGrowth,
    rapidEntryValueAdvantage: rapidEntryValue / normalEntryValue,
    laserValueRetention,
    maxArmorDamageCut
  };

  const failures = [];
  const check = (name, value) => {
    const band = balance.bands[name];
    if (!band) failures.push(name + ': band is missing');
    else if (!inBand(value, band)) failures.push(name + ': ' + round(value) + ' is outside [' + band.join(', ') + ']');
  };
  const checkSeries = (name, values) => values.forEach((value, index) => {
    const band = balance.bands[name];
    if (!band || !inBand(value, band)) {
      failures.push(name + '[' + index + ']: ' + round(value) + ' is outside [' + (band || []).join(', ') + ']');
    }
  });

  check('startTeamDpsToSpawnPressure', metrics.startTeamDpsToSpawnPressure);
  check('bossHpMultiplier', metrics.bossHpMultiplier);
  check('rapidEntryValueAdvantage', metrics.rapidEntryValueAdvantage);
  check('maxArmorDamageCut', metrics.maxArmorDamageCut);
  checkSeries('normalTurretDpsGrowth', metrics.normalTurretDpsGrowth);
  checkSeries('rapidTurretDpsGrowth', metrics.rapidTurretDpsGrowth);
  checkSeries('laserValueRetention', metrics.laserValueRetention);
  for (const stage of stages) {
    if (!inBand(stage.goldPerHp, balance.bands.killGoldPerEnemyHp)) {
      failures.push('killGoldPerEnemyHp(stage ' + stage.stage + '): ' + stage.goldPerHp
        + ' is outside [' + balance.bands.killGoldPerEnemyHp.join(', ') + ']');
    }
  }

  return { cfg, stages, metrics, failures };
}

function report(result) {
  console.table(result.stages.map(stage => ({
    stage: stage.stage,
    enemyHp: stage.hp,
    damage: stage.damage,
    speed: stage.speed,
    spawnSec: stage.spawnSeconds,
    hpPerSec: stage.hpPressure,
    killGold: stage.killGold,
    goldPerHp: stage.goldPerHp,
    bossHp: stage.bossHp || '-'
  })));
  console.log(JSON.stringify({
    startTeamDpsToSpawnPressure: round(result.metrics.startTeamDpsToSpawnPressure),
    bossHpMultiplier: result.metrics.bossHpMultiplier,
    normalTurretDpsGrowth: result.metrics.normalTurretDpsGrowth.map(value => round(value)),
    rapidTurretDpsGrowth: result.metrics.rapidTurretDpsGrowth.map(value => round(value)),
    rapidEntryValueAdvantage: round(result.metrics.rapidEntryValueAdvantage),
    laserValueRetention: result.metrics.laserValueRetention.map(value => round(value)),
    maxArmorDamageCut: round(result.metrics.maxArmorDamageCut)
  }, null, 2));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await evaluateBalance();
  report(result);
  if (result.failures.length) {
    throw new Error('Balance baseline failed:\n- ' + result.failures.join('\n- '));
  }
  console.log('WAVE_ARENA_BALANCE_OK');
}
