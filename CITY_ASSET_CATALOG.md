# AETHORIA — CITY ASSET CATALOG

## FIRST PACK

O FIRST PACK contém **65 assets finais**: 51 P1 para a primeira leitura funcional de CITY-V1 e 14 P2 para completar variedade, dano e marcos. Os IDs e metadados executáveis vivem em `src/assets/CityAssetManifest.ts`; este catálogo define a ordem de produção.

## P1 — essenciais (51)

### Residential

- `city.residential.house.small.v01` — casa-base, normal.
- `city.residential.house.small.v02` — segunda silhueta de casa.
- `city.residential.house.medium.v01` — residência evoluída.
- `city.residential.house.damaged.v01` — casa danificada.
- `city.residential.house.ruined.v01` — casa em ruína.
- `city.residential.cabin.small.v01` — cabana simples.
- `city.residential.house.rich.large.v01` — residência rica.

### Commercial

- `city.commercial.market.medium.v01` — mercado-base.
- `city.commercial.market.medium.v02` — variação de mercado.
- `city.commercial.shop.small.v01` — loja/oficina de rua.
- `city.commercial.inn.medium.v01` — estalagem.
- `city.commercial.warehouse.large.v01` — armazém comercial.

### Civic

- `city.civic.town_center.large.v01` — centro urbano principal.
- `city.civic.town_center.damaged.v01` — centro urbano danificado.
- `city.civic.palace.landmark.v01` — palácio/capital.
- `city.civic.library.large.v01` — biblioteca.

### Religious

- `city.religious.shrine.small.v01` — santuário compacto.
- `city.religious.temple.large.v01` — templo principal.

### Military

- `city.military.barracks.large.v01` — quartel.
- `city.military.keep.landmark.v01` — fortaleza central.
- `city.military.watchtower.medium.v01` — torre de vigia.
- `city.military.gatehouse.large.v01` — portão fortificado.

### Industrial

- `city.industrial.workshop.medium.v01` — oficina.
- `city.industrial.smithy.medium.v01` — ferraria.
- `city.industrial.lumber_camp.medium.v01` — madeireira.
- `city.industrial.quarry.large.v01` — pedreira.
- `city.industrial.mine.large.v01` — mina.

### Agriculture

- `city.agriculture.farm.medium.v01` — fazenda-base.
- `city.agriculture.farm.medium.v02` — segunda cultura/campo.
- `city.agriculture.granary.medium.v01` — celeiro.
- `city.agriculture.pasture.medium.v01` — pastagem/curral.

### Transport

- `city.transport.harbor.large.v01` — harbor pré-industrial.
- `city.transport.port.large.v01` — porto industrial.
- `city.transport.road_straight.linear.v01` — segmento reto.
- `city.transport.road_corner.linear.v01` — curva/conexão.
- `city.transport.rail_station.large.v01` — estação ferroviária.
- `city.transport.rail_depot.large.v01` — depósito ferroviário.
- `city.transport.rail_signal.prop.v01` — sinal ferroviário.

### Walls

- `city.walls.segment.linear.v01` — muralha reta.
- `city.walls.corner.linear.v01` — canto de muralha.
- `city.walls.segment.damaged.v01` — muralha danificada.
- `city.walls.segment.ruined.v01` — muralha rompida.

### Props

- `city.props.crates.prop.v01` — caixas e barris.
- `city.props.cart.prop.v01` — carroça estacionada.
- `city.props.well.prop.v01` — poço comunitário.
- `city.props.tree_deciduous.prop.v01` — árvore urbana.
- `city.props.shrub_planter.prop.v01` — vegetação em canteiro.
- `city.props.fence.linear.v01` — cerca conectável.
- `city.props.market_stall.small.v01` — banca de mercado.

### Ruins

- `city.ruins.rubble.small.v01` — escombros genéricos.
- `city.ruins.burned_house.small.v01` — casa queimada.

## P2 — completar o primeiro conjunto (14)

- `city.residential.courtyard.medium.v01` — conjunto residencial clássico.
- `city.commercial.bank.large.v01` — banco.
- `city.civic.academy.large.v01` — academia.
- `city.civic.monument.landmark.v01` — monumento.
- `city.religious.temple.damaged.v01` — templo danificado.
- `city.religious.cemetery.medium.v01` — cemitério.
- `city.military.armory.medium.v01` — arsenal.
- `city.military.keep.ruined.v01` — fortaleza em ruína.
- `city.industrial.factory.large.v01` — fábrica industrial.
- `city.agriculture.windmill.medium.v01` — moinho.
- `city.agriculture.irrigation.linear.v01` — canal de irrigação.
- `city.transport.bridge.medium.v01` — ponte urbana.
- `city.props.lamp.prop.v01` — iluminação pública industrial.
- `city.ruins.monument.large.v01` — monumento arruinado.

## Próximos assets necessários — P3+

Após validar o FIRST PACK em uma cidade real, produzir nesta ordem:

1. **Cobertura dos buildings existentes:** granary/pasture/collective/refinery/oil well/stock exchange, wonders e todos os estados que ainda usam fallback.
2. **Conectividade:** todos os bitmasks de road, rail, walls, gates, bridges, cais e canais; entradas rotacionáveis quando necessário.
3. **Eras:** versões bronze, iron, classical, industrial e modern das famílias residenciais, comerciais, cívicas e produtivas mais frequentes.
4. **Culturas:** packs coerentes `northern`, `desert`, `forest`, `stonekin` e `emberkin`, começando por house, town center, market, temple, barracks e walls.
5. **Estados:** normal/damaged/ruined para landmarks e edifícios de alta frequência; rubble específico por material.
6. **Variação urbana:** 4–8 casas, 3 mercados/lojas e 2–4 oficinas por era/cultura para evitar repetição visual.
7. **Props de densidade:** bancas, cercas, árvores urbanas, estátuas, fontes, placas, fardos, docas e pequenas pilhas de materiais.
8. **Entidades futuras:** trabalhadores urbanos, guardas, mercadores, animais de carga e veículos por era; manter em manifests próprios para não misturar contratos de animação com buildings.

## Estrutura física

```text
src/assets/
  CityAssetManifest.ts
  city/
    residential/
    commercial/
    civic/
    religious/
    military/
    industrial/
    agriculture/
    transport/
    walls/
    props/
    ruins/
```

O atlas não depende da ordem dos arquivos. IDs e `atlasKey` são estáveis; o shelf packer distribui automaticamente centenas de sprites em páginas de até 512×512 e o renderer continua agrupando instâncias por página.
