// T567: Nascondi e mostra foglio. File di confronto in tests/file-prova/fogli-nascosti/ (Excel: Uno visibile, Due nascosto, Tre attivo;
// LAVORO/studio-microsoft-office/excel_fogli_nascosti.py; il .ods è la conversione di LibreOffice).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiOds } from '../../src/formati/ods-leggi';
import { scriviOds } from '../../src/formati/ods-scrivi';
import { documentoDaScambio, scambioDaDocumento, foglioVuoto } from '../../src/formati/scambio';

const CARTELLA = 'tests/file-prova/fogli-nascosti';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const vis = (s: { fogli: Array<{ nome: string; nascosto?: boolean }> }): Array<[string, boolean]> => s.fogli.map((f) => [f.nome, f.nascosto === true]);
const ATTESO: Array<[string, boolean]> = [['Uno', false], ['Due', true], ['Tre', false]];

describe('T567: fogli nascosti', () => {
  test('.xlsx di Excel e .ods di LibreOffice: Due resta nascosto, senza avviso', async () => {
    const x = await leggiXlsx(leggi('fogli_nascosti_excel.xlsx'));
    expect(vis(x.scambio)).toEqual(ATTESO);
    expect(x.scambio.foglioAttivo).toBe('Tre');
    expect(x.avvisi.join(' ')).not.toContain('nascosto');
    const o = await leggiOds(leggi('fogli_nascosti_libreoffice.ods'));
    expect(vis(o.scambio)).toEqual(ATTESO);
  });
  test('attraverso il documento e di nuovo nei file: si conserva', async () => {
    const s = (await leggiXlsx(leggi('fogli_nascosti_excel.xlsx'))).scambio;
    const di = scambioDaDocumento(documentoDaScambio(s));
    expect(vis(di)).toEqual(ATTESO);
    const xb = await scriviXlsx(di);
    fs.writeFileSync(`${CARTELLA}/fogli_nascosti_pmb.xlsx`, xb);
    expect(vis((await leggiXlsx(xb)).scambio)).toEqual(ATTESO);
    expect(vis((await leggiOds(await scriviOds(di))).scambio)).toEqual(ATTESO);
  });
  test('il foglio attivo è sempre visibile; se sono tutti nascosti il primo si mostra', () => {
    const a = foglioVuoto('A'), b = foglioVuoto('B');
    a.nascosto = true;
    expect(documentoDaScambio({ fogli: [a, b], foglioAttivo: 'A' }).activeSheetName).toBe('B');
    b.nascosto = true;
    const d = documentoDaScambio({ fogli: [a, b], foglioAttivo: 'B' });
    expect(d.activeSheetName).toBe('A');
    expect(d.nascosto).toBeFalsy();
  });
});
