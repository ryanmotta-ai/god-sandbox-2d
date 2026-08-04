/**
 * Persisted player settings. Every screen reads from the single `settings` instance,
 * and subscribers are notified so the renderer / sound can react immediately.
 */

export type DisasterFrequency = 'none' | 'rare' | 'normal' | 'chaos';

export interface GameSettings {
  // Audio
  soundEnabled: boolean;
  masterVolume: number; // 0..1

  // Graphics
  showGrid: boolean;
  showCityNames: boolean;
  showKingdomBadges: boolean;
  showHealthBars: boolean;
  showParticles: boolean;
  showBrushCursor: boolean;
  screenShake: boolean;

  // Interface
  showMinimap: boolean;
  showTooltips: boolean;
  compactToolbar: boolean;
  uiScale: number; // 0.85..1.2

  // Simulation
  defaultSpeed: number;
  autosaveEnabled: boolean;
  autosaveIntervalYears: number;
  disasterFrequency: DisasterFrequency;
}

const STORAGE_KEY = 'aethoria_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  masterVolume: 0.6,

  showGrid: false,
  showCityNames: true,
  showKingdomBadges: true,
  showHealthBars: true,
  showParticles: true,
  showBrushCursor: true,
  screenShake: true,

  showMinimap: true,
  showTooltips: true,
  compactToolbar: false,
  uiScale: 1,

  defaultSpeed: 1,
  autosaveEnabled: false,
  autosaveIntervalYears: 25,
  disasterFrequency: 'normal'
};

type Listener = (settings: GameSettings) => void;

class SettingsStore {
  public values: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.load();
  }

  public get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.values[key];
  }

  public set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.persist();
    this.emit();
  }

  public reset(): void {
    this.values = { ...DEFAULT_SETTINGS };
    this.persist();
    this.emit();
  }

  public onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.values);
      } catch (err) {
        console.error('Settings listener failed:', err);
      }
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* storage unavailable — settings stay in-memory for this session */
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Merge so new settings keys added later still get their defaults.
      this.values = { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      this.values = { ...DEFAULT_SETTINGS };
    }
  }
}

export const settings = new SettingsStore();
