// Lettura dei «file composti» di Office 97-2003 (Compound File Binary, specifica pubblica [MS-CFB] di Microsoft).
// Un file .xls o .doc è un piccolo disco dentro il file: settori di dimensione fissa, una tabella che dice quale settore viene dopo
// (la FAT), una cartella con i nomi dei flussi e, per i flussi piccoli, un secondo livello di settori da 64 byte (la mini FAT).
// Qui si legge solo: dal file si ricava l'elenco dei flussi e il loro contenuto. Puro: riceve i byte, non tocca il disco.
// Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.

/** Un flusso del file: percorso con le cartelle separate da "/" (per esempio "Workbook" o "ObjectPool/_123/Ole") e contenuto. */
export interface FlussoCfb { percorso: string; dati: Uint8Array }

export interface ArchivioCfb {
  /** tutti i flussi, nell'ordine della cartella del file */
  flussi: FlussoCfb[];
  /** i percorsi delle cartelle interne (storage) */
  cartelle: string[];
  /** il contenuto di un flusso: il nome non bada alle maiuscole, come nei file di Office */
  flusso(percorso: string): Uint8Array | undefined;
  /** vero se c'è la cartella (o il flusso) con quel percorso */
  esiste(percorso: string): boolean;
}

const FIRMA = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
// i valori oltre SETTORE_MASSIMO chiudono una catena (fine, settore libero, settore della FAT o della DIFAT)
const SETTORE_MASSIMO = 0xfffffffa;
const NESSUNO = 0xffffffff;

/** Vero se i byte cominciano con la firma dei file composti (anche .msg, .ppt e altri: dice solo che è un contenitore). */
export function eFileComposto(b: Uint8Array): boolean {
  return b.length >= 512 && FIRMA.every((x, i) => b[i] === x);
}

function errore(motivo: string): Error { return new Error(`file composto non valido: ${motivo}`); }

