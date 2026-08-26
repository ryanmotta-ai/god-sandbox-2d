/**
 * Can an army cross water at all?
 *
 * Before `NavalInvasion`, no. Water is a hard refusal in
 * `SimplePathfinder.getStepTowards`, so a soldier ordered onto an island walked
 * to the beach and stopped there permanently, and `assessSiege` — which needs
 * enemy soldiers inside the ring around a city — could never fire. This builds
 * the exact map that used to be unwinnable: two islands separated by open sea,
 * a realm on each, at war.
 *
 * Run: npx tsx tests/naval-invasion.test.ts
 */
import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType, TERRAINS } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { SimulationEngine } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { rng } from '../src/core/Random';
import { describeFleet, fleetStats } from '../src/civ/Warships';

const SIZE = 64;

/** Two square islands in an ocean, with a clear sea lane between them. */
function twoIslands(): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 4242);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.getTile(x, y)!;
      const west = x >= 6 && x <= 18 && y >= 24 && y <= 40;
      const east = x >= 44 && x <= 56 && y >= 24 && y <= 40;
      t.type = west || east ? TerrainType.GRASS : TerrainType.OCEAN;
      t.height = west || east ? 0.5 : 0.2;
      t.buildingId = null;
      t.roadLevel = 0;
      t.isOnFire = false;
    }
  }
  map.updateRegionStates(SIZE / 2, SIZE / 2);
  return map;
}

rng.setSeed(31337);
const map = twoIslands();
const sim = new SimulationEngine();
const particles = new ParticleManager();

// Sanity: the scenario really is the impossible one. No land path exists.
{
  const path = SimplePathfinder.findPath(16, 32, 46, 32, map, 'land', 6000, 1);
  const last = path[path.length - 1];
  const walkable = path.length > 1 && !!last && Math.hypot(last.x - 46, last.y - 32) < 3;
  console.log(`caminho por terra entre as ilhas: ${walkable ? 'EXISTE' : 'nao existe'}   (esperado: nao existe)`);
  assert.ok(!walkable, 'o cenario precisa ser intransponivel por terra');
  const sea = SimplePathfinder.findPath(20, 32, 42, 32, map, 'sea', 4000, 1);
  console.log(`caminho por mar: ${sea.length} tiles`);
  assert.ok(sea.length > 1, 'precisa existir rota maritima');
}

const west = new City('cW', 'Portovelho', SpeciesType.HUMAN, 16, 32, 'Fundador', 1);
const east = new City('cE', 'Ilha Rubra', SpeciesType.HUMAN, 46, 32, 'Fundador', 1);
sim.cities.set(west.id, west);
sim.cities.set(east.id, east);

const kW = new Kingdom('kW', 'Talassia', SpeciesType.HUMAN, '#38bdf8', west.id, 1);
const kE = new Kingdom('kE', 'Rubrica', SpeciesType.HUMAN, '#ef4444', east.id, 1);
west.kingdomId = kW.id;
east.kingdomId = kE.id;
sim.kingdoms.set(kW.id, kW);
sim.kingdoms.set(kE.id, kE);
kW.knownKingdoms.add(kE.id);
kE.knownKingdoms.add(kW.id);

// Timber for hulls — an invasion is a real charge on a real stockpile.
west.stock.add('wood', 400);
west.stock.add('food', 400);
east.stock.add('food', 400);

// A garrison on the west island, and one defender on the east.
const invaders: string[] = [];
for (let i = 0; i < 20; i++) {
  const e = sim.spawnEntity(SpeciesType.HUMAN, 16 + rng.range(-2, 2), 32 + rng.range(-2, 2), map);
  e.cityId = west.id;
  e.kingdomId = kW.id;
  e.profession = 'soldier';
  invaders.push(e.id);
}
for (let i = 0; i < 4; i++) {
  const e = sim.spawnEntity(SpeciesType.HUMAN, 46 + rng.range(-2, 2), 32 + rng.range(-2, 2), map);
  e.cityId = east.id;
  e.kingdomId = kE.id;
  e.profession = 'soldier';
}

