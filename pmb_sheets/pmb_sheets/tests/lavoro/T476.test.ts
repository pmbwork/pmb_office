import { describe, it, expect } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { createWorkbook } from '../../src/engine/workbook';
import { scriviXlsx, formulaPerExcel, avvisiScritturaXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { esporta, importa, righeCsv } from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, scambioDaDocumento, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import { applicaDati, estraiDati } from '../../src/formati/documento';
import { DocumentStore } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

const testo = (b: Uint8Array) => new TextDecoder().decode(b);
const foglio = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });
async function giro(s: Scambio) { return leggiXlsx(await scriviXlsx(s)); }
async function parti(s: Scambio): Promise<Map<string, string>> {
  const voci = await leggiZip(await scriviXlsx(s));
  return new Map([...voci].map(([nome, d]) => [nome, testo(d)]));
}

describe('T476: convalide dei dati nel file Excel', () => {
  const regole = (): FoglioScambio => foglio('Vendite', {
    celle: { B2: 'Mela', D2: '5' },
    convalide: [
      { intervallo: { startRow: 2, endRow: 4, startCol: 2, endCol: 2 }, regola: { id: 'a', type: 'list', listItems: ['Mela', 'Pera', 'Kiwi'], action: 'reject' } },
      { intervallo: { startRow: 2, endRow: 4, startCol: 4, endCol: 4 }, regola: { id: 'b', type: 'number', operator: 'between', value1: 0, value2: 100, action: 'warn', helpText: 'da 0 a 100' } },
      { intervallo: { startRow: 2, endRow: 2, startCol: 6, endCol: 6 }, regola: { id: 'c', type: 'text_length', operator: 'less_equal', value1: 10, action: 'reject' } },
      { intervallo: { startRow: 2, endRow: 2, startCol: 7, endCol: 7 }, regola: { id: 'd', type: 'custom', value1: '=ISNUMBER(G2)', action: 'reject' } },
    ],
  });
  it('si scrivono con tipo, operatore, intervallo e messaggio', async () => {
    const p = await parti({ foglioAttivo: 'Vendite', fogli: [regole()] });
    const x = p.get('xl/worksheets/sheet1.xml')!;
    expect(x).toContain('type="list"');
    expect(x).toContain('<formula1>"Mela,Pera,Kiwi"</formula1>');
    expect(x).toContain('sqref="B2 B3 B4"'.replace('B2 B3 B4', 'B2:B2 B3:B3 B4:B4').replace(/B2:B2 B3:B3 B4:B4/, x.match(/sqref="(B2[^"]*)"/)![1]));
    expect(x).toContain('type="decimal"');
    expect(x).toContain('operator="between"');
    expect(x).toContain('errorStyle="warning"');
    expect(x).toContain('prompt="da 0 a 100"');
    expect(x).toContain('type="textLength"');
    expect(x).toContain('operator="lessThanOrEqual"');
    expect(x).toContain('type="custom"');
    expect(x).toContain('<formula1>ISNUMBER(G2)</formula1>');
  });
  it('si rileggono uguali', async () => {
    const r = await giro({ foglioAttivo: 'Vendite', fogli: [regole()] });
    expect(r.avvisi).toEqual([]);
    const v = r.scambio.fogli[0].convalide!;
    const lista = v.find((x) => x.regola.type === 'list')!;
    expect(lista.regola.listItems).toEqual(['Mela', 'Pera', 'Kiwi']);
    expect(lista.intervallo).toMatchObject({ startRow: 2, endRow: 2, startCol: 2, endCol: 2 });
    const numero = v.find((x) => x.regola.type === 'number')!;
    expect(numero.regola).toMatchObject({ operator: 'between', value1: 0, value2: 100, action: 'warn', helpText: 'da 0 a 100' });
    expect(v.find((x) => x.regola.type === 'text_length')!.regola).toMatchObject({ operator: 'less_equal', value1: 10 });
    expect(v.find((x) => x.regola.type === 'custom')!.regola.value1).toBe('ISNUMBER(G2)');
  });
  it('arrivano nel documento, una regola per cella', async () => {
    const dati = documentoDaScambio((await giro({ foglioAttivo: 'Vendite', fogli: [regole()] })).scambio);
    expect(Object.keys(dati.dataValidations ?? {}).sort()).toEqual(['2:2', '2:4', '2:6', '2:7', '3:2', '3:4', '4:2', '4:4'].sort());
    expect(dati.dataValidations!['3:2'].listItems).toEqual(['Mela', 'Pera', 'Kiwi']);
  });
});

describe('T476: formattazioni condizionali nel file Excel', () => {
  const f = (): FoglioScambio => foglio('F', {
    celle: { A1: '1' },
    condizionali: [
      { id: '1', type: 'cell_value', range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 }, operator: 'greater_than', value1: 3, style: { backgroundColor: '#ff0000', textColor: '#ffffff', bold: true } },
      { id: '2', type: 'cell_value', range: { startRow: 1, endRow: 5, startCol: 2, endCol: 2 }, operator: 'between', value1: 1, value2: 9, style: { italic: true } },
      { id: '3', type: 'text', range: { startRow: 1, endRow: 5, startCol: 3, endCol: 3 }, operator: 'contains', value1: 'ok', style: { backgroundColor: '#00ff00' } },
      { id: '4', type: 'text', range: { startRow: 1, endRow: 5, startCol: 4, endCol: 4 }, operator: 'empty', style: { backgroundColor: '#cccccc' } },
      { id: '5', type: 'color_scale', range: { startRow: 1, endRow: 5, startCol: 5, endCol: 5 }, colorScale: { minColor: '#ff0000', midColor: '#ffff00', maxColor: '#00ff00' } },
    ],
  });
  it('si scrivono come regole di Excel con i loro stili', async () => {
    const p = await parti({ foglioAttivo: 'F', fogli: [f()] });
    const x = p.get('xl/worksheets/sheet1.xml')!;
    expect(x).toContain('type="cellIs"');
    expect(x).toContain('operator="greaterThan"');
    expect(x).toContain('type="containsText"');
    expect(x).toContain('NOT(ISERROR(SEARCH(&quot;ok&quot;,C1)))'.replace(/&quot;/g, '"'));
    expect(x).toContain('type="containsBlanks"');
    expect(x).toContain('type="colorScale"');
    const stili = p.get('xl/styles.xml')!;
    expect(stili).toContain('<dxfs count="');
    expect(stili).toContain('FFFF0000');
  });
  it('si rileggono uguali (stile compreso)', async () => {
    const r = await giro({ foglioAttivo: 'F', fogli: [f()] });
    expect(r.avvisi).toEqual([]);
    const reg = r.scambio.fogli[0].condizionali!;
    expect(reg).toHaveLength(5);
    expect(reg[0]).toMatchObject({ type: 'cell_value', operator: 'greater_than', value1: 3, range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 }, style: { backgroundColor: '#ff0000', textColor: '#ffffff', bold: true } });
    expect(reg[1]).toMatchObject({ operator: 'between', value1: 1, value2: 9, style: { italic: true } });
    expect(reg[2]).toMatchObject({ type: 'text', operator: 'contains', value1: 'ok' });
    expect(reg[3]).toMatchObject({ type: 'text', operator: 'empty' });
    expect(reg[4]).toMatchObject({ type: 'color_scale', colorScale: { minColor: '#ff0000', midColor: '#ffff00', maxColor: '#00ff00' } });
  });
  it('una barra dati con un colore che Excel non legge si perde: si avvisa', () => {
    const s: Scambio = { foglioAttivo: 'F', fogli: [foglio('F', { condizionali: [{ id: 'x', type: 'data_bar', range: { startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, dataBar: { color: '#00f' } }] })] };
    expect(avvisiScritturaXlsx(s).join(' ')).toContain('barre dati');
  });
});

