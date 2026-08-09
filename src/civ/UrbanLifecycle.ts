import type { Building, BuildingDamageCause, BuildingType } from './Building';
import { BUILDINGS } from './Building';
import type { City } from './City';
import type { Kingdom } from './Kingdom';
import type { PendingBuildingDamage } from '../world/TileMap';
import { TileMap } from '../world/TileMap';
import { RegionState } from '../world/WorldChunks';
import { UrbanDistrictPlanner, districtForBuilding, urbanContextAt } from './UrbanDistricts';
import { buildingArchitecturalStamp } from './ArchitecturalProfile';
import { chronicle } from './Chronicle';
import type { GoodId } from './Goods';

export interface UrbanLifecycleResult {
  inspected: number;
  constructionCompleted: number;
  repaired: number;
  abandoned: number;
  ruined: number;
  reconstructionStarted: number;
  reconstructed: number;
  demolished: number;
  vacatedBuildingIds: string[];
}

export interface BuildingDamageSummary {
  cityId: string;
  fire: number;
  disaster: number;
  ruined: number;
  buildingIds: string[];
}

interface LifecycleRuntime {
  ids: string[];
  buildingVersion: number;
  cursor: number;
  priorityCursor: number;
  lastTickYear: number;
}

const RUNTIME = new WeakMap<City, LifecycleRuntime>();
const LANDMARKS = new Set<BuildingType>([
  'town_center', 'palace', 'keep', 'temple', 'monument', 'great_library',
  'grand_aqueduct', 'colosseum'
]);

function emptyResult(): UrbanLifecycleResult {
  return {
    inspected: 0,
    constructionCompleted: 0,
    repaired: 0,
    abandoned: 0,
    ruined: 0,
    reconstructionStarted: 0,
    reconstructed: 0,
    demolished: 0,
    vacatedBuildingIds: []
  };
}

function cadence(state: RegionState): { interval: number; budget: number } {
  if (state === RegionState.ACTIVE) return { interval: 1, budget: 36 };
  if (state === RegionState.WARM) return { interval: 3, budget: 14 };
  return { interval: 8, budget: 5 };
}

function runtimeFor(city: City): LifecycleRuntime {
  let runtime = RUNTIME.get(city);
  if (!runtime) {
    runtime = { ids: [], buildingVersion: -1, cursor: 0, priorityCursor: 0, lastTickYear: -Infinity };
    RUNTIME.set(city, runtime);
  }
  if (runtime.buildingVersion !== city.buildingVersion) {
    runtime.ids = [...city.buildings.keys()].sort();
    runtime.buildingVersion = city.buildingVersion;
    runtime.cursor %= Math.max(1, runtime.ids.length);
    runtime.priorityCursor %= Math.max(1, runtime.ids.length);
  }
  return runtime;
}

function chooseIds(city: City, runtime: LifecycleRuntime, budget: number): string[] {
  if (runtime.ids.length <= budget) return [...runtime.ids];
  const priority = runtime.ids.filter(id => {
    const building = city.buildings.get(id);
    return !!building && (building.lifecycleState !== 'normal' || building.hp < building.maxHp * .9);
  });
  const result: string[] = [];
  const seen = new Set<string>();
  const priorityBudget = Math.min(priority.length, Math.max(1, Math.ceil(budget * .72)));
  for (let i = 0; i < priorityBudget; i++) {
    const id = priority[(runtime.priorityCursor + i) % priority.length];
    if (id && !seen.has(id)) { seen.add(id); result.push(id); }
  }
  runtime.priorityCursor = priority.length ? (runtime.priorityCursor + priorityBudget) % priority.length : 0;
  for (let i = 0; result.length < budget && i < runtime.ids.length; i++) {
    const id = runtime.ids[(runtime.cursor + i) % runtime.ids.length];
    if (!seen.has(id)) { seen.add(id); result.push(id); }
  }
  runtime.cursor = (runtime.cursor + budget) % runtime.ids.length;
  return result;
}

function markChanged(city: City, map: TileMap, building: Building): void {
  city.lifecycleVersion++;
  map.markRenderDirty(building.x, building.y);
  UrbanDistrictPlanner.markDirty(city, map, building.x, building.y);
}

