import { describe, it, expect } from 'vitest';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { analizzaXml, figliElemento, trova, type NodoXml } from '@comune/formati/xml';
import { daTesto, serializza, type Documento, type Run } from '../../src/modello/documento';

const dec = new TextDecoder('utf-8');
const enc = new TextEncoder();
const run = (t: string, extra: Partial<Run> = {}): Run => ({ t, g: false, c: false, s: false, ...extra });
const U1 = 'https://esempio.it/a?x=1&y=2';
const U2 = 'mailto:me@esempio.it';

async function parti(doc: Documento): Promise<Map<string, NodoXml>> {
  const m = await leggiZip(await esportaDocx(doc));
  const out = new Map<string, NodoXml>();
  for (const [nome, dati] of m) out.set(nome, analizzaXml(dec.decode(dati)));
  return out;
}
const giro = async (d: Documento): Promise<Documento> => importaDocx(await esportaDocx(d));
const tratti = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => [r.t, r.u]));

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** un file Word con il corpo dato e le relazioni dei link date come [id, indirizzo] */
async function docxCon(corpo: string, link: Array<[string, string]> = [], tipoRel = `${REL}/hyperlink`): Promise<Uint8Array> {
  const rels = link.map(([id, t]) => `<Relationship Id="${id}" Type="${tipoRel}" Target="${t}" TargetMode="External"/>`).join('');
  return scriviZip(Object.entries({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<?xml version="1.0"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
  }).map(([nome, testo]) => ({ nome, dati: enc.encode(testo) })));
}

describe('T091: esportare i link', () => {
  it('un link diventa un w:hyperlink con una relazione esterna e lo stile Hyperlink', async () => {
    const d: Documento = { paragrafi: [{ runs: [run('vai su '), run('questo sito', { u: U1 }), run(' ora')] }] };
    const p = await parti(d);
    const par = trova(p.get('word/document.xml')!, 'w:body/w:p')!;
    expect(par.figli.filter((f): f is NodoXml => typeof f !== 'string').map((f) => f.nome)).toEqual(['w:r', 'w:hyperlink', 'w:r']);
    const h = trova(par, 'w:hyperlink')!;
    expect(h.attributi['r:id']).toBe('rId3');
    expect(trova(h, 'w:r/w:rPr/w:rStyle')!.attributi['w:val']).toBe('Hyperlink');
    expect(trova(h, 'w:r/w:t')!.figli[0]).toBe('questo sito');
    const rel = figliElemento(p.get('word/_rels/document.xml.rels')!, 'Relationship');
    expect(rel.map((r) => r.attributi['Id'])).toEqual(['rId1', 'rId2', 'rId3']);
    expect(rel[2].attributi).toEqual({ Id: 'rId3', Type: `${REL}/hyperlink`, Target: U1, TargetMode: 'External' });
    const stile = figliElemento(p.get('word/styles.xml')!, 'w:style').find((s) => s.attributi['w:styleId'] === 'Hyperlink')!;
    expect(stile.attributi['w:type']).toBe('character');
    expect(trova(stile, 'w:rPr/w:color')!.attributi['w:val']).toBe('1155CC');
    expect(trova(stile, 'w:rPr/w:u')!.attributi['w:val']).toBe('single');
  });

  it('senza link il pacchetto resta quello di prima: due relazioni e nessuno stile di carattere', async () => {
    const p = await parti(daTesto('niente link'));
    expect(figliElemento(p.get('word/_rels/document.xml.rels')!, 'Relationship').length).toBe(2);
    expect(figliElemento(p.get('word/styles.xml')!, 'w:style').map((s) => s.attributi['w:styleId'])).toEqual(['Normal', 'Heading1', 'Heading2', 'Heading3', 'Title', 'Subtitle']);
    expect(trova(p.get('word/document.xml')!, 'w:body/w:p/w:hyperlink')).toBeUndefined();
  });

  it('lo stesso indirizzo ripetuto ha una sola relazione, indirizzi diversi ne hanno una ciascuno; tratti vicini dello stesso link stanno in un solo w:hyperlink', async () => {
    const d: Documento = { paragrafi: [
      { runs: [run('a', { u: U1 }), run('b', { u: U1, g: true }), run('c', { u: U2 }), run('d')] },
      { runs: [run('e', { u: U1 })] },
    ] };
    const p = await parti(d);
    const corpo = trova(p.get('word/document.xml')!, 'w:body')!;
    const [p1, p2] = figliElemento(corpo, 'w:p');
    const h1 = figliElemento(p1, 'w:hyperlink');
    expect(h1.map((h) => [h.attributi['r:id'], figliElemento(h, 'w:r').length])).toEqual([['rId3', 2], ['rId4', 1]]);
    expect(figliElemento(p2, 'w:hyperlink')[0].attributi['r:id']).toBe('rId3');
    expect(figliElemento(p.get('word/_rels/document.xml.rels')!, 'Relationship').map((r) => r.attributi['Target'])).toEqual(['styles.xml', 'numbering.xml', U1, U2]);
  });

  it('i caratteri speciali dell\'indirizzo (e commerciale, virgolette, apice) sopravvivono', async () => {
    const u = 'https://esempio.it/p?a=1&b="2"&c=\'3\'';
    const d = await giro({ paragrafi: [{ runs: [run('x', { u })] }] });
    expect(d.paragrafi[0].runs[0].u).toBe(u);
  });
});

