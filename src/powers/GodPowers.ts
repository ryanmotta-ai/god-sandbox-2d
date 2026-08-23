import { PowerDefinition } from './BrushManager';
import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { Entity } from '../entities/Entity';
import { SpeciesType } from '../entities/Species';
import { TraitId } from '../entities/Traits';
import { SpatialHash } from '../core/SpatialHash';
import { DisasterSystem } from './Disasters';
import { ParticleManager } from '../renderer/Particles';
import { sound } from '../core/SoundSynth';
import { rng } from '../core/Random';
import { SimplePathfinder } from '../ai/Pathfinding';
import { Camera } from '../renderer/Camera';
import type { City } from '../civ/City';
import type { Kingdom } from '../civ/Kingdom';
import type { Tile } from '../world/Tile';
import { TERRAINS } from '../world/Biomes';
import { UrbanDistrictPlanner } from '../civ/UrbanDistricts';

export const ALL_POWERS: PowerDefinition[] = [
  // TERRENO & ALTIMETRIA
  { id: 'raise_land', name: 'Elevar Terreno', category: 'terrain', icon: 'mountain', description: 'Aumenta a altitude do solo' },
  { id: 'lower_land', name: 'Rebaixar Terreno', category: 'terrain', icon: 'pickaxe', description: 'Reduz a altitude do solo' },
  { id: 'add_land', name: 'Criar Solo Fértil', category: 'terrain', icon: 'leaf', description: 'Cria solo arável e habitável' },
  { id: 'remove_land', name: 'Oceano Profundo', category: 'terrain', icon: 'world', description: 'Transforma terreno em oceano profundo' },
  { id: 'shallow_water', name: 'Águas Rasas', category: 'terrain', icon: 'water', description: 'Cria lagoas, rios e litorais' },
  { id: 'biome_sand', name: 'Areia & Praias', category: 'terrain', icon: 'sand', description: 'Pinta dunas e faixas costeiras de areia' },
  { id: 'mountains', name: 'Montanhas', category: 'terrain', icon: 'mountain', description: 'Ergue cordilheiras rochosas intransponíveis' },
  { id: 'lava', name: 'Rio de Lava', category: 'terrain', icon: 'fire', description: 'Derrama fluxo vulcânico incandescente' },
  { id: 'build_road', name: 'Pavimentar Estrada', category: 'terrain', icon: 'route', description: 'Constrói e melhora estradas' },
  { id: 'remove_road', name: 'Demolir Estrada', category: 'terrain', icon: 'close', description: 'Remove a pavimentação de estradas' },

  // NATUREZA & BIOMAS
  { id: 'fertile_soil', name: 'Pastagem Fértil', category: 'nature', icon: 'farm', description: 'Pinta campos de grama de alta fertilidade' },
  { id: 'trees', name: 'Floresta Densa', category: 'nature', icon: 'leaf', description: 'Planta árvores e fontes de madeira' },
  { id: 'biome_desert', name: 'Savana / Deserto', category: 'nature', icon: 'sun', description: 'Pinta savanas áridas e vegetação seca' },
  { id: 'biome_swamp', name: 'Pântano', category: 'nature', icon: 'leaf', description: 'Pinta pântanos e mangues úmidos' },
  { id: 'biome_tundra', name: 'Tundra Gelada', category: 'nature', icon: 'snow', description: 'Pinta tundras polares congeladas' },
  { id: 'biome_arcane', name: 'Bosque Arcano', category: 'nature', icon: 'gem', description: 'Pinta florestas místicas mágicas' },
  { id: 'biome_corrupted', name: 'Terras Corrompidas', category: 'nature', icon: 'skull', description: 'Pinta solos sombrios e amaldiçoados' },
  { id: 'spawn_ore', name: 'Jazida Mineral', category: 'nature', icon: 'gem', description: 'Deposita jazidas de Ouro e Ferro' },
  { id: 'rain', name: 'Chuva Abençoada', category: 'nature', icon: 'water', description: 'Apaga incêndios e rega plantações' },

  // VIDA & FERAS
  { id: 'spawn_human', name: 'Colono Humano', category: 'life', icon: 'person', description: 'Gera cidadãos capazes de fundar reinos e cidades' },
  { id: 'spawn_deer', name: 'Veado Selvagem', category: 'life', icon: 'deer', description: 'Herbívoro pacífico e ágil' },
  { id: 'spawn_wolf', name: 'Lobo Selvagem', category: 'life', icon: 'wolf', description: 'Predador caçador em matilhas' },
  { id: 'spawn_bear', name: 'Urso Selvagem', category: 'life', icon: 'bear', description: 'Fera territorial solitária e robusta' },
  { id: 'spawn_boar', name: 'Javali Selvagem', category: 'life', icon: 'lion', description: 'Animal agressivo das matas' },
  { id: 'spawn_eagle', name: 'Águia Imperial', category: 'life', icon: 'eagle', description: 'Predador voador veloz dos cumes' },
  { id: 'spawn_mammoth', name: 'Mamute Ancião', category: 'life', icon: 'lion', description: 'Gigante ancião da tundra gelada' },
  { id: 'spawn_dragon', name: 'Dragão Ancião', category: 'life', icon: 'dragon', description: 'Monstro Chefe lendário cuspidor de fogo' },

  // MILAGRES DIVINOS
  { id: 'heal', name: 'Cura Divina', category: 'divine', icon: 'heart', description: 'Restaura a vida total das criaturas' },
  { id: 'bless', name: 'Bênção Celestial', category: 'divine', icon: 'sun', description: 'Concede a bênção divina (+25% HP máx)' },
  { id: 'curse', name: 'Maldição Sombria', category: 'divine', icon: 'moon', description: 'Amaldiçoa com fraqueza (-30% HP máx)' },
  { id: 'inspire_genius', name: 'Inspiração Genial', category: 'divine', icon: 'flask', description: 'Concede intelecto superior e trabalho acelerado' },
  { id: 'peace_touch', name: 'Toque de Paz', category: 'divine', icon: 'handshake', description: 'Concede índole pacifista que evita combates' },
  { id: 'make_immortal', name: 'Imortalidade', category: 'divine', icon: 'crown', description: 'Concede vida eterna sem envelhecimento' },
  { id: 'add_giant', name: 'Força Titânica', category: 'divine', icon: 'shield', description: 'Transforma em gigante com super força física' },

  // DESASTRES & CATACLISMOS
  { id: 'lightning', name: 'Raio Divino', category: 'destruction', icon: 'lightning', description: 'Atinge o alvo com relâmpago de alta voltagem' },
  { id: 'wildfire', name: 'Incêndio', category: 'destruction', icon: 'fire', description: 'Inicia foco de fogo que se alastra na vegetação' },
  { id: 'earthquake', name: 'Terremoto', category: 'destruction', icon: 'pickaxe', description: 'Fratura e destrói o relevo e construções' },
  { id: 'meteorite', name: 'Meteoro Cataclísmico', category: 'destruction', icon: 'fire', description: 'Impacto devastador de meteoro com cratera de magma' },
  { id: 'plague', name: 'Praga Contagiosa', category: 'destruction', icon: 'warning', description: 'Dispersa peste epidêmica entre a população' }
];

