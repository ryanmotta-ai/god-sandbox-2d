import { el, type Child } from '../core/Dom';
import {
  badge, badgeRow, button, emptyState, formatCompact, formatPercent, objectLink,
  panel, progressBar, rowList, section, stat, statGrid, statRow, table
} from '../kit';
import { GOODS, type GoodId } from '../../civ/Goods';
import { warfareConditions } from './WarfareDiagnostics';
import {
  FORCE_STATUS_LABEL, SETTLEMENT_LABEL, warStateLabel,
  type ArmyForceView, type EngagementView, type RealmRefView,
  type WarfareUISnapshot, type WarView
} from './WarfareMetrics';

export interface WarfareScreenHost {
  openWar(warId: string): void;
  openRealm(kingdomId: string): void;
  openCity(cityId: string): void;
  openChronicle(): void;
  viewWarOnMap(war: WarView): void;
  viewPointOnMap(x: number, y: number): void;
  followForce(force: ArmyForceView): void;
}

const pct = (value: number): string => `${Math.round(value)}%`;
const statusForCity = (status: string) => status === 'besieged' ? 'critical' : status === 'threatened' ? 'warning' : status === 'captured' ? 'neutral' : 'positive';

export const TRAIT_LABELS: Record<string, string> = {
  tactician: 'Estrategista (+25% Dano, +Cerco)',
  valiant: 'Valente (+30% Moral/HP)',
  fortifier: 'Fortificador (+40% Defesa)',
  ruthless: 'Implacável (+35% Dano, Desgaste)'
};

export const GOAL_LABEL: Record<string, string> = {
  conquest: 'Conquista Territorial',
  defense: 'Defesa da Soberania',
  subjugation: 'Subjugação / Vassalagem',
  colony: 'Anexação Colonial',
  resources: 'Guerra por Recursos',
  independence: 'Guerra de Independência'
};

export const ARMY_STATE_LABEL: Record<string, string> = {
  mustering: 'Convocando e armando',
  marching: 'Em marcha de campanha',
  besieging: 'Em cerco ativo',
  defending: 'Em defesa da pátria',
  retreating: 'Em retirada estratégica',
  garrisoned: 'Em guarnição de paz'
};

export const SIEGE_PHASE_LABEL: Record<string, string> = {
  encirclement: 'Isolamento e Bloqueio',
  bombardment: 'Bombardeio de Muralhas',
  assault: 'Assalto Direto às Brechas',
  starvation: 'Cerco por Fome',
  negotiation: 'Negociação de Rendição'
};

export const DOCTRINE_TYPE_LABELS: Record<string, string> = {
  infantry_focus: 'Foco em Infantaria Pesada',
  cavalry_focus: 'Foco em Cavalaria & Manobra',
  archery_focus: 'Foco em Arqueiros & Linha de Tiro',
  artillery_focus: 'Foco em Artilharia & Engenharia',
  balanced: 'Doutrina de Armas Combinadas',
  defensive: 'Doutrina Fortificada / Defensiva',
  guerrilla: 'Doutrina de Guerrilha / Emboscada'
};

export const TRADITION_LABELS: Record<string, string> = {
  shield_wall: 'Parede de Escudos (+20% Defesa Infantaria)',
  phalanx: 'Falange de Piques (+15% vs Cavalaria)',
  heavy_cavalry: 'Cavalaria de Choque (+30% Carga)',
  horse_archers: 'Arqueiros Montados (Ataque Móvel)',
  longbow_mastery: 'Mestres do Arco Longo (+25% Dano à Distância)',
  crossbow_discipline: 'Besta de Precisão (Perfuração)',
  siege_engineering: 'Engenharia de Cerco (+25% Dano Muralhas)',
  scorched_earth: 'Terra Arrasada (Atrito Invasor)',
  guerrilla_tactics: 'Táticas de Guerrilha (+25% Bosques/Pântanos)',
  fortification_mastery: 'Mestres da Fortificação (+25% Defesa)',
  conscription: 'Conscrição em Massa (+20% Milícia)',
  professional_army: 'Exército Profissional (+15% Moral, -20% Fadiga)'
};

function realmLink(realm: RealmRefView, host: WarfareScreenHost, qualifier?: string): HTMLElement {
  return objectLink({
    kind: 'kingdom', id: realm.id, name: realm.name, accent: realm.color,
    qualifier: qualifier ?? (realm.surviving ? undefined : 'não existe mais')
  }, { onOpen: () => host.openRealm(realm.id) });
}

function warLink(war: WarView, host: WarfareScreenHost): HTMLElement {
  return objectLink({
    kind: 'war', id: war.record.id, name: `${war.attacker.name} vs ${war.defender.name}`,
    qualifier: `Ano ${war.record.startYear}`, status: war.active ? 'critical' : 'neutral'
  }, { onOpen: () => host.openWar(war.record.id) });
}

