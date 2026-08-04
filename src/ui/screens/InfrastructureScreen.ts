import { el, clear, badge, statRow, linkRow, emptyState, formatNumber } from '../core/Dom';
import { GOODS } from '../../civ/Goods';
import { roadCapacityFactor, portCapacityFactor, portOperational } from '../../civ/Infrastructure';
import type { City } from '../../civ/City';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/**
 * The physical network the economy actually runs on.
 *
 * Everything here is counted off the map: road and rail levels come from tiles,
 * damage from what war did to them, port capacity from building HP. A number on
 * this screen is a thing you could walk to and look at.
 */

type InfraTab = 'overview' | 'roads' | 'rail' | 'ports';

const TABS: { id: InfraTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão Geral', icon: '🗺️' },
  { id: 'roads', label: 'Estradas', icon: '🛣️' },
  { id: 'rail', label: 'Ferrovias', icon: '🚂' },
  { id: 'ports', label: 'Portos', icon: '⚓' }
];

const ROAD_NAMES = ['sem estrada', 'trilha de terra', 'estrada de pedra', 'via imperial'];

export class InfrastructureScreen implements Screen {
  public readonly id = 'infrastructure' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  private tab: InfraTab = 'overview';
  private body: HTMLElement | null = null;
  private ctx: GameContext | null = null;
  /** Route the player followed a link to get here; highlighted until they navigate away. */
  private focusRouteId: string | null = null;

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    this.body = el('div', { class: 'econ-body' });

    if (params?.tab && TABS.some(t => t.id === params.tab)) this.tab = params.tab as InfraTab;
    if (params) this.focusRouteId = params.routeId ?? null;

