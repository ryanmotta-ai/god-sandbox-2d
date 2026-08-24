import type { BuildingType } from './Building';
import type { City } from './City';
import type { Kingdom } from './Kingdom';
import type { DistrictAffinity, UrbanStreetClass, UrbanGrowthStage } from './UrbanPlanner';
import type { TileMap } from '../world/TileMap';
import { TERRAINS, TerrainType } from '../world/Biomes';
import { hashString } from '../core/Random';

/**
 * What a settlement is trying to become.
 *
 * A city grown purely out of tile scores is a heap of roofs. Every building
 * lands on the locally best tile, every local best is a slightly different
 * compromise, and nothing ever adds up to a street, a square or a quarter —
 * measured over grown cities the result was a quarter of the ground built on,
 * forty road tiles for sixty-three buildings, and no shape a player could read.
 *
 * So the shape is drawn by hand, up front. Each blueprint below is a literal
 * picture of a town: one character per tile, avenues and squares and terraces
 * and fields, laid out the way a plan is laid out. The simulation still decides
 * *whether* a settlement can afford a market and *when*; the plan only says
 * where the market goes when it comes, and what the ground either side of it is
 * being kept for.
 *
 * Three things keep this from being a rubber stamp:
 *
 *  - The plan is advice, not law. A plot is worth a large bonus to the building
 *    it was drawn for and a penalty to one it was not, but terrain, resources
 *    and economics still win. A plan is what a city is aiming at, not a promise
 *    about what it becomes.
 *  - Every city picks its own orientation out of eight, and picks it by fitting
 *    the drawing to the ground actually under it: the quay turned toward the
 *    water, the dense core away from the crags. Two cities on one plan are the
 *    same town read in different directions, not the same screenshot twice.
 *  - The plan reaches fifteen tiles. Beyond that, and anywhere the drawing has
 *    no opinion, the procedural planner keeps working exactly as it did.
 *
 * Nothing here is serialized except the id and the orientation, which are two
 * numbers on the City.
 */

// ============================================================
// THE ALPHABET
// ============================================================

/**
 * One character, one tile. Deliberately short and mnemonic: these tables get
 * read while looking at the drawings below, and a legend you have to scroll
 * away from to decode is a legend nobody checks their plan against.
 *
 *   '.'  open ground — a yard, a garden, a green. No plot, no street.
 *   '~'  water is expected here. This is how a plan aims itself at a coast.
 *   '#'  avenue  — primary
 *   'X'  square  — primary paving, kept deliberately empty. A plaza.
 *   '+'  street  — secondary
 *   ','  lane    — secondary, and only once the place is a village
 *   'K'  the seat: town hall. Always the centre tile; see below.
 *   'C'  civic and monumental — palace, monument, colosseum, great library
 *   'T'  temple, library, academy
 *   'M'  market, bank, exchange
 *   'H'  grand housing — the good address
 *   'h'  housing
 *   'g'  granary and stores
 *   'w'  workshop and smithy
 *   'I'  heavy industry
 *   'P'  quay — harbour and port. Wants real coast under it.
 *   'B'  barracks and gate towers
 *   'f'  farmland
 */
export interface BlueprintPlot {
  readonly affinity: DistrictAffinity;
  /** Exact types this plot was drawn for. Anything else is a compromise. */
  readonly prefer: readonly BuildingType[];
  /** 1..10. Scales both the reward for getting it right and the cost of not. */
  readonly importance: number;
  /** Only a plot marked coastal is expected to sit against open water. */
  readonly coastal?: boolean;
}

