import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/editor/docs-editor';
import { cursore, type Documento } from '../../src/modello/documento';

describe('T419: Maniglie di ridimensionamento immagini col mouse', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const docConImmagine: Documento = {
    paragrafi: [
      {
        runs: [
          { t: 'Prima ', g: false, c: false, s: false },
          { t: '\uFFFC', g: false, c: false, s: false, im: { s: 'data:image/png;base64,abc', w: 200, h: 100 } },
          { t: ' Dopo', g: false, c: false, s: false },
        ],
      },
    ],
  };

  it('quando un\'immagine è selezionata, appaiono la cornice e le 4 maniglie nw, ne, se, sw nella sovrapposizione', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    // Seleziona l'immagine (pos: { p: 0, o: 6 }, fine: { p: 0, o: 7 })
    ed.impostaStato({
      doc: docConImmagine,
      sel: { ancora: { p: 0, o: 6 }, fuoco: { p: 0, o: 7 } },
      pendenti: null,
    });
    await ed.updateComplete;

    expect(ed.immagineSelezionata()).toBe(true);

    const cornice = ed.shadowRoot.querySelector('.cornice-immagine');
    expect(cornice).not.toBeNull();

    const maniglie = cornice.querySelectorAll('.maniglia-resize');
    expect(maniglie.length).toBe(4);
    expect(cornice.querySelector('.maniglia-resize.nw')).not.toBeNull();
    expect(cornice.querySelector('.maniglia-resize.ne')).not.toBeNull();
    expect(cornice.querySelector('.maniglia-resize.se')).not.toBeNull();
    expect(cornice.querySelector('.maniglia-resize.sw')).not.toBeNull();
  });

  it('quando la selezione è solo testo, la cornice dell\'immagine non c\'è', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    ed.impostaStato({
      doc: docConImmagine,
      sel: cursore(0, 0),
      pendenti: null,
    });
    await ed.updateComplete;

    expect(ed.immagineSelezionata()).toBe(false);
    expect(ed.shadowRoot.querySelector('.cornice-immagine')).toBeNull();
  });

  it('ridimensionaImmagineSelezionata modifica la larghezza e proporzionalmente l\'altezza dell\'immagine', async () => {
    const ed: any = document.createElement('docs-editor');
    document.body.appendChild(ed);
    await ed.updateComplete;

    ed.impostaStato({
      doc: docConImmagine,
      sel: { ancora: { p: 0, o: 6 }, fuoco: { p: 0, o: 7 } },
      pendenti: null,
    });
    await ed.updateComplete;

    const ok = ed.ridimensionaImmagineSelezionata(400);
    expect(ok).toBe(true);

    const runImmagine = ed.stato.doc.paragrafi[0].runs.find((r: any) => r.im !== undefined);
    expect(runImmagine.im.w).toBe(400);
    expect(runImmagine.im.h).toBe(200); // rapporto 2:1 mantenuto
  });
});
