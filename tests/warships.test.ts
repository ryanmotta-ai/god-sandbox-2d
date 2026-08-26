/**
 * The fighting navy: does the catalogue answer itself?
 *
 * A ship list is only interesting if the classes beat each other. The one that
 * matters most is the submarine: invisible until something finds it, and the
 * most fragile hull in the water once found. If a destroyer screen does not
 * reliably beat a wolfpack that a battleship line loses to, then `detection` is
 * decoration and the whole catalogue collapses back into "bigger number wins".
 *
 * Run: npx tsx tests/warships.test.ts
 */
import assert from 'node:assert/strict';
import {
  WARSHIPS, ALL_WARSHIPS, fleetStats, availableWarships, bestAvailable,
  assembleFleet, flagshipOf, describeFleet, type FleetComposition
} from '../src/civ/Warships';
import { TECHNOLOGIES, ERA_ORDER } from '../src/civ/TechTree';
import { BUILDINGS } from '../src/civ/Building';
import { Kingdom } from '../src/civ/Kingdom';
import { City } from '../src/civ/City';
import { SpeciesType } from '../src/entities/Species';
import { rng } from '../src/core/Random';

// ---- 1. Catalogue integrity ----
{
  console.log('1. integridade do catalogo');
  const ids = new Set<string>();
  for (const ship of ALL_WARSHIPS) {
    assert.ok(!ids.has(ship.id), `id duplicado: ${ship.id}`);
    ids.add(ship.id);
    assert.equal(WARSHIPS[ship.id].id, ship.id, `${ship.id} nao bate com sua chave`);
    // Every gate has to point at a technology that exists, or the class is
    // unbuildable for ever and nobody would notice.
    if (ship.requiresTech) {
      assert.ok(TECHNOLOGIES[ship.requiresTech], `${ship.id} exige tech inexistente: ${ship.requiresTech}`);
    }
    assert.ok(ship.hull > 0 && ship.speed > 0, `${ship.id} sem casco ou sem velocidade`);
    assert.ok(Object.keys(ship.cost).length > 0, `${ship.id} nao custa nada`);
    if (ship.role === 'transport') assert.ok(ship.berths > 0, `${ship.id} e transporte e nao leva ninguem`);
    if (ship.role === 'submarine') assert.ok(ship.stealth > 0.5, `${ship.id} e submarino e nao e furtivo`);
  }
  const roles = new Set(ALL_WARSHIPS.map(s => s.role));
  console.log(`   ${ALL_WARSHIPS.length} classes, ${roles.size} papeis: ${[...roles].join(', ')}`);
  assert.equal(ALL_WARSHIPS.length, 17);
  assert.ok(roles.has('submarine') && roles.has('escort') && roles.has('line') && roles.has('transport'));

  // The building the rated classes are gated on has to exist.
  assert.ok(BUILDINGS['naval_yard'], 'o estaleiro naval precisa existir');
  assert.ok(BUILDINGS['naval_yard'].requiresCoast, 'estaleiro tem de ser costeiro');
  console.log(`   estaleiro: ${BUILDINGS['naval_yard'].name}, custo ${JSON.stringify(BUILDINGS['naval_yard'].cost)}`);
}

