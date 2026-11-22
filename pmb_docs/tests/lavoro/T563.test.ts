// T563: password per aprire in pmb_docs (comune/src/protezione/password-file.ts): .docx di Word e .odt di LibreOffice con la password
// «Prova-2026!» (LAVORO/studio-microsoft-office/office_cifratura.py e libreoffice_cifratura.py, file in comune/tests/file-prova/cifratura/).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { importa, esportaSchede } from '../../src/formati/file';
import { PasswordRichiesta } from '@comune/protezione/password-file';
import { testoDi } from '../../src/modello/documento';

const CARTELLA = '../comune/tests/file-prova/cifratura';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
const PASSWORD = 'Prova-2026!';

describe('T563: password per aprire (pmb_docs)', () => {
  test.each(['cifrato_word.docx', 'cifrato_libreoffice.odt'])('%s: senza password o sbagliata si chiede; giusta si apre; si risalva cifrato', async (n) => {
    const b = leggi(n);
    await expect(importa(b, n)).rejects.toMatchObject({ name: 'PasswordRichiesta', sbagliata: false });
    await expect(importa(b, n, 'no')).rejects.toMatchObject({ name: 'PasswordRichiesta', sbagliata: true });
    const r = await importa(b, n, PASSWORD);
    expect(r.password).toBe(PASSWORD);
    expect(testoDi(r.doc)).toContain('Testo segreto àè');
    const formato = n.endsWith('.odt') ? 'odt' : 'docx';
    const di = await esportaSchede([{ titolo: 'x', doc: r.doc } as any], formato, 'nuova');
    await expect(importa(di, n)).rejects.toBeInstanceOf(PasswordRichiesta);
    expect(testoDi((await importa(di, n, 'nuova')).doc)).toContain('Testo segreto àè');
    expect((await importa(await esportaSchede([{ titolo: 'x', doc: r.doc } as any], formato), n)).password).toBeUndefined();
  }, 60000);
});
