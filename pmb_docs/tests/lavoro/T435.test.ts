// T435: un salto pagina forzato non si ripete a ogni giro di impaginazione (prima: un solo salto faceva 5 fogli).
import { describe, it, expect } from 'vitest';
import { impagina, type Riga } from '../../src/editor/pagine';

describe('T435: salto pagina idempotente', () => {
  it('primo giro: il salto forzato porta la riga sul foglio dopo (2 fogli)', () => {
    const righe: Riga[] = [{ alto: 96, basso: 112 }, { alto: 112, basso: 128, saltoForzato: true }];
    const r = impagina(righe);
    expect(r.pagine).toBe(2);
    expect(r.salti.length).toBe(1);
  });
  it('secondo giro: la riga è già in cima al foglio dopo e segnata come spinta, niente altro salto', () => {
    // dopo il primo giro la riga sta a 1123+12+96 = 1231 (cima del secondo foglio)
    const righe: Riga[] = [{ alto: 96, basso: 112 }, { alto: 1231, basso: 1247, saltoForzato: true, spinta: true }];
    const r = impagina(righe);
    expect(r.pagine).toBe(2);
    expect(r.salti.length).toBe(0);
  });
  it('quattro giri di fila non fanno crescere i fogli', () => {
    let righe: Riga[] = [{ alto: 96, basso: 112 }, { alto: 112, basso: 128, saltoForzato: true }];
    let pagine = 0;
    for (let giro = 0; giro < 4; giro++) {
      const r = impagina(righe);
      pagine = r.pagine;
      if (r.salti.length === 0) break;
      const h = r.salti.reduce((s, x) => s + x.altezza, 0);
      righe = [righe[0], { alto: righe[1].alto + h, basso: righe[1].basso + h, saltoForzato: true, spinta: true }];
    }
    expect(pagine).toBe(2);
  });
  it('due salti forzati davvero distinti danno tre fogli', () => {
    const r1 = impagina([{ alto: 96, basso: 112 }, { alto: 112, basso: 128, saltoForzato: true }, { alto: 128, basso: 144, saltoForzato: true }]);
    expect(r1.pagine).toBe(3);
  });
});
