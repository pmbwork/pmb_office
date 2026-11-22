// Maiuscole e minuscole (come Formato › Testo › Maiuscole/minuscole di Word e LibreOffice): MAIUSCOLO, minuscolo, Iniziali Maiuscole,
// Frase (maiuscola solo a inizio frase), iNVERTI, e il giro di Maiusc+F3 di Word (minuscolo → MAIUSCOLO → Iniziali → minuscolo).
// Si cambia un carattere alla volta e la lunghezza del testo resta la stessa (una lettera che cambiando diventerebbe due, come ß, resta
// com'è): formato, commenti, segnalibri e modifiche registrate restano al loro posto. Senza selezione si cambia la parola del cursore.
// Tutto puro.
import { conParagrafi, modificaRun, ordina, testoParagrafo, type Documento, type Stato } from './documento';

import { lettera, modoDelGiro, trasforma, type ModoMaiuscole } from '@comune/maiuscole';
export { trasforma, modoDelGiro, type ModoMaiuscole };

/** Cambia maiuscole e minuscole della selezione (o della parola del cursore). La selezione resta (o diventa) quella cambiata. */
export function cambiaMaiuscole(stato: Stato, modo: ModoMaiuscole): Stato {
  let sel = stato.sel;
  let [i, f] = ordina(stato.doc, sel);
  if (i.p === f.p && i.o === f.o) {
    const t = testoParagrafo(stato.doc.paragrafi[i.p]);
    let a = i.o, b = i.o;
    while (a > 0 && lettera(t[a - 1])) a--;
    while (b < t.length && lettera(t[b])) b++;
    if (a === b) return stato;
    sel = { ancora: { p: i.p, o: a }, fuoco: { p: i.p, o: b } };
    [i, f] = [sel.ancora, sel.fuoco];
  }
  const pezzi: string[] = [];
  for (let p = i.p; p <= f.p; p++) {
    const t = testoParagrafo(stato.doc.paragrafi[p]);
    pezzi.push(t.slice(p === i.p ? i.o : 0, p === f.p ? f.o : t.length));
  }
  const m = modo === 'giro' ? modoDelGiro(pezzi.join('\n')) : modo;
  let doc: Documento = stato.doc;
  for (let p = i.p; p <= f.p; p++) {
    const t = testoParagrafo(doc.paragrafi[p]);
    const da = p === i.p ? i.o : 0;
    const a = p === f.p ? f.o : t.length;
    if (da >= a) continue;
    const nuovo = trasforma(t.slice(da, a), m, t.slice(0, da));
    if (nuovo === t.slice(da, a)) continue;
    let k = 0;
    doc = modificaRun(doc, { ancora: { p, o: da }, fuoco: { p, o: a } }, (r) => {
      const x = nuovo.slice(k, k + r.t.length);
      k += r.t.length;
      return r.im !== undefined ? r : { ...r, t: x };
    });
  }
  if (doc === stato.doc && sel === stato.sel) return stato;
  return { doc: conParagrafi(doc, doc.paragrafi), sel, pendenti: null };
}
