// Formattazioni condizionali in un file .ods (scritto per pmb_office). Puro: testo XML in entrata e in uscita.
// Si scrivono come le scrive LibreOffice (modello: un file salvato da LibreOffice 7):
//  - `calcext:conditional-formats` dentro ogni `table:table`, dopo le righe: condizioni sui valori, sui testi e con formula, scale di colore,
//    barre dei dati e set di icone. È la forma che LibreOffice legge.
//  - per le regole semplici (valore della cella, testo, formula) anche la forma base di OpenDocument: un `style:map` nello stile di ogni
//    cella dell'intervallo, che leggono anche i programmi che non conoscono la forma di LibreOffice. LibreOffice, se trova la sua forma,
//    usa quella (scrive anche lui tutte e due).
// Gli stili applicati dalle condizioni sono stili con nome in styles.xml (`office:styles`).
// Si legge la forma di LibreOffice; le regole sulle date (solo dai file Excel) non si scrivono.
import { elemento, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { MAX_COLS, MAX_ROWS, columnIndexToLetters, parseCellAddress } from '../engine/address';
import type { ConditionalFormatRule, Soglia, SoglieRegola, TipoSoglia } from '../sheet/conditional-format';
import type { FoglioScambio } from './scambio';

type StileCondizionale = NonNullable<ConditionalFormatRule['style']>;
type Area = ConditionalFormatRule['range'];

const intero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const coloreValido = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const quota = (foglio: string): string => `'${foglio.replace(/'/g, "''")}'`;
const virgolette = (t: string): string => `"${t.replace(/"/g, '""')}"`;
/** Al massimo tante celle per foglio ricevono il `style:map` (un intervallo enorme resta solo nella forma di LibreOffice). */
const MAX_CELLE_MAPPA = 100000;

function areaValida(a: Area | undefined): a is Area {
  return !!a && intero(a.startRow, 1, MAX_ROWS) && intero(a.endRow, a.startRow, MAX_ROWS) && intero(a.startCol, 1, MAX_COLS) && intero(a.endCol, a.startCol, MAX_COLS);
}
const cella = (r: number, c: number): string => `${columnIndexToLetters(c)}${r}`;

// ---- stili con nome applicati dalle condizioni ----

/** Gli stili con nome (in styles.xml) che le condizioni applicano: uno per ogni stile diverso. */
export class StiliCondizionali {
  readonly voci: string[] = [];
  private readonly nomi = new Map<string, string>();
  nome(s: StileCondizionale | undefined): string {
    const st = s ?? {};
    const cella = elemento('style:table-cell-properties', { 'fo:background-color': coloreValido(st.backgroundColor) ? st.backgroundColor.toLowerCase() : undefined });
    const testo = elemento('style:text-properties', {
      'fo:color': coloreValido(st.textColor) ? st.textColor.toLowerCase() : undefined,
      'fo:font-weight': st.bold ? 'bold' : undefined, 'fo:font-style': st.italic ? 'italic' : undefined,
      'style:text-underline-style': st.underline ? 'solid' : undefined, 'style:text-underline-width': st.underline ? 'auto' : undefined, 'style:text-underline-color': st.underline ? 'font-color' : undefined,
    });
    const figli = [cella, testo].filter((x) => x !== '<style:table-cell-properties/>' && x !== '<style:text-properties/>');
    const chiave = figli.join('');
    let nome = this.nomi.get(chiave);
    if (!nome) {
      nome = `pmbCondizione${this.voci.length + 1}`;
      this.voci.push(elemento('style:style', { 'style:name': nome, 'style:family': 'table-cell' }, figli));
      this.nomi.set(chiave, nome);
    }
    return nome;
  }
}

// ---- scrittura ----

const OPERATORE: Record<string, string> = { greater_than: '>', greater_equal: '>=', less_than: '<', less_equal: '<=', equal_to: '=', not_equal_to: '!=' };

/** Un valore di confronto come espressione: numero così com'è, altrimenti testo tra virgolette. */
function valore(v: unknown): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const t = String(v).trim();
  return /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) ? t : virgolette(t);
}

