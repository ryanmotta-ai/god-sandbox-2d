# SOC-V3 — Gerações, herança e mobilidade social

SOC-V2 deu vida interior a um cidadão. SOC-V3 dá **história a uma família**. As
pessoas já tinham pais, local de nascimento e bolsa — mas nada disso sobrevivia a
elas. Um cidadão morria e a moeda sumia, a casa esvaziava, o ofício era esquecido
e os filhos começavam do zero num mundo sem memória de onde a família vinha.
Toda linhagem começava idêntica, então nenhuma podia subir ou cair.

**Arquivo novo:** `src/civ/Generations.ts` (~330 linhas).
**Arquivos tocados:** `Entity.ts`, `Psyche.ts`, `Lineage.ts`, `EntityAI.ts`,
`CivilizationEngine.ts`, `SaveSystem.ts`.

Sistema de cidadãos **não** reescrito. Quatro coisas descem as gerações e mais
nada: um espólio, uma origem, um ofício e uma marca.

---

## 1. Ciclo de vida

Reaproveitado inteiro — `Entity.lifeStage` já classificava
`infant → child → adolescent → adult → elder` e `lifeStageMultiplier` já escalava
HP/dano/velocidade por fase. Nenhuma simulação biológica nova.

O que faltava era **a idade influenciar decisões**:

| Efeito | Onde | Como |
|---|---|---|
| trabalho | `seekWork` | idoso não busca primeiro emprego nem troca de emprego — aposentou |
| formação familiar | `isFertile` (existente) | 18 anos até 70% da idade máxima |
| migração | `migrationUrge` | âncora de idade: 0 aos 22, máxima aos 67 |
| risco | `lifeStageMultiplier` (existente) | idoso: 85% HP, 70% velocidade |
| decisões | `assignProfession` | maioridade aos 18 já dispara a primeira profissão |

Medido em 26 anos com 24 fundadores: 50 crianças, 45 adultos, idade média 21.6.

## 2. Gerações

`generation` e a árvore pai/mãe/parceiro/filhos já existiam em `Lineage.ts`.
SOC-V3 acrescentou o que o filho precisa **saber**:

- pais e família — já existia
- local de origem — `originCityId` / `originCityName` (novo, ver §6)
- contexto social — `familyTrade` (novo) e a bolsa herdada

Genealogia **não** é infinita: ver §9.

## 3. Herança

`settleEstate(dead, lookup, household, workplaceStillOpen)`.

Ordem de reclamação, a que qualquer sistema de herança começa e não precisa de
lei para justificar: **cônjuge sobrevivente → filhos, do mais velho ao mais
novo** (mesma cidade, vivos).

| Bem | Regra |
|---|---|
| moeda | **dividida igualmente** entre os herdeiros |
| moradia | passa ao primeiro herdeiro **sem teto** |
| ofício | passa a um herdeiro adulto **sem emprego**, se a vaga ainda existe |
| posição familiar | `familyTrade` é gravado em todos os herdeiros |
| sem herdeiro | fica com quem ainda mora na casa |
| sem ninguém | some — uma família **pode** acabar |

A divisão igualitária é o motor: uma fortuna dividida entre seis filhos não é uma
fortuna; com um herdeiro, é uma dinastia. Nenhuma regra diz "esta casa está
subindo" — a aritmética diz.

Continuidade profissional é **oferta, nunca obrigação**: um herdeiro que já tem
emprego mantém o dele, e mesmo assim a casa registra o que fazia.

Economia existente. Sem inventário jurídico, sem testamento, sem tribunal.

## 4. Transmissão social

Filhos não são clones. Cinco canais, todos probabilísticos:

| Canal | Mecanismo | Força |
|---|---|---|
| disposição | `inheritPsyche` (SOC-V2) | média dos pais puxada para 0.5 + ruído |
| traits | `conceiveChild` (existente) | `inheritChance` por trait + 4% de mutação |
| riqueza inicial | `familyAdvantage` | **teto de 0.75** — vantagem, nunca destino |
| profissão | `familyTrade` no score de vaga | +450 pontos, ~1 categoria de preferência |
| marcas | `inheritFamilyMarks` | só 4 tipos, atenuados a 45% |

`familyAdvantage = min(0.75, (bolsa da casa por cabeça + herança) / 260)`.
Aplicado ao salário inicial no primeiro emprego. Um filho de casa rica começa
adiantado, não predestinado — é essa a diferença entre mobilidade e casta.

O puxão profissional (`0.55 + lealdade×0.25` de chance de sequer considerar, e
+450 no score) é forte o bastante para famílias de agricultores visivelmente
continuarem agricultoras entre gerações, e longe do suficiente para impedir o
filho do agricultor de pegar a vaga na forja que está de fato aberta.

## 5. Mobilidade social

`socialClass` já era **derivada** de riqueza + profissão — sem classes rígidas.
Faltava a riqueza poder **cair**.

