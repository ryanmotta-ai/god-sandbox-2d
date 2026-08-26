import { GoodId } from './Goods';
import { Kingdom } from './Kingdom';
import { City } from './City';

/**
 * The fighting navy.
 *
 * `SHIP_TIERS` in `NavalSystem` is a four-rung ladder of merchant hulls and it
 * stays exactly that — a trade route wants one number for speed and one for
 * cargo, and nothing there needs to know what a torpedo is. A war fleet is a
 * different question: it is a *composition*, and what beats it depends on what
 * is in it. A line of battleships is helpless against something it cannot see;
 * a wolfpack is scrap the moment a destroyer gets a bearing on it.
 *
 * So warships are their own catalogue, with roles that answer each other:
 *
 *   line       — carries the guns, wins the stand-up fight, slow
 *   escort     — screens the transports, and is what finds submarines
 *   raider     — fast, thin, hunts transports and runs from the line
 *   submarine  — invisible until it fires, and useless once seen
 *   transport  — carries the army; the entire reason the rest of them are there
 *   carrier    — reaches past the horizon, late and expensive
 *
 * Every class is gated on a technology that actually exists in the tree, so the
 * ladder a realm can field is a readout of its own history.
 */

export type WarshipRole = 'line' | 'escort' | 'raider' | 'submarine' | 'transport' | 'carrier';

export type WarshipId =
  | 'war_canoe' | 'bireme' | 'trireme'
  | 'cog' | 'caravel' | 'carrack'
  | 'galleon' | 'frigate' | 'ship_of_the_line'
  | 'ironclad' | 'corvette' | 'cruiser' | 'destroyer'
  | 'battleship' | 'submarine' | 'carrier' | 'landing_craft';

export interface WarshipClass {
  id: WarshipId;
  name: string;
  icon: string;
  role: WarshipRole;
  /** Technology that must be known before a yard can lay one down. */
  requiresTech: string | null;
  /** Whether a military yard is needed, or any harbour will do. */
  requiresYard: boolean;
  /** Contribution to the fleet's ability to absorb damage. */
  hull: number;
  /** Contribution to damage dealt per volley. */
  guns: number;
  /** Tiles per tick this class can sustain; a fleet moves at its slowest. */
  speed: number;
  /** Soldiers this hull can carry. */
  berths: number;
  /**
   * Chance per volley of getting a bearing on a submerged boat.
   *
   * Zero for every `line` hull, and that is the rule rather than an oversight: a
   * capital ship cannot see under the water. It is the entire reason a screen
   * exists, and making it a small number instead of zero turned the wolfpack
   * duel into a coin flip that said nothing. Escorts and carriers hunt; the line
   * carries guns and hopes somebody else is listening.
   */
  detection: number;
  /** 0 = plainly visible. 1 = cannot be fired on until it is detected. */
  stealth: number;
  cost: Partial<Record<GoodId, number>>;
  description: string;
}

/**
 * Ordered oldest to newest. `bestAvailable` walks this backwards, so a realm
 * always fields the most advanced hull it can actually build rather than the
 * first one that happens to match.
 */
