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

export const COLORI = {
  sfondoApp: '#F8FAFD',
  barraStrumenti: '#F0F4F9',
  testo: '#1F1F1F',
  pannelloMenu: '#FFFFFF',
} as const;

export const STILI = {
  ombraPannelloMenu: '0 2px 6px 2px rgba(0, 0, 0, 0.15)',
  raggioPannelloMenu: '0 4px 4px 4px',
  fontBase: "Roboto, Inter, Arial, sans-serif",
} as const;
