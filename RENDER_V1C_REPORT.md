# AETHORIA — RENDER-V1C Report

| Área | Resultado |
| --- | --- |
| buildings | PASS |
| entities | PASS |
| animations | PASS |
| overlays | PASS |
| spatial indexing | PASS |

## Implementado

- Prédios WebGPU entram no buffer residente do seu chunk, com variantes de era, nível e faixas de dano já compostas pelo gerador existente. Cada variante ocupa uma região do atlas paginado; não há draw por prédio.
- Entidades usam sprites direcionais e frames existentes, escolhidos por movimento/estado visual e interpolados por `prevX/prevY` no shader. Cidadãos, animais e unidades usam o mesmo batch.
- Navios, caravanas e o trem de freight são instâncias dinâmicas visíveis; caravanas usam frames de passada existentes e trens permanecem dinâmicos sobre trilhos estáticos.
- Entidades são consultadas por `SpatialHash.queryRect`. Prédios recebem um índice espacial próprio e chunks consultam apenas o retângulo local para sua reconstrução.
- Seleção, recursos, território/ocupação, bordas, roads e rail permanecem no caminho WebGPU. Dados dinâmicos também são separados por página de atlas.

## Verificação

- `npm run build`: PASS.
- `tests/render-v1a.test.ts`, `tests/render-v1b.test.ts` e `tests/render-v1c.test.ts`: PASS.
- O smoke automatizado V1C confirma batching de prédio, cidadão, navio, caravana, trem, seleção, frames de animação e nenhuma reconstrução de chunk no frame estável.
- Smoke Canvas vs WebGPU: PASS de inicialização, câmera e mapa. Ambos foram criados no preset `Continente Único` 64×64, chegaram ao mapa e o backend WebGPU não emitiu erros. A inspeção visual confirmou terreno, árvores e entidades em ambos; o setup não expõe uma semente fixa, portanto esta é uma comparação de preset e não de um save serializado idêntico.

## Diferenças restantes para Canvas

- A composição WebGPU cobre as variantes de prédio de era/nível/dano, mas ainda não reproduz todos os micro-acessórios de prosperidade, staffing, profissão, equipamento e grande-personagem do Canvas.
- Embarcações e caravanas não espelham ainda flip, bandeira, wake, poeira e efeitos auxiliares do Canvas.
- Chamadas de overlays analíticos especializados (trade, army, heatmap e inteligência) permanecem no Canvas.
- Nós de recurso, decoração urbana, bandeiras, wake/poeira e microefeitos de prédio do Canvas ainda não são emitidos pelo WebGPU.

## Gargalo principal restante

O principal custo agora é a quantidade de páginas/variantes de prédio e, portanto, os draws `chunk × página`. Uma compactação por família visual ou multi-draw indirect seria a próxima etapa, sem reintroduzir reconstrução global.
