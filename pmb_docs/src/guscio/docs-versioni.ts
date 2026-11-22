import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import type { VersioneSalvata } from '../formati/versioni';
import { t, localeCorrente } from '../i18n/lingua';

@customElement('docs-versioni')
export class DocsVersioni extends LinguaElement {
  @property({ attribute: false }) versioni: VersioneSalvata[] = [];
  @state() private nomeNuovaVersione = '';

  static styles = css`
    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo {
      width: 520px;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
      padding: 24px;
      background: var(--pmb-superficie, #ffffff);
      border-radius: 8px;
      box-shadow: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
    }
    .testata {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: var(--pmb-testo, #1f1f1f);
    }
    .chiudi-x {
      background: none;
      border: 0;
      font-size: 18px;
      color: var(--pmb-testo-2, #5f6368);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .chiudi-x:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    .crea-versione {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .campo-nome {
      flex: 1;
      height: 36px;
      box-sizing: border-box;
      padding: 0 12px;
      border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 4px;
      font: inherit;
      outline: none;
    }
    .campo-nome:focus { border-color: #0b57d0; }
    .bottone-salva {
      height: 36px;
      padding: 0 16px;
      border: 0;
      border-radius: 4px;
      background: #0b57d0;
      color: #ffffff;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }
    .bottone-salva:hover { background: #0842a0; }
    .lista-versioni {
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--pmb-bordo, #e0e0e0);
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .elemento-versione {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--pmb-bordo, #f1f3f4);
    }
    .elemento-versione:last-child { border-bottom: 0; }
    .elemento-versione:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .titolo-v {
      font-weight: 500;
      color: var(--pmb-testo, #1f1f1f);
    }
    .dettagli-v {
      font-size: 12px;
      color: var(--pmb-testo-2, #5f6368);
    }
    .azioni {
      display: flex;
      gap: 8px;
    }
    .btn-azione {
      height: 30px;
      padding: 0 10px;
      border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 4px;
      background: var(--pmb-superficie, #ffffff);
      color: var(--pmb-accento, #0b57d0);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-azione:hover { background: var(--pmb-superficie-2, #f1f3f4); }
    .btn-azione.elimina { color: #d93025; }
    .vuoto {
      padding: 32px 16px;
      text-align: center;
      color: var(--pmb-testo-2, #70757a);
      font-size: 13px;
    }
    .piede {
      display: flex;
      justify-content: flex-end;
    }
    button.chiudi {
      height: 36px;
      padding: 0 20px;
      border: 0;
      border-radius: 18px;
      background: #0b57d0;
      color: #ffffff;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    button.chiudi:hover { background: #0842a0; }
  `;

  focalizza(): void {
    const input = this.renderRoot.querySelector<HTMLInputElement>('.campo-nome');
    if (input) input.focus();
    else this.renderRoot.querySelector<HTMLButtonElement>('button.chiudi')?.focus();
  }

  private chiudi = (): void => {
    this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true }));
  };

  private suCrea = (): void => {
    const nome = this.nomeNuovaVersione.trim();
    this.dispatchEvent(new CustomEvent('crea', {
      detail: { nome: nome || undefined },
      bubbles: true,
      composed: true,
    }));
    this.nomeNuovaVersione = '';
  };

  private suRipristina = (v: VersioneSalvata): void => {
    this.dispatchEvent(new CustomEvent('ripristina', {
      detail: { versione: v },
      bubbles: true,
      composed: true,
    }));
  };

  private suElimina = (id: string): void => {
    this.dispatchEvent(new CustomEvent('elimina', {
      detail: { id },
      bubbles: true,
      composed: true,
    }));
  };

  private formattaData(ms: number): string {
    const d = new Date(ms);
    const l = localeCorrente();
    return `${d.toLocaleDateString(l)} ${d.toLocaleTimeString(l, { hour: '2-digit', minute: '2-digit' })}`;
  }

  render() {
    return html`
      <div class="dialogo" role="dialog" aria-labelledby="titolo-versioni">
        <div class="testata">
          <h2 id="titolo-versioni">Cronologia versioni</h2>
          <button class="chiudi-x" aria-label="Chiudi" @click=${this.chiudi}>✕</button>
        </div>

        <div class="crea-versione">
          <input
            class="campo-nome"
            type="text"
            placeholder="Nome per la versione attuale (opzionale)"
            .value=${this.nomeNuovaVersione}
            @input=${(e: Event) => { this.nomeNuovaVersione = (e.target as HTMLInputElement).value; }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.suCrea(); }}
            aria-label="Nome per la versione"
          />
          <button class="bottone-salva" @click=${this.suCrea}>Salva versione</button>
        </div>

        <div class="lista-versioni" role="list">
          ${this.versioni.length === 0
            ? html`<div class="vuoto">Nessuna versione precedente salvata per questo documento.</div>`
            : this.versioni.map(
                (v) => html`
                  <div class="elemento-versione" role="listitem">
                    <div class="info">
                      <span class="titolo-v">${v.nome || t('Versione senza nome')}</span>
                      <span class="dettagli-v">${this.formattaData(v.salvato)} • ${v.parole} parole • ${v.caratteri} caratteri</span>
                    </div>
                    <div class="azioni">
                      <button class="btn-azione ripristina" @click=${() => this.suRipristina(v)}>Ripristina</button>
                      <button class="btn-azione elimina" @click=${() => this.suElimina(v.id)}>Elimina</button>
                    </div>
                  </div>
                `
              )}
        </div>

        <div class="piede">
          <button class="chiudi" @click=${this.chiudi}>Chiudi</button>
        </div>
      </div>
    `;
  }
}
