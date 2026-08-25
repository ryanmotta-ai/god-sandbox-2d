export const CITY_ASSET_CATEGORIES = [
  'residential', 'commercial', 'civic', 'religious', 'military', 'industrial',
  'agriculture', 'transport', 'walls', 'props', 'ruins'
] as const;

export type CityAssetCategory = typeof CITY_ASSET_CATEGORIES[number];
export type CityAssetEra = 'stone' | 'bronze' | 'iron' | 'classical' | 'industrial' | 'modern' | 'any';
export type CityAssetCulture = 'common' | 'northern' | 'desert' | 'forest' | 'stonekin' | 'emberkin' | 'any';
export type CityAssetState = 'normal' | 'damaged' | 'ruined';
export type CityAssetSize = 'prop' | 'small' | 'medium' | 'large' | 'landmark' | 'linear';

export interface CityAssetEntry {
  /** Stable content ID. Never reuse an ID for different artwork. */
  readonly id: string;
  readonly category: CityAssetCategory;
  readonly family: string;
  readonly era: CityAssetEra;
  readonly culture: CityAssetCulture;
  readonly state: CityAssetState;
  readonly size: CityAssetSize;
  readonly variant: number;
  readonly priority: 1 | 2 | 3;
  /** Expected transparent source canvas in pixels. */
  readonly canvas: readonly [width: number, height: number];
  /** Logical CITY-V1 footprint, retained as metadata only in ART-V1. */
  readonly footprint: readonly [width: number, height: number];
  /** Ground contact point, normalized from the source canvas top-left. */
  readonly anchor: readonly [x: number, y: number];
  /** Existing renderer key replaced by this asset when its PNG is present. */
  readonly atlasKey?: string;
  readonly source: string;
}

type AssetInput = Omit<CityAssetEntry, 'source' | 'canvas' | 'footprint' | 'anchor'> & {
  canvas?: CityAssetEntry['canvas']; footprint?: CityAssetEntry['footprint']; anchor?: CityAssetEntry['anchor'];
};

const DEFAULT_CANVAS: Record<CityAssetSize, readonly [number, number]> = {
  prop: [32, 32], small: [64, 64], medium: [96, 96], large: [128, 128],
  landmark: [160, 160], linear: [64, 64]
};
const DEFAULT_FOOTPRINT: Record<CityAssetSize, readonly [number, number]> = {
  prop: [1, 1], small: [1, 1], medium: [2, 2], large: [3, 3], landmark: [4, 4], linear: [1, 1]
};

function asset(input: AssetInput): CityAssetEntry {
  const file = input.id.replace(/^city\./, '').replaceAll('.', '_');
  return {
    ...input,
    canvas: input.canvas ?? DEFAULT_CANVAS[input.size],
    footprint: input.footprint ?? DEFAULT_FOOTPRINT[input.size],
    anchor: input.anchor ?? [0.5, 0.875],
    source: `./city/${input.category}/${file}.png`
  };
}

/**
 * ART-V1 first pack. Missing PNGs are intentionally legal: procedural/current
 * artwork remains the renderer fallback until the final asset is dropped in.
 */
