// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createWorkbook, CellChange } from '../../src/engine/workbook';

describe('Graph and Recalculation module', () => {
  it('updates only downstream cells and notifies onChange', () => {
    const wb = createWorkbook();

    // Configura dipendenza: A1 -> B1 (=A1*2) -> C1 (=B1+10)
    // Cella indipendente: D1 (=100)
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'B1', '=A1 * 2');
    wb.setCell('Foglio1', 'C1', '=B1 + 10');
    wb.setCell('Foglio1', 'D1', '100');

    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 20 });
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 30 });

    const notifications: CellChange[][] = [];
    const unsubscribe = wb.onChange((changed) => {
      notifications.push([...changed]);
    });

    // Modifica A1 da 10 a 20
    wb.setCell('Foglio1', 'A1', '20');

    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 40 });
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 50 });
    expect(wb.getCell('Foglio1', 'D1').value).toEqual({ kind: 'number', value: 100 });

    // D1 non deve comparire tra le celle modificate
    const allChanged = notifications.flat();
    expect(allChanged).toContainEqual({ sheet: 'Foglio1', address: 'A1' });
    expect(allChanged).toContainEqual({ sheet: 'Foglio1', address: 'B1' });
    expect(allChanged).toContainEqual({ sheet: 'Foglio1', address: 'C1' });
    expect(allChanged).not.toContainEqual({ sheet: 'Foglio1', address: 'D1' });

    unsubscribe();
  });

  it('handles diamond dependency graph (A1 -> B1, C1 -> D1=B1+C1)', () => {
    const wb = createWorkbook();

    wb.setCell('Foglio1', 'A1', '5');
    wb.setCell('Foglio1', 'B1', '=A1 * 2'); // 10
    wb.setCell('Foglio1', 'C1', '=A1 + 10'); // 15
    wb.setCell('Foglio1', 'D1', '=B1 + C1'); // 10 + 15 = 25

    expect(wb.getCell('Foglio1', 'D1').value).toEqual({ kind: 'number', value: 25 });

    let changeCount = 0;
    wb.onChange(() => {
      changeCount++;
    });

    // Modifica la radice del diamante A1 -> 10
    wb.setCell('Foglio1', 'A1', '10');

    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 20 });
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 20 });
    expect(wb.getCell('Foglio1', 'D1').value).toEqual({ kind: 'number', value: 40 });
    expect(changeCount).toBe(1); // Notificato in un unico ricalcolo consistente
  });

  it('stops propagation when cell value evaluates to identical previous value', () => {
    const wb = createWorkbook();

    wb.setCell('Foglio1', 'A1', '-5');
    wb.setCell('Foglio1', 'B1', '=ABS(A1)'); // 5
    wb.setCell('Foglio1', 'C1', '=B1 * 10'); // 50

    const changedList: CellChange[] = [];
    wb.onChange((changes) => {
      changedList.push(...changes);
    });

    // Modifica A1 da -5 a 5: B1 valeva 5 e vale ancora 5!
    wb.setCell('Foglio1', 'A1', '5');

    // A1 è cambiata, ma B1 e C1 non sono mutate di valore!
    expect(wb.getCell('Foglio1', 'B1').value).toEqual({ kind: 'number', value: 5 });
    expect(wb.getCell('Foglio1', 'C1').value).toEqual({ kind: 'number', value: 50 });
    expect(changedList).toContainEqual({ sheet: 'Foglio1', address: 'A1' }); // A1 cambiata
    expect(changedList).not.toContainEqual({ sheet: 'Foglio1', address: 'C1' }); // C1 non notificata perché il valore è identico
  });

  it('negative test: independent cell modification does not affect dependency tree', () => {
    const wb = createWorkbook();
    wb.setCell('Foglio1', 'A1', '10');
    wb.setCell('Foglio1', 'B1', '=A1 + 1');

    const changedKeys: CellChange[] = [];
    wb.onChange((changes) => {
      changedKeys.push(...changes);
    });

    wb.setCell('Foglio1', 'Z100', '999');
    expect(changedKeys).toEqual([{ sheet: 'Foglio1', address: 'Z100' }]);
    expect(changedKeys).not.toContainEqual({ sheet: 'Foglio1', address: 'B1' });
  });
});
