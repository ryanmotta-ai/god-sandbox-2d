import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { DiplomacyManager, type WarRecord } from '../src/civ/Diplomacy';
import { chronicle } from '../src/civ/Chronicle';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import type { LogisticsMetrics } from '../src/ui/logistics/LogisticsMetrics';
import {
  WarfareUISnapshotCache, combatStrength, computeWarfareUISnapshot, warfareUIPerformance
} from '../src/ui/warfare/WarfareMetrics';
import { warfareConditions, warCausalChains } from '../src/ui/warfare/WarfareDiagnostics';

interface WorldFixture {
  kingdoms: Map<string, Kingdom>;
  cities: Map<string, City>;
  diplomacy: DiplomacyManager;
  entities: Entity[];
  ctx: any;
}

function world(): WorldFixture {
  const defs = [
    ['a', 'Aurelian League', '#d95d55', 10, 10],
    ['b', 'Bastion Crown', '#4f7ccf', 30, 10],
    ['c', 'Cinder Compact', '#c68a38', 10, 30],
    ['d', 'Dawn Republic', '#58a879', 30, 30]
  ] as const;
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();
  for (const [id, name, color, x, y] of defs) {
    const city = new City(`city-${id}`, `${name} Capital`, SpeciesType.HUMAN, x, y, 'Founder', 1);
    city.kingdomId = id;
    city.population = 60;
    city.territory = new Set([`${x},${y}`, `${x + 1},${y}`, `${x},${y + 1}`]);
    const kingdom = new Kingdom(id, name, SpeciesType.HUMAN, color, city.id, 1);
    kingdom.cachedCenter = { x, y };
    kingdom.totalPopulation = 60;
    kingdoms.set(id, kingdom);
    cities.set(city.id, city);
  }
  const diplomacy = new DiplomacyManager();
  const entities: Entity[] = [];
  const ctx = {
    sim: { currentYear: 100, kingdoms, cities, entities, diplomacy },
    tileMap: { width: 64, height: 64 }
  };
  return { kingdoms, cities, diplomacy, entities, ctx };
}

function soldier(id: string, kingdomId: string, x: number, y: number, state: Entity['aiState'] = 'idle', weapon?: string): Entity {
  const entity = new Entity(id, SpeciesType.HUMAN, x, y, id);
  entity.age = 28;
  entity.kingdomId = kingdomId;
  entity.profession = 'soldier';
  entity.aiState = state;
  if (weapon) entity.equipment.weapon = { name: weapon, category: weapon.includes('Musket') ? 'ranged' : 'melee' };
  return entity;
}

function logistics(): LogisticsMetrics {
  return {
    year: 100,
    roads: { tiles: 0, byLevel: [0, 0, 0, 0], damagedTiles: 0, totalTraffic: 0, busiest: [], meanLevel: null },
    rail: { tiles: 0, severedTiles: 0, degradedTiles: 0, lines: [], strandedStations: [], worldFreight: 0, builtThisYear: 0 },
    ports: [], routes: [], corridors: [], movers: [], cities: [], bottlenecks: [],
    landTradeVolume: 0, seaTradeVolume: 0, activeRoutes: 0, closedRoutes: 0,
    totalTradeValue: 0, activeCaravans: 0, activeShips: 0
  };
}

function declare(f: WorldFixture, attacker = 'a', defender = 'b', year = 80, reason = 'Border dispute'): WarRecord {
  assert.equal(f.diplomacy.declareWar(attacker, defender, year, reason), true);
  return [...f.diplomacy.activeWars.values()].find(war => war.attacker === attacker && war.defender === defender)!;
}

function snapshot(f: WorldFixture, network = logistics()) {
  return computeWarfareUISnapshot(f.ctx, network, 1000);
}

chronicle.clear();

// 1. Peace is a real state: no fabricated wars, sieges, battles or casualties.
{
  const f = world();
  const s = snapshot(f);
  assert.equal(s.activeWars.length, 0);
  assert.equal(s.sieges.length, 0);
  assert.equal(s.engagements.length, 0);
  assert.equal(s.totalSoldiers, 0);
}

// 2. A 1v1 declaration becomes exactly one bilateral WarView.
{
  const f = world();
  const record = declare(f);
  const s = snapshot(f);
  assert.equal(s.activeWars.length, 1);
  assert.equal(s.activeWars[0].record, record);
  assert.equal(s.activeWars[0].attacker.id, 'a');
  assert.equal(s.activeWars[0].defender.id, 'b');
}

