# CULT-V1 — Culturas vivas, difusão, mistura e identidade

`Culture.ts` já modelava o que um **reino** valoriza — militarismo, abertura,
trauma de guerra — alimentando leis, tarifas e satisfação de facções. Isso é
propriedade de um Estado e muda quando o Estado muda.

CULT-V1 é outra coisa: **quem uma população é**. Vive no cidadão, é herdada pela
família, viaja junto quando as pessoas migram, e não muda porque uma fronteira se
moveu.

**Arquivo novo:** `src/civ/CulturalIdentity.ts` (~360 linhas).
**Arquivos tocados:** `Entity.ts`, `City.ts`, `EntityAI.ts`, `CivilizationEngine.ts`,
`ArchitecturalProfile.ts`, `SaveSystem.ts`.

---

## 1. Modelo cultural

Três peças, todas pequenas:

```
CulturalIdentity  id · nome · parentId · foundedYear · homeCityId
                  lineageDepth · lean (viés leve que a arquitetura lê)
cidadão           cultureId · localAffinity (0..1, quanto o lugar impregnou)
assentamento      cultureMix (frações somando 1) · dominantCultureId
                  culturallySettledSince
```

`CultureRegistry` guarda todas as identidades e serializa inteiro. Culturas nunca
são deletadas — uma que perdeu o último falante permanece no registro, porque o
Chronicle se refere a ela e uma cultura morta é fato histórico, não vazamento. O
teto está na **criação** (`MAX_CULTURES = 48`).

Nada de cultura aleatória por cidadão. Um cidadão sem cultura recebe a do chão
onde está.

## 2. Cultura regional

`City.cultureMix` é um cache de frações, reconstruído **uma vez por ano** durante
a caminhada anual que SOC-V2/V3 já faziam. Não há passada nova, nem recálculo por
frame, nem comparação entre cidadãos.

`CultureCensus` acumula durante o laço; `publishCultures()` escreve o resultado ao
final. A assimilação lê a composição **do ano anterior** (já gravada na cidade)
enquanto a deste ano é acumulada ao lado — uma passada só, e nunca uma tabela
meio-atualizada sendo lida no meio da contagem.

Medido no smoke: `Verdenses 20% · Portelanos 80%`.

## 3. Cultura ≠ Reino

Satisfeito **por construção**: `cultureId` está no cidadão, `kingdomId` está no
cidadão, e nenhum caminho de código escreve um a partir do outro. Conquista muda
`city.kingdomId` e `entity.kingdomId`; a cultura não é tocada.

Verificado no smoke: 30 pessoas, troca de reino, um ano de simulação — **0
conversões**.

Um reino pode conter várias culturas (`cultureMix` da cidade); uma cultura pode
existir em vários reinos (nada amarra `homeCityId` a um reino).

## 4. Transmissão geracional (SOC-V3)

`inheritCulture(pai, mãe, mix local, dominante local)`:

```
chance de pegar a cultura LOCAL em vez da família =
    min(0.8,  parcelaLocal × (1 − parcelaDaFamília) × 0.55
            + afinidadeDosPais × 0.25)
```

Os pais dominam, mas uma criança criada onde a cultura da família é minoria
pequena tem chance real de crescer pertencendo à maioria. **Essa única
probabilidade é a assimilação inteira** — não há sistema de assimilação separado.

Medido (400 amostras cada):

| Situação | Filhos que mantêm a cultura da família |
|---|---|
| família é 90% da cidade | 400/400 |
| família é 8% da cidade | ~330/400 (o resto adota a local) |

Nunca 0/400 — nada aqui é automático.

## 5. Migração

Automática: `cultureId` está no cidadão, então `relocateCitizen` (SOC-V2) e os
dois caminhos coloniais da `CivilizationEngine` já levam a cultura junto. A
cultura A passa a existir em B no ano da mudança; as gerações seguintes decidem
se mantêm, misturam ou assimilam.

Base para MIG-V1 pronta: quem migra e qual cultura chega já são dados existentes.

## 6. Difusão

Culturas alcançam terreno novo do jeito que realmente alcançam: **alguém as
carrega até lá**. Os canais implementados são migração, colonização e nascimento.
Não há campo de distância nem espalhamento matemático — exatamente o que o
briefing proíbe.

Comércio e proximidade **não** foram implementados como canais — ver Limitações.

## 7. Assimilação

`assimilate(cidadão, mix, dominante, registry, estabilidade)`, uma vez por ano:

```
taxa = 0.05
     × (parcelaLocal − parcelaPrópria, mínimo 0.15)
     × (0.4 + proximidadeCultural × 1.2)
     × (0.5 + estabilidade × 0.8)
```

`localAffinity` sobe por essa taxa. Trocar de identidade exige **três** coisas ao
mesmo tempo: `localAffinity ≥ 0.85`, `localGenerations ≥ 1` (ou seja, não ser
quem chegou), e um sorteio de 25%.

Consequência verificada: um recém-chegado de primeira geração viveu **60 anos**
absorvendo a cidade e morreu com a identidade de origem. O **filho**, criado ali,
virou.

Viver entre os seus **desfaz** a impregnação (−0.03/ano).

Nunca existe `conquista → todos mudam`.

## 8. Mistura

`considerEmergence` só produz híbrido quando **todas** valem:

- população ≥ 25 (`EMERGENCE_POPULATION`)
- ≥ 40 anos culturalmente estáveis (`EMERGENCE_YEARS`)
- **duas** culturas com ≥ 25% cada (`HYBRID_MIN_SHARE`)
- nenhuma das duas já descende da outra

Sem isso, todo porto movimentado do mundo geraria uma cultura. Uma mistura
pequena não vira nada.

Quem adota a nova identidade: apenas residentes das culturas-mãe, naquela cidade,
que já haviam se misturado (`localAffinity > 0.35`) ou por sorteio de 40%.

## 9. Divergência

Mesma função, segundo caminho:

- população ≥ 25, ≥ 40 anos estáveis
- **isolado** da terra natal da cultura
- ≥ 55% dos residentes com linhagem enraizada (`localGenerations ≥ 3`, SOC-V3)
- profundidade de linhagem da cultura-mãe < 4

"Isolado" é definido politicamente, não por distância: a cidade natal da cultura
**não compartilha reino** com esta. Distância sozinha não é isolamento — um
Estado comum, estradas e comércio é o que mantém uma população ligada ao velho
país.

A nova cultura é uma **filha** (`parentId`), não uma estranha, e `distance()`
reflete isso: assimilar-se a um ramo irmão é rápido, a um estranho é lento.

## 10. Colônias

Integra com COL-V1/V2/V3 sem duplicar nada, apoiada na profundidade de linhagem
que SOC-V3 já mantinha:

```
1ª geração   colonos, localGenerations = 0, cultura da metrópole
2ª geração   nascidos na colônia, localGenerations = 1
3ª geração   localGenerations = 2
4ª geração   localGenerations = 3 → conta para rootedShare
             se a colônia já for politicamente separada → DIVERGÊNCIA
             → "Aurélios de Nova Aurélia"
```

Independência política e divergência cultural são **independentes**: a
divergência exige `isolated` (reinos diferentes) — que pode vir de independência,
mas também de uma colônia transferida ou perdida — e nada obriga as duas a
acontecerem juntas nem na mesma ordem.

## 11. Cultura e arquitetura (CITY-V3)

`refreshArchitecturalProfile` ganhou um parâmetro opcional `identityLean`. A
`CivilizationEngine` passa o `lean` da cultura dominante da cidade; ele é somado
**por cima** dos valores do reino, não substitui.

Nada troca instantaneamente:

- a assinatura do perfil inclui `dominantCultureId`, então o perfil só é
  recalculado quando a cultura dominante muda de fato;
- `buildingArchitecturalStamp` já congelava o carimbo **no ano da construção** —
  prédios antigos preservam a cultura que os ergueu.

Resultado: uma cidade conquistada continua construindo como o seu povo, não como
a sua nova bandeira, e o seu tecido urbano acumula camadas de épocas culturais
diferentes. Nenhum sprite novo; ART-V1/V2 continua sendo a fonte.

## 12. Identidade local

Uma variação regional não exige cultura nova. `lean` + `localAffinity` cobrem a
maior parte; só o que passa pelos limiares de §8/§9 vira `CulturalIdentity`
própria. `lineageDepth < 4` impede uma escada infinita de variantes.

## 13. Relação com o Estado

Disponível para POL-V2 sem nada político implementado: `city.cultureMix` dá
maioria e minorias por assentamento, e a união dos `cultureMix` das cidades de um
reino dá a composição do reino. Regiões culturalmente diferentes dentro do mesmo
Estado são o caso normal, não a exceção.

## 14. Tensão cultural

Fundação apenas: `registry.distance(a, b)` responde "quão alheias são estas duas
culturas". **Nada** neste sistema converte diferença em conflito. Nenhum modifier
de guerra, ódio, repressão ou revolta foi adicionado. Diversidade não vira guerra
automática.