// ---- 2. Technology and yard actually gate the ladder ----
{
  console.log('\n2. o que cada era consegue por na agua');
  const stoneAge = new Kingdom('k1', 'Pedra', SpeciesType.HUMAN, '#fff', 'c', 1);
  const noYard = availableWarships(stoneAge, false);
  console.log(`   idade da pedra, sem estaleiro: ${noYard.map(s => s.name).join(', ') || 'nada'}`);
  assert.ok(noYard.every(s => !s.requiresYard), 'sem estaleiro nao pode sair classe registrada');
  assert.ok(!noYard.some(s => s.id === 'submarine'));

  const modern = new Kingdom('k2', 'Moderna', SpeciesType.HUMAN, '#fff', 'c', 1);
  // The last age carries everything.
  for (let i = 0; i < ERA_ORDER.length; i++) modern.research.forceAdvance();

  const modernNoYard = availableWarships(modern, false);
  const modernYard = availableWarships(modern, true);
  console.log(`   moderna SEM estaleiro: ${modernNoYard.length} classes`);
  console.log(`   moderna COM estaleiro: ${modernYard.length} classes`);
  assert.ok(modernYard.length > modernNoYard.length, 'o estaleiro tem de destravar algo');
  assert.ok(!modernNoYard.some(s => s.id === 'submarine'), 'submarino sem estaleiro nao existe');
  assert.ok(modernYard.some(s => s.id === 'submarine'), 'com tudo pesquisado e estaleiro, submarino existe');
  assert.ok(modernYard.some(s => s.id === 'destroyer'));
  assert.ok(modernYard.some(s => s.id === 'battleship'));

  console.log(`   melhor de linha: ${bestAvailable('line', modernYard)?.name}`);
  console.log(`   melhor escolta:  ${bestAvailable('escort', modernYard)?.name}`);
  console.log(`   melhor transporte: ${bestAvailable('transport', modernYard)?.name}`);
  assert.equal(bestAvailable('line', modernYard)?.id, 'battleship');
  assert.equal(bestAvailable('escort', modernYard)?.id, 'destroyer');
}

// ---- 3. A fleet is only as fast as its slowest hull ----
{
  const mixed: FleetComposition = { destroyer: 2, ship_of_the_line: 1 };
  const stats = fleetStats(mixed);
  console.log(`\n3. esquadra mista: ${describeFleet(mixed)}`);
  console.log(`   velocidade: ${stats.speed} (contratorpedeiro sozinho: ${WARSHIPS.destroyer.speed})`);
  assert.equal(stats.speed, WARSHIPS.ship_of_the_line.speed, 'a esquadra anda no passo do mais lento');
  assert.equal(flagshipOf(mixed)?.id, 'ship_of_the_line', 'a capitania e o casco mais pesado');
}

// ---- 4. Detection saturates instead of exceeding certainty ----
{
  console.log('\n4. deteccao com N contratorpedeiros');
  let previous = -1;
  for (const n of [0, 1, 2, 4, 8, 16]) {
    const d = fleetStats({ destroyer: n }).detection;
    console.log(`   ${String(n).padStart(2)} contratorpedeiros -> ${(d * 100).toFixed(1)}% por salva`);
    assert.ok(d >= previous, 'mais escolta nunca pode detectar menos');
    assert.ok(d < 1, 'a deteccao nunca pode virar certeza');
    previous = d;
  }
  assert.ok(fleetStats({ destroyer: 4 }).detection > fleetStats({ battleship: 4 }).detection,
    'contratorpedeiro tem de enxergar melhor que encouracado');
}

// ---- 5. Submerged only while the whole force is submarines ----
{
  console.log('\n5. quem esta submerso');
  assert.equal(fleetStats({ submarine: 3 }).submerged, true, 'alcateia pura fica submersa');
  assert.equal(fleetStats({ submarine: 3, cruiser: 1 }).submerged, false,
    'um casco de superficie entrega a posicao da forca inteira');
  assert.equal(fleetStats({}).submerged, false);
  console.log('   alcateia pura: submersa | com um cruzador junto: visivel');
}

