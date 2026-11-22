// Un file .xlsm di prova costruito da zero (per T572 e per la prova fisica giro_55): due fogli, una casella combinata con la voce scelta, quattro
// pulsanti con macro (vai a un foglio, apri il link di N1 e di N4, una macro con un'istruzione non ammessa), link a un file e a una cartella
// accanto al foglio, a un percorso di rete e a un programma (questi due si scartano), un controllo con elenco rotto e una casella di spunta.
import { scriviZip } from '@comune/formati/zip';
import { scriviCfb } from '@comune/formati/cfb-scrivi';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const latino = (s: string): Uint8Array => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));

/** Un contenitore compresso [MS-OVBA] fatto solo di letterali (valido; per testi fino a circa 3600 byte). */
export function comprimiLetterali(dati: Uint8Array): Uint8Array {
  const corpo: number[] = [];
  for (let i = 0; i < dati.length; i += 8) { corpo.push(0x00); for (let k = i; k < Math.min(i + 8, dati.length); k++) corpo.push(dati[k]!); }
  const misura = corpo.length + 2;
  if (misura > 4098) throw new Error('testo troppo lungo per la prova');
  const intestazione = 0xb000 | (misura - 3);
  return Uint8Array.from([0x01, intestazione & 0xff, intestazione >> 8, ...corpo]);
}

function record(id: number, dati: Uint8Array, misuraDichiarata = dati.length): number[] {
  return [id & 0xff, id >> 8, misuraDichiarata & 0xff, (misuraDichiarata >> 8) & 0xff, (misuraDichiarata >> 16) & 0xff, misuraDichiarata >>> 24, ...dati];
}
const u16 = (n: number) => Uint8Array.from([n & 0xff, n >> 8]);
const u32 = (n: number) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]);
const utf16 = (s: string) => { const b = new Uint8Array(s.length * 2); [...s].forEach((c, i) => { b[i * 2] = c.charCodeAt(0) & 0xff; b[i * 2 + 1] = c.charCodeAt(0) >> 8; }); return b; };

/** Un vbaProject.bin con i moduli dati: dir compresso con PROJECTVERSION (la sua misura «sbagliata»), nomi, flussi e posizioni. */
export function progettoVba(moduli: Record<string, string>): Uint8Array {
  const dir: number[] = [...record(0x0003, u16(1252)), ...record(0x0009, Uint8Array.from([1, 0, 0, 0, 2, 0]), 4)];
  const flussi: Array<{ percorso: string; dati: Uint8Array }> = [];
  for (const [nome, codice] of Object.entries(moduli)) {
    dir.push(...record(0x0019, latino(nome)), ...record(0x0047, utf16(nome)), ...record(0x001a, latino(nome)), ...record(0x0032, utf16(nome)), ...record(0x0031, u32(0)), ...record(0x002b, new Uint8Array()));
    flussi.push({ percorso: `VBA/${nome}`, dati: comprimiLetterali(latino(codice)) });
  }
  return scriviCfb([{ percorso: 'VBA/dir', dati: comprimiLetterali(Uint8Array.from(dir)) }, ...flussi]);
}

