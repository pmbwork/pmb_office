// T464: il programma in inglese non mostra testo italiano. Avvia il guscio con l'interfaccia in inglese, apre ogni menu, ogni sottomenu, ogni finestra e ogni menu
// a tendina della barra, raccoglie tutti i testi visibili (e title, aria-label, placeholder) e controlla che nessuno sia italiano.
// Poi: cambio di lingua dal vivo, e testi che nascono dopo (avvisi).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { EN } from '../../src/i18n/en';
import { MENU } from '../../src/guscio/menu-dati';
import { popupPerComando, popupZoom, popupElenchi, popupAllineaRientro } from '../../src/guscio/popup-dati';
import { popupTabella } from '../../src/guscio/tabella-dati';
import { popupImmagine } from '../../src/guscio/immagine-dati';
import { impostaLingua, linguaCorrente } from '../../src/i18n/lingua';
import { COMPONENTI } from '../../src/guscio/componenti';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const PREF = (lingua: string): string => JSON.stringify({ interfaccia: lingua });

/** Testi che in inglese si scrivono come in italiano o che non sono parole da tradurre (nomi propri, simboli, nomi di caratteri). */
const AMMESSI = new Set([
  'File', 'Tab', 'Link', 'Zoom', 'OK', 'No', 'Per mille', 'Euro', 'Yen', 'Cent', 'Bitcoin', 'Copyright', 'Trademark', 'Micro', 'Lambda', 'Beta', 'Aa', 'Ab|', 'Windows', 'Serif', 'Sans serif', 'pmb_docs', 'pmb_office',
  'Roboto', 'Arial', 'Georgia', 'Verdana', 'Italiano', 'English', 'Français', 'Deutsch', 'Español',
]);
const STOP_IT = /\b(il|lo|gli|della|dello|delle|nel|nella|nei|sul|sulla|che|una|è|più|può|puoi|solo|nessun|nessuna|troppo|prima|dopo|sono|essere|tutto|tutti|errore|errori|aggiungi|apri|chiudi|salva|testo|documento|scheda|schede|pagina|pagine|parola|parole|riga|righe|colonna|colonne|tabella|immagine|carattere|caratteri|formato|stampa|cerca|trova|sostituisci|elimina|rinomina|annulla|ripeti|taglia|incolla|inserisci|modifica|visualizza|strumenti|informazioni|con|dal|dalla|alla|al|ai|dei|degli|sinistra|destra|centro|grassetto|corsivo|sottolineato|elenco|allinea|rientro|bordo|colore|nuovo|nuova|vuoto|vuota|scegli|scrivi|premi|apre|chiude|nascosti|visibili|salvato|salvata)\b/i;

function raccogli(radice: Node, out: Set<string>): void {
  const visita = (n: Node): void => {
    if (n.nodeType === 3) { const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim(); if (t) out.add(t); return; }
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    if (n.nodeType === 1) {
      const e = n as Element;
      const nome = e.tagName.toLowerCase();
      if (nome === 'style' || nome === 'script' || nome === 'pre' || nome === 'table' || nome === 'svg' || nome === 'textarea') return;
      if (e.classList.contains('testo') || e.classList.contains('fogli') || e.classList.contains('righello')) return; // il documento è dell'utente
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = e.getAttribute(a); if (v && /[A-Za-zÀ-ÿ]{2,}/.test(v)) out.add(v.replace(/\s+/g, ' ').trim()); }
      if (e.shadowRoot) e.shadowRoot.childNodes.forEach(visita);
    }
    n.childNodes.forEach(visita);
  };
  visita(radice);
}

/** Quali dei testi raccolti sono italiani (stanno nel dizionario come chiave diversa dalla traduzione, oppure contengono parole italiane). */
function italiani(testi: Set<string>): string[] {
  const chiaviItaliane = new Set(Object.entries(EN).filter(([k, v]) => k !== v).map(([k]) => k));
  return [...testi].filter((t) => !AMMESSI.has(t) && (chiaviItaliane.has(t) || STOP_IT.test(t)));
}

async function guscio(lingua = 'en'): Promise<any> {
  localStorage.setItem('pmb_docs.preferenze', PREF(lingua));
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  return g;
}
const barra = (g: any): any => g.shadowRoot.querySelector('docs-menubar');
const invia = async (g: any, menu: string, voce: string, padre?: string): Promise<void> => {
  barra(g).dispatchEvent(new CustomEvent('voce-menu', { detail: padre ? { menu, voce, padre } : { menu, voce }, bubbles: true, composed: true }));
  await attendi(); await g.updateComplete;
};
const chiudiTutto = async (g: any): Promise<void> => {
  for (let i = 0; i < 4; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await attendi(); await g.updateComplete;
};

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); impostaLingua('it'); });

