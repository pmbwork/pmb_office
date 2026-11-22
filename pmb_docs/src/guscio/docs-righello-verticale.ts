// Righello verticale di pmb_docs: striscia a sinistra del primo foglio con le tacche in centimetri e due indicatori
// per il margine alto e il margine basso, trascinabili. Disegnato con SVG (attributi, non stili in linea).
import { css, svg } from 'lit';
import { html } from '../i18n/html';
import { LinguaElement } from '../i18n/lingua-element';
import { customElement, property } from 'lit/decorators.js';
import { tacche } from './righello';

export interface GeometriaVerticale { altezza: number; margineAlto: number; margineBasso: number }

export const LARGHEZZA_RIGHELLO_VERTICALE = 18;
/** margine minimo e spazio minimo che deve restare per il testo (px) */
export const MARGINE_MINIMO = 20;
export const TESTO_MINIMO = 100;

/** Il nuovo valore di un margine dopo uno spostamento di `delta` pixel, tenuto dentro i limiti. */
export function margineTrascinato(tipo: 'alto' | 'basso', iniziale: number, delta: number, g: GeometriaVerticale): number {
  const altro = tipo === 'alto' ? g.margineBasso : g.margineAlto;
  const massimo = Math.max(MARGINE_MINIMO, g.altezza - altro - TESTO_MINIMO);
  const voluto = Math.round(tipo === 'alto' ? iniziale + delta : iniziale - delta);
  return Math.max(MARGINE_MINIMO, Math.min(massimo, voluto));
}

@customElement('docs-righello-verticale')
export class DocsRighelloVerticale extends LinguaElement {
  @property({ attribute: false }) geometria: GeometriaVerticale = { altezza: 1123, margineAlto: 96, margineBasso: 96 };
  /** zoom del foglio (1 = 100%): gli spostamenti del mouse vanno divisi per questo */
  @property({ type: Number }) zoom = 1;

  static styles = css`
    :host { display: block; line-height: 0; }
    svg { display: block; }
    text { font: 10px Roboto, Arial, sans-serif; fill: var(--pmb-testo-2, #444746); text-anchor: middle; }
    .tacca { stroke: var(--pmb-bordo, #c4c7c5); stroke-width: 1; }
    .tacca.scura { stroke: var(--pmb-bordo-forte, #747775); }
    .area-margine { fill: var(--pmb-hover, #e8eaed); }
    .indicatore-drag { cursor: ns-resize; }
    .indicatore { fill: #4285f4; }
  `;

  private suMouseGiu(e: MouseEvent, tipo: 'alto' | 'basso'): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const g0 = { ...this.geometria };
    const iniziale = tipo === 'alto' ? g0.margineAlto : g0.margineBasso;
    const suMuovi = (ev: MouseEvent): void => {
      const delta = (ev.clientY - startY) / (this.zoom || 1);
      const valore = margineTrascinato(tipo, iniziale, delta, g0);
      this.dispatchEvent(new CustomEvent('cambio-margine-v', { detail: { tipo, valore }, bubbles: true, composed: true }));
    };
    const suSu = (): void => {
      window.removeEventListener('mousemove', suMuovi);
      window.removeEventListener('mouseup', suSu);
      this.dispatchEvent(new CustomEvent('fine-margine', { bubbles: true, composed: true }));
    };
    window.addEventListener('mousemove', suMuovi);
    window.addEventListener('mouseup', suSu);
  }

  render() {
    const g = this.geometria;
    const w = LARGHEZZA_RIGHELLO_VERTICALE;
    const sopra = g.margineAlto;
    const sotto = g.altezza - g.margineBasso;
    const scura = (y: number): boolean => y <= sopra + 0.01 || y >= sotto - 0.01;
    const indicatore = (y: number, tipo: 'alto' | 'basso') => svg`<g class="indicatore-drag" data-tipo=${tipo} @mousedown=${(e: MouseEvent) => this.suMouseGiu(e, tipo)}><polygon class="indicatore" data-tipo=${tipo} points="${w - 12},${y - 5.5} ${w - 1},${y - 5.5} ${w - 1},${y + 5.5} ${w - 12},${y + 5.5}" /></g>`;
    // le tacche sono quelle del righello orizzontale, con lo zero sul margine alto
    const ticche = tacche({ larghezza: g.altezza, margineSinistro: g.margineAlto, margineDestro: g.margineBasso });
    return html`<svg role="img" aria-label="Righello verticale in centimetri" width=${w} height=${g.altezza} viewBox="0 0 ${w} ${g.altezza}">
      <rect class="area-margine" x="0" y="0" width=${w} height=${sopra} />
      <rect class="area-margine" x="0" y=${sotto} width=${w} height=${g.margineBasso} />
      ${ticche.map((c) => {
        const y = c.x - 0.5;
        const colore = scura(c.x) ? ' scura' : '';
        if (c.etichetta !== undefined) {
          if (Math.abs(c.x - sopra) < 9 || Math.abs(c.x - sotto) < 9) return svg`<line class=${`tacca${colore}`} x1=${w - 8} x2=${w - 1} y1=${y} y2=${y} />`;
          return svg`<text x="7" y=${y + 3.5}>${c.etichetta}</text><line class=${`tacca${colore}`} x1=${w - 5} x2=${w - 1} y1=${y} y2=${y} />`;
        }
        const lunga = c.tipo === 'mezzo' ? 7 : c.tipo === 'cm' ? 8 : 4;
        return svg`<line class=${`tacca${colore}`} x1=${w - lunga} x2=${w - 1} y1=${y} y2=${y} />`;
      })}
      ${indicatore(sopra, 'alto')}
      ${indicatore(sotto, 'basso')}
    </svg>`;
  }
}
