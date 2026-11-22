// T531: correzione automatica completa di pmb_docs (lotto 1 del piano delle funzioni, 2026-11-18): sostituzioni da elenco modificabile,
// virgolette e trattini tipografici, DUe MAiuscole, bLOC MAIUSC, elenchi automatici; finestra Strumenti › Correzione automatica.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import {
  conMaiuscoleDi, correggiDopoCarattere, correggiParola, elencoDa, ripulisciSostituzioni, virgolettaPer,
  OPZIONI_PREDEFINITE, SOSTITUZIONI_PREDEFINITE, type OpzioniCorrezione,
} from '../../src/editor/correzione';
import { cursore, daTesto, inserisciTesto, statoIniziale, testoDi, type Stato } from '../../src/modello/documento';
import { ripulisciPreferenze } from '../../src/guscio/preferenze';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const opz = (x: Partial<OpzioniCorrezione> = {}): OpzioniCorrezione => ({ ...OPZIONI_PREDEFINITE, ...x });

/** Scrive un carattere alla volta, applicando le correzioni come fa l'editor. */
function scrivi(testo: string, o: OpzioniCorrezione = opz(), bloc = false, st: Stato = statoIniziale()): Stato {
  for (const c of testo) {
    st = inserisciTesto(st, c);
    st = correggiDopoCarattere(st, c, o, bloc) ?? st;
  }
  return st;
}

describe('T531: sostituzioni', () => {
  it('le parole dell’elenco si correggono quando la parola finisce', () => {
    expect(testoDi(scrivi('perchè ').doc)).toBe('perché ');
    expect(testoDi(scrivi('poichè, ').doc)).toBe('poiché, ');
    expect(testoDi(scrivi('(perchè) ').doc)).toBe('(perché) ');
    expect(testoDi(scrivi('teh ').doc)).toBe('the ');
    expect(testoDi(scrivi('perchè').doc)).toBe('perchè'); // la parola non è ancora finita
  });
  it('maiuscole come le ha scritte l’utente', () => {
    expect(testoDi(scrivi('Perchè ').doc)).toBe('Perché ');
    expect(testoDi(scrivi('PERCHÈ ').doc)).toBe('PERCHÉ ');
    expect(conMaiuscoleDi('Teh', 'the')).toBe('The');
  });
  it('simboli e puntini di sospensione', () => {
    expect(testoDi(scrivi('(c) ').doc)).toBe('© ');
    expect(testoDi(scrivi('-> ').doc)).toBe('→ ');
    expect(testoDi(scrivi('1/2. ').doc)).toBe('½. ');
    expect(testoDi(scrivi('aspetta...').doc)).toBe('aspetta…');
    expect(testoDi(scrivi('il 1/2/2026 ').doc)).toBe('il 1/2/2026 ');
  });
  it('accenti con l’apostrofo e sostituzioni di due parole', () => {
    expect(testoDi(scrivi("E' vero").doc)).toBe('È vero');
    expect(testoDi(scrivi('un pò ').doc)).toBe('un po’ ');
    expect(testoDi(scrivi('cè ').doc)).toBe('c’è ');
  });
  it('indirizzi web ed email non si toccano', () => {
    expect(correggiParola('www.perchè.it', opz(), false)).toBeNull();
    expect(correggiParola('teh@posta.it', opz(), false)).toBeNull();
  });
  it('spente, non correggono niente', () => {
    expect(testoDi(scrivi('perchè (c) ', opz({ sostituzioni: false })).doc)).toBe('perchè (c) ');
  });
  it('un elenco dell’utente prende il posto di quello di partenza', () => {
    const o = opz({ elenco: [['pmb', 'pmb_office']] });
    expect(testoDi(scrivi('pmb perchè ', o).doc)).toBe('pmb_office perchè ');
  });
  it('il formato del testo corretto resta', () => {
    let st = statoIniziale();
    st = { ...st, pendenti: { g: true, c: false, s: false } };
    st = scrivi('perchè ', opz(), false, st);
    expect(st.doc.paragrafi[0].runs.every((r) => r.g)).toBe(true);
    expect(st.sel.fuoco).toEqual({ p: 0, o: 7 });
  });
});

