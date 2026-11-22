// Lettura dei documenti .doc di Word 97-2003 (formato binario, specifica pubblica [MS-DOC] di Microsoft) nel documento di pmb_docs.
// Il file è un file composto (comune/src/formati/cfb.ts) con il flusso «WordDocument» (testo e proprietà), il flusso della tabella
// («0Table» o «1Table»: indici, stili, caratteri, elenchi) e il flusso «Data» (immagini).
// Come si legge:
//   - il testo sta a pezzi (tabella dei pezzi, Clx): ogni pezzo dice dove sono i suoi caratteri, da 1 o da 2 byte;
//   - le proprietà dei caratteri e dei paragrafi stanno in pagine da 512 byte (FKP) con elenchi di comandi (sprm), sopra quelle degli stili;
//   - caratteri speciali: 0x0D fine paragrafo, 0x07 fine cella, 0x0B a capo, 0x0C interruzione di pagina o di sezione, 0x13/0x14/0x15 i campi.
// Si importano gli stessi elementi del .docx (vedi docx.ts): testo, grassetto, corsivo, sottolineato, barrato, apice e pedice, carattere,
// corpo, colori, evidenziazione, allineamento, rientri, spazi prima e dopo, interlinea, elenchi, stili (Titolo, Sottotitolo, Titolo 1-3),
// salti di pagina, tabelle, link, note (in fondo al documento), immagini in linea png e jpeg, intestazione e piè di pagina con i numeri
// di pagina, segnalibri. Il testo nascosto e quello cancellato dalle revisioni non entra; quello inserito sì.
// Puro: riceve i byte. Scritto per pmb_office a partire dalla specifica, senza codice di altri programmi.
import { PasswordRichiesta } from '@comune/protezione/password-file';
import { eFileComposto, leggiCfb } from '@comune/formati/cfb';
import { chiaveRc4, flussoChiaveABlocchi } from '@comune/formati/cifratura-office';
import {
  normalizza, urlValido, dimensioniIniziali, immagineValida, nomeSegnalibroValido, spazioValido, bordoValido, impostaIntestazione, impostaPiede,
  OGGETTO, CARATTERE_NORMALE, CORPO_NORMALE, CAMPO_PAGINA, CAMPO_PAGINE, RIGHE_MARGINE_MASSIME,
  type Allineamento, type AttributiParagrafo, type Documento, type Immagine, type Paragrafo, type Run, type StileParagrafo, type TipoElenco,
} from '../modello/documento';
import { t } from '../i18n/lingua';

export interface RisultatoDoc { doc: Documento; avvisi: string[] }

/** Il file è cifrato con una password che non si conosce: con RC4 una password giusta lo apre, con il vecchio metodo XOR no. */
class DocProtetto extends Error { constructor(public readonly rc4 = false) { super('protetto'); } }
/** Un errore che si mostra così com'è. */
class ErroreChiaro extends Error {}

const u16 = (b: Uint8Array, p: number): number => (p + 1 < b.length ? b[p] | (b[p + 1] << 8) : 0);
const i16 = (b: Uint8Array, p: number): number => { const v = u16(b, p); return v >= 0x8000 ? v - 0x10000 : v; };
const u32 = (b: Uint8Array, p: number): number => (p + 3 < b.length ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : 0);
const i32 = (b: Uint8Array, p: number): number => u32(b, p) | 0;
const WINDOWS_1252 = new TextDecoder('windows-1252');
/** I 256 caratteri da un byte (testo «compresso» dei .doc: la codifica di Windows dell'Europa occidentale). */
const DA_UN_BYTE = Array.from({ length: 256 }, (_, i) => WINDOWS_1252.decode(Uint8Array.of(i)));
const UTF16 = new TextDecoder('utf-16le');

// ---- comandi di formato (sprm) ----

interface Sprm { codice: number; operando: Uint8Array }

/** I comandi di un elenco (grpprl): codice da 2 byte e operando la cui lunghezza dipende dai 3 bit alti del codice. */
function comandi(g: Uint8Array): Sprm[] {
  const out: Sprm[] = [];
  let p = 0;
  while (p + 2 <= g.length) {
    const codice = u16(g, p);
    p += 2;
    let lun: number;
    switch (codice >> 13) {
      case 0: case 1: lun = 1; break;
      case 2: case 4: case 5: lun = 2; break;
      case 3: lun = 4; break;
      case 7: lun = 3; break;
      default:
        // operando di lunghezza variabile: un byte di lunghezza; per la definizione delle tabelle due byte (più uno)
        if (codice === 0xd608 || codice === 0xd606) { lun = u16(g, p) - 1; p += 2; }
        else { lun = g[p] ?? 0; p += 1; }
    }
    if (lun < 0 || p + lun > g.length) break;
    out.push({ codice, operando: g.subarray(p, p + lun) });
    p += lun;
  }
  return out;
}

/** Proprietà dei caratteri (CHP) che servono a pmb_docs. */
interface Chp {
  g: boolean; c: boolean; s: boolean; barrato: boolean; v?: 'p' | 'd';
  font: number; hps: number; colore?: string; sfondo?: string;
  nascosto: boolean; cancellato: boolean; inserito: boolean; speciale: boolean; immagine?: number; istd: number;
  /** simbolo inserito con «Inserisci simbolo»: il carattere e il suo carattere tipografico */
  simbolo?: { font: number; codice: number };
}
const chpBase = (): Chp => ({ g: false, c: false, s: false, barrato: false, font: 0, hps: 20, nascosto: false, cancellato: false, inserito: false, speciale: false, istd: 10 });