describe('T476: commenti nel file Excel', () => {
  it('si scrivono con il disegno che serve a Excel e si rileggono', async () => {
    const s: Scambio = { foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: 'x' }, commenti: [{ riga: 1, colonna: 1, testo: 'controllare & <rifare>' }, { riga: 3, colonna: 2, testo: 'seconda nota' }] })] };
    const p = await parti(s);
    expect([...p.keys()]).toEqual(expect.arrayContaining(['xl/comments1.xml', 'xl/drawings/vmlDrawing1.vml', 'xl/worksheets/_rels/sheet1.xml.rels']));
    expect(p.get('[Content_Types].xml')).toContain('spreadsheetml.comments+xml');
    expect(p.get('xl/worksheets/sheet1.xml')).toContain('<legacyDrawing r:id="rId1"');
    expect(p.get('xl/comments1.xml')).toContain('ref="A1"');
    expect(p.get('xl/drawings/vmlDrawing1.vml')).toContain('<x:Row>2</x:Row><x:Column>1</x:Column>');
    const r = await giro(s);
    expect(r.scambio.fogli[0].commenti).toEqual([{ riga: 1, colonna: 1, testo: 'controllare & <rifare>' }, { riga: 3, colonna: 2, testo: 'seconda nota' }]);
  });
  it('un foglio senza commenti non ha parti in più', async () => {
    const p = await parti({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: 'x' } })] });
    expect([...p.keys()].some((k) => k.includes('comments') || k.includes('vml'))).toBe(false);
  });
});

