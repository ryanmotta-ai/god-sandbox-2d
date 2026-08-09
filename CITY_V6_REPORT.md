# AETHORIA — CITY-V6 REPORT

## Resultado

CITY-V6 concluído. Construções agora possuem um ciclo de vida físico e persistente: construção, normal, danificada, abandonada, ruína e reconstrução. As transições usam eventos e verificações periódicas por região; não existe atualização por frame nem scan global contínuo.

## Construção

**PASS**

- Novos prédios começam como obra e não produzem, oferecem empregos ou habitação antes de terminarem.
- A progressão usa etapas visuais simples: lote/fundação com rubble existente, volume parcial em construção e prédio completo.
- O avanço acontece no ciclo urbano periódico e considera a prosperidade da cidade.
- Obras atingidas por fogo ou desastre perdem progresso; não se tornam prédios funcionais por causa do dano.
- Construções especiais preexistentes instaladas diretamente por sistemas antigos, como circuitos completos de muralha, mantêm o comportamento anterior.

## Dano

**PASS**

- HP e estado físico agora são sincronizados: danos leves/graves produzem estado danificado e danos críticos produzem ruína.
- Edifícios danificados operam com capacidade reduzida proporcional à integridade.
- Guerra usa o mesmo estado persistente para ataques estratégicos e tomada de cidade.
- Mudanças invalidam somente o tile/chunk do prédio e as células distritais vizinhas.

## Abandono

**PASS**

- Abandono não é aleatório: resulta de despovoamento, baixa prosperidade, fome, falta de trabalhadores, excesso de moradia, isolamento, baixa atratividade, dano, ameaça e cerco.
- Prédios abandonados deixam de produzir, empregar, armazenar e abrigar.
- Moradores e trabalhadores são liberados somente quando a transição ocorre, usando o índice local de entidades da cidade.
- Prédios abandonados deixam de consumir slots de expansão, mas continuam ocupando fisicamente seus lotes.

## Ruínas

**PASS**

- Ruínas permanecem no mapa com o mesmo ID e footprint; não são apagadas quando o dano acontece.
- Casas queimadas, casas arruinadas, keeps, muralhas e monumentos usam assets específicos existentes.
- Outros tipos usam rubble genérico como fallback seguro.
- Ruínas comuns podem ser demolidas somente depois de décadas de crise contínua; landmarks e fortificações são preservados como vestígios históricos.
- Abandono prolongado pode evoluir gradualmente para ruína.

## Incêndios

**PASS**

- O sistema global de fogo não foi reescrito.
- Cada tick de fogo registra apenas o `cityId/buildingId` realmente atingido em um buffer compacto.
- CITY-V6 drena esse buffer uma vez por ano e aplica exposição acumulada somente aos prédios nomeados.
- Um incêndio completo pode destruir uma construção; fogo interrompido deixa dano proporcional.
- Grandes incêndios entram no Chronicle como evento agregado da cidade, nunca como um evento por prédio.

## Reconstrução

**PASS**

- Reconstrução depende de população recuperada, prosperidade, segurança, demanda local, acessibilidade e materiais reais.
- Uma cidade ainda em crise não reconstrói automaticamente.
- O projeto consome uma fração do custo original e avança gradualmente.
- Falta de um material específico pode manter certas ruínas enquanto outras áreas se recuperam.
- Ao terminar, o prédio recupera função, recebe novo contexto distrital e arquitetura da era atual.

## Transformação histórica

**PASS**

- Cada prédio guarda até oito transições compactas com estado anterior, novo estado, ano e causa.
- `builtYear`, fase/origem do CITY-V2 e arquitetura antiga permanecem preservados durante dano e abandono.
- Reconstrução registra renovação e aplica o ArchitecturalProfile contemporâneo, criando camadas visuais novas entre prédios sobreviventes antigos.
- Grandes incêndios, destruição, abandono, reconstrução e recuperação são registrados no Chronicle apenas quando atingem relevância urbana.

## Integração CITY-V2/V3/V4/V5

**PASS**

