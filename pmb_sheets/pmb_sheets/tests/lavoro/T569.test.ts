// T569: minigrafici (SPARKLINE disegnata nella cella, Inserisci › Minigrafico) e stili di cella (Formato › Stili di cella).
import { describe, expect, test } from 'vitest';
import { InlineEngineClient } from '../../src/sheet/engine-client';
import { leggiMinigrafico } from '../../src/components/minigrafico';
import { STILI_CELLA, stileCella } from '../../src/sheet/stili-cella';
import { StyleRegistry } from '../../src/sheet/styles';

describe('T569: minigrafici', () => {
  test('SPARKLINE dal motore: linea di serie, colonne con {"charttype"\\"column"}', async () => {
    const c = new InlineEngineClient();
    const f = (await c.listSheets())[0];
    for (let i = 1; i <= 4; i++) await c.setCell(f, 1, i, String([3, -1, 4, 1][i - 1]));
    await c.setCell(f, 2, 1, '=SPARKLINE(A1:D1)');
    await c.setCell(f, 3, 1, '=SPARKLINE(A1:D1,{"charttype","column"})');
    const linea = (await c.getCell(f, 2, 1)).value, colonne = (await c.getCell(f, 3, 1)).value;
    expect(linea.kind === 'text' && leggiMinigrafico(linea.value)).toEqual({ tipo: 'line', valori: [3, -1, 4, 1] });
    expect(colonne.kind === 'text' && leggiMinigrafico(colonne.value)).toEqual({ tipo: 'column', valori: [3, -1, 4, 1] });
  });
  test('un testo qualsiasi non è un minigrafico', () => {
    expect(leggiMinigrafico('SPARKLINE:line:')).toBeNull();
    expect(leggiMinigrafico('ciao')).toBeNull();
  });
});

describe('T569: stili di cella', () => {
  test('ogni stile ha un nome e i colori come Excel (Buono, Cattivo, Neutro)', () => {
    expect(STILI_CELLA.length).toBe(16);
    expect(stileCella('buono')!.stile).toMatchObject({ fill: '#c6efce', color: '#006100' });
    expect(stileCella('cattivo')!.stile).toMatchObject({ fill: '#ffc7ce', color: '#9c0006' });
    expect(stileCella('neutro')!.stile).toMatchObject({ fill: '#ffeb9c', color: '#9c5700' });
  });
  test('uno stile sostituisce il precedente e Normale toglie tutto (resta il formato dei numeri)', () => {
    const r = new StyleRegistry();
    let id = r.register({ numFmt: '0.00' });
    id = r.merge(id, stileCella('controllo')!.stile);
    id = r.merge(id, stileCella('titolo-1')!.stile);
    const s = r.getStyle(id);
    expect(s.fill).toBeUndefined();
    expect(s.bold).toBe(true);
    expect(s.borders?.left?.style ?? 'none').toBe('none'); // il bordo della Cella di controllo non resta (il registro toglie i lati senza bordo)
    expect(s.borders?.bottom).toEqual({ style: 'medium', color: '#4472c4' });
    const n = r.getStyle(r.merge(id, stileCella('normale')!.stile));
    expect(n).toEqual({ numFmt: '0.00' });
  });
});
