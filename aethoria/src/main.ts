import { generateWorld, DEFAULT_GEN, type Preset } from './world/gen';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { TILE } from './core/config';

const params = new URLSearchParams(location.search);
const world = generateWorld({
  ...DEFAULT_GEN,
  size: +(params.get('size') ?? 160), seed: +(params.get('seed') ?? 3), preset: (params.get('preset') ?? 'continents') as Preset,
});
const canvas = document.getElementById('game') as HTMLCanvasElement;
const cam = new Camera(world.w, world.h);
const renderer = new Renderer(canvas, world, cam);
(window as any).aethoria = { world, cam, renderer };

let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  const dpr = window.devicePixelRatio || 1;
  cam.x -= (e.clientX - drag.x) * dpr / cam.zoom; cam.y -= (e.clientY - drag.y) * dpr / cam.zoom;
  drag = { x: e.clientX, y: e.clientY }; cam.clamp();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); const dpr = window.devicePixelRatio || 1; cam.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX * dpr, e.clientY * dpr); }, { passive: false });

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  renderer.draw(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void TILE;
