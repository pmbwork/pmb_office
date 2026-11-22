// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  FORMATI, TITOLO_PREDEFINITO, DIMENSIONE_MASSIMA, ESTENSIONI_APRI, nomeFile, formatoDaNome, titoloDaNome, decodificaTesto,
  esporta, importa, popupScarica,
} from '../../src/formati/file';
import { daTesto, testoDi, applicaAttributo, applicaParagrafo, serializza, type Documento } from '../../src/modello/documento';

const enc = new TextEncoder();

describe('T053: nomi di file', () => {
  it('formati disponibili', () => {
    expect(FORMATI.map((f) => [f.id, f.estensione])).toEqual([['docx', 'docx'], ['txt', 'txt'], ['fdoc', 'pdoc'], ['odt', 'odt'], ['pdf', 'pdf']]);
    expect(FORMATI[0].mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(TITOLO_PREDEFINITO).toBe('Documento senza titolo');
    expect(ESTENSIONI_APRI).toBe('.docx,.docm,.dotx,.dotm,.doc,.dot,.odt,.ott,.fodt,.rtf,.html,.htm,.xhtml,.txt,.md,.pdoc,.fdoc'); // .fdoc = estensione di quando il programma si chiamava free_docs: si apre ancora
  });

  it('nomeFile toglie i caratteri vietati da Windows, i punti e gli spazi in fondo, e limita la lunghezza', () => {
    expect(nomeFile('Relazione finale', 'docx')).toBe('Relazione finale.docx');
    expect(nomeFile('Relazione 2026/10: bozza?', 'txt')).toBe('Relazione 2026 10 bozza.txt');
    expect(nomeFile('a\\b*c"d<e>f|g', 'fdoc')).toBe('a b c d e f g.pdoc');
    expect(nomeFile('  tanti    spazi...  ', 'docx')).toBe('tanti spazi.docx');
    expect(nomeFile('con\ntrollo\u0001x', 'docx')).toBe('con trollo x.docx');
    expect(nomeFile('', 'docx')).toBe('Documento senza titolo.docx');
    expect(nomeFile(' . . ', 'txt')).toBe('Documento senza titolo.txt');
    expect(nomeFile('è😀ü', 'docx')).toBe('è😀ü.docx');
    expect(nomeFile('x'.repeat(300), 'docx')).toBe(`${'x'.repeat(120)}.docx`);
    expect(Array.from(nomeFile('😀'.repeat(200), 'txt')).length).toBe(120 + 4);
    for (const r of ['CON', 'nul', 'Com1', 'LPT9', 'aux']) expect(nomeFile(r, 'docx')).toBe(`_${r}.docx`);
    expect(nomeFile('console', 'docx')).toBe('console.docx');
  });

  it('formatoDaNome e titoloDaNome', () => {
    expect([ 'a.docx', 'A.DOCX', 'x.y.docx', 'n.txt', 'n.TEXT', 'n.md', 'n.markdown', 'p.fdoc', 'q.pdoc' ].map(formatoDaNome))
      .toEqual(['docx', 'docx', 'docx', 'txt', 'txt', 'txt', 'txt', 'fdoc', 'fdoc']);
    expect(['a.pdf', 'senza', '', 'a.', '.'].map(formatoDaNome)).toEqual([null, null, null, null, null]);
    expect(titoloDaNome('Relazione.docx')).toBe('Relazione');
    expect(titoloDaNome('C:\\Utenti\\io\\Relazione finale.DOCX')).toBe('Relazione finale');
    expect(titoloDaNome('/home/io/a.b.txt')).toBe('a.b');
    expect(titoloDaNome('file.pdf')).toBe('file.pdf');
    expect(titoloDaNome('.docx')).toBe('Documento senza titolo');
    expect(titoloDaNome('')).toBe('Documento senza titolo');
    expect(titoloDaNome('  Titolo  .txt')).toBe('Titolo');
  });
});

describe('T053: lettura dei testi', () => {
  it('UTF-8 con e senza BOM, UTF-16 con BOM, Windows-1252', () => {
    expect(decodificaTesto(enc.encode('Caffè € 😀'))).toBe('Caffè € 😀');
    expect(decodificaTesto(new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('è')]))).toBe('è');
    expect(decodificaTesto(new Uint8Array([0xff, 0xfe, 0xe8, 0x00, 0x41, 0x00]))).toBe('èA');
    expect(decodificaTesto(new Uint8Array([0xfe, 0xff, 0x00, 0xe8, 0x00, 0x41]))).toBe('èA');
    expect(decodificaTesto(new Uint8Array([0x43, 0x61, 0x66, 0x66, 0xe8, 0x20, 0x80]))).toBe('Caffè €');
    expect(decodificaTesto(new Uint8Array([]))).toBe('');
  });
});

