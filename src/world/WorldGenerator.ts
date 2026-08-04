import { Tile } from './Tile';
import { TerrainType } from './Biomes';
import { SimplexNoise } from './Noise';
import { RandomService } from '../core/Random';
import { generateDeposits } from './Deposits';
import { WORLD_BLUEPRINTS, fieldOf, ridgeField } from './WorldBlueprints';

export type GeneratorPreset =
  | 'archipelago'
  | 'single_continent'
  | 'two_continents';

export class WorldGenerator {
  /**
   * Builds one of the three designed worlds.
   *
   * The `seed` argument is accepted for callers that still pass one, but it is
   * deliberately ignored for terrain: each world has a fixed seed baked into its
   * blueprint, because a map you can learn is worth more here than a map you
   * cannot predict.
   */
  public static generate(
    width: number,
    height: number,
    presetInput: GeneratorPreset = 'single_continent',
    _seed?: number
  ): Tile[][] {
    const blueprint = WORLD_BLUEPRINTS[presetInput] ?? WORLD_BLUEPRINTS.single_continent;
    const actualSeed = blueprint.seed;
    const rng = new RandomService(actualSeed);
    const noiseHeight = new SimplexNoise(rng);
    const noiseRidge = new SimplexNoise(new RandomService(actualSeed + 500));
    const noiseMoisture = new SimplexNoise(new RandomService(actualSeed + 1000));
    const noiseTemp = new SimplexNoise(new RandomService(actualSeed + 2000));
    // Low-frequency noise producing a few large, cohesive regions where magic
    // leaks into the world (instead of salt-and-pepper single-tile patches).
    const noiseMagic = new SimplexNoise(new RandomService(actualSeed + 3000));
    const noiseWarp = new SimplexNoise(new RandomService(actualSeed + 4000));

    const grid: Tile[][] = [];

    // Step 1: Compute height, moisture, and temperature maps
    for (let x = 0; x < width; x++) {
      grid[x] = [];
      for (let y = 0; y < height; y++) {
        const u = (x + 0.5) / width;
        const v = (y + 0.5) / height;

        // The designed landmass is the backbone of the height field. Noise only
        // roughens it, at an amplitude small enough that the shape survives —
        // otherwise the map stops being the map that was drawn.
        const detail = noiseHeight.octave2D(x, y, 5, 0.5, 0.035) - 0.5;
        const coast = noiseWarp.octave2D(x, y, 3, 0.5, 0.055) - 0.5;

        let land = fieldOf(blueprint.land, u, v);
        land += coast * 0.16;

        // Mountains sit on top of land that already exists, so a range never
        // rises straight out of open ocean.
        let ridgeAmount = 0;
        for (const range of blueprint.ranges) {
          ridgeAmount = Math.max(ridgeAmount, ridgeField(range, u, v) * range.height);
        }
        const ridgeNoise = 1 - Math.abs(noiseRidge.octave2D(x, y, 3, 0.5, 0.09) * 2 - 1);
        ridgeAmount *= 0.75 + ridgeNoise * 0.35;

        let nH = 0.3 + land * 0.42 + detail * 0.09;
        if (land > 0.15) nH += ridgeAmount * 0.34;
        nH = Math.max(0, Math.min(1, nH));

        // Climate. Latitude first, then altitude, then the designed dry regions.
        const latitude = Math.abs(v * 2 - 1); // 0 at the equator, 1 at the poles
        const tempNoise = noiseTemp.octave2D(x, y, 3, 0.5, 0.02) - 0.5;
        let tempC = 32 - latitude * latitude * 62 + tempNoise * 14;
        tempC -= Math.max(0, nH - 0.55) * 46; // Thinner air on the high ground

        let nM = noiseMoisture.octave2D(x, y, 4, 0.5, 0.035);
        nM += fieldOf(blueprint.wetlands, u, v) * 0.45;
        nM += fieldOf(blueprint.forests, u, v) * 0.2;
        const dry = fieldOf(blueprint.drylands, u, v);
        nM -= dry * 0.5;
        tempC += dry * 12;
        nM = Math.max(0, Math.min(1, nM));

        const forest = fieldOf(blueprint.forests, u, v);
        const wet = fieldOf(blueprint.wetlands, u, v);
        const type = this.classify(nH, tempC, nM, forest, wet, ridgeAmount, land);

        const tile = new Tile(x, y, type, nH);
        tile.temperature = Math.round(tempC);
        tile.moisture = nM;
        tile.fertility = this.fertilityFor(type, nM);

        grid[x][y] = tile;
      }
    }

    // Step 2: Carve Meandering Natural Rivers from Mountain Peaks to the Sea
    this.carveRivers(grid, width, height, rng);

    // Step 3: Cellular Biome Smoothing Pass to eliminate isolated single-pixel noise
    this.smoothBiomes(grid, width, height);

    // Step 3b: Escolhe 2-4 núcleos de magia/corrupção coesos
    this.carveMagicRegions(grid, width, height, rng, noiseMagic);

    // Step 4: Generate Clustered Natural Resources & Deposits
    generateDeposits(grid, width, height, actualSeed);

    return grid;
  }