function cityLink(city: WarView['cities'][number], host: WarfareScreenHost): HTMLElement {
  return objectLink({
    kind: 'city', id: city.id, name: city.name, accent: city.owner?.color,
    qualifier: city.owner?.name, status: statusForCity(city.status)
  }, { onOpen: () => host.openCity(city.id) });
}

function warSummaryStats(war: WarView, host: WarfareScreenHost): HTMLElement {
  const heldCities = war.territory.attackerHeldCities + war.territory.defenderHeldCities;
  const highestWeariness = Math.max(war.attacker.warWeariness, war.defender.warWeariness, 0);
  return statGrid([
    stat({ label: 'Status', value: warStateLabel(war), icon: 'war', status: war.active ? 'critical' : 'neutral' }),
    stat({ label: 'Duração', value: war.duration, unit: 'anos', icon: 'history', meta: `Início em ${war.record.startYear}` }),
    stat({
      label: `Força de ${war.attacker.name}`, value: formatCompact(war.attackerForce?.strength ?? 0), icon: 'army',
      tooltip: { title: 'Força militar', description: 'Combatentes vivos: dano + metade da defesa + nível, modificado por tecnologia militar, governo e desgaste de guerra.' }
    }),
    stat({
      label: `Força de ${war.defender.name}`, value: formatCompact(war.defenderForce?.strength ?? 0), icon: 'army',
      tooltip: { title: 'Força militar', description: 'Um agregado de força de campo atual. Não é uma pontuação de guerra ou probabilidade de vitória.' }
    }),
    stat({ label: 'Mortes em batalha', value: war.battlefieldCasualties, icon: 'swords', status: war.battlefieldCasualties ? 'critical' : 'neutral', tooltip: { title: 'Baixas', description: 'Mortes atribuídas a cada lado pelos totais de mortes do Registro de Guerra.' } }),
    stat({ label: 'Cidades capturadas ainda mantidas', value: heldCities, icon: 'city', tooltip: { title: 'Captura territorial', description: 'Cidades capturadas que permanecem em mãos inimigas agora; não há snapshots históricos por bloco.' },
      onClick: war.cities[0] ? () => host.openCity(war.cities[0].id) : undefined
    }),
    stat({ label: 'Maior desgaste de guerra', value: pct(highestWeariness), icon: 'politics', status: highestWeariness >= 60 ? 'warning' : 'neutral', tooltip: { title: 'Desgaste de guerra', description: 'Exaustão no nível do reino usada pelos sistemas de força de guerra e paz.' } }),
  ]);
}

export function buildOverview(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null): Child[] {
  const active = realmId
    ? snapshot.activeWars.filter(war => war.attacker.id === realmId || war.defender.id === realmId)
    : snapshot.activeWars;
  const forces = realmId ? snapshot.forces.filter(force => force.kingdom.id === realmId) : snapshot.forces;
  const conditions = warfareConditions(snapshot).filter(condition => !realmId || !condition.warId || active.some(war => war.record.id === condition.warId));
  const casualties = active.reduce((sum, war) => sum + war.battlefieldCasualties + war.civilianCasualties, 0);

  const content: Child[] = [
    statGrid([
      stat({ label: 'Guerras ativas', value: active.length, icon: 'war', status: active.length ? 'critical' : 'positive' }),
      stat({ label: 'Soldados vivos', value: forces.reduce((sum, force) => sum + force.soldiers, 0), icon: 'army', meta: 'Entidades reais' }),
      stat({ label: 'Cercos ativos', value: active.reduce((sum, war) => sum + war.sieges.length, 0), icon: 'siege', status: active.some(war => war.sieges.length) ? 'critical' : 'neutral' }),
      stat({ label: 'Mortes registradas', value: casualties, icon: 'swords', meta: 'Campo de batalha + baixas civis na Crônica' })
    ]),
    panel({ title: 'Atenção de comando', subtitle: 'No máximo cinco condições atuais e rastreáveis', icon: 'warning' }, [
      conditions.length ? rowList(conditions.map(condition => statRow({
        label: condition.title,
        value: condition.detail,
        status: condition.status,
        onClick: condition.warId ? () => host.openWar(condition.warId!)
          : condition.x !== undefined && condition.y !== undefined ? () => host.viewPointOnMap(condition.x!, condition.y!) : undefined
      }))) : emptyState({
        icon: 'shield', title: 'Nenhuma condição militar urgente',
        hint: active.length ? 'Os conflitos ativos atualmente não têm cerco, grande contato, exaustão severa ou interrupção rastreada.' : 'Nenhuma guerra ativa. A prontidão militar permanece visível abaixo.', compact: true
      })
    ]),
    panel({ title: active.length ? 'Teatros ativos' : 'Mundo em paz', icon: 'war' }, [
      active.length ? table({
        rows: active, rowKey: war => war.record.id, onRowClick: war => host.openWar(war.record.id), sortBy: 'start',
        columns: [
          { key: 'war', header: 'Conflito', cell: war => warLink(war, host), width: 'minmax(220px, 1.5fr)' },
          { key: 'state', header: 'Estado', cell: war => badge(warStateLabel(war), { status: war.sieges.length ? 'critical' : 'warning', size: 'sm' }) },
          { key: 'start', header: 'Início', align: 'right', cell: war => `Ano ${war.record.startYear}`, sortValue: war => war.record.startYear },
          { key: 'forces', header: 'Combatentes', align: 'right', cell: war => `${(war.attackerForce?.soldiers ?? 0) + (war.defenderForce?.soldiers ?? 0)}`, sortValue: war => (war.attackerForce?.soldiers ?? 0) + (war.defenderForce?.soldiers ?? 0) },
          { key: 'losses', header: 'Mortes', align: 'right', cell: war => `${war.battlefieldCasualties}`, sortValue: war => war.battlefieldCasualties }
        ]
      }) : emptyState({ icon: 'handshake', title: 'Nenhum conflito ativo', hint: 'Guerras passadas aparecem no Histórico; entidades militares presentes permanecem em Exércitos.', compact: true })
    ]),
    panel({ title: 'O que este centro de comando pode provar', icon: 'statistics', variant: 'sunken' }, [
      el('p', { class: 'ae-war-note', text: 'Registros de guerra são bilaterais. "Forças de campo" agrupam soldados e governantes vivos por reino; não são objetos de Exército persistentes. Combates ativos são agrupamentos de contato espacial, enquanto o contador de batalhas armazena eventos letais de combate. Mudança de território baseia-se em cidades capturadas ainda mantidas porque não existe snapshot por bloco no início da guerra.' })
    ])
  ];
  return content;
}

