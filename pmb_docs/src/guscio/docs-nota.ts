import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';

@customElement('docs-nota')
export class DocsNota extends LinguaElement {
  @state() private testo = '';

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo {
      width: 440px;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
      padding: 24px;
      background: var(--pmb-superficie, #ffffff);
      border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 500;
      color: var(--pmb-testo, #1f1f1f);
    }
    .campo {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      color: var(--pmb-testo-2, #444746);
      margin-bottom: 8px;
    }
    textarea {
      width: 100%;
      height: 90px;
      box-sizing: border-box;
      padding: 10px;
      border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 4px;
      font: inherit;
      resize: vertical;
      outline: none;
    }
    textarea:focus { border-color: #0b57d0; }
    .pulsanti {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    button {
      height: 36px;
      padding: 0 20px;
      border-radius: 18px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    button.annulla {
      border: 1px solid var(--pmb-bordo, #dadce0);
      background: var(--pmb-superficie, #ffffff);
      color: var(--pmb-accento, #0b57d0);
    }
    button.annulla:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    button.applica {
      border: 0;
      background: #0b57d0;
      color: #ffffff;
    }
    button.applica:hover { background: #0842a0; }
  `;

  focalizza(): void {
    this.renderRoot.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  private chiudi(): void {
    this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true }));
  }

  private applica(): void {
    this.dispatchEvent(new CustomEvent('applica', {
      detail: { testo: this.testo.trim() },
      bubbles: true,
      composed: true,
    }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.applica();
    }
  };

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-labelledby="titolo-nota">
        <h2 id="titolo-nota">Inserisci nota a piè di pagina</h2>
        <div class="campo">
          <label for="testo-nota">Testo della nota:</label>
          <textarea
            id="testo-nota"
            placeholder="Scrivi qui il testo della nota..."
            .value=${this.testo}
            @input=${(e: Event) => { this.testo = (e.target as HTMLTextAreaElement).value; }}
            @keydown=${this.suTasto}
          ></textarea>
        </div>
        <div class="pulsanti">
          <button class="annulla" @click=${this.chiudi}>Annulla</button>
          <button class="applica" @click=${this.applica}>Inserisci</button>
        </div>
      </div>
    `;
  }
}
