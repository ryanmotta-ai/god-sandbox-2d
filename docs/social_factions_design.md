# Design Document: Sistema de Facções Sociais Internas — Aethoria 2D God Sandbox

## 1. Visão Geral e Filosofia de Design

O objetivo do **Sistema de Facções Sociais Internas** é transformar os reinos de *Aethoria* em entidades políticas orgânicas, vivas e dinâmicas por dentro. Em vez de reinos agirem como blocos monolíticos sob o comando de um único governante, cada sociedade abriga grupos de interesse concorrentes com visões de mundo, necessidades econômicas e ambições políticas próprias.

O sistema conecta o desenvolvimento da população (profissões, comida, riqueza), as infraestruturas (fazendas, minas, mercados, bibliotecas, quartéis) e a cultura às decisões do estado (impostos, guias de governo, declarações de guerra e tratados de paz).

---

## 2. As 9 Facções Sociais Principais

---

### 🌾 2.1 Camponeses (Peasants)
- **Representação**: A grande massa de trabalhadores rurais, agricultores e pastores que produzem os alimentos do reino.
- **Origem da Influência**: Proporção da população rural total, suprimento de comida e densidade de fazendas/graneiros.
- **O que Aumenta Satisfação**: Abundância de comida, paz prolongada, baixos impostos agrícolas e investimentos em graneiros.
- **O que Reduz Satisfação**: Fome, recrutamento forçado para guerras, pilhagem de terras e impostos abusivos.
- **Governos que Apoia**: República (se representativa), Estado Comunista (promessa de redistribuição), Tribo (subsistência comunitária).
- **Governos que Rejeita**: Reino Feudal (servidão pesada), Império (opressão fiscal), Estado Capitalista (desigualdade rural).
- **Reação à Guerra**: Fortemente pacifistas. Perdem satisfação rapidamente quando as guerras duram mais de 2 anos.
- **Reação à Fome**: Extrema radicalização. Fome provoca motins de fome e revoltas agrárias imediatas.
- **Reação a Impostos Altos**: Redução acelerada de lealdade e sonegação agrícola.
- **Reação ao Comércio**: Neutros a moderadamente favoráveis se o comércio trouxer ferramentas baratas.
- **Reação à Desigualdade**: Alta rejeição quando os nobres acumulam riqueza enquanto o campo passa fome.
- **Eventos Causados**: Jacquerie (Revolta Camponesa), Motim do Pão, Sonegação de Safras, Recusa de Recrutamento.

---

### 🛡️ 2.2 Nobres (Nobles)
- **Representação**: A aristocracia proprietária de terras, dinastias hereditárias e senhores feudais.
- **Origem da Influência**: Tamanho do território controlado, nível da dinastia real, castelos (`keep`) e palácios (`palace`).
- **O que Aumenta Satisfação**: Manutenção dos privilégios feudais, governantes da própria dinastia, baixos impostos sobre fortunas e conquistas territoriais.
- **O que Reduz Satisfação**: Leis de centralização do poder, impostos sobre terras, revoluções republicanas ou comunistas, governantes sem linhagem.
- **Governos que Apoia**: Reino Feudal, Monarquia, Império.
- **Governos que Rejeita**: República, Estado Capitalista, Estado Comunista.
- **Reação à Guerra**: Entusiastas no início (busca por glória e terras), mas hostis se a guerra falhar e trouxer derrotas.
- **Reação à Fome**: Indiferentes no início, mas temerosos de revoltas populares.
- **Reação a Impostos Altos**: Extrema rejeição; patrocinam conspirações e guerras civis de sucessão.
- **Reação ao Comércio**: Céticos se o comércio enriquecer a burguesia mercantil mais do que os proprietários de terras.
- **Reação à Desigualdade**: Favoráveis à desigualdade que os favorece.
- **Eventos Causados**: Conspiração dos Barões, Guerra de Sucessão Dynástica, Crise de Legitimidade, Golpe da Corte.

---

