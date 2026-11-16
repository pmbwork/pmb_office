/**
 * Modulo puro per la logica di riempimento celle e generazione serie (M1):
 * - Fill handle con trascinamento
 * - Serie numeriche (tendenza lineare da 2 o più celle; una cella sola si copia)
 * - Serie di date, nomi di mesi e di giorni
 * - Serie testuali con numeri finali (es. "Voce 1", "Riga 001")
 * - Formule con traslazione dei riferimenti relativi tramite shiftFormula
 * - Scorciatoie Ctrl+D (fill down), Ctrl+R (fill right)
 * Zero dipendenze DOM, puramente testabile in Node/Vitest.
 */

import { shiftFormula } from '../engine/shift-formula';
import type { CellValue } from '../engine/values';

export interface FillSourceCell {
  row: number;
  col: number;
  raw: string;
  value?: CellValue;
}

export interface FillTargetCell {
  row: number;
  col: number;
  raw: string;
}

// ---- serie

const NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const ARROTONDA = (v: number): string => String(Number(v.toPrecision(12)));

const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const MESI_IT_ABB = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MESI_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MESI_EN_ABB = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const GIORNI_IT = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const GIORNI_IT_ABB = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const GIORNI_EN = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const GIORNI_EN_ABB = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const ELENCHI: string[][] = [MESI_IT, MESI_IT_ABB, MESI_EN, MESI_EN_ABB, GIORNI_IT, GIORNI_IT_ABB, GIORNI_EN, GIORNI_EN_ABB];

/** Retta dei minimi quadrati sui punti (0, y0), (1, y1)...: il valore alla posizione `pos`. Con valori in progressione aritmetica dà il termine esatto. */
function tendenzaLineare(y: number[], pos: number): number {
  const n = y.length;
  const mediaX = (n - 1) / 2;
  const mediaY = y.reduce((x, v) => x + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) { num += (i - mediaX) * (y[i] - mediaY); den += (i - mediaX) ** 2; }
  const pendenza = den === 0 ? 0 : num / den;
  return mediaY + pendenza * (pos - mediaX);
}

function conStile(modello: string, parola: string): string {
  if (modello === modello.toUpperCase() && modello.length > 1) return parola.toUpperCase();
  if (modello[0] === modello[0].toUpperCase()) return parola[0].toUpperCase() + parola.slice(1);
  return parola;
}

