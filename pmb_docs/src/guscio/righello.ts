// Righello di pmb_docs: dove cadono le tacche (in centimetri) sulla larghezza del foglio. Parte pura.
// Lo zero è sul margine sinistro: i numeri crescono verso destra e, nel margine sinistro, verso sinistra (come in Google Documenti).

/** pixel per centimetro a 96 punti per pollice */
export const PX_PER_CM = 96 / 2.54;

export interface GeometriaRighello { larghezza: number; margineSinistro: number; margineDestro: number }
/** Foglio A4 di pmb_docs: 794 px di larghezza e margini di un pollice. */
export const RIGHELLO_A4: GeometriaRighello = { larghezza: 794, margineSinistro: 96, margineDestro: 96 };

export type TipoTacca = 'cm' | 'mezzo' | 'quarto';
export interface Tacca {
  /** posizione dal bordo sinistro del foglio, in px, arrotondata al centesimo */
  x: number;
  tipo: TipoTacca;
  /** il numero scritto sopra la tacca dei centimetri (mai sullo zero) */
  etichetta?: string;
}

/** Le tacche del righello da sinistra a destra: un centimetro ogni 4 quarti, mezzo centimetro ogni 2 quarti. */
export function tacche(g: GeometriaRighello = RIGHELLO_A4): Tacca[] {
  const quarto = PX_PER_CM / 4;
  const primo = -Math.floor(g.margineSinistro / quarto + 1e-9);
  const ultimo = Math.floor((g.larghezza - g.margineSinistro) / quarto + 1e-9);
  const out: Tacca[] = [];
  for (let k = primo; k <= ultimo; k++) {
    const x = Math.round((g.margineSinistro + k * quarto) * 100) / 100;
    if (x < 0 || x > g.larghezza) continue;
    if (k % 4 === 0) out.push(k === 0 ? { x, tipo: 'cm' } : { x, tipo: 'cm', etichetta: String(Math.abs(k / 4)) });
    else out.push({ x, tipo: k % 2 === 0 ? 'mezzo' : 'quarto' });
  }
  return out;
}

/** Posizione e larghezza delle due zone di margine (sinistra e destra), per colorarle diversamente dal testo. */
export function margini(g: GeometriaRighello = RIGHELLO_A4): Array<{ x: number; larghezza: number }> {
  return [
    { x: 0, larghezza: g.margineSinistro },
    { x: g.larghezza - g.margineDestro, larghezza: g.margineDestro },
  ];
}
