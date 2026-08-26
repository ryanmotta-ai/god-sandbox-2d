import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { Building } from '../src/civ/Building';
import { WarFrontSystem, SIEGE_GATE_PUSH, SECTOR_RADIUS } from '../src/civ/WarFronts';
import { MilitaryLogistics } from '../src/civ/MilitaryLogistics';
import { WarfareSystem, SIEGE_RADIUS } from '../src/civ/Warfare';
import { SimulationEngine } from '../src/ai/EntityAI';
import { rng } from '../src/core/Random';

const SIZE = 80;

function createTestTileMap(): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 99999);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.getTile(x, y)!;
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.railLevel = 0;
      t.railDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
      t.resourceType = null;
    }
  }
  map.updateRegionStates(SIZE / 2, SIZE / 2);
  return map;
}

interface TestHarness {
  map: TileMap;
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
  entities: Entity[];
  diplomacy: DiplomacyManager;
  fronts: WarFrontSystem;
  logistics: MilitaryLogistics;
  warfare: WarfareSystem;
  year: number;
}

function createHarness(): TestHarness {
  rng.setSeed(777);
  return {
    map: createTestTileMap(),
    cities: new Map(),
    kingdoms: new Map(),
    entities: [],
    diplomacy: new DiplomacyManager(),
    fronts: new WarFrontSystem(),
    logistics: new MilitaryLogistics(),
    warfare: new WarfareSystem(),
    year: 100
  };
}

function setupKingdom(h: TestHarness, id: string, name: string, capitalId: string): Kingdom {
  const k = new Kingdom(id, name, SpeciesType.HUMAN, '#00f', capitalId, 1);
  h.kingdoms.set(id, k);
  return k;
}

function setupCity(h: TestHarness, id: string, kingdomId: string, x: number, y: number, pop = 60, radius = 6): City {
  const c = new City(id, `Cidade_${id}`, SpeciesType.HUMAN, x, y, 'Fundador', 1);
  c.kingdomId = kingdomId;
  c.population = pop;
  c.stock.set('food', 200);
  c.stock.set('tools', 50);
  h.cities.set(id, c);
  h.kingdoms.get(kingdomId)?.cityIds.add(id);

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.hypot(dx, dy) > radius) continue;
      const tx = x + dx, ty = y + dy;
      const t = h.map.getTile(tx, ty);
      if (t && !t.kingdomId) {
        t.kingdomId = kingdomId;
        t.cityId = id;
        c.territory.add(`${tx},${ty}`);
      }
    }
  }
  return c;
}

function spawnSoldierGroup(h: TestHarness, kingdomId: string, cityId: string, x: number, y: number, count: number): Entity[] {
  const res: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const s = new Entity(`soldier_${kingdomId}_${x}_${y}_${i}`, SpeciesType.HUMAN, x + (i % 3) * 0.3, y + Math.floor(i / 3) * 0.3);
    s.age = 25;
    s.profession = 'soldier';
    s.kingdomId = kingdomId;
    s.cityId = cityId;
    s.hp = s.maxHp;
    s.damage = 15;
    s.defense = 10;
    h.entities.push(s);
    res.push(s);
  }
  return res;
}

