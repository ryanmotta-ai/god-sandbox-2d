# AETHORIA — CITY-V5 REPORT

## Resultado

CITY-V5 concluído. As cidades agora formam distritos funcionais a partir da concentração real de edifícios, acessibilidade, redes de transporte, economia, riqueza, ambiente e história urbana. O sistema orienta novas construções sem criar zonas rígidas nem substituir a economia existente.

## Distritos implementados

**PASS**

- 14 tipos: núcleo histórico, residencial comum, residencial rico, residencial operário/pobre, comercial, artesanal, cívico, religioso, industrial, ferroviário, portuário, militar, periferia e rural.
- A cidade é dividida em células funcionais compactas de 5×5 tiles. Elas descrevem evidências urbanas; não são zonas pintadas nem proibições absolutas.
- O tipo principal, tipo secundário, dominância, densidade, riqueza, poluição, acessibilidade e histórico de cada célula são persistidos no save.
- O núcleo histórico usa a idade real das construções, a origem registrada pelo CITY-V2 e a primeira linha de muralha preservada pelo CITY-V4.
- O urban planner usa os distritos como preferência suave: continuidade urbana e terreno continuam válidos, mas indústria, comércio, habitação, serviços e logística passam a procurar localizações coerentes.

## Land value / desirability

**PASS**

- Valor da terra e atratividade são calculados com base em centro, comércio, estradas, tráfego, ferrovia, portos, serviços, beleza natural/costa e densidade.
- Poluição industrial, dano, ameaça, guerra, distância e infraestrutura ruim reduzem a atratividade.
- Acessibilidade combina estrada, tráfego, ferrovia, porto, ligação ao centro e distância.
- Os valores são locais e incrementais; não existe recomputação integral da cidade por frame.

## Integração econômica

**PASS**

- Produção, estoque, comércio, exportação/importação e edifícios existentes alimentam a leitura funcional da cidade.
- Agricultura, extração, oficinas, fábricas e refino surgem pela economia já existente. CITY-V5 influencia onde eles se concentram, sem inventar produção visual falsa.
- A localização de residências considera emprego, poluição, acesso, valor da terra e riqueza.
- Não foi criado um novo sistema econômico.

## Ferrovia e porto

**PASS**

- Trilhos e concentração ferroviária geram distritos ferroviários e podem formar um segundo polo urbano.
- Fábricas, refinarias, mercados e bancos recebem preferência funcional por acesso ferroviário quando apropriado.
- Costa, porto, harbor, comércio e logística formam distritos portuários com armazéns como marcos visuais.
- Estação, depósito ferroviário, porto e armazém usam assets existentes do ART-V1 integrados ao atlas paginado/WebGPU.

## Riqueza e estratificação

**PASS**

- Bairros ricos emergem em áreas de alto valor, boa atratividade, serviços e baixa poluição.
- Bairros operários emergem perto de emprego industrial/logístico, transporte e habitação compacta.
- Bairros comuns ocupam o intervalo entre esses extremos; periferia e rural aparecem nas bordas de baixa densidade.
- O renderer escolhe variações residenciais coerentes com o contexto histórico salvo da construção, permitindo casas antigas coexistirem com expansões posteriores.

## Especialização urbana

**PASS**

- Perfis possíveis: mista, agrícola, mineradora, industrial, portuária, comercial, administrativa/capital, entroncamento ferroviário e militar.
- A especialização é inferida de edifícios, redes e ledger econômico. Ela não é escolhida aleatoriamente.
- O perfil pode mudar gradualmente quando a base produtiva e a infraestrutura mudam.

## Transformação histórica

**PASS**

- Uma célula só troca de função após evidência dominante e um intervalo histórico mínimo, evitando transformação instantânea da cidade inteira.
- O histórico compacto registra tipo anterior e ano da mudança.
- Prédios antigos mantêm seu contexto visual; novas construções e reformas adotam o contexto atual aos poucos.
- Muralhas antigas, crescimento extramuros e ArchitecturalProfile continuam respeitados.

## Performance e persistência

**PASS**

- Índice local por células e cache em memória evitam scans globais contínuos.
- Construções e mudanças de road/rail invalidam somente células locais e vizinhas relevantes.
- Regiões ACTIVE, WARM e SLEEPING têm cadências e orçamentos progressivamente menores.
- Uma cidade estável no mesmo período retornou **0** trabalho distrital repetido no smoke test.
- Alterações visuais invalidam apenas tiles/chunks afetados; chunks estáticos WebGPU permanecem cacheados.
- Distritos e especialização sobrevivem a save/load; caches derivados não são serializados.

## Assets

- Nenhum sprite novo foi necessário: o catálogo existente já cobre estação, depósito ferroviário, porto, armazém, mercado, indústria, casas ricas/comuns/pobres e props funcionais.
- Props são usados como marcos funcionais, não espalhados aleatoriamente em todo o distrito.
- O cache visual inclui contexto distrital e versão urbana, mantendo compatibilidade com atlas paging.

## Testes

- `npm run build`: **PASS** — 299 módulos, build de produção concluído.
- Regressão CITY-V4: **PASS** — muralhas, portões, torres, expansão extramuros, segunda muralha e save/load preservados.
- Smoke CITY-V5 dirigido: **PASS**.
  - cidade agrícola: 23 células, especialização agrícola;
  - cidade industrial/ferroviária: 28 células, com distritos industriais, ferroviários e operários;
  - cidade portuária: 16 células, especialização portuária;
  - cidade rica/capital: núcleo histórico, comércio e residencial rico;
  - transformação histórica validada: núcleo/artesanal → industrial;
  - save/load: PASS.
- Smoke visual WebGPU: **PASS** — mundo abriu, canvas WebGPU 1280×720 ativo, terreno/assets/UI/minimapa visíveis e câmera operacional.
- Aviso restante do build: bundle principal acima de 500 kB; não bloqueia CITY-V5.

## Arquivos alterados

- `src/civ/UrbanDistricts.ts`
- `src/civ/City.ts`
- `src/civ/Building.ts`
- `src/civ/CivilizationEngine.ts`
- `src/civ/UrbanPlanner.ts`
- `src/renderer/CityVisualResolver.ts`
- `tests/city-v5.smoke.ts`
- `CITY_V5_REPORT.md`

## Limitações

- Riqueza é modelada por área e função urbana, não por patrimônio individual de cada família.
- Estações e armazéns funcionam como marcos visuais/logísticos sobre tipos econômicos existentes; CITY-V5 não cria novos prédios de gameplay.
- Células de 5×5 produzem limites funcionais aproximados, não fronteiras orgânicas desenhadas tile a tile.
- A decadência profunda, reconstrução pós-guerra e mobilidade social individual permanecem fora do escopo.
- A família visual cultural continua limitada às variações já presentes no ART-V1/CITY-V3.
