// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { VOCI_BARRA, VOCE_FUNZIONI, vociVisibili } from '../../src/guscio/barra-dati';

const ID_ATTESI = [
  'cerca', 'annulla', 'ripeti', 'stampa', 'ortografia', 'copia-formato', 'zoom', 'stile-paragrafo', 'carattere',
  'riduci-corpo', 'corpo', 'aumenta-corpo', 'grassetto', 'corsivo', 'sottolineato', 'barrato', 'colore-testo', 'evidenzia',
  'link', 'immagine',
  'allineamento', 'interlinea', 'elenco-attivita', 'elenco-puntato', 'elenco-numerato', 'riduci-rientro', 'aumenta-rientro', 'cancella-formattazione',
];
const ids = (v: { id: string }[]) => v.map((x) => x.id);

describe('T023: barra strumenti di pmb_docs', () => {
  it('i 28 comandi, in ordine', () => {
    expect(ids(VOCI_BARRA)).toEqual(ID_ATTESI);
  });

  it('quanti comandi restano visibili a 800, 1000, 1200 e 1600 px, e quali', () => {
    const a800 = vociVisibili(800), a1000 = vociVisibili(1000), a1200 = vociVisibili(1200), a1600 = vociVisibili(1600);
    expect(ids(a800.visibili)).toEqual(ID_ATTESI.slice(0, 9));
    expect(ids(a1000.visibili)).toEqual(ID_ATTESI.slice(0, 18));
    expect(ids(a1200.visibili)).toEqual(ID_ATTESI.slice(0, 20));
    expect(ids(a1600.visibili)).toEqual(ID_ATTESI);
    expect(a1600.nascoste).toEqual([]);
    // le nascoste sono esattamente il resto, nello stesso ordine
    expect(ids(a800.nascoste)).toEqual(ID_ATTESI.slice(9));
    expect(ids(a1000.nascoste)).toEqual(ID_ATTESI.slice(18));
    expect(ids(a1200.nascoste)).toEqual(ID_ATTESI.slice(20));
  });

  it('più la finestra è larga, più comandi si vedono (mai di meno)', () => {
    let prima = -1;
    for (let w = 300; w <= 2400; w += 50) {
      const n = vociVisibili(w).visibili.length;
      expect(n).toBeGreaterThanOrEqual(prima);
      expect(n + vociVisibili(w).nascoste.length).toBe(28);
      prima = n;
    }
  });

  it('larghezze minime: mai decrescenti lungo l\'elenco e tutte entro 1600 px', () => {
    for (let i = 1; i < VOCI_BARRA.length; i++) {
      expect(VOCI_BARRA[i].larghezzaMinima).toBeGreaterThanOrEqual(VOCI_BARRA[i - 1].larghezzaMinima);
    }
    expect(VOCI_BARRA[VOCI_BARRA.length - 1].larghezzaMinima).toBeLessThanOrEqual(1600);
    expect(VOCI_BARRA[0].larghezzaMinima).toBeGreaterThanOrEqual(0);
  });

  it('la modalità è un comando fisso, fuori dall\'elenco che si comprime', () => {
    expect(VOCE_FUNZIONI.id).toBe('funzioni');
    expect(ids(VOCI_BARRA)).not.toContain('funzioni');
    expect(ids(vociVisibili(300).nascoste)).not.toContain('funzioni');
    expect(ids(VOCI_BARRA)).not.toContain('modalita'); // la «Modifica» finta non c'è più
  });

  it('ogni comando ha un\'etichetta in italiano non vuota, tutte diverse', () => {
    const et = VOCI_BARRA.map((v) => v.etichetta);
    for (const e of et) expect(e.trim().length).toBeGreaterThan(0);
    expect(new Set(et).size).toBe(et.length);
  });
});
