import { PowerDefinition, BrushCategory } from './BrushManager';
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

export const ALL_POWERS: PowerDefinition[] = [
  // TERRENO
  { id: 'add_land', name: 'Criar Terra', category: 'terrain', icon: '🌱', description: 'Cria solo fértil habitável' },
  { id: 'remove_land', name: 'Remover Terra', category: 'terrain', icon: '🌊', description: 'Transforma terra em oceano profundo' },
  { id: 'raise_land', name: 'Elevar Terreno', category: 'terrain', icon: '⛰️', description: 'Aumenta a altitude do solo' },
  { id: 'lower_land', name: 'Rebaixar Terreno', category: 'terrain', icon: '🕳️', description: 'Reduz a altitude do solo' },
  { id: 'mountains', name: 'Montanhas', category: 'terrain', icon: '🏔️', description: 'Ergue cordilheiras montanhosas' },
  { id: 'shallow_water', name: 'Águas Rasas', category: 'terrain', icon: '💧', description: 'Cria lagoas e rios navegáveis' },
  { id: 'lava', name: 'Rio de Lava', category: 'terrain', icon: '🌋', description: 'Derrama lava escaldante' },
  { id: 'build_road', name: 'Pavimentar Estrada', category: 'terrain', icon: '🛣️', description: 'Constrói e melhora estradas e pontes' },
  { id: 'remove_road', name: 'Apagar Estrada', category: 'terrain', icon: '🧹', description: 'Remove a pavimentação da estrada' },

  // NATUREZA
  { id: 'trees', name: 'Floresta Densa', category: 'nature', icon: '🌲', description: 'Planta árvores e fontes de madeira' },
  { id: 'fertile_soil', name: 'Grama Fértil', category: 'nature', icon: '☘️', description: 'Aumenta a fertilidade do solo' },
  { id: 'spawn_ore', name: 'Minério de Ouro/Ferro', category: 'nature', icon: '💎', description: 'Deposita jazidas minerais' },
  { id: 'rain', name: 'Chuva Abençoada', category: 'nature', icon: '🌧️', description: 'Apaga incêndios e rega plantações' },
  { id: 'snow', name: 'Nevada', category: 'nature', icon: '❄️', description: 'Congela o terreno e a vegetação' },

  // BIOMAS
  { id: 'biome_forest', name: 'Bioma de Floresta', category: 'biomes', icon: '🌳', description: 'Pinta florestas temperadas' },
  { id: 'biome_desert', name: 'Bioma de Deserto', category: 'biomes', icon: '🏜️', description: 'Pinta savanas áridas e areias' },
  { id: 'biome_swamp', name: 'Bioma de Pântano', category: 'biomes', icon: '🐊', description: 'Pinta pântanos e mofos' },
  { id: 'biome_tundra', name: 'Bioma de Tundra', category: 'biomes', icon: '🧊', description: 'Pinta tundras geladas' },
  { id: 'biome_arcane', name: 'Bosque Arcano', category: 'biomes', icon: '🔮', description: 'Pinta florestas místicas mágicas' },
  { id: 'biome_corrupted', name: 'Terras Corrompidas', category: 'biomes', icon: '💀', description: 'Pinta solos sombrios e malditos' },

  // VIDA
  { id: 'spawn_lumini', name: 'Gerar Lumini', category: 'life', icon: '🟡', description: 'Humanoides versáteis e diplomáticos' },
  { id: 'spawn_sylvanii', name: 'Gerar Sylvanii', category: 'life', icon: '🟢', description: 'Elfos protetores das florestas' },
  { id: 'spawn_stonekin', name: 'Gerar Stonekin', category: 'life', icon: '⚪', description: 'Anões mineradores das montanhas' },
  { id: 'spawn_emberkin', name: 'Gerar Emberkin', category: 'life', icon: '🔴', description: 'Conquistadores nascidos das chamas' },
  { id: 'spawn_deer', name: 'Gerar Veado', category: 'life', icon: '🦌', description: 'Cervo selvagem pacífico' },
  { id: 'spawn_wolf', name: 'Gerar Lobo', category: 'life', icon: '🐺', description: 'Predador caçador em matilha' },
  { id: 'spawn_bear', name: 'Gerar Urso', category: 'life', icon: '🐻', description: 'Urso territorial solitário' },
  { id: 'spawn_dragon', name: 'Gerar Dragão Ancião', category: 'life', icon: '🐉', description: 'Monstro Boss lendário cuspidor de fogo' },
  { id: 'spawn_boar', name: 'Gerar Javali', category: 'life', icon: '🐗', description: 'Javali selvagem florestal agressivo' },
  { id: 'spawn_eagle', name: 'Gerar Águia', category: 'life', icon: '🦅', description: 'Predador voador dos cumes' },
  { id: 'spawn_mammoth', name: 'Gerar Mamute', category: 'life', icon: '🦣', description: 'Gigante ancião da tundra gelada' },

  // MILAGRES
  { id: 'heal', name: 'Cura Divina', category: 'divine', icon: '💖', description: 'Restaura a vida total das criaturas' },
  { id: 'bless', name: 'Bênção Celestial', category: 'divine', icon: '✨', description: 'Concede a bênção divina (+25% HP)' },
  { id: 'curse', name: 'Maldição Sombria', category: 'divine', icon: '👁️', description: 'Amaldiçoa com fraqueza' },
  { id: 'make_immortal', name: 'Imortalidade', category: 'divine', icon: '👑', description: 'Concede vida eterna sem envelhecimento' },
  { id: 'add_giant', name: 'Força Titânica', category: 'divine', icon: '💪', description: 'Transforma em gigante com super força' },

  // DESASTRES
  { id: 'lightning', name: 'Raio Divino', category: 'destruction', icon: '⚡', description: 'Atinge o alvo com relâmpago' },
  { id: 'wildfire', name: 'Incêndio', category: 'destruction', icon: '🔥', description: 'Inicia fogo alastrante' },
  { id: 'earthquake', name: 'Terremoto', category: 'destruction', icon: '🌋', description: 'Fratura e destrói o terreno' },
  { id: 'meteorite', name: 'Meteoro Cataclísmico', category: 'destruction', icon: '☄️', description: 'Impacto devastador de meteoro' },
  { id: 'plague', name: 'Vírus da Peste', category: 'destruction', icon: '☣️', description: 'Solta praga contagiosa entre o povo' },

  // INSPEÇÃO
  { id: 'inspect_select', name: 'Modo Inspeção', category: 'inspect', icon: '🔍', description: 'Clique em qualquer alvo para examinar detalhes' }
];

