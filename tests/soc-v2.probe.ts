/**
 * SOC-V2 observation probe.
 *
 * Not an assertion suite — `soc-v2.smoke.ts` is that. This drops the same
 * citizens into prosperity, unemployment, danger and an open frontier and prints
 * what each of them decides and why, which is the only way to check the thing
 * SOC-V2 was actually asked for: a hundred people in one situation must not
 * produce one answer, and the differences have to be traceable to the person.
 *
 *   npx tsx tests/soc-v2.probe.ts
 */
import { SimulationEngine } from '../src/ai/EntityAI';
import { SpeciesType } from '../src/entities/Species';
import { TerrainType } from '../src/world/Biomes';
import { TileMap } from '../src/world/TileMap';
import { rng } from '../src/core/Random';
import { migrationUrge, standGroundChance, describePsyche, remember, type LifeSituation } from '../src/entities/Psyche';
import type { Entity } from '../src/entities/Entity';

rng.setSeed(20260809);

const map = new TileMap(64, 64, 'single_continent', 4242);
for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
  const tile = map.getTile(x, y)!;
  tile.type = TerrainType.GRASS;
  tile.fertility = 1;
}
map.updateRegionStates(32, 32);

const sim = new SimulationEngine();
const people: Entity[] = [];
for (let i = 0; i < 100; i++) {
  const citizen = sim.spawnEntity(SpeciesType.HUMAN, 20 + (i % 10) * 0.4, 20 + Math.floor(i / 10) * 0.4, map);
  citizen.age = 18 + (i % 45);
  people.push(citizen);
}

// A quarter of them carry something from before, so history is visible as a
// separate cause from disposition.
people.forEach((e, i) => {
  if (i % 4 === 0) remember(e.memories, 'lost_home', 1, 0.7);
  if (i % 7 === 0) remember(e.memories, 'bereavement', 1, 0.6);
});

