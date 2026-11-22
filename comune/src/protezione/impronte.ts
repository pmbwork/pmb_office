// Impronte delle password di protezione (foglio, cartella, documento) come le scrivono Excel, Word e LibreOffice. Non sono cifratura:
// impediscono di togliere la protezione per sbaglio. La password non si salva mai: si salva solo la sua impronta.
// - Excel e Word moderni (ECMA-376, «algorithmName/hashValue/saltValue/spinCount»): H0 = SHA-512(sale ‖ password in UTF-16LE),
//   poi H(i+1) = SHA-512(H(i) ‖ i in 4 byte little-endian) per spinCount volte; impronta e sale in base64.
// - Excel vecchio (attributo «password», 4 cifre esadecimali): il codice a 16 bit della specifica ECMA-376 (parte 4, protezione del foglio).
// - LibreOffice (ODF 1.2, table:protection-key): base64(SHA-256(password in UTF-8)), o SHA-1 nei file più vecchi.
// SHA-512 è scritto qui (FIPS 180-4) perché si ripete 100 000 volte e deve essere veloce e sincrono; SHA-256 e SHA-1 da crypto.subtle.

/** Word-SHA-512 = «Limita modifica» di Word (chiave a 32 bit, poi SHA-512 con sale e giri: improntaWord). */
export type AlgoritmoImpronta = 'SHA-512' | 'SHA-256' | 'SHA-1' | 'legacy' | 'Word-SHA-512';
export interface Impronta { alg: AlgoritmoImpronta; hash: string; sale?: string; giri?: number }

export const GIRI_PREDEFINITI = 100000;
export const GIRI_MASSIMI = 10_000_000;

// ---- SHA-512 (FIPS 180-4) con coppie di interi a 32 bit ----
const K = [
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
];
const H0 = [0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179];

/** SHA-512 di un messaggio (FIPS 180-4). */
export function sha512(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const blocchi = Math.ceil((l + 17) / 128);
  const buf = new Uint8Array(blocchi * 128);
  buf.set(msg);
  buf[l] = 0x80;
  // lunghezza in bit, 128 bit big-endian (bastano 53 bit)
  const bit = l * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(buf.length - 8, Math.floor(bit / 0x100000000));
  dv.setUint32(buf.length - 4, bit >>> 0);
  const h = H0.slice();
  const w = new Int32Array(160);
  for (let b = 0; b < blocchi; b++) {
    for (let i = 0; i < 32; i++) w[i] = dv.getInt32(b * 128 + i * 4);
    for (let i = 16; i < 80; i++) {
      // σ0 = ROTR1 ^ ROTR8 ^ SHR7 di w[i-15]; σ1 = ROTR19 ^ ROTR61 ^ SHR6 di w[i-2]
      let xh = w[(i - 15) * 2], xl = w[(i - 15) * 2 + 1];
      const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
      const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
      xh = w[(i - 2) * 2]; xl = w[(i - 2) * 2 + 1];
      const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
      const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));
      let lo = (s0l >>> 0) + (s1l >>> 0) + (w[(i - 7) * 2 + 1] >>> 0) + (w[(i - 16) * 2 + 1] >>> 0);
      const hi = s0h + s1h + w[(i - 7) * 2] + w[(i - 16) * 2] + Math.floor(lo / 0x100000000);
      w[i * 2] = hi; w[i * 2 + 1] = lo >>> 0; lo = 0;
    }
    let ah = h[0], al = h[1], bh = h[2], bl = h[3], ch = h[4], cl = h[5], dh = h[6], dl = h[7];
    let eh = h[8], el = h[9], fh = h[10], fl = h[11], gh = h[12], gl = h[13], hh = h[14], hl = h[15];
    for (let i = 0; i < 80; i++) {
      // Σ1(e) = ROTR14 ^ ROTR18 ^ ROTR41; Ch(e,f,g); Σ0(a) = ROTR28 ^ ROTR34 ^ ROTR39; Maj(a,b,c)
      const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
      const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      let t1l = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + K[i * 2 + 1] + (w[i * 2 + 1] >>> 0);
      const t1h = (hh + S1h + chh + K[i * 2] + w[i * 2] + Math.floor(t1l / 0x100000000)) | 0;
      t1l >>>= 0;
      const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
      const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
      const mh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const ml = (al & bl) ^ (al & cl) ^ (bl & cl);
      let t2l = (S0l >>> 0) + (ml >>> 0);
      const t2h = (S0h + mh + Math.floor(t2l / 0x100000000)) | 0;
      t2l >>>= 0;
      hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
      let nl = (dl >>> 0) + t1l;
      eh = (dh + t1h + Math.floor(nl / 0x100000000)) | 0; el = nl >>> 0;
      dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
      nl = t1l + t2l;
      ah = (t1h + t2h + Math.floor(nl / 0x100000000)) | 0; al = nl >>> 0;
    }
    const somma = (k: number, xh: number, xl: number): void => {
      const lo = (h[k + 1] >>> 0) + (xl >>> 0);
      h[k] = (h[k] + xh + Math.floor(lo / 0x100000000)) | 0;
      h[k + 1] = lo >>> 0;
    };
    somma(0, ah, al); somma(2, bh, bl); somma(4, ch, cl); somma(6, dh, dl);
    somma(8, eh, el); somma(10, fh, fl); somma(12, gh, gl); somma(14, hh, hl);
  }
  const out = new Uint8Array(64);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 16; i++) ov.setUint32(i * 4, h[i] >>> 0);
  return out;
}

