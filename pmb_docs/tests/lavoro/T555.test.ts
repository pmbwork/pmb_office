// T555: sommario e struttura del documento (modello/sommario.ts), salvati in .pdoc e in .docx come li scrive Word; lettura del sommario di un
// documento fatto da Word (tests/file-prova/revisioni/word-sommario.docx, da LAVORO/studio-microsoft-office/word_sommario.py). Il .docx
// scritto si lascia in tmp/pmb-T555.docx per riaprirlo in Word con lo stesso script.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { deserializza, elencoSegnalibri, serializza, statoIniziale, testoDi, type Documento, type Paragrafo } from '../../src/modello/documento';
import { aggiornaSommario, blocchiSommario, destinazioneVoce, inserisciSommario, strutturaDocumento, titoloCorrente } from '../../src/modello/sommario';

const par = (t: string, st?: Paragrafo['st']): Paragrafo => ({ ...(st ? { st } : {}), runs: t === '' ? [] : [{ t, g: false, c: false, s: false }] });
const DOC: Documento = { paragrafi: [par(''), par('Introduzione', '1'), par('testo'), par('Dettagli', '2'), par('altro'), par('Nota', '3'), par('Fine', '1'), par('ultimo')] };
const voci = (d: Documento) => d.paragrafi.filter((p) => p.sm).map((p) => [p.sm!.l, p.runs.map((r) => r.t).join(''), destinazioneVoce(d, p.sm!.n)]);

describe('T555: sommario nel modello', () => {
  test('inserisci al posto del paragrafo vuoto, voci con livello e titolo, segnalibri interni nascosti', () => {
    const st = inserisciSommario(statoIniziale(DOC))!;
    expect(voci(st.doc)).toEqual([[1, 'Introduzione', 5], [2, 'Dettagli', 7], [3, 'Nota', 9], [1, 'Fine', 10]]);
    expect(st.doc.paragrafi[4].runs).toEqual([]);            // un paragrafo vuoto dopo il sommario, dove va il cursore
    expect(st.sel.fuoco).toEqual({ p: 4, o: 0 });
    expect(st.doc.paragrafi[5].sg).toMatch(/^_Toc\d{8}$/);
    expect(elencoSegnalibri(st.doc)).toEqual([]);             // i segnalibri «_…» non si elencano
    expect(deserializza(serializza(st.doc))).toEqual(JSON.parse(JSON.stringify(st.doc)));
    // aggiornato dopo aver cambiato un titolo e aggiunto un altro
    const cambiato: Documento = { ...st.doc, paragrafi: st.doc.paragrafi.map((p, i) => (i === 7 ? par('Dettagli nuovi', '2') : p)).concat([par('Appendice', '1')]) };
    const nuovo = aggiornaSommario(cambiato);
    expect(voci(nuovo).map((v) => v[1])).toEqual(['Introduzione', 'Dettagli nuovi', 'Nota', 'Fine', 'Appendice']);
    expect(blocchiSommario(nuovo)).toEqual([[0, 5]]);
    expect(aggiornaSommario(DOC)).toBe(DOC);
    expect(inserisciSommario(statoIniziale({ paragrafi: [par('niente titoli')] }))).toBeNull();
  });
  test('struttura e titolo della sezione del cursore', () => {
    expect(strutturaDocumento(DOC).map((v) => [v.livello, v.testo])).toEqual([[1, 'Introduzione'], [2, 'Dettagli'], [3, 'Nota'], [1, 'Fine']]);
    expect(titoloCorrente(DOC, 4)).toBe(3);
    expect(titoloCorrente(DOC, 0)).toBeNull();
  });
});

describe('T555: .docx come Word', () => {
  test('il sommario di Word (senza collegamenti: il titolo è nel campo PAGEREF) si legge come sommario di pmb_docs', async () => {
    const d = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/word-sommario.docx')));
    const v = voci(d);
    expect(v.map((x) => [x[0], x[1]])).toEqual([[1, 'Introduzione'], [2, 'Dettagli'], [1, 'Ultima sezione'], [3, 'Nota tecnica']]);
    expect(v.every((x) => x[2] !== null)).toBe(true);        // ogni voce trova il suo titolo
    expect(strutturaDocumento(d).map((x) => x.testo)).toEqual(['Introduzione', 'Dettagli', 'Ultima sezione', 'Nota tecnica']);
  });
  test('scritto da pmb_docs e riletto: stesso sommario, stessi titoli', async () => {
    const st = inserisciSommario(statoIniziale(DOC))!;
    const bytes = await esportaDocx(st.doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T555.docx'), bytes);
    const r = await importaDocx(bytes);
    expect(voci(r)).toEqual(voci(st.doc));
    expect(testoDi(r)).toBe(testoDi(st.doc));
    const xml = new TextDecoder().decode(bytes);
    expect(xml.includes('settings.xml')).toBe(true);           // Word aggiorna i campi all'apertura
  });
});
