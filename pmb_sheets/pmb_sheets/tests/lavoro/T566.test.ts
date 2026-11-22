// T566: password per aprire i file OpenDocument (comune/src/protezione/cifratura-odf.ts). File di confronto di LibreOffice 25 con la
// password «Prova-2026!» (LAVORO/studio-microsoft-office/libreoffice_cifratura.py): quello nuovo (pacchetto intero, AES-256-GCM, Argon2id)
// e quello classico ODF 1.3 (ogni parte AES-256-CBC, PBKDF2), in comune/tests/file-prova/cifratura/.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cifraOdf, decifraOdf, eOdfCifrato } from '@comune/protezione/cifratura-odf';
import { PasswordSbagliata } from '@comune/protezione/cifratura-agile';
import { leggiZip } from '@comune/formati/zip';
import { leggiOds } from '../../src/formati/ods-leggi';

const CARTELLA = '../../comune/tests/file-prova/cifratura';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const PASSWORD = 'Prova-2026!';
const testo = (voci: Map<string, Uint8Array>, n: string): string => new TextDecoder().decode(voci.get(n)!).replace(/<[^>]+>/g, '');

describe('T566: cifratura OpenDocument', () => {
  test('LibreOffice di oggi (pacchetto intero, AES-GCM, Argon2id): .ods e .odt', async () => {
    const ods = leggi('cifrato_libreoffice.ods');
    expect(eOdfCifrato(await leggiZip(ods))).toBe(true);
    const f = (await leggiOds(await decifraOdf(ods, PASSWORD))).scambio.fogli[0];
    expect([f.celle.A1, f.celle.A2]).toEqual(['Dato segreto àè', '42']);
    const odt = await leggiZip(await decifraOdf(leggi('cifrato_libreoffice.odt'), PASSWORD));
    expect(testo(odt, 'content.xml')).toContain('Testo segreto àè');
    await expect(decifraOdf(ods, 'sbagliata')).rejects.toBeInstanceOf(PasswordSbagliata);
  }, 60000);
  test('ODF 1.3 classico (ogni parte AES-256-CBC e PBKDF2)', async () => {
    const b = leggi('cifrato_libreoffice_odf13.ods');
    const f = (await leggiOds(await decifraOdf(b, PASSWORD))).scambio.fogli[0];
    expect([f.celle.A1, f.celle.A2]).toEqual(['Dato segreto àè', '42']);
    await expect(decifraOdf(b, 'prova-2026!')).rejects.toBeInstanceOf(PasswordSbagliata);
  });
  test('cifra e decifra: stesse parti, manifesto con i dati di cifratura, niente miniatura', async () => {
    const chiaro = await decifraOdf(leggi('cifrato_libreoffice_odf13.ods'), PASSWORD);
    const c = await cifraOdf(chiaro, 'àè€', 1000);
    const voci = await leggiZip(c);
    expect(eOdfCifrato(voci)).toBe(true);
    expect([...voci.keys()][0]).toBe('mimetype');
    expect(new TextDecoder().decode(voci.get('content.xml')!)).not.toContain('Dato segreto');
    const di = await leggiZip(await decifraOdf(c, 'àè€'));
    const prima = await leggiZip(chiaro);
    for (const [n, d] of prima) if (n !== 'META-INF/manifest.xml' && !n.startsWith('Thumbnails/')) expect(di.get(n), n).toEqual(d);
    expect(eOdfCifrato(di)).toBe(false);
    await expect(decifraOdf(c, 'altra')).rejects.toBeInstanceOf(PasswordSbagliata);
  });
  test('scrive i file di prova per LibreOffice (libreoffice_cifratura.py li apre con la password)', async () => {
    fs.writeFileSync(`${CARTELLA}/cifrato_pmb.ods`, await cifraOdf(await decifraOdf(leggi('cifrato_libreoffice.ods'), PASSWORD), PASSWORD));
    fs.writeFileSync(`${CARTELLA}/cifrato_pmb.odt`, await cifraOdf(await decifraOdf(leggi('cifrato_libreoffice.odt'), PASSWORD), PASSWORD));
  }, 60000);
});
