// T541: salvataggio di pmb_docs con la vera salvaSuDisco (analisi del 2026-11-18, visto anche sul programma installato con la finestra di Windows):
// annullare «Salva con nome» segnava il documento come salvato e cancellava la copia di emergenza, e alla chiusura non si chiedeva niente.
// Anche: il PDF esportato non conta come salvataggio; un file scelto che non si riesce a scrivere si dice, senza scaricarlo altrove in silenzio.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/guscio/tauri', async (originale) => {
  const vero = await originale<typeof import('../../src/guscio/tauri')>();
  return { ...vero, chiamaTauri: vi.fn(async () => null) };
});

import '../../src/guscio/docs-guscio';
import { daTesto } from '../../src/modello/documento';

const attendi = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T541: Salva con nome annullato, PDF, errori di scrittura', () => {
  let g: any;
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    g = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
  });
  afterEach(() => { delete (window as any).showSaveFilePicker; vi.restoreAllMocks(); });
  const scrivi = async (testo: string): Promise<void> => {
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.impostaStato({ doc: daTesto(testo), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
    ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    await g.updateComplete;
  };
  const avviso = (): string => g.shadowRoot.querySelector('.avviso')?.textContent ?? '';

  it('annullare «Salva con nome» lascia il documento da salvare e la copia di emergenza', async () => {
    (window as any).showSaveFilePicker = async () => { throw new DOMException('Scelta annullata', 'AbortError'); };
    await scrivi('Testo da non perdere');
    g.recupero.scriviOra();
    expect(g.recupero.trova()).not.toBeNull();
    await g.salvaDocumento();
    await attendi();
    expect(g.modificato()).toBe(true);
    expect(g.recupero.trova()).not.toBeNull();
  });
  it('dalla domanda di uscita: «Salva» e poi Annulla nella finestra lascia il programma aperto', async () => {
    (window as any).showSaveFilePicker = async () => { throw new DOMException('Scelta annullata', 'AbortError'); };
    await scrivi('Testo da non perdere');
    await g.suSceltaUscita(new CustomEvent('scelta', { detail: { scelta: 'salva' } }));
    expect(g.modificato()).toBe(true);
    expect(avviso()).toContain('resta aperto');
  });
  it('il PDF esportato non conta come salvataggio', async () => {
    const scritti: unknown[] = [];
    (window as any).showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async (b: unknown) => { scritti.push(b); }, close: async () => {} }) });
    await scrivi('Da esportare');
    await g.scarica('pdf');
    expect(scritti).toHaveLength(1);
    expect(g.modificato()).toBe(true);
  });
  it('un salvataggio riuscito segna il documento come salvato (come prima)', async () => {
    (window as any).showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
    await scrivi('Da salvare');
    await g.salvaDocumento();
    expect(g.modificato()).toBe(false);
  });
  it('se il file scelto non si riesce a scrivere lo si dice e il documento resta da salvare, senza scaricarlo altrove', async () => {
    (window as any).showSaveFilePicker = async () => ({ createWritable: async () => { throw new Error('file aperto in un altro programma'); } });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    await scrivi('Testo');
    await g.salvaDocumento();
    expect(g.modificato()).toBe(true);
    expect(clic).not.toHaveBeenCalled();
    expect(avviso()).toContain('file aperto in un altro programma');
  });
});