    const root = el('div', { class: 'screen-container glass-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('h2', { class: 'screen-title', text: '🛤️ Infraestrutura' }),
        el('div', { class: 'screen-sub', text: `Ano ${ctx.sim.currentYear}` })
      ]),
      el('div', { class: 'econ-nav-tabs' },
        TABS.map(t =>
          el('button', {
            class: `econ-tab-btn ${this.tab === t.id ? 'active' : ''}`,
            text: `${t.icon} ${t.label}`,
            on: {
              click: () => {
                this.tab = t.id;
                root.querySelectorAll('.econ-tab-btn').forEach((b, i) =>
                  b.classList.toggle('active', TABS[i]?.id === this.tab));
                this.render();
              }
            }
          })
        )
      ),
      this.body
    ]);

    this.render();
    return root;
  }

  private render(): void {
    if (!this.body || !this.ctx) return;
    clear(this.body);
    switch (this.tab) {
      case 'overview': return this.renderOverview();
      case 'roads': return this.renderRoads();
      case 'rail': return this.renderRail();
      case 'ports': return this.renderPorts();
    }
  }

  /** Walks the map once and counts what is physically there. */
  private survey() {
    const map = this.ctx!.tileMap;
    const roadByLevel = [0, 0, 0, 0];
    let roadDamaged = 0;
    let railTiles = 0;
    let railDamaged = 0;
    let railSevered = 0;
    let roadTraffic = 0;

    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height; y++) {
        const t = map.grid[x][y];
        if (t.roadLevel > 0) {
          roadByLevel[Math.min(3, t.roadLevel)]++;
          roadTraffic += t.roadTraffic;
          if (t.roadDamage > 0.01) roadDamaged++;
        }
        if (t.railLevel > 0) {
          railTiles++;
          if (t.railDamage > 0.01) railDamaged++;
          if (t.railLevelEffective <= 0) railSevered++;
        }
      }
    }
    return { roadByLevel, roadDamaged, railTiles, railDamaged, railSevered, roadTraffic };
  }

  // ============================ OVERVIEW ============================

  private renderOverview(): void {
    const ctx = this.ctx!;
    const body = this.body!;
    const s = this.survey();
    const roadTotal = s.roadByLevel[1] + s.roadByLevel[2] + s.roadByLevel[3];

    const cities = [...ctx.sim.cities.values()];
    const ports = cities.filter(c => portOperational(c)).length;
    const industrial = cities.filter(c =>
      [...c.buildings.values()].some(b => b.type === 'factory' || b.type === 'refinery' || b.type === 'smithy')
    ).length;

    body.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.tile('🛣️', 'Tiles com Estrada', `${roadTotal}`),
        this.tile('🚂', 'Tiles com Trilho', `${s.railTiles}`),
        this.tile('⚓', 'Portos Operantes', `${ports}`),
        this.tile('🏭', 'Centros Industriais', `${industrial}`),
        this.tile('🚧', 'Estradas Danificadas', `${s.roadDamaged}`),
        this.tile('💥', 'Trilhos Rompidos', `${s.railSevered}`),
        this.tile('🚚', 'Tráfego Acumulado', formatNumber(Math.round(s.roadTraffic))),
        this.tile('📦', 'Frete Ferroviário/ano', formatNumber(Math.round(ctx.sim.railways.yearlyFreight)))
      ])
    );

    if (s.railSevered > 0) {
      body.appendChild(
        el('div', { style: { color: '#f87171', padding: '8px 0', fontSize: '12px' },
          text: `⚠ ${s.railSevered} trecho(s) de ferrovia rompido(s) — as rotas que dependiam deles pararam.` })
      );
    }

    // Bottlenecks: routes whose infrastructure is throttling them right now.
    const throttled = [...ctx.sim.trade.routes.values()]
      .map(r => {
        const from = ctx.sim.cities.get(r.fromCityId);
        const to = ctx.sim.cities.get(r.toCityId);
        if (!from || !to) return null;
        const capacity = r.kind === 'maritime'
          ? portCapacityFactor(from, to)
          : roadCapacityFactor(r.path, ctx.tileMap);
        return { r, from, to, capacity };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.capacity < 0.95)
      .sort((a, b) => a.capacity - b.capacity)
      .slice(0, 8);

    body.appendChild(
      this.list('🔻 Gargalos de Transporte', throttled.map(t =>
        linkRow(
          `${GOODS[t.r.good].icon} ${t.from.name} → ${t.to.name}`,
          `${Math.round(t.capacity * 100)}% da capacidade`,
          () => this.followRoute(t.r.path, t.from, t.to),
          {
            valueColor: t.capacity < 0.5 ? '#f87171' : '#fbbf24',
            title: 'Ver onde a rota está travando'
          }
        )
      ), 'Nenhuma rota está limitada pela infraestrutura.')
    );
  }

  // ============================ ROADS ============================

  private renderRoads(): void {
    const ctx = this.ctx!;
    const body = this.body!;
    const s = this.survey();

    body.appendChild(
      el('div', { class: 'stat-list' }, [
        statRow('🟤 Trilhas de terra', `${s.roadByLevel[1]} tiles`),
        statRow('⬜ Estradas de pedra', `${s.roadByLevel[2]} tiles`),
        statRow('🟡 Vias imperiais', `${s.roadByLevel[3]} tiles`),
        statRow('🚧 Danificadas pela guerra', `${s.roadDamaged} tiles`, s.roadDamaged > 0 ? '#f87171' : undefined)
      ])
    );

    const overland = [...ctx.sim.trade.routes.values()].filter(r => r.kind === 'overland');
    if (overland.length === 0) {
      body.appendChild(emptyState('🛣️', 'Nenhuma rota terrestre', 'Estradas nascem do tráfego de caravanas entre cidades.'));
      return;
    }

    body.appendChild(
      el('table', { class: 'styled-table' }, [
        el('thead', {}, [
          el('tr', {}, ['Rota', 'Bem', 'Volume', 'Estrada', 'Capacidade', 'Estado'].map(h => el('th', { text: h })))
        ]),
        el('tbody', {}, overland.map(r => {
          const from = ctx.sim.cities.get(r.fromCityId);
          const to = ctx.sim.cities.get(r.toCityId);
          const capacity = roadCapacityFactor(r.path, ctx.tileMap);
          const grade = this.averageRoadGrade(r.path);
          return el('tr', {
            class: `row-link${r.id === this.focusRouteId ? ' nav-focused' : ''}`,
            title: 'Seguir esta rota no mapa',
            on: { click: () => this.followRoute(r.path, from, to) }
          }, [
            el('td', { text: `${from?.name ?? '—'} → ${to?.name ?? '—'}` }),
            this.goodCell(r.good),
            el('td', { text: r.volume.toFixed(0) }),
            el('td', { text: ROAD_NAMES[Math.round(grade)] ?? '—' }),
            el('td', {
              text: `${Math.round(capacity * 100)}%`,
              style: { color: capacity < 0.6 ? '#f87171' : capacity > 1.05 ? '#4ade80' : '#e2e8f0' }
            }),
            el('td', {}, [badge(r.active ? 'Ativa' : 'Suspensa', r.active ? '#4ade80' : '#f87171')])
          ]);
        }))
      ])
    );
  }

  private averageRoadGrade(path: { x: number; y: number }[] | undefined): number {
    if (!path || path.length === 0) return 0;
    const map = this.ctx!.tileMap;
    let sum = 0;
    let count = 0;
    for (const p of path) {
      const t = map.getTile(Math.floor(p.x), Math.floor(p.y));
      if (!t) continue;
      sum += t.roadLevelEffective;
      count++;
    }
    return count > 0 ? sum / count : 0;
  }

  // ============================ RAIL ============================

  private renderRail(): void {
    const ctx = this.ctx!;
    const body = this.body!;
    const rail = ctx.sim.railways;
    const components = rail.components(ctx.tileMap);

    if (components.length === 0) {
      body.appendChild(emptyState('🚂', 'Nenhuma ferrovia',
        'Ferrovias exigem energia a vapor, e um reino só as constrói quando tem carvão de um lado e forjas do outro.'));
      return;
    }

    body.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.tile('🚂', 'Linhas', `${components.length}`),
        this.tile('📦', 'Frete/ano', formatNumber(Math.round(rail.yearlyFreight))),
        this.tile('🔨', 'Trechos este ano', `${rail.yearlyConstructed}`),
        this.tile('🏁', 'Linhas concluídas', `${rail.linesBuilt}`)
      ])
    );

    body.appendChild(
      el('table', { class: 'styled-table' }, [
        el('thead', {}, [
          el('tr', {}, ['Linha', 'Trechos', 'Condição', 'Estações', 'Estado'].map(h => el('th', { text: h })))
        ]),
        el('tbody', {}, components.map((comp, i) => {
          const quality = rail.lineQuality(comp);
          const stations = comp
            .map(t => (t.cityId ? ctx.sim.cities.get(t.cityId) : null))
            .filter((c): c is City => !!c);
          const names = [...new Set(stations.map(c => c.name))];
          const severed = comp.some(t => t.railLevelEffective <= 0);
          // A broken line is the thing you most want to look at, so aim the
          // camera at the break itself rather than at the middle of the track.
          const aim = comp.find(t => t.railLevelEffective <= 0) ?? comp[Math.floor(comp.length / 2)];
          return el('tr', {
            class: 'row-link',
            title: severed ? 'Ver o trecho rompido no mapa' : 'Ver esta linha no mapa',
            on: { click: () => this.goToMap(aim.x, aim.y, 1.1) }
          }, [
            el('td', { text: `Linha ${i + 1}` }),
            el('td', { text: `${comp.length}` }),
            el('td', {
              text: `${Math.round(quality * 100)}%`,
              style: { color: quality < 0.6 ? '#f87171' : '#4ade80' }
            }),
            el('td', { text: names.length > 0 ? names.join(' ↔ ') : 'nenhuma' }),
            el('td', {}, [badge(
              severed ? 'Rompida' : names.length >= 2 ? 'Operante' : 'Incompleta',
              severed ? '#f87171' : names.length >= 2 ? '#4ade80' : '#fbbf24'
            )])
          ]);
        }))
      ])
    );
  }

  // ============================ PORTS ============================

  private renderPorts(): void {
    const ctx = this.ctx!;
    const body = this.body!;
    const withPorts = [...ctx.sim.cities.values()].filter(c =>
      [...c.buildings.values()].some(b => b.type === 'harbor' || b.type === 'port')
    );

    if (withPorts.length === 0) {
      body.appendChild(emptyState('⚓', 'Nenhum porto', 'Ancoradouros e portos abrem o comércio marítimo.'));
      return;
    }

    body.appendChild(
      el('table', { class: 'styled-table' }, [
        el('thead', {}, [
          el('tr', {}, ['Cidade', 'Instalação', 'Integridade', 'Operante'].map(h => el('th', { text: h })))
        ]),
        el('tbody', {}, withPorts.flatMap(c =>
          [...c.buildings.values()]
            .filter(b => b.type === 'harbor' || b.type === 'port')
            .map(b => {
              const health = b.hp / b.maxHp;
              return el('tr', {}, [
                el('td', { text: c.name }),
                el('td', { text: b.type === 'port' ? '🚢 Porto profundo' : '⚓ Ancoradouro' }),
                el('td', {
                  text: `${Math.round(health * 100)}%`,
                  style: { color: health <= 0.5 ? '#f87171' : '#4ade80' }
                }),
                el('td', {}, [badge(health > 0.5 ? 'Sim' : 'Fora de ação', health > 0.5 ? '#4ade80' : '#f87171')])
              ]);
            })
        ))
      ])
    );

    const maritime = [...ctx.sim.trade.routes.values()].filter(r => r.kind === 'maritime');
    body.appendChild(
      this.list('🚢 Rotas Marítimas', maritime.map(r => {
        const from = ctx.sim.cities.get(r.fromCityId);
        const to = ctx.sim.cities.get(r.toCityId);
        const capacity = from && to ? portCapacityFactor(from, to) : 0;
        const row = linkRow(
          `${GOODS[r.good].icon} ${from?.name ?? '?'} → ${to?.name ?? '?'}`,
          capacity <= 0.01 ? 'colapsada' : `${Math.round(capacity * 100)}% da capacidade`,
          () => this.followRoute(r.path, from, to),
          { valueColor: capacity <= 0.01 ? '#f87171' : undefined, title: 'Seguir esta rota no mapa' }
        );
        if (r.id === this.focusRouteId) row.classList.add('nav-focused');
        return row;
      }), 'Nenhuma rota marítima aberta.')
    );
  }

  // ============================ NAVIGATION ============================

  /**
   * A goods cell that jumps to the economic deep-dive on that good. It lives
   * inside a row that navigates to the map, so its click must not also trigger
   * the row's.
   */
  private goodCell(good: keyof typeof GOODS): HTMLElement {
    return el('td', {
      class: 'cell-link',
      text: `${GOODS[good].icon} ${GOODS[good].name}`,
      title: `Ver ${GOODS[good].name} na economia`,
      on: {
        click: (ev: MouseEvent) => {
          ev.stopPropagation();
          this.ctx!.screens.open('economy', { good });
        }
      }
    });
  }

  /**
   * Points the camera at the middle of a route so the player sees the actual
   * road or sea lane, not just a row about it.
   */
  private followRoute(path: { x: number; y: number }[] | undefined, from?: City, to?: City): void {
    const mid = path && path.length > 0
      ? path[Math.floor(path.length / 2)]
      : from && to
        ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
        : from ?? to;
    if (!mid) return;
    this.goToMap(mid.x, mid.y, 1.1);
  }

  /** Closes every screen and centres the world on a tile. */
  private goToMap(x: number, y: number, zoom = 1.6): void {
    const ctx = this.ctx!;
    ctx.screens.closeAll();
    ctx.focusOn(x, y, zoom);
  }

  // ============================ HELPERS ============================

  private tile(icon: string, label: string, value: string): HTMLElement {
    return el('div', { class: 'stat-tile' }, [
      el('div', { class: 'stat-tile-icon', text: icon }),
      el('div', { class: 'stat-tile-label', text: label }),
      el('div', { class: 'stat-tile-value', text: value })
    ]);
  }

  private list(title: string, rows: HTMLElement[], emptyText: string): HTMLElement {
    return el('div', { class: 'stat-list-block' }, [
      el('h4', { text: title }),
      rows.length > 0
        ? el('div', { class: 'stat-list' }, rows)
        : el('div', { class: 'muted', text: emptyText })
    ]);
  }
}
