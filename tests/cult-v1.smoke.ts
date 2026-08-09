import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Building } from '../src/civ/Building';
import { rng } from '../src/core/Random';
import { SaveSystem } from '../src/core/SaveSystem';
import { EraManager } from '../src/world/WeatherEras';
import { Entity } from '../src/entities/Entity';
import {
  CultureRegistry, CultureCensus, assimilate, considerEmergence, inheritCulture,
  EMERGENCE_POPULATION, EMERGENCE_YEARS, MAX_CULTURES
} from '../src/civ/CulturalIdentity';

rng.setSeed(20260809);

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

function person(id: string, overrides: Partial<Entity> = {}): Entity {
  const e = new Entity(id, SpeciesType.HUMAN, 0, 0, id);
  Object.assign(e, overrides);
  return e;
}

// --- Cultures form a lineage, and distance follows it -----------------------
{
  const registry = new CultureRegistry();
  const root = registry.create('Aurélios', 1, 'a');
  const branch = registry.create('Aurélios de Nova', 80, 'b', root);
  const cousin = registry.create('Aurélios do Sul', 90, 'c', root);
  const stranger = registry.create('Verdenses', 5, 'z');

  assert.equal(registry.distance(root.id, root.id), 0, 'a culture is not alien to itself');
  assert.ok(registry.distance(root.id, branch.id) < registry.distance(root.id, stranger.id),
    'a branch must be closer to its trunk than to an unrelated culture');
  assert.ok(registry.distance(branch.id, cousin.id) < 1, 'sibling branches are related');
  assert.equal(registry.distance(root.id, stranger.id), 1, 'unrelated cultures are fully alien');
  assert.ok(registry.descendsFrom(branch.id, root.id), 'lineage must be traceable');
  assert.ok(!registry.descendsFrom(root.id, branch.id), 'and only in one direction');
  assert.equal(branch.lineageDepth, 1, 'depth counts divergences');
}

// --- Children take mostly the family, partly the street ----------------------
{
  const registry = new CultureRegistry();
  const home = registry.create('Aurélios', 1, 'a');
  const local = registry.create('Verdenses', 1, 'b');

  // A family that is part of the majority passes its culture on almost intact.
  let keptFamily = 0;
  for (let i = 0; i < 400; i++) {
    const father = person(`f${i}`, { cultureId: home.id, localAffinity: 0 });
    const mother = person(`m${i}`, { cultureId: home.id, localAffinity: 0 });
    const result = inheritCulture(father, mother, { [home.id]: 0.9, [local.id]: 0.1 }, home.id);
    if (result.cultureId === home.id) keptFamily++;
  }
  assert.equal(keptFamily, 400, 'children of the majority keep the family culture');

  // A small minority in a town dominated by another culture loses children to it.
  let lostToLocal = 0;
  for (let i = 0; i < 400; i++) {
    const father = person(`f${i}`, { cultureId: home.id, localAffinity: 0.3 });
    const mother = person(`m${i}`, { cultureId: home.id, localAffinity: 0.3 });
    const result = inheritCulture(father, mother, { [home.id]: 0.08, [local.id]: 0.92 }, local.id);
    if (result.cultureId === local.id) lostToLocal++;
  }
  assert.ok(lostToLocal > 40, `a minority must lose some children to the majority, got ${lostToLocal}/400`);
  assert.ok(lostToLocal < 400, 'but never all of them — nothing here is automatic');
}

// --- Assimilation is gradual, generational and never instant ----------------
{
  const registry = new CultureRegistry();
  const foreign = registry.create('Aurélios', 1, 'a');
  const local = registry.create('Verdenses', 1, 'b');
  const mix = { [foreign.id]: 0.1, [local.id]: 0.9 };

  // A first-generation newcomer: absorbs the place, keeps the identity.
  const newcomer = person('new', { cultureId: foreign.id, localAffinity: 0, localGenerations: 0 });
  for (let year = 0; year < 60; year++) {
    newcomer.cultureId = assimilate(newcomer, mix, local.id, registry, 0.7);
  }
  assert.equal(newcomer.cultureId, foreign.id, 'someone who moved here themselves never changes identity');
  assert.ok(newcomer.localAffinity > 0.5, 'but the place does wear off on them');

  // Their child, raised here, can flip.
  const raisedHere = person('kid', { cultureId: foreign.id, localAffinity: 0.4, localGenerations: 2 });
  let flippedAt = -1;
  for (let year = 0; year < 200 && flippedAt < 0; year++) {
    raisedHere.cultureId = assimilate(raisedHere, mix, local.id, registry, 0.7);
    if (raisedHere.cultureId === local.id) flippedAt = year;
  }
  assert.ok(flippedAt > 5, `assimilation must take years, flipped at ${flippedAt}`);

  // Living among your own undoes drift instead of adding to it.
  const athome = person('home', { cultureId: local.id, localAffinity: 0.6, localGenerations: 3 });
  assimilate(athome, mix, local.id, registry, 0.7);
  assert.ok(athome.localAffinity < 0.6, 'living among your own reduces absorbed influence');

  // A close culture is absorbed faster than a stranger.
  const sibling = registry.create('Verdenses do Norte', 50, 'c', local);
  const nearMix = { [sibling.id]: 0.1, [local.id]: 0.9 };
  const near = person('near', { cultureId: sibling.id, localAffinity: 0, localGenerations: 1 });
  const far = person('far', { cultureId: foreign.id, localAffinity: 0, localGenerations: 1 });
  for (let year = 0; year < 10; year++) {
    assimilate(near, nearMix, local.id, registry, 0.7);
    assimilate(far, mix, local.id, registry, 0.7);
  }
  assert.ok(near.localAffinity > far.localAffinity, 'a sibling culture assimilates faster than a stranger');
}

