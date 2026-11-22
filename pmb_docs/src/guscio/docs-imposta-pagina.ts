import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';
import {
  type FormatoCarta,
  type OrientamentoPagina,
  type ImpostazioniPagina,
  FORMATI_CARTA,
  IMPOSTAZIONI_PREDEFINITE,
} from '../editor/pagine';

const PX_PER_CM = 96 / 2.54;

function pxACm(px: number): string {
  return (Math.round((px / PX_PER_CM) * 100) / 100).toString().replace('.', ',');
}

function cmAPx(cmStr: string, defaultPx: number): number {
  const norm = cmStr.trim().replace(',', '.');
  const n = parseFloat(norm);
  if (!Number.isFinite(n) || n < 0 || n > 20) return defaultPx;
  return Math.max(10, Math.round(n * PX_PER_CM));
}

export const COLORI_PAGINA: Array<{ colore: string; nome: string }> = [
  { colore: '#ffffff', nome: 'Bianco' },
  { colore: '#fdf6e2', nome: 'Avorio' },
  { colore: '#f0f0f0', nome: 'Grigio chiaro' },
  { colore: '#edf2fa', nome: 'Azzurro tenue' },
];

@customElement('docs-imposta-pagina')
export class DocsImpostaPagina extends LinguaElement {
  @property({ attribute: false })
  impostazioni: ImpostazioniPagina = { ...IMPOSTAZIONI_PREDEFINITE };

  @state() private orientamento: OrientamentoPagina = 'verticale';
  @state() private formato: FormatoCarta = 'A4';
  @state() private margineAlto = '2,54';
  @state() private margineBasso = '2,54';
  @state() private margineSinistro = '2,54';
  @state() private margineDestro = '2,54';
  @state() private coloreSfondo = '#ffffff';

