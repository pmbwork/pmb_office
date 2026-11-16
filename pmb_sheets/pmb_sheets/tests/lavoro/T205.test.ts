import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import * as fileIo from '../../src/formati/file-io';
import '../../src/main';
import { scriviZip, leggiZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, testoXml, trova, type NodoXml } from '@comune/formati/xml';
import {
  TIPO_ODS, avvisiScritturaOds, formatoOds, formulaPerOds, nomiFoglioOds, scriviOds,
} from '../../src/formati/ods-scrivi';
import { formulaDaOds, leggiOds } from '../../src/formati/ods-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import {
  ESTENSIONI_APRI, FORMATI, avvisiEsportazione, esporta, formatoDaNome, importa, nomeFile,
} from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, scambioDaDocumento, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { menuRegistry } from '../../src/registry/menu';

const codifica = new TextEncoder();
const dec = new TextDecoder();
const salva = fileIo.salvaSuDisco as unknown as ReturnType<typeof vi.fn>;
const scegli = fileIo.scegliFile as unknown as ReturnType<typeof vi.fn>;

function foglio(nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio { return { ...foglioVuoto(nome), ...extra }; }
function scambio(fogli: FoglioScambio[], attivo?: string): Scambio { return { fogli, foglioAttivo: attivo ?? fogli[0]?.nome ?? '' }; }
const nodi = (n: NodoXml): NodoXml[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string');
const nomiFigli = (n: NodoXml): string[] => nodi(n).map((f) => f.nome);

// ---- strumenti per leggere quello che scrive il nostro scrittore ----
async function scrivi(s: Scambio) {
  const byte = await scriviOds(s);
  const voci = await leggiZip(byte);
  const xml = (nome: string): NodoXml => analizzaXml(dec.decode(voci.get(nome)));
  return { byte, voci, xml, contenuto: xml('content.xml') };
}
const tabella = (c: NodoXml, i = 0): NodoXml => figliElemento(trova(c, 'office:body/office:spreadsheet') as NodoXml, 'table:table')[i];
const righe = (t: NodoXml): NodoXml[] => figliElemento(t, 'table:table-row');
const celle = (r: NodoXml): NodoXml[] => nodi(r).filter((n) => n.nome === 'table:table-cell' || n.nome === 'table:covered-table-cell');
const stiliAuto = (c: NodoXml): NodoXml[] => figliElemento(trova(c, 'office:automatic-styles') as NodoXml, 'style:style');
const stileDi = (c: NodoXml, nome: string | undefined): NodoXml => stiliAuto(c).find((s) => s.attributi['style:name'] === nome) as NodoXml;
async function unaCella(testo: string, stile?: Record<string, unknown>, extra: Partial<FoglioScambio> = {}) {
  const w = await scrivi(scambio([foglio('F', { celle: { A1: testo }, ...(stile ? { stili: { A1: stile } } : {}), ...extra })]));
  const cella = celle(righe(tabella(w.contenuto))[0])[0];
  return { ...w, cella, stile: stileDi(w.contenuto, cella.attributi['table:style-name']) };
}
const lettura = async (s: Scambio) => (await leggiOds(await scriviOds(s))).scambio;

// ---- strumenti per costruire file come li fa LibreOffice ----
const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
  + 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" '
  + 'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';

interface OpzioniOds {
  tabelle?: string[];
  nomi?: string[];
  stili?: string;
  stiliNominati?: string;
  settings?: string;
  corpo?: string;
  extra?: Record<string, string>;
  senza?: string[];
  mimetype?: string;
}
async function pacchetto(parti: Record<string, string>): Promise<Uint8Array> {
  return scriviZip(Object.entries(parti).map(([nome, testo]) => ({ nome, dati: codifica.encode(testo) })));
}
async function ods(o: OpzioniOds = {}): Promise<Uint8Array> {
  const tabelle = o.tabelle ?? [''];
  const parti: Record<string, string> = {
    mimetype: o.mimetype ?? TIPO_ODS,
    'content.xml': `<office:document-content ${NS} office:version="1.3">${o.stili ? `<office:automatic-styles>${o.stili}</office:automatic-styles>` : ''}`
      + `<office:body><office:spreadsheet>${o.corpo ?? ''}${tabelle.map((t, i) => `<table:table table:name="${o.nomi?.[i] ?? `Foglio${i + 1}`}">${t}</table:table>`).join('')}</office:spreadsheet></office:body></office:document-content>`,
  };
  if (o.stiliNominati) parti['styles.xml'] = `<office:document-styles ${NS} office:version="1.3"><office:styles>${o.stiliNominati}</office:styles></office:document-styles>`;
  if (o.settings) parti['settings.xml'] = o.settings;
  const tutte: Record<string, string> = { ...parti, ...o.extra };
  for (const n of o.senza ?? []) delete tutte[n];
  return pacchetto(tutte);
}
async function primo(o: OpzioniOds): Promise<FoglioScambio> { return (await leggiOds(await ods(o))).scambio.fogli[0]; }
const riga = (cellaXml: string, attr = ''): string => `<table:table-row${attr ? ` ${attr}` : ''}>${cellaXml}</table:table-row>`;
const num = (v: string | number, attr = ''): string => `<table:table-cell office:value-type="float" office:value="${v}"${attr ? ` ${attr}` : ''}><text:p>${v}</text:p></table:table-cell>`;
const testoCella = (t: string, attr = ''): string => `<table:table-cell office:value-type="string"${attr ? ` ${attr}` : ''}><text:p>${t}</text:p></table:table-cell>`;
const stileCella = (nome: string, figli: string, extra = ''): string => `<style:style style:name="${nome}" style:family="table-cell"${extra ? ` ${extra}` : ''}>${figli}</style:style>`;
const impostazioni = (tabelle: Array<{ nome: string; h: number; v: number; hp: number; vp: number }>, attivo: string): string => {
  const voce = (n: string, t: string, v: string | number) => `<config:config-item config:name="${n}" config:type="${t}">${v}</config:config-item>`;
  return `<office:document-settings ${NS} office:version="1.3"><office:settings><config:config-item-set config:name="ooo:view-settings"><config:config-item-map-indexed config:name="Views"><config:config-item-map-entry>`
    + `${voce('ViewId', 'string', 'view1')}<config:config-item-map-named config:name="Tables">${tabelle.map((t) => `<config:config-item-map-entry config:name="${t.nome}">${voce('HorizontalSplitMode', 'short', t.h)}${voce('VerticalSplitMode', 'short', t.v)}${voce('HorizontalSplitPosition', 'int', t.hp)}${voce('VerticalSplitPosition', 'int', t.vp)}</config:config-item-map-entry>`).join('')}</config:config-item-map-named>`
    + `${voce('ActiveTable', 'string', attivo)}</config:config-item-map-entry></config:config-item-map-indexed></config:config-item-set></office:settings></office:document-settings>`;
};

describe('T205 scrittura di file .ods', () => {
  it('il file ha le sue parti nell\'ordine giusto, con il tipo non compresso per primo, e sono XML ben formato', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: 'x' } })]));
    expect([...w.voci.keys()]).toEqual(['mimetype', 'META-INF/manifest.xml', 'content.xml', 'settings.xml']);
    const v = new DataView(w.byte.buffer, w.byte.byteOffset, w.byte.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint16(8, true)).toBe(0);
    expect(v.getUint16(26, true)).toBe(8);
    expect(dec.decode(w.byte.subarray(30, 38))).toBe('mimetype');
    expect(dec.decode(w.byte.subarray(38, 38 + TIPO_ODS.length))).toBe(TIPO_ODS);
    expect(TIPO_ODS).toBe('application/vnd.oasis.opendocument.spreadsheet');
    for (const n of ['META-INF/manifest.xml', 'content.xml', 'settings.xml']) expect(() => w.xml(n), n).not.toThrow();
    const voci = figliElemento(w.xml('META-INF/manifest.xml'), 'manifest:file-entry').map((e) => [e.attributi['manifest:full-path'], e.attributi['manifest:media-type']]);
    expect(voci).toEqual([['/', TIPO_ODS], ['content.xml', 'text/xml'], ['settings.xml', 'text/xml']]);
    expect(w.contenuto.nome).toBe('office:document-content');
    expect(w.contenuto.attributi['office:version']).toBe('1.3');
  });

  it('scriviZip: una voce può essere salvata senza compressione, anche se comprimibile', async () => {
    const dati = codifica.encode('abcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabc'.repeat(4));
    const byte = await scriviZip([{ nome: 'a.txt', dati }, { nome: 'b.txt', dati, senzaCompressione: true }]);
    const v = new DataView(byte.buffer, byte.byteOffset, byte.byteLength);
    expect(v.getUint16(8, true)).toBe(8);
    const secondo = 30 + 5 + v.getUint32(18, true);
    expect(v.getUint32(secondo, true)).toBe(0x04034b50);
    expect(v.getUint16(secondo + 8, true)).toBe(0);
    expect(v.getUint32(secondo + 18, true)).toBe(dati.length);
    const voci = await leggiZip(byte);
    expect(Array.from(voci.get('b.txt') as Uint8Array)).toEqual(Array.from(dati));
    expect(Array.from(voci.get('a.txt') as Uint8Array)).toEqual(Array.from(dati));
  });

  it('lo stesso contenuto dà gli stessi byte', async () => {
    const s = scambio([foglio('F', { celle: { A1: 'ciao', B1: '=A1', C1: '3' }, stili: { A1: { bold: true, numFmt: '0.00' } }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }] })]);
    expect(Array.from(await scriviOds(s))).toEqual(Array.from(await scriviOds(s)));
  });

  it('senza fogli scrive un foglio vuoto chiamato Foglio1', async () => {
    const w = await scrivi({ fogli: [], foglioAttivo: '' });
    const t = tabella(w.contenuto);
    expect(t.attributi['table:name']).toBe('Foglio1');
    expect(nomiFigli(t)).toEqual(['table:table-column', 'table:table-row']);
    expect(nomiFigli(righe(t)[0])).toEqual(['table:table-cell']);
  });

  it('valori: numeri, booleani, testi, formule e formato Testo', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: '12', B1: '007', C1: '+7', D1: 'true', E1: 'ciao', F1: '=SUM(A1:B1)', G1: '12' }, stili: { G1: { numFmt: '@' } } })]));
    const c = celle(righe(tabella(w.contenuto))[0]);
    const a = (i: number, n: string): string | undefined => c[i].attributi[n];
    expect([a(0, 'office:value-type'), a(0, 'office:value'), testoXml(c[0])]).toEqual(['float', '12', '12']);
    expect([a(1, 'office:value'), a(2, 'office:value')]).toEqual(['7', '7']);
    expect([a(3, 'office:value-type'), a(3, 'office:boolean-value'), testoXml(c[3])]).toEqual(['boolean', 'true', 'TRUE']);
    expect([a(4, 'office:value-type'), testoXml(c[4])]).toEqual(['string', 'ciao']);
    expect(a(4, 'office:value')).toBeUndefined();
    expect(a(5, 'table:formula')).toBe('of:=SUM([.A1:.B1])');
    expect(a(5, 'office:value-type')).toBeUndefined();
    expect([a(6, 'office:value-type'), testoXml(c[6])]).toEqual(['string', '12']);
    const falso = await unaCella('FALSE');
    expect([falso.cella.attributi['office:boolean-value'], testoXml(falso.cella)]).toEqual(['false', 'FALSE']);
  });

  it('testi con a capo, tabulazioni e spazi multipli', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: 'uno\ndue\r\ntre', B1: 'a\tb', C1: '  x  y ', D1: 'a<b & "c"' } })]));
    const c = celle(righe(tabella(w.contenuto))[0]);
    expect(figliElemento(c[0], 'text:p').map((p) => testoXml(p))).toEqual(['uno', 'due', 'tre']);
    const p1 = figliElemento(c[1], 'text:p')[0];
    expect(p1.figli.map((f) => (typeof f === 'string' ? f : f.nome))).toEqual(['a', 'text:tab', 'b']);
    const p2 = figliElemento(c[2], 'text:p')[0];
    expect(p2.figli.map((f) => (typeof f === 'string' ? f : `${f.nome}${f.attributi['text:c']}`))).toEqual(['text:s2', 'x', 'text:s2', 'y', 'text:s1']);
    expect(testoXml(figliElemento(c[3], 'text:p')[0])).toBe('a<b & "c"');
  });

  it('formulaPerOds: riferimenti, separatori, fogli, intervalli di colonne e righe, funzioni recenti, logici, matrici', () => {
    const casi: Array<[string, string]> = [
      ['=SUM(A1:B2)', 'of:=SUM([.A1:.B2])'],
      ['=A1+$B$2*c$3', 'of:=[.A1]+[.$B$2]*[.c$3]'],
      ['=IF(A1>2,"a,b;c",B1)', 'of:=IF([.A1]>2;"a,b;c";[.B1])'],
      ['=Foglio2!A1+\'Il foglio\'!B2:C3', 'of:=[$Foglio2.A1]+[$\'Il foglio\'.B2:.C3]'],
      ['=SUM(A:A)+SUM(2:3)+SUM($B:$C)', 'of:=SUM([.A:.A])+SUM([.2:.3])+SUM([.$B:.$C])'],
      ['=LOG10(A1)+ATAN2(1,2)+DEC2BIN(5)', 'of:=LOG10([.A1])+ATAN2(1;2)+DEC2BIN(5)'],
      ['=MAXIFS(A1:A3,B1:B3,">1")+ifs(1,2)+TEXTJOIN(",",1,A1:A2)', 'of:=COM.MICROSOFT.MAXIFS([.A1:.A3];[.B1:.B3];">1")+COM.MICROSOFT.IFS(1;2)+COM.MICROSOFT.TEXTJOIN(",";1;[.A1:.A2])'],
      ['=SWITCH(A1,1,"x")+CONCAT(A1,B1)+XLOOKUP(1,A1:A2,B1:B2)+XMATCH(1,A1:A2)', 'of:=COM.MICROSOFT.SWITCH([.A1];1;"x")+COM.MICROSOFT.CONCAT([.A1];[.B1])+COM.MICROSOFT.XLOOKUP(1;[.A1:.A2];[.B1:.B2])+COM.MICROSOFT.XMATCH(1;[.A1:.A2])'],
      ['=SUMIFS(A1:A2,B1:B2,1)+IFERROR(1,2)', 'of:=SUMIFS([.A1:.A2];[.B1:.B2];1)+IFERROR(1;2)'],
      ['=IF(TRUE,false,1)', 'of:=IF(TRUE();FALSE();1)'],
      ['={1,2;3,4}', 'of:={1;2|3;4}'],
      ['="A1"&A1&"x!"', 'of:="A1"&[.A1]&"x!"'],
      ['=tasse*2+A1%', 'of:=tasse*2+[.A1]%'],
      ['SUM(A1)', 'of:=SUM([.A1])'],
      ['=A1<>B1', 'of:=[.A1]<>[.B1]'],
      ['="a""b,c"', 'of:="a""b,c"'],
    ];
    for (const [da, a] of casi) expect(formulaPerOds(da), da).toBe(a);
  });

  it('carattere: grassetto, corsivo, sottolineato, barrato, nome, dimensione e colore', async () => {
    const r = await unaCella('x', { bold: true, italic: true, underline: true, strike: true, fontFamily: 'Roboto', fontSize: 14, color: '#FF0000' });
    expect(r.cella.attributi['table:style-name']).toBe('ce1');
    expect(r.stile.attributi['style:family']).toBe('table-cell');
    expect(nomiFigli(r.stile)).toEqual(['style:text-properties']);
    expect(trova(r.stile, 'style:text-properties')?.attributi).toEqual({
      'fo:font-weight': 'bold', 'fo:font-style': 'italic', 'style:text-underline-style': 'solid', 'style:text-underline-width': 'auto', 'style:text-underline-color': 'font-color',
      'style:text-line-through-style': 'solid', 'fo:font-family': 'Roboto', 'fo:font-size': '14pt', 'fo:color': '#ff0000',
    });
    const brutto = await unaCella('x', { bold: true, fontSize: -3, color: 'rosso', fontFamily: '  ' });
    expect(trova(brutto.stile, 'style:text-properties')?.attributi).toEqual({ 'fo:font-weight': 'bold' });
  });

  it('riempimento, bordi, allineamenti e a capo', async () => {
    const r = await unaCella('x', {
      fill: '#00FF00', vAlign: 'middle', wrap: true, hAlign: 'center',
      borders: { top: { style: 'thin', color: '#FF0000' }, left: { style: 'dashed', color: 'blu' }, bottom: { style: 'medium', color: '#0000ff' }, right: { style: 'none', color: '#000000' } },
    });
    expect(trova(r.stile, 'style:table-cell-properties')?.attributi).toEqual({
      'fo:background-color': '#00ff00', 'fo:border-top': '0.74pt solid #ff0000', 'fo:border-bottom': '1.76pt solid #0000ff', 'fo:border-left': '0.74pt dashed #000000',
      'style:vertical-align': 'middle', 'fo:wrap-option': 'wrap',
    });
    expect(trova(r.stile, 'style:paragraph-properties')?.attributi).toEqual({ 'fo:text-align': 'center' });
    for (const [da, a] of [['left', 'start'], ['right', 'end'], ['center', 'center']]) {
      expect(trova((await unaCella('x', { hAlign: da })).stile, 'style:paragraph-properties')?.attributi['fo:text-align'], da).toBe(a);
    }
    expect(trova((await unaCella('x', { vAlign: 'top' })).stile, 'style:table-cell-properties')?.attributi['style:vertical-align']).toBe('top');
    expect(trova((await unaCella('x', { vAlign: 'bottom' })).stile, 'style:table-cell-properties')?.attributi['style:vertical-align']).toBe('bottom');
    expect(trova((await unaCella('x', { fill: 'none', bold: true })).stile, 'style:table-cell-properties')).toBeUndefined();
    expect(trova((await unaCella('x', { fill: '#abc', bold: true })).stile, 'style:table-cell-properties')).toBeUndefined();
  });

  it('formati dei numeri: gli stili dei dati di OpenDocument', () => {
    const xml = (c: string): string | undefined => formatoOds(c)?.xml('N1');
    const n = (d: number, m: number, g = ''): string => `<number:number number:decimal-places="${d}" number:min-integer-digits="${m}"${g}/>`;
    expect(xml('0.00')).toBe(`<number:number-style style:name="N1">${n(2, 1)}</number:number-style>`);
    expect(xml('0')).toBe(`<number:number-style style:name="N1">${n(0, 1)}</number:number-style>`);
    expect(xml('00.0')).toBe(`<number:number-style style:name="N1">${n(1, 2)}</number:number-style>`);
    expect(xml('#,##0')).toBe(`<number:number-style style:name="N1">${n(0, 1, ' number:grouping="true"')}</number:number-style>`);
    expect(xml('#,##0.00')).toBe(`<number:number-style style:name="N1">${n(2, 1, ' number:grouping="true"')}</number:number-style>`);
    const simbolo = '<number:currency-symbol number:language="it" number:country="IT">€</number:currency-symbol>';
    expect(xml('€#,##0.00')).toBe(`<number:currency-style style:name="N1">${simbolo}${n(2, 1, ' number:grouping="true"')}</number:currency-style>`);
    expect(xml('"€"0.00')).toBe(`<number:currency-style style:name="N1">${simbolo}${n(2, 1)}</number:currency-style>`);
    expect(xml('[$€-2] 0.00')).toBe(`<number:currency-style style:name="N1">${simbolo}<number:text> </number:text>${n(2, 1)}</number:currency-style>`);
    expect(xml('#,##0.00 €')).toBe(`<number:currency-style style:name="N1">${n(2, 1, ' number:grouping="true"')}<number:text> </number:text>${simbolo}</number:currency-style>`);
    expect(xml('0%')).toBe(`<number:percentage-style style:name="N1">${n(0, 1)}<number:text>%</number:text></number:percentage-style>`);
    expect(xml('0.00%')).toBe(`<number:percentage-style style:name="N1">${n(2, 1)}<number:text>%</number:text></number:percentage-style>`);
    expect(xml('0.00E+00')).toBe('<number:number-style style:name="N1"><number:scientific-number number:decimal-places="2" number:min-integer-digits="1" number:min-exponent-digits="2"/></number:number-style>');
    expect(xml('0.0E+000')).toBe('<number:number-style style:name="N1"><number:scientific-number number:decimal-places="1" number:min-integer-digits="1" number:min-exponent-digits="3"/></number:number-style>');
    expect(xml('hh mmm')).toBe(`<number:date-style style:name="N1"><number:hours number:style="long"/><number:text> </number:text><number:month number:textual="true"/></number:date-style>`);
    expect(xml('@')).toBe('<number:text-style style:name="N1"><number:text-content/></number:text-style>');
    const lungo = ' number:style="long"';
    expect(xml('dd/mm/yyyy')).toBe(`<number:date-style style:name="N1"><number:day${lungo}/><number:text>/</number:text><number:month${lungo}/><number:text>/</number:text><number:year${lungo}/></number:date-style>`);
    expect(xml('d/m/yy')).toBe('<number:date-style style:name="N1"><number:day/><number:text>/</number:text><number:month/><number:text>/</number:text><number:year/></number:date-style>');
    expect(xml('hh:mm:ss')).toBe(`<number:time-style style:name="N1"><number:hours${lungo}/><number:text>:</number:text><number:minutes${lungo}/><number:text>:</number:text><number:seconds${lungo}/></number:time-style>`);
    expect(xml('mm:ss')).toBe(`<number:time-style style:name="N1"><number:minutes${lungo}/><number:text>:</number:text><number:seconds${lungo}/></number:time-style>`);
    expect(xml('h:mm AM/PM')).toBe(`<number:time-style style:name="N1"><number:hours/><number:text>:</number:text><number:minutes${lungo}/><number:text> </number:text><number:am-pm/></number:time-style>`);
    expect(xml('dd/mm/yyyy hh:mm')).toBe(`<number:date-style style:name="N1"><number:day${lungo}/><number:text>/</number:text><number:month${lungo}/><number:text>/</number:text><number:year${lungo}/><number:text> </number:text><number:hours${lungo}/><number:text>:</number:text><number:minutes${lungo}/></number:date-style>`);
    expect(xml('mm/dd')).toBe(`<number:date-style style:name="N1"><number:month${lungo}/><number:text>/</number:text><number:day${lungo}/></number:date-style>`);
    expect(xml('mmm yyyy')).toBe(`<number:date-style style:name="N1"><number:month number:textual="true"/><number:text> </number:text><number:year${lungo}/></number:date-style>`);
    expect(xml('dddd d "di" mmmm')).toBe(`<number:date-style style:name="N1"><number:day-of-week${lungo}/><number:text> </number:text><number:day/><number:text> </number:text><number:text>di</number:text><number:text> </number:text><number:month number:textual="true"${lungo}/></number:date-style>`);
    for (const c of ['0.0" m"', '[Red]0', 'General', 'hh:mm:ss.0', '0 "kg"', '', '#,##0;(#,##0)', 'abc']) expect(formatoOds(c), JSON.stringify(c)).toBeNull();
    const tipi: Array<[string, string]> = [['0.00', 'numero'], ['€0', 'valuta'], ['0%', 'percentuale'], ['0.0E+00', 'scientifico'], ['@', 'testo'], ['dd/mm/yyyy', 'data'], ['hh:mm', 'ora'], ['dd/mm/yyyy hh:mm', 'datora']];
    for (const [c, t] of tipi) expect(formatoOds(c)?.tipo, c).toBe(t);
  });

  it('i formati si scrivono una volta sola e le celle li citano con il loro stile', async () => {
    const w = await scrivi(scambio([foglio('F', {
      celle: { A1: '1', B1: '2', C1: '3', D1: '4' },
      stili: { A1: { numFmt: '0.00' }, B1: { numFmt: '0.00' }, C1: { numFmt: '0.00', bold: true }, D1: { numFmt: '0%' } },
    })]));
    const dati = nodi(trova(w.contenuto, 'office:automatic-styles') as NodoXml).filter((n) => n.nome.startsWith('number:'));
    expect(dati.map((d) => [d.nome, d.attributi['style:name']])).toEqual([['number:number-style', 'N1'], ['number:percentage-style', 'N2']]);
    const c = celle(righe(tabella(w.contenuto))[0]);
    expect(c.map((x) => x.attributi['table:style-name'])).toEqual(['ce1', 'ce1', 'ce2', 'ce3']);
    expect(stiliAuto(w.contenuto).map((s) => [s.attributi['style:name'], s.attributi['style:data-style-name']])).toEqual([['ce1', 'N1'], ['ce2', 'N1'], ['ce3', 'N2']]);
    const vuota = await unaCella('x', {});
    expect(vuota.cella.attributi['table:style-name']).toBeUndefined();
  });

  it('numeri con formato di data, ora, percentuale, valuta e scientifico', async () => {
    const f = (testo: string, numFmt: string) => unaCella(testo, { numFmt }).then((r) => r.cella.attributi);
    expect(await f('45351', 'dd/mm/yyyy')).toMatchObject({ 'office:value-type': 'date', 'office:date-value': '2024-02-29' });
    expect(await f('45351.0', 'dd/mm/yyyy')).toMatchObject({ 'office:date-value': '2024-02-29' });
    expect(await f('45351.5', 'dd/mm/yyyy')).toMatchObject({ 'office:date-value': '2024-02-29T12:00:00' });
    expect(await f('45351', 'dd/mm/yyyy hh:mm:ss')).toMatchObject({ 'office:date-value': '2024-02-29T00:00:00' });
    expect(await f('0', 'dd/mm/yyyy')).toMatchObject({ 'office:date-value': '1899-12-30' });
    expect(await f('0.5', 'hh:mm:ss')).toMatchObject({ 'office:value-type': 'time', 'office:time-value': 'PT12H00M00S' });
    const ora = await unaCella('0.5', { numFmt: 'hh:mm:ss' });
    expect(testoXml(ora.cella)).toBe('12:00:00');
    expect(testoXml((await unaCella('1.75', { numFmt: 'hh:mm' })).cella)).toBe('42:00:00');
    expect(testoXml((await unaCella('0.0000115740740740741', { numFmt: 'hh:mm:ss' })).cella)).toBe('00:00:01');
    expect(testoXml((await unaCella('45351', { numFmt: 'dd/mm/yyyy' })).cella)).toBe('2024-02-29');
    expect(await f('1.75', 'hh:mm')).toMatchObject({ 'office:time-value': 'PT42H00M00S' });
    expect(await f('0.0000115740740740741', 'hh:mm:ss')).toMatchObject({ 'office:time-value': 'PT0H00M01S' });
    expect(await f('0.000115740740740741', 'hh:mm:ss')).toMatchObject({ 'office:time-value': 'PT0H00M10S' });
    expect(await f('0.000012', 'hh:mm:ss')).toMatchObject({ 'office:time-value': 'PT0H00M01.037S' });
    for (const [t, fmt] of [['-1', 'dd/mm/yyyy'], ['3000000', 'dd/mm/yyyy'], ['-0.5', 'hh:mm:ss'], ['2000000', 'hh:mm:ss']]) {
      const a = await f(t, fmt);
      expect([a['office:value-type'], a['office:value'], a['office:date-value'], a['office:time-value']], `${t} ${fmt}`).toEqual(['float', t, undefined, undefined]);
    }
    expect(await f('0.15', '0%')).toMatchObject({ 'office:value-type': 'percentage', 'office:value': '0.15' });
    expect(await f('12.5', '€#,##0.00')).toMatchObject({ 'office:value-type': 'currency', 'office:value': '12.5', 'office:currency': 'EUR' });
    expect(await f('12345.678', '0.00E+00')).toMatchObject({ 'office:value-type': 'float', 'office:value': '12345.678' });
    expect((await f('12', '[Red]0'))['office:value-type']).toBe('float');
    const testoData = await unaCella('ciao', { numFmt: 'dd/mm/yyyy' });
    expect(testoData.cella.attributi['office:value-type']).toBe('string');
    const formulaData = await unaCella('=A2', { numFmt: 'dd/mm/yyyy' });
    expect(formulaData.cella.attributi['table:formula']).toBe('of:=[.A2]');
  });

  it('colonne: larghezza in centimetri, gruppi di colonne uguali e stile predefinito di colonna', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: 'a', C1: 'c' }, larghezze: { 1: 120, 2: 120, 3: 75, 5: 75 }, stiliColonna: { 3: { bold: true } } })]));
    const colonne = figliElemento(tabella(w.contenuto), 'table:table-column');
    expect(colonne.map((c) => [c.attributi['table:style-name'], c.attributi['table:number-columns-repeated'], c.attributi['table:default-cell-style-name']])).toEqual([
      ['co1', '2', undefined], ['co2', undefined, 'ce1'], [undefined, undefined, undefined], ['co2', undefined, undefined],
    ]);
    const stiliColonna = stiliAuto(w.contenuto).filter((s) => s.attributi['style:family'] === 'table-column');
    expect(stiliColonna.map((s) => [s.attributi['style:name'], trova(s, 'style:table-column-properties')?.attributi])).toEqual([
      ['co1', { 'style:column-width': '3.175cm', 'style:use-optimal-column-width': 'false' }],
      ['co2', { 'style:column-width': '1.9844cm', 'style:use-optimal-column-width': 'false' }],
    ]);
  });

  it('righe: altezza, stile predefinito di riga, righe vuote ripetute e celle vuote ripetute', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: 'a', D1: 'd', A10: 'z' }, altezze: { 3: 40, 7: 40 }, stiliRiga: { 10: { italic: true } } })]));
    const r = righe(tabella(w.contenuto));
    expect(r.map((x) => [x.attributi['table:style-name'], x.attributi['table:number-rows-repeated'], x.attributi['table:default-cell-style-name']])).toEqual([
      [undefined, undefined, undefined], [undefined, undefined, undefined], ['ro1', undefined, undefined], [undefined, '3', undefined], ['ro1', undefined, undefined], [undefined, '2', undefined], [undefined, undefined, 'ce1'],
    ]);
    expect(stiliAuto(w.contenuto).filter((s) => s.attributi['style:family'] === 'table-row').length).toBe(1);
    expect(celle(r[0]).map((c) => [c.nome, c.attributi['table:number-columns-repeated']])).toEqual([['table:table-cell', undefined], ['table:table-cell', '2'], ['table:table-cell', undefined]]);
    expect(trova(stiliAuto(w.contenuto).find((s) => s.attributi['style:name'] === 'ro1') as NodoXml, 'style:table-row-properties')?.attributi).toEqual({ 'style:row-height': '1.0583cm', 'style:use-optimal-row-height': 'false' });
    expect(celle(r[2]).length).toBe(1);
  });

  it('le celle di una riga si scrivono in ordine di colonna, comunque siano state inserite', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { C1: 'c', A1: 'a', B1: 'b' } })]));
    expect(celle(righe(tabella(w.contenuto))[0]).map((c) => testoXml(c))).toEqual(['a', 'b', 'c']);
  });

  it('unione solo in verticale: niente estensione in orizzontale', async () => {
    const w = await scrivi(scambio([foglio('F', { celle: { A1: 'v' }, unioni: [{ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }] })]));
    const r = righe(tabella(w.contenuto));
    expect(celle(r[0]).map((c) => [c.nome, c.attributi['table:number-columns-spanned'], c.attributi['table:number-rows-spanned']])).toEqual([['table:table-cell', undefined, '2']]);
    expect(celle(r[1]).map((c) => c.nome)).toEqual(['table:covered-table-cell']);
  });

  it('celle unite: la prima cella ha le estensioni e le altre sono coperte; gli intervalli non validi si scartano', async () => {
    const w = await scrivi(scambio([foglio('F', {
      celle: { A1: 'm' },
      unioni: [
        { startRow: 1, endRow: 2, startCol: 1, endCol: 2 }, { startRow: 3, endRow: 3, startCol: 2, endCol: 4 }, { startRow: 1, endRow: 3, startCol: 1, endCol: 3 },
        { startRow: 5, endRow: 5, startCol: 5, endCol: 5 }, { startRow: 6, endRow: 5, startCol: 1, endCol: 1 }, { startRow: 0, endRow: 3, startCol: 1, endCol: 1 },
      ],
    })]));
    const r = righe(tabella(w.contenuto));
    expect(r.length).toBe(3);
    expect(celle(r[0]).map((c) => [c.nome, c.attributi['table:number-columns-spanned'], c.attributi['table:number-rows-spanned']])).toEqual([
      ['table:table-cell', '2', '2'], ['table:covered-table-cell', undefined, undefined],
    ]);
    expect(celle(r[1]).map((c) => c.nome)).toEqual(['table:covered-table-cell', 'table:covered-table-cell']);
    expect(celle(r[2]).map((c) => [c.nome, c.attributi['table:number-columns-spanned'], c.attributi['table:number-rows-spanned']])).toEqual([
      ['table:table-cell', undefined, undefined], ['table:table-cell', '3', undefined], ['table:covered-table-cell', undefined, undefined], ['table:covered-table-cell', undefined, undefined],
    ]);
    expect(testoXml(celle(r[0])[0])).toBe('m');
    expect(celle(r[2])[0].attributi['table:number-columns-repeated']).toBeUndefined();
  });

  it('impostazioni di vista: foglio attivo e righe e colonne bloccate', async () => {
    const w = await scrivi(scambio([foglio('Uno', { righeCongelate: 2, colonneCongelate: 1 }), foglio('Due', { righeCongelate: 1 }), foglio('Tre')], 'Due'));
    const x = w.xml('settings.xml');
    const mappa = trova(x, 'office:settings/config:config-item-set/config:config-item-map-indexed/config:config-item-map-entry') as NodoXml;
    const voci = (n: NodoXml): Record<string, string> => Object.fromEntries(figliElemento(n, 'config:config-item').map((v) => [v.attributi['config:name'], testoXml(v)]));
    expect(voci(mappa)).toEqual({ ViewId: 'view1', ActiveTable: 'Due' });
    const tabelle = figliElemento(trova(mappa, 'config:config-item-map-named') as NodoXml, 'config:config-item-map-entry');
    expect(tabelle.map((t) => t.attributi['config:name'])).toEqual(['Uno', 'Due', 'Tre']);
    const blocco = (i: number) => { const v = voci(tabelle[i]); return [v.HorizontalSplitMode, v.VerticalSplitMode, v.HorizontalSplitPosition, v.VerticalSplitPosition]; };
    expect(blocco(0)).toEqual(['2', '2', '1', '2']);
    expect(blocco(1)).toEqual(['0', '2', '0', '1']);
    expect(blocco(2)).toEqual(['0', '0', '0', '0']);
  });

  it('più fogli: i nomi, gli stili condivisi e il foglio attivo', async () => {
    const w = await scrivi(scambio([foglio('Uno', { celle: { A1: 'x' }, stili: { A1: { bold: true } } }), foglio('Due', { celle: { A1: 'y' }, stili: { A1: { bold: true } } })], 'Due'));
    expect(figliElemento(trova(w.contenuto, 'office:body/office:spreadsheet') as NodoXml, 'table:table').map((t) => t.attributi['table:name'])).toEqual(['Uno', 'Due']);
    expect(stiliAuto(w.contenuto).length).toBe(1);
    expect(celle(righe(tabella(w.contenuto, 1))[0])[0].attributi['table:style-name']).toBe('ce1');
  });

  it('nomiFoglioOds e avvisiScritturaOds', () => {
    expect(nomiFoglioOds(['a/b', ':?*[]\\', '\'x\'', '', '  ', 'x'.repeat(40)])).toEqual(['a_b', '______', 'x', 'Foglio4', 'Foglio5', 'x'.repeat(40)]);
    expect(nomiFoglioOds(['A', 'a', 'A'])).toEqual(['A', 'a (2)', 'A (3)']);
    expect(avvisiScritturaOds(scambio([foglio('Dati'), foglio('Altro')]))).toEqual([]);
    const s = scambio([foglio('a/b', { stili: { A1: { numFmt: '0.0" m"' }, B1: { numFmt: '0.0" m"' }, C1: { numFmt: '0.00' } }, stiliColonna: { 1: { numFmt: '[Red]0' } } }), foglio('Altro', { stiliRiga: { 1: { numFmt: 'General' } } })]);
    const avvisi = avvisiScritturaOds(s);
    expect(avvisi.length).toBe(4);
    expect(avvisi[0]).toContain('«a/b»');
    expect(avvisi[0]).toContain('«a_b»');
    expect(avvisi.slice(1).map((a) => a.match(/«(.*?)»/)?.[1])).toEqual(['0.0" m"', '[Red]0', 'General']);
    expect(avvisi[1]).toContain('formato Automatico');
  });

  it('i simboli XML nei nomi e nei testi sono protetti, i caratteri vietati si tolgono', async () => {
    const w = await scrivi(scambio([foglio('Bilancio & "2024" <a>', { celle: { A1: 'a\u0001b\u0008c' } })]));
    const t = tabella(w.contenuto);
    expect(t.attributi['table:name']).toBe('Bilancio & "2024" <a>');
    expect(testoXml(celle(righe(t)[0])[0])).toBe('abc');
  });
});