export const CITY_ASSET_MANIFEST = {
  schema: 1,
  tilePixels: 32,
  pixelDensity: 2,
  assets: [
    asset({ id:'city.residential.house.small.v01', category:'residential', family:'house', era:'stone', culture:'common', state:'normal', size:'small', variant:1, priority:1, atlasKey:'building:house:stone:1:healthy' }),
    asset({ id:'city.residential.house.small.v02', category:'residential', family:'house', era:'stone', culture:'common', state:'normal', size:'small', variant:2, priority:1 }),
    asset({ id:'city.residential.house.medium.v01', category:'residential', family:'house', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:house:stone:2:healthy' }),
    asset({ id:'city.residential.house.damaged.v01', category:'residential', family:'house', era:'stone', culture:'common', state:'damaged', size:'small', variant:1, priority:1, atlasKey:'building:house:stone:1:damaged' }),
    asset({ id:'city.residential.house.ruined.v01', category:'residential', family:'house', era:'stone', culture:'common', state:'ruined', size:'small', variant:1, priority:1, atlasKey:'building:house:stone:1:ruined' }),
    asset({ id:'city.residential.courtyard.medium.v01', category:'residential', family:'courtyard', era:'classical', culture:'common', state:'normal', size:'medium', variant:1, priority:2 }),
    asset({ id:'city.residential.cabin.small.v01', category:'residential', family:'cabin', era:'stone', culture:'common', state:'normal', size:'small', variant:1, priority:1 }),
    asset({ id:'city.residential.house.rich.large.v01', category:'residential', family:'house', era:'classical', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:house:classical:3:healthy' }),

    asset({ id:'city.commercial.market.medium.v01', category:'commercial', family:'market', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:market:stone:1:healthy' }),
    asset({ id:'city.commercial.market.medium.v02', category:'commercial', family:'market', era:'stone', culture:'common', state:'normal', size:'medium', variant:2, priority:1 }),
    asset({ id:'city.commercial.shop.small.v01', category:'commercial', family:'shop', era:'stone', culture:'common', state:'normal', size:'small', variant:1, priority:1 }),
    asset({ id:'city.commercial.inn.medium.v01', category:'commercial', family:'inn', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1 }),
    asset({ id:'city.commercial.bank.large.v01', category:'commercial', family:'bank', era:'classical', culture:'common', state:'normal', size:'large', variant:1, priority:2, atlasKey:'building:bank:classical:1:healthy' }),
    asset({ id:'city.commercial.warehouse.large.v01', category:'commercial', family:'warehouse', era:'iron', culture:'common', state:'normal', size:'large', variant:1, priority:1 }),

    asset({ id:'city.civic.town_center.large.v01', category:'civic', family:'town_center', era:'stone', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:town_center:stone:1:healthy' }),
    asset({ id:'city.civic.town_center.damaged.v01', category:'civic', family:'town_center', era:'stone', culture:'common', state:'damaged', size:'large', variant:1, priority:1, atlasKey:'building:town_center:stone:1:damaged' }),
    asset({ id:'city.civic.palace.landmark.v01', category:'civic', family:'palace', era:'classical', culture:'common', state:'normal', size:'landmark', variant:1, priority:1, atlasKey:'building:palace:classical:1:healthy' }),
    asset({ id:'city.civic.library.large.v01', category:'civic', family:'library', era:'classical', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:library:classical:1:healthy' }),
    asset({ id:'city.civic.academy.large.v01', category:'civic', family:'academy', era:'classical', culture:'common', state:'normal', size:'large', variant:1, priority:2, atlasKey:'building:academy:classical:1:healthy' }),
    asset({ id:'city.civic.monument.landmark.v01', category:'civic', family:'monument', era:'classical', culture:'common', state:'normal', size:'landmark', variant:1, priority:2, atlasKey:'building:monument:classical:1:healthy' }),

    asset({ id:'city.religious.shrine.small.v01', category:'religious', family:'shrine', era:'stone', culture:'common', state:'normal', size:'small', variant:1, priority:1 }),
    asset({ id:'city.religious.temple.large.v01', category:'religious', family:'temple', era:'classical', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:temple:classical:1:healthy' }),
    asset({ id:'city.religious.temple.damaged.v01', category:'religious', family:'temple', era:'classical', culture:'common', state:'damaged', size:'large', variant:1, priority:2, atlasKey:'building:temple:classical:1:damaged' }),
    asset({ id:'city.religious.cemetery.medium.v01', category:'religious', family:'cemetery', era:'any', culture:'common', state:'normal', size:'medium', variant:1, priority:2 }),

    asset({ id:'city.military.barracks.large.v01', category:'military', family:'barracks', era:'iron', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:barracks:iron:1:healthy' }),
    asset({ id:'city.military.keep.landmark.v01', category:'military', family:'keep', era:'iron', culture:'common', state:'normal', size:'landmark', variant:1, priority:1, atlasKey:'building:keep:iron:1:healthy' }),
    asset({ id:'city.military.watchtower.medium.v01', category:'military', family:'watchtower', era:'iron', culture:'common', state:'normal', size:'medium', variant:1, priority:1 }),
    asset({ id:'city.military.gatehouse.large.v01', category:'military', family:'gatehouse', era:'iron', culture:'common', state:'normal', size:'large', variant:1, priority:1 }),
    asset({ id:'city.military.armory.medium.v01', category:'military', family:'armory', era:'iron', culture:'common', state:'normal', size:'medium', variant:1, priority:2 }),
    asset({ id:'city.military.keep.ruined.v01', category:'military', family:'keep', era:'iron', culture:'common', state:'ruined', size:'landmark', variant:1, priority:2, atlasKey:'building:keep:iron:1:ruined' }),

    asset({ id:'city.industrial.workshop.medium.v01', category:'industrial', family:'workshop', era:'bronze', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:workshop:bronze:1:healthy' }),
    asset({ id:'city.industrial.smithy.medium.v01', category:'industrial', family:'smithy', era:'iron', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:smithy:iron:1:healthy' }),
    asset({ id:'city.industrial.lumber_camp.medium.v01', category:'industrial', family:'lumber_camp', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:lumber_camp:stone:1:healthy' }),
    asset({ id:'city.industrial.quarry.large.v01', category:'industrial', family:'quarry', era:'stone', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:quarry:stone:1:healthy' }),
    asset({ id:'city.industrial.mine.large.v01', category:'industrial', family:'mine', era:'iron', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:mine:iron:1:healthy' }),
    asset({ id:'city.industrial.factory.large.v01', category:'industrial', family:'factory', era:'industrial', culture:'common', state:'normal', size:'large', variant:1, priority:2, atlasKey:'building:factory:industrial:1:healthy' }),

    asset({ id:'city.agriculture.farm.medium.v01', category:'agriculture', family:'farm', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:farm:stone:1:healthy' }),
    asset({ id:'city.agriculture.farm.medium.v02', category:'agriculture', family:'farm', era:'stone', culture:'common', state:'normal', size:'medium', variant:2, priority:1 }),
    asset({ id:'city.agriculture.granary.medium.v01', category:'agriculture', family:'granary', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:granary:stone:1:healthy' }),
    asset({ id:'city.agriculture.pasture.medium.v01', category:'agriculture', family:'pasture', era:'stone', culture:'common', state:'normal', size:'medium', variant:1, priority:1, atlasKey:'building:pasture:stone:1:healthy' }),
    asset({ id:'city.agriculture.windmill.medium.v01', category:'agriculture', family:'windmill', era:'iron', culture:'common', state:'normal', size:'medium', variant:1, priority:2 }),
    asset({ id:'city.agriculture.irrigation.linear.v01', category:'agriculture', family:'irrigation', era:'bronze', culture:'common', state:'normal', size:'linear', variant:1, priority:2 }),

    asset({ id:'city.transport.harbor.large.v01', category:'transport', family:'harbor', era:'iron', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:harbor:iron:1:healthy' }),
    asset({ id:'city.transport.port.large.v01', category:'transport', family:'port', era:'industrial', culture:'common', state:'normal', size:'large', variant:1, priority:1, atlasKey:'building:port:industrial:1:healthy' }),
    asset({ id:'city.transport.road_straight.linear.v01', category:'transport', family:'road', era:'any', culture:'any', state:'normal', size:'linear', variant:1, priority:1 }),
    asset({ id:'city.transport.road_corner.linear.v01', category:'transport', family:'road', era:'any', culture:'any', state:'normal', size:'linear', variant:2, priority:1 }),
    asset({ id:'city.transport.bridge.medium.v01', category:'transport', family:'bridge', era:'iron', culture:'common', state:'normal', size:'medium', variant:1, priority:2 }),
    asset({ id:'city.transport.rail_station.large.v01', category:'transport', family:'rail_station', era:'industrial', culture:'common', state:'normal', size:'large', variant:1, priority:1 }),
    asset({ id:'city.transport.rail_depot.large.v01', category:'transport', family:'rail_depot', era:'industrial', culture:'common', state:'normal', size:'large', variant:1, priority:1 }),
    asset({ id:'city.transport.rail_signal.prop.v01', category:'transport', family:'rail_signal', era:'industrial', culture:'common', state:'normal', size:'prop', variant:1, priority:1 }),
    asset({ id:'city.transport.rail_straight_ns.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:1, priority:1, atlasKey:'rail:straight:ns' }),
    asset({ id:'city.transport.rail_straight_ew.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:2, priority:1, atlasKey:'rail:straight:ew' }),
    asset({ id:'city.transport.rail_curve_ne.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:3, priority:1, atlasKey:'rail:curve:ne' }),
    asset({ id:'city.transport.rail_curve_nw.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:4, priority:1, atlasKey:'rail:curve:nw' }),
    asset({ id:'city.transport.rail_crossing.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:5, priority:1, atlasKey:'rail:crossing' }),
    asset({ id:'city.transport.rail_switch.linear.v01', category:'transport', family:'rail_track', era:'industrial', culture:'any', state:'normal', size:'linear', variant:6, priority:1, atlasKey:'rail:switch' }),
    asset({ id:'city.transport.train.steam.right.v01', category:'transport', family:'train_steam', era:'industrial', culture:'any', state:'normal', size:'small', variant:1, priority:1, atlasKey:'vehicle:train:steam:right' }),
    asset({ id:'city.transport.train.steam.left.v01', category:'transport', family:'train_steam', era:'industrial', culture:'any', state:'normal', size:'small', variant:2, priority:1, atlasKey:'vehicle:train:steam:left' }),
    asset({ id:'city.transport.train.steam.up.v01', category:'transport', family:'train_steam', era:'industrial', culture:'any', state:'normal', size:'small', variant:3, priority:1, atlasKey:'vehicle:train:steam:up' }),
    asset({ id:'city.transport.train.steam.down.v01', category:'transport', family:'train_steam', era:'industrial', culture:'any', state:'normal', size:'small', variant:4, priority:1, atlasKey:'vehicle:train:steam:down' }),
    asset({ id:'city.transport.train.diesel.right.v01', category:'transport', family:'train_diesel', era:'modern', culture:'any', state:'normal', size:'small', variant:1, priority:1, atlasKey:'vehicle:train:diesel:right' }),
    asset({ id:'city.transport.train.diesel.left.v01', category:'transport', family:'train_diesel', era:'modern', culture:'any', state:'normal', size:'small', variant:2, priority:1, atlasKey:'vehicle:train:diesel:left' }),
    asset({ id:'city.transport.train.diesel.up.v01', category:'transport', family:'train_diesel', era:'modern', culture:'any', state:'normal', size:'small', variant:3, priority:1, atlasKey:'vehicle:train:diesel:up' }),
    asset({ id:'city.transport.train.diesel.down.v01', category:'transport', family:'train_diesel', era:'modern', culture:'any', state:'normal', size:'small', variant:4, priority:1, atlasKey:'vehicle:train:diesel:down' }),

    asset({ id:'city.walls.segment.linear.v01', category:'walls', family:'wall', era:'iron', culture:'common', state:'normal', size:'linear', variant:1, priority:1, atlasKey:'building:wall:iron:1:healthy' }),
    asset({ id:'city.walls.corner.linear.v01', category:'walls', family:'wall', era:'iron', culture:'common', state:'normal', size:'linear', variant:2, priority:1 }),
    asset({ id:'city.walls.segment.damaged.v01', category:'walls', family:'wall', era:'iron', culture:'common', state:'damaged', size:'linear', variant:1, priority:1, atlasKey:'building:wall:iron:1:damaged' }),
    asset({ id:'city.walls.segment.ruined.v01', category:'walls', family:'wall', era:'iron', culture:'common', state:'ruined', size:'linear', variant:1, priority:1, atlasKey:'building:wall:iron:1:ruined' }),

    asset({ id:'city.props.crates.prop.v01', category:'props', family:'crates', era:'any', culture:'any', state:'normal', size:'prop', variant:1, priority:1 }),
    asset({ id:'city.props.cart.prop.v01', category:'props', family:'cart', era:'any', culture:'common', state:'normal', size:'prop', variant:1, priority:1 }),
    asset({ id:'city.props.well.prop.v01', category:'props', family:'well', era:'any', culture:'common', state:'normal', size:'prop', variant:1, priority:1 }),
    asset({ id:'city.props.lamp.prop.v01', category:'props', family:'lamp', era:'industrial', culture:'common', state:'normal', size:'prop', variant:1, priority:2 }),
    asset({ id:'city.props.tree_deciduous.prop.v01', category:'props', family:'tree', era:'any', culture:'any', state:'normal', size:'small', variant:1, priority:1 }),
    asset({ id:'city.props.shrub_planter.prop.v01', category:'props', family:'vegetation', era:'any', culture:'any', state:'normal', size:'prop', variant:1, priority:1 }),
    asset({ id:'city.props.fence.linear.v01', category:'props', family:'fence', era:'any', culture:'any', state:'normal', size:'linear', variant:1, priority:1 }),
    asset({ id:'city.props.market_stall.small.v01', category:'props', family:'market_stall', era:'any', culture:'common', state:'normal', size:'small', variant:1, priority:1 }),

    asset({ id:'city.ruins.rubble.small.v01', category:'ruins', family:'rubble', era:'any', culture:'any', state:'ruined', size:'small', variant:1, priority:1 }),
    asset({ id:'city.ruins.burned_house.small.v01', category:'ruins', family:'house', era:'stone', culture:'common', state:'ruined', size:'small', variant:1, priority:1 }),
    asset({ id:'city.ruins.monument.large.v01', category:'ruins', family:'monument', era:'classical', culture:'common', state:'ruined', size:'large', variant:1, priority:2 })
  ] as readonly CityAssetEntry[]
} as const;

/**
 * `import.meta.glob` is a build-time macro: the bundler replaces the call with
 * an object literal, and at runtime `import.meta.glob` itself is undefined. A
 * `typeof … === 'function'` guard around it therefore always took the empty
 * branch and threw the resolved URLs away, so no city PNG ever loaded in
 * either renderer. The try/catch keeps the manifest importable from plain Node
 * (tests, tooling), where the call is untransformed and throws.
 */
let CITY_ASSET_URLS: Record<string, string> = {};
try {
  CITY_ASSET_URLS = import.meta.glob('./city/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
} catch { /* no bundler: artwork resolves only inside the app */ }

/** Returns undefined for planned assets whose final PNG has not been added yet. */
export function resolveCityAssetUrl(entry: CityAssetEntry): string | undefined {
  return CITY_ASSET_URLS[entry.source];
}

const CITY_ASSETS_BY_ID = new Map(CITY_ASSET_MANIFEST.assets.map(entry => [entry.id, entry]));

export function cityAssetEntry(id: string): CityAssetEntry | undefined { return CITY_ASSETS_BY_ID.get(id); }

/** Key installed into TextureAtlas when this manifest entry is loaded. */
export function cityAssetAtlasKey(id: string): string | undefined {
  const entry = cityAssetEntry(id);
  return entry ? entry.atlasKey ?? `asset:${entry.id}` : undefined;
}
