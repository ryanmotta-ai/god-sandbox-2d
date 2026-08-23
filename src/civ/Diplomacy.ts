import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';
import type { GoodId } from './Goods';

export type DiplomaticStatus = 'neutral' | 'friendly' | 'hostile' | 'war' | 'alliance';

/**
 * The standing below which a realm stops behaving like an ally: it will not march
 * in its bloc's defensive wars, and it walks out of the bloc entirely.
 *
 * Well below the +62 `CivilizationEngine` requires to form a pact, so the two
 * thresholds cannot chase each other.
 */
const ALLIANCE_FLOOR = 20;

export interface Alliance {
  id: string;
  name: string;
  members: Set<string>; // Kingdom IDs
  formedYear: number;
}

export type WarGoalKind = 'conquest' | 'defense' | 'subjugation' | 'colony' | 'resources' | 'independence';

export interface WarGoal {
  kind: WarGoalKind;
  targetCityId?: string;
  targetGoodId?: GoodId;
  targetKingdomId?: string;
  description: string;
  progress?: number; // 0..1
}

export interface WarRecord {
  id: string;
  attacker: string;
  defender: string;
  startYear: number;
  endYear: number | null;
  reason: string;
  goal: WarGoal;
  attackerAllies: string[];
  defenderAllies: string[];
  mercenaryCompanyIds?: string[];
  battles: number;
  attackerKills: number;
  defenderKills: number;
  victor: string | null;
  settlement: PeaceSettlement | null;
}

export type PeaceSettlement = 'white_peace' | 'victory' | 'exhaustion' | 'independence';

export interface Truce {
  kingdoms: [string, string];
  signedYear: number;
  untilYear: number;
  reason: string;
}

export class DiplomacyManager {
  // Key: "k1_id:k2_id" -> numeric relation (-100 to +100)
  private relations: Map<string, number> = new Map();
  public alliances: Map<string, Alliance> = new Map();
  public activeWars: Map<string, WarRecord> = new Map(); // Key: "k1_id:k2_id" (sorted)
  public warHistory: WarRecord[] = [];
  private truces: Map<string, Truce> = new Map();
  /** Derived pair schedule; rebuilt only when realm membership changes. */
  private scheduledPairs: Array<readonly [string, string]> = [];
  private scheduledFingerprint = '';
  private scheduledSource: string[] | null = null;

  private getPairKey(k1: string, k2: string): string {
    return k1 < k2 ? `${k1}:${k2}` : `${k2}:${k1}`;
  }

  public getRelation(k1: string, k2: string): number {
    if (k1 === k2) return 100;
    const key = this.getPairKey(k1, k2);
    return this.relations.get(key) ?? 0;
  }

  public getStatus(k1: string, k2: string): DiplomaticStatus {
    if (k1 === k2) return 'friendly';
    if (this.isAtWar(k1, k2)) return 'war';
    
    // Check alliances
    for (const alliance of this.alliances.values()) {
      if (alliance.members.has(k1) && alliance.members.has(k2)) return 'alliance';
    }
    
    const rel = this.getRelation(k1, k2);
    if (rel >= 50) return 'friendly';
    if (rel <= -50) return 'hostile';
    return 'neutral';
  }

  public setRelation(k1: string, k2: string, value: number): void {
    if (k1 === k2) return;
    const key = this.getPairKey(k1, k2);
    const clamped = Math.max(-100, Math.min(100, Math.round(value)));
    this.relations.set(key, clamped);
  }

  public changeRelation(k1: string, k2: string, delta: number): void {
    const current = this.getRelation(k1, k2);
    this.setRelation(k1, k2, current + delta);
  }

  public isAtWar(k1: string, k2: string): boolean {
    if (k1 === k2) return false;
    if (this.activeWars.has(this.getPairKey(k1, k2))) return true;
    for (const war of this.activeWars.values()) {
      const isSideA = war.attacker === k1 || war.attackerAllies.includes(k1);
      const isSideB = war.defender === k2 || war.defenderAllies.includes(k2);
      if (isSideA && isSideB) return true;
      const isRevA = war.attacker === k2 || war.attackerAllies.includes(k2);
      const isRevB = war.defender === k1 || war.defenderAllies.includes(k1);
      if (isRevA && isRevB) return true;
    }
    return false;
  }

