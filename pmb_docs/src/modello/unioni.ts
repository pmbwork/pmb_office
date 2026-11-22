// Celle unite e riga di intestazione delle tabelle di pmb_docs. Tutto puro.
// Una cella unita è un rettangolo di celle: la cella in alto a sinistra (l'ancora) porta nel suo tb quante colonne (cs) e quante
// righe (rs) copre, e le altre celle del rettangolo restano nella tabella come un paragrafo vuoto con co: true (coperte), così la
// tabella resta rettangolare (righe e colonne si contano come prima) e i formati che scrivono le unioni (gridSpan e vMerge di Word,
// number-columns-spanned e covered-table-cell di ODF) sanno sempre dove sono. Le righe di intestazione (h: true su ogni cella della
// riga) sono le prime righe della tabella: Word e LibreOffice le ripetono in cima a ogni pagina.
import type { CellaTabella } from './documento';

/** Come è fatta una cella della griglia. */
export interface Unione { cs: number; rs: number; co: boolean; h: boolean }

export const UNIONE_SEMPLICE = (): Unione => ({ cs: 1, rs: 1, co: false, h: false });

export function unioneDi(tb: CellaTabella | undefined): Unione {
  return { cs: tb?.cs ?? 1, rs: tb?.rs ?? 1, co: tb?.co === true, h: tb?.h === true };
}

/** Il tb di una cella con i dati dell'unione (solo quelli diversi dal normale). */
export function cellaCon(i: number, r: number, c: number, u: Unione): CellaTabella {
  return { i, r, c, ...(u.cs > 1 ? { cs: u.cs } : {}), ...(u.rs > 1 ? { rs: u.rs } : {}), ...(u.co ? { co: true } : {}), ...(u.h ? { h: true } : {}) };
}

/** L'ancora che copre la cella (r, c): la cella stessa se non è coperta. null se una cella coperta non ha un'ancora (griglia rovinata). */
export function ancoraDi(g: Unione[][], r: number, c: number): [number, number] | null {
  if (!g[r]?.[c]) return null;
  if (!g[r][c].co) return [r, c];
  for (let ar = r; ar >= 0; ar--) {
    for (let ac = c; ac >= 0; ac--) {
      const u = g[ar][ac];
      if (!u.co && ar + u.rs > r && ac + u.cs > c) return [ar, ac];
    }
  }
  return null;
}

/** null se le unioni della griglia sono in ordine; altrimenti il motivo. */
export function controllaUnioni(g: Unione[][]): string | null {
  const righe = g.length;
  const colonne = g[0]?.length ?? 0;
  const coperta = g.map((riga) => riga.map(() => false));
  for (let r = 0; r < righe; r++) {
    for (let c = 0; c < colonne; c++) {
      const u = g[r][c];
      if (u.co) { if (u.cs !== 1 || u.rs !== 1) return 'cella coperta con unione'; continue; }
      if (r + u.rs > righe || c + u.cs > colonne) return 'unione fuori dalla tabella';
      for (let rr = r; rr < r + u.rs; rr++) {
        for (let cc = c; cc < c + u.cs; cc++) {
          if (rr === r && cc === c) continue;
          if (!g[rr][cc].co || coperta[rr][cc]) return 'unione non valida';
          coperta[rr][cc] = true;
        }
      }
    }
  }
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) if (g[r][c].co && !coperta[r][c]) return 'cella coperta senza unione';
  // intestazione: le prime righe, tutte le celle della riga uguali
  let finita = false;
  for (let r = 0; r < righe; r++) {
    const h = g[r][0].h;
    if (g[r].some((u) => u.h !== h)) return 'intestazione a metà riga';
    if (h && finita) return 'intestazione non in cima alla tabella';
    if (!h) finita = true;
  }
  return null;
}

/** Ripara una griglia letta da un file: le unioni che escono dalla tabella o si sovrappongono si tolgono, le celle coperte senza
 *  un'ancora tornano celle normali, l'intestazione si tiene solo per le prime righe. Restituisce una griglia nuova. */
