// pmb_sheets in inglese non mostra testo italiano (come il test T464 di pmb_docs). Avvia il programma con l'interfaccia in inglese, apre ogni menu e sottomenu,
// le finestre che si aprono dai menu e i menu contestuali, raccoglie i testi visibili (e title, aria-label, placeholder, alt) e controlla che nessuno sia italiano.
// Poi: cambio di lingua dal vivo dalla finestra Preferenze, e la scelta che si ricorda.
import { describe, it, expect, beforeEach } from 'vitest';
import '../src/main';
import { EN } from '../src/i18n/en';
import { impostaLingua, linguaCorrente } from '../src/i18n/lingua';

const attendi = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Testi che in inglese si scrivono uguali o che non sono parole da tradurre (nomi propri, nomi dei fogli dell'utente, simboli). */
const AMMESSI = new Set(['File', 'Link', 'Zoom', 'Pivot', 'fx', 'Data', 'Area', 'Formula', 'Zero', 'PMB Sheets', 'pmb_sheets', 'pmb_office', 'pmb_sheets · pmb_office',
  'Inter', 'Roboto', 'Serif', 'Sans-Serif', 'Monospace', 'Italiano', 'English', 'Foglio1', 'Percentile', 'OpenDocument (.ods)']);
const STOP_IT = /\b(il|lo|gli|della|dello|delle|nel|nella|nei|sul|sulla|che|una|è|più|può|puoi|solo|nessun|nessuna|troppo|prima|dopo|sono|tutto|tutti|errore|aggiungi|apri|chiudi|salva|testo|foglio|fogli|cella|celle|riga|righe|colonna|colonne|tabella|immagine|carattere|formato|stampa|cerca|trova|sostituisci|elimina|rinomina|annulla|ripeti|taglia|incolla|inserisci|modifica|visualizza|strumenti|informazioni|con|dal|dalla|alla|al|ai|dei|degli|sinistra|destra|centro|grassetto|corsivo|sottolineato|elenco|allinea|bordo|bordi|colore|nuovo|nuova|vuoto|vuota|scegli|scrivi|premi|salvato|filtro|filtri|grafico|valore|valori|intervallo|convalida|regola|regole|dati)\b/i;

function raccogli(radice: Node, out: Set<string>): void {
  const visita = (n: Node): void => {
    if (n.nodeType === 3) { const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim(); if (t) out.add(t); return; }
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    if (n.nodeType === 1) {
      const e = n as Element;
      const nome = e.tagName.toLowerCase();
      if (nome === 'style' || nome === 'script' || nome === 'svg' || nome === 'textarea' || nome === 'option' && (e as HTMLOptionElement).value === '') return;
      if (e.classList.contains('cell-content') || e.classList.contains('tab')) return; // contenuto dell'utente: celle e nomi dei fogli
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v && /[A-Za-zÀ-ÿ]{2,}/.test(v)) out.add(v.replace(/\s+/g, ' ').trim()); }
      if (e.shadowRoot) e.shadowRoot.childNodes.forEach(visita);
    }
    n.childNodes.forEach(visita);
  };
  visita(radice);
}

/** Quali dei testi raccolti sono italiani: chiavi del dizionario diverse dalla traduzione, oppure testi con parole italiane. */
function italiani(testi: Set<string>): string[] {
  const chiaviItaliane = new Set(Object.entries(EN).filter(([k, v]) => k !== v).map(([k]) => k));
  return [...testi].filter((t) => !AMMESSI.has(t) && (chiaviItaliane.has(t) || STOP_IT.test(t)));
}

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
async function avvia(lingua: 'it' | 'en' = 'en'): Promise<App> {
  const app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  impostaLingua(lingua);
  await attendi(); await app.updateComplete;
  return app;
}
const menubar = (app: App): any => app.renderRoot.querySelector('free-menubar');
const griglia = (app: App): any => app.renderRoot.querySelector('free-sheet-grid');
const comanda = async (app: App, action: string): Promise<void> => {
  menubar(app).dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
  await attendi(60); await app.updateComplete;
};

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); impostaLingua('it'); });

