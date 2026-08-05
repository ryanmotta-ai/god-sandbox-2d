/**
 * Selection.
 *
 * Before UI-1 clicking the world had no result you could point at: `inspectAt`
 * resolved what was under the cursor and pushed it straight into the inspector
 * drawer, and nothing anywhere held the answer to "what is selected?". So the
 * map could not show a ring, the HUD could not show a card, and an alert had
 * nowhere to send you.
 *
 * This is that missing state. It holds *what* is selected as an identity — an id,
 * never the object — because the simulation keeps running underneath: a selected
 * citizen can die, a selected city can be razed. Resolving the identity to a
 * live object happens at read time, and comes back null when the thing is gone.
 */
import { SPECIES_DEFINITIONS } from '../../entities/Species';
import { BUILDINGS } from '../../civ/Building';
import { GOODS } from '../../civ/Goods';
import { TERRAINS } from '../../world/Biomes';
import { formatFull } from '../kit';
import type { SimulationEngine } from '../../ai/EntityAI';
import type { TileMap } from '../../world/TileMap';
import type { Entity } from '../../entities/Entity';
import type { City } from '../../civ/City';
import type { Building } from '../../civ/Building';
import type { ObjectRef } from '../kit';
import type { SelectionMark } from '../../renderer/Renderer';

export type SelectionTarget =
  | { kind: 'citizen'; id: string }
  | { kind: 'city'; id: string }
  | { kind: 'kingdom'; id: string }
  | { kind: 'building'; cityId: string; buildingId: string }
  | { kind: 'tile'; x: number; y: number };

/** One line in the selection card. */
export interface Fact {
  label: string;
  value: string;
}

/**
 * A selection, resolved against the current world.
 *
 * Everything the HUD and the renderer need, and nothing that points back into
 * the simulation — so a card built from this cannot go stale into a dangling
 * object reference.
 */
export interface SelectionView {
  /** The proper noun. What the player clicked. */
  name: string;
  /** What kind of thing it is, in words. */
  kindLabel: string;
  icon: string;
  /** Realm colour, when the thing belongs to a realm. */
  accent?: string;
  /** Two or three facts. Not a dossier — that is UI-2's inspector. */
  facts: Fact[];
  /** Where it is, for the camera and the map ring. */
  worldPos: { x: number; y: number };
  /** Ring radius in tiles. */
  radius: number;
  /** The same thing in the UI-0 object vocabulary, for cross-references. */
  ref?: ObjectRef;
  /** Whether the inspector can show this kind. */
  inspectable: boolean;
}

const PROFESSION_LABEL: Record<string, string> = {
  farmer: 'Agricultor', woodcutter: 'Lenhador', miner: 'Mineiro', builder: 'Construtor',
  soldier: 'Soldado', archer: 'Arqueiro', scout: 'Batedor', healer: 'Curandeiro',
  leader: 'Líder', king: 'Monarca', none: 'Sem ofício'
};

const KIND_LABEL: Record<SelectionTarget['kind'], string> = {
  citizen: 'Habitante',
  city: 'Cidade',
  kingdom: 'Reino',
  building: 'Construção',
  tile: 'Terreno'
};

/** Ring radius per kind, in tiles. A city's ring reads as a place, not a point. */
const KIND_RADIUS: Record<SelectionTarget['kind'], number> = {
  citizen: 1, city: 3.5, kingdom: 4, building: 1.2, tile: 0.7
};

export type SelectionListener = (view: SelectionView | null) => void;

export class SelectionManager {
  private target: SelectionTarget | null = null;
  private listeners = new Set<SelectionListener>();
  private sim: SimulationEngine | null = null;
  private tileMap: TileMap | null = null;
  /**
   * The last resolved view, kept so the renderer can be handed a ring every frame
   * without re-resolving. Rebuilt whenever the selection changes or refreshes.
   */
  private markState: SelectionMark | null = null;
  /**
   * The selected citizen, held by reference.
   *
   * There is no id→entity index on the engine, so resolving a citizen costs a
   * linear scan of every entity in the world. That is fine twice a second and
   * unacceptable sixty times a second, and the ring has to follow a walking
   * citizen at frame rate. So the reference is cached here and its position read
   * directly; `refresh` is what revalidates that the citizen still exists.
   */
  private cachedEntity: Entity | null = null;

