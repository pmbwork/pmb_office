// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  impagina, raggruppaFrammenti, misuraRiga, inizioPagina, altezzaFogli, GEOMETRIA_A4, type GeometriaPagine, type Riga,
} from '../../src/editor/pagine';

function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const righeDa = (n: number, altezza = 20, da = 96): Riga[] => Array.from({ length: n }, (_, i) => ({ alto: da + altezza * i, basso: da + altezza * (i + 1) }));
const somma = (salti: Array<{ riga: number; altezza: number }>, riga: number): number => salti.filter((s) => s.riga === riga).reduce((n, s) => n + s.altezza, 0);

describe('T070: geometria', () => {
  it('A4 a 96 punti per pollice con margini di un pollice', () => {
    expect(GEOMETRIA_A4).toEqual({ altezzaPagina: 1123, margineAlto: 96, margineBasso: 96, spazio: 12 });
    expect(inizioPagina(0)).toBe(0);
    expect(inizioPagina(1)).toBe(1135);
    expect(inizioPagina(3)).toBe(3405);
    expect(altezzaFogli(1)).toBe(1123);
    expect(altezzaFogli(3)).toBe(3 * 1123 + 24);
    expect(altezzaFogli(0)).toBe(0);
  });
});

describe('T070: dove cade il salto', () => {
  it('nessuna riga: una pagina', () => {
    expect(impagina([])).toEqual({ salti: [], pagine: 1, altezzaTotale: 1123, paginaDiRiga: [] });
  });

  it('righe che entrano tutte: nessun salto', () => {
    const r = impagina(righeDa(46));
    expect(r.salti).toEqual([]);
    expect(r.pagine).toBe(1);
    expect(new Set(r.paginaDiRiga)).toEqual(new Set([0]));
  });

  it('la prima riga che non entra va in cima alla pagina dopo, con lo spazio giusto', () => {
    const r = impagina(righeDa(47));
    expect(r.salti).toEqual([{ riga: 46, altezza: 1231 - 1016 }]);
    expect(r.pagine).toBe(2);
    expect(r.paginaDiRiga[45]).toBe(0);
    expect(r.paginaDiRiga[46]).toBe(1);
  });

  it('cento righe: tre pagine, due salti, 46 righe per pagina', () => {
    const r = impagina(righeDa(100));
    expect(r.salti.map((s) => s.riga)).toEqual([46, 92]);
    expect(r.salti.map((s) => s.altezza)).toEqual([215, 215]);
    expect(r.pagine).toBe(3);
    expect(r.altezzaTotale).toBe(altezzaFogli(3));
    for (let p = 0; p < 3; p++) expect(r.paginaDiRiga.filter((x) => x === p).length).toBe(p < 2 ? 46 : 8);
  });

  it('una riga che finisce esattamente sul limite entra; un decimo di punto in più no', () => {
    expect(impagina([{ alto: 1007, basso: 1027 }]).salti).toEqual([]);
    expect(impagina([{ alto: 1007, basso: 1027.4 }]).salti).toEqual([]);
    expect(impagina([{ alto: 1007, basso: 1028 }]).salti).toEqual([{ riga: 0, altezza: 1231 - 1007 }]);
  });

  it('un grande spazio tra paragrafi manda a pagina nuova solo la riga che non entra', () => {
    const r = impagina([{ alto: 96, basso: 112 }, { alto: 1000, basso: 1016 }, { alto: 1020, basso: 1036 }]);
    expect(r.salti).toEqual([{ riga: 2, altezza: 1231 - 1020 }]);
    expect(r.paginaDiRiga).toEqual([0, 0, 1]);
  });

  it('una riga più alta della pagina resta dov\'è; le pagine che occupa si contano', () => {
    const r = impagina([{ alto: 96, basso: 2000 }, { alto: 2000, basso: 2020 }]);
    expect(r.salti).toEqual([]);
    expect(r.paginaDiRiga).toEqual([0, 1]);
    expect(r.pagine).toBe(2);
    const r2 = impagina([{ alto: 96, basso: 5000 }]);
    expect(r2.salti).toEqual([]);
    expect(r2.pagine).toBe(5);
  });

  it('dopo un blocco molto alto una riga nel margine del foglio viene portata dove comincia il testo', () => {
    const r = impagina([{ alto: 96, basso: 1140 }, { alto: 1140, basso: 1160 }]);
    expect(r.salti).toEqual([{ riga: 1, altezza: 1231 - 1140 }]);
    expect(r.paginaDiRiga).toEqual([0, 1]);
  });

  it('una riga che comincia sotto il limite ma nel margine basso passa alla pagina dopo', () => {
    const r = impagina([{ alto: 96, basso: 112 }, { alto: 1050, basso: 1066 }]);
    expect(r.salti).toEqual([{ riga: 1, altezza: 1231 - 1050 }]);
  });

  it('con un\'altra misura di pagina (per esempio una pagina piccola)', () => {
    const g: GeometriaPagine = { altezzaPagina: 200, margineAlto: 20, margineBasso: 20, spazio: 10 };
    const r = impagina(righeDa(20, 10, 20), g);
    expect(r.pagine).toBe(2);
    expect(r.salti).toEqual([{ riga: 16, altezza: 230 - 180 }]);
    expect(r.altezzaTotale).toBe(410);
  });
});

