// T562: funzioni piccole del punto 8 dello studio in pmb_docs: maiuscole e minuscole (comune/src/maiuscole.ts, modello/maiuscole.ts),
// codice QR (comune/src/qr.ts; il PNG si legge con il lettore di OpenCV: vedi LAVORO/studio-microsoft-office), leggi ad alta voce
// (comune/src/voce.ts, con una sintesi vocale finta), filigrana (modello, PDF, .docx come Word). Il .docx resta in tmp/pmb-T562.docx.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { trasforma, modoDelGiro } from '@comune/maiuscole';
import { codiceQR, pngQR, qrComeDataUrl } from '@comune/qr';
import { ferma, leggi, staLeggendo } from '@comune/voce';
import { cambiaMaiuscole } from '../../src/modello/maiuscole';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { esportaPdf } from '../../src/formati/pdf';
import { daTesto, deserializza, serializza, statoIniziale, testoDi, type Documento } from '../../src/modello/documento';

describe('T562: maiuscole e minuscole', () => {
  test('i cinque modi e il giro di Maiusc+F3; la lunghezza non cambia (ß resta)', () => {
    expect(trasforma('ciao mondo. che bello', 'maiuscolo')).toBe('CIAO MONDO. CHE BELLO');
    expect(trasforma('CIAO Mondo', 'minuscolo')).toBe('ciao mondo');
    expect(trasforma("l'albero di natale", 'iniziali')).toBe("L'albero Di Natale");
    expect(trasforma('CIAO MONDO. CHE BELLO! ecco', 'frase')).toBe('Ciao mondo. Che bello! Ecco');
    expect(trasforma('Ciao', 'inverti')).toBe('cIAO');
    expect(trasforma('straße', 'maiuscolo')).toBe('STRAßE');
    expect([modoDelGiro('ciao'), modoDelGiro('CIAO'), modoDelGiro('Ciao')]).toEqual(['maiuscolo', 'iniziali', 'minuscolo']);
  });
  test('nel documento: la selezione cambia tenendo il grassetto; senza selezione la parola del cursore', () => {
    const doc: Documento = { paragrafi: [{ runs: [{ t: 'ciao ', g: false, c: false, s: false }, { t: 'mondo', g: true, c: false, s: false }] }] };
    const r = cambiaMaiuscole({ ...statoIniziale(doc), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 10 } } }, 'maiuscolo');
    expect(r.doc.paragrafi[0].runs).toEqual([{ t: 'CIAO ', g: false, c: false, s: false }, { t: 'MONDO', g: true, c: false, s: false }]);
    const p = cambiaMaiuscole({ ...statoIniziale(doc), sel: { ancora: { p: 0, o: 7 }, fuoco: { p: 0, o: 7 } } }, 'giro');
    expect(testoDi(p.doc)).toBe('ciao MONDO');
    expect(p.sel).toEqual({ ancora: { p: 0, o: 5 }, fuoco: { p: 0, o: 10 } });
  });
});

describe('T562: codice QR', () => {
  test('grandezza della versione giusta, motivi fissi, PNG valido', () => {
    const m = codiceQR('Ciao');
    expect(m.length).toBe(21);                               // versione 1
    expect([m[0][0], m[0][6], m[6][6], m[1][1], m[2][2]]).toEqual([true, true, true, false, true]);  // motivo dell'angolo
    expect(codiceQR('x'.repeat(200)).length).toBe(4 * 10 + 17);   // 200 byte in M: versione 10
    const png = pngQR(m, 4);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(qrComeDataUrl('Ciao', 6).w).toBe((21 + 8) * 6);
    expect(() => codiceQR('x'.repeat(3000))).toThrow();
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T562-qr.png'), pngQR(codiceQR('https://www.example.com/pmb_office'), 6));
  });
});

describe('T562: leggi ad alta voce', () => {
  test('solo voci del computer; un pezzo dopo l\'altro; ferma', () => {
    const dette: string[] = [];
    let ultima: { onend?: () => void } | null = null;
    const voci = [{ lang: 'en-US', localService: true, name: 'A' }, { lang: 'it-IT', localService: false, name: 'Rete' }, { lang: 'it-IT', localService: true, name: 'Elsa' }];
    vi.stubGlobal('speechSynthesis', { getVoices: () => voci, speak: (u: { text: string; onend?: () => void }) => { dette.push(u.text); ultima = u; }, cancel: () => {} });
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; voice: unknown; lang = ''; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } });
    let usata = '';
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; lang = ''; onend?: () => void; onerror?: () => void; set voice(v: { name: string }) { usata = v.name; } constructor(t: string) { this.text = t; } });
    expect(leggi({ pezzi: ['Primo', '', 'Secondo'], lingua: 'it-IT' })).toBe(true);
    expect(usata).toBe('Elsa');                 // non quella in rete
    expect(dette).toEqual(['Primo']);
    (ultima as unknown as { onend: () => void }).onend();
    expect(dette).toEqual(['Primo', 'Secondo']);
    expect(staLeggendo()).toBe(true);
    ferma();
    expect(staLeggendo()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('T562: filigrana', () => {
  test('.pdoc la tiene; il PDF la scrive in diagonale; il .docx come Word (forma VML nell\'intestazione) e la rilegge', async () => {
    const doc: Documento = { ...daTesto('Testo del documento.'), filigrana: 'BOZZA' };
    expect(deserializza(serializza(doc)).filigrana).toBe('BOZZA');
    expect(() => deserializza(JSON.stringify({ ...JSON.parse(serializza(doc)), fg: 'x'.repeat(100) }))).toThrow();
    const pdf = new TextDecoder('latin1').decode(esportaPdf(doc));
    expect(pdf).toMatch(/0\.7071 0\.7071 -0\.7071 0\.7071 [\d.]+ [\d.]+ Tm \(BOZZA\) Tj/);
    const b = await esportaDocx(doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T562.docx'), b);
    const z = await leggiZip(b);
    const h = new TextDecoder().decode(z.get('word/header1.xml')!);
    expect(h).toContain('id="PowerPlusWaterMarkObject1"');
    expect(h).toContain('rotation:315');
    expect(h).toContain('string="BOZZA"');
    const r = await importaDocx(b);
    expect(r.filigrana).toBe('BOZZA');
    expect(r.intestazione).toBeUndefined();          // l'intestazione resta vuota: c'era solo la filigrana
  });
});
