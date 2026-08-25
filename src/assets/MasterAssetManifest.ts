export const MASTER_ASSET_DOMAINS = ['city', 'war', 'colonial', 'ecology', 'effects', 'water', 'lighting'] as const;
export type MasterAssetDomain = typeof MASTER_ASSET_DOMAINS[number];
export type MasterAssetEra = 'primitive' | 'stone' | 'bronze' | 'iron' | 'classical' | 'industrial' | 'modern' | 'any';
export type MasterAssetCulture = 'common' | 'northern' | 'desert' | 'forest' | 'stonekin' | 'emberkin' | 'colonial' | 'any';
export type MasterAssetState = 'normal' | 'damaged' | 'ruined' | 'abandoned' | 'foundation' | 'construction' | 'emissive' | 'effect';
export type MasterAssetSize = 'prop' | 'small' | 'medium' | 'large' | 'landmark' | 'linear';

export interface MasterAssetEntry {
  readonly id: string;
  readonly domain: MasterAssetDomain;
  readonly category: string;
  readonly family: string;
  readonly function: string;
  readonly era: MasterAssetEra;
  readonly culture: MasterAssetCulture;
  readonly state: MasterAssetState;
  readonly size: MasterAssetSize;
  readonly variant: number;
  readonly canvas: readonly [number, number];
  readonly footprint: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly atlas: 'world' | 'entity' | 'effect' | 'mask';
  readonly page: 'auto';
  readonly source: string;
  readonly description: string;
}

type AssetInput = readonly [
  id: string, domain: MasterAssetDomain, category: string, family: string, functionName: string,
  era: MasterAssetEra, culture: MasterAssetCulture, state: MasterAssetState,
  size: MasterAssetSize, variant: number, atlas: MasterAssetEntry['atlas'], description: string
];

const CANVAS: Record<MasterAssetSize, readonly [number, number]> = {
  prop: [32, 32], small: [64, 64], medium: [96, 96], large: [128, 128], landmark: [160, 160], linear: [64, 64]
};
const FOOTPRINT: Record<MasterAssetSize, readonly [number, number]> = {
  prop: [1, 1], small: [1, 1], medium: [2, 2], large: [3, 3], landmark: [4, 4], linear: [1, 1]
};

function asset(input: AssetInput): MasterAssetEntry {
  const [id, domain, category, family, functionName, era, culture, state, size, variant, atlas, description] = input;
  return {
    id, domain, category, family, function: functionName, era, culture, state, size, variant,
    canvas: CANVAS[size], footprint: FOOTPRINT[size], anchor: [0.5, 0.875], atlas, page: 'auto',
    source: `./library/${domain}/${category}/${id.replaceAll('.', '_')}.png`, description
  };
}

