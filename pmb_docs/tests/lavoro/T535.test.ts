// T535: chiudendo pmb_docs con modifiche non salvate il programma chiede Salva / Non salvare / Annulla (segnalazione dell'utente, 2026-11-18:
// «quando esci dai documenti non ti chiede di salvare»). La shell Tauri manda l'evento 'chiusura-richiesta' e chiude solo con destroy_window.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const chiamate: Array<{ comando: string; argomenti: unknown }> = [];
vi.mock('../../src/guscio/tauri', async (originale) => {
  const vero = await originale<typeof import('../../src/guscio/tauri')>();
  return { ...vero, chiamaTauri: vi.fn(async (comando: string, argomenti: unknown = {}) => { chiamate.push({ comando, argomenti }); return null; }) };
});

import '../../src/guscio/docs-guscio';
import { daTesto } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T535: uscire con modifiche non salvate', () => {
  let g: any;
  beforeEach(async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    chiamate.length = 0;
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    g = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
  });
  const chiusure = (): number => chiamate.filter((c) => c.comando === 'destroy_window').length;
  const scrivi = async (): Promise<void> => {
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.impostaStato({ doc: daTesto('Testo da non perdere'), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 0 } }, pendenti: null });
    ed.dispatchEvent(new CustomEvent('cambio', { detail: { stato: ed.stato }, bubbles: true, composed: true }));
    await g.updateComplete;
  };
  const chiudi = async (): Promise<any> => {
    window.dispatchEvent(new CustomEvent('chiusura-richiesta'));
    await attendi(); await g.updateComplete;
    return g.shadowRoot.querySelector('docs-uscita');
  };
  const scegli = async (d: any, quale: 'salva' | 'esci' | 'annulla'): Promise<void> => {
    await d.updateComplete;
    (d.shadowRoot.querySelector(`button.${quale}`) as HTMLButtonElement).click();
    await attendi(); await g.updateComplete;
  };

  it('all’avvio il programma chiede alla shell di lasciargli decidere la chiusura', () => {
    expect(chiamate).toContainEqual({ comando: 'proteggi_chiusura', argomenti: { attiva: true } });
  });
  it('senza modifiche si chiude subito, senza domande', async () => {
    expect(await chiudi()).toBeNull();
    expect(chiusure()).toBe(1);
  });
  it('con modifiche chiede; Annulla resta nel programma', async () => {
    await scrivi();
    const d = await chiudi();
    expect(d).toBeTruthy();
    await d.updateComplete;
    expect(d.shadowRoot.textContent).toContain('Salvare le modifiche');
    await scegli(d, 'annulla');
    expect(g.shadowRoot.querySelector('docs-uscita')).toBeNull();
    expect(chiusure()).toBe(0);
  });
  it('Non salvare chiude e butta la copia di emergenza', async () => {
    await scrivi();
    const scarta = vi.spyOn(g.recupero, 'scarta');
    await scegli(await chiudi(), 'esci');
    expect(scarta).toHaveBeenCalled();
    expect(chiusure()).toBe(1);
  });
  it('Salva: se il salvataggio riesce chiude, se viene annullato resta aperto', async () => {
    await scrivi();
    g.salvaDocumento = vi.fn(async () => { /* finestra Salva con nome annullata: niente salvato */ });
    await scegli(await chiudi(), 'salva');
    expect(chiusure()).toBe(0);
    g.salvaDocumento = vi.fn(async () => { g.segnaSalvato(g.schedeComplete()); });
    await scegli(await chiudi(), 'salva');
    expect(chiusure()).toBe(1);
  });
  it('Esc sulla domanda vale Annulla', async () => {
    await scrivi();
    const d = await chiudi();
    await d.updateComplete;
    d.shadowRoot.querySelector('.dialogo').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-uscita')).toBeNull();
    expect(chiusure()).toBe(0);
  });
});
