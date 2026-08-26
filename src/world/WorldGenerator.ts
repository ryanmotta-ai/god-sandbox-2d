import { Tile } from './Tile';
import { TerrainType } from './Biomes';
import { SimplexNoise } from './Noise';
import { RandomService } from '../core/Random';
import { generateDeposits } from './Deposits';
import { WORLD_BLUEPRINTS, fieldOf, ridgeField, type WorldBlueprint } from './WorldBlueprints';
import { WORLD_CHUNK_SIZE } from './WorldChunks';

export type GeneratorPreset = 'archipelago' | 'single_continent' | 'two_continents';

const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIRECTIONS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
] as const;

interface GenerationNoise {
  continental: SimplexNoise;
  coast: SimplexNoise;
  detail: SimplexNoise;
  warpU: SimplexNoise;
  warpV: SimplexNoise;
  ridge: SimplexNoise;
  basin: SimplexNoise;
  moisture: SimplexNoise;
  temperature: SimplexNoise;
}

/** Geographic generation 2.0: continental structure first, local detail last. */
export class WorldGenerator {
  public static generate(
    width: number,
    height: number,
    presetInput: GeneratorPreset = 'single_continent',
    seed?: number,
    targetGrid?: Tile[][],
    onProgress?: (stage: string, completed: number, total: number) => void
  ): Tile[][] {
    const blueprint = WORLD_BLUEPRINTS[presetInput] ?? WORLD_BLUEPRINTS.single_continent;
    const actualSeed = this.mixSeed(blueprint.seed, seed ?? blueprint.seed);
    const rng = new RandomService(actualSeed);
    const noise = this.createNoise(actualSeed);
    const grid: Tile[][] = targetGrid ?? [];
    const tileCount = width * height;
    const ridgeStrength = new Float32Array(tileCount);

    for (let x = 0; x < width; x++) if (!grid[x]) grid[x] = [];
    const chunksX = Math.ceil(width / WORLD_CHUNK_SIZE);
    const chunksY = Math.ceil(height / WORLD_CHUNK_SIZE);
    let completedChunks = 0;

    // Relief and broad climate are evaluated in WORLD-V1 chunks. All noise is
    // sampled in normalized coordinates, so a 512 map has larger regions rather
    // than four times as many tiny ones.
    for (let chunkX = 0; chunkX < chunksX; chunkX++) {
      for (let chunkY = 0; chunkY < chunksY; chunkY++) {
        const minX = chunkX * WORLD_CHUNK_SIZE;
        const minY = chunkY * WORLD_CHUNK_SIZE;
        const maxX = Math.min(width, minX + WORLD_CHUNK_SIZE);
        const maxY = Math.min(height, minY + WORLD_CHUNK_SIZE);

        for (let x = minX; x < maxX; x++) {
          for (let y = minY; y < maxY; y++) {
            const u = (x + 0.5) / width;
            const v = (y + 0.5) / height;
            const warpU = (noise.warpU.octave2D(u, v, 3, 0.52, 2.1) - 0.5) * 0.065;
            const warpV = (noise.warpV.octave2D(u, v, 3, 0.52, 2.1) - 0.5) * 0.065;
            const wu = u + warpU;
            const wv = v + warpV;

            const designedLand = fieldOf(blueprint.land, wu, wv);
            const landInfluence = this.clamp(designedLand * 4, 0, 1);
            const continental = noise.continental.octave2D(u, v, 4, 0.52, 1.45) - 0.5;
            const coast = noise.coast.octave2D(u, v, 3, 0.5, 4.8) - 0.5;
            const detail = noise.detail.octave2D(u, v, 3, 0.48, 12) - 0.5;
            const land = designedLand
              + continental * (0.07 + landInfluence * 0.13)
              + coast * 0.055;

            let ridge = 0;
            for (const range of blueprint.ranges) {
              ridge = Math.max(ridge, ridgeField(range, wu, wv) * range.height);
            }
            const ridgeTexture = noise.ridge.octave2D(u, v, 3, 0.5, 7.5);
            ridge *= 0.78 + ridgeTexture * 0.34;
            ridgeStrength[x * height + y] = ridge;

            const shapedLand = Math.pow(Math.max(0, Math.min(1.2, land)), 0.52);
            const basin = 1 - Math.abs(noise.basin.octave2D(u, v, 3, 0.5, 2.6) * 2 - 1);
            let elevation = 0.225 + shapedLand * 0.52 + detail * 0.035;
            if (land > 0.08) elevation += ridge * 0.38;
            if (land > 0.2 && ridge < 0.16) elevation -= basin * 0.025;

            // Keep a navigable ocean frame and prevent noisy land bridges at the
            // map boundary. Designed islands remain safely inside this margin.
            const edgeDistance = Math.min(u, v, 1 - u, 1 - v);
            if (edgeDistance < 0.045) elevation -= (0.045 - edgeDistance) * 4.8;
            elevation = this.clamp(elevation, 0, 1);

            const latitude = Math.abs(v * 2 - 1);
            const temperatureRegion = noise.temperature.octave2D(u, v, 3, 0.52, 1.8) - 0.5;
            let temperature = 32 - latitude * latitude * 61 + temperatureRegion * 13;
            temperature -= Math.max(0, elevation - 0.53) * 54;

            const wetRegion = fieldOf(blueprint.wetlands, wu, wv);
            const forestRegion = fieldOf(blueprint.forests, wu, wv);
            const dryRegion = fieldOf(blueprint.drylands, wu, wv);
            let moisture = 0.43 + (noise.moisture.octave2D(u, v, 4, 0.55, 1.75) - 0.5) * 0.62;
            moisture += wetRegion * 0.38 + forestRegion * 0.18 - dryRegion * 0.5;
            temperature += dryRegion * 10;

            const reliefType = elevation < 0.295
              ? TerrainType.DEEP_OCEAN
              : elevation < 0.345
                ? TerrainType.SHALLOW_WATER
                : ridge > 0.34 || elevation > 0.79
                  ? TerrainType.MOUNTAIN
                  : TerrainType.GRASS;
            const tile = new Tile(x, y, reliefType, elevation);
            tile.temperature = Math.round(temperature);
            tile.moisture = this.clamp(moisture, 0, 1);
            tile.fertility = this.fertilityFor(reliefType, tile.moisture);
            grid[x][y] = tile;
          }
        }
        completedChunks++;
        onProgress?.('terrain', completedChunks, chunksX * chunksY);
      }
    }

    // Ocean distance supplies continentality, wet coasts and river routing in a
    // single linear pass. It also makes inland basins visibly distinct.
    const oceanDistance = this.buildOceanDistance(grid, width, height);
    this.classifyRegionalBiomes(grid, width, height, blueprint, noise, ridgeStrength, oceanDistance);
    onProgress?.('climate', 1, 1);

    this.smoothBiomes(grid, width, height, 2);
    onProgress?.('biomes', 1, 1);

    this.carveRiverSystems(grid, width, height, rng, oceanDistance);
    onProgress?.('rivers', 1, 1);

    generateDeposits(grid, width, height, actualSeed);
    onProgress?.('resources', 1, 1);
    return grid;
  }

