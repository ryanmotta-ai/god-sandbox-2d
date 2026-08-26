/**
 * The invariant that makes continuous civilisation safe.
 *
 * Breaking the seasonal pulse into staggered visits only preserves the world if
 * each settlement is still charged for exactly the time that passed. If the
 * charges over a year sum to less than one year, everything quietly starves; if
 * they sum to more, everything quietly inflates. Neither would throw — the world
 * would just be wrong — so it is worth a test of its own.
 *
 * The rotations over the living are the same bargain: a citizen must still get
 * one day's hunger per day and one life pass per season, however the visits are
 * dealt out.
 */
import { TileMap } from '../src/world/TileMap';
import { TERRAINS } from '../src/world/Biomes';
import { SimulationEngine } from '../src/ai/EntityAI';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';
import { ParticleManager } from '../src/renderer/Particles';
import { TICKS_PER_YEAR, TICKS_PER_DAY, TICKS_PER_SEASON, DAYS_PER_YEAR, SEASONS_PER_YEAR } from '../src/core/Clock';
import assert from 'node:assert/strict';

rng.setSeed(31337);
const tileMap = new TileMap(64, 64, 'single_continent', 20260826);
const sim = new SimulationEngine();

const land: Array<{ x: number; y: number }> = [];
for (let x = 3; x < tileMap.width - 3; x++) for (let y = 3; y < tileMap.height - 3; y++) {
  const t = tileMap.getTile(x, y)!;
  if (!TERRAINS[t.type].isWater && TERRAINS[t.type].isWalkable) land.push({ x, y });
}
let pick = 0;
for (let r = 0; r < 3; r++) {
  const kid = `k${r}`;
  let capital = '';
  for (let c = 0; c < 3; c++) {
    const p = land[(pick++ * 7919) % land.length];
    const city = new City(`c${r}_${c}`, `City${r}${c}`, SpeciesType.HUMAN, p.x, p.y, 'Founder', 1);
    city.kingdomId = kid;
    city.stock.add('food', 400); city.stock.add('wood', 200); city.stock.add('stone', 150);
    sim.cities.set(city.id, city);
    if (!capital) capital = city.id;
    for (let i = 0; i < 12; i++) {
      // spawnEntity already files the citizen in sim.entities — pushing again
      // puts them in the world twice, and every per-entity pass then visits
      // them twice.
      const e = sim.spawnEntity(SpeciesType.HUMAN, city.x, city.y, tileMap);
      e.cityId = city.id; e.kingdomId = kid; e.profession = 'none';
    }
  }
  const k = new Kingdom(kid, `Realm ${r}`, SpeciesType.HUMAN, '#888888', capital, 1);
  for (let c = 0; c < 3; c++) k.cityIds.add(`c${r}_${c}`);
  sim.kingdoms.set(kid, k);
}
sim.citySpatialHash.rebuild(sim.cities.values());

// ---- Spy on what each settlement and realm is actually charged ----
// Keyed by subject, because a colony founded in month nine must be charged for
// three months, not twelve — averaging over it would hide the real invariant.
const charged = new Map<string, Map<string, { visits: number; total: number }>>();
const proto = CivilizationEngine.prototype as any;
for (const method of ['tickSettlement', 'collectTaxes']) {
  const original = proto[method];
  proto[method] = function (subject: { id: string }, world: { seasonFraction?: number }, ...rest: any[]) {
    let byId = charged.get(method);
    if (!byId) { byId = new Map(); charged.set(method, byId); }
    const row = byId.get(subject.id) ?? { visits: 0, total: 0 };
    row.visits++;
    row.total += world.seasonFraction ?? 0;
    byId.set(subject.id, row);
    return original.call(this, subject, world, ...rest);
  };
}

// ---- Spy on the rotations over the living ----
const simProto = SimulationEngine.prototype as any;
const dayVisits = new Map<string, number>();
const originalDay = simProto.liveADay;
simProto.liveADay = function (e: { id: string }) {
  dayVisits.set(e.id, (dayVisits.get(e.id) ?? 0) + 1);
  return originalDay.call(this, e);
};
const lifeVisits = new Map<string, number>();
const originalLife = simProto.liveAYear;
simProto.liveAYear = function (e: { id: string }) {
  lifeVisits.set(e.id, (lifeVisits.get(e.id) ?? 0) + 1);
  return originalLife.call(this, e);
};