// 3. “Field force” totals come from living soldier entities only.
{
  const f = world();
  f.entities.push(soldier('a1', 'a', 11, 10), soldier('a2', 'a', 12, 10));
  const civilian = new Entity('civilian', SpeciesType.HUMAN, 10, 10, 'Civilian');
  civilian.kingdomId = 'a';
  civilian.profession = 'farmer';
  f.entities.push(civilian);
  const s = snapshot(f);
  assert.equal(s.forces.find(force => force.kingdom.id === 'a')?.soldiers, 2);
  assert.equal(s.totalSoldiers, 2);
}

// 4. Field strength uses the warfare formula including tech, government and weariness.
{
  const f = world();
  const members = [soldier('a1', 'a', 10, 10), soldier('a2', 'a', 11, 10)];
  f.entities.push(...members);
  const expected = combatStrength(members, f.kingdoms.get('a')!);
  assert.equal(snapshot(f).forces.find(force => force.kingdom.id === 'a')?.strength, expected);
}

// 5. Equipment is read from entities; research alone does not invent adoption.
{
  const f = world();
  f.kingdoms.get('a')!.research.complete('gunpowder');
  f.entities.push(soldier('a1', 'a', 10, 10, 'idle', 'Matchlock Musket'), soldier('a2', 'a', 11, 10, 'idle', 'Iron Broadsword'));
  const equipment = snapshot(f).forces[0].equipment;
  assert.equal(equipment.find(item => item.name === 'Matchlock Musket')?.count, 1);
  assert.equal(equipment.find(item => item.name === 'Iron Broadsword')?.count, 1);
}

// 6. Opposing attack-state entities within nine tiles form a current engagement.
{
  const f = world();
  declare(f);
  f.entities.push(soldier('a1', 'a', 20, 20, 'attack'), soldier('b1', 'b', 24, 20, 'attack'));
  const s = snapshot(f);
  assert.equal(s.engagements.length, 1);
  assert.equal(s.engagements[0].attackerForces, 1);
  assert.equal(s.engagements[0].defenderForces, 1);
}

// 7. Proximity alone is not called a battle when entities are not attacking.
{
  const f = world();
  declare(f);
  f.entities.push(soldier('a1', 'a', 20, 20), soldier('b1', 'b', 21, 20));
  assert.equal(snapshot(f).engagements.length, 0);
}

// 8. Contact within eight tiles of a capital is marked major by the documented criterion.
{
  const f = world();
  declare(f);
  f.entities.push(soldier('a1', 'a', 27, 10, 'attack'), soldier('b1', 'b', 29, 10, 'attack'));
  const engagement = snapshot(f).engagements[0];
  assert.equal(engagement.capitalInvolved, true);
  assert.equal(engagement.major, true);
}

// 9. Siege cards use City siege state and resolve the matching war.
{
  const f = world();
  const war = declare(f);
  const city = f.cities.get('city-b')!;
  city.besiegerId = 'a';
  city.siegeProgress = 0.62;
  city.siegeYears = 2;
  const s = snapshot(f);
  assert.equal(s.sieges[0].warId, war.id);
  assert.equal(s.sieges[0].progress, 0.62);
  assert.equal(s.activeWars[0].cities[0].status, 'besieged');
}

// 10. Capital threat is derived from real nearby hostile combatants.
{
  const f = world();
  declare(f);
  f.entities.push(soldier('a1', 'a', 34, 10, 'raid'));
  const s = snapshot(f);
  assert.equal(s.activeWars[0].cities.find(city => city.id === 'city-b')?.status, 'threatened');
  assert.ok(warfareConditions(s).some(condition => condition.title === 'Capital threatened' || condition.title === 'Capital ameaçada'));
}

// 11. Captured-city territory uses structured Chronicle refs and current ownership.
{
  const f = world();
  const war = declare(f);
  const city = f.cities.get('city-b')!;
  city.formerOwnerId = 'b';
  city.kingdomId = 'a';
  city.capturedYear = 90;
  chronicle.log(90, 'conquest', 'Capital captured.', {
    refs: [{ kind: 'war', id: war.id }, { kind: 'city', id: city.id }],
    data: { civilianCasualties: 7 }
  });
  const view = snapshot(f).activeWars[0];
  assert.equal(view.territory.attackerHeldCities, 1);
  assert.equal(view.territory.attackerHeldTiles, 3);
  assert.equal(view.territory.basedOnCapturedCities, true);
  assert.equal(view.civilianCasualties, 7);
  chronicle.clear();
}

