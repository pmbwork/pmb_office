import { describe, it, expect } from 'vitest';
import { LARGHEZZA_PAGINA, areaDaStampare, costruisciTabella, stileEffettivo, type TipoValore } from '../../src/formati/stampa';
import { foglioVuoto, type FoglioScambio } from '../../src/formati/scambio';

const foglio = (extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto('Foglio1'), ...extra });
const testo = (t: string, tipo: TipoValore = 'testo') => ({ testo: t, tipo });

describe('T316: areaDaStampare', () => {
  it('un foglio vuoto non ha niente da stampare', () => { expect(areaDaStampare(foglio())).toBeNull(); });
  it('una cella sola', () => { expect(areaDaStampare(foglio({ celle: { C4: 'x' } }))).toEqual({ riga1: 4, col1: 3, riga2: 4, col2: 3 }); });
  it('il rettangolo che contiene tutte le celle piene', () => {
    expect(areaDaStampare(foglio({ celle: { B2: 'a', D5: 'b', A3: 'c' } }))).toEqual({ riga1: 2, col1: 1, riga2: 5, col2: 4 });
  });
  it('uno sfondo o un bordo allargano l\'area, un semplice grassetto no', () => {
    const base = { celle: { B2: 'a' } };
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { fill: '#ff0000' } } }))).toEqual({ riga1: 2, col1: 2, riga2: 7, col2: 5 });
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { borders: { top: { style: 'thin', color: '#000000' } } } } }))).toEqual({ riga1: 2, col1: 2, riga2: 7, col2: 5 });
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { bold: true } } }))).toEqual({ riga1: 2, col1: 2, riga2: 2, col2: 2 });
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { fill: 'none' } } }))).toEqual({ riga1: 2, col1: 2, riga2: 2, col2: 2 });
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { fill: 'auto' } } }))).toEqual({ riga1: 2, col1: 2, riga2: 2, col2: 2 });
    expect(areaDaStampare(foglio({ ...base, stili: { E7: { borders: { top: { style: 'none', color: '#000000' } } } } }))).toEqual({ riga1: 2, col1: 2, riga2: 2, col2: 2 });
  });
  it('anche i bordi a destra, in basso e a sinistra contano', () => {
    for (const lato of ['right', 'bottom', 'left'] as const) {
      expect(areaDaStampare(foglio({ celle: { A1: 'x' }, stili: { C3: { borders: { [lato]: { style: 'thin', color: '#000000' } } } } }))).toEqual({ riga1: 1, col1: 1, riga2: 3, col2: 3 });
    }
  });
  it('le celle unite allargano l\'area fino alla loro fine', () => {
    expect(areaDaStampare(foglio({ celle: { A1: 'x' }, unioni: [{ startRow: 1, endRow: 3, startCol: 1, endCol: 4 }] }))).toEqual({ riga1: 1, col1: 1, riga2: 3, col2: 4 });
  });
  it('un indirizzo che non è una cella viene ignorato', () => {
    expect(areaDaStampare(foglio({ celle: { B2: 'x', '???': 'y' } }))).toEqual({ riga1: 2, col1: 2, riga2: 2, col2: 2 });
    expect(areaDaStampare(foglio({ stili: { '???': { fill: '#fff' } } }))).toBeNull();
  });
});

describe('T316: stileEffettivo', () => {
  it('la cella vince sulla riga, la riga sulla colonna', () => {
    const f = foglio({ stiliColonna: { 2: { color: '#111111', bold: true } }, stiliRiga: { 3: { color: '#222222', italic: true } }, stili: { B3: { color: '#333333' } } });
    expect(stileEffettivo(f, 3, 2, 'B3')).toEqual({ color: '#333333', bold: true, italic: true });
    expect(stileEffettivo(f, 3, 1, 'A3')).toEqual({ color: '#222222', italic: true });
    expect(stileEffettivo(f, 4, 2, 'B4')).toEqual({ color: '#111111', bold: true });
    expect(stileEffettivo(f, 4, 1, 'A4')).toEqual({});
    const g = foglio({ stiliColonna: { 2: { color: '#aaaaaa' } }, stiliRiga: { 5: { color: '#bbbbbb' } } });
    expect(stileEffettivo(g, 5, 2, 'B5')).toEqual({ color: '#bbbbbb' });
  });
});