// ---- 6. Rock-paper-scissors: the reason destroyers exist ----
{
  console.log('\n6. alcateia contra linha, e alcateia contra escolta');
  const pack = fleetStats({ submarine: 3 });
  const line = fleetStats({ battleship: 2 });
  const screen = fleetStats({ destroyer: 5 });

  // Volleys a hunter needs to find a submerged boat, on average.
  const volleysToFind = (detection: number) => detection <= 0 ? Infinity : 1 / detection;
  const lineFinds = volleysToFind(line.detection);
  const screenFinds = volleysToFind(screen.detection);
  console.log(`   linha de 2 encouracados leva ~${lineFinds.toFixed(1)} salvas para achar`);
  console.log(`   tela de 5 contratorpedeiros leva ~${screenFinds.toFixed(1)} salvas para achar`);
  assert.ok(screenFinds < lineFinds, 'a tela tem de achar; a linha nao acha nunca');
  assert.ok(!Number.isFinite(lineFinds), 'a linha nao enxerga debaixo d agua, por regra');

  // While undetected the pack fires for free. Damage per volley, roughly.
  const packShot = pack.guns * 0.095;
  console.log(`   alcateia dispara ~${packShot.toFixed(0)} por salva impune`);
  console.log(`   casco da linha: ${line.hull} -> ${(line.hull / packShot).toFixed(1)} salvas para afundar`);
  console.log(`   casco da alcateia: ${pack.hull} -> frágil quando achada`);
  assert.ok(screenFinds < 3, 'a tela tem de achar a alcateia quase de imediato');
  assert.ok(pack.hull < screen.hull, 'submarino achado tem de ser o casco mais fragil na agua');
}

// ---- 7. A real realm assembles a real fleet, and pays for it ----
{
  console.log('\n7. montagem de esquadra com estoque real');
  rng.setSeed(7);
  const kingdom = new Kingdom('k3', 'Talassia', SpeciesType.HUMAN, '#38bdf8', 'c', 1);
  const city = new City('c', 'Arsenal', SpeciesType.HUMAN, 10, 10, 'F', 1);

  // Sail era: no yard, only what a village boatwright manages.
  kingdom.research.era = TECHNOLOGIES['sailing'].era;
  city.stock.add('wood', 500);
  const sailFleet = assembleFleet(kingdom, city, false, 20);
  const sailStats = fleetStats(sailFleet);
  console.log(`   era da vela, sem estaleiro: ${describeFleet(sailFleet)}`);
  console.log(`   bercos ${sailStats.berths} para 20 soldados, canhoes ${sailStats.guns}`);
  assert.ok(sailStats.hulls > 0, 'tem de conseguir zarpar mesmo sem estaleiro');
  assert.ok(sailStats.berths >= 20, 'tem de haver berco para a tropa pedida');
  assert.ok(!Object.keys(sailFleet).some(id => WARSHIPS[id as keyof typeof WARSHIPS].requiresYard),
    'nenhuma classe registrada pode aparecer sem estaleiro');

  // Modern era with a yard and a full warehouse.
  const navy = new Kingdom('k4', 'Armada', SpeciesType.HUMAN, '#ef4444', 'c2', 1);
  // The last age carries everything.
  for (let i = 0; i < ERA_ORDER.length; i++) navy.research.forceAdvance();
  const base = new City('c2', 'Estaleiro', SpeciesType.HUMAN, 10, 10, 'F', 1);
  for (const g of ['steel', 'fuel', 'gunpowder', 'machinery', 'copper', 'rubber', 'wood', 'iron', 'tools', 'cloth', 'coal', 'bronze'] as const) {
    base.stock.add(g, 4000);
  }
  const steelBefore = base.stock.get('steel');
  const modernFleet = assembleFleet(navy, base, true, 40);
  const modernStats = fleetStats(modernFleet);
  console.log(`   era moderna, com estaleiro: ${describeFleet(modernFleet)}`);
  console.log(`   casco ${modernStats.hull}, canhoes ${modernStats.guns}, bercos ${modernStats.berths}, deteccao ${(modernStats.detection * 100).toFixed(0)}%`);
  console.log(`   aco debitado: ${steelBefore - base.stock.get('steel')}`);
  assert.ok(base.stock.get('steel') < steelBefore, 'os cascos tem de sair do estoque');
  assert.ok(modernStats.guns > sailStats.guns * 5, 'a era moderna tem de ser outra coisa');
  assert.ok(modernStats.detection > 0.2, 'uma esquadra moderna tem de ter escolta antissubmarino');

  // A realm with the technology but an empty warehouse sails with nothing.
  const broke = new City('c3', 'Vazia', SpeciesType.HUMAN, 10, 10, 'F', 1);
  const brokeFleet = assembleFleet(navy, broke, true, 40);
  console.log(`   mesmo reino, armazem vazio: ${describeFleet(brokeFleet)}`);
  assert.equal(fleetStats(brokeFleet).hulls, 0, 'sem material nao ha esquadra');
}

