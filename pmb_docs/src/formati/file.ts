// Formati di file di pmb_docs: nomi, riconoscimento, apertura e salvataggio (.docx, .txt, .fdoc).
// Tutto puro (nessun accesso al disco o al browser): la finestra legge e scrive i byte, questo file li interpreta.
import { conCampiComeTesto } from '../modello/unione';
import { conDidascalieComeTesto } from '../modello/didascalie';
import { conRiferimentiComeTesto } from '../modello/riferimenti';
import { CifraturaNonSupportata, cifraFile, decifraSeServe } from '@comune/protezione/password-file';
import { esportaDocx, importaDocx } from './docx';
import { esportaOdt, importaFodt, importaOdt } from './odt';
import { importaRtf } from './rtf';
import { importaDoc } from './doc';
import { importaHtml } from './html';
import { esportaPdf } from './pdf';
import { versioneFinale } from '../modello/revisioni';
import { senzaStiliPersonali } from '../modello/stili';
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
export const ESTENSIONI_APRI = '.docx,.docm,.dotx,.dotm,.doc,.dot,.odt,.ott,.fodt,.rtf,.html,.htm,.xhtml,.txt,.md,.pdoc,.fdoc';
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
/** Estensioni che sono un documento Word (stesso formato del .docx: modelli e file con macro compresi). */
const ALIAS_DOCX = ['docx', 'docm', 'dotx', 'dotm'];
/** Estensioni OpenDocument a pacchetto (modelli compresi). */
const ALIAS_ODT = ['odt', 'ott'];
const ALIAS_HTML = ['html', 'htm', 'xhtml'];
/** Formati che si aprono soltanto (non si scrivono): «Salva» chiede un nome e un formato nuovi, il file originale non si tocca. */
export type FormatoSoloLettura = 'rtf' | 'html' | 'fodt' | 'doc';

/** Estensione (minuscola) di un nome di file, oppure ''. */
export function estensioneDi(nome: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome);
  return m ? m[1].toLowerCase() : '';
}

/** Formato di sola apertura dedotto dall'estensione, oppure null. */
export function formatoSoloLettura(nome: string): FormatoSoloLettura | null {
  const e = estensioneDi(nome);
  if (e === 'rtf') return 'rtf';
  if (ALIAS_HTML.includes(e)) return 'html';
  if (e === 'fodt') return 'fodt';
  if (e === 'doc' || e === 'dot') return 'doc';
  return null;
}

/** Formato dedotto dall'estensione del nome, oppure null. */
export function formatoDaNome(nome: string): FormatoId | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (ALIAS_DOCX.includes(e)) return 'docx';
  if (ALIAS_ODT.includes(e)) return 'odt';
  if (e === 'pdoc' || e === 'fdoc') return 'fdoc'; // .fdoc è l'estensione di quando il programma si chiamava free_docs: si apre ancora
  if (ALIAS_TESTO.includes(e)) return 'txt';
  return null;
}

/** Titolo del documento ricavato dal nome del file (senza estensione nota). */
export function titoloDaNome(nome: string): string {
  const senzaPercorso = nome.split(/[\\/]/).pop() ?? nome;
  const t = formatoDaNome(senzaPercorso) !== null || formatoSoloLettura(senzaPercorso) !== null ? senzaPercorso.replace(/\.[A-Za-z0-9]+$/, '') : senzaPercorso;
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
  // PDF e testo non conoscono commenti e modifiche registrate: si scrive il documento come sarà accettando le modifiche, senza commenti
  if (formato === 'pdf') return esportaPdf(senzaStiliPersonali(versioneFinale(conDidascalieComeTesto(conRiferimentiComeTesto(conCampiComeTesto(doc))))));
  if (formato === 'fdoc') return new TextEncoder().encode(serializza(doc));
  return new TextEncoder().encode(testoDi(versioneFinale(conDidascalieComeTesto(conRiferimentiComeTesto(conCampiComeTesto(doc))))).replace(/\n/g, '\r\n'));
}

/** Salva tutte le schede: in .fdoc restano separate, negli altri formati una dopo l'altra (ognuna col suo titolo). Con una scheda sola è come esporta().
 *  Con la password, i .docx e .odt si salvano cifrati (password per aprire). */
export async function esportaSchede(schede: Scheda[], formato: FormatoId, password?: string): Promise<Uint8Array> {
  if (password && (formato === 'docx' || formato === 'odt')) return cifraFile(await esportaSchede(schede, formato), formato === 'docx' ? 'ooxml' : 'odf', password);
  if (schede.length > 1 && formato === 'fdoc') return new TextEncoder().encode(serializzaSchede(schede));
  return esporta(unisciSchede(schede), formato);
}

