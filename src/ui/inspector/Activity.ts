/**
 * What a citizen is doing, and why.
 *
 * This is the module the whole UI-2 brief hinges on. `aiState` is an internal
 * enum — `gather_ore`, `return_home`, `deliver` — and printing it at the player
 * answers nothing. Worse, the interesting question is never *what* state a
 * citizen is in; it is *why they are in it*.
 *
 * The answer is already in the simulation, in a form that can be read back
 * honestly: `tickAI` picks a state by walking a fixed ladder of priorities, and
 * each rung is a condition on fields that are still there afterwards. Low HP and
 * a nearby enemy produced `flee`. Hunger over `HUNGER_SEEK_FOOD` produced `eat`.
 * Dusk produced `return_home`. So the reason can be *re-derived* from the same
 * conditions rather than guessed at.
 *
 * The rule this file follows without exception: **a reason is only stated when
 * the condition that would have caused it is true right now.** Where the cause
 * cannot be established the reason is omitted, and the activity stands alone.
 * A confidently wrong explanation of a simulation is worse than no explanation,
 * because the player will believe it.
 */
import { HUNGER_SEEK_FOOD, HUNGER_STARVING, ENERGY_EXHAUSTED } from '../../entities/Needs';
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { GOODS } from '../../civ/Goods';
import { BUILDINGS } from '../../civ/Building';
import type { Status } from '../kit';
import type { Entity } from '../../entities/Entity';
import type { SimulationEngine } from '../../ai/EntityAI';

export interface Activity {
  /** One line, in the player's language. "Trabalhando na Mina de Ferro". */
  label: string;
  /**
   * Why they are doing it — omitted when the cause cannot be established.
   * Never a restatement of the label.
   */
  reason?: string;
  icon: string;
  /** Colours the line. `critical` is reserved for genuine danger. */
  status: Status;
}

/**
 * The daily routine, as the AI actually implements it.
 *
 * These hour boundaries are not decoration: they are the same numbers
 * `SimulationEngine.tickAI` compares `currentHour` against when it sets
 * `timeOfDay`, and PRIORITY 7 then maps each phase onto a state. The routine is
 * therefore real and worth showing — but it is a *world* schedule, not a
 * per-citizen one, which is why it is described in phases rather than as a
 * personal timetable.
 */
export const ROUTINE_PHASES: { phase: 'dawn' | 'day' | 'dusk' | 'night'; label: string; hours: string; doing: string; icon: string }[] = [
  { phase: 'dawn',  label: 'Amanhecer', hours: '05–08', doing: 'Vai para o trabalho', icon: 'run' },
  { phase: 'day',   label: 'Dia',       hours: '08–18', doing: 'Cumpre o ofício',     icon: 'industry' },
  { phase: 'dusk',  label: 'Anoitecer', hours: '18–21', doing: 'Volta para casa',     icon: 'building' },
  { phase: 'night', label: 'Noite',     hours: '21–05', doing: 'Descansa',            icon: 'moon' }
];

/** Verbs for the work states, keyed by what the state actually is. */
const WORK_LABEL: Partial<Record<string, string>> = {
  gather_wood: 'Cortando madeira',
  gather_food: 'Trabalhando na lavoura',
  gather_ore: 'Extraindo minério',
  craft: 'Trabalhando na bancada',
  build: 'Construindo',
  patrol: 'Patrulhando',
  explore: 'Explorando território',
  socialize: 'Conversando',
  wander: 'Vagando',
  forage: 'Forrageando',
  hunt: 'Caçando',
  pack_hunt: 'Caçando em matilha',
  defend_city: 'Defendendo a cidade',
  raid: 'Atacando território inimigo',
  return_city: 'Voltando para a cidade'
};

/**
 * Reads the current activity off a citizen.
 *
 * `sim` is needed only to resolve names — the workplace building, the nearest
 * threat — and every lookup is O(1) or bounded. Nothing here scans the world.
 */