Salário só somava à bolsa pessoal, então riqueza subia e nunca descia. Uma casa
não podia decair, o que significa que também não podia realmente subir — não
havia contra o que medir a subida.

`settleFortune(e)`: uma vez por ano a bolsa pessoal é puxada 25% na direção da
cota per capita do domicílio. Família que gasta mais do que ganha desce
visivelmente; família que prospera carrega os seus para cima.

Os fatores pedidos entram todos por sistemas que já existiam: emprego
(`assignProfession`), renda (salário em `deliver`), propriedade (`claimHome`),
oportunidade (`CityMood.opportunity`), crise/guerra (`CityMood.danger`),
migração (§6), sucesso econômico (mercado do reino).

## 6. Famílias ao longo do tempo

Nenhum objeto de família novo. Uma família continua sendo o que já era: pessoas
que compartilham um sobrenome e um conjunto de ids, mais o `Household` que já
existia (bolsa + despensa).

- **crescer / encolher** — `tickFamilies` existente
- **enriquecer / empobrecer** — §5
- **migrar** — `relocateCitizen` leva parceiro e filhos junto
- **dividir-se entre cidades** — filhos adultos migram sozinhos; a linhagem fica
  em duas cidades com a mesma `originCityId`
- **desaparecer** — espólio sem herdeiro, `Household` deletado quando esvazia
- **novas gerações** — `generation` incrementa em `conceiveChild`

## 7. Origem

Dois campos e um contador:

```
originCityId / originCityName  — de onde a FAMÍLIA é (herdado, não observado)
localGenerations               — quantas gerações da linhagem nasceram AQUI
```

`inheritOrigin(child, father, mother)`:

- a origem é a **ancestral**, copiada do pai/mãe sem alteração; só uma linhagem
  sem origem registrada adota o lugar onde nasceu;
- `localGenerations` = `pai.localGenerations + 1` se o filho nasceu onde os pais
  moram, senão 1.

`uproot(entity)` zera a profundidade quando alguém **muda de cidade** — por
definição, quem emigrou não é de onde agora mora, por mais gerações que a família
tenha passado na cidade que deixou. Sem isso o contador acompanharia as pessoas e
todo assentamento estaria instantaneamente cheio de nativos — exatamente o
inverso do que uma colônia é.

Exemplo do briefing, verificado no smoke:

```
nasce em A · migra para B (uproot → 0) · filho nasce em B (→ 1)
· neto nasce em B (→ 2) · bisneto (→ 3, ENRAIZADO)
origem da família continua sendo A em todas as gerações
```

`rootedness(e) = min(1, localGenerations / 3)` entra em `migrationUrge` como
âncora **separada** de `familyTies`: laços são os parentes vivos agora, isto é o
lugar em si ter direito sobre a pessoa. O neto de um colono pode não ter parente
vivo e mesmo assim pertencer a algum lugar.

## 8. Memória geracional

Não se transmite o diário do pai. Quatro tipos são hereditários — `lost_home`,
`war_survived`, `famine`, `moved` — com peso mínimo de 0.5 e atenuação a 45%.

Um filho não herda o ano ruim que o pai teve no trabalho; herda que a família
perdeu a casa numa guerra, porque é o tipo de coisa de que ainda se fala vinte
anos depois. O decaimento normal de SOC-V2 faz o esquecimento, igual a uma
memória que a pessoa viveu — a linhagem pende mais cautelosa por uma ou duas
gerações e depois para.

## 9. Personagens históricos e os mortos

`Entity.historic` — **um booleano**. Marcar alguém custa isso e compra lugar
permanente na genealogia. Fundadores de cidade já são marcados automaticamente.
Os papéis futuros (líder, general, empresário, revolucionário) **não** foram
implementados.

`pruneAncestors(map, 600)`: `deceasedAncestors` era a única estrutura que só
podia crescer — um vazamento garantido num jogo longo. Agora tem teto de 600.
Isentos para sempre: reis, líderes, `isGreatPerson`, quem tem título e quem foi
marcado `historic`. Os mortos comuns são esquecidos do mais antigo para o mais
recente — a ordem de iteração do Map já é a ordem de morte, então não há sort,
nem timestamp, nem índice secundário.

Os mortos **nunca** foram guardados como entidades completas: `DeceasedEntityRecord`
já era um registro leve (nome, dinastia, anos, parentesco, profissão).

## 10. Demografia

`Demographics` — derivado, nunca salvo, recalculado uma vez por ano **dentro da
passada que já percorria todos os cidadãos**. Não há censo separado nem scan
próprio.

```
população · crianças · adultos · idosos · idade média
domicílios · geração média · riqueza média
migrantStock (família de outro lugar) · rooted (linhagem ≥3 gerações local)
nascimentos · mortes · relocações no ano
```

`DemographicsAccumulator.count(e)` é chamado no laço de `tickLives`, e
`.finish()` fecha o ano. Exposto em `SimulationEngine.demographics`.

## 11. Integração COL

