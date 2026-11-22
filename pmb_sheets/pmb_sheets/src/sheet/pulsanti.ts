// Pulsanti dei file di Excel (controlli modulo «Button») sopra il foglio: posizione, testo e la macro collegata, già tradotta in azioni
// sicure (vai a un foglio, seleziona una cella, apri il link della cella). pmb_sheets non esegue codice VBA: se la macro contiene altro,
// il pulsante resta visibile e un clic dice perché non si può eseguire. Modulo puro, niente DOM.

export type AzioneMacro =
  | { tipo: 'foglio'; nome: string }
  | { tipo: 'cella'; indirizzo: string }
  | { tipo: 'link' };

/** Aspetto del testo del pulsante come nel file (colore "#rrggbb", dimensione in punti, scritta verticale dal basso in alto). */
export interface StilePulsante { colore?: string; grassetto?: boolean; corsivo?: boolean; sottolineato?: boolean; dimensione?: number; verticale?: boolean }

export interface PulsanteConfig {
  id: string;
  sheetName: string;
  /** posizione nel riquadro del foglio (come le immagini: comprende le intestazioni di riga e di colonna) */
  x: number;
  y: number;
  width: number;
  height: number;
  testo: string;
  /** nome della macro nel file */
  macro?: string;
  /** le azioni della macro; assenti se la macro non c'è o non si può eseguire (vedi motivo) */
  azioni?: AzioneMacro[];
  motivo?: string;
  stile?: StilePulsante;
}

/** Un pulsante nel modello di scambio dei formati: posizione dall'angolo di A1. */
export interface PulsanteScambio { x: number; y: number; width: number; height: number; testo: string; macro?: string; azioni?: AzioneMacro[]; motivo?: string; stile?: StilePulsante }

/** Lo stile letto da un file .psheet: solo valori della forma giusta. */
export function stileValido(v: unknown): StilePulsante | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const q = v as Record<string, unknown>;
  const s: StilePulsante = {};
  if (typeof q.colore === 'string' && /^#[0-9a-f]{6}$/i.test(q.colore)) s.colore = q.colore;
  for (const k of ['grassetto', 'corsivo', 'sottolineato', 'verticale'] as const) if (q[k] === true) s[k] = true;
  if (typeof q.dimensione === 'number' && q.dimensione >= 4 && q.dimensione <= 96) s.dimensione = q.dimensione;
  return Object.keys(s).length > 0 ? s : undefined;
}

export const LIMITE_PULSANTI = 200;
const LIMITE_AZIONI = 50;

let contatore = 0;
export function nuovoIdPulsante(): string { contatore++; return `pulsante-${Date.now().toString(36)}-${contatore}`; }

function azioneValida(a: unknown): AzioneMacro | null {
  if (!a || typeof a !== 'object') return null;
  const v = a as Record<string, unknown>;
  if (v.tipo === 'foglio' && typeof v.nome === 'string' && v.nome.length > 0 && v.nome.length <= 31) return { tipo: 'foglio', nome: v.nome };
  if (v.tipo === 'cella' && typeof v.indirizzo === 'string' && /^[A-Z]{1,3}\d{1,7}$/.test(v.indirizzo)) return { tipo: 'cella', indirizzo: v.indirizzo };
  if (v.tipo === 'link') return { tipo: 'link' };
  return null;
}

/** I pulsanti letti da un file .psheet: si tiene solo ciò che ha la forma giusta (un file modificato a mano non deve far danni). */
export function pulsantiDaDati(v: unknown): PulsanteConfig[] {
  if (!Array.isArray(v)) return [];
  const out: PulsanteConfig[] = [];
  for (const p of v.slice(0, LIMITE_PULSANTI)) {
    if (!p || typeof p !== 'object') continue;
    const q = p as Record<string, unknown>;
    const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    const x = num(q.x), y = num(q.y), w = num(q.width), h = num(q.height);
    if (typeof q.sheetName !== 'string' || x === null || y === null || w === null || h === null || w <= 0 || h <= 0) continue;
    const azioni = Array.isArray(q.azioni) ? q.azioni.slice(0, LIMITE_AZIONI).map(azioneValida) : undefined;
    out.push({
      id: typeof q.id === 'string' && q.id ? q.id : nuovoIdPulsante(), sheetName: q.sheetName,
      x: Math.max(0, x), y: Math.max(0, y), width: Math.min(w, 4000), height: Math.min(h, 4000),
      testo: typeof q.testo === 'string' ? q.testo.slice(0, 200) : '',
      ...(typeof q.macro === 'string' && q.macro ? { macro: q.macro.slice(0, 255) } : {}),
      ...(azioni && azioni.every((a) => a !== null) ? { azioni: azioni as AzioneMacro[] } : {}),
      ...(typeof q.motivo === 'string' && q.motivo ? { motivo: q.motivo.slice(0, 200) } : {}),
      ...(stileValido(q.stile) ? { stile: stileValido(q.stile) } : {}),
    });
  }
  return out;
}
