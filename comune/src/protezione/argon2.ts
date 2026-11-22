// BLAKE2b (RFC 7693) e Argon2id (RFC 9106): la funzione che i file OpenDocument cifrati dal LibreOffice di oggi usano per ricavare la chiave
// dalla password (molta memoria, per rendere lenti i tentativi). La Web Crypto API non le ha: sono scritte qui, con numeri a 64 bit tenuti
// come coppie di numeri a 32 bit (parte bassa, parte alta). Servono a leggere i file; pmb_office scrive i file con PBKDF2, il metodo dello standard ODF.
// Scritto per pmb_office a partire dalle specifiche, senza codice di altri programmi.

// ---- BLAKE2b ----
const IV_BLAKE = new Uint32Array([
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372, 0x5f1d36f1, 0xa54ff53a,
  0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);
const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4], [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13], [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11], [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5], [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

/** v[a] += v[b] + m (tutti a 64 bit; a, b sono indici di coppie nell'array a 32 bit). */
function somma(v: Uint32Array, a: number, b: number, mlo: number, mhi: number): void {
  const lo = v[a] + v[b] + mlo;
  v[a + 1] = v[a + 1] + v[b + 1] + mhi + Math.floor(lo / 0x100000000);
  v[a] = lo;
}
/** v[d] = (v[d] ^ v[a]) ruotato a destra di n bit. */
function ruota(v: Uint32Array, d: number, a: number, n: number): void {
  const xlo = v[d] ^ v[a], xhi = v[d + 1] ^ v[a + 1];
  if (n === 32) { v[d] = xhi; v[d + 1] = xlo; return; }
  if (n < 32) { v[d] = (xlo >>> n) | (xhi << (32 - n)); v[d + 1] = (xhi >>> n) | (xlo << (32 - n)); return; }
  const k = n - 32; // 63: a destra di 63 = a sinistra di 1
  v[d] = (xhi >>> k) | (xlo << (32 - k)); v[d + 1] = (xlo >>> k) | (xhi << (32 - k));
}

function comprimiBlake(h: Uint32Array, blocco: Uint8Array, contatore: number, ultimo: boolean): void {
  const v = new Uint32Array(32), m = new Uint32Array(32);
  v.set(h); v.set(IV_BLAKE, 16);
  v[24] ^= contatore >>> 0; v[25] ^= Math.floor(contatore / 0x100000000);
  if (ultimo) { v[28] = ~v[28]; v[29] = ~v[29]; }
  for (let i = 0; i < 32; i++) m[i] = blocco[i * 4] | (blocco[i * 4 + 1] << 8) | (blocco[i * 4 + 2] << 16) | (blocco[i * 4 + 3] << 24);
  const g = (a: number, b: number, c: number, d: number, x: number, y: number): void => {
    somma(v, a, b, m[x], m[x + 1]); ruota(v, d, a, 32);
    somma(v, c, d, 0, 0); ruota(v, b, c, 24);
    somma(v, a, b, m[y], m[y + 1]); ruota(v, d, a, 16);
    somma(v, c, d, 0, 0); ruota(v, b, c, 63);
  };
  for (let r = 0; r < 12; r++) {
    const s = SIGMA[r % 10];
    g(0, 8, 16, 24, s[0] * 2, s[1] * 2); g(2, 10, 18, 26, s[2] * 2, s[3] * 2); g(4, 12, 20, 28, s[4] * 2, s[5] * 2); g(6, 14, 22, 30, s[6] * 2, s[7] * 2);
    g(0, 10, 20, 30, s[8] * 2, s[9] * 2); g(2, 12, 22, 24, s[10] * 2, s[11] * 2); g(4, 14, 16, 26, s[12] * 2, s[13] * 2); g(6, 8, 18, 28, s[14] * 2, s[15] * 2);
  }
  for (let i = 0; i < 16; i++) h[i] ^= v[i] ^ v[i + 16];
}

/** BLAKE2b senza chiave, con un risultato da 1 a 64 byte. */
export function blake2b(dati: Uint8Array, lunghezza = 64): Uint8Array {
  if (lunghezza < 1 || lunghezza > 64) throw new Error('BLAKE2b: lunghezza non valida');
  const h = new Uint32Array(IV_BLAKE);
  h[0] ^= 0x01010000 ^ lunghezza;
  const blocco = new Uint8Array(128);
  let p = 0;
  while (dati.length - p > 128) { comprimiBlake(h, dati.subarray(p, p + 128), p + 128, false); p += 128; }
  blocco.fill(0); blocco.set(dati.subarray(p));
  comprimiBlake(h, blocco, dati.length, true);
  const out = new Uint8Array(64);
  for (let i = 0; i < 16; i++) { out[i * 4] = h[i]; out[i * 4 + 1] = h[i] >>> 8; out[i * 4 + 2] = h[i] >>> 16; out[i * 4 + 3] = h[i] >>> 24; }
  return out.slice(0, lunghezza);
}

// ---- Argon2id ----
const le32 = (n: number): Uint8Array => Uint8Array.from([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const unisci = (...parti: Uint8Array[]): Uint8Array => { const o = new Uint8Array(parti.reduce((t, x) => t + x.length, 0)); let i = 0; for (const x of parti) { o.set(x, i); i += x.length; } return o; };

/** H' di RFC 9106 3.3: un hash di lunghezza qualsiasi fatto con BLAKE2b. */
function hashLungo(dati: Uint8Array, lunghezza: number): Uint8Array {
  const ingresso = unisci(le32(lunghezza), dati);
  if (lunghezza <= 64) return blake2b(ingresso, lunghezza);
  const out = new Uint8Array(lunghezza);
  const r = Math.ceil(lunghezza / 32) - 2;
  let v = blake2b(ingresso, 64);
  out.set(v.subarray(0, 32), 0);
  for (let i = 1; i < r; i++) { v = blake2b(v, 64); out.set(v.subarray(0, 32), i * 32); }
  out.set(blake2b(v, lunghezza - 32 * r), 32 * r);
  return out;
}

/** a = a + b + 2·(parte bassa di a)·(parte bassa di b), a 64 bit (la funzione BlaMka di Argon2). */
function blamka(v: Uint32Array, a: number, b: number): void {
  const x = v[a], y = v[b];
  const x0 = x & 0xffff, x1 = x >>> 16, y0 = y & 0xffff, y1 = y >>> 16;
  const p00 = x0 * y0, p01 = x0 * y1, p10 = x1 * y0, p11 = x1 * y1;
  const medio = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  let plo = (((medio & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
  let phi = (p11 + (p01 >>> 16) + (p10 >>> 16) + (medio >>> 16)) >>> 0;
  phi = ((phi << 1) | (plo >>> 31)) >>> 0; plo = (plo << 1) >>> 0;
  const lo = v[a] + v[b] + plo;
  v[a + 1] = v[a + 1] + v[b + 1] + phi + Math.floor(lo / 0x100000000);
  v[a] = lo;
}
function gb(v: Uint32Array, a: number, b: number, c: number, d: number): void {
  blamka(v, a, b); ruota(v, d, a, 32);
  blamka(v, c, d); ruota(v, b, c, 24);
  blamka(v, a, b); ruota(v, d, a, 16);
  blamka(v, c, d); ruota(v, b, c, 63);
}
/** La permutazione P su 16 parole a 64 bit, date dalle posizioni (in parole a 32 bit) dentro r. */
function permuta(r: Uint32Array, i: number[]): void {
  gb(r, i[0], i[4], i[8], i[12]); gb(r, i[1], i[5], i[9], i[13]); gb(r, i[2], i[6], i[10], i[14]); gb(r, i[3], i[7], i[11], i[15]);
  gb(r, i[0], i[5], i[10], i[15]); gb(r, i[1], i[6], i[11], i[12]); gb(r, i[2], i[7], i[8], i[13]); gb(r, i[3], i[4], i[9], i[14]);
}
// le posizioni delle righe e delle colonne del blocco visto come 8×8 registri da 16 byte
const RIGHE = Array.from({ length: 8 }, (_, r) => Array.from({ length: 16 }, (_, k) => (16 * r + k) * 2));
const COLONNE = Array.from({ length: 8 }, (_, c) => Array.from({ length: 16 }, (_, k) => (16 * (k >> 1) + 2 * c + (k & 1)) * 2));

const PAROLE = 256; // un blocco da 1024 byte = 256 parole a 32 bit
const rr = new Uint32Array(PAROLE), zz = new Uint32Array(PAROLE);
/** G(x, y) di RFC 9106 3.5, scritto in dest (con xor sul vecchio contenuto se `xor`). */
function comprimiArgon(mem: Uint32Array, x: number, y: number, dest: Uint32Array, d: number, xor: boolean): void {
  for (let k = 0; k < PAROLE; k++) rr[k] = mem[x + k] ^ mem[y + k];
  zz.set(rr);
  for (const riga of RIGHE) permuta(zz, riga);
  for (const col of COLONNE) permuta(zz, col);
  if (xor) for (let k = 0; k < PAROLE; k++) dest[d + k] ^= zz[k] ^ rr[k];
  else for (let k = 0; k < PAROLE; k++) dest[d + k] = zz[k] ^ rr[k];
}

export interface ParametriArgon2 { giri: number; memoriaKiB: number; corsie: number; lunghezza: number; segreto?: Uint8Array; associati?: Uint8Array }
/** Limiti per i file: oltre si rifiuta (un file non deve poter chiedere gigabyte di memoria). */
export const MEMORIA_MASSIMA_KIB = 1024 * 1024;

/** Argon2id (versione 0x13) della password con il sale. */
export function argon2id(password: Uint8Array, sale: Uint8Array, p: ParametriArgon2): Uint8Array {
  const { giri, corsie, lunghezza } = p;
  if (!(giri >= 1 && giri <= 64 && corsie >= 1 && corsie <= 64 && lunghezza >= 4 && lunghezza <= 1024 && p.memoriaKiB >= 8 * corsie && p.memoriaKiB <= MEMORIA_MASSIMA_KIB)) throw new Error('Argon2: parametri non validi');
  const segreto = p.segreto ?? new Uint8Array(0), associati = p.associati ?? new Uint8Array(0);
  const h0 = blake2b(unisci(le32(corsie), le32(lunghezza), le32(p.memoriaKiB), le32(giri), le32(0x13), le32(2),
    le32(password.length), password, le32(sale.length), sale, le32(segreto.length), segreto, le32(associati.length), associati), 64);
  const blocchi = 4 * corsie * Math.floor(p.memoriaKiB / (4 * corsie));
  const q = blocchi / corsie, segmento = q / 4;
  const mem = new Uint32Array(blocchi * PAROLE);
  const pos = (corsia: number, colonna: number): number => (corsia * q + colonna) * PAROLE;
  const carica = (byte: Uint8Array, d: number): void => { for (let k = 0; k < PAROLE; k++) mem[d + k] = byte[k * 4] | (byte[k * 4 + 1] << 8) | (byte[k * 4 + 2] << 16) | (byte[k * 4 + 3] << 24); };
  for (let l = 0; l < corsie; l++) {
    carica(hashLungo(unisci(h0, le32(0), le32(l)), 1024), pos(l, 0));
    carica(hashLungo(unisci(h0, le32(1), le32(l)), 1024), pos(l, 1));
  }
  const zero = new Uint32Array(PAROLE), ingresso = new Uint32Array(PAROLE), indirizzi = new Uint32Array(PAROLE), tmp = new Uint32Array(PAROLE);
  // G(zero, x) con blocchi fuori dalla memoria: si usa un piccolo spazio a parte
  const spazio = new Uint32Array(PAROLE * 3);
  const g2 = (): void => {
    spazio.set(zero, 0); spazio.set(ingresso, PAROLE);
    comprimiArgon(spazio, 0, PAROLE, tmp, 0, false);
    spazio.set(tmp, PAROLE);
    comprimiArgon(spazio, 0, PAROLE, indirizzi, 0, false);
  };
  for (let giro = 0; giro < giri; giro++) {
    for (let fetta = 0; fetta < 4; fetta++) {
      for (let l = 0; l < corsie; l++) {
        const indipendente = giro === 0 && fetta < 2; // Argon2id: la prima metà del primo giro come Argon2i
        if (indipendente) {
          ingresso.fill(0);
          ingresso[0] = giro; ingresso[2] = l; ingresso[4] = fetta; ingresso[6] = blocchi; ingresso[8] = giri; ingresso[10] = 2; ingresso[12] = 0;
        }
        const inizio = giro === 0 && fetta === 0 ? 2 : 0;
        if (indipendente && inizio > 0) { ingresso[12]++; g2(); }
        for (let i = inizio; i < segmento; i++) {
          const colonna = fetta * segmento + i;
          const prima = colonna === 0 ? q - 1 : colonna - 1;
          let j1: number, j2: number;
          if (indipendente) {
            if (i % 128 === 0) { ingresso[12]++; g2(); }
            j1 = indirizzi[(i % 128) * 2]; j2 = indirizzi[(i % 128) * 2 + 1];
          } else {
            j1 = mem[pos(l, prima)]; j2 = mem[pos(l, prima) + 1];
          }
          const corsiaRif = giro === 0 && fetta === 0 ? l : j2 % corsie;
          const stessa = corsiaRif === l;
          let ampiezza: number;
          if (giro === 0) ampiezza = stessa ? fetta * segmento + i - 1 : fetta * segmento + (i === 0 ? -1 : 0);
          else ampiezza = stessa ? q - segmento + i - 1 : q - segmento + (i === 0 ? -1 : 0);
          // x = j1² / 2^32, y = ampiezza·x / 2^32
          const y = mulAlto(ampiezza >>> 0, mulAlto(j1, j1));
          const rel = ampiezza - 1 - y;
          const partenza = giro === 0 ? 0 : ((fetta + 1) * segmento) % q;
          const rif = (partenza + rel) % q;
          comprimiArgon(mem, pos(l, prima), pos(corsiaRif, rif), mem, pos(l, colonna), giro > 0);
        }
      }
    }
  }
  const finale = new Uint32Array(PAROLE);
  for (let l = 0; l < corsie; l++) { const b = pos(l, q - 1); for (let k = 0; k < PAROLE; k++) finale[k] ^= mem[b + k]; }
  const byte = new Uint8Array(1024);
  for (let k = 0; k < PAROLE; k++) { byte[k * 4] = finale[k]; byte[k * 4 + 1] = finale[k] >>> 8; byte[k * 4 + 2] = finale[k] >>> 16; byte[k * 4 + 3] = finale[k] >>> 24; }
  return hashLungo(byte, lunghezza);
}

/** La parte alta (32 bit) del prodotto di due numeri a 32 bit senza segno. */
function mulAlto(a: number, b: number): number {
  const a0 = a & 0xffff, a1 = a >>> 16, b0 = b & 0xffff, b1 = b >>> 16;
  const p00 = a0 * b0, p01 = a0 * b1, p10 = a1 * b0, p11 = a1 * b1;
  const medio = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  return (p11 + (p01 >>> 16) + (p10 >>> 16) + (medio >>> 16)) >>> 0;
}