// ---- base64 e testo ----
export function aBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function daBase64(s: string): Uint8Array {
  const b = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out[i * 2] = c & 0xff; out[i * 2 + 1] = c >>> 8; }
  return out;
}

/** L'impronta SHA-512 ripetuta di Excel e Word (algorithmName="SHA-512"). */
export function improntaOffice(password: string, sale: Uint8Array, giri: number): string {
  const pw = utf16le(password);
  const primo = new Uint8Array(sale.length + pw.length);
  primo.set(sale); primo.set(pw, sale.length);
  let h = sha512(primo);
  const buf = new Uint8Array(68);
  for (let i = 0; i < giri; i++) {
    buf.set(h);
    buf[64] = i & 0xff; buf[65] = (i >>> 8) & 0xff; buf[66] = (i >>> 16) & 0xff; buf[67] = (i >>> 24) & 0xff;
    h = sha512(buf);
  }
  return aBase64(h);
}

/** Il codice a 16 bit di Excel vecchio (attributo password del foglio), 4 cifre esadecimali maiuscole. */
export function improntaExcelVecchia(password: string): string {
  let h = 0;
  for (let i = password.length - 1; i >= 0; i--) {
    h = ((h >> 14) & 0x01) | ((h << 1) & 0x7fff);
    h ^= password.charCodeAt(i) & 0xff;
  }
  h = ((h >> 14) & 0x01) | ((h << 1) & 0x7fff);
  h ^= password.length;
  h ^= 0xce4b;
  return h.toString(16).toUpperCase().padStart(4, '0');
}

