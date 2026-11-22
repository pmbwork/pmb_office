import { describe, it, expect } from 'vitest';
import { scriviZip, leggiZip } from '@comune/formati/zip';
import { importa, esporta, eSoloLettura, ESTENSIONI_APRI, titoloDaNome } from '../src/formati/file';
import { scambioDaDocumento } from '../src/formati/scambio';
import { documentoDaScambio, foglioVuoto } from '../src/formati/scambio';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const celle = async (bytes: Uint8Array, nome: string) => {
  const r = await importa(bytes, nome);
  return { r, fogli: scambioDaDocumento(r.dati).fogli };
};

async function xlsxDi(testi: Record<string, string>): Promise<Uint8Array> {
  const f = foglioVuoto('Foglio1');
  Object.assign(f.celle, testi);
  return esporta(documentoDaScambio({ fogli: [f], foglioAttivo: 'Foglio1' }), 'xlsx');
}

describe('formati aperti: famiglia Excel e OpenDocument', () => {
  it('le estensioni nuove sono nella finestra Apri e riconosciute come solo lettura', () => {
    for (const e of ['.xlsm', '.xltx', '.xltm', '.xlsb', '.ots', '.fods', '.html', '.htm', '.dif', '.slk', '.xml']) expect(ESTENSIONI_APRI).toContain(e);
    for (const n of ['a.xlsm', 'a.xltx', 'a.xlsb', 'a.ots', 'a.fods', 'a.html', 'a.dif', 'a.slk', 'a.xml']) expect(eSoloLettura(n), n).toBe(true);
    for (const n of ['a.xlsx', 'a.ods', 'a.csv', 'a.psheet']) expect(eSoloLettura(n), n).toBe(false);
    expect(titoloDaNome('ADEGUATE VERIFICHE.xlsm')).toBe('ADEGUATE VERIFICHE');
  });

  it('.xlsm si apre come .xlsx; con macro avvisa e non è riscrivibile', async () => {
    const base = await xlsxDi({ A1: 'ciao', B1: '12' });
    const voci = await leggiZip(base);
    const lista = [...voci.entries()].map(([nome, dati]) => ({ nome, dati }));
    lista.push({ nome: 'xl/vbaProject.bin', dati: Uint8Array.from([1, 2, 3, 4]) });
    const xlsm = await scriviZip(lista);
    const { r, fogli } = await celle(xlsm, 'ADEGUATE VERIFICHE.xlsm');
    expect(fogli[0].celle.A1).toBe('ciao');
    expect(fogli[0].celle.B1).toBe('12');
    expect(r.soloLettura).toBe(true);
    expect(r.avvisi.join(' ')).toMatch(/macro/i);
  });

  it('.xltx (modello) si apre senza macro ed è solo lettura', async () => {
    const { r, fogli } = await celle(await xlsxDi({ A1: 'modello' }), 'm.xltx');
    expect(fogli[0].celle.A1).toBe('modello');
    expect(r.soloLettura).toBe(true);
    expect(r.avvisi.join(' ')).not.toMatch(/macro/i);
  });

  it('.xlsx normale non diventa solo lettura', async () => {
    const { r } = await celle(await xlsxDi({ A1: 'x' }), 'a.xlsx');
    expect(r.soloLettura).toBeUndefined();
  });

  it('.xls binario (97-2003) dà un errore chiaro', async () => {
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    await expect(importa(ole, 'vecchio.xls')).rejects.toThrow(/\.xls/);
  });

  it('.ots si apre come .ods; .fods si legge dal file piatto', async () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = 'odf';
    const ods = await esporta(documentoDaScambio({ fogli: [f], foglioAttivo: 'Foglio1' }), 'ods');
    const a = await celle(ods, 'm.ots');
    expect(a.fogli[0].celle.A1).toBe('odf');
    const fods = `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
<office:body><office:spreadsheet><table:table table:name="Dati"><table:table-row><table:table-cell office:value-type="string"><text:p>piatto</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="42"><text:p>42</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body></office:document>`;
    const b = await celle(enc(fods), 'x.fods');
    expect(b.fogli[0].nome).toBe('Dati');
    expect(b.fogli[0].celle.A1).toBe('piatto');
    expect(b.fogli[0].celle.B1).toBe('42');
    expect(b.r.soloLettura).toBe(true);
  });
});

