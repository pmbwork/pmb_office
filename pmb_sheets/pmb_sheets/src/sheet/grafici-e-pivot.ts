/**
 * Grafici e tabelle pivot legati a un intervallo di celle: l'intervallo deve seguire i dati quando si inseriscono o eliminano righe e colonne
 * e quando si tagliano le celle, e i dati dei grafici si rileggono dall'intervallo (un grafico è una vista viva dei dati, non una fotografia).
 * Modulo puro: niente DOM e niente motore.
 */
import { columnIndexToLetters, columnLettersToIndex } from '../engine/address';
import type { CellValue } from '../engine/values';
import type { ChartConfig, ChartSeries } from './chart/chart-model';
import type { PivotConfig, PivotField } from './pivot/pivot-model';
import { nuovoIndice, nuovoIntervallo, type OperazioneStruttura } from './sposta-struttura';
import { areaDestinazione, type Area, type Spostamento } from './sposta-con-celle';
import { t } from '../i18n/lingua';

const RE_INTERVALLO = /^\s*\$?([A-Za-z]+)\$?(\d+)\s*:\s*\$?([A-Za-z]+)\$?(\d+)\s*$/;

/** "A1:B5" (anche con i $) → area; null se non è un intervallo. */
export function leggiIntervalloTesto(testo: string): Area | null {
  const m = RE_INTERVALLO.exec(testo);
  if (!m) return null;
  const c1 = columnLettersToIndex(m[1].toUpperCase()), c2 = columnLettersToIndex(m[3].toUpperCase());
  const r1 = parseInt(m[2], 10), r2 = parseInt(m[4], 10);
  return { startRow: Math.min(r1, r2), endRow: Math.max(r1, r2), startCol: Math.min(c1, c2), endCol: Math.max(c1, c2) };
}

export function scriviIntervalloTesto(a: Area): string {
  return `${columnIndexToLetters(a.startCol)}${a.startRow}:${columnIndexToLetters(a.endCol)}${a.endRow}`;
}

const eRiga = (op: OperazioneStruttura) => op.tipo.endsWith('_rows');

/** L'intervallo dopo l'inserimento o l'eliminazione: si sposta, si allarga se l'inserimento cade dentro, si restringe; null se è sparito del tutto. */
export function areaDopoStruttura(a: Area, op: OperazioneStruttura): Area | null {
  if (eRiga(op)) {
    const r = nuovoIntervallo(a.startRow, a.endRow, op);
    return r ? { ...a, startRow: r[0], endRow: r[1] } : null;
  }
  const c = nuovoIntervallo(a.startCol, a.endCol, op);
  return c ? { ...a, startCol: c[0], endCol: c[1] } : null;
}

const dentro = (a: Area, grande: Area): boolean => a.startRow >= grande.startRow && a.endRow <= grande.endRow && a.startCol >= grande.startCol && a.endCol <= grande.endCol;

/** Dopo un taglia e incolla: l'intervallo che sta tutto nell'area tagliata la segue (anche su un altro foglio); gli altri restano. */
export function posizioneDopoSpostamento(foglio: string, a: Area, s: Spostamento): { foglio: string; area: Area } {
  if (foglio !== s.foglioOrigine || !dentro(a, s.area)) return { foglio, area: a };
  const dest = areaDestinazione({ ...s, area: a });
  return { foglio: s.foglioDestinazione, area: dest };
}

// ---------------- grafici ----------------

const NOME_AUTOMATICO = /^Serie ([A-Z]+|\d+)$/;

/** Grafici dopo un inserimento o un'eliminazione sul foglio dato. Un grafico i cui dati sono stati eliminati tutti sparisce. */
export function graficiDopoStruttura(grafici: readonly ChartConfig[], foglio: string, op: OperazioneStruttura): ChartConfig[] {
  const out: ChartConfig[] = [];
  for (const g of grafici) {
    if (g.sheetName && g.sheetName !== foglio) { out.push(g); continue; }
    const a = leggiIntervalloTesto(g.dataRange);
    if (!a) { out.push(g); continue; }
    const n = areaDopoStruttura(a, op);
    if (n) out.push({ ...g, dataRange: scriviIntervalloTesto(n) });
  }
  return out;
}

export function graficiDopoSpostamento(grafici: readonly ChartConfig[], s: Spostamento): ChartConfig[] {
  return grafici.map((g) => {
    const a = leggiIntervalloTesto(g.dataRange);
    if (!a) return g;
    const p = posizioneDopoSpostamento(g.sheetName || s.foglioOrigine, a, s);
    if (p.foglio === (g.sheetName || s.foglioOrigine) && p.area === a) return g;
    return { ...g, sheetName: p.foglio, dataRange: scriviIntervalloTesto(p.area) };
  });
}

const testoCategoria = (v: CellValue, n: number): string => (v.kind === 'text' ? v.value : v.kind === 'number' ? String(v.value) : t("Voce {}", n));

