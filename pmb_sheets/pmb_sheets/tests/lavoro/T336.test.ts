import { describe, it, expect } from 'vitest';
import { esportaPdf } from '../../src/formati/pdf';
import { esporta, nomeFile } from '../../src/formati/file';
import { documentoDaScambio, foglioVuoto, type Scambio } from '../../src/formati/scambio';

describe('T336 — T338: Esportazione Diretta in PDF Puro Vettoriale per Fogli (Lotto S3)', () => {
  it('nomeFile supporta il formato pdf', () => {
    expect(nomeFile('Bilancio', 'pdf')).toBe('Bilancio.pdf');
  });

  it('esportaPdf genera un buffer PDF 1.4 valido con griglia, celle e header', () => {
    const scambio: Scambio = {
      fogli: [
        {
          ...foglioVuoto('Prospetto'),
          celle: {
            A1: 'Descrizione',
            B1: 'Importo',
            A2: 'Servizi cloud',
            B2: '1500',
            A3: 'Hardware',
            B3: '3200',
          },
          stiliCelle: {
            A1: 0,
            B1: 0,
          },
        },
      ],
      stili: [
        { bold: true, fill: '#e2e8f0', color: '#0f172a' },
      ],
      foglioAttivo: 'Prospetto',
    };

    const pdfBytes = esportaPdf(scambio);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(100);

    const testoPdf = new TextDecoder('latin1').decode(pdfBytes);
    // Controllo struttura PDF conforme
    expect(testoPdf.startsWith('%PDF-1.4')).toBe(true);
    expect(testoPdf).toContain('/Type /Catalog');
    expect(testoPdf).toContain('/Type /Pages');
    expect(testoPdf).toContain('/BaseFont /Helvetica');
    // Titolo del foglio e celle
    expect(testoPdf).toContain('(Prospetto) Tj');
    expect(testoPdf).toContain('(Descrizione) Tj');
    expect(testoPdf).toContain('(Importo) Tj');
    expect(testoPdf).toContain('(Servizi cloud) Tj');
    // Xref e trailer
    expect(testoPdf).toContain('xref');
    expect(testoPdf).toContain('trailer');
    expect(testoPdf.trim().endsWith('%%EOF')).toBe(true);
  });

  it('esporta(dati, "pdf") esporta il documento del foglio in PDF', async () => {
    const scambio: Scambio = {
      fogli: [
        {
          ...foglioVuoto('Dati'),
          celle: {
            A1: 'Totale',
            B1: '100',
          },
        },
      ],
      foglioAttivo: 'Dati',
    };

    const docData = documentoDaScambio(scambio);
    const bytes = await esporta(docData, 'pdf');
    const testoPdf = new TextDecoder('latin1').decode(bytes);

    expect(testoPdf).toContain('%PDF-1.4');
    expect(testoPdf).toContain('(Totale) Tj');
    expect(testoPdf).toContain('(100) Tj');
  });
});
