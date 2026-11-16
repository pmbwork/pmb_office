import { describe, it, expect } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { controllaTabelle, serializza, testoParagrafo, type Documento, type Paragrafo, type Run } from '../../src/modello/documento';

const dec = new TextDecoder('utf-8');
const enc = new TextEncoder();
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const cella = (i: number, r: number, c: number, t: string, extra: Partial<Paragrafo> = {}, runExtra: Partial<Run> = {}): Paragrafo => ({ ...extra, runs: t === '' ? [] : [run(t, runExtra)], tb: { i, r, c } });
const vuoto = (): Paragrafo => ({ runs: [] });
/** tabella i, righe x colonne, con "rc" come testo di ogni cella */
function tabella(i: number, righe: number, colonne: number): Paragrafo[] {
  const out: Paragrafo[] = [];
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) out.push(cella(i, r, c, `${r}${c}`));
  return out;
}
const nomi = (n: NodoXml): string[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome);

async function corpoDi(doc: Documento): Promise<NodoXml> {
  const m = await leggiZip(await esportaDocx(doc));
  return trova(analizzaXml(dec.decode(m.get('word/document.xml')!)), 'w:body')!;
}
const giro = async (d: Documento): Promise<Documento> => importaDocx(await esportaDocx(d));

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
async function docxCon(corpo: string): Promise<Uint8Array> {
  return scriviZip(Object.entries({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`,
  }).map(([nome, testo]) => ({ nome, dati: enc.encode(testo) })));
}
const p = (t: string, pr = ''): string => `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}<w:r><w:t>${t}</w:t></w:r></w:p>`;
const tc = (contenuto: string, pr = ''): string => `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ''}${contenuto}</w:tc>`;
const tr = (...celle: string[]): string => `<w:tr>${celle.join('')}</w:tr>`;
const tbl = (...righe: string[]): string => `<w:tbl><w:tblPr/><w:tblGrid/>${righe.join('')}</w:tbl>`;
const celleDi = (d: Documento): string[] => d.paragrafi.map((x) => (x.tb ? `${x.tb.i}:${x.tb.r}${x.tb.c}` : '-'));
const testi = (d: Documento): string[] => d.paragrafi.map(testoParagrafo);

describe('T112: esportare le tabelle', () => {
  it('una tabella diventa w:tbl con bordi, griglia e righe di celle, nel posto giusto tra i paragrafi', async () => {
    const doc: Documento = { paragrafi: [{ runs: [run('prima')] }, ...tabella(0, 2, 2), { runs: [run('dopo')] }] };
    const corpo = await corpoDi(doc);
    expect(nomi(corpo)).toEqual(['w:p', 'w:tbl', 'w:p', 'w:sectPr']);
    const t = trova(corpo, 'w:tbl')!;
    expect(nomi(t)).toEqual(['w:tblPr', 'w:tblGrid', 'w:tr', 'w:tr']);
    expect(trova(t, 'w:tblPr/w:tblW')!.attributi).toEqual({ 'w:w': '9026', 'w:type': 'dxa' });
    expect(nomi(trova(t, 'w:tblPr/w:tblBorders')!)).toEqual(['w:top', 'w:left', 'w:bottom', 'w:right', 'w:insideH', 'w:insideV']);
    expect(trova(t, 'w:tblPr/w:tblBorders/w:top')!.attributi).toEqual({ 'w:val': 'single', 'w:sz': '4', 'w:space': '0', 'w:color': '000000' });
    expect(trova(t, 'w:tblPr/w:tblLayout')!.attributi['w:type']).toBe('fixed');
    expect(figliElemento(trova(t, 'w:tblGrid')!, 'w:gridCol').map((g) => g.attributi['w:w'])).toEqual(['4513', '4513']);
    const righe = figliElemento(t, 'w:tr');
    expect(righe.map((r) => figliElemento(r, 'w:tc').length)).toEqual([2, 2]);
    const c = figliElemento(righe[1], 'w:tc')[0];
    expect(trova(c, 'w:tcPr/w:tcW')!.attributi).toEqual({ 'w:w': '4513', 'w:type': 'dxa' });
    expect(trova(c, 'w:p/w:r/w:t')!.figli[0]).toBe('10');
  });

  it('i paragrafi di una cella stanno tutti nella stessa w:tc; con tre colonne la larghezza si divide per tre', async () => {
    const doc: Documento = { paragrafi: [vuoto(), cella(0, 0, 0, 'a'), cella(0, 0, 0, 'b'), cella(0, 0, 1, 'c'), cella(0, 0, 2, 'd'), vuoto()] };
    const t = trova(await corpoDi(doc), 'w:tbl')!;
    const celle = figliElemento(figliElemento(t, 'w:tr')[0], 'w:tc');
    expect(celle.map((x) => figliElemento(x, 'w:p').length)).toEqual([2, 1, 1]);
    expect(figliElemento(trova(t, 'w:tblGrid')!, 'w:gridCol').map((g) => g.attributi['w:w'])).toEqual(['3008', '3008', '3008']);
  });

  it('una tabella in fondo, o seguita da un\'altra tabella, ha un w:p dopo', async () => {
    const infondo = await corpoDi({ paragrafi: [vuoto(), ...tabella(0, 1, 1)] });
    expect(nomi(infondo)).toEqual(['w:p', 'w:tbl', 'w:p', 'w:sectPr']);
    const due = await corpoDi({ paragrafi: [...tabella(0, 1, 1), ...tabella(1, 1, 1)] });
    expect(nomi(due)).toEqual(['w:tbl', 'w:p', 'w:tbl', 'w:p', 'w:sectPr']);
    const normale = await corpoDi({ paragrafi: [...tabella(0, 1, 1), vuoto()] });
    expect(nomi(normale)).toEqual(['w:tbl', 'w:p', 'w:sectPr']);
  });

  it('senza tabelle il file è quello di prima', async () => {
    const corpo = await corpoDi({ paragrafi: [{ runs: [run('x')] }] });
    expect(nomi(corpo)).toEqual(['w:p', 'w:sectPr']);
  });
});

describe('T112: andata e ritorno', () => {
  it('tabelle con formattazione, elenchi, collegamenti e più paragrafi per cella tornano identiche', async () => {
    const doc: Documento = { paragrafi: [
      { st: '1', runs: [run('Titolo')] },
      cella(0, 0, 0, 'grassetto', {}, { g: true, k: '#ff0000' }),
      cella(0, 0, 0, 'secondo paragrafo', { al: 'ce' }),
      cella(0, 0, 1, 'voce', { el: 'p' }),
      cella(0, 1, 0, 'collegamento', {}, { u: 'https://esempio.it/x' }),
      cella(0, 1, 1, ''),
      vuoto(),
      ...tabella(1, 1, 3),
      { runs: [run('fine')] },
    ] };
    expect(controllaTabelle(doc)).toBeNull();
    const r = await giro(doc);
    expect(serializza(r)).toBe(serializza(doc));
    expect(controllaTabelle(r)).toBeNull();
  });

  it('esportare di nuovo il documento riletto dà gli stessi paragrafi', async () => {
    const doc: Documento = { paragrafi: [vuoto(), ...tabella(0, 3, 2), vuoto(), ...tabella(1, 2, 2), vuoto()] };
    const una = await giro(doc);
    expect(serializza(await giro(una))).toBe(serializza(una));
  });
});

describe('T112: importare le tabelle degli altri programmi', () => {
  it('una tabella di Word: righe, celle e testo, con il formato dei paragrafi nelle celle', async () => {
    const d = await importaDocx(await docxCon(
      p('sopra') + tbl(tr(tc(p('A', '<w:jc w:val="center"/>')), tc(p('B'))), tr(tc(p('C')), tc(p('D')))) + p('sotto'),
    ));
    expect(testi(d)).toEqual(['sopra', 'A', 'B', 'C', 'D', 'sotto']);
    expect(celleDi(d)).toEqual(['-', '0:00', '0:01', '0:10', '0:11', '-']);
    expect(d.paragrafi[1].al).toBe('ce');
    expect(controllaTabelle(d)).toBeNull();
  });

  it('una cella con più paragrafi, una cella senza paragrafi e una tabella dentro una cella', async () => {
    const d = await importaDocx(await docxCon(tbl(tr(
      tc(p('uno') + p('due')),
      tc(''),
      tc(p('fuori') + tbl(tr(tc(p('annidata'))))),
    )) + p('x')));
    expect(testi(d)).toEqual(['uno', 'due', '', 'fuori', 'annidata', 'x']);
    expect(celleDi(d)).toEqual(['0:00', '0:00', '0:01', '0:02', '0:02', '-']);
  });

  it('celle unite in orizzontale: la cella e tante celle vuote quante ne copre', async () => {
    const d = await importaDocx(await docxCon(tbl(
      tr(tc(p('larga'), '<w:gridSpan w:val="2"/>'), tc(p('c'))),
      tr(tc(p('a')), tc(p('b')), tc(p('c'))),
    ) + p('x')));
    expect(testi(d)).toEqual(['larga', '', 'c', 'a', 'b', 'c', 'x']);
    expect(celleDi(d)).toEqual(['0:00', '0:01', '0:02', '0:10', '0:11', '0:12', '-']);
    expect(controllaTabelle(d)).toBeNull();
  });

  it('celle unite in verticale: la prima ha il testo, le altre sono vuote', async () => {
    const d = await importaDocx(await docxCon(tbl(
      tr(tc(p('alta'), '<w:vMerge w:val="restart"/>'), tc(p('b'))),
      tr(tc(p('nascosto'), '<w:vMerge/>'), tc(p('d'))),
    ) + p('x')));
    expect(testi(d)).toEqual(['alta', 'b', '', 'd', 'x']);
    expect(celleDi(d)).toEqual(['0:00', '0:01', '0:10', '0:11', '-']);
  });

  it('le righe più corte si completano con celle vuote', async () => {
    const d = await importaDocx(await docxCon(tbl(tr(tc(p('a')), tc(p('b')), tc(p('c'))), tr(tc(p('d')))) + p('x')));
    expect(testi(d)).toEqual(['a', 'b', 'c', 'd', '', '', 'x']);
    expect(celleDi(d)).toEqual(['0:00', '0:01', '0:02', '0:10', '0:11', '0:12', '-']);
    expect(controllaTabelle(d)).toBeNull();
  });

  it('dopo una tabella in fondo o prima di un\'altra tabella si aggiunge un paragrafo vuoto; prima di un paragrafo no', async () => {
    const fondo = await importaDocx(await docxCon(p('x') + tbl(tr(tc(p('a'))))));
    expect(celleDi(fondo)).toEqual(['-', '0:00', '-']);
    const due = await importaDocx(await docxCon(tbl(tr(tc(p('a')))) + tbl(tr(tc(p('b')))) + p('z')));
    expect(celleDi(due)).toEqual(['0:00', '-', '1:00', '-']);
    expect(testi(due)).toEqual(['a', '', 'b', 'z']);
  });

  it('una tabella dentro un controllo (sdt) si legge come tabella; una tabella senza righe sparisce', async () => {
    const d = await importaDocx(await docxCon(`<w:sdt><w:sdtContent>${tbl(tr(tc(p('a'))))}${p('z')}</w:sdtContent></w:sdt><w:tbl><w:tblPr/></w:tbl>${p('fine')}`));
    expect(celleDi(d)).toEqual(['0:00', '-', '-']);
    expect(testi(d)).toEqual(['a', 'z', 'fine']);
  });

  it('una tabella troppo grande (oltre 1000 righe o 100 colonne) diventa paragrafi come prima', async () => {
    const righe = Array.from({ length: 1001 }, (_, i) => tr(tc(p(`r${i}`)))).join('');
    const d = await importaDocx(await docxCon(`<w:tbl><w:tblPr/>${righe}</w:tbl>${p('z')}`));
    expect(d.paragrafi.length).toBe(1002);
    expect(d.paragrafi.every((x) => x.tb === undefined)).toBe(true);
    const larga = await importaDocx(await docxCon(tbl(tr(...Array.from({ length: 101 }, (_, i) => tc(p(`c${i}`))))) + p('z')));
    expect(larga.paragrafi.length).toBe(102);
    expect(larga.paragrafi.every((x) => x.tb === undefined)).toBe(true);
  });

  it('una riga senza celle si salta; una tabella fatta solo di righe senza celle sparisce', async () => {
    const d = await importaDocx(await docxCon(tbl(tr(tc(p('a')), tc(p('b'))), tr(), tr(tc(p('c')), tc(p('d')))) + p('x')));
    expect(celleDi(d)).toEqual(['0:00', '0:01', '0:10', '0:11', '-']);
    expect(testi(d)).toEqual(['a', 'b', 'c', 'd', 'x']);
    const vuota = await importaDocx(await docxCon(tbl(tr(), tr()) + p('x')));
    expect(celleDi(vuota)).toEqual(['-']);
    expect(testi(vuota)).toEqual(['x']);
  });

  it('i numeri delle tabelle sono progressivi, anche tra tabelle separate da testo', async () => {
    const d = await importaDocx(await docxCon(tbl(tr(tc(p('a')))) + p('mezzo') + tbl(tr(tc(p('b')))) + p('z')));
    expect(celleDi(d)).toEqual(['0:00', '-', '1:00', '-']);
  });
});