export function buildActiveWars(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null, query: string): Child[] {
  const q = query.trim().toLocaleLowerCase('en');
  const wars = snapshot.activeWars.filter(war =>
    (!realmId || war.attacker.id === realmId || war.defender.id === realmId) &&
    (!q || `${war.attacker.name} ${war.defender.name} ${war.record.reason}`.toLocaleLowerCase('en').includes(q))
  );
  return [panel({ title: 'Registros de guerras ativas', subtitle: 'Uma linha por Registro de Guerra bilateral', icon: 'war', padded: false }, [
    table({
      rows: wars, rowKey: war => war.record.id, onRowClick: war => host.openWar(war.record.id), sortBy: 'duration',
      columns: [
        { key: 'war', header: 'Beligerantes', cell: war => warLink(war, host), width: 'minmax(230px, 1.5fr)' },
        { key: 'reason', header: 'Motivo', cell: war => war.record.reason, width: 'minmax(180px, 1fr)' },
        { key: 'state', header: 'Estado atual', cell: war => badge(warStateLabel(war), { status: war.sieges.length ? 'critical' : 'warning', size: 'sm' }) },
        { key: 'duration', header: 'Anos', align: 'right', cell: war => `${war.duration}`, sortValue: war => war.duration },
        { key: 'battles', header: 'Eventos letais', align: 'right', cell: war => `${war.record.battles}`, sortValue: war => war.record.battles },
        { key: 'sieges', header: 'Cercos', align: 'right', cell: war => `${war.sieges.length}`, sortValue: war => war.sieges.length },
        { key: 'territory', header: 'Blocos líquidos (atacante)', align: 'right', cell: war => `${war.territory.netTilesForAttacker >= 0 ? '+' : ''}${war.territory.netTilesForAttacker}`, sortValue: war => war.territory.netTilesForAttacker }
      ],
      empty: emptyState({ icon: 'search', title: 'Nenhuma guerra ativa correspondente', hint: 'Altere o reino ou o filtro de pesquisa.' })
    })
  ])];
}