describe("pmb_sheets in inglese: niente testo italiano nell'interfaccia", () => {
  it('barra del titolo, barra degli strumenti, barra della formula e barra di stato', async () => {
    const app = await avvia();
    const visti = new Set<string>();
    raccogli(app.renderRoot as unknown as Node, visti);
    expect(italiani(visti), 'testi italiani nella finestra').toEqual([]);
    expect([...visti]).toEqual(expect.arrayContaining(['Untitled spreadsheet', 'Not saved to disk (Ctrl+S)', 'Enter a value or a formula']));
  });

  it('ogni menu e ogni sottomenu', async () => {
    const app = await avvia();
    const mb = menubar(app);
    const visti = new Set<string>();
    const menu = mb.getVisibleMenus();
    for (let i = 0; i < menu.length; i++) {
      mb.openMenu(i); await mb.updateComplete;
      raccogli(mb.shadowRoot, visti);
      for (const voce of mb.getVisibleItems(menu[i])) {
        if (!voce.subitems) continue;
        mb.apriSottomenu(voce); await mb.updateComplete;
        raccogli(mb.shadowRoot, visti);
      }
    }
    expect(italiani(visti), 'testi italiani nei menu').toEqual([]);
    // i titoli dei menu: il testo è spezzato dalla lettera sottolineata per Alt, quindi si leggono dai pulsanti
    const titoli = Array.from(mb.shadowRoot.querySelectorAll('button.menu-btn')).map((b: any) => b.textContent.replace(/\s+/g, ''));
    expect(titoli).toEqual(expect.arrayContaining(['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Help', 'About']));
    expect([...visti]).toEqual(expect.arrayContaining(['Undo', 'Paste special', 'Values only', 'Freeze', 'Merge cells', 'Ctrl+Shift+S']));
  });

  it('le finestre che si aprono dai menu', async () => {
    const visti = new Set<string>();
    const finestre = ['open-preferences', 'conditional-format', 'data-validation', 'named-ranges', 'filter-views', 'insert-comment', 'insert-link', 'open-custom-num-fmt',
      'personalizza-barra', 'info-app', 'info-condizioni', 'info-licenze', 'info-segnala', 'open-menu-search', 'find-replace', 'toggle-sidebar'];
    for (const azione of finestre) {
      document.body.innerHTML = '';
      const app = await avvia();
      await comanda(app, azione);
      raccogli(app.renderRoot as unknown as Node, visti);
    }
    expect(italiani(visti), 'testi italiani nelle finestre').toEqual([]);
    expect([...visti]).toEqual(expect.arrayContaining(['Preferences', 'Program language', 'Conditional formatting', 'Data validation', 'Named ranges', 'Filter views', 'Customise the toolbar']));
  });

  it('i menu contestuali di cella, colonna, riga e scheda', async () => {
    const app = await avvia();
    const g = griglia(app);
    const visti = new Set<string>();
    for (const type of ['cell', 'col', 'row', 'tab']) {
      g.contextMenu = { x: 10, y: 10, type, index: 0, sheetName: 'Foglio1' };
      await g.updateComplete;
      raccogli(g.shadowRoot, visti);
    }
    expect(italiani(visti), 'testi italiani nei menu contestuali').toEqual([]);
    expect([...visti]).toEqual(expect.arrayContaining(['Cut', 'Paste values only', 'Insert 1 row above', 'Hide column', 'Duplicate', 'Tab colour red']));
  });
});

describe('pmb_sheets: cambiare lingua dal vivo', () => {
  it('dalla finestra Preferenze: italiano → inglese → italiano senza riavviare, e la scelta si ricorda', async () => {
    const app = await avvia('it');
    const mb = menubar(app);
    const titoli = (): string[] => Array.from(mb.shadowRoot.querySelectorAll('button.menu-btn')).map((b: any) => b.textContent.replace(/\s+/g, '').trim());
    expect(titoli().slice(0, 3)).toEqual(['File', 'Modifica', 'Visualizza']);
    await comanda(app, 'open-preferences');
    const dlg: any = app.renderRoot.querySelector('free-dialogo-preferenze');
    await dlg.updateComplete;
    const scelte = Array.from(dlg.shadowRoot.querySelectorAll('input[name="lingua"]')) as HTMLInputElement[];
    expect(scelte.map((s) => s.dataset.lingua)).toEqual(['auto', 'it', 'en']);
    scelte[2].checked = true; scelte[2].dispatchEvent(new Event('change'));
    await attendi(60); await app.updateComplete; await mb.updateComplete; await dlg.updateComplete;
    expect(linguaCorrente()).toBe('en');
    expect(titoli().slice(0, 3)).toEqual(['File', 'Edit', 'View']);
    expect(dlg.shadowRoot.querySelector('h2').textContent.trim()).toBe('Preferences');
    expect(localStorage.getItem('pmb_sheets.lingua')).toBe('en');
    const scelte2 = Array.from(dlg.shadowRoot.querySelectorAll('input[name="lingua"]')) as HTMLInputElement[];
    scelte2[1].checked = true; scelte2[1].dispatchEvent(new Event('change'));
    await attendi(60); await app.updateComplete; await mb.updateComplete;
    expect(linguaCorrente()).toBe('it');
    expect(titoli()[1]).toBe('Modifica');
    expect(localStorage.getItem('pmb_sheets.lingua')).toBe('it');
  });

  it('il nome predefinito si traduce, quello scelto dall\'utente no; Alt+E apre Edit in inglese', async () => {
    const app = await avvia('en');
    const tb: any = app.renderRoot.querySelector('free-titlebar');
    expect(tb.shadowRoot.querySelector('.doc-title').textContent.trim()).toBe('Untitled spreadsheet');
    tb.docTitle = 'Bilancio 2026'; await tb.updateComplete;
    expect(tb.shadowRoot.querySelector('.doc-title').textContent.trim()).toBe('Bilancio 2026');
    const mb = menubar(app);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', altKey: true, bubbles: true }));
    await mb.updateComplete;
    const aperto = mb.shadowRoot.querySelector('button.menu-btn.active');
    expect(aperto?.textContent.replace(/\s+/g, '')).toBe('Edit');
  });
});
