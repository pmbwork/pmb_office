// Misure del guscio di pmb_docs (pixel CSS, scala 100%). Fonte: LAVORO e pmb_docs/SPECIFICA-GUSCIO.md.
// Marcatore: MISURE_GUSCIO_T020
export const MISURE_GUSCIO_T020 = true;

export const MISURE = {
  /** logo orizzontale di pmb_docs a sinistra, alto quanto basta perché si legga «Sistema professionale di videoscrittura» (dal 0.3.8) */
  logo: { x: 16, y: 8, larghezza: 414, altezza: 99 },
  /** nome del documento e stato accanto al logo, a metà della sua altezza */
  intestazione: { y: 45, altezza: 24, xTitolo: 454, corpoTitolo: 18 },
  /** barra dei menu sotto il logo (dal 0.3.9) */
  barraMenu: { x: 8, y: 106, altezza: 33, corpo: 14 },
  barraStrumenti: { x: 16, y: 149, altezza: 40, corpo: 13, margineLaterale: 16 },
  righello: { x: 16, y: 197, altezza: 16 },
  areaEditor: { y: 213 },
  /** finestra bassa (fino a altezzaFinestra px, per esempio un portatile da 768): logo a metà, tutto 50 px più in alto */
  compatta: { altezzaFinestra: 740, logo: { y: 8, larghezza: 207, altezza: 50 }, intestazione: { y: 20, xTitolo: 239 }, barraMenu: { y: 56 }, barraStrumenti: { y: 99 }, righello: { y: 147 }, areaEditor: { y: 163 }, pannelli: { y: 172 }, schede: { y: 162 } },
  pagina: { larghezza: 794, altezza: 1123, y: 229 },
  pannelloMenu: { altezzaVoce: 32 },
  dialogo: { raggio: 28 },
} as const;

/** Colori di base: variabili CSS con il valore del tema chiaro come riserva; il tema scuro le ridefinisce in docs-guscio (TEMA_SCURO). */
export const COLORI = {
  sfondoApp: 'var(--pmb-sfondo-app, #F8FAFD)',
  barraStrumenti: 'var(--pmb-barra-strumenti, #F0F4F9)',
  testo: 'var(--pmb-testo, #1F1F1F)',
  pannelloMenu: 'var(--pmb-superficie, #FFFFFF)',
} as const;

/**
 * Valori del tema scuro per tutte le variabili --pmb-*: si applicano a docs-guscio e passano a tutti i componenti
 * dentro di lui (le variabili CSS attraversano lo shadow DOM). Il foglio del documento resta bianco, come in Word.
 */
export const TEMA_SCURO = `
  color-scheme: dark;
  --pmb-sfondo-app: #1e1f20;
  --pmb-barra-strumenti: #282a2c;
  --pmb-superficie: #282a2c;
  --pmb-superficie-2: #333537;
  --pmb-hover: #3c4043;
  --pmb-selezione: #1f3760;
  --pmb-selezione-forte: #28477a;
  --pmb-testo: #e3e3e3;
  --pmb-testo-2: #c4c7c5;
  --pmb-testo-disabilitato: #80868b;
  --pmb-accento: #a8c7fa;
  --pmb-bordo: #444746;
  --pmb-bordo-forte: #8e918f;
`;

export const STILI = {
  ombraPannelloMenu: '0 2px 6px 2px rgba(0, 0, 0, 0.15)',
  raggioPannelloMenu: '0 4px 4px 4px',
  fontBase: "Roboto, Inter, Arial, sans-serif",
} as const;