function vacate(building: Building, result: UrbanLifecycleResult): void {
  building.staffing = 0;
  building.assignedWorkerIds.clear();
  building.residentIds.clear();
  if (!result.vacatedBuildingIds.includes(building.id)) result.vacatedBuildingIds.push(building.id);
}

function advanceNature(city: City, map: TileMap, building: Building, elapsed: number): void {
  if (city.urbanCrisisYears < 2 || building.stateSinceYear <= 0) return;
  const previousBand = Math.floor(building.natureReclaim * 4);
  const delay = building.lifecycleState === 'ruin' ? 3 : 6;
  if (building.lastLifecycleYear - building.stateSinceYear < delay && elapsed <= delay) return;
  building.natureReclaim = Math.min(1, building.natureReclaim + elapsed * (building.lifecycleState === 'ruin' ? .055 : .035));
  if (Math.floor(building.natureReclaim * 4) !== previousBand) markChanged(city, map, building);
}

function abandonmentPressure(city: City, kingdom: Kingdom | null, building: Building): number {
  if (building.fortificationRole || building.type === 'town_center') return 0;
  const peak = Math.max(1, city.peakPopulation, city.population);
  const populationLoss = Math.max(0, 1 - city.population / peak);
  const economicCrisis = Math.max(0, .62 - city.prosperity) / .62;
  const district = districtForBuilding(city, building);
  const isolation = 1 - (district?.accessibility ?? building.urbanContext?.accessibility ?? .35);
  const localDecline = 1 - (district?.desirability ?? building.urbanContext?.desirability ?? .4);
  const jobs = building.definition.jobs ?? 0;
  const employmentCollapse = jobs > 0 ? Math.max(0, 1 - building.staffing) : 0;
  const housing = (building.definition.housing ?? 0) * building.level;
  const excessHousing = housing > 0 && city.housingCapacity() > 0
    ? Math.max(0, 1 - city.population / Math.max(1, city.housingCapacity()))
    : 0;
  const damage = 1 - building.hp / Math.max(1, building.maxHp);
  const siege = city.besiegerId ? 1 : 0;
  const threat = kingdom?.externalThreat ?? 0;
  let pressure = populationLoss * .3 + economicCrisis * .24 + isolation * .11 + localDecline * .08
    + employmentCollapse * .13 + excessHousing * .12 + damage * .22 + siege * .24 + threat * .05;
  if (building.definition.category === 'food') pressure -= .1;
  if (LANDMARKS.has(building.type)) pressure -= .16;
  return Math.max(0, Math.min(1.5, pressure));
}

function recoveryDemand(city: City, building: Building): number {
  const housing = (building.definition.housing ?? 0) * building.level;
  if (housing > 0) return city.population > city.housingCapacity() * .82 ? 1 : .25;
  const jobs = (building.definition.jobs ?? 0) * building.level;
  if (jobs > 0) return city.population > city.jobCount() * .72 ? .9 : city.prosperity > .62 ? .65 : .25;
  if (building.fortificationRole) return city.besiegerId || city.fortificationLines.some(line => line.status === 'active') ? .85 : .25;
  return LANDMARKS.has(building.type) ? .8 : .45;
}

function reconstructionCost(city: City, building: Building): boolean {
  const entries = Object.entries(BUILDINGS[building.type].cost) as Array<[GoodId, number]>;
  const cost = entries.map(([good, amount]) => [good, Math.max(1, Math.ceil(amount * .12))] as const);
  if (!cost.every(([good, amount]) => city.stock.get(good) >= amount)) return false;
  for (const [good, amount] of cost) {
    city.stock.take(good, amount);
    city.ledger.recordConsumed(good, amount);
  }
  return true;
}

