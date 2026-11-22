// Formule dei file .xls (Excel 97-2003 e versioni prima, fino a Excel 2.x): dal codice a gettoni del file (notazione polacca inversa, specifica pubblica [MS-XLS])
// al testo della formula come lo scrive l'utente in pmb_sheets ("SUM(A1:A3)", nomi delle funzioni in inglese, argomenti separati da ",").
// Puro: riceve i byte della formula e le informazioni della cartella (fogli, nomi), non sa niente del resto del file.
// Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.
import { columnIndexToLetters } from '../engine/address';

/** Le informazioni della cartella che servono a scrivere i riferimenti e i nomi. */
export interface CartellaFormule {
  /** i fogli di un riferimento 3D (indice nella tabella EXTERNSHEET): primo e ultimo, oppure null se il foglio è di un altro file o non c'è più */
  fogli(ixti: number): { primo: string; ultimo: string } | null;
  /** il nome definito numero n (da 1) */
  nome(n: number): string | undefined;
  /** il nome numero n (da 1) del libro esterno indicato da ixti: una funzione aggiuntiva (EOMONTH...) o un nome di questo file */
  nomeEsterno(ixti: number, n: number): string | undefined;
  /** versione del formato: 8 per Excel 97-2003, 5 per Excel 5.0/95, 4, 3 e 2 per le versioni prima (senza: 8) */
  versione?: number;
  /** i testi da un byte per carattere (fino a Excel 95) nella codifica del file */
  decodifica?: (byte: Uint8Array) => string;
  /** il nome del foglio numero i (da 0): i riferimenti 3D di Excel 5/95 indicano i fogli così */
  foglioIndice?: (i: number) => string | undefined;
}

/** Dove sta la formula: le coordinate (da 0) servono ai riferimenti relativi delle formule condivise e dei nomi. */
export interface PosizioneFormula { riga: number; colonna: number; condivisa: boolean }

export type EsitoFormula = { testo: string } | { motivo: string };

