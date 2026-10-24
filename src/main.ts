import { Game, DEFAULT_SETUP, type Setup } from './game';
import { UI } from './ui/ui';

const params = new URLSearchParams(location.search);
const setup: Setup = { ...DEFAULT_SETUP, size: +(params.get('size') ?? 192), seed: +(params.get('seed') ?? 7), preset: (params.get('preset') ?? 'continents') as Setup['preset'] };
const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.newWorld(setup);
game.speed = +(params.get('speed') ?? 1);
const ui = new UI(game, canvas);
if (!params.has('notitle')) ui.title();
(window as any).aethoria = game;
(window as any).aethoriaUI = ui;

let last = performance.now();
function frame(now: number): void { const dt = Math.min(0.1, (now - last) / 1000); last = now; game.frame(dt); ui.update(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