  public getTruce(k1: string, k2: string, year: number): Truce | null {
    const key = this.getPairKey(k1, k2);
    const truce = this.truces.get(key);
    if (!truce) return null;
    if (year <= truce.untilYear) return truce;
    this.truces.delete(key);
    return null;
  }

  public hasTruce(k1: string, k2: string, year: number): boolean {
    return this.getTruce(k1, k2, year) !== null;
  }

  public recordTruce(k1: string, k2: string, year: number, durationYears: number, reason: string): void {
    const key = this.getPairKey(k1, k2);
    const sorted = key.split(':') as [string, string];
    this.truces.set(key, {
      kingdoms: sorted,
      signedYear: year,
      untilYear: year + Math.max(1, Math.round(durationYears)),
      reason
    });
  }

  /**
   * `force` voids a standing truce instead of being refused by it.
   *
   * The player's own "declare war" button had no way to say this, so a truce
   * signed by two realms silently refused a divine intervention — and the panel
   * reported it as "these realms are already at war", which was not true and left
   * nothing to do about it. Every other button on that panel forces its outcome;
   * this one now can too. A war voids the truce it breaks, so the record goes.
   */
  public declareWar(
    k1: string,
    k2: string,
    year: number,
    reason: string = 'Territorial Dispute',
    goal?: WarGoal,
    force: boolean = false
  ): boolean {
    if (k1 === k2) return false;
    const rebellion = /rebellion|secession|independence|revolta/i.test(reason);
    if (force) this.truces.delete(this.getPairKey(k1, k2));
    else if (!rebellion && this.hasTruce(k1, k2, year)) return false;
    const key = this.getPairKey(k1, k2);
    if (!this.activeWars.has(key)) {
      const defaultGoal: WarGoal = goal ?? this.deriveDefaultWarGoal(k1, k2, reason);
      const warRecord: WarRecord = {
        id: nextId('war'),
        attacker: k1,
        defender: k2,
        startYear: year,
        endYear: null,
        reason,
        goal: defaultGoal,
        attackerAllies: [],
        defenderAllies: [],
        mercenaryCompanyIds: [],
        battles: 0,
        attackerKills: 0,
        defenderKills: 0,
        victor: null,
        settlement: null
      };

      // Automatic alliance entrance (Mutual Defense Pact & Offensive Coalition)
      this.callAlliesToWar(warRecord, k1, k2, year);

      this.activeWars.set(key, warRecord);
      this.setRelation(k1, k2, -100);
      
      // Break direct alliances between warring leaders
      for (const [allyId, alliance] of this.alliances) {
        if (alliance.members.has(k1) && alliance.members.has(k2)) {
          alliance.members.delete(k2);
          if (alliance.members.size < 2) this.alliances.delete(allyId);
        }
      }
      
      events.emit('warStarted', { k1, k2, year, reason, war: warRecord });
      return true;
    }
    return false;
  }

  private deriveDefaultWarGoal(attacker: string, defender: string, reason: string): WarGoal {
    const text = reason.toLowerCase();
    if (text.includes('independência') || text.includes('independence') || text.includes('secessão')) {
      return { kind: 'independence', description: 'Conquistar soberania e libertação do domínio imperial' };
    }
    if (text.includes('colônia') || text.includes('colonial')) {
      return { kind: 'colony', description: 'Restaurar controle e tributação sobre terras coloniais' };
    }
    if (text.includes('imperial') || text.includes('subjugação') || text.includes('vassalagem')) {
      return { kind: 'subjugation', description: 'Subjugar o reino inimigo e torná-lo vassalo tributário' };
    }
    if (text.includes('recurso') || text.includes('mina') || text.includes('ouro')) {
      return { kind: 'resources', description: 'Conquistar nós estratégicos de minério e polos de produção' };
    }
    if (text.includes('defesa') || text.includes('retaliação') || text.includes('vingança')) {
      return { kind: 'defense', description: 'Repelir a agressão e forçar indenização por danos de guerra' };
    }
    return { kind: 'conquest', description: 'Conquistar assentamentos de fronteira e expandir território' };
  }