console.log('\nMARINHA DE GUERRA: 17 classes, e o catalogo se responde.');

// ============================================================
// 8. THE DUEL, fought with the real combat code
// ============================================================
{
  const { NavalInvasionSystem } = await import('../src/civ/NavalInvasion');
  const { ParticleManager } = await import('../src/renderer/Particles');
  const { DiplomacyManager } = await import('../src/civ/Diplomacy');
  const { City: C } = await import('../src/civ/City');

  function duel(a: FleetComposition, b: FleetComposition, seed: number): 'A' | 'B' | 'draw' {
    rng.setSeed(seed);
    const sys: any = new NavalInvasionSystem();
    const fx = new ParticleManager();
    const dip = new DiplomacyManager();
    dip.declareWar('kA', 'kB', 1, 'duelo');

    const make = (id: string, king: string, comp: FleetComposition, x: number) => {
      const st = fleetStats(comp);
      return {
        id, kingdomId: king, kingdomColor: '#fff', kingdomName: king,
        originCityId: 'o', targetCityId: 't', targetCityName: 't',
        soldierIds: [], x, y: 30, path: [{ x, y: 30 }], pathIndex: 0,
        composition: comp, speed: st.speed, hp: st.hull, maxHp: st.hull,
        detected: !st.submerged, state: 'crossing', launchedYear: 1,
        engagedWith: null, volleyCooldown: 0
      };
    };
    sys.fleets.set('A', make('A', 'kA', a, 30));
    sys.fleets.set('B', make('B', 'kB', b, 32));

    const cities = new Map<string, any>();
    const byId = new Map<string, any>();
    const map: any = { getTile: () => ({ type: 'ocean' }) };
    for (let t = 0; t < 40000 && sys.fleets.size === 2; t++) {
      sys.update(cities, byId, dip, map, fx, 1);
    }
    if (sys.fleets.size === 2) return 'draw';
    return sys.fleets.has('A') ? 'A' : 'B';
  }

  function series(name: string, a: FleetComposition, b: FleetComposition): number {
    let winsA = 0;
    for (let s = 0; s < 21; s++) if (duel(a, b, 1000 + s) === 'A') winsA++;
    console.log(`   ${name.padEnd(46)} ${String(winsA).padStart(2)}/21`);
    return winsA;
  }

  console.log('\n8. duelos reais (21 sementes cada), vitorias do primeiro');
  const packVsLine = series('alcateia (3 submarinos) x 2 encouracados', { submarine: 3 }, { battleship: 2 });
  const packVsScreen = series('alcateia (3 submarinos) x 5 contratorpedeiros', { submarine: 3 }, { destroyer: 5 });
  const lineVsScreen = series('2 encouracados x 5 contratorpedeiros', { battleship: 2 }, { destroyer: 5 });
  const escortVsNothing = series('1 corveta x 2 cocas desarmadas', { corvette: 1 }, { cog: 2 });

  assert.ok(packVsLine >= 16, `submarino tem de vencer a linha cega (foi ${packVsLine}/21)`);
  assert.ok(packVsScreen <= 5, `a tela antissubmarino tem de vencer a alcateia (foi ${packVsScreen}/21)`);
  assert.ok(escortVsNothing >= 19, 'escolta tem de destruir transporte desarmado');
  console.log(`   -> submarino > linha > ? ; contratorpedeiro > submarino  (linha x tela: ${lineVsScreen}/21)`);
}

console.log('\nPEDRA-PAPEL-TESOURA NAVAL: confirmado no combate real, nao no papel.');
