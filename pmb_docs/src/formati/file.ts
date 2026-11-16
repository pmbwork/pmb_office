// Formati di file di pmb_docs: nomi, riconoscimento, apertura e salvataggio (.docx, .txt, .fdoc).
// Tutto puro (nessun accesso al disco o al browser): la finestra legge e scrive i byte, questo file li interpreta.
import { esportaDocx, importaDocx } from './docx';
import { esportaOdt, importaOdt } from './odt';
import { esportaPdf } from './pdf';
import { daTesto, deserializza, serializza, testoDi, type Documento } from '../modello/documento';
import { leggiSchede, serializzaSchede, unisciSchede, type Scheda } from '../modello/schede';
import type { Popup } from '../guscio/popup-dati';
import type { AzioneFormato } from '../editor/azioni-formato';
import { t } from '../i18n/lingua';

export type FormatoId = 'docx' | 'txt' | 'fdoc' | 'odt' | 'pdf';
export interface FormatoFile { id: FormatoId; etichetta: string; estensione: string; mime: string }
export const FORMATI: FormatoFile[] = [
  { id: 'docx', etichetta: 'Documento (.docx)', estensione: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'txt', etichetta: 'Testo normale (.txt)', estensione: 'txt', mime: 'text/plain' },
  { id: 'fdoc', etichetta: 'Documento pmb_docs (.pdoc)', estensione: 'pdoc', mime: 'application/json' },
  { id: 'odt', etichetta: 'OpenDocument (.odt)', estensione: 'odt', mime: 'application/vnd.oasis.opendocument.text' },
  { id: 'pdf', etichetta: 'Documento PDF (.pdf)', estensione: 'pdf', mime: 'application/pdf' },
];
export const TITOLO_PREDEFINITO = 'Documento senza titolo';
/** Estensioni da mostrare nella finestra "Apri" */
export const ESTENSIONI_APRI = '.docx,.odt,.txt,.md,.pdoc,.fdoc';
export const DIMENSIONE_MASSIMA = 50 * 1024 * 1024;

const RISERVATI = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Nome del file da proporre per un titolo: senza caratteri vietati da Windows, con l'estensione del formato. */
export function nomeFile(titolo: string, formato: FormatoId): string {
  let base = Array.from(titolo)
    .map((c) => (/[\\/:*?"<>|\u0000-\u001F]/.test(c) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  base = Array.from(base).slice(0, 120).join('').trim().replace(/[. ]+$/, '');
  if (base === '') base = TITOLO_PREDEFINITO;
  if (RISERVATI.test(base)) base = `_${base}`;
  const f = FORMATI.find((x) => x.id === formato);
  return `${base}.${f ? f.estensione : formato}`;
}

const ALIAS_TESTO = ['txt', 'text', 'md', 'markdown'];

/** Formato dedotto dall'estensione del nome, oppure null. */
export function formatoDaNome(nome: string): FormatoId | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (e === 'docx') return 'docx';
  if (e === 'odt') return 'odt';
  if (e === 'pdoc' || e === 'fdoc') return 'fdoc'; // .fdoc è l'estensione di quando il programma si chiamava free_docs: si apre ancora
  if (ALIAS_TESTO.includes(e)) return 'txt';
  return null;
}

/** Titolo del documento ricavato dal nome del file (senza estensione nota). */
export function titoloDaNome(nome: string): string {
  const senzaPercorso = nome.split(/[\\/]/).pop() ?? nome;
  const t = formatoDaNome(senzaPercorso) !== null ? senzaPercorso.replace(/\.[A-Za-z0-9]+$/, '') : senzaPercorso;
  return t.trim() === '' ? TITOLO_PREDEFINITO : t.trim();
}

/** Decodifica un file di testo: UTF-8 (con o senza BOM), UTF-16 con BOM, altrimenti Windows-1252. */
export function decodificaTesto(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}

function eBinario(bytes: Uint8Array): boolean {
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return false;
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

export async function esporta(doc: Documento, formato: FormatoId): Promise<Uint8Array> {
  if (formato === 'docx') return esportaDocx(doc);
  if (formato === 'odt') return esportaOdt(doc);
  if (formato === 'pdf') return esportaPdf(doc);
  if (formato === 'fdoc') return new TextEncoder().encode(serializza(doc));
  return new TextEncoder().encode(testoDi(doc).replace(/\n/g, '\r\n'));
}

/** Salva tutte le schede: in .fdoc restano separate, negli altri formati una dopo l'altra (ognuna col suo titolo). Con una scheda sola è come esporta(). */
export async function esportaSchede(schede: Scheda[], formato: FormatoId): Promise<Uint8Array> {
  if (schede.length > 1 && formato === 'fdoc') return new TextEncoder().encode(serializzaSchede(schede));
  return esporta(unisciSchede(schede), formato);
}

/** Apre un file: il formato si ricava dal nome o, se manca, dal contenuto. Gli errori hanno un testo adatto all'utente. */
export async function importa(bytes: Uint8Array, nome: string): Promise<{ doc: Documento; formato: FormatoId; schede?: Scheda[] }> {
  if (bytes.length > DIMENSIONE_MASSIMA) throw new Error(t('File troppo grande (massimo 50 MB)'));
  let formato = formatoDaNome(nome);
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (formato === 'odt') return { doc: await importaOdt(bytes), formato };
  if (formato === null || (formato !== 'docx' && zip)) formato = zip ? 'docx' : null;
  if (formato === 'docx') return { doc: await importaDocx(bytes), formato };
  if (eBinario(bytes) || zip) throw new Error(t('Formato di file non riconosciuto'));
  const testo = decodificaTesto(bytes).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (formato === 'fdoc' || (formato === null && /^\s*\{\s*"v"\s*:/.test(testo))) {
    try {
      const schede = leggiSchede(testo);
      if (schede) return { doc: schede[0].doc, formato: 'fdoc', schede };
      return { doc: deserializza(testo), formato: 'fdoc' };
    } catch (e) {
      if (formato === 'fdoc') throw e;
    }
  }
  return { doc: daTesto(testo), formato: 'txt' };
}

/** Voci del menu File > Scarica. L'azione "scarica" non è una modifica del testo: la gestisce il guscio. */
export function popupScarica(): Popup {
  return {
    tipo: 'lista',
    titolo: 'Scarica',
    voci: FORMATI.map((f) => ({ etichetta: f.etichetta, azione: { tipo: 'scarica', formato: f.id } as unknown as AzioneFormato, attiva: false })),
  };
}
