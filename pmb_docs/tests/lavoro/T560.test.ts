// T560: documento protetto in sola lettura (come «Limita modifica» di Word): con la protezione nessuna modifica entra nella cronologia
// (modello/storia.ts), la password si salva solo come impronta di Word (comune/protezione/impronte.ts), .pdoc e .docx come Word.
// File di confronto: tests/file-prova/protezione/word-protezione.docx (fatto da Word con LAVORO/studio-microsoft-office/word_protezione.py,
// password «Prova123»). Il .docx scritto resta in tmp/pmb-T560.docx per riaprirlo in Word.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { chiaveWord, impronteNuoveWord, verificaPassword } from '@comune/protezione/impronte';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { daTesto, deserializza, serializza, statoIniziale, testoDi } from '../../src/modello/documento';
import { annulla, nuovaStoria, registra } from '../../src/modello/storia';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor } from '../../src/editor/azioni';

describe('T560: sola lettura', () => {
  test('la chiave a 32 bit di Word e l\'impronta si verificano', () => {
    expect(chiaveWord('')).toBe(0);
    const i = impronteNuoveWord('Prova123', 1000);
    return Promise.all([verificaPassword('Prova123', i), verificaPassword('prova123', i)]).then(([a, b]) => { expect(a).toBe(true); expect(b).toBe(false); });
  });
  test('con la protezione scrivere, cancellare e formattare non cambia niente; muoversi sì; togliere la protezione entra', () => {
    const doc = { ...daTesto('Testo protetto'), protezione: {} };
    const ed = nuovoEditor({ ...statoIniziale(doc), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } } });
    for (const a of [{ tipo: 'testo', testo: 'x' }, { tipo: 'invio' }, { tipo: 'cancella', direzione: 'avanti', parola: false }, { tipo: 'alterna', chiave: 'g', valore: true }] as const) {
      const r = eseguiAzioneFormato(ed, a as never).ed;
      expect(testoDi(r.storia.presente.doc), a.tipo).toBe('Testo protetto');
      expect(r.storia.presente.doc).toBe(ed.storia.presente.doc);
    }
    const mosso = eseguiAzioneFormato(ed, { tipo: 'muovi', mossa: 'destra', estendi: false }).ed;
    expect(mosso.storia.presente.sel.fuoco.o).toBe(1);
    const s = nuovaStoria(statoIniziale(doc));
    const libero = registra(s, { ...s.presente, doc: daTesto('Testo protetto') });
    expect(libero.presente.doc.protezione).toBeUndefined();
    expect(annulla(libero).presente.doc.protezione).toEqual({});
  });
  test('.pdoc: la protezione e l\'impronta si salvano e si rileggono', () => {
    const doc = { ...daTesto('a'), protezione: { impronte: impronteNuoveWord('x', 10) } };
    expect(deserializza(serializza(doc))).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(() => deserializza(JSON.stringify({ ...JSON.parse(serializza(doc)), pr: 5 }))).toThrow();
  });
});

describe('T560: .docx come Word', () => {
  test('il documento di Word: protetto in sola lettura, la sua password lo sblocca', async () => {
    const d = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/protezione/word-protezione.docx')));
    expect(d.protezione?.impronte?.[0].alg).toBe('Word-SHA-512');
    expect(await verificaPassword('Prova123', d.protezione!.impronte)).toBe(true);
    expect(await verificaPassword('Prova12', d.protezione!.impronte)).toBe(false);
  });
  test('scritto da pmb_docs come Word (documentProtection readOnly con cryptAlgorithmSid 14) e riletto uguale', async () => {
    const doc = { ...daTesto('Documento protetto da pmb_docs.'), protezione: { impronte: impronteNuoveWord('Prova123') } };
    const b = await esportaDocx(doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T560.docx'), b);
    const s = new TextDecoder().decode((await leggiZip(b)).get('word/settings.xml')!);
    expect(s).toMatch(/<w:documentProtection w:edit="readOnly" w:enforcement="1" w:cryptProviderType="rsaAES" w:cryptAlgorithmClass="hash" w:cryptAlgorithmType="typeAny" w:cryptAlgorithmSid="14" w:cryptSpinCount="100000" w:hash="[^"]+" w:salt="[^"]+"\/>/);
    const r = await importaDocx(b);
    expect(r.protezione).toEqual(doc.protezione);
    const senza = await importaDocx(await esportaDocx({ ...doc, protezione: {} }));
    expect(senza.protezione).toEqual({});
  });
});