/** La condizione di una regola semplice: per LibreOffice (`calcext:value`) e per OpenDocument (`style:condition`), o null. */
function condizione(r: ConditionalFormatRule, espressione: (formula: string) => string): { calcext: string; mappa: string } | null {
  const cima = `[.${cella(r.range.startRow, r.range.startCol)}]`;
  if (r.type === 'cell_value') {
    const op = r.operator ?? 'greater_than';
    const a = valore(r.value1);
    if (a === null) return null;
    if (op === 'between' || op === 'not_between') {
      const b = valore(r.value2);
      if (b === null) return null;
      return op === 'between'
        ? { calcext: `between(${a},${b})`, mappa: `cell-content-is-between(${a},${b})` }
        : { calcext: `not-between(${a},${b})`, mappa: `cell-content-is-not-between(${a},${b})` };
    }
    const segno = OPERATORE[op];
    return segno ? { calcext: `${segno}${a}`, mappa: `cell-content()${segno}${a}` } : null;
  }
  if (r.type === 'text') {
    const op = r.operator ?? 'contains';
    const q = String(r.value1 ?? '');
    const formula = (f: string): { calcext: string; mappa: string } => ({ calcext: `formula-is(${f})`, mappa: `is-true-formula(${f})` });
    if (op === 'empty') return formula(`LEN(TRIM(${cima}))=0`);
    if (op === 'not_empty') return formula(`LEN(TRIM(${cima}))>0`);
    if (q === '') return null;
    const v = virgolette(q);
    if (op === 'contains') return { calcext: `contains-text(${v})`, mappa: `is-true-formula(NOT(ISERROR(SEARCH(${v};${cima}))))` };
    if (op === 'not_contains') return { calcext: `not-contains-text(${v})`, mappa: `is-true-formula(ISERROR(SEARCH(${v};${cima})))` };
    if (op === 'starts_with') return { calcext: `begins-with(${v})`, mappa: `is-true-formula(LEFT(${cima};LEN(${v}))=${v})` };
    if (op === 'ends_with') return { calcext: `ends-with(${v})`, mappa: `is-true-formula(RIGHT(${cima};LEN(${v}))=${v})` };
    return null;
  }
  if (r.type === 'formula') {
    const f = String(r.value1 ?? '').trim().replace(/^=/, '');
    if (f === '') return null;
    const e = espressione(f);
    return { calcext: `formula-is(${e})`, mappa: `is-true-formula(${e})` };
  }
  return null;
}

const TIPO_SOGLIA: Record<TipoSoglia, string> = { min: 'minimum', max: 'maximum', numero: 'number', percentuale: 'percent', percentile: 'percentile' };
function voceSoglia(nome: string, s: Soglia | undefined, predefinita: Soglia, extra: Record<string, string> = {}): string {
  const x = s ?? predefinita;
  return elemento(nome, { 'calcext:value': x.tipo === 'min' || x.tipo === 'max' ? '0' : String(x.valore ?? 0), 'calcext:type': TIPO_SOGLIA[x.tipo], ...extra });
}

export interface CondizionaliFoglio {
  /** `calcext:conditional-formats` da mettere in fondo a `table:table`, o null se il foglio non ne ha */
  xml: string | null;
  /** per cella ("riga,colonna") i `style:map` da mettere nel suo stile */
  mappe: Map<string, string[]>;
}

/**
 * Le formattazioni condizionali di un foglio. `nomeNelFile` è il nome del foglio nel file; `espressione` traduce una formula del foglio
 * (senza "=") in OpenFormula (riferimenti come [.A1], argomenti separati da ;).
 */
