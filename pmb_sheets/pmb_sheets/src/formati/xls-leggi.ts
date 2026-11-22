// Lettura dei file .xls nel modello di scambio: Excel 97-2003 (formato binario BIFF8, specifica pubblica [MS-XLS] di Microsoft) e le versioni
// prima, Excel 5.0/95 (BIFF5) ed Excel 2.x, 3.0 e 4.0 (BIFF2-4, un foglio solo, senza contenitore), che negli archivi si trovano ancora.
// Il file è un file composto (comune/src/formati/cfb.ts) con dentro il flusso «Workbook» («Book» in Excel 5/95): una fila di record (tipo,
// lunghezza, dati). Prima vengono i record della cartella (fogli, testi condivisi, caratteri, stili, nomi), poi un blocco di record per ogni foglio.
// Fino a Excel 95 i testi sono da un byte nella codifica indicata dal file (record CODEPAGE). Un file protetto con la password «di sola lettura»
// di Excel si apre da solo (RC4, comune/src/formati/cifratura-office.ts); con un'altra password serve la password (leggiXls la riceve).
// Si importano: valori, formule (testo come in pmb_sheets, vedi xls-formule.ts), date, formati numerici, caratteri, colori, bordi,
// allineamento, celle unite, larghezze, altezze, righe e colonne nascoste, righe e colonne bloccate, colore della scheda, commenti,
// collegamenti, nomi definiti, area di stampa e impostazione della pagina, tabella del filtro automatico.
// Puro: riceve i byte. Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.
import { eFileComposto, leggiCfb } from '@comune/formati/cfb';
import { chiaveRc4, flussoChiaveABlocchi, PASSWORD_PREDEFINITA_EXCEL } from '@comune/formati/cifratura-office';
import { PasswordRichiesta } from '@comune/protezione/password-file';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import type { BorderDef, BorderSet, CellStyle } from '../sheet/styles';
import { urlAmmesso } from '../sheet/link';
import { eDiPartenza, paginaPredefinita, ripulisciPagina, type ImpostaPagina } from '../sheet/pagina';
import type { FoglioScambio, NomeScambio, Scambio } from './scambio';
import { indirizzoCella } from './scambio';
import { codiceFormatoFogli, eFormatoData, FORMATI_INTEGRATI } from './xlsx-leggi';
import { aggiungiNomeStampa, CARTA_DA_CODICE, leggiMargineExcel, mm } from './xlsx-pagina';
import { mettiCella, nomiUniciFogli, nuovoFoglio } from './lettura-comune';
import { erroreXls, testoFormula, type CartellaFormule, type EsitoFormula } from './xls-formule';
import { t } from '../i18n/lingua';

export interface RisultatoXls { scambio: Scambio; avvisi: string[] }

// ---- lettura dei record ----

interface Rec { tipo: number; dati: Uint8Array; seguiti: Uint8Array[]; inizio: number }

const leU16 = (b: Uint8Array, p: number): number => (p + 1 < b.length ? b[p] | (b[p + 1] << 8) : 0);
const leU32 = (b: Uint8Array, p: number): number => (p + 3 < b.length ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : 0);
const leF64 = (b: Uint8Array, p: number): number => (p + 7 < b.length ? new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true) : 0);

/** I record del flusso a partire da una posizione; i record CONTINUE che seguono si attaccano al record che continuano. */
function* records(w: Uint8Array, da: number): Generator<Rec> {
  let p = da;
  while (p + 4 <= w.length) {
    const inizio = p;
    const tipo = leU16(w, p);
    const lun = leU16(w, p + 2);
    const dati = w.subarray(p + 4, Math.min(w.length, p + 4 + lun));
    p += 4 + lun;
    const seguiti: Uint8Array[] = [];
    while (p + 4 <= w.length && leU16(w, p) === 0x003c) {
      const l = leU16(w, p + 2);
      seguiti.push(w.subarray(p + 4, Math.min(w.length, p + 4 + l)));
      p += 4 + l;
    }
    yield { tipo, dati, seguiti, inizio };
  }
}

function tutto(r: Rec): Uint8Array {
  if (r.seguiti.length === 0) return r.dati;
  const out = new Uint8Array(r.dati.length + r.seguiti.reduce((n, s) => n + s.length, 0));
  let p = 0;
  for (const s of [r.dati, ...r.seguiti]) { out.set(s, p); p += s.length; }
  return out;
}

/** Legge dati e testi di un record che può continuare nei record CONTINUE: un testo spezzato riprende con un byte che dice se i caratteri sono da 1 o da 2 byte. */
class Lettore {
  private s = 0;
  private p = 0;
  constructor(private readonly seg: Uint8Array[], private readonly decodifica: (b: Uint8Array) => string = latino) {}
  /** n byte di testo da un byte per carattere (fino a Excel 95), nella codifica del file. */
  byteTesto(n: number): string {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = this.u8();
    return this.decodifica(b);
  }
  /** Testo di Excel 5/95 e prima: lunghezza da 1 byte e caratteri da 1 byte. */
  vecchio8(): string { return this.byteTesto(this.u8()); }
  /** Testo di Excel 5/95 e prima: lunghezza da 2 byte e caratteri da 1 byte. */
  vecchio16(): string { return this.byteTesto(this.u16()); }
  private pronto(): void { while (this.s < this.seg.length && this.p >= this.seg[this.s].length) { this.s++; this.p = 0; } }
  u8(): number { this.pronto(); if (this.s >= this.seg.length) throw new Error(t('record troncato')); return this.seg[this.s][this.p++]; }
  u16(): number { const a = this.u8(); return a | (this.u8() << 8); }
  u32(): number { const a = this.u16(); return (a | (this.u16() << 16)) >>> 0; }
  salta(n: number): void {
    let resto = n;
    while (resto > 0 && this.s < this.seg.length) {
      const qui = Math.min(resto, this.seg[this.s].length - this.p);
      this.p += qui; resto -= qui;
      if (resto > 0) { this.s++; this.p = 0; }
    }
  }
  /** Va alla fine del segmento in corso: il testo che segue comincia nel prossimo segmento (serve per i testi delle caselle). */
  fineSegmento(): void { if (this.s < this.seg.length) this.p = this.seg[this.s].length; }
  caratteri(n: number, alti: boolean): string {
    const pezzi: string[] = [];
    let resto = n;
    let larghi = alti;
    while (resto > 0) {
      if (this.s >= this.seg.length) throw new Error(t('testo troncato'));
      const seg = this.seg[this.s];
      if (this.p >= seg.length) {
        this.s++; this.p = 0;
        if (this.s >= this.seg.length) throw new Error(t('testo troncato'));
        larghi = (this.seg[this.s][this.p++] & 1) !== 0;
        continue;
      }
      const disponibili = larghi ? (seg.length - this.p) >> 1 : seg.length - this.p;
      if (disponibili === 0) { this.p = seg.length; continue; }
      const k = Math.min(resto, disponibili);
      const codici = new Array<number>(k);
      for (let i = 0; i < k; i++) codici[i] = larghi ? seg[this.p + 2 * i] | (seg[this.p + 2 * i + 1] << 8) : seg[this.p + i];
      this.p += larghi ? 2 * k : k;
      for (let i = 0; i < k; i += 8192) pezzi.push(String.fromCharCode(...codici.slice(i, i + 8192)));
      resto -= k;
    }
    return pezzi.join('');
  }
  /** Testo con lunghezza da 2 byte e indicatori (XLUnicodeString). */
  testo16(): string { const n = this.u16(); return this.caratteri(n, (this.u8() & 1) !== 0); }
  /** Testo con lunghezza da 1 byte (ShortXLUnicodeString). */
  testo8(): string { const n = this.u8(); return this.caratteri(n, (this.u8() & 1) !== 0); }
  /** Testo della tabella dei testi condivisi, con le parti di formattazione e di pronuncia che si saltano. */
  testoRicco(): string {
    const n = this.u16();
    const indicatori = this.u8();
    const pezzi = indicatori & 0x08 ? this.u16() : 0;
    const estensione = indicatori & 0x04 ? this.u32() : 0;
    const s = this.caratteri(n, (indicatori & 1) !== 0);
    this.salta(pezzi * 4 + estensione);
    return s;
  }
}

/** Codifica di partenza dei testi da un byte: quella dell'Europa occidentale di Windows. */
const WINDOWS_1252 = new TextDecoder('windows-1252');
function latino(b: Uint8Array): string { return WINDOWS_1252.decode(b); }

