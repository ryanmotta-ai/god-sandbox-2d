import { TileMap } from '../../world/TileMap';
import { SimulationEngine } from '../../ai/EntityAI';
import { Camera } from '../../renderer/Camera';
import { ParticleManager } from '../../renderer/Particles';
import { BrushManager } from '../../powers/BrushManager';
import { EraManager, WorldEra } from '../../world/WeatherEras';
import { OverlayManager } from '../../renderer/Overlays';
import { GeneratorPreset } from '../../world/WorldGenerator';
import { BLUEPRINT_LIST } from '../../world/WorldBlueprints';
import { SpeciesType } from '../../entities/Species';
import { StatsTracker } from './StatsTracker';
import type { ScreenManager } from './ScreenManager';
import type { SelectionManager } from '../hud/Selection';
import type { WorldSnapshot } from './WorldSnapshot';
import type { ToastType } from '../components/Toasts';

/** Everything the "New World" screen can configure. */
export interface WorldConfig {
  size: number;
  preset: GeneratorPreset;
  seed: number;
  species: SpeciesType[];
  startingPopulation: number;
  spawnWildlife: boolean;
  era: WorldEra;
}

/**
 * The three worlds, described for the setup screen.
 *
 * The authority on what each world *is* lives in WorldBlueprints, so this list
 * is derived from it rather than restated — a description here that drifted from
 * the terrain there would be a lie the player only discovers after loading in.
 */
export const WORLD_PRESET_INFO: {
  id: GeneratorPreset;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
}[] = BLUEPRINT_LIST.map(b => ({
  id: b.id as GeneratorPreset,
  name: b.name,
  tagline: b.tagline,
  description: b.description,
  highlights: b.highlights
}));

/**
 * The bridge between the UI layer and the engine.
 * Screens never hold direct references to the simulation — a new world replaces
 * `sim`/`tileMap`, so everything must go through these live getters.
 */
export interface GameContext {
  readonly sim: SimulationEngine;
  readonly tileMap: TileMap;
  readonly camera: Camera;
  readonly particles: ParticleManager;
  readonly brush: BrushManager;
  readonly eras: EraManager;
  readonly overlays: OverlayManager;
  readonly stats: StatsTracker;
  readonly screens: ScreenManager;
  /** What the player currently has selected. See `hud/Selection.ts`. */
  readonly selection: SelectionManager;

  /** Current world generation parameters (for re-rolls and the pause screen summary). */
  readonly worldConfig: WorldConfig;

  readonly fps: number;
  readonly activeFires: number;
  readonly simSpeed: number;
  /** True once a world is running (i.e. not sitting on the title screen). */
  readonly inGame: boolean;

  setSpeed(speed: number): void;
  togglePause(): void;

  /** Generate a brand new world and enter the game. */
  startNewWorld(config: WorldConfig): void;
  /** Restore a serialized save and enter the game. */
  loadSaveData(data: any): boolean;
  /** Build a save payload for the current world. */
  buildSaveData(): any;
  /** Tear the world down and return to the title screen. */
  quitToMenu(): void;

  /** Center the camera on world tile coordinates. */
  focusOn(x: number, y: number, zoom?: number): void;
  /** Follow a specific entity until the camera is panned manually. */
  trackEntity(entityId: string | null): void;

  toast(message: string, type?: ToastType): void;
  /** Re-read the settings store and push the values into the renderer/audio. */
  applySettings(): void;

  /**
   * The world's aggregate figures, as of the last refresh.
   *
   * The HUD reads this instead of the simulation. It is a plain object, so
   * anything holding it is holding a value and cannot accidentally observe a
   * half-updated world mid-tick.
   */
  readonly snapshot: WorldSnapshot;
  /** Rebuilds the snapshot if it has gone stale, and returns it. */
  refreshSnapshot(now: number): WorldSnapshot;
}