export function condizionaliOds(f: FoglioScambio, nomeNelFile: string, stili: StiliCondizionali, espressione: (formula: string) => string): CondizionaliFoglio {
  const mappe = new Map<string, string[]>();
  let celleMappa = 0;
  const gruppi: Array<{ area: Area; voci: string[] }> = [];
  const q = quota(nomeNelFile);
  const rif = (a: Area): string => `${q}.${cella(a.startRow, a.startCol)}:${q}.${cella(a.endRow, a.endCol)}`;
  for (const r of f.condizionali ?? []) {
    if (!areaValida(r.range)) continue;
    const a = r.range;
    let voce: string | null = null;
    const semplice = condizione(r, espressione);
    if (semplice) {
      const nome = stili.nome(r.style);
      const base = `${q}.${cella(a.startRow, a.startCol)}`;
      voce = elemento('calcext:condition', { 'calcext:apply-style-name': nome, 'calcext:value': semplice.calcext, 'calcext:base-cell-address': base });
      const celle = (a.endRow - a.startRow + 1) * (a.endCol - a.startCol + 1);
      if (celleMappa + celle <= MAX_CELLE_MAPPA) {
        celleMappa += celle;
        const mappa = elemento('style:map', { 'style:condition': semplice.mappa, 'style:apply-style-name': nome, 'style:base-cell-address': base });
        for (let riga = a.startRow; riga <= a.endRow; riga++) for (let col = a.startCol; col <= a.endCol; col++) {
          const k = `${riga},${col}`;
          const l = mappe.get(k);
          if (l) l.push(mappa); else mappe.set(k, [mappa]);
        }
      }
    } else if (r.type === 'color_scale' && r.colorScale && coloreValido(r.colorScale.minColor) && coloreValido(r.colorScale.maxColor) && (r.colorScale.midColor === undefined || coloreValido(r.colorScale.midColor))) {
      const cs = r.colorScale;
      const s = cs.soglie;
      voce = elemento('calcext:color-scale', {}, [
        voceSoglia('calcext:color-scale-entry', s?.min, { tipo: 'min' }, { 'calcext:color': cs.minColor.toLowerCase() }),
        ...(cs.midColor ? [voceSoglia('calcext:color-scale-entry', s?.mid, { tipo: 'percentile', valore: 50 }, { 'calcext:color': cs.midColor.toLowerCase() })] : []),
        voceSoglia('calcext:color-scale-entry', s?.max, { tipo: 'max' }, { 'calcext:color': cs.maxColor.toLowerCase() }),
      ]);
    } else if (r.type === 'data_bar' && r.dataBar && coloreValido(r.dataBar.color)) {
      // la barra come la disegna la griglia: piena, da 0 al 100% della cella, senza asse
      voce = elemento('calcext:data-bar', {
        'calcext:min-length': '0', 'calcext:max-length': '100', 'calcext:gradient': 'false', 'calcext:negative-color': '#ff0000', 'calcext:axis-position': 'none',
        'calcext:positive-color': r.dataBar.color.toLowerCase(), 'calcext:axis-color': '#000000',
      }, [voceSoglia('calcext:formatting-entry', r.dataBar.soglie?.min, { tipo: 'min' }), voceSoglia('calcext:formatting-entry', r.dataBar.soglie?.max, { tipo: 'max' })]);
    } else if (r.type === 'icon_set' && r.iconSet) {
      // tre fasce uguali dell'intervallo, come quelle che disegna la griglia
      voce = elemento('calcext:icon-set', { 'calcext:icon-set-type': r.iconSet.type === 'arrows' ? '3Arrows' : '3TrafficLights1' },
        [0, 33, 67].map((v) => elemento('calcext:formatting-entry', { 'calcext:value': String(v), 'calcext:type': 'percent' })));
    }
    if (voce === null) continue;
    // condizioni consecutive sullo stesso intervallo nello stesso blocco, come LibreOffice; scale, barre e icone hanno un blocco loro
    const ultimo = gruppi[gruppi.length - 1];
    const stessa = ultimo && semplice && ultimo.voci.every((v) => v.startsWith('<calcext:condition '))
      && ultimo.area.startRow === a.startRow && ultimo.area.endRow === a.endRow && ultimo.area.startCol === a.startCol && ultimo.area.endCol === a.endCol;
    if (stessa) ultimo.voci.push(voce);
    else gruppi.push({ area: a, voci: [voce] });
  }
  const xml = gruppi.length === 0 ? null : elemento('calcext:conditional-formats', {}, gruppi.map((g) => elemento('calcext:conditional-format', { 'calcext:target-range-address': rif(g.area) }, g.voci)));
  return { xml, mappe };
}

/** Le parti delle formattazioni condizionali che il file .ods non conserva (per l'avviso a chi salva). */
export function condizionaliPerseOds(f: FoglioScambio): boolean {
  return (f.condizionali ?? []).some((r) => r.type === 'date');
}

// ---- lettura ----

/** Divide al primo livello (fuori da virgolette e parentesi) con il separatore dato. */
function dividi(t: string, separatore: string): string[] {
  const parti: string[] = [];
  let livello = 0, dentro = false, inizio = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') dentro = !dentro;
    else if (!dentro && (ch === '(' || ch === '[')) livello++;
    else if (!dentro && (ch === ')' || ch === ']')) livello--;
    else if (!dentro && livello === 0 && ch === separatore) { parti.push(t.slice(inizio, i)); inizio = i + 1; }
  }
  parti.push(t.slice(inizio));
  return parti.map((p) => p.trim());
}