### 🪙 2.3 Mercadores (Merchants)
- **Representação**: A burguesia comercial, mestres caravaneiros, donos de mercados e financistas.
- **Origem da Influência**: Volume de comércio externo e interno, número de rotas comerciais, infraestrutura (mercados, bancos, portos) e tesouro do reino.
- **O que Aumenta Satisfação**: Abertura de novas rotas comerciais, paz internacional, tarifas baixas e estabilidade monetária.
- **O que Reduz Satisfação**: Embargos diplomáticos, pirataria/bandidagem nas estradas, guerras que fecham fronteiras e inflação.
- **Governos que Apoia**: Estado Capitalista, Monarquia Constitucional, República.
- **Governos que Rejeita**: Estado Comunista, Tribo, Chefia.
- **Reação à Guerra**: Muito hostis se a guerra interromper rotas de comércio; favoráveis apenas se for uma guerra por recursos valiosos.
- **Reação à Fome**: Veem oportunidade de lucro com importações, mas temem instabilidade.
- **Reação a Impostos Altos**: Promovem fuga de capital e contrabando.
- **Reação ao Comércio**: Entusiastas máximos.
- **Reação à Desigualdade**: Tolerantes, desde que haja mobilidade econômica.
- **Eventos Causados**: Fuga de Capitais, Fundação de Liga Comercial, Sonegação de Tarifas, Financiamento de Golpe Mercantil.

---

### ⚔️ 2.4 Militares (Military)
- **Representação**: A corporação dos soldados profissionais, oficiais do exército, generais e guardas de elite.
- **Origem da Influência**: Proporção de soldados na população, número de quartéis (`barracks`), orçamento de defesa e poder militar.
- **O que Aumenta Satisfação**: Altos investimentos em defesa, presença do Rei/Geral no campo de batalha, vitórias militares e tecnologia de guerra.
- **O que Reduz Satisfação**: Cortar o orçamento de defesa, assinaturas de paz desequilibradas após vitórias, derrota militar humilhante e falta de equipamentos.
- **Governos que Apoia**: Império, Reino Feudal, Estado Comunista (militarizado), Monarquia.
- **Governos que Rejeita**: República (pacifista), Monarquia Constitucional (relutante em lutar).
- **Reação à Guerra**: Entusiastas máximos. A guerra é a razão da sua existência e ganho de prestígio.
- **Reação à Fome**: Exigem prioridade absoluta na distribuição de suprimentos sobre os civis.
- **Reação a Impostos Altos**: Tolerantes se os impostos forem destinados ao orçamento militar.
- **Reação ao Comércio**: Favoráveis se o comércio trouxer ferro, cavalos e armas.
- **Reação à Desigualdade**: Neutros, preocupados apenas com a hierarquia militar.
- **Eventos Causados**: Golpe de Estado Militar (Junta Militar), Pronunciamento dos Generais, Motim das Tropas, Exigência de Gastos Militares.

---

### ⚒️ 2.5 Artesãos & Operários (Craftsmen & Workers)
- **Representação**: Os trabalhadores urbanos, ferreiros, tecelões, mineiros e operários de fábricas.
- **Origem da Influência**: Quantidade de oficinas (`workshop`), ferramentarias (`smithy`), minas (`mine`) e fábricas (`factory`).
- **O que Aumenta Satisfação**: Fornecimento constante de matérias-primas (ferro, madeira, carvão), bons salários, pleno emprego e tecnologia de manufatura.
- **O que Reduz Satisfação**: Falta de matérias-primas, desemprego urbano, jornadas exaustivas em fábricas e inflação de alimentos.
- **Governos que Apoia**: Estado Comunista, República, Monarquia Constitucional.
- **Governos que Rejeita**: Reino Feudal, Tribo, Chefia.
- **Reação à Guerra**: Moderadamente hostis se a guerra desviar matérias-primas para suprimentos de campanha em vez de oficinas.
- **Reação à Fome**: Alta insatisfação; promovem greves e distúrbios urbanos.
- **Reação a Impostos Altos**: Insatisfação elevada se os impostos incidirem sobre produtos manufaturados.
- **Reação ao Comércio**: Favoráveis se o comércio trouxer matérias-primas baratas.
- **Reação à Desigualdade**: Muito insatisfeitos em sistemas onde os donos das indústrias enriquecem sem reajuste salarial.
- **Eventos Causados**: Greve Geral da Indústria, Quebra das Máquinas (Ludismo), Criação de Sindicato/Guilda, Sabotagem de Produção.

