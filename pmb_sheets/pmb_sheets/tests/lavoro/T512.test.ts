import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWorkbook, type Workbook } from '../../src/engine/workbook';

const val = (w: Workbook, a: string): number => {
  const v = w.getCell('Foglio1', a).value as { kind: string; value?: number; error?: string };
  if (v.kind !== 'number') throw new Error(`${a}: ${JSON.stringify(v)}`);
  return v.value as number;
};
const ORA = (h: number, m = 0, s = 0, giorno = 11) => new Date(2026, 10, giorno, h, m, s);

describe('T512: NOW e TODAY avanzano con il passare del tempo', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(ORA(10)); });
  afterEach(() => { vi.useRealTimers(); });

  it('le celle con NOW si aggiornano quando passa il tempo, senza toccare niente', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=NOW()');
    const prima = val(w, 'A1');
    vi.setSystemTime(ORA(10, 5));
    expect(val(w, 'A1')).toBe(prima);            // da sola la cella non si muove: serve il ricalcolo
    const cambiate = w.ricalcolaFunzioniDelTempo();
    expect(cambiate.length).toBeGreaterThan(0);
    expect(val(w, 'A1') - prima).toBeCloseTo(5 / 1440, 8);
  });

  it('chi dipende da NOW si aggiorna a catena', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=NOW()');
    w.setCell('Foglio1', 'B1', '=A1*2');
    w.setCell('Foglio1', 'C1', '=B1+1');
    const prima = val(w, 'C1');
    vi.setSystemTime(ORA(10, 30));
    w.ricalcolaFunzioniDelTempo();
    expect(val(w, 'C1') - prima).toBeCloseTo((30 / 1440) * 2, 8);
  });

  it('TODAY cambia a mezzanotte e non prima', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=TODAY()');
    vi.setSystemTime(ORA(10));
    vi.setSystemTime(ORA(10, 0, 0, 11));
    const giorno = val(w, 'A1');
    vi.setSystemTime(ORA(23, 59, 0, 11));
    expect(w.ricalcolaFunzioniDelTempo()).toEqual([]);   // stesso giorno: niente è cambiato
    expect(val(w, 'A1')).toBe(giorno);
    vi.setSystemTime(ORA(0, 1, 0, 12));
    expect(w.ricalcolaFunzioniDelTempo().length).toBeGreaterThan(0);
    expect(val(w, 'A1')).toBe(giorno + 1);
  });

  it('un giorno passato sposta anche le età e le scadenze calcolate con TODAY', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=DATE(2026,12,31)');
    w.setCell('Foglio1', 'B1', '=A1-TODAY()');
    const giorni = val(w, 'B1');
    vi.setSystemTime(ORA(9, 0, 0, 14));
    w.ricalcolaFunzioniDelTempo();
    expect(val(w, 'B1')).toBe(giorni - 3);
  });

  it('NOW dentro altre funzioni (IF, ROUND, HOUR...) si aggiorna', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=HOUR(NOW())');
    w.setCell('Foglio1', 'A2', '=IF(MINUTE(NOW())>=30,1,0)');
    w.setCell('Foglio1', 'A3', '=LET(x,NOW(),HOUR(x))');
    expect([val(w, 'A1'), val(w, 'A2'), val(w, 'A3')]).toEqual([10, 0, 10]);
    vi.setSystemTime(ORA(11, 45));
    w.ricalcolaFunzioniDelTempo();
    expect([val(w, 'A1'), val(w, 'A2'), val(w, 'A3')]).toEqual([11, 1, 11]);
  });

  it('le altre funzioni volatili non si muovono da sole (RAND resta com\'è)', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=RAND()');
    w.setCell('Foglio1', 'A2', '=NOW()');
    const casuale = val(w, 'A1');
    vi.setSystemTime(ORA(10, 20));
    w.ricalcolaFunzioniDelTempo();
    expect(val(w, 'A1')).toBe(casuale);
  });

  it('senza NOW e TODAY non c\'è niente da ricalcolare e non costa niente', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '5');
    w.setCell('Foglio1', 'B1', '=A1*2');
    expect(w.celleDelTempo()).toBe(0);
    expect(w.ricalcolaFunzioniDelTempo()).toEqual([]);
    expect(val(w, 'B1')).toBe(10);
  });

  it('celleDelTempo conta le celle giuste e dimentica quelle riscritte o cancellate', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=NOW()');
    w.setCell('Foglio1', 'A2', '=TODAY()+1');
    w.setCell('Foglio1', 'A3', '=SUM(A1:A2)');
    expect(w.celleDelTempo()).toBe(2);
    w.setCell('Foglio1', 'A1', '7');
    expect(w.celleDelTempo()).toBe(1);
    w.setCell('Foglio1', 'A2', '');
    expect(w.celleDelTempo()).toBe(0);
  });

  it('funziona anche su più fogli e con riferimenti tra fogli', () => {
    const w = createWorkbook();
    w.addSheet('Altro');
    w.setCell('Altro', 'A1', '=NOW()');
    w.setCell('Foglio1', 'A1', '=Altro!A1+1');
    const prima = val(w, 'A1');
    vi.setSystemTime(ORA(12));
    w.ricalcolaFunzioniDelTempo();
    expect(val(w, 'A1') - prima).toBeCloseTo(2 / 24, 8);
  });

  it('dopo aver serializzato e riaperto il libro il tempo continua ad avanzare', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=NOW()');
    const copia = createWorkbook();
    copia.deserialize(w.serialize());
    const prima = val(copia, 'A1');
    vi.setSystemTime(ORA(10, 10));
    expect(copia.celleDelTempo()).toBe(1);
    copia.ricalcolaFunzioniDelTempo();
    expect(val(copia, 'A1') - prima).toBeCloseTo(10 / 1440, 8);
  });

  it('una cella con errore di formula non rompe il ricalcolo delle altre', () => {
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', '=NOW()/0');
    w.setCell('Foglio1', 'A2', '=NOW()');
    const prima = val(w, 'A2');
    vi.setSystemTime(ORA(10, 1));
    expect(() => w.ricalcolaFunzioniDelTempo()).not.toThrow();
    expect(val(w, 'A2')).toBeGreaterThan(prima);
  });
});
