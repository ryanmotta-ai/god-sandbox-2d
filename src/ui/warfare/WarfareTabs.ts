import { el, type Child } from '../core/Dom';
import {
  badge, badgeRow, button, emptyState, formatCompact, formatPercent, objectLink,
  panel, progressBar, rowList, section, stat, statGrid, statRow, table
} from '../kit';
import { GOODS, type GoodId } from '../../civ/Goods';
import { warfareConditions, warCausalChains } from './WarfareDiagnostics';
import {
  FORCE_STATUS_LABEL, SETTLEMENT_LABEL, warStateLabel,
  type ArmyForceView, type EngagementView, type RealmRefView,
  type WarfareUISnapshot, type WarView
} from './WarfareMetrics';

export interface WarfareScreenHost {
  openWar(warId: string): void;
  openRealm(kingdomId: string): void;
  openCity(cityId: string): void;
  openGood(good: GoodId): void;
  openInfrastructure(params?: { routeId?: string; cityId?: string; tab?: string }): void;
  openPolitics(kingdomId: string): void;
  openTechnology(kingdomId: string, techId?: string | null): void;
  openChronicle(): void;
  viewWarOnMap(war: WarView): void;
  viewPointOnMap(x: number, y: number): void;
  followForce(force: ArmyForceView): void;
}

