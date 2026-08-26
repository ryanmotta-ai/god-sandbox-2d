---
name: aetherio
description: >
  Mapa de arquitetura do Aetherio (god-sandbox-2d): onde cada coisa mora, como
  o tick flui, e quais invariantes quebram em silêncio. Use ANTES de ler ou
  editar qualquer arquivo deste repositório — em qualquer tarefa de código,
  bug, feature, refactor, teste ou investigação. Existe para evitar que se
  gaste contexto varrendo 68 mil linhas às cegas e para evitar edições no
  lugar errado. Também use quando a pergunta for "onde fica X", "como funciona
  X", "por que X está lento", ou quando alguém propor economia, mercado,
  preços, imposto, logística, árvore de tecnologia ou uma nova tela de
  gerenciamento — todos esses foram deletados de propósito.
---

# Aetherio — mapa do projeto

Sandbox 2D de deuses. TypeScript + Canvas 2D (WebGPU opcional) + Tauri. Sem
framework de UI, sem framework de teste. `src` ≈ 68 mil linhas / 161 arquivos.

**Leia este arquivo inteiro antes de abrir código.** Ele existe para você não
precisar abrir `CivilizationEngine.ts` (4.365 linhas) nem `Renderer.ts` (5.307)
só para descobrir onde mexer. Combine com o skill `ponytail`, que governa o
tamanho do diff.

---

## 1. A lei do projeto

O jogo é **WorldBox, não Victoria**. Isso foi uma decisão explícita do dono do
projeto e 24 mil linhas foram deletadas para chegar aqui. Ela decide quase toda
dúvida de design:

- **Tempo real.** Nada espera a virada do ano. Não existe "pulso" anual.
- **Físico, não contábil.** Um celeiro tem grão dentro. Ouro é uma mercadoria
  na prateleira. Não existe PIB, preço, demanda, inflação, imposto ou conta
  nacional — foram removidos.
- **O glamour é visual.** Exércitos marchando, formações, cerco, batalha
  aérea. O que o jogador vê > o que a planilha calcula.
- **Política é gente, não facção.** Um rei com um traço, uma cidade com uma
  barra de lealdade. Não existem facções sociais invisíveis.
- **UI é clique, não tela.** Clica no objeto, vê o card. Telas de planilha
  (Economia, Logística, Política, Reino, Tecnologia) foram **deletadas**.

### Nunca adicione, sem pedido explícito e literal:
preço · mercado · moeda/câmbio · imposto/tributação · PIB ou conta nacional ·
rota comercial · caravana · frete · árvore de pesquisa · nova tela de
gerenciamento · facção social · qualquer pulso `if (ano mudou) { ... }`.

Se uma tarefa parecer pedir uma dessas, diga em uma linha que foi removido de
propósito e proponha a versão física/visual equivalente.

**A parte militar é a exceção a tudo isso: ela NÃO se simplifica.** Guerra pode
ganhar profundidade e detalhe à vontade. É o ponto do jogo.

---

## 2. A espinha do tick

Um único caminho. Saiba isso e você sabe onde pôr qualquer coisa temporal.

```
main.ts  gameLoop()                        ← requestAnimationFrame
  └ updateSimulation()
      └ scheduler.runFrame()               ← perf/SimulationScheduler.ts, orçamento de 8ms
          └ sim.tickAI(tileMap, particles, relevanceContext)   ← ai/EntityAI.ts
                ├ índices espaciais (rebuild só se dessincronizou)
                ├ POR ENTIDADE (só candidatas por região + LOD):
                │    aboardFleetId → pula   ·  fogo/lava  ·  cooldowns  ·  morte
                │    tickFauna(...) ou a máquina de estados do cidadão
                ├ tickDay()                ← fome/necessidades, fatiado
                ├ se yearTickCounter >= TICKS_PER_YEAR:
                │    currentYear++ · tickAge() · civ.tickYearBoundary() · air.resetYear()
                ├ civ.tickRealtime(civWorld, totalTicks)   ← civ/CivilizationEngine.ts
                ├ tickLives()
                ├ tickLifeSlices()         ← 3 slots / TICKS_PER_SEASON
                └ tickStatecraftSlices()   ← 4 slots / TICKS_PER_SEASON
```

