import { describe, it, expect } from 'vitest';
import {
  StyleRegistry,
  canonicalStyleKey,
  createSheetStyles,
  resolveCellStyle,
  applyFormatToRange,
  applyFormatToColumn,
  applyFormatToRow,
  clearFormatFromRange,
} from '../../src/sheet/styles';

describe('StyleRegistry & SheetStyles pure module', () => {
  it('stile 0 e predefinito e vuoto', () => {
    const reg = new StyleRegistry();
    expect(reg.count).toBe(1);
    expect(reg.getStyle(0)).toEqual({});
    expect(reg.getStyle(-1)).toEqual({});
    expect(reg.getStyle(999)).toEqual({});
  });

  it('deduplica gli stili registrati con chiavi canoniche stabili', () => {
    const reg = new StyleRegistry();
    const id1 = reg.register({ bold: true, fontSize: 12 });
    const id2 = reg.register({ fontSize: 12, bold: true }); // stesso stile, ordine diverso
    expect(id1).toBe(1);
    expect(id2).toBe(1);
    expect(reg.count).toBe(2);

    const id3 = reg.register({ bold: true, fontSize: 14 });
    expect(id3).toBe(2);
    expect(reg.count).toBe(3);
  });

  it('merge fonde stili esistenti e registra il nuovo id', () => {
    const reg = new StyleRegistry();
    const idBold = reg.register({ bold: true });
    const idBoldItalic = reg.merge(idBold, { italic: true });
    expect(reg.getStyle(idBoldItalic)).toEqual({ bold: true, italic: true });

    // Rimuovere una proprieta con undefined
    const idItalicOnly = reg.merge(idBoldItalic, { bold: undefined });
    expect(reg.getStyle(idItalicOnly)).toEqual({ italic: true });
  });

  it('canonicalStyleKey produce lo stesso risultato a prescindere dall ordine delle chiavi', () => {
    const k1 = canonicalStyleKey({ color: '#ff0000', bold: true, fontSize: 10 });
    const k2 = canonicalStyleKey({ fontSize: 10, color: '#ff0000', bold: true });
    expect(k1).toBe(k2);
  });

  it('risoluzione a strati: cella > colonna > riga > default', () => {
    const ss = createSheetStyles();
    // Default
    expect(resolveCellStyle(5, 5, ss)).toEqual({});

    // Riga 5 ha italic: true
    applyFormatToRow(ss, 5, { italic: true, fontSize: 11 });
    expect(resolveCellStyle(5, 5, ss)).toEqual({ italic: true, fontSize: 11 });

    // Colonna 5 ha color: '#00ff00' e fontSize: 14 (sovrascrive la riga)
    applyFormatToColumn(ss, 5, { color: '#00ff00', fontSize: 14 });
    const resolvedColRow = resolveCellStyle(5, 5, ss);
    expect(resolvedColRow.italic).toBe(true); // dalla riga
    expect(resolvedColRow.color).toBe('#00ff00'); // dalla colonna
    expect(resolvedColRow.fontSize).toBe(14); // colonna vince su riga

    // Cella (5, 5) specifica bold: true e fontSize: 18 (sovrascrive sia riga che colonna)
    applyFormatToRange(ss, { startRow: 5, endRow: 5, startCol: 5, endCol: 5 }, { bold: true, fontSize: 18 });
    const resolvedFinal = resolveCellStyle(5, 5, ss);
    expect(resolvedFinal.bold).toBe(true); // dalla cella
    expect(resolvedFinal.fontSize).toBe(18); // cella vince su colonna e riga
    expect(resolvedFinal.color).toBe('#00ff00'); // ereditato da colonna
    expect(resolvedFinal.italic).toBe(true); // ereditato da riga
  });

  it('applicazione formato a colonna intera e in tempo costante O(1) e non alloca celle vuote', () => {
    const ss = createSheetStyles();
    expect(ss.cellStyles.size).toBe(0);

    // Applica formato alla colonna 3
    applyFormatToColumn(ss, 3, { bold: true });
    expect(ss.colStyles.get(3)).toBeDefined();
    expect(ss.cellStyles.size).toBe(0); // Nessuna cella allocata!

    // Una cella a riga 1.000.000 eredita il formato della colonna
    const styleMillion = resolveCellStyle(1_000_000, 3, ss);
    expect(styleMillion.bold).toBe(true);
  });

  it('applicazione formato a riga intera non alloca celle vuote e aggiorna solo celle esistenti', () => {
    const ss = createSheetStyles();
    // Cella sparsa gia esistente (10, 2)
    applyFormatToRange(ss, { startRow: 10, endRow: 10, startCol: 2, endCol: 2 }, { color: '#ff0000' });
    expect(ss.cellStyles.size).toBe(1);

    // Applica riga intera 10
    applyFormatToRow(ss, 10, { italic: true });
    expect(ss.cellStyles.size).toBe(1); // sempre 1 sola cella sparsa
    const styleExisting = resolveCellStyle(10, 2, ss);
    expect(styleExisting.color).toBe('#ff0000');
    expect(styleExisting.italic).toBe(true);

    // Cella vuota della stessa riga (10, 500) eredita senza essere in cellStyles
    expect(ss.cellStyles.has('10,500')).toBe(false);
    expect(resolveCellStyle(10, 500, ss).italic).toBe(true);
  });

  it('clearFormatFromRange rimuove gli stili espliciti delle celle', () => {
    const ss = createSheetStyles();
    applyFormatToRange(ss, { startRow: 1, endRow: 2, startCol: 1, endCol: 2 }, { bold: true });
    expect(ss.cellStyles.size).toBe(4);

    clearFormatFromRange(ss, { startRow: 1, endRow: 1, startCol: 1, endCol: 1 });
    expect(ss.cellStyles.size).toBe(3);
    expect(resolveCellStyle(1, 1, ss)).toEqual({});
    expect(resolveCellStyle(1, 2, ss).bold).toBe(true);
  });

  it('bordi a livello di cella e precedenza di composizione', () => {
    const ss = createSheetStyles();
    applyFormatToRange(
      ss,
      { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
      {
        borders: {
          top: { style: 'thin', color: '#000000' },
          bottom: { style: 'medium', color: '#ff0000' },
        },
      }
    );
    const s = resolveCellStyle(1, 1, ss);
    expect(s.borders?.top?.style).toBe('thin');
    expect(s.borders?.bottom?.style).toBe('medium');
    expect(s.borders?.left).toBeUndefined();
  });

  it('stili vuoti multipli {} deduplicano sempre su id 0', () => {
    const reg = new StyleRegistry();
    expect(reg.register({})).toBe(0);
    expect(reg.register({ fontFamily: '', numFmt: '' })).toBe(0);
    expect(reg.count).toBe(1);
  });

  it('merge con stile ID non esistente fa fallback su stile base predefinito 0', () => {
    const reg = new StyleRegistry();
    const id = reg.merge(9999, { bold: true });
    expect(reg.getStyle(id)).toEqual({ bold: true });
  });

  it('cloneSheetStyles crea una copia profonda indipendente di registro e mappe', () => {
    const ss1 = createSheetStyles();
    applyFormatToRange(ss1, { startRow: 1, endRow: 1, startCol: 1, endCol: 1 }, { bold: true });

    const ss2 = ss1.registry.clone();
    expect(ss2.count).toBe(ss1.registry.count);

    // Modifica su ss1 non tocca ss2
    applyFormatToRange(ss1, { startRow: 2, endRow: 2, startCol: 2, endCol: 2 }, { italic: true });
    expect(ss2.count).toBe(2);
    expect(ss1.registry.count).toBe(3);
  });

  it('bordi con stile "none" vengono rimossi e non allocati come bordi attivi', () => {
    const reg = new StyleRegistry();
    const id = reg.register({
      borders: {
        top: { style: 'none', color: '#000000' },
        bottom: { style: 'thin', color: '#ff0000' },
      },
    });
    const s = reg.getStyle(id);
    expect(s.borders?.top).toBeUndefined();
    expect(s.borders?.bottom?.style).toBe('thin');
  });

  it('fontSize non finito (NaN, Infinity) viene ignorato nella chiave canonica', () => {
    const k1 = canonicalStyleKey({ fontSize: NaN, bold: true });
    const k2 = canonicalStyleKey({ bold: true });
    expect(k1).toBe(k2);
  });

  it('range con coordinate inverse (start > end) viene normalizzato correttamente', () => {
    const ss = createSheetStyles();
    // Intervallo inverso: riga 3 a 1, col 3 a 1
    applyFormatToRange(ss, { startRow: 3, endRow: 1, startCol: 3, endCol: 1 }, { bold: true });
    expect(ss.cellStyles.size).toBe(9);
    expect(resolveCellStyle(2, 2, ss).bold).toBe(true);
  });
});

