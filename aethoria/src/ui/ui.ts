import { h, CSS } from './dom';
import { iconFor } from './icons';
import { Inspector, type Sel } from './inspector';
import type { Game, Setup } from '../game';
import { DEFAULT_SETUP } from '../game';
import { POWERS, TABS, type Power, type Tab } from '../sim/powers';
import { TILE } from '../core/config';
import { TERRAIN } from '../world/defs';
import type { Preset } from '../world/gen';
import type { Race } from '../gfx/humanoid';
import { SPECIES } from '../sim/species';
import { YEAR_SECONDS } from '../sim/species';
import { saveGame, loadGame, hasSave, exportSave, importSave } from '../core/save';
import type { Unit } from '../sim/unit';
import type { Building } from '../sim/buildings';

const SPEEDS: [string, number][] = [['❚❚', 0], ['1×', 1], ['2×', 2], ['4×', 4], ['8×', 8]];
const SEASON = ['Primavera', 'Verão', 'Outono', 'Inverno'];
const WEATHER: Record<string, string> = { clear: '', rain: ' · chuva', storm: ' · tempestade', snow: ' · neve', fog: ' · névoa' };
const PRESETS: [Preset, string][] = [['continents', 'Continentes'], ['pangea', 'Pangeia'], ['islands', 'Ilhas'], ['archipelago', 'Arquipélago'], ['lakes', 'Lagos']];
const SIZES = [96, 128, 160, 192, 256, 320];

/** The whole interface. Pure DOM over the canvas; it talks to the Game and nothing deeper. */
export class UI {
  root: HTMLElement;
  tab: Tab = 'terrain';
  private toolsEl!: HTMLElement; private hint!: HTMLElement; private stats!: HTMLElement; private speedBtns: HTMLElement[] = [];
  private feed!: HTMLElement; private mini!: HTMLCanvasElement; private miniCtx!: CanvasRenderingContext2D;
  private inspector: Inspector;
  private miniT = 0; private statT = 0; private lastLog = 0;
  sel: Sel | null = null;
  private pointer: { x: number; y: number; mode: 'none' | 'pan' | 'tool' | 'click'; sx: number; sy: number; moved: boolean; fire: number } = { x: 0, y: 0, mode: 'none', sx: 0, sy: 0, moved: false, fire: 0 };

  constructor(private game: Game, private canvas: HTMLCanvasElement) {
    document.head.append(h('style', {}, CSS));
    this.root = document.getElementById('ui')!;
    this.inspector = new Inspector(game, s => this.select(s));
    this.build();
    this.bindInput();
    game.onWorld.push(() => { this.select(null); this.lastLog = 0; this.setMiniSize(); });
    this.setMiniSize();
  }

  /* ---------- layout ---------- */
  private build(): void {
    const g = this.game;
    this.stats = h('div', { class: 'stats panel' });
    const speed = h('div', { class: 'speed panel' }, ...SPEEDS.map(([t, v]) => { const b = h('button', { class: 'btn', onclick: () => this.setSpeed(v) }, t); this.speedBtns.push(b); return b; }));
    const menu = h('div', { class: 'row panel', style: { padding: '4px' } },
      h('button', { class: 'btn', title: 'Bordas dos reinos', onclick: (e: Event) => { g.renderer.showBorders = !g.renderer.showBorders; (e.currentTarget as HTMLElement).classList.toggle('on', g.renderer.showBorders); } }, 'Bordas'),
      h('button', { class: 'btn on', title: 'Nomes das vilas', onclick: (e: Event) => { g.renderer.showNames = !g.renderer.showNames; (e.currentTarget as HTMLElement).classList.toggle('on', g.renderer.showNames); } }, 'Nomes'),
      h('button', { class: 'btn', onclick: () => this.menu() }, '☰ Menu'));
    menu.children[0].classList.add('on');
    this.feed = h('div', { id: 'feed' });
    this.hint = h('div', { class: 'hint panel' });
    this.toolsEl = h('div', { class: 'tools panel' });
    const tabs = h('div', { class: 'tabs panel' }, ...TABS.map(t => h('div', { class: 'tab' + (t.id === this.tab ? ' on' : ''), 'data-tab': t.id, onclick: () => this.setTab(t.id) }, t.name)),
      h('div', { class: 'tab', 'data-tab': 'inspect', onclick: () => this.pick(null) }, '☝ Inspecionar'));
    const brush = h('div', { class: 'brush panel' }, h('span', {}, 'Pincel'), h('input', { type: 'range', min: '0', max: '12', value: String(g.brush), oninput: (e: Event) => { g.brush = +(e.target as HTMLInputElement).value; } }));
    this.mini = h('canvas'); this.miniCtx = this.mini.getContext('2d')!;
    const minimap = h('div', { id: 'minimap', class: 'panel' }, this.mini);
    this.root.append(h('div', { id: 'top' }, this.stats, speed, menu), this.feed, this.inspector.el, h('div', { id: 'bottom' }, this.hint, h('div', { class: 'row' }, tabs, brush), this.toolsEl), minimap);
    this.setTab(this.tab);
    this.setSpeed(g.speed);
    const mm = (e: PointerEvent): void => { const r = this.mini.getBoundingClientRect(); g.cam.x = ((e.clientX - r.left) / r.width) * g.sim.world.w * TILE; g.cam.y = ((e.clientY - r.top) / r.height) * g.sim.world.h * TILE; g.follow = null; };
    this.mini.addEventListener('pointerdown', e => { mm(e); this.mini.setPointerCapture(e.pointerId); });
    this.mini.addEventListener('pointermove', e => { if (e.buttons) mm(e); });
  }

