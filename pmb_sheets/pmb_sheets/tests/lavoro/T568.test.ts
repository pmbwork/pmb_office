// T568: Riempi serie (sheet/serie.ts) confrontata con Range.DataSeries di Excel (LAVORO/studio-microsoft-office/excel_serie.py,
// risultati in tests/file-prova/excel-oracolo/serie.json): lineare, crescita, date per giorni, giorni feriali, mesi e anni, con e senza limite.
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { valoriSerie, type TipoSerie, type UnitaData } from '../../src/sheet/serie';

interface Caso { nome: string; inizio: number; tipo: TipoSerie; unita: UnitaData; passo: number; limite: number | null; n: number; excel: Array<number | null> }
const CASI = JSON.parse(fs.readFileSync('tests/file-prova/excel-oracolo/serie.json', 'utf-8')) as Caso[];

describe('T568: Riempi serie come Excel', () => {
  test.each(CASI.map((c) => [c.nome, c] as const))('%s', (_n, c) => {
    const v = valoriSerie(c.inizio, c.n, { tipo: c.tipo, unita: c.unita, passo: c.passo, ...(c.limite !== null ? { limite: c.limite } : {}) });
    const attesi = c.excel.filter((x): x is number => x !== null);
    // Excel lascia vuote le celle dopo il limite: noi non le scriviamo
    expect(v.length).toBe(attesi.length);
    v.forEach((x, i) => expect(Math.abs(x - attesi[i])).toBeLessThan(1e-9));
  });
  test('senza limite si ferma al numero di celle; passo 0,1 senza i decimali sporchi della somma', () => {
    expect(valoriSerie(1, 3, { tipo: 'lineare', unita: 'giorno', passo: 0.1 })).toEqual([1.1, 1.2, 1.3]);
    expect(valoriSerie(0, 1000, { tipo: 'lineare', unita: 'giorno', passo: 1, limite: 3 })).toEqual([1, 2, 3]);
  });
});
