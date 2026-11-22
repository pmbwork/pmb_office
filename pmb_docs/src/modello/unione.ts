// Stampa unione (Strumenti › Stampa unione, come «Stampa unione» di Word e LibreOffice): un documento con i campi «Nome», «Indirizzo»...
// e un elenco (una tabella con i nomi delle colonne nella prima riga, per esempio un foglio di pmb_sheets) diventano un documento con
// una copia per ogni riga dell'elenco, i campi sostituiti dai valori e un salto di pagina tra una copia e l'altra. Modulo puro.
import { CAMPO_UNIONE, normalizza, type Documento, type Paragrafo, type Run } from './documento';

export interface Elenco { colonne: string[]; righe: string[][] }
/** Al massimo tante copie in un documento unito. */
export const COPIE_MASSIME = 2000;

/** I nomi dei campi usati nel documento (corpo, intestazione e piè di pagina), nell'ordine in cui compaiono, senza doppioni. */
export function campiUsati(doc: Documento): string[] {
  const visti = new Set<string>();
  for (const p of [...doc.paragrafi, ...(doc.intestazione ?? []), ...(doc.piede ?? [])]) for (const r of p.runs) if (r.cu !== undefined) visti.add(r.cu);
  return [...visti];
}

/** I campi del documento che non sono colonne dell'elenco (senza badare a maiuscole e spazi). */
export function campiMancanti(doc: Documento, elenco: Elenco): string[] {
  const colonne = new Set(elenco.colonne.map(chiave));
  return campiUsati(doc).filter((c) => !colonne.has(chiave(c)));
}
const chiave = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** I paragrafi con i campi sostituiti dai valori di una riga (il valore prende il formato del campo; gli a capo diventano spazi). */
function sostituisciCampi(paragrafi: Paragrafo[], valoreDi: (nome: string) => string): Paragrafo[] {
  return paragrafi.map((p) => ({
    ...p,
    runs: normalizza(p.runs.map((r): Run => {
      if (r.cu === undefined) { const { cm, ...resto } = r; void cm; return resto; }
      const { cu, cm, ...formato } = r; void cm;
      return { ...formato, t: valoreDi(cu).replace(/\r\n?|\n/g, ' ') };
    })),
  }));
}

/** Il documento unito: una copia per riga (le righe del tutto vuote si saltano), ognuna dopo un salto di pagina. Commenti e
 *  protezione del modello non passano al documento unito. */
export function documentoUnito(doc: Documento, elenco: Elenco): Documento {
  const indice = new Map(elenco.colonne.map((c, i) => [chiave(c), i] as const));
  const paragrafi: Paragrafo[] = [];
  let copie = 0;
  for (const riga of elenco.righe) {
    if (copie >= COPIE_MASSIME) break;
    if (riga.every((v) => (v ?? '').trim() === '')) continue;
    const valoreDi = (nome: string): string => { const i = indice.get(chiave(nome)); return i === undefined ? '' : riga[i] ?? ''; };
    const copia = sostituisciCampi(doc.paragrafi, valoreDi);
    if (copie > 0 && copia.length > 0) copia[0] = { ...copia[0], sp: true };
    paragrafi.push(...copia);
    copie++;
  }
  const out: Documento = { paragrafi: paragrafi.length > 0 ? paragrafi : [{ runs: [] }] };
  // intestazione e piè di pagina sono gli stessi per tutte le copie: i campi prendono i valori della prima riga
  const prima = elenco.righe.find((r) => r.some((v) => (v ?? '').trim() !== '')) ?? [];
  const valorePrima = (nome: string): string => { const i = indice.get(chiave(nome)); return i === undefined ? '' : prima[i] ?? ''; };
  if (doc.intestazione) out.intestazione = sostituisciCampi(doc.intestazione, valorePrima);
  if (doc.piede) out.piede = sostituisciCampi(doc.piede, valorePrima);
  if (doc.stili) out.stili = doc.stili.map((s) => ({ ...s }));
  if (doc.colonne) out.colonne = doc.colonne;
  if (doc.filigrana) out.filigrana = doc.filigrana;
  return out;
}

/** Quante copie avrà il documento unito. */
export function copieDi(elenco: Elenco): number {
  return Math.min(COPIE_MASSIME, elenco.righe.filter((r) => r.some((v) => (v ?? '').trim() !== '')).length);
}
/** Il documento con i campi scritti come testo «nome» (per il PDF e il testo semplice, che non hanno campi). */
export function conCampiComeTesto(doc: Documento): Documento {
  return {
    ...doc,
    paragrafi: sostituisciCampi(doc.paragrafi, testoCampo),
    ...(doc.intestazione ? { intestazione: sostituisciCampi(doc.intestazione, testoCampo) } : {}),
    ...(doc.piede ? { piede: sostituisciCampi(doc.piede, testoCampo) } : {}),
  };
}
/** Il testo del campo come si vede nel documento. */
export function testoCampo(nome: string): string { return `«${nome}»`; }
export { CAMPO_UNIONE };
