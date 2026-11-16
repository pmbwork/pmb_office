import { describe, it, expect } from 'vitest';
import type { ChartConfig } from '../../src/sheet/chart/chart-model';
import type { PivotConfig } from '../../src/sheet/pivot/pivot-model';
import type { CellValue } from '../../src/engine/values';
import {
  areaDopoStruttura, datiDelGrafico, graficiDopoSpostamento, graficiDopoStruttura, graficoAggiornato,
  leggiIntervalloTesto, pivotDopoSpostamento, pivotDopoStruttura, scriviIntervalloTesto,
} from '../../src/sheet/grafici-e-pivot';
import type { OperazioneStruttura } from '../../src/sheet/sposta-struttura';
import type { Spostamento } from '../../src/sheet/sposta-con-celle';

const grafico = (dataRange: string, extra: Partial<ChartConfig> = {}): ChartConfig => ({
  id: 'g1', title: 't', type: 'column', sheetName: 'Foglio1', dataRange, x: 0, y: 0, width: 100, height: 100,
  showLegend: true, showLabels: false, categories: [], series: [], ...extra,
});
const pivot = (sourceRange: string, extra: Partial<PivotConfig> = {}): PivotConfig => ({
  id: 'p1', name: 'P', sourceSheet: 'Foglio1', sourceRange,
  rowFields: [{ sourceColIndex: 0, name: 'Reparto' }], colFields: [],
  valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'SUM' }], filters: [], showGrandTotals: true, showSubtotals: false, ...extra,
});
const num = (v: number): CellValue => ({ kind: 'number', value: v });
const txt = (v: string): CellValue => ({ kind: 'text', value: v });
const op = (tipo: OperazioneStruttura['tipo'], indice: number, conta = 1): OperazioneStruttura => ({ tipo, indice, conta });