const PLOTS: Record<string, BlueprintPlot> = {
  K: { affinity: 'civic', prefer: ['town_center', 'palace'], importance: 10 },
  C: { affinity: 'civic', prefer: ['palace', 'monument', 'colosseum', 'great_library'], importance: 9 },
  T: { affinity: 'knowledge', prefer: ['temple', 'library', 'academy'], importance: 8 },
  M: { affinity: 'commercial', prefer: ['market', 'bank', 'stock_exchange', 'collective'], importance: 8 },
  H: { affinity: 'residential', prefer: ['house', 'aqueduct', 'grand_aqueduct'], importance: 6 },
  h: { affinity: 'residential', prefer: ['house'], importance: 4 },
  g: { affinity: 'residential', prefer: ['granary', 'aqueduct'], importance: 4 },
  w: { affinity: 'industrial', prefer: ['workshop', 'smithy'], importance: 6 },
  I: { affinity: 'industrial', prefer: ['factory', 'refinery'], importance: 7 },
  P: { affinity: 'logistics', prefer: ['harbor', 'port'], importance: 9, coastal: true },
  B: { affinity: 'military', prefer: ['barracks', 'keep'], importance: 6 },
  f: { affinity: 'agricultural', prefer: ['farm', 'pasture'], importance: 3 }
};

/**
 * `minStage` is when a street becomes *reserved*, not when it gets paved —
 * paving is the engine's own slow business, a tile or two a year out of the
 * city's stores. The working grid is reserved from the first hut, because a
 * plan whose streets only appear at village stage is a plan whose streets have
 * already been built on: the first dozen cottages take the plaza and the
 * corners, and the grid arrives full of holes it can never close. Only the
 * outermost lanes wait, since a camp has no business reserving ground eleven
 * tiles out that it may never reach.
 */
const STREETS: Record<string, { streetClass: UrbanStreetClass; minStage: UrbanGrowthStage }> = {
  '#': { streetClass: 'primary', minStage: 'camp' },
  X: { streetClass: 'primary', minStage: 'camp' },
  '+': { streetClass: 'secondary', minStage: 'camp' },
  ',': { streetClass: 'secondary', minStage: 'village' }
};

const STAGE_ORDER: Record<UrbanGrowthStage, number> = { camp: 0, village: 1, city: 2, great_city: 3 };

// ============================================================
// THE DRAWINGS
// ============================================================

/**
 * Every plan is 31 rows of 31 characters centred on the settlement's own tile,
 * so row 15 column 15 is the town centre and the plan reaches fifteen tiles in
 * each direction. Both measurements are checked when the module loads: a plan
 * that does not measure up throws, rather than quietly shifting somebody's city
 * one tile sideways.
 *
 * Two rules govern every drawing, and both come from the renderer rather than
 * from taste.
 *
 * The first is clearance. `hasVisualClearance` in the planner keeps big
 * buildings off each other's silhouettes: a sprite four tiles across carries
 * its roof over the tile in front, so two of them touching means one is hidden.
 * Everything from a temple upward is subject to it — and so is any small
 * building standing next to one. So the big plots ('K', 'C', 'T', 'M', 'I',
 * 'B', 'P') are drawn as *pavilions*: one plot with a ring of square, street or
 * garden around it, two tiles from the next pavilion. Everything small ('h',
 * 'H', 'g', 'w', 'f' — houses, terraces, granaries, workshops, fields, all
 * sprites the rule ignores) packs solid against itself in between. Draw a
 * temple shoulder to shoulder with a row of cottages and you do not get a dense
 * city; you get a temple that is never built, because every candidate tile
 * fails clearance and the plan quietly loses it.
 *
 * The second is that `new City()` raises the town hall on the settlement's own
 * tile before any planner runs. So the centre of every drawing is 'K' inside a
 * ring of square. That ring is not decoration: without it the hall would refuse
 * every neighbour and leave a ragged hole where the middle of the town should
 * be, and the avenues would meet on an occupied tile and never join up.
 *
 * The third is frontage. Only a tile with a street *touching* it counts as
 * having an address; a plot two tiles back from the kerb is scored as isolated
 * and gets a lane surveyed out to it instead. So the blocks are drawn small
 * enough that their whole perimeter fronts something — five across, with the
 * middle left as a courtyard, which is what an insula is anyway. The first
 * draft of these plans put five-wide housing blocks against a single street and
 * three quarters of the plots came out addressless.
 */
const PLAN_SIZE = 31;
const PLAN_RADIUS = (PLAN_SIZE - 1) / 2;

