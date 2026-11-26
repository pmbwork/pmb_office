// T439: l'interruzione di pagina di Word (w:br type="page") si importa come salto di pagina.
import { describe, it, expect } from 'vitest';
import { leggiZip, scriviZip } from '@comune/formati/zip';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { daTesto } from '../../src/modello/documento';

async function conCorpo(corpo: string) {
  const voci = await leggiZip(await esportaDocx(daTesto('x')));
  const xml = new TextDecoder().decode(voci.get('word/document.xml')!);
  const nuovo = xml.replace(/<w:body>[\s\S]*?(<w:sectPr)/, `<w:body>${corpo}$1`);
  voci.set('word/document.xml', new TextEncoder().encode(nuovo));
  return importaDocx(await scriviZip(Array.from(voci, ([nome, dati]) => ({ nome, dati }))));
}
const testi = (d: { paragrafi: Array<{ runs: Array<{ t: string }> }> }) => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const salti = (d: { paragrafi: Array<{ sp?: boolean }> }) => d.paragrafi.map((p) => p.sp === true);
const BR = '<w:r><w:br w:type="page"/></w:r>';
const T = (t: string) => `<w:r><w:t>${t}</w:t></w:r>`;

describe('T439: interruzione di pagina di Word', () => {
  it('interruzione a inizio paragrafo, con il testo dopo: quel paragrafo comincia su un foglio nuovo (come fa Word)', async () => {
    const d = await conCorpo(`<w:p>${T('prima')}</w:p><w:p>${BR}${T('dopo')}</w:p><w:p>${T('ancora')}</w:p>`);
    expect(testi(d)).toEqual(['prima', 'dopo', 'ancora']);
    expect(salti(d)).toEqual([false, true, false]);
  });
  it('interruzione in fondo al paragrafo: niente paragrafo vuoto, il salto passa al paragrafo dopo', async () => {
    const d = await conCorpo(`<w:p>${T('prima')}${BR}</w:p><w:p>${T('dopo')}</w:p>`);
    expect(testi(d)).toEqual(['prima', 'dopo']);
    expect(salti(d)).toEqual([false, true]);
  });
  it('interruzione in mezzo al testo: il paragrafo si divide e la seconda parte va a capo di pagina', async () => {
    const d = await conCorpo(`<w:p>${T('uno')}${BR}${T('due')}</w:p>`);
    expect(testi(d)).toEqual(['uno', 'due']);
    expect(salti(d)).toEqual([false, true]);
  });
  // dal 2026-11-25, come Word: un paragrafo con la sola interruzione non lascia una riga vuota in cima al foglio nuovo (Word mostra il segno
  // di paragrafo in fondo al foglio prima; nel PDF di Word il titolo dopo l'interruzione sta alla stessa altezza di uno in cima a una
  // pagina qualsiasi, 99,7 contro 99,5 pixel): il foglio nuovo comincia con il paragrafo che segue
  it('un paragrafo con la sola interruzione: il foglio nuovo comincia con il paragrafo che segue', async () => {
    const d = await conCorpo(`<w:p>${T('prima')}</w:p><w:p>${BR}</w:p><w:p>${T('dopo')}</w:p>`);
    expect(testi(d)).toEqual(['prima', 'dopo']);
    expect(salti(d)).toEqual([false, true]);
  });
  it('un\'interruzione da sola in fondo al documento: resta il paragrafo vuoto sul foglio nuovo', async () => {
    const d = await conCorpo(`<w:p>${T('prima')}</w:p><w:p>${BR}</w:p>`);
    expect(testi(d)).toEqual(['prima', '']);
    expect(salti(d)).toEqual([false, true]);
  });
  it('più interruzioni: ogni foglio nuovo è segnato una sola volta', async () => {
    const d = await conCorpo(`<w:p>${T('a')}${BR}${T('b')}${BR}${T('c')}</w:p>`);
    expect(testi(d)).toEqual(['a', 'b', 'c']);
    expect(salti(d)).toEqual([false, true, true]);
  });
  it('a capo normale (w:br senza tipo) resta un nuovo paragrafo senza salto di pagina', async () => {
    const d = await conCorpo(`<w:p>${T('uno')}<w:r><w:br/></w:r>${T('due')}</w:p>`);
    expect(testi(d)).toEqual(['uno', 'due']);
    expect(salti(d)).toEqual([false, false]);
  });
  it('esportando e rileggendo il salto non si perde', async () => {
    const d = await conCorpo(`<w:p>${T('prima')}</w:p><w:p>${BR}${T('dopo')}</w:p>`);
    const r = await importaDocx(await esportaDocx(d));
    expect(salti(r)).toEqual([false, true]);
  });
});
