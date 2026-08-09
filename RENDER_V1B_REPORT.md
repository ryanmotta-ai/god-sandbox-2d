# AETHORIA — RENDER-V1B Report

## Implementado

- Chunks residentes de 32×32: cada chunk conserva faixas de instâncias por página de atlas; a câmera apenas seleciona quais faixas desenhar.
- Uploads WebGPU por chunk/página. Geometria estática não é reenviada em frames inalterados.
- Invalidação local através de `TileMap.dirtyChunks`, com halo 3×3 somente para conexões e bordas que atravessam o limite do chunk. Uma validação hash limitada protege mutações legadas sem coordenada.
- Roads WebGPU batched por chunk: corpo, conexões e níveis de superfície.
- Rail WebGPU batched por chunk: lastro, dois trilhos e plataforma de estação; locomotivas continuam fora deste caminho estático/dinâmico de entidades.
- Territory WebGPU por máscara de quads dentro do chunk, com cor do reino e quads de fronteira. A ocupação incremental invalida somente a vizinhança local marcada.
- Atlas paginado em páginas máximas de 512×512; os draws são agrupados pela página. Famílias dinâmicas permanecem na página zero.
- Consulta de entidades continua usando `SpatialHash.queryRect` quando disponível, evitando varredura global.

## Arquivos alterados

- `src/renderer/webgpu/RenderSnapshot.ts`
- `src/renderer/webgpu/WebGPUWorldRenderer.ts`
- `src/renderer/webgpu/WebGPUShader.ts`
- `src/renderer/webgpu/TextureAtlas.ts`
- `src/world/TileMap.ts`
- `src/civ/RoadEngineering.ts`
- `src/civ/CaravanSystem.ts`
- `src/civ/Infrastructure.ts`
- `src/civ/CivilizationEngine.ts`
- `src/civ/Warfare.ts`
- `tests/render-v1b.test.ts`

## Verificação

| Área | Resultado |
| --- | --- |
| chunks residentes/invalidação local | PASS |
| roads WebGPU | PASS |
| rail WebGPU | PASS |
| territory/borders WebGPU | PASS |
| atlas paging | PASS |
| entidades e índice espacial | PASS |
| resize e câmera (origem flutuante) | PASS por build/tipos; a sessão visual alcançou o menu, mas não aceitou iniciar mundo antes do prazo do navegador |

`npm run build` passou. `tests/render-v1a.test.ts` e `tests/render-v1b.test.ts` passaram. O teste V1B verifica roads, rail, máscara territorial/bordas, câmera, residência de chunks e que um frame estático não reconstrói geometria; uma única alteração local reconstrói apenas seu chunk.

## Draw calls / instâncias (cena normal)

- Instâncias: 1.024 de terreno por chunk visível, mais overlays/infraestrutura somente onde existem.
- Draw calls: um por par **chunk × página de atlas** visível, mais um draw dinâmico. Com atlas inicial (normalmente uma página) isto equivale aproximadamente ao número de chunks visíveis + 1; páginas adicionais só acrescentam calls para chunks que as usam.

## Gargalo principal restante

O maior custo restante é o número de draws por chunk em telas muito abertas. O próximo passo natural seria multi-draw indirect ou compactação de chunks por página, sem abandonar a invalidação local. Não foi implementado aqui para manter o escopo V1B.
