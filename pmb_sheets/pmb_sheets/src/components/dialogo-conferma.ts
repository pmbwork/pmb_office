// Finestra di conferma con più scelte (per esempio "Salva", "Non salvare", "Annulla"). Si usa quando un gesto può far perdere del lavoro.
// Proprietà: `titolo`, `messaggio`, `scelte` (id, testo, e quale è la principale). Evento: `scelta` con detail = { id }. Esc equivale all'ultima scelta con `annulla`.
import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';

export interface SceltaConferma { id: string; testo: string; principale?: boolean; annulla?: boolean }

@customElement('free-dialogo-conferma')
export class FreeDialogoConferma extends LinguaElement {
  @property({ type: String }) titolo = '';
  @property({ type: String }) messaggio = '';
  @property({ attribute: false }) scelte: SceltaConferma[] = [];

  static styles = css`
    :host { position: fixed; inset: 0; z-index: 1100; font-family: var(--font-family-base, sans-serif); font-size: 13px; color: var(--color-text, #202124); }
    .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.4); display: flex; align-items: center; justify-content: center; }
    .finestra { background: var(--color-bg, #fff); border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 20px 24px; width: 420px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    h2 { margin: 0 0 12px; font-size: 16px; font-weight: 500; }
    p { margin: 0 0 20px; line-height: 1.4; }
    .bottoni { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    button { padding: 7px 16px; border-radius: 4px; border: 1px solid var(--color-border, #dadce0); background: var(--color-bg, #fff); color: inherit; font: inherit; cursor: pointer; }
    button.principale { background: var(--color-accent, #1a73e8); border-color: var(--color-accent, #1a73e8); color: #fff; }
  `;

  firstUpdated(): void {
    (this.renderRoot.querySelector('button.principale') as HTMLButtonElement | null)?.focus();
  }

  private scegli(id: string): void {
    this.dispatchEvent(new CustomEvent('scelta', { detail: { id }, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    const annulla = [...this.scelte].reverse().find((s) => s.annulla);
    if (annulla) this.scegli(annulla.id);
  };

  render() {
    return html`
      <div class="velo" @keydown=${this.suTasto}>
        <div class="finestra" role="alertdialog" aria-modal="true" aria-labelledby="titolo-conferma" aria-describedby="messaggio-conferma">
          <h2 id="titolo-conferma">${this.titolo}</h2>
          <p id="messaggio-conferma">${this.messaggio}</p>
          <div class="bottoni">
            ${this.scelte.map((s) => html`<button data-scelta=${s.id} class=${s.principale ? 'principale' : ''} @click=${() => this.scegli(s.id)}>${s.testo}</button>`)}
          </div>
        </div>
      </div>`;
  }
}
