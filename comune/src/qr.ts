// Codice QR (ISO/IEC 18004), comune a pmb_docs e pmb_sheets, scritto qui dalla specifica: testo in UTF-8 (modo «byte»), correzione
// degli errori di livello M (circa il 15%), versione (grandezza) la più piccola che basta, maschera scelta con le penalità della norma.
// Il QR è d'uso libero (Denso Wave non fa valere il brevetto). Più un codificatore PNG puro (in scala di grigi, deflate senza
// compressione), così l'immagine si fa anche fuori dal browser. Verificato con il lettore di OpenCV (tests: T562).
import { crc32 } from './formati/zip';

// livello M, versioni 1-40: codici di correzione per blocco e numero di blocchi (tabelle della norma)
const EC_M = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCCHI_M = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

/** Moduli per i dati (senza motivi fissi) di una versione. */
function moduliDati(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const codiciTotali = (v: number): number => Math.floor(moduliDati(v) / 8);
const codiciDati = (v: number): number => codiciTotali(v) - EC_M[v - 1] * BLOCCHI_M[v - 1];

function posizioniAllineamento(v: number): number[] {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const lato = v * 4 + 17;
  const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let p = lato - 7; out.length < n; p -= passo) out.splice(1, 0, p);
  return out;
}

// ---- Reed-Solomon su GF(256), polinomio 0x11D ----
function moltiplica(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function divisore(grado: number): number[] {
  const r = new Array(grado).fill(0); r[grado - 1] = 1;
  let radice = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = moltiplica(r[j], radice); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    radice = moltiplica(radice, 0x02);
  }
  return r;
}
function resto(dati: number[], div: number[]): number[] {
  const r = new Array(div.length).fill(0);
  for (const b of dati) {
    const f = b ^ r.shift()!;
    r.push(0);
    div.forEach((c, i) => { r[i] ^= moltiplica(c, f); });
  }
  return r;
}

