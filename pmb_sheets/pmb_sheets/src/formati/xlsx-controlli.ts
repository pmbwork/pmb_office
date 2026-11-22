// Controlli modulo dei file di Excel (caselle combinate e pulsanti disegnati sopra il foglio, i «Form Controls»).
// - Casella combinata (objectType «Drop») non collegata a una cella: diventa una TENDINA DELLA CELLA che copre (convalida a elenco con lo
//   stesso intervallo di origine) e la voce scelta nel controllo si scrive nella cella, se è vuota. In Excel la scelta sta solo nel controllo.
// - Pulsante (objectType «Button»): si conservano posizione, testo e macro collegata; pmb_sheets esegue la macro solo se è fatta di azioni
//   sicure (vedi vba.ts).
// - Gli altri controlli (caselle di spunta, elenchi, pulsanti di opzione...) e le caselle combinate collegate a una cella si contano per l'avviso.
// Dove stanno: nel foglio <controls> (posizione nel <controlPr><anchor> dei file da Excel 2010), le proprietà in xl/ctrlProps/ctrlPropN.xml
// (formControlPr: tipo, intervallo, scelta, cella collegata), il testo dei pulsanti nel disegno VML del foglio (stesso numero di forma).
import type { NodoXml } from '@comune/formati/xml';
import { stileValido, type StilePulsante } from '../sheet/pulsanti';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from '../sheet/viewport';

const EMU = 9525;

export interface TendinaLetta { riga: number; colonna: number; elenco: string; scelta: number; collegata?: string }
export interface PulsanteLetto { x: number; y: number; width: number; height: number; testo: string; macro?: string; stile?: StilePulsante }
export interface ControlliLetti { tendine: TendinaLetta[]; pulsanti: PulsanteLetto[]; altri: number; collegate: number }

const locale = (nome: string): string => nome.slice(nome.indexOf(':') + 1);
const figli = (n: NodoXml | undefined): NodoXml[] => (n ? n.figli.filter((f): f is NodoXml => typeof f !== 'string') : []);
const figlio = (n: NodoXml | undefined, nome: string): NodoXml | undefined => figli(n).find((f) => locale(f.nome) === nome);
const testoNodo = (n: NodoXml | undefined): string => (n ? n.figli.map((f) => (typeof f === 'string' ? f : '')).join('').trim() : '');
const numero = (n: NodoXml | undefined): number => { const v = Number(testoNodo(n)); return Number.isFinite(v) ? v : 0; };
function discendenti(n: NodoXml, nome: string, out: NodoXml[] = [], profondita = 0): NodoXml[] {
  if (profondita > 8) return out;
  for (const f of figli(n)) { if (locale(f.nome) === nome) out.push(f); else discendenti(f, nome, out, profondita + 1); }
  return out;
}

const ENTITA: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificaEntita = (s: string): string => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ''; }
  return ENTITA[e.toLowerCase()] ?? m;
});

interface FormaVml { testo: string; macro?: string; tipo?: string; ancora?: number[]; stile?: StilePulsante }

/** Le forme del disegno VML per numero di forma (_x0000_s1041 → 1041). Il VML spesso non è XML valido: si legge con espressioni regolari. */
export function formeVml(vml: string): Map<number, FormaVml> {
  const forme = new Map<number, FormaVml>();
  for (const m of vml.matchAll(/<v:shape\b([^>]*)>([\s\S]*?)<\/v:shape>/gi)) {
    const attributi = m[1] ?? ''; const corpo = m[2] ?? '';
    const id = attributi.match(/_x0000_s(\d+)/);
    if (!id) continue;
    const box = corpo.match(/<v:textbox\b[^>]*>([\s\S]*?)<\/v:textbox>/i);
    const testo = box ? decodificaEntita(box[1]!.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t\r]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim() : '';
    const macro = corpo.match(/<x:FmlaMacro>([\s\S]*?)<\/x:FmlaMacro>/i)?.[1]?.trim();
    const tipo = corpo.match(/<x:ClientData\s+ObjectType="(\w+)"/i)?.[1];
    const ancora = corpo.match(/<x:Anchor>([\s\S]*?)<\/x:Anchor>/i)?.[1]?.split(',').map((x) => Number(x.trim()));
    // aspetto del testo: il primo <font> del riquadro (size in ventesimi di punto), grassetto, corsivo, sottolineato, scritta verticale
    const interno = box?.[1] ?? '';
    const font = interno.match(/<font\b([^>]*)>/i)?.[1] ?? '';
    const dimensione = Number(font.match(/\bsize="(\d+)"/i)?.[1]) / 20;
    const stile = stileValido({
      colore: font.match(/\bcolor="(#[0-9a-f]{6})"/i)?.[1],
      grassetto: /<b>/i.test(interno), corsivo: /<i>/i.test(interno), sottolineato: /<u>/i.test(interno),
      dimensione: Number.isFinite(dimensione) ? dimensione : undefined,
      verticale: /layout-flow:\s*vertical/i.test(corpo),
    });
    forme.set(Number(id[1]), { testo: testo.slice(0, 200), ...(macro ? { macro: decodificaEntita(macro) } : {}), ...(tipo ? { tipo } : {}), ...(ancora && ancora.length === 8 && ancora.every(Number.isFinite) ? { ancora } : {}), ...(stile ? { stile } : {}) });
  }
  return forme;
}

/** L'elenco <controls> del foglio: nei file da Excel 2010 in poi sta dentro <mc:AlternateContent><mc:Choice Requires="x14">. */
export function elencoControlli(radice: NodoXml | undefined): NodoXml | undefined {
  if (!radice) return undefined;
  return figlio(radice, 'controls') ?? discendenti(radice, 'controls', [], 5)[0];
}

