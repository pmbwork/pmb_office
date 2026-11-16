// Lettura e scrittura di archivi ZIP (formato dei file .docx, .xlsx, .ods): senza dipendenze.
// Si usano CompressionStream e DecompressionStream ("deflate-raw"), presenti in WebView2 e in Node 18+.
// Non gestisce ZIP64, cifratura né archivi divisi in più file: li rifiuta con un errore chiaro.

export interface VoceZip { nome: string; dati: Uint8Array; /** salva i byte così come sono, senza comprimerli (per esempio il "mimetype" di OpenDocument) */ senzaCompressione?: boolean }

const TAVOLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dati: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dati.length; i++) c = TAVOLA[(c ^ dati[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function unisci(pezzi: Uint8Array[]): Uint8Array {
  let tot = 0;
  for (const p of pezzi) tot += p.length;
  const out = new Uint8Array(tot);
  let o = 0;
  for (const p of pezzi) { out.set(p, o); o += p.length; }
  return out;
}

async function passa(dati: Uint8Array, flusso: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }, limite = Infinity): Promise<Uint8Array> {
  const w = flusso.writable.getWriter();
  w.write(dati).catch(() => {});
  w.close().catch(() => {});
  const lettore = flusso.readable.getReader();
  const pezzi: Uint8Array[] = [];
  let letti = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    letti += value.length;
    if (letti > limite) { await lettore.cancel().catch(() => {}); throw new Error('dati più grandi di quanto dichiarato'); }
    pezzi.push(value);
  }
  return unisci(pezzi);
}

async function comprimi(dati: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined' || dati.length === 0) return null;
  return passa(dati, new CompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> });
}
async function decomprimi(dati: Uint8Array, limite: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('ZIP: questo ambiente non sa decomprimere');
  try {
    return await passa(dati, new DecompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }, limite);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('dati più grandi')) throw new Error('ZIP: un file si espande più di quanto dichiarato (archivio non valido)');
    throw new Error('ZIP: dati compressi non validi');
  }
}

const SEGNALE_LOCALE = 0x04034b50;
const SEGNALE_CENTRALE = 0x02014b50;
const SEGNALE_FINE = 0x06054b50;
const DATA_DOS = 0x21; // 1 gennaio 1980: date fisse, così lo stesso contenuto dà sempre gli stessi byte

function scrivi16(v: DataView, o: number, n: number): void { v.setUint16(o, n, true); }
function scrivi32(v: DataView, o: number, n: number): void { v.setUint32(o, n >>> 0, true); }

export async function scriviZip(voci: VoceZip[]): Promise<Uint8Array> {
  if (voci.length > 65534) throw new Error('ZIP: troppi file');
  const codificatore = new TextEncoder();
  const locali: Uint8Array[] = [];
  const centrali: Uint8Array[] = [];
  let offset = 0;
  const visti = new Set<string>();
  for (const voce of voci) {
    if (visti.has(voce.nome)) throw new Error(`ZIP: nome ripetuto ${voce.nome}`);
    visti.add(voce.nome);
    const nome = codificatore.encode(voce.nome);
    if (nome.length === 0 || nome.length > 65535) throw new Error('ZIP: nome del file non valido');
    const crc = crc32(voce.dati);
    const compressi = voce.senzaCompressione ? null : await comprimi(voce.dati);
    const usa = compressi !== null && compressi.length < voce.dati.length;
    const dati = usa ? (compressi as Uint8Array) : voce.dati;
    const metodo = usa ? 8 : 0;
    if (voce.dati.length > 0xfffffffe || offset > 0xfffffffe) throw new Error('ZIP: file troppo grande');
    const testa = new Uint8Array(30 + nome.length);
    const v = new DataView(testa.buffer);
    scrivi32(v, 0, SEGNALE_LOCALE); scrivi16(v, 4, 20); scrivi16(v, 6, 0x0800); scrivi16(v, 8, metodo);
    scrivi16(v, 10, 0); scrivi16(v, 12, DATA_DOS); scrivi32(v, 14, crc); scrivi32(v, 18, dati.length); scrivi32(v, 22, voce.dati.length);
    scrivi16(v, 26, nome.length); scrivi16(v, 28, 0);
    testa.set(nome, 30);
    const cen = new Uint8Array(46 + nome.length);
    const c = new DataView(cen.buffer);
    scrivi32(c, 0, SEGNALE_CENTRALE); scrivi16(c, 4, 20); scrivi16(c, 6, 20); scrivi16(c, 8, 0x0800); scrivi16(c, 10, metodo);
    scrivi16(c, 12, 0); scrivi16(c, 14, DATA_DOS); scrivi32(c, 16, crc); scrivi32(c, 20, dati.length); scrivi32(c, 24, voce.dati.length);
    scrivi16(c, 28, nome.length); scrivi16(c, 30, 0); scrivi16(c, 32, 0); scrivi16(c, 34, 0); scrivi16(c, 36, 0); scrivi32(c, 38, 0);
    scrivi32(c, 42, offset);
    cen.set(nome, 46);
    locali.push(testa, dati);
    centrali.push(cen);
    offset += testa.length + dati.length;
  }
  const dir = unisci(centrali);
  const fine = new Uint8Array(22);
  const f = new DataView(fine.buffer);
  scrivi32(f, 0, SEGNALE_FINE); scrivi16(f, 4, 0); scrivi16(f, 6, 0); scrivi16(f, 8, voci.length); scrivi16(f, 10, voci.length);
  scrivi32(f, 12, dir.length); scrivi32(f, 16, offset); scrivi16(f, 20, 0);
  return unisci([...locali, dir, fine]);
}

