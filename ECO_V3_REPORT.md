# AETHORIA — ECO-V3

## Sistemas implementados

- Cadeia ecológica anual e simplificada: vegetação → herbívoros (veados,
  javalis, mamutes) → predadores (lobos, ursos, águias).
- Estado de ecologia por chunk: vegetação atual, potencial de recuperação,
  pressão humana, habitat e população local.
- Capacidade ambiental regional baseada em bioma, fertilidade, vegetação,
  incêndio e pressão de construções/estradas.
- Fome ecológica: rebanhos acima da capacidade vegetal e predadores sem presas
  acumulam estresse alimentar e podem morrer.
- Migração anual agregada entre chunks vizinhos: fauna deixa habitat pobre ou
  muito alterado por humanos e ocupa vizinhos mais favoráveis.
- Reprodução continua exigindo pares sobreviventes, habitat suficiente e chunk
  `ACTIVE`/`WARM`; vegetação e pressão de predadores agora afetam a taxa.
- Extinção local ocorre naturalmente quando não há sobreviventes. A recuperação
  ocorre por migração de regiões vizinhas e reprodução — nunca por respawn.
- Áreas sem construções ou estradas voltam gradualmente ao potencial vegetal,
  permitindo a recolonização após abandono ou destruição humana.

## Relações ecológicas

```text
atividade humana / agricultura / cidades
              ↓
  pressão humana e habitat disponível
              ↓
vegetação ← consumo ← herbívoros ← caça / predadores
              ↓                      ↓
       capacidade de suporte → alimento dos predadores
```

- Muitos herbívoros consomem a vegetação, diminuem a capacidade local e passam
  fome.
- Menos predadores aumenta a chance de reprodução dos herbívoros; o crescimento
  posterior pode então pressionar vegetação e provocar migração ou colapso.
- Menos presas limita diretamente a capacidade reprodutiva e alimentar dos
  predadores.

## Comportamento emergente observado

O smoke ECO-V3 confirma três consequências encadeadas: um rebanho excessivo
reduz a vegetação e sofre mortalidade por fome; retirar lobos aumenta a chance
de recuperação dos veados; e fauna em um chunk completamente ocupado migra
para o habitat vizinho disponível.

## Desempenho

- A simulação estrutural executa uma passada anual por chunk.
- Chunks `SLEEPING` usam apenas esse modelo agregado; não recebem IA de animal
  por quadro.
- Chunks `ACTIVE` e `WARM` ainda materializam movimento e reprodução local para
  que a fauna visível mantenha interação direta com humanos e predadores.

## Verificação

- `npx.cmd tsx tests/eco-v3.smoke.ts` passou.
- `npx.cmd tsx tests/eco-v2.smoke.ts` passou.
- `npm.cmd run build` passou.

## Limitações

- Vegetação é uma escala regional, não plantas individuais ou espécies
  botânicas separadas.
- Migração é anual e entre chunks adjacentes; não modela rotas sazonais longas.
- Agricultura é inferida pela ocupação de construções e estradas, sem inventário
  de safras ou nutrientes do solo.
- Não há doenças, genética, pesca ou cadeias alimentares além das espécies de
  fauna já existentes.
