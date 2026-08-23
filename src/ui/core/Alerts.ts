/**
 * The alert system.
 *
 * Aethoria generates far more news than a player can read. Before UI-1 all of it
 * went to the same 4-second toast, which meant a war declaration and a bridge
 * opening looked identical and both were gone before you could act. This module
 * splits that stream in two and makes the important half navigable:
 *
 *  - **Alerts** are things a player might want to *do* something about. They
 *    carry a severity, they persist long enough to be read, and clicking one
 *    takes you to whatever it is about.
 *  - **Events** are things that merely happened. They scroll past in a quiet
 *    feed and are forgotten; the Chronicle remains the permanent record.
 *
 * Three properties matter more than the taxonomy:
 *
 *  1. **It is event-driven.** Everything here hangs off the EventBus the
 *     simulation already emits on. Nothing scans the world. The one derived
 *     alert (famine) reads the cached snapshot, once per simulated year.
 *  2. **It cannot spam.** Every alert declares a dedup key with a cooldown, and
 *     alerts of the same kind arriving together collapse into one line with a
 *     count.
 *  3. **It owns no navigation.** Clicking an alert calls back into the camera
 *     and selection the game already has.
 */
import { events } from '../../core/EventBus';
import type { ObjectRef } from '../kit';
import type { SimulationEngine } from '../../ai/EntityAI';
import type { Kingdom } from '../../civ/Kingdom';
import type { City } from '../../civ/City';
import type { WorldSnapshot } from './WorldSnapshot';

export type Severity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  /**
   * Dedup identity: kind plus subject. Two pushes with the same key inside the
   * cooldown are the same piece of news arriving twice.
   */
  key: string;
  /** Family of alert, used for aggregation. */
  kind: AlertKind;
  severity: Severity;
  title: string;
  /** One short line — usually the subject: which city, which pair of realms. */
  description?: string;
  /** Simulated year it was raised. */
  year: number;
  /** Where on the map to look. */
  focus?: { x: number; y: number };
  /** What to select, expressed in the UI-0 object vocabulary. */
  ref?: ObjectRef;
  /**
   * The city-dossier condition this alert is about, when there is one.
   *
   * Lets a click on "escassez de alimento" land the player on that city's food
   * line rather than on a screen they then have to search. Only set where the
   * mapping is exact — an alert about a war has no single condition to point at.
   */
  conditionHint?: string;
  /** How many occurrences are folded into this line. 1 for a single alert. */
  count: number;
  /** Real time it was raised, for ordering and fading. */
  raisedAt: number;
}

export type AlertKind =
  | 'war-declared'
  | 'city-besieged'
  | 'city-captured'
  | 'kingdom-fell'
  | 'rebellion'
  | 'settlement-abandoned'
  | 'unrest'
  | 'embargo'
  | 'trade-broken'
  | 'vassalage-broken'
  | 'food-shortage'
  | 'tech-bottleneck';

export interface WorldEventEntry {
  id: string;
  text: string;
  icon: string;
  year: number;
  raisedAt: number;
  focus?: { x: number; y: number };
  ref?: ObjectRef;
}

