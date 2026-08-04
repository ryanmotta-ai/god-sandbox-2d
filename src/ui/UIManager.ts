import { EraManager } from '../world/WeatherEras';
import { SimulationEngine } from '../ai/EntityAI';
import { OverlayManager, OverlayMode } from '../renderer/Overlays';
import { SaveSystem } from '../core/SaveSystem';
import { TileMap } from '../world/TileMap';
import { sound } from '../core/SoundSynth';
import { events } from '../core/EventBus';

export class UIManager {
  private eraDisplay: HTMLElement;
  private yearDisplay: HTMLElement;
  private popDisplay: HTMLElement;
  private civDisplay: HTMLElement;
  private toastContainer: HTMLElement;

  constructor(
    private eraMgr: EraManager,
    private sim: SimulationEngine,
    private overlayMgr: OverlayManager,
    private tileMap: TileMap,
    private setSpeedFn: (speed: number) => void,
    private newWorldFn: (size: number, preset: any, seed?: number) => void
  ) {
    this.eraDisplay = document.getElementById('era-display')!;
    this.yearDisplay = document.getElementById('year-display')!;
    this.popDisplay = document.getElementById('pop-display')!;
    this.civDisplay = document.getElementById('civ-display')!;
    this.toastContainer = document.getElementById('toast-container')!;

    this.setupTimeControls();
    this.setupOverlays();
    this.setupModals();
    this.setupDebug();

    // Listen to global events for toast alerts
    events.on('warStarted', (d) => this.toast(`⚔️ War declared between realms!`, 'war'));
    events.on('kingdomCreated', (d) => this.toast(`👑 A new Kingdom has risen!`, 'king'));
    events.on('disasterTriggered', (d) => this.toast(`💥 Disaster strikes!`, 'disaster'));
  }

  public updateTopBar(): void {
    this.eraDisplay.innerText = this.eraMgr.getCurrentEra();
    this.yearDisplay.innerText = `${this.sim.currentYear}`;
    this.popDisplay.innerText = `${this.sim.entities.length}`;
    this.civDisplay.innerText = `${this.sim.cities.size}`;
  }

  public toast(message: string, type: string = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  private setupTimeControls(): void {
    const btns = [
      { id: 'btn-pause', speed: 0 },
      { id: 'btn-1x', speed: 1 },
      { id: 'btn-2x', speed: 2 },
      { id: 'btn-5x', speed: 5 },
      { id: 'btn-10x', speed: 10 }
    ];

    btns.forEach(b => {
      const btn = document.getElementById(b.id);
      btn?.addEventListener('click', () => {
        btns.forEach(other => document.getElementById(other.id)?.classList.remove('active'));
        btn.classList.add('active');
        this.setSpeedFn(b.speed);
      });
    });

    // Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      const muted = sound.toggleMute();
      this.toast(muted ? '🔇 Sound Muted' : '🔊 Sound Enabled');
    });
  }

  private setupOverlays(): void {
    const overlayBtns = document.querySelectorAll('.overlay-btn');
    overlayBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        overlayBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const mode = target.dataset.overlay as OverlayMode;
        this.overlayMgr.setMode(mode);
      });
    });
  }

  private setupModals(): void {
    // New World Modal
    const worldModal = document.getElementById('worldgen-modal')!;
    document.getElementById('btn-new-world')?.addEventListener('click', () => worldModal.classList.remove('hidden'));
    document.getElementById('btn-close-worldgen')?.addEventListener('click', () => worldModal.classList.add('hidden'));

    document.getElementById('btn-random-seed')?.addEventListener('click', () => {
      (document.getElementById('gen-seed') as HTMLInputElement).value = `${Math.floor(Math.random() * 2147483647)}`;
    });

    document.getElementById('btn-generate-confirm')?.addEventListener('click', () => {
      const size = parseInt((document.getElementById('gen-size') as HTMLSelectElement).value, 10);
      const preset = (document.getElementById('gen-preset') as HTMLSelectElement).value;
      const seedVal = (document.getElementById('gen-seed') as HTMLInputElement).value;
      const seed = seedVal ? parseInt(seedVal, 10) : undefined;

      this.newWorldFn(size, preset, seed);
      worldModal.classList.add('hidden');
      this.toast('✨ New World Generated!');
    });

    // Save/Load Modal
    const saveModal = document.getElementById('saveload-modal')!;
    document.getElementById('btn-save-load')?.addEventListener('click', () => saveModal.classList.remove('hidden'));
    document.getElementById('btn-close-saveload')?.addEventListener('click', () => saveModal.classList.add('hidden'));

    document.getElementById('btn-save-local')?.addEventListener('click', () => {
      SaveSystem.saveToLocalStorage(this.tileMap, this.sim, this.eraMgr);
      this.toast('💾 World Saved to Browser LocalStorage!');
      saveModal.classList.add('hidden');
    });

    document.getElementById('btn-load-local')?.addEventListener('click', () => {
      const success = SaveSystem.loadFromLocalStorage(this.tileMap, this.sim, this.eraMgr);
      if (success) {
        this.toast('📂 World Loaded successfully!');
        saveModal.classList.add('hidden');
      } else {
        this.toast('⚠️ No local save file found.');
      }
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const data = SaveSystem.exportSaveData(this.tileMap, this.sim, this.eraMgr);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aethoria_world_year${this.sim.currentYear}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('⬇️ Exported Save File!');
    });
  }

  private setupDebug(): void {
    const debugOverlay = document.getElementById('debug-overlay')!;
    document.getElementById('btn-debug')?.addEventListener('click', () => {
      debugOverlay.classList.toggle('hidden');
    });

    document.getElementById('dbg-spawn-50')?.addEventListener('click', () => {
      for (let i = 0; i < 50; i++) {
        this.sim.spawnEntity(anySpecies(), Math.floor(this.tileMap.width / 2 + (Math.random() - 0.5) * 20), Math.floor(this.tileMap.height / 2 + (Math.random() - 0.5) * 20));
      }
      this.toast('🐛 Spawned 50 Entities');
    });

    document.getElementById('dbg-era')?.addEventListener('click', () => {
      this.eraMgr.cycleNextEra();
    });
  }
}

function anySpecies(): any {
  const list = ['lumini', 'sylvanii', 'stonekin', 'emberkin'];
  return list[Math.floor(Math.random() * list.length)];
}
