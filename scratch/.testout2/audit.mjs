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
	roadDamage = 0;
	railLevel = 0;
	railDamage = 0;
	railOwnerId = null;
	/** Renderer cache: static terrain surface color, validated against the fields that produce it. */
	renderSurface = null;
	renderSurfaceType = TerrainType.DEEP_OCEAN;
	renderSurfaceHeight = 0;
	renderSurfaceMoisture = 0;
	renderSurfaceTemp = 0;
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
	/**
	* Road level after war damage is applied. A damaged road travels and renders
	* as one step rougher; heavy damage ruins it entirely.
	*/
	get roadLevelEffective() {
		return Math.max(0, Math.floor(this.roadLevel * (1 - this.roadDamage)));
	}
	/**
	* Railway level after war damage. A rail takes scratches without breaking;
	* only heavy damage (past 75%) severs the line entirely. Below that the
	* segment stays usable but drags down the line's capacity via `railHealth`.
	*/
	get railLevelEffective() {
		return this.railDamage >= .75 ? 0 : this.railLevel;
	}
	/** 0..1 — live condition of a rail segment, used for line capacity. */
	get railHealth() {
		return Math.max(0, 1 - this.railDamage);
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
var rng = new RandomService();
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
var FACIES_IDS = [
	"igneous",
	"sedimentary",
	"metamorphic",
	"alluvial"
];
/**
* Coarse 3×3 grid of geological provinces carved from two low-frequency noises.
* Each province is a large, wavy-bordered region with one deterministic facies.
*/
function buildFaciesGrid(width, height, seed) {
	const grid = new Uint8Array(width * height);
	const noiseA = new SimplexNoise(new RandomService(seed + 7100));
	const noiseB = new SimplexNoise(new RandomService(seed + 7200));
	const provinceRng = new RandomService((seed ^ 1370177325) >>> 0);
	const provinceFacies = [];
	for (let p = 0; p < 9; p++) provinceFacies.push(FACIES_IDS.indexOf(provinceRng.pick(FACIES_IDS)));
	for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
		const bandA = Math.min(2, Math.floor(noiseA.octave2D(x, y, 3, .5, .02) * 3));
		const bandB = Math.min(2, Math.floor(noiseB.octave2D(x, y, 3, .5, .02) * 3));
		grid[x * height + y] = provinceFacies[bandA * 3 + bandB];
	}
	return grid;
}
function placeClusteredResource(grid, width, height, rng, spec, faciesGrid) {
	const collect = (pred, facies) => {
		const list = [];
		const allowed = facies ? new Set(facies.map((f) => FACIES_IDS.indexOf(f))) : null;
		for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
			if (!pred(grid[x][y], x, y, grid)) continue;
			if (allowed && !allowed.has(faciesGrid[x * height + y])) continue;
			list.push({
				x,
				y
			});
		}
		return list;
	};
	let eligible = collect(spec.predicate, spec.facies);
	let match = spec.predicate;
	for (const fb of spec.fallbacks ?? []) {
		if (eligible.length > 0) break;
		eligible = collect(fb);
		match = fb;
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
		const angle = rng.range(0, Math.PI);
		const elongation = rng.range(.4, .9);
		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);
		const rx = r;
		const ry = Math.max(1, r * elongation);
		const invX = 1 / (rx + .75);
		const invY = 1 / (ry + .75);
		for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
			const x = center.x + dx;
			const y = center.y + dy;
			if (x < 0 || y < 0 || x >= width || y >= height) continue;
			const tile = grid[x][y];
			if (!match(tile, x, y, grid)) continue;
			const u = dx * cosA + dy * sinA;
			const v = -dx * sinA + dy * cosA;
			const eDist = Math.hypot(u * invX, v * invY);
			if (eDist > 1.15) continue;
			const centerBias = Math.max(0, 1 - eDist);
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
	const faciesGrid = buildFaciesGrid(width, height, seed);
	for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
		const tile = grid[x][y];
		if (!isLand(tile)) continue;
		const dampWoodland = tile.moisture >= .52 && tile.fertility >= .5;
		if (tile.type === TerrainType.FOREST) {
			if (rng.chance(.85)) {
				const max = rng.range(80, 170) * (.75 + tile.moisture * .5);
				setResource(tile, "wood", max * rng.range(.72, 1), max);
			} else if (rng.chance(.25)) {
				const max = rng.range(50, 120) * (.8 + tile.fertility * .5);
				setResource(tile, "food", max * rng.range(.6, .95), max);
			}
		} else if (dampWoodland && rng.chance(.5)) {
			const max = rng.range(50, 130) * (.8 + tile.fertility * .5);
			setResource(tile, "wood", max * rng.range(.65, 1), max);
		} else if (rng.chance(.08)) {
			const max = rng.range(30, 75);
			setResource(tile, "wood", max * rng.range(.6, .95), max);
		}
		if ((tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && rng.chance(.35 + tile.moisture * .25)) {
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
		} else if (tile.height > .66 && rng.chance(.16)) {
			const max = rng.range(45, 100);
			setResource(tile, "stone", max * rng.range(.7, 1), max);
		} else if (coastalLand(grid, width, height, x, y) && rng.chance(.2)) {
			const max = rng.range(40, 95);
			setResource(tile, "clay", max * rng.range(.7, 1), max);
		}
	}
	const highland = (tile) => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS && tile.height > .61;
	const rockyDry = (tile) => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SAND || (tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.moisture < .42;
	const warmField = (tile) => (tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && tile.temperature >= 14;
	const tropical = (tile) => (tile.type === TerrainType.GRASS || tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP) && tile.temperature >= 22 && tile.moisture >= .55;
	const coldLand = (tile) => tile.type === TerrainType.TUNDRA || tile.type === TerrainType.SNOW || tile.type === TerrainType.GRASS && tile.temperature < 2;
	const coastalLow = (tile, x, y, g) => !isWater(tile.type) && coastalLand(g, width, height, x, y) && tile.height < .72;
	const swampy = (tile) => tile.type === TerrainType.SWAMP || tile.type === TerrainType.GRASS && tile.moisture >= .58 && tile.fertility >= .5;
	const regional = [
		{
			good: "copper",
			clusters: countForArea(width, height, 11, 4),
			radius: 2,
			minAmount: 55,
			maxAmount: 120,
			density: .72,
			predicate: highland,
			facies: ["igneous"],
			fallbacks: [highland]
		},
		{
			good: "iron",
			clusters: countForArea(width, height, 13, 5),
			radius: 2,
			minAmount: 75,
			maxAmount: 155,
			density: .78,
			predicate: highland,
			facies: ["igneous", "metamorphic"],
			fallbacks: [highland]
		},
		{
			good: "coal",
			clusters: countForArea(width, height, 9, 3),
			radius: 3,
			minAmount: 85,
			maxAmount: 180,
			density: .68,
			predicate: (tile) => highland(tile, 0, 0, grid) || swampy(tile, 0, 0, grid),
			facies: ["sedimentary"],
			fallbacks: [(tile) => highland(tile, 0, 0, grid) || swampy(tile, 0, 0, grid)]
		},
		{
			good: "salt",
			clusters: countForArea(width, height, 7, 3),
			radius: 2,
			minAmount: 60,
			maxAmount: 135,
			density: .62,
			predicate: coastalLow,
			facies: ["sedimentary", "alluvial"],
			fallbacks: [coastalLow]
		},
		{
			good: "gold",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 30,
			maxAmount: 75,
			density: .5,
			predicate: highland,
			facies: ["igneous", "metamorphic"],
			fallbacks: [highland]
		},
		{
			good: "gems",
			clusters: countForArea(width, height, 4, 2),
			radius: 1,
			minAmount: 24,
			maxAmount: 58,
			density: .6,
			predicate: (tile) => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.height > .7,
			facies: ["igneous", "metamorphic"],
			fallbacks: [(tile) => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.GRASS) && tile.height > .6]
		},
		{
			good: "horses",
			clusters: countForArea(width, height, 8, 3),
			radius: 3,
			minAmount: 45,
			maxAmount: 100,
			density: .5,
			predicate: (tile) => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA,
			fallbacks: [(tile) => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL]
		},
		{
			good: "cotton",
			clusters: countForArea(width, height, 9, 3),
			radius: 3,
			minAmount: 55,
			maxAmount: 115,
			density: .58,
			predicate: warmField,
			fallbacks: [warmField]
		},
		{
			good: "spices",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 35,
			maxAmount: 85,
			density: .5,
			predicate: tropical,
			fallbacks: [tropical]
		},
		{
			good: "furs",
			clusters: countForArea(width, height, 6, 2),
			radius: 3,
			minAmount: 40,
			maxAmount: 90,
			density: .5,
			predicate: coldLand,
			fallbacks: [(tile) => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.TUNDRA || tile.type === TerrainType.GRASS && tile.temperature < 5]
		}
	];
	for (const spec of regional) placeClusteredResource(grid, width, height, rng, spec, faciesGrid);
	const strategic = [
		{
			good: "tin",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 45,
			maxAmount: 100,
			density: .56,
			predicate: highland,
			facies: ["igneous", "metamorphic"],
			fallbacks: [(tile) => tile.type === TerrainType.MOUNTAIN || tile.height > .55]
		},
		{
			good: "oil",
			clusters: countForArea(width, height, 4, 2),
			radius: 3,
			minAmount: 140,
			maxAmount: 310,
			density: .7,
			predicate: (tile) => !isWater(tile.type) && tile.height < .72 && tile.moisture < .65,
			facies: ["sedimentary", "alluvial"],
			fallbacks: [(tile) => !isWater(tile.type) && tile.height < .72]
		},
		{
			good: "saltpeter",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 55,
			maxAmount: 120,
			density: .55,
			predicate: rockyDry,
			facies: ["sedimentary", "alluvial"],
			fallbacks: [rockyDry]
		},
		{
			good: "rubber",
			clusters: countForArea(width, height, 5, 2),
			radius: 3,
			minAmount: 70,
			maxAmount: 150,
			density: .58,
			predicate: tropical,
			fallbacks: [tropical]
		},
		{
			good: "uranium",
			clusters: countForArea(width, height, 2, 1),
			radius: 2,
			minAmount: 45,
			maxAmount: 95,
			density: .48,
			predicate: (tile) => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.SOIL || tile.type === TerrainType.GRASS) && tile.height > .78,
			facies: ["igneous"],
			fallbacks: [(tile) => (tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.GRASS) && tile.height > .6]
		}
	];
	for (const spec of strategic) placeClusteredResource(grid, width, height, rng, spec, faciesGrid);
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
//#region src/world/WorldGenerator.ts
var WorldGenerator = class {
	static generate(width, height, presetInput = "single_continent", seed) {
		const actualSeed = seed ?? Math.floor(Math.random() * 2147483647);
		const rng = new RandomService(actualSeed);
		const noiseHeight = new SimplexNoise(rng);
		const noiseRidge = new SimplexNoise(new RandomService(actualSeed + 500));
		const noiseMoisture = new SimplexNoise(new RandomService(actualSeed + 1e3));
		const noiseTemp = new SimplexNoise(new RandomService(actualSeed + 2e3));
		const noiseMagic = new SimplexNoise(new RandomService(actualSeed + 3e3));
		const noiseWarp = new SimplexNoise(new RandomService(actualSeed + 4e3));
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
				} else if (preset === "desert" || preset === "frozen") {
					const islandMask = Math.max(0, 1 - dist / maxRadius);
					nH = nH * .55 + islandMask * .5;
				} else if (preset === "ring_atoll") {
					const ringDist = Math.abs(dist - maxRadius * .65);
					const ringMask = Math.max(0, 1 - ringDist / (maxRadius * .35));
					nH = nH * .4 + ringMask * .6;
				} else if (preset === "fragmented") {
					const warp = (noiseWarp.octave2D(x, y, 3, .5, .018) - .5) * 2;
					if (warp > .15) nH = nH * .45 + (warp - .15) * .55;
					else nH *= .6;
				}
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
				else type = TerrainType.GRASS;
				const tile = new Tile(x, y, type, nH);
				tile.temperature = Math.round(tempC);
				tile.moisture = Math.min(1, Math.max(0, nM));
				const biomeBase = type === TerrainType.GRASS ? .88 : .04;
				const moistureFit = 1 - Math.min(.65, Math.abs(tile.moisture - .55) * .9);
				tile.fertility = Math.max(.02, Math.min(1, biomeBase * moistureFit));
				grid[x][y] = tile;
			}
		}
		this.carveRivers(grid, width, height, rng);
		this.smoothBiomes(grid, width, height);
		this.carveMagicRegions(grid, width, height, rng, noiseMagic);
		generateDeposits(grid, width, height, actualSeed);
		return grid;
	}
	/**
	* Scatters a small number of cohesive arcane / corrupted regions. Rather than
	* the previous per-tile 1.5% salt-and-pepper, magic now appears as a few distinct
	* irradiated landscapes, each a contiguous patch — visually readable and
	* tactically meaningful.
	*/
	static carveMagicRegions(grid, width, height, rng, noiseMagic) {
		const regionCount = Math.max(2, Math.min(6, Math.round(width * height / 4096)));
		const isArcane = [];
		for (let i = 0; i < regionCount; i++) isArcane.push(rng.chance(.5));
		const landTiles = [];
		for (let x = 2; x < width - 2; x++) for (let y = 2; y < height - 2; y++) {
			const t = grid[x][y];
			if (!this.isWaterType(t.type) && t.type !== TerrainType.MOUNTAIN && t.type !== TerrainType.LAVA) landTiles.push({
				x,
				y
			});
		}
		if (landTiles.length === 0) return;
		const usedCenters = [];
		for (let i = 0; i < regionCount; i++) {
			let center = rng.pick(landTiles);
			for (let attempt = 0; attempt < 60; attempt++) {
				const candidate = rng.pick(landTiles);
				if (usedCenters.every((c) => Math.hypot(c.x - candidate.x, c.y - candidate.y) >= 24)) {
					center = candidate;
					break;
				}
			}
			usedCenters.push(center);
			const radius = rng.rangeInt(4, 7);
			for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
				const x = center.x + dx;
				const y = center.y + dy;
				if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
				const dist = Math.hypot(dx, dy);
				if (dist > radius) continue;
				const tile = grid[x][y];
				if (this.isWaterType(tile.type) || tile.type === TerrainType.MOUNTAIN) continue;
				const fall = 1 - dist / (radius + .5);
				const m = noiseMagic.octave2D(x, y, 3, .5, .05);
				const chance = Math.min(.95, .62 + fall * .3 + m * .15);
				if (!rng.chance(chance)) continue;
				tile.type = isArcane[i] ? TerrainType.ARCANE : TerrainType.CORRUPTED;
			}
		}
	}
	static isWaterType(type) {
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
		const DIRS = [
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
		for (const source of selectedSources) {
			let currX = source.x;
			let currY = source.y;
			let steps = 0;
			let lakeBudget = 6;
			while (steps < width * 2 + height * 2) {
				steps++;
				const currTile = grid[currX][currY];
				if (this.isWaterType(currTile.type)) break;
				if (currTile.type !== TerrainType.MOUNTAIN) {
					currTile.type = TerrainType.SHALLOW_WATER;
					currTile.moisture = .95;
					currTile.fertility = .95;
				}
				this.fertiliseBanks(grid, currX, currY, width, height);
				let lowestX = currX;
				let lowestY = currY;
				let lowestHeight = currTile.height;
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
					if (neighbor.height >= currTile.height && neighbor.height < lowestRidgeHeight) {
						lowestRidgeHeight = neighbor.height;
						lowestRidgeX = nx;
						lowestRidgeY = ny;
					}
				}
				if (lowestX === currX && lowestY === currY) {
					if (lakeBudget <= 0) break;
					lakeBudget--;
					if (lowestRidgeX >= 0) {
						const rim = grid[lowestRidgeX][lowestRidgeY];
						rim.height = currTile.height - .001;
						if (rim.type !== TerrainType.MOUNTAIN) {
							rim.type = TerrainType.SHALLOW_WATER;
							rim.moisture = .95;
						}
						currX = lowestRidgeX;
						currY = lowestRidgeY;
					} else break;
				} else {
					currX = lowestX;
					currY = lowestY;
				}
			}
		}
	}
	/** Promote banks around a river cell to fertile grass (any land type). */
	static fertiliseBanks(grid, cx, cy, width, height) {
		for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
			const nx = cx + dx;
			const ny = cy + dy;
			if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
			const b = grid[nx][ny];
			if (b.type === TerrainType.SOIL || b.type === TerrainType.SAVANNA || b.type === TerrainType.GRASS || b.type === TerrainType.SWAMP) {
				if (b.type !== TerrainType.SWAMP) b.type = TerrainType.GRASS;
				b.moisture = Math.min(1, b.moisture + .3);
				b.fertility = Math.min(1, b.fertility + .35);
			}
		}
	}
	/** Smooths isolated 1x1 terrain pixels for cohesive biomes across all terrestrial biomes. */
	static smoothBiomes(grid, width, height) {
		for (let x = 1; x < width - 1; x++) for (let y = 1; y < height - 1; y++) {
			const tile = grid[x][y];
			if (tile.type === TerrainType.DEEP_OCEAN || tile.type === TerrainType.MOUNTAIN) continue;
			let landNeighbors = 0;
			const counts = {};
			for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
				if (dx === 0 && dy === 0) continue;
				const nType = grid[x + dx][y + dy].type;
				counts[nType] = (counts[nType] ?? 0) + 1;
				if (nType !== TerrainType.DEEP_OCEAN && nType !== TerrainType.SHALLOW_WATER) landNeighbors++;
			}
			let dominant = null;
			let dominantCount = 0;
			for (const [t, c] of Object.entries(counts)) {
				if (t === tile.type) continue;
				if (c > dominantCount) {
					dominantCount = c;
					dominant = t;
				}
			}
			if (dominant && dominantCount >= 6 && dominant !== TerrainType.MOUNTAIN) {
				if (tile.type === TerrainType.SHALLOW_WATER && dominant === TerrainType.SHALLOW_WATER) continue;
				tile.type = dominant;
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
	/** Tiles whose static terrain bake must be redrawn, keyed by x*height+y. */
	dirtyTiles = /* @__PURE__ */ new Set();
	constructor(width = 128, height = 128, preset = "single_continent", seed) {
		this.width = width;
		this.height = height;
		this.seed = seed ?? Math.floor(Math.random() * 2147483647);
		this.grid = WorldGenerator.generate(width, height, preset, this.seed);
		this.markAllDirty();
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
	/** Mark a tile and its 4-neighbours as needing a static-bake redraw (relief/edges depend on neighbours). */
	markRenderDirty(x, y) {
		const h = this.height;
		this.dirtyTiles.add(x * h + y);
		if (x > 0) this.dirtyTiles.add((x - 1) * h + y);
		if (x < this.width - 1) this.dirtyTiles.add((x + 1) * h + y);
		if (y > 0) this.dirtyTiles.add(x * h + (y - 1));
		if (y < this.height - 1) this.dirtyTiles.add(x * h + (y + 1));
	}
	/** Mark every tile dirty (used on world creation / load / resize). */
	markAllDirty() {
		const h = this.height;
		for (let x = 0; x < this.width; x++) for (let y = 0; y < h; y++) this.dirtyTiles.add(x * h + y);
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
			if (dx * dx + dy * dy <= rSq) {
				const t = this.grid[x][y];
				action(t);
				this.markRenderDirty(x, y);
			}
		}
	}
	/** Fire & Fluid propagation logic tick with balanced burnouts and firebreaks */
	updateFireTick() {
		let activeFires = 0;
		const g = this.grid;
		const w = this.width;
		const h = this.height;
		const fireQueue = [];
		for (let x = 0; x < w; x++) {
			const col = g[x];
			for (let y = 0; y < h; y++) {
				const tile = col[y];
				if (tile.isOnFire) {
					activeFires++;
					tile.fireTimer++;
					if (x > 0) {
						const n = g[x - 1][y];
						const config = TERRAINS[n.type];
						const moisturePenalty = 1 - Math.min(.8, n.moisture * .5);
						if (!n.isOnFire && config.flammability > .05 && Math.random() < config.flammability * .035 * moisturePenalty) fireQueue.push(n);
					}
					if (x < w - 1) {
						const n = g[x + 1][y];
						const config = TERRAINS[n.type];
						const moisturePenalty = 1 - Math.min(.8, n.moisture * .5);
						if (!n.isOnFire && config.flammability > .05 && Math.random() < config.flammability * .035 * moisturePenalty) fireQueue.push(n);
					}
					if (y > 0) {
						const n = col[y - 1];
						const config = TERRAINS[n.type];
						const moisturePenalty = 1 - Math.min(.8, n.moisture * .5);
						if (!n.isOnFire && config.flammability > .05 && Math.random() < config.flammability * .035 * moisturePenalty) fireQueue.push(n);
					}
					if (y < h - 1) {
						const n = col[y + 1];
						const config = TERRAINS[n.type];
						const moisturePenalty = 1 - Math.min(.8, n.moisture * .5);
						if (!n.isOnFire && config.flammability > .05 && Math.random() < config.flammability * .035 * moisturePenalty) fireQueue.push(n);
					}
					if (tile.fireTimer >= 10) {
						tile.isOnFire = false;
						tile.fireTimer = 0;
						if (tile.type === TerrainType.FOREST || tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SWAMP || tile.type === TerrainType.CORRUPTED) {
							tile.type = TerrainType.SOIL;
							tile.resourceType = null;
							tile.resourceAmount = 0;
							this.markRenderDirty(x, y);
						}
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
					this.markRenderDirty(x, y);
				}
			}
		}
	}
	/** Liquid flow propagation tick (water flows into low elevation tiles) */
	updateFluidTick() {
		const g = this.grid;
		const w = this.width;
		const h = this.height;
		const convertQueue = [];
		for (let x = 0; x < w; x++) {
			const col = g[x];
			for (let y = 0; y < h; y++) {
				const type = col[y].type;
				if (type !== TerrainType.SHALLOW_WATER && type !== TerrainType.DEEP_OCEAN) continue;
				if (x > 0) {
					const n = g[x - 1][y];
					if (n.height < .25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
				}
				if (x < w - 1) {
					const n = g[x + 1][y];
					if (n.height < .25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
				}
				if (y > 0) {
					const n = col[y - 1];
					if (n.height < .25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
				}
				if (y < h - 1) {
					const n = col[y + 1];
					if (n.height < .25 && n.type !== TerrainType.DEEP_OCEAN && n.type !== TerrainType.MOUNTAIN) convertQueue.push(n);
				}
			}
		}
		for (const tile of convertQueue) {
			tile.type = TerrainType.SHALLOW_WATER;
			this.markRenderDirty(tile.x, tile.y);
		}
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
				rt: t.roadTraffic,
				rd: t.roadDamage,
				rail: t.railLevel,
				raild: t.railDamage,
				railo: t.railOwnerId
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
			tile.roadDamage = item.rd ?? 0;
			tile.railLevel = item.rail ?? 0;
			tile.railDamage = item.raild ?? 0;
			tile.railOwnerId = item.railo ?? null;
			this.grid[item.x][item.y] = tile;
		}
		this.dirtyTiles.clear();
		this.markAllDirty();
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
		cost: { wood: 20 },
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
Object.keys(BUILDINGS);
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
SpeciesType.LUMINI, SpeciesType.SYLVANII, SpeciesType.STONEKIN, SpeciesType.EMBERKIN, SpeciesType.DEER, SpeciesType.WOLF, SpeciesType.BEAR, SpeciesType.DRAGON, SpeciesType.BOAR, SpeciesType.EAGLE, SpeciesType.MAMMOTH;
function emptyFlow() {
	return {
		produced: 0,
		consumed: 0,
		imported: 0,
		exported: 0
	};
}
/**
* Where every unit of every good came from and went, per settlement, per year.
*
* Without this the economy can only report a stock number, which answers "how
* much is left" but never "why". Production, consumption and trade all write
* here, so a shortage can be traced to its cause instead of guessed at.
*/
var CityLedger = class {
	current = /* @__PURE__ */ new Map();
	previous = /* @__PURE__ */ new Map();
	entry(good) {
		let flow = this.current.get(good);
		if (!flow) {
			flow = emptyFlow();
			this.current.set(good, flow);
		}
		return flow;
	}
	recordProduced(good, amount) {
		if (amount > 0) this.entry(good).produced += amount;
	}
	recordConsumed(good, amount) {
		if (amount > 0) this.entry(good).consumed += amount;
	}
	recordImported(good, amount) {
		if (amount > 0) this.entry(good).imported += amount;
	}
	recordExported(good, amount) {
		if (amount > 0) this.entry(good).exported += amount;
	}
	/** Last completed year's flow. The in-progress year is not yet meaningful. */
	flow(good) {
		return this.previous.get(good) ?? emptyFlow();
	}
	/** produced + imported − consumed − exported. Negative means the stock is draining. */
	net(good) {
		const f = this.flow(good);
		return f.produced + f.imported - f.consumed - f.exported;
	}
	goods() {
		return [...this.previous.keys()];
	}
	/**
	* Share of what was used here that had to come from abroad, 0..1.
	*
	* This is the number that decides whether a war, an embargo or a blockade is a
	* nuisance or a catastrophe: a realm importing 86% of its oil does not have an
	* oil industry, it has a supplier.
	*/
	importDependency(good) {
		const f = this.flow(good);
		const used = f.consumed + f.exported;
		if (used <= 0) return 0;
		return Math.max(0, Math.min(1, f.imported / used));
	}
	/** Closes the year: this year's flows become the readable record. */
	rollOver() {
		this.previous = this.current;
		this.current = /* @__PURE__ */ new Map();
	}
	serialize() {
		const out = {};
		for (const [good, flow] of this.previous) out[good] = flow;
		return out;
	}
	deserialize(data) {
		this.previous = /* @__PURE__ */ new Map();
		this.current = /* @__PURE__ */ new Map();
		if (!data) return;
		for (const [good, flow] of Object.entries(data)) this.previous.set(good, {
			...emptyFlow(),
			...flow
		});
	}
};
/** How far a local price may drift from the world reference, either way. */
var LOCAL_PRICE_FLOOR = .35;
var LOCAL_PRICE_CEILING = 3.5;
/**
* One realm's own prices.
*
* The world market is the reference every realm trades against, but a realm sat
* on a coal seam does not pay the world price for coal, and a realm with none
* pays far more. Without that divergence there is no such thing as buying low
* and selling high, so no economic reason for a trade route to exist.
*
* Local prices are anchored to the world price and pulled away from it by local
* scarcity, so they can diverge sharply but never run off on their own.
*/
var LocalMarket = class {
	prices = /* @__PURE__ */ new Map();
	/** This realm's price, falling back to the world price where it has no history. */
	price(good, worldPrice) {
		return this.prices.get(good) ?? worldPrice;
	}
	hasPrice(good) {
		return this.prices.has(good);
	}
	/**
	* Re-prices one good against what the realm actually holds and uses.
	* `available` is stock plus what was produced; `wanted` is what was consumed.
	*/
	settle(good, worldPrice, available, wanted) {
		const ratio = (wanted + 1) / (available + 1);
		const target = worldPrice * Math.max(LOCAL_PRICE_FLOOR, Math.min(LOCAL_PRICE_CEILING, Math.pow(ratio, .6)));
		const current = this.prices.get(good) ?? worldPrice;
		const next = current + (target - current) * .3;
		this.prices.set(good, Math.max(worldPrice * LOCAL_PRICE_FLOOR, Math.min(worldPrice * LOCAL_PRICE_CEILING, next)));
	}
	serialize() {
		const out = {};
		for (const [good, price] of this.prices) out[good] = Math.round(price * 100) / 100;
		return out;
	}
	deserialize(data) {
		this.prices.clear();
		if (!data) return;
		for (const [good, price] of Object.entries(data)) this.prices.set(good, price);
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
	/** What goods actually cost inside this realm. Diverges from the world price. */
	market = new LocalMarket();
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
			ledger: this.ledger,
			prices: this.market.serialize()
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
		this.market.deserialize(data.prices);
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
	/** Where every good came from and went last year. Written by production, consumption and trade. */
	ledger = new CityLedger();
	/**
	* Food households already bought out of the store this year.
	*
	* Families shop daily while the settlement settles its books yearly. Both draw
	* on the same stockpile, so the yearly pass must subtract what the families
	* already took or the population eats twice.
	*/
	householdFoodDrawn = 0;
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
	/** Job slots this settlement offers, counting building levels. */
	jobCount() {
		let jobs = 0;
		for (const b of this.buildings.values()) jobs += (b.definition.jobs ?? 0) * b.level;
		return jobs;
	}
	/** Job slots currently filled by a real, living worker. */
	filledJobs() {
		let filled = 0;
		for (const b of this.buildings.values()) filled += b.assignedWorkerIds.size;
		return filled;
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
			ledger: this.ledger.serialize(),
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
		city.ledger.deserialize(data.ledger);
		return city;
	}
};
//#endregion
//#region src/civ/Infrastructure.ts
/** Continuous effective road grade along a surveyed path (0..3). */
function avgEffectiveRoadLevel(path, tileMap) {
	if (!path || path.length === 0) return 0;
	let sum = 0;
	let count = 0;
	for (const step of path) {
		const tile = tileMap.getTile(Math.floor(step.x), Math.floor(step.y));
		if (!tile) continue;
		sum += tile.roadLevel * (1 - tile.roadDamage);
		count++;
	}
	return count > 0 ? sum / count : 0;
}
/**
* Throughput factor of an overland route from its road condition.
* A dirt trail carries 0.7×, a stone road 1.0×, an imperial highway 1.3×.
* A ruined road collapses toward 0.4×. Routes without a surveyed path
* (pre-infrastructure saves) run at their nominal capacity.
*/
function roadCapacityFactor(path, tileMap) {
	if (!path || path.length === 0) return 1;
	const avg = avgEffectiveRoadLevel(path, tileMap);
	return Math.max(.4, Math.min(1.3, .4 + .3 * avg));
}
/** Cargo a port can move per year: 6 per working harbor, 18 per working port, scaled by HP. */
function portThroughput(city) {
	let throughput = 0;
	for (const b of city.buildings.values()) {
		if (b.type !== "harbor" && b.type !== "port") continue;
		const health = b.hp / b.maxHp;
		if (health <= .5) continue;
		throughput += (b.type === "harbor" ? 6 : 18) * health;
	}
	return throughput;
}
/**
* Throughput factor of a maritime route from both ports' working capacity.
* Two healthy harbors carry ~0.5×, harbor+port ~0.8×, two ports ~1.1×.
* A destroyed port halves the route; both destroyed collapse it to 0.
*/
function portCapacityFactor(fromCity, toCity) {
	const t = portThroughput(fromCity) + portThroughput(toCity);
	if (t <= 0) return 0;
	return Math.max(.2, Math.min(1.2, .2 + t * .025));
}
/** Whether a city still has a usable harbor/port (HP above half). Gates sea routes. */
function portOperational(city) {
	for (const b of city.buildings.values()) if ((b.type === "harbor" || b.type === "port") && b.hp / b.maxHp > .5) return true;
	return false;
}
/**
* War grinds the roads around a settlement. Called each year of a siege.
* Roads inside the radius take damage that only a real repair pass can undo.
*/
function damageRoadsAround(tileMap, cx, cy, radius) {
	for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
		if (Math.hypot(dx, dy) > radius) continue;
		const tile = tileMap.getTile(Math.floor(cx) + dx, Math.floor(cy) + dy);
		if (!tile || tile.roadLevel <= 0) continue;
		tile.roadDamage = Math.min(1, tile.roadDamage + rng.range(.18, .42));
	}
}
/** Materials (stone+wood, tools weighted) a city has available for repair work. */
function repairBudget(city) {
	return city.stock.get("stone") + city.stock.get("wood") * .5 + city.stock.get("tools") * 1.5;
}
/** Criticality of a building for repair priority — the heart of the settlement first. */
var REPAIR_PRIORITY = {
	town_center: 0,
	harbor: 1,
	port: 2,
	granary: 3,
	farm: 4,
	pasture: 5,
	mine: 6,
	quarry: 7,
	factory: 8,
	refinery: 9,
	market: 10,
	workshop: 11,
	smithy: 12,
	wall: 13
};
/**
* Repairs buildings and roads, consuming real materials from the city stockpile.
* Repairs are slow and never free: materials are spent, and only a fraction of
* the damage closes per year.
*/
function repairInfrastructure(city, tileMap) {
	const damaged = [...city.buildings.values()].filter((b) => b.hp < b.maxHp).sort((a, b) => (REPAIR_PRIORITY[a.type] ?? 50) - (REPAIR_PRIORITY[b.type] ?? 50));
	for (const b of damaged) {
		const missing = b.maxHp - b.hp;
		if (missing <= 1) continue;
		const budget = repairBudget(city);
		if (budget <= 0) break;
		const want = missing * .25;
		const spend = Math.min(want, budget);
		if (spend <= 0) continue;
		const stone = Math.min(city.stock.get("stone"), spend * .55);
		const wood = Math.min(city.stock.get("wood"), spend * .35);
		const tools = Math.min(city.stock.get("tools"), spend * .1);
		city.stock.take("stone", stone);
		city.stock.take("wood", wood);
		city.stock.take("tools", tools);
		if (stone > 0) city.ledger.recordConsumed("stone", stone);
		if (wood > 0) city.ledger.recordConsumed("wood", wood);
		if (tools > 0) city.ledger.recordConsumed("tools", tools);
		b.hp = Math.min(b.maxHp, b.hp + (stone / .55 + wood / .35 + tools / .1) * .55);
	}
	if (repairBudget(city) <= 0) return;
	const roadTiles = [];
	for (const key of city.territory) {
		const [tx, ty] = key.split(",").map(Number);
		const tile = tileMap.getTile(tx, ty);
		if (tile && tile.roadLevel > 0 && tile.roadDamage > 0) roadTiles.push(tile);
	}
	roadTiles.sort((a, b) => b.roadLevel - a.roadLevel);
	for (const tile of roadTiles) {
		if (repairBudget(city) <= 0) break;
		const fix = Math.min(tile.roadDamage, .45);
		const stone = Math.min(city.stock.get("stone"), fix * tile.roadLevel * .6);
		const wood = Math.min(city.stock.get("wood"), fix * tile.roadLevel * .4);
		if (stone + wood <= 0) break;
		city.stock.take("stone", stone);
		city.stock.take("wood", wood);
		if (stone > 0) city.ledger.recordConsumed("stone", stone);
		if (wood > 0) city.ledger.recordConsumed("wood", wood);
		tile.roadDamage = Math.max(0, tile.roadDamage - fix);
	}
	const railTiles = [];
	for (const key of city.territory) {
		const [tx, ty] = key.split(",").map(Number);
		const tile = tileMap.getTile(tx, ty);
		if (tile && tile.railLevel > 0 && tile.railDamage > 0) railTiles.push(tile);
	}
	for (const tile of railTiles) {
		if (repairBudget(city) <= 0) break;
		const fix = Math.min(tile.railDamage, .45);
		const steel = Math.min(city.stock.get("steel"), fix * .8);
		const stone = Math.min(city.stock.get("stone"), fix * .5);
		if (steel + stone <= 0) break;
		city.stock.take("steel", steel);
		city.stock.take("stone", stone);
		if (steel > 0) city.ledger.recordConsumed("steel", steel);
		if (stone > 0) city.ledger.recordConsumed("stone", stone);
		tile.railDamage = Math.max(0, tile.railDamage - fix);
	}
}
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
/**
* Road-level movement speed multiplier shared by every mover on the map —
* citizens, fauna and caravans all travel faster on better roads.
*/
var ROAD_SPEED_BONUS = {
	0: 1,
	1: 1.2,
	2: 1.45,
	3: 1.8
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
		const roadBonus = ROAD_SPEED_BONUS[tileMap.getTile(Math.floor(startX), Math.floor(startY))?.roadLevelEffective ?? 0] ?? 1;
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
			if (mode === "road") return tile.type !== TerrainType.DEEP_OCEAN && tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.LAVA;
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
			if (mode === "road") {
				if (tile.type === TerrainType.SHALLOW_WATER) return 3;
				return TERRAINS[tile.type].moveCost * (ROAD_COST_MULTIPLIER[tile.roadLevelEffective] ?? 1);
			}
			return TERRAINS[tile.type].moveCost * (ROAD_COST_MULTIPLIER[tile.roadLevelEffective] ?? 1);
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
//#region src/civ/RailwayNetwork.ts
/** Goods the railway exists to haul — the industrial supply chain. */
var FREIGHT_GOODS = [
	"coal",
	"iron",
	"oil",
	"steel"
];
/** Freight floor: a station only ships what it genuinely holds beyond this. */
var SURPLUS_FLOOR = 6;
/** Units one route can move per year, scaled by line condition. */
var BASE_THROUGHPUT = 10;
/** Track segments the AI lays per year. */
var LAY_PER_YEAR = 4;
/** Steel + wood cost per segment laid. */
var SEGMENT_STEEL = 1.2;
var SEGMENT_WOOD = 3;
var RailwayNetwork = class {
	/** Freight carried this year, world total. Reset each year. */
	yearlyFreight = 0;
	/** Segments laid by AI construction this year. */
	yearlyConstructed = 0;
	/** Complete lines finished since the network object existed. */
	linesBuilt = 0;
	constructions = /* @__PURE__ */ new Map();
	reset() {
		this.yearlyFreight = 0;
		this.yearlyConstructed = 0;
		this.linesBuilt = 0;
		this.constructions.clear();
	}
	/** Lays a single rail segment. Returns false over water or existing track. */
	layTrack(tileMap, x, y, ownerId) {
		const tile = tileMap.getTile(Math.floor(x), Math.floor(y));
		if (!tile || TERRAINS[tile.type].isWater) return false;
		if (tile.railLevel > 0) return false;
		tile.railLevel = 1;
		tile.railDamage = 0;
		tile.railOwnerId = ownerId;
		tileMap.markRenderDirty(tile.x, tile.y);
		return true;
	}
	/** Removes a rail segment (raze tool / line abandonment). */
	removeTrack(tileMap, x, y) {
		const tile = tileMap.getTile(Math.floor(x), Math.floor(y));
		if (!tile || tile.railLevel <= 0) return;
		tile.railLevel = 0;
		tile.railDamage = 0;
		tile.railOwnerId = null;
		tileMap.markRenderDirty(tile.x, tile.y);
	}
	/** Every tile carrying rail, live or damaged (capacity uses all of them). */
	railTiles(tileMap) {
		const tiles = [];
		for (let x = 0; x < tileMap.width; x++) for (let y = 0; y < tileMap.height; y++) {
			const t = tileMap.grid[x][y];
			if (t.railLevel > 0) tiles.push(t);
		}
		return tiles;
	}
	/**
	* Connected components of the operative network. A segment damaged to its
	* floor (railLevelEffective = 0) severs the line, splitting one component in
	* two — cutting a single rail link stops every freight route across it.
	*/
	components(tileMap) {
		const seen = /* @__PURE__ */ new Set();
		const components = [];
		for (const start of this.railTiles(tileMap)) {
			const key = `${start.x},${start.y}`;
			if (seen.has(key)) continue;
			const comp = [];
			const queue = [start];
			seen.add(key);
			while (queue.length) {
				const t = queue.pop();
				comp.push(t);
				for (const n of tileMap.getNeighbors(t.x, t.y, true)) {
					const nk = `${n.x},${n.y}`;
					if (n.railLevelEffective <= 0 || seen.has(nk)) continue;
					seen.add(nk);
					queue.push(n);
				}
			}
			components.push(comp);
		}
		return components;
	}
	/** 0..1 average condition of a line — capacity scales with it. */
	lineQuality(tiles) {
		if (tiles.length === 0) return 0;
		let sum = 0;
		for (const t of tiles) sum += t.railHealth;
		return sum / tiles.length;
	}
	/** Whether two stations may exchange rail freight (border closure rules). */
	borderOpen(kf, kt, world) {
		if (!kf || !kt) return false;
		if (kf === kt) return true;
		return world.trade.hasAgreement(kf, kt) && !world.trade.isEmbargoed(kf, kt) && !world.diplomacy.isAtWar(kf, kt);
	}
	/** Whether `city` can actually put `good` to work right now. */
	wantsGood(kingdom, city, good) {
		const knows = (t) => !!kingdom?.research.knows(t);
		switch (good) {
			case "coal": return city.hasBuilding("smithy") && knows("metallurgy");
			case "iron": return city.hasBuilding("smithy");
			case "oil": return city.hasBuilding("refinery") && knows("industrialization");
			case "steel": return city.hasBuilding("factory") && knows("industrialization");
			default: return false;
		}
	}
	/** Runs freight across every connected line. Stations with a surplus ship to
	*  stations on the same component that consume the good. */
	tickFreight(world) {
		const tileMap = world.tileMap;
		for (const comp of this.components(tileMap)) {
			const quality = this.lineQuality(comp);
			if (quality <= .01) continue;
			const stations = [];
			for (const t of comp) if (t.cityId) {
				const c = world.cities.get(t.cityId);
				if (c) stations.push(c);
			}
			if (stations.length < 2) continue;
			const throughput = Math.round(BASE_THROUGHPUT * quality);
			for (const from of stations) for (const to of stations) {
				if (from.id === to.id) continue;
				if (!this.borderOpen(from.kingdomId, to.kingdomId, world)) continue;
				const toKingdom = to.kingdomId ? world.kingdoms.get(to.kingdomId) ?? null : null;
				for (const good of FREIGHT_GOODS) {
					if (!this.wantsGood(toKingdom, to, good)) continue;
					const surplus = from.stock.get(good) - SURPLUS_FLOOR;
					if (surplus <= 0) continue;
					const amount = Math.min(surplus, throughput);
					if (amount < 1) continue;
					const moved = from.stock.take(good, amount);
					const delivered = to.stock.add(good, moved);
					if (delivered < moved) from.stock.add(good, moved - delivered);
					from.ledger.recordExported(good, delivered);
					to.ledger.recordImported(good, delivered);
					world.market?.reportDemand(good, delivered);
					this.yearlyFreight += delivered;
				}
			}
		}
	}
	/**
	* An industrial realm links its coal to its steel. A kingdom with steam_power
	* that has a coal mine in one city and a smithy in another surveys a corridor
	* (reusing the trade pathfinder) and lays track along it over the years,
	* paying steel and wood out of the mining city's stockpile.
	*/
	tickConstruction(world) {
		for (const kingdom of world.kingdoms.values()) {
			if (!kingdom.research.knows("steam_power")) continue;
			if (kingdom.overlordId) continue;
			const cities = [...kingdom.cityIds].map((id) => world.cities.get(id)).filter((c) => !!c);
			if (cities.length < 2) continue;
			const producer = cities.find((c) => c.stock.get("coal") >= SURPLUS_FLOOR && [...c.buildings.values()].some((b) => b.type === "mine" && b.extractedGood === "coal" && b.staffing > 0));
			const consumer = cities.find((c) => c.hasBuilding("smithy"));
			if (!producer || !consumer || producer.id === consumer.id) continue;
			if (this.connected(world.tileMap, producer, consumer)) {
				this.constructions.delete(kingdom.id);
				continue;
			}
			let plan = this.constructions.get(kingdom.id);
			if (!plan || plan.from !== producer.id || plan.to !== consumer.id) {
				const path = SimplePathfinder.findPath(producer.x, producer.y, consumer.x, consumer.y, world.tileMap, "land");
				if (!path || path.length < 2) continue;
				plan = {
					from: producer.id,
					to: consumer.id,
					path,
					cursor: 0
				};
				this.constructions.set(kingdom.id, plan);
			}
			let laid = 0;
			while (plan.cursor < plan.path.length && laid < LAY_PER_YEAR) {
				const step = plan.path[plan.cursor];
				plan.cursor++;
				if (producer.stock.get("steel") < SEGMENT_STEEL || producer.stock.get("wood") < SEGMENT_WOOD) break;
				if (!this.layTrack(world.tileMap, step.x, step.y, kingdom.id)) continue;
				producer.stock.take("steel", SEGMENT_STEEL);
				producer.stock.take("wood", SEGMENT_WOOD);
				producer.ledger.recordConsumed("steel", SEGMENT_STEEL);
				producer.ledger.recordConsumed("wood", SEGMENT_WOOD);
				laid++;
			}
			this.yearlyConstructed += laid;
			if (plan.cursor >= plan.path.length) {
				this.constructions.delete(kingdom.id);
				this.linesBuilt++;
				chronicle.log(world.year, "economy", `${kingdom.name} opened a railway line between ${producer.name} and ${consumer.name}, carrying coal to its forges.`, {
					title: `Railway: ${producer.name}–${consumer.name}`,
					importance: "major",
					scope: "kingdom",
					refs: [
						{
							kind: "city",
							id: producer.id,
							name: producer.name
						},
						{
							kind: "city",
							id: consumer.id,
							name: consumer.name
						},
						{
							kind: "kingdom",
							id: kingdom.id,
							name: kingdom.name
						}
					],
					tags: ["railway", "industry"],
					consequences: [`Coal now travels by rail between ${producer.name} and ${consumer.name}.`]
				});
			}
		}
	}
	/** Whether two cities sit on the same operative rail component. */
	connected(tileMap, a, b) {
		for (const comp of this.components(tileMap)) {
			let hasA = false;
			let hasB = false;
			for (const t of comp) {
				if (t.cityId === a.id) hasA = true;
				if (t.cityId === b.id) hasB = true;
				if (hasA && hasB) return true;
			}
		}
		return false;
	}
	/** The whole yearly railway pass: lay new lines, then move freight. */
	tickRailways(world) {
		this.yearlyFreight = 0;
		this.yearlyConstructed = 0;
		this.tickConstruction(world);
		this.tickFreight(world);
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
function activeLawDefinitions(profile) {
	return LAW_CATEGORY_ORDER.map((category) => LAWS[profile.active[category]]);
}
function aggregateLawEffects(profile) {
	const total = {};
	for (const law of activeLawDefinitions(profile)) mergeEffects(total, law.effects);
	return total;
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
	/**
	* Units of each good this realm's technology gives it a reason to want per
	* year. Empty in the stone age; it is what makes oil worth a war later.
	*/
	strategicDemand = /* @__PURE__ */ new Map();
	/** What the realm can actually operate, recomputed each year. */
	techCapabilities = [];
	/**
	* The era the realm can really function at, which may lag the era it has
	* researched — knowing about factories is not the same as having one.
	*/
	operatingEra = "stone";
	/** Fraction of this realm's material technology it can actually put to work, 0..1. */
	technologicalCapacity() {
		if (this.techCapabilities.length === 0) return 1;
		let sum = 0;
		for (const c of this.techCapabilities) sum += c.capacity;
		return sum / this.techCapabilities.length;
	}
	/**
	* What this realm charges at its border, 0.02..0.45.
	*
	* The single source of truth for tariffs: caravans, ships and the route
	* planner all read it, so a law passed in the capital is felt on every cart
	* that crosses the frontier. Trade law dominates; mercantile culture only
	* nudges it. `trade` is positive for open borders, negative for closed ones.
	*/
	tariffRate() {
		const openness = aggregateLawEffects(this.laws).trade ?? 0;
		const rate = .12 + this.culture.mercantilism * .08 - openness * .9;
		return Math.max(.02, Math.min(.45, rate));
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
			wealth: this.wealth,
			exportVolume: this.exportVolume,
			importVolume: this.importVolume,
			tariffRevenue: this.tariffRevenue,
			pirateRaidsDefeated: this.pirateRaidsDefeated
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
		kingdom.exportVolume = data.exportVolume ?? 0;
		kingdom.importVolume = data.importVolume ?? 0;
		kingdom.tariffRevenue = data.tariffRevenue ?? 0;
		kingdom.pirateRaidsDefeated = data.pirateRaidsDefeated ?? 0;
		return kingdom;
	}
};
//#endregion
//#region scratch/test_infrastructure.ts
/**
* Review checks for Phase H (infrastructure capacity) and Phase I (railways),
* work done by another agent. One runnable assertion per claim it makes.
*/
/** Test isolation: procedural terrain may put water anywhere, and layTrack
*  silently refuses water tiles. Force a strip of land so rail tests are
*  about the railway logic, not about where a seed happened to put ocean. */
function forceLand(map, tiles) {
	for (const p of tiles) {
		const t = map.getTile(p.x, p.y);
		t.type = TerrainType.GRASS;
	}
}
var failures = 0;
function check(name, pass, detail = "") {
	if (pass) console.log(`  PASS  ${name}`);
	else {
		failures++;
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
	}
}
console.log("=== PHASE H+I REVIEW CHECKS ===\n");
{
	const map = new TileMap(40, 40, "single_continent", 111);
	const path = [
		{
			x: 10,
			y: 10
		},
		{
			x: 11,
			y: 10
		},
		{
			x: 12,
			y: 10
		}
	];
	const noRoad = roadCapacityFactor(path, map);
	for (const p of path) map.getTile(p.x, p.y).roadLevel = 1;
	const dirt = roadCapacityFactor(path, map);
	for (const p of path) map.getTile(p.x, p.y).roadLevel = 3;
	const highway = roadCapacityFactor(path, map);
	check("no road is the slowest", noRoad < dirt, `${noRoad} vs ${dirt}`);
	check("a highway beats a dirt trail", highway > dirt, `${dirt} vs ${highway}`);
	check("capacity factor stays in a sane band", noRoad >= .3 && highway <= 1.5, `${noRoad}..${highway}`);
}
{
	const map = new TileMap(40, 40, "single_continent", 222);
	const path = [{
		x: 20,
		y: 20
	}, {
		x: 21,
		y: 20
	}];
	for (const p of path) map.getTile(p.x, p.y).roadLevel = 3;
	const before = roadCapacityFactor(path, map);
	damageRoadsAround(map, 20, 20, 2);
	const after = roadCapacityFactor(path, map);
	check("war damage reduces road capacity", after < before, `${before} -> ${after}`);
}
{
	const a = new City("ca", "Porttown", SpeciesType.LUMINI, 0, 0, "Founder", 1);
	const b = new City("cb", "Shoretown", SpeciesType.LUMINI, 10, 0, "Founder", 1);
	const portA = a.addBuilding("port", 0, 0);
	const portB = b.addBuilding("port", 10, 0);
	const healthy = portCapacityFactor(a, b);
	check("two healthy ports carry real capacity", healthy > 0, `${healthy}`);
	check("a healthy port is operational", portOperational(a));
	portA.hp = Math.round(portA.maxHp * .3);
	portB.hp = Math.round(portB.maxHp * .3);
	check("a knocked-out port is not operational", !portOperational(a));
	const wrecked = portCapacityFactor(a, b);
	check("destroyed ports collapse maritime capacity", wrecked < healthy, `${healthy} -> ${wrecked}`);
}
{
	const map = new TileMap(20, 20, "single_continent", 333);
	const city = new City("cr", "Fixtown", SpeciesType.LUMINI, 5, 5, "Founder", 1);
	const wall = city.addBuilding("wall", 5, 5);
	wall.hp = Math.round(wall.maxHp * .5);
	city.stock.set("stone", 0);
	city.stock.set("wood", 0);
	city.stock.set("tools", 0);
	const hpBefore = wall.hp;
	repairInfrastructure(city, map);
	check("no materials means no repair happens", wall.hp === hpBefore, `${hpBefore} -> ${wall.hp}`);
	city.stock.set("stone", 500);
	city.stock.set("wood", 500);
	city.stock.set("tools", 500);
	repairInfrastructure(city, map);
	check("materials in stock actually get spent on repair", wall.hp > hpBefore, `${hpBefore} -> ${wall.hp}`);
	check("repair consumed stone from the stockpile", city.stock.get("stone") < 500, `${city.stock.get("stone")}`);
}
{
	const map = new TileMap(30, 30, "single_continent", 444);
	const rail = new RailwayNetwork();
	const line = [
		{
			x: 5,
			y: 5
		},
		{
			x: 6,
			y: 5
		},
		{
			x: 7,
			y: 5
		},
		{
			x: 8,
			y: 5
		},
		{
			x: 9,
			y: 5
		}
	];
	forceLand(map, line);
	for (const p of line) check(`segment (${p.x},${p.y}) was actually laid`, rail.layTrack(map, p.x, p.y, "k1"));
	const before = rail.components(map);
	check("a freshly laid line is one component", before.length === 1 && before[0].length === 5, `${before.length} comps`);
	map.getTile(7, 5).railDamage = .9;
	const after = rail.components(map);
	check("heavy damage to one segment splits the line in two", after.length === 2, `${after.length} comps`);
}
{
	const map = new TileMap(30, 30, "single_continent", 555);
	const rail = new RailwayNetwork();
	const kingdom = new Kingdom("k1", "Ironrealm", SpeciesType.STONEKIN, "#94a3b8", "miner", 1);
	kingdom.research.complete("mining");
	kingdom.research.complete("bronze_working");
	kingdom.research.complete("iron_working");
	kingdom.research.complete("metallurgy");
	const miner = new City("miner", "Coalpit", SpeciesType.STONEKIN, 5, 5, "Founder", 1);
	const forge = new City("forge", "Forgetown", SpeciesType.STONEKIN, 6, 5, "Founder", 1);
	miner.kingdomId = "k1";
	forge.kingdomId = "k1";
	forge.addBuilding("smithy", 6, 5);
	kingdom.cityIds.add("miner");
	kingdom.cityIds.add("forge");
	miner.stock.set("coal", 100);
	const world = {
		year: 10,
		cities: /* @__PURE__ */ new Map([["miner", miner], ["forge", forge]]),
		kingdoms: /* @__PURE__ */ new Map([["k1", kingdom]]),
		tileMap: map,
		diplomacy: { isAtWar: () => false },
		trade: {
			hasAgreement: () => true,
			isEmbargoed: () => false
		}
	};
	rail.tickFreight(world);
	check("no track means no freight moves", forge.stock.get("coal") === 0, `${forge.stock.get("coal")}`);
	forceLand(map, [{
		x: 5,
		y: 5
	}, {
		x: 6,
		y: 5
	}]);
	map.getTile(5, 5).cityId = "miner";
	map.getTile(6, 5).cityId = "forge";
	rail.layTrack(map, 5, 5, "k1");
	rail.layTrack(map, 6, 5, "k1");
	rail.tickFreight(world);
	check("connected track moves coal to the smithy that wants it", forge.stock.get("coal") > 0, `${forge.stock.get("coal")}`);
	check("the miner is left with its surplus floor, not drained to zero", miner.stock.get("coal") >= 5, `${miner.stock.get("coal")}`);
	const delivered = forge.stock.get("coal");
	miner.ledger.rollOver();
	forge.ledger.rollOver();
	check("the move is booked in both ledgers", miner.ledger.flow("coal").exported >= delivered - .01 && forge.ledger.flow("coal").imported >= delivered - .01, `exported=${miner.ledger.flow("coal").exported} imported=${forge.ledger.flow("coal").imported}`);
}
{
	const map = new TileMap(30, 30, "single_continent", 666);
	const rail = new RailwayNetwork();
	const kA = new Kingdom("kA", "Alpha", SpeciesType.STONEKIN, "#94a3b8", "a1", 1);
	const kB = new Kingdom("kB", "Beta", SpeciesType.STONEKIN, "#f87171", "b1", 1);
	for (const k of [kA, kB]) {
		k.research.complete("mining");
		k.research.complete("bronze_working");
		k.research.complete("iron_working");
		k.research.complete("metallurgy");
	}
	const a1 = new City("a1", "Mineburg", SpeciesType.STONEKIN, 5, 5, "Founder", 1);
	const b1 = new City("b1", "Steelburg", SpeciesType.STONEKIN, 6, 5, "Founder", 1);
	a1.kingdomId = "kA";
	b1.kingdomId = "kB";
	b1.addBuilding("smithy", 6, 5);
	a1.stock.set("coal", 100);
	forceLand(map, [{
		x: 5,
		y: 5
	}, {
		x: 6,
		y: 5
	}]);
	map.getTile(5, 5).cityId = "a1";
	map.getTile(6, 5).cityId = "b1";
	rail.layTrack(map, 5, 5, "kA");
	rail.layTrack(map, 6, 5, "kB");
	const cities = /* @__PURE__ */ new Map([["a1", a1], ["b1", b1]]);
	const kingdoms = /* @__PURE__ */ new Map([["kA", kA], ["kB", kB]]);
	const atWar = {
		year: 1,
		cities,
		kingdoms,
		tileMap: map,
		diplomacy: { isAtWar: () => true },
		trade: {
			hasAgreement: () => true,
			isEmbargoed: () => false
		}
	};
	rail.tickFreight(atWar);
	check("rail freight does not cross a war border", b1.stock.get("coal") === 0, `${b1.stock.get("coal")}`);
	const noTreaty = {
		year: 2,
		cities,
		kingdoms,
		tileMap: map,
		diplomacy: { isAtWar: () => false },
		trade: {
			hasAgreement: () => false,
			isEmbargoed: () => false
		}
	};
	rail.tickFreight(noTreaty);
	check("rail freight does not cross into a realm with no trade agreement", b1.stock.get("coal") === 0, `${b1.stock.get("coal")}`);
	const friendly = {
		year: 3,
		cities,
		kingdoms,
		tileMap: map,
		diplomacy: { isAtWar: () => false },
		trade: {
			hasAgreement: () => true,
			isEmbargoed: () => false
		}
	};
	rail.tickFreight(friendly);
	check("rail freight crosses once the two realms have a real trade agreement", b1.stock.get("coal") > 0, `${b1.stock.get("coal")}`);
}
console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
//#endregion
export {};
