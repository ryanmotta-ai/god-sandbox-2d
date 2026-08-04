import { el, clear, formatNumber } from '../core/Dom';
import { OverlayMode } from '../../renderer/Overlays';
import { WorldEra } from '../../world/WeatherEras';
import { settings } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import { DisasterSystem } from '../../powers/Disasters';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { Minimap } from './Minimap';
import type { GameContext } from '../core/GameContext';

interface OverlayInfo {
  id: OverlayMode;
  label: string;
  icon: string;
  hint: string;
}

const OVERLAYS: OverlayInfo[] = [
  { id: 'none', label: 'Natural', icon: '🌍', hint: 'Visão padrão do mundo' },
  { id: 'political', label: 'Político', icon: '👑', hint: 'Fronteiras e reinos' },
  { id: 'population', label: 'População', icon: '👥', hint: 'Densidade populacional' },
  { id: 'biome', label: 'Biomas', icon: '🌿', hint: 'Classificação de biomas' },
  { id: 'temperature', label: 'Clima', icon: '🌡️', hint: 'Mapa de calor e temperatura' },
  { id: 'resources', label: 'Recursos', icon: '💎', hint: 'Minérios, madeira e ouro' }
];

const SPEEDS = [
  { value: 0, label: '⏸', title: 'Pausar simulação (Espaço)' },
  { value: 0.25, label: '0.25×', title: 'Super Câmera Lenta (1s real = 15 min no jogo)' },
  { value: 0.5, label: '0.5×', title: 'Câmera Lenta (1s real = 30 min no jogo)' },
  { value: 1, label: '1×', title: 'Velocidade Normal Calibrada (1s real = 1 hora no jogo)' },
  { value: 2, label: '2×', title: 'Rápido (1s real = 2 horas no jogo)' },
  { value: 5, label: '5×', title: 'Muito Rápido (1s real = 5 horas no jogo)' },
  { value: 10, label: '10×', title: 'Ultra Rápido (10 horas por segundo)' },
  { value: 20, label: '20×', title: 'Hiper Avanço (20 horas por segundo)' },
  { value: 60, label: '60× ⚡', title: 'Velocidade Supersônica (60h por segundo / 2.5 dias por segundo!)' }
];

const ERA_STYLE: Record<string, { color: string; icon: string }> = {
  [WorldEra.GOLDEN_AGE]: { color: '#fbbf24', icon: '☀️' },
  [WorldEra.ABUNDANCE]: { color: '#34d399', icon: '🌾' },
  [WorldEra.AGE_OF_ASHES]: { color: '#f97316', icon: '🔥' },
  [WorldEra.DARK_AGE]: { color: '#a855f7', icon: '🌑' },
  [WorldEra.FROZEN_AGE]: { color: '#38bdf8', icon: '❄️' }
};

export class HUD {
  public readonly root: HTMLElement;
  public readonly toolbar: Toolbar;
  public readonly inspector: Inspector;
  public readonly minimap: Minimap;

  private ctx: GameContext;
  private eraEl!: HTMLElement;
  private eraIconEl!: HTMLElement;
  private timeClockEl!: HTMLElement;
  private statEls: Record<string, HTMLElement> = {};
  private speedButtons: Map<number, HTMLButtonElement> = new Map();
  private overlayButtons: Map<OverlayMode, HTMLButtonElement> = new Map();
  private debugPanel!: HTMLElement;
  private debugEls: Record<string, HTMLElement> = {};
  private hiddenByPlayer = false;

  constructor(ctx: GameContext, root: HTMLElement) {
    this.ctx = ctx;
    this.root = root;

    this.toolbar = new Toolbar(ctx);
    this.inspector = new Inspector(ctx);
    this.minimap = new Minimap();
    this.minimap.attach(ctx);

    clear(root);
    root.appendChild(this.buildTopBar());
    root.appendChild(this.buildTimeCockpit());
    root.appendChild(this.buildStrategicFloatingDock());
    root.appendChild(this.buildDebugPanel());
    root.appendChild(this.minimap.root);
    root.appendChild(this.toolbar.root);
    root.appendChild(this.inspector.root);

    this.applySettings();
    settings.onChange(() => this.applySettings());
  }

  // ============================ BUILD ============================