// 12. Side losses map correctly from attackerKills/defenderKills.
{
  const f = world();
  declare(f);
  f.diplomacy.recordBattle('a', 'b', 3, 2);
  const view = snapshot(f).activeWars[0];
  assert.equal(view.attackerLosses, 2);
  assert.equal(view.defenderLosses, 3);
  assert.equal(view.battlefieldCasualties, 5);
  assert.equal(view.record.battles, 1, 'stored counter is one lethal combat event, not a named battle');
}

// 13. An ally participates only when its own war against the same enemy exists.
{
  const f = world();
  declare(f, 'a', 'b');
  f.diplomacy.createAlliance('a', 'c', 'Test Pact', 70);
  const without = snapshot(f).activeWars.find(war => war.record.attacker === 'a')!;
  assert.equal(without.allies.length, 0);
  const linked = declare(f, 'c', 'b', 82, 'Alliance intervention');
  const withIntervention = snapshot(f).activeWars.find(war => war.record.attacker === 'a')!;
  assert.equal(withIntervention.allies[0].kingdom.id, 'c');
  assert.equal(withIntervention.allies[0].linkedWarId, linked.id);
}

// 14. Multiple attackers/defenders remain linked bilateral records, never one fake coalition record.
{
  const f = world();
  declare(f, 'a', 'b');
  declare(f, 'c', 'b');
  declare(f, 'a', 'd');
  const s = snapshot(f);
  assert.equal(s.activeWars.length, 3);
  assert.ok(s.activeWars.every(war => war.record.attacker && war.record.defender));
}

// 15. Only inactive bilateral routes are counted as trade shut by this war.
{
  const f = world();
  declare(f);
  const network = logistics();
  network.routes.push({
    route: { id: 'route-war', fromCityId: 'city-a', toCityId: 'city-b', fromKingdomId: 'a', toKingdomId: 'b', kind: 'overland', good: 'food', volume: 12, maxVolume: 12, establishedYear: 50, totalValue: 100, active: false },
    kind: 'overland', good: 'food', goodName: 'Food', fromCity: f.cities.get('city-a')!, toCity: f.cities.get('city-b')!,
    fromKingdom: f.kingdoms.get('a')!, toKingdom: f.kingdoms.get('b')!
  } as any);
  const view = snapshot(f, network).activeWars[0];
  assert.equal(view.economy.closedRoutes.length, 1);
  assert.equal(view.economy.suspendedVolume, 12);
  assert.ok(warCausalChains(view).some(chain => chain.id === 'closed-trade'));
}

// 16. Participant rail and affected-city ports surface from the real logistics snapshot.
{
  const f = world();
  declare(f);
  f.entities.push(soldier('a1', 'a', 28, 10, 'raid'));
  const network = logistics();
  network.rail.lines.push({
    id: 'rail-a', tiles: 10, quality: 0.5,
    stations: [{ cityId: 'city-a', cityName: 'Aurelian League Capital', kingdomId: 'a', kingdomName: 'Aurelian League', x: 10, y: 10 }],
    owners: [{ kingdomId: 'a', name: 'Aurelian League', color: '#d95d55' }], goods: ['iron'], damagedTiles: 3,
    at: { x: 14, y: 10 }, status: 'damaged'
  });
  network.ports.push({
    cityId: 'city-b', cityName: 'Bastion Crown Capital', kingdomId: 'b', kingdomName: 'Bastion Crown', kingdomColor: '#4f7ccf',
    berths: 1, condition: 0.2, operational: false, maritimeRoutes: [], inboundVolume: 0, outboundVolume: 0,
    majorImports: [], majorExports: [], realmSeaShare: 0, status: 'blocked', x: 30, y: 10
  });
  const infra = snapshot(f, network).activeWars[0].infrastructure;
  assert.equal(infra.damagedRailLines[0].damagedTiles, 3);
  assert.equal(infra.disruptedPorts[0].cityId, 'city-b');
}

// 17. Political pressure and faction war support are read from Kingdom state.
{
  const f = world();
  declare(f);
  const kingdom = f.kingdoms.get('a')!;
  kingdom.warWeariness = 72;
  kingdom.legitimacy = 0.43;
  kingdom.society.peacePressure = 0.8;
  const s = snapshot(f);
  const political = s.activeWars[0].politics.find(item => item.kingdom.id === 'a')!;
  assert.equal(political.warWeariness, 72);
  assert.equal(political.legitimacy, 0.43);
  assert.equal(political.peacePressure, 0.8);
  assert.ok(warfareConditions(s).some(condition => condition.title === 'High war weariness' || condition.title === 'Alto desgaste de guerra'));
}