Ambos os caminhos de relocação colonial (`relocateColonists` e o de
`tickColonisation`) chamam `uproot(mover)` e gravam a memória `moved`. Resultado
direto:

```
1ª geração  colonos, localGenerations = 0, origem = metrópole
2ª geração  nascidos na colônia, localGenerations = 1, origem = metrópole
3ª geração  localGenerations = 2
4ª geração  localGenerations = 3 → rootedness = 1, ligação local plena
```

A origem histórica na metrópole permanece o tempo todo. COL-V3 não foi
duplicado — a escolha de colonos continua na `CivilizationEngine`, ordenada pelo
`migrationUrge` de SOC-V2.

## 12. Integração CITY

Sistema urbano **não** alterado. A mobilidade social influencia onde as pessoas
moram através do `claimHome` que SOC-V2 já havia estendido: entre casas com vaga,
prefere-se a de **nível mais alto**, e só quem tem ≥45 de moeda e conforto baixo
sai à procura. Famílias ricas concentram-se nas melhores casas porque são as
únicas que podem sair procurando.

Crise urbana → queda econômica → migração familiar sai de graça: `CityMood`
alimenta `migrationUrge`, e `relocateCitizen` move a família inteira.

## 13. Comportamento coletivo geracional

Emergente, sem sistema novo:

- **cidade próspera**: `opportunity` alta puxa migração → famílias chegam com
  `localGenerations = 0` → filhos nascem lá com 1 → `rooted` sobe na demografia →
  a âncora de enraizamento cresce e a cidade passa a segurar as pessoas.
- **região em decadência**: `migrationUrge` sobe; a âncora de idade faz os jovens
  saírem primeiro e os velhos ficarem → idade média sobe → menos trabalhadores →
  `opportunity` cai ainda mais.

Ambos saem dos dados que já existem.

## 14. Performance

| Custo | Cadência | Limite |
|---|---|---|
| herança | 1× por morte | O(filhos), sem varredura |
| origem + marcas | 1× por nascimento | O(6) memórias, teto rígido |
| poda da genealogia | 1× por morte | teto de 600, sem sort |
| demografia | dobrada no laço anual existente | zero passadas novas |
| `settleFortune` | 1×/ano/cidadão | uma leitura do domicílio |

Nenhuma árvore genealógica infinita. Nenhum morto como entidade completa.
Memórias (6) e laços (4) continuam com teto rígido. HOT/WARM/COLD intacto — nada
em SOC-V3 roda por tick. Atualização demográfica é periódica (anual).

## 15. Save

Persistido (novo): `originCityId`, `originCityName`, `localGenerations`,
`familyTrade`, `historic`. Já persistidos: idade, família, geração, riqueza,
domicílio, psique, memórias, laços.

**Não** persistido: `demographics` — é derivado e se reconstrói no primeiro ano.

Saves antigos: quem não tem origem registrada é tratado como sendo do lugar onde
nasceu, que é exatamente o que era antes do conceito existir.

## Teste

```bash
npx tsx tests/soc-v3.smoke.ts
```

Cobre: origem herdada vs. enraizamento conquistado (incluindo o caso colonial de
4 gerações), marcas hereditárias filtradas e atenuadas, espólio dividido entre
muitos vs. concentrado num só, herdeiro empregado que não é obrigado a herdar o
ofício, linhagem que se extingue, teto de vantagem familiar, poda da genealogia
preservando reis/fundadores/heróis, agregados demográficos, e 26 anos de
simulação real verificando nascimento, envelhecimento, morte, descendentes,
profundidade de linhagem, dispersão de riqueza, tetos de memória/laço e
round-trip de save.

Resultado da corrida:
```
26 anos: vivos=95 nascimentos=96 mortes=1 ancestrais=1 famílias=5
demografia: idade média 21.6 · geração média 1.91 · riqueza média 160.7
            crianças 50 adultos 45 idosos 0
```

`npm run build` — OK.

## Limitações

- **A corrida de verificação é de 26 anos, não de 200.** O arco completo do
  briefing (ano 100 pobre → ano 200 rico) é o que os mecanismos *permitem*; não
  foi observado ponta a ponta numa única corrida longa. Rodar
  `tests/journey.smoke.ts` com `JOURNEY_YEARS=250` é o caminho.
- **Sem propriedade produtiva.** Herança de "negócio" hoje significa herdar a
  *vaga de trabalho*, não o prédio. Não existe titularidade de edifício por
  cidadão para transmitir.
- **Herança só dentro da mesma cidade.** Um filho que já emigrou não recebe nada;
  o espólio fica com quem ficou.
- **Sem educação.** O canal "oportunidade" é só dinheiro e vaga aberta.
- **`familyTrade` guarda um ofício só.** Uma casa que fazia duas coisas registra
  a última.
- **Idosos não são sustentados pela família explicitamente** — vivem da despensa
  do domicílio como qualquer membro, mas nada modela cuidado ou dependência.
- **`historic` ainda não é atribuído por nenhum papel** além de fundador de
  cidade, como pedido.
