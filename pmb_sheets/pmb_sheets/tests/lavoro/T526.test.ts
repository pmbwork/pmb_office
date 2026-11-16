import { describe, it, expect } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { formulaPerExcel, scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx, senzaPrefissi } from '../../src/formati/xlsx-leggi';
import { documentoDaScambio, foglioVuoto, scambioDaDocumento, type Scambio } from '../../src/formati/scambio';
import { avvisiEsportazione, esporta, importa } from '../../src/formati/file';
import { DocumentStore } from '../../src/sheet/document-store';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { createWorkbook } from '../../src/engine/workbook';

const testo = (b: Uint8Array) => new TextDecoder().decode(b);
const parti = async (s: Scambio) => new Map([...(await leggiZip(await scriviXlsx(s)))].map(([n, d]) => [n, testo(d)]));
const A = (r1: number, r2: number, c1: number, c2: number) => ({ startRow: r1, endRow: r2, startCol: c1, endCol: c2 });

describe('T526: LAMBDA, LET e compagne scritte come le vuole Excel 365', () => {
  it('_xlfn. sulle funzioni e _xlpm. sui parametri', () => {
    expect(formulaPerExcel('=LAMBDA(x,x+1)(4)')).toBe('_xlfn.LAMBDA(_xlpm.x,_xlpm.x+1)(4)');
    expect(formulaPerExcel('=MAP(A1:A3,LAMBDA(v,v*2))')).toBe('_xlfn.MAP(A1:A3,_xlfn.LAMBDA(_xlpm.v,_xlpm.v*2))');
    expect(formulaPerExcel('=REDUCE(0,A1:A3,LAMBDA(acc,v,acc+v))')).toBe('_xlfn.REDUCE(0,A1:A3,_xlfn.LAMBDA(_xlpm.acc,_xlpm.v,_xlpm.acc+_xlpm.v))');
    expect(formulaPerExcel('=BYROW(A1:B2,LAMBDA(r,SUM(r)))')).toBe('_xlfn.BYROW(A1:B2,_xlfn.LAMBDA(_xlpm.r,SUM(_xlpm.r)))');
    expect(formulaPerExcel('=MAKEARRAY(2,2,LAMBDA(i,j,i*j))')).toBe('_xlfn.MAKEARRAY(2,2,_xlfn.LAMBDA(_xlpm.i,_xlpm.j,_xlpm.i*_xlpm.j))');
  });
  it('una LAMBDA con un nome (LET) chiamata come una funzione', () => {
    expect(formulaPerExcel('=LET(f,LAMBDA(x,x*2),f(5))')).toBe('_xlfn.LET(_xlpm.f,_xlfn.LAMBDA(_xlpm.x,_xlpm.x*2),_xlpm.f(5))');
  });
  it('non tocca testi tra virgolette, nomi di foglio, celle e nomi che non sono parametri', () => {
    expect(formulaPerExcel('=LET(x,1,x&"x")')).toBe('_xlfn.LET(_xlpm.x,1,_xlpm.x&"x")');
    expect(formulaPerExcel("=LET(x,'x'!A1,x+tasse)")).toBe("_xlfn.LET(_xlpm.x,'x'!A1,_xlpm.x+tasse)");
    expect(formulaPerExcel('=LET(a,B1,a+A1)')).toBe('_xlfn.LET(_xlpm.a,B1,_xlpm.a+A1)');
    expect(formulaPerExcel('=SUM(A1:A3)')).toBe('SUM(A1:A3)');
  });
  it('rileggendo il file la formula torna quella di prima e si calcola', () => {
    for (const f of ['=LET(f,LAMBDA(x,x*2),f(5))', '=MAP(A1:A3,LAMBDA(v,v*2))', '=LAMBDA(x,x+1)(4)']) expect(`=${senzaPrefissi(formulaPerExcel(f))}`).toBe(f);
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', `=${senzaPrefissi(formulaPerExcel('=LET(f,LAMBDA(x,x*2),f(5))'))}`);
    expect((w.getCell('Foglio1', 'A1').value as { value: number }).value).toBe(10);
  });
  it('nessun avviso su LAMBDA esportando in Excel', () => {
    const f = foglioVuoto('F'); f.celle.A1 = '=MAP(B1:B3,LAMBDA(x,x*2))';
    expect(avvisiEsportazione(documentoDaScambio({ foglioAttivo: 'F', fogli: [f] }), 'xlsx').join(' ')).not.toMatch(/LAMBDA|MAP/);
  });
});

