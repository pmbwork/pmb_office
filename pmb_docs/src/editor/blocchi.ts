// Inserisce un blocco di paragrafi (anche con tabelle) nel documento, dopo il paragrafo del cursore.

import { conParagrafi, cursore, ordina, type Paragrafo, type Stato } from '../modello/documento';

/** Il numero da dare alla prossima tabella del documento. */
export function prossimoIdTabella(stato: Stato): number {
  return stato.doc.paragrafi.reduce((m, p) => Math.max(m, (p.tb?.i ?? -1) + 1), 0);
}

/**
 * Mette il blocco dopo il paragrafo del cursore (al suo posto se è vuoto) e porta il cursore in un paragrafo vuoto che segue il blocco.
 * Dentro una tabella non fa niente: il blocco potrebbe contenere altre tabelle.
 */
export function inserisciBlocco(stato: Stato, blocco: Paragrafo[]): Stato {
  if (blocco.length === 0) return stato;
  const [c] = ordina(stato.doc, stato.sel);
  const corrente = stato.doc.paragrafi[c.p];
  if (corrente.tb) return stato;
  const vuoto = corrente.runs.length === 0 && Object.keys(corrente).every((k) => k === 'runs');
  const prima = stato.doc.paragrafi.slice(0, vuoto ? c.p : c.p + 1);
  const dopo = stato.doc.paragrafi.slice(c.p + 1);
  const chiusura: Paragrafo = { runs: [] };
  const paragrafi = [...prima, ...blocco, chiusura, ...dopo];
  return { doc: conParagrafi(stato.doc, paragrafi), sel: cursore(prima.length + blocco.length, 0), pendenti: null };
}