describe('T464: l\'interfaccia in inglese non ha testo italiano', () => {
  it('l\'avvio in inglese: la lingua viene dalle preferenze salvate', async () => {
    await guscio('en');
    expect(linguaCorrente()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('la barra, i titoli dei menu e le voci con i sottomenu', async () => {
    const g = await guscio();
    const visti = new Set<string>();
    raccogli(g.shadowRoot, visti);
    for (const m of MENU) {
      barra(g).shadowRoot.querySelector(`button.titolo-menu[data-menu="${m.id}"]`).dispatchEvent(new MouseEvent('mouseenter'));
      await barra(g).updateComplete;
      raccogli(barra(g).shadowRoot, visti);
      const righe = Array.from(barra(g).shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[];
      for (const [i, v] of m.voci.entries()) {
        if (!v.figli) continue;
        righe[i].dispatchEvent(new MouseEvent('mouseenter')); await barra(g).updateComplete;
        raccogli(barra(g).shadowRoot, visti);
      }
    }
    expect(italiani(visti), 'testi italiani nel menu o nella barra').toEqual([]);
    // qualche controllo mirato: i titoli sono davvero tradotti
    expect([...visti]).toEqual(expect.arrayContaining(['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'About']));
  });

  it('ogni menu a tendina della barra e della voce Formato', async () => {
    const g = await guscio();
    const visti = new Set<string>();
    const p: any = document.createElement('docs-popup');
    document.body.appendChild(p);
    const tutti = [popupZoom(100), popupElenchi(), popupAllineaRientro(), popupTabella(), popupImmagine(),
      ...['allineamento', 'interlinea', 'stile-paragrafo', 'carattere', 'corpo', 'colore-testo', 'evidenzia'].map((id) => popupPerComando(id)!)];
    for (const popup of tutti) { p.popup = popup; await p.updateComplete; raccogli(p.shadowRoot, visti); }
    raccogli(g.shadowRoot, visti);
    expect(italiani(visti), 'testi italiani nei menu a tendina').toEqual([]);
    expect([...visti]).toEqual(expect.arrayContaining(['Left', 'Centre', 'Right', 'Justified', 'Heading 1', 'Normal text', 'Custom fonts…']));
  });

  it('ogni finestra che si apre dai menu (e gli avvisi che compaiono)', async () => {
    const g = await guscio();
    const visti = new Set<string>();
    const NON_APRIRE = new Set(['File|Nuovo', 'File|Apri', 'File|Salva', 'File|Salva con nome', 'File|Stampa', 'File|Anteprima di stampa', 'Visualizza|Schermo intero', 'File|Scarica', 'Informazioni|Installa un aggiornamento|x']);
    for (const m of MENU) {
      for (const v of m.voci) {
        if (NON_APRIRE.has(`${m.etichetta}|${v.etichetta}`)) continue;
        const figli = v.figli ?? [undefined];
        for (const f of figli) {
          if (v.etichetta === 'Correttore lingua' || v.etichetta === 'Componenti di base' || v.etichetta === 'Grafico' || v.etichetta === 'Bordi e linee' || v.etichetta === 'Testo') { if (f) continue; }
          await invia(g, m.id, f ? f.etichetta : v.etichetta, f ? v.etichetta : undefined);
          raccogli(g.shadowRoot, visti);
          await chiudiTutto(g);
        }
      }
    }
    // le finestre che si aprono anche da altre strade
    for (const pagina of ['info', 'condizioni', 'licenze'] as const) { g.apriInformazioni(pagina); await attendi(); await g.updateComplete; raccogli(g.shadowRoot, visti); await chiudiTutto(g); }
    g.apriPreferenzeAccessibilita?.();
    const sospetti = italiani(visti);
    expect(sospetti, 'testi italiani nelle finestre').toEqual([]);
  });

  it('i testi di Informazioni (condizioni, licenze, versione) sono in inglese', async () => {
    const g = await guscio();
    const visti = new Set<string>();
    for (const pagina of ['info', 'condizioni', 'licenze'] as const) { g.apriInformazioni(pagina); await attendi(); await g.updateComplete; raccogli(g.shadowRoot, visti); await chiudiTutto(g); }
    const tutto = [...visti].join(' ');
    expect(tutto).toMatch(/free software/i);
    expect(tutto).toMatch(/No warranty/);
    expect(tutto).toMatch(/Third-party components/);
    expect(tutto).not.toMatch(/software gratuito|Nessuna garanzia|Condizioni d'uso/);
  });

  it('i componenti di base inseriscono testo inglese e la data nel formato inglese', () => {
    impostaLingua('en');
    const oggi = new Date(2026, 10, 5);
    const testi = (c: (typeof COMPONENTI)[number]): string => c.costruisci(1, oggi).map((p) => p.runs.map((r) => r.t).join('')).join('\n');
    expect(testi(COMPONENTI[0])).toMatch(/Meeting notes[\s\S]*Date: 5 November 2026[\s\S]*Attendees[\s\S]*Agenda[\s\S]*Action items/);
    expect(testi(COMPONENTI[1])).toMatch(/To: [\s\S]*Subject: [\s\S]*Dear …,[\s\S]*Kind regards,/);
    expect(testi(COMPONENTI[3])).toMatch(/Weekly planner[\s\S]*Day[\s\S]*Monday[\s\S]*Friday/);
    impostaLingua('it');
    expect(testi(COMPONENTI[0])).toMatch(/Data: 5 novembre 2026/);
  });
});

describe('T464: cambiare lingua dal vivo', () => {
  it('dalla finestra Preferenze: italiano → inglese → italiano senza riavviare, e la scelta si ricorda', async () => {
    const g = await guscio('it');
    expect(linguaCorrente()).toBe('it');
    const titoli = (): string[] => Array.from(barra(g).shadowRoot.querySelectorAll('button.titolo-menu')).map((b: any) => b.textContent.trim());
    expect(titoli()).toEqual(['File', 'Modifica', 'Visualizza', 'Inserisci', 'Formato', 'Strumenti', 'Informazioni', 'Segnalazione bug']);
    g.apriPreferenze?.('preferenze');
    await invia(g, 'strumenti', 'Preferenze');
    const dlg: any = g.shadowRoot.querySelector('docs-preferenze');
    await dlg.updateComplete;
    // la lingua si sceglie con tre pulsanti di opzione, come nella finestra Preferenze di pmb_sheets
    const scelte = (): HTMLInputElement[] => Array.from(dlg.shadowRoot.querySelectorAll('input[name="interfaccia"]')) as HTMLInputElement[];
    expect(scelte().map((r) => (r.parentElement!.textContent ?? '').trim())).toEqual(['Automatica (come Windows)', 'Italiano', 'English']);
    const scegliLingua = (v: string): void => { const r = scelte().find((x) => x.dataset.lingua === v)!; r.checked = true; r.dispatchEvent(new Event('change')); };
    scegliLingua('en');
    await attendi(); await g.updateComplete; await barra(g).updateComplete; await dlg.updateComplete;
    expect(linguaCorrente()).toBe('en');
    expect(titoli()).toEqual(['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'About', 'Report a bug']);
    expect(dlg.shadowRoot.querySelector('h2').textContent.trim()).toBe('Preferences');
    expect(JSON.parse(localStorage.getItem('pmb_docs.preferenze')!).interfaccia).toBe('en');
    // di nuovo in italiano
    expect(dlg.shadowRoot.querySelector('legend').textContent.trim()).toBe('Theme');
    scegliLingua('it');
    await attendi(); await g.updateComplete; await barra(g).updateComplete;
    expect(titoli()[1]).toBe('Modifica');
    expect(JSON.parse(localStorage.getItem('pmb_docs.preferenze')!).interfaccia).toBe('it');
  });
  it('«automatica» segue la lingua del computer', async () => {
    Object.defineProperty(navigator, 'language', { value: 'en-GB', configurable: true });
    const g = await guscio('auto');
    expect(linguaCorrente()).toBe('en');
    document.body.innerHTML = '';
    Object.defineProperty(navigator, 'language', { value: 'it-IT', configurable: true });
    await guscio('auto');
    expect(linguaCorrente()).toBe('it');
    void g;
  });
  it("intestazione in inglese: etichetta pmb_docs, «Untitled document», «Not saved to disk (Ctrl+S)»; il nome scelto dall'utente non si traduce", async () => {
    const g = await guscio('en');
    const r = g.shadowRoot;
    expect(r.querySelector('.logo-app').getAttribute('aria-label')).toBe('pmb_docs');
    expect(r.querySelector('.titolo-documento').textContent.trim()).toBe('Untitled document');
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Not saved to disk (Ctrl+S)');
    g.titolo = 'Relazione 2026';
    impostaLingua('it'); await g.updateComplete;
    expect(r.querySelector('.titolo-documento').textContent.trim()).toBe('Relazione 2026');
    expect(r.querySelector('.stato-salvataggio').textContent.trim()).toBe('Non salvato su disco (Ctrl+S)'); // senza un file su disco lo stato lo dice (rinominare apre il salvataggio)
  });
});
