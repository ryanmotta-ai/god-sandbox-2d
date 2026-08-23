/**
 * Does knowledge diffusion actually fire?
 *
 * The pacing arithmetic lives in `balance-pacing.probe.ts`. This answers the one
 * question arithmetic cannot: whether a realm in a running world ever *gets* the
 * discount, or whether it sits behind a `knownKingdoms` set that nothing fills.
 *
 * Written as a targeted test rather than a long simulation on purpose. The first
 * attempt at this was a 160-year run that had produced no output at all by the
 * time it was wanted — and it only printed at the end, so there was nothing to
 * salvage. Contact happens through territory adjacency, which can be set up
 * directly, so the answer costs milliseconds.
 */
import assert from 'node:assert/strict';
import { Kingdom } from '../src/civ/Kingdom';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { TECHNOLOGIES, techCost } from '../src/civ/TechTree';
import { CivilizationEngine } from '../src/civ/CivilizationEngine';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { WorldMarket } from '../src/civ/Economy';
import { TradeNetwork } from '../src/civ/Trade';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';

// ---------------------------------------------------------- the mechanism
{
  const alone = new Kingdom('k_alone', 'Solitário', SpeciesType.HUMAN, '#888', 'c1', 1);
  const learned = new Kingdom('k_learned', 'Sábio', SpeciesType.HUMAN, '#999', 'c2', 1);

  learned.research.complete('agriculture');
  learned.research.complete('pottery');

  // Nobody met: full price.
  alone.research.refreshDiffusion([]);
  assert.equal(alone.research.diffusionOf('agriculture'), 0, 'sem contato, sem desconto');
  assert.equal(
    alone.research.costOf(TECHNOLOGIES.agriculture, 1),
    techCost(TECHNOLOGIES.agriculture, 1),
    'sem contato o custo e o cheio'
  );

  // One peer who knows it.
  alone.research.refreshDiffusion([learned.research]);
  assert.equal(+alone.research.diffusionOf('agriculture').toFixed(2), 0.12, 'um vizinho = 12%');
  assert.ok(
    alone.research.costOf(TECHNOLOGIES.agriculture, 1) < techCost(TECHNOLOGIES.agriculture, 1),
    'o desconto tem de chegar ao custo'
  );

  // Six peers: the cap holds.
  const many = Array.from({ length: 6 }, () => learned.research);
  alone.research.refreshDiffusion(many);
  assert.equal(+alone.research.diffusionOf('agriculture').toFixed(2), 0.6, 'o teto e 60%');
  assert.equal(
    alone.research.costOf(TECHNOLOGIES.agriculture, 1),
    Math.round(techCost(TECHNOLOGIES.agriculture, 1) * 0.4),
    'no teto se paga 40% do cheio'
  );

  // What a realm already knows is not discounted for it.
  learned.research.refreshDiffusion([alone.research]);
  assert.equal(learned.research.diffusionOf('pottery'), 0, 'nao se desconta o que ja se sabe');

  console.log('tech-diffusion: o mecanismo desconta, respeita o teto e ignora o que ja se sabe');
}

// ------------------------------------------------- contact, in a real engine
{
  const map = new TileMap(48, 48, 'single_continent', 7);
  for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
    const tile = map.getTile(x, y)!;
    tile.type = TerrainType.GRASS;
    tile.height = 0.5;
    tile.fertility = 1;
  }

  const engine = new CivilizationEngine();
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();

  // Two realms, six tiles apart. Left deliberately as bare settlements: giving
  // them hand-placed territory but no citizens gets them abandoned for zero
  // population before diplomacy runs, which is a property of the settlement
  // lifecycle and not of what is being tested here.
  for (const [id, name, cx] of [['k_a', 'Alfa', 18], ['k_b', 'Beta', 24]] as [string, string, number][]) {
    const city = new City(`c_${id}`, name, SpeciesType.HUMAN, cx, 24, 'Fundador', 1);
    city.population = 30;
    const kingdom = new Kingdom(id, name, SpeciesType.HUMAN, '#777', city.id, 1);
    kingdom.addCity(city.id);
    city.kingdomId = id;
    kingdoms.set(id, kingdom);
    cities.set(city.id, city);
  }

  // One of them is ahead.
  const ahead = kingdoms.get('k_a')!;
  for (const id of ['agriculture', 'pottery', 'mining']) ahead.research.complete(id);
  const behind = kingdoms.get('k_b')!;

  const world: any = {
    year: 1, cities, kingdoms, entities: [], tileMap: map,
    diplomacy: new DiplomacyManager(), market: new WorldMarket(), trade: new TradeNetwork(),
    spawn: () => { throw new Error('nao usado'); }
  };

  // Year one makes contact; year two is the first research tick that can see it.
  world.year = 1; engine.tickYear(world);
  assert.ok(behind.knownKingdoms.has('k_a'), 'o contato tem de acontecer no primeiro ano');

  world.year = 2; engine.tickYear(world);
  assert.ok(
    behind.research.diffusion.size > 0,
    'apos o contato a difusao tem de estar populada — se falhar aqui, ela existe no papel e nao no jogo'
  );

  const discounted = behind.research.costOf(TECHNOLOGIES.agriculture, 1);
  const full = techCost(TECHNOLOGIES.agriculture, 1);
  assert.ok(discounted < full, `o vizinho adiantado tem de baratear a tecnologia (${discounted} vs ${full})`);
  assert.equal(discounted, Math.round(full * 0.88), 'um unico vizinho vale exatamente 12%');

  // And the realm that is ahead gains nothing from the one behind.
  assert.equal(ahead.research.diffusionOf('agriculture'), 0, 'quem ja sabe nao ganha desconto');

  console.log(
    `tech-diffusion: contato no ano 1 · difusao ativa em ${behind.research.diffusion.size} tecnologias · ` +
    `agricultura ${full} -> ${discounted}`
  );
}

console.log('tech-diffusion.test: passou');
