// T438: segnalibri (modello, file, editor, finestra) e numeri di riga.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { MENU } from '../../src/guscio/menu-dati';
import { disegna } from '../../src/editor/render';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import {
  cursore, daTesto, deserializza, elencoSegnalibri, impostaSegnalibro, nomeSegnalibroValido, serializza, statoIniziale, togliSegnalibro,
} from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; });

describe('T438: segnalibri nel modello', () => {
  it('i nomi vengono ripuliti e quelli vuoti, troppo lunghi o con caratteri di controllo sono rifiutati', () => {
    expect(nomeSegnalibroValido('  Capitolo   uno ')).toBe('Capitolo uno');
    expect(nomeSegnalibroValido('   ')).toBeNull();
    expect(nomeSegnalibroValido('a'.repeat(61))).toBeNull();
    expect(nomeSegnalibroValido('a'.repeat(60))).not.toBeNull();
    expect(nomeSegnalibroValido('a\u0007b')).toBeNull();
  });
  it('si mette sul paragrafo, si elenca in ordine di documento e si toglie', () => {
    let doc = daTesto('uno\ndue\ntre');
    doc = impostaSegnalibro(doc, 2, 'Fine');
    doc = impostaSegnalibro(doc, 0, 'Inizio');
    expect(elencoSegnalibri(doc)).toEqual([{ nome: 'Inizio', p: 0, anteprima: 'uno' }, { nome: 'Fine', p: 2, anteprima: 'tre' }]);
    doc = togliSegnalibro(doc, 'inizio'); // senza distinguere maiuscole
    expect(elencoSegnalibri(doc).map((v) => v.nome)).toEqual(['Fine']);
    expect(togliSegnalibro(doc, 'non c\'è')).toBe(doc);
  });
  it('lo stesso nome su un altro paragrafo sposta il segnalibro; un paragrafo ha un solo segnalibro', () => {
    let doc = impostaSegnalibro(daTesto('uno\ndue'), 0, 'X');
    doc = impostaSegnalibro(doc, 1, 'x');
    expect(elencoSegnalibri(doc).map((v) => [v.nome, v.p])).toEqual([['x', 1]]);
    doc = impostaSegnalibro(doc, 1, 'Y');
    expect(elencoSegnalibri(doc).map((v) => v.nome)).toEqual(['Y']);
  });
  it('un nome non ammesso non cambia il documento', () => {
    const doc = daTesto('uno');
    expect(impostaSegnalibro(doc, 0, '  ')).toBe(doc);
    expect(impostaSegnalibro(doc, 5, 'ok')).toBe(doc);
  });
  it('A capo nel paragrafo col segnalibro: il segnalibro resta in un solo paragrafo', () => {
    const doc = impostaSegnalibro(daTesto('uno due'), 0, 'S');
    const st = { ...statoIniziale(doc), sel: cursore(0, 3) };
    const dopo = eseguiAzioneFormato({ ...nuovoEditor(), storia: { ...nuovoEditor().storia, presente: st } }, { tipo: 'invio' }).ed;
    const d = statoCorrente(dopo).doc;
    expect(d.paragrafi.length).toBe(2);
    expect(d.paragrafi.filter((p) => p.sg !== undefined).length).toBe(1);
    expect(d.paragrafi[0].sg).toBe('S');
  });
  it('si salva e si rilegge nel formato del programma; un nome non valido nel file è rifiutato', () => {
    const doc = impostaSegnalibro(daTesto('uno\ndue'), 1, 'Mio segnalibro');
    expect(deserializza(serializza(doc)).paragrafi[1].sg).toBe('Mio segnalibro');
    const rotto = serializza(doc).replace('Mio segnalibro', '');
    expect(() => deserializza(rotto)).toThrow();
  });
});

describe('T438: segnalibri nel disegno e nel .docx', () => {
  it('il paragrafo col segnalibro ha la classe e il nome come attributo', () => {
    const zona = document.createElement('div');
    disegna(zona, impostaSegnalibro(daTesto('uno\ndue'), 1, 'Qui'));
    const p = zona.querySelectorAll('p');
    expect(p[0].classList.contains('segnalibro')).toBe(false);
    expect(p[1].classList.contains('segnalibro')).toBe(true);
    expect(p[1].getAttribute('data-sg')).toBe('Qui');
  });
  it('si esporta e si rilegge in .docx (il nome come lo vuole Word: lettere, cifre e trattino basso)', async () => {
    const doc = impostaSegnalibro(impostaSegnalibro(daTesto('uno\ndue\ntre'), 0, 'Capitolo'), 2, 'Fine del testo');
    const letto = await importaDocx(await esportaDocx(doc));
    expect(letto.paragrafi.map((p) => p.sg)).toEqual(['Capitolo', undefined, 'Fine_del_testo']);
    expect(letto.paragrafi.map((p) => p.runs.map((r) => r.t).join(''))).toEqual(['uno', 'due', 'tre']);
  });
  it('un nome che non comincia con una lettera viene preceduto da S_ nel file', async () => {
    const letto = await importaDocx(await esportaDocx(impostaSegnalibro(daTesto('uno'), 0, '2024 bilancio')));
    expect(letto.paragrafi[0].sg).toBe('S_2024_bilancio');
  });
  it('i segnalibri interni di Word (che cominciano con _) non si importano', async () => {
    const byte = await esportaDocx(impostaSegnalibro(daTesto('uno'), 0, 'Prova'));
    // simulo un file di Word: stesso contenuto, ma con il segnalibro _GoBack al posto di Prova
    const { leggiZip, scriviZip } = await import('@comune/formati/zip');
    const voci = await leggiZip(byte);
    const nuovo = new Map(voci);
    const xml = new TextDecoder().decode(nuovo.get('word/document.xml')!).replace('w:name="Prova"', 'w:name="_GoBack"');
    nuovo.set('word/document.xml', new TextEncoder().encode(xml));
    const letto = await importaDocx(await scriviZip(Array.from(nuovo, ([nome, dati]) => ({ nome, dati }))));
    expect(letto.paragrafi[0].sg).toBeUndefined();
  });
});

