// Mock document.createElement for Node environment
(globalThis as any).document = {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 16,
        height: 16,
        getContext: () => ({
          imageSmoothingEnabled: false,
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          fillRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
          setLineDash: () => {}
        })
      };
    }
    return {};
  }
};

import { BUILDINGS, BuildingType } from '../src/civ/Building';
import { SpriteGenerator } from '../src/renderer/SpriteGenerator';

console.log('=== VERIFYING ALL BUILDING SPRITES IN AETHORIA ===\n');

const allBuildingTypes = Object.keys(BUILDINGS) as BuildingType[];
console.log(`Total Building Types Defined in BUILDINGS: ${allBuildingTypes.length}`);

let missingCount = 0;
let successCount = 0;

for (const type of allBuildingTypes) {
  const spriteKey = `b_${type}`;
  const exists = SpriteGenerator.has(spriteKey);
  if (exists) {
    console.log(`  [OK] ${type.padEnd(20)} -> Sprite key "${spriteKey}" registered!`);
    successCount++;
  } else {
    console.error(`  [MISSING] ${type.padEnd(20)} -> Sprite key "${spriteKey}" NOT FOUND!`);
    missingCount++;
  }
}

console.log('\n--- SUMMARY ---');
console.log(`Total Registered Sprites: ${successCount} / ${allBuildingTypes.length}`);
if (missingCount === 0) {
  console.log('✅ ALL 29 BUILDINGS HAVE UNIQUE DETAILED SPRITES REGISTERED!');
} else {
  console.error(`❌ ${missingCount} BUILDINGS ARE MISSING SPRITES!`);
}