/** Le aree di un `calcext:target-range-address` ("'Foglio 1'.A1:'Foglio 1'.B9 Foglio2.C3"). */
export function areeDaOds(indirizzi: string): Area[] {
  const pezzi: string[] = [];
  let corrente = '', dentro = false;
  for (const ch of indirizzi) {
    if (ch === "'") dentro = !dentro;
    if (ch === ' ' && !dentro) { if (corrente) pezzi.push(corrente); corrente = ''; } else corrente += ch;
  }
  if (corrente) pezzi.push(corrente);
  const aree: Area[] = [];
  for (const p of pezzi) {
    const capi: string[] = [];
    let parte = '', d = false;
    for (const ch of p) { if (ch === "'") d = !d; if (ch === ':' && !d) { capi.push(parte); parte = ''; } else parte += ch; }
    capi.push(parte);
    const celle = capi.map((x) => {
      let ultimoPunto = -1, dd = false;
      for (let i = 0; i < x.length; i++) { if (x[i] === "'") dd = !dd; else if (x[i] === '.' && !dd) ultimoPunto = i; }
      return parseCellAddress(x.slice(ultimoPunto + 1).replace(/\$/g, ''));
    });
    const a = celle[0], b = celle[celle.length - 1];
    if (!a || !b || celle.length > 2) continue;
    aree.push({ startRow: Math.min(a.row, b.row), endRow: Math.max(a.row, b.row), startCol: Math.min(a.col, b.col), endCol: Math.max(a.col, b.col) });
  }
  return aree;
}

const OPERATORE_LETTO: Record<string, string> = { '>': 'greater_than', '>=': 'greater_equal', '<': 'less_than', '<=': 'less_equal', '=': 'equal_to', '!=': 'not_equal_to' };
const numero = (t: string | undefined): number | undefined => (t !== undefined && t.trim() !== '' && Number.isFinite(Number(t)) ? Number(t) : undefined);
// il testo tra le virgolette esterne; LibreOffice, risalvando, non raddoppia le virgolette interne ("a"b" invece di "a""b"): vanno bene tutte e due
const testoTra = (t: string): string | undefined => { const m = /^"(.*)"$/s.exec(t.trim()); return m ? m[1].replace(/""/g, '"') : undefined; };

/** Da `calcext:value` alla regola (senza intervallo e stile), o null se è una condizione che il foglio non conosce. */
export function condizioneDaOds(v: string, formula: (espressione: string) => string): Omit<ConditionalFormatRule, 'id' | 'range'> | null {
  const t = v.trim();
  let m = /^(between|not-between)\((.*)\)$/.exec(t);
  if (m) {
    const [a, b, ...resto] = dividi(m[2], ',');
    const x = numero(a), y = numero(b);
    return x !== undefined && y !== undefined && resto.length === 0 ? { type: 'cell_value', operator: m[1] === 'between' ? 'between' : 'not_between', value1: x, value2: y } : null;
  }
  m = /^(contains-text|not-contains-text|begins-with|ends-with)\((.*)\)$/.exec(t);
  if (m) {
    const q = testoTra(m[2]);
    const op = { 'contains-text': 'contains', 'not-contains-text': 'not_contains', 'begins-with': 'starts_with', 'ends-with': 'ends_with' }[m[1]];
    return q !== undefined ? { type: 'text', operator: op, value1: q } : null;
  }
  m = /^formula-is\((.*)\)$/.exec(t);
  if (m) {
    const vuota = /^LEN\(TRIM\(\[\.\$?[A-Z]{1,3}\$?\d+\]\)\)(=0|>0)$/.exec(m[1].trim());
    if (vuota) return { type: 'text', operator: vuota[1] === '=0' ? 'empty' : 'not_empty' };
    return { type: 'formula', value1: formula(m[1]) };
  }
  m = /^(!=|<=|>=|=|<|>)(.*)$/.exec(t);
  if (m) {
    const x = numero(m[2]);
    return x !== undefined ? { type: 'cell_value', operator: OPERATORE_LETTO[m[1]], value1: x } : null;
  }
  return null;
}

