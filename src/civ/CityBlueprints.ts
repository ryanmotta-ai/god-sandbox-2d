import { BuildingType } from './Building';
import { DistrictAffinity } from './UrbanPlanner';
import { SettlementTier } from './City';
import { UrbanStreetClass, UrbanGrowthStage } from './UrbanPlanner';
import { TileMap } from '../world/TileMap';
import { TerrainType } from '../world/Biomes';
import { Kingdom } from './Kingdom';

export type PavingStyle = 'marble' | 'cobblestone' | 'timber' | 'flagstone' | 'brick';
export type FoliagePattern = 'cypress' | 'oak' | 'palm' | 'evergreen' | 'willow';

export interface BlueprintSlot {
  dx: number;
  dy: number;
  affinity: DistrictAffinity;
  preferredBuildings?: BuildingType[];
  minTier: SettlementTier;
  importance: number; // 1 (comum) a 10 (centro monumental)
  description?: string;
}

export interface BlueprintStreetSegment {
  dx: number;
  dy: number;
  streetClass: UrbanStreetClass;
  minStage?: UrbanGrowthStage;
}

export interface CityBlueprint {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  idealTerrain: 'plains' | 'mountain' | 'coastal' | 'forest' | 'any';
  pavingStyle: PavingStyle;
  foliagePattern: FoliagePattern;
  plazaRadius: number;
  slots: BlueprintSlot[];
  streets: BlueprintStreetSegment[];
  /** Helper map for instant coordinate lookup */
  slotMap: Map<string, BlueprintSlot>;
  streetMap: Map<string, BlueprintStreetSegment>;
}

// ============================================================
// BLUEPRINT BUILDERS & CATALOG
// ============================================================

function createBlueprint(data: {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  idealTerrain: 'plains' | 'mountain' | 'coastal' | 'forest' | 'any';
  pavingStyle: PavingStyle;
  foliagePattern: FoliagePattern;
  plazaRadius: number;
  slots: BlueprintSlot[];
  streets: BlueprintStreetSegment[];
}): CityBlueprint {
  const slotMap = new Map<string, BlueprintSlot>();
  for (const s of data.slots) slotMap.set(`${s.dx},${s.dy}`, s);

  const streetMap = new Map<string, BlueprintStreetSegment>();
  for (const st of data.streets) streetMap.set(`${st.dx},${st.dy}`, st);

  return {
    ...data,
    slotMap,
    streetMap
  };
}

// ------------------------------------------------------------
// 1. 🏛️ GRADE IMPERIAL AUGUSTA (Romana / Hipodâmica Clássica)
// ------------------------------------------------------------
const IMPERIAL_GRID_STREETS: BlueprintStreetSegment[] = [];
// Eixos Cardo e Decumanus centrais limpos
for (let i = -5; i <= 5; i++) {
  IMPERIAL_GRID_STREETS.push({ dx: i, dy: 0, streetClass: 'primary' });
  IMPERIAL_GRID_STREETS.push({ dx: 0, dy: i, streetClass: 'primary' });
}
// Anel do Fórum e Quarteirões Centrais
for (let i = -3; i <= 3; i++) {
  IMPERIAL_GRID_STREETS.push({ dx: i, dy: -3, streetClass: 'secondary', minStage: 'village' });
  IMPERIAL_GRID_STREETS.push({ dx: i, dy: 3, streetClass: 'secondary', minStage: 'village' });
  IMPERIAL_GRID_STREETS.push({ dx: -3, dy: i, streetClass: 'secondary', minStage: 'village' });
  IMPERIAL_GRID_STREETS.push({ dx: 3, dy: i, streetClass: 'secondary', minStage: 'village' });
}