  static styles = css`
    :host {
      display: block;
      font: 14px Roboto, Arial, sans-serif;
      color: var(--pmb-testo, #1f1f1f);
    }
    .velo {
      position: fixed;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dialogo {
      width: 440px;
      box-sizing: border-box;
      padding: 24px;
      background: var(--pmb-superficie, #ffffff);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
    h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 500;
      color: var(--pmb-testo, #1f1f1f);
    }
    .sezione {
      margin-bottom: 16px;
    }
    .sezione-titolo {
      font-size: 13px;
      font-weight: 500;
      color: var(--pmb-testo-2, #444746);
      margin-bottom: 8px;
    }
    .opzioni-radio {
      display: flex;
      gap: 20px;
    }
    .opzione-radio {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    select {
      width: 100%;
      height: 36px;
      border: 1px solid var(--pmb-bordo, #c4c7c5);
      border-radius: 4px;
      padding: 0 8px;
      font: inherit;
      color: inherit;
      background: var(--pmb-superficie, #ffffff);
      outline: none;
    }
    select:focus {
      border-color: #0b57d0;
    }
    .griglia-margini {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .campo-margine {
      display: flex;
      flex-direction: column;
    }
    .campo-margine label {
      font-size: 12px;
      color: var(--pmb-testo-2, #444746);
      margin-bottom: 2px;
    }
    .campo-margine input {
      height: 32px;
      border: 1px solid var(--pmb-bordo, #c4c7c5);
      border-radius: 4px;
      padding: 0 8px;
      font: inherit;
      color: inherit;
      outline: none;
    }
    .campo-margine input:focus {
      border-color: #0b57d0;
    }
    .pulsanti {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }
    button {
      height: 36px;
      padding: 0 16px;
      border: 0;
      border-radius: 18px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    button.annulla {
      background: none;
      color: var(--pmb-accento, #0b57d0);
    }
    button.annulla:hover {
      background: var(--pmb-superficie-2, #f1f3f4);
    }
    button.ok {
      background: #0b57d0;
      color: #ffffff;
    }
    button.ok:hover {
      background: #0842a0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.orientamento = this.impostazioni.orientamento;
    this.formato = this.impostazioni.formato;
    this.margineAlto = pxACm(this.impostazioni.margineAlto);
    this.margineBasso = pxACm(this.impostazioni.margineBasso);
    this.margineSinistro = pxACm(this.impostazioni.margineSinistro);
    this.margineDestro = pxACm(this.impostazioni.margineDestro);
    this.coloreSfondo = this.impostazioni.coloreSfondo;
  }

  focalizza(): void {
    this.renderRoot.querySelector<HTMLButtonElement>('button.ok')?.focus();
  }

  private emetti(nome: string, detail: object = {}): void {
    this.dispatchEvent(new CustomEvent(nome, { detail, bubbles: true, composed: true }));
  }

  private suTasto = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.emetti('chiudi');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.applica();
    }
  };

  private applica(): void {
    const nuoveImpostazioni: ImpostazioniPagina = {
      formato: this.formato,
      orientamento: this.orientamento,
      margineAlto: cmAPx(this.margineAlto, this.impostazioni.margineAlto),
      margineBasso: cmAPx(this.margineBasso, this.impostazioni.margineBasso),
      margineSinistro: cmAPx(this.margineSinistro, this.impostazioni.margineSinistro),
      margineDestro: cmAPx(this.margineDestro, this.impostazioni.margineDestro),
      coloreSfondo: this.coloreSfondo,
    };
    this.emetti('applica', { impostazioni: nuoveImpostazioni });
  }

  render() {
    return html`
      <div class="velo" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.emetti('chiudi'); }} @keydown=${this.suTasto}>
        <div class="dialogo" role="dialog" aria-label="Impostazione pagina">
          <h2>Impostazione pagina</h2>

          <div class="sezione">
            <div class="sezione-titolo">Orientamento</div>
            <div class="opzioni-radio">
              <label class="opzione-radio">
                <input
                  type="radio"
                  name="orientamento"
                  value="verticale"
                  .checked=${this.orientamento === 'verticale'}
                  @change=${() => { this.orientamento = 'verticale'; }}
                />
                Verticale
              </label>
              <label class="opzione-radio">
                <input
                  type="radio"
                  name="orientamento"
                  value="orizzontale"
                  .checked=${this.orientamento === 'orizzontale'}
                  @change=${() => { this.orientamento = 'orizzontale'; }}
                />
                Orizzontale
              </label>
            </div>
          </div>

          <div class="sezione">
            <div class="sezione-titolo">Formato carta</div>
            <select
              aria-label="Formato carta"
              @change=${(e: Event) => { this.formato = (e.target as HTMLSelectElement).value as FormatoCarta; }}
            >
              ${(Object.keys(FORMATI_CARTA) as FormatoCarta[]).map((f) => html`
                <option value=${f} ?selected=${this.formato === f}>
                  ${t(FORMATI_CARTA[f].etichetta)}
                </option>
              `)}
            </select>
          </div>

          <div class="sezione">
            <div class="sezione-titolo">Colore pagina</div>
            <select
              aria-label="Colore pagina"
              @change=${(e: Event) => { this.coloreSfondo = (e.target as HTMLSelectElement).value; }}
            >
              ${COLORI_PAGINA.map((c) => html`
                <option value=${c.colore} ?selected=${this.coloreSfondo === c.colore}>
                  ${t(c.nome)}
                </option>
              `)}
            </select>
          </div>

          <div class="sezione">
            <div class="sezione-titolo">Margini (cm)</div>
            <div class="griglia-margini">
              <div class="campo-margine">
                <label for="m-alto">Superiore</label>
                <input
                  id="m-alto"
                  type="text"
                  .value=${this.margineAlto}
                  @input=${(e: Event) => { this.margineAlto = (e.target as HTMLInputElement).value; }}
                />
              </div>
              <div class="campo-margine">
                <label for="m-basso">Inferiore</label>
                <input
                  id="m-basso"
                  type="text"
                  .value=${this.margineBasso}
                  @input=${(e: Event) => { this.margineBasso = (e.target as HTMLInputElement).value; }}
                />
              </div>
              <div class="campo-margine">
                <label for="m-sinistro">Sinistro</label>
                <input
                  id="m-sinistro"
                  type="text"
                  .value=${this.margineSinistro}
                  @input=${(e: Event) => { this.margineSinistro = (e.target as HTMLInputElement).value; }}
                />
              </div>
              <div class="campo-margine">
                <label for="m-destro">Destro</label>
                <input
                  id="m-destro"
                  type="text"
                  .value=${this.margineDestro}
                  @input=${(e: Event) => { this.margineDestro = (e.target as HTMLInputElement).value; }}
                />
              </div>
            </div>
          </div>

          <div class="pulsanti">
            <button class="annulla" @click=${() => this.emetti('chiudi')}>Annulla</button>
            <button class="ok" @click=${() => this.applica()}>OK</button>
          </div>
        </div>
      </div>
    `;
  }
}