`civ.tickRealtime` são três round-robins, um por escopo:

```
sliceCities(world, now)   → tickSettlement(city) + city.rebuildResourceCache()
sliceRealms(world, now)   → distributeStaples · tickFaith · gatherCrownRevenue
                            advanceEra · tickEconomy · tickCulture
                            tickRealmMood · tickGovernment
sliceWorld(world, now)    → 8 grupos, um por vez (fronteiras, defecção,
                            coalição, colonização, ecologia…)
```

`tickLifeSlices` (3 slots): `tickPregnancies` · `tickFamilies` · `tickWildlife`.

`tickStatecraftSlices` (4 slots):
1. `tickSuccession` + `diplomacy.tickDiplomacy`
2. `tickGeopolitics` + `tickRoyalCourts`  ← **guerra é declarada aqui**
3. `musterArmies` + `invasions.tickYear` + `air.planSorties`
4. `fronts.tickYear` → `logistics.tickYear` → `fronts.resolveYear` → `warfare.tickYear`

**Relógio** — `core/Clock.ts`, fonte única:
`TICKS_PER_DAY 600` · `DAYS_PER_YEAR 12` · `TICKS_PER_SEASON 1800` ·
`TICKS_PER_YEAR 7200`. Um ano tem 12 dias e 4 estações, de propósito.

Para escrever teste/probe headless: `civ.advanceTicks(world, fromTick, ticks)`.

---

## 3. Onde mexer

| Quero mudar | Vá em |
|---|---|
| Comportamento de cidadão (trabalho, medo, caça, fuga) | `ai/EntityAI.ts` → laço de `tickAI` |
| Fome, necessidade, rotina diária | `ai/EntityAI.ts` → `tickDay`; `entities/Needs.ts` |
| Nascimento / família / morte / idade | `ai/EntityAI.ts` → `tickPregnancies`, `tickFamilies`, `tickAge`; `civ/Generations.ts`, `civ/Lineage.ts` |
| Personalidade, herança de traço | `entities/Psyche.ts` (`createPsyche`), `entities/Traits.ts` |
| Fauna (lobo, urso, dragão…) | `ai/EntityAI.ts` → `tickWolfAI` e irmãos |
| Cidade crescer / consumir / estocar | `civ/CivilizationEngine.ts` → `tickSettlement` |
| Onde um prédio cabe | `civ/UrbanPlanner.ts` (+ `UrbanDistricts`, `FortificationPlanner`) |
| O que um prédio é/faz | `civ/Building.ts`; layout em `civ/CityBlueprints.ts` |
| Bem/recurso novo | `civ/Goods.ts` → `GOODS`, `PRODUCTION_RECIPES`, `EXTRACTION_METHOD` |
| Estoque de cidade | `city.stock` (`Stockpile`: `add/take/get/has/hasAll/total`) |
| Rei: traço, decisão, guerra | `civ/Rulers.ts` (`rulerTraitOf`, `decideRoyalAction`); execução em `EntityAI.tickRoyalCourts` / `actOnRoyalDecision` |
| Lealdade de cidade, revolta, golpe | `city.loyalty`; `CivilizationEngine.tickLoyalty` / `tickRealmMood`; escalares em `civ/Society.ts` |
| Leis / caráter do reino | `civ/RealmTraits.ts` (derivado de governo + rei, não armazenado) |
| Relações, aliança, declaração | `civ/Diplomacy.ts`; `EntityAI.tickGeopolitics` |
| Era tecnológica | `civ/TechTree.ts` → `ERA_GATES`, `advance()` |
| Batalha terrestre, cerco, moral | `civ/Warfare.ts` |
| Linha de frente, quem encosta em quem | `civ/WarFronts.ts` |
| Suprimento de exército | `civ/MilitaryLogistics.ts` |
| Invasão naval, navio de guerra | `civ/NavalInvasion.ts`, `civ/Warships.ts` |
| Aéreo | `civ/AirSystem.ts` |
| Dano de cerco em estrada/porto/prédio | `civ/WarDamage.ts` |
| Pavimentar rua, custo de estrada | `civ/RoadBuilding.ts` |
| **Desenhar qualquer coisa no mundo** | `renderer/Renderer.ts` → `render()` (passadas numeradas) |
| Sprite novo | `renderer/SpriteGenerator.ts` + `renderer/SpriteRegistry.ts` |
| Partícula, faísca, projétil, rastro | `renderer/Particles.ts` (`spawnProjectile`, `spawnExplosion`, `spawnImpactSparks`, `spawnMuzzleFlash`…) |
| Overlay analítico do mapa | `renderer/Overlays.ts` + passadas `drawXOverlay` no Renderer |
| Poder divino, desastre | `powers/GodPowers.ts`, `powers/Disasters.ts` |
| Terreno, bioma, geração | `world/TileMap.ts`, `world/WorldGenerator.ts`, `world/Biomes.ts` |
| Card de clique / inspeção | `ui/inspector/`, `ui/hud/SelectionCard.ts`, `ui/hud/Selection.ts` |
| HUD, barra superior, ferramentas | `ui/hud/` |
| Salvar / carregar | `core/SaveSystem.ts` + `platform/saveFormat.ts` |
| Medir performance | `perf/PerformanceProfiler.ts` (`perfProfiler.measure('nome', fn)`) |

