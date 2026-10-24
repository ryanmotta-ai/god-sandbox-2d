import { h } from './dom';
import { iconFor } from './icons';
import type { Game } from '../game';
import type { Unit } from '../sim/unit';
import type { Building } from '../sim/buildings';
import type { City } from '../sim/city';
import type { Kingdom } from '../sim/kingdom';
import { TRAIT_NAMES, soldiersOf, makePeace } from '../sim/kingdom';
import { SPECIES } from '../sim/species';
import { kill } from '../sim/combat';
import { TILE } from '../core/config';

export type Sel = { kind: 'unit' | 'building' | 'city' | 'kingdom'; id: number };

const MODE: Record<string, string> = { wander: 'Vagando', goto: 'Andando', chop: 'Cortando madeira', mine: 'Minerando', quarry: 'Cortando pedra', farm: 'Cultivando', build: 'Construindo', haul: 'Carregando', eat: 'Comendo', forage: 'Colhendo frutas', flee: 'Fugindo', attack: 'Lutando', march: 'Marchando', siege: 'Cercando', patrol: 'Patrulhando', graze: 'Pastando', settle: 'Migrando', dragon: 'Caçando', dead: 'Morto' };
const ROLE: Record<string, string> = { peasant: 'Aldeão', farmer: 'Fazendeiro', woodcutter: 'Lenhador', miner: 'Minerador', builder: 'Construtor', soldier: 'Soldado', archer: 'Arqueiro', knight: 'Cavaleiro', king: 'Rei', mage: 'Mago', child: 'Criança' };
const TRAIT: Record<string, string> = { strong: 'Forte', quick: 'Veloz', plague: 'Peste', brave: 'Corajoso' };

type Updater = () => void;

/** Builds the side window for the current selection once, then only updates its numbers — so buttons never vanish under the cursor. */
export class Inspector {
  el: HTMLElement;
  private ups: Updater[] = [];
  sel: Sel | null = null;
  constructor(private game: Game, private onSelect: (s: Sel | null) => void) { this.el = h('div', { id: 'inspector', class: 'panel' }); }

  show(sel: Sel | null): void {
    this.sel = sel; this.ups = [];
    this.el.replaceChildren();
    if (!sel) { this.el.style.display = 'none'; return; }
    this.el.style.display = 'block';
    const sim = this.game.sim;
    if (sel.kind === 'unit') { const u = sim.byId.get(sel.id); if (u) this.unit(u); }
    else if (sel.kind === 'building') { const b = sim.buildings.get(sel.id); if (b) this.building(b); }
    else if (sel.kind === 'city') { const c = sim.cities.get(sel.id); if (c) this.city(c); }
    else { const k = sim.kingdoms.get(sel.id); if (k) this.kingdom(k); }
    this.el.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn small', onclick: () => this.onSelect(null) }, 'Fechar')));
    this.refresh();
  }

  refresh(): void {
    if (!this.sel) return;
    const sim = this.game.sim, s = this.sel;
    const gone = s.kind === 'unit' ? !sim.byId.get(s.id)?.alive : s.kind === 'building' ? !sim.buildings.has(s.id) : s.kind === 'city' ? !sim.cities.has(s.id) : !sim.kingdoms.has(s.id);
    if (gone) { this.onSelect(null); return; }
    for (const u of this.ups) u();
  }

  private kv(label: string, get: () => string): HTMLElement {
    const v = h('span', {}, ''); this.ups.push(() => { v.textContent = get(); });
    return h('div', { class: 'kv' }, h('span', {}, label), v);
  }
  private bar(label: string, get: () => number, color: (f: number) => string): HTMLElement {
    const i = h('i'); const t = h('span', {}, '');
    this.ups.push(() => { const f = Math.max(0, Math.min(1, get())); i.style.width = f * 100 + '%'; i.style.background = color(f); t.textContent = Math.round(f * 100) + '%'; });
    return h('div', {}, h('div', { class: 'kv', style: { border: 'none' } }, h('span', {}, label), t), h('div', { class: 'bar' }, i));
  }
  private link(text: string, color: string | null, go: () => void): HTMLElement {
    return h('span', { class: 'chip link', onclick: go }, color ? h('span', { class: 'dot', style: { background: color } }) : null, text);
  }
  private head(icon: string, title: string, sub: string): void {
    const c = iconFor(icon); const cv = document.createElement('canvas'); cv.width = c.width; cv.height = c.height; cv.getContext('2d')!.drawImage(c, 0, 0); cv.style.cssText = 'width:28px;height:28px;image-rendering:pixelated';
    this.el.append(h('h3', {}, cv, title), h('div', { class: 'sub' }, sub));
  }
  private col = (f: number): string => (f > 0.5 ? '#5ad25a' : f > 0.25 ? '#e0c030' : '#e0504a');
  private hungerCol = (f: number): string => (f < 0.5 ? '#5ad25a' : f < 0.8 ? '#e0c030' : '#e0504a');

