// T448: .docx: più w:br nello stesso paragrafo, valori "0", interlinea esatta, ordine di w:pPr, nomi dei segnalibri.
import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { alternaElenco, daTesto, impostaBordo, impostaSegnalibro, applicaParagrafo, type Documento } from '../../src/modello/documento';

const T = (t: string) => `<w:r><w:t>${t}</w:t></w:r>`;
const BR = '<w:r><w:br/></w:r>';
const STILI = `<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normale"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Elenco"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normale"/><w:pPr><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="ElencoLibero"><w:name w:val="Elenco libero"/><w:basedOn w:val="Elenco"/><w:pPr><w:contextualSpacing w:val="0"/></w:pPr></w:style>`;

async function conCorpo(corpo: string, stili = STILI): Promise<Documento> {
  const voci = await leggiZip(await esportaDocx(daTesto('x')));
  voci.set('word/document.xml', new TextEncoder().encode(new TextDecoder().decode(voci.get('word/document.xml')!).replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${corpo}$1`)));
  voci.set('word/styles.xml', new TextEncoder().encode(`<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${stili}</w:styles>`));
  return importaDocx(await scriviZip(Array.from(voci, ([nome, dati]) => ({ nome, dati }))));
}
const testi = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const documentoXml = async (d: Documento): Promise<string> => new TextDecoder().decode((await leggiZip(await esportaDocx(d))).get('word/document.xml')!);

describe('T448: più w:br nello stesso paragrafo', () => {
  it('salto di pagina, spazio prima e bordo si ripetono bene: il salto e lo spazio prima solo sul primo pezzo, lo spazio dopo solo sull\'ultimo', async () => {
    const d = await conCorpo(`<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="240" w:after="400"/></w:pPr>${T('uno')}${BR}${T('due')}${BR}${T('tre')}</w:p>`);
    expect(testi(d)).toEqual(['uno', 'due', 'tre']);
    expect(d.paragrafi.map((p) => p.sp === true)).toEqual([true, false, false]);
    expect(d.paragrafi.map((p) => p.sb)).toEqual([12, undefined, undefined]);
    expect(d.paragrafi.map((p) => p.sa)).toEqual([undefined, undefined, 20]);
  });
  it('un paragrafo con segnalibro e più w:br: il segnalibro è uno solo', async () => {
    const d = await conCorpo(`<w:p><w:bookmarkStart w:id="1" w:name="Qui"/>${T('uno')}${BR}${T('due')}<w:bookmarkEnd w:id="1"/></w:p>`);
    expect(d.paragrafi.filter((p) => p.sg !== undefined).length).toBe(1);
  });
});

describe('T448: valori "0" e interlinea', () => {
  it('pageBreakBefore con w:val="0" non è un salto di pagina; senza val lo è', async () => {
    const d = await conCorpo(`<w:p><w:pPr><w:pageBreakBefore w:val="0"/></w:pPr>${T('a')}</w:p><w:p><w:pPr><w:pageBreakBefore w:val="1"/></w:pPr>${T('b')}</w:p><w:p><w:pPr><w:pageBreakBefore/></w:pPr>${T('c')}</w:p>`);
    expect(d.paragrafi.map((p) => p.sp === true)).toEqual([false, true, true]);
  });
  it('contextualSpacing con val="0" annulla quella ereditata dallo stile da cui si deriva', async () => {
    const voce = (stile: string, t: string) => `<w:p><w:pPr><w:pStyle w:val="${stile}"/></w:pPr>${T(t)}</w:p>`;
    const stretto = await conCorpo(voce('Elenco', 'a') + voce('Elenco', 'b'));
    expect(stretto.paragrafi.map((p) => p.sa)).toEqual([undefined, 8]); // tra le due voci niente spazio
    const largo = await conCorpo(voce('ElencoLibero', 'a') + voce('ElencoLibero', 'b'));
    expect(largo.paragrafi.map((p) => p.sa)).toEqual([8, 8]); // lo stile figlio la spegne: spazio normale
  });
  it('un\'interlinea esatta o minima nel paragrafo annulla quella dei predefiniti (non si può rappresentare, ma non deve restare 1,08)', async () => {
    const d = await conCorpo(`<w:p><w:pPr><w:spacing w:line="360" w:lineRule="exact"/></w:pPr>${T('a')}</w:p><w:p><w:pPr><w:spacing w:line="300" w:lineRule="atLeast"/></w:pPr>${T('b')}</w:p><w:p>${T('c')}</w:p>`);
    expect(d.paragrafi.map((p) => p.ls)).toEqual([undefined, undefined, 1.08]);
  });
});

describe('T448: esportazione', () => {
  it('gli elementi di w:pPr seguono l\'ordine dello schema (pStyle, pageBreakBefore, numPr, pBdr, spacing, ind, jc)', async () => {
    let d: Documento = daTesto('titolo');
    d = alternaElenco(d, { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'p');
    d = impostaBordo(d, { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, {});
    d = applicaParagrafo(applicaParagrafo(applicaParagrafo(applicaParagrafo(d, { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'sa', 6), { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'sp', true), { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'st', '1'), { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, 'al', 'ce');
    const xml = await documentoXml(d);
    const ordine = ['<w:pStyle', '<w:pageBreakBefore', '<w:numPr', '<w:pBdr', '<w:spacing', '<w:jc'].map((t) => xml.indexOf(t));
    expect(ordine.every((i) => i > 0)).toBe(true);
    expect([...ordine].sort((a, b) => a - b)).toEqual(ordine);
  });
  it('due segnalibri che per Word avrebbero lo stesso nome ottengono nomi diversi, e si rileggono entrambi', async () => {
    let d = daTesto('uno\ndue');
    d = impostaSegnalibro(d, 0, 'a b');
    d = impostaSegnalibro(d, 1, 'a_b');
    const xml = await documentoXml(d);
    const nomi = [...xml.matchAll(/w:bookmarkStart w:id="\d+" w:name="([^"]+)"/g)].map((m) => m[1]);
    expect(nomi.length).toBe(2);
    expect(new Set(nomi.map((n) => n.toLowerCase())).size).toBe(2);
    const letto = await importaDocx(await esportaDocx(d));
    expect(letto.paragrafi.filter((p) => p.sg !== undefined).length).toBe(2);
  });
  it('un secondo salvataggio riparte dai nomi puliti (niente _2 di troppo)', async () => {
    const d = impostaSegnalibro(daTesto('uno'), 0, 'Capitolo');
    const primo = await documentoXml(d);
    const secondo = await documentoXml(d);
    expect(primo).toContain('w:name="Capitolo"');
    expect(secondo).toContain('w:name="Capitolo"');
  });
});
