// Decifratura dei file di Office 97-2003 protetti con «password per aprire» (specifica pubblica [MS-OFFCRYPTO] di Microsoft):
// RC4 con chiave da MD5 (Office 97/2000) e RC4 «CryptoAPI» con chiave da SHA-1 (Office XP/2003). La usano i lettori dei .xls e dei .doc.
// Le funzioni di hash (MD5 da RFC 1321, SHA-1 da FIPS 180) e RC4 sono scritte qui perché la Web Crypto API non ha MD5 né RC4 e
// lavora solo in modo asincrono. Servono solo a leggere file vecchi: non si usano per proteggere niente.
// Scritto per pmb_office a partire dalle specifiche, senza codice di altri programmi.

/** La password che Excel usa da solo per i file «di sola lettura consigliata»: con lei il file si apre senza chiedere niente. */
export const PASSWORD_PREDEFINITA_EXCEL = 'VelvetSweatshop';

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));

/** MD5 di un insieme di byte (RFC 1321). */
export function md5(dati: Uint8Array): Uint8Array {
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const lunghezza = dati.length;
  const pieno = new Uint8Array(((lunghezza + 8) >> 6) * 64 + 64);
  pieno.set(dati);
  pieno[lunghezza] = 0x80;
  const dv = new DataView(pieno.buffer);
  dv.setUint32(pieno.length - 8, (lunghezza * 8) >>> 0, true);
  dv.setUint32(pieno.length - 4, Math.floor((lunghezza * 8) / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let blocco = 0; blocco < pieno.length; blocco += 64) {
    const m = Array.from({ length: 16 }, (_, i) => dv.getUint32(blocco + i * 4, true));
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d; d = c; c = b;
      b = (b + rotl((a + f + k[i] + m[g]) | 0, s[i])) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((x, i) => ov.setUint32(i * 4, x >>> 0, true));
  return out;
}

/** SHA-1 di un insieme di byte (FIPS 180). */
export function sha1(dati: Uint8Array): Uint8Array {
  const lunghezza = dati.length;
  const pieno = new Uint8Array(((lunghezza + 8) >> 6) * 64 + 64);
  pieno.set(dati);
  pieno[lunghezza] = 0x80;
  const dv = new DataView(pieno.buffer);
  dv.setUint32(pieno.length - 4, (lunghezza * 8) >>> 0, false);
  dv.setUint32(pieno.length - 8, Math.floor((lunghezza * 8) / 2 ** 32), false);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);
  for (let blocco = 0; blocco < pieno.length; blocco += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(blocco + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let [a, b, c, d, e] = h;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = tmp;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  h.forEach((x, i) => ov.setUint32(i * 4, x >>> 0, false));
  return out;
}

/** Il flusso di byte di RC4 per una chiave: i primi n byte. */
export function flussoRc4(chiave: Uint8Array, n: number): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + chiave[i % chiave.length]) & 0xff;
    const t = s[i]; s[i] = s[j]; s[j] = t;
  }
  const out = new Uint8Array(n);
  for (let k = 0, i = 0, j = 0; k < n; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    const t = s[i]; s[i] = s[j]; s[j] = t;
    out[k] = s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

const utf16 = (s: string): Uint8Array => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[2 * i] = s.charCodeAt(i) & 0xff; b[2 * i + 1] = s.charCodeAt(i) >> 8; } return b; };
const unisci = (...parti: Uint8Array[]): Uint8Array => { const o = new Uint8Array(parti.reduce((t, p) => t + p.length, 0)); let i = 0; for (const p of parti) { o.set(p, i); i += p.length; } return o; };
const u32 = (n: number): Uint8Array => Uint8Array.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const uguali = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Una cifratura RC4 riconosciuta: dà la chiave di ogni blocco del file. */
export type ChiaveBlocco = (blocco: number) => Uint8Array;

/**
 * Dai dati della cifratura (in un .xls il record FILEPASS dopo il tipo, in un .doc l'inizio del flusso della tabella) e da una password
 * alla funzione che dà la chiave di ogni blocco, oppure null se la password è sbagliata o la cifratura non è RC4.
 * `dati` comincia con la versione (2 byte maggiore, 2 byte minore).
 */
