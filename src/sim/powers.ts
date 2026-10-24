import type { Sim } from './sim';
import { T, O, TERRAIN } from '../world/defs';
import type { Species } from './species';
import { SPECIES } from './species';
import { kill, damage } from './combat';
import { igniteTile } from './ai';
import { startDisaster } from './disasters';
import { declareWar, makePeace } from './kingdom';

export type Tab = 'terrain' | 'creatures' | 'nature' | 'disasters' | 'divine';
export const TABS: { id: Tab; name: string }[] = [
  { id: 'terrain', name: 'Terreno' }, { id: 'creatures', name: 'Criaturas' }, { id: 'nature', name: 'Natureza' }, { id: 'disasters', name: 'Desastres' }, { id: 'divine', name: 'Divino' },
];

export interface Power {
  id: string; name: string; tab: Tab; desc: string;
  /** Uses the brush radius (otherwise a single point/click). */
  brush?: boolean;
  /** Keeps firing while the mouse is held (events per second). */
  rate?: number;
  /** Icon key for ui/icons: a terrain id, species, object, or drawn glyph name. */
  icon: string;
  apply: (sim: Sim, x: number, y: number, r: number) => void;
}

const forBrush = (sim: Sim, x: number, y: number, r: number, fn: (tx: number, ty: number) => void): void => {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (i * i + j * j > r * r + r * 0.5) continue; const tx = x + i, ty = y + j; if (sim.world.inb(tx, ty)) fn(tx, ty); }
};

const paint = (t: number, destroys = false): Power['apply'] => (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => {
  const w = sim.world, i = ty * w.w + tx;
  const b = w.bld[i];
  if (b) { if (!destroys) return; const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); }
  if (w.terrain[i] === T.LAVA && t !== T.LAVA && TERRAIN[t].water) sim.fx.push({ t: 'smoke', x: tx + 0.5, y: ty + 0.5 });
  w.setTerrain(tx, ty, t);
  if (destroys || TERRAIN[t].water) { w.obj[i] = O.NONE; w.fire[i] = 0; w.activeFires.delete(i); }
  else if (t === T.DESERT || t === T.SAND || t === T.LAVA || t === T.ROCK || t === T.SNOW) { if (w.obj[i] <= O.ACACIA) w.obj[i] = O.NONE; }
  w.zone[i] = w.zone[i];
  if (!TERRAIN[t].water) sim.fx.push({ t: 'dust', x: tx + 0.5, y: ty + 0.5, a: 0.3 });
});

const LADDER = [T.DEEP, T.SHALLOW, T.SAND, T.GRASS, T.HILL, T.MOUNTAIN];
const step = (dir: number): Power['apply'] => (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => {
  const w = sim.world, i = ty * w.w + tx;
  const t = w.terrain[i];
  let k = LADDER.findIndex(l => l === t);
  if (k < 0) k = t === T.PEAK ? 5 : TERRAIN[t].water ? 1 : 3; // other ground counts as grassland
  const nk = Math.max(0, Math.min(LADDER.length - 1, k + dir));
  if (nk === k) return;
  const b = w.bld[i];
  if (b && (LADDER[nk] === T.DEEP || LADDER[nk] === T.SHALLOW || LADDER[nk] === T.MOUNTAIN)) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); }
  w.setTerrain(tx, ty, LADDER[nk]); if (LADDER[nk] === T.MOUNTAIN || TERRAIN[LADDER[nk]].water) w.obj[i] = O.NONE;
});

const spawnN = (sp: Species, base = 1): Power['apply'] => (sim, x, y, r) => {
  const n = base + Math.floor(r * (SPECIES[sp].civ ? 0.9 : sp === 'dragon' || sp === 'bear' ? 0.2 : 0.7));
  for (let k = 0; k < n; k++) {
    const s = sim.freeSpot(x + 0.5 + sim.rng.range(-r, r) * 0.7, y + 0.5 + sim.rng.range(-r, r) * 0.7, 3);
    const air = SPECIES[sp].fly;
    if (!s && !air) continue;
    const u = sim.spawn(sp, s ? s.x : x + 0.5, s ? s.y : y + 0.5, SPECIES[sp].civ ? { age: sim.rng.range(18, 36), role: 'peasant' } : sp === 'zombie' || sp === 'dragon' ? { age: 5 } : {});
    sim.fx.push({ t: 'heal', x: u.x, y: u.y });
  }
};

