// T553: commenti e modifiche registrate (revisioni) in pmb_docs: modello (modello/revisioni.ts), salvataggio .pdoc, lettura del .docx
// fatto da Word (tests/file-prova/revisioni/word-commenti.docx, creato da LAVORO/studio-microsoft-office/word_revisioni.py) e scrittura
// del .docx (il file scritto si lascia in tmp/pmb-T553.docx per riaprirlo in Word con lo stesso script).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { daTesto, deserializza, serializza, statoIniziale, testoDi, type Documento, type Stato } from '../../src/modello/documento';
import {
  aggiungiCommento, alternaRegistrazione, cancellaConRevisione, elencoCommenti, elencoRevisioni, eliminaCommento, inserisciConRevisione,
  prossimaRevisione, rispondiCommento, risolviCommento, risolviRevisioni, versioneFinale,
} from '../../src/modello/revisioni';
import { eseguiAzione, nuovoEditor } from '../../src/editor/azioni';

const DATA = '2026-11-20T10:00:00Z';
const testoCon = (doc: Documento, f: (r: Documento['paragrafi'][number]['runs'][number]) => boolean): string =>
  doc.paragrafi.map((p) => p.runs.filter(f).map((r) => r.t).join('')).filter((x) => x !== '').join('|');
const sel = (p: number, da: number, a: number): Stato['sel'] => ({ ancora: { p, o: da }, fuoco: { p, o: a } });

describe('T553: commenti nel modello', () => {
  test('aggiungi, rispondi, risolvi, elimina; il commento segue il testo e sparisce con lui', () => {
    let st: Stato = { ...statoIniziale(daTesto('Una frase da commentare.\nAltra riga')), sel: sel(0, 4, 9) };
    const r = aggiungiCommento(st, '  Va bene?  ', 'Anna', DATA)!;
    expect(r.id).toBe('1');
    st = r.stato;
    expect(testoCon(st.doc, (x) => x.cm === '1')).toBe('frase');
    let doc = rispondiCommento(st.doc, '1', 'Sì', 'Bruno', DATA);
    doc = risolviCommento(doc, '1', true);
    expect(elencoCommenti(doc)).toEqual([{ id: '1', a: 'Anna', d: DATA, t: 'Va bene?', ok: true, r: [{ a: 'Bruno', d: DATA, t: 'Sì' }], p: 0, o: 4, ancorato: 'frase' }]);
    // con il solo cursore si commenta la parola
    const w = aggiungiCommento({ ...st, doc, sel: sel(1, 2, 2) }, 'parola', 'Anna', DATA)!;
    expect(testoCon(w.stato.doc, (x) => x.cm === '2')).toBe('Altra');
    // salvato e riletto in .pdoc
    expect(deserializza(serializza(w.stato.doc))).toEqual(JSON.parse(JSON.stringify(w.stato.doc)));
    // eliminato: il testo resta senza commento
    const senza = eliminaCommento(w.stato.doc, '1');
    expect(elencoCommenti(senza).map((c) => c.id)).toEqual(['2']);
    expect(testoDi(senza)).toBe('Una frase da commentare.\nAltra riga');
    // testo commentato cancellato tutto: il commento non conta più (non si salva)
    const ed = eseguiAzione({ ...nuovoEditor({ ...w.stato, sel: sel(1, 0, 5) }) }, { tipo: 'cancella', direzione: 'indietro', parola: false }).ed;
    expect(elencoCommenti(ed.storia.presente.doc).map((c) => c.id)).toEqual(['1']);
    expect(JSON.parse(serializza(ed.storia.presente.doc)).cm.map((c: { id: string }) => c.id)).toEqual(['1']);
    // scrivere dentro il testo commentato lo allarga; ai bordi no
    const dentro = eseguiAzione(nuovoEditor({ ...w.stato, sel: sel(0, 6, 6) }), { tipo: 'testo', testo: 'X' }).ed.storia.presente.doc;
    expect(testoCon(dentro, (x) => x.cm === '1')).toBe('frXase');
    const bordo = eseguiAzione(nuovoEditor({ ...w.stato, sel: sel(0, 9, 9) }), { tipo: 'testo', testo: 'Y' }).ed.storia.presente.doc;
    expect(testoCon(bordo, (x) => x.cm === '1')).toBe('frase');
    expect(aggiungiCommento(st, '   ', 'Anna')).toBeNull();
  });
});

