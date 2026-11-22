// T530: maiuscola automatica a inizio frase (segnalazione degli utenti, 2026-11-18): dopo «. », «! », «? » e a inizio paragrafo
// la lettera minuscola scritta diventa maiuscola; non dopo le abbreviazioni, i puntini di sospensione e le iniziali.
// Ctrl+Z subito dopo toglie solo la maiuscola. Si spegne in Preferenze › Correzione automatica.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { iniziaFrase, maiuscolaAutomatica, maiuscolaDi } from '../../src/editor/maiuscola';
import { cursore, daTesto, inserisciTesto, statoIniziale, testoDi, type Stato } from '../../src/modello/documento';
import { ripulisciPreferenze, PREFERENZE_PREDEFINITE } from '../../src/guscio/preferenze';
import { impostaLingua, t } from '../../src/i18n/lingua';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T530: quando comincia una frase', () => {
  it('a inizio paragrafo, anche dopo spazi, virgolette o parentesi aperte', () => {
    for (const prima of ['', ' ', '  ', '«', '"', '(', '“', ' «']) expect(iniziaFrase(prima), JSON.stringify(prima)).toBe(true);
  });
  it('dopo punto, punto esclamativo o interrogativo seguiti da uno spazio', () => {
    for (const prima of ['Ciao. ', 'Ciao! ', 'Davvero? ', 'Davvero?! ', 'Fine.  ', 'Ha detto «sì». ', 'Vero (credo). ', 'Ciao. «', 'Erano 3. ', 'www.sito.it. ']) {
      expect(iniziaFrase(prima), prima).toBe(true);
    }
  });
  it('non a metà frase, né subito dopo il punto senza spazio', () => {
    for (const prima of ['Ciao ', 'Ciao, ', 'Ciao; ', 'Ciao: ', 'Ciao.', 'www.', 'nome@dominio.', '3.', 'Ciao. x ']) expect(iniziaFrase(prima), prima).toBe(false);
  });
  it('non dopo le abbreviazioni comuni, le iniziali e i puntini di sospensione', () => {
    for (const prima of ['Vedi es. ', 'mele, pere ecc. ', 'a pag. ', 'il sig. ', 'la dott.ssa ', 'cfr. ', 'p.es. ', 'nel 50 a.C. ', 'e.g. ', 'Mr. ', 'J. ', 'Aspetta... ', 'Aspetta… ', 'il prof. ', 'art. ', '(es. ']) {
      expect(iniziaFrase(prima), prima).toBe(false);
    }
  });
  it('le parole comuni a fine frase non sono abbreviazioni', () => {
    for (const prima of ['Ho detto no. ', 'Two years ago. ', 'That is all. ', 'Vado a est. ', 'Go on. ', 'Game, set. ']) expect(iniziaFrase(prima), prima).toBe(true);
  });
  it('maiuscolaDi: solo minuscole che restano un carattere', () => {
    expect(maiuscolaDi('a')).toBe('A');
    expect(maiuscolaDi('è')).toBe('È');
    expect(maiuscolaDi('ß')).toBeNull();
    expect(maiuscolaDi('A')).toBeNull();
    expect(maiuscolaDi('1')).toBeNull();
    expect(maiuscolaDi('.')).toBeNull();
  });
});

describe('T530: sul documento', () => {
  const dopo = (st: Stato, c: string): Stato => inserisciTesto(st, c);
  it('cambia solo la lettera appena scritta e lascia selezione e formato', () => {
    const doc = daTesto('Ciao. ');
    doc.paragrafi[0].runs = [{ t: 'Ciao. ', g: true, c: false, s: false, k: '#ff0000' }];
    const st = dopo({ ...statoIniziale(doc), sel: cursore(0, 6) }, 'c');
    const m = maiuscolaAutomatica(st)!;
    expect(testoDi(m.doc)).toBe('Ciao. C');
    expect(m.sel).toEqual(st.sel);
    expect(m.doc.paragrafi[0].runs.every((r) => r.g && r.k === '#ff0000')).toBe(true);
    expect(testoDi(st.doc)).toBe('Ciao. c'); // l'ingresso non cambia
  });
  it('null quando non serve: a metà frase, lettera già maiuscola, numero, selezione estesa', () => {
    expect(maiuscolaAutomatica(dopo({ ...statoIniziale(daTesto('Ciao ')), sel: cursore(0, 5) }, 'c'))).toBeNull();
    expect(maiuscolaAutomatica(dopo(statoIniziale(), 'C'))).toBeNull();
    expect(maiuscolaAutomatica(dopo(statoIniziale(), '3'))).toBeNull();
    const st = dopo(statoIniziale(), 'c');
    expect(maiuscolaAutomatica({ ...st, sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 1 } } })).toBeNull();
  });
  it('a inizio del secondo paragrafo', () => {
    const st = dopo({ ...statoIniziale(daTesto('Primo\n')), sel: cursore(1, 0) }, 'd');
    expect(testoDi(maiuscolaAutomatica(st)!.doc)).toBe('Primo\nD');
  });
});