  private static createNoise(seed: number): GenerationNoise {
    const at = (offset: number) => new SimplexNoise(new RandomService((seed + offset) >>> 0));
    return {
      continental: at(101), coast: at(503), detail: at(907),
      warpU: at(1301), warpV: at(1699), ridge: at(2203), basin: at(2801),
      moisture: at(3301), temperature: at(3907)
    };
  }

  private static mixSeed(a: number, b: number): number {
    let value = (a ^ b ^ 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return (value ^ (value >>> 15)) >>> 0;
  }

  private static classifyRegionalBiomes(
    grid: Tile[][],
    width: number,
    height: number,
    blueprint: WorldBlueprint,
    noise: GenerationNoise,
    ridgeStrength: Float32Array,
    oceanDistance: Int32Array
  ): void {
    const scale = Math.max(1, Math.min(width, height));
    for (let chunkX = 0; chunkX < Math.ceil(width / WORLD_CHUNK_SIZE); chunkX++) {
      for (let chunkY = 0; chunkY < Math.ceil(height / WORLD_CHUNK_SIZE); chunkY++) {
        const maxX = Math.min(width, (chunkX + 1) * WORLD_CHUNK_SIZE);
        const maxY = Math.min(height, (chunkY + 1) * WORLD_CHUNK_SIZE);
        for (let x = chunkX * WORLD_CHUNK_SIZE; x < maxX; x++) {
          for (let y = chunkY * WORLD_CHUNK_SIZE; y < maxY; y++) {
            const tile = grid[x][y];
            if (this.isWaterType(tile.type) || tile.type === TerrainType.MOUNTAIN) {
              tile.fertility = this.fertilityFor(tile.type, tile.moisture);
              continue;
            }
            const u = (x + 0.5) / width;
            const v = (y + 0.5) / height;
            const forest = fieldOf(blueprint.forests, u, v);
            const wetland = fieldOf(blueprint.wetlands, u, v);
            const dryland = fieldOf(blueprint.drylands, u, v);
            const continentality = this.clamp(oceanDistance[x * height + y] / (scale * 0.3), 0, 1);
            const coastalRain = Math.exp(-oceanDistance[x * height + y] / Math.max(5, scale * 0.055)) * 0.2;
            const regional = (noise.moisture.octave2D(u, v, 3, 0.55, 2.15) - 0.5) * 0.2;
            tile.moisture = this.clamp(
              tile.moisture + coastalRain + regional - continentality * 0.14 - dryland * 0.2,
              0,
              1
            );

            tile.type = this.classifyLand(
              tile.height,
              tile.temperature,
              tile.moisture,
              forest,
              wetland,
              ridgeStrength[x * height + y],
              oceanDistance[x * height + y]
            );
            tile.fertility = this.fertilityFor(tile.type, tile.moisture);
          }
        }
      }
    }
  }

  private static classifyLand(
    elevation: number,
    _temperature: number,
    _moisture: number,
    _forest: number,
    _wetland: number,
    ridge: number,
    _oceanDistance: number
  ): TerrainType {
    if (ridge > 0.34 || elevation > 0.79) return TerrainType.MOUNTAIN;
    return TerrainType.GRASS;
  }

  private static fertilityFor(type: TerrainType, moisture: number): number {
    const base: Partial<Record<TerrainType, number>> = {
      [TerrainType.GRASS]: 0.88, [TerrainType.SOIL]: 0.92, [TerrainType.FOREST]: 0.66,
      [TerrainType.SAVANNA]: 0.48, [TerrainType.SWAMP]: 0.56, [TerrainType.SAND]: 0.16,
      [TerrainType.TUNDRA]: 0.25, [TerrainType.SNOW]: 0.08, [TerrainType.MOUNTAIN]: 0.04,
      [TerrainType.SHALLOW_WATER]: 0.08, [TerrainType.DEEP_OCEAN]: 0
    };
    const moistureFit = 1 - Math.min(0.68, Math.abs(moisture - 0.58) * 0.9);
    return this.clamp((base[type] ?? 0.4) * moistureFit, 0.01, 1);
  }

  /** Multi-source breadth-first distance from the original sea, O(width*height). */
  private static buildOceanDistance(grid: Tile[][], width: number, height: number): Int32Array {
    const distances = new Int32Array(width * height);
    distances.fill(-1);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
      if (!this.isWaterType(grid[x][y].type)) continue;
      const index = x * height + y;
      distances[index] = 0;
      queue[tail++] = index;
    }
    while (head < tail) {
      const index = queue[head++];
      const x = Math.floor(index / height);
      const y = index % height;
      const nextDistance = distances[index] + 1;
      for (const [dx, dy] of CARDINALS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = nx * height + ny;
        if (distances[next] >= 0) continue;
        distances[next] = nextDistance;
        queue[tail++] = next;
      }
    }
    return distances;
  }

