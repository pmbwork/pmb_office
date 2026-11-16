// Dati delle finestre Formattazione condizionale e Convalida dei dati di pmb_sheets: dal testo scritto dall'utente alla regola per il motore.
// Regole precise: LAVORO/compiti/T325/compito.md.
import { parseRangeAddress, parseCellAddress, columnIndexToLetters } from '../engine/address';
import type { ConditionalFormatRule, Soglia, SoglieRegola, TipoSoglia } from './conditional-format';
import { parseListItems, type DataValidationRule, type ValidationOperator } from './data-validation';
import { t } from '../i18n/lingua';

export interface Intervallo { startRow: number; endRow: number; startCol: number; endCol: number }
export type Esito<T> = { ok: true; valore: T } | { ok: false; errore: string };

const COLORE = /^#[0-9a-fA-F]{6}$/;
const CELLA = /^[A-Za-z]{1,3}[1-9][0-9]{0,6}$/;
/** La convalida si scrive cella per cella: oltre questo numero di celle non la accetta. */
export const CELLE_MASSIME_CONVALIDA = 10000;

/** "A1:B5" oppure "B2" (anche in minuscolo, anche con i due estremi al contrario): l'intervallo, o null se non si capisce. */
export function leggiIntervallo(testo: string): Intervallo | null {
  const t = testo.trim();
  const parti = t.split(':');
  if (parti.length > 2 || !parti.every((x) => CELLA.test(x))) return null;
  const r = parseRangeAddress(parti.length === 1 ? `${t}:${t}` : t);
  if (!r) return null;
  return { startRow: r.startRow, endRow: r.endRow, startCol: r.startCol, endCol: r.endCol };
}

/** L'intervallo come si scrive: "B2" se è una cella sola, altrimenti "A1:B5". */
export function scriviIntervallo(i: Intervallo): string {
  const inizio = `${columnIndexToLetters(i.startCol)}${i.startRow}`;
  if (i.startRow === i.endRow && i.startCol === i.endCol) return inizio;
  return `${inizio}:${columnIndexToLetters(i.endCol)}${i.endRow}`;
}

// ---- formattazione condizionale ----

export type Condizione =
  | 'maggiore' | 'maggiore-uguale' | 'minore' | 'minore-uguale' | 'uguale' | 'diverso' | 'tra'
  | 'contiene' | 'non-contiene' | 'inizia' | 'finisce' | 'vuota' | 'non-vuota'
  | 'formula'
  | 'scala-2' | 'scala-3' | 'barre' | 'frecce' | 'semafori';

/** Le condizioni che non scelgono uno stile ma disegnano nella cella (scale di colore, barre, icone). */
export function eGrafica(c: Condizione): boolean {
  return c === 'scala-2' || c === 'scala-3' || c === 'barre' || c === 'frecce' || c === 'semafori';
}

/** Le condizioni nell'ordine in cui si mostrano; `valori` dice quanti valori servono. */
export const CONDIZIONI: Array<{ id: Condizione; etichetta: string; valori: 0 | 1 | 2 }> = [
  { id: 'maggiore', etichetta: 'Maggiore di', valori: 1 },
  { id: 'maggiore-uguale', etichetta: 'Maggiore o uguale a', valori: 1 },
  { id: 'minore', etichetta: 'Minore di', valori: 1 },
  { id: 'minore-uguale', etichetta: 'Minore o uguale a', valori: 1 },
  { id: 'uguale', etichetta: 'Uguale a', valori: 1 },
  { id: 'diverso', etichetta: 'Diverso da', valori: 1 },
  { id: 'tra', etichetta: 'Compreso tra', valori: 2 },
  { id: 'contiene', etichetta: 'Il testo contiene', valori: 1 },
  { id: 'non-contiene', etichetta: 'Il testo non contiene', valori: 1 },
  { id: 'inizia', etichetta: 'Il testo inizia con', valori: 1 },
  { id: 'finisce', etichetta: 'Il testo finisce con', valori: 1 },
  { id: 'vuota', etichetta: 'La cella è vuota', valori: 0 },
  { id: 'non-vuota', etichetta: 'La cella non è vuota', valori: 0 },
  { id: 'formula', etichetta: 'La formula è vera', valori: 1 },
  { id: 'scala-2', etichetta: 'Scala di colore a due toni', valori: 0 },
  { id: 'scala-3', etichetta: 'Scala di colore a tre toni', valori: 0 },
  { id: 'barre', etichetta: 'Barre dati', valori: 0 },
  { id: 'frecce', etichetta: 'Icone: frecce', valori: 0 },
  { id: 'semafori', etichetta: 'Icone: semafori', valori: 0 },
];

