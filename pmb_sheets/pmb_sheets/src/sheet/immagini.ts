// Immagini sul foglio di pmb_sheets: figure che galleggiano sopra le celle (come i grafici), con posizione e misure in pixel.
// Si conservano nel formato nativo (.psheet) con i byte dentro il file (data URL). Modulo puro, niente DOM.
//
// Sicurezza: si accettano solo PNG, JPEG, GIF e WebP, riconosciuti dai primi byte del file (non dall'estensione). L'SVG è escluso apposta:
// può contenere script. Un file rovinato o con un tipo diverso si scarta.

export interface ImmagineConfig {
  id: string;
  sheetName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** i byte dell'immagine come data URL base64 (data:image/png;base64,...) */
  dataUrl: string;
  /** nome del file da cui viene */
  nome: string;
}

export const LIMITE_BYTE_IMMAGINE = 1_500_000;
export const LIMITE_IMMAGINI = 20;
export const LARGHEZZA_MASSIMA_INIZIALE = 480;
export const ALTEZZA_MASSIMA_INIZIALE = 320;
export const LATO_MINIMO = 24;

export type TipoImmagine = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

/** Nei file di Excel e di altri programmi la posizione parte dall'angolo della cella A1; qui l'immagine sta nel riquadro che comprende anche le intestazioni
 *  di riga e di colonna: per passare da una all'altra si tolgono (o si aggiungono) queste misure. */
export const ORIGINE_X = 44;
export const ORIGINE_Y = 24;

/** Un'immagine nel modello di scambio dei formati: posizione dall'angolo di A1, misure in pixel e i byte veri. */
export interface ImmagineScambio {
  x: number;
  y: number;
  width: number;
  height: number;
  nome: string;
  tipo: TipoImmagine;
  byte: Uint8Array;
}

export function estensioneImmagine(tipo: TipoImmagine): 'png' | 'jpeg' | 'gif' | 'webp' {
  return tipo === 'image/png' ? 'png' : tipo === 'image/jpeg' ? 'jpeg' : tipo === 'image/gif' ? 'gif' : 'webp';
}

/** Il tipo di un'immagine dai suoi primi byte; `null` se non è PNG, JPEG, GIF o WebP. */
export function rilevaTipoImmagine(b: Uint8Array): TipoImmagine | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/** Dai byte di un file al data URL da salvare. */
export function dataUrlDaByte(b: Uint8Array, tipo: TipoImmagine): string {
  let testo = '';
  const passo = 0x8000;
  for (let i = 0; i < b.length; i += passo) testo += String.fromCharCode(...b.subarray(i, i + passo));
  return `data:${tipo};base64,${btoa(testo)}`;
}

/** Dal data URL ai byte e al tipo; `null` se non è un data URL ammesso. */
export function byteDaDataUrl(url: string): { tipo: TipoImmagine; byte: Uint8Array } | null {
  if (!dataUrlValido(url)) return null;
  const virgola = url.indexOf(',');
  const tipo = url.slice(5, url.indexOf(';')) as TipoImmagine;
  try {
    const testo = atob(url.slice(virgola + 1));
    const byte = new Uint8Array(testo.length);
    for (let i = 0; i < testo.length; i++) byte[i] = testo.charCodeAt(i);
    return rilevaTipoImmagine(byte) === tipo ? { tipo, byte } : null;
  } catch { return null; }
}

const DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Un data URL ammesso: solo i quattro tipi, base64 pulito e non più grande del limite (con il rigonfiamento del base64). */
export function dataUrlValido(s: unknown): s is string {
  return typeof s === 'string' && s.length <= Math.ceil(LIMITE_BYTE_IMMAGINE * 4 / 3) + 64 && DATA_URL.test(s);
}

/** Le misure di partenza di un'immagine che entra nel foglio: entra in 480 x 320 mantenendo le proporzioni, senza ingrandire le piccole. */
export function misureIniziali(larghezzaNaturale: number, altezzaNaturale: number): { width: number; height: number } {
  const w = Number.isFinite(larghezzaNaturale) && larghezzaNaturale > 0 ? larghezzaNaturale : LARGHEZZA_MASSIMA_INIZIALE;
  const h = Number.isFinite(altezzaNaturale) && altezzaNaturale > 0 ? altezzaNaturale : ALTEZZA_MASSIMA_INIZIALE;
  const scala = Math.min(1, LARGHEZZA_MASSIMA_INIZIALE / w, ALTEZZA_MASSIMA_INIZIALE / h);
  return { width: Math.max(LATO_MINIMO, Math.round(w * scala)), height: Math.max(LATO_MINIMO, Math.round(h * scala)) };
}

/** Controlla un'immagine rilevata: posizione e misure accettabili, data URL ammesso. */
function immagineValida(v: unknown): v is ImmagineConfig {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  const num = (n: unknown, min: number, max: number): boolean => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  return typeof c.id === 'string' && c.id !== '' && c.id.length <= 100
    && typeof c.sheetName === 'string' && c.sheetName.length <= 255
    && typeof c.nome === 'string'
    && num(c.x, 0, 1_000_000) && num(c.y, 0, 1_000_000)
    && num(c.width, LATO_MINIMO, 20_000) && num(c.height, LATO_MINIMO, 20_000)
    && dataUrlValido(c.dataUrl);
}

/** Dall'elenco letto da un file alle immagini del documento: le voci rovinate si scartano, gli identificativi doppi pure, e il numero è limitato. */
export function immaginiDaDati(dati: unknown): ImmagineConfig[] {
  if (!Array.isArray(dati)) return [];
  const visti = new Set<string>();
  const out: ImmagineConfig[] = [];
  for (const v of dati) {
    if (!immagineValida(v) || visti.has(v.id)) continue;
    visti.add(v.id);
    out.push({ id: v.id, sheetName: v.sheetName, x: v.x, y: v.y, width: v.width, height: v.height, dataUrl: v.dataUrl, nome: v.nome.slice(0, 255) });
    if (out.length >= LIMITE_IMMAGINI) break;
  }
  return out;
}

export function nuovoIdImmagine(): string {
  return `img-${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}
