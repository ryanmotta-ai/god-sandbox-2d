import { events } from '../core/EventBus';
import { rng, nextId } from '../core/Random';

export type DiplomaticStatus = 'neutral' | 'friendly' | 'hostile' | 'war' | 'alliance';

export interface Alliance {
  id: string;
  name: string;
  members: Set<string>; // Kingdom IDs
  formedYear: number;
}

export interface WarRecord {
  id: string;
  attacker: string;
  defender: string;
  startYear: number;
  endYear: number | null;
  reason: string;
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
    const key = this.getPairKey(k1, k2);
    if (this.activeWars.has(key)) return 'war';
    
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
    return this.activeWars.has(this.getPairKey(k1, k2));
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

  public declareWar(k1: string, k2: string, year: number, reason: string = 'Territorial Dispute'): boolean {
    if (k1 === k2) return false;
    const rebellion = /rebellion|secession|independence/i.test(reason);
    if (!rebellion && this.hasTruce(k1, k2, year)) return false;
    const key = this.getPairKey(k1, k2);
    if (!this.activeWars.has(key)) {
      const warRecord: WarRecord = {
        id: nextId('war'),
        attacker: k1,
        defender: k2,
        startYear: year,
        endYear: null,
        reason,
        battles: 0,
        attackerKills: 0,
        defenderKills: 0,
        victor: null,
        settlement: null
      };
      this.activeWars.set(key, warRecord);
      this.setRelation(k1, k2, -100);
      
      // Break alliances between warring kingdoms
      for (const [allyId, alliance] of this.alliances) {
        if (alliance.members.has(k1) && alliance.members.has(k2)) {
          alliance.members.delete(k2);
          if (alliance.members.size < 2) this.alliances.delete(allyId);
        }
      }
      
      events.emit('warStarted', { k1, k2, year, reason });
      return true;
    }
    return false;
  }

  public recordBattle(k1: string, k2: string, k1Kills: number, k2Kills: number): void {
    const key = this.getPairKey(k1, k2);
    const war = this.activeWars.get(key);
    if (war) {
      war.battles++;
      if (war.attacker === k1) {
        war.attackerKills += k1Kills;
        war.defenderKills += k2Kills;
      } else {
        war.defenderKills += k1Kills;
        war.attackerKills += k2Kills;
      }
      // Each engagement hardens mutual hostility so an unresolved war keeps
      // dragging relations down even without city captures.
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
    this.setRelation(k1, k2, relationAfter ?? (settlement === 'white_peace' ? -20 : -35));
    this.recordTruce(k1, k2, year, truceYears, settlement);
    events.emit('warEnded', { k1, k2, year, war });
  }

  public createAlliance(k1: string, k2: string, name: string, year: number): Alliance | null {
    if (this.isAtWar(k1, k2)) return null;

    // Consolidate instead of fragmenting: if either realm is already in an
    // alliance, the newcomer joins that pact (and two pacts merge when both
    // are already allied). One Alliance per bloc, not one per pair.
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
        id: `all_${Date.now()}`,
        name,
        members: new Set([k1, k2]),
        formedYear: year
      };
      this.alliances.set(alliance.id, alliance);
    }

    // Pull the newcomer into friendship with every existing member, not just
    // the treaty partner. One pact, many friends.
    for (const m of alliance.members) {
      if (m === k1 || m === k2) continue;
      this.setRelation(k1, m, 75);
      this.setRelation(k2, m, 75);
    }
    this.setRelation(k1, k2, 75);
    events.emit('allianceFormed', { alliance, k1, k2 });
    return alliance;
  }

  private allianceOf(kingdomId: string): Alliance | null {
    for (const a of this.alliances.values()) {
      if (a.members.has(kingdomId)) return a;
    }
    return null;
  }

  /** Diplomacy tick - natural drift, war declarations, peace treaties */
  public tickDiplomacy(kingdomIds: string[], year: number): void {
    const ids = [...kingdomIds];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k1 = ids[i];
        const k2 = ids[j];
        const rel = this.getRelation(k1, k2);

        // Natural drift toward 0 (neutral). This also applies to allies — a
        // pact does not freeze relations; without active cooperation they
        // slowly cool and can dissolve when an alliance drops below two.
        if (rel > 5) this.changeRelation(k1, k2, -0.75);
        else if (rel < -5) this.changeRelation(k1, k2, 0.5);

        if (this.isAtWar(k1, k2)) {
          // Ongoing war: chance for peace rises with duration and casualties.
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

        if (this.hasTruce(k1, k2, year)) continue;

        // War and alliance checks are handled primarily by the strategic
        // geopolitical layer; this tick only drifts relations here.
      }
    }
  }

  /** One of N stable pair buckets per simulation tick, eliminating O(R²) spikes. */
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

  /** Get all wars involving a specific kingdom */
  public getWarsFor(kingdomId: string): WarRecord[] {
    const wars: WarRecord[] = [];
    for (const [key, war] of this.activeWars) {
      if (war.attacker === kingdomId || war.defender === kingdomId) {
        wars.push(war);
      }
    }
    return wars;
  }

  /** Get the enemy kingdom IDs for a given kingdom */
  public getEnemies(kingdomId: string): string[] {
    const enemies: string[] = [];
    for (const [key, war] of this.activeWars) {
      if (war.attacker === kingdomId) enemies.push(war.defender);
      else if (war.defender === kingdomId) enemies.push(war.attacker);
    }
    return enemies;
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
      activeWars: Array.from(this.activeWars.entries()),
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

    this.activeWars = new Map(data.activeWars ?? []);
    this.warHistory = data.warHistory ?? [];
    this.truces = new Map(data.truces ?? []);
    this.scheduledPairs = [];
    this.scheduledFingerprint = '';
    this.scheduledSource = null;
  }
}