---

### 📚 2.6 Sábios & Sacerdotes (Scholars & Clergy)
- **Representação**: Os filósofos, cientistas, acadêmicos, líderes espirituais e sacerdotes de templos.
- **Origem da Influência**: Bibliotecas (`library`), academias (`academy`), templos (`temple`), nível tecnológico e presença de Grandes Eruditos.
- **O que Aumenta Satisfação**: Financiamento contínuo para pesquisa, construção de infraestrutura de saber, liberdade de pensamento e respeito às crenças.
- **O que Reduz Satisfação**: Perseguição ideológica, destruição de bibliotecas em guerras, governantes obscurantistas e desrespeito às crenças.
- **Governos que Apoia**: Monarquia Constitucional, República, Monarquia (esclarecida).
- **Governos que Rejeita**: Estado Comunista (se ateu/anti-religioso), Chefia (primitiva), Império (opressor).
- **Reação à Guerra**: Geralmente pacifistas ou críticos da destruição violenta de vidas e conhecimento.
- **Reação à Fome**: Prestam assistência e exigem moderação do estado.
- **Reação a Impostos Altos**: Hostis se os impostos incidirem sobre instituições de ensino e templos.
- **Reação ao Comércio**: Favoráveis ao intercâmbio de conhecimento e livros.
- **Reação à Desigualdade**: Moderadamente críticos sob a ótica moral ou ética.
- **Eventos Causados**: Renascimento Cultural, Cisma Religioso, Protesto Acadêmico, Queimada de Livros por Heresia.

---

### 🌲 2.7 Fronteiriços & Colonos (Frontiersmen & Settlers)
- **Representação**: As populações das cidades distantes, assentamentos coloniais recentes e territórios de fronteira.
- **Origem da Influência**: Distância física em relação à capital do reino, número de cidades coloniais secundárias e terras não desbravadas.
- **O que Aumenta Satisfação**: Autonomia local, proteção militar contra bandidos e monstros, investimentos em estradas e incentivos à colonização.
- **O que Reduz Satisfação**: Negligência da capital, cobrança de impostos sem proteção militar, leis impostas de fora e centralização imperial.
- **Governos que Apoia**: República (federativa), Tribo, Monarquia Constitucional.
- **Governos que Rejeita**: Império (centralizador), Estado Comunista (planejamento central rígido).
- **Reação à Guerra**: Muito vulneráveis a invasões; exigem tropas de defesa nas fronteiras.
- **Reação à Fome**: Se desamparados pela capital, declaram secessão para buscar sobrevivência por conta própria.
- **Reação a Impostos Altos**: Extrema rejeição. É o principal estopim para declarações de independência.
- **Reação ao Comércio**: Muito favoráveis ao comércio transfronteiriço com reinos vizinhos.
- **Reação à Desigualdade**: Rejeitam o favorecimento da cidade capital sobre as províncias.
- **Eventos Causados**: Declaração de Secessão, Mandato de Autonomia Provincial, Aliança com Reino Vizinho, Contrabando de Fronteira.

---

