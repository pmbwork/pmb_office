// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { statoIniziale, inserisciTesto, cancella, alternaSegno, testoDi, cursore, type Stato } from '../../src/modello/documento';
import { nuovaStoria, registra, annulla, ripeti, puoAnnullare, puoRipetere, LIMITE_STORIA } from '../../src/modello/storia';

function scrivi(st: Stato, t: string): Stato { return inserisciTesto(st, t); }

describe('T031: annulla e ripeti', () => {
  it('annulla e ripeti passo per passo, con il cursore dov\'era', () => {
    let h = nuovaStoria(statoIniziale());
    expect(puoAnnullare(h)).toBe(false);
    expect(puoRipetere(h)).toBe(false);
    h = registra(h, scrivi(h.presente, 'uno'));
    h = registra(h, scrivi(h.presente, ' due'));
    h = registra(h, scrivi(h.presente, ' tre'));
    expect(testoDi(h.presente.doc)).toBe('uno due tre');
    h = annulla(h);
    expect(testoDi(h.presente.doc)).toBe('uno due');
    expect(h.presente.sel).toEqual(cursore(0, 7));
    h = annulla(h);
    expect(testoDi(h.presente.doc)).toBe('uno');
    expect(puoRipetere(h)).toBe(true);
    h = ripeti(h);
    expect(testoDi(h.presente.doc)).toBe('uno due');
    h = ripeti(ripeti(h));
    expect(testoDi(h.presente.doc)).toBe('uno due tre');
    expect(puoRipetere(h)).toBe(false);
    expect(ripeti(h)).toBe(h);
  });

  it('annulla senza storia non fa nulla; una nuova modifica cancella il futuro', () => {
    const h0 = nuovaStoria(statoIniziale());
    expect(annulla(h0)).toBe(h0);
    let h = registra(h0, scrivi(h0.presente, 'a'));
    h = registra(h, scrivi(h.presente, 'b'));
    h = annulla(h);
    expect(puoRipetere(h)).toBe(true);
    h = registra(h, scrivi(h.presente, 'X'));
    expect(testoDi(h.presente.doc)).toBe('aX');
    expect(puoRipetere(h)).toBe(false);
  });

  it('un cambio di sola selezione non crea una voce di annulla', () => {
    let h = registra(nuovaStoria(statoIniziale()), scrivi(statoIniziale(), 'abc'));
    const prima = h.passato.length;
    h = registra(h, { ...h.presente, sel: cursore(0, 1) });
    expect(h.passato.length).toBe(prima);
    expect(h.presente.sel).toEqual(cursore(0, 1));
    h = registra(h, cancella(h.presente, 'avanti'));
    expect(testoDi(h.presente.doc)).toBe('ac');
    h = annulla(h);
    expect(testoDi(h.presente.doc)).toBe('abc');
    expect(h.presente.sel).toEqual(cursore(0, 1));
  });

  it('unisci raggruppa la digitazione continua in una sola voce', () => {
    let h = nuovaStoria(statoIniziale());
    h = registra(h, scrivi(h.presente, 'a'));
    h = registra(h, scrivi(h.presente, 'b'), true);
    h = registra(h, scrivi(h.presente, 'c'), true);
    expect(testoDi(h.presente.doc)).toBe('abc');
    expect(h.passato.length).toBe(1);
    h = annulla(h);
    expect(testoDi(h.presente.doc)).toBe('');
    const g = registra(nuovaStoria(statoIniziale()), scrivi(statoIniziale(), 'x'), true);
    expect(g.passato.length).toBe(1);
    expect(testoDi(g.presente.doc)).toBe('x');
  });

  it('i segni preparati non tornano dopo annulla e ripeti', () => {
    let h = registra(nuovaStoria(statoIniziale()), scrivi(statoIniziale(), 'ab'));
    h = registra(h, alternaSegno(h.presente, 'g'));
    expect(h.presente.pendenti).not.toBeNull();
    h = registra(h, scrivi(h.presente, 'c'));
    h = annulla(h);
    expect(h.presente.pendenti).toBeNull();
    h = ripeti(h);
    expect(h.presente.pendenti).toBeNull();
  });

  it('la storia ha un limite e le funzioni non cambiano la struttura ricevuta', () => {
    let h = nuovaStoria(statoIniziale());
    const iniziale = h;
    for (let i = 0; i < LIMITE_STORIA + 50; i++) h = registra(h, scrivi(h.presente, 'x'));
    expect(LIMITE_STORIA).toBe(200);
    expect(h.passato.length).toBe(LIMITE_STORIA);
    expect(iniziale.passato.length).toBe(0);
    const copia = JSON.stringify(h);
    annulla(h); ripeti(h); registra(h, scrivi(h.presente, 'y'));
    expect(JSON.stringify(h)).toBe(copia);
    for (let i = 0; i < LIMITE_STORIA + 10; i++) h = annulla(h);
    expect(testoDi(h.presente.doc).length).toBe(50);
    expect(puoAnnullare(h)).toBe(false);
  });

  it('prova casuale: annullare tutto torna all\'inizio, ripetere tutto torna alla fine', () => {
    for (let seme = 1; seme <= 100; seme++) {
      let a = seme * 2654435761 >>> 0;
      const rnd = (): number => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
      let h = nuovaStoria(statoIniziale());
      const passi: string[] = [testoDi(h.presente.doc)];
      for (let n = 0; n < 30; n++) {
        const st = h.presente;
        const nuovo = rnd() < 0.7 ? scrivi(st, 'ab\nc'[Math.floor(rnd() * 4)]) : cancella(st, rnd() < 0.5 ? 'indietro' : 'avanti');
        const prima = testoDi(h.presente.doc);
        h = registra(h, nuovo);
        if (testoDi(h.presente.doc) !== prima) passi.push(testoDi(h.presente.doc));
      }
      const fine = testoDi(h.presente.doc);
      for (let k = passi.length - 2; k >= 0; k--) {
        h = annulla(h);
        expect(testoDi(h.presente.doc), `seme ${seme} indietro ${k}`).toBe(passi[k]);
      }
      expect(puoAnnullare(h)).toBe(false);
      for (let k = 1; k < passi.length; k++) {
        h = ripeti(h);
        expect(testoDi(h.presente.doc), `seme ${seme} avanti ${k}`).toBe(passi[k]);
      }
      expect(testoDi(h.presente.doc)).toBe(fine);
      expect(puoRipetere(h)).toBe(false);
    }
  });
});