/** Colori dell'indice di Word (ico). */
const ICO = ['', '#000000', '#0000ff', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#ffff00', '#ffffff', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0'];
const coloreRef = (b: Uint8Array, p: number): string | undefined => {
  // COLORREF: rosso, verde, blu e un byte che vale 0xFF quando il colore è «automatico»
  if (p + 3 >= b.length || b[p + 3] === 0xff) return undefined;
  return `#${[b[p], b[p + 1], b[p + 2]].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

/** I comandi «acceso/spento» dei caratteri: 0 spento, 1 acceso, 0x80 come lo stile, 0x81 il contrario dello stile. */
function interruttore(valore: number, dalloStile: boolean): boolean {
  if (valore === 0) return false;
  if (valore === 1) return true;
  if (valore === 0x80) return dalloStile;
  if (valore === 0x81) return !dalloStile;
  return valore !== 0;
}

function applicaCarattere(chp: Chp, s: Sprm, stile: Chp): void {
  const o = s.operando;
  switch (s.codice) {
    case 0x0835: chp.g = interruttore(o[0], stile.g); break;
    case 0x0836: chp.c = interruttore(o[0], stile.c); break;
    case 0x0837: case 0x2a53: chp.barrato = interruttore(o[0], stile.barrato); break;
    case 0x2a3e: chp.s = o[0] !== 0; break;
    case 0x2a48: chp.v = o[0] === 1 ? 'p' : o[0] === 2 ? 'd' : undefined; break;
    case 0x4a43: chp.hps = u16(o, 0) || chp.hps; break;
    case 0x4a4f: chp.font = u16(o, 0); break;
    case 0x2a42: chp.colore = ICO[o[0]] || undefined; break;
    case 0x6870: chp.colore = coloreRef(o, 0); break;
    case 0x2a0c: chp.sfondo = ICO[o[0]] || undefined; break;
    case 0xca71: { const c = coloreRef(o, 4); if (c && c !== '#ffffff') chp.sfondo = c; break; }
    case 0x4866: { const ico = (u16(o, 0) >> 5) & 0x1f; if (ico > 0 && ico < ICO.length && ico !== 8) chp.sfondo = ICO[ico]; break; }
    case 0x083c: chp.nascosto = interruttore(o[0], stile.nascosto); break;
    case 0x0800: chp.cancellato = interruttore(o[0], false); break;
    case 0x0801: chp.inserito = interruttore(o[0], false); break;
    case 0x0855: chp.speciale = interruttore(o[0], false); break;
    case 0x6a03: chp.immagine = u32(o, 0); break;
    case 0x4a30: chp.istd = u16(o, 0); break;
    case 0x6a09: chp.simbolo = { font: u16(o, 0), codice: u16(o, 2) }; break;
  }
}

/** I caratteri del tipo «Symbol» (lettere greche e segni di matematica) in Unicode: posizione da 0x20 in su. */
const SIMBOLI = ' !∀#∃%&∋()∗+,−./0123456789:;<=>?≅ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ[∴]⊥_‾αβχδεφγηιϕκλμνοπθρστυϖωξψζ{|}~';
const SIMBOLI_ALTI: Record<number, string> = {
  0xa0: '€', 0xa1: 'ϒ', 0xa2: '′', 0xa3: '≤', 0xa4: '⁄', 0xa5: '∞', 0xa6: 'ƒ', 0xa7: '♣', 0xa8: '♦', 0xa9: '♥', 0xaa: '♠', 0xab: '↔', 0xac: '←', 0xad: '↑', 0xae: '→', 0xaf: '↓',
  0xb0: '°', 0xb1: '±', 0xb2: '″', 0xb3: '≥', 0xb4: '×', 0xb5: '∝', 0xb6: '∂', 0xb7: '•', 0xb8: '÷', 0xb9: '≠', 0xba: '≡', 0xbb: '≈', 0xbc: '…', 0xbf: '↵',
  0xc0: 'ℵ', 0xc1: 'ℑ', 0xc2: 'ℜ', 0xc3: '℘', 0xc4: '⊗', 0xc5: '⊕', 0xc6: '∅', 0xc7: '∩', 0xc8: '∪', 0xc9: '⊃', 0xca: '⊇', 0xcb: '⊄', 0xcc: '⊂', 0xcd: '⊆', 0xce: '∈', 0xcf: '∉',
  0xd0: '∠', 0xd1: '∇', 0xd2: '®', 0xd3: '©', 0xd4: '™', 0xd5: '∏', 0xd6: '√', 0xd7: '⋅', 0xd8: '¬', 0xd9: '∧', 0xda: '∨', 0xdb: '⇔', 0xdc: '⇐', 0xdd: '⇑', 0xde: '⇒', 0xdf: '⇓',
  0xe0: '◊', 0xe1: '〈', 0xe5: '∑', 0xf1: '〉', 0xf2: '∫',
};
/** I segni più usati del tipo «Wingdings» (elenchi e caselle). */
const WINGDINGS: Record<number, string> = { 0x6c: '●', 0x6e: '■', 0x6f: '□', 0x71: '❑', 0x75: '◆', 0x76: '❖', 0x77: '◆', 0x9f: '•', 0xa1: '○', 0xa7: '▪', 0xa8: '◻', 0xd8: '➢', 0xe0: '➔', 0xe8: '➔', 0xf0: '⇨', 0xfb: '✗', 0xfc: '✓', 0xfd: '☒', 0xfe: '☑' };

/** Il carattere Unicode di un simbolo inserito: dal tipo Symbol e Wingdings con le tabelle, dagli altri tipi così com'è; vuoto se non si sa. */
export function carattereSimbolo(nomeFont: string, codice: number): string {
  const c = codice >= 0xf000 ? codice - 0xf000 : codice;
  const nome = nomeFont.toLowerCase();
  if (nome === 'symbol') return c >= 0x20 && c < 0x7f ? SIMBOLI[c - 0x20] : SIMBOLI_ALTI[c] ?? '';
  if (nome.startsWith('wingdings')) return WINGDINGS[c] ?? '';
  return codice >= 0xf000 ? DA_UN_BYTE[c & 0xff] : String.fromCharCode(codice);
}

/** Proprietà dei paragrafi (PAP) che servono a pmb_docs. */
interface Pap {
  istd: number; jc: number; sinistra: number; prima?: number; dopo?: number; interlinea?: number; salto: boolean;
  inTabella: boolean; fineRiga: boolean; livelloTabella: number; fineRigaInterna: boolean;
  ilfo: number; ilvl: number; bordi: Array<{ lato: number; spessore: number; colore: string; tipo: number }>;
  /** gli spazi scritti nel paragrafo stesso (non ereditati dallo stile) */
  diretti: { prima?: number; dopo?: number; interlinea?: number };
}
const papBase = (istd = 0): Pap => ({ istd, jc: 0, sinistra: 0, salto: false, inTabella: false, fineRiga: false, livelloTabella: 0, fineRigaInterna: false, ilfo: 0, ilvl: 0, bordi: [], diretti: {} });

function applicaParagrafo(pap: Pap, s: Sprm): void {
  const o = s.operando;
  switch (s.codice) {
    case 0x4600: pap.istd = u16(o, 0); break;
    case 0x2403: case 0x2461: pap.jc = o[0]; break;
    case 0x840f: case 0x845e: pap.sinistra = i16(o, 0); break;
    case 0x6412: { const riga = i16(o, 0), multipla = i16(o, 2); pap.interlinea = multipla === 1 ? riga / 240 : 0; break; }
    case 0xa413: pap.prima = u16(o, 0) / 20; break;
    case 0xa414: pap.dopo = u16(o, 0) / 20; break;
    case 0x2407: pap.salto = o[0] !== 0; break;
    case 0x2416: pap.inTabella = o[0] !== 0; break;
    case 0x2417: pap.fineRiga = o[0] !== 0; break;
    case 0x6649: pap.livelloTabella = u32(o, 0); break;
    case 0x244c: pap.fineRigaInterna = o[0] !== 0; break;
    case 0x460b: pap.ilfo = i16(o, 0); break;
    case 0x260a: pap.ilvl = o[0]; break;
    // bordi: lato 0 sopra, 1 sinistra, 2 sotto, 3 destra; nel formato vecchio (4 byte) spessore, tipo, colore ico
    case 0x6424: case 0x6425: case 0x6426: case 0x6427: {
      const lato = s.codice - 0x6424;
      pap.bordi = pap.bordi.filter((b) => b.lato !== lato);
      if (o[1] !== 0 && o[1] !== 0xff) pap.bordi.push({ lato, spessore: o[0] / 8, colore: ICO[o[2]] || '#000000', tipo: o[1] });
      break;
    }
    case 0xc64e: case 0xc64f: case 0xc650: case 0xc651: {
      const lato = s.codice - 0xc64e;
      pap.bordi = pap.bordi.filter((b) => b.lato !== lato);
      if (o[5] !== 0 && o[5] !== 0xff) pap.bordi.push({ lato, spessore: o[4] / 8, colore: coloreRef(o, 0) ?? '#000000', tipo: o[5] });
      break;
    }
  }
}

// ---- stili ----

interface Stile { nome: string; sti: number; tipo: number; base: number; papx: Uint8Array; chpx: Uint8Array }
interface StiliRisolti { pap: Map<number, Pap>; chp: Map<number, Chp>; nomi: Map<number, { nome: string; sti: number }>; fontPredefinito: number }

function leggiStili(tav: Uint8Array, fc: number, lcb: number): StiliRisolti {
  const stili = new Map<number, Stile>();
  let fontPredefinito = 0;
  if (lcb > 2 && fc + lcb <= tav.length) {
    const s = tav.subarray(fc, fc + lcb);
    const cbStshi = u16(s, 0);
    const cstd = u16(s, 2);
    const cbBase = u16(s, 4) || 10;
    fontPredefinito = u16(s, 2 + 12);
    let p = 2 + cbStshi;
    for (let istd = 0; istd < cstd && p + 2 <= s.length; istd++) {
      const cb = u16(s, p);
      const std = s.subarray(p + 2, p + 2 + cb);
      p += 2 + cb;
      if (cb === 0 || std.length < cbBase) continue;
      const sti = u16(std, 0) & 0x0fff;
      const tipo = u16(std, 2) & 0x0f;
      const base = u16(std, 2) >> 4;
      const cupx = u16(std, 4) & 0x0f;
      // nome: lunghezza in caratteri, caratteri UTF-16, zero finale
      let q = cbBase;
      const cch = u16(std, q);
      const nome = UTF16.decode(std.subarray(q + 2, q + 2 + cch * 2));
      q += 2 + cch * 2 + 2;
      let papx: Uint8Array = new Uint8Array(0), chpx: Uint8Array = new Uint8Array(0);
      for (let k = 0; k < cupx && q + 2 <= std.length; k++) {
        if (q % 2 === 1) q++;
        const cbUpx = u16(std, q);
        const upx = std.subarray(q + 2, q + 2 + cbUpx);
        if (tipo === 1 && k === 0) papx = upx.subarray(2); // le proprietà del paragrafo cominciano con il numero dello stile
        else if ((tipo === 1 && k === 1) || (tipo === 2 && k === 0)) chpx = upx;
        q += 2 + cbUpx;
      }
      stili.set(istd, { nome, sti, tipo, base: base === 0x0fff ? -1 : base, papx, chpx });
    }
  }
  const pap = new Map<number, Pap>();
  const chp = new Map<number, Chp>();
  const risolviPap = (istd: number, profondita = 0): Pap => {
    const giaFatto = pap.get(istd);
    if (giaFatto) return giaFatto;
    const s = stili.get(istd);
    const out: Pap = s && s.base >= 0 && profondita < 16 ? { ...risolviPap(s.base, profondita + 1), bordi: [...risolviPap(s.base, profondita + 1).bordi], diretti: {} } : papBase();
    out.istd = istd;
    if (s) for (const c of comandi(s.papx)) applicaParagrafo(out, c);
    out.istd = istd;
    pap.set(istd, out);
    return out;
  };
  const risolviChp = (istd: number, profondita = 0): Chp => {
    const giaFatto = chp.get(istd);
    if (giaFatto) return giaFatto;
    const s = stili.get(istd);
    const base = s && s.base >= 0 && profondita < 16 ? { ...risolviChp(s.base, profondita + 1) } : { ...chpBase(), font: fontPredefinito };
    if (s) for (const c of comandi(s.chpx)) applicaCarattere(base, c, base);
    chp.set(istd, base);
    return base;
  };
  for (const istd of stili.keys()) { risolviPap(istd); risolviChp(istd); }
  const nomi = new Map<number, { nome: string; sti: number }>();
  for (const [istd, s] of stili) nomi.set(istd, { nome: s.nome, sti: s.sti });
  return {
    pap: new Map([...pap].map(([k, v]) => [k, v])),
    chp,
    nomi,
    fontPredefinito,
  };
}

/** Lo stile di pmb_docs per uno stile di Word: dal suo numero incorporato (sti) o dal nome. */
function stileDiPmb(nome: string, sti: number): StileParagrafo | undefined {
  if (sti >= 1 && sti <= 9) return sti <= 3 ? (String(sti) as StileParagrafo) : '3';
  if (sti === 62) return 't';
  if (sti === 74) return 's';
  const n = nome.toLowerCase().split(',')[0].trim();
  const m = /^(?:heading|titolo) ?([1-9])$/.exec(n);
  if (m) return Number(m[1]) <= 3 ? (m[1] as StileParagrafo) : '3';
  if (n === 'title' || n === 'titolo') return 't';
  if (n === 'subtitle' || n === 'sottotitolo') return 's';
  return undefined;
}

// ---- caratteri (font) ----

function leggiFont(tav: Uint8Array, fc: number, lcb: number): string[] {
  const out: string[] = [];
  if (lcb < 4 || fc + lcb > tav.length) return out;
  const s = tav.subarray(fc, fc + lcb);
  let p = 0;
  let n = u16(s, p);
  if (n === 0xffff) { p += 2; n = u16(s, p); }
  p += 4; // numero e byte in più
  for (let i = 0; i < n && p < s.length; i++) {
    const lun = s[p];
    const ffn = s.subarray(p + 1, p + 1 + lun);
    // parte fissa da 39 byte, poi il nome UTF-16 che finisce con uno zero
    let nome = '';
    for (let q = 39; q + 1 < ffn.length; q += 2) { const ch = u16(ffn, q); if (ch === 0) break; nome += String.fromCharCode(ch); }
    out.push(nome);
    p += 1 + lun;
  }
  return out;
}

// ---- elenchi ----

interface Livello { formato: number; simbolo: string }
function leggiElenchi(tav: Uint8Array, fcLst: number, lcbLst: number, fcLfo: number, lcbLfo: number): (ilfo: number, ilvl: number) => Livello | null {
  const liste = new Map<number, Livello[]>();
  if (lcbLst > 2 && fcLst + lcbLst <= tav.length) {
    const s = tav.subarray(fcLst, fcLst + lcbLst);
    const n = i16(s, 0);
    const testate: Array<{ id: number; semplice: boolean }> = [];
    for (let i = 0; i < n && 2 + i * 28 + 28 <= s.length; i++) {
      const p = 2 + i * 28;
      testate.push({ id: i32(s, p), semplice: (s[p + 26] & 1) !== 0 });
    }
    // i livelli di ogni elenco seguono la tabella degli elenchi, fuori dalla lunghezza indicata per lei
    const tutto = tav.subarray(fcLst);
    let p = 2 + n * 28;
    for (const tst of testate) {
      const livelli: Livello[] = [];
      for (let k = 0; k < (tst.semplice ? 1 : 9) && p + 28 <= tutto.length; k++) {
        const formato = tutto[p + 4];
        const cbChpx = tutto[p + 24], cbPapx = tutto[p + 25];
        p += 28 + cbPapx + cbChpx;
        const cch = u16(tutto, p);
        const simbolo = UTF16.decode(tutto.subarray(p + 2, p + 2 + cch * 2));
        p += 2 + cch * 2;
        livelli.push({ formato, simbolo });
      }
      liste.set(tst.id, livelli);
    }
  }
  const lfo: number[] = [];
  if (lcbLfo > 4 && fcLfo + lcbLfo <= tav.length) {
    const s = tav.subarray(fcLfo, fcLfo + lcbLfo);
    const n = u32(s, 0);
    for (let i = 0; i < n && 4 + i * 16 + 4 <= s.length; i++) lfo.push(i32(s, 4 + i * 16));
  }
  return (ilfo, ilvl) => {
    const id = lfo[ilfo - 1];
    const livelli = id !== undefined ? liste.get(id) : undefined;
    return livelli?.[Math.min(ilvl, livelli.length - 1)] ?? null;
  };
}

// ---- pagine delle proprietà (FKP) ----

interface Tratto { da: number; a: number; grpprl: Uint8Array; istd?: number }

/** Le pagine dei caratteri (tipo 'c') o dei paragrafi (tipo 'p') indicate da una tabella PLC del flusso della tabella. */
function leggiFkp(w: Uint8Array, tav: Uint8Array, fc: number, lcb: number, tipo: 'c' | 'p'): Tratto[] {
  const out: Tratto[] = [];
  if (lcb < 8 || fc + lcb > tav.length) return out;
  const n = (lcb - 4) / 8;
  const pagine: number[] = [];
  for (let i = 0; i < n; i++) pagine.push(u32(tav, fc + (n + 1) * 4 + i * 4) & 0x3fffff);
  for (const pn of pagine) {
    const pag = w.subarray(pn * 512, pn * 512 + 512);
    if (pag.length < 512) continue;
    const quanti = pag[511];
    for (let i = 0; i < quanti; i++) {
      const da = u32(pag, i * 4), a = u32(pag, (i + 1) * 4);
      if (tipo === 'c') {
        const off = pag[(quanti + 1) * 4 + i] * 2;
        out.push({ da, a, grpprl: off === 0 ? new Uint8Array(0) : pag.subarray(off + 1, off + 1 + pag[off]) });
      } else {
        const off = pag[(quanti + 1) * 4 + i * 13] * 2;
        if (off === 0) { out.push({ da, a, grpprl: new Uint8Array(0), istd: 0 }); continue; }
        let cb = pag[off] * 2 - 1;
        let inizio = off + 1;
        if (pag[off] === 0) { cb = pag[off + 1] * 2; inizio = off + 2; }
        const g = pag.subarray(inizio, inizio + cb);
        out.push({ da, a, grpprl: g.subarray(2), istd: u16(g, 0) });
      }
    }
  }
  out.sort((x, y) => x.da - y.da);
  return out;
}

/** Il tratto che contiene la posizione fc (ricerca binaria). */
function trattoIn(tratti: Tratto[], fc: number): Tratto | undefined {
  let lo = 0, hi = tratti.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (tratti[m].a <= fc) lo = m + 1;
    else if (tratti[m].da > fc) hi = m - 1;
    else return tratti[m];
  }
  return undefined;
}

// ---- testo ----

/** Un pezzo del testo: posizioni dei caratteri (CP) da/a, posizione nel flusso, caratteri da 1 byte o da 2, comandi propri del pezzo. */
interface Pezzo { cpDa: number; cpA: number; fc: number; stretto: boolean; prm: Uint8Array }

function leggiPezzi(tav: Uint8Array, fcClx: number, lcbClx: number, ccpTotale: number): Pezzo[] {
  const clx = tav.subarray(fcClx, fcClx + lcbClx);
  const prc: Uint8Array[] = [];
  let p = 0;
  while (p < clx.length && clx[p] === 0x01) {
    const cb = i16(clx, p + 1);
    prc.push(clx.subarray(p + 3, p + 3 + Math.max(0, cb)));
    p += 3 + Math.max(0, cb);
  }
  if (clx[p] !== 0x02) {
    // senza tabella dei pezzi (file vecchi, non complessi): il testo è tutto di seguito dopo l'intestazione
    return [{ cpDa: 0, cpA: ccpTotale, fc: 0x800, stretto: true, prm: new Uint8Array(0) }];
  }
  const lcb = u32(clx, p + 1);
  const plc = clx.subarray(p + 5, p + 5 + lcb);
  const n = Math.floor((lcb - 4) / 12);
  const pezzi: Pezzo[] = [];
  for (let i = 0; i < n; i++) {
    const cpDa = u32(plc, i * 4), cpA = u32(plc, (i + 1) * 4);
    const pcd = (n + 1) * 4 + i * 8;
    const campo = u32(plc, pcd + 2);
    const stretto = (campo & 0x40000000) !== 0;
    const fc = stretto ? (campo & 0x3fffffff) / 2 : campo & 0x3fffffff;
    const prm = u16(plc, pcd + 6);
    // comandi propri del pezzo: un elenco della tabella Prc (i comandi singoli dei salvataggi veloci non si leggono)
    const comandiPezzo = prm & 1 ? prc[prm >> 1] ?? new Uint8Array(0) : new Uint8Array(0);
    pezzi.push({ cpDa, cpA, fc, stretto, prm: comandiPezzo });
  }
  return pezzi;
}

/** Il documento come una fila di caratteri, ognuno con la sua posizione nel flusso e il suo pezzo. */
class Testo {
  constructor(private readonly w: Uint8Array, private readonly pezzi: Pezzo[]) {}
  /** I caratteri da cpDa (compreso) a cpA (escluso). */
  *caratteri(cpDa: number, cpA: number): Generator<{ cp: number; ch: number; fc: number; pezzo: Pezzo }> {
    for (const pz of this.pezzi) {
      if (pz.cpA <= cpDa || pz.cpDa >= cpA) continue;
      for (let cp = Math.max(cpDa, pz.cpDa); cp < Math.min(cpA, pz.cpA); cp++) {
        const fc = pz.fc + (cp - pz.cpDa) * (pz.stretto ? 1 : 2);
        if (fc + (pz.stretto ? 0 : 1) >= this.w.length) break; // pezzo che va oltre il file (file rovinato): si passa al prossimo
        const ch = pz.stretto ? this.w[fc] : u16(this.w, fc);
        yield { cp, ch, fc, pezzo: pz };
      }
    }
  }
  /** Il testo semplice di un intervallo (per i campi e le note). */
  semplice(cpDa: number, cpA: number): string {
    let s = '';
    for (const c of this.caratteri(cpDa, cpA)) s += c.pezzo.stretto ? DA_UN_BYTE[c.ch] : String.fromCharCode(c.ch);
    return s;
  }
}

// ---- tabelle PLC ----

/** Le posizioni di una tabella PLC (n+1 numeri da 4 byte, poi n dati della dimensione data). */
function plc(tav: Uint8Array, fc: number, lcb: number, dimDato: number): { cp: number[]; dati: Uint8Array[] } {
  if (lcb < 4 || fc + lcb > tav.length) return { cp: [], dati: [] };
  const n = Math.floor((lcb - 4) / (4 + dimDato));
  const cp: number[] = [];
  for (let i = 0; i <= n; i++) cp.push(u32(tav, fc + i * 4));
  const dati: Uint8Array[] = [];
  for (let i = 0; i < n; i++) dati.push(tav.subarray(fc + (n + 1) * 4 + i * dimDato, fc + (n + 1) * 4 + (i + 1) * dimDato));
  return { cp, dati };
}

// ---- immagini ----

const IMMAGINE_MASSIMA_FILE = 5_000_000;
const base64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

/** L'immagine png o jpeg di un carattere 0x01: la struttura PICF nel flusso Data, con le misure e i blocchi di OfficeArt. */
function leggiImmagine(dati: Uint8Array | undefined, fc: number): Immagine | null {
  if (!dati || fc + 68 > dati.length) return null;
  const lcb = u32(dati, fc);
  const cbIntestazione = u16(dati, fc + 4);
  if (lcb < cbIntestazione || fc + lcb > dati.length || cbIntestazione < 68) return null;
  const mm = u16(dati, fc + 6);
  const dxa = i16(dati, fc + 28), dya = i16(dati, fc + 30);
  const mx = u16(dati, fc + 32) || 1000, my = u16(dati, fc + 34) || 1000;
  let p = fc + cbIntestazione;
  if (mm === 0x66) p += 1 + dati[p]; // nome di un'immagine collegata
  const fine = fc + lcb;
  // si cercano i blocchi delle immagini (PNG 0xF01E, JPEG 0xF01D e 0xF02A) dentro i contenitori di OfficeArt
  let trovata: { tipo: 'png' | 'jpeg'; byte: Uint8Array } | null = null;
  const visita = (da: number, a: number, profondita: number): void => {
    let q = da;
    while (!trovata && q + 8 <= a) {
      const verIst = u16(dati, q), tipo = u16(dati, q + 2), lun = u32(dati, q + 4);
      const corpo = q + 8;
      if (corpo + lun > a + 8) break;
      if ((verIst & 0x0f) === 0x0f && profondita < 8) visita(corpo, Math.min(a, corpo + lun), profondita + 1);
      else if (tipo === 0xf007) {
        // FBSE: 36 byte fissi, il nome, poi l'immagine incorporata
        const nome = dati[corpo + 33];
        visita(corpo + 36 + nome, Math.min(a, corpo + lun), profondita + 1);
      } else if (tipo === 0xf01e || tipo === 0xf01d || tipo === 0xf02a) {
        const istanza = verIst >> 4;
        const dueUid = istanza === 0x6e1 || istanza === 0x46b || istanza === 0x6e3;
        const inizio = corpo + (dueUid ? 32 : 16) + 1;
        const byte = dati.subarray(inizio, Math.min(corpo + lun, a));
        const png = byte[0] === 0x89 && byte[1] === 0x50 && byte[2] === 0x4e && byte[3] === 0x47;
        const jpeg = byte[0] === 0xff && byte[1] === 0xd8 && byte[2] === 0xff;
        if (png || jpeg) trovata = { tipo: png ? 'png' : 'jpeg', byte };
      }
      q = corpo + lun;
    }
  };
  visita(p, fine, 0);
  const im = trovata as { tipo: 'png' | 'jpeg'; byte: Uint8Array } | null;
  if (!im || im.byte.length > IMMAGINE_MASSIMA_FILE) return null;
  const w = (dxa * mx) / 1000 / 15, h = (dya * my) / 1000 / 15;
  if (!(w >= 1) || !(h >= 1)) return null;
  const misure = dimensioniIniziali(w, h);
  const risultato = { s: `data:image/${im.tipo};base64,${base64(im.byte)}`, w: misure.w, h: misure.h };
  return immagineValida(risultato) ? risultato : null;
}

// ---- il documento ----

interface Contesto {
  testo: Testo;
  chpx: Tratto[];
  papx: Tratto[];
  stili: StiliRisolti;
  font: string[];
  elenco: (ilfo: number, ilvl: number) => Livello | null;
  dati?: Uint8Array;
  /** posizioni (CP) delle fine sezione: lì un 0x0C chiude il paragrafo */
  fineSezioni: Set<number>;
  /** note: posizione del riferimento → testo */
  note: Map<number, string>;
  noteUsate: Array<{ numero: number; testo: string }>;
  segnalibri: Array<{ cp: number; nome: string }>;
  avvisi: Set<string>;
  /** proprietà già calcolate (per tratto e pezzo): i documenti lunghi le chiedono milioni di volte */
  memoria: Map<string, Pap | Chp>;
}

interface StatoCampo { istruzione: string; risultato: boolean; link?: string; tipo: 'pagina' | 'pagine' | null }

/** Le proprietà del paragrafo che finisce con il carattere in fc (stile, poi comandi della pagina, poi del pezzo). */
function papDi(ctx: Contesto, fc: number, pezzo: Pezzo): Pap {
  const tr = trattoIn(ctx.papx, fc);
  const chiave = `p${tr ? tr.da : -1}|${pezzo.cpDa}`;
  const giaFatto = ctx.memoria.get(chiave) as Pap | undefined;
  if (giaFatto) return giaFatto;
  const istd = tr?.istd ?? 0;
  const base = ctx.stili.pap.get(istd) ?? papBase(istd);
  const pap: Pap = { ...base, bordi: [...base.bordi], istd, diretti: {} };
  // i comandi scritti nel paragrafo: si applicano anche a un paragrafo vuoto, per sapere quali spazi sono suoi
  const diretto = papBase(istd);
  diretto.prima = undefined; diretto.dopo = undefined; diretto.interlinea = undefined;
  const elenco = [...(tr ? comandi(tr.grpprl) : []), ...comandi(pezzo.prm).filter((c) => ((c.codice >> 10) & 7) === 1)];
  for (const c of elenco) { applicaParagrafo(pap, c); applicaParagrafo(diretto, c); }
  pap.diretti = { prima: diretto.prima, dopo: diretto.dopo, interlinea: diretto.interlinea };
  ctx.memoria.set(chiave, pap);
  return pap;
}

/** Le proprietà del carattere in fc: stile del paragrafo, stile di carattere, comandi della pagina, comandi del pezzo. */
function chpDi(ctx: Contesto, fc: number, pezzo: Pezzo, istdParagrafo: number): Chp {
  const tr0 = trattoIn(ctx.chpx, fc);
  const chiave = `c${tr0 ? tr0.da : -1}|${pezzo.cpDa}|${istdParagrafo}`;
  const giaFatto = ctx.memoria.get(chiave) as Chp | undefined;
  if (giaFatto) return giaFatto;
  const chp = calcolaChp(ctx, tr0, pezzo, istdParagrafo);
  ctx.memoria.set(chiave, chp);
  return chp;
}
function calcolaChp(ctx: Contesto, tr: Tratto | undefined, pezzo: Pezzo, istdParagrafo: number): Chp {
  const stilePar = ctx.stili.chp.get(istdParagrafo) ?? { ...chpBase(), font: ctx.stili.fontPredefinito };
  const elenco = [...(tr ? comandi(tr.grpprl) : []), ...comandi(pezzo.prm).filter((c) => ((c.codice >> 10) & 7) === 2)];
  // lo stile di carattere va prima dei comandi diretti
  const cstile = elenco.find((c) => c.codice === 0x4a30);
  let base = stilePar;
  if (cstile) {
    const sc = ctx.stili.chp.get(u16(cstile.operando, 0));
    if (sc) base = { ...stilePar, ...differenza(sc) };
  }
  const chp: Chp = { ...base };
  for (const c of elenco) applicaCarattere(chp, c, base);
  return chp;
}
/** Le proprietà che uno stile di carattere cambia rispetto a quelle di partenza. */
function differenza(c: Chp): Partial<Chp> {
  const zero = chpBase();
  const out: Partial<Chp> = {};
  for (const k of Object.keys(c) as Array<keyof Chp>) if (k !== 'font' && k !== 'istd' && c[k] !== zero[k]) (out as Record<string, unknown>)[k] = c[k];
  if (c.font !== 0) out.font = c.font;
  return out;
}

function formatoRun(chp: Chp, ctx: Contesto): Omit<Run, 't'> {
  const r: Omit<Run, 't'> = { g: chp.g, c: chp.c, s: chp.s };
  if (chp.barrato) r.x = 'b';
  if (chp.v) r.v = chp.v;
  const nome = ctx.font[chp.font];
  if (nome && nome.toLowerCase() !== CARATTERE_NORMALE.toLowerCase()) r.f = nome;
  const corpo = chp.hps / 2;
  if (corpo !== CORPO_NORMALE && corpo >= 1 && corpo <= 400) r.z = corpo;
  if (chp.colore && chp.colore !== '#000000') r.k = chp.colore;
  if (chp.sfondo) r.h = chp.sfondo;
  return r;
}

function attributiParagrafo(pap: Pap, ctx: Contesto): AttributiParagrafo {
  const a: AttributiParagrafo = {};
  const nome = ctx.stili.nomi.get(pap.istd);
  const st = nome ? stileDiPmb(nome.nome, nome.sti) : undefined;
  if (st) a.st = st;
  const al: Record<number, Allineamento> = { 1: 'ce', 2: 'dx', 3: 'gi', 4: 'gi' };
  if (al[pap.jc]) a.al = al[pap.jc];
  const proprio = st !== undefined;
  // come nel .docx: gli stili con un aspetto proprio (Titolo...) prendono solo gli spazi scritti nel paragrafo, gli altri anche quelli dello stile
  const prima = proprio ? pap.diretti.prima : pap.prima;
  const dopo = proprio ? pap.diretti.dopo : pap.dopo;
  const interlinea = proprio ? pap.diretti.interlinea : pap.interlinea;
  const sb = spazioValido(prima);
  const sa = spazioValido(dopo);
  if (sb !== undefined) a.sb = sb;
  if (sa !== undefined) a.sa = sa;
  if (interlinea !== undefined && interlinea > 0) {
    const ls = Math.round(interlinea * 100) / 100;
    if (ls >= 0.5 && ls <= 5 && ls !== 1.15) a.ls = ls;
  }
  if (pap.salto) a.sp = true;
  let inElenco = false;
  if (pap.ilfo > 0) {
    const liv = ctx.elenco(pap.ilfo, pap.ilvl);
    if (liv && liv.formato !== 255) {
      inElenco = true;
      const tipo: TipoElenco = liv.formato === 23 ? (liv.simbolo === '☐' || liv.simbolo === '☑' ? 't' : 'p') : 'n';
      a.el = tipo;
      if (tipo === 't' && liv.simbolo === '☑') a.fa = true;
      if (pap.ilvl > 0) a.ri = Math.min(8, pap.ilvl);
    }
  }
  if (!inElenco && pap.sinistra >= 360) a.ri = Math.min(8, Math.max(1, Math.round(pap.sinistra / 720)));
  // un bordo su due lati o più è un bordo attorno al paragrafo; la sola linea sotto è la linea orizzontale di pmb_docs
  if (pap.bordi.length >= 2) {
    const b = pap.bordi[0];
    // tipo della linea: 6 a puntini, 7, 8, 9 e 22 a trattini, gli altri continua
    const bordo = bordoValido({ w: b.spessore || 1, c: b.colore, s: b.tipo === 6 ? 'p' : b.tipo === 7 || b.tipo === 8 || b.tipo === 9 || b.tipo === 22 ? 't' : 'c' });
    if (bordo) a.bd = bordo;
  } else if (pap.bordi.length === 1 && pap.bordi[0].lato === 2) a.hr = true;
  return a;
}

/**
 * Converte un pezzo di testo (CP da/a) in paragrafi. `campi` dice se PAGE e NUMPAGES diventano i campi del numero di pagina (intestazione
 * e piè di pagina). Nelle tabelle i paragrafi ricevono la cella (tb).
 */
function converti(ctx: Contesto, cpDa: number, cpA: number, campi: boolean, tabelle: { prossima: number }): Paragrafo[] {
  const out: Paragrafo[] = [];
  let corrente: Run[] = [];
  const pila: StatoCampo[] = [];
  let saltoPendente = false;
  let tabella: { i: number; r: number; c: number } | null = null;
  let segnalibro = 0;
  const segnalibri = ctx.segnalibri.filter((s) => s.cp >= cpDa && s.cp < cpA).sort((a, b) => a.cp - b.cp);
  let inizioParagrafo = cpDa;
  const aggiungi = (t: string, r: Omit<Run, 't'>, link?: string): void => {
    if (t === '') return;
    corrente.push({ ...r, t, ...(link ? { u: link } : {}) });
  };
  const chiudi = (pap: Pap | null, fineCp: number): void => {
    const attr = pap ? attributiParagrafo(pap, ctx) : {};
    if (saltoPendente) { attr.sp = true; saltoPendente = false; }
    // il segnalibro va sul primo paragrafo che lo contiene
    while (segnalibro < segnalibri.length && segnalibri[segnalibro].cp < inizioParagrafo) segnalibro++;
    if (segnalibro < segnalibri.length && segnalibri[segnalibro].cp <= fineCp) {
      const nome = nomeSegnalibroValido(segnalibri[segnalibro].nome);
      if (nome && !segnalibri[segnalibro].nome.startsWith('_')) attr.sg = nome;
      while (segnalibro < segnalibri.length && segnalibri[segnalibro].cp <= fineCp) segnalibro++;
    }
    out.push({ ...attr, ...(tabella ? { tb: { i: tabella.i, r: tabella.r, c: tabella.c } } : {}), runs: normalizza(corrente) });
    corrente = [];
  };
  const inRisultato = (): boolean => pila.every((c) => c.risultato && c.tipo === null);
  const linkCorrente = (): string | undefined => { for (let i = pila.length - 1; i >= 0; i--) if (pila[i].link) return pila[i].link; return undefined; };

  for (const { cp, ch, fc, pezzo } of ctx.testo.caratteri(cpDa, cpA)) {
    // campi: 0x13 inizio, 0x14 separatore, 0x15 fine
    if (ch === 0x13) { pila.push({ istruzione: '', risultato: false, tipo: null }); continue; }
    if (ch === 0x14 && pila.length > 0) {
      const c = pila[pila.length - 1];
      c.risultato = true;
      const m = /^\s*HYPERLINK\s+"([^"]+)"/i.exec(c.istruzione);
      if (m && urlValido(m[1])) c.link = m[1];
      if (campi && /^\s*PAGE\b/i.test(c.istruzione)) c.tipo = 'pagina';
      if (campi && /^\s*NUMPAGES\b/i.test(c.istruzione)) c.tipo = 'pagine';
      if (c.tipo) aggiungi(c.tipo === 'pagina' ? CAMPO_PAGINA : CAMPO_PAGINE, formatoRun(chpDi(ctx, fc, pezzo, 0), ctx));
      continue;
    }
    if (ch === 0x15 && pila.length > 0) {
      const c = pila.pop()!;
      if (!c.risultato && campi && /^\s*(PAGE|NUMPAGES)\b/i.test(c.istruzione)) aggiungi(/^\s*PAGE\b/i.test(c.istruzione) ? CAMPO_PAGINA : CAMPO_PAGINE, formatoRun(chpDi(ctx, fc, pezzo, 0), ctx));
      continue;
    }
    if (pila.length > 0 && !pila[pila.length - 1].risultato) {
      // istruzione del campo: si raccoglie, non si mostra
      pila[pila.length - 1].istruzione += pezzo.stretto ? DA_UN_BYTE[ch] : String.fromCharCode(ch);
      continue;
    }
    const fineParagrafo = ch === 0x0d || ch === 0x07 || (ch === 0x0c && ctx.fineSezioni.has(cp + 1));
    if (fineParagrafo) {
      const pap = papDi(ctx, fc, pezzo);
      if (pap.fineRiga || pap.fineRigaInterna) {
        // fine di una riga della tabella: non è un paragrafo
        if (tabella && pap.fineRiga) { tabella.r++; tabella.c = 0; }
        corrente = [];
        inizioParagrafo = cp + 1;
        continue;
      }
      const inTabella = pap.inTabella || pap.livelloTabella > 0;
      if (inTabella && !tabella) tabella = { i: tabelle.prossima++, r: 0, c: 0 };
      if (!inTabella && tabella) tabella = null;
      chiudi(pap, cp);
      if (ch === 0x07 && tabella) tabella.c++;
      if (ch === 0x0c) saltoPendente = true;
      inizioParagrafo = cp + 1;
      continue;
    }
    if (!inRisultato()) continue;
    // nei titoli (Titolo, Sottotitolo, Titolo 1-3) il carattere dello stile di Word non si porta: l'aspetto è quello dei titoli di pmb_docs
    // (come nel .docx); negli altri paragrafi sì, così uno stile proprio del documento (citazione, intestazione di tabella...) si vede
    const istdPar = trattoIn(ctx.papx, fc)?.istd ?? 0;
    const nomeStile = ctx.stili.nomi.get(istdPar);
    const chp = chpDi(ctx, fc, pezzo, nomeStile && stileDiPmb(nomeStile.nome, nomeStile.sti) ? 0 : istdPar);
    if (chp.nascosto || chp.cancellato) continue;
    if (chp.inserito) ctx.avvisi.add('revisioni');
    const formato = formatoRun(chp, ctx);
    const link = linkCorrente();
    if (link) { if (formato.k === '#0000ff' || formato.k === '#000080' || formato.k === '#0563c1') delete formato.k; formato.s = false; }
    // un simbolo inserito sta nel testo come «(» con il comando del simbolo (Word non sempre lo segna come carattere speciale)
    if (ch === 0x28 && chp.simbolo) { aggiungi(carattereSimbolo(ctx.font[chp.simbolo.font] ?? '', chp.simbolo.codice), formato, link); continue; }
    // caratteri speciali: immagine (0x01), richiamo di nota (0x02), separatori delle note (0x03, 0x04), commento (0x05), disegno (0x08);
    // gli altri caratteri segnati come speciali (gli spazi delle caselle dei moduli...) sono testo normale
    if (chp.speciale && ch < 0x20) {
      if (ch === 0x01 && chp.immagine !== undefined) {
        const im = leggiImmagine(ctx.dati, chp.immagine);
        if (im) corrente.push({ ...formato, t: OGGETTO, im, ...(link ? { u: link } : {}) });
        else ctx.avvisi.add('immagini');
      } else if (ch === 0x02) {
        const testoNota = ctx.note.get(cp);
        if (testoNota !== undefined) {
          const numero = ctx.noteUsate.length + 1;
          ctx.noteUsate.push({ numero, testo: testoNota });
          aggiungi(String(numero), { ...formato, v: 'p' }, link);
        }
      } else if (ch === 0x08) ctx.avvisi.add('forme');
      else if (ch === 0x05) ctx.avvisi.add('commenti');
      continue;
    }
    switch (ch) {
      case 0x0b: chiudi(papDi(ctx, fc, pezzo), cp); inizioParagrafo = cp + 1; break; // a capo dentro il paragrafo: come nel .docx, un paragrafo nuovo
      case 0x0c: case 0x0e: if (corrente.length > 0) { chiudi(papDi(ctx, fc, pezzo), cp); inizioParagrafo = cp + 1; } if (ch === 0x0c) saltoPendente = true; break;
      case 0x09: aggiungi('\t', formato, link); break;
      case 0x1e: aggiungi('-', formato, link); break;
      case 0x1f: break; // trattino facoltativo
      case 0xa0: aggiungi(' ', formato, link); break;
      default:
        if (ch < 0x20) break;
        aggiungi(pezzo.stretto ? DA_UN_BYTE[ch] : String.fromCharCode(ch), formato, link);
    }
  }
  if (corrente.length > 0) chiudi(null, cpA);
  return out;
}

/** Il testo semplice di una nota: senza campi, con gli spazi ridotti (come nel .docx). */
function testoNota(ctx: Contesto, da: number, a: number): string {
  let s = '';
  let campi = 0;
  let risultato = true;
  for (const { ch, pezzo } of ctx.testo.caratteri(da, a)) {
    if (ch === 0x13) { campi++; risultato = false; continue; }
    if (ch === 0x14) { risultato = true; continue; }
    if (ch === 0x15) { campi = Math.max(0, campi - 1); risultato = true; continue; }
    if (!risultato) continue;
    if (ch === 0x0d || ch === 0x0b || ch === 0x07 || ch === 0x09) { s += ' '; continue; }
    if (ch < 0x20) continue;
    s += pezzo.stretto ? DA_UN_BYTE[ch] : String.fromCharCode(ch);
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, 2000);
}

/** Paragrafi delle note in fondo al documento, come quelle di pmb_docs e del lettore .docx. */
function paragrafiNote(usate: Array<{ numero: number; testo: string }>): Paragrafo[] {
  return usate.map((n) => ({
    ...(n.numero === 1 ? { hr: true } : {}),
    runs: [
      { t: `${n.numero}. `, g: true, c: false, s: false, z: 9 },
      { t: n.testo === '' ? '(nota vuota)' : n.testo, g: false, c: false, s: false, z: 9 },
    ],
  }));
}

/** Dopo ogni tabella resta sempre un paragrafo normale (per poterne uscire). */
function paragrafoDopoLeTabelle(paragrafi: Paragrafo[]): Paragrafo[] {
  const out: Paragrafo[] = [];
  paragrafi.forEach((par, i) => {
    out.push(par);
    const dopo = paragrafi[i + 1];
    if (par.tb && (dopo === undefined || (dopo.tb !== undefined && dopo.tb.i !== par.tb.i))) out.push({ runs: [] });
  });
  return out;
}

/** Il margine (intestazione o piè di pagina) come lo vuole pmb_docs: testo semplice, al massimo 3 paragrafi di 300 caratteri. */
function margine(paragrafi: Paragrafo[]): Paragrafo[] | undefined {
  const pulite = paragrafi.map((p) => {
    let usati = 0;
    const runs: Run[] = [];
    for (const r of normalizza(p.runs.filter((x) => x.im === undefined).map(({ u, ...resto }) => { void u; return resto; }))) {
      if (usati >= 300) break;
      runs.push(r.t.length + usati > 300 ? { ...r, t: r.t.slice(0, 300 - usati) } : r);
      usati += r.t.length;
    }
    return { ...(p.al !== undefined ? { al: p.al } : {}), runs };
  });
  while (pulite.length > 0 && pulite[pulite.length - 1].runs.length === 0) pulite.pop();
  return pulite.length > 0 ? pulite.slice(0, RIGHE_MARGINE_MASSIME) : undefined;
}

/** I flussi del documento decifrati, se il documento è protetto da password RC4 e la password è giusta. */
function decifra(w: Uint8Array, tav: Uint8Array, dati: Uint8Array | undefined, lKey: number, password: string | undefined): { w: Uint8Array; tav: Uint8Array; dati?: Uint8Array } {
  if (password === undefined) throw new DocProtetto(true);
  const chiave = chiaveRc4(tav.subarray(0, lKey), password);
  if (!chiave) throw new DocProtetto(true);
  const decifraDa = (b: Uint8Array, inizio: number): Uint8Array => {
    const flusso = flussoChiaveABlocchi(chiave, 512);
    const out = b.slice();
    for (let i = inizio; i < b.length; i++) out[i] = b[i] ^ flusso(i);
    return out;
  };
  // in un .doc i primi 68 byte del flusso principale (l'intestazione) e l'intestazione della cifratura restano in chiaro
  return { w: decifraDa(w, 68), tav: decifraDa(tav, lKey), dati: dati ? decifraDa(dati, 0) : undefined };
}

function leggi(bytes: Uint8Array, password: string | undefined): RisultatoDoc {
  if (!eFileComposto(bytes)) throw new Error(t('non è un documento di Word 97-2003'));
  const a = leggiCfb(bytes);
  let w = a.flusso('WordDocument');
  if (!w) {
    if (a.flusso('Workbook') || a.flusso('Book')) throw new ErroreChiaro(t('È un foglio di Excel: si apre con pmb_sheets.'));
    if (a.flusso('EncryptedPackage')) throw new DocProtetto();
    throw new Error(t('manca il testo del documento'));
  }
  // 0xA5DC è l'intestazione di Word 6.0 e Word 95, che hanno un formato diverso
  if (u16(w, 0) === 0xa5dc) throw new ErroreChiaro(t('Il documento è di una versione di Word più vecchia della 97, che pmb_docs non apre: in Word o LibreOffice salvalo come .docx e aprilo di nuovo.'));
  if (u16(w, 0) !== 0xa5ec) throw new Error(t('intestazione del documento non riconosciuta'));
  const nFib = u16(w, 2);
  if (nFib < 0xc1) throw new ErroreChiaro(t('Il documento è di una versione di Word più vecchia della 97, che pmb_docs non apre: in Word o LibreOffice salvalo come .docx e aprilo di nuovo.'));
  const indicatori = u16(w, 10);
  let tav = a.flusso(indicatori & 0x0200 ? '1Table' : '0Table');
  if (!tav) throw new Error(t('manca la tabella del documento'));
  let dati = a.flusso('Data');
  if (indicatori & 0x0100) {
    // cifrato: con il vecchio metodo XOR non si apre; con RC4 serve la password
    if (indicatori & 0x8000) throw new DocProtetto();
    ({ w, tav, dati } = decifra(w, tav, dati, u32(w, 14), password));
  }
  // la parte variabile dell'intestazione: due serie di numeri (da 2 e da 4 byte), poi le coppie posizione/lunghezza
  const csw = u16(w, 32);
  const inizioLw = 34 + csw * 2;
  const cslw = u16(w, inizioLw);
  const lw = (i: number): number => i32(w!, inizioLw + 2 + i * 4);
  const inizioFc = inizioLw + 2 + cslw * 4;
  const cbFc = u16(w, inizioFc);
  const fcLcb = (i: number): [number, number] => (i < cbFc ? [u32(w!, inizioFc + 2 + i * 8), u32(w!, inizioFc + 2 + i * 8 + 4)] : [0, 0]);
  const ccpText = lw(3), ccpFtn = lw(4), ccpHdd = lw(5), ccpAtn = lw(7), ccpEdn = lw(8), ccpTxbx = lw(9), ccpHdrTxbx = lw(10);
  const ccpTotale = ccpText + ccpFtn + ccpHdd + ccpAtn + ccpEdn + ccpTxbx + ccpHdrTxbx;

  const [fcClx, lcbClx] = fcLcb(33);
  const pezzi = leggiPezzi(tav, fcClx, lcbClx, ccpTotale);
  const [fcStsh, lcbStsh] = fcLcb(1);
  const [fcChpx, lcbChpx] = fcLcb(12);
  const [fcPapx, lcbPapx] = fcLcb(13);
  const [fcFfn, lcbFfn] = fcLcb(15);
  const [fcLst, lcbLst] = fcLcb(73);
  const [fcLfo, lcbLfo] = fcLcb(74);
  const ctx: Contesto = {
    testo: new Testo(w, pezzi),
    chpx: leggiFkp(w, tav, fcChpx, lcbChpx, 'c'),
    papx: leggiFkp(w, tav, fcPapx, lcbPapx, 'p'),
    stili: leggiStili(tav, fcStsh, lcbStsh),
    font: leggiFont(tav, fcFfn, lcbFfn),
    elenco: leggiElenchi(tav, fcLst, lcbLst, fcLfo, lcbLfo),
    dati,
    fineSezioni: new Set(plc(tav, ...fcLcb(6), 12).cp),
    note: new Map(),
    noteUsate: [],
    segnalibri: [],
    avvisi: new Set(),
    memoria: new Map(),
  };
  // note a piè di pagina e di chiusura: posizione del riferimento nel testo → testo della nota
  const leggiNote = (iRif: number, iTesto: number, inizioStoria: number): void => {
    const rif = plc(tav!, ...fcLcb(iRif), 2);
    const txt = plc(tav!, ...fcLcb(iTesto), 0);
    rif.cp.slice(0, rif.dati.length).forEach((cp, i) => {
      if (i + 1 < txt.cp.length) ctx.note.set(cp, testoNota(ctx, inizioStoria + txt.cp[i], inizioStoria + txt.cp[i + 1]));
    });
  };
  leggiNote(2, 3, ccpText);
  leggiNote(46, 47, ccpText + ccpFtn + ccpHdd + ccpAtn);
  // segnalibri: nomi e posizioni di inizio
  const [fcBk, lcbBk] = fcLcb(21);
  const bkf = plc(tav, ...fcLcb(22), 4);
  if (lcbBk > 6 && fcBk + lcbBk <= tav.length) {
    const s = tav.subarray(fcBk, fcBk + lcbBk);
    const esteso = u16(s, 0) === 0xffff;
    let p = esteso ? 2 : 0;
    const n = u16(s, p); p += 4;
    for (let i = 0; i < n && p < s.length; i++) {
      const cch = esteso ? u16(s, p) : s[p];
      p += esteso ? 2 : 1;
      const nome = esteso ? UTF16.decode(s.subarray(p, p + cch * 2)) : WINDOWS_1252.decode(s.subarray(p, p + cch));
      p += esteso ? cch * 2 : cch;
      if (bkf.cp[i] !== undefined) ctx.segnalibri.push({ cp: bkf.cp[i], nome });
    }
  }
  if (ccpAtn > 0) ctx.avvisi.add('commenti');
  if (ccpTxbx > 0) ctx.avvisi.add('forme');
  if (fcLcb(40)[1] > 0) ctx.avvisi.add('forme');

  const tabelle = { prossima: 0 };
  const paragrafi = converti(ctx, 0, ccpText, false, tabelle);
  paragrafi.push(...paragrafiNote(ctx.noteUsate));
  let doc: Documento = { paragrafi: paragrafi.length > 0 ? paragrafoDopoLeTabelle(paragrafi) : [{ runs: [] }] };

  // intestazione e piè di pagina della prima sezione (quelli delle pagine dispari, cioè normali; altrimenti quelli della prima pagina)
  if (ccpHdd > 0) {
    const hdd = plc(tav, ...fcLcb(11), 0).cp;
    const inizio = ccpText + ccpFtn;
    const storia = (i: number): Paragrafo[] | undefined => {
      if (i + 1 >= hdd.length || hdd[i + 1] <= hdd[i]) return undefined;
      return margine(converti(ctx, inizio + hdd[i], inizio + hdd[i + 1], true, { prossima: 0 }).map(({ tb, ...p }) => { void tb; return p; }));
    };
    const intestazione = storia(7) ?? storia(10);
    const piede = storia(9) ?? storia(11);
    try { if (intestazione) doc = impostaIntestazione(doc, intestazione); } catch { /* non ammessa: si ignora */ }
    try { if (piede) doc = impostaPiede(doc, piede); } catch { /* non ammesso: si ignora */ }
  }

  const avvisi = [t("È un documento del vecchio Word 97-2003 (.doc): Salva lo salva in .docx con un nome nuovo e l'originale non cambia.")];
  if (ctx.avvisi.has('immagini')) avvisi.push(t('Alcune immagini del documento non sono state importate (formato non ammesso o troppo grandi).'));
  if (ctx.avvisi.has('forme')) avvisi.push(t('Le forme, le caselle di testo e le immagini mobili del documento non sono state importate.'));
  if (ctx.avvisi.has('commenti')) avvisi.push(t('I commenti del documento non sono stati importati.'));
  if (ctx.avvisi.has('revisioni')) avvisi.push(t('Le revisioni registrate nel documento sono state accettate.'));
  if (a.esiste('Macros')) avvisi.push(t('Le macro del documento non vengono caricate.'));
  return { doc, avvisi };
}

/** Dai byte di un file .doc al documento di pmb_docs, con gli avvisi su ciò che non si importa. Un file non valido dà un errore chiaro. */
export function importaDoc(bytes: Uint8Array, password?: string): RisultatoDoc {
  try {
    return leggi(bytes, password);
  } catch (e) {
    if (e instanceof ErroreChiaro) throw e;
    if (e instanceof DocProtetto && e.rc4) throw new PasswordRichiesta(password !== undefined && password !== '');
    if (e instanceof DocProtetto) throw new Error(t('Il documento è protetto da password: pmb_docs non apre ancora i file .doc cifrati. Togli la password in Word o LibreOffice e aprilo di nuovo.'));
    throw new Error(t('File .doc non valido: {}', e instanceof Error ? e.message : String(e)));
  }
}