  /** Calls allies of defender (automatic mutual defense) and willing allies of attacker. */
  private callAlliesToWar(war: WarRecord, attackerId: string, defenderId: string, year: number): void {
    const defenderAlliance = this.allianceOf(defenderId);
    if (defenderAlliance) {
      for (const memberId of defenderAlliance.members) {
        if (memberId === defenderId || memberId === attackerId) continue;
        /**
         * A mutual defence pact still has two conditions, and the defensive
         * call-up used to check neither while the offensive one below checked
         * both.
         *
         * A signed truce is a signed truce. `settleWar` was fixed to give every
         * ally dragged into a war its own truce with the other side — and then
         * this loop ignored them, so the year after a peace the whole coalition
         * was called straight back in against realms it had just come to terms
         * with. That is the half of the post-peace-eternal-war fix that never
         * landed.
         *
         * And a realm that has drifted into contempt for its protector does not
         * march for it. Without that floor, the pact obliged a realm at -60 to
         * bleed for its ally and be slammed to -80 against the attacker for the
         * trouble — the ratchet that made a coalition permanent.
         */
        if (this.hasTruce(memberId, attackerId, year)) continue;
        if (this.getRelation(memberId, defenderId) < ALLIANCE_FLOOR) continue;
        if (!war.defenderAllies.includes(memberId)) {
          war.defenderAllies.push(memberId);
          this.setRelation(memberId, attackerId, -80);
          events.emit('allyJoinedWar', { allyId: memberId, war, side: 'defender', year });
        }
      }
    }

    const attackerAlliance = this.allianceOf(attackerId);
    if (attackerAlliance) {
      for (const memberId of attackerAlliance.members) {
        if (memberId === attackerId || memberId === defenderId) continue;
        // Offensively, allies join if they have good standing with attacker and no truce with defender
        const relWithAttacker = this.getRelation(memberId, attackerId);
        const relWithDefender = this.getRelation(memberId, defenderId);
        if (relWithAttacker >= 30 && relWithDefender < 50 && !this.hasTruce(memberId, defenderId, year)) {
          if (!war.attackerAllies.includes(memberId)) {
            war.attackerAllies.push(memberId);
            this.setRelation(memberId, defenderId, -80);
            events.emit('allyJoinedWar', { allyId: memberId, war, side: 'attacker', year });
          }
        }
      }
    }
  }

  public recordBattle(k1: string, k2: string, k1Kills: number, k2Kills: number): void {
    const key = this.getPairKey(k1, k2);
    const war = this.activeWars.get(key);
    if (war) {
      war.battles++;
      if (war.attacker === k1 || war.attackerAllies.includes(k1)) {
        war.attackerKills += k1Kills;
        war.defenderKills += k2Kills;
      } else {
        war.defenderKills += k1Kills;
        war.attackerKills += k2Kills;
      }
      // Each engagement hardens mutual hostility
      if (k1Kills > 0) this.changeRelation(k1, k2, -k1Kills * 0.4);
      if (k2Kills > 0) this.changeRelation(k2, k1, -k2Kills * 0.4);
    }
  }

  public endWar(k1: string, k2: string, year: number): void {
    const key = this.getPairKey(k1, k2);
    const war = this.activeWars.get(key);
    if (war) {
      war.endYear = year;
      war.settlement ??= 'white_peace';
      this.warHistory.push(war);
      this.activeWars.delete(key);
      this.setRelation(k1, k2, -20); // Still hostile but not at war
      this.recordTruce(k1, k2, year, 5, war.settlement);
      events.emit('warEnded', { k1, k2, year, war });
    }
  }