export function chiaveRc4(dati: Uint8Array, password: string): ChiaveBlocco | null {
  if (dati.length < 4) return null;
  const dv = new DataView(dati.buffer, dati.byteOffset, dati.byteLength);
  const maggiore = dv.getUint16(0, true), minore = dv.getUint16(2, true);
  const pw = utf16(password.slice(0, 255));
  if (maggiore === 1 && minore === 1 && dati.length >= 52) {
    // RC4 di Office 97/2000: sale, verificatore cifrato e suo hash cifrato, 16 byte ciascuno
    const sale = dati.subarray(4, 20), verificatore = dati.subarray(20, 36), hashVerificatore = dati.subarray(36, 52);
    const h0 = md5(pw).subarray(0, 5);
    const ripetuto = new Uint8Array(16 * 21);
    for (let i = 0; i < 16; i++) { ripetuto.set(h0, i * 21); ripetuto.set(sale, i * 21 + 5); }
    const h1 = md5(ripetuto).subarray(0, 5);
    const chiave: ChiaveBlocco = (blocco) => md5(unisci(h1, u32(blocco)));
    const flusso = flussoRc4(chiave(0), 32);
    const v = verificatore.map((x, i) => x ^ flusso[i]);
    const hv = hashVerificatore.map((x, i) => x ^ flusso[16 + i]);
    return uguali(md5(v), hv) ? chiave : null;
  }
  if ((maggiore === 2 || maggiore === 3 || maggiore === 4) && minore === 2 && dati.length >= 12) {
    // RC4 «CryptoAPI» di Office XP/2003: intestazione con algoritmo e lunghezza della chiave, poi il verificatore con sale da 16 byte
    const lunghezzaIntestazione = dv.getUint32(8, true);
    const inizioIntestazione = 12;
    if (inizioIntestazione + 32 > dati.length) return null;
    const algoritmo = dv.getUint32(inizioIntestazione + 8, true);
    const bitChiave = dv.getUint32(inizioIntestazione + 16, true) || 40;
    if (algoritmo !== 0 && algoritmo !== 0x6801) return null; // solo RC4
    const p = inizioIntestazione + lunghezzaIntestazione;
    if (p + 4 + 16 + 16 + 4 + 20 > dati.length) return null;
    const dimSale = dv.getUint32(p, true);
    const sale = dati.subarray(p + 4, p + 4 + dimSale);
    const verificatore = dati.subarray(p + 4 + dimSale, p + 20 + dimSale);
    const dimHash = dv.getUint32(p + 20 + dimSale, true);
    const hashVerificatore = dati.subarray(p + 24 + dimSale, p + 24 + dimSale + dimHash);
    const h0 = sha1(unisci(sale, pw));
    const byteChiave = Math.max(5, Math.min(16, bitChiave / 8));
    const chiave: ChiaveBlocco = (blocco) => {
      const h = sha1(unisci(h0, u32(blocco))).subarray(0, byteChiave);
      // con 40 bit la chiave si allunga a 128 bit con byte a zero
      if (byteChiave === 5) { const k = new Uint8Array(16); k.set(h); return k; }
      return h;
    };
    const flusso = flussoRc4(chiave(0), 16 + dimHash);
    const v = verificatore.map((x, i) => x ^ flusso[i]);
    const hv = hashVerificatore.map((x, i) => x ^ flusso[16 + i]);
    return uguali(sha1(v).subarray(0, dimHash), hv.subarray(0, 20)) ? chiave : null;
  }
  return null;
}

/** Il flusso di chiave di una cifratura a blocchi: il byte del flusso per la posizione p, con una chiave nuova ogni `blocco` byte. */
export function flussoChiaveABlocchi(chiave: ChiaveBlocco, dimBlocco: number): (p: number) => number {
  let numero = -1;
  let corrente: Uint8Array = new Uint8Array(0);
  return (p) => {
    const b = Math.floor(p / dimBlocco);
    if (b !== numero) { numero = b; corrente = flussoRc4(chiave(b), dimBlocco); }
    return corrente[p % dimBlocco];
  };
}
