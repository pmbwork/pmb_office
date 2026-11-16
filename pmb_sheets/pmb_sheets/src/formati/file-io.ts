// Lettura e scrittura dei file sul computer, dal browser (anche dentro Tauri/WebView2).
// Il salvataggio usa la finestra "Salva con nome" del sistema quando c'è, altrimenti un normale scaricamento.
import { t } from '../i18n/lingua';

interface ScrivibileFile { write: (dati: Uint8Array) => Promise<void>; close: () => Promise<void> }
export interface ManiglioFile { createWritable: () => Promise<ScrivibileFile>; getFile?: () => Promise<File> }
/** Dove si è salvato: se la finestra del sistema dà un riferimento al file, lo si tiene per salvare di nuovo nello stesso posto senza richiedere il nome. */
export interface Destinazione { maniglia?: ManiglioFile | null }
type SelettoreSalvataggio = (opzioni: { suggestedName: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<ManiglioFile>;

/** Salva i byte su disco. Restituisce false se l'utente annulla la finestra "Salva con nome", true altrimenti.
 *  Con una `destinazione` che ha già un file, scrive lì senza chiedere nulla; altrimenti chiede il nome e lascia nella destinazione il file scelto. */
export async function salvaSuDisco(nome: string, bytes: Uint8Array, mime: string, destinazione?: Destinazione): Promise<boolean> {
  if (destinazione?.maniglia) {
    try {
      const file = await destinazione.maniglia.createWritable();
      await file.write(bytes);
      await file.close();
      return true;
    } catch {
      destinazione.maniglia = null; // permesso negato o file sparito: si ripiega sulla finestra "Salva con nome"
    }
  }
  const selettore = (window as unknown as { showSaveFilePicker?: SelettoreSalvataggio }).showSaveFilePicker;
  const punto = nome.lastIndexOf('.');
  if (typeof selettore === 'function') {
    try {
      const maniglia = await selettore.call(window, {
        suggestedName: nome,
        types: punto > 0 ? [{ description: nome.slice(punto + 1).toUpperCase(), accept: { [mime]: [nome.slice(punto)] } }] : undefined,
      });
      const file = await maniglia.createWritable();
      await file.write(bytes);
      await file.close();
      if (destinazione) destinazione.maniglia = maniglia;
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false;
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
  return true;
}

type SelettoreApertura = (opzioni: { multiple?: boolean; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<Array<ManiglioFile & { getFile: () => Promise<File> }>>;

/** Apre la finestra di scelta del file. Restituisce null se l'utente rinuncia.
 *  Quando il sistema lo permette il file porta con sé (`maniglia`) il riferimento per risalvarlo nello stesso posto. */
export async function scegliFile(accept: string): Promise<(File & { maniglia?: ManiglioFile }) | null> {
  const selettore = (window as unknown as { showOpenFilePicker?: SelettoreApertura }).showOpenFilePicker;
  if (typeof selettore === 'function') {
    try {
      const estensioni = accept.split(',').map((x) => x.trim()).filter((x) => x.startsWith('.'));
      const [maniglia] = await selettore.call(window, { multiple: false, types: [{ description: t('Fogli di calcolo'), accept: { 'application/octet-stream': estensioni } }] });
      const file = (await maniglia.getFile()) as File & { maniglia?: ManiglioFile };
      file.maniglia = maniglia;
      return file;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return null;
    }
  }
  return new Promise((risolvi) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => risolvi(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => risolvi(null), { once: true });
    input.click();
  });
}
