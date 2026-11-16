// T432: appunti dal menu (anche su più paragrafi, anche se il sistema non lascia leggere gli appunti) e tasti a livello di finestra.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import { cursore, daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; });

async function guscio(): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('uno\ndue')), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}

describe('T432: appunti dal menu', () => {
  it('Copia, Elimina e Incolla su due paragrafi funzionano anche se gli appunti di sistema sono negati', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => { throw new Error('negato'); }, writeText: async () => { throw new Error('negato'); } } });
    ed.selezionaTutto();
    await ed.copia();
    ed.elimina();
    expect(ed.stato.doc.paragrafi.map((p: any) => (p.t ?? p).length ?? 0).length).toBeGreaterThan(0);
    await ed.incolla();
    const testo = ed.stato.doc.paragrafi.length;
    expect(testo).toBe(2);
    vi.unstubAllGlobals();
  });

  it('Taglia su due paragrafi svuota il documento e Incolla lo rimette', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: async () => '', writeText: async () => {} } });
    ed.selezionaTutto();
    await ed.taglia();
    expect(ed.stato.doc.paragrafi.length).toBe(1);
    await ed.incolla();
    expect(ed.stato.doc.paragrafi.length).toBe(2);
    vi.unstubAllGlobals();
  });
});

describe('T432: tasti a livello di finestra', () => {
  it('Esc esce dallo schermo intero anche se il fuoco non è dentro il guscio', async () => {
    const g = await guscio();
    g.alternaSchermoIntero();
    await attendi(30);
    expect(g.hasAttribute('schermo-intero')).toBe(true);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await attendi(60);
    expect(g.hasAttribute('schermo-intero')).toBe(false);
  });
});

describe('T432: Incolla non si blocca se gli appunti di sistema non rispondono', () => {
  it('con readText che non risponde mai, dopo mezzo secondo incolla la copia interna', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: () => new Promise(() => {}), writeText: () => new Promise(() => {}) } });
    ed.selezionaTutto();
    void ed.copia();
    await attendi(30);
    ed.elimina();
    await ed.incolla();
    expect(ed.stato.doc.paragrafi.length).toBe(2);
    vi.unstubAllGlobals();
  });
});

describe('T432: uscita dallo schermo intero decisa dal browser', () => {
  it('quando il browser esce dal pieno schermo lo stato dell\'app si allinea (basta un Esc)', async () => {
    const g = await guscio();
    g.alternaSchermoIntero();
    await attendi(30);
    expect(g.hasAttribute('schermo-intero')).toBe(true);
    document.dispatchEvent(new Event('fullscreenchange'));
    await attendi(60);
    expect(g.hasAttribute('schermo-intero')).toBe(false);
  });
});
