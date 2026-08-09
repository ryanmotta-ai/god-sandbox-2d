import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Building } from '../src/civ/Building';
import { Household } from '../src/civ/Household';
import { rng } from '../src/core/Random';
import { SaveSystem } from '../src/core/SaveSystem';
import { EraManager } from '../src/world/WeatherEras';
import { Entity } from '../src/entities/Entity';
import {
  inheritOrigin, inheritFamilyMarks, settleEstate, familyAdvantage, rootedness,
  isOfMigrantStock, pruneAncestors, isHistoric, DemographicsAccumulator, uproot,
  ROOTED_GENERATIONS
} from '../src/civ/Generations';
import { remember, memoryOf } from '../src/entities/Psyche';

rng.setSeed(20260809);

function grassWorld(seed = 4242): TileMap {
  const map = new TileMap(64, 64, 'single_continent', seed);
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

// --- Origin is inherited, rootedness is earned ------------------------------
{
  const settler = person('settler', {
    cityId: 'metropole', birthCityId: 'metropole', birthCityName: 'Velha Aurélia',
    originCityId: 'metropole', originCityName: 'Velha Aurélia', localGenerations: 1
  });

  // The settler emigrates. Their line is now in the colony, but is not *of* it.
  settler.cityId = 'colony';
  uproot(settler);
  assert.equal(rootedness(settler), 0, 'a newcomer has no generational claim on the place');
  const firstBorn = person('gen2', { birthCityId: 'colony', birthCityName: 'Nova Aurélia' });
  inheritOrigin(firstBorn, null, settler);
  assert.equal(firstBorn.originCityName, 'Velha Aurélia', 'a colonist child keeps the family origin');
  assert.equal(firstBorn.localGenerations, 1, 'the first child born abroad starts the local line');
  assert.ok(isOfMigrantStock(firstBorn) === false, 'origin only counts as migrant once cityId is set');

  firstBorn.cityId = 'colony';
  assert.ok(isOfMigrantStock(firstBorn), 'a colony-born child of settlers is of migrant stock');

  let parent = firstBorn;
  for (let generation = 0; generation < 3; generation++) {
    const child = person(`gen${generation + 3}`, { birthCityId: 'colony', birthCityName: 'Nova Aurélia' });
    inheritOrigin(child, null, parent);
    child.cityId = 'colony';
    parent = child;
  }
  assert.ok(parent.localGenerations >= ROOTED_GENERATIONS, 'the line should be rooted after three colonial generations');
  assert.equal(rootedness(parent), 1, 'a rooted line reads as fully attached to the place');
  assert.equal(parent.originCityName, 'Velha Aurélia', 'and still remembers where the family came from');

  // A generation born somewhere new starts the count over.
  parent.cityId = 'thirdcity';
  uproot(parent);
  const uprooted = person('uprooted', { birthCityId: 'thirdcity', birthCityName: 'Outra' });
  inheritOrigin(uprooted, null, parent);
  assert.equal(uprooted.localGenerations, 1, 'moving again restarts local depth');
  assert.equal(uprooted.originCityName, 'Velha Aurélia', 'but never rewrites the family origin');
}

// --- Only the largest events cross a generation, and faintly -----------------
{
  const parent = person('p');
  remember(parent.memories, 'lost_home', 10, 0.9);   // heavy and hereditary
  remember(parent.memories, 'jobless', 10, 0.9);     // heavy but not hereditary
  remember(parent.memories, 'famine', 10, 0.2);      // hereditary but too faint

  const child = person('c', { birthYear: 30 });
  inheritFamilyMarks(child, parent, null);

  assert.ok(memoryOf(child.memories, 'lost_home') > 0, 'a family should carry the loss of its home');
  assert.ok(memoryOf(child.memories, 'lost_home') < memoryOf(parent.memories, 'lost_home') * 0.6,
    'but far more faintly than the parent lived it');
  assert.equal(memoryOf(child.memories, 'jobless'), 0, 'a parent`s bad year at work is not inherited');
  assert.equal(memoryOf(child.memories, 'famine'), 0, 'a faint memory is not worth passing on');
}

// --- An estate is settled on real heirs -------------------------------------
{
  const lookup = (map: Map<string, Entity>) => (id: string | null | undefined) => (id ? map.get(id) ?? null : null);

  // A fortune divided between many heirs is not a fortune.
  const rich = person('rich', { cityId: 'c', wealth: 400, profession: 'farmer', workplaceId: 'farm1', homeBuildingId: 'h1' });
  const heirs = [0, 1, 2, 3].map(i => person(`kid${i}`, { cityId: 'c', age: 25 - i, wealth: 0 }));
  rich.childrenIds = heirs.map(h => h.id);
  const many = new Map<string, Entity>(heirs.map(h => [h.id, h]));
  const split = settleEstate(rich, lookup(many), null, true);
  assert.equal(split.heirs.length, 4, 'every child in the settlement should inherit');
  assert.equal(heirs[0].wealth, 100, 'coin divides evenly between heirs');
  assert.equal(rich.wealth, 0, 'the dead keep nothing');
  assert.equal(split.trade, 'farmer', 'an idle adult heir should take over the family trade');
  assert.equal(heirs[0].homeBuildingId, 'h1', 'the eldest roofless heir takes the house');

  // The same fortune with one heir concentrates instead.
  const rich2 = person('rich2', { cityId: 'c', wealth: 400 });
  const only = person('only', { cityId: 'c', age: 30, wealth: 0 });
  rich2.childrenIds = [only.id];
  settleEstate(rich2, lookup(new Map([[only.id, only]])), null, false);
  assert.equal(only.wealth, 400, 'a single heir concentrates the whole estate');

  // No heir at all: the household keeps it, and a family can simply end.
  const lonely = person('lonely', { cityId: 'c', wealth: 120 });
  const house = new Household('hh', 'c', null, 1);
  house.memberIds.add('someone-else');
  settleEstate(lonely, () => null, house, false);
  assert.equal(house.coin, 120, 'with no heir the estate stays with the household');

  const extinct = person('extinct', { cityId: 'c', wealth: 90 });
  const emptied = new Household('hh2', 'c', null, 1);
  const gone = settleEstate(extinct, () => null, emptied, false);
  assert.equal(gone.heirs.length, 0, 'a line with nobody left leaves nobody anything');
  assert.equal(emptied.coin, 0, 'and an empty household does not absorb it');

  // An heir who already has work keeps it — continuity is an offer, not a duty.
  const smith = person('smith', { cityId: 'c', wealth: 50, profession: 'miner', workplaceId: 'mine1' });
  const employed = person('employed', { cityId: 'c', age: 30, wealth: 0, profession: 'farmer', workplaceId: 'farm9' });
  smith.childrenIds = [employed.id];
  const kept = settleEstate(smith, lookup(new Map([[employed.id, employed]])), null, true);
  assert.equal(kept.trade, null, 'an heir with a job does not have to take the family trade');
  assert.equal(employed.profession, 'farmer', 'and keeps the job they had');
  assert.equal(employed.familyTrade, 'miner', 'but the house still remembers what it did');
}

// --- Family money is an advantage, never a rank -----------------------------
{
  const poor = person('poor', { wealth: 0 });
  const comfortable = person('mid', { wealth: 60 });
  const wealthy = person('rich', { wealth: 900 });
  assert.ok(familyAdvantage(comfortable, null) > familyAdvantage(poor, null), 'money should help');
  assert.ok(familyAdvantage(wealthy, null) <= 0.75, 'and never become a guarantee');
}

// --- The dead are not kept forever, but the important ones are --------------
{
  const ancestors = new Map<string, { isGreatPerson: boolean; historic?: boolean; title: string | null; profession: string }>();
  for (let i = 0; i < 50; i++) ancestors.set(`d${i}`, { isGreatPerson: false, title: null, profession: 'farmer' });
  ancestors.set('king', { isGreatPerson: false, title: null, profession: 'king' });
  ancestors.set('founder', { isGreatPerson: false, historic: true, title: null, profession: 'farmer' });
  ancestors.set('hero', { isGreatPerson: true, title: 'O Bravo', profession: 'soldier' });

  const removed = pruneAncestors(ancestors, 10);
  assert.ok(removed > 0, 'the genealogy must be pruned once it exceeds its cap');
  assert.ok(ancestors.has('king') && ancestors.has('founder') && ancestors.has('hero'),
    'rulers, the marked and great persons must never be forgotten');
  assert.ok(isHistoric({ isGreatPerson: false, title: null, profession: 'leader' }), 'leaders count as historic');
  assert.ok(!isHistoric({ isGreatPerson: false, title: null, profession: 'farmer' }), 'ordinary citizens do not');
}

// --- Demography counts what it says it counts -------------------------------
{
  const census = new DemographicsAccumulator();
  const child = person('c1', { age: 6, cityId: 'a', originCityId: 'a', generation: 2, wealth: 0 });
  const adult = person('a1', { age: 35, cityId: 'a', originCityId: 'b', generation: 3, wealth: 100, localGenerations: 1 });
  const elder = person('e1', { age: 76, cityId: 'a', originCityId: 'a', generation: 1, wealth: 50, localGenerations: 4 });
  for (const e of [child, adult, elder]) census.count(e);
  const snapshot = census.finish(200, 2, 5, 3, 1);

  assert.equal(snapshot.population, 3);
  assert.equal(snapshot.children, 1);
  assert.equal(snapshot.adults, 1);
  assert.equal(snapshot.elders, 1);
  assert.equal(snapshot.migrantStock, 1, 'only the citizen whose family came from elsewhere');
  assert.equal(snapshot.rooted, 1, 'only the deeply rooted line');
  assert.equal(snapshot.births, 5);
  assert.equal(snapshot.deaths, 3);
  assert.equal(snapshot.relocations, 1);
  assert.ok(Math.abs(snapshot.meanAge - 39) < 0.01, `mean age should be 39, got ${snapshot.meanAge}`);
}

// --- Generations actually turn over in the running simulation ---------------
{
  const map = grassWorld();
  const sim = new SimulationEngine();
  const eras = new EraManager();
  const realm = new Kingdom('k', 'Reino', SpeciesType.HUMAN, '#d97706', 'town', 1);
  sim.kingdoms.set(realm.id, realm);

  const town = new City('town', 'Vila', SpeciesType.HUMAN, 20, 20, 'Founder', 1);
  town.kingdomId = realm.id;
  town.prosperity = 0.85;
  town.stock.add('food', 3000);
  for (let i = 0; i < 10; i++) {
    town.buildings.set(`farm${i}`, new Building(`farm${i}`, 'farm', 21 + i, 21, town.id));
    town.buildings.set(`house${i}`, new Building(`house${i}`, 'house', 21 + i, 23, town.id));
  }
  realm.addCity(town.id);
  sim.cities.set(town.id, town);
  sim.citySpatialHash.rebuild(sim.cities.values());

  const founders: Entity[] = [];
  for (let i = 0; i < 24; i++) {
    const citizen = sim.spawnEntity(SpeciesType.HUMAN, 20 + (i % 6) * 0.3, 20, map);
    citizen.age = 20 + (i % 12);
    citizen.cityId = town.id;
    citizen.kingdomId = realm.id;
    citizen.birthCityId = town.id;
    citizen.birthCityName = town.name;
    citizen.originCityId = town.id;
    citizen.originCityName = town.name;
    citizen.wealth = i < 4 ? 300 : 5; // a few rich houses, the rest poor
    founders.push(citizen);
  }
  town.population = founders.length;

  // Every particle call is a no-op; a Proxy covers whatever the AI reaches for.
  const particles = new Proxy({}, { get: () => () => {} }) as any;
  const YEARS = 26;
  for (let year = 0; year < YEARS; year++) {
    for (let tick = 0; tick < 7300; tick++) sim.tickAI(map, particles);
  }

  const living = sim.entities.filter(e => e.species === SpeciesType.HUMAN && e.hp > 0);
  console.log(
    `  ${YEARS} anos: vivos=${living.length} nascimentos=${sim.totalBirths} mortes=${sim.totalDeaths} ` +
    `ancestrais=${sim.deceasedAncestors.size} famílias=${sim.households.size}`
  );
  console.log(
    `  demografia: idade média ${sim.demographics.meanAge.toFixed(1)} · geração média ` +
    `${sim.demographics.meanGeneration.toFixed(2)} · riqueza média ${sim.demographics.meanWealth.toFixed(1)} · ` +
    `crianças ${sim.demographics.children} adultos ${sim.demographics.adults} idosos ${sim.demographics.elders}`
  );

  assert.ok(sim.totalBirths > 0, 'children must be born');
  assert.ok(sim.totalDeaths > 0, 'people must die of old age');
  assert.ok(living.length > 0, 'the settlement must survive a generation');

  const descendants = living.filter(e => e.generation > 1);
  assert.ok(descendants.length > 0, 'later generations must exist');
  assert.ok(sim.demographics.meanGeneration > 1, 'the world must be more than one lifetime deep');
  assert.ok(sim.demographics.population === living.length, 'the census must agree with the population');

  // Depth of line grows for families that stayed put.
  assert.ok(living.some(e => e.localGenerations >= 2), 'families that stayed should put down roots');

  // Social mobility: wealth must not be frozen where it started.
  const wealths = living.map(e => e.wealth);
  assert.ok(Math.max(...wealths) - Math.min(...wealths) > 1, 'wealth must vary across the population');
  const founderLines = living.filter(e => founders.some(f => f.id === e.fatherId || f.id === e.motherId));
  assert.ok(founderLines.length > 0, 'the founders must have descendants to trace');

  // Performance guards: nothing unbounded may have grown.
  assert.ok(sim.deceasedAncestors.size <= 600, `genealogy must stay capped, got ${sim.deceasedAncestors.size}`);
  for (const e of living) {
    assert.ok(e.memories.length <= 6, 'memory cap must hold across generations');
    assert.ok(e.bonds.length <= 4, 'relation cap must hold across generations');
    // Zero is legitimate: it is what someone who moved here themselves reads as.
    assert.ok(e.localGenerations >= 0 && e.localGenerations <= ROOTED_GENERATIONS + 2, 'local depth must stay bounded');
  }

  // Save stability across a deep world.
  const saved = JSON.parse(JSON.stringify(SaveSystem.exportSaveData(map, sim, eras)));
  const sample = living.slice(0, 20).map(e => ({
    id: e.id, generation: e.generation, origin: e.originCityId, depth: e.localGenerations,
    trade: e.familyTrade, wealth: e.wealth, father: e.fatherId
  }));
  SaveSystem.importSaveData(saved, map, sim, eras);
  for (const original of sample) {
    const reloaded = sim.entities.find(e => e.id === original.id)!;
    assert.equal(reloaded.generation, original.generation, 'generation must survive a reload');
    assert.equal(reloaded.originCityId, original.origin, 'family origin must survive a reload');
    assert.equal(reloaded.localGenerations, original.depth, 'local depth must survive a reload');
    assert.equal(reloaded.familyTrade, original.trade, 'the family trade must survive a reload');
    assert.equal(reloaded.wealth, original.wealth, 'inherited wealth must survive a reload');
    assert.equal(reloaded.fatherId, original.father, 'parentage must survive a reload');
  }
}

console.log('SOC-V3 smoke passed');