function canReconstruct(city: City, kingdom: Kingdom | null, building: Building, year: number): boolean {
  const minimumAge = building.lifecycleState === 'ruin' ? (LANDMARKS.has(building.type) || building.fortificationRole ? 8 : 4) : 2;
  if (year - building.stateSinceYear < minimumAge || city.besiegerId || city.prosperity < .42
    || city.population < Math.max(4, city.peakPopulation * .4)) return false;
  const district = districtForBuilding(city, building);
  const localRecovery = (district?.accessibility ?? .25) * .45 + (district?.desirability ?? .3) * .25;
  const resources = Math.min(1, (city.stock.get('wood') + city.stock.get('stone') + city.stock.get('tools') * 2) / 90);
  const security = 1 - Math.min(1, kingdom?.externalThreat ?? 0);
  const score = city.prosperity * .35 + recoveryDemand(city, building) * .27 + localRecovery + resources * .12 + security * .08;
  return score >= .64;
}

function processBuilding(
  city: City,
  kingdom: Kingdom | null,
  map: TileMap,
  building: Building,
  year: number,
  result: UrbanLifecycleResult
): void {
  result.inspected++;
  const elapsed = Math.max(1, year - Math.max(building.lastLifecycleYear, building.stateSinceYear));
  const ratio = building.hp / Math.max(1, building.maxHp);

  if (building.lifecycleState === 'construction' || building.lifecycleState === 'reconstruction') {
    const rebuilding = building.lifecycleState === 'reconstruction';
    if (city.besiegerId && rebuilding) { building.lastLifecycleYear = year; return; }
    const previousBand = Math.floor(building.lifecycleProgress * 3);
    const rate = rebuilding ? .2 + city.prosperity * .18 : .28 + city.prosperity * .18;
    building.lifecycleProgress = Math.min(1, building.lifecycleProgress + elapsed * rate);
    building.hp = Math.max(1, building.maxHp * Math.max(.18, building.lifecycleProgress));
    if (building.lifecycleProgress >= 1) {
      building.completeConstruction(year);
      if (rebuilding) {
        building.recordRenovation(year, city.urbanPhase);
        if (city.architecturalProfile) building.recordArchitecture(buildingArchitecturalStamp(city.architecturalProfile, year));
        building.urbanContext = urbanContextAt(city, building.x, building.y, year);
        result.reconstructed++;
      } else {
        result.constructionCompleted++;
      }
      markChanged(city, map, building);
    } else if (Math.floor(building.lifecycleProgress * 3) !== previousBand) {
      markChanged(city, map, building);
    }
    building.lastLifecycleYear = year;
    return;
  }

  if (ratio <= .12 && building.lifecycleState !== 'ruin') {
    building.hp = Math.max(1, building.maxHp * .08);
    building.lifecycleProgress = 0;
    if (building.transitionLifecycle('ruin', year, building.lastDamageCause ?? 'unknown')) {
      result.ruined++;
      vacate(building, result);
      markChanged(city, map, building);
    }
  } else if (ratio < .9 && building.lifecycleState === 'normal') {
    if (building.transitionLifecycle('damaged', year, building.lastDamageCause ?? 'unknown')) markChanged(city, map, building);
  } else if (ratio >= .9 && building.lifecycleState === 'damaged') {
    if (building.transitionLifecycle('normal', year, 'repair')) {
      result.repaired++;
      markChanged(city, map, building);
    }
  }

  if (building.lifecycleState === 'ruin') {
    advanceNature(city, map, building, elapsed);
    if (canReconstruct(city, kingdom, building, year) && reconstructionCost(city, building)) {
      building.beginReconstruction(year);
      result.reconstructionStarted++;
      markChanged(city, map, building);
    } else if (!building.fortificationRole && !LANDMARKS.has(building.type)
      && year - building.stateSinceYear >= 32 && city.population < city.peakPopulation * .45 && city.prosperity < .38) {
      const tile = map.getTile(building.x, building.y);
      if (tile?.buildingId === building.id) { tile.buildingId = null; tile.cityId = null; }
      city.removeBuilding(building.id);
      map.markRenderDirty(building.x, building.y);
      UrbanDistrictPlanner.markDirty(city, map, building.x, building.y);
      result.demolished++;
    }
    building.lastLifecycleYear = year;
    return;
  }

  if (building.lifecycleState === 'abandoned') {
    building.abandonmentYears += elapsed;
    advanceNature(city, map, building, elapsed);
    if (canReconstruct(city, kingdom, building, year) && reconstructionCost(city, building)) {
      building.beginReconstruction(year);
      result.reconstructionStarted++;
      markChanged(city, map, building);
    } else if (building.abandonmentYears >= 16) {
      building.hp = Math.max(1, building.maxHp * .08);
      building.lastDamageCause = 'abandonment';
      if (building.transitionLifecycle('ruin', year, 'abandonment')) {
        result.ruined++;
        markChanged(city, map, building);
      }
    }
    building.lastLifecycleYear = year;
    return;
  }

  const pressure = abandonmentPressure(city, kingdom, building);
  if (pressure >= .62) building.abandonmentYears += elapsed;
  else building.abandonmentYears = Math.max(0, building.abandonmentYears - elapsed * .75);
  if (building.abandonmentYears >= 3) {
    building.hp = Math.min(building.hp, building.maxHp * .58);
    if (building.transitionLifecycle('abandoned', year, 'abandonment')) {
      result.abandoned++;
      vacate(building, result);
      markChanged(city, map, building);
    }
  }
  building.lastLifecycleYear = year;
}

