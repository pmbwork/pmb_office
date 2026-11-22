// Scrittura dei «file composti» di Office (Compound File Binary, specifica pubblica [MS-CFB] di Microsoft), versione 3 con settori da 512 byte.
// Serve ai file .docx e .xlsx protetti con la password per aprire: il pacchetto cifrato e le sue informazioni stanno in un file composto.
// I flussi più piccoli della soglia (4096 byte) vanno nel mini flusso, a pezzi da 64 byte; le cartelle hanno i figli in un albero
// ordinato come vuole la specifica (prima per lunghezza del nome, poi per nome in maiuscolo). Oltre 109 settori della FAT si usa la DIFAT.
// Puro: riceve i flussi e dà i byte. Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.

const SETTORE = 512, MINI = 64, SOGLIA = 4096;
const FINE = 0xfffffffe, LIBERO = 0xffffffff, NESSUNO = 0xffffffff, SETT_FAT = 0xfffffffd, SETT_DIFAT = 0xfffffffc;
const PER_SETTORE = SETTORE / 4;

interface Voce { nome: string; tipo: 1 | 2 | 5; figli: Voce[]; dati?: Uint8Array; inizio: number; dimensione: number; indice: number; sinistra: number; destra: number; figlio: number }

/** Ordine dei nomi nella cartella ([MS-CFB] 2.6.4): prima i più corti, poi per lettere maiuscole. */
function confronta(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  const x = a.toUpperCase(), y = b.toUpperCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Un file composto con i flussi dati: il percorso usa "/" per le cartelle interne (per esempio "\u0006DataSpaces/Version").
 * I nomi hanno al massimo 31 caratteri e non contengono "/", "\\", ":" o "!".
 */
export function scriviCfb(flussi: Array<{ percorso: string; dati: Uint8Array }>): Uint8Array {
  const radice: Voce = { nome: 'Root Entry', tipo: 5, figli: [], inizio: FINE, dimensione: 0, indice: 0, sinistra: NESSUNO, destra: NESSUNO, figlio: NESSUNO };
  for (const { percorso, dati } of flussi) {
    const parti = percorso.split('/');
    if (parti.some((p) => p.length === 0 || p.length > 31 || /[\\:!]/.test(p))) throw new Error(`nome non valido nel file composto: ${percorso}`);
    let qui = radice;
    for (const p of parti.slice(0, -1)) {
      let c = qui.figli.find((x) => x.tipo === 1 && confronta(x.nome, p) === 0);
      if (!c) { c = { nome: p, tipo: 1, figli: [], inizio: 0, dimensione: 0, indice: 0, sinistra: NESSUNO, destra: NESSUNO, figlio: NESSUNO }; qui.figli.push(c); }
      qui = c;
    }
    const nome = parti[parti.length - 1];
    if (qui.figli.some((x) => confronta(x.nome, nome) === 0)) throw new Error(`nome ripetuto nel file composto: ${percorso}`);
    qui.figli.push({ nome, tipo: 2, figli: [], dati, inizio: FINE, dimensione: dati.length, indice: 0, sinistra: NESSUNO, destra: NESSUNO, figlio: NESSUNO });
  }
  // numerazione delle voci e alberi dei figli (bilanciati: la radice di ogni gruppo è quella di mezzo)
  const voci: Voce[] = [];
  const elenca = (v: Voce): void => { v.indice = voci.length; voci.push(v); for (const f of v.figli) elenca(f); };
  elenca(radice);
  const albero = (ordinati: Voce[]): number => {
    if (ordinati.length === 0) return NESSUNO;
    const m = Math.floor(ordinati.length / 2);
    ordinati[m].sinistra = albero(ordinati.slice(0, m));
    ordinati[m].destra = albero(ordinati.slice(m + 1));
    return ordinati[m].indice;
  };
  for (const v of voci) if (v.tipo !== 2) v.figlio = albero([...v.figli].sort((a, b) => confronta(a.nome, b.nome)));

  // mini flusso
  const pezziMini: Uint8Array[] = [];
  const miniFat: number[] = [];
  for (const v of voci) {
    if (v.tipo !== 2 || !v.dati || v.dati.length === 0 || v.dati.length >= SOGLIA) continue;
    const n = Math.ceil(v.dati.length / MINI);
    v.inizio = miniFat.length;
    for (let k = 0; k < n; k++) miniFat.push(k === n - 1 ? FINE : miniFat.length + 1);
    const p = new Uint8Array(n * MINI); p.set(v.dati); pezziMini.push(p);
  }
  const lunghezzaMini = miniFat.length * MINI;

  // i blocchi di settori normali, nell'ordine: flussi grandi, mini flusso, mini FAT, cartella
  const blocchi: Array<{ byte: number; scrivi: (dest: Uint8Array) => void; voce?: Voce; tipo: 'flusso' | 'mini' | 'minifat' | 'cartella' }> = [];
  for (const v of voci) if (v.tipo === 2 && v.dati && v.dati.length >= SOGLIA) { const d = v.dati; blocchi.push({ byte: d.length, scrivi: (x) => x.set(d), voce: v, tipo: 'flusso' }); }
  if (lunghezzaMini > 0) blocchi.push({ byte: lunghezzaMini, scrivi: (x) => { let i = 0; for (const p of pezziMini) { x.set(p, i); i += p.length; } }, voce: radice, tipo: 'mini' });
  if (miniFat.length > 0) {
    const n = Math.ceil(miniFat.length / PER_SETTORE) * PER_SETTORE;
    blocchi.push({ byte: n * 4, scrivi: (x) => { const dv = new DataView(x.buffer, x.byteOffset, x.byteLength); for (let i = 0; i < n; i++) dv.setUint32(i * 4, i < miniFat.length ? miniFat[i] : LIBERO, true); }, tipo: 'minifat' });
  }
  const settoriCartella = Math.ceil((voci.length * 128) / SETTORE);
  blocchi.push({ byte: settoriCartella * SETTORE, scrivi: () => undefined, tipo: 'cartella' });
  const settoriDi = (byte: number): number => Math.ceil(byte / SETTORE);
  const settoriDati = blocchi.reduce((t, b) => t + settoriDi(b.byte), 0);

  // quanti settori di FAT e di DIFAT servono (contano anche loro)
  let nFat = 1, nDifat = 0;
  for (;;) {
    const totale = settoriDati + nFat + nDifat;
    const f = Math.ceil(totale / PER_SETTORE);
    const d = f > 109 ? Math.ceil((f - 109) / (PER_SETTORE - 1)) : 0;
    if (f === nFat && d === nDifat) break;
    nFat = f; nDifat = d;
  }
  const totale = settoriDati + nFat + nDifat;
  const fat = new Uint32Array(nFat * PER_SETTORE).fill(LIBERO);
  // settori: prima la FAT, poi la DIFAT, poi i dati
  for (let i = 0; i < nFat; i++) fat[i] = SETT_FAT;
  for (let i = 0; i < nDifat; i++) fat[nFat + i] = SETT_DIFAT;
  let prossimo = nFat + nDifat;
  const inizio = new Map<string, number>();
  const posizioni: Array<{ settore: number; blocco: (typeof blocchi)[number] }> = [];
  for (const b of blocchi) {
    const n = settoriDi(b.byte);
    for (let k = 0; k < n; k++) fat[prossimo + k] = k === n - 1 ? FINE : prossimo + k + 1;
    posizioni.push({ settore: prossimo, blocco: b });
    if (b.tipo === 'flusso' || b.tipo === 'mini') b.voce!.inizio = prossimo;
    else inizio.set(b.tipo, prossimo);
    prossimo += n;
  }
  if (lunghezzaMini > 0) radice.dimensione = lunghezzaMini;

  const out = new Uint8Array(SETTORE * (1 + totale));
  const dv = new DataView(out.buffer);
  // intestazione
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  dv.setUint16(24, 0x3e, true); dv.setUint16(26, 3, true); dv.setUint16(28, 0xfffe, true); dv.setUint16(30, 9, true); dv.setUint16(32, 6, true);
  dv.setUint32(40, 0, true); dv.setUint32(44, nFat, true); dv.setUint32(48, inizio.get('cartella')!, true); dv.setUint32(52, 0, true);
  dv.setUint32(56, SOGLIA, true);
  dv.setUint32(60, miniFat.length > 0 ? inizio.get('minifat')! : FINE, true);
  dv.setUint32(64, miniFat.length > 0 ? Math.ceil(miniFat.length / PER_SETTORE) : 0, true);
  dv.setUint32(68, nDifat > 0 ? nFat : FINE, true); dv.setUint32(72, nDifat, true);
  for (let i = 0; i < 109; i++) dv.setUint32(76 + i * 4, i < nFat ? i : LIBERO, true);
  const posSettore = (n: number): number => (n + 1) * SETTORE;
  // FAT
  for (let i = 0; i < fat.length; i++) dv.setUint32(posSettore(0) + i * 4, fat[i], true);
  // DIFAT: 127 numeri di settori della FAT e in fondo il settore DIFAT successivo
  for (let d = 0; d < nDifat; d++) {
    const base = posSettore(nFat + d);
    for (let i = 0; i < PER_SETTORE - 1; i++) {
      const n = 109 + d * (PER_SETTORE - 1) + i;
      dv.setUint32(base + i * 4, n < nFat ? n : LIBERO, true);
    }
    dv.setUint32(base + (PER_SETTORE - 1) * 4, d === nDifat - 1 ? FINE : nFat + d + 1, true);
  }
  // dati
  for (const { settore, blocco } of posizioni) {
    if (blocco.tipo === 'cartella') continue;
    blocco.scrivi(out.subarray(posSettore(settore), posSettore(settore) + blocco.byte));
  }
  // cartella
  const baseCartella = posSettore(inizio.get('cartella')!);
  for (let i = 0; i < settoriCartella * (SETTORE / 128); i++) {
    const p = baseCartella + i * 128;
    const v = voci[i];
    if (!v) { dv.setUint32(p + 68, NESSUNO, true); dv.setUint32(p + 72, NESSUNO, true); dv.setUint32(p + 76, NESSUNO, true); continue; }
    for (let k = 0; k < v.nome.length; k++) dv.setUint16(p + k * 2, v.nome.charCodeAt(k), true);
    dv.setUint16(p + 64, (v.nome.length + 1) * 2, true);
    out[p + 66] = v.tipo; out[p + 67] = 1; // nero
    dv.setUint32(p + 68, v.sinistra, true); dv.setUint32(p + 72, v.destra, true); dv.setUint32(p + 76, v.figlio, true);
    const vuoto = v.tipo === 1 || (v.tipo === 2 && v.dimensione === 0) || (v.tipo === 5 && lunghezzaMini === 0);
    dv.setUint32(p + 116, vuoto ? (v.tipo === 1 ? 0 : FINE) : v.inizio, true);
    dv.setUint32(p + 120, v.tipo === 1 ? 0 : v.dimensione, true);
  }
  return out;
}
