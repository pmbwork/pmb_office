// Riferimenti incrociati (Inserisci › Riferimento incrociato): un tratto con il carattere CAMPO_RIFERIMENTO che rimanda al segnalibro di un
// paragrafo (un titolo, un segnalibro, una didascalia) e mostra il testo di quel paragrafo, oppure solo etichetta e numero della
// didascalia («Figura 2»). Il testo si calcola a ogni disegno, come fanno Word (campo REF) e LibreOffice (bookmark-ref). Modulo puro.
import { t } from '../i18n/lingua';
import { normalizza, type Documento, type Paragrafo, type Run } from './documento';
import { numeriDidascalie } from './didascalie';

/** Un paragrafo a cui si può rimandare. */
export interface Bersaglio { p: number; tipo: 'titolo' | 'segnalibro' | 'didascalia'; testo: string; etichetta: string | null }

/** Caratteri speciali che non fanno parte del testo leggibile (campi, oggetti). */
const SPECIALI = /[-￼]/g;

/** Il testo di un paragrafo come si legge: le didascalie con il numero, i campi di unione come «nome», senza cancellazioni proposte. */
function testoLeggibile(runs: Run[], i: number, numeri: Map<string, number>, fino?: number): string {
  let s = '';
  for (let k = 0; k < runs.length && (fino === undefined || k <= fino); k++) {
    const r = runs[k];
    if (r.rv?.t === 'd' || r.im !== undefined || r.xr !== undefined) continue;
    if (r.sq !== undefined) s += String(numeri.get(`${i}:${k}`) ?? 1);
    else if (r.cu !== undefined) s += `«${r.cu}»`;
    else s += r.t.replace(SPECIALI, '');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** L'etichetta e il numero di una didascalia («Figura 2»), o null se il paragrafo non è una didascalia. */
function etichettaDi(par: Paragrafo, i: number, numeri: Map<string, number>): string | null {
  const k = par.runs.findIndex((r) => r.sq !== undefined);
  return k < 0 ? null : testoLeggibile(par.runs, i, numeri, k);
}

/** I paragrafi a cui si può rimandare, nell'ordine del testo: titoli (il titolo e i livelli 1-3), segnalibri dell'utente, didascalie. */
export function bersagliRiferimento(doc: Documento): Bersaglio[] {
  const numeri = numeriDidascalie(doc.paragrafi);
  const out: Bersaglio[] = [];
  doc.paragrafi.forEach((par, p) => {
    const testo = testoLeggibile(par.runs, p, numeri);
    const etichetta = etichettaDi(par, p, numeri);
    if (etichetta !== null) out.push({ p, tipo: 'didascalia', testo, etichetta });
    else if ((par.st === '1' || par.st === '2' || par.st === '3' || par.st === 't') && testo !== '') out.push({ p, tipo: 'titolo', testo, etichetta: null });
    else if (par.sg !== undefined && !par.sg.startsWith('_')) out.push({ p, tipo: 'segnalibro', testo: testo || par.sg, etichetta: null });
  });
  return out;
}

/** Il testo che mostra un riferimento quando il segnalibro non c'è più (come l'errore del campo REF di Word). */
export function testoRiferimentoMancante(): string { return t('Errore: riferimento non trovato'); }

/** Il testo di ogni riferimento incrociato del documento: chiave «paragrafo:tratto». */
export function testiRiferimenti(paragrafi: Paragrafo[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!paragrafi.some((p) => p.runs.some((r) => r.xr !== undefined))) return out;
  const numeri = numeriDidascalie(paragrafi);
  const perNome = new Map<string, number>();
  paragrafi.forEach((p, i) => { if (p.sg !== undefined && !perNome.has(p.sg.toLowerCase())) perNome.set(p.sg.toLowerCase(), i); });
  paragrafi.forEach((p, i) => p.runs.forEach((r, k) => {
    if (r.xr === undefined) return;
    const q = perNome.get(r.xr.toLowerCase());
    if (q === undefined) { out.set(`${i}:${k}`, testoRiferimentoMancante()); return; }
    const bersaglio = paragrafi[q];
    const testo = r.xm === 'e' ? (etichettaDi(bersaglio, q, numeri) ?? testoLeggibile(bersaglio.runs, q, numeri)) : testoLeggibile(bersaglio.runs, q, numeri);
    out.set(`${i}:${k}`, testo);
  }));
  return out;
}

/** Il documento con i riferimenti scritti come testo (per il PDF e il testo semplice). */
export function conRiferimentiComeTesto(doc: Documento): Documento {
  const testi = testiRiferimenti(doc.paragrafi);
  if (testi.size === 0) return doc;
  return {
    ...doc,
    paragrafi: doc.paragrafi.map((p, i) => (p.runs.some((r) => r.xr !== undefined)
      ? { ...p, runs: normalizza(p.runs.map((r, k) => { if (r.xr === undefined) return r; const { xr, xm, ...resto } = r; void xr; void xm; return { ...resto, t: testi.get(`${i}:${k}`) ?? '' }; }).filter((r) => r.t !== '')) }
      : p)),
  };
}