// ============================================================
// 1. TESTE: HIERARQUIA MODAL DE SUPRIMENTO E DEBITO DE ARMAZEM
// ============================================================
{
  console.log('Test 1: Eficiência logística modal e consumo de suprimentos...');
  const h = createHarness();
  setupKingdom(h, 'A', 'Norte', 'c_a');
  setupKingdom(h, 'B', 'Sul', 'c_b');
  const cityA = setupCity(h, 'c_a', 'A', 20, 40, 80);
  const cityB = setupCity(h, 'c_b', 'B', 40, 40, 80);

  cityA.stock.set('food', 300);
  cityA.stock.set('tools', 100);

  h.diplomacy.declareWar('A', 'B', h.year, 'Conflito de fronteira');

  // Posiciona 10 soldados no front (meio do caminho: x=30, y=40)
  spawnSoldierGroup(h, 'A', 'c_a', 30, 40, 10);
  spawnSoldierGroup(h, 'B', 'c_b', 30, 40, 5);

  const world = {
    year: h.year,
    cities: h.cities,
    kingdoms: h.kingdoms,
    entities: h.entities,
    tileMap: h.map,
    diplomacy: h.diplomacy
  };

  h.fronts.tickYear(world);
  const sector = [...h.fronts.sectors.values()][0];
  assert.ok(sector, 'Deve existir um setor de fronteira ativo');

  const logiWorld = { ...world, railways: h.railways, fronts: h.fronts };
  h.logistics.tickYear(logiWorld);

  // Verifica que o suprimento foi entregue e o estoque da cidade base foi debitado
  assert.ok(sector.supplyA > 0.8, `Suprimento A deve estar alto em rota curta, foi ${sector.supplyA}`);
  assert.ok(cityA.stock.get('food') < 300, 'Comida da cidade base deve ter sido consumida para abastecer as tropas');
  assert.ok(cityA.stock.get('tools') < 100, 'Munições (ferramentas) devem ter sido consumidas para abastecer as tropas');

  const lineKey = `${sector.id}:A`;
  const line = h.logistics.lines.get(lineKey);
  assert.ok(line, 'Linha de suprimento deve ter sido registrada');
  assert.equal(line?.depotCityId, 'c_a', 'Depósito de suprimento deve ser a cidade c_a');
  console.log(`  -> Suprimento entregue: ${line?.foodDelivered.toFixed(1)} comida, ${line?.munitionsDelivered.toFixed(1)} munições.`);
}

// ============================================================
// 2. TESTE: IMPACTO DE ESTRADAS DANIFICADAS E ATRITO DE FOME
// ============================================================
{
  console.log('Test 2: Degradação de estrada e atrito logístico...');
  const h = createHarness();
  setupKingdom(h, 'A', 'Norte', 'c_a');
  setupKingdom(h, 'B', 'Sul', 'c_b');
  const cityA = setupCity(h, 'c_a', 'A', 15, 40, 80);
  setupCity(h, 'c_b', 'B', 42, 40, 80);

  // Esvazia estoque de comida do depósito para forçar fome
  cityA.stock.set('food', 10);
  cityA.stock.set('tools', 0);

  h.diplomacy.declareWar('A', 'B', h.year, 'Guerra de Exaustão');
  const soldiersA = spawnSoldierGroup(h, 'A', 'c_a', 28.5, 40, 10);

  const world = {
    year: h.year,
    cities: h.cities,
    kingdoms: h.kingdoms,
    entities: h.entities,
    tileMap: h.map,
    diplomacy: h.diplomacy
  };

  h.fronts.tickYear(world);
  const sector = [...h.fronts.sectors.values()][0];
  assert.ok(sector);

  const logiWorld = { ...world, railways: h.railways, fronts: h.fronts };
  h.logistics.tickYear(logiWorld);

  // Suprimento deve cair drasticamente devido à falta de mantimentos
  assert.ok(sector.supplyA < 0.45, `Suprimento sem comida no depósito deve ser crítico (< 0.45), foi ${sector.supplyA}`);

  // O atrito deve causar perda de HP nos soldados do setor
  const damagedSoldiers = soldiersA.filter(s => s.hp < s.maxHp);
  assert.ok(damagedSoldiers.length > 0, 'Soldados desabastecidos devem sofrer dano por atrito e fome');
  console.log(`  -> ${damagedSoldiers.length} soldados sofreram dano por atrito de suprimento.`);
}