## 15. Chronicle

Registra **apenas** o surgimento de uma cultura nova — híbrido ou divergência —
com o nome, a cidade e quantas pessoas a adotaram, como evento `major`. Nenhum
cidadão mudando de influência aparece no histórico.

## 16. Mapa cultural

**Não implementado.** `src/renderer/Renderer.ts` está sendo editado por outro
processo e no momento não compila (152 inserções, 138 remoções, `drawTerrainEdges`
cortado no meio). Adicionar um `OverlayMode` exigiria tocar esse arquivo e
conflitaria com o trabalho em andamento.

Os dados estão prontos e são públicos: `city.cultureMix`, `city.dominantCultureId`
e `sim.cultures`. Um overlay é uma função de leitura quando o arquivo estabilizar.

## 17. Performance

| Custo | Cadência | Limite |
|---|---|---|
| assimilação | 1×/ano/cidadão | O(1) — uma leitura do mix da cidade |
| censo cultural | dobrado no laço anual existente | zero passadas novas |
| publicação do mix | 1×/ano/cidade **com residentes** | O(culturas presentes) |
| emergência | 1×/ano/cidade | limiares que levam décadas |
| conversão em emergência | só quando uma cultura nasce | uma varredura da cidade |

Nenhum cidadão é comparado com outro. Não há grafo cultural. O registro tem teto
rígido de 48. HOT/WARM/COLD intacto — nada de CULT-V1 roda por tick.

Regiões SLEEPING: a atualização cultural é anual e agregada por cidade, então uma
região dormente evolui pelo mesmo caminho agregado que uma ativa — não há
caminho por-cidadão-por-tick para desligar.

## 18. Save

Persistido: registro de culturas (inteiro), `cultureId` e `localAffinity` do
cidadão, `dominantCultureId` e `culturallySettledSince` da cidade.

**Não** persistido: `city.cultureMix` — é cache e se reconstrói no primeiro censo
após o load.

Saves anteriores ao CULT-V1 carregam com registro vazio e cidadãos sem cultura; o
primeiro censo dá a cada um a cultura do assentamento onde está.

## Teste

```bash
npx tsx tests/cult-v1.smoke.ts
```

Cobre: linhagem e distância cultural; herança família-vs-rua nos dois extremos
(400 amostras cada); assimilação gradual — recém-chegado que nunca muda em 60
anos, filho criado ali que muda, reversão entre os seus, cultura irmã absorvida
mais rápido; limiares de emergência (população, tempo, minoria simbólica, colônia
ainda ligada, registro cheio); híbrido e divergência colonial; acumulador do
censo; e a corrida real de 24 anos com cidade multicultural, conquista sem
conversão, round-trip de save e save legado.

Resultado: `24 anos · 81 pessoas · culturas=2 · Verdenses 20% · Portelanos 80%`

Também rodados sem regressão: `soc-v2.smoke`, `soc-v3.smoke`,
`colonisation-v3.smoke`, `city-v6.smoke`. `npm run build` — OK.

## Limitações

- **Difusão por comércio e proximidade não implementada.** Cultura só se move com
  pessoas. Um canal de comércio exigiria uma tabela de exposição por cidade e por
  cultura, que V1 não carrega. Migração, colonização e nascimento são os canais
  reais e estão feitos.
- **Overlay cultural não entregue** — ver §16. Bloqueado por edição externa em
  `Renderer.ts`, não por dificuldade.
- **`localAffinity` é escalar**, não por cultura. Um cidadão numa cidade com três
  culturas absorve "o lugar", não cada uma separadamente.
- **Emergência só considerada em cidades com residentes contados no ano.** Uma
  cidade vazia ou dormente sem entidades não gera cultura — correto, mas
  significa que populações abstraídas não participam.
- **Nomes de cultura são gerados de forma mecânica** (`Povo de X`,
  `A-B de X`, `A de X`). Legíveis, não bonitos.
- **Corrida de verificação é de 24 anos.** Híbrido e divergência exigem 40+ anos
  estáveis e população ≥25, então foram verificados por unidade
  (`considerEmergence` com contextos construídos), não observados numa corrida
  longa. Rodar `tests/journey.smoke.ts` com `JOURNEY_YEARS=300` é o caminho para
  vê-los emergir sozinhos.
- **`lean` não é preenchido para culturas fundadoras** — nasce vazio e só ganha
  valores por deriva em divergências. O efeito arquitetônico existe mas é sutil
  até haver ramificação.