/**
 * I controlli modulo di un foglio.
 * @param radice il foglio (worksheet)
 * @param proprieta per id di relazione del foglio, il formControlPr del controllo (già letto da xl/ctrlProps)
 * @param vml il testo del disegno VML del foglio (per testo e macro dei pulsanti), se c'è
 */
export function leggiControlli(radice: NodoXml | undefined, proprieta: (idRelazione: string) => NodoXml | undefined, vml: string | undefined,
  foglio: { larghezze: Record<number, number>; altezze: Record<number, number> }): ControlliLetti {
  const esito: ControlliLetti = { tendine: [], pulsanti: [], altri: 0, collegate: 0 };
  const controlli = elencoControlli(radice);
  if (!controlli) return esito;
  const forme = vml ? formeVml(vml) : new Map<number, FormaVml>();
  const larg = (c: number): number => foglio.larghezze[c] ?? DEFAULT_COL_WIDTH;
  const alt = (r: number): number => foglio.altezze[r] ?? DEFAULT_ROW_HEIGHT;
  const xDi = (col0: number, scostPx: number): number => { let x = scostPx; for (let k = 1; k <= col0; k++) x += larg(k); return x; };
  const yDi = (riga0: number, scostPx: number): number => { let y = scostPx; for (let k = 1; k <= riga0; k++) y += alt(k); return y; };
  // la cella che contiene un punto (colonne e righe da 1)
  const cellaDi = (x: number, y: number): { riga: number; colonna: number } => {
    let c = 1; let acc = 0; while (c < 16384 && acc + larg(c) <= x) { acc += larg(c); c++; }
    let r = 1; acc = 0; while (r < 1048576 && acc + alt(r) <= y) { acc += alt(r); r++; }
    return { riga: r, colonna: c };
  };
  const visti = new Set<string>();
  for (const c of discendenti(controlli, 'control')) {
    const id = c.attributi['r:id'];
    const forma = Number(c.attributi.shapeId);
    if (id === undefined || visti.has(id)) continue; // la stessa voce ripetuta nel «Fallback» dei file da Excel 2010
    visti.add(id);
    const pr = proprieta(id);
    const tipo = pr?.attributi.objectType ?? forme.get(forma)?.tipo;
    // posizione: dall'anchor del controlPr (EMU) o, nei file più vecchi, dall'ancora del VML (colonna, px, riga, px)
    const ancora = figlio(figlio(c, 'controlPr'), 'anchor');
    let x0: number, y0: number, x1: number, y1: number;
    if (ancora) {
      const da = figlio(ancora, 'from'); const a = figlio(ancora, 'to');
      x0 = xDi(numero(figlio(da, 'col')), numero(figlio(da, 'colOff')) / EMU); y0 = yDi(numero(figlio(da, 'row')), numero(figlio(da, 'rowOff')) / EMU);
      x1 = xDi(numero(figlio(a, 'col')), numero(figlio(a, 'colOff')) / EMU); y1 = yDi(numero(figlio(a, 'row')), numero(figlio(a, 'rowOff')) / EMU);
    } else {
      const v = forme.get(forma)?.ancora;
      if (!v) { esito.altri++; continue; }
      x0 = xDi(v[0]!, v[1]!); y0 = yDi(v[2]!, v[3]!); x1 = xDi(v[4]!, v[5]!); y1 = yDi(v[6]!, v[7]!);
    }
    if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) { esito.altri++; continue; }
    if (tipo === 'Drop') {
      const elenco = (pr?.attributi.fmlaRange ?? '').trim();
      const collegata = pr?.attributi.fmlaLink?.trim();
      if (!elenco) { esito.altri++; continue; }
      if (collegata) { esito.collegate++; continue; }
      const { riga, colonna } = cellaDi((x0 + x1) / 2, (y0 + y1) / 2);
      const scelta = Math.max(0, Math.floor(Number(pr?.attributi.sel ?? 0)) || 0);
      esito.tendine.push({ riga, colonna, elenco, scelta });
    } else if (tipo === 'Button') {
      const f = forme.get(forma);
      const macro = (figlio(c, 'controlPr')?.attributi.macro ?? f?.macro)?.trim();
      esito.pulsanti.push({ x: Math.round(x0), y: Math.round(y0), width: Math.max(16, Math.round(x1 - x0)), height: Math.max(12, Math.round(y1 - y0)), testo: f?.testo ?? '', ...(macro ? { macro } : {}), ...(f?.stile ? { stile: f.stile } : {}) });
    } else {
      esito.altri++;
    }
  }
  return esito;
}

/** Un intervallo come «dati!$A$1:$A$12» o «$A$1:$A$12» (foglio del controllo): nome del foglio e celle da 1. */
export function leggiIntervallo(testo: string, foglioPredefinito: string): { foglio: string; da: { riga: number; colonna: number }; a: { riga: number; colonna: number } } | null {
  const m = testo.trim().replace(/^=/, '').match(/^(?:(?:'((?:[^']|'')+)'|([^!'\s]+))!)?\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?$/);
  if (!m) return null;
  const colonna = (l: string): number => [...l.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const foglio = m[1] !== undefined ? m[1].replace(/''/g, "'") : (m[2] ?? foglioPredefinito);
  const da = { riga: Number(m[4]), colonna: colonna(m[3]!) };
  const a = m[5] ? { riga: Number(m[6]), colonna: colonna(m[5]) } : da;
  if (a.riga < da.riga || a.colonna < da.colonna || (a.riga - da.riga + 1) * (a.colonna - da.colonna + 1) > 10000) return null;
  return { foglio, da, a };
}