sim.diplomacy.declareWar(kW.id, kE.id, 1, 'Disputa de Fronteira');
sim.currentYear = 1;

// ---- 1. The decision ----
const woodBefore = west.stock.get('wood');
sim.invasions.tickYear(sim.kingdoms, sim.cities, sim.entities, sim.diplomacy, map, 1);
const fleet = [...sim.invasions.fleets.values()][0];
console.log(`\n1. frota lancada: ${!!fleet}   soldados a bordo: ${fleet?.soldierIds.length ?? 0}`);
console.log(`   esquadra: ${fleet ? describeFleet(fleet.composition) : '-'}`);
assert.ok(fleet, 'uma frota deve zarpar contra um alvo inalcancavel por terra');
assert.ok(fleet.soldierIds.length >= 5);
// A realm that has discovered nothing still crosses — in war canoes, which is
// the only hull it can build and the reason the fallback chain has a last rung.
const st = fleetStats(fleet.composition);
console.log(`   bercos ${st.berths}, casco ${st.hull}, cascos ${st.hulls}`);
assert.ok(st.hulls > 0 && st.berths >= fleet.soldierIds.length,
  'a esquadra tem de ter berco para quem embarcou');

const woodAfter = west.stock.get('wood');
console.log(`   madeira debitada: ${woodBefore - woodAfter}   (conservacao: os cascos custam)`);
assert.ok(woodAfter < woodBefore, 'a frota tem de sair do estoque real');

// ---- 2. Nobody at sea is on the map ----
const aboard = sim.entities.filter(e => e.aboardFleetId === fleet.id);
console.log(`2. embarcados marcados: ${aboard.length}`);
assert.equal(aboard.length, fleet.soldierIds.length);

// ---- 3. The crossing, driven by the real per-tick update ----
const entitiesById = new Map(sim.entities.map(e => [e.id, e]));
let ticks = 0;
let landedYear = 0;
const startX = fleet.x;
while (ticks < 200000 && sim.invasions.fleets.size > 0) {
  sim.invasions.update(sim.cities, entitiesById, sim.diplomacy, map, particles, 1);
  ticks++;
}
console.log(`3. travessia concluida em ${ticks} ticks   (${(ticks / 600).toFixed(1)} dias simulados)`);
console.log(`   deslocamento: ${startX.toFixed(1)} -> chegou`);
assert.ok(ticks > 100, 'a travessia tem de ser visivel, nao instantanea');
assert.ok(ticks < 200000, 'a travessia nao pode travar');

// ---- 4. Troops are ashore, on dry land, on the far island ----
// Only the ones who actually sailed. Half the garrison stays home by design, so
// checking every soldier the realm owns would count the home guard as a failed
// landing — which is what the first version of this test did.
const sailed = fleet.soldierIds;
const ashore = sailed
  .map(id => entitiesById.get(id)!)
  .filter(e => e && e.hp > 0 && !e.aboardFleetId);
console.log(`4. desembarcados: ${ashore.length} de ${sailed.length} embarcados` +
  `   (guarnicao que ficou em casa: ${invaders.length - sailed.length})`);
assert.ok(ashore.length > 0, 'alguem tem de desembarcar');

let onLand = 0, onEnemyIsland = 0;
for (const e of ashore) {
  const tile = map.getTile(Math.floor(e.x), Math.floor(e.y));
  if (tile && !TERRAINS[tile.type].isWater) onLand++;
  if (e.x > 40) onEnemyIsland++;
}
console.log(`   em tile de terra: ${onLand}/${ashore.length}   na ilha inimiga: ${onEnemyIsland}/${ashore.length}`);
assert.equal(onLand, ashore.length, 'ninguem pode acabar dentro d agua');
assert.equal(onEnemyIsland, ashore.length, 'o desembarque tem de ser na ilha alvo');