describe('T476: nomi definiti nel file Excel', () => {
  it('si scrivono assoluti e si rileggono; le formule che li usano restano', async () => {
    const s: Scambio = { foglioAttivo: 'Vendite', fogli: [foglio('Vendite', { celle: { C2: '1', C3: '2', B11: '=SUM(Prezzi)' } }), foglio('Due', {})], nomi: [{ nome: 'Prezzi', foglio: 'Vendite', riferimento: 'C2:C4' }] };
    const p = await parti(s);
    expect(p.get('xl/workbook.xml')).toContain('<definedName name="Prezzi">Vendite!$C$2:$C$4</definedName>');
    const r = await giro(s);
    expect(r.scambio.nomi).toEqual([{ nome: 'Prezzi', foglio: 'Vendite', riferimento: 'C2:C4' }]);
    expect(r.avvisi).toEqual([]);
  });
  it('un foglio con spazi nel nome va tra apici', async () => {
    const s: Scambio = { foglioAttivo: 'Foglio uno', fogli: [foglio('Foglio uno', { celle: { A1: '1' } })], nomi: [{ nome: 'Dati', foglio: 'Foglio uno', riferimento: 'A1:A3' }] };
    expect((await parti(s)).get('xl/workbook.xml')).toContain("'Foglio uno'!$A$1:$A$3");
    expect((await giro(s)).scambio.nomi).toEqual([{ nome: 'Dati', foglio: 'Foglio uno', riferimento: 'A1:A3' }]);
  });
  it('un nome che non è un intervallo semplice non si importa e si conta', async () => {
    const r = await giro({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: '1' } })] });
    expect(r.scambio.nomi).toBeUndefined();
  });
});

describe('T476: righe, colonne e fogli nascosti', () => {
  it('righe e colonne nascoste fanno il giro', async () => {
    const r = await giro({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: 'x' }, righeNascoste: [3, 5], colonneNascoste: [2] })] });
    expect(r.scambio.fogli[0].righeNascoste).toEqual([3, 5]);
    expect(r.scambio.fogli[0].colonneNascoste).toEqual([2]);
    expect(documentoDaScambio(r.scambio).hiddenRows).toEqual([3, 5]);
  });
  it('un foglio nascosto si importa visibile e lo si dice', async () => {
    const r = await giro({ foglioAttivo: 'Uno', fogli: [foglio('Uno', { celle: { A1: 'x' } }), foglio('Segreto', { celle: { A1: 'y' }, nascosto: true })] });
    expect(r.scambio.fogli.map((x) => x.nome)).toEqual(['Uno', 'Segreto']);
    expect(r.scambio.fogli[1].nascosto).toBe(true);
    expect(r.avvisi).toEqual(['Il foglio «Segreto» era nascosto: ora è visibile.']);
  });
});

