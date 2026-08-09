# AETHORIA — WORLD-V1 REPORT

## Resultado

WORLD-V1 foi implementado com mundo lógico dividido em chunks de 32×32, tiles em storage compacto, estados regionais, índices espaciais, território compacto, pathfinding hierárquico e persistência chunk-aware. Os presets 128, 256 e 512 foram exercitados; 512×512 é o maior mundo validado nesta entrega e não é tratado como limite arquitetural.

## Chunk architecture

- **PASS** — `TileMap` agora é apoiado por `ChunkedTileStore`, composto por `WorldChunk` de 32×32.
- A API compatível `grid[x][y]` permanece disponível por views leves, evitando exigir uma migração simultânea de todo o gameplay.
- Cada chunk mantém versões locais independentes para terreno, roads e railways. Alterações locais invalidam somente o chunk afetado e os caches derivados que dependem dessas versões.
- Views e superfícies de render são caches derivados e não fazem parte do save.

## Tile storage

- **PASS** — os campos densos de tile usam SoA/TypedArrays por chunk (`Uint8Array`, `Uint16Array`, `Uint32Array`, `Int16Array` e `Float32Array`).
- Campos raros, como IDs de owner/recurso e bridges, usam mapas sparse.
- O grid monolítico de objetos `Tile` deixou de ser a fonte de verdade. Objetos compatíveis são materializados somente como views de acesso, com cache apenas em regiões ACTIVE.
- Storage compacto medido: 507.904 bytes em 128², 2.031.616 bytes em 256² e 8.126.464 bytes em 512².

## Region states

- **PASS** — estados `ACTIVE`, `WARM` e `SLEEPING` são calculados por distância em chunks à câmera.
- Raio atual: ACTIVE até 1 chunk e WARM até 3 chunks; o restante fica SLEEPING.
- Regiões ACTIVE podem manter views quentes. WARM/SLEEPING liberam esse cache.
- O scheduler de entidades consulta o índice por chunk: ACTIVE/WARM participam do processamento normal, enquanto entidades exclusivamente SLEEPING recebem atualização reduzida, em uma passagem a cada 30 ticks.
- Smoke em 512² no centro: 9 ACTIVE, 40 WARM e 207 SLEEPING. Após mover a câmera para um canto: 9 ACTIVE, 16 WARM e 231 SLEEPING.

## Entity-chunk index

- **PASS** — `SimulationEngine` mantém um `SpatialHash` regional de 32 tiles, atualizado em spawn, movimento, nascimento, morte e load.
- Consultas e ticks regionais não precisam descobrir entidades locais por scan mundial.
- O índice espacial fino já usado por render e queries locais foi preservado.

## Territory storage

- **PASS** — `City.territory` usa `CompactTerritory`, um bitmask de 32×32 por chunk, em vez de um `Set<string>` por tile.
- A classe preserva a interface necessária (`add`, `has`, `delete`, iteração e `size`) para compatibilidade com gameplay e saves existentes.
- Chunks sem território não alocam máscaras.

## Hierarchical pathfinding

- **PASS** — rotas longas usam A* macro entre chunks e A* local, limitado, para costurar os trechos e portais entre chunks.
- Rotas curtas continuam usando pathfinding local.
- O cache de paths é validado pelas versões dos chunks atravessados, em vez de uma geração topológica global.
- Benchmark de rota longa: distância 359 tiles, 383 pontos, 38,4 ms.

## Road / rail network scale

- **PASS** — mudanças de road/rail incrementam somente a versão do chunk alterado.
- Roads participam do custo macro regional e não invalidam todos os paths do mundo.
- Railways mantêm listas sparse por chunk e reescaneiam somente chunks cuja versão ferroviária mudou. A conectividade global é recomposta a partir dessas listas sparse, sem scan do grid mundial de tiles.

## World generation

- **PASS** — a etapa principal de terreno é executada em ordem real de chunks 32×32 e expõe progresso por chunk; rios, biomas e recursos são estágios separados.
- Os presets reais disponíveis são 128², 256² e 512².
- Tempos finais medidos no teste arquitetural: 128² em 369 ms, 256² em 968 ms e 512² em 3.808 ms.
- Benchmark isolado confirmou a mesma ordem de grandeza: 331 ms, 1.164 ms e 4.114 ms, respectivamente.

## Save / load

- **PASS** — save format v4 serializa chunks e TypedArrays, sem region states, views, superfícies de render, índices ou caches derivados.
- O loader mantém compatibilidade com saves `.aethoria` monolíticos anteriores.
- No backend web, documentos grandes são comprimidos antes de entrar no `localStorage` e descomprimidos transparentemente em load, backup e recovery.
- Tamanho JSON bruto do mundo: aproximadamente 0,68 MB em 128², 2,73 MB em 256² e 10,91 MB em 512².
- Serialização/load isolados em 512²: 402 ms / 198 ms. O smoke no navegador confirmou save e load completos de 512².

## RAM aproximada

Os números de processo abaixo são deltas de RSS em execução Node isolada e incluem overhead transitório do runtime, geração, views e serialização; o valor de storage compacto é determinístico.

| Mundo | Tile storage compacto | Delta RSS observado | Save JSON bruto |
|---|---:|---:|---:|
| 128×128 | 0,51 MB | ~8,8 MB | 0,68 MB |
| 256×256 | 2,03 MB | ~22,3 MB | 2,73 MB |
| 512×512 | 8,13 MB | ~102,5 MB | 10,91 MB |

## Smoke test

- `npm run build`: **PASS**.
- Criação 128² / 256² / 512²: **PASS**.
- Câmera e transição ACTIVE/WARM/SLEEPING: **PASS**.
- Simulação e movimento de entidades: **PASS**.
- Save/load 128² automatizado e 512² no navegador: **PASS**.
- Pathfinding local/hierárquico, roads e railways: **PASS**.
- WebGPU em 128² / 256² / 512²: **PASS**, sem erros observados.
- Maior mundo estável validado: **512×512**.

## Gargalo atual principal

O maior custo restante é a geração inicial ainda executada no thread principal: o trabalho já está particionado e instrumentado por chunks/etapas, mas 512² ainda ocupa aproximadamente 4 segundos contínuos. O próximo ganho estrutural seria consumir esses estágios de forma assíncrona ou em worker. No save web, compressão/descompressão de documentos grandes também ainda produz latência perceptível. Isso fica como trabalho futuro; WORLD-V2 e CITY-V1 não foram iniciados.

## Arquivos centrais alterados

- `src/world/WorldChunks.ts`
- `src/world/CompactTerritory.ts`
- `src/world/TileMap.ts`
- `src/world/WorldGenerator.ts`
- `src/ai/Pathfinding.ts`
- `src/ai/EntityAI.ts`
- `src/core/SpatialHash.ts`
- `src/core/SaveSystem.ts`
- `src/platform/saveFormat.ts`
- `src/platform/storage/WebSaveStorage.ts`
- `src/civ/City.ts`
- `src/civ/RailwayNetwork.ts`
- `src/civ/RoadEngineering.ts`
- `src/civ/Infrastructure.ts`
- `src/civ/CaravanSystem.ts`
- `src/ui/screens/WorldSetupScreen.ts`
- `src/main.ts`
- `tests/world-v1.test.ts`
- `tests/world-v1.bench.ts`
- `tests/railway.test.ts`
