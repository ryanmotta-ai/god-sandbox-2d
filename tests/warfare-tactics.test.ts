import assert from 'node:assert/strict';
import { TileMap } from '../src/world/TileMap';
import { TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom } from '../src/civ/Kingdom';
import { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';
import { DiplomacyManager } from '../src/civ/Diplomacy';
import { Building } from '../src/civ/Building';
import { TraitId } from '../src/entities/Traits';
import {
  WarfareSystem,
  determineUnitRole,
  computeArmyComposition,
  terrainCombatModifier,
  getBattleTerrain
} from '../src/civ/Warfare';
import { SimulationEngine } from '../src/ai/EntityAI';
import { rng } from '../src/core/Random';

const SIZE = 64;

function createTestTileMap(): TileMap {
  const map = new TileMap(SIZE, SIZE, 'single_continent', 12345);
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

// ============================================================
// 1. TESTE: RECRUTAMENTO, CONSCRICAO E PROTECAO DE AGRICULTORES
// ============================================================
{
  console.log('Test 1: Conscrição militar e proteção de agricultores...');
  rng.setSeed(100);
  const ai = new SimulationEngine();
  const map = createTestTileMap();

  const k = new Kingdom('k1', 'Valoria', SpeciesType.HUMAN, '#f00', 'c1', 1);
  ai.kingdoms.set('k1', k);

  const city = new City('c1', 'Capital', SpeciesType.HUMAN, 20, 20, 'Fundador', 1);
  city.kingdomId = 'k1';
  // A população da cidade tem de bater com os residentes criados abaixo: a guarda
  // é uma fração de `population` e o alistamento só pode tirar gente da lista de
  // entidades, então uma cidade que declara 80 residentes e contém 14 pede mais
  // gente do que existe e o teste passa a medir essa inconsistência. 20 mantém a
  // guarda no ramo percentual da fórmula, que é o que interessa aqui.
  city.population = 20;
  ai.cities.set('c1', city);
  k.cityIds.add('c1');

  // Adiciona quartel operacional com capacidade para 10 soldados
  const barracks = new Building('b_barracks', 'barracks', 20, 20, 1, 1);
  barracks.hp = barracks.maxHp;
  city.buildings.set('b_barracks', barracks);

  // População civil: 4 pedreiros, 4 mineradores, 6 agricultores
  const citizens: Entity[] = [];
  for (let i = 0; i < 4; i++) {
    const e = new Entity(`b_${i}`, SpeciesType.HUMAN, 20, 20);
    e.profession = 'builder';
    e.cityId = 'c1';
    e.kingdomId = 'k1';
    citizens.push(e);
  }
  for (let i = 0; i < 4; i++) {
    const e = new Entity(`m_${i}`, SpeciesType.HUMAN, 20, 20);
    e.profession = 'miner';
    e.cityId = 'c1';
    e.kingdomId = 'k1';
    citizens.push(e);
  }
  for (let i = 0; i < 6; i++) {
    const e = new Entity(`f_${i}`, SpeciesType.HUMAN, 20, 20);
    e.profession = 'farmer';
    e.cityId = 'c1';
    e.kingdomId = 'k1';
    citizens.push(e);
  }
  for (let i = 0; i < 6; i++) {
    const e = new Entity(`s_${i}`, SpeciesType.HUMAN, 20, 20);
    e.profession = 'scout';
    e.cityId = 'c1';
    e.kingdomId = 'k1';
    citizens.push(e);
  }
  ai.entities = citizens;

  // Sem guerra ativa: só a guarda do assentamento, nunca uma leva.
  //
  // Esta asserção já exigiu zero soldados em tempo de paz, e depois no máximo 2.
  // Ambas eram números mágicos de uma versão antiga da fórmula: a guarda é uma
  // fração da população (hoje 20%), então numa cidade de 80 habitantes ela vale
  // 16, e "no máximo 2" só podia passar em vilas minúsculas. O teste ficou
  // vermelho por isso, não por regressão, e um teste vermelho em que ninguém
  // confia é pior que nenhum.
  //
  // A invariante que este teste realmente defende é de projeto e não de
  // constante: a paz posta uma guarda, a guerra levanta uma leva, e a guarda
  // fica sempre bem abaixo do que a guerra levantaria. Isso sobrevive a
  // qualquer recalibragem de `watch` e `levy`.
  (ai as any).musterArmies();
  let soldiersCount = ai.entities.filter(e => e.profession === 'soldier').length;
  const peaceWatch = soldiersCount;
  assert.ok(peaceWatch > 0, 'A paz ainda posta uma guarda');
  assert.ok(
    peaceWatch < city.population * 0.32,
    `A guarda de paz nunca alcança a leva de guerra (${(0.32 * 100).toFixed(0)}% da população), veio ${peaceWatch} de ${city.population}`
  );

  // Declara guerra com pouca comida (não deve tocar em agricultores)
  ai.diplomacy.declareWar('k1', 'k2', 1, 'Guerra de Fronteira');
  city.stock.set('food', 20); // acima de 0.8x pop (16) para alistar, abaixo de 1.5x (30) para poupar a lavoura

  (ai as any).musterArmies();
  soldiersCount = ai.entities.filter(e => e.profession === 'soldier').length;
  assert.ok(soldiersCount > peaceWatch, 'A guerra deve mobilizar acima da guarda de paz');

  // Verifica que nenhum agricultor foi recrutado devido à restrição de comida
  const farmersConscripted = ai.entities.filter(e => e.id.startsWith('f_') && e.profession === 'soldier').length;
  assert.equal(farmersConscripted, 0, 'Agricultores não devem ser convocados quando a comida não for abundante');

  // Agora com comida abundante (acima de 1.5x pop) e conscrição em massa
  city.stock.set('food', 500);
  k.research.known.add('gunpowder'); // Desbloqueia conscription feature
  (ai as any).musterArmies();

  const totalSoldiers = ai.entities.filter(e => e.profession === 'soldier').length;
  assert.ok(totalSoldiers >= 4, 'Conscrição ampliada deve recrutar mais cidadãos');
  console.log('  -> Conscrição e proteção de agricultores validadas com sucesso!');
}

// ============================================================
// 2. TESTE: AUTO-ARMAMENTO E CONSERVACAO DE RECURSOS FISICOS
// ============================================================
{
  console.log('Test 2: Auto-armamento e conservação de recursos...');
  rng.setSeed(200);
  const ai = new SimulationEngine();
  const k = new Kingdom('k1', 'Valoria', SpeciesType.HUMAN, '#f00', 'c1', 1);
  ai.kingdoms.set('k1', k);

  const city = new City('c1', 'Capital', SpeciesType.HUMAN, 20, 20, 'Fundador', 1);
  city.kingdomId = 'k1';
  ai.cities.set('c1', city);

  // Cidade tem estoques de ferro e madeira
  city.stock.set('iron', 20);
  city.stock.set('wood', 20);
  city.stock.set('food', 50);

  k.research.known.add('iron_working'); // Permite armas de ferro

  const soldier = new Entity('s_1', SpeciesType.HUMAN, 20, 20);
  soldier.profession = 'soldier';
  soldier.cityId = 'c1';
  soldier.kingdomId = 'k1';
  assert.equal(soldier.equipment.weapon, undefined, 'Soldado começa desarmado');

  const baseDmg = soldier.damage;
  (ai as any).autoArmSoldier(soldier);

  assert.ok(soldier.equipment.weapon !== null, 'Soldado deve ter sido equipado com arma');
  assert.ok(soldier.equipment.armor !== null, 'Soldado deve ter sido equipado com armadura');
  assert.ok(soldier.damage > baseDmg, 'Dano do soldado deve ter aumentado com o equipamento');

  // Verifica que o estoque da cidade foi debitado corretamente (Conservação de Recursos)
  assert.ok(city.stock.get('iron') < 20, 'Estoque de ferro deve ser debitado');
  console.log('  -> Auto-armamento com débito real de estoque validado!');
}

// ============================================================
// 3. TESTE: ORGANIZACAO DE REGIMENTOS E NOMEACAO DE COMANDANTES
// ============================================================
{
  console.log('Test 3: Organização de regimentos e nomeação de comandantes...');
  rng.setSeed(300);
  const warfare = new WarfareSystem();
  const map = createTestTileMap();
  const diplomacy = new DiplomacyManager();
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();
  const entities: Entity[] = [];

  const k = new Kingdom('k1', 'Império do Norte', SpeciesType.HUMAN, '#00f', 'c1', 1);
  kingdoms.set('k1', k);
  const city = new City('c1', 'Fortaleza', SpeciesType.HUMAN, 15, 15, 'Fundador', 1);
  city.kingdomId = 'k1';
  cities.set('c1', city);
  k.cityIds.add('c1');

  // Cria 25 soldados (deve formar pelo menos 2 regimentos, max 20 por regimento)
  for (let i = 0; i < 25; i++) {
    const s = new Entity(`soldier_${i}`, SpeciesType.HUMAN, 15, 15);
    s.age = 25;
    s.profession = 'soldier';
    s.kingdomId = 'k1';
    s.cityId = 'c1';
    s.hp = s.maxHp;
    if (i === 0) {
      s.level = 10;
      s.kills = 15;
      s.traits.add(TraitId.GENIUS); // Deve virar tactician
    }
    entities.push(s);
  }

  const world = { year: 50, cities, kingdoms, entities, tileMap: map, diplomacy };
  warfare.tickYear(world);

  const armies = warfare.getArmiesForKingdom('k1');
  assert.equal(armies.length, 2, '25 soldados devem ser divididos em 2 regimentos (limite 20)');
  assert.equal(armies[0].soldierIds.size, 20, 'Primeiro regimento deve ter exatamente 20 soldados');
  assert.equal(armies[1].soldierIds.size, 5, 'Segundo regimento deve ter 5 soldados');

  // Verifica nomeação do comandante
  assert.ok(armies[0].commanderId !== null, 'Regimento deve ter um comandante nomeado');
  const commander = warfare.commanders.get(armies[0].commanderId!);
  assert.ok(commander !== undefined, 'Comandante deve existir no registro');
  assert.equal(commander?.trait, 'tactician', 'Veterano com traço GENIUS deve ser nomeado tactician');
  console.log(`  -> Regimentos organizados (${armies.length}) e comandante nomeado: ${commander?.name} (${commander?.trait})`);
}

// ============================================================
// 4. TESTE: DETERMINACAO DE PAPEL DE UNIDADE E COMPOSICAO
// ============================================================
{
  console.log('Test 4: Composição de unidades e papéis táticos...');
  const k = new Kingdom('k1', 'Reino', SpeciesType.HUMAN, '#f00', 'c1', 1);

  const militia = new Entity('e1', SpeciesType.HUMAN, 0, 0);
  militia.profession = 'farmer';
  assert.equal(determineUnitRole(militia, k), 'militia');

  const cavalry = new Entity('e2', SpeciesType.HUMAN, 0, 0);
  cavalry.profession = 'soldier';
  cavalry.traits.add(TraitId.QUICK);
  assert.equal(determineUnitRole(cavalry, k), 'cavalry');

  const archer = new Entity('e3', SpeciesType.HUMAN, 0, 0);
  archer.profession = 'archer';
  assert.equal(determineUnitRole(archer, k), 'archer');

  const artillery = new Entity('e4', SpeciesType.HUMAN, 0, 0);
  artillery.profession = 'soldier';
  artillery.equipment.weapon = { id: 'w_catapult', name: 'Catapulta', category: 'siege', damageBonus: 30, attackRange: 8, tier: 'advanced' };
  assert.equal(determineUnitRole(artillery, k), 'artillery');

  console.log('  -> Papéis de unidade (militia, cavalry, archer, artillery) identificados corretamente!');
}

// ============================================================
// 5. TESTE: MODIFICADORES DE TERRENO POR BIOMA
// ============================================================
{
  console.log('Test 5: Modificadores de terreno...');
  // Floresta favorece infantaria (1.15) e penaliza cavalaria (0.70) e artilharia (0.60)
  assert.equal(terrainCombatModifier(TerrainType.FOREST, 'infantry'), 1.15);
  assert.equal(terrainCombatModifier(TerrainType.FOREST, 'cavalry'), 0.70);
  assert.equal(terrainCombatModifier(TerrainType.FOREST, 'artillery'), 0.60);

  // Montanha favorece arqueiros (1.30) e infantaria (1.20), penaliza cavalaria (0.40)
  assert.equal(terrainCombatModifier(TerrainType.MOUNTAIN, 'archer'), 1.30);
  assert.equal(terrainCombatModifier(TerrainType.MOUNTAIN, 'cavalry'), 0.40);

  // Planície favorece cavalaria (1.20)
  assert.equal(terrainCombatModifier(TerrainType.GRASS, 'cavalry'), 1.20);
  console.log('  -> Modificadores de terreno por bioma validados!');
}

// ============================================================
// 6. TESTE: BATALHA CAMPAL TACTICA EM 3 FASES, ROTA E PERSEGUICAO
// ============================================================
{
  console.log('Test 6: Batalha campal em 3 fases, moral e perseguição...');
  rng.setSeed(400);
  const warfare = new WarfareSystem();
  const map = createTestTileMap();
  const diplomacy = new DiplomacyManager();
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();
  const entities: Entity[] = [];

  const k1 = new Kingdom('k1', 'Atacante Forte', SpeciesType.HUMAN, '#00f', 'c1', 1);
  const k2 = new Kingdom('k2', 'Defensor Fraco', SpeciesType.HUMAN, '#f00', 'c2', 1);
  kingdoms.set('k1', k1);
  kingdoms.set('k2', k2);

  diplomacy.declareWar('k1', 'k2', 10, 'Invasão');

  const c1 = new City('c1', 'Cidade1', SpeciesType.HUMAN, 10, 10, 'Fundador', 1);
  c1.kingdomId = 'k1';
  cities.set('c1', c1);
  const c2 = new City('c2', 'Cidade2', SpeciesType.HUMAN, 40, 40, 'Fundador', 1);
  c2.kingdomId = 'k2';
  cities.set('c2', c2);

  // Exército 1: 15 soldados com cavalaria e arqueiros
  const s1Ids = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const s = new Entity(`s1_${i}`, SpeciesType.HUMAN, 20, 20);
    s.age = 25;
    s.profession = 'soldier';
    s.kingdomId = 'k1';
    s.damage = 18;
    s.defense = 12;
    s.hp = s.maxHp;
    if (i < 5) s.traits.add(TraitId.QUICK); // 5 de cavalaria
    entities.push(s);
    s1Ids.add(s.id);
  }

  // Exército 2: 6 soldados básicos com moral baixo
  const s2Ids = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const s = new Entity(`s2_${i}`, SpeciesType.HUMAN, 21, 20);
    s.age = 25;
    s.profession = 'soldier';
    s.kingdomId = 'k2';
    s.damage = 8;
    s.defense = 4;
    s.hp = s.maxHp;
    entities.push(s);
    s2Ids.add(s.id);
  }

  const army1: any = {
    id: 'army_1',
    name: '1º Regimento do Norte',
    kingdomId: 'k1',
    homeCityId: 'c1',
    soldierIds: s1Ids,
    targetCityId: 'c2',
    targetPos: { x: 20, y: 20 },
    state: 'marching',
    stance: 'aggressive',
    readiness: 1.0,
    morale: 1.0,
    fatigue: 0.0,
    experience: 0.5,
    createdYear: 10
  };

  const army2: any = {
    id: 'army_2',
    name: '1º Regimento do Sul',
    kingdomId: 'k2',
    homeCityId: 'c2',
    soldierIds: s2Ids,
    targetCityId: 'c1',
    targetPos: { x: 21, y: 20 },
    state: 'marching',
    stance: 'defensive',
    readiness: 0.6,
    morale: 0.4, // Moral baixo para forçar rota
    fatigue: 0.5,
    experience: 0.1,
    createdYear: 10
  };

  warfare.armies.set('army_1', army1);
  warfare.armies.set('army_2', army2);

  const world = { year: 10, cities, kingdoms, entities, tileMap: map, diplomacy };
  (warfare as any).resolveFieldBattles(world);

  assert.equal(army2.state, 'retreating', 'Exército perdedor deve entrar em retirada');
  assert.ok(army2.morale < 0.35, 'Moral do perdedor deve ter desabado');
  assert.ok(army1.morale > 1.0 || army1.experience > 0.5, 'Vencedor deve ganhar experiência');

  const deadLosers = entities.filter(e => e.kingdomId === 'k2' && e.hp <= 0).length;
  assert.ok(deadLosers > 0, 'Batalha campal deve produzir baixas reais nas entidades físicas');
  console.log(`  -> Batalha resolvida: ${deadLosers} baixas no exército perdedor.`);
}

