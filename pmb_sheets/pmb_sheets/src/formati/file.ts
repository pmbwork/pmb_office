// Formati di file di pmb_sheets: nomi, riconoscimento, apertura e salvataggio (.xlsx, .ods, .csv, .fsheet).
// Tutto puro (nessun accesso al disco o al browser): la finestra legge e scrive i byte, questo file li interpreta.
// Il CSV contiene solo il foglio attivo, coi valori calcolati (numeri interi e per esteso, senza formattazione), in UTF-8 con BOM per Excel.
import { CifraturaNonSupportata, cifraFile, decifraSeServe } from '@comune/protezione/password-file';
import { leggiCsv, rilevaDelimitatore, scriviCsv } from '@comune/formati/csv';
import { leggiZip } from '@comune/formati/zip';
import { createWorkbook } from '../engine/workbook';
import { MAX_COLS, MAX_ROWS } from '../engine/address';
import { formatDisplayValue } from '../sheet/format-display';
import { localizzaNumero, localeNumeri } from '../sheet/locale-numeri';
import { riferimentoNome } from '../sheet/nomi-dialogo';
import { deserializeSheetDocumentData, serializeSheetDocumentData, type SheetDocumentData } from '../sheet/document-data';
import type { Scambio, ValoreCalcolato } from './scambio';
import { NOME_FOGLIO_PREDEFINITO, avvisiDiConversione, documentoDaScambio, foglioVuoto, indirizzoCella, scambioDaDocumento } from './scambio';
import { avvisiScritturaXlsx, scriviXlsx } from './xlsx-scrivi';
import { leggiXlsx } from './xlsx-leggi';
import { leggiFods } from './ods-leggi';
import { leggiXlsb } from './xlsb-leggi';
import { eFoglioExcelVecchio, leggiXls } from './xls-leggi';
import { leggiHtml } from './html-leggi';
import { leggiDif, leggiSlk } from './dif-slk-leggi';
import { leggiXml2003 } from './xml2003-leggi';
import { TIPO_ODS, avvisiScritturaOds, scriviOds } from './ods-scrivi';
import { leggiOds } from './ods-leggi';
import { esportaPdf } from './pdf';
import { t } from '../i18n/lingua';

export type FormatoId = 'xlsx' | 'ods' | 'csv' | 'fsheet' | 'pdf';
export interface FormatoFile { id: FormatoId; etichetta: string; estensione: string; mime: string }
export const FORMATI: FormatoFile[] = [
  { id: 'xlsx', etichetta: 'Cartella di lavoro (.xlsx)', estensione: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'ods', etichetta: 'OpenDocument (.ods)', estensione: 'ods', mime: TIPO_ODS },
  { id: 'csv', etichetta: 'Valori separati da virgole (.csv)', estensione: 'csv', mime: 'text/csv' },
  { id: 'fsheet', etichetta: 'Foglio pmb_sheets (.psheet)', estensione: 'psheet', mime: 'application/json' },
];
export const TITOLO_PREDEFINITO = 'Foglio di calcolo senza titolo';
/** Estensioni da mostrare nella finestra "Apri" */
export const ESTENSIONI_APRI = '.xlsx,.xlsm,.xltx,.xltm,.xlsb,.xls,.xlt,.ods,.ots,.fods,.csv,.tsv,.txt,.html,.htm,.dif,.slk,.xml,.psheet,.fsheet';
export const DIMENSIONE_MASSIMA = 50 * 1024 * 1024;