- **CITY-V2:** origem, geração, fase visual e histórico continuam persistentes; reconstrução acrescenta uma nova camada temporal.
- **CITY-V3:** reconstruções recebem material, tradição, era, escala, paleta e riqueza do ArchitecturalProfile atual.
- **CITY-V4:** muralhas, torres e portões podem sofrer dano, virar ruína e ser reparados/reconstruídos; linhas históricas não desaparecem automaticamente.
- **CITY-V5:** prédios abandonados/arruinados perdem peso funcional na leitura de distrito; células locais são invalidadas e podem decair ou se revitalizar gradualmente.
- Especializações industrial, ferroviária e portuária respondem à perda ou retorno de atividade real, não a decoração falsa.

## Natureza retomando áreas

**PASS (integração leve)**

- Abandono prolongado acumula `natureReclaim` e adiciona vegetação existente como detalhe visual em bandas discretas.
- Após demolição tardia, o footprint e o `cityId` do lote são liberados, permitindo que a ecologia existente volte a considerar o tile natural.
- Nenhuma nova simulação ecológica foi criada.

## Performance

**PASS**

- ACTIVE: atualização anual com orçamento de até 36 prédios por cidade.
- WARM: atualização a cada 3 anos, até 14 prédios.
- SLEEPING: atualização a cada 8 anos, até 5 prédios.
- Construções, ruínas, abandono e reconstruções têm prioridade rotativa sem impedir a amostragem de prédios normais.
- Fogo/desastres usam eventos por ID; não procuram prédios por scan mundial.
- Repetir o processamento no mesmo ano retornou **0** inspeções.
- Caches WebGPU de chunks estáticos permanecem residentes; somente chunks com mudança física são invalidados.

## Persistência

**PASS**

- Estado, progresso, idade do estado, abandono, retomada natural, última causa de dano e histórico de transições são salvos.
- Pico populacional, duração da crise e marcadores agregados do Chronicle urbano são salvos.
- Saves antigos inferem `normal`, `damaged` ou `ruin` a partir do HP e continuam compatíveis.
- Caches e cursores derivados não são serializados.

## Assets faltantes

O sistema está funcional com o ART-V1 atual. Não foram gerados sprites novos nesta fase.

Assets desejáveis para melhorar a paridade futura, sem bloquear CITY-V6:

- fundação de madeira/pedra separada de rubble;
- andaime/scaffolding por escala;
- estados abandonado e queimado para fábrica, mercado, porto, templo e prédio cívico;
- ruínas específicas de madeira, tijolo, pedra e indústria;
- vegetação espontânea própria para lotes abandonados;
- muralha/portão/tower em reconstrução.

## Testes

- `npm run build`: **PASS** — 300 módulos.
- CITY-V1: **PASS**.
- CITY-V2: **PASS**.
- CITY-V4: **PASS** — muralhas e expansão histórica preservadas.
- CITY-V5: **PASS** — distritos, especializações e save/load preservados.
- CITY-V6 smoke: **PASS** — construção, incêndio em três lotes específicos, ruínas, abandono causado, recuperação gradual, restamp arquitetônico e save/load.
- Infraestrutura: **PASS**.
- Simulação de 40 anos, comércio, cerco, conquista, reparo e save/load: **PASS**.
- Smoke visual WebGPU: **PASS** — mundo abriu em canvas WebGPU 1934×920, UI/minimapa/câmera ativos e nenhum erro no console.

## Arquivos alterados

- `src/civ/Building.ts`
- `src/civ/City.ts`
- `src/civ/CivilizationEngine.ts`
- `src/civ/Infrastructure.ts`
- `src/civ/UrbanDistricts.ts`
- `src/civ/UrbanLifecycle.ts`
- `src/civ/Warfare.ts`
- `src/world/TileMap.ts`
- `src/powers/Disasters.ts`
- `src/ai/EntityAI.ts`
- `src/renderer/CityVisualResolver.ts`
- `tests/city-v6.smoke.ts`
- `tests/sim.smoke.ts`
- `tests/journey.smoke.ts`
- `CITY_V6_REPORT.md`

## Limitações

- Não há sprites específicos de construção/abandono para todas as famílias; o fallback atual prioriza consistência e legibilidade.
- A riqueza e demanda de reconstrução permanecem agregadas por cidade/distrito, não por proprietário individual.
- Demolição não possui equipe animada ou decisão política dedicada.
- Incêndio usa a propagação global existente; CITY-V6 apenas integra consequências urbanas.
- Muralhas recebem dano e recuperação física, mas cercos completos continuam fora do escopo.
- O warning existente do bundle principal acima de 500 kB permanece; não bloqueia o renderer nem CITY-V6.