export function buildArmies(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null, query: string): Child[] {
  const q = query.trim().toLocaleLowerCase('en');
  const armies = (snapshot.armies ?? []).filter(army =>
    (!realmId || army.kingdomId === realmId) && (!q || army.name.toLocaleLowerCase('en').includes(q))
  );
  const mercenaries = (snapshot.mercenaries ?? []).filter(merc =>
    !realmId || merc.employerKingdomId === realmId || merc.employerKingdomId === null
  );
  const forces = snapshot.forces.filter(force =>
    (!realmId || force.kingdom.id === realmId) && (!q || `${force.kingdom.name} ${force.location} ${force.status}`.toLocaleLowerCase('en').includes(q))
  );

  return [
    panel({ title: 'Regimentos e Exércitos Formados', subtitle: 'Unidades militares organizadas sob comando de generais e objetivos estratégicos', icon: 'army', padded: false }, [
      table({
        rows: armies, rowKey: a => a.id, sortBy: 'soldiers',
        columns: [
          { key: 'name', header: 'Regimento', cell: a => {
            const kingdom = snapshot.realms.find(r => r.kingdom.id === a.kingdomId)?.kingdom;
            return el('div', {}, [
              el('strong', { text: a.name }),
              kingdom ? el('span', { style: `color:${kingdom.color};font-size:11px;margin-left:6px`, text: `(${kingdom.name})` }) : el('span', {})
            ]);
          }, width: 'minmax(200px, 1.4fr)' },
          { key: 'commander', header: 'Comandante / General', cell: a => {
            const cmd = snapshot.commanders?.find(c => c.id === a.commanderId);
            const trait = a.commanderTrait ? TRAIT_LABELS[a.commanderTrait] : 'Sem general';
            return el('div', {}, [
              el('span', { text: cmd?.name ?? (a.isMercenary ? 'Capitão Mercenário' : 'Oficial de Campo') }),
              el('div', { style: 'font-size:10px;color:#94a3b8', text: trait })
            ]);
          } },
          { key: 'composition', header: 'Composição Tática', cell: a => {
            const c = a.composition ?? { infantry: a.soldierIds.size, cavalry: 0, archers: 0, artillery: 0, militia: 0 };
            const parts: string[] = [];
            if (c.infantry) parts.push(`${c.infantry} Inf`);
            if (c.cavalry) parts.push(`${c.cavalry} Cav`);
            if (c.archers) parts.push(`${c.archers} Arq`);
            if (c.artillery) parts.push(`${c.artillery} Art`);
            if (c.militia) parts.push(`${c.militia} Mil`);
            return el('div', { style: 'font-size:11px;font-family:monospace', text: parts.join(' · ') || 'Sem tropas' });
          } },
          { key: 'state', header: 'Estado de Campanha', cell: a => badge(ARMY_STATE_LABEL[a.state] ?? a.state, { status: a.state === 'besieging' || a.state === 'marching' ? 'critical' : a.state === 'defending' ? 'warning' : 'neutral', size: 'sm' }) },
          { key: 'soldiers', header: 'Efetivo', align: 'right', cell: a => a.isMercenary ? `${a.mercenaryCompanyId ? snapshot.mercenaries.find(m => m.id === a.mercenaryCompanyId)?.size ?? 10 : 10} merc.` : `${a.soldierIds.size} soldados`, sortValue: a => a.soldierIds.size },
          { key: 'fatigue', header: 'Fadiga', align: 'right', cell: a => formatPercent(a.fatigue ?? 0), sortValue: a => a.fatigue ?? 0 },
          { key: 'morale', header: 'Moral', align: 'right', cell: a => formatPercent(a.morale), sortValue: a => a.morale },
          { key: 'experience', header: 'Experiência', align: 'right', cell: a => formatPercent(a.experience ?? 0.1), sortValue: a => a.experience ?? 0.1 }
        ],
        empty: emptyState({ icon: 'army', title: 'Nenhum regimento formado', hint: 'Os reinos formam regimentos a partir de quartéis quando convocam soldados para a guerra.' })
      })
    ]),

    mercenaries.length ? panel({ title: 'Companhias Mercenárias', subtitle: 'Bandos veteranos contratáveis com ouro do tesouro nacional', icon: 'swords', padded: false }, [
      table({
        rows: mercenaries, rowKey: m => m.id,
        columns: [
          { key: 'name', header: 'Companhia', cell: m => el('div', {}, [
            el('strong', { text: m.name }),
            el('div', { style: 'font-size:11px;color:#94a3b8', text: `${m.captainName} · ${TRAIT_LABELS[m.captainTrait]}` })
          ]), width: 'minmax(220px, 1.4fr)' },
          { key: 'size', header: 'Veteranos', align: 'right', cell: m => `${m.size} combatentes` },
          { key: 'cost', header: 'Custo de Contratação', align: 'right', cell: m => `${m.hiringCost} ouro` },
          { key: 'fee', header: 'Taxa Anual', align: 'right', cell: m => `${m.annualFee} ouro/ano` },
          { key: 'status', header: 'Situação', cell: m => {
            if (m.employerKingdomId) {
              const employer = snapshot.realms.find(r => r.kingdom.id === m.employerKingdomId)?.kingdom;
              return badge(`A serviço de ${employer?.name ?? 'Reino'}`, { color: employer?.color ?? '#f59e0b', size: 'sm' });
            }
            return badge('Disponível para contratação', { status: 'positive', size: 'sm' });
          } }
        ],
        empty: emptyState({ icon: 'swords', title: 'Nenhuma companhia mercenária no momento', hint: 'Companhias mercenárias viajam pelas terras e aparecem periodicamente.' })
      })
    ]) : null,

    panel({ title: 'Forças de Campo em Operação', subtitle: 'Soldados e combatentes vivos no terreno', icon: 'army', padded: false }, [
      table({
        rows: forces, rowKey: force => force.id, sortBy: 'strength', onRowClick: force => host.followForce(force),
        columns: [
          { key: 'realm', header: 'Reino', cell: force => realmLink(force.kingdom, host), width: 'minmax(180px, 1.2fr)' },
          { key: 'status', header: 'Estado atual', cell: force => badge(FORCE_STATUS_LABEL[force.status], { status: force.status === 'attacking' || force.status === 'sieging' ? 'critical' : 'neutral', size: 'sm' }) },
          { key: 'location', header: 'Posição média', cell: force => force.location, width: 'minmax(150px, 1fr)' },
          { key: 'objective', header: 'Objetivo atual', cell: force => force.objective?.cityName ?? 'Nenhum registrado' },
          { key: 'soldiers', header: 'Soldados', align: 'right', cell: force => `${force.soldiers}`, sortValue: force => force.soldiers },
          { key: 'strength', header: 'Força', align: 'right', cell: force => formatCompact(force.strength), sortValue: force => force.strength },
          { key: 'health', header: 'HP Médio', align: 'right', cell: force => formatPercent(force.meanHp), sortValue: force => force.meanHp }
        ],
        empty: emptyState({ icon: 'army', title: 'Nenhuma força militar nesta visualização', hint: 'Uma força aparece apenas quando existem entidades de soldado ou governante vivas.' })
      })
    ]),
    ...forces.map(force => panel({
      title: force.kingdom.name, subtitle: `${FORCE_STATUS_LABEL[force.status]} · ${force.location}`, icon: 'army', accent: force.kingdom.color,
      actions: [button('Centralizar e seguir', () => host.followForce(force), { icon: 'map', size: 'sm' })]
    }, [
      badgeRow([
        badge(`${force.soldiers} soldados`, { color: force.kingdom.color, size: 'sm' }),
        force.rulers ? badge(`${force.rulers} governante`, { status: 'neutral', size: 'sm' }) : null,
        force.objective ? badge(`Objetivo: ${force.objective.cityName}`, { status: 'warning', size: 'sm' }) : null
      ]),
      section('Composição', [rowList(force.categories.map(item => statRow({ label: item.category, value: item.count })))]),
      section('Equipamento em uso', [
        force.equipment.length ? rowList(force.equipment.map(item => statRow({
          label: item.name,
          value: `${item.count}${item.tier ? ` · ${item.tier}` : ''}`,
        }))) : emptyState({ icon: 'swords', title: 'Nenhum equipamento registrado', compact: true })
      ])
    ]))
  ];
}

