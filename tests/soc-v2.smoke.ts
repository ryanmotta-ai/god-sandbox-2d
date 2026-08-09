import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { rng } from '../src/core/Random';
import { SaveSystem } from '../src/core/SaveSystem';
import { EraManager } from '../src/world/WeatherEras';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Building } from '../src/civ/Building';
import type { Entity } from '../src/entities/Entity';
import {
  createPsyche, inheritPsyche, migrationUrge, standGroundChance,
  remember, decayMemories, bondWith, decayBonds, traumaLoad, wellbeing,
  MEMORY_CAP, BOND_CAP, type Psyche, type Memory, type Bond
} from '../src/entities/Psyche';

function grassWorld(): TileMap {
  const map = new TileMap(64, 64, 'single_continent', 4242);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.fertility = 1;
  }
  map.updateRegionStates(32, 32);
  return map;
}

// Everything below is probabilistic by design, so the stream is pinned. A run
// that varies between invocations would also mean save/load could not be trusted.
rng.setSeed(20260809);

const roll = () => rng.next();

/** Every psyche field pinned to one value, for isolating a single trait. */
function flat(value: number, overrides: Partial<Psyche> = {}): Psyche {
  return {
    courage: value, sociability: value, ambition: value, aggression: value,
    loyalty: value, curiosity: value, riskTolerance: value, ...overrides
  };
}

const CALM = {
  wellbeing: 0.7, jobless: 0, hunger: 20, danger: 0,
  familyTies: 0.5, opportunityElsewhere: 0.2, trauma: 0, age: 30
};

// --- Personality changes the answer to an identical situation ---------------
{
  // Deliberately a moderate crisis, not a catastrophe: at the extremes every
  // disposition saturates at 1 and the test would prove nothing.
  const crisis = { ...CALM, wellbeing: 0.45, jobless: 1, hunger: 45, danger: 0.3, familyTies: 0.3 };

  const loyal = migrationUrge(flat(0.2, { loyalty: 0.95 }), crisis);
  const restless = migrationUrge(flat(0.2, { ambition: 0.95, curiosity: 0.9 }), crisis);
  assert.ok(restless > loyal, 'ambition should push harder toward leaving than loyalty holds back');

  const cautious = migrationUrge(flat(0.5, { riskTolerance: 0.05 }), crisis);
  const bold = migrationUrge(flat(0.5, { riskTolerance: 0.95 }), crisis);
  assert.ok(cautious > bold, 'the risk-averse should feel danger as a stronger reason to leave');

  // The same person, two situations. Circumstance still has to dominate.
  const person = flat(0.5);
  assert.ok(migrationUrge(person, crisis) > migrationUrge(person, CALM) + 0.2,
    'a crisis must move the urge far more than any disposition does');
}

// --- Family and age anchor people in place ----------------------------------
{
  const p = flat(0.5);
  const pressure = { ...CALM, wellbeing: 0.3, hunger: 65, danger: 0.5 };
  assert.ok(migrationUrge(p, { ...pressure, familyTies: 0 }) > migrationUrge(p, { ...pressure, familyTies: 1 }),
    'family in the settlement must reduce the urge to leave it');
  assert.ok(migrationUrge(p, { ...pressure, age: 20 }) > migrationUrge(p, { ...pressure, age: 65 }),
    'the young should uproot more readily than the old');
}

// --- Courage decides who stands, but the odds still dominate ----------------
{
  const odds = { outnumbered: 1, armed: true, protectingFamily: false, trauma: 0, isFighter: false };
  const brave = standGroundChance(flat(0.5, { courage: 0.95 }), odds);
  const timid = standGroundChance(flat(0.5, { courage: 0.05 }), odds);
  assert.ok(brave > timid + 0.3, 'courage must visibly change who stands their ground');

  const hero = flat(0.5, { courage: 0.95 });
  assert.ok(standGroundChance(hero, { ...odds, outnumbered: 5 }) < standGroundChance(hero, odds),
    'even the brave should be less willing when badly outnumbered');
  assert.equal(standGroundChance(flat(0.05), { ...odds, isFighter: true }), 1,
    'soldiers always fight regardless of disposition');
  assert.ok(
    standGroundChance(flat(0.5), { ...odds, protectingFamily: true }) > standGroundChance(flat(0.5), odds),
    'having family at your back should make you more likely to stand'
  );
}