function logLifecycle(city: City, year: number, result: UrbanLifecycleResult): void {
  if (result.ruined >= 3 && (city.urbanLifecycleChronicle.lastDestructionYear == null || year - city.urbanLifecycleChronicle.lastDestructionYear >= 8)) {
    chronicle.log(year, 'disaster', `${city.name} perdeu uma parte importante de sua malha urbana; ruínas passaram a marcar a cidade.`, {
      title: `Destruição em ${city.name}`, importance: 'major', scope: 'city',
      refs: [{ kind: 'city', id: city.id, name: city.name }], tags: ['city', 'destruction', 'ruins'],
      causes: ['Danos acumulados e crise urbana tornaram várias construções inutilizáveis.'],
      consequences: ['A recuperação dependerá de população, segurança, demanda e materiais.'], data: { ruined: result.ruined }
    });
    city.urbanLifecycleChronicle.lastDestructionYear = year;
  }
  if (result.abandoned >= 3 && (city.urbanLifecycleChronicle.lastAbandonmentYear == null || year - city.urbanLifecycleChronicle.lastAbandonmentYear >= 12)) {
    chronicle.log(year, 'economy', `A crise de ${city.name} esvaziou ruas e locais de trabalho em uma parte da cidade.`, {
      title: `Abandono urbano em ${city.name}`, importance: 'notable', scope: 'city',
      refs: [{ kind: 'city', id: city.id, name: city.name }], tags: ['city', 'abandonment', 'economy'],
      causes: ['Despovoamento, baixa atividade, isolamento ou falta de empregos reduziram a manutenção local.'],
      consequences: ['Prédios vazios poderão arruinar ou ser reutilizados quando a cidade se recuperar.'], data: { abandoned: result.abandoned }
    });
    city.urbanLifecycleChronicle.lastAbandonmentYear = year;
  }
  if (result.reconstructionStarted >= 2 && (city.urbanLifecycleChronicle.lastReconstructionYear == null || year - city.urbanLifecycleChronicle.lastReconstructionYear >= 8)) {
    chronicle.log(year, 'founding', `${city.name} iniciou uma reconstrução urbana gradual sobre áreas antes abandonadas ou destruídas.`, {
      title: `Reconstrução de ${city.name}`, importance: 'notable', scope: 'city',
      refs: [{ kind: 'city', id: city.id, name: city.name }], tags: ['city', 'reconstruction'],
      causes: ['População, atividade econômica, segurança e materiais voltaram a sustentar obras.'],
      consequences: ['A arquitetura atual passará a coexistir com as camadas históricas sobreviventes.'], data: { projects: result.reconstructionStarted }
    });
    city.urbanLifecycleChronicle.lastReconstructionYear = year;
  }
  if (result.reconstructed >= 2 && (city.urbanLifecycleChronicle.lastRecoveryYear == null || year - city.urbanLifecycleChronicle.lastRecoveryYear >= 10)) {
    chronicle.log(year, 'economy', `${city.name} recuperou uma área urbana que havia permanecido em decadência.`, {
      title: `Recuperação de ${city.name}`, importance: 'notable', scope: 'city',
      refs: [{ kind: 'city', id: city.id, name: city.name }], tags: ['city', 'recovery', 'history'],
      consequences: ['Construções da era atual passaram a ocupar cicatrizes de uma crise anterior.'], data: { reconstructed: result.reconstructed }
    });
    city.urbanLifecycleChronicle.lastRecoveryYear = year;
  }
}

