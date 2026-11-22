// T564: password per aprire i file .xlsx e .docx (cifratura «agile» di [MS-OFFCRYPTO], comune/src/protezione/cifratura-agile.ts) e
// scrittura dei file composti (comune/src/formati/cfb-scrivi.ts). File di confronto fatti da Excel e Word con la password «Prova-2026!»
// (LAVORO/studio-microsoft-office/office_cifratura.py) in comune/tests/file-prova/cifratura/.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CifraturaNonSupportata, PasswordSbagliata, cifraOffice, decifraOffice, eOfficeCifrato, spaziDatiPerProva } from '@comune/protezione/cifratura-agile';
import { scriviCfb } from '@comune/formati/cfb-scrivi';
import { leggiCfb } from '@comune/formati/cfb';
import { leggiZip } from '@comune/formati/zip';

const CARTELLA = '../../comune/tests/file-prova/cifratura';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const PASSWORD = 'Prova-2026!';

describe('T564: file composti', () => {
  test('flussi piccoli e grandi, cartelle annidate: si rileggono uguali', () => {
    const grande = new Uint8Array(70000).map((_, i) => (i * 7) & 0xff);
    const flussi = [
      { percorso: 'Uno', dati: new Uint8Array([1, 2, 3]) },
      { percorso: 'Vuoto', dati: new Uint8Array(0) },
      { percorso: 'Grande', dati: grande },
      { percorso: 'A/B/C', dati: new Uint8Array(5000).fill(9) },
      { percorso: 'A/Piccolo', dati: new Uint8Array(100).fill(4) },
      ...Array.from({ length: 20 }, (_, i) => ({ percorso: `Molti/F${i}`, dati: new Uint8Array([i]) })),
    ];
    const a = leggiCfb(scriviCfb(flussi));
    for (const f of flussi) expect(a.flusso(f.percorso), f.percorso).toEqual(f.dati);
    expect(a.esiste('A/B')).toBe(true);
  });
  test('oltre 109 settori della FAT (file di 8 MB) serve la DIFAT', () => {
    const dati = new Uint8Array(8 * 1024 * 1024);
    for (let i = 0; i < dati.length; i++) dati[i] = (i * 31 + (i >> 9)) & 0xff;
    const b = scriviCfb([{ percorso: 'Grosso', dati }]);
    expect(new DataView(b.buffer).getUint32(72, true)).toBeGreaterThan(0);
    expect(leggiCfb(b).flusso('Grosso')).toEqual(dati);
  });
  test('i nomi non validi o ripetuti si rifiutano', () => {
    expect(() => scriviCfb([{ percorso: 'a:b', dati: new Uint8Array(1) }])).toThrow();
    expect(() => scriviCfb([{ percorso: 'X', dati: new Uint8Array(1) }, { percorso: 'x', dati: new Uint8Array(1) }])).toThrow();
  });
});

describe('T564: cifratura agile come Office', () => {
  test('la cartella \\u0006DataSpaces è byte per byte quella di Excel e Word', () => {
    for (const n of ['cifrato_excel.xlsx', 'cifrato_word.docx']) {
      const a = leggiCfb(leggi(n));
      for (const f of spaziDatiPerProva()) expect(a.flusso(f.percorso), `${n} ${f.percorso}`).toEqual(f.dati);
    }
  });
  test('il file di Excel si riconosce e si apre con la password; con un\'altra no', async () => {
    const b = leggi('cifrato_excel.xlsx');
    expect(eOfficeCifrato(b)).toBe(true);
    const zip = await leggiZip(await decifraOffice(b, PASSWORD));
    expect(new TextDecoder().decode(zip.get('xl/sharedStrings.xml')!)).toContain('Dato segreto àè');
    await expect(decifraOffice(b, 'prova-2026!')).rejects.toBeInstanceOf(PasswordSbagliata);
  });
  test('il file di Word si apre con la password', async () => {
    const zip = await leggiZip(await decifraOffice(leggi('cifrato_word.docx'), PASSWORD));
    // Word può spezzare il testo in più pezzi (w:r): si guarda il testo senza i tag
    expect(new TextDecoder().decode(zip.get('word/document.xml')!).replace(/<[^>]+>/g, '')).toContain('Testo segreto àè');
  });
  test('cifra e decifra: stesso pacchetto; ogni volta sali e chiave nuove', async () => {
    const pacchetto = new Uint8Array(10000).map((_, i) => (i * 13) & 0xff);
    const a = await cifraOffice(pacchetto, 'àè€ password lunga', 1000);
    const b = await cifraOffice(pacchetto, 'àè€ password lunga', 1000);
    expect(a).not.toEqual(b);
    expect(eOfficeCifrato(a)).toBe(true);
    expect(await decifraOffice(a, 'àè€ password lunga')).toEqual(pacchetto);
    await expect(decifraOffice(a, 'altra')).rejects.toBeInstanceOf(PasswordSbagliata);
  });
  test('un pacchetto cifrato manomesso non passa il controllo di integrità', async () => {
    const pacchetto = new Uint8Array(5000).fill(1);
    const c = await cifraOffice(pacchetto, 'x', 10);
    const a = leggiCfb(c);
    const flussi = a.flussi.map((f) => ({ percorso: f.percorso, dati: f.dati.slice() }));
    flussi.find((f) => f.percorso === 'EncryptedPackage')!.dati[100] ^= 1;
    await expect(decifraOffice(scriviCfb(flussi), 'x')).rejects.toBeInstanceOf(CifraturaNonSupportata);
  });
  test('scrive i file di prova per Excel e Word (office_cifratura.py li apre con la password)', async () => {
    for (const [origine, destinazione] of [['cifrato_excel.xlsx', 'cifrato_pmb.xlsx'], ['cifrato_word.docx', 'cifrato_pmb.docx']]) {
      const pacchetto = await decifraOffice(leggi(origine), PASSWORD);
      fs.writeFileSync(`${CARTELLA}/${destinazione}`, await cifraOffice(pacchetto, PASSWORD));
    }
  });
});

describe('T564: password per aprire in pmb_sheets (importa ed esporta)', () => {
  test('.xlsx di Excel e .ods di LibreOffice: senza password o con quella sbagliata si chiede, con quella giusta si apre; si risalva cifrato', async () => {
    const { importa, esporta } = await import('../../src/formati/file');
    const { PasswordRichiesta } = await import('@comune/protezione/password-file');
    for (const n of ['cifrato_excel.xlsx', 'cifrato_libreoffice_odf13.ods']) {
      const b = leggi(n);
      await expect(importa(b, n)).rejects.toMatchObject({ name: 'PasswordRichiesta', sbagliata: false });
      await expect(importa(b, n, 'no')).rejects.toBeInstanceOf(PasswordRichiesta);
      const r = await importa(b, n, PASSWORD);
      expect(r.password).toBe(PASSWORD);
      expect(JSON.stringify(r.dati)).toContain('Dato segreto àè');
      const formato = n.endsWith('.ods') ? 'ods' : 'xlsx';
      const di = await esporta(r.dati, formato, 'nuova');
      await expect(importa(di, n)).rejects.toBeInstanceOf(PasswordRichiesta);
      expect(JSON.stringify((await importa(di, n, 'nuova')).dati)).toContain('Dato segreto àè');
      // senza password si risalva in chiaro
      expect((await importa(await esporta(r.dati, formato), n)).password).toBeUndefined();
    }
  }, 60000);
});
