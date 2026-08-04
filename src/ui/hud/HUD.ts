import { el, clear, formatNumber } from '../core/Dom';
import { OverlayMode } from '../../renderer/Overlays';
import { WorldEra } from '../../world/WeatherEras';
import { settings } from '../core/Settings';
import { sound } from '../../core/SoundSynth';
import { DisasterSystem } from '../../powers/Disasters';
import { Toolbar } from './Toolbar';
import { Inspector } from './Inspector';
import { Minimap } from './Minimap';
import { icon, setIcon, withTooltip, TooltipContent, formatFull } from '../kit';
import type { ScreenId } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

interface OverlayInfo {
  id: OverlayMode;
  label: string;
  icon: string;
  hint: string;
}

const OVERLAYS: OverlayInfo[] = [
  { id: 'none', label: 'Natural', icon: 'map', hint: 'Visão padrão do mundo' },
  { id: 'political', label: 'Político', icon: 'kingdom', hint: 'Fronteiras e reinos' },
  { id: 'population', label: 'População', icon: 'population', hint: 'Densidade populacional' },
  { id: 'biome', label: 'Biomas', icon: 'biome', hint: 'Classificação de biomas' },
  { id: 'temperature', label: 'Clima', icon: 'climate', hint: 'Mapa de calor e temperatura' },
  { id: 'resources', label: 'Recursos', icon: 'gem', hint: 'Minérios, madeira e ouro' }
];

/**
 * The speed ladder.
 *
 * Multipliers stay as text — they *are* numbers, and a number is the clearest
 * possible label for itself. Only pause gets artwork, because "stopped" has no
 * numeral.
 */
const SPEEDS: { value: number; label?: string; icon?: string; title: string }[] = [
  { value: 0, icon: 'pause', title: 'Pausa a simulação. O mundo congela; a câmera continua livre.' },
  { value: 0.25, label: '0.25×', title: 'Super câmera lenta — 1 segundo real vale 15 minutos no mundo.' },
  { value: 0.5, label: '0.5×', title: 'Câmera lenta — 1 segundo real vale 30 minutos no mundo.' },
  { value: 1, label: '1×', title: 'Velocidade calibrada — 1 segundo real vale 1 hora no mundo.' },
  { value: 2, label: '2×', title: 'Rápido — 2 horas por segundo.' },
  { value: 5, label: '5×', title: 'Muito rápido — 5 horas por segundo.' },
  { value: 10, label: '10×', title: 'Ultra rápido — 10 horas por segundo.' },
  { value: 20, label: '20×', title: 'Hiper avanço — 20 horas por segundo.' },
  { value: 60, label: '60×', title: 'Supersônico — 60 horas por segundo, cerca de 2,5 dias a cada segundo.' }
];

const ERA_STYLE: Record<string, { color: string; icon: string }> = {
  [WorldEra.GOLDEN_AGE]: { color: '#c9a153', icon: 'sun' },
  [WorldEra.ABUNDANCE]: { color: '#8fb069', icon: 'farm' },
  [WorldEra.AGE_OF_ASHES]: { color: '#d98324', icon: 'fire' },
  [WorldEra.DARK_AGE]: { color: '#9b7fa8', icon: 'moon' },
  [WorldEra.FROZEN_AGE]: { color: '#7fa8b8', icon: 'snow' }
};

/**
 * The strategic dock.
 *
 * Ten destinations, each one lens on the same world. Declared as data so the
 * dock, its tooltips and its shortcut hints cannot drift apart — before UI-0 the
 * icon, the label and the key were three separate literals per button.
 */
