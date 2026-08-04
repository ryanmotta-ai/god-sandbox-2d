/**
 * What a citizen actually feels, updated once per in-world day.
 *
 * These are the hinge of the whole citizen simulation: hunger sends someone home
 * to eat, eating draws on the household pantry, an empty pantry makes the family
 * spend coin, and coin comes from delivering real work. Without needs, the daily
 * routine, the household economy and the priority AI are all decoration.
 */
export interface EntityNeeds {
  /** 0 = fed, 100 = starving. */
  hunger: number;
  /** 0 = miserable, 100 = comfortable. Driven by housing. */
  comfort: number;
  /** 0 = in danger, 100 = secure. Driven by threats and walls. */
  safety: number;
}

export function createNeeds(): EntityNeeds {
  return { hunger: 12, comfort: 55, safety: 70 };
}

/** Hunger gained per day when nothing is eaten. */
export const HUNGER_PER_DAY = 16;
/** Hunger above which a citizen drops what they are doing and looks for food. */
export const HUNGER_SEEK_FOOD = 55;
/** Hunger above which the body starts failing. */
export const HUNGER_STARVING = 88;
/** Energy below which a citizen must rest regardless of the hour. */
export const ENERGY_EXHAUSTED = 12;

/**
 * Food eaten per meal.
 *
 * Sized so the daily model agrees with the settlement's yearly ration: at
 * HUNGER_PER_DAY over a 12-day year, a citizen takes roughly three meals a
 * year, which must add up to what FOOD_PER_CITIZEN says they eat. Two food
 * models on different scales meant the same mouths were fed twice.
 */
export const MEAL_ADULT = 0.45;
export const MEAL_CHILD = 0.28;
/** Hunger a full meal removes. */
export const MEAL_RELIEF = 62;

export type Profession = 'farmer' | 'woodcutter' | 'miner' | 'builder' | 'soldier' | 'archer' | 'scout' | 'healer' | 'leader' | 'king' | 'none';

export type PersonalityType = 'ambitious' | 'diplomatic' | 'aggressive' | 'paranoid' | 'peaceful' | 'greedy';

/** AI behavioral state machine states */
export type AIState =
  | 'idle'           // Standing still, breathing
  | 'wander'         // Random exploration
  | 'patrol'         // Walking guard route near city
  | 'gather_wood'    // Moving to forest (visual workplace)
  | 'gather_food'    // Moving to farm (visual workplace)
  | 'gather_ore'     // Moving to mine (visual workplace)
  | 'return_city'    // Carrying resources back to city
  | 'build'          // Constructing building
  | 'craft'          // Working a bench in a workshop/smithy/factory (visual workplace)
  | 'eat'            // Heading home to take a meal from the household pantry
  | 'deliver'        // Carrying a real load back to the settlement store
  | 'hunt'           // Chasing prey (fauna)
  | 'attack'         // Engaging enemy combatant
  | 'flee'           // Running from danger
  | 'heal'           // Resting to recover HP
  | 'socialize'      // Moving toward friendly entity
  | 'explore'        // Scouting unknown territory
  | 'defend_city'    // Moving to defend city under attack
  | 'raid'           // Moving to attack enemy territory
  | 'forage'         // Animals eating
  | 'pack_hunt'      // Coordinated wolf pack behavior
  | 'return_home'    // Walking home at dusk
  | 'go_to_work';    // Walking to workplace at dawn
