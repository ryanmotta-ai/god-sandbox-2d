/**
 * Visual harness for the road renderer.
 *
 * Two scenes. The first is a real generated world with a real surveyed network
 * across it, so the roads on screen are the ones the simulation would build.
 * The second is a purpose-built bench — every grade, a river crossing, a bend,
 * a hillside and a broken surface — because the interesting cases are exactly
 * the ones a random seed will not hand you.
 *
 * Not part of the game; served by vite from scratch/roadview.html.
 */
import { TileMap } from '../src/world/TileMap';
import { TERRAINS, TerrainType } from '../src/world/Biomes';
import { City } from '../src/civ/City';
import { Kingdom, getNextKingdomColor } from '../src/civ/Kingdom';
import { SpeciesType } from '../src/entities/Species';
import { Camera } from '../src/renderer/Camera';
import { PixelRenderer } from '../src/renderer/Renderer';
import { ParticleManager } from '../src/renderer/Particles';
import { WorldEra } from '../src/world/WeatherEras';
import { rng } from '../src/core/Random';
import { surveyRoad, layRoad } from '../src/civ/RoadEngineering';
import type { CaravanType, OverlandCaravan } from '../src/civ/CaravanSystem';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? 20260804);
const particles = new ParticleManager();
const host = document.getElementById('shots')!;

function shot(
  label: string, map: TileMap, cities: Map<string, City>, kingdoms: Map<string, Kingdom>,
  at: { x: number; y: number }, zoom: number, w = 900, h = 560,
  caravans?: OverlandCaravan[]
): void {
  const wrap = document.createElement('div');
  const title = document.createElement('div');
  title.textContent = `${label}  ·  zoom ${zoom}`;
  title.style.cssText = 'font:12px monospace;color:#cbd5e1;padding:8px 0 4px';
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  wrap.append(title, canvas);
  host.append(wrap);

  const camera = new Camera();
  camera.setWorldBounds(map.width, map.height);
  camera.centerOn(at.x, at.y, zoom);
  camera.zoom = zoom;
  camera.targetZoom = zoom;
  new PixelRenderer(canvas).render(camera, map, [], cities, kingdoms, particles, 'none', WorldEra.GOLDEN_AGE, null, null, 1, undefined, caravans);
}

function stockedCity(id: string, name: string, x: number, y: number): City {
  const city = new City(id, name, SpeciesType.HUMAN, x, y, 'Founder', 1);
  city.population = 400;
  city.stock.capacity = 1_000_000;
  city.stock.add('stone', 80_000);
  city.stock.add('wood', 80_000);
  return city;
}

// ============================================================
// Scene 1 — a generated world, with the network the surveyor builds on it
// ============================================================
{
  rng.setSeed(SEED);
  const SIZE = 96;
  const map = new TileMap(SIZE, SIZE, 'single_continent', SEED);
  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < 20000 && sites.length < 7; i++) {
    const x = rng.rangeInt(6, SIZE - 7);
    const y = rng.rangeInt(6, SIZE - 7);
    const t = map.grid[x][y];
    if (TERRAINS[t.type].isWater || !TERRAINS[t.type].isWalkable) continue;
    if (sites.some(s => Math.hypot(s.x - x, s.y - y) < 16)) continue;
    sites.push({ x, y });
  }
  sites.forEach((site, i) => {
    const city = stockedCity(`c${i}`, `City${i}`, site.x, site.y);
    const realm = `k${i % 2}`;
    let kingdom = kingdoms.get(realm);
    if (!kingdom) {
      kingdom = new Kingdom(realm, `Realm${i % 2}`, SpeciesType.HUMAN, getNextKingdomColor(), city.id, 0);
      kingdoms.set(realm, kingdom);
    }
    city.kingdomId = realm;
    kingdom.cityIds.add(city.id);
    cities.set(city.id, city);
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        const t = map.getTile(site.x + dx, site.y + dy);
        if (!t || Math.hypot(dx, dy) > 5) continue;
        t.kingdomId = realm;
        if (Math.hypot(dx, dy) <= 3) t.cityId = city.id;
      }
    }
  });

  const list = [...cities.values()];
  for (let i = 0; i < list.length; i++) {
    for (const j of [(i + 1) % list.length, (i + 3) % list.length]) {
      if (i === j) continue;
      layRoad(list[i], map, surveyRoad(map, list[i].x, list[i].y, list[j].x, list[j].y, 2), 2);
    }
  }
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      if (t.roadLevel > 0 && (x * 13 + y * 7) % 23 === 0) t.roadDamage = 0.35;
    }
  }
  shot('generated world — surveyed network', map, cities, kingdoms, { x: SIZE / 2, y: SIZE / 2 }, 0.8, 900, 620);
  shot('generated world — mid range', map, cities, kingdoms, sites[1], 2.2);
}

