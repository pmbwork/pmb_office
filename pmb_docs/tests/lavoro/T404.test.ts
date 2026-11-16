import { describe, it, expect } from 'vitest';
import {
  statoIniziale, daTesto, inserisciSaltoPagina, inserisciLineaOrizzontale,
  type Stato,
} from '../../src/modello/documento';
import { azioneDaTastoFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, eseguiAzione, statoCorrente } from '../../src/editor/azioni';
import { impagina, GEOMETRIA_A4, type Riga } from '../../src/editor/pagine';
import { classiParagrafo } from '../../src/editor/render';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { DocsGuscio } from '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-guscio';

describe('T404: Salto pagina manuale (Ctrl+Enter) e linea orizzontale', () => {
  it('inserisciSaltoPagina spezza il paragrafo e imposta sp: true sul secondo paragrafo', () => {
    let st: Stato = statoIniziale(daTesto('Prima riga e seconda parte'));
    // Posiziona il cursore tra "Prima riga " e "e seconda parte" (offset 11)
    st = { ...st, sel: { ancora: { p: 0, o: 11 }, fuoco: { p: 0, o: 11 } } };
    const dopo = inserisciSaltoPagina(st);

    expect(dopo.doc.paragrafi.length).toBe(2);
    expect(dopo.doc.paragrafi[0].sp).toBeUndefined();
    expect(dopo.doc.paragrafi[1].sp).toBe(true);
    expect(dopo.doc.paragrafi[0].runs[0].t).toBe('Prima riga ');
    expect(dopo.doc.paragrafi[1].runs[0].t).toBe('e seconda parte');
    expect(dopo.sel.ancora).toEqual({ p: 1, o: 0 });
    expect(dopo.sel.fuoco).toEqual({ p: 1, o: 0 });
  });

  it('inserisciLineaOrizzontale crea un paragrafo con hr: true e un paragrafo per continuare a scrivere', () => {
    let st: Stato = statoIniziale(daTesto(''));
    const dopo = inserisciLineaOrizzontale(st);

    expect(dopo.doc.paragrafi.length).toBe(2);
    expect(dopo.doc.paragrafi[0].hr).toBe(true);
    expect(dopo.doc.paragrafi[1].hr).toBeUndefined();
    expect(dopo.sel.ancora).toEqual({ p: 1, o: 0 });
  });

  it('azioneDaTastoFormato traduce Ctrl+Enter in saltoPagina', () => {
    const a = azioneDaTastoFormato({
      key: 'Enter',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(a).toEqual({ tipo: 'saltoPagina' });

    let ed = nuovoEditor(statoIniziale(daTesto('Paragrafo base')));
    const esito = eseguiAzione(ed, a!);
    const st = statoCorrente(esito.ed);
    expect(st.doc.paragrafi.length).toBe(2);
    expect(st.doc.paragrafi[1].sp).toBe(true);
  });

  it('impagina con saltoForzato sposta la riga alla cima della pagina successiva', () => {
    const righe: Riga[] = [
      { alto: 96, basso: 120 },
      { alto: 120, basso: 144, saltoForzato: true },
    ];
    const ris = impagina(righe, GEOMETRIA_A4);

    expect(ris.pagine).toBeGreaterThanOrEqual(2);
    expect(ris.salti.length).toBe(1);
    expect(ris.salti[0].riga).toBe(1);
    expect(ris.paginaDiRiga[0]).toBe(0);
    expect(ris.paginaDiRiga[1]).toBe(1);
  });

  it('classiParagrafo restituisce salto-pagina e linea-orizzontale', () => {
    expect(classiParagrafo({ sp: true, runs: [] })).toContain('salto-pagina');
    expect(classiParagrafo({ hr: true, runs: [] })).toContain('linea-orizzontale');
  });

  it('andata e ritorno DOCX preserva sp e hr', async () => {
    const docOrig = {
      paragrafi: [
        { runs: [{ t: 'Pagina 1', g: false, c: false, s: false }] },
        { hr: true, runs: [] },
        { sp: true, runs: [{ t: 'Pagina 2', g: false, c: false, s: false }] },
      ],
    };

    const bytes = await esportaDocx(docOrig);
    const docRiletto = await importaDocx(bytes);

    expect(docRiletto.paragrafi.length).toBe(3);
    expect(docRiletto.paragrafi[0].runs[0].t).toBe('Pagina 1');
    expect(docRiletto.paragrafi[1].hr).toBe(true);
    expect(docRiletto.paragrafi[2].sp).toBe(true);
    expect(docRiletto.paragrafi[2].runs[0].t).toBe('Pagina 2');
  });

  it('DocsGuscio: le voci Inserisci > Salto di pagina e Linea orizzontale eseguono le azioni', async () => {
    const guscio = document.createElement('docs-guscio') as DocsGuscio;
    document.body.appendChild(guscio);
    await guscio.updateComplete;

    const mb = guscio.renderRoot.querySelector('docs-menubar');
    expect(mb).not.toBeNull();

    // Invio voce Salto di pagina
    mb?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'inserisci', voce: 'Salto di pagina' },
      bubbles: true,
      composed: true,
    }));
    await guscio.updateComplete;

    const ed = guscio.renderRoot.querySelector('docs-editor') as any;
    expect(ed.stato.doc.paragrafi.length).toBe(2);
    expect(ed.stato.doc.paragrafi[1].sp).toBe(true);

    // Invio voce Linea orizzontale
    mb?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'inserisci', voce: 'Linea orizzontale' },
      bubbles: true,
      composed: true,
    }));
    await guscio.updateComplete;

    expect(ed.stato.doc.paragrafi.some((p: any) => p.hr === true)).toBe(true);

    guscio.remove();
  });
});