const plant = (o: number, density = 1, tilesOk?: (t: number) => boolean): Power['apply'] => (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => {
  const w = sim.world, i = ty * w.w + tx;
  if (w.bld[i] || w.obj[i] !== O.NONE || sim.rng.next() > density) return;
  const t = w.terrain[i];
  if (TERRAIN[t].water || !TERRAIN[t].walk && t !== T.MOUNTAIN || t === T.LAVA) return;
  if (tilesOk && !tilesOk(t)) return;
  let kind = o;
  if (o === O.OAK) kind = t === T.JUNGLE ? O.JUNGLE_TREE : t === T.SAVANNA ? O.ACACIA : t === T.SAND ? O.PALM : t === T.TUNDRA || t === T.SNOW ? O.SNOW_PINE : t === T.DESERT ? O.CACTUS : t === T.SWAMP ? O.DEAD_TREE : sim.rng.pick([O.OAK, O.OAK, O.BIRCH, O.PINE]);
  w.obj[i] = kind; w.objAge[i] = 30;
  if (t === T.DIRT || t === T.ASH) w.setTerrain(tx, ty, T.GRASS);
  sim.fx.push({ t: 'leaf', x: tx + 0.5, y: ty + 0.5 });
});

const onUnits = (fn: (u: import('./unit').Unit, sim: Sim) => void, rad = 1.6): Power['apply'] => (sim, x, y, r) => sim.near(x + 0.5, y + 0.5, Math.max(rad, r + 0.5), u => { if (u.alive) fn(u, sim); });

