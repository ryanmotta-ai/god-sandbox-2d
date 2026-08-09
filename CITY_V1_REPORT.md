# AETHORIA — CITY-V1 REPORT

## Sistema urbano implementado

- Crescimento urbano dirigido por uma estrutura derivada de ruas, lotes e quarteirões.
- Estágios visuais `camp`, `village`, `city` e `great_city`, derivados dos tiers existentes sem mudar economia ou progressão.
- Dois eixos históricos formam as ruas principais; uma malha secundária escalonada aparece conforme a cidade cresce.
- Novas construções preservam corredores planejados, preferem frente de rua, continuidade do tecido e posição adequada à função.
- Usos residenciais, comerciais, cívicos, produtivos, agrícolas, logísticos e de extração possuem afinidades e repulsões próprias.
- Costa, terreno não caminhável, recursos estratégicos, estradas existentes e ferrovia são respeitados.
- Indústria/logística prefere acesso ferroviário; residências e edifícios cívicos evitam a faixa imediata dos trilhos.
- O planejamento reserva espaço visual de acordo com a classe do sprite, reduzindo sobreposição sem alterar o formato lógico/save dos prédios.
- A construção conecta sua fachada à rua realizada mais próxima. A primeira extensão parte de uma entrada cardinal do centro; extensões posteriores formam ruas secundárias e quarteirões.
- Foram deixados corredores e metadata compatíveis com futuras muralhas, bairros e estação, mas esses sistemas não foram implementados nesta fase.

## Uso dos assets

- O prédio econômico continua sendo um `Building` lógico; `CityVisualResolver` escolhe a representação ART-V1 separadamente.
- Casas variam de forma determinística por ID e estágio urbano: cabanas, casas simples, médias e ricas.
- Mercados e fazendas usam variantes estáveis para reduzir repetição visual.
- Centro urbano, produção, comércio, religião, porto e prédios cívico/militares usam os PNGs reais do manifest quando disponíveis, com fallback procedural preservado.
- O tamanho e a âncora de cada sprite vêm do manifest ART-V1 e entram no atlas paginado WebGPU existente.
- Nenhum sprite novo foi criado em CITY-V1.

## Crescimento

- Acampamento: núcleo compacto, centro evidente e primeira rua principal.
- Vila: quarteirões pequenos, ruas secundárias e agrupamento residencial/agroprodutivo.
- Cidade: centro cívico/comercial mais forte, blocos maiores e produção deslocada para as bordas e ferrovia.
- Grande cidade: maior raio de extensão, maior densidade tolerada e variantes residenciais ricas.
- O sistema não faz spawn espacial aleatório: o pequeno desempate é determinístico e só atua entre locais com pontuação equivalente.

## Performance

- A estrutura urbana é um cache runtime em `WeakMap`, não serializado e sem impacto no `.aethoria`.
- Construir um prédio atualiza somente seu lote, bloco e índice de edifícios no cache existente.
- Abrir uma rua atualiza somente os tiles da rota e as fachadas vizinhas.
- O levantamento completo é refeito apenas quando estágio, raio, mapa ou versões locais de terreno/rua/ferrovia mudam.
- A assinatura de invalidação consulta somente chunks que interceptam o raio da cidade.
- O renderer continua consultando o índice espacial de prédios por chunk; prédios fora da câmera não entram no lote visível.
- Chunks estáticos permanecem residentes na GPU. Foi corrigida uma proteção de tamanho de buffer que podia provocar erro de validação WebGPU quando uma página de instâncias crescia.

## Verificação

- `npx tsx tests/city-v1.test.ts`: PASS.
  - estágios pequeno/médio/grande;
  - ruas principais/secundárias e quarteirões;
  - atualização incremental preservando a mesma estrutura cacheada;
  - cidade costeira;
  - reserva e afinidade ferroviária;
  - exclusão de tiles de estrada/trilho.
- `npm run build`: PASS.
- Smoke visual local: PASS para evolução de vila costeira até cidade em crescimento, câmera, assets ART-V1 e espaçamento urbano.
- Prints: `scratch/city-v1-screenshots/`.

## Principais limitações

- A ocupação lógica ainda é um tile por prédio. O planner reserva folga visual, mas footprints lógicos multi-tile ficam para uma fase posterior.
- Muralhas, bairros formais, decadência/ruínas e estação ferroviária urbana não foram implementados, conforme o escopo.
- O traçado secundário é orgânico por escalonamento e obstáculos, mas ainda não modela becos, praças ou parcelamento cadastral persistente.
- A composição visual de uma grande cidade e de uma estação ativa ainda depende do tempo normal de simulação/tecnologia; CITY-V1 só prepara e respeita esses espaços.
- O bundle principal continua acima de 500 kB comprimido; code splitting permanece o maior gargalo técnico fora do sistema urbano.

## Arquivos de CITY-V1

- `src/civ/UrbanPlanner.ts`
- `src/civ/CivilizationEngine.ts`
- `src/assets/CityAssetManifest.ts`
- `src/renderer/CityVisualResolver.ts`
- `src/renderer/webgpu/RenderSnapshot.ts`
- `src/renderer/webgpu/WebGPUWorldRenderer.ts`
- `tests/city-v1.test.ts`
- `CITY_V1_REPORT.md`

