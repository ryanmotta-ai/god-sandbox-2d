# AETHORIA — ART-V1 STYLE GUIDE

## Regra-mãe

A arte de Aethoria é pixel art legível em visão de mundo, com silhuetas fortes e materiais reconhecíveis antes de detalhes decorativos. Todo sprite final é um PNG RGBA transparente; geração procedural continua apenas como fallback técnico enquanto a biblioteca final é produzida.

## Câmera e perspectiva

- Perspectiva **ortográfica oblíqua 3/4**, compatível com o grid quadrado atual; não usar projeção isométrica em losango.
- A câmera observa de sul/sudeste para norte/noroeste. Fachada sul e lateral leste são as faces preferenciais visíveis.
- Linhas verticais permanecem verticais. Não usar perspectiva com ponto de fuga.
- O contato com o chão deve coincidir com a âncora declarada no manifest. Portas, ruas e muros precisam alinhar ao grid.

## Escala, tile e pixel density

- Um tile de mundo corresponde a **32×32 pixels de source art**.
- Pixel density: **2×**. Um “pixel artístico” ocupa 2×2 pixels do PNG; a leitura efetiva é 16 pixels artísticos por tile, próxima à linguagem existente.
- Sprites nunca são redimensionados com suavização. Exportar na resolução final declarada pelo manifest.
- Classes-base:

| Classe | Canvas | Footprint padrão | Uso |
|---|---:|---:|---|
| prop | 32×32 | 1×1 | objetos pequenos e decoração |
| small | 64×64 | 1×1 | casas e estruturas compactas |
| medium | 96×96 | 2×2 | oficinas, mercados, fazendas |
| large | 128×128 | 3×3 | prédios cívicos/militares |
| landmark | 160×160 | 4×4 | palácios, keeps, monumentos |
| linear | 64×64 | 1×1 | roads, muros, canais e conexões |

- O canvas pode conter altura acima do footprint, mas o prédio não pode invadir a área de contato de outro tile sem metadata explícita futura.
- Âncora padrão: `(0.5, 0.875)`, normalizada no canvas; representa o centro do contato com o chão.

## Luz e sombras

- Luz principal fixa vindo do **noroeste/superior esquerdo**, em aproximadamente 45°.
- Faces superiores são mais claras; fachada sul tem valor médio; lateral leste é 12–20% mais escura.
- Sombras caem para **sudeste/inferior direito**.
- Incluir somente sombra de contato e sombra projetada curta no próprio PNG: borda dura pixelada, preto azulado/marrom, 25–40% de alpha.
- Não incluir iluminação atmosférica, bloom ou sombras longas. Esses efeitos pertencem a fases futuras.

## Paleta e materiais

- Paleta-base: terrosos moderadamente saturados, pedra quente, madeira marrom-avermelhada, metais frios e vegetação dessaturada.
- Cada sprite usa idealmente 16–24 cores e no máximo 32, incluindo sombra.
- Rampas recomendadas:

| Material | Escuro | Base | Luz |
|---|---|---|---|
| contorno | `#171923` | `#242735` | — |
| madeira | `#4A2D24` | `#80543B` | `#C08A5A` |
| pedra | `#4E5059` | `#777A80` | `#B5B0A4` |
| telha | `#6B2F2C` | `#A54B3F` | `#D47A5D` |
| palha | `#76552D` | `#B98943` | `#E2C36D` |
| ferro | `#292D35` | `#505967` | `#9AA7B5` |
| vegetação | `#284633` | `#477052` | `#78A765` |
| tecido neutro | `#56485C` | `#8A7089` | `#C2A6B5` |

- Cores de reino não devem dominar o sprite-base. Reservar bandeiras, toldos, escudos ou faixas com máscara/tint neutro para integração futura.
- Variantes culturais trocam telhados, materiais, ornamento e silhueta secundária, mantendo footprint, âncora e leitura funcional.

## Contornos, transparência e detalhe

- Contorno externo de 1 pixel artístico (2 pixels no PNG), quase preto colorido; contorno interno apenas onde separa volumes importantes.
- Evitar contorno preto puro contínuo. Quebrar ou clarear o contorno no lado iluminado.
- Fundo totalmente transparente. Exportar PNG RGBA com alpha reto; sem matte branco/preto e sem pixels RGB contaminados nas bordas transparentes.
- Anti-aliasing somente manual, em degraus pixelados. Não usar blur, filtro fotográfico ou subpixel automático.
- Detalhes menores que 2×2 source pixels são ruído. Priorizar silhueta, telhado, porta, material e função.
- O sprite deve continuar identificável a 50% do tamanho e em uma captura de cidade densa.

## Variações, eras, culturas e estados

- ID estável: `city.<categoria>.<família>.<qualificador>.vNN`.
- Variações `v01`, `v02` etc. mantêm footprint e âncora quando são intercambiáveis.
- Eras suportadas pelo contrato: `stone`, `bronze`, `iron`, `classical`, `industrial`, `modern`, `any`.
- Culturas iniciais do contrato: `common`, `northern`, `desert`, `forest`, `stonekin`, `emberkin`, `any`.
- Estados:
  - `normal`: íntegro e operacional;
  - `damaged`: 30–45% de dano visual, sem alterar a silhueta funcional;
  - `ruined`: colapso claro, abertura no telhado/parede e footprint ainda reconhecível.
- Dano deve ser produzido como asset próprio, não como overlay procedural que substitua o sprite.

## Pipeline de entrega

1. Escolher uma entrada em `CITY_ASSET_CATALOG.md` e copiar exatamente seu ID/metadata de `src/assets/CityAssetManifest.ts`.
2. Gerar o sprite no canvas declarado, usando transparência e a âncora visual correta.
3. Nomear o PNG pelo `source` calculado no manifest e colocá-lo em `src/assets/city/<categoria>/`.
4. Não adicionar padding externo, upscale ou margem além do canvas contratado.
5. Rodar `npm run build`. O bundler encontra PNGs automaticamente.
6. No boot, o atlas valida a dimensão, pagina o asset e usa `atlasKey` para substituir o fallback atual. Arquivo ausente ou inválido mantém o fallback e emite diagnóstico sem derrubar o renderer.

## Checklist de aprovação

- Perspectiva, luz e sombra coerentes com o guia.
- Canvas e footprint iguais ao manifest.
- Silhueta legível e função inequívoca.
- Alpha limpo e sem smoothing.
- Âncora de solo correta.
- Estado/era/cultura visualmente distinguíveis sem mudar gameplay.
- Nenhum texto, logo moderno ou detalhe fotográfico embutido.

