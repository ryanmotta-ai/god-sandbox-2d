# Aethoria

Sandbox divino 2D em pixel art, no espírito de WorldBox. TypeScript + Canvas2D, sem framework, sem
asset: toda a arte é desenhada por código. O jogo antigo (Aetherio) vive no histórico do git (commit `647ec9e`, também em `main`).

**Antes de editar, invoque o skill `aethoria`** — é o mapa: onde cada coisa mora, como o tick flui e
quais invariantes quebram sem erro de compilação. Em tarefa de código, o skill `ponytail` também vale.

## Verificar

```bash
npm run typecheck     # inclui tests/ e tools/
npm test              # mundo, simulação, batalha, cerco, save/load (headless, ~3 s)
npm run dev           # http://localhost:5200
npx tsx tools/probe2.ts 1200 7 192   # série temporal de um mundo de 4 povos (balanceamento)
```

## As regras (cada uma nasceu de um erro do jogo antigo — ver DESIGN.md)

1. **Um contrato de escala:** 1 tile = 32 px, sprites 1:1, zoom em passos inteiros.
2. **Um renderizador** (Canvas2D), ordenação por Y global. Nada de segundo backend.
3. **Um modelo de combate:** exército = unidades com ordens; a batalha é o combate físico. Sem "planilha" paralela.
4. **Economia física:** estoque da cidade, carga nos braços. Sem moeda, preço, imposto, PIB.
5. **Sem tela de planilha.** UI é clique no objeto → card.
6. **Sim em passo fixo de 20 Hz**, desacoplado do render; nada de pulso anual.
7. **Arrays tipados planos** no mundo (`y*w+x`); sem objeto por tile.
8. **Uma língua** (pt-BR) na UI e nos logs; identificadores em inglês.
9. **Todo comportamento novo ganha um teste** em `tests/` (assert puro) ou uma sonda em `tools/`; o que for
   afinar de balanceamento se mede com `tools/probe2.ts`, não no olho.
10. Arquivo com mais de ~600 linhas pede divisão.
