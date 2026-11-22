// T567: sottolineato doppio e maiuscoletto (Formato › Testo, Ctrl+Maiusc+D e Ctrl+Maiusc+K come Word), in .docx come Word (w:u double,
// w:smallCaps) e in .odt come LibreOffice (text-underline-type double, font-variant small-caps). File in tests/file-prova/formati/.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, type Documento } from '../../src/modello/documento';
import { azioneDaTastoFormato } from '../../src/editor/azioni-formato';

const CARTELLA = 'tests/file-prova/formati';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const segni = (d: Documento): Array<[string, string | undefined, string | undefined]> => d.paragrafi[0].runs.filter((r) => r.t.trim() !== '').map((r) => [r.t.trim(), r.w, r.q]);
const ATTESO: Array<[string, string | undefined, string | undefined]> = [['doppio', 'd', undefined], ['maiuscoletto', undefined, 'm']];

describe('T567: sottolineato doppio e maiuscoletto', () => {
  test('dal .docx di Word e dal .odt di LibreOffice', async () => {
    expect(segni((await importa(leggi('formati_word.docx'), 'f.docx')).doc)).toEqual(ATTESO);
    expect(segni((await importa(leggi('formati_libreoffice.odt'), 'f.odt')).doc)).toEqual(ATTESO);
  });
  test('scritti da pmb_docs in .docx, .odt e .pdoc si rileggono', async () => {
    const d = (await importa(leggi('formati_word.docx'), 'f.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/formati_pmb.docx`, x);
    expect(segni((await importa(x, 'f.docx')).doc)).toEqual(ATTESO);
    expect(segni((await importa(await esporta(d, 'odt'), 'f.odt')).doc)).toEqual(ATTESO);
    expect(segni(deserializza(serializza(d)))).toEqual(ATTESO);
  });
  test('Ctrl+Maiusc+D e Ctrl+Maiusc+K', () => {
    const tasto = (key: string) => azioneDaTastoFormato({ key, code: `Key${key.toUpperCase()}`, ctrlKey: true, shiftKey: true, altKey: false, metaKey: false });
    expect(tasto('D')).toEqual({ tipo: 'alterna', chiave: 'w', valore: 'd' });
    expect(tasto('K')).toEqual({ tipo: 'alterna', chiave: 'q', valore: 'm' });
  });
});

describe('T567: Inserisci › Data e ora', () => {
  test('i formati in italiano e in inglese', async () => {
    const { formatiDataOra } = await import('../../src/modello/data-ora');
    const d = new Date(2026, 10, 21, 9, 5);
    expect(formatiDataOra(d)).toEqual(['21/11/2026', '21 novembre 2026', 'sabato 21 novembre 2026', '21/11/26', '2026-11-21', '09:05', '21/11/2026 09:05']);
    expect(formatiDataOra(d, true)).toEqual(['11/21/2026', 'November 21, 2026', 'Saturday, November 21, 2026', '21 November 2026', '2026-11-21', '09:05', '11/21/2026 09:05']);
  });
});
