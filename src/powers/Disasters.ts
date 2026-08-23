import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { Entity } from '../entities/Entity';
import { TraitId } from '../entities/Traits';
import { SpatialHash } from '../core/SpatialHash';
import { sound } from '../core/SoundSynth';
import { ParticleManager } from '../renderer/Particles';

import { Camera } from '../renderer/Camera';

export class DisasterSystem {
  /**
   * `severity` separates an act of god from the weather.
   *
   * The player's own lightning should be devastating — that is the whole point
   * of a god power. But main.ts fires the same function as an ambient natural
   * disaster, and at full strength one strike ruined a building outright and set
   * it alight. A ruin takes seven to thirteen years to rebuild, so on the higher
   * disaster frequencies a settlement lost ground faster than it could recover it.
   */
  public static triggerLightning(x: number, y: number, tileMap: TileMap, spatialHash: SpatialHash<Entity>, particles: ParticleManager, camera?: Camera, severity: number = 1): void {
    sound.playThunder();
    particles.spawnExplosion(x, y, '#fef08a', 25);
    if (camera) camera.triggerShake(10, 0.25);

    tileMap.applyBrush(x, y, 1.5, tile => {
      // Lightning over open water flashes and is gone. It used to leave the sea
      // itself alight.
      tileMap.igniteTile(tile);
      if (tile.buildingId) tileMap.recordBuildingDamage(tile, .72 * severity, 'disaster');
    });

    const hitEntities = spatialHash.queryRadius(x, y, 3);
    for (const e of hitEntities) {
      e.hp -= 80 * severity;
      particles.spawnDamageNumber(e.x, e.y, Math.round(80 * severity));
    }
  }

  public static triggerMeteorite(x: number, y: number, tileMap: TileMap, spatialHash: SpatialHash<Entity>, particles: ParticleManager, camera?: Camera): void {
    sound.playExplosion();
    particles.spawnExplosion(x, y, '#ef4444', 60);
    if (camera) camera.triggerShake(22, 0.6);

    // Crater impact
    tileMap.applyBrush(x, y, 4, tile => {
      const dx = tile.x - x;
      const dy = tile.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 1.5) {
        tile.type = TerrainType.LAVA;
        tile.height = Math.max(0, tile.height - 0.4);
        if (tile.buildingId) tileMap.recordBuildingDamage(tile, 1.25, 'disaster');
      } else if (dist < 3) {
        tile.type = TerrainType.SOIL;
        tileMap.igniteTile(tile);
        if (tile.buildingId) tileMap.recordBuildingDamage(tile, .55, 'disaster');
      }
      tile.resourceType = null;
    });

    // Shockwave damage
    const hitEntities = spatialHash.queryRadius(x, y, 6);
    for (const e of hitEntities) {
      const dx = e.x - x;
      const dy = e.y - y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const damage = Math.round(200 / dist);
      e.hp -= damage;
      particles.spawnDamageNumber(e.x, e.y, damage);
    }
  }

  public static triggerEarthquake(x: number, y: number, tileMap: TileMap, spatialHash: SpatialHash<Entity>, particles: ParticleManager, camera?: Camera, severity: number = 1): void {
    sound.playHit();
    particles.spawnExplosion(x, y, '#78350f', 30);
    if (camera) camera.triggerShake(14, 0.4);

    tileMap.applyBrush(x, y, 5, tile => {
      if (tile.type === TerrainType.MOUNTAIN) {
        tile.type = TerrainType.SOIL;
      } else if (!tile.type.includes('ocean')) {
        // Lowering the ground is permanent. At full strength an ambient quake
        // sank coastal blocks under shallow water for the rest of the world's
        // life; a god's earthquake still can, the weather's should not.
        tile.height = Math.max(0, tile.height - 0.25 * severity);
      }
      if (tile.buildingId) tileMap.recordBuildingDamage(tile, .48 * severity, 'disaster');
    });

    // The ground opening up used to be the one disaster that hurt nobody: it
    // reshaped terrain and cracked buildings, and every person standing on it
    // walked away untouched. Lightning, the meteor and the plague all reach for
    // the spatial index; this one was never given it.
    for (const entity of spatialHash.queryRadius(x, y, 4)) {
      const damage = Math.round(45 * severity);
      entity.hp -= damage;
      particles.spawnDamageNumber(entity.x, entity.y, damage);
    }
  }

  public static triggerPlague(x: number, y: number, spatialHash: SpatialHash<Entity>): number {
    sound.playMagic();
    const targets = spatialHash.queryRadius(x, y, 4);
    let infected = 0;
    for (const e of targets) {
      if (!e.traits.has(TraitId.CURSED)) {
        e.addTrait(TraitId.CURSED);
        infected++;
      }
    }
    return infected;
  }
}
