// Piano di stampa di un foglio di pmb_sheets: le pagine pronte da disegnare (tabella di ogni pagina, intestazione e piè di pagina con i campi
// sostituiti, lettere delle colonne e numeri delle righe). Lo usano la stampa (HTML) e l'esportazione PDF, così danno lo stesso risultato.
// Scritto per pmb_office (lotto 3, 2026-11-18). Modulo puro: niente DOM, niente motore di calcolo.
import { indirizzoCella, type FoglioScambio } from './scambio';
import { areaDaStampare, stileEffettivo, type CellaStampa, type TipoValore, type ValoreStampa } from './stampa';
import type { CellStyle, HorizontalAlign } from '../sheet/styles';
import type { CellValue } from '../engine/values';
import { formatCellValue } from '../sheet/number-format';
import { formatDisplayValue } from '../sheet/format-display';
import { columnIndexToLetters } from '../engine/address';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '../sheet/viewport';
import {
  impagina, misureCarta, paginaPredefinita, sostituisciCampi, type AreaStampa, type ImpostaPagina, type TestiMargine,
} from '../sheet/pagina';

export interface PaginaPiano {
  /** righe e colonne del foglio su questa pagina, nell'ordine in cui si stampano */
  righe: number[];
  colonne: number[];
  larghezze: number[];
  altezze: number[];
  celle: CellaStampa[][];
  intestazione: TestiMargine;
  pie: TestiMargine;
}
export interface PianoStampa {
  /** carta in mm (già girata se orizzontale) */
  carta: { larghezza: number; altezza: number };
  margini: ImpostaPagina['margini'];
  scala: number;
  griglia: boolean;
  intestazioniRigheColonne: boolean;
  centraOrizzontale: boolean;
  centraVerticale: boolean;
  pagine: PaginaPiano[];
}

/** Il valore di una cella da un file (senza motore): il risultato memorizzato delle formule, altrimenti il testo scritto. */
export function valoreDaScambio(foglio: FoglioScambio, indirizzo: string): CellValue {
  const raw = foglio.celle[indirizzo] ?? '';
  const calcolato = foglio.calcolati?.[indirizzo];
  if (raw.startsWith('=') || calcolato) {
    if (!calcolato) return { kind: 'text', value: raw };
    if (calcolato.tipo === 'n') return { kind: 'number', value: Number(calcolato.valore) };
    if (calcolato.tipo === 'b') return { kind: 'boolean', value: calcolato.valore === '1' };
    if (calcolato.tipo === 'e') return { kind: 'error', error: calcolato.valore as never };
    return { kind: 'text', value: calcolato.valore };
  }
  if (raw === '') return { kind: 'empty' };
  if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(raw.trim())) return { kind: 'number', value: Number(raw) };
  if (raw === 'TRUE' || raw === 'FALSE') return { kind: 'boolean', value: raw === 'TRUE' };
  return { kind: 'text', value: raw.startsWith("'") ? raw.slice(1) : raw };
}

/** Il testo da stampare di un valore, con il formato dei numeri della cella. */
export function testoDaStampare(valore: CellValue, formato?: string): ValoreStampa {
  const tipo: TipoValore = valore.kind === 'number' ? 'numero' : valore.kind === 'text' ? 'testo' : valore.kind === 'boolean' ? 'booleano' : valore.kind === 'error' ? 'errore' : 'vuoto';
  if (valore.kind === 'number') return { testo: formatCellValue(valore, formato), tipo };
  return { testo: formatDisplayValue(valore).text, tipo };
}