const DOCK: { screen: ScreenId; icon: string; label: string; key: string; description: string }[] = [
  { screen: 'politics', icon: 'politics', label: 'Política', key: 'P', description: 'Facções, leis e a legitimidade de cada governo.' },
  { screen: 'economy', icon: 'economy', label: 'Economia', key: 'E', description: 'Preços, produção, escassez e o tesouro dos reinos.' },
  { screen: 'warfare', icon: 'war', label: 'Guerra', key: 'W', description: 'Exércitos em campo, cercos e o custo das campanhas.' },
  { screen: 'dynasty', icon: 'dynasty', label: 'Dinastias', key: 'Y', description: 'Linhagens, sucessões e as casas que governam.' },
  { screen: 'ecosystem', icon: 'ecosystem', label: 'Ecossistema', key: 'M', description: 'Biomas, fauna e a pressão que a civilização exerce sobre eles.' },
  { screen: 'techtree', icon: 'technology', label: 'Ciência', key: 'T', description: 'O que cada reino descobriu e o que persegue agora.' },
  { screen: 'diplomacy', icon: 'diplomacy', label: 'Diplomacia', key: 'D', description: 'Tratados, rivalidades e a opinião de cada corte.' },
  { screen: 'chronicle', icon: 'chronicle', label: 'Crônica', key: 'C', description: 'A história do mundo, registrada conforme acontece.' },
  { screen: 'saveload', icon: 'save', label: 'Salvar', key: 'F5', description: 'Salvar, carregar ou exportar este mundo.' },
  { screen: 'pause', icon: 'menu', label: 'Menu', key: 'Esc', description: 'Pausa e abre o menu principal.' }
];

export class HUD {
  public readonly root: HTMLElement;
  public readonly toolbar: Toolbar;
  public readonly inspector: Inspector;
  public readonly minimap: Minimap;

  private ctx: GameContext;
  private eraEl!: HTMLElement;
  private eraIconEl!: HTMLImageElement;
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
    this.eraIconEl = icon('sun', { size: 16, class: 'era-icon-hero' });
    this.eraEl = el('span', { class: 'era-name-hero', text: 'Era da Abundância' });

    const logo = el('div', { class: 'brand-hero' }, [
      icon('sun', { size: 16, class: 'brand-mark-gold' }),
      el('div', { class: 'brand-text-hero' }, [
        el('span', { class: 'brand-name-gold', text: 'AETHORIA' }),
        el('span', { class: 'brand-tag-sub', text: 'GOD SANDBOX 2D' })
      ])
    ]);

    const eraChip = withTooltip(
      el('div', {
        class: 'era-chip-hero',
        on: { click: () => { sound.playClick(); this.ctx.eras.cycleNextEra(); } }
      }, [this.eraIconEl, this.eraEl]),
      () => ({
        title: this.ctx.eras.getCurrentEra(),
        icon: ERA_STYLE[this.ctx.eras.getCurrentEra()]?.icon ?? 'sun',
        accent: ERA_STYLE[this.ctx.eras.getCurrentEra()]?.color,
        description: 'A era climática vigente. Ela altera colheitas, doenças e a velocidade com que os reinos crescem.',
        footnote: 'Clique para avançar para a próxima era'
      })
    );

    const godPowersBtn = withTooltip(
      el('button', {
        class: 'god-powers-trigger-hero',
        on: { click: () => { sound.playClick(); this.toolbar.toggle(); } }
      }, [
        icon('power', { size: 16, class: 'btn-icon-pulse' }),
        el('span', { class: 'btn-text-bold', text: 'Poderes Divinos' })
      ]),
      {
        title: 'Poderes Divinos',
        description: 'Abre a paleta de terraformação e intervenção — erguer terra, atear fogo, semear vida.',
        shortcut: 'Tab'
      }
    );