describe('T316: costruisciTabella, forma', () => {
  it('senza niente da stampare dà null e non chiede nessun valore', () => {
    let chiamate = 0;
    expect(costruisciTabella(foglio(), () => { chiamate++; return testo(''); })).toBeNull();
    expect(chiamate).toBe(0);
  });
  it('una riga per ogni riga dell\'area e una cella per ogni colonna, con riga e colonna vere', () => {
    const t = costruisciTabella(foglio({ celle: { B2: 'a', C3: 'b' } }), (r, c) => testo(`${r}.${c}`))!;
    expect(t.righe.map((r) => r.map((c) => [c.riga, c.colonna, c.testo]))).toEqual([[[2, 2, '2.2'], [2, 3, '2.3']], [[3, 2, '3.2'], [3, 3, '3.3']]]);
    expect(t.righe.flat().every((c) => c.rowspan === 1 && c.colspan === 1)).toBe(true);
  });
  it('larghezze e altezze: quelle del foglio, altrimenti 90 e 22', () => {
    const t = costruisciTabella(foglio({ celle: { A1: 'x', C2: 'y' }, larghezze: { 2: 150 }, altezze: { 2: 40 } }), () => testo('v'))!;
    expect(t.larghezze).toEqual([90, 150, 90]);
    expect(t.altezze).toEqual([22, 40]);
    expect(t.larghezzaTotale).toBe(330);
  });
  it('le celle chiedono il loro valore una volta per cella visibile', () => {
    const viste: string[] = [];
    costruisciTabella(foglio({ celle: { A1: 'x', B2: 'y' } }), (r, c) => { viste.push(`${r}:${c}`); return testo(''); });
    expect(viste).toEqual(['1:1', '1:2', '2:1', '2:2']);
  });
});

describe('T316: costruisciTabella, celle unite', () => {
  const f = () => foglio({ celle: { A1: 'x' }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 3 }, { startRow: 3, endRow: 3, startCol: 2, endCol: 3 }], larghezze: { 4: 50 } });
  it('l\'ancora ha rowspan e colspan, le altre celle coperte non ci sono', () => {
    const viste: string[] = [];
    const t = costruisciTabella(f(), (r, c) => { viste.push(`${r}:${c}`); return testo(`${r}:${c}`); })!;
    expect(t.righe.map((r) => r.map((c) => `${c.riga}:${c.colonna}`))).toEqual([['1:1'], [], ['3:1', '3:2']]);
    expect(t.righe[0][0]).toMatchObject({ rowspan: 2, colspan: 3 });
    expect(t.righe[2][1]).toMatchObject({ rowspan: 1, colspan: 2 });
    expect(viste).not.toContain('1:2');
    expect(viste).not.toContain('2:3');
  });
});

describe('T316: costruisciTabella, allineamento', () => {
  const di = (tipo: TipoValore, stili: FoglioScambio['stili'] = {}) => costruisciTabella(foglio({ celle: { A1: 'x' }, stili }), () => testo('v', tipo))!.righe[0][0].stile.textAlign;
  it('numeri a destra, testo e vuoti a sinistra, booleani ed errori al centro', () => {
    expect(di('numero')).toBe('right');
    expect(di('testo')).toBe('left');
    expect(di('vuoto')).toBe('left');
    expect(di('booleano')).toBe('center');
    expect(di('errore')).toBe('center');
  });
  it('l\'allineamento scelto vince su quello del tipo', () => {
    expect(di('numero', { A1: { hAlign: 'left' } })).toBe('left');
    expect(di('testo', { A1: { hAlign: 'right' } })).toBe('right');
    expect(di('testo', { A1: { hAlign: 'center' } })).toBe('center');
  });
});

