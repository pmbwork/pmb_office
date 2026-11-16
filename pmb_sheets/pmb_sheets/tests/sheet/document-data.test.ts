import { describe, it, expect } from 'vitest';
import {
  extractDocumentData,
  serializeSheetDocumentData,
  deserializeSheetDocumentData,
  restoreSheetStylesFromData,
  SheetDocumentData,
} from '../../src/sheet/document-data';
import { DocumentStore } from '../../src/sheet/document-store';
import { applyFormatToRange, applyFormatToColumn, applyFormatToRow, resolveCellStyle } from '../../src/sheet/styles';

describe('document-data serialization & round-trip', () => {
  it('serializza e deserializza uno stato completo con identico round-trip', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('test-tab-1', 'Foglio di Prova');

    // Scrivi dati nel motore
    await doc.client.setCell('Foglio1', 1, 1, '1234.5');
    await doc.client.setCell('Foglio1', 1, 2, '=A1*2');
    doc.colWidths.set(1, 120);
    doc.colWidths.set(2, 160);

    // Applica formati
    applyFormatToRange(doc.styles, { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, {
      bold: true,
      color: '#ff0000',
      numFmt: '€#,##0.00',
    });
    applyFormatToColumn(doc.styles, 2, { italic: true });
    applyFormatToRow(doc.styles, 1, { fontSize: 14 });

    // Estrai dati e serializza
    const docData = await extractDocumentData(doc, doc.styles);
    const jsonStr = serializeSheetDocumentData(docData);

    // Deserializza
    const parsedData = deserializeSheetDocumentData(jsonStr);
    expect(parsedData.version).toBe(1);
    expect(parsedData.activeSheetName).toBe('Foglio1');
    expect(parsedData.colWidths['1']).toBe(120);
    expect(parsedData.colWidths['2']).toBe(160);

    // Ripristina stili e verifica identita
    const restoredStyles = restoreSheetStylesFromData(parsedData);
    const cellA1 = resolveCellStyle(1, 1, restoredStyles);
    expect(cellA1.bold).toBe(true);
    expect(cellA1.color).toBe('#ff0000');
    expect(cellA1.numFmt).toBe('€#,##0.00');
    expect(cellA1.fontSize).toBe(14); // ereditato dalla riga

    const cellB1 = resolveCellStyle(1, 2, restoredStyles);
    expect(cellB1.italic).toBe(true); // ereditato dalla colonna
    expect(cellB1.fontSize).toBe(14); // ereditato dalla riga

    // Secondo round-trip JSON identico carattere per carattere
    const reSerialized = serializeSheetDocumentData(parsedData);
    expect(reSerialized).toBe(jsonStr);
  });

  it('lancia errore su JSON non valido o versione non supportata', () => {
    expect(() => deserializeSheetDocumentData('')).toThrow('JSON vuoto o non valido');
    expect(() => deserializeSheetDocumentData('{}')).toThrow('Versione non supportata');
    expect(() => deserializeSheetDocumentData(JSON.stringify({ version: 2 }))).toThrow('Versione non supportata: 2');
    expect(() =>
      deserializeSheetDocumentData(JSON.stringify({ version: 1, workbookJson: 123 }))
    ).toThrow('workbookJson mancante o non valido');
  });

  it('un cambio di formato non altera mai i valori grezzi o calcolati del motore', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('test-math-tab', 'Calcoli');
    await doc.client.setCell('Foglio1', 1, 1, '100');
    await doc.client.setCell('Foglio1', 2, 1, '=A1*2');

    const beforeA1 = await doc.client.getCell('Foglio1', 1, 1);
    const beforeA2 = await doc.client.getCell('Foglio1', 2, 1);
    expect(beforeA1.raw).toBe('100');
    expect(beforeA1.value).toEqual({ kind: 'number', value: 100 });
    expect(beforeA2.raw).toBe('=A1*2');
    expect(beforeA2.value).toEqual({ kind: 'number', value: 200 });

    // Applica stili e formati numerici (es. percentuale o valuta)
    applyFormatToRange(doc.styles, { startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, {
      numFmt: '€#,##0.00',
      bold: true,
      fill: '#ffff00',
    });

    // I valori grezzi e calcolati del motore devono essere identici
    const afterA1 = await doc.client.getCell('Foglio1', 1, 1);
    const afterA2 = await doc.client.getCell('Foglio1', 2, 1);
    expect(afterA1.raw).toBe('100');
    expect(afterA1.value).toEqual({ kind: 'number', value: 100 });
    expect(afterA2.raw).toBe('=A1*2');
    expect(afterA2.value).toEqual({ kind: 'number', value: 200 });
  });
});
