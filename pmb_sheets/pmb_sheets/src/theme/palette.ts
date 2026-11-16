/**
 * Palette colori pura per la formattazione di Fogli e documenti.
 * Nessuna dipendenza esterna o marchi proprietari.
 */

export interface ColorSwatch {
  id: string;
  label: string;
  hex: string;
}

/**
 * 40 colori organizzati per famiglie cromatiche con 5 tonalita ciascuna (40 colori totali):
 * - Neutri / Grigi
 * - Rossi / Corallo
 * - Arancio / Ambra
 * - Gialli / Oro
 * - Verdi / Menta
 * - Ciano / Turchese
 * - Blu / Cobalto
 * - Viola / Indaco
 */
export const PALETTE_COLORS: readonly ColorSwatch[] = Object.freeze([
  // Neutri / Grigi
  { id: 'gray-100', label: 'Grigio Chiarissimo', hex: '#f3f4f6' },
  { id: 'gray-300', label: 'Grigio Chiaro', hex: '#d1d5db' },
  { id: 'gray-500', label: 'Grigio Medio', hex: '#6b7280' },
  { id: 'gray-700', label: 'Grigio Scuro', hex: '#374151' },
  { id: 'gray-900', label: 'Grigio Notte', hex: '#111827' },

  // Rossi / Corallo
  { id: 'red-100', label: 'Rosa Chiarissimo', hex: '#fee2e2' },
  { id: 'red-300', label: 'Rosso Chiaro', hex: '#fca5a5' },
  { id: 'red-500', label: 'Rosso Vivo', hex: '#ef4444' },
  { id: 'red-700', label: 'Rosso Scuro', hex: '#b91c1c' },
  { id: 'red-900', label: 'Bordeaux Scuro', hex: '#7f1d1d' },

  // Arancio / Ambra
  { id: 'orange-100', label: 'Arancio Pastello', hex: '#ffedd5' },
  { id: 'orange-300', label: 'Arancio Chiaro', hex: '#fdba74' },
  { id: 'orange-500', label: 'Arancio Vivo', hex: '#f97316' },
  { id: 'orange-700', label: 'Arancio Scuro', hex: '#c2410c' },
  { id: 'orange-900', label: 'Ruggine', hex: '#7c2d12' },

  // Gialli / Oro
  { id: 'yellow-100', label: 'Giallo Crema', hex: '#fef9c3' },
  { id: 'yellow-300', label: 'Giallo Sole', hex: '#fde047' },
  { id: 'yellow-500', label: 'Giallo Ambra', hex: '#eab308' },
  { id: 'yellow-700', label: 'Oro Antico', hex: '#a16207' },
  { id: 'yellow-900', label: 'Bronzo', hex: '#713f12' },

  // Verdi / Smeraldo
  { id: 'green-100', label: 'Verde Salvia Chiaro', hex: '#dcfce7' },
  { id: 'green-300', label: 'Verde Menta', hex: '#86efac' },
  { id: 'green-500', label: 'Verde Smeraldo', hex: '#22c55e' },
  { id: 'green-700', label: 'Verde Bosco', hex: '#15803d' },
  { id: 'green-900', label: 'Verde Pino Scuro', hex: '#14532d' },

  // Ciano / Turchese
  { id: 'cyan-100', label: 'Acquamarina Chiara', hex: '#cffafe' },
  { id: 'cyan-300', label: 'Turchese Chiaro', hex: '#67e8f9' },
  { id: 'cyan-500', label: 'Turchese Vivo', hex: '#06b6d4' },
  { id: 'cyan-700', label: 'Petrolio', hex: '#0e7490' },
  { id: 'cyan-900', label: 'Petrolio Notte', hex: '#164e63' },

  // Blu / Cobalto
  { id: 'blue-100', label: 'Azzurro Cielo', hex: '#dbeafe' },
  { id: 'blue-300', label: 'Azzurro Vivo', hex: '#93c5fd' },
  { id: 'blue-500', label: 'Blu Reale', hex: '#3b82f6' },
  { id: 'blue-700', label: 'Blu Notte', hex: '#1d4ed8' },
  { id: 'blue-900', label: 'Blu Oltremare', hex: '#1e3a8a' },

  // Viola / Lavanda
  { id: 'purple-100', label: 'Lavanda Chiara', hex: '#f3e8ff' },
  { id: 'purple-300', label: 'Glicine', hex: '#d8b4fe' },
  { id: 'purple-500', label: 'Viola Ametista', hex: '#a855f7' },
  { id: 'purple-700', label: 'Viola Prugna', hex: '#7e22ce' },
  { id: 'purple-900', label: 'Melanzana Scuro', hex: '#581c87' },
]);

/** Speciali per testo o riempimento */
export const COLOR_SPECIALS = {
  AUTO: 'auto',
  NONE: 'none',
} as const;

export type SpecialColor = (typeof COLOR_SPECIALS)[keyof typeof COLOR_SPECIALS];
