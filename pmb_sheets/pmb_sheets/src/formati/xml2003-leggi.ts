// Lettura di "Foglio di calcolo XML 2003" (.xml di Excel 2002/2003, SpreadsheetML) nel modello di scambio.
// Puro: riceve il testo. Si importano valori, date, celle unite, larghezze, grassetto, corsivo, colori, allineamento e formati numerici.
// Non si importano: formule (si legge il valore memorizzato), grafici, macro.
import { analizzaXml, testoXml, type NodoXml } from '@comune/formati/xml';
import type { CellStyle } from '../sheet/styles';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import { indirizzoCella, type Scambio } from './scambio';
import { mettiCella, nomiUniciFogli, nuovoFoglio, serialeDaIso } from './lettura-comune';
import { t } from '../i18n/lingua';

/** Nome senza prefisso di spazio dei nomi ("ss:Index" → "Index"). */
const locale = (n: string): string => n.slice(n.indexOf(':') + 1);
const figli = (n: NodoXml, nome: string): NodoXml[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string' && locale(f.nome) === nome);
const attr = (n: NodoXml | undefined, nome: string): string | undefined => {
  if (!n) return undefined;
  for (const k of Object.keys(n.attributi)) if (locale(k) === nome) return n.attributi[k];
  return undefined;
};
const colore = (v: string | undefined): string | undefined => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : undefined);

const FORMATI_NOMINATI: Record<string, string> = {
  'Short Date': 'dd/mm/yyyy', 'Long Date': 'dddd d mmmm yyyy', Percent: '0%', Fixed: '0.00', Standard: '#,##0.00', 'Short Time': 'hh:mm', 'Long Time': 'hh:mm:ss',
};

export function leggiXml2003(testo: string): { scambio: Scambio; avvisi: string[] } {
  const radice = analizzaXml(testo);
  if (locale(radice.nome) !== 'Workbook') throw new Error(t('non è un foglio di calcolo XML 2003'));
  const stili = new Map<string, CellStyle>();
  for (const gruppo of figli(radice, 'Styles')) {
    for (const s of figli(gruppo, 'Style')) {
      const id = attr(s, 'ID');
      if (id === undefined) continue;
      const st: CellStyle = {};
      const car = figli(s, 'Font')[0];
      if (car) {
        if (attr(car, 'Bold') === '1') st.bold = true;
        if (attr(car, 'Italic') === '1') st.italic = true;
        const sott = attr(car, 'Underline');
        if (sott !== undefined && sott !== 'None') st.underline = true;
        if (attr(car, 'StrikeThrough') === '1') st.strike = true;
        const k = colore(attr(car, 'Color'));
        if (k) st.color = k;
      }
      const riemp = figli(s, 'Interior')[0];
      if (riemp && attr(riemp, 'Pattern') === 'Solid') { const k = colore(attr(riemp, 'Color')); if (k) st.fill = k; }
      const al = figli(s, 'Alignment')[0];
      if (al) {
        const o = attr(al, 'Horizontal');
        if (o === 'Left') st.hAlign = 'left';
        else if (o === 'Right') st.hAlign = 'right';
        else if (o === 'Center') st.hAlign = 'center';
        if (attr(al, 'WrapText') === '1') st.wrap = true;
      }
      const nf = attr(figli(s, 'NumberFormat')[0], 'Format');
      if (nf !== undefined && nf !== '' && nf.toLowerCase() !== 'general') st.numFmt = FORMATI_NOMINATI[nf] ?? nf;
      stili.set(id, st);
    }
  }
  const fogli = figli(radice, 'Worksheet').map((w, n) => {
    const f = nuovoFoglio(attr(w, 'Name') ?? `Foglio${n + 1}`);
    const tabella = figli(w, 'Table')[0];
    if (!tabella) return f;
    let col = 0;
    for (const c of figli(tabella, 'Column')) {
      const indice = parseInt(attr(c, 'Index') ?? '', 10);
      col = indice >= 1 ? indice : col + 1;
      const larghezza = parseFloat(attr(c, 'Width') ?? '');
      if (col <= MAX_COLS && larghezza > 0) f.larghezze[col] = Math.round((larghezza * 4) / 3);
      if (col <= MAX_COLS && attr(c, 'Hidden') === '1') (f.colonneNascoste ??= []).push(col);
    }
    let riga = 0;
    for (const r of figli(tabella, 'Row')) {
      const indice = parseInt(attr(r, 'Index') ?? '', 10);
      riga = indice >= 1 ? indice : riga + 1;
      if (riga > MAX_ROWS) break;
      const altezza = parseFloat(attr(r, 'Height') ?? '');
      if (altezza > 0) f.altezze[riga] = Math.round((altezza * 4) / 3);
      if (attr(r, 'Hidden') === '1') (f.righeNascoste ??= []).push(riga);
      let c = 0;
      for (const cella of figli(r, 'Cell')) {
        const ci = parseInt(attr(cella, 'Index') ?? '', 10);
        c = ci >= 1 ? ci : c + 1;
        if (c > MAX_COLS) break;
        const idStile = attr(cella, 'StyleID');
        let st = idStile !== undefined ? stili.get(idStile) : undefined;
        const dati = figli(cella, 'Data')[0];
        if (dati) {
          const tipo = attr(dati, 'Type');
          const grezzo = testoXml(dati).trim();
          if (tipo === 'Number') mettiCella(f, riga, c, grezzo);
          else if (tipo === 'Boolean') mettiCella(f, riga, c, grezzo === '1' || grezzo.toLowerCase() === 'true' ? 'TRUE' : 'FALSE');
          else if (tipo === 'DateTime') {
            const s = serialeDaIso(grezzo);
            if (s !== null) {
              mettiCella(f, riga, c, String(s));
              if (!st?.numFmt) st = { ...(st ?? {}), numFmt: grezzo.includes('T') && !/T00:00:00/.test(grezzo) ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy' };
            }
          } else if (tipo === 'Error') mettiCella(f, riga, c, grezzo, true);
          else mettiCella(f, riga, c, testoXml(dati), true);
        }
        const unisciDx = parseInt(attr(cella, 'MergeAcross') ?? '0', 10) || 0;
        const unisciGiu = parseInt(attr(cella, 'MergeDown') ?? '0', 10) || 0;
        if (unisciDx > 0 || unisciGiu > 0) f.unioni.push({ startRow: riga, endRow: Math.min(MAX_ROWS, riga + unisciGiu), startCol: c, endCol: Math.min(MAX_COLS, c + unisciDx) });
        if (st && Object.keys(st).length > 0) f.stili[indirizzoCella(riga, c)] = { ...st };
        c += unisciDx;
      }
    }
    return f;
  });
  if (fogli.length === 0) throw new Error(t('nessun foglio'));
  nomiUniciFogli(fogli);
  return { scambio: { fogli, foglioAttivo: fogli[0].nome }, avvisi: [t('Le formule del file sono state importate come valori.')] };
}
