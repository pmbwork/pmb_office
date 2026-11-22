// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { daTesto, documentoVuoto, testoDi, normalizza, PASSI_CORPO, type Documento, type Paragrafo, type Run } from '../../src/modello/documento';

const enc = new TextEncoder();
const dec = new TextDecoder();
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
async function parti(doc: Documento): Promise<Map<string, NodoXml>> {
  const m = await leggiZip(await esportaDocx(doc));
  const out = new Map<string, NodoXml>();
  for (const [nome, dati] of m) out.set(nome, analizzaXml(dec.decode(dati)));
  return out;
}
const nomi = (n: NodoXml): string[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome);
const par = (d: Documento): Paragrafo[] => d.paragrafi;
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });

async function docxDa(file: Record<string, string>): Promise<Uint8Array> {
  return scriviZip(Object.entries(file).map(([nome, testo]) => ({ nome, dati: enc.encode(testo) })));
}

describe('T052: esportazione', () => {
  it('il pacchetto ha le parti di un file Word e tutti i file sono XML ben formato', async () => {
    const p = await parti(daTesto('Ciao'));
    expect(Array.from(p.keys())).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml']);
    const tipi = figliElemento(p.get('[Content_Types].xml')!, 'Override').map((o) => o.attributi.PartName);
    expect(tipi).toEqual(['/word/document.xml', '/word/styles.xml', '/word/numbering.xml']);
    const rel = figliElemento(p.get('_rels/.rels')!, 'Relationship')[0];
    expect(rel.attributi.Target).toBe('word/document.xml');
    expect(rel.attributi.Type).toBe('http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument');
    const doc = p.get('word/document.xml')!;
    expect(doc.nome).toBe('w:document');
    expect(doc.attributi['xmlns:w']).toBe('http://schemas.openxmlformats.org/wordprocessingml/2006/main');
    const sez = trova(doc, 'w:body/w:sectPr')!;
    expect(trova(sez, 'w:pgSz')!.attributi).toEqual({ 'w:w': '11906', 'w:h': '16838' });
    expect(trova(sez, 'w:pgMar')!.attributi['w:left']).toBe('1440');
  });

  it('testo, tabulazioni, spazi iniziali e caratteri speciali', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('  a\tb < c & d\t')] }, { runs: [] }] };
    const body = trova((await parti(d)).get('word/document.xml')!, 'w:body')!;
    const [p1, p2] = figliElemento(body, 'w:p');
    const r = trova(p1, 'w:r')!;
    expect(nomi(r)).toEqual(['w:t', 'w:tab', 'w:t', 'w:tab']);
    expect(figliElemento(r, 'w:t')[0].attributi['xml:space']).toBe('preserve');
    expect(figliElemento(r, 'w:t').map((t) => t.figli[0])).toEqual(['  a', 'b < c & d']);
    expect(p2.figli).toEqual([]);
    expect(nomi(body)).toEqual(['w:p', 'w:p', 'w:sectPr']);
  });

  it('proprietà del tratto nell\'ordine previsto dallo schema', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('x', { g: true, c: true, s: true, f: 'Georgia', z: 10.5, k: '#ff0000', h: '#00ff00' })] }] };
    const rPr = trova((await parti(d)).get('word/document.xml')!, 'w:body/w:p/w:r/w:rPr')!;
    expect(nomi(rPr)).toEqual(['w:rFonts', 'w:b', 'w:i', 'w:color', 'w:sz', 'w:szCs', 'w:u', 'w:shd']);
    expect(trova(rPr, 'w:rFonts')!.attributi['w:ascii']).toBe('Georgia');
    expect(trova(rPr, 'w:color')!.attributi['w:val']).toBe('FF0000');
    expect(trova(rPr, 'w:sz')!.attributi['w:val']).toBe('21');
    expect(trova(rPr, 'w:u')!.attributi['w:val']).toBe('single');
    expect(trova(rPr, 'w:shd')!.attributi).toEqual({ 'w:val': 'clear', 'w:color': 'auto', 'w:fill': '00FF00' });
    const senza = trova((await parti({ paragrafi: [{ runs: [run('x')] }] })).get('word/document.xml')!, 'w:body/w:p/w:r')!;
    expect(nomi(senza)).toEqual(['w:t']);
    const corto = trova((await parti({ paragrafi: [{ runs: [run('x', { k: '#f00', h: 'rosso' })] }] })).get('word/document.xml')!, 'w:body/w:p/w:r/w:rPr')!;
    expect(trova(corto, 'w:color')!.attributi['w:val']).toBe('FF0000');
    expect(trova(corto, 'w:shd')).toBeUndefined();
  });

  it('proprietà del paragrafo nell\'ordine previsto: stile, elenco, interlinea, rientro, allineamento', async () => {
    const d: Documento = { paragrafi: [
      { st: '1', el: 'n', ri: 2, ls: 1.5, al: 'gi', runs: [run('a')] },
      { ri: 3, al: 'ce', runs: [run('b')] },
      { st: 't', al: 'dx', ls: 2, runs: [run('c')] },
    ] };
    const [p1, p2, p3] = figliElemento(trova((await parti(d)).get('word/document.xml')!, 'w:body')!, 'w:p');
    const a = trova(p1, 'w:pPr')!;
    expect(nomi(a)).toEqual(['w:pStyle', 'w:numPr', 'w:spacing', 'w:jc']);
    expect(trova(a, 'w:pStyle')!.attributi['w:val']).toBe('Heading1');
    expect(trova(a, 'w:numPr/w:ilvl')!.attributi['w:val']).toBe('2');
    expect(trova(a, 'w:spacing')!.attributi).toEqual({ 'w:line': '360', 'w:lineRule': 'auto' });
    expect(trova(a, 'w:jc')!.attributi['w:val']).toBe('both');
    const b = trova(p2, 'w:pPr')!;
    expect(nomi(b)).toEqual(['w:ind', 'w:jc']);
    expect(trova(b, 'w:ind')!.attributi['w:left']).toBe('2160');
    expect(trova(b, 'w:jc')!.attributi['w:val']).toBe('center');
    const c = trova(p3, 'w:pPr')!;
    expect(trova(c, 'w:pStyle')!.attributi['w:val']).toBe('Title');
    expect(trova(c, 'w:jc')!.attributi['w:val']).toBe('right');
    expect(trova(c, 'w:spacing')!.attributi['w:line']).toBe('480');
  });

  it('elenchi: i puntati usano la stessa numerazione, ogni gruppo di numerati ricomincia da 1', async () => {
    const d: Documento = { paragrafi: [
      { el: 'n', runs: [run('1')] }, { el: 'n', ri: 1, runs: [run('1a')] }, { el: 'n', runs: [run('2')] },
      { el: 'p', runs: [run('•')] }, { el: 'n', runs: [run('nuovo gruppo')] }, { runs: [run('normale')] }, { el: 'n', runs: [run('terzo gruppo')] },
    ] };
    const p = await parti(d);
    const ids = figliElemento(trova(p.get('word/document.xml')!, 'w:body')!, 'w:p').map((x) => trova(x, 'w:pPr/w:numPr/w:numId')?.attributi['w:val']);
    expect(ids).toEqual(['3', '3', '3', '1', '4', undefined, '5']);
    const num = p.get('word/numbering.xml')!;
    expect(figliElemento(num, 'w:abstractNum').length).toBe(2);
    const numeri = figliElemento(num, 'w:num');
    expect(numeri.map((n) => n.attributi['w:numId'])).toEqual(['1', '2', '3', '4', '5']);
    expect(trova(numeri[2], 'w:abstractNumId')!.attributi['w:val']).toBe('2');
    expect(figliElemento(numeri[2], 'w:lvlOverride').length).toBe(9);
    const bullet = figliElemento(num, 'w:abstractNum')[0];
    expect(figliElemento(bullet, 'w:lvl').map((l) => trova(l, 'w:numFmt')!.attributi['w:val'])).toEqual(Array(9).fill('bullet'));
    const decimale = figliElemento(figliElemento(num, 'w:abstractNum')[1], 'w:lvl');
    expect(decimale.slice(0, 4).map((l) => trova(l, 'w:numFmt')!.attributi['w:val'])).toEqual(['decimal', 'lowerLetter', 'lowerRoman', 'decimal']);
    expect(trova(decimale[1], 'w:lvlText')!.attributi['w:val']).toBe('%2.');
    expect(trova(decimale[1], 'w:pPr/w:ind')!.attributi).toEqual({ 'w:left': '1440', 'w:hanging': '360' });
  });

  it('gli stili Titolo e il carattere predefinito stanno in styles.xml', async () => {
    const st = (await parti(documentoVuoto())).get('word/styles.xml')!;
    const ids = figliElemento(st, 'w:style').map((s) => s.attributi['w:styleId']);
    expect(ids).toEqual(['Normal', 'Heading1', 'Heading2', 'Heading3', 'Title', 'Subtitle']);
    expect(trova(st, 'w:docDefaults/w:rPrDefault/w:rPr/w:rFonts')!.attributi['w:ascii']).toBe('Arial');
    expect(trova(st, 'w:docDefaults/w:rPrDefault/w:rPr/w:sz')!.attributi['w:val']).toBe('22');
    expect(trova(figliElemento(st, 'w:style')[1], 'w:rPr/w:sz')!.attributi['w:val']).toBe('40');
    expect(trova(figliElemento(st, 'w:style')[5], 'w:rPr/w:color')!.attributi['w:val']).toBe('666666');
    expect(trova((await parti(documentoVuoto())).get('word/document.xml')!, 'w:body/w:p')).toBeDefined();
  });
});

