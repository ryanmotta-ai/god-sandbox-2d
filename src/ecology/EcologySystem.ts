import { Entity } from '../entities/Entity';
import { SpeciesType, SPECIES_DEFINITIONS } from '../entities/Species';
import { TerrainType, TERRAINS } from '../world/Biomes';
import { TileMap } from '../world/TileMap';
import { RegionState } from '../world/WorldChunks';

type WildlifeSpecies = typeof WILDLIFE_SPECIES[number];

interface RegionEcology {
  vegetation: number;
  vegetationPotential: number;
  humanPressure: number;
  habitat: Partial<Record<WildlifeSpecies, number>>;
  population: Partial<Record<WildlifeSpecies, number>>;
}

export interface EcologyYearOutcome {
  deaths: Entity[];
  migrated: boolean;
}

/**
 * Coarse ecosystem model. The expensive work is one annual chunk pass; animals
 * continue to use individual AI only where WORLD-V1 has made them relevant.
 */
export class EcologySystem {
  private readonly capacity = new Map<SpeciesType, number>();
  private readonly population = new Map<SpeciesType, number>();
  private readonly regions = new Map<number, RegionEcology>();

  public getPopulation(species: SpeciesType): number { return this.population.get(species) ?? 0; }
  public getCapacity(species: SpeciesType): number { return this.capacity.get(species) ?? 0; }
  public isPrey(species: SpeciesType): boolean { return species === SpeciesType.DEER || species === SpeciesType.BOAR || species === SpeciesType.MAMMOTH; }
  public isPredator(species: SpeciesType): boolean { return species === SpeciesType.WOLF || species === SpeciesType.BEAR || species === SpeciesType.EAGLE; }
  public vegetationAt(x: number, y: number, tileMap: TileMap): number {
    return this.regions.get(this.regionKeyAt(x, y, tileMap))?.vegetation ?? 0;
  }

  /** Hunting is partial/emergency food, never a substitute for farming. */
  public foodYield(species: SpeciesType): number {
    if (species === SpeciesType.DEER) return 3;
    if (species === SpeciesType.BOAR) return 4;
    if (species === SpeciesType.MAMMOTH) return 12;
    return 0;
  }

  /** Rebuilds terrain pressure, regional census and environmental capacities. */
  public survey(tileMap: TileMap, entities: readonly Entity[]): void {
    this.capacity.clear(); this.population.clear();
    const regionalAnimals = new Map<number, Entity[]>();
    for (const e of entities) {
      if (e.hp <= 0 || SPECIES_DEFINITIONS[e.species].isHumanoid || !isWildlife(e.species)) continue;
      const key = this.regionKeyAt(e.x, e.y, tileMap);
      const group = regionalAnimals.get(key) ?? [];
      group.push(e); regionalAnimals.set(key, group);
      this.population.set(e.species, this.getPopulation(e.species) + 1);
    }

    for (const chunk of tileMap.chunkStore.chunks) {
      const key = this.regionKey(chunk.cx, chunk.cy, tileMap);
      const measured = this.measureRegion(chunk.cx, chunk.cy, tileMap);
      const previous = this.regions.get(key);
      const region: RegionEcology = {
        vegetation: previous?.vegetation ?? measured.vegetationPotential,
        vegetationPotential: measured.vegetationPotential,
        humanPressure: measured.humanPressure,
        habitat: measured.habitat,
        population: {}
      };
      for (const e of regionalAnimals.get(key) ?? []) region.population[e.species as WildlifeSpecies] = (region.population[e.species as WildlifeSpecies] ?? 0) + 1;
      this.regions.set(key, region);
    }
    this.recalculateCapacities();
  }