  /** Re-points at a new world. Any previous selection belonged to the old one. */
  public attach(sim: SimulationEngine, tileMap: TileMap): void {
    this.sim = sim;
    this.tileMap = tileMap;
    this.clear();
  }

  public onChange(fn: SelectionListener): void {
    this.listeners.add(fn);
  }

  public get current(): SelectionTarget | null {
    return this.target;
  }

  public get isActive(): boolean {
    return this.target !== null;
  }

  /**
   * True when something is selected but no longer exists in the world.
   *
   * Distinct from "nothing selected": the player picked a citizen who has since
   * died, or a building that has been razed. The inspector uses it to explain
   * rather than to show an empty panel.
   */
  public get isStale(): boolean {
    return this.target !== null && this.resolve() === null;
  }

  public select(target: SelectionTarget | null): void {
    this.target = target;
    this.cachedEntity = null;
    this.notify();
  }

  public clear(): void {
    if (!this.target) return;
    this.target = null;
    this.cachedEntity = null;
    this.notify();
  }

  private notify(): void {
    const view = this.resolve();
    // A target that stops resolving is *kept*, not dropped.
    //
    // UI-1 cleared it here, which was right for the selection card — a card for a
    // dead citizen should disappear. But it made it impossible for anything else
    // to know that the thing had died rather than been deselected, and the
    // inspector needs exactly that distinction to say "this no longer exists"
    // instead of "nothing selected".
    //
    // So the target survives and `resolve()` returns null. Consumers decide:
    // the card hides, the map drops its ring, the inspector explains.
    if (!view) this.cachedEntity = null;
    this.markState = view
      ? {
          x: view.worldPos.x,
          y: view.worldPos.y,
          radius: view.radius,
          color: view.accent ?? '#c9a153',
          label: view.name
        }
      : null;
    for (const fn of this.listeners) fn(view);
  }

  /**
   * The ring to draw this frame, or null.
   *
   * Cheap by construction: everything but a citizen's position is static between
   * refreshes, and a citizen's comes straight off the cached reference.
   */
  public mark(): SelectionMark | null {
    if (!this.markState) return null;
    if (this.target?.kind === 'citizen' && this.cachedEntity) {
      // A citizen who died keeps its ring for at most one refresh interval, then
      // `refresh` fails to resolve it and the whole selection clears.
      if (this.cachedEntity.hp <= 0) return null;
      this.markState.x = this.cachedEntity.x;
      this.markState.y = this.cachedEntity.y;
    }
    return this.markState;
  }

  /**
   * Re-notifies listeners without changing the selection.
   *
   * Called on a slow cadence so a selected city's population keeps up with the
   * world. Deliberately *not* per frame: the card shows figures that move on the
   * scale of years.
   */
  public refresh(): void {
    if (!this.target) return;
    this.notify();
  }

  /**
   * What is at this tile.
   *
   * The priority order is the one `main.ts` already used for inspection —
   * creature, then settlement, then ground — extended with buildings, which sit
   * between the two: a click on a mine should select the mine, not the city that
   * owns it. Selecting nothing selects the tile, because "what is this ground?"
   * is a real question and an empty card is not an answer.
   */
  public selectAt(tx: number, ty: number): SelectionView | null {
    if (!this.sim) return null;

    const hits = this.sim.spatialHash.queryRadius(tx, ty, 2);
    if (hits.length > 0) {
      this.select({ kind: 'citizen', id: hits[0].id });
      return this.resolve();
    }

    const building = this.buildingAt(tx, ty);
    if (building) {
      this.select({ kind: 'building', cityId: building.city.id, buildingId: building.building.id });
      return this.resolve();
    }

    const tile = this.tileMap?.getTile(tx, ty);
    if (tile?.cityId && this.sim.cities.has(tile.cityId)) {
      this.select({ kind: 'city', id: tile.cityId });
      return this.resolve();
    }

    for (const city of this.sim.cities.values()) {
      if (city.territory.has(`${tx},${ty}`)) {
        this.select({ kind: 'city', id: city.id });
        return this.resolve();
      }
    }

    this.select({ kind: 'tile', x: tx, y: ty });
    return this.resolve();
  }