### 📜 2.8 Burocratas & Administradores (Bureaucrats & Administrators)
- **Representação**: Os magistrados, arrecadadores de impostos, secretários de estado e juízes.
- **Origem da Influência**: Eficiência da arrecadação fiscal, leis escritas, tecnologia de escrita/matemática e tamanho da administração estatal.
- **O que Aumenta Satisfação**: Estabilidade política, cumprimento das leis, salários estatais em dia e governos estruturados.
- **O que Reduz Satisfação**: Anarquia, guerras civis, revoluções radicais, governantes imprevisíveis e corrupção descontrolada.
- **Governos que Apoia**: Monarquia, Monarquia Constitucional, Império, Estado Comunista.
- **Governos que Rejeita**: Tribo, Chefia, anarquias transitórias.
- **Reação à Guerra**: Preocupados com o impacto orçamentário e a logística administrativa.
- **Reação à Fome**: Tentam implementar racionamento e cotas públicas de suprimento.
- **Reação a Impostos Altos**: São os executores dos impostos; satisfeitos se a arrecadação for eficiente.
- **Reação ao Comércio**: Favoráveis a tarifas regulamentadas que gerem receita para o tesouro.
- **Reação à Desigualdade**: Neutros em relação à ética, focados na arrecadação tributária.
- **Eventos Causados**: Paralisia Burocrática, Escândalo de Corrupção Fiscal, Reforma da Arrecadação, Auditoria do Tesouro.

---

### 🚩 2.9 Reformistas & Revolucionários (Reformers & Revolutionaries)
- **Representação**: Movimentos ideológicos radicais, intelectuais dissidentes e facções clandestinas de mudança social.
- **Origem da Influência**: Nível de desigualdade social, fome prolongada, baixa estabilidade política e surgimento da tecnologia da Imprensa.
- **O que Aumenta Satisfação**: Mudança para formas de governo mais avançadas/iguais, redução da desigualdade e ampliação de direitos.
- **O que Reduz Satisfação**: Repressão absolutista, privilégios feudais inabaláveis, desigualdade extrema e censura.
- **Governos que Apoia**: República, Estado Comunista, Estado Capitalista (se transicionando da Monarquia).
- **Governos que Rejeita**: Monarquia, Império, Reino Feudal, Chiefdom.
- **Reação à Guerra**: Rejeitam guerras imperiais, mas aproveitam crises de guerra para deflagrar revoluções internas.
- **Reação à Fome**: Usam o descontentamento popular para mobilizar a população em levantes armados.
- **Reação a Impostos Altos**: Denunciam a tirania fiscal e convocam o povo à rebelião.
- **Reação ao Comércio**: Variável (críticos no comunismo, entusiastas no capitalismo).
- **Reação à Desigualdade**: Extrema indignação; a desigualdade é seu principal combustível.
- **Eventos Causados**: Revolução Popular, Golpe de Estado Ideológico, Manifesto dos Povos, Tomada do Palácio.

---

## 3. Modelo de Atributos das Facções

Cada facção dentro de um reino possui uma estrutura de dados de atributos dinâmicos (valores de `0.0` a `1.0`):

```typescript
export interface SocialFactionState {
  id: string; // Ex: 'peasants', 'nobles', 'merchants', 'military'
  influence: number; // 0.0 a 1.0: Peso político nas decisões do reino
  satisfaction: number; // 0.0 a 1.0: Contentamento com a gestão atual
  wealth: number; // 0.0 a 1.0: Recursos acumulados por esta classe
  loyalty: number; // 0.0 a 1.0: Lealdade à dinastia/governo vigente
  radicalization: number; // 0.0 a 1.0: Propensão a usar violência ou revolta
  warSupport: number; // 0.0 a 1.0: Disposição para apoiar guerras ativas
  reformSupport: number; // 0.0 a 1.0: Desejo de mudar a forma de governo
}
```

---

## 4. Impacto Sistêmico nas Dinâmicas do Reino

O estado das facções sociais altera diretamente o comportamento dos reinos e desencadeia dinâmicas geopolíticas e sociais:

```
                      +-----------------------------+
                      |   Estrutura Econômica &     |
                      |   Infraestrutura do Reino   |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Estado das Facções       |
                      |  (Influência/Satisfação)    |
                      +--------------+--------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +------------------+       +------------------+
| Estabilidade &   |       |  Geopolítica &   |       |  Transformação   |
|   Legitimidade   |       |  Guerra / Paz    |       |   do Governo     |
+------------------+       +------------------+       +------------------+
| * Revoltas       |       | * Apoio à Guerra |       | * Revoluções     |
| * Golpes de Córte|       | * Fuga de Capital|       | * Secessão Prov. |
| * Eficiência Tax |       | * Tratados de Paz|       | * Golpes Militares|
+------------------+       +------------------+       +------------------+
```