function casuale(seme: number): Documento {
  const r = generatore(seme * 101);
  const scegli = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const TESTI = ['a', 'bc', ' ', '  x ', 'è', '😀', 'tab\tdopo', '<&>', 'Lorem ipsum', '"q"'];
  const COLORI = ['#ff0000', '#00ff00', '#123abc', '#000000', '#ffffff'];
  const paragrafi: Paragrafo[] = [];
  for (let i = 1 + Math.floor(r() * 5); i > 0; i--) {
    const runs: Run[] = [];
    for (let k = Math.floor(r() * 4); k > 0; k--) {
      const x: Run = { t: scegli(TESTI), g: r() < 0.3, c: r() < 0.3, s: r() < 0.3 };
      if (r() < 0.3) x.f = scegli(['Georgia', 'Verdana', 'Times New Roman']);
      if (r() < 0.3) x.z = scegli([...PASSI_CORPO.filter((z) => z !== 11), 10.5, 13]);
      if (r() < 0.3) x.k = scegli(COLORI);
      if (r() < 0.3) x.h = scegli(COLORI);
      runs.push(x);
    }
    const p: Paragrafo = { runs: normalizza(runs) };
    if (r() < 0.3) p.al = scegli(['ce', 'dx', 'gi'] as const);
    if (r() < 0.3) p.ls = scegli([1, 1.5, 2, 1.08, 0.5, 3]);
    if (r() < 0.3) p.el = scegli(['p', 'n'] as const);
    if (r() < 0.3) p.ri = 1 + Math.floor(r() * 8);
    if (r() < 0.3) p.st = scegli(['t', 's', '1', '2', '3'] as const);
    paragrafi.push(p);
  }
  return { paragrafi };
}