export const WARSHIPS: Record<WarshipId, WarshipClass> = {
  war_canoe: {
    id: 'war_canoe', name: 'Canoa de Guerra', icon: '🛶', role: 'raider',
    requiresTech: null, requiresYard: false,
    hull: 8, guns: 3, speed: 0.020, berths: 4, detection: 0, stealth: 0,
    cost: { wood: 6 },
    description: 'Casco escavado com guerreiros a remo. Rápida na costa, indefesa em mar aberto.'
  },
  bireme: {
    id: 'bireme', name: 'Birreme', icon: '🚣', role: 'line',
    requiresTech: 'bronze_working', requiresYard: false,
    hull: 22, guns: 8, speed: 0.017, berths: 8, detection: 0, stealth: 0,
    cost: { wood: 18, bronze: 2 },
    description: 'Dois bancos de remos e um aríete de bronze na proa. A primeira coisa no mar feita para afundar outra.'
  },
  trireme: {
    id: 'trireme', name: 'Trirreme', icon: '⛵', role: 'line',
    requiresTech: 'iron_working', requiresYard: true,
    hull: 34, guns: 13, speed: 0.019, berths: 10, detection: 0, stealth: 0,
    cost: { wood: 28, iron: 4, tools: 2 },
    description: 'Três bancos, aríete ferrado e uma tripulação treinada para a manobra. O arsenal clássico em uma peça.'
  },
  cog: {
    id: 'cog', name: 'Coca', icon: '⛵', role: 'transport',
    requiresTech: 'sailing', requiresYard: false,
    hull: 18, guns: 2, speed: 0.015, berths: 16, detection: 0, stealth: 0,
    cost: { wood: 20 },
    description: 'Bojuda, lenta e com um porão enorme. Não briga: leva.'
  },
  caravel: {
    id: 'caravel', name: 'Caravela', icon: '⛵', role: 'escort',
    requiresTech: 'engineering', requiresYard: false,
    hull: 30, guns: 11, speed: 0.026, berths: 12, detection: 0.05, stealth: 0,
    cost: { wood: 32, tools: 3 },
    description: 'Latina, leve e capaz de bolinar contra o vento. Escolta e explora onde o casco pesado não chega.'
  },
  carrack: {
    id: 'carrack', name: 'Nau', icon: '🚢', role: 'transport',
    requiresTech: 'engineering', requiresYard: false,
    hull: 46, guns: 9, speed: 0.018, berths: 30, detection: 0, stealth: 0,
    cost: { wood: 55, tools: 5, cloth: 4 },
    description: 'Castelos de proa e popa, três mastros e porão para uma pequena hoste. O transporte oceânico da era da vela.'
  },
  galleon: {
    id: 'galleon', name: 'Galeão de Guerra', icon: '🚢', role: 'line',
    requiresTech: 'gunpowder', requiresYard: true,
    hull: 78, guns: 30, speed: 0.020, berths: 22, detection: 0, stealth: 0,
    cost: { wood: 70, iron: 10, gunpowder: 6, tools: 6 },
    description: 'Bordas artilhadas em duas cobertas. Carrega tropa e ainda troca bordadas de igual para igual.'
  },
  frigate: {
    id: 'frigate', name: 'Fragata', icon: '⛵', role: 'raider',
    requiresTech: 'gunpowder', requiresYard: true,
    hull: 52, guns: 24, speed: 0.031, berths: 8, detection: 0.10, stealth: 0,
    cost: { wood: 58, iron: 8, gunpowder: 5 },
    description: 'Rápida demais para a linha de batalha e forte demais para o comboio. Caça transporte e foge do encouraçado.'
  },
  ship_of_the_line: {
    id: 'ship_of_the_line', name: 'Nau de Linha', icon: '🚢', role: 'line',
    requiresTech: 'metallurgy', requiresYard: true,
    hull: 130, guns: 52, speed: 0.016, berths: 18, detection: 0, stealth: 0,
    cost: { wood: 110, iron: 24, gunpowder: 14, tools: 10 },
    description: 'Setenta e quatro peças em três cobertas. Lenta como uma catedral e igualmente difícil de derrubar.'
  },
  ironclad: {
    id: 'ironclad', name: 'Encouraçado a Vapor', icon: '🛳️', role: 'line',
    requiresTech: 'steam_power', requiresYard: true,
    hull: 190, guns: 66, speed: 0.022, berths: 14, detection: 0, stealth: 0,
    cost: { steel: 30, coal: 20, gunpowder: 16, tools: 12 },
    description: 'Blindagem de ferro sobre casco de madeira e uma caldeira no ventre. Tornou obsoleta toda vela de guerra que existia.'
  },
  corvette: {
    id: 'corvette', name: 'Corveta', icon: '🛥️', role: 'escort',
    requiresTech: 'steam_power', requiresYard: true,
    hull: 84, guns: 34, speed: 0.040, berths: 6, detection: 0.30, stealth: 0,
    cost: { steel: 16, coal: 10, gunpowder: 8 },
    description: 'Pequena, veloz e barata de fazer aos montes. A escolta que o comboio realmente consegue pagar.'
  },
  cruiser: {
    id: 'cruiser', name: 'Cruzador', icon: '🛳️', role: 'line',
    requiresTech: 'industrialization', requiresYard: true,
    hull: 240, guns: 92, speed: 0.034, berths: 20, detection: 0, stealth: 0,
    cost: { steel: 48, fuel: 14, gunpowder: 20, machinery: 6 },
    description: 'Autonomia oceânica com artilharia pesada. Faz sozinho o serviço que antes exigia um esquadrão.'
  },
  destroyer: {
    id: 'destroyer', name: 'Contratorpedeiro', icon: '🛥️', role: 'escort',
    requiresTech: 'industrialization', requiresYard: true,
    hull: 120, guns: 48, speed: 0.052, berths: 8, detection: 0.62, stealth: 0,
    cost: { steel: 34, fuel: 12, gunpowder: 14, machinery: 4 },
    description: 'Existe por um motivo: achar o que está debaixo d\'água. Rápido, hidrofones e cargas de profundidade.'
  },
  battleship: {
    id: 'battleship', name: 'Encouraçado', icon: '🛳️', role: 'line',
    requiresTech: 'electricity', requiresYard: true,
    hull: 420, guns: 170, speed: 0.026, berths: 16, detection: 0, stealth: 0,
    cost: { steel: 110, fuel: 30, gunpowder: 40, machinery: 18 },
    description: 'Torres principais capazes de bater além do horizonte. Um único casco que define o poder naval de um reino.'
  },
  submarine: {
    id: 'submarine', name: 'Submarino', icon: '🌊', role: 'submarine',
    requiresTech: 'electricity', requiresYard: true,
    hull: 62, guns: 112, speed: 0.028, berths: 0, detection: 0.08, stealth: 0.86,
    cost: { steel: 40, fuel: 16, machinery: 12, copper: 14 },
    description: 'Motor elétrico para navegar submerso e torpedos para o que não o vê chegar. Frágil no instante em que é achado.'
  },
  carrier: {
    id: 'carrier', name: 'Porta-Aviões', icon: '🛳️', role: 'carrier',
    requiresTech: 'mass_media', requiresYard: true,
    hull: 300, guns: 205, speed: 0.032, berths: 24, detection: 0.55, stealth: 0,
    cost: { steel: 140, fuel: 45, machinery: 30, rubber: 12 },
    description: 'Convés corrido e um grupo aéreo. Ataca a uma distância em que a artilharia do inimigo é decoração.'
  },
  landing_craft: {
    id: 'landing_craft', name: 'Barcaça de Desembarque', icon: '🚤', role: 'transport',
    requiresTech: 'industrialization', requiresYard: true,
    hull: 40, guns: 6, speed: 0.045, berths: 40, detection: 0, stealth: 0,
    cost: { steel: 18, fuel: 6, machinery: 3 },
    description: 'Fundo chato e rampa de proa: encosta na areia e despeja a tropa em pé, sem bote e sem cais.'
  }
};