/** Funzioni del file: nome inglese e, per quelle con un numero fisso di argomenti (gettone tFunc), quanti sono. */
const FUNZIONI: Record<number, [string, number?]> = {};
function definisci(da: number, voci: string): void {
  let i = da;
  for (const v of voci.split(' ')) {
    if (v === '-') { i++; continue; }
    const [nome, n] = v.split('/');
    FUNZIONI[i++] = n === undefined ? [nome] : [nome, Number(n)];
  }
}
definisci(0, 'COUNT IF ISNA/1 ISERROR/1 SUM AVERAGE MIN MAX ROW COLUMN NA/0 NPV STDEV DOLLAR FIXED SIN/1 COS/1 TAN/1 ATAN/1 PI/0 SQRT/1 EXP/1 LN/1 LOG10/1 ABS/1 INT/1 SIGN/1 ROUND/2 LOOKUP INDEX REPT/2 MID/3 LEN/1 VALUE/1 TRUE/0 FALSE/0 AND OR NOT/1 MOD/2');
definisci(40, 'DCOUNT/3 DSUM/3 DAVERAGE/3 DMIN/3 DMAX/3 DSTDEV/3 VAR DVAR/3 TEXT/2 LINEST TREND LOGEST GROWTH - - - PV FV NPER PMT RATE MIRR/3 IRR RAND/0 MATCH DATE/3 TIME/3 DAY/1 MONTH/1 YEAR/1 WEEKDAY HOUR/1 MINUTE/1 SECOND/1 NOW/0 AREAS/1 ROWS/1 COLUMNS/1 OFFSET');
definisci(82, 'SEARCH TRANSPOSE/1 - - TYPE/1');
definisci(97, 'ATAN2/2 ASIN/1 ACOS/1 CHOOSE HLOOKUP VLOOKUP - - ISREF/1 - - - LOG - CHAR/1 LOWER/1 UPPER/1 PROPER/1 LEFT RIGHT EXACT/2 TRIM/1 REPLACE/4 SUBSTITUTE CODE/1 - - FIND CELL ISERR/1 ISTEXT/1 ISNUMBER/1 ISBLANK/1 T/1 N/1');
definisci(140, 'DATEVALUE/1 TIMEVALUE/1 SLN/3 SYD/4 DDB - - - INDIRECT');
definisci(162, 'CLEAN/1 MDETERM/1 MINVERSE/1 MMULT/2 - IPMT PPMT COUNTA');
definisci(183, 'PRODUCT FACT/1 - - - - DPRODUCT/3 ISNONTEXT/1 - - STDEVP VARP DSTDEVP/3 DVARP/3 TRUNC ISLOGICAL/1 DCOUNTA/3');
definisci(204, 'USDOLLAR FINDB SEARCHB REPLACEB/4 LEFTB RIGHTB MIDB/3 LENB/1 ROUNDUP/2 ROUNDDOWN/2 ASC/1 DBCS/1 RANK - - ADDRESS DAYS360 TODAY/0 VDB');
definisci(227, 'MEDIAN SUMPRODUCT SINH/1 COSH/1 TANH/1 ASINH/1 ACOSH/1 ATANH/1 DGET/3');
definisci(244, 'INFO/1 - - DB - - - - FREQUENCY/2');
definisci(261, 'ERROR.TYPE/1');
definisci(269, 'AVEDEV BETADIST GAMMALN/1 BETAINV BINOMDIST/4 CHIDIST/2 CHIINV/2 COMBIN/2 CONFIDENCE/3 CRITBINOM/3 EVEN/1 EXPONDIST/3 FDIST/3 FINV/3 FISHER/1 FISHERINV/1 FLOOR/2 GAMMADIST/4 GAMMAINV/3 CEILING/2 HYPGEOMDIST/4 LOGNORMDIST/3 LOGINV/3 NEGBINOMDIST/3 NORMDIST/4 NORMSDIST/1 NORMINV/3 NORMSINV/1 STANDARDIZE/3 ODD/1 PERMUT/2 POISSON/3 TDIST/3 WEIBULL/4 SUMXMY2/2 SUMX2MY2/2 SUMX2PY2/2 CHITEST/2 CORREL/2 COVAR/2 FORECAST/3 FTEST/2 INTERCEPT/2 PEARSON/2 RSQ/2 STEYX/2 SLOPE/2 TTEST/4 PROB DEVSQ GEOMEAN HARMEAN SUMSQ KURT SKEW ZTEST LARGE/2 SMALL/2 QUARTILE/2 PERCENTILE/2 PERCENTRANK MODE TRIMMEAN/2 TINV/2');
definisci(336, 'CONCATENATE POWER/2 - - - - RADIANS/1 DEGREES/1 SUBTOTAL SUMIF COUNTIF/2 COUNTBLANK/1 - - ISPMT/4 DATEDIF/3 DATESTRING/1 NUMBERSTRING/2 ROMAN - - - GETPIVOTDATA HYPERLINK PHONETIC/1 AVERAGEA MAXA MINA STDEVPA VARPA STDEVA VARA BAHTTEXT/1');

const ERRORI: Record<number, string> = { 0x00: '#NULL!', 0x07: '#DIV/0!', 0x0f: '#VALUE!', 0x17: '#REF!', 0x1d: '#NAME?', 0x24: '#NUM!', 0x2a: '#N/A', 0x2b: '#GETTING_DATA' };
export function erroreXls(codice: number): string { return ERRORI[codice] ?? '#VALUE!'; }

/** Precedenze, dalla più debole alla più forte: un pezzo con precedenza più bassa dell'operatore va tra parentesi. */
const P = { confronto: 10, concatena: 20, somma: 30, prodotto: 40, potenza: 50, percento: 60, segno: 70, unione: 75, intersezione: 80, intervallo: 85, atomo: 100 };
const BINARI: Record<number, [string, number]> = {
  0x03: ['+', P.somma], 0x04: ['-', P.somma], 0x05: ['*', P.prodotto], 0x06: ['/', P.prodotto], 0x07: ['^', P.potenza], 0x08: ['&', P.concatena],
  0x09: ['<', P.confronto], 0x0a: ['<=', P.confronto], 0x0b: ['=', P.confronto], 0x0c: ['>=', P.confronto], 0x0d: ['>', P.confronto], 0x0e: ['<>', P.confronto],
  0x0f: [' ', P.intersezione], 0x10: [',', P.unione], 0x11: [':', P.intervallo],
};

interface Pezzo { t: string; p: number; nomeFunzione?: string }

class Fine extends Error {}

/** Nome di foglio come si scrive in una formula: tra apici se non è una parola semplice o se somiglia a una cella. */
export function foglioInFormula(nome: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(nome) && !/^[A-Za-z]{1,3}[0-9]+$/.test(nome) && !/^(TRUE|FALSE)$/i.test(nome)) return nome;
  return `'${nome.replace(/'/g, "''")}'`;
}

