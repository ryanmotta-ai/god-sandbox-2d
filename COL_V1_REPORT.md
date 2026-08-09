# AETHORIA — COL-V1

## Sistema implementado

COL-V1 introduz colônias como **reinos/unidades políticas próprias**. Uma colônia não é uma cidade distante adicionada à lista de cidades da metrópole: ela recebe um `Kingdom` próprio, uma cidade-capital, território, população e tesouro inicial próprios. Assim, as rotinas já existentes de crescimento urbano, expansão territorial, produção, diplomacia e guerra continuam operando sem sistemas paralelos.

O modelo político em `Kingdom` agora preserva os estados preparados para a evolução do sistema:

- `COLONY` — estado implementado na fundação;
- `AUTONOMOUS_COLONY` — reservado para COL-V2/etapas futuras;
- `INDEPENDENT` — estado dos reinos não coloniais e para eventual desligamento administrativo.

## Relação metrópole/colônia

Cada colônia registra `metropoleId`, `colonialStatus` e `colonialAccess` (`overland` ou `maritime`). A metrópole mantém o conjunto `colonyIds`.

Na fundação, a metrópole e a colônia passam a se conhecer diplomaticamente e recebem relação máxima. A relação colonial é distinta de vassalagem: a colônia não entra no ciclo de tributo, submissão diplomática ou revolta de vassalos. Enquanto estiver em `COLONY`, ela também é ignorada pela lógica existente de secessão.

As propriedades são serializadas junto ao `Kingdom`, portanto a relação metrópole–colônia sobrevive a salvamentos. Caso um dos lados deixe de existir, a referência oposta é removida de forma segura.

## Regras de fundação

Uma fundação colonial exige:

- tecnologia de colonização, liberada pela navegação;
- população total e tesouro suficientes na metrópole;
- uma cidade de origem populosa, próspera e com provisões;
- destino distante, sem cidade, construção ou dono territorial;
- distância mínima proporcional ao tamanho do mundo e afastamento de outras cidades;
- acesso terrestre por caminho válido, ou acesso marítimo entre costas ligadas por rota naval;
- pontuação favorável de fertilidade, recursos próximos, bioma preferido e distância.

A expedição transfere colonos reais, alimentos, madeira e parte da capacidade financeira da metrópole. O novo reino recebe nome próprio no formato `Colônia <nome>` — por exemplo, `Colônia Aurelia` — e sua primeira cidade torna-se a capital colonial. Uma metrópole pode manter múltiplas colônias.

## Integração com os sistemas existentes

- **Realm/Kingdom:** a colônia é um `Kingdom` existente com estatuto colonial, não uma estrutura duplicada.
- **City e território:** a capital colonial pertence ao novo reino; sua expansão usa a rotina normal de território e suas futuras cidades também lhe pertencem.
- **Economia:** a expedição usa tesouro e estoques já existentes; provisões e apoio migratório usam o ledger de importação/exportação das cidades. Não foi criada economia colonial separada.
- **Migração/transporte:** a fundação transfere entidades reais de cidade e reino. Colônias jovens podem receber pequenos fluxos anuais de migrantes e alimento da metrópole pela rota que tornou a expedição possível.
- **Diplomacia:** metrópole e colônia não se tratam como rivais; a colônia permanece um ator territorial separado contra outros reinos. Logo, regiões sem dono continuam disputáveis por qualquer reino e conflitos existentes podem contestar território colonial.
- **Chronicle e eventos:** a fundação gera entrada detalhada no Chronicle com metrópole, colônia, capital, colonos, distância e tipo de acesso; eventos `colonialRealmFounded` e `colonialMigration` foram adicionados.
- **Persistência:** os novos vínculos e estados são incluídos na serialização normal de `Kingdom`.

## Verificação

O smoke `tests/colonisation-v1.smoke.ts` valida: metrópole funda uma colônia distante, a capital colonial expande território no ano seguinte e o vínculo subordinado continua intacto.

Comandos executados com sucesso:

```text
npx.cmd tsx tests/colonisation-v1.smoke.ts
npm.cmd run build
```

## Limitações deliberadas de COL-V1

- Não há autonomia, independência colonial, revoltas coloniais ou guerra de libertação implementadas; os estados foram apenas preparados.
- Não há tributação, mercado preferencial, tarifas especiais, comboios ou cadeia econômica colonial profunda; isso fica para COL-V2.
- A migração usa a transferência existente de entidades e registros de carga, sem animação específica de navios/caravanas coloniais.
- Não foi alterado nenhum sistema CITY-V1/V2/V3 nem a geração visual das cidades.