// ============================================================
// Scene 2 — the bench: every grade, a river, a bend, a hillside
// ============================================================
{
  rng.setSeed(1);
  const SIZE = 44;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 3);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      // A hillside falling away to the north-west, so cut and fill has
      // something to bite on.
      t.height = 0.45 + x * 0.004 + (y > 24 ? (y - 24) * 0.018 : 0);
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
    }
  }
  // Bands of other ground, so the surfaces show their terrain tint.
  for (let x = 0; x < SIZE; x++) {
    for (let y = 30; y < 36; y++) map.grid[x][y].type = TerrainType.SAND;
    for (let y = 36; y < SIZE; y++) map.grid[x][y].type = TerrainType.SWAMP;
  }
  // A river the full height of the map, three tiles wide, pinched to a single
  // tile at y = 24 — the only ford, and the only cheap way across.
  for (let y = 0; y < SIZE; y++) {
    for (const x of y === 24 ? [21] : [20, 21, 22]) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
  }

  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();
  const west = stockedCity('w', 'Westbank', 4, 12);
  const east = stockedCity('e', 'Eastbank', 39, 12);
  const kw = new Kingdom('kw', 'West', SpeciesType.HUMAN, getNextKingdomColor(), west.id, 0);
  const ke = new Kingdom('ke', 'East', SpeciesType.HUMAN, getNextKingdomColor(), east.id, 0);
  kingdoms.set(kw.id, kw);
  kingdoms.set(ke.id, ke);
  west.kingdomId = kw.id;
  east.kingdomId = ke.id;
  cities.set(west.id, west);
  cities.set(east.id, east);
  // East is industrial, so its imperial roads are asphalt with a centre line
  // while West's are still dressed flagstone — both surfaces on one screen.
  for (const id of ['roads', 'masonry', 'engineering', 'industrialization']) ke.research.complete(id);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) map.grid[x][y].kingdomId = x < 21 ? kw.id : ke.id;
  }
  for (const c of [west, east]) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const t = map.getTile(Math.floor(c.x) + dx, Math.floor(c.y) + dy);
        if (t && Math.hypot(dx, dy) <= 3) t.cityId = c.id;
      }
    }
  }

  // Three grades running the width of the map. The surveyor decides where each
  // one crosses; with the ford at y = 24 it will divert there rather than pay
  // for three tiles of pier.
  for (const [y, grade] of [[8, 1], [14, 2], [20, 3]] as const) {
    layRoad(west, map, surveyRoad(map, 4, y, 39, y, grade), grade);
  }
  // Wide crossings, laid by hand so the long spans are on screen too: nothing
  // in the survey would ever choose these once a ford exists.
  for (const [y, grade] of [[32, 2], [38, 3]] as const) {
    for (let x = 6; x <= 37; x++) {
      const t = map.grid[x][y];
      if (t.roadLevel < grade) t.roadLevel = grade;
    }
  }
  // A road that has to bend and climb across the hillside, a north-south route
  // that makes junctions with the others, and a spur that dies in open country.
  layRoad(west, map, surveyRoad(map, 6, 26, 17, 41, 2), 2);
  layRoad(west, map, surveyRoad(map, 12, 14, 12, 34, 2), 2);
  layRoad(east, map, surveyRoad(map, 30, 20, 34, 28, 1), 1);
  // A stretch that has been fought over.
  for (let x = 24; x < 32; x++) {
    const t = map.grid[x][14];
    if (t.roadLevel > 0) t.roadDamage = 0.55;
  }

  let decks = 0;
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      if (t.roadLevel > 0 && TERRAINS[t.type].isWater) decks++;
    }
  }
  shot(`bench — three grades, ${decks} bridge decks, a frontier and a hillside`, map, cities, kingdoms, { x: 22, y: 22 }, 1.6, 900, 760);
  shot('bench — the ford and the wide spans, close', map, cities, kingdoms, { x: 21, y: 28 }, 4.0, 900, 620);
  shot('bench — surfaces and wear, close', map, cities, kingdoms, { x: 29, y: 15 }, 4.5, 900, 560);
}

