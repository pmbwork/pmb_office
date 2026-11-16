import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-nota';
import '../../src/editor/docs-editor';
import { testoDi } from '../../src/modello/documento';

async function montaGuscio(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T409: Note a piè di pagina (Footnotes)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('DocsEditor.inserisciNota inserisce il marcatore all\'apice e aggiunge la nota in fondo', async () => {
    const editor: any = document.createElement('docs-editor');
    document.body.appendChild(editor);
    await editor.updateComplete;

    editor.applicaAzione({ tipo: 'testo', testo: 'Questo è un testo con citazione' });
    const n1 = editor.inserisciNota('Prima nota esplicativa.');
    expect(n1).toBe(1);

    const doc1 = editor.stato.doc;
    expect(doc1.paragrafi.length).toBe(2);
    // Il marcatore all'apice è presente
    const primoParagrafo = doc1.paragrafi[0];
    const runApice = primoParagrafo.runs.find((r: any) => r.v === 'p');
    expect(runApice).toBeDefined();
    expect(runApice?.t).toBe('1');

    // Il paragrafo della nota ha la linea orizzontale e il testo
    const parNota1 = doc1.paragrafi[1];
    expect(parNota1.hr).toBe(true);
    expect(parNota1.runs[0].t).toBe('1. ');
    expect(parNota1.runs[1].t).toBe('Prima nota esplicativa.');

    // Seconda nota
    const n2 = editor.inserisciNota('Seconda nota di approfondimento.');
    expect(n2).toBe(2);

    const doc2 = editor.stato.doc;
    expect(doc2.paragrafi.length).toBe(3);
    const parNota2 = doc2.paragrafi[2];
    expect(parNota2.runs[0].t).toBe('2. ');
    expect(parNota2.runs[1].t).toBe('Seconda nota di approfondimento.');
  });

  it('DocsNota renderizza il campo ed emette eventi applica e chiudi', async () => {
    const dialog: any = document.createElement('docs-nota');
    document.body.appendChild(dialog);
    await dialog.updateComplete;

    let applicato: any = null;
    let chiuso = false;
    dialog.addEventListener('applica', (e: CustomEvent) => { applicato = e.detail; });
    dialog.addEventListener('chiudi', () => { chiuso = true; });

    const textarea = q(dialog, 'textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    textarea.value = 'Riferimento bibliografico';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const btnApplica = q(dialog, 'button.applica') as HTMLButtonElement;
    btnApplica.click();
    expect(applicato?.testo).toBe('Riferimento bibliografico');

    const btnAnnulla = q(dialog, 'button.annulla') as HTMLButtonElement;
    btnAnnulla.click();
    expect(chiuso).toBe(true);
  });

  it('Menu Inserisci > Nota a piè di pagina e shortcut Ctrl+Alt+F aprono il dialogo e inseriscono la nota', async () => {
    const el = await montaGuscio();
    const editor: any = q(el, 'docs-editor');
    editor.applicaAzione({ tipo: 'testo', testo: 'Documento scientifico' });
    await el.updateComplete;

    // Apertura da menu
    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'inserisci', voce: 'Nota a piè di pagina' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    let dialog = q(el, 'docs-nota');
    expect(dialog).not.toBeNull();

    // Escape chiude
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(q(el, 'docs-nota')).toBeNull();

    // Apertura da scorciatoia Ctrl+Alt+F
    el.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f',
      code: 'KeyF',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
    }));
    await el.updateComplete;

    dialog = q(el, 'docs-nota');
    expect(dialog).not.toBeNull();

    // Applica nota
    dialog?.dispatchEvent(new CustomEvent('applica', {
      detail: { testo: 'Fonte dell\'articolo del 2026' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    // Il dialogo si chiude e la nota è stata inserita nel documento
    expect(q(el, 'docs-nota')).toBeNull();
    expect(testoDi(editor.stato.doc)).toContain('Fonte dell\'articolo del 2026');
  });

  it('nessun elemento in DocsGuscio ha stili in linea (CSP compliant)', async () => {
    const el = await montaGuscio();
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.apriNotaPiePagina();
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