describe('T438: segnalibri e numeri di riga nel guscio', () => {
  async function guscio(): Promise<any> {
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    ed.impostaStato({ ...statoIniziale(daTesto('uno\ndue\ntre')), sel: cursore(1, 0) });
    await g.updateComplete;
    return g;
  }
  async function voceMenu(g: any, menu: string, etichetta: string): Promise<void> {
    const barra: any = g.shadowRoot.querySelector('docs-menubar');
    await barra.updateComplete;
    (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
    await barra.updateComplete;
    const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
    voce.click();
    await barra.updateComplete;
    await attendi();
    await g.updateComplete;
  }

  it('le voci Segnalibro e Numeri di riga non sono più disattivate', () => {
    const tutte = MENU.flatMap((m) => m.voci);
    expect(tutte.find((v) => v.etichetta === 'Segnalibro')?.disabilitata).toBeUndefined();
    expect(tutte.find((v) => v.etichetta === 'Numeri di riga')?.disabilitata).toBeUndefined();
    expect(tutte.find((v) => v.etichetta === 'Tab')?.disabilitata).toBeUndefined(); // Tab è stato attivato dopo (T445)
  });

  it('Inserisci > Segnalibro apre la finestra; Aggiungi mette il segnalibro sul paragrafo del cursore e Vai ci porta il cursore', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Segnalibro');
    const fin: any = g.shadowRoot.querySelector('docs-segnalibri');
    expect(fin).not.toBeNull();
    fin.dispatchEvent(new CustomEvent('aggiungi', { detail: { nome: 'Centro' }, bubbles: true, composed: true }));
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(ed.stato.doc.paragrafi[1].sg).toBe('Centro');
    expect(g.elencoSegnalibri.map((v: any) => v.nome)).toEqual(['Centro']);
    // il cursore si sposta altrove, poi Vai lo riporta
    ed.impostaStato({ ...ed.stato, sel: cursore(2, 1) });
    fin.dispatchEvent(new CustomEvent('vai', { detail: { nome: 'Centro', p: 1 }, bubbles: true, composed: true }));
    await g.updateComplete;
    expect(ed.stato.sel.fuoco).toEqual({ p: 1, o: 0 });
    expect(g.shadowRoot.querySelector('docs-segnalibri')).toBeNull(); // Vai chiude la finestra
  });

  it('Togli lo toglie dal documento e dall\'elenco; Annulla rimette il segnalibro', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(ed.aggiungiSegnalibro('Uno')).toBe(true);
    expect(ed.aggiungiSegnalibro('   ')).toBe(false);
    ed.rimuoviSegnalibro('uno');
    expect(ed.segnalibri()).toEqual([]);
    ed.annulla();
    expect(ed.segnalibri().map((v: any) => v.nome)).toEqual(['Uno']);
  });

  it('Esc chiude la finestra dei segnalibri', async () => {
    const g = await guscio();
    await voceMenu(g, 'inserisci', 'Segnalibro');
    expect(g.shadowRoot.querySelector('docs-segnalibri')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-segnalibri')).toBeNull();
  });

  it('Strumenti > Numeri di riga accende e spegne l\'attributo dell\'editor e avvisa', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    expect(ed.hasAttribute('numeri-riga')).toBe(false);
    await voceMenu(g, 'strumenti', 'Numeri di riga');
    await ed.updateComplete;
    expect(ed.hasAttribute('numeri-riga')).toBe(true);
    expect(g.avviso).toMatch(/Numeri di riga visibili/);
    await voceMenu(g, 'strumenti', 'Numeri di riga');
    await ed.updateComplete;
    expect(ed.hasAttribute('numeri-riga')).toBe(false);
  });

  it('i numeri di riga si disegnano nello strato dedicato, uno per riga misurata (senza tabelle)', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    // senza layout (happy-dom) non si disegna niente: si simula la misura
    ed.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} });
    ed.misuraRighe = () => [
      { riga: { alto: 10, basso: 30 }, paragrafo: null },
      { riga: { alto: 30, basso: 50 }, paragrafo: null },
      { riga: { alto: 60, basso: 80 }, paragrafo: null, tr: {} },
      { riga: { alto: 90, basso: 110 }, paragrafo: null },
    ];
    ed.impostaNumeriRiga(true);
    await ed.updateComplete;
    const nr = Array.from(ed.shadowRoot.querySelectorAll('.numeri-riga .nr')) as HTMLElement[];
    expect(nr.map((n) => n.textContent)).toEqual(['1', '2', '3']);
    expect(nr[2].style.top).toBe('90px');
    ed.impostaNumeriRiga(false);
    await ed.updateComplete;
    expect(ed.shadowRoot.querySelectorAll('.numeri-riga .nr').length).toBe(0);
  });
});

describe('T438: il focus torna all\'editor dopo Numeri di riga', () => {
  it('dopo il comando dal menu l\'editor ha il focus per scrivere', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    let focalizzato = 0;
    ed.focalizza = () => { focalizzato++; };
    g.alternaNumeriRiga();
    expect(focalizzato).toBe(1);
    g.alternaNumeriRiga();
    expect(focalizzato).toBe(2);
  });
});
