import { Game, DEFAULT_SETUP, type Setup } from './game';
import { TILE } from './core/config';

const params = new URLSearchParams(location.search);
const setup: Setup = { ...DEFAULT_SETUP, size: +(params.get('size') ?? 160), seed: +(params.get('seed') ?? 3), preset: (params.get('preset') ?? 'continents') as Setup['preset'] };
const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.newWorld(setup);
game.speed = +(params.get('speed') ?? 1);
(window as any).aethoria = game;

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dpr = window.devicePixelRatio || 1, cam = game.cam;
  cam.x -= (e.clientX - drag.x) * dpr / cam.zoom; cam.y -= (e.clientY - drag.y) * dpr / cam.zoom;
  drag = { x: e.clientX, y: e.clientY }; cam.clamp();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); const dpr = window.devicePixelRatio || 1; game.cam.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX * dpr, e.clientY * dpr); }, { passive: false });

let last = performance.now();
function frame(now: number): void { const dt = (now - last) / 1000; last = now; game.frame(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
void TILE;
