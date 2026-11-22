// Maiuscole e minuscole, comuni a pmb_docs e pmb_sheets (come Formato › Testo di LibreOffice e Maiuscole/minuscole di Word):
// MAIUSCOLO, minuscolo, Iniziali Maiuscole, Frase, iNVERTI e il giro di Maiusc+F3. Un carattere alla volta: la lunghezza del testo
// resta la stessa (una lettera che diventerebbe due, come ß, resta com'è). Tutto puro.
export type ModoMaiuscole = 'maiuscolo' | 'minuscolo' | 'iniziali' | 'frase' | 'inverti' | 'giro';

export const lettera = (c: string): boolean => c.toLowerCase() !== c.toUpperCase();
const su = (c: string): string => { const x = c.toUpperCase(); return x.length === c.length ? x : c; };
const giu = (c: string): string => { const x = c.toLowerCase(); return x.length === c.length ? x : c; };

/** Il testo cambiato, della stessa lunghezza. prima = il testo che viene subito prima (per sapere se si è a inizio parola o frase). */
export function trasforma(testo: string, modo: Exclude<ModoMaiuscole, 'giro'>, prima = ''): string {
  let out = '';
  let precedente = prima.slice(-1);
  // inizio frase: all'inizio del testo, o dopo . ! ? (con spazi in mezzo)
  let inizioFrase = /(^|[.!?]\s*)$/.test(prima.slice(-4)) || prima.trim() === '';
  for (const c of Array.from(testo)) {
    let x = c;
    if (modo === 'maiuscolo') x = su(c);
    else if (modo === 'minuscolo') x = giu(c);
    else if (modo === 'inverti') x = c === su(c) ? giu(c) : su(c);
    else if (modo === 'iniziali') x = lettera(c) && !(lettera(precedente) || precedente === "'" || precedente === '’' || /[0-9]/.test(precedente)) ? su(c) : giu(c);
    else if (modo === 'frase') {
      x = lettera(c) && inizioFrase ? su(c) : giu(c);
      if (lettera(c)) inizioFrase = false;
      else if (/[.!?]/.test(c)) inizioFrase = true;
    }
    out += x;
    precedente = c;
  }
  return out;
}

/** Il modo del giro di Maiusc+F3 per questo testo: tutto minuscolo → MAIUSCOLO, tutto maiuscolo → Iniziali, altrimenti minuscolo. */
export function modoDelGiro(testo: string): Exclude<ModoMaiuscole, 'giro'> {
  const lettere = Array.from(testo).filter(lettera).join('');
  if (lettere === '') return 'maiuscolo';
  if (lettere === lettere.toLowerCase()) return 'maiuscolo';
  if (lettere === lettere.toUpperCase()) return 'iniziali';
  return 'minuscolo';
}