export class UrbanLifecycleManager {
  /** Applies only the buildings named by per-tick fire/disaster events. */
  public static applyDamageEvents(
    cities: ReadonlyMap<string, City>,
    map: TileMap,
    events: readonly PendingBuildingDamage[],
    year: number
  ): BuildingDamageSummary[] {
    const summaries = new Map<string, BuildingDamageSummary>();
    for (const event of events) {
      const city = cities.get(event.cityId);
      const building = city?.buildings.get(event.buildingId);
      if (!city || !building) continue;
      const before = building.lifecycleState;
      building.applyDamage(building.maxHp * event.fraction, year, event.cause);
      markChanged(city, map, building);
      if (building.lifecycleState === 'ruin') {
        building.assignedWorkerIds.clear(); building.residentIds.clear();
      }
      let summary = summaries.get(city.id);
      if (!summary) {
        summary = { cityId: city.id, fire: 0, disaster: 0, ruined: 0, buildingIds: [] };
        summaries.set(city.id, summary);
      }
      summary[event.cause]++;
      if (building.lifecycleState === 'ruin' && before !== 'ruin') summary.ruined++;
      summary.buildingIds.push(building.id);
    }
    for (const summary of summaries.values()) {
      const city = cities.get(summary.cityId)!;
      if (summary.fire >= 3 && (city.urbanLifecycleChronicle.lastFireYear == null || year - city.urbanLifecycleChronicle.lastFireYear >= 6)) {
        chronicle.log(year, 'disaster', `Um grande incêndio atingiu ${city.name}, danificando ${summary.fire} construções${summary.ruined ? ` e deixando ${summary.ruined} em ruínas` : ''}.`, {
          title: `Grande incêndio de ${city.name}`, importance: summary.ruined >= 2 ? 'major' : 'notable', scope: 'city',
          refs: [{ kind: 'city', id: city.id, name: city.name }], tags: ['city', 'fire', 'destruction'],
          causes: ['O fogo existente alcançou lotes construídos e se propagou pelas condições locais.'],
          consequences: ['Os danos permanecerão até reparo ou reconstrução.'], data: { damaged: summary.fire, ruined: summary.ruined }
        });
        city.urbanLifecycleChronicle.lastFireYear = year;
      }
    }
    return [...summaries.values()];
  }

  public static tickCity(city: City, kingdom: Kingdom | null, map: TileMap, year: number): UrbanLifecycleResult {
    const result = emptyResult();
    const runtime = runtimeFor(city);
    const schedule = cadence(map.regionStateAt(city.x, city.y));
    if (runtime.lastTickYear === year || year - runtime.lastTickYear < schedule.interval) return result;
    runtime.lastTickYear = year;

    city.peakPopulation = Math.max(city.peakPopulation, city.population);
    const severeCrisis = city.besiegerId != null || city.famineYears >= 2 || city.prosperity < .3
      || city.population < Math.max(4, city.peakPopulation * .55);
    city.urbanCrisisYears = severeCrisis ? city.urbanCrisisYears + schedule.interval : Math.max(0, city.urbanCrisisYears - schedule.interval);

    for (const id of chooseIds(city, runtime, schedule.budget)) {
      const building = city.buildings.get(id);
      if (building) processBuilding(city, kingdom, map, building, year, result);
    }
    if (result.abandoned || result.ruined || result.reconstructionStarted || result.reconstructed || result.demolished) {
      city.stock.capacity = city.tierInfo.storage + city.storageBonus();
    }
    logLifecycle(city, year, result);
    return result;
  }
}

export function measureUrbanLifecycle(city: City): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const building of city.buildings.values()) counts[building.lifecycleState] = (counts[building.lifecycleState] ?? 0) + 1;
  return counts;
}
