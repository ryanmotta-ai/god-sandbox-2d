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
//#region src/world/Tile.ts
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
new RandomService();
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
var ALL_GOODS = Object.keys(GOODS);
ALL_GOODS.filter((id) => GOODS[id].kind === "raw");
ALL_GOODS.filter((id) => GOODS[id].kind === "crafted");
ALL_GOODS.filter((id) => GOODS[id].strategic);
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
//#region scratch/audit_terrain.ts
/** Terrain + deposit distribution across several presets and seeds. */
var PRESETS = [
	"single_continent",
	"archipelago",
	"two_continents",
	"ring_atoll",
	"frozen",
	"desert"
];
var SEEDS = [
	12345,
	777,
	2024,
	99
];
var SIZE = 100;
for (const preset of PRESETS) {
	const terrainAgg = {};
	const depositAgg = {};
	let heightBuckets = {
		lt61: 0,
		gte61: 0,
		gte70: 0,
		gte78: 0
	};
	for (const seed of SEEDS) {
		let map;
		try {
			map = new TileMap(SIZE, SIZE, preset, seed);
		} catch (e) {
			console.log(`preset ${preset} failed: ${e.message}`);
			break;
		}
		for (let x = 0; x < map.width; x++) for (let y = 0; y < map.height; y++) {
			const t = map.getTile(x, y);
			terrainAgg[t.type] = (terrainAgg[t.type] ?? 0) + 1;
			if (t.resourceType) depositAgg[t.resourceType] = (depositAgg[t.resourceType] ?? 0) + 1;
			if (t.height >= .78) heightBuckets.gte78++;
			else if (t.height >= .7) heightBuckets.gte70++;
			else if (t.height >= .61) heightBuckets.gte61++;
			else heightBuckets.lt61++;
		}
	}
	const total = 1e4 * SEEDS.length;
	console.log(`\n=== PRESET: ${preset} (${SEEDS.length} seeds, ${total} tiles) ===`);
	console.log("  terrain:");
	Object.entries(terrainAgg).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k.padEnd(16)} ${String(v).padStart(7)}  ${(v / total * 100).toFixed(2)}%`));
	console.log(`  height: <0.61=${heightBuckets.lt61} 0.61-0.70=${heightBuckets.gte61} 0.70-0.78=${heightBuckets.gte70} >=0.78=${heightBuckets.gte78}`);
	console.log(`  MOUNTAIN tiles = ${terrainAgg[TerrainType.MOUNTAIN] ?? 0}`);
	console.log("  deposits:");
	const missing = [];
	for (const g of [
		"food",
		"wood",
		"stone",
		"clay",
		"copper",
		"tin",
		"iron",
		"coal",
		"salt",
		"gold",
		"gems",
		"horses",
		"cotton",
		"spices",
		"furs",
		"oil",
		"saltpeter",
		"rubber",
		"uranium"
	]) {
		const n = depositAgg[g] ?? 0;
		if (n === 0) missing.push(g);
		console.log(`    ${g.padEnd(12)} ${n}`);
	}
	console.log(`  ZERO: ${missing.join(", ") || "(none)"}`);
}
//#endregion
export {};
