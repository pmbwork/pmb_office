// T565: testo alternativo delle immagini (.docx come Word: descr di wp:docPr; .odt come LibreOffice: svg:desc) e controllo accessibilità
// (modello/accessibilita.ts). File di confronto in tests/file-prova/accessibilita/ (LAVORO/studio-microsoft-office/word_testo_alternativo.py).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { deserializza, serializza, impostaTestoAlternativo, type Documento, type Run } from '../../src/modello/documento';
import { contrasto, controllaAccessibilita } from '../../src/modello/accessibilita';

const CARTELLA = 'tests/file-prova/accessibilita';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const alt = (d: Documento): string | undefined => d.paragrafi.flatMap((p) => p.runs).find((r) => r.im)?.im?.d;
const r = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('T565: testo alternativo', () => {
  test('dal .docx di Word e dal .odt di LibreOffice', async () => {
    expect(alt((await importa(leggi('alt_word.docx'), 'a.docx')).doc)).toBe('Grafico delle vendite 2026');
    expect(alt((await importa(leggi('alt_libreoffice.odt'), 'a.odt')).doc)).toBe('Grafico delle vendite 2026');
  });
  test('scritto da pmb_docs in .docx, .odt e .pdoc si rilegge', async () => {
    const d = (await importa(leggi('alt_word.docx'), 'a.docx')).doc;
    const x = await esporta(d, 'docx');
    fs.writeFileSync(`${CARTELLA}/alt_pmb.docx`, x);
    expect(alt((await importa(x, 'a.docx')).doc)).toBe('Grafico delle vendite 2026');
    expect(alt((await importa(await esporta(d, 'odt'), 'a.odt')).doc)).toBe('Grafico delle vendite 2026');
    expect(alt(deserializza(serializza(d)))).toBe('Grafico delle vendite 2026');
  });
  test('si imposta e si toglie sull\'immagine selezionata', () => {
    const st = { doc: { paragrafi: [{ runs: [r('￼', { im: { s: PNG, w: 10, h: 10 } })] }] }, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } }, pendenti: null };
    const a = impostaTestoAlternativo(st, '  Logo  ');
    expect(alt(a.doc)).toBe('Logo');
    expect(alt(impostaTestoAlternativo(a, '').doc)).toBeUndefined();
  });
});

describe('T565: controllo accessibilità', () => {
  test('contrasto come WCAG: nero su bianco 21, grigio chiaro poco', () => {
    expect(contrasto('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrasto('#999999', '#ffffff')!).toBeLessThan(4.5);
  });
  test('trova ogni tipo di problema, nell\'ordine del testo', () => {
    const doc: Documento = { paragrafi: [
      { st: '1', runs: [r('Titolo')] },
      { st: '3', runs: [r('Sottotitolo saltato')] },
      { runs: [r('￼', { im: { s: PNG, w: 10, h: 10 } })] },
      { runs: [r('grigio', { k: '#bbbbbb' }), r(' e '), r('qui', { u: 'https://esempio.it' })] },
      { runs: [] }, { runs: [] }, { runs: [] },
      { runs: [r('a')], tb: { i: 1, r: 0, c: 0 } }, { runs: [r('b')], tb: { i: 1, r: 1, c: 0 } },
    ] };
    expect(controllaAccessibilita(doc).map((x) => [x.tipo, x.p])).toEqual([
      ['titolo-saltato', 1], ['immagine-senza-alt', 2], ['contrasto', 3], ['link-poco-chiaro', 3], ['paragrafi-vuoti', 4], ['tabella-senza-intestazione', 7]]);
  });
  test('un documento a posto non ha problemi; uno lungo senza titoli sì', () => {
    expect(controllaAccessibilita({ paragrafi: [{ st: '1', runs: [r('T')] }, { st: '2', runs: [r('U')] }, { runs: [r('testo', { k: '#333333' })] }] })).toEqual([]);
    const lungo: Documento = { paragrafi: Array.from({ length: 25 }, (_, i) => ({ runs: [r(`riga ${i}`)] })) };
    expect(controllaAccessibilita(lungo).map((x) => x.tipo)).toEqual(['senza-titoli']);
  });
});