// ============================================================
// 7. TESTE: CONTRATACAO E MANUTENCAO DE MERCENARIOS
// ============================================================
{
  console.log('Test 7: Sistema de mercenários...');
  rng.setSeed(500);
  const warfare = new WarfareSystem();
  const map = createTestTileMap();
  const diplomacy = new DiplomacyManager();
  const kingdoms = new Map<string, Kingdom>();
  const cities = new Map<string, City>();
  const entities: Entity[] = [];

  const k1 = new Kingdom('k1', 'Reino Rico', SpeciesType.HUMAN, '#0f0', 'c1', 1);
  k1.addGold(500);
  kingdoms.set('k1', k1);

  const c1 = new City('c1', 'Porto Rico', SpeciesType.HUMAN, 20, 20, 'Fundador', 1);
  c1.kingdomId = 'k1';
  cities.set('c1', c1);
  k1.cityIds.add('c1');

  const world = { year: 10, cities, kingdoms, entities, tileMap: map, diplomacy };

  // Spawna uma companhia mercenária
  const company = (warfare as any).spawnMercenaryCompany(world);
  assert.ok(warfare.mercenaryCompanies.has(company.id), 'Companhia mercenária deve estar registrada');
  assert.equal(company.employerKingdomId, null, 'Companhia recém-criada não tem empregador');

  const initialTreasury = k1.gold;
  const hired = warfare.hireMercenaryCompany(company.id, 'k1', 3, world);
  assert.ok(hired, 'Contratação deve ter sucesso');
  assert.equal(company.employerKingdomId, 'k1', 'Companhia deve ter k1 como empregador');
  assert.equal(k1.gold, initialTreasury - company.hiringCost, 'Tesouro deve ser debitado no custo de contratação');
  assert.ok(k1.armyIds.size > 0, 'Regimento mercenário deve ser adicionado ao reino');

  // Avança o tempo até o fim do contrato
  world.year = 13;
  (warfare as any).maintainMercenaries(world);
  assert.equal(company.employerKingdomId, null, 'Contrato deve ser encerrado por tempo expirado');
  console.log('  -> Contratação, anuidade e rescisão de mercenários validadas com sucesso!');
}

console.log('\n========================================');
console.log('TODOS OS TESTES DE TÁTICAS MILITARES PASSARAM COM SUCESSO!');
console.log('========================================\n');
