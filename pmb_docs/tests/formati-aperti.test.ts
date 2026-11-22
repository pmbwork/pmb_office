import { describe, it, expect } from 'vitest';
import { importa, esporta, ESTENSIONI_APRI, titoloDaNome } from '../src/formati/file';
import { daTesto, testoDi, OGGETTO } from '../src/modello/documento';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const ascii = (s: string): Uint8Array => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));

describe('formati aperti: famiglia Word e OpenDocument', () => {
  it('.docm, .dotx e .dotm si aprono come .docx; i file con macro avvisano', async () => {
    const bytes = await esporta(daTesto('Ciao mondo'), 'docx');
    for (const nome of ['a.docx', 'a.dotx']) {
      const r = await importa(bytes, nome);
      expect(testoDi(r.doc)).toContain('Ciao mondo');
      expect(r.avviso).toBeUndefined();
    }
    for (const nome of ['a.docm', 'a.dotm']) {
      const r = await importa(bytes, nome);
      expect(testoDi(r.doc)).toContain('Ciao mondo');
      expect(r.avviso).toMatch(/macro/i);
    }
  });

  it('.ott si apre come .odt', async () => {
    const bytes = await esporta(daTesto('Modello ODF'), 'odt');
    const r = await importa(bytes, 'modello.ott');
    expect(testoDi(r.doc)).toContain('Modello ODF');
  });

  it('.fodt (OpenDocument piatto) si legge con stili e tabelle', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
<office:automatic-styles><style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles>
<office:body><office:text><text:h text:outline-level="1">Titolo</text:h><text:p>Testo <text:span text:style-name="T1">forte</text:span></text:p></office:text></office:body></office:document>`;
    const r = await importa(enc(xml), 'a.fodt');
    expect(testoDi(r.doc)).toContain('Titolo');
    const par = r.doc.paragrafi[1];
    expect(par.runs.find((x) => x.t === 'forte')?.g).toBe(true);
    expect(r.doc.paragrafi[0].st).toBe('1');
  });

  it('.doc binario dà un errore chiaro, non un documento vuoto', async () => {
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    await expect(importa(ole, 'vecchio.doc')).rejects.toThrow(/\.doc/);
  });

  it('un .doc che dentro è RTF si apre lo stesso', async () => {
    const r = await importa(ascii('{\\rtf1\\ansi Dentro RTF\\par}'), 'strano.doc');
    expect(testoDi(r.doc)).toContain('Dentro RTF');
  });

  it('le estensioni nuove sono nella finestra Apri e il titolo toglie l\'estensione', () => {
    for (const e of ['.docm', '.dotx', '.dotm', '.ott', '.fodt', '.rtf', '.html', '.htm']) expect(ESTENSIONI_APRI).toContain(e);
    expect(titoloDaNome('Relazione.rtf')).toBe('Relazione');
    expect(titoloDaNome('Pagina.html')).toBe('Pagina');
    expect(titoloDaNome('Mod.dotx')).toBe('Mod');
  });
});

describe('formati aperti: RTF', () => {
  it('testo, grassetto, corsivo, sottolineato, caratteri accentati e unicode', async () => {
    const rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Arial;}{\\f1\\froman Times New Roman;}}' +
      '{\\colortbl;\\red255\\green0\\blue0;}\\pard Ciao {\\b grasso}, {\\i corsivo}, {\\ul sotto}. Perch\\\'e9 \\u8364? \\f1\\fs48 grande\\par' +
      '\\pard\\qc {\\cf1 rosso}\\par}';
    const r = await importa(ascii(rtf), 'a.rtf');
    const p0 = r.doc.paragrafi[0];
    expect(testoDi(r.doc)).toContain('Perché € grande');
    expect(p0.runs.find((x) => x.t === 'grasso')?.g).toBe(true);
    expect(p0.runs.find((x) => x.t === 'corsivo')?.c).toBe(true);
    expect(p0.runs.find((x) => x.t === 'sotto')?.s).toBe(true);
    const grande = p0.runs.find((x) => x.t.includes('grande'));
    expect(grande?.z).toBe(24);
    expect(grande?.f).toBe('Times New Roman');
    const p1 = r.doc.paragrafi[1];
    expect(p1.al).toBe('ce');
    expect(p1.runs[0].k).toBe('#ff0000');
  });

  it('salta tabella dei caratteri, stili e info senza metterli nel testo', async () => {
    const rtf = '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}{\\stylesheet{\\s1 heading 1;}}{\\info{\\title Segreto}}{\\*\\generator Word;}\\pard Solo questo\\par}';
    const r = await importa(ascii(rtf), 'a.rtf');
    expect(testoDi(r.doc).trim()).toBe('Solo questo');
  });

  it('tabelle: ogni cella è un paragrafo con riga e colonna', async () => {
    const rtf = '{\\rtf1\\ansi\\trowd\\cellx2000\\cellx4000\\intbl A1\\cell B1\\cell\\row\\trowd\\cellx2000\\cellx4000\\intbl A2\\cell B2\\cell\\row\\pard Fine\\par}';
    const r = await importa(ascii(rtf), 'a.rtf');
    const celle = r.doc.paragrafi.filter((p) => p.tb);
    expect(celle.map((p) => [p.runs.map((x) => x.t).join(''), p.tb!.r, p.tb!.c])).toEqual([['A1', 0, 0], ['B1', 0, 1], ['A2', 1, 0], ['B2', 1, 1]]);
    expect(r.doc.paragrafi[r.doc.paragrafi.length - 1].tb).toBeUndefined();
  });

  it('link HYPERLINK diventa un link', async () => {
    const rtf = '{\\rtf1\\ansi Vai a {\\field{\\*\\fldinst{HYPERLINK "https://esempio.it/x"}}{\\fldrslt{\\ul sito}}}\\par}';
    const r = await importa(ascii(rtf), 'a.rtf');
    expect(r.doc.paragrafi[0].runs.find((x) => x.t === 'sito')?.u).toBe('https://esempio.it/x');
  });

  it('elenchi puntati e numerati dal testo del marcatore', async () => {
    const rtf = '{\\rtf1\\ansi\\pard{\\pntext\\f1\\\'b7\\tab}voce uno\\par\\pard{\\listtext 1.\\tab}primo\\par}';
    const r = await importa(ascii(rtf), 'a.rtf');
    expect(r.doc.paragrafi[0].el).toBe('p');
    expect(r.doc.paragrafi[1].el).toBe('n');
    expect(testoDi(r.doc)).not.toContain('1.');
  });

  it('immagine png incorporata', async () => {
    const png = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082';
    const rtf = `{\\rtf1\\ansi Foto {\\pict\\pngblip\\picwgoal1500\\pichgoal750 ${png}}\\par}`;
    const r = await importa(ascii(rtf), 'a.rtf');
    const run = r.doc.paragrafi[0].runs.find((x) => x.im);
    expect(run?.t).toBe(OGGETTO);
    expect(run?.im?.s.startsWith('data:image/png;base64,')).toBe(true);
    expect(run?.im?.w).toBe(100);
  });

  it('un file danneggiato non manda in crisi il programma', async () => {
    const r = await importa(ascii('{\\rtf1\\ansi {{{{ testo \\par {\\b'), 'rotto.rtf');
    expect(testoDi(r.doc)).toContain('testo');
    await expect(importa(ascii('{\\rtf1' + '{'.repeat(500)), 'x.rtf')).rejects.toThrow();
  });
});

describe('formati aperti: HTML', () => {
  const html = (corpo: string): Uint8Array => enc(`<!doctype html><html><head><title>T</title><style>p{color:red}</style><script>alert(1)</script></head><body>${corpo}</body></html>`);

  it('titoli, paragrafi, grassetto, corsivo, colori e dimensioni', async () => {
    const r = await importa(html('<h1>Titolo</h1><p>Un <b>grassetto</b> e <i>corsivo</i> <span style="color:#ff0000;font-size:16px">rosso</span></p><p style="text-align:center">Al centro</p>'), 'a.html');
    expect(r.doc.paragrafi[0].st).toBe('1');
    const p = r.doc.paragrafi[1];
    expect(p.runs.find((x) => x.t === 'grassetto')?.g).toBe(true);
    expect(p.runs.find((x) => x.t === 'corsivo')?.c).toBe(true);
    const rosso = p.runs.find((x) => x.t === 'rosso');
    expect(rosso?.k).toBe('#ff0000');
    expect(rosso?.z).toBe(12);
    expect(r.doc.paragrafi[2].al).toBe('ce');
    expect(testoDi(r.doc)).not.toContain('alert');
    expect(testoDi(r.doc)).not.toContain('color:red');
  });

  it('elenchi, tabelle e link', async () => {
    const r = await importa(html('<ul><li>uno</li><li>due</li></ul><ol><li>primo</li></ol><table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table><p><a href="https://esempio.it/">sito</a> <a href="javascript:alert(1)">no</a></p>'), 'a.htm');
    const els = r.doc.paragrafi.filter((p) => p.el).map((p) => p.el);
    expect(els).toEqual(['p', 'p', 'n']);
    const celle = r.doc.paragrafi.filter((p) => p.tb);
    expect(celle.map((p) => [p.runs.map((x) => x.t).join(''), p.tb!.r, p.tb!.c])).toEqual([['A', 0, 0], ['B', 0, 1], ['C', 1, 0], ['D', 1, 1]]);
    const link = r.doc.paragrafi.flatMap((p) => p.runs).find((x) => x.t === 'sito');
    expect(link?.u).toBe('https://esempio.it/');
    expect(r.doc.paragrafi.flatMap((p) => p.runs).find((x) => x.t === 'no')?.u).toBeUndefined();
  });

  it('immagini: solo quelle incorporate, le altre diventano il testo alternativo', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const r = await importa(html(`<p><img src="data:image/png;base64,${png}" width="40" height="20"><img src="http://x/y.png" alt="remota"></p>`), 'a.html');
    const runs = r.doc.paragrafi.flatMap((p) => p.runs);
    expect(runs.some((x) => x.im && x.im.w === 40)).toBe(true);
    expect(runs.some((x) => x.t.includes('remota'))).toBe(true);
  });

  it('i ritorni a capo del sorgente non diventano paragrafi', async () => {
    const r = await importa(html('<p>una riga\n   spezzata\n nel sorgente</p>'), 'a.html');
    expect(testoDi(r.doc).trim()).toBe('una riga spezzata nel sorgente');
  });

  it('pagina vuota: un documento con un paragrafo vuoto', async () => {
    const r = await importa(html(''), 'vuota.html');
    expect(r.doc.paragrafi.length).toBe(1);
  });
});
