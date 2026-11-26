// @vitest-environment node
// T574: i file di Word si aprono come in Word (segnalazione del 2026-11-25: «quando apro file word o excel spesso vengono starati
// graficamente»). Pagina del documento (formato, orientamento, margini) letta e scritta; aspetto degli stili già fatti (Titolo, Titolo 1...)
// definito dal file; elenco scritto nello stile; spazi dello stile della tabella; interlinea singola quando il file non la scrive; linea
// sotto scritta nello stile; interlinea come Word (altezza naturale della riga del carattere); pagine con titoli tenuti con il paragrafo dopo
// e senza righe isolate. Confronti fatti con Word (PDF) su due documenti veri (LAVORO/studio-microsoft-office/confronto_visivo*.py).
import { describe, expect, test } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { esportaOdt, importaOdt } from '../../src/formati/odt';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { deserializza, serializza, type Documento } from '../../src/modello/documento';
import { rigaNaturale } from '../../src/modello/riga';
import { cssStili } from '../../src/modello/stili';
import { impagina, type Riga } from '../../src/editor/pagine';

const enc = new TextEncoder();
const dec = new TextDecoder();
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const RELS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
const RELS_DOC = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>';
const NUMERAZIONE = `<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="5"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
const STILI = `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normale"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Titolo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normale"/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="0"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="365F91"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titolo"><w:name w:val="Title"/><w:basedOn w:val="Normale"/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="4F81BD"/></w:pBdr><w:spacing w:after="300" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:color w:val="17365D"/><w:sz w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Puntoelenco"><w:name w:val="List Bullet"/><w:basedOn w:val="Normale"/><w:pPr><w:numPr><w:numId w:val="5"/></w:numPr></w:pPr></w:style>
<w:style w:type="table" w:styleId="Tabellanormale"><w:name w:val="Normal Table"/></w:style>
<w:style w:type="table" w:styleId="Grigliatabella"><w:name w:val="Table Grid"/><w:basedOn w:val="Tabellanormale"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>
</w:styles>`;
const T = (s: string) => `<w:r><w:t xml:space="preserve">${s}</w:t></w:r>`;
async function docx(corpo: string, stili = STILI): Promise<Uint8Array> {
  const file: Record<string, string> = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', '_rels/.rels': RELS,
    'word/_rels/document.xml.rels': RELS_DOC, 'word/styles.xml': stili, 'word/numbering.xml': NUMERAZIONE,
    'word/document.xml': `<w:document ${W}><w:body>${corpo}</w:body></w:document>`,
  };
  return scriviZip(Object.entries(file).map(([nome, testo]) => ({ nome, dati: enc.encode(testo) })));
}
const parte = async (b: Uint8Array, nome: string): Promise<string> => dec.decode((await leggiZip(b)).get(nome)!);
const SEZIONE_LETTERA = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr>';

describe('T574: pagina del documento', () => {
  test('Lettera con margini di 3,17 cm ai lati: si legge, si riscrive in .docx, .odt e .pdoc', async () => {
    const d = await importaDocx(await docx(`<w:p>${T('testo')}</w:p>${SEZIONE_LETTERA}`));
    expect(d.pagina).toEqual({ f: 'Letter', o: 'v', ma: 96, mb: 96, ms: 120, md: 120 });
    const x = await esportaDocx(d);
    const sez = (await parte(x, 'word/document.xml')).match(/<w:pgSz[^>]*\/><w:pgMar[^>]*\/>/)![0];
    expect(sez).toContain('w:w="12240"');
    expect(sez).toContain('w:h="15840"');
    expect(sez).toContain('w:left="1800"');
    expect((await importaDocx(x)).pagina).toEqual(d.pagina);
    expect((await importaOdt(await esportaOdt(d))).pagina).toEqual(d.pagina);
    expect(deserializza(serializza(d)).pagina).toEqual(d.pagina);
  });
  test('A4 orizzontale; la pagina predefinita (A4 verticale, margini di un pollice) non si tiene', async () => {
    const o = await importaDocx(await docx(`<w:p>${T('x')}</w:p><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>`));
    expect(o.pagina).toEqual({ f: 'A4', o: 'o', ma: 96, mb: 96, ms: 96, md: 96 });
    expect((await parte(await esportaDocx(o), 'word/document.xml'))).toContain('w:orient="landscape"');
    const p = await importaDocx(await docx(`<w:p>${T('x')}</w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>`));
    expect(p.pagina).toBeUndefined();
    expect(() => deserializza(JSON.stringify({ v: 1, p: [{ r: [] }], pg: { f: 'B5', o: 'v', ma: 1, mb: 1, ms: 1, md: 1 } }))).toThrow();
  });
});

describe('T574: stili del file', () => {
  test('Titolo 1 del file (grassetto, blu, 14 punti, 24 prima e niente dopo) resta come stile con il nome di Word e si riscrive al suo posto', async () => {
    const d = await importaDocx(await docx(`<w:p><w:pPr><w:pStyle w:val="Titolo1"/></w:pPr>${T('Home page')}</w:p><w:p>${T('testo')}</w:p>`));
    expect(d.paragrafi[0]).toMatchObject({ st: '1', su: 'Heading1' });
    expect(d.paragrafi[0].runs[0]).toEqual({ t: 'Home page', g: false, c: false, s: false, f: 'Calibri' });
    expect(d.stili?.find((s) => s.id === 'Heading1')).toMatchObject({ nome: 'Titolo 1', base: '1', z: 14, g: true, k: '#365f91', sb: 24, sa: 0 });
    const stili = await parte(await esportaDocx(d), 'word/styles.xml');
    const h1 = stili.match(/<w:style [^>]*w:styleId="Heading1"[\s\S]*?<\/w:style>/g)!;
    expect(h1.length).toBe(1);
    expect(h1[0]).toContain('<w:name w:val="heading 1"/>');
    expect(h1[0]).not.toContain('customStyle');
    expect(h1[0]).toMatch(/<w:b\/>[\s\S]*<w:color w:val="365F91"\/>[\s\S]*<w:sz w:val="28"\/>/);
    expect(h1[0]).toContain('w:after="0"');
    const di = await importaDocx(await esportaDocx(d));
    expect(di.stili?.find((s) => s.id === 'Heading1')).toMatchObject({ z: 14, g: true, k: '#365f91', sb: 24, sa: 0 });
  });
  test('il Titolo con la linea sotto nello stile ha la linea; i tratti dei titoli non prendono il corpo del testo normale', async () => {
    const d = await importaDocx(await docx(`<w:p><w:pPr><w:pStyle w:val="Titolo"/></w:pPr>${T('Gran titolo')}</w:p>`));
    expect(d.paragrafi[0]).toMatchObject({ st: 't', su: 'Title', hr: true });
    expect(d.paragrafi[0].runs[0].z).toBeUndefined();
    expect(d.stili?.find((s) => s.id === 'Title')).toMatchObject({ k: '#17365d', ls: 1 });
    // 26 punti è anche il corpo che pmb_docs dà da sé al Titolo: non serve scriverlo
    expect(d.stili?.find((s) => s.id === 'Title')?.z).toBeUndefined();
  });
  test('l\'elenco scritto nello stile (Elenco puntato di Word) è un elenco puntato', async () => {
    const d = await importaDocx(await docx(`<w:p><w:pPr><w:pStyle w:val="Puntoelenco"/></w:pPr>${T('voce')}</w:p>`));
    expect(d.paragrafi[0].el).toBe('p');
  });
  test('nelle celle con lo stile Griglia tabella niente spazio dopo e interlinea singola; fuori dalla tabella quelli del documento', async () => {
    const d = await importaDocx(await docx(`<w:p>${T('fuori')}</w:p><w:tbl><w:tblPr><w:tblStyle w:val="Grigliatabella"/></w:tblPr><w:tr><w:tc><w:p>${T('cella')}</w:p></w:tc></w:tr></w:tbl><w:p>${T('dopo')}</w:p>`));
    const fuori = d.paragrafi[0], cella = d.paragrafi.find((p) => p.tb)!;
    expect([fuori.sa, fuori.ls]).toEqual([10, undefined]);
    expect([cella.sa, cella.ls]).toEqual([undefined, 1]);
  });
  test('senza interlinea scritta da nessuna parte è singola, come in Word', async () => {
    const senza = STILI.replace(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/, '');
    const d = await importaDocx(await docx(`<w:p>${T('riga')}</w:p>`, senza));
    expect(d.paragrafi[0].ls).toBe(1);
  });
});

describe('T574: interlinea e pagine come in Word', () => {
  test('altezza naturale della riga: Calibri 1,221, Cambria 1,172, Arial 1,15 (Word: 11 × 1,221 × 1,15 = 15,44 punti a riga)', () => {
    expect(rigaNaturale('Calibri')).toBe(1.221);
    expect(rigaNaturale('cambria')).toBe(1.172);
    expect(rigaNaturale()).toBe(1.15);
    expect(rigaNaturale('Sconosciuto')).toBe(1.15);
    expect(cssStili([{ id: 'Heading1', nome: 'Titolo 1', base: '1', f: 'Calibri', z: 14, sb: 24, sa: 0 }], (f) => `"${f}"`))
      .toBe('.testo p.su.su-Heading1 { font-family: "Calibri"; --rn: 1.221; margin-top: 24pt; margin-bottom: 0pt; font-size: 14pt; }');
  });
  const g = { altezzaPagina: 1000, margineAlto: 100, margineBasso: 100, spazio: 10 };
  // righe di 20 pixel: lo spazio per il testo di una pagina è 800 (da 100 a 900), 40 righe
  const righe = (gruppi: Array<{ n: number; tieni?: boolean }>): Riga[] => {
    const out: Riga[] = []; let y = 100;
    gruppi.forEach((x, par) => { for (let k = 0; k < x.n; k++) { out.push({ alto: y, basso: y + 20, par, ...(x.tieni ? { tieni: true } : {}) }); y += 20; } });
    return out;
  };
  test('un titolo in fondo alla pagina va alla pagina dopo con il suo paragrafo', () => {
    const r = righe([{ n: 39 }, { n: 1, tieni: true }, { n: 3 }]);
    const imp = impagina(r, g);
    expect(imp.paginaDiRiga[39]).toBe(1);
    expect(imp.salti[0].riga).toBe(39);
  });
  test('una riga sola in fondo (orfana) o in cima (vedova) non resta: il paragrafo va o si divide con almeno due righe', () => {
    const orfana = impagina(righe([{ n: 39 }, { n: 5 }]), g);
    expect(orfana.salti[0].riga).toBe(39);
    const vedova = impagina(righe([{ n: 37 }, { n: 4 }]), g);
    expect(vedova.salti[0].riga).toBe(39);
    expect(vedova.paginaDiRiga.slice(37)).toEqual([0, 0, 1, 1]);
  });
});