function ricco(): Documento {
  let d = daTesto('Titolo\nSecondo paragrafo con testo\n\nUltimo');
  d = applicaAttributo(d, { ancora: { p: 1, o: 0 }, fuoco: { p: 1, o: 8 } }, 'z', 18);
  d = applicaAttributo(d, { ancora: { p: 1, o: 9 }, fuoco: { p: 1, o: 13 } }, 'k', '#ff0000');
  d = applicaParagrafo(d, { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'st', '1');
  d = applicaParagrafo(d, { ancora: { p: 3, o: 0 }, fuoco: { p: 3, o: 0 } }, 'el', 'n');
  return d;
}

describe('T053: salvare e riaprire', () => {
  it('docx e fdoc conservano tutto, anche con i formati', async () => {
    const d = ricco();
    for (const f of ['docx', 'fdoc'] as const) {
      const r = await importa(await esporta(d, f), nomeFile('prova', f));
      expect(r.formato, f).toBe(f);
      expect(r.doc, f).toEqual(d);
    }
  });

  it('il testo semplice usa gli a capo di Windows e perde i formati', async () => {
    const d = ricco();
    const bytes = await esporta(d, 'txt');
    expect(new TextDecoder().decode(bytes)).toBe('Titolo\r\nSecondo paragrafo con testo\r\n\r\nUltimo');
    const r = await importa(bytes, 'prova.txt');
    expect(r.formato).toBe('txt');
    expect(testoDi(r.doc)).toBe(testoDi(d));
    expect(r.doc.paragrafi.every((p) => Object.keys(p).join() === 'runs')).toBe(true);
  });

  it('il formato si riconosce anche dal contenuto', async () => {
    const d = ricco();
    const docx = await esporta(d, 'docx');
    expect((await importa(docx, 'rinominato.txt')).formato).toBe('docx');
    expect((await importa(docx, 'senza-estensione')).formato).toBe('docx');
    const json = await esporta(d, 'fdoc');
    expect((await importa(json, 'senza-estensione')).formato).toBe('fdoc');
    expect((await importa(json, 'finto.txt')).formato).toBe('txt');
    expect((await importa(enc.encode('# Titolo\n\ntesto'), 'nota.md')).formato).toBe('txt');
    expect(testoDi((await importa(enc.encode('uno\r\ndue\rtre\ndue'), 'a.dat')).doc)).toBe('uno\ndue\ntre\ndue');
    expect(testoDi((await importa(new Uint8Array([0x43, 0xe8, 0x0c, 0x41, 0x00 + 0x42]), 'a.txt')).doc)).toBe('CèAB');
  });

  it('file sbagliati: messaggi chiari', async () => {
    await expect(importa(new Uint8Array([1, 2, 0, 3, 4]), 'a.dat')).rejects.toThrow(/non riconosciuto/);
    await expect(importa(enc.encode('non è uno zip'), 'x.docx')).rejects.toThrow(/non è un file .docx valido/); // dal 2026-11-18 lo stesso messaggio chiaro di pmb_sheets
    await expect(importa(enc.encode('{"v":2}'), 'x.fdoc')).rejects.toThrow(/Documento non valido/);
    await expect(importa(new Uint8Array(DIMENSIONE_MASSIMA + 1), 'enorme.txt')).rejects.toThrow(/troppo grande/);
    expect(testoDi((await importa(new Uint8Array(0), 'vuoto.txt')).doc)).toBe('');
  });

  it('il menu Scarica ha una voce per formato', () => {
    const p = popupScarica();
    expect(p.tipo).toBe('lista');
    expect(p.voci.map((v) => v.etichetta)).toEqual(FORMATI.map((f) => f.etichetta));
    expect(p.voci.map((v) => v.azione)).toEqual([{ tipo: 'scarica', formato: 'docx' }, { tipo: 'scarica', formato: 'txt' }, { tipo: 'scarica', formato: 'fdoc' }, { tipo: 'scarica', formato: 'odt' }, { tipo: 'scarica', formato: 'pdf' }]);
    expect(p.voci.every((v) => v.attiva === false)).toBe(true);
    expect(serializza(daTesto('x'))).toBe('{"v":1,"p":[[{"t":"x"}]]}');
  });
});