describe('T531: virgolette e trattini', () => {
  it('virgolette di apertura e di chiusura, apostrofo', () => {
    expect(testoDi(scrivi('"ciao" disse').doc)).toBe('“ciao” disse');
    expect(testoDi(scrivi("l'albero").doc)).toBe('l’albero');
    expect(testoDi(scrivi("'sì'").doc)).toBe('‘sì’');
    expect(virgolettaPer('"', '(')).toBe('“');
    expect(testoDi(scrivi('"ciao"', opz({ virgolette: false })).doc)).toBe('"ciao"');
  });
  it('trattino tra parole, trattino lungo, ma non a inizio paragrafo né dentro le parole', () => {
    expect(testoDi(scrivi('uno - due', opz({ elenchi: false })).doc)).toBe('uno – due');
    expect(testoDi(scrivi('uno -- due').doc)).toBe('uno — due');
    expect(testoDi(scrivi('uno--due ').doc)).toBe('uno—due ');
    expect(testoDi(scrivi('ben-essere ').doc)).toBe('ben-essere ');
    expect(testoDi(scrivi('- ', opz({ elenchi: false })).doc)).toBe('- ');
  });
});

describe('T531: maiuscole sbagliate', () => {
  it('DUe MAiuscole iniziali, con le eccezioni', () => {
    expect(testoDi(scrivi('CIao ').doc)).toBe('Ciao ');
    expect(testoDi(scrivi('PCs MBps CIAO ').doc)).toBe('PCs MBps CIAO ');
  });
  it('bLOC MAIUSC solo con il Bloc Maiusc acceso', () => {
    expect(testoDi(scrivi('cIAO ', opz(), true).doc)).toBe('Ciao ');
    expect(testoDi(scrivi('mRNA ', opz(), false).doc)).toBe('mRNA ');
  });
});

describe('T531: elenchi automatici', () => {
  it('«1. », «- », «* », «[] » a inizio paragrafo', () => {
    expect(elencoDa('1.')).toBe('n');
    expect(elencoDa('1)')).toBe('n');
    expect(elencoDa('-')).toBe('p');
    expect(elencoDa('*')).toBe('p');
    expect(elencoDa('[]')).toBe('t');
    expect(elencoDa('2.')).toBeNull();
    const st = scrivi('1. primo');
    expect(st.doc.paragrafi[0].el).toBe('n');
    expect(testoDi(st.doc)).toBe('primo');
    const p = scrivi('- voce');
    expect(p.doc.paragrafi[0].el).toBe('p');
  });
  it('non dentro un paragrafo, non dove c’è già un elenco, non se spento', () => {
    expect(scrivi('a 1. b').doc.paragrafi[0].el).toBeUndefined();
    expect(scrivi('1. x', opz({ elenchi: false })).doc.paragrafi[0].el).toBeUndefined();
    const giaElenco = { ...statoIniziale(daTesto('')), sel: cursore(0, 0) };
    giaElenco.doc.paragrafi[0].el = 'p';
    expect(testoDi(scrivi('- x', opz(), false, giaElenco).doc)).toBe('- x');
  });
});

describe('T531: preferenze', () => {
  it('elenco letto dal disco ripulito', () => {
    expect(ripulisciSostituzioni('x')).toBeNull();
    expect(ripulisciSostituzioni([['a', 'b'], ['', 'x'], ['tre parole qui', 'x'], ['c', ''], ['A', 'z'], [1, 2], ['d\u0001', 'e']])).toEqual([['A', 'z']]);
    expect(ripulisciSostituzioni([['un po', 'x']])).toEqual([['un po', 'x']]);
  });
  it('accese di serie; elenco null = quello di partenza', () => {
    const p = ripulisciPreferenze({});
    expect([p.sostituzioniAutomatiche, p.virgoletteTipografiche, p.trattiniTipografici, p.correggiDueMaiuscole, p.correggiBlocMaiusc, p.elenchiAutomatici]).toEqual([true, true, true, true, true, true]);
    expect(p.sostituzioni).toBeNull();
    expect(SOSTITUZIONI_PREDEFINITE.length).toBeGreaterThan(40);
  });
});

