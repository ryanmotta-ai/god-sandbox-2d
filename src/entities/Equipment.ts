export type ItemType = 'weapon' | 'armor' | 'accessory';
export type WeaponCategory = 'melee' | 'ranged' | 'siege' | 'magic';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  category?: WeaponCategory;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  damageBonus: number;
  defenseBonus: number;
  hpBonus: number;
  attackRange?: number; // Melee = 1.8, Ranged = 5.5, Siege = 8
  techRequired?: string;
}

export const WEAPON_TIERS: Record<string, Omit<Item, 'id'>[]> = {
  primitive: [
    { name: 'Lança de Madeira', type: 'weapon', category: 'melee', rarity: 'common', damageBonus: 4, defenseBonus: 1, hpBonus: 0, attackRange: 2.2 },
    { name: 'Clava de Pedra', type: 'weapon', category: 'melee', rarity: 'common', damageBonus: 6, defenseBonus: 0, hpBonus: 0, attackRange: 1.8 },
    { name: 'Funda de Caça', type: 'weapon', category: 'ranged', rarity: 'common', damageBonus: 3, defenseBonus: 0, hpBonus: 0, attackRange: 4.5 }
  ],
  iron: [
    { name: 'Espada Larga de Ferro', type: 'weapon', category: 'melee', rarity: 'uncommon', damageBonus: 12, defenseBonus: 3, hpBonus: 10, attackRange: 1.8 },
    { name: 'Besta de Guerra', type: 'weapon', category: 'ranged', rarity: 'uncommon', damageBonus: 14, defenseBonus: 0, hpBonus: 0, attackRange: 5.5 },
    { name: 'Alabarda de Ferro', type: 'weapon', category: 'melee', rarity: 'uncommon', damageBonus: 15, defenseBonus: 4, hpBonus: 15, attackRange: 2.5 }
  ],
  steel: [
    { name: 'Montante de Aço', type: 'weapon', category: 'melee', rarity: 'rare', damageBonus: 22, defenseBonus: 6, hpBonus: 25, attackRange: 2.0 },
    { name: 'Arco Longo Composto', type: 'weapon', category: 'ranged', rarity: 'rare', damageBonus: 20, defenseBonus: 0, hpBonus: 10, attackRange: 6.0 },
    { name: 'Catapulta de Cerco', type: 'weapon', category: 'siege', rarity: 'rare', damageBonus: 45, defenseBonus: 0, hpBonus: 50, attackRange: 8.0 }
  ],
  // Firearms are deliberately typed as `ranged`: the renderer already draws a
  // ranged weapon from the equipment object itself, so a musket shows up the
  // moment one is actually manufactured — no sprite exists for a gun nobody built.
  gunpowder: [
    { name: 'Mosquete de Mecha', type: 'weapon', category: 'ranged', rarity: 'rare', damageBonus: 30, defenseBonus: 0, hpBonus: 5, attackRange: 6.5, techRequired: 'gunpowder' },
    { name: 'Bacamarte de Pólvora', type: 'weapon', category: 'ranged', rarity: 'rare', damageBonus: 34, defenseBonus: 2, hpBonus: 10, attackRange: 5.0, techRequired: 'gunpowder' },
    { name: 'Canhão de Campo de Bronze', type: 'weapon', category: 'siege', rarity: 'rare', damageBonus: 60, defenseBonus: 0, hpBonus: 40, attackRange: 9.0, techRequired: 'gunpowder' }
  ],
  industrial: [
    { name: 'Fuzil de Retrocarga', type: 'weapon', category: 'ranged', rarity: 'legendary', damageBonus: 42, defenseBonus: 0, hpBonus: 10, attackRange: 7.5, techRequired: 'industrialization' },
    { name: 'Canhão de Campanha de Aço', type: 'weapon', category: 'siege', rarity: 'legendary', damageBonus: 78, defenseBonus: 0, hpBonus: 55, attackRange: 10.0, techRequired: 'industrialization' }
  ]
};

/**
 * What a settlement must actually manufacture to field one soldier of each tier.
 *
 * This is the whole point of item 32: discovering rifles does not arm anybody.
 * The materials come out of the city stockpile, so an army is a downstream
 * product of the economy — a realm that knows gunpowder but cannot make it
 * still fights with steel.
 */
export const EQUIPMENT_COST: Record<string, Partial<Record<string, number>>> = {
  primitive: { wood: 2 },
  iron: { iron: 3, wood: 1 },
  steel: { steel: 2, tools: 1 },
  gunpowder: { steel: 2, gunpowder: 2, tools: 1 },
  industrial: { steel: 3, gunpowder: 2, machinery: 1 }
};

/** Tiers from best to worst, so a settlement always fields the best it can afford. */
export const EQUIPMENT_TIERS_BY_RANK = ['industrial', 'gunpowder', 'steel', 'iron', 'primitive'] as const;
export type EquipmentTier = typeof EQUIPMENT_TIERS_BY_RANK[number];

/** The technology each equipment tier needs before it can even be attempted. */
export const EQUIPMENT_TECH: Record<EquipmentTier, string | null> = {
  industrial: 'industrialization',
  gunpowder: 'gunpowder',
  steel: 'metallurgy',
  iron: 'iron_working',
  primitive: null
};

export const ARMOR_TIERS: Record<string, Omit<Item, 'id'>[]> = {
  primitive: [
    { name: 'Colete de Couro', type: 'armor', rarity: 'common', damageBonus: 0, defenseBonus: 3, hpBonus: 10 }
  ],
  iron: [
    { name: 'Cota de Malha de Ferro', type: 'armor', rarity: 'uncommon', damageBonus: 0, defenseBonus: 8, hpBonus: 30 },
    { name: 'Escudo de Ferro', type: 'armor', rarity: 'rare', damageBonus: 0, defenseBonus: 12, hpBonus: 45 }
  ],
  steel: [
    { name: 'Armadura Completa de Aço', type: 'armor', rarity: 'rare', damageBonus: 2, defenseBonus: 18, hpBonus: 80 }
  ],
  // Gunpowder makes heavy plate pointless; armour gets lighter, not better.
  gunpowder: [
    { name: 'Couraça e Casaco', type: 'armor', rarity: 'rare', damageBonus: 0, defenseBonus: 14, hpBonus: 55 }
  ],
  industrial: [
    { name: 'Uniforme de Campo e Capacete', type: 'armor', rarity: 'rare', damageBonus: 0, defenseBonus: 16, hpBonus: 70 }
  ]
};

export const LEGENDARY_ITEMS: Omit<Item, 'id'>[] = [
  { name: 'Lâmina do Fogo Solar', type: 'weapon', category: 'melee', rarity: 'legendary', damageBonus: 35, defenseBonus: 8, hpBonus: 50, attackRange: 2.0 },
  { name: 'Armadura de Escamas de Dragão', type: 'armor', rarity: 'legendary', damageBonus: 5, defenseBonus: 28, hpBonus: 120 },
  { name: 'Arco Etéreo de Lumos', type: 'weapon', category: 'ranged', rarity: 'legendary', damageBonus: 38, defenseBonus: 0, hpBonus: 30, attackRange: 7.0 },
  { name: 'Escudo Cidadela Coração de Ferro', type: 'armor', rarity: 'rare', damageBonus: 0, defenseBonus: 22, hpBonus: 75 },
  { name: 'Martelo da Forja Emberkin', type: 'weapon', category: 'melee', rarity: 'rare', damageBonus: 26, defenseBonus: 6, hpBonus: 30, attackRange: 2.0 }
];
