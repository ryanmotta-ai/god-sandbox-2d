import './style.css';

import { TileMap } from './world/TileMap';
import { SimulationEngine } from './ai/EntityAI';
import { Camera } from './renderer/Camera';
import { PixelRenderer } from './renderer/Renderer';
import { ParticleManager } from './renderer/Particles';
import { BrushManager } from './powers/BrushManager';
import { PowerExecutor } from './powers/GodPowers';
import { EraManager, WorldEra } from './world/WeatherEras';
import { OverlayManager } from './renderer/Overlays';
import { SpeciesType, SPECIES_DEFINITIONS } from './entities/Species';
import { chronicle } from './civ/Chronicle';
import { SaveSystem, AUTOSAVE_SLOT } from './core/SaveSystem';
import { sound } from './core/SoundSynth';
import { events } from './core/EventBus';
import { rng, resetIds } from './core/Random';
import { generateDynastyName } from './civ/Lineage';
import { DisasterSystem } from './powers/Disasters';

import { ScreenManager } from './ui/core/ScreenManager';
import { StatsTracker } from './ui/core/StatsTracker';
import { settings } from './ui/core/Settings';
import { GameContext, WorldConfig } from './ui/core/GameContext';
import { ToastManager, ToastType } from './ui/components/Toasts';
import { HUD } from './ui/hud/HUD';
import { CATEGORIES } from './ui/hud/Toolbar';

import { MainMenuScreen } from './ui/screens/MainMenuScreen';
import { WorldSetupScreen } from './ui/screens/WorldSetupScreen';
import { LoadingScreen } from './ui/screens/LoadingScreen';
import { PauseScreen } from './ui/screens/PauseScreen';
import { KingdomsScreen } from './ui/screens/KingdomsScreen';
import { DiplomacyScreen } from './ui/screens/DiplomacyScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { BestiaryScreen } from './ui/screens/BestiaryScreen';
import { ChronicleScreen } from './ui/screens/ChronicleScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { HelpScreen } from './ui/screens/HelpScreen';
import { SaveLoadScreen } from './ui/screens/SaveLoadScreen';
import { CreditsScreen } from './ui/screens/CreditsScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';

import { PoliticsScreen } from './ui/screens/PoliticsScreen';
import { EconomyScreen } from './ui/screens/EconomyScreen';
import { WarfareScreen } from './ui/screens/WarfareScreen';
import { DynastyScreen } from './ui/screens/DynastyScreen';
import { EcosystemScreen } from './ui/screens/EcosystemScreen';
import { TechTreeScreen } from './ui/screens/TechTreeScreen';
import { InfrastructureScreen } from './ui/screens/InfrastructureScreen';
import { UIKitScreen } from './ui/screens/UIKitScreen';
import { CityScreen } from './ui/screens/CityScreen';
import { RealmScreen } from './ui/screens/RealmScreen';
import { SelectionManager } from './ui/hud/Selection';
import { WorldSnapshotProvider } from './ui/core/WorldSnapshot';
import { alerts } from './ui/core/Alerts';
import { objectNav } from './ui/kit';

type AppState = 'menu' | 'loading' | 'playing';

/** Probability that the world spawns a disaster on its own, rolled once per simulated year. */
const DISASTER_CHANCE_PER_YEAR: Record<string, number> = {
  none: 0,
  rare: 0.02,
  normal: 0.07,
  chaos: 0.3
};

const DEFAULT_WORLD_CONFIG: WorldConfig = {
  size: 128,
  preset: 'single_continent',
  seed: Math.floor(Math.random() * 2147483647),
  species: [SpeciesType.HUMAN],
  startingPopulation: 2,
  spawnWildlife: true,
  era: WorldEra.GOLDEN_AGE
};

class AethoriaGame implements GameContext {
  // ---- Engine ----
  private canvas: HTMLCanvasElement;
  private renderer: PixelRenderer;

  public camera = new Camera();
  public tileMap!: TileMap;
  public sim!: SimulationEngine;
  public particles = new ParticleManager();
  public brush = new BrushManager();
  public eras = new EraManager();
  public overlays = new OverlayManager();
  public stats = new StatsTracker();
  public screens: ScreenManager;
  public selection = new SelectionManager();
  public worldConfig: WorldConfig = { ...DEFAULT_WORLD_CONFIG };

  /** Cached world aggregates the HUD reads instead of walking the simulation. */
  private snapshots = new WorldSnapshotProvider();

