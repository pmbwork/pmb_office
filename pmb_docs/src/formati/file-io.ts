import { t } from '../i18n/lingua';
import { portatile } from '@comune/piattaforma';
import { scegliFilePortatili } from '@comune/file-portatile';
// Lettura e scrittura dei file sul computer, dal browser (anche dentro Tauri/WebView2).
// Il salvataggio usa la finestra "Salva con nome" del sistema quando c'è, altrimenti un normale scaricamento.

interface ScrivibileFile { write: (dati: Uint8Array) => Promise<void>; close: () => Promise<void> }
export interface ManiglioFile {
  name?: string;
  createWritable: () => Promise<ScrivibileFile>;
  getFile?: () => Promise<File>;
  queryPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<string>;
  requestPermission?: (o: { mode: 'read' | 'readwrite' }) => Promise<string>;
}

/**
 * true se si può già scrivere sul file senza chiedere niente. Non si chiede il permesso: WebView2 non mostra la richiesta
 * e la promessa resterebbe in sospeso per sempre. Un file aperto con "Apri" è di sola lettura: Salva ripiega su "Salva con nome".
 */
export async function assicuraScrittura(maniglia: ManiglioFile): Promise<boolean> {
  try {
    if (!maniglia.queryPermission) return true;
    return (await maniglia.queryPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

type SelettoreSalvataggio = (opzioni: { suggestedName: string; startIn?: ManiglioFile; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<ManiglioFile>;

/** Riscrive un file già scelto in precedenza (Salva). Lancia se il permesso manca o il file non è più scrivibile. */
export async function scriviSuManiglia(maniglia: ManiglioFile, bytes: Uint8Array): Promise<void> {
  if (!(await assicuraScrittura(maniglia))) throw new Error(t('permesso di scrittura non concesso'));
  const file = await maniglia.createWritable();
  await file.write(bytes);
  await file.close();
}

/** Salva con la finestra "Salva con nome" (o scaricando). Restituisce la maniglia del file scelto, se il sistema la dà. */
export async function salvaSuDisco(nome: string, bytes: Uint8Array, mime: string, iniziaDa?: ManiglioFile | null): Promise<ManiglioFile | null> {
  const selettore = (window as unknown as { showSaveFilePicker?: SelettoreSalvataggio }).showSaveFilePicker;
  const punto = nome.lastIndexOf('.');
  if (typeof selettore === 'function') {
    try {
      const maniglia = await selettore.call(window, {
        suggestedName: nome,
        ...(iniziaDa ? { startIn: iniziaDa } : {}),
        types: punto > 0 ? [{ description: nome.slice(punto + 1).toUpperCase(), accept: { [mime]: [nome.slice(punto)] } }] : undefined,
      });
      await scriviSuManiglia(maniglia, bytes);
      return maniglia;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return null;
    }
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return null;
}

/** Apre la finestra di scelta del file. Restituisce null se l'utente rinuncia. */
export async function scegliFile(accept: string): Promise<File | null> {
  // nella versione pocket la finestra interna (quella di Windows annoterebbe il file nel PC ospite)
  if (portatile()) return (await scegliFilePortatili(accept))[0] ?? null;
  return new Promise((risolvi) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => risolvi(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => risolvi(null), { once: true });
    input.click();
  });
}

/** Come scegliFile, ma se il sistema lo permette dà anche la maniglia del file, così Salva lo riscrive sul posto. */
export async function scegliFileConManiglia(accept: string): Promise<{ file: File; maniglia: ManiglioFile | null } | null> {
  const selettore = (window as unknown as { showOpenFilePicker?: (o: unknown) => Promise<ManiglioFile[]> }).showOpenFilePicker;
  if (typeof selettore === 'function') {
    try {
      const [m] = await selettore.call(window, { multiple: false, types: [{ description: 'Documenti', accept: { 'application/octet-stream': accept.split(',') } }] });
      if (m?.getFile) return { file: await m.getFile(), maniglia: m };
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return null;
    }
  }
  const file = await scegliFile(accept);
  return file ? { file, maniglia: null } : null;
}
