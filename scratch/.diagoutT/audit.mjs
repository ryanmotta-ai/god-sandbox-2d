//#region src/entities/Species.ts
var SpeciesType = /* @__PURE__ */ function(SpeciesType) {
	SpeciesType["LUMINI"] = "lumini";
	SpeciesType["SYLVANII"] = "sylvanii";
	SpeciesType["STONEKIN"] = "stonekin";
	SpeciesType["EMBERKIN"] = "emberkin";
	SpeciesType["DEER"] = "deer";
	SpeciesType["WOLF"] = "wolf";
	SpeciesType["BEAR"] = "bear";
	SpeciesType["DRAGON"] = "dragon";
	SpeciesType["BOAR"] = "boar";
	SpeciesType["EAGLE"] = "eagle";
	SpeciesType["MAMMOTH"] = "mammoth";
	return SpeciesType;
}({});
var SPECIES_DEFINITIONS = {
	["lumini"]: {
		id: "lumini",
		name: "Lumini",
		isHumanoid: true,
		baseHp: 100,
		baseSpeed: 1.05,
		baseDamage: 9,
		baseDefense: 4,
		maxAge: 85,
		gestationYears: 1,
		primaryColor: "#fbbf24",
		buildingStyle: "Pedra Dourada",
		urbanGridStyle: "concentric_rings",
		urbanGridName: "Grid Radial Solar em Anéis Concêntricos",
		preferredBiomes: ["grass", "soil"],
		advantage: "☀️ +30% Pesquisa & +25% Ouro Comercial (Cura Solar)",
		disadvantage: "🛡️ -15% Ataque/Defesa Física & +20% Custo de Vida"
	},
	["sylvanii"]: {
		id: "sylvanii",
		name: "Sylvanii",
		isHumanoid: true,
		baseHp: 75,
		baseSpeed: 1.35,
		baseDamage: 11,
		baseDefense: 3,
		maxAge: 130,
		gestationYears: 2,
		primaryColor: "#34d399",
		buildingStyle: "Madeira Viva",
		urbanGridStyle: "organic_canopy",
		urbanGridName: "Grid Orgânico Fluvial em Espirais da Natureza",
		preferredBiomes: ["forest", "arcane"],
		advantage: "🏹 Arquearia Longa, +35% Velocidade & +50% Madeira",
		disadvantage: "💔 -25% Vida Máxima & Vulnerabilidade a Fogo"
	},
	["stonekin"]: {
		id: "stonekin",
		name: "Stonekin",
		isHumanoid: true,
		baseHp: 150,
		baseSpeed: .75,
		baseDamage: 15,
		baseDefense: 12,
		maxAge: 110,
		gestationYears: 1,
		primaryColor: "#94a3b8",
		buildingStyle: "Cidadela Fortificada",
		urbanGridStyle: "orthogonal_citadel",
		urbanGridName: "Grid Ortogonal de Cidadela Quadrada",
		preferredBiomes: ["mountain", "tundra"],
		advantage: "🏰 Tanques Massivos (150 HP/12 Def) & +50% Mineração",
		disadvantage: "🐢 -25% Velocidade & -20% Taxa de Natalidade"
	},
	["emberkin"]: {
		id: "emberkin",
		name: "Emberkin",
		isHumanoid: true,
		baseHp: 115,
		baseSpeed: 1.1,
		baseDamage: 14,
		baseDefense: 6,
		maxAge: 65,
		gestationYears: 1,
		primaryColor: "#f97316",
		buildingStyle: "Forja Volcânica",
		urbanGridStyle: "diagonal_chevron",
		urbanGridName: "Grid Hexagonal em Chevron Volcânico",
		preferredBiomes: [
			"savanna",
			"corrupted",
			"sand"
		],
		advantage: "🔥 Piromancy, Imunidade a Fogo/Lava & +30% Dano de Cerco",
		disadvantage: "⏳ Vida Curta (65 anos) & Penalidade Diplomática"
	},
	["deer"]: {
		id: "deer",
		name: "Veado Selvagem",
		isHumanoid: false,
		baseHp: 40,
		baseSpeed: 1.4,
		baseDamage: 0,
		baseDefense: 0,
		maxAge: 20,
		gestationYears: 1,
		primaryColor: "#d97706",
		buildingStyle: "nenhum",
		preferredBiomes: ["forest", "grass"]
	},
	["wolf"]: {
		id: "wolf",
		name: "Lobo Selvagem",
		isHumanoid: false,
		baseHp: 65,
		baseSpeed: 1.3,
		baseDamage: 12,
		baseDefense: 2,
		maxAge: 18,
		gestationYears: 1,
		primaryColor: "#64748b",
		buildingStyle: "nenhum",
		preferredBiomes: ["forest", "tundra"]
	},
	["bear"]: {
		id: "bear",
		name: "Urso Selvagem",
		isHumanoid: false,
		baseHp: 150,
		baseSpeed: .8,
		baseDamage: 22,
		baseDefense: 8,
		maxAge: 30,
		gestationYears: 1,
		primaryColor: "#78350f",
		buildingStyle: "nenhum",
		preferredBiomes: ["forest", "mountain"]
	},
	["dragon"]: {
		id: "dragon",
		name: "Dragão Ancião (Boss)",
		isHumanoid: false,
		baseHp: 1200,
		baseSpeed: 1.2,
		baseDamage: 65,
		baseDefense: 25,
		maxAge: 500,
		gestationYears: 3,
		primaryColor: "#ef4444",
		buildingStyle: "Ninho Volcânico",
		preferredBiomes: [
			"mountain",
			"savanna",
			"corrupted"
		]
	},
	["boar"]: {
		id: "boar",
		name: "Javali Selvagem",
		isHumanoid: false,
		baseHp: 75,
		baseSpeed: 1.2,
		baseDamage: 10,
		baseDefense: 3,
		maxAge: 22,
		gestationYears: 1,
		primaryColor: "#78350f",
		buildingStyle: "nenhum",
		preferredBiomes: ["forest", "savanna"]
	},
	["eagle"]: {
		id: "eagle",
		name: "Águia Imperial",
		isHumanoid: false,
		baseHp: 35,
		baseSpeed: 1.8,
		baseDamage: 8,
		baseDefense: 1,
		maxAge: 25,
		gestationYears: 1,
		primaryColor: "#fbbf24",
		buildingStyle: "nenhum",
		preferredBiomes: ["mountain", "grass"]
	},
	["mammoth"]: {
		id: "mammoth",
		name: "Mamute Ancião",
		isHumanoid: false,
		baseHp: 250,
		baseSpeed: .65,
		baseDamage: 28,
		baseDefense: 12,
		maxAge: 70,
		gestationYears: 2,
		primaryColor: "#451a03",
		buildingStyle: "nenhum",
		preferredBiomes: ["tundra", "snow"]
	}
};
//#endregion
//#region src/entities/Traits.ts
var TraitId = /* @__PURE__ */ function(TraitId) {
	TraitId["BLESSED"] = "blessed";
	TraitId["GIANT"] = "giant";
	TraitId["QUICK"] = "quick";
	TraitId["GENIUS"] = "genius";
	TraitId["VETERAN"] = "veteran";
	TraitId["REGENERATOR"] = "regenerator";
	TraitId["CURSED"] = "cursed";
	TraitId["IMMORTAL"] = "immortal";
	TraitId["FLAMMABLE"] = "flammable";
	TraitId["PACIFIST"] = "pacifist";
	TraitId["PYROMANIAC"] = "pyromaniac";
	TraitId["IRONCLAD"] = "ironclad";
	return TraitId;
}({});
var TRAIT_DEFINITIONS = {
	["blessed"]: {
		id: "blessed",
		name: "Blessed",
		description: "+25% Max HP & Divine Favor",
		color: "#fbbf24",
		inheritChance: .3,
		hpMod: 1.25
	},
	["giant"]: {
		id: "giant",
		name: "Giant",
		description: "+50% Max HP, +30% Damage, slower movement",
		color: "#f97316",
		inheritChance: .25,
		hpMod: 1.5,
		damageMod: 1.3,
		speedMod: .8
	},
	["quick"]: {
		id: "quick",
		name: "Quick",
		description: "+40% Movement Speed",
		color: "#06b6d4",
		inheritChance: .4,
		speedMod: 1.4
	},
	["genius"]: {
		id: "genius",
		name: "Genius",
		description: "High intellect, fast work output",
		color: "#8b5cf6",
		inheritChance: .2
	},
	["veteran"]: {
		id: "veteran",
		name: "Veteran",
		description: "+15 combat experience, +4 Defense",
		color: "#10b981",
		inheritChance: .1,
		defenseMod: 1.2,
		damageMod: 1.15
	},
	["regenerator"]: {
		id: "regenerator",
		name: "Regenerator",
		description: "Continuously recovers health",
		color: "#34d399",
		inheritChance: .35
	},
	["cursed"]: {
		id: "cursed",
		name: "Cursed",
		description: "-30% Max HP, prone to accidents",
		color: "#6b21a8",
		inheritChance: .2,
		hpMod: .7
	},
	["immortal"]: {
		id: "immortal",
		name: "Immortal",
		description: "Does not age or suffer old age death",
		color: "#ec4899",
		inheritChance: .05
	},
	["flammable"]: {
		id: "flammable",
		name: "Flammable",
		description: "Takes double fire damage",
		color: "#ef4444",
		inheritChance: .3
	},
	["pacifist"]: {
		id: "pacifist",
		name: "Pacifist",
		description: "Avoids combat and violence",
		color: "#38bdf8",
		inheritChance: .3
	},
	["pyromaniac"]: {
		id: "pyromaniac",
		name: "Pyromaniac",
		description: "Loves setting fires",
		color: "#dc2626",
		inheritChance: .15
	},
	["ironclad"]: {
		id: "ironclad",
		name: "Ironclad",
		description: "+50% Defense boost",
		color: "#64748b",
		inheritChance: .25,
		defenseMod: 1.5
	}
};
//#endregion
//#region src/entities/Identity.ts
/** Coin thresholds that separate the classes, before profession is considered. */
var WEALTH_ARTISAN = 60;
var WEALTH_MERCHANT = 220;
var WEALTH_DESTITUTE = 4;
/**
* A citizen's standing, derived rather than stored, so it can never drift out of
* sync with the wealth and job that produce it.
*/
function deriveSocialClass(entity) {
	if (entity.profession === "king" || entity.profession === "leader") return "ruler";
	if (entity.isGreatPerson) return "notable";
	const wealth = entity.wealth;
	if (wealth >= WEALTH_MERCHANT) return "merchant";
	if ((entity.profession === "builder" || entity.profession === "healer" || entity.profession === "scout") && wealth >= WEALTH_ARTISAN) return "artisan";
	if (wealth >= 120) return "artisan";
	if (wealth <= WEALTH_DESTITUTE && !entity.isChild && entity.profession === "none") return "destitute";
	return "commoner";
}
/** Starting personal coin for a newly created adult of a given profession. */
function startingWealthFor(profession, roll) {
	switch (profession) {
		case "king":
		case "leader": return roll(180, 400);
		case "builder":
		case "healer": return roll(25, 70);
		case "soldier":
		case "archer": return roll(12, 45);
		case "none": return roll(0, 8);
		default: return roll(6, 30);
	}
}
//#endregion
//#region src/core/Random.ts
/**
* Centralized Seeded Randomness Service using Mulberry32.
* Ensures reproducible procedural generation and deterministic simulation behavior.
*/
var RandomService = class {
	seed;
	constructor(seed = Math.floor(Math.random() * 2147483647)) {
		this.seed = seed;
	}
	getSeed() {
		return this.seed;
	}
	setSeed(seed) {
		this.seed = seed;
	}
	/** Returns float between 0 (inclusive) and 1 (exclusive) */
	next() {
		let t = this.seed += 1831565813;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
	/** Returns float between [min, max) */
	range(min, max) {
		return min + this.next() * (max - min);
	}
	/** Returns integer between [min, max] */
	rangeInt(min, max) {
		return Math.floor(this.range(min, max + 1));
	}
	/** Returns true with given probability [0, 1] */
	chance(probability) {
		return this.next() < probability;
	}
	/** Pick random item from array */
	pick(arr) {
		return arr[Math.floor(this.next() * arr.length)];
	}
};
var rng = new RandomService();
//#endregion
//#region src/entities/Entity.ts
var Entity = class {
	id;
	name;
	species;
	age;
	gender;
	x;
	y;
	targetX = null;
	targetY = null;
	prevX = 0;
	prevY = 0;
	facing = 1;
	facingAngle = 0;
	stuckTicks = 0;
	hp;
	maxHp;
	damage;
	defense;
	speed;
	level = 1;
	xp = 0;
	kills = 0;
	traits = /* @__PURE__ */ new Set();
	profession = "none";
	personality = "peaceful";
	/** AI behavioral state machine */
	aiState = "idle";
	/** Ticks until AI re-evaluates state */
	aiCooldown = 0;
	/** Combat attack cooldown (prevents rapid hits) */
	attackCooldown = 0;
	/** Visual status emote displayed above entity (e.g. 🪓, 🌾, ⛏️, ⚔️, 😴, ❤️) */
	emote = null;
	/** Ticks remaining for the current emote display */
	emoteTimer = 0;
	/** Energy / Stamina (0 = exhausted, 100 = full) */
	energy = 100;
	maxEnergy = 100;
	/** Building ID this citizen is assigned to work at. */
	workplaceId = null;
	/** Home position (city center ± offset), assigned when job is taken. */
	homeX = null;
	homeY = null;
	/** Consecutive jitter escapes without reaching target. */
	_jitterFailures = 0;
	/** Great Person Ascension & Historic Title */
	isGreatPerson = false;
	greatPersonType = null;
	title = null;
	kingdomId = null;
	cityId = null;
	/** Year this citizen was born. `age` is kept in step with it. */
	birthYear = 1;
	/** Settlement this citizen was born in — not always where they live now. */
	birthCityId = null;
	/** Kept as a name too, because the birth city may not outlive the person. */
	birthCityName = "";
	/** The house this citizen actually lives in, when one has been claimed. */
	homeBuildingId = null;
	/** Household (family economic unit) this citizen belongs to. */
	householdId = null;
	/** Personal coin. Wages come in here, purchases go out of here. */
	wealth = 0;
	fatherId = null;
	motherId = null;
	/** Current life partner. Couples raise children together. */
	partnerId = null;
	childrenIds = [];
	/** Family name. Royal children inherit the dynasty and with it a claim. */
	dynasty = "";
	/** Years before this entity can conceive again. */
	fertilityCooldown = 0;
	/** Pregnancy timer in years (0 = not pregnant, >0 = months remaining) */
	isPregnant = false;
	pregnancyTimer = 0;
	/** Pregnancy father ID */
	pregnantFatherId = null;
	/** Generations from the world's first settlers. */
	generation = 1;
	isFavorite = false;
	inventory = {
		wood: 0,
		stone: 0,
		food: 0
	};
	equipment = {};
	constructor(id, species, x, y, name) {
		this.id = id;
		this.species = species;
		this.x = x;
		this.y = y;
		const config = SPECIES_DEFINITIONS[species];
		this.name = name ?? this.generateName(species);
		this.gender = rng.chance(.5) ? "male" : "female";
		this.age = rng.rangeInt(16, 30);
		this.maxHp = config.baseHp;
		this.damage = config.baseDamage;
		this.defense = config.baseDefense;
		this.speed = config.baseSpeed;
		this.personality = rng.pick([
			"ambitious",
			"diplomatic",
			"aggressive",
			"paranoid",
			"peaceful",
			"greedy"
		]);
		this.wealth = startingWealthFor(this.profession, (min, max) => rng.rangeInt(min, max));
		if (rng.chance(.35)) {
			const traitList = Object.keys(TRAIT_DEFINITIONS);
			this.addTrait(rng.pick(traitList));
		}
		this.recalculateStats();
		this.hp = this.maxHp;
	}
	showEmote(emoji, durationTicks = 25) {
		this.emote = emoji;
		this.emoteTimer = durationTicks;
	}
	addTrait(traitId) {
		this.traits.add(traitId);
		this.recalculateStats();
	}
	removeTrait(traitId) {
		this.traits.delete(traitId);
		this.recalculateStats();
	}
	recalculateStats() {
		const config = SPECIES_DEFINITIONS[this.species];
		let hpMultiplier = 1;
		let speedMultiplier = 1;
		let damageMultiplier = 1;
		let defenseMultiplier = 1;
		for (const traitId of this.traits) {
			const def = TRAIT_DEFINITIONS[traitId];
			if (def) {
				if (def.hpMod) hpMultiplier *= def.hpMod;
				if (def.speedMod) speedMultiplier *= def.speedMod;
				if (def.damageMod) damageMultiplier *= def.damageMod;
				if (def.defenseMod) defenseMultiplier *= def.defenseMod;
			}
		}
		const levelBonus = 1 + (this.level - 1) * .1;
		const stage = this.lifeStageMultiplier;
		const eqWeaponDmg = this.equipment.weapon?.damageBonus || 0;
		const eqArmorDef = this.equipment.armor?.defenseBonus || 0;
		const eqHpBonus = (this.equipment.weapon?.hpBonus || 0) + (this.equipment.armor?.hpBonus || 0);
		this.maxHp = Math.round(config.baseHp * hpMultiplier * levelBonus * stage.hp + eqHpBonus);
		this.speed = config.baseSpeed * speedMultiplier * stage.speed;
		this.damage = Math.round(config.baseDamage * damageMultiplier * levelBonus * stage.damage + eqWeaponDmg);
		this.defense = Math.round(config.baseDefense * defenseMultiplier * stage.hp + eqArmorDef);
		if (this.hp > this.maxHp) this.hp = this.maxHp;
	}
	gainXp(amount) {
		this.xp += amount;
		if (this.xp >= this.level * 50) {
			this.xp -= this.level * 50;
			this.level++;
			this.recalculateStats();
			this.hp = this.maxHp;
			return true;
		}
		return false;
	}
	/** Adults of breeding age (18+). Children and the elderly do not pair off. */
	isFertile(maxAge) {
		return !this.isPregnant && this.age >= 18 && this.age <= maxAge * .7 && this.fertilityCooldown <= 0 && this.hp > this.maxHp * .5;
	}
	/** Stage multipliers for stats — babies are fragile, adolescents nearly full-grown. */
	get lifeStageMultiplier() {
		switch (this.lifeStage) {
			case "infant": return {
				hp: .15,
				damage: .1,
				speed: .3
			};
			case "child": return {
				hp: .4,
				damage: .3,
				speed: .5
			};
			case "adolescent": return {
				hp: .7,
				damage: .6,
				speed: .8
			};
			case "adult": return {
				hp: 1,
				damage: 1,
				speed: 1
			};
			case "elder": return {
				hp: .85,
				damage: .9,
				speed: .7
			};
		}
	}
	get lifeStage() {
		const maxAge = SPECIES_DEFINITIONS[this.species]?.maxAge ?? 80;
		if (this.age <= 2) return "infant";
		if (this.age <= 12) return "child";
		if (this.age <= 17) return "adolescent";
		if (this.age > maxAge * .75) return "elder";
		return "adult";
	}
	get lifeStageLabel() {
		switch (this.lifeStage) {
			case "infant": return "Bebê 👶";
			case "child": return "Criança 🎈";
			case "adolescent": return "Adolescente 📖";
			case "adult": return "Adulto 🧑";
			case "elder": return "Idoso 👴";
		}
	}
	get isChild() {
		return this.age < 18;
	}
	/** Full name including the family line, once dynasties exist. */
	get fullName() {
		return this.dynasty ? `${this.name} ${this.dynasty}` : this.name;
	}
	/** Standing in the social order. Derived so it tracks wealth and job exactly. */
	get socialClass() {
		return deriveSocialClass(this);
	}
	/** True once this citizen has claimed a real house rather than a spot of ground. */
	get hasHome() {
		return this.homeBuildingId !== null;
	}
	generateName(species) {
		const prefixes = {
			[SpeciesType.LUMINI]: [
				"Sol",
				"Lux",
				"Aur",
				"Hel",
				"Aet",
				"Val",
				"Ori"
			],
			[SpeciesType.SYLVANII]: [
				"Sil",
				"Leaf",
				"Thorn",
				"Fae",
				"Eld",
				"Vir",
				"Ver"
			],
			[SpeciesType.STONEKIN]: [
				"Gor",
				"Tor",
				"Krag",
				"Bram",
				"Durn",
				"Brak",
				"Iron"
			],
			[SpeciesType.EMBERKIN]: [
				"Ash",
				"Pyr",
				"Ign",
				"Vul",
				"Cin",
				"Kael",
				"Drak"
			],
			[SpeciesType.DEER]: ["Bambi", "Stag"],
			[SpeciesType.WOLF]: ["Fang", "Shadow"],
			[SpeciesType.BEAR]: ["Grizz", "Baloo"],
			[SpeciesType.DRAGON]: ["Ignis", "Pyroth"],
			[SpeciesType.BOAR]: ["Gore", "Tusk"],
			[SpeciesType.EAGLE]: ["Aquila", "Swoop"],
			[SpeciesType.MAMMOTH]: ["Tusk", "Frost"]
		};
		return rng.pick(prefixes[species] || ["An"]) + rng.pick([
			"is",
			"or",
			"an",
			"us",
			"ia",
			"en",
			"os",
			"th",
			"ar"
		]);
	}
};
//#endregion
//#region src/world/Biomes.ts
var TerrainType = /* @__PURE__ */ function(TerrainType) {
	TerrainType["DEEP_OCEAN"] = "deep_ocean";
	TerrainType["SHALLOW_WATER"] = "shallow_water";
	TerrainType["SAND"] = "sand";
	TerrainType["SOIL"] = "soil";
	TerrainType["GRASS"] = "grass";
	TerrainType["FOREST"] = "forest";
	TerrainType["SAVANNA"] = "savanna";
	TerrainType["SWAMP"] = "swamp";
	TerrainType["TUNDRA"] = "tundra";
	TerrainType["SNOW"] = "snow";
	TerrainType["MOUNTAIN"] = "mountain";
	TerrainType["LAVA"] = "lava";
	TerrainType["ARCANE"] = "arcane";
	TerrainType["CORRUPTED"] = "corrupted";
	return TerrainType;
}({});
var TERRAINS = {
	["deep_ocean"]: {
		id: "deep_ocean",
		name: "Deep Ocean",
		color: "#0f172a",
		isWater: true,
		isWalkable: false,
		flammability: 0,
		fertility: 0,
		moveCost: 99
	},
	["shallow_water"]: {
		id: "shallow_water",
		name: "Água Rasa",
		color: "#1e3a8a",
		isWater: true,
		isWalkable: false,
		flammability: 0,
		fertility: .1,
		moveCost: 99
	},
	["sand"]: {
		id: "sand",
		name: "Sand",
		color: "#fde047",
		isWater: false,
		isWalkable: true,
		flammability: 0,
		fertility: .2,
		moveCost: 1.3
	},
	["soil"]: {
		id: "soil",
		name: "Soil",
		color: "#854d0e",
		isWater: false,
		isWalkable: true,
		flammability: 0,
		fertility: .8,
		moveCost: 1
	},
	["grass"]: {
		id: "grass",
		name: "Grassland",
		color: "#15803d",
		isWater: false,
		isWalkable: true,
		flammability: .35,
		fertility: 1,
		moveCost: 1
	},
	["forest"]: {
		id: "forest",
		name: "Dense Forest",
		color: "#166534",
		isWater: false,
		isWalkable: true,
		flammability: .65,
		fertility: .9,
		moveCost: 1.4
	},
	["savanna"]: {
		id: "savanna",
		name: "Savanna",
		color: "#ca8a04",
		isWater: false,
		isWalkable: true,
		flammability: .5,
		fertility: .5,
		moveCost: 1.1
	},
	["swamp"]: {
		id: "swamp",
		name: "Swamp",
		color: "#3f6212",
		isWater: false,
		isWalkable: true,
		flammability: .2,
		fertility: .6,
		moveCost: 2
	},
	["tundra"]: {
		id: "tundra",
		name: "Tundra",
		color: "#0e7490",
		isWater: false,
		isWalkable: true,
		flammability: .2,
		fertility: .3,
		moveCost: 1.2
	},
	["snow"]: {
		id: "snow",
		name: "Snow",
		color: "#e2e8f0",
		isWater: false,
		isWalkable: true,
		flammability: 0,
		fertility: .1,
		moveCost: 1.8
	},
	["mountain"]: {
		id: "mountain",
		name: "Mountain",
		color: "#475569",
		isWater: false,
		isWalkable: false,
		flammability: 0,
		fertility: .1,
		moveCost: 99
	},
	["lava"]: {
		id: "lava",
		name: "Lava",
		color: "#ef4444",
		isWater: false,
		isWalkable: false,
		flammability: 0,
		fertility: 0,
		moveCost: 99
	},
	["arcane"]: {
		id: "arcane",
		name: "Arcane Grove",
		color: "#a855f7",
		isWater: false,
		isWalkable: true,
		flammability: .3,
		fertility: 1.2,
		moveCost: .9
	},
	["corrupted"]: {
		id: "corrupted",
		name: "Corrupted Wastes",
		color: "#581c87",
		isWater: false,
		isWalkable: true,
		flammability: .7,
		fertility: .1,
		moveCost: 1.5
	}
};
//#endregion
//#region src/core/SpatialHash.ts
var SpatialHash = class {
	cellSize;
	grid = /* @__PURE__ */ new Map();
	constructor(cellSize = 8) {
		this.cellSize = cellSize;
	}
	getKey(x, y) {
		return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
	}
	clear() {
		this.grid.clear();
	}
	insert(item) {
		const key = this.getKey(item.x, item.y);
		if (!this.grid.has(key)) this.grid.set(key, /* @__PURE__ */ new Set());
		this.grid.get(key).add(item);
	}
	remove(item) {
		const key = this.getKey(item.x, item.y);
		if (this.grid.has(key)) this.grid.get(key).delete(item);
	}
	update(item, oldX, oldY) {
		const oldKey = this.getKey(oldX, oldY);
		if (oldKey !== this.getKey(item.x, item.y)) {
			if (this.grid.has(oldKey)) this.grid.get(oldKey).delete(item);
			this.insert(item);
		}
	}
	queryRadius(x, y, radius) {
		const result = [];
		const minCx = Math.floor((x - radius) / this.cellSize);
		const maxCx = Math.floor((x + radius) / this.cellSize);
		const minCy = Math.floor((y - radius) / this.cellSize);
		const maxCy = Math.floor((y + radius) / this.cellSize);
		const rSq = radius * radius;
		for (let cx = minCx; cx <= maxCx; cx++) for (let cy = minCy; cy <= maxCy; cy++) {
			const key = `${cx},${cy}`;
			const items = this.grid.get(key);
			if (items) for (const item of items) {
				const dx = item.x - x;
				const dy = item.y - y;
				if (dx * dx + dy * dy <= rSq) result.push(item);
			}
		}
		return result;
	}
};
//#endregion
//#region src/civ/Building.ts
var BUILDINGS = {
	town_center: {
		type: "town_center",
		name: "Town Center",
		icon: "🏛️",
		category: "core",
		maxHp: 500,
		cost: {},
		housing: 5,
		storage: 200,
		produces: { food: 2 },
		unique: true,
		description: "The heart of the settlement. Where the first fire was lit."
	},
	house: {
		type: "house",
		name: "House",
		icon: "🏠",
		category: "core",
		maxHp: 150,
		cost: {
			wood: 20,
			stone: 5
		},
		housing: 4,
		description: "Shelter. Every citizen needs one or the settlement stops growing."
	},
	farm: {
		type: "farm",
		name: "Farm",
		icon: "🌾",
		category: "food",
		maxHp: 100,
		cost: { wood: 15 },
		produces: { food: 10 },
		jobs: 2,
		resourceTargets: [
			"food",
			"cotton",
			"spices"
		],
		resourceMode: "preferred",
		extractionRate: 3,
		description: "Tilled fields. Food first; fertile regions may also specialise in cotton or spices."
	},
	granary: {
		type: "granary",
		name: "Granary",
		icon: "🏚️",
		category: "food",
		maxHp: 180,
		cost: {
			wood: 30,
			stone: 15
		},
		storage: 250,
		produces: { food: 3 },
		unique: true,
		description: "Stored surplus. A settlement with a granary survives a bad winter."
	},
	pasture: {
		type: "pasture",
		name: "Pasture",
		icon: "🐄",
		category: "food",
		maxHp: 120,
		cost: { wood: 20 },
		produces: { food: 6 },
		jobs: 2,
		resourceTargets: ["horses", "furs"],
		resourceMode: "preferred",
		extractionRate: 2.5,
		description: "Herds, corrals and managed hunting grounds. Horse and fur regions become real economic specialities."
	},
	lumber_camp: {
		type: "lumber_camp",
		name: "Lumber Camp",
		icon: "🪵",
		category: "extraction",
		maxHp: 120,
		cost: { wood: 10 },
		produces: { wood: 8 },
		jobs: 2,
		resourceTargets: ["wood", "rubber"],
		resourceMode: "required",
		extractionRate: 8,
		description: "Organised forestry. Timber forests and tropical rubber stands become productive sites."
	},
	quarry: {
		type: "quarry",
		name: "Quarry",
		icon: "🪨",
		category: "extraction",
		maxHp: 200,
		cost: { wood: 25 },
		produces: { stone: 7 },
		jobs: 3,
		resourceTargets: ["stone", "clay"],
		resourceMode: "required",
		extractionRate: 7,
		description: "Stone and clay workings. Durable architecture begins with a real deposit under the site."
	},
	mine: {
		type: "mine",
		name: "Mine",
		icon: "⛏️",
		category: "extraction",
		maxHp: 220,
		cost: {
			wood: 30,
			stone: 20
		},
		produces: { iron: 6 },
		jobs: 4,
		resourceTargets: [
			"copper",
			"tin",
			"iron",
			"coal",
			"salt",
			"gold",
			"gems",
			"saltpeter",
			"uranium"
		],
		resourceMode: "required",
		extractionRate: 6,
		description: "A shaft sunk into a mineral vein. The mine extracts whatever geology is really underneath it."
	},
	workshop: {
		type: "workshop",
		name: "Workshop",
		icon: "🪡",
		category: "craft",
		maxHp: 160,
		cost: {
			wood: 30,
			stone: 10
		},
		produces: { cloth: 4 },
		jobs: 3,
		craftCapacity: 3,
		description: "Artisans and weavers. Recipes in Goods.ts decide what this workshop can actually manufacture."
	},
	smithy: {
		type: "smithy",
		name: "Smithy",
		icon: "⚒️",
		category: "craft",
		maxHp: 200,
		cost: {
			wood: 30,
			stone: 25
		},
		produces: { tools: 4 },
		jobs: 4,
		craftCapacity: 2.6,
		description: "Smelters and smiths. Bronze, steel, tools and gunpowder all compete for the same skilled capacity."
	},
	factory: {
		type: "factory",
		name: "Factory",
		icon: "🏭",
		category: "craft",
		maxHp: 400,
		cost: {
			stone: 80,
			steel: 45,
			tools: 20
		},
		produces: { machinery: 12 },
		jobs: 12,
		craftCapacity: 5.5,
		description: "Mass production. Its output is recipe-driven; without steel, rubber and fuel the machines fall silent."
	},
	oil_well: {
		type: "oil_well",
		name: "Oil Well",
		icon: "🛢️",
		category: "extraction",
		maxHp: 260,
		cost: {
			steel: 35,
			tools: 12
		},
		produces: { oil: 12 },
		jobs: 5,
		resourceTargets: ["oil"],
		resourceMode: "required",
		extractionRate: 12,
		description: "A derrick sunk into a real petroleum basin. No basin, no well; no oil, no industrial logistics."
	},
	refinery: {
		type: "refinery",
		name: "Refinery",
		icon: "⛽",
		category: "craft",
		maxHp: 320,
		cost: {
			steel: 35,
			stone: 70,
			tools: 16
		},
		produces: { fuel: 9 },
		jobs: 7,
		craftCapacity: 4.5,
		description: "Cracks crude oil into fuel using the recipe system. Modern fleets now depend on actual refining capacity."
	},
	library: {
		type: "library",
		name: "Library",
		icon: "📚",
		category: "knowledge",
		maxHp: 180,
		cost: {
			wood: 40,
			stone: 30
		},
		research: 6,
		jobs: 2,
		unique: true,
		description: "Accumulated writing. Knowledge that outlives the people who found it."
	},
	academy: {
		type: "academy",
		name: "Academy",
		icon: "🎓",
		category: "knowledge",
		maxHp: 260,
		cost: {
			stone: 70,
			wood: 40,
			gold: 20
		},
		research: 16,
		consumes: { food: 6 },
		jobs: 5,
		unique: true,
		description: "Scholars paid to think. Expensive, and the only way to reach the modern age."
	},
	temple: {
		type: "temple",
		name: "Temple",
		icon: "⛩️",
		category: "knowledge",
		maxHp: 300,
		cost: {
			stone: 50,
			wood: 25
		},
		research: 3,
		jobs: 2,
		unique: true,
		description: "A place to petition whoever is holding the brush."
	},
	market: {
		type: "market",
		name: "Market",
		icon: "🏪",
		category: "commerce",
		maxHp: 200,
		cost: {
			wood: 40,
			stone: 20
		},
		produces: { gold: 5 },
		jobs: 3,
		unique: true,
		description: "Where surplus becomes coin, and coin becomes a reason to build roads."
	},
	harbor: {
		type: "harbor",
		name: "Harbor",
		icon: "⚓",
		category: "commerce",
		maxHp: 250,
		cost: {
			wood: 60,
			stone: 30
		},
		produces: {
			food: 5,
			gold: 3
		},
		jobs: 4,
		requiresCoast: true,
		unique: true,
		description: "A coastal harbor for fishing and early maritime commerce. It is now required before sea trade can begin."
	},
	bank: {
		type: "bank",
		name: "Bank",
		icon: "🏦",
		category: "commerce",
		maxHp: 280,
		cost: {
			stone: 80,
			gold: 40
		},
		produces: { gold: 16 },
		jobs: 4,
		unique: true,
		description: "Deposits, loans and interest. Wealth begins to compound."
	},
	stock_exchange: {
		type: "stock_exchange",
		name: "Stock Exchange",
		icon: "📈",
		category: "commerce",
		maxHp: 320,
		cost: {
			stone: 120,
			gold: 100,
			tools: 20
		},
		produces: { gold: 40 },
		jobs: 6,
		unique: true,
		description: "Ownership traded as paper. Growth accelerates, and so do the crashes."
	},
	collective: {
		type: "collective",
		name: "Collective",
		icon: "☭",
		category: "commerce",
		maxHp: 320,
		cost: {
			stone: 90,
			iron: 50,
			tools: 15
		},
		produces: { food: 20 },
		jobs: 10,
		unique: true,
		description: "Food and basic output pooled by plan. Crafted tools still require real smithing inputs and industrial capacity."
	},
	aqueduct: {
		type: "aqueduct",
		name: "Aqueduct",
		icon: "🌊",
		category: "infrastructure",
		maxHp: 350,
		cost: {
			stone: 90,
			tools: 8
		},
		housing: 12,
		produces: { food: 4 },
		unique: true,
		description: "Fresh water at scale. Cities can finally grow past their wells."
	},
	wall: {
		type: "wall",
		name: "Wall",
		icon: "🧱",
		category: "infrastructure",
		maxHp: 400,
		cost: { stone: 40 },
		defense: 1.25,
		description: "Dressed stone between your people and everyone else’s ambitions."
	},
	port: {
		type: "port",
		name: "Port",
		icon: "🚢",
		category: "infrastructure",
		maxHp: 250,
		cost: {
			wood: 55,
			stone: 90,
			tools: 12
		},
		produces: { gold: 5 },
		jobs: 6,
		requiresCoast: true,
		unique: true,
		description: "Deep-water docks, cranes and warehouses. Advanced steam and industrial shipping requires a real port."
	},
	barracks: {
		type: "barracks",
		name: "Barracks",
		icon: "🏯",
		category: "power",
		maxHp: 300,
		cost: {
			wood: 40,
			stone: 30
		},
		consumes: { food: 5 },
		defense: 1.4,
		jobs: 4,
		description: "Professional soldiers, fed year-round whether or not there is a war."
	},
	keep: {
		type: "keep",
		name: "Keep",
		icon: "🏰",
		category: "power",
		maxHp: 600,
		cost: {
			stone: 100,
			wood: 40,
			tools: 6
		},
		defense: 1.8,
		housing: 6,
		consumes: { food: 6 },
		unique: true,
		description: "A lord’s fortified seat. The physical form of feudal authority."
	},
	palace: {
		type: "palace",
		name: "Palace",
		icon: "🏛️",
		category: "power",
		maxHp: 700,
		cost: {
			stone: 150,
			gold: 80,
			tools: 12
		},
		defense: 1.5,
		housing: 10,
		produces: { gold: 10 },
		consumes: { food: 10 },
		research: 4,
		unique: true,
		description: "The seat of a crown that rules rather than merely reigns."
	},
	monument: {
		type: "monument",
		name: "Statue of the Founder",
		icon: "🗿",
		category: "infrastructure",
		maxHp: 1e3,
		cost: {
			stone: 200,
			gold: 100
		},
		housing: 10,
		produces: { gold: 15 },
		unique: true,
		description: "A colossal monument financed by a Great Builder. Grants +30% Kingdom Stability."
	},
	great_library: {
		type: "great_library",
		name: "Great Library of Wisdom",
		icon: "📚",
		category: "knowledge",
		maxHp: 900,
		cost: {
			stone: 150,
			wood: 150,
			gold: 80
		},
		research: 50,
		unique: true,
		description: "A world wonder storing centuries of scientific and historical knowledge."
	},
	grand_aqueduct: {
		type: "grand_aqueduct",
		name: "Grand Aqueduct of Nations",
		icon: "🌊",
		category: "infrastructure",
		maxHp: 850,
		cost: {
			stone: 250,
			tools: 20
		},
		housing: 30,
		produces: { food: 20 },
		unique: true,
		description: "A engineering wonder supplying endless fresh water to the city."
	},
	colosseum: {
		type: "colosseum",
		name: "Grand Colosseum of Legends",
		icon: "🏛️",
		category: "power",
		maxHp: 1200,
		cost: {
			stone: 300,
			gold: 150
		},
		defense: 2,
		housing: 15,
		unique: true,
		description: "A legendary arena inspiring military morale and quelling civil unrest."
	}
};
var ALL_BUILDING_TYPES = Object.keys(BUILDINGS);
/** Buildings available with no technology at all — every settlement starts with these. */
var BASE_BUILDINGS = ["town_center", "house"];
var Building = class {
	id;
	type;
	x;
	y;
	level;
	hp;
	maxHp;
	cityId;
	/** Set for mines and camps: what the tile underneath actually yields. */
	extractedGood = null;
	/** 0..1 — how well staffed the building is. Scales its output. */
	staffing = 1;
	/** Entity IDs assigned to jobs in this building. Capped by definition.jobs. */
	assignedWorkerIds = /* @__PURE__ */ new Set();
	/** Entity IDs that live here. Capped by definition.housing. */
	residentIds = /* @__PURE__ */ new Set();
	/** People this building can still take in, accounting for its level. */
	freeHousing() {
		const capacity = (BUILDINGS[this.type]?.housing ?? 0) * this.level;
		return Math.max(0, capacity - this.residentIds.size);
	}
	constructor(id, type, x, y, cityId) {
		this.id = id;
		this.type = type;
		this.x = x;
		this.y = y;
		this.cityId = cityId;
		this.level = 1;
		this.maxHp = BUILDINGS[type]?.maxHp ?? 150;
		this.hp = this.maxHp;
	}
	get definition() {
		return BUILDINGS[this.type];
	}
	/** Output scales with level and staffing. */
	outputMultiplier() {
		return (1 + (this.level - 1) * .55) * this.staffing;
	}
	upgrade() {
		if (this.level < 3) {
			this.level++;
			this.maxHp = Math.round(this.maxHp * 1.5);
			this.hp = this.maxHp;
		}
	}
	/** Cost to raise this building one level. */
	upgradeCost() {
		const base = this.definition.cost;
		const scale = 1.6 * this.level;
		const cost = {};
		for (const [good, amount] of Object.entries(base)) cost[good] = Math.ceil(amount * scale);
		return cost;
	}
};
//#endregion
//#region src/civ/Goods.ts
var GOODS = {
	food: {
		id: "food",
		name: "Alimento",
		icon: "🌾",
		color: "#fbbf24",
		kind: "raw",
		tier: "common",
		basePrice: 2,
		description: "Grãos, caça e frutos. Todo cidadão come todo ano, ou passa fome."
	},
	wood: {
		id: "wood",
		name: "Madeira",
		icon: "🌲",
		color: "#22c55e",
		kind: "raw",
		tier: "common",
		basePrice: 3,
		description: "Derrubada das florestas. A base de toda construção primitiva."
	},
	stone: {
		id: "stone",
		name: "Pedra",
		icon: "🪨",
		color: "#94a3b8",
		kind: "raw",
		tier: "common",
		basePrice: 4,
		description: "Rocha extraída. Necessária para muralhas, estradas e arquitetura duradoura."
	},
	clay: {
		id: "clay",
		name: "Argila",
		icon: "🧱",
		color: "#b45309",
		kind: "raw",
		tier: "common",
		basePrice: 3,
		description: "Barro de várzea. Tijolo, cerâmica e a primeira indústria de qualquer povo."
	},
	copper: {
		id: "copper",
		name: "Cobre",
		icon: "🟠",
		color: "#ea580c",
		kind: "raw",
		tier: "regional",
		basePrice: 11,
		requiresTech: "mining",
		description: "Metal maleável das montanhas. Sozinho é fraco; ligado ao estanho, muda a história."
	},
	tin: {
		id: "tin",
		name: "Estanho",
		icon: "⚪",
		color: "#cbd5e1",
		kind: "raw",
		tier: "strategic",
		basePrice: 26,
		requiresTech: "mining",
		strategic: true,
		description: "Raríssimo e disperso. Sem ele não existe bronze — a razão das primeiras rotas de longa distância."
	},
	iron: {
		id: "iron",
		name: "Ferro",
		icon: "⛏️",
		color: "#94a3b8",
		kind: "raw",
		tier: "regional",
		basePrice: 9,
		requiresTech: "mining",
		description: "Minério comum nas montanhas. Fundido em aço, arma exércitos inteiros."
	},
	coal: {
		id: "coal",
		name: "Carvão",
		icon: "⬛",
		color: "#475569",
		kind: "raw",
		tier: "regional",
		basePrice: 8,
		requiresTech: "mining",
		strategic: true,
		description: "Inútil até alguém inventar uma fornalha que o exija. Depois disso, indispensável."
	},
	salt: {
		id: "salt",
		name: "Sal",
		icon: "🧂",
		color: "#f1f5f9",
		kind: "raw",
		tier: "regional",
		basePrice: 13,
		description: "Conserva alimento e mantém exércitos em campanha. Valeu mais que ouro por milênios."
	},
	gold: {
		id: "gold",
		name: "Ouro",
		icon: "🪙",
		color: "#f59e0b",
		kind: "raw",
		tier: "regional",
		basePrice: 28,
		description: "Raro, denso e desejado por todos. A semente de qualquer moeda."
	},
	gems: {
		id: "gems",
		name: "Gemas",
		icon: "💎",
		color: "#a855f7",
		kind: "raw",
		tier: "regional",
		basePrice: 44,
		requiresTech: "mining",
		description: "Bem de luxo. Nobres exigem, camponeses ressentem."
	},
	horses: {
		id: "horses",
		name: "Cavalos",
		icon: "🐎",
		color: "#a16207",
		kind: "raw",
		tier: "regional",
		basePrice: 18,
		requiresTech: "animal_husbandry",
		description: "Criados nas planícies abertas. Transformam um exército de pés em um exército de rodas."
	},
	cotton: {
		id: "cotton",
		name: "Algodão",
		icon: "🤍",
		color: "#e2e8f0",
		kind: "raw",
		tier: "regional",
		basePrice: 7,
		requiresTech: "agriculture",
		description: "Fibra das terras quentes. Matéria-prima do primeiro grande comércio de manufaturas."
	},
	spices: {
		id: "spices",
		name: "Especiarias",
		icon: "🌶️",
		color: "#dc2626",
		kind: "raw",
		tier: "regional",
		basePrice: 38,
		description: "Só crescem no calor úmido. Impérios inteiros foram construídos sobre pimenta."
	},
	furs: {
		id: "furs",
		name: "Peles",
		icon: "🦫",
		color: "#78350f",
		kind: "raw",
		tier: "regional",
		basePrice: 16,
		description: "Caçadas no frio extremo. A única exportação valiosa das terras congeladas."
	},
	oil: {
		id: "oil",
		name: "Petróleo",
		icon: "🛢️",
		color: "#1c1917",
		kind: "raw",
		tier: "strategic",
		basePrice: 55,
		requiresTech: "industrialization",
		strategic: true,
		description: "Poças negras sob o deserto e o pântano. Inútil por toda a história — e depois, o mundo inteiro depende dela."
	},
	saltpeter: {
		id: "saltpeter",
		name: "Salitre",
		icon: "💠",
		color: "#e0f2fe",
		kind: "raw",
		tier: "strategic",
		basePrice: 34,
		requiresTech: "mining",
		strategic: true,
		description: "Cristais de cavernas áridas. Sem salitre não há pólvora, e sem pólvora as muralhas continuam de pé."
	},
	rubber: {
		id: "rubber",
		name: "Borracha",
		icon: "🟤",
		color: "#292524",
		kind: "raw",
		tier: "strategic",
		basePrice: 42,
		strategic: true,
		description: "Seiva de árvores tropicais. Vedações, pneus e correias — a indústria para sem ela."
	},
	uranium: {
		id: "uranium",
		name: "Urânio",
		icon: "☢️",
		color: "#84cc16",
		kind: "raw",
		tier: "strategic",
		basePrice: 120,
		requiresTech: "electricity",
		strategic: true,
		description: "Rocha pesada e luminosa das montanhas profundas. Quem a domina não precisa negociar."
	},
	bronze: {
		id: "bronze",
		name: "Bronze",
		icon: "🟫",
		color: "#b45309",
		kind: "crafted",
		tier: "regional",
		basePrice: 30,
		recipe: {
			copper: 3,
			tin: 1
		},
		requiresTech: "bronze_working",
		producedBy: "smithy",
		description: "Cobre ligado a estanho. O primeiro metal que sobrevive a quem o forjou."
	},
	steel: {
		id: "steel",
		name: "Aço",
		icon: "⚙️",
		color: "#64748b",
		kind: "crafted",
		tier: "regional",
		basePrice: 40,
		recipe: {
			iron: 3,
			coal: 2
		},
		requiresTech: "metallurgy",
		producedBy: "smithy",
		description: "Ferro purificado a carvão. Trilhos, canhões e arranha-céus saem daqui."
	},
	tools: {
		id: "tools",
		name: "Ferramentas",
		icon: "🔨",
		color: "#f97316",
		kind: "crafted",
		tier: "common",
		basePrice: 24,
		recipe: {
			bronze: 1,
			wood: 1
		},
		requiresTech: "bronze_working",
		producedBy: "smithy",
		description: "Multiplica quanto cada trabalhador arranca da terra."
	},
	cloth: {
		id: "cloth",
		name: "Tecido",
		icon: "🧵",
		color: "#38bdf8",
		kind: "crafted",
		tier: "common",
		basePrice: 15,
		recipe: { cotton: 2 },
		requiresTech: "pottery",
		producedBy: "workshop",
		description: "Vestuário e velas de navio. O primeiro bem feito só para ser vendido."
	},
	fuel: {
		id: "fuel",
		name: "Combustível",
		icon: "⛽",
		color: "#f59e0b",
		kind: "crafted",
		tier: "strategic",
		basePrice: 70,
		recipe: { oil: 2 },
		requiresTech: "industrialization",
		producedBy: "refinery",
		strategic: true,
		description: "Petróleo refinado. Move fábricas, frotas e exércitos inteiros."
	},
	gunpowder: {
		id: "gunpowder",
		name: "Pólvora",
		icon: "💥",
		color: "#ef4444",
		kind: "crafted",
		tier: "strategic",
		basePrice: 58,
		recipe: {
			saltpeter: 2,
			coal: 1
		},
		requiresTech: "gunpowder",
		producedBy: "smithy",
		strategic: true,
		description: "O fim da era das muralhas e dos cavaleiros."
	},
	machinery: {
		id: "machinery",
		name: "Maquinário",
		icon: "🏗️",
		color: "#0ea5e9",
		kind: "crafted",
		tier: "strategic",
		basePrice: 95,
		recipe: {
			steel: 3,
			rubber: 1,
			fuel: 1
		},
		requiresTech: "industrialization",
		producedBy: "factory",
		strategic: true,
		description: "Aço, borracha e combustível numa só peça. Uma fábrica delas supera uma província de camponeses."
	}
};
/**
* Balanced recipes. `Goods.ts` is the single source of truth for industrial
* conversion; buildings only provide capacity and jobs.
*/
var PRODUCTION_RECIPES = {
	bronze: [{
		inputs: {
			copper: 3,
			tin: 1
		},
		output: 2.4,
		requiresTech: "bronze_working",
		label: "bronze alloying"
	}],
	steel: [{
		inputs: {
			iron: 3,
			coal: 2
		},
		output: 1.5,
		requiresTech: "metallurgy",
		label: "blast-furnace steel"
	}],
	tools: [
		{
			inputs: {
				bronze: 1,
				wood: 1
			},
			output: 1.8,
			requiresTech: "bronze_working",
			label: "bronze tools"
		},
		{
			inputs: {
				iron: 2,
				wood: 1
			},
			output: 1.25,
			requiresTech: "iron_working",
			label: "iron tools"
		},
		{
			inputs: {
				steel: 1,
				wood: 1
			},
			output: 2.3,
			requiresTech: "metallurgy",
			label: "steel tools"
		}
	],
	cloth: [{
		inputs: { cotton: 2 },
		output: 1.4,
		requiresTech: "pottery",
		label: "woven cloth"
	}],
	fuel: [{
		inputs: { oil: 2 },
		output: 1.8,
		requiresTech: "industrialization",
		label: "refined fuel"
	}],
	gunpowder: [{
		inputs: {
			saltpeter: 2,
			coal: 1
		},
		output: 1.6,
		requiresTech: "gunpowder",
		label: "black powder"
	}],
	machinery: [{
		inputs: {
			steel: 3,
			rubber: 1,
			fuel: 1
		},
		output: 3,
		requiresTech: "industrialization",
		label: "industrial machinery"
	}]
};
function productionRecipesFor(good) {
	const balanced = PRODUCTION_RECIPES[good];
	if (balanced?.length) return balanced;
	const legacy = GOODS[good]?.recipe;
	return legacy ? [{
		inputs: legacy,
		output: 1,
		requiresTech: GOODS[good].requiresTech
	}] : [];
}
var ALL_GOODS = Object.keys(GOODS);
ALL_GOODS.filter((id) => GOODS[id].kind === "raw");
var CRAFTED_GOODS = ALL_GOODS.filter((id) => GOODS[id].kind === "crafted");
ALL_GOODS.filter((id) => GOODS[id].strategic);
/**
* What a miner digs for. Timber and food are gathered at the surface by other
* professions, so they are excluded here.
*/
var MINEABLE_GOODS = [
	"copper",
	"tin",
	"iron",
	"coal",
	"salt",
	"gold",
	"gems",
	"saltpeter",
	"uranium"
];
/**
* A container of goods with a soft capacity.
* Cities, kingdoms and caravans all use one.
*/
var Stockpile = class Stockpile {
	amounts = /* @__PURE__ */ new Map();
	capacity;
	constructor(capacity = 500, initial) {
		this.capacity = capacity;
		if (initial) for (const [good, amount] of Object.entries(initial)) this.amounts.set(good, amount);
	}
	get(good) {
		return this.amounts.get(good) ?? 0;
	}
	has(good, amount) {
		return this.get(good) >= amount;
	}
	hasAll(cost) {
		for (const [good, amount] of Object.entries(cost)) if (this.get(good) < amount) return false;
		return true;
	}
	/** Adds goods, clamped to capacity. Returns how much actually fit. */
	add(good, amount) {
		if (amount <= 0) return 0;
		const current = this.get(good);
		const room = Math.max(0, this.capacity - current);
		const stored = Math.min(amount, room);
		this.amounts.set(good, current + stored);
		return stored;
	}
	/** Removes goods. Returns how much was actually available and taken. */
	take(good, amount) {
		if (amount <= 0) return 0;
		const current = this.get(good);
		const taken = Math.min(amount, current);
		this.amounts.set(good, current - taken);
		return taken;
	}
	/** Atomically spends a whole cost, or nothing at all. */
	spend(cost) {
		if (!this.hasAll(cost)) return false;
		for (const [good, amount] of Object.entries(cost)) this.take(good, amount);
		return true;
	}
	set(good, amount) {
		this.amounts.set(good, Math.max(0, Math.min(this.capacity, amount)));
	}
	total() {
		let sum = 0;
		for (const amount of this.amounts.values()) sum += amount;
		return sum;
	}
	/** Fraction of capacity used, averaged across stored goods. */
	fullness() {
		const stored = this.total();
		const maxTotal = this.capacity * ALL_GOODS.length;
		return maxTotal <= 0 ? 0 : stored / maxTotal;
	}
	/** Goods sorted by amount, largest first. Used by the trade AI to pick exports. */
	entries() {
		return ALL_GOODS.map((good) => ({
			good,
			amount: this.get(good)
		})).filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);
	}
	/** The good this stockpile has most of relative to capacity. */
	largestSurplus(exclude = []) {
		const candidates = this.entries().filter((e) => !exclude.includes(e.good));
		return candidates.length ? candidates[0] : null;
	}
	/** The good this stockpile most lacks, among the ones it should have. */
	largestDeficit(wanted) {
		let worst = null;
		for (const good of wanted) {
			const amount = this.get(good);
			if (!worst || amount < worst.amount) worst = {
				good,
				amount
			};
		}
		return worst;
	}
	serialize() {
		const out = {};
		for (const [good, amount] of this.amounts) if (amount > 0) out[good] = Math.round(amount * 100) / 100;
		return out;
	}
	deserialize(data) {
		this.amounts.clear();
		if (!data) return;
		for (const [good, amount] of Object.entries(data)) this.amounts.set(good, amount);
	}
	clone() {
		const copy = new Stockpile(this.capacity);
		for (const [good, amount] of this.amounts) copy.amounts.set(good, amount);
		return copy;
	}
};
//#endregion
//#region src/civ/City.ts
var SETTLEMENT_TIERS = [
	{
		id: "camp",
		name: "Camp",
		icon: "⛺",
		minPopulation: 0,
		buildingSlots: 5,
		territoryLimit: 60,
		storage: 250,
		color: "#a8a29e"
	},
	{
		id: "hamlet",
		name: "Hamlet",
		icon: "🛖",
		minPopulation: 8,
		buildingSlots: 10,
		territoryLimit: 175,
		storage: 400,
		color: "#b45309"
	},
	{
		id: "village",
		name: "Village",
		icon: "🏘️",
		minPopulation: 20,
		buildingSlots: 16,
		territoryLimit: 380,
		storage: 650,
		color: "#22c55e"
	},
	{
		id: "town",
		name: "Town",
		icon: "🏙️",
		minPopulation: 45,
		buildingSlots: 18,
		territoryLimit: 700,
		storage: 950,
		color: "#38bdf8"
	},
	{
		id: "city",
		name: "City",
		icon: "🏛️",
		minPopulation: 90,
		buildingSlots: 28,
		territoryLimit: 1200,
		storage: 1400,
		color: "#a855f7"
	},
	{
		id: "metropolis",
		name: "Metropolis",
		icon: "🌆",
		minPopulation: 180,
		buildingSlots: 42,
		territoryLimit: 2e3,
		storage: 2200,
		color: "#fbbf24"
	}
];
function tierForPopulation(population) {
	let result = SETTLEMENT_TIERS[0];
	for (const tier of SETTLEMENT_TIERS) if (population >= tier.minPopulation) result = tier;
	return result;
}
var City = class City {
	id;
	name;
	species;
	x;
	y;
	kingdomId = null;
	founderName;
	foundingYear;
	population = 0;
	mayorId = null;
	/** Everything this settlement physically holds. */
	stock;
	territory = /* @__PURE__ */ new Set();
	buildings = /* @__PURE__ */ new Map();
	tier = "camp";
	/** Settlement this one was founded from, if any. */
	parentCityId = null;
	/** 0..1 — how well fed and housed the population is. */
	prosperity = .5;
	/** Years the settlement has gone hungry in a row. */
	famineYears = 0;
	/** Realm currently besieging this settlement, if any. */
	besiegerId = null;
	/** 0..1 — how close the besieger is to taking the walls. */
	siegeProgress = 0;
	/** Years this settlement has been under siege without relief. */
	siegeYears = 0;
	/** Year the settlement last changed hands by force. */
	capturedYear = null;
	/** Realm that held this settlement before it was taken. */
	formerOwnerId = null;
	/** Research points this settlement contributed last year. */
	researchOutput = 0;
	/** Value of goods produced last year, at market prices. */
	economicOutput = 0;
	resourceCacheYear = 0;
	resourcesByTileType = /* @__PURE__ */ new Map();
	resourcesByGood = /* @__PURE__ */ new Map();
	constructor(id, name, species, x, y, founderName, foundingYear) {
		this.id = id;
		this.name = name;
		this.species = species;
		this.x = x;
		this.y = y;
		this.founderName = founderName;
		this.foundingYear = foundingYear;
		this.stock = new Stockpile(SETTLEMENT_TIERS[0].storage, {
			food: 100,
			wood: 50,
			stone: 30
		});
		this.territory.add(`${x},${y}`);
		const tc = new Building(`b_tc_${id}`, "town_center", x, y, id);
		this.buildings.set(tc.id, tc);
	}
	get tierInfo() {
		return SETTLEMENT_TIERS.find((t) => t.id === this.tier) ?? SETTLEMENT_TIERS[0];
	}
	/** Recomputes the tier from population. Returns the new tier if it changed. */
	updateTier() {
		const next = tierForPopulation(this.population);
		if (next.id === this.tier) return null;
		const previous = this.tier;
		this.tier = next.id;
		this.stock.capacity = next.storage + this.storageBonus();
		return SETTLEMENT_TIERS.findIndex((t) => t.id === next.id) > SETTLEMENT_TIERS.findIndex((t) => t.id === previous) ? next : null;
	}
	storageBonus() {
		let bonus = 0;
		for (const b of this.buildings.values()) bonus += (b.definition.storage ?? 0) * b.level;
		return bonus;
	}
	get buildingSlots() {
		return this.tierInfo.buildingSlots;
	}
	hasFreeBuildingSlot() {
		return this.buildings.size < this.buildingSlots;
	}
	/**
	* Claims the land a new settlement plainly controls the moment it is founded.
	*
	* Starting from a single tile made every new settlement invisible on the map
	* until decades of yearly expansion had accumulated, so a freshly founded world
	* looked like empty wilderness. A founding claim gives each settlement a region
	* from day one and gets neighbours into contact far sooner.
	*/
	seedFoundingClaim(tileMap, radius = 4) {
		const cx = Math.floor(this.x);
		const cy = Math.floor(this.y);
		for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
			if (Math.hypot(dx, dy) > radius + .3) continue;
			const tile = tileMap.getTile(cx + dx, cy + dy);
			if (!tile) continue;
			if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
			if (tile.kingdomId && tile.kingdomId !== this.kingdomId) continue;
			this.territory.add(`${tile.x},${tile.y}`);
			if (this.kingdomId) tile.kingdomId = this.kingdomId;
		}
	}
	territoryLimit(techBonus = 0, governmentBonus = 0) {
		return this.tierInfo.territoryLimit + techBonus + governmentBonus;
	}
	/** Total citizens the settlement can house. Growth stalls beyond this. */
	housingCapacity() {
		let capacity = 0;
		for (const b of this.buildings.values()) capacity += (b.definition.housing ?? 0) * b.level;
		return capacity;
	}
	/** Workers needed to fully staff every building. */
	jobsAvailable() {
		let jobs = 0;
		for (const b of this.buildings.values()) jobs += (b.definition.jobs ?? 0) * b.level;
		return jobs;
	}
	/** Combined defensive multiplier from walls, barracks and keeps. */
	defenseMultiplier() {
		let multiplier = 1;
		for (const b of this.buildings.values()) {
			const def = b.definition.defense;
			if (def) multiplier *= 1 + (def - 1) * (1 + (b.level - 1) * .4);
		}
		return multiplier;
	}
	countOfType(type) {
		let count = 0;
		for (const b of this.buildings.values()) if (b.type === type) count++;
		return count;
	}
	hasBuilding(type) {
		return this.countOfType(type) > 0;
	}
	addBuilding(type, bx, by) {
		const b = new Building(`b_${this.id}_${this.buildings.size}_${Math.floor(Math.random() * 1e5)}`, type, bx, by, this.id);
		this.buildings.set(b.id, b);
		this.stock.capacity = this.tierInfo.storage + this.storageBonus();
		return b;
	}
	removeBuilding(id) {
		this.buildings.delete(id);
		this.stock.capacity = this.tierInfo.storage + this.storageBonus();
	}
	/** Buildings of a category, used by the construction AI to balance a settlement. */
	buildingsOfCategory(category) {
		return [...this.buildings.values()].filter((b) => b.definition.category === category);
	}
	/** Unassign worker from all buildings in this city (on death or migration). */
	unassignWorker(workerId) {
		for (const building of this.buildings.values()) building.assignedWorkerIds.delete(workerId);
	}
	/** Total job slots vs filled slots for a building type. */
	jobSlotInfo(type) {
		let total = 0, filled = 0;
		for (const b of this.buildings.values()) if (b.type === type) {
			total += b.definition.jobs ?? 0;
			filled += b.assignedWorkerIds.size;
		}
		return {
			total,
			filled
		};
	}
	/** Rebuild cached lists of nearby resource tiles.  Called once per year. */
	rebuildResourceCache(tileMap, year, surveyRadius) {
		if (this.resourceCacheYear === year) return;
		this.resourceCacheYear = year;
		this.resourcesByTileType.clear();
		this.resourcesByGood.clear();
		const cx = Math.floor(this.x), cy = Math.floor(this.y);
		for (let dx = -surveyRadius; dx <= surveyRadius; dx++) for (let dy = -surveyRadius; dy <= surveyRadius; dy++) {
			const tile = tileMap.getTile(cx + dx, cy + dy);
			if (!tile || TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
			if (tile.resourceAmount > 0) {
				const pos = {
					x: tile.x,
					y: tile.y
				};
				if (tile.type === TerrainType.FOREST) {
					let arr = this.resourcesByTileType.get(TerrainType.FOREST);
					if (!arr) {
						arr = [];
						this.resourcesByTileType.set(TerrainType.FOREST, arr);
					}
					arr.push(pos);
				}
				if (tile.resourceType) {
					let arr = this.resourcesByGood.get(tile.resourceType);
					if (!arr) {
						arr = [];
						this.resourcesByGood.set(tile.resourceType, arr);
					}
					arr.push(pos);
				}
			}
		}
		const sortFn = (a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2);
		for (const [, arr] of this.resourcesByTileType) arr.sort(sortFn);
		for (const [, arr] of this.resourcesByGood) arr.sort(sortFn);
	}
	nearestCached(type, fromX, fromY) {
		const sites = this.resourcesByTileType.get(type);
		if (!sites || sites.length === 0) return null;
		let best = null, bestDist = Infinity;
		for (const s of sites) {
			const d = (s.x - fromX) ** 2 + (s.y - fromY) ** 2;
			if (d < bestDist) {
				bestDist = d;
				best = s;
			}
		}
		return best;
	}
	/** Legacy accessor kept so older UI paths keep reading sensible numbers. */
	get resources() {
		return {
			wood: Math.round(this.stock.get("wood")),
			stone: Math.round(this.stock.get("stone")),
			iron: Math.round(this.stock.get("iron")),
			food: Math.round(this.stock.get("food")),
			gold: Math.round(this.stock.get("gold"))
		};
	}
	give(good, amount) {
		return this.stock.add(good, amount);
	}
	take(good, amount) {
		return this.stock.take(good, amount);
	}
	serialize() {
		return {
			id: this.id,
			name: this.name,
			species: this.species,
			x: this.x,
			y: this.y,
			kingdomId: this.kingdomId,
			founderName: this.founderName,
			foundingYear: this.foundingYear,
			population: this.population,
			mayorId: this.mayorId,
			tier: this.tier,
			parentCityId: this.parentCityId,
			prosperity: this.prosperity,
			famineYears: this.famineYears,
			besiegerId: this.besiegerId,
			siegeProgress: this.siegeProgress,
			siegeYears: this.siegeYears,
			capturedYear: this.capturedYear,
			formerOwnerId: this.formerOwnerId,
			stock: this.stock.serialize(),
			territory: Array.from(this.territory),
			buildings: [...this.buildings.values()].map((b) => ({
				id: b.id,
				type: b.type,
				x: b.x,
				y: b.y,
				level: b.level,
				hp: b.hp,
				extractedGood: b.extractedGood,
				assignedWorkerIds: [...b.assignedWorkerIds]
			}))
		};
	}
	static deserialize(data) {
		const city = new City(data.id, data.name, data.species, data.x, data.y, data.founderName, data.foundingYear);
		city.kingdomId = data.kingdomId ?? null;
		city.population = data.population ?? 0;
		city.mayorId = data.mayorId ?? null;
		city.tier = data.tier ?? "camp";
		city.parentCityId = data.parentCityId ?? null;
		city.prosperity = data.prosperity ?? .5;
		city.famineYears = data.famineYears ?? 0;
		city.besiegerId = data.besiegerId ?? null;
		city.siegeProgress = data.siegeProgress ?? 0;
		city.siegeYears = data.siegeYears ?? 0;
		city.capturedYear = data.capturedYear ?? null;
		city.formerOwnerId = data.formerOwnerId ?? null;
		city.territory = new Set(data.territory ?? [`${data.x},${data.y}`]);
		if (Array.isArray(data.buildings) && data.buildings.length > 0) {
			city.buildings.clear();
			for (const bd of data.buildings) {
				const b = new Building(bd.id, bd.type, bd.x, bd.y, city.id);
				b.level = bd.level ?? 1;
				b.maxHp = (BUILDINGS[bd.type]?.maxHp ?? 150) * (1 + (b.level - 1) * .5);
				b.hp = bd.hp ?? b.maxHp;
				b.extractedGood = bd.extractedGood ?? null;
				b.assignedWorkerIds = new Set(bd.assignedWorkerIds ?? []);
				city.buildings.set(b.id, b);
			}
		}
		city.stock.capacity = city.tierInfo.storage + city.storageBonus();
		city.stock.deserialize(data.stock);
		return city;
	}
};
//#endregion
//#region src/civ/TechTree.ts
var TECH_ERAS = {
	stone: {
		id: "stone",
		name: "Era da Pedra",
		icon: "🪨",
		color: "#a8a29e",
		order: 0
	},
	bronze: {
		id: "bronze",
		name: "Era do Bronze",
		icon: "🏺",
		color: "#d97706",
		order: 1
	},
	iron: {
		id: "iron",
		name: "Era do Ferro",
		icon: "⚔️",
		color: "#94a3b8",
		order: 2
	},
	classical: {
		id: "classical",
		name: "Era Clássica",
		icon: "🏛️",
		color: "#fbbf24",
		order: 3
	},
	industrial: {
		id: "industrial",
		name: "Era Industrial",
		icon: "⚙️",
		color: "#f97316",
		order: 4
	},
	modern: {
		id: "modern",
		name: "Era Moderna",
		icon: "💡",
		color: "#22d3ee",
		order: 5
	}
};
/**
* How much slower each era is to research than the last.
*
* Raw tech costs are written on a human scale; this curve is what makes progress
* feel like history. A realm blows through the Stone Age in a few generations and
* then spends centuries inching toward industry.
*
* The curve is deliberately gentler than pure flavour would suggest. A stone-age
* realm produces only a few research points a year, and every knowledge building
* sits behind `writing`; scaled any harder, `mining` alone cost more than fifty
* years and the entire metal economy — quarry, mine, smithy, bronze, tools —
* stayed permanently out of reach.
*/
var ERA_COST_SCALE = {
	stone: 1,
	bronze: 1.2,
	iron: 1.8,
	classical: 2.6,
	industrial: 3.8,
	modern: 5.2
};
/** The real research cost of a technology, after era scaling. */
function techCost(tech) {
	return Math.round(tech.cost * ERA_COST_SCALE[tech.era]);
}
/**
* Compresses a compounded multiplier so long tech chains give strong but
* survivable advantages. A raw 20× becomes roughly 5×; 1× stays 1×.
*/
function damped(multiplier) {
	return multiplier <= 1 ? multiplier : Math.pow(multiplier, .55);
}
var TECHNOLOGIES = {
	stone_tools: {
		id: "stone_tools",
		name: "Stone Tools",
		track: "craft",
		era: "stone",
		icon: "🪓",
		cost: 30,
		requires: [],
		unlocks: {
			modifiers: { production: 1.15 },
			buildings: ["lumber_camp"]
		},
		description: "Knapped flint. Everything else in history follows from this.",
		discovery: "learned to shape stone into tools"
	},
	fire_mastery: {
		id: "fire_mastery",
		name: "Mastery of Fire",
		track: "craft",
		era: "stone",
		icon: "🔥",
		cost: 40,
		requires: ["stone_tools"],
		unlocks: { modifiers: {
			growth: 1.1,
			military: 1.1
		} },
		description: "Warmth, cooked food and a weapon that spreads on its own.",
		discovery: "tamed fire"
	},
	agriculture: {
		id: "agriculture",
		name: "Agriculture",
		track: "craft",
		era: "stone",
		icon: "🌾",
		cost: 60,
		requires: ["stone_tools"],
		unlocks: {
			buildings: ["farm", "granary"],
			goods: ["cotton", "spices"],
			modifiers: { growth: 1.35 }
		},
		description: "Planting instead of foraging. Populations stop wandering and start counting.",
		discovery: "began to farm the land"
	},
	animal_husbandry: {
		id: "animal_husbandry",
		name: "Animal Husbandry",
		track: "craft",
		era: "stone",
		icon: "🐄",
		cost: 70,
		requires: ["agriculture"],
		unlocks: {
			buildings: ["pasture"],
			goods: ["horses", "furs"],
			modifiers: {
				growth: 1.15,
				production: 1.1
			}
		},
		description: "Herds that follow you are better than herds you chase.",
		discovery: "domesticated livestock"
	},
	pottery: {
		id: "pottery",
		name: "Pottery & Weaving",
		track: "craft",
		era: "bronze",
		icon: "🏺",
		cost: 110,
		requires: ["agriculture"],
		unlocks: {
			buildings: ["workshop"],
			goods: ["cloth"],
			features: ["trade_routes"],
			modifiers: {
				production: 1.1,
				trade: 1.15
			}
		},
		description: "Storage and cloth. Surplus becomes possible, and so does trade.",
		discovery: "mastered pottery and weaving"
	},
	mining: {
		id: "mining",
		name: "Mining",
		track: "craft",
		era: "bronze",
		icon: "⛏️",
		cost: 130,
		requires: ["stone_tools"],
		unlocks: {
			buildings: ["mine", "quarry"],
			goods: [
				"copper",
				"tin",
				"iron",
				"coal",
				"salt",
				"gold",
				"gems",
				"saltpeter"
			],
			modifiers: { production: 1.2 }
		},
		description: "Digging beneath the surface for what the land refuses to give freely.",
		discovery: "sank the first mine shafts"
	},
	masonry: {
		id: "masonry",
		name: "Masonry",
		track: "craft",
		era: "bronze",
		icon: "🧱",
		cost: 150,
		requires: ["mining"],
		unlocks: {
			buildings: ["wall"],
			modifiers: {
				military: 1.2,
				territory: 2
			}
		},
		description: "Dressed stone. Cities acquire walls, and walls acquire meaning.",
		discovery: "raised its first stone walls"
	},
	bronze_working: {
		id: "bronze_working",
		name: "Bronze Working",
		track: "craft",
		era: "bronze",
		icon: "⚒️",
		cost: 180,
		requires: ["mining", "fire_mastery"],
		unlocks: {
			buildings: ["smithy", "barracks"],
			goods: ["bronze", "tools"],
			modifiers: {
				military: 1.25,
				production: 1.15
			}
		},
		description: "Alloyed metal. The first tools that outlast the hands that made them.",
		discovery: "smelted bronze"
	},
	writing: {
		id: "writing",
		name: "Writing",
		track: "craft",
		era: "bronze",
		icon: "📜",
		cost: 200,
		requires: ["pottery"],
		unlocks: {
			buildings: ["library", "temple"],
			modifiers: { research: 1.4 },
			features: ["writing", "diplomacy_pacts"]
		},
		description: "Memory that survives its owner. Law, debt and history all become possible.",
		discovery: "invented writing"
	},
	iron_working: {
		id: "iron_working",
		name: "Iron Working",
		track: "craft",
		era: "iron",
		icon: "⚔️",
		cost: 280,
		requires: ["bronze_working"],
		unlocks: { modifiers: {
			military: 1.4,
			production: 1.2
		} },
		description: "Harder, cheaper and far more common than bronze. War gets democratic.",
		discovery: "forged iron"
	},
	mathematics: {
		id: "mathematics",
		name: "Mathematics",
		track: "craft",
		era: "iron",
		icon: "📐",
		cost: 300,
		requires: ["writing"],
		unlocks: { modifiers: {
			research: 1.25,
			production: 1.1
		} },
		description: "Counting turns into proof. Buildings get taller and taxes get accurate.",
		discovery: "formalised mathematics"
	},
	currency: {
		id: "currency",
		name: "Currency",
		track: "craft",
		era: "iron",
		icon: "🪙",
		cost: 340,
		requires: ["mathematics", "mining"],
		unlocks: {
			buildings: ["market"],
			features: ["currency", "trade_routes"],
			modifiers: { trade: 1.5 }
		},
		description: "Minted coin. Wealth stops being grain in a barn and becomes a number.",
		discovery: "minted its first coinage"
	},
	sailing: {
		id: "sailing",
		name: "Sailing",
		track: "craft",
		era: "iron",
		icon: "⛵",
		cost: 320,
		requires: ["pottery", "mathematics"],
		unlocks: {
			buildings: ["harbor"],
			features: ["maritime_trade", "colonisation"],
			modifiers: { trade: 1.3 }
		},
		description: "The sea stops being a wall and becomes a road.",
		discovery: "learned to sail beyond sight of land"
	},
	roads: {
		id: "roads",
		name: "Road Building",
		track: "craft",
		era: "iron",
		icon: "🛣️",
		cost: 300,
		requires: ["masonry"],
		unlocks: { modifiers: {
			trade: 1.25,
			territory: 3,
			military: 1.1
		} },
		description: "Paved routes. Armies and caravans both move faster — usually in that order.",
		discovery: "paved the first great roads"
	},
	engineering: {
		id: "engineering",
		name: "Engineering",
		track: "craft",
		era: "classical",
		icon: "🏗️",
		cost: 480,
		requires: ["mathematics", "masonry"],
		unlocks: {
			buildings: ["aqueduct", "port"],
			modifiers: {
				production: 1.3,
				growth: 1.2,
				territory: 3
			}
		},
		description: "Aqueducts, cranes and siege engines. Cities can finally outgrow their wells.",
		discovery: "mastered engineering"
	},
	philosophy: {
		id: "philosophy",
		name: "Philosophy",
		track: "craft",
		era: "classical",
		icon: "🧠",
		cost: 500,
		requires: ["writing"],
		unlocks: {
			buildings: ["academy"],
			modifiers: { research: 1.45 }
		},
		description: "Asking why the king is king. Historically, a dangerous pastime.",
		discovery: "gave rise to its first philosophers"
	},
	medicine: {
		id: "medicine",
		name: "Medicine",
		track: "craft",
		era: "classical",
		icon: "⚕️",
		cost: 520,
		requires: ["philosophy"],
		unlocks: { modifiers: { growth: 1.35 } },
		description: "Fewer people die of things that did not need to kill them.",
		discovery: "developed formal medicine"
	},
	banking: {
		id: "banking",
		name: "Banking",
		track: "craft",
		era: "classical",
		icon: "🏦",
		cost: 600,
		requires: ["currency", "mathematics"],
		unlocks: {
			buildings: ["bank"],
			features: ["banking"],
			modifiers: { trade: 1.5 }
		},
		description: "Lending money you do not have, against wealth that does not exist yet.",
		discovery: "founded its first banks"
	},
	metallurgy: {
		id: "metallurgy",
		name: "Metallurgy",
		track: "craft",
		era: "classical",
		icon: "🔩",
		cost: 620,
		requires: ["iron_working", "engineering"],
		unlocks: {
			goods: ["steel"],
			modifiers: {
				military: 1.35,
				production: 1.25
			}
		},
		description: "Steel, alloys and blast furnaces. Coal stops being a curiosity.",
		discovery: "advanced the science of metals"
	},
	printing_press: {
		id: "printing_press",
		name: "Printing Press",
		track: "craft",
		era: "industrial",
		icon: "🖨️",
		cost: 850,
		requires: ["philosophy", "metallurgy"],
		unlocks: { modifiers: {
			research: 1.6,
			growth: 1.1
		} },
		description: "Ideas reproduce faster than the people who censor them.",
		discovery: "built the printing press"
	},
	gunpowder: {
		id: "gunpowder",
		name: "Gunpowder",
		track: "craft",
		era: "industrial",
		icon: "💥",
		cost: 900,
		requires: ["metallurgy"],
		unlocks: {
			goods: ["gunpowder"],
			features: ["conscription"],
			modifiers: { military: 1.7 }
		},
		description: "Walls stop being the answer. So do knights.",
		discovery: "weaponised gunpowder"
	},
	steam_power: {
		id: "steam_power",
		name: "Steam Power",
		track: "craft",
		era: "industrial",
		icon: "🚂",
		cost: 1100,
		requires: ["engineering", "metallurgy"],
		unlocks: { modifiers: {
			production: 1.5,
			trade: 1.3
		} },
		description: "Work stops being limited by how many arms you own.",
		discovery: "harnessed steam"
	},
	industrialization: {
		id: "industrialization",
		name: "Industrialization",
		track: "craft",
		era: "industrial",
		icon: "🏭",
		cost: 1400,
		requires: ["steam_power", "banking"],
		unlocks: {
			buildings: [
				"factory",
				"oil_well",
				"refinery"
			],
			goods: [
				"oil",
				"fuel",
				"machinery"
			],
			features: ["mass_production"],
			modifiers: {
				production: 1.8,
				growth: 1.2
			}
		},
		description: "Mass production. Enormous wealth, enormous inequality, and a new kind of politics.",
		discovery: "entered the industrial age"
	},
	electricity: {
		id: "electricity",
		name: "Electricity",
		track: "craft",
		era: "modern",
		icon: "⚡",
		cost: 1800,
		requires: ["industrialization"],
		unlocks: {
			goods: ["uranium"],
			modifiers: {
				production: 1.4,
				research: 1.4,
				growth: 1.15
			}
		},
		description: "Light, motors and instant communication over any distance.",
		discovery: "electrified its cities"
	},
	mass_media: {
		id: "mass_media",
		name: "Mass Media",
		track: "craft",
		era: "modern",
		icon: "📡",
		cost: 2100,
		requires: ["electricity", "printing_press"],
		unlocks: { modifiers: {
			research: 1.3,
			trade: 1.2
		} },
		description: "Whoever controls the broadcast controls what the people believe happened.",
		discovery: "built a mass media apparatus"
	},
	tribalism: {
		id: "tribalism",
		name: "Tribalism",
		track: "politics",
		era: "stone",
		icon: "🪶",
		cost: 0,
		requires: [],
		unlocks: { governments: ["tribe"] },
		description: "Kinship and elders. Authority reaches exactly as far as everyone can shout.",
		discovery: "organised itself into tribes"
	},
	chiefdom: {
		id: "chiefdom",
		name: "Chiefdom",
		track: "politics",
		era: "stone",
		icon: "🗿",
		cost: 80,
		requires: ["tribalism", "agriculture"],
		unlocks: {
			governments: ["chiefdom"],
			modifiers: {
				growth: 1.1,
				territory: 1
			}
		},
		description: "One family claims the surplus, and the others let them.",
		discovery: "crowned its first chieftain"
	},
	feudalism: {
		id: "feudalism",
		name: "Feudalism",
		track: "politics",
		era: "bronze",
		icon: "🛡️",
		cost: 260,
		requires: [
			"chiefdom",
			"masonry",
			"agriculture"
		],
		unlocks: {
			governments: ["feudal_kingdom"],
			buildings: ["keep"],
			modifiers: {
				military: 1.25,
				territory: 2,
				growth: 1.05
			}
		},
		description: "Land granted in exchange for oaths. Loyalty becomes a form of property.",
		discovery: "established the feudal order"
	},
	monarchy: {
		id: "monarchy",
		name: "Monarchy",
		track: "politics",
		era: "iron",
		icon: "👑",
		cost: 460,
		requires: ["feudalism", "writing"],
		unlocks: {
			governments: ["monarchy"],
			buildings: ["palace"],
			modifiers: {
				growth: 1.15,
				trade: 1.1,
				territory: 3
			}
		},
		description: "The crown outranks the barons. Written law replaces personal loyalty.",
		discovery: "consolidated power under a single crown"
	},
	imperialism: {
		id: "imperialism",
		name: "Imperialism",
		track: "politics",
		era: "classical",
		icon: "🦅",
		cost: 780,
		requires: ["monarchy", "roads"],
		unlocks: {
			governments: ["empire"],
			modifiers: {
				military: 1.3,
				territory: 6,
				trade: 1.2
			}
		},
		description: "Conquered peoples are governed, not absorbed. The realm becomes an empire.",
		discovery: "proclaimed itself an empire"
	},
	constitutionalism: {
		id: "constitutionalism",
		name: "Constitutionalism",
		track: "politics",
		era: "industrial",
		icon: "📖",
		cost: 1200,
		requires: [
			"monarchy",
			"printing_press",
			"philosophy"
		],
		unlocks: {
			governments: ["constitutional_monarchy", "republic"],
			modifiers: {
				research: 1.2,
				growth: 1.15,
				trade: 1.15
			}
		},
		description: "The sovereign is bound by a document. Everyone pretends this was always the case.",
		discovery: "bound its ruler to a constitution"
	},
	capitalism: {
		id: "capitalism",
		name: "Capitalism",
		track: "politics",
		era: "industrial",
		icon: "📈",
		cost: 1700,
		requires: [
			"constitutionalism",
			"industrialization",
			"banking"
		],
		excludes: ["communism"],
		unlocks: {
			governments: ["capitalist_state"],
			buildings: ["stock_exchange"],
			features: ["stock_market"],
			modifiers: {
				trade: 1.8,
				production: 1.3,
				growth: 1.1
			}
		},
		description: "Private capital directs production. Growth accelerates; so does the gap.",
		discovery: "embraced capitalism"
	},
	communism: {
		id: "communism",
		name: "Communism",
		track: "politics",
		era: "industrial",
		icon: "☭",
		cost: 1700,
		requires: ["constitutionalism", "industrialization"],
		excludes: ["capitalism"],
		unlocks: {
			governments: ["communist_state"],
			buildings: ["collective"],
			features: ["central_planning"],
			modifiers: {
				production: 1.55,
				growth: 1.25,
				military: 1.2
			}
		},
		description: "The state directs production on behalf of the workers. Trade suffers; output does not.",
		discovery: "declared a workers’ state"
	}
};
var ALL_TECH_IDS = Object.keys(TECHNOLOGIES);
ALL_TECH_IDS.map((id) => TECHNOLOGIES[id]).filter((t) => t.track === "craft");
ALL_TECH_IDS.map((id) => TECHNOLOGIES[id]).filter((t) => t.track === "politics");
/**
* The research state of one kingdom.
* Kingdoms accumulate points every year and spend them on whatever they can reach.
*/
var ResearchState = class {
	known = /* @__PURE__ */ new Set(["tribalism"]);
	/** Tech currently being researched, and how many points are banked toward it. */
	current = null;
	progress = 0;
	/** Research points produced per year, recomputed by the civilization engine. */
	output = 0;
	/** Techs permanently barred by an exclusive choice already made. */
	forbidden = /* @__PURE__ */ new Set();
	knows(techId) {
		return this.known.has(techId);
	}
	knowsFeature(feature) {
		for (const id of this.known) if (TECHNOLOGIES[id]?.unlocks.features?.includes(feature)) return true;
		return false;
	}
	/** A tech is available when every prerequisite is known and nothing forbids it. */
	isAvailable(techId) {
		if (this.known.has(techId) || this.forbidden.has(techId)) return false;
		const tech = TECHNOLOGIES[techId];
		if (!tech) return false;
		return tech.requires.every((req) => this.known.has(req));
	}
	availableTechs() {
		return ALL_TECH_IDS.filter((id) => this.isAvailable(id)).map((id) => TECHNOLOGIES[id]);
	}
	/** Every modifier from every known tech, multiplied together. */
	modifiers() {
		const total = {
			production: 1,
			research: 1,
			growth: 1,
			trade: 1,
			military: 1,
			territory: 0
		};
		for (const id of this.known) {
			const mods = TECHNOLOGIES[id]?.unlocks.modifiers;
			if (!mods) continue;
			if (mods.production) total.production *= mods.production;
			if (mods.research) total.research *= mods.research;
			if (mods.growth) total.growth *= mods.growth;
			if (mods.trade) total.trade *= mods.trade;
			if (mods.military) total.military *= mods.military;
			if (mods.territory) total.territory += mods.territory;
		}
		total.production = damped(total.production);
		total.research = damped(total.research);
		total.growth = damped(total.growth);
		total.trade = damped(total.trade);
		total.military = damped(total.military);
		return total;
	}
	unlockedBuildings() {
		const buildings = /* @__PURE__ */ new Set();
		for (const id of this.known) for (const b of TECHNOLOGIES[id]?.unlocks.buildings ?? []) buildings.add(b);
		return buildings;
	}
	unlockedGovernments() {
		const governments = [];
		for (const id of this.known) for (const g of TECHNOLOGIES[id]?.unlocks.governments ?? []) if (!governments.includes(g)) governments.push(g);
		return governments;
	}
	/** Highest era among known craft techs — the kingdom's overall level of development. */
	currentEra() {
		let best = "stone";
		let bestOrder = -1;
		for (const id of this.known) {
			const tech = TECHNOLOGIES[id];
			if (!tech) continue;
			const order = TECH_ERAS[tech.era].order;
			if (order > bestOrder) {
				bestOrder = order;
				best = tech.era;
			}
		}
		return best;
	}
	/** 0..1 across the entire tree, for progress bars. */
	overallProgress() {
		return this.known.size / ALL_TECH_IDS.length;
	}
	/** Marks a tech known and applies its exclusivity. */
	complete(techId) {
		this.known.add(techId);
		const tech = TECHNOLOGIES[techId];
		for (const excluded of tech?.excludes ?? []) this.forbidden.add(excluded);
		if (this.current === techId) {
			this.current = null;
			this.progress = 0;
		}
	}
	serialize() {
		return {
			known: Array.from(this.known),
			current: this.current,
			progress: this.progress,
			forbidden: Array.from(this.forbidden)
		};
	}
	deserialize(data) {
		if (!data) return;
		this.known = new Set(data.known ?? ["tribalism"]);
		this.current = data.current ?? null;
		this.progress = data.progress ?? 0;
		this.forbidden = new Set(data.forbidden ?? []);
	}
};
//#endregion
//#region src/civ/Government.ts
var GOVERNMENTS = {
	tribe: {
		id: "tribe",
		name: "Tribo Primitiva",
		rulerTitle: "Ancião",
		icon: "feather",
		color: "#a8a29e",
		economy: "subsistence",
		taxRate: .05,
		growth: 1,
		production: 1,
		research: 1,
		trade: .8,
		military: 1,
		aggression: .8,
		stability: .7,
		expansion: 8,
		succession: "strongest",
		description: "Bando de parentesco liderado pelos mais velhos respeitados. Tradição oral sem escrita."
	},
	chiefdom: {
		id: "chiefdom",
		name: "Chefia Tribal",
		rulerTitle: "Cacique",
		icon: "statue",
		color: "#b45309",
		economy: "tributary",
		taxRate: .12,
		growth: 1.1,
		production: 1.1,
		research: 1.05,
		trade: .95,
		military: 1.1,
		aggression: 1,
		stability: .65,
		expansion: 14,
		succession: "strongest",
		description: "Uma dinastia forte recolhe tributos do povo em troca de proteção militar."
	},
	feudal_kingdom: {
		id: "feudal_kingdom",
		name: "Reino Feudal",
		rulerTitle: "Rei",
		icon: "shield",
		color: "#7c3aed",
		economy: "tributary",
		taxRate: .18,
		growth: 1.12,
		production: 1.15,
		research: 1.1,
		trade: 1.05,
		military: 1.3,
		aggression: 1.2,
		stability: .6,
		expansion: 22,
		succession: "bloodline",
		description: "Vassalos possuem terras em troca de fornecer juramento e tropa de cavaleiros."
	},
	monarchy: {
		id: "monarchy",
		name: "Monarquia Absoluta",
		rulerTitle: "Rei Absoluto",
		icon: "crown",
		color: "#fbbf24",
		economy: "mercantile",
		taxRate: .24,
		growth: 1.2,
		production: 1.25,
		research: 1.2,
		trade: 1.25,
		military: 1.3,
		aggression: 1.1,
		stability: .8,
		expansion: 30,
		succession: "bloodline",
		description: "Poder supremo concentrado na coroa e na dinastia real legítima."
	},
	empire: {
		id: "empire",
		name: "Império Celestial",
		rulerTitle: "Imperador",
		icon: "throne",
		color: "#f59e0b",
		economy: "mercantile",
		taxRate: .28,
		growth: 1.25,
		production: 1.35,
		research: 1.25,
		trade: 1.3,
		military: 1.45,
		aggression: 1.35,
		stability: .75,
		expansion: 40,
		succession: "bloodline",
		description: "Vasta expansão territorial com legiões organizadas e burocracia centralizada."
	},
	constitutional_monarchy: {
		id: "constitutional_monarchy",
		name: "Monarquia Constitucional",
		rulerTitle: "Primeiro-Ministro",
		icon: "scroll",
		color: "#2563eb",
		economy: "market",
		taxRate: .2,
		growth: 1.3,
		production: 1.3,
		research: 1.35,
		trade: 1.4,
		military: 1.2,
		aggression: .7,
		stability: .85,
		expansion: 35,
		succession: "election",
		description: "O soberano reina sob leis escritas e um parlamento representativo eleito."
	},
	republic: {
		id: "republic",
		name: "República Democrática",
		rulerTitle: "Presidente",
		icon: "columns",
		color: "#0284c7",
		economy: "market",
		taxRate: .22,
		growth: 1.35,
		production: 1.3,
		research: 1.4,
		trade: 1.45,
		military: 1.15,
		aggression: .6,
		stability: .82,
		expansion: 36,
		succession: "election",
		description: "Governo do povo com magistrados e senado eleitos democraticamente."
	},
	capitalist_state: {
		id: "capitalist_state",
		name: "Corporação Livre",
		rulerTitle: "Chanceler",
		icon: "coins",
		color: "#10b981",
		economy: "market",
		taxRate: .15,
		growth: 1.4,
		production: 1.45,
		research: 1.45,
		trade: 1.6,
		military: 1.1,
		aggression: .8,
		stability: .78,
		expansion: 38,
		succession: "election",
		description: "Mercado livre e industrialização acelerada movida pelo capital acumulado."
	},
	communist_state: {
		id: "communist_state",
		name: "Estado Socialista",
		rulerTitle: "Camarada Supremo",
		icon: "hammer",
		color: "#ef4444",
		economy: "planned",
		taxRate: .35,
		growth: 1.25,
		production: 1.5,
		research: 1.3,
		trade: 1.1,
		military: 1.5,
		aggression: 1.1,
		stability: .9,
		expansion: 42,
		succession: "strongest",
		description: "Economia totalmente planejada pelo Estado para obras públicas e exército massivo."
	}
};
/** Governments a realm may move to next, ordered by how attractive they are. */
var GOVERNMENT_PROGRESSION = [
	"tribe",
	"chiefdom",
	"feudal_kingdom",
	"monarchy",
	"empire",
	"constitutional_monarchy",
	"republic",
	"capitalist_state",
	"communist_state"
];
function governmentRank(type) {
	return GOVERNMENT_PROGRESSION.indexOf(type);
}
function chooseGovernment(ctx) {
	const currentRank = governmentRank(ctx.currentGovernment);
	const candidates = ctx.available.filter((g) => g !== ctx.currentGovernment);
	if (candidates.length === 0) return ctx.currentGovernment;
	let best = ctx.currentGovernment;
	let bestScore = .35;
	for (const candidate of candidates) {
		GOVERNMENTS[candidate];
		let score = 0;
		const rankGain = governmentRank(candidate) - currentRank;
		score += rankGain > 0 ? .4 : -.5;
		switch (candidate) {
			case "empire":
				score += ctx.cityCount >= 4 ? .5 : -.6;
				score += ctx.atWar ? .25 : 0;
				score += ctx.rulerPersonality === "ambitious" ? .3 : 0;
				score += (ctx.culturalExpansionism ?? .5) > .6 ? .22 : -.08;
				score += (ctx.culturalMilitarism ?? .5) > .58 ? .18 : 0;
				score += (ctx.culturalAuthority ?? .5) > .6 ? .14 : 0;
				score += (ctx.socialMilitaryPressure ?? 0) * .28;
				score -= (ctx.socialReformPressure ?? 0) * .16;
				break;
			case "constitutional_monarchy":
				score += ctx.atWar ? -.5 : .3;
				score += ctx.wealthRatio > 1.2 ? .3 : 0;
				score += ctx.stability > .6 ? .2 : -.2;
				score += ctx.rulerPersonality === "diplomatic" ? .25 : 0;
				score += (ctx.culturalOpenness ?? .5) > .58 ? .16 : -.05;
				score += (ctx.culturalTradition ?? .5) > .54 ? .12 : 0;
				score += (ctx.socialMerchantPressure ?? 0) * .14;
				score += (ctx.socialReformPressure ?? 0) * .16;
				score += (ctx.socialElitePressure ?? 0) * .12;
				break;
			case "republic":
				score += ctx.atWar ? -.4 : .25;
				score += ctx.stability < .45 ? .35 : 0;
				score += ctx.rulerPersonality === "peaceful" ? .2 : 0;
				score += (ctx.culturalOpenness ?? .5) > .56 ? .2 : -.08;
				score += (ctx.culturalAuthority ?? .5) < .45 ? .18 : -.12;
				score += (ctx.culturalInnovation ?? .5) > .55 ? .12 : 0;
				score += (ctx.socialReformPressure ?? 0) * .32;
				score += (ctx.socialMerchantPressure ?? 0) * .1;
				score -= (ctx.socialElitePressure ?? 0) * .18;
				break;
			case "capitalist_state":
				score += ctx.wealthRatio > 1 ? .45 : -.2;
				score += ctx.industrialisation > .4 ? .35 : -.3;
				score += ctx.rulerPersonality === "greedy" ? .35 : 0;
				score += ctx.stability > .5 ? .15 : -.15;
				score += (ctx.culturalMercantilism ?? .5) > .58 ? .28 : -.1;
				score += (ctx.culturalInnovation ?? .5) > .55 ? .14 : 0;
				score += (ctx.culturalCollectivism ?? .5) > .62 ? -.18 : 0;
				score += (ctx.socialMerchantPressure ?? 0) * .35;
				score -= (ctx.socialWorkerPressure ?? 0) * .12;
				break;
			case "communist_state":
				score += ctx.industrialisation > .35 ? .4 : -.3;
				score += ctx.stability < .5 ? .55 : -.35;
				score += ctx.wealthRatio < .8 ? .3 : -.2;
				score += ctx.rulerPersonality === "ambitious" ? .15 : 0;
				score += (ctx.culturalCollectivism ?? .5) > .6 ? .26 : -.1;
				score += (ctx.culturalAuthority ?? .5) > .52 ? .12 : 0;
				score += (ctx.culturalMercantilism ?? .5) > .62 ? -.16 : 0;
				score += (ctx.socialWorkerPressure ?? 0) * .32;
				score += (ctx.socialReformPressure ?? 0) * .18;
				score -= (ctx.socialElitePressure ?? 0) * .18;
				break;
			default: score += .35;
		}
		if (score > bestScore) {
			bestScore = score;
			best = candidate;
		}
	}
	return best;
}
/** True when the transition is a revolution rather than an orderly reform. */
function isRevolution(from, to) {
	if (to === "communist_state") return true;
	if (to === "republic" && (from === "monarchy" || from === "empire" || from === "feudal_kingdom")) return true;
	return false;
}
//#endregion
//#region src/civ/Economy.ts
/**
* Money, prices and national accounts.
*
* Before the `currency` technology a realm barters — its treasury is measured in
* raw gold. Once currency is minted the realm gets a named money whose value
* floats against every other realm's, driven by how much gold backs it and how
* much of it has been printed.
*/
var CURRENCY_ROOTS = {
	[SpeciesType.LUMINI]: [
		"Sol",
		"Auren",
		"Lumen",
		"Radia",
		"Helio"
	],
	[SpeciesType.SYLVANII]: [
		"Leaf",
		"Verdan",
		"Thorn",
		"Silva",
		"Bloom"
	],
	[SpeciesType.STONEKIN]: [
		"Grani",
		"Ingot",
		"Forge",
		"Anvil",
		"Basalt"
	],
	[SpeciesType.EMBERKIN]: [
		"Ember",
		"Ash",
		"Pyre",
		"Cinder",
		"Scoria"
	],
	[SpeciesType.DEER]: ["Fawn"],
	[SpeciesType.WOLF]: ["Fang"],
	[SpeciesType.BEAR]: ["Claw"],
	[SpeciesType.DRAGON]: ["Hoard"],
	[SpeciesType.BOAR]: ["Tusk"],
	[SpeciesType.EAGLE]: ["Talon"],
	[SpeciesType.MAMMOTH]: ["Ivory"]
};
var CURRENCY_SUFFIXES = [
	"mark",
	"crown",
	"denar",
	"talent",
	"shilling",
	"florin",
	"ducat",
	"stater"
];
var CURRENCY_SYMBOLS = [
	"₳",
	"₡",
	"₢",
	"₤",
	"₥",
	"₦",
	"₩",
	"₫",
	"₭",
	"₮",
	"₰",
	"₲",
	"₴",
	"₸",
	"₼"
];
var symbolIndex = 0;
function mintCurrency(species, kingdomName, year) {
	const roots = CURRENCY_ROOTS[species] ?? ["Coin"];
	const root = rng.pick(roots);
	const suffix = rng.pick(CURRENCY_SUFFIXES);
	const symbol = CURRENCY_SYMBOLS[symbolIndex++ % CURRENCY_SYMBOLS.length];
	const realmWord = kingdomName.split(" ").pop() ?? root;
	return {
		name: rng.chance(.5) ? `${root} ${suffix}` : `${realmWord} ${suffix}`,
		symbol,
		foundedYear: year,
		value: 1,
		supply: 500,
		inflation: 0
	};
}
var MAX_PRICE_HISTORY = 120;
/**
* A single global market that all realms trade against.
* Prices move toward whatever clears supply against demand, with the base price
* acting as a gravity well so nothing runs away entirely.
*/
var WorldMarket = class {
	entries = /* @__PURE__ */ new Map();
	year = 1;
	constructor() {
		this.reset();
	}
	reset() {
		this.entries.clear();
		for (const good of ALL_GOODS) {
			const base = GOODS[good].basePrice;
			this.entries.set(good, {
				price: base,
				supply: 0,
				demand: 0,
				history: [
					base,
					base,
					base,
					base,
					base
				]
			});
		}
	}
	price(good) {
		return this.entries.get(good)?.price ?? GOODS[good].basePrice;
	}
	priceHistory(good) {
		return this.entries.get(good)?.history ?? [];
	}
	supplyOf(good) {
		return this.entries.get(good)?.supply ?? 0;
	}
	demandOf(good) {
		return this.entries.get(good)?.demand ?? 0;
	}
	/** Called by producers so the market knows what exists this year. */
	reportSupply(good, amount) {
		const entry = this.entries.get(good);
		if (entry) entry.supply += amount;
	}
	/** Called by consumers so the market knows what is wanted this year. */
	reportDemand(good, amount) {
		const entry = this.entries.get(good);
		if (entry) entry.demand += amount;
	}
	/** Value of a basket of goods at current prices. */
	valueOf(goods) {
		let total = 0;
		for (const [good, amount] of Object.entries(goods)) total += this.price(good) * amount;
		return total;
	}
	/** Settles the year: prices move, then supply and demand reset. */
	settle(year) {
		this.year = year;
		for (const good of ALL_GOODS) {
			const entry = this.entries.get(good);
			const base = GOODS[good].basePrice;
			const ratio = (entry.demand + 1) / (entry.supply + 1);
			const target = base * Math.max(.35, Math.min(3.2, Math.pow(ratio, .6)));
			entry.price += (target - entry.price) * .25;
			entry.price = Math.max(base * .3, Math.min(base * 4, entry.price));
			entry.history.push(Math.round(entry.price * 100) / 100);
			if (entry.history.length > MAX_PRICE_HISTORY) entry.history.shift();
			entry.supply = 0;
			entry.demand = 0;
		}
	}
	serialize() {
		const out = {};
		for (const [good, entry] of this.entries) out[good] = {
			price: entry.price,
			history: entry.history
		};
		return {
			year: this.year,
			entries: out
		};
	}
	deserialize(data) {
		this.reset();
		if (!data?.entries) return;
		this.year = data.year ?? 1;
		for (const [good, saved] of Object.entries(data.entries)) {
			const entry = this.entries.get(good);
			if (!entry) continue;
			entry.price = saved.price ?? entry.price;
			entry.history = saved.history ?? entry.history;
		}
	}
};
var MAX_LEDGER_HISTORY = 120;
/**
* One kingdom's economy: what it owns, what it earns, and what its money is worth.
*/
var KingdomEconomy = class {
	/** Held in the realm's own currency once minted, otherwise in raw gold. */
	treasury = 100;
	currency = null;
	/** Total value of everything produced last year. */
	gdp = 0;
	/** Value produced per citizen — drives government choices and unrest. */
	gdpPerCapita = 0;
	/** Fraction of output from factories rather than farms and mines, 0..1. */
	industrialisation = 0;
	/** 0..1 — how content the population is with its material conditions. */
	stability = .7;
	/** How unequally the wealth is spread, 0..1. Rises under capitalism. */
	inequality = .3;
	ledger = [];
	get hasCurrency() {
		return this.currency !== null;
	}
	get moneyName() {
		return this.currency?.name ?? "raw gold";
	}
	get moneySymbol() {
		return this.currency?.symbol ?? "⛁";
	}
	/** Formats an amount in this realm's money. */
	format(amount) {
		const rounded = Math.round(amount);
		return `${this.moneySymbol}${rounded.toLocaleString()}`;
	}
	/** Converts an amount of this realm's money into abstract world units. */
	toWorldValue(amount) {
		return amount * (this.currency?.value ?? 1);
	}
	/** Converts abstract world units into this realm's money. */
	fromWorldValue(worldValue) {
		const rate = this.currency?.value ?? 1;
		return rate <= 0 ? worldValue : worldValue / rate;
	}
	recordYear(entry) {
		this.ledger.push(entry);
		if (this.ledger.length > MAX_LEDGER_HISTORY) this.ledger.shift();
	}
	latest() {
		return this.ledger.length ? this.ledger[this.ledger.length - 1] : null;
	}
	/**
	* Revalues the currency. Money backed by real gold reserves and real output
	* holds its worth; money printed to cover deficits does not.
	*/
	revalue(goldReserves, output) {
		if (!this.currency) return;
		const backing = (goldReserves * 6 + output) / Math.max(1, this.currency.supply);
		const target = Math.max(.15, Math.min(4, backing));
		const previous = this.currency.value;
		this.currency.value += (target - this.currency.value) * .2;
		this.currency.inflation = previous > 0 ? (previous - this.currency.value) / previous : 0;
	}
	/** Printing money to cover a shortfall. Cheap now, expensive later. */
	printMoney(amount) {
		if (!this.currency) return;
		this.currency.supply += amount;
		this.treasury += amount;
	}
	serialize() {
		return {
			treasury: this.treasury,
			currency: this.currency,
			gdp: this.gdp,
			gdpPerCapita: this.gdpPerCapita,
			industrialisation: this.industrialisation,
			stability: this.stability,
			inequality: this.inequality,
			ledger: this.ledger
		};
	}
	deserialize(data) {
		if (!data) return;
		this.treasury = data.treasury ?? 100;
		this.currency = data.currency ?? null;
		this.gdp = data.gdp ?? 0;
		this.gdpPerCapita = data.gdpPerCapita ?? 0;
		this.industrialisation = data.industrialisation ?? 0;
		this.stability = data.stability ?? .7;
		this.inequality = data.inequality ?? .3;
		this.ledger = data.ledger ?? [];
	}
};
//#endregion
//#region src/civ/Culture.ts
function createCulturalProfile(species) {
	const profile = {
		militarism: .38,
		expansionism: .42,
		tradition: .55,
		authority: .48,
		openness: .5,
		mercantilism: .38,
		stewardship: .45,
		innovation: .42,
		collectivism: .45,
		warTrauma: .05,
		diplomaticTrust: .55,
		memories: []
	};
	switch (species) {
		case SpeciesType.LUMINI:
			profile.innovation += .25;
			profile.mercantilism += .2;
			profile.diplomaticTrust += .15;
			profile.openness += .15;
			profile.militarism -= .15;
			break;
		case SpeciesType.SYLVANII:
			profile.stewardship += .25;
			profile.innovation += .15;
			profile.openness += .1;
			profile.authority -= .15;
			profile.expansionism -= .1;
			break;
		case SpeciesType.STONEKIN:
			profile.tradition += .25;
			profile.authority += .2;
			profile.collectivism += .15;
			profile.militarism += .1;
			profile.innovation -= .15;
			break;
		case SpeciesType.EMBERKIN:
			profile.militarism += .25;
			profile.expansionism += .2;
			profile.authority += .1;
			profile.diplomaticTrust -= .2;
			profile.openness -= .15;
	}
	return normalizeCulture(profile);
}
function deserializeCulturalProfile(data, species) {
	const base = createCulturalProfile(species);
	if (!data) return base;
	return normalizeCulture({
		...base,
		...data,
		memories: Array.isArray(data.memories) ? data.memories.slice(-8) : []
	});
}
function updateCulture(profile, ctx) {
	const next = {
		...profile,
		memories: [...profile.memories]
	};
	const drift = (key, target, rate) => {
		next[key] = approach$1(next[key], target, rate);
	};
	const pressure = Math.max(ctx.externalThreat, ctx.atWar ? .85 : 0);
	const scarcity = Math.max(0, 1 - ctx.foodSecurity);
	Math.max(0, (ctx.cityCount - 4) / 7) + Math.max(0, 1 - ctx.administrativeReach);
	drift("militarism", .28 + pressure * .48 + ctx.wars * .08, .045);
	drift("expansionism", ctx.government === "empire" ? .76 : .36 + ctx.legitimacy * .18 - scarcity * .16, .028);
	drift("tradition", ctx.legitimacy > .62 ? .66 : .42 - Math.max(0, .45 - ctx.legitimacy) * .35, .025);
	drift("authority", authorityTarget(ctx), .035);
	drift("openness", opennessTarget(ctx, pressure), .03);
	drift("mercantilism", ctx.tradeDependency * .75 + (ctx.economy === "market" || ctx.economy === "mercantile" ? .22 : .08), .04);
	drift("stewardship", .34 + ctx.prosperity * .22 + scarcity * .18 - industrialPressure(ctx), .025);
	drift("innovation", innovationTarget(ctx), .032);
	drift("collectivism", collectivismTarget(ctx), .035);
	drift("warTrauma", ctx.atWar ? .35 + ctx.wars * .16 : .06, ctx.atWar ? .05 : .018);
	drift("diplomaticTrust", ctx.atWar ? .24 : .48 + ctx.tradeDependency * .24 + ctx.stability * .14, .03);
	if (ctx.famineYears > 0) {
		next.collectivism = clamp01$2(next.collectivism + .015 * ctx.famineYears);
		next.openness = clamp01$2(next.openness - .01 * ctx.famineYears);
		maybeRemember(next, "famine", ctx.year, Math.min(1, ctx.famineYears / 4), "Famine years hardened public memory.");
	}
	if (ctx.atWar && ctx.wars > 0) maybeRemember(next, "war", ctx.year, Math.min(1, ctx.wars / 3 + ctx.externalThreat * .35), "A generation was shaped by war.");
	if (!ctx.atWar && ctx.stability > .72 && ctx.foodSecurity > .7 && ctx.prosperity > .62) maybeRemember(next, "golden_age", ctx.year, Math.min(1, ctx.stability), "Prosperity made this era feel legitimate.");
	if (ctx.tradeDependency > .42 && !ctx.atWar) maybeRemember(next, "trade_boom", ctx.year, ctx.tradeDependency, "Trade routes became part of public life.");
	if (ctx.recentGovernmentChange) maybeRemember(next, "revolution", ctx.year, Math.max(.3, 1 - ctx.legitimacy), "The old order changed within living memory.");
	next.memories = next.memories.filter((memory) => ctx.year - memory.year <= 80).sort((a, b) => b.year - a.year).slice(0, 8);
	return normalizeCulture(next);
}
function rememberCulture(profile, kind, year, intensity, label) {
	maybeRemember(profile, kind, year, intensity, label, true);
}
function culturalAffinity(a, b) {
	return clamp01$2(1 - (Math.abs(a.militarism - b.militarism) * .8 + Math.abs(a.expansionism - b.expansionism) * .7 + Math.abs(a.tradition - b.tradition) * .55 + Math.abs(a.authority - b.authority) * .55 + Math.abs(a.openness - b.openness) * .9 + Math.abs(a.mercantilism - b.mercantilism) * .5 + Math.abs(a.stewardship - b.stewardship) * .35 + Math.abs(a.innovation - b.innovation) * .45 + Math.abs(a.collectivism - b.collectivism) * .45) / 4.7);
}
function normalizeCulture(profile) {
	for (const key of [
		"militarism",
		"expansionism",
		"tradition",
		"authority",
		"openness",
		"mercantilism",
		"stewardship",
		"innovation",
		"collectivism",
		"warTrauma",
		"diplomaticTrust"
	]) profile[key] = clamp01$2(profile[key] ?? .5);
	profile.memories = profile.memories ?? [];
	return profile;
}
function maybeRemember(profile, kind, year, intensity, label, force = false) {
	if (!force) {
		const last = profile.memories.find((memory) => memory.kind === kind);
		if (last && year - last.year < 12) return;
		if (intensity < .35) return;
	}
	profile.memories.unshift({
		kind,
		year,
		intensity: clamp01$2(intensity),
		label
	});
}
function authorityTarget(ctx) {
	if (ctx.government === "empire" || ctx.government === "monarchy" || ctx.government === "communist_state") return .68 + ctx.externalThreat * .16;
	if (ctx.government === "republic" || ctx.government === "capitalist_state") return .34 + Math.max(0, .45 - ctx.stability) * .35;
	return .5 + ctx.externalThreat * .16;
}
function opennessTarget(ctx, pressure) {
	return .42 + (ctx.tradeDependency * .5 + (ctx.economy === "market" || ctx.economy === "mercantile" ? .2 : 0)) - pressure * .28 - Math.max(0, .45 - ctx.foodSecurity) * .2;
}
function innovationTarget(ctx) {
	const marketPull = ctx.economy === "market" ? .28 : ctx.economy === "planned" ? .18 : .08;
	const crisisPull = Math.max(0, .5 - ctx.stability) * .28;
	const traditionDrag = ctx.government === "feudal_kingdom" || ctx.government === "monarchy" ? .08 : 0;
	return .38 + marketPull + crisisPull - traditionDrag;
}
function collectivismTarget(ctx) {
	if (ctx.economy === "planned") return .72 + Math.max(0, .55 - ctx.foodSecurity) * .12;
	if (ctx.economy === "market") return .36 + Math.max(0, .45 - ctx.stability) * .24;
	return .48 + Math.max(0, .5 - ctx.foodSecurity) * .26;
}
function industrialPressure(ctx) {
	return ctx.economy === "market" || ctx.economy === "planned" ? .12 : 0;
}
function approach$1(current, target, rate) {
	return clamp01$2(current + (clamp01$2(target) - current) * rate);
}
function clamp01$2(value) {
	return Math.max(0, Math.min(1, value));
}
//#endregion
//#region src/civ/Society.ts
var SOCIAL_FACTION_ORDER = [
	"peasants",
	"nobles",
	"merchants",
	"military",
	"workers",
	"clergy_scholars",
	"frontier",
	"bureaucrats",
	"reformists"
];
var SOCIAL_FACTIONS = {
	peasants: {
		id: "peasants",
		name: "Peasants",
		shortName: "Peasants",
		color: "#84cc16",
		description: "Farmers, herders and village households who carry food production and tax burden.",
		supports: [
			"tribe",
			"chiefdom",
			"republic",
			"communist_state"
		],
		resists: ["empire", "capitalist_state"]
	},
	nobles: {
		id: "nobles",
		name: "Nobles",
		shortName: "Nobles",
		color: "#c084fc",
		description: "Old landholders, dynasts and warrior families who want privilege and continuity.",
		supports: [
			"feudal_kingdom",
			"monarchy",
			"empire",
			"constitutional_monarchy"
		],
		resists: ["republic", "communist_state"]
	},
	merchants: {
		id: "merchants",
		name: "Merchants",
		shortName: "Merchants",
		color: "#f59e0b",
		description: "Caravan owners, moneylenders, port families and market elites.",
		supports: [
			"monarchy",
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		],
		resists: ["tribe", "communist_state"]
	},
	military: {
		id: "military",
		name: "Military",
		shortName: "Military",
		color: "#ef4444",
		description: "Soldiers, officers, veterans and frontier commanders who care about security and prestige.",
		supports: [
			"chiefdom",
			"feudal_kingdom",
			"monarchy",
			"empire",
			"communist_state"
		],
		resists: ["republic"]
	},
	workers: {
		id: "workers",
		name: "Workers",
		shortName: "Workers",
		color: "#38bdf8",
		description: "Craftspeople, builders, miners and industrial workers created by urban production.",
		supports: [
			"republic",
			"capitalist_state",
			"communist_state"
		],
		resists: ["feudal_kingdom", "empire"]
	},
	clergy_scholars: {
		id: "clergy_scholars",
		name: "Clergy and Scholars",
		shortName: "Scholars",
		color: "#a78bfa",
		description: "Ritual authorities, teachers, chroniclers and researchers who shape legitimacy.",
		supports: [
			"tribe",
			"monarchy",
			"constitutional_monarchy",
			"republic"
		],
		resists: ["capitalist_state"]
	},
	frontier: {
		id: "frontier",
		name: "Frontier Settlers",
		shortName: "Frontier",
		color: "#14b8a6",
		description: "Colonists, border villages and distant towns who want land, protection and autonomy.",
		supports: [
			"tribe",
			"chiefdom",
			"republic",
			"empire"
		],
		resists: ["communist_state"]
	},
	bureaucrats: {
		id: "bureaucrats",
		name: "Bureaucrats",
		shortName: "Bureaucrats",
		color: "#64748b",
		description: "Tax collectors, judges, clerks and governors who turn law into administration.",
		supports: [
			"monarchy",
			"empire",
			"constitutional_monarchy",
			"communist_state"
		],
		resists: ["tribe"]
	},
	reformists: {
		id: "reformists",
		name: "Reformists",
		shortName: "Reformists",
		color: "#22c55e",
		description: "Dissidents, pamphleteers, radicals and civic movements who want institutional change.",
		supports: [
			"constitutional_monarchy",
			"republic",
			"communist_state"
		],
		resists: ["feudal_kingdom", "empire"]
	}
};
function createSocietyProfile(government = "tribe") {
	const factions = {};
	for (const id of SOCIAL_FACTION_ORDER) factions[id] = {
		id,
		influence: baseInfluence(id, government),
		satisfaction: .58,
		wealth: baseWealth(id, government),
		loyalty: .58,
		radicalization: .08,
		warSupport: id === "military" ? .55 : .28,
		reformSupport: id === "reformists" ? .62 : .24
	};
	return recomputeSociety({
		factions,
		cohesion: .58,
		reformPressure: .12,
		coupRisk: .03,
		revoltRisk: .03,
		warPressure: .22,
		peacePressure: .28,
		dominantFaction: "peasants",
		lastUnrestYear: 0
	});
}
function deserializeSocietyProfile(data, government = "tribe") {
	const base = createSocietyProfile(government);
	if (!data?.factions) return base;
	for (const id of SOCIAL_FACTION_ORDER) base.factions[id] = normalizeFaction({
		...base.factions[id],
		...data.factions[id] ?? {},
		id
	});
	base.lastUnrestYear = data.lastUnrestYear ?? 0;
	return recomputeSociety(base);
}
function updateSociety(profile, ctx) {
	const next = {
		...profile,
		factions: { ...profile.factions }
	};
	for (const id of SOCIAL_FACTION_ORDER) {
		const current = normalizeFaction(profile.factions[id] ?? createSocietyProfile(ctx.government).factions[id]);
		const targets = factionTargets(id, current, ctx);
		next.factions[id] = normalizeFaction({
			id,
			influence: approach(current.influence, targets.influence, .08),
			satisfaction: approach(current.satisfaction, targets.satisfaction, .22),
			wealth: approach(current.wealth, targets.wealth, .16),
			loyalty: approach(current.loyalty, targets.loyalty, .2),
			radicalization: approach(current.radicalization, targets.radicalization, .18),
			warSupport: approach(current.warSupport, targets.warSupport, .18),
			reformSupport: approach(current.reformSupport, targets.reformSupport, .18)
		});
	}
	next.lastUnrestYear = profile.lastUnrestYear ?? 0;
	return recomputeSociety(next);
}
function factionTargets(id, current, ctx) {
	const supported = SOCIAL_FACTIONS[id].supports.includes(ctx.government);
	const resisted = SOCIAL_FACTIONS[id].resists.includes(ctx.government);
	const taxPain = clamp01$1((ctx.taxRate - .16) / .34);
	const faminePain = clamp01$1(1 - ctx.foodSecurity + ctx.famineYears * .12);
	const warPain = clamp01$1(ctx.warWeariness / 100 + (ctx.atWar ? .22 : 0));
	const adminPain = clamp01$1(1 - ctx.administrativeReach);
	const inequalityPain = ctx.inequality;
	const govFit = supported ? .12 : resisted ? -.16 : 0;
	let influence = baseInfluence(id, ctx.government);
	let satisfaction = .48 + govFit + ctx.stability * .16 + ctx.legitimacy * .12;
	let wealth = current.wealth;
	let loyalty = .44 + ctx.legitimacy * .24 + ctx.stability * .16 + govFit;
	let warSupport = .22 + ctx.externalThreat * .25 + ctx.culture.militarism * .18;
	let reformSupport = .2 + ctx.culture.innovation * .18 + Math.max(0, .52 - ctx.stability) * .3;
	switch (id) {
		case "peasants":
			influence += .08 - ctx.industrialisation * .08;
			satisfaction += ctx.foodSecurity * .28 + ctx.prosperity * .16 - taxPain * .22 - warPain * .12;
			wealth = .28 + ctx.prosperity * .22 + ctx.foodSecurity * .16 - taxPain * .18 - inequalityPain * .08;
			warSupport -= .22 + faminePain * .18;
			reformSupport += faminePain * .2 + taxPain * .14;
			break;
		case "nobles":
			influence += ctx.culture.tradition * .08 + (ctx.government === "feudal_kingdom" || ctx.government === "monarchy" ? .12 : 0);
			satisfaction += ctx.culture.tradition * .16 + inequalityPain * .12 + ctx.legitimacy * .08 - (ctx.government === "communist_state" ? .32 : 0);
			wealth = .5 + inequalityPain * .28 + (ctx.economy === "tributary" || ctx.economy === "mercantile" ? .12 : 0);
			warSupport += ctx.culture.expansionism * .22;
			reformSupport -= .16;
			break;
		case "merchants":
			influence += ctx.tradeDependency * .18 + (ctx.economy === "market" || ctx.economy === "mercantile" ? .12 : -.05);
			satisfaction += ctx.tradeDependency * .3 + ctx.culture.openness * .14 + ctx.stability * .12 - warPain * .22 - taxPain * .12;
			wealth = .35 + ctx.tradeDependency * .34 + (ctx.economy === "market" ? .18 : 0) - warPain * .12;
			warSupport -= .2 + ctx.tradeDependency * .18;
			reformSupport += ctx.culture.openness * .12;
			break;
		case "military":
			influence += ctx.externalThreat * .18 + (ctx.atWar ? .16 : 0) + ctx.culture.militarism * .1;
			satisfaction += ctx.externalThreat * .12 + ctx.culture.militarism * .16 + (ctx.atWar ? .08 : -.04) - ctx.warWeariness * .002;
			wealth = .32 + ctx.externalThreat * .2 + (ctx.atWar ? .12 : 0);
			warSupport += .32 + ctx.culture.militarism * .18 - ctx.culture.warTrauma * .16;
			reformSupport += Math.max(0, .42 - ctx.legitimacy) * .16;
			break;
		case "workers":
			influence += ctx.industrialisation * .22 + Math.max(0, ctx.cityCount - 2) * .015;
			satisfaction += ctx.industrialisation * .08 + ctx.foodSecurity * .12 - inequalityPain * .26 - taxPain * .08;
			wealth = .3 + ctx.industrialisation * .2 + (ctx.economy === "planned" ? .12 : 0) - inequalityPain * .18;
			warSupport -= .12 + warPain * .14;
			reformSupport += inequalityPain * .28 + ctx.industrialisation * .12;
			break;
		case "clergy_scholars":
			influence += (ctx.culture.tradition + ctx.culture.innovation) * .05 + ctx.legitimacy * .04;
			satisfaction += ctx.legitimacy * .2 + ctx.culture.tradition * .1 + ctx.culture.innovation * .08 - warPain * .08;
			wealth = .34 + ctx.gdpPerCapita / 80 + ctx.legitimacy * .08;
			warSupport -= ctx.culture.diplomaticTrust * .12;
			reformSupport += ctx.culture.innovation * .14;
			break;
		case "frontier":
			influence += Math.max(0, ctx.cityCount - 1) * .025 + adminPain * .18 + ctx.culture.expansionism * .08;
			satisfaction += ctx.foodSecurity * .12 + ctx.culture.expansionism * .14 - adminPain * .18 - ctx.externalThreat * .12;
			wealth = .28 + ctx.prosperity * .16 + ctx.culture.expansionism * .08 - adminPain * .08;
			warSupport += ctx.externalThreat * .22 + ctx.culture.expansionism * .12;
			reformSupport += adminPain * .22;
			break;
		case "bureaucrats":
			influence += ctx.culture.authority * .14 + (ctx.government === "empire" || ctx.government === "communist_state" ? .14 : 0);
			satisfaction += ctx.administrativeReach * .2 + ctx.culture.authority * .12 + ctx.legitimacy * .1 - (ctx.stability < .35 ? .12 : 0);
			wealth = .36 + ctx.taxRate * .35 + ctx.administrativeReach * .12;
			warSupport += ctx.culture.authority * .08;
			reformSupport -= .08;
			break;
		case "reformists":
			influence += ctx.culture.innovation * .12 + ctx.culture.openness * .1 + Math.max(0, .55 - ctx.stability) * .16;
			satisfaction += ctx.culture.openness * .12 + ctx.culture.innovation * .1 - ctx.culture.authority * .12 - Math.max(0, .55 - ctx.legitimacy) * .18;
			wealth = .26 + ctx.gdpPerCapita / 90 + ctx.culture.innovation * .08;
			warSupport -= .18 + ctx.culture.diplomaticTrust * .08;
			reformSupport += .38 + ctx.culture.innovation * .18 + Math.max(0, .58 - ctx.legitimacy) * .22;
	}
	satisfaction -= faminePain * .22;
	satisfaction -= warPain * (id === "military" ? .06 : .12);
	influence += ctx.laws?.factionInfluence?.[id] ?? 0;
	satisfaction += ctx.laws?.factionSatisfaction?.[id] ?? 0;
	loyalty += ctx.laws?.factionLoyalty?.[id] ?? 0;
	warSupport += ctx.laws?.factionWarSupport?.[id] ?? 0;
	reformSupport += ctx.laws?.factionReformSupport?.[id] ?? 0;
	reformSupport += ctx.laws?.reformPressure ?? 0;
	loyalty += satisfaction * .24 - Math.max(0, .45 - satisfaction) * .28;
	const radicalization = Math.max(0, .08 + Math.max(0, .52 - satisfaction) * .75 + Math.max(0, .46 - loyalty) * .32 + faminePain * .18 + (ctx.laws?.revoltRisk ?? 0) + (resisted ? .06 : 0));
	return {
		influence: clamp01$1(influence),
		satisfaction: clamp01$1(satisfaction),
		wealth: clamp01$1(wealth),
		loyalty: clamp01$1(loyalty),
		radicalization: clamp01$1(radicalization),
		warSupport: clamp01$1(warSupport),
		reformSupport: clamp01$1(reformSupport)
	};
}
function recomputeSociety(profile) {
	let influenceTotal = 0;
	let cohesion = 0;
	let reformPressure = 0;
	let revoltRisk = 0;
	let warPressure = 0;
	let peacePressure = 0;
	let dominant = "peasants";
	for (const id of SOCIAL_FACTION_ORDER) {
		const f = normalizeFaction(profile.factions[id]);
		profile.factions[id] = f;
		influenceTotal += f.influence;
		if (f.influence > profile.factions[dominant].influence) dominant = id;
	}
	for (const id of SOCIAL_FACTION_ORDER) {
		const f = profile.factions[id];
		const weight = f.influence / Math.max(.01, influenceTotal);
		cohesion += (f.satisfaction * .48 + f.loyalty * .42 + (1 - f.radicalization) * .1) * weight;
		reformPressure += f.reformSupport * f.radicalization * weight;
		revoltRisk += Math.max(0, .56 - f.satisfaction) * f.radicalization * weight;
		warPressure += f.warSupport * weight;
		peacePressure += (1 - f.warSupport) * Math.max(.2, 1 - f.satisfaction * .45) * weight;
	}
	const military = profile.factions.military;
	const nobles = profile.factions.nobles;
	profile.cohesion = clamp01$1(cohesion);
	profile.reformPressure = clamp01$1(reformPressure * 1.45);
	profile.revoltRisk = clamp01$1(revoltRisk * 2.1);
	profile.warPressure = clamp01$1(warPressure);
	profile.peacePressure = clamp01$1(peacePressure);
	profile.coupRisk = clamp01$1(military.influence * military.radicalization * (1 - military.loyalty) * 1.4 + nobles.influence * nobles.radicalization * Math.max(0, .55 - nobles.loyalty) * .75);
	profile.dominantFaction = dominant;
	return profile;
}
function baseInfluence(id, government) {
	let value = {
		peasants: .26,
		nobles: .12,
		merchants: .08,
		military: .12,
		workers: .06,
		clergy_scholars: .1,
		frontier: .1,
		bureaucrats: .08,
		reformists: .08
	}[id];
	if (government === "tribe") {
		if (id === "peasants" || id === "frontier") value += .08;
		if (id === "bureaucrats" || id === "merchants" || id === "workers") value -= .04;
	}
	if (government === "feudal_kingdom" || government === "monarchy") {
		if (id === "nobles") value += .12;
		if (id === "clergy_scholars") value += .04;
	}
	if (government === "empire") {
		if (id === "military" || id === "bureaucrats") value += .1;
		if (id === "frontier") value += .04;
	}
	if (government === "republic" || government === "constitutional_monarchy") {
		if (id === "merchants" || id === "reformists") value += .08;
		if (id === "nobles") value -= .04;
	}
	if (government === "capitalist_state") {
		if (id === "merchants") value += .16;
		if (id === "workers") value += .08;
	}
	if (government === "communist_state") {
		if (id === "workers" || id === "bureaucrats" || id === "military") value += .1;
		if (id === "nobles" || id === "merchants") value -= .08;
	}
	return clamp01$1(value);
}
function baseWealth(id, government) {
	let value = {
		peasants: .32,
		nobles: .6,
		merchants: .45,
		military: .34,
		workers: .3,
		clergy_scholars: .36,
		frontier: .28,
		bureaucrats: .38,
		reformists: .26
	}[id];
	if (government === "capitalist_state" && id === "merchants") value += .18;
	if (government === "communist_state" && (id === "peasants" || id === "workers")) value += .08;
	if (government === "feudal_kingdom" && id === "nobles") value += .12;
	return clamp01$1(value);
}
function normalizeFaction(faction) {
	return {
		id: faction.id,
		influence: clamp01$1(faction.influence ?? .1),
		satisfaction: clamp01$1(faction.satisfaction ?? .55),
		wealth: clamp01$1(faction.wealth ?? .35),
		loyalty: clamp01$1(faction.loyalty ?? .55),
		radicalization: clamp01$1(faction.radicalization ?? .08),
		warSupport: clamp01$1(faction.warSupport ?? .3),
		reformSupport: clamp01$1(faction.reformSupport ?? .25)
	};
}
function approach(current, target, rate) {
	return clamp01$1(current + (clamp01$1(target) - current) * rate);
}
function clamp01$1(value) {
	return Math.max(0, Math.min(1, value));
}
//#endregion
//#region src/civ/Laws.ts
var LAW_CATEGORY_ORDER = [
	"taxation",
	"land",
	"trade",
	"military",
	"rights",
	"administration",
	"labor",
	"knowledge",
	"ecology"
];
var LAWS = {
	subsistence_levies: {
		id: "subsistence_levies",
		category: "taxation",
		name: "Subsistence Levies",
		shortName: "Low levies",
		description: "The crown takes little and leaves most production in village hands.",
		favours: ["peasants", "frontier"],
		angers: ["bureaucrats", "military"],
		effects: {
			taxMultiplier: -.28,
			stability: .02,
			factionSatisfaction: {
				peasants: .08,
				frontier: .04,
				bureaucrats: -.04,
				military: -.03
			},
			factionInfluence: { peasants: .04 }
		}
	},
	royal_tithe: {
		id: "royal_tithe",
		category: "taxation",
		name: "Royal Tithe",
		shortName: "Tithe",
		description: "A predictable levy funds the court without fully squeezing the countryside.",
		favours: ["bureaucrats", "nobles"],
		angers: [],
		effects: {
			taxMultiplier: 0,
			legitimacy: .01,
			factionLoyalty: {
				bureaucrats: .03,
				nobles: .02
			}
		}
	},
	war_taxes: {
		id: "war_taxes",
		category: "taxation",
		name: "War Taxes",
		shortName: "War taxes",
		description: "Extraordinary taxation keeps armies supplied and civilians angry.",
		favours: ["military", "bureaucrats"],
		angers: [
			"peasants",
			"merchants",
			"workers"
		],
		effects: {
			taxMultiplier: .34,
			military: .08,
			stability: -.04,
			factionSatisfaction: {
				military: .08,
				peasants: -.09,
				merchants: -.08,
				workers: -.06
			},
			factionWarSupport: { military: .08 }
		}
	},
	progressive_tax: {
		id: "progressive_tax",
		category: "taxation",
		name: "Progressive Taxation",
		shortName: "Progressive tax",
		description: "The wealthy pay more, reducing inequality while angering old privilege.",
		favours: [
			"peasants",
			"workers",
			"reformists"
		],
		angers: ["nobles", "merchants"],
		effects: {
			taxMultiplier: .08,
			inequality: -.08,
			reformPressure: -.03,
			factionSatisfaction: {
				peasants: .06,
				workers: .07,
				reformists: .08,
				nobles: -.08,
				merchants: -.04
			},
			factionReformSupport: { reformists: -.04 }
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state",
			"communist_state"
		]
	},
	common_lands: {
		id: "common_lands",
		category: "land",
		name: "Common Lands",
		shortName: "Commons",
		description: "Villages retain shared fields, forests and grazing rights.",
		favours: ["peasants", "frontier"],
		angers: ["nobles"],
		effects: {
			foodSecurity: .04,
			expansion: -1,
			factionSatisfaction: {
				peasants: .07,
				frontier: .04,
				nobles: -.04
			},
			factionInfluence: { peasants: .04 }
		}
	},
	noble_estates: {
		id: "noble_estates",
		category: "land",
		name: "Noble Estates",
		shortName: "Estates",
		description: "Land is held through noble privilege and inherited obligation.",
		favours: ["nobles", "military"],
		angers: ["peasants", "reformists"],
		effects: {
			military: .04,
			legitimacy: .03,
			inequality: .08,
			factionSatisfaction: {
				nobles: .09,
				military: .03,
				peasants: -.05,
				reformists: -.08
			},
			factionInfluence: { nobles: .08 }
		}
	},
	land_redistribution: {
		id: "land_redistribution",
		category: "land",
		name: "Land Redistribution",
		shortName: "Land reform",
		description: "Old estates are broken up and redistributed to households and communes.",
		favours: [
			"peasants",
			"workers",
			"reformists"
		],
		angers: ["nobles"],
		effects: {
			foodSecurity: .06,
			inequality: -.12,
			legitimacy: -.02,
			factionSatisfaction: {
				peasants: .1,
				workers: .05,
				reformists: .08,
				nobles: -.18
			},
			factionInfluence: {
				nobles: -.08,
				peasants: .05
			}
		},
		governments: ["republic", "communist_state"]
	},
	frontier_homesteads: {
		id: "frontier_homesteads",
		category: "land",
		name: "Frontier Homesteads",
		shortName: "Homesteads",
		description: "Settlers receive legal title for claiming and defending new land.",
		favours: ["frontier", "peasants"],
		angers: ["bureaucrats", "nobles"],
		effects: {
			expansion: 6,
			administrativeReach: -.02,
			factionSatisfaction: {
				frontier: .1,
				peasants: .03,
				bureaucrats: -.04,
				nobles: -.03
			},
			factionInfluence: { frontier: .08 }
		}
	},
	closed_markets: {
		id: "closed_markets",
		category: "trade",
		name: "Closed Markets",
		shortName: "Closed markets",
		description: "Foreign trade is restricted to protect custom and local supply.",
		favours: ["peasants", "bureaucrats"],
		angers: ["merchants", "reformists"],
		effects: {
			trade: -.16,
			foodSecurity: .02,
			factionSatisfaction: {
				peasants: .02,
				bureaucrats: .03,
				merchants: -.1,
				reformists: -.03
			},
			factionWarSupport: { merchants: -.05 }
		}
	},
	chartered_companies: {
		id: "chartered_companies",
		category: "trade",
		name: "Chartered Companies",
		shortName: "Charters",
		description: "Favoured merchant houses receive monopolies in exchange for crown revenue.",
		favours: ["merchants", "bureaucrats"],
		angers: ["workers", "peasants"],
		effects: {
			taxMultiplier: .08,
			trade: .12,
			inequality: .06,
			factionSatisfaction: {
				merchants: .1,
				bureaucrats: .04,
				workers: -.03,
				peasants: -.02
			},
			factionInfluence: { merchants: .08 }
		}
	},
	free_trade: {
		id: "free_trade",
		category: "trade",
		name: "Free Trade",
		shortName: "Free trade",
		description: "Borders open to caravans, ports and foreign goods.",
		favours: ["merchants", "reformists"],
		angers: ["nobles"],
		effects: {
			trade: .18,
			research: .04,
			inequality: .04,
			factionSatisfaction: {
				merchants: .12,
				reformists: .04,
				peasants: .02,
				nobles: -.04
			},
			factionInfluence: { merchants: .08 },
			factionWarSupport: { merchants: -.08 }
		},
		governments: [
			"monarchy",
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		]
	},
	strategic_tariffs: {
		id: "strategic_tariffs",
		category: "trade",
		name: "Strategic Tariffs",
		shortName: "Tariffs",
		description: "The state protects key workshops and taxes cross-border trade.",
		favours: ["workers", "bureaucrats"],
		angers: ["merchants"],
		effects: {
			taxMultiplier: .12,
			production: .05,
			trade: -.06,
			factionSatisfaction: {
				workers: .05,
				bureaucrats: .04,
				merchants: -.06
			}
		}
	},
	citizen_militia: {
		id: "citizen_militia",
		category: "military",
		name: "Citizen Militia",
		shortName: "Militia",
		description: "Villages defend themselves with irregular local forces.",
		favours: ["peasants", "frontier"],
		angers: ["military"],
		effects: {
			military: -.03,
			stability: .02,
			factionSatisfaction: {
				peasants: .03,
				frontier: .04,
				military: -.05
			},
			factionInfluence: { military: -.04 }
		}
	},
	professional_army: {
		id: "professional_army",
		category: "military",
		name: "Professional Army",
		shortName: "Army",
		description: "A trained standing army answers to the state.",
		favours: ["military", "bureaucrats"],
		angers: ["peasants"],
		effects: {
			military: .1,
			taxMultiplier: .08,
			factionSatisfaction: {
				military: .1,
				bureaucrats: .03,
				peasants: -.03
			},
			factionInfluence: { military: .07 }
		}
	},
	mass_conscription: {
		id: "mass_conscription",
		category: "military",
		name: "Mass Conscription",
		shortName: "Conscription",
		description: "Every household owes bodies to the army in wartime.",
		favours: ["military"],
		angers: [
			"peasants",
			"workers",
			"merchants"
		],
		effects: {
			military: .18,
			production: -.06,
			stability: -.05,
			factionSatisfaction: {
				military: .11,
				peasants: -.12,
				workers: -.08,
				merchants: -.05
			},
			factionWarSupport: {
				peasants: -.08,
				workers: -.06
			}
		},
		governments: [
			"empire",
			"communist_state",
			"republic",
			"monarchy"
		]
	},
	defensive_doctrine: {
		id: "defensive_doctrine",
		category: "military",
		name: "Defensive Doctrine",
		shortName: "Defense",
		description: "The army is built around fortification, deterrence and limited wars.",
		favours: [
			"peasants",
			"merchants",
			"frontier"
		],
		angers: ["military"],
		effects: {
			military: .04,
			stability: .03,
			factionSatisfaction: {
				peasants: .04,
				merchants: .04,
				frontier: .05,
				military: -.03
			},
			factionWarSupport: {
				military: -.06,
				merchants: -.04
			}
		}
	},
	customary_rights: {
		id: "customary_rights",
		category: "rights",
		name: "Customary Rights",
		shortName: "Custom",
		description: "Rights are local, unwritten and rooted in long memory.",
		favours: ["peasants", "clergy_scholars"],
		angers: ["reformists", "bureaucrats"],
		effects: {
			stability: .02,
			research: -.02,
			factionSatisfaction: {
				peasants: .03,
				clergy_scholars: .03,
				reformists: -.04,
				bureaucrats: -.03
			}
		}
	},
	noble_privileges: {
		id: "noble_privileges",
		category: "rights",
		name: "Noble Privileges",
		shortName: "Privileges",
		description: "The law openly protects aristocratic status and hereditary exemptions.",
		favours: ["nobles", "military"],
		angers: [
			"peasants",
			"workers",
			"reformists"
		],
		effects: {
			legitimacy: .04,
			inequality: .1,
			reformPressure: .05,
			factionSatisfaction: {
				nobles: .11,
				military: .03,
				peasants: -.05,
				workers: -.06,
				reformists: -.1
			},
			factionInfluence: { nobles: .09 }
		}
	},
	civic_rights: {
		id: "civic_rights",
		category: "rights",
		name: "Civic Rights",
		shortName: "Civic rights",
		description: "Subjects gain predictable legal standing and protected civic voice.",
		favours: [
			"merchants",
			"workers",
			"reformists",
			"clergy_scholars"
		],
		angers: ["nobles", "military"],
		effects: {
			legitimacy: .04,
			research: .04,
			reformPressure: -.06,
			factionSatisfaction: {
				merchants: .06,
				workers: .06,
				reformists: .08,
				clergy_scholars: .05,
				nobles: -.06,
				military: -.03
			},
			factionLoyalty: {
				reformists: .08,
				workers: .04
			}
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		]
	},
	emergency_powers: {
		id: "emergency_powers",
		category: "rights",
		name: "Emergency Powers",
		shortName: "Emergency",
		description: "Civil life bends to security, censorship and rapid executive command.",
		favours: ["military", "bureaucrats"],
		angers: [
			"reformists",
			"merchants",
			"clergy_scholars"
		],
		effects: {
			administrativeReach: .06,
			military: .07,
			stability: -.03,
			reformPressure: .08,
			factionSatisfaction: {
				military: .08,
				bureaucrats: .05,
				reformists: -.14,
				merchants: -.05,
				clergy_scholars: -.06
			},
			factionInfluence: {
				military: .05,
				bureaucrats: .05
			}
		}
	},
	village_autonomy: {
		id: "village_autonomy",
		category: "administration",
		name: "Village Autonomy",
		shortName: "Autonomy",
		description: "Local elders and towns settle most affairs without the capital.",
		favours: ["peasants", "frontier"],
		angers: ["bureaucrats"],
		effects: {
			administrativeReach: -.08,
			stability: .04,
			revoltRisk: -.03,
			factionSatisfaction: {
				peasants: .05,
				frontier: .08,
				bureaucrats: -.08
			},
			factionInfluence: { frontier: .04 }
		}
	},
	royal_bureaucracy: {
		id: "royal_bureaucracy",
		category: "administration",
		name: "Royal Bureaucracy",
		shortName: "Bureaucracy",
		description: "Written offices, clerks and governors bind towns to the treasury.",
		favours: ["bureaucrats", "merchants"],
		angers: ["frontier"],
		effects: {
			administrativeReach: .1,
			taxMultiplier: .08,
			factionSatisfaction: {
				bureaucrats: .08,
				merchants: .03,
				frontier: -.05
			},
			factionInfluence: { bureaucrats: .08 }
		}
	},
	imperial_governors: {
		id: "imperial_governors",
		category: "administration",
		name: "Imperial Governors",
		shortName: "Governors",
		description: "Appointed governors extract tribute and obedience from far provinces.",
		favours: ["bureaucrats", "military"],
		angers: [
			"frontier",
			"peasants",
			"reformists"
		],
		effects: {
			administrativeReach: .16,
			taxMultiplier: .12,
			stability: -.03,
			factionSatisfaction: {
				bureaucrats: .09,
				military: .04,
				frontier: -.12,
				peasants: -.04,
				reformists: -.05
			},
			factionInfluence: {
				bureaucrats: .1,
				frontier: .04
			}
		},
		governments: [
			"empire",
			"monarchy",
			"communist_state"
		]
	},
	federal_charters: {
		id: "federal_charters",
		category: "administration",
		name: "Federal Charters",
		shortName: "Federalism",
		description: "Provincial rights are written down to keep distant cities inside the realm.",
		favours: [
			"frontier",
			"merchants",
			"reformists"
		],
		angers: ["bureaucrats", "nobles"],
		effects: {
			administrativeReach: .04,
			stability: .05,
			revoltRisk: -.06,
			factionSatisfaction: {
				frontier: .12,
				merchants: .04,
				reformists: .05,
				bureaucrats: -.04,
				nobles: -.03
			}
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		]
	},
	guild_customs: {
		id: "guild_customs",
		category: "labor",
		name: "Guild Customs",
		shortName: "Guilds",
		description: "Craft labour is organised through guild rules and inherited mastery.",
		favours: ["workers", "clergy_scholars"],
		angers: ["merchants"],
		effects: {
			production: .03,
			research: .01,
			factionSatisfaction: {
				workers: .05,
				clergy_scholars: .03,
				merchants: -.03
			},
			factionInfluence: { workers: .03 }
		}
	},
	free_labor: {
		id: "free_labor",
		category: "labor",
		name: "Free Labour Markets",
		shortName: "Free labour",
		description: "Workers sell labour freely while employers set wages through markets.",
		favours: ["merchants"],
		angers: ["workers", "reformists"],
		effects: {
			production: .08,
			trade: .05,
			inequality: .08,
			factionSatisfaction: {
				merchants: .07,
				workers: -.07,
				reformists: -.05
			},
			factionInfluence: {
				merchants: .04,
				workers: .03
			}
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		]
	},
	labor_protections: {
		id: "labor_protections",
		category: "labor",
		name: "Labour Protections",
		shortName: "Labour rights",
		description: "Guilds and workers gain legal protection from exhaustion and hunger wages.",
		favours: [
			"workers",
			"reformists",
			"peasants"
		],
		angers: ["merchants"],
		effects: {
			production: -.02,
			inequality: -.08,
			stability: .04,
			factionSatisfaction: {
				workers: .12,
				reformists: .07,
				peasants: .03,
				merchants: -.06
			},
			factionLoyalty: { workers: .06 }
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state",
			"communist_state"
		]
	},
	state_labor_duty: {
		id: "state_labor_duty",
		category: "labor",
		name: "State Labour Duty",
		shortName: "Labour duty",
		description: "The state assigns labour to strategic works, mines and foundries.",
		favours: ["bureaucrats", "military"],
		angers: ["workers", "peasants"],
		effects: {
			production: .12,
			military: .04,
			stability: -.04,
			factionSatisfaction: {
				bureaucrats: .06,
				military: .04,
				workers: -.12,
				peasants: -.06
			},
			factionInfluence: { bureaucrats: .05 }
		},
		governments: ["empire", "communist_state"]
	},
	temple_schools: {
		id: "temple_schools",
		category: "knowledge",
		name: "Temple Schools",
		shortName: "Temple schools",
		description: "Knowledge is guarded by ritual specialists and old institutions.",
		favours: ["clergy_scholars", "nobles"],
		angers: ["reformists"],
		effects: {
			research: .03,
			legitimacy: .04,
			factionSatisfaction: {
				clergy_scholars: .08,
				nobles: .03,
				reformists: -.04
			},
			factionInfluence: { clergy_scholars: .05 }
		}
	},
	public_schools: {
		id: "public_schools",
		category: "knowledge",
		name: "Public Schools",
		shortName: "Schools",
		description: "Basic education spreads beyond temples, courts and guild families.",
		favours: [
			"workers",
			"peasants",
			"reformists",
			"clergy_scholars"
		],
		angers: ["nobles"],
		effects: {
			research: .12,
			legitimacy: .02,
			reformPressure: -.02,
			factionSatisfaction: {
				workers: .05,
				peasants: .04,
				reformists: .05,
				clergy_scholars: .05,
				nobles: -.03
			}
		},
		governments: [
			"constitutional_monarchy",
			"republic",
			"capitalist_state",
			"communist_state"
		]
	},
	censorship_office: {
		id: "censorship_office",
		category: "knowledge",
		name: "Censorship Office",
		shortName: "Censors",
		description: "The state controls dangerous texts, news and public teaching.",
		favours: ["bureaucrats", "military"],
		angers: [
			"clergy_scholars",
			"reformists",
			"merchants"
		],
		effects: {
			research: -.06,
			stability: .03,
			reformPressure: .08,
			factionSatisfaction: {
				bureaucrats: .05,
				military: .03,
				clergy_scholars: -.12,
				reformists: -.12,
				merchants: -.04
			}
		}
	},
	academies_charter: {
		id: "academies_charter",
		category: "knowledge",
		name: "Academies Charter",
		shortName: "Academies",
		description: "Learned institutions receive protection, grants and formal autonomy.",
		favours: [
			"clergy_scholars",
			"merchants",
			"reformists"
		],
		angers: ["military"],
		effects: {
			research: .14,
			trade: .03,
			factionSatisfaction: {
				clergy_scholars: .12,
				merchants: .04,
				reformists: .04,
				military: -.03
			},
			factionInfluence: { clergy_scholars: .06 }
		},
		governments: [
			"monarchy",
			"constitutional_monarchy",
			"republic",
			"capitalist_state"
		]
	},
	common_harvest: {
		id: "common_harvest",
		category: "ecology",
		name: "Common Harvest",
		shortName: "Harvest custom",
		description: "Forests, animals and soil are used through inherited local norms.",
		favours: ["peasants", "frontier"],
		angers: [],
		effects: {
			foodSecurity: .02,
			production: .01,
			factionSatisfaction: {
				peasants: .03,
				frontier: .03
			}
		}
	},
	conservation_edicts: {
		id: "conservation_edicts",
		category: "ecology",
		name: "Conservation Edicts",
		shortName: "Conservation",
		description: "The state limits extraction to preserve forests, animals and watersheds.",
		favours: [
			"peasants",
			"clergy_scholars",
			"reformists"
		],
		angers: ["merchants", "workers"],
		effects: {
			foodSecurity: .06,
			production: -.04,
			stability: .02,
			factionSatisfaction: {
				peasants: .04,
				clergy_scholars: .06,
				reformists: .04,
				merchants: -.04,
				workers: -.03
			}
		},
		governments: [
			"tribe",
			"constitutional_monarchy",
			"republic",
			"communist_state"
		]
	},
	extraction_mandate: {
		id: "extraction_mandate",
		category: "ecology",
		name: "Extraction Mandate",
		shortName: "Extraction",
		description: "Mines, timber camps and foundries receive legal priority over restraint.",
		favours: [
			"merchants",
			"workers",
			"military"
		],
		angers: ["peasants", "clergy_scholars"],
		effects: {
			production: .1,
			military: .04,
			foodSecurity: -.04,
			factionSatisfaction: {
				merchants: .05,
				workers: .04,
				military: .03,
				peasants: -.06,
				clergy_scholars: -.04
			}
		}
	}
};
var DEFAULT_LAWS = {
	tribe: {
		taxation: "subsistence_levies",
		land: "common_lands",
		trade: "closed_markets",
		military: "citizen_militia",
		rights: "customary_rights",
		administration: "village_autonomy",
		labor: "guild_customs",
		knowledge: "temple_schools",
		ecology: "common_harvest"
	},
	chiefdom: {
		taxation: "royal_tithe",
		land: "common_lands",
		trade: "closed_markets",
		military: "citizen_militia",
		rights: "customary_rights",
		administration: "village_autonomy",
		labor: "guild_customs",
		knowledge: "temple_schools",
		ecology: "common_harvest"
	},
	feudal_kingdom: {
		taxation: "royal_tithe",
		land: "noble_estates",
		trade: "strategic_tariffs",
		military: "professional_army",
		rights: "noble_privileges",
		administration: "royal_bureaucracy",
		labor: "guild_customs",
		knowledge: "temple_schools",
		ecology: "common_harvest"
	},
	monarchy: {
		taxation: "royal_tithe",
		land: "noble_estates",
		trade: "chartered_companies",
		military: "professional_army",
		rights: "noble_privileges",
		administration: "royal_bureaucracy",
		labor: "guild_customs",
		knowledge: "academies_charter",
		ecology: "common_harvest"
	},
	empire: {
		taxation: "war_taxes",
		land: "noble_estates",
		trade: "strategic_tariffs",
		military: "professional_army",
		rights: "emergency_powers",
		administration: "imperial_governors",
		labor: "state_labor_duty",
		knowledge: "censorship_office",
		ecology: "extraction_mandate"
	},
	constitutional_monarchy: {
		taxation: "royal_tithe",
		land: "common_lands",
		trade: "free_trade",
		military: "defensive_doctrine",
		rights: "civic_rights",
		administration: "federal_charters",
		labor: "labor_protections",
		knowledge: "public_schools",
		ecology: "conservation_edicts"
	},
	republic: {
		taxation: "progressive_tax",
		land: "frontier_homesteads",
		trade: "free_trade",
		military: "defensive_doctrine",
		rights: "civic_rights",
		administration: "federal_charters",
		labor: "labor_protections",
		knowledge: "public_schools",
		ecology: "conservation_edicts"
	},
	capitalist_state: {
		taxation: "royal_tithe",
		land: "frontier_homesteads",
		trade: "free_trade",
		military: "professional_army",
		rights: "civic_rights",
		administration: "royal_bureaucracy",
		labor: "free_labor",
		knowledge: "academies_charter",
		ecology: "extraction_mandate"
	},
	communist_state: {
		taxation: "progressive_tax",
		land: "land_redistribution",
		trade: "closed_markets",
		military: "mass_conscription",
		rights: "emergency_powers",
		administration: "imperial_governors",
		labor: "state_labor_duty",
		knowledge: "public_schools",
		ecology: "extraction_mandate"
	}
};
function createLawProfile(government = "tribe") {
	return {
		active: { ...DEFAULT_LAWS[government] },
		reformMomentum: .12,
		lastReformYear: 0,
		reformCooldownUntil: 0,
		history: []
	};
}
function deserializeLawProfile(data, government = "tribe") {
	const profile = createLawProfile(government);
	if (!data) return profile;
	for (const category of LAW_CATEGORY_ORDER) {
		const id = data.active?.[category];
		if (id && LAWS[id]?.category === category) profile.active[category] = id;
	}
	profile.reformMomentum = clamp01(data.reformMomentum ?? profile.reformMomentum);
	profile.lastReformYear = data.lastReformYear ?? 0;
	profile.reformCooldownUntil = data.reformCooldownUntil ?? 0;
	profile.history = Array.isArray(data.history) ? data.history.slice(-12) : [];
	return profile;
}
function resetLawDefaults(profile, government) {
	profile.active = { ...DEFAULT_LAWS[government] };
	profile.reformMomentum = Math.max(profile.reformMomentum, .24);
	profile.reformCooldownUntil = Math.max(profile.reformCooldownUntil, profile.lastReformYear + 2);
}
function activeLawDefinitions(profile) {
	return LAW_CATEGORY_ORDER.map((category) => LAWS[profile.active[category]]);
}
function aggregateLawEffects(profile) {
	const total = {};
	for (const law of activeLawDefinitions(profile)) mergeEffects(total, law.effects);
	return total;
}
function updateLawMomentum(profile, ctx) {
	const pressure = ctx.society.reformPressure * .35 + ctx.society.revoltRisk * .25 + ctx.society.coupRisk * .12 + Math.max(0, .48 - ctx.stability) * .18 + Math.max(0, .5 - ctx.legitimacy) * .12 + Math.max(0, .45 - ctx.foodSecurity) * .1;
	profile.reformMomentum = clamp01(profile.reformMomentum + pressure * .18 - .035);
}
function chooseLawReform(profile, ctx) {
	if (ctx.year < profile.reformCooldownUntil) return null;
	let best = null;
	for (const law of Object.values(LAWS)) {
		if (profile.active[law.category] === law.id) continue;
		if (law.governments && !law.governments.includes(ctx.government)) continue;
		const current = LAWS[profile.active[law.category]];
		const score = lawFit(law, ctx) - lawFit(current, ctx) - reformResistance(law, current, ctx);
		const pressure = clamp01(profile.reformMomentum + ctx.society.reformPressure * .35 + Math.max(0, score) * .45);
		if (score < .08) continue;
		if (!best || score > best.score) best = {
			law,
			current,
			score,
			pressure
		};
	}
	if (!best || best.pressure < .28) return null;
	return best;
}
function enactLaw(profile, lawId, year, pressure) {
	const law = LAWS[lawId];
	const from = profile.active[law.category];
	profile.active[law.category] = lawId;
	profile.lastReformYear = year;
	profile.reformCooldownUntil = year + 4 + Math.floor((1 - pressure) * 4);
	profile.reformMomentum = Math.max(.04, profile.reformMomentum * .38);
	const change = {
		year,
		category: law.category,
		from,
		to: lawId,
		pressure: clamp01(pressure)
	};
	profile.history.unshift(change);
	profile.history = profile.history.slice(0, 12);
	return change;
}
function lawFit(law, ctx) {
	const e = law.effects;
	let score = .25;
	score += (e.stability ?? 0) * (ctx.stability < .55 ? 2.2 : .7);
	score += (e.legitimacy ?? 0) * (ctx.legitimacy < .56 ? 1.9 : .8);
	score += (e.foodSecurity ?? 0) * (ctx.foodSecurity < .55 ? 2.3 : .7);
	score += (e.administrativeReach ?? 0) * (ctx.administrativeReach < .58 || ctx.cityCount >= 4 ? 1.7 : .6);
	score += (e.trade ?? 0) * (ctx.tradeDependency > .2 || ctx.economy === "market" || ctx.economy === "mercantile" ? 1.4 : .4);
	score += (e.production ?? 0) * (ctx.industrialisation > .25 ? 1.3 : .7);
	score += (e.research ?? 0) * (ctx.culture.innovation > .45 ? 1.1 : .55);
	score += (e.military ?? 0) * (ctx.atWar || ctx.externalThreat > .46 ? 1.7 : .5);
	score += (e.expansion ?? 0) * (ctx.culture.expansionism > .52 ? .02 : .005);
	score -= (e.inequality ?? 0) * (ctx.inequality > .48 || ctx.society.reformPressure > .35 ? 1.4 : .45);
	score -= (e.revoltRisk ?? 0) * 1.5;
	score -= (e.reformPressure ?? 0) * (ctx.society.reformPressure > .35 ? 1.4 : .7);
	score += factionFit(e.factionSatisfaction, ctx, .9);
	score += factionFit(e.factionLoyalty, ctx, .45);
	score += factionFit(e.factionInfluence, ctx, .25);
	score += factionFit(e.factionWarSupport, ctx, ctx.atWar || ctx.externalThreat > .5 ? .28 : -.08);
	score += factionFit(e.factionReformSupport, ctx, ctx.society.reformPressure > .38 ? -.22 : .08);
	if (law.favours.includes(ctx.society.dominantFaction)) score += .08;
	if (law.angers.includes(ctx.society.dominantFaction)) score -= .12;
	if (ctx.atWar && law.category === "military") score += .08;
	if (ctx.foodSecurity < .45 && law.favours.includes("peasants")) score += .08;
	if (ctx.tradeDependency > .35 && law.favours.includes("merchants")) score += .08;
	return score;
}
function factionFit(effects, ctx, scale) {
	if (!effects) return 0;
	let score = 0;
	for (const [id, value] of Object.entries(effects)) {
		const faction = ctx.society.factions[id];
		const unrest = Math.max(.15, 1 - faction.satisfaction + faction.radicalization * .8);
		score += value * faction.influence * unrest * scale;
	}
	return score;
}
function reformResistance(law, current, ctx) {
	let resistance = .03;
	for (const id of current.favours) {
		const faction = ctx.society.factions[id];
		resistance += faction.influence * faction.loyalty * .08;
	}
	for (const id of law.angers) {
		const faction = ctx.society.factions[id];
		resistance += faction.influence * Math.max(.2, faction.radicalization) * .1;
	}
	if (law.category === "rights" || law.category === "land") resistance += ctx.culture.tradition * .04;
	if (ctx.atWar && law.category !== "military" && law.category !== "taxation") resistance += .05;
	return resistance;
}
function mergeEffects(total, add) {
	total.taxMultiplier = (total.taxMultiplier ?? 0) + (add.taxMultiplier ?? 0);
	total.stability = (total.stability ?? 0) + (add.stability ?? 0);
	total.legitimacy = (total.legitimacy ?? 0) + (add.legitimacy ?? 0);
	total.administrativeReach = (total.administrativeReach ?? 0) + (add.administrativeReach ?? 0);
	total.foodSecurity = (total.foodSecurity ?? 0) + (add.foodSecurity ?? 0);
	total.trade = (total.trade ?? 0) + (add.trade ?? 0);
	total.production = (total.production ?? 0) + (add.production ?? 0);
	total.research = (total.research ?? 0) + (add.research ?? 0);
	total.military = (total.military ?? 0) + (add.military ?? 0);
	total.expansion = (total.expansion ?? 0) + (add.expansion ?? 0);
	total.inequality = (total.inequality ?? 0) + (add.inequality ?? 0);
	total.reformPressure = (total.reformPressure ?? 0) + (add.reformPressure ?? 0);
	total.revoltRisk = (total.revoltRisk ?? 0) + (add.revoltRisk ?? 0);
	mergeFactionMap(total, add, "factionSatisfaction");
	mergeFactionMap(total, add, "factionInfluence");
	mergeFactionMap(total, add, "factionLoyalty");
	mergeFactionMap(total, add, "factionWarSupport");
	mergeFactionMap(total, add, "factionReformSupport");
}
function mergeFactionMap(total, add, key) {
	const values = add[key];
	if (!values) return;
	const target = total[key] ?? {};
	for (const [id, value] of Object.entries(values)) target[id] = (target[id] ?? 0) + value;
	total[key] = target;
}
function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}
//#endregion
//#region src/civ/Kingdom.ts
var KINGDOM_EMBLEMS = [
	"swords",
	"shield",
	"lion",
	"eagle",
	"dragon",
	"fire",
	"lightning",
	"moon",
	"sun",
	"gem",
	"castle",
	"leaf"
];
var NAME_PREFIXES = [
	"Kingdom of",
	"Empire of",
	"Realm of",
	"Dominion of",
	"Republic of",
	"Clan of"
];
var NAME_ROOTS = [
	"Aethon",
	"Valdris",
	"Thundara",
	"Solheim",
	"Frostholm",
	"Ironvale",
	"Ashenmoor",
	"Crystalfall",
	"Dawnspire",
	"Shadowfen",
	"Stormreach",
	"Goldcrest",
	"Thornwood",
	"Emberveil",
	"Moonhaven",
	"Starfell",
	"Dragonclaw",
	"Stonekeep",
	"Brighthollow",
	"Nightbloom",
	"Sunridge",
	"Deepforge",
	"Windhowl",
	"Flamecrest"
];
/** Titles a realm takes as its government changes. */
var REALM_TITLES = {
	tribe: "Clan of",
	chiefdom: "Clan of",
	feudal_kingdom: "Kingdom of",
	monarchy: "Kingdom of",
	empire: "Empire of",
	constitutional_monarchy: "Kingdom of",
	republic: "Republic of",
	capitalist_state: "Free State of",
	communist_state: "People's Republic of"
};
function generateKingdomName() {
	return `${NAME_PREFIXES[Math.floor(rng.next() * NAME_PREFIXES.length)]} ${NAME_ROOTS[Math.floor(rng.next() * NAME_ROOTS.length)]}`;
}
var KINGDOM_COLORS = [
	"#e74c3c",
	"#2ecc71",
	"#3498db",
	"#f39c12",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#2980b9",
	"#c0392b",
	"#27ae60",
	"#8e44ad",
	"#d35400",
	"#16a085",
	"#f1c40f",
	"#e84393",
	"#00cec9",
	"#6c5ce7",
	"#fdcb6e",
	"#e17055",
	"#00b894"
];
var colorIndex = 0;
function getNextKingdomColor() {
	const color = KINGDOM_COLORS[colorIndex % KINGDOM_COLORS.length];
	colorIndex++;
	return color;
}
var Kingdom = class Kingdom {
	id;
	name;
	color;
	species;
	capitalCityId;
	rulerId = null;
	cityIds = /* @__PURE__ */ new Set();
	foundingYear;
	emblem;
	secondaryColor;
	rgbColor;
	cachedRgba18;
	cachedRgba45;
	cachedRgbaBorder;
	cachedCenter = {
		x: 64,
		y: 64
	};
	/** Territory tile count, refreshed each macro tick. */
	territorySize = 0;
	totalPopulation = 0;
	militaryPower = 0;
	warWeariness = 0;
	/** 0..1 - public belief that the current order has a right to rule. */
	legitimacy = .7;
	/** 0..1 - how well the capital can actually administer far-flung cities. */
	administrativeReach = 1;
	/** 0..1 - strategic reserve and reliability of food supply. */
	foodSecurity = 1;
	/** 0..1 - pressure from stronger neighbours and active enemies. */
	externalThreat = 0;
	/** 0..1 - how much the realm depends on imported goods and trade income. */
	tradeDependency = 0;
	/** Collective values, memories and social temperament of the realm. */
	culture;
	/** Internal social factions and their political pressure. */
	society;
	/** Current legal code: taxes, rights, land, trade, army, labour and reforms. */
	laws;
	exportVolume = 0;
	importVolume = 0;
	tariffRevenue = 0;
	pirateRaidsDefeated = 0;
	/** The national reserve — taxed from cities, spent on projects and trade. */
	treasury = new Stockpile(4e3);
	research = new ResearchState();
	economy = new KingdomEconomy();
	government = "tribe";
	/** Year of the last government change, so realms don't flip-flop. */
	governmentSince = 1;
	/** The ruling family name. Succession prefers this bloodline. */
	dynasty = "";
	/** Realms this one has ever exchanged an envoy with. */
	knownKingdoms = /* @__PURE__ */ new Set();
	/** Realms that swore fealty to this one. */
	vassalIds = /* @__PURE__ */ new Set();
	/** Set when this realm is itself a vassal. */
	overlordId = null;
	/** Kept for the old culture-level display. Now derived from research. */
	cultureLevel = 1;
	/** Legacy numeric wealth, mirrored from the economy treasury. */
	wealth = 100;
	constructor(id, name, species, color, capitalCityId, foundingYear) {
		this.id = id;
		this.name = name;
		this.species = species;
		this.color = color;
		this.capitalCityId = capitalCityId;
		this.cityIds.add(capitalCityId);
		this.foundingYear = foundingYear;
		this.emblem = KINGDOM_EMBLEMS[Math.floor(Math.random() * KINGDOM_EMBLEMS.length)];
		this.secondaryColor = this.lightenColor(color, 40);
		this.governmentSince = foundingYear;
		this.culture = createCulturalProfile(species);
		this.society = createSocietyProfile(this.government);
		this.laws = createLawProfile(this.government);
		const num = parseInt(color.replace("#", ""), 16);
		this.rgbColor = {
			r: num >> 16 & 255,
			g: num >> 8 & 255,
			b: num & 255
		};
		this.cachedRgba18 = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.18)`;
		this.cachedRgba45 = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.45)`;
		this.cachedRgbaBorder = `rgba(${this.rgbColor.r}, ${this.rgbColor.g}, ${this.rgbColor.b}, 0.7)`;
	}
	get governmentInfo() {
		return GOVERNMENTS[this.government];
	}
	get rulerTitle() {
		return this.governmentInfo.rulerTitle;
	}
	get isEmpire() {
		return this.government === "empire";
	}
	/**
	* Adopts a new government and renames the realm to match its new form.
	* Returns the old name so the chronicle can describe the transition.
	*/
	adoptGovernment(government, year) {
		const previousName = this.name;
		this.government = government;
		this.governmentSince = year;
		const title = REALM_TITLES[government];
		if (title) {
			const root = this.name.split(" ").pop() ?? "Aethon";
			this.name = `${title} ${root}`;
		}
		return previousName;
	}
	/** Combined strength used for war resolution and the power ranking. */
	computePower() {
		const techMods = this.research.modifiers();
		const gov = this.governmentInfo;
		const base = this.totalPopulation * 2 + this.territorySize * .6 + this.cityIds.size * 25;
		const cohesion = .72 + this.legitimacy * .18 + this.administrativeReach * .18;
		const exhaustion = Math.max(.65, 1 - this.warWeariness * .0025);
		const warCulture = .9 + this.culture.militarism * .15 + this.culture.authority * .08 - this.culture.warTrauma * .09;
		const militaryFaction = this.society.factions.military;
		const socialMobilisation = .88 + militaryFaction.influence * .16 + militaryFaction.loyalty * .08 - this.society.coupRisk * .08;
		const lawMilitary = 1 + (aggregateLawEffects(this.laws).military ?? 0);
		return Math.round(base * techMods.military * gov.military * cohesion * exhaustion * warCulture * socialMobilisation * lawMilitary);
	}
	/** Total territory this realm controls including its vassals' pledged land. */
	effectiveTerritory(kingdoms) {
		let total = this.territorySize;
		for (const vassalId of this.vassalIds) total += kingdoms.get(vassalId)?.territorySize ?? 0;
		return total;
	}
	addCity(cityId) {
		this.cityIds.add(cityId);
	}
	removeCity(cityId) {
		this.cityIds.delete(cityId);
	}
	/** Center of territory for badge placement. */
	computeCenter(cities) {
		let totalX = 0;
		let totalY = 0;
		let count = 0;
		for (const cityId of this.cityIds) {
			const city = cities.get(cityId);
			if (city) for (const key of city.territory) {
				const [tx, ty] = key.split(",").map(Number);
				totalX += tx;
				totalY += ty;
				count++;
			}
		}
		if (count === 0) {
			this.cachedCenter = {
				x: 64,
				y: 64
			};
			return this.cachedCenter;
		}
		this.cachedCenter = {
			x: Math.round(totalX / count),
			y: Math.round(totalY / count)
		};
		return this.cachedCenter;
	}
	lightenColor(hex, percent) {
		const num = parseInt(hex.replace("#", ""), 16);
		return `rgb(${Math.min(255, (num >> 16 & 255) + percent)}, ${Math.min(255, (num >> 8 & 255) + percent)}, ${Math.min(255, (num & 255) + percent)})`;
	}
	serialize() {
		return {
			id: this.id,
			name: this.name,
			color: this.color,
			species: this.species,
			capitalCityId: this.capitalCityId,
			rulerId: this.rulerId,
			cityIds: Array.from(this.cityIds),
			foundingYear: this.foundingYear,
			emblem: this.emblem,
			territorySize: this.territorySize,
			totalPopulation: this.totalPopulation,
			warWeariness: this.warWeariness,
			legitimacy: this.legitimacy,
			administrativeReach: this.administrativeReach,
			foodSecurity: this.foodSecurity,
			externalThreat: this.externalThreat,
			tradeDependency: this.tradeDependency,
			culture: this.culture,
			society: this.society,
			laws: this.laws,
			treasury: this.treasury.serialize(),
			research: this.research.serialize(),
			economy: this.economy.serialize(),
			government: this.government,
			governmentSince: this.governmentSince,
			dynasty: this.dynasty,
			knownKingdoms: Array.from(this.knownKingdoms),
			vassalIds: Array.from(this.vassalIds),
			overlordId: this.overlordId,
			cultureLevel: this.cultureLevel,
			wealth: this.wealth
		};
	}
	static deserialize(data) {
		const kingdom = new Kingdom(data.id, data.name, data.species, data.color, data.capitalCityId, data.foundingYear);
		kingdom.rulerId = data.rulerId ?? null;
		kingdom.cityIds = new Set(data.cityIds ?? [data.capitalCityId]);
		if (data.emblem) kingdom.emblem = data.emblem;
		kingdom.territorySize = data.territorySize ?? 0;
		kingdom.totalPopulation = data.totalPopulation ?? 0;
		kingdom.warWeariness = data.warWeariness ?? 0;
		kingdom.legitimacy = data.legitimacy ?? .7;
		kingdom.administrativeReach = data.administrativeReach ?? 1;
		kingdom.foodSecurity = data.foodSecurity ?? 1;
		kingdom.externalThreat = data.externalThreat ?? 0;
		kingdom.tradeDependency = data.tradeDependency ?? 0;
		kingdom.treasury.deserialize(data.treasury);
		kingdom.research.deserialize(data.research);
		kingdom.economy.deserialize(data.economy);
		kingdom.government = data.government ?? "tribe";
		kingdom.culture = deserializeCulturalProfile(data.culture, kingdom.species);
		kingdom.society = deserializeSocietyProfile(data.society, kingdom.government);
		kingdom.laws = deserializeLawProfile(data.laws, kingdom.government);
		kingdom.governmentSince = data.governmentSince ?? data.foundingYear ?? 1;
		kingdom.dynasty = data.dynasty ?? "";
		kingdom.knownKingdoms = new Set(data.knownKingdoms ?? []);
		kingdom.vassalIds = new Set(data.vassalIds ?? []);
		kingdom.overlordId = data.overlordId ?? null;
		kingdom.cultureLevel = data.cultureLevel ?? 1;
		kingdom.wealth = data.wealth ?? 100;
		return kingdom;
	}
};
var events = class EventBus {
	static instance;
	listeners = /* @__PURE__ */ new Map();
	static getInstance() {
		if (!EventBus.instance) EventBus.instance = new EventBus();
		return EventBus.instance;
	}
	on(event, callback) {
		if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
		this.listeners.get(event).add(callback);
	}
	off(event, callback) {
		if (this.listeners.has(event)) this.listeners.get(event).delete(callback);
	}
	emit(event, data) {
		const callbacks = this.listeners.get(event);
		if (callbacks) callbacks.forEach((cb) => {
			try {
				cb(data);
			} catch (e) {
				console.error(`Error handling event "${event}":`, e);
			}
		});
	}
}.getInstance();
//#endregion
//#region src/civ/Diplomacy.ts
var DiplomacyManager = class {
	relations = /* @__PURE__ */ new Map();
	alliances = /* @__PURE__ */ new Map();
	activeWars = /* @__PURE__ */ new Map();
	warHistory = [];
	truces = /* @__PURE__ */ new Map();
	getPairKey(k1, k2) {
		return k1 < k2 ? `${k1}:${k2}` : `${k2}:${k1}`;
	}
	getRelation(k1, k2) {
		if (k1 === k2) return 100;
		const key = this.getPairKey(k1, k2);
		return this.relations.get(key) ?? 0;
	}
	getStatus(k1, k2) {
		if (k1 === k2) return "friendly";
		const key = this.getPairKey(k1, k2);
		if (this.activeWars.has(key)) return "war";
		for (const alliance of this.alliances.values()) if (alliance.members.has(k1) && alliance.members.has(k2)) return "alliance";
		const rel = this.getRelation(k1, k2);
		if (rel >= 50) return "friendly";
		if (rel <= -50) return "hostile";
		return "neutral";
	}
	setRelation(k1, k2, value) {
		if (k1 === k2) return;
		const key = this.getPairKey(k1, k2);
		const clamped = Math.max(-100, Math.min(100, Math.round(value)));
		this.relations.set(key, clamped);
	}
	changeRelation(k1, k2, delta) {
		const current = this.getRelation(k1, k2);
		this.setRelation(k1, k2, current + delta);
	}
	isAtWar(k1, k2) {
		if (k1 === k2) return false;
		return this.activeWars.has(this.getPairKey(k1, k2));
	}
	getTruce(k1, k2, year) {
		const key = this.getPairKey(k1, k2);
		const truce = this.truces.get(key);
		if (!truce) return null;
		if (year <= truce.untilYear) return truce;
		this.truces.delete(key);
		return null;
	}
	hasTruce(k1, k2, year) {
		return this.getTruce(k1, k2, year) !== null;
	}
	recordTruce(k1, k2, year, durationYears, reason) {
		const key = this.getPairKey(k1, k2);
		const sorted = key.split(":");
		this.truces.set(key, {
			kingdoms: sorted,
			signedYear: year,
			untilYear: year + Math.max(1, Math.round(durationYears)),
			reason
		});
	}
	declareWar(k1, k2, year, reason = "Territorial Dispute") {
		if (k1 === k2) return false;
		if (!/rebellion|secession|independence/i.test(reason) && this.hasTruce(k1, k2, year)) return false;
		const key = this.getPairKey(k1, k2);
		if (!this.activeWars.has(key)) {
			const warRecord = {
				id: `war_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
				attacker: k1,
				defender: k2,
				startYear: year,
				endYear: null,
				reason,
				battles: 0,
				attackerKills: 0,
				defenderKills: 0,
				victor: null,
				settlement: null
			};
			this.activeWars.set(key, warRecord);
			this.setRelation(k1, k2, -100);
			for (const [allyId, alliance] of this.alliances) if (alliance.members.has(k1) && alliance.members.has(k2)) {
				alliance.members.delete(k2);
				if (alliance.members.size < 2) this.alliances.delete(allyId);
			}
			events.emit("warStarted", {
				k1,
				k2,
				year,
				reason
			});
			return true;
		}
		return false;
	}
	recordBattle(k1, k2, k1Kills, k2Kills) {
		const key = this.getPairKey(k1, k2);
		const war = this.activeWars.get(key);
		if (war) {
			war.battles++;
			if (war.attacker === k1) {
				war.attackerKills += k1Kills;
				war.defenderKills += k2Kills;
			} else {
				war.defenderKills += k1Kills;
				war.attackerKills += k2Kills;
			}
		}
	}
	endWar(k1, k2, year) {
		const key = this.getPairKey(k1, k2);
		const war = this.activeWars.get(key);
		if (war) {
			war.endYear = year;
			war.settlement ??= "white_peace";
			this.warHistory.push(war);
			this.activeWars.delete(key);
			this.setRelation(k1, k2, -20);
			this.recordTruce(k1, k2, year, 5, war.settlement);
			events.emit("warEnded", {
				k1,
				k2,
				year,
				war
			});
		}
	}
	settleWar(k1, k2, year, settlement, victor = null, relationAfter, truceYears = 5) {
		const key = this.getPairKey(k1, k2);
		const war = this.activeWars.get(key);
		if (!war) return;
		war.endYear = year;
		war.settlement = settlement;
		war.victor = victor;
		this.warHistory.push(war);
		this.activeWars.delete(key);
		this.setRelation(k1, k2, relationAfter ?? (settlement === "white_peace" ? -20 : -35));
		this.recordTruce(k1, k2, year, truceYears, settlement);
		events.emit("warEnded", {
			k1,
			k2,
			year,
			war
		});
	}
	createAlliance(k1, k2, name, year) {
		if (this.isAtWar(k1, k2)) return null;
		const allianceId = `all_${Date.now()}`;
		const alliance = {
			id: allianceId,
			name,
			members: /* @__PURE__ */ new Set([k1, k2]),
			formedYear: year
		};
		this.alliances.set(allianceId, alliance);
		this.setRelation(k1, k2, 80);
		events.emit("allianceFormed", {
			alliance,
			k1,
			k2
		});
		return alliance;
	}
	/** Diplomacy tick - natural drift, war declarations, peace treaties */
	tickDiplomacy(kingdomIds, year) {
		const ids = [...kingdomIds];
		for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
			const k1 = ids[i];
			const k2 = ids[j];
			const rel = this.getRelation(k1, k2);
			if (rel > 5) this.changeRelation(k1, k2, -.5);
			else if (rel < -5) this.changeRelation(k1, k2, .5);
			if (!this.isAtWar(k1, k2)) {
				if (this.hasTruce(k1, k2, year)) continue;
				if (rel <= -60 && rng.chance(.02)) this.declareWar(k1, k2, year, rel <= -80 ? "Blood Feud" : "Border Conflict");
				if (rel >= 60 && rng.chance(.01)) {
					const name = `Pact of ${year}`;
					this.createAlliance(k1, k2, name, year);
				}
			} else {
				const war = this.activeWars.get(this.getPairKey(k1, k2));
				if (war && year - war.startYear > 3) {
					const duration = year - war.startYear;
					const casualties = war.attackerKills + war.defenderKills;
					const peaceChance = Math.min(.22, .02 + duration * .012 + casualties * .0015);
					if (rng.chance(peaceChance)) this.settleWar(k1, k2, year, casualties > 10 ? "exhaustion" : "white_peace", null, -25, 4 + Math.floor(duration / 2));
				}
			}
		}
	}
	/** Get all wars involving a specific kingdom */
	getWarsFor(kingdomId) {
		const wars = [];
		for (const [key, war] of this.activeWars) if (war.attacker === kingdomId || war.defender === kingdomId) wars.push(war);
		return wars;
	}
	/** Get the enemy kingdom IDs for a given kingdom */
	getEnemies(kingdomId) {
		const enemies = [];
		for (const [key, war] of this.activeWars) if (war.attacker === kingdomId) enemies.push(war.defender);
		else if (war.defender === kingdomId) enemies.push(war.attacker);
		return enemies;
	}
	/** Snapshot for save files. Sets and Maps don't survive JSON on their own. */
	serialize() {
		return {
			relations: Array.from(this.relations.entries()),
			alliances: Array.from(this.alliances.values()).map((a) => ({
				id: a.id,
				name: a.name,
				members: Array.from(a.members),
				formedYear: a.formedYear
			})),
			activeWars: Array.from(this.activeWars.entries()),
			warHistory: this.warHistory,
			truces: Array.from(this.truces.entries())
		};
	}
	deserialize(data) {
		this.relations = new Map(data.relations ?? []);
		this.alliances.clear();
		for (const a of data.alliances ?? []) this.alliances.set(a.id, {
			id: a.id,
			name: a.name,
			members: new Set(a.members),
			formedYear: a.formedYear
		});
		this.activeWars = new Map(data.activeWars ?? []);
		this.warHistory = data.warHistory ?? [];
		this.truces = new Map(data.truces ?? []);
	}
};
//#endregion
//#region src/entities/Equipment.ts
var WEAPON_TIERS = {
	primitive: [
		{
			name: "Wooden Spear",
			type: "weapon",
			category: "melee",
			rarity: "common",
			damageBonus: 4,
			defenseBonus: 1,
			hpBonus: 0,
			attackRange: 2.2
		},
		{
			name: "Stone Club",
			type: "weapon",
			category: "melee",
			rarity: "common",
			damageBonus: 6,
			defenseBonus: 0,
			hpBonus: 0,
			attackRange: 1.8
		},
		{
			name: "Hunting Sling",
			type: "weapon",
			category: "ranged",
			rarity: "common",
			damageBonus: 3,
			defenseBonus: 0,
			hpBonus: 0,
			attackRange: 4.5
		}
	],
	iron: [
		{
			name: "Iron Broadsword",
			type: "weapon",
			category: "melee",
			rarity: "uncommon",
			damageBonus: 12,
			defenseBonus: 3,
			hpBonus: 10,
			attackRange: 1.8
		},
		{
			name: "War Crossbow",
			type: "weapon",
			category: "ranged",
			rarity: "uncommon",
			damageBonus: 14,
			defenseBonus: 0,
			hpBonus: 0,
			attackRange: 5.5
		},
		{
			name: "Iron Halberd",
			type: "weapon",
			category: "melee",
			rarity: "uncommon",
			damageBonus: 15,
			defenseBonus: 4,
			hpBonus: 15,
			attackRange: 2.5
		}
	],
	steel: [
		{
			name: "Steel Greatsword",
			type: "weapon",
			category: "melee",
			rarity: "rare",
			damageBonus: 22,
			defenseBonus: 6,
			hpBonus: 25,
			attackRange: 2
		},
		{
			name: "Composite Longbow",
			type: "weapon",
			category: "ranged",
			rarity: "rare",
			damageBonus: 20,
			defenseBonus: 0,
			hpBonus: 10,
			attackRange: 6
		},
		{
			name: "Siege Catapult",
			type: "weapon",
			category: "siege",
			rarity: "rare",
			damageBonus: 45,
			defenseBonus: 0,
			hpBonus: 50,
			attackRange: 8
		}
	]
};
var ARMOR_TIERS = {
	primitive: [{
		name: "Leather Hide Vest",
		type: "armor",
		rarity: "common",
		damageBonus: 0,
		defenseBonus: 3,
		hpBonus: 10
	}],
	iron: [{
		name: "Iron Chainmail",
		type: "armor",
		rarity: "uncommon",
		damageBonus: 0,
		defenseBonus: 8,
		hpBonus: 30
	}, {
		name: "Iron Heater Shield",
		type: "armor",
		rarity: "rare",
		damageBonus: 0,
		defenseBonus: 12,
		hpBonus: 45
	}],
	steel: [{
		name: "Full Steel Plate Mail",
		type: "armor",
		rarity: "rare",
		damageBonus: 2,
		defenseBonus: 18,
		hpBonus: 80
	}]
};
var LEGENDARY_ITEMS = [
	{
		name: "Sunfire Blade",
		type: "weapon",
		category: "melee",
		rarity: "legendary",
		damageBonus: 35,
		defenseBonus: 8,
		hpBonus: 50,
		attackRange: 2
	},
	{
		name: "Dragon Scale Armor",
		type: "armor",
		rarity: "legendary",
		damageBonus: 5,
		defenseBonus: 28,
		hpBonus: 120
	},
	{
		name: "Aether Bow of Lumos",
		type: "weapon",
		category: "ranged",
		rarity: "legendary",
		damageBonus: 38,
		defenseBonus: 0,
		hpBonus: 30,
		attackRange: 7
	},
	{
		name: "Ironheart Citadel Shield",
		type: "armor",
		rarity: "rare",
		damageBonus: 0,
		defenseBonus: 22,
		hpBonus: 75
	},
	{
		name: "Emberkin Forge Hammer",
		type: "weapon",
		category: "melee",
		rarity: "rare",
		damageBonus: 26,
		defenseBonus: 6,
		hpBonus: 30,
		attackRange: 2
	}
];
//#endregion
//#region src/ai/Pathfinding.ts
/**
* Binary Min-Heap priority queue for A* pathfinding.
* O(log n) insert and extractMin instead of O(n log n) sorted array.
*/
var MinHeap = class {
	heap = [];
	compareFn;
	constructor(compareFn) {
		this.compareFn = compareFn;
	}
	get size() {
		return this.heap.length;
	}
	get isEmpty() {
		return this.heap.length === 0;
	}
	insert(item) {
		this.heap.push(item);
		this.bubbleUp(this.heap.length - 1);
	}
	extractMin() {
		if (this.heap.length === 0) return void 0;
		const min = this.heap[0];
		const last = this.heap.pop();
		if (this.heap.length > 0) {
			this.heap[0] = last;
			this.sinkDown(0);
		}
		return min;
	}
	bubbleUp(idx) {
		while (idx > 0) {
			const parent = idx - 1 >> 1;
			if (this.compareFn(this.heap[idx], this.heap[parent]) < 0) {
				[this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
				idx = parent;
			} else break;
		}
	}
	sinkDown(idx) {
		const len = this.heap.length;
		while (true) {
			let smallest = idx;
			const left = 2 * idx + 1;
			const right = 2 * idx + 2;
			if (left < len && this.compareFn(this.heap[left], this.heap[smallest]) < 0) smallest = left;
			if (right < len && this.compareFn(this.heap[right], this.heap[smallest]) < 0) smallest = right;
			if (smallest === idx) break;
			[this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
			idx = smallest;
		}
	}
};
/** Road-level moveCost multipliers — makes A* prefer existing roads */
var ROAD_COST_MULTIPLIER = {
	0: 1,
	1: .8,
	2: .6,
	3: .4
};
var SimplePathfinder = class {
	/**
	* When stuck, try 8 lateral directions to escape congestion rather than
	* immediately aborting the current task. Returns null if completely boxed in.
	*/
	static jitterAround(x, y, tileMap, speed) {
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1]
		];
		const step = speed * .8;
		for (const [dx, dy] of dirs) {
			const nx = x + dx * step;
			const ny = y + dy * step;
			const tile = tileMap.getTile(Math.floor(nx), Math.floor(ny));
			if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) return {
				x: nx,
				y: ny
			};
		}
		return null;
	}
	/**
	* Smooth sub-pixel movement toward target with arrival easing & road speed multipliers.
	* Returns fractional position allowing smooth walking animation.
	* Speed parameter controls how many pixels per tick the entity moves.
	*/
	static getStepTowards(startX, startY, targetX, targetY, tileMap, speed = .15) {
		const dx = targetX - startX;
		const dy = targetY - startY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < .05) return {
			x: targetX,
			y: targetY,
			blocked: false
		};
		const roadLevel = tileMap.getTile(Math.floor(startX), Math.floor(startY))?.roadLevel ?? 0;
		const roadBonus = roadLevel === 3 ? 1.8 : roadLevel === 2 ? 1.45 : roadLevel === 1 ? 1.2 : 1;
		const arrivalEase = Math.min(1, dist / .6);
		const effectiveSpeed = Math.min(speed * roadBonus * arrivalEase, dist);
		const moveX = dx / dist * effectiveSpeed;
		const moveY = dy / dist * effectiveSpeed;
		const newX = startX + moveX;
		const newY = startY + moveY;
		const tileAtNew = tileMap.getTile(Math.floor(newX), Math.floor(newY));
		if (tileAtNew && !TERRAINS[tileAtNew.type].isWater && TERRAINS[tileAtNew.type].isWalkable) {
			const moveCost = TERRAINS[tileAtNew.type].moveCost;
			const costFactor = 1 / Math.max(.5, moveCost);
			return {
				x: startX + moveX * costFactor,
				y: startY + moveY * costFactor,
				blocked: false
			};
		}
		const slideX = startX + moveX * .7;
		const slideY = startY + moveY * .7;
		const tileH = tileMap.getTile(Math.floor(slideX), Math.floor(startY));
		if (tileH && !TERRAINS[tileH.type].isWater && TERRAINS[tileH.type].isWalkable) return {
			x: slideX,
			y: startY,
			blocked: false
		};
		const tileV = tileMap.getTile(Math.floor(startX), Math.floor(slideY));
		if (tileV && !TERRAINS[tileV.type].isWater && TERRAINS[tileV.type].isWalkable) return {
			x: startX,
			y: slideY,
			blocked: false
		};
		for (let attempt = 0; attempt < 4; attempt++) {
			const angle = Math.PI / 2 * attempt;
			const jx = startX + Math.cos(angle) * speed;
			const jy = startY + Math.sin(angle) * speed;
			const jTile = tileMap.getTile(Math.floor(jx), Math.floor(jy));
			if (jTile && !TERRAINS[jTile.type].isWater && TERRAINS[jTile.type].isWalkable) return {
				x: jx,
				y: jy,
				blocked: false
			};
		}
		return {
			x: startX,
			y: startY,
			blocked: true
		};
	}
	/**
	* Find a random walkable land position near a center point.
	* Used for patrol targets, wander destinations, etc.
	*/
	static findRandomWalkable(centerX, centerY, radius, tileMap) {
		for (let attempts = 0; attempts < 15; attempts++) {
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * radius;
			const tx = Math.floor(centerX + Math.cos(angle) * dist);
			const ty = Math.floor(centerY + Math.sin(angle) * dist);
			const tile = tileMap.getTile(tx, ty);
			if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) return {
				x: tx + .5,
				y: ty + .5
			};
		}
		return null;
	}
	/**
	* Find the nearest valid dry land tile from a given coordinate.
	* Applies safety padding so units near water edges are pulled inward.
	* Returns null if no land is found within search radius.
	*/
	static findNearestLand(x, y, tileMap, maxSearchRadius = 30) {
		const startTx = Math.floor(x);
		const startTy = Math.floor(y);
		const startTile = tileMap.getTile(startTx, startTy);
		if (startTile && !TERRAINS[startTile.type].isWater && TERRAINS[startTile.type].isWalkable) {
			let safeX = x;
			let safeY = y;
			const fracX = x - startTx;
			const fracY = y - startTy;
			if (fracX < .25) {
				const leftTile = tileMap.getTile(startTx - 1, startTy);
				if (leftTile && TERRAINS[leftTile.type].isWater) safeX = startTx + .35;
			} else if (fracX > .75) {
				const rightTile = tileMap.getTile(startTx + 1, startTy);
				if (rightTile && TERRAINS[rightTile.type].isWater) safeX = startTx + .65;
			}
			if (fracY < .25) {
				const topTile = tileMap.getTile(startTx, startTy - 1);
				if (topTile && TERRAINS[topTile.type].isWater) safeY = startTy + .35;
			} else if (fracY > .75) {
				const bottomTile = tileMap.getTile(startTx, startTy + 1);
				if (bottomTile && TERRAINS[bottomTile.type].isWater) safeY = startTy + .65;
			}
			return {
				x: safeX,
				y: safeY
			};
		}
		for (let r = 1; r <= maxSearchRadius; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
			if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
			const tx = startTx + dx;
			const ty = startTy + dy;
			const tile = tileMap.getTile(tx, ty);
			if (tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable) return {
				x: tx + .5,
				y: ty + .5
			};
		}
		return null;
	}
	/**
	* Calculate distance between two points.
	*/
	static distance(x1, y1, x2, y2) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		return Math.sqrt(dx * dx + dy * dy);
	}
	/**
	* Find the direction away from a threat (for fleeing).
	*/
	static fleeFrom(myX, myY, threatX, threatY, tileMap, speed = .2) {
		const dx = myX - threatX;
		const dy = myY - threatY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < .01) return this.getStepTowards(myX, myY, myX + (Math.random() - .5) * 5, myY + (Math.random() - .5) * 5, tileMap, speed);
		const fleeX = myX + dx / dist * 8;
		const fleeY = myY + dy / dist * 8;
		return this.getStepTowards(myX, myY, fleeX, fleeY, tileMap, speed);
	}
	/**
	* A* Pathfinding for Land Caravans and Sea Ships.
	* Uses a binary min-heap for O(log n) priority queue operations.
	* Incorporates terrain moveCost and road bonus for intelligent routing.
	*
	* mode = 'land': navigates land tiles, avoiding water. Prefers roads.
	* mode = 'sea': navigates water tiles, avoiding land.
	*
	* Returns empty array [] if no path exists (instead of unsafe straight line).
	*/
	static findPath(startX, startY, targetX, targetY, tileMap, mode, maxNodes = 3e3) {
		const sx = Math.floor(startX);
		const sy = Math.floor(startY);
		let tx = Math.floor(targetX);
		let ty = Math.floor(targetY);
		if (sx === tx && sy === ty) return [{
			x: targetX,
			y: targetY
		}];
		const key = (x, y) => `${x},${y}`;
		const heuristic = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
		const isPassable = (x, y) => {
			const tile = tileMap.getTile(x, y);
			if (!tile) return false;
			const terrain = TERRAINS[tile.type];
			return mode === "land" ? !terrain.isWater && terrain.isWalkable : terrain.isWater;
		};
		if (!isPassable(tx, ty)) {
			let found = false;
			for (let r = 1; r <= 10 && !found; r++) for (let ddx = -r; ddx <= r && !found; ddx++) for (let ddy = -r; ddy <= r && !found; ddy++) {
				if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
				if (isPassable(tx + ddx, ty + ddy)) {
					tx = tx + ddx;
					ty = ty + ddy;
					found = true;
				}
			}
			if (!found) return [];
		}
		if (!isPassable(sx, sy)) {
			let found = false;
			for (let r = 1; r <= 10 && !found; r++) for (let ddx = -r; ddx <= r && !found; ddx++) for (let ddy = -r; ddy <= r && !found; ddy++) {
				if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
				if (isPassable(sx + ddx, sy + ddy)) {
					sx + ddx;
					sy + ddy;
					found = true;
				}
			}
			if (!found) return [];
		}
		/** Get the movement cost for stepping onto a tile */
		const getMoveCost = (x, y) => {
			const tile = tileMap.getTile(x, y);
			if (!tile) return 1;
			if (mode === "sea") return 1;
			return TERRAINS[tile.type].moveCost * (ROAD_COST_MULTIPLIER[tile.roadLevel] ?? 1);
		};
		const openHeap = new MinHeap((a, b) => a.f - b.f);
		const closedSet = /* @__PURE__ */ new Set();
		const nodeMap = /* @__PURE__ */ new Map();
		const startNode = {
			x: sx,
			y: sy,
			g: 0,
			h: heuristic(sx, sy, tx, ty),
			f: heuristic(sx, sy, tx, ty),
			parent: null
		};
		openHeap.insert(startNode);
		nodeMap.set(key(sx, sy), startNode);
		const dirs = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1]
		];
		let count = 0;
		while (!openHeap.isEmpty && count < maxNodes) {
			count++;
			const current = openHeap.extractMin();
			const currentKey = key(current.x, current.y);
			if (current.x === tx && current.y === ty) {
				const path = [];
				let curr = current;
				while (curr) {
					path.unshift({
						x: curr.x + .5,
						y: curr.y + .5
					});
					curr = curr.parent;
				}
				return path;
			}
			closedSet.add(currentKey);
			for (const [dx, dy] of dirs) {
				const nx = current.x + dx;
				const ny = current.y + dy;
				const nKey = key(nx, ny);
				if (closedSet.has(nKey)) continue;
				if (!isPassable(nx, ny)) continue;
				const baseDist = dx !== 0 && dy !== 0 ? 1.414 : 1;
				const moveCost = getMoveCost(nx, ny);
				const gScore = current.g + baseDist * moveCost;
				let neighborNode = nodeMap.get(nKey);
				if (!neighborNode) {
					neighborNode = {
						x: nx,
						y: ny,
						g: gScore,
						h: heuristic(nx, ny, tx, ty),
						f: gScore + heuristic(nx, ny, tx, ty),
						parent: current
					};
					nodeMap.set(nKey, neighborNode);
					openHeap.insert(neighborNode);
				} else if (gScore < neighborNode.g) {
					neighborNode.g = gScore;
					neighborNode.f = gScore + neighborNode.h;
					neighborNode.parent = current;
					openHeap.insert(neighborNode);
				}
			}
		}
		return [];
	}
};
//#endregion
//#region src/civ/Chronicle.ts
var MAX_EVENTS = 2500;
var HISTORY_TYPES = /* @__PURE__ */ new Set([
	"founding",
	"kingdom",
	"war",
	"peace",
	"king",
	"disaster",
	"conquest",
	"trade",
	"tech",
	"law",
	"revolution",
	"society",
	"economy",
	"diplomacy",
	"great_person",
	"wonder",
	"succession",
	"famine",
	"siege",
	"rebellion",
	"culture"
]);
var IMPORTANCE_SCORE = {
	minor: 0,
	notable: 1,
	major: 2,
	legendary: 3
};
function uniqueStrings(values) {
	return Array.from(new Set((values ?? []).filter(Boolean)));
}
function normalizeRefs(refs) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const ref of refs ?? []) {
		if (!ref || !ref.id || !ref.kind) continue;
		const key = `${ref.kind}:${ref.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push({
			kind: ref.kind,
			id: String(ref.id),
			name: ref.name ? String(ref.name) : void 0
		});
	}
	return result;
}
var Chronicle = class {
	events = [];
	sequence = 0;
	/**
	* Backward-compatible logger. Existing callers need no changes.
	* Rich callers can pass a fourth details argument.
	*/
	log(year, type, text, details = {}) {
		return this.record({
			year,
			type,
			text,
			...details
		});
	}
	record(input) {
		const event = this.normalizeEvent({
			...input,
			id: this.nextId(input.year)
		});
		this.events.unshift(event);
		this.prune();
		return event;
	}
	getEvents() {
		return this.events;
	}
	getEvent(id) {
		return this.events.find((event) => event.id === id);
	}
	/** Every recorded event that mentions a specific person, city, realm, war, etc. */
	getEventsForRef(kind, id) {
		return this.events.filter((event) => event.refs.some((ref) => ref.kind === kind && ref.id === id));
	}
	/**
	* Compact fact package for an optional historian/LLM layer. This method does
	* not narrate or invent anything; it exports only simulation-grounded facts.
	*/
	exportHistorianContext(limit = 160) {
		const safeLimit = Math.max(1, Math.min(500, Math.round(limit)));
		return {
			summary: this.getSummary(),
			threads: this.getThreads().slice(0, 40).map((thread) => ({
				id: thread.id,
				title: thread.title,
				startYear: thread.startYear,
				endYear: thread.endYear,
				importance: thread.importance
			})),
			events: this.events.slice(0, safeLimit).map((event) => ({
				...event,
				refs: event.refs.map((ref) => ({ ...ref })),
				tags: [...event.tags],
				causes: [...event.causes],
				consequences: [...event.consequences],
				relatedEventIds: [...event.relatedEventIds],
				data: { ...event.data }
			}))
		};
	}
	getMajorEvents() {
		return this.events.filter((event) => IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major);
	}
	search(query) {
		const q = query.trim().toLowerCase();
		if (!q) return this.events;
		return this.events.filter((event) => {
			return [
				event.title ?? "",
				event.text,
				...event.tags,
				...event.causes,
				...event.consequences,
				...event.refs.map((ref) => ref.name ?? ref.id)
			].join(" ").toLowerCase().includes(q);
		});
	}
	/**
	* Story threads are real chains of events, not generated lore. A thread exists
	* only when events share a stable thread id supplied by the simulation.
	*/
	getThreads() {
		const grouped = /* @__PURE__ */ new Map();
		for (const event of this.events) {
			if (!event.threadId) continue;
			const list = grouped.get(event.threadId) ?? [];
			list.push(event);
			grouped.set(event.threadId, list);
		}
		const threads = [];
		for (const [id, list] of grouped) {
			const chronological = [...list].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
			const mostImportant = chronological.reduce((best, event) => IMPORTANCE_SCORE[event.importance] > IMPORTANCE_SCORE[best.importance] ? event : best, chronological[0]);
			const refMap = /* @__PURE__ */ new Map();
			for (const event of chronological) for (const ref of event.refs) refMap.set(`${ref.kind}:${ref.id}`, ref);
			threads.push({
				id,
				title: chronological.find((event) => event.threadTitle)?.threadTitle ?? mostImportant.title ?? `Historical thread, ${chronological[0].year}`,
				startYear: chronological[0].year,
				endYear: chronological[chronological.length - 1].year,
				importance: mostImportant.importance,
				events: chronological,
				refs: Array.from(refMap.values())
			});
		}
		return threads.sort((a, b) => b.endYear - a.endYear || IMPORTANCE_SCORE[b.importance] - IMPORTANCE_SCORE[a.importance]);
	}
	getSummary() {
		if (this.events.length === 0) return {
			total: 0,
			earliestYear: null,
			latestYear: null,
			major: 0,
			legendary: 0,
			threads: 0
		};
		let earliest = Infinity;
		let latest = -Infinity;
		let major = 0;
		let legendary = 0;
		for (const event of this.events) {
			earliest = Math.min(earliest, event.year);
			latest = Math.max(latest, event.year);
			if (IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major) major++;
			if (event.importance === "legendary") legendary++;
		}
		return {
			total: this.events.length,
			earliestYear: earliest,
			latestYear: latest,
			major,
			legendary,
			threads: this.getThreads().length
		};
	}
	/** Save-ready snapshot. */
	serialize() {
		return this.events.map((event) => ({
			...event,
			refs: event.refs.map((ref) => ({ ...ref })),
			tags: [...event.tags],
			causes: [...event.causes],
			consequences: [...event.consequences],
			relatedEventIds: [...event.relatedEventIds],
			data: { ...event.data }
		}));
	}
	/**
	* Restores both new structured saves and legacy {year,type,text} entries.
	* Original ids are preserved when present.
	*/
	deserialize(data) {
		this.events = [];
		if (!Array.isArray(data)) return;
		for (const raw of data) {
			if (!raw || typeof raw !== "object") continue;
			const candidate = raw;
			if (typeof candidate.year !== "number" || typeof candidate.text !== "string") continue;
			const type = HISTORY_TYPES.has(candidate.type) ? candidate.type : "kingdom";
			const id = typeof candidate.id === "string" && candidate.id ? candidate.id : this.nextId(candidate.year);
			this.events.push(this.normalizeEvent({
				...candidate,
				id,
				year: candidate.year,
				type,
				text: candidate.text
			}));
		}
		this.prune();
	}
	clear() {
		this.events = [];
		this.sequence = 0;
	}
	nextId(year) {
		this.sequence = (this.sequence + 1) % 1e6;
		return `ev_${year}_${Date.now().toString(36)}_${this.sequence.toString(36)}`;
	}
	normalizeEvent(input) {
		return {
			id: input.id,
			year: Math.max(0, Math.round(input.year)),
			type: HISTORY_TYPES.has(input.type) ? input.type : "kingdom",
			text: String(input.text),
			title: input.title ? String(input.title) : void 0,
			importance: input.importance ?? "notable",
			scope: input.scope ?? "kingdom",
			refs: normalizeRefs(input.refs),
			tags: uniqueStrings(input.tags),
			causes: uniqueStrings(input.causes),
			consequences: uniqueStrings(input.consequences),
			relatedEventIds: uniqueStrings(input.relatedEventIds),
			threadId: input.threadId ? String(input.threadId) : void 0,
			threadTitle: input.threadTitle ? String(input.threadTitle) : void 0,
			data: input.data && typeof input.data === "object" ? { ...input.data } : {}
		};
	}
	/**
	* Keep a deep history without letting routine entries dominate localStorage.
	* Legendary/major events are protected first; oldest low-importance entries
	* are the first to go when the cap is reached.
	*/
	prune() {
		if (this.events.length <= MAX_EVENTS) return;
		const protectedEvents = this.events.filter((event) => IMPORTANCE_SCORE[event.importance] >= IMPORTANCE_SCORE.major);
		const routineEvents = this.events.filter((event) => IMPORTANCE_SCORE[event.importance] < IMPORTANCE_SCORE.major);
		const remaining = Math.max(0, MAX_EVENTS - protectedEvents.length);
		this.events = [...protectedEvents, ...routineEvents.slice(0, remaining)].sort((a, b) => b.year - a.year || b.id.localeCompare(a.id)).slice(0, MAX_EVENTS);
	}
};
var chronicle = new Chronicle();
//#endregion
//#region src/core/SoundSynth.ts
/**
* Web Audio API Sound Synthesizer.
* Creates retro/modern sound effects dynamically.
*/
var SoundSynth = class {
	ctx = null;
	master = null;
	muted = false;
	volume = .6;
	init() {
		if (!this.ctx && typeof window !== "undefined") {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			if (AudioCtx) {
				this.ctx = new AudioCtx();
				this.master = this.ctx.createGain();
				this.master.gain.value = this.volume;
				this.master.connect(this.ctx.destination);
			}
		}
		if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
	}
	toggleMute() {
		this.muted = !this.muted;
		return this.muted;
	}
	setMuted(muted) {
		this.muted = muted;
	}
	/** Master volume, 0..1. Applied to every effect. */
	setVolume(volume) {
		this.volume = Math.max(0, Math.min(1, volume));
		if (this.master) this.master.gain.value = this.volume;
	}
	getVolume() {
		return this.volume;
	}
	/** Output node every effect connects to, so the master volume always applies. */
	out() {
		return this.master ?? this.ctx.destination;
	}
	isMuted() {
		return this.muted;
	}
	playClick() {
		if (this.muted) return;
		this.init();
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(600, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + .05);
		gain.gain.setValueAtTime(.15, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(.01, this.ctx.currentTime + .05);
		osc.connect(gain);
		gain.connect(this.out());
		osc.start();
		osc.stop(this.ctx.currentTime + .05);
	}
	playThunder() {
		if (this.muted) return;
		this.init();
		if (!this.ctx) return;
		const bufferSize = this.ctx.sampleRate * .8;
		const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
		const noise = this.ctx.createBufferSource();
		noise.buffer = buffer;
		const filter = this.ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.setValueAtTime(400, this.ctx.currentTime);
		filter.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + .8);
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(.4, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(.01, this.ctx.currentTime + .8);
		noise.connect(filter);
		filter.connect(gain);
		gain.connect(this.out());
		noise.start();
	}
	playExplosion() {
		if (this.muted) return;
		this.init();
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(150, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + .4);
		gain.gain.setValueAtTime(.35, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(.01, this.ctx.currentTime + .4);
		osc.connect(gain);
		gain.connect(this.out());
		osc.start();
		osc.stop(this.ctx.currentTime + .4);
	}
	playHit() {
		if (this.muted) return;
		this.init();
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(220, this.ctx.currentTime);
		osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + .08);
		gain.gain.setValueAtTime(.2, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(.01, this.ctx.currentTime + .08);
		osc.connect(gain);
		gain.connect(this.out());
		osc.start();
		osc.stop(this.ctx.currentTime + .08);
	}
	playMagic() {
		if (this.muted) return;
		this.init();
		if (!this.ctx) return;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(400, this.ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + .25);
		gain.gain.setValueAtTime(.2, this.ctx.currentTime);
		gain.gain.linearRampToValueAtTime(.01, this.ctx.currentTime + .25);
		osc.connect(gain);
		gain.connect(this.out());
		osc.start();
		osc.stop(this.ctx.currentTime + .25);
	}
};
var sound = new SoundSynth();
//#endregion
//#region src/civ/Trade.ts
var MAX_ROUTES_PER_KINGDOM = 6;
var TradeNetwork = class {
	routes = /* @__PURE__ */ new Map();
	agreements = /* @__PURE__ */ new Map();
	embargoes = [];
	/** Total value moved across the whole world this year. Reset each settle. */
	yearlyVolume = 0;
	pairKey(a, b) {
		return a < b ? `${a}:${b}` : `${b}:${a}`;
	}
	hasAgreement(kingdomA, kingdomB) {
		return this.agreements.has(this.pairKey(kingdomA, kingdomB));
	}
	getAgreement(kingdomA, kingdomB) {
		return this.agreements.get(this.pairKey(kingdomA, kingdomB)) ?? null;
	}
	signAgreement(kingdomA, kingdomB, year, tariff = .08) {
		if (kingdomA === kingdomB) return null;
		const key = this.pairKey(kingdomA, kingdomB);
		if (this.agreements.has(key)) return null;
		if (this.isEmbargoed(kingdomA, kingdomB)) return null;
		const agreement = {
			id: key,
			kingdomA,
			kingdomB,
			signedYear: year,
			tariff: Math.max(0, Math.min(.4, tariff)),
			volumeTraded: 0
		};
		this.agreements.set(key, agreement);
		events.emit("tradeAgreementSigned", {
			agreement,
			kingdomA,
			kingdomB,
			year
		});
		return agreement;
	}
	cancelAgreement(kingdomA, kingdomB, year, reason) {
		const key = this.pairKey(kingdomA, kingdomB);
		if (!this.agreements.delete(key)) return;
		for (const [routeId, route] of [...this.routes]) if (this.pairKey(route.fromKingdomId, route.toKingdomId) === key) this.routes.delete(routeId);
		events.emit("tradeAgreementBroken", {
			kingdomA,
			kingdomB,
			year,
			reason
		});
	}
	isEmbargoed(kingdomA, kingdomB) {
		return this.embargoes.some((e) => e.byKingdom === kingdomA && e.againstKingdom === kingdomB || e.byKingdom === kingdomB && e.againstKingdom === kingdomA);
	}
	declareEmbargo(byKingdom, againstKingdom, year, reason) {
		if (this.isEmbargoed(byKingdom, againstKingdom)) return;
		this.embargoes.push({
			byKingdom,
			againstKingdom,
			year,
			reason
		});
		this.cancelAgreement(byKingdom, againstKingdom, year, `Embargo: ${reason}`);
		events.emit("embargoDeclared", {
			byKingdom,
			againstKingdom,
			year,
			reason
		});
	}
	liftEmbargo(byKingdom, againstKingdom) {
		this.embargoes = this.embargoes.filter((e) => !(e.byKingdom === byKingdom && e.againstKingdom === againstKingdom));
	}
	routesFor(kingdomId) {
		return [...this.routes.values()].filter((r) => r.fromKingdomId === kingdomId || r.toKingdomId === kingdomId);
	}
	routeCountFor(kingdomId) {
		return this.routesFor(kingdomId).length;
	}
	canOpenRoute(kingdomId) {
		return this.routeCountFor(kingdomId) < MAX_ROUTES_PER_KINGDOM;
	}
	hasRouteBetween(fromCityId, toCityId, good) {
		for (const route of this.routes.values()) {
			if (route.good !== good) continue;
			if (route.fromCityId === fromCityId && route.toCityId === toCityId || route.fromCityId === toCityId && route.toCityId === fromCityId) return true;
		}
		return false;
	}
	openRoute(params) {
		const route = {
			id: `route_${params.fromCityId}_${params.toCityId}_${params.good}`,
			fromCityId: params.fromCityId,
			toCityId: params.toCityId,
			fromKingdomId: params.fromKingdomId,
			toKingdomId: params.toKingdomId,
			kind: params.kind,
			good: params.good,
			volume: params.volume,
			maxVolume: params.volume,
			establishedYear: params.year,
			totalValue: 0,
			active: true
		};
		this.routes.set(route.id, route);
		events.emit("tradeRouteOpened", { route });
		return route;
	}
	closeRoute(routeId) {
		this.routes.delete(routeId);
	}
	/** Removes any route touching a city that no longer exists. */
	pruneRoutes(cityExists) {
		for (const [id, route] of [...this.routes]) if (!cityExists(route.fromCityId) || !cityExists(route.toCityId)) this.routes.delete(id);
	}
	/** Suspends routes between realms at war, reactivates the rest. */
	updateRouteStatus(isAtWar) {
		for (const route of this.routes.values()) route.active = !(isAtWar(route.fromKingdomId, route.toKingdomId) || this.isEmbargoed(route.fromKingdomId, route.toKingdomId));
	}
	recordTrade(route, value) {
		route.totalValue += value;
		this.yearlyVolume += value;
		const agreement = this.getAgreement(route.fromKingdomId, route.toKingdomId);
		if (agreement) agreement.volumeTraded += value;
	}
	resetYearlyVolume() {
		this.yearlyVolume = 0;
	}
	/** The busiest routes in the world, for the economy screen. */
	topRoutes(limit = 10) {
		return [...this.routes.values()].sort((a, b) => b.totalValue - a.totalValue).slice(0, limit);
	}
	/** Total lifetime value moved by one realm. */
	tradeValueFor(kingdomId) {
		return this.routesFor(kingdomId).reduce((sum, r) => sum + r.totalValue, 0);
	}
	serialize() {
		return {
			routes: [...this.routes.values()],
			agreements: [...this.agreements.values()],
			embargoes: this.embargoes
		};
	}
	deserialize(data) {
		this.routes.clear();
		this.agreements.clear();
		this.embargoes = data?.embargoes ?? [];
		for (const route of data?.routes ?? []) {
			if (route.maxVolume == null) route.maxVolume = route.volume;
			this.routes.set(route.id, route);
		}
		for (const agreement of data?.agreements ?? []) this.agreements.set(agreement.id, agreement);
	}
};
//#endregion
//#region src/civ/GreatPersons.ts
var GREAT_PERSON_TITLES = {
	scholar: [
		"the Wise",
		"the Enlightened",
		"Master of Stars",
		"the Arch-Scholar"
	],
	builder: [
		"the Architect",
		"Master Builder",
		"shaper of Stones",
		"the Grand Mason"
	],
	hero: [
		"the Undefeated",
		"Iron Heart",
		"Dragonslayer",
		"Champion of the Realm"
	],
	diplomat: [
		"the Peacemaker",
		"Silver-Tongue",
		"the Envoy",
		"Architect of Pacts"
	]
};
var MONUMENT_TYPES = [
	{
		type: "monument",
		name: "Statue of the Founder",
		desc: "+30% Kingdom Stability & Cultural Prestige"
	},
	{
		type: "great_library",
		name: "Great Library of Wisdom",
		desc: "+50% National Research Output & Ancient Records"
	},
	{
		type: "grand_aqueduct",
		name: "Grand Aqueduct of Nations",
		desc: "+50% City Population Capacity & Harvest"
	},
	{
		type: "colosseum",
		name: "Grand Colosseum of Legends",
		desc: "+30% Military Morale & Lowers War Weariness"
	}
];
var GreatPersonManager = class {
	static registry = /* @__PURE__ */ new Map();
	/** Check for entity ascension to Great Person status */
	static checkAscension(entities, kingdoms, cities, tileMap, year) {
		if (year < 5) return;
		for (const e of entities) {
			if (e.isGreatPerson || !e.kingdomId) continue;
			const kingdom = kingdoms.get(e.kingdomId);
			if (!kingdom) continue;
			let type = null;
			if (e.level >= 4 && e.profession === "scout" && Math.random() < .12) type = "scholar";
			else if (e.kills >= 3 || e.profession === "king" && kingdom.militaryPower > 150 && Math.random() < .1) type = "hero";
			else if (e.level >= 3 && (e.profession === "woodcutter" || e.profession === "miner") && Math.random() < .1) type = "builder";
			else if (e.level >= 4 && kingdom.knownKingdoms.size >= 2 && Math.random() < .08) type = "diplomat";
			if (type) {
				this.ascend(e, type, kingdom, cities, tileMap, year);
				break;
			}
		}
	}
	static ascend(e, type, kingdom, cities, tileMap, year) {
		e.isGreatPerson = true;
		e.greatPersonType = type;
		const titleSuffix = rng.pick(GREAT_PERSON_TITLES[type]);
		e.title = `${e.name} ${titleSuffix}`;
		const data = {
			id: e.id,
			name: e.name,
			type,
			title: e.title,
			birthYear: year,
			kingdomId: kingdom.id
		};
		this.registry.set(e.id, data);
		e.showEmote("crown", 60);
		chronicle.log(year, "great_person", `${e.title} emerged in ${kingdom.name} as a Great ${type}.`, {
			title: e.title,
			importance: "legendary",
			scope: "person",
			refs: [
				{
					kind: "person",
					id: e.id,
					name: e.title || e.name
				},
				{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				},
				...e.cityId && cities.get(e.cityId) ? [{
					kind: "city",
					id: e.cityId,
					name: cities.get(e.cityId).name
				}] : []
			],
			tags: [
				"great person",
				type,
				"legacy"
			],
			consequences: [`${e.title} became a remembered figure of ${kingdom.name}.`],
			threadId: `person:${e.id}`,
			threadTitle: `Life and Legacy of ${e.title}`,
			data: {
				greatPersonType: type,
				level: e.level,
				kills: e.kills
			}
		});
		events.emit("greatPersonBorn", {
			entity: e,
			type,
			kingdom,
			year
		});
		this.executeGreatAction(e, type, kingdom, cities, tileMap, year);
	}
	/** Execute unique legacy action for the Great Person */
	static executeGreatAction(e, type, kingdom, cities, tileMap, year) {
		const city = e.cityId ? cities.get(e.cityId) : Array.from(cities.values())[0];
		if (!city) return;
		switch (type) {
			case "scholar": {
				const techKeys = kingdom.research.availableTechs();
				if (techKeys.length > 0) {
					const tech = rng.pick(techKeys);
					kingdom.research.complete(tech.id);
					const opus = `The Codex of ${tech.name}`;
					chronicle.log(year, "great_person", `${e.title} authored "${opus}", completing the discovery of ${tech.name} for ${kingdom.name}.`, {
						title: opus,
						importance: "legendary",
						scope: "person",
						refs: [
							{
								kind: "person",
								id: e.id,
								name: e.title || e.name
							},
							{
								kind: "kingdom",
								id: kingdom.id,
								name: kingdom.name
							},
							{
								kind: "tech",
								id: tech.id,
								name: tech.name
							}
						],
						tags: [
							"magnum opus",
							"scholar",
							"technology"
						],
						causes: [`${e.title}'s scholarship produced a major breakthrough.`],
						consequences: [`${kingdom.name} completed ${tech.name}.`],
						threadId: `person:${e.id}`,
						threadTitle: `Life and Legacy of ${e.title}`
					});
				} else kingdom.treasury.add("gold", 100);
				break;
			}
			case "builder": {
				const alreadyBuilt = /* @__PURE__ */ new Set();
				for (const existing of cities.values()) for (const b of existing.buildings.values()) alreadyBuilt.add(b.type);
				const remaining = MONUMENT_TYPES.filter((m) => !alreadyBuilt.has(m.type));
				if (remaining.length === 0) {
					kingdom.treasury.add("gold", 250);
					chronicle.log(year, "great_person", `${e.title} found every great wonder already built, and endowed the treasury of ${kingdom.name} instead.`, {
						title: `${e.title}'s Endowment`,
						importance: "major",
						scope: "person",
						refs: [{
							kind: "person",
							id: e.id,
							name: e.title || e.name
						}, {
							kind: "kingdom",
							id: kingdom.id,
							name: kingdom.name
						}],
						tags: [
							"builder",
							"endowment",
							"treasury"
						],
						consequences: [`${kingdom.name} received a major treasury endowment.`],
						threadId: `person:${e.id}`,
						threadTitle: `Life and Legacy of ${e.title}`
					});
					break;
				}
				if (!(city.tier !== "camp" && city.tier !== "hamlet" && city.hasFreeBuildingSlot())) {
					kingdom.treasury.add("gold", 250);
					chronicle.log(year, "great_person", `${e.title} judged ${city.name} too small for a monument, and endowed the treasury of ${kingdom.name} instead.`);
					break;
				}
				const monument = rng.pick(remaining);
				const bId = `wonder_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
				const building = new Building(bId, monument.type, city.x + 1, city.y + 1, city.id);
				city.buildings.set(bId, building);
				const tile = tileMap.getTile(city.x + 1, city.y + 1);
				if (tile) tile.buildingId = bId;
				kingdom.economy.stability = Math.min(1, kingdom.economy.stability + .25);
				chronicle.log(year, "wonder", `${e.title} financed and constructed the ${monument.name} in ${city.name}.`, {
					title: monument.name,
					importance: "legendary",
					scope: "city",
					refs: [
						{
							kind: "person",
							id: e.id,
							name: e.title || e.name
						},
						{
							kind: "city",
							id: city.id,
							name: city.name
						},
						{
							kind: "kingdom",
							id: kingdom.id,
							name: kingdom.name
						},
						{
							kind: "building",
							id: building.id,
							name: monument.name
						}
					],
					tags: [
						"wonder",
						"builder",
						monument.type
					],
					causes: [`${e.title} used their great legacy to undertake a monumental work.`],
					consequences: [monument.desc],
					threadId: `person:${e.id}`,
					threadTitle: `Life and Legacy of ${e.title}`
				});
				break;
			}
			case "hero": {
				const itemTemplate = rng.pick(LEGENDARY_ITEMS);
				e.equipment.weapon = {
					...itemTemplate,
					id: `hero_w_${Date.now()}`
				};
				e.recalculateStats();
				kingdom.warWeariness = Math.max(0, kingdom.warWeariness - 30);
				chronicle.log(year, "great_person", `${e.title} rallied the armies of ${kingdom.name} and became a symbol of military resolve.`, {
					title: `Heroic Legacy of ${e.title}`,
					importance: "legendary",
					scope: "person",
					refs: [{
						kind: "person",
						id: e.id,
						name: e.title || e.name
					}, {
						kind: "kingdom",
						id: kingdom.id,
						name: kingdom.name
					}],
					tags: [
						"hero",
						"war",
						"morale"
					],
					consequences: [`War weariness in ${kingdom.name} fell sharply and ${e.title} received legendary arms.`],
					threadId: `person:${e.id}`,
					threadTitle: `Life and Legacy of ${e.title}`
				});
				break;
			}
			case "diplomat":
				for (const targetId of kingdom.knownKingdoms) events.emit("diplomaticPact", {
					from: kingdom.id,
					to: targetId,
					pact: "Non-Aggression"
				});
				kingdom.economy.stability = Math.min(1, kingdom.economy.stability + .2);
				chronicle.log(year, "great_person", `${e.title} brokered grand non-aggression treaties for ${kingdom.name}.`, {
					title: `Diplomatic Legacy of ${e.title}`,
					importance: "legendary",
					scope: "person",
					refs: [{
						kind: "person",
						id: e.id,
						name: e.title || e.name
					}, {
						kind: "kingdom",
						id: kingdom.id,
						name: kingdom.name
					}],
					tags: [
						"diplomat",
						"treaty",
						"peace"
					],
					consequences: [`${kingdom.name} gained stability and new non-aggression commitments.`],
					threadId: `person:${e.id}`,
					threadTitle: `Life and Legacy of ${e.title}`
				});
		}
	}
};
//#endregion
//#region src/world/Tile.ts
/** Maps a tile resource onto the good it yields when harvested. */
function tileResourceToGood(resource) {
	return resource;
}
var Tile = class {
	x;
	y;
	height;
	type;
	temperature;
	moisture;
	fertility;
	resourceType;
	resourceAmount;
	resourceMax;
	buildingId;
	kingdomId;
	cityId;
	isOnFire;
	fireTimer;
	roadLevel = 0;
	roadTraffic = 0;
	constructor(x, y, type = TerrainType.DEEP_OCEAN, height = 0) {
		this.x = x;
		this.y = y;
		this.type = type;
		this.height = height;
		this.temperature = 20;
		this.moisture = .5;
		this.fertility = .5;
		this.resourceType = null;
		this.resourceAmount = 0;
		this.resourceMax = 0;
		this.buildingId = null;
		this.kingdomId = null;
		this.cityId = null;
		this.isOnFire = false;
		this.fireTimer = 0;
	}
};
//#endregion
//#region src/civ/CivilizationEngine.ts
/** Food a single citizen eats per year. */
var FOOD_PER_CITIZEN = 1.1;
/**
* Research a citizen contributes even with no buildings.
*
* This is the bootstrap of the whole tech tree, and it has to carry a settlement
* all the way to `agriculture` before a single knowledge building can exist. At
* 0.09 a starting band of ten produced ~1 point a year against a 30-point first
* technology, so no realm ever left the stone age and every downstream system
* (jobs, crafting, trade, naval) stayed unreachable.
*/
var RESEARCH_PER_CITIZEN = .55;
/**
* Wild food one citizen can gather per year before agriculture.
*
* A citizen eats up to 1.375 a year, so gathering 1.5 left a band living hand to
* mouth: stock never accumulated, and since childbirth requires food in store,
* settlements sat at four or five people forever. A forager has to bring in a
* real surplus. The Malthusian ceiling still holds — it is now set by how many
* wild-food tiles the territory actually has, not by the per-person rate.
*/
var FORAGE_PER_CITIZEN = 2.8;
/** Yearly ceiling on how hard a single wild-food tile can be worked. */
var FORAGE_PER_TILE = 3;
/**
* Timber one citizen can cut by hand per year, with no lumber camp.
* Kept well below a camp's output so the camp is always worth building.
*/
var HAND_WOOD_PER_CITIZEN = .4;
var HAND_WOOD_PER_TILE = 1.5;
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
var CivilizationEngine = class {
	/** Set once a realm first mints money, so the chronicle only says it once. */
	announcedCurrencies = /* @__PURE__ */ new Set();
	reset() {
		this.announcedCurrencies.clear();
	}
	tickYear(world) {
		this.recountPopulations(world);
		for (const city of world.cities.values()) this.tickSettlement(city, world);
		this.refreshKingdomTotals(world);
		for (const kingdom of world.kingdoms.values()) {
			this.collectTaxes(kingdom, world);
			this.tickResearch(kingdom, world);
			this.tickEconomy(kingdom, world);
			this.tickCulture(kingdom, world);
			this.tickSociety(kingdom, world);
			this.tickLaws(kingdom, world);
			this.tickGovernment(kingdom, world);
		}
		this.tickDiplomaticContact(world);
		this.tickStrategicDiplomacy(world);
		this.tickTrade(world);
		this.tickVassalage(world);
		this.tickColonisation(world);
		this.tickRebellions(world);
		this.tickTradeBanditry(world);
		GreatPersonManager.checkAscension(world.entities, world.kingdoms, world.cities, world.tileMap, world.year);
		world.market.settle(world.year);
		world.tileMap.regrowResources();
		world.sim?.caravans.decayRoadTraffic(world.tileMap);
		for (const city of world.cities.values()) city.rebuildResourceCache(world.tileMap, world.year, this.citySurveyRadius(city));
		this.cleanupDeadRealms(world);
	}
	tickSettlement(city, world) {
		const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;
		const techMods = kingdom?.research.modifiers() ?? {
			production: 1,
			research: 1,
			growth: 1,
			trade: 1,
			military: 1,
			territory: 0
		};
		const gov = kingdom ? GOVERNMENTS[kingdom.government] : null;
		const lawEffects = kingdom ? aggregateLawEffects(kingdom.laws) : null;
		const culture = kingdom?.culture;
		const productionCulture = culture ? .94 + culture.innovation * .08 + culture.collectivism * .05 + culture.stewardship * .03 - culture.warTrauma * .04 : 1;
		const researchCulture = culture ? .9 + culture.innovation * .16 + culture.openness * .06 - culture.tradition * .03 : 1;
		const expansionCulture = culture ? (culture.expansionism - .5) * 12 - Math.max(0, culture.stewardship - .62) * 5 : 0;
		const productionSociety = kingdom ? .88 + kingdom.society.factions.workers.satisfaction * .08 + kingdom.society.factions.peasants.satisfaction * .05 + kingdom.society.cohesion * .06 - kingdom.society.factions.workers.radicalization * kingdom.society.factions.workers.influence * .18 : 1;
		const productionMult = techMods.production * (gov?.production ?? 1) * productionCulture * productionSociety * (1 + (lawEffects?.production ?? 0));
		const speciesResearchBonus = kingdom?.species === SpeciesType.LUMINI ? 1.3 : kingdom?.species === SpeciesType.STONEKIN ? .85 : 1;
		const researchMult = techMods.research * (gov?.research ?? 1) * researchCulture * (1 + (lawEffects?.research ?? 0)) * speciesResearchBonus;
		this.produceGoods(city, world, productionMult);
		this.consumeGoods(city, world);
		this.runConstruction(city, world, kingdom);
		this.expandTerritory(city, world, techMods.territory + (gov?.expansion ?? 8) + expansionCulture + (lawEffects?.expansion ?? 0));
		city.researchOutput = this.computeResearch(city) * researchMult;
		city.updateTier();
	}
	/** Buildings turn real labour, deposits and recipe inputs into goods. */
	produceGoods(city, world, multiplier) {
		const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;
		const labourPool = world.entities.filter((e) => e.cityId === city.id && e.hp > 0 && SPECIES_DEFINITIONS[e.species].isHumanoid && !e.isChild && ![
			"soldier",
			"archer",
			"leader",
			"king"
		].includes(e.profession));
		const priority = (building) => {
			const def = building.definition;
			if (def.category === "food") return 100;
			if (def.category === "extraction") return 92;
			if (def.category === "craft") return 78;
			if (def.category === "knowledge") return 58;
			if (def.category === "commerce") return 52;
			if (def.category === "power") return 42;
			return 48;
		};
		const staffed = [...city.buildings.values()].sort((a, b) => priority(b) - priority(a));
		let labourRemaining = labourPool.length;
		let workerCursor = 0;
		for (const building of staffed) {
			const jobs = building.definition.jobs ?? 0;
			if (jobs <= 0) {
				building.staffing = 1;
				continue;
			}
			const assigned = Math.min(jobs, labourRemaining);
			building.staffing = jobs <= 0 ? 1 : assigned / jobs;
			labourRemaining -= assigned;
			const workers = labourPool.slice(workerCursor, workerCursor + assigned);
			workerCursor += assigned;
			for (const worker of workers) this.assignVisibleWorker(worker, building);
		}
		let output = 0;
		for (const building of staffed) {
			const def = building.definition;
			if ((def.jobs ?? 0) > 0 && building.staffing <= 0) continue;
			if (def.category !== "craft" && def.consumes) {
				let affordable = true;
				for (const [goodKey, amountValue] of Object.entries(def.consumes)) {
					const good = goodKey;
					const amount = amountValue * Math.max(.25, building.outputMultiplier());
					world.market.reportDemand(good, amount);
					if (city.stock.get(good) < amount) affordable = false;
				}
				if (!affordable) continue;
				for (const [goodKey, amountValue] of Object.entries(def.consumes)) city.stock.take(goodKey, amountValue * Math.max(.25, building.outputMultiplier()));
			}
			let scale = building.outputMultiplier() * multiplier;
			if (kingdom) {
				if (kingdom.species === SpeciesType.SYLVANII && def.type === "lumber_camp") scale *= 1.35;
				if (kingdom.species === SpeciesType.STONEKIN && (def.type === "mine" || def.type === "quarry")) scale *= 1.35;
			}
			if (def.resourceTargets?.length) {
				const tile = world.tileMap.getTile(building.x, building.y);
				const naturalGood = tileResourceToGood(tile?.resourceType ?? null);
				const matches = !!naturalGood && def.resourceTargets.includes(naturalGood);
				if (def.resourceMode === "required") {
					if (!tile || !matches || tile.resourceAmount <= 0) {
						building.staffing = Math.min(building.staffing, .15);
						continue;
					}
					building.extractedGood = naturalGood;
					const wanted = (def.extractionRate ?? 5) * scale;
					const extracted = Math.min(wanted, tile.resourceAmount);
					tile.resourceAmount = Math.max(0, tile.resourceAmount - extracted);
					const stored = city.stock.add(naturalGood, extracted);
					output += stored * world.market.price(naturalGood);
					world.market.reportSupply(naturalGood, stored);
					continue;
				}
				if (matches && tile && naturalGood && tile.resourceAmount > 0) {
					building.extractedGood = naturalGood;
					const bonusRate = naturalGood === "food" ? (def.extractionRate ?? 2) * .45 : def.extractionRate ?? 2;
					const harvested = Math.min(bonusRate * scale, tile.resourceAmount);
					tile.resourceAmount = Math.max(0, tile.resourceAmount - harvested);
					const stored = city.stock.add(naturalGood, harvested);
					output += stored * world.market.price(naturalGood);
					world.market.reportSupply(naturalGood, stored);
				} else building.extractedGood = null;
			}
			if (def.category === "craft" && def.craftCapacity) {
				output += this.runCraftProduction(city, world, kingdom, building, def.craftCapacity * scale);
				continue;
			}
			if (!def.produces) continue;
			for (const [goodKey, amountValue] of Object.entries(def.produces)) {
				const good = goodKey;
				const stored = city.stock.add(good, amountValue * scale);
				output += stored * world.market.price(good);
				world.market.reportSupply(good, stored);
			}
		}
		const foraged = this.forageWildFood(city, world);
		output += foraged * world.market.price("food");
		const cutWood = this.gatherWildWood(city, world);
		output += cutWood * world.market.price("wood");
		city.economicOutput = output;
	}
	/** Hand-cut timber from the settlement's territory. Deliberately inefficient. */
	gatherWildWood(city, world) {
		let effort = city.population * HAND_WOOD_PER_CITIZEN;
		if (effort <= 0) return 0;
		let gathered = 0;
		for (const pos of city.resourcesByGood.get("wood") ?? []) {
			if (effort <= 0) break;
			const tile = world.tileMap.getTile(pos.x, pos.y);
			if (!tile || tile.resourceType !== "wood" || tile.resourceAmount <= 0) continue;
			const taken = Math.min(effort, tile.resourceAmount, HAND_WOOD_PER_TILE);
			tile.resourceAmount -= taken;
			gathered += taken;
			effort -= taken;
		}
		const stored = city.stock.add("wood", gathered);
		world.market.reportSupply("wood", stored);
		return stored;
	}
	/** Draws wild food from the settlement's own territory. Returns units stored. */
	forageWildFood(city, world) {
		let effort = city.population * FORAGE_PER_CITIZEN;
		if (effort <= 0) return 0;
		let gathered = 0;
		for (const pos of city.resourcesByGood.get("food") ?? []) {
			if (effort <= 0) break;
			const tile = world.tileMap.getTile(pos.x, pos.y);
			if (!tile || tile.resourceType !== "food" || tile.resourceAmount <= 0) continue;
			const taken = Math.min(effort, tile.resourceAmount, FORAGE_PER_TILE);
			tile.resourceAmount -= taken;
			gathered += taken;
			effort -= taken;
		}
		gathered += Math.min(effort, city.population * .12);
		const stored = city.stock.add("food", gathered);
		world.market.reportSupply("food", stored);
		return stored;
	}
	assignVisibleWorker(worker, building) {
		if (![
			"idle",
			"wander",
			"socialize",
			"explore",
			"return_city",
			"craft"
		].includes(worker.aiState)) return;
		const type = building.type;
		if (type === "farm" || type === "pasture") {
			worker.profession = "farmer";
			worker.aiState = "gather_food";
		} else if (type === "lumber_camp") {
			worker.profession = "woodcutter";
			worker.aiState = "gather_wood";
		} else if (type === "mine" || type === "quarry" || type === "oil_well") {
			worker.profession = "miner";
			worker.aiState = "gather_ore";
		} else if (type === "workshop" || type === "smithy" || type === "factory" || type === "refinery") {
			worker.profession = "builder";
			worker.workplaceId = building.id;
			worker.aiState = "craft";
		}
		worker.targetX = building.x + .5;
		worker.targetY = building.y + .5;
	}
	runCraftProduction(city, world, kingdom, building, capacity) {
		const outputs = CRAFTED_GOODS.filter((good) => GOODS[good].producedBy === building.type);
		if (outputs.length === 0 || capacity <= 0) return 0;
		let remaining = capacity;
		let value = 0;
		let safety = 0;
		while (remaining > .05 && safety++ < 8) {
			let best = null;
			for (const good of outputs) {
				const recipes = productionRecipesFor(good).filter((recipe) => !recipe.requiresTech || !!kingdom?.research.knows(recipe.requiresTech));
				for (const recipe of recipes) {
					let maxCycles = remaining;
					let missingValue = 0;
					for (const [inputKey, qtyValue] of Object.entries(recipe.inputs)) {
						const input = inputKey;
						const qty = qtyValue;
						maxCycles = Math.min(maxCycles, city.stock.get(input) / Math.max(.001, qty));
						const desired = qty * remaining;
						if (city.stock.get(input) < desired) {
							const missing = desired - city.stock.get(input);
							world.market.reportDemand(input, missing);
							missingValue += missing * world.market.price(input);
						}
					}
					const held = city.stock.get(good);
					const target = good === "machinery" ? Math.max(12, city.population * .12) : good === "fuel" || good === "gunpowder" ? Math.max(18, city.population * .18) : Math.max(28, city.population * .45);
					const shortage = clamp((target - held) / Math.max(1, target), 0, 1.5);
					const strategic = GOODS[good].strategic ? 1.35 : 1;
					const score = GOODS[good].basePrice * strategic * (.55 + shortage * 1.8) - missingValue * .02;
					if (maxCycles > .03 && (!best || score > best.score)) best = {
						good,
						recipe,
						score,
						maxCycles
					};
				}
			}
			if (!best) break;
			const cycles = Math.min(remaining, best.maxCycles);
			for (const [inputKey, qtyValue] of Object.entries(best.recipe.inputs)) city.stock.take(inputKey, qtyValue * cycles);
			const produced = best.recipe.output * cycles;
			const stored = city.stock.add(best.good, produced);
			world.market.reportSupply(best.good, stored);
			value += stored * world.market.price(best.good);
			remaining -= cycles;
		}
		return value;
	}
	/** People eat. Buildings and armies cost upkeep. Shortfall causes famine. */
	consumeGoods(city, world) {
		const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) ?? null : null;
		const species = kingdom?.species ?? SpeciesType.LUMINI;
		const foodRatio = species === SpeciesType.LUMINI || species === SpeciesType.EMBERKIN ? 1.25 : species === SpeciesType.STONEKIN ? 1.1 : .9;
		const needed = city.population * FOOD_PER_CITIZEN * foodRatio;
		world.market.reportDemand("food", needed);
		this.reportLivingStandards(city, world);
		const eaten = city.stock.take("food", needed);
		const satisfaction = needed <= 0 ? 1 : eaten / needed;
		if (satisfaction < .85) {
			city.famineYears++;
			const starved = Math.ceil(city.population * (1 - satisfaction) * .35);
			if (starved > 0) this.killCitizens(city, world, starved, "starvation");
			if (city.famineYears === 3) chronicle.log(world.year, "famine", `Famine grips ${city.name}. The granaries are empty.`, {
				title: `The Famine of ${city.name}`,
				importance: "major",
				scope: "city",
				refs: [{
					kind: "city",
					id: city.id,
					name: city.name
				}, ...kingdom ? [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}] : []],
				tags: [
					"famine",
					"food",
					"starvation"
				],
				causes: ["Food supply remained below survival needs for three consecutive years."],
				consequences: ["Population loss and declining prosperity followed the shortage."],
				threadId: `famine:${city.id}:${world.year - 2}`,
				threadTitle: `The Famine of ${city.name}`,
				data: {
					foodSatisfaction: Number(satisfaction.toFixed(3)),
					famineYears: city.famineYears,
					deathsThisYear: starved
				}
			});
		} else city.famineYears = 0;
		const housing = city.housingCapacity();
		const housingRatio = city.population <= 0 ? 1 : Math.min(1, housing / city.population);
		const goodsRatio = Math.min(1, city.stock.fullness() * 3);
		const target = satisfaction * .5 + housingRatio * .3 + goodsRatio * .2;
		city.prosperity += (target - city.prosperity) * .3;
	}
	/**
	* Consumer demand from the population itself.
	*
	* Households consume cloth and tools as a matter of living standard, and
	* wealthier settlements start wanting luxuries. Goods actually on hand are
	* slowly consumed, which both feeds the market and rewards a settlement for
	* producing more than it strictly needs.
	*/
	reportLivingStandards(city, world) {
		const population = city.population;
		if (population <= 0) return;
		const wants = {
			cloth: population * .12,
			tools: population * .08,
			wood: population * .15,
			stone: population * .06
		};
		if (city.prosperity > .6 && city.population > 20) wants.gems = population * .02;
		for (const [goodKey, amount] of Object.entries(wants)) {
			const good = goodKey;
			const want = amount;
			world.market.reportDemand(good, want);
			const consumed = city.stock.take(good, Math.min(want, city.stock.get(good) * .25));
			if (consumed > 0 && (good === "cloth" || good === "tools" || good === "gems")) city.prosperity = Math.min(1, city.prosperity + consumed / Math.max(1, population * 40));
		}
	}
	/** Population is whatever actually lives there — no separate abstract counter. */
	recountPopulations(world) {
		const counts = /* @__PURE__ */ new Map();
		for (const entity of world.entities) {
			if (!entity.cityId) continue;
			if (!SPECIES_DEFINITIONS[entity.species].isHumanoid) continue;
			counts.set(entity.cityId, (counts.get(entity.cityId) ?? 0) + 1);
		}
		for (const [id, city] of [...world.cities]) {
			city.population = counts.get(id) ?? 0;
			if (city.population <= 0 && world.year > city.foundingYear + 2) this.abandonSettlement(city, world);
		}
	}
	abandonSettlement(city, world) {
		if (city.besiegerId) {
			const occupier = world.kingdoms.get(city.besiegerId);
			if (occupier) {
				this.occupyEmptiedSettlement(city, occupier, world);
				return;
			}
		}
		for (const key of city.territory) {
			const [x, y] = key.split(",").map(Number);
			const tile = world.tileMap.getTile(x, y);
			if (tile && tile.cityId === city.id) {
				tile.cityId = null;
				tile.kingdomId = null;
				tile.buildingId = null;
			}
		}
		if (city.kingdomId) world.kingdoms.get(city.kingdomId)?.removeCity(city.id);
		world.cities.delete(city.id);
		chronicle.log(world.year, "disaster", `${city.name} was abandoned. Only ruins remain.`, {
			title: `The Abandonment of ${city.name}`,
			importance: "major",
			scope: "city",
			refs: [{
				kind: "city",
				id: city.id,
				name: city.name
			}, ...city.kingdomId ? [{
				kind: "kingdom",
				id: city.kingdomId
			}] : []],
			tags: [
				"abandonment",
				"ruins",
				"population"
			],
			causes: ["The settlement lost its last surviving inhabitants."],
			consequences: ["Its territory and buildings passed into ruin."]
		});
		events.emit("settlementAbandoned", {
			city,
			year: world.year
		});
	}
	/**
	* The besieging army marches into an emptied settlement and garrisons it.
	* The town survives under a new flag rather than vanishing from the map.
	*/
	occupyEmptiedSettlement(city, occupier, world) {
		const previousOwner = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
		previousOwner?.removeCity(city.id);
		occupier.addCity(city.id);
		city.formerOwnerId = previousOwner?.id ?? null;
		city.kingdomId = occupier.id;
		city.capturedYear = world.year;
		city.besiegerId = null;
		city.siegeProgress = 0;
		city.siegeYears = 0;
		city.prosperity = .25;
		city.species = occupier.species;
		for (const key of city.territory) {
			const [x, y] = key.split(",").map(Number);
			const tile = world.tileMap.getTile(x, y);
			if (tile && tile.cityId === city.id) tile.kingdomId = occupier.id;
		}
		const garrison = world.entities.filter((e) => e.kingdomId === occupier.id && e.hp > 0 && SPECIES_DEFINITIONS[e.species].isHumanoid).sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y)).slice(0, 5);
		for (const soldier of garrison) {
			soldier.cityId = city.id;
			soldier.aiState = "idle";
			soldier.aiCooldown = 0;
			soldier.targetX = null;
			soldier.targetY = null;
		}
		city.population = garrison.length;
		chronicle.log(world.year, "conquest", `${occupier.name} occupied the emptied ${city.name}${previousOwner ? `, taking it from ${previousOwner.name}` : ""}.`, {
			title: `Occupation of ${city.name}`,
			importance: "major",
			scope: "international",
			refs: [
				{
					kind: "city",
					id: city.id,
					name: city.name
				},
				{
					kind: "kingdom",
					id: occupier.id,
					name: occupier.name
				},
				...previousOwner ? [{
					kind: "kingdom",
					id: previousOwner.id,
					name: previousOwner.name
				}] : []
			],
			tags: [
				"occupation",
				"conquest",
				"siege"
			],
			causes: ["The settlement was emptied while an enemy army controlled its approaches."],
			consequences: [`${occupier.name} installed a new garrison and claimed the settlement.`]
		});
		events.emit("cityOccupied", {
			city,
			occupier,
			previousOwner,
			year: world.year
		});
	}
	/**
	* Picks and erects one building per year.
	* The choice is driven by what the settlement is short of, filtered by what
	* its kingdom actually knows how to build.
	*/
	/**
	* A settlement's whole building programme for the year.
	* Projects that cannot be sited no longer block the whole city for that year.
	*/
	runConstruction(city, world, kingdom) {
		const projects = Math.max(1, Math.min(4, Math.floor(city.population / 15) + 1));
		for (let i = 0; i < projects; i++) {
			if (!city.hasFreeBuildingSlot()) break;
			if (!this.constructBuilding(city, world, kingdom)) {
				this.tryUpgradeBuilding(city);
				break;
			}
		}
	}
	/** Erects one feasible building, considering its physical site before selecting it. */
	constructBuilding(city, world, kingdom) {
		if (!city.hasFreeBuildingSlot()) return false;
		const unlocked = new Set(BASE_BUILDINGS);
		for (const b of kingdom?.research.unlockedBuildings() ?? []) unlocked.add(b);
		const candidates = [];
		for (const type of unlocked) {
			const def = BUILDINGS[type];
			if (!def) continue;
			if (def.unique && city.hasBuilding(type)) continue;
			if (type === "port" && !city.hasBuilding("harbor")) continue;
			const spot = this.findBuildingSite(city, world.tileMap, def);
			if (!spot) continue;
			const score = this.scoreBuilding(type, city, kingdom, world, spot.resourceGood, spot.siteScore);
			if (score <= 0) continue;
			if (!city.stock.hasAll(def.cost)) {
				for (const [goodKey, amountValue] of Object.entries(def.cost)) {
					const good = goodKey;
					const missing = amountValue - city.stock.get(good);
					if (missing > 0) world.market.reportDemand(good, missing);
				}
				continue;
			}
			candidates.push({
				type,
				score,
				spot
			});
		}
		if (candidates.length === 0) return false;
		candidates.sort((a, b) => b.score - a.score);
		const pick = candidates[rng.chance(.82) ? 0 : Math.min(1, candidates.length - 1)];
		const def = BUILDINGS[pick.type];
		if (!city.stock.spend(def.cost)) return false;
		const building = city.addBuilding(pick.type, pick.spot.x, pick.spot.y);
		const tile = world.tileMap.getTile(pick.spot.x, pick.spot.y);
		tile.buildingId = building.id;
		tile.cityId = city.id;
		if (city.kingdomId) tile.kingdomId = city.kingdomId;
		city.territory.add(`${pick.spot.x},${pick.spot.y}`);
		this.paveRoadBetween(city.x, city.y, pick.spot.x, pick.spot.y, world.tileMap);
		if (def.resourceTargets?.length && pick.spot.resourceGood && def.resourceTargets.includes(pick.spot.resourceGood)) building.extractedGood = pick.spot.resourceGood;
		if ([
			"mine",
			"quarry",
			"oil_well",
			"harbor",
			"port",
			"academy",
			"bank",
			"factory",
			"refinery",
			"palace",
			"stock_exchange",
			"collective"
		].includes(pick.type)) {
			const resourceLabel = building.extractedGood ? ` over a ${GOODS[building.extractedGood].name} deposit` : "";
			chronicle.log(world.year, "founding", `${city.name} completed its ${def.name}${resourceLabel}.`);
		}
		return true;
	}
	paveRoadBetween(x0, y0, x1, y1, tileMap) {
		let cx = Math.floor(x0);
		let cy = Math.floor(y0);
		const targetX = Math.floor(x1);
		const targetY = Math.floor(y1);
		for (let step = 0; step < 40; step++) {
			if (cx === targetX && cy === targetY) break;
			const dx = Math.sign(targetX - cx);
			const dy = Math.sign(targetY - cy);
			if (rng.chance(.5) && dx !== 0) cx += dx;
			else if (dy !== 0) cy += dy;
			else cx += dx;
			const tile = tileMap.getTile(cx, cy);
			if (tile && tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.LAVA) {
				if (tile.roadLevel < 2) {
					tile.roadLevel = 2;
					tile.roadTraffic = Math.max(35, tile.roadTraffic + 20);
				}
			}
		}
	}
	/** How badly this settlement needs a given feasible building right now. */
	scoreBuilding(type, city, kingdom, world, resourceGood, siteScore) {
		const def = BUILDINGS[type];
		const population = Math.max(1, city.population);
		const housingRatio = city.housingCapacity() / population;
		const foodPerHead = city.stock.get("food") / population;
		let score = siteScore * .15;
		if (def.produces?.food && foodPerHead < 3) score += 90 - foodPerHead * 12;
		if (def.housing) {
			if (housingRatio < 1.6) score += 70 * (1.6 - housingRatio);
			const nextTier = SETTLEMENT_TIERS.find((t) => t.minPopulation > city.population);
			if (nextTier && city.housingCapacity() < nextTier.minPopulation) score += 55;
		}
		if (resourceGood && def.resourceTargets?.includes(resourceGood)) {
			const held = city.stock.get(resourceGood);
			const price = world.market.price(resourceGood);
			score += 38 + Math.min(80, price * 1.2) + (held < 30 ? 35 : held < 80 ? 16 : 0);
			if (GOODS[resourceGood].strategic) score += 70;
			if (resourceGood === "oil" && kingdom?.research.knows("industrialization")) score += 95;
		}
		if (def.produces) for (const [goodKey, amountValue] of Object.entries(def.produces)) {
			const good = goodKey;
			const held = city.stock.get(good);
			score += amountValue * (held < 40 ? 2.2 : .7) * (GOODS[good].basePrice / 9);
		}
		if (def.category === "craft" && def.craftCapacity) {
			const possible = CRAFTED_GOODS.filter((g) => GOODS[g].producedBy === type && productionRecipesFor(g).some((r) => !r.requiresTech || !!kingdom?.research.knows(r.requiresTech)));
			if (possible.length === 0) return 0;
			let craftPull = 0;
			for (const good of possible) {
				const held = city.stock.get(good);
				const target = Math.max(16, population * (GOODS[good].strategic ? .15 : .35));
				craftPull += GOODS[good].basePrice * clamp((target - held) / target, .05, 1.2);
			}
			score += Math.min(120, craftPull * .65);
			if (type === "refinery" && city.stock.get("oil") < 4) score *= .28;
			if (type === "factory" && city.stock.get("steel") < 5) score *= .4;
		}
		if (type === "harbor") {
			score += population >= 18 ? 70 : 20;
			if (kingdom?.culture.mercantilism && kingdom.culture.mercantilism > .58) score += 28;
		}
		if (type === "port") {
			if (!city.hasBuilding("harbor")) return 0;
			score += population >= 45 ? 95 : 20;
			if (kingdom?.research.knows("engineering")) score += 35;
		}
		if (def.research) score += def.research * 4;
		if (def.defense) score += (def.defense - 1) * (kingdom?.warWeariness ? 80 : 18);
		if (def.storage) score += city.stock.fullness() > .6 ? 35 : 8;
		const existing = city.countOfType(type);
		const repeatPenalty = def.housing || def.produces?.food || def.category === "extraction" ? .16 : .7;
		score /= 1 + existing * repeatPenalty;
		if (Object.values(def.cost).reduce((sum, v) => sum + v, 0) > 100 && city.population < 25) score *= .3;
		return score;
	}
	tryUpgradeBuilding(city) {
		const upgradable = [...city.buildings.values()].filter((b) => b.level < 3 && city.stock.hasAll(b.upgradeCost()));
		if (upgradable.length === 0) return;
		const target = upgradable.sort((a, b) => (b.definition.jobs ?? 0) - (a.definition.jobs ?? 0))[0];
		if (city.stock.spend(target.upgradeCost())) target.upgrade();
	}
	citySurveyRadius(city) {
		const tierBonus = {
			camp: 0,
			hamlet: 1,
			village: 2,
			town: 4,
			city: 6,
			metropolis: 8
		}[city.tier] ?? 0;
		return Math.min(22, 7 + tierBonus + Math.floor(Math.sqrt(Math.max(0, city.population)) / 2));
	}
	urbanSiteScore(city, tileMap, x, y) {
		const gridStyle = SPECIES_DEFINITIONS[city.species]?.urbanGridStyle ?? "concentric_rings";
		const tile = tileMap.getTile(x, y);
		const dx = x - city.x;
		const dy = y - city.y;
		const dist = Math.hypot(dx, dy);
		let score = 10 - dist * .35;
		if (gridStyle === "concentric_rings") {
			if (Math.abs(dist - Math.round(dist)) < .25) score += 12;
			if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) score += 8;
		} else if (gridStyle === "orthogonal_citadel") {
			if (dx % 2 === 0 && dy % 2 === 0) score += 18;
			else if (dx % 3 === 0 || dy % 3 === 0) score += 8;
		} else if (gridStyle === "diagonal_chevron") {
			if (Math.abs(dx) === Math.abs(dy)) score += 20;
			else if ((dx + dy) % 2 === 0) score += 9;
		} else if (gridStyle === "organic_canopy") {
			if (tile.type === TerrainType.FOREST) score += 12;
			if (tileMap.getNeighbors(x, y, false).some((n) => n.type === TerrainType.FOREST)) score += 8;
		}
		if (city.territory.has(`${x},${y}`)) score += 8;
		return score;
	}
	findBuildingSite(city, tileMap, def) {
		const radius = this.citySurveyRadius(city);
		const candidates = [];
		if (def.resourceMode === "required" && def.resourceTargets?.length) {
			for (const tile of tileMap.findResourceSites(city.x, city.y, radius, def.resourceTargets, false)) {
				if (tile.cityId && tile.cityId !== city.id) continue;
				if (tile.kingdomId && city.kingdomId && tile.kingdomId !== city.kingdomId) continue;
				if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
				const good = tileResourceToGood(tile.resourceType);
				if (!good) continue;
				let siteScore = this.urbanSiteScore(city, tileMap, tile.x, tile.y);
				siteScore += Math.min(45, tile.resourceAmount / 8);
				if (GOODS[good].strategic) siteScore += 30;
				candidates.push({
					x: tile.x,
					y: tile.y,
					resourceGood: good,
					siteScore
				});
			}
			candidates.sort((a, b) => b.siteScore - a.siteScore);
			return candidates[0] ?? null;
		}
		const minX = Math.max(0, Math.floor(city.x - radius));
		const maxX = Math.min(tileMap.width - 1, Math.ceil(city.x + radius));
		const minY = Math.max(0, Math.floor(city.y - radius));
		const maxY = Math.min(tileMap.height - 1, Math.ceil(city.y + radius));
		for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
			if (Math.hypot(x - city.x, y - city.y) > radius) continue;
			const tile = tileMap.getTile(x, y);
			if (!tile || tile.buildingId) continue;
			if (TERRAINS[tile.type].isWater || tile.type === TerrainType.LAVA) continue;
			if (tile.cityId && tile.cityId !== city.id) continue;
			if (tile.kingdomId && city.kingdomId && tile.kingdomId !== city.kingdomId) continue;
			const resourceGood = tileResourceToGood(tile.resourceType);
			const matchesPreferred = !!resourceGood && !!def.resourceTargets?.includes(resourceGood);
			if (resourceGood && !matchesPreferred && GOODS[resourceGood].kind === "raw") {
				if (GOODS[resourceGood].strategic || [
					"copper",
					"iron",
					"coal",
					"gold",
					"gems"
				].includes(resourceGood)) continue;
			}
			if (tile.type === TerrainType.MOUNTAIN && !matchesPreferred && city.species !== SpeciesType.STONEKIN) continue;
			if (def.requiresCoast && !tileMap.isCoastalLand(x, y)) continue;
			let siteScore = this.urbanSiteScore(city, tileMap, x, y);
			if (matchesPreferred) siteScore += 35 + Math.min(20, tile.resourceAmount / 10);
			if (def.requiresCoast) siteScore += 25;
			candidates.push({
				x,
				y,
				resourceGood: matchesPreferred ? resourceGood : null,
				siteScore
			});
		}
		candidates.sort((a, b) => b.siteScore - a.siteScore);
		return candidates[0] ?? null;
	}
	expandTerritory(city, world, bonus) {
		const limit = city.territoryLimit(bonus);
		if (city.territory.size >= limit) return;
		const claimsPerYear = 6 + Math.floor(city.population / 4);
		for (let i = 0; i < claimsPerYear && city.territory.size < limit; i++) {
			const frontier = /* @__PURE__ */ new Map();
			for (const key of city.territory) {
				const [x, y] = key.split(",").map(Number);
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1]
				]) {
					const tile = world.tileMap.getTile(x + dx, y + dy);
					if (!tile) continue;
					const tKey = `${tile.x},${tile.y}`;
					if (city.territory.has(tKey)) continue;
					if (TERRAINS[tile.type].isWater) continue;
					if (tile.kingdomId && tile.kingdomId !== city.kingdomId) continue;
					let owned = 0;
					for (const [ox, oy] of [
						[1, 0],
						[-1, 0],
						[0, 1],
						[0, -1],
						[1, 1],
						[1, -1],
						[-1, 1],
						[-1, -1]
					]) if (city.territory.has(`${tile.x + ox},${tile.y + oy}`)) owned++;
					const good = tileResourceToGood(tile.resourceType);
					let score = 30 - Math.hypot(tile.x - city.x, tile.y - city.y) * 1.15;
					score += owned * 5.5;
					if (good) {
						score += Math.min(8, tile.resourceAmount / 22);
						score += GOODS[good].tier === "strategic" ? 16 : GOODS[good].tier === "regional" ? 8 : 3;
					}
					if (world.tileMap.isCoastalLand(tile.x, tile.y)) score += 2.5;
					if (tile.type === TerrainType.MOUNTAIN && !good && city.species !== SpeciesType.STONEKIN) score -= 10;
					frontier.set(tKey, {
						x: tile.x,
						y: tile.y,
						score
					});
				}
			}
			if (frontier.size === 0) break;
			const choices = [...frontier.values()].sort((a, b) => b.score - a.score);
			const chosen = choices[rng.chance(.92) ? 0 : Math.min(choices.length - 1, 1)];
			const tile = world.tileMap.getTile(chosen.x, chosen.y);
			city.territory.add(`${tile.x},${tile.y}`);
			if (city.kingdomId) tile.kingdomId = city.kingdomId;
		}
	}
	computeResearch(city) {
		let research = city.population * RESEARCH_PER_CITIZEN;
		for (const b of city.buildings.values()) research += (b.definition.research ?? 0) * b.outputMultiplier();
		return research * (.4 + city.prosperity * .6);
	}
	killCitizens(city, world, count, cause) {
		const citizens = world.entities.filter((e) => e.cityId === city.id);
		citizens.sort((a, b) => {
			const maxAge = SPECIES_DEFINITIONS[a.species].maxAge;
			const vulnerabilityA = a.isChild ? 2 : a.age / maxAge;
			return (b.isChild ? 2 : b.age / maxAge) - vulnerabilityA;
		});
		for (let i = 0; i < Math.min(count, citizens.length); i++) citizens[i].hp = 0;
		city.population = Math.max(0, city.population - count);
	}
	refreshKingdomTotals(world) {
		for (const kingdom of world.kingdoms.values()) {
			let population = 0;
			let territory = 0;
			for (const cityId of kingdom.cityIds) {
				const city = world.cities.get(cityId);
				if (!city) continue;
				population += city.population;
				territory += city.territory.size;
			}
			kingdom.totalPopulation = population;
			kingdom.territorySize = territory;
			kingdom.militaryPower = kingdom.computePower();
			kingdom.cultureLevel = 1 + Math.floor(kingdom.research.known.size / 4);
			kingdom.computeCenter(world.cities);
		}
	}
	/** The crown takes its share of what its settlements produced. */
	collectTaxes(kingdom, world) {
		const gov = GOVERNMENTS[kingdom.government];
		const lawEffects = aggregateLawEffects(kingdom.laws);
		const effectiveTaxRate = clamp(gov.taxRate * (1 + (lawEffects.taxMultiplier ?? 0)), .01, .62);
		let taxValue = 0;
		for (const cityId of kingdom.cityIds) {
			const city = world.cities.get(cityId);
			if (!city) continue;
			for (const good of ALL_GOODS) {
				const held = city.stock.get(good);
				if (held <= 0) continue;
				const levy = held * effectiveTaxRate * .35;
				const taken = city.stock.take(good, levy);
				const stored = kingdom.treasury.add(good, taken);
				taxValue += stored * world.market.price(good);
			}
			const taxPain = Math.max(0, effectiveTaxRate - .22);
			if (taxPain > 0) city.prosperity = clamp(city.prosperity - taxPain * .035, 0, 1);
		}
		const income = kingdom.economy.hasCurrency ? kingdom.economy.fromWorldValue(taxValue) : taxValue;
		kingdom.economy.treasury += income;
		const upkeep = kingdom.cityIds.size * 8 + kingdom.totalPopulation * .4 + (kingdom.isEmpire ? 40 : 0);
		const upkeepCost = kingdom.economy.hasCurrency ? kingdom.economy.fromWorldValue(upkeep) : upkeep;
		kingdom.economy.treasury -= upkeepCost;
		if (kingdom.economy.treasury < 0) if (kingdom.economy.hasCurrency) kingdom.economy.printMoney(-kingdom.economy.treasury + 50);
		else kingdom.economy.treasury = 0;
		kingdom.wealth = Math.round(kingdom.economy.treasury);
		const gdp = taxValue / Math.max(.01, gov.taxRate * .35);
		kingdom.economy.gdp = gdp;
		kingdom.economy.gdpPerCapita = gdp / Math.max(1, kingdom.totalPopulation);
		kingdom.economy.recordYear({
			year: world.year,
			taxIncome: income,
			tradeIncome: 0,
			upkeep: upkeepCost,
			net: income - upkeepCost,
			gdp,
			treasury: kingdom.economy.treasury
		});
	}
	tickResearch(kingdom, world) {
		let output = 0;
		for (const cityId of kingdom.cityIds) output += world.cities.get(cityId)?.researchOutput ?? 0;
		kingdom.research.output = output;
		if (output <= 0) return;
		if (!kingdom.research.current) {
			const choice = this.chooseTech(kingdom, world);
			if (!choice) return;
			kingdom.research.current = choice.id;
			kingdom.research.progress = 0;
		}
		const tech = TECHNOLOGIES[kingdom.research.current];
		if (!tech) {
			kingdom.research.current = null;
			return;
		}
		kingdom.research.progress += output;
		if (kingdom.research.progress < techCost(tech)) return;
		kingdom.research.complete(tech.id);
		events.emit("techDiscovered", {
			kingdom,
			tech,
			year: world.year
		});
		chronicle.log(world.year, tech.track === "politics" ? "kingdom" : "tech", `${kingdom.name} ${tech.discovery}.`, {
			title: `Discovery: ${tech.name}`,
			importance: "major",
			scope: "kingdom",
			refs: [{
				kind: "kingdom",
				id: kingdom.id,
				name: kingdom.name
			}, {
				kind: "tech",
				id: tech.id,
				name: tech.name
			}],
			tags: [
				"technology",
				tech.track,
				kingdom.research.currentEra()
			],
			consequences: [`${tech.name} entered the known body of knowledge of ${kingdom.name}.`],
			data: {
				researchOutput: Number(output.toFixed(2)),
				track: tech.track
			}
		});
		if (tech.unlocks.features?.includes("currency") && !kingdom.economy.hasCurrency) {
			kingdom.economy.currency = mintCurrency(kingdom.species, kingdom.name, world.year);
			if (!this.announcedCurrencies.has(kingdom.id)) {
				this.announcedCurrencies.add(kingdom.id);
				chronicle.log(world.year, "economy", `${kingdom.name} minted the ${kingdom.economy.currency.name} (${kingdom.economy.currency.symbol}).`, {
					title: `The ${kingdom.economy.currency.name} is Minted`,
					importance: "major",
					scope: "kingdom",
					refs: [{
						kind: "kingdom",
						id: kingdom.id,
						name: kingdom.name
					}],
					tags: [
						"currency",
						"money",
						"economy"
					],
					consequences: [`${kingdom.name} gained a sovereign currency for taxation and trade.`]
				});
				events.emit("currencyMinted", {
					kingdom,
					currency: kingdom.economy.currency
				});
			}
		}
	}
	/**
	* Which technology a realm pursues next.
	* Cheap techs are preferred, but pressure — war, hunger, poverty — reweights
	* everything toward whatever would relieve it.
	*/
	chooseTech(kingdom, world) {
		const available = kingdom.research.availableTechs();
		if (available.length === 0) return null;
		const atWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;
		const poor = kingdom.economy.gdpPerCapita < 8;
		const hungry = [...kingdom.cityIds].some((id) => (world.cities.get(id)?.famineYears ?? 0) > 0);
		const isEmberkin = kingdom.species === SpeciesType.EMBERKIN;
		let best = null;
		let bestScore = -Infinity;
		for (const tech of available) {
			let score = 1e3 / Math.max(1, techCost(tech));
			const mods = tech.unlocks.modifiers;
			if (mods) {
				if (atWar && mods.military) score += (mods.military - 1) * (isEmberkin ? 22 : 14);
				if (hungry && mods.growth) score += (mods.growth - 1) * 25;
				if (poor && mods.trade) score += (mods.trade - 1) * 16;
				if (mods.research) score += (mods.research - 1) * 12;
				if (mods.production) score += (mods.production - 1) * 10;
			}
			if (tech.track === "politics") score += 3;
			if (isEmberkin && tech.track === "craft" && tech.unlocks.modifiers?.military) score += 6;
			if (kingdom.species === SpeciesType.LUMINI && tech.unlocks.features?.includes("diplomacy_pacts")) score += 8;
			if (kingdom.species === SpeciesType.STONEKIN && tech.id === "mining") score += 10;
			if (kingdom.species === SpeciesType.SYLVANII && tech.unlocks.modifiers?.growth) score += 5;
			if (tech.id === "capitalism") {
				score += kingdom.economy.gdpPerCapita > 18 ? 25 : -15;
				score += kingdom.economy.stability > .55 ? 12 : -20;
			}
			if (tech.id === "communism") {
				score += kingdom.economy.stability < .5 ? 30 : -18;
				score += kingdom.economy.inequality > .55 ? 22 : -10;
				score += kingdom.economy.gdpPerCapita < 12 ? 14 : -8;
			}
			if (score > bestScore) {
				bestScore = score;
				best = tech;
			}
		}
		return best;
	}
	tickEconomy(kingdom, world) {
		const economy = kingdom.economy;
		const gov = GOVERNMENTS[kingdom.government];
		const lawEffects = aggregateLawEffects(kingdom.laws);
		let industrialBuildings = 0;
		let totalBuildings = 0;
		for (const cityId of kingdom.cityIds) {
			const city = world.cities.get(cityId);
			if (!city) continue;
			for (const b of city.buildings.values()) {
				totalBuildings++;
				if (b.definition.category === "craft" || b.type === "factory") industrialBuildings++;
			}
		}
		economy.industrialisation = totalBuildings > 0 ? industrialBuildings / totalBuildings : 0;
		const capital = world.cities.get(kingdom.capitalCityId) ?? null;
		let prosperity = 0;
		let cityCount = 0;
		let totalFood = 0;
		let distanceFromCapital = 0;
		for (const cityId of kingdom.cityIds) {
			const city = world.cities.get(cityId);
			if (!city) continue;
			prosperity += city.prosperity;
			totalFood += city.stock.get("food");
			if (capital) distanceFromCapital += Math.hypot(city.x - capital.x, city.y - capital.y);
			cityCount++;
		}
		prosperity = cityCount > 0 ? prosperity / cityCount : .5;
		const foodSecurityTarget = clamp(totalFood / Math.max(1, kingdom.totalPopulation) / (FOOD_PER_CITIZEN * 4) + (lawEffects.foodSecurity ?? 0), 0, 1);
		kingdom.foodSecurity += (foodSecurityTarget - kingdom.foodSecurity) * .3;
		const avgDistance = cityCount > 0 ? distanceFromCapital / cityCount : 0;
		const adminCapacity = 42 + kingdom.research.known.size * 2.6 + (gov.stability - .55) * 36 + kingdom.culture.authority * 10 + kingdom.culture.tradition * 6 + (lawEffects.administrativeReach ?? 0) * 80;
		const cityBurden = Math.max(0, cityCount - 3) * .035;
		const adminTarget = clamp(1 - avgDistance / Math.max(20, adminCapacity) - cityBurden, .18, 1);
		kingdom.administrativeReach += (adminTarget - kingdom.administrativeReach) * .25;
		const tradeDependencyTarget = clamp(world.trade.routesFor(kingdom.id).filter((route) => route.active).reduce((sum, route) => sum + route.volume * world.market.price(route.good), 0) / Math.max(1, economy.gdp) * 1.15, 0, 1);
		kingdom.tradeDependency += (tradeDependencyTarget - kingdom.tradeDependency) * .2;
		let threatTarget = 0;
		for (const otherId of kingdom.knownKingdoms) {
			const other = world.kingdoms.get(otherId);
			if (!other) continue;
			const proximity = clamp(1 - this.closestRealmDistance(kingdom, other, world) / 90, 0, 1);
			const relation = world.diplomacy.getRelation(kingdom.id, other.id);
			const powerRatio = other.computePower() / Math.max(1, kingdom.computePower());
			const hostile = world.diplomacy.isAtWar(kingdom.id, other.id) ? 1 : relation < -35 ? .55 : 0;
			threatTarget = Math.max(threatTarget, clamp((powerRatio - .75) * .42 * proximity + hostile * proximity, 0, 1));
		}
		kingdom.externalThreat += (threatTarget - kingdom.externalThreat) * .25;
		const inequalityTarget = gov.economy === "planned" ? .12 : gov.economy === "market" ? .45 + economy.industrialisation * .35 : .3 + economy.industrialisation * .2;
		economy.inequality += (clamp(inequalityTarget + (lawEffects.inequality ?? 0), .04, .9) - economy.inequality) * .15;
		const atWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;
		const inflationPain = Math.max(0, economy.currency?.inflation ?? 0) * 1.5;
		const effectiveTaxRate = clamp(gov.taxRate * (1 + (lawEffects.taxMultiplier ?? 0)), .01, .62);
		const taxPain = Math.max(0, effectiveTaxRate - .2) * .8;
		const adminPain = (1 - kingdom.administrativeReach) * .2;
		const foodPain = (1 - kingdom.foodSecurity) * .32;
		const warPain = kingdom.warWeariness * .003 + (atWar ? .08 : 0);
		const culturalCohesion = kingdom.culture.collectivism * .06 + kingdom.culture.tradition * .04 + kingdom.culture.diplomaticTrust * .03 + (atWar ? kingdom.culture.militarism * .05 - kingdom.culture.warTrauma * .08 : -kingdom.culture.warTrauma * .025);
		const socialCohesion = (kingdom.society.cohesion - .5) * .22 - kingdom.society.revoltRisk * .18 - kingdom.society.coupRisk * .12 - kingdom.society.reformPressure * .06;
		const stabilityTarget = Math.max(0, Math.min(1, gov.stability * .34 + prosperity * .28 + kingdom.legitimacy * .22 + kingdom.foodSecurity * .18 + kingdom.administrativeReach * .12 + culturalCohesion + socialCohesion + (lawEffects.stability ?? 0) - economy.inequality * .24 - inflationPain - taxPain - adminPain - foodPain - warPain));
		economy.stability += (stabilityTarget - economy.stability) * .25;
		const bankruptcyPain = economy.treasury <= 0 ? .12 : 0;
		const cultureLegitimacy = (gov.succession === "bloodline" ? kingdom.culture.tradition * .09 : 0) + (gov.succession === "election" ? kingdom.culture.openness * .05 + kingdom.culture.innovation * .04 : 0) + (gov.economy === "planned" ? kingdom.culture.collectivism * .06 : 0) + kingdom.culture.diplomaticTrust * .03;
		const socialLegitimacy = kingdom.society.factions.nobles.loyalty * kingdom.society.factions.nobles.influence * .08 + kingdom.society.factions.bureaucrats.loyalty * kingdom.society.factions.bureaucrats.influence * .07 + kingdom.society.factions.clergy_scholars.loyalty * kingdom.society.factions.clergy_scholars.influence * .07 - kingdom.society.reformPressure * .13 - kingdom.society.revoltRisk * .1;
		const legitimacyTarget = clamp(gov.stability * .28 + economy.stability * .28 + prosperity * .2 + kingdom.foodSecurity * .16 + kingdom.administrativeReach * .14 + cultureLegitimacy + socialLegitimacy + (lawEffects.legitimacy ?? 0) - economy.inequality * .14 - bankruptcyPain - kingdom.warWeariness * .002, 0, 1);
		kingdom.legitimacy += (legitimacyTarget - kingdom.legitimacy) * .18;
		economy.revalue(kingdom.treasury.get("gold"), economy.gdp);
		if (kingdom.research.knowsFeature("banking")) {
			const rate = gov.economy === "market" ? .035 : .015;
			const interest = Math.min(economy.treasury * rate, Math.max(0, economy.gdp * .5));
			economy.treasury += interest;
		}
		const sustainable = Math.max(500, economy.gdp * 12 + kingdom.totalPopulation * 60);
		if (economy.treasury > sustainable) {
			const surplus = economy.treasury - sustainable;
			economy.treasury -= surplus * .35;
			const cities = [...kingdom.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c);
			for (const city of cities) city.prosperity = Math.min(1, city.prosperity + .02);
		}
	}
	tickCulture(kingdom, world) {
		const gov = GOVERNMENTS[kingdom.government];
		const wars = world.diplomacy.getWarsFor(kingdom.id);
		let prosperity = 0;
		let famineYears = 0;
		let cityCount = 0;
		for (const cityId of kingdom.cityIds) {
			const city = world.cities.get(cityId);
			if (!city) continue;
			prosperity += city.prosperity;
			famineYears += city.famineYears;
			cityCount++;
		}
		prosperity = cityCount > 0 ? prosperity / cityCount : .5;
		const recentGovernmentChange = world.year === kingdom.governmentSince;
		kingdom.culture = updateCulture(kingdom.culture, {
			year: world.year,
			government: kingdom.government,
			economy: gov.economy,
			atWar: wars.length > 0,
			wars: wars.length,
			stability: kingdom.economy.stability,
			legitimacy: kingdom.legitimacy,
			prosperity,
			foodSecurity: kingdom.foodSecurity,
			tradeDependency: kingdom.tradeDependency,
			externalThreat: kingdom.externalThreat,
			administrativeReach: kingdom.administrativeReach,
			cityCount,
			famineYears,
			recentGovernmentChange
		});
	}
	tickSociety(kingdom, world) {
		const gov = GOVERNMENTS[kingdom.government];
		const wars = world.diplomacy.getWarsFor(kingdom.id);
		let prosperity = 0;
		let famineYears = 0;
		let cityCount = 0;
		for (const cityId of kingdom.cityIds) {
			const city = world.cities.get(cityId);
			if (!city) continue;
			prosperity += city.prosperity;
			famineYears += city.famineYears;
			cityCount++;
		}
		prosperity = cityCount > 0 ? prosperity / cityCount : .5;
		kingdom.society = updateSociety(kingdom.society, {
			year: world.year,
			government: kingdom.government,
			economy: gov.economy,
			taxRate: gov.taxRate,
			atWar: wars.length > 0,
			wars: wars.length,
			stability: kingdom.economy.stability,
			legitimacy: kingdom.legitimacy,
			prosperity,
			foodSecurity: kingdom.foodSecurity,
			tradeDependency: kingdom.tradeDependency,
			externalThreat: kingdom.externalThreat,
			administrativeReach: kingdom.administrativeReach,
			inequality: kingdom.economy.inequality,
			industrialisation: kingdom.economy.industrialisation,
			gdpPerCapita: kingdom.economy.gdpPerCapita,
			cityCount,
			famineYears,
			warWeariness: kingdom.warWeariness,
			culture: kingdom.culture,
			laws: aggregateLawEffects(kingdom.laws)
		});
		if (wars.length > 0 && kingdom.society.peacePressure > .58) kingdom.warWeariness = clamp(kingdom.warWeariness + kingdom.society.peacePressure * 2.5, 0, 100);
		this.tickSocietyFlashpoints(kingdom, world);
	}
	tickSocietyFlashpoints(kingdom, world) {
		if (world.year - kingdom.society.lastUnrestYear < 5) return;
		const peasants = kingdom.society.factions.peasants;
		const nobles = kingdom.society.factions.nobles;
		const merchants = kingdom.society.factions.merchants;
		const military = kingdom.society.factions.military;
		const workers = kingdom.society.factions.workers;
		const reformists = kingdom.society.factions.reformists;
		const frontier = kingdom.society.factions.frontier;
		const gov = GOVERNMENTS[kingdom.government];
		if (peasants.satisfaction < .25 && peasants.radicalization > .48 && kingdom.foodSecurity < .42 && rng.chance(.18)) {
			kingdom.economy.stability = clamp(kingdom.economy.stability - .12, 0, 1);
			kingdom.legitimacy = clamp(kingdom.legitimacy - .06, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Bread riots shook ${kingdom.name} as hungry peasants forced open local granaries.`, {
				title: `Bread Riots in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"peasants"
				],
				causes: ["Hunger, low peasant satisfaction and high radicalisation converged."],
				consequences: ["Stability and legitimacy fell as peasants forced open granaries."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "peasants",
				year: world.year
			});
			return;
		}
		if (nobles.satisfaction < .3 && nobles.influence > .22 && nobles.radicalization > .45 && rng.chance(.1)) {
			kingdom.legitimacy = clamp(kingdom.legitimacy - .12, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Powerful nobles in ${kingdom.name} gathered in secret to challenge the ruler's legitimacy.`, {
				title: `Noble Conspiracy in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"nobles"
				],
				causes: ["Influential nobles became dissatisfied and radicalised."],
				consequences: ["The ruler's legitimacy was weakened by elite opposition."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "nobles",
				year: world.year
			});
			return;
		}
		if (merchants.satisfaction < .3 && merchants.influence > .18 && (gov.taxRate > .24 || kingdom.tradeDependency > .25) && rng.chance(.12)) {
			kingdom.economy.treasury *= .92;
			kingdom.economy.stability = clamp(kingdom.economy.stability - .05, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Merchant houses in ${kingdom.name} moved capital out of reach of the treasury.`, {
				title: `Capital Flight in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"merchants"
				],
				causes: ["Merchant dissatisfaction coincided with tax or trade pressure."],
				consequences: ["Treasury reserves and stability declined."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "merchants",
				year: world.year
			});
			return;
		}
		if (military.satisfaction < .28 && military.influence > .24 && kingdom.society.coupRisk > .28 && rng.chance(.08)) {
			kingdom.economy.stability = clamp(kingdom.economy.stability - .1, 0, 1);
			kingdom.legitimacy = clamp(kingdom.legitimacy - .08, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Officers in ${kingdom.name} issued a public warning to the court over the state of the army.`, {
				title: `Military Warning in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"military"
				],
				causes: ["Military dissatisfaction and coup risk reached a dangerous level."],
				consequences: ["The court lost stability and legitimacy."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "military",
				year: world.year
			});
			return;
		}
		if (workers.satisfaction < .28 && workers.influence > .16 && kingdom.economy.industrialisation > .28 && rng.chance(.12)) {
			kingdom.economy.stability = clamp(kingdom.economy.stability - .08, 0, 1);
			kingdom.economy.treasury *= .96;
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Guilds and workshops in ${kingdom.name} slowed production in protest.`, {
				title: `Industrial Protest in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"workers"
				],
				causes: ["Worker dissatisfaction rose inside an industrialising economy."],
				consequences: ["Production slowed and the treasury lost revenue."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "workers",
				year: world.year
			});
			return;
		}
		if (reformists.influence > .18 && kingdom.society.reformPressure > .42 && rng.chance(.1)) {
			kingdom.legitimacy = clamp(kingdom.legitimacy - .05, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Reformist circles in ${kingdom.name} circulated manifestos calling for a new political order.`, {
				title: `Reformist Manifestos in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"reformists"
				],
				causes: ["Reform pressure and reformist influence became politically visible."],
				consequences: ["Calls for a new political order weakened legitimacy."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "reformists",
				year: world.year
			});
			return;
		}
		if (frontier.satisfaction < .3 && frontier.influence > .18 && kingdom.administrativeReach < .45 && rng.chance(.1)) {
			kingdom.economy.stability = clamp(kingdom.economy.stability - .06, 0, 1);
			kingdom.society.lastUnrestYear = world.year;
			chronicle.log(world.year, "society", `Frontier towns in ${kingdom.name} demanded autonomy from the capital.`, {
				title: `Frontier Autonomy Crisis in ${kingdom.name}`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"society",
					"unrest",
					"frontier"
				],
				causes: ["Weak administrative reach met dissatisfaction on the frontier."],
				consequences: ["Autonomy demands increased instability in the realm."],
				threadId: `unrest:${kingdom.id}:${world.year}`,
				threadTitle: `Unrest in ${kingdom.name}`
			});
			events.emit("societyUnrest", {
				kingdom,
				faction: "frontier",
				year: world.year
			});
		}
	}
	tickLaws(kingdom, world) {
		const gov = GOVERNMENTS[kingdom.government];
		const wars = world.diplomacy.getWarsFor(kingdom.id);
		const context = {
			year: world.year,
			government: kingdom.government,
			economy: gov.economy,
			atWar: wars.length > 0,
			stability: kingdom.economy.stability,
			legitimacy: kingdom.legitimacy,
			foodSecurity: kingdom.foodSecurity,
			tradeDependency: kingdom.tradeDependency,
			externalThreat: kingdom.externalThreat,
			administrativeReach: kingdom.administrativeReach,
			inequality: kingdom.economy.inequality,
			industrialisation: kingdom.economy.industrialisation,
			cityCount: kingdom.cityIds.size,
			warWeariness: kingdom.warWeariness,
			society: kingdom.society,
			culture: kingdom.culture
		};
		updateLawMomentum(kingdom.laws, context);
		const decision = chooseLawReform(kingdom.laws, context);
		if (!decision) return;
		const chance = decision.pressure * .38 + kingdom.society.reformPressure * .22 + Math.max(0, .42 - kingdom.economy.stability) * .18;
		if (!rng.chance(chance)) return;
		enactLaw(kingdom.laws, decision.law.id, world.year, decision.pressure);
		kingdom.economy.stability = clamp(kingdom.economy.stability - .02 + decision.pressure * .035, 0, 1);
		kingdom.legitimacy = clamp(kingdom.legitimacy + (decision.law.effects.legitimacy ?? 0) * .35, 0, 1);
		const tense = decision.law.angers.filter((id) => kingdom.society.factions[id].influence > .12).map((id) => kingdom.society.factions[id]).sort((a, b) => b.influence - a.influence)[0];
		if (tense) {
			tense.satisfaction = clamp(tense.satisfaction - .04, 0, 1);
			tense.radicalization = clamp(tense.radicalization + .03, 0, 1);
		}
		chronicle.log(world.year, "law", `${kingdom.name} reformed ${decision.law.category.replace("_", " ")} law: ${decision.current.name} gave way to ${decision.law.name}.`, {
			title: `${decision.law.name} Reform`,
			importance: decision.pressure >= .7 ? "major" : "notable",
			scope: "kingdom",
			refs: [{
				kind: "kingdom",
				id: kingdom.id,
				name: kingdom.name
			}],
			tags: [
				"law",
				decision.law.category,
				"reform"
			],
			causes: [`Political reform pressure reached ${Math.round(decision.pressure * 100)}%.`],
			consequences: [`${decision.current.name} was replaced by ${decision.law.name}.`, ...tense ? ["At least one influential social faction reacted with greater dissatisfaction and radicalisation."] : []],
			data: {
				pressure: Number(decision.pressure.toFixed(3)),
				category: decision.law.category
			}
		});
		events.emit("lawReformed", {
			kingdom,
			law: decision.law,
			previous: decision.current,
			year: world.year
		});
	}
	tickGovernment(kingdom, world) {
		if (world.year - kingdom.governmentSince < 12) return;
		const available = kingdom.research.unlockedGovernments();
		if (available.length === 0) return;
		const ruler = kingdom.rulerId ? world.entities.find((e) => e.id === kingdom.rulerId) : null;
		const needed = kingdom.cityIds.size * 40 + kingdom.totalPopulation * 2;
		const next = chooseGovernment({
			currentGovernment: kingdom.government,
			available,
			atWar: world.diplomacy.getWarsFor(kingdom.id).length > 0,
			stability: kingdom.economy.stability,
			cityCount: kingdom.cityIds.size,
			wealthRatio: kingdom.economy.treasury / Math.max(1, needed),
			industrialisation: kingdom.economy.industrialisation,
			rulerPersonality: ruler?.personality ?? "peaceful",
			culturalMilitarism: kingdom.culture.militarism,
			culturalExpansionism: kingdom.culture.expansionism,
			culturalAuthority: kingdom.culture.authority,
			culturalOpenness: kingdom.culture.openness,
			culturalMercantilism: kingdom.culture.mercantilism,
			culturalInnovation: kingdom.culture.innovation,
			culturalCollectivism: kingdom.culture.collectivism,
			culturalTradition: kingdom.culture.tradition,
			socialReformPressure: kingdom.society.reformPressure,
			socialMilitaryPressure: kingdom.society.factions.military.influence * kingdom.society.factions.military.warSupport,
			socialElitePressure: kingdom.society.factions.nobles.influence * kingdom.society.factions.nobles.loyalty,
			socialMerchantPressure: kingdom.society.factions.merchants.influence * kingdom.society.factions.merchants.loyalty,
			socialWorkerPressure: kingdom.society.factions.workers.influence * kingdom.society.factions.workers.reformSupport
		});
		if (next === kingdom.government) return;
		const revolution = isRevolution(kingdom.government, next);
		const previousGovernment = GOVERNMENTS[kingdom.government].name;
		const previousName = kingdom.adoptGovernment(next, world.year);
		const newGov = GOVERNMENTS[next];
		resetLawDefaults(kingdom.laws, next);
		if (revolution) {
			kingdom.economy.stability = .35;
			kingdom.economy.treasury *= .6;
			kingdom.legitimacy = clamp(kingdom.legitimacy - .1, 0, 1);
			rememberCulture(kingdom.culture, "revolution", world.year, .85, "A revolution changed the social order.");
			chronicle.log(world.year, "revolution", `Revolution in ${previousName}! The ${previousGovernment.toLowerCase()} is overthrown and a ${newGov.name.toLowerCase()} is proclaimed as ${kingdom.name}.`, {
				title: `The Revolution of ${world.year}`,
				importance: "legendary",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}, ...ruler ? [{
					kind: "person",
					id: ruler.id,
					name: ruler.title || ruler.name
				}] : []],
				tags: [
					"revolution",
					"government",
					previousGovernment,
					newGov.name
				],
				causes: ["Accumulated political and social pressure made the old political order unsustainable."],
				consequences: [`${previousGovernment} government ended and ${newGov.name} government began.`, "State stability and treasury reserves were sharply reduced."],
				threadId: `revolution:${kingdom.id}:${world.year}`,
				threadTitle: `The Revolution of ${kingdom.name}`,
				data: {
					from: previousGovernment,
					to: newGov.name
				}
			});
			if (ruler && rng.chance(.6)) {
				ruler.hp = 0;
				chronicle.log(world.year, "succession", `${ruler.name} did not survive the revolution.`, {
					title: `Death of ${ruler.title || ruler.name}`,
					importance: "major",
					scope: "person",
					refs: [{
						kind: "person",
						id: ruler.id,
						name: ruler.title || ruler.name
					}, {
						kind: "kingdom",
						id: kingdom.id,
						name: kingdom.name
					}],
					tags: [
						"ruler",
						"death",
						"revolution"
					],
					causes: ["The ruler was killed during the revolution."],
					threadId: `revolution:${kingdom.id}:${world.year}`,
					threadTitle: `The Revolution of ${kingdom.name}`
				});
			}
		} else {
			kingdom.economy.stability = Math.min(1, kingdom.economy.stability + .1);
			kingdom.legitimacy = clamp(kingdom.legitimacy + .04, 0, 1);
			chronicle.log(world.year, "kingdom", `${previousName} reorganised itself as a ${newGov.name.toLowerCase()}, becoming ${kingdom.name}.`, {
				title: `Government Reorganisation`,
				importance: "major",
				scope: "kingdom",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"government",
					"reorganisation",
					newGov.name
				],
				causes: ["Political institutions adapted to the realm’s current military, social and economic pressures."],
				consequences: [`${newGov.name} became the governing order of ${kingdom.name}.`],
				data: {
					from: previousGovernment,
					to: newGov.name
				}
			});
		}
		if (ruler) ruler.profession = "king";
		events.emit("governmentChanged", {
			kingdom,
			from: previousGovernment,
			to: newGov.name,
			revolution,
			year: world.year
		});
	}
	/** Realms whose territory is close enough to meet learn of one another. */
	tickDiplomaticContact(world) {
		const kingdoms = [...world.kingdoms.values()];
		for (let i = 0; i < kingdoms.length; i++) for (let j = i + 1; j < kingdoms.length; j++) {
			const a = kingdoms[i];
			const b = kingdoms[j];
			if (a.knownKingdoms.has(b.id)) continue;
			if (!this.realmsAreNeighbours(a, b, world)) continue;
			a.knownKingdoms.add(b.id);
			b.knownKingdoms.add(a.id);
			world.diplomacy.changeRelation(a.id, b.id, 10);
			chronicle.log(world.year, "diplomacy", `${a.name} and ${b.name} made first contact.`, {
				title: `First Contact: ${a.name} & ${b.name}`,
				importance: "major",
				scope: "international",
				refs: [{
					kind: "kingdom",
					id: a.id,
					name: a.name
				}, {
					kind: "kingdom",
					id: b.id,
					name: b.name
				}],
				tags: ["first contact", "diplomacy"],
				consequences: ["Both realms entered one another’s known diplomatic world."]
			});
			events.emit("firstContact", {
				a,
				b,
				year: world.year
			});
		}
	}
	realmsAreNeighbours(a, b, world) {
		const range = 120 + (a.research.known.size + b.research.known.size) * 1.2 + (a.research.knowsFeature("maritime_trade") || b.research.knowsFeature("maritime_trade") ? 45 : 0) + (a.research.knows("roads") || b.research.knows("roads") ? 25 : 0);
		for (const cityIdA of a.cityIds) {
			const cityA = world.cities.get(cityIdA);
			if (!cityA) continue;
			const reachA = Math.sqrt(cityA.territory.size);
			for (const cityIdB of b.cityIds) {
				const cityB = world.cities.get(cityIdB);
				if (!cityB) continue;
				const reachB = Math.sqrt(cityB.territory.size);
				if (Math.hypot(cityA.x - cityB.x, cityA.y - cityB.y) - reachA - reachB <= range) return true;
			}
		}
		return false;
	}
	/** Annual realpolitik layer: interests, trade, threats and exhaustion shape diplomacy. */
	tickStrategicDiplomacy(world) {
		const kingdoms = [...world.kingdoms.values()];
		for (let i = 0; i < kingdoms.length; i++) for (let j = i + 1; j < kingdoms.length; j++) {
			const a = kingdoms[i];
			const b = kingdoms[j];
			if (!a.knownKingdoms.has(b.id) || !b.knownKingdoms.has(a.id)) continue;
			if (world.diplomacy.isAtWar(a.id, b.id)) {
				this.negotiatePeace(a, b, world);
				continue;
			}
			const truce = world.diplomacy.getTruce(a.id, b.id, world.year);
			const relation = world.diplomacy.getRelation(a.id, b.id);
			const proximity = clamp(1 - this.closestRealmDistance(a, b, world) / 75, 0, 1);
			const govA = GOVERNMENTS[a.government];
			const govB = GOVERNMENTS[b.government];
			const sameSpecies = a.species === b.species;
			const sameEconomy = govA.economy === govB.economy;
			const ideologicalConflict = govA.economy === "planned" && govB.economy === "market" || govA.economy === "market" && govB.economy === "planned";
			const tradeAgreement = world.trade.hasAgreement(a.id, b.id);
			const commonEnemy = this.haveCommonEnemy(a.id, b.id, world);
			const affinity = culturalAffinity(a.culture, b.culture);
			const avgOpenness = (a.culture.openness + b.culture.openness) / 2;
			const avgTrust = (a.culture.diplomaticTrust + b.culture.diplomaticTrust) / 2;
			const avgMercantilism = (a.culture.mercantilism + b.culture.mercantilism) / 2;
			const avgSocialWar = (a.society.warPressure + b.society.warPressure) / 2;
			const avgSocialPeace = (a.society.peacePressure + b.society.peacePressure) / 2;
			const borderAmbition = a.culture.militarism * .35 + b.culture.militarism * .35 + a.culture.expansionism * .3 + b.culture.expansionism * .3;
			let drift = 0;
			drift += sameSpecies ? .55 : -.28 + avgOpenness * .3;
			drift += sameEconomy ? .25 : 0;
			drift += ideologicalConflict ? -.75 : 0;
			drift += (affinity - .5) * 1.2;
			drift += avgTrust > .58 ? .2 : -Math.max(0, .45 - avgTrust) * .5;
			drift += tradeAgreement ? .7 + avgMercantilism * .35 + Math.min(.6, (a.tradeDependency + b.tradeDependency) * .35) : 0;
			drift += commonEnemy ? .65 : 0;
			drift += Math.max(0, avgSocialPeace - .52) * .42;
			drift -= proximity * (govA.aggression + govB.aggression) * .22;
			drift -= proximity * borderAmbition * .16;
			drift -= proximity * Math.max(0, avgSocialWar - .46) * .52;
			drift -= Math.max(0, a.externalThreat - .55) * proximity * .25;
			drift -= Math.max(0, b.externalThreat - .55) * proximity * .25;
			if (truce) drift += relation < -10 ? .8 : .25;
			if (world.trade.isEmbargoed(a.id, b.id)) drift -= .9;
			if (Math.abs(drift) >= .15) world.diplomacy.changeRelation(a.id, b.id, drift);
			const newRelation = world.diplomacy.getRelation(a.id, b.id);
			const canPact = a.research.knowsFeature("diplomacy_pacts") && b.research.knowsFeature("diplomacy_pacts");
			const alreadyAllied = world.diplomacy.getStatus(a.id, b.id) === "alliance";
			if (canPact && !alreadyAllied && !truce && newRelation >= 62) {
				const pactPressure = (commonEnemy ? .08 : 0) + (tradeAgreement ? .035 : 0) + Math.max(0, affinity - .55) * .08 + Math.max(0, avgTrust - .55) * .06 + Math.max(0, avgSocialPeace - .52) * .04 + Math.min(.06, (a.externalThreat + b.externalThreat) * .035);
				if (rng.chance(.015 + pactPressure)) {
					const name = sameSpecies ? `League of ${world.year}` : `Concord of ${world.year}`;
					world.diplomacy.createAlliance(a.id, b.id, name, world.year);
					chronicle.log(world.year, "diplomacy", `${a.name} and ${b.name} formed the ${name}.`, {
						title: name,
						importance: "major",
						scope: "international",
						refs: [{
							kind: "kingdom",
							id: a.id,
							name: a.name
						}, {
							kind: "kingdom",
							id: b.id,
							name: b.name
						}],
						tags: [
							"alliance",
							"diplomacy",
							"peace"
						],
						consequences: [`${a.name} and ${b.name} entered a formal alliance.`],
						threadId: `alliance:${[a.id, b.id].sort().join(":")}:${world.year}`,
						threadTitle: name
					});
				}
			}
			if (truce && world.year >= truce.untilYear && relation > -15) world.diplomacy.changeRelation(a.id, b.id, 4);
		}
	}
	/** Wars end through victory, exhaustion or negotiated white peace. */
	negotiatePeace(a, b, world) {
		const war = world.diplomacy.getWarsFor(a.id).find((w) => w.attacker === b.id || w.defender === b.id);
		if (!war) return;
		const duration = world.year - war.startYear;
		if (duration < 2) return;
		const aKills = war.attacker === a.id ? war.attackerKills : war.defenderKills;
		const bKills = war.attacker === b.id ? war.attackerKills : war.defenderKills;
		const aLosses = bKills;
		const bLosses = aKills;
		const aExhaustion = this.warExhaustionScore(a, aLosses, duration);
		const bExhaustion = this.warExhaustionScore(b, bLosses, duration);
		const score = (a.computePower() - b.computePower()) * .025 + (aKills - bKills) * 2.5;
		const peacePressure = Math.max(a.society.peacePressure, b.society.peacePressure);
		const activeSiege = [...world.cities.values()].some((city) => {
			if (!city.besiegerId || city.siegeProgress < .2) return false;
			const besieged = city.kingdomId;
			return city.besiegerId === a.id && besieged === b.id || city.besiegerId === b.id && besieged === a.id;
		});
		const decisive = Math.abs(score) > 28 && Math.max(aExhaustion, bExhaustion) > 38;
		const exhausted = (aExhaustion + bExhaustion) / 2 > 58 || aExhaustion > 78 || bExhaustion > 78 || peacePressure > .68;
		if (activeSiege && !(aExhaustion > 85 || bExhaustion > 85)) return;
		if (!decisive && !exhausted && !rng.chance(Math.min(.24, duration * .012 + Math.max(0, peacePressure - .52) * .18))) return;
		const victor = decisive ? score > 0 ? a : b : null;
		const loser = victor ? victor.id === a.id ? b : a : null;
		const settlement = victor ? "victory" : exhausted ? "exhaustion" : "white_peace";
		if (victor && loser) {
			const reparations = Math.max(0, loser.economy.treasury * .12);
			loser.economy.treasury -= reparations;
			victor.economy.treasury += reparations;
			victor.legitimacy = clamp(victor.legitimacy + .06, 0, 1);
			loser.legitimacy = clamp(loser.legitimacy - .08, 0, 1);
			rememberCulture(victor.culture, "victory", world.year, .7, `Victory over ${loser.name} strengthened national pride.`);
			rememberCulture(loser.culture, "defeat", world.year, .75, `Defeat by ${victor.name} scarred public memory.`);
		} else {
			a.legitimacy = clamp(a.legitimacy - .02, 0, 1);
			b.legitimacy = clamp(b.legitimacy - .02, 0, 1);
			rememberCulture(a.culture, "war", world.year, .55, `The war with ${b.name} ended in exhaustion.`);
			rememberCulture(b.culture, "war", world.year, .55, `The war with ${a.name} ended in exhaustion.`);
		}
		a.warWeariness = Math.max(8, a.warWeariness * .45);
		b.warWeariness = Math.max(8, b.warWeariness * .45);
		world.diplomacy.settleWar(a.id, b.id, world.year, settlement, victor?.id ?? null, victor ? -42 : -22, victor ? 8 : 5);
		const text = victor ? `${victor.name} forced ${loser.name} to accept peace after ${duration} years of war.` : `${a.name} and ${b.name} accepted an exhausted peace after ${duration} years of war.`;
		chronicle.log(world.year, "peace", text, {
			title: victor ? `Peace after the ${war.reason}` : `The Exhausted Peace`,
			importance: "major",
			scope: "international",
			refs: [
				{
					kind: "kingdom",
					id: a.id,
					name: a.name
				},
				{
					kind: "kingdom",
					id: b.id,
					name: b.name
				},
				{
					kind: "war",
					id: war.id,
					name: war.reason
				}
			],
			tags: [
				"war",
				"peace",
				settlement
			],
			causes: [victor ? "One side achieved a decisive advantage under mounting exhaustion." : "Both realms accumulated enough exhaustion to accept peace."],
			consequences: [victor && loser ? `${victor.name} gained reparations and legitimacy while ${loser.name} lost both.` : "Both realms ended the conflict with lingering war weariness."],
			threadId: `war:${war.id}`,
			threadTitle: war.reason,
			data: {
				duration,
				settlement,
				battles: war.battles,
				casualties: war.attackerKills + war.defenderKills
			}
		});
	}
	warExhaustionScore(kingdom, losses, duration) {
		const lossPressure = losses / Math.max(1, kingdom.totalPopulation) * 140;
		return kingdom.warWeariness + duration * 4 + lossPressure + (1 - kingdom.foodSecurity) * 28 + (1 - kingdom.economy.stability) * 24;
	}
	haveCommonEnemy(aId, bId, world) {
		const aEnemies = new Set(world.diplomacy.getEnemies(aId));
		return world.diplomacy.getEnemies(bId).some((enemy) => aEnemies.has(enemy));
	}
	tickTrade(world) {
		world.trade.resetYearlyVolume();
		world.trade.pruneRoutes((id) => world.cities.has(id));
		world.trade.updateRouteStatus((a, b) => world.diplomacy.isAtWar(a, b));
		this.negotiateTradeAgreements(world);
		this.openTradeRoutes(world);
		this.runTradeRoutes(world);
	}
	negotiateTradeAgreements(world) {
		const kingdoms = [...world.kingdoms.values()];
		for (let i = 0; i < kingdoms.length; i++) for (let j = i + 1; j < kingdoms.length; j++) {
			const a = kingdoms[i];
			const b = kingdoms[j];
			if (!a.knownKingdoms.has(b.id)) continue;
			const atWar = world.diplomacy.isAtWar(a.id, b.id);
			const relation = world.diplomacy.getRelation(a.id, b.id);
			const hasAgreement = world.trade.hasAgreement(a.id, b.id);
			if (atWar && hasAgreement) {
				world.trade.cancelAgreement(a.id, b.id, world.year, "war");
				chronicle.log(world.year, "economy", `Trade between ${a.name} and ${b.name} collapsed with the outbreak of war.`, {
					title: `Trade Collapse between ${a.name} and ${b.name}`,
					importance: "major",
					scope: "international",
					refs: [{
						kind: "kingdom",
						id: a.id,
						name: a.name
					}, {
						kind: "kingdom",
						id: b.id,
						name: b.name
					}],
					tags: [
						"trade",
						"war",
						"commerce"
					],
					causes: ["War made the existing trade agreement impossible to maintain."],
					consequences: ["Commercial exchange between the two realms was suspended."]
				});
				continue;
			}
			if (atWar || hasAgreement) continue;
			if (relation >= 0 && rng.chance(.35)) {
				const tariff = .12 - Math.min(.09, relation / 1200);
				world.trade.signAgreement(a.id, b.id, world.year, tariff);
				world.diplomacy.changeRelation(a.id, b.id, 12);
				chronicle.log(world.year, "trade", `${a.name} and ${b.name} signed a trade agreement.`, {
					title: `Trade Agreement: ${a.name}–${b.name}`,
					importance: "notable",
					scope: "international",
					refs: [{
						kind: "kingdom",
						id: a.id,
						name: a.name
					}, {
						kind: "kingdom",
						id: b.id,
						name: b.name
					}],
					tags: ["trade agreement", "commerce"],
					consequences: ["The two realms could begin opening formal trade routes."],
					data: { tariff: Number(tariff.toFixed(3)) }
				});
			} else if (relation <= -55 && rng.chance(.12) && !world.trade.isEmbargoed(a.id, b.id)) {
				world.trade.declareEmbargo(a.id, b.id, world.year, "diplomatic hostility");
				chronicle.log(world.year, "economy", `${a.name} placed an embargo on ${b.name}.`, {
					title: `Embargo of ${b.name}`,
					importance: "major",
					scope: "international",
					refs: [{
						kind: "kingdom",
						id: a.id,
						name: a.name
					}, {
						kind: "kingdom",
						id: b.id,
						name: b.name
					}],
					tags: [
						"embargo",
						"trade",
						"hostility"
					],
					causes: ["Diplomatic hostility crossed the threshold for economic coercion."],
					consequences: ["Formal trade between the two realms was restricted."]
				});
			}
		}
	}
	openTradeRoutes(world) {
		for (const agreement of world.trade.agreements.values()) {
			const a = world.kingdoms.get(agreement.kingdomA);
			const b = world.kingdoms.get(agreement.kingdomB);
			if (!a || !b) continue;
			if (!world.trade.canOpenRoute(a.id) || !world.trade.canOpenRoute(b.id)) continue;
			if (!rng.chance(.4)) continue;
			const pairing = this.findTradePairing(a, b, world);
			if (!pairing) continue;
			const { fromCity, toCity, good, volume, kind } = pairing;
			if (world.trade.hasRouteBetween(fromCity.id, toCity.id, good)) continue;
			world.trade.openRoute({
				fromCityId: fromCity.id,
				toCityId: toCity.id,
				fromKingdomId: fromCity.kingdomId,
				toKingdomId: toCity.kingdomId,
				kind,
				good,
				volume,
				year: world.year
			});
			chronicle.log(world.year, "trade", `A ${kind} trade route opened: ${GOODS[good].name} from ${fromCity.name} to ${toCity.name}.`, {
				title: `${GOODS[good].name} Route: ${fromCity.name}–${toCity.name}`,
				importance: volume >= 20 ? "major" : "notable",
				scope: "international",
				refs: [
					{
						kind: "city",
						id: fromCity.id,
						name: fromCity.name
					},
					{
						kind: "city",
						id: toCity.id,
						name: toCity.name
					},
					{
						kind: "kingdom",
						id: fromCity.kingdomId,
						name: a.name
					},
					{
						kind: "kingdom",
						id: toCity.kingdomId,
						name: b.name
					},
					{
						kind: "good",
						id: good,
						name: GOODS[good].name
					}
				],
				tags: [
					"trade route",
					kind,
					good
				],
				consequences: [`${GOODS[good].name} began moving regularly between the two settlements.`],
				threadId: `trade:${fromCity.id}:${toCity.id}:${good}`,
				threadTitle: `${GOODS[good].name} Trade between ${fromCity.name} and ${toCity.name}`,
				data: {
					volume,
					kind
				}
			});
		}
	}
	findTradePairing(a, b, world) {
		const citiesA = [...a.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c);
		const citiesB = [...b.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c);
		if (citiesA.length === 0 || citiesB.length === 0) return null;
		const maxDistance = 90;
		let bestPairing = null;
		let bestGain = 0;
		for (const [source, destination] of [[citiesA, citiesB], [citiesB, citiesA]]) for (const from of source) for (const to of destination) {
			const distance = Math.hypot(from.x - to.x, from.y - to.y);
			if (distance > maxDistance) continue;
			for (const good of ALL_GOODS) {
				const surplus = from.stock.get(good);
				if (surplus < 15) continue;
				const volume = Math.min(20, Math.max(3, Math.floor(surplus / 4)));
				const gain = volume * world.market.price(good) * (1 - distance / 180);
				const kind = this.determineRouteKind(from, to, world.tileMap);
				if (!kind) continue;
				if (gain > bestGain) {
					bestGain = gain;
					bestPairing = {
						fromCity: from,
						toCity: to,
						good,
						volume,
						kind
					};
				}
			}
		}
		return bestPairing;
	}
	runTradeRoutes(world) {
		for (const route of world.trade.routes.values()) {
			if (!route.active) continue;
			const from = world.cities.get(route.fromCityId);
			const to = world.cities.get(route.toCityId);
			const sellerKingdom = world.kingdoms.get(route.fromKingdomId);
			const buyerKingdom = world.kingdoms.get(route.toKingdomId);
			if (!from || !to || !sellerKingdom || !buyerKingdom) continue;
			const shipped = from.stock.take(route.good, route.volume);
			if (shipped <= 0) continue;
			const delivered = to.stock.add(route.good, shipped);
			if (delivered < shipped) from.stock.add(route.good, shipped - delivered);
			const value = delivered * world.market.price(route.good);
			world.market.reportDemand(route.good, delivered);
			world.trade.recordTrade(route, value);
			if (rng.chance(.25)) world.diplomacy.changeRelation(route.fromKingdomId, route.toKingdomId, 1);
		}
	}
	/** Overwhelming power turns neighbours into subjects without a shot being fired. */
	tickVassalage(world) {
		const kingdoms = [...world.kingdoms.values()];
		for (const overlord of kingdoms) {
			if (!overlord.research.knowsFeature("diplomacy_pacts")) continue;
			if (overlord.overlordId) continue;
			for (const candidateId of overlord.knownKingdoms) {
				const candidate = world.kingdoms.get(candidateId);
				if (!candidate || candidate.overlordId || candidate.vassalIds.size > 0) continue;
				if (world.diplomacy.isAtWar(overlord.id, candidate.id)) continue;
				const ratio = overlord.computePower() / Math.max(1, candidate.computePower());
				const relation = world.diplomacy.getRelation(overlord.id, candidate.id);
				const culturalSubmission = candidate.culture.authority * .03 + candidate.culture.tradition * .02 + overlord.culture.militarism * .015 - candidate.culture.diplomaticTrust * .015;
				const eliteSubmission = candidate.society.factions.nobles.loyalty * candidate.society.factions.nobles.influence * .04 + candidate.society.factions.bureaucrats.loyalty * candidate.society.factions.bureaucrats.influence * .035 - candidate.society.factions.frontier.radicalization * candidate.society.factions.frontier.influence * .04;
				if (!(ratio > 3 && relation > -40 && rng.chance(.035 + culturalSubmission + eliteSubmission))) continue;
				candidate.overlordId = overlord.id;
				overlord.vassalIds.add(candidate.id);
				world.diplomacy.setRelation(overlord.id, candidate.id, 60);
				chronicle.log(world.year, "conquest", `${candidate.name} swore fealty to ${overlord.name} and became its vassal.`);
				events.emit("vassalageSworn", {
					overlord,
					vassal: candidate,
					year: world.year
				});
				break;
			}
		}
		for (const vassal of kingdoms) {
			if (!vassal.overlordId) continue;
			const overlord = world.kingdoms.get(vassal.overlordId);
			if (!overlord) {
				vassal.overlordId = null;
				continue;
			}
			const relation = world.diplomacy.getRelation(vassal.id, overlord.id);
			const tributeRate = clamp(.08 + (overlord.isEmpire ? .04 : 0) - Math.max(0, relation) / 1800, .04, .18);
			const tribute = Math.max(0, vassal.economy.treasury * tributeRate);
			vassal.economy.treasury -= tribute;
			overlord.economy.treasury += tribute;
			vassal.economy.stability = clamp(vassal.economy.stability - tributeRate * .08, 0, 1);
			vassal.legitimacy = clamp(vassal.legitimacy - tributeRate * .04, 0, 1);
			world.diplomacy.changeRelation(vassal.id, overlord.id, relation > 45 ? .4 : -tributeRate * 8);
			const wantsIndependence = relation < -55 && vassal.economy.stability < .42 && vassal.culture.authority < .68 && vassal.society.revoltRisk > .18 && vassal.computePower() > overlord.computePower() * .45;
			const independencePressure = vassal.society.factions.frontier.radicalization * .08 + vassal.society.factions.reformists.radicalization * .05 + Math.max(0, vassal.society.revoltRisk - .2) * .12;
			if (wantsIndependence && rng.chance(.05 + independencePressure)) {
				vassal.overlordId = null;
				overlord.vassalIds.delete(vassal.id);
				rememberCulture(vassal.culture, "secession", world.year, .75, `Independence from ${overlord.name} became a founding memory.`);
				rememberCulture(overlord.culture, "secession", world.year, .65, `${vassal.name} broke from imperial control.`);
				if (world.diplomacy.declareWar(vassal.id, overlord.id, world.year, "Independence Revolt")) chronicle.log(world.year, "war", `${vassal.name} renounced fealty to ${overlord.name} and began an independence war.`);
				else chronicle.log(world.year, "kingdom", `${vassal.name} slipped from ${overlord.name}'s control.`);
				events.emit("vassalageBroken", {
					overlord,
					vassal,
					year: world.year
				});
			}
		}
	}
	/**
	* A crowded, well-fed settlement sends people out to found a new one.
	* This is how a single starting village becomes a sprawling realm.
	*/
	tickColonisation(world) {
		for (const city of [...world.cities.values()]) {
			const kingdom = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
			if (!kingdom) continue;
			if (city.population < 12) continue;
			if (city.prosperity < .45) continue;
			if (city.stock.get("food") < 90) continue;
			if (city.population < city.housingCapacity() * .7) continue;
			const chance = .4 * (GOVERNMENTS[kingdom.government].expansion / 20);
			if (!rng.chance(chance)) continue;
			const site = this.findColonySite(city, world, kingdom);
			if (!site) continue;
			const settlers = Math.max(4, Math.floor(city.population * .18));
			city.population -= settlers;
			const provisions = city.stock.take("food", 60);
			const timber = city.stock.take("wood", 40);
			const colony = new City(`city_${world.year}_${Math.floor(Math.random() * 1e6)}`, this.generateSettlementName(city, world), city.species, site.x, site.y, city.founderName, world.year);
			colony.kingdomId = kingdom.id;
			colony.parentCityId = city.id;
			colony.population = settlers;
			colony.stock.add("food", provisions);
			colony.stock.add("wood", timber);
			colony.updateTier();
			world.cities.set(colony.id, colony);
			kingdom.addCity(colony.id);
			const tile = world.tileMap.getTile(site.x, site.y);
			tile.cityId = colony.id;
			tile.kingdomId = kingdom.id;
			colony.seedFoundingClaim(world.tileMap, 4);
			const movers = world.entities.filter((e) => e.cityId === city.id && !e.isChild).slice(0, settlers);
			for (const mover of movers) {
				if (mover.homeBuildingId) city.buildings.get(mover.homeBuildingId)?.residentIds.delete(mover.id);
				if (mover.workplaceId) city.buildings.get(mover.workplaceId)?.assignedWorkerIds.delete(mover.id);
				mover.homeBuildingId = null;
				mover.workplaceId = null;
				mover.profession = "none";
				mover.cityId = colony.id;
				mover.x = site.x + (Math.random() - .5) * 3;
				mover.y = site.y + (Math.random() - .5) * 3;
				mover.homeX = site.x;
				mover.homeY = site.y;
				mover.targetX = null;
				mover.targetY = null;
			}
			chronicle.log(world.year, "founding", `Settlers from ${city.name} founded ${colony.name} in the name of ${kingdom.name}.`, {
				title: `Founding of ${colony.name}`,
				importance: "major",
				scope: "city",
				refs: [
					{
						kind: "city",
						id: colony.id,
						name: colony.name
					},
					{
						kind: "city",
						id: city.id,
						name: city.name
					},
					{
						kind: "kingdom",
						id: kingdom.id,
						name: kingdom.name
					}
				],
				tags: [
					"colonisation",
					"founding",
					"settlers"
				],
				causes: [`${city.name} had the population, food and housing pressure to send settlers outward.`],
				consequences: [`${kingdom.name} gained a new settlement.`],
				data: { settlers }
			});
			events.emit("colonyFounded", {
				colony,
				parent: city,
				kingdom,
				year: world.year
			});
		}
	}
	findColonySite(city, world, kingdom) {
		const canCrossWater = kingdom.research.knowsFeature("colonisation");
		const minDistance = 12;
		const maxDistance = canCrossWater ? 40 : 24;
		let best = null;
		for (let attempt = 0; attempt < 60; attempt++) {
			const angle = Math.random() * Math.PI * 2;
			const distance = minDistance + Math.random() * (maxDistance - minDistance);
			const x = Math.round(city.x + Math.cos(angle) * distance);
			const y = Math.round(city.y + Math.sin(angle) * distance);
			const tile = world.tileMap.getTile(x, y);
			if (!tile) continue;
			if (TERRAINS[tile.type].isWater || !TERRAINS[tile.type].isWalkable) continue;
			if (tile.cityId || tile.buildingId) continue;
			if (tile.kingdomId && tile.kingdomId !== kingdom.id) continue;
			let tooClose = false;
			for (const other of world.cities.values()) if (Math.hypot(other.x - x, other.y - y) < minDistance) {
				tooClose = true;
				break;
			}
			if (tooClose) continue;
			let score = TERRAINS[tile.type].fertility * 30;
			for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
				const neighbour = world.tileMap.getTile(x + dx, y + dy);
				if (!neighbour?.resourceType) continue;
				const good = tileResourceToGood(neighbour.resourceType);
				if (good) score += GOODS[good].basePrice * .4;
			}
			if (SPECIES_DEFINITIONS[city.species].preferredBiomes.includes(tile.type)) score += 25;
			if (!best || score > best.score) best = {
				x,
				y,
				score
			};
		}
		return best && best.score > 15 ? {
			x: best.x,
			y: best.y
		} : null;
	}
	generateSettlementName(parent, world) {
		const suffixes = [
			"Reach",
			"Hollow",
			"Crossing",
			"Landing",
			"Watch",
			"Rest",
			"Ford",
			"Haven",
			"Gate",
			"Rise"
		];
		const root = parent.name.replace(/(ton|burg|Reach|Hollow|Crossing|Landing|Watch|Rest|Ford|Haven|Gate|Rise)$/i, "");
		for (let i = 0; i < 12; i++) {
			const name = `${root}${rng.pick(suffixes)}`;
			if (![...world.cities.values()].some((c) => c.name === name)) return name;
		}
		return `${root}${world.year}`;
	}
	findSpotNear(x, y, radius, tileMap) {
		for (let i = 0; i < 12; i++) {
			const nx = x + rng.rangeInt(-radius, radius);
			const ny = y + rng.rangeInt(-radius, radius);
			const tile = tileMap.getTile(nx, ny);
			if (tile && TERRAINS[tile.type].isWalkable) return {
				x: nx,
				y: ny
			};
		}
		return {
			x,
			y
		};
	}
	/**
	* Distant, starved or unstable settlements under heavy war weariness secede
	* to form independent break-away realms, causing realistic imperial collapse.
	*/
	tickRebellions(world) {
		if (world.year < 15) return;
		for (const kingdom of [...world.kingdoms.values()]) {
			if (kingdom.cityIds.size <= 1) continue;
			if (kingdom.economy.stability > .42 && kingdom.warWeariness < 60 && kingdom.legitimacy > .38 && kingdom.administrativeReach > .42) continue;
			const capital = world.cities.get(kingdom.capitalCityId);
			if (!capital) continue;
			for (const cityId of [...kingdom.cityIds]) {
				if (cityId === kingdom.capitalCityId) continue;
				const city = world.cities.get(cityId);
				if (!city) continue;
				const distance = Math.hypot(city.x - capital.x, city.y - capital.y);
				const distanceFactor = Math.min(2.5, distance / 25);
				const famineRisk = city.famineYears * .25;
				const frontierPressure = kingdom.society.factions.frontier.radicalization * kingdom.society.factions.frontier.influence * .42 + kingdom.society.factions.reformists.radicalization * kingdom.society.factions.reformists.influence * .24;
				const discontent = (1 - kingdom.economy.stability) * .35 + (1 - kingdom.legitimacy) * .25 + (1 - kingdom.administrativeReach) * .2 + kingdom.society.revoltRisk * .25 + frontierPressure + (1 - kingdom.culture.authority) * .08 + kingdom.culture.warTrauma * .1 + famineRisk + kingdom.warWeariness / 100 * (.18 + kingdom.culture.militarism * .08);
				const rebellionChance = .04 * distanceFactor * discontent;
				if (rng.chance(rebellionChance)) {
					const rebelKingdomId = `king_${world.year}_${Math.floor(Math.random() * 1e6)}`;
					const rebelColor = getNextKingdomColor();
					const rebelName = `Free State of ${city.name}`;
					const rebelKingdom = new Kingdom(rebelKingdomId, rebelName, city.species, rebelColor, city.id, world.year);
					rebelKingdom.research.deserialize(kingdom.research.serialize());
					rebelKingdom.research.current = null;
					rebelKingdom.research.progress = 0;
					if (kingdom.economy.currency) rebelKingdom.economy.currency = {
						...kingdom.economy.currency,
						name: `${city.name} ${kingdom.economy.currency.name.split(" ").pop()}`,
						foundedYear: world.year,
						supply: Math.max(100, kingdom.economy.currency.supply * .15)
					};
					rebelKingdom.economy.treasury = Math.max(50, kingdom.economy.treasury * .12);
					kingdom.economy.treasury -= rebelKingdom.economy.treasury;
					const rebelGovernments = rebelKingdom.research.unlockedGovernments();
					rebelKingdom.adoptGovernment(rebelGovernments.includes("republic") ? "republic" : kingdom.government, world.year);
					rebelKingdom.name = rebelName;
					rebelKingdom.dynasty = "";
					rebelKingdom.culture = {
						...kingdom.culture,
						memories: [...kingdom.culture.memories]
					};
					rebelKingdom.culture.authority = clamp(rebelKingdom.culture.authority - .16, 0, 1);
					rebelKingdom.culture.openness = clamp(rebelKingdom.culture.openness + .08, 0, 1);
					rebelKingdom.culture.tradition = clamp(rebelKingdom.culture.tradition - .08, 0, 1);
					rebelKingdom.culture.diplomaticTrust = clamp(rebelKingdom.culture.diplomaticTrust - .1, 0, 1);
					rememberCulture(rebelKingdom.culture, "secession", world.year, .9, `Secession from ${kingdom.name} founded the new state.`);
					rememberCulture(kingdom.culture, "secession", world.year, .7, `${city.name} seceded from the realm.`);
					rebelKingdom.society = {
						...kingdom.society,
						factions: Object.fromEntries(Object.entries(kingdom.society.factions).map(([id, faction]) => [id, { ...faction }]))
					};
					rebelKingdom.society.factions.frontier.influence = clamp(rebelKingdom.society.factions.frontier.influence + .12, 0, 1);
					rebelKingdom.society.factions.frontier.loyalty = .78;
					rebelKingdom.society.factions.frontier.satisfaction = .62;
					rebelKingdom.society.factions.reformists.influence = clamp(rebelKingdom.society.factions.reformists.influence + .08, 0, 1);
					rebelKingdom.society.factions.reformists.loyalty = .66;
					rebelKingdom.society.revoltRisk = Math.max(.06, rebelKingdom.society.revoltRisk * .45);
					rebelKingdom.society.cohesion = Math.max(.48, rebelKingdom.society.cohesion);
					rebelKingdom.legitimacy = .55;
					rebelKingdom.foodSecurity = Math.max(.4, city.prosperity);
					rebelKingdom.administrativeReach = 1;
					kingdom.legitimacy = clamp(kingdom.legitimacy - .12, 0, 1);
					const localEntities = world.entities.filter((e) => e.cityId === city.id);
					if (localEntities.length > 0) {
						const rebelLeader = rng.pick(localEntities);
						rebelLeader.profession = "king";
						rebelLeader.kingdomId = rebelKingdomId;
						rebelKingdom.rulerId = rebelLeader.id;
					}
					kingdom.removeCity(city.id);
					rebelKingdom.addCity(city.id);
					city.kingdomId = rebelKingdomId;
					for (const key of city.territory) {
						const [tx, ty] = key.split(",").map(Number);
						const tile = world.tileMap.getTile(tx, ty);
						if (tile) tile.kingdomId = rebelKingdomId;
					}
					world.kingdoms.set(rebelKingdomId, rebelKingdom);
					world.diplomacy.declareWar(kingdom.id, rebelKingdomId, world.year, "Secession & Rebellion");
					chronicle.log(world.year, "rebellion", `Rebellion in ${kingdom.name}! ${city.name} seceded and proclaimed the ${rebelName}. Civil war erupts!`, {
						title: `The Secession of ${city.name}`,
						importance: "legendary",
						scope: "international",
						refs: [
							{
								kind: "city",
								id: city.id,
								name: city.name
							},
							{
								kind: "kingdom",
								id: kingdom.id,
								name: kingdom.name
							},
							{
								kind: "kingdom",
								id: rebelKingdom.id,
								name: rebelKingdom.name
							}
						],
						tags: [
							"rebellion",
							"secession",
							"civil war"
						],
						causes: ["Local revolt pressure and political alienation crossed the threshold for secession."],
						consequences: [`${rebelKingdom.name} emerged as an independent state and war began with ${kingdom.name}.`],
						threadId: `rebellion:${kingdom.id}:${city.id}:${world.year}`,
						threadTitle: `The Rebellion of ${city.name}`
					});
					events.emit("rebellionOccurred", {
						kingdom,
						rebelKingdom,
						city,
						year: world.year
					});
					break;
				}
			}
		}
	}
	/**
	* Active trade routes traversing unpoliced territory can be raided by bandits,
	* reducing route efficiency and creating economic tension.
	*/
	tickTradeBanditry(world) {
		if (world.trade.routes.size === 0) return;
		for (const route of world.trade.routes.values()) {
			if (!route.active) continue;
			const fromCity = world.cities.get(route.fromCityId);
			const toCity = world.cities.get(route.toCityId);
			if (!fromCity || !toCity) continue;
			const distance = Math.hypot(fromCity.x - toCity.x, fromCity.y - toCity.y);
			const raidChance = Math.min(.2, distance / 60 * .1);
			if (rng.chance(raidChance)) {
				route.volume = Math.max(2, Math.floor(route.volume * .6));
				if (rng.chance(.3)) chronicle.log(world.year, "disaster", `Bandits raided the ${route.kind} trade route between ${fromCity.name} and ${toCity.name}.`);
			} else if (route.volume < route.maxVolume) route.volume = Math.min(route.maxVolume, route.volume + 2);
		}
	}
	closestRealmDistance(k1, k2, world) {
		let minDist = Infinity;
		for (const c1Id of k1.cityIds) {
			const c1 = world.cities.get(c1Id);
			if (!c1) continue;
			for (const c2Id of k2.cityIds) {
				const c2 = world.cities.get(c2Id);
				if (!c2) continue;
				const d = Math.hypot(c1.x - c2.x, c1.y - c2.y);
				if (d < minDist) minDist = d;
			}
		}
		return minDist === Infinity ? 100 : minDist;
	}
	/**
	* Decide whether a trade route between two cities should be overland or maritime.
	*
	* Uses real pathfinding:
	*  - If a land path exists between the city centres → 'overland'
	*  - If no land path, but the cities each have a coastal port tile and a sea
	*    path exists between those ports, pick the first coastal tile from each city
	*    and route 'maritime'
	*  - 2b: If both exist and the sea path is >40% shorter, prefer 'maritime'
	*  - Returns null if no path exists at all (cities are unreachable).
	*/
	determineRouteKind(from, to, tileMap) {
		const landPath = SimplePathfinder.findPath(from.x, from.y, to.x, to.y, tileMap, "land");
		const landDist = landPath.length > 1 ? landPath.reduce((sum, _, i, arr) => i > 0 ? sum + Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y) : 0, 0) : Infinity;
		const fromPort = this.findCityPortWaterTile(from, tileMap);
		const toPort = this.findCityPortWaterTile(to, tileMap);
		let seaDist = Infinity;
		if (fromPort && toPort) {
			const seaPath = SimplePathfinder.findPath(fromPort.x, fromPort.y, toPort.x, toPort.y, tileMap, "sea");
			if (seaPath.length > 1) seaDist = seaPath.reduce((sum, _, i, arr) => i > 0 ? sum + Math.hypot(arr[i].x - arr[i - 1].x, arr[i].y - arr[i - 1].y) : 0, 0);
		}
		if (landPath.length > 1 && seaDist === Infinity) return "overland";
		if (landPath.length <= 1 && seaDist < Infinity) return "maritime";
		if (landPath.length <= 1 && seaDist === Infinity) return null;
		return seaDist < landDist * .72 ? "maritime" : "overland";
	}
	findCityPortWaterTile(city, tileMap) {
		const facilities = [...city.buildings.values()].filter((b) => b.type === "port" || b.type === "harbor").sort((a, b) => a.type === "port" ? -1 : 1);
		for (const facility of facilities) {
			const water = tileMap.getNeighbors(facility.x, facility.y, true).filter((tile) => TERRAINS[tile.type].isWater).sort((a, b) => (a.type === TerrainType.DEEP_OCEAN ? -1 : 0) - (b.type === TerrainType.DEEP_OCEAN ? -1 : 0));
			if (water.length) return {
				x: water[0].x + .5,
				y: water[0].y + .5
			};
		}
		return null;
	}
	/** Realms that lost every settlement cease to exist. */
	cleanupDeadRealms(world) {
		for (const [id, kingdom] of [...world.kingdoms]) {
			for (const cityId of [...kingdom.cityIds]) if (!world.cities.has(cityId)) kingdom.removeCity(cityId);
			if (kingdom.cityIds.size > 0) continue;
			chronicle.log(world.year, "conquest", `${kingdom.name} has fallen. Its last settlement is gone.`, {
				title: `Fall of ${kingdom.name}`,
				importance: "legendary",
				scope: "world",
				refs: [{
					kind: "kingdom",
					id: kingdom.id,
					name: kingdom.name
				}],
				tags: [
					"fall of a realm",
					"extinction",
					"conquest"
				],
				causes: ["The realm lost its final surviving settlement."],
				consequences: ["The kingdom ceased to exist as an independent state."]
			});
			events.emit("kingdomFell", {
				kingdom,
				year: world.year
			});
			for (const vassalId of kingdom.vassalIds) {
				const vassal = world.kingdoms.get(vassalId);
				if (vassal) vassal.overlordId = null;
			}
			if (kingdom.overlordId) world.kingdoms.get(kingdom.overlordId)?.vassalIds.delete(id);
			for (const other of world.kingdoms.values()) other.knownKingdoms.delete(id);
			world.kingdoms.delete(id);
		}
	}
};
//#endregion
//#region src/civ/Lineage.ts
/**
* Families, bloodlines and inheritance.
*
* Children are born to a specific pair, inherit traits from both parents, and
* carry a family name. Once a realm has a crown, that family name becomes the
* dynasty and succession follows it.
*/
var DYNASTY_ROOTS = {
	[SpeciesType.LUMINI]: [
		"Solaris",
		"Aurelian",
		"Helioth",
		"Valanor",
		"Orivane"
	],
	[SpeciesType.SYLVANII]: [
		"Thornwild",
		"Silvarel",
		"Leafborne",
		"Verdanth",
		"Elmshade"
	],
	[SpeciesType.STONEKIN]: [
		"Ironhold",
		"Gravenkar",
		"Stonemantle",
		"Durnvald",
		"Brakmor"
	],
	[SpeciesType.EMBERKIN]: [
		"Ashvane",
		"Pyroth",
		"Cinderfell",
		"Vulkaran",
		"Emberwright"
	],
	[SpeciesType.DEER]: ["Fawnwood"],
	[SpeciesType.WOLF]: ["Fangmoor"],
	[SpeciesType.BEAR]: ["Grimclaw"],
	[SpeciesType.DRAGON]: ["Wyrmscale"],
	[SpeciesType.BOAR]: ["Ironbristle"],
	[SpeciesType.EAGLE]: ["Skysoar"],
	[SpeciesType.MAMMOTH]: ["Frosttusk"]
};
function generateDynastyName(species) {
	return rng.pick(DYNASTY_ROOTS[species] ?? ["Nameless"]);
}
/** How closely two entities are related. Used to prevent incestuous pairings. */
function areRelated(a, b) {
	if (a.id === b.id) return true;
	if (a.fatherId && a.fatherId === b.fatherId) return true;
	if (a.motherId && a.motherId === b.motherId) return true;
	if (a.childrenIds.includes(b.id) || b.childrenIds.includes(a.id)) return true;
	if (a.fatherId === b.id || a.motherId === b.id) return true;
	if (b.fatherId === a.id || b.motherId === a.id) return true;
	return false;
}
/** Two entities may marry if they are fertile, unattached, unrelated and of the same species. */
function canPairWith(a, b) {
	if (a.species !== b.species) return false;
	if (a.gender === b.gender) return false;
	if (a.partnerId || b.partnerId) return false;
	if (areRelated(a, b)) return false;
	const maxAge = SPECIES_DEFINITIONS[a.species].maxAge;
	return a.isFertile(maxAge) && b.isFertile(maxAge);
}
function formPartnership(a, b) {
	a.partnerId = b.id;
	b.partnerId = a.id;
	const name = a.dynasty || b.dynasty || generateDynastyName(a.species);
	a.dynasty = name;
	b.dynasty = name;
}
/**
* Produces a child from two parents.
* Traits pass down probabilistically at each trait's own inherit chance, and a
* small chance of spontaneous mutation keeps the gene pool from stagnating.
*/
function conceiveChild(father, mother, x, y, makeId) {
	const child = new Entity(makeId(), mother.species, x, y);
	child.fatherId = father.id;
	child.motherId = mother.id;
	child.dynasty = father.dynasty || mother.dynasty || generateDynastyName(mother.species);
	child.generation = Math.max(father.generation, mother.generation) + 1;
	child.cityId = mother.cityId ?? father.cityId;
	child.kingdomId = mother.kingdomId ?? father.kingdomId;
	child.age = 0;
	child.profession = "none";
	const inherited = [];
	const parentTraits = /* @__PURE__ */ new Set([...father.traits, ...mother.traits]);
	for (const trait of parentTraits) {
		const def = TRAIT_DEFINITIONS[trait];
		if (!def) continue;
		const chance = father.traits.has(trait) && mother.traits.has(trait) ? Math.min(.95, def.inheritChance * 2.2) : def.inheritChance;
		if (rng.chance(chance)) {
			child.addTrait(trait);
			inherited.push(trait);
		}
	}
	if (rng.chance(.04)) {
		const allTraits = Object.keys(TRAIT_DEFINITIONS);
		const mutation = rng.pick(allTraits);
		if (!child.traits.has(mutation)) {
			child.addTrait(mutation);
			inherited.push(mutation);
		}
	}
	child.personality = rng.chance(.6) ? rng.pick([father.personality, mother.personality]) : child.personality;
	child.recalculateStats();
	child.hp = child.maxHp;
	father.childrenIds.push(child.id);
	mother.childrenIds.push(child.id);
	return {
		child,
		inheritedTraits: inherited
	};
}
/**
* Picks the next ruler when a crown falls vacant.
*
* `bloodline` succession prefers the dead ruler's children, then their dynasty,
* then falls back to the strongest subject. `election` picks the most capable
* adult regardless of birth. `strongest` is raw might.
*/
function chooseSuccessor(deceasedRulerId, dynasty, candidates, mode) {
	const adults = candidates.filter((e) => !e.isChild && e.hp > 0);
	if (adults.length === 0) return null;
	const merit = (e) => e.level * 100 + e.kills * 5 + e.age;
	if (mode === "bloodline" && deceasedRulerId) {
		const heirs = adults.filter((e) => e.fatherId === deceasedRulerId || e.motherId === deceasedRulerId);
		if (heirs.length > 0) return heirs.sort((a, b) => b.age - a.age)[0];
		const kin = adults.filter((e) => dynasty && e.dynasty === dynasty);
		if (kin.length > 0) return kin.sort((a, b) => merit(b) - merit(a))[0];
	}
	if (mode === "election") return adults.sort((a, b) => b.level * 60 + b.age * 3 - (a.level * 60 + a.age * 3))[0];
	return adults.sort((a, b) => merit(b) - merit(a))[0];
}
/** Attacker strength needed, relative to defence, before a siege makes progress. */
var SIEGE_THRESHOLD = 1;
/** Years of unbroken siege after which even a strong city starves out. */
var STARVATION_YEARS = 8;
var WarfareSystem = class {
	/**
	* Resolves every siege in the world for this year.
	* Cities not under threat slowly recover; cities under pressure fall.
	*/
	/** Wars already given a peace settlement, so a treaty is only imposed once. */
	settledWars = /* @__PURE__ */ new Set();
	reset() {
		this.settledWars.clear();
	}
	tickYear(world) {
		this.settleConcludedWars(world);
		const armies = this.gatherArmies(world);
		for (const city of [...world.cities.values()]) {
			const owner = city.kingdomId ? world.kingdoms.get(city.kingdomId) : null;
			if (!owner) continue;
			const assessment = this.assessSiege(city, owner, armies, world);
			if (!assessment) {
				this.relieveSiege(city, world);
				continue;
			}
			this.pressSiege(city, owner, assessment, world);
		}
	}
	/** Every fighting entity in the world, indexed by the realm it serves. */
	gatherArmies(world) {
		const armies = /* @__PURE__ */ new Map();
		for (const entity of world.entities) {
			if (!entity.kingdomId || entity.hp <= 0) continue;
			if (!SPECIES_DEFINITIONS[entity.species].isHumanoid) continue;
			if (entity.isChild) continue;
			if (entity.profession !== "soldier" && entity.profession !== "king") continue;
			let army = armies.get(entity.kingdomId);
			if (!army) {
				army = [];
				armies.set(entity.kingdomId, army);
			}
			army.push(entity);
		}
		return armies;
	}
	/** Combat value of a group of soldiers. */
	armyStrength(soldiers, kingdom) {
		let raw = 0;
		for (const soldier of soldiers) raw += soldier.damage + soldier.defense * .5 + soldier.level * 3;
		const techMilitary = kingdom.research.modifiers().military;
		const govMilitary = GOVERNMENTS[kingdom.government].military;
		const morale = Math.max(.5, 1 - kingdom.warWeariness / 220);
		return raw * techMilitary * govMilitary * morale;
	}
	/** Finds the strongest hostile army in range, if any is actually besieging. */
	assessSiege(city, owner, armies, world) {
		let best = null;
		for (const [kingdomId, soldiers] of armies) {
			if (kingdomId === owner.id) continue;
			if (!world.diplomacy.isAtWar(kingdomId, owner.id)) continue;
			const attacker = world.kingdoms.get(kingdomId);
			if (!attacker) continue;
			const besiegers = soldiers.filter((s) => Math.hypot(s.x - city.x, s.y - city.y) <= 7);
			if (besiegers.length < 2) continue;
			const attackStrength = this.armyStrength(besiegers, attacker);
			if (!best || attackStrength > best.attackStrength) best = {
				besieger: attacker,
				attackStrength,
				defenceStrength: 0
			};
		}
		if (!best) return null;
		best.defenceStrength = this.defenceStrength(city, owner, armies);
		return best;
	}
	/** Walls, garrison and the realm's military technology. */
	defenceStrength(city, owner, armies) {
		const garrison = (armies.get(owner.id) ?? []).filter((s) => Math.hypot(s.x - city.x, s.y - city.y) <= 7);
		const militia = city.population * 1.6;
		return (this.armyStrength(garrison, owner) + militia) * city.defenseMultiplier();
	}
	pressSiege(city, owner, assessment, world) {
		const { besieger, attackStrength, defenceStrength } = assessment;
		if (city.besiegerId !== besieger.id) {
			city.besiegerId = besieger.id;
			city.siegeProgress = 0;
			city.siegeYears = 0;
			const war = world.diplomacy.getWarsFor(besieger.id).find((w) => w.attacker === owner.id || w.defender === owner.id);
			chronicle.log(world.year, "siege", `${besieger.name} laid siege to ${city.name}.`, {
				title: `Siege of ${city.name}`,
				importance: city.id === owner.capitalCityId ? "legendary" : "major",
				scope: "international",
				refs: [
					{
						kind: "city",
						id: city.id,
						name: city.name
					},
					{
						kind: "kingdom",
						id: besieger.id,
						name: besieger.name
					},
					{
						kind: "kingdom",
						id: owner.id,
						name: owner.name
					},
					...war ? [{
						kind: "war",
						id: war.id,
						name: war.reason
					}] : []
				],
				tags: [
					"siege",
					"war",
					city.id === owner.capitalCityId ? "capital" : "city"
				],
				causes: [`${besieger.name} concentrated enough nearby military strength to invest the settlement.`],
				consequences: [`${city.name} was cut off and began accumulating siege pressure.`],
				threadId: war ? `war:${war.id}` : `siege:${city.id}:${world.year}`,
				threadTitle: war?.reason ?? `Siege of ${city.name}`,
				data: {
					attackStrength: Number(attackStrength.toFixed(2)),
					defenceStrength: Number(defenceStrength.toFixed(2))
				}
			});
			events.emit("siegeBegan", {
				city,
				besieger,
				defender: owner,
				year: world.year
			});
		}
		city.siegeYears++;
		const starving = city.siegeYears >= STARVATION_YEARS;
		const ratio = attackStrength / Math.max(1, defenceStrength);
		if (ratio < SIEGE_THRESHOLD && !starving) {
			city.siegeProgress = Math.max(0, city.siegeProgress - .05);
			besieger.warWeariness = Math.min(100, besieger.warWeariness + 3);
			return;
		}
		const advance = starving ? .25 : Math.min(.5, .08 + (ratio - SIEGE_THRESHOLD) * .16);
		city.siegeProgress += advance;
		city.prosperity = Math.max(0, city.prosperity - .08);
		city.stock.take("food", city.population * .3);
		if (city.siegeProgress >= 1) this.captureCity(city, owner, besieger, world);
	}
	relieveSiege(city, world) {
		if (!city.besiegerId) {
			if (city.siegeProgress > 0) city.siegeProgress = Math.max(0, city.siegeProgress - .2);
			return;
		}
		const besieger = world.kingdoms.get(city.besiegerId);
		const defenderId = city.kingdomId;
		const war = defenderId && besieger ? world.diplomacy.getWarsFor(defenderId).find((w) => w.attacker === besieger.id || w.defender === besieger.id) : void 0;
		chronicle.log(world.year, "siege", `The siege of ${city.name} was broken${besieger ? ` and ${besieger.name} withdrew` : ""}.`, {
			title: `Relief of ${city.name}`,
			importance: "major",
			scope: "international",
			refs: [
				{
					kind: "city",
					id: city.id,
					name: city.name
				},
				...besieger ? [{
					kind: "kingdom",
					id: besieger.id,
					name: besieger.name
				}] : [],
				...defenderId ? [{
					kind: "kingdom",
					id: defenderId
				}] : [],
				...war ? [{
					kind: "war",
					id: war.id,
					name: war.reason
				}] : []
			],
			tags: [
				"siege",
				"relief",
				"war"
			],
			consequences: [`${city.name} escaped immediate capture and siege progress was cleared.`],
			threadId: war ? `war:${war.id}` : void 0,
			threadTitle: war?.reason
		});
		events.emit("siegeLifted", {
			city,
			year: world.year
		});
		city.besiegerId = null;
		city.siegeProgress = 0;
		city.siegeYears = 0;
	}
	/**
	* The settlement changes hands: territory, buildings, stockpile and the
	* surviving population all pass to the conqueror.
	*/
	captureCity(city, from, to, world) {
		const wasCapital = from.capitalCityId === city.id;
		const heldFor = Math.max(1, city.siegeYears);
		const war = world.diplomacy.getWarsFor(from.id).find((w) => w.attacker === to.id || w.defender === to.id);
		const casualties = Math.floor(city.population * rng.range(.12, .3));
		const residents = world.entities.filter((e) => e.cityId === city.id);
		for (let i = 0; i < Math.min(casualties, residents.length); i++) residents[i].hp = 0;
		for (const good of ALL_GOODS) {
			const looted = city.stock.take(good, city.stock.get(good) * .4);
			to.treasury.add(good, looted);
		}
		for (const building of city.buildings.values()) building.hp = Math.max(1, Math.round(building.hp * rng.range(.4, .8)));
		from.removeCity(city.id);
		to.addCity(city.id);
		city.formerOwnerId = from.id;
		city.kingdomId = to.id;
		city.capturedYear = world.year;
		city.besiegerId = null;
		city.siegeProgress = 0;
		city.siegeYears = 0;
		city.prosperity = Math.min(city.prosperity, .3);
		for (const key of city.territory) {
			const [tx, ty] = key.split(",").map(Number);
			const tile = world.tileMap.getTile(tx, ty);
			if (tile && tile.cityId === city.id) tile.kingdomId = to.id;
		}
		for (const resident of world.entities) {
			if (resident.cityId !== city.id || resident.hp <= 0) continue;
			resident.kingdomId = to.id;
			if (resident.profession === "king" && from.rulerId === resident.id) resident.profession = "none";
		}
		if (wasCapital) {
			const remaining = [...from.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c).sort((a, b) => b.population - a.population)[0];
			if (remaining) {
				from.capitalCityId = remaining.id;
				chronicle.log(world.year, "conquest", `${to.name} stormed the capital of ${from.name}! The court flees to ${remaining.name}.`, {
					title: `Fall of ${city.name}`,
					importance: "legendary",
					scope: "international",
					refs: [
						{
							kind: "city",
							id: city.id,
							name: city.name
						},
						{
							kind: "city",
							id: remaining.id,
							name: remaining.name
						},
						{
							kind: "kingdom",
							id: from.id,
							name: from.name
						},
						{
							kind: "kingdom",
							id: to.id,
							name: to.name
						},
						...war ? [{
							kind: "war",
							id: war.id,
							name: war.reason
						}] : []
					],
					tags: [
						"capital",
						"conquest",
						"siege",
						"war"
					],
					causes: [`${city.name} fell after ${heldFor} ${heldFor === 1 ? "year" : "years"} under siege.`],
					consequences: [`${from.name} moved its court to ${remaining.name}.`, `${city.name} passed to ${to.name}.`],
					threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
					threadTitle: war?.reason ?? `Fall of ${city.name}`,
					data: {
						siegeYears: heldFor,
						civilianCasualties: casualties
					}
				});
			} else chronicle.log(world.year, "conquest", `${to.name} took the last city of ${from.name}. The realm is extinguished.`, {
				title: `Extinction of ${from.name}`,
				importance: "legendary",
				scope: "world",
				refs: [
					{
						kind: "city",
						id: city.id,
						name: city.name
					},
					{
						kind: "kingdom",
						id: from.id,
						name: from.name
					},
					{
						kind: "kingdom",
						id: to.id,
						name: to.name
					},
					...war ? [{
						kind: "war",
						id: war.id,
						name: war.reason
					}] : []
				],
				tags: [
					"last city",
					"realm extinction",
					"conquest"
				],
				causes: [`${city.name}, the final settlement of ${from.name}, was captured.`],
				consequences: [`${from.name} no longer possessed a surviving settlement.`],
				threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
				threadTitle: war?.reason ?? `Fall of ${from.name}`,
				data: {
					siegeYears: heldFor,
					civilianCasualties: casualties
				}
			});
		} else chronicle.log(world.year, "conquest", `${to.name} captured ${city.name} from ${from.name} after a siege of ${heldFor} ${heldFor === 1 ? "year" : "years"}.`, {
			title: `Capture of ${city.name}`,
			importance: "major",
			scope: "international",
			refs: [
				{
					kind: "city",
					id: city.id,
					name: city.name
				},
				{
					kind: "kingdom",
					id: from.id,
					name: from.name
				},
				{
					kind: "kingdom",
					id: to.id,
					name: to.name
				},
				...war ? [{
					kind: "war",
					id: war.id,
					name: war.reason
				}] : []
			],
			tags: [
				"conquest",
				"siege",
				"war"
			],
			causes: [`${city.name} fell after ${heldFor} ${heldFor === 1 ? "year" : "years"} under siege.`],
			consequences: [`The settlement changed allegiance from ${from.name} to ${to.name}.`],
			threadId: war ? `war:${war.id}` : `conquest:${city.id}:${world.year}`,
			threadTitle: war?.reason ?? `Capture of ${city.name}`,
			data: {
				siegeYears: heldFor,
				civilianCasualties: casualties
			}
		});
		to.warWeariness = Math.min(100, to.warWeariness + 8);
		world.diplomacy.changeRelation(from.id, to.id, -25);
		events.emit("cityCaptured", {
			city,
			from,
			to,
			year: world.year,
			wasCapital
		});
	}
	/** Applies a treaty to every war that concluded since the last tick. */
	settleConcludedWars(world) {
		for (const war of world.diplomacy.warHistory) {
			if (war.endYear === null || this.settledWars.has(war.id)) continue;
			this.settledWars.add(war.id);
			const attacker = world.kingdoms.get(war.attacker);
			const defender = world.kingdoms.get(war.defender);
			if (!attacker || !defender) continue;
			this.settlePeace(attacker, defender, world);
		}
	}
	/**
	* When a war ends, the side that took ground keeps some of it.
	* Called by the diplomacy layer as a war concludes.
	*/
	settlePeace(a, b, world) {
		const aPower = a.computePower();
		const bPower = b.computePower();
		const ratio = aPower / Math.max(1, bPower);
		const dominant = ratio > 2 ? a : ratio < .5 ? b : null;
		if (!dominant) return;
		const loser = dominant === a ? b : a;
		if (loser.cityIds.size <= 1) return;
		const candidates = [...loser.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c && c.id !== loser.capitalCityId);
		if (candidates.length === 0) return;
		const dominantCities = [...dominant.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c);
		if (dominantCities.length === 0) return;
		let closest = candidates[0];
		let closestDistance = Infinity;
		for (const candidate of candidates) for (const own of dominantCities) {
			const distance = Math.hypot(candidate.x - own.x, candidate.y - own.y);
			if (distance < closestDistance) {
				closestDistance = distance;
				closest = candidate;
			}
		}
		if (closestDistance > 60) return;
		this.cedeCity(closest, loser, dominant, world);
	}
	/** A settlement handed over by treaty rather than taken by storm. */
	cedeCity(city, from, to, world) {
		from.removeCity(city.id);
		to.addCity(city.id);
		city.formerOwnerId = from.id;
		city.kingdomId = to.id;
		city.capturedYear = world.year;
		city.prosperity = Math.min(city.prosperity, .45);
		for (const key of city.territory) {
			const [tx, ty] = key.split(",").map(Number);
			const tile = world.tileMap.getTile(tx, ty);
			if (tile && tile.cityId === city.id) tile.kingdomId = to.id;
		}
		for (const resident of world.entities) if (resident.cityId === city.id && resident.hp > 0) resident.kingdomId = to.id;
		const recentWar = [...world.diplomacy.warHistory].reverse().find((w) => w.endYear === world.year && (w.attacker === from.id && w.defender === to.id || w.attacker === to.id && w.defender === from.id));
		chronicle.log(world.year, "conquest", `In the peace treaty, ${from.name} ceded ${city.name} to ${to.name}.`, {
			title: `Cession of ${city.name}`,
			importance: "major",
			scope: "international",
			refs: [
				{
					kind: "city",
					id: city.id,
					name: city.name
				},
				{
					kind: "kingdom",
					id: from.id,
					name: from.name
				},
				{
					kind: "kingdom",
					id: to.id,
					name: to.name
				},
				...recentWar ? [{
					kind: "war",
					id: recentWar.id,
					name: recentWar.reason
				}] : []
			],
			tags: [
				"peace treaty",
				"cession",
				"territory"
			],
			causes: ["A peace settlement required territorial concessions."],
			consequences: [`${city.name} changed sovereignty without being taken by storm.`],
			threadId: recentWar ? `war:${recentWar.id}` : void 0,
			threadTitle: recentWar?.reason
		});
		events.emit("cityCeded", {
			city,
			from,
			to,
			year: world.year
		});
	}
};
//#endregion
//#region src/civ/NavalSystem.ts
/**
* Speeds reflect realistic knots scaled to the in-game tick rate:
*  - Canoa a remo: ~3 nós -> viagem lenta, várias horas de simulação.
*  - Caravela a vela: ~6 nós -> dobro da canoa, dependente do vento.
*  - Galeão a vela/caldeira: ~10 nós -> três vezes a canoa, mais carga.
*  - Cruzador a vapor: ~22 nós -> salto tecnológico brutal.
* O progresso/tick é um valor pequeno porque rotas tipicamente têm dezenas de tiles.
*/
var SHIP_TIERS = [
	{
		tier: 1,
		name: "Canoa de Madeira",
		icon: "🚣",
		speed: 8e-4,
		capacity: 30,
		fuelPerTick: 0,
		minEraOrder: 0,
		color: "#b45309",
		description: "Embarcação costeira leve de madeira para pesca e trocas locais. Sem combustível."
	},
	{
		tier: 2,
		name: "Caravela Mercante",
		icon: "⛵",
		speed: .0018,
		capacity: 100,
		fuelPerTick: 0,
		minEraOrder: 1,
		color: "#38bdf8",
		description: "Navio mercante a velas capaz de cruzar mares abertos entre reinos. Sem combustível."
	},
	{
		tier: 3,
		name: "Galeão Imperial",
		icon: "🚢",
		speed: .0035,
		capacity: 300,
		fuelPerTick: 0,
		minEraOrder: 2,
		color: "#fbbf24",
		description: "Grande galeão oceânico de vela e engenharia avançada. Ainda não depende de combustível industrial."
	},
	{
		tier: 4,
		name: "Cruzador de Aço",
		icon: "🛳️",
		speed: .007,
		capacity: 750,
		fuelPerTick: .08,
		minEraOrder: 3,
		color: "#a855f7",
		description: "Cruzador industrial movido a combustível refinado. Veloz, mas dependente de refinarias e logística."
	}
];
var NavalSystem = class NavalSystem {
	activeShips = /* @__PURE__ */ new Map();
	/**
	* Determines ship tier based on ACTUAL kingdom technology, not global year.
	* - No sailing tech → Tier 0 (Canoa de Madeira)
	* - sailing researched → caravels
	* - engineering researched → ocean-going galleons
	* - industrialization researched → fuel-burning steel cruisers
	*/
	static getTierForKingdom(kingdom) {
		if (kingdom.research.knows("industrialization")) return SHIP_TIERS[3];
		if (kingdom.research.knows("engineering")) return SHIP_TIERS[2];
		if (kingdom.research.knows("sailing")) return SHIP_TIERS[1];
		return SHIP_TIERS[0];
	}
	/** Technology is capped by the physical dockyard available in the city. */
	static getTierForInfrastructure(kingdom, city) {
		if (!(city.hasBuilding("harbor") || city.hasBuilding("port"))) return null;
		const hasDeepPort = city.hasBuilding("port");
		const techTier = NavalSystem.getTierForKingdom(kingdom);
		if (!hasDeepPort && techTier.tier > 2) return SHIP_TIERS[1];
		return techTier;
	}
	/** @deprecated Use getTierForKingdom instead. Kept for backwards compat. */
	static getTierForEra(eraOrder) {
		if (eraOrder >= 4) return SHIP_TIERS[3];
		if (eraOrder >= 3) return SHIP_TIERS[2];
		if (eraOrder >= 1) return SHIP_TIERS[1];
		return SHIP_TIERS[0];
	}
	updateShips(routes, cities, kingdoms, tileMap, particles, currentYear) {
		const activeRouteIds = /* @__PURE__ */ new Set();
		for (const route of routes.values()) {
			if (!route.active || route.kind !== "maritime") continue;
			activeRouteIds.add(route.id);
			const fromCity = cities.get(route.fromCityId);
			const toCity = cities.get(route.toCityId);
			const fromKingdom = kingdoms.get(route.fromKingdomId);
			const toKingdom = kingdoms.get(route.toKingdomId);
			if (!fromCity || !toCity || !fromKingdom || !toKingdom) continue;
			const tierConfig = NavalSystem.getTierForInfrastructure(fromKingdom, fromCity);
			if (!tierConfig || !NavalSystem.getTierForInfrastructure(toKingdom, toCity)) continue;
			let ship = this.activeShips.get(route.id);
			if (!ship) {
				const startPos = this.findPortWaterTile(fromCity, tileMap);
				const endPos = this.findPortWaterTile(toCity, tileMap);
				if (!startPos || !endPos) continue;
				const seaPath = SimplePathfinder.findPath(startPos.x, startPos.y, endPos.x, endPos.y, tileMap, "sea");
				if (seaPath.length === 0) continue;
				ship = {
					id: route.id,
					routeId: route.id,
					fromKingdomId: fromKingdom.id,
					toKingdomId: toKingdom.id,
					fromCityName: fromCity.name,
					toCityName: toCity.name,
					startX: startPos.x,
					startY: startPos.y,
					endX: endPos.x,
					endY: endPos.y,
					x: startPos.x,
					y: startPos.y,
					progress: 0,
					direction: 1,
					tier: tierConfig.tier,
					cargo: route.good,
					cargoAmount: Math.min(tierConfig.capacity, route.volume * 5),
					kingdomColor: fromKingdom.color,
					path: seaPath
				};
				this.activeShips.set(route.id, ship);
				events.emit("shipLaunched", {
					ship,
					year: currentYear
				});
			} else if (ship.tier < tierConfig.tier) {
				ship.tier;
				ship.tier = tierConfig.tier;
				ship.cargoAmount = Math.min(tierConfig.capacity, route.volume * 8);
				const startPos = this.findPortWaterTile(fromCity, tileMap);
				const endPos = this.findPortWaterTile(toCity, tileMap);
				if (startPos && endPos) {
					const newPath = SimplePathfinder.findPath(startPos.x, startPos.y, endPos.x, endPos.y, tileMap, "sea");
					if (newPath.length > 0) ship.path = newPath;
				}
				chronicle.log(currentYear, "kingdom", `O porto de ${fromCity.name} evoluiu sua frota para ${tierConfig.name}! ${tierConfig.icon}`);
			}
		}
		for (const [id] of this.activeShips) if (!activeRouteIds.has(id)) this.activeShips.delete(id);
		for (const ship of this.activeShips.values()) {
			const tierConfig = SHIP_TIERS.find((t) => t.tier === ship.tier) ?? SHIP_TIERS[0];
			if (tierConfig.fuelPerTick > 0) {
				const operatingKingdom = kingdoms.get(ship.fromKingdomId);
				if (operatingKingdom) {
					if (operatingKingdom.treasury.get("fuel") < tierConfig.fuelPerTick) continue;
					operatingKingdom.treasury.take("fuel", tierConfig.fuelPerTick);
				}
			}
			ship.progress += tierConfig.speed * ship.direction;
			ship.progress = Math.max(0, Math.min(1, ship.progress));
			if (ship.path && ship.path.length > 1) {
				const totalSegs = ship.path.length - 1;
				const rawIdx = Math.max(0, Math.min(totalSegs - .001, ship.progress * totalSegs));
				const pathIdx = Math.floor(rawIdx);
				const subFrac = rawIdx - pathIdx;
				const p1 = ship.path[pathIdx] ?? ship.path[0];
				const p2 = ship.path[Math.min(totalSegs, pathIdx + 1)] ?? p1;
				if (p1 && p2) {
					ship.x = p1.x + (p2.x - p1.x) * subFrac;
					ship.y = p1.y + (p2.y - p1.y) * subFrac;
				}
			} else {
				ship.x = ship.startX + (ship.endX - ship.startX) * ship.progress;
				ship.y = ship.startY + (ship.endY - ship.startY) * ship.progress;
			}
			if (Math.random() < .3) particles.spawnParticle(ship.x, ship.y, "#38bdf8", (Math.random() - .5) * .2, (Math.random() - .5) * .2, .4);
			if (ship.progress >= 1 && ship.direction === 1) {
				ship.direction = -1;
				this.dockShip(ship, ship.toCityName, ship.toKingdomId, ship.fromKingdomId, kingdoms, particles);
			} else if (ship.progress <= 0 && ship.direction === -1) {
				ship.direction = 1;
				this.dockShip(ship, ship.fromCityName, ship.fromKingdomId, ship.toKingdomId, kingdoms, particles);
			}
		}
	}
	dockShip(ship, cityName, dockingKingdomId, counterpartyKingdomId, kingdoms, particles) {
		const dockingKingdom = kingdoms.get(dockingKingdomId);
		const exporterKingdom = kingdoms.get(ship.fromKingdomId);
		const counterparty = kingdoms.get(counterpartyKingdomId);
		if (!dockingKingdom) return;
		SHIP_TIERS.find((t) => t.tier === ship.tier) ?? SHIP_TIERS[0];
		const goodDef = GOODS[ship.cargo];
		const MercantilismBonus = (exporterKingdom?.culture.mercantilism ?? .5) * .35;
		let revenue = Math.round(ship.cargoAmount * (goodDef?.basePrice ?? 5) * (1 + MercantilismBonus));
		if (counterparty && counterparty.id !== exporterKingdom?.id) {
			const buyerGold = Math.max(0, counterparty.treasury.get("gold") ?? 0);
			const tariffRate = .12 + counterparty.culture.mercantilism * .15;
			const tariffCost = Math.floor(revenue * tariffRate);
			if (tariffCost > buyerGold) {
				const scale = buyerGold / Math.max(1, tariffCost);
				revenue = Math.floor(revenue * Math.max(.2, scale));
			}
		}
		if (exporterKingdom) {
			exporterKingdom.treasury.add("gold", revenue);
			exporterKingdom.wealth += revenue;
			exporterKingdom.exportVolume += revenue;
		}
		if (dockingKingdom.id !== exporterKingdom?.id) {
			const tariffRate = .12 + dockingKingdom.culture.mercantilism * .15;
			const tariffGold = Math.floor(revenue * tariffRate);
			dockingKingdom.treasury.add("gold", tariffGold);
			dockingKingdom.wealth += tariffGold;
			dockingKingdom.tariffRevenue += tariffGold;
			dockingKingdom.importVolume += revenue;
		}
		particles.spawnDamageNumber(ship.x, ship.y, revenue);
	}
	/**
	* Water access is anchored to a real Harbor/Port building. Living near the sea
	* no longer creates ships out of an arbitrary beach tile.
	*/
	findPortWaterTile(city, tileMap) {
		const facilities = [...city.buildings.values()].filter((b) => b.type === "port" || b.type === "harbor").sort((a, b) => a.type === "port" ? -1 : 1);
		for (const facility of facilities) {
			const water = tileMap.getNeighbors(facility.x, facility.y, true).filter((tile) => TERRAINS[tile.type].isWater).sort((a, b) => {
				const aDeep = a.type === TerrainType.DEEP_OCEAN ? 1 : 0;
				return (b.type === TerrainType.DEEP_OCEAN ? 1 : 0) - aDeep;
			});
			if (water.length > 0) return {
				x: water[0].x + .5,
				y: water[0].y + .5
			};
		}
		return null;
	}
};
//#endregion
//#region src/civ/CaravanSystem.ts
/** Road speed multiplier per road level */
var ROAD_SPEED_BONUS = {
	0: 1,
	1: 1.25,
	2: 1.5,
	3: 2
};
/** Road traffic thresholds for road evolution */
var ROAD_UPGRADE_THRESHOLDS = {
	dirt: 5,
	stone: 25,
	imperial: 80
};
/** Minimum traffic fraction to maintain a road level (below this, road degrades) */
var ROAD_DEGRADE_FRACTION = .3;
/** Yearly traffic decay factor */
var ROAD_TRAFFIC_DECAY = .85;
var CaravanSystem = class {
	activeCaravans = /* @__PURE__ */ new Map();
	/**
	* Called once per year to decay road traffic across the entire map.
	* Roads that are no longer used will gradually degrade.
	*/
	decayRoadTraffic(tileMap) {
		for (let x = 0; x < tileMap.width; x++) for (let y = 0; y < tileMap.height; y++) {
			const tile = tileMap.grid[x][y];
			if (tile.roadTraffic > 0) {
				tile.roadTraffic = Math.floor(tile.roadTraffic * ROAD_TRAFFIC_DECAY);
				if (tile.roadLevel === 3 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.imperial * ROAD_DEGRADE_FRACTION) tile.roadLevel = 2;
				else if (tile.roadLevel === 2 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.stone * ROAD_DEGRADE_FRACTION) tile.roadLevel = 1;
				else if (tile.roadLevel === 1 && tile.roadTraffic < ROAD_UPGRADE_THRESHOLDS.dirt * ROAD_DEGRADE_FRACTION) tile.roadLevel = 0;
			}
		}
	}
	updateCaravans(routes, cities, kingdoms, tileMap, particles, currentYear) {
		const activeRouteIds = /* @__PURE__ */ new Set();
		for (const route of routes.values()) {
			if (route.kind !== "overland" || !route.active) continue;
			activeRouteIds.add(route.id);
			const fromCity = cities.get(route.fromCityId);
			const toCity = cities.get(route.toCityId);
			if (!fromCity || !toCity) continue;
			const fromKingdom = route.fromKingdomId ? kingdoms.get(route.fromKingdomId) : null;
			const toKingdom = route.toKingdomId ? kingdoms.get(route.toKingdomId) : null;
			if (!this.activeCaravans.has(route.id)) {
				const dist = Math.hypot(toCity.x - fromCity.x, toCity.y - fromCity.y);
				const caravanType = dist > 15 ? "camel" : dist > 8 ? "cart" : "donkey";
				const baseSpeed = caravanType === "camel" ? .015 : caravanType === "cart" ? .012 : .009;
				const landPath = SimplePathfinder.findPath(fromCity.x, fromCity.y, toCity.x, toCity.y, tileMap, "land");
				if (landPath.length === 0) continue;
				const caravan = {
					id: route.id,
					routeId: route.id,
					fromKingdomId: route.fromKingdomId,
					toKingdomId: route.toKingdomId,
					fromCityName: fromCity.name,
					toCityName: toCity.name,
					startX: fromCity.x,
					startY: fromCity.y,
					endX: toCity.x,
					endY: toCity.y,
					x: fromCity.x,
					y: fromCity.y,
					progress: 0,
					direction: 1,
					caravanType,
					cargo: route.good,
					cargoAmount: Math.min(route.volume * 5, Math.floor(route.volume * (3 + currentYear % 5 * .4))),
					kingdomColor: fromKingdom?.color ?? "#fbbf24",
					speed: baseSpeed,
					path: landPath
				};
				this.activeCaravans.set(route.id, caravan);
			}
			const caravan = this.activeCaravans.get(route.id);
			const tileX = Math.floor(caravan.x);
			const tileY = Math.floor(caravan.y);
			const speedMultiplier = ROAD_SPEED_BONUS[tileMap.getTile(tileX, tileY)?.roadLevel ?? 0] ?? 1;
			caravan.progress += caravan.speed * caravan.direction * speedMultiplier;
			if (caravan.progress >= 1) {
				caravan.progress = 1;
				caravan.direction = -1;
				this.settleCaravanTrade(caravan, fromKingdom, toKingdom, route, particles);
			} else if (caravan.progress <= 0) {
				caravan.progress = 0;
				caravan.direction = 1;
				this.settleCaravanTrade(caravan, toKingdom, fromKingdom, route, particles);
			}
			if (caravan.path && caravan.path.length > 1) {
				const totalSegs = caravan.path.length - 1;
				const rawIdx = Math.max(0, Math.min(totalSegs - .001, caravan.progress * totalSegs));
				const pathIdx = Math.floor(rawIdx);
				const subFrac = rawIdx - pathIdx;
				const p1 = caravan.path[pathIdx] ?? caravan.path[0];
				const p2 = caravan.path[Math.min(totalSegs, pathIdx + 1)] ?? p1;
				if (p1 && p2) {
					caravan.x = p1.x + (p2.x - p1.x) * subFrac;
					caravan.y = p1.y + (p2.y - p1.y) * subFrac;
				}
			} else {
				caravan.x = caravan.startX + (caravan.endX - caravan.startX) * caravan.progress;
				caravan.y = caravan.startY + (caravan.endY - caravan.startY) * caravan.progress;
			}
			const paveTileX = Math.floor(caravan.x);
			const paveTileY = Math.floor(caravan.y);
			const paveTile = tileMap.getTile(paveTileX, paveTileY);
			if (paveTile && TERRAINS[paveTile.type].isWalkable && !TERRAINS[paveTile.type].isWater) {
				paveTile.roadTraffic++;
				const hasRoadsTech = fromKingdom?.research.knows("roads") || fromKingdom?.research.knows("masonry");
				const hasEngineering = fromKingdom?.research.knows("engineering");
				if (paveTile.roadLevel === 0 && paveTile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.dirt) paveTile.roadLevel = 1;
				else if (paveTile.roadLevel === 1 && paveTile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.stone && hasRoadsTech) paveTile.roadLevel = 2;
				else if (paveTile.roadLevel === 2 && paveTile.roadTraffic >= ROAD_UPGRADE_THRESHOLDS.imperial && hasEngineering) paveTile.roadLevel = 3;
			}
		}
		for (const [id] of this.activeCaravans) if (!activeRouteIds.has(id)) this.activeCaravans.delete(id);
	}
	/**
	* Settle trade at either end of a caravan trip.
	* Called both when arriving at destination AND when returning to origin (bidirectional trade).
	*/
	settleCaravanTrade(caravan, sellerKingdom, buyerKingdom, route, particles) {
		const basePrice = GOODS[caravan.cargo]?.basePrice ?? 8;
		const MercantilismBonus = (sellerKingdom?.culture.mercantilism ?? .5) * .35;
		let revenue = Math.floor(caravan.cargoAmount * basePrice * (1 + MercantilismBonus));
		if (buyerKingdom) {
			const buyerCanAfford = Math.max(0, buyerKingdom.treasury.get("gold") ?? 0);
			const tariffRate = .1 + (buyerKingdom.culture?.mercantilism ?? .5) * .15;
			const buyerCost = Math.floor(revenue * tariffRate);
			if (buyerCost > buyerCanAfford) {
				const scale = buyerCanAfford / Math.max(1, buyerCost);
				revenue = Math.floor(revenue * Math.max(.2, scale));
			}
		}
		if (sellerKingdom) {
			sellerKingdom.treasury.add("gold", revenue);
			sellerKingdom.wealth += revenue;
			sellerKingdom.exportVolume += revenue;
		}
		if (buyerKingdom && buyerKingdom.id !== sellerKingdom?.id) {
			const tariffRate = .1 + buyerKingdom.culture.mercantilism * .15;
			const tariffGold = Math.floor(revenue * tariffRate);
			buyerKingdom.treasury.add("gold", tariffGold);
			buyerKingdom.wealth += tariffGold;
			buyerKingdom.tariffRevenue += tariffGold;
			buyerKingdom.importVolume += revenue;
		}
		route.totalValue += revenue;
		particles.spawnDamageNumber(caravan.x, caravan.y, revenue);
	}
};
var TICKS_PER_YEAR = 7200;
/**
* Tiles moved per tick, per point of species baseSpeed.
*
* Sized against the working day: the 08:00-18:00 shift is ~250 ticks, so a
* citizen must cover roughly 15 tiles in that window to reach a forest or a mine
* and get back. Too low and nobody ever arrives anywhere before dusk sends them
* home, and the whole settlement looks like it is sleepwalking.
*/
var MOVE_PER_TICK = .055;
var ATTACK_COOLDOWN = 8;
var COMBAT_RANGE = 1.8;
var DETECTION_RANGE = 8;
var FLEE_THRESHOLD = .25;
var SimulationEngine = class {
	entities = [];
	deceasedAncestors = /* @__PURE__ */ new Map();
	cities = /* @__PURE__ */ new Map();
	kingdoms = /* @__PURE__ */ new Map();
	diplomacy = new DiplomacyManager();
	spatialHash = new SpatialHash(8);
	/** Global price-setting market every realm trades against. */
	market = new WorldMarket();
	/** Trade agreements and caravan routes between realms. */
	trade = new TradeNetwork();
	/** Active maritime ships and naval trade routes. */
	naval = new NavalSystem();
	/** Active overland caravans. */
	caravans = new CaravanSystem();
	/** Runs everything slow and structural, once per simulated year. */
	civ = new CivilizationEngine();
	/** Resolves sieges and transfers cities taken by force. */
	warfare = new WarfareSystem();
	currentYear = 1;
	yearTickCounter = 0;
	timeOfDay = "day";
	/** Lifetime counters surfaced by the Statistics screen. */
	totalBirths = 0;
	totalDeaths = 0;
	constructor() {}
	spawnEntity(species, x, y, tileMap, forcedGender) {
		let spawnX = x;
		let spawnY = y;
		if (tileMap) {
			const safe = SimplePathfinder.findNearestLand(x, y, tileMap);
			if (safe) {
				spawnX = safe.x;
				spawnY = safe.y;
			}
		}
		const entity = new Entity(`ent_${Date.now()}_${Math.random()}`, species, spawnX, spawnY);
		if (forcedGender) entity.gender = forcedGender;
		entity.birthYear = Math.max(1, this.currentYear - entity.age);
		this.entities.push(entity);
		this.spatialHash.insert(entity);
		this.totalBirths++;
		const nearby = this.spatialHash.queryRadius(spawnX, spawnY, 10);
		for (const other of nearby) if (other.species === species && other.cityId && this.cities.has(other.cityId)) {
			entity.cityId = other.cityId;
			const city = this.cities.get(other.cityId);
			city.population++;
			entity.kingdomId = city.kingdomId;
			entity.birthCityId = city.id;
			entity.birthCityName = city.name;
			break;
		}
		return entity;
	}
	tickAI(tileMap, particles) {
		this.spatialHash.clear();
		for (const e of this.entities) this.spatialHash.insert(e);
		const deadEntities = [];
		for (const e of this.entities) {
			e.prevX = e.x;
			e.prevY = e.y;
			const currentTile = tileMap.getTile(Math.floor(e.x), Math.floor(e.y));
			if (currentTile && TERRAINS[currentTile.type].isWater) {
				const safe = SimplePathfinder.findNearestLand(e.x, e.y, tileMap);
				if (safe) {
					e.x = safe.x;
					e.y = safe.y;
				}
			}
			if (e.attackCooldown > 0) e.attackCooldown--;
			if (e.aiCooldown > 0) e.aiCooldown--;
			if (e.emoteTimer > 0) {
				e.emoteTimer--;
				if (e.emoteTimer <= 0) e.emote = null;
			}
			if (currentTile) {
				if (currentTile.isOnFire || currentTile.type === TerrainType.LAVA) {
					if (!e.traits.has(TraitId.FLAMMABLE) || e.species !== SpeciesType.EMBERKIN) {
						const dmg = e.traits.has(TraitId.FLAMMABLE) ? 30 : 15;
						e.hp -= dmg;
						particles.spawnDamageNumber(e.x, e.y, dmg);
						if (e.aiState !== "flee") {
							e.aiState = "flee";
							e.aiCooldown = 20;
						}
					}
				}
				if (e.hp > 0 && e.traits.has(TraitId.REGENERATOR) && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 2);
			}
			if (e.hp <= 0) {
				deadEntities.push(e);
				continue;
			}
			const isHumanoid = SPECIES_DEFINITIONS[e.species].isHumanoid;
			if (!isHumanoid) this.tickFauna(e, tileMap, particles);
			else this.tickHumanoid(e, tileMap, particles);
			const movedX = e.x - e.prevX;
			const movedY = e.y - e.prevY;
			const distMoved = Math.hypot(movedX, movedY);
			if (distMoved > .001) {
				e.facingAngle = Math.atan2(movedY, movedX);
				if (Math.abs(movedX) > .003) e.facing = movedX > 0 ? 1 : -1;
				if (Math.random() < .04 && currentTile && !TERRAINS[currentTile.type].isWater) particles.spawnParticle(e.x, e.y + .3, "rgba(180, 150, 110, 0.25)", (Math.random() - .5) * .04, -.02, .3);
				if (isHumanoid) {
					const neighbors = this.spatialHash.queryRadius(e.x, e.y, .4);
					for (const other of neighbors) if (other.id !== e.id && other.species === e.species && other.hp > 0) {
						const sepDx = e.x - other.x;
						const sepDy = e.y - other.y;
						const sepDist = Math.hypot(sepDx, sepDy);
						if (sepDist > .01 && sepDist < .38) {
							const push = (.38 - sepDist) * .025;
							const nx = e.x + sepDx / sepDist * push;
							const ny = e.y + sepDy / sepDist * push;
							const nTile = tileMap.getTile(Math.floor(nx), Math.floor(ny));
							if (nTile && !TERRAINS[nTile.type].isWater && TERRAINS[nTile.type].isWalkable) {
								e.x = nx;
								e.y = ny;
							}
						}
					}
				}
			}
			if (distMoved < .005 && e.aiState !== "idle" && e.aiState !== "heal" && e.aiState !== "sleep") {
				e.stuckTicks = (e.stuckTicks || 0) + 1;
				if (e.stuckTicks >= 2) {
					e.stuckTicks = 0;
					const jittered = SimplePathfinder.jitterAround(e.x, e.y, tileMap, SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK);
					if (jittered) {
						e.x = jittered.x;
						e.y = jittered.y;
						e._jitterFailures++;
					}
					if ((jittered ? e._jitterFailures : 3) >= 3) {
						e._jitterFailures = 0;
						e.targetX = null;
						e.targetY = null;
						e.aiState = "idle";
						e.aiCooldown = rng.rangeInt(20, 50);
						const safe = SimplePathfinder.findNearestLand(e.x, e.y, tileMap);
						if (safe) {
							e.x = safe.x;
							e.y = safe.y;
						}
					}
				}
			} else {
				e.stuckTicks = 0;
				e._jitterFailures = 0;
			}
		}
		this.naval.updateShips(this.trade.routes, this.cities, this.kingdoms, tileMap, particles, this.currentYear);
		this.caravans.updateCaravans(this.trade.routes, this.cities, this.kingdoms, tileMap, particles, this.currentYear);
		for (const dead of deadEntities) this.handleEntityDeath(dead, particles);
		this.yearTickCounter++;
		const currentHour = Math.floor(this.yearTickCounter % 600 / 600 * 24);
		if (currentHour >= 5 && currentHour < 8) this.timeOfDay = "dawn";
		else if (currentHour >= 8 && currentHour < 18) this.timeOfDay = "day";
		else if (currentHour >= 18 && currentHour < 21) this.timeOfDay = "dusk";
		else this.timeOfDay = "night";
		if (this.yearTickCounter >= 7200) {
			this.yearTickCounter = 0;
			this.currentYear++;
			this.tickAge();
			this.tickFamilies(tileMap);
			this.civ.tickYear({
				year: this.currentYear,
				cities: this.cities,
				kingdoms: this.kingdoms,
				entities: this.entities,
				tileMap,
				diplomacy: this.diplomacy,
				market: this.market,
				trade: this.trade,
				spawn: (species, x, y) => this.spawnEntity(species, x, y),
				sim: this
			});
			this.warfare.tickYear({
				year: this.currentYear,
				cities: this.cities,
				kingdoms: this.kingdoms,
				entities: this.entities,
				tileMap,
				diplomacy: this.diplomacy
			});
			this.tickGeopolitics();
		}
	}
	get24HourTime() {
		const dayFraction = this.yearTickCounter % 600 / 600;
		const hour = Math.floor(dayFraction * 24);
		const minute = Math.floor(dayFraction * 24 % 1 * 60);
		const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
		let periodLabel = "Dia";
		let icon = "☀️";
		if (hour >= 5 && hour < 8) {
			periodLabel = "Alvorada";
			icon = "🌅";
		} else if (hour >= 8 && hour < 18) {
			periodLabel = "Dia";
			icon = "☀️";
		} else if (hour >= 18 && hour < 21) {
			periodLabel = "Crepúsculo";
			icon = "🌇";
		} else {
			periodLabel = "Noite";
			icon = "🌙";
		}
		return {
			hour,
			minute,
			timeString,
			periodLabel,
			icon
		};
	}
	getCalendarDate() {
		const dayInYear = Math.floor(this.yearTickCounter % TICKS_PER_YEAR / 600);
		const month = Math.min(12, Math.floor(dayInYear / 12 * 12) + 1);
		const dayProgress = this.yearTickCounter % 600 / 600;
		return {
			month,
			day: Math.min(30, Math.floor(dayProgress * 30) + 1),
			year: this.currentYear
		};
	}
	tickFauna(e, tileMap, particles) {
		const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK;
		switch (e.species) {
			case SpeciesType.DEER:
				this.tickDeerAI(e, tileMap, speed);
				break;
			case SpeciesType.WOLF:
				this.tickWolfAI(e, tileMap, particles, speed);
				break;
			case SpeciesType.BEAR:
				this.tickBearAI(e, tileMap, particles, speed);
				break;
			case SpeciesType.DRAGON:
				this.tickDragonAI(e, tileMap, particles, speed);
				break;
			case SpeciesType.BOAR:
				this.tickBoarAI(e, tileMap, particles, speed);
				break;
			case SpeciesType.EAGLE:
				this.tickEagleAI(e, tileMap, particles, speed);
				break;
			case SpeciesType.MAMMOTH:
				this.tickMammothAI(e, tileMap, particles, speed);
				break;
			default: this.tickGenericFauna(e, tileMap, speed);
		}
	}
	tickBoarAI(e, tileMap, particles, speed) {
		const nearbyHumanoids = this.spatialHash.queryRadius(e.x, e.y, 3).filter((other) => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3);
		if (nearbyHumanoids.length > 0) {
			const target = nearbyHumanoids[0];
			if (Math.hypot(target.x - e.x, target.y - e.y) <= COMBAT_RANGE) {
				if (e.attackCooldown <= 0) {
					const dmg = Math.max(1, e.damage - target.defense);
					target.hp -= dmg;
					e.attackCooldown = ATTACK_COOLDOWN;
					particles.spawnDamageNumber(target.x, target.y, dmg);
				}
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed * 1.3);
				e.x = pos.x;
				e.y = pos.y;
			}
		} else this.tickGenericFauna(e, tileMap, speed);
	}
	tickEagleAI(e, tileMap, particles, speed) {
		const preyList = this.spatialHash.queryRadius(e.x, e.y, 8).filter((other) => (other.species === SpeciesType.DEER || other.species === SpeciesType.BOAR) && other.hp > 0);
		if (preyList.length > 0) {
			const prey = preyList[0];
			if (Math.hypot(prey.x - e.x, prey.y - e.y) <= COMBAT_RANGE) {
				if (e.attackCooldown <= 0) {
					const dmg = Math.max(1, e.damage - prey.defense);
					prey.hp -= dmg;
					e.attackCooldown = ATTACK_COOLDOWN;
					particles.spawnDamageNumber(prey.x, prey.y, dmg);
				}
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, prey.x, prey.y, tileMap, speed * 1.4);
				e.x = pos.x;
				e.y = pos.y;
			}
		} else this.tickGenericFauna(e, tileMap, speed * 1.2);
	}
	tickMammothAI(e, tileMap, particles, speed) {
		const threats = this.spatialHash.queryRadius(e.x, e.y, 4).filter((other) => SPECIES_DEFINITIONS[other.species].isHumanoid && other.hp > 0 && other.age >= 3);
		if (e.hp < e.maxHp && threats.length > 0) {
			const target = threats[0];
			if (Math.hypot(target.x - e.x, target.y - e.y) <= COMBAT_RANGE) {
				if (e.attackCooldown <= 0) {
					const dmg = Math.max(1, e.damage - target.defense);
					target.hp -= dmg;
					e.attackCooldown = ATTACK_COOLDOWN;
					particles.spawnDamageNumber(target.x, target.y, dmg);
				}
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, speed);
				e.x = pos.x;
				e.y = pos.y;
			}
		} else this.tickGenericFauna(e, tileMap, speed * .8);
	}
	/** DEER: Peaceful herbivore. Flees from predators and humanoids. Grazes near forests. */
	tickDeerAI(e, tileMap, speed) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, 7);
		for (const other of nearby) {
			if (other.id === e.id) continue;
			const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
			if ((other.species === SpeciesType.WOLF || other.species === SpeciesType.BEAR || other.species === SpeciesType.DRAGON || SPECIES_DEFINITIONS[other.species].isHumanoid) && dist < 6) {
				e.aiState = "flee";
				const pos = SimplePathfinder.fleeFrom(e.x, e.y, other.x, other.y, tileMap, speed * 1.5);
				e.x = pos.x;
				e.y = pos.y;
				e.targetX = null;
				e.targetY = null;
				return;
			}
		}
		if (e.aiState !== "forage" || e.aiCooldown <= 0) {
			e.aiState = "forage";
			e.aiCooldown = rng.rangeInt(30, 80);
			const target = SimplePathfinder.findRandomWalkable(e.x, e.y, 6, tileMap);
			if (target) {
				e.targetX = target.x;
				e.targetY = target.y;
			}
		}
		if (e.targetX !== null && e.targetY !== null) {
			const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
			e.x = pos.x;
			e.y = pos.y;
			if (SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < .3) {
				e.targetX = null;
				e.targetY = null;
				e.aiState = "idle";
				e.aiCooldown = rng.rangeInt(15, 40);
			}
		}
	}
	/** WOLF: Pack hunter. Coordinates with nearby wolves to chase humanoids. Fast and aggressive. */
	tickWolfAI(e, tileMap, particles, speed) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, 10);
		if (e.hp < e.maxHp * .2) {
			const threats = nearby.filter((o) => SPECIES_DEFINITIONS[o.species].isHumanoid && SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 5);
			if (threats.length > 0) {
				e.aiState = "flee";
				const pos = SimplePathfinder.fleeFrom(e.x, e.y, threats[0].x, threats[0].y, tileMap, speed * 1.3);
				e.x = pos.x;
				e.y = pos.y;
				return;
			}
		}
		let bestPrey = null;
		let bestScore = -Infinity;
		for (const other of nearby) {
			if (other.id === e.id || other.species === SpeciesType.WOLF) continue;
			const isDeer = other.species === SpeciesType.DEER;
			const isHumanoid = SPECIES_DEFINITIONS[other.species].isHumanoid && other.age >= 3;
			if (!isDeer && !isHumanoid) continue;
			let score = -SimplePathfinder.distance(e.x, e.y, other.x, other.y);
			if (isDeer) score += 5;
			if (other.hp < other.maxHp * .5) score += 3;
			const packCount = nearby.filter((p) => p.species === SpeciesType.WOLF && p.id !== e.id && SimplePathfinder.distance(p.x, p.y, other.x, other.y) < 8).length;
			score += packCount * 2;
			if (score > bestScore) {
				bestScore = score;
				bestPrey = other;
			}
		}
		if (bestPrey) {
			e.aiState = "hunt";
			e.targetX = bestPrey.x;
			e.targetY = bestPrey.y;
			if (SimplePathfinder.distance(e.x, e.y, bestPrey.x, bestPrey.y) <= COMBAT_RANGE && e.attackCooldown <= 0) {
				const dmg = Math.max(3, e.damage - bestPrey.defense);
				bestPrey.hp -= dmg;
				e.attackCooldown = ATTACK_COOLDOWN;
				particles.spawnDamageNumber(bestPrey.x, bestPrey.y, dmg);
				sound.playHit();
				if (bestPrey.hp <= 0) e.kills++;
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestPrey.x, bestPrey.y, tileMap, speed * 1.2);
				e.x = pos.x;
				e.y = pos.y;
			}
			return;
		}
		this.doWander(e, tileMap, speed, 8);
	}
	/** BEAR: Territorial apex predator. Guards area, attacks intruders. Slow but powerful. */
	tickBearAI(e, tileMap, particles, speed) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, 8);
		let closestIntruder = null;
		let closestDist = DETECTION_RANGE;
		for (const other of nearby) {
			if (other.id === e.id || other.species === SpeciesType.BEAR) continue;
			if (SPECIES_DEFINITIONS[other.species]?.isHumanoid && other.age < 3) continue;
			const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
			if (dist < closestDist && dist < 6) {
				closestDist = dist;
				closestIntruder = other;
			}
		}
		if (closestIntruder) {
			e.aiState = "attack";
			e.targetX = closestIntruder.x;
			e.targetY = closestIntruder.y;
			if (closestDist <= COMBAT_RANGE && e.attackCooldown <= 0) {
				const dmg = Math.max(5, e.damage - closestIntruder.defense);
				closestIntruder.hp -= dmg;
				e.attackCooldown = 10;
				particles.spawnDamageNumber(closestIntruder.x, closestIntruder.y, dmg);
				particles.spawnExplosion(closestIntruder.x, closestIntruder.y, "#78350f", 5);
				sound.playHit();
				if (closestIntruder.hp <= 0) e.kills++;
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, closestIntruder.x, closestIntruder.y, tileMap, speed);
				e.x = pos.x;
				e.y = pos.y;
			}
			return;
		}
		this.doWander(e, tileMap, speed * .6, 5);
	}
	/** DRAGON: Boss entity. Breathes fire, flies over terrain, hunts everything. */
	tickDragonAI(e, tileMap, particles, speed) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, 16);
		let bestTarget = null;
		let bestHp = 0;
		for (const other of nearby) {
			if (other.id === e.id || other.species === SpeciesType.DRAGON) continue;
			if (SPECIES_DEFINITIONS[other.species]?.isHumanoid && other.age < 3) continue;
			if (other.hp > bestHp) {
				bestHp = other.hp;
				bestTarget = other;
			}
		}
		if (bestTarget) {
			e.aiState = "hunt";
			e.targetX = bestTarget.x;
			e.targetY = bestTarget.y;
			if (SimplePathfinder.distance(e.x, e.y, bestTarget.x, bestTarget.y) <= COMBAT_RANGE * 1.5 && e.attackCooldown <= 0) {
				const hitRange = this.spatialHash.queryRadius(bestTarget.x, bestTarget.y, 2);
				for (const victim of hitRange) {
					if (victim.id === e.id) continue;
					const dmg = Math.max(10, e.damage - victim.defense);
					victim.hp -= dmg;
					particles.spawnDamageNumber(victim.x, victim.y, dmg);
				}
				tileMap.applyBrush(Math.floor(bestTarget.x), Math.floor(bestTarget.y), 2, (t) => {
					if (t.type !== TerrainType.DEEP_OCEAN && t.type !== TerrainType.SHALLOW_WATER) t.isOnFire = true;
				});
				particles.spawnExplosion(bestTarget.x, bestTarget.y, "#f59e0b", 30);
				e.attackCooldown = 13;
				sound.playExplosion();
			} else {
				const pos = SimplePathfinder.getStepTowards(e.x, e.y, bestTarget.x, bestTarget.y, tileMap, speed * 1.5);
				e.x = pos.x;
				e.y = pos.y;
			}
			return;
		}
		this.doWander(e, tileMap, speed, 20);
	}
	tickGenericFauna(e, tileMap, speed) {
		this.doWander(e, tileMap, speed, 6);
	}
	tickHumanoid(e, tileMap, particles) {
		const speed = SPECIES_DEFINITIONS[e.species].baseSpeed * MOVE_PER_TICK;
		if (!e.cityId) this.tryJoinOrFoundCity(e, tileMap);
		if (e.aiCooldown <= 0) this.decideHumanoidState(e, tileMap, particles);
		this.executeHumanoidState(e, tileMap, particles, speed);
	}
	/** Decide what the humanoid should be doing based on needs, threats, and personality. */
	decideHumanoidState(e, tileMap, particles) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE);
		if (e.hp < e.maxHp * FLEE_THRESHOLD && e.profession !== "king") {
			if (nearby.filter((o) => this.isEnemy(e, o) && SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 6).length > 0) {
				e.aiState = "flee";
				e.aiCooldown = 15;
				return;
			}
		}
		if (e.kingdomId) {
			const enemies = nearby.filter((o) => this.isEnemy(e, o) && o.age >= 3);
			if (enemies.length > 0) switch (e.species) {
				case SpeciesType.STONEKIN:
					e.aiState = "attack";
					e.aiCooldown = 5;
					return;
				case SpeciesType.EMBERKIN:
					e.aiState = "attack";
					e.aiCooldown = 3;
					return;
				case SpeciesType.SYLVANII:
					if (enemies.length > 2 && e.profession !== "soldier") {
						e.aiState = "flee";
						e.aiCooldown = 10;
						return;
					}
					e.aiState = "attack";
					e.aiCooldown = 5;
					return;
				case SpeciesType.LUMINI:
					if (e.profession === "soldier" || e.profession === "king") {
						e.aiState = "attack";
						e.aiCooldown = 5;
					} else {
						e.aiState = "flee";
						e.aiCooldown = 12;
					}
					return;
				default:
					e.aiState = "attack";
					e.aiCooldown = 5;
					return;
			}
		}
		const faunaThreats = nearby.filter((o) => (o.species === SpeciesType.WOLF || o.species === SpeciesType.BEAR || o.species === SpeciesType.DRAGON) && SimplePathfinder.distance(e.x, e.y, o.x, o.y) < 5);
		if (faunaThreats.length > 0 && e.profession !== "soldier") {
			e.aiState = "flee";
			e.aiCooldown = 12;
			return;
		}
		if (faunaThreats.length > 0 && e.profession === "soldier") {
			e.aiState = "attack";
			e.aiCooldown = 5;
			return;
		}
		if (e.hp < e.maxHp * .6 && e.aiState !== "heal") {
			e.aiState = "heal";
			e.aiCooldown = rng.rangeInt(20, 50);
			return;
		}
		if (e.cityId) switch (this.timeOfDay) {
			case "night":
				e.aiState = "sleep";
				e.aiCooldown = rng.rangeInt(20, 40);
				return;
			case "dawn":
				if (e.workplaceId) {
					e.aiState = "go_to_work";
					e.aiCooldown = rng.rangeInt(20, 40);
					return;
				}
				break;
			case "dusk": if (e.workplaceId || e.homeX != null) {
				e.aiState = "return_home";
				e.aiCooldown = rng.rangeInt(20, 40);
				return;
			}
		}
		if (e.cityId && this.cities.has(e.cityId)) {
			const city = this.cities.get(e.cityId);
			if (e.profession === "none") this.assignProfession(e, city);
			switch (e.profession) {
				case "woodcutter":
					e.aiState = "gather_wood";
					e.aiCooldown = rng.rangeInt(30, 60);
					return;
				case "farmer":
					e.aiState = "gather_food";
					e.aiCooldown = rng.rangeInt(20, 50);
					return;
				case "miner":
					e.aiState = "gather_ore";
					e.aiCooldown = rng.rangeInt(30, 60);
					return;
				case "soldier": {
					const target = this.pickRaidTarget(e);
					if (target) {
						e.aiState = "raid";
						e.targetX = target.x;
						e.targetY = target.y;
						e.aiCooldown = rng.rangeInt(60, 140);
					} else {
						e.aiState = "patrol";
						e.aiCooldown = rng.rangeInt(30, 80);
					}
					return;
				}
				case "scout":
					e.aiState = "explore";
					e.aiCooldown = rng.rangeInt(50, 120);
					return;
				case "builder": {
					const bench = e.workplaceId ? city.buildings.get(e.workplaceId) : null;
					if (bench && bench.definition.category === "craft") {
						e.aiState = "craft";
						e.aiCooldown = rng.rangeInt(30, 60);
						return;
					}
					e.aiState = "wander";
					e.aiCooldown = rng.rangeInt(20, 60);
					return;
				}
				case "king":
					e.aiState = "patrol";
					e.aiCooldown = rng.rangeInt(20, 60);
					return;
			}
			if (!e.isChild) {
				e.aiState = city.stock.get("food") < city.population * 3 || rng.chance(.6) ? "gather_food" : "gather_wood";
				e.aiCooldown = rng.rangeInt(30, 60);
				return;
			}
			e.aiState = "wander";
			e.aiCooldown = rng.rangeInt(20, 60);
			return;
		}
		e.aiState = "explore";
		e.aiCooldown = rng.rangeInt(30, 80);
	}
	/**
	* Closest wild-food patch the settlement knows about. The city rebuilds this
	* cache once a year, so foragers spread out over the land the city actually
	* surveyed instead of all converging on one tile.
	*/
	nearestWildFood(e, city) {
		return this.nearestDepositOf(e, city, "food");
	}
	/** As above, for any good the settlement has surveyed. */
	nearestDepositOf(e, city, good) {
		const patches = city.resourcesByGood.get(good);
		if (!patches || patches.length === 0) return null;
		let best = null;
		let bestDist = Infinity;
		for (const p of patches.slice(0, 24)) {
			const score = ((p.x - e.x) ** 2 + (p.y - e.y) ** 2) * rng.range(.85, 1.45);
			if (score < bestDist) {
				bestDist = score;
				best = p;
			}
		}
		return best;
	}
	/** Assign profession and workplace based on real job slots in city buildings. */
	assignProfession(e, city) {
		const kingdom = e.kingdomId ? this.kingdoms.get(e.kingdomId) : null;
		const unlocked = new Set(BASE_BUILDINGS);
		for (const b of kingdom?.research.unlockedBuildings() ?? []) unlocked.add(b);
		let best = null;
		for (const building of city.buildings.values()) {
			const def = building.definition;
			const jobs = def.jobs ?? 0;
			if (jobs <= 0 || building.assignedWorkerIds.size >= jobs * building.level) continue;
			if (!unlocked.has(building.type)) continue;
			const score = jobs * building.level + (def.category === "food" ? 1e3 : def.category === "extraction" ? 800 : def.category === "craft" ? 600 : 400);
			if (!best || score > best.score) best = {
				building,
				score
			};
		}
		if (best) {
			const b = best.building;
			const type = b.type;
			if (type === "farm" || type === "pasture") e.profession = "farmer";
			else if (type === "lumber_camp") e.profession = "woodcutter";
			else if (type === "mine" || type === "quarry" || type === "oil_well") e.profession = "miner";
			else if (type === "workshop" || type === "smithy" || type === "factory" || type === "refinery") e.profession = "builder";
			else if (type === "barracks") e.profession = "soldier";
			else if (type === "library" || type === "academy") e.profession = "scout";
			else e.profession = "builder";
			e.workplaceId = b.id;
			b.assignedWorkerIds.add(e.id);
			this.claimHome(e, city);
		}
	}
	/**
	* Moves a citizen into a real house with room to spare, so "home" is a building
	* on the map rather than a random patch of ground near the town centre. Falls
	* back to the old drifting offset only when the settlement has no housing left,
	* which is itself a meaningful signal that the city needs to build.
	*/
	claimHome(e, city) {
		if (e.homeBuildingId && city.buildings.has(e.homeBuildingId)) return;
		const familyIds = new Set([
			e.partnerId,
			e.fatherId,
			e.motherId,
			...e.childrenIds
		].filter(Boolean));
		let familyHome = null;
		let houseWithRoom = null;
		let anyWithRoom = null;
		for (const building of city.buildings.values()) {
			if ((building.definition.housing ?? 0) <= 0) continue;
			if (building.freeHousing() <= 0) continue;
			if (!familyHome && [...building.residentIds].some((id) => familyIds.has(id))) familyHome = building;
			if (!houseWithRoom && building.type === "house") houseWithRoom = building;
			if (!anyWithRoom) anyWithRoom = building;
		}
		const home = familyHome ?? houseWithRoom ?? anyWithRoom;
		if (!home) {
			if (e.homeX == null) {
				e.homeX = city.x + rng.range(-3, 3) * .8 + .5;
				e.homeY = city.y + rng.range(-3, 3) * .8 + .5;
			}
			return;
		}
		home.residentIds.add(e.id);
		e.homeBuildingId = home.id;
		e.homeX = home.x + .5;
		e.homeY = home.y + .5;
		if (!e.householdId) e.householdId = (e.partnerId ? this.entities.find((o) => o.id === e.partnerId) : null)?.householdId ?? `hh_${home.id}_${e.id}`;
	}
	/** Execute the current AI state. */
	executeHumanoidState(e, tileMap, particles, speed) {
		switch (e.aiState) {
			case "idle": break;
			case "flee": {
				e.showEmote("run", 20);
				const threats = this.spatialHash.queryRadius(e.x, e.y, 8).filter((o) => this.isEnemy(e, o) || this.isFaunaThreat(o));
				if (threats.length > 0) {
					let closest = threats[0];
					let closestDist = SimplePathfinder.distance(e.x, e.y, closest.x, closest.y);
					for (const t of threats) {
						const d = SimplePathfinder.distance(e.x, e.y, t.x, t.y);
						if (d < closestDist) {
							closest = t;
							closestDist = d;
						}
					}
					const fleeSpeed = e.species === SpeciesType.SYLVANII ? speed * 1.5 : speed * 1.2;
					const pos = SimplePathfinder.fleeFrom(e.x, e.y, closest.x, closest.y, tileMap, fleeSpeed);
					e.x = pos.x;
					e.y = pos.y;
				} else {
					e.aiState = "idle";
					e.aiCooldown = 0;
				}
				break;
			}
			case "attack": {
				const nearby = this.spatialHash.queryRadius(e.x, e.y, DETECTION_RANGE);
				let target = null;
				let targetDist = Infinity;
				this.autoArmSoldier(e);
				for (const other of nearby) {
					if (other.lifeStage === "infant") continue;
					if (this.isEnemy(e, other) || this.isFaunaThreat(other)) {
						const dist = SimplePathfinder.distance(e.x, e.y, other.x, other.y);
						if (e.species === SpeciesType.SYLVANII) {
							if (other.hp < (target?.hp ?? Infinity)) {
								target = other;
								targetDist = dist;
							}
						} else if (e.species === SpeciesType.STONEKIN) {
							if (other.hp > (target?.hp ?? 0)) {
								target = other;
								targetDist = dist;
							}
						} else if (dist < targetDist) {
							target = other;
							targetDist = dist;
						}
					}
				}
				if (target) {
					if (e.profession === "king") e.showEmote("crown", 25);
					else if (e.species === SpeciesType.SYLVANII) e.showEmote("bow", 20);
					else e.showEmote("swords", 20);
					const moraleMult = nearby.some((o) => o.kingdomId === e.kingdomId && o.profession === "king") ? 1.25 : 1;
					const maxReach = e.species === SpeciesType.SYLVANII || e.equipment.weapon?.category === "ranged" ? 5.5 : COMBAT_RANGE;
					if (targetDist <= maxReach && e.attackCooldown <= 0) {
						let dmg = Math.max(1, Math.floor((e.damage - target.defense) * moraleMult));
						if (e.species === SpeciesType.EMBERKIN) {
							dmg = Math.floor(dmg * 1.25);
							particles.spawnParticle(target.x, target.y, "#f59e0b", 0, -.4, .4, 3);
							const tile = tileMap.getTile(Math.floor(target.x), Math.floor(target.y));
							if (tile && Math.random() < .05) tile.isOnFire = true;
						}
						if (e.species === SpeciesType.STONEKIN) dmg = Math.max(dmg, Math.floor(e.damage * .75 * moraleMult));
						if (e.species === SpeciesType.SYLVANII || e.equipment.weapon?.category === "ranged") particles.spawnParticle(target.x, target.y, "#34d399", 0, -.2, .3, 2);
						target.hp -= dmg;
						e.attackCooldown = ATTACK_COOLDOWN;
						particles.spawnDamageNumber(target.x, target.y, dmg);
						sound.playHit();
						if (target.hp <= 0) {
							e.kills++;
							e.gainXp(30 + target.level * 5);
							if (e.kingdomId && target.kingdomId) this.diplomacy.recordBattle(e.kingdomId, target.kingdomId, 1, 0);
						}
					} else if (!((e.species === SpeciesType.SYLVANII || e.equipment.weapon?.category === "ranged") && targetDist < 4)) {
						const attackSpeed = e.species === SpeciesType.EMBERKIN ? speed * 1.3 : e.species === SpeciesType.STONEKIN ? speed * .8 : speed;
						const pos = SimplePathfinder.getStepTowards(e.x, e.y, target.x, target.y, tileMap, attackSpeed);
						e.x = pos.x;
						e.y = pos.y;
					}
				} else this.executeSiegeWarfare(e, tileMap, particles, speed);
				break;
			}
			case "gather_wood": {
				e.showEmote("🪓", 20);
				if (!e.cityId || !this.cities.has(e.cityId)) {
					e.aiState = "wander";
					break;
				}
				const gCity = this.cities.get(e.cityId);
				if (e.targetX === null || e.targetY === null) {
					const target = this.nearestDepositOf(e, gCity, "wood") ?? gCity.nearestCached(TerrainType.FOREST, e.x, e.y) ?? this.findNearestTileType(e.x, e.y, TerrainType.FOREST, tileMap, 12);
					if (target) {
						e.targetX = target.x + .5;
						e.targetY = target.y + .5;
					} else {
						e.aiState = "wander";
						e.aiCooldown = 0;
						break;
					}
				}
				if (SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 1) {
					e.energy = Math.max(0, e.energy - .3);
					e.gainXp(1);
					e.targetX = null;
					e.targetY = null;
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
					if (pos.blocked) {
						e.targetX = null;
						e.targetY = null;
					}
				}
				break;
			}
			case "gather_food": {
				e.showEmote("🌾", 20);
				if (!e.cityId || !this.cities.has(e.cityId)) {
					e.aiState = "wander";
					break;
				}
				const gCity = this.cities.get(e.cityId);
				const bld = e.workplaceId ? gCity.buildings.get(e.workplaceId) : null;
				let fx;
				let fy;
				if (bld) {
					fx = bld.x + .5;
					fy = bld.y + .5;
				} else {
					if (e.targetX === null || e.targetY === null) {
						const patch = this.nearestWildFood(e, gCity);
						if (!patch) {
							e.aiState = "wander";
							e.aiCooldown = 0;
							break;
						}
						e.targetX = patch.x + .5;
						e.targetY = patch.y + .5;
					}
					fx = e.targetX;
					fy = e.targetY;
				}
				if (Math.hypot(fx - e.x, fy - e.y) < .8) {
					e.energy = Math.max(0, e.energy - .2);
					e.gainXp(1);
					if (!bld) {
						e.targetX = null;
						e.targetY = null;
					}
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, fx, fy, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
					if (pos.blocked) {
						e.targetX = null;
						e.targetY = null;
					}
				}
				break;
			}
			case "craft": {
				e.showEmote("⚒️", 20);
				if (!e.cityId || !this.cities.has(e.cityId)) {
					e.aiState = "wander";
					break;
				}
				const cCity = this.cities.get(e.cityId);
				const bench = e.workplaceId ? cCity.buildings.get(e.workplaceId) : null;
				if (!bench) {
					e.aiState = "wander";
					e.aiCooldown = 0;
					break;
				}
				const bx = bench.x + .5;
				const by = bench.y + .5;
				if (Math.hypot(bx - e.x, by - e.y) < .8) {
					e.energy = Math.max(0, e.energy - .25);
					e.gainXp(1);
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, bx, by, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
				}
				break;
			}
			case "gather_ore":
				e.showEmote("⛏️", 20);
				if (!e.cityId || !this.cities.has(e.cityId)) {
					e.aiState = "wander";
					break;
				}
				this.cities.get(e.cityId);
				if (e.targetX === null || e.targetY === null) {
					const deposit = this.findNearestResourceTile(e.x, e.y, tileMap, 10);
					if (deposit) {
						e.targetX = deposit.x + .5;
						e.targetY = deposit.y + .5;
					} else {
						e.aiState = "idle";
						e.aiCooldown = 0;
						break;
					}
				}
				if (SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < 1) {
					e.energy = Math.max(0, e.energy - .3);
					e.gainXp(1);
					e.targetX = null;
					e.targetY = null;
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
					if (pos.blocked) {
						e.targetX = null;
						e.targetY = null;
					}
				}
				break;
			case "raid":
				if (e.targetX === null || e.targetY === null) {
					e.aiState = "patrol";
					e.aiCooldown = 0;
					break;
				}
				if (SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) > 5.5) {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed * 2.5);
					e.x = pos.x;
					e.y = pos.y;
					if (pos.blocked) {
						e.targetX = null;
						e.targetY = null;
						e.aiState = "patrol";
					}
				} else this.doEncampAround(e, e.targetX, e.targetY, tileMap, speed * .6, 4.5);
				break;
			case "patrol": {
				e.showEmote(e.profession === "king" ? "crown" : "shield", 25);
				if (!e.cityId || !this.cities.has(e.cityId)) {
					e.aiState = "wander";
					break;
				}
				const city = this.cities.get(e.cityId);
				const patrolRadius = e.species === SpeciesType.STONEKIN ? 6 : e.species === SpeciesType.EMBERKIN ? 10 : 8;
				this.doWanderNearCity(e, city, tileMap, speed * .9, patrolRadius);
				break;
			}
			case "explore": {
				const exploreRadius = e.species === SpeciesType.SYLVANII ? 25 : 18;
				this.doWander(e, tileMap, speed * 1.1, exploreRadius);
				break;
			}
			case "heal":
				e.hp = Math.min(e.maxHp, e.hp + 3);
				if (e.species === SpeciesType.LUMINI) e.hp = Math.min(e.maxHp, e.hp + 2);
				if (e.hp >= e.maxHp * .9) {
					e.aiState = "idle";
					e.aiCooldown = 0;
				}
				break;
			case "wander":
			default:
				if (e.cityId && this.cities.has(e.cityId)) this.doWanderNearCity(e, this.cities.get(e.cityId), tileMap, speed, 8);
				else this.doWander(e, tileMap, speed, 10);
				break;
			case "sleep": {
				e.showEmote("😴", 20);
				e.energy = Math.min(e.maxEnergy, e.energy + 3);
				const hx = e.homeX ?? (e.cityId ? this.cities.get(e.cityId)?.x : e.x) ?? e.x;
				const hy = e.homeY ?? (e.cityId ? this.cities.get(e.cityId)?.y : e.y) ?? e.y;
				if (Math.hypot(hx - e.x, hy - e.y) > 2) {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, hx, hy, tileMap, speed * .4);
					e.x = pos.x;
					e.y = pos.y;
				}
				break;
			}
			case "go_to_work": {
				e.showEmote("🚶", 15);
				const bid = e.workplaceId;
				if (!bid || !e.cityId) {
					e.aiState = "idle";
					break;
				}
				const wCity = this.cities.get(e.cityId);
				if (!wCity) {
					e.aiState = "idle";
					break;
				}
				const bld = wCity.buildings.get(bid);
				if (!bld) {
					e.aiState = "idle";
					break;
				}
				const wx = bld.x + .5, wy = bld.y + .5;
				if (Math.hypot(wx - e.x, wy - e.y) < .8) {
					e.aiState = "idle";
					e.targetX = wx;
					e.targetY = wy;
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, wx, wy, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
				}
				break;
			}
			case "return_home": {
				e.showEmote("🏠", 15);
				const hx = e.homeX ?? (e.cityId ? this.cities.get(e.cityId)?.x : null) ?? e.x;
				const hy = e.homeY ?? (e.cityId ? this.cities.get(e.cityId)?.y : null) ?? e.y;
				if (Math.hypot(hx - e.x, hy - e.y) < .8) {
					e.aiState = "idle";
					e.targetX = null;
					e.targetY = null;
				} else {
					const pos = SimplePathfinder.getStepTowards(e.x, e.y, hx, hy, tileMap, speed);
					e.x = pos.x;
					e.y = pos.y;
					if (pos.blocked) {
						e.x = hx;
						e.y = hy;
					}
				}
				break;
			}
		}
	}
	doWander(e, tileMap, speed, radius) {
		if (e.targetX === null || e.targetY === null || SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < .3) {
			const target = SimplePathfinder.findRandomWalkable(e.x, e.y, radius, tileMap);
			if (target) {
				e.targetX = target.x;
				e.targetY = target.y;
			} else {
				e.targetX = null;
				e.targetY = null;
				return;
			}
		}
		const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
		e.x = pos.x;
		e.y = pos.y;
		if (pos.blocked) {
			e.targetX = null;
			e.targetY = null;
		}
	}
	doWanderNearCity(e, city, tileMap, speed, radius) {
		if (e.targetX === null || e.targetY === null || SimplePathfinder.distance(e.x, e.y, e.targetX, e.targetY) < .3) {
			const target = SimplePathfinder.findRandomWalkable(city.x, city.y, radius, tileMap);
			if (target) {
				e.targetX = target.x;
				e.targetY = target.y;
			} else {
				e.targetX = null;
				e.targetY = null;
				return;
			}
		}
		const pos = SimplePathfinder.getStepTowards(e.x, e.y, e.targetX, e.targetY, tileMap, speed);
		e.x = pos.x;
		e.y = pos.y;
		if (pos.blocked) {
			e.targetX = null;
			e.targetY = null;
		}
	}
	/**
	* Holds a besieging soldier on a ring around the city he is investing.
	*
	* Each soldier takes his own arc of the encirclement, derived from his id, so
	* an army spreads around the walls instead of piling on one spot. Crucially it
	* does not touch `targetX/targetY`, which stay pointed at the city — the army
	* must not forget what it came to besiege.
	*/
	doEncampAround(e, cx, cy, tileMap, speed, radius) {
		let hash = 0;
		for (let i = e.id.length - 6; i < e.id.length; i++) hash = hash * 31 + e.id.charCodeAt(Math.max(0, i)) | 0;
		const angle = Math.abs(hash) % 360 * (Math.PI / 180);
		const postX = cx + Math.cos(angle) * radius;
		const postY = cy + Math.sin(angle) * radius;
		if (SimplePathfinder.distance(e.x, e.y, postX, postY) < .4) return;
		const pos = SimplePathfinder.getStepTowards(e.x, e.y, postX, postY, tileMap, speed);
		e.x = pos.x;
		e.y = pos.y;
	}
	/** Auto-arm soldiers with tech-tiered weapons & armor. */
	autoArmSoldier(e) {
		if (e.profession !== "soldier" && e.profession !== "king") return;
		if (e.equipment.weapon) return;
		const kingdom = e.kingdomId ? this.kingdoms.get(e.kingdomId) : null;
		const knowsIron = kingdom?.research.knows("metallurgy") || kingdom?.research.knows("iron_working");
		if (kingdom?.research.knows("steel") || kingdom?.research.knows("factories")) {
			const weaponTemplate = rng.pick(WEAPON_TIERS.steel);
			const armorTemplate = rng.pick(ARMOR_TIERS.steel);
			e.equipment.weapon = {
				...weaponTemplate,
				id: `w_${Date.now()}`
			};
			e.equipment.armor = {
				...armorTemplate,
				id: `a_${Date.now()}`
			};
		} else if (knowsIron) {
			const weaponTemplate = rng.pick(WEAPON_TIERS.iron);
			const armorTemplate = rng.pick(ARMOR_TIERS.iron);
			e.equipment.weapon = {
				...weaponTemplate,
				id: `w_${Date.now()}`
			};
			e.equipment.armor = {
				...armorTemplate,
				id: `a_${Date.now()}`
			};
		} else {
			const weaponTemplate = rng.pick(WEAPON_TIERS.primitive);
			const armorTemplate = rng.pick(ARMOR_TIERS.primitive);
			e.equipment.weapon = {
				...weaponTemplate,
				id: `w_${Date.now()}`
			};
			e.equipment.armor = {
				...armorTemplate,
				id: `a_${Date.now()}`
			};
		}
		e.recalculateStats();
	}
	/**
	* With no enemy soldier in reach, a warband presses on toward the nearest
	* enemy settlement and invests it.
	*
	* Taking the city is *not* decided here. A single soldier touching a town
	* centre must not annex it — the yearly warfare tick weighs the besieging army
	* against the city's walls and garrison, and only then does it fall.
	*/
	executeSiegeWarfare(e, tileMap, particles, speed) {
		if (!e.kingdomId) return;
		let enemyCity = null;
		let closestDist = Infinity;
		for (const city of this.cities.values()) if (city.kingdomId && this.diplomacy.isAtWar(e.kingdomId, city.kingdomId)) {
			const dist = Math.hypot(city.x - e.x, city.y - e.y);
			if (dist < closestDist) {
				closestDist = dist;
				enemyCity = city;
			}
		}
		if (!enemyCity) {
			e.aiState = "idle";
			e.aiCooldown = 0;
			return;
		}
		e.showEmote("⚔️", 25);
		if (closestDist > 5.5) {
			const pos = SimplePathfinder.getStepTowards(e.x, e.y, enemyCity.x, enemyCity.y, tileMap, speed * 2.5);
			e.x = pos.x;
			e.y = pos.y;
			return;
		}
		this.doEncampAround(e, enemyCity.x, enemyCity.y, tileMap, speed * .6, 4.5);
		if (rng.chance(.02)) {
			particles.spawnExplosion(enemyCity.x, enemyCity.y, "#ef4444", 6);
			const buildings = [...enemyCity.buildings.values()].filter((b) => b.type !== "town_center");
			if (buildings.length > 0) {
				const hit = rng.pick(buildings);
				hit.hp -= e.damage;
				if (hit.hp <= 0) {
					enemyCity.removeBuilding(hit.id);
					const tile = tileMap.getTile(hit.x, hit.y);
					if (tile && tile.buildingId === hit.id) tile.buildingId = null;
				}
			}
		}
	}
	isEnemy(self, other) {
		if (self.id === other.id) return false;
		if (!self.kingdomId || !other.kingdomId) return false;
		if (self.kingdomId === other.kingdomId) return false;
		return this.diplomacy.isAtWar(self.kingdomId, other.kingdomId);
	}
	isFaunaThreat(entity) {
		return entity.species === SpeciesType.WOLF || entity.species === SpeciesType.BEAR || entity.species === SpeciesType.DRAGON;
	}
	findNearestTileType(x, y, type, tileMap, radius) {
		const cx = Math.floor(x);
		const cy = Math.floor(y);
		let best = null;
		let bestDist = Infinity;
		for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
			const tile = tileMap.getTile(cx + dx, cy + dy);
			if (tile && tile.type === type) {
				const dist = dx * dx + dy * dy;
				if (dist < bestDist) {
					bestDist = dist;
					best = {
						x: cx + dx,
						y: cy + dy
					};
				}
			}
		}
		return best;
	}
	tryJoinOrFoundCity(e, tileMap) {
		const nearby = this.spatialHash.queryRadius(e.x, e.y, 8);
		for (const other of nearby) if (other.species === e.species && other.cityId && this.cities.has(other.cityId)) {
			e.cityId = other.cityId;
			const city = this.cities.get(other.cityId);
			city.population++;
			e.kingdomId = city.kingdomId;
			if (!e.birthCityId) {
				e.birthCityId = city.id;
				e.birthCityName = city.name;
			}
			this.claimHome(e, city);
			return;
		}
		const tile = tileMap.getTile(Math.floor(e.x), Math.floor(e.y));
		if (tile && !tile.type.includes("ocean") && tile.type !== TerrainType.MOUNTAIN && !tile.cityId) {
			const cityId = `city_${Date.now()}_${Math.random()}`;
			const cityName = `${e.name}ton`;
			const city = new City(cityId, cityName, e.species, tile.x, tile.y, e.name, this.currentYear);
			city.population = 1;
			this.cities.set(cityId, city);
			e.cityId = cityId;
			tile.cityId = cityId;
			if (!e.birthCityId) {
				e.birthCityId = cityId;
				e.birthCityName = cityName;
			}
			chronicle.log(this.currentYear, "founding", `The settlement of ${cityName} was founded by ${e.name}.`);
			this.checkKingdomFounding(city, e);
			city.seedFoundingClaim(tileMap, 4);
		}
	}
	checkKingdomFounding(city, rulerCandidate) {
		if (!city.kingdomId) {
			const kingdomId = `king_${Date.now()}_${Math.random()}`;
			const color = getNextKingdomColor();
			const kingdom = new Kingdom(kingdomId, generateKingdomName(), city.species, color, city.id, this.currentYear);
			kingdom.rulerId = rulerCandidate.id;
			rulerCandidate.profession = "king";
			if (!rulerCandidate.dynasty) rulerCandidate.dynasty = generateDynastyName(rulerCandidate.species);
			kingdom.dynasty = rulerCandidate.dynasty;
			kingdom.adoptGovernment("tribe", this.currentYear);
			this.kingdoms.set(kingdomId, kingdom);
			city.kingdomId = kingdomId;
			rulerCandidate.kingdomId = kingdomId;
			chronicle.log(this.currentYear, "kingdom", `The ${kingdom.name} was established. ${rulerCandidate.fullName} leads its people.`);
		}
	}
	/**
	* War, peace and rivalry between realms. Runs once a year alongside the
	* civilization engine, which handles everything economic and political.
	*/
	tickGeopolitics() {
		if (this.kingdoms.size < 2) return;
		const kingdoms = Array.from(this.kingdoms.values());
		for (let i = 0; i < kingdoms.length; i++) for (let j = i + 1; j < kingdoms.length; j++) {
			const k1 = kingdoms[i];
			const k2 = kingdoms[j];
			if (!k1.knownKingdoms.has(k2.id)) continue;
			if (k1.overlordId === k2.id || k2.overlordId === k1.id) continue;
			if (k1.overlordId && k1.overlordId === k2.overlordId) continue;
			if (rng.chance(.35)) {
				const drift = k1.species !== k2.species ? -2 : 1;
				this.diplomacy.changeRelation(k1.id, k2.id, drift);
			}
			const gov1 = GOVERNMENTS[k1.government];
			const gov2 = GOVERNMENTS[k2.government];
			if (gov1.economy !== gov2.economy && (gov1.economy === "planned" || gov2.economy === "planned")) {
				if (rng.chance(.3)) this.diplomacy.changeRelation(k1.id, k2.id, -3);
			}
			if (this.diplomacy.isAtWar(k1.id, k2.id)) continue;
			const relation = this.diplomacy.getRelation(k1.id, k2.id);
			if (relation > -35) continue;
			const aggressor = gov1.aggression >= gov2.aggression ? k1 : k2;
			const defender = aggressor === k1 ? k2 : k1;
			const aggression = GOVERNMENTS[aggressor.government].aggression * (.72 + aggressor.culture.militarism * .28 + aggressor.culture.expansionism * .2 - aggressor.culture.warTrauma * .18 - aggressor.culture.diplomaticTrust * .08) * (.78 + aggressor.society.warPressure * .34 - aggressor.society.peacePressure * .18);
			const powerRatio = aggressor.computePower() / Math.max(1, defender.computePower());
			const confidence = Math.min(2, powerRatio);
			if (rng.chance(.06 * aggression * confidence)) {
				const reason = aggressor.isEmpire ? "Imperial Expansion" : powerRatio > 1.8 ? "Conquest" : relation <= -80 ? "Blood Feud" : "Border Dispute";
				if (this.diplomacy.declareWar(aggressor.id, defender.id, this.currentYear, reason)) chronicle.log(this.currentYear, "war", `${aggressor.name} declared war upon ${defender.name}. Reason: ${reason}`);
			}
		}
		for (const kingdom of kingdoms) {
			const wars = this.diplomacy.getWarsFor(kingdom.id);
			kingdom.warWeariness = wars.length > 0 ? Math.min(100, kingdom.warWeariness + wars.length * 4) : Math.max(0, kingdom.warWeariness - 6);
		}
	}
	/**
	* Couples form, children are born, and bloodlines carry traits forward.
	* This is the only source of new citizens — settlements grow because people
	* actually have families in them.
	*/
	tickFamilies(tileMap) {
		const byCity = /* @__PURE__ */ new Map();
		for (const e of this.entities) {
			if (!e.cityId || !SPECIES_DEFINITIONS[e.species].isHumanoid) continue;
			if (!byCity.has(e.cityId)) byCity.set(e.cityId, []);
			byCity.get(e.cityId).push(e);
		}
		for (const [cityId, residents] of byCity) {
			const city = this.cities.get(cityId);
			if (!city) continue;
			const housing = Math.max(4, city.housingCapacity());
			const crowded = residents.length >= housing;
			const foodPerHead = city.stock.get("food") / Math.max(1, residents.length);
			const single = residents.filter((e) => !e.partnerId && e.isFertile(SPECIES_DEFINITIONS[e.species].maxAge));
			for (let i = 0; i < single.length; i++) {
				if (single[i].partnerId) continue;
				for (let j = i + 1; j < single.length; j++) {
					if (single[j].partnerId) continue;
					if (!canPairWith(single[i], single[j])) continue;
					if (!rng.chance(.45)) continue;
					formPartnership(single[i], single[j]);
					break;
				}
			}
			if (crowded || foodPerHead < 1.6) continue;
			const couples = /* @__PURE__ */ new Set();
			for (const parent of residents) {
				if (parent.gender !== "female" || parent.isPregnant) continue;
				if (!parent.partnerId || couples.has(parent.id)) continue;
				const partner = this.entities.find((e) => e.id === parent.partnerId);
				if (!partner || partner.cityId !== cityId) continue;
				couples.add(parent.id);
				couples.add(partner.id);
				const maxAge = SPECIES_DEFINITIONS[parent.species].maxAge;
				if (!parent.isFertile(maxAge) || !partner.isFertile(maxAge)) continue;
				let chance = .55 * city.prosperity + Math.min(.3, foodPerHead / 22);
				if (parent.species === SpeciesType.STONEKIN) {
					if (city.stock.get("stone") < 8) continue;
					city.stock.take("stone", 8);
					chance *= .85;
				} else if (parent.species === SpeciesType.EMBERKIN) chance *= 1.25;
				else if (parent.species === SpeciesType.SYLVANII) chance *= .75;
				if (!rng.chance(chance)) continue;
				const father = partner.gender === "male" ? partner : parent;
				const mother = parent.gender === "female" ? parent : partner;
				const gestation = SPECIES_DEFINITIONS[mother.species].gestationYears ?? 1;
				mother.isPregnant = true;
				mother.pregnancyTimer = gestation;
				mother.pregnantFatherId = father.id;
				mother.showEmote("🤰", 60);
				chronicle.log(this.currentYear, "society", `🤰 ${mother.fullName} está gestando um novo herdeiro(a) com ${father.fullName} em ${city.name}.`);
				city.stock.take("food", 4);
			}
		}
	}
	findWalkableNear(x, y, radius, tileMap) {
		for (let i = 0; i < 10; i++) {
			const nx = x + rng.rangeInt(-radius, radius);
			const ny = y + rng.rangeInt(-radius, radius);
			const tile = tileMap.getTile(nx, ny);
			if (tile && !tile.type.includes("ocean") && tile.type !== TerrainType.MOUNTAIN) return {
				x: nx,
				y: ny
			};
		}
		return {
			x,
			y
		};
	}
	/**
	* The enemy settlement this soldier should march on, or null in peacetime.
	*
	* Realms concentrate on the nearest enemy city, so armies converge into a real
	* siege rather than scattering across the whole front.
	*/
	pickRaidTarget(soldier) {
		if (!soldier.kingdomId) return null;
		const enemies = this.diplomacy.getEnemies(soldier.kingdomId);
		if (enemies.length === 0) return null;
		const homeUnderSiege = [...this.cities.values()].find((c) => c.kingdomId === soldier.kingdomId && c.besiegerId);
		if (homeUnderSiege) return homeUnderSiege;
		let best = null;
		let bestScore = Infinity;
		for (const city of this.cities.values()) {
			if (!city.kingdomId || !enemies.includes(city.kingdomId)) continue;
			const score = Math.hypot(city.x - soldier.x, city.y - soldier.y) + city.defenseMultiplier() * 12;
			if (score < bestScore) {
				bestScore = score;
				best = city;
			}
		}
		return best && Math.hypot(best.x - soldier.x, best.y - soldier.y) < 55 ? best : null;
	}
	/** Nearest tile carrying any harvestable deposit. Used by miners. */
	findNearestResourceTile(x, y, tileMap, radius) {
		const cx = Math.floor(x);
		const cy = Math.floor(y);
		let best = null;
		let bestDist = Infinity;
		for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
			const tile = tileMap.getTile(cx + dx, cy + dy);
			if (!tile || !tile.resourceType || !MINEABLE_GOODS.includes(tile.resourceType)) continue;
			if (tile.resourceAmount <= 0) continue;
			const dist = dx * dx + dy * dy;
			if (dist < bestDist) {
				bestDist = dist;
				best = tile;
			}
		}
		return best;
	}
	tickAge() {
		const toKill = [];
		for (const e of [...this.entities]) {
			if (e.fertilityCooldown > 0) e.fertilityCooldown--;
			if (e.cityId && !e.homeBuildingId && SPECIES_DEFINITIONS[e.species].isHumanoid) {
				const home = this.cities.get(e.cityId);
				if (home) this.claimHome(e, home);
			}
			if (e.isPregnant) {
				e.pregnancyTimer--;
				e.showEmote("🤰", 40);
				if (e.pregnancyTimer <= 0) this.processBirthEvent(e);
			}
			if (e.traits.has(TraitId.IMMORTAL)) continue;
			const oldAge = e.age;
			e.age++;
			const maxAge = SPECIES_DEFINITIONS[e.species].maxAge;
			const isHumanoid = SPECIES_DEFINITIONS[e.species].isHumanoid;
			if (oldAge <= 2 && e.lifeStage === "infant") {
				const city = e.cityId ? this.cities.get(e.cityId) : null;
				const prosperity = city?.prosperity ?? 0;
				let risk = isHumanoid ? .03 : .06;
				if (prosperity >= .6) risk *= .2;
				if (rng.chance(risk)) {
					toKill.push(e);
					chronicle.log(this.currentYear, "society", isHumanoid ? `🕊️ Bebê ${e.fullName} (${Math.floor(e.age)} anos) faleceu por doença infantil em ${city?.name ?? "terras ermas"}.` : `🕊️ Filhote ${e.name} (${e.species}) não sobreviveu à infância.`);
					continue;
				}
			}
			if (oldAge === 0 && e.age === 1 && isHumanoid) {
				const city = e.cityId ? this.cities.get(e.cityId) : null;
				if (city) chronicle.log(this.currentYear, "society", `🍼 ${e.fullName} sobreviveu ao primeiro ano de vida em ${city.name}!`);
			}
			if (oldAge === 12 && e.age === 13 && isHumanoid) {
				e.showEmote("📖", 50);
				if (e.cityId && this.cities.has(e.cityId)) {
					const city = this.cities.get(e.cityId);
					chronicle.log(this.currentYear, "society", `📖 ${e.fullName} tornou-se adolescente em ${city.name}.`);
				}
			}
			if (oldAge < 18 && e.age >= 18) {
				e.showEmote("✨", 60);
				e.recalculateStats();
				e.hp = e.maxHp;
				if (e.cityId && this.cities.has(e.cityId)) {
					const city = this.cities.get(e.cityId);
					if (e.profession === "none") this.assignProfession(e, city);
					chronicle.log(this.currentYear, "society", `✨ ${e.fullName} alcançou a idade adulta (18 anos) e ganhou cidadania plena em ${city.name}!`);
				}
			}
			if (e.age > maxAge * .85) {
				const frailty = (e.age - maxAge * .85) / (maxAge * .3);
				if (rng.chance(.05 + frailty * .25)) e.hp = 0;
			}
		}
		for (const dead of toKill) {
			dead.hp = 0;
			this.handleEntityDeath(dead, null);
		}
	}
	processBirthEvent(mother) {
		mother.isPregnant = false;
		mother.pregnancyTimer = 0;
		mother.fertilityCooldown = rng.rangeInt(2, 4);
		const city = mother.cityId ? this.cities.get(mother.cityId) : null;
		const kingdom = mother.kingdomId ? this.kingdoms.get(mother.kingdomId) : null;
		let fatherEntity;
		const fatherMember = mother.pregnantFatherId ? this.entities.find((e) => e.id === mother.pregnantFatherId) || this.deceasedAncestors.get(mother.pregnantFatherId) : null;
		if (fatherMember && !("isDeceased" in fatherMember)) fatherEntity = fatherMember;
		else {
			fatherEntity = new Entity(`f_${Date.now()}`, mother.species, mother.x, mother.y, fatherMember?.name ?? "Pai Ancestral");
			fatherEntity.dynasty = fatherMember?.dynasty ?? mother.dynasty;
		}
		const birthX = mother.homeX ?? mother.x;
		const birthY = mother.homeY ?? mother.y;
		const isTwins = rng.chance(.05);
		const birthCount = isTwins ? 2 : 1;
		for (let b = 0; b < birthCount; b++) {
			const { child } = conceiveChild(fatherEntity, mother, birthX + b * .3, birthY, () => `ent_${Date.now()}_${Math.random()}`);
			child.showEmote("👶", 60);
			child.birthYear = this.currentYear;
			child.birthCityId = city?.id ?? mother.birthCityId;
			child.birthCityName = city?.name ?? mother.birthCityName;
			child.householdId = mother.householdId ?? fatherEntity.householdId;
			child.homeBuildingId = mother.homeBuildingId;
			child.homeX = mother.homeX;
			child.homeY = mother.homeY;
			child.wealth = 0;
			if ((fatherEntity.profession === "king" || mother.profession === "king" || kingdom && kingdom.rulerId === mother.id) && kingdom) chronicle.log(this.currentYear, "king", `👑 Nascimentos Imperiais! Nasceu o herdeiro(a) real ${child.fullName} da Dinastia ${kingdom.dynasty ?? child.dynasty} em ${city?.name ?? "Capital"}!`);
			else chronicle.log(this.currentYear, "society", isTwins ? `👶👶 Gêmeos! Nasceu ${child.fullName}, filho(a) de ${fatherEntity.name} e ${mother.name} em ${city?.name ?? "Vila"}!` : `👶 Nasceu ${child.fullName}, filho(a) de ${fatherEntity.name} e ${mother.name} em ${city?.name ?? "Vila"}!`);
			this.entities.push(child);
			this.spatialHash.insert(child);
			this.totalBirths++;
		}
		if (city) city.stock.take("food", 4);
		sound.playMagic();
	}
	handleEntityDeath(dead, particles) {
		const homeCity = dead.cityId ? this.cities.get(dead.cityId) : null;
		if (homeCity) {
			if (dead.homeBuildingId) homeCity.buildings.get(dead.homeBuildingId)?.residentIds.delete(dead.id);
			if (dead.workplaceId) homeCity.buildings.get(dead.workplaceId)?.assignedWorkerIds.delete(dead.id);
		}
		this.deceasedAncestors.set(dead.id, {
			id: dead.id,
			name: dead.name,
			dynasty: dead.dynasty,
			fullName: dead.fullName,
			species: dead.species,
			gender: dead.gender,
			birthYear: Math.max(1, this.currentYear - dead.age),
			deathYear: this.currentYear,
			ageAtDeath: dead.age,
			profession: dead.profession,
			title: dead.title,
			isGreatPerson: dead.isGreatPerson,
			fatherId: dead.fatherId,
			motherId: dead.motherId,
			partnerId: dead.partnerId,
			childrenIds: [...dead.childrenIds],
			generation: dead.generation,
			isDeceased: true
		});
		const idx = this.entities.indexOf(dead);
		if (idx !== -1) this.entities.splice(idx, 1);
		this.spatialHash.remove(dead);
		this.totalDeaths++;
		if (particles) particles.spawnExplosion(dead.x, dead.y, "#ef4444", 8);
		if (dead.species === SpeciesType.DRAGON || dead.species === SpeciesType.BEAR || dead.profession === "king" || dead.level >= 5) {
			const nearbyHumanoids = this.spatialHash.queryRadius(dead.x, dead.y, 4).filter((e) => SPECIES_DEFINITIONS[e.species].isHumanoid);
			if (nearbyHumanoids.length > 0) {
				const hero = rng.pick(nearbyHumanoids);
				const item = {
					...rng.pick(LEGENDARY_ITEMS),
					id: `item_${Date.now()}`
				};
				if (item.type === "weapon") hero.equipment.weapon = item;
				else hero.equipment.armor = item;
				hero.recalculateStats();
				chronicle.log(this.currentYear, "disaster", `${hero.name} looted the legendary ${item.name} from the slain ${dead.name}!`);
			}
		}
		if (dead.cityId && this.cities.has(dead.cityId)) {
			const city = this.cities.get(dead.cityId);
			city.population = Math.max(0, city.population - 1);
			city.unassignWorker(dead.id);
		}
		if (dead.partnerId) {
			const partner = this.entities.find((e) => e.id === dead.partnerId);
			if (partner) partner.partnerId = null;
		}
		if (dead.profession === "king" && dead.kingdomId && this.kingdoms.has(dead.kingdomId)) {
			const kingdom = this.kingdoms.get(dead.kingdomId);
			const title = kingdom.rulerTitle;
			chronicle.log(this.currentYear, "king", `${title} ${dead.fullName} of ${kingdom.name} has passed away.`);
			const candidates = this.entities.filter((e) => e.kingdomId === kingdom.id && e.id !== dead.id);
			const successionMode = GOVERNMENTS[kingdom.government].succession;
			const heir = chooseSuccessor(dead.id, kingdom.dynasty, candidates, successionMode);
			if (heir) {
				heir.profession = "king";
				kingdom.rulerId = heir.id;
				if (successionMode === "bloodline" && heir.dynasty) kingdom.dynasty = heir.dynasty;
				else if (!heir.dynasty) {
					heir.dynasty = generateDynastyName(heir.species);
					kingdom.dynasty = heir.dynasty;
				} else kingdom.dynasty = heir.dynasty;
				const how = successionMode === "election" ? "was elected" : heir.fatherId === dead.id || heir.motherId === dead.id ? "inherited the throne as heir" : "seized the throne";
				chronicle.log(this.currentYear, "king", `${heir.fullName} ${how} of ${kingdom.name}.`);
				events.emit("rulerCrowned", {
					kingdom,
					ruler: heir,
					previous: dead,
					year: this.currentYear
				});
			} else {
				kingdom.rulerId = null;
				chronicle.log(this.currentYear, "king", `${kingdom.name} is left without a ruler.`);
			}
		}
	}
};
//#endregion
//#region src/world/Deposits.ts
var RENEWABLE = /* @__PURE__ */ new Set([
	"food",
	"wood",
	"horses",
	"cotton",
	"spices",
	"furs",
	"rubber"
]);
function isRenewableGood(good) {
	return !!good && RENEWABLE.has(good);
}
function isWater(type) {
	return type === TerrainType.DEEP_OCEAN || type === TerrainType.SHALLOW_WATER;
}
function isLand(tile) {
	return !isWater(tile.type) && tile.type !== TerrainType.LAVA;
}
function tierRank(good) {
	if (!good) return -1;
	const tier = GOODS[good]?.tier;
	return tier === "strategic" ? 3 : tier === "regional" ? 2 : 1;
}
function canReplace(existing, incoming) {
	if (!existing || existing === incoming) return true;
	return tierRank(incoming) > tierRank(existing);
}
function setResource(tile, good, amount, maxAmount = amount) {
	if (!canReplace(tile.resourceType, good)) return;
	tile.resourceType = good;
	tile.resourceAmount = Math.max(1, Math.round(amount));
	tile.resourceMax = Math.max(tile.resourceAmount, Math.round(maxAmount));
}
function countForArea(width, height, baseAt128, minimum = 1) {
	const scale = width * height / 16384;
	return Math.max(minimum, Math.round(baseAt128 * scale));
}
function placeClusteredResource(grid, width, height, rng, spec) {
	const eligible = [];
	for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
		const tile = grid[x][y];
		if (spec.predicate(tile, x, y, grid)) eligible.push({
			x,
			y
		});
	}
	if (eligible.length === 0) return;
	const usedCenters = [];
	const minimumCenterDistance = Math.max(4, spec.radius * 2.2);
	for (let cluster = 0; cluster < spec.clusters; cluster++) {
		let center = rng.pick(eligible);
		for (let attempt = 0; attempt < 80; attempt++) {
			const candidate = rng.pick(eligible);
			if (usedCenters.every((c) => Math.hypot(c.x - candidate.x, c.y - candidate.y) >= minimumCenterDistance)) {
				center = candidate;
				break;
			}
		}
		usedCenters.push(center);
		const r = spec.radius;
		for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
			const x = center.x + dx;
			const y = center.y + dy;
			if (x < 0 || y < 0 || x >= width || y >= height) continue;
			const tile = grid[x][y];
			if (!spec.predicate(tile, x, y, grid)) continue;
			const dist = Math.hypot(dx, dy);
			if (dist > r + .35) continue;
			const centerBias = 1 - dist / (r + .75);
			const chance = Math.min(.98, spec.density * (.48 + centerBias * .72));
			if (!rng.chance(chance) && !(dx === 0 && dy === 0)) continue;
			const richness = .75 + centerBias * .55 + rng.range(-.12, .12);
			const maxAmount = rng.range(spec.minAmount, spec.maxAmount) * richness;
			const initial = maxAmount * rng.range(.72, 1);
			setResource(tile, spec.good, initial, maxAmount);
		}
	}
}
function coastalLand(grid, width, height, x, y) {
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	]) {
		const nx = x + dx;
		const ny = y + dy;
		if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
		if (isWater(grid[nx][ny].type)) return true;
	}
	return false;
}
/** Generate every natural resource deposit in a deterministic pass. */
function generateDeposits(grid, width, height, seed) {
	const rng = new RandomService((seed ^ 1597463007) >>> 0);
	for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
		const tile = grid[x][y];
		if (!isLand(tile)) continue;
		if (tile.type === TerrainType.FOREST) {
			if (rng.chance(.85)) {
				const max = rng.range(80, 170) * (.75 + tile.moisture * .5);
				setResource(tile, "wood", max * rng.range(.72, 1), max);
			} else if (rng.chance(.25)) {
				const max = rng.range(50, 120) * (.8 + tile.fertility * .5);
				setResource(tile, "food", max * rng.range(.6, .95), max);
			}
		} else if ((tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && rng.chance(.35 + tile.moisture * .25)) {
			const max = rng.range(60, 150) * (.8 + tile.fertility * .6);
			setResource(tile, "food", max * rng.range(.65, 1), max);
		}
		if (!tile.resourceType && (tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SWAMP) && rng.chance(.2)) {
			const max = rng.range(35, 80);
			setResource(tile, "wood", max * rng.range(.6, .95), max);
		}
		const rockyGround = tile.type === TerrainType.TUNDRA || tile.type === TerrainType.SNOW || (tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS || tile.type === TerrainType.SAND) && tile.height > .58;
		if (tile.type === TerrainType.MOUNTAIN && rng.chance(.62)) {
			const max = rng.range(90, 190);
			setResource(tile, "stone", max * rng.range(.75, 1), max);
		} else if (rockyGround && rng.chance(.3)) {
			const max = rng.range(45, 110);
			setResource(tile, "stone", max * rng.range(.7, 1), max);
		} else if ((tile.type === TerrainType.SOIL || tile.type === TerrainType.SAND) && rng.chance(coastalLand(grid, width, height, x, y) ? .22 : .09)) {
			const max = rng.range(50, 110);
			setResource(tile, "clay", max * rng.range(.7, 1), max);
		}
	}
	const mountainOrHighland = (tile) => tile.type === TerrainType.MOUNTAIN || (tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.height > .61;
	const rockyDry = (tile) => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SAND || tile.type === TerrainType.SOIL && tile.moisture < .42;
	const warmField = (tile) => (tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && tile.temperature >= 14;
	const tropical = (tile) => (tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP) && tile.temperature >= 22 && tile.moisture >= .55;
	const coldLand = (tile) => tile.type === TerrainType.TUNDRA || tile.type === TerrainType.SNOW;
	const regional = [
		{
			good: "copper",
			clusters: countForArea(width, height, 11, 4),
			radius: 2,
			minAmount: 55,
			maxAmount: 120,
			density: .72,
			predicate: mountainOrHighland
		},
		{
			good: "iron",
			clusters: countForArea(width, height, 13, 5),
			radius: 2,
			minAmount: 75,
			maxAmount: 155,
			density: .78,
			predicate: mountainOrHighland
		},
		{
			good: "coal",
			clusters: countForArea(width, height, 9, 3),
			radius: 3,
			minAmount: 85,
			maxAmount: 180,
			density: .68,
			predicate: (tile) => mountainOrHighland(tile, 0, 0, grid) || tile.type === TerrainType.SWAMP
		},
		{
			good: "salt",
			clusters: countForArea(width, height, 7, 3),
			radius: 2,
			minAmount: 60,
			maxAmount: 135,
			density: .62,
			predicate: (tile, x, y, g) => tile.type === TerrainType.SAND || tile.type === TerrainType.SOIL && coastalLand(g, width, height, x, y)
		},
		{
			good: "gold",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 30,
			maxAmount: 75,
			density: .5,
			predicate: mountainOrHighland
		},
		{
			good: "gems",
			clusters: countForArea(width, height, 4, 2),
			radius: 1,
			minAmount: 24,
			maxAmount: 58,
			density: .6,
			predicate: (tile) => tile.type === TerrainType.MOUNTAIN && tile.height > .7
		},
		{
			good: "horses",
			clusters: countForArea(width, height, 8, 3),
			radius: 3,
			minAmount: 45,
			maxAmount: 100,
			density: .5,
			predicate: (tile) => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA
		},
		{
			good: "cotton",
			clusters: countForArea(width, height, 9, 3),
			radius: 3,
			minAmount: 55,
			maxAmount: 115,
			density: .58,
			predicate: warmField
		},
		{
			good: "spices",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 35,
			maxAmount: 85,
			density: .5,
			predicate: tropical
		},
		{
			good: "furs",
			clusters: countForArea(width, height, 6, 2),
			radius: 3,
			minAmount: 40,
			maxAmount: 90,
			density: .5,
			predicate: coldLand
		}
	];
	for (const spec of regional) placeClusteredResource(grid, width, height, rng, spec);
	const strategic = [
		{
			good: "tin",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 45,
			maxAmount: 100,
			density: .56,
			predicate: mountainOrHighland
		},
		{
			good: "oil",
			clusters: countForArea(width, height, 4, 2),
			radius: 3,
			minAmount: 140,
			maxAmount: 310,
			density: .7,
			predicate: (tile) => (tile.type === TerrainType.SAND || tile.type === TerrainType.SWAMP || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && tile.height < .72
		},
		{
			good: "saltpeter",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 55,
			maxAmount: 120,
			density: .55,
			predicate: rockyDry
		},
		{
			good: "rubber",
			clusters: countForArea(width, height, 5, 2),
			radius: 3,
			minAmount: 70,
			maxAmount: 150,
			density: .58,
			predicate: tropical
		},
		{
			good: "uranium",
			clusters: countForArea(width, height, 2, 1),
			radius: 2,
			minAmount: 45,
			maxAmount: 95,
			density: .48,
			predicate: (tile) => tile.type === TerrainType.MOUNTAIN && tile.height > .78
		}
	];
	for (const spec of strategic) placeClusteredResource(grid, width, height, rng, spec);
	const summary = {
		tiles: {},
		amount: {}
	};
	for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
		const tile = grid[x][y];
		const good = tile.resourceType;
		if (!good) continue;
		summary.tiles[good] = (summary.tiles[good] ?? 0) + 1;
		summary.amount[good] = (summary.amount[good] ?? 0) + tile.resourceAmount;
	}
	return summary;
}
//#endregion
//#region src/world/Noise.ts
var SimplexNoise = class SimplexNoise {
	p = /* @__PURE__ */ new Uint8Array(256);
	perm = /* @__PURE__ */ new Uint8Array(512);
	permMod12 = /* @__PURE__ */ new Uint8Array(512);
	static F2 = .5 * (Math.sqrt(3) - 1);
	static G2 = (3 - Math.sqrt(3)) / 6;
	static grad3 = new Float32Array([
		1,
		1,
		0,
		-1,
		1,
		0,
		1,
		-1,
		0,
		-1,
		-1,
		0,
		1,
		0,
		1,
		-1,
		0,
		1,
		1,
		0,
		-1,
		-1,
		0,
		-1,
		0,
		1,
		1,
		0,
		-1,
		1,
		0,
		1,
		-1,
		0,
		-1,
		-1
	]);
	constructor(rng) {
		for (let i = 0; i < 256; i++) this.p[i] = i;
		for (let i = 255; i > 0; i--) {
			const r = Math.floor(rng.next() * (i + 1));
			const temp = this.p[i];
			this.p[i] = this.p[r];
			this.p[r] = temp;
		}
		for (let i = 0; i < 512; i++) {
			this.perm[i] = this.p[i & 255];
			this.permMod12[i] = this.perm[i] % 12;
		}
	}
	noise2D(xin, yin) {
		let n0 = 0, n1 = 0, n2 = 0;
		const s = (xin + yin) * SimplexNoise.F2;
		const i = Math.floor(xin + s);
		const j = Math.floor(yin + s);
		const t = (i + j) * SimplexNoise.G2;
		const X0 = i - t;
		const Y0 = j - t;
		const x0 = xin - X0;
		const y0 = yin - Y0;
		let i1, j1;
		if (x0 > y0) {
			i1 = 1;
			j1 = 0;
		} else {
			i1 = 0;
			j1 = 1;
		}
		const x1 = x0 - i1 + SimplexNoise.G2;
		const y1 = y0 - j1 + SimplexNoise.G2;
		const x2 = x0 - 1 + 2 * SimplexNoise.G2;
		const y2 = y0 - 1 + 2 * SimplexNoise.G2;
		const ii = i & 255;
		const jj = j & 255;
		let t0 = .5 - x0 * x0 - y0 * y0;
		if (t0 >= 0) {
			const gi0 = this.permMod12[ii + this.perm[jj]] * 3;
			t0 *= t0;
			n0 = t0 * t0 * (SimplexNoise.grad3[gi0] * x0 + SimplexNoise.grad3[gi0 + 1] * y0);
		}
		let t1 = .5 - x1 * x1 - y1 * y1;
		if (t1 >= 0) {
			const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]] * 3;
			t1 *= t1;
			n1 = t1 * t1 * (SimplexNoise.grad3[gi1] * x1 + SimplexNoise.grad3[gi1 + 1] * y1);
		}
		let t2 = .5 - x2 * x2 - y2 * y2;
		if (t2 >= 0) {
			const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]] * 3;
			t2 *= t2;
			n2 = t2 * t2 * (SimplexNoise.grad3[gi2] * x2 + SimplexNoise.grad3[gi2 + 1] * y2);
		}
		return 70 * (n0 + n1 + n2);
	}
	octave2D(x, y, octaves = 4, persistence = .5, scale = .02) {
		let total = 0;
		let frequency = scale;
		let amplitude = 1;
		let maxValue = 0;
		for (let i = 0; i < octaves; i++) {
			total += this.noise2D(x * frequency, y * frequency) * amplitude;
			maxValue += amplitude;
			amplitude *= persistence;
			frequency *= 2;
		}
		return (total / maxValue + 1) / 2;
	}
};
//#endregion
//#region src/world/WorldGenerator.ts
var WorldGenerator = class {
	static generate(width, height, presetInput = "single_continent", seed) {
		const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);
		const rng = new RandomService(actualSeed);
		const noiseHeight = new SimplexNoise(rng);
		const noiseRidge = new SimplexNoise(new RandomService(actualSeed + 500));
		const noiseMoisture = new SimplexNoise(new RandomService(actualSeed + 1e3));
		const noiseTemp = new SimplexNoise(new RandomService(actualSeed + 2e3));
		const preset = presetInput === "random" ? rng.pick([
			"archipelago",
			"single_continent",
			"two_continents",
			"fragmented",
			"desert",
			"frozen",
			"ring_atoll"
		]) : presetInput;
		const grid = [];
		const centerX = width / 2;
		const centerY = height / 2;
		const maxRadius = Math.min(width, height) * .45;
		for (let x = 0; x < width; x++) {
			grid[x] = [];
			for (let y = 0; y < height; y++) {
				let nH = noiseHeight.octave2D(x, y, 5, .5, .02);
				const rN = 1 - Math.abs(noiseRidge.octave2D(x, y, 3, .5, .045) * 2 - 1);
				let nM = noiseMoisture.octave2D(x, y, 4, .5, .03);
				let nT = noiseTemp.octave2D(x, y, 3, .5, .01);
				const ridge = rN > .62 ? (rN - .62) / .38 : 0;
				nH = nH * .78 + ridge * ridge * .42;
				const dx = x - centerX;
				const dy = y - centerY;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (preset === "single_continent") {
					const islandMask = Math.max(0, 1 - dist / maxRadius);
					nH = nH * .55 + islandMask * .55;
				} else if (preset === "two_continents") {
					const c1Dist = Math.sqrt((x - width * .28) ** 2 + (y - height * .5) ** 2);
					const c2Dist = Math.sqrt((x - width * .72) ** 2 + (y - height * .5) ** 2);
					const m1 = Math.max(0, 1 - c1Dist / (maxRadius * .65));
					const m2 = Math.max(0, 1 - c2Dist / (maxRadius * .65));
					nH = nH * .45 + Math.max(m1, m2) * .55;
				} else if (preset === "archipelago") {
					nH = nH * .85;
					if (nH < .42) nH *= .65;
				} else if (preset === "ring_atoll") {
					const ringDist = Math.abs(dist - maxRadius * .65);
					const ringMask = Math.max(0, 1 - ringDist / (maxRadius * .35));
					nH = nH * .4 + ringMask * .6;
				} else if (preset === "fragmented") nH = nH * 1.6 % 1;
				const latitude = Math.abs(y / height * 2 - 1);
				let tempC = 34 - latitude * latitude * 58 + (nT - .5) * 20;
				tempC -= Math.max(0, nH - .5) * 38;
				if (preset === "desert") {
					tempC += 22;
					nM *= .25;
				} else if (preset === "frozen") {
					tempC -= 32;
					nM *= 1.3;
				}
				let type;
				if (nH < .26) type = TerrainType.DEEP_OCEAN;
				else if (nH < .35) type = TerrainType.SHALLOW_WATER;
				else if (nH < .41) type = TerrainType.SAND;
				else if (nH > .82) type = TerrainType.MOUNTAIN;
				else if (tempC < -5) type = nM > .5 ? TerrainType.SNOW : TerrainType.TUNDRA;
				else if (tempC > 28 && nM < .35) type = TerrainType.SAVANNA;
				else if (nM > .62) type = nH > .62 ? TerrainType.FOREST : TerrainType.SWAMP;
				else if (nM > .38) type = TerrainType.GRASS;
				else type = TerrainType.SOIL;
				if (nH > .5 && nH < .78 && rng.chance(.015)) type = rng.chance(.5) ? TerrainType.ARCANE : TerrainType.CORRUPTED;
				const tile = new Tile(x, y, type, nH);
				tile.temperature = Math.round(tempC);
				tile.moisture = Math.min(1, Math.max(0, nM));
				const biomeBase = type === TerrainType.GRASS ? .88 : type === TerrainType.SOIL ? .76 : type === TerrainType.FOREST ? .72 : type === TerrainType.SAVANNA ? .52 : type === TerrainType.SWAMP ? .46 : type === TerrainType.SAND ? .18 : type === TerrainType.TUNDRA ? .22 : type === TerrainType.SNOW || type === TerrainType.MOUNTAIN ? .08 : .04;
				const moistureFit = 1 - Math.min(.65, Math.abs(tile.moisture - .55) * .9);
				tile.fertility = Math.max(.02, Math.min(1, biomeBase * moistureFit));
				grid[x][y] = tile;
			}
		}
		this.carveRivers(grid, width, height, rng);
		this.smoothBiomes(grid, width, height);
		generateDeposits(grid, width, height, actualSeed);
		return grid;
	}
	/** Carves natural rivers flowing down from mountain ridges to the coast */
	static carveRivers(grid, width, height, rng) {
		const mountainTiles = [];
		for (let x = 2; x < width - 2; x++) for (let y = 2; y < height - 2; y++) if (grid[x][y].type === TerrainType.MOUNTAIN && grid[x][y].height > .82) mountainTiles.push({
			x,
			y
		});
		if (mountainTiles.length === 0) return;
		const riverCount = Math.min(6, Math.max(2, Math.floor(mountainTiles.length / 15)));
		const selectedSources = [];
		const pool = [...mountainTiles];
		while (selectedSources.length < riverCount && pool.length > 0) {
			const idx = Math.floor(rng.next() * pool.length);
			selectedSources.push(pool.splice(idx, 1)[0]);
		}
		for (const source of selectedSources) {
			let currX = source.x;
			let currY = source.y;
			let steps = 0;
			while (steps < 120) {
				steps++;
				const currTile = grid[currX][currY];
				if (currTile.type === TerrainType.DEEP_OCEAN || currTile.type === TerrainType.SHALLOW_WATER) break;
				if (currTile.type !== TerrainType.MOUNTAIN) {
					currTile.type = TerrainType.SHALLOW_WATER;
					currTile.moisture = .95;
					currTile.fertility = .95;
				}
				for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
					const nx = currX + dx;
					const ny = currY + dy;
					if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
						const b = grid[nx][ny];
						if (b.type === TerrainType.SOIL || b.type === TerrainType.SAVANNA) {
							b.type = TerrainType.GRASS;
							b.moisture = Math.min(1, b.moisture + .3);
							b.fertility = Math.min(1, b.fertility + .35);
						}
					}
				}
				let lowestX = currX;
				let lowestY = currY;
				let lowestHeight = currTile.height;
				const dirs = [
					{
						x: 0,
						y: -1
					},
					{
						x: 0,
						y: 1
					},
					{
						x: -1,
						y: 0
					},
					{
						x: 1,
						y: 0
					},
					{
						x: 1,
						y: 1
					},
					{
						x: -1,
						y: -1
					},
					{
						x: 1,
						y: -1
					},
					{
						x: -1,
						y: 1
					}
				];
				for (const d of dirs) {
					const nx = currX + d.x;
					const ny = currY + d.y;
					if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
						const neighbor = grid[nx][ny];
						if (neighbor.height < lowestHeight) {
							lowestHeight = neighbor.height;
							lowestX = nx;
							lowestY = ny;
						}
					}
				}
				if (lowestX === currX && lowestY === currY) {
					const meander = rng.pick(dirs);
					currX = Math.max(1, Math.min(width - 2, currX + meander.x));
					currY = Math.max(1, Math.min(height - 2, currY + meander.y));
				} else {
					currX = lowestX;
					currY = lowestY;
				}
			}
		}
	}
	/** Smooths isolated 1x1 terrain pixels for cohesive biomes */
	static smoothBiomes(grid, width, height) {
		for (let x = 1; x < width - 1; x++) for (let y = 1; y < height - 1; y++) {
			const tile = grid[x][y];
			if (tile.type === TerrainType.SHALLOW_WATER || tile.type === TerrainType.SAND || tile.type === TerrainType.GRASS) {
				const neighbors = {};
				for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) continue;
					const nType = grid[x + dx][y + dy].type;
					neighbors[nType] = (neighbors[nType] ?? 0) + 1;
				}
				for (const [tType, count] of Object.entries(neighbors)) if (count >= 6 && tType !== tile.type && tType !== TerrainType.MOUNTAIN) {
					tile.type = tType;
					break;
				}
			}
		}
	}
};
//#endregion
//#region src/world/TileMap.ts
var TileMap = class {
	width;
	height;
	grid;
	seed;
	/** Saved deterministic ecology step so resource regrowth is reproducible across reloads. */
	ecologyStep = 0;
	constructor(width = 128, height = 128, preset = "single_continent", seed) {
		this.width = width;
		this.height = height;
		this.seed = seed ?? Math.floor(Math.random() * 2147483647);
		this.grid = WorldGenerator.generate(width, height, preset, this.seed);
	}
	getTile(x, y) {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
		return this.grid[Math.floor(x)][Math.floor(y)];
	}
	getNeighbors(x, y, includeDiagonal = false) {
		const neighbors = [];
		const dirs = includeDiagonal ? [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
			[-1, -1],
			[-1, 1],
			[1, -1],
			[1, 1]
		] : [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1]
		];
		for (const [dx, dy] of dirs) {
			const t = this.getTile(x + dx, y + dy);
			if (t) neighbors.push(t);
		}
		return neighbors;
	}
	/** Exhaustive resource survey around a point, nearest/richest first. */
	findResourceSites(centerX, centerY, radius, goods, includeOccupied = false) {
		const filter = goods ? goods instanceof Set ? goods : new Set(goods) : null;
		const found = [];
		const minX = Math.max(0, Math.floor(centerX - radius));
		const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
		const minY = Math.max(0, Math.floor(centerY - radius));
		const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));
		const rSq = radius * radius;
		for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy > rSq) continue;
			const tile = this.grid[x][y];
			if (!tile.resourceType || tile.resourceAmount <= 0) continue;
			if (filter && !filter.has(tile.resourceType)) continue;
			if (!includeOccupied && tile.buildingId) continue;
			found.push(tile);
		}
		found.sort((a, b) => {
			return Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY) || b.resourceAmount - a.resourceAmount;
		});
		return found;
	}
	/** Amount of each natural resource visible within a city's practical reach. */
	resourceSummary(centerX, centerY, radius) {
		const summary = {};
		for (const tile of this.findResourceSites(centerX, centerY, radius, void 0, true)) {
			if (!tile.resourceType) continue;
			summary[tile.resourceType] = (summary[tile.resourceType] ?? 0) + tile.resourceAmount;
		}
		return summary;
	}
	isCoastalLand(x, y) {
		const tile = this.getTile(x, y);
		if (!tile || TERRAINS[tile.type].isWater || !TERRAINS[tile.type].isWalkable) return false;
		return this.getNeighbors(x, y, true).some((n) => TERRAINS[n.type].isWater);
	}
	/** Modify terrain within brush radius */
	applyBrush(centerX, centerY, radius, action) {
		const minX = Math.max(0, Math.floor(centerX - radius));
		const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
		const minY = Math.max(0, Math.floor(centerY - radius));
		const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));
		const rSq = radius * radius;
		for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
			const dx = x - centerX;
			const dy = y - centerY;
			if (dx * dx + dy * dy <= rSq) action(this.grid[x][y]);
		}
	}
	/** Fire & Fluid propagation logic tick with balanced burnouts and firebreaks */
	updateFireTick() {
		let activeFires = 0;
		const fireQueue = [];
		for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
			const tile = this.grid[x][y];
			if (tile.isOnFire) {
				activeFires++;
				tile.fireTimer++;
				const neighbors = this.getNeighbors(x, y, false);
				for (const n of neighbors) {
					const config = TERRAINS[n.type];
					const moisturePenalty = 1 - Math.min(.8, n.moisture * .5);
					const spreadChance = config.flammability * .035 * moisturePenalty;
					if (!n.isOnFire && config.flammability > .05 && Math.random() < spreadChance) fireQueue.push(n);
				}
				if (tile.fireTimer >= 10) {
					tile.isOnFire = false;
					tile.fireTimer = 0;
					if (tile.type === TerrainType.FOREST || tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SWAMP || tile.type === TerrainType.CORRUPTED) {
						tile.type = TerrainType.SOIL;
						tile.resourceType = null;
						tile.resourceAmount = 0;
					}
				}
			}
		}
		for (const t of fireQueue) {
			t.isOnFire = true;
			t.fireTimer = 0;
		}
		return activeFires;
	}
	/**
	* Renewable resources creep back toward their original abundance, wild food sprouts on fertile land,
	* and cleared forest reclaims grassland. Mineral and petroleum deposits remain finite.
	* Called once per simulated year.
	*/
	regrowResources() {
		this.ecologyStep++;
		const rng = new RandomService(this.seed + this.ecologyStep * 104729 >>> 0);
		const sampleCount = Math.floor(this.width * this.height / 5);
		for (let i = 0; i < sampleCount; i++) {
			const x = rng.rangeInt(0, this.width - 1);
			const y = rng.rangeInt(0, this.height - 1);
			const tile = this.grid[x][y];
			if (tile.isOnFire) continue;
			if (isRenewableGood(tile.resourceType) && tile.resourceAmount < tile.resourceMax) {
				const good = tile.resourceType;
				const base = good === "food" ? 3.5 : good === "wood" || good === "rubber" ? 2.5 : good === "cotton" || good === "spices" ? 2 : 1.5;
				const moistureBonus = good === "food" || good === "wood" || good === "spices" ? tile.moisture * 2.5 : tile.moisture;
				tile.resourceAmount = Math.min(tile.resourceMax, tile.resourceAmount + base + moistureBonus);
				continue;
			}
			if ((tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && !tile.resourceType && !tile.buildingId && !tile.cityId && tile.moisture > .25) {
				if (rng.chance(.065 * tile.moisture * (.8 + tile.fertility))) {
					tile.resourceType = "food";
					tile.resourceMax = 50 + rng.rangeInt(0, 60);
					tile.resourceAmount = Math.floor(tile.resourceMax * .6);
					continue;
				}
			}
			if ((tile.type === TerrainType.GRASS || tile.type === TerrainType.SOIL) && !tile.buildingId && !tile.cityId && tile.moisture > .4) {
				const forestNeighbours = this.getNeighbors(x, y, true).filter((n) => n.type === TerrainType.FOREST).length;
				const chance = forestNeighbours > 0 ? .025 + forestNeighbours * .018 : .003 * tile.moisture;
				if (rng.chance(chance)) {
					tile.type = TerrainType.FOREST;
					tile.resourceType = "wood";
					tile.resourceMax = 65 + rng.rangeInt(0, 75);
					tile.resourceAmount = Math.floor(tile.resourceMax * .35);
				}
			}
		}
	}
	/** Liquid flow propagation tick (water flows into low elevation tiles) */
	updateFluidTick() {
		const convertQueue = [];
		for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
			const tile = this.grid[x][y];
			if (tile.type === TerrainType.SHALLOW_WATER || tile.type === TerrainType.DEEP_OCEAN) {
				const neighbors = this.getNeighbors(x, y, false);
				for (const n of neighbors) if (n.height < .25 && !n.type.includes("ocean") && n.type !== TerrainType.MOUNTAIN) convertQueue.push({
					tile: n,
					newType: TerrainType.SHALLOW_WATER
				});
			}
		}
		for (const item of convertQueue) item.tile.type = item.newType;
	}
	serialize() {
		const tilesData = [];
		for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
			const t = this.grid[x][y];
			tilesData.push({
				x: t.x,
				y: t.y,
				t: t.type,
				h: t.height,
				temp: t.temperature,
				m: t.moisture,
				r: t.resourceType,
				ra: t.resourceAmount,
				rm: t.resourceMax,
				b: t.buildingId,
				k: t.kingdomId,
				c: t.cityId,
				f: t.isOnFire,
				rl: t.roadLevel,
				rt: t.roadTraffic
			});
		}
		return {
			width: this.width,
			height: this.height,
			seed: this.seed,
			ecologyStep: this.ecologyStep,
			tiles: tilesData
		};
	}
	deserialize(data) {
		this.width = data.width;
		this.height = data.height;
		this.seed = data.seed;
		this.ecologyStep = data.ecologyStep ?? 0;
		this.grid = [];
		for (let x = 0; x < this.width; x++) this.grid[x] = [];
		for (const item of data.tiles) {
			const tile = new Tile(item.x, item.y, item.t, item.h);
			tile.temperature = item.temp;
			tile.moisture = item.m;
			tile.resourceType = item.r;
			tile.resourceAmount = item.ra;
			tile.resourceMax = item.rm ?? item.ra;
			tile.buildingId = item.b;
			tile.kingdomId = item.k;
			tile.cityId = item.c;
			tile.isOnFire = item.f;
			tile.roadLevel = item.rl ?? 0;
			tile.roadTraffic = item.rt ?? 0;
			this.grid[item.x][item.y] = tile;
		}
	}
};
//#endregion
//#region src/core/ObjectPool.ts
/**
* Generic Object Pool to prevent Garbage Collection allocations during simulation.
*/
var ObjectPool = class {
	freeList = [];
	factory;
	resetFn;
	constructor(factory, resetFn, initialCapacity = 100) {
		this.factory = factory;
		this.resetFn = resetFn;
		for (let i = 0; i < initialCapacity; i++) this.freeList.push(this.factory());
	}
	obtain() {
		if (this.freeList.length > 0) return this.freeList.pop();
		return this.factory();
	}
	release(obj) {
		this.resetFn(obj);
		this.freeList.push(obj);
	}
	releaseAll(objs) {
		for (const obj of objs) this.release(obj);
	}
};
//#endregion
//#region src/renderer/Particles.ts
var ParticleManager = class {
	pool;
	activeParticles = [];
	constructor() {
		this.pool = new ObjectPool(() => ({
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			color: "#fff",
			size: 2,
			alpha: 1,
			life: 0,
			maxLife: 1
		}), (p) => {
			p.text = void 0;
			p.alpha = 1;
		}, 300);
	}
	spawnParticle(x, y, color, vx = 0, vy = 0, maxLife = .5, size = 3) {
		if (this.activeParticles.length >= 250) {
			const old = this.activeParticles.shift();
			if (old) this.pool.release(old);
		}
		const p = this.pool.obtain();
		p.x = x;
		p.y = y;
		p.vx = vx;
		p.vy = vy;
		p.color = color;
		p.size = size;
		p.alpha = 1;
		p.life = 0;
		p.maxLife = maxLife;
		this.activeParticles.push(p);
	}
	spawnExplosion(x, y, color = "#ef4444", count = 20) {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = .5 + Math.random() * 2.5;
			this.spawnParticle(x, y, color, Math.cos(angle) * speed, Math.sin(angle) * speed, .3 + Math.random() * .5, 2 + Math.random() * 3);
		}
	}
	spawnDamageNumber(x, y, damage) {
		const p = this.pool.obtain();
		p.x = x;
		p.y = y;
		p.vx = (Math.random() - .5) * .2;
		p.vy = -.8;
		p.color = "#ef4444";
		p.size = 12;
		p.alpha = 1;
		p.life = 0;
		p.maxLife = .8;
		p.text = `-${damage}`;
		this.activeParticles.push(p);
	}
	update(dt) {
		for (let i = this.activeParticles.length - 1; i >= 0; i--) {
			const p = this.activeParticles[i];
			p.life += dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.alpha = Math.max(0, 1 - p.life / p.maxLife);
			if (p.life >= p.maxLife) {
				this.activeParticles.splice(i, 1);
				this.pool.release(p);
			}
		}
	}
};
//#endregion
//#region scratch/audit_systems.ts
/**
* Headless systems audit.
*
* Runs a real world for N simulated years and reports which subsystems actually
* came alive: deposits, extraction, crafting chains, trade, naval, caravans.
* Anything that stays at zero is a system that is wired up but never connects.
*/
var YEARS = Number(process.env.YEARS ?? 12);
var SIZE = Number(process.env.SIZE ?? 100);
var SEED = Number(process.env.SEED ?? 12345);
function pad(s, n) {
	return String(s).padEnd(n);
}
function num(n, d = 1) {
	return (Math.round(n * 10 ** d) / 10 ** d).toString();
}
console.log(`=== AETHORIA SYSTEMS AUDIT ===`);
console.log(`size=${SIZE} seed=${SEED} years=${YEARS} ticksPerYear=${TICKS_PER_YEAR}\n`);
var tileMap = new TileMap(SIZE, SIZE, "single_continent", SEED);
var depTiles = {};
var depAmount = {};
for (let x = 0; x < tileMap.width; x++) for (let y = 0; y < tileMap.height; y++) {
	const t = tileMap.getTile(x, y);
	if (!t?.resourceType) continue;
	depTiles[t.resourceType] = (depTiles[t.resourceType] ?? 0) + 1;
	depAmount[t.resourceType] = (depAmount[t.resourceType] ?? 0) + t.resourceAmount;
}
console.log("--- DEPOSITS ON MAP ---");
var missingDeposits = [];
for (const g of ALL_GOODS) {
	if (GOODS[g].kind !== "raw") continue;
	const n = depTiles[g] ?? 0;
	if (n === 0) missingDeposits.push(g);
	console.log(`  ${pad(g, 12)} tiles=${pad(n, 6)} amount=${num(depAmount[g] ?? 0, 0)}`);
}
if (missingDeposits.length) console.log(`  !! RAW GOODS WITH ZERO DEPOSITS: ${missingDeposits.join(", ")}`);
var sim = new SimulationEngine();
var particles = new ParticleManager();
var startSpecies = [
	SpeciesType.LUMINI,
	SpeciesType.SYLVANII,
	SpeciesType.STONEKIN,
	SpeciesType.EMBERKIN
];
var spots = [
	{
		x: SIZE * .25,
		y: SIZE * .25
	},
	{
		x: SIZE * .75,
		y: SIZE * .25
	},
	{
		x: SIZE * .25,
		y: SIZE * .75
	},
	{
		x: SIZE * .75,
		y: SIZE * .75
	}
];
startSpecies.forEach((sp, i) => {
	for (let k = 0; k < 6; k++) {
		const e = sim.spawnEntity(sp, spots[i].x + k % 3, spots[i].y + Math.floor(k / 3), tileMap, k % 2 === 0 ? "male" : "female");
		e.dynasty = `House${i}`;
	}
});
sim.totalBirths = 0;
function totalBuildings() {
	let n = 0;
	for (const c of sim.cities.values()) n += c.buildings.size;
	return n;
}
var totalTicks = YEARS * TICKS_PER_YEAR;
var t0 = Date.now();
var peakShips = 0;
var peakCaravans = 0;
var peakRoutes = 0;
var yearLog = [];
var firstBuiltYear = /* @__PURE__ */ new Map();
var firstGoodYear = /* @__PURE__ */ new Map();
var firstTechYear = /* @__PURE__ */ new Map();
for (let tick = 1; tick <= totalTicks; tick++) {
	sim.tickAI(tileMap, particles);
	if (tick % 7200 === 0) {
		for (const c of sim.cities.values()) {
			for (const b of c.buildings.values()) if (!firstBuiltYear.has(b.type)) firstBuiltYear.set(b.type, sim.currentYear);
			for (const g of ALL_GOODS) if (c.stock.get(g) > 0 && !firstGoodYear.has(g)) firstGoodYear.set(g, sim.currentYear);
		}
		for (const k of sim.kingdoms.values()) for (const t of k.research.known) if (!firstTechYear.has(t)) firstTechYear.set(t, sim.currentYear);
	}
	if (tick % 2 === 0) {
		tileMap.updateFireTick();
		tileMap.updateFluidTick();
	}
	if (tick % 10 === 0 && sim.kingdoms.size > 1) sim.diplomacy.tickDiplomacy([...sim.kingdoms.keys()], sim.currentYear);
	peakShips = Math.max(peakShips, sim.naval.activeShips.size);
	peakCaravans = Math.max(peakCaravans, sim.caravans.activeCaravans.size);
	peakRoutes = Math.max(peakRoutes, sim.trade.routes.size);
	if (tick % 7200 === 0) {
		let pop = 0;
		let prosp = 0;
		let food = 0;
		for (const c of sim.cities.values()) {
			pop += c.population;
			prosp += c.prosperity;
			food += c.stock.get("food");
		}
		const nCities = Math.max(1, sim.cities.size);
		const k0 = [...sim.kingdoms.values()][0];
		const curTech = k0?.research.current;
		const techInfo = curTech ? `${curTech} ${num(k0.research.progress, 0)}/${num(techCost(TECHNOLOGIES[curTech]), 0)}` : "(idle)";
		yearLog.push(`  y${pad(sim.currentYear, 4)} ents=${pad(sim.entities.length, 5)} cities=${pad(sim.cities.size, 4)} pop=${pad(pop, 5)} prosp=${pad(num(prosp / nCities, 2), 6)} food=${pad(num(food, 0), 7)} rsch/yr=${pad(num(k0?.research.output ?? 0, 2), 6)} tech=${pad(techInfo, 26)} bld=${pad(totalBuildings(), 4)} routes=${pad(sim.trade.routes.size, 3)} ships=${pad(sim.naval.activeShips.size, 3)} carv=${sim.caravans.activeCaravans.size}`);
	}
}
var elapsed = (Date.now() - t0) / 1e3;
console.log(`\n--- YEAR BY YEAR (${num(elapsed)}s wall, ${num(totalTicks / elapsed, 0)} ticks/s) ---`);
yearLog.forEach((l) => console.log(l));
console.log("\n--- BUILDINGS BUILT ---");
var buildCount = {};
for (const c of sim.cities.values()) for (const b of c.buildings.values()) buildCount[b.type] = (buildCount[b.type] ?? 0) + 1;
var neverBuilt = [];
for (const bt of ALL_BUILDING_TYPES) {
	const n = buildCount[bt] ?? 0;
	if (n === 0) neverBuilt.push(bt);
	else console.log(`  ${pad(bt, 18)} ${n}`);
}
console.log(`  NEVER BUILT (${neverBuilt.length}): ${neverBuilt.join(", ")}`);
console.log("\n--- GOODS IN CITY STOCKPILES ---");
var stock = {};
for (const c of sim.cities.values()) for (const g of ALL_GOODS) stock[g] = (stock[g] ?? 0) + c.stock.get(g);
var neverProduced = [];
for (const g of ALL_GOODS) {
	const n = stock[g] ?? 0;
	if (n <= 0) neverProduced.push(g);
	else console.log(`  ${pad(g, 12)} ${num(n)}`);
}
console.log(`  ZERO STOCK (${neverProduced.length}): ${neverProduced.join(", ")}`);
console.log(`  CRAFTED NEVER MADE: ${CRAFTED_GOODS.filter((g) => (stock[g] ?? 0) <= 0).join(", ") || "(none)"}`);
console.log("\n--- KINGDOMS ---");
for (const k of sim.kingdoms.values()) console.log(`  ${pad(k.name, 22)} cities=${pad(k.cityIds.size, 3)} pop=${pad(k.totalPopulation, 6)} techs=${pad(k.research.known.size, 4)} gold=${pad(num(k.treasury.get("gold"), 0), 8)} gov=${pad(k.government, 14)} wealth=${num(k.wealth, 0)}`);
console.log("\n--- TRADE / LOGISTICS ---");
console.log(`  trade routes now=${sim.trade.routes.size} peak=${peakRoutes}`);
console.log(`  ships now=${sim.naval.activeShips.size} peak=${peakShips}`);
console.log(`  caravans now=${sim.caravans.activeCaravans.size} peak=${peakCaravans}`);
var byKind = {};
for (const r of sim.trade.routes.values()) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
console.log(`  routes by kind: ${JSON.stringify(byKind)}`);
console.log("\n--- UNLOCK TIMELINE (first year seen) ---");
var techLine = [...firstTechYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  techs:     ${techLine.join(", ") || "(none)"}`);
var bldLine = [...firstBuiltYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  buildings: ${bldLine.join(", ") || "(none)"}`);
var goodLine = [...firstGoodYear.entries()].sort((a, b) => a[1] - b[1]).map(([t, y]) => `${t}@y${y}`);
console.log(`  goods:     ${goodLine.join(", ") || "(none)"}`);
console.log("\n--- TERRITORY & BORDERS ---");
{
	let claimed = 0;
	let land = 0;
	const byKingdom = /* @__PURE__ */ new Map();
	for (let x = 0; x < tileMap.width; x++) for (let y = 0; y < tileMap.height; y++) {
		const t = tileMap.getTile(x, y);
		if (!(t.type.includes("ocean") || t.type === "shallow_water")) land++;
		if (t.kingdomId) {
			claimed++;
			byKingdom.set(t.kingdomId, (byKingdom.get(t.kingdomId) ?? 0) + 1);
		}
	}
	let contacts = 0;
	const pairs = /* @__PURE__ */ new Set();
	for (let x = 0; x < tileMap.width; x++) for (let y = 0; y < tileMap.height; y++) {
		const t = tileMap.getTile(x, y);
		if (!t.kingdomId) continue;
		for (const [dx, dy] of [[1, 0], [0, 1]]) {
			const n = tileMap.getTile(x + dx, y + dy);
			if (!n?.kingdomId || n.kingdomId === t.kingdomId) continue;
			contacts++;
			pairs.add([t.kingdomId, n.kingdomId].sort().join("|"));
		}
	}
	console.log(`  land tiles=${land} claimed=${claimed} (${num(claimed / Math.max(1, land) * 100)}% of land)`);
	console.log(`  border contact tiles=${contacts} across ${pairs.size} realm pairs`);
	for (const c of sim.cities.values()) console.log(`  ${pad(c.name, 16)} tier=${pad(c.tier, 11)} pop=${pad(c.population, 4)} territory=${pad(c.territory.size, 5)} limit=${c.territoryLimit(8)}`);
}
console.log("\n--- LAYER 1: IDENTITY ---");
{
	const humans = sim.entities.filter((e) => SPECIES_DEFINITIONS[e.species].isHumanoid);
	const withHome = humans.filter((e) => e.homeBuildingId).length;
	const withOrigin = humans.filter((e) => e.birthCityId).length;
	const withHousehold = humans.filter((e) => e.householdId).length;
	const withJob = humans.filter((e) => e.workplaceId).length;
	const migrants = humans.filter((e) => e.birthCityId && e.cityId && e.birthCityId !== e.cityId).length;
	const wealth = humans.map((e) => e.wealth);
	const byClass = {};
	for (const e of humans) byClass[e.socialClass] = (byClass[e.socialClass] ?? 0) + 1;
	console.log(`  humanoids=${humans.length}`);
	console.log(`  with birthplace = ${withOrigin}/${humans.length}`);
	console.log(`  with real home  = ${withHome}/${humans.length}`);
	console.log(`  with household  = ${withHousehold}/${humans.length}`);
	console.log(`  with workplace  = ${withJob}/${humans.length}`);
	console.log(`  migrants        = ${migrants}`);
	console.log(`  wealth: min=${Math.min(...wealth, 0)} max=${Math.max(...wealth, 0)} avg=${num(wealth.reduce((a, b) => a + b, 0) / Math.max(1, wealth.length))}`);
	console.log(`  social classes: ${JSON.stringify(byClass)}`);
	const sample = humans.slice(0, 3);
	for (const s of sample) console.log(`  · ${s.fullName}, ${s.age}a, ${s.profession}, ${s.socialClass}, nasceu em "${s.birthCityName || "—"}" y${s.birthYear}, casa=${s.homeBuildingId ? "sim" : "nao"}, moedas=${Math.round(s.wealth)}`);
}
console.log("\n--- POPULATION ---");
console.log(`  entities=${sim.entities.length} births=${sim.totalBirths} deaths=${sim.totalDeaths} year=${sim.currentYear}`);
//#endregion
export {};
