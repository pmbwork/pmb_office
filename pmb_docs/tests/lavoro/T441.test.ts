// T441: spazio prima e dopo il paragrafo (sb, sa): modello, azioni, disegno, file .fdoc, .docx (anche con gli stili di Word), .odt, PDF.
import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { disegna } from '../../src/editor/render';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import { popupPerComando } from '../../src/guscio/popup-dati';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { esporta } from '../../src/formati/file';
import {
  applicaParagrafo, cursore, daTesto, deserializza, formatoDaCopiare, incollaFormato, serializza, spazioValido, statoIniziale, type Documento,
} from '../../src/modello/documento';

const sel = (p0: number, p1 = p0) => ({ ancora: { p: p0, o: 0 }, fuoco: { p: p1, o: 0 } });
const testi = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const editor = (doc: Documento, s: { ancora: { p: number; o: number }; fuoco: { p: number; o: number } }) =>
  ({ ...nuovoEditor(), storia: { ...nuovoEditor().storia, presente: { ...statoIniziale(doc), sel: s } } });

async function conStili(corpo: string, stili: string): Promise<Documento> {
  const voci = await leggiZip(await esportaDocx(daTesto('x')));
  const xml = new TextDecoder().decode(voci.get('word/document.xml')!).replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${corpo}$1`);
  voci.set('word/document.xml', new TextEncoder().encode(xml));
  voci.set('word/styles.xml', new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${stili}</w:styles>`));
  return importaDocx(await scriviZip(Array.from(voci, ([nome, dati]) => ({ nome, dati }))));
}
const T = (t: string) => `<w:r><w:t>${t}</w:t></w:r>`;
const WORD_STILI = `<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normale"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Paragrafoelenco"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normale"/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Titolo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normale"/><w:pPr><w:spacing w:before="240" w:after="0"/></w:pPr></w:style>`;

describe('T441: modello', () => {
  it('spazioValido: da 0 a 200 pt con mezzo punto di precisione, altrimenti niente', () => {
    expect(spazioValido(10)).toBe(10);
    expect(spazioValido(10.26)).toBe(10.5);
    expect(spazioValido(999)).toBe(200);
    for (const v of [0, -3, NaN, Infinity, '5', undefined, null]) expect(spazioValido(v)).toBeUndefined();
  });
  it('applicaParagrafo mette e toglie sb e sa; vanno a capo con il paragrafo (Invio)', () => {
    let doc = applicaParagrafo(daTesto('uno due'), sel(0), 'sa', 12);
    doc = applicaParagrafo(doc, sel(0), 'sb', 6);
    expect([doc.paragrafi[0].sb, doc.paragrafi[0].sa]).toEqual([6, 12]);
    const d2 = statoCorrente(eseguiAzioneFormato(editor(doc, cursore(0, 3)), { tipo: 'invio' }).ed).doc;
    expect(d2.paragrafi.map((p) => [p.sb, p.sa])).toEqual([[6, 12], [6, 12]]);
    expect(applicaParagrafo(doc, sel(0), 'sa', undefined).paragrafi[0].sa).toBeUndefined();
  });
  it('si salva e si rilegge in .fdoc; valori fuori campo sono rifiutati', () => {
    const doc = applicaParagrafo(applicaParagrafo(daTesto('uno'), sel(0), 'sb', 6), sel(0), 'sa', 12.5);
    const letto = deserializza(serializza(doc));
    expect([letto.paragrafi[0].sb, letto.paragrafi[0].sa]).toEqual([6, 12.5]);
    expect(() => deserializza(serializza(doc).replace('"sb":6', '"sb":-1'))).toThrow();
    expect(() => deserializza(serializza(doc).replace('"sb":6', '"sb":"6"'))).toThrow();
  });
  it('Copia formato porta anche lo spazio prima e dopo', () => {
    let doc = daTesto('AAA\nbbb');
    doc = applicaParagrafo(applicaParagrafo(doc, sel(0), 'sb', 4), sel(0), 'sa', 8);
    const copia = formatoDaCopiare({ ...statoIniziale(doc), sel: sel(0) });
    const dopo = incollaFormato({ ...statoIniziale(doc), sel: { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 3 } } }, copia);
    expect([dopo.doc.paragrafi[1].sb, dopo.doc.paragrafi[1].sa]).toEqual([4, 8]);
  });
});

describe('T441: azione e menu', () => {
  it('l\'azione spazio mette e toglie lo spazio', () => {
    const ed = editor(daTesto('uno\ndue'), sel(0, 1));
    const r = eseguiAzioneFormato(ed, { tipo: 'spazio', chiave: 'sa', valore: 10 }).ed;
    expect(statoCorrente(r).doc.paragrafi.map((p) => p.sa)).toEqual([10, 10]);
    const t = eseguiAzioneFormato(r, { tipo: 'spazio', chiave: 'sa', valore: undefined }).ed;
    expect(statoCorrente(t).doc.paragrafi.map((p) => p.sa)).toEqual([undefined, undefined]);
  });
  it('il menu Interlinea offre aggiungi/togli spazio prima e dopo secondo lo stato del paragrafo', () => {
    const vuoto = popupPerComando('interlinea')!.voci.slice(4);
    expect(vuoto.map((v) => v.etichetta)).toEqual(['Aggiungi spazio prima del paragrafo (10 pt)', 'Aggiungi spazio dopo il paragrafo (10 pt)']);
    const con = popupPerComando('interlinea', { formato: { g: false, c: false, s: false }, paragrafo: { sb: 10, sa: 10 } } as never)!.voci.slice(4);
    expect(con.map((v) => v.etichetta)).toEqual(['Togli lo spazio prima del paragrafo', 'Togli lo spazio dopo il paragrafo']);
    expect(con.map((v) => (v.azione as { valore: unknown }).valore)).toEqual([undefined, undefined]);
    expect(con.map((v) => v.attiva)).toEqual([true, true]);
  });
});

