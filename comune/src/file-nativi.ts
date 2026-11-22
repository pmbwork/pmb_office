// Finestre «Apri» e «Salva con nome» di Windows (e, dal 2026-11-18 sera, del Mac) per la versione installata di pmb_docs e pmb_sheets.
// Il browser integrato (WebView2) dà i file aperti in sola lettura e non sa chiedere il permesso di scrittura, quindi «Salva» apriva sempre
// «Salva con nome». Qui le finestre sono quelle di Windows, chiamate dalla parte nativa (src-tauri/src/file_nativi.rs), che conosce il
// percorso del file e lo riscrive sul posto. Come file-portatile.ts, prende il posto di window.showOpenFilePicker / showSaveFilePicker:
// il resto dei programmi (file-io.ts) non cambia. Nel browser e nella pocket restano le finestre di prima (la pocket ha la sua finestra interna).
import { portatile } from './piattaforma';
import { manigliaPortatile, type ComandiFile, type ManigliaPortatile } from './file-portatile';

export type Traduttore = (testo: string, ...valori: Array<string | number>) => string;
interface TipoFile { description?: string; accept?: Record<string, string[] | string> }
interface OpzioniSelettore { suggestedName?: string; types?: TipoFile[]; multiple?: boolean; startIn?: unknown }
interface Filtro { nome: string; estensioni: string[] }
type Invocatore = (comando: string, argomenti?: unknown, opzioni?: unknown) => Promise<unknown>;

export const COMANDI_NATIVI: ComandiFile = { leggi: 'file_leggi', scrivi: 'file_scrivi' };

function invocatore(): Invocatore | undefined {
  const w = window as unknown as { __TAURI__?: { core?: { invoke?: Invocatore } }; __TAURI_INTERNALS__?: { invoke?: Invocatore } };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI_INTERNALS__?.invoke;
}

/** Una maniglia per un file scelto con le finestre di Windows (o aperto con doppio clic): Salva lo riscrive sul posto. */
export function manigliaNativa(percorso: string): ManigliaPortatile { return manigliaPortatile(percorso, COMANDI_NATIVI); }

/** I tipi di file del selettore del browser come filtri della finestra di Windows (estensioni senza il punto). */
export function filtriDaTipi(tipi: TipoFile[] | undefined): Filtro[] {
  return (tipi ?? []).map((t) => ({
    nome: t.description ?? '',
    estensioni: Object.values(t.accept ?? {}).flatMap((e) => (Array.isArray(e) ? e : [e])).flatMap((e) => e.split(','))
      .map((e) => e.trim().toLowerCase().replace(/^\*?\./, '')).filter((e) => /^[a-z0-9]+$/.test(e)),
  })).filter((f) => f.estensioni.length > 0);
}

/** La cartella di un percorso di Windows («C:\\Documenti\\a.docx» → «C:\\Documenti»). */
export function cartellaDi(percorso: string): string {
  const i = Math.max(percorso.lastIndexOf('\\'), percorso.lastIndexOf('/'));
  return i > 0 ? percorso.slice(0, i) : '';
}

const annullato = (): DOMException => new DOMException('Scelta annullata', 'AbortError');
const nonDisponibile = (e: unknown): boolean => String((e as { message?: string })?.message ?? e).includes('NON_DISPONIBILE');

/**
 * Nella versione installata su Windows mette le finestre di Windows al posto di quelle del browser. Se la parte nativa dice che non
 * le ha (Mac, programma vecchio), si torna per sempre alle finestre di prima. Restituisce false se non si installa (pocket, browser).
 */
export function installaFinestreNative(o: { t: Traduttore }): boolean {
  const invoca = invocatore();
  if (!invoca || portatile()) return false;
  const w = window as unknown as Record<string, unknown>;
  const apriPrima = w.showOpenFilePicker as ((p?: OpzioniSelettore) => Promise<unknown>) | undefined;
  const salvaPrima = w.showSaveFilePicker as ((p?: OpzioniSelettore) => Promise<unknown>) | undefined;
  let attive = true;
  w.showOpenFilePicker = async (p: OpzioniSelettore = {}) => {
    if (!attive && apriPrima) return apriPrima.call(window, p);
    try {
      const scelto = await invoca('file_apri_finestra', { titolo: o.t('Apri'), filtri: filtriDaTipi(p.types) }) as string | null;
      if (!scelto) throw annullato();
      return [manigliaNativa(scelto)];
    } catch (e) {
      if (nonDisponibile(e) && apriPrima) { attive = false; return apriPrima.call(window, p); }
      throw e;
    }
  };
  w.showSaveFilePicker = async (p: OpzioniSelettore = {}) => {
    if (!attive && salvaPrima) return salvaPrima.call(window, p);
    const da = (p.startIn as { percorso?: unknown } | undefined)?.percorso;
    try {
      const scelto = await invoca('file_salva_finestra', {
        titolo: o.t('Salva con nome'), nome: p.suggestedName ?? '', cartella: typeof da === 'string' ? cartellaDi(da) : null, filtri: filtriDaTipi(p.types),
      }) as string | null;
      if (!scelto) throw annullato();
      return manigliaNativa(scelto);
    } catch (e) {
      if (nonDisponibile(e) && salvaPrima) { attive = false; return salvaPrima.call(window, p); }
      throw e;
    }
  };
  return true;
}
