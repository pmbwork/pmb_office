// T543: pmb_docs avvisa, una volta, se la copia automatica di emergenza non si può scrivere (documento troppo grande o deposito pieno),
// come già fa pmb_sheets: prima taceva, e la finestra degli aggiornamenti prometteva il ripristino (analisi del 2026-11-18).
import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-guscio';
import { Recupero, LUNGHEZZA_MASSIMA_RECUPERO, type EsitoScrittura } from '../../src/formati/recupero';
import { daTesto } from '../../src/modello/documento';

describe('T543: avviso della copia di emergenza', () => {
  it('Recupero chiama dopoScrittura con l’esito di ogni scrittura, anche «troppo grande»', () => {
    const esiti: EsitoScrittura[] = [];
    const archivio = { leggi: () => null, scrivi: () => true, cancella: () => {} };
    const r = new Recupero(archivio, { dopoScrittura: (e) => esiti.push(e) });
    r.segnala('Doc', daTesto('abc')); r.scriviOra();
    r.segnala('Doc', daTesto('x'.repeat(LUNGHEZZA_MASSIMA_RECUPERO + 10))); r.scriviOra();
    r.segnala('Doc', daTesto('')); r.scriviOra();
    expect(esiti).toEqual(['scritto', 'troppo-grande', 'vuoto']);
  });
  it('deposito pieno: il guscio avvisa una volta sola, e di nuovo solo dopo che la copia è tornata a funzionare', async () => {
    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    let pieno = true;
    const archivio = { leggi: () => null, scrivi: () => !pieno, cancella: () => {} };
    g.recupero = new Recupero(archivio, { dopoScrittura: (e) => g.suEsitoRecupero(e) });
    const avviso = (): string => g.shadowRoot.querySelector('.avviso')?.textContent ?? '';
    g.recupero.segnala('Doc', daTesto('abc')); g.recupero.scriviOra(); await g.updateComplete;
    expect(avviso()).toContain('copia automatica di emergenza');
    g.avviso = null; await g.updateComplete;
    g.recupero.segnala('Doc', daTesto('abcd')); g.recupero.scriviOra(); await g.updateComplete;
    expect(avviso()).toBe(''); // non si ripete a ogni scrittura
    pieno = false;
    g.recupero.segnala('Doc', daTesto('abcde')); g.recupero.scriviOra(); await g.updateComplete;
    pieno = true;
    g.recupero.segnala('Doc', daTesto('abcdef')); g.recupero.scriviOra(); await g.updateComplete;
    expect(avviso()).toContain('copia automatica di emergenza');
  });
});
