import { el, clear, badge, statRow, linkRow, emptyState, formatNumber } from '../core/Dom';
import { ALL_GOODS, GOODS, GoodId, isGoodId } from '../../civ/Goods';
import {
  summariseGoods,
  shortages,
  surpluses,
  marketShocks,
  type GoodSnapshot
} from '../../civ/Economy';
import type { City } from '../../civ/City';
import type { Screen, NavParams } from '../core/ScreenManager';
import type { GameContext } from '../core/GameContext';

/**
 * Economic intelligence, not a trading desk.
 *
 * Every figure on this screen is read back out of a flow some system actually
 * recorded — production, consumption, imports, exports, job slots. Nothing is
 * estimated or filled in when the real number is zero: an empty world shows
 * empty, because that is the truth about it.
 */

type EconomyTab = 'overview' | 'goods' | 'trade' | 'cities' | 'realms';

const TABS: { id: EconomyTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão Geral', icon: '🌍' },
  { id: 'goods', label: 'Bens', icon: '📦' },
  { id: 'trade', label: 'Comércio', icon: '🐫' },
  { id: 'cities', label: 'Cidades', icon: '🏙️' },
  { id: 'realms', label: 'Reinos', icon: '👑' }
];

function pct(fraction: number): string {
  const value = fraction * 100;
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
}

function changeColor(fraction: number): string {
  if (fraction > 0.02) return '#f87171';
  if (fraction < -0.02) return '#4ade80';
  return '#94a3b8';
}

export class EconomyScreen implements Screen {
  public readonly id = 'economy' as const;
  public readonly kind = 'overlay' as const;
  public readonly dismissable = true;

  private tab: EconomyTab = 'overview';
  private selectedGood: GoodId | null = null;
  /** Realm the player followed a link to get here; highlighted on the realms tab. */
  private focusKingdomId: string | null = null;
  private body: HTMLElement | null = null;
  private ctx: GameContext | null = null;

  public build(ctx: GameContext, params?: NavParams): HTMLElement {
    this.ctx = ctx;
    this.body = el('div', { class: 'econ-body' });

    // Arriving from a link. Absent params mean the player came back on their own,
    // so whatever they were looking at last is left alone.
    if (params?.tab && TABS.some(t => t.id === params.tab)) {
      this.tab = params.tab as EconomyTab;
      this.selectedGood = null;
    }
    if (params) this.focusKingdomId = params.focusKingdom ?? null;
    if (params?.good) {
      if (isGoodId(params.good)) {
        this.tab = 'goods';
        this.selectedGood = params.good;
      } else {
        console.warn(`Economy screen asked to inspect unknown good "${params.good}"`);
      }
    }

    const root = el('div', { class: 'screen-container glass-panel' }, [
      el('header', { class: 'screen-head' }, [
        el('h2', { class: 'screen-title', text: '📊 Inteligência Econômica' }),
        el('div', { class: 'screen-sub', text: `Ano ${ctx.sim.currentYear}` })
      ]),
      el('div', { class: 'econ-nav-tabs' },
        TABS.map(t =>
          el('button', {
            class: `econ-tab-btn ${this.tab === t.id ? 'active' : ''}`,
            text: `${t.icon} ${t.label}`,
            on: { click: () => { this.tab = t.id; this.selectedGood = null; this.rebuildTabs(root); this.render(); } }
          })
        )
      ),
      this.body
    ]);

    this.render();
    return root;
  }