export interface OpzioniLettura { /** limite alla somma delle dimensioni dichiarate dei file, in byte (predefinito 256 MB) */ massimo?: number }

/** Legge un archivio ZIP. Restituisce i file (non le cartelle) nell'ordine dell'archivio. */
export async function leggiZip(bytes: Uint8Array, opzioni: OpzioniLettura = {}): Promise<Map<string, Uint8Array>> {
  const massimo = opzioni.massimo ?? 256 * 1024 * 1024;
  if (bytes.length < 22) throw new Error('ZIP: archivio non valido');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fine = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === SEGNALE_FINE) { fine = i; break; }
  }
  if (fine < 0) throw new Error('ZIP: archivio non valido (fine non trovata)');
  const voci = v.getUint16(fine + 10, true);
  const dimDir = v.getUint32(fine + 12, true);
  const offDir = v.getUint32(fine + 16, true);
  if (voci === 0xffff || dimDir === 0xffffffff || offDir === 0xffffffff) throw new Error('ZIP: gli archivi ZIP64 non sono supportati');
  if (offDir + dimDir > fine) throw new Error('ZIP: archivio non valido (elenco dei file fuori dai limiti)');
  const decodificatore = new TextDecoder('utf-8');
  const out = new Map<string, Uint8Array>();
  let p = offDir;
  let totale = 0;
  for (let n = 0; n < voci; n++) {
    if (p + 46 > fine || v.getUint32(p, true) !== SEGNALE_CENTRALE) throw new Error('ZIP: archivio non valido (elenco dei file)');
    const flag = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const dimComp = v.getUint32(p + 20, true);
    const dimOrig = v.getUint32(p + 24, true);
    const lunNome = v.getUint16(p + 28, true);
    const lunExtra = v.getUint16(p + 30, true);
    const lunCom = v.getUint16(p + 32, true);
    const offLocale = v.getUint32(p + 42, true);
    if (p + 46 + lunNome > fine) throw new Error('ZIP: archivio non valido (nome fuori dai limiti)');
    const nome = decodificatore.decode(bytes.subarray(p + 46, p + 46 + lunNome));
    p += 46 + lunNome + lunExtra + lunCom;
    if (nome.endsWith('/')) continue;
    if (flag & 1) throw new Error(`ZIP: ${nome} è cifrato, non supportato`);
    if (metodo !== 0 && metodo !== 8) throw new Error(`ZIP: metodo di compressione ${metodo} non supportato (${nome})`);
    totale += dimOrig;
    if (totale > massimo) throw new Error('ZIP: archivio troppo grande');
    if (offLocale + 30 > bytes.length || v.getUint32(offLocale, true) !== SEGNALE_LOCALE) throw new Error(`ZIP: archivio non valido (${nome})`);
    const inizio = offLocale + 30 + v.getUint16(offLocale + 26, true) + v.getUint16(offLocale + 28, true);
    if (inizio + dimComp > bytes.length) throw new Error(`ZIP: archivio troncato (${nome})`);
    const grezzi = bytes.subarray(inizio, inizio + dimComp);
    const dati = metodo === 0 ? grezzi.slice() : await decomprimi(grezzi, dimOrig);
    if (dati.length !== dimOrig) throw new Error(`ZIP: dimensione errata (${nome})`);
    if (crc32(dati) !== crc) throw new Error(`ZIP: dati danneggiati (${nome})`);
    out.set(nome, dati);
  }
  return out;
}
