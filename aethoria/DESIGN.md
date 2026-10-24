# Aethoria — contrato de design

Reescrita do zero do sandbox de deuses (`../src` fica como referência até a
migração terminar). Alvo: **sentir como WorldBox** — mundo pintável, vivo,
legível de longe, caótico de perto — com pixel art detalhada e animação de
verdade.

## O que aprendemos com o jogo antigo (e a regra que sai de cada erro)

| Erro no jogo antigo | Regra em Aethoria |
|---|---|
| Arte de 32px desenhada num mundo de 16px (escala 0,78, chiado) | **Um contrato de escala:** tile = 32px (decisão do dono: "super detalhado"), sprites 1:1, zoom em passos inteiros, câmera encaixada em pixel. Humanos ~20×34 px, 4–5 tons por material, contorno colorido seletivo. |
| "Animação" = uma pose recortada e deslocada; sem vista de costas | Sprites **compostos por rig** com pose por frame: 4 direções reais, andar de 6 frames, atacar, trabalhar, morrer. |
| Gerador só emitia grama e montanha (biomas apagados num commit) | Biomas por temperatura × umidade × altitude, praia, colinas, picos nevados, rios, lagos, lava. Teste que falha se o mundo for monocromático. |
| Terreno plano, sem relevo, sem transição | Terreno assado em pixel com bordas orgânicas, falésias 3/4, espuma na costa, água animada. |
| Dois renderers (Canvas + WebGPU) com paridade nunca atingida | **Um** renderer, Canvas2D, chunks assados, ordenação por Y global. |
| `grid[x][y]` de objetos / fachada Proxy | Arrays tipados planos (`y*W+x`). |
| Tick atrelado ao framerate; 9 velocidades; ~22 s/ano mesmo a 80× | Acumulador de passo fixo (20 Hz) desacoplado do render; 5 velocidades. |
| Guerra em dois modelos (planilha abstrata + soldados físicos) | **Um modelo:** exército = unidades com ordens. A batalha é a física do combate. Sem `hp = 0` nos N primeiros. |
| Guerra só destrava no ano 40; relações nascem em +100 | Guerra nasce de contato, rei e relação: primeiro conflito em minutos, não em décadas. |
| Comida 18× a necessidade: fome impossível | Produção calibrada para a fome ser possível; teste mede isso. |
| Telas de planilha (Economia, Reino, Guerra, Estatísticas) | Clique no objeto → card. Sem tela de planilha. |
| Economia/imposto/PIB que as próprias regras proibiam | Economia 100% física: estoque da cidade, carga nos braços. Sem moeda. |
| 51 poderes num `switch` de 570 linhas | Poderes são **dados** (forma, arrasto, som, efeito). |
| 4–5 mil linhas por arquivo | Teto prático ~600 linhas; um assunto por arquivo. |
| `tsc` só cobria `src/`; testes apodreciam | `tsconfig` inclui `tests/`; `npm test` roda tudo. |
| Português + inglês misturados; 3 nomes (Aetherio/Aethoria/worldcraft) | Uma língua (pt-BR) e um nome: **Aethoria**. |
| Save com lista de campos escrita à mão, sem RNG nem tick | Um schema só, com estado do RNG e relógio. |
| `.bak`, relatórios de 500 KB, scripts soltos | Nada disso. Um `DESIGN.md`. |

## Escopo do jogo

**Povos:** humanos, elfos, anões, orcs (arquitetura, cores e temperamento próprios).
**Fauna:** ovelha, galinha, vaca, coelho, cervo, javali, lobo, urso, cobra, caranguejo, peixe, aves, dragão. **Monstros:** zumbi (praga).
**Terrenos:** oceano fundo, raso, areia, terra, grama, selva, savana, deserto, pântano, tundra, neve, colina, montanha, lava, rocha, cinza, campo, estrada.
**Objetos:** árvores por bioma com estágios de crescimento, arbustos, pedras, minérios, cactos, juncos, flores.
**Civilização:** vila nasce de um grupo → casas, fazendas, serrarias, minas, torres, quartéis, muralhas, castelos; território com borda; reinos com bandeira e cor; rei com temperamento; lealdade da cidade → revolta; diplomacia → guerra → cerco.
**Guerra:** formação, arqueiros com flechas em arco, cavalaria, aríetes e catapultas, navios.
**Poderes:** pincel de terreno, spawn, natureza, desastres (raio, meteoro, terremoto, tornado, chuva ácida, vulcão, bomba), bênçãos e maldições, borracha, inspeção.
**Mundo:** dia/noite, estações (cor, neve), clima (chuva, neve, névoa), som sintetizado.

## Arquitetura

```
src/core    rng, noise, relógio, eventos
src/world   tipos de terreno, grade tipada, gerador, dinâmica (fogo, lava, grama…)
src/gfx     paleta, pintor de pixels, terreno assado, rigs de sprites, atlas
src/sim     espécies, unidades, IA, cidades, reinos, guerra, poderes
src/ui      HUD estilo WorldBox (abas, pincel, card, minimapa)
tests       assert puro, tipado, `npm test`
```
