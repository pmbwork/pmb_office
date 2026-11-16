// Intestazione e piè di pagina disegnati nel margine di ogni foglio, uguali su tutte le pagine, coi campi del numero di pagina e di pagine.
// Stanno in uno strato a parte (non nel testo): non cambiano l'impaginazione, non prendono i clic e si stampano coi fogli.
// L'intestazione comincia a 48 px dal bordo alto del foglio, il piè di pagina finisce a 48 px dal bordo basso; ognuno ha 48 px di altezza
// (3 righe da 11 punti): quello che non ci sta non si vede. Le misure orizzontali sono quelle del testo (96 px dai bordi).
import { paragrafiConCampi, type Documento, type Paragrafo } from '../modello/documento';
import { disegna } from './render';

export const DISTANZA_MARGINE = 48;
export const ALTEZZA_MARGINE = 48;

function creaPagina(d: Document): HTMLElement {
  const pagina = d.createElement('div');
  pagina.className = 'margine-pagina';
  const intestazione = d.createElement('div');
  intestazione.className = 'intestazione';
  const piede = d.createElement('div');
  piede.className = 'piede';
  pagina.appendChild(intestazione);
  pagina.appendChild(piede);
  return pagina;
}

function riempi(zona: HTMLElement, paragrafi: Paragrafo[] | undefined, pagina: number, pagine: number): void {
  if (paragrafi === undefined) { while (zona.firstChild) zona.removeChild(zona.firstChild); return; }
  disegna(zona, { paragrafi: paragrafiConCampi(paragrafi, pagina, pagine) });
}

/**
 * Disegna intestazione e piè di pagina in `strato`: un blocco per pagina, alto quanto la pagina e messo dove comincia
 * (posizione(i) dà i pixel dall'alto per la pagina i, da 0). Chiamarla di nuovo aggiorna quello che c'è.
 */
export function disegnaMargini(strato: HTMLElement, doc: Documento, pagine: number, posizione: (i: number) => number, altezzaPagina: number): void {
  const d = strato.ownerDocument;
  while (strato.children.length > pagine) strato.lastElementChild?.remove();
  while (strato.children.length < pagine) strato.appendChild(creaPagina(d));
  (Array.from(strato.children) as HTMLElement[]).forEach((pagina, i) => {
    pagina.style.top = `${posizione(i)}px`;
    pagina.style.height = `${altezzaPagina}px`;
    riempi(pagina.querySelector('.intestazione') as HTMLElement, doc.intestazione, i + 1, pagine);
    riempi(pagina.querySelector('.piede') as HTMLElement, doc.piede, i + 1, pagine);
  });
}
