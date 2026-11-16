import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { scriviXlsx, avvisiScritturaXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { foglioVuoto, scambioDaDocumento, documentoDaScambio } from '../../src/formati/scambio';
import { LIMITE_BYTE_IMMAGINE, ORIGINE_X, ORIGINE_Y, dataUrlDaByte, type ImmagineScambio } from '../../src/sheet/immagini';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5]);
const GIF = new TextEncoder().encode('GIF89a\u0001\u0000\u0001\u0000........');
const WEBP = new TextEncoder().encode('RIFF\u0010\u0000\u0000\u0000WEBPVP8 ........');
const BMP = new TextEncoder().encode('BM......................');

const img = (extra: Partial<ImmagineScambio> = {}): ImmagineScambio => ({ x: 100, y: 50, width: 200, height: 120, nome: 'logo.png', tipo: 'image/png', byte: PNG, ...extra });
const leggiTesto = (d: Uint8Array): string => new TextDecoder().decode(d);

async function giro(immagini: ImmagineScambio[], extra?: (f: ReturnType<typeof foglioVuoto>) => void) {
  const f = foglioVuoto('Foglio1');
  f.celle.A1 = 'x';
  f.immagini = immagini;
  extra?.(f);
  const byte = await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' });
  return { byte, letto: await leggiXlsx(byte) };
}

