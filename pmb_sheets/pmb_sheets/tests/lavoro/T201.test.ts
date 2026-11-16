import { describe, it, expect } from 'vitest';
import { leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import {
  avvisiScritturaXlsx, codiceFormatoExcel, formulaPerExcel, nomiFoglioXlsx, scriviXlsx, tipoLetterale,
} from '../../src/formati/xlsx-scrivi';
import { foglioVuoto, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import type { CellStyle } from '../../src/sheet/styles';

const dec = new TextDecoder();

async function apri(s: Scambio) {
  const voci = await leggiZip(await scriviXlsx(s));
  const testo = (n: string): string => {
    const d = voci.get(n);
    if (!d) throw new Error(`manca ${n}`);
    return dec.decode(d);
  };
  return { voci, testo, xml: (n: string): NodoXml => analizzaXml(testo(n)) };
}
function foglio(nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio { return { ...foglioVuoto(nome), ...extra }; }
function scambio(fogli: FoglioScambio[], attivo?: string): Scambio { return { fogli, foglioAttivo: attivo ?? fogli[0]?.nome ?? '' }; }
const righe = (x: NodoXml): NodoXml[] => figliElemento(trova(x, 'sheetData') as NodoXml, 'row');
const celleDi = (x: NodoXml): NodoXml[] => righe(x).flatMap((r) => figliElemento(r, 'c'));
function cella(x: NodoXml, ref: string): NodoXml {
  const c = celleDi(x).find((n) => n.attributi.r === ref);
  if (!c) throw new Error(`manca la cella ${ref}`);
  return c;
}
async function foglio1(f: Partial<FoglioScambio>) { return (await apri(scambio([foglio('Foglio1', f)]))).xml('xl/worksheets/sheet1.xml'); }
async function stiliDi(f: Partial<FoglioScambio>) {
  const a = await apri(scambio([foglio('Foglio1', f)]));
  const st = a.xml('xl/styles.xml');
  const sheet = a.xml('xl/worksheets/sheet1.xml');
  return {
    st, sheet,
    fonts: figliElemento(trova(st, 'fonts') as NodoXml, 'font'),
    fills: figliElemento(trova(st, 'fills') as NodoXml, 'fill'),
    borders: figliElemento(trova(st, 'borders') as NodoXml, 'border'),
    xfs: figliElemento(trova(st, 'cellXfs') as NodoXml, 'xf'),
    xfDi: (ref: string): NodoXml => figliElemento(trova(st, 'cellXfs') as NodoXml, 'xf')[Number(cella(sheet, ref).attributi.s ?? 0)],
  };
}
function congela<T>(o: T): T {
  if (o && typeof o === 'object') { for (const v of Object.values(o as object)) congela(v); Object.freeze(o); }
  return o;
}
const NERO = '#000000';

describe('T201 scrittura di file .xlsx', () => {
  it('il file ha tutte le parti e sono XML ben formato', async () => {
    const a = await apri(scambio([foglio('Foglio1', { celle: { A1: 'x' } })]));
    expect([...a.voci.keys()].sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
    ]);
    for (const n of a.voci.keys()) expect(() => analizzaXml(a.testo(n)), n).not.toThrow();
    expect(a.testo('xl/workbook.xml')).toContain('fullCalcOnLoad="1"');
  });

  it('senza fogli scrive un foglio vuoto chiamato Foglio1', async () => {
    const a = await apri({ fogli: [], foglioAttivo: '' });
    const fogli = figliElemento(trova(a.xml('xl/workbook.xml'), 'sheets') as NodoXml, 'sheet');
    expect(fogli.map((f) => f.attributi.name)).toEqual(['Foglio1']);
    expect(celleDi(a.xml('xl/worksheets/sheet1.xml'))).toEqual([]);
    expect(trova(a.xml('xl/worksheets/sheet1.xml'), 'dimension')?.attributi.ref).toBe('A1');
    expect(trova(a.xml('xl/worksheets/sheet1.xml'), 'sheetFormatPr')?.attributi.defaultRowHeight).toBe('15');
  });

  it('lo stesso contenuto dà gli stessi byte e l\'ingresso non viene modificato', async () => {
    const s = congela(scambio([foglio('Foglio1', { celle: { A1: 'ciao', B1: '=A1', C1: '3' }, stili: { A1: { bold: true } }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }] })]));
    const x = await scriviXlsx(s);
    const y = await scriviXlsx(s);
    expect(Array.from(x)).toEqual(Array.from(y));
  });

  it('tipoLetterale usa le regole del motore', () => {
    const attesi: Array<[string, string]> = [
      ['=A1+1', 'formula'], ['=', 'testo'], [' true ', 'booleano'], ['False', 'booleano'], ['12', 'numero'], ['-3.5', 'numero'], ['.5', 'numero'],
      ['5.', 'numero'], ['1e3', 'numero'], ['+7', 'numero'], ['007', 'numero'], [' 8 ', 'numero'], ['1,5', 'testo'], ['ciao', 'testo'], ['', 'testo'],
      ['1e999', 'testo'], ['12abc', 'testo'], ['0x10', 'testo'], ['truee', 'testo'],
    ];
    for (const [t, tipo] of attesi) expect(tipoLetterale(t), JSON.stringify(t)).toBe(tipo);
  });

  it('i numeri si scrivono come valore, senza tipo', async () => {
    const x = await foglio1({ celle: { A1: '12', A2: '1.50', A3: '007', A4: '+7', A5: ' -2.5e2 ' } });
    const attesi = ['12', '1.5', '7', '7', '-250'];
    attesi.forEach((v, i) => {
      const c = cella(x, `A${i + 1}`);
      expect(c.attributi.t, `A${i + 1}`).toBeUndefined();
      expect(testoXml(trova(c, 'v') as NodoXml)).toBe(v);
    });
  });

  it('i testi vanno nelle stringhe condivise, una volta sola, con spazi e simboli intatti', async () => {
    const a = await apri(scambio([foglio('Foglio1', { celle: { A1: 'ciao', B1: 'ciao', C1: '  <a & "b">  ', D1: 'caffè\nnuova riga' } })]));
    const x = a.xml('xl/worksheets/sheet1.xml');
    expect(cella(x, 'A1').attributi.t).toBe('s');
    expect(testoXml(trova(cella(x, 'A1'), 'v') as NodoXml)).toBe(testoXml(trova(cella(x, 'B1'), 'v') as NodoXml));
    const sst = a.xml('xl/sharedStrings.xml');
    const voci = figliElemento(sst, 'si').map((si) => testoXml(si));
    expect(voci).toEqual(['ciao', '  <a & "b">  ', 'caffè\nnuova riga']);
    expect(sst.attributi.count).toBe('3');
    expect(sst.attributi.uniqueCount).toBe('3');
    expect(testoXml(trova(cella(x, 'C1'), 'v') as NodoXml)).toBe('1');
    expect(figliElemento(sst, 'si')[1].figli.length).toBe(1);
    expect((figliElemento(sst, 'si')[1].figli[0] as NodoXml).attributi['xml:space']).toBe('preserve');
  });

  it('i booleani si scrivono con tipo b e valore 1 o 0', async () => {
    const x = await foglio1({ celle: { A1: 'true', A2: ' FALSE ' } });
    expect(cella(x, 'A1').attributi.t).toBe('b');
    expect(testoXml(trova(cella(x, 'A1'), 'v') as NodoXml)).toBe('1');
    expect(cella(x, 'A2').attributi.t).toBe('b');
    expect(testoXml(trova(cella(x, 'A2'), 'v') as NodoXml)).toBe('0');
  });

  it('le formule si scrivono senza uguale e senza valore calcolato', async () => {
    const x = await foglio1({ celle: { A1: '=SUM(B1:B3)', A2: '=IF(B1<2,"a&b",1)' } });
    const c1 = cella(x, 'A1');
    expect(testoXml(trova(c1, 'f') as NodoXml)).toBe('SUM(B1:B3)');
    expect(trova(c1, 'v')).toBeUndefined();
    expect(c1.attributi.t).toBeUndefined();
    expect(testoXml(trova(cella(x, 'A2'), 'f') as NodoXml)).toBe('IF(B1<2,"a&b",1)');
  });

  it('formulaPerExcel aggiunge _xlfn. solo alle funzioni recenti e fuori dalle virgolette', () => {
    expect(formulaPerExcel('=MAXIFS(A1:A3,B1:B3,">1")')).toBe('_xlfn.MAXIFS(A1:A3,B1:B3,">1")');
    expect(formulaPerExcel('=maxifs(A1:A3,B1:B3,1)+MINIFS(A1:A3,B1:B3,1)')).toBe('_xlfn.MAXIFS(A1:A3,B1:B3,1)+_xlfn.MINIFS(A1:A3,B1:B3,1)');
    expect(formulaPerExcel('="MAXIFS(x)"&"a""IFS(b)"')).toBe('"MAXIFS(x)"&"a""IFS(b)"');
    expect(formulaPerExcel('=_xlfn.IFS(1,2,3,4)')).toBe('_xlfn.IFS(1,2,3,4)');
    expect(formulaPerExcel('=SUMIFS(A1:A2,B1:B2,1)+MYMAXIFS(1)+IFERROR(1,2)')).toBe('SUMIFS(A1:A2,B1:B2,1)+MYMAXIFS(1)+IFERROR(1,2)');
    expect(formulaPerExcel('SWITCH(A1,1,"x")')).toBe('_xlfn.SWITCH(A1,1,"x")');
    expect(formulaPerExcel('=TEXTJOIN(",",1,A1:A3)+CONCAT(A1,B1)+XLOOKUP(1,A1:A2,B1:B2)+XMATCH(1,A1:A2)')).toBe(
      '_xlfn.TEXTJOIN(",",1,A1:A3)+_xlfn.CONCAT(A1,B1)+_xlfn.XLOOKUP(1,A1:A2,B1:B2)+_xlfn.XMATCH(1,A1:A2)');
  });

  it('con formato Testo anche i numeri e i booleani restano testo, le formule no', async () => {
    const x = await foglio1({ celle: { A1: '12', A2: 'true', A3: '=1+1' }, stili: { A1: { numFmt: '@' }, A2: { numFmt: '@' }, A3: { numFmt: '@' } } });
    expect(cella(x, 'A1').attributi.t).toBe('s');
    expect(cella(x, 'A2').attributi.t).toBe('s');
    expect(trova(cella(x, 'A3'), 'f')).toBeDefined();
  });

  it('indirizzi in minuscolo si correggono, quelli non validi si scartano, righe e colonne vanno in ordine', async () => {
    const x = await foglio1({ celle: { C3: 'c3', a1: 'a1', B1: 'b1', A3: 'a3', ZZZ0: 'no', '??': 'no', A0: 'no' } });
    expect(righe(x).map((r) => r.attributi.r)).toEqual(['1', '3']);
    expect(celleDi(x).map((c) => c.attributi.r)).toEqual(['A1', 'B1', 'A3', 'C3']);
  });

  it('la dimensione copre le celle scritte', async () => {
    const x = await foglio1({ celle: { B2: 'x', D4: 'y' }, stili: { F5: { bold: true } } });
    expect(trova(x, 'dimension')?.attributi.ref).toBe('B2:F5');
  });

  it('una cella con solo lo stile si scrive vuota con il suo stile', async () => {
    const s = await stiliDi({ celle: { A1: 'x' }, stili: { A1: { bold: true }, B2: { fill: '#ff0000' } } });
    expect(celleDi(s.sheet).map((n) => n.attributi.r)).toEqual(['A1', 'B2']);
    const c = cella(s.sheet, 'B2');
    expect(c.figli.length).toBe(0);
    expect(c.attributi.t).toBeUndefined();
    expect(Number(c.attributi.s)).toBeGreaterThan(0);
  });

  it('carattere: grassetto, corsivo, barrato, sottolineato, nome, dimensione e colore', async () => {
    const s = await stiliDi({ celle: { A1: 'x' }, stili: { A1: { bold: true, italic: true, underline: true, strike: true, fontFamily: 'Roboto', fontSize: 14, color: '#ff0000' } } });
    expect(s.fonts.length).toBe(2);
    expect(s.fonts[0].figli.map((f) => (f as NodoXml).nome)).toEqual(['sz', 'name']);
    expect((s.fonts[0].figli[0] as NodoXml).attributi.val).toBe('10');
    expect((s.fonts[0].figli[1] as NodoXml).attributi.val).toBe('Arial');
    const f = s.fonts[Number(s.xfDi('A1').attributi.fontId)];
    expect(f.figli.map((x) => (x as NodoXml).nome)).toEqual(['b', 'i', 'strike', 'u', 'sz', 'color', 'name']);
    expect(trova(f, 'sz')?.attributi.val).toBe('14');
    expect(trova(f, 'color')?.attributi.rgb).toBe('FFFF0000');
    expect(trova(f, 'name')?.attributi.val).toBe('Roboto');
    expect(s.xfDi('A1').attributi.applyFont).toBe('1');
  });

  it('dimensioni e colori non validi si ignorano', async () => {
    const s = await stiliDi({ celle: { A1: 'x' }, stili: { A1: { bold: true, fontSize: -3, color: 'auto', fontFamily: '  ' } } });
    const f = s.fonts[Number(s.xfDi('A1').attributi.fontId)];
    expect(trova(f, 'sz')?.attributi.val).toBe('10');
    expect(trova(f, 'name')?.attributi.val).toBe('Arial');
    expect(trova(f, 'color')).toBeUndefined();
  });

  it('riempimento: pieno solo con un colore esadecimale a sei cifre', async () => {
    const s = await stiliDi({ celle: { A1: 'x', A2: 'x', A3: 'x' }, stili: { A1: { fill: '#00ff00' }, A2: { fill: 'none' }, A3: { fill: '#abc' } } });
    expect(s.fills.length).toBe(3);
    const r = trova(s.fills[2], 'patternFill') as NodoXml;
    expect(r.attributi.patternType).toBe('solid');
    expect(trova(r, 'fgColor')?.attributi.rgb).toBe('FF00FF00');
    expect(s.xfDi('A1').attributi.fillId).toBe('2');
    expect(s.xfDi('A2').attributi.fillId).toBe('0');
    expect(s.xfDi('A3').attributi.fillId).toBe('0');
    expect(trova(s.fills[0], 'patternFill')?.attributi.patternType).toBe('none');
    expect(trova(s.fills[1], 'patternFill')?.attributi.patternType).toBe('gray125');
  });

  it('bordi: lato per lato, con stile e colore', async () => {
    const s = await stiliDi({
      celle: { A1: 'x' },
      stili: { A1: { borders: { top: { style: 'thin', color: NERO }, left: { style: 'dashed', color: '#ff0000' }, bottom: { style: 'none', color: NERO }, right: { style: 'medium', color: 'rosso' } } } },
    });
    const b = s.borders[Number(s.xfDi('A1').attributi.borderId)];
    expect(b.figli.map((x) => (x as NodoXml).nome)).toEqual(['left', 'right', 'top', 'bottom', 'diagonal']);
    const lato = (n: string): NodoXml => trova(b, n) as NodoXml;
    expect(lato('left').attributi.style).toBe('dashed');
    expect(trova(lato('left'), 'color')?.attributi.rgb).toBe('FFFF0000');
    expect(lato('top').attributi.style).toBe('thin');
    expect(trova(lato('top'), 'color')?.attributi.rgb).toBe('FF000000');
    expect(lato('bottom').attributi.style).toBeUndefined();
    expect(lato('bottom').figli.length).toBe(0);
    expect(lato('right').attributi.style).toBe('medium');
    expect(trova(lato('right'), 'color')?.attributi.auto).toBe('1');
    expect(s.borders[0].figli.every((x) => (x as NodoXml).figli.length === 0)).toBe(true);
  });

  it('allineamento orizzontale, verticale e a capo', async () => {
    const s = await stiliDi({
      celle: { A1: 'x', A2: 'x', A3: 'x', A4: 'x' },
      stili: { A1: { hAlign: 'center', vAlign: 'middle', wrap: true }, A2: { hAlign: 'right', vAlign: 'top' }, A3: { vAlign: 'bottom' }, A4: { hAlign: 'left' } },
    });
    const al = (r: string): Record<string, string> => (trova(s.xfDi(r), 'alignment') as NodoXml).attributi;
    expect(al('A1')).toEqual({ horizontal: 'center', vertical: 'center', wrapText: '1' });
    expect(al('A2')).toEqual({ horizontal: 'right', vertical: 'top' });
    expect(al('A3')).toEqual({ vertical: 'bottom' });
    expect(al('A4')).toEqual({ horizontal: 'left' });
    expect(s.xfDi('A1').attributi.applyAlignment).toBe('1');
  });

  it('formato dei numeri: integrati con il loro numero, gli altri personalizzati e senza doppioni', async () => {
    const f = (numFmt: string): CellStyle => ({ numFmt });
    const s = await stiliDi({
      celle: { A1: '1', A2: '1', A3: '1', A4: '1', A5: '1', A6: '1', A7: '1', A8: '1' },
      stili: { A1: f('0.00'), A2: f('@'), A3: f('€#,##0.00'), A4: f('dd/mm/yyyy'), A5: f('dd/mm/yyyy'), A6: f(''), A7: f('0.00%'), A8: f('#,##0.00') },
    });
    const id = (r: string): string => s.xfDi(r).attributi.numFmtId;
    expect([id('A1'), id('A2'), id('A3'), id('A4'), id('A5'), id('A6'), id('A7'), id('A8')]).toEqual(['2', '49', '164', '165', '165', '0', '10', '4']);
    const personalizzati = figliElemento(trova(s.st, 'numFmts') as NodoXml, 'numFmt');
    expect(personalizzati.map((n) => [n.attributi.numFmtId, n.attributi.formatCode])).toEqual([['164', '"€"#,##0.00'], ['165', 'dd/mm/yyyy']]);
    expect(trova(s.st, 'numFmts')?.attributi.count).toBe('2');
    expect(s.xfDi('A6').attributi.applyNumberFormat).toBeUndefined();
    expect(s.xfDi('A1').attributi.applyNumberFormat).toBe('1');
  });

  it('codiceFormatoExcel mette il simbolo dell\'euro tra virgolette solo se serve', () => {
    expect(codiceFormatoExcel('€#,##0.00')).toBe('"€"#,##0.00');
    expect(codiceFormatoExcel('#,##0.00 €')).toBe('#,##0.00 "€"');
    expect(codiceFormatoExcel('"€"0')).toBe('"€"0');
    expect(codiceFormatoExcel('[$€-2] 0.00')).toBe('[$€-2] 0.00');
    expect(codiceFormatoExcel('0.00')).toBe('0.00');
  });

  it('stili uguali condividono la stessa combinazione e lo stile vuoto non scrive l\'attributo s', async () => {
    const s = await stiliDi({ celle: { A1: 'x', A2: 'y', A3: 'z' }, stili: { A1: { bold: true }, A2: { bold: true }, A3: {} } });
    expect(s.xfs.length).toBe(2);
    expect(cella(s.sheet, 'A1').attributi.s).toBe(cella(s.sheet, 'A2').attributi.s);
    expect(cella(s.sheet, 'A3').attributi.s).toBeUndefined();
    expect(trova(s.st, 'cellXfs')?.attributi.count).toBe('2');
    expect(trova(s.st, 'fonts')?.attributi.count).toBe('2');
  });

  it('lo stile di una cella è la somma di riga, colonna e cella, con i bordi fusi lato per lato', async () => {
    const s = await stiliDi({
      celle: { A2: 'x' },
      stiliRiga: { 2: { bold: true, borders: { top: { style: 'thin', color: NERO } } } },
      stiliColonna: { 1: { fill: '#ff0000', borders: { left: { style: 'thin', color: NERO } } } },
      stili: { A2: { borders: { bottom: { style: 'medium', color: NERO } } } },
    });
    const xf = s.xfDi('A2');
    expect(s.fonts[Number(xf.attributi.fontId)].figli[0]).toMatchObject({ nome: 'b' });
    expect(trova(s.fills[Number(xf.attributi.fillId)], 'patternFill')?.attributi.patternType).toBe('solid');
    const b = s.borders[Number(xf.attributi.borderId)];
    expect(['left', 'right', 'top', 'bottom'].map((n) => trova(b, n)?.attributi.style)).toEqual(['thin', undefined, 'thin', 'medium']);
  });

  it('la cella vince sulla colonna e la colonna sulla riga', async () => {
    const s = await stiliDi({
      celle: { A1: 'x', B1: 'y' },
      stiliRiga: { 1: { fill: '#111111' } }, stiliColonna: { 1: { fill: '#222222' } }, stili: { A1: { fill: '#333333' } },
    });
    const fgDi = (r: string): string | undefined => trova(trova(s.fills[Number(s.xfDi(r).attributi.fillId)], 'patternFill') as NodoXml, 'fgColor')?.attributi.rgb;
    expect(fgDi('A1')).toBe('FF333333');
    expect(fgDi('B1')).toBe('FF111111');
  });

  it('larghezza delle colonne in caratteri, stile di colonna e colonne ordinate', async () => {
    const x = await foglio1({ larghezze: { 3: 5, 1: 120 }, stiliColonna: { 2: { bold: true } } });
    const cols = figliElemento(trova(x, 'cols') as NodoXml, 'col');
    expect(cols.map((c) => c.attributi.min)).toEqual(['1', '2', '3']);
    expect(cols.map((c) => c.attributi.max)).toEqual(['1', '2', '3']);
    expect(cols.map((c) => c.attributi.width)).toEqual(['16.43', '8.43', '0']);
    expect(cols.map((c) => c.attributi.customWidth)).toEqual(['1', undefined, '1']);
    expect(cols[0].attributi.style).toBeUndefined();
    expect(Number(cols[1].attributi.style)).toBeGreaterThan(0);
  });

  it('senza larghezze né stili di colonna non c\'è l\'elemento cols', async () => {
    expect(trova(await foglio1({ celle: { A1: 'x' } }), 'cols')).toBeUndefined();
  });

  it('altezza delle righe in punti e stile di riga, anche per righe senza celle', async () => {
    const x = await foglio1({ celle: { A1: 'x' }, altezze: { 2: 40, 5: 20 }, stiliRiga: { 2: { bold: true } } });
    const r = righe(x);
    expect(r.map((n) => n.attributi.r)).toEqual(['1', '2', '5']);
    expect(r[0].attributi.ht).toBeUndefined();
    expect(r[0].attributi.customFormat).toBeUndefined();
    expect(r[2].attributi.customFormat).toBeUndefined();
    expect(r[1].attributi.ht).toBe('30');
    expect(r[1].attributi.customHeight).toBe('1');
    expect(Number(r[1].attributi.s)).toBeGreaterThan(0);
    expect(r[1].attributi.customFormat).toBe('1');
    expect(r[2].attributi.ht).toBe('15');
    expect(r[2].attributi.s).toBeUndefined();
    expect(r[2].figli.length).toBe(0);
  });

  it('celle unite: solo intervalli veri', async () => {
    const x = await foglio1({
      celle: { A1: 'x' },
      unioni: [
        { startRow: 1, endRow: 2, startCol: 1, endCol: 2 }, { startRow: 3, endRow: 5, startCol: 3, endCol: 3 },
        { startRow: 4, endRow: 4, startCol: 4, endCol: 4 }, { startRow: 2, endRow: 1, startCol: 1, endCol: 1 }, { startRow: 0, endRow: 3, startCol: 1, endCol: 1 },
      ],
    });
    const m = trova(x, 'mergeCells') as NodoXml;
    expect(m.attributi.count).toBe('2');
    expect(figliElemento(m, 'mergeCell').map((c) => c.attributi.ref)).toEqual(['A1:B2', 'C3:C5']);
    expect(trova(await foglio1({ celle: { A1: 'x' } }), 'mergeCells')).toBeUndefined();
  });

  it('righe e colonne bloccate', async () => {
    const pannello = async (rc: number, cc: number) => trova(await foglio1({ righeCongelate: rc, colonneCongelate: cc }), 'sheetViews/sheetView/pane')?.attributi;
    expect(await pannello(2, 1)).toEqual({ xSplit: '1', ySplit: '2', topLeftCell: 'B3', activePane: 'bottomRight', state: 'frozen' });
    expect(await pannello(1, 0)).toEqual({ ySplit: '1', topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' });
    expect(await pannello(0, 3)).toEqual({ xSplit: '3', topLeftCell: 'D1', activePane: 'topRight', state: 'frozen' });
    expect(await pannello(0, 0)).toBeUndefined();
  });

  it('più fogli: ordine, foglio attivo, relazioni e tipi di contenuto', async () => {
    const a = await apri(scambio([
      foglio('Uno', { celle: { A1: 'ciao' } }), foglio('Due', { celle: { A1: 'ciao', B1: 'altro' }, stili: { A1: { bold: true } } }), foglio('Tre'),
    ], 'Due'));
    const w = a.xml('xl/workbook.xml');
    const fogli = figliElemento(trova(w, 'sheets') as NodoXml, 'sheet');
    expect(fogli.map((f) => [f.attributi.name, f.attributi.sheetId, f.attributi['r:id']])).toEqual([['Uno', '1', 'rId1'], ['Due', '2', 'rId2'], ['Tre', '3', 'rId3']]);
    expect(trova(w, 'bookViews/workbookView')?.attributi.activeTab).toBe('1');
    const selezionati = [1, 2, 3].map((i) => trova(a.xml(`xl/worksheets/sheet${i}.xml`), 'sheetViews/sheetView')?.attributi.tabSelected);
    expect(selezionati).toEqual([undefined, '1', undefined]);
    const rel = figliElemento(a.xml('xl/_rels/workbook.xml.rels'), 'Relationship').map((r) => [r.attributi.Id, r.attributi.Target]);
    expect(rel).toEqual([
      ['rId1', 'worksheets/sheet1.xml'], ['rId2', 'worksheets/sheet2.xml'], ['rId3', 'worksheets/sheet3.xml'], ['rId4', 'styles.xml'], ['rId5', 'sharedStrings.xml'],
    ]);
    const parti = figliElemento(a.xml('[Content_Types].xml'), 'Override').map((o) => o.attributi.PartName);
    expect(parti).toEqual(['/xl/workbook.xml', '/xl/worksheets/sheet1.xml', '/xl/worksheets/sheet2.xml', '/xl/worksheets/sheet3.xml', '/xl/styles.xml', '/xl/sharedStrings.xml']);
    expect(figliElemento(a.xml('xl/sharedStrings.xml'), 'si').map((si) => testoXml(si))).toEqual(['ciao', 'altro']);
    expect(trova(a.xml('_rels/.rels'), 'Relationship')?.attributi.Target).toBe('xl/workbook.xml');
  });

  it('gli stili e le misure di ogni foglio restano al loro foglio', async () => {
    const a = await apri(scambio([
      foglio('Uno', { celle: { A1: 'x' }, larghezze: { 1: 75 }, righeCongelate: 1 }), foglio('Due', { celle: { A1: 'y' }, stili: { A1: { italic: true } }, unioni: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 3 }] }),
    ]));
    const uno = a.xml('xl/worksheets/sheet1.xml');
    const due = a.xml('xl/worksheets/sheet2.xml');
    expect(trova(uno, 'cols')).toBeDefined();
    expect(trova(due, 'cols')).toBeUndefined();
    expect(trova(uno, 'mergeCells')).toBeUndefined();
    expect(trova(due, 'mergeCells')).toBeDefined();
    expect(trova(uno, 'sheetViews/sheetView/pane')).toBeDefined();
    expect(trova(due, 'sheetViews/sheetView/pane')).toBeUndefined();
    expect(cella(uno, 'A1').attributi.s).toBeUndefined();
    expect(Number(cella(due, 'A1').attributi.s)).toBeGreaterThan(0);
  });

  it('nomiFoglioXlsx: caratteri vietati, lunghezza, apostrofi, vuoti e doppioni', () => {
    expect(nomiFoglioXlsx(['a/b', ':?*[]\\', 'x'.repeat(40), '\'x\'', '', '  '])).toEqual(['a_b', '______', 'x'.repeat(31), 'x', 'Foglio5', 'Foglio6']);
    expect(nomiFoglioXlsx(['A', 'a', 'A'])).toEqual(['A', 'a (2)', 'A (3)']);
    const lungo = nomiFoglioXlsx(['y'.repeat(31), 'y'.repeat(31)]);
    expect(lungo[0]).toBe('y'.repeat(31));
    expect(lungo[1]).toBe(`${'y'.repeat(27)} (2)`);
    expect(lungo[1].length).toBe(31);
    expect(nomiFoglioXlsx(['Dati', 'Altro'])).toEqual(['Dati', 'Altro']);
  });

  it('il nome del foglio scritto nel file è quello sistemato e i simboli XML sono protetti', async () => {
    const a = await apri(scambio([foglio('Bilancio & "2024" <a>'), foglio('x/y')]));
    const fogli = figliElemento(trova(a.xml('xl/workbook.xml'), 'sheets') as NodoXml, 'sheet');
    expect(fogli.map((f) => f.attributi.name)).toEqual(['Bilancio & "2024" <a>', 'x_y']);
  });

  it('avvisiScritturaXlsx dice quali fogli sono stati rinominati', () => {
    expect(avvisiScritturaXlsx(scambio([foglio('Dati'), foglio('Altro')]))).toEqual([]);
    const avvisi = avvisiScritturaXlsx(scambio([foglio('Dati'), foglio('a/b'), foglio('')]));
    expect(avvisi.length).toBe(2);
    expect(avvisi[0]).toContain('«a/b»');
    expect(avvisi[0]).toContain('«a_b»');
    expect(avvisi[1]).toContain('«Foglio3»');
  });

  it('i caratteri che l\'XML non ammette si tolgono e il file resta valido', async () => {
    const a = await apri(scambio([foglio('Foglio1', { celle: { A1: 'a\u0001b\u0008c' } })]));
    expect(figliElemento(a.xml('xl/sharedStrings.xml'), 'si').map((si) => testoXml(si))).toEqual(['abc']);
  });
});
