# AETHORIA — RENDER-V1D Report

| Área | Resultado |
| --- | --- |
| WebGPU primary | PASS |
| paridade essencial | PASS |
| chunk caching | PASS |

## Implementado

- WebGPU é o renderer padrão. `?renderer=canvas` força o caminho de diagnóstico e Canvas continua sendo ativado automaticamente se inicialização, validação ou device WebGPU falhar.
- Terrain, resource nodes, buildings, entities, roads, railways, territories, borders, animações, seleção e grid essencial usam o caminho WebGPU batched/instanced.
- Chunks estáticos 32×32 mantêm buffers GPU residentes por página de atlas. Movimento de câmera apenas altera a lista visível; não concatena nem reenvia uma cópia da área visível.
- Construção, remoção, upgrade, dano/reparo e mudança de era invalidam apenas os chunks de prédios afetados. Ocupação, expansão e transferência territorial marcam somente as regiões tocadas.
- Invalidação de tile inclui o chunk dono e um vizinho apenas quando o tile está em uma borda de chunk; o antigo halo 3×3 foi removido.
- Entidades, prédios, navios e caravanas têm consulta espacial de câmera/chunk. Entidades fora da área visível não entram no lote dinâmico.
- Atlas paging usa shelf packing com páginas limitadas a 512×512, em vez de reservar uma célula 64×64 para todo sprite. Nós de recurso também foram integrados ao atlas paginado.
- Buffers residentes começam em 256 bytes e crescem sob demanda; foi removida a reserva fixa de 64 KiB por combinação chunk/página.
- Ordenação por profundidade de prédios, entidades, navios e caravanas considera a posição Y. Sprites laterais de navios/caravanas são espelhados pela direção.
- A concatenação temporária `staticData`/`dynamicData` do RENDER-V1A foi removida; WebGPU consome diretamente chunks e páginas residentes.

## Arquivos alterados

- `src/renderer/webgpu/RenderSnapshot.ts`
- `src/renderer/webgpu/TextureAtlas.ts`
- `src/renderer/webgpu/WebGPUWorldRenderer.ts`
- `src/renderer/world/WorldRenderer.ts`
- `src/renderer/world/RendererHost.ts`
- `src/world/TileMap.ts`
- `src/civ/City.ts`
- `src/civ/CivilizationEngine.ts`
- `src/civ/GreatPersons.ts`
- `src/civ/Infrastructure.ts`
- `src/civ/Warfare.ts`
- `src/civ/NavalSystem.ts`
- `src/civ/CaravanSystem.ts`
- `src/main.ts`
- `tests/render-v1a.test.ts`

## Verificação

- `npm run build`: PASS.
- `tests/render-v1a.test.ts`: PASS.
- `tests/render-v1b.test.ts`: PASS.
- `tests/render-v1c.test.ts`: PASS.
- Smoke WebGPU: PASS para abertura do mundo, câmera, cidade/prédios, entidades móveis, território/fronteira, seleção, UI e resize 1280×720 → 900×600 → 1280×720.
- Smoke WebGPU não registrou warnings, erros de validação ou erros de device.
- Comparação rápida com Canvas usando `renderSeed=424242`: terreno, recursos, vegetação, cidade, entidades e ocupação conservaram a leitura visual essencial.
- Roads e railways foram verificados no snapshot automatizado WebGPU com geometria estática residente; o mundo curto do smoke visual ainda não tinha rede ferroviária evoluída.

## Performance

Cena normal do smoke: aproximadamente **4.696 instâncias visíveis em 10 draw calls**, preparação de snapshot entre **0,0 e 0,2 ms**, atlas paginado com aproximadamente **7,60 MB**, buffers estáticos residentes com aproximadamente **0,93 MB** e buffers dinâmicos com aproximadamente **1,8 KB**.

Em seis frames estáveis consecutivos, os buffers estáticos permaneceram em exatamente 926.720 bytes. Cada frame enviou somente 624 bytes (uniform de câmera + páginas dinâmicas); nenhum chunk estático foi reconstruído ou reenviado. O teste V1B também confirma `updatedChunks = 0` no frame estável e `updatedChunks = 1` após uma mudança local.

## Diferenças restantes do Canvas

- Labels textuais de cidade, contagem de população e alguns adornos macro/urbanos ainda são exclusivos do Canvas.
- Overlays analíticos especializados de trade, armies, heatmap, diplomacy/politics/war intelligence ainda têm composição mais completa no Canvas.
- Microdetalhes de profissão/equipamento, staffing/prosperidade, bandeiras, wake, poeira, glow e partículas auxiliares continuam mais ricos no Canvas.
- O trem WebGPU mantém presença dinâmica essencial sobre rail estático, mas não reproduz toda a apresentação logística do Canvas.

## Problemas para RENDER-V2

- Composição visual avançada de labels, heatmaps e overlays de inteligência sem reintroduzir scans globais.
- Redução adicional de draw calls `chunk × página`, possivelmente por agrupamento de famílias, texture arrays ou indirect drawing.
- Sombras, iluminação, clima, partículas avançadas e microefeitos de sprites.
- Melhor LOD macro para cidades e infraestrutura em zoom distante.

Canvas foi mantido somente como fallback de segurança. Nenhuma implementação de WORLD-V1 ou CITY-V1 foi iniciada.