1. **Estabilidade do Reino (`kingdom.economy.stability`)**:
   - É calculada pela **média ponderada da satisfação de todas as facções**, onde os pesos são a `influence` de cada uma.
   - Se facções influentes tiverem satisfação $< 0.3$, a estabilidade despenca.

2. **Legitimidade do Governante (`kingdom.legitimacy`)**:
   - Derivada da lealdade combinada dos Nobres, Burocratas e Sacerdotes/Sábios.
   - Baixa legitimidade expõe o soberano a conspirações e assassinatos.

3. **Decisão de Guerra e Paz (`Diplomacy`)**:
   - Um reino só declara guerras de conquista se a facção dos **Militares** tiver `influence > 0.4` e `warSupport > 0.6`.
   - Se os **Mercadores** e **Camponeses** tiverem alta influência e satisfação baixa, o reino buscará acordos de paz rapidamente devido ao desgaste interno (`warWeariness`).

4. **Comércio & Economia (`Trade & Economy`)**:
   - Insatisfação dos **Artesãos** reduz a produção de manufaturados em 40%.
   - Insatisfação dos **Mercadores** reduz a receita das rotas de comércio em 60%.

5. **Rebeliões, Revoluções & Secessão**:
   - **Revolta Camponesa**: Satisfação dos Camponeses $< 0.2$ + Radicalização $> 0.7$.
   - **Golpe Militar**: Satisfação dos Militares $< 0.25$ + Influência $> 0.5$.
   - **Revolução Ideológica**: Satisfação dos Reformistas $< 0.2$ + Desigualdade $> 0.6$.
   - **Secessão de Cidades Distantes**: Satisfação dos Fronteiriços $< 0.25$ + Distância da Capital $> 25$ tiles.

---

## 5. Fórmulas de Balanceamento (Pseudocódigo TypeScript)

```typescript
// Pseudocódigo de Atualização Anual das Facções

export function updateFactionsTick(kingdom: Kingdom, world: CivWorld): void {
  const totalPop = Math.max(1, kingdom.totalPopulation);
  const cities = Array.from(kingdom.cityIds).map(id => world.cities.get(id)!);

  // 1. CÁLCULO DE INFLUÊNCIA BASE
  let peasantWeight = 0;
  let nobleWeight = 0;
  let merchantWeight = 0;
  let militaryWeight = 0;
  let workerWeight = 0;
  let scholarWeight = 0;
  let frontierWeight = 0;
  let bureaucratWeight = 0;
  let reformerWeight = 0;

  for (const city of cities) {
    peasantWeight += city.stock.get('food') + city.buildingsCount('farm') * 10;
    nobleWeight += city.buildingsCount('keep') * 25 + city.buildingsCount('palace') * 50;
    merchantWeight += city.stock.get('gold') + city.buildingsCount('market') * 15;
    militaryWeight += city.buildingsCount('barracks') * 20;
    workerWeight += city.buildingsCount('workshop') * 12 + city.buildingsCount('factory') * 30;
    scholarWeight += city.buildingsCount('library') * 15 + city.buildingsCount('academy') * 35;

    const distFromCapital = Math.hypot(city.x - world.capital.x, city.y - world.capital.y);
    if (distFromCapital > 25) frontierWeight += 30;
  }

  bureaucratWeight = kingdom.research.knows('writing') ? 40 : 10;
  reformerWeight = (kingdom.economy.inequality > 0.5 ? 40 : 10) + (kingdom.research.knows('printing_press') ? 30 : 0);

  const totalWeight = peasantWeight + nobleWeight + merchantWeight + militaryWeight +
                      workerWeight + scholarWeight + frontierWeight + bureaucratWeight + reformerWeight;

  // Atualizar influência normalizada (0..1)
  kingdom.factions.peasants.influence = peasantWeight / totalWeight;
  kingdom.factions.nobles.influence = nobleWeight / totalWeight;
  kingdom.factions.merchants.influence = merchantWeight / totalWeight;
  kingdom.factions.military.influence = militaryWeight / totalWeight;
  kingdom.factions.workers.influence = workerWeight / totalWeight;
  kingdom.factions.scholars.influence = scholarWeight / totalWeight;
  kingdom.factions.frontiersmen.influence = frontierWeight / totalWeight;
  kingdom.factions.bureaucrats.influence = bureaucratWeight / totalWeight;
  kingdom.factions.reformers.influence = reformerWeight / totalWeight;

  // 2. CÁLCULO DE SATISFAÇÃO & ESTABILIDADE
  const gov = GOVERNMENTS[kingdom.government];
  const taxRate = gov.taxRate;
  const isAtWar = world.diplomacy.getWarsFor(kingdom.id).length > 0;

  // Satisfação dos Camponeses: sensível à comida e impostos
  kingdom.factions.peasants.satisfaction = Math.min(1.0, Math.max(0.0,
    0.5 + (kingdom.foodSurplusRatio - 1.0) * 0.4 - taxRate * 0.8 - (isAtWar ? 0.2 : 0.0)
  ));

  // Satisfação dos Militares: sensível aos gastos militares e vitórias
  kingdom.factions.military.satisfaction = Math.min(1.0, Math.max(0.0,
    0.4 + (kingdom.militaryBudgetRatio - 1.0) * 0.3 + (isAtWar ? 0.3 : -0.1)
  ));

  // Satisfação dos Mercadores: sensível às rotas ativas e impostos
  kingdom.factions.merchants.satisfaction = Math.min(1.0, Math.max(0.0,
    0.5 + (kingdom.activeTradeRoutes * 0.1) - taxRate * 0.6 - (isAtWar ? 0.25 : 0.0)
  ));

  // Estabilidade Geral do Reino = Média Ponderada da Satisfação das Facções
  let overallStability = 0;
  for (const faction of Object.values(kingdom.factions)) {
    overallStability += faction.satisfaction * faction.influence;
  }
  kingdom.economy.stability = Math.min(1.0, Math.max(0.05, overallStability));
}
```