export const POWERS: Power[] = [
  // ---- terrain
  { id: 'raise', tab: 'terrain', name: 'Elevar', icon: 'raise', brush: true, rate: 5, desc: 'Sobe o terreno: água → areia → grama → colina → montanha.', apply: step(1) },
  { id: 'lower', tab: 'terrain', name: 'Rebaixar', icon: 'lower', brush: true, rate: 5, desc: 'Desce o terreno até virar mar.', apply: step(-1) },
  { id: 'deep', tab: 'terrain', name: 'Oceano', icon: 't0', brush: true, rate: 10, desc: 'Oceano profundo.', apply: paint(T.DEEP, true) },
  { id: 'shallow', tab: 'terrain', name: 'Água rasa', icon: 't1', brush: true, rate: 10, desc: 'Água rasa, onde se pode vadear.', apply: paint(T.SHALLOW, true) },
  { id: 'sand', tab: 'terrain', name: 'Areia', icon: 't2', brush: true, rate: 10, desc: 'Praia.', apply: paint(T.SAND) },
  { id: 'dirt', tab: 'terrain', name: 'Terra', icon: 't3', brush: true, rate: 10, desc: 'Terra nua.', apply: paint(T.DIRT) },
  { id: 'grass', tab: 'terrain', name: 'Grama', icon: 't4', brush: true, rate: 10, desc: 'Grama.', apply: paint(T.GRASS) },
  { id: 'jungle', tab: 'terrain', name: 'Selva', icon: 't5', brush: true, rate: 10, desc: 'Solo de selva.', apply: paint(T.JUNGLE) },
  { id: 'savanna', tab: 'terrain', name: 'Savana', icon: 't6', brush: true, rate: 10, desc: 'Savana seca.', apply: paint(T.SAVANNA) },
  { id: 'desert', tab: 'terrain', name: 'Deserto', icon: 't7', brush: true, rate: 10, desc: 'Dunas.', apply: paint(T.DESERT) },
  { id: 'swamp', tab: 'terrain', name: 'Pântano', icon: 't8', brush: true, rate: 10, desc: 'Brejo lento.', apply: paint(T.SWAMP) },
  { id: 'tundra', tab: 'terrain', name: 'Tundra', icon: 't9', brush: true, rate: 10, desc: 'Tundra gelada.', apply: paint(T.TUNDRA) },
  { id: 'snow', tab: 'terrain', name: 'Neve', icon: 't10', brush: true, rate: 10, desc: 'Neve.', apply: paint(T.SNOW) },
  { id: 'hill', tab: 'terrain', name: 'Colina', icon: 't11', brush: true, rate: 10, desc: 'Colinas caminháveis.', apply: paint(T.HILL) },
  { id: 'mountain', tab: 'terrain', name: 'Montanha', icon: 't12', brush: true, rate: 10, desc: 'Montanha: esmaga o que estiver embaixo.', apply: paint(T.MOUNTAIN, true) },
  { id: 'lava', tab: 'terrain', name: 'Lava', icon: 't14', brush: true, rate: 10, desc: 'Lava: queima tudo e esfria em pedra.', apply: paint(T.LAVA, true) },
  { id: 'enchanted', tab: 'terrain', name: 'Encantado', icon: 't19', brush: true, rate: 10, desc: 'Solo mágico.', apply: paint(T.ENCHANTED) },
  { id: 'corrupted', tab: 'terrain', name: 'Corrompido', icon: 't20', brush: true, rate: 10, desc: 'Solo corrompido.', apply: paint(T.CORRUPTED) },
  { id: 'road', tab: 'terrain', name: 'Estrada', icon: 't18', brush: true, rate: 10, desc: 'Calçada de pedra.', apply: paint(T.ROAD) },
  // ---- creatures
  ...(['human', 'elf', 'dwarf', 'orc'] as const).map<Power>(r => ({ id: `spawn_${r}`, tab: 'creatures', name: SPECIES[r].name, icon: `u_${r}`, rate: 4, desc: `Cria ${SPECIES[r].name.toLowerCase()}s. Em grupo, fundam vilas.`, apply: spawnN(r, 1) })),
  ...(['sheep', 'cow', 'chicken', 'rabbit', 'deer', 'boar', 'wolf', 'bear', 'snake', 'crab', 'bird', 'dragon', 'zombie'] as const).map<Power>(s => ({ id: `spawn_${s}`, tab: 'creatures', name: SPECIES[s].name, icon: `u_${s}`, rate: s === 'dragon' ? 0.7 : 4, desc: `Cria ${SPECIES[s].name.toLowerCase()}.`, apply: spawnN(s, 1) })),
  // ---- nature
  { id: 'tree', tab: 'nature', name: 'Árvores', icon: 'o1', brush: true, rate: 8, desc: 'Planta árvores do bioma.', apply: plant(O.OAK, 0.35) },
  { id: 'bush', tab: 'nature', name: 'Arbusto', icon: 'o9', brush: true, rate: 8, desc: 'Arbustos e frutinhas.', apply: plant(O.BUSH, 0.2) },
  { id: 'flower', tab: 'nature', name: 'Flores', icon: 'o11', brush: true, rate: 8, desc: 'Flores.', apply: (sim, x, y, r) => plant(sim.rng.pick([O.FLOWER_RED, O.FLOWER_YELLOW, O.FLOWER_BLUE]), 0.3)(sim, x, y, r) },
  { id: 'rock', tab: 'nature', name: 'Pedras', icon: 'o16', brush: true, rate: 8, desc: 'Pedras e rochedos.', apply: plant(O.ROCK, 0.12) },
  { id: 'iron', tab: 'nature', name: 'Ferro', icon: 'o17', brush: true, rate: 4, desc: 'Veio de ferro.', apply: plant(O.ORE_IRON, 0.1) },
  { id: 'gold', tab: 'nature', name: 'Ouro', icon: 'o18', brush: true, rate: 4, desc: 'Veio de ouro.', apply: plant(O.ORE_GOLD, 0.08) },
  { id: 'mushroom', tab: 'nature', name: 'Cogumelos', icon: 'o20', brush: true, rate: 8, desc: 'Cogumelos.', apply: plant(O.MUSHROOM, 0.15) },
  { id: 'fertilize', tab: 'nature', name: 'Fertilizar', icon: 'fert', brush: true, rate: 8, desc: 'Cinza e terra viram grama.', apply: (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => { const t = sim.world.t(tx, ty); if ((t === T.DIRT || t === T.ASH || t === T.DESERT || t === T.SAND && false) && !sim.world.bld[ty * sim.world.w + tx]) { sim.world.setTerrain(tx, ty, T.GRASS); sim.fx.push({ t: 'heal', x: tx + 0.5, y: ty + 0.5 }); } }) },
  { id: 'fire', tab: 'nature', name: 'Fogo', icon: 'fire', brush: true, rate: 8, desc: 'Ateia fogo.', apply: (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => { if (sim.rng.chance(0.5)) igniteTile(sim, tx, ty); }) },
  { id: 'rain', tab: 'nature', name: 'Chuva', icon: 'rain', desc: 'Chove por um tempo: apaga incêndios.', apply: sim => { sim.weather = 'rain'; sim.weatherT = 70; } },
  { id: 'snowfall', tab: 'nature', name: 'Nevasca', icon: 'snowfall', desc: 'Faz nevar.', apply: sim => { sim.weather = 'snow'; sim.weatherT = 70; } },
  { id: 'clear', tab: 'nature', name: 'Céu limpo', icon: 'sun', desc: 'Limpa o tempo.', apply: sim => { sim.weather = 'clear'; sim.weatherT = 60; } },
  // ---- disasters
  { id: 'lightning', tab: 'disasters', name: 'Raio', icon: 'bolt', rate: 3, desc: 'Um raio fulminante.', apply: (sim, x, y) => { sim.fx.push({ t: 'lightning', x: x + 0.5, y: y + 0.5 }); sim.near(x + 0.5, y + 0.5, 1.9, u => damage(sim, u, 90, null)); igniteTile(sim, x, y); const b = sim.world.bld[y * sim.world.w + x]; if (b) { const bb = sim.buildings.get(b); if (bb) { bb.hp -= 120; bb.burning = 6; if (bb.hp <= 0) sim.destroyBuilding(bb, null); } } } },
  { id: 'meteor', tab: 'disasters', name: 'Meteoro', icon: 'meteor', rate: 0.8, desc: 'Cai do céu e abre uma cratera.', apply: (sim, x, y) => startDisaster(sim, 'meteor', x + 0.5, y + 0.5) },
  { id: 'quake', tab: 'disasters', name: 'Terremoto', icon: 'quake', desc: 'O chão racha, casas desabam.', apply: (sim, x, y, r) => startDisaster(sim, 'quake', x + 0.5, y + 0.5, Math.max(6, r + 3)) },
  { id: 'tornado', tab: 'disasters', name: 'Tornado', icon: 'tornado', desc: 'Um funil que vaga e destrói.', apply: (sim, x, y) => startDisaster(sim, 'tornado', x + 0.5, y + 0.5) },
  { id: 'volcano', tab: 'disasters', name: 'Vulcão', icon: 'volcano', desc: 'Ergue um vulcão que cospe lava.', apply: (sim, x, y) => startDisaster(sim, 'volcano', x + 0.5, y + 0.5) },
  { id: 'acid', tab: 'disasters', name: 'Chuva ácida', icon: 'acid', desc: 'Nuvem que corrói gente, árvores e casas.', apply: (sim, x, y, r) => startDisaster(sim, 'acid', x + 0.5, y + 0.5, Math.max(7, r + 3)) },
  { id: 'flood', tab: 'disasters', name: 'Enchente', icon: 'flood', desc: 'A água invade a terra.', apply: (sim, x, y) => startDisaster(sim, 'flood', x + 0.5, y + 0.5) },
  { id: 'nuke', tab: 'disasters', name: 'Bomba', icon: 'nuke', rate: 0.5, desc: 'Aniquilação em grande raio.', apply: (sim, x, y) => { const w = sim.world; sim.fx.push({ t: 'boom', x: x + 0.5, y: y + 0.5 }); sim.fx.push({ t: 'flash', x, y, a: 1.3 }); for (let j = -10; j <= 10; j++) for (let i = -10; i <= 10; i++) { const d = Math.hypot(i, j), tx = x + i, ty = y + j; if (d > 10 || !w.inb(tx, ty)) continue; const idx = ty * w.w + tx; const b = w.bld[idx]; if (b) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); } if (TERRAIN[w.terrain[idx]].water) continue; w.obj[idx] = O.NONE; if (d < 2.5) w.setTerrain(tx, ty, T.LAVA); else if (d < 8) { if (w.terrain[idx] !== T.MOUNTAIN) w.setTerrain(tx, ty, T.ASH); if (sim.rng.chance(0.2)) igniteTile(sim, tx, ty); } } sim.near(x + 0.5, y + 0.5, 12, u => kill(sim, u, null, 'bomba')); } },
  { id: 'plague', tab: 'disasters', name: 'Peste', icon: 'plague', brush: true, desc: 'Doença que se espalha e levanta mortos.', apply: onUnits(u => { if (u.species !== 'zombie' && !u.traits.includes('plague')) u.traits.push('plague'); }, 2) },
  // ---- divine
  { id: 'heal', tab: 'divine', name: 'Curar', icon: 'heal', brush: true, rate: 6, desc: 'Cura ferimentos, doença e fogo.', apply: onUnits((u, sim) => { u.hp = u.maxHp; u.hunger = Math.min(u.hunger, 30); u.burning = 0; u.traits = u.traits.filter(t => t !== 'plague'); sim.fx.push({ t: 'heal', x: u.x, y: u.y - 0.5 }); }) },
  { id: 'bless', tab: 'divine', name: 'Bênção', icon: 'bless', brush: true, rate: 4, desc: 'Torna forte, veloz e resistente.', apply: onUnits((u, sim) => { if (!u.traits.includes('strong')) { u.traits.push('strong', 'quick'); u.maxHp *= 1.5; u.hp = u.maxHp; } sim.fx.push({ t: 'heal', x: u.x, y: u.y - 0.5 }); }) },
  { id: 'curse', tab: 'divine', name: 'Maldição', icon: 'curse', brush: true, rate: 4, desc: 'Fere e enfraquece.', apply: onUnits((u, sim) => { u.hp *= 0.5; u.maxHp = Math.max(10, u.maxHp * 0.8); sim.fx.push({ t: 'curse', x: u.x, y: u.y - 0.5 }); }) },
  { id: 'smite', tab: 'divine', name: 'Punir', icon: 'smite', brush: true, rate: 6, desc: 'Mata quem estiver no alvo.', apply: onUnits((u, sim) => { sim.fx.push({ t: 'curse', x: u.x, y: u.y - 0.5 }); kill(sim, u, null, 'ira divina'); }, 1.1) },
  { id: 'erase', tab: 'divine', name: 'Apagar', icon: 'erase', brush: true, rate: 10, desc: 'Remove objetos, construções e fogo.', apply: (sim, x, y, r) => forBrush(sim, x, y, r, (tx, ty) => { const w = sim.world, i = ty * w.w + tx; w.obj[i] = O.NONE; w.fire[i] = 0; w.activeFires.delete(i); const b = w.bld[i]; if (b) { const bb = sim.buildings.get(b); if (bb) sim.destroyBuilding(bb, null); } }) },
  { id: 'war', tab: 'divine', name: 'Guerra', icon: 'war', desc: 'Clique numa vila; ela declara guerra ao reino mais próximo.', apply: (sim, x, y) => { const c = nearestCity(sim, x, y); if (!c) return; const a = sim.kingdoms.get(c.kingdomId); if (!a) return; let best = null as null | { k: typeof a; d: number }; for (const o of sim.kingdoms.values()) { if (o === a || a.wars.has(o.id)) continue; for (const cid of o.cities) { const oc = sim.cities.get(cid); if (!oc) continue; const d = Math.hypot(oc.x - c.x, oc.y - c.y); if (!best || d < best.d) best = { k: o, d }; } } if (best) { a.truce.delete(best.k.id); best.k.truce.delete(a.id); declareWar(sim, a, best.k, 'ira divina'); } } },
  { id: 'peace', tab: 'divine', name: 'Paz', icon: 'peace', desc: 'Clique numa vila: o reino faz paz com todos.', apply: (sim, x, y) => { const c = nearestCity(sim, x, y); const a = c && sim.kingdoms.get(c.kingdomId); if (!a) return; for (const id of [...a.wars]) { const o = sim.kingdoms.get(id); if (o) makePeace(sim, a, o, 160); } } },
];

export const POWER_BY_ID = new Map(POWERS.map(p => [p.id, p]));

export function nearestCity(sim: Sim, x: number, y: number, max = 18): import('./city').City | null {
  let best: import('./city').City | null = null, bd = max * max;
  for (const c of sim.cities.values()) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
