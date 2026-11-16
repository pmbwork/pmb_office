/**
 * Test unitari per il motore di tabelle pivot (M3).
 */

import { describe, it, expect } from 'vitest';
import { computePivotTable } from '../../src/sheet/pivot/pivot-engine';
import { PivotConfig } from '../../src/sheet/pivot/pivot-model';
import { CellValue } from '../../src/engine';

describe('Pivot Table Engine (M3)', () => {
  // Matrice dati sorgente:
  // Reparto | Anno | Vendite
  // Nord    | 2022 | 100
  // Sud     | 2022 | 200
  // Nord    | 2023 | 150
  // Sud     | 2023 | 250
  // Nord    | 2023 | 50
  const sourceMatrix: CellValue[][] = [
    [{ kind: 'text', value: 'Reparto' }, { kind: 'text', value: 'Anno' }, { kind: 'text', value: 'Vendite' }],
    [{ kind: 'text', value: 'Nord' }, { kind: 'text', value: '2022' }, { kind: 'number', value: 100 }],
    [{ kind: 'text', value: 'Sud' }, { kind: 'text', value: '2022' }, { kind: 'number', value: 200 }],
    [{ kind: 'text', value: 'Nord' }, { kind: 'text', value: '2023' }, { kind: 'number', value: 150 }],
    [{ kind: 'text', value: 'Sud' }, { kind: 'text', value: '2023' }, { kind: 'number', value: 250 }],
    [{ kind: 'text', value: 'Nord' }, { kind: 'text', value: '2023' }, { kind: 'number', value: 50 }],
  ];

  it('calcola aggregazione SUM per righe (Reparto) e colonne (Anno)', () => {
    const config: PivotConfig = {
      id: 'pivot-1',
      name: 'Pivot Vendite',
      sourceSheet: 'Dati',
      sourceRange: 'A1:C6',
      rowFields: [{ sourceColIndex: 0, name: 'Reparto' }],
      colFields: [{ sourceColIndex: 1, name: 'Anno' }],
      valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'SUM' }],
      filters: [],
      showGrandTotals: true,
      showSubtotals: false,
    };

    const res = computePivotTable(config, sourceMatrix);

    expect(res.colKeys).toEqual(['2022', '2023']);
    expect(res.rows.length).toBe(2);

    // Riga Nord: 2022=100, 2023=200, rowTotal=300
    const nordRow = res.rows.find((r) => r.rowKeys[0] === 'Nord');
    expect(nordRow).toBeDefined();
    expect(nordRow!.cells.find((c) => c.colKey === '2022')?.value).toBe(100);
    expect(nordRow!.cells.find((c) => c.colKey === '2023')?.value).toBe(200);
    expect(nordRow!.rowTotal).toBe(300);

    // Riga Sud: 2022=200, 2023=250, rowTotal=450
    const sudRow = res.rows.find((r) => r.rowKeys[0] === 'Sud');
    expect(sudRow).toBeDefined();
    expect(sudRow!.cells.find((c) => c.colKey === '2022')?.value).toBe(200);
    expect(sudRow!.cells.find((c) => c.colKey === '2023')?.value).toBe(250);
    expect(sudRow!.rowTotal).toBe(450);

    // Totale complessivo
    expect(res.grandTotalRow).toBeDefined();
    expect(res.grandTotalRow!.cells.find((c) => c.colKey === '2022')?.value).toBe(300);
    expect(res.grandTotalRow!.cells.find((c) => c.colKey === '2023')?.value).toBe(450);
    expect(res.grandTotalRow!.rowTotal).toBe(750);
  });

  it('calcola aggregazioni COUNT e AVERAGE', () => {
    const configCount: PivotConfig = {
      id: 'pivot-2',
      name: 'Pivot Conteggio',
      sourceSheet: 'Dati',
      sourceRange: 'A1:C6',
      rowFields: [{ sourceColIndex: 0, name: 'Reparto' }],
      colFields: [],
      valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'COUNT' }],
      filters: [],
      showGrandTotals: true,
      showSubtotals: false,
    };

    const resCount = computePivotTable(configCount, sourceMatrix);
    const nordCount = resCount.rows.find((r) => r.rowKeys[0] === 'Nord');
    expect(nordCount?.cells[0].value).toBe(3); // 3 vendite al Nord

    const configAvg: PivotConfig = {
      ...configCount,
      valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'AVERAGE' }],
    };
    const resAvg = computePivotTable(configAvg, sourceMatrix);
    const nordAvg = resAvg.rows.find((r) => r.rowKeys[0] === 'Nord');
    expect(nordAvg?.cells[0].value).toBe(100); // media (100+150+50)/3 = 100
  });

  it('applica i filtri escludendo le righe non consentite', () => {
    const config: PivotConfig = {
      id: 'pivot-3',
      name: 'Pivot Filtrato',
      sourceSheet: 'Dati',
      sourceRange: 'A1:C6',
      rowFields: [{ sourceColIndex: 0, name: 'Reparto' }],
      colFields: [],
      valueFields: [{ sourceColIndex: 2, name: 'Vendite', aggregation: 'SUM' }],
      filters: [
        { sourceColIndex: 0, name: 'Reparto', allowedValues: ['Sud'] }, // Solo Sud
      ],
      showGrandTotals: true,
      showSubtotals: false,
    };

    const res = computePivotTable(config, sourceMatrix);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].rowKeys[0]).toBe('Sud');
    expect(res.rows[0].cells[0].value).toBe(450);
  });
});
