// T454: avviato con un file («Apri con», doppio clic), pmb_docs lo apre da solo.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { testoDi } from '../../src/modello/documento';

const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
afterEach(() => { delete w.__TAURI_INTERNALS__; });

async function avvia(invoke: (c: string) => Promise<unknown>): Promise<any> {
  w.__TAURI_INTERNALS__ = { invoke };
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  await g.updateComplete;
  return g;
}
const testo = (g: any): string => testoDi(g.shadowRoot.querySelector('docs-editor').stato.doc);
const byteDi = (s: string): number[] => Array.from(new TextEncoder().encode(s));

describe('T454: file di avvio', () => {
  it('apre il file passato dal sistema (byte come elenco di numeri) col suo titolo', async () => {
    const g = await avvia(async (c) => (c === 'nome_file_di_avvio' ? 'Lettera.txt' : c === 'leggi_file_di_avvio' ? byteDi('Gentile cliente\nsaluti') : null));
    expect(g.titolo).toBe('Lettera');
    expect(testo(g)).toBe('Gentile cliente\nsaluti');
  });
  it('accetta anche i byte come ArrayBuffer', async () => {
    const g = await avvia(async (c) => (c === 'nome_file_di_avvio' ? 'Nota.txt' : c === 'leggi_file_di_avvio' ? new Uint8Array(byteDi('ciao')).buffer : null));
    expect(g.titolo).toBe('Nota');
    expect(testo(g)).toBe('ciao');
  });
  it('senza file di avvio resta il documento vuoto', async () => {
    const g = await avvia(async () => null);
    expect(g.titolo).toBe('Documento senza titolo');
    expect(testo(g)).toBe('');
  });
  it('se la lettura fallisce avvisa e non apre niente', async () => {
    const g = await avvia(async (c) => { if (c === 'nome_file_di_avvio') return 'Rotto.txt'; throw new Error('no'); });
    expect(g.titolo).toBe('Documento senza titolo');
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('Rotto.txt');
  });
});