/**
 * What terraforming has to reach beyond the tile grid to leave a coherent world.
 *
 * Optional throughout: the powers still work without it, they simply cannot clean
 * up after themselves, which is the state the whole sanitation pass exists to fix.
 */
export interface TerraformContext {
  cities: Map<string, City>;
  kingdoms: Map<string, Kingdom>;
}

/** Terrain a person, a building, a road or a tree cannot be on. */
function isDrowned(type: TerrainType): boolean {
  return TERRAINS[type].isWater || type === TerrainType.LAVA;
}

/**
 * Reconciles a tile that has just stopped being habitable ground.
 *
 * Sinking land used to be a repaint. `remove_land` set the terrain to deep ocean
 * and nulled `buildingId` — and that was all. The building itself stayed in its
 * settlement's map, so it kept its workers, kept producing, kept paying and kept
 * counting toward the city's housing, thirty metres under the sea. The territory
 * claim, the roads, the railway, the forest and the ore all stayed too: realms
 * administered stretches of open ocean, caravans routed over drowned highways,
 * and lumber camps felled a submarine forest. `shallow_water` did not even clear
 * the building link.
 *
 * Everything that cannot exist underwater is therefore removed here, at the tile,
 * including the people standing on it — a god who sinks the ground someone is on
 * has drowned them, and that should be a consequence rather than a rendering
 * artefact.
 */