Wiring de tudo (registro de telas, instanciação): `src/main.ts`.

---

## 4. Invariantes que quebram em silêncio

Cada uma destas já foi quebrada e custou depuração. Nenhuma dá erro de
compilação.

1. **Conservação de carga.** Todo trabalho fatiado cobra
   `elapsed_desde_a_última_visita / TICKS_PER_YEAR`, via `chargeFor(id, now)`.
   Nunca cobre uma fração fixa por visita: o balanceamento do mundo depende de
   um sujeito receber exatamente um ano de trabalho por ano.
2. **Crédito de rotação acumula contra `ring.length`, não contra a contagem
   viva.** Contra a contagem viva, um mundo que cresce fecha a volta cedo e
   todo mundo é simulado em dobro. Vale para `rotate()` em `EntityAI` e para as
   três slices em `CivilizationEngine`.
3. **A ordem das passadas de guerra é load-bearing:** frente → logística →
   resolve → combate. Separá-las em ticks diferentes resolve batalha com o
   suprimento do tick anterior.
4. **`aboardFleetId` é checado primeiro em `tickAI`.** Depois dele existe a
   regra anti-água que teleporta quem está sobre água para terra — ela
   arrancaria uma invasão inteira dos próprios navios.
5. **`spawnEntity` já faz push em `sim.entities`.** Empurrar de novo duplica a
   entidade.
6. **`ledger.flow(good)` devolve o ano fechado anterior**, não o corrente. Em
   teste, chame `ledger.rollOver()` antes de ler.
7. **`Psyche` é triangular em torno de 0.5, não uniforme** — `(roll()+roll())/2`
   mais herança puxando pro meio. Limiar `> 0.78` pega ~2% da população, não
   22%. Calibre olhando um mundo vivo, nunca no papel.
8. **Todo dreno físico é load-bearing.** Ao remover um consumo, algo passa a
   encher pra sempre e a fome fica impossível. O dreno atual é apodrecimento
   (`SPOILAGE_PER_YEAR`, flag `perishable`), não imposto.
9. **Estado derivado não se armazena:** traço do rei vem da psique, traço do
   reino vem de governo+rei, `known` vem da era. Não crie campo espelho.
10. **`tickGeopolitics` e `tickRoyalCourts` estão no MESMO slot de statecraft,
    e `musterArmies` só no slot seguinte.** Uma guerra é declarada e revista no
    mesmo sopro, antes de qualquer convocação. Qualquer decisão que leia força
    militar tem que distinguir "não convocou ainda" de "foi aniquilado" — foi
    exatamente por isso que todo rei pedia paz antes da primeira batalha e um
    mundo de 80 anos produziu uma guerra de duração zero.
