import { events } from '../core/EventBus';

export enum WorldEra {
  GOLDEN_AGE = 'Era de Ouro',
  AGE_OF_ASHES = 'Era das Cinzas',
  FROZEN_AGE = 'Era Glacial',
  DARK_AGE = 'Era das Trevas',
  ABUNDANCE = 'Era da Abundância'
}

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