  // ---- UI ----
  private toasts: ToastManager;
  private hud!: HUD;
  private loadingScreen = new LoadingScreen();
  private economyScreen = new EconomyScreen();

  // ---- Runtime ----
  private state: AppState = 'menu';
  public simSpeed = 0;
  private simTickAccumulator = 0;
  public fps = 60;
  public activeFires = 0;

  private speedBeforePause = 1;
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private lastYearSeen = 1;
  private lastAutosaveYear = 0;
  private extinctionAnnounced = false;
  private hadCivilisation = false;

  private isMouseDown = false;
  private isRightMouseDown = false;
  private lastMousePos = { x: 0, y: 0 };
  private hoverWorldPos: { x: number; y: number } | null = null;
  private menuPanAngle = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new PixelRenderer(this.canvas);

    this.screens = new ScreenManager(
      document.getElementById('screen-root')!,
      document.getElementById('hud-root')!
    );
    this.toasts = new ToastManager(document.getElementById('toast-root')!);

    // A quiet demo world runs behind the title screen.
    this.buildWorld({ ...DEFAULT_WORLD_CONFIG, seed: Math.floor(Math.random() * 2147483647) }, false);

    this.hud = new HUD(this, document.getElementById('hud-root')!);
    this.registerScreens();
    this.screens.attachContext(this);

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    this.setupInput();
    this.setupSimulationEvents();
    this.registerObjectNavigation();
    // The inspector's own link handlers replace the ones above for the kinds it
    // can display, so that following a link opens the panel rather than only
    // moving the camera. Registered after, because `registerOpener` replaces by
    // kind and the more capable handler must win.
    this.hud.inspector.registerLinkNavigation();
    // `good` is the last object kind with no opener: UI-5 owns it, so every goods
    // link in the game becomes navigable here rather than rendering inert.
    this.economyScreen.registerLinkNavigation();
    this.applySettings();