// ============================================================
// Scene 3 — the bridge catalogue: every model, at the span and era that
// actually produces it, so each can be judged next to the others.
// ============================================================
{
  const SIZE = 52;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 5);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.temperature = 18;
      t.moisture = 0.5;
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
    }
  }

  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();
  const ancient = new Kingdom('anc', 'Ancient', SpeciesType.HUMAN, getNextKingdomColor(), 'anc_c', 0);
  const modern = new Kingdom('mod', 'Modern', SpeciesType.HUMAN, getNextKingdomColor(), 'mod_c', 0);
  for (const id of ['roads', 'masonry', 'engineering', 'industrialization']) modern.research.complete(id);
  kingdoms.set(ancient.id, ancient);
  kingdoms.set(modern.id, modern);

  /**
   * One crossing per row: a river of the given width, a road of the given
   * grade over it, and the realm whose era decides how it gets built.
   */
  const rows: { y: number; width: number; grade: number; realm: Kingdom; cold?: boolean; label: string }[] = [
    { y: 4, width: 1, grade: 1, realm: ancient, label: 'ford' },
    { y: 10, width: 3, grade: 1, realm: ancient, label: 'timber trestle' },
    { y: 16, width: 3, grade: 1, realm: ancient, cold: true, label: 'covered' },
    { y: 22, width: 2, grade: 2, realm: ancient, label: 'stone arch' },
    { y: 28, width: 5, grade: 2, realm: ancient, label: 'viaduct' },
    { y: 34, width: 4, grade: 3, realm: ancient, label: 'imperial' },
    { y: 40, width: 2, grade: 3, realm: modern, label: 'iron truss' },
    { y: 46, width: 5, grade: 3, realm: modern, label: 'suspension' }
  ];
  for (const row of rows) {
    const from = Math.floor((SIZE - row.width) / 2);
    for (let x = 0; x < SIZE; x++) {
      const t = map.grid[x][row.y];
      t.roadLevel = row.grade;
      t.kingdomId = row.realm.id;
      if (row.cold) { t.temperature = -6; t.moisture = 0.85; }
      map.grid[x][row.y - 1].kingdomId = row.realm.id;
      map.grid[x][row.y + 1].kingdomId = row.realm.id;
    }
    for (let x = from; x < from + row.width; x++) {
      map.grid[x][row.y].type = TerrainType.SHALLOW_WATER;
      for (let y = 0; y < SIZE; y++) if (Math.abs(y - row.y) <= 2) map.grid[x][y].type = TerrainType.SHALLOW_WATER;
    }
  }
  shot(`bridge catalogue — ${rows.map(r => r.label).join(', ')}`, map, cities, kingdoms, { x: 26, y: 25 }, 1.9, 900, 1560);
  shot('catalogue close — ford, timber, covered', map, cities, kingdoms, { x: 26, y: 10 }, 4.2, 900, 760);
  shot('catalogue close — arch, viaduct, imperial', map, cities, kingdoms, { x: 26, y: 28 }, 4.2, 900, 760);
  shot('catalogue close — truss, suspension', map, cities, kingdoms, { x: 26, y: 43 }, 4.2, 900, 620);
}

