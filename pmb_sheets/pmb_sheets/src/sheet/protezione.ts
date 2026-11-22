/**
 * Protezione di Fogli, come in Excel e LibreOffice (non è cifratura: evita di cambiare per sbaglio ciò che non va cambiato).
 * - Foglio protetto: si possono scrivere solo le celle sbloccate (stile «sbloccata»: di serie tutte le celle sono bloccate, come in
 *   Excel); niente formato, niente righe o colonne inserite o tolte, niente unioni, ordinamenti, filtri nuovi. Le celle con «formula
 *   nascosta» mostrano il valore e non la formula. Password facoltativa: si salva solo la sua impronta (comune/protezione/impronte.ts).
 * - Struttura della cartella protetta: non si aggiungono, tolgono, rinominano, spostano o nascondono fogli.
 * Il controllo vero è sui passi della cronologia (ogni modifica ne lascia uno): un passo che il foglio protetto non permette si
 * annulla subito (motivoPasso). La griglia controlla anche prima, per non far nemmeno cominciare la modifica.
 * Modulo puro: niente DOM.
 */
import type { SheetDocument } from './document-store';
import type { HistoryStep } from './history';
import { cellKey, resolveCellStyle, type CellStyle, type SheetStyles } from './styles';
import { impronteValide, type Impronta } from '@comune/protezione/impronte';

export interface ProtezioneFoglio { impronte?: Impronta[] }
export interface ProtezioneCartella { impronte?: Impronta[] }

export const MOTIVO_CELLA = 'La cella è protetta: per cambiarla si toglie la protezione del foglio (Strumenti › Proteggi foglio)';
export const MOTIVO_FOGLIO = 'Il foglio è protetto: questa operazione non si può fare (Strumenti › Proteggi foglio)';
export const MOTIVO_CARTELLA = 'La struttura della cartella è protetta: i fogli non si possono aggiungere, togliere, rinominare o spostare';

export function protezioneValida(x: unknown): ProtezioneFoglio | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const impronte = impronteValide((x as { impronte?: unknown }).impronte);
  return impronte ? { impronte } : {};
}

export function copiaProtezione(p: ProtezioneFoglio | undefined): ProtezioneFoglio | undefined {
  return p === undefined ? undefined : p.impronte ? { impronte: p.impronte.map((i) => ({ ...i })) } : {};
}

/** La protezione di un foglio (anche quello attivo), o undefined se non è protetto. */
export function protezioneDi(doc: SheetDocument, nome: string): ProtezioneFoglio | undefined {
  return nome === doc.activeSheetName ? doc.protezione : doc.sheetStates.get(nome)?.protezione;
}

/** true se la cella è sbloccata (si può scrivere anche con il foglio protetto). */
export function sbloccata(stile: CellStyle): boolean { return stile.sbloccata === true; }

function stiliDel(doc: SheetDocument, nome: string): SheetStyles | null {
  if (nome === doc.activeSheetName) return doc.styles;
  const s = doc.sheetStates.get(nome);
  if (!s) return null;
  return { registry: doc.styles.registry, cellStyles: s.cellStyles, rowStyles: s.rowStyles, colStyles: s.colStyles } as SheetStyles;
}

/** true se la cella non si può cambiare: il foglio è protetto e la cella è bloccata. */
export function cellaProtetta(doc: SheetDocument, foglio: string, riga: number, colonna: number): boolean {
  if (!protezioneDi(doc, foglio)) return false;
  const stili = stiliDel(doc, foglio);
  return !stili || !sbloccata(resolveCellStyle(riga, colonna, stili));
}

/** true se in un intervallo c'è almeno una cella protetta (per intervalli enormi si guarda se ci sono celle sbloccate fuori dalla regola). */
export function intervalloProtetto(doc: SheetDocument, foglio: string, r1: number, c1: number, r2: number, c2: number): boolean {
  if (!protezioneDi(doc, foglio)) return false;
  const celle = (r2 - r1 + 1) * (c2 - c1 + 1);
  if (celle > 200000) return true;
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (cellaProtetta(doc, foglio, r, c)) return true;
  return false;
}

/** true se la formula della cella non si deve mostrare (foglio protetto e cella con «formula nascosta»). */
export function formulaNascosta(doc: SheetDocument, riga: number, colonna: number): boolean {
  return !!doc.protezione && resolveCellStyle(riga, colonna, doc.styles).formulaNascosta === true;
}

/** Perché il passo non è permesso dalla protezione dei fogli che tocca (testo da tradurre), o null se va bene.
 *  Il contenuto delle celle sbloccate si può cambiare; il formato, la struttura e ogni altra operazione no. */
export function motivoPasso(doc: SheetDocument, passo: HistoryStep): string | null {
  const foglio = passo.sheet ?? doc.activeSheetName;
  const fogliToccati = new Set<string>([foglio, ...(passo.changes ?? []).map((c) => c.sheet)]);
  const qualcunoProtetto = [...fogliToccati].some((f) => protezioneDi(doc, f) !== undefined);
  if (!qualcunoProtetto) return null;
  if ((passo.styleChanges?.length ?? 0) > 0) return MOTIVO_FOGLIO;
  if (passo.undoAction || passo.redoAction) return MOTIVO_FOGLIO;
  for (const c of passo.changes ?? []) {
    if (c.oldStyleId !== c.newStyleId) return MOTIVO_FOGLIO;
    if (cellaProtetta(doc, c.sheet, c.row, c.col)) return MOTIVO_CELLA;
  }
  return null;
}

/** Le celle (chiavi "r,c") di un intervallo che si scrivono anche con il foglio protetto. Utile per Tab tra celle sbloccate. */
export function celleSbloccate(doc: SheetDocument, r1: number, c1: number, r2: number, c2: number): string[] {
  const out: string[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (sbloccata(resolveCellStyle(r, c, doc.styles))) out.push(cellKey(r, c));
  return out;
}