export const ALL_WARSHIPS: WarshipClass[] = Object.values(WARSHIPS);

/** How many of each class a fleet is made of. */
export type FleetComposition = Partial<Record<WarshipId, number>>;

export interface FleetStats {
  hull: number;
  guns: number;
  /** A fleet is only as fast as its slowest hull. */
  speed: number;
  berths: number;
  /** 0..1 chance per volley of getting a bearing on a submerged boat. */
  detection: number;
  /** True while the whole fleet is submarines and nothing has seen them. */
  submerged: boolean;
  hulls: number;
}

export function fleetStats(composition: FleetComposition): FleetStats {
  let hull = 0, guns = 0, berths = 0, hulls = 0;
  let speed = Infinity;
  let subs = 0;
  // Detection is combined as independent chances rather than summed, so a screen
  // of twelve destroyers approaches certainty without ever passing it.
  let miss = 1;

  for (const [id, count] of Object.entries(composition) as [WarshipId, number][]) {
    if (!count || count <= 0) continue;
    const ship = WARSHIPS[id];
    if (!ship) continue;
    hull += ship.hull * count;
    guns += ship.guns * count;
    berths += ship.berths * count;
    hulls += count;
    speed = Math.min(speed, ship.speed);
    miss *= Math.pow(1 - ship.detection, count);
    if (ship.role === 'submarine') subs += count;
  }

  return {
    hull, guns, berths, hulls,
    speed: Number.isFinite(speed) ? speed : 0.02,
    detection: 1 - miss,
    submerged: hulls > 0 && subs === hulls
  };
}

/** Everything this realm's technology and yards allow it to lay down. */
export function availableWarships(kingdom: Kingdom, hasYard: boolean): WarshipClass[] {
  return ALL_WARSHIPS.filter(ship => {
    if (ship.requiresYard && !hasYard) return false;
    if (ship.requiresTech && !kingdom.research.knows(ship.requiresTech)) return false;
    return true;
  });
}