/**
 * A Roman colonia. The cardo and the decumanus are the two primary streets
 * framing the forum rather than cutting through it, so the forum is a closed
 * precinct off the great crossing: town hall at its heart, the four monuments
 * on its corners, paved cross reaching all four gates. Temples in a garden
 * quarter to the north, the money west, the good addresses east, foundries and
 * barracks downwind to the south, ordinary terraces packed into the corners,
 * fields beyond the ring.
 */
const IMPERIAL_GRID_PLAN = [
  '...............................',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................',
  '......+++++++++#+++++++++......',
  '......+hhhhh+..#..+hhhhh+......',
  '......+h...h+T.#.T+h...h+......',
  '......+h...h+..#..+h...h+......',
  '......+h...h+T.#.T+h...h+......',
  '......+hhhhh+..#..+hhhhh+......',
  '......+++++++++#+++++++++......',
  '......+.M.M.+C.#.C+HHHHH+......',
  '......+.....+.X#X.+HHHHH+......',
  '......#########K#########......',
  '......+.....+.X#X.+HHHHH+......',
  '......+.M.M.+C.#.C+HHHHH+......',
  '......+++++++++#+++++++++......',
  '......+wwwww+..#..+ggggg+......',
  '......+w...w+I.#.I+g...g+......',
  '......+w...w+..#..+g...g+......',
  '......+h...h+B.#.B+h...h+......',
  '......+hhhhh+..#..+hhhhh+......',
  '......+++++++++#+++++++++......',
  '...............................',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................'
];

/**
 * A fortress town. No avenues running out to the horizon — four gate roads and
 * two square ring walls' worth of street, tightening onto a keep in the middle
 * of its own bailey. The wards between the rings are packed solid, because
 * ground inside a wall is the most expensive ground there is, and the towers
 * take the outer corners where a wall wants them. The guild pavilions face the
 * west gate, the noble terraces hold the east, and the forges are pushed into
 * the southern ward with the yards they need.
 */
const CONCENTRIC_CITADEL_PLAN = [
  '...............................',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................',
  '......+++++++++#+++++++++......',
  '......+B.hhhhhh#hhhhhh.B+......',
  '......+..hhhhhh#hhhhhh..+......',
  '......+..++++++#++++++..+......',
  '......+hh+.T.T.#.T.T.+hh+......',
  '......+hh+.....#.....+hh+......',
  '......+hh+..+++#+++..+hh+......',
  '......+hh+.M+C.X.C+M.+hh+......',
  '......+hh+..+.XXX.+..+hh+......',
  '......#######XXKXX#######......',
  '......+hh+..+.XXX.+..+hh+......',
  '......+hh+.M+C.X.C+M.+hh+......',
  '......+hh+..+++#+++..+hh+......',
  '......+hh+.....#.....+hh+......',
  '......+hh+.I.I.#.I.I.+hh+......',
  '......+..++++++#++++++..+......',
  '......+..wwwwww#wwwwww..+......',
  '......+B.wwwwww#wwwwww.B+......',
  '......+++++++++#+++++++++......',
  '...............................',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................'
];

/**
 * A port, which is the same colonia read from the water. Northern half is the
 * town proper; where the imperial plan would put its southern terraces this one
 * puts three blocks of warehousing, then the promenade, then a row of berths
 * standing in the shallows with a tile of water between each one. The bay is
 * drawn in, which is what lets a city turn the whole plan until its quay faces
 * the sea.
 */
