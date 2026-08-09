/** Grounded diagnoses and impact summaries for the Technology Command Center. */
import { TECH_ERAS } from '../../civ/TechTree';
import { BUILDINGS, type BuildingType } from '../../civ/Building';
import { GOODS, type GoodId } from '../../civ/Goods';
import type { Status } from '../kit';
import type {
  CapabilityState, CapabilityView, TechnologyUISnapshot, TechnologyView
} from './TechnologyMetrics';

export type TechnologyConditionKind = 'research' | 'resource' | 'industry' | 'infrastructure' | 'military' | 'opportunity';

export interface TechnologyCondition {
  id: string;
  kind: TechnologyConditionKind;
  title: string;
  summary: string;
  evidence: string;
  status: Status;
  techId?: string;
  good?: GoodId;
  building?: BuildingType;
  destination?: 'economy' | 'infrastructure' | 'technology';
}

export interface TechnologyImpact {
  id: string;
  category: 'economy' | 'infrastructure' | 'military' | 'society';
  techId: string;
  techName: string;
  title: string;
  detail: string;
  goods: GoodId[];
  buildings: BuildingType[];
}

const STATE_STATUS: Record<CapabilityState, Status> = {
  deployed: 'positive',
  available: 'neutral',
  limited: 'warning',
  unavailable: 'critical'
};

export function capabilityStatus(state: CapabilityState): Status {
  return STATE_STATUS[state];
}

export const CAPABILITY_LABEL: Record<CapabilityState, string> = {
  deployed: 'IMPLANTADO',
  available: 'DISPONÍVEL',
  limited: 'LIMITADO',
  unavailable: 'INDISPONÍVEL'
};

function constraintFor(capability: CapabilityView): TechnologyCondition {
  const missingGood = capability.missingGoods[0];
  if (missingGood) {
    return {
      id: `capability:${capability.techId}:good:${missingGood}`,
      kind: 'resource',
      title: `${capability.name}: gargalo de recursos`,
      summary: `${GOODS[missingGood]?.name ?? missingGood} não pode ser obtido pelo reino atualmente.`,
      evidence: capability.evidence[0],
      status: capabilityStatus(capability.state),
      techId: capability.techId,
      good: missingGood,
      destination: 'economy'
    };
  }
  const missingBuilding = capability.missingBuildings[0];
  if (missingBuilding) {
    return {
      id: `capability:${capability.techId}:building:${missingBuilding}`,
      kind: BUILDINGS[missingBuilding]?.category === 'infrastructure' ? 'infrastructure' : 'industry',
      title: `${capability.name}: gargalo industrial`,
      summary: `${BUILDINGS[missingBuilding]?.name ?? missingBuilding} não foi construído em nenhuma cidade.`,
      evidence: capability.evidence[0],
      status: capabilityStatus(capability.state),
      techId: capability.techId,
      building: missingBuilding,
      destination: BUILDINGS[missingBuilding]?.category === 'infrastructure' ? 'infrastructure' : 'technology'
    };
  }
  const damaged = capability.infrastructure.find(item => item.damaged > 0);
  if (damaged) {
    return {
      id: `capability:${capability.techId}:damage:${damaged.kind}`,
      kind: 'infrastructure',
      title: `${capability.name}: implantação danificada`,
      summary: damaged.detail,
      evidence: `${damaged.damaged} elemento(s) de infraestrutura danificado(s) ou cortado(s) registrado(s).`,
      status: 'warning',
      techId: capability.techId,
      destination: 'infrastructure'
    };
  }
  if (capability.military && capability.military.total > capability.military.adopted) {
    return {
      id: `capability:${capability.techId}:adoption`,
      kind: 'military',
      title: `${capability.name}: lacuna de adoção militar`,
      summary: `${capability.military.adopted} de ${capability.military.total} soldados usam este nível de equipamento.`,
      evidence: capability.evidence[0],
      status: 'warning',
      techId: capability.techId,
      destination: 'technology'
    };
  }
  return {
    id: `capability:${capability.techId}:deployment`,
    kind: 'industry',
    title: `${capability.name}: lacuna de implantação`,
    summary: capability.evidence[0],
    evidence: 'O conhecimento é preservado, mas a implantação física está incompleta.',
    status: capabilityStatus(capability.state),
    techId: capability.techId,
    destination: 'technology'
  };
}

