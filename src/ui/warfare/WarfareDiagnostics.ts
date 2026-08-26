import type { Status } from '../kit';
import type { WarfareUISnapshot } from './WarfareMetrics';

export interface WarfareCondition {
  id: string;
  title: string;
  detail: string;
  status: Status;
  warId?: string;
  cityId?: string;
  x?: number;
  y?: number;
}

/**
 * The few conditions that deserve command attention right now. Every condition
 * is backed by an explicit simulation state or by a documented UI derivation.
 */
export function warfareConditions(snapshot: WarfareUISnapshot): WarfareCondition[] {
  const conditions: WarfareCondition[] = [];
  for (const war of snapshot.activeWars) {
    const capital = war.cities.find(city => city.isCapital && (city.status === 'besieged' || city.status === 'threatened'));
    if (capital) conditions.push({
      id: `capital:${war.record.id}:${capital.id}`,
      title: capital.status === 'besieged' ? 'Capital sob cerco' : 'Capital ameaçada',
      detail: `${capital.name} · ${war.attacker.name} vs ${war.defender.name}`,
      status: 'critical', warId: war.record.id, cityId: capital.id, x: capital.x, y: capital.y
    });

    const major = war.engagements.find(item => item.major);
    if (major) conditions.push({
      id: `engagement:${major.id}`,
      title: 'Grande combate ativo',
      detail: `${major.location} · ${major.attackerForces + major.defenderForces} combatantes em contato`,
      status: 'critical', warId: war.record.id, x: major.x, y: major.y
    });

    const exhausted = [war.attacker, war.defender]
      .filter(realm => realm.surviving && realm.warWeariness >= 60)
      .sort((a, b) => b.warWeariness - a.warWeariness)[0];
    if (exhausted) conditions.push({
      id: `weariness:${war.record.id}:${exhausted.id}`,
      title: 'Alto desgaste de guerra',
      detail: `${exhausted.name} · ${Math.round(exhausted.warWeariness)}%`,
      status: exhausted.warWeariness >= 80 ? 'critical' : 'warning', warId: war.record.id
    });

    if (war.allies.length) conditions.push({
      id: `allies:${war.record.id}`,
      title: 'Intervenção aliada confirmada',
      detail: `${war.allies.map(ally => ally.kingdom.name).join(', ')} entraram por registro(s) de guerra separado(s)`,
      status: 'neutral', warId: war.record.id
    });
  }

  const priority: Record<Status, number> = { critical: 0, warning: 1, neutral: 2, positive: 3 };
  return conditions.sort((a, b) => priority[a.status] - priority[b.status]).slice(0, 5);
}