---

## 6. 20 Eventos Históricos Envolvendo Facções

### 1. 🍞 A Revolta do Pão (`Peasant Bread Riot`)
- **Condição**: Camponeses Satisfação $< 0.2$ e escassez de comida na capital.
- **Efeito Mecânico**: Perda de $-20\%$ de comida nos estoques e $-15\%$ de Estabilidade.
- **Crônica**: *"Massas famintas de camponeses tomaram os celeiros da capital exigindo pão!"*

### 2. 👑 A Conspiração dos Barões (`Barons' Conspiracy`)
- **Condição**: Nobres Satisfação $< 0.25$ e Influência dos Nobres $> 0.35$.
- **Efeito Mecânico**: Queda de $-30\%$ na Legitimidade do Rei e risco de guerra civil.
- **Crônica**: *"Os grandes barões do reino se reuniram em segredo para questionar o direito do rei ao trono."*

### 3. 🪙 Fuga de Capitais Mercantis (`Merchant Capital Flight`)
- **Condição**: Mercadores Satisfação $< 0.2$ e Impostos $> 25\%$.
- **Efeito Mecânico**: Redução de $-50\%$ na receita de comércio e fechamento de rotas caravaneiras.
- **Crônica**: *"Os grandes mercadores transferiram suas riquezas e caravanas para portos estrangeiros."*

### 4. ⚔️ O Pronunciamento dos Generais (`Generals' Pronunciamiento`)
- **Condição**: Militares Satisfação $< 0.2$ e Influência dos Militares $> 0.45$.
- **Efeito Mecânico**: O Exército destitui o governante e instala um Governo Militar (`empire` ou `feudal_kingdom`).
- **Crônica**: *"Os generais marcharam sobre a capital e assumiram o controle do conselho de estado!"*

### 5. ⚒️ A Greve Geral da Indústria (`Industrial General Strike`)
- **Condição**: Operários Satisfação $< 0.2$ e Presença de Fábricas ou Oficinas.
- **Efeito Mecânico**: Produção de bens de oficina e manufaturas cai a 0 por 2 anos.
- **Crônica**: *"Os ferreiros e tecelões cruzaram os braços, paralisando as oficinas e indústrias do reino."*

