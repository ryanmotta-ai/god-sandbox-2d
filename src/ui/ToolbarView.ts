import { ALL_POWERS } from '../powers/GodPowers';
import { BrushCategory, BrushManager } from '../powers/BrushManager';

export class ToolbarView {
  private container: HTMLElement;
  private toolNameEl: HTMLElement;
  private brushMgr: BrushManager;

  constructor(brushMgr: BrushManager, onSelectPower: (powerId: string) => void) {
    this.container = document.getElementById('tools-container')!;
    this.toolNameEl = document.getElementById('tool-name')!;
    this.brushMgr = brushMgr;

    // Category tab listeners
    const tabs = document.querySelectorAll('.cat-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const cat = target.dataset.cat as BrushCategory;
        this.brushMgr.setCategory(cat);
        this.renderCategoryTools(cat, onSelectPower);
      });
    });

    // Brush size listener
    const sizeBtns = document.querySelectorAll('.brush-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.brushMgr.setSize(parseInt(target.dataset.size || '3', 10));
      });
    });

    // Initial render
    this.renderCategoryTools('terrain', onSelectPower);
  }

  public renderCategoryTools(category: BrushCategory, onSelectPower: (powerId: string) => void): void {
    this.container.innerHTML = '';
    const powers = ALL_POWERS.filter(p => p.category === category);

    powers.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = `tool-item ${p.id === this.brushMgr.activePowerId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="icon">${p.icon}</span>
        <span class="name">${p.name}</span>
      `;
      item.title = p.description;

      item.addEventListener('click', () => {
        document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.brushMgr.setPower(p.id);
        this.toolNameEl.innerText = `${p.icon} ${p.name}`;
        onSelectPower(p.id);
      });

      this.container.appendChild(item);

      if (idx === 0 && !powers.some(pw => pw.id === this.brushMgr.activePowerId)) {
        this.brushMgr.setPower(p.id);
        this.toolNameEl.innerText = `${p.icon} ${p.name}`;
      }
    });
  }
}