/** La codifica dei testi da un byte indicata dal record CODEPAGE (fino a Excel 95; nei file di Excel 97 i testi sono Unicode). */
function decodificaDi(pagina: number): (b: Uint8Array) => string {
  const nomi: Record<number, string> = { 1250: 'windows-1250', 1251: 'windows-1251', 1252: 'windows-1252', 1253: 'windows-1253', 1254: 'windows-1254', 1255: 'windows-1255', 1256: 'windows-1256', 1257: 'windows-1257', 1258: 'windows-1258', 874: 'windows-874', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5', 10000: 'macintosh', 32768: 'macintosh', 32769: 'windows-1252', 866: 'ibm866' };
  const nome = nomi[pagina];
  if (!nome) return latino;
  try { const d = new TextDecoder(nome); return (b) => d.decode(b); } catch { return latino; }
}

const lettore = (r: Rec, decodifica: (b: Uint8Array) => string = latino): Lettore => new Lettore([r.dati, ...r.seguiti], decodifica);

// ---- colori ----

const FISSI = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
/** La tavolozza di partenza di Excel 97 (colori da 8 a 63), usata quando il file non ne ha una sua; il record PALETTE la cambia. */
const TAVOLOZZA = ('000000 ffffff ff0000 00ff00 0000ff ffff00 ff00ff 00ffff 800000 008000 000080 808000 800080 008080 c0c0c0 808080 '
  + '9999ff 993366 ffffcc ccffff 660066 ff8080 0066cc ccccff 000080 ff00ff ffff00 00ffff 800080 800000 008080 0000ff '
  + '00ccff ccffff ccffcc ffff99 99ccff ff99cc cc99ff ffcc99 3366ff 33cccc 99cc00 ffcc00 ff9900 ff6600 666699 969696 '
  + '003366 339966 003300 333300 993300 993366 333399 333333').split(' ').map((x) => `#${x}`);

// ---- la cartella ----

interface Carattere { nome: string; punti: number; grassetto: boolean; corsivo: boolean; sottolineato: boolean; barrato: boolean; colore: number }
interface Xf {
  carattere: number; formato: number; orizzontale: number; verticale: number; aCapo: boolean; rientro: number; rotazione: number;
  bordi: Array<[number, number]>; // sinistra, destra, sopra, sotto: [stile della linea, colore]
  motivo: number; primoPiano: number;
}
interface Nome { nome: string; nascosto: boolean; funzione: boolean; incorporato: number | null; foglio: number; rgce: Uint8Array; rgcb: Uint8Array }
interface Libro { tipo: 'questo' | 'aggiunte' | 'esterno'; nomi: string[] }
interface VoceFoglio { nome: string; posizione: number; stato: number; tipo: number }

interface Cartella {
  /** 8 per Excel 97-2003, 5 per Excel 5.0/95, 4, 3 e 2 per Excel 4.0, 3.0 e 2.x */
  versione: number;
  decodifica: (b: Uint8Array) => string;
  calendario1904: boolean;
  fogli: VoceFoglio[];
  testi: string[];
  formati: Map<number, string>;
  caratteri: Carattere[];
  xf: Xf[];
  tavolozza: string[];
  nomi: Nome[];
  libri: Libro[];
  rimandi: Array<{ libro: number; primo: number; ultimo: number }>;
  attivo: number;
  tabellePivot: boolean;
}

const INCORPORATI = ['Consolidate_Area', 'Auto_Open', 'Auto_Close', 'Extract', 'Database', 'Criteria', 'Print_Area', 'Print_Titles', 'Recorder', 'Data_Form', 'Auto_Activate', 'Auto_Deactivate', 'Sheet_Title', '_FilterDatabase'];

/** Il file è cifrato con una password: con RC4 una password giusta lo apre, con il vecchio metodo XOR no. */
class FileProtetto extends Error { constructor(public readonly rc4 = false) { super('protetto'); } }
/** Un errore che si mostra così com'è, senza «File .xls non valido» davanti. */
class ErroreChiaro extends Error {}

/** Inizio di un blocco di record (BOF): il tipo del record dice la versione fino a Excel 4.0, poi la dice il primo campo. */
const BOF = new Set([0x0009, 0x0209, 0x0409, 0x0809]);
function versioneDaBof(r: Rec): number {
  if (r.tipo === 0x0009) return 2;
  if (r.tipo === 0x0209) return 3;
  if (r.tipo === 0x0409) return 4;
  const v = leU16(r.dati, 0);
  // Excel 95 scrive anche 0x0580 e simili: tutta la serie 0x05xx è il formato di Excel 5/95
  return v === 0x0600 ? 8 : v >= 0x0500 && v < 0x0600 ? 5 : 0;
}

/** I record della cartella (o, fino a Excel 4.0, del file intero): fogli, testi condivisi, caratteri, formati, stili, nomi. */
function leggiCartella(w: Uint8Array, nomeSoloFoglio: string, decifrato = false): Cartella {
  const c: Cartella = { versione: 8, decodifica: latino, calendario1904: false, fogli: [], testi: [], formati: new Map(), caratteri: [], xf: [], tavolozza: [...FISSI, ...TAVOLOZZA], nomi: [], libri: [], rimandi: [], attivo: 0, tabellePivot: false };
  let primo = true;
  let v = 8;
  let formatiContati = 0;
  for (const r of records(w, 0)) {
    const d = r.dati;
    if (primo) {
      primo = false;
      if (!BOF.has(r.tipo)) throw new Error(t('manca l\'inizio della cartella'));
      v = versioneDaBof(r);
      const tipo = leU16(d, 2);
      // Excel 4.0 sa anche raccogliere più fogli in una «cartella» con un formato suo: non si apre
      if (v === 0 || (v <= 4 && tipo === 0x0100)) throw new ErroreChiaro(t('Il file è di una versione di Excel più vecchia della 97, che pmb_sheets non apre: in Excel o LibreOffice salvalo come .xlsx e aprilo di nuovo.'));
      c.versione = v;
      // fino a Excel 4.0 il file è un foglio solo, con i suoi caratteri e stili dentro
      if (v <= 4) c.fogli.push({ nome: nomeSoloFoglio, posizione: 0, stato: 0, tipo: 0 });
      continue;
    }
    const l = (): Lettore => lettore(r, c.decodifica);
    // un record rovinato si salta: il resto del file si legge lo stesso (la cifratura invece ferma tutto)
    try {
    switch (r.tipo) {
      case 0x000a: return c;
      case 0x002f: if (!decifrato) throw new FileProtetto(); break;
      case 0x0042: if (v < 8) c.decodifica = decodificaDi(leU16(d, 0)); break;
      case 0x0022: c.calendario1904 = leU16(d, 0) === 1; break;
      case 0x003d: c.attivo = leU16(d, 10); break;
      case 0x0085: {
        const x = l(); const posizione = x.u32(); const stato = x.u8() & 3; const tipo = x.u8();
        c.fogli.push({ nome: v >= 8 ? x.testo8() : x.vecchio8(), posizione, stato, tipo });
        break;
      }
      case 0x00fc: {
        const x = l(); x.u32(); const n = x.u32();
        for (let i = 0; i < n; i++) {
          try { c.testi.push(x.testoRicco()); } catch { break; }
        }
        break;
      }
      case 0x041e: {
        const x = l(); const id = x.u16();
        if (v >= 8) c.formati.set(id, x.testo16());
        else if (v === 5) c.formati.set(id, x.vecchio8());
        else c.formati.set(formatiContati++, x.vecchio8()); // Excel 4.0: i due byte non sono il numero
        break;
      }
      case 0x001e: c.formati.set(formatiContati++, l().vecchio8()); break;
      case 0x0031: {
        const x = l();
        const altezza = x.u16(); const ind = x.u16();
        if (v === 2) {
          c.caratteri.push({ nome: x.vecchio8(), punti: altezza / 20, grassetto: (ind & 1) !== 0, corsivo: (ind & 2) !== 0, sottolineato: (ind & 4) !== 0, barrato: (ind & 8) !== 0, colore: 0x7fff });
          break;
        }
        const colore = x.u16(); const peso = x.u16(); x.u16(); const sotto = x.u8(); x.salta(3);
        c.caratteri.push({ nome: v >= 8 ? x.testo8() : x.vecchio8(), punti: altezza / 20, grassetto: peso >= 600, corsivo: (ind & 0x02) !== 0, barrato: (ind & 0x08) !== 0, sottolineato: sotto !== 0, colore });
        break;
      }
      case 0x0231: {
        // carattere di Excel 3.0 e 4.0: il grassetto è un segno, non un peso
        const x = l();
        const altezza = x.u16(); const ind = x.u16(); const colore = x.u16();
        c.caratteri.push({ nome: x.vecchio8(), punti: altezza / 20, grassetto: (ind & 1) !== 0, corsivo: (ind & 2) !== 0, sottolineato: (ind & 4) !== 0, barrato: (ind & 8) !== 0, colore });
        break;
      }
      case 0x0045: { const f = c.caratteri[c.caratteri.length - 1]; if (f) f.colore = leU16(d, 0); break; }
      case 0x00e0: {
        if (v >= 8 && d.length >= 20) {
          const all = d[6];
          const b1 = leU32(d, 10), b2 = leU32(d, 14), b3 = leU16(d, 18);
          c.xf.push({
            carattere: leU16(d, 0), formato: leU16(d, 2), orizzontale: all & 7, aCapo: (all & 8) !== 0, verticale: (all >> 4) & 7, rotazione: d[7], rientro: d[8] & 0x0f,
            bordi: [[b1 & 0xf, (b1 >>> 16) & 0x7f], [(b1 >>> 4) & 0xf, (b1 >>> 23) & 0x7f], [(b1 >>> 8) & 0xf, b2 & 0x7f], [(b1 >>> 12) & 0xf, (b2 >>> 7) & 0x7f]],
            motivo: (b2 >>> 26) & 0x3f, primoPiano: b3 & 0x7f,
          });
        } else if (v === 5 && d.length >= 16) {
          // Excel 5/95: allineamento in 2 byte, riempimento e bordo inferiore, poi gli altri tre bordi
          const all = leU16(d, 6), a = leU32(d, 8), b = leU32(d, 12);
          c.xf.push({
            carattere: leU16(d, 0), formato: leU16(d, 2), orizzontale: all & 7, aCapo: (all & 8) !== 0, verticale: (all >> 4) & 7, rotazione: (all >> 8) & 3, rientro: 0,
            bordi: [[(b >>> 3) & 7, (b >>> 16) & 0x7f], [(b >>> 6) & 7, (b >>> 23) & 0x7f], [b & 7, (b >>> 9) & 0x7f], [(a >>> 22) & 7, (a >>> 25) & 0x7f]],
            motivo: (a >>> 16) & 0x3f, primoPiano: a & 0x7f,
          });
        }
        break;
      }
      case 0x0443: case 0x0243: {
        // Excel 4.0 e 3.0: 12 byte, colori da 5 bit
        if (d.length < 12) break;
        const all = v === 4 ? d[4] : leU16(d, 4);
        const fondo = leU16(d, 6), bordo = leU32(d, 8);
        c.xf.push({
          carattere: d[0], formato: d[1], orizzontale: all & 7, aCapo: (all & 8) !== 0, verticale: v === 4 ? (all >> 4) & 3 : 2, rotazione: v === 4 ? (all >> 6) & 3 : 0, rientro: 0,
          bordi: [[(bordo >>> 8) & 7, (bordo >>> 11) & 0x1f], [(bordo >>> 24) & 7, (bordo >>> 27) & 0x1f], [bordo & 7, (bordo >>> 3) & 0x1f], [(bordo >>> 16) & 7, (bordo >>> 19) & 0x1f]],
          // il riempimento vale solo se lo stile della cella lo indica (segno 0x40 degli attributi usati), come lo legge LibreOffice
          motivo: (v === 4 ? d[5] : d[3]) & 0x40 ? fondo & 0x3f : 0, primoPiano: (fondo >>> 6) & 0x1f,
        });
        break;
      }
      case 0x0092: {
        const n = leU16(d, 0);
        for (let i = 0; i < n && 8 + i < 64 && 2 + i * 4 + 3 <= d.length; i++) {
          const p = 2 + i * 4;
          c.tavolozza[8 + i] = `#${[d[p], d[p + 1], d[p + 2]].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
        }
        break;
      }
      case 0x0018: {
        if (v < 5) break; // i nomi di Excel 4.0 e prima non si leggono
        const x = tutto(r);
        const ind = leU16(x, 0); const lunghezza = x[3]; const cce = leU16(x, 4); const foglio = leU16(x, 8);
        let nome = '';
        let dopo: number;
        if (v >= 8) {
          const q = new Lettore([x]); q.salta(14);
          const alti = (q.u8() & 1) !== 0;
          try { nome = q.caratteri(lunghezza, alti); } catch { nome = ''; }
          dopo = 15 + lunghezza * (alti ? 2 : 1);
        } else {
          // Excel 5/95: dopo il nome vengono i testi del menu, della descrizione, dell'aiuto e della barra di stato, che si saltano
          nome = c.decodifica(x.subarray(14, 14 + lunghezza));
          dopo = 14 + lunghezza;
        }
        const incorporato = (ind & 0x20) !== 0 ? nome.charCodeAt(0) : null;
        if (incorporato !== null) nome = INCORPORATI[incorporato] ?? nome;
        c.nomi.push({ nome, nascosto: (ind & 1) !== 0, funzione: (ind & 0x0a) !== 0, incorporato, foglio, rgce: x.subarray(dopo, dopo + cce), rgcb: x.subarray(dopo + cce) });
        break;
      }
      case 0x01ae: {
        const n = leU16(d, 2);
        c.libri.push({ tipo: n === 0x0401 ? 'questo' : n === 0x3a01 ? 'aggiunte' : 'esterno', nomi: [] });
        break;
      }
      case 0x0023: {
        const libro = c.libri[c.libri.length - 1];
        if (!libro) break;
        const x = new Lettore([tutto(r)], c.decodifica); x.salta(6);
        try { libro.nomi.push(v >= 8 ? x.testo8() : x.vecchio8()); } catch { libro.nomi.push(''); }
        break;
      }
      case 0x0017: {
        if (v === 5) {
          // Excel 5/95: un record per ogni rimando; il primo carattere dice se è una funzione aggiuntiva («:») o un foglio di questo file
          const tipo = d[1];
          c.libri.push({ tipo: tipo === 0x3a ? 'aggiunte' : tipo === 0x02 || tipo === 0x03 || tipo === 0x04 || d[0] === 0 ? 'questo' : 'esterno', nomi: [] });
          break;
        }
        const x = tutto(r); const n = leU16(x, 0);
        for (let i = 0; i < n; i++) {
          const p = 2 + i * 6;
          if (p + 6 > x.length) break;
          const a = leU16(x, p + 2), b = leU16(x, p + 4);
          c.rimandi.push({ libro: leU16(x, p), primo: a >= 0x8000 ? a - 0x10000 : a, ultimo: b >= 0x8000 ? b - 0x10000 : b });
        }
        break;
      }
      case 0x00b0: c.tabellePivot = true; break;
    }
    } catch (e) {
      if (e instanceof FileProtetto || e instanceof ErroreChiaro) throw e;
    }
  }
  return c;
}

// ---- stili ----

const LINEA: Record<number, BorderDef['style']> = { 1: 'thin', 2: 'medium', 3: 'dashed', 4: 'dashed', 5: 'medium', 6: 'thin', 7: 'dashed', 8: 'dashed', 9: 'dashed', 10: 'dashed', 11: 'dashed', 12: 'dashed', 13: 'dashed' };
/** Formati data integrati che non sono nella tabella dei formati comuni (come nei .xlsb). */
const ID_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

class Stili {
  private readonly cache = new Map<number, { stile: CellStyle; data: boolean }>();
  rientroORotazione = false;
  constructor(private readonly c: Cartella) {}
  /** Vero se la cella è «centrata sulle colonne» (il testo si centra sulle celle vuote accanto). */
  centraSulleColonne(indice: number): boolean { return this.c.xf[indice]?.orizzontale === 6; }
  colore(i: number): string | undefined {
    // fino a Excel 4.0 i colori sono 24 (8 fissi e 16 della tavolozza), dopo sono 64; gli altri sono di sistema o «automatico»
    if (i < (this.c.versione <= 4 ? 24 : 64)) return this.c.tavolozza[i];
    return undefined;
  }
  di(indice: number): { stile: CellStyle; data: boolean } {
    const giaFatto = this.cache.get(indice);
    if (giaFatto) return giaFatto;
    const x = this.c.xf[indice];
    const s: CellStyle = {};
    let data = false;
    if (x) {
      const base = this.c.caratteri[0];
      const f = this.c.caratteri[x.carattere >= 4 ? x.carattere - 1 : x.carattere];
      if (f) {
        if (f.grassetto) s.bold = true;
        if (f.corsivo) s.italic = true;
        if (f.sottolineato) s.underline = true;
        if (f.barrato) s.strike = true;
        if (base && f.nome !== '' && f.nome !== base.nome) s.fontFamily = f.nome;
        if (base && f.punti > 0 && f.punti !== base.punti) s.fontSize = f.punti;
        const col = this.colore(f.colore);
        if (col && col !== '#000000') s.color = col;
      }
      if (x.motivo === 1) { const col = this.colore(x.primoPiano); if (col) s.fill = col; }
      const lati: BorderSet = {};
      (['left', 'right', 'top', 'bottom'] as const).forEach((lato, k) => {
        const [stile, colore] = x.bordi[k];
        const tipo = LINEA[stile];
        if (tipo) lati[lato] = { style: tipo, color: this.colore(colore) ?? '#000000' };
      });
      if (Object.keys(lati).length > 0) s.borders = lati;
      if (x.orizzontale === 1) s.hAlign = 'left';
      else if (x.orizzontale === 2 || x.orizzontale === 6) s.hAlign = 'center';
      else if (x.orizzontale === 3) s.hAlign = 'right';
      if (x.verticale === 0) s.vAlign = 'top';
      else if (x.verticale === 1) s.vAlign = 'middle';
      if (x.aCapo) s.wrap = true;
      if (x.rientro > 0 || x.rotazione !== 0) this.rientroORotazione = true;
      const codice = this.c.formati.get(x.formato) ?? FORMATI_INTEGRATI[x.formato];
      data = codice !== undefined ? eFormatoData(codice) : ID_DATA.has(x.formato);
      if (codice !== undefined && codice !== '' && codice.toLowerCase() !== 'general') s.numFmt = codiceFormatoFogli(codice);
      else if (data) s.numFmt = 'dd/mm/yyyy';
    }
    const voce = { stile: s, data };
    this.cache.set(indice, voce);
    return voce;
  }
}

const vuoto = (s: CellStyle): boolean => Object.keys(s).length === 0;
const copia = (s: CellStyle): CellStyle => (s.borders ? (JSON.parse(JSON.stringify(s)) as CellStyle) : { ...s });

// ---- i fogli ----

interface Contatori { formuleComeValori: number; disegni: boolean; condizionali: number; convalide: number; collegamentiScartati: number; filtriNonImportati: boolean }

interface Attesa { r: number; c: number; xf: number; ancora: string; valore: Valore }
type Valore = { tipo: 'num'; n: number } | { tipo: 'testo'; s: string } | { tipo: 'bool'; b: boolean } | { tipo: 'err'; e: string } | { tipo: 'vuoto' };

/** Il valore memorizzato di una formula: 8 byte che sono un numero oppure, se finiscono con FFFF, un tipo e un dato. */
function valoreFormula(d: Uint8Array): Valore {
  if (leU16(d, 12) === 0xffff) {
    switch (d[6]) {
      case 0: return { tipo: 'testo', s: '' }; // il testo è nel record STRING che segue
      case 1: return { tipo: 'bool', b: d[8] !== 0 };
      case 2: return { tipo: 'err', e: erroreXls(d[8]) };
      default: return { tipo: 'vuoto' };
    }
  }
  return { tipo: 'num', n: leF64(d, 6) };
}

function numeroRk(rk: number): number {
  let n: number;
  if (rk & 2) n = rk >> 2;
  else { const dv = new DataView(new ArrayBuffer(8)); dv.setUint32(4, (rk & 0xfffffffc) >>> 0, true); n = dv.getFloat64(0, true); }
  return rk & 1 ? n / 100 : n;
}

/** Legge l'oggetto collegamento ipertestuale (HLINK): l'indirizzo web o di posta; i collegamenti dentro il file o a file del disco non si importano. */
function indirizzoCollegamento(x: Uint8Array): string | null {
  const l = new Lettore([x]);
  l.salta(8 + 16 + 4);
  const ind = l.u32();
  const testoLungo = (): string => { const n = l.u32(); const s = l.caratteri(n, true); return s.replace(/\0+$/, ''); };
  if (ind & 0x10) testoLungo();
  if (ind & 0x80) testoLungo();
  let url: string | null = null;
  if (ind & 0x01) {
    if (ind & 0x100) url = testoLungo();
    else {
      const clsid: number[] = [];
      for (let i = 0; i < 16; i++) clsid.push(l.u8());
      const chiave = clsid.map((b) => b.toString(16).padStart(2, '0')).join('');
      if (chiave === 'e0c9ea79f9bace118c8200aa004ba90b') {
        const n = l.u32();
        url = l.caratteri(Math.floor(n / 2), true).replace(/\0.*$/s, '');
      } else return null; // file del disco o altro: non si importa
    }
  }
  if (ind & 0x08) return null; // punta dentro un foglio: non si importa
  return url;
}

/** Un foglio di lavoro; `filtro` dice se il foglio ha un filtro automatico (la sua tabella è nel nome _FilterDatabase della cartella). */
function leggiFoglio(w: Uint8Array, voce: VoceFoglio, nomeFoglio: string, c: Cartella, stili: Stili, formule: CartellaFormule, n: Contatori): { foglio: FoglioScambio; filtro: boolean } {
  const f = nuovoFoglio(nomeFoglio);
  const pagina = paginaPredefinita();
  let paginaToccata = false;
  let adatta = false;
  let bloccato = false;
  let riquadro: { x: number; y: number } | null = null;
  const condivise = new Map<string, { rgce: Uint8Array; rgcb: Uint8Array }>();
  const matrici = new Map<string, { rgce: Uint8Array; rgcb: Uint8Array }>();
  let ultimaFormula: string | null = null;
  const inAttesa: Attesa[] = [];
  let stringaPer: { r: number; c: number; xf: number; attesa?: Attesa } | null = null;
  const testiNote = new Map<number, string>();
  let ultimaNota: number | null = null;
  const note: Array<{ r: number; c: number; id: number; autore: string }> = [];
  const colonne: Array<{ da: number; a: number; larghezza: number; xf: number; nascosta: boolean }> = [];
  let filtroAutomatico = false;
  let profondita = 0;

  const dentro = (r: number, col: number): boolean => r < MAX_ROWS && col < MAX_COLS;
  // celle «centrate sulle colonne»: riga -> colonna -> la cella ha un contenuto
  const centrate = new Map<number, Map<number, boolean>>();
  const segnaCentrata = (r: number, col: number, xf: number, piena: boolean): void => {
    if (!stili.centraSulleColonne(xf)) return;
    const riga = centrate.get(r) ?? new Map<number, boolean>();
    riga.set(col, piena || riga.get(col) === true);
    centrate.set(r, riga);
  };
  const metti = (r: number, col: number, xf: number, v: Valore): void => {
    if (!dentro(r, col)) return;
    const { stile, data } = stili.di(xf);
    switch (v.tipo) {
      case 'num': {
        if (!Number.isFinite(v.n)) break;
        mettiCella(f, r + 1, col + 1, String(c.calendario1904 && data ? v.n + 1462 : v.n));
        break;
      }
      case 'testo': mettiCella(f, r + 1, col + 1, v.s, true); break;
      case 'bool': mettiCella(f, r + 1, col + 1, v.b ? 'TRUE' : 'FALSE'); break;
      case 'err': mettiCella(f, r + 1, col + 1, v.e, true); break;
      case 'vuoto': break;
    }
    if (!vuoto(stile)) f.stili[indirizzoCella(r + 1, col + 1)] = copia(stile);
    segnaCentrata(r, col, xf, v.tipo !== 'vuoto' && !(v.tipo === 'testo' && v.s === ''));
  };
  // Excel 2.x: ogni cella porta i suoi attributi (carattere, formato, allineamento, bordi) in 3 byte invece di un numero di stile;
  // per ogni combinazione si crea uno stile come quelli delle versioni dopo
  const stiliExcel2 = new Map<number, number>();
  const xfExcel2 = (b: Uint8Array, p: number): number => {
    const chiave = (b[p] << 16) | (b[p + 1] << 8) | b[p + 2];
    const giaFatto = stiliExcel2.get(chiave);
    if (giaFatto !== undefined) return giaFatto;
    const a1 = b[p + 1], a2 = b[p + 2];
    const lato = (bit: number): [number, number] => (a2 & bit ? [1, 8] : [0, 0]);
    c.xf.push({ carattere: (a1 >> 6) & 3, formato: a1 & 0x3f, orizzontale: a2 & 7, verticale: 2, aCapo: false, rientro: 0, rotazione: 0, bordi: [lato(0x08), lato(0x10), lato(0x20), lato(0x40)], motivo: a2 & 0x80 ? 1 : 0, primoPiano: 22 });
    stiliExcel2.set(chiave, c.xf.length - 1);
    return c.xf.length - 1;
  };
  const formula = (r: number, col: number, xf: number, esito: EsitoFormula, v: Valore): void => {
    if ('testo' in esito) {
      if (!dentro(r, col)) return;
      f.celle[indirizzoCella(r + 1, col + 1)] = `=${esito.testo}`;
      const { stile } = stili.di(xf);
      if (!vuoto(stile)) f.stili[indirizzoCella(r + 1, col + 1)] = copia(stile);
      segnaCentrata(r, col, xf, true);
    } else {
      n.formuleComeValori++;
      metti(r, col, xf, v);
      if (v.tipo === 'testo') stringaPer = { r, c: col, xf };
    }
  };

  for (const r of records(w, voce.posizione)) {
    const d = r.dati;
    if (BOF.has(r.tipo)) { profondita++; if (profondita > 1) n.disegni = true; continue; }
    if (r.tipo === 0x000a) { profondita--; if (profondita <= 0) break; continue; }
    if (profondita !== 1) continue;
    if (r.tipo !== 0x0207) stringaPer = null;
    // un record rovinato si salta: le altre celle del foglio si leggono lo stesso
    try {
    switch (r.tipo) {
      case 0x0203: metti(leU16(d, 0), leU16(d, 2), leU16(d, 4), { tipo: 'num', n: leF64(d, 6) }); break;
      case 0x027e: metti(leU16(d, 0), leU16(d, 2), leU16(d, 4), { tipo: 'num', n: numeroRk(leU32(d, 6)) }); break;
      case 0x00bd: {
        const riga = leU16(d, 0); const primaCol = leU16(d, 2);
        const quante = Math.floor((d.length - 6) / 6);
        for (let k = 0; k < quante; k++) metti(riga, primaCol + k, leU16(d, 4 + k * 6), { tipo: 'num', n: numeroRk(leU32(d, 6 + k * 6)) });
        break;
      }
      case 0x00fd: metti(leU16(d, 0), leU16(d, 2), leU16(d, 4), { tipo: 'testo', s: c.testi[leU32(d, 6)] ?? '' }); break;
      case 0x0204: case 0x00d6: {
        const l = lettore(r, c.decodifica); const riga = l.u16(), col = l.u16(), xf = l.u16();
        let s = '';
        try { s = c.versione >= 8 ? l.testo16() : l.vecchio16(); } catch { s = ''; }
        metti(riga, col, xf, { tipo: 'testo', s });
        break;
      }
      case 0x0205: metti(leU16(d, 0), leU16(d, 2), leU16(d, 4), d[7] ? { tipo: 'err', e: erroreXls(d[6]) } : { tipo: 'bool', b: d[6] !== 0 }); break;
      case 0x0201: metti(leU16(d, 0), leU16(d, 2), leU16(d, 4), { tipo: 'vuoto' }); break;
      case 0x00be: {
        const riga = leU16(d, 0); const primaCol = leU16(d, 2);
        const quante = Math.floor((d.length - 6) / 2);
        for (let k = 0; k < quante; k++) metti(riga, primaCol + k, leU16(d, 4 + k * 2), { tipo: 'vuoto' });
        break;
      }
      // la formula: in Excel 5, 95 e 97 il record 0x0006 con 4 byte in più; in Excel 3.0 e 4.0 i record 0x0206 e 0x0406; in Excel 2.x il
      // record 0x0006 con gli attributi della cella e le lunghezze da un byte
      case 0x0006: case 0x0206: case 0x0406: {
        const x = tutto(r);
        const vecchia = c.versione === 2;
        if ((r.tipo === 0x0006) !== (c.versione >= 5 || vecchia)) break;
        const riga = leU16(x, 0), col = leU16(x, 2);
        const xf = vecchia ? xfExcel2(x, 4) : leU16(x, 4);
        const v = valoreFormula(vecchia ? x.subarray(1) : x);
        const inizio = vecchia ? 17 : c.versione >= 5 ? 22 : 18;
        const cce = vecchia ? x[16] : leU16(x, inizio - 2);
        const rgce = x.subarray(inizio, inizio + cce), rgcb = x.subarray(inizio + cce);
        ultimaFormula = `${riga}:${col}`;
        if (rgce[0] === 0x01 && (cce === 5 || (c.versione < 5 && cce === 4))) {
          const attesa: Attesa = { r: riga, c: col, xf, ancora: `${leU16(rgce, 1)}:${cce === 5 ? leU16(rgce, 3) : rgce[3]}`, valore: v };
          inAttesa.push(attesa);
          if (v.tipo === 'testo') stringaPer = { r: riga, c: col, xf, attesa };
          break;
        }
        formula(riga, col, xf, testoFormula(rgce, rgcb, { riga, colonna: col, condivisa: false }, formule), v);
        break;
      }
      // Excel 2.x: celle con gli attributi in 3 byte
      case 0x0001: if (c.versione === 2) metti(leU16(d, 0), leU16(d, 2), xfExcel2(d, 4), { tipo: 'vuoto' }); break;
      case 0x0002: if (c.versione === 2) metti(leU16(d, 0), leU16(d, 2), xfExcel2(d, 4), { tipo: 'num', n: leU16(d, 7) }); break;
      case 0x0003: if (c.versione === 2) metti(leU16(d, 0), leU16(d, 2), xfExcel2(d, 4), { tipo: 'num', n: leF64(d, 7) }); break;
      case 0x0004: if (c.versione === 2) metti(leU16(d, 0), leU16(d, 2), xfExcel2(d, 4), { tipo: 'testo', s: c.decodifica(d.subarray(8, 8 + d[7])) }); break;
      case 0x0005: if (c.versione === 2) metti(leU16(d, 0), leU16(d, 2), xfExcel2(d, 4), d[8] ? { tipo: 'err', e: erroreXls(d[7]) } : { tipo: 'bool', b: d[7] !== 0 }); break;
      case 0x0008: {
        // riga di Excel 2.x: l'altezza ha il bit alto acceso quando è quella normale
        if (c.versione !== 2) break;
        const altezza = leU16(d, 6);
        if (!(altezza & 0x8000) && altezza > 0 && leU16(d, 0) < MAX_ROWS) f.altezze[leU16(d, 0) + 1] = Math.round((altezza & 0x7fff) / 20 / 0.75);
        break;
      }
      case 0x0024: if (c.versione === 2) colonne.push({ da: d[0], a: d[1], larghezza: leU16(d, 2), xf: 15, nascosta: false }); break;
      case 0x0007: case 0x0207: {
        if (!stringaPer || (r.tipo === 0x0007) !== (c.versione === 2)) break;
        let s = '';
        try { const l = lettore(r, c.decodifica); s = c.versione >= 8 ? l.testo16() : c.versione === 2 ? l.vecchio8() : l.vecchio16(); } catch { s = ''; }
        if (stringaPer.attesa) stringaPer.attesa.valore = { tipo: 'testo', s };
        else metti(stringaPer.r, stringaPer.c, stringaPer.xf, { tipo: 'testo', s });
        stringaPer = null;
        break;
      }
      // la formula condivisa e la formula matrice seguono la cella in cui compaiono la prima volta: le altre celle rimandano a quella cella
      // (che di solito, ma non sempre, è l'angolo in alto a sinistra dell'area)
      case 0x04bc: {
        const x = tutto(r); const cce = leU16(x, 8);
        const voce = { rgce: x.subarray(10, 10 + cce), rgcb: x.subarray(10 + cce) };
        condivise.set(`${leU16(x, 0)}:${x[4]}`, voce);
        if (ultimaFormula) condivise.set(ultimaFormula, voce);
        break;
      }
      case 0x0221: {
        // dopo l'area e le opzioni, da Excel 5 ci sono 4 byte liberi prima della lunghezza
        const x = tutto(r); const inizio = c.versione >= 5 ? 14 : 10; const cce = leU16(x, inizio - 2);
        const voce = { rgce: x.subarray(inizio, inizio + cce), rgcb: x.subarray(inizio + cce) };
        matrici.set(`${leU16(x, 0)}:${x[4]}`, voce);
        if (ultimaFormula) matrici.set(ultimaFormula, voce);
        break;
      }
      case 0x0208: {
        const riga = leU16(d, 0);
        if (riga >= MAX_ROWS) break;
        const altezza = leU16(d, 6) & 0x7fff;
        const ind = leU16(d, 12);
        if (ind & 0x20) (f.righeNascoste ??= []).push(riga + 1);
        else if (ind & 0x40 && altezza > 0) f.altezze[riga + 1] = Math.round(altezza / 20 / 0.75);
        if (ind & 0x80) { const { stile } = stili.di(leU16(d, 14) & 0x0fff); if (!vuoto(stile)) f.stiliRiga[riga + 1] = copia(stile); }
        break;
      }
      case 0x007d: colonne.push({ da: leU16(d, 0), a: leU16(d, 2), larghezza: leU16(d, 4), xf: leU16(d, 6), nascosta: (leU16(d, 8) & 1) !== 0 }); break;
      case 0x00e5: {
        const quante = leU16(d, 0);
        for (let k = 0; k < quante; k++) {
          const p = 2 + k * 8;
          if (p + 8 > d.length) break;
          const startRow = leU16(d, p) + 1, endRow = leU16(d, p + 2) + 1, startCol = leU16(d, p + 4) + 1, endCol = leU16(d, p + 6) + 1;
          if (startRow <= endRow && startCol <= endCol && endRow <= MAX_ROWS && endCol <= MAX_COLS && (endRow > startRow || endCol > startCol)) f.unioni.push({ startRow, endRow, startCol, endCol });
        }
        break;
      }
      case 0x023e: bloccato = (leU16(d, 0) & 0x08) !== 0; break;
      case 0x0041: riquadro = { x: leU16(d, 0), y: leU16(d, 2) }; break;
      case 0x0862: {
        const lunghezza = leU32(d, 12);
        let colore: string | undefined;
        if (lunghezza >= 0x28 && d.length >= 32 && leU32(d, 24) === 2) colore = `#${[d[28], d[29], d[30]].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
        else { const i = leU32(d, 16) & 0x7f; if (i !== 0x7f) colore = stili.colore(i); }
        if (colore) f.colore = colore;
        break;
      }
      case 0x01b8: {
        const x = tutto(r);
        const r1 = leU16(x, 0), r2 = leU16(x, 2), c1 = leU16(x, 4), c2 = leU16(x, 6);
        let url: string | null = null;
        try { url = indirizzoCollegamento(x); } catch { url = null; }
        if (!url || !urlAmmesso(url) || r2 < r1 || c2 < c1 || (r2 - r1 + 1) * (c2 - c1 + 1) > 1000) { n.collegamentiScartati++; break; }
        for (let rr = r1; rr <= r2; rr++) for (let cc = c1; cc <= c2; cc++) {
          if (!dentro(rr, cc)) continue;
          const a = indirizzoCella(rr + 1, cc + 1);
          f.stili[a] = { ...f.stili[a], link: url };
        }
        break;
      }
      case 0x005d: {
        // il primo pezzo dell'oggetto dice il suo tipo: 0x19 è la casella di un commento, il resto (immagini, grafici, pulsanti) non si importa
        if (leU16(d, 0) === 0x15) {
          const tipo = leU16(d, 4);
          if (tipo === 0x19) ultimaNota = leU16(d, 6);
          else { ultimaNota = null; if (tipo !== 0x14 && tipo !== 0x00) n.disegni = true; }
        }
        break;
      }
      case 0x01b6: {
        if (ultimaNota === null) break;
        const quanti = leU16(d, 10);
        const l = lettore(r);
        l.fineSegmento();
        try { testiNote.set(ultimaNota, quanti > 0 ? l.caratteri(quanti, false) : ''); } catch { /* testo rovinato: il commento resta vuoto */ }
        ultimaNota = null;
        break;
      }
      case 0x001c: {
        if (c.versione < 8) {
          // fino a Excel 95 il testo del commento è nel record stesso; un testo lungo continua nei record con la riga 0xFFFF
          const riga = leU16(d, 0), col = leU16(d, 2), lunghezza = Math.min(leU16(d, 4), d.length - 6);
          const testo = c.decodifica(d.subarray(6, 6 + Math.max(0, lunghezza))).replace(/\r\n?/g, '\n');
          if (riga === 0xffff) { const ultima = note[note.length - 1]; if (ultima) testiNote.set(ultima.id, (testiNote.get(ultima.id) ?? '') + testo); }
          else { const id = -1 - note.length; note.push({ r: riga, c: col, id, autore: '' }); testiNote.set(id, testo); }
          break;
        }
        const l = lettore(r);
        const riga = l.u16(), col = l.u16(); l.u16(); const id = l.u16();
        let autore = '';
        try { autore = l.testo16(); } catch { autore = ''; }
        note.push({ r: riga, c: col, id, autore });
        break;
      }
      // impostazione della pagina
      case 0x00a1: {
        const ind = leU16(d, 10);
        if (!(ind & 0x04)) {
          const carta = CARTA_DA_CODICE[leU16(d, 0)];
          if (carta) pagina.formato = carta;
          if (!(ind & 0x40)) pagina.orientamento = ind & 0x02 ? 'verticale' : 'orizzontale';
          pagina.scala = leU16(d, 2) || 100;
          pagina.adatta = { larghezza: leU16(d, 6), altezza: leU16(d, 8) };
        }
        if (ind & 0x01) pagina.ordine = 'destra';
        paginaToccata = true;
        break;
      }
      case 0x0081: adatta = (leU16(d, 0) & 0x0100) !== 0; break;
      case 0x0026: pagina.margini.sinistro = mm(leF64(d, 0)); paginaToccata = true; break;
      case 0x0027: pagina.margini.destro = mm(leF64(d, 0)); paginaToccata = true; break;
      case 0x0028: pagina.margini.alto = mm(leF64(d, 0)); paginaToccata = true; break;
      case 0x0029: pagina.margini.basso = mm(leF64(d, 0)); paginaToccata = true; break;
      case 0x0014: case 0x0015: {
        if (d.length === 0) break;
        let s = '';
        try { s = c.versione >= 8 ? lettore(r).testo16() : lettore(r, c.decodifica).vecchio8(); } catch { s = ''; }
        if (r.tipo === 0x0014) pagina.intestazione = leggiMargineExcel(s); else pagina.pie = leggiMargineExcel(s);
        paginaToccata = true;
        break;
      }
      case 0x0083: pagina.centraOrizzontale = leU16(d, 0) === 1; paginaToccata = true; break;
      case 0x0084: pagina.centraVerticale = leU16(d, 0) === 1; paginaToccata = true; break;
      case 0x002b: pagina.griglia = leU16(d, 0) === 1; paginaToccata = true; break;
      case 0x002a: pagina.intestazioniRigheColonne = leU16(d, 0) === 1; paginaToccata = true; break;
      case 0x001b: case 0x001a: {
        const quante = leU16(d, 0);
        const elenco: number[] = [];
        // in Excel 97 ogni interruzione ha anche l'intervallo (6 byte), prima solo la riga o la colonna (2 byte)
        const passo = c.versione >= 8 ? 6 : 2;
        for (let k = 0; k < quante && 2 + k * passo + 2 <= d.length; k++) { const x = leU16(d, 2 + k * passo) + 1; if (x >= 2) elenco.push(x); }
        if (r.tipo === 0x001b) pagina.interruzioniRighe = elenco; else pagina.interruzioniColonne = elenco;
        paginaToccata = true;
        break;
      }
      case 0x009d: filtroAutomatico = true; break;
      case 0x009e: n.filtriNonImportati = true; break;
      case 0x01b0: case 0x087a: n.condizionali++; break;
      case 0x01be: n.convalide++; break;
      case 0x00e9: n.disegni = true; break; // immagine di sfondo del foglio
    }
    } catch {
      // record rovinato: si va avanti
    }
  }

  // le celle che usano una formula condivisa o una formula matrice: si risolvono ora che si conoscono tutte
  for (const a of inAttesa) {
    const sc = condivise.get(a.ancora);
    if (sc) { formula(a.r, a.c, a.xf, testoFormula(sc.rgce, sc.rgcb, { riga: a.r, colonna: a.c, condivisa: true }, formule), a.valore); continue; }
    const m = matrici.get(a.ancora);
    if (m) {
      // la formula matrice sta nella prima cella e si allarga da sola sulle altre, che restano vuote
      if (`${a.r}:${a.c}` === a.ancora) formula(a.r, a.c, a.xf, testoFormula(m.rgce, m.rgcb, { riga: a.r, colonna: a.c, condivisa: false }, formule), a.valore);
      else { const { stile } = stili.di(a.xf); if (!vuoto(stile) && dentro(a.r, a.c)) f.stili[indirizzoCella(a.r + 1, a.c + 1)] = copia(stile); }
      continue;
    }
    n.formuleComeValori++;
    metti(a.r, a.c, a.xf, a.valore);
  }

  // colonne: le larghezze uguali a quella delle colonne «normali» (l'ultimo gruppo, che arriva in fondo) non si scrivono
  // la larghezza «normale» è quella che copre più colonne (almeno 50): quelle colonne non si scrivono, come fa LibreOffice
  const copertura = new Map<number, number>();
  for (const x of colonne) if (!x.nascosta && x.a >= x.da) copertura.set(x.larghezza, (copertura.get(x.larghezza) ?? 0) + Math.min(x.a, 255) - x.da + 1);
  const [normale] = [...copertura].filter(([, n]) => n >= 50).sort((a, b) => b[1] - a[1])[0] ?? [undefined];
  // la larghezza si misura in caratteri: 7 pixel per carattere; fino a Excel 4.0 il carattere è quello del testo normale, in proporzione
  // alla sua dimensione (7 pixel con 10 punti)
  const pixelCarattere = c.versione <= 4 ? 7 * Math.max(0.5, Math.min(3, (c.caratteri[0]?.punti || 10) / 10)) : 7;
  for (const x of colonne) {
    const da = x.da + 1, a = Math.min(x.a + 1, MAX_COLS);
    if (a < da || a - da >= 1000) continue;
    const { stile } = stili.di(x.xf);
    for (let k = da; k <= a; k++) {
      if (x.nascosta) (f.colonneNascoste ??= []).push(k);
      else if (x.larghezza > 0 && x.larghezza !== normale) f.larghezze[k] = Math.round((x.larghezza / 256) * pixelCarattere + 5);
      if (!vuoto(stile)) f.stiliColonna[k] = copia(stile);
    }
  }

  // «centra sulle colonne»: una cella piena seguita da celle vuote centrate allo stesso modo diventa un'unione, così il testo resta centrato
  for (const [r, colonneRiga] of centrate) {
    const ordinate = [...colonneRiga.keys()].sort((a, b) => a - b);
    for (let i = 0; i < ordinate.length; i++) {
      if (!colonneRiga.get(ordinate[i])) continue;
      let fine = i;
      while (fine + 1 < ordinate.length && ordinate[fine + 1] === ordinate[fine] + 1 && !colonneRiga.get(ordinate[fine + 1])) fine++;
      const u = { startRow: r + 1, endRow: r + 1, startCol: ordinate[i] + 1, endCol: ordinate[fine] + 1 };
      const sovrapposta = f.unioni.some((m) => m.startRow <= u.endRow && m.endRow >= u.startRow && m.startCol <= u.endCol && m.endCol >= u.startCol);
      if (fine > i && !sovrapposta) f.unioni.push(u);
      i = fine;
    }
  }

  if (bloccato && riquadro) {
    if (riquadro.x > 0 && riquadro.x <= MAX_COLS) f.colonneCongelate = riquadro.x;
    if (riquadro.y > 0 && riquadro.y <= MAX_ROWS) f.righeCongelate = riquadro.y;
  }

  const commenti = note.filter((x) => x.r < MAX_ROWS && x.c < MAX_COLS && (testiNote.get(x.id) ?? '').trim() !== '')
    .map((x) => ({ riga: x.r + 1, colonna: x.c + 1, testo: testiNote.get(x.id) as string, ...(x.autore ? { autore: x.autore } : {}) }));
  if (commenti.length > 0) f.commenti = commenti;

  if (paginaToccata || adatta) {
    if (!adatta) pagina.adatta = null;
    else if (!pagina.adatta) pagina.adatta = { larghezza: 1, altezza: 1 };
    const p = ripulisciPagina(pagina);
    if (!eDiPartenza(p)) f.pagina = p;
  }
  return { foglio: f, filtro: filtroAutomatico };
}

// ---- tutto il file ----

/** I record che restano in chiaro in un file cifrato (il loro posto nel flusso conta lo stesso per la chiave). */
const IN_CHIARO = new Set([0x0809, 0x002f, 0x0194, 0x0195, 0x00e1, 0x0196, 0x0138]);

/**
 * Se il flusso è cifrato con RC4 e la password è quella data o quella predefinita di Excel, dà il flusso decifrato; se non è cifrato dà null;
 * se è cifrato con un'altra password (o con il vecchio metodo XOR) dà l'errore «protetto».
 * In un .xls i dati dei record sono cifrati a blocchi di 1024 byte contati dall'inizio del flusso; le intestazioni dei record no.
 */
function decifraSePossibile(w: Uint8Array, password: string | undefined): Uint8Array | null {
  let filepass: Uint8Array | null = null;
  let k = 0;
  for (const r of records(w, 0)) { if (r.tipo === 0x002f) { filepass = r.dati; break; } if (++k > 40 || r.tipo === 0x0085) break; }
  if (!filepass) return null;
  if (leU16(filepass, 0) !== 1) throw new FileProtetto();
  const chiave = (password !== undefined ? chiaveRc4(filepass.subarray(2), password) : null) ?? chiaveRc4(filepass.subarray(2), PASSWORD_PREDEFINITA_EXCEL);
  if (!chiave) throw new FileProtetto(true);
  const flusso = flussoChiaveABlocchi(chiave, 1024);
  const out = w.slice();
  let p = 0;
  let dopo = false;
  while (p + 4 <= w.length) {
    const tipo = leU16(w, p), lun = leU16(w, p + 2);
    const inizio = p + 4, fine = Math.min(w.length, inizio + lun);
    if (dopo && !IN_CHIARO.has(tipo)) {
      // nel record dei fogli la posizione del foglio (i primi 4 byte) resta in chiaro
      for (let i = tipo === 0x0085 ? inizio + 4 : inizio; i < fine; i++) out[i] = w[i] ^ flusso(i);
    }
    if (tipo === 0x002f) dopo = true;
    p = fine;
  }
  return out;
}

/** Vero se i byte sono un foglio di Excel 2.x, 3.0 o 4.0: un file che comincia direttamente con il record BOF di quelle versioni. */
export function eFoglioExcelVecchio(b: Uint8Array): boolean {
  return b.length >= 8 && b[0] === 0x09 && (b[1] === 0x00 || b[1] === 0x02 || b[1] === 0x04) && b[3] === 0 && b[2] >= 4 && b[2] <= 20;
}

function leggi(bytes: Uint8Array, nomeFile: string, password: string | undefined): RisultatoXls {
  // il foglio unico di Excel 4.0 e prima prende il nome del file, come in Excel
  const nomeSoloFoglio = nomeFile.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').trim() || 'Foglio1';
  let w: Uint8Array | undefined;
  let archivio: ReturnType<typeof leggiCfb> | null = null;
  if (eFileComposto(bytes)) {
    archivio = leggiCfb(bytes);
    if (archivio.flusso('EncryptedPackage')) throw new FileProtetto();
    if (archivio.flusso('WordDocument')) throw new ErroreChiaro(t('È un documento di Word: si apre con pmb_docs.'));
    // «Workbook» da Excel 97, «Book» in Excel 5.0 e 95
    w = archivio.flusso('Workbook') ?? archivio.flusso('Book');
    if (!w) throw new Error(t('manca la cartella di lavoro'));
  } else if (eFoglioExcelVecchio(bytes)) w = bytes;
  else throw new Error(t('non è un file di Excel'));
  // un file protetto con la password «di sola lettura» di Excel si apre da solo, come in Excel; con un'altra password no
  const cifrato = decifraSePossibile(w, password);
  if (cifrato) w = cifrato;
  const c = leggiCartella(w, nomeSoloFoglio, cifrato !== null);
  const stili = new Stili(c);

  // i nomi dei fogli come saranno nel documento (puliti e senza doppioni): le formule li usano così
  const tutti = c.fogli.map((v) => nuovoFoglio(v.nome));
  nomiUniciFogli(tutti);
  const nomiFinali = tutti.map((x) => x.nome);

  const formule: CartellaFormule = {
    fogli: (ixti) => {
      const x = c.rimandi[ixti];
      if (!x || c.libri[x.libro]?.tipo !== 'questo' || x.primo < 0 || x.ultimo < 0) return null;
      const primo = nomiFinali[x.primo], ultimo = nomiFinali[x.ultimo];
      return primo !== undefined && ultimo !== undefined ? { primo, ultimo } : null;
    },
    nome: (k) => c.nomi[k - 1]?.nome,
    nomeEsterno: (ixti, k) => {
      // in Excel 97 l'indice porta alla tabella dei rimandi e da lì al libro; in Excel 5/95 ogni rimando è già un libro
      const x = c.rimandi[ixti];
      const libro = c.versione >= 8 ? (x ? c.libri[x.libro] : undefined) : c.libri[ixti];
      if (!libro) return undefined;
      if (libro.tipo === 'aggiunte') return libro.nomi[k - 1];
      if (libro.tipo === 'questo') return c.nomi[k - 1]?.nome;
      return undefined;
    },
    versione: c.versione,
    decodifica: c.decodifica,
    foglioIndice: (i) => nomiFinali[i],
  };

  const n: Contatori = { formuleComeValori: 0, disegni: false, condizionali: 0, convalide: 0, collegamentiScartati: 0, filtriNonImportati: false };
  const fogli: FoglioScambio[] = [];
  const indiceNelDocumento = new Map<number, FoglioScambio>();
  const conFiltro = new Set<FoglioScambio>();
  const nascosti: string[] = [];
  let nonDiLavoro = 0;
  c.fogli.forEach((v, i) => {
    if (v.tipo !== 0) { nonDiLavoro++; return; }
    const { foglio, filtro } = leggiFoglio(w, v, nomiFinali[i], c, stili, formule, n);
    if (filtro) conFiltro.add(foglio);
    if (v.stato !== 0) { foglio.nascosto = true; nascosti.push(foglio.nome); }
    fogli.push(foglio);
    indiceNelDocumento.set(i, foglio);
  });
  if (fogli.length === 0 && nonDiLavoro > 0) throw new ErroreChiaro(t('Il file contiene solo grafici o macro, che pmb_sheets non importa.'));
  if (fogli.length === 0) throw new Error(t('nessun foglio'));

  // nomi definiti, area di stampa, titoli di stampa e tabella del filtro automatico
  const nomi: NomeScambio[] = [];
  let nomiNonImportati = 0;
  const testoNome = (x: Nome): string | null => {
    const esito = testoFormula(x.rgce, x.rgcb, { riga: 0, colonna: 0, condivisa: false }, formule);
    return 'testo' in esito ? esito.testo : null;
  };
  for (const x of c.nomi) {
    if (x.incorporato !== null) {
      const foglio = indiceNelDocumento.get(x.foglio - 1);
      const testo = foglio ? testoNome(x) : null;
      if (!foglio || testo === null) continue;
      if (x.incorporato === 6 || x.incorporato === 7) {
        const voce: Pick<ImpostaPagina, 'area' | 'righeRipetute' | 'colonneRipetute'> = {};
        aggiungiNomeStampa(voce, x.incorporato === 6 ? 'area' : 'titoli', testo);
        const p = ripulisciPagina({ ...(foglio.pagina ?? paginaPredefinita()), ...voce });
        if (!eDiPartenza(p)) foglio.pagina = p;
      } else if (x.incorporato === 13 && conFiltro.has(foglio)) {
        const m = /^(?:'(?:[^']|'')+'|[^'!]+)!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(testo);
        if (m) {
          const col = (s: string): number => [...s].reduce((tot, ch) => tot * 26 + ch.charCodeAt(0) - 64, 0);
          foglio.filtro = { area: { startRow: Number(m[2]), endRow: Number(m[4]), startCol: col(m[1]), endCol: col(m[3]) }, colonne: [] };
        }
      }
      continue;
    }
    if (x.funzione || x.nascosto) continue;
    const testo = testoNome(x);
    const m = testo === null ? null : /^(?:'((?:[^']|'')+)'|([^'!:]+))!(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/.exec(testo);
    const foglio = m ? (m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]) : undefined;
    if (x.foglio !== 0 || !m || foglio === undefined || !fogli.some((fg) => fg.nome === foglio) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(x.nome)) { nomiNonImportati++; continue; }
    nomi.push({ nome: x.nome, foglio, riferimento: m[3].replace(/\$/g, '') });
  }

  const attivo = indiceNelDocumento.get(c.attivo)?.nome ?? fogli[0].nome;

  const avvisi: string[] = [t("È un file .xls di una vecchia versione di Excel: Salva lo salva in .xlsx con un nome nuovo e l'originale non cambia.")];
  if (n.formuleComeValori > 0) avvisi.push(n.formuleComeValori === 1
    ? t("Una formula del file usa qualcosa che pmb_sheets non sa leggere (per esempio un altro file): al suo posto c'è il valore calcolato.")
    : t("{} formule del file usano qualcosa che pmb_sheets non sa leggere (per esempio un altro file): al loro posto c'è il valore calcolato.", n.formuleComeValori));
  if (n.disegni || nonDiLavoro > 0) avvisi.push(t("Grafici e disegni del file non sono stati importati."));
  if (c.tabellePivot) avvisi.push(t("Le tabelle pivot del file non sono state importate."));
  if (n.condizionali > 0) avvisi.push(t("{} (tipo non supportato).", n.condizionali === 1 ? 'Una formattazione condizionale del file non è stata importata' : `${n.condizionali} formattazioni condizionali del file non sono state importate`));
  if (n.convalide > 0) avvisi.push(t("Le convalide dei dati del file non sono state importate."));
  if (nomiNonImportati > 0) avvisi.push(nomiNonImportati === 1
    ? t("Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).")
    : t("{} nomi definiti del file non sono stati importati (non è un intervallo semplice di un foglio).", nomiNonImportati));
  if (n.filtriNonImportati) avvisi.push(t("Alcuni criteri dei filtri automatici del file (condizioni, colori, date, primi 10) non sono stati importati: resta il filtro sulla tabella con i valori spuntati."));
  if (n.collegamentiScartati > 0) avvisi.push(t("Alcuni collegamenti ipertestuali del file non sono stati importati (quelli dentro il file o con un indirizzo non ammesso)."));
  if (stili.rientroORotazione) avvisi.push(t("Il rientro e la rotazione del testo non sono stati importati."));
  if (archivio?.esiste('_VBA_PROJECT_CUR')) avvisi.push(t("Le macro del file non vengono caricate."));
  // i fogli nascosti restano nascosti, come nei .xlsx (Nascondi e mostra foglio)
  void nascosti;
  return { scambio: nomi.length > 0 ? { fogli, foglioAttivo: attivo, nomi } : { fogli, foglioAttivo: attivo }, avvisi };
}

/** Dai byte di un file .xls al modello di scambio, con gli avvisi su ciò che non si importa. Un file non valido dà un errore chiaro. */
export function leggiXls(bytes: Uint8Array, nomeFile = '', password?: string): RisultatoXls {
  try {
    return leggi(bytes, nomeFile, password);
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    if (e instanceof ErroreChiaro) throw e;
    if (e instanceof FileProtetto && e.rc4) throw new PasswordRichiesta(password !== undefined && password !== '');
    if (e instanceof FileProtetto) throw new Error(t("Il file è protetto da password: pmb_sheets non apre ancora i file .xls cifrati. Togli la password in Excel o LibreOffice e aprilo di nuovo."));
    throw new Error(t('File .xls non valido: {}', messaggio));
  }
}
