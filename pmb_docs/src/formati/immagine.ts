// Immagini di pmb_docs: leggere un file immagine (da scegliere o incollato) e prepararlo per il documento.
// Il tipo si riconosce dai primi byte del file, non dal nome né dal tipo dichiarato; si accettano solo png, jpeg, gif e webp
// fino a 5 MB (niente svg: potrebbe contenere programmi).
import { dimensioniIniziali, immagineValida, type Immagine } from '../modello/documento';

export const ACCETTA_IMMAGINI = '.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp';
export const DIMENSIONE_MASSIMA_FILE = 5_000_000;
export interface Misure { w: number; h: number }
/** Dice quanto è grande un'immagine (in pixel) dato il suo indirizzo; null se non si riesce a leggerla. Si può sostituire nei test. */
export type Misuratore = (indirizzo: string) => Promise<Misure | null>;

export function tipoDaByte(b: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | null {
  const inizia = (...x: number[]): boolean => x.every((v, i) => b[i] === v);
  if (inizia(0x89, 0x50, 0x4e, 0x47)) return 'png';
  if (inizia(0xff, 0xd8, 0xff)) return 'jpeg';
  if (inizia(0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (inizia(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

function aBase64(dati: Uint8Array): string {
  let s = '';
  for (let i = 0; i < dati.length; i += 0x8000) s += String.fromCharCode(...dati.subarray(i, i + 0x8000));
  return btoa(s);
}

export function misuraNelBrowser(indirizzo: string): Promise<Misure | null> {
  return new Promise((risolvi) => {
    const immagine = new Image();
    immagine.onload = () => risolvi({ w: immagine.naturalWidth, h: immagine.naturalHeight });
    immagine.onerror = () => risolvi(null);
    immagine.src = indirizzo;
  });
}

/** L'immagine pronta per il documento (nelle misure con cui metterla nel foglio), oppure null se il file non è ammesso o non si legge. */
export async function leggiImmagine(file: Blob, misura: Misuratore = misuraNelBrowser): Promise<Immagine | null> {
  if (file.size === 0 || file.size > DIMENSIONE_MASSIMA_FILE) return null;
  const dati = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoDaByte(dati);
  if (!tipo) return null;
  const s = `data:image/${tipo};base64,${aBase64(dati)}`;
  const m = await misura(s);
  if (!m || !(m.w >= 1) || !(m.h >= 1)) return null;
  const immagine: Immagine = { s, ...dimensioniIniziali(m.w, m.h) };
  return immagineValida(immagine) ? immagine : null;
}