export function leggiCfb(b: Uint8Array): ArchivioCfb {
  if (!eFileComposto(b)) throw errore('manca la firma');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (p: number): number => dv.getUint16(p, true);
  const u32 = (p: number): number => dv.getUint32(p, true);

  const esponente = u16(30);
  if (esponente !== 9 && esponente !== 12) throw errore('dimensione dei settori');
  const dimSettore = 1 << esponente;
  // un valore assurdo per i mini settori (file rovinati) si sostituisce con quello di sempre, 64 byte
  const esponenteMini = u16(32) >= 2 && u16(32) <= esponente ? u16(32) : 6;
  const dimMini = 1 << esponenteMini;
  const settoriFat = u32(44);
  const primoCartella = u32(48);
  const sogliaMini = u32(56) || 4096;
  const primoMiniFat = u32(60);
  const settoriMiniFat = u32(64);
  const primoDifat = u32(68);
  const settoriDifat = u32(72);
  const perSettore = dimSettore / 4;
  // il file può essere stato troncato: i settori che non ci sono si leggono come vuoti, ma non si va oltre un limite ragionevole
  const totaleSettori = Math.floor((b.length - dimSettore) / dimSettore) + 1;

  const inizioSettore = (n: number): number => (n + 1) * dimSettore;
  const settore = (n: number): Uint8Array => {
    const da = inizioSettore(n);
    if (n > SETTORE_MASSIMO || da >= b.length) return new Uint8Array(dimSettore);
    if (da + dimSettore <= b.length) return b.subarray(da, da + dimSettore);
    const pieno = new Uint8Array(dimSettore);
    pieno.set(b.subarray(da));
    return pieno;
  };

  // 1. dove sta la FAT: i primi 109 settori sono nell'intestazione, gli altri nella catena DIFAT
  const settoriDellaFat: number[] = [];
  for (let i = 0; i < 109 && settoriDellaFat.length < settoriFat; i++) {
    const s = u32(76 + i * 4);
    if (s <= SETTORE_MASSIMO) settoriDellaFat.push(s);
  }
  let difat = primoDifat;
  const visti = new Set<number>();
  for (let k = 0; k < settoriDifat && difat <= SETTORE_MASSIMO && settoriDellaFat.length < settoriFat; k++) {
    if (visti.has(difat)) throw errore('catena DIFAT circolare');
    visti.add(difat);
    const d = settore(difat);
    const dd = new DataView(d.buffer, d.byteOffset, d.byteLength);
    for (let i = 0; i < perSettore - 1 && settoriDellaFat.length < settoriFat; i++) {
      const s = dd.getUint32(i * 4, true);
      if (s <= SETTORE_MASSIMO) settoriDellaFat.push(s);
    }
    difat = dd.getUint32((perSettore - 1) * 4, true);
  }
  const fat = new Uint32Array(settoriDellaFat.length * perSettore);
  settoriDellaFat.forEach((s, i) => {
    const d = settore(s);
    const dd = new DataView(d.buffer, d.byteOffset, d.byteLength);
    for (let j = 0; j < perSettore; j++) fat[i * perSettore + j] = dd.getUint32(j * 4, true);
  });

  /** I settori di una catena, a partire dal primo; si ferma alla fine, a un valore fuori posto o a un giro chiuso. */
  const catena = (primo: number, tabella: Uint32Array, limite: number): number[] => {
    const elenco: number[] = [];
    const giaVisti = new Set<number>();
    let s = primo;
    while (s <= SETTORE_MASSIMO && s < tabella.length && elenco.length < limite) {
      if (giaVisti.has(s)) throw errore('catena di settori circolare');
      giaVisti.add(s);
      elenco.push(s);
      s = tabella[s];
    }
    // un settore oltre la tabella vuol dire file rovinato: quello che si è letto fin qui si tiene
    return elenco;
  };

  const leggiCatena = (primo: number, lunghezza: number | null): Uint8Array => {
    const limite = lunghezza === null ? totaleSettori + 1 : Math.ceil(lunghezza / dimSettore);
    const settori = catena(primo, fat, Math.min(limite, totaleSettori + 1));
    const tutto = new Uint8Array(settori.length * dimSettore);
    settori.forEach((s, i) => tutto.set(settore(s), i * dimSettore));
    return lunghezza === null ? tutto : tutto.subarray(0, Math.min(lunghezza, tutto.length));
  };

  // 2. la cartella: voci da 128 byte
  const cartella = leggiCatena(primoCartella, null);
  const cd = new DataView(cartella.buffer, cartella.byteOffset, cartella.byteLength);
  interface Voce { nome: string; tipo: number; sinistra: number; destra: number; figlio: number; inizio: number; dimensione: number }
  const voci: Voce[] = [];
  for (let p = 0; p + 128 <= cartella.length; p += 128) {
    const lunghezzaNome = Math.min(64, cd.getUint16(p + 64, true));
    let nome = '';
    for (let i = 0; i + 1 < lunghezzaNome - 1; i += 2) nome += String.fromCharCode(cd.getUint16(p + i, true));
    const tipo = cartella[p + 66];
    // nei file della versione 3 contano solo i 4 byte bassi della dimensione
    const bassa = cd.getUint32(p + 120, true);
    const alta = esponente === 9 ? 0 : cd.getUint32(p + 124, true);
    voci.push({ nome, tipo, sinistra: cd.getUint32(p + 68, true), destra: cd.getUint32(p + 72, true), figlio: cd.getUint32(p + 76, true), inizio: cd.getUint32(p + 116, true), dimensione: alta * 2 ** 32 + bassa });
  }
  if (voci.length === 0 || voci[0].tipo !== 5) throw errore('manca la voce radice');

  // 3. il mini flusso (nella catena della radice) e la mini FAT
  const radice = voci[0];
  const miniFlusso = leggiCatena(radice.inizio, radice.dimensione);
  const miniFatByte = settoriMiniFat > 0 && primoMiniFat <= SETTORE_MASSIMO ? leggiCatena(primoMiniFat, settoriMiniFat * dimSettore) : new Uint8Array(0);
  const miniFat = new Uint32Array(Math.floor(miniFatByte.length / 4));
  const md = new DataView(miniFatByte.buffer, miniFatByte.byteOffset, miniFatByte.byteLength);
  for (let i = 0; i < miniFat.length; i++) miniFat[i] = md.getUint32(i * 4, true);

  const contenuto = (v: Voce): Uint8Array => {
    // una dimensione più grande del file (file rovinati) non fa danni: si legge la catena fin dove arriva
    if (v.dimensione === 0) return new Uint8Array(0);
    if (v.dimensione < sogliaMini) {
      const settori = catena(v.inizio, miniFat, Math.ceil(v.dimensione / dimMini));
      const out = new Uint8Array(settori.length * dimMini);
      settori.forEach((s, i) => {
        const da = s * dimMini;
        if (da < miniFlusso.length) out.set(miniFlusso.subarray(da, Math.min(da + dimMini, miniFlusso.length)), i * dimMini);
      });
      return out.subarray(0, Math.min(v.dimensione, out.length));
    }
    return leggiCatena(v.inizio, v.dimensione);
  };

  // 4. l'albero dei nomi: ogni cartella ha i suoi figli in un albero binario (sinistra, destra), che si visita tutto
  const flussi: FlussoCfb[] = [];
  const cartelle: string[] = [];
  const visitati = new Set<number>();
  const visita = (indice: number, prefisso: string, profondita: number): void => {
    const pila = [indice];
    while (pila.length > 0) {
      const i = pila.pop()!;
      if (i === NESSUNO || i >= voci.length || visitati.has(i)) continue;
      visitati.add(i);
      const v = voci[i];
      pila.push(v.destra, v.sinistra);
      const percorso = prefisso + v.nome;
      if (v.tipo === 2) {
        // un flusso rovinato (per esempio una catena circolare) resta vuoto: gli altri flussi del file si leggono lo stesso
        let dati: Uint8Array;
        try { dati = contenuto(v); } catch { dati = new Uint8Array(0); }
        flussi.push({ percorso, dati });
      }
      else if (v.tipo === 1 && profondita < 32) {
        cartelle.push(percorso);
        visita(v.figlio, `${percorso}/`, profondita + 1);
      }
    }
  };
  visitati.add(0);
  visita(radice.figlio, '', 0);

  const indice = new Map<string, Uint8Array>();
  for (const f of flussi) if (!indice.has(f.percorso.toLowerCase())) indice.set(f.percorso.toLowerCase(), f.dati);
  const nomiCartelle = new Set(cartelle.map((c) => c.toLowerCase()));
  return {
    flussi,
    cartelle,
    flusso: (percorso) => indice.get(percorso.toLowerCase()),
    esiste: (percorso) => indice.has(percorso.toLowerCase()) || nomiCartelle.has(percorso.toLowerCase()),
  };
}