describe('T070: prova casuale', () => {
  it('400 documenti casuali: nessuna riga attraversa il bordo di un foglio, l\'ordine resta, ripetere non cambia niente', () => {
    for (let seme = 1; seme <= 400; seme++) {
      const r = generatore(seme * 17);
      const g: GeometriaPagine = seme % 4 === 0 ? { altezzaPagina: 300, margineAlto: 30, margineBasso: 40, spazio: 8 } : GEOMETRIA_A4;
      const N = 1 + Math.floor(r() * 150);
      const righe: Riga[] = [];
      let y = g.margineAlto;
      for (let i = 0; i < N; i++) {
        y += r() < 0.15 ? Math.floor(r() * 30) : 0;
        const h = r() < 0.03 ? 200 + Math.floor(r() * 1500) : 8 + Math.floor(r() * 50);
        righe.push({ alto: y, basso: y + h });
        y += h;
      }
      const imp = impagina(righe, g);
      const contenuto = g.altezzaPagina - g.margineAlto - g.margineBasso;
      let extra = 0;
      const virtuali: Riga[] = [];
      let prec = -Infinity;
      imp.paginaDiRiga.forEach((p, i) => {
        extra += somma(imp.salti, i);
        const v = { alto: righe[i].alto + extra, basso: righe[i].basso + extra };
        virtuali.push(v);
        expect(v.alto, `seme ${seme} riga ${i}`).toBeGreaterThanOrEqual(prec - 0.001);
        prec = v.basso;
        const cima = inizioPagina(p, g) + g.margineAlto;
        const fondo = inizioPagina(p, g) + g.altezzaPagina - g.margineBasso;
        expect(v.alto, `seme ${seme} riga ${i} cima`).toBeGreaterThanOrEqual(cima - 0.51);
        if (v.basso - v.alto <= contenuto) expect(v.basso, `seme ${seme} riga ${i} fondo`).toBeLessThanOrEqual(fondo + 0.51);
        if (i > 0) expect(p, `seme ${seme} riga ${i}`).toBeGreaterThanOrEqual(imp.paginaDiRiga[i - 1]);
      });
      expect(imp.salti.every((s) => s.altezza > 0), `seme ${seme}`).toBe(true);
      expect(imp.altezzaTotale).toBe(altezzaFogli(imp.pagine, g));
      expect(imp.pagine, `seme ${seme}`).toBeGreaterThanOrEqual(imp.paginaDiRiga[N - 1] + 1);
      expect(impagina(virtuali, g).salti, `seme ${seme} ripetuto`).toEqual([]);
      expect(impagina(righe, g)).toEqual(imp);
    }
  });
});

describe('T070: raggruppare i frammenti in righe', () => {
  it('frammenti sulla stessa riga, righe diverse, apici e pedici, niente', () => {
    expect(raggruppaFrammenti([])).toEqual([]);
    expect(raggruppaFrammenti([{ alto: 100, basso: 116 }])).toEqual([[0]]);
    const f = [
      { alto: 100, basso: 116 }, { alto: 100, basso: 116 }, { alto: 98, basso: 128 },
      { alto: 117, basso: 133 }, { alto: 117, basso: 133 },
      { alto: 134, basso: 150 },
    ];
    expect(raggruppaFrammenti(f)).toEqual([[0, 1, 2], [3, 4], [5]]);
    expect(raggruppaFrammenti([{ alto: 100, basso: 116 }, { alto: 104, basso: 114 }])).toEqual([[0, 1]]);
    expect(raggruppaFrammenti([{ alto: 100, basso: 116 }, { alto: 108.4, basso: 124 }])).toEqual([[0, 1]]);
    expect(raggruppaFrammenti([{ alto: 100, basso: 116 }, { alto: 108.6, basso: 124 }])).toEqual([[0], [1]]);
  });

  it('misuraRiga prende l\'altezza che contiene tutti i frammenti della riga', () => {
    const f = [{ alto: 100, basso: 116 }, { alto: 98, basso: 128 }, { alto: 117, basso: 133 }];
    expect(misuraRiga(f, [0, 1])).toEqual({ alto: 98, basso: 128 });
    expect(misuraRiga(f, [2])).toEqual({ alto: 117, basso: 133 });
  });
});