// --- Memory is bounded, fades, and trauma outlives good news ----------------
{
  const memories: Memory[] = [];
  const kinds = ['bereavement', 'war_survived', 'battle', 'moved', 'lost_home', 'jobless', 'famine', 'fire'] as const;
  for (const kind of kinds) remember(memories, kind, 10, 0.6);
  assert.ok(memories.length <= MEMORY_CAP, `memory must stay capped at ${MEMORY_CAP}, got ${memories.length}`);

  const trauma: Memory[] = [];
  remember(trauma, 'bereavement', 1, 0.8);
  const good: Memory[] = [];
  remember(good, 'prospered', 1, 0.8);
  for (let year = 0; year < 12; year++) { decayMemories(trauma); decayMemories(good); }
  assert.ok(trauma[0].weight > (good[0]?.weight ?? 0), 'grief must outlast a good year');

  // Everything eventually fades out entirely.
  const fleeting: Memory[] = [];
  remember(fleeting, 'jobless', 1, 0.4);
  for (let year = 0; year < 60; year++) decayMemories(fleeting);
  assert.equal(fleeting.length, 0, 'faint memories should be dropped, not held forever');

  // A second famine deepens the first rather than taking another slot.
  const repeated: Memory[] = [];
  remember(repeated, 'famine', 1, 0.4);
  const once = repeated[0].weight;
  remember(repeated, 'famine', 2, 0.4);
  assert.equal(repeated.length, 1, 'repeat hardship should not consume a second memory slot');
  assert.ok(repeated[0].weight > once, 'repeat hardship should deepen the existing scar');

  const heavy: Memory[] = [];
  remember(heavy, 'lost_home', 1, 0.9);
  remember(heavy, 'bereavement', 1, 0.9);
  assert.ok(traumaLoad(heavy) > traumaLoad([]) && traumaLoad(heavy) < 1, 'trauma load must accumulate but never saturate');
}

// --- Relations are capped and lapse without contact -------------------------
{
  const bonds: Bond[] = [];
  for (let i = 0; i < 10; i++) bondWith(bonds, `n${i}`, 'friend', 0.3 + i * 0.05);
  assert.ok(bonds.length <= BOND_CAP, `relations must stay capped at ${BOND_CAP}, got ${bonds.length}`);

  const pair: Bond[] = [];
  bondWith(pair, 'x', 'friend', 0.5);
  for (let i = 0; i < 6; i++) bondWith(pair, 'x', 'rival', 0.3);
  assert.equal(pair[0].kind, 'rival', 'a friendship repeatedly soured should flip to rivalry');

  for (let year = 0; year < 40; year++) decayBonds(pair);
  assert.equal(pair.length, 0, 'unmaintained relations should lapse');
}

// --- Wellbeing tracks the things it claims to track --------------------------
{
  const base = { hunger: 10, comfort: 80, safety: 90, social: 80, hasJob: true, hasHome: true, hasFamily: true, trauma: 0 };
  const good = wellbeing(base);
  assert.ok(good > 0.85, `a fed, safe, employed, housed citizen should read well, got ${good}`);
  assert.ok(wellbeing({ ...base, hunger: 95 }) < good - 0.2, 'hunger must dominate wellbeing');
  assert.ok(wellbeing({ ...base, hasJob: false }) < good, 'losing work must lower wellbeing');
  assert.ok(wellbeing({ ...base, trauma: 0.9 }) < good, 'carrying trauma must lower wellbeing');
}

// --- Inheritance passes disposition on without collapsing the spread --------
{
  let population: Psyche[] = Array.from({ length: 80 }, () => createPsyche(roll));
  const spreadOf = (list: Psyche[]) => {
    const mean = list.reduce((sum, p) => sum + p.courage, 0) / list.length;
    return Math.sqrt(list.reduce((sum, p) => sum + (p.courage - mean) ** 2, 0) / list.length);
  };
  const firstSpread = spreadOf(population);

  for (let generation = 0; generation < 8; generation++) {
    population = population.map((p, i) => inheritPsyche(p, population[(i + 1) % population.length], roll));
  }
  const laterSpread = spreadOf(population);
  assert.ok(laterSpread > firstSpread * 0.4, `eight generations should not flatten the population (${firstSpread} -> ${laterSpread})`);

  // Children resemble their parents.
  const brave = flat(0.5, { courage: 0.95 });
  const timidLine = flat(0.5, { courage: 0.05 });
  let braveSum = 0, timidSum = 0;
  for (let i = 0; i < 200; i++) {
    braveSum += inheritPsyche(brave, brave, roll).courage;
    timidSum += inheritPsyche(timidLine, timidLine, roll).courage;
  }
  assert.ok(braveSum / 200 > timidSum / 200 + 0.2, 'children of the brave should skew braver than children of the timid');
}

