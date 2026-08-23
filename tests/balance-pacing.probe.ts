/**
 * Is the technology tree reachable?
 *
 * Research output is linear in population — `population * RESEARCH_PER_CITIZEN`
 * plus a little from buildings — while technology cost is geometric across eras:
 * a base cost that climbs from 30 to 2.100 multiplied by an era scale that climbs
 * from 1 to 11. This probe puts the two curves side by side and prints how many
 * simulated years each era actually takes for a realm of a given size.
 *
 * It is analytical rather than a simulation on purpose: the answer is a property
 * of the cost tables and the research formula, so it can be checked in
 * milliseconds and it cannot drift with world seed or luck.
 *
 * Run: npx tsx tests/balance-pacing.probe.ts
 */
import { TECHNOLOGIES, techCost, ResearchState, type TechEra } from '../src/civ/TechTree';

const ERAS: TechEra[] = ['stone', 'bronze', 'iron', 'classical', 'industrial', 'modern'];

/** Mirrors `CivilizationEngine.computeResearch`. */
const RESEARCH_PER_CITIZEN = 0.75;
function researchPerYear(population: number, prosperity: number, buildingResearch: number, techMultiplier: number): number {
  return (population * RESEARCH_PER_CITIZEN + buildingResearch) * (0.4 + prosperity * 0.6) * techMultiplier;
}

function eraCost(era: TechEra, cityCount: number): number {
  return Object.values(TECHNOLOGIES)
    .filter(tech => tech.era === era)
    .reduce((total, tech) => total + techCost(tech, cityCount), 0);
}

// ---------------------------------------------------------------- cost curve
console.log('\n=== custo da arvore, por era (reino de 3 cidades) ===');
console.table(ERAS.map(era => {
  const techs = Object.values(TECHNOLOGIES).filter(t => t.era === era);
  const total = eraCost(era, 3);
  return { era, techs: techs.length, custoMedio: Math.round(total / Math.max(1, techs.length)), custoDaEra: total };
}));

// ------------------------------------------------- research multiplier curve
// What the tech tree itself gives back, after `damped()` compresses it.
const reached = new ResearchState();
const multiplierAfter: Record<string, number> = {};
console.log('=== o que a arvore devolve em multiplicadores ===');
console.table(ERAS.map(era => {
  for (const tech of Object.values(TECHNOLOGIES)) if (tech.era === era) reached.complete(tech.id);
  const mods = reached.modifiers();
  multiplierAfter[era] = mods.research;
  return { aoCompletar: era, research: +mods.research.toFixed(2), production: +mods.production.toFixed(2), growth: +mods.growth.toFixed(2) };
}));

// ---------------------------------------------------------------- the verdict
const SCENARIOS = [
  { nome: 'vila 25 hab, sem biblioteca', pop: 25, prosperity: 0.5, buildings: 0, cities: 1 },
  { nome: 'cidade 80 hab, biblioteca', pop: 80, prosperity: 0.6, buildings: 10, cities: 2 },
  { nome: 'metropole 200 hab, academia', pop: 200, prosperity: 0.7, buildings: 30, cities: 3 },
  { nome: 'imperio 600 hab, 5 academias', pop: 600, prosperity: 0.75, buildings: 90, cities: 5 }
];

console.log('=== anos por era, contando o multiplicador ja conquistado ===');
const table = SCENARIOS.map(scenario => {
  const row: Record<string, string | number> = { cenario: scenario.nome };
  let carried = 1;
  let total = 0;
  for (const era of ERAS) {
    const years = eraCost(era, scenario.cities) / researchPerYear(scenario.pop, scenario.prosperity, scenario.buildings, carried);
    total += years;
    row[era] = Math.round(years);
    carried = multiplierAfter[era];
  }
  row.TOTAL = Math.round(total);
  return row;
});
console.table(table);

// ------------------------------------------------------- diffusion, the lever
// A follower in a world of N realms in contact pays less for what the pack has.
console.log('=== efeito da difusao: anos ate o moderno, para a cidade de 80 hab ===');
const follower = SCENARIOS[1];
console.table([0, 1, 2, 3, 5, 8].map(peers => {
  const discount = Math.min(0.6, peers * 0.12);
  let carried = 1;
  let total = 0;
  for (const era of ERAS) {
    const cost = Object.values(TECHNOLOGIES)
      .filter(t => t.era === era)
      .reduce((sum, t) => sum + techCost(t, follower.cities, discount), 0);
    total += cost / researchPerYear(follower.pop, follower.prosperity, follower.buildings, carried);
    carried = multiplierAfter[era];
  }
  return {
    vizinhosQueJaSabem: peers,
    desconto: Math.round(discount * 100) + '%',
    anosAteOModerno: Math.round(total)
  };
}));

// ------------------------------------------------------------ the two curves
const costGrowth = eraCost('modern', 3) / Math.max(1, eraCost('stone', 3) / 7) / 7;
console.log(`\ncusto medio por tecnologia, pedra -> moderno: x${Math.round(
  (eraCost('modern', 3) / 2) / (eraCost('stone', 3) / 7)
)}`);
console.log(`multiplicador de pesquisa maximo alcancavel:  x${multiplierAfter.modern.toFixed(2)}`);
console.log(
  'populacao medida numa sonda de 90 anos:        x15 (36 fundadores -> 549 habitantes)\n' +
  '\nOs tres numeros acima sao o desequilibrio: o custo cresce em ordens de grandeza,\n' +
  'e as duas coisas que pagam por ele — populacao e multiplicador — crescem em fatores.\n'
);
