# AETHORIA — CITY-V2 REPORT

## Crescimento histórico

- As cidades agora registram uma linha do tempo compacta com cinco fases: `settlement`, `village`, `city`, `great_city` e `metropolis`.
- Cada prédio guarda ano de construção, fase de origem, geração urbana, última reforma e fase visual atual.
- Esses dados são fatos históricos persistentes e entram no save; lotes, blocos e demais índices continuam derivados e não são serializados.
- Saves anteriores continuam carregando com valores seguros e passam a registrar novas fases normalmente.

## Preservação do núcleo

- A coordenada de fundação continua sendo o centro histórico permanente.
- Prédios antigos não trocam de sprite quando o tier da cidade muda.
- Casas do assentamento podem permanecer como cabanas/casas simples enquanto expansões posteriores usam casas médias ou ricas.
- Reformas usam o upgrade econômico já existente, atingem no máximo um prédio por ciclo anual e preferem os mais antigos em caso de empate funcional.
- Queda temporária de população/tier não apaga nem reescreve a história urbana.

## Expansão urbana

- O planner calcula o raio ocupado pelas gerações anteriores e favorece o próximo anel fora dessa borda.
- Novas áreas continuam obrigadas a se conectar à malha de ruas realizada pelo CITY-V1.
- A maior parte do crescimento abre bairros nas bordas; cidades maduras fazem preenchimento interno ocasional para aumentar densidade gradualmente.
- Blocos e lotes derivados carregam o menor ano/geração dos prédios que contêm, permitindo distinguir núcleo, primeira expansão e bairros posteriores sem um mapa histórico pesado.
- Continuidade urbana, centro, função, costa, rios/terreno, estradas e ferrovia continuam participando da pontuação existente.
- Atualizações de construção e rua permanecem locais; mudança de fase é um dos poucos eventos que recompõe a malha derivada da cidade.

## Uso dos assets

- Nenhum sprite novo foi criado.
- O `CityVisualResolver` usa a fase visual individual do prédio, não o tier global atual da cidade.
- Variantes existentes de cabana, casa simples, casa média e casa rica formam camadas históricas visíveis.
- Mercados, fazendas e demais edifícios continuam usando variantes determinísticas e o atlas paginado WebGPU do ART-V1.
- Fallback Canvas foi preservado.

## Performance

- A linha do tempo urbana tem no máximo um registro por fase da cidade.
- A proveniência adiciona apenas cinco campos escalares por prédio.
- Uma construção altera somente seu prédio, lote, bloco, chunk lógico e chunk de render.
- Uma reforma invalida somente o tile/chunk do prédio reformado.
- Consultas repetidas reutilizam o mesmo cache urbano enquanto fase, raio e versões locais não mudam.
- Nenhuma regeneração visual por frame foi adicionada.

## Verificação

- `npx tsx tests/city-v2.test.ts`: PASS.
  - núcleo histórico persistente;
  - expansão em anel posterior;
  - proveniência incremental por lote/bloco;
  - reforma individual;
  - save/load da história.
- `npx tsx tests/city-v1.test.ts`: PASS.
- `npm run build`: PASS.
- Smoke visual em build de produção: cidade acompanhada do ano 2 ao ano 9, com núcleo antigo compacto, expansão periférica e mistura de sprites de fases diferentes; console sem warnings ou erros.
- Comparação visual salva em `scratch/city-v2-screenshots/`.

## Limitações restantes

- A história é representada por prédios/blocos, não por polígonos persistentes de bairro.
- Ruas ainda não armazenam individualmente seu ano de abertura; sua origem é inferida pela geração dos blocos adjacentes.
- Reformas mudam a representação do prédio existente; demolição/substituição física com cadeia própria não foi adicionada.
- Muralhas completas, identidade cultural profunda, distritos avançados e decadência continuam fora do escopo.
- A biblioteca atual tem mais variação residencial que variação histórica para edifícios comerciais/industriais; ampliar isso depende de futuros assets, não de CITY-V2.

## Arquivos alterados

- `src/civ/Building.ts`
- `src/civ/City.ts`
- `src/civ/UrbanPlanner.ts`
- `src/civ/CivilizationEngine.ts`
- `src/renderer/CityVisualResolver.ts`
- `tests/city-v2.test.ts`
- `CITY_V2_REPORT.md`