  private static carveRiverSystems(
    grid: Tile[][],
    width: number,
    height: number,
    rng: RandomService,
    oceanDistance: Int32Array
  ): void {
    const minSize = Math.min(width, height);
    const candidates: Array<{ x: number; y: number; score: number }> = [];
    for (let x = 2; x < width - 2; x++) for (let y = 2; y < height - 2; y++) {
      const tile = grid[x][y];
      const distance = oceanDistance[x * height + y];
      if (tile.height < 0.68 || distance < Math.max(8, minSize * 0.07)) continue;
      if (tile.type !== TerrainType.MOUNTAIN && tile.height < 0.75) continue;
      candidates.push({ x, y, score: distance * 2.4 + tile.height * 80 + rng.next() * 4 });
    }
    candidates.sort((a, b) => b.score - a.score);

    const targetRivers = Math.max(3, Math.min(16, Math.round(minSize / 34)));
    const sourceSpacing = Math.max(14, minSize / 13);
    const sources: Array<{ x: number; y: number }> = [];
    for (const candidate of candidates) {
      if (sources.every(source => Math.hypot(source.x - candidate.x, source.y - candidate.y) >= sourceSpacing)) {
        sources.push(candidate);
        if (sources.length >= targetRivers) break;
      }
    }

    const riverMask = new Uint8Array(width * height);
    let maxOceanDistance = 1;
    for (const distance of oceanDistance) maxOceanDistance = Math.max(maxOceanDistance, distance);
    for (const source of sources) {
      let x = source.x;
      let y = source.y;
      let previousDx = 0;
      let previousDy = 0;
      let previousX = -1;
      let previousY = -1;
      let lakeBudget = 2;
      const maxSteps = width + height + Math.round(minSize * 0.75);

      for (let step = 0; step < maxSteps; step++) {
        const index = x * height + y;
        if (oceanDistance[index] === 0) break;
        if (riverMask[index] && step > 0) break;
        riverMask[index] = 1;
        const current = grid[x][y];
        current.type = TerrainType.SHALLOW_WATER;
        current.moisture = 1;
        current.fertility = 0.12;
        this.fertiliseBanks(grid, x, y, width, height);

        let best: { x: number; y: number; dx: number; dy: number; score: number; height: number } | null = null;
        for (const [dx, dy] of DIRECTIONS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (nx === previousX && ny === previousY) continue;
          const nextIndex = nx * height + ny;
          const next = grid[nx][ny];
          const descent = next.height - current.height;
          const directionLength = Math.hypot(dx, dy);
          const alignment = previousDx === 0 && previousDy === 0
            ? 0
            : (dx * previousDx + dy * previousDy) / (directionLength * Math.hypot(previousDx, previousDy));
          const meander = this.coordinateHash(nx, ny, source.x * 73856093 ^ source.y * 19349663) * 0.035;
          let score = next.height * 1.45
            + (oceanDistance[nextIndex] / maxOceanDistance) * 0.82
            + Math.max(0, descent) * 0.5
            - alignment * 0.045
            + meander;
          if (oceanDistance[nextIndex] >= oceanDistance[index]) {
            score += 0.08 + (oceanDistance[nextIndex] - oceanDistance[index]) * 0.025;
          }
          if (oceanDistance[nextIndex] === 0) score -= 2;
          if (riverMask[nextIndex]) score += 1.2;
          if (!best || score < best.score) best = { x: nx, y: ny, dx, dy, score, height: next.height };
        }
        if (!best) break;

        const trapped = best.height >= current.height - 0.001;
        if (trapped && lakeBudget > 0 && oceanDistance[index] > Math.max(7, minSize * 0.035)) {
          this.carveLake(grid, width, height, x, y, Math.max(2, Math.round(minSize / 170)), current.height);
          lakeBudget--;
        }

        // A shallow spill notch guarantees eventual drainage while retaining the
        // original broad relief everywhere away from the one-tile river channel.
        const nextTile = grid[best.x][best.y];
        if (nextTile.height >= current.height) nextTile.height = Math.max(0.3, current.height - 0.0015);
        previousX = x;
        previousY = y;
        previousDx = best.dx;
        previousDy = best.dy;
        x = best.x;
        y = best.y;
      }
    }
  }

