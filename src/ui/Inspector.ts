import { Entity } from '../entities/Entity';
import { City } from '../civ/City';
import { Kingdom } from '../civ/Kingdom';
import { SPECIES_DEFINITIONS } from '../entities/Species';
import { Camera } from '../renderer/Camera';

export class InspectorUI {
  private drawer: HTMLElement;
  private titleEl: HTMLElement;
  private contentEl: HTMLElement;

  constructor() {
    this.drawer = document.getElementById('inspector-drawer')!;
    this.titleEl = document.getElementById('inspector-title')!;
    this.contentEl = document.getElementById('inspector-content')!;

    document.getElementById('btn-close-inspector')?.addEventListener('click', () => {
      this.hide();
    });
  }

  public show(): void {
    this.drawer.classList.remove('hidden');
  }

  public hide(): void {
    this.drawer.classList.add('hidden');
  }

  public inspectEntity(e: Entity, city: City | null, kingdom: Kingdom | null, camera: Camera): void {
    this.show();
    this.titleEl.innerText = `👤 ${e.name}`;

    const config = SPECIES_DEFINITIONS[e.species];
    const traitBadges = Array.from(e.traits).map(t => `<span class="trait-badge">${t}</span>`).join(' ');

    this.contentEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Species:</span> <span class="stat-value" style="color:${config.primaryColor}">${config.name}</span></div>
      <div class="stat-row"><span class="stat-label">Age:</span> <span class="stat-value">${e.age} yrs (${e.gender})</span></div>
      <div class="stat-row"><span class="stat-label">Health:</span> <span class="stat-value">${e.hp} / ${e.maxHp} HP</span></div>
      <div class="stat-row"><span class="stat-label">Level / XP:</span> <span class="stat-value">Lvl ${e.level} (${e.xp} XP)</span></div>
      <div class="stat-row"><span class="stat-label">Profession:</span> <span class="stat-value">${e.profession.toUpperCase()}</span></div>
      <div class="stat-row"><span class="stat-label">Personality:</span> <span class="stat-value">${e.personality}</span></div>
      <div class="stat-row"><span class="stat-label">Kills:</span> <span class="stat-value">⚔️ ${e.kills}</span></div>
      <div class="stat-row"><span class="stat-label">City:</span> <span class="stat-value">${city ? city.name : 'Homeless'}</span></div>
      <div class="stat-row"><span class="stat-label">Kingdom:</span> <span class="stat-value" style="color:${kingdom?.color || '#fff'}">${kingdom ? kingdom.name : 'Independent'}</span></div>
      
      <div style="margin-top:8px;">
        <strong>Traits:</strong>
        <div style="margin-top:4px;">${traitBadges || '<span style="color:#94a3b8">None</span>'}</div>
      </div>

      <button id="btn-focus-entity" class="focus-btn">🎥 Track Camera</button>
    `;

    document.getElementById('btn-focus-entity')?.addEventListener('click', () => {
      camera.x = e.x * camera.tileSize;
      camera.y = e.y * camera.tileSize;
    });
  }

  public inspectCity(city: City, kingdom: Kingdom | null): void {
    this.show();
    this.titleEl.innerText = `🏛️ City of ${city.name}`;

    this.contentEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Species:</span> <span class="stat-value">${city.species.toUpperCase()}</span></div>
      <div class="stat-row"><span class="stat-label">Founded:</span> <span class="stat-value">Year ${city.foundingYear} (by ${city.founderName})</span></div>
      <div class="stat-row"><span class="stat-label">Population:</span> <span class="stat-value">👥 ${city.population}</span></div>
      <div class="stat-row"><span class="stat-label">Buildings:</span> <span class="stat-value">🏗️ ${city.buildings.size}</span></div>
      <div class="stat-row"><span class="stat-label">Territory Size:</span> <span class="stat-value">🗺️ ${city.territory.size} tiles</span></div>
      <div class="stat-row"><span class="stat-label">Kingdom:</span> <span class="stat-value" style="color:${kingdom?.color || '#fff'}">${kingdom ? kingdom.name : 'Independent'}</span></div>

      <div style="margin-top:12px; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px;">
        <strong>Resources:</strong>
        <div class="stat-row"><span class="stat-label">Wood:</span> <span>🌲 ${city.resources.wood}</span></div>
        <div class="stat-row"><span class="stat-label">Stone:</span> <span>🪨 ${city.resources.stone}</span></div>
        <div class="stat-row"><span class="stat-label">Iron:</span> <span>⛏️ ${city.resources.iron}</span></div>
        <div class="stat-row"><span class="stat-label">Food:</span> <span>🌾 ${city.resources.food}</span></div>
      </div>
    `;
  }
}