// ---- 5. And the land war can finally see them ----
const nearTarget = ashore.filter(e => Math.hypot(e.x - east.x, e.y - east.y) < 12).length;
console.log(`5. dentro do alcance de cerco de ${east.name}: ${nearTarget}`);
assert.ok(nearTarget > 0, 'a praia tem de ficar perto o bastante para o cerco comecar');

console.log('\nINVASAO NAVAL: um exercito atravessou agua que antes era intransponivel.');

// ============================================================
// SEA BATTLE: a landing that never reaches the beach
// ============================================================
{
  console.log('\n--- batalha naval ---');
  rng.setSeed(999);
  const map2 = twoIslands();
  const sim2 = new SimulationEngine();
  const fx = new ParticleManager();

  const a = new City('cA', 'Talassia', SpeciesType.HUMAN, 16, 32, 'F', 1);
  const b = new City('cB', 'Rubrica', SpeciesType.HUMAN, 46, 32, 'F', 1);
  sim2.cities.set(a.id, a); sim2.cities.set(b.id, b);
  const ka = new Kingdom('ka', 'Talassia', SpeciesType.HUMAN, '#38bdf8', a.id, 1);
  const kb = new Kingdom('kb', 'Rubrica', SpeciesType.HUMAN, '#ef4444', b.id, 1);
  a.kingdomId = ka.id; b.kingdomId = kb.id;
  sim2.kingdoms.set(ka.id, ka); sim2.kingdoms.set(kb.id, kb);
  ka.knownKingdoms.add(kb.id); kb.knownKingdoms.add(ka.id);
  a.stock.add('wood', 400); b.stock.add('wood', 400);

  // Both realms field an army, so both mount a landing at the other.
  for (const [city, king] of [[a, ka], [b, kb]] as const) {
    for (let i = 0; i < 20; i++) {
      const e = sim2.spawnEntity(SpeciesType.HUMAN, city.x + rng.range(-2, 2), city.y + rng.range(-2, 2), map2);
      e.cityId = city.id; e.kingdomId = king.id; e.profession = 'soldier';
    }
  }
  sim2.diplomacy.declareWar(ka.id, kb.id, 1, 'Disputa de Fronteira');
  sim2.invasions.tickYear(sim2.kingdoms, sim2.cities, sim2.entities, sim2.diplomacy, map2, 1);

  const fleets = [...sim2.invasions.fleets.values()];
  console.log(`frotas no mar: ${fleets.length}   (duas rotas opostas, mesma faixa de agua)`);
  assert.equal(fleets.length, 2, 'os dois reinos devem zarpar um contra o outro');

  const byId = new Map(sim2.entities.map(e => [e.id, e]));
  const aboardBefore = sim2.entities.filter(e => e.aboardFleetId).length;

  let engagedSeen = false;
  let t = 0;
  while (t < 200000 && sim2.invasions.fleets.size > 0) {
    sim2.invasions.update(sim2.cities, byId, sim2.diplomacy, map2, fx, 1);
    if ([...sim2.invasions.fleets.values()].some(f => f.state === 'engaged')) engagedSeen = true;
    t++;
  }

  const drowned = [...byId.values()].filter(e => e.hp <= 0).length;
  const landed = [...byId.values()].filter(e => e.hp > 0 && !e.aboardFleetId && e.profession === 'soldier').length;
  console.log(`travaram combate no mar: ${engagedSeen}`);
  console.log(`embarcados: ${aboardBefore}   afogados: ${drowned}   vivos em terra: ${landed}`);
  assert.ok(engagedSeen, 'duas frotas inimigas na mesma agua tem de se enfrentar');
  assert.ok(drowned > 0, 'perder no mar tem de matar quem estava a bordo');
  assert.equal(sim2.invasions.fleets.size, 0, 'nenhuma frota pode ficar presa no mar');
  assert.ok([...byId.values()].every(e => !e.aboardFleetId), 'ninguem pode ficar embarcado num fantasma');

  console.log('\nBATALHA NAVAL: uma invasao pode morrer antes de ver a praia.');
}
