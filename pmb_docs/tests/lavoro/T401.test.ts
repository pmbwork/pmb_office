import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-guscio';
import type { DocsGuscio } from '../../src/guscio/docs-guscio';
import type { DocsEditor } from '../../src/editor/docs-editor';
import { testoParagrafo } from '../../src/modello/documento';

describe('T401: Voci del menu Modifica e Formato in DocsGuscio', () => {
  async function montaGuscio(): Promise<{ guscio: DocsGuscio; editor: DocsEditor }> {
    const g = document.createElement('docs-guscio') as DocsGuscio;
    document.body.appendChild(g);
    await g.updateComplete;
    const ed = g.renderRoot.querySelector('docs-editor') as DocsEditor;
    await ed.updateComplete;
    return { guscio: g, editor: ed };
  }

  function inviaVoce(guscio: DocsGuscio, menu: string, voce: string) {
    const mb = guscio.renderRoot.querySelector('docs-menubar');
    mb?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu, voce },
      bubbles: true,
      composed: true,
    }));
  }

  it('Modifica > Annulla e Ripeti annullano e ripristinano il testo inserito', async () => {
    const { guscio, editor } = await montaGuscio();
    editor.applicaAzione({ tipo: 'testo', testo: 'Ciao' });
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('Ciao');

    inviaVoce(guscio, 'modifica', 'Annulla');
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('');

    inviaVoce(guscio, 'modifica', 'Ripeti');
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('Ciao');
    guscio.remove();
  });

  it('Modifica > Seleziona tutto ed Elimina cancellano il contenuto selezionato', async () => {
    const { guscio, editor } = await montaGuscio();
    editor.applicaAzione({ tipo: 'testo', testo: 'Testo da rimuovere' });
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('Testo da rimuovere');

    inviaVoce(guscio, 'modifica', 'Seleziona tutto');
    expect(editor.testoSelezionato()).toBe('Testo da rimuovere');

    inviaVoce(guscio, 'modifica', 'Elimina');
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('');
    guscio.remove();
  });

  it('Formato > Cancella formattazione rimuove i tratti di stile dal testo', async () => {
    const { guscio, editor } = await montaGuscio();
    editor.applicaAzione({ tipo: 'testo', testo: 'Grassetto' });
    inviaVoce(guscio, 'modifica', 'Seleziona tutto');
    editor.eseguiComando('grassetto');
    expect(editor.stato.doc.paragrafi[0].runs[0].g).toBe(true);

    inviaVoce(guscio, 'formato', 'Cancella formattazione');
    expect(editor.stato.doc.paragrafi[0].runs[0].g).toBe(false);
    guscio.remove();
  });

  it('Modifica > Incolla inserisce testo via metodo incolla', async () => {
    const { guscio, editor } = await montaGuscio();
    await editor.incolla('Incollato con successo');
    expect(testoParagrafo(editor.stato.doc.paragrafi[0])).toBe('Incollato con successo');
    guscio.remove();
  });
});