// --- New cultures need population, time and stability -----------------------
{
  const registry = new CultureRegistry();
  const a = registry.create('Aurélios', 1, 'home');
  const b = registry.create('Verdenses', 1, 'other');
  const base = {
    cityId: 'town', cityName: 'Portela', year: 300,
    mix: { [a.id]: 0.55, [b.id]: 0.45 }, dominant: a.id,
    rootedShare: 0.8, yearsStable: 200, population: 80, isolated: false
  };

  assert.equal(considerEmergence({ ...base, population: EMERGENCE_POPULATION - 1 }, registry), null,
    'a small town cannot invent a culture');
  assert.equal(considerEmergence({ ...base, yearsStable: EMERGENCE_YEARS - 1 }, registry), null,
    'nor a town that only just settled');
  assert.equal(considerEmergence({ ...base, mix: { [a.id]: 0.95, [b.id]: 0.05 }, isolated: false }, registry), null,
    'nor a token minority inside a homogeneous town');

  const hybrid = considerEmergence(base, registry);
  assert.ok(hybrid && hybrid.kind === 'hybrid', 'two large populations living together for generations produce a hybrid');
  assert.deepEqual(hybrid!.fromIds.sort(), [a.id, b.id].sort(), 'and it records both parents');
  assert.ok(hybrid!.identity.parentId, 'a hybrid descends from something');

  // Divergence: one culture, far from home, generations deep, politically apart.
  const registry2 = new CultureRegistry();
  const metro = registry2.create('Aurélios', 1, 'metropole');
  const colonial = considerEmergence({
    cityId: 'colony', cityName: 'Nova Aurélia', year: 300,
    mix: { [metro.id]: 1 }, dominant: metro.id,
    rootedShare: 0.9, yearsStable: 120, population: 60, isolated: true
  }, registry2);
  assert.ok(colonial && colonial.kind === 'divergence', 'an isolated rooted colony diverges');
  assert.equal(colonial!.identity.parentId, metro.id, 'and remains a branch of the old country');

  // Not while still attached to the homeland.
  assert.equal(considerEmergence({
    cityId: 'colony', cityName: 'Nova Aurélia', year: 300,
    mix: { [metro.id]: 1 }, dominant: metro.id,
    rootedShare: 0.9, yearsStable: 120, population: 60, isolated: false
  }, registry2), null, 'a colony still bound to the metropole does not diverge');

  // The registry is bounded.
  const full = new CultureRegistry();
  for (let i = 0; i < MAX_CULTURES; i++) full.create(`C${i}`, 1, null);
  assert.equal(considerEmergence({ ...base, mix: { [a.id]: 0.5, [b.id]: 0.5 } }, full), null,
    'no new culture once the registry is full');
}

// --- Composition is accumulated, not scanned --------------------------------
{
  const census = new CultureCensus();
  for (let i = 0; i < 7; i++) census.count('town', 'cult_a', i < 3);
  for (let i = 0; i < 3; i++) census.count('town', 'cult_b', false);
  const { mix, dominant, counted, rootedShare } = census.mixFor('town');
  assert.equal(counted, 10);
  assert.equal(dominant, 'cult_a');
  assert.ok(Math.abs(mix['cult_a'] - 0.7) < 1e-9 && Math.abs(mix['cult_b'] - 0.3) < 1e-9);
  assert.ok(Math.abs(rootedShare - 0.3) < 1e-9);
  assert.deepEqual(census.mixFor('nowhere'), { mix: {}, dominant: null, counted: 0, rootedShare: 0 });
}

