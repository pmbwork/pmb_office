import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import { DocsTrova } from '../../src/guscio/docs-trova';
import { daTesto, cursore, testoDi } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- la barra di ricerca da sola
async function barra(): Promise<any> {
  const t: any = document.createElement('docs-trova');
  document.body.appendChild(t);
  await t.updateComplete;
  return t;
}
const campoQ = (t: any): HTMLInputElement => t.shadowRoot.querySelector('input.q');
const campoS = (t: any): HTMLInputElement | null => t.shadowRoot.querySelector('input.s');
const conteggio = (t: any): HTMLElement => t.shadowRoot.querySelector('.conteggio');
function scrivi(campo: HTMLInputElement, testo: string): void { campo.value = testo; campo.dispatchEvent(new Event('input', { bubbles: true })); }
function ascolta(t: any, ...nomi: string[]): Array<[string, any]> {
  const v: Array<[string, any]> = [];
  for (const n of nomi) t.addEventListener(n, (e: any) => v.push([n, e.detail]));
  return v;
}
function tastoSu(campo: HTMLElement, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  campo.dispatchEvent(e);
  return e;
}

describe('T081: la barra di ricerca', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('scrivendo avvisa con il testo cercato e le opzioni; le opzioni si accendono e rilanciano la ricerca', async () => {
    const t = await barra();
    const v = ascolta(t, 'ricerca');
    scrivi(campoQ(t), 'gatto');
    expect(v).toEqual([['ricerca', { query: 'gatto', opzioni: { maiuscole: false, parolaIntera: false, regex: false } }]]);
    const bottoni = Array.from(t.shadowRoot.querySelectorAll('button.opzione')) as HTMLButtonElement[];
    expect(bottoni.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    bottoni[0].click();
    bottoni[2].click();
    await t.updateComplete;
    expect(bottoni.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true']);
    expect(v[v.length - 1][1]).toEqual({ query: 'gatto', opzioni: { maiuscole: true, parolaIntera: false, regex: true } });
    bottoni[0].click();
    await t.updateComplete;
    expect(bottoni[0].getAttribute('aria-pressed')).toBe('false');
    expect(v.length).toBe(4);
  });

  it('Invio e Maiusc+Invio vanno avanti e indietro, Esc chiude; lo stesso fanno i pulsanti', async () => {
    const t = await barra();
    const v = ascolta(t, 'successivo', 'precedente', 'chiudi');
    expect(tastoSu(campoQ(t), 'Enter').defaultPrevented).toBe(true);
    tastoSu(campoQ(t), 'Enter', { shiftKey: true });
    tastoSu(campoQ(t), 'Escape');
    t.shadowRoot.querySelector('button.successivo').click();
    t.shadowRoot.querySelector('button.precedente').click();
    t.shadowRoot.querySelector('button.chiudi').click();
    expect(v.map((x) => x[0])).toEqual(['successivo', 'precedente', 'chiudi', 'successivo', 'precedente', 'chiudi']);
    expect(tastoSu(campoQ(t), 'a').defaultPrevented).toBe(false);
  });

  it('il conteggio: vuoto, nessun risultato, "2 di 5", con il più se i risultati sono troppi, e gli errori', async () => {
    const t = await barra();
    expect(conteggio(t).textContent?.trim()).toBe('');
    scrivi(campoQ(t), 'x');
    await t.updateComplete;
    expect(conteggio(t).textContent?.trim()).toBe('Nessun risultato');
    t.totale = 5; t.corrente = 2;
    await t.updateComplete;
    expect(conteggio(t).textContent?.trim()).toBe('2 di 5');
    t.troncato = true;
    await t.updateComplete;
    expect(conteggio(t).textContent?.trim()).toBe('2 di 5+');
    t.errore = 'Espressione regolare non valida';
    await t.updateComplete;
    expect(conteggio(t).textContent?.trim()).toBe('Espressione regolare non valida');
    expect(conteggio(t).classList.contains('errore')).toBe(true);
    scrivi(campoQ(t), '');
    await t.updateComplete;
    expect(conteggio(t).textContent?.trim()).toBe('');
  });

  it('la riga della sostituzione compare solo se richiesta; i pulsanti e Invio mandano il testo da mettere', async () => {
    const t = await barra();
    expect(campoS(t)).toBeNull();
    expect(t.shadowRoot.querySelector('button.sostituisci')).toBeNull();
    t.sostituzione = true;
    await t.updateComplete;
    const v = ascolta(t, 'sostituisci', 'sostituisci-tutto');
    scrivi(campoS(t)!, 'cane');
    t.shadowRoot.querySelector('button.sostituisci').click();
    t.shadowRoot.querySelector('button.sostituisci-tutto').click();
    expect(tastoSu(campoS(t)!, 'Enter').defaultPrevented).toBe(true);
    expect(v).toEqual([['sostituisci', { sostituto: 'cane' }], ['sostituisci-tutto', { sostituto: 'cane' }], ['sostituisci', { sostituto: 'cane' }]]);
  });

  it('impostaQuery riempie la casella e avvia la ricerca; focalizza mette il cursore nella casella', async () => {
    const t = await barra();
    const v = ascolta(t, 'ricerca');
    t.impostaQuery('parola');
    await t.updateComplete;
    expect(campoQ(t).value).toBe('parola');
    expect(v.length).toBe(1);
    expect(v[0][1].query).toBe('parola');
    let fuoco = false;
    campoQ(t).focus = () => { fuoco = true; };
    t.focalizza();
    expect(fuoco).toBe(true);
  });
});

// ---------------------------------------------------------------- l'editor
async function editor(testo: string): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  el.impostaStato({ doc: daTesto(testo), sel: cursore(0, 0), pendenti: null });
  return el;
}
const sel = (el: any): [number, number, number, number] => [el.stato.sel.ancora.p, el.stato.sel.ancora.o, el.stato.sel.fuoco.p, el.stato.sel.fuoco.o];
function tastoEditor(el: any, key: string, extra: Record<string, unknown> = {}): void {
  el.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
}
const OPZ = { maiuscole: false, parolaIntera: false, regex: false };