    this.screens.replace('main-menu');
    requestAnimationFrame(t => this.gameLoop(t));
  }

  public get inGame(): boolean {
    return this.state === 'playing';
  }

  // ============================ SCREEN REGISTRY ============================

  private registerScreens(): void {
    this.screens.register(new MainMenuScreen());
    this.screens.register(new WorldSetupScreen());
    this.screens.register(this.loadingScreen);
    this.screens.register(new PauseScreen());
    this.screens.register(new KingdomsScreen());
    this.screens.register(new DiplomacyScreen());
    this.screens.register(new StatsScreen());
    this.screens.register(new BestiaryScreen());
    this.screens.register(new ChronicleScreen());
    this.screens.register(new SettingsScreen());
    this.screens.register(new HelpScreen());
    this.screens.register(new SaveLoadScreen());
    this.screens.register(new CreditsScreen());
    this.screens.register(new GameOverScreen());

    this.screens.register(new PoliticsScreen());
    this.screens.register(this.economyScreen);
    this.screens.register(new WarfareScreen());
    this.screens.register(new DynastyScreen());
    this.screens.register(new EcosystemScreen());
    this.screens.register(new TechTreeScreen());
    this.screens.register(new InfrastructureScreen());
    this.screens.register(new CityScreen());
    this.screens.register(new RealmScreen());
    // Development gallery for the UI kit. Not on any navigation path — opened
    // from the debug panel.
    this.screens.register(new UIKitScreen());
  }

  // ============================ WORLD LIFECYCLE ============================

  /** Replaces the world. `seedLife` is false for the decorative menu backdrop. */
  private buildWorld(config: WorldConfig, seedLife: boolean): void {
    this.worldConfig = { ...config };

    // Everything that happens after worldgen (spawns, wildlife, menu noise) is
    // driven by the same seed, so a given world is fully reproducible.
    rng.setSeed((config.seed ^ 0x9e3779b9) >>> 0);
    // Ids are part of the seeded world too: replaying a seed must produce the
    // same entities and settlements, not just the same terrain.
    resetIds();

    this.tileMap = new TileMap(config.size, config.size, config.preset, config.seed);
    this.sim = new SimulationEngine();
    this.particles = new ParticleManager();
    this.eras.setEra(config.era);
    this.stats.reset();
    this.renderer.setDiplomacy(this.sim.diplomacy);

    // Every UI-1 surface that holds world state is re-pointed here, in one place,
    // so a new world cannot leave one of them showing the previous one.
    this.selection.attach(this.sim, this.tileMap);
    this.snapshots.reset();
    this.renderer.setSelection(null);
    alerts.attach(this.sim);

    this.camera.centerOn(config.size / 2, config.size / 2, 1);
    this.lastYearSeen = 1;
    this.lastAutosaveYear = 0;
    this.extinctionAnnounced = false;
    this.hadCivilisation = false;

    if (seedLife) {
      chronicle.clear();
      this.seedLife(config);
    } else {
      // The menu backdrop still wants a little movement in the world.
      this.seedLife({ ...config, startingPopulation: 6, spawnWildlife: true });
    }
  }

  private seedLife(config: WorldConfig): void {
    const spawnPoints = this.findSpawnPoints(config.species);

    config.species.forEach((species, index) => {
      const point = spawnPoints[index] ?? spawnPoints[0];
      if (!point) return;

      const foundingDynasty = generateDynastyName(species);

      for (let i = 0; i < config.startingPopulation; i++) {
        // Enforce 1 Male and 1 Female when starting with a pair (or alternating male/female)
        const forcedGender: 'male' | 'female' = i % 2 === 0 ? 'male' : 'female';

        const entity = this.sim.spawnEntity(
          species,
          point.x + rng.range(-2, 2),
          point.y + rng.range(-2, 2),
          this.tileMap,
          forcedGender
        );

        // Give them a shared founding dynasty name so they pair off immediately
        entity.dynasty = foundingDynasty;
      }
    });

    if (config.spawnWildlife) {
      // A real food chain is mostly prey. Seeding half the wildlife as wolves and
      // bears meant the founding bands were hunted to the edge of extinction in
      // their first years, and the predators then starved with nothing left to eat.
      const fauna = [
        SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER, SpeciesType.DEER,
        SpeciesType.DEER, SpeciesType.BOAR, SpeciesType.BOAR, SpeciesType.EAGLE,
        SpeciesType.WOLF, SpeciesType.BEAR
      ];
      const wildCount = Math.round((config.size * config.size) / 700);
      for (let i = 0; i < wildCount; i++) {
        const spot = this.randomWalkableTile();
        if (!spot) continue;
        this.sim.spawnEntity(fauna[rng.rangeInt(0, fauna.length - 1)], spot.x, spot.y, this.tileMap);
      }
    }

    // Births during world seeding are not really births.
    this.sim.totalBirths = 0;

    const names = config.species.map(s => SPECIES_DEFINITIONS[s].name).join(' and ');
    chronicle.log(1, 'founding', `Aethoria takes shape. The ${names} awaken upon the land.`);
  }

  /**
   * Picks well-separated walkable tiles so civilizations don't start on top of
   * each other. Each species first tries its `preferredBiomes`, then falls back
   * to any walkable tile, then to the map centre.
   */
  private findSpawnPoints(species: SpeciesType[]): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const minDistance = this.tileMap.width / (species.length + 1);
    const tooClose = (candidate: { x: number; y: number }) =>
      points.some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < minDistance);

    for (const sp of species) {
      let point: { x: number; y: number } | null = null;
      const preferred = SPECIES_DEFINITIONS[sp]?.preferredBiomes;

      for (let attempt = 0; attempt < 400 && !point; attempt++) {
        const candidate = this.randomWalkableTile(preferred);
        if (!candidate) break;
        if (!tooClose(candidate)) point = candidate;
      }
      for (let attempt = 0; attempt < 200 && !point; attempt++) {
        const candidate = this.randomWalkableTile();
        if (!candidate) break;
        if (!tooClose(candidate)) point = candidate;
      }
      if (!point) {
        point = { x: Math.floor(this.tileMap.width / 2), y: Math.floor(this.tileMap.height / 2) };
      }
      points.push(point);
    }

    return points;
  }

  private randomWalkableTile(preferredBiomes?: string[]): { x: number; y: number } | null {
    const hasPreferred = !!preferredBiomes && preferredBiomes.length > 0;
    for (let i = 0; i < 200; i++) {
      const x = rng.rangeInt(2, this.tileMap.width - 3);
      const y = rng.rangeInt(2, this.tileMap.height - 3);
      const tile = this.tileMap.getTile(x, y);
      if (!tile || tile.type.includes('ocean') || tile.type === 'mountain' || tile.type === 'lava') continue;
      if (hasPreferred && !preferredBiomes.includes(tile.type)) continue;
      return { x, y };
    }
    if (hasPreferred) return this.randomWalkableTile();
    return null;
  }

  public startNewWorld(config: WorldConfig): void {
    this.screens.replace('loading', { title: 'Creating Aethoria' });
    this.simSpeed = 0;

    // Let the loading screen paint before the synchronous generation blocks the thread.
    this.runLoadingSequence(
      [
        { label: 'Raising continents…', work: () => this.buildWorld(config, true) },
        { label: 'Seeding the first life…', work: () => {} },
        { label: 'Winding the clock…', work: () => { this.stats.maybeSample(this.sim); } }
      ],
      () => this.enterGame()
    );
  }

  public loadSaveData(data: any): boolean {
    if (!data || !data.world) return false;

    this.screens.replace('loading', { title: 'Restoring World' });
    this.simSpeed = 0;

    let ok = true;
    this.runLoadingSequence(
      [
        {
          label: 'Reading the archive…',
          work: () => {
            try {
              // A throwaway 8x8 map, replaced immediately by the save being restored.
              this.tileMap = new TileMap(8, 8, 'single_continent', 1);
              this.sim = new SimulationEngine();
              this.particles = new ParticleManager();
              this.stats.reset();
              this.renderer.setDiplomacy(this.sim.diplomacy);
              SaveSystem.importSaveData(data, this.tileMap, this.sim, this.eras);
            } catch (err) {
              console.error('Failed to restore save:', err);
              ok = false;
            }
          }
        },
        {
          label: 'Rebuilding the world…',
          work: () => {
            if (!ok) return;
            this.worldConfig = {
              ...this.worldConfig,
              size: this.tileMap.width,
              seed: this.tileMap.seed,
              era: this.eras.getCurrentEra()
            };
            this.camera.centerOn(this.tileMap.width / 2, this.tileMap.height / 2, 1);
            this.lastYearSeen = this.sim.currentYear;
            this.lastAutosaveYear = this.sim.currentYear;
            this.extinctionAnnounced = false;
            this.hadCivilisation = this.countCivilised() > 0;
          }
        }
      ],
      () => {
        if (ok) {
          this.enterGame();
        } else {
          this.screens.replace('main-menu');
          this.toast('That save file could not be restored', 'warning');
        }
      }
    );

    return ok;
  }

  /** Runs blocking steps one animation frame apart so the loading bar actually renders. */
  private runLoadingSequence(steps: { label: string; work: () => void }[], done: () => void): void {
    let index = 0;
    const next = () => {
      if (index >= steps.length) {
        this.loadingScreen.setProgress(1, 'Ready');
        window.setTimeout(done, 180);
        return;
      }
      const step = steps[index];
      this.loadingScreen.setProgress(index / steps.length, step.label);
      window.setTimeout(() => {
        step.work();
        index++;
        next();
      }, 60);
    };
    // Deliberately not requestAnimationFrame: a backgrounded tab stops painting
    // frames, and world creation must still finish rather than hanging forever.
    window.setTimeout(next, 16);
  }

  private enterGame(): void {
    this.state = 'playing';
    this.screens.closeAll();
    this.setSpeed(settings.get('defaultSpeed'));
    this.hadCivilisation = this.countCivilised() > 0;
    // News is only accepted once there is a player watching. The menu backdrop is
    // a live world too, and its wars are not this game's business.
    alerts.setEnabled(true);
    this.toast(`Year ${this.sim.currentYear} · ${this.eras.getCurrentEra()}`, 'success');
  }

  public quitToMenu(): void {
    this.state = 'menu';
    this.simSpeed = 0;
    this.hud.inspector.hide();
    this.selection.clear();
    alerts.setEnabled(false);
    this.toasts.clear();
    this.buildWorld({ ...DEFAULT_WORLD_CONFIG, seed: Math.floor(Math.random() * 2147483647) }, false);
    this.screens.replace('main-menu');
  }

  public buildSaveData(): any {
    return SaveSystem.exportSaveData(this.tileMap, this.sim, this.eras);
  }

  // ============================ CONTEXT ACTIONS ============================

  public setSpeed(speed: number): void {
    this.simSpeed = speed;
    if (speed > 0) this.speedBeforePause = speed;
  }

  public togglePause(): void {
    this.setSpeed(this.simSpeed === 0 ? this.speedBeforePause : 0);
  }

  public focusOn(x: number, y: number, zoom?: number): void {
    this.camera.targetEntityId = null;
    this.camera.centerOn(x, y, zoom);
  }

  public trackEntity(entityId: string | null): void {
    this.camera.targetEntityId = entityId;
  }

  public toast(message: string, type: ToastType = 'info'): void {
    this.toasts.show(message, type);
  }

  public get snapshot() {
    return this.snapshots.current;
  }

  public refreshSnapshot(now: number) {
    return this.snapshots.refresh(this.sim, now);
  }

  /**
   * Teaches object links how to open each kind of thing.
   *
   * UI-0 built the registry and deliberately left it empty; this is where it gets
   * filled in. Registered once at startup rather than per world, because the
   * handlers close over `this` and read the live `sim` through it.
   */
  private registerObjectNavigation(): void {
    objectNav.registerOpener('city', ref => {
      const city = this.sim.cities.get(ref.id);
      if (!city) return;
      this.selection.select({ kind: 'city', id: ref.id });
      this.focusOn(city.x, city.y);
    });

    // A realm reference opens the UI-4 dossier. Before it existed the best a
    // kingdom link could do was move the camera to the capital, which answered a
    // different question than the one the player asked by clicking a realm's name.
    objectNav.registerOpener('kingdom', ref => {
      if (!this.sim.kingdoms.has(ref.id)) return;
      this.selection.select({ kind: 'kingdom', id: ref.id });
      this.screens.open('realm', { focusKingdom: ref.id });
    });

    objectNav.registerOpener('citizen', ref => {
      const entity = this.sim.entities.find(e => e.id === ref.id);
      if (!entity) return;
      this.selection.select({ kind: 'citizen', id: ref.id });
      this.focusOn(entity.x, entity.y);
    });
  }

  public applySettings(): void {
    const s = settings.values;

    sound.setMuted(!s.soundEnabled);
    sound.setVolume(s.masterVolume);

    this.camera.shakeEnabled = s.screenShake;
    this.renderer.setOptions({
      showGrid: s.showGrid,
      showCityNames: s.showCityNames,
      showKingdomBadges: s.showKingdomBadges,
      showHealthBars: s.showHealthBars,
      showParticles: s.showParticles,
      showBrushCursor: s.showBrushCursor
    });

    this.hud?.applySettings();
    document.documentElement.style.setProperty('--ui-scale', `${s.uiScale}`);
  }

  // ============================ SIMULATION EVENTS ============================

  /**
   * The non-visual consequences of world events: sound, screen shake, chronicle.
   *
   * The *text* of these events used to be toasted from here as well. It is not
   * any more — every one of them now reaches the player through the alert centre
   * or the event feed, and emitting both meant a war declaration appeared twice,
   * once as a transient toast and once as a clickable alert. Toasts are reserved
   * for feedback on something the player themselves just did.
   *
   * What stays here is what the alert system has no business doing: an alert
   * cannot shake the camera, and the Chronicle is the simulation's record rather
   * than the HUD's.
   */
  private setupSimulationEvents(): void {
    events.on('warStarted', () => {
      if (!this.inGame) return;
      sound.playThunder();
    });

    events.on('cityCaptured', (d: any) => {
      if (!this.inGame) return;
      sound.playExplosion();
      // Shake the world when a capital falls.
      if (d.wasCapital) this.camera.triggerShake(10, 0.5);
    });

    events.on('warEnded', (d: any) => {
      if (!this.inGame) return;
      const k1 = this.sim.kingdoms.get(d.k1);
      const k2 = this.sim.kingdoms.get(d.k2);
      chronicle.log(this.sim.currentYear, 'peace', `${k1?.name ?? 'A realm'} and ${k2?.name ?? 'another realm'} signed a peace treaty.`);
    });

    events.on('eraChanged', (era: WorldEra) => {
      if (!this.inGame) return;
      chronicle.log(this.sim.currentYear, 'kingdom', `The world enters the ${era}.`);
    });

    events.on('greatBridgeOpened', () => {
      if (!this.inGame) return;
      // A celebration, not an emergency: no shake, and the camera stays where the
      // player put it. `playMagic` is the closest thing to a fanfare.
      sound.playMagic();
    });
  }

  private keysHeld: Set<string> = new Set();

  private setupInput(): void {
    this.canvas.addEventListener('mousedown', e => {
      if (!this.inGame || this.screens.isOpen()) return;
      if (e.button === 0) {
        this.isMouseDown = true;
        this.applyActivePower(e.clientX, e.clientY);
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
      }
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    this.canvas.addEventListener('mousemove', e => {
      const world = this.camera.screenToWorld(e.clientX, e.clientY, this.canvas.width, this.canvas.height);
      this.hoverWorldPos = { x: Math.floor(world.x), y: Math.floor(world.y) };

      if (this.isRightMouseDown) {
        this.camera.pan(e.clientX - this.lastMousePos.x, e.clientY - this.lastMousePos.y);
      } else if (this.isMouseDown && this.inGame && this.brush.activePowerId !== 'inspect_select') {
        this.applyActivePower(e.clientX, e.clientY);
      }

      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.camera.zoomAt(e.deltaY < 0 ? 0.2 : -0.2, e.clientX, e.clientY, this.canvas.width, this.canvas.height);
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
      this.keysHeld.add(e.code);
      this.keysHeld.add(e.key.toLowerCase());
      this.handleKey(e);
    });

    window.addEventListener('keyup', e => {
      this.keysHeld.delete(e.code);
      this.keysHeld.delete(e.key.toLowerCase());
    });
  }

  private handleKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    /**
     * ESC unwinds one thing at a time, smallest first.
     *
     * Screens have first claim, then the HUD's own chain (open menu → powers
     * palette → armed tool → inspector → selection), and only when there is
     * nothing left to dismiss does it open the pause menu. Pressing ESC should
     * never skip past something the player can see and go straight to a menu.
     */
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.screens.handleEscape()) return;
      if (this.inGame && this.hud.handleEscape()) return;
      if (this.inGame) this.screens.open('pause');
      return;
    }

    // While a screen is open, only screen-level keys apply.
    if (this.screens.isOpen()) return;
    if (!this.inGame) return;

    const key = e.key.toLowerCase();

    // Shift + number selects a power category.
    if (e.shiftKey && /^[1-7]$/.test(e.key)) {
      e.preventDefault();
      this.hud.toolbar.selectCategoryByIndex(parseInt(e.key, 10) - 1);
      this.toast(`Category: ${CATEGORIES[parseInt(e.key, 10) - 1].label}`, 'info');
      return;
    }

    switch (key) {
      case ' ':
        e.preventDefault();
        this.togglePause();
        // No toast: the top bar's speed control already shows the state, and a
        // notification for something the player just did themselves is noise.
        return;
      // The number keys mirror the five buttons in the top bar, in order.
      case '1': this.setSpeed(1); return;
      case '2': this.setSpeed(2); return;
      case '3': this.setSpeed(5); return;
      case '4': this.setSpeed(10); return;
      case '[': this.hud.toolbar.cycleBrushSize(-1); return;
      case ']': this.hud.toolbar.cycleBrushSize(1); return;
      case 'f': e.preventDefault(); this.hud.toolbar.focusSearch(); return;
      case 'v': this.hud.cycleOverlay(); return;
      case 'c': this.screens.open('chronicle'); return;
      case 'k': this.screens.open('kingdoms'); return;
      case 'l': case 'y': this.screens.open('diplomacy'); return;
      case 'g': this.screens.open('stats'); return;
      case 'b': this.screens.open('bestiary'); return;
      case 'n': this.screens.open('infrastructure'); return;
      // The old dock drew key caps for P, E, W and T on its buttons, but nothing
      // ever bound them — the hints were decoration. UI-1 shows shortcuts in
      // tooltips, and a tooltip that names a key that does nothing is worse than
      // no tooltip, so these are now real.
      case 'p': this.screens.open('politics'); return;
      case 'e': this.screens.open('economy'); return;
      case 'w': this.screens.open('warfare'); return;
      case 't': this.screens.open('techtree'); return;
      case 'm':
        this.hud.minimap.toggle();
        return;
      case 'i': this.hud.openInspectorForSelection(); return;
      case 'home':
        this.focusOn(this.tileMap.width / 2, this.tileMap.height / 2, 1);
        return;
      case 'tab':
        e.preventDefault();
        this.hud.toggleVisibility();
        return;
    }

    if (e.key === 'F1') { e.preventDefault(); this.screens.open('help'); }
    if (e.key === 'F3') { e.preventDefault(); this.hud.toggleDebug(); }
    if (e.key === 'F5') { e.preventDefault(); this.screens.open('saveload'); }
  }

  private applyActivePower(screenX: number, screenY: number): void {
    const world = this.camera.screenToWorld(screenX, screenY, this.canvas.width, this.canvas.height);
    const tx = Math.floor(world.x);
    const ty = Math.floor(world.y);

    if (this.brush.isInspecting) {
      // Selecting, not inspecting. The selection card answers most clicks on its
      // own; the drawer only opens if the player asks for it.
      this.selection.selectAt(tx, ty);
      return;
    }

    PowerExecutor.executePower(
      this.brush.activePowerId,
      tx,
      ty,
      this.brush.brushSize,
      this.tileMap,
      this.sim.spatialHash,
      this.sim.entities,
      (species, x, y) => this.sim.spawnEntity(species, x, y),
      this.particles,
      this.camera
    );
  }

  private handleResize(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  // ============================ GAME LOOP ============================

  private gameLoop(time: number): void {
    this.frameCount++;
    if (time - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = time;
    }

    // Continuous Smooth Keyboard Camera Movement
    if (this.state === 'playing' && !this.screens.isOpen()) {
      const activeEl = document.activeElement;
      if (!activeEl || !['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        let dirX = 0;
        let dirY = 0;
        if (this.keysHeld.has('KeyW') || this.keysHeld.has('w') || this.keysHeld.has('ArrowUp') || this.keysHeld.has('arrowup')) dirY -= 1;
        if (this.keysHeld.has('KeyS') || this.keysHeld.has('s') || this.keysHeld.has('ArrowDown') || this.keysHeld.has('arrowdown')) dirY += 1;
        if (this.keysHeld.has('KeyA') || this.keysHeld.has('a') || this.keysHeld.has('ArrowLeft') || this.keysHeld.has('arrowleft')) dirX -= 1;
        if (this.keysHeld.has('KeyD') || this.keysHeld.has('d') || this.keysHeld.has('ArrowRight') || this.keysHeld.has('arrowright')) dirX += 1;

        if (dirX !== 0 || dirY !== 0) {
          this.camera.addInputDirection(dirX, dirY, 0.016);
        }
      }
    }

    this.camera.setWorldBounds(this.tileMap.width, this.tileMap.height);
    this.camera.update(0.016);

    if (this.state === 'menu') {
      this.updateMenuBackdrop();
    } else if (this.state === 'playing') {
      this.updateSimulation();
      this.followTrackedEntity();
    }

    this.particles.update(0.016);

    if (this.state === 'playing') {
      this.hud.update(time);
      this.stats.maybeSample(this.sim);
    }
    this.screens.tick();

    // The selection ring is set from the cached mark, so this costs a field read
    // rather than a resolve. See `SelectionManager.mark`.
    this.renderer.setSelection(this.state === 'playing' ? this.selection.mark() : null);

    const showBrush = this.state === 'playing' && !this.screens.isOpen() && !this.brush.isInspecting;

    this.renderer.render(
      this.camera,
      this.tileMap,
      this.sim.entities,
      this.sim.cities,
      this.sim.kingdoms,
      this.particles,
      this.overlays.activeMode,
      this.eras.getCurrentEra(),
      // The brush cursor is a radius of effect, so it is only drawn when a power
      // is actually armed. Showing it in inspection mode implied a brush size
      // that does not apply, and put a dashed ring next to the selection ring
      // where the two could be mistaken for each other.
      showBrush ? this.hoverWorldPos?.x ?? null : null,
      showBrush ? this.hoverWorldPos?.y ?? null : null,
      this.brush.brushSize,
      this.sim.naval.activeShips.values(),
      this.sim.caravans.activeCaravans.values(),
      this.sim.railways
    );

    requestAnimationFrame(t => this.gameLoop(t));
  }

  /** Slow drifting camera + a trickle of simulation behind the title screen. */
  private updateMenuBackdrop(): void {
    this.menuPanAngle += 0.0016;
    const radius = this.tileMap.width * 0.18 * this.camera.tileSize;
    this.camera.x = (this.tileMap.width / 2) * this.camera.tileSize + Math.cos(this.menuPanAngle) * radius;
    this.camera.y = (this.tileMap.height / 2) * this.camera.tileSize + Math.sin(this.menuPanAngle * 0.7) * radius * 0.6;
    this.sim.tickAI(this.tileMap, this.particles);
  }

  private updateSimulation(): void {
    if (this.simSpeed <= 0) return;

    this.simTickAccumulator += this.simSpeed;
    const ticksToRun = Math.floor(this.simTickAccumulator);
    this.simTickAccumulator -= ticksToRun;
    const cappedTicks = Math.min(120, ticksToRun);

    for (let i = 0; i < cappedTicks; i++) {
      this.sim.tickAI(this.tileMap, this.particles);

      if (i % 2 === 0) {
        this.activeFires = this.tileMap.updateFireTick();
        this.tileMap.updateFluidTick();
      }

      if (i % 10 === 0 && this.sim.kingdoms.size > 1) {
        this.sim.diplomacy.tickDiplomacy([...this.sim.kingdoms.keys()], this.sim.currentYear);
      }
    }

    if (this.sim.currentYear !== this.lastYearSeen) {
      this.lastYearSeen = this.sim.currentYear;
      this.eras.tickYear(this.sim.currentYear);
      this.maybeSpawnNaturalDisaster();
      this.maybeAutosave();
      this.checkExtinction();
    }
  }

  private followTrackedEntity(): void {
    if (!this.camera.targetEntityId) return;
    const target = this.sim.entities.find(e => e.id === this.camera.targetEntityId);
    if (!target) {
      this.camera.targetEntityId = null;
      return;
    }
    // Smoothly chase so the view doesn't jitter with the walking animation.
    const goalX = target.x * this.camera.tileSize;
    const goalY = target.y * this.camera.tileSize;
    this.camera.x += (goalX - this.camera.x) * 0.12;
    this.camera.y += (goalY - this.camera.y) * 0.12;
  }

  /** Rolled once per simulated year, so the rate is independent of frame rate and sim speed. */
  private maybeSpawnNaturalDisaster(): void {
    const chance = DISASTER_CHANCE_PER_YEAR[settings.get('disasterFrequency')] ?? 0;
    if (chance <= 0 || Math.random() > chance) return;

    const spot = this.randomWalkableTile();
    if (!spot) return;

    const roll = Math.random();
    if (roll < 0.5) {
      DisasterSystem.triggerLightning(spot.x, spot.y, this.tileMap, this.sim.spatialHash, this.particles, this.camera);
      this.toast('Lightning splits the sky', 'disaster');
    } else if (roll < 0.8) {
      this.tileMap.applyBrush(spot.x, spot.y, 2, t => { t.isOnFire = true; });
      this.toast('A wildfire has broken out', 'disaster');
      chronicle.log(this.sim.currentYear, 'disaster', 'A wildfire swept across the land.');
    } else {
      DisasterSystem.triggerEarthquake(spot.x, spot.y, this.tileMap, this.particles, this.camera);
      this.toast('The ground shakes violently', 'disaster');
      chronicle.log(this.sim.currentYear, 'disaster', 'An earthquake fractured the earth.');
    }
  }

  private maybeAutosave(): void {
    if (!settings.get('autosaveEnabled')) return;
    const interval = settings.get('autosaveIntervalYears');
    if (this.sim.currentYear - this.lastAutosaveYear < interval) return;

    this.lastAutosaveYear = this.sim.currentYear;
    const ok = SaveSystem.writeSlot(AUTOSAVE_SLOT, this.buildSaveData(), {
      name: `Autosave · Year ${this.sim.currentYear}`
    });
    this.toast(ok ? `Autosaved at year ${this.sim.currentYear}` : 'Autosave failed — storage is full', ok ? 'info' : 'warning');
  }

  private countCivilised(): number {
    let count = 0;
    for (const e of this.sim.entities) {
      if (SPECIES_DEFINITIONS[e.species].isHumanoid) count++;
    }
    return count;
  }

  private checkExtinction(): void {
    const civilised = this.countCivilised();
    if (civilised > 0) {
      this.hadCivilisation = true;
      this.extinctionAnnounced = false;
      return;
    }
    if (!this.hadCivilisation || this.extinctionAnnounced) return;

    this.extinctionAnnounced = true;
    chronicle.log(this.sim.currentYear, 'disaster', 'The last civilised being of Aethoria has died. Silence falls.');
    this.setSpeed(0);
    this.screens.open('gameover', { reason: this.sim.entities.length === 0 ? 'silence' : 'extinction' });
  }
}

const game = new AethoriaGame();

// Exposed during development so the simulation can be driven and inspected from
// the console. Stripped from production builds by the bundler.
if (import.meta.env.DEV) {
  (window as any).aethoria = game;
  // The event bus, so the alert layer can be driven with real payloads without
  // waiting years of simulated time for a war to break out on its own.
  (window as any).aethoriaEvents = events;
  // The chronicle, so history-dependent UI can be exercised against real
  // structured records rather than waiting for a century of simulation.
  (window as any).aethoriaChronicle = chronicle;
}