const MARITIME_HAVEN_PLAN = [
  '...............................',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................',
  '......+++++++++#+++++++++......',
  '......+hhhhh+..#..+hhhhh+......',
  '......+h...h+T.#.T+h...h+......',
  '......+h...h+..#..+h...h+......',
  '......+h...h+T.#.T+h...h+......',
  '......+hhhhh+..#..+hhhhh+......',
  '......+++++++++#+++++++++......',
  '......+.M.M.+C.#.C+HHHHH+......',
  '......+.....+.X#X.+HHHHH+......',
  '......#########K#########......',
  '......+.....+.X#X.+HHHHH+......',
  '......+.M.M.+C.#.C+HHHHH+......',
  '......+++++++++#+++++++++......',
  '......+ggggg+gg#gg+ggggg+......',
  '......+ggggg+gg#gg+ggggg+......',
  '......+++++++++#+++++++++......',
  '.......P.P.P.P.P.P.P.P.P.......',
  '.....~~~~~~~~~~~~~~~~~~~~~.....',
  '....~~~~~~~~~~~~~~~~~~~~~~~....',
  '...~~~~~~~~~~~~~~~~~~~~~~~~~...',
  '..~~~~~~~~~~~~~~~~~~~~~~~~~~~..',
  '..~~~~~~~~~~~~~~~~~~~~~~~~~~~..',
  '...~~~~~~~~~~~~~~~~~~~~~~~~~...',
  '....~~~~~~~~~~~~~~~~~~~~~~~....',
  '.....~~~~~~~~~~~~~~~~~~~~~.....'
];

/**
 * A woodland village that grew along one road. Deliberately the sparsest of the
 * five: a single lane through, four loose groups of cottages set back from it
 * behind their own side streets, orchards worked into the gaps, and in the
 * middle a fenced green with the sanctuary and the meeting hall standing in it.
 * What matters in this one is the ground left empty between the houses.
 */
const SYLVAN_AVENUES_PLAN = [
  '...............................',
  '.......ff...ff...ff...ff.......',
  '.......ff...ff...ff...ff.......',
  '...............................',
  '...............#...............',
  '...............#...............',
  '...............#...............',
  '...............#...............',
  '........+++++++#+++++++........',
  '........+hhhhhh#hhhhhh+........',
  '........+h....h#h....h+........',
  '........+h....h#h....h+........',
  '........+h.T..h#h.T..h+........',
  '........+h....h#h....h+........',
  '........+hhhhhX#Xhhhhh+........',
  '....###########K###########....',
  '........+wwwwwX#Xhhhhh+........',
  '........+w....h#h....h+........',
  '........+w.C..h#h.M..h+........',
  '........+w....h#h....h+........',
  '........+wwwwww#hhhhhh+........',
  '........+ffffff#ffffff+........',
  '........+++++++#+++++++........',
  '...............#...............',
  '...............#...............',
  '...............#...............',
  '...............................',
  '.......ff...ff...ff...ff.......',
  '.......ff...ff...ff...ff.......',
  '...............................',
  '...............................'
];

/**
 * A works town of the rail age, and the one plan built out of rows rather than
 * blocks. One broad spine street with the station square on it, and the whole
 * town laid out as long back-to-back terraces running the full width of it
 * between service streets — seventeen tiles deep, because the terrace is the
 * entire point of this plan. Civic pavilions stand in the two rows either side
 * of the station, the works and the goods yard take everything south of it.
 */
const INDUSTRIAL_BASTION_PLAN = [
  '...............................',
  '.......fffff.fffff.fffff.......',
  '...............................',
  '...............................',
  '.......++++++++#++++++++.......',
  '.......hhhhhhhh#hhhhhhhh.......',
  '.......hhhhhhhh#hhhhhhhh.......',
  '.......++++++++#++++++++.......',
  '.......HHHHHHHH#HHHHHHHH.......',
  '.......HHHHHHHH#HHHHHHHH.......',
  '.......++++++++#++++++++.......',
  '.......hhhh...h#h...hhhh.......',
  '........hhh.T.h#h.T.hhh........',
  '........hhh...h#h...hhh........',
  '........MMM...XXX...MMM........',
  '.#############XKX#############.',
  '........MMM.C.XXX.C.MMM........',
  '........hhh...h#h...hhh........',
  '.......++++++++#++++++++.......',
  '.......wwwwwwww#wwwwwwww.......',
  '.......wwwwwwww#wwwwwwww.......',
  '.......++++++++#++++++++.......',
  '.......wwww.I.w#w.I.wwww.......',
  '.......wwww...w#w...wwww.......',
  '.......++++++++#++++++++.......',
  '.......gggg.B.g#g.B.gggg.......',
  '.......gggg...g#g...gggg.......',
  '.......++++++++#++++++++.......',
  '...............................',
  '.......fffff.fffff.fffff.......',
  '...............................'
];

