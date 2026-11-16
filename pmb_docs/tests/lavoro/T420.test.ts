import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/editor/docs-editor';
import { cursore, type Documento } from '../../src/modello/documento';

describe('T420: Ridimensionamento colonne tabella', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const docConTabella: Documento = {
    paragrafi: [
      { tb: { i: 0, r: 0, c: 0 }, runs: [{ t: 'Cella 0,0', g: false, c: false, s: false }] },
      { tb: { i: 0, r: 0, c: 1 }, runs: [{ t: 'Cella 0,1', g: false, c: false, s: false }] },
      { tb: { i: 0, r: 1, c: 0 }, runs: [{ t: 'Cella 1,0', g: false, c: false, s: false }] },
      { tb: { i: 0, r: 1, c: 1 }, runs: [{ t: 'Cella 1,1', g: false, c: false, s: false }] },
      { runs: [{ t: 'Fine', g: false, c: false, s: false }] },
    ],
  };

  it('ridimensionaColonna aggiorna la larghezza memorizzata su tutte le celle della colonna', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    ed.impostaStato({
      doc: docConTabella,
      sel: cursore(0, 0),
      pendenti: null,
    });
    await ed.updateComplete;

    const ok = ed.ridimensionaColonna(0, 0, 150);
    expect(ok).toBe(true);

    const doc = ed.stato.doc;
    const celleCol0 = doc.paragrafi.filter((p: any) => p.tb && p.tb.i === 0 && p.tb.c === 0);
    expect(celleCol0.length).toBe(2);
    expect(celleCol0[0].tb.w).toBe(150);
    expect(celleCol0[1].tb.w).toBe(150);

    // Colonna 1 non deve essere modificata
    const celleCol1 = doc.paragrafi.filter((p: any) => p.tb && p.tb.i === 0 && p.tb.c === 1);
    expect(celleCol1[0].tb.w).toBeUndefined();
  });

  it('il disegno della tabella applica la larghezza impostata come stile CSS della cella', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    ed.impostaStato({
      doc: docConTabella,
      sel: cursore(0, 0),
      pendenti: null,
    });
    await ed.updateComplete;

    ed.ridimensionaColonna(0, 1, 220);
    await ed.updateComplete;

    const tdCol1 = ed.shadowRoot.querySelectorAll('td[data-c="1"]');
    expect(tdCol1.length).toBeGreaterThan(0);
    for (const td of Array.from(tdCol1) as HTMLElement[]) {
      expect(td.style.width).toBe('220px');
    }
  });
});