const OPERATORE_NUMERICO: Record<string, string> = {
  'maggiore': 'greater_than', 'maggiore-uguale': 'greater_equal', 'minore': 'less_than', 'minore-uguale': 'less_equal',
  'uguale': 'equal_to', 'diverso': 'not_equal_to', 'tra': 'between',
};
const OPERATORE_TESTO: Record<string, string> = {
  'contiene': 'contains', 'non-contiene': 'not_contains', 'inizia': 'starts_with', 'finisce': 'ends_with', 'vuota': 'empty', 'non-vuota': 'not_empty',
};

export interface DatiCondizionale {
  intervallo: string;
  condizione: Condizione;
  valore1: string;
  valore2: string;
  /** colore di sfondo "#rrggbb", oppure vuoto */
  sfondo: string;
  /** colore del testo "#rrggbb", oppure vuoto */
  testo: string;
  grassetto: boolean;
  /** per le scale di colore e le barre dati: "#rrggbb" (il medio solo per la scala a tre toni, la barra usa il massimo) */
  coloreMin?: string;
  coloreMid?: string;
  coloreMax?: string;
  /** per le scale di colore e le barre dati: come si fissano minimo, punto medio (solo scala a tre toni) e massimo */
  soglie?: { min?: SogliaScritta; mid?: SogliaScritta; max?: SogliaScritta };
}

export interface SogliaScritta { tipo: TipoSoglia; valore: string }

/** Le scelte per ciascun estremo, nell'ordine in cui si mostrano. */
export const TIPI_SOGLIA: Record<'min' | 'mid' | 'max', Array<{ id: TipoSoglia; etichetta: string }>> = {
  min: [{ id: 'min', etichetta: 'Valore più basso' }, { id: 'numero', etichetta: 'Numero' }, { id: 'percentuale', etichetta: 'Percentuale' }, { id: 'percentile', etichetta: 'Percentile' }],
  mid: [{ id: 'percentile', etichetta: 'Percentile' }, { id: 'percentuale', etichetta: 'Percentuale' }, { id: 'numero', etichetta: 'Numero' }],
  max: [{ id: 'max', etichetta: 'Valore più alto' }, { id: 'numero', etichetta: 'Numero' }, { id: 'percentuale', etichetta: 'Percentuale' }, { id: 'percentile', etichetta: 'Percentile' }],
};
const NOME_ESTREMO = { min: 'il minimo', mid: 'il punto medio', max: 'il massimo' };

/** Le soglie scritte nella finestra come le vuole la regola; si tengono solo quelle diverse da quelle di partenza. */
function leggiSoglie(scritte: DatiCondizionale['soglie'], conMedio: boolean): Esito<SoglieRegola | undefined> {
  const out: SoglieRegola = {};
  for (const estremo of ['min', 'mid', 'max'] as const) {
    if (estremo === 'mid' && !conMedio) continue;
    const s = scritte?.[estremo];
    if (!s || s.tipo === 'min' || s.tipo === 'max') continue;
    const v = numero(s.valore);
    if (v === null) return { ok: false, errore: t("Scrivi un numero per {}", t(NOME_ESTREMO[estremo])) };
    if ((s.tipo === 'percentuale' || s.tipo === 'percentile') && (v < 0 || v > 100)) return { ok: false, errore: t("Per {} la percentuale va da 0 a 100", t(NOME_ESTREMO[estremo])) };
    if (estremo === 'mid' && s.tipo === 'percentile' && v === 50) continue;
    out[estremo] = { tipo: s.tipo, valore: v };
  }
  if (out.min?.tipo === 'numero' && out.max?.tipo === 'numero' && out.min.valore! >= out.max.valore!) return { ok: false, errore: t("Il minimo deve essere minore del massimo") };
  return { ok: true, valore: Object.keys(out).length > 0 ? out : undefined };
}

