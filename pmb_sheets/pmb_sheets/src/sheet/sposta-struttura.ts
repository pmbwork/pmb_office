/**
 * Inserire o eliminare righe e colonne: oltre alle celle (che sposta il motore di calcolo) si devono spostare anche i dati che stanno
 * "attaccati" alle posizioni: stili, larghezze e altezze, righe e colonne nascoste, celle unite, convalide, formattazioni condizionali,
 * filtri, commenti, intervalli denominati e blocco di righe e colonne del foglio. Qui sta la regola, uguale per tutti: modulo puro, niente DOM e niente motore.
 */
import type { SheetDocument } from './document-store';
import { adjustMergesOnStructureChange } from './cell-merge';
import { columnIndexToLetters } from '../engine/address';
import type { NamedRange } from './named-ranges';
import type { Commento } from './commenti';
import { NamedRangeRegistry } from './named-ranges';
import { shiftFormula } from '../engine/shift-formula';
import { rewriteFormulaOnStructureChange } from '../engine/structure';
import type { ConditionalFormatRule } from './conditional-format';

export interface OperazioneStruttura {
  tipo: 'insert_rows' | 'delete_rows' | 'insert_cols' | 'delete_cols';
  /** la prima riga o colonna toccata (da 1) */
  indice: number;
  conta: number;
}

const eRiga = (op: OperazioneStruttura) => op.tipo.endsWith('_rows');
const eInserimento = (op: OperazioneStruttura) => op.tipo.startsWith('insert');

/** Dove va a finire una riga o colonna: il nuovo indice, oppure null se è stata eliminata. */
export function nuovoIndice(i: number, op: OperazioneStruttura): number | null {
  if (eInserimento(op)) return i >= op.indice ? i + op.conta : i;
  if (i < op.indice) return i;
  if (i >= op.indice + op.conta) return i - op.conta;
  return null;
}

/** Un intervallo (inizio e fine compresi) dopo l'operazione: si sposta, si allarga se l'inserimento cade dentro, si restringe o sparisce (null) con l'eliminazione. */
export function nuovoIntervallo(inizio: number, fine: number, op: OperazioneStruttura): [number, number] | null {
  if (eInserimento(op)) {
    if (op.indice <= inizio) return [inizio + op.conta, fine + op.conta];
    if (op.indice <= fine) return [inizio, fine + op.conta];
    return [inizio, fine];
  }
  const ultimo = op.indice + op.conta - 1;
  if (inizio >= op.indice && fine <= ultimo) return null; // tutto dentro la parte eliminata
  const nuovoInizio = inizio < op.indice ? inizio : inizio > ultimo ? inizio - op.conta : op.indice;
  const nuovaFine = fine < op.indice ? fine : fine > ultimo ? fine - op.conta : op.indice - 1;
  return nuovaFine < nuovoInizio ? null : [nuovoInizio, nuovaFine];
}

/** Quante righe (o colonne) restano bloccate in alto (a sinistra) dopo l'operazione: l'inserimento dentro la zona bloccata la allarga,
 *  l'eliminazione la restringe delle sole righe bloccate che toglie; ciò che sta sotto (a destra) non la tocca. */
export function bloccatiDopoStruttura(bloccati: number, op: OperazioneStruttura): number {
  if (!(bloccati > 0)) return 0;
  if (eInserimento(op)) return op.indice <= bloccati ? bloccati + op.conta : bloccati;
  const ultimo = op.indice + op.conta - 1;
  const tolti = Math.max(0, Math.min(ultimo, bloccati) - op.indice + 1);
  return bloccati - tolti;
}

function spostaMappa<V>(m: Map<number, V>, op: OperazioneStruttura): Map<number, V> {
  const nuova = new Map<number, V>();
  for (const [i, v] of m) {
    const n = nuovoIndice(i, op);
    if (n !== null) nuova.set(n, v);
  }
  return nuova;
}

function spostaInsieme(s: Set<number>, op: OperazioneStruttura): Set<number> {
  const nuovo = new Set<number>();
  for (const i of s) {
    const n = nuovoIndice(i, op);
    if (n !== null) nuovo.add(n);
  }
  return nuovo;
}