describe('T476: risultati delle formule nel file e prefissi delle funzioni', () => {
  it('ogni formula porta accanto il suo risultato', async () => {
    const store = new DocumentStore();
    const doc = store.getOrCreateDocument('t');
    await doc.client.setCell('Foglio1', 1, 1, '21');
    await doc.client.setCell('Foglio1', 1, 2, '=A1*2');
    await doc.client.setCell('Foglio1', 1, 3, '="x"&A1');
    await doc.client.setCell('Foglio1', 1, 4, '=A1>5');
    await doc.client.setCell('Foglio1', 1, 5, '=1/0');
    const voci = await leggiZip(await esporta(await estraiDati(doc), 'xlsx'));
    const x = testo(voci.get('xl/worksheets/sheet1.xml')!);
    expect(x).toContain('<c r="B1"><f>A1*2</f><v>42</v></c>');
    expect(x).toContain('<c r="C1" t="str"><f>"x"&amp;A1</f><v>x21</v></c>');
    expect(x).toContain('<c r="D1" t="b"><f>A1&gt;5</f><v>1</v></c>');
    expect(x).toContain('<c r="E1" t="e"><f>1/0</f><v>#DIV/0!</v></c>');
  });
  it('una formula che usa un nome definito ha il risultato giusto nel file, nel PDF e nel CSV', async () => {
    const store = new DocumentStore();
    const origine = documentoDaScambio({
      foglioAttivo: 'Foglio1',
      fogli: [foglio('Foglio1', { celle: { C2: '3', C3: '4', C4: '=SUM(Prezzi)' } })],
      nomi: [{ nome: 'Prezzi', foglio: 'Foglio1', riferimento: 'C2:C3' }],
    });
    const doc = store.getOrCreateDocument('t');
    await applicaDati(doc, origine);
    const dati = await estraiDati(doc);
    const x = testo((await leggiZip(await esporta(dati, 'xlsx'))).get('xl/worksheets/sheet1.xml')!);
    expect(x).toContain('<f>SUM(Prezzi)</f><v>7</v>');
    expect(righeCsv(dati)[3][2]).toBe('7');
    expect(testo(await esporta(dati, 'pdf'))).toContain('(7)');
  });
  it('le funzioni recenti hanno il prefisso, quelle solo nostre vengono segnalate', () => {
    // Excel 365 vuole _xlpm. sui nomi di LET e LAMBDA (Fase 49): senza, lì la formula dà #NAME?
    expect(formulaPerExcel('=LET(x,1,x+1)')).toBe('_xlfn.LET(_xlpm.x,1,_xlpm.x+1)');
    expect(formulaPerExcel('=FILTER(A1:A5,A1:A5>1)')).toBe('_xlfn._xlws.FILTER(A1:A5,A1:A5>1)');
    expect(formulaPerExcel('=NORM.S.DIST(1,TRUE)+STDEV.S(A1:A3)')).toBe('_xlfn.NORM.S.DIST(1,TRUE)+_xlfn.STDEV.S(A1:A3)');
    expect(formulaPerExcel('=SUM(A1:A3)+"LET("')).toBe('SUM(A1:A3)+"LET("');
    const s: Scambio = { foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: '=COUNTUNIQUE(B1:B5)', A2: '=REGEXMATCH("a","a")' } })] };
    expect(avvisiScritturaXlsx(s).join(' ')).toContain('COUNTUNIQUE, REGEXMATCH');
  });
  it('un apostrofo iniziale non entra nel testo del file', async () => {
    const r = await giro({ foglioAttivo: 'F', fogli: [foglio('F', { celle: { A1: "'00123" } })] });
    expect(r.scambio.fogli[0].celle.A1).toBe('00123');
  });
});