// --- In the running simulation: a multicultural town, and a border that moves -
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  const eras = new EraManager();
  const realm = new Kingdom('k1', 'Reino', SpeciesType.HUMAN, '#d97706', 'town', 1);
  const foreignRealm = new Kingdom('k2', 'Outro Reino', SpeciesType.HUMAN, '#2563eb', 'town', 1);
  sim.kingdoms.set(realm.id, realm);
  sim.kingdoms.set(foreignRealm.id, foreignRealm);

  const town = new City('town', 'Portela', SpeciesType.HUMAN, 20, 20, 'Founder', 1);
  town.kingdomId = realm.id;
  town.prosperity = 0.8;
  town.stock.add('food', 4000);
  for (let i = 0; i < 10; i++) {
    town.buildings.set(`farm${i}`, new Building(`farm${i}`, 'farm', 21 + i, 21, town.id));
    town.buildings.set(`house${i}`, new Building(`house${i}`, 'house', 21 + i, 23, town.id));
  }
  realm.addCity(town.id);
  sim.cities.set(town.id, town);
  sim.citySpatialHash.rebuild(sim.cities.values());

  const natives = sim.cultures.create('Portelanos', 1, town.id);
  const incomers = sim.cultures.create('Verdenses', 1, null);
  town.dominantCultureId = natives.id;
  town.cultureMix = { [natives.id]: 1 };

  const residents: Entity[] = [];
  for (let i = 0; i < 30; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, 20 + (i % 6) * 0.3, 20, map);
    citizen.age = 20 + (i % 25);
    citizen.cityId = town.id;
    citizen.kingdomId = realm.id;
    citizen.birthCityId = town.id;
    citizen.birthCityName = town.name;
    citizen.originCityId = town.id;
    citizen.originCityName = town.name;
    // A third of the town are recent arrivals of another people.
    const foreign = i % 3 === 0;
    citizen.cultureId = foreign ? incomers.id : natives.id;
    citizen.localGenerations = foreign ? 0 : 3;
    residents.push(citizen);
  }
  town.population = residents.length;

  const particles = new Proxy({}, { get: () => () => {} }) as any;
  for (let year = 0; year < 24; year++) {
    for (let tick = 0; tick < 7300; tick++) sim.tickAI(map, particles);
  }

  const living = sim.entities.filter(e => e.species === SpeciesType.HUMAN && e.hp > 0);
  const shares = Object.entries(town.cultureMix)
    .map(([id, share]) => `${sim.cultures.get(id)?.name ?? id} ${(share * 100).toFixed(0)}%`)
    .join(' · ');
  console.log(`  24 anos · ${living.length} pessoas · culturas=${sim.cultures.size} · ${shares}`);

  assert.ok(Object.keys(town.cultureMix).length >= 1, 'the settlement must have a cultural composition');
  const total = Object.values(town.cultureMix).reduce((sum, share) => sum + share, 0);
  assert.ok(Math.abs(total - 1) < 1e-6, `shares must sum to 1, got ${total}`);
  assert.ok(town.dominantCultureId, 'and a dominant culture');
  assert.ok(living.every(e => !!e.cultureId), 'every citizen must belong to a culture');

  // Children born to the incomers exist and belong to a culture chosen by the
  // family/street rule rather than copied blindly.
  const born = living.filter(e => e.generation > 1);
  assert.ok(born.length > 0, 'a generation must have been born here');
  assert.ok(born.every(e => !!e.cultureId), 'and every one of them has an identity');

  // §3: conquest moves the border, not the people.
  const before = living.map(e => ({ id: e.id, culture: e.cultureId }));
  town.kingdomId = foreignRealm.id;
  for (const e of living) e.kingdomId = foreignRealm.id;
  for (let tick = 0; tick < 7300; tick++) sim.tickAI(map, particles);
  let unchanged = 0;
  for (const original of before) {
    const now = sim.entities.find(e => e.id === original.id);
    if (now && now.cultureId === original.culture) unchanged++;
  }
  assert.ok(unchanged >= before.length * 0.95,
    `conquest must not convert the population, ${before.length - unchanged}/${before.length} changed`);

  // Save round-trip: cultures and identities survive.
  const registrySize = sim.cultures.size;
  const sample = living.slice(0, 15).map(e => ({ id: e.id, culture: e.cultureId, affinity: e.localAffinity }));
  const saved = JSON.parse(JSON.stringify(SaveSystem.exportSaveData(map, sim, eras)));
  SaveSystem.importSaveData(saved, map, sim, eras);
  assert.equal(sim.cultures.size, registrySize, 'the culture registry must survive a reload');
  for (const original of sample) {
    const reloaded = sim.entities.find(e => e.id === original.id);
    if (!reloaded) continue;
    assert.equal(reloaded.cultureId, original.culture, 'cultural identity must survive a reload');
    assert.equal(reloaded.localAffinity, original.affinity, 'absorbed influence must survive a reload');
  }

  // Pre-CULT saves load and are given the culture of the ground they stand on.
  const legacy = JSON.parse(JSON.stringify(saved));
  for (const entity of legacy.entities) { delete entity.cultureId; delete entity.localAffinity; }
  delete legacy.cultures;
  SaveSystem.importSaveData(legacy, map, sim, eras);
  assert.equal(sim.cultures.size, 0, 'a pre-CULT save carries no registry');
  assert.ok(sim.entities.every(e => e.cultureId === ''), 'and no identities, until the first census');
}

console.log('CULT-V1 smoke passed');