const RISERVATI = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Nome del file da proporre per un titolo: senza caratteri vietati da Windows, con l'estensione del formato. */
export function nomeFile(titolo: string, formato: FormatoId): string {
  if (titolo === 'Foglio senza titolo') titolo = t('Foglio senza titolo'); // il nome predefinito nella lingua del programma
  let base = Array.from(titolo)
    .map((c) => (/[\\/:*?"<>|\u0000-\u001F]/.test(c) ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  base = Array.from(base).slice(0, 120).join('').trim().replace(/[. ]+$/, '');
  if (base === '') base = t(TITOLO_PREDEFINITO);
  if (RISERVATI.test(base)) base = `_${base}`;
  const f = FORMATI.find((x) => x.id === formato);
  return `${base}.${f ? f.estensione : formato}`;
}

const ALIAS_CSV = ['csv', 'tsv', 'txt'];

/** Formato dedotto dall'estensione del nome, oppure null. */
export function formatoDaNome(nome: string): FormatoId | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome);
  if (!m) return null;
  const e = m[1].toLowerCase();
  if (['xlsx', 'xlsm', 'xltx', 'xltm'].includes(e)) return 'xlsx'; // stesso formato: modelli e file con macro (le macro non si caricano)
  if (e === 'ods' || e === 'ots') return 'ods';
  if (e === 'psheet' || e === 'fsheet') return 'fsheet'; // .fsheet è l'estensione di quando il programma si chiamava free_sheets: si apre ancora
  if (ALIAS_CSV.includes(e)) return 'csv';
  return null;
}

/** Formati che si aprono soltanto: il file originale non si sovrascrive mai («Salva» chiede un nome nuovo). */
export type FormatoSoloLettura = 'xlsm' | 'xlsb' | 'xls' | 'fods' | 'html' | 'dif' | 'slk' | 'xml2003' | 'modello';
const SOLO_LETTURA: Record<string, FormatoSoloLettura> = { xlsm: 'xlsm', xltm: 'xlsm', xltx: 'modello', xlsb: 'xlsb', xls: 'xls', xlt: 'xls', ots: 'modello', fods: 'fods', html: 'html', htm: 'html', dif: 'dif', slk: 'slk', xml: 'xml2003' };

/** Estensione (minuscola) di un nome di file, oppure ''. */
export function estensioneDi(nome: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome);
  return m ? m[1].toLowerCase() : '';
}

/** Vero se il file si apre ma non si riscrive nello stesso formato (macro, formati di sola lettura, modelli). */
export function eSoloLettura(nome: string): boolean { return Object.prototype.hasOwnProperty.call(SOLO_LETTURA, estensioneDi(nome)); }

