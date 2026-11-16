import { describe, it, expect } from 'vitest';
import {
  parseColorToRgb,
  getRelativeLuminance,
  getContrastRatio,
  getAutoTextColorForBackground,
  resolveEffectiveTextColor,
} from '../../src/sheet/contrast';

describe('Contrast Module & Auto Text Color (WCAG 2.1 AA >= 4.5:1)', () => {
  it('parsa correttamente i formati di colore esadecimali e rgb', () => {
    expect(parseColorToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColorToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseColorToRgb('#fef08a')).toEqual({ r: 254, g: 240, b: 138 });
    expect(parseColorToRgb('rgb(15, 23, 42)')).toEqual({ r: 15, g: 23, b: 42 });
    expect(parseColorToRgb('rgba(239, 68, 68, 0.5)')).toEqual({ r: 239, g: 68, b: 68 });
    expect(parseColorToRgb('yellow')).toEqual({ r: 255, g: 255, b: 0 });
    expect(parseColorToRgb('invalid')).toBeNull();
  });

  it('calcola la luminanza relativa W3C esatta', () => {
    // Nero puro = 0.0
    expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0.0, 4);
    // Bianco puro = 1.0
    expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1.0, 4);
    // sRGB grigio medio (128, 128, 128)
    const midGrayLum = getRelativeLuminance({ r: 128, g: 128, b: 128 });
    expect(midGrayLum).toBeGreaterThan(0.2);
    expect(midGrayLum).toBeLessThan(0.25);
  });

  // Batteria esaustiva di almeno 30 colori di riempimento diversi (chiari, scuri, pastello, saturi, neutri)
  const testFills = [
    // Chiari (devono produrre testo NERO #000000 con contrasto >= 4.5:1)
    { fill: '#ffffff', name: 'Bianco puro', expected: '#000000' },
    { fill: '#fef08a', name: 'Giallo chiaro (P03b)', expected: '#000000' },
    { fill: '#fef9c3', name: 'Giallo chiarissimo', expected: '#000000' },
    { fill: '#fef08a', name: 'Giallo pastello', expected: '#000000' },
    { fill: '#bbf7d0', name: 'Verde chiaro', expected: '#000000' },
    { fill: '#86efac', name: 'Verde pastello', expected: '#000000' },
    { fill: '#bfdbfe', name: 'Blu chiarissimo', expected: '#000000' },
    { fill: '#93c5fd', name: 'Azzurro chiaro', expected: '#000000' },
    { fill: '#fecaca', name: 'Rosso chiarissimo', expected: '#000000' },
    { fill: '#fed7aa', name: 'Arancione chiaro', expected: '#000000' },
    { fill: '#e9d5ff', name: 'Viola chiarissimo', expected: '#000000' },
    { fill: '#fbcfe8', name: 'Rosa chiaro', expected: '#000000' },
    { fill: '#f1f5f9', name: 'Grigio chiarissimo 100', expected: '#000000' },
    { fill: '#e2e8f0', name: 'Grigio chiaro 200', expected: '#000000' },
    { fill: '#cbd5e1', name: 'Grigio chiaro 300', expected: '#000000' },
    { fill: '#a7f3d0', name: 'Smeraldo chiaro', expected: '#000000' },
    { fill: '#c7d2fe', name: 'Indaco chiaro', expected: '#000000' },
    { fill: '#fde047', name: 'Giallo sole', expected: '#000000' },

    // Scuri (devono produrre testo BIANCO #ffffff con contrasto >= 4.5:1)
    { fill: '#000000', name: 'Nero puro', expected: '#ffffff' },
    { fill: '#0f172a', name: 'Sfondo tema scuro (Slate 900)', expected: '#ffffff' },
    { fill: '#1e293b', name: 'Slate 800', expected: '#ffffff' },
    { fill: '#334155', name: 'Slate 700', expected: '#ffffff' },
    { fill: '#1e3a8a', name: 'Blu scuro (Blue 900)', expected: '#ffffff' },
    { fill: '#1d4ed8', name: 'Blu medio (Blue 700)', expected: '#ffffff' },
    { fill: '#7f1d1d', name: 'Rosso scuro (Red 900)', expected: '#ffffff' },
    { fill: '#991b1b', name: 'Rosso 800', expected: '#ffffff' },
    { fill: '#b91c1c', name: 'Rosso 700', expected: '#ffffff' },
    { fill: '#14532d', name: 'Verde scuro (Green 900)', expected: '#ffffff' },
    { fill: '#166534', name: 'Verde 800', expected: '#ffffff' },
    { fill: '#581c87', name: 'Viola scuro (Purple 900)', expected: '#ffffff' },
    { fill: '#701a75', name: 'Fucsia scuro', expected: '#ffffff' },
    { fill: '#451a03', name: 'Ambra scuro', expected: '#ffffff' },
    { fill: '#134e4a', name: 'Teal scuro', expected: '#ffffff' },
    { fill: '#111827', name: 'Gray 900', expected: '#ffffff' },
    { fill: '#1f2937', name: 'Gray 800', expected: '#ffffff' },
    { fill: '#374151', name: 'Gray 700', expected: '#ffffff' },
  ];

  it(`garantisce contrasto WCAG >= 4.5:1 per tutti i ${testFills.length} colori di test`, () => {
    expect(testFills.length).toBeGreaterThanOrEqual(30);

    for (const item of testFills) {
      const chosenColor = getAutoTextColorForBackground(item.fill);
      expect(chosenColor).toBe(item.expected);

      const bgRgb = parseColorToRgb(item.fill)!;
      const textRgb = parseColorToRgb(chosenColor!)!;
      const bgLum = getRelativeLuminance(bgRgb);
      const textLum = getRelativeLuminance(textRgb);

      const ratio = getContrastRatio(bgLum, textLum);
      expect(
        ratio,
        `Contrasto insufficiente (${ratio.toFixed(2)}:1) per ${item.name} (${item.fill}) con testo ${chosenColor}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('preserva il colore esplicito scelto dall utente anche con riempimento presente', () => {
    // Riempimento giallo chiaro, ma utente ha scelto esplicitamente rosso
    expect(resolveEffectiveTextColor('#ef4444', '#fef08a')).toBe('#ef4444');

    // Riempimento blu scuro, ma utente ha scelto esplicitamente verde
    expect(resolveEffectiveTextColor('#22c55e', '#1e3a8a')).toBe('#22c55e');

    // Riempimento nero, utente ha scelto esplicitamente blu
    expect(resolveEffectiveTextColor('#3b82f6', '#000000')).toBe('#3b82f6');
  });

  it('quando il colore e auto o non definito, calcola il colore ad alto contrasto', () => {
    expect(resolveEffectiveTextColor('auto', '#fef08a')).toBe('#000000');
    expect(resolveEffectiveTextColor(undefined, '#1e3a8a')).toBe('#ffffff');
    expect(resolveEffectiveTextColor('', '#1e3a8a')).toBe('#ffffff');
  });

  it('quando non c e riempimento, restituisce undefined (eredita CSS tema)', () => {
    expect(resolveEffectiveTextColor('auto', undefined)).toBeUndefined();
    expect(resolveEffectiveTextColor('auto', 'none')).toBeUndefined();
    expect(resolveEffectiveTextColor('auto', 'transparent')).toBeUndefined();
    expect(resolveEffectiveTextColor(undefined, undefined)).toBeUndefined();
  });
});
