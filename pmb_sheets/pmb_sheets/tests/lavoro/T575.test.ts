// T575: i file di Excel si aprono come in Excel (segnalazione del 2026-11-25: «quando apro file word o excel spesso vengono starati
// graficamente»). Il carattere base della cartella (Calibri 11 di Excel) vale per le celle senza carattere proprio e si riscrive; la griglia
// nascosta del foglio (showGridLines="0") si legge, si riscrive e passa dal documento; i file scritti da pmb_sheets (Arial 10) restano come
// erano. Confronto fatto con Excel (PDF) su un file vero (LAVORO/studio-microsoft-office/confronto_visivo.py).
import { describe, expect, test } from 'vitest';
import { scriviZip, leggiZip } from '@comune/formati/zip';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { documentoDaScambio, scambioDaDocumento } from '../../src/formati/scambio';
import { carattereBaseValido } from '../../src/sheet/carattere-base';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const rel = (id: string, tipo: string, t: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${t}"/>`;
const enc = (s: string) => new TextEncoder().encode(s);
async function xlsx(carattere: string, vista: string): Promise<Uint8Array> {
  const stili = `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${NS}><fonts count="2">${carattere}<font><b/><sz val="14"/><name val="Cambria"/></font></fonts>
    <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders>
    <cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>`;
  const foglio = `<?xml version="1.0" encoding="UTF-8"?><worksheet ${NS}><sheetViews>${vista}</sheetViews><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>normale</t></is></c><c r="B1" s="1" t="inlineStr"><is><t>titolo</t></is></c></row></sheetData></worksheet>`;
  return scriviZip([
    { nome: '_rels/.rels', dati: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`) },
    { nome: 'xl/workbook.xml', dati: enc(`<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { nome: 'xl/_rels/workbook.xml.rels', dati: enc(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'worksheet', 'worksheets/sheet1.xml')}${rel('rId2', 'styles', 'styles.xml')}</Relationships>`) },
    { nome: 'xl/worksheets/sheet1.xml', dati: enc(foglio) },
    { nome: 'xl/styles.xml', dati: enc(stili) },
  ]);
}
const CALIBRI = '<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>';
const ARIAL = '<font><sz val="10"/><name val="Arial"/></font>';
const SENZA_GRIGLIA = '<sheetView showGridLines="0" workbookViewId="0"/>';
const parte = async (b: Uint8Array, nome: string): Promise<string> => new TextDecoder().decode((await leggiZip(b)).get(nome)!);

describe('T575: carattere base e griglia dei file di Excel', () => {
  test('Calibri 11 di Excel: la cartella lo tiene, le celle senza carattere proprio restano senza; i caratteri diversi restano nelle celle', async () => {
    const { scambio } = await leggiXlsx(await xlsx(CALIBRI, '<sheetView workbookViewId="0"/>'));
    expect(scambio.carattere).toEqual({ nome: 'Calibri', dimensione: 11 });
    const f = scambio.fogli[0]!;
    expect(f.stili.A1?.fontFamily).toBeUndefined();
    expect(f.stili.B1).toMatchObject({ bold: true, fontFamily: 'Cambria', fontSize: 14 });
  });
  test('riscritto da pmb_sheets il carattere base torna il primo del file, e passa dal documento (.psheet)', async () => {
    const { scambio } = await leggiXlsx(await xlsx(CALIBRI, SENZA_GRIGLIA));
    const dopo = scambioDaDocumento(documentoDaScambio(scambio));
    expect(dopo.carattere).toEqual({ nome: 'Calibri', dimensione: 11 });
    const x = await scriviXlsx(dopo);
    const stili = await parte(x, 'xl/styles.xml');
    expect(stili.match(/<font>[\s\S]*?<\/font>/)![0]).toMatch(/<sz val="11"\/>[\s\S]*<name val="Calibri"\/>/);
    expect((await leggiXlsx(x)).scambio.carattere).toEqual({ nome: 'Calibri', dimensione: 11 });
  });
  test('i file con Arial 10 (quelli di pmb_sheets) non tengono un carattere base; i valori non ammessi si scartano', async () => {
    expect((await leggiXlsx(await xlsx(ARIAL, '<sheetView workbookViewId="0"/>'))).scambio.carattere).toBeUndefined();
    expect(carattereBaseValido({ nome: 'Arial', dimensione: 10 })).toBeUndefined();
    expect(carattereBaseValido({ nome: 'a"b', dimensione: 11 })).toBeUndefined();
    expect(carattereBaseValido({ nome: 'Calibri', dimensione: 0 })).toBeUndefined();
  });
  test('griglia nascosta (Visualizza › Mostra griglia di Excel tolto): si legge, passa dal documento e si riscrive', async () => {
    const { scambio } = await leggiXlsx(await xlsx(CALIBRI, SENZA_GRIGLIA));
    expect(scambio.fogli[0]!.senzaGriglia).toBe(true);
    const dopo = scambioDaDocumento(documentoDaScambio(scambio));
    expect(dopo.fogli[0]!.senzaGriglia).toBe(true);
    const x = await scriviXlsx(dopo);
    expect(await parte(x, 'xl/worksheets/sheet1.xml')).toContain('showGridLines="0"');
    const conGriglia = (await leggiXlsx(await xlsx(CALIBRI, '<sheetView workbookViewId="0"/>'))).scambio;
    expect(conGriglia.fogli[0]!.senzaGriglia).toBeUndefined();
    expect(await parte(await scriviXlsx(conGriglia), 'xl/worksheets/sheet1.xml')).not.toContain('showGridLines');
  });
});
