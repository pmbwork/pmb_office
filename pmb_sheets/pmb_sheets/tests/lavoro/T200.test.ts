import { describe, it, expect } from 'vitest';
import {
  NOME_FOGLIO_PREDEFINITO, avvisiDiConversione, documentoDaScambio, foglioVuoto, indirizzoCella, scambioDaDocumento,
  type FoglioScambio, type Scambio,
} from '../../src/formati/scambio';
import { StyleRegistry, restoreSheetStylesFromData, cellKey, type CellStyle } from '../../src/sheet/index';
import type { SheetDocumentData } from '../../src/sheet/document-data';
import { createWorkbook } from '../../src/engine/workbook';

function congela<T>(o: T): T {
  if (o && typeof o === 'object') { for (const v of Object.values(o as object)) congela(v); Object.freeze(o); }
  return o;
}

const GRASSETTO: CellStyle = { bold: true };
const ROSSO: CellStyle = { fill: '#ff0000', numFmt: '0.00' };

function documento(extra: Partial<SheetDocumentData> = {}, fogli?: unknown): SheetDocumentData {
  const r = new StyleRegistry();
  const idB = r.register(GRASSETTO);
  const idR = r.register(ROSSO);
  return {
    version: 1,
    workbookJson: JSON.stringify(fogli ?? { version: 1, sheets: [{ name: 'Foglio1', cells: { A1: 'Nome', B2: '=SUM(A1:A3)', C3: '12' } }, { name: 'Dati', cells: { A1: 'x' } }] }),
    styles: [...r.getAllStyles()],
    cellStyles: { '1,1': idB, '2,2': idR },
    rowStyles: { '3': idB },
    colStyles: { '2': idR },
    colWidths: { '1': 120, '3': 80 },
    rowHeights: { '2': 40 },
    freezeRows: 1,
    freezeCols: 2,
    activeSheetName: 'Foglio1',
    merges: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }],
    dataValidations: {},
    namedRanges: [],
    conditionalFormats: [],
    ...extra,
  };
}

describe('T200: indirizzi', () => {
  it('riga e colonna diventano un indirizzo', () => {
    expect(indirizzoCella(1, 1)).toBe('A1');
    expect(indirizzoCella(3, 2)).toBe('B3');
    expect(indirizzoCella(10, 27)).toBe('AA10');
    expect(indirizzoCella(1048576, 16384)).toBe('XFD1048576');
  });
});

