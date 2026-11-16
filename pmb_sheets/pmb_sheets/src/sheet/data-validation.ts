import { t } from '../i18n/lingua';
/**
 * Modulo puro di Convalida Dati per Fogli (pmb_office).
 * Gestisce:
 * - Regole di convalida:
 *   - Elenco a discesa (da valori separati da virgola o da intervallo)
 *   - Numeri (interi o decimali con operatori: compreso, non compreso, maggiore, minore, uguale)
 *   - Date (date valide, intervalli temporali)
 *   - Lunghezza testo o contenuto testuale
 *   - Formule personalizzate
 *   - Caselle di controllo (checkbox boolean TRUE/FALSE)
 * - Azione su errore: rifiuta immissione ('reject') o mostra avviso ('warn').
 * - Messaggi di aiuto e motivazione dell'errore.
 * Zero DOM, zero dipendenze esterne.
 */

export type ValidationType = 'list' | 'number' | 'date' | 'text_length' | 'custom' | 'checkbox';

export type ValidationOperator =
  | 'between'
  | 'not_between'
  | 'equal_to'
  | 'not_equal_to'
  | 'greater_than'
  | 'greater_equal'
  | 'less_than'
  | 'less_equal';

export interface DataValidationRule {
  id: string;
  type: ValidationType;
  operator?: ValidationOperator;
  value1?: string | number;
  value2?: string | number;
  listItems?: string[]; // Per liste a discesa con voci fisse
  listRange?: string;   // Per liste a discesa da intervallo di celle (es. "A1:A10" o "Foglio1!A1:B5")
  allowEmpty?: boolean;
  action: 'reject' | 'warn';
  helpText?: string;
}

export interface ValidationResult {
  valid: boolean;
  action: 'reject' | 'warn';
  message?: string;
}

/**
 * Converte una stringa di valori separati da virgola in array normalizzato di opzioni.
 */
export function parseListItems(input: string): string[] {
  if (!input) return [];
  const trimmed = input.trim();
  // Se è un riferimento a un intervallo o cella (es. "=A1:A10" o "A1:A10" o "Foglio1!A1:B5") non lo spezza con la virgola
  if (trimmed.startsWith('=')) return [trimmed];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Valuta se un valore di cella è conforme alla regola di convalida specificata.
 */
export function validateCellValue(
  value: string | undefined | null,
  rule: DataValidationRule,
  customFormulaEvaluator?: (formula: string) => boolean,
  resolvedListItems?: string[]
): ValidationResult {
  const str = (value ?? '').trim();

  // Se vuota ed è consentita
  if (str === '') {
    if (rule.allowEmpty !== false) {
      return { valid: true, action: rule.action };
    }
    return {
      valid: false,
      action: rule.action,
      message: rule.helpText || t("Il campo non può essere lasciato vuoto."),
    };
  }

  // 1. Casella di controllo (Checkbox)
  if (rule.type === 'checkbox') {
    const upper = str.toUpperCase();
    const isBool = upper === 'TRUE' || upper === 'FALSE' || upper === 'VERO' || upper === 'FALSO';
    return {
      valid: isBool,
      action: rule.action,
      message: isBool ? undefined : (rule.helpText || t("Valore booleano atteso (VERO/FALSO).")),
    };
  }

  // 2. Elenco a discesa (List)
  if (rule.type === 'list') {
    const items = resolvedListItems || rule.listItems || [];
    const lower = str.toLowerCase();
    const match = items.some((it) => it.trim().toLowerCase() === lower);
    return {
      valid: match,
      action: rule.action,
      message: match ? undefined : (rule.helpText || (items.length > 0 ? t("Valore non presente nell'elenco consentito: {}", items.join(', ')) : t("Valore non presente nell'elenco consentito."))),
    };
  }

  // 3. Numeri
  if (rule.type === 'number') {
    const num = Number(str);
    if (Number.isNaN(num)) {
      return {
        valid: false,
        action: rule.action,
        message: rule.helpText || t("Inserire un valore numerico valido."),
      };
    }
    const val1 = Number(rule.value1);
    const val2 = Number(rule.value2);
    const op = rule.operator || 'between';

    let ok = true;
    switch (op) {
      case 'between':
        ok = !Number.isNaN(val1) && !Number.isNaN(val2) && num >= val1 && num <= val2;
        break;
      case 'not_between':
        ok = !Number.isNaN(val1) && !Number.isNaN(val2) && (num < val1 || num > val2);
        break;
      case 'equal_to':
        ok = !Number.isNaN(val1) && num === val1;
        break;
      case 'not_equal_to':
        ok = !Number.isNaN(val1) && num !== val1;
        break;
      case 'greater_than':
        ok = !Number.isNaN(val1) && num > val1;
        break;
      case 'greater_equal':
        ok = !Number.isNaN(val1) && num >= val1;
        break;
      case 'less_than':
        ok = !Number.isNaN(val1) && num < val1;
        break;
      case 'less_equal':
        ok = !Number.isNaN(val1) && num <= val1;
        break;
    }

    return {
      valid: ok,
      action: rule.action,
      message: ok ? undefined : (rule.helpText || t("Il numero {} non rispetta i vincoli numerici.", num)),
    };
  }

  // 4. Date
  if (rule.type === 'date') {
    const timestamp = Date.parse(str);
    if (Number.isNaN(timestamp)) {
      return {
        valid: false,
        action: rule.action,
        message: rule.helpText || t("Inserire una data valida."),
      };
    }
    if (rule.value1) {
      const limit1 = Date.parse(String(rule.value1));
      const op = rule.operator || 'greater_equal';
      let ok = true;
      if (!Number.isNaN(limit1)) {
        if (op === 'greater_than') ok = timestamp > limit1;
        else if (op === 'greater_equal') ok = timestamp >= limit1;
        else if (op === 'less_than') ok = timestamp < limit1;
        else if (op === 'less_equal') ok = timestamp <= limit1;
        else if (op === 'between' && rule.value2) {
          const limit2 = Date.parse(String(rule.value2));
          ok = !Number.isNaN(limit2) && timestamp >= limit1 && timestamp <= limit2;
        }
      }
      return {
        valid: ok,
        action: rule.action,
        message: ok ? undefined : (rule.helpText || t("La data non rispetta l intervallo consentito.")),
      };
    }
    return { valid: true, action: rule.action };
  }

  // 5. Lunghezza testo
  if (rule.type === 'text_length') {
    const len = str.length;
    const min = Number(rule.value1) || 0;
    const max = Number(rule.value2);
    const op = rule.operator || 'between';

    let ok = true;
    if (op === 'between' && !Number.isNaN(max)) {
      ok = len >= min && len <= max;
    } else if (op === 'less_equal') {
      ok = len <= min;
    } else if (op === 'greater_equal') {
      ok = len >= min;
    }

    return {
      valid: ok,
      action: rule.action,
      message: ok ? undefined : (rule.helpText || t("La lunghezza del testo ({}) non è valida.", len)),
    };
  }

  // 6. Formula personalizzata
  if (rule.type === 'custom') {
    const formula = String(rule.value1 || '');
    if (!formula || !customFormulaEvaluator) {
      return { valid: true, action: rule.action };
    }
    const ok = customFormulaEvaluator(formula);
    return {
      valid: ok,
      action: rule.action,
      message: ok ? undefined : (rule.helpText || t("La formula personalizzata ha restituito FALSO.")),
    };
  }

  return { valid: true, action: rule.action };
}
