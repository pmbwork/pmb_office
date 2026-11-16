import { describe, it, expect } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, trova, type NodoXml } from '@comune/formati/xml';
import type { Documento, Run } from '../../src/modello/documento';

const dec = new TextDecoder('utf-8');
const enc = new TextEncoder();
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function documentoXml(doc: Documento): Promise<NodoXml> {
  const m = await leggiZip(await esportaDocx(doc));
  return analizzaXml(dec.decode(m.get('word/document.xml')!));
}
const giro = async (d: Documento): Promise<Documento> => importaDocx(await esportaDocx(d));
const tratti = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => [r.t, r.x, r.v]));
async function docxCon(corpo: string): Promise<Uint8Array> {
  return scriviZip(Object.entries({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`,
  }).map(([nome, testo]) => ({ nome, dati: enc.encode(testo) })));
}
const par = (runs: string): string => `<w:p>${runs}</w:p>`;
const r = (testo: string, rPr = ''): string => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t>${testo}</w:t></w:r>`;

describe('T323: scrivere barrato, apice e pedice', () => {
  it('un tratto barrato ha w:strike, uno in apice w:vertAlign superscript, uno in pedice subscript', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('a', { x: 'b' }), run('b', { v: 'p' }), run('c', { v: 'd' }), run('d')] }] };
    const x = await documentoXml(d);
    const p = trova(x, 'w:body/w:p')!;
    const rs = p.figli.filter((f): f is NodoXml => typeof f !== 'string' && f.nome === 'w:r');
    expect(rs).toHaveLength(4);
    expect(trova(rs[0], 'w:rPr/w:strike')).toBeDefined();
    expect(trova(rs[0], 'w:rPr/w:vertAlign')).toBeUndefined();
    expect(trova(rs[1], 'w:rPr/w:vertAlign')!.attributi['w:val']).toBe('superscript');
    expect(trova(rs[2], 'w:rPr/w:vertAlign')!.attributi['w:val']).toBe('subscript');
    expect(trova(rs[3], 'w:rPr/w:strike')).toBeUndefined();
    expect(trova(rs[3], 'w:rPr/w:vertAlign')).toBeUndefined();
  });

  it('i due attributi stanno nell\'ordine dello schema di Word: strike prima del colore, vertAlign dopo l\'evidenziazione', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('a', { x: 'b', v: 'p', g: true, c: true, k: '#ff0000', z: 12, h: '#ffff00', s: true })] }] };
    const rPr = trova(await documentoXml(d), 'w:body/w:p/w:r/w:rPr')!;
    const nomi = rPr.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome);
    expect(nomi.indexOf('w:strike')).toBeGreaterThan(nomi.indexOf('w:i'));
    expect(nomi.indexOf('w:strike')).toBeLessThan(nomi.indexOf('w:color'));
    expect(nomi.indexOf('w:vertAlign')).toBeGreaterThan(nomi.indexOf('w:u'));
    expect(nomi.indexOf('w:vertAlign')).toBeGreaterThan(nomi.indexOf('w:shd'));
  });

  it('un documento senza questi attributi non scrive né strike né vertAlign', async () => {
    const x = await documentoXml({ paragrafi: [{ runs: [run('ciao', { g: true })] }] });
    expect(trova(x, 'w:body/w:p/w:r/w:rPr/w:strike')).toBeUndefined();
    expect(trova(x, 'w:body/w:p/w:r/w:rPr/w:vertAlign')).toBeUndefined();
  });
});

describe('T323: leggere barrato, apice e pedice', () => {
  it('w:strike e w:vertAlign di un file Word diventano gli attributi', async () => {
    const f = await docxCon(par(r('uno', '<w:strike/>') + r('due', '<w:vertAlign w:val="superscript"/>') + r('tre', '<w:vertAlign w:val="subscript"/>') + r('quattro')));
    expect(tratti(await importaDocx(f))).toEqual([[['uno', 'b', undefined], ['due', undefined, 'p'], ['tre', undefined, 'd'], ['quattro', undefined, undefined]]]);
  });

  it('strike spento (val 0, false, off) e vertAlign baseline non fanno niente', async () => {
    const f = await docxCon(par(r('uno', '<w:strike w:val="0"/>') + r('due', '<w:strike w:val="false"/>') + r('tre', '<w:strike w:val="off"/>') + r('quattro', '<w:vertAlign w:val="baseline"/>')));
    const letto = await importaDocx(f);
    expect(letto.paragrafi[0].runs.map((x) => [x.x, x.v])).toEqual([[undefined, undefined]]);
    expect(letto.paragrafi[0].runs[0].t).toBe('unoduetrequattro');
  });

  it('strike acceso con val 1 o true conta come barrato', async () => {
    const f = await docxCon(par(r('uno', '<w:strike w:val="1"/>') + r('due', '<w:strike w:val="true"/>')));
    expect(tratti(await importaDocx(f))).toEqual([[['unodue', 'b', undefined]]]);
  });

  it('barrato e apice insieme con grassetto e colore: si leggono tutti', async () => {
    const f = await docxCon(par(r('x', '<w:b/><w:strike/><w:color w:val="FF0000"/><w:vertAlign w:val="subscript"/>')));
    const t = (await importaDocx(f)).paragrafi[0].runs[0];
    expect([t.g, t.x, t.v, t.k]).toEqual([true, 'b', 'd', '#ff0000']);
  });
});

describe('T323: andata e ritorno', () => {
  it('i tre casi tornano uguali, anche insieme agli altri formati', async () => {
    const d: Documento = { paragrafi: [
      { runs: [run('uno ', { x: 'b' }), run('due ', { v: 'p' }), run('tre', { v: 'd' })] },
      { runs: [run('misto', { x: 'b', v: 'p', g: true, c: true, s: true, k: '#00ff00' })] },
    ] };
    const letto = await giro(d);
    expect(tratti(letto)).toEqual(tratti(d));
    expect(letto.paragrafi[1].runs[0]).toMatchObject({ g: true, c: true, s: true, k: '#00ff00', x: 'b', v: 'p' });
  });

  it('un documento senza questi attributi resta senza dopo il giro', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('ciao ', { g: true }), run('mondo')] }] };
    const letto = await giro(d);
    expect(letto.paragrafi[0].runs.every((x) => x.x === undefined && x.v === undefined)).toBe(true);
  });
});
