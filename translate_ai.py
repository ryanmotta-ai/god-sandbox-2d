import re

def translate(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    replacements = [
        (r"`The settlement of \$\{cityName\} was founded by \$\{e\.name\}\.`", 
         r"`O assentamento de ${cityName} foi fundado por ${e.name}.`"),
        (r"`The \$\{kingdom\.name\} was established\. \$\{rulerCandidate\.fullName\} leads its people\.`", 
         r"`O ${kingdom.name} foi estabelecido. ${rulerCandidate.fullName} lidera seu povo.`"),
        (r"'Imperial Expansion'", r"'Expansão Imperial'"),
        (r"'Blood Feud'", r"'Vingança de Sangue'"),
        (r"'Border Dispute'", r"'Disputa de Fronteira'"),
        (r"`\$\{aggressor\.name\} declared war upon \$\{defender\.name\}\. Reason: \$\{reason\}`", 
         r"`${aggressor.name} declarou guerra contra ${defender.name}. Motivo: ${reason}`"),
        (r"`Death of \$\{ruler\.title \|\| ruler\.name\}`", r"`Morte de ${ruler.title || ruler.name}`"),
        (r"`\$\{ruler\.fullName\} has died in battle.`", r"`${ruler.fullName} morreu em batalha.`"),
        (r"`\$\{ruler\.fullName\} has died of old age.`", r"`${ruler.fullName} morreu de velhice.`"),
        (r"`\$\{ruler\.fullName\} died from exposure to the elements.`", r"`${ruler.fullName} morreu devido à exposição aos elementos.`"),
        (r"`\$\{ruler\.fullName\} succumbed to starvation.`", r"`${ruler.fullName} sucumbiu à inanição.`"),
        (r"`\$\{ruler\.fullName\}, ruler of \$\{kingdom\.name\}, has died\.`", r"`${ruler.fullName}, governante de ${kingdom.name}, morreu.`"),
        (r"`\$\{heir\.fullName\} takes the throne of \$\{kingdom\.name\}\.`", r"`${heir.fullName} assume o trono de ${kingdom.name}.`"),
        (r"`Succession in \$\{kingdom\.name\}`", r"`Sucessão em ${kingdom.name}`"),
        (r"'A new ruler has taken power.'", r"'Um novo governante assumiu o poder.'"),
        (r"`\$\{heir\.title \|\| 'Ruler'\} \$\{heir\.fullName\} has succeeded \$\{ruler\.name\}\.`", r"`${heir.title || 'O Governante'} ${heir.fullName} sucedeu ${ruler.name}.`"),
        (r"`The throne of \$\{kingdom\.name\} is vacant\.`", r"`O trono de ${kingdom.name} está vago.`"),
        (r"`Vacant Throne in \$\{kingdom\.name\}`", r"`Trono Vago em ${kingdom.name}`"),
        (r"'The realm is without a legitimate ruler.'", r"'O reino está sem um governante legítimo.'"),
        (r"`\$\{ruler\.name\} left no clear heir. The realm is vulnerable\.`", r"`${ruler.name} não deixou um herdeiro claro. O reino está vulnerável.`"),
        # animal prefixes translation
        (r"'Fang '", r"'Presa '"),
        (r"'Shadow '", r"'Sombra '"),
        (r"'Grizz '", r"'Garra '"),
        (r"'Frost '", r"'Gelo '"),
        (r"'tiles'", r"'blocos'"),
    ]

    for old, new in replacements:
        text = re.sub(old, new, text)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

if __name__ == "__main__":
    translate('src/ai/EntityAI.ts')