describe('T441: disegno', () => {
  it('i margini del paragrafo e l\'interlinea fuori dai valori fissi sono nello stile del nodo', () => {
    const z = document.createElement('div');
    let doc = applicaParagrafo(applicaParagrafo(daTesto('uno\ndue'), sel(0), 'sb', 6), sel(0), 'sa', 12);
    doc = applicaParagrafo(doc, sel(1), 'ls', 1.08);
    disegna(z, doc);
    const p = z.querySelectorAll('p');
    expect([p[0].style.marginTop, p[0].style.marginBottom]).toEqual(['6pt', '12pt']);
    // dal 2026-11-25 l'interlinea è il multiplo --ls dell'altezza naturale della riga del carattere (come in Word)
    expect(p[1].style.getPropertyValue('--ls')).toBe('1.08');
    expect(p[1].style.marginTop).toBe('');
  });
});

describe('T441: .docx', () => {
  it('si esporta (w:before e w:after in ventesimi di punto) e si rilegge', async () => {
    const doc = applicaParagrafo(applicaParagrafo(applicaParagrafo(daTesto('uno\ndue'), sel(0), 'sb', 6), sel(0), 'sa', 12.5), sel(1), 'ls', 1.5);
    const voci = await leggiZip(await esportaDocx(doc));
    const xml = new TextDecoder().decode(voci.get('word/document.xml')!);
    expect(xml).toContain('w:before="120"');
    expect(xml).toContain('w:after="250"');
    const letto = await importaDocx(await esportaDocx(doc));
    expect(letto.paragrafi.map((p) => [p.sb, p.sa, p.ls])).toEqual([[6, 12.5, undefined], [undefined, undefined, 1.5]]);
  });
  it('senza spaziatura il file di pmb_docs resta senza sb e sa (i suoi predefiniti sono 0)', async () => {
    const letto = await importaDocx(await esportaDocx(daTesto('uno\ndue')));
    expect(letto.paragrafi.every((p) => p.sb === undefined && p.sa === undefined && p.ls === undefined)).toBe(true);
  });
  it('un file di Word: 8 pt dopo e interlinea 1,08 dai predefiniti, anche senza pPr nel paragrafo', async () => {
    const d = await conStili(`<w:p>${T('uno')}</w:p><w:p><w:pPr><w:spacing w:before="240"/></w:pPr>${T('due')}</w:p>`, WORD_STILI);
    expect(d.paragrafi.map((p) => [p.sb, p.sa, p.ls])).toEqual([[undefined, 8, 1.08], [12, 8, 1.08]]);
  });
  it('lo stile Titolo ha già i margini nel disegno (non si importano quelli di Word); un paragrafo normale con after=0 resta senza spazio', async () => {
    const d = await conStili(`<w:p><w:pPr><w:pStyle w:val="Titolo1"/></w:pPr>${T('Titolo')}</w:p><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${T('stretto')}</w:p>`, WORD_STILI);
    expect(d.paragrafi[0].st).toBe('1');
    expect([d.paragrafi[0].sb, d.paragrafi[0].sa]).toEqual([undefined, undefined]);
    expect([d.paragrafi[1].sb, d.paragrafi[1].sa]).toEqual([undefined, undefined]);
  });
  it('spaziatura contestuale (elenchi di Word): niente spazio tra voci consecutive, ma sì attorno all\'elenco', async () => {
    const voce = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Paragrafoelenco"/></w:pPr>${T(t)}</w:p>`;
    const d = await conStili(`<w:p>${T('prima')}</w:p>${voce('a')}${voce('b')}${voce('c')}<w:p>${T('dopo')}</w:p>`, WORD_STILI);
    expect(testi(d)).toEqual(['prima', 'a', 'b', 'c', 'dopo']);
    expect(d.paragrafi.map((p) => p.sa)).toEqual([8, undefined, undefined, 8, 8]);
    expect(d.paragrafi.some((p) => Object.keys(p).includes('__cs'))).toBe(false);
  });
  it('un solo paragrafo con spaziatura contestuale tiene il suo spazio e non lascia attributi interni', async () => {
    const d = await conStili(`<w:p><w:pPr><w:pStyle w:val="Paragrafoelenco"/></w:pPr>${T('solo')}</w:p>`, WORD_STILI);
    expect(Object.keys(d.paragrafi[0])).not.toContain('__cs');
    expect(d.paragrafi[0].sa).toBe(8);
  });
});

describe('T441: altri formati', () => {
  it('.odt: margin-top e margin-bottom nello stile del paragrafo', async () => {
    const doc = applicaParagrafo(applicaParagrafo(daTesto('uno'), sel(0), 'sb', 6), sel(0), 'sa', 12);
    const voci = await leggiZip(await esporta(doc, 'odt'));
    const xml = new TextDecoder().decode(voci.get('content.xml')!);
    expect(xml).toContain('fo:margin-top="6pt"');
    expect(xml).toContain('fo:margin-bottom="12pt"');
  });
  it('PDF: lo spazio dopo il paragrafo sposta in basso il successivo', async () => {
    const y = async (d: Documento) => {
      const b = new TextDecoder('latin1').decode(await esporta(d, 'pdf'));
      return [...b.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((m) => Number(m[1]));
    };
    const senza = await y(daTesto('uno\ndue'));
    const con = await y(applicaParagrafo(daTesto('uno\ndue'), sel(0), 'sa', 20));
    expect(senza.length).toBe(2);
    expect(con[0] - con[1]).toBeCloseTo(senza[0] - senza[1] + 20, 1);
  });
});