export function describeActivity(entity: Entity, sim: SimulationEngine): Activity {
  const state = entity.aiState;

  switch (state) {
    // ---------- PRIORITY 1: flight ----------
    case 'flee': {
      // The AI flees when HP is under a quarter *and* something hostile is close.
      // The threat is named only if one is still within the radius the AI used.
      const threat = nearestThreat(entity, sim);
      return {
        label: 'Fugindo',
        reason: threat
          ? `${threat} por perto e ferido (${hpPercent(entity)}% de vida)`
          : `Ferido — ${hpPercent(entity)}% de vida`,
        icon: 'run',
        status: 'critical'
      };
    }

    // ---------- PRIORITY 2: combat ----------
    case 'attack': {
      const threat = nearestThreat(entity, sim);
      return {
        label: 'Em combate',
        reason: threat ? `Enfrentando ${threat}` : undefined,
        icon: 'war',
        status: 'critical'
      };
    }

    // ---------- PRIORITY 3: recovery ----------
    case 'heal':
      return {
        label: 'Recuperando-se',
        // The AI enters `heal` below 60% HP, so the figure is the cause.
        reason: `Ferido — ${hpPercent(entity)}% de vida`,
        icon: 'citizen',
        status: 'warning'
      };

    // ---------- PRIORITY 4: hunger ----------
    case 'eat': {
      const starving = entity.needs.hunger >= HUNGER_STARVING;
      return {
        label: starving ? 'Faminto, procurando comida' : 'Indo comer',
        reason: describeHunger(entity, sim),
        icon: 'agriculture',
        status: starving ? 'critical' : 'warning'
      };
    }

    // ---------- PRIORITY 6: delivery ----------
    case 'deliver': {
      const load = entity.carrying;
      return {
        label: 'Entregando carga',
        reason: load
          ? `Levando ${Math.round(load.amount)} de ${GOODS[load.good]?.name ?? load.good} ao armazém`
          : undefined,
        icon: 'good',
        status: 'positive'
      };
    }

    // ---------- PRIORITY 7: the clock ----------
    case 'go_to_work': {
      const workplace = workplaceName(entity, sim);
      return {
        label: workplace ? `A caminho: ${workplace}` : 'A caminho do trabalho',
        reason: 'Amanheceu — a jornada começa',
        icon: 'run',
        status: 'neutral'
      };
    }
    case 'return_home':
      return {
        label: 'Voltando para casa',
        reason: 'Anoiteceu — o turno terminou',
        icon: 'building',
        status: 'neutral'
      };

    // ---------- work ----------
    case 'gather_wood':
    case 'gather_food':
    case 'gather_ore':
    case 'craft': {
      const workplace = workplaceName(entity, sim);
      return {
        label: workplace ? `Trabalhando: ${workplace}` : WORK_LABEL[state]!,
        reason: workplace ? WORK_LABEL[state] : undefined,
        icon: 'industry',
        status: 'positive'
      };
    }

    // ---------- idle, which is the interesting one ----------
    case 'idle':
      return describeIdle(entity, sim);

    default:
      return {
        label: WORK_LABEL[state] ?? 'Ocupado',
        icon: 'citizen',
        status: 'neutral'
      };
  }
}

/**
 * Idle is where the causes actually matter.
 *
 * The state is reached from at least four different rungs of the ladder — night,
 * exhaustion, no settlement, no job — and they mean completely different things.
 * They are distinguished here by testing the same conditions, in the same order
 * the AI tests them, so the answer matches what really happened.
 */
function describeIdle(entity: Entity, sim: SimulationEngine): Activity {
  // PRIORITY 7, night branch: sets idle and recovers energy.
  if (entity.cityId && sim.timeOfDay === 'night') {
    return { label: 'Dormindo', reason: 'É noite na cidade', icon: 'moon', status: 'neutral' };
  }

  // PRIORITY 5: exhaustion sets idle and recovers energy, regardless of the hour.
  if (entity.energy <= ENERGY_EXHAUSTED) {
    return {
      label: 'Exausto',
      reason: `Sem energia (${Math.round(entity.energy)}/${entity.maxEnergy}) — descansando`,
      icon: 'citizen',
      status: 'warning'
    };
  }

  // Wildlife has no settlement and no job by design; calling that "unemployed"
  // would be a false problem.
  if (!SPECIES_DEFINITIONS[entity.species]?.isHumanoid) {
    return { label: 'Parado', icon: 'ecosystem', status: 'neutral' };
  }

  if (!entity.cityId) {
    return {
      label: 'Sem ocupação',
      reason: 'Não pertence a nenhum assentamento',
      icon: 'citizen',
      status: 'warning'
    };
  }

  if (!entity.workplaceId) {
    const city = sim.cities.get(entity.cityId);
    const free = city ? city.jobsAvailable() : 0;
    return {
      label: 'Sem ocupação',
      reason: free > 0
        // Vacancies exist but this citizen holds none, and the AI does not record
        // why the assignment did not happen — so the fact is stated, not a cause.
        ? `Sem posto de trabalho (${free} vaga${free === 1 ? '' : 's'} na cidade)`
        : `Sem posto de trabalho — nenhuma vaga em ${city?.name ?? 'sua cidade'}`,
      icon: 'citizen',
      status: 'warning'
    };
  }

  return { label: 'Parado', icon: 'citizen', status: 'neutral' };
}