export function riparaUnioni(g: Unione[][]): Unione[][] {
  const righe = g.length;
  const colonne = g[0]?.length ?? 0;
  const out = g.map((riga) => riga.map((u) => ({ ...u, cs: Math.max(1, u.cs), rs: Math.max(1, u.rs) })));
  const presa = out.map((riga) => riga.map(() => false));
  for (let r = 0; r < righe; r++) {
    for (let c = 0; c < colonne; c++) {
      const u = out[r][c];
      if (u.co) { u.cs = 1; u.rs = 1; continue; }
      if (presa[r][c]) { u.co = true; u.cs = 1; u.rs = 1; continue; }
      let ok = r + u.rs <= righe && c + u.cs <= colonne;
      for (let rr = r; ok && rr < r + u.rs; rr++) {
        for (let cc = c; cc < c + u.cs; cc++) {
          if (rr === r && cc === c) continue;
          if (!out[rr][cc].co || presa[rr][cc]) { ok = false; break; }
        }
      }
      if (!ok) { u.cs = 1; u.rs = 1; }
      for (let rr = r; rr < r + u.rs; rr++) for (let cc = c; cc < c + u.cs; cc++) presa[rr][cc] = true;
    }
  }
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) if (out[r][c].co && !presa[r][c]) out[r][c].co = false;
  let finita = false;
  for (let r = 0; r < righe; r++) {
    const h = !finita && out[r].every((u) => u.h);
    if (!h) finita = true;
    for (const u of out[r]) u.h = h;
  }
  return out;
}

/** Inserisce una riga normale prima della riga dove: le unioni che passano per quel punto si allungano e la riga nuova vi resta coperta. */
export function inserisciRigaUnioni(g: Unione[][], dove: number): Unione[][] {
  const out = g.map((riga) => riga.map((u) => ({ ...u })));
  const colonne = out[0]?.length ?? 0;
  const nuova = Array.from({ length: colonne }, UNIONE_SEMPLICE);
  for (let r = 0; r < dove && r < out.length; r++) {
    for (let c = 0; c < colonne; c++) {
      const u = out[r][c];
      if (u.co || r + u.rs <= dove) continue;
      u.rs++;
      for (let cc = c; cc < c + u.cs; cc++) nuova[cc].co = true;
    }
  }
  const h = dove > 0 && dove < out.length && out[dove - 1][0].h && out[dove][0].h;
  for (const u of nuova) u.h = h;
  return [...out.slice(0, dove), nuova, ...out.slice(dove)];
}

/** Toglie la riga r0: le unioni che la attraversano si accorciano; quelle che cominciano lì passano alla riga sotto. */
export function eliminaRigaUnioni(g: Unione[][], r0: number): Unione[][] {
  const out = g.map((riga) => riga.map((u) => ({ ...u })));
  const colonne = out[0]?.length ?? 0;
  for (let r = 0; r < r0; r++) {
    for (let c = 0; c < colonne; c++) { const u = out[r][c]; if (!u.co && r + u.rs > r0) u.rs--; }
  }
  for (let c = 0; c < colonne; c++) {
    const u = out[r0][c];
    if (u.co || u.rs <= 1) continue;
    out[r0 + 1][c] = { cs: u.cs, rs: u.rs - 1, co: false, h: out[r0 + 1][c].h };
  }
  return out.filter((_, r) => r !== r0);
}

/** Scambia righe e colonne (per fare le operazioni sulle colonne con quelle sulle righe). L'intestazione si perde: la rimette chi chiama. */
export function trasponiUnioni(g: Unione[][]): Unione[][] {
  const colonne = g[0]?.length ?? 0;
  return Array.from({ length: colonne }, (_, c) => g.map((riga) => ({ cs: riga[c].rs, rs: riga[c].cs, co: riga[c].co, h: false })));
}

/** true se la griglia ha almeno una cella unita. */
export function haUnioni(g: Unione[][]): boolean { return g.some((riga) => riga.some((u) => u.co)); }