  public settleWar(
    k1: string,
    k2: string,
    year: number,
    settlement: PeaceSettlement,
    victor: string | null = null,
    relationAfter?: number,
    truceYears: number = 5
  ): void {
    const key = this.getPairKey(k1, k2);
    const war = this.activeWars.get(key);
    if (!war) return;

    war.endYear = year;
    war.settlement = settlement;
    war.victor = victor;
    this.warHistory.push(war);
    this.activeWars.delete(key);
    /**
     * A treaty binds everyone who was called to the war, not only the two who
     * signed it.
     *
     * Allies are dragged in by `callAlliesToWar`, which sets them to -80 against
     * the other side. Settling used to touch the two principals alone, so every
     * ally walked out of the peace still at -80 and with no truce holding them:
     * the grievance gate opened again immediately and the same coalition was
     * back at war the following year, over and over.
     */
    const settled = relationAfter ?? (settlement === 'white_peace' ? -20 : -35);
    const oneSide = [war.attacker, ...war.attackerAllies];
    const otherSide = [war.defender, ...war.defenderAllies];
    for (const a of oneSide) {
      for (const b of otherSide) {
        if (a === b) continue;
        this.setRelation(a, b, settled);
        this.recordTruce(a, b, year, truceYears, settlement);
      }
    }
    events.emit('warEnded', { k1, k2, year, war });
  }

  public createAlliance(k1: string, k2: string, name: string, year: number): Alliance | null {
    if (this.isAtWar(k1, k2)) return null;

    const a1 = this.allianceOf(k1);
    const a2 = this.allianceOf(k2);
    if (a1 && a2 && a1.id === a2.id) return null; // already in the same bloc

    let alliance: Alliance;
    if (a1 && a2) {
      // Merge the two blocs into the larger one.
      const [big, small] = a1.members.size >= a2.members.size ? [a1, a2] : [a2, a1];
      for (const m of small.members) big.members.add(m);
      this.alliances.delete(small.id);
      alliance = big;
    } else if (a1 || a2) {
      alliance = (a1 ?? a2)!;
      alliance.members.add(k1);
      alliance.members.add(k2);
    } else {
      alliance = {
        // `nextId`, not the wall clock. Two leagues founded in the same
        // millisecond used to collide on one id, and a world replayed from the
        // same seed produced different ones every run — which the war record two
        // methods up already knew, and used `nextId('war')` for.
        id: nextId('all'),
        name,
        members: new Set([k1, k2]),
        formedYear: year
      };
      this.alliances.set(alliance.id, alliance);
    }

    for (const m of alliance.members) {
      if (m === k1 || m === k2) continue;
      this.setRelation(k1, m, 75);
      this.setRelation(k2, m, 75);
    }
    this.setRelation(k1, k2, 75);
    events.emit('allianceFormed', { alliance, k1, k2 });
    return alliance;
  }

  /**
   * The bloc a realm belongs to, if any. Public because the coalition rule needs
   * to know whether a frightened realm is already in a league before opening
   * another one.
   */
  public allianceOf(kingdomId: string): Alliance | null {
    for (const a of this.alliances.values()) {
      if (a.members.has(kingdomId)) return a;
    }
    return null;
  }

  /**
   * An alliance its members no longer want ends.
   *
   * `CivilizationEngine` has always claimed this happens — "their pact is stable
   * unless the negatives above pull it down (then it can dissolve)" — and clamps
   * allied drift to its negative half on the strength of that claim. Nothing
   * dissolved anything. A bloc formed at +62 kept every member for the rest of
   * the world's life while their relations rotted toward -100, and the call-up
   * below went on conscripting realms into wars for allies they had come to
   * detest. That is the eternal-coalition trap, and it is why the same two
   * realms could end up fighting the same war forever.
   *
   * A realm leaves when it stands below the floor with *most* of the bloc, which
   * is a deliberately different test from the obvious one. Averaging the relations
   * looks right and is wrong: in a league of three where one member has soured to
   * -70, that single figure drags everyone else's average under the floor too, and
   * the whole league dissolves instead of expelling the one realm that left it.
   * Counting how many bloc-mates a realm has fallen out with keeps the asymmetry
   * that matters — the realm that hates everyone goes, the realm with one bad
   * neighbour and two good ones stays.
   *
   * The floor sits far below the +62 a pact needs to form, and that gap is the
   * point: a treaty should be slow to make and slow to break, never flapping
   * across the line on a point of drift.
   */
  public dissolveStrainedAlliances(year: number): void {
    for (const alliance of [...this.alliances.values()]) {
      const members = [...alliance.members];

      // Every member is judged against the bloc as it stood when the pass began,
      // so who leaves cannot depend on the order the set happens to iterate in.
      const leaving = members.filter(member => {
        const others = members.filter(m => m !== member);
        if (others.length === 0) return true;
        let fallenOut = 0;
        for (const other of others) {
          if (this.getRelation(member, other) < ALLIANCE_FLOOR) fallenOut++;
        }
        return fallenOut * 2 > others.length;
      });

      for (const member of leaving) {
        alliance.members.delete(member);
        events.emit('allianceLeft', { alliance, kingdomId: member, year });
      }

      // A pact of one is not a pact.
      if (alliance.members.size < 2) {
        this.alliances.delete(alliance.id);
        events.emit('allianceDissolved', { alliance, year });
      }
    }
  }

