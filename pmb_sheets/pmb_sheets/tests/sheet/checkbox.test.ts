import { describe, it, expect } from 'vitest';
import {
  isCheckboxCell,
  isCheckboxChecked,
  toggleCheckboxValue,
  getCheckboxSvgMarkup,
} from '../../src/sheet/checkbox';

describe('src/sheet/checkbox.ts - Caselle di controllo pure', () => {
  it('riconosce casella da regola o valore', () => {
    expect(isCheckboxCell({ id: '1', type: 'checkbox', action: 'reject' })).toBe(true);
    expect(isCheckboxCell(undefined, 'TRUE')).toBe(true);
    expect(isCheckboxCell(undefined, 'FALSE')).toBe(true);
    expect(isCheckboxCell(undefined, 'VERO')).toBe(true);
    expect(isCheckboxCell(undefined, 'FALSO')).toBe(true);
    expect(isCheckboxCell(undefined, 'Testo normale')).toBe(false);
  });

  it('identifica stato di spunta', () => {
    expect(isCheckboxChecked('TRUE')).toBe(true);
    expect(isCheckboxChecked('VERO')).toBe(true);
    expect(isCheckboxChecked('true')).toBe(true);
    expect(isCheckboxChecked('FALSE')).toBe(false);
    expect(isCheckboxChecked('')).toBe(false);
  });

  it('inverte il valore con toggleCheckboxValue', () => {
    expect(toggleCheckboxValue('TRUE')).toBe('FALSE');
    expect(toggleCheckboxValue('FALSE')).toBe('TRUE');
    expect(toggleCheckboxValue('')).toBe('TRUE');
  });

  it('produce markup SVG pulito per stato attivo e inattivo', () => {
    const checkedSvg = getCheckboxSvgMarkup(true);
    const uncheckedSvg = getCheckboxSvgMarkup(false);
    expect(checkedSvg).toContain('sheet-checkbox checked');
    expect(uncheckedSvg).toContain('sheet-checkbox unchecked');
    expect(checkedSvg).not.toContain('style=');
    expect(uncheckedSvg).not.toContain('style=');
  });
});