// --- In the running simulation: one situation, many answers -----------------
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  for (let i = 0; i < 100; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, 20 + (i % 10) * 0.4, 20 + Math.floor(i / 10) * 0.4, map);
    citizen.age = 18 + (i % 40);
  }

  const psyches = sim.entities.map(e => e.psyche);
  const distinct = new Set(psyches.map(p => Math.round(p.courage * 20))).size;
  assert.ok(distinct > 6, `spawned citizens should not share one disposition, got ${distinct} bands`);

  // The same crisis, read by a hundred different people. RELOCATION_URGE is 0.5,
  // so this is literally the question the simulation asks: who leaves?
  const situation = (e: (typeof sim.entities)[number]) => ({
    wellbeing: e.wellbeing, jobless: 1, hunger: 40, danger: 0.25,
    familyTies: 0.4, opportunityElsewhere: 0.3, trauma: e.trauma, age: e.age
  });
  const urges = sim.entities.map(e => migrationUrge(e.psyche, situation(e)));
  const stay = urges.filter(u => u < 0.5).length;
  const leave = urges.length - stay;
  assert.ok(stay > 5 && leave > 5,
    `a hundred citizens in one crisis must split, got ${stay} staying and ${leave} leaving`);

  // And the split has to come from who they are, not from fresh dice: the same
  // citizen asked twice gives the same answer.
  const repeat = sim.entities.map(e => migrationUrge(e.psyche, situation(e)));
  assert.deepEqual(repeat, urges, 'the decision must be a function of the person, not of a fresh roll');
}

// --- A year of life runs, and citizens diverge without crashing -------------
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  for (let i = 0; i < 40; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, 30 + (i % 8) * 0.5, 30 + Math.floor(i / 8) * 0.5, map);
    citizen.age = 20 + (i % 30);
  }
  // Every particle call is a no-op; a Proxy covers whatever the AI reaches for.
  const particles = new Proxy({}, { get: () => () => {} }) as any;
  const startYear = sim.currentYear;
  for (let tick = 0; tick < 7300; tick++) sim.tickAI(map, particles);

  assert.ok(sim.currentYear > startYear, 'a full year of ticks should advance the calendar');
  const alive = sim.entities.filter(e => e.species === SpeciesType.HUMAN && e.hp > 0);
  assert.ok(alive.length > 0, 'citizens should survive an ordinary year');
  const states = new Set(alive.map(e => e.aiState));
  assert.ok(states.size > 1, `citizens in one settlement should not all be doing the same thing, got ${[...states]}`);
  for (const e of alive) {
    assert.ok(e.memories.length <= MEMORY_CAP, 'memory cap must hold in the running simulation');
    assert.ok(e.bonds.length <= BOND_CAP, 'relation cap must hold in the running simulation');
    assert.ok(e.needs.social >= 0 && e.needs.social <= 100, 'the social need must stay in range');
    assert.ok(e.migrationUrge >= 0 && e.migrationUrge <= 1, 'migration urge must stay in range');
  }
}