/** Sposta una chiave "riga,colonna" o "riga:colonna" (il separatore resta lo stesso). */
function spostaCoppia<V>(m: Map<string, V>, op: OperazioneStruttura, separatore: ',' | ':'): Map<string, V> {
  const nuova = new Map<string, V>();
  for (const [k, v] of m) {
    const [r, c] = k.split(separatore).map(Number);
    if (!Number.isInteger(r) || !Number.isInteger(c)) { nuova.set(k, v); continue; }
    const riga = eRiga(op) ? nuovoIndice(r, op) : r;
    const colonna = eRiga(op) ? c : nuovoIndice(c, op);
    if (riga !== null && colonna !== null) nuova.set(`${riga}${separatore}${colonna}`, v);
  }
  return nuova;
}

/** Aggiorna il testo di un riferimento "A1:B10" (con o senza "Foglio!") dopo l'operazione; null se l'intervallo è sparito. */
function spostaNome(n: NamedRange, op: OperazioneStruttura): NamedRange | null {
  const r = eRiga(op) ? nuovoIntervallo(n.startRow, n.endRow, op) : [n.startRow, n.endRow] as [number, number];
  const c = eRiga(op) ? [n.startCol, n.endCol] as [number, number] : nuovoIntervallo(n.startCol, n.endCol, op);
  if (!r || !c) return null;
  const locale = r[0] === r[1] && c[0] === c[1] ? `${columnIndexToLetters(c[0])}${r[0]}` : `${columnIndexToLetters(c[0])}${r[0]}:${columnIndexToLetters(c[1])}${r[1]}`;
  const prefisso = n.rangeString.includes('!') ? n.rangeString.slice(0, n.rangeString.lastIndexOf('!') + 1) : '';
  return { ...n, startRow: r[0], endRow: r[1], startCol: c[0], endCol: c[1], rangeString: `${prefisso}${locale}` };
}

/**
 * La formula di una regola condizionale dopo l'operazione. La formula è scritta per la prima cella dell'intervallo della regola
 * (i riferimenti relativi contano da lì): si guarda dalla prima cella che resta (se l'eliminazione toglie le prime righe o colonne
 * dell'intervallo è quella subito dopo), si riscrive come una formula di quella cella, e quella cella diventa il nuovo angolo.
 * Un riferimento a celle eliminate diventa #REF! e la regola smette di colorare, come in Excel.
 * `foglioRegola` è il foglio della regola, `foglioOperazione` quello dove si inserisce o si elimina.
 */
export function formulaRegolaDopoStruttura(formula: string, range: ConditionalFormatRule['range'], foglioRegola: string, foglioOperazione: string, op: OperazioneStruttura): string {
  let dr = 0, dc = 0;
  if (foglioRegola === foglioOperazione && !eInserimento(op)) {
    const ultimo = op.indice + op.conta - 1;
    if (eRiga(op) && range.startRow >= op.indice && range.startRow <= ultimo) dr = op.indice + op.conta - range.startRow;
    if (!eRiga(op) && range.startCol >= op.indice && range.startCol <= ultimo) dc = op.indice + op.conta - range.startCol;
  }
  const vista = dr === 0 && dc === 0 ? formula : shiftFormula(formula.trim().startsWith('=') ? formula : `=${formula}`, dr, dc);
  return rewriteFormulaOnStructureChange(vista, { type: op.tipo, targetSheet: foglioOperazione, formulaSheet: foglioRegola, startIndex: op.indice, count: op.conta });
}

/** Le regole di un foglio con le formule riscritte dopo l'operazione (intervalli già aggiornati a parte). */
function formuleRegoleDopoStruttura(regole: ConditionalFormatRule[], vecchie: ConditionalFormatRule[] | null, foglioRegola: string, foglioOperazione: string, op: OperazioneStruttura): ConditionalFormatRule[] {
  return regole.map((r, i) => {
    if (r.type !== 'formula' || r.value1 === undefined || String(r.value1).trim() === '') return r;
    const nuova = formulaRegolaDopoStruttura(String(r.value1), (vecchie ?? regole)[i].range, foglioRegola, foglioOperazione, op);
    return nuova === r.value1 ? r : { ...r, value1: nuova };
  });
}