// ---- Word: «Limita modifica» (w:documentProtection con cryptAlgorithmSid) ----
// La password (al massimo 15 caratteri, di ognuno il byte basso o, se è zero, quello alto) dà una chiave a 32 bit con le tabelle della
// specifica ECMA-376 parte 4 (§2.15.1.28); la chiave, scritta in esadecimale byte per byte dal meno significativo (senza zeri davanti,
// in maiuscolo) e in UTF-16LE, si mette dopo il sale e si passa a SHA-512, poi come improntaOffice per i giri. Così fa Word 2010 e dopo.
const CODICI_INIZIALI = [0xe1f0, 0x1d0f, 0xcc9c, 0x84c0, 0x110c, 0x0e10, 0xf1ce, 0x313e, 0x1872, 0xe139, 0xd40f, 0x84f9, 0x280c, 0xa96a, 0x4ec3];
const MATRICE = [
  [0xaefc, 0x4dd9, 0x9bb2, 0x2745, 0x4e8a, 0x9d14, 0x2a09], [0x7b61, 0xf6c2, 0xfda5, 0xeb6b, 0xc6f7, 0x9dcf, 0x2bbf], [0x4563, 0x8ac6, 0x05ad, 0x0b5a, 0x16b4, 0x2d68, 0x5ad0],
  [0x0375, 0x06ea, 0x0dd4, 0x1ba8, 0x3750, 0x6ea0, 0xdd40], [0xd849, 0xa0b3, 0x5147, 0xa28e, 0x553d, 0xaa7a, 0x44d5], [0x6f45, 0xde8a, 0xad35, 0x4a4b, 0x9496, 0x390d, 0x721a],
  [0xeb23, 0xc667, 0x9cef, 0x29ff, 0x53fe, 0xa7fc, 0x5fd9], [0x47d3, 0x8fa6, 0x0f6d, 0x1eda, 0x3db4, 0x7b68, 0xf6d0], [0xb861, 0x60e3, 0xc1c6, 0x93ad, 0x377b, 0x6ef6, 0xddec],
  [0x45a0, 0x8b40, 0x06a1, 0x0d42, 0x1a84, 0x3508, 0x6a10], [0xaa51, 0x4483, 0x8906, 0x022d, 0x045a, 0x08b4, 0x1168], [0x76b4, 0xed68, 0xcaf1, 0x85c3, 0x1ba7, 0x374e, 0x6e9c],
  [0x3730, 0x6e60, 0xdcc0, 0xa9a1, 0x4363, 0x86c6, 0x1dad], [0x3331, 0x6662, 0xccc4, 0x89a9, 0x0373, 0x06e6, 0x0dcc], [0x1021, 0x2042, 0x4084, 0x8108, 0x1231, 0x2462, 0x48c4],
];
/** La chiave a 32 bit della password per Word (0 per la password vuota). */
export function chiaveWord(password: string): number {
  const b = Array.from(password.slice(0, 15), (ch) => { const c = ch.charCodeAt(0); return (c & 0xff) !== 0 ? c & 0xff : (c >>> 8) & 0xff; });
  if (b.length === 0) return 0;
  let alta = CODICI_INIZIALI[b.length - 1];
  for (let i = 0; i < b.length; i++) {
    const riga = MATRICE[15 - b.length + i];
    for (let bit = 0; bit < 7; bit++) if (b[i] & (1 << bit)) alta ^= riga[bit];
  }
  let bassa = 0;
  for (let i = b.length - 1; i >= 0; i--) bassa = (((bassa >> 14) & 1) | ((bassa << 1) & 0x7fff)) ^ b[i];
  bassa = (((bassa >> 14) & 1) | ((bassa << 1) & 0x7fff)) ^ b.length ^ 0xce4b;
  return ((alta << 16) | bassa) >>> 0;
}
/** L'impronta di «Limita modifica» di Word (w:hash), in base64. */
export function improntaWord(password: string, sale: Uint8Array, giri: number): string {
  const k = chiaveWord(password);
  const esadecimale = [0, 1, 2, 3].map((i) => ((k >>> (i * 8)) & 0xff).toString(16)).join('').toUpperCase();
  const chiave = utf16le(esadecimale);
  const primo = new Uint8Array(sale.length + chiave.length);
  primo.set(sale); primo.set(chiave, sale.length);
  let h = sha512(primo);
  const buf = new Uint8Array(68);
  for (let i = 0; i < giri; i++) {
    buf.set(h);
    buf[64] = i & 0xff; buf[65] = (i >>> 8) & 0xff; buf[66] = (i >>> 16) & 0xff; buf[67] = (i >>> 24) & 0xff;
    h = sha512(buf);
  }
  return aBase64(h);
}

