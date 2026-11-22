import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore, createCellSelection } from '../../src/sheet/index';
import { avvisiEsportazione, esporta, scambioConValoriCalcolati } from '../../src/formati/file';
import { estraiDati } from '../../src/formati/documento';

describe('T465: avvisi di esportazione, PDF con i risultati, conferma prima di eliminare un foglio', () => {
  let grid: FreeSheetGrid;
  let tabId = 'test-T465';

  let n = 0;
  beforeEach(async () => {
    tabId = `test-T465-${++n}`;
    const doc = defaultDocumentStore.getOrCreateDocument(tabId);
    doc.selection = createCellSelection(1, 1);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
  });
  afterEach(() => vi.restoreAllMocks());

  it('un foglio semplice non produce avvisi su cose perse', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '5');
    const avvisi = avvisiEsportazione(await estraiDati(doc), 'xlsx');
    expect(avvisi.join(' ')).not.toContain('Si conservano solo nel formato pmb_sheets');
  });

  it('avvisa di tutto ciò che solo il file nativo conserva, elencandolo', async () => {
    const doc = grid['getDoc']();
    await doc.client.setCell(doc.activeSheetName, 1, 1, '5');
    const dati = {
      ...(await estraiDati(doc)),
      hiddenRows: [2],
      hiddenCols: [3],
      dataValidations: { A1: { type: 'list', values: ['a'] } as never },
      conditionalFormats: [{ id: 'r' } as never],
      charts: [{ id: 'g' } as never],
      pivots: [{ id: 'p' } as never],
      filters: { active: true, columns: [{ col: 1 }] },
    };
    for (const f of ['csv', 'pdf'] as const) {
      const t = avvisiEsportazione(dati, f).join(' ');
      for (const parola of ['convalide', 'formattazioni condizionali', 'righe e colonne nascoste', 'filtri', 'grafici', 'tabelle pivot']) expect(t, `${f}: ${parola}`).toContain(parola);
    }
    // OpenDocument conserva convalide, righe/colonne nascoste e (dal T548) formattazioni condizionali: avvisa di filtri, grafici e pivot
    const odf = avvisiEsportazione(dati, 'ods').join(' ');
    for (const parola of ['filtri', 'grafici', 'tabelle pivot']) expect(odf, `ods: ${parola}`).toContain(parola);
    for (const parola of ['convalide', 'righe e colonne nascoste', 'formattazioni condizionali']) expect(odf, `ods: ${parola}`).not.toContain(parola);
    // Excel conserva convalide, formattazioni condizionali e righe/colonne nascoste: avvisa solo di ciò che non conserva
    const excel = avvisiEsportazione(dati, 'xlsx').join(' ');
    for (const parola of ['grafici', 'tabelle pivot']) expect(excel, `xlsx: ${parola}`).toContain(parola);
    // dalla Fase 49 un filtro con i valori spuntati si conserva in Excel; si avvisa solo dei criteri per condizione, colore e data
    for (const parola of ['convalide', 'formattazioni condizionali', 'righe e colonne nascoste', 'filtri']) expect(excel, `xlsx: ${parola}`).not.toContain(parola);
    const conColore = avvisiEsportazione({ ...dati, filters: { active: true, columns: [{ col: 1, fillColors: ['#ff0000'] }] } }, 'xlsx').join(' ');
    expect(conColore).toContain('i filtri per condizione, per colore e per data');
    expect(avvisiEsportazione(dati, 'fsheet')).toEqual([]);
  });

  it('il PDF non dice "CSV" e ricorda che contiene un solo foglio', async () => {
    const doc = grid['getDoc']();
    await doc.client.addSheet('Altro');
    await doc.client.setCell(doc.activeSheetName, 1, 1, '=1+1');
    const t = avvisiEsportazione(await estraiDati(doc), 'pdf').join(' ');
    expect(t).not.toContain('CSV');
    expect(t).toContain('contiene solo il foglio');
  });

  it('per il PDF le formule diventano i loro risultati', async () => {
    const doc = grid['getDoc']();
    const f = doc.activeSheetName;
    await doc.client.setCell(f, 1, 1, '21');
    await doc.client.setCell(f, 1, 2, '=A1*2');
    await doc.client.setCell(f, 1, 3, '=1/0');
    const s = scambioConValoriCalcolati(await estraiDati(doc));
    const celle = s.fogli.find((x) => x.nome === f)!.celle;
    expect(celle.A1).toBe('21');
    expect(celle.B1).toBe('42');
    expect(celle.C1).toBe('#DIV/0!');
    const pdf = new TextDecoder('latin1').decode(await esporta(await estraiDati(doc), 'pdf'));
    expect(pdf).toContain('(42)');
    expect(pdf).not.toContain('=A1*2');
  });

  it('eliminare un foglio con dati chiede conferma: se si rifiuta il foglio resta', async () => {
    const doc = grid['getDoc']();
    await doc.client.addSheet('Dati');
    await grid.refreshSheetList();
    await grid.switchSheet('Dati');
    await doc.client.setCell('Dati', 1, 1, 'importante');
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await grid.deleteCurrentSheet();
    expect(conferma).toHaveBeenCalledTimes(1);
    expect(conferma.mock.calls[0][0]).toContain('«Dati»');
    expect(await doc.client.listSheets()).toContain('Dati');
    conferma.mockReturnValue(true);
    await grid.deleteCurrentSheet();
    expect(await doc.client.listSheets()).not.toContain('Dati');
  });

  it('un foglio vuoto si elimina senza domande', async () => {
    const doc = grid['getDoc']();
    await doc.client.addSheet('Vuoto');
    await grid.refreshSheetList();
    await grid.switchSheet('Vuoto');
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await grid.deleteCurrentSheet();
    expect(conferma).not.toHaveBeenCalled();
    expect(await doc.client.listSheets()).not.toContain('Vuoto');
  });
});