// ============================================================
// Scene 4 — a great bridge: the crossing wide enough to be named
// ============================================================
{
  const SIZE = 40;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 9);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.roadDamage = 0;
      t.buildingId = null;
      t.cityId = null;
      t.kingdomId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
      t.bridgeName = null;
    }
  }
  // An estuary six tiles across: no ford anywhere, no way round.
  for (let y = 0; y < SIZE; y++) for (let x = 17; x <= 22; x++) map.grid[x][y].type = TerrainType.SHALLOW_WATER;

  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();
  const seat = stockedCity('gb', 'Aurelia', 5, 20);
  const realm = new Kingdom('gbk', 'Aurelian', SpeciesType.HUMAN, getNextKingdomColor(), seat.id, 0);
  kingdoms.set(realm.id, realm);
  seat.kingdomId = realm.id;
  cities.set(seat.id, seat);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) map.grid[x][y].kingdomId = realm.id;

  const survey = surveyRoad(map, 5, 20, 35, 20, 2);
  const works = layRoad(seat, map, survey, 2);
  // The engine names the crossing on opening; do the same here so the label
  // the renderer draws is on screen.
  for (const crossing of works.greatCrossings) {
    for (const t of crossing.tiles) t.bridgeName = `the Great Bridge of ${seat.name}`;
  }
  shot(`great bridge — ${works.greatCrossings.length} public work, ${Math.round(works.spent.stone)} stone`,
    map, cities, kingdoms, { x: 20, y: 20 }, 2.6, 900, 620);
  shot('great bridge — close', map, cities, kingdoms, { x: 20, y: 20 }, 4.6, 900, 620);
}

// ============================================================
// Scene 5 — territory: several realms meeting on varied ground, so the
// frontier can be judged for contrast against grass, sand, snow and water
// ============================================================
{
  rng.setSeed(77);
  const SIZE = 72;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 77);
  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();

  // Four realms grown as Voronoi cells from four seats, so the frontiers
  // between them are irregular the way real ones are.
  const seats: { x: number; y: number }[] = [
    { x: 22, y: 22 }, { x: 50, y: 20 }, { x: 24, y: 50 }, { x: 52, y: 52 }
  ];
  seats.forEach((seat, i) => {
    const city = stockedCity(`t${i}`, `Seat${i}`, seat.x, seat.y);
    const kingdom = new Kingdom(`tk${i}`, `Realm ${i + 1}`, SpeciesType.HUMAN, getNextKingdomColor(), city.id, 0);
    kingdoms.set(kingdom.id, kingdom);
    city.kingdomId = kingdom.id;
    kingdom.cityIds.add(city.id);
    cities.set(city.id, city);
  });
  const realmIds = [...kingdoms.keys()];
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      if (TERRAINS[t.type].isWater) continue;
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < seats.length; i++) {
        // A little noise on the metric keeps the borders from being straight
        // bisectors, which no frontier in history has ever been.
        const wobble = Math.sin(x * 0.21 + i * 2.3) * 3 + Math.cos(y * 0.19 + i) * 3;
        const d = Math.hypot(seats[i].x - x, seats[i].y - y) + wobble;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (bestD > 30) continue; // unclaimed marches beyond the reach of any seat
      t.kingdomId = realmIds[best];
      if (Math.hypot(seats[best].x - x, seats[best].y - y) <= 3) t.cityId = `t${best}`;
    }
  }
  shot('territory — four realms, whole map', map, cities, kingdoms, { x: SIZE / 2, y: SIZE / 2 }, 1.0, 900, 700);
  shot('territory — a frontier, mid range', map, cities, kingdoms, { x: 36, y: 36 }, 2.6, 900, 620);
  shot('territory — a frontier, close', map, cities, kingdoms, { x: 36, y: 30 }, 5.0, 900, 560);
}

