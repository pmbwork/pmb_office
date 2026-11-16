// Inserisci > Tabella di pmb_sheets: dà a un blocco di dati l'aspetto di una tabella (intestazione evidenziata, righe a strisce, filo sotto l'ultima riga).
// È solo formattazione: non nasce un oggetto "tabella" (niente nome, niente riferimenti strutturati, niente filtro proprio). Modulo puro, niente DOM.
import type { CellRange } from './selection';
import type { CellStyle } from './styles';

export const COLORE_INTESTAZIONE = '#1a73e8';
export const COLORE_STRISCIA = '#e8f0fe';
export const TESTO_INTESTAZIONE = '#ffffff';

/** Il blocco di dati che contiene la cella `da`: si allarga finché intorno (anche in diagonale) ci sono celle piene.
 *  `piena(riga, colonna)` dice se una cella ha un contenuto; `limite` è l'ultima riga/colonna da guardare. */
export function regioneDati(piena: (riga: number, colonna: number) => boolean, da: { row: number; col: number }, limite: { righe: number; colonne: number }): CellRange {
  let r0 = da.row, r1 = da.row, c0 = da.col, c1 = da.col;
  let cambiato = true;
  let giri = 0;
  const rigaPiena = (r: number): boolean => { for (let c = Math.max(1, c0 - 1); c <= Math.min(limite.colonne, c1 + 1); c++) if (piena(r, c)) return true; return false; };
  const colonnaPiena = (c: number): boolean => { for (let r = Math.max(1, r0 - 1); r <= Math.min(limite.righe, r1 + 1); r++) if (piena(r, c)) return true; return false; };
  while (cambiato && giri++ < 10000) {
    cambiato = false;
    if (r0 > 1 && rigaPiena(r0 - 1)) { r0--; cambiato = true; }
    if (r1 < limite.righe && rigaPiena(r1 + 1)) { r1++; cambiato = true; }
    if (c0 > 1 && colonnaPiena(c0 - 1)) { c0--; cambiato = true; }
    if (c1 < limite.colonne && colonnaPiena(c1 + 1)) { c1++; cambiato = true; }
  }
  return { startRow: r0, endRow: r1, startCol: c0, endCol: c1 };
}

export interface RitoccoStile { range: CellRange; ritocco: Partial<CellStyle> }

/** Le formattazioni che fanno una tabella del blocco: la prima riga è l'intestazione, poi una riga su due a strisce, e un filo sotto l'ultima.
 *  `fill: undefined` toglie lo sfondo che c'era: ripetere il comando non lascia strisce spostate. */
export function ritocchiTabella(blocco: CellRange): RitoccoStile[] {
  const { startRow, endRow, startCol, endCol } = blocco;
  const lista: RitoccoStile[] = [
    { range: { startRow, endRow: startRow, startCol, endCol }, ritocco: { bold: true, fill: COLORE_INTESTAZIONE, color: TESTO_INTESTAZIONE } },
  ];
  for (let r = startRow + 1; r <= endRow; r++) {
    const striscia = (r - startRow) % 2 === 1;
    lista.push({ range: { startRow: r, endRow: r, startCol, endCol }, ritocco: { fill: striscia ? COLORE_STRISCIA : undefined } });
  }
  lista.push({ range: { startRow: endRow, endRow, startCol, endCol }, ritocco: { borders: { bottom: { style: 'thin', color: COLORE_INTESTAZIONE } } } });
  return lista;
}