function submergeTile(
  tile: Tile,
  tileMap: TileMap,
  entities: Entity[],
  spatialHash: SpatialHash<Entity>,
  ctx?: TerraformContext
): void {
  // The building is demolished, not merely unlinked from the ground.
  if (tile.buildingId && ctx) {
    const owner = tile.cityId
      ? ctx.cities.get(tile.cityId) ?? null
      : [...ctx.cities.values()].find(city => city.buildings.has(tile.buildingId!)) ?? null;
    if (owner) {
      const building = owner.buildings.get(tile.buildingId);
      if (building) {
        for (const workerId of building.assignedWorkerIds) owner.unassignWorker(workerId);
        for (const residentId of building.residentIds) {
          const resident = entities.find(e => e.id === residentId);
          if (resident) { resident.homeBuildingId = null; resident.homeX = null; resident.homeY = null; }
        }
      }
      owner.removeBuilding(tile.buildingId);
      UrbanDistrictPlanner.markDirty(owner, tileMap, tile.x, tile.y);
    }
  }
  tile.buildingId = null;

  // Nobody administers a seabed. The claim is dropped on both sides of the ledger.
  if (tile.cityId) ctx?.cities.get(tile.cityId)?.territory.delete(`${tile.x},${tile.y}`);
  tile.cityId = null;
  tile.kingdomId = null;

  // Roads and rail do not cross open water without a bridge, and no bridge
  // survived what just happened here.
  tile.roadLevel = 0;
  tile.roadTraffic = 0;
  tile.roadDamage = 0;
  tile.railLevel = 0;
  tile.railDamage = 0;
  tile.railOwnerId = null;
  tile.bridgeName = null;

  // A drowned forest is not a forest, and a flooded seam is not a mine.
  tile.resourceType = null;
  tile.resourceAmount = 0;
  tile.resourceMax = 0;

  // Nothing burns under water.
  tile.isOnFire = false;
  tile.fireTimer = 0;

  // And whoever was standing here is in the sea.
  for (const victim of spatialHash.queryRadius(tile.x + 0.5, tile.y + 0.5, 0.75)) {
    if (victim.hp <= 0) continue;
    if (Math.floor(victim.x) !== tile.x || Math.floor(victim.y) !== tile.y) continue;
    victim.hp = 0;
  }

  tileMap.markTerrainChanged(tile.x, tile.y);
}

/**
 * Keeps a tile's terrain honest about its own altitude.
 *
 * `raise_land` and `lower_land` moved `height` and nothing else, which produced
 * mountains made of deep ocean and trenches of dry soil sitting at sea level —
 * terrain whose type said one thing and whose elevation said the opposite, which
 * every consumer downstream (pathfinding, deposits, settlement siting, the
 * renderer) then disagreed about.
 */
function reconcileHeight(
  tile: Tile,
  tileMap: TileMap,
  entities: Entity[],
  spatialHash: SpatialHash<Entity>,
  ctx?: TerraformContext
): void {
  const wasLand = !isDrowned(tile.type);

  if (tile.height < 0.16) {
    tile.type = TerrainType.DEEP_OCEAN;
  } else if (tile.height < 0.3) {
    tile.type = TerrainType.SHALLOW_WATER;
  } else if (tile.height > 0.85) {
    tile.type = TerrainType.MOUNTAIN;
  } else if (isDrowned(tile.type) && tile.type !== TerrainType.LAVA) {
    // Ground lifted out of the water comes up as bare soil, not as sea.
    tile.type = TerrainType.SOIL;
  }

  if (wasLand && isDrowned(tile.type)) {
    submergeTile(tile, tileMap, entities, spatialHash, ctx);
  } else {
    tileMap.markTerrainChanged(tile.x, tile.y);
  }
}