/**
 * Why a citizen is going to eat.
 *
 * Hunger alone is the trigger, but the useful part is whether there is anything
 * to eat when they get there — which is readable from the household pantry and
 * the settlement store. That turns "hungry" into an answerable problem.
 */
function describeHunger(entity: Entity, sim: SimulationEngine): string {
  const hunger = Math.round(entity.needs.hunger);
  const base = entity.needs.hunger >= HUNGER_STARVING
    ? `Passando fome (${hunger}/100)`
    : `Fome em ${hunger}/100, acima do limite de ${HUNGER_SEEK_FOOD}`;

  const household = entity.householdId ? sim.households.get(entity.householdId) : undefined;
  // No household means no pantry to report on, so the hunger figure stands alone
  // rather than being dressed up with a supply claim that has no source.
  if (!household) return base;

  const pantry = household.pantry.get('food');
  if (pantry > 0.01) return `${base} · despensa com ${pantry.toFixed(1)} de comida`;

  const city = entity.cityId ? sim.cities.get(entity.cityId) : undefined;
  const store = city ? city.stock.get('food') : 0;
  return store > 0
    ? `${base} · despensa vazia, mas ${Math.round(store)} no armazém de ${city!.name}`
    : `${base} · sem comida na despensa nem no armazém de ${city?.name ?? 'sua cidade'}`;
}

/**
 * The nearest hostile creature, named by species.
 *
 * Uses the spatial hash at the same radius the AI's flee check uses, so a threat
 * is only named while it is genuinely close. Bounded by the hash cell, not by
 * the world's population.
 */
function nearestThreat(entity: Entity, sim: SimulationEngine): string | null {
  const nearby = sim.spatialHash.queryRadius(entity.x, entity.y, 6);
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const other of nearby) {
    if (other.id === entity.id) continue;
    // Same-realm creatures are not threats; unaffiliated wildlife and other
    // realms are. This mirrors the AI's own hostility test closely enough to
    // name a threat without duplicating its rules.
    const hostile = other.kingdomId !== entity.kingdomId || (!other.kingdomId && !entity.kingdomId);
    if (!hostile) continue;
    const dist = Math.hypot(other.x - entity.x, other.y - entity.y);
    if (dist < bestDist) { bestDist = dist; best = other; }
  }
  if (!best) return null;
  return SPECIES_DEFINITIONS[best.species]?.name ?? best.species;
}

/** The name of the building a citizen is assigned to, if it still stands. */
export function workplaceName(entity: Entity, sim: SimulationEngine): string | null {
  const found = findBuilding(entity.workplaceId, entity.cityId, sim);
  if (!found) return null;
  return BUILDINGS[found.building.type]?.name ?? found.building.type;
}

/**
 * Locates a building by id.
 *
 * Checks the citizen's own settlement first, which is nearly always where it is,
 * and only then sweeps the rest. Call this on selection or on a slow refresh —
 * never per frame.
 */
export function findBuilding(
  buildingId: string | null,
  hintCityId: string | null,
  sim: SimulationEngine
): { city: import('../../civ/City').City; building: import('../../civ/Building').Building } | null {
  if (!buildingId) return null;

  if (hintCityId) {
    const city = sim.cities.get(hintCityId);
    const building = city?.buildings.get(buildingId);
    if (city && building) return { city, building };
  }
  for (const city of sim.cities.values()) {
    const building = city.buildings.get(buildingId);
    if (building) return { city, building };
  }
  return null;
}

function hpPercent(entity: Entity): number {
  return Math.max(0, Math.round((entity.hp / entity.maxHp) * 100));
}
