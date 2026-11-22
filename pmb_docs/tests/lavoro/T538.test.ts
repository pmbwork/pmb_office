// T538: Visualizza › Schermo intero e F11 in pmb_docs allargano davvero la finestra (trovato con la prova fisica completa, 2026-11-18):
// dentro WebView2 lo schermo intero della pagina (requestFullscreen) nascondeva menu e barre ma lasciava la finestra com'era.
// Nel programma lo fa la parte nativa (comando imposta_schermo_intero, come toggle_fullscreen di pmb_sheets); Esc ne esce.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
let chiamate: Array<{ comando: string; argomenti: unknown }>;

describe('T538: schermo intero', () => {
  let g: any;
  beforeEach(async () => {
    chiamate = [];
    (window as any).__TAURI__ = { core: { invoke: async (comando: string, argomenti?: unknown) => { chiamate.push({ comando, argomenti }); return null; } } };
    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    g = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
  });
  afterEach(() => { delete (window as any).__TAURI__; });
  const schermo = (): unknown[] => chiamate.filter((c) => c.comando === 'imposta_schermo_intero').map((c) => c.argomenti);

  it('dal menu: la finestra va a schermo intero e un secondo comando la riporta com’era', async () => {
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'visualizza', voce: 'Schermo intero' }, bubbles: true, composed: true }));
    await attendi();
    expect(schermo()).toEqual([{ attivo: true }]);
    g.alternaSchermoIntero();
    expect(schermo()).toEqual([{ attivo: true }, { attivo: false }]);
  });
  it('F11 entra, Esc esce', async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true, cancelable: true }));
    await attendi();
    expect(schermo()).toEqual([{ attivo: true }]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await attendi();
    expect(schermo()).toEqual([{ attivo: true }, { attivo: false }]);
  });
  it('fuori dal programma (browser) non chiama la parte nativa', async () => {
    delete (window as any).__TAURI__;
    g.alternaSchermoIntero();
    g.alternaSchermoIntero();
    expect(schermo()).toEqual([]);
  });
});