  /**
   * The building standing on this tile, if any.
   *
   * The tile itself records `buildingId`, so this is two map lookups rather than
   * a sweep of every building in the world. Falls back to a scan only when the
   * tile names a building but not its city — which the terrain edit tools can
   * leave behind.
   */
  private buildingAt(tx: number, ty: number): { city: City; building: Building } | null {
    if (!this.sim) return null;
    const tile = this.tileMap?.getTile(tx, ty);
    if (!tile?.buildingId) return null;

    if (tile.cityId) {
      const city = this.sim.cities.get(tile.cityId);
      const building = city?.buildings.get(tile.buildingId);
      if (city && building) return { city, building };
    }

    for (const city of this.sim.cities.values()) {
      const building = city.buildings.get(tile.buildingId);
      if (building) return { city, building };
    }
    return null;
  }

  // ============================ RESOLUTION ============================

  /** The current selection as a view, or null if it no longer exists. */
  public resolve(): SelectionView | null {
    const t = this.target;
    if (!t || !this.sim) return null;

    switch (t.kind) {
      case 'citizen': return this.viewCitizen(t.id);
      case 'city': return this.viewCity(t.id);
      case 'kingdom': return this.viewKingdom(t.id);
      case 'building': return this.viewBuilding(t.cityId, t.buildingId);
      case 'tile': return this.viewTile(t.x, t.y);
      default: return null;
    }
  }

  private viewCitizen(id: string): SelectionView | null {
    // The cached reference is trusted only while it still matches the target and
    // is still alive; otherwise pay for the scan and re-cache.
    let entity: Entity | null =
      this.cachedEntity?.id === id && this.cachedEntity.hp > 0 ? this.cachedEntity : null;
    if (!entity) {
      entity = this.sim!.entities.find(e => e.id === id) ?? null;
      this.cachedEntity = entity;
    }
    // A citizen who died since being selected simply stops resolving. The card
    // disappears rather than showing the last thing known about a corpse.
    if (!entity) return null;

    const species = SPECIES_DEFINITIONS[entity.species];
    const kingdom = entity.kingdomId ? this.sim!.kingdoms.get(entity.kingdomId) : undefined;
    const city = entity.cityId ? this.sim!.cities.get(entity.cityId) : undefined;

    const facts: Fact[] = [
      { label: 'Ofício', value: PROFESSION_LABEL[entity.profession] ?? entity.profession },
      { label: 'Idade', value: `${Math.floor(entity.age)}` }
    ];
    if (city) facts.push({ label: 'Cidade', value: city.name });
    else if (kingdom) facts.push({ label: 'Reino', value: kingdom.name });
    else facts.push({ label: 'Espécie', value: species?.name ?? entity.species });

    return {
      name: entity.name,
      kindLabel: entity.title ?? KIND_LABEL.citizen,
      icon: entity.isGreatPerson ? 'crown' : 'citizen',
      accent: kingdom?.color,
      facts,
      worldPos: { x: entity.x, y: entity.y },
      radius: KIND_RADIUS.citizen,
      ref: { kind: 'citizen', id: entity.id, name: entity.name, qualifier: species?.name },
      inspectable: true
    };
  }

  private viewCity(id: string): SelectionView | null {
    const city = this.sim!.cities.get(id);
    if (!city) return null;
    const kingdom = city.kingdomId ? this.sim!.kingdoms.get(city.kingdomId) : undefined;

    const facts: Fact[] = [
      { label: 'População', value: formatFull(city.population) },
      { label: 'Categoria', value: city.tierInfo.name }
    ];
    facts.push({ label: 'Reino', value: kingdom?.name ?? 'Independente' });
    // A siege or a famine is the most important thing about a city, so it
    // displaces the least important fact rather than being appended out of sight.
    if (city.besiegerId) {
      const besieger = this.sim!.kingdoms.get(city.besiegerId);
      facts[1] = { label: 'Sitiada por', value: besieger?.name ?? 'um exército' };
    } else if (city.famineYears > 0) {
      facts[1] = { label: 'Fome', value: `${city.famineYears} ${city.famineYears === 1 ? 'ano' : 'anos'}` };
    }

    return {
      name: city.name,
      kindLabel: city.tierInfo.name,
      icon: 'city',
      accent: kingdom?.color,
      facts,
      worldPos: { x: city.x, y: city.y },
      radius: KIND_RADIUS.city,
      ref: { kind: 'city', id: city.id, name: city.name, accent: kingdom?.color, qualifier: kingdom?.name },
      inspectable: true
    };
  }