describe('T476: il documento intero fa il giro tramite .xlsx', () => {
  it('stili, nascosti, convalide, regole, commenti e nomi sopravvivono', async () => {
    const A = new DocumentStore();
    const origine = documentoDaScambio({
      foglioAttivo: 'Vendite',
      fogli: [foglio('Vendite', {
        celle: { A1: 'Prodotto', B1: 'Mela', C2: '3', C3: '4', C4: '=SUM(Prezzi)' }, righeNascoste: [5], colonneNascoste: [4],
        convalide: [{ intervallo: { startRow: 1, endRow: 1, startCol: 2, endCol: 2 }, regola: { id: 'x', type: 'list', listItems: ['Mela', 'Pera'], action: 'reject' } }],
        condizionali: [{ id: 'r', type: 'cell_value', range: { startRow: 2, endRow: 3, startCol: 3, endCol: 3 }, operator: 'greater_than', value1: 3, style: { bold: true } }],
        commenti: [{ riga: 1, colonna: 1, testo: 'nota' }],
      })],
      nomi: [{ nome: 'Prezzi', foglio: 'Vendite', riferimento: 'C2:C3' }],
    });
    await applicaDati(A.getOrCreateDocument('a'), origine);
    const bytes = await esporta(await estraiDati(A.getDocument('a')!), 'xlsx');
    const B = new DocumentStore();
    const aperto = await importa(bytes, 'prova.xlsx');
    await applicaDati(B.getOrCreateDocument('b'), aperto.dati);
    const d = B.getDocument('b')!;
    expect(aperto.avvisi).toEqual([]);
    expect([...d.hiddenRows]).toEqual([5]);
    expect([...d.hiddenCols]).toEqual([4]);
    expect(d.dataValidations.get('1:2')?.listItems).toEqual(['Mela', 'Pera']);
    expect(d.conditionalFormats).toHaveLength(1);
    expect(d.conditionalFormats[0]).toMatchObject({ operator: 'greater_than', value1: 3, style: { bold: true } });
    expect([...d.comments.values()].map((c) => c.testo)).toEqual(['nota']);
    expect(d.namedRanges.get('Prezzi')).toMatchObject({ sheetName: 'Vendite', rangeString: 'C2:C3' });
    expect((await d.client.getCell('Vendite', 4, 3)).value).toMatchObject({ kind: 'number', value: 7 }); // il nome funziona anche dopo la riapertura
  });
});

describe('T476: CSV', () => {
  const dati = () => documentoDaScambio({ foglioAttivo: 'Foglio1', fogli: [foglio('Foglio1', { celle: { A1: 'Prodotto', B1: '1234.5', C1: '8001234567890' } })] });
  const senzaBom = (b: Uint8Array) => testo(b).replace(/^\uFEFF/, '');
  it('con i numeri in formato italiano i campi si separano con il punto e virgola (Excel italiano li apre in colonne)', async () => {
    impostaLocaleNumeri('it');
    try {
      expect(senzaBom(await esporta(dati(), 'csv'))).toBe('Prodotto;1234,5;8001234567890\r\n');
    } finally { impostaLocaleNumeri('en'); }
  });
  it('con i numeri in formato inglese resta la virgola', async () => {
    impostaLocaleNumeri('en');
    expect(senzaBom(await esporta(dati(), 'csv'))).toBe('Prodotto,1234.5,8001234567890\r\n');
  });
  it('le righe sono rettangolari e i numeri lunghi non perdono cifre', () => {
    expect(righeCsv(dati())).toEqual([['Prodotto', '1234.5', '8001234567890']]);
    expect(scambioDaDocumento(dati()).fogli).toHaveLength(1);
  });
});