// ============================================================
// THE CATALOG
// ============================================================

export type PavingStyle = 'marble' | 'cobblestone' | 'timber' | 'flagstone' | 'brick';
export type FoliagePattern = 'cypress' | 'oak' | 'palm' | 'evergreen' | 'willow';

export interface CityBlueprint {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly icon: string;
  readonly accentColor: string;
  readonly idealTerrain: 'plains' | 'mountain' | 'coastal' | 'forest' | 'any';
  readonly pavingStyle: PavingStyle;
  readonly foliagePattern: FoliagePattern;
  readonly plazaRadius: number;
  /** The drawing, exactly as written above. Read by the tests and diagnostics. */
  readonly plan: readonly string[];
  /** True when the plan draws water, and so cares which way it faces. */
  readonly wantsCoast: boolean;
}

function plan(data: Omit<CityBlueprint, 'wantsCoast'>): CityBlueprint {
  if (data.plan.length !== PLAN_SIZE) {
    throw new Error(`blueprint ${data.id}: ${data.plan.length} rows, expected ${PLAN_SIZE}`);
  }
  for (let row = 0; row < data.plan.length; row++) {
    if (data.plan[row].length !== PLAN_SIZE) {
      throw new Error(`blueprint ${data.id}: row ${row} is ${data.plan[row].length} chars, expected ${PLAN_SIZE}`);
    }
    for (const char of data.plan[row]) {
      if (char !== '.' && char !== '~' && !PLOTS[char] && !STREETS[char]) {
        throw new Error(`blueprint ${data.id}: row ${row} uses unknown character '${char}'`);
      }
    }
  }
  if (data.plan[PLAN_RADIUS][PLAN_RADIUS] !== 'K') {
    throw new Error(`blueprint ${data.id}: centre tile is '${data.plan[PLAN_RADIUS][PLAN_RADIUS]}', expected the town hall 'K'`);
  }
  assertStreetsConnect(data.id, data.plan);
  return { ...data, wantsCoast: data.plan.some(row => row.includes('~')) };
}

/**
 * Every drawn street has to be reachable from the town hall's square, walking
 * only on streets and only through edges — never corners.
 *
 * This is not tidiness. `paveStreetPlan` lays one tile at a time and will only
 * lay a tile that already touches paved ground, so a street the walk cannot
 * reach is a street that can never be built: it sits in the plan forever, a
 * permanent hole in the grid, and every building along it gets a bespoke lane
 * surveyed across town instead. A works-town plan shipped exactly that bug —
 * seven service streets with a row of cottages between them and the spine — and
 * it cost that plan four fifths of its roads before anyone noticed. Diagonals
 * do not count, because a road does not.
 */
function assertStreetsConnect(id: string, rows: readonly string[]): void {
  const isStreet = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < PLAN_SIZE && y < PLAN_SIZE && !!STREETS[rows[y][x]];
  const total = rows.reduce((sum, row) => sum + [...row].filter(char => STREETS[char]).length, 0);
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = PLAN_RADIUS + dx, y = PLAN_RADIUS + dy;
    if (isStreet(x, y)) { seen.add(y * PLAN_SIZE + x); queue.push([x, y]); }
  }
  if (queue.length === 0) throw new Error(`blueprint ${id}: the town hall has no street or square beside it`);
  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = ny * PLAN_SIZE + nx;
      if (!isStreet(nx, ny) || seen.has(key)) continue;
      seen.add(key); queue.push([nx, ny]);
    }
  }
  if (seen.size !== total) {
    const orphans: string[] = [];
    for (let y = 0; y < PLAN_SIZE; y++) for (let x = 0; x < PLAN_SIZE; x++) {
      if (isStreet(x, y) && !seen.has(y * PLAN_SIZE + x)) orphans.push(`${x - PLAN_RADIUS},${y - PLAN_RADIUS}`);
    }
    throw new Error(
      `blueprint ${id}: ${total - seen.size} of ${total} street tiles cannot be reached from the town hall — ` +
      `they can never be paved. First few: ${orphans.slice(0, 8).join(' ')}`
    );
  }
}

