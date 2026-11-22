// T564: colonne del documento, interruzione di colonna e caratteri non divisibili (spazio, trattino, trattino facoltativo), in .docx
// come Word e in .odt come LibreOffice. File di confronto in tests/file-prova/colonne/ (LAVORO/studio-microsoft-office/word_colonne.py;
// il .odt è la conversione di LibreOffice).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, inserisciSaltoColonna, type Documento } from '../../src/modello/documento';

const CARTELLA = 'tests/file-prova/colonne';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const testo = (d: Documento): string[] => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));

function controlla(d: Documento): void {
  expect(d.colonne).toBe(2);
  const t = testo(d);
  const i = t.indexOf('Seconda colonna');
  expect(i).toBeGreaterThan(0);
  expect(d.paragrafi[i].sc).toBe(true);
  expect(t.join('\n')).toContain('art.\u00a05 e\u2011mail para\u00adgrafo');
}

describe('T564: colonne e caratteri non divisibili', () => {
  test('il .docx di Word', async () => { controlla((await importa(leggi('colonne_word.docx'), 'c.docx')).doc); });
  test('il .odt di LibreOffice (colonne in una sezione)', async () => { controlla((await importa(leggi('colonne_libreoffice.odt'), 'c.odt')).doc); });
  test('scritti da pmb_docs e riletti: .docx (w:cols, w:br column, w:noBreakHyphen, w:softHyphen), .odt e .pdoc', async () => {
    const d = (await importa(leggi('colonne_word.docx'), 'c.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/colonne_pmb.docx`, x);
    controlla((await importa(x, 'c.docx')).doc);
    const o = await esporta(d, 'odt');
    fs.writeFileSync(`${CARTELLA}/colonne_pmb.odt`, o);
    controlla((await importa(o, 'c.odt')).doc);
    controlla(deserializza(serializza(d)));
  });
  test('Ctrl+Maiusc+Invio: il testo dopo il cursore va nella colonna dopo', () => {
    const st = inserisciSaltoColonna({ doc: { paragrafi: [{ runs: [{ t: 'unodue', g: false, c: false, s: false }] }] }, sel: { ancora: { p: 0, o: 3 }, fuoco: { p: 0, o: 3 } }, pendenti: null });
    expect(testo(st.doc)).toEqual(['uno', 'due']);
    expect([st.doc.paragrafi[0].sc, st.doc.paragrafi[1].sc]).toEqual([undefined, true]);
  });
});