describe('T091: andata e ritorno', () => {
  it('il documento con link torna identico: testo, link, grassetto dentro il link, colore, elenco, titolo', async () => {
    const d: Documento = { paragrafi: [
      { st: '1', runs: [run('Titolo con '), run('link', { u: U1 })] },
      { el: 'p', runs: [run('uno '), run('due', { u: U1, g: true, k: '#ff0000' }), run(' tre', { u: U1, c: true })] },
      { runs: [run('mail: '), run('me@esempio.it', { u: U2, f: 'Georgia', z: 14 }), run('.')] },
      { runs: [] },
    ] };
    const r = await giro(d);
    expect(serializza(r)).toBe(serializza(d));
  });

  it('un link con testo sottolineato esplicito torna senza la sottolineatura, che è quella del link', async () => {
    const r = await giro({ paragrafi: [{ runs: [run('x', { u: U1, s: true })] }] });
    expect(tratti(r)).toEqual([[['x', U1]]]);
    expect(r.paragrafi[0].runs[0].s).toBe(false);
  });

  it('un indirizzo non ammesso non si esporta come link nel file riletto', async () => {
    const sbagliato: Documento = { paragrafi: [{ runs: [run('x', { u: 'javascript:alert(1)' })] }] };
    const r = await giro(sbagliato);
    expect(tratti(r)).toEqual([[['x', undefined]]]);
  });
});

