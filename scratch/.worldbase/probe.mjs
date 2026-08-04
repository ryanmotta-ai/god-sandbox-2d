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
};
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
			predicate: mountainOrHighland,
			facies: ["igneous"],
			fallbacks: [mountainOrHighland]
		},
		{
			good: "iron",
			clusters: countForArea(width, height, 13, 5),
			radius: 2,
			minAmount: 75,
			maxAmount: 155,
			density: .78,
			predicate: mountainOrHighland,
			facies: ["igneous", "metamorphic"],
			fallbacks: [mountainOrHighland]
		},
		{
			good: "coal",
			clusters: countForArea(width, height, 9, 3),
			radius: 3,
			minAmount: 85,
			maxAmount: 180,
			density: .68,
			predicate: (tile) => mountainOrHighland(tile, 0, 0, grid) || tile.type === TerrainType.SWAMP,
			facies: ["sedimentary"],
			fallbacks: [(tile) => mountainOrHighland(tile, 0, 0, grid) || tile.type === TerrainType.SWAMP]
		},
		{
			good: "salt",
			clusters: countForArea(width, height, 7, 3),
			radius: 2,
			minAmount: 60,
			maxAmount: 135,
			density: .62,
			predicate: (tile, x, y, g) => tile.type === TerrainType.SAND || tile.type === TerrainType.SOIL && coastalLand(g, width, height, x, y),
			facies: ["sedimentary", "alluvial"],
			fallbacks: [(tile, x, y, g) => tile.type === TerrainType.SAND || tile.type === TerrainType.SOIL && coastalLand(g, width, height, x, y)]
		},
		{
			good: "gold",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 30,
			maxAmount: 75,
			density: .5,
			predicate: mountainOrHighland,
			facies: ["igneous", "metamorphic"],
			fallbacks: [mountainOrHighland]
		},
		{
			good: "gems",
			clusters: countForArea(width, height, 4, 2),
			radius: 1,
			minAmount: 24,
			maxAmount: 58,
			density: .6,
			predicate: (tile) => tile.type === TerrainType.MOUNTAIN && tile.height > .7,
			facies: ["igneous", "metamorphic"],
			fallbacks: [(tile) => tile.type === TerrainType.MOUNTAIN]
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
			fallbacks: [(tile) => tile.type === TerrainType.GRASS || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL]
		},
		{
			good: "spices",
			clusters: countForArea(width, height, 5, 2),
			radius: 2,
			minAmount: 35,
			maxAmount: 85,
			density: .5,
			predicate: tropical,
			fallbacks: [(tile) => tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP]
		},
		{
			good: "furs",
			clusters: countForArea(width, height, 6, 2),
			radius: 3,
			minAmount: 40,
			maxAmount: 90,
			density: .5,
			predicate: coldLand,
			fallbacks: [(tile) => tile.type === TerrainType.MOUNTAIN || tile.type === TerrainType.TUNDRA]
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
			predicate: mountainOrHighland,
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
			predicate: (tile) => (tile.type === TerrainType.SAND || tile.type === TerrainType.SWAMP || tile.type === TerrainType.SAVANNA || tile.type === TerrainType.SOIL) && tile.height < .72,
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
			fallbacks: [(tile) => tile.type === TerrainType.SAND || tile.type === TerrainType.SOIL || tile.type === TerrainType.MOUNTAIN]
		},
		{
			good: "rubber",
			clusters: countForArea(width, height, 5, 2),
			radius: 3,
			minAmount: 70,
			maxAmount: 150,
			density: .58,
			predicate: tropical,
			fallbacks: [(tile) => tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP]
		},
		{
			good: "uranium",
			clusters: countForArea(width, height, 2, 1),
			radius: 2,
			minAmount: 45,
			maxAmount: 95,
			density: .48,
			predicate: (tile) => tile.type === TerrainType.MOUNTAIN && tile.height > .78,
			facies: ["igneous"],
			fallbacks: [(tile) => tile.type === TerrainType.MOUNTAIN && tile.height > .6, (tile) => tile.type === TerrainType.MOUNTAIN]
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
				else if (nH < .41) type = TerrainType.SAND;
				else if (nH > .82) type = TerrainType.MOUNTAIN;
				else if (tempC < -5) type = nM > .5 ? TerrainType.SNOW : TerrainType.TUNDRA;
				else if (tempC > 28 && nM < .35) type = TerrainType.SAVANNA;
				else if (nM > .62) type = nH > .62 ? TerrainType.FOREST : TerrainType.SWAMP;
				else if (nM > .38) type = TerrainType.GRASS;
				else type = TerrainType.SOIL;
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
		const roadBonus = ROAD_SPEED_BONUS[tileMap.getTile(Math.floor(startX), Math.floor(startY))?.roadLevel ?? 0] ?? 1;
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
				return TERRAINS[tile.type].moveCost * (ROAD_COST_MULTIPLIER[tile.roadLevel] ?? 1);
			}
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
		this.dirtyTiles.clear();
		this.markAllDirty();
	}
};
//#endregion
//#region scratch/probe_worlds.ts
/**
* Probes the refined WorldGenerator across every preset: guarantees land,
* keeps magic regions as real clusters, and stays deterministic. Also checks
* the road-surveying A* mode crosses shallow water (bridges).
*/
var PRESETS = [
	"single_continent",
	"two_continents",
	"archipelago",
	"ring_atoll",
	"fragmented",
	"desert",
	"frozen",
	"random"
];
var SEEDS = [
	12345,
	777,
	20260802
];
var failures = 0;
for (const preset of PRESETS) for (const seed of SEEDS) {
	const grid = WorldGenerator.generate(128, 128, preset, seed);
	const counts = {};
	for (const row of grid) for (const t of row) counts[t.type] = (counts[t.type] ?? 0) + 1;
	const land = grid.length * grid[0].length - (counts.deep_ocean ?? 0) - (counts.shallow_water ?? 0);
	const magic = (counts.arcane ?? 0) + (counts.corrupted ?? 0);
	const landPct = land / (grid.length * grid[0].length) * 100;
	if (!(landPct > 5 && landPct < 99) || !(magic === 0 || magic > 20 && magic < 1e4)) {
		failures++;
		console.log(`FAIL preset=${preset} seed=${seed} land=${landPct.toFixed(1)}% magic=${magic} counts=${JSON.stringify(counts)}`);
	}
	const grid2 = WorldGenerator.generate(128, 128, preset, seed);
	let same = true;
	for (let x = 0; x < 128 && same; x++) for (let y = 0; y < 128 && same; y++) if (grid[x][y].type !== grid2[x][y].type) same = false;
	if (!same) {
		failures++;
		console.log(`FAIL determinism preset=${preset} seed=${seed}`);
	}
}
var components = 0;
var componentSizes = [];
{
	const grid = WorldGenerator.generate(128, 128, "single_continent", 12345);
	const seen = /* @__PURE__ */ new Set();
	const magicTypes = /* @__PURE__ */ new Set([TerrainType.ARCANE, TerrainType.CORRUPTED]);
	for (let x = 0; x < 128; x++) for (let y = 0; y < 128; y++) {
		const t = grid[x][y];
		if (!magicTypes.has(t.type) || seen.has(`${x},${y}`)) continue;
		components++;
		let size = 0;
		const stack = [[x, y]];
		seen.add(`${x},${y}`);
		while (stack.length) {
			const [cx, cy] = stack.pop();
			size++;
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = cx + dx, ny = cy + dy;
				if (nx < 0 || ny < 0 || nx >= 128 || ny >= 128) continue;
				const key = `${nx},${ny}`;
				if (seen.has(key)) continue;
				if (grid[nx][ny].type === t.type) {
					seen.add(key);
					stack.push([nx, ny]);
				}
			}
		}
		componentSizes.push(size);
	}
}
console.log(`magic components=${components} sizes=${componentSizes.sort((a, b) => b - a).slice(0, 10).join(",")}`);
if (components > 30) {
	failures++;
	console.log(`FAIL magic regions=${components} (too fragmented)`);
} else console.log(`magic ok (cohesive)`);
{
	const map = new TileMap(128, 128, "single_continent", 555);
	const grid = map.grid;
	const isW = (t) => !t || t.type === "deep_ocean" || t.type === "shallow_water";
	let strait = null;
	outer: for (let x = 4; x < 124; x++) for (let y = 4; y < 124; y++) {
		if (grid[x][y].type !== "shallow_water") continue;
		let lx = x - 1;
		while (lx > 0 && isW(grid[lx][y])) lx--;
		let rx = x + 1;
		while (rx < 128 && isW(grid[rx][y])) rx++;
		if (x - lx >= 1 && x - lx <= 10 && rx - x >= 1 && rx - x <= 10) {
			strait = {
				start: {
					x: lx,
					y
				},
				end: {
					x: rx,
					y
				}
			};
			break outer;
		}
	}
	if (!strait) console.log("bridge test skipped (no strait found on this world)");
	else {
		const landPath = SimplePathfinder.findPath(strait.start.x, strait.start.y, strait.end.x, strait.end.y, map, "land");
		const roadPath = SimplePathfinder.findPath(strait.start.x, strait.start.y, strait.end.x, strait.end.y, map, "road");
		const crossesWater = roadPath.some((p) => grid[Math.floor(p.x)][Math.floor(p.y)].type === "shallow_water");
		if (roadPath.length === 0 || !crossesWater) {
			failures++;
			console.log(`FAIL road bridge: land=${landPath.length} road=${roadPath.length} crossesWater=${crossesWater}`);
		} else console.log(`bridge ok: land path=${landPath.length} road path=${roadPath.length} (${roadPath.filter((p) => grid[Math.floor(p.x)][Math.floor(p.y)].type === "shallow_water").length} water tiles bridged)`);
	}
}
console.log(failures === 0 ? "ALL PRESETS OK" : `${failures} FAILURES`);
//#endregion
export {};
