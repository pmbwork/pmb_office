import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ICONE_DOCS } from './icone';
import { t } from '../i18n/lingua';

/** Comandi della barra che non sono icone ma caselle di testo (menu a tendina o campo). Marcatore: TESTI_CASELLE_T028 */
export const TESTI_CASELLE: Record<string, string> = {
  'zoom': '100% ▾',
  'stile-paragrafo': 'Testo nor… ▾',
  'carattere': 'Arial ▾',
  'corpo': '11',
};

/** Il testo di una casella con il segno ▾ in fondo: si traduce il testo e il segno resta. */
function traduciCasella(testo: string): string {
  const m = /^(.*?)( ▾)?$/.exec(testo)!;
  return t(m[1]) + (m[2] ?? '');
}

/** Contenuto del pulsante: il testo della casella (quello corrente se passato in valori) oppure l'icona SVG. */
export function contenutoComando(id: string, valori?: Record<string, string>) {
  const testo = valori?.[id] ?? TESTI_CASELLE[id];
  // solo lo stile del paragrafo si traduce: il nome del carattere, lo zoom e il corpo restano come sono
  return testo !== undefined ? (id === 'stile-paragrafo' ? traduciCasella(testo) : testo) : unsafeHTML(ICONE_DOCS[id] ?? '');
}