/** Per-kind presentation and the wording used when several collapse into one. */
const KIND_META: Record<AlertKind, {
  icon: string;
  severity: Severity;
  /** Plural wording for an aggregated line. `n` is the count. */
  aggregate: (n: number) => string;
}> = {
  'war-declared':         { icon: 'war',        severity: 'critical', aggregate: n => `${n} guerras declaradas` },
  'city-besieged':        { icon: 'defence',    severity: 'critical', aggregate: n => `${n} cidades sitiadas` },
  'city-captured':        { icon: 'war',        severity: 'critical', aggregate: n => `${n} cidades tomadas` },
  'kingdom-fell':         { icon: 'kingdom',    severity: 'critical', aggregate: n => `${n} reinos caíram` },
  'rebellion':            { icon: 'politics',   severity: 'warning',  aggregate: n => `${n} rebeliões em curso` },
  'settlement-abandoned': { icon: 'city',       severity: 'warning',  aggregate: n => `${n} assentamentos abandonados` },
  'unrest':               { icon: 'alert',      severity: 'warning',  aggregate: n => `${n} facções em agitação` },
  'embargo':              { icon: 'economy',    severity: 'warning',  aggregate: n => `${n} embargos declarados` },
  'trade-broken':         { icon: 'trade',      severity: 'warning',  aggregate: n => `${n} acordos comerciais rompidos` },
  'vassalage-broken':     { icon: 'kingdom',    severity: 'warning',  aggregate: n => `${n} vassalagens rompidas` },
  'food-shortage':        { icon: 'agriculture',severity: 'warning',  aggregate: n => `${n} cidades com escassez de alimento` },
  'tech-bottleneck':      { icon: 'technology', severity: 'warning',  aggregate: n => `${n} gargalos tecnológicos` }
};

/** How long the same key stays suppressed. Real time, so it holds at any speed. */
const COOLDOWN_MS = 25_000;
/** Alerts of one kind arriving inside this window collapse into a single line. */
const AGGREGATE_MS = 6_000;
/** How long an alert stays in the list before it is dropped. */
const ALERT_TTL_MS = 45_000;
/** How long a feed event stays visible. */
const EVENT_TTL_MS = 14_000;
/** Minimum gap between expiry sweeps. See `expire`. */
const EXPIRY_INTERVAL_MS = 500;

const MAX_ALERTS = 24;
const MAX_EVENTS = 6;

export type AlertListener = () => void;

/**
 * Holds the alert list and the event feed, and subscribes to the simulation once.
 */
export class AlertCenter {
  private alerts: Alert[] = [];
  private feed: WorldEventEntry[] = [];
  private lastRaised = new Map<string, number>();
  private listeners = new Set<AlertListener>();
  private sim: SimulationEngine | null = null;
  private seq = 0;
  private wired = false;
  /**
   * Whether news is being accepted.
   *
   * The title screen runs a live world as its backdrop, and that world declares
   * wars. Without this gate the player would arrive in a fresh game to a stack of
   * alerts about a world they never saw.
   */
  private enabled = false;
  /** Last year the derived (non-event) alerts were evaluated. */
  private lastDerivedYear = -1;
  /** Last expiry sweep, so the per-frame call is rate-limited. */
  private lastExpiry = -Infinity;

  // ============================ LIFECYCLE ============================

  /**
   * Points the centre at the live simulation.
   *
   * Called whenever a world is created or loaded. The EventBus subscriptions are
   * installed once and read `this.sim` through this field, so they survive a new
   * world without being torn down and re-registered — the bus has no
   * unsubscribe-all, and re-registering would double every alert.
   */
  public attach(sim: SimulationEngine): void {
    this.sim = sim;
    this.clear();
    if (!this.wired) {
      this.wire();
      this.wired = true;
    }
  }

  /** Opens or closes the gate. Called when a world is entered or left. */
  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  public clear(): void {
    this.alerts = [];
    this.feed = [];
    this.lastRaised.clear();
    this.lastDerivedYear = -1;
    this.notify();
  }

