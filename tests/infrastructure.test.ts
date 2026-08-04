import { strict as assert } from 'node:assert';
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { TERRAINS } from '../src/world/Biomes';
import { rng } from '../src/core/Random';
import {
  roadCapacityFactor,
  avgEffectiveRoadLevel,
  portCapacityFactor,
  portOperational,
  damageRoadsAround,
  damageStrategicBuildings,
  damagePrimaryRoads,
  repairInfrastructure
} from '../src/civ/Infrastructure';

rng.setSeed(20260802);

function makeMap(size = 12): TileMap {
  return new TileMap(size, size, 'single_continent', 42);
}

function landTile(tileMap: TileMap): { x: number; y: number } {
  for (let y = 2; y < tileMap.height - 2; y++) {
    for (let x = 2; x < tileMap.width - 2; x++) {
      const t = tileMap.getTile(x, y)!;
      if (!TERRAINS[t.type].isWater) return { x, y };
    }
  }
  return { x: 3, y: 3 };
}

function makeCity(tileMap: TileMap, id: string, name: string, seed: number): City {
  const pos = landTile(tileMap);
  const city = new City(id, name, SpeciesType.LUMINI, pos.x, pos.y, 'Founder', 1);
  city.kingdomId = `k_${seed}`;
  return city;
}

// ============================================================
// 1. Better roads carry more; damage cuts the flow
// ============================================================
{
  const tileMap = makeMap();
  const path = [{ x: 3.2, y: 3.2 }, { x: 4.5, y: 3.5 }, { x: 6.0, y: 4.0 }];
  for (const p of path) {
    const t = tileMap.getTile(Math.floor(p.x), Math.floor(p.y))!;
    t.roadLevel = 0;
    t.roadDamage = 0;
  }
  const dirt = roadCapacityFactor(path, tileMap);
  assert.ok(dirt >= 0.4 && dirt < 0.8, `dirt road should carry ~0.4-0.8, got ${dirt}`);

  for (const p of path) {
    const t = tileMap.getTile(Math.floor(p.x), Math.floor(p.y))!;
    t.roadLevel = 3;
  }
  const imperial = roadCapacityFactor(path, tileMap);
  assert.ok(imperial > dirt, `imperial road must out-carry dirt (${imperial} vs ${dirt})`);
  assert.ok(imperial > 1.0, `imperial road should carry >1.0x, got ${imperial}`);

  // War damage: fully ruined road collapses toward the dirt-track floor.
  for (const p of path) {
    const t = tileMap.getTile(Math.floor(p.x), Math.floor(p.y))!;
    t.roadDamage = 1;
  }
  const ruined = roadCapacityFactor(path, tileMap);
  assert.ok(ruined < imperial * 0.6, `ruined road must carry far less than a healthy imperial (${ruined} vs ${imperial})`);

  const effAvg = avgEffectiveRoadLevel(path, tileMap);
  assert.ok(effAvg < 0.5, `avg effective level of a ruined imperial road should be ~0, got ${effAvg}`);
}

// ============================================================
// 2. Movement speed feels the damage (Tile.getter)
// ============================================================
{
  const tileMap = makeMap();
  const tile = tileMap.getTile(4, 4)!;
  tile.roadLevel = 2;
  tile.roadDamage = 0;
  assert.equal(tile.roadLevelEffective, 2, 'healthy stone road stays level 2');
  tile.roadDamage = 0.5;
  assert.equal(tile.roadLevelEffective, 1, 'half-damaged stone road rides as dirt');
  tile.roadDamage = 1;
  assert.equal(tile.roadLevelEffective, 0, 'destroyed road is impassable by bonus');
}

// ============================================================
// 3. A destroyed port interrupts maritime trade
// ============================================================
{
  const tileMap = makeMap();
  const from = makeCity(tileMap, 'A', 'Alpha', 1);
  const to = makeCity(tileMap, 'B', 'Beta', 2);
  const harborFrom = from.addBuilding('harbor', from.x, from.y);
  const harborTo = to.addBuilding('harbor', to.x, to.y);

  const healthy = portCapacityFactor(from, to);
  assert.ok(healthy > 0, 'healthy harbors must allow maritime trade');
  assert.ok(portOperational(from) && portOperational(to), 'healthy harbors are operational');

  // A storm of war knocks both ports out.
  harborFrom.hp = 1;
  harborTo.hp = 1;
  assert.ok(!portOperational(from), 'ruined harbor is not operational');
  assert.equal(portCapacityFactor(from, to), 0, 'both ports destroyed => maritime trade collapses to zero');

  // One working port still moves cargo, but at reduced throughput.
  harborFrom.hp = harborFrom.maxHp;
  const onePort = portCapacityFactor(from, to);
  assert.ok(onePort > 0 && onePort < healthy, 'single destroyed port halves the route');
}

// ============================================================
// 4. War damages roads; repairs spend materials and heal
// ============================================================
{
  const tileMap = makeMap();
  const city = makeCity(tileMap, 'C', 'Coastal', 3);
  city.territory.add('4,4');
  const roadTile = tileMap.getTile(4, 4)!;
  roadTile.roadLevel = 2;
  roadTile.roadDamage = 0;

  damageRoadsAround(tileMap, 4, 4, 2);
  assert.ok(roadTile.roadDamage > 0, 'roads near a siege take damage');
  const damageBefore = roadTile.roadDamage;

  // Repair costs real materials out of the stockpile.
  const stoneBefore = city.stock.get('stone');
  const woodBefore = city.stock.get('wood');
  const stone = city.stock.get('stone'), wood = city.stock.get('wood');
  if (stone > 0 || wood > 0) {
    repairInfrastructure(city, tileMap);
    assert.ok(roadTile.roadDamage < damageBefore, 'repair reduces road damage');
    assert.ok(city.stock.get('stone') < stoneBefore || city.stock.get('wood') < woodBefore,
      'repair must consume materials from the stockpile');
  }
}

// ============================================================
// 5. A besieger targets the economic arteries first
// ============================================================
{
  const tileMap = makeMap();
  const city = makeCity(tileMap, 'D', 'Port City', 4);
  const harbor = city.addBuilding('harbor', city.x, city.y);
  city.addBuilding('house', city.x + 1, city.y);
  const hpBefore = harbor.hp;

  damageStrategicBuildings(city);
  assert.ok(harbor.hp < hpBefore, 'strategic buildings (harbors) take siege damage before the rest');

  // The main haulage road into the city is hit hardest.
  const main = tileMap.getTile(city.x + 1, city.y + 1)!;
  main.roadLevel = 3;
  main.roadDamage = 0;
  damagePrimaryRoads(tileMap, city.x, city.y, 4);
  assert.ok(main.roadDamage > 0, 'the primary road is deliberately broken');
}

// ============================================================
// 6. Buildings damaged in war are repaired with materials
// ============================================================
{
  const tileMap = makeMap();
  const city = makeCity(tileMap, 'E', 'Recovery', 5);
  const harbor = city.addBuilding('harbor', city.x, city.y);
  harbor.hp = Math.round(harbor.maxHp * 0.5);
  city.stock.add('stone', 200);
  city.stock.add('wood', 100);
  const stoneBefore = city.stock.get('stone');

  repairInfrastructure(city, tileMap);
  assert.ok(harbor.hp > harbor.maxHp * 0.5, 'repair heals the harbor');
  assert.ok(city.stock.get('stone') < stoneBefore, 'repair consumed stone');
  assert.equal(harbor.hp <= harbor.maxHp, true, 'repair never overheals');
}

console.log('infrastructure.test: all assertions passed');
