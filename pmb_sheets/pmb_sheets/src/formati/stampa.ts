// Stampa di Fogli: dal foglio al disegno da stampare. Prende il modello di scambio (testi, stili, misure, celle unite) e il testo già formattato
// di ogni cella e ne ricava una tabella senza griglia, con solo i bordi scelti, già ridotta per entrare in larghezza su una pagina A4.
// Tutto puro: nessun DOM, nessun motore di calcolo.
import { indirizzoCella, type FoglioScambio } from './scambio';
import type { BorderDef, CellStyle, HorizontalAlign } from '../sheet/styles';
import { parseCellAddress } from '../engine/address';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '../sheet/viewport';

/** larghezza utile di una pagina A4 in verticale con i margini di 15 mm, in pixel a 96 dpi */
export const LARGHEZZA_PAGINA = 680;

export type TipoValore = 'numero' | 'testo' | 'booleano' | 'errore' | 'vuoto';
/** Il testo mostrato di una cella e che tipo di valore è (serve a scegliere l'allineamento). */
export interface ValoreStampa { testo: string; tipo: TipoValore }

export interface CellaStampa {
  riga: number;
  colonna: number;
  testo: string;
  rowspan: number;
  colspan: number;
  /** proprietà CSS in forma camelCase, solo quelle che servono */
  stile: Record<string, string>;
}

export interface TabellaStampa {
  /** larghezza di ogni colonna e altezza di ogni riga, in pixel, prima di ridurre */
  larghezze: number[];
  altezze: number[];
  /** le righe da stampare; le celle coperte da una cella unita non ci sono */
  righe: CellaStampa[][];
  larghezzaTotale: number;
  /** 1 se la tabella entra in una pagina, altrimenti il rapporto per farla entrare */
  scala: number;
}

export interface Area { riga1: number; col1: number; riga2: number; col2: number }

const haBordi = (s: CellStyle | undefined): boolean => !!s?.borders && Object.values(s.borders).some((b) => b && b.style !== 'none');
const haSfondo = (s: CellStyle | undefined): boolean => !!s?.fill && s.fill !== 'none' && s.fill !== 'auto';

/** Il rettangolo che contiene tutto quello che si vede: testi, sfondi, bordi e celle unite. null se il foglio non ha niente da stampare. */
export function areaDaStampare(foglio: FoglioScambio): Area | null {
  let area: Area | null = null;
  const aggiungi = (riga1: number, col1: number, riga2 = riga1, col2 = col1): void => {
    area = area === null
      ? { riga1, col1, riga2, col2 }
      : { riga1: Math.min(area.riga1, riga1), col1: Math.min(area.col1, col1), riga2: Math.max(area.riga2, riga2), col2: Math.max(area.col2, col2) };
  };
  for (const indirizzo of Object.keys(foglio.celle)) {
    const c = parseCellAddress(indirizzo);
    if (c) aggiungi(c.row, c.col);
  }
  for (const [indirizzo, stile] of Object.entries(foglio.stili)) {
    if (!haSfondo(stile) && !haBordi(stile)) continue;
    const c = parseCellAddress(indirizzo);
    if (c) aggiungi(c.row, c.col);
  }
  for (const m of foglio.unioni) aggiungi(m.startRow, m.startCol, m.endRow, m.endCol);
  return area;
}

function bordo(b: BorderDef | undefined): string | undefined {
  if (!b || b.style === 'none') return undefined;
  const colore = !b.color || b.color === 'auto' ? '#000000' : b.color;
  return `${b.style === 'medium' ? 2 : 1}px ${b.style === 'dashed' ? 'dashed' : 'solid'} ${colore}`;
}

/** Lo stile di una cella: quello della colonna, poi quello della riga, poi quello della cella stessa. */
export function stileEffettivo(foglio: FoglioScambio, riga: number, colonna: number, indirizzo: string): CellStyle {
  return { ...foglio.stiliColonna[colonna], ...foglio.stiliRiga[riga], ...foglio.stili[indirizzo] };
}

function stileCss(s: CellStyle): Record<string, string> {
  const css: Record<string, string> = {};
  if (s.bold) css.fontWeight = '700';
  if (s.italic) css.fontStyle = 'italic';
  const decorazioni = [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (decorazioni) css.textDecoration = decorazioni;
  if (s.color && s.color !== 'auto') css.color = s.color;
  if (haSfondo(s)) css.backgroundColor = s.fill as string;
  if (s.fontFamily) css.fontFamily = s.fontFamily;
  if (s.fontSize) css.fontSize = `${s.fontSize}px`;
  if (s.vAlign) css.verticalAlign = s.vAlign === 'middle' ? 'middle' : s.vAlign;
  css.whiteSpace = s.wrap ? 'pre-wrap' : 'nowrap';
  const b = s.borders;
  if (b) {
    const alto = bordo(b.top), destra = bordo(b.right), basso = bordo(b.bottom), sinistra = bordo(b.left);
    if (alto) css.borderTop = alto;
    if (destra) css.borderRight = destra;
    if (basso) css.borderBottom = basso;
    if (sinistra) css.borderLeft = sinistra;
  }
  return css;
}

function allineamento(s: CellStyle, tipo: TipoValore): HorizontalAlign {
  if (s.hAlign) return s.hAlign;
  if (tipo === 'numero') return 'right';
  if (tipo === 'booleano' || tipo === 'errore') return 'center';
  return 'left';
}

/** La tabella da stampare per un foglio. "valore" dà il testo mostrato e il tipo di ogni cella. null se non c'è niente da stampare. */
export function costruisciTabella(foglio: FoglioScambio, valore: (riga: number, colonna: number) => ValoreStampa): TabellaStampa | null {
  const area = areaDaStampare(foglio);
  if (area === null) return null;
  const larghezze: number[] = [];
  for (let c = area.col1; c <= area.col2; c++) larghezze.push(foglio.larghezze[c] ?? DEFAULT_COL_WIDTH);
  const altezze: number[] = [];
  for (let r = area.riga1; r <= area.riga2; r++) altezze.push(foglio.altezze[r] ?? DEFAULT_ROW_HEIGHT);

  const coperte = new Set<string>();
  const ancore = new Map<string, { rowspan: number; colspan: number }>();
  for (const m of foglio.unioni) {
    ancore.set(`${m.startRow}:${m.startCol}`, { rowspan: m.endRow - m.startRow + 1, colspan: m.endCol - m.startCol + 1 });
    for (let r = m.startRow; r <= m.endRow; r++) for (let c = m.startCol; c <= m.endCol; c++) if (r !== m.startRow || c !== m.startCol) coperte.add(`${r}:${c}`);
  }

  const righe: CellaStampa[][] = [];
  for (let r = area.riga1; r <= area.riga2; r++) {
    const riga: CellaStampa[] = [];
    for (let c = area.col1; c <= area.col2; c++) {
      if (coperte.has(`${r}:${c}`)) continue;
      const indirizzo = indirizzoCella(r, c);
      const v = valore(r, c);
      const s = stileEffettivo(foglio, r, c, indirizzo);
      const unione = ancore.get(`${r}:${c}`);
      riga.push({
        riga: r, colonna: c, testo: v.testo, rowspan: unione?.rowspan ?? 1, colspan: unione?.colspan ?? 1,
        stile: { textAlign: allineamento(s, v.tipo), ...stileCss(s) },
      });
    }
    righe.push(riga);
  }
  const larghezzaTotale = larghezze.reduce((a, b) => a + b, 0);
  return { larghezze, altezze, righe, larghezzaTotale, scala: Math.min(1, LARGHEZZA_PAGINA / larghezzaTotale) };
}