  /**
   * Annual aggregated ecology for every chunk, including SLEEPING chunks.
   * It applies plant recovery/consumption, starvation and cross-border migration
   * without invoking animal behavior trees outside active regions.
   */
  public advanceYear(tileMap: TileMap, entities: readonly Entity[]): EcologyYearOutcome {
    this.survey(tileMap, entities);
    const deaths: Entity[] = [];
    const animalsByRegion = new Map<number, Entity[]>();
    for (const e of entities) {
      if (e.hp <= 0 || SPECIES_DEFINITIONS[e.species].isHumanoid || !isWildlife(e.species)) continue;
      const key = this.regionKeyAt(e.x, e.y, tileMap);
      const group = animalsByRegion.get(key) ?? [];
      group.push(e); animalsByRegion.set(key, group);
    }

    // Vegetation regrows when people leave and gets consumed by herbivores.
    for (const [key, region] of this.regions) {
      const herbivores = herbivoreCount(region.population);
      // Match herbivore carrying density to the environmental cap: a grass
      // chunk can support a herd, not an unlimited pile of grazers.
      const plantCapacity = Math.max(1, region.habitat[SpeciesType.DEER] ?? 0) / 150;
      const recovery = (region.vegetationPotential - region.vegetation) * .34;
      const grazing = herbivores / plantCapacity * .18;
      region.vegetation = clamp01(region.vegetation + recovery - grazing);

      const local = animalsByRegion.get(key) ?? [];
      const herbivoreLimit = Math.max(0, Math.floor(plantCapacity * region.vegetation));
      const predators = local.filter(e => this.isPredator(e.species));
      this.applyFoodStress(local.filter(e => this.isPrey(e.species)), herbivoreLimit, deaths);
      const prey = local.filter(e => this.isPrey(e.species) && !deaths.includes(e)).length;
      const predatorLimit = Math.floor(prey / 5);
      this.applyFoodStress(predators, predatorLimit, deaths);
    }

    // Move a small share out of poor chunks into a better neighbouring habitat.
    // This creates recolonization without globally spawning animals.
    let migrated = false;
    for (const [key, source] of this.regions) {
      if (source.vegetation >= .38 && source.humanPressure < .55) continue;
      const destinationKey = this.bestNeighbour(key, source, tileMap);
      if (destinationKey === null) continue;
      const candidates = (animalsByRegion.get(key) ?? [])
        .filter(e => !deaths.includes(e) && this.isPrey(e.species))
        .sort((a, b) => a.id.localeCompare(b.id));
      const movers = candidates.slice(0, Math.max(1, Math.floor(candidates.length * .15)));
      const destination = tileMap.chunkStore.chunks[destinationKey]!;
      for (const animal of movers) {
        // Coarse relocation is intentionally annual. The spatial indices are
        // rebuilt by SimulationEngine after this pass.
        animal.x = destination.cx * tileMap.chunkSize + tileMap.chunkSize * .5;
        animal.y = destination.cy * tileMap.chunkSize + tileMap.chunkSize * .5;
        animal.targetX = null; animal.targetY = null;
        migrated = true;
      }
    }

    this.survey(tileMap, entities);
    return { deaths, migrated };
  }

  /** Only pairs in ACTIVE/WARM chunks may materialize births; no extinct respawn. */
  public canReproduce(parent: Entity, tileMap: TileMap): boolean {
    const chunk = tileMap.chunkStore.getChunkAt(parent.x, parent.y);
    if (!chunk || chunk.state === RegionState.SLEEPING || this.getPopulation(parent.species) >= this.getCapacity(parent.species)) return false;
    const region = this.regions.get(this.regionKey(chunk.cx, chunk.cy, tileMap));
    if (!region || region.vegetation < .3) return false;
    const localHabitat = region.habitat[parent.species as WildlifeSpecies] ?? 0;
    return localHabitat >= (this.isPredator(parent.species) ? 80 : parent.species === SpeciesType.MAMMOTH ? 35 : 16);
  }

  /** Predators need prey; herbivores reproduce better after predator collapse, but never on bare land. */
  public birthChance(species: SpeciesType): number {
    const prey = this.getPopulation(SpeciesType.DEER) + this.getPopulation(SpeciesType.BOAR) + this.getPopulation(SpeciesType.MAMMOTH);
    const predators = this.getPopulation(SpeciesType.WOLF) + this.getPopulation(SpeciesType.BEAR) + this.getPopulation(SpeciesType.EAGLE);
    const vegetation = this.averageVegetation();
    if (this.isPredator(species)) return prey < 4 ? 0 : .22 * vegetation;
    return Math.max(0, (.58 - predators / Math.max(1, prey) * .28) * vegetation);
  }

