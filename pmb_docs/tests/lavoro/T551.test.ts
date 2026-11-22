// T551: apertura dei documenti .doc di Word 97-2003 (formati/doc.ts). Un documento vero creato da LibreOffice (tests/file-prova/doc),
// confrontato con lo stesso documento salvato in .docx; lo stesso documento protetto da password; i casi che non si aprono; i simboli.
import fs from 'node:fs';
import { importaDoc, carattereSimbolo } from '../../src/formati/doc';
import { importaDocx } from '../../src/formati/docx';
import { importa, ESTENSIONI_APRI, titoloDaNome, formatoSoloLettura } from '../../src/formati/file';
import { CAMPO_PAGINA, testoDi, type Paragrafo } from '../../src/modello/documento';
import { creaCfb } from '../../../comune/tests/aiuti-cfb';

const CARTELLA = 'tests/file-prova/doc';
const leggi = (nome: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${nome}`));

describe('un documento vero creato da LibreOffice', () => {
  test('gli stessi paragrafi del lettore .docx: testo, caratteri, colori, allineamenti, rientri, spazi, titoli, elenchi, link, nota, tabella, salto di pagina, immagine', async () => {
    const { doc, avvisi } = importaDoc(leggi('prova.doc'));
    const docx = await importaDocx(leggi('prova.docx'));
    expect(doc.paragrafi.length).toBe(docx.paragrafi.length);
    doc.paragrafi.forEach((p, i) => {
      const atteso: Paragrafo = docx.paragrafi[i];
      // differenza voluta: la prima riga della tabella ha lo stile «intestazione di tabella» (grassetto) del documento, che il .doc mostra
      // (dal 0.4.14 il lettore .docx tiene lo stile come stile personale «Table Heading», in grassetto: il .doc lo scrive nei tratti)
      if (p.tb?.r === 0) {
        const { su, ...senzaStile } = atteso;
        expect({ ...p, runs: p.runs.map((r) => ({ ...r, g: false })) }, `paragrafo ${i}`).toEqual(senzaStile);
        expect(p.runs[0].g).toBe(true);
        expect(docx.stili?.find((s) => s.id === su)).toMatchObject({ nome: 'Table Heading', g: true, al: 'ce' });
        return;
      }
      // il .doc non legge gli stili del documento: il confronto è senza lo stile personale del paragrafo (Table Contents)
      const { su, ...senzaStile } = atteso; void su;
      expect(p, `paragrafo ${i}`).toEqual(senzaStile);
    });
    expect(docx.stili?.map((s) => s.nome)).toEqual(['Table Heading', 'Table Contents']);
    expect(avvisi).toEqual(["È un documento del vecchio Word 97-2003 (.doc): Salva lo salva in .docx con un nome nuovo e l'originale non cambia."]);
    // alcuni controlli espliciti
    const per = (testo: string): Paragrafo => doc.paragrafi.find((p) => testoDi({ paragrafi: [p] }).includes(testo))!;
    expect(per('Titolo del documento').st).toBe('t');
    expect(per('Capitolo uno').st).toBe('1');
    expect(per('primo punto').el).toBe('p');
    expect(per('primo numero').el).toBe('n');
    expect(per('Ecco').runs.find((r) => r.t === 'un link')?.u).toBe('https://www.example.com/');
    expect(per('Pagina due').sp).toBe(true);
    const im = per('Immagine').runs.find((r) => r.im)?.im;
    expect(im?.s.startsWith('data:image/png;base64,iVBORw0KGgo')).toBe(true);
    expect([im?.w, im?.h]).toEqual([80, 60]);
    expect(testoDi({ paragrafi: doc.paragrafi.slice(-1) })).toBe('1. Testo della nota');
    expect(doc.intestazione?.[0].runs[0].t).toBe('Intestazione del documento');
    expect(doc.piede?.[0].runs.map((r) => r.t).join('')).toBe(`Pagina ${CAMPO_PAGINA}`);
    expect(doc.paragrafi.filter((p) => p.tb).length).toBe(9);
  });

  test('lo stesso documento protetto da password: si apre con la password giusta, non con un\'altra', () => {
    const chiaro = importaDoc(leggi('prova.doc')).doc;
    expect(importaDoc(leggi('prova-password.doc'), 'segreta').doc).toEqual(chiaro);
    expect(() => importaDoc(leggi('prova-password.doc'), 'sbagliata')).toThrow(/protetto da password/);
    expect(() => importaDoc(leggi('prova-password.doc'))).toThrow(/protetto da password/);
  });

  test('si apre da importa(): formato .docx per Salva, avviso, nella finestra Apri', async () => {
    const r = await importa(leggi('prova.doc'), 'Lettera 2001.doc');
    expect(r.formato).toBe('docx');
    expect(r.avviso).toMatch(/Salva lo salva in \.docx/);
    expect(titoloDaNome('Lettera 2001.doc')).toBe('Lettera 2001');
    expect(formatoSoloLettura('modello.dot')).toBe('doc');
    expect(ESTENSIONI_APRI.split(',')).toEqual(expect.arrayContaining(['.doc', '.dot']));
    // una pagina web salvata da Word con l'estensione .doc si apre come pagina web, non come testo con i tag
    const html = await importa(new TextEncoder().encode('<html><body><h1>Relazione</h1><p>Testo <b>forte</b></p></body></html>'), 'relazione.doc');
    expect(testoDi(html.doc)).toBe('Relazione\nTesto forte');
    expect(html.avviso).toMatch(/Pagina web/);
  });
});

describe('casi che non si aprono: errori chiari', () => {
  const word = (ident: number, nFib = 0xc1, indicatori = 0): Uint8Array => {
    const w = new Uint8Array(1024);
    const dv = new DataView(w.buffer);
    dv.setUint16(0, ident, true); dv.setUint16(2, nFib, true); dv.setUint16(10, indicatori, true);
    return w;
  };
  test('Word 6.0/95 e Word 2, fogli di Excel, file cifrati con il vecchio metodo, file rovinati', async () => {
    expect(() => importaDoc(creaCfb([['WordDocument', word(0xa5dc, 0x65)]]))).toThrow(/^Il documento è di una versione di Word più vecchia della 97/);
    expect(() => importaDoc(creaCfb([['WordDocument', word(0xa5ec, 0x65)]]))).toThrow(/più vecchia della 97/);
    await expect(importa(Uint8Array.from([0xdb, 0xa5, 0x2d, 0x00, 0, 0, 0, 0]), 'vecchio.doc')).rejects.toThrow(/più vecchia della 97/);
    expect(() => importaDoc(creaCfb([['Workbook', new Uint8Array(100)]]))).toThrow(/^È un foglio di Excel: si apre con pmb_sheets\.$/);
    expect(() => importaDoc(creaCfb([['WordDocument', word(0xa5ec, 0xc1, 0x0100 | 0x8000)], ['0Table', new Uint8Array(100)]]))).toThrow(/protetto da password/);
    expect(() => importaDoc(creaCfb([['WordDocument', word(0x1234)]]))).toThrow(/^File \.doc non valido: intestazione del documento non riconosciuta$/);
    expect(() => importaDoc(new Uint8Array(600))).toThrow(/File \.doc non valido/);
    // un .doc troncato non fa cadere il programma
    const buono = leggi('prova.doc');
    for (const n of [600, 2000, 5000, 9000]) {
      try { importaDoc(buono.subarray(0, n)); } catch (e) { expect(String(e)).toMatch(/\.doc|composto/); }
    }
  });
});

describe('simboli inseriti (Inserisci › Simbolo)', () => {
  test('tipo Symbol, Wingdings e caratteri normali', () => {
    expect(carattereSimbolo('Symbol', 0xf06d)).toBe('μ');
    expect(carattereSimbolo('Symbol', 0xf0b0)).toBe('°');
    expect(carattereSimbolo('Symbol', 0xf0b1)).toBe('±');
    expect(carattereSimbolo('Symbol', 0xf044)).toBe('Δ');
    expect(carattereSimbolo('Wingdings', 0xf0fc)).toBe('✓');
    expect(carattereSimbolo('Wingdings', 0xf0e0)).toBe('➔');
    expect(carattereSimbolo('Arial', 0x00e9)).toBe('é');
    expect(carattereSimbolo('Wingdings', 0xf001)).toBe('');
  });
});
