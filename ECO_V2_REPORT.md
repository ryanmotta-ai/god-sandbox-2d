# AETHORIA — ECO-V2

## Entrega

- Humanos em cidades com escassez de alimento podem perseguir presas reais
  (veado, javali ou mamute) num raio local. A caça mata o animal e transforma a
  carcaça em uma carga finita de `food`, entregue ao estoque da cidade pela
  rotina normal de transporte.
- Veados fogem de humanos e predadores; javalis e mamutes já podem reagir de
  forma agressiva quando ameaçados. Lobos, águias e ursos mantêm suas rotinas de
  predação sobre presas próximas.
- O novo `EcologySystem` calcula, uma vez por ano, capacidade de suporte por
  espécie a partir de bioma, fertilidade, incêndio, construções e estradas. A
  presença de cidades e infraestrutura reduz o habitat utilizável.
- Predadores têm a capacidade e a reprodução limitadas pela população real de
  presas. A pressão de predadores reduz a recuperação dos herbívoros.
- Reprodução exige ao menos um par vivo, habitat local adequado e chunk
  `ACTIVE` ou `WARM`. Espécies extintas não voltam por respawn automático;
  sobreviventes se recuperam gradualmente quando o habitat melhora.

## Desempenho

- IA animal continua sendo rodada somente pelos candidatos regionais já
  filtrados por `ACTIVE`/`WARM`/`SLEEPING`.
- A busca de presas da caça humana usa o índice espacial local; não percorre a
  fauna mundial a cada decisão.
- O censo/habitat é uma passada estrutural por chunk uma vez por ano, sem IA
  individual completa para fauna distante.

## Verificação

- `npm.cmd run build` passou.
- `npx.cmd tsx tests/eco-v2.smoke.ts` passou: predador caça presa, humano caça
  e entrega alimento, a população de presa cai e um par sobrevivente volta a
  crescer em habitat viável.

## Limitações atuais

- O sistema usa classes amplas de habitat e uma cadeia alimentar curta; não há
  migração sazonal, doença, genética ou composição detalhada de plantas.
- A influência humana é medida por construções/estradas/incêndio, e não por um
  modelo separado de poluição ou desmatamento histórico.
- Carcaças não ficam persistentes no mapa: a recompensa de caça vira uma carga
  de alimento assim que a morte é processada.