/**
 * Scatters a spawn across the brush instead of dropping one creature at its centre.
 *
 * Every spawn power ignored `radius` completely: it found the single nearest land
 * tile and placed exactly one animal there, so the brush-size control did nothing
 * at all for half the palette, and populating a region meant clicking a hundred
 * times. The count scales with the painted area, and a herd is spread over it
 * rather than stacked on one square.
 */
function spawnAcrossBrush(
  species: SpeciesType,
  tx: number,
  ty: number,
  radius: number,
  tileMap: TileMap,
  spawnEntityFn: (species: SpeciesType, x: number, y: number) => Entity
): void {
  /**
   * Density by what the creature is.
   *
   * Herds and settlers fill the ground they are painted on; apex animals do not.
   * A wide brush of dragons at herd density would put fifty of them on one
   * valley, which is not a spawn, it is an extinction event.
   */
  const tilesPerHead =
    species === SpeciesType.DRAGON ? 90 :
    species === SpeciesType.BEAR || species === SpeciesType.MAMMOTH ? 30 :
    species === SpeciesType.WOLF ? 12 :
    4;
  const count = Math.max(1, Math.min(60, Math.round((Math.PI * radius * radius) / tilesPerHead)));
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    // sqrt keeps the scatter even across the disc instead of clumping at the centre.
    const distance = Math.sqrt(rng.range(0, 1)) * radius;
    const px = Math.round(tx + Math.cos(angle) * distance);
    const py = Math.round(ty + Math.sin(angle) * distance);
    const safe = SimplePathfinder.findNearestLand(px, py, tileMap);
    if (safe) spawnEntityFn(species, safe.x, safe.y);
  }
}

