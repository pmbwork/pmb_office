// Il minigrafico nella cella (funzione SPARKLINE, come in Fogli Google; il comando Inserisci › Minigrafico la scrive): il motore dà
// il testo «SPARKLINE:tipo:valori», qui lo si disegna in SVG grande quanto la cella. Linea o colonne; colonne negative in rosso.
import { svg, type TemplateResult } from 'lit';

export interface Minigrafico { tipo: 'line' | 'column'; valori: number[] }

/** Il minigrafico scritto dal motore, o null se il testo non lo è. */
export function leggiMinigrafico(testo: string): Minigrafico | null {
  const m = /^SPARKLINE:(line|column):(-?[\d.eE+-]+(?:,-?[\d.eE+-]+)*)$/.exec(testo);
  if (!m) return null;
  const valori = m[2].split(',').map(Number).filter(Number.isFinite);
  return valori.length > 0 ? { tipo: m[1] as 'line' | 'column', valori } : null;
}

/** L'SVG del minigrafico in uno spazio largo l e alto a (in pixel), con il colore del testo della cella. */
export function disegnaMinigrafico(g: Minigrafico, l: number, a: number, colore?: string): TemplateResult {
  const w = Math.max(10, l), h = Math.max(6, a);
  const min = Math.min(0, ...g.valori), max = Math.max(0, ...g.valori);
  const intervallo = max - min || 1;
  const y = (v: number): number => h - 1 - ((v - min) / intervallo) * (h - 2);
  const tinta = colore || 'var(--color-accent, #1a73e8)';
  if (g.tipo === 'column') {
    const n = g.valori.length, passo = w / n, larga = Math.max(1, passo * 0.75), zero = y(0);
    return svg`<svg class="minigrafico" width=${w} height=${h} viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true">${g.valori.map((v, i) => {
      const cima = Math.min(zero, y(v)), alto = Math.max(1, Math.abs(zero - y(v)));
      return svg`<rect x=${i * passo + (passo - larga) / 2} y=${cima} width=${larga} height=${alto} fill=${v < 0 ? '#d93025' : tinta}></rect>`;
    })}</svg>`;
  }
  const n = g.valori.length;
  const punti = g.valori.map((v, i) => `${n === 1 ? w / 2 : (i / (n - 1)) * (w - 2) + 1},${y(v)}`).join(' ');
  return svg`<svg class="minigrafico" width=${w} height=${h} viewBox="0 0 ${w} ${h}" role="img" aria-hidden="true"><polyline points=${punti} fill="none" stroke=${tinta} stroke-width="1.5" stroke-linejoin="round"></polyline></svg>`;
}
