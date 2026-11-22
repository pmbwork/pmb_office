/**
 * Registro dichiarativo della barra degli strumenti per pmb_office.
 * Definisce i gruppi di pulsanti della barra degli strumenti di Fogli.
 */

import { icons } from "../assets/icons/index";

export type ToolbarItemType = "button" | "select" | "separator";

export interface ToolbarItem {
  id: string;
  type: ToolbarItemType;
  label: string;
  tooltip: string;
  icon?: string;
  action: string;
  active?: boolean;
  disabled?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export interface ToolbarGroup {
  id: string;
  label?: string;
  priority?: number;
  items: ToolbarItem[];
  /** pezzo di un gruppo più lungo (barra personalizzata): niente linea di separazione dopo, il gruppo continua nel pezzo seguente */
  continua?: boolean;
}

export const sheetToolbar: ToolbarGroup[] = [
  {
    id: "history",
    label: "Cronologia",
    priority: 1,
    items: [
      { id: "undo", type: "button", label: "Annulla", tooltip: "Annulla (Ctrl+Z)", icon: icons.undo, action: "undo" },
      { id: "redo", type: "button", label: "Ripeti", tooltip: "Ripeti (Ctrl+Y)", icon: icons.redo, action: "redo" },
      { id: "print", type: "button", label: "Stampa", tooltip: "Stampa (Ctrl+P)", icon: icons.print, action: "print" },
      { id: "format-painter", type: "button", label: "Copia formato", tooltip: "Copia formato", icon: icons.formatPainter, action: "format-painter" },
    ],
  },
  {
    id: "sheet-formats",
    label: "Formati numerici",
    priority: 2,
    items: [
      { id: "format-currency", type: "button", label: "Valuta", tooltip: "Formatta come valuta (Ctrl+Maiusc+4)", icon: icons.currency, action: "format-currency" },
      { id: "format-percent", type: "button", label: "Percentuale", tooltip: "Formatta come percentuale (Ctrl+Maiusc+5)", icon: icons.percent, action: "format-percent" },
      { id: "decrease-decimals", type: "button", label: "Diminuisci decimali", tooltip: "Diminuisci decimali", icon: icons.decreaseDecimals, action: "decrease-decimals" },
      { id: "increase-decimals", type: "button", label: "Aumenta decimali", tooltip: "Aumenta decimali", icon: icons.increaseDecimals, action: "increase-decimals" },
      {
        id: "number-format-select",
        type: "select",
        label: "Formato numero",
        tooltip: "Formati numerici",
        action: "change-number-format",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Automatico" },
          { value: "text", label: "Testo" },
          { value: "number", label: "Numero" },
          { value: "percent", label: "Percentuale" },
          { value: "currency", label: "Valuta" },
          { value: "scientific", label: "Scientifico" },
          { value: "date", label: "Data" },
          { value: "time", label: "Ora" },
          { value: "datetime", label: "Data e ora" },
          { value: "duration", label: "Durata" },
          { value: "accounting", label: "Contabilità" },
          { value: "financial", label: "Finanziario" },
          { value: "currency-round", label: "Valuta arrotondata" },
          { value: "negative-red", label: "Negativi in rosso" },
          { value: "fraction", label: "Frazione" },
          { value: "date-long", label: "Data estesa" },
          { value: "custom", label: "Altri formati…" },
        ],
      },
    ],
  },
  {
    id: "typography",
    label: "Carattere",
    priority: 2,
    items: [
      {
        id: "font-family",
        type: "select",
        label: "Carattere",
        tooltip: "Famiglia carattere",
        action: "change-font",
        defaultValue: "Inter",
        options: [
          { value: "Inter", label: "Inter" },
          { value: "Roboto", label: "Roboto" },
          { value: "sans-serif", label: "Sans-Serif" },
          { value: "monospace", label: "Monospace" },
          { value: "serif", label: "Serif" },
        ],
      },
      {
        id: "font-size",
        type: "select",
        label: "Dimensione carattere",
        tooltip: "Dimensione carattere",
        action: "change-size",
        defaultValue: "10",
        options: [
          { value: "8", label: "8" },
          { value: "9", label: "9" },
          { value: "10", label: "10" },
          { value: "11", label: "11" },
          { value: "12", label: "12" },
          { value: "14", label: "14" },
          { value: "16", label: "16" },
          { value: "18", label: "18" },
          { value: "24", label: "24" },
          { value: "36", label: "36" },
          { value: "48", label: "48" },
          { value: "72", label: "72" },
        ],
      },
    ],
  },
  {
    id: "styling",
    label: "Stile carattere",
    priority: 3,
    items: [
      { id: "bold", type: "button", label: "Grassetto", tooltip: "Grassetto (Ctrl+B)", icon: icons.bold, action: "format-bold" },
      { id: "italic", type: "button", label: "Corsivo", tooltip: "Corsivo (Ctrl+I)", icon: icons.italic, action: "format-italic" },
      { id: "underline", type: "button", label: "Sottolineato", tooltip: "Sottolineato (Ctrl+U)", icon: icons.underline, action: "format-underline" },
      { id: "strike", type: "button", label: "Barrato", tooltip: "Barrato (Ctrl+Maiusc+X)", icon: icons.strike, action: "format-strike" },
    ],
  },
  {
    id: "colors",
    label: "Colori",
    priority: 4,
    items: [
      { id: "text-color", type: "button", label: "Colore testo", tooltip: "Colore testo", icon: icons.textColor, action: "format-text-color" },
      { id: "fill-color", type: "button", label: "Colore riempimento", tooltip: "Colore riempimento", icon: icons.fillColor, action: "format-fill-color" },
    ],
  },
  {
    id: "cell-operations",
    label: "Bordi",
    priority: 5,
    items: [
      {
        id: "borders-select",
        type: "select",
        label: "Bordi",
        tooltip: "Bordi celle",
        action: "format-borders",
        defaultValue: "none",
        options: [
          { value: "all", label: "Tutti i bordi" },
          { value: "outer", label: "Bordi esterni" },
          { value: "top", label: "Bordo superiore" },
          { value: "bottom", label: "Bordo inferiore" },
          { value: "left", label: "Bordo sinistro" },
          { value: "right", label: "Bordo destro" },
          { value: "none", label: "Nessun bordo" },
        ],
      },
      {
        id: "border-style-select",
        type: "select",
        label: "Stile bordo",
        tooltip: "Stile linea bordo",
        action: "change-border-style",
        defaultValue: "thin",
        options: [
          { value: "thin", label: "Sottile" },
          { value: "medium", label: "Medio" },
          { value: "dashed", label: "Tratteggiato" },
        ],
      },
      {
        id: "border-color",
        type: "button",
        label: "Colore bordo",
        tooltip: "Colore bordo",
        icon: icons.borderColor,
        action: "format-border-color",
      },
    ],
  },
  {
    id: "alignment",
    label: "Allineamento",
    priority: 6,
    items: [
      { id: "align-left", type: "button", label: "Sinistra", tooltip: "Allinea a sinistra", icon: icons.alignLeft, action: "align-left" },
      { id: "align-center", type: "button", label: "Centro", tooltip: "Allinea al centro", icon: icons.alignCenter, action: "align-center" },
      { id: "align-right", type: "button", label: "Destra", tooltip: "Allinea a destra", icon: icons.alignRight, action: "align-right" },
      { id: "align-top", type: "button", label: "In alto", tooltip: "Allinea in alto", icon: icons.alignTop, action: "align-top" },
      { id: "align-middle", type: "button", label: "Al centro verticale", tooltip: "Allinea al centro verticale", icon: icons.alignMiddle, action: "align-middle" },
      { id: "align-bottom", type: "button", label: "In basso", tooltip: "Allinea in basso", icon: icons.alignBottom, action: "align-bottom" },
      { id: "wrap-text", type: "button", label: "Testo a capo", tooltip: "Testo a capo", icon: icons.wrapText, action: "format-wrap" },
    ],
  },
  {
    id: "tools",
    label: "Strumenti",
    priority: 7,
    items: [
      { id: "merge-cells", type: "button", label: "Unisci celle", tooltip: "Unisci celle", icon: icons.mergeCells, action: "merge-all" },
      { id: "create-filter", type: "button", label: "Filtro", tooltip: "Crea filtro", icon: icons.filter, action: "create-filter" },
      { id: "insert-chart", type: "button", label: "Grafico", tooltip: "Inserisci grafico", icon: icons.chart, action: "insert-chart" },
      { id: "insert-pivot", type: "button", label: "Tabella pivot", tooltip: "Inserisci tabella pivot", icon: icons.pivot, action: "insert-pivot" },
      { id: "clear-formatting", type: "button", label: "Cancella formato", tooltip: "Cancella formattazione (Ctrl+\\)", icon: icons.clearFormatting, action: "clear-formatting" },
    ],
  },
];

export function getToolbarFogli(): ToolbarGroup[] {
  return sheetToolbar;
}