describe('T200: dal documento allo scambio', () => {
  it('fogli nell\'ordine, celle per indirizzo, e stili, misure, unioni e blocchi sul foglio attivo', () => {
    const s = scambioDaDocumento(congela(documento()));
    expect(s.fogli.map((f) => f.nome)).toEqual(['Foglio1', 'Dati']);
    expect(s.foglioAttivo).toBe('Foglio1');
    const f = s.fogli[0];
    expect(f.celle).toEqual({ A1: 'Nome', B2: '=SUM(A1:A3)', C3: '12' });
    expect(f.stili).toEqual({ A1: GRASSETTO, B2: ROSSO });
    expect(f.stiliRiga).toEqual({ 3: GRASSETTO });
    expect(f.stiliColonna).toEqual({ 2: ROSSO });
    expect(f.larghezze).toEqual({ 1: 120, 3: 80 });
    expect(f.altezze).toEqual({ 2: 40 });
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }]);
    expect([f.righeCongelate, f.colonneCongelate]).toEqual([1, 2]);
    expect(s.fogli[1]).toEqual({ ...foglioVuoto('Dati'), celle: { A1: 'x' } });
  });

  it('se il foglio attivo non è il primo, gli stili vanno su quello', () => {
    const s = scambioDaDocumento(documento({ activeSheetName: 'Dati' }));
    expect(s.foglioAttivo).toBe('Dati');
    expect(s.fogli[0].stili).toEqual({});
    expect(s.fogli[1].stili).toEqual({ A1: GRASSETTO, B2: ROSSO });
    expect(s.fogli[1].larghezze).toEqual({ 1: 120, 3: 80 });
  });

  it('un foglio attivo che non esiste vale il primo', () => {
    const s = scambioDaDocumento(documento({ activeSheetName: 'Boh' }));
    expect(s.foglioAttivo).toBe('Foglio1');
    expect(Object.keys(s.fogli[0].stili)).toEqual(['A1', 'B2']);
  });

  it('chiavi e numeri sbagliati si scartano: stili 0 o fuori elenco, celle fuori dal foglio, misure non valide, unioni storte', () => {
    const d = documento({
      cellStyles: { '1,1': 1, 'x,y': 1, '0,1': 1, '1,0': 1, '1048577,1': 1, '1,16385': 1, '1.5,1': 1, '01,1': 2, '2,2': 0, '3,3': 99, '4,4': -1 },
      rowStyles: { '0': 1, '2': 1, 'a': 1 },
      colStyles: { '0': 1, '16385': 1, '4': 2 },
      colWidths: { '1': 100, '2': -5, '3': 0, '4': Number.NaN, '5': Infinity, '0': 50, 'x': 20 },
      rowHeights: { '1': 30, '2': -1, '0': 5 },
      freezeRows: -1,
      freezeCols: 1.5,
      merges: [
        { startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, { startRow: 3, endRow: 1, startCol: 1, endCol: 2 },
        { startRow: 0, endRow: 1, startCol: 1, endCol: 2 }, { startRow: 2, endRow: 2, startCol: 2, endCol: 2 }, { startRow: 1, endRow: 1 } as never,
      ],
    });
    const f = scambioDaDocumento(d).fogli[0];
    expect(f.stili).toEqual({ A1: GRASSETTO });
    expect(f.stiliRiga).toEqual({ 2: GRASSETTO });
    expect(f.stiliColonna).toEqual({ 4: ROSSO });
    expect(f.larghezze).toEqual({ 1: 100 });
    expect(f.altezze).toEqual({ 1: 30 });
    expect([f.righeCongelate, f.colonneCongelate]).toEqual([0, 0]);
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }]);
  });

  it('uno stile vuoto in elenco non diventa uno stile della cella; gli stili letti sono copie, non gli originali', () => {
    const d = documento({ styles: [{}, GRASSETTO, {}], cellStyles: { '1,1': 1, '2,2': 2 }, rowStyles: {}, colStyles: {} });
    const s = scambioDaDocumento(d);
    expect(Object.keys(s.fogli[0].stili)).toEqual(['A1']);
    s.fogli[0].stili.A1.bold = false;
    expect(d.styles[1]).toEqual(GRASSETTO);
  });

  it('una cartella non valida dà un errore chiaro', () => {
    for (const j of ['non json', '{}', JSON.stringify({ version: 2, sheets: [] }), JSON.stringify({ version: 1, sheets: 'x' }), JSON.stringify({ version: 1, sheets: [{ cells: {} }] })]) {
      expect(() => scambioDaDocumento(documento({ workbookJson: j })), j).toThrow(/Cartella di lavoro non valida/);
    }
  });

  it('senza fogli ne esce uno vuoto; celle vuote, non testo o con indirizzo sbagliato non entrano', () => {
    const vuota = scambioDaDocumento(documento({ cellStyles: {}, rowStyles: {}, colStyles: {} }, { version: 1, sheets: [] }));
    expect(vuota.fogli).toEqual([{ ...foglioVuoto(NOME_FOGLIO_PREDEFINITO), larghezze: { 1: 120, 3: 80 }, altezze: { 2: 40 }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }], righeCongelate: 1, colonneCongelate: 2 }]);
    const sporca = scambioDaDocumento(documento({}, { version: 1, sheets: [{ name: 'F', cells: { A1: '', B2: 5, C3: 'ok', '1A': 'no', A0: 'no', XFE1: 'no', '': 'no' } }] }));
    expect(sporca.fogli[0].celle).toEqual({ C3: 'ok' });
  });
});