function engagementPanel(engagement: EngagementView, war: WarView | undefined, host: WarfareScreenHost): HTMLElement {
  return panel({
    title: engagement.major ? 'Grande combate ativo' : 'Combate ativo',
    subtitle: `${engagement.location} · derivado de entidades em estado de ataque dentro de 9 blocos`, icon: 'battle',
    actions: [button('Ver no mapa', () => host.viewPointOnMap(engagement.x, engagement.y), { icon: 'map', size: 'sm' })]
  }, [
    badgeRow([
      badge('DERIVADO — NÃO É UM REGISTRO DE BATALHA', { status: 'neutral', variant: 'outline', size: 'sm' }),
      engagement.capitalInvolved ? badge('ÁREA DA CAPITAL', { status: 'critical', size: 'sm' }) : null
    ]),
    statGrid([
      stat({ label: war?.attacker.name ?? 'Lado atacante', value: engagement.attackerForces, unit: 'combatantes', status: 'critical' }),
      stat({ label: war?.defender.name ?? 'Lado defensor', value: engagement.defenderForces, unit: 'combatantes', status: 'neutral' })
    ]),
    war ? button('Abrir Dossiê de Guerra', () => host.openWar(war.record.id), { variant: 'primary', icon: 'war', size: 'sm' }) : null
  ]);
}

export function buildBattles(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null): Child[] {
  const engagements = snapshot.engagements.filter(item => !realmId || item.participantIds.includes(realmId));
  return [
    panel({ title: 'Limite de dados de batalha', icon: 'statistics', variant: 'sunken' }, [
      el('p', { class: 'ae-war-note', text: 'A simulação não persiste objetos de Batalha, nomes de batalha, resultados ou snapshots de início/fim. Os cartões abaixo são agrupamentos de contato atuais. Combate concluído está disponível apenas como contador de eventos letais de cada guerra e totais de mortes dos lados.' })
    ]),
    ...engagements.map(item => engagementPanel(item, snapshot.activeWars.find(war => war.record.id === item.warId), host))
  ];
}