import { Camera } from '../renderer/Camera';

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
    camera?: Camera
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
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.DEEP_OCEAN; t.height = 0.1; t.buildingId = null; });
        break;
      case 'raise_land':
        tileMap.applyBrush(tx, ty, radius, t => { t.height = Math.min(1, t.height + 0.2); });
        break;
      case 'lower_land':
        tileMap.applyBrush(tx, ty, radius, t => { t.height = Math.max(0, t.height - 0.2); });
        break;
      case 'mountains':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.MOUNTAIN; t.height = 0.9; });
        break;
      case 'shallow_water':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SHALLOW_WATER; t.height = 0.3; });
        break;
      case 'lava':
        tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.LAVA; t.height = 0.8; t.isOnFire = true; });
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

      // NATURE
      case 'trees':
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
      case 'snow':
        tileMap.applyBrush(tx, ty, radius, t => {
          if (!t.type.includes('ocean')) t.type = TerrainType.SNOW;
        });
        break;

      // BIOMES
      case 'biome_forest': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.FOREST; }); break;
      case 'biome_desert': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SAVANNA; }); break;
      case 'biome_swamp': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.SWAMP; }); break;
      case 'biome_tundra': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.TUNDRA; }); break;
      case 'biome_arcane': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.ARCANE; }); break;
      case 'biome_corrupted': tileMap.applyBrush(tx, ty, radius, t => { t.type = TerrainType.CORRUPTED; }); break;

      // LIFE SPAWN
      case 'spawn_human':
      case 'spawn_lumini':
      case 'spawn_sylvanii':
      case 'spawn_stonekin':
      case 'spawn_emberkin': {
        // The four old race brushes all place a person now. The retired ids are
        // still accepted so a hotbar saved before the change keeps working.
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.HUMAN, safe.x, safe.y);
        break;
      }
      case 'spawn_deer': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.DEER, safe.x, safe.y);
        break;
      }
      case 'spawn_wolf': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.WOLF, safe.x, safe.y);
        break;
      }
      case 'spawn_bear': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.BEAR, safe.x, safe.y);
        break;
      }
      case 'spawn_dragon': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.DRAGON, safe.x, safe.y);
        break;
      }
      case 'spawn_boar': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.BOAR, safe.x, safe.y);
        break;
      }
      case 'spawn_eagle': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.EAGLE, safe.x, safe.y);
        break;
      }
      case 'spawn_mammoth': {
        const safe = SimplePathfinder.findNearestLand(tx, ty, tileMap);
        if (safe) spawnEntityFn(SpeciesType.MAMMOTH, safe.x, safe.y);
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
        tileMap.applyBrush(tx, ty, radius, t => { t.isOnFire = true; });
        break;
      case 'earthquake': DisasterSystem.triggerEarthquake(tx, ty, tileMap, particles, camera); break;
      case 'meteorite': DisasterSystem.triggerMeteorite(tx, ty, tileMap, spatialHash, particles, camera); break;
      case 'plague': DisasterSystem.triggerPlague(tx, ty, spatialHash); break;
    }
  }
}