const particles = new ParticleManager();
const founders = sim.entities.map(e => e.id);
const foundingCities = [...sim.cities.keys()];
const foundingRealms = [...sim.kingdoms.keys()];
for (let i = 0; i < TICKS_PER_YEAR; i++) sim.tickAI(tileMap, particles);

// ---- A year of charges has to add up to a year, per settlement ----
{
  const byId = charged.get('tickSettlement')!;
  const rows = foundingCities.map(id => byId.get(id)).filter((r): r is { visits: number; total: number } => !!r);
  assert.equal(rows.length, foundingCities.length, 'every founding settlement has to be visited');
  const perCity = rows.reduce((t, r) => t + r.total, 0) / rows.length;
  const visitsPerCity = rows.reduce((t, r) => t + r.visits, 0) / rows.length;
  const expected = TICKS_PER_YEAR / TICKS_PER_SEASON;
  console.log(`  settlements: ${visitsPerCity.toFixed(2)} visits each · charged ${perCity.toFixed(3)} of a year each`);
  assert.ok(perCity > 0.9 && perCity < 1.1, `a year of charge per settlement, got ${perCity.toFixed(3)}`);
  assert.ok(
    Math.abs(visitsPerCity - expected) <= 1,
    `~${expected} visits per settlement per year, got ${visitsPerCity.toFixed(2)}`
  );
}

// ---- The crown is charged the same way ----
{
  const byId = charged.get('collectTaxes')!;
  const rows = foundingRealms.map(id => byId.get(id)).filter((r): r is { visits: number; total: number } => !!r);
  assert.equal(rows.length, foundingRealms.length, 'every founding realm has to be visited');
  const perRealm = rows.reduce((t, r) => t + r.total, 0) / rows.length;
  console.log(`  realms: charged ${perRealm.toFixed(3)} of a year each`);
  assert.ok(perRealm > 0.9 && perRealm < 1.1, `a year of charge per realm, got ${perRealm.toFixed(3)}`);
}

// ---- A citizen still gets one day's hunger per day, and one life pass per season ----
{
  const alive = founders.filter(id => (sim.entities.find(e => e.id === id)?.hp ?? 0) > 0);
  assert.ok(alive.length > 0, 'somebody has to survive the year');

  const days = alive.map(id => dayVisits.get(id) ?? 0);
  const meanDays = days.reduce((t, n) => t + n, 0) / days.length;
  console.log(`  daily pass: ${meanDays.toFixed(2)} visits per citizen (a year is ${DAYS_PER_YEAR} days)`);
  assert.ok(
    Math.abs(meanDays - DAYS_PER_YEAR) <= 2,
    `~${DAYS_PER_YEAR} daily visits per citizen per year, got ${meanDays.toFixed(2)}`
  );

  const lives = alive.map(id => lifeVisits.get(id) ?? 0);
  const meanLives = lives.reduce((t, n) => t + n, 0) / lives.length;
  console.log(`  life pass: ${meanLives.toFixed(2)} visits per citizen (a year is ${SEASONS_PER_YEAR} seasons)`);
  assert.ok(
    Math.abs(meanLives - SEASONS_PER_YEAR) <= 1.5,
    `~${SEASONS_PER_YEAR} life visits per citizen per year, got ${meanLives.toFixed(2)}`
  );
}

// ---- The census still describes a whole population, not a slice of one ----
{
  const living = sim.entities.filter(e => e.hp > 0 && e.cityId).length;
  console.log(`  census: population ${sim.demographics.population} against ${living} living citizens`);
  assert.ok(sim.demographics.population > 0, 'a lap has to close and publish a census');
  // The census describes the last closed lap, so it trails the current count
  // rather than matching it exactly. It must not be a fraction of it.
  assert.ok(
    sim.demographics.population >= living * 0.5,
    `census ${sim.demographics.population} looks like part of a population, not one (${living} alive)`
  );
}

// ---- And the calendar still turns ----
assert.equal(sim.currentYear, 2, 'a year of ticks is a year on the calendar');
assert.ok(TICKS_PER_DAY > 0);

console.log('realtime-cadence.test: charges sum to a year, rotations keep their cadence, census still whole');