describe('T553: modifiche registrate nel modello e nell\'editor', () => {
  test('con la registrazione accesa: scritto = inserito, cancellato = segnato; il proprio inserito cancellato sparisce', () => {
    let st: Stato = { ...statoIniziale(alternaRegistrazione(daTesto('Testo di prova'))), sel: sel(0, 5, 5) };
    expect(st.doc.revisioni).toBe(true);
    st = inserisciConRevisione(st, ' nuovo', 'Anna', DATA);
    expect(testoDi(st.doc)).toBe('Testo nuovo di prova');
    expect(testoCon(st.doc, (r) => r.rv?.t === 'i')).toBe(' nuovo');
    // Backspace sul proprio testo inserito: sparisce davvero
    st = cancellaConRevisione(st, 'indietro', false, 'Anna', DATA);
    expect(testoDi(st.doc)).toBe('Testo nuov di prova');
    // Backspace su testo vecchio: resta, segnato come cancellato, e il cursore va prima
    st = { ...st, sel: sel(0, 19, 19) };
    st = cancellaConRevisione(st, 'indietro', true, 'Anna', DATA);
    expect(testoDi(st.doc)).toBe('Testo nuov di prova');
    expect(testoCon(st.doc, (r) => r.rv?.t === 'd')).toBe('prova');
    expect(st.sel.fuoco).toEqual({ p: 0, o: 14 });
    // un altro autore che cancella il testo inserito da Anna lo segna come cancellato
    const b = cancellaConRevisione({ ...st, sel: sel(0, 6, 10) }, 'indietro', false, 'Bruno', DATA);
    expect(testoCon(b.doc, (r) => r.rv?.t === 'd' && r.rv.a === 'Bruno')).toBe('nuov');
    // elenco e navigazione
    expect(elencoRevisioni(st.doc).map((v) => [v.tipo, v.testo])).toEqual([['i', ' nuov'], ['d', 'prova']]);
    expect(prossimaRevisione(st.doc, { p: 0, o: 0 }, 1)).toEqual(sel(0, 5, 10));
    expect(prossimaRevisione(st.doc, { p: 0, o: 11 }, 1)).toEqual(sel(0, 14, 19));
    // accetta e rifiuta: una (al cursore) o tutte
    expect(testoDi(risolviRevisioni(st.doc, true, sel(0, 15, 15)))).toBe('Testo nuov di ');
    expect(testoDi(risolviRevisioni(st.doc, false))).toBe('Testo di prova');
    expect(testoDi(risolviRevisioni(st.doc, true))).toBe('Testo nuov di ');
    expect(elencoRevisioni(risolviRevisioni(st.doc, true))).toEqual([]);
    // versione finale per i formati che non conoscono le revisioni
    expect(testoDi(versioneFinale(st.doc))).toBe('Testo nuov di ');
    // .pdoc
    expect(deserializza(serializza(st.doc))).toEqual(JSON.parse(JSON.stringify(st.doc)));
  });
  test('l\'editor registra con il nome dell\'autore; spenta la registrazione si scrive normalmente', () => {
    let ed = { ...nuovoEditor({ ...statoIniziale(alternaRegistrazione(daTesto('abc'))), sel: sel(0, 3, 3) }), autore: 'Carla' };
    ed = eseguiAzione(ed, { tipo: 'testo', testo: 'd' }).ed;
    ed = eseguiAzione(ed, { tipo: 'testo', testo: 'e' }).ed;
    expect(ed.storia.presente.doc.paragrafi[0].runs.map((r) => [r.t, r.rv?.a ?? ''])).toEqual([['abc', ''], ['de', 'Carla']]);
    expect(ed.autore).toBe('Carla');
    ed = eseguiAzione(ed, { tipo: 'muovi', mossa: 'inizioParagrafo', estendi: false }).ed;
    ed = eseguiAzione(ed, { tipo: 'cancella', direzione: 'avanti', parola: false }).ed;
    expect(testoCon(ed.storia.presente.doc, (r) => r.rv?.t === 'd')).toBe('a');
    const spenta = { ...nuovoEditor({ ...statoIniziale(daTesto('abc')), sel: sel(0, 3, 3) }), autore: 'Carla' };
    expect(eseguiAzione(spenta, { tipo: 'testo', testo: 'd' }).ed.storia.presente.doc.paragrafi[0].runs).toEqual([{ t: 'abcd', g: false, c: false, s: false }]);
  });
});

