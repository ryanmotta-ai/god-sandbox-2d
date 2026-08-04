import { chronicle } from '../civ/Chronicle';

export class ChronicleUI {
  private modal: HTMLElement;
  private listEl: HTMLElement;

  constructor() {
    this.modal = document.getElementById('chronicle-modal')!;
    this.listEl = document.getElementById('chronicle-list')!;

    document.getElementById('btn-chronicle')?.addEventListener('click', () => {
      this.open();
    });

    document.getElementById('btn-close-chronicle')?.addEventListener('click', () => {
      this.close();
    });
  }

  public open(): void {
    this.renderEvents();
    this.modal.classList.remove('hidden');
  }

  public close(): void {
    this.modal.classList.add('hidden');
  }

  public renderEvents(): void {
    const events = chronicle.getEvents();
    if (events.length === 0) {
      this.listEl.innerHTML = '<li style="color:#94a3b8">The chronicle is empty. History has yet to unfold...</li>';
      return;
    }

    this.listEl.innerHTML = events.map(ev => `
      <li class="${ev.type}">
        <strong>Year ${ev.year}:</strong> ${ev.text}
      </li>
    `).join('');
  }
}