const INPUTS: readonly AssetInput[] = [
  // CITY: high-frequency visual variation across eras and functions.
  ['city.residential.house.poor.stone.v03','city','residential','house','housing','stone','common','normal','small',3,'world','humble timber-frame house on a warm stone base with a red clay roof'],
  ['city.residential.house.poor.stone.v04','city','residential','house','housing','stone','common','normal','small',4,'world','tiny irregular plaster-and-timber cottage with a patched red clay roof'],
  ['city.residential.house.common.stone.v05','city','residential','house','housing','stone','common','normal','small',5,'world','compact common house with stone ground floor and timber upper gable'],
  ['city.residential.house.common.stone.v06','city','residential','house','housing','stone','common','normal','small',6,'world','narrow common townhouse with side lean-to and clay tile roof'],
  ['city.residential.house.common.iron.v02','city','residential','house','housing','iron','common','normal','medium',2,'world','two-storey iron-era urban house with timber gallery and stone shopfront-like base'],
  ['city.residential.house.common.iron.v03','city','residential','house','housing','iron','common','normal','medium',3,'world','broad two-storey iron-era residence with courtyard gate and red roof'],
  ['city.residential.house.rich.classical.v02','city','residential','mansion','housing','classical','common','normal','large',2,'world','wealthy classical mansion with columned porch and tiled wings'],
  ['city.residential.house.rich.classical.v03','city','residential','mansion','housing','classical','common','normal','large',3,'world','ornate merchant villa with enclosed garden wall and red tiled roof'],
  ['city.residential.apartment.industrial.v01','city','residential','apartment','housing','industrial','common','normal','large',1,'world','dense red-brick industrial tenement with repeated windows and chimneys'],
  ['city.residential.apartment.modern.v01','city','residential','apartment','housing','modern','common','normal','large',1,'world','restrained early-modern masonry apartment block with flat service roof'],

  ['city.commercial.shop.common.stone.v02','city','commercial','shop','commerce','stone','common','normal','small',2,'world','small street shop with striped cloth awning and open display window'],
  ['city.commercial.shop.common.stone.v03','city','commercial','shop','commerce','stone','common','normal','small',3,'world','corner merchant shop with hanging blank wooden sign and goods counter'],
  ['city.commercial.tavern.common.iron.v02','city','commercial','tavern','hospitality','iron','common','normal','medium',2,'world','busy timber tavern with broad entrance, red roof and rear kitchen chimney'],
  ['city.commercial.market.common.classical.v03','city','commercial','market','commerce','classical','common','normal','medium',3,'world','roofed classical market hall with open arcades and colored fabric stalls'],
  ['city.commercial.warehouse.common.industrial.v02','city','commercial','warehouse','storage','industrial','common','normal','large',2,'world','brick warehouse with loading doors, pulley beam and dark metal roof'],
  ['city.commercial.arcade.common.classical.v01','city','commercial','arcade','commerce','classical','common','normal','large',1,'world','classical covered shopping arcade with rhythmic stone arches'],

  ['city.civic.school.common.iron.v01','city','civic','school','education','iron','common','normal','medium',1,'world','modest stone schoolhouse with bell gable and orderly windows'],
  ['city.civic.hospital.common.industrial.v01','city','civic','hospital','health','industrial','common','normal','large',1,'world','brick civic hospital with symmetrical wings and central entrance'],
  ['city.civic.university.common.classical.v01','city','civic','university','education','classical','common','normal','landmark',1,'world','grand classical university quadrangle with colonnaded main hall'],
  ['city.civic.courthouse.common.classical.v01','city','civic','courthouse','administration','classical','common','normal','large',1,'world','formal stone courthouse with broad stairs, columns and tiled roof'],
  ['city.civic.plaza.common.classical.v01','city','civic','plaza','public_space','classical','common','normal','large',1,'world','paved civic plaza module with central low fountain and corner planters'],
  ['city.civic.monument.common.modern.v02','city','civic','monument','landmark','modern','common','normal','medium',2,'world','modern civic stone monument with a strong simple silhouette and stepped base'],

  ['city.religious.chapel.common.iron.v01','city','religious','chapel','worship','iron','common','normal','medium',1,'world','small stone chapel with red roof, apse and modest bell tower'],
  ['city.religious.cathedral.common.classical.v01','city','religious','cathedral','worship','classical','common','normal','landmark',1,'world','large classical cathedral with twin towers and readable nave'],
  ['city.religious.monastery.common.iron.v01','city','religious','monastery','worship','iron','common','normal','large',1,'world','walled stone monastery around a small cloister courtyard'],
  ['city.religious.shrine.desert.bronze.v01','city','religious','shrine','worship','bronze','desert','normal','small',1,'world','desert bronze-era sandstone shrine with cloth canopy and carved doorway'],

  ['city.industrial.workshop.common.iron.v02','city','industrial','workshop','production','iron','common','normal','medium',2,'world','stone and timber workshop with side yard, workbench and vent chimney'],
  ['city.industrial.foundry.common.industrial.v01','city','industrial','foundry','production','industrial','common','normal','large',1,'world','heavy brick foundry with furnace hall, metal roof and tall smokestack'],
  ['city.industrial.textile_mill.common.industrial.v01','city','industrial','textile_mill','production','industrial','common','normal','large',1,'world','long brick textile mill with rows of windows and sawtooth roof'],
  ['city.industrial.refinery.common.industrial.v01','city','industrial','refinery','production','industrial','common','normal','large',1,'world','compact early industrial refinery with brick sheds, tanks and pipework'],
  ['city.industrial.power_plant.common.modern.v01','city','industrial','power_plant','production','modern','common','normal','landmark',1,'world','early-modern brick power station with turbine hall and twin stacks'],
  ['city.industrial.oil_well.common.industrial.v01','city','industrial','oil_well','extraction','industrial','common','normal','medium',1,'world','wood and iron derrick over a compact oil well platform'],
  ['city.industrial.shipyard.common.industrial.v01','city','industrial','shipyard','production','industrial','common','normal','large',1,'world','waterside shipyard module with slipway, timber frames and crane'],

  ['city.agriculture.barn.common.iron.v02','city','agriculture','barn','storage','iron','common','normal','medium',2,'world','large timber barn with stone footings, hay door and red roof'],
  ['city.agriculture.watermill.common.iron.v01','city','agriculture','watermill','production','iron','common','normal','medium',1,'world','stone watermill with timber wheel and red tiled roof'],
  ['city.agriculture.vineyard.common.classical.v01','city','agriculture','vineyard','food','classical','common','normal','medium',1,'world','compact vineyard plot with aligned vines and a tiny stone shed'],
  ['city.agriculture.orchard.common.iron.v01','city','agriculture','orchard','food','iron','common','normal','medium',1,'world','ordered fruit orchard plot with fence and tool shelter'],
  ['city.agriculture.greenhouse.common.modern.v01','city','agriculture','greenhouse','food','modern','common','normal','medium',1,'world','early-modern glass and iron greenhouse on a masonry base'],

  ['city.transport.rail_station.small.industrial.v01','city','transport','rail_station','rail','industrial','common','normal','medium',1,'world','small rural brick railway station with canopy and platform edge'],
  ['city.transport.rail_station.medium.industrial.v02','city','transport','rail_station','rail','industrial','common','normal','large',2,'world','medium urban railway station with long canopy and clock tower'],
  ['city.transport.rail_platform.industrial.v01','city','transport','rail_platform','rail','industrial','any','normal','linear',1,'world','straight stone railway platform segment with lamps and canopy posts'],
  ['city.transport.engine_shed.industrial.v01','city','transport','engine_shed','rail','industrial','common','normal','large',1,'world','brick two-road locomotive shed with tall arched doors'],
  ['city.transport.rail_water_tower.industrial.v01','city','transport','water_tower','rail','industrial','common','normal','medium',1,'world','railway water tower with timber tank and iron delivery spout'],
  ['city.transport.rail_bridge.industrial.v01','city','transport','rail_bridge','rail','industrial','any','normal','medium',1,'world','short iron truss railway bridge with stone abutments'],
  ['city.transport.port_crane.industrial.v01','city','transport','port_crane','port','industrial','common','normal','medium',1,'world','timber and iron harbor crane on a compact stone quay base'],
  ['city.transport.pier.common.iron.v01','city','transport','pier','port','iron','common','normal','linear',1,'world','straight timber pier segment with posts and mooring bollards'],
  ['city.transport.lighthouse.common.industrial.v01','city','transport','lighthouse','navigation','industrial','common','normal','medium',1,'world','stone coastal lighthouse with red roof lantern and attached keeper house'],
  ['city.transport.fishing_boat.common.iron.v01','city','transport','fishing_boat','ship','iron','common','normal','small',1,'world','small wooden fishing sailboat in oblique top-side view'],
  ['city.transport.cargo_ship.common.industrial.v01','city','transport','cargo_ship','ship','industrial','common','normal','large',1,'world','compact early steam cargo ship with dark hull, deck cargo and one funnel'],
  ['city.transport.passenger_carriage.common.industrial.v01','city','transport','passenger_carriage','rail','industrial','common','normal','small',1,'world','red-brown wooden railway passenger carriage viewed along the game track angle'],

  ['city.walls.tower.common.iron.v01','city','walls','wall_tower','fortification','iron','common','normal','medium',1,'world','round stone wall tower with crenellations and red conical roof'],
  ['city.walls.gatehouse.common.iron.v02','city','walls','gatehouse','fortification','iron','common','normal','large',2,'world','fortified stone gatehouse with twin towers and open passable arch'],
  ['city.walls.segment.desert.iron.v01','city','walls','wall','fortification','iron','desert','normal','linear',1,'world','sandstone crenellated wall segment with desert cultural detailing'],
  ['city.walls.segment.northern.iron.v01','city','walls','wall','fortification','iron','northern','normal','linear',1,'world','dark stone northern wall segment with timber fighting platform'],
  ['city.military.fortress.common.industrial.v01','city','military','fortress','fortification','industrial','common','normal','landmark',1,'world','angular masonry gun fortress with low bastions and central barracks'],
  ['city.military.barricade.common.industrial.v01','city','military','barricade','defense','industrial','common','normal','prop',1,'world','portable timber barricade reinforced with sacks and scrap iron'],

  ['city.props.fountain.common.classical.v01','city','props','fountain','decoration','classical','common','normal','prop',1,'world','small carved stone public fountain'],
  ['city.props.bench.common.industrial.v01','city','props','bench','decoration','industrial','common','normal','prop',1,'world','wood and cast-iron street bench'],
  ['city.props.signpost.common.iron.v01','city','props','signpost','wayfinding','iron','common','normal','prop',1,'world','blank wooden multi-arm road signpost'],
  ['city.props.barrels.common.any.v02','city','props','barrels','storage','any','common','normal','prop',2,'world','cluster of wooden barrels with iron hoops'],
  ['city.props.sacks.common.any.v01','city','props','sacks','storage','any','common','normal','prop',1,'world','small pile of tied grain sacks'],
  ['city.props.woodpile.common.any.v01','city','props','woodpile','materials','any','common','normal','prop',1,'world','neatly stacked firewood under a tiny lean-to'],
  ['city.props.scaffold.common.any.v01','city','props','scaffold','construction','any','common','construction','medium',1,'world','freestanding timber construction scaffolding with ladders'],
  ['city.props.foundation.stone.any.v01','city','props','foundation','construction','any','common','foundation','small',1,'world','low stone building foundation with marked doorway gap'],
  ['city.props.materials.common.any.v01','city','props','materials','construction','any','common','construction','prop',1,'world','compact construction materials pile of boards bricks and rope'],

  ['city.ruins.factory.brick.industrial.v01','city','ruins','factory','ruin','industrial','common','ruined','large',1,'world','collapsed burned brick factory shell with broken stack and rubble'],
  ['city.ruins.civic.stone.classical.v01','city','ruins','civic','ruin','classical','common','ruined','large',1,'world','ruined classical civic hall with broken columns and fallen roof'],
  ['city.ruins.wall.collapsed.iron.v02','city','ruins','wall','ruin','iron','common','ruined','linear',2,'world','collapsed stone wall breach with material-specific rubble'],
  ['city.ruins.warehouse.abandoned.industrial.v01','city','ruins','warehouse','ruin','industrial','common','abandoned','large',1,'world','abandoned brick warehouse with boarded doors and damaged roof'],
  ['city.ruins.market.burned.iron.v01','city','ruins','market','ruin','iron','common','ruined','medium',1,'world','burned roofed market remains with charred posts and collapsed stalls'],

  // WAR: static future-ready unit and camp silhouettes; no gameplay coupling.
  ['war.units.infantry.primitive.v01','war','units','infantry','combat','primitive','common','normal','small',1,'entity','primitive infantry warrior with hide shield and stone spear'],
  ['war.units.archer.iron.v01','war','units','archer','combat','iron','common','normal','small',1,'entity','iron-era archer in simple tunic holding a bow at rest'],
  ['war.units.cavalry.iron.v01','war','units','cavalry','combat','iron','common','normal','small',1,'entity','mounted iron-era cavalry scout with spear and round shield'],
  ['war.units.rifleman.industrial.v01','war','units','rifleman','combat','industrial','common','normal','small',1,'entity','industrial-era uniformed rifle infantry standing at ready'],
  ['war.units.infantry.modern.v01','war','units','infantry','combat','modern','common','normal','small',1,'entity','restrained early-modern infantry soldier with pack and rifle'],
  ['war.camps.tent.common.iron.v01','war','camps','tent','military_camp','iron','common','normal','small',1,'world','plain canvas military wedge tent with bedroll and small crate'],
  ['war.camps.command_tent.common.iron.v01','war','camps','command_tent','military_camp','iron','common','normal','medium',1,'world','larger military command tent with blank pennant and map table'],
  ['war.siege.catapult.common.iron.v01','war','siege','catapult','siege','iron','common','normal','medium',1,'world','timber torsion catapult with stone ammunition basket'],
  ['war.artillery.cannon.common.industrial.v01','war','artillery','cannon','artillery','industrial','common','normal','small',1,'world','field cannon with iron barrel and wooden spoked wheels'],
  ['war.logistics.supply_cart.common.iron.v01','war','logistics','supply_cart','supply','iron','common','normal','small',1,'world','covered military supply cart loaded with sacks and crates'],
  ['war.forts.frontier.colonial.industrial.v01','war','forts','frontier_fort','fortification','industrial','colonial','normal','large',1,'world','small colonial frontier fort with timber palisade and corner towers'],
  ['war.ruins.outpost.common.iron.v01','war','ruins','outpost','ruin','iron','common','ruined','medium',1,'world','destroyed military outpost with broken palisade and burned tent'],

  // COL: reusable settlement and frontier building families.
  ['col.settlement.cabin.frontier.iron.v01','colonial','settlement','cabin','housing','iron','colonial','normal','small',1,'world','rough frontier settler log cabin with stone chimney'],
  ['col.commerce.trade_post.frontier.iron.v01','colonial','commerce','trade_post','commerce','iron','colonial','normal','medium',1,'world','frontier trade post mixing metropolitan timber framing with local stone'],
  ['col.religious.mission.frontier.iron.v01','colonial','religious','mission','worship','iron','colonial','normal','medium',1,'world','simple colonial mission chapel adapted to local materials'],
  ['col.residential.plantation_house.classical.v01','colonial','residential','plantation_house','housing','classical','colonial','normal','large',1,'world','colonial estate house with broad shaded veranda and masonry base'],
  ['col.walls.palisade.frontier.iron.v01','colonial','walls','palisade','fortification','iron','colonial','normal','linear',1,'world','rough frontier timber palisade segment with sharpened posts'],
  ['col.transport.dock.frontier.iron.v01','colonial','transport','dock','port','iron','colonial','normal','medium',1,'world','small colonial river dock with timber warehouse shelter and canoe landing'],

  // ECO: biome-readable static nature props.
  ['eco.flora.oak.temperate.v01','ecology','flora','oak','vegetation','any','any','normal','small',1,'world','mature temperate oak tree with broad clustered green crown'],
  ['eco.flora.pine.northern.v01','ecology','flora','pine','vegetation','any','northern','normal','small',1,'world','tall northern pine tree with layered dark needle branches'],
  ['eco.flora.palm.desert.v01','ecology','flora','palm','vegetation','any','desert','normal','small',1,'world','date palm with curved trunk and compact frond crown'],
  ['eco.flora.acacia.savanna.v01','ecology','flora','acacia','vegetation','any','any','normal','small',1,'world','flat-canopied savanna acacia tree'],
  ['eco.flora.dead_tree.dry.v01','ecology','flora','dead_tree','vegetation','any','any','normal','small',1,'world','weathered leafless dead tree with forked silhouette'],
  ['eco.flora.reeds.wetland.v01','ecology','flora','reeds','vegetation','any','any','normal','prop',1,'world','compact wetland reeds and cattails cluster'],
  ['eco.terrain.rocks.granite.v01','ecology','terrain','rocks','terrain_detail','any','stonekin','normal','prop',1,'world','small angular granite rock cluster'],
  ['eco.flora.flowers.meadow.v01','ecology','flora','flowers','vegetation','any','any','normal','prop',1,'world','tiny readable meadow wildflower cluster'],
  ['eco.flora.bush.berries.v01','ecology','flora','berry_bush','vegetation','any','forest','normal','prop',1,'world','dense forest berry bush with a few red berries'],
  ['eco.terrain.logs.fallen.v01','ecology','terrain','fallen_log','terrain_detail','any','forest','normal','prop',1,'world','mossy fallen log with broken branch stubs'],

  // Reusable pixel effects, water tiles and auxiliary emissive masks.
  ['fx.smoke.gray.v01','effects','atmosphere','smoke','effect','any','any','effect','small',1,'effect','opaque clustered gray smoke puff animation keyframe with crisp lobes'],
  ['fx.fire.orange.v01','effects','destruction','fire','effect','any','any','effect','small',1,'effect','bright compact orange fire flame animation keyframe'],
  ['fx.steam.white.v01','effects','industry','steam','effect','industrial','any','effect','small',1,'effect','compact white steam plume animation keyframe with crisp pixel clusters'],
  ['fx.sparks.industrial.v01','effects','industry','sparks','effect','industrial','any','effect','prop',1,'effect','small burst of bright iron-working sparks'],
  ['fx.dust.brown.v01','effects','atmosphere','dust','effect','any','any','effect','small',1,'effect','compact brown dust cloud animation keyframe'],
  ['fx.rain.streaks.v01','effects','weather','rain','effect','any','any','effect','linear',1,'effect','sparse diagonal blue-gray rain streak tile'],
  ['fx.snow.flakes.v01','effects','weather','snow','effect','any','northern','effect','linear',1,'effect','sparse varied white snowflake tile'],
  ['fx.fog.bank.v01','effects','weather','fog','effect','any','any','effect','linear',1,'effect','low horizontal pale fog bank made of crisp pixel clusters'],
  ['water.calm.inland.v01','water','surface','calm_water','water','any','any','normal','linear',1,'world','seamless calm inland water tile with restrained horizontal highlights'],
  ['water.waves.ocean.v01','water','surface','ocean_waves','water','any','any','normal','linear',1,'world','seamless deep ocean tile with short directional wave crests'],
  ['water.coast.foam.v01','water','coast','coast_foam','water','any','any','normal','linear',1,'world','transparent-ready irregular coastal foam edge overlay'],
  ['water.river.current.v01','water','surface','river_current','water','any','any','normal','linear',1,'world','seamless river water tile with directional current streaks'],
  ['light.windows.warm.v01','lighting','windows','window_glow','emissive','industrial','any','emissive','prop',1,'mask','warm rectangular window emissive-mask cluster without a building'],
  ['light.lamp.warm.v01','lighting','street','lamp_glow','emissive','industrial','any','emissive','small',1,'mask','compact warm street-lamp glow mask with crisp concentric pixel falloff'],
  ['light.torch.warm.v01','lighting','fire','torch_glow','emissive','iron','any','emissive','small',1,'mask','compact warm torch flame and glow mask keyframe']
];

