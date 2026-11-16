import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T406: Modalità Senza Pagine e Schermo Intero', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('DocsEditor supporta la modalità senza pagine', async () => {
    const editor: any = document.createElement('docs-editor');
    document.body.appendChild(editor);
    await editor.updateComplete;

    expect(editor.senzaPagine).toBe(false);
    editor.impostaSenzaPagine(true);
    await editor.updateComplete;

    expect(editor.senzaPagine).toBe(true);
    expect(editor.hasAttribute('senza-pagine')).toBe(true);

    const fogli = editor.shadowRoot.querySelectorAll('.foglio');
    expect(fogli.length).toBe(1);

    editor.impostaSenzaPagine(false);
    await editor.updateComplete;
    expect(editor.senzaPagine).toBe(false);
    expect(editor.hasAttribute('senza-pagine')).toBe(false);
  });

  it('Menu Formato > Passa al formato Senza pagine attiva la modalità e aggiorna la pagina', async () => {
    const el = await monta();
    expect(el.senzaPagine).toBe(false);

    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'formato', voce: 'Passa al formato Senza pagine' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el.senzaPagine).toBe(true);
    const pagina = q(el, '.pagina');
    expect(pagina?.classList.contains('senza-pagine')).toBe(true);

    const editor: any = q(el, 'docs-editor');
    expect(editor.senzaPagine).toBe(true);

    // Ritorno al formato pagine
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'formato', voce: 'Passa al formato Pagine' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el.senzaPagine).toBe(false);
    expect(pagina?.classList.contains('senza-pagine')).toBe(false);
    expect(editor.senzaPagine).toBe(false);
  });

  it('Menu Visualizza > Schermo intero e F11/Escape commutano lo schermo intero', async () => {
    const el = await monta();
    expect(el.schermoIntero).toBe(false);

    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'visualizza', voce: 'Schermo intero' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el.schermoIntero).toBe(true);
    expect(el.hasAttribute('schermo-intero')).toBe(true);

    // Escape esce dallo schermo intero
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;

    expect(el.schermoIntero).toBe(false);
    expect(el.hasAttribute('schermo-intero')).toBe(false);

    // F11 attiva lo schermo intero
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true }));
    await el.updateComplete;

    expect(el.schermoIntero).toBe(true);
    expect(el.hasAttribute('schermo-intero')).toBe(true);

    // F11 disattiva lo schermo intero
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true }));
    await el.updateComplete;

    expect(el.schermoIntero).toBe(false);
  });

  it('nessun elemento in DocsGuscio ha stili in linea (CSP compliant)', async () => {
    const el = await monta();
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.alternaModalitaPagine();
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.alternaSchermoIntero();
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