  /** A city hunts only animals that really exist within local reach. */
  public findNearbyPrey(hunter: Entity, entities: readonly Entity[], radius = 15): Entity | null {
    let closest: Entity | null = null, best = radius * radius;
    for (const other of entities) {
      if (other.hp <= 0 || !this.isPrey(other.species)) continue;
      const dx = other.x - hunter.x, dy = other.y - hunter.y, distance = dx * dx + dy * dy;
      if (distance < best) { closest = other; best = distance; }
    }
    return closest;
  }

  private measureRegion(cx: number, cy: number, tileMap: TileMap): Pick<RegionEcology, 'vegetationPotential' | 'humanPressure' | 'habitat'> {
    const habitat: Partial<Record<WildlifeSpecies, number>> = {};
    const minX = cx * tileMap.chunkSize, minY = cy * tileMap.chunkSize;
    const maxX = Math.min(tileMap.width, minX + tileMap.chunkSize), maxY = Math.min(tileMap.height, minY + tileMap.chunkSize);
    let naturalVegetation = 0, pressure = 0, land = 0;
    for (let x = minX; x < maxX; x++) for (let y = minY; y < maxY; y++) {
      const tile = tileMap.getTile(x, y)!;
      if (TERRAINS[tile.type].isWater || tile.isOnFire) continue;

      const disturbed = tile.buildingId || tile.cityId ? 1 : tile.roadLevelEffective > 0 ? .55 : 0;
      const naturalness = 1 - disturbed;

      // Habitat is measured before the walkability test, because mountains are
      // impassable and were being skipped outright — which gave the bear, the
      // eagle and the dragon zero range in the one biome all three of them name
      // as preferred. A crag is territory even where a cart cannot go; it simply
      // carries no pasture and no human pressure, so it is left out of both below.
      for (const species of WILDLIFE_SPECIES) {
        const quality = habitatQuality(species, tile.type, tile.fertility);
        if (quality) habitat[species] = (habitat[species] ?? 0) + quality * naturalness;
      }

      if (!TERRAINS[tile.type].isWalkable) continue;
      land++;
      pressure += disturbed;
      // Forest cover carries more browse and shelter than cleared soil. This
      // makes deforestation a real ecological loss even before a building is
      // erected on the newly cleared tile.
      naturalVegetation += Math.max(0, tile.fertility) * vegetationCover(tile.type) * naturalness;
    }
    return {
      vegetationPotential: land ? clamp01(naturalVegetation / land) : 0,
      humanPressure: land ? pressure / land : 1,
      habitat
    };
  }

  private recalculateCapacities(): void {
    this.capacity.clear();
    for (const region of this.regions.values()) {
      for (const species of WILDLIFE_SPECIES) {
        const density = this.isPredator(species) ? 900 : species === SpeciesType.MAMMOTH ? 420 : 150;
        const vegetationFactor = this.isPrey(species) ? region.vegetation : 1;
        this.capacity.set(species, (this.capacity.get(species) ?? 0) + Math.floor((region.habitat[species] ?? 0) * vegetationFactor / density));
      }
    }
    const prey = this.getPopulation(SpeciesType.DEER) + this.getPopulation(SpeciesType.BOAR) + this.getPopulation(SpeciesType.MAMMOTH);
    for (const species of [SpeciesType.WOLF, SpeciesType.BEAR, SpeciesType.EAGLE] as const) {
      this.capacity.set(species, Math.min(this.getCapacity(species), Math.floor(prey / (species === SpeciesType.BEAR ? 9 : 6))));
    }
  }

