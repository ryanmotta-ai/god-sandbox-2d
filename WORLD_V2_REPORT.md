# AETHORIA — WORLD-V2

## O que mudou

- A seed recebida pelo `WorldGenerator` agora participa da geografia. Preset + seed produzem o mesmo mundo em toda repetição, e seeds diferentes preservam a identidade do preset sem repetir exatamente a mesma costa, clima ou drenagem.
- O relevo passou a ser construído em escalas normalizadas: massa continental e deformação de domínio em baixa frequência, costa em frequência intermediária e detalhe local de baixa amplitude. Isso elimina o efeito de aumentar a quantidade de ruído ao passar de 128 para 512 tiles.
- Continentes usam as formas WORLD-V1 como esqueleto, com costa mais contínua, moldura oceânica navegável e ilhas desenhadas preservadas.
- Cordilheiras usam os caminhos longos dos blueprints, deformação ampla e textura tectônica secundária. As faixas de altitude produzem cadeias contínuas, sopés, vales laterais e bacias interiores.
- Clima e biomas são calculados como regiões: latitude, altitude, distância do oceano, continentalidade, regiões úmidas/secas do blueprint e ruído climático de baixa frequência. Floresta, planície, savana, deserto, tundra, neve, pântano e costa fértil formam zonas reconhecíveis.
- Uma busca linear multi-origem calcula a distância ao oceano. O campo é reutilizado para umidade costeira, continentalidade e drenagem.
- Rios principais partem de fontes altas e interiores, seguem relevo + distância ao oceano + inércia/meandro e abrem um vertedouro raso quando presos. Depressões adequadas formam pequenos lagos; margens recebem umidade e fertilidade.
- Recursos comuns ficaram menos uniformes. Províncias geológicas agora usam coordenadas normalizadas, a quantidade de depósitos cresce de modo sublinear com a área e os veios ficam fisicamente maiores em mapas grandes. Madeira segue floresta/umidade; minérios seguem cadeias e fácies; argila/sal seguem costa e bacias; recursos climáticos seguem as regiões apropriadas.
- A geração principal continua escrevendo diretamente nos chunks 32×32 do WORLD-V1 e reportando progresso por etapa. Campos temporários compactos (`Float32Array`, `Int32Array`, `Uint8Array`) são liberados ao fim da geração.
- A serialização de tiles e o formato chunked-v1 não foram alterados; save/load existente permanece compatível.
- Nenhuma mudança foi feita em economia, guerra, política, CITY-V1, renderer WebGPU ou ART pipeline.

## Tempo de geração 512×512

Medições locais em Node/Windows, build atual:

| Caminho | Seeds | Tempos | Média |
|---|---:|---:|---:|
| `TileMap` real com 256 chunks | 1103, 8675309, 20260808 | 5.041 s, 4.716 s, 4.609 s | 4.789 s |
| Probe visual direto | três presets/seeds | 1.946 s, 1.584 s, 1.958 s | 1.829 s |

O caminho real inclui as fachadas e cópias do armazenamento chunked. Cada mapa 512×512 reportou aproximadamente 8.13 MB de armazenamento compacto de tiles.

## Principais algoritmos

1. Blueprint continental + domain warping seedado.
2. Ruído fractal em coordenadas normalizadas, separado por escala geográfica.
3. Ridge fields sobre polilinhas para cadeias montanhosas longas.
4. Campo de distância ao oceano por BFS multi-origem em O(n).
5. Classificação climática regional com continentalidade e altitude.
6. Dois passes celulares imutáveis para remover fragmentos pequenos de bioma.
7. Drenagem D8 orientada por relevo, costa, inércia e meandro determinístico.
8. Províncias geológicas e depósitos elípticos/rotacionados com escala sublinear.

## Verificação visual

Foram gerados e inspecionados:

- `single_continent`, seed 1103: massa principal com 40.9% de terra, cadeia montanhosa de 7.095 tiles e rios atravessando planícies até costas distintas.
- `two_continents`, seed 8675309: duas massas principais, estreito e ilhas intermediárias preservados, com cadeias e drenagens independentes.
- `archipelago`, seed 20260808: 15.3% de terra, ilha central e anel de ilhas habitáveis, sem pontes terrestres ruidosas.

Os previews locais estão em `scratch/world-v2-visuals/`. Pontos brancos representam nove sítios urbanos habitáveis por mapa, selecionados com distância mínima de 44 tiles; o centro vermelho marca cada sítio. O replay determinístico foi comparado tile a tile em uma amostra adicional.

## Testes

- `npm run build`: PASS.
- Geração visual 512×512 em três presets/seeds: PASS.
- Determinismo de terreno e recursos para preset + seed: PASS.

## Limitações restantes

- Rios continuam representados por `SHALLOW_WATER`; ainda não existe um tipo/metadata próprio para largura, ordem fluvial ou navegabilidade. Isso preserva save/load e evita antecipar uma nova revisão do formato mundial.
- Lagos são pequenos lagos de bacia e vertedouro, não uma simulação hidrológica completa com preenchimento volumétrico.
- Os marcadores urbanos da inspeção são sítios geograficamente aptos e espaçados; a fundação e expansão reais continuam sob CITY-V1/simulação, que não foi alterada.
- A geração continua síncrona. Ela respeita etapas e chunks, mas mover etapas para worker/yield assíncrono permanece trabalho futuro.
