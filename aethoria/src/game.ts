import { generateWorld, DEFAULT_GEN, type GenConfig } from './world/gen';
import { Sim } from './sim/sim';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { TICK_DT } from './core/config';
import { TILE } from './core/config';
import { TERRAIN } from './world/defs';
import type { Species } from './sim/species';
import type { Race } from './gfx/humanoid';

export interface Setup extends GenConfig {
  races: Race[];
  /** Founders per race. */
  founders: number;
  wildlife: number; // 0..1 density
}
export const DEFAULT_SETUP: Setup = { ...DEFAULT_GEN, races: ['human', 'elf', 'dwarf', 'orc'], founders: 5, wildlife: 0.6 };

/** Settle each race on its own stretch of grass, far from the others, then scatter wildlife. */
export function populate(sim: Sim, s: Setup): void {
  const world = sim.world, size = world.w;
  const placed: { x: number; y: number }[] = [];
  const goodGround = new Set([4, 3, 6, 5, 9]);
  for (const race of s.races) {
    let best: { x: number; y: number } | null = null, bd = -1;
    for (let tries = 0; tries < 600; tries++) {
      const x = sim.rng.int(10, size - 10), y = sim.rng.int(10, size - 10);
      if (!goodGround.has(world.t(x, y))) continue;
      let flat = 0;
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (goodGround.has(world.t(x + i, y + j))) flat++;
      if (flat < 40) continue;
      const d = placed.length ? Math.min(...placed.map(p => Math.hypot(p.x - x, p.y - y))) : 1e6;
      if (d > bd) { bd = d; best = { x, y }; }
    }
    if (!best) continue;
    placed.push(best);
    for (let i = 0; i < s.founders; i++) { const sp = sim.freeSpot(best.x + sim.rng.range(-2, 2), best.y + sim.rng.range(-2, 2), 4); if (sp) sim.spawn(race, sp.x, sp.y, { role: 'peasant' }); }
  }
  const wild: Species[] = ['sheep', 'sheep', 'cow', 'deer', 'deer', 'rabbit', 'rabbit', 'chicken', 'wolf', 'boar', 'bear', 'bird', 'bird'];
  const n = Math.floor((size * size) / 130 * s.wildlife);
  for (let k = 0; k < n; k++) {
    const x = sim.rng.int(2, size - 3), y = sim.rng.int(2, size - 3), t = world.t(x, y);
    if (!sim.walkable(x, y) || TERRAIN[t].water) continue;
    const sp = sim.rng.pick(wild);
    if (sp === 'bird') { sim.spawn(sp, x + 0.5, y + 0.5); continue; }
    if (t === 2 && sim.rng.chance(0.3)) { sim.spawn('crab', x + 0.5, y + 0.5); continue; }
    if ((t === 7 || t === 5) && sim.rng.chance(0.2)) { sim.spawn('snake', x + 0.5, y + 0.5); continue; }
    sim.spawn(sp, x + 0.5, y + 0.5);
  }
}

/** Owns the simulation, the renderer and the clock. The UI talks to this and nothing else. */
export class Game {
  sim!: Sim;
  renderer!: Renderer;
  cam!: Camera;
  /** Sim seconds per real second; 0 = paused. */
  speed = 1;
  private acc = 0;
  setup: Setup = DEFAULT_SETUP;
  onWorld: (() => void)[] = [];

  constructor(public canvas: HTMLCanvasElement) { this.newWorld(DEFAULT_SETUP); }

  newWorld(s: Setup): void {
    this.setup = s;
    const world = generateWorld(s);
    this.sim = new Sim(world, s.seed);
    populate(this.sim, s);
    if (!this.cam) { this.cam = new Camera(world.w, world.h); this.renderer = new Renderer(this.canvas, this.sim, this.cam); }
    else { this.cam.worldW = world.w; this.cam.worldH = world.h; this.cam.x = world.w * TILE / 2; this.cam.y = world.h * TILE / 2; this.renderer.setSim(this.sim); }
    const first = this.sim.units.find(u => u.def.civ);
    if (first) { this.cam.x = first.x * TILE; this.cam.y = first.y * TILE; }
    this.acc = 0;
    for (const f of this.onWorld) f();
  }

  /** Advance by real `dt` seconds: fixed 20 Hz sim steps (as many as the speed asks, within a frame budget), then draw. */
  frame(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.acc += dt * this.speed;
    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= TICK_DT && steps < 400) {
      this.sim.tick(); this.acc -= TICK_DT; steps++;
      if (performance.now() - t0 > 14) { this.acc = Math.min(this.acc, TICK_DT * 2); break; }
    }
    this.renderer.draw(dt, this.speed > 0 ? this.acc / TICK_DT : 1);
  }
}
