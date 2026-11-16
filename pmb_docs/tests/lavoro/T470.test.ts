// T470: pulsante «Barrato» nella barra (dopo Sottolineato); la stella accanto al nome non c'è più.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { VOCI_BARRA } from '../../src/guscio/barra-dati';
import { ICONE_DOCS } from '../../src/guscio/icone';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('T470: Barrato nella barra', () => {
  it('sta subito dopo Sottolineato e ha la sua icona', () => {
    const ids = VOCI_BARRA.map((v) => v.id);
    expect(ids.indexOf('barrato')).toBe(ids.indexOf('sottolineato') + 1);
    expect(ICONE_DOCS['barrato']).toContain('<svg');
  });

  it('barra la parola selezionata, il pulsante si accende, un secondo clic toglie il barrato', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    const c = ed.shadowRoot.querySelector('textarea.ingresso') as HTMLTextAreaElement;
    c.value = 'Parola barrata';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    await attendi();
    // seleziona tutto e premi Barrato
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
    await attendi(); await g.updateComplete;
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    const pulsante = (): HTMLButtonElement => tb.shadowRoot.querySelector('button[data-id="barrato"]');
    expect(pulsante()).not.toBeNull();
    expect(pulsante().getAttribute('aria-label')).toBe('Barrato');
    pulsante().click();
    await attendi(); await g.updateComplete; await tb.updateComplete;
    expect(ed.shadowRoot.querySelectorAll('.testo .x').length).toBeGreaterThan(0);
    expect(pulsante().getAttribute('aria-pressed')).toBe('true');
    pulsante().click();
    await attendi(); await g.updateComplete; await tb.updateComplete;
    expect(ed.shadowRoot.querySelectorAll('.testo .x').length).toBe(0);
    expect(pulsante().getAttribute('aria-pressed')).toBe('false');
  });

  it('accanto al nome PMB_Docs non c’è più la stella', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('.stella')).toBeNull();
    expect(g.shadowRoot.querySelector('.intestazione').textContent).not.toContain('☆');
  });
});
