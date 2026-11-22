// Didascalie numerate (Inserisci › Didascalia): il numero di ogni didascalia è la sua posizione tra quelle della stessa serie («Figura»,
// «Tabella», «Equazione»...), nell'ordine del testo, come i campi SEQ di Word e le sequenze di LibreOffice. Nella pagina lo contano i
// contatori del CSS (vedi docs-editor); qui si conta per i file, il PDF e il testo semplice. Modulo puro.
import { normalizza, type Documento, type Paragrafo } from './documento';

/** Le serie che hanno un contatore suo nella pagina (le altre ne usano uno comune). */
const SERIE_NOTE: Record<string, string> = { figura: 'f', figure: 'f', tabella: 't', table: 't', equazione: 'e', equation: 'e' };
export function chiaveSerie(nome: string): string { return SERIE_NOTE[nome.trim().toLowerCase()] ?? 'a'; }

/** Il numero di ogni didascalia: chiave «paragrafo:tratto». */
export function numeriDidascalie(paragrafi: Paragrafo[]): Map<string, number> {
  const conti = new Map<string, number>();
  const out = new Map<string, number>();
  paragrafi.forEach((p, i) => p.runs.forEach((r, k) => {
    if (r.sq === undefined) return;
    for (let x = 0; x < r.t.length; x++) {
      const serie = r.sq.trim().toLowerCase();
      const n = (conti.get(serie) ?? 0) + 1;
      conti.set(serie, n);
      if (x === 0) out.set(`${i}:${k}`, n);
    }
  }));
  return out;
}

/** Il documento con i numeri delle didascalie scritti come testo (per il PDF e il testo semplice). */
export function conDidascalieComeTesto(doc: Documento): Documento {
  const numeri = numeriDidascalie(doc.paragrafi);
  return {
    ...doc,
    paragrafi: doc.paragrafi.map((p, i) => (p.runs.some((r) => r.sq !== undefined)
      ? { ...p, runs: normalizza(p.runs.map((r, k) => { if (r.sq === undefined) return r; const { sq, ...resto } = r; void sq; return { ...resto, t: String(numeri.get(`${i}:${k}`) ?? 1) }; })) }
      : p)),
  };
}