export const CITY_BLUEPRINTS: Record<string, CityBlueprint> = {
  imperial_grid: plan({
    id: 'imperial_grid',
    name: 'Grade Imperial Augusta',
    subtitle: 'Cardo, Decumanus e Fórum',
    description: 'As duas ruas maiores emolduram o fórum em vez de cortá-lo, então o fórum é um recinto fechado ao lado do grande cruzamento: a prefeitura no coração, os quatro monumentos nos cantos, o mármore alcançando os quatro portões. Templos ao norte, dinheiro a oeste, bons endereços a leste, fundições ao sul.',
    icon: 'city',
    accentColor: '#f59e0b',
    idealTerrain: 'plains',
    pavingStyle: 'marble',
    foliagePattern: 'cypress',
    plazaRadius: 2,
    plan: IMPERIAL_GRID_PLAN
  }),
  concentric_citadel: plan({
    id: 'concentric_citadel',
    name: 'Cidadela Concêntrica',
    subtitle: 'Anéis de Pedra e Torreão',
    description: 'Sem avenidas até o horizonte: quatro estradas de portão e dois anéis quadrados de rua, fechando sobre um torreão no meio do próprio pátio. Os bairros entre os anéis são maciços, porque terra dentro da muralha é a terra mais cara que existe, e as torres ficam nos cantos externos, onde uma muralha as quer.',
    icon: 'castle',
    accentColor: '#94a3b8',
    idealTerrain: 'mountain',
    pavingStyle: 'cobblestone',
    foliagePattern: 'oak',
    plazaRadius: 2,
    plan: CONCENTRIC_CITADEL_PLAN
  }),
  maritime_haven: plan({
    id: 'maritime_haven',
    name: 'Metrópole Portuária',
    subtitle: 'Cais, Calçadão e Armazéns',
    description: 'A mesma colônia lida a partir da água. A metade norte é a cidade; onde o plano imperial poria suas fileiras do sul, este põe três quadras de armazém, depois o calçadão, depois uma fileira de atracadouros dentro do raso. A baía está desenhada no plano — é o que permite virar a cidade inteira até o cais encarar o mar.',
    icon: 'harbor',
    accentColor: '#0ea5e9',
    idealTerrain: 'coastal',
    pavingStyle: 'timber',
    foliagePattern: 'palm',
    plazaRadius: 2,
    plan: MARITIME_HAVEN_PLAN
  }),
  sylvan_avenues: plan({
    id: 'sylvan_avenues',
    name: 'Vila Bucólica dos Bosques',
    subtitle: 'Uma Estrada e Quatro Clareiras',
    description: 'De propósito o mais vazio dos cinco: uma estrada só, quatro grupos soltos de casas recuados atrás das próprias ruelas, pomares nos vãos e, no meio, um largo cercado com o santuário e a casa de reuniões de pé nele. O que importa neste é o chão que fica vazio entre as casas.',
    icon: 'leaf',
    accentColor: '#10b981',
    idealTerrain: 'forest',
    pavingStyle: 'flagstone',
    foliagePattern: 'willow',
    plazaRadius: 1,
    plan: SYLVAN_AVENUES_PLAN
  }),
  industrial_bastion: plan({
    id: 'industrial_bastion',
    name: 'Baluarte Fabril a Vapor',
    subtitle: 'Espinha Ferroviária e Vilas Operárias',
    description: 'O único plano feito de fileiras em vez de quadras. Uma espinha larga com a praça da estação, e a cidade toda disposta em vilas operárias corridas de dezessete de largura entre ruas de serviço, porque a fileira é o ponto inteiro deste plano. Os pavilhões civis ficam nas duas fileiras ao lado da estação; as fábricas e o pátio de cargas ficam com tudo ao sul.',
    icon: 'building',
    accentColor: '#f97316',
    idealTerrain: 'any',
    pavingStyle: 'brick',
    foliagePattern: 'evergreen',
    plazaRadius: 2,
    plan: INDUSTRIAL_BASTION_PLAN
  })
};

