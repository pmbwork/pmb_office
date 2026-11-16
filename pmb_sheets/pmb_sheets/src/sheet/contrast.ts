/**
 * Modulo puro per il calcolo del contrasto cromatico secondo le linee guida W3C / WCAG 2.1.
 * Determina automaticamente il colore ottimale del testo (nero #000000 o bianco #ffffff)
 * a fronte di un colore di riempimento esplicito quando il colore del testo e impostato su 'Automatico',
 * garantendo sempre un rapporto di contrasto >= 4.5:1.
 * Nessuna dipendenza da DOM, browser o librerie esterne.
 */

export interface RGB {
  r: number; // 0..255
  g: number; // 0..255
  b: number; // 0..255
}

/**
 * Parsing di una stringa colore (hex #RGB, #RRGGBB, rgb(r, g, b), rgba(r, g, b, a)).
 */
export function parseColorToRgb(colorStr: string): RGB | null {
  if (!colorStr) return null;
  const str = colorStr.trim().toLowerCase();

  // 1. Hex format
  if (str.startsWith('#')) {
    const hex = str.substring(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }
    return null;
  }

  // 2. rgb(r, g, b) o rgba(r, g, b, a)
  const rgbMatch = str.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))),
      g: Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))),
      b: Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))),
    };
  }

  // 3. Colori con nome base comuni
  const namedColors: Record<string, RGB> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  };

  return namedColors[str] || null;
}

/**
 * Calcolo della luminanza relativa secondo la formula WCAG 2.1 (sRGB):
 * L = 0.2126 * R' + 0.7152 * G' + 0.0722 * B'
 * dove C' = C <= 0.04045 ? C / 12.92 : ((C + 0.055) / 1.055) ^ 2.4
 */
export function getRelativeLuminance(rgb: RGB): number {
  const normalize = (val: number) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const r = normalize(rgb.r);
  const g = normalize(rgb.g);
  const b = normalize(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calcola il rapporto di contrasto WCAG (1:1 .. 21:1) tra due valori di luminanza.
 */
export function getContrastRatio(lum1: number, lum2: number): number {
  const lA = Math.max(lum1, lum2);
  const lB = Math.min(lum1, lum2);
  return (lA + 0.05) / (lB + 0.05);
}

/**
 * Calcola il colore di testo ottimale ('#000000' o '#ffffff') a fronte di un colore di sfondo.
 * Se lo sfondo non e specificato, e trasparente o non riconosciuto, restituisce undefined.
 */
export function getAutoTextColorForBackground(bgColor?: string): '#000000' | '#ffffff' | undefined {
  if (!bgColor || bgColor === 'none' || bgColor === 'transparent' || bgColor === 'auto') {
    return undefined;
  }

  const rgb = parseColorToRgb(bgColor);
  if (!rgb) return undefined;

  const bgLum = getRelativeLuminance(rgb);

  // Luminanza del nero puro: 0.0
  // Luminanza del bianco puro: 1.0
  const contrastWithBlack = getContrastRatio(bgLum, 0.0);
  const contrastWithWhite = getContrastRatio(bgLum, 1.0);

  // Soglia di equilibrio WCAG per cui contrastWithBlack == contrastWithWhite e ~0.1791
  // Se il contrasto con il nero e maggiore o uguale, scegliamo il nero, altrimenti bianco.
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
}

/**
 * Risolve il colore del testo effettivo:
 * - Se l'utente ha impostato un colore esplicito diverso da 'auto', viene restituito invariato.
 * - Se il colore e 'auto' (o non specificato) e c'e un riempimento esplicito, calcola il colore ad alto contrasto (>= 4.5:1).
 * - Altrimenti restituisce undefined (il rendering applichera il colore predefinito del tema CSS).
 */
export function resolveEffectiveTextColor(
  userColor?: string,
  effectiveBg?: string
): string | undefined {
  if (userColor && userColor !== 'auto' && userColor.trim().length > 0) {
    return userColor;
  }

  return getAutoTextColorForBackground(effectiveBg);
}
