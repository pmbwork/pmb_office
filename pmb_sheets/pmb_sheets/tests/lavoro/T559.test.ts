// T559: protezione di Fogli come in Excel e LibreOffice (sheet/protezione.ts, comune/protezione/impronte.ts): impronte delle password,
// celle bloccate e sbloccate, formula nascosta, foglio e struttura della cartella protetti; i passi della cronologia che la protezione
// non permette si respingono; .xlsx come Excel e .ods come LibreOffice. File di confronto in tests/file-prova/protezione/:
// excel-protezione.xlsx (fatto da Excel con LAVORO/studio-microsoft-office/excel_protezione.py: foglio «Dati» protetto con la password
// «Prova123», B2 sbloccata, A3 con la formula nascosta; struttura protetta con «Libro1») e libreoffice-protezione.ods (lo stesso
// convertito da LibreOffice, che non sa convertire le impronte di Excel e tiene la protezione senza password).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { improntaExcelVecchia, impronteNuove, sha512, verificaPassword } from '@comune/protezione/impronte';
import { leggiZip } from '@comune/formati/zip';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiOds } from '../../src/formati/ods-leggi';
import { scriviOds } from '../../src/formati/ods-scrivi';
import { documentoDaScambio, scambioDaDocumento, foglioVuoto, type Scambio } from '../../src/formati/scambio';
import { HistoryManager } from '../../src/sheet/history';
import { StyleRegistry, cellKey } from '../../src/sheet/styles';
import { cellaProtetta, motivoPasso, MOTIVO_CELLA, MOTIVO_FOGLIO, type ProtezioneFoglio } from '../../src/sheet/protezione';
import type { SheetDocument } from '../../src/sheet/document-store';

const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`tests/file-prova/protezione/${n}`));
const testo = async (b: Uint8Array, parte: string): Promise<string> => new TextDecoder().decode((await leggiZip(b)).get(parte)!);

/** Un documento finto con quello che serve alla protezione: foglio attivo «Dati» protetto, B2 sbloccata. */
function documento(protetto = true): SheetDocument {
  const protezione: ProtezioneFoglio | undefined = protetto ? {} : undefined;
  const registry = new StyleRegistry();
  const sb = registry.register({ sbloccata: true });
  return { activeSheetName: 'Dati', protezione, sheetStates: new Map(), styles: { registry, cellStyles: new Map([[cellKey(2, 2), sb]]), rowStyles: new Map(), colStyles: new Map() } } as unknown as SheetDocument;
}

describe('T559: impronte delle password', () => {
  test('SHA-512 come FIPS 180-4; l\'impronta di Excel del file di prova; la vecchia a 16 bit; quelle nuove si verificano', async () => {
    const vuoto = Array.from(sha512(new Uint8Array(0)), (x) => x.toString(16).padStart(2, '0')).join('');
    expect(vuoto).toBe('cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e');
    expect(improntaExcelVecchia('')).toBe('CE4B');
    const nuove = await impronteNuove('segreta', 1000);
    expect(nuove.map((i) => i.alg)).toEqual(['SHA-512', 'SHA-256']);
    expect(await verificaPassword('segreta', nuove)).toBe(true);
    expect(await verificaPassword('Segreta', nuove)).toBe(false);
    expect(await verificaPassword('qualsiasi', undefined)).toBe(true);
    expect(await verificaPassword('abc', [{ alg: 'legacy', hash: improntaExcelVecchia('abc') }])).toBe(true);
  });
});

describe('T559: che cosa si può cambiare con il foglio protetto', () => {
  test('solo il contenuto delle celle sbloccate: niente formato, niente struttura', () => {
    const doc = documento();
    expect(cellaProtetta(doc, 'Dati', 1, 1)).toBe(true);
    expect(cellaProtetta(doc, 'Dati', 2, 2)).toBe(false);
    expect(cellaProtetta(doc, 'Altro', 1, 1)).toBe(false);
    const cambia = (row: number, col: number) => ({ description: 'x', sheet: 'Dati', changes: [{ sheet: 'Dati', row, col, oldRaw: '', newRaw: '1' }] });
    expect(motivoPasso(doc, cambia(2, 2))).toBeNull();
    expect(motivoPasso(doc, cambia(1, 1))).toBe(MOTIVO_CELLA);
    expect(motivoPasso(doc, { description: 'Grassetto', sheet: 'Dati', styleChanges: [{ type: 'cell', target: '2,2', oldStyleId: 0, newStyleId: 3 }] })).toBe(MOTIVO_FOGLIO);
    expect(motivoPasso(doc, { description: 'Inserisci riga', sheet: 'Dati', undoAction: async () => {} })).toBe(MOTIVO_FOGLIO);
    expect(motivoPasso(documento(false), cambia(1, 1))).toBeNull();
  });
  test('la cronologia chiama chi respinge il passo, che poi lo annulla senza lasciarlo da ripetere', () => {
    const doc = documento();
    const h = new HistoryManager();
    const respinti: string[] = [];
    h.guardiano = (p) => motivoPasso(doc, p);
    h.rifiutato = (m) => { respinti.push(m); h.popUndo(); h.scartaUltimoRipeti(); };
    h.pushStep({ description: 'ok', sheet: 'Dati', changes: [{ sheet: 'Dati', row: 2, col: 2, oldRaw: '', newRaw: 'a' }] });
    h.pushStep({ description: 'no', sheet: 'Dati', changes: [{ sheet: 'Dati', row: 1, col: 1, oldRaw: '', newRaw: 'b' }] });
    expect(respinti).toEqual([MOTIVO_CELLA]);
    expect([h.getUndoCount(), h.getRedoCount()]).toEqual([1, 0]);
  });
});

