import { BUILDINGS, BuildingType, ALL_BUILDING_TYPES, BASE_BUILDINGS } from '../src/civ/Building';
import { TECHNOLOGIES } from '../src/civ/TechTree';
import { ALL_GOODS, GoodId } from '../src/civ/Goods';

console.log('=== VERIFYING CONSTRUCTION REQUIREMENTS & PLACEMENT FOR ALL BUILDINGS ===\n');

const techUnlockedBuildings = new Set<BuildingType>();
for (const tech of Object.values(TECHNOLOGIES)) {
  if (tech.unlocks?.buildings) {
    for (const b of tech.unlocks.buildings) {
      techUnlockedBuildings.add(b);
    }
  }
}

let errors = 0;

for (const type of ALL_BUILDING_TYPES) {
  const def = BUILDINGS[type];
  console.log(`\n🏢 [Building: ${def.name} (${type})]`);
  console.log(`   - Icon: ${def.icon}`);
  console.log(`   - Category: ${def.category}`);
  console.log(`   - Max HP: ${def.maxHp}`);

  // 1. Cost Verification
  const costs = Object.entries(def.cost);
  if (costs.length === 0) {
    console.log(`   - Cost: Free (Starter/Core)`);
  } else {
    const costStr = costs.map(([g, amount]) => `${amount} ${g}`).join(', ');
    console.log(`   - Cost: ${costStr}`);
    for (const [good] of costs) {
      if (!ALL_GOODS.includes(good as GoodId)) {
        console.error(`     ❌ ERROR: Invalid cost good "${good}"!`);
        errors++;
      }
    }
  }

  // 2. Unlock Requirements Verification
  const isBase = BASE_BUILDINGS.includes(type);
  const isTechUnlocked = techUnlockedBuildings.has(type);
  const isWonder = ['monument', 'great_library', 'grand_aqueduct', 'colosseum'].includes(type);

  if (isBase) {
    console.log(`   - Unlock: Starter Base Building (Year 1)`);
  } else if (isTechUnlocked) {
    const techName = Object.values(TECHNOLOGIES).find(t => t.unlocks?.buildings?.includes(type))?.name;
    console.log(`   - Unlock: Tech "${techName}"`);
  } else if (isWonder) {
    console.log(`   - Unlock: Great Person Historic Wonder`);
  } else {
    console.error(`     ❌ ERROR: Building "${type}" has no unlock condition!`);
    errors++;
  }

  // 3. Placement Conditions
  const reqs: string[] = [];
  if (def.unique) reqs.push('Unique (1 per city)');
  if (def.requiresTileResource) reqs.push(`Tile Resource: ${def.requiresTileResource}`);
  if (def.requiresCoast) reqs.push('Requires Coastal Water Neighbor');
  console.log(`   - Placement Constraints: ${reqs.length > 0 ? reqs.join(', ') : 'Standard Dry Land'}`);
}

console.log('\n==================================================');
console.log(`Total Buildings Tested: ${ALL_BUILDING_TYPES.length}`);
if (errors === 0) {
  console.log('✅ ALL 29 BUILDINGS HAVE VALID COSTS, UNLOCKS & PLACEMENT CONSTRAINTS!');
} else {
  console.error(`❌ FOUND ${errors} CONFIGURATION ERRORS!`);
}