describe('T531: nel programma', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
  async function guscio(pref: object = {}): Promise<{ g: any; ed: any }> {
    localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', ...pref }));
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    return { g, ed };
  }
  const casella = (ed: any): HTMLTextAreaElement => ed.shadowRoot.querySelector('textarea.ingresso');
  const lettere = (ed: any, testo: string): void => { for (const ch of testo) { casella(ed).value = ch; casella(ed).dispatchEvent(new Event('input', { bubbles: true })); } };
  const tasto = (ed: any, key: string, ctrl = false): void => {
    casella(ed).dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, composed: true, cancelable: true }));
  };

  it('scrivendo: correzioni e Ctrl+Z che toglie solo l’ultima', async () => {
    const { ed } = await guscio();
    lettere(ed, 'ok perchè ');
    expect(testoDi(ed.stato.doc)).toBe('Ok perché ');
    tasto(ed, 'z', true);
    expect(testoDi(ed.stato.doc)).toBe('Ok perchè ');
  });
  it('l’Invio corregge la parola appena finita', async () => {
    const { ed } = await guscio();
    lettere(ed, 'ok perchè');
    tasto(ed, 'Enter');
    expect(testoDi(ed.stato.doc)).toBe('Ok perché\n');
  });
  it('la finestra: dal menu Strumenti e dalle Preferenze; caselle e elenco cambiano subito l’editor', async () => {
    const { g, ed } = await guscio();
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'strumenti', voce: 'Correzione automatica' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    let dlg: any = g.shadowRoot.querySelector('docs-correzione');
    expect(dlg).toBeTruthy();
    await dlg.updateComplete;
    const box = dlg.shadowRoot.querySelector('input[data-chiave="virgoletteTipografiche"]') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.checked = false; box.dispatchEvent(new Event('change'));
    await g.updateComplete;
    expect(ed.opzioniCorrezione.virgolette).toBe(false);
    // aggiungere una sostituzione
    const da = dlg.shadowRoot.querySelector('input.da') as HTMLInputElement;
    const a = dlg.shadowRoot.querySelector('input.a') as HTMLInputElement;
    da.value = 'ndr'; da.dispatchEvent(new Event('input'));
    a.value = 'nota del redattore'; a.dispatchEvent(new Event('input'));
    await dlg.updateComplete;
    (dlg.shadowRoot.querySelector('button.aggiungi') as HTMLButtonElement).click();
    await g.updateComplete; await dlg.updateComplete;
    expect(ed.opzioniCorrezione.elenco.some(([d, x]: [string, string]) => d === 'ndr' && x === 'nota del redattore')).toBe(true);
    expect(JSON.parse(localStorage.getItem('pmb_docs.preferenze')!).sostituzioni.length).toBe(SOSTITUZIONI_PREDEFINITE.length + 1);
    // ripristinare l'elenco
    (dlg.shadowRoot.querySelector('button.ripristina') as HTMLButtonElement).click();
    await g.updateComplete;
    expect(g.prefs.sostituzioni).toBeNull();
    (dlg.shadowRoot.querySelector('button.chiudi') as HTMLButtonElement).click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-correzione')).toBeNull();
    // dalle Preferenze
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'strumenti', voce: 'Preferenze' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    const pref: any = g.shadowRoot.querySelector('docs-preferenze');
    await pref.updateComplete;
    (pref.shadowRoot.querySelector('button.opzioni-correzione') as HTMLButtonElement).click();
    await g.updateComplete;
    dlg = g.shadowRoot.querySelector('docs-correzione');
    expect(dlg).toBeTruthy();
    expect(g.shadowRoot.querySelector('docs-preferenze')).toBeNull();
  });
});