function numero(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** La regola di formattazione condizionale per i dati scritti nella finestra, oppure il motivo per cui non si può fare. */
export function creaRegolaCondizionale(d: DatiCondizionale, id: string): Esito<ConditionalFormatRule> {
  const intervallo = leggiIntervallo(d.intervallo);
  if (!intervallo) return { ok: false, errore: t("Intervallo non valido: scrivi per esempio A1:B10") };
  const cond = CONDIZIONI.find((c) => c.id === d.condizione);
  if (!cond) return { ok: false, errore: t("Scegli una condizione") };
  if (eGrafica(d.condizione)) {
    const regolaGrafica: ConditionalFormatRule = { id, type: 'icon_set', range: { ...intervallo } };
    if (d.condizione === 'frecce' || d.condizione === 'semafori') {
      regolaGrafica.iconSet = { type: d.condizione === 'frecce' ? 'arrows' : 'traffic_lights' };
      return { ok: true, valore: regolaGrafica };
    }
    const min = d.coloreMin ?? '', mid = d.coloreMid ?? '', max = d.coloreMax ?? '';
    const soglie = leggiSoglie(d.soglie, d.condizione === 'scala-3');
    if (!soglie.ok) return soglie;
    if (d.condizione === 'barre') {
      if (!COLORE.test(max)) return { ok: false, errore: t("Colore della barra non valido") };
      return { ok: true, valore: { id, type: 'data_bar', range: { ...intervallo }, dataBar: { color: max, ...(soglie.valore ? { soglie: soglie.valore } : {}) } } };
    }
    if (!COLORE.test(min) || !COLORE.test(max)) return { ok: false, errore: t("Scegli il colore del minimo e quello del massimo") };
    if (d.condizione === 'scala-3' && !COLORE.test(mid)) return { ok: false, errore: t("Scegli anche il colore del punto medio") };
    const colori = d.condizione === 'scala-3' ? { minColor: min, midColor: mid, maxColor: max } : { minColor: min, maxColor: max };
    return { ok: true, valore: { id, type: 'color_scale', range: { ...intervallo }, colorScale: { ...colori, ...(soglie.valore ? { soglie: soglie.valore } : {}) } } };
  }
  if (d.sfondo !== '' && !COLORE.test(d.sfondo)) return { ok: false, errore: t("Colore di sfondo non valido") };
  if (d.testo !== '' && !COLORE.test(d.testo)) return { ok: false, errore: t("Colore del testo non valido") };
  if (d.sfondo === '' && d.testo === '' && !d.grassetto) return { ok: false, errore: t("Scegli almeno uno stile: colore di sfondo, colore del testo o grassetto") };
  const stile: NonNullable<ConditionalFormatRule['style']> = {};
  if (d.sfondo !== '') stile.backgroundColor = d.sfondo;
  if (d.testo !== '') stile.textColor = d.testo;
  if (d.grassetto) stile.bold = true;
  const regola: ConditionalFormatRule = { id, type: 'cell_value', range: { ...intervallo }, style: stile };
  if (d.condizione === 'formula') {
    const f = d.valore1.trim().replace(/^=/, '');
    if (f === '') return { ok: false, errore: 'Scrivi la formula, per esempio =A1>25 (A1 è la prima cella dell\'intervallo)' };
    regola.type = 'formula';
    regola.value1 = '=' + f;
    return { ok: true, valore: regola };
  }
  if (d.condizione in OPERATORE_NUMERICO) {
    const v1 = numero(d.valore1);
    if (v1 === null) return { ok: false, errore: t("Scrivi un numero come valore") };
    regola.operator = OPERATORE_NUMERICO[d.condizione];
    regola.value1 = v1;
    if (cond.valori === 2) {
      const v2 = numero(d.valore2);
      if (v2 === null) return { ok: false, errore: t("Scrivi un numero anche come secondo valore") };
      if (v1 > v2) return { ok: false, errore: t("Il primo valore deve essere minore o uguale al secondo") };
      regola.value2 = v2;
    }
    return { ok: true, valore: regola };
  }
  regola.type = 'text';
  regola.operator = OPERATORE_TESTO[d.condizione];
  if (cond.valori === 1) {
    if (d.valore1.trim() === '') return { ok: false, errore: t("Scrivi il testo da cercare") };
    regola.value1 = d.valore1.trim();
  }
  return { ok: true, valore: regola };
}

/** Al contrario: i dati della finestra per una regola esistente (per modificarla), oppure null se la finestra non sa mostrarla. */
export function datiDaRegola(r: ConditionalFormatRule): DatiCondizionale | null {
  const vuoti = { intervallo: scriviIntervallo(r.range), valore1: '', valore2: '', sfondo: r.style?.backgroundColor ?? '', testo: r.style?.textColor ?? '', grassetto: !!r.style?.bold };
  const scritta = (s: Soglia | undefined, predefinita: TipoSoglia, valorePredefinito = ''): SogliaScritta => (s ? { tipo: s.tipo, valore: s.valore !== undefined ? String(s.valore) : '' } : { tipo: predefinita, valore: valorePredefinito });
  if (r.type === 'icon_set' && r.iconSet) return { ...vuoti, condizione: r.iconSet.type === 'arrows' ? 'frecce' : 'semafori' };
  if (r.type === 'data_bar' && r.dataBar) {
    return { ...vuoti, condizione: 'barre', coloreMax: r.dataBar.color, soglie: { min: scritta(r.dataBar.soglie?.min, 'min'), max: scritta(r.dataBar.soglie?.max, 'max') } };
  }
  if (r.type === 'color_scale' && r.colorScale) {
    const cs = r.colorScale;
    return {
      ...vuoti, condizione: cs.midColor ? 'scala-3' : 'scala-2', coloreMin: cs.minColor, coloreMid: cs.midColor, coloreMax: cs.maxColor,
      soglie: { min: scritta(cs.soglie?.min, 'min'), mid: scritta(cs.soglie?.mid, 'percentile', '50'), max: scritta(cs.soglie?.max, 'max') },
    };
  }
  if (r.type === 'formula') return { ...vuoti, condizione: 'formula', valore1: String(r.value1 ?? '') };
  if (r.type === 'cell_value') {
    const c = Object.keys(OPERATORE_NUMERICO).find((k) => OPERATORE_NUMERICO[k] === (r.operator ?? 'greater_than')) as Condizione | undefined;
    return c ? { ...vuoti, condizione: c, valore1: String(r.value1 ?? ''), valore2: r.value2 !== undefined ? String(r.value2) : '' } : null;
  }
  if (r.type === 'text') {
    const c = Object.keys(OPERATORE_TESTO).find((k) => OPERATORE_TESTO[k] === (r.operator ?? 'contains')) as Condizione | undefined;
    return c ? { ...vuoti, condizione: c, valore1: String(r.value1 ?? '') } : null;
  }
  return null;
}

/** Una riga che descrive la regola nell'elenco della finestra, per esempio "Maggiore di 10". */
export function descriviRegola(r: ConditionalFormatRule): string {
  const d = datiDaRegola(r);
  if (!d) return r.type === 'date' ? t("Regola su data (dal file)") : t("Regola non modificabile qui");
  const etichetta = t(CONDIZIONI.find((c) => c.id === d.condizione)?.etichetta ?? d.condizione);
  const quanti = CONDIZIONI.find((c) => c.id === d.condizione)?.valori ?? 0;
  if (quanti === 2) return t('{} {} e {}', etichetta, d.valore1, d.valore2);
  if (quanti === 1) return d.condizione === 'formula' ? `${etichetta}: ${d.valore1}` : `${etichetta} ${/^(contiene|non-contiene|inizia|finisce)$/.test(d.condizione) ? `"${d.valore1}"` : d.valore1}`;
  return etichetta;
}

// ---- convalida dei dati ----

export type TipoConvalida = 'elenco' | 'numero' | 'lunghezza' | 'casella';

export const TIPI_CONVALIDA: Array<{ id: TipoConvalida; etichetta: string }> = [
  { id: 'elenco', etichetta: 'Elenco di voci (o =A1:A10)' },
  { id: 'numero', etichetta: 'Numero' },
  { id: 'lunghezza', etichetta: 'Lunghezza del testo' },
  { id: 'casella', etichetta: 'Casella di controllo' },
];

/** Gli operatori per numero e lunghezza; `valori` dice quanti valori servono. */
export const OPERATORI_CONVALIDA: Array<{ id: ValidationOperator; etichetta: string; valori: 1 | 2 }> = [
  { id: 'between', etichetta: 'Compreso tra', valori: 2 },
  { id: 'not_between', etichetta: 'Non compreso tra', valori: 2 },
  { id: 'equal_to', etichetta: 'Uguale a', valori: 1 },
  { id: 'not_equal_to', etichetta: 'Diverso da', valori: 1 },
  { id: 'greater_than', etichetta: 'Maggiore di', valori: 1 },
  { id: 'greater_equal', etichetta: 'Maggiore o uguale a', valori: 1 },
  { id: 'less_than', etichetta: 'Minore di', valori: 1 },
  { id: 'less_equal', etichetta: 'Minore o uguale a', valori: 1 },
];

export interface DatiConvalida {
  intervallo: string;
  tipo: TipoConvalida;
  /** per l'elenco: le voci separate da virgola */
  voci: string;
  operatore: ValidationOperator;
  valore1: string;
  valore2: string;
  azione: 'rifiuta' | 'avvisa';
  /** testo da mostrare quando il valore non va bene, oppure vuoto per quello di default */
  messaggio: string;
  ammettiVuote: boolean;
}

/** `intervallo` è la prima area (per compatibilità); `aree` sono tutte quelle scritte, separate da virgola o punto e virgola. */
export interface ConvalidaPronta { intervallo: Intervallo; aree: Intervallo[]; regola: DataValidationRule }

/** "A1:A5, C1:C5" → le due aree; null se una non si capisce. */
export function leggiIntervalli(testo: string): Intervallo[] | null {
  const parti = testo.split(/[,;]/).map((x) => x.trim()).filter((x) => x !== '');
  if (parti.length === 0) return null;
  const aree: Intervallo[] = [];
  for (const p of parti) { const a = leggiIntervallo(p); if (!a) return null; aree.push(a); }
  return aree;
}

/** La regola di convalida, e dove si applica, per i dati scritti nella finestra; oppure il motivo per cui non si può fare. */
export function creaRegolaConvalida(d: DatiConvalida, id: string): Esito<ConvalidaPronta> {
  const aree = leggiIntervalli(d.intervallo);
  if (!aree) return { ok: false, errore: t("Intervallo non valido: scrivi per esempio A1:B10 (più aree separate da virgola)") };
  const intervallo = aree[0];
  if (aree.reduce((n, a) => n + (a.endRow - a.startRow + 1) * (a.endCol - a.startCol + 1), 0) > CELLE_MASSIME_CONVALIDA) {
    return { ok: false, errore: t("Intervallo troppo grande per la convalida: al massimo {} celle", CELLE_MASSIME_CONVALIDA) };
  }
  const tipoMotore: Record<TipoConvalida, DataValidationRule['type']> = {
    elenco: 'list',
    numero: 'number',
    lunghezza: 'text_length',
    casella: 'checkbox',
  };
  const tipoRegola = tipoMotore[d.tipo];
  if (!tipoRegola) return { ok: false, errore: t("Scegli un tipo di convalida") };
  const regola: DataValidationRule = {
    id,
    type: tipoRegola,
    action: d.azione === 'avvisa' ? 'warn' : 'reject',
    allowEmpty: d.ammettiVuote,
  };
  if (d.messaggio.trim() !== '') regola.helpText = d.messaggio.trim();
  if (d.tipo === 'elenco') {
    const testoVoci = d.voci.trim();
    if (testoVoci === '') return { ok: false, errore: t("Scrivi almeno una voce o un intervallo (es. A1:A10)") };
    const eRif = testoVoci.startsWith('=') || (parseRangeAddress(testoVoci) !== null || parseCellAddress(testoVoci) !== null);
    if (eRif) {
      const pulito = testoVoci.replace(/^=/, '').trim();
      const rCoord = parseRangeAddress(pulito);
      const cCoord = parseCellAddress(pulito);
      if (!rCoord && !cCoord) return { ok: false, errore: t("Intervallo sorgente non valido (es. A1:A10 o B2)") };
      regola.listRange = pulito;
      regola.value1 = `=${pulito}`;
    } else {
      const voci = parseListItems(d.voci);
      if (voci.length === 0) return { ok: false, errore: t("Scrivi almeno una voce, separate da virgola") };
      regola.listItems = voci;
    }
  } else if (d.tipo === 'numero' || d.tipo === 'lunghezza') {
    const op = OPERATORI_CONVALIDA.find((o) => o.id === d.operatore);
    if (!op) return { ok: false, errore: t("Scegli una condizione") };
    const v1 = numero(d.valore1);
    if (v1 === null) return { ok: false, errore: t("Scrivi un numero come valore") };
    regola.operator = op.id;
    regola.value1 = v1;
    if (op.valori === 2) {
      const v2 = numero(d.valore2);
      if (v2 === null) return { ok: false, errore: t("Scrivi un numero anche come secondo valore") };
      if (v1 > v2) return { ok: false, errore: t("Il primo valore deve essere minore o uguale al secondo") };
      regola.value2 = v2;
    }
  }
  return { ok: true, valore: { intervallo, aree, regola } };
}

// ---- l'elenco delle convalide già scritte ----

/** Ciò che conta di una regola di convalida (tutto tranne l'id, che è diverso cella per cella): due celle con la stessa firma hanno la stessa regola. */
export function firmaConvalida(r: DataValidationRule): string {
  const { id: _id, ...resto } = r;
  const ordinato: Record<string, unknown> = {};
  for (const k of Object.keys(resto).sort()) if ((resto as Record<string, unknown>)[k] !== undefined) ordinato[k] = (resto as Record<string, unknown>)[k];
  return JSON.stringify(ordinato);
}

export interface ConvalidaElencata { firma: string; regola: DataValidationRule; aree: Intervallo[] }

/** Le convalide del foglio (salvate cella per cella, con chiave "riga:colonna") raggruppate per regola e ricomposte in rettangoli, in ordine di posizione. */
export function elencaConvalide(convalide: ReadonlyMap<string, DataValidationRule>): ConvalidaElencata[] {
  const gruppi = new Map<string, { regola: DataValidationRule; celle: Set<string> }>();
  for (const [k, r] of convalide) {
    const f = firmaConvalida(r);
    if (!gruppi.has(f)) gruppi.set(f, { regola: r, celle: new Set() });
    gruppi.get(f)!.celle.add(k);
  }
  const out: ConvalidaElencata[] = [];
  for (const [firma, g] of gruppi) {
    const celle = [...g.celle].map((k) => k.split(':').map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const libere = new Set(g.celle);
    const aree: Intervallo[] = [];
    for (const [r0, c0] of celle) {
      if (!libere.has(`${r0}:${c0}`)) continue;
      // si allarga a destra finché ci sono celle libere, poi in basso finché tutta la riga c'è
      let c1 = c0;
      while (libere.has(`${r0}:${c1 + 1}`)) c1++;
      let r1 = r0;
      const rigaPiena = (r: number) => { for (let c = c0; c <= c1; c++) if (!libere.has(`${r}:${c}`)) return false; return true; };
      while (rigaPiena(r1 + 1)) r1++;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) libere.delete(`${r}:${c}`);
      aree.push({ startRow: r0, endRow: r1, startCol: c0, endCol: c1 });
    }
    out.push({ firma, regola: g.regola, aree });
  }
  return out.sort((a, b) => a.aree[0].startRow - b.aree[0].startRow || a.aree[0].startCol - b.aree[0].startCol);
}

const TIPO_DA_MOTORE: Record<string, TipoConvalida> = { list: 'elenco', number: 'numero', text_length: 'lunghezza', checkbox: 'casella' };

/** I dati della finestra per una convalida esistente (per modificarla), oppure null se la finestra non sa mostrarla (date e formule venute da un file). */
export function datiDaConvalida(r: DataValidationRule, aree: readonly Intervallo[]): DatiConvalida | null {
  const tipo = TIPO_DA_MOTORE[r.type];
  if (!tipo) return null;
  const sorgenteElenco = r.type === 'list' && (r.listRange || (r.value1 && String(r.value1).startsWith('=')))
    ? (r.listRange ? `=${r.listRange}` : String(r.value1 ?? ''))
    : (r.listItems ?? []).join(', ');

  return {
    intervallo: aree.map(scriviIntervallo).join(', '),
    tipo,
    voci: sorgenteElenco,
    operatore: r.operator ?? 'between',
    valore1: r.value1 !== undefined ? String(r.value1) : '',
    valore2: r.value2 !== undefined ? String(r.value2) : '',
    azione: r.action === 'warn' ? 'avvisa' : 'rifiuta',
    messaggio: r.helpText ?? '',
    ammettiVuote: r.allowEmpty !== false,
  };
}

/** Una riga per l'elenco: "Elenco: rosso, verde", "Numero compreso tra 1 e 10", "Casella di controllo"... */
export function descriviConvalida(r: DataValidationRule): string {
  const op = OPERATORI_CONVALIDA.find((o) => o.id === r.operator);
  const condizione = op ? ` ${t(op.etichetta).toLowerCase()} ${r.value1 ?? ''}${op.valori === 2 ? t(' e {}', r.value2 ?? '') : ''}` : '';
  const base = r.type === 'list'
    ? (r.listRange || (r.value1 && String(r.value1).startsWith('='))
        ? t("Elenco da intervallo: {}", r.listRange ? `=${r.listRange}` : r.value1)
        : t("Elenco: {}", (r.listItems ?? []).join(', ')))
    : r.type === 'number' ? t('Numero{}', condizione)
    : r.type === 'text_length' ? t("Lunghezza del testo{}", condizione)
    : r.type === 'checkbox' ? t('Casella di controllo')
    : r.type === 'date' ? t("Data (dal file)") : t("Formula (dal file)");
  return `${base} · ${r.action === 'warn' ? t('avvisa') : t('rifiuta')}`;
}