export const ALL_BLUEPRINT_IDS = Object.keys(CITY_BLUEPRINTS);

export function getCityBlueprint(id: string): CityBlueprint {
  return CITY_BLUEPRINTS[id] ?? CITY_BLUEPRINTS.imperial_grid;
}

// ============================================================
// ORIENTATION
// ============================================================

/**
 * Eight readings of one drawing: four quarter turns, each optionally mirrored.
 * The transform runs on the offset from the town centre rather than on the plan
 * itself, so a rotated city costs no memory and no setup — it is the same
 * thirty-one strings, indexed differently.
 */
function toPlanOffset(dx: number, dy: number, orientation: number): { px: number; py: number } {
  let x = dx, y = dy;
  if (orientation & 4) x = -x;
  switch (orientation & 3) {
    case 1: { const swap = x; x = -y; y = swap; break; }
    case 2: { x = -x; y = -y; break; }
    case 3: { const swap = x; x = y; y = -swap; break; }
  }
  return { px: x + PLAN_RADIUS, py: y + PLAN_RADIUS };
}

function orientationOf(city: City): number {
  // A city founded before orientations existed reads its plan straight, which
  // is a perfectly good plan. Anything cleverer would re-plan old saves.
  return city.blueprintRotation & 7;
}

function planCharAt(blueprint: CityBlueprint, dx: number, dy: number, orientation: number): string {
  if (Math.abs(dx) > PLAN_RADIUS || Math.abs(dy) > PLAN_RADIUS) return '.';
  const { px, py } = toPlanOffset(dx, dy, orientation);
  return blueprint.plan[py][px];
}

/**
 * Turns the drawing to suit the ground.
 *
 * Scored on the things that actually ruin a plan: a quay facing a field, a
 * dense quarter dropped on a crag, a sea drawn over dry land. A port plan will
 * refuse seven orientations to find the one with its berths in the water, which
 * is the entire reason this exists — a harbour district facing inland is worse
 * than having no plan at all.
 */
export function chooseOrientation(blueprint: CityBlueprint, tileMap: TileMap, cx: number, cy: number): number {
  let best = 0, bestScore = -Infinity;
  for (let orientation = 0; orientation < 8; orientation++) {
    let score = 0;
    for (let dy = -PLAN_RADIUS; dy <= PLAN_RADIUS; dy++) {
      for (let dx = -PLAN_RADIUS; dx <= PLAN_RADIUS; dx++) {
        const char = planCharAt(blueprint, dx, dy, orientation);
        if (char === '.') continue;
        const x = cx + dx, y = cy + dy;
        const tile = tileMap.getTile(x, y);
        const water = !tile || TERRAINS[tile.type].isWater;
        if (char === '~') { score += water ? 3 : -2; continue; }
        const plot = PLOTS[char];
        if (plot?.coastal) {
          score += tileMap.isCoastalLand(x, y) ? 9 : water ? -4 : -3;
          continue;
        }
        const usable = !!tile && !TERRAINS[tile.type].isWater && TERRAINS[tile.type].isWalkable
          && tile.type !== TerrainType.MOUNTAIN && tile.type !== TerrainType.LAVA;
        // Weighted by what the plan is asking of the tile: losing a corner of
        // farmland to a crag costs a town far less than losing its forum.
        const weight = plot ? 1 + plot.importance * .2 : 1;
        score += usable ? weight : -weight;
      }
    }
    // Deterministic tie-break, so two identical sites still read differently.
    score += ((hashString(`${blueprint.id}:${cx}:${cy}`) >>> (orientation * 3)) & 7) * .01;
    if (score > bestScore) { bestScore = score; best = orientation; }
  }
  return best;
}

