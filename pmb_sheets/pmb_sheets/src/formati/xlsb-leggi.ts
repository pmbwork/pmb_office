// Lettura di file .xlsb (Cartella di lavoro binaria di Excel, formato BIFF12) nel modello di scambio. Puro: riceve i byte.
// Il file è un archivio ZIP come l'.xlsx, ma le parti sono flussi di record binari (xl/workbook.bin, xl/worksheets/sheetN.bin, xl/sharedStrings.bin, xl/styles.bin).
// Si importano: nomi dei fogli, valori (numeri, testo, vero/falso, errori, risultato memorizzato delle formule), date (dal formato numerico),
// formati numerici, celle unite, larghezze e colonne nascoste. Non si importano: formule (solo il valore), colori, caratteri, bordi, grafici, macro.
import { leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento } from '@comune/formati/xml';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import type { CellStyle } from '../sheet/styles';
import type { FoglioScambio, Scambio } from './scambio';
import { indirizzoCella } from './scambio';
import { codiceFormatoFogli, eFormatoData, FORMATI_INTEGRATI } from './xlsx-leggi';
import { mettiCella, nomiUniciFogli, nuovoFoglio } from './lettura-comune';
import { t } from '../i18n/lingua';

export interface RisultatoXlsb { scambio: Scambio; avvisi: string[] }

interface Rec { id: number; inizio: number; fine: number }

/** Scorre i record di un flusso BIFF12: identificatore (1 o 2 byte da 7 bit) e lunghezza (da 1 a 4 byte da 7 bit). */
function* record(b: Uint8Array): Generator<Rec> {
  let p = 0;
  while (p < b.length) {
    const b0 = b[p++];
    let id = b0;
    if (b0 & 0x80) { if (p >= b.length) return; id = (b0 & 0x7f) | ((b[p++] & 0x7f) << 7); }
    let size = 0;
    for (let k = 0; k < 4; k++) {
      if (p >= b.length) return;
      const x = b[p++];
      size += (x & 0x7f) * 2 ** (7 * k);
      if (!(x & 0x80)) break;
    }
    const fine = Math.min(b.length, p + size);
    yield { id, inizio: p, fine };
    p = fine;
  }
}

const u32 = (b: Uint8Array, p: number): number => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const u16 = (b: Uint8Array, p: number): number => b[p] | (b[p + 1] << 8);
const f64 = (b: Uint8Array, p: number): number => new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0, true);

/** XLWideString: lunghezza in caratteri (u32) e caratteri UTF-16. Restituisce il testo e la posizione dopo la stringa. */
function stringa(b: Uint8Array, p: number, fine: number): { testo: string; dopo: number } {
  if (p + 4 > fine) return { testo: '', dopo: fine };
  const n = u32(b, p);
  const lun = Math.min(n * 2, Math.max(0, fine - p - 4));
  return { testo: new TextDecoder('utf-16le').decode(b.subarray(p + 4, p + 4 + lun)), dopo: p + 4 + lun };
}

function numeroRk(rk: number): number {
  let n: number;
  if (rk & 2) n = rk >> 2;
  else { const dv = new DataView(new ArrayBuffer(8)); dv.setUint32(4, (rk & 0xfffffffc) >>> 0, true); n = dv.getFloat64(0, true); }
  return rk & 1 ? n / 100 : n;
}

const ERRORI: Record<number, string> = { 0: '#NULL!', 7: '#DIV/0!', 15: '#VALUE!', 23: '#REF!', 29: '#NAME?', 36: '#NUM!', 42: '#N/A', 43: '#GETTING_DATA' };
/** Identificatori dei formati data integrati che non sono nella tabella dei formati comuni. */
const ID_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

interface Xf { numFmt?: string; data: boolean }

function leggiStili(b: Uint8Array | undefined): Xf[] {
  const xf: Xf[] = [];
  if (!b) return xf;
  const personalizzati = new Map<number, string>();
  let incelle = false;
  for (const r of record(b)) {
    if (r.id === 44) personalizzati.set(u16(b, r.inizio), stringa(b, r.inizio + 2, r.fine).testo);
    else if (r.id === 617) incelle = true;
    else if (r.id === 618) incelle = false;
    else if (r.id === 47 && incelle) {
      const id = u16(b, r.inizio + 2);
      const codice = personalizzati.get(id) ?? FORMATI_INTEGRATI[id];
      const data = codice !== undefined ? eFormatoData(codice) : ID_DATA.has(id);
      const voce: Xf = { data };
      if (codice !== undefined && codice !== '' && codice.toLowerCase() !== 'general') voce.numFmt = codiceFormatoFogli(codice);
      else if (data) voce.numFmt = 'dd/mm/yyyy';
      xf.push(voce);
    }
  }
  return xf;
}