async function digest(alg: 'SHA-256' | 'SHA-1', dati: Uint8Array): Promise<string> {
  return aBase64(new Uint8Array(await crypto.subtle.digest(alg, new Uint8Array(dati))));
}

/** Le impronte da salvare per una password nuova: quella di Excel e Word (con un sale a caso) e quella di LibreOffice. */
export async function impronteNuove(password: string, giri = GIRI_PREDEFINITI): Promise<Impronta[]> {
  const sale = crypto.getRandomValues(new Uint8Array(16));
  return [
    { alg: 'SHA-512', hash: improntaOffice(password, sale, giri), sale: aBase64(sale), giri },
    { alg: 'SHA-256', hash: await digest('SHA-256', new TextEncoder().encode(password)) },
  ];
}

/** Le impronte da salvare per la protezione di un documento: quella di Word (con un sale a caso). */
export function impronteNuoveWord(password: string, giri = GIRI_PREDEFINITI): Impronta[] {
  const sale = crypto.getRandomValues(new Uint8Array(16));
  return [{ alg: 'Word-SHA-512', hash: improntaWord(password, sale, giri), sale: aBase64(sale), giri }];
}

/** true se la password corrisponde a una delle impronte (quella che si sa controllare). Senza impronte: true (protezione senza password). */
export async function verificaPassword(password: string, impronte: Impronta[] | undefined): Promise<boolean> {
  if (!impronte || impronte.length === 0) return true;
  for (const i of impronte) {
    try {
      if (i.alg === 'Word-SHA-512' && i.sale !== undefined) {
        const giri = Math.min(GIRI_MASSIMI, Math.max(0, Math.floor(i.giri ?? GIRI_PREDEFINITI)));
        if (improntaWord(password, daBase64(i.sale), giri) === i.hash) return true;
      } else if (i.alg === 'SHA-512' && i.sale !== undefined) {
        const giri = Math.min(GIRI_MASSIMI, Math.max(0, Math.floor(i.giri ?? GIRI_PREDEFINITI)));
        if (improntaOffice(password, daBase64(i.sale), giri) === i.hash) return true;
      } else if (i.alg === 'SHA-256' || i.alg === 'SHA-1') {
        if (await digest(i.alg, new TextEncoder().encode(password)) === i.hash) return true;
      } else if (i.alg === 'legacy') {
        if (improntaExcelVecchia(password) === i.hash.toUpperCase()) return true;
      }
    } catch { /* impronta rovinata: non vale */ }
  }
  return false;
}

/** L'impronta ripulita (da un file), o undefined. */
export function improntaValida(x: unknown): Impronta | undefined {
  const o = x as Record<string, unknown>;
  if (!o || typeof o !== 'object') return undefined;
  const b64 = (v: unknown): v is string => typeof v === 'string' && v.length <= 200 && /^[A-Za-z0-9+/]*={0,2}$/.test(v);
  if (o.alg === 'legacy') return typeof o.hash === 'string' && /^[0-9A-Fa-f]{1,4}$/.test(o.hash) ? { alg: 'legacy', hash: o.hash.toUpperCase() } : undefined;
  if (o.alg === 'SHA-256' || o.alg === 'SHA-1') return b64(o.hash) && o.hash !== '' ? { alg: o.alg, hash: o.hash } : undefined;
  if (o.alg === 'SHA-512' || o.alg === 'Word-SHA-512') {
    if (!b64(o.hash) || o.hash === '' || !b64(o.sale)) return undefined;
    const giri = typeof o.giri === 'number' && Number.isInteger(o.giri) && o.giri >= 0 && o.giri <= GIRI_MASSIMI ? o.giri : GIRI_PREDEFINITI;
    return { alg: o.alg, hash: o.hash, sale: o.sale, giri };
  }
  return undefined;
}
export function impronteValide(x: unknown): Impronta[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const v = x.map(improntaValida).filter((i): i is Impronta => i !== undefined).slice(0, 4);
  return v.length > 0 ? v : undefined;
}