const testoTraVirgolette = (s: string): string => `"${s.replace(/"/g, '""')}"`;

function numero(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return String(n).toUpperCase();
}

/**
 * Dal codice della formula (rgce) e dai dati in più (rgcb, per le matrici costanti) al testo della formula, senza "=".
 * Se la formula usa qualcosa che pmb_sheets non può scrivere (riferimenti ad altri file, comandi delle macro...) dà il motivo.
 */
export function testoFormula(rgce: Uint8Array, rgcb: Uint8Array, dove: PosizioneFormula, cartella: CartellaFormule): EsitoFormula {
  try {
    return { testo: converti(rgce, rgcb, dove, cartella) };
  } catch (e) {
    return { motivo: e instanceof Error ? e.message : String(e) };
  }
}

function converti(g: Uint8Array, extra: Uint8Array, dove: PosizioneFormula, cartella: CartellaFormule): string {
  const v = cartella.versione ?? 8;
  const dv = new DataView(g.buffer, g.byteOffset, g.byteLength);
  const ex = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let pe = 0; // posizione nei dati in più
  const pila: Pezzo[] = [];
  const togli = (): Pezzo => { const x = pila.pop(); if (!x) throw new Fine('formula incompleta'); return x; };
  const serve = (n: number, p: number): void => { if (p + n > g.length) throw new Fine('formula troncata'); };
  const u8 = (p: number): number => { serve(1, p); return g[p]; };
  const u16 = (p: number): number => { serve(2, p); return dv.getUint16(p, true); };
  const u32 = (p: number): number => { serve(4, p); return dv.getUint32(p, true); };
  const testo8bit = (p: number, n: number): string => { serve(n, p); return cartella.decodifica ? cartella.decodifica(g.subarray(p, p + n)) : String.fromCharCode(...g.subarray(p, p + n)); };
  // fino a Excel 95 le righe sono 16384 (14 bit, i due bit alti dicono «relativo») e le colonne stanno in un byte
  const MAX_RIGA = v >= 8 ? 0xffff : 0x3fff;
  const LATO = v >= 8 ? 4 : 3; // byte di una cella (riga + colonna)

  /** Un riferimento: in Excel 97 la riga ha 16 bit e i segni di «relativo» stanno nella colonna, prima stanno nei due bit alti della riga.
   *  Nelle formule condivise i relativi sono spostamenti dalla cella. */
  const rif = (rigaGrezza: number, colonnaGrezza: number, spostamento: boolean): { testo: string; r: number; c: number; rRel: boolean; cRel: boolean } => {
    const segni = v >= 8 ? colonnaGrezza : rigaGrezza;
    const rRel = (segni & 0x8000) !== 0;
    const cRel = (segni & 0x4000) !== 0;
    let r = v >= 8 ? rigaGrezza : rigaGrezza & 0x3fff;
    let c = v >= 8 ? colonnaGrezza & 0x3fff : colonnaGrezza;
    if (spostamento && rRel) r = (dove.riga + r) & MAX_RIGA;
    if (spostamento && cRel) c = (dove.colonna + (c & 0xff)) & 0xff;
    return { testo: `${cRel ? '' : '$'}${columnIndexToLetters(c + 1)}${rRel ? '' : '$'}${r + 1}`, r, c, rRel, cRel };
  };
  const cella = (p: number, spostamento: boolean): ReturnType<typeof rif> => (v >= 8 ? rif(u16(p), u16(p + 2), spostamento) : rif(u16(p), u8(p + 2), spostamento));
  /** Un'area: prima le due righe, poi le due colonne (da 2 byte in Excel 97, da 1 byte prima). */
  const area = (p: number, spostamento: boolean): string => {
    const [a, b] = v >= 8
      ? [rif(u16(p), u16(p + 4), spostamento), rif(u16(p + 2), u16(p + 6), spostamento)]
      : [rif(u16(p), u8(p + 4), spostamento), rif(u16(p + 2), u8(p + 5), spostamento)];
    // colonne intere (A:B) e righe intere (1:2), come le scrive Excel
    if (a.r === 0 && b.r === MAX_RIGA) return `${a.cRel ? '' : '$'}${columnIndexToLetters(a.c + 1)}:${b.cRel ? '' : '$'}${columnIndexToLetters(b.c + 1)}`;
    if (a.c === 0 && b.c === 0xff) return `${a.rRel ? '' : '$'}${a.r + 1}:${b.rRel ? '' : '$'}${b.r + 1}`;
    return `${a.testo}:${b.testo}`;
  };
  const LUNGO_AREA = v >= 8 ? 8 : 6;
  const prefisso = (f: { primo: string; ultimo: string } | null): string => {
    if (!f) throw new Fine('riferimento a un altro file');
    return `${f.primo === f.ultimo ? foglioInFormula(f.primo) : foglioInFormula(`${f.primo}:${f.ultimo}`)}!`;
  };
  /** I fogli di un riferimento 3D: in Excel 97 un indice della tabella dei rimandi, in Excel 5/95 direttamente il primo e l'ultimo foglio. */
  const fogli3d = (p: number): { prefisso: string; dopo: number } => {
    if (v >= 8) return { prefisso: prefisso(cartella.fogli(u16(p))), dopo: p + 2 };
    const ixals = u16(p) >= 0x8000 ? u16(p) - 0x10000 : u16(p);
    const primo = u16(p + 10), ultimo = u16(p + 12);
    if (ixals > 0 || primo === 0xffff || !cartella.foglioIndice) throw new Fine('riferimento a un altro file');
    const a = cartella.foglioIndice(primo), b = cartella.foglioIndice(ultimo);
    return { prefisso: prefisso(a !== undefined && b !== undefined ? { primo: a, ultimo: b } : null), dopo: p + 14 };
  };
  // nelle formule condivise e nei nomi i riferimenti normali (tRef) sono assoluti, quelli "N" e i 3D relativi sono spostamenti
  const spostamento3d = dove.condivisa;

  const leggiMatrice = (): string => {
    if (pe + 3 > extra.length) throw new Fine('matrice senza dati');
    // in Excel 97 colonne e righe meno uno; prima il numero vero (0 colonne vuol dire 256)
    const colonne = v >= 8 ? extra[pe] + 1 : extra[pe] || 256;
    const righe = v >= 8 ? ex.getUint16(pe + 1, true) + 1 : ex.getUint16(pe + 1, true);
    pe += 3;
    const righeTesto: string[] = [];
    for (let r = 0; r < righe; r++) {
      const celle: string[] = [];
      for (let c = 0; c < colonne; c++) {
        if (pe >= extra.length) throw new Fine('matrice troncata');
        const tipo = extra[pe++];
        if (tipo === 0x01) { if (pe + 8 > extra.length) throw new Fine('matrice troncata'); celle.push(numero(ex.getFloat64(pe, true))); pe += 8; }
        else if (tipo === 0x02) {
          let s = '';
          if (v >= 8) {
            if (pe + 3 > extra.length) throw new Fine('matrice troncata');
            const n = ex.getUint16(pe, true); const alti = (extra[pe + 2] & 1) !== 0; pe += 3;
            for (let k = 0; k < n; k++) { if (pe + (alti ? 2 : 1) > extra.length) throw new Fine('matrice troncata'); s += String.fromCharCode(alti ? ex.getUint16(pe, true) : extra[pe]); pe += alti ? 2 : 1; }
          } else {
            const n = extra[pe++];
            if (pe + n > extra.length) throw new Fine('matrice troncata');
            const byte = extra.subarray(pe, pe + n);
            s = cartella.decodifica ? cartella.decodifica(byte) : String.fromCharCode(...byte);
            pe += n;
          }
          celle.push(testoTraVirgolette(s));
        } else if (tipo === 0x04) { celle.push(extra[pe] ? 'TRUE' : 'FALSE'); pe += 8; }
        else if (tipo === 0x10) { celle.push(erroreXls(extra[pe])); pe += 8; }
        else if (tipo === 0x00) { celle.push('0'); pe += 8; }
        else throw new Fine('valore della matrice sconosciuto');
      }
      righeTesto.push(celle.join(','));
    }
    return `{${righeTesto.join(';')}}`;
  };

  const chiama = (nome: string, n: number): void => {
    if (pila.length < n) throw new Fine('argomenti mancanti');
    // un'unione dentro gli argomenti va tra parentesi, altrimenti la sua virgola separerebbe gli argomenti
    const argomenti = pila.splice(pila.length - n, n).map((a) => (a.p === P.unione ? `(${a.t})` : a.t));
    pila.push({ t: `${nome}(${argomenti.join(',')})`, p: P.atomo });
  };
  // fino a Excel 3.0 l'indice delle funzioni sta in un byte, da Excel 4.0 in due
  const FUNZIONE_LARGA = v >= 4;
  const ATTR = v >= 3 ? 4 : 3;

  let p = 0;
  while (p < g.length) {
    const ptg = g[p];
    if (ptg >= 0x03 && ptg <= 0x11) {
      const [op, prec] = BINARI[ptg];
      const b = togli(); const a = togli();
      const sinistra = a.p < prec ? `(${a.t})` : a.t;
      const destra = b.p <= prec ? `(${b.t})` : b.t;
      pila.push({ t: `${sinistra}${op}${destra}`, p: prec });
      p += 1;
      continue;
    }
    switch (ptg) {
      case 0x01: throw new Fine('formula condivisa o matrice'); // tExp: lo risolve chi legge le celle
      case 0x02: throw new Fine('tabella di dati');
      case 0x12: { const a = togli(); pila.push({ t: `+${a.p < P.segno ? `(${a.t})` : a.t}`, p: P.segno }); p += 1; break; }
      case 0x13: { const a = togli(); pila.push({ t: `-${a.p < P.segno ? `(${a.t})` : a.t}`, p: P.segno }); p += 1; break; }
      case 0x14: { const a = togli(); pila.push({ t: `${a.p < P.percento ? `(${a.t})` : a.t}%`, p: P.percento }); p += 1; break; }
      case 0x15: { const a = togli(); pila.push({ t: `(${a.t})`, p: P.atomo }); p += 1; break; }
      case 0x16: pila.push({ t: '', p: P.atomo }); p += 1; break;
      case 0x17: {
        const n = u8(p + 1);
        if (v >= 8) {
          const alti = (u8(p + 2) & 1) !== 0;
          let s = '';
          for (let k = 0; k < n; k++) s += String.fromCharCode(alti ? u16(p + 3 + k * 2) : u8(p + 3 + k));
          pila.push({ t: testoTraVirgolette(s), p: P.atomo });
          p += 3 + n * (alti ? 2 : 1);
        } else {
          pila.push({ t: testoTraVirgolette(testo8bit(p + 2, n)), p: P.atomo });
          p += 2 + n;
        }
        break;
      }
      case 0x18: throw new Fine('gettone esteso');
      case 0x19: {
        const tipo = u8(p + 1);
        if (tipo & 0x04) { const n = v >= 3 ? u16(p + 2) : u8(p + 2); p += ATTR + (v >= 3 ? 2 : 1) * (n + 1); break; } // salto di CHOOSE
        if (tipo & 0x10) { const a = togli(); pila.push({ t: `SUM(${a.p === P.unione ? `(${a.t})` : a.t})`, p: P.atomo }); }
        p += ATTR; // volatile, salti di IF, spazi: non cambiano il testo
        break;
      }
      case 0x1c: pila.push({ t: erroreXls(u8(p + 1)), p: P.atomo }); p += 2; break;
      case 0x1d: pila.push({ t: u8(p + 1) ? 'TRUE' : 'FALSE', p: P.atomo }); p += 2; break;
      case 0x1e: pila.push({ t: String(u16(p + 1)), p: P.atomo }); p += 3; break;
      case 0x1f: serve(9, p); pila.push({ t: numero(dv.getFloat64(p + 1, true)), p: P.atomo }); p += 9; break;
      default: {
        if (ptg < 0x20 || ptg > 0x7f) throw new Fine(`gettone sconosciuto ${ptg}`);
        const base = 0x20 | (ptg & 0x1f);
        switch (base) {
          case 0x20: pila.push({ t: leggiMatrice(), p: P.atomo }); p += v >= 3 ? 8 : 7; break;
          case 0x21: {
            const indice = FUNZIONE_LARGA ? u16(p + 1) : u8(p + 1);
            const f = FUNZIONI[indice];
            if (!f || f[1] === undefined) throw new Fine(`funzione ${indice}`);
            chiama(f[0], f[1]);
            p += FUNZIONE_LARGA ? 3 : 2;
            break;
          }
          case 0x22: {
            const n = u8(p + 1) & 0x7f;
            const campo = FUNZIONE_LARGA ? u16(p + 2) : u8(p + 2);
            if (FUNZIONE_LARGA && campo & 0x8000) throw new Fine('comando delle macro');
            const indice = FUNZIONE_LARGA ? campo & 0x7fff : campo;
            if (indice === 255) {
              // funzione aggiuntiva o recente: il primo argomento è il suo nome
              if (pila.length < n || n < 1) throw new Fine('argomenti mancanti');
              const nome = pila[pila.length - n];
              if (!nome.nomeFunzione) throw new Fine('funzione senza nome');
              const argomenti = pila.splice(pila.length - n + 1, n - 1);
              pila.pop();
              pila.push(...argomenti);
              chiama(nome.nomeFunzione.replace(/^_xl(?:fn|ws)\./i, ''), n - 1);
            } else {
              const f = FUNZIONI[indice];
              if (!f) throw new Fine(`funzione ${indice}`);
              chiama(f[0], n);
            }
            p += FUNZIONE_LARGA ? 4 : 3;
            break;
          }
          case 0x23: {
            // i nomi: in Excel 97 l'indice e due byte liberi, in Excel 5/95 l'indice e 12 byte liberi; prima ancora non si leggono
            if (v < 5) throw new Fine('nome di una versione vecchia');
            const nome = cartella.nome(v >= 8 ? u32(p + 1) : u16(p + 1));
            if (nome === undefined) throw new Fine('nome mancante');
            pila.push({ t: nome, p: P.atomo, nomeFunzione: nome });
            p += v >= 8 ? 5 : 15;
            break;
          }
          case 0x24: pila.push({ t: cella(p + 1, false).testo, p: P.atomo }); p += 1 + LATO; break;
          case 0x25: pila.push({ t: area(p + 1, false), p: P.atomo }); p += 1 + LUNGO_AREA; break;
          case 0x26: case 0x27: case 0x28: {
            // l'area calcolata in anticipo: il valore lo danno i gettoni che seguono; i dati in più si saltano
            if (base === 0x26 && v >= 8 && pe + 2 <= extra.length) pe += 2 + ex.getUint16(pe, true) * 8;
            p += v >= 3 ? 7 : 6;
            break;
          }
          case 0x29: case 0x2e: case 0x2f: p += v >= 3 ? 3 : 2; break;
          case 0x2a: pila.push({ t: '#REF!', p: P.atomo }); p += 1 + LATO; break;
          case 0x2b: pila.push({ t: '#REF!', p: P.atomo }); p += 1 + LUNGO_AREA; break;
          case 0x2c: pila.push({ t: cella(p + 1, true).testo, p: P.atomo }); p += 1 + LATO; break;
          case 0x2d: pila.push({ t: area(p + 1, true), p: P.atomo }); p += 1 + LUNGO_AREA; break;
          case 0x39: {
            let nome: string | undefined;
            if (v >= 8) { nome = cartella.nomeEsterno(u16(p + 1), u32(p + 3)); p += 7; }
            else if (v === 5) {
              const ixals = u16(p + 1) >= 0x8000 ? u16(p + 1) - 0x10000 : u16(p + 1);
              nome = ixals < 0 ? cartella.nomeEsterno(-ixals - 1, u16(p + 11)) : undefined;
              p += 25;
            } else throw new Fine('nome esterno di una versione vecchia');
            if (nome === undefined) throw new Fine('nome di un altro file');
            pila.push({ t: nome, p: P.atomo, nomeFunzione: nome });
            break;
          }
          case 0x3a: case 0x3c: {
            if (v < 5) throw new Fine('riferimento 3D di una versione vecchia');
            const f = fogli3d(p + 1);
            pila.push({ t: base === 0x3c ? '#REF!' : f.prefisso + cella(f.dopo, spostamento3d).testo, p: P.atomo });
            p = f.dopo + LATO;
            break;
          }
          case 0x3b: case 0x3d: {
            if (v < 5) throw new Fine('riferimento 3D di una versione vecchia');
            const f = fogli3d(p + 1);
            pila.push({ t: base === 0x3d ? '#REF!' : f.prefisso + area(f.dopo, spostamento3d), p: P.atomo });
            p = f.dopo + LUNGO_AREA;
            break;
          }
          default: throw new Fine(`gettone sconosciuto ${ptg}`);
        }
      }
    }
  }
  if (pila.length !== 1) throw new Fine('formula incompleta');
  return pila[0].t;
}