/** Date scritte come gg/mm/aaaa o aaaa-mm-gg: giorni dall'epoca e come riscriverle. */
function leggiData(testo: string): { giorni: number; scrivi: (g: number) => string } | null {
  const it = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(testo);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(testo);
  const [g, m, a] = it ? [Number(it[1]), Number(it[2]), Number(it[3])] : iso ? [Number(iso[3]), Number(iso[2]), Number(iso[1])] : [0, 0, 0];
  if (!it && !iso) return null;
  const d = new Date(Date.UTC(a, m - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g) return null;
  const due = (n: number) => String(n).padStart(2, '0');
  return {
    giorni: Math.round(d.getTime() / 86400000),
    scrivi: (n: number) => {
      const x = new Date(n * 86400000);
      return it ? `${due(x.getUTCDate())}/${due(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}` : `${x.getUTCFullYear()}-${due(x.getUTCMonth() + 1)}-${due(x.getUTCDate())}`;
    },
  };
}

/** Il valore di una serie alla posizione `pos` (0 = la prima cella di partenza, negativa = prima di essa), o null se i valori non formano una serie e vanno solo copiati. */
export function valoreSerie(raws: string[], pos: number): string | null {
  const v = raws.map((r) => r.trim());
  const n = v.length;
  // numeri: una cella sola si copia, due o più seguono la tendenza lineare
  if (v.every((x) => NUMERO.test(x))) return n === 1 ? null : ARROTONDA(tendenzaLineare(v.map(Number), pos));
  // date
  const date = v.map(leggiData);
  if (date.every((d) => d !== null)) {
    const g = date.map((d) => (d as { giorni: number }).giorni);
    const valore = n === 1 ? g[0] + pos : Math.round(tendenzaLineare(g, pos));
    return (date[0] as { scrivi: (n: number) => string }).scrivi(valore);
  }
  // nomi di mesi e giorni (italiano e inglese, interi o abbreviati)
  for (const elenco of ELENCHI) {
    const indici = v.map((x) => elenco.indexOf(x.toLowerCase()));
    if (indici.every((i) => i >= 0)) {
      const lunghezza = elenco.length;
      const passo = n === 1 ? 1 : (indici[n - 1] - indici[0]) / (n - 1);
      if (!Number.isInteger(passo)) return null;
      const i = (((indici[0] + Math.round(passo) * pos) % lunghezza) + lunghezza) % lunghezza;
      return conStile(v[0], elenco[i]);
    }
  }
  // testo con un numero in fondo ("Voce 1", "Riga 001")
  const parti = v.map((x) => /^(.*?)(\d+)$/.exec(x));
  if (parti.every((m) => m !== null) && parti.every((m) => (m as RegExpExecArray)[1] === (parti[0] as RegExpExecArray)[1])) {
    const numeri = parti.map((m) => parseInt((m as RegExpExecArray)[2], 10));
    const prefisso = (parti[0] as RegExpExecArray)[1];
    const cifre = (parti[0] as RegExpExecArray)[2].length;
    const valore = n === 1 ? numeri[0] + pos : Math.round(tendenzaLineare(numeri, pos));
    return `${prefisso}${String(Math.max(0, valore)).padStart(cifre, '0')}`;
  }
  return null;
}

/**
 * Riconosce e calcola il valore riempito per una cella bersaglio dato un intervallo sorgente.
 * Una formula si copia traslando i riferimenti relativi. Numeri (2 o più), date, nomi di mesi e giorni e testi con un numero in fondo
 * formano una serie; un numero solo si copia. Tutto il resto si ripete in ciclo.
 */
export function computeFillValue(
  sourceCells: FillSourceCell[],
  targetRow: number,
  targetCol: number,
  direction: 'down' | 'right' | 'up' | 'left'
): string {
  if (sourceCells.length === 0) return '';
  const verticale = direction === 'down' || direction === 'up';
  const ordinate = [...sourceCells].sort((x, y) => (verticale ? x.row - y.row : x.col - y.col));
  const n = ordinate.length;
  const pos = verticale ? targetRow - ordinate[0].row : targetCol - ordinate[0].col;

  const eFormula = (r: string) => r.trim().startsWith('=');
  if (!ordinate.some((c) => eFormula(c.raw))) {
    const serie = valoreSerie(ordinate.map((c) => c.raw), pos);
    if (serie !== null) return serie;
  }
  // copia (in ciclo se le celle sono più d'una); le formule traslano i riferimenti relativi
  const src = ordinate[((pos % n) + n) % n];
  if (eFormula(src.raw)) {
    try {
      return shiftFormula(src.raw, targetRow - src.row, targetCol - src.col);
    } catch {
      return src.raw;
    }
  }
  return src.raw;
}

/**
 * Operazione Fill Down (Ctrl+D):
 * Riempie tutte le righe sottostanti nell'intervallo selezionato
 * usando i valori della prima riga della selezione per ciascuna colonna.
 */
export function computeFillDown(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCellRaw: (row: number, col: number) => string
): FillTargetCell[] {
  const operations: FillTargetCell[] = [];
  if (endRow <= startRow) return operations;

  for (let c = startCol; c <= endCol; c++) {
    const topRaw = getCellRaw(startRow, c);
    for (let r = startRow + 1; r <= endRow; r++) {
      let nextRaw = topRaw;
      if (topRaw.trim().startsWith('=')) {
        try {
          nextRaw = shiftFormula(topRaw, r - startRow, 0);
        } catch {
          nextRaw = topRaw;
        }
      }
      operations.push({ row: r, col: c, raw: nextRaw });
    }
  }

  return operations;
}

/**
 * Operazione Fill Right (Ctrl+R):
 * Riempie tutte le colonne a destra nell'intervallo selezionato
 * usando i valori della prima colonna della selezione per ciascuna riga.
 */
export function computeFillRight(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  getCellRaw: (row: number, col: number) => string
): FillTargetCell[] {
  const operations: FillTargetCell[] = [];
  if (endCol <= startCol) return operations;

  for (let r = startRow; r <= endRow; r++) {
    const leftRaw = getCellRaw(r, startCol);
    for (let c = startCol + 1; c <= endCol; c++) {
      let nextRaw = leftRaw;
      if (leftRaw.trim().startsWith('=')) {
        try {
          nextRaw = shiftFormula(leftRaw, 0, c - startCol);
        } catch {
          nextRaw = leftRaw;
        }
      }
      operations.push({ row: r, col: c, raw: nextRaw });
    }
  }

  return operations;
}