/** Titolo del documento ricavato dal nome del file (senza estensione nota). */
export function titoloDaNome(nome: string): string {
  const senzaPercorso = nome.split(/[\\/]/).pop() ?? nome;
  const t = formatoDaNome(senzaPercorso) !== null || eSoloLettura(senzaPercorso) ? senzaPercorso.replace(/\.[A-Za-z0-9]+$/, '') : senzaPercorso;
  return t.trim() === '' ? TITOLO_PREDEFINITO : t.trim(); // (qui `t` è il testo, non la traduzione)
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

/** Il testo di una cella nel CSV. I numeri si scrivono con 15 cifre significative, come fa Excel (la griglia ne mostra solo 10 e usa l'esponente oltre 1e11: 8001234567890 non deve diventare 8,001234568e+12). */
function testoCsv(valore: Parameters<typeof formatDisplayValue>[0]): string {
  if (valore.kind === 'number' && Number.isFinite(valore.value)) return localizzaNumero(String(Number(valore.value.toPrecision(15)))); // 15 cifre significative, come Excel
  return formatDisplayValue(valore).text;
}

/** Il libro di calcolo del documento, con i suoi nomi definiti (senza, le formule che li usano darebbero #NAME?). */
function libroDaDati(dati: SheetDocumentData) {
  const libro = createWorkbook();
  libro.setNamedRanges((dati.namedRanges ?? []).map((n) => ({ name: n.name, ref: riferimentoNome(n) })));
  libro.deserialize(dati.workbookJson);
  return libro;
}

/** Le righe del CSV da scrivere: il foglio attivo con i valori calcolati, rettangolare, fino all'ultima cella non vuota. */
export function righeCsv(dati: SheetDocumentData): string[][] {
  const libro = libroDaDati(dati);
  const nomi = libro.listSheets();
  const nome = nomi.includes(dati.activeSheetName) ? dati.activeSheetName : nomi[0];
  const foglio = nome === undefined ? undefined : libro.getSheet(nome);
  if (!foglio) return [];
  const piene: Array<{ riga: number; colonna: number; testo: string }> = [];
  let righe = 0;
  let colonne = 0;
  for (const { row, col, cell } of foglio.getAllCells()) {
    const testo = testoCsv(cell.value);
    if (testo === '') continue;
    piene.push({ riga: row, colonna: col, testo });
    righe = Math.max(righe, row);
    colonne = Math.max(colonne, col);
  }
  const matrice = Array.from({ length: righe }, () => new Array<string>(colonne).fill(''));
  for (const p of piene) matrice[p.riga - 1][p.colonna - 1] = p.testo;
  return matrice;
}

const CAMPO_CON_VIRGOLA_DECIMALE = /^[+-]?(\d+|\d{1,3}(\.\d{3})+),\d+$/;

/** Dal testo di un CSV al modello di scambio (un solo foglio). Con un separatore diverso dalla virgola, "1.234,56" e "3,5" diventano numeri. */
export function scambioDaCsv(testo: string, nomeFoglio: string = NOME_FOGLIO_PREDEFINITO): Scambio {
  const delimitatore = rilevaDelimitatore(testo);
  const f = foglioVuoto(nomeFoglio);
  leggiCsv(testo, { delimitatore }).slice(0, MAX_ROWS).forEach((riga, r) => {
    riga.slice(0, MAX_COLS).forEach((campo, c) => {
      if (campo === '') return;
      // gli zeri iniziali ("00123"), i numeri di più di 15 cifre (codici) e le formule scritte nel file restano testo: non si perdono cifre e non si esegue niente
      const comeTesto = /^0\d+$/.test(campo) || /^\d{16,}$/.test(campo) || campo.startsWith('=');
      f.celle[indirizzoCella(r + 1, c + 1)] = comeTesto ? `'${campo}` : delimitatore !== ',' && CAMPO_CON_VIRGOLA_DECIMALE.test(campo) ? campo.replace(/\./g, '').replace(',', '.') : campo;
    });
  });
  return { fogli: [f], foglioAttivo: nomeFoglio };
}

/** Come scambioDaDocumento, ma con le formule sostituite dal loro risultato: per i formati che non calcolano (PDF) si deve stampare quello che si vede, non "=A1*2". */
export function scambioConValoriCalcolati(dati: SheetDocumentData): Scambio {
  const s = scambioDaDocumento(dati);
  const libro = libroDaDati(dati);
  for (const f of s.fogli) {
    const foglio = libro.getSheet(f.nome);
    if (!foglio) continue;
    const calcolate = new Map(foglio.getAllCells().map(({ row, col, cell }) => [indirizzoCella(row, col), cell.value] as const));
    for (const [indirizzo, raw] of Object.entries(f.celle)) {
      if (!raw.startsWith('=') || raw.length < 2) continue;
      const valore = calcolate.get(indirizzo);
      if (valore) f.celle[indirizzo] = testoCsv(valore);
    }
  }
  return s;
}

/** Aggiunge a ogni foglio il risultato delle formule (i file .xlsx lo memorizzano accanto alla formula: anteprime e programmi che non ricalcolano lo mostrano). */
function conRisultatiMemorizzati(s: Scambio, dati: SheetDocumentData): Scambio {
  const libro = libroDaDati(dati);
  for (const f of s.fogli) {
    const foglio = libro.getSheet(f.nome);
    if (!foglio) continue;
    const valori = new Map(foglio.getAllCells().map(({ row, col, cell }) => [indirizzoCella(row, col), cell.value] as const));
    const calcolati: Record<string, ValoreCalcolato> = {};
    for (const [indirizzo, testo] of Object.entries(f.celle)) {
      if (!testo.startsWith('=') || testo.length < 2) continue;
      let v = valori.get(indirizzo);
      if (v?.kind === 'array') v = v.values[0]?.[0];
      if (!v) continue;
      if (v.kind === 'number' && Number.isFinite(v.value)) calcolati[indirizzo] = { tipo: 'n', valore: String(v.value) };
      else if (v.kind === 'text') calcolati[indirizzo] = { tipo: 'str', valore: v.value };
      else if (v.kind === 'boolean') calcolati[indirizzo] = { tipo: 'b', valore: v.value ? '1' : '0' };
      else if (v.kind === 'error') calcolati[indirizzo] = { tipo: 'e', valore: v.error };
    }
    if (Object.keys(calcolati).length > 0) f.calcolati = calcolati;
  }
  return s;
}

/** Dal documento ai byte del file nel formato scelto; con la password, i .xlsx e .ods si salvano cifrati (password per aprire). */
export async function esporta(dati: SheetDocumentData, formato: FormatoId, password?: string): Promise<Uint8Array> {
  if (password && (formato === 'xlsx' || formato === 'ods')) return cifraFile(await esporta(dati, formato), formato === 'xlsx' ? 'ooxml' : 'odf', password);
  if (formato === 'xlsx') return scriviXlsx(conRisultatiMemorizzati(scambioDaDocumento(dati), dati));
  if (formato === 'ods') return scriviOds(scambioDaDocumento(dati));
  if (formato === 'pdf') return esportaPdf(scambioConValoriCalcolati(dati));
  if (formato === 'fsheet') return new TextEncoder().encode(serializeSheetDocumentData(dati));
  // con la virgola come separatore decimale (italiano) i campi si separano con il punto e virgola: così Excel italiano apre il file in colonne
  return new TextEncoder().encode(`﻿${scriviCsv(righeCsv(dati), { delimitatore: localeNumeri() === 'it' ? ';' : ',' })}`);
}

/** Ciò che solo il formato nativo conserva e che questo documento contiene: un avviso per ogni cosa che andrebbe persa.
 *  I formati Excel e OpenDocument conservano commenti, convalide, formattazioni condizionali, nomi e righe/colonne nascoste. */
function avvisiSoloNativo(dati: SheetDocumentData, formato?: FormatoId): string[] {
  const perso: string[] = [];
  if (formato !== 'xlsx') {
    // OpenDocument conserva commenti, convalide, nomi, righe/colonne nascoste e formattazioni condizionali (le regole sulle date
    // no: lo dice avvisiScritturaOds)
    const odf = formato === 'ods';
    if (!odf && (dati.comments?.length ?? 0) > 0) perso.push(t("i commenti sulle celle"));
    if (!odf && Object.keys(dati.dataValidations ?? {}).length > 0) perso.push(t("le convalide dei dati"));
    if (!odf && (dati.conditionalFormats?.length ?? 0) > 0) perso.push(t("le formattazioni condizionali"));
    if (!odf && (dati.namedRanges?.length ?? 0) > 0) perso.push(t("gli intervalli denominati (le formule che li usano non funzioneranno altrove)"));
    if (!odf && (dati.hiddenRows?.length ?? 0) + (dati.hiddenCols?.length ?? 0) > 0) perso.push(t("le righe e colonne nascoste"));
    if (dati.styles?.some((st) => typeof st.link === 'string' && st.link !== '')) perso.push(t("i link delle celle"));
    if ((dati.images?.length ?? 0) > 0) perso.push(t("le immagini"));
  }
  if ((dati.buttons?.length ?? 0) > 0) perso.push(t("i pulsanti con le macro (restano nel formato di pmb_sheets, .psheet)"));
  // il filtro: in Excel si conserva la tabella con i valori spuntati (Fase 49), non i criteri per condizione, colore e data; negli altri formati niente
  const stati = [dati, ...Object.values(dati.fogliStato ?? {})];
  if (formato !== 'xlsx' && (dati.filters?.columns.length ?? 0) > 0) perso.push(t("i filtri"));
  if (formato === 'xlsx' && stati.some((s) => s.filters?.active && (s.filters.columns ?? []).some((c) => (c.condition && c.condition.operator !== 'none') || c.fillColors || c.textColors || c.months))) {
    perso.push(t("i filtri per condizione, per colore e per data (resta il filtro sulla tabella con i valori spuntati)"));
  }
  if (stati.some((s) => (s.visteFiltro?.length ?? 0) > 0)) perso.push(t("le viste filtro"));
  if ((dati.charts?.length ?? 0) > 0) perso.push(t("i grafici"));
  if ((dati.pivots?.length ?? 0) > 0) perso.push(t("le tabelle pivot"));
  return perso.length === 0 ? [] : [t("Si conservano solo nel formato pmb_sheets (.psheet) e in questo file non ci sono: {}.", perso.join(', '))];
}

/** Avvisi da mostrare prima di salvare: che cosa il formato scelto non conserva. */
export function avvisiEsportazione(dati: SheetDocumentData, formato: FormatoId, password?: string): string[] {
  if (password && formato !== 'xlsx' && formato !== 'ods') return [t("La password per aprire si conserva solo nei file .xlsx e .ods: questo file non è protetto."), ...avvisiEsportazione(dati, formato)];
  if (formato === 'fsheet') return [];
  const s = scambioDaDocumento(dati);
  const avvisoCommenti = avvisiSoloNativo(dati, formato);
  if (formato === 'xlsx') return [...avvisiScritturaXlsx(s), ...avvisoCommenti];
  if (formato === 'ods') return [...avvisiScritturaOds(s), ...avvisoCommenti];
  if (formato === 'pdf') return [...avvisoCommenti, ...(s.fogli.length > 1 ? [t("Il PDF contiene solo il foglio «{}»: gli altri fogli non sono inclusi.", s.foglioAttivo)] : [])];
  const avvisi: string[] = [...avvisoCommenti];
  if (s.fogli.length > 1) avvisi.push(t("Il file CSV contiene solo il foglio «{}»: gli altri fogli non sono inclusi.", s.foglioAttivo));
  const attivo = s.fogli.find((f) => f.nome === s.foglioAttivo) ?? s.fogli[0];
  const haFormule = attivo !== undefined && Object.values(attivo.celle).some((v) => v.startsWith('=') && v.length > 1);
  const haFormato = attivo !== undefined && (Object.keys(attivo.stili).length + Object.keys(attivo.stiliRiga).length + Object.keys(attivo.stiliColonna).length + attivo.unioni.length) > 0;
  if (haFormule || haFormato) avvisi.push(t("Il file CSV contiene solo i valori calcolati: formule, formattazione e celle unite non si conservano."));
  return avvisi;
}

export interface RisultatoApertura { dati: SheetDocumentData; formato: FormatoId; avvisi: string[]; soloLettura?: boolean; /** il file aveva la password per aprire: si riusa per salvarlo */ password?: string }

/** Un archivio ZIP è Excel o OpenDocument: lo dice il contenuto, non il nome. Se non si riesce a leggerlo decide il nome (Excel se il nome non dice niente). */
async function tipoArchivio(bytes: Uint8Array, daNome: FormatoId | null): Promise<FormatoId> {
  try {
    const voci = await leggiZip(bytes);
    if (voci.has('xl/workbook.xml')) return 'xlsx';
    if (voci.has('content.xml')) return 'ods';
  } catch {
    // archivio illeggibile: si decide dal nome
  }
  return daNome === 'ods' ? 'ods' : 'xlsx';
}

/** Apre un file: il formato si ricava dal nome o, se manca, dal contenuto. Gli errori hanno un testo adatto all'utente. */
/** Estensioni dei formati che sono sempre un archivio zip. */
const ARCHIVI = new Set(['xlsx', 'xlsm', 'xltx', 'xltm', 'xlsb', 'ods', 'ots']);

export async function importa(bytes: Uint8Array, nome: string, password?: string): Promise<RisultatoApertura> {
  if (bytes.length > DIMENSIONE_MASSIMA) throw new Error(t("File troppo grande (massimo 50 MB)"));
  // un .xlsx o .ods con la password per aprire: senza password (o con quella sbagliata) l'errore PasswordRichiesta fa chiedere la password
  let chiaro: { bytes: Uint8Array; cifrato: boolean };
  try { chiaro = await decifraSeServe(bytes, password); } catch (e) {
    if (e instanceof CifraturaNonSupportata) throw new Error(t("Il file è protetto da una password con un tipo di cifratura che pmb_sheets non legge ({}).", e.message));
    throw e;
  }
  if (chiaro.cifrato) {
    const r = await importa(chiaro.bytes, nome);
    return { ...r, password };
  }
  const ext = estensioneDi(nome);
  let formato = formatoDaNome(nome);
  const zip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const ole = bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  // i file di Office 97-2003 (e di Excel 5/95) sono «file composti»: il lettore dei .xls dice anche se è un documento di Word o un file cifrato;
  // i fogli di Excel 2.x, 3.0 e 4.0 sono una fila di record senza contenitore
  if (ole || eFoglioExcelVecchio(bytes)) {
    const { scambio, avvisi } = leggiXls(bytes, nome, password);
    return { dati: documentoDaScambio(scambio), formato: 'xlsx', avvisi: [...avvisi, ...avvisiDiConversione(scambio)], soloLettura: true };
  }
  let soloLettura = eSoloLettura(nome);
  if (zip) {
    // l'archivio può essere un .xlsb (parti binarie) oppure Excel/OpenDocument: lo dice il contenuto
    let voci: Map<string, Uint8Array> | null = null;
    try { voci = await leggiZip(bytes); } catch { voci = null; }
    if (voci?.has('xl/workbook.bin')) {
      const { scambio, avvisi } = await leggiXlsb(bytes);
      return { dati: documentoDaScambio(scambio), formato: 'xlsx', avvisi: [...avvisi, ...avvisiDiConversione(scambio)], soloLettura: true };
    }
    formato = await tipoArchivio(bytes, formato);
    const conMacro = voci?.has('xl/vbaProject.bin') === true;
    if (conMacro) soloLettura = true;
    if (formato === 'xlsx') {
      const { scambio, avvisi } = await leggiXlsx(bytes);
      const extra = conMacro ? [t("Il file contiene macro: pmb_sheets non esegue codice VBA (i pulsanti eseguono solo comandi sicuri); Salva chiede un nome nuovo e non cambia il file originale.")] : [];
      return { dati: documentoDaScambio(scambio), formato, avvisi: [...avvisi, ...avvisiDiConversione(scambio), ...extra], ...(soloLettura ? { soloLettura } : {}) };
    }
    const { scambio, avvisi } = await leggiOds(bytes);
    return { dati: documentoDaScambio(scambio), formato: 'ods', avvisi: [...avvisi, ...avvisiDiConversione(scambio)], ...(soloLettura ? { soloLettura } : {}) };
  }
  // un .xlsx (o .ods...) è sempre un archivio: se non lo è, il file è rovinato o ha l'estensione sbagliata (prima si apriva come un CSV con dentro il testo del file)
  if (ARCHIVI.has(ext)) throw new Error(t("Il file «{}» non è un file .{} valido: è rovinato o ha un'estensione sbagliata", nome, ext));
  if (eBinario(bytes)) throw new Error(t("Formato di file non riconosciuto"));
  const testo = decodificaTesto(bytes).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const inizio = testo.slice(0, 2000).trimStart();
  const comeOds = (r: { scambio: Scambio; avvisi: string[] }): RisultatoApertura => ({ dati: documentoDaScambio(r.scambio), formato: 'xlsx', avvisi: [...r.avvisi, ...avvisiDiConversione(r.scambio)], soloLettura: true });
  if (ext === 'fods' || /^<\?xml[^>]*\?>\s*<office:document[\s>]/.test(inizio) || /^<office:document[\s>]/.test(inizio)) return comeOds(leggiFods(new TextEncoder().encode(testo)));
  if (ext === 'dif' || /^TABLE\s*\r?\n\s*0\s*,\s*1/i.test(inizio)) return comeOds(leggiDif(testo));
  if (ext === 'slk' || /^ID;P/i.test(inizio)) return comeOds(leggiSlk(testo));
  if (ext === 'html' || ext === 'htm' || /^<!doctype html|^<html[\s>]/i.test(inizio)) return comeOds(leggiHtml(testo));
  if (ext === 'xml' || /^<\?xml[^>]*\?>\s*(<\?mso-application[^>]*\?>\s*)?<Workbook[\s>]/.test(inizio)) return comeOds(leggiXml2003(testo));
  if (formato === 'fsheet' || (formato === null && /^\s*\{\s*"version"\s*:/.test(testo))) {
    try { return { dati: deserializeSheetDocumentData(testo), formato: 'fsheet', avvisi: [] }; } catch (e) {
      if (formato === 'fsheet') throw new Error(t("File .psheet non valido: {}", e instanceof Error ? e.message : String(e)));
    }
  }
  return { dati: documentoDaScambio(scambioDaCsv(testo)), formato: 'csv', avvisi: [] };
}