const pct = (value: number): string => `${Math.round(value)}%`;
const statusForCity = (status: string) => status === 'besieged' ? 'critical' : status === 'threatened' ? 'warning' : status === 'captured' ? 'neutral' : 'positive';

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
  const highestWeariness = Math.max(...war.politics.map(side => side.warWeariness), 0);
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
    stat({ label: 'Capacidade comercial suspensa', value: formatCompact(war.economy.suspendedVolume), icon: 'trade-route', meta: `${war.economy.closedRoutes.length} rota(s) exata(s) fechada(s) pela guerra` })
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
  const forces = snapshot.forces.filter(force =>
    (!realmId || force.kingdom.id === realmId) && (!q || `${force.kingdom.name} ${force.location} ${force.status}`.toLocaleLowerCase('en').includes(q))
  );
  return [
    panel({ title: 'Forças de campo derivadas', subtitle: 'Combatentes vivos reais agrupados por reino; não existe objeto de Exército', icon: 'army', padded: false }, [
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
          onClick: item.techId ? () => host.openTechnology(force.kingdom.id, item.techId) : undefined
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
  const chains = warCausalChains(war);
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
        statRow({ label: 'Motivo da guerra', value: war.record.reason }),
        statRow({ label: 'Início', value: `Ano ${war.record.startYear}` }),
        statRow({ label: 'Eventos letais de combate', value: `${war.record.battles}`, tooltip: { title: 'Contador de batalhas armazenadas', description: 'O sistema de combate incrementa isto para um evento letal individual; não é uma Batalha nomeada persistida.' } }),
        statRow({ label: 'Acordo', value: war.record.settlement ? SETTLEMENT_LABEL[war.record.settlement] : 'Guerra permanece ativa' }),
        statRow({ label: 'Vitorioso', value: war.record.victor ? (war.record.victor === war.attacker.id ? war.attacker.name : war.defender.name) : 'Nenhum registrado' })
      ]),
      section('Dados dos participantes', [table({
        rows: [
          { realm: war.attacker, force: war.attackerForce, losses: war.attackerLosses, heldCities: war.territory.attackerHeldCities, heldTiles: war.territory.attackerHeldTiles, weariness: war.politics.find(side => side.kingdom.id === war.attacker.id)?.warWeariness ?? 0 },
          { realm: war.defender, force: war.defenderForce, losses: war.defenderLosses, heldCities: war.territory.defenderHeldCities, heldTiles: war.territory.defenderHeldTiles, weariness: war.politics.find(side => side.kingdom.id === war.defender.id)?.warWeariness ?? 0 }
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
      war.allies.length ? section('Intervenções aliadas confirmadas', [badgeRow(war.allies.map(ally =>
        objectLink({ kind: 'war', id: ally.linkedWarId, name: ally.kingdom.name, accent: ally.kingdom.color, qualifier: `apoia ${ally.supporting}` }, { variant: 'chip', onOpen: () => host.openWar(ally.linkedWarId) })
      ))], { hint: 'Cada aliado tem seu próprio Registro de Guerra bilateral; alianças não entram automaticamente.' }) : null
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
          { key: 'relevance', header: 'Relevância econômica', cell: city => city.economicRelevance.join(' · ') || 'Nenhum fato logístico rastreado' }
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
      war.sieges.length ? section('Cercos', war.sieges.map(siege => el('div', { class: 'ae-war-siege' }, [
        objectLink({ kind: 'city', id: siege.cityId, name: siege.cityName, status: 'critical', qualifier: siege.isCapital ? 'capital' : undefined }, { onOpen: () => host.openCity(siege.cityId) }),
        progressBar({ value: siege.progress, label: `Progresso do cerco · ${siege.years} ano(s)`, status: 'critical' }),
        button('Ver no mapa', () => host.viewPointOnMap(siege.x, siege.y), { icon: 'map', size: 'sm' })
      ]))) : null
    ]),
    panel({ title: 'Impacto econômico', subtitle: 'Fluxos de participantes atuais e rotas exatas fechadas pela guerra', icon: 'trade-route' }, [
      chains.length ? section('Cadeias causais', chains.map(chain => el('div', { class: `ae-war-chain ae-war-chain-${chain.status}` }, [
        el('strong', { text: chain.cause }), el('span', { text: '→' }), el('span', { text: chain.mechanism }), el('span', { text: '→' }), el('span', { text: chain.consequence })
      ]))) : emptyState({ icon: 'trade-route', title: 'Nenhuma consequência econômica rastreada', hint: 'O volume histórico de comércio perdido não é reconstruído após as rotas serem excluídas.', compact: true }),
      war.economy.closedRoutes.length ? section('Rotas fechadas pela guerra', [rowList(war.economy.closedRoutes.map(route => statRow({
        label: `${route.fromCity?.name ?? route.route.fromCityId} → ${route.toCity?.name ?? route.route.toCityId}`,
        value: `${route.goodName} · volume ${route.route.volume.toFixed(1)}`,
        status: 'warning', onClick: () => host.openInfrastructure({ routeId: route.route.id, tab: 'corridors' })
      })))]) : null,
      ...[war.attacker, war.defender].map(realm => section(`Bens estratégicos de ${realm.name}`, [
        rowList((war.economy.strategicGoods.get(realm.id) ?? []).map(good => statRow({
          label: good.name,
          value: `estoque ${good.stock.toFixed(1)} · líquido ${good.net >= 0 ? '+' : ''}${good.net.toFixed(1)}${good.importDependency === null ? '' : ` · ${formatPercent(good.importDependency)} dependência de importação`}`,
          status: good.net < 0 ? 'warning' : undefined,
          onClick: () => host.openGood(good.good)
        })))
      ]))
    ]),
    panel({ title: 'Impacto na infraestrutura', subtitle: 'Problemas atuais nas redes dos participantes; apenas rotas explicitamente fechadas provam causalidade da guerra', icon: 'trade-route' }, [
      war.infrastructure.damagedRailLines.length ? section('Ferrovia danificada', [rowList(war.infrastructure.damagedRailLines.map(line => statRow({
        label: line.id, value: `${line.damagedTiles} bloco(s) danificado(s)`, status: 'warning',
        onClick: () => host.viewPointOnMap(line.at.x, line.at.y)
      })))]) : null,
      war.infrastructure.disruptedPorts.length ? section('Portos inoperantes', [rowList(war.infrastructure.disruptedPorts.map(port => statRow({
        label: port.cityName, value: `${formatPercent(port.condition)} condição`, status: 'critical', onClick: () => host.openInfrastructure({ cityId: port.cityId, tab: 'ports' })
      })))]) : null,
      war.infrastructure.bottlenecks.length ? section('Gargalos de participantes', [rowList(war.infrastructure.bottlenecks.slice(0, 8).map(item => statRow({
        label: item.location, value: item.problem, status: item.severity, onClick: item.at ? () => host.viewPointOnMap(item.at!.x, item.at!.y) : undefined
      })))]) : emptyState({ icon: 'shield', title: 'Nenhum gargalo atual de participante', compact: true })
    ]),
    panel({ title: 'Impacto político', icon: 'politics' }, war.politics.map(side => section(side.kingdom.name, [
      statGrid([
        stat({ label: 'Desgaste de guerra', value: pct(side.warWeariness), status: side.warWeariness >= 60 ? 'warning' : 'neutral', onClick: () => host.openPolitics(side.kingdom.id) }),
        stat({ label: 'Legitimidade', value: formatPercent(side.legitimacy), onClick: () => host.openPolitics(side.kingdom.id) }),
        stat({ label: 'Estabilidade', value: formatPercent(side.stability), onClick: () => host.openPolitics(side.kingdom.id) }),
        stat({ label: 'Pressão por paz', value: formatPercent(side.peacePressure), status: side.peacePressure > side.warPressure ? 'warning' : 'neutral' })
      ]),
      rowList([
        statRow({ label: 'Pressão por guerra', value: formatPercent(side.warPressure), onClick: () => host.openPolitics(side.kingdom.id) }),
        statRow({ label: 'Pressão por reforma', value: formatPercent(side.reformPressure), status: side.reformPressure >= 0.5 ? 'warning' : undefined, onClick: () => host.openPolitics(side.kingdom.id) }),
        statRow({ label: 'Risco de revolta', value: formatPercent(side.revoltRisk), status: side.revoltRisk >= 0.45 ? 'critical' : undefined, onClick: () => host.openPolitics(side.kingdom.id) }),
        statRow({ label: 'Risco de golpe', value: formatPercent(side.coupRisk), status: side.coupRisk >= 0.45 ? 'critical' : undefined, onClick: () => host.openPolitics(side.kingdom.id) })
      ]),
      side.factions.length ? rowList(side.factions.map(faction => statRow({
        label: faction.name, value: `Influência ${formatPercent(faction.influence)} · apoio à guerra ${formatPercent(faction.warSupport)}`, onClick: () => host.openPolitics(side.kingdom.id)
      }))) : null
    ], { actions: [button('Abrir Política', () => host.openPolitics(side.kingdom.id), { icon: 'politics', size: 'sm' })] }))),
    panel({ title: 'Linha do tempo da Crônica', subtitle: 'Apenas eventos com referência estruturada a este Registro de Guerra', icon: 'history', actions: [button('Abrir Crônica', () => host.openChronicle(), { icon: 'history', size: 'sm' })] }, [
      war.timeline.length ? el('div', { class: 'ae-war-timeline' }, war.timeline.map(event => el('div', { class: 'ae-war-timeline-event' }, [
        el('span', { class: 'ae-war-timeline-year', text: `${event.year}` }),
        el('div', {}, [el('strong', { text: event.title ?? event.type }), el('p', { text: event.text })]),
        badge(event.importance.toUpperCase(), { status: event.importance === 'legendary' || event.importance === 'major' ? 'warning' : 'neutral', size: 'sm' })
      ]))) : emptyState({ icon: 'history', title: 'Nenhum evento estruturado na Crônica para esta guerra', hint: 'O Registro de Guerra permanece oficial para início, resultado e totais de mortes.', compact: true })
    ])
  ];
}
