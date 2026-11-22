// T568: didascalie numerate (Inserisci › Didascalia), in .docx come i campi SEQ di Word e in .odt come le sequenze di LibreOffice.
// File di confronto in tests/file-prova/didascalie/ (LAVORO/studio-microsoft-office/word_didascalie.py; il .odt è la conversione di LibreOffice).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, inserisciDidascalia, type Documento } from '../../src/modello/documento';
import { conDidascalieComeTesto, numeriDidascalie } from '../../src/modello/didascalie';

const CARTELLA = 'tests/file-prova/didascalie';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const testi = (d: Documento): string[] => conDidascalieComeTesto(d).paragrafi.map((p) => p.runs.map((r) => r.t).join('')).filter((x) => x.trim() !== '');

describe('T568: didascalie', () => {
  test('dal .docx di Word e dal .odt di LibreOffice: «Figura 1: Prima», «Figura 2: Seconda»', async () => {
    for (const n of ['didascalie_word.docx', 'didascalie_libreoffice.odt']) {
      const d = (await importa(leggi(n), n)).doc;
      expect(testi(d), n).toEqual(['Testo', 'Figura 1: Prima', 'Figura 2: Seconda']);
      expect(d.paragrafi.flatMap((p) => p.runs).filter((r) => r.sq).map((r) => r.sq), n).toEqual(['Figura', 'Figura']);
    }
  });
  test('scritte da pmb_docs in .docx, .odt e .pdoc si rileggono; nel PDF e nel testo il numero', async () => {
    const d = (await importa(leggi('didascalie_word.docx'), 'd.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/didascalie_pmb.docx`, x);
    expect(testi((await importa(x, 'd.docx')).doc)).toEqual(['Testo', 'Figura 1: Prima', 'Figura 2: Seconda']);
    expect(testi((await importa(await esporta(d, 'odt'), 'd.odt')).doc)).toEqual(['Testo', 'Figura 1: Prima', 'Figura 2: Seconda']);
    expect(testi(deserializza(serializza(d)))).toEqual(['Testo', 'Figura 1: Prima', 'Figura 2: Seconda']);
    expect(new TextDecoder().decode(await esporta(d, 'txt'))).toContain('Figura 2: Seconda');
  });
  test('il numero si ricalcola: una didascalia inserita prima diventa la 1 e le altre scalano; le serie contano a sé', () => {
    const r = (t: string) => ({ t, g: false, c: false, s: false });
    let st = { doc: { paragrafi: [{ runs: [r('uno')] }, { runs: [r('due')] }] } as Documento, sel: { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 0 } }, pendenti: null };
    st = inserisciDidascalia(st, 'Figura', 'Dopo due');
    st = { ...st, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } } };
    st = inserisciDidascalia(st, 'Figura', 'Dopo uno');
    st = { ...st, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } } };
    st = inserisciDidascalia(st, 'Tabella', 'Prima di uno', true);
    expect(testi(st.doc)).toEqual(['Tabella 1: Prima di uno', 'uno', 'Figura 1: Dopo uno', 'due', 'Figura 2: Dopo due']);
    expect([...numeriDidascalie(st.doc.paragrafi).values()]).toEqual([1, 1, 2]);
    expect(st.doc.paragrafi[0].runs.every((x) => x.c)).toBe(true);
  });
});
