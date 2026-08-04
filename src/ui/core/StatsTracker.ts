import { SimulationEngine } from '../../ai/EntityAI';
import { SpeciesType, SPECIES_DEFINITIONS } from '../../entities/Species';

/** One sample of the world, recorded once per simulated year. */
export interface WorldSample {
  year: number;
  population: number;
  humanoids: number;
  wildlife: number;
  cities: number;
  kingdoms: number;
  activeWars: number;
  births: number;
  deaths: number;
}

export interface SpeciesBreakdown {
  species: SpeciesType;
  name: string;
  color: string;
  count: number;
}

export interface KingdomRanking {
  id: string;
  name: string;
  color: string;
  emblem: string;
  population: number;
  cities: number;
  territory: number;
  power: number;
}

const MAX_SAMPLES = 400;

/**
 * Records a time series of the world so the Statistics screen can chart real
 * history instead of a single snapshot.
 */
export class StatsTracker {
  public samples: WorldSample[] = [];
  public peakPopulation: number = 0;
  public peakKingdoms: number = 0;
  public totalWarsDeclared: number = 0;

  private lastSampledYear: number = -1;
  private lastBirths: number = 0;
  private lastDeaths: number = 0;

  public reset(): void {
    this.samples = [];
    this.peakPopulation = 0;
    this.peakKingdoms = 0;
    this.totalWarsDeclared = 0;
    this.lastSampledYear = -1;
    this.lastBirths = 0;
    this.lastDeaths = 0;
  }

  /** Called every frame; only records when the simulated year actually advances. */
  public maybeSample(sim: SimulationEngine): void {
    if (sim.currentYear === this.lastSampledYear) return;
    this.lastSampledYear = sim.currentYear;

    let humanoids = 0;
    for (const e of sim.entities) {
      if (SPECIES_DEFINITIONS[e.species].isHumanoid) humanoids++;
    }

    const births = sim.totalBirths - this.lastBirths;
    const deaths = sim.totalDeaths - this.lastDeaths;
    this.lastBirths = sim.totalBirths;
    this.lastDeaths = sim.totalDeaths;

    const sample: WorldSample = {
      year: sim.currentYear,
      population: sim.entities.length,
      humanoids,
      wildlife: sim.entities.length - humanoids,
      cities: sim.cities.size,
      kingdoms: sim.kingdoms.size,
      activeWars: sim.diplomacy.activeWars.size,
      births,
      deaths
    };

    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();

    this.peakPopulation = Math.max(this.peakPopulation, sample.population);
    this.peakKingdoms = Math.max(this.peakKingdoms, sample.kingdoms);
    this.totalWarsDeclared = sim.diplomacy.activeWars.size + sim.diplomacy.warHistory.length;
  }

  public latest(): WorldSample | null {
    return this.samples.length ? this.samples[this.samples.length - 1] : null;
  }

  public series(key: keyof WorldSample): number[] {
    return this.samples.map(s => s[key]);
  }

  public speciesBreakdown(sim: SimulationEngine): SpeciesBreakdown[] {
    const counts = new Map<SpeciesType, number>();
    for (const e of sim.entities) counts.set(e.species, (counts.get(e.species) ?? 0) + 1);

    return Array.from(counts.entries())
      .map(([species, count]) => ({
        species,
        name: SPECIES_DEFINITIONS[species].name,
        color: SPECIES_DEFINITIONS[species].primaryColor,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }

  public kingdomRankings(sim: SimulationEngine): KingdomRanking[] {
    return Array.from(sim.kingdoms.values())
      .map(k => {
        let population = 0;
        let territory = 0;
        for (const cityId of k.cityIds) {
          const city = sim.cities.get(cityId);
          if (!city) continue;
          population += city.population;
          territory += city.territory.size;
        }
        const militia = sim.entities.filter(e => e.kingdomId === k.id);
        const power = Math.round(
          militia.reduce((sum, e) => sum + e.damage + e.defense + e.level * 5, 0) + territory * 0.5
        );
        return {
          id: k.id,
          name: k.name,
          color: k.color,
          emblem: k.emblem,
          population,
          cities: k.cityIds.size,
          territory,
          power
        };
      })
      .sort((a, b) => b.power - a.power);
  }
}
