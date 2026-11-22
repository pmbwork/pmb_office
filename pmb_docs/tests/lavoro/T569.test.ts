// T569: riferimenti incrociati (Inserisci › Riferimento incrociato), in .docx come i campi REF di Word e in .odt come i rimandi di
// LibreOffice (text:bookmark-ref, text:sequence-ref). File di confronto in tests/file-prova/riferimenti/
// (LAVORO/studio-microsoft-office/word_riferimenti.py; il .odt è la conversione di LibreOffice).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, inserisciRiferimento, inserisciDidascalia, CAMPO_RIFERIMENTO, type Documento, type Stato } from '../../src/modello/documento';
import { conRiferimentiComeTesto, bersagliRiferimento, testoRiferimentoMancante } from '../../src/modello/riferimenti';
import { conDidascalieComeTesto } from '../../src/modello/didascalie';

const CARTELLA = 'tests/file-prova/riferimenti';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const testi = (d: Documento): string[] => conDidascalieComeTesto(conRiferimentiComeTesto(d)).paragrafi.map((p) => p.runs.map((r) => r.t).join('').trim()).filter((x) => x !== '');
const ATTESI = ['Introduzione', 'Un punto preciso', 'Figura 1: Prima', 'VediIntroduzione, Un punto preciso, Figura 1, Figura 1: Prima'];
const r = (t: string) => ({ t, g: false, c: false, s: false });
const al = (st: Stato, p: number, o: number): Stato => ({ ...st, sel: { ancora: { p, o }, fuoco: { p, o } } });

describe('T569: riferimenti incrociati', () => {
  test('dal .docx di Word e dal .odt di LibreOffice: titolo, segnalibro, «Figura 1» e tutta la didascalia', async () => {
    for (const n of ['riferimenti_word.docx', 'riferimenti_libreoffice.odt']) {
      if (!fs.existsSync(`${CARTELLA}/${n}`)) continue;
      const d = (await importa(leggi(n), n)).doc;
      expect(testi(d), n).toEqual(ATTESI);
      expect(d.paragrafi.flatMap((p) => p.runs).filter((x) => x.xr).map((x) => x.xm), n).toEqual(['t', 't', 'e', 't']);
    }
  });
  test('scritti da pmb_docs in .docx, .odt e .pdoc si rileggono; nel PDF e nel testo il testo del rimando', async () => {
    const d = (await importa(leggi('riferimenti_word.docx'), 'd.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/riferimenti_pmb.docx`, x);
    expect(testi((await importa(x, 'd.docx')).doc)).toEqual(ATTESI);
    const o = await esporta(d, 'odt');
    fs.writeFileSync(`${CARTELLA}/riferimenti_pmb.odt`, o);
    expect(testi((await importa(o, 'd.odt')).doc)).toEqual(ATTESI);
    expect(testi(deserializza(serializza(d)))).toEqual(ATTESI);
    expect(new TextDecoder().decode(await esporta(d, 'txt'))).toContain('Figura 1, Figura 1: Prima');
  });
  test('il rimando segue il bersaglio: una didascalia aggiunta prima cambia il numero; un titolo corretto cambia il testo; senza bersaglio, errore', () => {
    let st: Stato = { doc: { paragrafi: [{ runs: [r('Capitolo')], st: '1' }, { runs: [r('immagine')] }, { runs: [r('Vedi ')] }] }, sel: { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 0 } }, pendenti: null };
    st = inserisciDidascalia(st, 'Figura', 'Gatto');                      // paragrafo 2
    const b = bersagliRiferimento(st.doc);
    expect(b.map((x) => [x.tipo, x.testo, x.etichetta])).toEqual([['titolo', 'Capitolo', null], ['didascalia', 'Figura 1: Gatto', 'Figura 1']]);
    st = al(st, 3, 5);
    st = inserisciRiferimento(st, 2, 'e');
    st = inserisciRiferimento(st, 0, 't');
    expect(st.doc.paragrafi[2].sg).toMatch(/^_Ref/);
    expect(st.doc.paragrafi[0].sg).toMatch(/^_Ref/);
    expect(testi(st.doc)[3]).toBe('Vedi Figura 1Capitolo');
    // una didascalia prima della prima: quella del rimando diventa la 2
    st = al(st, 0, 0);
    st = inserisciDidascalia(st, 'Figura', 'Cane');
    expect(testi(st.doc).at(-1)).toBe('Vedi Figura 2Capitolo');
    // il titolo cambia testo
    st = { ...st, doc: { ...st.doc, paragrafi: st.doc.paragrafi.map((p, k) => (k === 0 ? { ...p, runs: [r('Capitolo primo')] } : p)) } };
    expect(testi(st.doc).at(-1)).toBe('Vedi Figura 2Capitolo primo');
    // il titolo perde il segnalibro: il rimando mostra l'errore
    st = { ...st, doc: { ...st.doc, paragrafi: st.doc.paragrafi.map((p, k) => (k === 0 ? { ...p, sg: undefined } : p)) } };
    expect(testi(st.doc).at(-1)).toBe(`Vedi Figura 2${testoRiferimentoMancante()}`);
    // nel .pdoc il riferimento è un carattere solo, con il segnalibro
    const rif = st.doc.paragrafi.flatMap((p) => p.runs).filter((x) => x.xr);
    expect(rif.every((x) => x.t === CAMPO_RIFERIMENTO)).toBe(true);
    expect(() => deserializza(serializza(st.doc))).not.toThrow();
  });
});
