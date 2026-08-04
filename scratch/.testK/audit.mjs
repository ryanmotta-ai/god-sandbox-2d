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
			reformSupport: approach(current.reformSupport, targets.reformSupport, .18),
			factors: targets.factors
		});
	}
	next.lastUnrestYear = profile.lastUnrestYear ?? 0;
	return recomputeSociety(next);
}
function factionTargets(id, current, ctx) {
	const supported = SOCIAL_FACTIONS[id].supports.includes(ctx.government);
	const resisted = SOCIAL_FACTIONS[id].resists.includes(ctx.government);
	const taxPain = clamp01((ctx.taxRate - .16) / .34);
	const faminePain = clamp01(1 - ctx.foodSecurity + ctx.famineYears * .12);
	const warPain = clamp01(ctx.warWeariness / 100 + (ctx.atWar ? .22 : 0));
	const adminPain = clamp01(1 - ctx.administrativeReach);
	const inequalityPain = ctx.inequality;
	const foodPricePain = clamp01((ctx.foodPriceIndex - 1) / 1.2);
	const joblessPain = clamp01(ctx.unemployment / .3);
	const factors = [];
	const note = (label, delta) => {
		if (Math.abs(delta) >= .005) factors.push({
			label,
			delta
		});
		return delta;
	};
	const govFit = supported ? .12 : resisted ? -.16 : 0;
	let influence = baseInfluence(id, ctx.government);
	let satisfaction = .48 + note("Afinidade com o regime", govFit) + note("Estabilidade", ctx.stability * .16) + note("Legitimidade", ctx.legitimacy * .12);
	let wealth = current.wealth;
	let loyalty = .44 + ctx.legitimacy * .24 + ctx.stability * .16 + govFit;
	let warSupport = .22 + ctx.externalThreat * .25 + ctx.culture.militarism * .18;
	let reformSupport = .2 + ctx.culture.innovation * .18 + Math.max(0, .52 - ctx.stability) * .3;
	switch (id) {
		case "peasants":
			influence += .08 - ctx.industrialisation * .08;
			satisfaction += note("Segurança alimentar", ctx.foodSecurity * .28) + note("Prosperidade", ctx.prosperity * .16) + note("Impostos", -taxPain * .22) + note("Guerra", -warPain * .12) + note("Preço do grão que vendem", foodPricePain * .08);
			wealth = .28 + ctx.prosperity * .22 + ctx.foodSecurity * .16 - taxPain * .18 - inequalityPain * .08 + foodPricePain * .12;
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
			satisfaction += note("Volume de comércio", ctx.tradeDependency * .3) + ctx.culture.openness * .14 + ctx.stability * .12 + note("Guerra fecha rotas", -warPain * .22) + note("Impostos", -taxPain * .12) + note("Embargos", -clamp01(ctx.embargoes * .35) * .28);
			wealth = .35 + ctx.tradeDependency * .34 + (ctx.economy === "market" ? .18 : 0) - warPain * .12 - clamp01(ctx.embargoes * .35) * .2;
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
			satisfaction += ctx.industrialisation * .08 + ctx.foodSecurity * .12 + note("Desigualdade", -inequalityPain * .26) + note("Impostos", -taxPain * .08) + note("Preço da comida", -foodPricePain * .3) + note("Desemprego", -joblessPain * .32);
			wealth = .3 + ctx.industrialisation * .2 + (ctx.economy === "planned" ? .12 : 0) - inequalityPain * .18 - joblessPain * .24 - foodPricePain * .12;
			warSupport -= .12 + warPain * .14;
			reformSupport += inequalityPain * .28 + ctx.industrialisation * .12 + foodPricePain * .26 + joblessPain * .3;
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
	satisfaction += note("Fome", -faminePain * .22);
	satisfaction += note("Desgaste da guerra", -warPain * (id === "military" ? .06 : .12));
	influence += ctx.laws?.factionInfluence?.[id] ?? 0;
	satisfaction += note("Leis vigentes", ctx.laws?.factionSatisfaction?.[id] ?? 0);
	loyalty += ctx.laws?.factionLoyalty?.[id] ?? 0;
	warSupport += ctx.laws?.factionWarSupport?.[id] ?? 0;
	reformSupport += ctx.laws?.factionReformSupport?.[id] ?? 0;
	reformSupport += ctx.laws?.reformPressure ?? 0;
	loyalty += satisfaction * .24 - Math.max(0, .45 - satisfaction) * .28;
	const radicalization = Math.max(0, .08 + Math.max(0, .52 - satisfaction) * .75 + Math.max(0, .46 - loyalty) * .32 + faminePain * .18 + (ctx.laws?.revoltRisk ?? 0) + (resisted ? .06 : 0));
	return {
		influence: clamp01(influence),
		satisfaction: clamp01(satisfaction),
		wealth: clamp01(wealth),
		loyalty: clamp01(loyalty),
		radicalization: clamp01(radicalization),
		warSupport: clamp01(warSupport),
		reformSupport: clamp01(reformSupport),
		factors: factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
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
	profile.cohesion = clamp01(cohesion);
	profile.reformPressure = clamp01(reformPressure * 1.45);
	profile.revoltRisk = clamp01(revoltRisk * 2.1);
	profile.warPressure = clamp01(warPressure);
	profile.peacePressure = clamp01(peacePressure);
	profile.coupRisk = clamp01(military.influence * military.radicalization * (1 - military.loyalty) * 1.4 + nobles.influence * nobles.radicalization * Math.max(0, .55 - nobles.loyalty) * .75);
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
	return clamp01(value);
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
	return clamp01(value);
}
function normalizeFaction(faction) {
	return {
		id: faction.id,
		influence: clamp01(faction.influence ?? .1),
		satisfaction: clamp01(faction.satisfaction ?? .55),
		wealth: clamp01(faction.wealth ?? .35),
		loyalty: clamp01(faction.loyalty ?? .55),
		radicalization: clamp01(faction.radicalization ?? .08),
		warSupport: clamp01(faction.warSupport ?? .3),
		reformSupport: clamp01(faction.reformSupport ?? .25),
		factors: faction.factors
	};
}
function approach(current, target, rate) {
	return clamp01(current + (clamp01(target) - current) * rate);
}
function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}
//#endregion
//#region src/civ/TechTree.ts
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
/**
* The demand a technology creates for raw materials.
*
* This is the whole point of the tech tree economically: oil is a worthless
* black puddle until somebody invents an engine, and then wars are fought over
* it. Nothing here is a flag on the good itself — importance *emerges* from
* what the realms of the world have actually learned to do.
*
* The weight is roughly "units wanted per year per point of industrial base".
*/
var TECH_STRATEGIC_DEMAND = {
	bronze_working: {
		copper: 1,
		tin: 1.5
	},
	iron_working: { iron: 1.2 },
	metallurgy: {
		iron: 1.6,
		coal: 1.4
	},
	gunpowder: {
		saltpeter: 1.7,
		coal: .6
	},
	steam_power: {
		coal: 2.2,
		iron: .9
	},
	industrialization: {
		coal: 1.8,
		oil: 1.5,
		rubber: 1.3,
		steel: 1.4
	},
	electricity: {
		copper: 1.8,
		oil: 1,
		uranium: .5
	},
	mass_media: { copper: .9 }
};
/**
* How badly this realm wants a good, purely because of what it knows.
* Zero means the material is still just a rock to them.
*/
/** The raw-material demand one technology creates, for the tech screen. */
function demandCreatedBy(techId) {
	const demand = TECH_STRATEGIC_DEMAND[techId];
	if (!demand) return [];
	return Object.entries(demand).map(([good, weight]) => ({
		good,
		weight
	})).sort((a, b) => b.weight - a.weight);
}
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
//#endregion
//#region scratch/test_ui_data.ts
/**
* Phase K checks: the UI explains real arithmetic.
*
* The rule under test is item 45 — if a screen shows a number, that number has
* to be computed by the simulation, not invented for display.
*/
var failures = 0;
function check(name, pass, detail = "") {
	if (pass) console.log(`  PASS  ${name}`);
	else {
		failures++;
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
	}
}
console.log("=== PHASE K: UI DATA CHECKS ===\n");
var baseCtx = {
	year: 50,
	government: "monarchy",
	economy: "mercantile",
	taxRate: .2,
	atWar: false,
	wars: 0,
	stability: .6,
	legitimacy: .6,
	prosperity: .6,
	foodSecurity: .7,
	tradeDependency: .3,
	externalThreat: .1,
	administrativeReach: .7,
	inequality: .3,
	industrialisation: .4,
	gdpPerCapita: 20,
	cityCount: 3,
	famineYears: 0,
	warWeariness: 0,
	foodPriceIndex: 1,
	unemployment: 0,
	labourShortage: 0,
	embargoes: 0,
	culture: {
		militarism: .5,
		expansionism: .5,
		tradition: .5,
		authority: .5,
		openness: .5,
		mercantilism: .5,
		innovation: .5,
		collectivism: .5,
		warTrauma: 0,
		diplomaticTrust: .5
	}
};
var settle = (ctx) => {
	let p = createSocietyProfile("monarchy");
	for (let i = 0; i < 30; i++) p = updateSociety(p, ctx);
	return p;
};
{
	const p = settle(baseCtx);
	const missing = SOCIAL_FACTION_ORDER.filter((id) => !p.factions[id].factors?.length);
	check("every faction reports the reasons behind its satisfaction", missing.length === 0, `sem fatores: ${missing.join(", ")}`);
	const workers = p.factions.workers.factors ?? [];
	check("the reasons are sorted by how much they matter", workers.every((f, i) => i === 0 || Math.abs(workers[i - 1].delta) >= Math.abs(f.delta)), workers.map((f) => `${f.label}:${f.delta.toFixed(3)}`).join(" "));
}
{
	const calm = settle(baseCtx);
	const hungry = settle({
		...baseCtx,
		foodPriceIndex: 2.4
	});
	const jobless = settle({
		...baseCtx,
		unemployment: .28
	});
	const blockaded = settle({
		...baseCtx,
		embargoes: 3
	});
	const foodFactor = (hungry.factions.workers.factors ?? []).find((f) => f.label.includes("comida"));
	check("dear bread shows up as a named reason for the workers", !!foodFactor && foodFactor.delta < 0, `${foodFactor?.delta ?? "ausente"}`);
	const jobFactor = (jobless.factions.workers.factors ?? []).find((f) => f.label.includes("Desemprego"));
	check("unemployment shows up as a named reason", !!jobFactor && jobFactor.delta < 0, `${jobFactor?.delta ?? "ausente"}`);
	const embargoFactor = (blockaded.factions.merchants.factors ?? []).find((f) => f.label.includes("Embargo"));
	check("an embargo shows up as a named reason for the merchants", !!embargoFactor && embargoFactor.delta < 0, `${embargoFactor?.delta ?? "ausente"}`);
	const peasantFood = (hungry.factions.peasants.factors ?? []).find((f) => f.label.includes("grão"));
	check("the countryside is shown gaining from expensive grain", !!peasantFood && peasantFood.delta > 0, `${peasantFood?.delta ?? "ausente"}`);
	check("a calm realm shows no food-price pressure at all", !(calm.factions.workers.factors ?? []).some((f) => f.label.includes("comida")));
}
{
	const mild = settle({
		...baseCtx,
		unemployment: .1
	});
	const severe = settle({
		...baseCtx,
		unemployment: .3
	});
	const mildDelta = (mild.factions.workers.factors ?? []).find((f) => f.label.includes("Desemprego"))?.delta ?? 0;
	const severeDelta = (severe.factions.workers.factors ?? []).find((f) => f.label.includes("Desemprego"))?.delta ?? 0;
	check("worse unemployment produces a larger stated penalty", severeDelta < mildDelta, `${mildDelta.toFixed(3)} vs ${severeDelta.toFixed(3)}`);
}
{
	const steam = demandCreatedBy("steam_power");
	check("steam power declares the demand it creates", steam.length > 0, `${steam.length}`);
	check("coal is the headline consequence of steam power", steam[0]?.good === "coal", `${steam[0]?.good}`);
	check("the consequence list is sorted strongest first", steam.every((d, i) => i === 0 || steam[i - 1].weight >= d.weight));
	check("a purely political tech creates no material demand", demandCreatedBy("philosophy").length === 0);
	check("every declared good is a real good", steam.every((d) => !!GOODS[d.good]));
}
{
	let bad = 0;
	for (const tech of Object.values(TECHNOLOGIES)) for (const b of tech.unlocks.buildings ?? []) if (!BUILDINGS[b]) bad++;
	check("every technology unlocks buildings that actually exist", bad === 0, `${bad} inválidos`);
}
console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`);
if (failures > 0) process.exitCode = 1;
//#endregion
export {};
