// T573: colori del tema e a indice dei file di Excel (segnalazione del 2026-11-22, «graficamente è starato»: le colonne colorate con il tema
// di Excel risultavano bianche, perché pmb_sheets leggeva solo il colore scritto rgb="FFRRGGBB").
import { describe, expect, test } from 'vitest';
import { analizzaXml } from '@comune/formati/xml';
import { scriviZip } from '@comune/formati/zip';
import { applicaTinta, coloreExcel, leggiTavolozza } from '../../src/formati/xlsx-colori';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';

const TEMA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:clrScheme name="Office">
  <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
  <a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>
  <a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>
</a:clrScheme></a:themeElements></a:theme>`;
const nodo = (attr: string) => analizzaXml(`<color ${attr}/>`);

describe('T573: colori del tema e a indice di Excel', () => {
  const tav = leggiTavolozza(analizzaXml(TEMA), undefined);

  test('tavolozza: indici del tema con chiari e scuri scambiati (0 = lt1, 1 = dk1), accenti da 4', () => {
    expect(tav.tema.slice(0, 4)).toEqual(['#ffffff', '#000000', '#eeece1', '#1f497d']);
    expect(tav.tema[6]).toBe('#9bbb59');
    expect(tav.indici[22]).toBe('#c0c0c0');
  });

  test('sfumature come Excel (tema Office: accento 3 più chiaro 40%, accento 6 più chiaro 40% e più scuro 25%)', () => {
    expect(applicaTinta('#9bbb59', 0.39997558519241921)).toBe('#c3d69b');
    expect(applicaTinta('#f79646', 0.39997558519241921)).toBe('#fac090');
    expect(applicaTinta('#f79646', -0.249977111117893)).toBe('#e46c0a');
    expect(applicaTinta('#123456', 0)).toBe('#123456');
  });

  test('un colore dal file: scritto, del tema con sfumatura, a indice, automatico', () => {
    expect(coloreExcel(nodo('rgb="FF92D050"'), tav)).toBe('#92d050');
    expect(coloreExcel(nodo('theme="6" tint="0.39997558519241921"'), tav)).toBe('#c3d69b');
    expect(coloreExcel(nodo('indexed="10"'), tav)).toBe('#ff0000');
    expect(coloreExcel(nodo('indexed="64"'), tav)).toBeUndefined();
    expect(coloreExcel(nodo('auto="1"'), tav)).toBeUndefined();
    expect(coloreExcel(nodo('theme="6"'), undefined)).toBeUndefined(); // senza tavolozza non si inventa
    // tavolozza a indice cambiata nel file (styles.xml, <colors><indexedColors>)
    const propria = leggiTavolozza(undefined, analizzaXml('<styleSheet><colors><indexedColors><rgbColor rgb="FF112233"/></indexedColors></colors></styleSheet>'));
    expect(coloreExcel(nodo('indexed="0"'), propria)).toBe('#112233');
    expect(propria.tema[6]).toBe('#9bbb59'); // tema di Office se il file non ha il suo
  });

  test('il file: sfondo del tema nella cella, testo del tema 1 automatico (si legge anche con il tema scuro)', async () => {
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const rel = (id: string, tipo: string, t: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${t}"/>`;
    const enc = (s: string) => new TextEncoder().encode(s);
    const stili = `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${NS}>
      <fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><sz val="11"/><color theme="5" tint="-0.25"/><name val="Calibri"/></font></fonts>
      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="6" tint="0.39997558519241921"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="1"><border/></borders><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="0" fillId="2" borderId="0"/><xf fontId="1" fillId="0" borderId="0"/></cellXfs></styleSheet>`;
    const foglio = `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetPr><tabColor theme="9"/></sheetPr><sheetData><row r="1"><c r="A1" s="1" t="inlineStr"><is><t>verde</t></is></c><c r="B1" s="2" t="inlineStr"><is><t>rosso scuro</t></is></c></row></sheetData></worksheet>`;
    const xlsx = await scriviZip([
      { nome: '_rels/.rels', dati: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`) },
      { nome: 'xl/workbook.xml', dati: enc(`<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
      { nome: 'xl/_rels/workbook.xml.rels', dati: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'worksheet', 'worksheets/sheet1.xml')}${rel('rId2', 'styles', 'styles.xml')}${rel('rId3', 'theme', 'theme/theme1.xml')}</Relationships>`) },
      { nome: 'xl/worksheets/sheet1.xml', dati: enc(foglio) },
      { nome: 'xl/styles.xml', dati: enc(stili) },
      { nome: 'xl/theme/theme1.xml', dati: enc(TEMA) },
    ]);
    const f = (await leggiXlsx(xlsx)).scambio.fogli[0]!;
    expect(f.stili.A1?.fill).toBe('#c3d69b');
    expect(f.stili.A1?.color).toBeUndefined();
    expect(f.stili.B1?.color).toBe(applicaTinta('#c0504d', -0.25));
    expect(f.colore).toBe('#f79646');
  });
});