  /** Diplomacy tick - natural drift, war declarations, peace treaties */
  public tickDiplomacy(kingdomIds: string[], year: number): void {
    const ids = [...kingdomIds];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k1 = ids[i];
        const k2 = ids[j];
        const rel = this.getRelation(k1, k2);

        if (rel > 5) this.changeRelation(k1, k2, -0.75);
        else if (rel < -5) this.changeRelation(k1, k2, 0.5);

        if (this.isAtWar(k1, k2)) {
          const war = this.activeWars.get(this.getPairKey(k1, k2));
          if (war && (year - war.startYear) > 3) {
            const duration = year - war.startYear;
            const casualties = war.attackerKills + war.defenderKills;
            const peaceChance = Math.min(0.22, 0.02 + duration * 0.012 + casualties * 0.0015);
            if (rng.chance(peaceChance)) {
              this.settleWar(k1, k2, year, casualties > 10 ? 'exhaustion' : 'white_peace', null, -25, 4 + Math.floor(duration / 2));
            }
          }
          continue;
        }

        // Not a test — `getTruce` prunes on read, so this *is* the yearly expiry
        // sweep and the return value is deliberately thrown away. It used to be
        // written as `if (hasTruce(...)) continue;` on the last line of the loop,
        // which reads exactly like dead code you are welcome to delete.
        this.hasTruce(k1, k2, year);
      }
    }

    // Blocs are judged once a year, after the drift above has moved the relations
    // the decision is made on.
    this.dissolveStrainedAlliances(year);
  }

  /**
   * One of N stable pair buckets per simulation tick, eliminating O(R²) spikes.
   *
   * Nothing outside this file calls this. `tickDiplomacy` above is the live path —
   * `EntityAI` drives it once a year — and this is a second copy of the same drift
   * and peace rules that has never run. Left in place rather than deleted because
   * it is somebody's unfinished work, but noted here for two reasons: the two
   * copies will drift apart the first time one is tuned, and whoever wires this up
   * has to call `dissolveStrainedAlliances` once a year themselves, because a bloc
   * cannot be judged from inside a per-pair bucket.
   */
  public tickDiplomacySlice(kingdomIds: string[], year: number, phase: number, buckets: number = 10): void {
    if (kingdomIds !== this.scheduledSource) {
      const sorted = [...kingdomIds].sort();
      const fingerprint = sorted.join('|');
      this.scheduledSource = kingdomIds;
      if (fingerprint === this.scheduledFingerprint) return this.tickDiplomacySliceScheduled(year, phase, buckets);
      this.scheduledFingerprint = fingerprint;
      this.scheduledPairs = [];
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) this.scheduledPairs.push([sorted[i], sorted[j]]);
      }
    }
    this.tickDiplomacySliceScheduled(year, phase, buckets);
  }

  private tickDiplomacySliceScheduled(year: number, phase: number, buckets: number): void {
    const bucketCount = Math.max(1, Math.floor(buckets));
    const start = ((phase % bucketCount) + bucketCount) % bucketCount;
    for (let i = start; i < this.scheduledPairs.length; i += bucketCount) {
      const [k1, k2] = this.scheduledPairs[i];
      const rel = this.getRelation(k1, k2);
      if (rel > 5) this.changeRelation(k1, k2, -0.75);
      else if (rel < -5) this.changeRelation(k1, k2, 0.5);

      if (this.isAtWar(k1, k2)) {
        const war = this.activeWars.get(this.getPairKey(k1, k2));
        if (war && year - war.startYear > 3) {
          const duration = year - war.startYear;
          const casualties = war.attackerKills + war.defenderKills;
          const peaceChance = Math.min(0.22, 0.02 + duration * 0.012 + casualties * 0.0015);
          if (rng.chance(peaceChance)) {
            this.settleWar(k1, k2, year, casualties > 10 ? 'exhaustion' : 'white_peace', null, -25, 4 + Math.floor(duration / 2));
          }
        }
      } else {
        this.hasTruce(k1, k2, year);
      }
    }
  }

  /** Get all wars involving a specific kingdom (as primary or allied participant) */
  public getWarsFor(kingdomId: string): WarRecord[] {
    const wars: WarRecord[] = [];
    for (const [, war] of this.activeWars) {
      if (
        war.attacker === kingdomId ||
        war.defender === kingdomId ||
        war.attackerAllies.includes(kingdomId) ||
        war.defenderAllies.includes(kingdomId)
      ) {
        wars.push(war);
      }
    }
    return wars;
  }

  /** Get the enemy kingdom IDs for a given kingdom */
  public getEnemies(kingdomId: string): string[] {
    const enemies = new Set<string>();
    for (const [, war] of this.activeWars) {
      const isAttackerSide = war.attacker === kingdomId || war.attackerAllies.includes(kingdomId);
      const isDefenderSide = war.defender === kingdomId || war.defenderAllies.includes(kingdomId);
      if (isAttackerSide) {
        enemies.add(war.defender);
        for (const ally of war.defenderAllies) enemies.add(ally);
      } else if (isDefenderSide) {
        enemies.add(war.attacker);
        for (const ally of war.attackerAllies) enemies.add(ally);
      }
    }
    return Array.from(enemies);
  }

  /** Snapshot for save files. Sets and Maps don't survive JSON on their own. */
  public serialize(): any {
    return {
      relations: Array.from(this.relations.entries()),
      alliances: Array.from(this.alliances.values()).map(a => ({
        id: a.id,
        name: a.name,
        members: Array.from(a.members),
        formedYear: a.formedYear
      })),
      activeWars: Array.from(this.activeWars.entries()).map(([k, war]) => [k, {
        ...war,
        goal: war.goal,
        attackerAllies: war.attackerAllies ?? [],
        defenderAllies: war.defenderAllies ?? [],
        mercenaryCompanyIds: war.mercenaryCompanyIds ?? []
      }]),
      warHistory: this.warHistory,
      truces: Array.from(this.truces.entries())
    };
  }

  public deserialize(data: any): void {
    this.relations = new Map(data.relations ?? []);

    this.alliances.clear();
    for (const a of data.alliances ?? []) {
      this.alliances.set(a.id, {
        id: a.id,
        name: a.name,
        members: new Set(a.members),
        formedYear: a.formedYear
      });
    }

    this.activeWars = new Map();
    for (const [key, warData] of data.activeWars ?? []) {
      const defaultGoal: WarGoal = warData.goal ?? {
        kind: 'conquest',
        description: warData.reason ?? 'Disputa de Fronteira'
      };
      this.activeWars.set(key, {
        ...warData,
        goal: defaultGoal,
        attackerAllies: warData.attackerAllies ?? [],
        defenderAllies: warData.defenderAllies ?? [],
        mercenaryCompanyIds: warData.mercenaryCompanyIds ?? []
      });
    }

    this.warHistory = (data.warHistory ?? []).map((w: any) => ({
      ...w,
      goal: w.goal ?? { kind: 'conquest', description: w.reason ?? 'Disputa Territorial' },
      attackerAllies: w.attackerAllies ?? [],
      defenderAllies: w.defenderAllies ?? []
    }));

    this.truces = new Map(data.truces ?? []);
    this.scheduledPairs = [];
    this.scheduledFingerprint = '';
    this.scheduledSource = null;
  }
}
