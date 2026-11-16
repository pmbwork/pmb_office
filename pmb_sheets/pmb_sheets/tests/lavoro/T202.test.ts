import { describe, it, expect } from 'vitest';
import { scriviZip } from '@comune/formati/zip';
import { codiceFormatoFogli, eFormatoData, leggiXlsx, senzaPrefissi } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { foglioVuoto, type FoglioScambio, type Scambio } from '../../src/formati/scambio';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const TIPO = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const codifica = new TextEncoder();

interface Opzioni {
  /** contenuto di ogni foglio (dentro <worksheet>) */
  fogli?: string[];
  nomi?: string[];
  stili?: string;
  stringhe?: string;
  /** elementi prima di <sheets> nella cartella di lavoro (workbookPr, bookViews) */
  prima?: string;
  /** elementi dopo <sheets> */
  dopo?: string;
  extra?: Record<string, string>;
  /** tipo della relazione dei fogli, per provare chartsheet e simili */
  tipi?: string[];
  /** parti da togliere dal pacchetto */
  senza?: string[];
}

async function pacchetto(parti: Record<string, string>): Promise<Uint8Array> {
  return scriviZip(Object.entries(parti).map(([nome, testo]) => ({ nome, dati: codifica.encode(testo) })));
}

async function xlsx(o: Opzioni = {}): Promise<Uint8Array> {
  const fogli = o.fogli ?? [`<sheetData/>`];
  const nomi = o.nomi ?? fogli.map((_, i) => `Foglio${i + 1}`);
  const parti: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${TIPO}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook ${NS} ${NS_R}>${o.prima ?? ''}<sheets>${nomi.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${o.dopo ?? ''}</workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${TIPO}/${o.tipi?.[i] ?? 'worksheet'}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  fogli.forEach((f, i) => { parti[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet ${NS}>${f}</worksheet>`; });
  if (o.stili) parti['xl/styles.xml'] = o.stili;
  if (o.stringhe) parti['xl/sharedStrings.xml'] = `<sst ${NS}>${o.stringhe}</sst>`;
  const tutte = { ...parti, ...o.extra };
  for (const n of o.senza ?? []) delete tutte[n];
  return pacchetto(tutte);
}

function stiliXml(p: { numFmts?: string; fonts?: string; fills?: string; borders?: string; xfs: string }): string {
  return `<styleSheet ${NS}>${p.numFmts ? `<numFmts>${p.numFmts}</numFmts>` : ''}<fonts>${p.fonts ?? '<font><sz val="11"/><name val="Calibri"/></font>'}</fonts>`
    + `<fills><fill><patternFill patternType="none"/></fill>${p.fills ?? ''}</fills><borders>${p.borders ?? '<border><left/><right/><top/><bottom/><diagonal/></border>'}</borders>`
    + `<cellXfs>${p.xfs}</cellXfs></styleSheet>`;
}
const XF0 = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>';

async function leggi(o: Opzioni) { return (await leggiXlsx(await xlsx(o))); }
async function primo(o: Opzioni): Promise<FoglioScambio> { return (await leggi(o)).scambio.fogli[0]; }
const dati = (righe: string): string => `<sheetData>${righe}</sheetData>`;
function foglio(nome: string, extra: Partial<FoglioScambio> = {}): FoglioScambio { return { ...foglioVuoto(nome), ...extra }; }
function scambio(fogli: FoglioScambio[], attivo?: string): Scambio { return { fogli, foglioAttivo: attivo ?? fogli[0].nome }; }
async function andataERitorno(s: Scambio) { return (await leggiXlsx(await scriviXlsx(s))).scambio; }

describe('T202 lettura di file .xlsx', () => {
  it('andata e ritorno: quello che scrive il nostro scrittore si rilegge uguale', async () => {
    const a = foglio('Dati', {
      celle: { A1: 'Nome', B1: 'Importo', A2: 'Mario', B2: '12.5', C2: '=B2*2', A3: 'vero', B3: 'TRUE', C3: '-4', D3: '=MAXIFS(B2:B3,A2:A3,"x")', A4: '007' },
      stili: {
        A1: { bold: true, italic: true, underline: true, strike: true, fontFamily: 'Roboto', fontSize: 14, color: '#ff0000', fill: '#ffff00', hAlign: 'center', vAlign: 'middle', wrap: true },
        B2: { numFmt: '€#,##0.00' }, C2: { numFmt: '0.00%' }, D2: { numFmt: 'dd/mm/yyyy' }, A4: { numFmt: '@' },
        B1: { borders: { top: { style: 'thin', color: '#000000' }, left: { style: 'dashed', color: '#00ff00' }, bottom: { style: 'medium', color: '#0000ff' } } },
      },
      larghezze: { 1: 120, 2: 90 }, altezze: { 1: 30 }, unioni: [{ startRow: 6, endRow: 7, startCol: 1, endCol: 3 }], righeCongelate: 1, colonneCongelate: 2,
    });
    const b = foglio('Altro', { celle: { A1: "x'y", B1: '  spazi  ' } });
    const s = scambio([a, b], 'Altro');
    expect(await andataERitorno(s)).toEqual(s);
  });

  it('andata e ritorno con stili di riga e di colonna', async () => {
    const s = scambio([foglio('Foglio1', { celle: { A2: 'x' }, stiliRiga: { 2: { bold: true } }, stiliColonna: { 3: { fill: '#112233' } } })]);
    const r = (await andataERitorno(s)).fogli[0];
    expect(r.stiliRiga).toEqual({ 2: { bold: true } });
    expect(r.stiliColonna).toEqual({ 3: { fill: '#112233' } });
    expect(r.stili).toEqual({ A2: { bold: true } });
  });

  it('i testi che sembrano numeri o booleani restano testi grazie al formato Testo', async () => {
    const f = await primo({
      stringhe: '<si><t>123</t></si><si><t>true</t></si><si><t>ciao</t></si><si><t>=A1</t></si>',
      stili: stiliXml({ fonts: '<font><sz val="11"/><name val="Calibri"/></font>', xfs: `${XF0}<xf numFmtId="2" fontId="0" fillId="0" borderId="0"/>` }),
      fogli: [dati('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>0</v></c><c r="E1" t="s" s="1"><v>0</v></c><c r="F1" t="inlineStr"><is><t>123</t></is></c><c r="G1" t="str"><v>45</v></c><c r="H1" t="n"><v>45</v></c></row>')],
    });
    expect(f.celle).toEqual({ A1: '123', B1: 'true', C1: 'ciao', D1: '123', E1: '123', F1: '123', G1: '45', H1: '45' });
    expect(f.stili).toEqual({ A1: { numFmt: '@' }, B1: { numFmt: '@' }, D1: { numFmt: '@' }, E1: { numFmt: '@' }, F1: { numFmt: '@' }, G1: { numFmt: '@' } });
  });

  it('tipi di cella: testo da formula, booleano, errore, data ISO, testo in linea, numeri', async () => {
    const f = await primo({
      fogli: [dati(
        '<row r="1"><c r="A1" t="str"><v>risultato</v></c><c r="B1" t="b"><v>1</v></c><c r="C1" t="b"><v>0</v></c><c r="D1" t="e"><v>#DIV/0!</v></c><c r="E1" t="b"><v>true</v></c></row>'
        + '<row r="2"><c r="A2" t="d"><v>2024-02-29</v></c><c r="B2" t="d"><v>2024-02-29T12:00:00</v></c>'
        + '<c r="C2" t="inlineStr"><is><r><t>a</t></r><r><t xml:space="preserve"> b </t></r></is></c><c r="D2"><v>1E-3</v></c></row>'
        + '<row r="3"><c r="A3" t="n"><v> -5 </v></c><c r="B3"><v>abc</v></c><c r="C3"><v></v></c><c r="D3"><v>0.1</v></c></row>',
      )],
    });
    expect(f.celle).toEqual({ A1: 'risultato', B1: 'TRUE', C1: 'FALSE', D1: '#DIV/0!', E1: 'TRUE', A2: '45351', B2: '45351.5', C2: 'a b ', D2: '0.001', A3: '-5', B3: 'abc', D3: '0.1' });
    expect(f.stili).toEqual({});
  });

  it('stringhe condivise: frammenti formattati uniti, pronuncia scartata, spazi tenuti, vuote ignorate', async () => {
    const f = await primo({
      stringhe: '<si><r><rPr><b/></rPr><t>Ciao </t></r><r><t>mondo</t></r><rPh sb="0" eb="1"><t>ふりがな</t></rPh></si><si><t xml:space="preserve">  x  </t></si><si><t></t></si>',
      fogli: [dati('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>9</v></c></row>')],
    });
    expect(f.celle).toEqual({ A1: 'Ciao mondo', B1: '  x  ' });
  });

  it('formule: senza prefissi _xlfn., senza valore in cache, con funzioni recenti', async () => {
    const f = await primo({
      fogli: [dati(
        '<row r="1"><c r="A1"><f>SUM(B1:B3)</f><v>6</v></c><c r="B1"><f>_xlfn.MAXIFS(A1:A3,B1:B3,"_xlfn.x")</f><v>3</v></c><c r="C1" t="str"><f>_xlfn._xlws.FILTER(A1:A3,B1:B3)</f><v>zz</v></c>'
        + '<c r="D1"><f t="array" ref="D1:D2">TRANSPOSE(A1:B1)</f></c><c r="E1"><f></f><v>7</v></c></row>',
      )],
    });
    expect(f.celle).toEqual({ A1: '=SUM(B1:B3)', B1: '=MAXIFS(A1:A3,B1:B3,"_xlfn.x")', C1: '=FILTER(A1:A3,B1:B3)', D1: '=TRANSPOSE(A1:B1)', E1: '7' });
  });

  it('senzaPrefissi toglie solo fuori dalle virgolette', () => {
    expect(senzaPrefissi('_xlfn.IFS(1,2)+"_xlfn.a"&"b""_xlws.c"')).toBe('IFS(1,2)+"_xlfn.a"&"b""_xlws.c"');
    expect(senzaPrefissi('SUM(A1)')).toBe('SUM(A1)');
  });

  it('formule condivise: i riferimenti relativi si spostano, gli assoluti no', async () => {
    const f = await primo({
      fogli: [dati(
        '<row r="1"><c r="B1"><f t="shared" ref="B1:C3" si="0">$A$1+A1</f></c><c r="C1"><f t="shared" si="0"/></c></row>'
        + '<row r="2"><c r="B2"><f t="shared" si="0"/><v>5</v></c><c r="C2"><f t="shared" si="0"/></c></row>'
        + '<row r="3"><c r="B3"><f t="shared" si="1"/><v>9</v></c></row>',
      )],
    });
    expect(f.celle).toEqual({ B1: '=$A$1+A1', C1: '=$A$1+B1', B2: '=$A$1+A2', C2: '=$A$1+B2', B3: '9' });
  });

  it('date: il numero seriale resta e il formato lo dice; con il calendario 1904 il seriale si corregge', async () => {
    const stili = stiliXml({ xfs: `${XF0}<xf numFmtId="14" fontId="0" fillId="0" borderId="0"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0"/>` });
    const righe = dati('<row r="1"><c r="A1" s="1"><v>45351</v></c><c r="B1" s="2"><v>45351</v></c><c r="C1"><v>45351</v></c></row>');
    const normale = await primo({ stili, fogli: [righe] });
    expect(normale.celle).toEqual({ A1: '45351', B1: '45351', C1: '45351' });
    expect(normale.stili).toEqual({ A1: { numFmt: 'dd/mm/yyyy' }, B1: { numFmt: '0.00' } });
    const righeMac = dati('<row r="1"><c r="A1" s="1"><v>43889</v></c><c r="B1" s="2"><v>43889</v></c><c r="C1"><v>43889</v></c></row>');
    const mac = await primo({ stili, prima: '<workbookPr date1904="1"/>', fogli: [righeMac] });
    expect(mac.celle).toEqual({ A1: '45351', B1: '43889', C1: '43889' });
  });

  it('formati dei numeri: integrati, personalizzati, euro e General', async () => {
    const stili = stiliXml({
      numFmts: '<numFmt numFmtId="164" formatCode="[$€-2] #,##0.00"/><numFmt numFmtId="165" formatCode="&quot;€&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="General"/><numFmt numFmtId="167" formatCode="0.0&quot; m&quot;"/><numFmt numFmtId="168" formatCode=""/><numFmt numFmtId="14" formatCode="yyyy-mm-dd"/>',
      xfs: [0, 1, 2, 4, 9, 10, 11, 22, 49, 164, 165, 166, 167, 168, 14].map((id) => `<xf numFmtId="${id}" fontId="0" fillId="0" borderId="0"/>`).join(''),
    });
    const celle = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => `<c r="${String.fromCharCode(65 + i)}1" s="${i}"><v>1</v></c>`).join('');
    const f = await primo({ stili, fogli: [dati(`<row r="1">${celle}</row>`)] });
    expect(f.stili).toEqual({
      B1: { numFmt: '0' }, C1: { numFmt: '0.00' }, D1: { numFmt: '#,##0.00' }, E1: { numFmt: '0%' }, F1: { numFmt: '0.00%' }, G1: { numFmt: '0.00E+00' }, H1: { numFmt: 'dd/mm/yyyy hh:mm' },
      I1: { numFmt: '@' }, J1: { numFmt: '€ #,##0.00' }, K1: { numFmt: '€#,##0.00' }, M1: { numFmt: '0.0" m"' }, O1: { numFmt: 'yyyy-mm-dd' },
    });
  });

  it('codiceFormatoFogli ed eFormatoData', () => {
    expect(codiceFormatoFogli('"€"#,##0.00')).toBe('€#,##0.00');
    expect(codiceFormatoFogli('[$€-407] 0')).toBe('€ 0');
    expect(codiceFormatoFogli('[$$-409] 0')).toBe('[$$-409] 0');
    expect(codiceFormatoFogli('0.00')).toBe('0.00');
    for (const d of ['dd/mm/yyyy', 'hh:mm:ss', 'mm:ss', '[h]:mm', 'h:mm AM/PM', 'd-mmm-yy']) expect(eFormatoData(d), d).toBe(true);
    for (const d of ['0.00', '#,##0', '0%', '0.00E+00', '@', 'General', '"giorni" 0', '[Red]0', '0\\d', '# ?/?']) expect(eFormatoData(d), d).toBe(false);
  });

  it('carattere: stili, nome e dimensione solo se diversi dal carattere di base del file', async () => {
    const stili = stiliXml({
      fonts: '<font><sz val="11"/><name val="Calibri"/></font>'
        + '<font><b/><i/><u/><strike/><sz val="11"/><color rgb="FF112233"/><name val="Calibri"/></font>'
        + '<font><sz val="14"/><color theme="1"/><name val="Arial"/></font>'
        + '<font><b val="0"/><i val="false"/><u val="none"/><strike val="0"/><sz val="11"/><name val="Calibri"/></font>'
        + '<font><u val="double"/><sz val="0"/><color rgb="00A1B2C3"/><name val=""/></font>'
        + '<font><sz val="11"/><color rgb="12AB34"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="1234567"/><name val="Calibri"/></font>',
      xfs: [0, 1, 2, 3, 4, 5, 6].map((i) => `<xf numFmtId="0" fontId="${i}" fillId="0" borderId="0"/>`).join(''),
    });
    const f = await primo({ stili, fogli: [dati('<row r="1"><c r="A1" s="0"/><c r="B1" s="1"/><c r="C1" s="2"/><c r="D1" s="3"/><c r="E1" s="4"/><c r="F1" s="5"/><c r="G1" s="6"/></row>')] });
    expect(f.stili).toEqual({
      B1: { bold: true, italic: true, underline: true, strike: true, color: '#112233' },
      C1: { fontFamily: 'Arial', fontSize: 14 },
      E1: { underline: true, color: '#a1b2c3' },
      F1: { color: '#12ab34' },
    });
  });

  it('riempimento: solo pieno e con colore esplicito', async () => {
    const stili = stiliXml({
      fills: '<fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill>'
        + '<fill><patternFill patternType="solid"><fgColor theme="4"/></patternFill></fill><fill><patternFill patternType="darkGray"><fgColor rgb="FF123456"/></patternFill></fill>',
      xfs: [0, 1, 2, 3, 4].map((i) => `<xf numFmtId="0" fontId="0" fillId="${i}" borderId="0"/>`).join(''),
    });
    const f = await primo({ stili, fogli: [dati('<row r="1"><c r="A1" s="0"/><c r="B1" s="1"/><c r="C1" s="2"/><c r="D1" s="3"/><c r="E1" s="4"/></row>')] });
    expect(f.stili).toEqual({ C1: { fill: '#ffff00' } });
  });

  it('bordi: stili convertiti, colore di riserva nero, lati senza stile ignorati', async () => {
    const lato = (n: string, st: string, col = '') => `<${n} style="${st}">${col}</${n}>`;
    const stili = stiliXml({
      borders: '<border><left/><right/><top/><bottom/><diagonal/></border>'
        + `<border>${lato('left', 'thin', '<color rgb="FFFF0000"/>')}${lato('right', 'thick')}${lato('top', 'hair', '<color theme="1"/>')}${lato('bottom', 'double')}</border>`
        + `<border>${lato('left', 'dotted')}${lato('right', 'mediumDashed')}${lato('top', 'none')}${lato('bottom', 'wavy')}</border>`,
      xfs: [0, 1, 2].map((i) => `<xf numFmtId="0" fontId="0" fillId="0" borderId="${i}"/>`).join(''),
    });
    const f = await primo({ stili, fogli: [dati('<row r="1"><c r="A1" s="0"/><c r="B1" s="1"/><c r="C1" s="2"/></row>')] });
    expect(f.stili).toEqual({
      B1: { borders: { left: { style: 'thin', color: '#ff0000' }, right: { style: 'medium', color: '#000000' }, top: { style: 'dashed', color: '#000000' }, bottom: { style: 'thin', color: '#000000' } } },
      C1: { borders: { left: { style: 'dashed', color: '#000000' }, right: { style: 'dashed', color: '#000000' } } },
    });
  });

  it('allineamento', async () => {
    const al = (a: string) => `<xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment ${a}/></xf>`;
    const stili = stiliXml({
      xfs: XF0 + al('horizontal="centerContinuous" vertical="center" wrapText="1"') + al('horizontal="general" vertical="justify"') + al('horizontal="right" vertical="top" wrapText="0"')
        + al('horizontal="left" vertical="bottom" wrapText="true"') + al('horizontal="justify"'),
    });
    const f = await primo({ stili, fogli: [dati('<row r="1"><c r="A1" s="1"/><c r="B1" s="2"/><c r="C1" s="3"/><c r="D1" s="4"/><c r="E1" s="5"/></row>')] });
    expect(f.stili).toEqual({
      A1: { hAlign: 'center', vAlign: 'middle', wrap: true }, C1: { hAlign: 'right', vAlign: 'top' }, D1: { hAlign: 'left', vAlign: 'bottom', wrap: true },
    });
  });

  it('una cella con stile inesistente o senza il file degli stili non dà errore; le celle vuote con stile restano', async () => {
    const f = await primo({ fogli: [dati('<row r="1"><c r="A1" s="99"><v>1</v></c><c r="B1" s="1"/></row>')] });
    expect(f.celle).toEqual({ A1: '1' });
    expect(f.stili).toEqual({});
    const g = await primo({
      stili: stiliXml({ xfs: `${XF0}<xf numFmtId="0" fontId="0" fillId="1" borderId="0"/>`, fills: '<fill><patternFill patternType="solid"><fgColor rgb="FF010203"/></patternFill></fill>' }),
      fogli: [dati('<row r="1"><c r="A1" s="1"/></row>')],
    });
    expect(g.celle).toEqual({});
    expect(g.stili).toEqual({ A1: { fill: '#010203' } });
  });

  it('gli stili letti sono copie: cambiarne uno non cambia gli altri', async () => {
    const f = await primo({
      stili: stiliXml({ fonts: '<font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>', xfs: `${XF0}<xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>` }),
      fogli: ['<cols><col min="1" max="2" width="9" style="1"/></cols>' + dati('<row r="1" s="1" customFormat="1"><c r="A1" s="1"/><c r="B1" s="1"/></row><row r="2" s="1" customFormat="1"/>')],
    });
    f.stili.A1.bold = false;
    expect(f.stili.B1.bold).toBe(true);
    expect(f.stiliRiga[1].bold).toBe(true);
    f.stiliRiga[1].bold = false;
    expect(f.stiliRiga[2].bold).toBe(true);
    expect(f.stiliColonna[1].bold).toBe(true);
    f.stiliColonna[1].bold = false;
    expect(f.stiliColonna[2].bold).toBe(true);
  });

  it('colonne: larghezza solo se esplicita, stile, intervalli, intervalli enormi ignorati', async () => {
    const stili = stiliXml({ fonts: '<font><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="11"/><name val="Calibri"/></font>', xfs: `${XF0}<xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>` });
    const f = await primo({
      stili,
      fogli: [`<cols><col min="1" max="1" width="16.43" customWidth="1"/><col min="2" max="2" width="20"/><col min="3" max="3" width="8.43" style="1"/>`
        + `<col min="5" max="7" width="10" customWidth="true" style="1"/><col min="1" max="16384" width="9" customWidth="1" style="1"/><col min="9" max="9" width="0" customWidth="1"/>`
        + `<col min="x" max="3" width="9" customWidth="1"/><col min="10" max="9" width="9" customWidth="1"/></cols>${dati('')}`],
    });
    expect(f.larghezze).toEqual({ 1: 120, 5: 75, 6: 75, 7: 75 });
    expect(f.stiliColonna).toEqual({ 3: { italic: true }, 5: { italic: true }, 6: { italic: true }, 7: { italic: true } });
  });

  it('righe: altezza in pixel solo se esplicita, stile di riga, numerazione senza attributi r', async () => {
    const stili = stiliXml({ fonts: '<font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>', xfs: `${XF0}<xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>` });
    const f = await primo({
      stili,
      fogli: [dati(
        '<row r="1" ht="30" customHeight="1"><c r="A1"><v>1</v></c></row><row r="2" ht="40"><c r="A2"><v>2</v></c></row>'
        + '<row r="3" s="1" customFormat="1"><c><v>3</v></c><c><v>4</v></c></row><row r="4" s="1"><c r="B4"><v>5</v></c></row><row><c><v>6</v></c></row>',
      )],
    });
    expect(f.altezze).toEqual({ 1: 40 });
    expect(f.stiliRiga).toEqual({ 3: { bold: true } });
    expect(f.celle).toEqual({ A1: '1', A2: '2', A3: '3', B3: '4', B4: '5', A5: '6' });
  });

  it('celle fuori dai limiti ignorate', async () => {
    const f = await primo({ fogli: [dati('<row r="1"><c r="XFD1"><v>1</v></c><c r="XFE1"><v>2</v></c></row><row r="1048577"><c r="A1048577"><v>3</v></c></row><row r="2"><c r="A2"><v>4</v></c><c r="???"><v>5</v></c></row>')] });
    expect(f.celle).toEqual({ XFD1: '1', A2: '4' });
  });

  it('celle unite e righe/colonne bloccate', async () => {
    const f = await primo({
      fogli: [`<sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="3" topLeftCell="C4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>${dati('')}`
        + '<mergeCells count="5"><mergeCell ref="A1:B2"/><mergeCell ref="C3"/><mergeCell ref="C3:C3"/><mergeCell ref="E5:D4"/><mergeCell ref="zz"/></mergeCells>'],
    });
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 2 }, { startRow: 4, endRow: 5, startCol: 4, endCol: 5 }]);
    expect(f.righeCongelate).toBe(3);
    expect(f.colonneCongelate).toBe(2);
  });

  it('un pannello non bloccato non è un blocco, frozenSplit sì', async () => {
    const vista = (p: string) => `<sheetViews><sheetView workbookViewId="0">${p}</sheetView></sheetViews>${dati('')}`;
    const diviso = await primo({ fogli: [vista('<pane xSplit="2" ySplit="3" state="split"/>')] });
    expect([diviso.righeCongelate, diviso.colonneCongelate]).toEqual([0, 0]);
    const misto = await primo({ fogli: [vista('<pane ySplit="1" state="frozenSplit"/>')] });
    expect([misto.righeCongelate, misto.colonneCongelate]).toEqual([1, 0]);
    expect((await primo({ fogli: [dati('')] })).righeCongelate).toBe(0);
  });

  it('foglio attivo, fogli che non sono fogli di calcolo, parti mancanti', async () => {
    const tre = await leggi({ nomi: ['A', 'Grafico', 'B'], tipi: ['worksheet', 'chartsheet', 'worksheet'], fogli: [dati(''), '', dati('')], prima: '<bookViews><workbookView activeTab="2"/></bookViews>' });
    expect(tre.scambio.fogli.map((f) => f.nome)).toEqual(['A', 'B']);
    expect(tre.scambio.foglioAttivo).toBe('B');
    const fuori = await leggi({ nomi: ['A', 'B'], fogli: [dati(''), dati('')], prima: '<bookViews><workbookView activeTab="7"/></bookViews>' });
    expect(fuori.scambio.foglioAttivo).toBe('A');
    const attivoGrafico = await leggi({ nomi: ['A', 'Grafico'], tipi: ['worksheet', 'chartsheet'], fogli: [dati(''), ''], prima: '<bookViews><workbookView activeTab="1"/></bookViews>' });
    expect(attivoGrafico.scambio.foglioAttivo).toBe('A');
    const senzaVista = await leggi({ nomi: ['A', 'B'], fogli: [dati(''), dati('')] });
    expect(senzaVista.scambio.foglioAttivo).toBe('A');
    const mancante = await leggi({ nomi: ['A', 'B'], fogli: [dati('<row r="1"><c r="A1"><v>1</v></c></row>'), dati('')], senza: ['xl/worksheets/sheet2.xml'] });
    expect(mancante.scambio.fogli.map((f) => [f.nome, Object.keys(f.celle).length])).toEqual([['A', 1], ['B', 0]]);
  });

  it('percorsi: parte principale indicata dalle relazioni, destinazioni assolute e con ..', async () => {
    const b = await pacchetto({
      '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="p" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="x" Type="${TIPO}/officeDocument" Target="/doc/libro.xml"/></Relationships>`,
      'doc/libro.xml': `<workbook ${NS} ${NS_R}><sheets><sheet name="Uno" sheetId="1" r:id="a"/><sheet name="Due" sheetId="2" r:id="b"/></sheets></workbook>`,
      'doc/_rels/libro.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Type="${TIPO}/worksheet" Target="/fogli/uno.xml"/><Relationship Id="b" Type="${TIPO}/worksheet" Target="../fogli/due.xml"/><Relationship Id="s" Type="${TIPO}/sharedStrings" Target="testi.xml"/></Relationships>`,
      'fogli/uno.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`,
      'fogli/due.xml': `<worksheet ${NS}><sheetData><row r="1"><c r="A1"><v>2</v></c></row></sheetData></worksheet>`,
      'doc/testi.xml': `<sst ${NS}><si><t>dal percorso</t></si></sst>`,
    });
    const r = (await leggiXlsx(b)).scambio;
    expect(r.fogli.map((f) => [f.nome, f.celle.A1])).toEqual([['Uno', 'dal percorso'], ['Due', '2']]);
  });

  it('avvisi su ciò che non si importa', async () => {
    expect((await leggi({ fogli: [dati('')] })).avvisi).toEqual([]);
    const tutto = await leggi({
      fogli: [`${dati('')}<autoFilter ref="A1:B5"/><hyperlinks><hyperlink ref="A1" r:id="rId9"/></hyperlinks>`],
      dopo: '<definedNames><definedName name="x">A1</definedName></definedNames>',
      extra: { 'xl/charts/chart1.xml': '<c/>', 'xl/pivotTables/pivotTable1.xml': '<p/>' },
    });
    expect(tutto.avvisi).toEqual([
      'Grafici e disegni del file non sono stati importati.',
      'Le tabelle pivot del file non sono state importate.',
      'Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).',
      'Alcuni collegamenti ipertestuali del file non sono stati importati (quelli dentro il file o con un indirizzo non ammesso).',
    ]);
    // un filtro automatico senza criteri ora si importa (Fase 49); un criterio per colore no, e lo si dice
    const colore = await leggi({ fogli: [`${dati('')}<autoFilter ref="A1:B5"><filterColumn colId="0"><colorFilter dxfId="0"/></filterColumn></autoFilter>`] });
    expect(colore.avvisi.join(' ')).toContain('criteri dei filtri automatici');
    const nomi = (d: string) => leggi({ fogli: [dati('')], dopo: d }).then((r) => r.avvisi);
    expect(await nomi('<definedNames/>')).toEqual([]);
    expect(await nomi('<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">A1:B2</definedName></definedNames>')).toEqual([]);
    expect(await nomi('<definedNames><definedName name="_xlnm.Print_Area">A1</definedName><definedName name="tasse">B1</definedName></definedNames>')).toEqual(['Un nome definito del file non è stato importato (non è un intervallo semplice di un foglio).']);
    // un'immagine o un disegno che nessun foglio cita non fa perdere niente di visibile: niente avviso; un grafico sì
    expect((await leggi({ fogli: [dati('')], extra: { 'xl/media/image1.png': 'x' } })).avvisi).toEqual([]);
    expect((await leggi({ fogli: [dati('')], extra: { 'xl/drawings/drawing1.xml': '<d/>' } })).avvisi).toEqual([]);
    expect((await leggi({ fogli: [dati('')], extra: { 'xl/charts/chart1.xml': '<c/>' } })).avvisi).toEqual(['Grafici e disegni del file non sono stati importati.']);
  });

  it('file non validi: errori chiari', async () => {
    await expect(leggiXlsx(codifica.encode('questo non è un file zip, è solo testo lungo abbastanza'))).rejects.toThrow(/^File \.xlsx non valido: /);
    await expect(leggiXlsx(new Uint8Array(0))).rejects.toThrow(/^File \.xlsx non valido: /);
    await expect(leggiXlsx(await pacchetto({ 'altro.txt': 'ciao' }))).rejects.toThrow(/^File \.xlsx non valido: manca la cartella di lavoro$/);
    await expect(leggiXlsx(await xlsx({ nomi: [], fogli: [] }))).rejects.toThrow(/^File \.xlsx non valido: nessun foglio$/);
    await expect(leggiXlsx(await xlsx({ fogli: ['<sheetData><row></sheetData>'] }))).rejects.toThrow(/^File \.xlsx non valido: XML non valido/);
    await expect(leggiXlsx(await xlsx({ fogli: [dati('')], nomi: ['A'], extra: { 'xl/workbook.xml': '<workbook' } }))).rejects.toThrow(/^File \.xlsx non valido: /);
  });
});
