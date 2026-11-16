import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createWorkbook } from '../../src/engine/workbook';
import { scambioDaCsv, FORMATI } from '../../src/formati/file';
import { menuRegistry } from '../../src/registry/menu';

describe('T479: formule molto lunghe (B1)', () => {
  it.each([500, 3000, 20000, 100000])('una formula di %i termini non lancia eccezioni: dà un numero o #ERROR!', (n) => {
    const w = createWorkbook();
    expect(() => w.setCell('Foglio1', 'A1', `=${Array(n).fill('1').join('+')}`)).not.toThrow();
    const v = w.getCell('Foglio1', 'A1').value;
    expect(['number', 'error']).toContain(v.kind);
    if (v.kind === 'error') expect(v.error).toBe('#ERROR!');
    // il foglio continua a funzionare
    w.setCell('Foglio1', 'B1', '=2*3');
    expect(w.getCell('Foglio1', 'B1').value).toMatchObject({ kind: 'number', value: 6 });
  });

  it('parentesi annidate in profondità: nessuna eccezione', () => {
    const w = createWorkbook();
    const n = 20000;
    expect(() => w.setCell('Foglio1', 'A1', `=${'('.repeat(n)}1${')'.repeat(n)}`)).not.toThrow();
    expect(['number', 'error']).toContain(w.getCell('Foglio1', 'A1').value.kind);
  });
});

describe('T479: niente marchi altrui nell\'interfaccia (B2)', () => {
  it('le etichette dei formati e del menu non nominano prodotti altrui', () => {
    const testi = JSON.stringify([menuRegistry, FORMATI]);
    expect(testi).not.toMatch(/Microsoft|Excel/);
    expect(FORMATI.find((f) => f.id === 'xlsx')!.etichetta).toBe('Cartella di lavoro (.xlsx)');
  });
});

describe('T479: residui di prova (B3)', () => {
  it('il codice non lascia variabili di prova su window', () => {
    for (const f of ['src/components/sheet-grid.ts', 'src/main.ts']) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/__lastKeyDown|__lastClip|__lastPaste/);
    }
  });
});

describe('T479: CSV in ingresso (B9)', () => {
  const celle = (csv: string) => scambioDaCsv(csv).fogli[0].celle;

  it('gli zeri iniziali, i numeri di più di 15 cifre e le formule restano testo', () => {
    const c = celle('00123,1234567890123456,=1+1,+5,-5\n');
    expect(c.A1).toBe("'00123");
    expect(c.B1).toBe("'1234567890123456");
    expect(c.C1).toBe("'=1+1");
    expect(c.D1).toBe('+5');
    expect(c.E1).toBe('-5');
  });

  it('i numeri normali non cambiano', () => {
    const c = celle('0,0.5,10,007.5,8001234567890\n');
    expect(c.A1).toBe('0');
    expect(c.B1).toBe('0.5');
    expect(c.C1).toBe('10');
    expect(c.E1).toBe('8001234567890');
  });

  it('nel foglio il testo dello zero iniziale si legge com\'è e la formula non viene eseguita', () => {
    const c = celle('00123,=1+1\n');
    const w = createWorkbook();
    w.setCell('Foglio1', 'A1', c.A1);
    w.setCell('Foglio1', 'B1', c.B1);
    expect(w.getCell('Foglio1', 'A1').value).toMatchObject({ kind: 'text', value: '00123' });
    expect(w.getCell('Foglio1', 'B1').value).toMatchObject({ kind: 'text', value: '=1+1' });
  });

  it('con il punto e virgola e la virgola decimale i numeri restano numeri', () => {
    const c = celle('Mela;1.234,5;00123\n');
    expect(c.B1).toBe('1234.5');
    expect(c.C1).toBe("'00123");
  });
});