describe('T526: il filtro nel file Excel', () => {
  const conFiltro = (): Scambio => {
    const f = foglioVuoto('F');
    Object.assign(f.celle, { B4: 'Voce', C4: 'Importo', B5: 'luce', C5: '60', B6: 'gas', C6: '45', B7: '', C7: '1' });
    f.filtro = { area: A(4, 9, 2, 3), colonne: [{ col: 2, valori: ['luce', ''] }, { col: 3 }] };
    return { foglioAttivo: 'F', fogli: [f] };
  };
  it('si scrive come autoFilter, con i valori spuntati e il nome nascosto che Excel vuole', async () => {
    const p = await parti(conFiltro());
    const foglio = p.get('xl/worksheets/sheet1.xml')!;
    expect(foglio).toContain('<autoFilter ref="B4:C9">');
    expect(foglio).toContain('<filterColumn colId="0"><filters blank="1"><filter val="luce"/></filters></filterColumn>');
    expect(foglio.indexOf('<autoFilter')).toBeGreaterThan(foglio.indexOf('</sheetData>'));
    expect(p.get('xl/workbook.xml')).toContain('<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">F!$B$4:$C$9</definedName>');
  });
  it('si rilegge uguale (la colonna senza valori scelti non c\'è nel file)', async () => {
    const r = await leggiXlsx(await scriviXlsx(conFiltro()));
    expect(r.avvisi).toEqual([]);
    expect(r.scambio.fogli[0].filtro).toEqual({ area: A(4, 9, 2, 3), colonne: [{ col: 2, valori: ['luce', ''] }] });
  });
  it('un filtro senza tabella salvata (file vecchi) usa tutto l\'intervallo usato dalla riga 1', () => {
    const f = foglioVuoto('F'); Object.assign(f.celle, { A1: 'x', C5: 'y' });
    const d = documentoDaScambio({ foglioAttivo: 'F', fogli: [f] });
    const s = scambioDaDocumento({ ...d, filters: { active: true, columns: [] } });
    expect(s.fogli[0].filtro).toEqual({ area: A(1, 5, 1, 3), colonne: [] });
  });
  it('documento → .xlsx → documento: tabella, valori spuntati e righe nascoste tornano', async () => {
    const S = new DocumentStore();
    const doc = S.getOrCreateDocument('a');
    for (const [r, v] of [[4, 'Voce'], [5, 'luce'], [6, 'gas'], [7, 'luce']] as Array<[number, string]>) await doc.client.setCell(doc.activeSheetName, r, 2, v);
    doc.isFilterActive = true;
    doc.filterArea = A(4, 7, 2, 2);
    doc.activeFilters.set(2, { col: 2, selectedValues: new Set(['luce']) });
    doc.hiddenRows = new Set([6]);
    const { dati, avvisi } = await importa(await esporta(await estraiDati(doc), 'xlsx'), 'prova.xlsx');
    expect(avvisi).toEqual([]);
    const d2 = new DocumentStore().getOrCreateDocument('b');
    await applicaDati(d2, dati);
    expect(d2.isFilterActive).toBe(true);
    expect(d2.filterArea).toEqual(A(4, 7, 2, 2));
    expect([...d2.activeFilters.get(2)!.selectedValues!]).toEqual(['luce']);
    expect([...d2.hiddenRows]).toEqual([6]);
  });
});

describe('T526: le viste filtro si perdono fuori dal formato nativo, e si dice', () => {
  it('avviso in .xlsx e .ods, niente nel .psheet', async () => {
    const doc = new DocumentStore().getOrCreateDocument('a');
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    doc.visteFiltro = [{ id: 'v', nome: 'Rossi', filtri: [{ col: 1 }] }];
    const dati = await estraiDati(doc);
    expect(avvisiEsportazione(dati, 'xlsx').join(' ')).toContain('le viste filtro');
    expect(avvisiEsportazione(dati, 'ods').join(' ')).toContain('le viste filtro');
    expect(avvisiEsportazione(dati, 'fsheet')).toEqual([]);
  });
  it('anche se le viste sono su un foglio che non è quello attivo', async () => {
    const doc = new DocumentStore().getOrCreateDocument('a');
    await doc.client.setCell(doc.activeSheetName, 1, 1, 'x');
    const dati = await estraiDati(doc);
    const conAltro = { ...dati, fogliStato: { Altro: { ...((dati.fogliStato ?? {})[''] ?? {}), cellStyles: {}, rowStyles: {}, colStyles: {}, colWidths: {}, rowHeights: {}, hiddenRows: [], hiddenCols: [], freezeRows: 0, freezeCols: 0, merges: [], dataValidations: {}, conditionalFormats: [], filters: { active: false, columns: [] }, visteFiltro: [{ id: 'v', nome: 'x', filtri: [{ col: 1 }] }] } } };
    expect(avvisiEsportazione(conAltro, 'xlsx').join(' ')).toContain('le viste filtro');
  });
});