export const MODULO = [
  'Attribute VB_Name = "Modulo1"',
  'Sub apriScheda()',
  "' apre la scheda della società",
  '    Range("N1").Select',
  '    Selection.Hyperlinks(1).Follow NewWindow:=False, _',
  '        AddHistory:=True',
  'End Sub',
  'Sub vaiDati()',
  '    Sheets("dati").Select',
  'End Sub',
  'Sub cartella()',
  '    Range("N4").Select',
  '    Selection.Hyperlinks(1).Follow',
  'End Sub',
  'Sub pericolosa()',
  '    Sheets("dati").Select',
  '    Shell "cmd.exe /c del *.*"',
  'End Sub',
].join('\r\n');

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"';
const controllo = (forma: number, id: string, nome: string, da: [number, number, number, number], a: [number, number, number, number], macro = '') =>
  `<mc:AlternateContent><mc:Choice Requires="x14"><control shapeId="${forma}" r:id="${id}" name="${nome}"><controlPr defaultSize="0"${macro ? ` macro="${macro}"` : ''}><anchor moveWithCells="1"><from><xdr:col>${da[0]}</xdr:col><xdr:colOff>${da[1]}</xdr:colOff><xdr:row>${da[2]}</xdr:row><xdr:rowOff>${da[3]}</xdr:rowOff></from><to><xdr:col>${a[0]}</xdr:col><xdr:colOff>${a[1]}</xdr:colOff><xdr:row>${a[2]}</xdr:row><xdr:rowOff>${a[3]}</xdr:rowOff></to></anchor></controlPr></control></mc:Choice><mc:Fallback><control shapeId="${forma}" r:id="${id}" name="${nome}"/></mc:Fallback></mc:AlternateContent>`;