const TIPO_SOGLIA_LETTO: Record<string, TipoSoglia> = { minimum: 'min', 'auto-minimum': 'min', maximum: 'max', 'auto-maximum': 'max', number: 'numero', percent: 'percentuale', percentile: 'percentile' };
/** Una soglia letta: undefined se è quella di partenza, null se non si sa leggere (per esempio una formula). */
function sogliaLetta(n: NodoXml | undefined, predefinita: Soglia): Soglia | undefined | null {
  const tipo = n ? TIPO_SOGLIA_LETTO[n.attributi['calcext:type'] ?? ''] : undefined;
  if (!tipo) return null;
  if (tipo === 'min' || tipo === 'max') return tipo === predefinita.tipo ? undefined : { tipo };
  const v = Number(n!.attributi['calcext:value']);
  if (!Number.isFinite(v)) return null;
  return tipo === predefinita.tipo && v === predefinita.valore ? undefined : { tipo, valore: v };
}
function soglie(min: Soglia | undefined, mid: Soglia | undefined, max: Soglia | undefined): { soglie?: SoglieRegola } {
  const s: SoglieRegola = { ...(min ? { min } : {}), ...(mid ? { mid } : {}), ...(max ? { max } : {}) };
  return Object.keys(s).length > 0 ? { soglie: s } : {};
}

/**
 * Le formattazioni condizionali di una `table:table` (forma di LibreOffice). `stile` dà lo stile di un nome di `calcext:apply-style-name`;
 * `formula` traduce un'espressione OpenFormula in una formula del foglio ("=..."). Le voci che non si sanno leggere si contano.
 */
export function leggiCondizionaliOds(tabella: NodoXml, stile: (nome: string) => StileCondizionale | undefined, formula: (espressione: string) => string): { regole: ConditionalFormatRule[]; nonImportate: number } {
  const regole: ConditionalFormatRule[] = [];
  let nonImportate = 0;
  const gruppo = trova(tabella, 'calcext:conditional-formats');
  for (const cf of gruppo ? figliElemento(gruppo, 'calcext:conditional-format') : []) {
    const aree = areeDaOds(cf.attributi['calcext:target-range-address'] ?? '');
    for (const voce of cf.figli) {
      if (typeof voce === 'string') continue;
      let base: Omit<ConditionalFormatRule, 'id' | 'range'> | null = null;
      if (voce.nome === 'calcext:condition') {
        base = condizioneDaOds(voce.attributi['calcext:value'] ?? '', formula);
        if (base) { const s = stile(voce.attributi['calcext:apply-style-name'] ?? ''); if (s && Object.keys(s).length > 0) base.style = s; }
      } else if (voce.nome === 'calcext:color-scale') {
        const e = figliElemento(voce, 'calcext:color-scale-entry');
        const colori = e.map((x) => x.attributi['calcext:color']);
        if ((e.length === 2 || e.length === 3) && colori.every(coloreValido)) {
          const tre = e.length === 3;
          const min = sogliaLetta(e[0], { tipo: 'min' }), mid = tre ? sogliaLetta(e[1], { tipo: 'percentile', valore: 50 }) : undefined, max = sogliaLetta(e[tre ? 2 : 1], { tipo: 'max' });
          if (min !== null && mid !== null && max !== null) {
            const c = colori.map((x) => (x as string).toLowerCase());
            base = { type: 'color_scale', colorScale: { ...(tre ? { minColor: c[0], midColor: c[1], maxColor: c[2] } : { minColor: c[0], maxColor: c[1] }), ...soglie(min, mid, max) } };
          }
        }
      } else if (voce.nome === 'calcext:data-bar') {
        const e = figliElemento(voce, 'calcext:formatting-entry');
        const colore = voce.attributi['calcext:positive-color'];
        const min = sogliaLetta(e[0], { tipo: 'min' }), max = sogliaLetta(e[1], { tipo: 'max' });
        if (coloreValido(colore) && e.length === 2 && min !== null && max !== null) base = { type: 'data_bar', dataBar: { color: colore.toLowerCase(), ...soglie(min, undefined, max) } };
      } else if (voce.nome === 'calcext:icon-set') {
        // si leggono solo i due set che la griglia sa disegnare (sempre a tre fasce uguali)
        const nome = voce.attributi['calcext:icon-set-type'] ?? '';
        if (nome === '3Arrows' || nome === '3ArrowsGray') base = { type: 'icon_set', iconSet: { type: 'arrows' } };
        else if (nome === '3TrafficLights1' || nome === '3TrafficLights2') base = { type: 'icon_set', iconSet: { type: 'traffic_lights' } };
      } else continue;
      if (!base || aree.length === 0) { nonImportate++; continue; }
      for (const area of aree) regole.push({ id: '', range: { ...area }, ...JSON.parse(JSON.stringify(base)) } as ConditionalFormatRule);
    }
  }
  return { regole, nonImportate };
}