/** La matrice del codice QR del testo (true = modulo scuro), senza il margine bianco. Errore se il testo è troppo lungo (oltre ~2300 byte). */
export function codiceQR(testo: string): boolean[][] {
  const byte = new TextEncoder().encode(testo);
  let v = 1;
  for (; v <= 40; v++) if (4 + (v <= 9 ? 8 : 16) + byte.length * 8 <= codiciDati(v) * 8) break;
  if (v > 40) throw new Error('Testo troppo lungo per un codice QR');
  // bit dei dati: modo byte (0100), lunghezza, i byte, fine, riempimento
  const bit: number[] = [];
  const metti = (val: number, n: number): void => { for (let i = n - 1; i >= 0; i--) bit.push((val >>> i) & 1); };
  metti(4, 4); metti(byte.length, v <= 9 ? 8 : 16);
  for (const b of byte) metti(b, 8);
  const capienza = codiciDati(v) * 8;
  metti(0, Math.min(4, capienza - bit.length));
  metti(0, (8 - (bit.length % 8)) % 8);
  for (let pad = 0xec; bit.length < capienza; pad ^= 0xec ^ 0x11) metti(pad, 8);
  const dati: number[] = [];
  for (let i = 0; i < bit.length; i += 8) dati.push(parseInt(bit.slice(i, i + 8).join(''), 2));
  // blocchi e correzione, poi alternati
  const nb = BLOCCHI_M[v - 1], ec = EC_M[v - 1], tot = codiciTotali(v);
  const corti = nb - (tot % nb), lungoCorto = Math.floor(tot / nb);
  const div = divisore(ec);
  const blocchi: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const n = lungoCorto - ec + (i < corti ? 0 : 1);
    const d = dati.slice(k, k + n); k += n;
    blocchi.push([...d, ...(i < corti ? [-1] : []), ...resto(d, div)]);
  }
  const finali: number[] = [];
  for (let i = 0; i < blocchi[0].length; i++) for (const b of blocchi) if (b[i] !== -1) finali.push(b[i]);
  // la matrice: motivi fissi
  const lato = v * 4 + 17;
  const m: boolean[][] = Array.from({ length: lato }, () => new Array(lato).fill(false));
  const fisso: boolean[][] = Array.from({ length: lato }, () => new Array(lato).fill(false));
  const poni = (x: number, y: number, s: boolean): void => { m[y][x] = s; fisso[y][x] = true; };
  for (let i = 0; i < lato; i++) { poni(6, i, i % 2 === 0); poni(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [lato - 4, 3], [3, lato - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < lato && y >= 0 && y < lato) poni(x, y, d !== 2 && d !== 4);
    }
  }
  const al = posizioniAllineamento(v);
  al.forEach((a, i) => al.forEach((b, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poni(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formato = (maschera: number): void => {
    const d = (0 << 3) | maschera; // livello M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bitF = (i: number): boolean => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) poni(8, i, bitF(i));
    poni(8, 7, bitF(6)); poni(8, 8, bitF(7)); poni(7, 8, bitF(8));
    for (let i = 9; i < 15; i++) poni(14 - i, 8, bitF(i));
    for (let i = 0; i < 8; i++) poni(lato - 1 - i, 8, bitF(i));
    for (let i = 8; i < 15; i++) poni(8, lato - 15 + i, bitF(i));
    poni(8, lato - 8, true);
  };
  formato(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const s = ((b >>> i) & 1) !== 0; const a = lato - 11 + (i % 3), c = Math.floor(i / 3); poni(a, c, s); poni(c, a, s); }
  }
  // i dati a zig-zag dal basso a destra, saltando la colonna 6
  let i = 0;
  for (let destra = lato - 1; destra >= 1; destra -= 2) {
    if (destra === 6) destra = 5;
    for (let vert = 0; vert < lato; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = destra - j;
        const su = ((destra + 1) & 2) === 0;
        const y = su ? lato - 1 - vert : vert;
        if (!fisso[y][x] && i < finali.length * 8) { m[y][x] = ((finali[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
  }
  // la maschera con meno penalità
  const regola = (k: number, x: number, y: number): boolean => [
    (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][k];
  const applica = (k: number): void => { for (let y = 0; y < lato; y++) for (let x = 0; x < lato; x++) if (!fisso[y][x] && regola(k, x, y)) m[y][x] = !m[y][x]; };
  let migliore = 0, minima = Infinity;
  for (let k = 0; k < 8; k++) {
    applica(k); formato(k);
    const p = penalita(m);
    if (p < minima) { minima = p; migliore = k; }
    applica(k);
  }
  applica(migliore); formato(migliore);
  return m;
}

function penalita(m: boolean[][]): number {
  const n = m.length;
  let p = 0, scuri = 0;
  const righe = (get: (a: number, b: number) => boolean): void => {
    for (let a = 0; a < n; a++) {
      let corsa = 1;
      let finestra = '';
      for (let b = 0; b < n; b++) {
        const c = get(a, b);
        if (b > 0 && c === get(a, b - 1)) { corsa++; if (corsa === 5) p += 3; else if (corsa > 5) p++; } else corsa = 1;
        finestra = (finestra + (c ? '1' : '0')).slice(-11);
        if (finestra === '10111010000' || finestra === '00001011101') p += 40;
      }
    }
  };
  righe((a, b) => m[a][b]);
  righe((a, b) => m[b][a]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  for (const r of m) for (const c of r) if (c) scuri++;
  return p + (Math.ceil(Math.abs(scuri * 20 - n * n * 10) / (n * n)) - 1) * 10;
}

/** PNG in scala di grigi del codice QR: modulo di «lato» pixel, margine bianco di 4 moduli (come vuole la norma). */
export function pngQR(matrice: boolean[][], lato = 8): Uint8Array {
  const margine = 4;
  const n = (matrice.length + margine * 2) * lato;
  const righe = new Uint8Array(n * (n + 1));
  for (let y = 0; y < n; y++) {
    righe[y * (n + 1)] = 0;
    const my = Math.floor(y / lato) - margine;
    for (let x = 0; x < n; x++) {
      const mx = Math.floor(x / lato) - margine;
      const scuro = my >= 0 && mx >= 0 && my < matrice.length && mx < matrice.length && matrice[my][mx];
      righe[y * (n + 1) + 1 + x] = scuro ? 0 : 255;
    }
  }
  // zlib con blocchi deflate non compressi (al massimo 65535 byte l'uno) e Adler-32
  const blocchi: number[] = [0x78, 0x01];
  for (let i = 0; i < righe.length; i += 65535) {
    const pezzo = righe.subarray(i, Math.min(righe.length, i + 65535));
    const ultimo = i + 65535 >= righe.length ? 1 : 0;
    blocchi.push(ultimo, pezzo.length & 0xff, pezzo.length >>> 8, ~pezzo.length & 0xff, (~pezzo.length >>> 8) & 0xff);
    for (const b of pezzo) blocchi.push(b);
  }
  let a = 1, b = 0;
  for (const x of righe) { a = (a + x) % 65521; b = (b + a) % 65521; }
  blocchi.push((b >>> 8) & 0xff, b & 0xff, (a >>> 8) & 0xff, a & 0xff);
  const pezzoPng = (tipo: string, dati: Uint8Array): number[] => {
    const t = new TextEncoder().encode(tipo);
    const td = new Uint8Array(t.length + dati.length); td.set(t); td.set(dati, t.length);
    const l = dati.length, c = crc32(td);
    return [l >>> 24, (l >>> 16) & 0xff, (l >>> 8) & 0xff, l & 0xff, ...td, c >>> 24, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff];
  };
  const ihdr = new Uint8Array([n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, 8, 0, 0, 0, 0]);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...pezzoPng('IHDR', ihdr), ...pezzoPng('IDAT', new Uint8Array(blocchi)), ...pezzoPng('IEND', new Uint8Array(0))]);
}

/** Il PNG del codice QR come indirizzo data:, pronto per un'immagine. */
export function qrComeDataUrl(testo: string, lato = 8): { s: string; w: number; h: number } {
  const matrice = codiceQR(testo);
  const png = pngQR(matrice, lato);
  let bin = '';
  for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000));
  const n = (matrice.length + 8) * lato;
  return { s: `data:image/png;base64,${btoa(bin)}`, w: n, h: n };
}