// ============================================================
// LOOKUPS — the planner's entire view of a blueprint
// ============================================================

/** True when the plan reaches this far out and so may have something to say. */
export function withinBlueprint(dx: number, dy: number): boolean {
  return Math.abs(dx) <= PLAN_RADIUS && Math.abs(dy) <= PLAN_RADIUS;
}

/** The plot drawn at this offset from the town centre, if the plan drew one. */
export function blueprintPlotAt(city: City, dx: number, dy: number): BlueprintPlot | null {
  const char = planCharAt(getCityBlueprint(city.blueprintId), dx, dy, orientationOf(city));
  return PLOTS[char] ?? null;
}

/** The street drawn at this offset, once the settlement is big enough for it. */
export function blueprintStreetAt(city: City, dx: number, dy: number, stage: UrbanGrowthStage): UrbanStreetClass | null {
  const char = planCharAt(getCityBlueprint(city.blueprintId), dx, dy, orientationOf(city));
  const street = STREETS[char];
  if (!street) return null;
  return STAGE_ORDER[stage] >= STAGE_ORDER[street.minStage] ? street.streetClass : null;
}

// ============================================================
// CHOOSING A PLAN
// ============================================================

/**
 * Which plan suits this site. Reads the ground rather than a string: a bay is a
 * count of water tiles close enough to build a quay against, not a substring of
 * a terrain name.
 */
export function pickBestBlueprintForSite(
  tileMap: TileMap,
  cx: number,
  cy: number,
  kingdom?: Kingdom | null
): string {
  let bay = 0, mountain = 0, forest = 0;
  for (let x = cx - 10; x <= cx + 10; x++) {
    for (let y = cy - 10; y <= cy + 10; y++) {
      const tile = tileMap.getTile(x, y);
      if (!tile) continue;
      const distance = Math.hypot(x - cx, y - cy);
      // Water is counted only in the band where the port plan actually draws
      // its berths, five to ten tiles out. A pond in the middle of the forum is
      // not a harbour, and neither is an ocean the quay can never reach.
      if (TERRAINS[tile.type].isWater) { if (distance >= 5 && distance <= 10) bay++; }
      else if (distance > 7) continue;
      else if (tile.type === TerrainType.MOUNTAIN) mountain++;
      else if (tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP) forest++;
    }
  }
  // The quay plan is the most demanding of the five and the worst one to get
  // wrong, so it asks for a real shoreline rather than a puddle within reach.
  if (bay >= 12) return 'maritime_haven';
  if (kingdom?.research.knows('industrialization') || kingdom?.research.knows('steam_power')) return 'industrial_bastion';
  if (mountain >= 12) return 'concentric_citadel';
  if (forest >= 40) return 'sylvan_avenues';
  return 'imperial_grid';
}

/**
 * Gives a new settlement its plan and the direction it reads it in. Both are
 * decided once, at founding, off the ground actually under the town.
 */
export function assignCityBlueprint(city: City, tileMap: TileMap, kingdom?: Kingdom | null): void {
  const cx = Math.floor(city.x), cy = Math.floor(city.y);
  city.blueprintId = pickBestBlueprintForSite(tileMap, cx, cy, kingdom);
  city.blueprintRotation = chooseOrientation(getCityBlueprint(city.blueprintId), tileMap, cx, cy);
}

/**
 * The plan as this city reads it, for diagnostics and the plan tests. Never
 * called by the simulation — it exists so that a plan can be looked at.
 */
export function describeBlueprintFor(city: City): string[] {
  const blueprint = getCityBlueprint(city.blueprintId);
  const orientation = orientationOf(city);
  const rows: string[] = [`${blueprint.name} — orientação ${orientation}`];
  for (let dy = -PLAN_RADIUS; dy <= PLAN_RADIUS; dy++) {
    let line = '';
    for (let dx = -PLAN_RADIUS; dx <= PLAN_RADIUS; dx++) line += planCharAt(blueprint, dx, dy, orientation);
    rows.push(line);
  }
  return rows;
}