// ============================================================
// Scene 6 — expansion: the same renderer sees the border move, which is the
// only way to exercise the flare (a fresh renderer has nothing to compare to)
// ============================================================
{
  rng.setSeed(5);
  const SIZE = 30;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 5);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.kingdomId = null;
      t.cityId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
    }
  }
  const cities = new Map<string, City>();
  const kingdoms = new Map<string, Kingdom>();
  const seat = stockedCity('ex', 'Marchford', 8, 15);
  const realm = new Kingdom('exk', 'The March', SpeciesType.HUMAN, getNextKingdomColor(), seat.id, 0);
  kingdoms.set(realm.id, realm);
  seat.kingdomId = realm.id;
  cities.set(seat.id, seat);
  const claim = (radius: number): void => {
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        if (Math.hypot(x - 8, y - 15) <= radius) map.grid[x][y].kingdomId = realm.id;
      }
    }
  };

  const host = document.getElementById('shots')!;
  const title = document.createElement('div');
  title.textContent = 'expansion — before, the frame it is taken, and settling';
  title.style.cssText = 'font:12px monospace;color:#cbd5e1;padding:8px 0 4px';
  host.append(title);
  const strip = document.createElement('div');
  strip.style.cssText = 'display:flex;gap:8px';
  host.append(strip);

  // One renderer across all three frames, since the flare is a comparison
  // against what the same renderer saw last time.
  const canvases: HTMLCanvasElement[] = [];
  const camera = new Camera();
  camera.setWorldBounds(SIZE, SIZE);
  camera.centerOn(12, 15, 3.0);
  camera.zoom = 3.0;
  camera.targetZoom = 3.0;
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas');
    c.width = 292;
    c.height = 400;
    strip.append(c);
    canvases.push(c);
  }
  // Every frame must go through one renderer to share its memory of ownership,
  // so each frame is drawn on a shared surface and copied out.
  const stage = document.createElement('canvas');
  stage.width = 292;
  stage.height = 400;
  const shared = new PixelRenderer(stage);
  const frame = (into: HTMLCanvasElement): void => {
    shared.render(camera, map, [], cities, kingdoms, particles, 'none', WorldEra.GOLDEN_AGE, null, null, 1);
    into.getContext('2d')!.drawImage(stage, 0, 0);
  };
  claim(5);
  frame(canvases[0]);      // settled
  claim(9);
  frame(canvases[1]);      // the frame the land is taken
  for (let i = 0; i < 25; i++) shared.render(camera, map, [], cities, kingdoms, particles, 'none', WorldEra.GOLDEN_AGE, null, null, 1);
  frame(canvases[2]);      // fading back down
}

// ============================================================
// Scene 7 — caravans on the road at map scale, one heading each way, so the
// facing and the mirroring can be checked through the real render path
// ============================================================
{
  rng.setSeed(11);
  const SIZE = 26;
  const map = new TileMap(SIZE, SIZE, 'single_continent', 11);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const t = map.grid[x][y];
      t.type = TerrainType.GRASS;
      t.height = 0.5;
      t.roadLevel = 0;
      t.kingdomId = null;
      t.cityId = null;
      t.resourceType = null;
      t.resourceAmount = 0;
    }
  }
  // A cross of roads, so there is a road running each way to walk along.
  for (let i = 2; i < SIZE - 2; i++) {
    map.grid[i][13].roadLevel = 2;
    map.grid[13][i].roadLevel = 2;
  }

  const caravans: OverlandCaravan[] = [];
  const kinds: CaravanType[] = ['donkey', 'camel', 'cart'];
  // One of each kind walking each of the four ways.
  const headings: [number, number][] = [[1, 0], [-1, 0], [0, -1], [0, 1]];
  kinds.forEach((kind, k) => {
    headings.forEach(([hx, hy], h) => {
      const along = 4 + h * 5;
      caravans.push({
        id: `c${k}${h}`, routeId: 'r', fromKingdomId: '', toKingdomId: '',
        fromCityName: '', toCityName: '',
        startX: 0, startY: 0, endX: 0, endY: 0,
        x: hy === 0 ? along : 13 - 3 + k * 3,
        y: hy === 0 ? 13 - 3 + k * 3 : along,
        progress: 0.1 + k * 0.08, direction: 1, caravanType: kind,
        cargo: 'grain' as never, cargoAmount: 10, kingdomColor: '#fbbf24',
        speed: 0.001, routeTiles: 20, headingX: hx, headingY: hy
      });
    });
  });

  shot('caravans — each kind, each heading, at map scale', map, new Map(), new Map(), { x: 13, y: 13 }, 3.0, 900, 700, caravans);
  shot('caravans — close', map, new Map(), new Map(), { x: 9, y: 12 }, 6.0, 900, 500, caravans);
}

document.title = 'roads ready';
(window as unknown as { roadsReady: boolean }).roadsReady = true;
