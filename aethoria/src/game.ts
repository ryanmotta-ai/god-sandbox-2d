import { generateWorld, DEFAULT_GEN, type GenConfig } from './world/gen';
import { Sim } from './sim/sim';
import { Sound } from './core/sound';
import { newKingdom } from './sim/kingdom';
import { foundCity } from './sim/city';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { TICK_DT } from './core/config';
import { TILE } from './core/config';
import { TERRAIN } from './world/defs';
import type { Species } from './sim/species';
import type { Race } from './gfx/humanoid';
import type { Unit } from './sim/unit';
import type { Power } from './sim/powers';

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
  const goodGround = new Set([4, 3, 6, 5]);
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
  const wild: Species[] = ['sheep', 'sheep', 'sheep', 'cow', 'cow', 'deer', 'deer', 'deer', 'rabbit', 'rabbit', 'rabbit', 'chicken', 'chicken', 'wolf', 'boar', 'bear', 'bird', 'bird'];
  const n = Math.floor((size * size) / 130 * s.wildlife);
  for (let k = 0; k < n; k++) {
    const x = sim.rng.int(2, size - 3), y = sim.rng.int(2, size - 3), t = world.t(x, y);
    if (!sim.walkable(x, y) || TERRAIN[t].water) continue;
    let sp = sim.rng.pick(wild);
    // keep the dangerous ones away from the founders: a first village should have a chance
    if ((sp === 'wolf' || sp === 'bear' || sp === 'boar') && placed.some(p => Math.hypot(p.x - x, p.y - y) < 30)) sp = 'sheep';
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
  sound = new Sound();
  follow: Unit | null = null;
  tool: Power | null = null;
  brush = 2;

  constructor(public canvas: HTMLCanvasElement) { this.newWorld(DEFAULT_SETUP); }

  newWorld(s: Setup): void {
    this.setup = s;
    const world = generateWorld(s);
    this.sim = new Sim(world, s.seed);
    populate(this.sim, s);
    if (!this.cam) { this.cam = new Camera(world.w, world.h); this.renderer = new Renderer(this.canvas, this.sim, this.cam); this.renderer.sound = this.sound; }
    else { this.cam.worldW = world.w; this.cam.worldH = world.h; this.cam.x = world.w * TILE / 2; this.cam.y = world.h * TILE / 2; this.renderer.setSim(this.sim); }
    const first = this.sim.units.find(u => u.def.civ);
    if (first) { this.cam.x = first.x * TILE; this.cam.y = first.y * TILE; }
    this.acc = 0; this.follow = null;
    for (const f of this.onWorld) f();
  }

  /** Replace the running world with a restored one (load / import). */
  useSim(sim: Sim): void {
    this.sim = sim;
    this.cam.worldW = sim.world.w; this.cam.worldH = sim.world.h;
    this.renderer.setSim(sim);
    this.setup = { ...this.setup, size: sim.world.w, seed: sim.world.seed };
    this.acc = 0; this.follow = null;
    for (const f of this.onWorld) f();
  }

  /** Dev helper: two armies of `n` face each other on open ground near the camera. */
  debugBattle(n = 14): void {
    const sim = this.sim, cx = Math.floor(this.cam.x / TILE), cy = Math.floor(this.cam.y / TILE);
    const a = newKingdom(sim, 'human'), b = newKingdom(sim, 'orc');
    a.wars.add(b.id); b.wars.add(a.id);
    const roles: Unit['role'][] = ['knight', 'soldier', 'soldier', 'archer'];
    for (const [k, race, dx] of [[a, 'human', -16], [b, 'orc', 16]] as const) {
      const home = foundCity(sim, race, cx + dx * 2, cy, [], k); // a realm without a town is deleted next tick
      for (let i = 0; i < n; i++) {
        const sp = sim.freeSpot(cx + dx + (i % 4) * (dx < 0 ? -1.4 : 1.4), cy - 3 + Math.floor(i / 4) * 1.5, 3);
        if (!sp) continue;
        const u = sim.spawn(race, sp.x, sp.y, { role: roles[i % 4], kingdom: k.id, city: home.id });
        u.mode = 'march'; u.goalX = cx + (dx < 0 ? 5 : -5); u.goalY = sp.y;
      }
    }
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
    if (this.follow) { if (this.follow.alive) { const a = this.speed > 0 ? this.acc / TICK_DT : 1; this.cam.x += ((this.follow.px + (this.follow.x - this.follow.px) * a) * TILE - this.cam.x) * Math.min(1, dt * 6); this.cam.y += ((this.follow.py + (this.follow.y - this.follow.py) * a) * TILE - this.cam.y) * Math.min(1, dt * 6); } else this.follow = null; }
    this.renderer.draw(dt, this.speed > 0 ? this.acc / TICK_DT : 1);
  }
}