describe('T553: .docx come Word', () => {
  test('il documento di Word: commenti con risposta e risolto, testo inserito e cancellato, registrazione accesa', async () => {
    const doc = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/word-commenti.docx')));
    const c = elencoCommenti(doc);
    expect(c.map((x) => [x.a, x.t, x.ancorato, x.ok === true, (x.r ?? []).map((r) => [r.a, r.t])])).toEqual([
      ['Anna Rossi', 'Questa frase va bene?', 'parola commentata', false, [['Bruno Verdi', 'Sì, va bene così.']]],
      ['Anna Rossi', 'Già sistemato.', 'Terzo', true, []],
    ]);
    expect(elencoRevisioni(doc).map((v) => [v.tipo, v.autore, v.testo])).toEqual([['d', 'Bruno Verdi', 'da rivedere '], ['i', 'Bruno Verdi', ' e attenzione']]);
    expect(doc.revisioni).toBe(true);
    expect(testoDi(versioneFinale(doc))).toBe('Primo paragrafo con una parola commentata.\nSecondo paragrafo con calma e attenzione.\nTerzo paragrafo.');
  });
  test('scritto da pmb_docs e riletto: gli stessi commenti e modifiche', async () => {
    const originale = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/word-commenti.docx')));
    const bytes = await esportaDocx(originale);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T553.docx'), bytes);
    const riletto = await importaDocx(bytes);
    const senzaId = (d: Documento) => elencoCommenti(d).map(({ id, ...resto }) => { void id; return resto; });
    expect(senzaId(riletto)).toEqual(senzaId(originale));
    expect(elencoRevisioni(riletto)).toEqual(elencoRevisioni(originale));
    expect(riletto.revisioni).toBe(true);
    expect(testoDi(riletto)).toBe(testoDi(originale));
  });
  test('un commento che prende due paragrafi, e un documento senza niente non scrive le parti dei commenti', async () => {
    let st: Stato = { ...statoIniziale(daTesto('Uno due\ntre quattro')), sel: { ancora: { p: 0, o: 4 }, fuoco: { p: 1, o: 3 } } };
    st = aggiungiCommento(st, 'Su due righe', 'Anna', DATA)!.stato;
    const riletto = await importaDocx(await esportaDocx(st.doc));
    expect(elencoCommenti(riletto).map((x) => [x.t, testoCon(riletto, (r) => r.cm === x.id)])).toEqual([['Su due righe', 'due|tre']]);
    const vuoto = new TextDecoder().decode(await esportaDocx(daTesto('niente')));
    expect(vuoto.includes('comments.xml')).toBe(false);
    expect(vuoto.includes('settings.xml')).toBe(false);
  });
});

describe('T553: .odt come LibreOffice', () => {
  const senzaZ = (d: Documento) => elencoCommenti(d).map((c) => ({ a: c.a, d: c.d.replace(/Z$/, ''), t: c.t, ok: c.ok === true, ancorato: c.ancorato, r: (c.r ?? []).map((r) => ({ a: r.a, t: r.t })) }));
  const modifiche = (d: Documento) => elencoRevisioni(d).map((v) => [v.tipo, v.autore, v.testo]);
  test('il documento di Word convertito da LibreOffice: risposta scritta prima del commento, modifiche nella regione', async () => {
    const { importaOdt } = await import('../../src/formati/odt');
    const word = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/word-commenti.docx')));
    const lo = await importaOdt(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/libreoffice-commenti.odt')));
    expect(senzaZ(lo)).toEqual(senzaZ(word));
    expect(modifiche(lo)).toEqual(modifiche(word));
    expect(testoDi(versioneFinale(lo))).toBe(testoDi(versioneFinale(word)));
  });
  test('scritto da pmb_docs e riletto', async () => {
    const { importaOdt, esportaOdt } = await import('../../src/formati/odt');
    const word = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/revisioni/word-commenti.docx')));
    const bytes = await esportaOdt(word);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T553.odt'), bytes);
    const riletto = await importaOdt(bytes);
    expect(senzaZ(riletto)).toEqual(senzaZ(word));
    expect(modifiche(riletto)).toEqual(modifiche(word));
    expect(riletto.revisioni).toBe(true);
  });
});
