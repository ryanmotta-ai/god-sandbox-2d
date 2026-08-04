/**
 * Phase K checks: the UI explains real arithmetic.
 *
 * The rule under test is item 45 — if a screen shows a number, that number has
 * to be computed by the simulation, not invented for display.
 */
import { createSocietyProfile, updateSociety, SOCIAL_FACTION_ORDER } from '../src/civ/Society';
import { demandCreatedBy, TECHNOLOGIES } from '../src/civ/TechTree';
import { GOODS, isGoodId } from '../src/civ/Goods';
import { BUILDINGS } from '../src/civ/Building';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('=== PHASE K: UI DATA CHECKS ===\n');

const baseCtx = {
  year: 50,
  government: 'monarchy' as const,
  economy: 'mercantile' as const,
  taxRate: 0.2,
  atWar: false,
  wars: 0,
  stability: 0.6,
  legitimacy: 0.6,
  prosperity: 0.6,
  foodSecurity: 0.7,
  tradeDependency: 0.3,
  externalThreat: 0.1,
  administrativeReach: 0.7,
  inequality: 0.3,
  industrialisation: 0.4,
  gdpPerCapita: 20,
  cityCount: 3,
  famineYears: 0,
  warWeariness: 0,
  foodPriceIndex: 1,
  unemployment: 0,
  labourShortage: 0,
  embargoes: 0,
  culture: {
    militarism: 0.5, expansionism: 0.5, tradition: 0.5, authority: 0.5, openness: 0.5,
    mercantilism: 0.5, innovation: 0.5, collectivism: 0.5, warTrauma: 0, diplomaticTrust: 0.5
  }
};

const settle = (ctx: typeof baseCtx) => {
  let p = createSocietyProfile('monarchy');
  for (let i = 0; i < 30; i++) p = updateSociety(p, ctx);
  return p;
};

// ---------- 1. Every faction can explain itself ----------
{
  const p = settle(baseCtx);
  const missing = SOCIAL_FACTION_ORDER.filter(id => !(p.factions[id].factors?.length));
  check('every faction reports the reasons behind its satisfaction', missing.length === 0,
    `sem fatores: ${missing.join(', ')}`);

  const workers = p.factions.workers.factors ?? [];
  check('the reasons are sorted by how much they matter',
    workers.every((f, i) => i === 0 || Math.abs(workers[i - 1].delta) >= Math.abs(f.delta)),
    workers.map(f => `${f.label}:${f.delta.toFixed(3)}`).join(' '));
}

// ---------- 2. The explanation matches the cause ----------
{
  const calm = settle(baseCtx);
  const hungry = settle({ ...baseCtx, foodPriceIndex: 2.4 });
  const jobless = settle({ ...baseCtx, unemployment: 0.28 });
  const blockaded = settle({ ...baseCtx, embargoes: 3 });

  const foodFactor = (hungry.factions.workers.factors ?? []).find(f => f.label.includes('comida'));
  check('dear bread shows up as a named reason for the workers', !!foodFactor && foodFactor.delta < 0,
    `${foodFactor?.delta ?? 'ausente'}`);

  const jobFactor = (jobless.factions.workers.factors ?? []).find(f => f.label.includes('Desemprego'));
  check('unemployment shows up as a named reason', !!jobFactor && jobFactor.delta < 0,
    `${jobFactor?.delta ?? 'ausente'}`);

  const embargoFactor = (blockaded.factions.merchants.factors ?? []).find(f => f.label.includes('Embargo'));
  check('an embargo shows up as a named reason for the merchants', !!embargoFactor && embargoFactor.delta < 0,
    `${embargoFactor?.delta ?? 'ausente'}`);

  // The countryside profits from expensive grain — the sign must be positive.
  const peasantFood = (hungry.factions.peasants.factors ?? []).find(f => f.label.includes('grão'));
  check('the countryside is shown gaining from expensive grain', !!peasantFood && peasantFood.delta > 0,
    `${peasantFood?.delta ?? 'ausente'}`);

  check('a calm realm shows no food-price pressure at all',
    !(calm.factions.workers.factors ?? []).some(f => f.label.includes('comida')));
}

// ---------- 3. The size of the reason tracks the size of the cause ----------
{
  const mild = settle({ ...baseCtx, unemployment: 0.1 });
  const severe = settle({ ...baseCtx, unemployment: 0.3 });
  const mildDelta = (mild.factions.workers.factors ?? []).find(f => f.label.includes('Desemprego'))?.delta ?? 0;
  const severeDelta = (severe.factions.workers.factors ?? []).find(f => f.label.includes('Desemprego'))?.delta ?? 0;
  check('worse unemployment produces a larger stated penalty', severeDelta < mildDelta,
    `${mildDelta.toFixed(3)} vs ${severeDelta.toFixed(3)}`);
}

// ---------- 4. Tech consequences come from the same table the economy uses ----------
{
  const steam = demandCreatedBy('steam_power');
  check('steam power declares the demand it creates', steam.length > 0, `${steam.length}`);
  check('coal is the headline consequence of steam power', steam[0]?.good === 'coal', `${steam[0]?.good}`);
  check('the consequence list is sorted strongest first',
    steam.every((d, i) => i === 0 || steam[i - 1].weight >= d.weight));

  check('a purely political tech creates no material demand', demandCreatedBy('philosophy').length === 0);
  check('every declared good is a real good', steam.every(d => !!GOODS[d.good]));
}

// ---------- 5. Every pressure can be traced to its evidence ----------
{
  const strained = settle({ ...baseCtx, foodPriceIndex: 2.4, unemployment: 0.28, embargoes: 3 });

  const workerFood = (strained.factions.workers.factors ?? []).find(f => f.label.includes('comida'));
  check('the food-price pressure points at food itself',
    workerFood?.source?.kind === 'good' && workerFood.source.good === 'food',
    JSON.stringify(workerFood?.source));

  const jobs = (strained.factions.workers.factors ?? []).find(f => f.label.includes('Desemprego'));
  check('the unemployment pressure points at the jobs data', jobs?.source?.kind === 'jobs',
    JSON.stringify(jobs?.source));

  const embargo = (strained.factions.merchants.factors ?? []).find(f => f.label.includes('Embargo'));
  check('the embargo pressure points at trade', embargo?.source?.kind === 'trade',
    JSON.stringify(embargo?.source));

  // A source naming a good the game does not have would send the player to a
  // blank screen, which is worse than offering no link at all.
  const allFactors = SOCIAL_FACTION_ORDER.flatMap(id => strained.factions[id].factors ?? []);
  const bogus = allFactors.filter(f => f.source?.kind === 'good' && !isGoodId(f.source.good));
  check('every good a pressure points at is a real good', bogus.length === 0,
    bogus.map(f => f.label).join(', '));

  check('pressures with no evidence to show carry no source',
    allFactors.some(f => !f.source),
    'todo fator declarou uma fonte, o que provavelmente é engano');
}

// ---------- 6. Unlock lists point at real buildings ----------
{
  let bad = 0;
  for (const tech of Object.values(TECHNOLOGIES)) {
    for (const b of tech.unlocks.buildings ?? []) {
      if (!BUILDINGS[b]) bad++;
    }
  }
  check('every technology unlocks buildings that actually exist', bad === 0, `${bad} inválidos`);
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