describe('T081: ricerca nell\'editor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('cerca seleziona il primo risultato dal cursore in poi; avanti e indietro girano in tondo', async () => {
    const el = await editor('Il gatto e il Gatto e un gatto');
    expect(el.cerca('gatto', OPZ)).toEqual({ totale: 3, corrente: 1, errore: null, troncato: false });
    expect(sel(el)).toEqual([0, 3, 0, 8]);
    expect(el.vaiAlRisultato(1).corrente).toBe(2);
    expect(sel(el)).toEqual([0, 14, 0, 19]);
    expect(el.vaiAlRisultato(1).corrente).toBe(3);
    expect(el.vaiAlRisultato(1).corrente).toBe(1);
    expect(sel(el)).toEqual([0, 3, 0, 8]);
    expect(el.vaiAlRisultato(-1).corrente).toBe(3);
    expect(el.cerca('gatto', { ...OPZ, maiuscole: true }).totale).toBe(2);
    expect(el.cerca('', OPZ)).toEqual({ totale: 0, corrente: 0, errore: null, troncato: false });
    expect(el.vaiAlRisultato(1).totale).toBe(0);
  });

  it('cominciando da un punto più avanti nel testo il primo risultato è quello dopo il cursore', async () => {
    const el = await editor('uno due uno due uno');
    el.impostaStato({ doc: daTesto('uno due uno due uno'), sel: cursore(0, 5), pendenti: null });
    expect(el.cerca('uno', OPZ).corrente).toBe(2);
    expect(sel(el)).toEqual([0, 8, 0, 11]);
  });

  it('mentre si allunga la parola cercata resta in evidenza lo stesso risultato', async () => {
    const el = await editor('xx gatto xx gatto');
    el.cerca('g', OPZ);
    el.vaiAlRisultato(1);
    expect(sel(el)).toEqual([0, 12, 0, 13]);
    expect(el.cerca('gat', OPZ).corrente).toBe(2);
    expect(sel(el)).toEqual([0, 12, 0, 15]);
  });

  it('scrivendo e cancellando la ricerca una lettera alla volta si riparte sempre dal cursore di prima, senza saltare risultati', async () => {
    const el = await editor('sit amet consectetur tempor xx tempor');
    for (const q of ['t', 'te', 'tem', 'temp', 'tempo', 'tempor']) el.cerca(q, OPZ);
    expect(el.statoRicerca().corrente).toBe(1);
    expect(sel(el)).toEqual([0, 21, 0, 27]);
    for (const q of ['tempo', 'temp', 'tem', 'te', 't']) el.cerca(q, OPZ);
    expect(el.statoRicerca().corrente).toBe(1);
    expect(sel(el)).toEqual([0, 2, 0, 3]);
    el.vaiAlRisultato(1);
    el.cerca('te', OPZ);
    expect(sel(el)).toEqual([0, 15, 0, 17]);
  });

  it('espressione regolare sbagliata: errore e nessun risultato', async () => {
    const el = await editor('abc');
    const r = el.cerca('(', { ...OPZ, regex: true });
    expect(r.totale).toBe(0);
    expect(r.errore).toBe('Espressione regolare non valida');
  });

  it('sostituisci passa al prossimo risultato; è un solo passo di annulla', async () => {
    const el = await editor('gatto e gatto e gatto');
    el.cerca('gatto', OPZ);
    const r = el.sostituisciCorrente('cane');
    expect(testoDi(el.stato.doc)).toBe('cane e gatto e gatto');
    expect(r.totale).toBe(2);
    expect(r.corrente).toBe(1);
    expect(sel(el)).toEqual([0, 7, 0, 12]);
    el.sostituisciCorrente('topo');
    expect(testoDi(el.stato.doc)).toBe('cane e topo e gatto');
    tastoEditor(el, 'z', { ctrlKey: true });
    expect(testoDi(el.stato.doc)).toBe('cane e gatto e gatto');
    tastoEditor(el, 'z', { ctrlKey: true });
    expect(testoDi(el.stato.doc)).toBe('gatto e gatto e gatto');
  });

  it('sostituisci tutto: tutte insieme, con il conteggio, in un solo passo di annulla', async () => {
    const el = await editor('gatto e gatto\ne gatto');
    el.cerca('gatto', OPZ);
    const r = el.sostituisciTutto('cane');
    expect(r.conteggio).toBe(3);
    expect(testoDi(el.stato.doc)).toBe('cane e cane\ne cane');
    expect(r.totale).toBe(0);
    tastoEditor(el, 'z', { ctrlKey: true });
    expect(testoDi(el.stato.doc)).toBe('gatto e gatto\ne gatto');
    expect(el.sostituisciTutto('x').conteggio).toBe(3);
  });

  it('la ricerca resta attiva mentre si scrive e si aggiorna da sola; azzeraRicerca la chiude', async () => {
    const el = await editor('ab');
    el.cerca('b', OPZ);
    expect(el.statoRicerca().totale).toBe(1);
    const c = el.shadowRoot.querySelector('textarea') as HTMLTextAreaElement;
    tastoEditor(el, 'End', { ctrlKey: true });
    c.value = 'b';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(testoDi(el.stato.doc)).toBe('abb');
    expect(el.statoRicerca().totale).toBe(2);
    el.azzeraRicerca();
    expect(el.statoRicerca()).toEqual({ totale: 0, corrente: 0, errore: null, troncato: false });
  });

  it('testoSelezionato: solo se sta in un paragrafo e non è lunghissimo', async () => {
    const el = await editor('uno due\ntre');
    el.impostaStato({ doc: daTesto('uno due\ntre'), sel: { ancora: { p: 0, o: 4 }, fuoco: { p: 0, o: 7 } }, pendenti: null });
    expect(el.testoSelezionato()).toBe('due');
    el.impostaStato({ doc: daTesto('uno due\ntre'), sel: { ancora: { p: 0, o: 4 }, fuoco: { p: 1, o: 1 } }, pendenti: null });
    expect(el.testoSelezionato()).toBe('');
    el.impostaStato({ doc: daTesto('x'.repeat(500)), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 300 } }, pendenti: null });
    expect(el.testoSelezionato()).toBe('');
    el.impostaStato({ doc: daTesto('abc'), sel: cursore(0, 1), pendenti: null });
    expect(el.testoSelezionato()).toBe('');
  });
});