describe('T530: nel programma', () => {
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
  const scriviLettere = (ed: any, testo: string): void => {
    const c: HTMLTextAreaElement = ed.shadowRoot.querySelector('textarea.ingresso');
    for (const ch of testo) { c.value = ch; c.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  const tasto = (ed: any, key: string, ctrl = false): void => {
    ed.shadowRoot.querySelector('textarea.ingresso').dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, composed: true, cancelable: true }));
  };

  it('scrivendo lettera per lettera le frasi cominciano con la maiuscola', async () => {
    const { ed } = await guscio();
    scriviLettere(ed, 'ciao. come stai? bene! vedi es. sopra');
    expect(testoDi(ed.stato.doc)).toBe('Ciao. Come stai? Bene! Vedi es. sopra');
  });
  it('Ctrl+Z subito dopo toglie solo la maiuscola; un secondo Ctrl+Z toglie la scrittura', async () => {
    const { ed } = await guscio();
    scriviLettere(ed, 'uno. d');
    expect(testoDi(ed.stato.doc)).toBe('Uno. D');
    tasto(ed, 'z', true);
    expect(testoDi(ed.stato.doc)).toBe('Uno. d');
    scriviLettere(ed, 'ue');
    expect(testoDi(ed.stato.doc)).toBe('Uno. due');
  });
  it('il testo incollato o scritto tutto insieme non si tocca', async () => {
    const { ed } = await guscio();
    const c: HTMLTextAreaElement = ed.shadowRoot.querySelector('textarea.ingresso');
    c.value = 'ciao. come'; c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(testoDi(ed.stato.doc)).toBe('ciao. come');
  });
  it('spenta nelle Preferenze non cambia nulla, e la scelta si ricorda', async () => {
    const { g, ed } = await guscio({ maiuscolaAutomatica: false });
    expect(ed.maiuscolaAutomaticaAttiva).toBe(false);
    scriviLettere(ed, 'ciao. come');
    expect(testoDi(ed.stato.doc)).toBe('ciao. come');
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'strumenti', voce: 'Preferenze' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    const dlg: any = g.shadowRoot.querySelector('docs-preferenze');
    await dlg.updateComplete;
    const fs = Array.from(dlg.shadowRoot.querySelectorAll('fieldset')).find((f: any) => f.querySelector('legend')?.textContent === 'Correzione automatica') as HTMLElement;
    expect(fs).toBeTruthy();
    const box = fs.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true; box.dispatchEvent(new Event('change'));
    await g.updateComplete;
    expect(ed.maiuscolaAutomaticaAttiva).toBe(true);
    expect(JSON.parse(localStorage.getItem('pmb_docs.preferenze')!).maiuscolaAutomatica).toBe(true);
  });
  it('accesa di serie, e un valore non valido torna acceso', () => {
    expect(PREFERENZE_PREDEFINITE.maiuscolaAutomatica).toBe(true);
    expect(ripulisciPreferenze({ maiuscolaAutomatica: 'no' }).maiuscolaAutomatica).toBe(true);
    expect(ripulisciPreferenze({ maiuscolaAutomatica: false }).maiuscolaAutomatica).toBe(false);
  });
  it('testi della finestra tradotti in inglese', () => {
    impostaLingua('en');
    try {
      for (const s of ['Correzione automatica', 'Maiuscola automatica a inizio frase', 'Dopo il punto e a inizio paragrafo. Ctrl+Z subito dopo la toglie.']) expect(t(s)).not.toBe(s);
    } finally { impostaLingua('it'); }
  });
});
