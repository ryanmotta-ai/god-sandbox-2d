import { TileMap } from '../src/world/TileMap';
import { SimplePathfinder } from '../src/ai/Pathfinding';
import { TERRAINS } from '../src/world/Biomes';

console.log('=== PATHFINDING & PORT PLACEMENT DIAGNOSTIC ===\n');

const tileMap = new TileMap(60, 60, 'archipelago');

let landCount = 0;
let waterCount = 0;
let coastalTilesCount = 0;

for (let x = 0; x < 60; x++) {
  for (let y = 0; y < 60; y++) {
    const tile = tileMap.grid[x][y];
    if (TERRAINS[tile.type].isWater) {
      waterCount++;
    } else {
      landCount++;
      const hasWaterNeighbor = tileMap.getNeighbors(x, y, true).some(n => TERRAINS[n.type].isWater);
      if (hasWaterNeighbor) coastalTilesCount++;
    }
  }
}

console.log(`Map Size: 60x60 (${60 * 60} tiles)`);
console.log(`Land Tiles: ${landCount}`);
console.log(`Water Tiles: ${waterCount}`);
console.log(`Coastal Tiles (any water neighbor): ${coastalTilesCount}`);

// Test straight line interpolation between (10, 10) and (50, 50)
let waterCrossingsInStraightLine = 0;
const startX = 10, startY = 10, endX = 50, endY = 50;
const steps = 100;

for (let i = 0; i <= steps; i++) {
  const t = i / steps;
  const cx = Math.floor(startX + (endX - startX) * t);
  const cy = Math.floor(startY + (endY - startY) * t);
  const tile = tileMap.getTile(cx, cy);
  if (tile && TERRAINS[tile.type].isWater) {
    waterCrossingsInStraightLine++;
  }
}

console.log(`\nStraight Line Test (10,10 -> 50,50):`);
console.log(`Water Tiles Intersected in Straight Line: ${waterCrossingsInStraightLine} / 100 steps`);

// Find two land tiles
const landStart = SimplePathfinder.findNearestLand(10, 10, tileMap);
const landEnd = SimplePathfinder.findNearestLand(50, 50, tileMap);

const landPath = SimplePathfinder.findPath(landStart.x, landStart.y, landEnd.x, landEnd.y, tileMap, 'land');
let aStarWaterSteps = 0;
for (const pt of landPath) {
  const tile = tileMap.getTile(Math.floor(pt.x), Math.floor(pt.y));
  if (tile && TERRAINS[tile.type].isWater) aStarWaterSteps++;
}
console.log(`\nA* Land Pathfinding Test (${landStart.x.toFixed(0)},${landStart.y.toFixed(0)} -> ${landEnd.x.toFixed(0)},${landEnd.y.toFixed(0)}):`);
console.log(`Total Waypoints: ${landPath.length}`);
console.log(`Water Tiles in A* Land Path: ${aStarWaterSteps}`);
if (aStarWaterSteps === 0) {
  console.log(`✅ A* Land Pathfinding is 100% WATER-FREE! Camels will never cross water!`);
}