11. **`civWorld()` é cacheado e atualizado no lugar.** É lido a cada tick;
    objeto novo por tick é exatamente o lixo que a passada contínua evita.

---

## 5. Como verificar

Sem framework de teste. Um arquivo por cenário, `assert` puro, roda direto:

```bash
npx tsx tests/realtime-cadence.test.ts     # um teste
npx tsc --noEmit                           # tipos — SÓ src/, ver aviso abaixo
npm run dev                                # subir o jogo (porta 5190)
```

> **`tsc` não cobre `tests/`.** O `tsconfig.json` tem `"include": ["src"]`, então
> os 54 arquivos de teste e probe podem referenciar API deletada e o type-check
> segue verde. Ao remover ou renomear qualquer coisa pública, faça
> `grep -rn "<nome>" tests/` na mão — foi assim que 6 arquivos passaram a ler um
> campo que não existia mais, um deles imprimindo `NaN` por semanas sem ninguém
> notar.

### Rodar o jogo de verdade e olhar

`window.aethoria` é exposto em DEV, então dá para dirigir o jogo sem clicar em
menu: `startNewWorld(config)` · `setSpeed(0..80)` · `focusOn(x, y, zoom)` ·
`trackEntity(id)` · `sim` para ler o mundo. Chromium e Playwright já estão no
ambiente (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, playwright
global).

Duas coisas aprendidas fazendo isso:

- **Em tempo real o navegador faz ~22s por ano de mundo** (orçamento de 8ms do
  `SimulationScheduler`), mesmo a 80x. Chegar ao ano 40, quando a guerra
  destrava, leva ~15 minutos de espera.
- **Para adiantar, chame `sim.tickAI` em laço dentro de `page.evaluate`.** Isso
  bloqueia a thread de JS da página, então o `requestAnimationFrame` não pinta
  durante o avanço: paga-se render só nos quadros que se quer olhar. Uma estação
  (1800 ticks) por chamada.
- Editar `src/` com o `npm run dev` de pé dispara HMR e **zera
  `window.aethoria`** — um driver tem que sobreviver a reload.

Testes que valem como referência do contrato atual:
`realtime-cadence` (cadência e conservação de carga) · `economy-gold` ·
`city-larder` · `tech-eras` · `politics-rulers` · `sim.smoke` · `soc-v3.smoke`.

**Já vermelhos antes deste trabalho** (verificado em `75b6196`) — não são
regressão sua: `perf-v1.test` · `terrain_sweeps.test` · `warfare-tactics.test` ·
`colonisation-v2.smoke`.

Lógica não trivial deixa **um** check runnável, no padrão dos arquivos acima:
assert puro, sem fixture, sem framework.

---

## 6. Estado atual

Feito: economia física sem contabilidade · logística deletada · política de reis
e lealdade · 6 eras automáticas · tempo real contínuo · telas de planilha
deletadas.

**Falta: Módulo 3 — o espetáculo militar.** É a prioridade do dono do projeto.
A simulação já existe (`siegeProgress`, `wallBreaches`, `gatesForced`,
`shield_wall`, mercenários, lendários); o **visual não existe** — zero
referências a rastro de flecha, projétil de cerco, ariete, balista, partícula
de brecha, `Kingslayer`. Esta fase é **aditiva**: não há nada a deletar nela.

Engasgos de perf conhecidos, com a correção já identificada:
`runConstruction` ~86ms (hoistar a enumeração de tiles candidatos em
`UrbanPlanner` e pontuar cada tipo contra ela uma vez) · `ecology.advanceYear`
~60ms (fatiar dentro do sistema de ecologia) · `tickFamilies` ~17ms.
Mediana de frame ~3,1ms.

Não verificado ao vivo: nunca se viu uma guerra disparar de ponta a ponta.
`RULER_FRICTION` foi calibrado por extrapolação.
