import type { Game } from '../game';
export function saveGame(_g: Game): void { /* filled in by the save task */ }
export function loadGame(_g: Game): boolean { return false; }
export function hasSave(): boolean { return false; }
