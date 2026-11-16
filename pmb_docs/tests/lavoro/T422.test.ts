import { describe, it, expect } from 'vitest';
import { esportaPdf } from '../../src/formati/pdf';
import { esporta, formatoDaNome } from '../../src/formati/file';
import type { Documento } from '../../src/modello/documento';

describe('T422 — T424: Esportazione diretta in PDF puro', () => {
  it('nomeFile con formato pdf produce estensione .pdf', async () => {
    const { nomeFile } = await import('../../src/formati/file');
    expect(nomeFile('Relazione', 'pdf')).toBe('Relazione.pdf');
  });

  it('esportaPdf genera un buffer PDF 1.4 valido con intestazione e trailer', () => {
    const doc: Documento = {
      paragrafi: [
        {
          st: 't',
          runs: [{ t: 'Titolo del Documento', g: true, c: false, s: false, z: 24, k: '#1a73e8' }],
        },
        {
          al: 'gi',
          runs: [
            { t: 'Questo è un paragrafo di prova con ', g: false, c: false, s: false },
            { t: 'testo in grassetto', g: true, c: false, s: false },
            { t: ' e ', g: false, c: false, s: false },
            { t: 'testo in corsivo sottolineato.', g: false, c: true, s: true },
          ],
        },
      ],
    };

    const bytes = esportaPdf(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    const testoPdf = new TextDecoder('latin1').decode(bytes);
    // Header PDF
    expect(testoPdf.startsWith('%PDF-1.4')).toBe(true);
    // Presenza oggetti Catalog, Pages, Font
    expect(testoPdf).toContain('/Type /Catalog');
    expect(testoPdf).toContain('/Type /Pages');
    expect(testoPdf).toContain('/BaseFont /Helvetica');
    expect(testoPdf).toContain('/BaseFont /Helvetica-Bold');
    // Presenza testo formattato ed escaped
    expect(testoPdf).toContain('(Titolo del Documento) Tj');
    expect(testoPdf).toContain('(testo in grassetto) Tj');
    // Presenza tabella xref e trailer
    expect(testoPdf).toContain('xref');
    expect(testoPdf).toContain('trailer');
    expect(testoPdf).toContain('startxref');
    expect(testoPdf.trim().endsWith('%%EOF')).toBe(true);
  });

  it('esporta(doc, "pdf") genera correttamente il documento PDF', async () => {
    const doc: Documento = {
      paragrafi: [
        { runs: [{ t: 'Primo foglio', g: false, c: false, s: false }] },
        { sp: true, runs: [{ t: 'Secondo foglio dopo salto pagina', g: true, c: false, s: false }] },
      ],
    };

    const bytes = await esporta(doc, 'pdf');
    const testoPdf = new TextDecoder('latin1').decode(bytes);

    // Deve avere 2 pagine
    expect(testoPdf).toContain('/Count 2');
    expect(testoPdf).toContain('(Primo foglio) Tj');
    expect(testoPdf).toContain('(Secondo foglio dopo salto pagina) Tj');
  });

  it('esportaPdf supporta righe orizzontali e immagini JPEG incorporate', () => {
    // 1x1 pixel JPEG in base64
    const jpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const doc: Documento = {
      paragrafi: [
        { runs: [{ t: 'Prima della riga', g: false, c: false, s: false }] },
        { hr: true, runs: [] },
        {
          runs: [
            { t: '\uFFFC', g: false, c: false, s: false, im: { s: `data:image/jpeg;base64,${jpegBase64}`, w: 50, h: 50 } },
          ],
        },
      ],
    };

    const bytes = esportaPdf(doc);
    const testoPdf = new TextDecoder('latin1').decode(bytes);

    expect(testoPdf).toContain('/Type /XObject');
    expect(testoPdf).toContain('/Subtype /Image');
    expect(testoPdf).toContain('/Filter /DCTDecode');
    expect(testoPdf).toContain('/Im1 Do');
  });
});
