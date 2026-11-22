// Icona di una funzione presa dai menu e messa nella barra degli strumenti, UGUALE in pmb_docs e pmb_sheets (regola della suite, REGOLE.md).
// Prima una voce di menu nella barra compariva come testo («Nuovo», «Document (.docx)», «Italiano»…) e la barra diventava una fila di
// scritte lunghe (segnalazione dell'utente del 2026-11-19): ora ogni funzione è un pulsante a icona, con il nome nel suggerimento.
// L'icona si sceglie dal nome italiano della voce (etichetta di origine, non tradotta), con le regole qui sotto in ordine: vince la prima.
// Le icone vengono dall'insieme comune (icone.ts) o dalle Material Icons ufficiali (icone-material.ts, generate dai file di Google).
import { ICONE } from './icone';
import { ICONE_MATERIAL } from './icone-material';

type Nome = keyof typeof ICONE | string;

const REGOLE: Array<[RegExp, Nome]> = [
  // voci composte che contengono parole di altre regole: prima di tutto
  [/^unisci celle/, 'mergeCells'],
  [/^componenti di base › data/, 'today'],
  [/^componenti di base/, 'widgets'],
  [/^disegno/, 'draw'],
  [/tabella pivot/, 'pivot'],
  [/^grafico › a colonne/, 'bar_chart'],
  [/^grafico › a linee/, 'show_chart'],
  [/^grafico › a torta/, 'pie_chart'],
  [/^grafico/, 'insert_chart'],
  [/togli tutte le interruzioni/, 'layers_clear'],
  [/^area di stampa › imposta/, 'crop_free'],
  [/^area di stampa › cancella/, 'layers_clear'],
  [/anteprima di stampa/, 'preview'],
  [/layout di stampa/, 'article'],
  [/barra degli strumenti delle equazioni|^equazione/, 'functions'],
  [/personalizza barra/, 'tune'],
  [/rimuovi formattazione condizionale/, 'format_color_reset'],
  [/formattazione condizionale/, 'fillColor'],
  [/cancella formattazione/, 'clearFormatting'],
  [/rimuovi convalida/, 'playlist_remove'],
  [/convalida/, 'rule'],
  [/sottolinea gli errori|ortograf/, 'spellcheck'],
  // file
  [/pdf/, 'picture_as_pdf'],
  [/^scarica/, 'download'],
  [/^nuovo foglio$/, 'post_add'],
  [/^nuovo/, 'note_add'],
  [/^apri/, 'folder_open'],
  [/^salva con nome/, 'save_as'],
  [/^salva/, 'save'],
  [/^rinomina/, 'drive_file_rename_outline'],
  [/cronologia versioni/, 'history'],
  [/^dettagli|^informazioni/, 'info'],
  [/^correttore lingua/, 'translate'],
  [/^imposta(zione)? pagina/, 'description'],
  [/^stampa/, 'print'],
  [/^esci/, 'logout'],
  // modifica
  [/^annulla/, 'undo'],
  [/^ripeti/, 'redo'],
  [/^taglia/, 'content_cut'],
  [/^copia/, 'content_copy'],
  [/^incolla/, 'content_paste'],
  [/^elimina/, 'delete'],
  [/^seleziona tutto/, 'select_all'],
  [/trova e sostituisci/, 'findReplace'],
  [/cerca nei menu/, 'search'],
  // visualizza
  [/tema scuro/, 'dark_mode'],
  [/tema chiaro/, 'light_mode'],
  [/tema di sistema/, 'brightness_auto'],
  [/righello/, 'straighten'],
  [/caratteri non stampabili/, 'subject'],
  [/schermo intero/, 'fullscreen'],
  [/nascondi i menu/, 'menu_open'],
  [/pannello laterale/, 'sidebar'],
  [/^blocca/, 'ac_unit'],
  [/^zoom/, 'zoom_in'],
  // inserisci
  [/^riga sopra|^riga sotto/, 'table_rows'],
  [/^colonna a /, 'view_column'],
  [/^immagine/, 'image'],
  [/^tabella/, 'table_chart'],
  [/^link/, 'link'],
  [/^simboli/, 'emoji_symbols'],
  [/^tab$/, 'keyboard_tab'],
  [/linea orizzontale/, 'horizontal_rule'],
  [/interruzione di colonna/, 'view_column'],
  [/controlla accessibilit/, 'accessibility'],
  [/stampa unione/, 'contact_mail'],
  [/sottolineato doppio/, 'format_underlined'],
  [/maiuscoletto/, 'text_fields'],
  [/data e ora/, 'event'],
  [/didascalia/, 'short_text'],
  [/riferimento incrociato/, 'call_made'],
  [/testo alternativo/, 'short_text'],
  [/spazio non divisibile/, 'space_bar'],
  [/trattino (non divisibile|facoltativo)/, 'remove'],
  [/interruzione|salto di pagina/, 'insert_page_break'],
  [/segnalibro/, 'bookmark'],
  [/nota a piè/, 'notes'],
  [/^commento/, 'comment'],
  // formato
  [/grassetto/, 'bold'],
  [/corsivo/, 'italic'],
  [/sottolineato/, 'underline'],
  [/barrato/, 'strike'],
  [/apice/, 'superscript'],
  [/pedice/, 'subscript'],
  [/stili paragrafo/, 'title'],
  [/^allinea e applica rientro|allineamento › a sinistra/, 'alignLeft'],
  [/allineamento › al centro verticale/, 'alignMiddle'],
  [/allineamento › al centro/, 'alignCenter'],
  [/allineamento › a destra/, 'alignRight'],
  [/allineamento › in alto/, 'alignTop'],
  [/allineamento › in basso/, 'alignBottom'],
  [/interlinea/, 'lineSpacing'],
  [/^colonne/, 'view_column'],
  [/elenchi puntati/, 'listBullets'],
  [/intestazioni e piè/, 'web_asset'],
  [/numeri di pagina/, 'tag'],
  [/numeri di riga/, 'format_list_numbered'],
  [/orientamento/, 'crop_landscape'],
  [/senza pagine/, 'unfold_more'],
  [/togli il bordo/, 'border_clear'],
  [/spessore/, 'line_weight'],
  [/^bordi e linee › colore/, 'palette'],
  [/^bordi e linee/, 'border_style'],
  [/^numero › percentuale/, 'percent'],
  [/^numero › (valuta|contabilit|finanziario)/, 'currency'],
  [/^numero › (data|data e ora|data estesa)$/, 'event'],
  [/^numero › ora$/, 'schedule'],
  [/^numero › durata/, 'timer'],
  [/^numero/, 'pin'],
  // dati
  [/a -> z/, 'sortAsc'],
  [/z -> a/, 'sortDesc'],
  [/duplicati/, 'difference'],
  [/testo in colonne/, 'view_week'],
  [/rimuovi filtri/, 'filter_alt_off'],
  [/viste filtro/, 'filter_list'],
  [/crea un filtro/, 'filter'],
  [/casella di controllo/, 'checkbox'],
  [/intervalli denominati/, 'label'],
  // sommario e struttura (pmb_docs, 2026-11-20)
  [/^aggiorna sommario/, 'refresh'],
  [/^sommario$/, 'toc'],
  [/struttura del documento/, 'account_tree'],
  // leggi ad alta voce, codice QR, filigrana (2026-11-21)
  [/leggi .*ad alta voce/, 'record_voice_over'],
  [/codice qr/, 'qr_code_2'],
  [/filigrana/, 'format_color_text'],
  // maiuscole e minuscole (2026-11-21)
  [/› maiuscolo$|^maiuscolo$/, 'text_fields'],
  [/› minuscolo$|^minuscolo$/, 'text_fields'],
  [/iniziali maiuscole$/, 'text_fields'],
  [/› frase$|^frase$/, 'text_fields'],
  [/› inverti$|^inverti$/, 'text_fields'],
  [/cambia \(giro\)$/, 'text_fields'],
  // strumenti di pmb_sheets (2026-11-20)
  [/^mostra formule/, 'code'],
  [/^mostra precedenti/, 'call_received'],
  [/^mostra dipendenti/, 'call_made'],
  [/^togli le evidenziazioni/, 'layers_clear'],
  [/^ricerca obiettivo/, 'gps_fixed'],
  [/^subtotali/, 'functions'],
  [/^valuta formula/, 'rule'],
  [/^riempi serie/, 'format_list_numbered'],
  [/^minigrafico/, 'show_chart'],
  [/^stili di cella/, 'style'],
  [/^password per aprire/, 'lock'],
  [/^raggruppa e struttura/, 'account_tree'],
  [/^raggruppa$/, 'format_indent_increase'],
  [/^separa$/, 'format_indent_decrease'],
  [/^comprimi il gruppo/, 'unfold_less'],
  [/^espandi il gruppo/, 'unfold_more'],
  [/^cancella la struttura/, 'layers_clear'],
  [/^finestra controllo/, 'preview'],
  // protezione (pmb_sheets, 2026-11-20)
  [/^protezione celle › sblocca/, 'lock_open'],
  [/^protezione celle › blocca/, 'lock'],
  [/^protezione celle › nascondi/, 'visibility_off'],
  [/^protezione celle › mostra/, 'visibility'],
  [/^proteggi foglio/, 'shield'],
  [/^proteggi documento/, 'shield'],
  [/^proteggi la struttura/, 'security'],
  // commenti e modifiche registrate (pmb_docs, 2026-11-20)
  [/^commento$/, 'add_comment'],
  [/commenti e modifiche/, 'forum'],
  [/^revisioni › registra modifiche/, 'track_changes'],
  [/^revisioni › accetta tutte/, 'done_all'],
  [/^revisioni › rifiuta tutte/, 'remove_done'],
  [/^revisioni › accetta/, 'done'],
  [/^revisioni › rifiuta/, 'close'],
  [/^revisioni › modifica successiva/, 'skip_next'],
  [/^revisioni › modifica precedente/, 'skip_previous'],
  // strumenti e aiuto
  [/conteggio parole/, 'numbers'],
  [/dizionario/, 'menu_book'],
  [/correzione automatica/, 'auto_fix_high'],
  [/caratteri personali/, 'font_download'],
  [/preferenze/, 'settings'],
  [/accessibilit/, 'accessibility'],
  [/condizioni d'uso/, 'gavel'],
  [/licenze/, 'copyright'],
  [/aggiornamento/, 'system_update'],
  [/segnala un bug/, 'bug_report'],
  [/scorciatoie/, 'keyboard'],
];

/** L'icona usata quando nessuna regola riconosce la voce (una funzione nuova non ancora prevista qui). */
export const ICONA_GENERICA = 'apps';

function svgDi(nome: Nome): string | undefined {
  return (ICONE as Record<string, string>)[nome] ?? ICONE_MATERIAL[nome];
}

/** Nome dell'icona per una voce (per i test: dice se una voce è finita sull'icona generica). */
export function nomeIconaFunzione(etichetta: string): string {
  const e = etichetta.toLowerCase().replace(/\s+/g, ' ').replace(/[.…]+$/, '').trim();
  for (const [re, nome] of REGOLE) if (re.test(e) && svgDi(nome)) return nome;
  return ICONA_GENERICA;
}

/** L'icona SVG (18 px, colore del testo) di una funzione dei menu, dal suo nome italiano. */
export function iconaFunzione(etichetta: string): string {
  return svgDi(nomeIconaFunzione(etichetta)) ?? svgDi(ICONA_GENERICA)!;
}
