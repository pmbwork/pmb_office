// T548 — file .ods: colore della scheda e formattazioni condizionali si salvano e si rileggono (erano i due limiti noti del giro fisico).
// Il modello è un file salvato da LibreOffice 7 (convertito da un .xlsx con tutti i tipi di regola): stessi elementi, stessi attributi.
import { describe, it, expect } from 'vitest';
import { scriviZip, leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { avvisiScritturaOds, scriviOds, TIPO_ODS } from '../../src/formati/ods-scrivi';
import { leggiOds } from '../../src/formati/ods-leggi';
import { areeDaOds, condizioneDaOds } from '../../src/formati/ods-condizionali';
import { foglioVuoto, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import type { ConditionalFormatRule } from '../../src/sheet/conditional-format';
import { paginaPredefinita } from '../../src/sheet/pagina';

const dec = new TextDecoder();
const cod = new TextEncoder();
const foglio = (nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio => ({ ...foglioVuoto(nome), ...extra });
const scambio = (fogli: FoglioScambio[]): Scambio => ({ fogli, foglioAttivo: fogli[0].nome });
async function parti(s: Scambio) {
  const voci = await leggiZip(await scriviOds(s));
  const xml = (n: string): NodoXml | undefined => (voci.has(n) ? analizzaXml(dec.decode(voci.get(n))) : undefined);
  return { contenuto: xml('content.xml') as NodoXml, stili: xml('styles.xml'), testo: dec.decode(voci.get('content.xml')) };
}
const tabelle = (c: NodoXml): NodoXml[] => figliElemento(trova(c, 'office:body/office:spreadsheet') as NodoXml, 'table:table');
const stiliAuto = (c: NodoXml): NodoXml[] => figliElemento(trova(c, 'office:automatic-styles') as NodoXml, 'style:style');
const area = (startRow: number, endRow: number, startCol: number, endCol: number) => ({ startRow, endRow, startCol, endCol });
const senzaId = (r: ConditionalFormatRule[] | undefined) => (r ?? []).map(({ id: _id, ...x }) => x);

const REGOLE: ConditionalFormatRule[] = [
  { id: 'a', type: 'cell_value', range: area(1, 10, 1, 1), operator: 'greater_than', value1: 5, style: { backgroundColor: '#ffc7ce', textColor: '#9c0006', bold: true } },
  { id: 'b', type: 'cell_value', range: area(1, 10, 1, 1), operator: 'between', value1: 2, value2: 4, style: { backgroundColor: '#c6efce' } },
  { id: 'c', type: 'cell_value', range: area(1, 10, 2, 2), operator: 'not_equal_to', value1: 4, style: { italic: true, underline: true } },
  { id: 'd', type: 'cell_value', range: area(1, 10, 2, 2), operator: 'less_equal', value1: 3, style: { textColor: '#0000ff' } },
  { id: 'e', type: 'text', range: area(1, 10, 3, 3), operator: 'contains', value1: 'a"b', style: { backgroundColor: '#ffc7ce' } },
  { id: 'f', type: 'text', range: area(1, 10, 3, 3), operator: 'not_contains', value1: 'cd', style: { backgroundColor: '#ffc7ce' } },
  { id: 'g', type: 'text', range: area(1, 10, 3, 3), operator: 'starts_with', value1: 'x', style: { backgroundColor: '#ffc7ce' } },
  { id: 'h', type: 'text', range: area(1, 10, 3, 3), operator: 'ends_with', value1: 'y', style: { backgroundColor: '#ffc7ce' } },
  { id: 'i', type: 'text', range: area(1, 10, 3, 3), operator: 'empty', style: { backgroundColor: '#ffc7ce' } },
  { id: 'j', type: 'text', range: area(1, 10, 3, 3), operator: 'not_empty', style: { backgroundColor: '#ffc7ce' } },
  { id: 'k', type: 'formula', range: area(1, 10, 4, 4), value1: '=MOD(D1,2)=0', style: { backgroundColor: '#ffc7ce' } },
  { id: 'l', type: 'color_scale', range: area(1, 10, 5, 5), colorScale: { minColor: '#f8696b', maxColor: '#63be7b' } },
  { id: 'm', type: 'color_scale', range: area(1, 10, 6, 6), colorScale: { minColor: '#f8696b', midColor: '#ffeb84', maxColor: '#63be7b', soglie: { min: { tipo: 'numero', valore: 2 }, mid: { tipo: 'percentile', valore: 40 }, max: { tipo: 'percentuale', valore: 90 } } } },
  { id: 'n', type: 'data_bar', range: area(1, 10, 7, 7), dataBar: { color: '#638ec6' } },
  { id: 'o', type: 'icon_set', range: area(1, 5, 8, 8), iconSet: { type: 'arrows' } },
  { id: 'p', type: 'icon_set', range: area(6, 10, 8, 8), iconSet: { type: 'traffic_lights' } },
];

describe('T548 colore della scheda nei file .ods', () => {
  it('si scrive nello stile del foglio, nella forma di OpenDocument 1.3 e in quella vecchia di LibreOffice', async () => {
    const { contenuto } = await parti(scambio([foglio('Uno', { celle: { A1: '1' }, colore: '#FF3366' }), foglio('Due')]));
    const [t1, t2] = tabelle(contenuto);
    const st = stiliAuto(contenuto).find((s) => s.attributi['style:name'] === t1.attributi['table:style-name']) as NodoXml;
    expect(st.attributi['style:family']).toBe('table');
    expect(st.attributi['style:master-page-name']).toBeUndefined();
    expect(trova(st, 'style:table-properties')?.attributi).toMatchObject({ 'table:display': 'true', 'table:tab-color': '#ff3366', 'tableooo:tab-color': '#ff3366' });
    expect(t2.attributi['table:style-name']).toBeUndefined();
  });

  it('va e torna, anche insieme all\'impostazione di pagina; un colore non valido non si scrive', async () => {
    const pagina = { ...paginaPredefinita(), orientamento: 'orizzontale' as const };
    const s = scambio([foglio('Uno', { colore: '#00a933' }), foglio('Due', { colore: '#123456', pagina }), foglio('Tre', { colore: 'rosso' })]);
    const { contenuto } = await parti(s);
    const due = stiliAuto(contenuto).find((x) => x.attributi['style:name'] === tabelle(contenuto)[1].attributi['table:style-name']) as NodoXml;
    expect(due.attributi['style:master-page-name']).toBeTruthy();
    const letto = (await leggiOds(await scriviOds(s))).scambio.fogli;
    expect(letto.map((f) => f.colore)).toEqual(['#00a933', '#123456', undefined]);
    expect(letto[1].pagina?.orientamento).toBe('orizzontale');
  });

  it('si legge anche dai file che hanno solo tableooo:tab-color (LibreOffice prima di OpenDocument 1.3)', async () => {
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:tableooo="http://openoffice.org/2009/table"';
    const content = `<office:document-content ${NS}><office:automatic-styles><style:style style:name="ta1" style:family="table"><style:table-properties table:display="true" tableooo:tab-color="#ABCDEF"/></style:style></office:automatic-styles>`
      + '<office:body><office:spreadsheet><table:table table:name="F" table:style-name="ta1"><table:table-row><table:table-cell/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>';
    const byte = await scriviZip([{ nome: 'mimetype', dati: cod.encode(TIPO_ODS) }, { nome: 'content.xml', dati: cod.encode(content) }]);
    expect((await leggiOds(byte)).scambio.fogli[0].colore).toBe('#abcdef');
  });
});

describe('T548 formattazioni condizionali nei file .ods', () => {
  it('si scrivono come le scrive LibreOffice (calcext:conditional-formats in fondo alla tabella)', async () => {
    const { contenuto, stili } = await parti(scambio([foglio('Foglio 1', { celle: { A1: '1' }, condizionali: REGOLE })]));
    const t = tabelle(contenuto)[0];
    const figli = t.figli.filter((f): f is NodoXml => typeof f !== 'string');
    expect(figli[figli.length - 1].nome).toBe('calcext:conditional-formats');
    const blocchi = figliElemento(figli[figli.length - 1], 'calcext:conditional-format');
    // condizioni consecutive sullo stesso intervallo in un blocco solo: A, B, C, D, poi un blocco per scala, scala, barra, icone, icone
    expect(blocchi.map((b) => b.attributi['calcext:target-range-address'])).toEqual([
      "'Foglio 1'.A1:'Foglio 1'.A10", "'Foglio 1'.B1:'Foglio 1'.B10", "'Foglio 1'.C1:'Foglio 1'.C10", "'Foglio 1'.D1:'Foglio 1'.D10",
      "'Foglio 1'.E1:'Foglio 1'.E10", "'Foglio 1'.F1:'Foglio 1'.F10", "'Foglio 1'.G1:'Foglio 1'.G10", "'Foglio 1'.H1:'Foglio 1'.H5", "'Foglio 1'.H6:'Foglio 1'.H10",
    ]);
    const valori = blocchi.slice(0, 4).flatMap((b) => figliElemento(b, 'calcext:condition').map((c) => c.attributi['calcext:value']));
    expect(valori).toEqual(['>5', 'between(2,4)', '!=4', '<=3', 'contains-text("a""b")', 'not-contains-text("cd")', 'begins-with("x")', 'ends-with("y")',
      'formula-is(LEN(TRIM([.C1]))=0)', 'formula-is(LEN(TRIM([.C1]))>0)', 'formula-is(MOD([.D1];2)=0)']);
    expect(figliElemento(blocchi[0], 'calcext:condition')[0].attributi['calcext:base-cell-address']).toBe("'Foglio 1'.A1");
    const scala = trova(blocchi[5], 'calcext:color-scale') as NodoXml;
    expect(figliElemento(scala, 'calcext:color-scale-entry').map((e) => [e.attributi['calcext:type'], e.attributi['calcext:value'], e.attributi['calcext:color']]))
      .toEqual([['number', '2', '#f8696b'], ['percentile', '40', '#ffeb84'], ['percent', '90', '#63be7b']]);
    const barra = trova(blocchi[6], 'calcext:data-bar') as NodoXml;
    expect(barra.attributi['calcext:positive-color']).toBe('#638ec6');
    expect(figliElemento(barra, 'calcext:formatting-entry').map((e) => e.attributi['calcext:type'])).toEqual(['minimum', 'maximum']);
    expect(trova(blocchi[7], 'calcext:icon-set')?.attributi['calcext:icon-set-type']).toBe('3Arrows');
    expect(trova(blocchi[8], 'calcext:icon-set')?.attributi['calcext:icon-set-type']).toBe('3TrafficLights1');
    // gli stili applicati sono stili con nome in styles.xml, uno per ogni stile diverso
    const nominati = figliElemento(trova(stili as NodoXml, 'office:styles') as NodoXml, 'style:style');
    const primo = nominati.find((s) => s.attributi['style:name'] === figliElemento(blocchi[0], 'calcext:condition')[0].attributi['calcext:apply-style-name']) as NodoXml;
    expect(trova(primo, 'style:table-cell-properties')?.attributi['fo:background-color']).toBe('#ffc7ce');
    expect(trova(primo, 'style:text-properties')?.attributi).toMatchObject({ 'fo:color': '#9c0006', 'fo:font-weight': 'bold' });
    expect(nominati.length).toBe(5);
  });

  it('per le regole semplici c\'è anche la forma base di OpenDocument: un style:map nello stile delle celle', async () => {
    const { contenuto, testo } = await parti(scambio([foglio('F', { celle: { B2: '3' }, stili: { B2: { bold: true } }, condizionali: [REGOLE[0], { ...REGOLE[0], id: 'z', range: area(2, 3, 2, 2) }] })]));
    expect(testo).toContain('xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"');
    const t = tabelle(contenuto)[0];
    const righe = figliElemento(t, 'table:table-row');
    const stileDi = (nome: string | undefined) => stiliAuto(contenuto).find((s) => s.attributi['style:name'] === nome) as NodoXml;
    // B2 ha uno stile suo (grassetto) e la mappa; B3 solo la mappa; A1 la mappa della prima regola
    const b2 = figliElemento(righe[1], 'table:table-cell')[1];
    const mappeB2 = figliElemento(stileDi(b2.attributi['table:style-name']), 'style:map');
    expect(mappeB2.map((m) => [m.attributi['style:condition'], m.attributi['style:base-cell-address']])).toEqual([['cell-content()>5', "'F'.B2"]]);
    expect(trova(stileDi(b2.attributi['table:style-name']), 'style:text-properties')?.attributi['fo:font-weight']).toBe('bold');
    const a1 = figliElemento(righe[0], 'table:table-cell')[0];
    expect(figliElemento(stileDi(a1.attributi['table:style-name']), 'style:map')[0].attributi['style:condition']).toBe('cell-content()>5');
    const testi = await parti(scambio([foglio('F', { condizionali: [REGOLE[4], REGOLE[10], REGOLE[1]] })]));
    const mappe = stiliAuto(testi.contenuto).flatMap((s) => figliElemento(s, 'style:map').map((m) => m.attributi['style:condition']));
    expect(new Set(mappe)).toEqual(new Set(['is-true-formula(NOT(ISERROR(SEARCH("a""b";[.C1]))))', 'is-true-formula(MOD([.D1];2)=0)', 'cell-content-is-between(2,4)']));
  });

  it('vanno e tornano tutte, con stili, soglie e intervalli', async () => {
    const s = scambio([foglio('Foglio 1', { celle: { A1: '1' }, condizionali: REGOLE }), foglio('Altro', { condizionali: [REGOLE[0]] })]);
    const r = await leggiOds(await scriviOds(s));
    expect(senzaId(r.scambio.fogli[0].condizionali)).toEqual(senzaId(REGOLE));
    expect(senzaId(r.scambio.fogli[1].condizionali)).toEqual(senzaId([REGOLE[0]]));
    expect(r.avvisi).toEqual([]);
  });

  it('le regole sulle date non si scrivono e chi salva lo sa', async () => {
    const data: ConditionalFormatRule = { id: 'q', type: 'date', range: area(1, 1, 1, 1), operator: 'today', style: { bold: true } };
    const s = scambio([foglio('F', { condizionali: [data, REGOLE[0]] })]);
    expect(avvisiScritturaOds(s).join(' ')).toContain('le regole sulle date della formattazione condizionale non si salvano in OpenDocument');
    expect(senzaId((await leggiOds(await scriviOds(s))).scambio.fogli[0].condizionali)).toEqual(senzaId([REGOLE[0]]));
    expect(avvisiScritturaOds(scambio([foglio('F', { condizionali: REGOLE })]))).toEqual([]);
  });

  it('si leggono i file di LibreOffice: stili per nome visibile, intervalli con i nomi tra apici, condizioni sconosciute contate', async () => {
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
      + 'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"';
    const stiliXml = `<office:document-styles ${NS}><office:styles><style:style style:name="Default" style:family="table-cell"><style:text-properties fo:color="#000000"/></style:style>`
      + '<style:style style:name="ConditionalStyle_5f_1" style:display-name="ConditionalStyle_1" style:family="table-cell" style:parent-style-name="Default"><style:table-cell-properties fo:background-color="#ffc7ce"/><style:text-properties fo:color="#9c0006" fo:font-weight="bold"/></style:style>'
      + '</office:styles></office:document-styles>';
    const condizioni = '<calcext:conditional-formats>'
      + '<calcext:conditional-format calcext:target-range-address="&apos;Foglio 1&apos;.A1:&apos;Foglio 1&apos;.A10 &apos;Foglio 1&apos;.C3">'
      + '<calcext:condition calcext:apply-style-name="ConditionalStyle_1" calcext:value="&gt;5" calcext:base-cell-address="&apos;Foglio 1&apos;.A1"/>'
      + '<calcext:condition calcext:apply-style-name="ConditionalStyle_1" calcext:value="duplicate" calcext:base-cell-address="&apos;Foglio 1&apos;.A1"/>'
      + '</calcext:conditional-format>'
      + '<calcext:conditional-format calcext:target-range-address="&apos;Foglio 1&apos;.G1:&apos;Foglio 1&apos;.G10"><calcext:data-bar calcext:min-length="10" calcext:max-length="90" calcext:positive-color="#638EC6">'
      + '<calcext:formatting-entry calcext:value="0" calcext:type="auto-minimum"/><calcext:formatting-entry calcext:value="0" calcext:type="auto-maximum"/></calcext:data-bar></calcext:conditional-format>'
      + '<calcext:conditional-format calcext:target-range-address="&apos;Foglio 1&apos;.H1:&apos;Foglio 1&apos;.H5"><calcext:icon-set calcext:icon-set-type="5Quarters"/></calcext:conditional-format>'
      + '</calcext:conditional-formats>';
    const content = `<office:document-content ${NS}><office:body><office:spreadsheet><table:table table:name="Foglio 1"><table:table-row><table:table-cell/></table:table-row>${condizioni}</table:table></office:spreadsheet></office:body></office:document-content>`;
    const byte = await scriviZip([{ nome: 'mimetype', dati: cod.encode(TIPO_ODS) }, { nome: 'content.xml', dati: cod.encode(content) }, { nome: 'styles.xml', dati: cod.encode(stiliXml) }]);
    const r = await leggiOds(byte);
    const stile = { backgroundColor: '#ffc7ce', textColor: '#9c0006', bold: true };
    expect(senzaId(r.scambio.fogli[0].condizionali)).toEqual([
      { type: 'cell_value', operator: 'greater_than', value1: 5, range: area(1, 10, 1, 1), style: stile },
      { type: 'cell_value', operator: 'greater_than', value1: 5, range: area(3, 3, 3, 3), style: stile },
      { type: 'data_bar', range: area(1, 10, 7, 7), dataBar: { color: '#638ec6' } },
    ]);
    expect(r.avvisi).toEqual(['2 formattazioni condizionali del file non sono state importate (il loro tipo non è tra quelli supportati).']);
  });

  it('condizioni e indirizzi: le forme di LibreOffice', () => {
    const f = (e: string) => `=${e}`;
    expect(condizioneDaOds('not-between(1,2.5)', f)).toEqual({ type: 'cell_value', operator: 'not_between', value1: 1, value2: 2.5 });
    expect(condizioneDaOds('=7', f)).toEqual({ type: 'cell_value', operator: 'equal_to', value1: 7 });
    expect(condizioneDaOds('>="a"', f)).toBeNull();
    expect(condizioneDaOds('formula-is(LEN(TRIM([.$B$2]))>0)', f)).toEqual({ type: 'text', operator: 'not_empty' });
    expect(condizioneDaOds('formula-is(A1>0)', f)).toEqual({ type: 'formula', value1: '=A1>0' });
    expect(condizioneDaOds('top-elements(10)', f)).toBeNull();
    // LibreOffice, risalvando un nostro file, scrive le virgolette interne senza raddoppiarle (provato con LibreOffice 7)
    expect(condizioneDaOds('contains-text("a""b")', f)).toEqual({ type: 'text', operator: 'contains', value1: 'a"b' });
    expect(condizioneDaOds('contains-text("a"b")', f)).toEqual({ type: 'text', operator: 'contains', value1: 'a"b' });
    expect(areeDaOds("$'It''s'.$A$1:.$B$2 Foglio2.C3")).toEqual([area(1, 2, 1, 2), area(3, 3, 3, 3)]);
  });

  it('il file con soltanto la forma base (style:map, senza quella di LibreOffice) avvisa che le regole non sono state importate', async () => {
    const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
    const content = `<office:document-content ${NS}><office:automatic-styles><style:style style:name="ce1" style:family="table-cell"><style:map style:condition="cell-content()&gt;5" style:apply-style-name="X" style:base-cell-address="F.A1"/></style:style></office:automatic-styles>`
      + '<office:body><office:spreadsheet><table:table table:name="F"><table:table-row><table:table-cell table:style-name="ce1"/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>';
    const byte = await scriviZip([{ nome: 'mimetype', dati: cod.encode(TIPO_ODS) }, { nome: 'content.xml', dati: cod.encode(content) }]);
    expect((await leggiOds(byte)).avvisi).toEqual(['Le formattazioni condizionali del file non sono state importate.']);
  });
});