    const stats = el('div', { class: 'stat-pills-hero' }, [
      this.statPill('year', 'year', 'Ano', '1', () => ({
        title: 'Ano corrente',
        value: `${this.ctx.sim.currentYear}`,
        icon: 'year',
        description: 'Quanto tempo se passou desde a fundação deste mundo.'
      })),
      this.statPill('pop', 'population', 'População', '0', () => ({
        title: 'População',
        value: formatFull(this.ctx.sim.entities.length),
        icon: 'population',
        description: 'Todos os seres vivos simulados neste momento, incluindo fauna selvagem.'
      })),
      this.statPill('cities', 'city', 'Cidades', '0', () => ({
        title: 'Assentamentos',
        value: `${this.ctx.sim.cities.size}`,
        icon: 'city',
        description: 'Cidades fundadas e ainda habitadas.'
      })),
      this.statPill('kingdoms', 'kingdom', 'Reinos', '0', () => ({
        title: 'Reinos',
        value: `${this.ctx.sim.kingdoms.size}`,
        icon: 'kingdom',
        description: 'Estados soberanos existentes. Reinos conquistados deixam de contar.'
      })),
      this.statPill('wars', 'war', 'Guerras', '0', () => {
        const wars = this.ctx.sim.diplomacy.activeWars.size;
        return {
          title: 'Guerras ativas',
          value: `${wars}`,
          icon: 'war',
          valueStatus: wars > 0 ? 'critical' : 'positive',
          description: wars > 0
            ? 'Conflitos em curso neste momento.'
            : 'Nenhum conflito em curso. O mundo está em paz.'
        };
      })
    ]);

    const settingsBtn = withTooltip(
      el('button', {
        class: 'topbar-icon-btn',
        attrs: { 'aria-label': 'Ajustes' },
        on: { click: () => { sound.playClick(); this.ctx.screens.open('settings'); } }
      }, [icon('settings', { size: 16 })]),
      { title: 'Ajustes', description: 'Vídeo, áudio, escala da interface e acessibilidade.' }
    );