/** The most useful conditions first; never more than five. */
export function technologicalConditions(snapshot: TechnologyUISnapshot, limit = 5): TechnologyCondition[] {
  const conditions: TechnologyCondition[] = [];
  if (snapshot.current && snapshot.researchOutput <= 0) {
    conditions.push({
      id: 'research:stalled',
      kind: 'research',
      title: 'Pesquisa estagnada',
      summary: `${snapshot.current.definition.name} possui um registro ativo, mas o reino não produz pesquisa.`,
      evidence: `${snapshot.current.progress.toFixed(0)} de ${snapshot.current.cost.toFixed(0)} pontos estão acumulados.`,
      status: 'critical',
      techId: snapshot.current.definition.id,
      destination: 'technology'
    });
  }

  const knownOrder = TECH_ERAS[snapshot.knownEra].order;
  const operatingOrder = TECH_ERAS[snapshot.operatingEra].order;
  if (knownOrder > operatingOrder) {
    conditions.push({
      id: 'era:capability-gap',
      kind: 'industry',
      title: 'Lacuna tecnologia–capacidade',
      summary: `O conhecimento chegou a ${snapshot.knownEraName}, enquanto a operação material permanece em ${snapshot.operatingEraName}.`,
      evidence: 'A engine deriva a era operacional a partir dos materiais obteníveis e desbloqueios construídos.',
      status: 'warning',
      destination: 'technology'
    });
  }

  for (const capability of snapshot.capabilities
    .filter(item => item.state === 'unavailable' || item.state === 'limited')
    .sort((a, b) => (a.engineCapacity ?? 1) - (b.engineCapacity ?? 1))) {
    conditions.push(constraintFor(capability));
  }

  const ready = snapshot.capabilities.find(item => item.state === 'available');
  if (ready) {
    conditions.push({
      id: `opportunity:${ready.techId}`,
      kind: 'opportunity',
      title: `${ready.name}: pronto para implantação`,
      summary: 'Os requisitos materiais conhecidos estão disponíveis, mas nenhuma implantação física foi registrada ainda.',
      evidence: ready.evidence[0],
      status: 'neutral',
      techId: ready.techId,
      destination: 'technology'
    });
  }

  if (!snapshot.current && snapshot.available.length > 0) {
    conditions.push({
      id: 'research:idle',
      kind: 'opportunity',
      title: 'Capacidade de pesquisa ociosa',
      summary: `${snapshot.available.length} opção(ões) de tecnologia atende(m) a todos os pré-requisitos.`,
      evidence: 'A seleção de pesquisa é controlada pela IA da simulação.',
      status: 'neutral',
      destination: 'technology'
    });
  }
  return conditions.slice(0, limit);
}

export function technologicalBottlenecks(snapshot: TechnologyUISnapshot, limit = 5): TechnologyCondition[] {
  return snapshot.capabilities
    .filter(item => item.state === 'limited' || item.state === 'unavailable')
    .sort((a, b) => (a.engineCapacity ?? 1) - (b.engineCapacity ?? 1))
    .map(constraintFor)
    .slice(0, limit);
}

function modifierParts(view: TechnologyView): string[] {
  const mods = view.definition.unlocks.modifiers;
  if (!mods) return [];
  const parts: string[] = [];
  if (mods.production && mods.production !== 1) parts.push(`produção ×${mods.production}`);
  if (mods.trade && mods.trade !== 1) parts.push(`comércio ×${mods.trade}`);
  if (mods.research && mods.research !== 1) parts.push(`pesquisa ×${mods.research}`);
  if (mods.growth && mods.growth !== 1) parts.push(`crescimento ×${mods.growth}`);
  if (mods.military && mods.military !== 1) parts.push(`militar ×${mods.military}`);
  if (mods.territory) parts.push(`território +${mods.territory}`);
  return parts;
}

