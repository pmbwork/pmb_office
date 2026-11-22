// T570: spazi e tabulazioni in ODT (verifica del 2026-11-22). In ODF spazi ripetuti, tabulazioni e a capo dentro il paragrafo sono elementi
// (text:s con text:c, text:tab, text:line-break): pmb_docs li perdeva leggendo i file di LibreOffice («a⇥b» → «ab», spazi multipli → uno,
// lo spazio dopo un rimando spariva) e li scriveva come caratteri, che LibreOffice riduce a uno spazio.
import { describe, expect, test } from 'vitest';
import { importa, esporta } from '../../src/formati/file';
import { testoOdf } from '../../src/formati/odt';
import { leggiZip } from '@comune/formati/zip';
import type { Documento } from '../../src/modello/documento';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const fodt = (corpo: string): string => '<?xml version="1.0" encoding="UTF-8"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text"><office:body><office:text>'
  + corpo + '</office:text></office:body></office:document>';
const testi = (d: Documento): string[] => d.paragrafi.map((p) => p.runs.map((r) => r.t).join(''));
const r = (t: string) => ({ t, g: false, c: false, s: false });

describe('T570: spazi e tabulazioni in ODT', () => {
  test('dai file di LibreOffice: spazi ripetuti, spazio iniziale, spazio dopo un elemento, tabulazione, a capo', async () => {
    const d = (await importa(enc(fodt('<text:p>a <text:s text:c="2"/>b</text:p><text:p><text:s/>rientrato</text:p>'
      + '<text:p><text:span>uno</text:span><text:s/>due</text:p><text:p>a<text:tab/>b</text:p><text:p>riga1<text:line-break/>riga2</text:p>')), 'prova.fodt')).doc;
    expect(testi(d)).toEqual(['a   b', ' rientrato', 'uno due', 'a\tb', 'riga1 riga2']);
  });
  test('scrivendo: tabulazione e spazi che ODF ridurrebbe diventano text:tab e text:s', () => {
    expect(testoOdf('a\tb')).toBe('a<text:tab/>b');
    expect(testoOdf('a   b')).toBe('a <text:s text:c="2"/>b');
    expect(testoOdf(' iniziale')).toBe('<text:s/>iniziale');
    expect(testoOdf('finale ')).toBe('finale<text:s/>');
    expect(testoOdf('normale testo')).toBe('normale testo');
    expect(testoOdf('a < b & c')).toBe('a &lt; b &amp; c');
  });
  test('andata e ritorno da pmb_docs: .odt scritto e riletto uguale', async () => {
    const doc: Documento = { paragrafi: [{ runs: [r('Nome:\tMario   Rossi ')] }, { runs: [r(' rientro'), r('  due')] }] };
    const odt = await esporta(doc, 'odt');
    const xml = new TextDecoder().decode((await leggiZip(odt)).get('content.xml')!);
    expect(xml).toContain('<text:tab/>');
    expect(xml).toContain('<text:s text:c="2"/>');
    expect(testi((await importa(odt, 'x.odt')).doc)).toEqual(['Nome:\tMario   Rossi ', ' rientro  due']);
  });
});