/** Apre un file: il formato si ricava dal nome o, se manca, dal contenuto. Gli errori hanno un testo adatto all'utente. `avviso` dice ciò che non si è importato (per esempio le macro). */
export async function importa(bytes: Uint8Array, nome: string, password?: string): Promise<{ doc: Documento; formato: FormatoId; schede?: Scheda[]; avviso?: string; password?: string }> {
  if (bytes.length > DIMENSIONE_MASSIMA) throw new Error(t('File troppo grande (massimo 50 MB)'));
  // un .docx o .odt con la password per aprire: senza password (o con quella sbagliata) l'errore PasswordRichiesta fa chiedere la password
  let chiaro: { bytes: Uint8Array; cifrato: boolean };
  try { chiaro = await decifraSeServe(bytes, password); } catch (e) {
    if (e instanceof CifraturaNonSupportata) throw new Error(t('Il file è protetto da una password con un tipo di cifratura che pmb_docs non legge ({}).', e.message));
    throw e;
  }
  if (chiaro.cifrato) return { ...(await importa(chiaro.bytes, nome)), password };
  const ext = estensioneDi(nome);
  let formato = formatoDaNome(nome);
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  const rtf = bytes.length >= 5 && bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66;
  // Word salva a volte un file RTF con l'estensione .doc: conta il contenuto, non il nome
  if (rtf) return { doc: importaRtf(bytes), formato: 'docx', avviso: t('File aperto come RTF: Salva chiede un nome e un formato nuovi') };
  // i documenti di Word 97-2003 sono «file composti»: il lettore dei .doc dice anche se è un foglio di Excel o un file cifrato
  if (ole) {
    const { doc, avvisi } = importaDoc(bytes, password);
    return { doc, formato: 'docx', avviso: avvisi.join(' ') };
  }
  // Word 1.x e 2.x (senza contenitore): un formato che pmb_docs non apre
  if (bytes.length >= 4 && bytes[0] === 0xdb && bytes[1] === 0xa5) throw new Error(t('Il documento è di una versione di Word più vecchia della 97, che pmb_docs non apre: in Word o LibreOffice salvalo come .docx e aprilo di nuovo.'));
  const solo = formatoSoloLettura(nome);
  // Word salva a volte una pagina web con l'estensione .doc: si apre come pagina web
  const inizioTesto = solo === 'doc' && !zip ? decodificaTesto(bytes.subarray(0, 2000)).trimStart() : '';
  if (solo === 'doc' && /^(<\?xml[^>]*>\s*)?<(!doctype html|html)[\s>]/i.test(inizioTesto)) return { doc: importaHtml(bytes, decodificaTesto), formato: 'docx', avviso: t('Pagina web aperta come documento: Salva chiede un nome e un formato nuovi') };
  if (solo === 'html') return { doc: importaHtml(bytes, decodificaTesto), formato: 'docx', avviso: t('Pagina web aperta come documento: Salva chiede un nome e un formato nuovi') };
  if (solo === 'fodt') return { doc: importaFodt(bytes), formato: 'odt' };
  if (solo === 'rtf') throw new Error(t('File RTF non valido'));
  // un .docx (o .odt...) è sempre un archivio: se non lo è, il file è rovinato o ha l'estensione sbagliata (stesso messaggio di pmb_sheets)
  if (!zip && ['docx', 'docm', 'dotx', 'dotm', 'odt', 'ott'].includes(ext)) throw new Error(t("Il file «{}» non è un file .{} valido: è rovinato o ha un'estensione sbagliata", nome, ext));
  const conMacro = ext === 'docm' || ext === 'dotm';
  const avvisoMacro = conMacro ? t('Le macro e i controlli del documento non vengono caricati; Salva chiede un nome nuovo e non cambia il file originale') : undefined;
  if (formato === 'odt') return { doc: await importaOdt(bytes), formato };
  if (formato === null || (formato !== 'docx' && zip)) formato = zip ? 'docx' : null;
  if (formato === 'docx') return { doc: await importaDocx(bytes), formato, ...(avvisoMacro ? { avviso: avvisoMacro } : {}) };
  if (eBinario(bytes) || zip) throw new Error(t('Formato di file non riconosciuto'));
  const testo = decodificaTesto(bytes).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
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