  private setMiniSize(): void { const w = this.game.sim.world; this.mini.width = w.w; this.mini.height = w.h; }

  private setSpeed(v: number): void { this.game.speed = v; this.speedBtns.forEach((b, i) => b.classList.toggle('on', SPEEDS[i][1] === v)); }

  private setTab(t: Tab): void {
    this.tab = t;
    this.root.querySelectorAll('.tab').forEach(el => el.classList.toggle('on', el.getAttribute('data-tab') === t));
    this.toolsEl.replaceChildren(...POWERS.filter(p => p.tab === t).map(p => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 28; cv.getContext('2d')!.drawImage(iconFor(p.icon), 0, 0);
      const el = h('div', { class: 'tool' + (this.game.tool === p ? ' on' : ''), 'data-id': p.id, onclick: () => this.pick(this.game.tool === p ? null : p), onmouseenter: () => this.showHint(p), onmouseleave: () => this.showHint(this.game.tool) }, cv);
      return el;
    }));
    this.showHint(this.game.tool);
  }

  private pick(p: Power | null): void {
    this.game.tool = p;
    this.root.querySelectorAll('.tool').forEach(el => el.classList.toggle('on', p !== null && el.getAttribute('data-id') === p.id));
    this.root.querySelector('[data-tab="inspect"]')?.classList.toggle('on', p === null);
    if (p) this.select(null);
    this.showHint(p);
  }
  private showHint(p: Power | null): void {
    this.hint.replaceChildren(p ? h('span', {}, h('b', {}, p.name), ' — ', p.desc) : h('span', {}, 'Clique em criaturas, construções e vilas para inspecionar. Arraste para mover a câmera.'));
  }

  select(s: Sel | null): void {
    this.sel = s; this.game.renderer.selected = s;
    if (!s || s.kind !== 'unit') this.game.follow = null;
    this.inspector.show(s);
  }

  /* ---------- per-frame ---------- */
  update(dt: number): void {
    const sim = this.game.sim;
    this.statT += dt; this.miniT += dt;
    if (this.statT > 0.25) {
      this.statT = 0;
      let pop = 0, animals = 0; for (const u of sim.units) if (u.alive) { if (u.def.civ) pop++; else animals++; }
      this.stats.replaceChildren(
        h('span', { class: 'stat' }, 'Ano ', h('b', {}, String(Math.floor(sim.time / YEAR_SECONDS)))), h('span', { class: 'stat' }, SEASON[sim.season] + WEATHER[sim.weather]),
        h('span', { class: 'stat' }, '👥 ', h('b', {}, String(pop))), h('span', { class: 'stat' }, '🏰 ', h('b', {}, String(sim.cities.size))),
        h('span', { class: 'stat' }, '👑 ', h('b', {}, String(sim.kingdoms.size))), h('span', { class: 'stat' }, '⚔ ', h('b', {}, String([...sim.kingdoms.values()].reduce((a, k) => a + k.wars.size, 0) / 2))),
        h('span', { class: 'stat', style: { color: '#98a2c4' } }, `🐾 ${animals}`));
      this.inspector.refresh();
      for (let i = this.lastLog; i < sim.log.length; i++) { const m = sim.log[i]; this.feed.append(h('div', { class: 'msg ' + m.kind }, m.text)); setTimeout(() => this.feed.firstChild && this.feed.removeChild(this.feed.firstChild), 14000); }
      this.lastLog = sim.log.length;
      while (this.feed.children.length > 7) this.feed.removeChild(this.feed.firstChild!);
    }
    if (this.miniT > 1.2) { this.miniT = 0; this.drawMini(); }
    // held tool: repeat at its rate
    const p = this.pointer;
    if (p.mode === 'tool' && this.game.tool?.rate) { p.fire += dt; const iv = 1 / this.game.tool.rate; while (p.fire >= iv) { p.fire -= iv; this.applyTool(p.x, p.y); } }
    // hover preview
    const t = this.game.tool;
    if (t && p.mode !== 'pan') { const { tx, ty } = this.game.cam.toTile(p.x, p.y); this.game.renderer.hover = { x: tx, y: ty, r: t.brush ? this.game.brush : 0, shape: 'circle' }; } else this.game.renderer.hover = null;
    // keyboard pan
    const cam = this.game.cam, sp = 520 * dt / cam.zoom * (this.keys.has('Shift') ? 2.2 : 1);
    if (this.keys.size) { if (this.keys.has('w') || this.keys.has('ArrowUp')) cam.y -= sp; if (this.keys.has('s') || this.keys.has('ArrowDown')) cam.y += sp; if (this.keys.has('a') || this.keys.has('ArrowLeft')) cam.x -= sp; if (this.keys.has('d') || this.keys.has('ArrowRight')) cam.x += sp; if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(k => this.keys.has(k))) { cam.clamp(); this.game.follow = null; } }
  }

  private drawMini(): void {
    const sim = this.game.sim, w = sim.world, c = this.miniCtx;
    const img = c.createImageData(w.w, w.h), d = new Uint32Array(img.data.buffer);
    const rgb = TERRAIN.map(t => { const v = parseInt(t.ramp[2].slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
    for (let i = 0; i < w.w * w.h; i++) {
      let [r, g, b] = rgb[w.terrain[i]];
      const z = w.zone[i];
      if (z) { const city = sim.cities.get(z), k = city && sim.kingdoms.get(city.kingdomId); if (k) { const v = parseInt(k.color.slice(1), 16); r = r * 0.35 + ((v >> 16) & 255) * 0.65; g = g * 0.35 + ((v >> 8) & 255) * 0.65; b = b * 0.35 + (v & 255) * 0.65; } }
      d[i] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
    for (const [, b] of sim.buildings) { if (b.done) { const x = b.x, y = b.y; d[y * w.w + x] = 0xffffffff; } }
    c.putImageData(img, 0, 0);
    // camera box
    const cam = this.game.cam, z = cam.zoom;
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, w.w / 128);
    c.strokeRect(cam.left / TILE, cam.top / TILE, cam.vw / z / TILE, cam.vh / z / TILE);
  }

  /* ---------- dialogs ---------- */
  title(): void {
    const g = this.game;
    const close = (): void => { el.remove(); };
    const el = h('div', { id: 'title' }, h('h1', {}, 'AETHORIA'), h('p', {}, 'SANDBOX DIVINO'),
      h('button', { class: 'btn', onclick: () => { close(); this.newWorldDialog(); } }, 'Novo mundo'),
      h('button', { class: 'btn', onclick: () => { const s = { ...DEFAULT_SETUP, seed: 1 + Math.floor(Math.random() * 99999), preset: PRESETS[Math.floor(Math.random() * PRESETS.length)][0] }; g.newWorld(s); close(); } }, 'Mundo aleatório'),
      h('button', { class: 'btn', onclick: () => { if (loadGame(g)) close(); }, ...(hasSave() ? {} : { disabled: 'true', style: { opacity: '.4' } }) }, 'Continuar'),
      h('button', { class: 'btn', onclick: close }, 'Observar este mundo'));
    this.root.append(el);
  }

  newWorldDialog(): void {
    const g = this.game;
    const s: Setup = { ...g.setup, seed: g.setup.seed };
    const modal = h('div', { class: 'modal' });
    const body = h('div', { class: 'card panel' });
    const redraw = (): void => {
      const slider = (label: string, key: 'water' | 'mountains' | 'forest' | 'climate' | 'wildlife', fmt?: (v: number) => string): HTMLElement => {
        const out = h('span', { style: { width: '44px', textAlign: 'right' } }, fmt ? fmt(s[key]) : Math.round(s[key] * 100) + '%');
        return h('div', { class: 'field' }, h('label', {}, label), h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(s[key] * 100)), oninput: (e: Event) => { s[key] = +(e.target as HTMLInputElement).value / 100; out.textContent = fmt ? fmt(s[key]) : Math.round(s[key] * 100) + '%'; } }), out);
      };
      const races = h('div', { class: 'races' }, ...(['human', 'elf', 'dwarf', 'orc'] as Race[]).map(r => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 28; cv.getContext('2d')!.drawImage(iconFor('u_' + r), 0, 0);
        return h('div', { class: 'race' + (s.races.includes(r) ? ' on' : ''), onclick: () => { s.races = s.races.includes(r) ? s.races.filter(x => x !== r) : [...s.races, r]; redraw(); } }, cv, SPECIES[r].name);
      }));
      body.replaceChildren(
        h('h2', {}, 'NOVO MUNDO'),
        h('div', { class: 'presets' }, ...PRESETS.map(([id, name]) => h('button', { class: 'btn' + (s.preset === id ? ' on' : ''), onclick: () => { s.preset = id; redraw(); } }, name))),
        h('div', { class: 'field' }, h('label', {}, 'Tamanho'), h('select', { onchange: (e: Event) => { s.size = +(e.target as HTMLSelectElement).value; } }, ...SIZES.map(v => h('option', { value: String(v), ...(v === s.size ? { selected: 'true' } : {}) }, `${v} × ${v}`)))),
        slider('Água', 'water'), slider('Montanhas', 'mountains'), slider('Florestas', 'forest'), slider('Clima', 'climate', v => (v < 0.34 ? 'Frio' : v > 0.66 ? 'Quente' : 'Ameno')), slider('Vida selvagem', 'wildlife'),
        h('div', { class: 'field' }, h('label', {}, 'Povos'), races),
        h('div', { class: 'field' }, h('label', {}, 'Fundadores'), h('input', { type: 'range', min: '2', max: '14', value: String(s.founders), oninput: (e: Event) => { s.founders = +(e.target as HTMLInputElement).value; (e.target as HTMLElement).nextElementSibling!.textContent = String(s.founders); } }), h('span', {}, String(s.founders))),
        h('div', { class: 'field' }, h('label', {}, 'Semente'), h('input', { type: 'text', value: String(s.seed), style: { width: '110px' }, oninput: (e: Event) => { s.seed = parseInt((e.target as HTMLInputElement).value) || 1; } }), h('button', { class: 'btn small', onclick: () => { s.seed = 1 + Math.floor(Math.random() * 99999); redraw(); } }, '🎲')),
        h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => modal.remove() }, 'Cancelar'), h('button', { class: 'btn on', onclick: () => { g.newWorld({ ...s }); modal.remove(); } }, 'Criar mundo')));
    };
    redraw(); modal.append(body); this.root.append(modal);
  }

  menu(): void {
    const g = this.game, modal = h('div', { class: 'modal', onclick: (e: Event) => { if (e.target === modal) modal.remove(); } });
    const act = (t: string, f: () => void): HTMLElement => h('button', { class: 'btn', style: { width: '100%', margin: '4px 0', padding: '8px' }, onclick: () => { modal.remove(); f(); } }, t);
    modal.append(h('div', { class: 'card panel', style: { width: '320px' } }, h('h2', {}, 'MENU'),
      act('Novo mundo…', () => this.newWorldDialog()), act('Salvar mundo', () => { this.toast(saveGame(g) ? 'Mundo salvo.' : 'Não foi possível salvar (armazenamento cheio?).'); }),
      act('Carregar mundo', () => { if (!loadGame(g)) this.toast('Nenhum save encontrado.'); }),
      act('Exportar arquivo…', () => exportSave(g)),
      act('Importar arquivo…', () => { const i = h('input', { type: 'file', accept: '.json', onchange: async () => { const f = i.files?.[0]; if (f) this.toast((await importSave(g, f)) ? 'Mundo importado.' : 'Arquivo inválido.'); } }); i.click(); }),
      act('Fechar', () => {})));
    this.root.append(modal);
  }

  toast(text: string): void { const m = h('div', { class: 'msg info' }, text); this.feed.append(m); setTimeout(() => m.remove(), 4000); }

  /* ---------- input ---------- */
  keys = new Set<string>();
  private applyTool(sx: number, sy: number): void {
    const g = this.game, t = g.tool; if (!t) return;
    const { tx, ty } = g.cam.toTile(sx, sy);
    if (!g.sim.world.inb(tx, ty)) return;
    t.apply(g.sim, tx, ty, t.brush ? g.brush : Math.max(1, Math.floor(g.brush / 2)));
  }

  private pickAt(sx: number, sy: number): Sel | null {
    const g = this.game, sim = g.sim, w = g.cam.toWorld(sx, sy), tx = w.x / TILE, ty = w.y / TILE;
    let best: Unit | null = null, bd = 1.5;
    sim.near(tx, ty + 0.5, 2, u => { const flyOff = u.species === 'bird' ? 0.9 : u.species === 'dragon' ? 1.5 : 0; const d = Math.hypot(u.x - tx, u.y - flyOff - (ty + 0.3)); if (d < bd) { bd = d; best = u; } });
    if (best) return { kind: 'unit', id: (best as Unit).id };
    // buildings are tall: also test the sprite's roof area above the footprint
    let bb: Building | null = null;
    for (const b of sim.buildings.values()) { if (tx >= b.x - 0.3 && tx <= b.x + b.def.w + 0.3 && ty >= b.y - 1.6 && ty <= b.y + b.def.h) { if (!bb || b.y > bb.y) bb = b; } }
    if (bb) return { kind: 'building', id: bb.id };
    const zi = sim.world.zone[Math.floor(ty) * sim.world.w + Math.floor(tx)];
    if (zi && sim.cities.has(zi)) return { kind: 'city', id: zi };
    return null;
  }

  private bindInput(): void {
    const c = this.canvas, g = this.game, p = this.pointer;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      const dpr = window.devicePixelRatio || 1;
      p.x = e.clientX * dpr; p.y = e.clientY * dpr; p.sx = p.x; p.sy = p.y; p.moved = false; p.fire = 0;
      c.setPointerCapture(e.pointerId);
      if (e.button === 0 && g.tool) { p.mode = 'tool'; this.applyTool(p.x, p.y); }
      else if (e.button === 0) p.mode = 'click'; else p.mode = 'pan';
    });
    c.addEventListener('pointermove', e => {
      const dpr = window.devicePixelRatio || 1, nx = e.clientX * dpr, ny = e.clientY * dpr;
      if (p.mode === 'pan' || p.mode === 'click') {
        if (Math.hypot(nx - p.sx, ny - p.sy) > 5) p.moved = true;
        if (p.moved) { g.cam.x -= (nx - p.x) / g.cam.zoom; g.cam.y -= (ny - p.y) / g.cam.zoom; g.cam.clamp(); g.follow = null; }
      }
      p.x = nx; p.y = ny;
    });
    c.addEventListener('pointerup', e => {
      if (p.mode === 'click' && !p.moved && e.button === 0) { const s = this.pickAt(p.x, p.y); this.select(s); if (s?.kind === 'unit') g.follow = null; }
      p.mode = 'none';
    });
    c.addEventListener('wheel', e => { e.preventDefault(); const dpr = window.devicePixelRatio || 1; g.cam.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX * dpr, e.clientY * dpr); }, { passive: false });
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k); if (e.shiftKey) this.keys.add('Shift');
      if (k === ' ') { e.preventDefault(); this.setSpeed(g.speed === 0 ? 1 : 0); }
      else if (k >= '1' && k <= '4' && !e.ctrlKey) this.setSpeed([1, 2, 4, 8][+k - 1]);
      else if (k === '[') { g.brush = Math.max(0, g.brush - 1); (this.root.querySelector('.brush input') as HTMLInputElement).value = String(g.brush); }
      else if (k === ']') { g.brush = Math.min(12, g.brush + 1); (this.root.querySelector('.brush input') as HTMLInputElement).value = String(g.brush); }
      else if (k === '+' || k === '=') g.cam.zoomAt(1, g.cam.vw / 2, g.cam.vh / 2);
      else if (k === '-') g.cam.zoomAt(-1, g.cam.vw / 2, g.cam.vh / 2);
      else if (k === 'Escape') this.pick(null);
      else if (k === 'q') this.setTab(TABS[(TABS.findIndex(t => t.id === this.tab) + TABS.length - 1) % TABS.length].id);
      else if (k === 'e') this.setTab(TABS[(TABS.findIndex(t => t.id === this.tab) + 1) % TABS.length].id);
    });
    window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys.delete(k); if (!e.shiftKey) this.keys.delete('Shift'); });
    window.addEventListener('blur', () => this.keys.clear());
  }
}