  private static carveLake(
    grid: Tile[][],
    width: number,
    height: number,
    cx: number,
    cy: number,
    radius: number,
    level: number
  ): void {
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
      const irregularity = this.coordinateHash(x, y, cx * 31 + cy * 17) * 0.55;
      if (Math.hypot(dx, dy) > radius - irregularity) continue;
      const tile = grid[x][y];
      if (tile.type === TerrainType.MOUNTAIN || this.isWaterType(tile.type)) continue;
      tile.height = Math.min(tile.height, level - 0.002);
      tile.type = TerrainType.SHALLOW_WATER;
      tile.moisture = 1;
      tile.fertility = 0.1;
      this.fertiliseBanks(grid, x, y, width, height);
    }
  }

  private static fertiliseBanks(grid: Tile[][], cx: number, cy: number, width: number, height: number): void {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const tile = grid[x][y];
      if (this.isWaterType(tile.type) || tile.type === TerrainType.MOUNTAIN) continue;
      tile.moisture = Math.min(1, tile.moisture + 0.22);
      tile.fertility = Math.min(1, tile.fertility + 0.28);
      tile.type = TerrainType.GRASS;
    }
  }

  /** Two immutable cellular passes remove tiny biome flecks without eroding relief. */
  private static smoothBiomes(grid: Tile[][], width: number, height: number, passes: number): void {
    for (let pass = 0; pass < passes; pass++) {
      const next = new Array<TerrainType>(width * height);
      for (let chunkX = 0; chunkX < Math.ceil(width / WORLD_CHUNK_SIZE); chunkX++) {
        for (let chunkY = 0; chunkY < Math.ceil(height / WORLD_CHUNK_SIZE); chunkY++) {
          const maxX = Math.min(width - 1, (chunkX + 1) * WORLD_CHUNK_SIZE);
          const maxY = Math.min(height - 1, (chunkY + 1) * WORLD_CHUNK_SIZE);
          for (let x = Math.max(1, chunkX * WORLD_CHUNK_SIZE); x < maxX; x++) {
            for (let y = Math.max(1, chunkY * WORLD_CHUNK_SIZE); y < maxY; y++) {
              const tile = grid[x][y];
              if (this.isWaterType(tile.type) || tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SNOW) continue;
              const counts = new Map<TerrainType, number>();
              for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const type = grid[x + dx][y + dy].type;
                if (this.isWaterType(type) || type === TerrainType.MOUNTAIN) continue;
                counts.set(type, (counts.get(type) ?? 0) + 1);
              }
              let dominant: TerrainType = tile.type;
              let count = 0;
              for (const [type, value] of counts) if (value > count) { dominant = type; count = value; }
              if (dominant !== tile.type && count >= 6) next[x * height + y] = dominant;
            }
          }
        }
      }
      for (let x = 1; x < width - 1; x++) for (let y = 1; y < height - 1; y++) {
        const type = next[x * height + y];
        if (!type) continue;
        const tile = grid[x][y];
        tile.type = type;
        tile.fertility = this.fertilityFor(type, tile.moisture);
      }
    }
  }

  private static isWaterType(type: TerrainType): boolean {
    return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
  }

  private static coordinateHash(x: number, y: number, seed: number): number {
    let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y + seed, 0x119de1f3);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
