// Come si mostrano i numeri: all'italiana (virgola decimale, punto per le migliaia) o all'inglese (il contrario). Dentro il foglio i numeri
// restano sempre nella forma canonica; questo cambia solo il testo che si vede.
export type LocaleNumeri = 'it' | 'en';

let corrente: LocaleNumeri = 'en';

/** La lingua con cui si mostrano i numeri da qui in poi. */
export function impostaLocaleNumeri(locale: LocaleNumeri): void { corrente = locale; }

export function localeNumeri(): LocaleNumeri { return corrente; }

/** Scambia il punto e la virgola di un numero già formattato all'inglese (1,234.5 → 1.234,5), se la lingua è l'italiano. */
export function localizzaNumero(testo: string): string {
  if (corrente !== 'it') return testo;
  return testo.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
}

/** VERO e FALSO in italiano, TRUE e FALSE in inglese. */
export function localizzaBooleano(valore: boolean): string {
  if (corrente === 'it') return valore ? 'VERO' : 'FALSO';
  return valore ? 'TRUE' : 'FALSE';
}