### 6. 📜 O Manifesto dos Reformistas (`Reformer Manifesto`)
- **Condição**: Reformistas Influência $> 0.3$ e Desigualdade $> 0.6$.
- **Efeito Mecânico**: Aumenta em $+40\%$ o apoio à transição para República ou Estado Comunista.
- **Crônica**: *"Panfletos revolucionários foram distribuídos pelas praças exigindo o fim dos privilégios reais."*

### 7. 🚩 A Secessão Providencial (`Provincial Secession`)
- **Condição**: Fronteiriços Satisfação $< 0.2$ e Distância da Capital $> 28$ tiles.
- **Efeito Mecânico**: A cidade distante se separa do reino e proclama um Estado Livre independente.
- **Crônica**: *"A província de fronteira declarou-se livre do domínio da capital e proclamou sua própria república!"*

### 8. 🎓 O Grande Cânone da Sabedoria (`Canon of Wisdom`)
- **Condição**: Sábios Satisfação $> 0.8$ e Presença de Academia.
- **Efeito Mecânico**: Concede $+300$ pontos de pesquisa imediata em todas as tecnologias disponíveis.
- **Crônica**: *"Os sábios da academia publicaram uma obra monumental que revolucionou as ciências do reino."*

### 9. 🏛️ A Liga Hanseática de Comércio (`Merchant Trade Pact`)
- **Condição**: Mercadores Satisfação $> 0.75$ e Rotas Comerciais $> 3$.
- **Efeito Mecânico**: Concede $+40\%$ no valor do ouro obtido por todas as caravanas comerciais.
- **Crônica**: *"Os mestres mercadores estabeleceram uma liga de livre comércio entre os maiores portos do mundo."*

### 10. 🧱 O Mutirão dos Construtores (`Architectural Boom`)
- **Condição**: Operários & Artesãos Satisfação $> 0.8$.
- **Efeito Mecânico**: Custo de construção de edifícios e muralhas reduzido em $-30\%$ por 5 anos.
- **Crônica**: *"Um espírito de maestria tomou conta das guildas de construtores, acelerando todas as obras públicas."*

### 11. ⚖️ A Reforma Burocrática (`Bureaucratic Fiscal Reform`)
- **Condição**: Burocratas Satisfação $> 0.75$ e Tecnologia de Escrita.
- **Efeito Mecânico**: Arrecadação de impostos aumenta em $+20\%$ sem reduzir a satisfação popular.
- **Crônica**: *"Os magistrados reformaram o sistema tributário, eliminando desvios e otimizando o tesouro."*

### 12. 🌾 A Abundância dos Campos (`Peasant Harvest Jubilee`)
- **Condição**: Camponeses Satisfação $> 0.85$ e Anos sem Fome $> 5$.
- **Efeito Mecânico**: Crescimento populacional das cidades rurais aumenta em $+35\%$.
- **Crônica**: *"Campos abençoados e agricultores contentes trouxeram uma era de ouro na produção de alimentos."*

### 13. 🏴‍☠️ A Emboscada dos Desertores (`Deserter Banditry`)
- **Condição**: Militares Satisfação $< 0.25$ e Desgaste de Guerra $> 60$.
- **Efeito Mecânico**: Soldados abandonam o exército e tornam-se bandidos, saqueando caravanas de comércio.
- **Crônica**: *"Veteranos amargurados desertaram das fileiras e organizaram bandos de saqueadores nas estradas."*

### 14. 📖 A Queimada dos Manuscritos (`Purge of Heretical Texts`)
- **Condição**: Sábios Satisfação $< 0.3$ e Revolução Conservadora.
- **Efeito Mecânico**: Perda de $-150$ pontos de pesquisa e destruição de livros da biblioteca.
- **Crônica**: *"Fanáticos religiosos e zelotes estatais queimaram volumes inestimáveis da grande biblioteca."*