export const MASTER_ASSET_MANIFEST = {
  schema: 2,
  tilePixels: 32,
  pixelDensity: 2,
  pageSize: 512,
  assets: INPUTS.map(asset)
} as const;

/**
 * `import.meta.glob` is a build-time macro: the bundler replaces the call with
 * an object literal, and at runtime `import.meta.glob` itself is undefined. A
 * `typeof … === 'function'` guard around it therefore always took the empty
 * branch and threw the resolved URLs away, so no library PNG ever loaded in
 * either renderer. The try/catch keeps the manifest importable from plain Node
 * (tests, tooling), where the call is untransformed and throws.
 */
let MASTER_ASSET_URLS: Record<string, string> = {};
try {
  MASTER_ASSET_URLS = import.meta.glob('./library/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
} catch { /* no bundler: artwork resolves only inside the app */ }

export function resolveMasterAssetUrl(entry: MasterAssetEntry): string | undefined {
  return MASTER_ASSET_URLS[entry.source];
}

const MASTER_ASSETS_BY_ID = new Map(MASTER_ASSET_MANIFEST.assets.map(entry => [entry.id, entry]));
export function masterAssetEntry(id: string): MasterAssetEntry | undefined { return MASTER_ASSETS_BY_ID.get(id); }
export function masterAssetAtlasKey(id: string): string { return `asset:${id}`; }

/**
 * Which building type each art family stands in for.
 *
 * The library was loaded, decoded and packed into the atlas under `asset:<id>`,
 * and nothing ever asked for that key: `masterAssetAtlasKey` had exactly one
 * occurrence in the whole codebase, its own definition. Seventy-two pieces of
 * artwork sat in GPU memory while the renderer drew generated stand-ins over
 * the top of them.
 *
 * It matters most because this pack is the one that covers the eras the city
 * manifest does not: thirty-three iron pieces, thirty-eight industrial and six
 * modern, against the city pack's nine, two and none. Everything a settlement
 * built after the classical age was falling back to procedural art for want of
 * a key.
 *
 * Only building families are mapped here. Units, weather, flora, water and
 * lighting also live in this library and need consumers of their own, which do
 * not exist yet.
 */
const MASTER_FAMILY_TO_BUILDING: Record<string, string> = {
  house: 'house', cabin: 'house', mansion: 'house', apartment: 'house', plantation_house: 'house',
  shop: 'market', market: 'market', trade_post: 'market', tavern: 'market',
  warehouse: 'granary', barn: 'granary', greenhouse: 'farm', orchard: 'farm', vineyard: 'farm',
  workshop: 'workshop', watermill: 'workshop', foundry: 'smithy',
  factory: 'factory', textile_mill: 'factory', power_plant: 'factory',
  refinery: 'refinery', oil_well: 'oil_well',
  shipyard: 'harbor', dock: 'harbor', pier: 'harbor', lighthouse: 'harbor',
  chapel: 'temple', cathedral: 'temple', monastery: 'temple', shrine: 'temple', mission: 'temple',
  school: 'library', university: 'academy', hospital: 'academy',
  courthouse: 'palace', civic: 'town_center', plaza: 'town_center',
  monument: 'monument', fountain: 'monument',
  wall: 'wall', palisade: 'wall', gatehouse: 'wall', wall_tower: 'wall',
  fortress: 'keep', frontier_fort: 'keep', outpost: 'keep'
};

/**
 * The key the world renderer actually asks for, or null when this asset is not
 * a building. Mirrors `buildingAtlasKey` in the atlas: type, era, level, damage.
 */
export function masterBuildingAtlasKey(entry: MasterAssetEntry): string | null {
  const type = MASTER_FAMILY_TO_BUILDING[entry.family];
  if (!type) return null;
  // 'any' and 'primitive' have no counterpart among the game's eras, and the
  // remaining states (abandoned, foundation, construction, emissive, effect)
  // are not damage levels the renderer asks for.
  if (entry.era === 'any' || entry.era === 'primitive') return null;
  const damage = entry.state === 'normal' ? 'healthy'
    : entry.state === 'damaged' ? 'damaged'
    : entry.state === 'ruined' ? 'ruined'
    : null;
  if (!damage) return null;
  const level = entry.size === 'large' || entry.size === 'landmark' ? 3 : entry.size === 'medium' ? 2 : 1;
  return `building:${type}:${entry.era}:${level}:${damage}`;
}