  /** Repaints the tab strip so the active one stays highlighted. */
  private rebuildTabs(root: HTMLElement): void {
    const strip = root.querySelector('.econ-nav-tabs');
    if (!strip) return;
    strip.querySelectorAll('.econ-tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', TABS[i]?.id === this.tab);
    });
  }

  private render(): void {
    if (!this.body || !this.ctx) return;
    clear(this.body);

    const cities = [...this.ctx.sim.cities.values()];
    if (cities.length === 0) {
      this.body.appendChild(
        emptyState('🌱', 'Nenhuma economia ainda', 'Nenhum assentamento foi fundado. Não há produção, consumo nem comércio para relatar.')
      );
      return;
    }

    const snapshots = summariseGoods(cities, this.ctx.sim.market);

    if (this.selectedGood) return this.renderGoodInspector(this.selectedGood, snapshots, cities);

    switch (this.tab) {
      case 'overview': return this.renderOverview(snapshots, cities);
      case 'goods': return this.renderGoods(snapshots);
      case 'trade': return this.renderTrade();
      case 'cities': return this.renderCities(cities);
      case 'realms': return this.renderRealms();
    }
  }

  // ============================ OVERVIEW ============================

  private renderOverview(snapshots: GoodSnapshot[], cities: City[]): void {
    const ctx = this.ctx!;
    const body = this.body!;

    const worldOutput = cities.reduce((s, c) => s + c.economicOutput, 0);
    const population = cities.reduce((s, c) => s + c.population, 0);
    const jobs = cities.reduce((s, c) => s + c.jobCount(), 0);
    const filled = cities.reduce((s, c) => s + c.filledJobs(), 0);

    // Working-age citizens are the real denominator for unemployment.
    const workers = ctx.sim.entities.filter(e => e.cityId && !e.isChild && e.hp > 0).length;
    const unemployed = Math.max(0, workers - filled);
    const unemployment = workers > 0 ? unemployed / workers : 0;

    const activeRoutes = [...ctx.sim.trade.routes.values()].filter(r => r.active).length;
    const industrial = snapshots
      .filter(s => GOODS[s.good].kind === 'crafted')
      .reduce((s, g) => s + g.produced, 0);

    const foodBalance = snapshots.find(s => s.good === 'food');

    body.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.tile('🌍', 'Produção Mundial', formatNumber(Math.round(worldOutput))),
        this.tile('🏭', 'Bens Manufaturados', formatNumber(Math.round(industrial))),
        this.tile('🐫', 'Rotas Ativas', `${activeRoutes}`),
        this.tile('🚢', 'Navios', `${ctx.sim.naval.activeShips.size}`),
        this.tile('👷', 'Empregos', `${filled} / ${jobs}`),
        this.tile('📉', 'Desemprego', workers > 0 ? `${(unemployment * 100).toFixed(0)}%` : '—'),
        this.tile('👥', 'População Urbana', `${population}`),
        this.tile('🌾', 'Cobertura Alimentar', foodBalance ? `${(foodBalance.coverage * 100).toFixed(0)}%` : '—')
      ])
    );

    if (jobs > workers && workers > 0) {
      body.appendChild(
        el('div', {
          style: { color: '#fbbf24', padding: '8px 0', fontSize: '12px' },
          text: `⚠ Falta de mão de obra: ${jobs - workers} vagas sem ninguém para preenchê-las.`
        })
      );
    }

    body.appendChild(
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' } }, [
        this.list('🔻 Maiores Escassezes', shortages(snapshots).map(s =>
          this.goodLink(s.good, pct(s.coverage - 1), '#f87171')
        ), 'Nada em falta.'),
        this.list('🔺 Maiores Excedentes', surpluses(snapshots).map(s =>
          this.goodLink(s.good, pct(s.coverage - 1), '#4ade80')
        ), 'Nenhum excedente.'),
        this.list('⚡ Choques de Preço', marketShocks(snapshots).map(s =>
          this.goodLink(s.good, pct(s.priceChange), changeColor(s.priceChange))
        ), 'Preços estáveis.')
      ])
    );
  }

  // ============================ GOODS ============================

  private renderGoods(snapshots: GoodSnapshot[]): void {
    const rows = snapshots
      .filter(s => s.produced > 0 || s.consumed > 0 || s.stock > 0)
      .sort((a, b) => b.price * b.stock - a.price * a.stock);

    if (rows.length === 0) {
      this.body!.appendChild(emptyState('📦', 'Nenhum bem em circulação', 'Nenhuma produção ou consumo foi registrado ainda.'));
      return;
    }

    this.body!.appendChild(
      el('div', { class: 'goods-matrix-table-container' }, [
        el('table', { class: 'styled-table' }, [
          el('thead', {}, [
            el('tr', {}, ['Bem', 'Preço', 'Δ', 'Produção', 'Consumo', 'Estoque', 'Saldo'].map(h => el('th', { text: h })))
          ]),
          el('tbody', {}, rows.map(s =>
            el('tr', {
              style: { cursor: 'pointer' },
              on: { click: () => { this.selectedGood = s.good; this.render(); } }
            }, [
              el('td', { text: `${GOODS[s.good].icon} ${GOODS[s.good].name}` }),
              el('td', { text: s.price.toFixed(1) }),
              el('td', { text: pct(s.priceChange), style: { color: changeColor(s.priceChange) } }),
              el('td', { text: s.produced.toFixed(0) }),
              el('td', { text: s.consumed.toFixed(0) }),
              el('td', { text: s.stock.toFixed(0) }),
              el('td', { text: `${s.net >= 0 ? '+' : ''}${s.net.toFixed(0)}`, style: { color: s.net >= 0 ? '#4ade80' : '#f87171' } })
            ])
          ))
        ])
      ])
    );
  }

  // ============================ GOOD INSPECTOR ============================

  private renderGoodInspector(good: GoodId, snapshots: GoodSnapshot[], cities: City[]): void {
    const body = this.body!;
    const ctx = this.ctx!;
    const snap = snapshots.find(s => s.good === good)!;
    const def = GOODS[good];

    body.appendChild(
      el('button', { class: 'econ-tab-btn', text: '← Voltar', on: { click: () => { this.selectedGood = null; this.render(); } } })
    );
    body.appendChild(el('h3', { class: 'screen-title', text: `${def.icon} ${def.name}`, style: { color: def.color } }));
    body.appendChild(el('div', { class: 'screen-sub', text: def.description }));

    body.appendChild(
      el('div', { class: 'stat-grid' }, [
        this.tile('💰', 'Preço Mundial', snap.price.toFixed(1)),
        this.tile('📈', 'Variação', pct(snap.priceChange)),
        this.tile('🏭', 'Produção', snap.produced.toFixed(0)),
        this.tile('🍽️', 'Consumo', snap.consumed.toFixed(0)),
        this.tile('📦', 'Estoque Mundial', snap.stock.toFixed(0)),
        this.tile('⚖️', 'Cobertura', `${(snap.coverage * 100).toFixed(0)}%`)
      ])
    );

    // Production chain, straight out of the recipe table. Each input is itself a
    // good with its own shortages, so walking the chain upstream is the point.
    if (def.recipe) {
      body.appendChild(
        this.list('🔗 Cadeia de Produção', [
          ...Object.entries(def.recipe).map(([g, qty]) =>
            this.goodLink(g as GoodId, `${qty} por unidade`, undefined, 'Insumo — ver este bem')
          ),
          statRow('Produzido em', def.producedBy ?? '—'),
          statRow('Requer tecnologia', def.requiresTech ?? 'nenhuma')
        ], '')
      );
    }

    const feeds = ALL_GOODS.filter(g => {
      const r = GOODS[g].recipe;
      return !!r && good in r;
    });
    if (feeds.length > 0) {
      body.appendChild(
        this.list('⚙️ Alimenta a produção de',
          feeds.map(g => this.goodLink(g, '', undefined, 'Ver este bem')), '')
      );
    }

    const producers = cities
      .map(c => ({ c, amount: c.ledger.flow(good).produced }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const consumers = cities
      .map(c => ({ c, amount: c.ledger.flow(good).consumed }))
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    body.appendChild(
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' } }, [
        this.list('🏆 Maiores Produtores',
          producers.map(p => this.cityLink(p.c, p.amount.toFixed(0))), 'Ninguém produz este bem.'),
        this.list('🍴 Maiores Consumidores',
          consumers.map(p => this.cityLink(p.c, p.amount.toFixed(0))), 'Ninguém consome este bem.')
      ])
    );

    // Local prices — the whole reason trade exists. A realm paying far above the
    // world price is the one with a motive, so this is where the economy hands
    // the player over to politics.
    const realmPrices = [...ctx.sim.kingdoms.values()]
      .map(k => ({ k, price: k.economy.market.price(good, snap.price) }))
      .sort((a, b) => a.price - b.price);
    if (realmPrices.length > 1) {
      body.appendChild(
        this.list('🌐 Preço por Reino', realmPrices.map(r =>
          // `emblem` is a badge id for the pixel-art renderer, not a glyph, so
          // the realm is identified here by name and colour instead.
          linkRow(r.k.name, r.price.toFixed(1),
            () => ctx.screens.open('kingdoms', { focusKingdom: r.k.id }),
            { valueColor: r.price < snap.price ? '#4ade80' : '#f87171', title: `Abrir ${r.k.name}` })
        ), '')
      );
    }

    const routes = [...ctx.sim.trade.routes.values()].filter(r => r.good === good);
    body.appendChild(
      this.list('🐫 Rotas deste Bem', routes.map(r => {
        const from = ctx.sim.cities.get(r.fromCityId);
        const to = ctx.sim.cities.get(r.toCityId);
        return linkRow(
          `${r.kind === 'maritime' ? '🚢' : '🐫'} ${from?.name ?? '?'} → ${to?.name ?? '?'}`,
          `${r.volume.toFixed(0)}/ano`,
          () => ctx.screens.open('infrastructure', {
            tab: r.kind === 'maritime' ? 'ports' : 'roads',
            routeId: r.id
          }),
          { valueColor: r.active ? undefined : '#f87171', title: 'Ver a infraestrutura desta rota' }
        );
      }), 'Nenhuma rota transporta este bem.')
    );
  }

  // ============================ TRADE ============================

  private renderTrade(): void {
    const ctx = this.ctx!;
    const body = this.body!;
    const routes = [...ctx.sim.trade.routes.values()].sort((a, b) => b.totalValue - a.totalValue);

    if (routes.length === 0) {
      body.appendChild(emptyState('🐫', 'Nenhuma rota comercial',
        'Uma rota nasce quando um reino tem excedente, outro tem escassez, e a margem cobre transporte e tarifa.'));
      return;
    }

    body.appendChild(
      el('table', { class: 'styled-table' }, [
        el('thead', {}, [
          el('tr', {}, ['Bem', 'Origem', 'Destino', 'Tipo', 'Volume', 'Valor Total', 'Estado'].map(h => el('th', { text: h })))
        ]),
        el('tbody', {}, routes.map(r => {
          const from = ctx.sim.cities.get(r.fromCityId);
          const to = ctx.sim.cities.get(r.toCityId);
          return el('tr', {
            class: 'row-link',
            title: 'Ver a infraestrutura desta rota',
            on: {
              click: () => ctx.screens.open('infrastructure', {
                tab: r.kind === 'maritime' ? 'ports' : 'roads',
                routeId: r.id
              })
            }
          }, [
            el('td', { text: `${GOODS[r.good].icon} ${GOODS[r.good].name}` }),
            el('td', { text: from?.name ?? '—' }),
            el('td', { text: to?.name ?? '—' }),
            el('td', { text: r.kind === 'maritime' ? '🚢 Marítima' : '🐫 Terrestre' }),
            el('td', { text: r.volume.toFixed(0) }),
            el('td', { text: formatNumber(Math.round(r.totalValue)) }),
            el('td', {}, [badge(r.active ? 'Ativa' : 'Suspensa', r.active ? '#4ade80' : '#f87171')])
          ]);
        }))
      ])
    );

    if (ctx.sim.trade.embargoes.length > 0) {
      body.appendChild(
        this.list('⛔ Embargos', ctx.sim.trade.embargoes.map(e => {
          const by = ctx.sim.kingdoms.get(e.byKingdom);
          const against = ctx.sim.kingdoms.get(e.againstKingdom);
          return linkRow(`${by?.name ?? '?'} → ${against?.name ?? '?'}`, e.reason,
            () => ctx.screens.open('diplomacy', { focusKingdom: e.byKingdom, withKingdom: e.againstKingdom }),
            { valueColor: '#f87171', title: 'Abrir a diplomacia entre estes dois' });
        }), '')
      );
    }
  }

  // ============================ CITIES ============================

  private renderCities(cities: City[]): void {
    const rows = [...cities].sort((a, b) => b.population - a.population);
    const ctx = this.ctx!;

    // Per-city infrastructure state: roads damaged vs total, and port health.
    const infra = (c: City): { roadTotal: number; roadDamaged: number; portOk: number; portBroken: number } => {
      let roadTotal = 0, roadDamaged = 0, portOk = 0, portBroken = 0;
      for (const key of c.territory) {
        const [tx, ty] = key.split(',').map(Number);
        const tile = ctx.tileMap.getTile(tx, ty);
        if (tile && tile.roadLevel > 0) {
          roadTotal++;
          if (tile.roadDamage > 0.01) roadDamaged++;
        }
      }
      for (const b of c.buildings.values()) {
        if (b.type === 'harbor' || b.type === 'port') {
          if (b.hp / b.maxHp > 0.5) portOk++; else portBroken++;
        }
      }
      return { roadTotal, roadDamaged, portOk, portBroken };
    };

    this.body!.appendChild(
      el('table', { class: 'styled-table' }, [
        el('thead', {}, [
          el('tr', {}, ['Cidade', 'Pop.', 'Empregos', 'Produção', 'Comida (saldo)', 'Estoque', 'Em falta', 'Estradas', 'Portos'].map(h => el('th', { text: h })))
        ]),
        el('tbody', {}, rows.map(c => {
          const foodNet = c.ledger.net('food');
          const missing = ALL_GOODS
            .filter(g => c.ledger.flow(g).consumed > 0 && c.stock.get(g) <= 0)
            .slice(0, 4);
          const { roadTotal, roadDamaged, portOk, portBroken } = infra(c);
          const roadText = roadTotal === 0 ? '—'
            : `${roadDamaged} de ${roadTotal} danificadas`;
          const portText = portOk + portBroken === 0 ? '—'
            : portBroken > 0 ? `${portBroken} destruído(s)` : `${portOk} ok`;
          return el('tr', {
            class: 'row-link',
            title: `Ir até ${c.name} no mapa`,
            on: { click: () => this.goToMap(c.x, c.y) }
          }, [
            el('td', { text: c.name }),
            el('td', { text: `${c.population}` }),
            el('td', { text: `${c.filledJobs()} / ${c.jobCount()}` }),
            el('td', { text: formatNumber(Math.round(c.economicOutput)) }),
            el('td', { text: `${foodNet >= 0 ? '+' : ''}${foodNet.toFixed(0)}`, style: { color: foodNet >= 0 ? '#4ade80' : '#f87171' } }),
            el('td', { text: Math.round(c.stock.get('food')).toString() }),
            el('td', { text: missing.length ? missing.map(g => GOODS[g].icon).join(' ') : '—' }),
            el('td', { text: roadText, style: { color: roadDamaged > 0 ? '#fbbf24' : '#4ade80' } }),
            el('td', { text: portText, style: { color: portBroken > 0 ? '#f87171' : '#4ade80' } })
          ]);
        }))
      ])
    );
  }

  // ============================ REALMS ============================

  private renderRealms(): void {
    const ctx = this.ctx!;
    const realms = [...ctx.sim.kingdoms.values()];

    if (realms.length === 0) {
      this.body!.appendChild(emptyState('👑', 'Nenhum reino', 'Nenhuma sociedade se organizou em um estado ainda.'));
      return;
    }

    for (const k of realms) {
      const realmCities = [...k.cityIds].map(id => ctx.sim.cities.get(id)).filter((c): c is City => !!c);

      // Import dependency, per good, from the realm's own settlements.
      const deps = ALL_GOODS.map(good => {
        let imported = 0;
        let used = 0;
        for (const c of realmCities) {
          const f = c.ledger.flow(good);
          imported += f.imported;
          used += f.consumed + f.exported;
        }
        return { good, dependency: used > 0 ? Math.min(1, imported / used) : 0, used };
      })
        .filter(d => d.used > 0 && d.dependency > 0.15)
        .sort((a, b) => b.dependency - a.dependency)
        .slice(0, 5);

      const card = el('div', {
        class: k.id === this.focusKingdomId ? 'nav-focused' : '',
        style: { border: `1px solid ${k.color}55`, borderRadius: '8px', padding: '10px', margin: '8px 0' }
      }, [
          el('h4', {
            class: 'row-link',
            text: `${k.name} ›`,
            style: { color: k.color },
            title: `Abrir ${k.name}`,
            on: { click: () => ctx.screens.open('kingdoms', { focusKingdom: k.id }) }
          }),
          statRow('Tesouro', k.economy.format(k.economy.treasury)),
          statRow('PIB', formatNumber(Math.round(k.economy.gdp))),
          statRow('Cidades', `${realmCities.length}`),
          statRow('Moeda', k.economy.hasCurrency
            ? `${k.economy.moneyName} (inflação ${(k.economy.currency!.inflation * 100).toFixed(1)}%)`
            : 'escambo'),
          deps.length > 0
            ? this.list('⚠️ Dependência de Importação', deps.map(d =>
                this.goodLink(d.good, `${(d.dependency * 100).toFixed(0)}%`,
                  d.dependency > 0.6 ? '#f87171' : '#fbbf24',
                  `${k.name} depende de importação para ${GOODS[d.good].name}`)
              ), '')
            : el('div', { class: 'muted', text: 'Autossuficiente em tudo que consome.' })
      ]);

      this.body!.appendChild(card);
      // Arriving from another screen with a dozen realms listed, the one asked
      // for has to be the one on screen.
      if (k.id === this.focusKingdomId) {
        requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest' }));
      }
    }
  }

  // ============================ NAVIGATION ============================

  /** A row that opens the deep-dive on a good. */
  private goodLink(good: GoodId, value: string, valueColor?: string, title?: string): HTMLElement {
    return linkRow(
      `${GOODS[good].icon} ${GOODS[good].name}`,
      value,
      () => { this.selectedGood = good; this.render(); },
      { valueColor, title: title ?? `Ver ${GOODS[good].name}` }
    );
  }

  /** A row that leaves the UI and points the camera at a settlement. */
  private cityLink(city: City, value: string): HTMLElement {
    return linkRow(city.name, value, () => this.goToMap(city.x, city.y),
      { title: `Ir até ${city.name} no mapa` });
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