    return el('header', { class: 'topbar-gameawards' }, [
      el('div', { class: 'topbar-hero-left' }, [logo, godPowersBtn]),
      el('div', { class: 'topbar-hero-center' }, [eraChip]),
      el('div', { class: 'topbar-hero-right' }, [stats, settingsBtn])
    ]);
  }

  private buildTimeCockpit(): HTMLElement {
    this.timeClockEl = el('div', { class: 'cockpit-clock-display' });

    const speedBtns = SPEEDS.map(s => {
      const btn = withTooltip(
        el('button', {
          class: 'cockpit-speed-btn',
          attrs: { 'aria-label': s.label ?? 'Pausar' },
          on: { click: () => { sound.playClick(); this.ctx.setSpeed(s.value); } }
        }, [
          s.icon ? icon(s.icon, { size: 16 }) : el('span', { text: s.label! })
        ]),
        {
          title: s.label ?? 'Pausar',
          description: s.title,
          shortcut: s.value === 0 ? 'Espaço' : undefined
        }
      ) as HTMLButtonElement;
      this.speedButtons.set(s.value, btn);
      return btn;
    });

    const action = (
      iconName: string,
      label: string,
      tip: TooltipContent,
      onClick: () => void,
      extraClass = ''
    ) => withTooltip(
      el('button', {
        class: `cockpit-action-btn${extraClass ? ' ' + extraClass : ''}`,
        on: { click: () => { sound.playClick(); onClick(); } }
      }, [icon(iconName, { size: 16 }), el('span', { text: label })]),
      tip
    );

    const stepYearBtn = action('forward', '+1 Ano', {
      title: 'Avançar um ano',
      description: 'Executa a simulação por um ano completo de uma vez e devolve o controle.'
    }, () => {
      for (let i = 0; i < 60; i++) {
        this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles);
      }
      this.ctx.toast('Simulação avançada em +1 Ano', 'info');
    });

    const stepTickBtn = action('step', '1 Tick', {
      title: 'Avançar um tick',
      description: 'Um único passo da simulação, para observar uma decisão isolada.'
    }, () => {
      this.ctx.sim.tickAI(this.ctx.tileMap, this.ctx.particles);
    });

    const cycleEraBtn = action('map', 'Mudar Era', {
      title: 'Alternar era climática',
      description: 'Força a próxima era. Colheitas, doenças e crescimento respondem imediatamente.'
    }, () => {
      this.ctx.eras.cycleNextEra();
      this.ctx.toast(`Nova Era: ${this.ctx.eras.getCurrentEra()}`, 'divine');
    }, 'era-btn');

    return el('div', { class: 'time-cockpit-dock' }, [
      this.timeClockEl,
      el('div', { class: 'cockpit-controls-row' }, speedBtns),
      el('div', { class: 'cockpit-actions-row' }, [stepYearBtn, stepTickBtn, cycleEraBtn])
    ]);
  }

  private buildStrategicFloatingDock(): HTMLElement {
    return el('div', { class: 'strategic-floating-dock' }, DOCK.map(entry =>
      withTooltip(
        el('button', {
          class: 'floating-dock-btn',
          attrs: { 'aria-label': entry.label },
          on: { click: () => { sound.playClick(); this.ctx.screens.open(entry.screen); } }
        }, [
          icon(entry.icon, { size: 16, class: 'dock-btn-icon' }),
          el('span', { class: 'dock-btn-label', text: entry.label }),
          el('kbd', { class: 'dock-btn-key', text: entry.key })
        ]),
        { title: entry.label, description: entry.description, icon: entry.icon, shortcut: entry.key }
      )
    ));
  }

  /**
   * A live figure in the top bar.
   *
   * The tooltip is a callback so it reads the simulation at hover time. Building
   * five tooltips' worth of content on every frame — for panels the player is
   * usually not looking at — is exactly the kind of standing cost the UI is
   * meant to avoid.
   */
  private statPill(
    key: string,
    iconName: string,
    label: string,
    initial: string,
    tip: () => TooltipContent
  ): HTMLElement {
    const value = el('span', { class: 'pill-val-hero', text: initial });
    this.statEls[key] = value;
    return withTooltip(
      el('div', { class: `stat-card-hero card-${key}` }, [
        icon(iconName, { size: 16, class: 'card-icon-hero' }),
        el('div', { class: 'card-text-hero' }, [value, el('span', { class: 'card-lbl-hero', text: label })])
      ]),
      tip
    );
  }

  private buildDebugPanel(): HTMLElement {
    const row = (key: string, label: string) => {
      const value = el('span', { class: 'debug-value', text: '0' });
      this.debugEls[key] = value;
      return el('div', { class: 'debug-row' }, [el('span', { text: label }), value]);
    };

    this.debugPanel = el('div', { class: 'debug-panel hidden' }, [
      el('div', { class: 'debug-head' }, [
        el('span', { text: 'DEBUG' }),
        el('button', {
          class: 'icon-close',
          attrs: { 'aria-label': 'Fechar' },
          on: { click: () => this.toggleDebug() }
        }, [icon('close', { size: 16 })])
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
        el('button', { text: 'Next era', on: { click: () => { this.ctx.eras.cycleNextEra(); this.ctx.toast(`Era shifted to ${this.ctx.eras.getCurrentEra()}`, 'divine'); } } }),
        el('button', { text: 'UI kit', on: { click: () => this.ctx.screens.open('ui-kit') } })
      ])
    ]);
    return this.debugPanel;
  }

  // ============================ UPDATE ============================

  public update(now: number): void {
    const { sim, eras } = this.ctx;

    const era = eras.getCurrentEra();
    const style = ERA_STYLE[era] ?? { color: 'var(--ae-accent)', icon: 'sun' };
    this.eraEl.textContent = era;
    // `setIcon` bails out when the artwork has not changed, which is almost
    // every frame — the era shifts a handful of times per world.
    setIcon(this.eraIconEl, style.icon);
    (this.eraEl.parentElement as HTMLElement).style.setProperty('--era-color', style.color);

    if (this.timeClockEl) {
      const clock = sim.get24HourTime();
      const date = sim.getCalendarDate();
      this.timeClockEl.textContent =
        `Ano ${date.year} · Mês ${date.month}, Dia ${date.day} · ${clock.timeString} (${clock.periodLabel})`;
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