/** Sposta tutto ciò che è legato alle posizioni del foglio attivo del documento. Modifica i campi vivi del documento. */
export function spostaDatiAccessori(doc: SheetDocument, op: OperazioneStruttura): void {
  const righe = eRiga(op);
  // stili
  doc.styles.cellStyles = spostaCoppia(doc.styles.cellStyles, op, ',');
  if (righe) {
    doc.styles.rowStyles = spostaMappa(doc.styles.rowStyles, op);
    doc.rowHeights = spostaMappa(doc.rowHeights, op);
    doc.hiddenRows = spostaInsieme(doc.hiddenRows, op);
  } else {
    doc.styles.colStyles = spostaMappa(doc.styles.colStyles, op);
    doc.colWidths = spostaMappa(doc.colWidths, op);
    doc.hiddenCols = spostaInsieme(doc.hiddenCols, op);
    doc.activeFilters = spostaMappa(doc.activeFilters, op);
    for (const [c, f] of doc.activeFilters) f.col = c;
  }
  // la tabella del filtro si sposta, si allarga o si restringe; se sparisce del tutto il filtro si toglie
  if (doc.filterArea) {
    const a = doc.filterArea;
    const r = righe ? nuovoIntervallo(a.startRow, a.endRow, op) : [a.startRow, a.endRow] as [number, number];
    const c = righe ? [a.startCol, a.endCol] as [number, number] : nuovoIntervallo(a.startCol, a.endCol, op);
    if (r && c) doc.filterArea = { startRow: r[0], endRow: r[1], startCol: c[0], endCol: c[1] };
    else { doc.filterArea = undefined; doc.isFilterActive = false; doc.activeFilters.clear(); }
  }
  // blocco di righe e colonne (riquadri bloccati)
  if (righe) doc.freezeRows = Math.min(200, bloccatiDopoStruttura(doc.freezeRows || 0, op));
  else doc.freezeCols = Math.min(200, bloccatiDopoStruttura(doc.freezeCols || 0, op));
  // celle unite
  doc.merges = adjustMergesOnStructureChange(doc.merges, op.tipo, op.indice, op.conta);
  // convalide
  doc.dataValidations = spostaCoppia(doc.dataValidations, op, ':');
  // formattazioni condizionali: l'intervallo si sposta e la formula si riscrive (anche quelle degli altri fogli che citano questo)
  const vecchie: ConditionalFormatRule[] = [];
  const spostate = doc.conditionalFormats.flatMap((regola) => {
    const r = righe ? nuovoIntervallo(regola.range.startRow, regola.range.endRow, op) : [regola.range.startRow, regola.range.endRow] as [number, number];
    const c = righe ? [regola.range.startCol, regola.range.endCol] as [number, number] : nuovoIntervallo(regola.range.startCol, regola.range.endCol, op);
    if (!r || !c) return [];
    vecchie.push(regola);
    return [{ ...regola, range: { startRow: r[0], endRow: r[1], startCol: c[0], endCol: c[1] } }];
  });
  doc.conditionalFormats = formuleRegoleDopoStruttura(spostate, vecchie, doc.activeSheetName, doc.activeSheetName, op);
  for (const [nome, stato] of doc.sheetStates) {
    if (nome === doc.activeSheetName || !stato.conditionalFormats.some((r) => r.type === 'formula')) continue;
    stato.conditionalFormats = formuleRegoleDopoStruttura(stato.conditionalFormats, null, nome, doc.activeSheetName, op);
  }
  // commenti del foglio attivo (la chiave è riga:colonna!foglio)
  const foglio = doc.activeSheetName;
  const commenti = new Map<string, Commento>();
  for (const [k, v] of doc.comments) {
    const m = /^(\d+):(\d+)!([\s\S]*)$/.exec(k);
    if (!m || m[3] !== foglio) { commenti.set(k, v); continue; }
    const riga = righe ? nuovoIndice(Number(m[1]), op) : Number(m[1]);
    const colonna = righe ? Number(m[2]) : nuovoIndice(Number(m[2]), op);
    if (riga !== null && colonna !== null) commenti.set(`${riga}:${colonna}!${foglio}`, v);
  }
  doc.comments = commenti;
  // intervalli denominati del foglio attivo
  const registro = new NamedRangeRegistry();
  for (const n of doc.namedRanges.getAll()) {
    if (n.sheetName !== foglio) { registro.add(n); continue; }
    const spostato = spostaNome(n, op);
    if (spostato) registro.add(spostato);
  }
  doc.namedRanges = registro;
}

