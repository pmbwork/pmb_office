import { describe, it, expect } from 'vitest';
import { cifraDati, decifraDati, eDatiCifrati } from '@comune/sicurezza/cifratura';

describe('T507-T508: Modulo Cifratura e Sicurezza File (AES-GCM 256)', () => {
  it('cifra e decifra un documento con la password corretta (round-trip)', async () => {
    const testoOriginale = 'Documento riservato con segreti aziendali di pmb_office 2026.';
    const bytesOriginali = new TextEncoder().encode(testoOriginale);
    const password = 'PasswordSicurissima123!';

    const cifrato = await cifraDati(bytesOriginali, password);

    expect(cifrato).toBeInstanceOf(Uint8Array);
    expect(cifrato.length).toBeGreaterThan(bytesOriginali.length);
    expect(eDatiCifrati(cifrato)).toBe(true);

    const decifrato = await decifraDati(cifrato, password);
    const testoDecifrato = new TextDecoder().decode(decifrato);

    expect(testoDecifrato).toBe(testoOriginale);
  });

  it('lancia un errore con password errata', async () => {
    const bytes = new TextEncoder().encode('Dati protetti');
    const cifrato = await cifraDati(bytes, 'PasswordGiusta');

    await expect(decifraDati(cifrato, 'PasswordSbagliata')).rejects.toThrow(
      'Password errata o file cifrato danneggiato'
    );
  });

  it('identifica correttamente file non cifrati', () => {
    const fileNormale = new TextEncoder().encode('File di testo comune');
    expect(eDatiCifrati(fileNormale)).toBe(false);
  });
});