export class PowerExecutor {
  public static executePower(
    powerId: string,
    tx: number,
    ty: number,
    radius: number,
    tileMap: TileMap,
    spatialHash: SpatialHash<Entity>,
    entities: Entity[],
    spawnEntityFn: (species: SpeciesType, x: number, y: number) => Entity,
    particles: ParticleManager,
    camera?: Camera,
    terraform?: TerraformContext
  ): void {
    const tile = tileMap.getTile(tx, ty);
    if (!tile) return;

    sound.playClick();

    switch (powerId) {
      // TERRAIN
      case 'add_land':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SOIL; t.height = 0.5; });
        break;
      case 'remove_land':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.type = TerrainType.DEEP_OCEAN;
          t.height = 0.1;
          submergeTile(t, tileMap, entities, spatialHash, terraform);
        });
        break;
      case 'raise_land':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.height = Math.min(1, t.height + 0.2);
          reconcileHeight(t, tileMap, entities, spatialHash, terraform);
        });
        break;
      case 'lower_land':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.height = Math.max(0, t.height - 0.2);
          reconcileHeight(t, tileMap, entities, spatialHash, terraform);
        });
        break;
      case 'mountains':
        tileMap.applyBrush(tx, ty, radius, t => {
          // A mountain is not a building site either: raising one over a town
          // buries it exactly as surely as sinking the ground under it.
          t.type = TerrainType.MOUNTAIN;
          t.height = 0.9;
          if (t.buildingId) submergeTile(t, tileMap, entities, spatialHash, terraform);
          t.type = TerrainType.MOUNTAIN;
        });
        break;
      case 'shallow_water':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.type = TerrainType.SHALLOW_WATER;
          t.height = 0.3;
          submergeTile(t, tileMap, entities, spatialHash, terraform);
        });
        break;
      case 'biome_sand':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SAND; t.height = 0.45; });
        break;
      case 'lava':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.type = TerrainType.LAVA;
          t.height = 0.8;
          submergeTile(t, tileMap, entities, spatialHash, terraform);
          t.type = TerrainType.LAVA;
          t.isOnFire = true;
        });
        break;
      case 'build_road':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.roadLevel = Math.min(3, Math.max(1, t.roadLevel + 1));
          t.roadTraffic = Math.max(30, t.roadTraffic + 25);
        });
        break;
      case 'remove_road':
        tileMap.applyBrush(tx, ty, radius, t => {
          t.roadLevel = 0;
          t.roadTraffic = 0;
        });
        break;

      // NATURE & BIOMES
      case 'trees':
      case 'biome_forest':
        tileMap.applyBrush(tx, ty, radius, t => {
          if (!t.type.includes('ocean') && t.type !== TerrainType.MOUNTAIN) {
            t.type = TerrainType.FOREST;
            t.resourceType = 'wood';
            t.resourceAmount = 60;
          }
        });
        break;
      case 'fertile_soil':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.GRASS; t.fertility = 1.0; });
        break;
      case 'biome_desert':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SAVANNA; });
        break;
      case 'biome_swamp':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SWAMP; });
        break;
      case 'biome_tundra':
      case 'snow':
        tileMap.applyBrush(tx, ty, radius, t => {
          if (!t.type.includes('ocean')) t.type = TerrainType.TUNDRA;
        });
        break;
      case 'biome_arcane':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.ARCANE; });
        break;
      case 'biome_corrupted':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.CORRUPTED; });
        break;
      case 'spawn_ore':
        tileMap.applyBrush(tx, ty, radius, t => {
          if (t.type === TerrainType.MOUNTAIN || t.type === TerrainType.SOIL) {
            t.resourceType = rng.chance(0.3) ? 'gold' : 'iron';
            t.resourceAmount = 100;
          }
        });
        break;
      case 'rain':
        sound.playMagic();
        tileMap.applyBrush(tx, ty, radius + 2, t => {
          t.isOnFire = false;
          particles.spawnParticle(t.x, t.y, '#38bdf8', 0, 0.5, 0.4);
        });
        break;

      // LIFE SPAWN
      case 'spawn_human':
      case 'spawn_lumini':
      case 'spawn_sylvanii':
      case 'spawn_stonekin':
      case 'spawn_emberkin': {
        spawnAcrossBrush(SpeciesType.HUMAN, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_deer': {
        spawnAcrossBrush(SpeciesType.DEER, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_wolf': {
        spawnAcrossBrush(SpeciesType.WOLF, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_bear': {
        spawnAcrossBrush(SpeciesType.BEAR, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_dragon': {
        spawnAcrossBrush(SpeciesType.DRAGON, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_boar': {
        spawnAcrossBrush(SpeciesType.BOAR, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_eagle': {
        spawnAcrossBrush(SpeciesType.EAGLE, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }
      case 'spawn_mammoth': {
        spawnAcrossBrush(SpeciesType.MAMMOTH, tx, ty, radius, tileMap, spawnEntityFn);
        break;
      }

      // DIVINE
      case 'heal': {
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) {
          e.hp = e.maxHp;
          particles.spawnParticle(e.x, e.y, '#34d399', 0, -0.5, 0.5);
        }
        break;
      }
      case 'bless': {
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) e.addTrait(TraitId.BLESSED);
        break;
      }
      case 'curse': {
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) e.addTrait(TraitId.CURSED);
        break;
      }
      case 'inspire_genius': {
        sound.playMagic();
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) {
          e.addTrait(TraitId.GENIUS);
          particles.spawnParticle(e.x, e.y, '#8b5cf6', 0, -0.5, 0.5);
        }
        break;
      }
      case 'peace_touch': {
        sound.playMagic();
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) {
          e.addTrait(TraitId.PACIFIST);
          particles.spawnParticle(e.x, e.y, '#38bdf8', 0, -0.5, 0.5);
        }
        break;
      }
      case 'make_immortal': {
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) e.addTrait(TraitId.IMMORTAL);
        break;
      }
      case 'add_giant': {
        const targets = spatialHash.queryRadius(tx, ty, radius);
        for (const e of targets) e.addTrait(TraitId.GIANT);
        break;
      }

      // DESTRUCTION & DISASTERS
      case 'lightning': DisasterSystem.triggerLightning(tx, ty, tileMap, spatialHash, particles, camera); break;
      case 'wildfire':
        tileMap.applyBrush(tx, ty, radius, t => { tileMap.igniteTile(t); });
        break;
      case 'earthquake': DisasterSystem.triggerEarthquake(tx, ty, tileMap, spatialHash, particles, camera); break;
      case 'meteorite': DisasterSystem.triggerMeteorite(tx, ty, tileMap, spatialHash, particles, camera); break;
      case 'plague': DisasterSystem.triggerPlague(tx, ty, spatialHash); break;
    }
  }
}
