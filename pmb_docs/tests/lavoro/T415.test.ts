import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-dettagli';
import '../../src/editor/docs-editor';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T415: Dettagli documento e Caratteri non stampabili', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('File > Dettagli apre la modale docs-dettagli con metadati e si chiude con Escape o pulsante', async () => {
    const el = await monta();
    el.titolo = 'Relazione Annuale';
    await el.updateComplete;

    expect(q(el, 'docs-dettagli')).toBeNull();

    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'file', voce: 'Dettagli' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    const dialog = q(el, 'docs-dettagli');
    expect(dialog).not.toBeNull();
    const campoTitolo = dialog?.shadowRoot?.querySelector('[data-campo="titolo"]');
    expect(campoTitolo?.textContent).toBe('Relazione Annuale');

    // Chiusura con Escape
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(q(el, 'docs-dettagli')).toBeNull();
  });

  it('Visualizza > Mostra caratteri non stampabili e scorciatoia Ctrl+Maiusc+P commutano visibilità', async () => {
    const el = await monta();
    const editor: any = q(el, 'docs-editor');
    expect(el.caratteriNonStampabili).toBe(false);
    expect(editor?.mostraNonStampabili).toBe(false);

    // Attivazione da menu
    const menu = q(el, 'docs-menubar');
    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'visualizza', voce: 'Mostra caratteri non stampabili' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el.caratteriNonStampabili).toBe(true);
    expect(editor?.mostraNonStampabili).toBe(true);
    expect(editor?.hasAttribute('mostra-non-stampabili')).toBe(true);

    // Disattivazione con shortcut Ctrl+Maiusc+P
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true, composed: true }));
    await el.updateComplete;

    expect(el.caratteriNonStampabili).toBe(false);
    expect(editor?.mostraNonStampabili).toBe(false);
    expect(editor?.hasAttribute('mostra-non-stampabili')).toBe(false);
  });
});
