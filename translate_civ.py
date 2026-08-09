import re

def translate(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    replacements = [
        # L1989
        (r"`Bread riots shook \$\{kingdom\.name\} as hungry peasants forced open local granaries\.`", 
         r"`Tumultos por pão abalaram ${kingdom.name} quando camponeses famintos arrombaram celeiros locais.`"),
        (r"`Bread Riots in \$\{kingdom\.name\}`", 
         r"`Tumultos por Pão em ${kingdom.name}`"),
        (r"'Hunger, low peasant satisfaction and high radicalisation converged.'", 
         r"'Fome, baixa satisfação dos camponeses e alta radicalização convergiram.'"),
        (r"'Stability and legitimacy fell as peasants forced open granaries.'", 
         r"'A estabilidade e a legitimidade caíram à medida que os camponeses arrombavam celeiros.'"),
        (r"`Unrest in \$\{kingdom\.name\}`", 
         r"`Inquietação em ${kingdom.name}`"),
         
        # L2012
        (r"`Powerful nobles in \$\{kingdom\.name\} gathered in secret to challenge the ruler's authority\.`", 
         r"`Nobres poderosos em ${kingdom.name} reuniram-se em segredo para desafiar a autoridade do governante.`"),
        (r"`Noble Conspiracy in \$\{kingdom\.name\}`", 
         r"`Conspiração da Nobreza em ${kingdom.name}`"),
        (r"'Influential nobles became dissatisfied and radicalised.'", 
         r"'Nobres influentes tornaram-se insatisfeitos e radicalizados.'"),
        (r"'The ruler's authority and realm stability were undermined.'", 
         r"'A autoridade do governante e a estabilidade do reino foram enfraquecidas.'"),
         
        # L2036
        (r"`Merchant houses in \$\{kingdom\.name\} moved capital out of reach of the treasury\.`", 
         r"`Casas mercantis em ${kingdom.name} moveram capital para fora do alcance do tesouro.`"),
        (r"`Capital Flight in \$\{kingdom\.name\}`", 
         r"`Fuga de Capital em ${kingdom.name}`"),
        (r"'Merchant dissatisfaction coincided with tax or trade pressure.'", 
         r"'A insatisfação dos mercadores coincidiu com pressão fiscal ou comercial.'"),
        (r"'Treasury reserves and stability declined.'", 
         r"'As reservas do tesouro e a estabilidade diminuíram.'"),
         
        # L2060
        (r"`Officers in \$\{kingdom\.name\} issued a public warning to the court over the state of the army\.`", 
         r"`Oficiais em ${kingdom.name} emitiram um aviso público à corte sobre o estado do exército.`"),
        (r"`Military Warning in \$\{kingdom\.name\}`", 
         r"`Aviso Militar em ${kingdom.name}`"),
        (r"'Military dissatisfaction and coup risk reached a dangerous level.'", 
         r"'A insatisfação militar e o risco de golpe atingiram um nível perigoso.'"),
        (r"'The court lost stability and legitimacy.'", 
         r"'A corte perdeu estabilidade e legitimidade.'"),
         
        # L2084
        (r"`Guilds and workshops in \$\{kingdom\.name\} slowed production in protest\.`", 
         r"`Guildas e oficinas em ${kingdom.name} desaceleraram a produção em protesto.`"),
        (r"`Industrial Protest in \$\{kingdom\.name\}`", 
         r"`Protesto Industrial em ${kingdom.name}`"),
        (r"'Worker dissatisfaction rose inside an industrialising economy.'", 
         r"'A insatisfação dos trabalhadores aumentou dentro de uma economia em industrialização.'"),
        (r"'Production slowed and the treasury lost revenue.'", 
         r"'A produção desacelerou e o tesouro perdeu receita.'"),
         
        # L2107
        (r"`Reformist circles in \$\{kingdom\.name\} circulated manifestos calling for a new political order\.`", 
         r"`Círculos reformistas em ${kingdom.name} circularam manifestos clamando por uma nova ordem política.`"),
        (r"`Reformist Manifestos in \$\{kingdom\.name\}`", 
         r"`Manifestos Reformistas em ${kingdom.name}`"),
        (r"'Reform pressure and reformist influence became politically visible.'", 
         r"'A pressão por reformas e a influência reformista tornaram-se politicamente visíveis.'"),
        (r"'Calls for a new political order weakened legitimacy.'", 
         r"'Apelos por uma nova ordem política enfraqueceram a legitimidade.'"),
         
        # L2130
        (r"`Frontier towns in \$\{kingdom\.name\} demanded autonomy from the capital\.`", 
         r"`Cidades de fronteira em ${kingdom.name} exigiram autonomia da capital.`"),
        (r"`Frontier Autonomy Crisis in \$\{kingdom\.name\}`", 
         r"`Crise de Autonomia na Fronteira em ${kingdom.name}`"),
        (r"'Weak administrative reach met dissatisfaction on the frontier.'", 
         r"'A fraqueza administrativa encontrou insatisfação na fronteira.'"),
        (r"'Autonomy demands increased instability in the realm.'", 
         r"'Exigências de autonomia aumentaram a instabilidade no reino.'"),
         
        # L2199
        (r"`\$\{kingdom\.name\} reformed \$\{decision\.law\.category\.replace\('_', ' '\)\} law: \$\{decision\.current\.name\} gave way to \$\{decision\.law\.name\}\.`", 
         r"`${kingdom.name} reformou a lei de ${decision.law.category.replace('_', ' ')}: ${decision.current.name} deu lugar a ${decision.law.name}.`"),
        (r"`\$\{decision\.law\.name\} Reform`", 
         r"`Reforma de ${decision.law.name}`"),
        (r"`Political reform pressure reached \$\{Math\.round\(decision\.pressure \* 100\)\}\%\.`", 
         r"`A pressão por reforma política atingiu ${Math.round(decision.pressure * 100)}%.`"),
        (r"`\$\{decision\.current\.name\} was replaced by \$\{decision\.law\.name\}\.`", 
         r"`${decision.current.name} foi substituída por ${decision.law.name}.`"),
        (r"'At least one influential social faction reacted with greater dissatisfaction and radicalisation.'", 
         r"'Pelo menos uma facção social influente reagiu com maior insatisfação e radicalização.'"),
         
        # L2268
        (r"'A revolution changed the social order.'", 
         r"'Uma revolução mudou a ordem social.'"),
        (r"`Revolution in \$\{previousName\}! The \$\{previousGovernment\.toLowerCase\(\)\} is overthrown and a \$\{newGov\.name\.toLowerCase\(\)\} is proclaimed as \$\{kingdom\.name\}\.`", 
         r"`Revolução em ${previousName}! O governo ${previousGovernment.toLowerCase()} foi deposto e um ${newGov.name.toLowerCase()} foi proclamado como ${kingdom.name}.`"),
        (r"`The Revolution of \$\{world\.year\}`", 
         r"`A Revolução do ano ${world.year}`"),
        (r"'Accumulated political and social pressure made the old political order unsustainable.'", 
         r"'A pressão política e social acumulada tornou a antiga ordem política insustentável.'"),
        (r"`\$\{previousGovernment\} government ended and \$\{newGov\.name\} government began\.`", 
         r"`O governo ${previousGovernment} terminou e o governo ${newGov.name} começou.`"),
        (r"'State stability and treasury reserves were sharply reduced.'", 
         r"'A estabilidade do estado e as reservas do tesouro foram drasticamente reduzidas.'"),
        (r"`The Revolution of \$\{kingdom\.name\}`", 
         r"`A Revolução de ${kingdom.name}`"),
         
        # L2297
        (r"`\$\{ruler\.name\} did not survive the revolution\.`", 
         r"`${ruler.name} não sobreviveu à revolução.`"),
        (r"`Death of \$\{ruler\.title \|\| ruler\.name\}`", 
         r"`Morte de ${ruler.title || ruler.name}`"),
        (r"'The ruler was killed during the revolution.'", 
         r"'O governante foi morto durante a revolução.'"),
         
        # L2319
        (r"`\$\{previousName\} reorganised itself as a \$\{newGov\.name\.toLowerCase\(\)\}, becoming \$\{kingdom\.name\}\.`", 
         r"`${previousName} reorganizou-se como um ${newGov.name.toLowerCase()}, tornando-se ${kingdom.name}.`"),
        (r"`Government Reorganisation`", 
         r"`Reorganização do Governo`"),
        (r"'Political institutions adapted to the realm\u2019s current military, social and economic pressures.'", 
         r"'Instituições políticas se adaptaram às atuais pressões militares, sociais e econômicas do reino.'"),
        (r"'Political institutions adapted to the realm\u00b4s current military, social and economic pressures.'", 
         r"'Instituições políticas se adaptaram às atuais pressões militares, sociais e econômicas do reino.'"),
        (r"'Political institutions adapted to the realm's current military, social and economic pressures.'", 
         r"'Instituições políticas se adaptaram às atuais pressões militares, sociais e econômicas do reino.'"),
        (r"`\$\{newGov\.name\} became the governing order of \$\{kingdom\.name\}\.`", 
         r"`${newGov.name} tornou-se a ordem de governo de ${kingdom.name}.`"),
         
        # L2361
        (r"`\$\{a\.name\} and \$\{b\.name\} made first contact\.`", 
         r"`${a.name} e ${b.name} fizeram primeiro contato.`"),
        (r"`First Contact: \$\{a\.name\} & \$\{b\.name\}`", 
         r"`Primeiro Contato: ${a.name} & ${b.name}`"),
        (r"'Both realms entered one another\u2019s known diplomatic world.'", 
         r"'Ambos os reinos entraram no mundo diplomático um do outro.'"),
        (r"'Both realms entered one another's known diplomatic world.'", 
         r"'Ambos os reinos entraram no mundo diplomático um do outro.'"),
        
        # L2477
        (r"`League of \$\{world\.year\}`", 
         r"`Liga do ano ${world.year}`"),
        (r"`Concord of \$\{world\.year\}`", 
         r"`Concórdia do ano ${world.year}`"),
        (r"`\$\{a\.name\} and \$\{b\.name\} formed the \$\{name\}\.`", 
         r"`${a.name} e ${b.name} formaram a ${name}.`"),
        (r"`\$\{a\.name\} and \$\{b\.name\} entered a formal alliance\.`", 
         r"`${a.name} e ${b.name} entraram numa aliança formal.`"),
         
        # L2551
        (r"`Victory over \$\{loser\.name\} strengthened national pride\.`", 
         r"`A vitória sobre ${loser.name} fortaleceu o orgulho nacional.`"),
        (r"`Defeat by \$\{victor\.name\} scarred public memory\.`", 
         r"`A derrota para ${victor.name} marcou a memória pública.`"),
         
        # L2574
        (r"`\$\{victor\.name\} forced \$\{loser!\.name\} to accept peace after \$\{duration\} years of war\.`", 
         r"`${victor.name} forçou ${loser!.name} a aceitar a paz após ${duration} anos de guerra.`"),
        (r"`\$\{a\.name\} and \$\{b\.name\} accepted an exhausted peace after \$\{duration\} years of war\.`", 
         r"`${a.name} e ${b.name} aceitaram uma paz exausta após ${duration} anos de guerra.`"),
        (r"`Peace after the \$\{war\.reason\}`", 
         r"`Paz após a ${war.reason}`"),
        (r"`The Exhausted Peace`", 
         r"`A Paz Exausta`"),
        (r"'One side achieved a decisive advantage under mounting exhaustion.'", 
         r"'Um lado alcançou uma vantagem decisiva sob exaustão crescente.'"),
        (r"'Both realms accumulated enough exhaustion to accept peace.'", 
         r"'Ambos os reinos acumularam exaustão suficiente para aceitar a paz.'"),
        (r"`\$\{victor\.name\} gained reparations and legitimacy while \$\{loser\.name\} lost both\.`", 
         r"`${victor.name} ganhou reparações e legitimidade, enquanto ${loser.name} perdeu ambos.`"),
        (r"'Both realms ended the conflict with lingering war weariness.'", 
         r"'Ambos os reinos terminaram o conflito com um cansaço de guerra persistente.'"),
         
        # L2647
        (r"`Trade between \$\{a\.name\} and \$\{b\.name\} collapsed with the outbreak of war\.`", 
         r"`O comércio entre ${a.name} e ${b.name} entrou em colapso com o início da guerra.`"),
        (r"`Trade Collapse between \$\{a\.name\} and \$\{b\.name\}`", 
         r"`Colapso Comercial entre ${a.name} e ${b.name}`"),
        (r"'War made the existing trade agreement impossible to maintain.'", 
         r"'A guerra tornou o acordo comercial existente impossível de ser mantido.'"),
        (r"'Commercial exchange between the two realms was suspended.'", 
         r"'A troca comercial entre os dois reinos foi suspensa.'"),
         
        # L2675
        (r"`\$\{a\.name\} and \$\{b\.name\} signed a trade agreement\.`", 
         r"`${a.name} e ${b.name} assinaram um acordo comercial.`"),
        (r"`Trade Agreement: \$\{a\.name\} - \$\{b\.name\}`", 
         r"`Acordo Comercial: ${a.name} - ${b.name}`"),
        (r"'The two realms could begin opening formal trade routes.'", 
         r"'Os dois reinos puderam começar a abrir rotas de comércio formais.'"),
         
        # L2694
        (r"`\$\{a\.name\} placed an embargo on \$\{b\.name\}\.`", 
         r"`${a.name} impôs um embargo a ${b.name}.`"),
        (r"`Embargo of \$\{b\.name\}`", 
         r"`Embargo a ${b.name}`"),
        (r"'Diplomatic hostility crossed the threshold for economic coercion.'", 
         r"'A hostilidade diplomática cruzou o limite para coerção econômica.'"),
        (r"'Formal trade between the two realms was restricted.'", 
         r"'O comércio formal entre os dois reinos foi restrito.'"),
         
        # L2750
        (r"`A \$\{kind\} trade route opened: \$\{GOODS\[good\]\.name\} from \$\{fromCity\.name\} to \$\{toCity\.name\}\.`", 
         r"`Uma rota de comércio ${kind} foi aberta: ${GOODS[good].name} de ${fromCity.name} para ${toCity.name}.`"),
        (r"`\$\{GOODS\[good\]\.name\} Route: \$\{fromCity\.name\}\u2014\$\{toCity\.name\}`", 
         r"`Rota de ${GOODS[good].name}: ${fromCity.name} — ${toCity.name}`"),
        (r"`\$\{GOODS\[good\]\.name\} Route: \$\{fromCity\.name\}\-\$\{toCity\.name\}`", 
         r"`Rota de ${GOODS[good].name}: ${fromCity.name}-${toCity.name}`"),
        (r"`\$\{GOODS\[good\]\.name\} began moving regularly between the two settlements\.`", 
         r"`${GOODS[good].name} começou a transitar regularmente entre os dois assentamentos.`"),
        (r"`\$\{GOODS\[good\]\.name\} Trade between \$\{fromCity\.name\} and \$\{toCity\.name\}`", 
         r"`Comércio de ${GOODS[good].name} entre ${fromCity.name} e ${toCity.name}`"),
         
        # L2873
        (r"`Maritime trade through \$\{GOODS\[route\.good\]\.name\} route \$\{from\.name\}\u2014\$\{to\.name\} collapsed: the harbor at \$\{portOperational\(from\) \? to\.name : from\.name\} lies in ruins\.`", 
         r"`O comércio marítimo na rota de ${GOODS[route.good].name} de ${from.name}—${to.name} entrou em colapso: o porto em ${portOperational(from) ? to.name : from.name} está em ruínas.`"),
        (r"`Maritime trade through \$\{GOODS\[route\.good\]\.name\} route \$\{from\.name\}-\$\{to\.name\} collapsed: the harbor at \$\{portOperational\(from\) \? to\.name : from\.name\} lies in ruins\.`", 
         r"`O comércio marítimo na rota de ${GOODS[route.good].name} de ${from.name}-${to.name} entrou em colapso: o porto em ${portOperational(from) ? to.name : from.name} está em ruínas.`"),
        (r"`Trade Collapse: \$\{from\.name\}\u2014\$\{to\.name\}`", 
         r"`Colapso Comercial: ${from.name}—${to.name}`"),
        (r"`Trade Collapse: \$\{from\.name\}-\$\{to\.name\}`", 
         r"`Colapso Comercial: ${from.name}-${to.name}`"),
        (r"'A harbor or port was destroyed or fell below half strength.'", 
         r"'Um porto foi destruído ou caiu para menos da metade de sua integridade.'"),
        (r"`Imports and exports through \$\{from\.name\}\u2014\$\{to\.name\} stopped\.`", 
         r"`Importações e exportações através de ${from.name}—${to.name} pararam.`"),
        (r"`Imports and exports through \$\{from\.name\}-\$\{to\.name\} stopped\.`", 
         r"`Importações e exportações através de ${from.name}-${to.name} pararam.`"),
         
        # L2971
        (r"`\$\{candidate\.name\} swore fealty to \$\{overlord\.name\} and became its vassal\.`", 
         r"`${candidate.name} jurou fidelidade a ${overlord.name} e tornou-se seu vassalo.`"),
         
        # L3013
        (r"`Independence from \$\{overlord\.name\} became a founding memory\.`", 
         r"`A independência de ${overlord.name} tornou-se uma memória fundacional.`"),
        (r"`\$\{vassal\.name\} broke from imperial control\.`", 
         r"`${vassal.name} se libertou do controle imperial.`"),
        (r"'Independence Revolt'", 
         r"'Revolta de Independência'"),
        (r"`\$\{vassal\.name\} renounced fealty to \$\{overlord\.name\} and began an independence war\.`", 
         r"`${vassal.name} renunciou à sua lealdade a ${overlord.name} e iniciou uma guerra de independência.`"),
        (r"`\$\{vassal\.name\} slipped from \$\{overlord\.name\}'s control\.`", 
         r"`${vassal.name} escapou do controle de ${overlord.name}.`"),
         
        # L3114
        (r"`Settlers from \$\{city\.name\} founded \$\{colony\.name\} in the name of \$\{kingdom\.name\}\.`", 
         r"`Colonos de ${city.name} fundaram ${colony.name} em nome de ${kingdom.name}.`"),
        (r"`Founding of \$\{colony\.name\}`", 
         r"`Fundação de ${colony.name}`"),
        (r"`\$\{city\.name\} had the population, food and housing pressure to send settlers outward\.`", 
         r"`${city.name} teve pressão populacional, de alimentos e moradia para enviar colonos.`"),
        (r"`\$\{kingdom\.name\} gained a new settlement\.`", 
         r"`${kingdom.name} ganhou um novo assentamento.`"),
         
        # L3255
        (r"`Free State of \$\{city\.name\}`", 
         r"`Estado Livre de ${city.name}`"),
        (r"`Secession from \$\{kingdom\.name\} founded the new state\.`", 
         r"`A secessão de ${kingdom.name} fundou o novo estado.`"),
        (r"`\$\{city\.name\} seceded from the realm\.`", 
         r"`${city.name} se separou do reino.`"),
        (r"'Secession & Rebellion'", 
         r"'Secessão e Rebelião'"),
        (r"`Rebellion in \$\{kingdom\.name\}! \$\{city\.name\} seceded and proclaimed the \$\{rebelName\}\. Civil war erupts!`", 
         r"`Rebelião em ${kingdom.name}! ${city.name} se separou e proclamou o ${rebelName}. Irrompe a guerra civil!`"),
        (r"`The Secession of \$\{city\.name\}`", 
         r"`A Secessão de ${city.name}`"),
        (r"'Local revolt pressure and political alienation crossed the threshold for secession.'", 
         r"'A pressão da revolta local e alienação política cruzaram o limite para secessão.'"),
        (r"`\$\{rebelKingdom\.name\} emerged as an independent state and war began with \$\{kingdom\.name\}\.`", 
         r"`${rebelKingdom.name} surgiu como um estado independente e começou uma guerra com ${kingdom.name}.`"),
        (r"`The Rebellion of \$\{city\.name\}`", 
         r"`A Rebelião de ${city.name}`"),
         
        # L3400
        (r"`Bandits raided the \$\{route\.kind\} trade route between \$\{fromCity\.name\} and \$\{toCity\.name\}\.`", 
         r"`Bandidos atacaram a rota comercial ${route.kind} entre ${fromCity.name} e ${toCity.name}.`"),
         
        # L3494
        (r"`\$\{kingdom\.name\} has fallen\. Its last settlement is gone\.`", 
         r"`${kingdom.name} caiu. Seu último assentamento não existe mais.`"),
        (r"`Fall of \$\{kingdom\.name\}`", 
         r"`Queda de ${kingdom.name}`"),
        (r"'The realm lost its final surviving settlement.'", 
         r"'O reino perdeu seu último assentamento sobrevivente.'"),
        (r"'The kingdom ceased to exist as an independent state.'", 
         r"'O reino deixou de existir como um estado independente.'"),
         
        # Other mentions
        (r"`\$\{city\.name\} completed its \$\{def\.name\}\$\{resourceLabel\}\.`", 
         r"`${city.name} completou a sua estrutura de ${def.name}${resourceLabel}.`"),
         
        # 'tiles' to 'blocos'
        (r"'tiles'", r"'blocos'"),
    ]

    for old, new in replacements:
        text = re.sub(old, new, text)

    # Some replacements for alert titles without exact regex matching
    text = text.replace("'trade agreement'", "'acordo comercial'")
    text = text.replace("'first contact'", "'primeiro contato'")
    text = text.replace("'diplomatic hostility'", "'hostilidade diplomática'")
    text = text.replace("'trade route'", "'rota de comércio'")
    text = text.replace("'trade collapse'", "'colapso comercial'")
    text = text.replace("'civil war'", "'guerra civil'")
    text = text.replace("'fall of a realm'", "'queda de um reino'")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == "__main__":
    translate('src/civ/CivilizationEngine.ts')