describe('T205 lettura di file .ods', () => {
  it('formulaDaOds: riferimenti, fogli, intervalli, funzioni, logici, matrici', () => {
    const casi: Array<[string, string]> = [
      ['of:=SUM([.A1:.B2])', '=SUM(A1:B2)'],
      ['of:=[.A1]+[.$B$2]*[.c$3]', '=A1+$B$2*c$3'],
      ['of:=IF([.A1]>2;"a;b,c";[.B1])', '=IF(A1>2,"a;b,c",B1)'],
      ['of:=[$Foglio2.A1]+[$\'Il foglio\'.B2:.C3]', '=Foglio2!A1+\'Il foglio\'!B2:C3'],
      ['of:=[Foglio2.A1]+[$\'L\'\'altro\'.B2]', '=Foglio2!A1+\'L\'\'altro\'!B2'],
      ['of:=[$Foglio_1.A1]+[$\'Foglio 1\'.B1]', '=Foglio_1!A1+\'Foglio 1\'!B1'],
      ['of:=SUM([.A:.A])+SUM([.2:.3])', '=SUM(A:A)+SUM(2:3)'],
      ['of:=[$A.A1:$B.B2]', '=A!A1:B2'],
      ['of:=COM.MICROSOFT.MAXIFS([.A1:.A3];[.B1:.B3];">1")+ORG.OPENOFFICE.EASTERSUNDAY(2024)+org.libreoffice.X(1)', '=MAXIFS(A1:A3,B1:B3,">1")+EASTERSUNDAY(2024)+X(1)'],
      ['of:=IF(TRUE();false();1)', '=IF(TRUE,FALSE,1)'],
      ['of:={1;2|3;4}', '={1,2;3,4}'],
      ['of:="[.A1]"&[.A1]&"x;y"', '="[.A1]"&A1&"x;y"'],
      ['of:=tasse*2', '=tasse*2'],
      ['=[.A1]+1', '=A1+1'],
      ['of:=[non un riferimento]+1', '=[non un riferimento]+1'],
      ['of:=MYTRUE()+TRUE_X(1)', '=MYTRUE()+TRUE_X(1)'],
    ];
    for (const [da, a] of casi) expect(formulaDaOds(da), da).toBe(a);
  });

  it('tipi di cella: numeri, percentuali, valute, booleani, testi, date e ore', async () => {
    const f = await primo({ tabelle: [riga(
      '<table:table-cell office:value-type="float" office:value="1.5"><text:p>1.5</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="percentage" office:value="0.25"/>'
      + '<table:table-cell office:value-type="currency" office:currency="EUR" office:value="9"/>'
      + '<table:table-cell office:value-type="boolean" office:boolean-value="true"/>'
      + '<table:table-cell office:value-type="boolean" office:boolean-value="false"/>'
      + '<table:table-cell office:value-type="string"><text:p>a<text:s text:c="2"/>b<text:tab/>c<text:line-break/>d<text:span>e</text:span><text:a>f</text:a></text:p><text:p>seconda</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="string" office:string-value="dal attributo"><text:p>ignorato</text:p></table:table-cell>'
      + '<table:table-cell office:value-type="date" office:date-value="2024-02-29"/>'
      + '<table:table-cell office:value-type="date" office:date-value="2024-02-29T12:30:00"/>'
      + '<table:table-cell office:value-type="time" office:time-value="PT12H30M00S"/>'
      + '<table:table-cell office:value-type="time" office:time-value="PT36H"/>'
      + '<table:table-cell office:value-type="time" office:time-value="P1DT2H"/>'
      + '<table:table-cell office:value-type="float" office:value="abc"/>'
      + '<table:table-cell office:value-type="void"/>'
      + '<table:table-cell office:value-type="date" office:date-value="non una data"/>'
      + '<table:table-cell office:value-type="time" office:time-value="-PT1H"/>'
      + '<table:table-cell office:value-type="string"><text:p>   x   </text:p></table:table-cell>'
      + '<table:table-cell office:value-type="time" office:time-value="PT00H00M01.5S"/>'
      + '<table:table-cell office:value-type="date" office:date-value="2024-02-29T00:00:30.5"/>'
      + '<table:table-cell office:value-type="string"><text:h>Titolo</text:h></table:table-cell>',
    )] });
    expect(f.celle).toEqual({
      A1: '1.5', B1: '0.25', C1: '9', D1: 'TRUE', E1: 'FALSE', F1: 'a  b\tc\ndef\nseconda', G1: 'dal attributo', H1: '45351', I1: '45351.5208333', J1: '0.520833333333', K1: '1.5', L1: '1.08333333333', Q1: ' x ', R1: '0.0000173611111111',
      S1: String(Number(((Date.UTC(2024, 1, 29, 0, 0, 0) + 30500 - Date.UTC(1899, 11, 30)) / 86400000).toPrecision(12))), T1: 'Titolo',
    });
  });

  it('formule: con o senza prefisso, con valore in cache ignorato, e valore di riserva se non si capiscono', async () => {
    const f = await primo({ tabelle: [riga(
      '<table:table-cell table:formula="of:=SUM([.B1:.B3])" office:value-type="float" office:value="6"/>'
      + '<table:table-cell table:formula="of:=COM.MICROSOFT.IFS([.A1]&gt;1;&quot;a&quot;;[.A1]&lt;1;&quot;b&quot;)" office:value-type="string" office:string-value="b"/>'
      + '<table:table-cell table:formula="=[.A1]+1"/>'
      + '<table:table-cell table:formula="oooc:=[.A1]+1" office:value-type="float" office:value="7"/>'
      + '<table:table-cell table:formula="of:=[$Foglio2.A1]*2"/>',
    )] });
    expect(f.celle).toEqual({ A1: '=SUM(B1:B3)', B1: '=IFS(A1>1,"a",A1<1,"b")', C1: '=A1+1', D1: '7', E1: '=Foglio2!A1*2' });
  });

  it('formule condivise non esistono in OpenDocument: ogni cella ha la sua formula', async () => {
    const f = await primo({ tabelle: [riga('<table:table-cell table:formula="of:=[.A1]*2"/><table:table-cell table:formula="of:=[.B1]*2"/>')] });
    expect(f.celle).toEqual({ A1: '=A1*2', B1: '=B1*2' });
  });

  it('i testi che sembrano numeri o booleani restano testi grazie al formato Testo, le formule no', async () => {
    const f = await primo({ tabelle: [riga(`${testoCella('123')}${testoCella('true')}${testoCella('ciao')}${testoCella('=A1')}<table:table-cell office:value-type="string" table:formula="of:=[.A1]"><text:p>9</text:p></table:table-cell>`)] });
    expect(f.celle).toEqual({ A1: '123', B1: 'true', C1: 'ciao', D1: '=A1', E1: '=A1' });
    expect(f.stili).toEqual({ A1: { numFmt: '@' }, B1: { numFmt: '@' } });
  });

  it('stili: carattere, riempimento, bordi, allineamenti, ereditarietà dagli stili con nome e carattere di base', async () => {
    const f = await primo({
      stiliNominati: stileCella('Default', '<style:text-properties fo:font-family="Liberation Sans" fo:font-size="10pt" fo:color="#000000"/>')
        + stileCella('Enfasi', '<style:text-properties fo:font-weight="bold" fo:color="#112233"/>', 'style:parent-style-name="Default"'),
      stili: '<number:number-style style:name="N2"><number:number number:decimal-places="2" number:min-integer-digits="1" number:grouping="true"/></number:number-style>'
        + stileCella('ce1', '<style:text-properties fo:font-style="italic" fo:font-family="Liberation Sans" fo:font-size="14pt"/>', 'style:parent-style-name="Enfasi" style:data-style-name="N2"')
        + stileCella('ce2', '<style:table-cell-properties fo:background-color="#ABCDEF" fo:border="0.74pt solid #000000" fo:border-bottom="none" fo:border-left="1.76pt solid #ff0000" style:vertical-align="top" fo:wrap-option="wrap"/>'
          + '<style:paragraph-properties fo:text-align="end"/><style:text-properties style:text-underline-style="solid" style:text-line-through-style="solid" fo:font-weight="700"/>')
        + stileCella('ce3', '<style:table-cell-properties fo:border-top="0.5pt dashed #00ff00" fo:border-right="0.5pt dotted" fo:border-bottom="3pt double #000000"/>')
        + stileCella('ce4', '<style:table-cell-properties fo:background-color="transparent" style:vertical-align="middle"/><style:paragraph-properties fo:text-align="center"/>'
          + '<style:text-properties fo:font-style="oblique" style:text-underline-style="none" style:text-line-through-style="none" fo:font-weight="normal" fo:color="#zzzzzz"/>')
        + stileCella('ce5', '<style:paragraph-properties fo:text-align="start"/><style:text-properties fo:color="#000000"/>') + stileCella('ce6', '<style:paragraph-properties fo:text-align="justify"/>')
        + stileCella('ce7', '<style:table-cell-properties style:vertical-align="automatic"/>', 'style:parent-style-name="Default"')
        + stileCella('ce8', `<style:table-cell-properties fo:border-left="hidden" fo:border-top="solid #ff0000" fo:border-right="1.4pt solid #00ff00" fo:border-bottom="1.5pt solid #0000ff"/><style:text-properties fo:font-family="'Liberation Mono'" fo:font-size="10.5pt"/>`)
        + stileCella('ce9', '<style:text-properties style:font-name="Arial"/>')
        + stileCella('ce10', '<style:table-cell-properties style:vertical-align="bottom"/><style:paragraph-properties fo:text-align="left"/>')
        + stileCella('ce11', '<style:paragraph-properties fo:text-align="right"/>'),
      tabelle: [riga(['Default', 'ce1', 'ce2', 'ce3', 'ce4', 'ce5', 'ce6', 'ce7', 'inesistente', 'ce8', 'ce9', 'ce10', 'ce11'].map((s) => num(1, `table:style-name="${s}"`)).join(''))],
    });
    expect(f.stili).toEqual({
      B1: { bold: true, color: '#112233', italic: true, fontSize: 14, numFmt: '#,##0.00' },
      C1: {
        fill: '#abcdef', vAlign: 'top', wrap: true, hAlign: 'right', underline: true, strike: true, bold: true,
        borders: { top: { style: 'thin', color: '#000000' }, right: { style: 'thin', color: '#000000' }, left: { style: 'medium', color: '#ff0000' } },
      },
      D1: { borders: { top: { style: 'dashed', color: '#00ff00' }, right: { style: 'dashed', color: '#000000' }, bottom: { style: 'thin', color: '#000000' } } },
      E1: { vAlign: 'middle', hAlign: 'center', italic: true },
      F1: { hAlign: 'left' },
      J1: { borders: { top: { style: 'thin', color: '#ff0000' }, right: { style: 'thin', color: '#00ff00' }, bottom: { style: 'medium', color: '#0000ff' } }, fontFamily: 'Liberation Mono', fontSize: 10.5 },
      K1: { fontFamily: 'Arial' }, L1: { hAlign: 'left', vAlign: 'bottom' }, M1: { hAlign: 'right' },
    });
  });

  it('formati dei numeri: dagli stili dei dati ai codici di Fogli', async () => {
    const ds = (tag: string, nome: string, figli: string) => `<number:${tag} style:name="${nome}">${figli}</number:${tag}>`;
    const n = (d: number, m: number, g = '') => `<number:number number:decimal-places="${d}" number:min-integer-digits="${m}"${g ? ' number:grouping="true"' : ''}/>`;
    const lungo = ' number:style="long"';
    const simbolo = '<number:currency-symbol number:language="it" number:country="IT">€</number:currency-symbol>';
    const definizioni: Array<[string, string, string]> = [
      ['number-style', n(0, 1), '0'], ['number-style', n(2, 1), '0.00'], ['number-style', n(2, 1, 'g'), '#,##0.00'], ['number-style', n(0, 3), '000'],
      ['percentage-style', `${n(0, 1)}<number:text>%</number:text>`, '0%'],
      ['currency-style', `${simbolo}${n(2, 1, 'g')}`, '€#,##0.00'], ['currency-style', `${n(2, 1)}<number:text> </number:text>${simbolo}`, '0.00 €'],
      ['date-style', `<number:day${lungo}/><number:text>/</number:text><number:month${lungo}/><number:text>/</number:text><number:year${lungo}/>`, 'dd/mm/yyyy'],
      ['date-style', '<number:day/><number:text> </number:text><number:month number:textual="true" number:style="long"/><number:text> </number:text><number:year number:style="long"/>', 'd mmmm yyyy'],
      ['date-style', '<number:day-of-week/><number:month number:textual="true"/><number:year/>', 'dddmmmyy'],
      ['time-style', `<number:hours${lungo}/><number:text>:</number:text><number:minutes${lungo}/><number:text>:</number:text><number:seconds${lungo}/>`, 'hh:mm:ss'],
      ['time-style', `<number:hours/><number:text>:</number:text><number:minutes${lungo}/><number:text> </number:text><number:am-pm/>`, 'h:mm AM/PM'],
      ['text-style', '<number:text-content/>', '@'],
      ['number-style', '<number:scientific-number number:decimal-places="2" number:min-integer-digits="1" number:min-exponent-digits="2"/>', '0.00E+00'],
      ['number-style', `${n(1, 1)}<number:text> m</number:text>`, '0.0" m"'],
      ['number-style', '<number:scientific-number number:decimal-places="1" number:min-integer-digits="1" number:min-exponent-digits="3"/>', '0.0E+000'],
      ['date-style', '<number:day-of-week number:style="long"/>', 'dddd'],
      ['number-style', `<number:text>€ </number:text>${n(0, 1)}`, '€ 0'],
      ['boolean-style', '<number:boolean/>', ''],
      ['number-style', '<number:number number:min-integer-digits="1"/>', ''],
    ];
    const stili = definizioni.map(([tag, figli], i) => ds(tag, `N${i}`, figli)).join('') + definizioni.map((_, i) => stileCella(`ce${i}`, '', `style:data-style-name="N${i}"`)).join('');
    const f = await primo({ stili, tabelle: [riga(definizioni.map((_, i) => num(1, `table:style-name="ce${i}"`)).join(''))] });
    const attesi = definizioni.map(([, , codice]) => codice);
    attesi.forEach((codice, i) => {
      const ref = `${i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`}1`;
      if (codice === '') expect(f.stili[ref], ref).toBeUndefined();
      else expect(f.stili[ref]?.numFmt, `${ref} ${codice}`).toBe(codice);
    });
  });

  it('colonne: larghezze in pixel, gruppi, intervalli enormi ignorati, stile predefinito', async () => {
    const f = await primo({
      stili: '<style:style style:name="co1" style:family="table-column"><style:table-column-properties style:column-width="2.54cm"/></style:style>'
        + '<style:style style:name="co2" style:family="table-column"><style:table-column-properties style:column-width="50mm"/></style:style>'
        + '<style:style style:name="co3" style:family="table-column"><style:table-column-properties style:column-width="72pt"/></style:style>'
        + '<style:style style:name="co4" style:family="table-column"><style:table-column-properties style:column-width="1in"/></style:style>'
        + '<style:style style:name="co5" style:family="table-column"><style:table-column-properties style:column-width="100px"/></style:style>'
        + '<style:style style:name="co6" style:family="table-column"><style:table-column-properties style:column-width="auto"/></style:style>'
        + '<style:style style:name="co7" style:family="table-column"><style:table-column-properties style:column-width="0cm"/></style:style>'
        + stileCella('ce1', '<style:text-properties fo:font-weight="bold"/>'),
      tabelle: [
        '<table:table-column table:style-name="co1" table:number-columns-repeated="2"/><table:table-column table:style-name="co2" table:default-cell-style-name="ce1"/>'
        + '<table:table-column table:style-name="co3"/><table:table-column table:style-name="co4"/><table:table-column table:style-name="co5"/><table:table-column table:style-name="co6"/><table:table-column table:style-name="co7"/>'
        + '<table:table-column table:number-columns-repeated="1019" table:style-name="co1" table:default-cell-style-name="ce1"/>'
        + '<table:table-column table:style-name="inesistente"/>'
        + riga(`${num(1)}${num(2)}${num(3)}`),
      ],
    });
    expect(f.larghezze).toEqual({ 1: 96, 2: 96, 3: 189, 4: 96, 5: 96, 6: 100 });
    expect(f.stiliColonna).toEqual({ 3: { bold: true } });
    expect(f.stili).toEqual({ C1: { bold: true } });
  });

  it('colonne dentro i gruppi e righe di intestazione', async () => {
    const f = await primo({
      stili: '<style:style style:name="co1" style:family="table-column"><style:table-column-properties style:column-width="2.54cm"/></style:style>',
      tabelle: [
        '<table:table-column-group><table:table-column table:style-name="co1"/></table:table-column-group><table:table-header-columns><table:table-column table:style-name="co1"/></table:table-header-columns>'
        + `<table:table-header-rows>${riga(num(1))}</table:table-header-rows><table:table-row-group>${riga(num(2))}</table:table-row-group>`,
      ],
    });
    expect(f.larghezze).toEqual({ 1: 96, 2: 96 });
    expect(f.celle).toEqual({ A1: '1', A2: '2' });
  });

  it('righe: altezza solo se esplicita, righe ripetute, righe vuote saltate, stile predefinito', async () => {
    const f = await primo({
      stili: '<style:style style:name="ro1" style:family="table-row"><style:table-row-properties style:row-height="1cm" style:use-optimal-row-height="false"/></style:style>'
        + '<style:style style:name="ro2" style:family="table-row"><style:table-row-properties style:row-height="2cm" style:use-optimal-row-height="true"/></style:style>'
        + '<style:style style:name="ro3" style:family="table-row"><style:table-row-properties style:row-height="2cm"/></style:style>'
        + stileCella('ce1', '<style:text-properties fo:font-weight="bold"/>') + stileCella('ce2', '<style:text-properties fo:font-style="italic"/>'),
      tabelle: [[
        riga(num(1), 'table:style-name="ro1"'), riga(num(2), 'table:style-name="ro2"'), riga(num(3), 'table:style-name="ro3"'),
        riga('<table:table-cell/>', 'table:number-rows-repeated="4"'),
        riga(num(7), 'table:number-rows-repeated="2"'),
        `<table:table-header-rows>${riga(num(8))}</table:table-header-rows>`,
        riga(`${num(3)}${num(4, 'table:style-name="ce2"')}`, 'table:default-cell-style-name="ce1"'),
        riga(`${testoCella('x')}<table:table-cell table:number-columns-repeated="3"/>${num(5, 'table:number-columns-repeated="2"')}<table:table-cell table:number-columns-repeated="1000000"/>`),
        riga(`<table:table-cell table:number-columns-repeated="3" table:style-name="ce1"/><table:table-cell table:number-columns-repeated="2000" table:style-name="ce2"/>`),
        riga('<table:table-cell/>', 'table:number-rows-repeated="1048000"'),
      ].join('')],
    });
    expect(f.altezze).toEqual({ 1: 38 });
    expect(f.celle).toEqual({ A1: '1', A2: '2', A3: '3', A8: '7', A9: '7', A10: '8', A11: '3', B11: '4', A12: 'x', E12: '5', F12: '5' });
    expect(f.stiliRiga).toEqual({ 11: { bold: true } });
    expect(f.stili).toEqual({
      A11: { bold: true }, B11: { italic: true },
      A13: { bold: true }, B13: { bold: true }, C13: { bold: true },
    });
  });

  it('righe con dati ripetute molte volte si copiano tutte, quelle vuote no', async () => {
    const f = await primo({ tabelle: [riga(num(1), 'table:number-rows-repeated="1500"') + riga('<table:table-cell/>', 'table:number-rows-repeated="1500"') + riga(num(2))] });
    expect(Object.keys(f.celle).length).toBe(1501);
    expect(f.celle.A1500).toBe('1');
    expect(f.celle.A3001).toBe('2');
  });

  it('righe ripetute con dati e stili: ogni copia ha i suoi dati', async () => {
    const f = await primo({
      stili: stileCella('ce1', '<style:text-properties fo:font-weight="bold"/>'),
      tabelle: [riga(`${num(7)}${testoCella('t')}`, 'table:number-rows-repeated="3" table:default-cell-style-name="ce1"')],
    });
    expect(f.celle).toEqual({ A1: '7', B1: 't', A2: '7', B2: 't', A3: '7', B3: 't' });
    expect(Object.keys(f.stiliRiga)).toEqual(['1', '2', '3']);
    expect(Object.keys(f.stili).length).toBe(6);
  });

  it('celle unite e celle coperte', async () => {
    const f = await primo({
      tabelle: [
        riga(`${testoCella('m', 'table:number-columns-spanned="2" table:number-rows-spanned="2"')}<table:covered-table-cell/>${num(1)}`)
        + riga(`<table:covered-table-cell table:number-columns-repeated="2"/>${num(2)}`)
        + riga(`<table:table-cell table:number-columns-spanned="1" table:number-rows-spanned="1"/>${testoCella('z', 'table:number-columns-spanned="3"')}`),
      ],
    });
    expect(f.celle).toEqual({ A1: 'm', C1: '1', C2: '2', B3: 'z' });
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }, { startRow: 3, endRow: 3, startCol: 2, endCol: 4 }]);
  });

  it('celle unite: solo in verticale, in righe ripetute e oltre i limiti', async () => {
    const verticale = await primo({ tabelle: [riga(testoCella('v', 'table:number-rows-spanned="2"')) + riga('<table:covered-table-cell/>')] });
    expect(verticale.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }]);
    const ripetuta = await primo({ tabelle: [riga(testoCella('m', 'table:number-columns-spanned="2"'), 'table:number-rows-repeated="2"')] });
    expect(ripetuta.unioni).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);
    const enorme = await primo({ tabelle: [riga(testoCella('m', 'table:number-rows-spanned="2000000" table:number-columns-spanned="20000"'))] });
    expect(enorme.unioni).toEqual([{ startRow: 1, endRow: 1048576, startCol: 1, endCol: 16384 }]);
  });

  it('impostazioni di vista: foglio attivo e blocchi', async () => {
    const r = await leggiOds(await ods({
      nomi: ['Uno', 'Due', 'Tre'], tabelle: ['', '', ''],
      settings: impostazioni([{ nome: 'Uno', h: 2, v: 2, hp: 1, vp: 3 }, { nome: 'Due', h: 0, v: 2, hp: 5, vp: 1 }, { nome: 'Tre', h: 1, v: 1, hp: 4, vp: 4 }, { nome: 'Fantasma', h: 2, v: 2, hp: 9, vp: 9 }], 'Due'),
    }));
    expect(r.scambio.foglioAttivo).toBe('Due');
    expect(r.scambio.fogli.map((f) => [f.righeCongelate, f.colonneCongelate])).toEqual([[3, 1], [1, 0], [0, 0]]);
    const nonTrovato = await leggiOds(await ods({ nomi: ['Uno', 'Due'], tabelle: ['', ''], settings: impostazioni([], 'Boh') }));
    expect(nonTrovato.scambio.foglioAttivo).toBe('Uno');
    expect((await leggiOds(await ods({ tabelle: ['', ''] }))).scambio.foglioAttivo).toBe('Foglio1');
  });

  it('avvisi su ciò che non si importa', async () => {
    expect((await leggiOds(await ods({ tabelle: [riga(num(1))] }))).avvisi).toEqual([]);
    const tutto = await leggiOds(await ods({
      corpo: '<table:calculation-settings><table:null-date table:date-value="1904-01-01"/></table:calculation-settings>',
      tabelle: ['<table:table-row><table:table-cell/></table:table-row><calcext:conditional-formats/><table:content-validations/><table:data-pilot-tables/><table:named-expressions><table:named-range table:name="x"/></table:named-expressions><draw:frame/>'],
    }));
    expect(tutto.avvisi).toEqual([
      'Il file usa una data di partenza del calendario diversa dal 30/12/1899: le date scritte come numeri possono risultare sfalsate.',
      'Grafici, immagini e disegni del file non sono stati importati.',
      'Le tabelle pivot del file non sono state importate.',
      'Le formattazioni condizionali del file non sono state importate.',
      // le convalide si importano (un elenco vuoto di convalide non dà avvisi); un nome senza indirizzo non è un intervallo semplice
      'Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).',
    ]);
    const nulla = await leggiOds(await ods({ corpo: '<table:calculation-settings><table:null-date table:date-value="1899-12-30"/></table:calculation-settings>', tabelle: ['<table:named-expressions/>'] }));
    expect(nulla.avvisi).toEqual([]);
    expect((await leggiOds(await ods({ extra: { 'Pictures/a.png': 'x' } }))).avvisi).toEqual(['Grafici, immagini e disegni del file non sono stati importati.']);
    expect((await leggiOds(await ods({ extra: { 'Object 1/content.xml': '<a/>' } }))).avvisi.length).toBe(1);
  });

  it('file non validi: errori chiari', async () => {
    await expect(leggiOds(codifica.encode('questo non è un file zip, è solo testo lungo abbastanza'))).rejects.toThrow(/^File \.ods non valido: /);
    await expect(leggiOds(new Uint8Array(0))).rejects.toThrow(/^File \.ods non valido: /);
    await expect(leggiOds(await pacchetto({ 'altro.txt': 'ciao' }))).rejects.toThrow(/^File \.ods non valido: manca il contenuto$/);
    await expect(leggiOds(await ods({ mimetype: 'application/vnd.oasis.opendocument.text' }))).rejects.toThrow(/^File \.ods non valido: non è un foglio di calcolo OpenDocument$/);
    await expect(leggiOds(await pacchetto({ 'content.xml': `<office:document-content ${NS}><office:body><office:text/></office:body></office:document-content>` }))).rejects.toThrow(/^File \.ods non valido: non è un foglio di calcolo OpenDocument$/);
    await expect(leggiOds(await ods({ tabelle: [] }))).rejects.toThrow(/^File \.ods non valido: nessun foglio$/);
    await expect(leggiOds(await ods({ extra: { 'META-INF/manifest.xml': `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="content.xml"><manifest:encryption-data/></manifest:file-entry></manifest:manifest>` } }))).rejects.toThrow(/^File \.ods non valido: il file è protetto da password: non si può aprire$/);
    await expect(leggiOds(await ods({ tabelle: ['<table:table-row>'] }))).rejects.toThrow(/^File \.ods non valido: XML non valido/);
    await expect(leggiOds(await pacchetto({ 'content.xml': '<office:document-content' }))).rejects.toThrow(/^File \.ods non valido: /);
    expect((await leggiOds(await ods({ mimetype: `${TIPO_ODS}\n`, tabelle: [riga(num(1))] }))).scambio.fogli.length).toBe(1);
  });

  it('andata e ritorno: quello che scrive il nostro scrittore si rilegge uguale', async () => {
    const a = foglio('Dati', {
      celle: {
        A1: 'Nome', B1: 'Importo', A2: 'Mario', B2: '12.5', C2: '=B2*2', A3: 'vero', B3: 'TRUE', C3: '-4', D3: '=MAXIFS(B2:B3,A2:A3,"x")', A4: '007', B4: 'riga\nnuova\tcon tab', C4: '  spazi  ',
        A5: '45351', B5: '45351.5', C5: '0.5', D5: '0.15', E5: '12.5', F5: '12345.678', G5: '=Altro!A1+1',
      },
      stili: {
        A1: { bold: true, italic: true, underline: true, strike: true, fontFamily: 'Roboto', fontSize: 14, color: '#ff0000', fill: '#ffff00', hAlign: 'center', vAlign: 'middle', wrap: true },
        B1: { borders: { top: { style: 'thin', color: '#000000' }, left: { style: 'dashed', color: '#00ff00' }, bottom: { style: 'medium', color: '#0000ff' } } },
        B2: { numFmt: '€#,##0.00' }, C2: { numFmt: '0.00%' }, D2: { numFmt: 'dd/mm/yyyy' }, A4: { numFmt: '@' },
        A5: { numFmt: 'dd/mm/yyyy' }, B5: { numFmt: 'dd/mm/yyyy hh:mm:ss' }, C5: { numFmt: 'hh:mm:ss' }, D5: { numFmt: '0%' }, E5: { numFmt: '#,##0.00 €' }, F5: { numFmt: '0.00E+00' },
      },
      larghezze: { 1: 120, 2: 90 }, altezze: { 1: 30 }, unioni: [{ startRow: 8, endRow: 9, startCol: 1, endCol: 3 }], righeCongelate: 1, colonneCongelate: 2,
    });
    const b = foglio('Altro', { celle: { A1: "x'y", B1: '  spazi  ' } });
    const s = scambio([a, b], 'Altro');
    expect(await lettura(s)).toEqual(s);
  });

  it('andata e ritorno con stili di riga e di colonna e con celle unite che contengono testo', async () => {
    const s = scambio([foglio('Foglio1', { celle: { A2: 'x', B7: 'm' }, stiliRiga: { 2: { bold: true } }, stiliColonna: { 3: { fill: '#112233' } }, unioni: [{ startRow: 7, endRow: 8, startCol: 2, endCol: 3 }] })]);
    const r = (await lettura(s)).fogli[0];
    expect(r.stiliRiga).toEqual({ 2: { bold: true } });
    expect(r.stiliColonna).toEqual({ 3: { fill: '#112233' } });
    expect(r.stili).toEqual({ A2: { bold: true }, C7: { fill: '#112233' }, C8: { fill: '#112233' } });
    expect(r.unioni).toEqual([{ startRow: 7, endRow: 8, startCol: 2, endCol: 3 }]);
    expect(r.celle).toEqual({ A2: 'x', B7: 'm' });
  });

  it('andata e ritorno con celle lontane: righe e colonne vuote in mezzo', async () => {
    const s = scambio([foglio('F', { celle: { A1: 'a', E1: 'e', A1000: 'z', C500: 'c' } })]);
    expect((await lettura(s)).fogli[0].celle).toEqual({ A1: 'a', E1: 'e', A1000: 'z', C500: 'c' });
    const estremo = scambio([foglio('F', { celle: { XFD1048576: 'ultima' } })]);
    expect((await lettura(estremo)).fogli[0].celle).toEqual({ XFD1048576: 'ultima' });
  });
});

describe('T205 OpenDocument tra i formati di file e nella finestra', () => {
  it('formati: elenco, estensioni e nomi', () => {
    const o = FORMATI.find((f) => f.id === 'ods');
    expect([o?.estensione, o?.mime, o?.etichetta]).toEqual(['ods', TIPO_ODS, 'OpenDocument (.ods)']);
    expect(FORMATI.map((f) => f.id)).toEqual(['xlsx', 'ods', 'csv', 'fsheet']);
    expect(ESTENSIONI_APRI).toBe('.xlsx,.ods,.csv,.tsv,.txt,.psheet,.fsheet');
    expect(formatoDaNome('a.ods')).toBe('ods');
    expect(formatoDaNome('A.ODS')).toBe('ods');
    expect(formatoDaNome('a.odt')).toBeNull();
    expect(nomeFile('Conti: 2024', 'ods')).toBe('Conti 2024.ods');
  });

  it('esporta e importa in OpenDocument: giro completo', async () => {
    const origine = documentoDaScambio(scambio([foglio('Dati', { celle: { A1: 'Nome', B1: '5', C1: '=B1*2', D1: '45351' }, stili: { A1: { bold: true }, D1: { numFmt: 'dd/mm/yyyy' } }, larghezze: { 1: 120 }, righeCongelate: 1 })]));
    const byte = await esporta(origine, 'ods');
    expect([...(await leggiZip(byte)).keys()][0]).toBe('mimetype');
    const r = await importa(byte, 'Conti.ods');
    expect(r.formato).toBe('ods');
    expect(r.avvisi).toEqual([]);
    expect(scambioDaDocumento(r.dati)).toEqual(scambioDaDocumento(origine));
  });

  it('il tipo di archivio si decide dal contenuto: Excel e OpenDocument non si scambiano', async () => {
    const origine = documentoDaScambio(scambio([foglio('F', { celle: { A1: 'x' } })]));
    const odsBytes = await esporta(origine, 'ods');
    const xlsxBytes = await esporta(origine, 'xlsx');
    for (const nome of ['a.xlsx', 'a.csv', 'senza', 'a.ods', 'a.fsheet']) expect((await importa(odsBytes, nome)).formato, `ods come ${nome}`).toBe('ods');
    for (const nome of ['a.xlsx', 'a.csv', 'senza', 'a.ods', 'a.fsheet']) expect((await importa(xlsxBytes, nome)).formato, `xlsx come ${nome}`).toBe('xlsx');
  });

  it('archivi che non sono né Excel né OpenDocument: errore del formato indicato dal nome', async () => {
    const testoOdt = await pacchetto({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': `<office:document-content ${NS}><office:body><office:text/></office:body></office:document-content>` });
    await expect(importa(testoOdt, 'a.ods')).rejects.toThrow(/^File \.ods non valido: non è un foglio di calcolo OpenDocument$/);
    const altro = await pacchetto({ 'a.txt': 'x' });
    await expect(importa(altro, 'a.ods')).rejects.toThrow(/^File \.ods non valido: manca il contenuto$/);
    await expect(importa(altro, 'a.xlsx')).rejects.toThrow(/^File \.xlsx non valido: manca la cartella di lavoro$/);
    await expect(importa(altro, 'a.csv')).rejects.toThrow(/^File \.xlsx non valido: /);
    await expect(importa(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]), 'rotto.ods')).rejects.toThrow(/^File \.ods non valido: /);
  });

  it('avvisi in apertura: quelli del file; gli stili di ogni foglio si conservano', async () => {
    const piu = await scriviOds(scambio([foglio('Uno', { celle: { A1: 'x' } }), foglio('Due', { celle: { A1: 'y' }, stili: { A1: { bold: true } } })], 'Uno'));
    const voci = await leggiZip(piu);
    voci.set('Pictures/a.png', codifica.encode('x'));
    const r = await importa(await scriviZip([...voci].map(([nome, d]) => ({ nome, dati: d }))), 'a.ods');
    expect(r.avvisi).toEqual(['Grafici, immagini e disegni del file non sono stati importati.']);
    expect(scambioDaDocumento(r.dati).fogli.find((x) => x.nome === 'Due')!.stili.A1).toMatchObject({ bold: true });
  });


  it('avvisi di esportazione in OpenDocument', () => {
    const semplice = documentoDaScambio(scambio([foglio('F', { celle: { A1: '1' } })]));
    expect(avvisiEsportazione(semplice, 'ods')).toEqual([]);
    const rinominato = documentoDaScambio(scambio([foglio('a/b', { celle: { A1: '1' }, stili: { A1: { numFmt: '0.0" m"' } } })]));
    const avvisi = avvisiEsportazione(rinominato, 'ods');
    expect(avvisi.length).toBe(2);
    expect(avvisi[0]).toContain('«a_b»');
    expect(avvisi[1]).toContain('0.0" m"');
  });

  it('il menu File ha la voce per scaricare in OpenDocument dopo le altre tre', () => {
    const voci = menuRegistry.find((m) => m.id === 'file')?.items ?? [];
    const ids = voci.map((v) => v.id);
    const i = ids.indexOf('download-fsheet');
    expect(i).toBeGreaterThan(0);
    expect(ids[i + 1]).toBe('download-ods');
    expect([voci[i + 1].action, voci[i + 1].label]).toEqual(['download-ods', 'Scarica come OpenDocument (.ods)']);
  });

  it('finestra: File > Scarica come OpenDocument salva un file .ods che si rilegge', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    await app.updateComplete;
    const dentro = app as unknown as { tabs: Array<{ id: string; title: string }>; statusMessage: string };
    const tab = dentro.tabs.at(-1) as { id: string; title: string };
    const doc = defaultDocumentStore.getOrCreateDocument(tab.id);
    await doc.client.setCell('Foglio1', 1, 1, 'ciao');
    await doc.client.setCell('Foglio1', 1, 2, '=2*21');
    salva.mockClear();
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'download-ods', label: 'x' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(salva).toHaveBeenCalledTimes(1));
    expect(salva.mock.calls[0][0]).toBe(`${tab.title}.ods`);
    expect(salva.mock.calls[0][2]).toBe(TIPO_ODS);
    const letto = (await leggiOds(salva.mock.calls[0][1] as Uint8Array)).scambio.fogli[0];
    expect(letto.celle).toEqual({ A1: 'ciao', B1: '=2*21' });
    await vi.waitFor(() => expect(dentro.statusMessage).toBe(`Esportato "${tab.title}.ods"`));
  });

  it('finestra: File > Apri apre un file .ods nella finestra', async () => {
    document.body.innerHTML = '';
    const app = document.createElement('free-app') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
    document.body.appendChild(app);
    await app.updateComplete;
    const dentro = app as unknown as { titolo: string; statusMessage: string };
    const byte = await scriviOds(scambio([foglio('Dati', { celle: { A1: 'dal file', B1: '=2*21' } })]));
    scegli.mockResolvedValueOnce(new File([byte as BlobPart], 'Magazzino.ods'));
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open-file', label: 'Apri' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(dentro.statusMessage).toBe('Aperto "Magazzino.ods"'));
    expect(dentro.titolo).toBe('Magazzino');
    const doc = defaultDocumentStore.getDocument('tab-1');
    expect((await doc?.client.getCell('Dati', 1, 1))?.raw).toBe('dal file');
    expect((await doc?.client.getCell('Dati', 1, 2))?.value).toMatchObject({ kind: 'number', value: 42 });
  });


  it('un file Excel e uno OpenDocument con lo stesso contenuto si aprono uguali', async () => {
    const s = scambio([foglio('F', { celle: { A1: 'x', B1: '12.5', C1: '=B1*2', D1: 'true' }, stili: { A1: { bold: true, fill: '#ff0000' }, B1: { numFmt: '0.00' } }, larghezze: { 1: 120 }, unioni: [{ startRow: 3, endRow: 4, startCol: 1, endCol: 2 }], righeCongelate: 1 })]);
    const daOds = scambioDaDocumento((await importa(await scriviOds(s), 'a.ods')).dati);
    const daXlsx = scambioDaDocumento((await importa(await scriviXlsx(s), 'a.xlsx')).dati);
    expect(daOds).toEqual(daXlsx);
  });
});
