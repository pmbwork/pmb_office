import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { leggiCsv } from '@comune/formati/csv';
import {
  DIMENSIONE_MASSIMA, ESTENSIONI_APRI, FORMATI, TITOLO_PREDEFINITO, avvisiEsportazione, decodificaTesto, esporta, formatoDaNome, importa, nomeFile,
  righeCsv, scambioDaCsv, titoloDaNome,
} from '../../src/formati/file';
import { foglioVuoto, documentoDaScambio, scambioDaDocumento, type FoglioScambio } from '../../src/formati/scambio';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import type { SheetDocumentData } from '../../src/sheet/document-data';

const codifica = new TextEncoder();
const dec = new TextDecoder();
function foglio(nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio { return { ...foglioVuoto(nome), ...extra }; }
function dati(celle: Record<string, string>, extra: Partial<FoglioScambio> = {}): SheetDocumentData {
  return documentoDaScambio({ fogli: [foglio('Foglio1', { celle, ...extra })], foglioAttivo: 'Foglio1' });
}
const testo = (b: Uint8Array): string => dec.decode(b);
const celleDi = async (b: Uint8Array, nome: string) => Object.fromEntries(Object.entries(scambioDaDocumento((await importa(b, nome)).dati).fogli[0].celle));

describe('T203 formati di file di Fogli', () => {
  it('elenco dei formati e delle estensioni', () => {
    const voce = (id: string) => FORMATI.find((f) => f.id === id);
    expect([voce('xlsx')?.estensione, voce('xlsx')?.mime]).toEqual(['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    expect([voce('csv')?.estensione, voce('csv')?.mime]).toEqual(['csv', 'text/csv']);
    expect([voce('fsheet')?.estensione, voce('fsheet')?.mime]).toEqual(['psheet', 'application/json']);
    expect(new Set(FORMATI.map((f) => f.id)).size).toBe(FORMATI.length);
    expect(FORMATI.every((f) => f.etichetta.includes(`.${f.estensione}`))).toBe(true);
    expect(ESTENSIONI_APRI.split(',')).toEqual(expect.arrayContaining(['.xlsx', '.csv', '.tsv', '.txt', '.psheet', '.fsheet']));
    expect(DIMENSIONE_MASSIMA).toBe(50 * 1024 * 1024);
    expect(TITOLO_PREDEFINITO).toBe('Foglio di calcolo senza titolo');
  });

  it('nomeFile toglie i caratteri vietati, i punti finali e i nomi riservati', () => {
    expect(nomeFile('Bilancio 2024', 'xlsx')).toBe('Bilancio 2024.xlsx');
    expect(nomeFile('a/b\\c:d*e?f"g<h>i|j', 'csv')).toBe('a b c d e f g h i j.csv');
    expect(nomeFile('  Conti   di   casa.. ', 'fsheet')).toBe('Conti di casa.psheet');
    expect(nomeFile('', 'xlsx')).toBe(`${TITOLO_PREDEFINITO}.xlsx`);
    expect(nomeFile('///', 'csv')).toBe(`${TITOLO_PREDEFINITO}.csv`);
    expect(nomeFile('con', 'csv')).toBe('_con.csv');
    expect(nomeFile('LPT3', 'xlsx')).toBe('_LPT3.xlsx');
    expect(nomeFile('x'.repeat(200), 'csv')).toBe(`${'x'.repeat(120)}.csv`);
    expect(nomeFile('ab\u0001cd', 'csv')).toBe('ab cd.csv');
  });

  it('formatoDaNome', () => {
    expect(formatoDaNome('a.xlsx')).toBe('xlsx');
    expect(formatoDaNome('A.XLSX')).toBe('xlsx');
    expect(formatoDaNome('a.fsheet')).toBe('fsheet');
    expect(formatoDaNome('a.psheet')).toBe('fsheet'); // .psheet è la nuova estensione di pmb_sheets
    for (const e of ['csv', 'TSV', 'txt']) expect(formatoDaNome(`a.${e}`), e).toBe('csv');
    expect(formatoDaNome('a.docx')).toBeNull();
    expect(formatoDaNome('senza')).toBeNull();
    expect(formatoDaNome('a.csv.bak')).toBeNull();
  });

  it('titoloDaNome toglie percorso ed estensione nota', () => {
    expect(titoloDaNome('C:\\Cartella\\Conti.xlsx')).toBe('Conti');
    expect(titoloDaNome('/x/y/dati.csv')).toBe('dati');
    expect(titoloDaNome('relazione.docx')).toBe('relazione.docx');
    expect(titoloDaNome('  Spese  .psheet')).toBe('Spese');
    expect(titoloDaNome('.csv')).toBe(TITOLO_PREDEFINITO);
    expect(titoloDaNome('')).toBe(TITOLO_PREDEFINITO);
  });

  it('decodificaTesto riconosce le codifiche', () => {
    expect(decodificaTesto(codifica.encode('è à'))).toBe('è à');
    expect(decodificaTesto(new Uint8Array([0xef, 0xbb, 0xbf, 0x63, 0xc3, 0xa8]))).toBe('cè');
    expect(decodificaTesto(new Uint8Array([0xff, 0xfe, 0x63, 0x00, 0xe8, 0x00]))).toBe('cè');
    expect(decodificaTesto(new Uint8Array([0xfe, 0xff, 0x00, 0x63, 0x00, 0xe8]))).toBe('cè');
    expect(decodificaTesto(new Uint8Array([0x63, 0xe8, 0x20, 0x80]))).toBe('cè €');
  });

  it('righeCsv: i numeri lunghi si scrivono con 15 cifre, senza esponente né arrotondamento a 10 cifre', () => {
    const r = righeCsv(dati({ A1: '8001234567890', A2: '1234567.891234', A3: '=0.1+0.2', A4: '123456789012345678' }));
    expect(r.map((x) => x[0])).toEqual(['8001234567890', '1234567.891234', '0.3', '123456789012346000']);
  });

  it('righeCsv: valori calcolati, matrice rettangolare, fino all\'ultima cella piena', () => {
    const r = righeCsv(dati({ A1: '2', B1: '=A1*3', C1: 'ciao', A2: '=SUM(A1:B1)', A3: 'true', B3: '=1/0' }));
    expect(r).toEqual([['2', '6', 'ciao'], ['8', '', ''], ['TRUE', '#DIV/0!', '']]);
    expect(righeCsv(dati({ B2: 'x' }))).toEqual([['', ''], ['', 'x']]);
    expect(righeCsv(dati({}))).toEqual([]);
    expect(righeCsv(dati({ A1: 'x', C3: '=""' }))).toEqual([['x']]);
    expect(righeCsv(dati({ A1: '=0.1+0.2', B1: '=1/3' }))).toEqual([['0.3', '0.333333333333333']]);
  });

  it('righeCsv usa il foglio attivo, o il primo se il nome non c\'è', () => {
    const d = documentoDaScambio({ fogli: [foglio('Uno', { celle: { A1: 'uno' } }), foglio('Due', { celle: { A1: 'due' } })], foglioAttivo: 'Due' });
    expect(righeCsv(d)).toEqual([['due']]);
    expect(righeCsv({ ...d, activeSheetName: 'Boh' })).toEqual([['uno']]);
  });

  it('esporta in CSV: UTF-8 con BOM, righe CRLF, campi tra virgolette quando serve', async () => {
    const b = await esporta(dati({ A1: 'a,b', B1: 'dice "sì"', A2: 'riga\nnuova', B2: '5' }), 'csv');
    expect(Array.from(b.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const t = testo(b).replace(/^\uFEFF/, '');
    expect(t.startsWith('"a,b","dice ""sì"""\r\n')).toBe(true);
    expect(leggiCsv(t)).toEqual([['a,b', 'dice "sì"'], ['riga\nnuova', '5']]);
  });

  it('CSV: scritto e riletto, i valori restano', async () => {
    const origine = { A1: 'Nome', B1: 'Età', A2: 'Zoë', B2: '41', C2: '3.5', A3: 'a;b', C3: 'x,y' };
    expect(await celleDi(await esporta(dati(origine), 'csv'), 'x.csv')).toEqual(origine);
  });

  it('scambioDaCsv: separatori, virgolette, campi vuoti, virgola decimale solo se il separatore non è la virgola', () => {
    const celle = (t: string) => scambioDaCsv(t).fogli[0].celle;
    expect(celle('a,b\n1,2')).toEqual({ A1: 'a', B1: 'b', A2: '1', B2: '2' });
    expect(celle('a;b\n1;2')).toEqual({ A1: 'a', B1: 'b', A2: '1', B2: '2' });
    expect(celle('a\tb\n1\t2')).toEqual({ A1: 'a', B1: 'b', A2: '1', B2: '2' });
    expect(celle('"x;y";"a\nb"\n;1')).toEqual({ A1: 'x;y', B1: 'a\nb', B2: '1' });
    expect(celle('n;v\nuno;1,5\ndue;1.234,56\ntre;-3,25\nquattro;+7,1\ncinque;1.234\nsei;12,5a\nsette;1.2345,6\notto;,5\nnove;5,')).toEqual({
      A1: 'n', B1: 'v', A2: 'uno', B2: '1.5', A3: 'due', B3: '1234.56', A4: 'tre', B4: '-3.25', A5: 'quattro', B5: '+7.1', A6: 'cinque', B6: '1.234', A7: 'sei', B7: '12,5a', A8: 'sette', B8: '1.2345,6', A9: 'otto', B9: ',5', A10: 'nove', B10: '5,',
    });
    expect(celle('a,b\n"1,5",2')).toEqual({ A1: 'a', B1: 'b', A2: '1,5', B2: '2' });
    const s = scambioDaCsv('a,b');
    expect([s.fogli.length, s.fogli[0].nome, s.foglioAttivo]).toEqual([1, 'Foglio1', 'Foglio1']);
    expect(scambioDaCsv('a', 'Dati').foglioAttivo).toBe('Dati');
    expect(scambioDaCsv('').fogli[0].celle).toEqual({});
  });

  it('scambioDaCsv non scrive oltre i limiti del foglio', () => {
    const righe = scambioDaCsv('a\n'.repeat(1_048_577)).fogli[0].celle;
    expect(Object.keys(righe).length).toBe(1_048_576);
    expect(righe.A1048576).toBe('a');
    const colonne = scambioDaCsv(new Array(16_385).fill('x').join(',')).fogli[0].celle;
    expect(Object.keys(colonne).length).toBe(16_384);
    expect(colonne.XFD1).toBe('x');
  });

  it('importa CSV: dal nome o dal contenuto, con BOM, UTF-16 e Windows-1252', async () => {
    const r = await importa(codifica.encode('\uFEFFnome;età\nZoë;4,5'), 'dati.csv');
    expect(r.formato).toBe('csv');
    expect(r.avvisi).toEqual([]);
    expect(scambioDaDocumento(r.dati).fogli[0].celle).toEqual({ A1: 'nome', B1: 'età', A2: 'Zoë', B2: '4.5' });
    for (const nome of ['a.tsv', 'a.txt', 'senza_estensione', 'a.dat']) expect((await importa(codifica.encode('a;b\n1;2'), nome)).formato, nome).toBe('csv');
    expect(await celleDi(new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x3b, 0x00, 0xe8, 0x00]), 'u.csv')).toEqual({ A1: 'a', B1: 'è' });
    expect(await celleDi(new Uint8Array([0x61, 0x3b, 0x63, 0xe8]), 'w.csv')).toEqual({ A1: 'a', B1: 'cè' });
    expect(await celleDi(codifica.encode('a;b\u0001c\u0007\u000b\u001f\u000e'), 'c.csv')).toEqual({ A1: 'a', B1: 'bc' });
    expect(await celleDi(codifica.encode('a;b\tc\r\nd;e'), 'c.csv')).toEqual({ A1: 'a', B1: 'b\tc', A2: 'd', B2: 'e' });
  });

  it('formato nostro .fsheet: scritto e riletto uguale', async () => {
    const origine = {
      ...dati({ A1: '5', B1: '=A1*2', C1: 'x' }, { stili: { A1: { bold: true, fill: '#ff0000' } }, larghezze: { 1: 99 }, unioni: [{ startRow: 3, endRow: 4, startCol: 1, endCol: 2 }], righeCongelate: 1 }),
      // tutto lo stato del foglio viaggia nel file nativo: righe e colonne nascoste, filtri, grafici, pivot
      hiddenRows: [2, 5],
      hiddenCols: [3],
      images: [],
      filters: { active: true, columns: [{ col: 1, selectedValues: ['5', 'x'] }, { col: 2, condition: { operator: 'not_empty' as const } }] },
      charts: [{ id: 'g1', title: 'Vendite', type: 'bar', sheetName: 'Foglio1', dataRange: 'A1:B3', x: 10, y: 20, width: 300, height: 200, showLegend: true, showLabels: false, categories: ['a'], series: [] }] as never,
      pivots: [{ id: 'p1', name: 'Pivot', sourceSheet: 'Foglio1', sourceRange: 'A1:C3', rowFields: [], colFields: [], valueFields: [], filters: [], showGrandTotals: true, showSubtotals: false }] as never,
    };
    const b = await esporta(origine, 'fsheet');
    expect(JSON.parse(testo(b)).version).toBe(1);
    const r = await importa(b, 'conti.fsheet');
    expect(r.formato).toBe('fsheet');
    expect(r.avvisi).toEqual([]);
    expect(r.dati).toEqual(origine);
  });

  it('un testo JSON di Fogli senza estensione si apre come .fsheet, uno rotto come CSV', async () => {
    const json = testo(await esporta(dati({ A1: '1' }), 'fsheet'));
    expect((await importa(codifica.encode(json), 'senza')).formato).toBe('fsheet');
    expect((await importa(codifica.encode('{"version": 1, rotto'), 'senza')).formato).toBe('csv');
    expect((await importa(codifica.encode(json), 'dati.csv')).formato).toBe('csv');
  });

  it('.fsheet non valido: errore chiaro', async () => {
    await expect(importa(codifica.encode('non è json'), 'a.fsheet')).rejects.toThrow(/^File \.psheet non valido: /);
    await expect(importa(codifica.encode('{"version":2,"workbookJson":"x","styles":[]}'), 'a.fsheet')).rejects.toThrow(/^File \.psheet non valido: Versione non supportata/);
    await expect(importa(codifica.encode(''), 'a.fsheet')).rejects.toThrow(/^File \.psheet non valido: /);
  });

  it('Excel: scritto e riletto, le celle restano', async () => {
    const origine = dati({ A1: 'Nome', B1: '12.5', C1: '=B1*2', A2: 'vero', B2: 'TRUE' }, { stili: { A1: { bold: true } }, larghezze: { 1: 120 } });
    const r = await importa(await esporta(origine, 'xlsx'), 'a.xlsx');
    expect(r.formato).toBe('xlsx');
    expect(scambioDaDocumento(r.dati)).toEqual(scambioDaDocumento(origine));
    expect(r.avvisi).toEqual([]);
  });

  it('un archivio ZIP si apre come Excel anche con un nome diverso', async () => {
    const b = await esporta(dati({ A1: 'x' }), 'xlsx');
    expect((await importa(b, 'a.dat')).formato).toBe('xlsx');
    expect((await importa(b, 'senza')).formato).toBe('xlsx');
    expect((await importa(b, 'a.fsheet')).formato).toBe('xlsx');
    expect((await importa(b, 'a.csv')).formato).toBe('xlsx');
  });

  it('importa Excel: gli avvisi del file; gli stili di ogni foglio si conservano', async () => {
    const piu = await scriviXlsx({
      fogli: [foglio('Uno', { celle: { A1: 'x' } }), foglio('Due', { celle: { A1: 'y' }, stili: { A1: { bold: true } } })], foglioAttivo: 'Uno',
    });
    const voci = await leggiZip(piu);
    voci.set('xl/charts/chart1.xml', codifica.encode('<c/>'));
    const r = await importa(await scriviZip([...voci].map(([nome, d]) => ({ nome, dati: d }))), 'a.xlsx');
    expect(r.avvisi).toEqual(['Grafici e disegni del file non sono stati importati.']);
    expect(scambioDaDocumento(r.dati).fogli.find((x) => x.nome === 'Due')!.stili.A1).toMatchObject({ bold: true });
  });


  it('file che non si possono aprire', async () => {
    await expect(importa(new Uint8Array([0x61, 0x00, 0x62, 0x00, 0x00]), 'a.csv')).rejects.toThrow('Formato di file non riconosciuto');
    await expect(importa(new Uint8Array([0x00, 0x01, 0x02]), 'senza')).rejects.toThrow('Formato di file non riconosciuto');
    await expect(importa(await scriviZip([{ nome: 'a.txt', dati: codifica.encode('x') }]), 'a.xlsx')).rejects.toThrow(/^File \.xlsx non valido: /);
    await expect(importa(new Uint8Array(DIMENSIONE_MASSIMA + 1), 'a.csv')).rejects.toThrow('File troppo grande (massimo 50 MB)');
  });

  it('avvisi di esportazione', async () => {
    const semplice = dati({ A1: '1', B1: 'x' });
    for (const f of ['xlsx', 'csv', 'fsheet'] as const) expect(avvisiEsportazione(semplice, f), f).toEqual([]);
    const piuFogli = documentoDaScambio({ fogli: [foglio('Uno', { celle: { A1: '1' } }), foglio('a/b', { celle: { A1: '2' } })], foglioAttivo: 'a/b' });
    expect(avvisiEsportazione(piuFogli, 'fsheet')).toEqual([]);
    const x = avvisiEsportazione(piuFogli, 'xlsx');
    expect(x.length).toBe(1);
    expect(x[0]).toContain('«a/b»');
    expect(x[0]).toContain('«a_b»');
    expect(avvisiEsportazione(piuFogli, 'csv')).toEqual(['Il file CSV contiene solo il foglio «a/b»: gli altri fogli non sono inclusi.']);
    const perdita = 'Il file CSV contiene solo i valori calcolati: formule, formattazione e celle unite non si conservano.';
    expect(avvisiEsportazione(dati({ A1: '=1+1' }), 'csv')).toEqual([perdita]);
    expect(avvisiEsportazione(dati({ A1: '=' }), 'csv')).toEqual([]);
    expect(avvisiEsportazione(dati({ A1: 'x' }, { stili: { A1: { bold: true } } }), 'csv')).toEqual([perdita]);
    expect(avvisiEsportazione(dati({ A1: 'x' }, { stiliRiga: { 1: { bold: true } } }), 'csv')).toEqual([perdita]);
    expect(avvisiEsportazione(dati({ A1: 'x' }, { stiliColonna: { 1: { bold: true } } }), 'csv')).toEqual([perdita]);
    expect(avvisiEsportazione(dati({ A1: 'x' }, { unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }] }), 'csv')).toEqual([perdita]);
    const entrambi = documentoDaScambio({ fogli: [foglio('Uno', { celle: { A1: '=1' } }), foglio('Due')], foglioAttivo: 'Uno' });
    expect(avvisiEsportazione(entrambi, 'csv').length).toBe(2);
    const secondo = documentoDaScambio({ fogli: [foglio('Uno', { celle: { A1: '1' } }), foglio('Due', { celle: { A1: '=1' } })], foglioAttivo: 'Due' });
    expect(avvisiEsportazione(secondo, 'csv')[1]).toBe(perdita);
  });
});
