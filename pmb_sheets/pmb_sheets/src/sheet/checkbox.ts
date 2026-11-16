/**
 * Modulo puro per Caselle di Controllo (Checkboxes) in Fogli (pmb_office).
 * Gestisce:
 * - Riconoscimento celle checkbox (tramite regola di convalida o valore booleano).
 * - Toggle rapido del valore (TRUE <-> FALSE).
 * - Generazione SVG deterministico per casella attiva / inattiva (nessun asset esterno).
 * Zero DOM, zero dipendenze esterne.
 */

import { DataValidationRule } from './data-validation';

export function isCheckboxCell(rule?: DataValidationRule, rawValue?: string): boolean {
  if (rule && rule.type === 'checkbox') return true;
  if (!rawValue) return false;
  const upper = rawValue.trim().toUpperCase();
  return upper === 'TRUE' || upper === 'FALSE' || upper === 'VERO' || upper === 'FALSO';
}

export function isCheckboxChecked(rawValue?: string): boolean {
  if (!rawValue) return false;
  const upper = rawValue.trim().toUpperCase();
  return upper === 'TRUE' || upper === 'VERO';
}

export function toggleCheckboxValue(currentValue?: string): string {
  const checked = isCheckboxChecked(currentValue);
  return checked ? 'FALSE' : 'TRUE';
}

/**
 * Restituisce il codice SVG matematicamente pulito per la casella di controllo.
 * Non usa attributi style in linea.
 */
export function getCheckboxSvgMarkup(checked: boolean): string {
  if (checked) {
    // Casella spuntata con segno di spunta blu
    return `<svg class="sheet-checkbox checked" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>`;
  }
  // Casella vuota con contorno
  return `<svg class="sheet-checkbox unchecked" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
  </svg>`;
}