/** Impacts are assembled only from declared unlocks/modifiers and observed deployment. */
export function technologyImpacts(snapshot: TechnologyUISnapshot): TechnologyImpact[] {
  const impacts: TechnologyImpact[] = [];
  for (const view of snapshot.technologies.filter(item => item.status === 'discovered')) {
    const tech = view.definition;
    const goods = tech.unlocks.goods ?? [];
    const buildings = tech.unlocks.buildings ?? [];
    const demands = view.demandedGoods.map(item => item.good);
    const mods = modifierParts(view);

    const economicBuildings = buildings.filter(type => BUILDINGS[type]?.category !== 'power' && BUILDINGS[type]?.category !== 'infrastructure');
    const economyDetail = [
      goods.length ? `novos bens: ${goods.map(good => GOODS[good]?.name ?? good).join(', ')}` : '',
      economicBuildings.length ? `indústrias: ${economicBuildings.map(type => BUILDINGS[type]?.name ?? type).join(', ')}` : '',
      demands.length ? `demanda estratégica: ${demands.map(good => GOODS[good]?.name ?? good).join(', ')}` : '',
      ...mods.filter(part => part.startsWith('produção') || part.startsWith('comércio'))
    ].filter(Boolean);
    if (economyDetail.length) {
      impacts.push({
        id: `${tech.id}:economy`, category: 'economy', techId: tech.id, techName: tech.name,
        title: tech.name, detail: economyDetail.join(' · '), goods: [...new Set([...goods, ...demands])], buildings: economicBuildings
      });
    }

    const infrastructureUnlocks = view.unlocks.filter(unlock => unlock.kind === 'infrastructure');
    const infrastructureBuildings = buildings.filter(type => BUILDINGS[type]?.category === 'infrastructure' || type === 'harbor');
    if (infrastructureUnlocks.length || infrastructureBuildings.length) {
      impacts.push({
        id: `${tech.id}:infrastructure`, category: 'infrastructure', techId: tech.id, techName: tech.name,
        title: tech.name,
        detail: [...infrastructureUnlocks.map(item => item.name), ...infrastructureBuildings.map(type => BUILDINGS[type]?.name ?? type)].join(' · '),
        goods: demands,
        buildings: infrastructureBuildings
      });
    }

    const militaryUnlocks = view.unlocks.filter(unlock => unlock.kind === 'military');
    const militaryMods = mods.filter(part => part.startsWith('militar'));
    const powerBuildings = buildings.filter(type => BUILDINGS[type]?.category === 'power');
    if (militaryUnlocks.length || militaryMods.length || powerBuildings.length) {
      impacts.push({
        id: `${tech.id}:military`, category: 'military', techId: tech.id, techName: tech.name,
        title: tech.name,
        detail: [
          ...militaryUnlocks.map(item => item.name),
          ...powerBuildings.map(type => BUILDINGS[type]?.name ?? type),
          ...militaryMods
        ].join(' · '),
        goods: [], buildings: powerBuildings
      });
    }

    const societyParts = [
      ...(tech.unlocks.governments ?? []).map(id => `governo: ${id}`),
      ...(tech.unlocks.features ?? []).filter(feature => !['mass_production', 'trade_routes', 'maritime_trade', 'banking', 'currency'].includes(feature)).map(feature => feature.replace(/_/g, ' ')),
      ...mods.filter(part => part.startsWith('pesquisa') || part.startsWith('crescimento') || part.startsWith('território'))
    ];
    if (societyParts.length) {
      impacts.push({
        id: `${tech.id}:society`, category: 'society', techId: tech.id, techName: tech.name,
        title: tech.name, detail: societyParts.join(' · '), goods: [], buildings: []
      });
    }
  }
  return impacts;
}

export function whyItMatters(view: TechnologyView): string[] {
  const reasons: string[] = [];
  const buildings = view.unlocks.filter(item => item.kind === 'buildings');
  const goods = view.unlocks.filter(item => item.kind === 'goods');
  const infrastructure = view.unlocks.filter(item => item.kind === 'infrastructure');
  const military = view.unlocks.filter(item => item.kind === 'military');
  if (buildings.length) reasons.push(`Torna ${buildings.map(item => item.name).join(', ')} construível.`);
  if (goods.length) reasons.push(`Torna ${goods.map(item => item.name).join(', ')} disponível para o sistema de produção.`);
  if (infrastructure.length) reasons.push(`Habilita ${infrastructure.map(item => item.name).join(', ')}.`);
  if (military.length) reasons.push(`Autoriza produção de ${military.map(item => item.name).join(', ')}; o equipamento ainda consome materiais reais.`);
  if (view.demandedGoods.length) reasons.push(`Cria demanda estratégica para ${view.demandedGoods.map(item => GOODS[item.good]?.name ?? item.good).join(', ')}.`);
  const mods = modifierParts(view);
  if (mods.length) reasons.push(`Aplica efeitos declarados do reino: ${mods.join(', ')}.`);
  return reasons;
}