const haSfondo = (s: CellStyle | undefined): boolean => !!s?.fill && s.fill !== 'none' && s.fill !== 'auto';
function bordoCss(b: { style?: string; color?: string } | undefined): string | undefined {
  if (!b || b.style === 'none' || !b.style) return undefined;
  const colore = !b.color || b.color === 'auto' ? '#000000' : b.color;
  return `${b.style === 'medium' ? 2 : 1}px ${b.style === 'dashed' ? 'dashed' : 'solid'} ${colore}`;
}
function stileCella(s: CellStyle, tipo: TipoValore, griglia: boolean): Record<string, string> {
  const css: Record<string, string> = {};
  const al: HorizontalAlign = s.hAlign ?? (tipo === 'numero' ? 'right' : tipo === 'booleano' || tipo === 'errore' ? 'center' : 'left');
  css.textAlign = al;
  if (s.bold) css.fontWeight = '700';
  if (s.italic) css.fontStyle = 'italic';
  const dec = [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  if (dec) css.textDecoration = dec;
  if (s.color && s.color !== 'auto') css.color = s.color;
  if (haSfondo(s)) css.backgroundColor = s.fill as string;
  if (s.fontFamily) css.fontFamily = s.fontFamily;
  if (s.fontSize) css.fontSize = `${s.fontSize}px`;
  if (s.vAlign) css.verticalAlign = s.vAlign;
  css.whiteSpace = s.wrap ? 'pre-wrap' : 'nowrap';
  const grigio = griglia ? '1px solid #c0c0c0' : undefined;
  const b = s.borders;
  const lato = (x: string | undefined): string | undefined => x ?? grigio;
  const alto = lato(bordoCss(b?.top)), destra = lato(bordoCss(b?.right)), basso = lato(bordoCss(b?.bottom)), sinistra = lato(bordoCss(b?.left));
  if (alto) css.borderTop = alto;
  if (destra) css.borderRight = destra;
  if (basso) css.borderBottom = basso;
  if (sinistra) css.borderLeft = sinistra;
  return css;
}

/** Le celle di una pagina: righe e colonne possono non essere di fila (quelle ripetute davanti). Una cella unita si stampa con le righe e colonne che ha sulla pagina. */
function cellePagina(foglio: FoglioScambio, righe: number[], colonne: number[], valore: (r: number, c: number) => ValoreStampa, griglia: boolean): CellaStampa[][] {
  const coperte = new Set<string>();
  const ancore = new Map<string, { rowspan: number; colspan: number }>();
  for (const m of foglio.unioni) {
    // l'ancora sulla pagina è la prima cella dell'unione che la pagina contiene
    const rr = righe.filter((r) => r >= m.startRow && r <= m.endRow);
    const cc = colonne.filter((c) => c >= m.startCol && c <= m.endCol);
    if (rr.length === 0 || cc.length === 0) continue;
    ancore.set(`${rr[0]}:${cc[0]}`, { rowspan: rr.length, colspan: cc.length });
    for (const r of rr) for (const c of cc) if (r !== rr[0] || c !== cc[0]) coperte.add(`${r}:${c}`);
  }
  return righe.map((r) => {
    const riga: CellaStampa[] = [];
    for (const c of colonne) {
      if (coperte.has(`${r}:${c}`)) continue;
      const unione = ancore.get(`${r}:${c}`);
      // della cella unita si stampa il testo della sua prima cella vera
      const m = unione ? foglio.unioni.find((u) => r >= u.startRow && r <= u.endRow && c >= u.startCol && c <= u.endCol) : undefined;
      const rv = m ? m.startRow : r, cv = m ? m.startCol : c;
      const v = valore(rv, cv);
      const s = stileEffettivo(foglio, rv, cv, indirizzoCella(rv, cv));
      riga.push({ riga: r, colonna: c, testo: v.testo, rowspan: unione?.rowspan ?? 1, colspan: unione?.colspan ?? 1, stile: stileCella(s, v.tipo, griglia) });
    }
    return riga;
  });
}

export interface ContestoStampa { file: string; adesso: Date; locale: string }

/** L'area da stampare: l'area di stampa scelta, oppure tutto ciò che il foglio usa. null se non c'è niente. */
export function areaDelPiano(foglio: FoglioScambio, p: ImpostaPagina): AreaStampa | null {
  if (p.area) return p.area;
  const a = areaDaStampare(foglio);
  return a ? { startRow: a.riga1, endRow: a.riga2, startCol: a.col1, endCol: a.col2 } : null;
}

/** Il piano di stampa di un foglio. `valore` dà il testo di ogni cella (dal motore, o da valoreDaScambio). null se non c'è niente da stampare. */
export function pianoDiStampa(foglio: FoglioScambio, valore: (r: number, c: number) => ValoreStampa, ctx: ContestoStampa): PianoStampa | null {
  const p = foglio.pagina ?? paginaPredefinita();
  const area = areaDelPiano(foglio, p);
  if (!area) return null;
  const nascosteR = new Set(foglio.righeNascoste ?? []);
  const nascosteC = new Set(foglio.colonneNascoste ?? []);
  const larghezza = (c: number): number => (nascosteC.has(c) ? 0 : foglio.larghezze[c] ?? DEFAULT_COL_WIDTH);
  const altezza = (r: number): number => (nascosteR.has(r) ? 0 : foglio.altezze[r] ?? DEFAULT_ROW_HEIGHT);
  const imp = impagina({ area, larghezza, altezza }, p);
  const data = ctx.adesso.toLocaleDateString(ctx.locale);
  const ora = ctx.adesso.toLocaleTimeString(ctx.locale, { hour: '2-digit', minute: '2-digit' });
  let totale = 0;
  const campi = (t: TestiMargine, n: number): TestiMargine => {
    const v = { pagina: n, pagine: totale, foglio: foglio.nome, file: ctx.file, data, ora };
    return { sinistra: sostituisciCampi(t.sinistra, v), centro: sostituisciCampi(t.centro, v), destra: sostituisciCampi(t.destra, v) };
  };
  const vere = imp.pagine.filter((pg) => pg.righe.length > 0 && pg.colonne.length > 0);
  totale = vere.length;
  const pagine = vere.map((pg, i) => ({
    righe: pg.righe,
    colonne: pg.colonne,
    larghezze: pg.colonne.map(larghezza),
    altezze: pg.righe.map(altezza),
    celle: cellePagina(foglio, pg.righe, pg.colonne, valore, p.griglia),
    intestazione: campi(p.intestazione, i + 1),
    pie: campi(p.pie, i + 1),
  }));
  if (pagine.length === 0) return null;
  return {
    carta: misureCarta(p), margini: { ...p.margini }, scala: imp.scala,
    griglia: p.griglia, intestazioniRigheColonne: p.intestazioniRigheColonne,
    centraOrizzontale: p.centraOrizzontale, centraVerticale: p.centraVerticale,
    pagine,
  };
}

/** Lettere delle colonne di una pagina (A, B…), per le intestazioni di riga e colonna. */
export function lettereColonne(pg: PaginaPiano): string[] { return pg.colonne.map(columnIndexToLetters); }