  /**
   * Turns height, climate and the designed regions into a terrain type.
   *
   * Kept as one place so the biome rules are readable side by side — before
   * this, land collapsed straight to grass, which meant no mountains, and with
   * no mountains the river carver had no sources and never ran at all.
   */
  private static classify(
    nH: number,
    tempC: number,
    moisture: number,
    forest: number,
    wetland: number,
    ridge: number,
    land: number
  ): TerrainType {
    if (nH < 0.30) return TerrainType.DEEP_OCEAN;
    if (nH < 0.375) return TerrainType.SHALLOW_WATER;
    // The beach: a thin strip wherever land meets water.
    if (nH < 0.405) return TerrainType.SAND;

    // Rock above the treeline, or anywhere a designed range peaks.
    if (ridge > 0.42 || nH > 0.74) return TerrainType.MOUNTAIN;

    if (tempC <= -8) return TerrainType.SNOW;
    if (tempC <= 2) return TerrainType.TUNDRA;

    // Standing water on flat, saturated ground.
    if (wetland > 0.45 && nH < 0.5) return TerrainType.SWAMP;

    if (tempC >= 27 && moisture < 0.34) return TerrainType.SAND;
    if (tempC >= 22 && moisture < 0.46) return TerrainType.SAVANNA;

    if (forest > 0.4 && moisture > 0.4) return TerrainType.FOREST;
    // Deep interior with good rainfall turns to worked soil.
    if (moisture > 0.62 && land > 0.5) return TerrainType.SOIL;

    return TerrainType.GRASS;
  }

  /** Fertility follows the biome and how wet it is, not a flat constant. */
  private static fertilityFor(type: TerrainType, moisture: number): number {
    const base: Partial<Record<TerrainType, number>> = {
      [TerrainType.SOIL]: 0.95,
      [TerrainType.GRASS]: 0.8,
      [TerrainType.FOREST]: 0.6,
      [TerrainType.SWAMP]: 0.5,
      [TerrainType.SAVANNA]: 0.45,
      [TerrainType.TUNDRA]: 0.16,
      [TerrainType.SAND]: 0.1,
      [TerrainType.SNOW]: 0.04,
      [TerrainType.MOUNTAIN]: 0.05,
      [TerrainType.SHALLOW_WATER]: 0.1,
      [TerrainType.DEEP_OCEAN]: 0
    };
    const moistureFit = 1 - Math.min(0.6, Math.abs(moisture - 0.55) * 0.9);
    return Math.max(0.02, Math.min(1, (base[type] ?? 0.4) * moistureFit));
  }