/** The most advanced hull of a role that this realm can actually build. */
export function bestAvailable(role: WarshipRole, available: WarshipClass[]): WarshipClass | null {
  const ordered = ALL_WARSHIPS.filter(s => s.role === role);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const candidate = ordered[i];
    if (available.some(a => a.id === candidate.id)) return candidate;
  }
  return null;
}

export function canAfford(city: City, cost: Partial<Record<GoodId, number>>, multiplier: number = 1): boolean {
  for (const [good, amount] of Object.entries(cost) as [GoodId, number][]) {
    if (city.stock.get(good) < amount * multiplier) return false;
  }
  return true;
}

export function payFor(city: City, cost: Partial<Record<GoodId, number>>, multiplier: number = 1): void {
  for (const [good, amount] of Object.entries(cost) as [GoodId, number][]) {
    const used = city.stock.take(good, amount * multiplier);
    city.ledger.recordConsumed(good, used);
  }
}

/**
 * What a realm sails with, given what it can build and what is in the warehouse.
 *
 * The shape of the fleet is doctrine, not arithmetic: enough berths to carry the
 * army, a screen in front of it, a line behind it, and — once the technology
 * exists — boats that go under. It buys in that order and stops when the
 * stockpile does, so a poor realm still sails, just naked.
 */
export function assembleFleet(
  kingdom: Kingdom,
  city: City,
  hasYard: boolean,
  soldiers: number
): FleetComposition {
  const available = availableWarships(kingdom, hasYard);
  if (available.length === 0) return {};

  const composition: FleetComposition = {};
  const buy = (ship: WarshipClass | null, count: number): number => {
    if (!ship || count <= 0) return 0;
    let bought = 0;
    for (let i = 0; i < count; i++) {
      if (!canAfford(city, ship.cost)) break;
      payFor(city, ship.cost);
      composition[ship.id] = (composition[ship.id] ?? 0) + 1;
      bought++;
    }
    return bought;
  };

  /**
   * 1. Berths first. An invasion with no transports is a naval patrol.
   *
   * The fallback chain matters more than it looks. A purpose-built transport is
   * the right answer, a ship of the line with a crowded orlop deck is the next
   * best — and last of all, *anything at all with a bunk in it*. That final rung
   * is what lets a realm which has discovered nothing mount a raid in war
   * canoes: the canoe carries four, but its role is `raider`, so a chain that
   * stopped at transports and line ships left a stone-age people with no way to
   * cross water even though the only hull they can build would have done it.
   */
  const transport =
    bestAvailable('transport', available)
    ?? bestAvailable('line', available)
    ?? available.filter(s => s.berths > 0).sort((a, b) => a.berths - b.berths).pop()
    ?? null;
  if (!transport || transport.berths <= 0) return {};
  const needed = Math.max(1, Math.ceil(soldiers / Math.max(1, transport.berths || 8)));
  if (buy(transport, needed) === 0) return {};

  // 2. A screen. Roughly one escort per two transports, minimum one.
  const escort = bestAvailable('escort', available);
  buy(escort, Math.max(1, Math.round((composition[transport.id] ?? 1) / 2)));

  // 3. Weight of shot, if the treasury stretches to it.
  buy(bestAvailable('line', available), Math.max(1, Math.round((composition[transport.id] ?? 1) / 3)));

  // 4. Whatever hunts on its own. Raiders are cheap; submarines are not, and a
  //    realm that has them sends few and expects them to matter.
  buy(bestAvailable('raider', available), 1);
  buy(bestAvailable('submarine', available), 1);
  buy(bestAvailable('carrier', available), 1);

  return composition;
}

/** A short human name for a fleet, from whatever is heaviest in it. */
export function describeFleet(composition: FleetComposition): string {
  const parts: string[] = [];
  for (const [id, count] of Object.entries(composition) as [WarshipId, number][]) {
    if (!count) continue;
    const ship = WARSHIPS[id];
    if (ship) parts.push(count > 1 ? `${count} ${ship.name}s` : `1 ${ship.name}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'nenhum casco';
}

/** The class that best represents a fleet on the map: the heaviest hull in it. */
export function flagshipOf(composition: FleetComposition): WarshipClass | null {
  let best: WarshipClass | null = null;
  for (const [id, count] of Object.entries(composition) as [WarshipId, number][]) {
    if (!count || count <= 0) continue;
    const ship = WARSHIPS[id];
    if (ship && (!best || ship.hull > best.hull)) best = ship;
  }
  return best;
}