describe('T091: importare i link degli altri programmi', () => {
  it('il link di Word: testo, indirizzo e formato del testo; l\'azzurro del link non diventa un colore', async () => {
    const corpo = `<w:p><w:r><w:t xml:space="preserve">vai su </w:t></w:r><w:hyperlink r:id="rId7" w:history="1">
      <w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:b/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>il sito</w:t></w:r>
      <w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve"> di prova</w:t></w:r></w:hyperlink><w:r><w:t>!</w:t></w:r></w:p>`;
    const d = await importaDocx(await docxCon(corpo, [['rId7', 'https://www.esempio.it/']]));
    expect(d.paragrafi[0].runs.map((r) => [r.t, r.u, r.g, r.k, r.s])).toEqual([
      ['vai su ', undefined, false, undefined, false],
      ['il sito', 'https://www.esempio.it/', true, undefined, false],
      [' di prova', 'https://www.esempio.it/', false, undefined, false],
      ['!', undefined, false, undefined, false],
    ]);
  });

  it('il link di Google Documenti (colore 1155CC e sottolineato scritti sul testo) torna senza colore né sottolineato', async () => {
    const corpo = `<w:p><w:hyperlink r:id="rId1"><w:r><w:rPr><w:color w:val="1155CC"/><w:u w:val="single"/></w:rPr><w:t>g</w:t></w:r></w:hyperlink><w:r><w:rPr><w:color w:val="1155CC"/></w:rPr><w:t>fuori</w:t></w:r></w:p>`;
    const d = await importaDocx(await docxCon(corpo, [['rId1', 'https://g.it']]));
    expect(d.paragrafi[0].runs.map((r) => [r.t, r.u, r.k, r.s])).toEqual([['g', 'https://g.it', undefined, false], ['fuori', undefined, '#1155cc', false]]);
  });

  it('un colore diverso dall\'azzurro dentro il link resta', async () => {
    const corpo = `<w:p><w:hyperlink r:id="rId1"><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>rosso</w:t></w:r></w:hyperlink></w:p>`;
    const d = await importaDocx(await docxCon(corpo, [['rId1', 'https://g.it']]));
    expect(d.paragrafi[0].runs[0].k).toBe('#ff0000');
  });

  it('non diventano link: indirizzi non ammessi, relazione che non c\'è, rimando interno (anchor), relazione di altro tipo; il testo resta', async () => {
    const corpo = `<w:p>
      <w:hyperlink r:id="rId1"><w:r><w:t>js </w:t></w:r></w:hyperlink>
      <w:hyperlink r:id="rId99"><w:r><w:t>manca </w:t></w:r></w:hyperlink>
      <w:hyperlink w:anchor="segnalibro"><w:r><w:t>interno </w:t></w:r></w:hyperlink>
      <w:hyperlink r:id="rId3"><w:r><w:t>file </w:t></w:r></w:hyperlink>
      <w:hyperlink r:id="rId4"><w:r><w:t>immagine</w:t></w:r></w:hyperlink></w:p>`;
    const zip = await docxCon(corpo, [['rId1', 'javascript:alert(1)'], ['rId3', 'file:///c:/x.txt']]);
    const d = await importaDocx(zip);
    expect(d.paragrafi[0].runs.every((r) => r.u === undefined)).toBe(true);
    expect(d.paragrafi[0].runs.map((r) => r.t).join('')).toBe('js manca interno file immagine');
    const altro = await importaDocx(await docxCon(`<w:p><w:hyperlink r:id="rId1"><w:r><w:t>x</w:t></w:r></w:hyperlink></w:p>`, [['rId1', 'https://a.it']], `${REL}/image`));
    expect(altro.paragrafi[0].runs[0].u).toBeUndefined();
  });

  it('i campi semplici HYPERLINK "indirizzo" sono link, quelli con indirizzo non ammesso no', async () => {
    const corpo = `<w:p><w:fldSimple w:instr=" HYPERLINK &quot;https://campo.it/x&quot; "><w:r><w:t>campo</w:t></w:r></w:fldSimple><w:fldSimple w:instr="HYPERLINK &quot;javascript:1&quot;"><w:r><w:t> no</w:t></w:r></w:fldSimple></w:p>`;
    const d = await importaDocx(await docxCon(corpo));
    expect(tratti(d)).toEqual([[['campo', 'https://campo.it/x'], [' no', undefined]]]);
  });

  it('un link che contiene un a capo manuale prosegue nel paragrafo dopo', async () => {
    const corpo = `<w:p><w:hyperlink r:id="rId1"><w:r><w:t>uno</w:t><w:br/><w:t>due</w:t></w:r></w:hyperlink></w:p>`;
    const d = await importaDocx(await docxCon(corpo, [['rId1', 'https://a.it']]));
    expect(tratti(d)).toEqual([[['uno', 'https://a.it']], [['due', 'https://a.it']]]);
  });

  it('un link che contiene testo in una modifica registrata o in un tag intelligente resta un link', async () => {
    const corpo = `<w:p><w:hyperlink r:id="rId1"><w:ins w:id="1"><w:r><w:t>ins</w:t></w:r></w:ins><w:smartTag w:uri="x" w:element="y"><w:r><w:t>tag</w:t></w:r></w:smartTag></w:hyperlink><w:r><w:t> fuori</w:t></w:r></w:p>`;
    const d = await importaDocx(await docxCon(corpo, [['rId1', 'https://a.it']]));
    // l'inserito resta segnato come modifica registrata (un tratto a sé, T553), sempre nel link
    expect(tratti(d)).toEqual([[['ins', 'https://a.it'], ['tag', 'https://a.it'], [' fuori', undefined]]]);
  });
});