export function buildMilitaryPower(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null, query: string): Child[] {
  const q = query.trim().toLocaleLowerCase('en');
  const rows = snapshot.realms.filter(item => (!realmId || item.kingdom.id === realmId) && (!q || item.kingdom.name.toLocaleLowerCase('en').includes(q)));
  return [panel({ title: 'Comparação de poder militar', subtitle: 'Poder é o modelo de reino; força de campo usa combatentes atuais e modificadores de guerra', icon: 'statistics', padded: false }, [
    table({
      rows, rowKey: item => item.kingdom.id, sortBy: 'strength', onRowClick: item => host.openRealm(item.kingdom.id),
      columns: [
        { key: 'realm', header: 'Reino', cell: item => realmLink(item.kingdom, host), width: 'minmax(180px, 1.3fr)' },
        { key: 'soldiers', header: 'Soldados', align: 'right', cell: item => `${item.soldiers}`, sortValue: item => item.soldiers },
        { key: 'strength', header: 'Força de campo', align: 'right', cell: item => formatCompact(item.strength), sortValue: item => item.strength },
        { key: 'power', header: 'Poder do reino', align: 'right', cell: item => formatCompact(item.militaryPower), sortValue: item => item.militaryPower },
        { key: 'doctrine', header: 'Doutrina Militar (WAR-V6)', cell: item => {
          const doc = item.doctrine;
          if (!doc) return el('span', { style: 'color:#94a3b8;font-size:11px', text: 'Doutrina Tradicional' });
          const typeName = DOCTRINE_TYPE_LABELS[doc.type] ?? doc.type;
          const tradCount = doc.traditions?.length ?? 0;
          return el('div', {}, [
            el('strong', { style: 'font-size:11px', text: doc.name || typeName }),
            el('div', { style: 'font-size:10px;color:#94a3b8', text: `${tradCount} tradição(ões) · XP ${Math.round(doc.experienceLevel * 100)}%` })
          ]);
        }, width: 'minmax(200px, 1.4fr)' },
        { key: 'weariness', header: 'Desgaste', align: 'right', cell: item => pct(item.warWeariness), sortValue: item => item.warWeariness },
        { key: 'equipment', header: 'Maior equipamento', cell: item => item.highestEquipment?.name ?? 'Nenhum registrado' }
      ],
      empty: emptyState({ icon: 'kingdom', title: 'Nenhum dado militar de reino', hint: 'Nenhum reino sobrevivente corresponde à visualização atual.' })
    })
  ])];
}

export function buildHistory(snapshot: WarfareUISnapshot, host: WarfareScreenHost, realmId: string | null, query: string): Child[] {
  const q = query.trim().toLocaleLowerCase('en');
  const rows = snapshot.history.filter(war =>
    (!realmId || war.attacker.id === realmId || war.defender.id === realmId) &&
    (!q || `${war.attacker.name} ${war.defender.name} ${war.record.reason}`.toLocaleLowerCase('en').includes(q))
  );
  return [panel({ title: 'Guerras bilaterais concluídas', subtitle: 'Histórico de Registro de Guerra persistido', icon: 'history', padded: false }, [
    table({
      rows, rowKey: war => war.record.id, sortBy: 'end', onRowClick: war => host.openWar(war.record.id),
      columns: [
        { key: 'war', header: 'Conflito', cell: war => warLink(war, host), width: 'minmax(220px, 1.5fr)' },
        { key: 'period', header: 'Período', cell: war => `${war.record.startYear}–${war.record.endYear ?? 'presente'}` },
        { key: 'end', header: 'Fim', align: 'right', cell: war => `${war.record.endYear ?? ''}`, sortValue: war => war.record.endYear ?? 0 },
        { key: 'settlement', header: 'Acordo', cell: war => war.record.settlement ? SETTLEMENT_LABEL[war.record.settlement] : 'Não registrado' },
        { key: 'victor', header: 'Vitorioso', cell: war => war.record.victor ? (war.record.victor === war.attacker.id ? war.attacker.name : war.defender.name) : 'Nenhum registrado' },
        { key: 'deaths', header: 'Mortes em batalha', align: 'right', cell: war => `${war.battlefieldCasualties}`, sortValue: war => war.battlefieldCasualties }
      ],
      empty: emptyState({ icon: 'history', title: 'Nenhum histórico de guerra correspondente', hint: 'Guerras concluídas aparecerão após a paz ser registrada.' })
    })
  ])];
}

function forceSide(force: ArmyForceView | null, realm: RealmRefView, host: WarfareScreenHost): HTMLElement {
  return section(realm.name, force ? [
    statGrid([
      stat({ label: 'Soldados vivos', value: force.soldiers, icon: 'army' }),
      stat({ label: 'Força de campo atual', value: formatCompact(force.strength), icon: 'swords' }),
      stat({ label: 'HP Médio', value: formatPercent(force.meanHp), icon: 'health' })
    ]),
    badgeRow(force.equipment.slice(0, 6).map(item => badge(`${item.name} ×${item.count}`, { color: realm.color, size: 'sm' }))),
    button('Centralizar e seguir força de campo', () => host.followForce(force), { icon: 'map', size: 'sm' })
  ] : [emptyState({
    icon: 'army', title: 'Nenhuma força de campo viva', hint: 'Nenhum soldado atual ou entidade de governante pertence a este lado.', compact: true
  })], { icon: 'army' });
}

