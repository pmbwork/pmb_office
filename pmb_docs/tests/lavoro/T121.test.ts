import { describe, it, expect } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { OGGETTO, serializza, type Documento, type Immagine, type Paragrafo, type Run } from '../../src/modello/documento';

const dec = new TextDecoder('utf-8');
const enc = new TextEncoder();
const PNG64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = `data:image/png;base64,${PNG64}`;
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const JPEG = `data:image/jpeg;base64,${btoa(String.fromCharCode(...JPEG_BYTES))}`;
const img = (w = 200, h = 100, s = PNG): Immagine => ({ s, w, h });
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const runImg = (im: Immagine, extra: Partial<Run> = {}): Run => run(OGGETTO, { im, ...extra });
const bytesDa = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const nomi = (n: NodoXml): string[] => n.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome);
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function pacchetto(doc: Documento): Promise<{ file: Map<string, Uint8Array>; xml: (n: string) => NodoXml }> {
  const file = await leggiZip(await esportaDocx(doc));
  return { file, xml: (n) => analizzaXml(dec.decode(file.get(n)!)) };
}
const giro = async (d: Documento): Promise<Documento> => importaDocx(await esportaDocx(d));
const uno = (...runs: Run[]): Documento => ({ paragrafi: [{ runs }] });

describe('T121: esportare le immagini', () => {
  it('un\'immagine diventa un w:drawing in linea con misure in EMU, il file in word/media e la sua relazione', async () => {
    const { file, xml } = await pacchetto(uno(run('ab'), runImg(img(200, 100)), run('cd')));
    const corpo = trova(xml('word/document.xml'), 'w:body')!;
    const par = trova(corpo, 'w:p')!;
    expect(nomi(par)).toEqual(['w:r', 'w:r', 'w:r']);
    const disegno = trova(figliElemento(par, 'w:r')[1], 'w:drawing/wp:inline')!;
    expect(trova(disegno, 'wp:extent')!.attributi).toEqual({ cx: String(200 * 9525), cy: String(100 * 9525) });
    expect(trova(disegno, 'a:graphic/a:graphicData/pic:pic/pic:blipFill/a:blip')!.attributi['r:embed']).toBe('rId3');
    expect(trova(disegno, 'a:graphic/a:graphicData/pic:pic/pic:spPr/a:xfrm/a:ext')!.attributi).toEqual({ cx: String(200 * 9525), cy: String(100 * 9525) });
    const rel = figliElemento(xml('word/_rels/document.xml.rels'), 'Relationship').find((r) => r.attributi['Id'] === 'rId3')!;
    expect(rel.attributi).toEqual({ Id: 'rId3', Type: `${REL}/image`, Target: 'media/image1.png' });
    expect(Array.from(file.get('word/media/image1.png')!)).toEqual(Array.from(bytesDa(PNG64)));
    const tipi = figliElemento(xml('[Content_Types].xml'), 'Default').map((d) => [d.attributi['Extension'], d.attributi['ContentType']]);
    expect(tipi).toContainEqual(['png', 'image/png']);
    expect(xml('word/document.xml').attributi['xmlns:wp']).toBe('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing');
    expect(xml('word/document.xml').attributi['xmlns:a']).toBe('http://schemas.openxmlformats.org/drawingml/2006/main');
  });

  it('la stessa immagine due volte ha un solo file e due disegni con numeri diversi; immagini diverse hanno file e tipi diversi', async () => {
    const { file, xml } = await pacchetto(uno(runImg(img()), run(' '), runImg(img()), runImg(img(50, 50, JPEG))));
    expect(Array.from(file.keys()).filter((n) => n.startsWith('word/media/'))).toEqual(['word/media/image1.png', 'word/media/image2.jpeg']);
    const incorporati = figliElemento(xml('word/_rels/document.xml.rels'), 'Relationship').filter((r) => r.attributi['Type'] === `${REL}/image`);
    expect(incorporati.map((r) => [r.attributi['Id'], r.attributi['Target']])).toEqual([['rId3', 'media/image1.png'], ['rId4', 'media/image2.jpeg']]);
    const ids = figliElemento(trova(xml('word/document.xml'), 'w:body/w:p')!, 'w:r')
      .map((r) => trova(r, 'w:drawing/wp:inline/wp:docPr')?.attributi['id']).filter((x) => x !== undefined);
    expect(ids).toEqual(['1', '2', '3']);
    const tipi = figliElemento(xml('[Content_Types].xml'), 'Default').map((d) => d.attributi['Extension']);
    expect(tipi).toEqual(expect.arrayContaining(['png', 'jpeg']));
    expect(tipi.filter((e) => e === 'png').length).toBe(1);
  });

  it('collegamenti e immagini nello stesso file hanno identificativi diversi; un\'immagine con collegamento sta dentro il w:hyperlink', async () => {
    const doc = uno(run('sito', { u: 'https://a.it' }), runImg(img(), { u: 'https://b.it' }), runImg(img(50, 50, JPEG)));
    const { xml } = await pacchetto(doc);
    const rels = figliElemento(xml('word/_rels/document.xml.rels'), 'Relationship').map((r) => r.attributi['Id']);
    expect([...rels].sort()).toEqual(['rId1', 'rId2', 'rId3', 'rId4', 'rId5', 'rId6']);
    expect(new Set(rels).size).toBe(rels.length);
    expect(rels.length).toBe(6);
    const par = trova(xml('word/document.xml'), 'w:body/w:p')!;
    const hyper = figliElemento(par, 'w:hyperlink');
    expect(hyper.length).toBe(2);
    expect(trova(hyper[1], 'w:r/w:drawing')).not.toBeNull();
    expect(trova(hyper[1], 'w:r/w:drawing')).toBeDefined();
  });

  it('senza immagini il pacchetto non ha file in word/media né tipi di immagine', async () => {
    const { file, xml } = await pacchetto(uno(run('solo testo')));
    expect(Array.from(file.keys()).some((n) => n.startsWith('word/media/'))).toBe(false);
    expect(figliElemento(xml('[Content_Types].xml'), 'Default').map((d) => d.attributi['Extension'])).toEqual(['rels', 'xml']);
  });
});

