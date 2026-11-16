// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ICONE_DOCS } from '../../src/guscio/icone';

const ATTESE = [
  'cerca', 'annulla', 'ripeti', 'stampa', 'ortografia', 'copia-formato', 'riduci-corpo', 'aumenta-corpo',
  'grassetto', 'corsivo', 'sottolineato', 'barrato', 'colore-testo', 'evidenzia', 'link', 'immagine', 'allineamento',
  'interlinea', 'elenco-attivita', 'elenco-puntato', 'elenco-numerato', 'riduci-rientro', 'aumenta-rientro',
  'cancella-formattazione', 'funzioni',
];

describe('T026: icone di pmb_docs', () => {
  it('c\'è un\'icona per ognuno dei 25 comandi con icona, e nessuna in più', () => {
    expect(Object.keys(ICONE_DOCS).sort()).toEqual([...ATTESE].sort());
  });

  it('ogni icona è un SVG 24x24 ben formato con almeno un tracciato', () => {
    for (const id of ATTESE) {
      const s = ICONE_DOCS[id];
      expect(s.startsWith('<svg '), id).toBe(true);
      expect(s.endsWith('</svg>'), id).toBe(true);
      expect(s.includes('viewBox="0 0 24 24"'), id).toBe(true);
      expect(s.includes('fill="currentColor"'), id).toBe(true);
      expect(/<path d="[^"]{10,}"/.test(s), id).toBe(true);
    }
  });

  it('niente stili in linea, niente script, e icone diverse per comandi diversi', () => {
    for (const id of ATTESE) {
      expect(/style\s*=|<script|onload|onclick/i.test(ICONE_DOCS[id]), id).toBe(false);
    }
    const uniche = new Set(ATTESE.map((id) => ICONE_DOCS[id]));
    expect(uniche.size).toBe(ATTESE.length);
  });
});
