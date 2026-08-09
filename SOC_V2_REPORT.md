# SOC-V2 — Comportamento humano profundo

Cidadãos deixaram de ser executores de script e passaram a ser pessoas com
necessidades, disposição, memória e decisões próprias. A simulação existente não
foi reescrita: SOC-V2 alimenta os pontos de decisão que já existiam.

**Arquivo novo:** `src/entities/Psyche.ts` (~390 linhas).
**Arquivos tocados:** `Entity.ts`, `Needs.ts`, `EntityAI.ts`, `CivilizationEngine.ts`,
`SaveSystem.ts`, `PerformanceProfiler.ts`.

---

## 1. Necessidades

Reaproveitadas as três que já existiam em `EntityNeeds` (fome, conforto,
segurança) e adicionada **uma** barra nova: `social`.

| Necessidade | Onde vive | Como muda |
|---|---|---|
| fome | `needs.hunger` (existente) | +16/dia, refeição da despensa |
| conforto | `needs.comfort` (existente) | segue o telhado (`homeBuildingId`) |
| segurança | `needs.safety` (existente) | ameaças a 7 tiles + guerra |
| descanso | `energy` (existente) | não foi duplicado |
| **social** | `needs.social` (**novo**) | −6/dia, +9 por vizinho até 4 |
| trabalho/renda | **derivado** de `profession`/`wealth` | não é barra |
| moradia | **derivado** de `homeBuildingId` | não é barra |

Uma barra nova, não dezenas. Trabalho e moradia são derivados porque um valor
escrito num lugar e lido noutro sai de sincronia com o estado que deveria
representar.

## 2. Personalidade

Sete traços numéricos 0..1, fixos por vida, herdados: `courage`, `sociability`,
`ambition`, `aggression`, `loyalty`, `curiosity`, `riskTolerance`.

Todos são lidos por alguma decisão real:

- `courage`, `aggression` → `standGroundChance` (enfrentar ou fugir)
- `riskTolerance` → peso do perigo na vontade de migrar; caça
- `ambition` → procurar emprego melhor, mudar de casa, migrar por oportunidade
- `loyalty` → âncora contra migração; resistência a trocar de emprego
- `curiosity` → tolerância à distância ao escolher destino
- `sociability` → frequência com que interrompe o trabalho para socializar

Gerados pela média de dois sorteios, para que a população se concentre no meio e
os extremos sejam raros. Herança: média dos pais puxada para 0.5 + ruído — sem
essa puxada, uma linhagem corajosa produz uma vila uniformemente destemida em
poucas gerações e a dispersão colapsa.

Medido (`tests/soc-v2.probe.ts`, 100 cidadãos):

```
PERIGO (GUERRA)   partem 31/100 · faixa 0.00–0.81
DESEMPREGO        partem 57/100 · faixa 0.05–1.00
PROSPERIDADE      partem  0/100 · faixa 0.00–0.02
INIMIGO NA RUA    enfrentam 6/100 · faixa 0.03–0.58
```

## 3. Memória

`Memory { kind, year, weight }`, **teto rígido de 6** por cidadão.

Nove tipos: `bereavement`, `war_survived`, `battle`, `moved`, `lost_home`,
`jobless`, `famine`, `fire`, `prospered`.

- Cada tipo tem retenção anual própria: luto 0.94/ano, prosperidade 0.78/ano —
  trauma sobrevive a boa notícia.
- Abaixo de 0.06 a memória é descartada.
- Repetição **aprofunda** a marca existente em vez de ocupar um segundo slot.
- `traumaLoad()` soma e comprime (`t/(t+1.4)`): dois traumas pesam mais que um,
  mas a lista nunca satura num cidadão permanentemente quebrado.

Onde as memórias são gravadas: fuga de combate, participação em combate, fome de
3 dias, ano sem emprego, casa perdida, incêndio, migração, morte na família
(parceiro 0.75, filho 0.60, pai/mãe 0.40).

## 4. Decisões

A fórmula está em `migrationUrge(psyche, situation)`. Empurrões e âncoras, todos
nomeáveis por uma pessoa:

```
empurra: fome, perigo×(aversão a risco), desemprego×(ambição),
         infelicidade, trauma anterior, oportunidade×(ambição+curiosidade)
segura:  família presente×(lealdade), pertencimento×(lealdade), idade
```

