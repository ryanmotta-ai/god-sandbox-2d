import { events } from '../core/EventBus';

export enum WorldEra {
  GOLDEN_AGE = 'Era de Ouro',
  AGE_OF_ASHES = 'Era das Cinzas',
  FROZEN_AGE = 'Era Glacial',
  DARK_AGE = 'Era das Trevas',
  ABUNDANCE = 'Era da Abundância'
}

/**
 * What each climatic era actually does to a harvest.
 *
 * The eras existed as a name, a fifty-year timer and an `eraChanged` event, and
 * nothing in the simulation read which one it was: a realm farmed the Glacial Age
 * exactly as productively as the Age of Abundance. Five named climate epochs whose
 * only effect was a line in the chronicle and a tint on the renderer.
 *
 * `food` scales the harvest, `production` everything else a settlement makes, and
 * `growth` how readily a population expands into what it has. Deliberately modest
 * — an era should reshape a century, not end a civilisation in a decade.
 */
export interface EraClimate {
  food: number;
  production: number;
  growth: number;
  description: string;
}

export const ERA_CLIMATE: Record<WorldEra, EraClimate> = {
  [WorldEra.GOLDEN_AGE]: {
    food: 1, production: 1, growth: 1,
    description: 'Estações previsíveis. Nada ajuda nem atrapalha.'
  },
  [WorldEra.ABUNDANCE]: {
    food: 1.28, production: 1.1, growth: 1.18,
    description: 'Chuvas na hora certa e invernos brandos: os celeiros transbordam.'
  },
  [WorldEra.AGE_OF_ASHES]: {
    food: 0.74, production: 0.92, growth: 0.88,
    description: 'Céu carregado de cinzas. A luz não chega ao trigo.'
  },
  [WorldEra.DARK_AGE]: {
    food: 0.84, production: 0.82, growth: 0.9,
    description: 'Anos magros e oficinas paradas. O mundo se recolhe.'
  },
  [WorldEra.FROZEN_AGE]: {
    food: 0.62, production: 0.88, growth: 0.8,
    description: 'O solo congela por metade do ano. Só o que foi guardado alimenta.'
  }
};

export class EraManager {
  private currentEra: WorldEra = WorldEra.GOLDEN_AGE;
  private yearInEra: number = 0;
  private eraDurationYears: number = 50;

  public getCurrentEra(): WorldEra {
    return this.currentEra;
  }

  public setEra(era: WorldEra): void {
    this.currentEra = era;
    this.yearInEra = 0;
    events.emit('eraChanged', era);
  }

  public tickYear(year: number): void {
    this.yearInEra++;
    if (this.yearInEra >= this.eraDurationYears) {
      this.cycleNextEra();
    }
  }

  public cycleNextEra(): void {
    const eras = [
      WorldEra.GOLDEN_AGE,
      WorldEra.ABUNDANCE,
      WorldEra.AGE_OF_ASHES,
      WorldEra.DARK_AGE,
      WorldEra.FROZEN_AGE
    ];
    const idx = (eras.indexOf(this.currentEra) + 1) % eras.length;
    this.setEra(eras[idx]);
  }
}
