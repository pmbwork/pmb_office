// T454: avviato con un file («Apri con», doppio clic), pmb_docs lo apre da solo.
// Dal 2026-11-18 la parte nativa dà nome, percorso ed eventuale problema (file_di_avvio, uguale in pmb_sheets) e i byte si leggono grezzi con
// file_leggi; un file che non si apre (troppo grande, formato non supportato, sparito) si dice, invece di aprire un documento vuoto in silenzio.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { testoDi } from '../../src/modello/documento';

const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
afterEach(() => { delete w.__TAURI_INTERNALS__; });

let chiamate: Array<{ comando: string; argomenti: unknown }> = [];
async function avvia(invoke: (c: string, a?: unknown) => Promise<unknown>): Promise<any> {
  chiamate = [];
  w.__TAURI_INTERNALS__ = { invoke: (c: string, a?: unknown) => { chiamate.push({ comando: c, argomenti: a }); return invoke(c, a); } };
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  await new Promise((r) => setTimeout(r, 80));
  await g.updateComplete;
  return g;
}
const testo = (g: any): string => testoDi(g.shadowRoot.querySelector('docs-editor').stato.doc);
const byteDi = (s: string): number[] => Array.from(new TextEncoder().encode(s));
const avvio = (nome: string, problema: string | null = null) => ({ nome, percorso: `C:\\Documenti\\${nome}`, problema });
const avviso = (g: any): string => g.shadowRoot.querySelector('.avviso')?.textContent ?? '';

describe('T454: file di avvio', () => {
  it('apre il file passato dal sistema (byte come elenco di numeri) col suo titolo', async () => {
    const g = await avvia(async (c) => (c === 'file_di_avvio' ? avvio('Lettera.txt') : c === 'file_leggi' ? byteDi('Gentile cliente\nsaluti') : null));
    expect(g.titolo).toBe('Lettera');
    expect(testo(g)).toBe('Gentile cliente\nsaluti');
  });
  it('accetta anche i byte come ArrayBuffer, letti con file_leggi dal percorso del file di avvio', async () => {
    const g = await avvia(async (c) => (c === 'file_di_avvio' ? avvio('Nota.txt') : c === 'file_leggi' ? new Uint8Array(byteDi('ciao')).buffer : null));
    expect(g.titolo).toBe('Nota');
    expect(testo(g)).toBe('ciao');
    expect(chiamate.find((c) => c.comando === 'file_leggi')?.argomenti).toEqual({ percorsoFile: 'C:\\Documenti\\Nota.txt' });
  });
  it('senza file di avvio resta il documento vuoto', async () => {
    const g = await avvia(async () => null);
    expect(g.titolo).toBe('Documento senza titolo');
    expect(testo(g)).toBe('');
  });
  it('se la lettura fallisce avvisa e non apre niente', async () => {
    const g = await avvia(async (c) => { if (c === 'file_di_avvio') return avvio('Rotto.txt'); throw new Error('no'); });
    expect(g.titolo).toBe('Documento senza titolo');
    expect(avviso(g)).toContain('Rotto.txt');
  });
  it('un file troppo grande non apre un documento vuoto in silenzio: lo dice, e non si legge', async () => {
    const g = await avvia(async (c) => (c === 'file_di_avvio' ? avvio('Enorme.txt', 'TROPPO_GRANDE') : null));
    expect(testo(g)).toBe('');
    expect(avviso(g)).toContain('Enorme.txt');
    expect(avviso(g)).toContain('100 MB');
    expect(chiamate.some((c) => c.comando === 'file_leggi')).toBe(false);
  });
  it('un formato che pmb_docs non apre, o un file sparito: lo dice', async () => {
    let g = await avvia(async (c) => (c === 'file_di_avvio' ? avvio('Foglio.xlsx', 'FORMATO_NON_SUPPORTATO') : null));
    expect(avviso(g)).toContain('Foglio.xlsx');
    expect(avviso(g)).toContain('pmb_docs');
    document.body.innerHTML = '';
    g = await avvia(async (c) => (c === 'file_di_avvio' ? avvio('Sparito.docx', 'NON_TROVATO') : null));
    expect(avviso(g)).toContain('Sparito.docx');
  });
});