  private applyFoodStress(animals: Entity[], capacity: number, deaths: Entity[]): void {
    const excess = Math.max(0, animals.length - capacity);
    for (const animal of animals.sort((a, b) => a.id.localeCompare(b.id))) {
      const underfed = excess > 0 && animals.indexOf(animal) >= animals.length - excess;
      animal.ecologyHunger = clamp01(animal.ecologyHunger + (underfed ? .42 : -.24));
      if (animal.ecologyHunger >= .8) {
        animal.hp = 0;
        deaths.push(animal);
      }
    }
  }

  private bestNeighbour(key: number, source: RegionEcology, tileMap: TileMap): number | null {
    const chunk = tileMap.chunkStore.chunks[key];
    if (!chunk) return null;
    let best: number | null = null, score = source.vegetation - source.humanPressure;
    for (const [cx, cy] of [[chunk.cx - 1, chunk.cy], [chunk.cx + 1, chunk.cy], [chunk.cx, chunk.cy - 1], [chunk.cx, chunk.cy + 1]]) {
      const neighbour = tileMap.chunkStore.getChunk(cx, cy);
      if (!neighbour) continue;
      const candidateKey = this.regionKey(cx, cy, tileMap);
      const region = this.regions.get(candidateKey);
      if (!region) continue;
      const candidate = region.vegetation - region.humanPressure + (neighbour.state === RegionState.SLEEPING ? .05 : 0);
      if (candidate > score + .12) { score = candidate; best = candidateKey; }
    }
    return best;
  }

  private averageVegetation(): number {
    if (!this.regions.size) return 0;
    let total = 0;
    for (const region of this.regions.values()) total += region.vegetation;
    return total / this.regions.size;
  }
  private regionKey(cx: number, cy: number, tileMap: TileMap): number { return cx * tileMap.chunkStore.chunksY + cy; }
  private regionKeyAt(x: number, y: number, tileMap: TileMap): number { return this.regionKey(Math.floor(x / tileMap.chunkSize), Math.floor(y / tileMap.chunkSize), tileMap); }
}

const WILDLIFE_SPECIES = [SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.MAMMOTH, SpeciesType.WOLF, SpeciesType.BEAR, SpeciesType.EAGLE] as const;
function isWildlife(species: SpeciesType): species is WildlifeSpecies { return (WILDLIFE_SPECIES as readonly SpeciesType[]).includes(species); }
function herbivoreCount(population: Partial<Record<WildlifeSpecies, number>>): number { return (population[SpeciesType.DEER] ?? 0) + (population[SpeciesType.BOAR] ?? 0) + (population[SpeciesType.MAMMOTH] ?? 0); }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }

function vegetationCover(terrain: TerrainType): number {
  switch (terrain) {
    case TerrainType.FOREST: return 1;
    case TerrainType.GRASS: return .85;
    case TerrainType.SAVANNA: case TerrainType.SWAMP: return .7;
    case TerrainType.SOIL: return .45;
    case TerrainType.TUNDRA: case TerrainType.SNOW: return .2;
    default: return .1;
  }
}

function habitatQuality(species: SpeciesType, terrain: TerrainType, fertility: number): number {
  const terrainNames: Record<TerrainType, string> = {
    [TerrainType.DEEP_OCEAN]: 'ocean', [TerrainType.SHALLOW_WATER]: 'water', [TerrainType.SAND]: 'sand', [TerrainType.SOIL]: 'soil',
    [TerrainType.GRASS]: 'grass', [TerrainType.FOREST]: 'forest', [TerrainType.SAVANNA]: 'savanna', [TerrainType.SWAMP]: 'swamp',
    [TerrainType.TUNDRA]: 'tundra', [TerrainType.SNOW]: 'snow', [TerrainType.MOUNTAIN]: 'mountain', [TerrainType.LAVA]: 'lava',
    [TerrainType.ARCANE]: 'arcane', [TerrainType.CORRUPTED]: 'corrupted'
  };
  if (SPECIES_DEFINITIONS[species].preferredBiomes.includes(terrainNames[terrain])) return .7 + Math.min(1, fertility) * .6;
  return species === SpeciesType.DEER || species === SpeciesType.BOAR ? Math.max(0, fertility - .35) * .25 : 0;
}