describe('T500: immagini in un file .xlsx', () => {
  it('andata e ritorno: posizione, misure, nome e byte restano uguali (PNG, JPEG, GIF)', async () => {
    const lista = [img(), img({ x: 10, y: 400, width: 64, height: 48, nome: 'foto.jpg', tipo: 'image/jpeg', byte: JPEG }), img({ x: 0, y: 0, width: 30, height: 30, nome: 'animata.gif', tipo: 'image/gif', byte: GIF })];
    const { letto } = await giro(lista);
    const r = letto.scambio.fogli[0].immagini!;
    expect(r).toHaveLength(3);
    r.forEach((x, k) => {
      expect([x.x, x.y, x.width, x.height, x.nome, x.tipo]).toEqual([lista[k].x, lista[k].y, lista[k].width, lista[k].height, lista[k].nome, lista[k].tipo]);
      expect(Array.from(x.byte)).toEqual(Array.from(lista[k].byte));
    });
    expect(letto.avvisi.join(' ')).not.toMatch(/immagin|disegn/i);
  });

  it('il file ha le parti giuste: disegno, relazioni, byte in xl/media, tipi dei contenuti', async () => {
    const { byte } = await giro([img(), img({ nome: 'foto.jpg', tipo: 'image/jpeg', byte: JPEG })]);
    const voci = await leggiZip(byte);
    const nomi = [...voci.keys()];
    expect(nomi).toContain('xl/drawings/drawing1.xml');
    expect(nomi).toContain('xl/drawings/_rels/drawing1.xml.rels');
    expect(nomi).toContain('xl/media/image1.png');
    expect(nomi).toContain('xl/media/image2.jpeg');
    expect(Array.from(voci.get('xl/media/image1.png')!)).toEqual(Array.from(PNG));
    expect(leggiTesto(voci.get('[Content_Types].xml')!)).toMatch(/Extension="png" ContentType="image\/png"/);
    expect(leggiTesto(voci.get('[Content_Types].xml')!)).toMatch(/drawing1\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.drawing\+xml"/);
    expect(leggiTesto(voci.get('xl/worksheets/_rels/sheet1.xml.rels')!)).toMatch(/Type="[^"]+\/drawing" Target="\.\.\/drawings\/drawing1\.xml"/);
    expect(leggiTesto(voci.get('xl/worksheets/sheet1.xml')!)).toMatch(/<drawing r:id="rIdD1"\/>/);
    const disegno = leggiTesto(voci.get('xl/drawings/drawing1.xml')!);
    expect(disegno).toContain(`<xdr:pos x="${100 * 9525}" y="${50 * 9525}"/>`);
    expect(disegno).toContain(`<xdr:ext cx="${200 * 9525}" cy="${120 * 9525}"/>`);
  });

  it('il disegno sta prima dei commenti nel foglio e convive con link e commenti', async () => {
    const { byte, letto } = await giro([img()], (f) => { f.commenti = [{ riga: 1, colonna: 1, testo: 'nota' }]; f.stili.A1 = { link: 'https://esempio.it' }; });
    const xml = leggiTesto((await leggiZip(byte)).get('xl/worksheets/sheet1.xml')!);
    expect(xml.indexOf('<hyperlinks>')).toBeLessThan(xml.indexOf('<drawing '));
    expect(xml.indexOf('<drawing ')).toBeLessThan(xml.indexOf('<legacyDrawing'));
    const fg = letto.scambio.fogli[0];
    expect(fg.immagini).toHaveLength(1);
    expect(fg.commenti?.[0].testo).toBe('nota');
    expect(fg.stili.A1?.link).toBe('https://esempio.it');
  });

  it('il WebP non si scrive (Excel non lo legge) e un avviso lo dice; le altre sì', async () => {
    const f = foglioVuoto('Foglio1');
    f.immagini = [img(), img({ nome: 'w.webp', tipo: 'image/webp', byte: WEBP })];
    const s = { fogli: [f], foglioAttivo: 'Foglio1' };
    expect(avvisiScritturaXlsx(s).join(' ')).toMatch(/Un'immagine WebP non è stata scritta/);
    const r = (await leggiXlsx(await scriviXlsx(s))).scambio.fogli[0].immagini!;
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('image/png');
  });

  it('un foglio con sole immagini WebP non ha parti di disegno', async () => {
    const f = foglioVuoto('Foglio1');
    f.celle.A1 = 'x';
    f.immagini = [img({ tipo: 'image/webp', byte: WEBP })];
    const nomi = [...(await leggiZip(await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' }))).keys()];
    expect(nomi.some((n) => n.includes('drawing') || n.includes('media'))).toBe(false);
  });

  it('più fogli: ognuno ha le sue immagini e i file media si numerano su tutto il libro', async () => {
    const a = foglioVuoto('Uno'); a.celle.A1 = 'x'; a.immagini = [img({ nome: 'a.png' })];
    const b = foglioVuoto('Due'); b.celle.A1 = 'y'; b.immagini = [img({ nome: 'b1.png' }), img({ nome: 'b2.png', x: 5 })];
    const byte = await scriviXlsx({ fogli: [a, b], foglioAttivo: 'Uno' });
    const nomi = [...(await leggiZip(byte)).keys()].filter((n) => n.startsWith('xl/media/')).sort();
    expect(nomi).toEqual(['xl/media/image1.png', 'xl/media/image2.png', 'xl/media/image3.png']);
    const letto = (await leggiXlsx(byte)).scambio.fogli;
    expect(letto.map((f) => (f.immagini ?? []).map((i) => i.nome))).toEqual([['a.png'], ['b1.png', 'b2.png']]);
  });
});

/** Riscrive il disegno del primo foglio con un altro XML (come lo scriverebbe un altro programma). */
async function conDisegno(xml: string, media: Record<string, Uint8Array> = { 'xl/media/image1.png': PNG }, rels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>') {
  const { byte } = await giro([img()]);
  const voci = await leggiZip(byte);
  const cod = new TextEncoder();
  voci.set('xl/drawings/drawing1.xml', cod.encode(xml));
  voci.set('xl/drawings/_rels/drawing1.xml.rels', cod.encode(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`));
  for (const k of [...voci.keys()]) if (k.startsWith('xl/media/')) voci.delete(k);
  for (const [k, v] of Object.entries(media)) voci.set(k, v);
  return leggiXlsx(await scriviZip([...voci].map(([nome, dati]) => ({ nome, dati }))));
}
const radice = (corpo: string) => `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${corpo}</xdr:wsDr>`;
const pic = (id = 'rId1', nome = 'Picture 1') => `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="${nome}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${id}"/></xdr:blipFill><xdr:spPr/></xdr:pic>`;

describe('T500: immagini scritte da altri programmi', () => {
  it('ancora a una cella: colonna, riga e scostamenti diventano pixel (colonne da 90 e righe da 22 se non c\'è altro)', async () => {
    const r = await conDisegno(radice(`<xdr:oneCellAnchor><xdr:from><xdr:col>2</xdr:col><xdr:colOff>${10 * 9525}</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>${5 * 9525}</xdr:rowOff></xdr:from><xdr:ext cx="${150 * 9525}" cy="${90 * 9525}"/>${pic()}<xdr:clientData/></xdr:oneCellAnchor>`));
    const [i] = r.scambio.fogli[0].immagini!;
    expect([i.x, i.y, i.width, i.height]).toEqual([2 * 90 + 10, 3 * 22 + 5, 150, 90]);
    expect(i.nome).toBe('Picture 1');
  });

  it('ancora tra due celle: la misura è la distanza tra i due angoli', async () => {
    const r = await conDisegno(radice(`<xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>${pic()}<xdr:clientData/></xdr:twoCellAnchor>`));
    const [i] = r.scambio.fogli[0].immagini!;
    expect([i.x, i.y, i.width, i.height]).toEqual([90, 22, 180, 88]);
  });

  it('segue le larghezze e le altezze del foglio', async () => {
    const f = foglioVuoto('Foglio1'); f.celle.A1 = 'x'; f.immagini = [img()]; f.larghezze = { 1: 200, 2: 50 }; f.altezze = { 1: 40 };
    const voci = await leggiZip(await scriviXlsx({ fogli: [f], foglioAttivo: 'Foglio1' }));
    voci.set('xl/drawings/drawing1.xml', new TextEncoder().encode(radice(`<xdr:oneCellAnchor><xdr:from><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${100 * 9525}" cy="${100 * 9525}"/>${pic()}<xdr:clientData/></xdr:oneCellAnchor>`)));
    const [i] = (await leggiXlsx(await scriviZip([...voci].map(([nome, dati]) => ({ nome, dati }))))).scambio.fogli[0].immagini!;
    expect([i.x, i.y]).toEqual([250, 40]);
  });

  it('un grafico nel disegno avvisa; l\'immagine accanto si importa lo stesso', async () => {
    const r = await conDisegno(radice(`<xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="${50 * 9525}" cy="${50 * 9525}"/>${pic()}<xdr:clientData/></xdr:absoluteAnchor><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr/></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`));
    expect(r.scambio.fogli[0].immagini).toHaveLength(1);
    expect(r.avvisi.join(' ')).toMatch(/Grafici e disegni del file non sono stati importati/);
  });

  it('un\'immagine BMP, o con i byte mancanti, non si importa e si dice quante', async () => {
    const r = await conDisegno(radice(`<xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="${50 * 9525}" cy="${50 * 9525}"/>${pic('rId1')}<xdr:clientData/></xdr:absoluteAnchor><xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="${50 * 9525}" cy="${50 * 9525}"/>${pic('rId9')}<xdr:clientData/></xdr:absoluteAnchor>`), { 'xl/media/image1.png': BMP });
    expect(r.scambio.fogli[0].immagini).toBeUndefined();
    expect(r.avvisi.join(' ')).toMatch(/2 immagini del file non sono state importate/);
  });

  it('un\'immagine oltre il limite di peso non si importa', async () => {
    const grande = new Uint8Array(LIMITE_BYTE_IMMAGINE + 10); grande.set(PNG);
    const r = await conDisegno(radice(`<xdr:absoluteAnchor><xdr:pos x="0" y="0"/><xdr:ext cx="${50 * 9525}" cy="${50 * 9525}"/>${pic()}<xdr:clientData/></xdr:absoluteAnchor>`), { 'xl/media/image1.png': grande });
    expect(r.scambio.fogli[0].immagini).toBeUndefined();
    expect(r.avvisi.join(' ')).toMatch(/Un'immagine del file non è stata importata/);
  });

  it('prefissi diversi dal solito e tag senza prefisso si leggono lo stesso', async () => {
    const r = await conDisegno(`<?xml version="1.0"?><wsDr xmlns="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><absoluteAnchor><pos x="${9525 * 7}" y="${9525 * 9}"/><ext cx="${9525 * 60}" cy="${9525 * 40}"/><pic><nvPicPr><cNvPr id="2" name="Senza prefisso" descr="descrizione"/><cNvPicPr/></nvPicPr><blipFill><a:blip r:embed="rId1"/></blipFill><spPr/></pic><clientData/></absoluteAnchor></wsDr>`);
    const [i] = r.scambio.fogli[0].immagini!;
    expect([i.x, i.y, i.width, i.height, i.nome]).toEqual([7, 9, 60, 40, 'descrizione']);
  });

  it('un disegno rotto o vuoto non fa crollare la lettura', async () => {
    const r = await conDisegno('<non xml');
    expect(r.scambio.fogli[0].celle.A1).toBe('x');
    expect(r.scambio.fogli[0].immagini).toBeUndefined();
    expect(r.avvisi.join(' ')).toMatch(/Grafici e disegni del file non sono stati importati/);
    const v = await conDisegno(radice(''));
    expect(v.scambio.fogli[0].immagini).toBeUndefined();
  });
});

describe('T500: dal documento al modello di scambio e ritorno', () => {
  it('le immagini del documento diventano immagini di scambio dal punto di A1 (tolte le intestazioni) e tornano uguali', () => {
    const dati = documentoDaScambio({ foglioAttivo: 'Foglio1', fogli: [{ ...foglioVuoto('Foglio1'), immagini: [img({ x: 100, y: 50 })] }] });
    expect(dati.images).toHaveLength(1);
    expect(dati.images![0]).toMatchObject({ sheetName: 'Foglio1', x: 100 + ORIGINE_X, y: 50 + ORIGINE_Y, width: 200, height: 120, nome: 'logo.png' });
    expect(dati.images![0].dataUrl).toBe(dataUrlDaByte(PNG, 'image/png'));
    const di_nuovo = scambioDaDocumento(dati).fogli[0].immagini!;
    expect(di_nuovo).toHaveLength(1);
    expect([di_nuovo[0].x, di_nuovo[0].y]).toEqual([100, 50]);
    expect(Array.from(di_nuovo[0].byte)).toEqual(Array.from(PNG));
  });

  it('un\'immagine vicina al bordo non va in posizione negativa', () => {
    const dati = documentoDaScambio({ foglioAttivo: 'Foglio1', fogli: [{ ...foglioVuoto('Foglio1'), immagini: [img({ x: 0, y: 0 })] }] });
    const d2 = { ...dati, images: dati.images!.map((i) => ({ ...i, x: 10, y: 5 })) };
    const r = scambioDaDocumento(d2).fogli[0].immagini![0];
    expect([r.x, r.y]).toEqual([0, 0]);
  });
});