describe('T200: dallo scambio al documento', () => {
  const foglio = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });

  it('il testo delle celle finisce nella cartella di lavoro e il motore la legge', () => {
    const d = documentoDaScambio({ foglioAttivo: 'Dati', fogli: [foglio('Foglio1', { celle: { A1: 'Nome', B2: '=SUM(A1:A3)' } }), foglio('Dati', { celle: { A1: '5', a2: '7' } })] });
    const j = JSON.parse(d.workbookJson);
    expect(j).toEqual({ version: 1, sheets: [{ name: 'Foglio1', cells: { A1: 'Nome', B2: '=SUM(A1:A3)' } }, { name: 'Dati', cells: { A1: '5', A2: '7' } }] });
    expect(d.activeSheetName).toBe('Dati');
    const w = createWorkbook();
    w.deserialize(d.workbookJson);
    expect(w.getSheet('Dati')).toBeDefined();
    expect(w.getSheet('Foglio1')).toBeDefined();
  });

  it('gli stili si raccolgono senza doppioni: l\'elenco comincia con lo stile vuoto e ogni cella ritrova il suo', () => {
    const d = documentoDaScambio({ foglioAttivo: 'F', fogli: [foglio('F', {
      stili: { A1: GRASSETTO, B2: ROSSO, C3: { bold: true }, D4: {} }, stiliRiga: { 3: GRASSETTO }, stiliColonna: { 2: ROSSO, 5: {} },
    })] });
    expect(d.styles[0]).toEqual({});
    expect(d.styles.length).toBe(3);
    expect(Object.keys(d.cellStyles).sort()).toEqual([cellKey(1, 1), cellKey(2, 2), cellKey(3, 3)].sort());
    expect(d.cellStyles[cellKey(1, 1)]).toBe(d.cellStyles[cellKey(3, 3)]);
    const rip = restoreSheetStylesFromData(d);
    expect(rip.registry.getStyle(rip.cellStyles.get(cellKey(2, 2)) as number)).toEqual(ROSSO);
    expect(rip.registry.getStyle(rip.rowStyles.get(3) as number)).toEqual(GRASSETTO);
    expect(rip.registry.getStyle(rip.colStyles.get(2) as number)).toEqual(ROSSO);
    expect(rip.colStyles.has(5)).toBe(false);
  });

  it('misure, unioni e blocchi sono quelli del foglio attivo; quelli degli altri fogli si perdono', () => {
    const s: Scambio = { foglioAttivo: 'B', fogli: [
      foglio('A', { stili: { A1: GRASSETTO }, larghezze: { 1: 50 }, unioni: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }], righeCongelate: 3 }),
      foglio('B', { larghezze: { 2: 90 }, altezze: { 4: 25 }, unioni: [{ startRow: 2, endRow: 3, startCol: 2, endCol: 2 }], righeCongelate: 1, colonneCongelate: 1 }),
    ] };
    const d = documentoDaScambio(s);
    expect(d.cellStyles).toEqual({});
    expect(d.colWidths).toEqual({ 2: 90 });
    expect(d.rowHeights).toEqual({ 4: 25 });
    expect(d.merges).toEqual([{ startRow: 2, endRow: 3, startCol: 2, endCol: 2 }]);
    expect([d.freezeRows, d.freezeCols]).toEqual([1, 1]);
  });

  it('i nomi dei fogli si sistemano: ai bordi, vuoti, ripetuti anche con maiuscole diverse; il foglio attivo segue', () => {
    const d = documentoDaScambio({ foglioAttivo: '  Dati  ', fogli: [foglio('  Dati  '), foglio('dati'), foglio(''), foglio('Dati')] });
    expect(JSON.parse(d.workbookJson).sheets.map((x: { name: string }) => x.name)).toEqual(['Dati', 'dati (2)', 'Foglio3', 'Dati (3)']);
    expect(d.activeSheetName).toBe('Dati');
    const d2 = documentoDaScambio({ foglioAttivo: 'non c\'è', fogli: [foglio('Uno'), foglio('Due')] });
    expect(d2.activeSheetName).toBe('Uno');
  });

  it('senza fogli nasce Foglio1; indirizzi sbagliati, celle vuote e misure non valide si scartano', () => {
    const d = documentoDaScambio({ foglioAttivo: 'x', fogli: [] });
    expect(JSON.parse(d.workbookJson).sheets).toEqual([{ name: 'Foglio1', cells: {} }]);
    expect(d.activeSheetName).toBe('Foglio1');
    const sporco = documentoDaScambio({ foglioAttivo: 'F', fogli: [foglio('F', {
      celle: { A1: '', '1A': 'x', B2: 'ok' }, stili: { '??': GRASSETTO, C1: GRASSETTO },
      larghezze: { 0: 10, 1: -3, 2: 70 }, altezze: { 1: 0, 3: 20 }, unioni: [{ startRow: 2, endRow: 1, startCol: 1, endCol: 1 }], righeCongelate: -2, colonneCongelate: 2.5,
    })] });
    expect(JSON.parse(sporco.workbookJson).sheets[0].cells).toEqual({ B2: 'ok' });
    expect(Object.keys(sporco.cellStyles)).toEqual([cellKey(1, 3)]);
    expect(sporco.colWidths).toEqual({ 2: 70 });
    expect(sporco.rowHeights).toEqual({ 3: 20 });
    expect(sporco.merges).toEqual([]);
    expect([sporco.freezeRows, sporco.freezeCols]).toEqual([0, 0]);
  });
});