// --- A failing settlement next to a working one actually empties ------------
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  const realm = new Kingdom('k1', 'Reino Teste', SpeciesType.HUMAN, '#d97706', 'failing', 1);
  sim.kingdoms.set(realm.id, realm);

  const failing = new City('failing', 'Fome', SpeciesType.HUMAN, 16, 16, 'Founder', 1);
  const thriving = new City('thriving', 'Fartura', SpeciesType.HUMAN, 40, 16, 'Founder', 1);
  for (const city of [failing, thriving]) {
    city.kingdomId = realm.id;
    realm.addCity(city.id);
    sim.cities.set(city.id, city);
  }
  // One town has nothing and no work; the other has food, room and open jobs.
  failing.population = 30;
  thriving.population = 6;
  thriving.prosperity = 0.9;
  thriving.stock.add('food', 400);
  for (let i = 0; i < 8; i++) {
    thriving.buildings.set(`farm${i}`, new Building(`farm${i}`, 'farm', 41 + i, 17, thriving.id));
    thriving.buildings.set(`house${i}`, new Building(`house${i}`, 'house', 41 + i, 19, thriving.id));
  }

  const residents: Entity[] = [];
  for (let i = 0; i < 30; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, 16 + (i % 6) * 0.3, 16, map);
    citizen.age = 20 + (i % 30);
    citizen.cityId = failing.id;
    citizen.kingdomId = realm.id;
    citizen.needs.hunger = 75;
    residents.push(citizen);
  }
  sim.citySpatialHash.rebuild(sim.cities.values());

  // Every particle call is a no-op; a Proxy covers whatever the AI reaches for.
  const particles = new Proxy({}, { get: () => () => {} }) as any;
  for (let year = 0; year < 3; year++) {
    for (let tick = 0; tick < 7300; tick++) sim.tickAI(map, particles);
  }

  const moved = residents.filter(e => e.hp > 0 && e.cityId === thriving.id);
  const stayed = residents.filter(e => e.hp > 0 && e.cityId === failing.id);
  assert.ok(moved.length > 0, 'citizens in a starving town must actually leave for a thriving neighbour');
  assert.ok(stayed.length > 0, 'and not all of them — some people stay');
  assert.ok(moved.every(e => e.memories.some(m => m.kind === 'moved')), 'anyone who left should remember leaving');

  // The ones who went must be measurably more restless than the ones who stayed.
  const mean = (list: Entity[], pick: (e: Entity) => number) =>
    list.reduce((sum, e) => sum + pick(e), 0) / Math.max(1, list.length);
  assert.ok(
    mean(moved, e => e.psyche.loyalty) < mean(stayed, e => e.psyche.loyalty) + 0.15,
    'the people who left should not be the more loyal half of the town'
  );
}

// --- Save and reload must not turn a person into someone else --------------
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  const eras = new EraManager();
  for (let i = 0; i < 12; i++) sim.spawnEntity(SpeciesType.HUMAN, 12 + i * 0.5, 12, map).age = 25 + i;

  // Give them histories worth losing.
  sim.entities.forEach((e, i) => {
    remember(e.memories, i % 2 ? 'bereavement' : 'lost_home', 5, 0.4 + i * 0.02);
    bondWith(e.bonds, sim.entities[(i + 1) % sim.entities.length].id, i % 3 ? 'friend' : 'rival', 0.5);
    e.migrationUrge = i / 20;
  });
  const before = sim.entities.map(e => ({
    id: e.id, psyche: { ...e.psyche }, memories: JSON.stringify(e.memories),
    bonds: JSON.stringify(e.bonds), social: e.needs.social, urge: e.migrationUrge
  }));

  const saved = JSON.parse(JSON.stringify(SaveSystem.exportSaveData(map, sim, eras)));
  SaveSystem.importSaveData(saved, map, sim, eras);

  assert.equal(sim.entities.length, before.length, 'reload must restore every citizen');
  for (const original of before) {
    const reloaded = sim.entities.find(e => e.id === original.id)!;
    assert.deepEqual(reloaded.psyche, original.psyche, 'disposition must survive a reload unchanged');
    assert.equal(JSON.stringify(reloaded.memories), original.memories, 'memories must survive a reload unchanged');
    assert.equal(JSON.stringify(reloaded.bonds), original.bonds, 'relations must survive a reload unchanged');
    assert.equal(reloaded.needs.social, original.social, 'the social need must survive a reload');
    assert.equal(reloaded.migrationUrge, original.urge, 'migration urge must survive a reload');
  }

  // A save written before SOC-V2 existed must still load, with a real
  // disposition rather than seven zeroes.
  const legacy = JSON.parse(JSON.stringify(saved));
  for (const entity of legacy.entities) {
    delete entity.psyche; delete entity.memories; delete entity.bonds; delete entity.migrationUrge;
    entity.needs = { hunger: 30, comfort: 50, safety: 60 };
  }
  SaveSystem.importSaveData(legacy, map, sim, eras);
  for (const e of sim.entities) {
    assert.ok(e.psyche.courage > 0 && e.psyche.courage < 1, 'a pre-SOC citizen must load with a usable disposition');
    assert.equal(e.needs.social, 60, 'a pre-SOC citizen must load with the default social need');
    assert.deepEqual(e.memories, [], 'a pre-SOC citizen simply has no recorded past');
  }
}

console.log('SOC-V2 smoke passed');
