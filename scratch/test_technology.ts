/**
 * Phase J checks: technology transforming the existing systems.
 *
 * The claim under test is that importance *emerges* from what realms have
 * learned to do, and that knowing a technology is not the same as being able
 * to use it.
 */
import { TileMap } from '../src/world/TileMap';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { SimulationEngine, TICKS_PER_YEAR } from '../src/ai/EntityAI';
import { ParticleManager } from '../src/renderer/Particles';
import {
  ResearchState,
  strategicWeight,
  strategicGoodsFor,
  isStrategicNow,
  technologyCapacity,
  operatingEra
} from '../src/civ/TechTree';
import { EQUIPMENT_COST, EQUIPMENT_TECH, EQUIPMENT_TIERS_BY_RANK, WEAPON_TIERS } from '../src/entities/Equipment';
import type { GoodId } from '../src/civ/Goods';
import type { BuildingType } from '../src/civ/Building';

let failures = 0;
function check(name: string, pass: boolean, detail: string = ''): void {
  if (pass) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('=== PHASE J: TECHNOLOGY CHECKS ===\n');

// ---------- 1. Oil is worthless until somebody invents an engine ----------
{
  const stoneAge = new ResearchState();
  check('oil means nothing to a stone-age realm', strategicWeight(stoneAge, 'oil') === 0,
    `${strategicWeight(stoneAge, 'oil')}`);
  check('uranium means nothing to a stone-age realm', strategicWeight(stoneAge, 'uranium') === 0);

  const industrial = new ResearchState();
  industrial.complete('industrialization');
  check('industrialisation makes oil matter', strategicWeight(industrial, 'oil') > 0,
    `${strategicWeight(industrial, 'oil')}`);

  const modern = new ResearchState();
  modern.complete('electricity');
  check('electricity is what finally makes uranium matter', strategicWeight(modern, 'uranium') > 0,
    `${strategicWeight(modern, 'uranium')}`);
}

// ---------- 2. Coal's importance grows with the tech that burns it ----------
{
  const bronze = new ResearchState();
  bronze.complete('bronze_working');
  const metal = new ResearchState();
  metal.complete('metallurgy');
  const steam = new ResearchState();
  steam.complete('metallurgy');
  steam.complete('steam_power');

  const wBronze = strategicWeight(bronze, 'coal');
  const wMetal = strategicWeight(metal, 'coal');
  const wSteam = strategicWeight(steam, 'coal');

  check('bronze working gives no reason to want coal', wBronze === 0, `${wBronze}`);
  check('metallurgy makes coal matter', wMetal > 0, `${wMetal}`);
  check('steam power makes coal matter far more', wSteam > wMetal, `${wMetal} -> ${wSteam}`);
}

// ---------- 3. Bronze working is what makes tin strategic ----------
{
  const before = new ResearchState();
  const after = new ResearchState();
  after.complete('bronze_working');

  check('tin is just a rock before bronze working', strategicWeight(before, 'tin') === 0);
  check('bronze working makes tin strategic', strategicWeight(after, 'tin') > 0);
  check('tin outranks copper in the bronze recipe', strategicWeight(after, 'tin') > strategicWeight(after, 'copper'),
    `tin ${strategicWeight(after, 'tin')} vs copper ${strategicWeight(after, 'copper')}`);

  const worldNoBronze = [new ResearchState()];
  const worldBronze = [after];
  check('a world with no bronze working has no strategic tin', !isStrategicNow(worldNoBronze, 'tin'));
  check('one realm inventing bronze makes tin strategic in the world', isStrategicNow(worldBronze, 'tin'));
}

// ---------- 4. Strategic goods are ranked by real demand weight ----------
{
  const r = new ResearchState();
  r.complete('industrialization');
  const ranked = strategicGoodsFor(r);
  check('industrialisation produces a ranked strategic shopping list', ranked.length > 0, `${ranked.length}`);
  check('the list is sorted strongest first',
    ranked.every((g, i) => i === 0 || ranked[i - 1].weight >= g.weight),
    ranked.map(g => `${g.good}:${g.weight}`).join(' '));
}

// ---------- 5. Technology ≠ capacity ----------
{
  const r = new ResearchState();
  r.complete('mining');            // unlocks mine + quarry, wants nothing
  r.complete('industrialization'); // unlocks factory/refinery, wants coal/oil/rubber/steel

  // A realm that knows everything and has nothing.
  const barren = technologyCapacity(r, () => false, () => false);
  const industrialBarren = barren.find(c => c.techId === 'industrialization')!;
  check('a realm with nothing cannot operate what it knows', industrialBarren.capacity === 0,
    `${industrialBarren.capacity}`);
  check('and it can say exactly what it is missing',
    industrialBarren.missingGoods.length > 0 && industrialBarren.missingBuildings.length > 0,
    `goods=${industrialBarren.missingGoods} buildings=${industrialBarren.missingBuildings}`);

  // A realm that has it all.
  const equipped = technologyCapacity(r, () => true, () => true);
  const industrialEquipped = equipped.find(c => c.techId === 'industrialization')!;
  check('a fully supplied realm operates its technology completely', industrialEquipped.capacity === 1,
    `${industrialEquipped.capacity}`);

  // Era must reflect what can be operated, not what was read about.
  check('an unusable industrial tree does not make you an industrial power',
    operatingEra(r, barren) !== 'industrial',
    operatingEra(r, barren));
  check('a supplied industrial tree does make you an industrial power',
    operatingEra(r, equipped) === 'industrial',
    operatingEra(r, equipped));
}

// ---------- 6. Partial capacity is measured, not rounded away ----------
{
  const r = new ResearchState();
  r.complete('industrialization');
  // Has the buildings, lacks every material.
  const halfway = technologyCapacity(r, () => true, () => false);
  const cap = halfway.find(c => c.techId === 'industrialization')!.capacity;
  check('a realm with plants but no materials is partly capable', cap > 0 && cap < 1, `${cap}`);
}

// ---------- 7. Military technology is gated by real production ----------
{
  // Every tier above primitive must cost something real.
  for (const tier of EQUIPMENT_TIERS_BY_RANK) {
    if (tier === 'primitive') continue;
    const cost = EQUIPMENT_COST[tier] ?? {};
    check(`the ${tier} tier costs real materials`, Object.keys(cost).length > 0, JSON.stringify(cost));
  }
  check('gunpowder weapons need gunpowder', 'gunpowder' in (EQUIPMENT_COST.gunpowder ?? {}));
  check('industrial weapons need machinery', 'machinery' in (EQUIPMENT_COST.industrial ?? {}));
  check('every non-primitive tier is gated by a technology',
    EQUIPMENT_TIERS_BY_RANK.filter(t => t !== 'primitive').every(t => EQUIPMENT_TECH[t] !== null));
  check('firearms exist as real equipment once gunpowder is known',
    (WEAPON_TIERS.gunpowder ?? []).length > 0);
}

// ---------- 8. Live: knowing gunpowder does not arm anybody by itself ----------
{
  const map = new TileMap(40, 40, 'single_continent', 4242);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  const soldier = sim.spawnEntity(SpeciesType.STONEKIN, 20, 20, map, 'male');
  const kingdom = new Kingdom('kw', 'Warland', SpeciesType.STONEKIN, '#f87171', 'cw', 1);
  const city = new City('cw', 'Armoury', SpeciesType.STONEKIN, 20, 20, 'Founder', 1);
  sim.kingdoms.set('kw', kingdom);
  sim.cities.set('cw', city);
  soldier.kingdomId = 'kw';
  soldier.cityId = 'cw';
  soldier.profession = 'soldier';

  // Knows every weapon technology, owns nothing to build them with.
  for (const t of ['iron_working', 'metallurgy', 'gunpowder', 'industrialization']) kingdom.research.complete(t);
  for (const g of ['iron', 'steel', 'tools', 'gunpowder', 'machinery'] as GoodId[]) city.stock.set(g, 0);

  // Soldiers are equipped on the yearly armoury pass, so advance a full year.
  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(map, particles);
  const bare = soldier.equipment.weapon;
  check('a realm that knows rifles but makes nothing fields primitive arms',
    !!bare && (WEAPON_TIERS.primitive ?? []).some(w => w.name === bare.name),
    bare?.name ?? 'unarmed');

  // Now stock a real arsenal and arm a fresh recruit.
  const recruit = sim.spawnEntity(SpeciesType.STONEKIN, 20, 21, map, 'male');
  recruit.kingdomId = 'kw';
  recruit.cityId = 'cw';
  recruit.profession = 'soldier';
  for (const g of ['iron', 'steel', 'tools', 'gunpowder', 'machinery'] as GoodId[]) city.stock.set(g, 50);
  const steelBefore = city.stock.get('steel');

  for (let t = 0; t < TICKS_PER_YEAR; t++) sim.tickAI(map, particles);
  const armed = recruit.equipment.weapon;
  check('the same realm with a real arsenal fields industrial arms',
    !!armed && (WEAPON_TIERS.industrial ?? []).some(w => w.name === armed.name),
    armed?.name ?? 'unarmed');
  check('arming a soldier physically consumed materials', city.stock.get('steel') < steelBefore,
    `${steelBefore} -> ${city.stock.get('steel')}`);
}

// ---------- 9. Live: technology creates real market demand ----------
{
  const map = new TileMap(60, 60, 'single_continent', 777);
  const sim = new SimulationEngine();
  const particles = new ParticleManager();

  for (let k = 0; k < 8; k++) {
    const e = sim.spawnEntity(SpeciesType.LUMINI, 25 + (k % 3), 25 + Math.floor(k / 3), map, k % 2 === 0 ? 'male' : 'female');
    e.dynasty = 'Tech';
  }
  sim.totalBirths = 0;
  for (let t = 0; t < TICKS_PER_YEAR * 4; t++) sim.tickAI(map, particles);

  const kingdom = [...sim.kingdoms.values()][0];
  if (kingdom) {
    const before = kingdom.strategicDemand.get('coal') ?? 0;
    kingdom.research.complete('metallurgy');
    kingdom.research.complete('steam_power');
    for (let t = 0; t < TICKS_PER_YEAR * 2; t++) sim.tickAI(map, particles);
    const after = kingdom.strategicDemand.get('coal') ?? 0;
    check('inventing steam power creates real demand for coal', after > before, `${before} -> ${after}`);
    check('the realm reports what it can actually operate',
      kingdom.techCapabilities.length > 0 && kingdom.operatingEra !== undefined,
      `${kingdom.techCapabilities.length} caps, era ${kingdom.operatingEra}`);
    check('a realm with no mines cannot operate steam power fully',
      kingdom.technologicalCapacity() < 1, `${kingdom.technologicalCapacity().toFixed(2)}`);
  } else {
    check('a kingdom formed for the demand test', false, 'no kingdom');
  }
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;

// Keep the BuildingType import meaningful for the capacity signature.
export type _Unused = BuildingType;