export function buildWarDossier(war: WarView, host: WarfareScreenHost): Child[] {
  const affectedCities = war.cities;
  return [
    el('div', { class: 'ae-war-dossier-head' }, [
      el('div', { class: 'ae-war-dossier-title' }, [
        badge(war.conflictKind === 'rebellion' ? 'REBELLION / SECESSION' : 'BILATERAL WAR', { status: war.active ? 'critical' : 'neutral', variant: 'outline' }),
        el('div', { class: 'ae-war-belligerents' }, [realmLink(war.attacker, host), el('span', { text: 'VS' }), realmLink(war.defender, host)]),
        el('p', { text: war.record.reason })
      ]),
      el('div', { class: 'ae-war-dossier-actions' }, [
        button('Ver guerra no mapa', () => host.viewWarOnMap(war), { variant: 'primary', icon: 'map' }),
        button('Voltar ao comando', () => host.openWar(''), { icon: 'menu' })
      ])
    ]),
    warSummaryStats(war, host),
    panel({ title: 'Resumo estratégico', icon: 'war' }, [
      rowList([
        statRow({ label: 'Atacante', value: realmLink(war.attacker, host) }),
        statRow({ label: 'Defensor', value: realmLink(war.defender, host) }),
        statRow({
          label: 'Objetivo de Guerra',
          value: war.record.goal ? `${GOAL_LABEL[war.record.goal.kind] ?? war.record.goal.kind} (${Math.round((war.record.goal.progress ?? 0) * 100)}% concluído)` : 'Conquista Territorial'
        }),
        statRow({ label: 'Motivo da guerra', value: war.record.reason }),
        statRow({ label: 'Início', value: `Ano ${war.record.startYear}` }),
        statRow({ label: 'Eventos letais de combate', value: `${war.record.battles}`, tooltip: { title: 'Contador de batalhas armazenadas', description: 'O sistema de combate incrementa isto para um evento letal individual; não é uma Batalha nomeada persistida.' } }),
        statRow({ label: 'Acordo', value: war.record.settlement ? SETTLEMENT_LABEL[war.record.settlement] : 'Guerra permanece ativa' }),
        statRow({ label: 'Vitorioso', value: war.record.victor ? (war.record.victor === war.attacker.id ? war.attacker.name : war.defender.name) : 'Nenhum registrado' })
      ]),
      section('Dados dos participantes', [table({
        rows: [
          { realm: war.attacker, force: war.attackerForce, losses: war.attackerLosses, heldCities: war.territory.attackerHeldCities, heldTiles: war.territory.attackerHeldTiles, weariness: war.attacker.warWeariness },
          { realm: war.defender, force: war.defenderForce, losses: war.defenderLosses, heldCities: war.territory.defenderHeldCities, heldTiles: war.territory.defenderHeldTiles, weariness: war.defender.warWeariness }
        ],
        rowKey: row => row.realm.id,
        columns: [
          { key: 'realm', header: 'Lado', cell: row => realmLink(row.realm, host), width: 'minmax(180px, 1.2fr)' },
          { key: 'soldiers', header: 'Soldados', align: 'right', cell: row => `${row.force?.soldiers ?? 0}` },
          { key: 'strength', header: 'Força', align: 'right', cell: row => formatCompact(row.force?.strength ?? 0) },
          { key: 'losses', header: 'Perdas em batalha', align: 'right', cell: row => `${row.losses}` },
          { key: 'captures', header: 'Cidades inimigas mantidas', align: 'right', cell: row => `${row.heldCities}` },
          { key: 'territory', header: 'Território de cidade mantido', align: 'right', cell: row => `${row.heldTiles} blocos` },
          { key: 'weariness', header: 'Desgaste de guerra', align: 'right', cell: row => pct(row.weariness) }
        ]
      })]),
      (war.record.attackerAllies?.length || war.record.defenderAllies?.length) ? section('Coalizão e Alianças Automáticas', [
        war.record.attackerAllies?.length ? badgeRow([
          badge(`Aliados do Atacante:`, { size: 'sm', variant: 'outline' }),
          ...war.record.attackerAllies.map(id => objectLink({ kind: 'kingdom', id, name: id }, { onOpen: () => host.openRealm(id) }))
        ]) : null,
        war.record.defenderAllies?.length ? badgeRow([
          badge(`Aliados Defensores:`, { size: 'sm', variant: 'outline' }),
          ...war.record.defenderAllies.map(id => objectLink({ kind: 'kingdom', id, name: id }, { onOpen: () => host.openRealm(id) }))
        ]) : null
      ]) : null,
      war.allies.length ? section('Intervenções aliadas confirmadas', [badgeRow(war.allies.map(ally =>
        objectLink({ kind: 'war', id: ally.linkedWarId, name: ally.kingdom.name, accent: ally.kingdom.color, qualifier: `apoia ${ally.supporting}` }, { variant: 'chip', onOpen: () => host.openWar(ally.linkedWarId) })
      ))], { hint: 'Alianças defensivas e ofensivas ingressam na guerra em suporte estratégico.' }) : null
    ]),
    panel({ title: 'Território e cidades', subtitle: 'Delta de território é derivado de cidades capturadas ainda mantidas', icon: 'city' }, [
      statGrid([
        stat({ label: `Capturas mantidas por ${war.attacker.name}`, value: war.territory.attackerHeldCities, unit: 'cidades', meta: `${war.territory.attackerHeldTiles} blocos atuais de território de cidade` }),
        stat({ label: `Capturas mantidas por ${war.defender.name}`, value: war.territory.defenderHeldCities, unit: 'cidades', meta: `${war.territory.defenderHeldTiles} blocos atuais de território de cidade` }),
        stat({ label: 'Blocos líquidos para o atacante', value: war.territory.netTilesForAttacker, icon: 'map', meta: 'Não existe snapshot por bloco no início da guerra' })
      ]),
      affectedCities.length ? table({
        rows: affectedCities, rowKey: city => city.id, onRowClick: city => host.openCity(city.id), sortBy: 'status',
        columns: [
          { key: 'city', header: 'Cidade', cell: city => cityLink(city, host), width: 'minmax(180px, 1.2fr)' },
          { key: 'status', header: 'Estado de guerra', cell: city => badge(city.status.toUpperCase(), { status: statusForCity(city.status), size: 'sm' }), sortValue: city => ({ besieged: 4, threatened: 3, captured: 2, safe: 1 })[city.status] },
          { key: 'population', header: 'População', align: 'right', cell: city => formatCompact(city.population), sortValue: city => city.population },
          { key: 'prosperity', header: 'Prosperidade', align: 'right', cell: city => formatPercent(city.prosperity), sortValue: city => city.prosperity },
          { key: 'defence', header: 'Defesa', align: 'right', cell: city => `×${city.defenceMultiplier.toFixed(2)}`, sortValue: city => city.defenceMultiplier },
        ]
      }) : emptyState({ icon: 'city', title: 'Nenhuma cidade atualmente rastreada para esta guerra', hint: 'Cidades aparecem quando capturadas, sitiadas ou ameaçadas por combatentes hostis próximos.', compact: true })
    ]),
    panel({ title: 'Forças', subtitle: 'Forças de campo derivadas, não objetos de Exército persistentes', icon: 'army' }, [
      forceSide(war.attackerForce, war.attacker, host),
      forceSide(war.defenderForce, war.defender, host)
    ]),
    panel({ title: 'Cercos e combates ativos', icon: 'battle' }, [
      war.engagements.length ? el('div', { class: 'ae-war-engagements' }, war.engagements.map(item => engagementPanel(item, war, host))) : emptyState({
        icon: 'battle', title: 'Nenhum grupo de contato ativo', hint: 'A simulação armazena totais de eventos letais, não dossiês de Batalha concluídos.', compact: true
      }),
      war.sieges.length ? section('Cercos Ativos (WAR-V5)', war.sieges.map(siege => {
        const phaseLabel = siege.phase ? (SIEGE_PHASE_LABEL[siege.phase] ?? siege.phase) : 'Cerco Ativo';
        const breachesText = `${siege.wallBreaches ?? 0} brecha(s) · ${siege.gatesForced ?? 0} portão(ões) rompidos · ${siege.towersCaptured ?? 0} torre(s) tomadas · ${siege.siegeEngines ?? 0} artilh./máquinas`;
        const willingness = Math.round((siege.surrenderWillingness ?? 0) * 100);
        return el('div', { class: 'ae-war-siege' }, [
          el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' }, [
            objectLink({ kind: 'city', id: siege.cityId, name: siege.cityName, status: 'critical', qualifier: siege.isCapital ? 'capital' : undefined }, { onOpen: () => host.openCity(siege.cityId) }),
            badge(phaseLabel, { status: siege.phase === 'assault' ? 'critical' : siege.phase === 'starvation' ? 'warning' : 'neutral', size: 'sm' })
          ]),
          progressBar({ value: siege.progress, label: `Progresso do cerco · ${siege.years} ano(s) · Vontade de rendição: ${willingness}%`, status: 'critical' }),
          el('div', { style: 'font-size:11px;color:#94a3b8;margin-top:3px', text: breachesText }),
          button('Ver no mapa', () => host.viewPointOnMap(siege.x, siege.y), { icon: 'map', size: 'sm' })
        ]);
      })) : null
    ]),
    panel({ title: 'Linha do tempo da Crônica', subtitle: 'Apenas eventos com referência estruturada a este Registro de Guerra', icon: 'history', actions: [button('Abrir Crônica', () => host.openChronicle(), { icon: 'history', size: 'sm' })] }, [
      war.timeline.length ? el('div', { class: 'ae-war-timeline' }, war.timeline.map(event => el('div', { class: 'ae-war-timeline-event' }, [
        el('span', { class: 'ae-war-timeline-year', text: `${event.year}` }),
        el('div', {}, [el('strong', { text: event.title ?? event.type }), el('p', { text: event.text })]),
        badge(event.importance.toUpperCase(), { status: event.importance === 'legendary' || event.importance === 'major' ? 'warning' : 'neutral', size: 'sm' })
      ]))) : emptyState({ icon: 'history', title: 'Nenhum evento estruturado na Crônica para esta guerra', hint: 'O Registro de Guerra permanece oficial para início, resultado e totais de mortes.', compact: true })
    ])
  ];
}
