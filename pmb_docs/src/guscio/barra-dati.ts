// DA SCRIVERE: comandi della barra strumenti di pmb_docs e regola di compressione.
// Regole precise: LAVORO/compiti/T023/compito.md. I test sono in pmb_docs/tests/lavoro/T023.test.ts (non modificarli).

export interface VoceBarra {
  /** identificativo, per esempio "grassetto" */
  id: string;
  /** testo in italiano usato come descrizione del pulsante, per esempio "Grassetto" */
  etichetta: string;
  /** larghezza minima della finestra (in pixel) a cui il comando resta visibile nella barra */
  larghezzaMinima: number;
}

/** Pulsante fisso a destra, sempre visibile: «Funzioni» (il pezzo di puzzle, come le estensioni di Firefox), da cui si personalizza la barra. */
export const VOCE_FUNZIONI: VoceBarra = { id: 'funzioni', etichetta: 'Funzioni', larghezzaMinima: 0 };

/** I 27 comandi che si comprimono sotto "⋮" quando la finestra si stringe, nell'ordine in cui compaiono. */
export const VOCI_BARRA: VoceBarra[] = (() => {
  return [
    // Gruppo A, visibile già a 800 px (usa larghezzaMinima: 0): 9 comandi
    { id: 'cerca', etichetta: 'Cerca', larghezzaMinima: 0 },
    { id: 'annulla', etichetta: 'Annulla', larghezzaMinima: 0 },
    { id: 'ripeti', etichetta: 'Ripeti', larghezzaMinima: 0 },
    { id: 'stampa', etichetta: 'Stampa', larghezzaMinima: 0 },
    { id: 'ortografia', etichetta: 'Ortografia', larghezzaMinima: 0 },
    { id: 'copia-formato', etichetta: 'Copia formato', larghezzaMinima: 0 },
    { id: 'zoom', etichetta: 'Zoom', larghezzaMinima: 0 },
    { id: 'stile-paragrafo', etichetta: 'Stile paragrafo', larghezzaMinima: 0 },
    { id: 'carattere', etichetta: 'Carattere', larghezzaMinima: 0 },

    // Gruppo B, compare sopra 800 px (usa larghezzaMinima: 900): 8 comandi
    { id: 'riduci-corpo', etichetta: 'Riduci corpo', larghezzaMinima: 900 },
    { id: 'corpo', etichetta: 'Corpo', larghezzaMinima: 900 },
    { id: 'aumenta-corpo', etichetta: 'Aumenta corpo', larghezzaMinima: 900 },
    { id: 'grassetto', etichetta: 'Grassetto', larghezzaMinima: 900 },
    { id: 'corsivo', etichetta: 'Corsivo', larghezzaMinima: 900 },
    { id: 'sottolineato', etichetta: 'Sottolineato', larghezzaMinima: 900 },
    { id: 'barrato', etichetta: 'Barrato', larghezzaMinima: 900 },
    { id: 'colore-testo', etichetta: 'Colore testo', larghezzaMinima: 900 },
    { id: 'evidenzia', etichetta: 'Evidenzia', larghezzaMinima: 900 },

    // Gruppo C, compare sopra 1000 px (usa larghezzaMinima: 1100): 2 comandi
    { id: 'link', etichetta: 'Link', larghezzaMinima: 1100 },
    { id: 'immagine', etichetta: 'Immagine', larghezzaMinima: 1100 },

    // Gruppo D, compare sopra 1200 px (usa larghezzaMinima: 1400): 8 comandi
    { id: 'allineamento', etichetta: 'Allineamento', larghezzaMinima: 1400 },
    { id: 'interlinea', etichetta: 'Interlinea', larghezzaMinima: 1400 },
    { id: 'elenco-attivita', etichetta: 'Elenco attività', larghezzaMinima: 1400 },
    { id: 'elenco-puntato', etichetta: 'Elenco puntato', larghezzaMinima: 1400 },
    { id: 'elenco-numerato', etichetta: 'Elenco numerato', larghezzaMinima: 1400 },
    { id: 'riduci-rientro', etichetta: 'Riduci rientro', larghezzaMinima: 1400 },
    { id: 'aumenta-rientro', etichetta: 'Aumenta rientro', larghezzaMinima: 1400 },
    { id: 'cancella-formattazione', etichetta: 'Cancella formattazione', larghezzaMinima: 1400 },
  ];
})();

/** Quali comandi stanno nella barra e quali finiscono sotto "⋮" per una certa larghezza della finestra. */
export function vociVisibili(larghezza: number): { visibili: VoceBarra[]; nascoste: VoceBarra[] } {
  const visibili: VoceBarra[] = [];
  const nascoste: VoceBarra[] = [];

  for (const voce of VOCI_BARRA) {
    if (voce.larghezzaMinima <= larghezza) {
      visibili.push(voce);
    } else {
      nascoste.push(voce);
    }
  }

  return { visibili, nascoste };
}