describe('formati aperti: HTML, DIF, SYLK, XML 2003', () => {
  it('HTML: ogni tabella è un foglio, con celle unite, numeri e testi', async () => {
    const html = `<!doctype html><html><body><script>alert(1)</script>
<table><caption>Vendite</caption><tr><th colspan="2">Titolo</th></tr><tr><td>Mele</td><td>1,5</td></tr><tr><td>Codice</td><td>00123</td></tr><tr><td>=1+1</td><td style="color:#ff0000;font-weight:bold">Rosso</td></tr></table>
<table><tr><td>seconda</td></tr></table></body></html>`;
    const { r, fogli } = await celle(enc(html), 'pagina.html');
    expect(fogli.map((f) => f.nome)).toEqual(['Vendite', 'Tabella 2']);
    const f = fogli[0];
    expect(f.celle.A1).toBe('Titolo');
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);
    expect(f.celle.B2).toBe('1.5');
    expect(f.celle.B3).toBe("'00123");
    expect(f.celle.A4).toBe("'=1+1"); // una formula scritta nella pagina non si esegue
    expect(f.stili.B4?.bold).toBe(true);
    expect(f.stili.B4?.color).toBe('#ff0000');
    expect(f.stili.A1?.bold).toBe(true);
    expect(fogli[1].celle.A1).toBe('seconda');
    expect(r.soloLettura).toBe(true);
  });

  it('HTML senza tabelle: errore chiaro', async () => {
    await expect(importa(enc('<html><body><p>niente</p></body></html>'), 'a.html')).rejects.toThrow(/tabelle/);
  });

  it('DIF: numeri, testi, vero/falso e righe', async () => {
    const dif = ['TABLE', '0,1', '"EXCEL"', 'VECTORS', '0,2', '""', 'TUPLES', '0,3', '""', 'DATA', '0,0', '""',
      '-1,0', 'BOT', '1,0', '"nome ""x"""', '0,12.5', 'V', '0,0', 'TRUE',
      '-1,0', 'BOT', '1,0', '"007"', '0,3', 'V', '0,0', 'NA', '-1,0', 'EOD'].join('\r\n');
    const { fogli } = await celle(enc(dif), 'a.dif');
    const f = fogli[0];
    expect(f.celle.A1).toBe('nome "x"');
    expect(f.celle.B1).toBe('12.5');
    expect(f.celle.C1).toBe('TRUE');
    expect(f.celle.A2).toBe("'007"); // testo dichiarato, resta testo
    expect(f.celle.B2).toBe('3');
    expect(f.celle.C2).toBe('#N/A');
  });

  it('SYLK: riga e colonna restano quelle del record precedente', async () => {
    const slk = ['ID;PWXL;N;E', 'B;Y2;X3;D0 0 1 2', 'C;Y1;X1;K"testo; con punto e virgola"', 'C;X2;K7', 'C;X3;K1.5;ERC[-1]*2', 'C;Y2;X1;K"12"', 'C;X2;KTRUE', 'E'].join('\r\n');
    const { r, fogli } = await celle(enc(slk), 'a.slk');
    const f = fogli[0];
    expect(f.celle.A1).toBe('testo; con punto e virgola');
    expect(f.celle.B1).toBe('7');
    expect(f.celle.C1).toBe('1.5');
    expect(f.celle.A2).toBe("'12");
    expect(f.celle.B2).toBe('TRUE');
    expect(r.avvisi.join(' ')).toMatch(/formule/i);
  });

  it('XML 2003: valori, date, celle unite, stili', async () => {
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="s1"><Font ss:Bold="1" ss:Color="#FF0000"/><Interior ss:Color="#FFFF00" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="Dati"><Table><Column ss:Index="2" ss:Width="60"/>
<Row><Cell ss:StyleID="s1" ss:MergeAcross="1"><Data ss:Type="String">Titolo</Data></Cell></Row>
<Row><Cell><Data ss:Type="Number">42</Data></Cell><Cell ss:Index="3"><Data ss:Type="DateTime">2024-03-15T00:00:00.000</Data></Cell><Cell><Data ss:Type="Boolean">1</Data></Cell></Row>
<Row><Cell><Data ss:Type="String">007</Data></Cell></Row>
</Table></Worksheet></Workbook>`;
    const { r, fogli } = await celle(enc(xml), 'a.xml');
    const f = fogli[0];
    expect(f.nome).toBe('Dati');
    expect(f.celle.A1).toBe('Titolo');
    expect(f.unioni).toEqual([{ startRow: 1, endRow: 1, startCol: 1, endCol: 2 }]);
    expect(f.stili.A1?.bold).toBe(true);
    expect(f.stili.A1?.fill).toBe('#ffff00');
    expect(f.celle.A2).toBe('42');
    expect(f.celle.C2).toBe('45366'); // 15/03/2024
    expect(f.celle.D2).toBe('TRUE');
    expect(f.celle.A3).toBe("'007");
    expect(f.larghezze[2]).toBe(80);
    expect(r.soloLettura).toBe(true);
  });

  it('un .xml qualsiasi che non è un foglio dà un errore, non un foglio vuoto', async () => {
    await expect(importa(enc('<?xml version="1.0"?><altro/>'), 'a.xml')).rejects.toThrow();
  });
});

// ---- .xlsb costruito a mano (record BIFF12) ----
const u32 = (n: number): number[] => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const wide = (s: string): number[] => [...u32(s.length), ...Array.from(s).flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])];
const f64 = (n: number): number[] => Array.from(new Uint8Array(new Float64Array([n]).buffer));
function rec(id: number, payload: number[]): number[] {
  const idb = id < 128 ? [id] : [(id & 0x7f) | 0x80, id >> 7];
  const sz: number[] = [];
  let n = payload.length;
  do { const b = n & 0x7f; n >>= 7; sz.push(n > 0 ? b | 0x80 : b); } while (n > 0);
  return [...idb, ...sz, ...payload];
}

describe('formati aperti: .xlsb', () => {
  it('legge fogli, numeri, testi, stringhe condivise, booleani, errori, Rk e celle unite', async () => {
    const cartella = Uint8Array.from([...rec(153, u32(0)), ...rec(156, [...u32(0), ...u32(1), ...wide('rId1'), ...wide('Conti')])]);
    const sst = Uint8Array.from([...rec(19, [0, ...wide('condivisa')])]);
    const rk = (((100 << 2) | 2) >>> 0); // intero 100
    const foglio = Uint8Array.from([
      ...rec(0, u32(0)),
      ...rec(5, [...u32(0), ...u32(0), ...f64(3.25)]),
      ...rec(6, [...u32(1), ...u32(0), ...wide('testo')]),
      ...rec(7, [...u32(2), ...u32(0), ...u32(0)]),
      ...rec(4, [...u32(3), ...u32(0), 1]),
      ...rec(0, u32(1)),
      ...rec(2, [...u32(0), ...u32(0), ...u32(rk)]),
      ...rec(3, [...u32(1), ...u32(0), 7]),
      ...rec(9, [...u32(2), ...u32(0), ...f64(9)]),
      ...rec(176, [...u32(1), ...u32(1), ...u32(3), ...u32(4)]),
    ]);
    const rels = enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.bin"/></Relationships>');
    const zip = await scriviZip([
      { nome: 'xl/workbook.bin', dati: cartella }, { nome: 'xl/_rels/workbook.bin.rels', dati: rels },
      { nome: 'xl/sharedStrings.bin', dati: sst }, { nome: 'xl/worksheets/sheet1.bin', dati: foglio },
    ]);
    const { r, fogli } = await celle(zip, 'conti.xlsb');
    expect(fogli[0].nome).toBe('Conti');
    const c = fogli[0].celle;
    expect(c.A1).toBe('3.25');
    expect(c.B1).toBe('testo');
    expect(c.C1).toBe('condivisa');
    expect(c.D1).toBe('TRUE');
    expect(c.A2).toBe('100');
    expect(c.B2).toBe('#DIV/0!');
    expect(c.C2).toBe('9');
    expect(fogli[0].unioni).toEqual([{ startRow: 2, endRow: 2, startCol: 4, endCol: 5 }]);
    expect(r.soloLettura).toBe(true);
    expect(r.avvisi.join(' ')).toMatch(/xlsb/);
  });

  it('un foglio nascosto si importa visibile e lo si dice, come per .xlsx (analisi del 2026-11-18)', async () => {
    const cartella = Uint8Array.from([
      ...rec(153, u32(0)),
      ...rec(156, [...u32(0), ...u32(1), ...wide('rId1'), ...wide('Visibile')]),
      ...rec(156, [...u32(1), ...u32(2), ...wide('rId2'), ...wide('Segreto')]),
    ]);
    const foglio = Uint8Array.from([...rec(0, u32(0)), ...rec(5, [...u32(0), ...u32(0), ...f64(1)])]);
    const rels = enc('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.bin"/><Relationship Id="rId2" Type="x/worksheet" Target="worksheets/sheet2.bin"/></Relationships>');
    const zip = await scriviZip([
      { nome: 'xl/workbook.bin', dati: cartella }, { nome: 'xl/_rels/workbook.bin.rels', dati: rels },
      { nome: 'xl/worksheets/sheet1.bin', dati: foglio }, { nome: 'xl/worksheets/sheet2.bin', dati: foglio },
    ]);
    const { r, fogli } = await celle(zip, 'nascosto.xlsb');
    expect(fogli.map((f: { nome: string }) => f.nome)).toEqual(['Visibile', 'Segreto']);
    // dal 0.2.14 (Nascondi foglio) il foglio resta nascosto e non c'è più l'avviso
    expect(fogli.map((f: { nascosto?: boolean }) => f.nascosto === true)).toEqual([false, true]);
    expect(r.avvisi.join(' ')).not.toContain('nascosto');
  });

  it('un .xlsb rovinato dà un errore chiaro', async () => {
    const zip = await scriviZip([{ nome: 'xl/workbook.bin', dati: Uint8Array.from([156, 3, 0, 0, 0]) }]);
    await expect(importa(zip, 'x.xlsb')).rejects.toThrow();
  });
});
