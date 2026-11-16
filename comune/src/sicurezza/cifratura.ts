// Modulo puro per la cifratura e decifratura sicura di file e documenti di pmb_office.
// Standard crittografico: PBKDF2-HMAC-SHA256 (100.000 iterazioni) + AES-256-GCM (128-bit tag).
// Zero dipendenze esterne: sfrutta la Web Crypto API (globalThis.crypto.subtle), disponibile
// sia nei moderni browser/WebView2 che nei runtime Node.js 20+.

const MAGIC_HEADER = new Uint8Array([0x46, 0x4F, 0x5F, 0x45, 0x4E, 0x43, 0x31]); // 'FO_ENC1'
const SALT_LEN = 16;
const IV_LEN = 12;
const ITERAZIONI_PBKDF2 = 100_000;

function cryptoApi(): SubtleCrypto {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API non disponibile in questo ambiente');
  }
  return c.subtle;
}

/**
 * Cifra un payload di byte arbitrari utilizzando una password testuale.
 * Restituisce un Uint8Array contenente: MAGIC (7 byte) + SALT (16 byte) + IV (12 byte) + CIPHERTEXT+TAG.
 */
export async function cifraDati(dati: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password || password.length === 0) {
    throw new Error('La password di cifratura non può essere vuota');
  }

  const subtle = cryptoApi();
  const salt = new Uint8Array(SALT_LEN);
  globalThis.crypto.getRandomValues(salt);

  const iv = new Uint8Array(IV_LEN);
  globalThis.crypto.getRandomValues(iv);

  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERAZIONI_PBKDF2,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertextBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    aesKey,
    dati as unknown as BufferSource
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  const out = new Uint8Array(MAGIC_HEADER.length + SALT_LEN + IV_LEN + ciphertext.length);
  let offset = 0;
  out.set(MAGIC_HEADER, offset); offset += MAGIC_HEADER.length;
  out.set(salt, offset); offset += SALT_LEN;
  out.set(iv, offset); offset += IV_LEN;
  out.set(ciphertext, offset);

  return out;
}

/**
 * Verifica se un buffer di byte è un file cifrato pmb_office (controllo magic header).
 */
export function eDatiCifrati(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC_HEADER.length + SALT_LEN + IV_LEN + 16) {
    return false;
  }
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (bytes[i] !== MAGIC_HEADER[i]) return false;
  }
  return true;
}

/**
 * Decifra un payload cifrato pmb_office con la password fornita.
 * Lancia un errore esplicito se la password è errata o il file è corrotto.
 */
export async function decifraDati(payload: Uint8Array, password: string): Promise<Uint8Array> {
  if (!eDatiCifrati(payload)) {
    throw new Error('Formato non valido: non è un archivio cifrato compatibile pmb_office');
  }

  const subtle = cryptoApi();
  let offset = MAGIC_HEADER.length;

  const salt = payload.subarray(offset, offset + SALT_LEN);
  offset += SALT_LEN;

  const iv = payload.subarray(offset, offset + IV_LEN);
  offset += IV_LEN;

  const ciphertext = payload.subarray(offset);

  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERAZIONI_PBKDF2,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      aesKey,
      ciphertext as unknown as BufferSource
    );
    return new Uint8Array(plainBuffer);
  } catch {
    throw new Error('Password errata o file cifrato danneggiato');
  }
}