  public onChange(fn: AlertListener): void {
    this.listeners.add(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  // ============================ READ ============================

  /** Live alerts, most recent first. */
  public get active(): readonly Alert[] {
    return this.alerts;
  }

  /** Recent happenings, most recent first. */
  public get recent(): readonly WorldEventEntry[] {
    return this.feed;
  }

  public iconFor(kind: AlertKind): string {
    return KIND_META[kind].icon;
  }

  /** Drops one alert — the player has acknowledged it. */
  public dismiss(id: string): void {
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.id !== id);
    if (this.alerts.length !== before) this.notify();
  }

  public dismissAll(): void {
    if (!this.alerts.length) return;
    this.alerts = [];
    this.notify();
  }

  /**
   * Expires anything past its lifetime. Called from the HUD's tick; returns true
   * when something actually went away, so the caller only re-renders then.
   *
   * Rate-limited, because it is called every frame and the two filters below
   * allocate. Lifetimes are measured in tens of seconds, so checking a few times
   * a second is as precise as the feature needs to be.
   */
  public expire(now: number): boolean {
    if (now - this.lastExpiry < EXPIRY_INTERVAL_MS) return false;
    this.lastExpiry = now;
    if (!this.alerts.length && !this.feed.length) return false;

    const alerts = this.alerts.filter(a => now - a.raisedAt < ALERT_TTL_MS);
    const feed = this.feed.filter(e => now - e.raisedAt < EVENT_TTL_MS);
    if (alerts.length === this.alerts.length && feed.length === this.feed.length) return false;
    this.alerts = alerts;
    this.feed = feed;
    return true;
  }

  // ============================ WRITE ============================

  /**
   * Raises an alert, subject to cooldown and aggregation.
   *
   * The order matters. Cooldown runs first, so the same city reporting the same
   * problem every tick is dropped before it can inflate an aggregate count into
   * nonsense. Only genuinely distinct news reaches the aggregation step.
   */
  public push(spec: {
    kind: AlertKind;
    key: string;
    title: string;
    description?: string;
    focus?: { x: number; y: number };
    ref?: ObjectRef;
    /** Overrides the kind's default severity. */
    severity?: Severity;
    /** City-dossier condition this alert maps onto. */
    conditionHint?: string;
  }): void {
    if (!this.enabled) return;
    const now = performance.now();
    const year = this.sim?.currentYear ?? 0;
    const meta = KIND_META[spec.kind];

    const last = this.lastRaised.get(spec.key);
    if (last !== undefined && now - last < COOLDOWN_MS) return;
    this.lastRaised.set(spec.key, now);

    // Aggregation: fold into a live alert of the same kind rather than stacking
    // five near-identical lines.
    const open = this.alerts.find(a => a.kind === spec.kind && now - a.raisedAt < AGGREGATE_MS);
    if (open) {
      open.count++;
      open.title = meta.aggregate(open.count);
      // A group has no single subject, so the description is dropped — but the
      // first subject's focus and ref are kept, because taking the player to one
      // of the affected places is far better than taking them nowhere.
      open.description = undefined;
      open.raisedAt = now;
      open.year = year;
      this.notify();
      return;
    }

    this.alerts.unshift({
      id: `alert-${++this.seq}`,
      key: spec.key,
      kind: spec.kind,
      severity: spec.severity ?? meta.severity,
      title: spec.title,
      description: spec.description,
      year,
      focus: spec.focus,
      ref: spec.ref,
      conditionHint: spec.conditionHint,
      count: 1,
      raisedAt: now
    });
    if (this.alerts.length > MAX_ALERTS) this.alerts.length = MAX_ALERTS;
    this.notify();
  }

  /** Adds a line to the quiet feed. No dedup — these are already one-offs. */
  public note(text: string, icon: string, opts: { focus?: { x: number; y: number }; ref?: ObjectRef } = {}): void {
    if (!this.enabled) return;
    this.feed.unshift({
      id: `evt-${++this.seq}`,
      text,
      icon,
      year: this.sim?.currentYear ?? 0,
      raisedAt: performance.now(),
      focus: opts.focus,
      ref: opts.ref
    });
    if (this.feed.length > MAX_EVENTS) this.feed.length = MAX_EVENTS;
    this.notify();
  }

  // ============================ DERIVED ALERTS ============================

  /**
   * Alerts that are a *condition* rather than an event.
   *
   * Famine has no moment of onset the simulation announces, so it has to be
   * observed. It is checked against the cached snapshot once per simulated year —
   * never per frame — which is also the rate at which `famineYears` can change.
   */
  public evaluate(snapshot: WorldSnapshot): void {
    if (!this.enabled || snapshot.year === this.lastDerivedYear) return;
    this.lastDerivedYear = snapshot.year;
    if (!this.sim) return;

    // Report the worst-affected settlement by name and let aggregation handle the
    // rest; a list of every hungry city is a wall of text, not an alert.
    if (snapshot.citiesInFamine > 0) {
      let worst: City | null = null;
      for (const city of this.sim.cities.values()) {
        if (city.famineYears <= 0) continue;
        if (!worst || city.famineYears > worst.famineYears) worst = city;
      }
      if (worst) {
        this.push({
          kind: 'food-shortage',
          key: `food-shortage:${worst.id}`,
          title: 'Escassez de alimento',
          description: `${worst.name} · ${worst.famineYears} ${worst.famineYears === 1 ? 'ano' : 'anos'} de fome`,
          focus: { x: worst.x, y: worst.y },
          ref: this.cityRef(worst),
          conditionHint: 'food'
        });
      }
    }

    // The simulation already recomputes these capabilities annually. Read the
    // worst real gap; never scan recipes or the map from the alert layer.
    let gap: { kingdom: Kingdom; techId: string; name: string; capacity: number; reason: string } | null = null;
    for (const kingdom of this.sim.kingdoms.values()) {
      for (const capability of kingdom.techCapabilities) {
        if (capability.capacity >= 0.5) continue;
        const missingGood = capability.missingGoods[0];
        const missingBuilding = capability.missingBuildings[0];
        const reason = missingGood
          ? `insumo ausente: ${missingGood}`
          : missingBuilding ? `indústria ausente: ${missingBuilding}` : 'implantação material insuficiente';
        if (!gap || capability.capacity < gap.capacity) {
          gap = { kingdom, techId: capability.techId, name: capability.name, capacity: capability.capacity, reason };
        }
      }
    }
    if (gap) {
      this.push({
        kind: 'tech-bottleneck',
        key: `tech-bottleneck:${gap.kingdom.id}:${gap.techId}`,
        title: 'Gargalo tecnológico',
        description: `${gap.kingdom.name} · ${gap.name} · ${gap.reason}`,
        ref: {
          kind: 'technology', id: gap.techId, name: gap.name,
          qualifier: gap.kingdom.name, context: { kingdomId: gap.kingdom.id }, status: 'warning'
        }
      });
    }
  }

  // ============================ EVENT WIRING ============================

  /**
   * Subscribes to the simulation.
   *
   * Payload shapes vary across the engine's emit sites — some hand over a
   * Kingdom, others its id — so everything goes through `asKingdom`/`asCity`,
   * which accept either. That is defensive on purpose: a payload change should
   * degrade an alert's wording, not throw inside the event bus.
   */
  private wire(): void {
    // ---------------- Alerts ----------------

    events.on('warStarted', (d: any) => {
      const a = this.asKingdom(d?.k1);
      const b = this.asKingdom(d?.k2);
      if (!a && !b) return;
      const war = this.sim ? [...this.sim.diplomacy.activeWars.values()].find(candidate =>
        (candidate.attacker === a?.id && candidate.defender === b?.id) ||
        (candidate.attacker === b?.id && candidate.defender === a?.id)
      ) : null;
      this.push({
        kind: 'war-declared',
        key: `war:${a?.id ?? '?'}:${b?.id ?? '?'}`,
        title: 'Guerra declarada',
        description: `${a?.name ?? 'Um reino'} → ${b?.name ?? 'outro reino'}`,
        focus: this.capitalOf(a) ?? undefined,
        ref: war ? {
          kind: 'war', id: war.id, name: `${a?.name ?? 'Um reino'} vs ${b?.name ?? 'outro reino'}`,
          status: 'critical', qualifier: `Ano ${war.startYear}`
        } : a ? this.kingdomRef(a) : undefined
      });
    });

    events.on('siegeBegan', (d: any) => {
      const city = this.asCity(d?.city);
      const besieger = this.asKingdom(d?.besieger);
      if (!city) return;
      this.push({
        kind: 'city-besieged',
        key: `siege:${city.id}`,
        title: 'Cidade sitiada',
        description: besieger ? `${city.name} · cercada por ${besieger.name}` : city.name,
        focus: { x: city.x, y: city.y },
        ref: this.cityRef(city),
        conditionHint: 'security'
      });
    });

    events.on('cityCaptured', (d: any) => {
      const city = this.asCity(d?.city);
      const to = this.asKingdom(d?.to);
      if (!city) return;
      this.push({
        kind: 'city-captured',
        key: `captured:${city.id}`,
        title: d?.wasCapital ? 'Capital tomada' : 'Cidade tomada',
        description: to ? `${city.name} → ${to.name}` : city.name,
        focus: { x: city.x, y: city.y },
        ref: this.cityRef(city)
      });
    });

    events.on('kingdomFell', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      if (!k) return;
      this.push({
        kind: 'kingdom-fell',
        key: `fell:${k.id}`,
        title: 'Reino extinto',
        description: k.name,
        ref: this.kingdomRef(k)
      });
    });

    events.on('rebellionOccurred', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      const city = this.asCity(d?.city);
      this.push({
        kind: 'rebellion',
        key: `rebellion:${k?.id ?? city?.id ?? '?'}`,
        title: 'Rebelião',
        description: city ? `${city.name} se levanta contra ${k?.name ?? 'a coroa'}` : k?.name,
        focus: city ? { x: city.x, y: city.y } : undefined,
        ref: city ? this.cityRef(city) : k ? this.kingdomRef(k) : undefined
      });
    });