// ---------------------------------------------------------------- tutto insieme nel guscio
async function guscio(testo: string): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ doc: daTesto(testo), sel: cursore(0, 0), pendenti: null });
  return { g, ed };
}
function tastoGuscio(ed: any, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...extra });
  ed.shadowRoot.querySelector('textarea').dispatchEvent(e);
  return e;
}
const trovaDi = (g: any): any => g.shadowRoot.querySelector('docs-trova');
async function aggiornaTutto(g: any): Promise<void> { await attendi(); await g.updateComplete; const t = trovaDi(g); if (t) await t.updateComplete; }

describe('T081: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('Ctrl+F apre la barra senza la riga della sostituzione e mette il cursore nella casella; Ctrl+H la apre con la sostituzione', async () => {
    const fuoco = vi.spyOn(DocsTrova.prototype, 'focalizza');
    const { g, ed } = await guscio('uno due');
    expect(trovaDi(g)).toBeNull();
    const e = tastoGuscio(ed, 'f', { ctrlKey: true });
    await aggiornaTutto(g);
    expect(e.defaultPrevented).toBe(true);
    expect(trovaDi(g)).not.toBeNull();
    expect(trovaDi(g).shadowRoot.querySelector('input.s')).toBeNull();
    expect(fuoco).toHaveBeenCalled();
    tastoGuscio(ed, 'h', { ctrlKey: true });
    await aggiornaTutto(g);
    expect(trovaDi(g).shadowRoot.querySelector('input.s')).not.toBeNull();
  });

  it('il testo selezionato diventa la ricerca; scrivere nella casella evidenzia, Invio scorre, Esc chiude e toglie le evidenziazioni', async () => {
    const { g, ed } = await guscio('il gatto e il gatto e il cane');
    ed.impostaStato({ doc: daTesto('il gatto e il gatto e il cane'), sel: { ancora: { p: 0, o: 3 }, fuoco: { p: 0, o: 8 } }, pendenti: null });
    tastoGuscio(ed, 'f', { ctrlKey: true });
    await aggiornaTutto(g);
    const t = trovaDi(g);
    expect(t.shadowRoot.querySelector('input.q').value).toBe('gatto');
    expect(t.shadowRoot.querySelector('.conteggio').textContent.trim()).toBe('1 di 2');
    scrivi(t.shadowRoot.querySelector('input.q'), 'il');
    await aggiornaTutto(g);
    expect(t.shadowRoot.querySelector('.conteggio').textContent.trim()).toBe('2 di 3');
    tastoSu(t.shadowRoot.querySelector('input.q'), 'Enter');
    await aggiornaTutto(g);
    expect(t.shadowRoot.querySelector('.conteggio').textContent.trim()).toBe('3 di 3');
    expect(ed.stato.sel).toEqual({ ancora: { p: 0, o: 22 }, fuoco: { p: 0, o: 24 } });
    tastoSu(t.shadowRoot.querySelector('input.q'), 'Enter', { shiftKey: true });
    await aggiornaTutto(g);
    expect(t.shadowRoot.querySelector('.conteggio').textContent.trim()).toBe('2 di 3');
    expect(ed.stato.sel).toEqual({ ancora: { p: 0, o: 11 }, fuoco: { p: 0, o: 13 } });
    tastoSu(t.shadowRoot.querySelector('input.q'), 'Escape');
    await aggiornaTutto(g);
    expect(trovaDi(g)).toBeNull();
    expect(ed.statoRicerca().totale).toBe(0);
  });

  it('Sostituisci tutto dal guscio: sostituisce, avvisa quante e il testo torna com\'era con un solo annulla', async () => {
    const { g, ed } = await guscio('gatto e gatto e gatto');
    tastoGuscio(ed, 'h', { ctrlKey: true });
    await aggiornaTutto(g);
    const t = trovaDi(g);
    scrivi(t.shadowRoot.querySelector('input.q'), 'gatto');
    scrivi(t.shadowRoot.querySelector('input.s'), 'cane');
    await aggiornaTutto(g);
    t.shadowRoot.querySelector('button.sostituisci').click();
    await aggiornaTutto(g);
    expect(testoDi(ed.stato.doc)).toBe('cane e gatto e gatto');
    t.shadowRoot.querySelector('button.sostituisci-tutto').click();
    await aggiornaTutto(g);
    expect(testoDi(ed.stato.doc)).toBe('cane e cane e cane');
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('Sostituite 2 occorrenze');
    tastoGuscio(ed, 'z', { ctrlKey: true });
    expect(testoDi(ed.stato.doc)).toBe('cane e gatto e gatto');
  });

  it('dal menu Modifica > Trova e sostituisci e dalla lente della barra strumenti', async () => {
    const { g } = await guscio('uno');
    const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
    (barraMenu.shadowRoot.querySelector('button.titolo-menu[data-menu="modifica"]') as HTMLButtonElement).click();
    await barraMenu.updateComplete;
    const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Trova e sostituisci')!;
    voce.click();
    await aggiornaTutto(g);
    expect(trovaDi(g)).not.toBeNull();
    expect(trovaDi(g).shadowRoot.querySelector('input.s')).not.toBeNull();
    trovaDi(g).shadowRoot.querySelector('button.chiudi').click();
    await aggiornaTutto(g);
    expect(trovaDi(g)).toBeNull();
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    (tb.shadowRoot.querySelector('button.comando[data-id="cerca"]') as HTMLButtonElement).click();
    await aggiornaTutto(g);
    expect(trovaDi(g)).not.toBeNull();
    expect(trovaDi(g).shadowRoot.querySelector('input.s')).toBeNull();
  });
});