A disposição **nunca aparece sozinha** — só escala uma pressão que já existe.
Por isso duas disposições iguais em circunstâncias diferentes divergem, e a
dispersão sobrevive sem alargar o dado.

Casos do briefing, mesma crise:

```
A: família + emprego + leal          vontade 0.00 (fica )  enfrenta 55%
B: jovem, sem vínculo, ambiciosa     vontade 1.00 (PARTE)  enfrenta 25%
C: perdeu casa, avessa a risco       vontade 0.74 (PARTE)  enfrenta  4%
D: família local, corajoso           vontade 0.12 (fica )  enfrenta 71%
```

## 5. Trabalho

- Desempregado procura sempre (`assignProfession`, já existente).
- Empregado só procura quando `ambição×0.5 − lealdade×0.2 − riqueza/400 > 0`
  **e** há vaga aberta na cidade. Sem isso a força de trabalho inteira se
  embaralharia todo ano à toa.
- Quem pede demissão e não acha nada fica desempregado — e isso vira memória.
- Economia existente: nenhum sistema novo.

## 6. Moradia

`claimHome(e, city, seekBetter)`. Uma família com ≥45 de moeda e conforto ≤55
procura casa melhor; entre casas com vaga prefere a de **nível mais alto**.

Correção importante: a casa antiga só é liberada **depois** de encontrar
substituta, para que uma busca frustrada nunca deixe alguém sem teto numa cidade
que tinha vaga. Integra com CITY-V5 pelo estoque de habitação existente.

## 7. Relações

`Bond { id, kind: 'friend'|'rival', strength }`, **teto rígido de 4**.

Formadas no estado `socialize` (novo ramo de execução). Duas pessoas agressivas
viram rivais, qualquer outro par vira amigo — um só caminho de código, dois
desfechos, sem matriz de compatibilidade. Laços não mantidos decaem 12%/ano e
somem abaixo de 0.08. Uma amizade repetidamente azedada **vira** rivalidade em
vez de acumular dois registros.

Não há grafo social global.

## 8. Família

Reaproveitada inteira (`Lineage.ts`, `Household.ts`): parceiros, pais, filhos,
dinastia, nascimento, morte já existiam. O que faltava era **influenciar
decisões**:

- `familyTiesIn(e, cityId)` → âncora contra migrar (parceiro 0.5, filho 0.2 cada,
  pai/mãe 0.15 cada).
- `protectingFamily` em `standGroundChance` — quem tem os seus atrás não corre.
- `relocateCitizen` leva **parceiro e filhos junto**. Ninguém migra como se a
  família não existisse.

## 9. Mobilidade

Só a fundação comportamental, como pedido. `migrationUrge` fica no cidadão
(`e.migrationUrge`) e é lida por três consumidores: mudança entre cidades,
escolha de colonos e a UI. Um número acordado, não três derivações.

Mudança de bairro = `claimHome` com `seekBetter`. Mudança de cidade =
`findBetterSettlement` limitado a 60 tiles via `citiesNear` (hash espacial, não
scan). MIG-V1 completo não foi implementado.

## 10. Guerra e perigo

`willStandGround(e, threats)` é o **único** lugar que responde "enfrenta ou
foge", usado tanto para soldado inimigo quanto para lobo/urso/dragão. Antes eram
dois caminhos com regras diferentes.

Os fatos observáveis dominam (número de inimigos, arma na mão); a disposição
decide entre duas pessoas lendo as mesmas probabilidades. Soldados e reis sempre
enfrentam.

## 11. Caça (ECO)

Nada duplicado. O portão existente (`stock.food < população×1.25` +
`ecology.findNearbyPrey`) ganhou um terceiro fator: `huntWillingness(psyche,
hunger)`. ECO decide o que há para caçar; SOC-V2 decide **quem topa tentar**.

## 12. Colônias (COL)

`chooseSettlers()` em `CivilizationEngine` substituiu `.slice(0, count)` nos dois
pontos onde colonos eram escolhidos. Colonos agora são ordenados por
`migrationUrge` — quem parte é quem queria partir. Reis e líderes nunca vão.

## 13. Satisfação

`Entity.wellbeing` — getter derivado, como `socialClass`:

```
fome 0.30 · conforto 0.14 · segurança 0.20 · social 0.10
emprego 0.11 · casa 0.08 · família 0.07   −  trauma×0.20
```

Não é armazenado. POL-V2 pode tirar a média por assentamento quando quiser humor
público.

## 14. Comportamento coletivo

Nenhum sistema novo. `readCityMood(city)` lê a condição do assentamento **uma vez
por ano** e todos os moradores leem a mesma coisa. A causa é compartilhada; o que
cada um faz com ela não é.

Isso produz as tendências pedidas — guerra → medo → êxodo, prosperidade →
imigração, fome → caça/migração — sem um broadcast, e sem que os indivíduos
percam a divergência.

## 15. Performance

| Custo | Cadência | Limite |
|---|---|---|
| decaimento de memória | 1×/ano/cidadão | O(6), teto rígido |
| decaimento de laços | 1×/ano/cidadão | O(4), teto rígido |
| humor da cidade | 1×/ano/cidade | varre prédios da cidade |
| busca de emprego | só desempregado ou ambicioso com vaga | — |
| busca de destino | só quem já quer sair, com sorteio | consulta espacial, raio 60 |
| relocação | **máx. 12/ano no mundo inteiro** | `MAX_RELOCATIONS_PER_YEAR` |

`tickLives()` é uma passada anual dobrada ao lado de `tickAge`, que já percorria
todos. Nenhum scan global novo. Medido no profiler sob a métrica `lives`.

HOT/WARM/COLD intacto: as decisões por tick (`decideHumanoidState`) continuam
governadas por `shouldTickEntity` e `RELEVANCE_CADENCE`. SOC-V2 não roda IA
complexa por tick para ninguém — a parte cara é anual.

## 16. Determinismo

Todas as decisões probabilísticas usam `rng` (Mulberry32 semeado). Nenhum
`Math.random`. `tests/soc-v2.smoke.ts` fixa a semente e verifica que a mesma
pessoa perguntada duas vezes responde igual — a divergência vem de quem ela é,
não de um dado novo.

Save/load verificado: disposição, memórias, laços e necessidade social voltam
idênticos.

## 17. Save

Persistido: `psyche`, `memories`, `bonds`, `needs.social`, `migrationUrge`.

`migrationUrge` é derivado e normalmente não seria salvo; está lá porque a
colonização o consulta para escolher quem emigra, e um mundo recarregado no meio
do ano precisa mandar as mesmas pessoas.

Saves antigos carregam: quem não tem `psyche` fica com a que o construtor já
sorteou (nunca zeros), `needs` faz merge com os defaults, memórias e laços vazios.

## Testes

```bash
npx tsx tests/soc-v2.smoke.ts
```
```bash
npx tsx tests/soc-v2.probe.ts
```

`soc-v2.smoke.ts` — asserções: dispersão por personalidade, âncoras de família e
idade, coragem vs. probabilidades, tetos de memória e laço, decaimento, bem-estar,
herança sem colapso de dispersão ao longo de 8 gerações, 100 cidadãos numa crise
se dividindo, uma cidade faminta ao lado de uma próspera efetivamente esvaziando,
e round-trip de save incluindo save legado.

`soc-v2.probe.ts` — observação, não asserção: imprime quem parte, quem fica, quem
enfrenta e por quê, nos quatro cenários pedidos.

`npm run build` — OK.

## Limitações

- **`migrationUrge` satura em crises extremas.** Fome de 65 + fronteira aberta dá
  1.00 para toda a população; a ordem relativa (0.63–1.00) sobrevive e o teto de
  12 mudanças/ano faz os mais inquietos saírem primeiro, mas o número em si
  perde resolução no extremo.
- **Teto de relocação é global, não por cidade.** Doze mudanças por ano no mundo
  inteiro é um teto de custo, não de balanço. MIG-V1 deve substituí-lo.
- **Rivalidade só nasce de agressividade mútua.** Não há rivalidade por disputa
  de emprego, herança ou status.
- **`opportunityElsewhere` só considera assentamentos a até 60 tiles.** Migração
  intercontinental continua sendo trabalho de COL.
- **Necessidade social é contada por vizinhos próximos**, não por amigos. Estar
  cercado de estranhos alivia a solidão tanto quanto estar com a família.
- **Trauma não tem recuperação ativa** — só decai. Não há evento que cure.
