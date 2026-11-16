import { describe, it, expect } from 'vitest';
import {
  interpolateColor,
  evaluateConditionalFormats,
  ConditionalFormatRule,
} from '../../src/sheet/conditional-format';

describe('src/sheet/conditional-format.ts - Formattazione condizionale pura', () => {
  describe('interpolateColor', () => {
    it('interpola esattamente al 0%, 50% e 100%', () => {
      // Da nero (#000000) a bianco (#ffffff)
      expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000');
      expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#ffffff');
      expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    });

    it('interpola tra rosso (#ff0000) e verde (#00ff00)', () => {
      const mid = interpolateColor('#ff0000', '#00ff00', 0.5);
      expect(mid).toBe('#808000');
    });
  });

  describe('evaluateConditionalFormats - Valori e Testo', () => {
    const rules: ConditionalFormatRule[] = [
      {
        id: 'r1',
        type: 'cell_value',
        range: { startRow: 1, endRow: 10, startCol: 1, endCol: 5 },
        operator: 'greater_than',
        value1: 100,
        style: { backgroundColor: '#dcfce7', textColor: '#15803d', bold: true },
      },
      {
        id: 'r2',
        type: 'text',
        range: { startRow: 1, endRow: 10, startCol: 1, endCol: 5 },
        operator: 'contains',
        value1: 'critico',
        style: { backgroundColor: '#fee2e2', textColor: '#b91c1c' },
      },
    ];

    it('applica stile verde su numero maggiore di 100', () => {
      const res = evaluateConditionalFormats('150', 2, 2, rules);
      expect(res).not.toBeNull();
      expect(res!.backgroundColor).toBe('#dcfce7');
      expect(res!.textColor).toBe('#15803d');
      expect(res!.bold).toBe(true);
    });

    it('non applica stile se condizione numerica non soddisfatta', () => {
      const res = evaluateConditionalFormats('50', 2, 2, rules);
      expect(res).toBeNull();
    });

    it('applica stile rosso su testo contenente "critico"', () => {
      const res = evaluateConditionalFormats('Errore critico rilevato', 3, 1, rules);
      expect(res).not.toBeNull();
      expect(res!.backgroundColor).toBe('#fee2e2');
      expect(res!.textColor).toBe('#b91c1c');
    });
  });

  describe('evaluateConditionalFormats - Scale di colore e Barre dati', () => {
    const scaleRule: ConditionalFormatRule = {
      id: 'scale1',
      type: 'color_scale',
      range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
      colorScale: {
        minColor: '#ffffff',
        maxColor: '#000000',
      },
    };

    it('calcola colore interpolato nella scala', () => {
      const stats = { min: 0, max: 100, count: 5 };
      const resMid = evaluateConditionalFormats('50', 2, 1, [scaleRule], stats);
      expect(resMid).not.toBeNull();
      expect(resMid!.backgroundColor).toBe('#808080');
    });

    it('calcola percentuale per barre dati', () => {
      const dataBarRule: ConditionalFormatRule = {
        id: 'bar1',
        type: 'data_bar',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        dataBar: { color: '#3b82f6' },
      };
      const stats = { min: 0, max: 200, count: 5 };
      const res = evaluateConditionalFormats('150', 3, 1, [dataBarRule], stats);
      expect(res).not.toBeNull();
      expect(res!.dataBar).toEqual({ percent: 75, color: '#3b82f6' });
    });

    it('assegna icone nel set di frecce', () => {
      const iconRule: ConditionalFormatRule = {
        id: 'icon1',
        type: 'icon_set',
        range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 },
        iconSet: { type: 'arrows' },
      };
      const stats = { min: 0, max: 100, count: 5 };
      expect(evaluateConditionalFormats('90', 1, 1, [iconRule], stats)!.icon).toBe('arrow_up');
      expect(evaluateConditionalFormats('50', 2, 1, [iconRule], stats)!.icon).toBe('arrow_right');
      expect(evaluateConditionalFormats('10', 3, 1, [iconRule], stats)!.icon).toBe('arrow_down');
    });
  });
});
