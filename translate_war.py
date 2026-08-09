import re

def translate(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    replacements = [
        (r"`\$\{besieger\.name\} laid siege to \$\{city\.name\}\.`", 
         r"`${besieger.name} iniciou o cerco de ${city.name}.`"),
        (r"`Siege of \$\{city\.name\}`", r"`Cerco de ${city.name}`"),
        (r"`\$\{besieger\.name\} concentrated enough nearby military strength to invest the settlement\.`", 
         r"`${besieger.name} concentrou força militar suficiente nas proximidades para cercar o assentamento.`"),
        (r"`\$\{city\.name\} was cut off and began accumulating siege pressure\.`", 
         r"`${city.name} foi isolada e começou a acumular pressão de cerco.`"),
        (r"`The siege of \$\{city\.name\} was broken\$\{besieger \? \` by \$\{besieger\.name\}\` : ''\}\.`", 
         r"`O cerco de ${city.name} foi rompido${besieger ? \` por ${besieger.name}\` : ''}.`"),
        (r"`Relief of \$\{city\.name\}`", r"`Alívio de ${city.name}`"),
        (r"`\$\{city\.name\} escaped immediate capture and siege progress was cleared\.`", 
         r"`${city.name} escapou da captura imediata e o progresso do cerco foi zerado.`"),
        (r"`Ruler \$\{ruler\.name\} fell in combat defending the capital of \$\{from\.name\}!`", 
         r"`O governante ${ruler.name} caiu em combate defendendo a capital de ${from.name}!`"),
        (r"`Death of Ruler \$\{ruler\.name\}`", r"`Morte do Governante ${ruler.name}`"),
        (r"'ruler death'", r"'morte do governante'"),
        (r"'capital fall'", r"'queda da capital'"),
        (r"`Ruler \$\{ruler\.name\} was captured when \$\{city\.name\} fell to \$\{to\.name\}\.`", 
         r"`O governante ${ruler.name} foi capturado quando ${city.name} caiu para ${to.name}.`"),
        (r"`Ruler \$\{ruler\.name\} Captured`", r"`Governante ${ruler.name} Capturado`"),
        (r"'ruler captured'", r"'governante capturado'"),
        (r"`\$\{to\.name\} stormed the capital of \$\{from\.name\}! The court flees to \$\{remaining\.name\}\.`", 
         r"`${to.name} tomou a capital de ${from.name}! A corte foge para ${remaining.name}.`"),
        (r"`Fall of \$\{city\.name\}`", r"`Queda de ${city.name}`"),
        (r"`\$\{from\.name\} moved its court to \$\{remaining\.name\}\.`", 
         r"`${from.name} moveu sua corte para ${remaining.name}.`"),
        (r"`\$\{city\.name\} passed to \$\{to\.name\}\.`", r"`${city.name} passou para ${to.name}.`"),
        (r"`\$\{to\.name\} took the last city of \$\{from\.name\}\. The realm is extinguished\.`", 
         r"`${to.name} tomou a última cidade de ${from.name}. O reino foi extinto.`"),
        (r"`Extinction of \$\{from\.name\}`", r"`Extinção de ${from.name}`"),
        (r"'last city'", r"'última cidade'"),
        (r"'realm extinction'", r"'extinção de reino'"),
        (r"`\$\{city\.name\}, the final settlement of \$\{from\.name\}, was captured\.`", 
         r"`${city.name}, o último assentamento de ${from.name}, foi capturado.`"),
        (r"`\$\{from\.name\} no longer possessed a surviving settlement\.`", 
         r"`${from.name} não possui mais nenhum assentamento sobrevivente.`"),
        (r"`Fall of \$\{from\.name\}`", r"`Queda de ${from.name}`"),
        (r"`Capture of \$\{city\.name\}`", r"`Captura de ${city.name}`"),
        (r"`The settlement changed allegiance from \$\{from\.name\} to \$\{to\.name\}\.`", 
         r"`O assentamento mudou de lealdade de ${from.name} para ${to.name}.`"),
        (r"`As part of the peace treaty, \$\{loser\.name\} agreed to pay annual war reparations to \$\{dominant\.name\} for 10 years\.`", 
         r"`Como parte do tratado de paz, ${loser.name} concordou em pagar reparações de guerra anuais para ${dominant.name} por 10 anos.`"),
        (r"`War Reparations Imposed`", r"`Reparações de Guerra Impostas`"),
        (r"'peace treaty'", r"'tratado de paz'"),
        (r"`In the peace treaty, \$\{from\.name\} ceded \$\{city\.name\} to \$\{to\.name\}\.`", 
         r"`No tratado de paz, ${from.name} cedeu ${city.name} para ${to.name}.`"),
        (r"`Cession of \$\{city\.name\}`", r"`Cessão de ${city.name}`"),
        (r"'A peace settlement required territorial concessions.'", r"'Um acordo de paz exigiu concessões territoriais.'"),
        (r"`\$\{city\.name\} changed sovereignty without being taken by storm\.`", 
         r"`${city.name} mudou de soberania sem ser tomada à força.`"),
         
        (r"`\$\{city\.name\} fell after \$\{heldFor\} \$\{heldFor === 1 \? 'year' : 'years'\} of siege\.`", 
         r"`${city.name} caiu após ${heldFor} ${heldFor === 1 ? 'ano' : 'anos'} de cerco.`"),
        (r"`\$\{to\.name\} captured \$\{city\.name\} from \$\{from\.name\} after a siege of \$\{heldFor\} \$\{heldFor === 1 \? 'year' : 'years'\}\.`", 
         r"`${to.name} capturou ${city.name} de ${from.name} após um cerco de ${heldFor} ${heldFor === 1 ? 'ano' : 'anos'}.`"),

        (r"'tiles'", r"'blocos'"),
    ]

    for old, new in replacements:
        text = re.sub(old, new, text)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == "__main__":
    translate('src/civ/Warfare.ts')
