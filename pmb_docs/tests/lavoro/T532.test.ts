// T532: menu del tasto destro sul documento (segnalazione dell'utente, 2026-11-18: «se seleziono un testo non mi fa fare con il menu
// a tendina copia incolla taglia»). Prima il documento non aveva un menu suo e compariva quello del browser, che non vede la selezione.
// T532 controlla anche l'icona dell'evidenziatore (stessa segnalazione del giorno).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { vociContestuali } from '../../src/guscio/docs-menu-contestuale';
import { daTesto, testoDi } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T532: voci del menu', () => {
  it('Taglia, Copia, Incolla, Incolla senza formattazione, Elimina, Seleziona tutto, Link, Cancella formattazione', () => {
    const v = vociContestuali(true).filter((x) => x !== null).map((x) => x!.voce);
    expect(v).toEqual(['Taglia', 'Copia', 'Incolla', 'Incolla senza formattazione', 'Elimina', 'Seleziona tutto', 'Link', 'Cancella formattazione']);
  });
  it('senza selezione Taglia, Copia, Elimina e Cancella formattazione sono spente; Incolla no', () => {
    const spente = vociContestuali(false).filter((x) => x?.disattiva).map((x) => x!.voce);
    expect(spente).toEqual(['Taglia', 'Copia', 'Elimina', 'Cancella formattazione']);
    expect(vociContestuali(true).some((x) => x?.disattiva)).toBe(false);
  });
});

describe('T532: nel programma', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
  async function guscio(): Promise<{ g: any; ed: any }> {
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it' }));
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    ed.impostaStato({ doc: daTesto('Ciao mondo'), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 4 } }, pendenti: null });
    await ed.updateComplete;
    return { g, ed };
  }
  const tastoDestro = (g: any): MouseEvent => {
    const e = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 10, clientY: 10 });
    g.shadowRoot.querySelector('main.area-editor').dispatchEvent(e);
    return e;
  };

  it('il tasto destro apre il menu del documento al posto di quello del browser', async () => {
    const { g, ed } = await guscio();
    ed.preparaMenuContestuale = () => ({ selezione: true }); // il finto browser non sa dove cade il punto: la selezione resta
    const e = tastoDestro(g);
    expect(e.defaultPrevented).toBe(true);
    await g.updateComplete;
    const m: any = g.shadowRoot.querySelector('docs-menu-contestuale');
    expect(m).toBeTruthy();
    await m.updateComplete;
    const copia = m.shadowRoot.querySelector('button[data-voce="Copia"]') as HTMLButtonElement;
    expect(copia.disabled).toBe(false);
    expect(copia.textContent).toContain('Ctrl+C');
  });
  it('Copia e Taglia dal menu lavorano sul testo selezionato', async () => {
    const { g, ed } = await guscio();
    ed.preparaMenuContestuale = () => ({ selezione: true });
    const copiati: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { copiati.push(t); }, readText: async () => 'XY' } });
    tastoDestro(g);
    await g.updateComplete;
    let m: any = g.shadowRoot.querySelector('docs-menu-contestuale');
    await m.updateComplete;
    (m.shadowRoot.querySelector('button[data-voce="Taglia"]') as HTMLButtonElement).click();
    await attendi(); await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-menu-contestuale')).toBeNull();
    expect(testoDi(ed.stato.doc)).toBe(' mondo');
    expect(copiati).toContain('Ciao');
    // Incolla rimette ciò che c'è negli appunti
    tastoDestro(g);
    await g.updateComplete;
    m = g.shadowRoot.querySelector('docs-menu-contestuale');
    await m.updateComplete;
    (m.shadowRoot.querySelector('button[data-voce="Incolla"]') as HTMLButtonElement).click();
    await attendi(); await g.updateComplete;
    expect(testoDi(ed.stato.doc)).toContain('mondo');
    expect(testoDi(ed.stato.doc).length).toBeGreaterThan(' mondo'.length);
  });
  it('senza selezione Copia è spenta; Esc chiude il menu', async () => {
    const { g, ed } = await guscio();
    ed.preparaMenuContestuale = () => ({ selezione: false });
    tastoDestro(g);
    await g.updateComplete;
    const m: any = g.shadowRoot.querySelector('docs-menu-contestuale');
    await m.updateComplete;
    expect((m.shadowRoot.querySelector('button[data-voce="Copia"]') as HTMLButtonElement).disabled).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-menu-contestuale')).toBeNull();
  });
  it('il tasto Menu della tastiera apre il menu dal documento', async () => {
    const { g, ed } = await guscio();
    ed.shadowRoot.querySelector('textarea.ingresso').dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, composed: true, cancelable: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-menu-contestuale')).toBeTruthy();
  });
  it('preparaMenuContestuale tiene la selezione quando non si sa dove cade il punto', async () => {
    const { ed } = await guscio();
    expect(ed.preparaMenuContestuale(-1000, -1000).selezione).toBe(true);
  });
});
