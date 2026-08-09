# AETHORIA — COL-V3

## Autonomia, lealdade e identidade

O `Kingdom` colonial recebeu estado político persistente, serializado junto ao reino:

- `colonialAutonomy` — capacidade de autogoverno local;
- `colonialLoyalty` — disposição para permanecer submetida à metrópole;
- `colonialTension` — conflito acumulado com a metrópole;
- `colonialIdentity` — identidade política própria;
- `separatistMovement`, `separatistSince` e `revoltYear` — estágio temporal do movimento;
- `foreignSupport` — apoio material e diplomático externo durante a revolta.

Esses valores não avançam por RNG puro. A cada ano colonial, o sistema calcula pressão a partir de distância, prosperidade, estabilidade, segurança alimentar, anos de fome, desgaste de guerra, relação diplomática, alcance administrativo da metrópole e volume real de exportações coloniais entregues. A extração econômica usa as rotas de COL-V2: mais valor efetivamente exportado e tributado aumenta a tensão. Prosperidade e boa relação diplomática reduzem tensão e sustentam lealdade.

## Movimentos separatistas e revoltas

Uma colônia só organiza um movimento separatista após idade mínima, identidade própria e pressão política suficientes. O movimento é registrado no Chronicle e seleciona uma liderança entre as entidades adultas existentes na capital colonial, reutilizando o sistema de pessoas/Realm.

Depois de persistir por ao menos dois anos, um movimento pode virar revolta somente quando autonomia, tensão, lealdade, crise e pressão total cruzam limiares explícitos. A revolta:

- muda o estado para `AUTONOMOUS_COLONY`;
- declara guerra de independência pela `DiplomacyManager` existente;
- corta comércio colonial pelo tratamento normal de guerra/embargo;
- impede nova migração de apoio da metrópole;
- permite repressão pela metrópole através da guerra existente.

Uma metrópole muito mais forte, sem apoio estrangeiro à colônia, pode reprimir a revolta após conflito prolongado. Isso restaura `COLONY`, reduz autonomia e conserva uma tensão residual — não apaga artificialmente a crise.

## Apoio externo e alianças

Poderes conhecidos e membros de alianças existentes reagem à crise. Eles enviam ajuda de tesouro real para o lado politicamente favorecido. Apoiadores da colônia também podem entrar na aliança existente por meio da `DiplomacyManager`; aliados da metrópole financiam sua repressão quando suas relações indicam esse lado. Não foi criada uma segunda camada diplomática.

## Independência e novo Realm

Há dois desfechos de independência:

- **Pacífico:** movimento maduro, alta autonomia e identidade, baixa tensão, boa relação e ausência de crise grave.
- **Por guerra:** após revolta persistente, quando identidade, autonomia, tensão, força colonial relativa e apoio externo formam um caso suficiente.

A independência promove o próprio reino colonial para `INDEPENDENT`. Ele recebe nome soberano próprio (`Estado Livre de …` ou `República de …` quando compatível com a pesquisa), líder local e governo próprio. Como a colônia já possuía Realm, cidades, população, território, economia, pesquisa e tesouro próprios desde COL-V1, todos continuam funcionando sem migração de dados nem um tipo especial residual.

No caso pacífico, as rotas viram comércio normal e a tarifa é normalizada. No caso de guerra, o acordo e as rotas coloniais são encerrados, a guerra é resolvida como independência e uma trégua é registrada. Depois disso o novo reino participa normalmente de alianças, comércio, guerra e diplomacia estratégica.

## Chronicle e integração

O Chronicle registra:

- início do movimento separatista;
- revolta e guerra de independência;
- apoio externo;
- repressão;
- independência e seu desfecho pacífico ou militar.

COL-V3 usa diretamente `Kingdom`, `Society`, `Economy`, `Trade`, `Diplomacy`, `Warfare`, entidades de liderança e Chronicle existentes. Não foram alterados CITY, renderer, economia-base ou criados sistemas Politics/Diplomacy paralelos.

## Verificação

O smoke `tests/colonisation-v3.smoke.ts` cobre:

```text
metrópole funda colônia
→ colônia cresce território próprio
→ tensão e identidade elevadas formam movimento separatista
→ movimento inicia revolta e guerra de repressão
→ apoio externo e caso político suficientes geram independência
→ reino independente continua em um ciclo normal de simulação
```

Comandos executados com sucesso:

```text
npx.cmd tsx tests/colonisation-v1.smoke.ts
npx.cmd tsx tests/colonisation-v2.smoke.ts
npx.cmd tsx tests/colonisation-v3.smoke.ts
npm.cmd run build
```

## Limitações

- Apoio externo é financeiro/diplomático; não há expedições militares especiais nem bloqueio naval por terceiro reino.
- A guerra de independência usa a resolução de guerra e o sistema de tropas existentes; não foi criada uma camada militar colonial.
- Identidade colonial é um índice político focado, não uma nova simulação cultural profunda.
- Não há UI nova nesta fase; os estados ficam disponíveis no modelo, saves, Chronicle e sistemas existentes para exposição posterior.