  private buildTopBar(): HTMLElement {
    this.eraIconEl = el('span', { class: 'era-icon-hero', text: '☀️' });
    this.eraEl = el('span', { class: 'era-name-hero', text: 'Era da Abundância' });

    const logo = el('div', { class: 'brand-hero' }, [
      el('span', { class: 'brand-mark-gold', text: '✦' }),
      el('div', { class: 'brand-text-hero' }, [
        el('span', { class: 'brand-name-gold', text: 'AETHORIA' }),
        el('span', { class: 'brand-tag-sub', text: 'GOD SANDBOX 2D' })
      ])
    ]);

    const eraChip = el('div', { class: 'era-chip-hero', title: 'Era Climática Vigente (Clique para trocar)', on: { click: () => { sound.playClick(); this.ctx.eras.cycleNextEra(); } } }, [
      this.eraIconEl,
      this.eraEl
    ]);

    const godPowersBtn = el('button', {
      class: 'god-powers-trigger-hero',
      title: 'Abrir Paleta de Poderes Divinos & Edição',
      on: { click: () => { sound.playClick(); this.toolbar.toggle(); } }
    }, [
      el('span', { class: 'btn-icon-pulse', text: '⚡' }),
      el('span', { class: 'btn-text-bold', text: 'Poderes Divinos' })
    ]);

    const stats = el('div', { class: 'stat-pills-hero' }, [
      this.statPill('year', '📅', 'Ano', '1'),
      this.statPill('pop', '👥', 'População', '0'),
      this.statPill('cities', '🏛️', 'Cidades', '0'),
      this.statPill('kingdoms', '👑', 'Reinos', '0'),
      this.statPill('wars', '⚔️', 'Guerras', '0')
    ]);

    const settingsBtn = el('button', {
      class: 'topbar-icon-btn',
      title: 'Ajustes & Configurações (Esc)',
      on: { click: () => { sound.playClick(); this.ctx.screens.open('settings'); } }
    }, [el('span', { text: '⚙️' })]);

    return el('header', { class: 'topbar-gameawards' }, [
      el('div', { class: 'topbar-hero-left' }, [logo, godPowersBtn]),
      el('div', { class: 'topbar-hero-center' }, [eraChip]),
      el('div', { class: 'topbar-hero-right' }, [stats, settingsBtn])
    ]);
  }

  private buildTimeCockpit(): HTMLElement {
    this.timeClockEl = el('div', { class: 'cockpit-clock-display', text: 'Ano 1 • Era da Abundância 🌾' });

    const speedBtns = SPEEDS.map(s => {
      const btn = el('button', {
        class: 'cockpit-speed-btn',
        text: s.label,
        title: s.title,
        on: { click: () => { sound.playClick(); this.ctx.setSpeed(s.value); } }
      }) as HTMLButtonElement;
      this.speedButtons.set(s.value, btn);
      return btn;
    });

    const stepYearBtn = el('button', {
      class: 'cockpit-action-btn',
      text: '⏩ +1 Ano',
      title: 'Avançar 1 Ano Completo na Simulação',
      on: { click: () => {
        sound.playClick();
        for (let i = 0; i < 60; i++) {
          this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles);
        }
        this.ctx.toast('Simulação avançada em +1 Ano', 'info');
      }}
    });