  private viewKingdom(id: string): SelectionView | null {
    const kingdom = this.sim!.kingdoms.get(id);
    if (!kingdom) return null;

    let population = 0;
    for (const cityId of kingdom.cityIds) {
      population += this.sim!.cities.get(cityId)?.population ?? 0;
    }
    const capital = this.sim!.cities.get(kingdom.capitalCityId);

    return {
      name: kingdom.name,
      kindLabel: KIND_LABEL.kingdom,
      icon: 'kingdom',
      accent: kingdom.color,
      facts: [
        { label: 'População', value: formatFull(population) },
        { label: 'Cidades', value: `${kingdom.cityIds.size}` },
        { label: 'Capital', value: capital?.name ?? '—' }
      ],
      worldPos: capital ? { x: capital.x, y: capital.y } : { x: 0, y: 0 },
      radius: KIND_RADIUS.kingdom,
      ref: { kind: 'kingdom', id: kingdom.id, name: kingdom.name, accent: kingdom.color },
      inspectable: true
    };
  }

  private viewBuilding(cityId: string, buildingId: string): SelectionView | null {
    const city = this.sim!.cities.get(cityId);
    const building = city?.buildings.get(buildingId);
    if (!city || !building) return null;

    const def = BUILDINGS[building.type];
    const kingdom = city.kingdomId ? this.sim!.kingdoms.get(city.kingdomId) : undefined;
    const jobs = def?.jobs ?? 0;

    // "Operating" is a claim, so it is derived rather than asserted. The order
    // matters and must match the inspector's, or the card and the panel will
    // disagree about the same building: an exhausted seam is terminal and outranks
    // any staffing problem, because no number of workers can fix it.
    const staffed = building.assignedWorkerIds.size;
    const tile = this.tileMap?.getTile(building.x, building.y);
    const extracts = Boolean(BUILDINGS[building.type]?.extractionRate || building.extractedGood);
    const depleted = extracts && tile != null && tile.resourceMax > 0 && tile.resourceAmount <= 0;

    const status = depleted
      ? 'Esgotada'
      : jobs === 0
        ? 'Em funcionamento'
        : staffed === 0 ? 'Parada' : staffed < jobs ? 'Sem pessoal suficiente' : 'Em funcionamento';

    const facts: Fact[] = [
      { label: 'Cidade', value: city.name },
      { label: 'Situação', value: status }
    ];
    if (jobs > 0) facts.push({ label: 'Trabalhadores', value: `${staffed}/${jobs}` });
    else if (building.level > 1) facts.push({ label: 'Nível', value: `${building.level}` });

    return {
      name: def?.name ?? building.type,
      kindLabel: KIND_LABEL.building,
      icon: 'building',
      accent: kingdom?.color,
      facts,
      worldPos: { x: building.x, y: building.y },
      radius: KIND_RADIUS.building,
      ref: { kind: 'building', id: building.id, name: def?.name ?? building.type, qualifier: city.name },
      // UI-2 gave buildings a full inspector view, so the card's Inspect button is
      // no longer a dead end for them.
      inspectable: true
    };
  }

  private viewTile(x: number, y: number): SelectionView | null {
    const tile = this.tileMap?.getTile(x, y);
    if (!tile) return null;
    const terrain = TERRAINS[tile.type];

    const facts: Fact[] = [
      { label: 'Altitude', value: tile.height.toFixed(2) },
      { label: 'Coordenada', value: `${x}, ${y}` }
    ];
    if (tile.resourceType) {
      facts.unshift({
        label: GOODS[tile.resourceType]?.name ?? tile.resourceType,
        value: formatFull(tile.resourceAmount)
      });
    }

    return {
      name: terrain?.name ?? tile.type,
      kindLabel: KIND_LABEL.tile,
      icon: tile.resourceType ? 'good' : 'map',
      facts,
      worldPos: { x: x + 0.5, y: y + 0.5 },
      radius: KIND_RADIUS.tile,
      inspectable: true
    };
  }
}