describe('T316: costruisciTabella, stili', () => {
  const stile = (s: FoglioScambio['stili'][string]) => costruisciTabella(foglio({ celle: { A1: 'x' }, stili: { A1: s } }), () => testo('v'))!.righe[0][0].stile;
  it('senza stili restano solo l\'allineamento e il testo su una riga', () => {
    expect(stile({})).toEqual({ textAlign: 'left', whiteSpace: 'nowrap' });
  });
  it('grassetto, corsivo, sottolineato e barrato', () => {
    expect(stile({ bold: true }).fontWeight).toBe('700');
    expect(stile({ italic: true }).fontStyle).toBe('italic');
    expect(stile({ underline: true }).textDecoration).toBe('underline');
    expect(stile({ strike: true }).textDecoration).toBe('line-through');
    expect(stile({ underline: true, strike: true }).textDecoration).toBe('underline line-through');
    expect(stile({ bold: false, italic: false, underline: false, strike: false })).toEqual({ textAlign: 'left', whiteSpace: 'nowrap' });
  });
  it('colore del testo e sfondo, ma non "auto" né "none"', () => {
    expect(stile({ color: '#ff0000' }).color).toBe('#ff0000');
    expect(stile({ color: 'auto' }).color).toBeUndefined();
    expect(stile({ fill: '#00ff00' }).backgroundColor).toBe('#00ff00');
    expect(stile({ fill: 'none' }).backgroundColor).toBeUndefined();
    expect(stile({ fill: 'auto' }).backgroundColor).toBeUndefined();
  });
  it('carattere, dimensione, allineamento verticale e testo a capo', () => {
    expect(stile({ fontFamily: 'Georgia' }).fontFamily).toBe('Georgia');
    expect(stile({ fontSize: 14 }).fontSize).toBe('14px');
    expect(stile({ vAlign: 'top' }).verticalAlign).toBe('top');
    expect(stile({ vAlign: 'middle' }).verticalAlign).toBe('middle');
    expect(stile({ vAlign: 'bottom' }).verticalAlign).toBe('bottom');
    expect(stile({ wrap: true }).whiteSpace).toBe('pre-wrap');
    expect(stile({ wrap: false }).whiteSpace).toBe('nowrap');
  });
  it('bordi: sottile, medio, tratteggiato, colore automatico nero, assenti se "none"', () => {
    const s = stile({ borders: {
      top: { style: 'thin', color: '#112233' }, right: { style: 'medium', color: 'auto' }, bottom: { style: 'dashed', color: '#445566' }, left: { style: 'none', color: '#000000' },
    } });
    expect(s.borderTop).toBe('1px solid #112233');
    expect(s.borderRight).toBe('2px solid #000000');
    expect(s.borderBottom).toBe('1px dashed #445566');
    expect(s.borderLeft).toBeUndefined();
  });
  it('il bordo sinistro e quello destro stanno ciascuno dal suo lato', () => {
    const s = stile({ borders: { left: { style: 'thin', color: '#010203' }, right: { style: 'dashed', color: '#040506' } } });
    expect(s.borderLeft).toBe('1px solid #010203');
    expect(s.borderRight).toBe('1px dashed #040506');
    expect(s.borderTop).toBeUndefined();
    expect(s.borderBottom).toBeUndefined();
  });
  it('un bordo senza colore è nero', () => {
    expect(stile({ borders: { top: { style: 'thin', color: '' } } }).borderTop).toBe('1px solid #000000');
  });
  it('gli stili di riga e di colonna arrivano alle celle', () => {
    const t = costruisciTabella(foglio({ celle: { A1: 'x', B2: 'y' }, stiliColonna: { 1: { bold: true } }, stiliRiga: { 2: { italic: true } } }), () => testo('v'))!;
    expect(t.righe[0][0].stile.fontWeight).toBe('700');
    expect(t.righe[0][1].stile.fontWeight).toBeUndefined();
    expect(t.righe[1][0].stile.fontStyle).toBe('italic');
    expect(t.righe[1][0].stile.fontWeight).toBe('700');
    expect(t.righe[1][1].stile.fontStyle).toBe('italic');
  });
});

describe('T316: costruisciTabella, scala', () => {
  it('la larghezza di una pagina è di 680 px', () => { expect(LARGHEZZA_PAGINA).toBe(680); });
  it('se entra in una pagina la scala è 1, anche esattamente al limite', () => {
    expect(costruisciTabella(foglio({ celle: { A1: 'x' } }), () => testo('v'))!.scala).toBe(1);
    expect(costruisciTabella(foglio({ celle: { A1: 'x' }, larghezze: { 1: 680 } }), () => testo('v'))!.scala).toBe(1);
  });
  it('se è più larga si riduce in proporzione', () => {
    expect(costruisciTabella(foglio({ celle: { A1: 'x' }, larghezze: { 1: 1360 } }), () => testo('v'))!.scala).toBe(0.5);
    expect(costruisciTabella(foglio({ celle: { A1: 'x', J1: 'y' } }), () => testo('v'))!.scala).toBeCloseTo(680 / 900, 10);
  });
});
