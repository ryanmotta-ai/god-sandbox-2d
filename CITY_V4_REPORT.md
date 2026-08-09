# AETHORIA — CITY-V4

## Geração das muralhas — PASS

- A cidade avalia fortificação em cadência trienal, nunca por frame.
- A decisão combina população, prosperidade, materiais, capital/importância política, ameaça externa, guerras, costa/relevo e tecnologia de alvenaria.
- Vilas pequenas e sem pressão permanecem sem muralha.
- O traçado nasce do casco urbano real: convex hull expandido, margens irregulares determinísticas e adaptação local a terreno, água, montanhas, prédios e ferrovia.
- Água e relevo intransponível podem completar naturalmente uma seção defensiva.
- Cada linha é persistida com ano, geração, família visual, material, perímetro, contorno e peças físicas.
- Peças são prédios estáticos residentes nos chunks WebGPU. Uma obra altera somente os tiles/chunks do traçado e os caches de caminho desses chunks.

## Portões — PASS

- Portões priorizam cruzamentos com estradas existentes e, como fallback, os eixos históricos da malha urbana.
- Cada linha recebe de 2 a 4 portões espaçados, sem distribuição aleatória por frame.
- A aproximação do portão completa uma pequena ligação viária interna/externa.
- Pathfinding terrestre e de estradas bloqueia segmentos/torres, mas atravessa portões.
- Movimento diagonal não pode escapar pela fresta entre dois segmentos.
- Portões têm HP menor que torres e funcionam como pontos vulneráveis.

## Torres — PASS

- Torres aparecem em mudanças de direção e intervalos do perímetro.
- Perfis `martial` e culturas militaristas usam espaçamento mais denso.
- Torres têm HP superior ao segmento comum e asset dedicado do ART-V1.

## Crescimento extramuros — PASS

- O UrbanPlanner mede a pressão dentro da linha ativa sem incluir segmentos como lotes/distritos.
- Enquanto há capacidade, novos lotes preferem o interior protegido.
- Com ocupação alta, a preferência muda gradualmente para lotes contínuos fora da muralha.
- Muralhas não consomem building slots; portanto a cidade nunca para de crescer por causa do número de segmentos.
- Smoke dirigido: 24 construções extramuros geraram pressão suficiente para uma segunda linha maior.

## Evolução histórica — PASS

- Linhas defensivas são versionadas e salvas em `City.fortificationLines`.
- Ao surgir uma nova linha, a anterior passa a `historic`, permanece fisicamente no mapa e pode ser engolida pela cidade.
- Até três linhas históricas são suportadas sem apagar o núcleo anterior.
- Na era moderna, uma linha sem guerra por longo período perde o papel militar, mas suas peças continuam como vestígio urbano.
- Save/load preserva linhas, papéis de segmento/torre/portão, HP especial e identidade arquitetônica.

## Integração defensiva — PASS

- Linhas ativas aumentam a defesa usada pelo sistema de cerco existente.
- Integridade/HP, torres, portões e status histórico entram em um bônus limitado; dezenas de segmentos não multiplicam a defesa exponencialmente.
- Linhas históricas mantêm contribuição residual pequena.
- Destruir uma peça abre passagem, invalida apenas o chunk local e atualiza sua representação.
- CITY-V4 não adiciona máquinas nem um sistema completo de cerco.

## Integração com ArchitecturalProfile — PASS

- A linha grava `fortificationFamily`, material, era e stamp arquitetônico do momento da construção.
- Segmentos, cantos, torres e portões resolvem os assets reais `city.walls.*`, `city.military.watchtower.*` e `city.military.gatehouse.*` pelo atlas paginado.
- Material/tint, escala, densidade de torres e influência colonial/metropolitana vêm do perfil já misturado pelo CITY-V3.
- Conquista posterior não reescreve visualmente muralhas antigas.

## Validação

- `npm run build`: PASS.
- Smoke WebGPU: mundo abriu, câmera/UI e simulação avançaram sem falha visível.
- `tests/city-v4.smoke.ts`: vila sem muralha, primeira linha, portões, torres, travessia, subúrbio extramuros, segunda linha, preservação histórica, defesa e save/load — PASS.
- Cena dirigida: 2 portões, 9 torres, 24 prédios extramuros e segunda muralha maior.

## Arquivos alterados

- `src/civ/FortificationPlanner.ts`
- `src/civ/Building.ts`
- `src/civ/City.ts`
- `src/civ/CivilizationEngine.ts`
- `src/civ/UrbanPlanner.ts`
- `src/ai/Pathfinding.ts`
- `src/ai/EntityAI.ts`
- `src/renderer/CityVisualResolver.ts`
- `tests/city-v4.smoke.ts`
- `CITY_V4_REPORT.md`

## Limitações

- Os assets atuais oferecem uma família comum de muralha/torre/portão; culturas já variam material, cor, escala e densidade, mas precisarão de sprites culturais próprios para silhuetas realmente distintas.
- A obsolescência moderna preserva a muralha inteira; demolição seletiva para avenidas, parques lineares e portões monumentais fica para uma fase urbana futura.
- Rios e costa atuam como barreiras naturais no traçado, mas ainda não existem obras especializadas de cais fortificado ou corrente portuária.
- A defesa é estratégica e agregada; combate em segmento, controle militar individual de portão e cerco detalhado pertencem ao futuro WAR-V.
