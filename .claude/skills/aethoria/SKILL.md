---
name: aethoria
description: Mapa de arquitetura do Aethoria (sandbox divino 2D em pixel art): onde cada coisa mora, como o tick flui e quais invariantes quebram em silêncio. Use ANTES de editar qualquer arquivo deste repositório — bug, feature, balanceamento, arte, UI, teste — ou quando a pergunta for "onde fica X" / "como funciona X".
---

# Aethoria — mapa

TypeScript + Canvas2D. `src/` ≈ 9 mil linhas. Sem asset: sprites e terreno são gerados por código.
Regras de projeto em `CLAUDE.md`; erros do jogo antigo e lições em `DESIGN.md`.

## O tick (um caminho só)

```
main.ts  rAF → game.frame(dt) → ui.update(dt)
  game.frame: acumulador a 20 Hz (TICK_DT) × velocidade, orçamento de 14 ms → sim.tick() → renderer.draw(alpha)
  sim.tick(): rebuildGrid → updateUnits → updateArrows → updateCities → updateKingdoms → updateDynamics
```
* `updateUnits` (sim/ai.ts): por unidade — envelhece, fome, afoga/queima, `thinkCiv|thinkAnimal|thinkEngine`
  quando `thinkT` zera, depois `act()` executa o `mode`. Decidir e agir são separados.
* `updateCities` (sim/city.ts, 1×/s por vila): papéis, planejador de lotes, nascimentos, lealdade, colonos.
* `updateKingdoms` (sim/kingdom.ts, 1×/2 s): rei, diplomacia, campanha (reunir → marchar → assaltar), engenhos.
* `updateDynamics` (sim/dynamics.ts): clima, desastres, fogo, regrowth por amostragem.
* `Sim.fx` é a ponte sim → render: a sim só emite `FxEvent`; `Renderer` os vira partículas e som.

## Onde mexer

| Quero mudar | Vá em |
|---|---|
| Terreno/objetos (ids, propriedades) | `world/defs.ts` (a ordem é formato de save) |
| Geração de mundo, biomas, rios | `world/gen.ts` (teste: `tests/worldgen.test.ts`) |
| Aparência do terreno (bordas, falésia, água) | `gfx/terrain.ts`, `gfx/water.ts`, `gfx/noisefield.ts` |
| Humanoides: proporções, andar, golpe | `gfx/rig.ts` (poses + IK), `gfx/humanoid.ts` (desenho), `gfx/looks.ts` (visual por raça/função) |
| Animais, dragão | `gfx/animals.ts` |
| Árvores, pedras, minérios | `gfx/flora.ts`; montanhas `gfx/mountain.ts` |
| Prédios (por raça/estágio/dano/variação) | `gfx/buildings.ts` (casas e utilitários), `gfx/town.ts` (cívicos), `gfx/port.ts` (porto); dados em `sim/buildings.ts`; efeitos em `city.ts` (`perksOf`) |
| Mobília de rua (postes, bancos, barris) | `gfx/props.ts` (`propAt`: função pura do tile, sem estado) |
| Navios, portos, pesca, troca, colonização e invasão por mar | `sim/navy.ts` (mapas de terra/mar, docas, estaleiro, missões), `sim/fleet.ts` (guerra naval); arte `gfx/ships.ts`, `gfx/port.ts` |
| Aríete, catapulta | `gfx/engines.ts` (arte), `sim/siege.ts` (IA e construção) |
| Comportamento de aldeão | `sim/ai.ts` (`thinkCiv`, `act`) |
| Bichos | `sim/fauna.ts` |
| Quem ataca quem, dano, flecha | `sim/combat.ts` (`hostile` é a única regra) |
| Vila: papéis, o que construir, onde, muralhas | `sim/city.ts` (`balanceRoles`, `planBuilding`, `findLot`, `planWalls`); arte `gfx/walls.ts` |
| Reis, relações, guerra, paz, conquista | `sim/kingdom.ts` |
| Tornado, meteoro, vulcão… | `sim/disasters.ts`; poderes (dados) em `sim/powers.ts` |
| Desenhar o mundo, FX, luz, clima | `render/renderer.ts`, `render/fx.ts`, `render/atmosphere.ts` |
| HUD, ferramentas, inspetor, minimapa | `ui/ui.ts`, `ui/inspector.ts`, `ui/icons.ts` |
| Música ambiente (humor: dia/noite/chuva/guerra) | `core/music.ts` (usa o `AudioContext` de `core/sound.ts`) |
| Salvar/carregar | `core/save.ts` (lista de campos única + `tests/save.test.ts`) |

## Invariantes que quebram em silêncio

1. **Todo filtro "unidades da cidade" checa `def.civ`.** Engenhos de cerco têm `cityId` e não têm guarda-roupa.
2. **Um reino sem cidade é apagado no tick seguinte.** Cenários de teste fundam a cidade (`foundCity`).
3. **`thinkCiv` não interrompe trabalho em curso** (`BUSY`): senão o lenhador reinicia a tarefa a cada decisão.
4. **Mudou terreno/objeto visível → use `world.setTerrain`/`touch`** para o chunk ser reassado.
5. **Pathfinding é o custo dominante**: trecho reto sem A*, teto de nós, recuo após falha (`failT`), re-busca
   com limite (`repathT`). Não chame `findPath` fora de `moveTo`.
6. **Pedido de paz precisa de aceitador** (`acceptance`): senão o exército em marcha é desfeito.
7. **Novo campo persistente?** adicione em `snapshot` e `restore` (core/save.ts); o teste de ida-e-volta pega o resto.
8. **`FxEvent` novo?** cubra em `render/fx.ts` e, se tiver som, em `core/sound.ts`.
9. **Sprites são cacheados por chave**: variação nova de aparência entra na chave (ex. `keyOf(look)`).
10. **Tuning pelos números**: `tools/probe2.ts` (mundo de 4 povos) e `tools/probe.ts` (um povo).

11. **Navio é `Unit` com `def.ship`** (pathing em água: `findPath(..., sea=true)`). Quem está a bordo tem `inShip`: fica
    fora da grade espacial, do desenho e do `think`; se o navio afunda, vira nadador. Filtro "unidades da cidade" que
    não pode contar passageiro deve checar `!u.inShip`. Prédio de água (`def.water`) tem `ax/ay` (cais, em terra) e
    `bx/by` (atracadouro) calculados em `initPort`, que o save refaz.

## Ferramentas

* `/sheet.html?mode=roster|anim|flora|animals|buildings|engines` — folha de sprites (dev server).
* `tools/shot2.mjs` / `tools/sheet.mjs` — capturas com Playwright; `window.aethoria` (Game) e
  `window.aethoriaUI` ficam expostos para dirigir o jogo; `game.debugBattle(n)` monta uma batalha.
