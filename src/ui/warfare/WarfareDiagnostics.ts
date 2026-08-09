import type { Status } from '../kit';
import type { WarfareUISnapshot, WarView } from './WarfareMetrics';

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

export interface WarCausalChain {
  id: string;
  cause: string;
  mechanism: string;
  consequence: string;
  status: Status;
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

    const exhausted = war.politics
      .filter(item => item.kingdom.surviving && item.warWeariness >= 60)
      .sort((a, b) => b.warWeariness - a.warWeariness)[0];
    if (exhausted) conditions.push({
      id: `weariness:${war.record.id}:${exhausted.kingdom.id}`,
      title: 'Alto desgaste de guerra',
      detail: `${exhausted.kingdom.name} · ${Math.round(exhausted.warWeariness)}%`,
      status: exhausted.warWeariness >= 80 ? 'critical' : 'warning', warId: war.record.id
    });

    if (war.economy.closedRoutes.length) conditions.push({
      id: `trade:${war.record.id}`,
      title: 'Comércio fechado pela guerra',
      detail: `${war.economy.closedRoutes.length} rota(s) · ${Math.round(war.economy.suspendedVolume)} capacidade atual suspensa`,
      status: 'warning', warId: war.record.id
    });

    const disrupted = war.infrastructure.damagedRailLines.length + war.infrastructure.disruptedPorts.length;
    if (disrupted) conditions.push({
      id: `infrastructure:${war.record.id}`,
      title: 'Infraestrutura de participantes danificada',
      detail: `${war.infrastructure.damagedRailLines.length} linha(s) ferroviária(s) danificada(s) · ${war.infrastructure.disruptedPorts.length} porto(s) inoperantes`,
      status: 'warning', warId: war.record.id
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

/** Traceable cause → mechanism → consequence chains for one conflict. */
export function warCausalChains(war: WarView): WarCausalChain[] {
  const chains: WarCausalChain[] = [];
  if (war.economy.closedRoutes.length) chains.push({
    id: 'closed-trade',
    cause: 'Guerra entre donos de rotas',
    mechanism: `${war.economy.closedRoutes.length} rota(s) bilateral(is) inativa(s)`,
    consequence: `${Math.round(war.economy.suspendedVolume)} capacidade de volume de rota atual suspensa`,
    status: 'warning'
  });
  if (war.sieges.length) chains.push({
    id: 'siege-economy',
    cause: `${war.sieges.length} cerco(s) ativo(s)`,
    mechanism: 'O sistema de cerco reduz comida e prosperidade e pode danificar edifícios e estradas',
    consequence: `${war.economy.damagedBuildings.reduce((sum, item) => sum + item.count, 0)} edifício(s) danificado(s) agora visível(is) nas cidades afetadas`,
    status: 'critical'
  });
  if (war.infrastructure.damagedRailLines.length) chains.push({
    id: 'rail-damage',
    cause: 'Ferrovia danificada de participantes do conflito',
    mechanism: `${war.infrastructure.damagedRailLines.reduce((sum, line) => sum + line.damagedTiles, 0)} bloco(s) danificado(s) através de ${war.infrastructure.damagedRailLines.length} linha(s)`,
    consequence: 'Capacidade logística atual e conectividade podem ser reduzidas nessas linhas',
    status: 'warning'
  });
  if (war.infrastructure.disruptedPorts.length) chains.push({
    id: 'port-down',
    cause: 'Porto de participante não está operacional',
    mechanism: `${war.infrastructure.disruptedPorts.length} porto(s) não pode(m) lidar com comércio no momento`,
    consequence: 'Rotas marítimas passando por esses portos não podem operar normalmente',
    status: 'warning'
  });
  if (war.civilianCasualties > 0) chains.push({
    id: 'capture-civilians',
    cause: 'Assentamento capturado registrado pela Crônica',
    mechanism: 'Resolução de captura registrou mortes civis',
    consequence: `${war.civilianCasualties} morte(s) civil(is) persistida(s) para esta guerra`,
    status: 'critical'
  });
  return chains;
}