// 18. Peace moves the same WarRecord into history with settlement and victor.
{
  const f = world();
  const war = declare(f);
  f.diplomacy.settleWar('a', 'b', 96, 'victory', 'a');
  const s = snapshot(f);
  assert.equal(s.activeWars.length, 0);
  assert.equal(s.history[0].record.id, war.id);
  assert.equal(s.history[0].record.settlement, 'victory');
  assert.equal(s.history[0].record.victor, 'a');
}

// 19. Rebellion/secession remains a reason classification, not a new war model.
{
  const f = world();
  declare(f, 'c', 'a', 95, 'Independence rebellion');
  assert.equal(snapshot(f).activeWars[0].conflictKind, 'rebellion');
}

// 20. Destroyed participants keep a stable fallback identity in historical views.
{
  const f = world();
  declare(f);
  f.diplomacy.endWar('a', 'b', 90);
  f.kingdoms.delete('b');
  const view = snapshot(f).history[0];
  assert.equal(view.defender.id, 'b');
  assert.equal(view.defender.surviving, false);
}

// 21. Long-war duration uses current year for active records.
{
  const f = world();
  declare(f, 'a', 'b', 5);
  assert.equal(snapshot(f).activeWars[0].duration, 95);
}

// 22. Timeline never text-scrapes: only structured war references are indexed.
{
  const f = world();
  const war = declare(f);
  chronicle.log(85, 'war', `${war.id} appears in prose only.`);
  chronicle.log(86, 'siege', 'Structured event.', { refs: [{ kind: 'war', id: war.id }] });
  const timeline = snapshot(f).activeWars[0].timeline;
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].text, 'Structured event.');
  chronicle.clear();
}

// 23. Snapshot work is cached within the live-contact cadence and invalidates by year.
{
  const f = world();
  declare(f);
  const network = logistics();
  const cache = new WarfareUISnapshotCache();
  const first = cache.get(f.ctx, network, 100);
  const cached = cache.get(f.ctx, network, 101);
  assert.equal(cached, first);
  f.ctx.sim.currentYear++;
  assert.notEqual(cache.get(f.ctx, network, 102), first);
}

// 24. Snapshot generation remains command-screen work, not frame-time work.
{
  const f = world();
  declare(f);
  for (let i = 0; i < 120; i++) f.entities.push(soldier(`a-${i}`, i % 2 ? 'a' : 'b', 20 + i % 4, 20 + i % 3, 'attack'));
  for (let i = 0; i < 80; i++) f.diplomacy.recordBattle('a', 'b', i % 3 === 0 ? 1 : 0, i % 4 === 0 ? 1 : 0);
  const started = performance.now();
  const s = snapshot(f);
  const elapsed = performance.now() - started;
  assert.ok(s.buildTimeMs >= 0);
  assert.equal(warfareUIPerformance.snapshotMs, s.buildTimeMs);
  assert.ok(elapsed < 1000, `snapshot should remain cached-scale work, got ${elapsed.toFixed(2)}ms`);
  console.log(`[warfare-ui] snapshot ${elapsed.toFixed(2)}ms · internal ${s.buildTimeMs.toFixed(2)}ms`);
}

// 25. Mandatory cross-navigation and alert routes stay wired.
{
  const screen = readFileSync(new URL('../src/ui/screens/WarfareScreen.ts', import.meta.url), 'utf8');
  const tabs = readFileSync(new URL('../src/ui/warfare/WarfareTabs.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const alerts = readFileSync(new URL('../src/ui/core/Alerts.ts', import.meta.url), 'utf8');
  assert.match(screen, /screens\.open\('realm'/, 'War → Realm');
  assert.match(screen, /screens\.open\('city'/, 'War → City');
  assert.match(screen, /screens\.open\('economy'/, 'War → Economy/Good');
  assert.match(screen, /screens\.open\('infrastructure'/, 'War → Infrastructure');
  assert.match(screen, /screens\.open\('politics'/, 'War → Politics');
  assert.match(screen, /screens\.open\('techtree'/, 'Equipment → Technology');
  assert.match(screen, /screens\.open\('chronicle'/, 'War → Chronicle');
  assert.match(tabs, /kind: 'war'/, 'War object links');
  assert.match(main, /registerOpener\('war'/, 'ObjectLink → War Dossier');
  assert.match(alerts, /kind: 'war'.*id: war\.id/s, 'War alert → War Dossier');
}

console.log('warfare-ui.test: all assertions passed');