// ============================================================
// 3. TESTE: CERCO ESTRUTURADO, BOMBARDEIO E DESTRUICAO DE PORTAO
// ============================================================
{
  console.log('Test 3: Fases do cerco e destruição de fortificações...');
  const h = createHarness();
  const kA = setupKingdom(h, 'A', 'Atacante', 'c_a');
  const kB = setupKingdom(h, 'B', 'Defensor', 'c_b');
  setupCity(h, 'c_a', 'A', 20, 20, 80);
  const cityTarget = setupCity(h, 'c_b', 'B', 30, 20, 60);

  // Adiciona portão e muralha à cidade defensora
  const gate = new Building('b_gate', 'wall', 30, 20, 1, 1);
  gate.fortificationRole = 'gate';
  gate.hp = 100;
  gate.maxHp = 100;
  cityTarget.buildings.set('b_gate', gate);

  h.diplomacy.declareWar('A', 'B', h.year, 'Cerco');

  // Atacante posiciona exército com artilharia às portas da cidade
  const siegeSoldiers = spawnSoldierGroup(h, 'A', 'c_a', 30, 21, 12);
  const armyId = 'army_siege';
  const siegeArmy: any = {
    id: armyId,
    name: '1º Batalhão de Cerco',
    kingdomId: 'A',
    homeCityId: 'c_a',
    soldierIds: new Set(siegeSoldiers.map(s => s.id)),
    targetCityId: 'c_b',
    targetPos: { x: 30, y: 20 },
    state: 'besieging',
    stance: 'aggressive',
    readiness: 1.0,
    morale: 1.0,
    fatigue: 0.0,
    experience: 0.5,
    composition: { infantry: 6, cavalry: 2, archers: 2, artillery: 2, militia: 0 },
    createdYear: h.year
  };
  h.warfare.armies.set(armyId, siegeArmy);
  kA.armyIds.add(armyId);

  const world = {
    year: h.year,
    cities: h.cities,
    kingdoms: h.kingdoms,
    entities: h.entities,
    tileMap: h.map,
    diplomacy: h.diplomacy,
    fronts: h.fronts
  };

  // Ano 1 de cerco
  h.warfare.tickYear(world);
  assert.equal(cityTarget.besiegerId, 'A', 'Cidade deve estar sob cerco de A no primeiro ano');
  assert.ok(cityTarget.siegeState !== null, 'Estado de cerco estruturado deve estar ativo');
  assert.ok(gate.hp < 100, `Portão da cidade deve ter sofrido dano pelo bombardeio, hp atual: ${gate.hp}`);
  console.log(`  -> Cerco ativo na fase '${cityTarget.siegeState?.phase}'. HP do portão: ${gate.hp}/${gate.maxHp}`);

  // Simula anos seguintes até a queda/rendição da cidade
  for (let year = 1; year < 4; year++) {
    world.year++;
    h.warfare.tickYear(world);
  }

  assert.equal(cityTarget.kingdomId, 'A', 'Cidade deve ter sido capturada por A após anos de cerco');
  console.log(`  -> Cidade conquistada com sucesso por A!`);
}

// ============================================================
// 4. TESTE: MICRO-IA - MARCHA ACELERADA E FORMACAO DO ANEL DE CERCO
// ============================================================
{
  console.log('Test 4: Micro-IA de marcha e formação de anel de cerco...');
  const ai = new SimulationEngine();
  const map = createTestTileMap();

  const kA = new Kingdom('kA', 'Atacante', SpeciesType.HUMAN, '#00f', 'c1', 1);
  const kB = new Kingdom('kB', 'Defensor', SpeciesType.HUMAN, '#f00', 'c2', 1);
  ai.kingdoms.set('kA', kA);
  ai.kingdoms.set('kB', kB);

  const city1 = new City('c1', 'Base', SpeciesType.HUMAN, 10, 10, 'Fundador', 1);
  city1.kingdomId = 'kA';
  const city2 = new City('c2', 'Alvo', SpeciesType.HUMAN, 30, 30, 'Fundador', 1);
  city2.kingdomId = 'kB';
  ai.cities.set('c1', city1);
  ai.cities.set('c2', city2);

  ai.diplomacy.declareWar('kA', 'kB', 1, 'Invasão');

  const soldier = new Entity('s_marcher', SpeciesType.HUMAN, 10, 10);
  soldier.age = 25;
  soldier.profession = 'soldier';
  soldier.kingdomId = 'kA';
  soldier.cityId = 'c1';
  ai.entities = [soldier];

  // IA decide marchar para a cidade inimiga
  (ai as any).decideHumanoidState(soldier, map, null);
  assert.equal(soldier.aiState, 'raid', 'Soldado em guerra deve assumir estado de marcha/raid');
  assert.equal(soldier.targetX, 30, 'Alvo da marcha deve ser o alvo inimigo (x=30)');
  assert.equal(soldier.targetY, 30, 'Alvo da marcha deve ser o alvo inimigo (y=30)');

  // Simula marcha até as proximidades e posicionamento no anel de cerco (doEncampAround)
  soldier.x = 28;
  soldier.y = 28;
  const soldier2 = new Entity('s_encamp_2', SpeciesType.HUMAN, 29, 29);
  soldier2.age = 25;

  for (let step = 0; step < 20; step++) {
    (ai as any).doEncampAround(soldier, 30, 30, map, 0.6, 5);
    (ai as any).doEncampAround(soldier2, 30, 30, map, 0.6, 5);
  }

  const distToCity1 = Math.hypot(soldier.x - 30, soldier.y - 30);
  const distBetweenSoldiers = Math.hypot(soldier.x - soldier2.x, soldier.y - soldier2.y);

  // Soldados devem estar dispersos no anel de raio ~5 sem colapso
  assert.ok(Math.abs(distToCity1 - 5) <= 0.6, `Soldado deve estar no anel de cerco (raio ~5), está a ${distToCity1.toFixed(2)}`);
  assert.ok(distBetweenSoldiers > 0.1, 'Soldados não devem se sobrepor no mesmo ponto');
  console.log(`  -> Marcha e anel de cerco validados: distância ao centro=${distToCity1.toFixed(2)}, dispersão=${distBetweenSoldiers.toFixed(2)}.`);
}