const IMPERIAL_GRID_SLOTS: BlueprintSlot[] = [
  // Fórum Monumental Central (0,0)
  { dx: 0, dy: 0, affinity: 'civic', preferredBuildings: ['town_center'], minTier: 'camp', importance: 10, description: 'Fórum Imperial' },
  { dx: 1, dy: 0, affinity: 'commercial', preferredBuildings: ['market'], minTier: 'camp', importance: 9, description: 'Mercado do Fórum' },
  { dx: -1, dy: 0, affinity: 'commercial', preferredBuildings: ['bank', 'stock_exchange'], minTier: 'hamlet', importance: 9, description: 'Basílica Financeira' },
  { dx: 0, dy: 1, affinity: 'knowledge', preferredBuildings: ['temple', 'great_library'], minTier: 'village', importance: 9, description: 'Templo de Júpiter' },
  { dx: 0, dy: -1, affinity: 'civic', preferredBuildings: ['palace', 'monument'], minTier: 'town', importance: 9, description: 'Palácio do Senado' },
  { dx: 0, dy: 4, affinity: 'military', preferredBuildings: ['barracks', 'colosseum'], minTier: 'village', importance: 8, description: 'Guarda Pretoriana' },
  { dx: 0, dy: -4, affinity: 'civic', preferredBuildings: ['colosseum', 'monument'], minTier: 'city', importance: 8, description: 'Coliseu' },

  // Quarteirão Residencial Nordeste (Domus compactas e aconchegantes)
  { dx: 1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 8 },
  { dx: 2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 1, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 7 },
  { dx: 2, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },

  // Quarteirão Residencial Sudeste (Casas de Comércio e Guildas)
  { dx: 1, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 8 },
  { dx: 2, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 1, dy: 2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 7 },
  { dx: 2, dy: 2, affinity: 'residential', preferredBuildings: ['house', 'granary'], minTier: 'village', importance: 6 },

  // Quarteirão Acadêmico e Filosófico Noroeste
  { dx: -1, dy: -1, affinity: 'knowledge', preferredBuildings: ['library'], minTier: 'hamlet', importance: 8 },
  { dx: -2, dy: -1, affinity: 'knowledge', preferredBuildings: ['academy'], minTier: 'village', importance: 7 },
  { dx: -1, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -2, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'village', importance: 6 },

  // Quarteirão das Forjas e Artesanato Sudoeste
  { dx: -1, dy: 1, affinity: 'industrial', preferredBuildings: ['workshop'], minTier: 'hamlet', importance: 7 },
  { dx: -2, dy: 1, affinity: 'industrial', preferredBuildings: ['smithy'], minTier: 'village', importance: 7 },
  { dx: -1, dy: 2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -2, dy: 2, affinity: 'industrial', preferredBuildings: ['factory', 'refinery'], minTier: 'town', importance: 6 },

  // Cinturão Agrícola Compacto e Unificado (Bloco Contíguo no Leste)
  { dx: 4, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'camp', importance: 7, description: 'Campo Agrícola Imperial' },
  { dx: 4, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 6 },
  { dx: 5, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 6 },
  { dx: 5, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm', 'pasture'], minTier: 'village', importance: 5 },
  { dx: 4, dy: 3, affinity: 'agricultural', preferredBuildings: ['pasture'], minTier: 'village', importance: 5 },
  { dx: 5, dy: 3, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'town', importance: 4 }
];

// ------------------------------------------------------------
// 2. 🛡️ CIDADELA CONCÊNTRICA (Fortaleza Medieval / Star Citadel)
// ------------------------------------------------------------
const CONCENTRIC_STREETS: BlueprintStreetSegment[] = [];
// Eixos Cardeais curtos
for (let i = -5; i <= 5; i++) {
  CONCENTRIC_STREETS.push({ dx: i, dy: 0, streetClass: 'primary' });
  CONCENTRIC_STREETS.push({ dx: 0, dy: i, streetClass: 'primary' });
}
// Anéis Concêntricos Fechados (r=2 e r=4)
for (let dx = -4; dx <= 4; dx++) {
  for (let dy = -4; dy <= 4; dy++) {
    const dist = Math.hypot(dx, dy);
    if ((dist >= 1.6 && dist <= 2.4) || (dist >= 3.6 && dist <= 4.4)) {
      CONCENTRIC_STREETS.push({ dx, dy, streetClass: 'secondary', minStage: 'village' });
    }
  }
}

const CONCENTRIC_SLOTS: BlueprintSlot[] = [
  // Torreão Central & Capela Real (0,0)
  { dx: 0, dy: 0, affinity: 'civic', preferredBuildings: ['town_center', 'keep'], minTier: 'camp', importance: 10, description: 'Torreão de Menagem' },
  { dx: 0, dy: 1, affinity: 'civic', preferredBuildings: ['palace'], minTier: 'town', importance: 9, description: 'Corte Real' },
  { dx: 0, dy: -1, affinity: 'knowledge', preferredBuildings: ['temple'], minTier: 'village', importance: 9, description: 'Capela da Cidadela' },
  { dx: 1, dy: 0, affinity: 'commercial', preferredBuildings: ['market'], minTier: 'camp', importance: 8, description: 'Pátio das Guildas' },
  { dx: -1, dy: 0, affinity: 'knowledge', preferredBuildings: ['library', 'academy'], minTier: 'village', importance: 8, description: 'Arquivo Real' },

  // Primeiro Anel: Residências de Pedra e Oficinas de Armas
  { dx: 1, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: -1, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: 2, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -2, dy: 1, affinity: 'industrial', preferredBuildings: ['smithy'], minTier: 'hamlet', importance: 7 },
  { dx: 2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'village', importance: 6 },
  { dx: -2, dy: -1, affinity: 'industrial', preferredBuildings: ['workshop'], minTier: 'village', importance: 6 },

  // Baluartes Fortificados nos Portões
  { dx: 0, dy: 4, affinity: 'military', preferredBuildings: ['barracks', 'keep'], minTier: 'hamlet', importance: 8, description: 'Portão Sul' },
  { dx: 0, dy: -4, affinity: 'military', preferredBuildings: ['barracks'], minTier: 'village', importance: 8, description: 'Portão Norte' },

  // Bloco Agrícola Contíguo Exterior
  { dx: 3, dy: 3, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'camp', importance: 7, description: 'Campos da Cidadela' },
  { dx: 4, dy: 3, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 6 },
  { dx: 3, dy: 4, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 6 },
  { dx: 4, dy: 4, affinity: 'agricultural', preferredBuildings: ['farm', 'pasture'], minTier: 'village', importance: 5 }
];

// ------------------------------------------------------------
// 3. ⚓ METRÓPOLE PORTUÁRIA (Baía & Docas Mercantis / Alexandria)
// ------------------------------------------------------------
const MARITIME_STREETS: BlueprintStreetSegment[] = [];
// Calçadão da Orla e Acesso Central
for (let x = -5; x <= 5; x++) {
  MARITIME_STREETS.push({ dx: x, dy: 1, streetClass: 'primary' });
  MARITIME_STREETS.push({ dx: x, dy: -2, streetClass: 'secondary', minStage: 'village' });
}
for (let y = -4; y <= 2; y++) {
  MARITIME_STREETS.push({ dx: 0, dy: y, streetClass: 'primary' });
  MARITIME_STREETS.push({ dx: -3, dy: y, streetClass: 'secondary', minStage: 'village' });
  MARITIME_STREETS.push({ dx: 3, dy: y, streetClass: 'secondary', minStage: 'village' });
}

const MARITIME_SLOTS: BlueprintSlot[] = [
  // Praça Central e Orla Portuária
  { dx: 0, dy: 0, affinity: 'civic', preferredBuildings: ['town_center'], minTier: 'camp', importance: 10, description: 'Capitania do Porto' },
  { dx: 0, dy: 2, affinity: 'logistics', preferredBuildings: ['harbor', 'port'], minTier: 'camp', importance: 10, description: 'Cais Principal' },
  { dx: 2, dy: 2, affinity: 'logistics', preferredBuildings: ['harbor', 'port'], minTier: 'village', importance: 9, description: 'Docas do Leste' },
  { dx: -2, dy: 2, affinity: 'logistics', preferredBuildings: ['harbor', 'port'], minTier: 'village', importance: 9, description: 'Docas do Oeste' },
  { dx: 1, dy: 0, affinity: 'commercial', preferredBuildings: ['market'], minTier: 'camp', importance: 9, description: 'Mercado do Peixe' },
  { dx: -1, dy: 0, affinity: 'commercial', preferredBuildings: ['bank', 'stock_exchange'], minTier: 'hamlet', importance: 8, description: 'Bolsa Marítima' },

  // Bairro dos Marinheiros Compacto (Norte)
  { dx: 0, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 8 },
  { dx: 1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: -1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: 0, dy: -3, affinity: 'civic', preferredBuildings: ['palace', 'monument'], minTier: 'town', importance: 8, description: 'Palácio dos Almirantes' },
  { dx: 1, dy: -3, affinity: 'knowledge', preferredBuildings: ['temple'], minTier: 'village', importance: 7, description: 'Templo dos Mares' },
  { dx: -1, dy: -3, affinity: 'knowledge', preferredBuildings: ['academy', 'library'], minTier: 'village', importance: 7, description: 'Academia Náutica' },

  // Setor Agrícola Costeiro Compacto
  { dx: 4, dy: -1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'camp', importance: 6 },
  { dx: 4, dy: -2, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 5 },
  { dx: 5, dy: -1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 5 },
  { dx: 5, dy: -2, affinity: 'agricultural', preferredBuildings: ['farm', 'pasture'], minTier: 'village', importance: 4 }
];

// ------------------------------------------------------------
// 4. 🌿 VILA BUCÓLICA DOS BOSQUES (Cidade Jardim / Valfenda)
// ------------------------------------------------------------
const SYLVAN_STREETS: BlueprintStreetSegment[] = [];
for (let i = -4; i <= 4; i++) {
  SYLVAN_STREETS.push({ dx: i, dy: 0, streetClass: 'primary' });
  SYLVAN_STREETS.push({ dx: 0, dy: i, streetClass: 'primary' });
}
for (let i = -2; i <= 2; i++) {
  SYLVAN_STREETS.push({ dx: i, dy: -2, streetClass: 'secondary', minStage: 'village' });
  SYLVAN_STREETS.push({ dx: i, dy: 2, streetClass: 'secondary', minStage: 'village' });
}

const SYLVAN_SLOTS: BlueprintSlot[] = [
  // Clareira Sagrada Central (0,0)
  { dx: 0, dy: 0, affinity: 'civic', preferredBuildings: ['town_center'], minTier: 'camp', importance: 10, description: 'Clareira Central' },
  { dx: 0, dy: 1, affinity: 'knowledge', preferredBuildings: ['temple'], minTier: 'camp', importance: 10, description: 'Santuário da Árvore Mãe' },
  { dx: 1, dy: 0, affinity: 'commercial', preferredBuildings: ['market'], minTier: 'camp', importance: 9, description: 'Feira das Ervas' },
  { dx: -1, dy: 0, affinity: 'knowledge', preferredBuildings: ['library', 'academy'], minTier: 'village', importance: 8, description: 'Círculo Druídico' },
  { dx: 0, dy: -1, affinity: 'civic', preferredBuildings: ['monument', 'palace'], minTier: 'town', importance: 8, description: 'Casa Comunitária' },

  // Casas Rústicas e Cabanas em Vila Aconchegante
  { dx: 1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 1, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: 2, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: -2, dy: -1, affinity: 'industrial', preferredBuildings: ['workshop'], minTier: 'village', importance: 6 },
  { dx: -1, dy: 1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'village', importance: 6 },
  { dx: -2, dy: 1, affinity: 'industrial', preferredBuildings: ['workshop', 'smithy'], minTier: 'village', importance: 5 },

  // Cinturão de Pomares e Hortas Contínuas
  { dx: 3, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'camp', importance: 8, description: 'Pomar da Vila' },
  { dx: 3, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 7 },
  { dx: 4, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 6 },
  { dx: 4, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm', 'pasture'], minTier: 'village', importance: 6 }
];

// ------------------------------------------------------------
// 5. ⚙️ BALUARTE FABRIL A VAPOR (Metrópole Industrial & Ferrovias)
// ------------------------------------------------------------
const INDUSTRIAL_STREETS: BlueprintStreetSegment[] = [];
for (let i = -5; i <= 5; i++) {
  INDUSTRIAL_STREETS.push({ dx: i, dy: 0, streetClass: 'primary' });
  INDUSTRIAL_STREETS.push({ dx: 0, dy: i, streetClass: 'primary' });
  INDUSTRIAL_STREETS.push({ dx: i, dy: -2, streetClass: 'secondary', minStage: 'village' });
  INDUSTRIAL_STREETS.push({ dx: i, dy: 2, streetClass: 'secondary', minStage: 'village' });
}

const INDUSTRIAL_SLOTS: BlueprintSlot[] = [
  // Estação Central e Centro de Negócios (0,0)
  { dx: 0, dy: 0, affinity: 'civic', preferredBuildings: ['town_center'], minTier: 'camp', importance: 10, description: 'Estação Central' },
  { dx: 1, dy: 0, affinity: 'commercial', preferredBuildings: ['market', 'bank'], minTier: 'camp', importance: 9, description: 'Bolsa Mercantil' },
  { dx: -1, dy: 0, affinity: 'civic', preferredBuildings: ['palace', 'stock_exchange'], minTier: 'town', importance: 9, description: 'Câmara do Comércio' },
  { dx: 0, dy: -1, affinity: 'knowledge', preferredBuildings: ['academy', 'library'], minTier: 'village', importance: 8, description: 'Escola Politécnica' },

  // Bairro Operário em Fileiras Paralelas Aconchegantes (Norte)
  { dx: 1, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 8 },
  { dx: 2, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'camp', importance: 7 },
  { dx: 3, dy: -1, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 7 },
  { dx: 1, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'hamlet', importance: 6 },
  { dx: 2, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'village', importance: 6 },
  { dx: 3, dy: -2, affinity: 'residential', preferredBuildings: ['house'], minTier: 'village', importance: 5 },

  // Polo de Fundições e Oficinas (Sul)
  { dx: -1, dy: 1, affinity: 'industrial', preferredBuildings: ['smithy'], minTier: 'camp', importance: 8, description: 'Fundição Central' },
  { dx: -2, dy: 1, affinity: 'industrial', preferredBuildings: ['factory'], minTier: 'hamlet', importance: 8 },
  { dx: -1, dy: 2, affinity: 'industrial', preferredBuildings: ['workshop'], minTier: 'hamlet', importance: 7 },
  { dx: -2, dy: 2, affinity: 'industrial', preferredBuildings: ['factory', 'refinery'], minTier: 'village', importance: 7 },

  // Bloco de Suprimento Agrícola (Leste)
  { dx: 4, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'camp', importance: 6 },
  { dx: 4, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 5 },
  { dx: 5, dy: 1, affinity: 'agricultural', preferredBuildings: ['farm'], minTier: 'hamlet', importance: 5 },
  { dx: 5, dy: 2, affinity: 'agricultural', preferredBuildings: ['farm', 'pasture'], minTier: 'village', importance: 4 }
];

// ============================================================
// CATÁLOGO OFICIAL DE PLANTAS URBANÍSTICAS
// ============================================================

export const CITY_BLUEPRINTS: Record<string, CityBlueprint> = {
  imperial_grid: createBlueprint({
    id: 'imperial_grid',
    name: 'Grade Imperial Augusta',
    subtitle: 'Hipodâmica Clássica & Eixos Cardo-Decumanus',
    description: 'Planta monumental simétrica com Fórum em mármore, quarteirões ortogonais e grandes avenidas triunfais.',
    icon: 'city',
    accentColor: '#f59e0b',
    idealTerrain: 'plains',
    pavingStyle: 'marble',
    foliagePattern: 'cypress',
    plazaRadius: 2,
    slots: IMPERIAL_GRID_SLOTS,
    streets: IMPERIAL_GRID_STREETS
  }),
  concentric_citadel: createBlueprint({
    id: 'concentric_citadel',
    name: 'Cidadela Concéntrica',
    subtitle: 'Fortaleza Estrela & Anéis de Pedra',
    description: 'Fortaleza medieval radial com torreão central, anéis concêntricos de ruas e muralhas nos quatro pontos cardeais.',
    icon: 'castle',
    accentColor: '#94a3b8',
    idealTerrain: 'mountain',
    pavingStyle: 'cobblestone',
    foliagePattern: 'oak',
    plazaRadius: 2,
    slots: CONCENTRIC_SLOTS,
    streets: CONCENTRIC_STREETS
  }),
  maritime_haven: createBlueprint({
    id: 'maritime_haven',
    name: 'Metrópole Portuária',
    subtitle: 'Baía das Especiarias & Calçadão Marítimo',
    description: 'Grande baía mercantil com docas lineares, armazéns ao longo da costa e praça do mercado voltada ao porto.',
    icon: 'harbor',
    accentColor: '#0ea5e9',
    idealTerrain: 'coastal',
    pavingStyle: 'timber',
    foliagePattern: 'palm',
    plazaRadius: 2,
    slots: MARITIME_SLOTS,
    streets: MARITIME_STREETS
  }),
  sylvan_avenues: createBlueprint({
    id: 'sylvan_avenues',
    name: 'Vila Bucólica dos Bosques',
    subtitle: 'Cidade Jardim Élfica & Espirais Naturais',
    description: 'Alamedas orgânicas que contornam o relevo, templo no coração da floresta e cinturão de fazendas integradas.',
    icon: 'leaf',
    accentColor: '#10b981',
    idealTerrain: 'forest',
    pavingStyle: 'flagstone',
    foliagePattern: 'willow',
    plazaRadius: 2,
    slots: SYLVAN_SLOTS,
    streets: SYLVAN_STREETS
  }),
  industrial_bastion: createBlueprint({
    id: 'industrial_bastion',
    name: 'Baluarte Fabril a Vapor',
    subtitle: 'Metrópole Vitoriana & Eixos Ferroviários',
    description: 'Avenidas retas estruturadas para linhas de trem, distrito operário compacto e polo siderúrgico isolado do centro.',
    icon: 'building',
    accentColor: '#f97316',
    idealTerrain: 'any',
    pavingStyle: 'brick',
    foliagePattern: 'evergreen',
    plazaRadius: 2,
    slots: INDUSTRIAL_SLOTS,
    streets: INDUSTRIAL_STREETS
  })
};

export const ALL_BLUEPRINT_IDS = Object.keys(CITY_BLUEPRINTS);

export function getCityBlueprint(id: string): CityBlueprint {
  return CITY_BLUEPRINTS[id] ?? CITY_BLUEPRINTS['imperial_grid'];
}

/**
 * Automatically picks the most fitting Blueprint for a settlement site based on topography and culture.
 */
export function pickBestBlueprintForSite(
  tileMap: TileMap,
  cx: number,
  cy: number,
  kingdom?: Kingdom | null
): string {
  let waterTiles = 0;
  let mountainTiles = 0;
  let forestTiles = 0;
  const radius = 6;

  for (let x = cx - radius; x <= cx + radius; x++) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      const tile = tileMap.getTile(x, y);
      if (!tile) continue;
      if (tile.type.includes('water') || tile.type.includes('ocean')) waterTiles++;
      else if (tile.type === TerrainType.MOUNTAIN) mountainTiles++;
      else if (tile.type === TerrainType.FOREST || tile.type === TerrainType.SWAMP) forestTiles++;
    }
  }

  if (waterTiles >= 7) return 'maritime_haven';
  if (mountainTiles >= 5) return 'concentric_citadel';
  if (forestTiles >= 10) return 'sylvan_avenues';

  if (kingdom?.research.knows('industrialization') || kingdom?.research.knows('steam_power')) {
    return 'industrial_bastion';
  }

  return 'imperial_grid';
}

