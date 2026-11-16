/**
 * Registro dichiarativo della barra dei menu per pmb_office.
 * Definisce gerarchicamente le voci, scorciatoie e mnemonici del programma Fogli.
 */

export interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  mnemonic?: string; // Lettera per accesso con Alt
  disabled?: boolean;
  separator?: boolean;
  action?: string;
  subitems?: MenuItem[];
}

export interface MenuCategory {
  id: string;
  label: string;
  mnemonic: string;
  items: MenuItem[];
}

export const menuRegistry: MenuCategory[] = [
  {
    id: "file",
    label: "File",
    mnemonic: "F",
    items: [
      { id: "new-sheet", label: "Nuovo foglio di calcolo", action: "new-sheet" },
      { id: "open", label: "Apri...", shortcut: "Ctrl+O", action: "open-file" },
      { id: "sep-1", label: "", separator: true },
      { id: "save", label: "Salva", shortcut: "Ctrl+S", action: "save-file" },
      { id: "save-as", label: "Salva con nome...", shortcut: "Ctrl+Shift+S", action: "save-as-file" },
      { id: "download-xlsx", label: "Scarica come cartella di lavoro (.xlsx)", action: "download-xlsx" },
      { id: "download-csv", label: "Scarica come CSV (.csv)", action: "download-csv" },
      { id: "download-fsheet", label: "Scarica come pmb_sheets (.psheet)", action: "download-fsheet" },
      { id: "download-ods", label: "Scarica come OpenDocument (.ods)", action: "download-ods" },
      { id: "download-pdf", label: "Scarica come Documento PDF (.pdf)", action: "download-pdf" },
      { id: "sep-2", label: "", separator: true },
      { id: "print", label: "Stampa", shortcut: "Ctrl+P", action: "print" },
      { id: "sep-3", label: "", separator: true },
      { id: "exit", label: "Esci", shortcut: "Alt+F4", action: "exit-app" },
    ],
  },
  {
    id: "edit",
    label: "Modifica",
    mnemonic: "M",
    items: [
      { id: "undo", label: "Annulla", shortcut: "Ctrl+Z", action: "undo" },
      { id: "redo", label: "Ripeti", shortcut: "Ctrl+Y", action: "redo" },
      { id: "sep-1", label: "", separator: true },
      { id: "cut", label: "Taglia", shortcut: "Ctrl+X", action: "cut" },
      { id: "copy", label: "Copia", shortcut: "Ctrl+C", action: "copy" },
      { id: "paste", label: "Incolla", shortcut: "Ctrl+V", action: "paste" },
      {
        id: "paste-special",
        label: "Incolla speciale",
        subitems: [
          { id: "paste-values", label: "Solo valori", shortcut: "Ctrl+Shift+V", action: "paste-special-values" },
          { id: "paste-format", label: "Solo formato", action: "paste-special-format" },
          { id: "paste-formulas", label: "Formule senza formato", action: "paste-special-formulas" },
          { id: "paste-transposed", label: "Trasposto", action: "paste-special-transposed" },
        ],
      },
      { id: "sep-edit-struct", label: "", separator: true },
      { id: "delete-row", label: "Elimina riga", action: "delete-row" },
      { id: "delete-col", label: "Elimina colonna", action: "delete-col" },
      { id: "sep-2", label: "", separator: true },
      { id: "select-all", label: "Seleziona tutto", shortcut: "Ctrl+A", action: "select-all" },
      { id: "find-replace", label: "Trova e sostituisci", shortcut: "Ctrl+H", action: "find-replace" },
    ],
  },
  {
    id: "view",
    label: "Visualizza",
    mnemonic: "V",
    items: [
      { id: "theme-light", label: "Tema chiaro", action: "set-theme-light" },
      { id: "theme-dark", label: "Tema scuro", action: "set-theme-dark" },
      { id: "theme-system", label: "Tema di sistema", action: "set-theme-system" },
      { id: "sep-1", label: "", separator: true },
      {
        id: "freeze-panes",
        label: "Blocca",
        subitems: [
          { id: "freeze-rows-0", label: "Nessuna riga", action: "freeze-rows-0" },
          { id: "freeze-rows-1", label: "1 riga", action: "freeze-rows-1" },
          { id: "freeze-rows-2", label: "2 righe", action: "freeze-rows-2" },
          { id: "sep-freeze", label: "", separator: true },
          { id: "freeze-cols-0", label: "Nessuna colonna", action: "freeze-cols-0" },
          { id: "freeze-cols-1", label: "1 colonna", action: "freeze-cols-1" },
          { id: "freeze-cols-2", label: "2 colonne", action: "freeze-cols-2" },
          { id: "sep-freeze-cella", label: "", separator: true },
          { id: "freeze-to-row", label: "Fino alla riga corrente", action: "freeze-to-row" },
          { id: "freeze-to-col", label: "Fino alla colonna corrente", action: "freeze-to-col" },
          { id: "freeze-to-cell", label: "Fino alla cella corrente", action: "freeze-to-cell" },
        ],
      },
      { id: "sep-view-freeze", label: "", separator: true },
      { id: "toggle-sidebar", label: "Mostra pannello laterale", shortcut: "Ctrl+Alt+S", action: "toggle-sidebar" },
      { id: "personalizza-barra", label: "Personalizza barra degli strumenti…", action: "personalizza-barra" },
      { id: "toggle-fullscreen", label: "Schermo intero", shortcut: "F11", action: "toggle-fullscreen" },
      { id: "nascondi-menu", label: "Nascondi i menu", shortcut: "Ctrl+Maiusc+F", action: "nascondi-menu" },
      { id: "sep-2", label: "", separator: true },
      {
        id: "zoom",
        label: "Zoom",
        subitems: [
          { id: "zoom-50", label: "50%", action: "zoom-50" },
          { id: "zoom-75", label: "75%", action: "zoom-75" },
          { id: "zoom-100", label: "100%", action: "zoom-100" },
          { id: "zoom-125", label: "125%", action: "zoom-125" },
          { id: "zoom-150", label: "150%", action: "zoom-150" },
        ],
      },
    ],
  },
  {
    id: "insert",
    label: "Inserisci",
    mnemonic: "I",
    items: [
      { id: "insert-row-above", label: "Riga sopra", action: "insert-row-above" },
      { id: "insert-row-below", label: "Riga sotto", action: "insert-row-below" },
      { id: "insert-col-left", label: "Colonna a sinistra", action: "insert-col-left" },
      { id: "insert-col-right", label: "Colonna a destra", action: "insert-col-right" },
      { id: "insert-sheet", label: "Nuovo foglio", action: "insert-sheet" },
      { id: "sep-ins-struct", label: "", separator: true },
      { id: "insert-image", label: "Immagine", action: "insert-image" },
      { id: "insert-table", label: "Tabella", action: "insert-table" },
      { id: "insert-chart", label: "Grafico...", action: "insert-chart" },
      { id: "insert-pivot", label: "Tabella pivot...", action: "insert-pivot" },
      { id: "insert-link", label: "Link", shortcut: "Ctrl+K", action: "insert-link" },
      { id: "sep-1", label: "", separator: true },
      { id: "insert-comment", label: "Commento", shortcut: "Ctrl+Alt+M", action: "insert-comment" },
    ],
  },
  {
    id: "format",
    label: "Formato",
    mnemonic: "O",
    items: [
      { id: "bold", label: "Grassetto", shortcut: "Ctrl+B", action: "format-bold" },
      { id: "italic", label: "Corsivo", shortcut: "Ctrl+I", action: "format-italic" },
      { id: "underline", label: "Sottolineato", shortcut: "Ctrl+U", action: "format-underline" },
      { id: "strike", label: "Barrato", shortcut: "Ctrl+Shift+X", action: "format-strike" },
      { id: "sep-fmt-1", label: "", separator: true },
      {
        id: "align",
        label: "Allineamento",
        subitems: [
          { id: "align-left", label: "A sinistra", action: "align-left" },
          { id: "align-center", label: "Al centro", action: "align-center" },
          { id: "align-right", label: "A destra", action: "align-right" },
          { id: "sep-valign", label: "", separator: true },
          { id: "align-top", label: "In alto", action: "align-top" },
          { id: "align-middle", label: "Al centro verticale", action: "align-middle" },
          { id: "align-bottom", label: "In basso", action: "align-bottom" },
        ],
      },
      {
        id: "number-format",
        label: "Numero",
        subitems: [
          { id: "num-auto", label: "Automatico", action: "set-num-fmt-auto" },
          { id: "num-plain", label: "Testo normale", action: "set-num-fmt-text" },
          { id: "num-number", label: "Numero", shortcut: "Ctrl+Shift+1", action: "set-num-fmt-number" },
          { id: "num-percent", label: "Percentuale", shortcut: "Ctrl+Shift+5", action: "format-percent" },
          { id: "num-currency", label: "Valuta", shortcut: "Ctrl+Shift+4", action: "format-currency" },
          { id: "num-scientific", label: "Scientifico", action: "set-num-fmt-scientific" },
          { id: "num-date", label: "Data", action: "set-num-fmt-date" },
          { id: "num-time", label: "Ora", action: "set-num-fmt-time" },
          { id: "num-datetime", label: "Data e ora", action: "set-num-fmt-datetime" },
          { id: "num-duration", label: "Durata", action: "set-num-fmt-duration" },
          { id: "sep-num-more", label: "", separator: true },
          { id: "num-accounting", label: "Contabilità", action: "set-num-fmt-accounting" },
          { id: "num-financial", label: "Finanziario", action: "set-num-fmt-financial" },
          { id: "num-currency-round", label: "Valuta arrotondata", action: "set-num-fmt-currency-round" },
          { id: "num-negative-red", label: "Negativi in rosso", action: "set-num-fmt-negative-red" },
          { id: "num-fraction", label: "Frazione", action: "set-num-fmt-fraction" },
          { id: "num-date-long", label: "Data estesa", action: "set-num-fmt-date-long" },
          { id: "sep-num-custom", label: "", separator: true },
          { id: "num-custom", label: "Altri formati…", action: "open-custom-num-fmt" },
        ],
      },
      { id: "sep-fmt-2", label: "", separator: true },
      { id: "clear-formatting", label: "Cancella formattazione", shortcut: "Ctrl+\\", action: "clear-formatting" },
    ],
  },
  {
    id: "data",
    label: "Dati",
    mnemonic: "D", // Compare SOLO nei Fogli
    items: [
      { id: "sort-asc", label: "Ordina intervallo per colonna A -> Z", action: "sort-asc" },
      { id: "sort-desc", label: "Ordina intervallo per colonna Z -> A", action: "sort-desc" },
      { id: "sep-sort", label: "", separator: true },
      { id: "create-filter", label: "Crea un filtro", action: "create-filter" },
      { id: "clear-filter", label: "Rimuovi filtri", action: "clear-filter" },
      { id: "filter-views", label: "Viste filtro...", action: "filter-views" },
      { id: "sep-filter", label: "", separator: true },
      { id: "insert-pivot-data", label: "Tabella pivot...", action: "insert-pivot" },
      { id: "data-validation", label: "Convalida dei dati...", action: "data-validation" },
      { id: "insert-checkbox", label: "Inserisci casella di controllo", action: "insert-checkbox" },
      { id: "named-ranges", label: "Intervalli denominati...", action: "named-ranges" },
      { id: "clear-validation", label: "Rimuovi convalida dei dati", action: "clear-validation" },
      { id: "conditional-format", label: "Formattazione condizionale...", action: "conditional-format" },
      { id: "clear-conditional-format", label: "Rimuovi formattazione condizionale", action: "clear-conditional-format" },
      { id: "sep-merge", label: "", separator: true },
      {
        id: "merge-cells-menu",
        label: "Unisci celle",
        subitems: [
          { id: "merge-all", label: "Unisci tutto", action: "merge-all" },
          { id: "merge-horizontal", label: "Unisci orizzontalmente", action: "merge-horizontal" },
          { id: "merge-vertical", label: "Unisci verticalmente", action: "merge-vertical" },
          { id: "unmerge", label: "Annulla unione", action: "unmerge" },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "Strumenti",
    mnemonic: "S",
    items: [
      { id: "spelling", label: "Controllo ortografico", shortcut: "F7", action: "spelling" },
      { id: "menu-search", label: "Cerca nei menu", shortcut: "Alt+/", action: "open-menu-search" },
      { id: "sep-1", label: "", separator: true },
      { id: "preferences", label: "Preferenze", action: "open-preferences" },
    ],
  },
  {
    id: "help",
    label: "Aiuto",
    mnemonic: "A",
    items: [
      { id: "shortcuts", label: "Scorciatoie da tastiera", shortcut: "Ctrl+/", action: "show-shortcuts" },
      { id: "about", label: "Informazioni su pmb_sheets", action: "about-app" },
    ],
  },
  {
    id: "info",
    label: "Informazioni",
    mnemonic: "N",
    items: [
      { id: "info-app", label: "Informazioni su pmb_sheets", action: "info-app" },
      { id: "info-condizioni", label: "Condizioni d'uso", action: "info-condizioni" },
      { id: "info-licenze", label: "Licenze di terze parti", action: "info-licenze" },
      { id: "info-segnala", label: "Segnala un bug o invia un feedback", action: "info-segnala" },
    ],
  },
];

/**
 * Ottiene l'elenco piatto di tutte le voci eseguibili per la ricerca menu (Alt+/)
 */
export function getAllExecutableMenuItems(): MenuItem[] {
  const result: MenuItem[] = [];

  function traverse(items: MenuItem[], prefix = "") {
    for (const item of items) {
      if (item.separator) continue;

      const fullLabel = prefix ? `${prefix} > ${item.label}` : item.label;

      if (item.subitems && item.subitems.length > 0) {
        traverse(item.subitems, fullLabel);
      } else if (item.action) {
        result.push({
          ...item,
          label: fullLabel,
        });
      }
    }
  }

  for (const cat of menuRegistry) {
    traverse(cat.items, cat.label);
  }

  return result;
}
