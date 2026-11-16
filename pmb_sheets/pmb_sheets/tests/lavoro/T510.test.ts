import { describe, it, expect } from 'vitest';
import type { ChartConfig } from '../../src/sheet/chart/chart-model';
import type { PivotConfig } from '../../src/sheet/pivot/pivot-model';
import {
  graficiDelFoglioDuplicato, graficiDopoEliminazioneFoglio, graficiDopoRinomina, pivotDopoEliminazioneFoglio, pivotDopoRinomina, pivotDopoStruttura,
} from '../../src/sheet/grafici-e-pivot';
import { esporta, importa } from '../../src/formati/file';
import { foglioVuoto, documentoDaScambio } from '../../src/formati/scambio';

const grafico = (id: string, sheetName: string, dataRange = 'A1:B5'): ChartConfig => ({
  id, title: id, type: 'column', sheetName, dataRange, x: 0, y: 0, width: 100, height: 100, showLegend: true, showLabels: false, categories: [], series: [],
});
const pivot = (id: string, sourceSheet: string, resultSheet?: string): PivotConfig => ({
  id, name: id, sourceSheet, sourceRange: 'A1:C10', rowFields: [{ sourceColIndex: 0, name: 'Reparto' }], colFields: [],
  valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'SUM' }], filters: [], showGrandTotals: true, showSubtotals: false, ...(resultSheet ? { resultSheet } : {}),
});

describe('T510: grafici e pivot con rinomina, eliminazione e duplicazione dei fogli', () => {
  it('rinominare un foglio: i suoi grafici lo seguono, quelli degli altri fogli no', () => {
    const r = graficiDopoRinomina([grafico('g1', 'Dati'), grafico('g2', 'Altro')], 'Dati', 'Vendite 2026');
    expect(r.map((g) => g.sheetName)).toEqual(['Vendite 2026', 'Altro']);
    expect(r[0].dataRange).toBe('A1:B5');
  });

  it('rinominare: la pivot segue il foglio dei dati e quello del risultato', () => {
    const r = pivotDopoRinomina([pivot('p1', 'Dati', 'Tabella pivot 1'), pivot('p2', 'Altro', 'Dati')], 'Dati', 'Nuovo');
    expect(r[0]).toMatchObject({ sourceSheet: 'Nuovo', resultSheet: 'Tabella pivot 1' });
    expect(r[1]).toMatchObject({ sourceSheet: 'Altro', resultSheet: 'Nuovo' });
    const solo = pivotDopoRinomina([pivot('p3', 'Dati')], 'Dati', 'X')[0];
    expect(solo.sourceSheet).toBe('X');
    expect('resultSheet' in solo).toBe(false);
  });

  it('eliminare un foglio: spariscono i suoi grafici', () => {
    const r = graficiDopoEliminazioneFoglio([grafico('g1', 'Dati'), grafico('g2', 'Altro'), grafico('g3', 'Dati')], 'Dati');
    expect(r.map((g) => g.id)).toEqual(['g2']);
  });

  it('eliminare il foglio dei dati: sparisce la pivot; eliminare solo quello del risultato: la pivot resta senza foglio', () => {
    const r = pivotDopoEliminazioneFoglio([pivot('p1', 'Dati', 'P1'), pivot('p2', 'Altro', 'P2')], 'Dati');
    expect(r.map((p) => p.id)).toEqual(['p2']);
    const s = pivotDopoEliminazioneFoglio([pivot('p1', 'Dati', 'P1')], 'P1');
    expect(s.length).toBe(1);
    expect(s[0].sourceSheet).toBe('Dati');
    expect('resultSheet' in s[0]).toBe(false);
    expect(pivotDopoEliminazioneFoglio([pivot('p1', 'Dati', 'P1')], 'Inesistente')[0].resultSheet).toBe('P1');
  });

  it('duplicare un foglio: i suoi grafici hanno una copia con un id nuovo sul foglio nuovo', () => {
    let n = 0;
    const r = graficiDelFoglioDuplicato([grafico('g1', 'Dati'), grafico('g2', 'Altro')], 'Dati', 'Copia di Dati', () => `nuovo-${++n}`);
    expect(r.length).toBe(3);
    expect(r[2]).toMatchObject({ id: 'nuovo-1', sheetName: 'Copia di Dati', dataRange: 'A1:B5', title: 'g1' });
    expect(r[0].sheetName).toBe('Dati');
    expect(new Set(r.map((g) => g.id)).size).toBe(3);
  });

  it('le operazioni non modificano i dati di partenza', () => {
    const g = [grafico('g1', 'Dati')];
    const p = [pivot('p1', 'Dati', 'P1')];
    const gCopia = JSON.stringify(g), pCopia = JSON.stringify(p);
    graficiDopoRinomina(g, 'Dati', 'X'); graficiDopoEliminazioneFoglio(g, 'Dati'); graficiDelFoglioDuplicato(g, 'Dati', 'C', () => 'n');
    pivotDopoRinomina(p, 'Dati', 'X'); pivotDopoEliminazioneFoglio(p, 'Dati'); pivotDopoEliminazioneFoglio(p, 'P1');
    expect(JSON.stringify(g)).toBe(gCopia);
    expect(JSON.stringify(p)).toBe(pCopia);
  });

  it('il foglio del risultato sopravvive a inserimenti e eliminazioni di righe e colonne', () => {
    const r = pivotDopoStruttura([pivot('p1', 'Dati', 'P1')], 'Dati', { tipo: 'insert_cols', indice: 1, conta: 1 });
    expect(r[0].resultSheet).toBe('P1');
    expect(r[0].sourceRange).toBe('B1:D10');
  });

  it('il foglio del risultato si salva nel file .psheet e si ritrova alla riapertura', async () => {
    const f = foglioVuoto('Dati');
    f.celle['A1'] = 'x';
    const dati = documentoDaScambio({ fogli: [f], foglioAttivo: 'Dati' });
    const conPivot = { ...dati, pivots: [pivot('p1', 'Dati', 'Tabella pivot 1')] as never };
    const riletto = await importa(await esporta(conPivot, 'fsheet'), 'x.psheet');
    expect((riletto.dati.pivots as unknown as PivotConfig[])[0].resultSheet).toBe('Tabella pivot 1');
  });
});
