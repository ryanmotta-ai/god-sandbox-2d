# AETHORIA — COL-V2

## Fluxos implementados

COL-V2 transforma o vínculo político de COL-V1 em comércio material usando o `TradeNetwork` existente. Não há mercado colonial paralelo nem estoques abstratos adicionais.

- A cada ciclo econômico, cada relação válida metrópole–colônia garante um acordo comercial interno preferencial, com tarifa de 1%.
- A colônia procura exportar uma matéria-prima que possua em excedente real para a metrópole.
- A metrópole procura exportar bens manufaturados em excedente para a colônia quando esta tem necessidade de estoque.
- Cada relação abre no máximo uma rota prioritária de exportação bruta e uma de importação manufaturada; rotas genéricas existentes continuam livres para complementar o comércio.
- A rota movimenta o `Stockpile` real das cidades e registra importação/exportação no `CityLedger` já existente.
- Exportações coloniais entregues rendem receita à colônia; 8% dessa receita é transferida como tributo à metrópole usando os tesouros existentes.

## Dependências econômicas

As dependências não são valores artificiais. Elas são derivadas dos fluxos já registrados no ledger:

- A seleção de uma exportação colonial favorece bens regionais e estratégicos.
- Quando uma matéria-prima colonial é insumo de uma receita industrial metropolitana, recebe prioridade adicional. Algodão para uma oficina têxtil, por exemplo, é escolhido por a receita de tecido consumir algodão.
- A cidade metropolitana consome o insumo recebido em `runCraftProduction`; sem estoque, a receita produz menos e reporta a demanda ausente ao mercado/local market existentes.
- O método existente `CityLedger.importDependency(good)` passa a refletir a dependência efetiva da cidade metropolitana ou colonial, pois importações e consumos agora são registrados pela própria rota colonial.
- Bens manufaturados podem seguir da metrópole para a colônia quando há excedente e necessidade real, criando a dependência inversa sem forçar cotas.

## Integração logística

As rotas coloniais usam o mesmo caminho e a mesma capacidade do comércio normal:

- Rotas terrestres usam o pathfinder e pavimentam/avaliam estradas com `paveTradeRoad`, `roadCapacityFactor` e dano de estrada.
- Rotas marítimas só abrem com porto ou ancoradouro operacional nos dois extremos e são limitadas por `portCapacityFactor`.
- A distância entra no custo real: o custo por unidade é descontado da receita de exportação colonial, usando o mesmo cálculo de frete para estrada ou mar.
- O acordo colonial também permite que a rede ferroviária existente atravesse a fronteira metrópole–colônia quando houver uma linha física conectada; a ferrovia continua transportando somente seus bens industriais configurados.
- Embargos, guerras bilaterais e infraestrutura inoperante impedem o fluxo. O Chronicle registra criação e interrupção de rotas coloniais.

## Consequências de interrupção

Uma rota bloqueada não entrega mercadoria. Não há compensação automática: o estoque de destino é consumido pelas receitas e, quando se esgota, a produção dependente cai. A escassez também alimenta a demanda do mercado/local market, permitindo aumento de preço pelo mecanismo econômico existente.

O smoke de COL-V2 executa o cenário:

```text
Fazendas coloniais produzem algodão
→ rota colonial transporta algodão para a metrópole
→ oficina metropolitana produz tecido
→ embargo fecha a rota
→ algodão chega a zero
→ tecido cai de 1,5 para 0,0
```

Comandos executados com sucesso:

```text
npx.cmd tsx tests/colonisation-v2.smoke.ts
npm.cmd run build
```

## Limitações deliberadas

- Não foram implementadas independência, autonomia profunda, revoltas coloniais ou outro estado político de COL-V3.
- Não existe bloqueio naval por terceiro reino: as interrupções atuais usam a guerra/embargo entre os participantes ou falha física de porto/estrada/ferrovia já modelada.
- Tributo é um percentual da receita de exportação entregue; não há orçamento colonial, tarifas por produto ou política fiscal avançada.
- Não foram criados renderer, UI ou sistemas de cidades novos.