describe('T507: grafici e pivot seguono i dati', () => {
  it('legge e scrive gli intervalli, con o senza $', () => {
    expect(leggiIntervalloTesto('A1:B5')).toEqual({ startRow: 1, endRow: 5, startCol: 1, endCol: 2 });
    expect(leggiIntervalloTesto('$b$2:$D$9')).toEqual({ startRow: 2, endRow: 9, startCol: 2, endCol: 4 });
    expect(leggiIntervalloTesto('B5:A1')).toEqual({ startRow: 1, endRow: 5, startCol: 1, endCol: 2 });
    expect(leggiIntervalloTesto('A1')).toBeNull();
    expect(leggiIntervalloTesto('boh')).toBeNull();
    expect(scriviIntervalloTesto({ startRow: 3, endRow: 7, startCol: 27, endCol: 28 })).toBe('AA3:AB7');
  });

  it('righe inserite sopra spostano, dentro allargano, sotto non cambiano nulla', () => {
    const a = leggiIntervalloTesto('B3:C6')!;
    expect(areaDopoStruttura(a, op('insert_rows', 1, 2))).toEqual({ startRow: 5, endRow: 8, startCol: 2, endCol: 3 });
    expect(areaDopoStruttura(a, op('insert_rows', 5, 3))).toEqual({ startRow: 3, endRow: 9, startCol: 2, endCol: 3 });
    expect(areaDopoStruttura(a, op('insert_rows', 7, 3))).toEqual(a);
    expect(areaDopoStruttura(a, op('insert_rows', 3, 1))).toEqual({ startRow: 4, endRow: 7, startCol: 2, endCol: 3 }); // sopra la prima riga: si sposta
  });

  it('righe eliminate: restringe, sposta, e sparisce se i dati sono tutti eliminati', () => {
    const a = leggiIntervalloTesto('B3:C6')!;
    expect(areaDopoStruttura(a, op('delete_rows', 4, 2))).toEqual({ startRow: 3, endRow: 4, startCol: 2, endCol: 3 });
    expect(areaDopoStruttura(a, op('delete_rows', 1, 2))).toEqual({ startRow: 1, endRow: 4, startCol: 2, endCol: 3 });
    expect(areaDopoStruttura(a, op('delete_rows', 3, 4))).toBeNull();
    expect(areaDopoStruttura(a, op('delete_rows', 8, 2))).toEqual(a);
  });

  it('colonne inserite e eliminate', () => {
    const a = leggiIntervalloTesto('B3:D6')!;
    expect(areaDopoStruttura(a, op('insert_cols', 1))).toEqual({ startRow: 3, endRow: 6, startCol: 3, endCol: 5 });
    expect(areaDopoStruttura(a, op('insert_cols', 3))).toEqual({ startRow: 3, endRow: 6, startCol: 2, endCol: 5 });
    expect(areaDopoStruttura(a, op('delete_cols', 3))).toEqual({ startRow: 3, endRow: 6, startCol: 2, endCol: 3 });
    expect(areaDopoStruttura(a, op('delete_cols', 2, 3))).toBeNull();
  });

  it('i grafici di un altro foglio non si toccano; quelli senza dati spariscono', () => {
    const g = [grafico('A1:B5'), grafico('A1:B5', { id: 'g2', sheetName: 'Altro' }), grafico('A2:B3', { id: 'g3' })];
    const r = graficiDopoStruttura(g, 'Foglio1', op('insert_rows', 1, 2));
    expect(r.map((x) => x.dataRange)).toEqual(['A3:B7', 'A1:B5', 'A4:B5']);
    const e = graficiDopoStruttura(g, 'Foglio1', op('delete_rows', 2, 2));
    expect(e.map((x) => x.id)).toEqual(['g1', 'g2']); // g3 (A2:B3) era tutto dentro la parte eliminata
    expect(e[0].dataRange).toBe('A1:B3');
  });

  it('pivot: l\'intervallo e gli indici dei campi seguono le colonne', () => {
    const p = [pivot('A1:D10', { colFields: [{ sourceColIndex: 1, name: 'Agente' }] })];
    const ins = pivotDopoStruttura(p, 'Foglio1', op('insert_cols', 1)); // una colonna a sinistra: tutto si sposta, gli indici relativi no
    expect(ins[0].sourceRange).toBe('B1:E10');
    expect(ins[0].valueFields[0].sourceColIndex).toBe(2);
    const dentro = pivotDopoStruttura(p, 'Foglio1', op('insert_cols', 2)); // una colonna dentro: i campi dopo di lei scalano di uno
    expect(dentro[0].sourceRange).toBe('A1:E10');
    expect(dentro[0].colFields[0].sourceColIndex).toBe(2);
    expect(dentro[0].valueFields[0].sourceColIndex).toBe(3);
    expect(dentro[0].rowFields[0].sourceColIndex).toBe(0);
  });

  it('pivot: eliminare la colonna di un campo lo toglie; senza campi valore la pivot sparisce', () => {
    const p = [pivot('A1:D10', { colFields: [{ sourceColIndex: 1, name: 'Agente' }] })];
    const r = pivotDopoStruttura(p, 'Foglio1', op('delete_cols', 2)); // colonna B = Agente
    expect(r[0].colFields).toEqual([]);
    expect(r[0].sourceRange).toBe('A1:C10');
    expect(r[0].valueFields[0].sourceColIndex).toBe(1);
    expect(pivotDopoStruttura(p, 'Foglio1', op('delete_cols', 3)).length).toBe(0); // colonna C = Vendite, l'unico valore
    expect(pivotDopoStruttura(p, 'Foglio1', op('delete_rows', 1, 10)).length).toBe(0);
  });

  it('pivot: eliminare righe fuori o dentro non cambia i campi', () => {
    const r = pivotDopoStruttura([pivot('A1:D10')], 'Foglio1', op('delete_rows', 4, 3));
    expect(r[0].sourceRange).toBe('A1:D7');
    expect(r[0].valueFields[0].sourceColIndex).toBe(2);
  });

  const taglio = (area: { startRow: number; endRow: number; startCol: number; endCol: number }, dr: number, dc: number, origine = 'Foglio1', dest = 'Foglio1'): Spostamento =>
    ({ area, foglioOrigine: origine, foglioDestinazione: dest, deltaRighe: dr, deltaColonne: dc });

  it('taglia e incolla: segue solo chi ha tutti i dati nell\'area tagliata', () => {
    const area = { startRow: 1, endRow: 10, startCol: 1, endCol: 4 };
    const g = graficiDopoSpostamento([grafico('A1:B5'), grafico('A1:B20', { id: 'g2' })], taglio(area, 0, 6));
    expect(g[0].dataRange).toBe('G1:H5');
    expect(g[1].dataRange).toBe('A1:B20'); // sporge dall'area: resta com'è
  });

  it('taglia e incolla su un altro foglio porta con sé il grafico e la pivot', () => {
    const area = { startRow: 1, endRow: 10, startCol: 1, endCol: 4 };
    const s = taglio(area, 2, 0, 'Foglio1', 'Foglio2');
    const g = graficiDopoSpostamento([grafico('A1:B5')], s);
    expect(g[0].sheetName).toBe('Foglio2');
    expect(g[0].dataRange).toBe('A3:B7');
    const p = pivotDopoSpostamento([pivot('A1:D10')], s);
    expect(p[0].sourceSheet).toBe('Foglio2');
    expect(p[0].sourceRange).toBe('A3:D12');
    // ciò che sta su un altro foglio non si sposta
    expect(graficiDopoSpostamento([grafico('A1:B5', { sheetName: 'Altro' })], s)[0].dataRange).toBe('A1:B5');
  });

  it('i dati del grafico si rileggono: categorie, serie, e i nomi scelti dall\'utente restano', () => {
    const g = grafico('A1:C3', { categories: ['x'], series: [{ name: 'Ricavi', data: [0], color: '#ff0000' }, { name: 'Serie C', data: [0] }] });
    const valori: CellValue[][] = [[txt('Gen'), num(10), num(1)], [txt('Feb'), num(20), num(2)], [num(3), { kind: 'empty' }, txt('x')]];
    const d = datiDelGrafico(g, valori);
    expect(d.categories).toEqual(['Gen', 'Feb', '3']);
    expect(d.series[0]).toMatchObject({ name: 'Ricavi', color: '#ff0000', data: [10, 20, 0] });
    expect(d.series[1]).toMatchObject({ name: 'Serie C', data: [1, 2, 0] });
  });

  it('dopo l\'inserimento di una colonna il nome automatico segue la lettera nuova', () => {
    const g = grafico('B1:C2', { series: [{ name: 'Serie C', data: [1, 2] }] });
    const d = datiDelGrafico(g, [[txt('a'), num(1)], [txt('b'), num(2)]]);
    expect(d.series[0].name).toBe('Serie C'); // la prima serie sta ora nella colonna C: nome corretto
    const spostato = grafico('C1:D2', { series: [{ name: 'Serie C', data: [1, 2] }] });
    expect(datiDelGrafico(spostato, [[txt('a'), num(1)], [txt('b'), num(2)]]).series[0].name).toBe('Serie D');
  });

  it('graficoAggiornato dà lo stesso oggetto se i dati non sono cambiati', () => {
    const g = grafico('A1:B2');
    const valori: CellValue[][] = [[txt('a'), num(1)], [txt('b'), num(2)]];
    const uno = graficoAggiornato(g, valori);
    expect(uno).not.toBe(g);
    expect(uno.series[0].data).toEqual([1, 2]);
    expect(graficoAggiornato(uno, valori)).toBe(uno);
    expect(graficoAggiornato(uno, [[txt('a'), num(1)], [txt('b'), num(5)]]).series[0].data).toEqual([1, 5]);
  });

  it('un intervallo di una sola colonna dà una serie con i valori', () => {
    const g = grafico('A1:A3');
    const d = datiDelGrafico(g, [[num(4)], [num(5)], [num(6)]]);
    expect(d.series.length).toBe(1);
    expect(d.series[0].data).toEqual([4, 5, 6]);
  });
});