    const stepTickBtn = el('button', {
      class: 'cockpit-action-btn',
      text: '⏭️ 1 Tick',
      title: 'Avançar 1 Tick com Precisão',
      on: { click: () => {
        sound.playClick();
        this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles);
      }}
    });

    const cycleEraBtn = el('button', {
      class: 'cockpit-action-btn era-btn',
      text: '🌍 Mudar Era',
      title: 'Alternar Era Climática Mundial',
      on: { click: () => {
        sound.playClick();
        this.ctx.eras.cycleNextEra();
        this.ctx.toast(`Nova Era: ${this.ctx.eras.getCurrentEra()}`, 'divine');
      }}
    });

    return el('div', { class: 'time-cockpit-dock glass-panel-dock' }, [
      this.timeClockEl,
      el('div', { class: 'cockpit-controls-row' }, speedBtns),
      el('div', { class: 'cockpit-actions-row' }, [stepYearBtn, stepTickBtn, cycleEraBtn])
    ]);
  }

  private buildStrategicFloatingDock(): HTMLElement {
    const navButtons = [
      this.floatingDockBtn('🏛️', 'Política', 'P', () => this.ctx.screens.open('politics')),
      this.floatingDockBtn('🪙', 'Economia', 'E', () => this.ctx.screens.open('economy')),
      this.floatingDockBtn('⚔️', 'Guerra', 'W', () => this.ctx.screens.open('warfare')),
      this.floatingDockBtn('👑', 'Dinastias', 'Y', () => this.ctx.screens.open('dynasty')),
      this.floatingDockBtn('🌿', 'Ecossistema', 'M', () => this.ctx.screens.open('ecosystem')),
      this.floatingDockBtn('🎓', 'Ciência', 'T', () => this.ctx.screens.open('techtree')),
      this.floatingDockBtn('🤝', 'Diplomacia', 'D', () => this.ctx.screens.open('diplomacy')),
      this.floatingDockBtn('📜', 'Crônica', 'C', () => this.ctx.screens.open('chronicle')),
      this.floatingDockBtn('💾', 'Salvar', 'F5', () => this.ctx.screens.open('saveload')),
      this.floatingDockBtn('☰', 'Menu', 'Esc', () => this.ctx.screens.open('pause'))
    ];

    return el('div', { class: 'strategic-floating-dock glass-panel-dock' }, navButtons);
  }

  private floatingDockBtn(icon: string, label: string, key: string, onClick: () => void): HTMLElement {
    return el('button', {
      class: 'floating-dock-btn',
      title: `${label} (${key})`,
      on: { click: () => { sound.playClick(); onClick(); } }
    }, [
      el('span', { class: 'dock-btn-icon', text: icon }),
      el('span', { class: 'dock-btn-label', text: label }),
      el('kbd', { class: 'dock-btn-key', text: key })
    ]);
  }

  private statPill(key: string, icon: string, label: string, initial: string): HTMLElement {
    const value = el('span', { class: 'pill-val-hero', text: initial });
    this.statEls[key] = value;
    return el('div', { class: `stat-card-hero card-${key}`, title: label }, [
      el('span', { class: 'card-icon-hero', text: icon }),
      el('div', { class: 'card-text-hero' }, [value, el('span', { class: 'card-lbl-hero', text: label })])
    ]);
  }

  private buildDebugPanel(): HTMLElement {
    const row = (key: string, label: string) => {
      const value = el('span', { class: 'debug-value', text: '0' });
      this.debugEls[key] = value;
      return el('div', { class: 'debug-row' }, [el('span', { text: label }), value]);
    };

    this.debugPanel = el('div', { class: 'debug-panel hidden' }, [
      el('div', { class: 'debug-head' }, [
        el('span', { text: '🐛 DEBUG' }),
        el('button', { class: 'icon-close', text: '✕', on: { click: () => this.toggleDebug() } })
      ]),
      row('fps', 'FPS'),
      row('entities', 'Entities'),
      row('particles', 'Particles'),
      row('cities', 'Cities'),
      row('kingdoms', 'Kingdoms'),
      row('fires', 'Active fires'),
      row('speed', 'Sim speed'),
      el('div', { class: 'debug-actions' }, [
        el('button', { text: 'Spawn 50', on: { click: () => this.debugSpawn() } }),
        el('button', { text: 'Force war', on: { click: () => this.debugWar() } }),
        el('button', { text: 'Meteor', on: { click: () => this.debugMeteor() } }),
        el('button', { text: 'Next era', on: { click: () => { this.ctx.eras.cycleNextEra(); this.ctx.toast(`Era shifted to ${this.ctx.eras.getCurrentEra()}`, 'divine'); } } })
      ])
    ]);
    return this.debugPanel;
  }

  // ============================ UPDATE ============================

  public update(now: number): void {
    const { sim, eras } = this.ctx;

    const era = eras.getCurrentEra();
    const style = ERA_STYLE[era] ?? { color: '#fbbf24', icon: '✦' };
    this.eraEl.textContent = era;
    this.eraIconEl.textContent = style.icon;
    (this.eraEl.parentElement as HTMLElement).style.setProperty('--era-color', style.color);

    if (this.timeClockEl) {
      const clock = sim.get24HourTime();
      const date = sim.getCalendarDate();
      this.timeClockEl.textContent = `Ano ${date.year} • Mês ${date.month}, Dia ${date.day} • 🕒 ${clock.timeString} (${clock.periodLabel} ${clock.icon})`;
    }

    this.statEls.year.textContent = `${sim.currentYear}`;
    this.statEls.pop.textContent = formatNumber(sim.entities.length);
    this.statEls.cities.textContent = `${sim.cities.size}`;
    this.statEls.kingdoms.textContent = `${sim.kingdoms.size}`;

    const wars = sim.diplomacy.activeWars.size;
    this.statEls.wars.textContent = `${wars}`;
    this.statEls.wars.parentElement!.parentElement!.classList.toggle('alert', wars > 0);

    for (const [value, btn] of this.speedButtons) {
      btn.classList.toggle('active', this.ctx.simSpeed === value);
    }

    this.toolbar.syncActiveTool();
    this.minimap.tick(now);
    this.inspector.tick(now);

    if (!this.debugPanel.classList.contains('hidden')) {
      this.debugEls.fps.textContent = `${this.ctx.fps}`;
      this.debugEls.entities.textContent = `${sim.entities.length}`;
      this.debugEls.particles.textContent = `${this.ctx.particles.activeParticles.length}`;
      this.debugEls.cities.textContent = `${sim.cities.size}`;
      this.debugEls.kingdoms.textContent = `${sim.kingdoms.size}`;
      this.debugEls.fires.textContent = `${this.ctx.activeFires}`;
      this.debugEls.speed.textContent = `${this.ctx.simSpeed}×`;
    }
  }

  private syncOverlayButtons(): void {
    for (const [mode, btn] of this.overlayButtons) {
      btn.classList.toggle('active', this.ctx.overlays.activeMode === mode);
    }
  }

  public cycleOverlay(): void {
    const idx = OVERLAYS.findIndex(o => o.id === this.ctx.overlays.activeMode);
    const next = OVERLAYS[(idx + 1) % OVERLAYS.length];
    this.ctx.overlays.setMode(next.id);
    this.syncOverlayButtons();
    this.ctx.toast(`Visão: ${next.label}`, 'info');
  }

  public applySettings(): void {
    this.minimap.setVisible(settings.get('showMinimap'));
    document.documentElement.style.setProperty('--ui-scale', `${settings.get('uiScale')}`);
  }

  public toggleDebug(): void {
    this.debugPanel.classList.toggle('hidden');
  }

  public toggleVisibility(): void {
    this.hiddenByPlayer = !this.hiddenByPlayer;
    this.root.classList.toggle('ui-hidden', this.hiddenByPlayer);
  }

  // ============================ DEBUG ACTIONS ============================

  private debugSpawn(): void {
    const { tileMap, sim } = this.ctx;
    const cx = Math.floor(tileMap.width / 2);
    const cy = Math.floor(tileMap.height / 2);
    const species = this.ctx.worldConfig.species;
    for (let i = 0; i < 50; i++) {
      const s = species[Math.floor(Math.random() * species.length)];
      sim.spawnEntity(s, cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20);
    }
    this.ctx.toast('Spawned 50 creatures', 'success');
  }

  private debugWar(): void {
    const kingdoms = Array.from(this.ctx.sim.kingdoms.values());
    if (kingdoms.length < 2) {
      this.ctx.toast('Need at least two kingdoms to start a war', 'warning');
      return;
    }
    this.ctx.sim.diplomacy.declareWar(kingdoms[0].id, kingdoms[1].id, this.ctx.sim.currentYear, 'Divine Provocation');
  }

  private debugMeteor(): void {
    const { tileMap, camera } = this.ctx;
    const wx = camera.x / camera.tileSize;
    const wy = camera.y / camera.tileSize;
    const tile = tileMap.getTile(Math.floor(wx), Math.floor(wy));
    if (!tile) return;
    DisasterSystem.triggerMeteorite(Math.floor(wx), Math.floor(wy), tileMap, this.ctx.sim.spatialHash, this.ctx.particles, camera);
    this.ctx.toast('A meteor falls from the heavens', 'disaster');
  }
}
