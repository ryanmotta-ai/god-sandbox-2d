/**
 * Does a neglected town ever change flag on its own?
 *
 * Two scenarios, the rule called directly: a miserable frontier city beside a
 * prosperous neighbour should eventually defect, and a contented one should never.
 * The second matters as much as the first — a rule that pulls cities off a realm
 * that is governing well would be worse than no rule.
 */
import assert from 'node:assert/strict';
import { Kingdom } from '../src/civ/Kingdom';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { WorldMarket } from '../src/civ/Economy';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';

/**
 * A neglectful realm with a capital and a frontier town, next to a thriving one.
 *
 * `misery` drives the frontier town's condition and its owner's competence; the
 * neighbour is always prosperous. The rule is invoked directly — a full
 * `tickYear` would recount population from an empty entity list and abandon every
 * settlement before diplomacy ran.
 */
function scenario(misery: boolean) {
  const map = new TileMap(64, 64, 'single_continent', 5);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.height = 0.5;
  }

  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();

  const make = (id: string, name: string, x: number, y: number) => {
    const city = new City(id, name, SpeciesType.HUMAN, x, y, 'Fundador', 1);
    city.population = 30;
    cities.set(id, city);
    return city;
  };

  // The neglectful realm: a distant capital and an abandoned frontier town.
  const capital = make('c_cap', 'Capital', 8, 32);
  const frontier = make('c_front', 'Fronteira', 44, 32);
  const neglectful = new Kingdom('k_bad', 'Reino Distante', SpeciesType.HUMAN, '#777', capital.id, 1);
  neglectful.addCity(frontier.id);
  capital.kingdomId = 'k_bad';
  frontier.kingdomId = 'k_bad';
  kingdoms.set('k_bad', neglectful);

  // The thriving neighbour, close to the frontier town.
  const rich = make('c_rich', 'Metropole', 56, 32);
  const thriving = new Kingdom('k_good', 'Reino Próspero', SpeciesType.HUMAN, '#999', rich.id, 1);
  rich.kingdomId = 'k_good';
  kingdoms.set('k_good', thriving);

  rich.prosperity = 0.9;
  if (misery) {
    frontier.prosperity = 0.05;
    frontier.famineYears = 6;
    neglectful.legitimacy = 0.15;
    neglectful.administrativeReach = 0.2;
  } else {
    frontier.prosperity = 0.75;
    frontier.famineYears = 0;
    neglectful.legitimacy = 0.9;
    neglectful.administrativeReach = 0.95;
  }

  const engine = new CivilizationEngine();
  const world: any = {
    year: 1, cities, kingdoms, entities: [], tileMap: map,
    diplomacy: new DiplomacyManager(), market: new WorldMarket(),
    spawn: () => { throw new Error('nao usado'); }
  };

  const run = (years: number) => {
    for (let year = 1; year <= years; year++) {
      world.year = year;
      (engine as any).tickSoftPowerDefection(world);
      if (frontier.kingdomId !== 'k_bad') return year;
    }
    return null;
  };

  return { world, frontier, run };
}

// ------------------------------------------------- neglect loses the province
{
  const { frontier, run } = scenario(true);
  const defectedIn = run(400);

  assert.ok(defectedIn !== null, 'uma cidade faminta, indefesa e vizinha de metropole tem de acabar trocando de bandeira');
  assert.equal(frontier.kingdomId, 'k_good', 'e tem de ir para o vizinho proximo e prospero');
  console.log(`defection: fronteira negligenciada aclamou o vizinho no ano ${defectedIn}`);
}

// ------------------------------------------------ good government keeps it
{
  const { frontier, run } = scenario(false);
  const defectedIn = run(400);

  assert.equal(defectedIn, null, 'uma cidade prospera sob coroa legitima nao deve defectar nunca');
  assert.equal(frontier.kingdomId, 'k_bad', 'ela continua onde estava');
  console.log('defection: fronteira bem governada nao defecta em 400 anos, mesmo ao lado de uma metropole');
}

console.log('defection.test: passou');
