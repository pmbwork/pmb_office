// T442: le note a piè di pagina e di chiusura di Word si importano come le note di pmb_docs (numero in apice + paragrafo in fondo).
import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { daTesto, type Documento } from '../../src/modello/documento';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const T = (t: string) => `<w:r><w:t>${t}</w:t></w:r>`;
const RIF = (id: number) => `<w:r><w:rPr><w:rStyle w:val="Rimandonotaapièdipagina"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
const RIFE = (id: number) => `<w:r><w:endnoteReference w:id="${id}"/></w:r>`;

async function conNote(corpo: string, note?: string, chiusura?: string): Promise<Documento> {
  const voci = await leggiZip(await esportaDocx(daTesto('x')));
  const xml = new TextDecoder().decode(voci.get('word/document.xml')!).replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${corpo}$1`);
  voci.set('word/document.xml', new TextEncoder().encode(xml));
  if (note !== undefined) voci.set('word/footnotes.xml', new TextEncoder().encode(`<?xml version="1.0"?><w:footnotes ${NS}>${note}</w:footnotes>`));
  if (chiusura !== undefined) voci.set('word/endnotes.xml', new TextEncoder().encode(`<?xml version="1.0"?><w:endnotes ${NS}>${chiusura}</w:endnotes>`));
  return importaDocx(await scriviZip(Array.from(voci, ([nome, dati]) => ({ nome, dati }))));
}
const testi = (d: Documento) => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const SEP = '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>';
const NOTA = (id: number, t: string) => `<w:footnote w:id="${id}"><w:p><w:r><w:footnoteRef/></w:r>${T(' ' + t)}</w:p></w:footnote>`;

describe('T442: note di Word', () => {
  it('una nota: numero in apice nel testo e paragrafo "1. testo" in fondo con la linea sopra', async () => {
    const d = await conNote(`<w:p>${T('Testo con nota')}${RIF(1)}${T(' e altro')}</w:p>`, SEP + NOTA(1, 'Testo della nota'));
    expect(testi(d)).toEqual(['Testo con nota1 e altro', '1. Testo della nota']);
    const apice = d.paragrafi[0].runs.find((r) => r.v === 'p');
    expect(apice?.t).toBe('1');
    expect(d.paragrafi[1].hr).toBe(true);
    expect(d.paragrafi[1].runs.map((r) => [r.t, !!r.g, r.z])).toEqual([['1. ', true, 9], ['Testo della nota', false, 9]]);
  });
  it('più note: numerate nell\'ordine in cui compaiono nel testo, non per identificativo; solo la prima ha la linea', async () => {
    const d = await conNote(`<w:p>${T('a')}${RIF(7)}</w:p><w:p>${T('b')}${RIF(3)}</w:p>`, SEP + NOTA(3, 'terza') + NOTA(7, 'settima'));
    expect(testi(d)).toEqual(['a1', 'b2', '1. settima', '2. terza']);
    expect(d.paragrafi.map((p) => p.hr === true)).toEqual([false, false, true, false]);
  });
  it('le note di chiusura (endnotes) si trattano allo stesso modo, nello stesso elenco numerato', async () => {
    const fine = '<w:endnote w:id="1"><w:p><w:r><w:endnoteRef/></w:r><w:r><w:t> di chiusura</w:t></w:r></w:p></w:endnote>';
    const d = await conNote(`<w:p>${T('x')}${RIF(1)}${T(' y')}${RIFE(1)}</w:p>`, SEP + NOTA(1, 'a piè'), fine);
    expect(testi(d)).toEqual(['x1 y2', '1. a piè', '2. di chiusura']);
  });
  it('una nota su più paragrafi diventa un solo paragrafo, con gli spazi ridotti', async () => {
    const lunga = '<w:footnote w:id="1"><w:p>' + T('Prima   riga') + '</w:p><w:p>' + T('seconda riga') + '</w:p></w:footnote>';
    const d = await conNote(`<w:p>${T('t')}${RIF(1)}</w:p>`, lunga);
    expect(testi(d)[1]).toBe('1. Prima riga seconda riga');
  });
  it('un riferimento a una nota che non esiste non lascia numeri né paragrafi', async () => {
    const d = await conNote(`<w:p>${T('t')}${RIF(9)}</w:p>`, SEP + NOTA(1, 'altra'));
    expect(testi(d)).toEqual(['t']);
    const senzaFile = await conNote(`<w:p>${T('t')}${RIF(1)}</w:p>`);
    expect(testi(senzaFile)).toEqual(['t']);
  });
  it('un documento senza note non cambia', async () => {
    expect(testi(await conNote(`<w:p>${T('solo testo')}</w:p>`, SEP))).toEqual(['solo testo']);
  });
  it('esportando e rileggendo le note restano (come testo e apice)', async () => {
    const d = await conNote(`<w:p>${T('Testo')}${RIF(1)}</w:p>`, SEP + NOTA(1, 'Nota'));
    const r = await importaDocx(await esportaDocx(d));
    expect(testi(r)).toEqual(['Testo1', '1. Nota']);
    expect(r.paragrafi[0].runs.some((x) => x.v === 'p' && x.t === '1')).toBe(true);
  });
  it('al massimo 200 note: le altre si ignorano', async () => {
    const note = Array.from({ length: 205 }, (_, i) => NOTA(i + 1, `n${i + 1}`)).join('');
    const corpo = `<w:p>${Array.from({ length: 205 }, (_, i) => RIF(i + 1)).join('')}</w:p>`;
    const d = await conNote(corpo, SEP + note);
    expect(d.paragrafi.length).toBe(201);
    expect(testi(d)[200]).toBe('200. n200');
  });
});
