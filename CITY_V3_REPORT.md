# AETHORIA — CITY-V3

## Sistema de ArchitecturalProfile

- Cada cidade mantém um `ArchitecturalProfile` compacto, versionado e persistido no save.
- O perfil define tradições primária/secundária, materiais, clima, riqueza, forma urbana, paleta, influências históricas e um ponto de extensão para fortificações do CITY-V4.
- O cálculo ocorre no ciclo estrutural anual e somente substitui o perfil quando um fator discreto muda de faixa; o renderer apenas lê o resultado.
- Cada construção guarda um carimbo arquitetônico próprio. Reformas podem atualizar um prédio isolado, mas avanço de era, independência ou conquista não altera construções antigas em massa.

## Fatores que definem identidade

- Reino e cultura existente: militarismo, tradição, autoridade, abertura, mercantilismo, stewardship e inovação.
- Espécie, era operacional, bioma dominante, temperatura, umidade, floresta, montanha, fertilidade e relação com água/costa.
- Prosperidade, fome, idade/fase urbana e função econômica observada nos edifícios agrícolas, comerciais, portuários e industriais.
- Colônia/metrópole, identidade colonial, antigo soberano e histórico de conquista.
- O perfil influencia densidade, tamanho e irregularidade de quarteirões, largura visual das ruas urbanas, afastamento, pátios, escala dos volumes, escala de landmarks e densidade de props.

## Variação entre cidades

- Seleções de variantes e props são determinísticas por ID/posição e ficam cacheadas; recarregar ou reconstruir um chunk não reorganiza a aparência.
- Cidades do mesmo reino compartilham cultura e materiais dominantes, mas divergem por seed local, terreno, clima, prosperidade, função econômica, idade e composição de edifícios.
- Mercados podem assumir mercado aberto, loja ou hospedaria; residências podem usar cabana, casas simples/médias/ricas ou pátio conforme contexto e fase histórica.
- Props ART-V1 são colocados junto de usos coerentes: bancas/caixas/carroças no comércio, árvores/cercas/poços em residências, iluminação em centros modernos e carga junto à indústria/porto.

## Eras/história

- CITY-V2 permanece como origem temporal da construção: fase, geração, ano e reforma continuam preservados.
- Novas construções recebem o perfil e a era vigentes; prédios existentes mantêm sua tradição e material originais.
- Reformas continuam graduais e atualizam somente o prédio reformado.
- Conquista mantém os carimbos do antigo reino e permite que obras futuras introduzam a tradição do conquistador, produzindo mistura arquitetônica progressiva.

## Integração colonial

- Colônias jovens combinam cultura da metrópole e adaptação ambiental local, ponderadas pela identidade colonial já existente em COL-V1/V2/V3.
- O peso metropolitano diminui por faixas conforme a identidade colonial cresce.
- Independência preserva todos os edifícios coloniais e mantém a antiga metrópole como influência histórica secundária; somente obras e reformas posteriores usam a identidade independente.
- Cidades-filhas do mesmo reino herdam coerência cultural, mas desenvolvem variante regional pelo novo sítio e pela própria economia.

## Assets utilizados

- PNGs reais do ART-V1 para residências, pátios, comércio, mercado, civic, religião, agricultura, indústria, militar, porto e transporte.
- Assets reais de props: árvores, cercas, poços, vasos, iluminação, caixas, carroças e bancas.
- Estados danificado/ruína existentes são usados para casas, centro cívico, templo, keep e segmentos de muralha.
- Atlas paginado WebGPU, batching, índice espacial de edifícios e chunks estáticos permanecem ativos; cada prédio gera no máximo um prop contextual adicional.

## Assets faltantes

- Famílias completas próprias para `northern`, `desert`, `forest`, `stonekin` e `emberkin`; o catálogo atual oferece principalmente a cultura `common`.
- Pelo menos duas ou três variantes culturais por família residencial, comercial, cívica, religiosa, agrícola, industrial, militar e transporte.
- Estados danificado/ruína para mercados, indústria, portos, agricultura, landmarks e props culturais.
- Variações arquitetônicas de era suficientes para bronze, iron, classical, industrial e modern sem reutilização excessiva.
- Variantes culturais de wall, gate, tower e fortification ficam registradas para CITY-V4, sem mecânicas implementadas nesta fase.

## Limitações

- Onde não existe PNG cultural específico, a identidade usa composição urbana, escala, props e uma tonalidade material discreta sobre o asset comum; nenhum substituto procedural permanente foi criado.
- Ruas não armazenam individualmente ano/material de construção; novas ruas usam o perfil vigente, enquanto a história detalhada continua registrada pelos prédios e blocos adjacentes.
- Influência estrangeira comercial usa o ponto de extensão de influências, mas não há CULT-V1 completo nem migração cultural detalhada.
- Muralhas, portões, torres, fortificações funcionais e expansão extramuros permanecem exclusivamente para CITY-V4.
