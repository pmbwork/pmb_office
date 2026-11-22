// T542 (pmb_docs): quando la domanda di uscita compare, la pagina lo dice alla shell (proteggi_chiusura): una seconda X mentre la domanda è
// aperta (doppio clic, due Alt+F4) trova la domanda invece di chiudere senza salvare (analisi del 2026-11-18, visto sul programma installato).
// La parte nativa (decidi_chiusura in src-tauri/src/lib.rs) ha i suoi test Rust. Lo stesso test c'è in pmb_sheets.
import { describe, it, expect, vi } from 'vitest';

const chiamate: Array<{ comando: string; argomenti: unknown }> = [];
vi.mock('../../src/guscio/tauri', async (originale) => {
  const vero = await originale<typeof import('../../src/guscio/tauri')>();
  return { ...vero, chiamaTauri: vi.fn(async (comando: string, argomenti: unknown = {}) => { chiamate.push({ comando, argomenti }); return null; }) };
});

import '../../src/guscio/docs-guscio';
import { daTesto } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T542 (pmb_docs): domanda di uscita e seconda X', () => {
  it('la domanda compare e la pagina azzera il conto della shell; una seconda richiesta trova la domanda e non chiude', async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    chiamate.length = 0;
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.impostaStato({ doc: daTesto('Testo'), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
    ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    await g.updateComplete;
    const protezioni = (): number => chiamate.filter((c) => c.comando === 'proteggi_chiusura').length;
    const prima = protezioni();
    window.dispatchEvent(new CustomEvent('chiusura-richiesta'));
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-uscita')).not.toBeNull();
    expect(protezioni()).toBe(prima + 1);
    window.dispatchEvent(new CustomEvent('chiusura-richiesta'));
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-uscita')).not.toBeNull();
    // anche con la domanda già aperta la pagina ridice di essere viva: altrimenti la terza X entro 10 s chiudeva (prova fisica 2026-11-19)
    expect(protezioni()).toBe(prima + 2);
    window.dispatchEvent(new CustomEvent('chiusura-richiesta'));
    await attendi(); await g.updateComplete;
    expect(protezioni()).toBe(prima + 3);
    expect(chiamate.some((c) => c.comando === 'destroy_window')).toBe(false);
  });
});