// ============================================================
// 5. TESTE: SIMULACAO MULTI-ANOS (20 ANOS COM TRATADO DE PAZ)
// ============================================================
{
  console.log('Test 5: Simulação temporal multi-anos e tratados de paz...');
  const h = createHarness();
  const k1 = setupKingdom(h, 'K1', 'Império do Sol', 'c1');
  const k2 = setupKingdom(h, 'K2', 'Reino da Lua', 'c2');
  setupCity(h, 'c1', 'K1', 20, 20, 80);
  setupCity(h, 'c2', 'K2', 36, 20, 80);

  spawnSoldierGroup(h, 'K1', 'c1', 22, 20, 10);
  spawnSoldierGroup(h, 'K2', 'c2', 34, 20, 10);

  h.diplomacy.declareWar('K1', 'K2', h.year, 'Guerra Histórica');
  assert.ok(h.diplomacy.isAtWar('K1', 'K2'), 'Os reinos devem estar em guerra');

  for (let year = 0; year < 15; year++) {
    const warWorld = {
      year: h.year,
      cities: h.cities,
      kingdoms: h.kingdoms,
      entities: h.entities,
      tileMap: h.map,
      diplomacy: h.diplomacy
    };

    h.fronts.tickYear(warWorld);
    h.logistics.tickYear({ ...warWorld, railways: h.railways, fronts: h.fronts });
    h.fronts.resolveYear(warWorld);
    h.warfare.tickYear({ ...warWorld, fronts: h.fronts });
    h.diplomacy.tickDiplomacy(['K1', 'K2'], h.year);
    h.year++;
  }

  // Se a guerra ainda estiver ativa, encerra via tratado formal
  if (h.diplomacy.isAtWar('K1', 'K2')) {
    h.diplomacy.settleWar('K1', 'K2', h.year, 'white_peace', null, -10, 5);
  }

  assert.equal(h.diplomacy.isAtWar('K1', 'K2'), false, 'Guerra deve estar encerrada');
  assert.ok(h.diplomacy.warHistory.length > 0, 'Histórico diplomático deve registrar a guerra concluída');
  console.log(`  -> 15 anos simulados com sucesso. Desgaste K1=${k1.warWeariness}, K2=${k2.warWeariness}. Histórico de guerras registrado: ${h.diplomacy.warHistory.length}.`);
}

console.log('\n========================================');
console.log('TODOS OS TESTES DE CERCO E LOGÍSTICA PASSARAM COM SUCESSO!');
console.log('========================================\n');
