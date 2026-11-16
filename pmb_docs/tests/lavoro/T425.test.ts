import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/editor/docs-editor';
import {
  distanzaLevenshtein,
  normalizzaParola,
  parolaCorretta,
  suggerimentiOrtografici,
  trovaErroriOrtografici,
} from '../../src/editor/ortografia';
import { cursore, type Documento } from '../../src/modello/documento';

describe('T425 — T427: Controllo ortografico e dizionario utente', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('distanzaLevenshtein calcola correttamente le modifiche tra parole', () => {
    expect(distanzaLevenshtein('casa', 'casa')).toBe(0);
    expect(distanzaLevenshtein('casa', 'cassa')).toBe(1); // inserimento
    expect(distanzaLevenshtein('casa', 'cosa')).toBe(1);  // sostituzione
    expect(distanzaLevenshtein('casa', 'cas')).toBe(1);   // cancellazione
    expect(distanzaLevenshtein('ciao', 'mondo')).toBe(4);
  });

  it('normalizzaParola rimuove la punteggiatura ai bordi e converte in minuscolo', () => {
    expect(normalizzaParola('«Parola!»')).toBe('parola');
    expect(normalizzaParola('  Testo... ')).toBe('testo');
    expect(normalizzaParola('(Documento)')).toBe('documento');
  });

  it('parolaCorretta riconosce le parole italiane valide e individua quelle errate', () => {
    expect(parolaCorretta('documento')).toBe(true);
    expect(parolaCorretta('ufficio')).toBe(true);
    expect(parolaCorretta('italiano')).toBe(true); // se presente o gestito
    expect(parolaCorretta('dkjsfnkj')).toBe(false);
  });

  it('suggerimentiOrtografici propone parole simili per distanza minima', () => {
    const sugg = suggerimentiOrtografici('documnto');
    expect(sugg).toContain('documento');
  });

  it('trovaErroriOrtografici identifica le parole scorrette in un documento', () => {
    const doc: Documento = {
      paragrafi: [
        {
          runs: [{ t: 'Questo è un documnto con un errrore gravissimo.', g: false, c: false, s: false }],
        },
      ],
    };

    const errori = trovaErroriOrtografici(doc);
    expect(errori.length).toBeGreaterThanOrEqual(1);

    const paroleErrate = errori.map((e) => e.parola);
    expect(paroleErrate).toContain('documnto');
  });

  it('DocsEditor integra controllaOrtografia e supporta l\'aggiunta di parole al dizionario personale', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    const doc: Documento = {
      paragrafi: [
        {
          runs: [{ t: 'Il termine personalizzatissimo non esiste nel vocabolario base.', g: false, c: false, s: false }],
        },
      ],
    };

    ed.impostaStato({
      doc,
      sel: cursore(0, 0),
      pendenti: null,
    });
    await ed.updateComplete;

    let err = ed.controllaOrtografia();
    expect(err.some((e: any) => e.parola === 'personalizzatissimo')).toBe(true);

    // Aggiungi al dizionario personale
    ed.aggiungiAlDizionario('personalizzatissimo');
    expect(ed.dizionarioUtenteElenco()).toContain('personalizzatissimo');

    // Ora non deve più risultare errore
    err = ed.controllaOrtografia();
    expect(err.some((e: any) => e.parola === 'personalizzatissimo')).toBe(false);
  });
});
