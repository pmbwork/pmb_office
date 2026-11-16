import { describe, it, expect } from 'vitest';
import { esportaOdt, importaOdt, MIME_ODT } from '../../src/formati/odt';
import { esporta, importa, formatoDaNome, nomeFile } from '../../src/formati/file';
import { daTesto, type Documento } from '../../src/modello/documento';
import { leggiZip } from '@comune/formati/zip';

describe('T411: Formato OpenDocument (.odt) per pmb_docs', () => {
  it('formatoDaNome e nomeFile riconoscono .odt', () => {
    expect(formatoDaNome('relazione.odt')).toBe('odt');
    expect(formatoDaNome('TEST.ODT')).toBe('odt');
    expect(nomeFile('Mio File', 'odt')).toBe('Mio File.odt');
  });

  it('esportaOdt produce un file ZIP valido con mimetype ODF non compresso', async () => {
    const doc: Documento = daTesto('Primo paragrafo\nSecondo paragrafo con testo');
    const bytes = await esportaOdt(doc);
    expect(bytes.length).toBeGreaterThan(100);

    const voci = await leggiZip(bytes);
    expect(voci.has('mimetype')).toBe(true);
    expect(new TextDecoder('utf-8').decode(voci.get('mimetype')!)).toBe(MIME_ODT);

    expect(voci.has('META-INF/manifest.xml')).toBe(true);
    expect(voci.has('content.xml')).toBe(true);
    expect(voci.has('styles.xml')).toBe(true);
  });

  it('andata e ritorno (round-trip) ODT conserva testo e struttura paragrafi', async () => {
    const doc: Documento = {
      paragrafi: [
        {
          runs: [
            { t: 'Titolo Principale', g: true, z: 18 },
          ],
          st: '1',
          al: 'ce',
        },
        {
          runs: [
            { t: 'Questo è un testo in ' },
            { t: 'grassetto', g: true },
            { t: ' e in ' },
            { t: 'corsivo', c: true },
            { t: ' e ' },
            { t: 'sottolineato', s: true },
            { t: '.' },
          ],
        },
      ],
    };

    const bytes = await esportaOdt(doc);
    const riletto = await importaOdt(bytes);

    expect(riletto.paragrafi.length).toBe(2);
    expect(riletto.paragrafi[0].runs.map((r) => r.t).join('')).toBe('Titolo Principale');
    expect(riletto.paragrafi[0].st).toBe('1');
    expect(riletto.paragrafi[0].al).toBe('ce');

    const testoP2 = riletto.paragrafi[1].runs.map((r) => r.t).join('');
    expect(testoP2).toBe('Questo è un testo in grassetto e in corsivo e sottolineato.');

    const runGrassetto = riletto.paragrafi[1].runs.find((r) => r.t === 'grassetto');
    expect(runGrassetto?.g).toBe(true);

    const runCorsivo = riletto.paragrafi[1].runs.find((r) => r.t === 'corsivo');
    expect(runCorsivo?.c).toBe(true);
  });

  it('round-trip ODT conserva le tabelle', async () => {
    const doc: Documento = {
      paragrafi: [
        { runs: [{ t: 'Cella 1,1' }], tb: { i: 1, r: 0, c: 0 } },
        { runs: [{ t: 'Cella 1,2' }], tb: { i: 1, r: 0, c: 1 } },
        { runs: [{ t: 'Cella 2,1' }], tb: { i: 1, r: 1, c: 0 } },
        { runs: [{ t: 'Cella 2,2' }], tb: { i: 1, r: 1, c: 1 } },
        { runs: [{ t: '' }] },
      ],
    };

    const bytes = await esporta(doc, 'odt');
    const { doc: riletto, formato } = await importa(bytes, 'tabella.odt');

    expect(formato).toBe('odt');
    expect(riletto.paragrafi.length).toBeGreaterThanOrEqual(4);

    const celleTab = riletto.paragrafi.filter((p) => p.tb !== undefined);
    expect(celleTab.length).toBe(4);
    expect(celleTab[0].runs[0].t).toBe('Cella 1,1');
    expect(celleTab[1].runs[0].t).toBe('Cella 1,2');
    expect(celleTab[2].runs[0].t).toBe('Cella 2,1');
    expect(celleTab[3].runs[0].t).toBe('Cella 2,2');
  });
});
