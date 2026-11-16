/**
 * Formati numerici pronti del menu Formato > Numero e della barra strumenti, più gli esempi della finestra "Formato personalizzato".
 * I codici sono scritti come in Excel (punto decimale, virgola per le migliaia: la lingua la mette il programma quando disegna).
 * Modulo puro.
 */

export interface FormatoPreimpostato {
  /** nome breve, usato nell'azione (`set-num-fmt-<id>`) e come valore del menu a tendina */
  id: string;
  nome: string;
  codice: string;
  /** una riga di spiegazione per la finestra dei formati personalizzati */
  descrizione: string;
}

export const FORMATI_PREIMPOSTATI_ELENCO: readonly FormatoPreimpostato[] = [
  { id: 'accounting', nome: 'Contabilità', codice: '_(€* #,##0.00_);_(€* (#,##0.00);_(€* "-"??_);_(@_)', descrizione: 'valuta con i negativi tra parentesi e un trattino per lo zero' },
  { id: 'financial', nome: 'Finanziario', codice: '#,##0.00;(#,##0.00)', descrizione: 'migliaia e decimali, negativi tra parentesi' },
  { id: 'currency-round', nome: 'Valuta arrotondata', codice: '€#,##0', descrizione: 'euro senza decimali' },
  { id: 'duration', nome: 'Durata', codice: '[h]:mm:ss', descrizione: 'ore, minuti e secondi, anche oltre le 24 ore' },
  { id: 'fraction', nome: 'Frazione', codice: '# ?/?', descrizione: 'il numero come frazione (3 1/4)' },
  { id: 'date-long', nome: 'Data estesa', codice: 'dddd d mmmm yyyy', descrizione: 'mercoledì 15 marzo 2023' },
  { id: 'negative-red', nome: 'Negativi in rosso', codice: '#,##0.00;[Red]-#,##0.00', descrizione: 'i numeri negativi si vedono in rosso' },
];

export const FORMATI_PREIMPOSTATI_PER_ID: Readonly<Record<string, FormatoPreimpostato>> = Object.fromEntries(FORMATI_PREIMPOSTATI_ELENCO.map((f) => [f.id, f]));

/** id → codice, per il menu a tendina della barra strumenti. */
export const FORMATI_PREIMPOSTATI: Readonly<Record<string, string>> = Object.fromEntries(FORMATI_PREIMPOSTATI_ELENCO.map((f) => [f.id, f.codice]));

/** Esempi di codici da scrivere a mano, per la finestra del formato personalizzato. */
export const ESEMPI_FORMATO: ReadonlyArray<{ codice: string; descrizione: string }> = [
  { codice: '0.00', descrizione: 'due decimali' },
  { codice: '#,##0', descrizione: 'migliaia, senza decimali' },
  { codice: '0.0%', descrizione: 'percentuale con un decimale' },
  { codice: '000000', descrizione: 'sei cifre con zeri davanti' },
  { codice: '#,##0.00;[Red]-#,##0.00;"zero"', descrizione: 'tre sezioni: positivi, negativi, zero' },
  { codice: '[>=100]"alto";"basso"', descrizione: 'testo secondo una condizione' },
  { codice: '0.0,,"M"', descrizione: 'milioni (1,2M)' },
  { codice: 'dd/mm/yyyy hh:mm', descrizione: 'data e ora' },
];

/** Il formato pronto che ha esattamente questo codice (per mostrare il menu a tendina sulla voce giusta), o undefined. */
export function formatoPreimpostatoDelCodice(codice: string | undefined | null): FormatoPreimpostato | undefined {
  if (!codice) return undefined;
  return FORMATI_PREIMPOSTATI_ELENCO.find((f) => f.codice === codice);
}