  private unit(u: Unit): void {
    const sim = this.game.sim, d = u.def;
    this.head(`u_${u.species}`, u.name || d.name, `${d.name}${d.civ ? ' · ' + (u.age < 16 ? 'Criança' : ROLE[u.role] ?? '') : ''}`);
    this.el.append(
      this.kv('Idade', () => `${u.age.toFixed(0)} anos`),
      this.bar('Vida', () => u.hp / u.maxHp, this.col),
      this.bar('Fome', () => u.hunger / 100, this.hungerCol),
      this.kv('Fazendo', () => MODE[u.mode] ?? u.mode),
      this.kv('Abates', () => String(u.kills)),
    );
    const k = sim.kingdoms.get(u.kingdomId), c = sim.cities.get(u.cityId);
    const chips = h('div', { class: 'chips' });
    if (k) chips.append(this.link(k.name, k.color, () => this.onSelect({ kind: 'kingdom', id: k.id })));
    if (c) chips.append(this.link(c.name, null, () => this.onSelect({ kind: 'city', id: c.id })));
    for (const t of u.traits) chips.append(h('span', { class: 'chip' }, TRAIT[t] ?? t));
    if (u.carry) chips.append(h('span', { class: 'chip' }, `Carrega ${u.carry.good} ×${u.carry.n}`));
    this.el.append(chips, h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => { this.game.follow = this.game.follow === u ? null : u; } }, 'Seguir'),
      h('button', { class: 'btn small', onclick: () => { u.hp = u.maxHp; u.hunger = 0; u.burning = 0; u.traits = u.traits.filter(t => t !== 'plague'); } }, 'Curar'),
      h('button', { class: 'btn small danger', onclick: () => kill(sim, u, null, 'ira divina') }, 'Matar')));
  }

  private building(b: Building): void {
    const sim = this.game.sim, c = sim.cities.get(b.cityId);
    this.head('o1', b.def.name, c ? `de ${c.name}` : '');
    this.el.append(this.bar('Vida', () => b.hp / b.maxHp, this.col));
    if (!b.done) this.el.append(this.bar('Obra', () => b.progress, () => '#e8d070'));
    if (b.type === 'farm') this.el.append(this.bar('Colheita', () => b.crop, () => '#d8b040'));
    this.el.append(this.kv('Trabalhadores', () => `${b.workers}/${b.def.slots}`), this.kv('Camas', () => String(b.def.beds)));
    if (c) this.el.append(h('div', { class: 'chips' }, this.link(c.name, null, () => this.onSelect({ kind: 'city', id: c.id }))));
    this.el.append(h('div', { class: 'row' }, h('button', { class: 'btn small danger', onclick: () => { sim.destroyBuilding(b, null); } }, 'Demolir')));
  }

  private city(c: City): void {
    const sim = this.game.sim, k = sim.kingdoms.get(c.kingdomId);
    this.head('u_' + c.race, c.name, k ? `Vila de ${k.name}` : 'Vila');
    this.el.append(
      this.kv('População', () => `${c.pop} (${c.adults} adultos)`),
      this.bar('Lealdade', () => c.loyalty / 100, this.col),
      this.kv('Comida', () => String(Math.floor(c.stock.food))), this.kv('Madeira', () => String(Math.floor(c.stock.wood))),
      this.kv('Pedra', () => String(Math.floor(c.stock.stone))), this.kv('Minério/ouro', () => `${Math.floor(c.stock.ore)} / ${Math.floor(c.stock.gold)}`),
      this.kv('Construções', () => String(c.buildings.length)), this.kv('Território', () => `raio ${c.radius.toFixed(0)}`),
    );
    const chips = h('div', { class: 'chips' });
    if (k) chips.append(this.link(k.name, k.color, () => this.onSelect({ kind: 'kingdom', id: k.id })));
    this.el.append(chips, h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { this.game.cam.x = c.x * TILE; this.game.cam.y = c.y * TILE; } }, 'Centralizar')));
  }

  private kingdom(k: Kingdom): void {
    const sim = this.game.sim, king = sim.byId.get(k.king);
    this.head('u_' + k.race, k.name, `${TRAIT_NAMES[k.trait]}`);
    this.el.append(
      this.kv('Rei', () => king?.alive ? king.name : '—'), this.kv('Vilas', () => String(k.cities.length)),
      this.kv('População', () => String(k.cities.reduce((a, id) => a + (sim.cities.get(id)?.pop ?? 0), 0))), this.kv('Soldados', () => String(soldiersOf(sim, k).length)),
      this.kv('Fundado', () => `ano ${(k.founded / 12).toFixed(0)}`),
    );
    const cities = h('div', { class: 'chips' });
    for (const id of k.cities) { const c = sim.cities.get(id); if (c) cities.append(this.link(c.name, null, () => this.onSelect({ kind: 'city', id }))); }
    this.el.append(h('div', { class: 'sub', style: { marginTop: '6px' } }, 'Vilas'), cities);
    const wars = h('div', { class: 'chips' });
    for (const id of k.wars) { const o = sim.kingdoms.get(id); if (o) wars.append(this.link('⚔ ' + o.name, o.color, () => this.onSelect({ kind: 'kingdom', id }))); }
    const rels = h('div', { class: 'chips' });
    const rel = [...k.relations.entries()].filter(([id]) => sim.kingdoms.has(id) && !k.wars.has(id)).sort((a, b) => a[1] - b[1]).slice(0, 5);
    for (const [id, v] of rel) { const o = sim.kingdoms.get(id)!; rels.append(this.link(`${o.name.split(' de ')[1] ?? o.name} ${v > 0 ? '+' : ''}${v.toFixed(0)}`, o.color, () => this.onSelect({ kind: 'kingdom', id }))); }
    this.el.append(h('div', { class: 'sub' }, k.wars.size ? 'Em guerra com' : 'Em paz'), wars, h('div', { class: 'sub' }, 'Relações'), rels,
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => { for (const id of [...k.wars]) { const o = sim.kingdoms.get(id); if (o) makePeace(sim, k, o, 160); } } }, 'Impor paz'),
        h('button', { class: 'btn small', onclick: () => { const c = sim.cities.get(k.capital); if (c) { this.game.cam.x = c.x * TILE; this.game.cam.y = c.y * TILE; } } }, 'Capital')));
  }
}
void SPECIES;