    events.on('settlementAbandoned', (d: any) => {
      const city = this.asCity(d?.city);
      if (!city) return;
      this.push({
        kind: 'settlement-abandoned',
        key: `abandoned:${city.id}`,
        title: 'Assentamento abandonado',
        description: city.name,
        focus: { x: city.x, y: city.y }
      });
    });

    events.on('societyUnrest', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      if (!k) return;
      this.push({
        kind: 'unrest',
        key: `unrest:${k.id}:${d?.faction ?? '?'}`,
        title: 'Agitação social',
        description: `${k.name} · ${d?.faction ?? 'facção'}`,
        focus: this.capitalOf(k) ?? undefined,
        ref: this.kingdomRef(k)
      });
    });

    events.on('embargoDeclared', (d: any) => {
      const by = this.asKingdom(d?.byKingdom);
      const against = this.asKingdom(d?.againstKingdom);
      if (!by && !against) return;
      this.push({
        kind: 'embargo',
        key: `embargo:${by?.id ?? '?'}:${against?.id ?? '?'}`,
        title: 'Embargo declarado',
        description: `${by?.name ?? 'Um reino'} ✕ ${against?.name ?? 'outro reino'}`,
        ref: by ? this.kingdomRef(by) : undefined
      });
    });

    events.on('tradeAgreementBroken', (d: any) => {
      const a = this.asKingdom(d?.kingdomA);
      const b = this.asKingdom(d?.kingdomB);
      if (!a && !b) return;
      this.push({
        kind: 'trade-broken',
        key: `trade-broken:${a?.id ?? '?'}:${b?.id ?? '?'}`,
        title: 'Acordo comercial rompido',
        description: `${a?.name ?? 'Um reino'} ✕ ${b?.name ?? 'outro reino'}`,
        ref: a ? this.kingdomRef(a) : undefined
      });
    });

    events.on('vassalageBroken', (d: any) => {
      const overlord = this.asKingdom(d?.overlord);
      const vassal = this.asKingdom(d?.vassal);
      if (!overlord && !vassal) return;
      this.push({
        kind: 'vassalage-broken',
        key: `vassal-broken:${overlord?.id ?? '?'}:${vassal?.id ?? '?'}`,
        title: 'Vassalagem rompida',
        description: `${vassal?.name ?? 'Um vassalo'} deixa ${overlord?.name ?? 'seu suserano'}`,
        ref: vassal ? this.kingdomRef(vassal) : undefined
      });
    });

    // ---------------- Feed ----------------

    events.on('warEnded', (d: any) => {
      const a = this.asKingdom(d?.k1);
      const b = this.asKingdom(d?.k2);
      this.note(`Paz entre ${a?.name ?? 'dois reinos'} e ${b?.name ?? 'outro'}`, 'diplomacy',
        { ref: a ? this.kingdomRef(a) : undefined });
    });

    events.on('siegeLifted', (d: any) => {
      const city = this.asCity(d?.city);
      if (!city) return;
      this.note(`O cerco a ${city.name} foi levantado`, 'defence',
        { focus: { x: city.x, y: city.y }, ref: this.cityRef(city) });
    });

    events.on('allianceFormed', (d: any) => {
      const a = this.asKingdom(d?.k1);
      const b = this.asKingdom(d?.k2);
      const name = d?.alliance?.name;
      this.note(name ? `Aliança forjada: ${name}` : `${a?.name ?? 'Um reino'} e ${b?.name ?? 'outro'} se aliam`, 'diplomacy');
    });

    events.on('techDiscovered', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      const tech = d?.tech?.name ?? d?.tech;
      if (!tech) return;
      this.note(`${k?.name ?? 'Um reino'} descobre ${tech}`, 'technology',
        {
          ref: d?.tech?.id
            ? { kind: 'technology', id: d.tech.id, name: tech, qualifier: k?.name, context: { kingdomId: k?.id } }
            : k ? this.kingdomRef(k) : undefined
        });
    });

    events.on('rulerCrowned', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      const ruler = d?.ruler?.name;
      if (!ruler) return;
      this.note(`${ruler} é coroado em ${k?.name ?? 'um reino'}`, 'kingdom',
        { focus: this.capitalOf(k) ?? undefined, ref: k ? this.kingdomRef(k) : undefined });
    });

    events.on('colonyFounded', (d: any) => {
      const colony = this.asCity(d?.colony);
      if (!colony) return;
      this.note(`${colony.name} é fundada`, 'city',
        { focus: { x: colony.x, y: colony.y }, ref: this.cityRef(colony) });
    });

    events.on('greatPersonBorn', (d: any) => {
      const name = d?.entity?.name;
      if (!name) return;
      this.note(`${name} nasce — ${d?.type ?? 'figura notável'}`, 'citizen', {
        focus: d.entity.x !== undefined ? { x: d.entity.x, y: d.entity.y } : undefined,
        ref: { kind: 'citizen', id: d.entity.id, name }
      });
    });

    events.on('governmentChanged', (d: any) => {
      const k = this.asKingdom(d?.kingdom);
      if (!k || !d?.to) return;
      this.note(`${k.name} adota ${d.to}${d.revolution ? ' por revolução' : ''}`, 'politics',
        { focus: this.capitalOf(k) ?? undefined, ref: this.kingdomRef(k) });
    });

    events.on('tradeRouteOpened', (d: any) => {
      const name = d?.route?.name ?? d?.route?.id;
      if (!name) return;
      this.note(`Nova rota de comércio: ${name}`, 'trade-route');
    });

    events.on('firstContact', (d: any) => {
      const a = this.asKingdom(d?.a);
      const b = this.asKingdom(d?.b);
      this.note(`${a?.name ?? 'Um povo'} e ${b?.name ?? 'outro'} se encontram`, 'diplomacy');
    });

    events.on('greatBridgeOpened', (d: any) => {
      const city = this.asCity(d?.city);
      if (!d?.name) return;
      this.note(`${city?.name ?? 'Uma cidade'} inaugura ${d.name}`, 'building',
        { focus: city ? { x: city.x, y: city.y } : undefined });
    });

    events.on('eraChanged', (era: any) => {
      if (typeof era !== 'string') return;
      this.note(`Uma nova era começa: ${era}`, 'era');
    });

    /**
     * `techUnlocked` had no emitter anywhere in the codebase — a listener waiting
     * for an event that has never once fired. `techDiscovered` above is the real
     * one, and it was already handled, so this was pure dead weight pretending the
     * alert channel covered something it did not. Removed rather than kept as a
     * placeholder: a subscription to nothing is worse than no subscription,
     * because it reads as coverage.
     *
     * These three, in its place, are events the world *does* emit and nothing was
     * listening for.
     */
    events.on('cityOccupied', (d: any) => {
      const city = this.asCity(d?.city);
      const occupier = this.asKingdom(d?.occupier);
      const previous = this.asKingdom(d?.previousOwner);
      if (!city) return;
      this.note(
        `${city.name} está ocupada por ${occupier?.name ?? 'forças inimigas'}${previous ? `, tomada de ${previous.name}` : ''}`,
        'war',
        { focus: { x: city.x, y: city.y }, ref: this.cityRef(city) }
      );
    });

    events.on('plagueOutbreak', (d: any) => {
      const infected = Number(d?.infected) || 0;
      if (infected <= 0) return;
      const city = this.asCity((d?.cityIds ?? [])[0]);
      this.note(
        `Peste: ${infected} ${infected === 1 ? 'pessoa adoeceu' : 'pessoas adoeceram'}${city ? ` em ${city.name}` : ''}`,
        'disaster',
        city
          ? { focus: { x: city.x, y: city.y }, ref: this.cityRef(city) }
          : { focus: { x: Number(d?.x) || 0, y: Number(d?.y) || 0 } }
      );
    });

    events.on('coupStaged', (d: any) => {
      const kingdom = this.asKingdom(d?.kingdom);
      if (!kingdom) return;
      this.note(`Golpe militar em ${kingdom.name}: a junta tomou o poder`, 'politics');
    });

    events.on('cityCeded', (d: any) => {
      const city = this.asCity(d?.city);
      const to = this.asKingdom(d?.to);
      if (!city) return;
      this.note(`${city.name} é cedida a ${to?.name ?? 'outro reino'}`, 'diplomacy',
        { focus: { x: city.x, y: city.y }, ref: this.cityRef(city) });
    });
  }

  // ============================ RESOLUTION ============================

  /** Accepts a Kingdom or a kingdom id, and returns the Kingdom or null. */
  private asKingdom(value: unknown): Kingdom | null {
    if (!value || !this.sim) return null;
    if (typeof value === 'string') return this.sim.kingdoms.get(value) ?? null;
    const candidate = value as Kingdom;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string' ? candidate : null;
  }

  /** Accepts a City or a city id, and returns the City or null. */
  private asCity(value: unknown): City | null {
    if (!value || !this.sim) return null;
    if (typeof value === 'string') return this.sim.cities.get(value) ?? null;
    const candidate = value as City;
    return typeof candidate.id === 'string' && typeof candidate.x === 'number' ? candidate : null;
  }

  /** Map position of a realm's capital, for alerts about a realm as a whole. */
  private capitalOf(kingdom: Kingdom | null): { x: number; y: number } | null {
    if (!kingdom || !this.sim) return null;
    const capital = this.sim.cities.get(kingdom.capitalCityId);
    return capital ? { x: capital.x, y: capital.y } : null;
  }

  private kingdomRef(kingdom: Kingdom): ObjectRef {
    return { kind: 'kingdom', id: kingdom.id, name: kingdom.name, accent: kingdom.color };
  }

  private cityRef(city: City): ObjectRef {
    const kingdom = city.kingdomId ? this.sim?.kingdoms.get(city.kingdomId) : undefined;
    return {
      kind: 'city',
      id: city.id,
      name: city.name,
      accent: kingdom?.color,
      qualifier: kingdom?.name
    };
  }
}

export const alerts = new AlertCenter();