/** Categorie e serie di un grafico lette dai valori dell'intervallo (prima colonna = categorie, le altre = serie). Nomi e colori già scelti si conservano per posizione. */
export function datiDelGrafico(g: ChartConfig, valori: CellValue[][]): { categories: string[]; series: ChartSeries[] } {
  const a = leggiIntervalloTesto(g.dataRange);
  const categories = valori.map((riga, i) => testoCategoria(riga[0] ?? { kind: 'empty' }, i + 1));
  const series: ChartSeries[] = [];
  const colonne = valori.reduce((m, r) => Math.max(m, r.length), 0);
  for (let c = 1; c < colonne; c++) {
    const vecchia = g.series[c - 1];
    const lettera = a ? columnIndexToLetters(a.startCol + c) : String(c);
    const nome = vecchia && !NOME_AUTOMATICO.test(vecchia.name) ? vecchia.name : t("Serie {}", lettera);
    series.push({ ...(vecchia ?? {}), name: nome, data: valori.map((riga) => { const v = riga[c]; return v && v.kind === 'number' ? v.value : 0; }) });
  }
  if (series.length === 0) {
    const vecchia = g.series[0];
    series.push({ ...(vecchia ?? {}), name: vecchia && !NOME_AUTOMATICO.test(vecchia.name) ? vecchia.name : t("Serie 1"), data: valori.map((riga, i) => { const v = riga[0]; return v && v.kind === 'number' ? v.value : 10 * (i + 1); }) });
  }
  return { categories, series };
}

/** Il grafico con i dati riletti; lo stesso oggetto se non è cambiato niente. */
export function graficoAggiornato(g: ChartConfig, valori: CellValue[][]): ChartConfig {
  const { categories, series } = datiDelGrafico(g, valori);
  if (JSON.stringify([g.categories, g.series]) === JSON.stringify([categories, series])) return g;
  return { ...g, categories, series };
}

// ---------------- fogli: rinomina, eliminazione, duplicazione ----------------

/** Un foglio è stato rinominato: i grafici che lo usano lo seguono (senza questo il grafico sparirebbe: si mostra solo sul foglio che ha il suo nome). */
export function graficiDopoRinomina(grafici: readonly ChartConfig[], da: string, a: string): ChartConfig[] {
  return grafici.map((g) => (g.sheetName === da ? { ...g, sheetName: a } : g));
}

/** Rinomina: la pivot segue sia il foglio dei dati sia quello del risultato. */
export function pivotDopoRinomina(pivots: readonly PivotConfig[], da: string, a: string): PivotConfig[] {
  return pivots.map((p) => (p.sourceSheet === da || p.resultSheet === da
    ? { ...p, sourceSheet: p.sourceSheet === da ? a : p.sourceSheet, ...(p.resultSheet === da ? { resultSheet: a } : {}) }
    : p));
}

/** Un foglio è stato eliminato: spariscono i grafici che stavano lì. */
export function graficiDopoEliminazioneFoglio(grafici: readonly ChartConfig[], nome: string): ChartConfig[] {
  return grafici.filter((g) => g.sheetName !== nome);
}

/** Eliminazione: spariscono le pivot i cui dati stavano nel foglio; se è sparito solo il foglio del risultato, la pivot resta e ne avrà uno nuovo alla prossima applicazione. */
export function pivotDopoEliminazioneFoglio(pivots: readonly PivotConfig[], nome: string): PivotConfig[] {
  return pivots
    .filter((p) => p.sourceSheet !== nome)
    .map((p) => {
      if (p.resultSheet !== nome) return p;
      const { resultSheet: _perso, ...resto } = p;
      return resto;
    });
}

/** Un foglio è stato duplicato: i suoi grafici hanno una copia sul foglio nuovo (stesso intervallo, che sul nuovo foglio indica i dati copiati). */
export function graficiDelFoglioDuplicato(grafici: readonly ChartConfig[], origine: string, copia: string, nuovoId: () => string): ChartConfig[] {
  return [...grafici, ...grafici.filter((g) => g.sheetName === origine).map((g) => ({ ...g, id: nuovoId(), sheetName: copia }))];
}

// ---------------- pivot ----------------

/** Pivot dopo un inserimento o un'eliminazione sul foglio dato: l'intervallo di partenza si sposta e i campi (indici di colonna relativi) lo seguono.
 *  I campi di una colonna eliminata cadono; una pivot senza più dati, o senza campi valore, sparisce. */
export function pivotDopoStruttura(pivots: readonly PivotConfig[], foglio: string, op: OperazioneStruttura): PivotConfig[] {
  const out: PivotConfig[] = [];
  for (const p of pivots) {
    if (p.sourceSheet !== foglio) { out.push(p); continue; }
    const a = leggiIntervalloTesto(p.sourceRange);
    if (!a) { out.push(p); continue; }
    const n = areaDopoStruttura(a, op);
    if (!n) continue;
    const seguiCampo = <T extends PivotField>(f: T): T | null => {
      if (eRiga(op)) return f;
      const assoluta = nuovoIndice(a.startCol + f.sourceColIndex, op);
      return assoluta === null ? null : { ...f, sourceColIndex: assoluta - n.startCol };
    };
    const compatta = <T extends PivotField>(campi: readonly T[]): T[] => campi.map(seguiCampo).filter((f): f is T => f !== null);
    const valueFields = compatta(p.valueFields);
    if (valueFields.length === 0) continue;
    out.push({
      ...p,
      sourceRange: scriviIntervalloTesto(n),
      rowFields: compatta(p.rowFields),
      colFields: compatta(p.colFields),
      valueFields,
      filters: compatta(p.filters),
    });
  }
  return out;
}

export function pivotDopoSpostamento(pivots: readonly PivotConfig[], s: Spostamento): PivotConfig[] {
  return pivots.map((p) => {
    const a = leggiIntervalloTesto(p.sourceRange);
    if (!a) return p;
    const pos = posizioneDopoSpostamento(p.sourceSheet, a, s);
    if (pos.foglio === p.sourceSheet && pos.area === a) return p;
    return { ...p, sourceSheet: pos.foglio, sourceRange: scriviIntervalloTesto(pos.area) };
  });
}
