import { css } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, state } from 'lit/decorators.js';
import { t } from '../i18n/lingua';

export interface SimboloItem {
  char: string;
  nome: string;
  categoria: 'frecce' | 'valute' | 'matematica' | 'tipografia' | 'greco';
}

export const CATALOGO_SIMBOLI: SimboloItem[] = [
  // Frecce
  { char: '←', nome: 'Freccia sinistra', categoria: 'frecce' },
  { char: '→', nome: 'Freccia destra', categoria: 'frecce' },
  { char: '↑', nome: 'Freccia su', categoria: 'frecce' },
  { char: '↓', nome: 'Freccia giù', categoria: 'frecce' },
  { char: '↔', nome: 'Freccia sinistra destra', categoria: 'frecce' },
  { char: '↕', nome: 'Freccia su giù', categoria: 'frecce' },
  { char: '⇒', nome: 'Doppia freccia destra implica', categoria: 'frecce' },
  { char: '⇐', nome: 'Doppia freccia sinistra', categoria: 'frecce' },
  { char: '⇔', nome: 'Doppia freccia equivalenza', categoria: 'frecce' },
  { char: '↵', nome: 'Freccia a capo invio', categoria: 'frecce' },

  // Valute
  { char: '€', nome: 'Euro', categoria: 'valute' },
  { char: '$', nome: 'Dollaro', categoria: 'valute' },
  { char: '£', nome: 'Sterlina', categoria: 'valute' },
  { char: '¥', nome: 'Yen', categoria: 'valute' },
  { char: '₹', nome: 'Rupia indiana', categoria: 'valute' },
  { char: '₽', nome: 'Rublo russo', categoria: 'valute' },
  { char: '¢', nome: 'Cent', categoria: 'valute' },
  { char: '₩', nome: 'Won coreano', categoria: 'valute' },
  { char: '₿', nome: 'Bitcoin', categoria: 'valute' },

  // Matematica
  { char: '±', nome: 'Più o meno', categoria: 'matematica' },
  { char: '×', nome: 'Per moltiplicazione', categoria: 'matematica' },
  { char: '÷', nome: 'Diviso divisione', categoria: 'matematica' },
  { char: '≠', nome: 'Diverso', categoria: 'matematica' },
  { char: '≈', nome: 'Circa uguale approssimato', categoria: 'matematica' },
  { char: '≤', nome: 'Minore o uguale', categoria: 'matematica' },
  { char: '≥', nome: 'Maggiore o uguale', categoria: 'matematica' },
  { char: '∞', nome: 'Infinito', categoria: 'matematica' },
  { char: '√', nome: 'Radice quadrata', categoria: 'matematica' },
  { char: '∑', nome: 'Sommatoria', categoria: 'matematica' },
  { char: '∏', nome: 'Produttoria', categoria: 'matematica' },
  { char: 'π', nome: 'Pi greco', categoria: 'matematica' },
  { char: '°', nome: 'Gradi', categoria: 'matematica' },
  { char: '‰', nome: 'Per mille', categoria: 'matematica' },
  { char: 'µ', nome: 'Micro', categoria: 'matematica' },

  // Tipografia
  { char: '“', nome: 'Virgoletta doppia aperta', categoria: 'tipografia' },
  { char: '”', nome: 'Virgoletta doppia chiusa', categoria: 'tipografia' },
  { char: '‘', nome: 'Virgoletta singola aperta', categoria: 'tipografia' },
  { char: '’', nome: 'Apostrofo virgoletta singola chiusa', categoria: 'tipografia' },
  { char: '«', nome: 'Caporale aperto', categoria: 'tipografia' },
  { char: '»', nome: 'Caporale chiuso', categoria: 'tipografia' },
  { char: '—', nome: 'Trattino lungo em dash', categoria: 'tipografia' },
  { char: '–', nome: 'Trattino medio en dash', categoria: 'tipografia' },
  { char: '…', nome: 'Puntini di sospensione ellissi', categoria: 'tipografia' },
  { char: '©', nome: 'Copyright', categoria: 'tipografia' },
  { char: '®', nome: 'Marchio registrato', categoria: 'tipografia' },
  { char: '™', nome: 'Trademark', categoria: 'tipografia' },
  { char: '•', nome: 'Punto elenco bullet', categoria: 'tipografia' },
  { char: '§', nome: 'Paragrafo sezione', categoria: 'tipografia' },
  { char: '¶', nome: 'Piede di mosca pilcrow', categoria: 'tipografia' },

  // Greco
  { char: 'α', nome: 'Alpha minuscola', categoria: 'greco' },
  { char: 'β', nome: 'Beta minuscola', categoria: 'greco' },
  { char: 'γ', nome: 'Gamma minuscola', categoria: 'greco' },
  { char: 'δ', nome: 'Delta minuscola', categoria: 'greco' },
  { char: 'ε', nome: 'Epsilon minuscola', categoria: 'greco' },
  { char: 'θ', nome: 'Theta minuscola', categoria: 'greco' },
  { char: 'λ', nome: 'Lambda minuscola', categoria: 'greco' },
  { char: 'μ', nome: 'Mu minuscola', categoria: 'greco' },
  { char: 'σ', nome: 'Sigma minuscola', categoria: 'greco' },
  { char: 'φ', nome: 'Phi minuscola', categoria: 'greco' },
  { char: 'ω', nome: 'Omega minuscola', categoria: 'greco' },
  { char: 'Δ', nome: 'Delta maiuscola', categoria: 'greco' },
  { char: 'Ω', nome: 'Omega maiuscola', categoria: 'greco' },
];

@customElement('docs-simboli')
export class DocsSimboli extends LinguaElement {
  @state() private categoriaSelezionata: string = 'tutti';
  @state() private filtro: string = '';