describe('T121: andata e ritorno', () => {
  it('immagini nel testo, in una cella di tabella e con un collegamento tornano identiche', async () => {
    const cella = (r: number, c: number, runs: Run[]): Paragrafo => ({ runs, tb: { i: 0, r, c } });
    const doc: Documento = { paragrafi: [
      { runs: [run('prima '), runImg(img(321, 123)), run(' dopo', { g: true })] },
      cella(0, 0, [runImg(img(50, 50, JPEG))]), cella(0, 1, [run('x')]),
      { runs: [runImg(img(200, 100), { u: 'https://esempio.it' })] },
    ] };
    const r = await giro(doc);
    expect(serializza(r)).toBe(serializza(doc));
  });

  it('un\'immagine più larga del foglio torna ridotta, senza ingrandire le piccole', async () => {
    const r = await giro(uno(runImg(img(1204, 400)), runImg(img(100, 50))));
    expect(r.paragrafi[0].runs.map((x) => [x.im?.w, x.im?.h])).toEqual([[602, 200], [100, 50]]);
  });
});

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
async function docxCon(corpo: string, rels: Array<[string, string, string?, string?]>, media: Record<string, Uint8Array>): Promise<Uint8Array> {
  const relXml = rels.map(([id, target, tipo = 'image', modo]) => `<Relationship Id="${id}" Type="${REL}/${tipo}" Target="${target}"${modo ? ` TargetMode="${modo}"` : ''}/>`).join('');
  const voci = {
    '[Content_Types].xml': enc.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    '_rels/.rels': enc.encode(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/document.xml': enc.encode(`<?xml version="1.0"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`),
    'word/_rels/document.xml.rels': enc.encode(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relXml}</Relationships>`),
    ...media,
  };
  return scriviZip(Object.entries(voci).map(([nome, dati]) => ({ nome, dati })));
}
const disegno = (rid: string, cx: number, cy: number, tipo: 'inline' | 'anchor' = 'inline'): string =>
  `<w:drawing><wp:${tipo}><wp:extent cx="${cx}" cy="${cy}"/><a:graphic><a:graphicData uri="x"><pic:pic><pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:${tipo}></w:drawing>`;
const pz = (...figli: string[]): string => `<w:p>${figli.join('')}</w:p>`;
const rt = (t: string, pr = ''): string => `<w:r>${pr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const png = (): Uint8Array => bytesDa(PNG64);
const jpg = (): Uint8Array => JPEG_BYTES;
const mostra = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => (r.im ? `[img ${r.im.w}x${r.im.h} ${r.im.s.slice(5, 15)}]` : r.t)));

describe('T121: importare le immagini degli altri programmi', () => {
  it('un\'immagine in linea di Word: nel punto giusto del testo, con le misure in pixel e il formato del tratto', async () => {
    const f = await docxCon(pz(rt('prima '), `<w:r><w:rPr><w:b/></w:rPr>${disegno('rId5', 1905000, 952500)}</w:r>`, rt(' dopo')), [['rId5', 'media/foto.png']], { 'word/media/foto.png': png() });
    const d = await importaDocx(f);
    expect(mostra(d)).toEqual([['prima ', '[img 200x100 image/png;]', ' dopo']]);
    expect(d.paragrafi[0].runs[1].g).toBe(true);
    expect(d.paragrafi[0].runs[1].t).toBe(OGGETTO);
  });

  it('un\'immagine ancorata e una dentro mc:AlternateContent si leggono come in linea', async () => {
    const f = await docxCon(
      pz(`<w:r>${disegno('rId5', 952500, 952500, 'anchor')}</w:r>`) + pz(`<w:r><mc:AlternateContent><mc:Choice>${disegno('rId5', 1905000, 952500)}</mc:Choice><mc:Fallback><w:pict/></mc:Fallback></mc:AlternateContent></w:r>`),
      [['rId5', 'media/foto.png']], { 'word/media/foto.png': png() });
    const d = await importaDocx(f);
    expect(mostra(d)).toEqual([['[img 100x100 image/png;]'], ['[img 200x100 image/png;]']]);
  });

  it('il tipo si riconosce dai byte e non dal nome del file; gif e webp si leggono; un\'immagine con link prende il link', async () => {
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b]);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
    const f = await docxCon(
      pz(`<w:r>${disegno('a', 952500, 952500)}</w:r><w:r>${disegno('b', 952500, 952500)}</w:r><w:r>${disegno('c', 952500, 952500)}</w:r>`) +
      pz(`<w:hyperlink r:id="h"><w:r>${disegno('a', 952500, 952500)}</w:r></w:hyperlink>`),
      [['a', 'media/finto.png'], ['b', 'media/b.dat'], ['c', 'media/c.bin'], ['h', 'https://esempio.it/', 'hyperlink', 'External']],
      { 'word/media/finto.png': jpg(), 'word/media/b.dat': gif, 'word/media/c.bin': webp });
    const d = await importaDocx(f);
    expect(mostra(d)[0]).toEqual(['[img 100x100 image/jpeg]', '[img 100x100 image/gif;]', '[img 100x100 image/webp]']);
    expect(d.paragrafi[1].runs[0].u).toBe('https://esempio.it/');
    expect(d.paragrafi[1].runs[0].im?.w).toBe(100);
  });

  it('non diventano immagini: relazione che non c\'è, file mancante, indirizzo esterno, tipo non ammesso, file enorme, misure mancanti; il testo resta', async () => {
    const svg = enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const enorme = new Uint8Array(5_000_001);
    enorme.set([0x89, 0x50, 0x4e, 0x47]);
    const f = await docxCon(
      pz(rt('x'), `<w:r>${disegno('manca', 952500, 952500)}</w:r>`, `<w:r>${disegno('vuoto', 952500, 952500)}</w:r>`, `<w:r>${disegno('fuori', 952500, 952500)}</w:r>`,
        `<w:r>${disegno('svg', 952500, 952500)}</w:r>`, `<w:r>${disegno('enorme', 952500, 952500)}</w:r>`,
        `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="ok"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
        `<w:r>${disegno('ok', 0, 0)}</w:r>`, rt('y')),
      [['vuoto', 'media/non-c-e.png'], ['fuori', 'https://esempio.it/a.png', 'image', 'External'], ['svg', 'media/a.svg'], ['enorme', 'media/enorme.png'], ['ok', 'media/ok.png']],
      { 'word/media/a.svg': svg, 'word/media/enorme.png': enorme, 'word/media/ok.png': png() });
    const d = await importaDocx(f);
    expect(mostra(d)).toEqual([['xy']]);
    expect(d.paragrafi[0].runs.every((r) => r.im === undefined)).toBe(true);
  });

  it('una relazione esterna o di un altro tipo, o un file RIFF che non è webp, non dà immagini', async () => {
    const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20]);
    const f = await docxCon(
      pz(`<w:r>${disegno('esterna', 952500, 952500)}</w:r><w:r>${disegno('altro', 952500, 952500)}</w:r><w:r>${disegno('wav', 952500, 952500)}</w:r>`),
      [['esterna', 'media/x.png', 'image', 'External'], ['altro', 'media/x.png', 'oleObject'], ['wav', 'media/w.bin']],
      { 'word/media/x.png': png(), 'word/media/w.bin': wav });
    const d = await importaDocx(f);
    expect(d.paragrafi[0].runs.every((r) => r.im === undefined)).toBe(true);
  });

  it('il testo e le immagini nello stesso tratto restano nello stesso ordine', async () => {
    const f = await docxCon(pz(`<w:r><w:t>a</w:t>${disegno('r', 952500, 952500)}<w:t>b</w:t></w:r>`), [['r', 'media/x.png']], { 'word/media/x.png': png() });
    const d = await importaDocx(f);
    expect(mostra(d)).toEqual([['a', '[img 100x100 image/png;]', 'b']]);
  });

  it('un percorso assoluto nella relazione si legge; due immagini con la stessa relazione danno due tratti', async () => {
    const f = await docxCon(pz(`<w:r>${disegno('r', 952500, 952500)}</w:r><w:r>${disegno('r', 1905000, 1905000)}</w:r>`), [['r', '/word/media/x.png']], { 'word/media/x.png': png() });
    const d = await importaDocx(f);
    expect(mostra(d)).toEqual([['[img 100x100 image/png;]', '[img 200x200 image/png;]']]);
    expect(d.paragrafi[0].runs.length).toBe(2);
  });
});
