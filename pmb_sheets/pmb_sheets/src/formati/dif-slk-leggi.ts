// Lettura di due formati di scambio storici dei fogli di calcolo: DIF (.dif, Data Interchange Format) e SYLK (.slk, Symbolic Link).
// Puro: riceve il testo già decodificato. Si leggono valori (numeri, testo, vero/falso, errori) e, per SYLK, le dimensioni di colonne e righe non servono.
// Non si importano: formule (si legge il valore memorizzato), formati e stili.
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import type { Scambio } from './scambio';
import { mettiCella, nuovoFoglio } from './lettura-comune';
import { t } from '../i18n/lingua';

export interface RisultatoTesto { scambio: Scambio; avvisi: string[] }

const ERRORI_DIF = new Set(['ERROR', 'NA']);

/** DIF: intestazione (TABLE, VECTORS, TUPLES, DATA) e poi coppie di righe "tipo,numero" / testo-o-codice, righe separate da "-1,0 / BOT". */
export function leggiDif(testo: string): RisultatoTesto {
  const righe = testo.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  let i = righe.findIndex((r) => r.trim().toUpperCase() === 'DATA');
  if (i < 0 || !/^\s*TABLE\s*$/i.test(righe[0] ?? '')) throw new Error(t('non è un file DIF'));
  i += 3; // "DATA", "0,0", '""'
  const f = nuovoFoglio('Foglio1');
  let riga = 0;
  let colonna = 0;
  while (i < righe.length) {
    const intestazione = righe[i++]?.trim() ?? '';
    if (intestazione === '') continue;
    const m = /^(-?\d+),(.*)$/.exec(intestazione);
    if (!m) continue;
    const tipo = Number(m[1]);
    const seconda = (righe[i++] ?? '').trim();
    if (tipo === -1) {
      if (seconda.toUpperCase() === 'EOD') break;
      if (seconda.toUpperCase() === 'BOT') { riga++; colonna = 0; if (riga > MAX_ROWS) break; }
      continue;
    }
    colonna++;
    if (riga === 0 || colonna > MAX_COLS) continue;
    if (tipo === 1) {
      const t0 = seconda.startsWith('"') && seconda.endsWith('"') && seconda.length >= 2 ? seconda.slice(1, -1).replace(/""/g, '"') : seconda;
      mettiCella(f, riga, colonna, t0, true);
    } else if (tipo === 0) {
      const codice = seconda.toUpperCase();
      if (codice === 'TRUE' || codice === 'FALSE') mettiCella(f, riga, colonna, codice);
      else if (ERRORI_DIF.has(codice)) mettiCella(f, riga, colonna, codice === 'NA' ? '#N/A' : '#VALUE!', true);
      else if (codice === 'V') { const n = Number(m[2].trim()); if (Number.isFinite(n)) mettiCella(f, riga, colonna, String(n)); }
    }
  }
  if (riga === 0) throw new Error(t('il file non contiene dati'));
  return { scambio: { fogli: [f], foglioAttivo: f.nome }, avvisi: [] };
}

/** Divide un record SYLK in campi: il separatore è ";" e dentro le virgolette ";;" è un punto e virgola letterale. */
function campiSlk(riga: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inVirgolette = false;
  for (let k = 0; k < riga.length; k++) {
    const c = riga[k];
    if (c === '"') { inVirgolette = !inVirgolette; cur += c; }
    else if (c === ';' && !inVirgolette) {
      if (riga[k + 1] === ';') { cur += ';'; k++; } else { out.push(cur); cur = ''; }
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** SYLK: record "C;Y riga;X colonna;K valore"; riga e colonna restano quelle dell'ultimo record se mancano. */
export function leggiSlk(testo: string): RisultatoTesto {
  const righe = testo.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  if (!/^ID;/i.test(righe[0] ?? '')) throw new Error(t('non è un file SYLK'));
  const f = nuovoFoglio('Foglio1');
  let y = 1;
  let x = 1;
  let vuoto = true;
  let formule = false;
  for (const r of righe.slice(1)) {
    if (!/^C;/i.test(r)) continue;
    let k: string | undefined;
    for (const campo of campiSlk(r).slice(1)) {
      const c = campo[0];
      const v = campo.slice(1);
      if (c === 'Y') { const n = parseInt(v, 10); if (n >= 1) y = n; }
      else if (c === 'X') { const n = parseInt(v, 10); if (n >= 1) x = n; }
      else if (c === 'K') k = v;
      else if (c === 'E') formule = true;
    }
    if (k === undefined) continue;
    if (y > MAX_ROWS || x > MAX_COLS) continue;
    vuoto = false;
    if (k.startsWith('"')) mettiCella(f, y, x, k.replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"'), true);
    else if (/^(TRUE|FALSE)$/i.test(k)) mettiCella(f, y, x, k.toUpperCase());
    else if (/^#/.test(k)) mettiCella(f, y, x, k, true);
    else { const n = Number(k); if (Number.isFinite(n)) mettiCella(f, y, x, String(n)); }
  }
  if (vuoto) throw new Error(t('il file non contiene dati'));
  const avvisi = formule ? [t('Le formule del file sono state importate come valori.')] : [];
  return { scambio: { fogli: [f], foglioAttivo: f.nome }, avvisi };
}