describe('T052: andata e ritorno', () => {
  it('prova casuale: 200 documenti scritti in .docx e riletti tornano identici', async () => {
    for (let seme = 1; seme <= 200; seme++) {
      const d = casuale(seme);
      const letto = await importaDocx(await esportaDocx(d));
      expect(letto, `seme ${seme}`).toEqual(d);
    }
  });

  it('il documento vuoto e quello di solo testo', async () => {
    expect(await importaDocx(await esportaDocx(documentoVuoto()))).toEqual(documentoVuoto());
    const d = daTesto('uno\n\ndue\ntre');
    expect(testoDi(await importaDocx(await esportaDocx(d)))).toBe('uno\n\ndue\ntre');
  });
});

const TEMA = `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
const RELS = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const RELS_DOC = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`;
const STILI_WORD = (carattere: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr>${carattere}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normale"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Titolo1"><w:name w:val="heading 1"/></w:style>
<w:style w:type="paragraph" w:styleId="Titolo"><w:name w:val="Title"/></w:style>
<w:style w:type="paragraph" w:styleId="Sottotitolo"><w:name w:val="Subtitle"/></w:style>
<w:style w:type="paragraph" w:styleId="Titolo5"><w:name w:val="heading 5"/></w:style>
<w:style w:type="character" w:styleId="Enfasi"><w:name w:val="Emphasis"/></w:style></w:styles>`;
const NUMERAZIONE = `<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl><w:lvl w:ilvl="2"><w:numFmt w:val="none"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="8"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num></w:numbering>`;
const CORPO_WORD = `<w:body>
<w:p w:rsidR="00A1" w:rsidRDefault="00A1"><w:pPr><w:pStyle w:val="Titolo1"/></w:pPr><w:bookmarkStart w:id="0" w:name="_x"/><w:r><w:t>Titolo</w:t></w:r><w:bookmarkEnd w:id="0"/></w:p>
<w:p><w:pPr><w:pStyle w:val="Titolo"/><w:jc w:val="end"/></w:pPr><w:r><w:t>Gran titolo</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Sottotitolo"/><w:jc w:val="start"/></w:pPr><w:r><w:t>Sotto</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Titolo5"/></w:pPr><w:r><w:t>Livello cinque</w:t></w:r></w:p>
<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>
 <w:proofErr w:type="spellStart"/><w:r><w:rPr><w:b/><w:i w:val="0"/><w:u w:val="none"/><w:sz w:val="28"/><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">Grassetto </w:t></w:r><w:proofErr w:type="spellEnd"/>
 <w:hyperlink r:id="rId9"><w:r><w:rPr><w:u w:val="single"/><w:color w:val="auto"/></w:rPr><w:t>collegamento</w:t></w:r></w:hyperlink>
 <w:r><w:rPr><w:highlight w:val="yellow"/><w:rFonts w:ascii="Verdana" w:hAnsi="Verdana"/></w:rPr><w:t>giallo</w:t></w:r>
 <w:r><w:rPr><w:shd w:val="clear" w:color="auto" w:fill="CCEEFF"/></w:rPr><w:tab/><w:t>azzurro</w:t></w:r>
 <w:ins w:id="5" w:author="x"><w:r><w:t>inserito</w:t></w:r></w:ins><w:del w:id="6" w:author="x"><w:r><w:delText>cancellato</w:delText></w:r></w:del></w:p>
<w:p><w:pPr><w:spacing w:line="480" w:lineRule="exact"/><w:ind w:left="1440"/></w:pPr><w:r><w:t>Prima</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>Dopo</w:t></w:r><w:r><w:br w:type="page"/></w:r><w:r><w:t>Pagina</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>punto</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>sotto-punto</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r><w:t>numero</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="8"/></w:numPr><w:ind w:left="1440" w:hanging="360"/></w:pPr><w:r><w:t>lettera</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="2"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r><w:t>senza segno</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>fuori elenco</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>cella A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>cella B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:sdt><w:sdtContent><w:p><w:r><w:t>controllo</w:t></w:r></w:p></w:sdtContent></w:sdt>
<w:p><w:r><w:drawing/></w:r></w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>`;
const DOCUMENTO_WORD = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ${W} mc:Ignorable="w14">${CORPO_WORD}</w:document>`;

describe('T052: documenti fatti da Word', () => {
  const plain = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });

  it('stili, evidenziazioni, modifiche registrate, collegamenti, tabelle, elenchi e interruzioni di riga', async () => {
    const f = await docxDa({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      '_rels/.rels': RELS, 'word/document.xml': DOCUMENTO_WORD, 'word/_rels/document.xml.rels': RELS_DOC,
      'word/styles.xml': STILI_WORD('<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>'), 'word/numbering.xml': NUMERAZIONE, 'word/theme/theme1.xml': TEMA,
    });
    const d = await importaDocx(f);
    const cp = (i: number) => ({ ...d.paragrafi[i] });
    expect(cp(0)).toEqual({ st: '1', runs: [plain('Titolo')] });
    expect(cp(1)).toEqual({ st: 't', al: 'dx', runs: [plain('Gran titolo')] });
    expect(cp(2)).toEqual({ st: 's', runs: [plain('Sotto')] });
    expect(cp(3)).toEqual({ st: '3', runs: [plain('Livello cinque')] });
    expect(cp(4)).toEqual({
      ls: 1.5, al: 'gi',
      runs: [plain('Grassetto ', { g: true, z: 14, k: '#ff0000' }), plain('collegamento', { s: true }), plain('giallo', { f: 'Verdana', h: '#ffff00' }), plain('\tazzurro', { h: '#cceeff' }),
        // dal 2026-11-20 le modifiche registrate restano: l'inserito e il cancellato sono segnati (T553)
        { ...plain('inserito'), rv: { t: 'i', a: 'x', d: '' } }, { ...plain('cancellato'), rv: { t: 'd', a: 'x', d: '' } }],
    });
    expect(cp(5)).toEqual({ ri: 2, runs: [plain('Prima')] });
    expect(cp(6)).toEqual({ ri: 2, runs: [plain('Dopo')] });
    // l'interruzione di pagina di Word (w:br type=page) porta "Pagina" su un foglio nuovo
    expect(cp(7)).toEqual({ ri: 2, sp: true, runs: [plain('Pagina')] });
    expect(cp(8)).toEqual({ el: 'p', runs: [plain('punto')] });
    expect(cp(9)).toEqual({ el: 'p', ri: 1, runs: [plain('sotto-punto')] });
    expect(cp(10)).toEqual({ el: 'n', runs: [plain('numero')] });
    expect(cp(11)).toEqual({ el: 'n', ri: 1, runs: [plain('lettera')] });
    expect(cp(12)).toEqual({ runs: [plain('senza segno')] });
    expect(cp(13)).toEqual({ runs: [plain('fuori elenco')] });
    expect(d.paragrafi.slice(14).map((p) => testoDi({ paragrafi: [p] }))).toEqual(['cella A', 'cella B', 'controllo', '']);
    expect(d.paragrafi.length).toBe(18);
  });

  it('il carattere e il corpo del documento (anche dal tema) diventano attributi dei tratti', async () => {
    const corpo = `<w:document ${W}><w:body><w:p><w:r><w:t>uno</w:t></w:r><w:r><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi"/><w:sz w:val="22"/></w:rPr><w:t>due</w:t></w:r></w:p></w:body></w:document>`;
    const tema = await importaDocx(await docxDa({
      'word/document.xml': corpo, 'word/_rels/document.xml.rels': RELS_DOC, 'word/styles.xml': STILI_WORD('<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/>'), 'word/theme/theme1.xml': TEMA,
    }));
    expect(tema.paragrafi[0].runs).toEqual([plain('uno', { f: 'Calibri' }), plain('due', { f: 'Calibri Light' })]);
    const solo = await importaDocx(await docxDa({ 'word/document.xml': corpo }));
    expect(solo.paragrafi[0].runs).toEqual([plain('unodue')]);
    const grande = await importaDocx(await docxDa({
      'word/document.xml': corpo, 'word/styles.xml': `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
    }));
    expect(grande.paragrafi[0].runs).toEqual([plain('uno', { f: 'Times New Roman', z: 12 }), plain('due', { f: 'Times New Roman' })]);
  });

  it('la parte principale si trova anche se il file ha un nome diverso, e senza i file accessori', async () => {
    const r = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/doc/principale.xml"/></Relationships>`;
    const d = await importaDocx(await docxDa({ '_rels/.rels': r, 'doc/principale.xml': `<w:document ${W}><w:body><w:p><w:r><w:t>ok</w:t></w:r></w:p></w:body></w:document>` }));
    expect(testoDi(d)).toBe('ok');
  });

  it('l\'interlinea 1,15 è quella normale e non lascia traccia; le altre si conservano', async () => {
    const riga = (n: number) => `<w:p><w:pPr><w:spacing w:line="${n}" w:lineRule="auto"/></w:pPr><w:r><w:t>x</w:t></w:r></w:p>`;
    const d = await importaDocx(await docxDa({ 'word/document.xml': `<w:document ${W}><w:body>${riga(276)}${riga(240)}${riga(259)}${riga(480)}</w:body></w:document>` }));
    expect(d.paragrafi.map((p) => p.ls)).toEqual([undefined, 1, 1.08, 2]);
    expect(Object.keys(d.paragrafi[0])).toEqual(['runs']);
  });

  it('un documento Word senza paragrafi dà un documento vuoto', async () => {
    const d = await importaDocx(await docxDa({ 'word/document.xml': `<w:document ${W}><w:body><w:sectPr/></w:body></w:document>` }));
    expect(d).toEqual(documentoVuoto());
  });
});

describe('T052: file sbagliati', () => {
  it('non è un archivio, manca il testo, XML rotto, radice o corpo sbagliati: errore chiaro', async () => {
    await expect(importaDocx(enc.encode('non è un docx, solo testo lungo abbastanza per sembrare un file'))).rejects.toThrow(/^DOCX non valido/);
    await expect(importaDocx(await docxDa({ 'altro.txt': 'ciao' }))).rejects.toThrow(/manca il testo/);
    await expect(importaDocx(await docxDa({ 'word/document.xml': '<w:document><w:body></w:document>' }))).rejects.toThrow(/DOCX non valido: word\/document.xml/);
    await expect(importaDocx(await docxDa({ 'word/document.xml': '<html/>' }))).rejects.toThrow(/manca il testo/);
    await expect(importaDocx(await docxDa({ 'word/document.xml': `<w:document ${W}/>` }))).rejects.toThrow(/manca il corpo/);
    await expect(importaDocx(await docxDa({ 'word/document.xml': `<w:document ${W}><w:body/></w:document>`, 'word/styles.xml': '<w:styles>' }))).rejects.toThrow(/word\/styles.xml/);
  });
});
