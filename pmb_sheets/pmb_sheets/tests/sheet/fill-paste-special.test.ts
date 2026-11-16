import { describe, it, expect } from 'vitest';
import { computeFillValue, computeFillDown, computeFillRight } from '../../src/sheet/fill';
import { computePasteSpecial, ClipboardCellPayload } from '../../src/sheet/paste-special';
import { numberVal, textVal } from '../../src/engine/values';

describe('Fogli M1: Riempimento Serie e Incolla Speciale', () => {
  describe('computeFillValue', () => {
    it('un numero singolo si copia, non si incrementa (come negli altri fogli di calcolo)', () => {
      const src = [{ row: 1, col: 1, raw: '10' }];
      expect(computeFillValue(src, 2, 1, 'down')).toBe('10');
      expect(computeFillValue(src, 3, 1, 'down')).toBe('10');
    });

    it('ricava il passo da 2 numeri sorgente (es. 10, 20 -> passo 10)', () => {
      const src = [
        { row: 1, col: 1, raw: '10' },
        { row: 2, col: 1, raw: '20' },
      ];
      expect(computeFillValue(src, 3, 1, 'down')).toBe('30');
      expect(computeFillValue(src, 4, 1, 'down')).toBe('40');
    });

    it('serie testuale con numero finale (es. Item 01 -> Item 02)', () => {
      const src = [{ row: 1, col: 1, raw: 'Item 01' }];
      expect(computeFillValue(src, 2, 1, 'down')).toBe('Item 02');
      expect(computeFillValue(src, 10, 1, 'down')).toBe('Item 10');
    });

    it('formula shiftata lungo il trascinamento', () => {
      const src = [{ row: 1, col: 1, raw: '=A1*2' }];
      expect(computeFillValue(src, 2, 1, 'down')).toBe('=A2*2');
      expect(computeFillValue(src, 1, 2, 'right')).toBe('=B1*2');
    });
  });

  describe('computeFillDown (Ctrl+D)', () => {
    it('riempie le righe selezionate traslando le formule', () => {
      const ops = computeFillDown(1, 1, 3, 2, (r, c) => (c === 1 ? '=A1*2' : 'Testo'));
      expect(ops.length).toBe(4); // 2 righe x 2 colonne
      expect(ops.find((o) => o.row === 2 && o.col === 1)?.raw).toBe('=A2*2');
      expect(ops.find((o) => o.row === 3 && o.col === 1)?.raw).toBe('=A3*2');
      expect(ops.find((o) => o.row === 2 && o.col === 2)?.raw).toBe('Testo');
    });
  });

  describe('computeFillRight (Ctrl+R)', () => {
    it('riempie le colonne a destra traslando le formule', () => {
      const ops = computeFillRight(1, 1, 2, 3, (r, c) => (r === 1 ? '=A1+1' : 'Costante'));
      expect(ops.length).toBe(4);
      expect(ops.find((o) => o.row === 1 && o.col === 2)?.raw).toBe('=B1+1');
      expect(ops.find((o) => o.row === 1 && o.col === 3)?.raw).toBe('=C1+1');
      expect(ops.find((o) => o.row === 2 && o.col === 2)?.raw).toBe('Costante');
    });
  });

  describe('computePasteSpecial', () => {
    const samplePayloads: ClipboardCellPayload[] = [
      {
        rowOffset: 0,
        colOffset: 0,
        raw: '=A1*10',
        value: numberVal(50),
        style: { bold: true, color: '#ef4444' },
      },
      {
        rowOffset: 0,
        colOffset: 1,
        raw: 'Testo',
        value: textVal('Testo'),
        style: { italic: true },
      },
    ];

    it('solo valori: incolla solo il valore calcolato senza formule né stili', () => {
      const ops = computePasteSpecial(samplePayloads, 5, 5, 'values_only');
      expect(ops.length).toBe(2);
      expect(ops[0]).toEqual({ targetRow: 5, targetCol: 5, raw: '50' });
      expect(ops[1]).toEqual({ targetRow: 5, targetCol: 6, raw: 'Testo' });
      expect(ops[0].style).toBeUndefined();
    });

    it('solo formato: incolla solo gli stili senza toccare i dati/formule', () => {
      const ops = computePasteSpecial(samplePayloads, 5, 5, 'format_only');
      expect(ops.length).toBe(2);
      expect(ops[0].raw).toBeUndefined();
      expect(ops[0].style).toEqual({ bold: true, color: '#ef4444' });
      expect(ops[1].style).toEqual({ italic: true });
    });

    it('formule senza formato: incolla le formule senza stili', () => {
      const ops = computePasteSpecial(samplePayloads, 5, 5, 'formulas_only');
      expect(ops.length).toBe(2);
      expect(ops[0].raw).toBe('=A1*10');
      expect(ops[0].style).toBeUndefined();
    });

    it('trasposto: inverte righe e colonne mantenendo dati e stili', () => {
      const ops = computePasteSpecial(samplePayloads, 5, 5, 'transposed');
      expect(ops.length).toBe(2);
      // Prima cella (0,0) -> va a (5, 5)
      expect(ops[0].targetRow).toBe(5);
      expect(ops[0].targetCol).toBe(5);
      expect(ops[0].style?.bold).toBe(true);
      // Seconda cella (0,1) -> trasposta va a riga 5 + 1 = 6, colonna 5!
      expect(ops[1].targetRow).toBe(6);
      expect(ops[1].targetCol).toBe(5);
      expect(ops[1].raw).toBe('Testo');
      expect(ops[1].style?.italic).toBe(true);
    });
  });
});