describe('T559: .xlsx come Excel e .ods come LibreOffice', () => {
  test('il file di Excel: foglio e struttura protetti con le loro password, B2 sbloccata, A3 con la formula nascosta', async () => {
    const { scambio } = await leggiXlsx(leggi('excel-protezione.xlsx'));
    const dati = scambio.fogli.find((f) => f.nome === 'Dati')!;
    expect(dati.protezione?.impronte?.[0].alg).toBe('SHA-512');
    expect(await verificaPassword('Prova123', dati.protezione!.impronte)).toBe(true);
    expect(await verificaPassword('prova123', dati.protezione!.impronte)).toBe(false);
    expect(scambio.fogli.find((f) => f.nome === 'Altro')!.protezione).toBeUndefined();
    expect(await verificaPassword('Libro1', scambio.protezioneCartella!.impronte)).toBe(true);
    expect(dati.stili.B2).toMatchObject({ sbloccata: true });
    expect(dati.stili.A3).toMatchObject({ formulaNascosta: true });
    // attraverso il documento e ritorno (stato per foglio, file nativo)
    const ritorno = scambioDaDocumento(documentoDaScambio(scambio));
    expect(ritorno.fogli.find((f) => f.nome === 'Dati')!.protezione).toEqual(dati.protezione);
    expect(ritorno.protezioneCartella).toEqual(scambio.protezioneCartella);
  });
  test('scritto da pmb_sheets in .xlsx come Excel (SHA-512, protection nelle celle) e riletto uguale', async () => {
    const impronte = await impronteNuove('Prova123', 1000);
    const f = { ...foglioVuoto('Dati'), celle: { A1: 'x', B2: 'y' }, stili: { B2: { sbloccata: true }, A3: { formulaNascosta: true } }, protezione: { impronte } };
    const s: Scambio = { fogli: [f, foglioVuoto('Altro')], foglioAttivo: 'Dati', protezioneCartella: {} };
    const b = await scriviXlsx(s);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T559.xlsx'), b);
    const foglio = await testo(b, 'xl/worksheets/sheet1.xml');
    expect(foglio).toMatch(/<sheetProtection algorithmName="SHA-512" hashValue="[^"]+" saltValue="[^"]+" spinCount="1000" sheet="1" objects="1" scenarios="1"\/>/);
    expect(await testo(b, 'xl/worksheets/sheet2.xml')).not.toContain('sheetProtection');
    expect(await testo(b, 'xl/workbook.xml')).toContain('<workbookProtection lockStructure="1"/>');
    const stili = await testo(b, 'xl/styles.xml');
    expect(stili).toContain('applyProtection="1"><protection locked="0"/></xf>');
    expect(stili).toContain('<protection hidden="1"/>');
    const r = (await leggiXlsx(b)).scambio;
    expect(await verificaPassword('Prova123', r.fogli[0].protezione!.impronte)).toBe(true);
    expect(r.protezioneCartella).toEqual({});
    expect(r.fogli[0].stili.B2).toMatchObject({ sbloccata: true });
  });
  test('.ods: scritto come LibreOffice (table:protected, chiave SHA-256, cell-protect) e riletto; il file di LibreOffice si legge', async () => {
    const impronte = await impronteNuove('Prova123', 1000);
    const f = { ...foglioVuoto('Dati'), celle: { A1: 'x', B2: 'y' }, stili: { B2: { sbloccata: true } }, protezione: { impronte } };
    const b = await scriviOds({ fogli: [f], foglioAttivo: 'Dati', protezioneCartella: { impronte } });
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T559.ods'), b);
    const c = await testo(b, 'content.xml');
    expect(c).toMatch(/<table:table table:name="Dati"[^>]* table:protected="true" table:protection-key="[^"]+" table:protection-key-digest-algorithm="http:\/\/www.w3.org\/2000\/09\/xmldsig#sha256"/);
    expect(c).toContain('table:structure-protected="true"');
    expect(c).toContain('style:cell-protect="none"');
    const r = (await leggiOds(b)).scambio;
    expect(await verificaPassword('Prova123', r.fogli[0].protezione!.impronte)).toBe(true);
    expect(await verificaPassword('Prova123', r.protezioneCartella!.impronte)).toBe(true);
    expect(r.fogli[0].stili.B2).toMatchObject({ sbloccata: true });
    const lo = (await leggiOds(leggi('libreoffice-protezione.ods'))).scambio;
    const dati = lo.fogli.find((x) => x.nome === 'Dati')!;
    expect(dati.protezione).toEqual({});
    expect(dati.stili.B2).toMatchObject({ sbloccata: true });
    expect(dati.stili.A3 ?? dati.stili.A1).toBeDefined();
  });
});