  static styles = css`
    :host-context([alto-contrasto]) button { color: #000000; }
    :host-context([alto-contrasto]) button:hover { outline: 2px solid #000000; outline-offset: -2px; }
    :host-context([alto-contrasto]) button:focus-visible, :host-context([alto-contrasto]) input:focus-visible, :host-context([alto-contrasto]) select:focus-visible { outline: 3px solid #000000; outline-offset: 1px; }
    :host-context([alto-contrasto]) button.attivo, :host-context([alto-contrasto]) button[aria-checked="true"], :host-context([alto-contrasto]) button[aria-pressed="true"] { background: #000000; color: #ffffff; }
    :host-context([riduci-animazioni]) * { transition: none !important; animation: none !important; }

    :host { display: block; font: 14px Roboto, Arial, sans-serif; color: var(--pmb-testo, #1f1f1f); }
    .dialogo {
      width: 480px;
      box-sizing: border-box;
      padding: 20px;
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
    .barra-filtri {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      align-items: center;
    }
    .cerca {
      flex: 1;
      height: 32px;
      box-sizing: border-box;
      padding: 0 10px;
      border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 4px;
      font: inherit;
      outline: none;
    }
    .cerca:focus { border-color: #0b57d0; }
    .categorie {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .cat-btn {
      padding: 4px 10px;
      border: 1px solid var(--pmb-bordo, #dadce0);
      border-radius: 14px;
      background: var(--pmb-superficie, #ffffff);
      color: var(--pmb-testo-2, #444746);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    .cat-btn:hover { background: var(--pmb-superficie-2, #f8f9fa); }
    .cat-btn.attivo {
      background: var(--pmb-selezione, #e8f0fe);
      color: var(--pmb-accento, #0b57d0);
      border-color: #d2e3fc;
      font-weight: 500;
    }
    .griglia {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      gap: 6px;
      max-height: 240px;
      overflow-y: auto;
      padding: 4px;
      border: 1px solid var(--pmb-bordo, #e0e0e0);
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .tasto-simbolo {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      border: 1px solid var(--pmb-bordo, #e8eaed);
      border-radius: 4px;
      background: var(--pmb-superficie, #ffffff);
      color: var(--pmb-testo, #1f1f1f);
      cursor: pointer;
      user-select: none;
      transition: background-color 0.1s, transform 0.05s;
    }
    .tasto-simbolo:hover {
      background: var(--pmb-superficie-2, #f1f3f4);
      border-color: var(--pmb-bordo, #dadce0);
      transform: scale(1.08);
    }
    .tasto-simbolo:focus {
      outline: 2px solid #0b57d0;
      outline-offset: -1px;
    }
    .vuoto {
      grid-column: 1 / -1;
      padding: 32px 0;
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
    const input = this.renderRoot.querySelector<HTMLInputElement>('.cerca');
    if (input) input.focus();
    else this.renderRoot.querySelector<HTMLButtonElement>('button.chiudi')?.focus();
  }

  private seleziona(simbolo: string): void {
    this.dispatchEvent(new CustomEvent('inserisci', {
      detail: { simbolo },
      bubbles: true,
      composed: true,
    }));
  }

  private chiudi = (): void => {
    this.dispatchEvent(new CustomEvent('chiudi', { bubbles: true, composed: true }));
  };

  private suCerca = (e: Event): void => {
    this.filtro = (e.target as HTMLInputElement).value.trim().toLowerCase();
  };

  private simboliFiltrati(): SimboloItem[] {
    return CATALOGO_SIMBOLI.filter((s) => {
      if (this.categoriaSelezionata !== 'tutti' && s.categoria !== this.categoriaSelezionata) {
        return false;
      }
      if (this.filtro) {
        return s.nome.toLowerCase().includes(this.filtro) || t(s.nome).toLowerCase().includes(this.filtro) || s.char.includes(this.filtro);
      }
      return true;
    });
  }

  render() {
    const simboli = this.simboliFiltrati();
    const categorie = [
      { id: 'tutti', label: 'Tutti' },
      { id: 'frecce', label: 'Frecce' },
      { id: 'valute', label: 'Valute' },
      { id: 'matematica', label: 'Matematica' },
      { id: 'tipografia', label: 'Tipografia' },
      { id: 'greco', label: 'Greco' },
    ];

    return html`
      <div class="dialogo" role="dialog" aria-labelledby="titolo-simboli">
        <div class="testata">
          <h2 id="titolo-simboli">Caratteri speciali e simboli</h2>
          <button class="chiudi-x" aria-label="Chiudi" @click=${this.chiudi}>✕</button>
        </div>

        <div class="barra-filtri">
          <input
            class="cerca"
            type="search"
            placeholder="Cerca simbolo o nome..."
            .value=${this.filtro}
            @input=${this.suCerca}
            aria-label="Cerca simbolo"
          />
        </div>

        <div class="categorie">
          ${categorie.map(
            (c) => html`
              <button
                class="cat-btn ${this.categoriaSelezionata === c.id ? 'attivo' : ''}"
                @click=${() => { this.categoriaSelezionata = c.id; }}
              >
                ${t(c.label)}
              </button>
            `
          )}
        </div>

        <div class="griglia" role="grid">
          ${simboli.length === 0
            ? html`<div class="vuoto">Nessun simbolo trovato</div>`
            : simboli.map(
                (s) => html`
                  <button
                    class="tasto-simbolo"
                    title="${t(s.nome)}"
                    aria-label="${t(s.nome)}"
                    @click=${() => this.seleziona(s.char)}
                  >
                    ${s.char}
                  </button>
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