const SCENARIOS: Record<string, (e: Entity) => LifeSituation> = {
  'prosperidade': e => ({
    wellbeing: 0.8, jobless: 0, hunger: 15, danger: 0,
    familyTies: 0.6, opportunityElsewhere: 0.2, trauma: e.trauma, age: e.age
  }),
  'desemprego': e => ({
    wellbeing: 0.5, jobless: 1, hunger: 35, danger: 0,
    familyTies: 0.4, opportunityElsewhere: 0.45, trauma: e.trauma, age: e.age
  }),
  'perigo (guerra)': e => ({
    wellbeing: 0.4, jobless: 0, hunger: 30, danger: 0.75,
    familyTies: 0.5, opportunityElsewhere: 0.3, trauma: e.trauma, age: e.age
  }),
  'fome + fronteira aberta': e => ({
    wellbeing: 0.35, jobless: 1, hunger: 65, danger: 0.1,
    familyTies: 0.2, opportunityElsewhere: 0.7, trauma: e.trauma, age: e.age
  })
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

for (const [name, build] of Object.entries(SCENARIOS)) {
  const urges = people.map(e => ({ e, urge: migrationUrge(e.psyche, build(e)) }));
  const leaving = urges.filter(u => u.urge > 0.5);
  const mean = urges.reduce((s, u) => s + u.urge, 0) / urges.length;
  const min = Math.min(...urges.map(u => u.urge));
  const max = Math.max(...urges.map(u => u.urge));

  console.log(`\n=== ${name.toUpperCase()} ===`);
  console.log(`  partem ${leaving.length}/100 · vontade média ${mean.toFixed(2)} · faixa ${min.toFixed(2)}–${max.toFixed(2)}`);

  const sorted = [...urges].sort((a, b) => b.urge - a.urge);
  const show = (label: string, entry: { e: Entity; urge: number }) => {
    const p = entry.e.psyche;
    console.log(
      `  ${label} ${entry.e.name.padEnd(11)} vontade ${entry.urge.toFixed(2)}  ` +
      `${describePsyche(p).padEnd(24)} idade ${String(entry.e.age).padStart(2)}  ` +
      `amb ${pct(p.ambition).padStart(4)} leal ${pct(p.loyalty).padStart(4)} risco ${pct(p.riskTolerance).padStart(4)}  ` +
      `trauma ${entry.e.trauma.toFixed(2)}`
    );
  };
  show('parte  ', sorted[0]);
  show('parte  ', sorted[1]);
  show('fica   ', sorted[sorted.length - 2]);
  show('fica   ', sorted[sorted.length - 1]);
}

// Who stands and who runs when the enemy is in the street.
console.log('\n=== INIMIGO NA RUA (2 contra 1, desarmado, família por perto) ===');
const stands = people.map(e => ({
  e,
  chance: standGroundChance(e.psyche, {
    outnumbered: 2, armed: false, protectingFamily: true, trauma: e.trauma, isFighter: false
  })
}));
const fighters = stands.filter(s => s.chance > 0.5).length;
console.log(`  enfrentam ${fighters}/100 · faixa ${Math.min(...stands.map(s => s.chance)).toFixed(2)}–${Math.max(...stands.map(s => s.chance)).toFixed(2)}`);
for (const s of [...stands].sort((a, b) => b.chance - a.chance).slice(0, 2)) {
  console.log(`  enfrenta ${s.e.name.padEnd(11)} ${s.chance.toFixed(2)}  cor ${pct(s.e.psyche.courage)} agr ${pct(s.e.psyche.aggression)} trauma ${s.e.trauma.toFixed(2)}`);
}
for (const s of [...stands].sort((a, b) => a.chance - b.chance).slice(0, 2)) {
  console.log(`  foge     ${s.e.name.padEnd(11)} ${s.chance.toFixed(2)}  cor ${pct(s.e.psyche.courage)} agr ${pct(s.e.psyche.aggression)} trauma ${s.e.trauma.toFixed(2)}`);
}

// The four archetypes SOC-V2 was specified against, side by side.
console.log('\n=== OS QUATRO CASOS DO BRIEFING (mesma crise) ===');
const crisis = { wellbeing: 0.38, jobless: 0, hunger: 55, danger: 0.6, opportunityElsewhere: 0.5 };
const cases: [string, LifeSituation, { ambition: number; loyalty: number; riskTolerance: number; curiosity: number; courage: number }][] = [
  ['A: família + emprego + leal', { ...crisis, jobless: 0, familyTies: 0.9, trauma: 0, age: 38 },
    { ambition: 0.3, loyalty: 0.9, riskTolerance: 0.4, curiosity: 0.3, courage: 0.5 }],
  ['B: jovem, sem vínculo, ambiciosa', { ...crisis, jobless: 1, familyTies: 0, trauma: 0, age: 22 },
    { ambition: 0.9, loyalty: 0.2, riskTolerance: 0.8, curiosity: 0.85, courage: 0.5 }],
  ['C: perdeu casa, avessa a risco', { ...crisis, jobless: 0, familyTies: 0.4, trauma: 0.55, age: 45 },
    { ambition: 0.4, loyalty: 0.5, riskTolerance: 0.08, curiosity: 0.3, courage: 0.3 }],
  ['D: família local, corajoso', { ...crisis, jobless: 0, familyTies: 0.85, trauma: 0.1, age: 34 },
    { ambition: 0.4, loyalty: 0.7, riskTolerance: 0.6, curiosity: 0.4, courage: 0.95 }]
];
for (const [label, situation, traits] of cases) {
  const psyche = { sociability: 0.5, aggression: 0.4, ...traits };
  const urge = migrationUrge(psyche, situation);
  const stand = standGroundChance(psyche, {
    outnumbered: 1, armed: false, protectingFamily: situation.familyTies > 0.5, trauma: situation.trauma, isFighter: false
  });
  console.log(`  ${label.padEnd(34)} vontade de partir ${urge.toFixed(2)} (${urge > 0.5 ? 'PARTE' : 'fica '})  enfrenta ${pct(stand).padStart(4)}`);
}
console.log();
