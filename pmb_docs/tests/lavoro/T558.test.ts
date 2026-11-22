// T558: immagini con il testo intorno (a sinistra, a destra), sostituite dopo una rotazione o un ritaglio, e le immagini nei file .odt
// (prima non si scrivevano né si leggevano). File di confronto: tests/file-prova/immagini/word-immagini.docx (fatto da Word con
// LAVORO/studio-microsoft-office/word_immagini.py: una in linea, una a sinistra e una a destra con il testo a riquadro) e
// libreoffice-immagini.odt (lo stesso convertito da LibreOffice). I file scritti restano in tmp/pmb-T558.docx e .odt.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { importaOdt, esportaOdt } from '../../src/formati/odt';
import { disegna } from '../../src/editor/render';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor } from '../../src/editor/azioni';
import { deserializza, impostaDisposizioneImmagine, OGGETTO, serializza, sostituisciImmagine, type Documento, type Immagine, type Stato } from '../../src/modello/documento';
import { contiRitaglio, misureDopo, ritaglioValido } from '../../src/guscio/immagine-trasforma';
import { popupImmagine } from '../../src/guscio/immagine-dati';

// PNG 2×1 (rosso, verde)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DA8J8BAAf/Af8Bf4mnAAAAAElFTkSuQmCC';
const im = (extra: Partial<Immagine> = {}): Immagine => ({ s: PNG, w: 200, h: 100, ...extra });
const doc = (x: Immagine): Documento => ({ paragrafi: [{ runs: [{ t: 'Prima ', g: false, c: false, s: false }, { t: OGGETTO, g: false, c: false, s: false, im: x, u: 'https://example.com/' }, { t: ' testo accanto all\'immagine.', g: false, c: false, s: false }] }] });
const selezionata = (d: Documento): Stato => ({ doc: d, sel: { ancora: { p: 0, o: 6 }, fuoco: { p: 0, o: 7 } }, pendenti: null });
const immagini = (d: Documento): Immagine[] => d.paragrafi.flatMap((p) => p.runs.filter((r) => r.im).map((r) => r.im!));

describe('T558: testo intorno e immagini sostituite', () => {
  test('a sinistra, a destra, di nuovo in linea: dal menu Formato › Immagine, con la spunta', () => {
    const s = selezionata(doc(im()));
    const sx = impostaDisposizioneImmagine(s, 'sx');
    expect(immagini(sx.doc)[0]).toEqual(im({ a: 'sx' }));
    expect(sx.doc.paragrafi[0].runs[1].u).toBe('https://example.com/');        // il link resta
    expect(sx.sel).toEqual(s.sel);
    expect(impostaDisposizioneImmagine(sx, 'sx')).toBe(sx);
    const ed = nuovoEditor(sx);
    const dx = eseguiAzioneFormato(ed, { tipo: 'disposizioneImmagine', a: 'dx' }).ed.storia.presente;
    expect(immagini(dx.doc)[0].a).toBe('dx');
    const linea = eseguiAzioneFormato(ed, { tipo: 'disposizioneImmagine', a: undefined }).ed.storia.presente;
    expect(immagini(linea.doc)[0].a).toBeUndefined();
    const voci = popupImmagine(im({ a: 'dx' })).voci;
    expect(voci.map((v) => v.etichetta)).toEqual(['Piccola (150 px)', 'Media (300 px)', 'Larghezza del testo', 'Ruota a destra di 90°', 'Ruota a sinistra di 90°',
      'Capovolgi in orizzontale', 'Capovolgi in verticale', 'Ritaglia…', 'Testo alternativo…', 'In linea con il testo', 'Testo intorno, immagine a sinistra', 'Testo intorno, immagine a destra', 'Elimina immagine']);
    expect(voci.filter((v) => v.attiva).map((v) => v.etichetta)).toEqual(['Testo intorno, immagine a destra']);
  });
  test('nella pagina l\'immagine con il testo intorno ha la classe che la fa galleggiare; .pdoc la tiene e rifiuta valori strani', () => {
    const d = doc(im({ a: 'dx' }));
    const zona = document.createElement('div');
    disegna(zona, d);
    expect(zona.querySelector('.immagine')!.className).toBe('immagine link intorno-dx');
    expect(deserializza(serializza(d))).toEqual(JSON.parse(JSON.stringify(d)));
    const rotto = JSON.parse(serializza(d)); rotto.p[0][1].im.a = 'centro';
    expect(() => deserializza(JSON.stringify(rotto))).toThrow();
  });
  test('sostituire l\'immagine (dopo rotazione o ritaglio): link e testo intorno restano; i conti delle misure', () => {
    const s = selezionata(doc(im({ a: 'sx' })));
    const nuova = sostituisciImmagine(s, { s: PNG, w: 100, h: 200 });
    expect(immagini(nuova.doc)[0]).toEqual({ s: PNG, w: 100, h: 200, a: 'sx' });
    expect(nuova.doc.paragrafi[0].runs[1].u).toBe('https://example.com/');
    expect(sostituisciImmagine({ ...s, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } } }, im())).toEqual({ ...s, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } } });
    expect(misureDopo(im(), 'ruotaDestra')).toEqual({ w: 100, h: 200 });
    expect(misureDopo({ s: PNG, w: 300, h: 900 }, 'ruotaSinistra')).toEqual({ w: 602, h: 201 });   // ruotata sta dentro la larghezza del testo
    expect(misureDopo(im(), 'capovolgiVerticale')).toEqual({ w: 200, h: 100 });
    expect(contiRitaglio(im(), { w: 400, h: 200 }, { sx: 25, dx: 25, su: 10, giu: 0 })).toEqual({ x: 100, y: 20, cw: 200, ch: 180, w: 100, h: 90 });
    expect(ritaglioValido({ sx: 80, dx: -5, su: Number.NaN, giu: 12.345 })).toEqual({ sx: 45, dx: 0, su: 0, giu: 12.3 });
  });
});