const proprieta = (attributi: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" ${attributi}/>`;
export const VML = `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
 <v:shape id="_x0000_s1026" type="#_x0000_t201" o:button="t"><v:textbox style='mso-direction-alt:auto'><div style='text-align:center'><font face="Calibri" size="440" color="#FF0000"><b>SOCIETA&apos;</b></font></div></v:textbox>
  <x:ClientData ObjectType="Button"><x:Anchor> 2, 0, 3, 0, 3, 0, 5, 0</x:Anchor><x:FmlaMacro>[0]!apriScheda</x:FmlaMacro></x:ClientData></v:shape>
 <v:shape id="_x0000_s1030" type="#_x0000_t201" o:button="t"><v:textbox><div><font size="220">DATI</font></div></v:textbox><x:ClientData ObjectType="Button"><x:FmlaMacro>[0]!vaiDati</x:FmlaMacro></x:ClientData></v:shape>
 <v:shape id="_x0000_s1031" type="#_x0000_t201" o:button="t"><v:textbox><div><font size="220">cartella</font></div></v:textbox><x:ClientData ObjectType="Button"><x:FmlaMacro>[0]!cartella</x:FmlaMacro></x:ClientData></v:shape>
 <v:shape id="_x0000_s1027" type="#_x0000_t201" o:button="t"><v:textbox style='layout-flow:vertical;mso-layout-flow-alt:bottom-to-top'><div><font size="220">Pulisci<br>tutto</font></div></v:textbox>
  <x:ClientData ObjectType="Button"><x:FmlaMacro>[0]!pericolosa</x:FmlaMacro></x:ClientData></v:shape>
</xml>`;

export async function xlsmDiProva(): Promise<Uint8Array> {
  const foglio1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><sheetData>
    <row r="1"><c r="N1" t="inlineStr"><is><t>Scheda società</t></is></c></row><row r="2"><c r="N2" t="inlineStr"><is><t>Rete</t></is></c></row>
    <row r="3"><c r="N3" t="inlineStr"><is><t>Programma</t></is></c></row><row r="4"><c r="N4" t="inlineStr"><is><t>Cartella clienti</t></is></c></row></sheetData>
    <hyperlinks><hyperlink ref="N1" r:id="rIdH1"/><hyperlink ref="N2" r:id="rIdH2"/><hyperlink ref="N3" r:id="rIdH3"/><hyperlink ref="N4" r:id="rIdH4"/></hyperlinks>
    <legacyDrawing r:id="rIdV"/>
    <mc:AlternateContent><mc:Choice Requires="x14"><controls>
      ${controllo(1025, 'rIdC1', 'Drop Down 1', [8, 0, 9, 0], [9, 0, 10, 0])}
      ${controllo(1026, 'rIdC2', 'Button 2', [2, 0, 3, 0], [3, 0, 5, 0], '[0]!apriScheda')}
      ${controllo(1027, 'rIdC3', 'Button 3', [5, 0, 3, 0], [6, 0, 5, 0], '[0]!pericolosa')}
      ${controllo(1028, 'rIdC4', 'Drop Down 4', [8, 0, 10, 0], [9, 0, 11, 0])}
      ${controllo(1029, 'rIdC5', 'Check Box 5', [10, 0, 1, 0], [11, 0, 2, 0])}
      ${controllo(1030, 'rIdC6', 'Button 6', [0, 0, 3, 0], [1, 0, 5, 0], '[0]!vaiDati')}
      ${controllo(1031, 'rIdC7', 'Button 7', [7, 0, 3, 0], [8, 0, 5, 0], '[0]!cartella')}
    </controls></mc:Choice></mc:AlternateContent></worksheet>`;
  const rel = (id: string, tipo: string, target: string, esterno = false) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${target}"${esterno ? ' TargetMode="External"' : ''}/>`;
  const relFoglio1 = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    ${rel('rIdH1', 'hyperlink', "MODULI\\1%20Scheda%20SOCIETA'.docx", true)}${rel('rIdH2', 'hyperlink', '\\\\server\\condivisa\\x.docx', true)}${rel('rIdH3', 'hyperlink', 'strumenti\\avvia.exe', true)}${rel('rIdH4', 'hyperlink', 'CLIENTI_PROVA', true)}
    ${rel('rIdV', 'vmlDrawing', '../drawings/vmlDrawing1.vml')}
    ${[1, 2, 3, 4, 5, 6, 7].map((k) => rel(`rIdC${k}`, 'ctrlProp', `../ctrlProps/ctrlProp${k}.xml`)).join('')}</Relationships>`;
  const foglio2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><sheetData>
    ${['carta identità', 'patente', 'passaporto'].map((v, i) => `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>${v}</t></is></c></row>`).join('')}</sheetData></worksheet>`;
  return scriviZip([
    { nome: '[Content_Types].xml', dati: enc('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
    { nome: '_rels/.rels', dati: enc(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`) },
    { nome: 'xl/workbook.xml', dati: enc(`<?xml version="1.0" encoding="UTF-8"?><workbook ${NS}><sheets><sheet name="riepilogo" sheetId="1" r:id="rId1"/><sheet name="dati" sheetId="2" r:id="rId2"/></sheets></workbook>`) },
    { nome: 'xl/_rels/workbook.xml.rels', dati: enc(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'worksheet', 'worksheets/sheet1.xml')}${rel('rId2', 'worksheet', 'worksheets/sheet2.xml')}</Relationships>`) },
    { nome: 'xl/worksheets/sheet1.xml', dati: enc(foglio1) },
    { nome: 'xl/worksheets/_rels/sheet1.xml.rels', dati: enc(relFoglio1) },
    { nome: 'xl/worksheets/sheet2.xml', dati: enc(foglio2) },
    { nome: 'xl/drawings/vmlDrawing1.vml', dati: enc(VML) },
    { nome: 'xl/ctrlProps/ctrlProp1.xml', dati: enc(proprieta('objectType="Drop" dropStyle="combo" fmlaRange="dati!$A$1:$A$4" sel="3"')) },
    { nome: 'xl/ctrlProps/ctrlProp2.xml', dati: enc(proprieta('objectType="Button"')) },
    { nome: 'xl/ctrlProps/ctrlProp3.xml', dati: enc(proprieta('objectType="Button"')) },
    { nome: 'xl/ctrlProps/ctrlProp4.xml', dati: enc(proprieta('objectType="Drop" fmlaRange="#REF!" sel="1"')) },
    { nome: 'xl/ctrlProps/ctrlProp5.xml', dati: enc(proprieta('objectType="CheckBox" checked="Checked"')) },
    { nome: 'xl/ctrlProps/ctrlProp6.xml', dati: enc(proprieta('objectType="Button"')) },
    { nome: 'xl/ctrlProps/ctrlProp7.xml', dati: enc(proprieta('objectType="Button"')) },
    { nome: 'xl/vbaProject.bin', dati: progettoVba({ Modulo1: MODULO }) },
  ]);
}

