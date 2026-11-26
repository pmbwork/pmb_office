// Dal file al foglio di calcolo di una scheda e ritorno: applica i dati di un file al documento di una scheda,
// li estrae per salvarli, e prepara i byte da scrivere. Niente finestre e niente disco: lo fa il guscio con file-io.ts.
import { carattereBaseValido } from '../sheet/carattere-base';
import { pulsantiDaDati } from '../sheet/pulsanti';
import { ripulisciPagina } from '../sheet/pagina';
import { copiaProtezione } from '../sheet/protezione';
import { copiaGruppi } from '../sheet/gruppi';
import { createCellSelection } from '../sheet/selection';
import { HistoryManager } from '../sheet/history';
import { NamedRangeRegistry } from '../sheet/named-ranges';
import { nomiPerMotore } from '../sheet/nomi-dialogo';
import { commentiDaDati } from '../sheet/commenti';
import { immaginiDaDati } from '../sheet/immagini';
import { datiAStato } from '../sheet/stato-fogli';
import { areaFiltroValida, filtriDaJson } from '../sheet/filter';
import { extractDocumentData, restoreSheetStylesFromData, type SheetDocumentData } from '../sheet/document-data';
import type { DocumentStore, SheetDocument } from '../sheet/document-store';
import { FORMATI, avvisiEsportazione, esporta, importa, nomeFile, titoloDaNome, type FormatoId } from './file';
import { t } from '../i18n/lingua';

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const mappa = <V>(o: Record<string, V> | undefined): Map<number, V> => new Map(Object.entries(o ?? {}).map(([k, v]) => [Number(k), v] as [number, V]));

/** Mette nel documento della scheda il contenuto dei dati: sostituisce tutto, e azzera selezione, scorrimento e storico. */
export async function applicaDati(doc: SheetDocument, dati: SheetDocumentData): Promise<void> {
  // i nomi prima delle formule: così quelle che li usano si leggono giuste
  const nomi = new NamedRangeRegistry();
  for (const r of copia(dati.namedRanges ?? [])) nomi.add(r);
  doc.namedRanges = nomi;
  doc.comments = commentiDaDati(dati.comments);
  await doc.client.setNamedRanges(nomiPerMotore(nomi));
  await doc.client.restore(dati.workbookJson);
  doc.styles = restoreSheetStylesFromData(dati);
  doc.colWidths = mappa(dati.colWidths);
  doc.rowHeights = mappa(dati.rowHeights);
  doc.hiddenRows = new Set<number>(dati.hiddenRows ?? []);
  doc.hiddenCols = new Set<number>(dati.hiddenCols ?? []);
  doc.freezeRows = dati.freezeRows ?? 0;
  doc.freezeCols = dati.freezeCols ?? 0;
  doc.coloreScheda = dati.coloreScheda;
  doc.nascosto = dati.nascosto;
  doc.senzaGriglia = dati.senzaGriglia;
  doc.impostaPagina = dati.impostaPagina ? ripulisciPagina(dati.impostaPagina) : undefined;
  doc.protezione = copiaProtezione(dati.protezione);
  doc.gruppi = copiaGruppi(dati.gruppi);
  doc.protezioneCartella = copiaProtezione(dati.protezioneCartella);
  doc.carattere = carattereBaseValido(dati.carattere);
  doc.visteFiltro = dati.visteFiltro ? copia(dati.visteFiltro) : undefined;
  doc.activeSheetName = dati.activeSheetName;
  doc.merges = copia(dati.merges ?? []);
  doc.dataValidations = new Map(Object.entries(copia(dati.dataValidations ?? {})));
  doc.conditionalFormats = copia(dati.conditionalFormats ?? []);
  doc.activeFilters = filtriDaJson(dati.filters?.columns);
  doc.filterArea = areaFiltroValida(dati.filters?.area);
  doc.isFilterActive = dati.filters?.active ?? false;
  doc.charts = copia(dati.charts ?? []);
  doc.immagini = immaginiDaDati(dati.images);
  doc.pulsanti = pulsantiDaDati(dati.buttons);
  doc.pivots = copia(dati.pivots ?? []);
  doc.selection = createCellSelection(1, 1);
  doc.scroll = { left: 0, top: 0 };
  doc.sheetStates = new Map(Object.entries(dati.fogliStato ?? {}).filter(([nome]) => nome !== dati.activeSheetName).map(([nome, d]) => [nome, datiAStato(d)] as const));
  doc.history = new HistoryManager(200);
  doc.history.contesto = () => doc.activeSheetName;
  // il motore deve sapere quali righe sono nascoste in ogni foglio (SUBTOTAL e AGGREGATE le ignorano); in un file non si distingue chi le ha nascoste, e per il foglio
  // attivo la griglia rifà la distinzione (a mano o da un filtro) alla prima lettura
  const nascostePerFoglio: Array<[string, Set<number>]> = [[doc.activeSheetName, doc.hiddenRows], ...[...doc.sheetStates].map(([nome, stato]) => [nome, stato.hiddenRows] as [string, Set<number>])];
  for (const [nome, righe] of nascostePerFoglio) if (righe.size > 0) await doc.client.setHiddenRows(nome, righe, []);
}

/** I dati del documento di una scheda, pronti per essere salvati. */
export function estraiDati(doc: SheetDocument): Promise<SheetDocumentData> {
  return extractDocumentData(doc, doc.styles);
}

export interface Aperto { titolo: string; formato: FormatoId; avvisi: string[]; soloLettura?: boolean }

/** Apre un file nel documento della scheda indicata (lo crea). Se il file non si apre, il documento della scheda resta com'era. */
export async function apriInScheda(store: DocumentStore, tabId: string, bytes: Uint8Array, nome: string, password?: string): Promise<Aperto> {
  const esisteva = store.hasDocument(tabId);
  const letto = await importa(bytes, nome, password);
  const titolo = titoloDaNome(nome);
  try {
    const doc = store.getOrCreateDocument(tabId, titolo);
    await applicaDati(doc, letto.dati);
    doc.passwordApertura = letto.password;
  } catch (e) {
    if (!esisteva) store.removeDocument(tabId);
    throw e;
  }
  return { titolo, formato: letto.formato, avvisi: letto.avvisi, ...(letto.soloLettura ? { soloLettura: true } : {}) };
}

export interface Preparato { nome: string; bytes: Uint8Array; mime: string; avvisi: string[] }

/** I byte da scrivere per salvare la scheda nel formato scelto, col nome del file ricavato dal titolo, e gli avvisi su ciò che il formato non conserva. */
export async function preparaSalvataggio(store: DocumentStore, tabId: string, titolo: string, formato: FormatoId): Promise<Preparato> {
  const doc = store.getDocument(tabId);
  if (!doc) throw new Error(t("Nessun foglio di calcolo da salvare"));
  const dati = await estraiDati(doc);
  const f = FORMATI.find((x) => x.id === formato);
  return { nome: nomeFile(titolo, formato), bytes: await esporta(dati, formato, doc.passwordApertura), mime: f ? f.mime : 'application/octet-stream', avvisi: avvisiEsportazione(dati, formato, doc.passwordApertura) };
}
