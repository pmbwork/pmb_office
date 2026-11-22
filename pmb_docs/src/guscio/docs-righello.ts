// Righello di pmb_docs: striscia con le tacche in centimetri, larga come il foglio, come in Google Documenti.
// Le tacche del mezzo centimetro sono alte, quelle del quarto basse, i numeri stanno sopra la linea; nei margini le tacche sono
// scure e nel testo chiare; due indicatori blu segnano i margini. Disegnato con SVG (attributi, non stili in linea).
import { css, svg } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { RIGHELLO_A4, margini, tacche, type GeometriaRighello } from './righello';

const TACCA_ALTA = 8;
const TACCA_BASSA = 4;

@customElement('docs-righello')
export class DocsRighello extends LinguaElement {
  @property({ attribute: false }) geometria: GeometriaRighello = RIGHELLO_A4;
  @property({ type: Number }) altezza = 16;

  static styles = css`
    :host { display: block; line-height: 0; }
    svg { display: block; }
    text { font: 11px Roboto, Arial, sans-serif; fill: var(--pmb-testo-2, #444746); text-anchor: middle; }
    .margine, .testo-area { fill: none; }
    .tacca { stroke: var(--pmb-bordo, #c4c7c5); stroke-width: 1; }
    .tacca.scura { stroke: var(--pmb-bordo-forte, #747775); }
    .tacca-cm { stroke: var(--pmb-bordo, #c4c7c5); stroke-width: 1; }
    .tacca-cm.scura { stroke: var(--pmb-bordo-forte, #747775); }
    .punto { fill: var(--pmb-bordo, #c4c7c5); }
    .punto.scura { fill: var(--pmb-bordo-forte, #747775); }
    .indicatore-drag { cursor: ew-resize; }
    .indicatore { fill: #4285f4; cursor: ew-resize; }
  `;

  private suMouseGiuIndicatore(e: MouseEvent, tipo: 'sinistro' | 'destro'): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const valIniziale = tipo === 'sinistro' ? this.geometria.margineSinistro : this.geometria.margineDestro;
    let valAttuale = valIniziale;

    const suMuovi = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (tipo === 'sinistro') {
        valAttuale = Math.max(20, Math.min(this.geometria.larghezza / 2, Math.round(valIniziale + dx)));
      } else {
        valAttuale = Math.max(20, Math.min(this.geometria.larghezza / 2, Math.round(valIniziale - dx)));
      }
      this.dispatchEvent(new CustomEvent('cambio-margine', { detail: { tipo, valore: valAttuale }, bubbles: true, composed: true }));
    };

    const suSu = () => {
      window.removeEventListener('mousemove', suMuovi);
      window.removeEventListener('mouseup', suSu);
      this.dispatchEvent(new CustomEvent('fine-margine', { bubbles: true, composed: true }));
    };

    window.addEventListener('mousemove', suMuovi);
    window.addEventListener('mouseup', suSu);
  }

  /** Imposta direttamente uno dei margini del righello (in pixel). */
  impostaMargine(tipo: 'sinistro' | 'destro', valore: number): void {
    const g = { ...this.geometria };
    if (tipo === 'sinistro') g.margineSinistro = Math.max(0, valore);
    else g.margineDestro = Math.max(0, valore);
    this.geometria = g;
  }

  render() {
    const g = this.geometria;
    const h = this.altezza;
    const sinistra = g.margineSinistro;
    const destra = g.larghezza - g.margineDestro;
    const scura = (x: number): boolean => x <= sinistra + 0.01 || x >= destra - 0.01;
    const indicatore = (x: number, tipo: 'sinistro' | 'destro') => svg`<g class="indicatore-drag" data-tipo=${tipo} @mousedown=${(e: MouseEvent) => this.suMouseGiuIndicatore(e, tipo)}><rect class="indicatore" data-tipo=${tipo} x=${x - 5.5} y="2" width="12" height="4" /><polygon class="indicatore" data-tipo=${tipo} points="${x - 5.5},6 ${x + 6.5},6 ${x + 0.5},12.5" /></g>`;
    return html`<svg role="img" aria-label="Righello in centimetri" width=${g.larghezza} height=${h} viewBox="0 0 ${g.larghezza} ${h}">
      <rect class="testo-area" x="0" y="0" width=${g.larghezza} height=${h} />
      ${margini(g).map((m) => svg`<rect class="margine" x=${m.x} y="0" width=${m.larghezza} height=${h} />`)}
      ${tacche(g).map((c) => {
        const x = c.x - 0.5;
        const colore = scura(c.x) ? ' scura' : '';
        if (c.etichetta !== undefined && (Math.abs(c.x - sinistra) < 9 || Math.abs(c.x - destra) < 9)) return svg`<line class=${`tacca-cm${colore}`} x1=${x} x2=${x} y1=${h - TACCA_BASSA - 1} y2=${h - 1} />`;
        if (c.etichetta !== undefined) {
          return svg`<text x=${c.x - 0.5} y="9">${c.etichetta}</text><line class=${`tacca-cm${colore}`} x1=${x} x2=${x} y1=${h - TACCA_BASSA - 1} y2=${h - 1} />`;
        }
        if (c.tipo === 'cm' || c.tipo === 'mezzo') {
          const alta = c.tipo === 'mezzo' ? TACCA_ALTA : TACCA_BASSA;
          return svg`<line class=${`tacca${colore}`} x1=${x} x2=${x} y1=${h - alta - 1} y2=${h - 1} />`;
        }
        return svg`<rect class=${`punto${colore}`} x=${x - 0.5} y=${h - TACCA_BASSA - 1} width="1" height=${TACCA_BASSA} />`;
      })}
      ${indicatore(sinistra - 0.5, 'sinistro')}
      ${indicatore(destra - 0.5, 'destro')}
    </svg>`;
  }
}