describe('T200: andata e ritorno e avvisi', () => {
  it('documento → scambio → documento conserva celle, stili, misure, unioni, blocchi e foglio attivo', () => {
    const d = documento();
    const r = documentoDaScambio(scambioDaDocumento(congela(d)));
    expect(JSON.parse(r.workbookJson)).toEqual(JSON.parse(d.workbookJson));
    const a = restoreSheetStylesFromData(d);
    const b = restoreSheetStylesFromData(r);
    expect([...b.cellStyles.keys()].sort()).toEqual([...a.cellStyles.keys()].sort());
    for (const [k, id] of a.cellStyles) expect(b.registry.getStyle(b.cellStyles.get(k) as number)).toEqual(a.registry.getStyle(id));
    expect(b.registry.getStyle(b.rowStyles.get(3) as number)).toEqual(GRASSETTO);
    expect(b.registry.getStyle(b.colStyles.get(2) as number)).toEqual(ROSSO);
    expect([r.colWidths, r.rowHeights, r.merges, r.freezeRows, r.freezeCols, r.activeSheetName]).toEqual([d.colWidths, d.rowHeights, d.merges, d.freezeRows, d.freezeCols, d.activeSheetName]);
  });

  it('scambio → documento → scambio dà lo stesso scambio, anche con il foglio attivo al secondo posto', () => {
    const s: Scambio = { foglioAttivo: 'Dati', fogli: [
      { ...foglioVuoto('Foglio1'), celle: { A1: 'a' } },
      { ...foglioVuoto('Dati'), celle: { B2: '=1+1' }, stili: { B2: ROSSO }, stiliRiga: { 2: GRASSETTO }, stiliColonna: { 3: ROSSO }, larghezze: { 2: 99 }, altezze: { 2: 33 }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }], righeCongelate: 2, colonneCongelate: 1 },
    ] };
    expect(scambioDaDocumento(documentoDaScambio(congela(s)))).toEqual(s);
  });

  it('ogni foglio conserva i suoi stili e le sue misure: nessun avviso di conversione', () => {
    const f = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });
    const s = { foglioAttivo: 'A', fogli: [f('A'), f('Dati', { stili: { A1: GRASSETTO } }), f('Misure', { larghezze: { 1: 80 } }), f('Uniti', { unioni: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }] }), f('Blocco', { colonneCongelate: 1 })] };
    expect(avvisiDiConversione(s)).toEqual([]);
    const dati = documentoDaScambio(s);
    const ritorno = scambioDaDocumento(dati);
    expect(ritorno.fogli.find((x) => x.nome === 'Dati')!.stili.A1).toEqual(GRASSETTO);
    expect(ritorno.fogli.find((x) => x.nome === 'Misure')!.larghezze).toEqual({ 1: 80 });
    expect(ritorno.fogli.find((x) => x.nome === 'Uniti')!.unioni).toHaveLength(1);
    expect(ritorno.fogli.find((x) => x.nome === 'Blocco')!.colonneCongelate).toBe(1);
    expect(ritorno.fogli.find((x) => x.nome === 'A')!.stili).toEqual({});
  });


  it('i dati in ingresso non si modificano', () => {
    const d = congela(documento());
    expect(() => scambioDaDocumento(d)).not.toThrow();
    const s = congela({ foglioAttivo: 'F', fogli: [{ ...foglioVuoto('F'), celle: { A1: 'x' }, stili: { A1: GRASSETTO }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }] }] });
    expect(() => documentoDaScambio(s)).not.toThrow();
  });
});