describe('T558: .docx e .odt come Word e LibreOffice', () => {
  const disposizioni = (d: Documento): Array<string | undefined> => immagini(d).map((x) => x.a);
  test('il documento di Word: una in linea, una a sinistra e una a destra con il testo a riquadro', async () => {
    const d = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/immagini/word-immagini.docx')));
    expect(disposizioni(d).sort()).toEqual(['dx', 'sx', undefined].sort());
    expect(immagini(d).every((x) => x.w === 120 && x.h === 80)).toBe(true);
  });
  test('lo stesso convertito da LibreOffice: le immagini si leggono (prima un .odt le perdeva) con il testo intorno', async () => {
    const d = await importaOdt(new Uint8Array(fs.readFileSync('tests/file-prova/immagini/libreoffice-immagini.odt')));
    expect(disposizioni(d).sort()).toEqual(['dx', 'sx', undefined].sort());
    expect(immagini(d).every((x) => x.s.startsWith('data:image/png;base64,') && x.w === 120 && x.h === 80)).toBe(true);
  });
  test('scritte da pmb_docs: .docx con wp:anchor e wrapSquare come Word, .odt con le cornici come LibreOffice; rilette uguali', async () => {
    const d: Documento = { paragrafi: [...doc(im({ a: 'sx' })).paragrafi, ...doc(im({ a: 'dx' })).paragrafi, ...doc(im()).paragrafi] };
    const { leggiZip } = await import('@comune/formati/zip');
    const docx = await esportaDocx(d);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T558.docx'), docx);
    const x = new TextDecoder().decode((await leggiZip(docx)).get('word/document.xml')!);
    expect((x.match(/<wp:anchor /g) ?? []).length).toBe(2);
    expect(x).toContain('<wp:positionH relativeFrom="column"><wp:align>left</wp:align></wp:positionH>');
    expect(x).toContain('<wp:align>right</wp:align>');
    expect((x.match(/<wp:wrapSquare wrapText="bothSides"\/>/g) ?? []).length).toBe(2);
    expect((x.match(/<wp:inline /g) ?? []).length).toBe(1);
    expect(disposizioni(await importaDocx(docx))).toEqual(['sx', 'dx', undefined]);
    const odt = await esportaOdt(d);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T558.odt'), odt);
    const z = await leggiZip(odt);
    const c = new TextDecoder().decode(z.get('content.xml')!);
    expect(c).toContain('text:anchor-type="as-char"');
    expect((c.match(/text:anchor-type="char"/g) ?? []).length).toBe(2);
    expect(c).toContain('style:wrap="parallel"');
    expect([...z.keys()].filter((k) => k.startsWith('Pictures/'))).toEqual(['Pictures/immagine1.png']);   // la stessa immagine una volta sola
    expect(new TextDecoder().decode(z.get('META-INF/manifest.xml')!)).toContain('manifest:full-path="Pictures/immagine1.png" manifest:media-type="image/png"');
    const r = await importaOdt(odt);
    expect(disposizioni(r)).toEqual(['sx', 'dx', undefined]);
    expect(immagini(r).map((y) => [y.w, y.h])).toEqual([[200, 100], [200, 100], [200, 100]]);
    expect(r.paragrafi[0].runs.find((y) => y.im)?.u).toBe('https://example.com/');
  });
});