  /**
   * Scatters a small number of cohesive arcane / corrupted regions. Rather than
   * the previous per-tile 1.5% salt-and-pepper, magic now appears as a few distinct
   * irradiated landscapes, each a contiguous patch — visually readable and
   * tactically meaningful.
   */
  private static carveMagicRegions(
    grid: Tile[][], width: number, height: number, rng: RandomService, noiseMagic: SimplexNoise
  ): void {
    // ~1 region per 64×64 of world area (2-6 regions depending on size), half
    // arcane, half corrupted.
    const regionCount = Math.max(2, Math.min(6, Math.round((width * height) / 4096)));
    const isArcane: boolean[] = [];
    for (let i = 0; i < regionCount; i++) isArcane.push(rng.chance(0.5));

    // Centers are drawn only from land, so a small archipelago still gets its
    // full quota of magic instead of a few tiles that survived the coast.
    const landTiles: Array<{ x: number; y: number }> = [];
    for (let x = 2; x < width - 2; x++) {
      for (let y = 2; y < height - 2; y++) {
        const t = grid[x][y];
        if (!this.isWaterType(t.type) && t.type !== TerrainType.MOUNTAIN && t.type !== TerrainType.LAVA) {
          landTiles.push({ x, y });
        }
      }
    }
    if (landTiles.length === 0) return;

    const usedCenters: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < regionCount; i++) {
      let center = rng.pick(landTiles);
      for (let attempt = 0; attempt < 60; attempt++) {
        const candidate = rng.pick(landTiles);
        if (usedCenters.every(c => Math.hypot(c.x - candidate.x, c.y - candidate.y) >= 24)) {
          center = candidate;
          break;
        }
      }
      usedCenters.push(center);

      // Grow a blob using the low-frequency magic noise so edges feather into
      // the surrounding biome rather than cutting a hard circle.
      const radius = rng.rangeInt(4, 7);
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
          const dist = Math.hypot(dx, dy);
          if (dist > radius) continue;
          const tile = grid[x][y];
          if (this.isWaterType(tile.type) || tile.type === TerrainType.MOUNTAIN) continue;
          const fall = 1 - dist / (radius + 0.5);
          // Combine radial falloff with magic noise for organic feathering.
          const m = noiseMagic.octave2D(x, y, 3, 0.5, 0.05);
          const chance = Math.min(0.95, 0.62 + fall * 0.3 + m * 0.15);
          if (!rng.chance(chance)) continue;
          tile.type = isArcane[i] ? TerrainType.ARCANE : TerrainType.CORRUPTED;
        }
      }
    }
  }

  private static isWaterType(type: TerrainType): boolean {
    return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
  }

  /**
   * Carves rivers from mountain peaks down to the sea.
   *
   * Flow follows the steepest descent. When a local minimum is reached (a closed
   * basin), the tile becomes a lake (SHALLOW_WATER) and the river carves an
   * overflow notch toward the lowest ridge neighbour, continuing onward — so a
   * river always terminates at the ocean rather than dying after an arbitrary
   * step count. Banks along the course are made fertile.
   */
  private static carveRivers(grid: Tile[][], width: number, height: number, rng: RandomService): void {
    const mountainTiles: Array<{ x: number; y: number }> = [];
    for (let x = 2; x < width - 2; x++) {
      for (let y = 2; y < height - 2; y++) {
        if (grid[x][y].type === TerrainType.MOUNTAIN && grid[x][y].height > 0.82) {
          mountainTiles.push({ x, y });
        }
      }
    }

    if (mountainTiles.length === 0) return;

    const riverCount = Math.min(6, Math.max(2, Math.floor(mountainTiles.length / 15)));
    const selectedSources: Array<{ x: number; y: number }> = [];
    const pool = [...mountainTiles];
    while (selectedSources.length < riverCount && pool.length > 0) {
      const idx = Math.floor(rng.next() * pool.length);
      selectedSources.push(pool.splice(idx, 1)[0]);
    }

    const DIRS = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
    ];

    for (const source of selectedSources) {
      let currX = source.x;
      let currY = source.y;
      let steps = 0;
      // Hard ceiling far above any realistic path length — only guards against
      // pathological loops. Real termination is reaching the sea.
      let lakeBudget = 6;

      while (steps < width * 2 + height * 2) {
        steps++;
        const currTile = grid[currX][currY];
        if (this.isWaterType(currTile.type)) break; // Reached the sea

        if (currTile.type !== TerrainType.MOUNTAIN) {
          currTile.type = TerrainType.SHALLOW_WATER;
          currTile.moisture = 0.95;
          currTile.fertility = 0.95;
        }

        this.fertiliseBanks(grid, currX, currY, width, height);

        let lowestX = currX;
        let lowestY = currY;
        let lowestHeight = currTile.height;
        const ridgeX = currX;
        let lowestRidgeHeight = Infinity;
        let lowestRidgeX = -1;
        let lowestRidgeY = -1;

        for (const d of DIRS) {
          const nx = currX + d.x;
          const ny = currY + d.y;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = grid[nx][ny];
          if (neighbor.height < lowestHeight) {
            lowestHeight = neighbor.height;
            lowestX = nx;
            lowestY = ny;
          }
          // Track the lowest ridge exit (neighbour not lower than current) for
          // overflow when stuck in a closed basin.
          if (neighbor.height >= currTile.height && neighbor.height < lowestRidgeHeight) {
            lowestRidgeHeight = neighbor.height;
            lowestRidgeX = nx;
            lowestRidgeY = ny;
          }
        }

        if (lowestX === currX && lowestY === currY) {
          // Local minimum: form a lake and overflow toward the lowest rim.
          if (lakeBudget <= 0) break; // Avoid infinite lake carving
          lakeBudget--;
          if (lowestRidgeX >= 0) {
            // Carve the rim down to this lake's level so flow can continue.
            const rim = grid[lowestRidgeX][lowestRidgeY];
            rim.height = currTile.height - 0.001;
            if (rim.type !== TerrainType.MOUNTAIN) {
              rim.type = TerrainType.SHALLOW_WATER;
              rim.moisture = 0.95;
            }
            currX = lowestRidgeX;
            currY = lowestRidgeY;
          } else {
            break; // No escape (single-tile map edge): give up.
          }
        } else {
          currX = lowestX;
          currY = lowestY;
        }
      }
    }
  }

  /** Promote banks around a river cell to fertile grass (any land type). */
  private static fertiliseBanks(grid: Tile[][], cx: number, cy: number, width: number, height: number): void {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const b = grid[nx][ny];
        if (
          b.type === TerrainType.SOIL ||
          b.type === TerrainType.SAVANNA ||
          b.type === TerrainType.GRASS ||
          b.type === TerrainType.SWAMP
        ) {
          if (b.type !== TerrainType.SWAMP) b.type = TerrainType.GRASS;
          b.moisture = Math.min(1, b.moisture + 0.3);
          b.fertility = Math.min(1, b.fertility + 0.35);
        }
      }
    }
  }

  /** Smooths isolated 1x1 terrain pixels for cohesive biomes across all terrestrial biomes. */
  private static smoothBiomes(grid: Tile[][], width: number, height: number): void {
    for (let x = 1; x < width - 1; x++) {
      for (let y = 1; y < height - 1; y++) {
        const tile = grid[x][y];
        // Water and mountains are kept crisp (coastlines and peaks stay sharp);
        // every other biome is eligible for single-pixel cleanup.
        if (tile.type === TerrainType.DEEP_OCEAN || tile.type === TerrainType.MOUNTAIN) continue;

        let landNeighbors = 0;
        const counts: Record<string, number> = {};
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nType = grid[x + dx][y + dy].type;
            counts[nType] = (counts[nType] ?? 0) + 1;
            if (nType !== TerrainType.DEEP_OCEAN && nType !== TerrainType.SHALLOW_WATER) landNeighbors++;
          }
        }
        // Only replace a truly isolated tile (surrounded by a different dominant
        // type) — prevents eating valid coastline specks.
        let dominant: string | null = null;
        let dominantCount = 0;
        for (const [t, c] of Object.entries(counts)) {
          if (t === tile.type) continue;
          if (c > dominantCount) { dominantCount = c; dominant = t; }
        }
        if (dominant && dominantCount >= 6 && dominant !== TerrainType.MOUNTAIN) {
          // Don't let land noise overwrite deep ocean (creates island specks).
          if (tile.type === TerrainType.SHALLOW_WATER && dominant === TerrainType.SHALLOW_WATER) continue;
          tile.type = dominant as TerrainType;
        }
        void landNeighbors;
      }
    }
  }
}