### 15. 🛑 O Embargo das Guildas (`Guild Embargo`)
- **Condição**: Mercadores Satisfação $< 0.3$ e Guerra de agressão impopular.
- **Efeito Mecânico**: Recusa em financiar os custos de campanha militar do soberano.
- **Crônica**: *"As guildas comerciais recusaram-se a conceder empréstimos para financiar a guerra do rei."*

### 16. 🪓 O Levante dos Silvicultores (`Lumberjack Timber Revolt`)
- **Condição**: Artesãos Satisfação $< 0.25$ e Escassez de Madeira.
- **Efeito Mecânico**: Paralisação do fornecimento de madeira para estaleiros e edifícios por 2 anos.
- **Crônica**: *"Os lenhadores ocuparam as matas reais recusando-se a derrubar madeira para a frota do reino."*

### 17. 👑 A Carta Magna dos Direitos (`Magna Carta Signing`)
- **Condição**: Nobres Satisfação $< 0.3$ e Rei aceita negociar para evitar deposição.
- **Efeito Mecânico**: Transição de Monarquia Absoluta para Monarquia Constitucional com $+40\%$ de Estabilidade.
- **Crônica**: *"Pressionado pelos barões, o soberano assinou a Grande Carta de Direitos limitando o poder da coroa."*

### 18. 🏭 A Revolta dos Quebradores de Máquinas (`Luddite Riots`)
- **Condição**: Operários Satisfação $< 0.3$ e Tecnologia de Industrialização recente.
- **Efeito Mecânico**: Danos físicos a edifícios do tipo Fábrica e paralisação fabril.
- **Crônica**: *"Operários enfurecidos invadiram as novas fábricas destruindo os maquinários a marteladas."*

### 19. 🕊️ O Clamor pela Paz (`Peasants' Peace Crusade`)
- **Condição**: Camponeses Satisfação $< 0.2$ e Guerra ativa durando mais de 4 anos.
- **Efeito Mecânico**: Desgaste de Guerra (`warWeariness`) aumenta em $+25$ pontos adicionais.
- **Crônica**: *"As famílias do campo marcharam diante do palácio exigindo o retorno dos seus filhos e o fim da guerra."*

### 20. 🗽 A Proclamação da República Popular (`People's Republic Proclamation`)
- **Condição**: Reformistas Influência $> 0.4$, Desigualdade $> 0.7$ e Fome Ativa.
- **Efeito Mecânico**: Deposição da dinastia real e adoção imediata do governo de República ou Estado Comunista.
- **Crônica**: *"A bastilha caiu! Os revolucionários hastearam a bandeira do povo e proclamaram a República!"*

---

## 7. Recomendação de MVP (Fase 1 de Implementação)

Para garantir que o sistema entre no jogo de forma **estável, realista e sem comprometer a performance**, recomenda-se a seguinte estratégia de implementação gradual:

### 🏆 7.1 As 4 Facções Essenciais para o MVP (Fase 1)
1. **Camponeses (`peasants`)**: Representam a base alimentar, a massa rural e o termômetro da fome.
2. **Nobres (`nobles`)**: Representam a estabilidade dynástica, a legitimidade e a resistência a reformas.
3. **Mercadores (`merchants`)**: Representam a riqueza, as caravanas comerciais e a economia monetária.
4. **Militares (`military`)**: Representam a força de agressão, defesa e os riscos de golpe militar.

### 🔑 7.2 Variáveis Essenciais no Estado do Reino
- `faction.influence` (0.0 a 1.0)
- `faction.satisfaction` (0.0 a 1.0)
- `kingdom.economy.stability` (derivado da média ponderada da satisfação)

### ⏳ 7.3 Interações Posteriores (Fase 2)
- Facções secundárias (Fronteiriços, Burocratas, Reformistas, Sábios e Operários).
- Sistema avançado de assembleias legislativas e votações de leis da corte.
- Facções religiosas/culturais específicas por espécie.

---

*Documento de Design elaborado com foco em realismo sistêmico, emergência orgânica e compatibilidade total com a arquitetura de simulação de Aethoria 2D God Sandbox.*