function leggiFoglio(nome: string, b: Uint8Array, stringheCondivise: string[], xf: Xf[], calendario1904: boolean): { foglio: FoglioScambio; formule: boolean } {
  const f = nuovoFoglio(nome);
  let riga = 0;
  let formule = false;
  const stili = new Map<string, CellStyle>();
  const metti = (r: Rec, tipo: 'num' | 'testo' | 'bool' | 'err', valore: string | number): void => {
    const col = u32(b, r.inizio);
    const indiceStile = u32(b, r.inizio + 4) & 0xffffff;
    if (riga >= MAX_ROWS || col >= MAX_COLS) return;
    const stile = xf[indiceStile];
    if (tipo === 'num') {
      let n = Number(valore);
      if (!Number.isFinite(n)) return;
      if (calendario1904 && stile?.data) n += 1462;
      mettiCella(f, riga + 1, col + 1, String(n));
    } else if (tipo === 'bool') mettiCella(f, riga + 1, col + 1, valore ? 'TRUE' : 'FALSE');
    else mettiCella(f, riga + 1, col + 1, String(valore), true);
    if (stile?.numFmt && tipo === 'num') {
      const ref = indirizzoCella(riga + 1, col + 1);
      const chiave = stile.numFmt;
      const s = stili.get(chiave) ?? { numFmt: chiave };
      stili.set(chiave, s);
      f.stili[ref] = { ...s };
    }
  };
  for (const r of record(b)) {
    switch (r.id) {
      case 0: riga = u32(b, r.inizio); break;
      case 2: metti(r, 'num', numeroRk(u32(b, r.inizio + 8))); break;
      case 5: metti(r, 'num', f64(b, r.inizio + 8)); break;
      case 9: formule = true; metti(r, 'num', f64(b, r.inizio + 8)); break;
      case 4: metti(r, 'bool', b[r.inizio + 8] !== 0 ? 1 : 0); break;
      case 10: formule = true; metti(r, 'bool', b[r.inizio + 8] !== 0 ? 1 : 0); break;
      case 3: metti(r, 'err', ERRORI[b[r.inizio + 8]] ?? '#VALUE!'); break;
      case 11: formule = true; metti(r, 'err', ERRORI[b[r.inizio + 8]] ?? '#VALUE!'); break;
      case 6: metti(r, 'testo', stringa(b, r.inizio + 8, r.fine).testo); break;
      case 8: formule = true; metti(r, 'testo', stringa(b, r.inizio + 8, r.fine).testo); break;
      case 7: metti(r, 'testo', stringheCondivise[u32(b, r.inizio + 8)] ?? ''); break;
      case 176: {
        const startRow = u32(b, r.inizio) + 1, endRow = u32(b, r.inizio + 4) + 1, startCol = u32(b, r.inizio + 8) + 1, endCol = u32(b, r.inizio + 12) + 1;
        if (startRow <= endRow && startCol <= endCol && endRow <= MAX_ROWS && endCol <= MAX_COLS && (endRow > startRow || endCol > startCol)) f.unioni.push({ startRow, endRow, startCol, endCol });
        break;
      }
      case 60: {
        const da = u32(b, r.inizio) + 1;
        const a = Math.min(u32(b, r.inizio + 4) + 1, MAX_COLS);
        const larghezza = u32(b, r.inizio + 8);
        const nascosta = (u16(b, r.inizio + 16) & 1) !== 0;
        if (da >= 1 && a >= da && a - da < 1000) {
          for (let c = da; c <= a; c++) {
            if (larghezza > 0) f.larghezze[c] = Math.round((larghezza / 256) * 7 + 5);
            if (nascosta) (f.colonneNascoste ??= []).push(c);
          }
        }
        break;
      }
    }
  }
  return { foglio: f, formule };
}

export async function leggiXlsb(bytes: Uint8Array): Promise<RisultatoXlsb> {
  try {
    const voci = await leggiZip(bytes);
    const cartella = voci.get('xl/workbook.bin');
    if (!cartella) throw new Error(t('manca la cartella di lavoro'));
    // relazioni: da identificativo a file del foglio
    const relazioni = new Map<string, string>();
    const rels = voci.get('xl/_rels/workbook.bin.rels');
    if (rels) {
      for (const n of figliElemento(analizzaXml(new TextDecoder().decode(rels)), 'Relationship')) {
        const id = n.attributi.Id, dest = n.attributi.Target;
        if (id !== undefined && dest !== undefined) relazioni.set(id, dest.startsWith('/') ? dest.slice(1) : `xl/${dest}`);
      }
    }
    const condivise: string[] = [];
    const sst = voci.get('xl/sharedStrings.bin');
    if (sst) for (const r of record(sst)) if (r.id === 19) condivise.push(stringa(sst, r.inizio + 1, r.fine).testo);
    const xf = leggiStili(voci.get('xl/styles.bin'));
    let calendario1904 = false;
    const elencoFogli: Array<{ nome: string; parte: string; nascosto: boolean }> = [];
    for (const r of record(cartella)) {
      if (r.id === 153) calendario1904 = (u32(cartella, r.inizio) & 1) !== 0;
      else if (r.id === 156) {
        // BrtBundleSh: stato (0 visibile, 1 nascosto, 2 molto nascosto), numero della scheda, relazione, nome
        const stato = u32(cartella, r.inizio);
        const rid = stringa(cartella, r.inizio + 8, r.fine);
        const nome = stringa(cartella, rid.dopo, r.fine);
        const parte = relazioni.get(rid.testo);
        if (parte) elencoFogli.push({ nome: nome.testo, parte, nascosto: stato === 1 || stato === 2 });
      }
    }
    if (elencoFogli.length === 0) throw new Error(t('nessun foglio'));
    let formule = false;
    const fogli = elencoFogli.map((e) => {
      const dati = voci.get(e.parte);
      const foglio = dati ? (() => { const r = leggiFoglio(e.nome, dati, condivise, xf, calendario1904); formule = formule || r.formule; return r.foglio; })() : nuovoFoglio(e.nome);
      if (e.nascosto) foglio.nascosto = true;
      return foglio;
    });
    nomiUniciFogli(fogli);
    const avvisi = [t('Il file .xlsb si importa solo nei valori: colori, caratteri, bordi, grafici e macro non sono stati importati.')];
    if (formule) avvisi.push(t('Le formule del file sono state importate come valori.'));
    // i fogli nascosti restano nascosti, come nei .xlsx (Nascondi e mostra foglio)
    return { scambio: { fogli, foglioAttivo: fogli[0].nome }, avvisi };
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    throw new Error(messaggio.startsWith(t('File .xlsb non valido')) ? messaggio : t('File .xlsb non valido: {}', messaggio));
  }
}
