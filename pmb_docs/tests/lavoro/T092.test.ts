import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import '../../src/guscio/docs-link';
import { disegna } from '../../src/editor/render';
import { apriIndirizzo } from '../../src/guscio/tauri';
import { applicaAttributo, cursore, daTesto, testoDi, type Documento, type Selezione } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const URL1 = 'https://esempio.it/a';
const sel = (p: number, da: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p, o: a } });
/** "uno due tre" con "due" come link */
const docLink = (): Documento => applicaAttributo(daTesto('uno due tre'), sel(0, 4, 7), 'u', URL1);
const runs = (d: Documento) => d.paragrafi[0].runs.map((r) => [r.t, r.u]);

// ---------------------------------------------------------------- il disegno
describe('T092: il link nel disegno', () => {
  it('un tratto con link ha la classe link, l\'indirizzo in data-u e un suggerimento; gli altri tratti no', () => {
    const zona = document.createElement('div');
    disegna(zona, docLink());
    const span = Array.from(zona.querySelectorAll('span'));
    expect(span.map((s) => s.textContent)).toEqual(['uno ', 'due', ' tre']);
    expect(span.map((s) => s.classList.contains('link'))).toEqual([false, true, false]);
    expect(span.map((s) => s.getAttribute('data-u'))).toEqual([null, URL1, null]);
    expect(span[1].title).toContain(URL1);
    expect(span[1].title).toContain('Ctrl+clic');
    expect(span[0].title).toBe('');
  });

  it('un link in grassetto ha le due classi e il colore scelto resta sul tratto', () => {
    const zona = document.createElement('div');
    let d = applicaAttributo(docLink(), sel(0, 4, 7), 'g', true) as Documento;
    d = (applicaAttributo(d, sel(0, 4, 7), 'k', '#ff0000'));
    disegna(zona, d);
    const link = zona.querySelector('span.link') as HTMLElement;
    expect(link.className.split(' ').sort()).toEqual(['g', 'link']);
    expect(link.style.color).toBe('#ff0000');
  });
});

// ---------------------------------------------------------------- aprire un indirizzo
describe('T092: apertura degli indirizzi', () => {
  afterEach(() => { delete (window as any).__TAURI__; vi.restoreAllMocks(); });

  it('nel browser si apre una scheda nuova senza collegamento alla pagina, per http, https e mailto', async () => {
    const apri = vi.spyOn(window, 'open').mockReturnValue(null);
    for (const u of ['http://a.it', 'https://a.it/x?y=1', 'mailto:me@a.it']) expect(await apriIndirizzo(u)).toBe(true);
    expect(apri.mock.calls).toEqual([
      ['http://a.it', '_blank', 'noopener,noreferrer'],
      ['https://a.it/x?y=1', '_blank', 'noopener,noreferrer'],
      ['mailto:me@a.it', '_blank', 'noopener,noreferrer'],
    ]);
  });

  it('gli indirizzi non ammessi non si aprono, né nel browser né nell\'app', async () => {
    const apri = vi.spyOn(window, 'open').mockReturnValue(null);
    const invoke = vi.fn(async () => true);
    for (const u of ['', 'javascript:alert(1)', 'file:///c:/x.txt', 'data:text/html,x', 'www.esempio.it', 'https://a b.it']) expect(await apriIndirizzo(u), u).toBe(false);
    (window as any).__TAURI__ = { core: { invoke } };
    for (const u of ['javascript:alert(1)', 'file:///c:/x.txt']) expect(await apriIndirizzo(u), u).toBe(false);
    expect(apri).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('nell\'app chiama il comando nativo open_url e dice se è riuscito', async () => {
    const apri = vi.spyOn(window, 'open').mockReturnValue(null);
    const invoke = vi.fn(async () => true);
    (window as any).__TAURI__ = { core: { invoke } };
    expect(await apriIndirizzo(URL1)).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_url', { url: URL1 });
    expect(apri).not.toHaveBeenCalled();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (window as any).__TAURI__ = { core: { invoke: vi.fn(async () => { throw new Error('no'); }) } };
    expect(await apriIndirizzo(URL1)).toBe(false);
  });
});

// ---------------------------------------------------------------- l'editor
async function editor(doc: Documento, s: Selezione = cursore(0, 0)): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  el.impostaStato({ doc, sel: s, pendenti: null });
  return el;
}
function mouseGiu(bersaglio: Element, extra: Record<string, unknown> = {}): MouseEvent {
  const e = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true, button: 0, ...extra });
  bersaglio.dispatchEvent(e);
  return e;
}
const spanLink = (el: any): Element => el.shadowRoot.querySelector('.testo span.link');

describe('T092: l\'editor', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Ctrl+clic (o Cmd+clic) su un link avvisa con l\'indirizzo e lascia fermo il cursore', async () => {
    const el = await editor(docLink(), cursore(0, 1));
    el.posizioneDaPunto = () => ({ p: 0, o: 9 });
    const aperti: string[] = [];
    el.addEventListener('apri-link', (e: any) => aperti.push(e.detail.url));
    const e = mouseGiu(spanLink(el), { ctrlKey: true });
    expect(aperti).toEqual([URL1]);
    expect(e.defaultPrevented).toBe(true);
    mouseGiu(spanLink(el), { metaKey: true });
    expect(aperti).toEqual([URL1, URL1]);
    expect(el.stato.sel).toEqual(cursore(0, 1));
  });

  it('il clic senza Ctrl su un link mette il cursore e non apre niente; Ctrl+clic su testo senza link nemmeno', async () => {
    const el = await editor(docLink(), cursore(0, 1));
    el.posizioneDaPunto = () => ({ p: 0, o: 6 });
    const aperti: string[] = [];
    el.addEventListener('apri-link', (e: any) => aperti.push(e.detail.url));
    mouseGiu(spanLink(el));
    expect(aperti).toEqual([]);
    expect(el.stato.sel).toEqual(cursore(0, 6));
    const testoSemplice = el.shadowRoot.querySelector('.testo span:not(.link)');
    el.posizioneDaPunto = () => ({ p: 0, o: 2 });
    mouseGiu(testoSemplice, { ctrlKey: true });
    expect(aperti).toEqual([]);
    expect(el.stato.sel).toEqual(cursore(0, 2));
  });

  it('linkAttuale dice cosa c\'è sotto il cursore; link e togliLink cambiano il documento e il disegno', async () => {
    const el = await editor(daTesto('uno due tre'), sel(0, 4, 7));
    expect(el.linkAttuale()).toEqual({ url: null, testo: 'due', selezione: true });
    const cambi: number[] = [];
    el.addEventListener('cambio', () => cambi.push(1));
    el.applicaAzione({ tipo: 'link', url: 'www.esempio.it' });
    expect(runs(el.stato.doc)[1]).toEqual(['due', 'https://www.esempio.it']);
    expect(spanLink(el).textContent).toBe('due');
    expect(cambi.length).toBe(1);
    expect(el.linkAttuale()).toEqual({ url: 'https://www.esempio.it', testo: 'due', selezione: true });
    el.applicaAzione({ tipo: 'togliLink' });
    expect(spanLink(el)).toBeNull();
    expect(testoDi(el.stato.doc)).toBe('uno due tre');
  });
});

// ---------------------------------------------------------------- il dialogo da solo
async function dialogo(props: Record<string, unknown> = {}): Promise<any> {
  const d: any = document.createElement('docs-link');
  Object.assign(d, props);
  document.body.appendChild(d);
  await d.updateComplete;
  return d;
}
const campo = (d: any, nome: 't' | 'u'): HTMLInputElement | null => d.shadowRoot.querySelector(`input.${nome}`);
function scrivi(c: HTMLInputElement, testo: string): void { c.value = testo; c.dispatchEvent(new Event('input', { bubbles: true })); }
function tasto(c: HTMLElement, key: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  c.dispatchEvent(e);
  return e;
}
function ascolta(d: any, ...nomi: string[]): Array<[string, any]> {
  const v: Array<[string, any]> = [];
  for (const n of nomi) d.addEventListener(n, (e: any) => v.push([n, e.detail]));
  return v;
}

describe('T092: il dialogo del link', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mostra le caselle con i valori iniziali; la casella del testo e "Rimuovi link" compaiono solo quando servono', async () => {
    const d = await dialogo({ testoIniziale: 'sito', urlIniziale: URL1, conTesto: true, esiste: true });
    expect(campo(d, 't')!.value).toBe('sito');
    expect(campo(d, 'u')!.value).toBe(URL1);
    expect(d.shadowRoot.querySelector('button.rimuovi')).not.toBeNull();
    const solo = await dialogo({ urlIniziale: '', conTesto: false, esiste: false });
    expect(campo(solo, 't')).toBeNull();
    expect(campo(solo, 'u')!.value).toBe('');
    expect(solo.shadowRoot.querySelector('button.rimuovi')).toBeNull();
  });

  it('Applica avvisa con l\'indirizzo completato e il testo; Invio nella casella fa lo stesso', async () => {
    const d = await dialogo({ testoIniziale: '', urlIniziale: '', conTesto: true });
    const v = ascolta(d, 'applica');
    scrivi(campo(d, 't')!, 'il mio sito');
    scrivi(campo(d, 'u')!, 'www.esempio.it');
    d.shadowRoot.querySelector('button.applica').click();
    expect(v).toEqual([['applica', { url: 'https://www.esempio.it', testo: 'il mio sito' }]]);
    expect(tasto(campo(d, 'u')!, 'Enter').defaultPrevented).toBe(true);
    expect(v.length).toBe(2);
    const senzaTesto = await dialogo({ conTesto: false });
    const w = ascolta(senzaTesto, 'applica');
    scrivi(campo(senzaTesto, 'u')!, 'me@esempio.it');
    tasto(campo(senzaTesto, 'u')!, 'Enter');
    expect(w).toEqual([['applica', { url: 'mailto:me@esempio.it' }]]);
  });

  it('un indirizzo non valido mostra l\'errore e non avvisa; l\'errore sparisce scrivendo', async () => {
    const d = await dialogo({ conTesto: false });
    const v = ascolta(d, 'applica');
    for (const sbagliato of ['', 'javascript:alert(1)', 'una frase']) {
      scrivi(campo(d, 'u')!, sbagliato);
      d.shadowRoot.querySelector('button.applica').click();
      await d.updateComplete;
      expect(d.shadowRoot.querySelector('.errore').textContent, sbagliato).toContain('non valido');
    }
    expect(v).toEqual([]);
    scrivi(campo(d, 'u')!, 'https://a.it');
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('.errore').textContent.trim()).toBe('');
  });

  it('Esc e Annulla chiudono, Rimuovi link avvisa', async () => {
    const d = await dialogo({ urlIniziale: URL1, esiste: true, conTesto: false });
    const v = ascolta(d, 'chiudi', 'rimuovi');
    expect(tasto(campo(d, 'u')!, 'Escape').defaultPrevented).toBe(true);
    d.shadowRoot.querySelector('button.annulla').click();
    d.shadowRoot.querySelector('button.rimuovi').click();
    expect(v.map((x) => x[0])).toEqual(['chiudi', 'chiudi', 'rimuovi']);
  });

  it('focalizza mette il cursore nell\'indirizzo, o nel testo se serve e manca', async () => {
    const a = await dialogo({ testoIniziale: 'x', conTesto: true });
    a.focalizza();
    expect(a.shadowRoot.activeElement).toBe(campo(a, 'u'));
    const b = await dialogo({ testoIniziale: '', conTesto: true });
    b.focalizza();
    expect(b.shadowRoot.activeElement).toBe(campo(b, 't'));
  });
});

// ---------------------------------------------------------------- tutto insieme nel guscio
async function guscio(doc: Documento, s: Selezione): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ doc, sel: s, pendenti: null });
  return { g, ed };
}
function tastoGuscio(ed: any, key: string, extra: Record<string, unknown> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...extra });
  ed.shadowRoot.querySelector('textarea').dispatchEvent(e);
  return e;
}
const dialogoDi = (g: any): any => g.shadowRoot.querySelector('docs-link');
async function aggiornaTutto(g: any): Promise<void> { await attendi(); await g.updateComplete; const d = dialogoDi(g); if (d) await d.updateComplete; }

describe('T092: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('Ctrl+K con del testo selezionato apre il dialogo senza la casella del testo; Applica fa diventare link la selezione', async () => {
    const { g, ed } = await guscio(daTesto('uno due tre'), sel(0, 4, 7));
    expect(dialogoDi(g)).toBeNull();
    const e = tastoGuscio(ed, 'k', { ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
    await aggiornaTutto(g);
    const d = dialogoDi(g);
    expect(d).not.toBeNull();
    expect(campo(d, 't')).toBeNull();
    scrivi(campo(d, 'u')!, 'esempio.it');
    d.shadowRoot.querySelector('button.applica').click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).toBeNull();
    expect(runs(ed.stato.doc)).toEqual([['uno ', undefined], ['due', 'https://esempio.it'], [' tre', undefined]]);
  });

  it('Ctrl+K col cursore fuori da un link chiede testo e indirizzo e scrive il link', async () => {
    const { g, ed } = await guscio(daTesto('ab cd'), cursore(0, 3));
    tastoGuscio(ed, 'k', { ctrlKey: true });
    await aggiornaTutto(g);
    const d = dialogoDi(g);
    expect(campo(d, 't')!.value).toBe('');
    expect(d.shadowRoot.querySelector('button.rimuovi')).toBeNull();
    scrivi(campo(d, 't')!, 'sito');
    scrivi(campo(d, 'u')!, URL1);
    tasto(campo(d, 'u')!, 'Enter');
    await aggiornaTutto(g);
    expect(runs(ed.stato.doc)).toEqual([['ab ', undefined], ['sito', URL1], ['cd', undefined]]);
  });

  it('Ctrl+K col cursore su un link mostra testo e indirizzo; Rimuovi link toglie il link e lascia il testo', async () => {
    const { g, ed } = await guscio(docLink(), cursore(0, 5));
    tastoGuscio(ed, 'k', { ctrlKey: true });
    await aggiornaTutto(g);
    const d = dialogoDi(g);
    expect(campo(d, 't')!.value).toBe('due');
    expect(campo(d, 'u')!.value).toBe(URL1);
    d.shadowRoot.querySelector('button.rimuovi').click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).toBeNull();
    expect(runs(ed.stato.doc)).toEqual([['uno due tre', undefined]]);
  });

  it('Esc chiude il dialogo senza cambiare il documento; un indirizzo sbagliato lo lascia aperto', async () => {
    const { g, ed } = await guscio(daTesto('uno due tre'), sel(0, 4, 7));
    tastoGuscio(ed, 'k', { ctrlKey: true });
    await aggiornaTutto(g);
    const d = dialogoDi(g);
    scrivi(campo(d, 'u')!, 'javascript:alert(1)');
    d.shadowRoot.querySelector('button.applica').click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).not.toBeNull();
    expect(runs(ed.stato.doc)).toEqual([['uno due tre', undefined]]);
    tastoGuscio(ed, 'Escape');
    await aggiornaTutto(g);
    expect(dialogoDi(g)).toBeNull();
    expect(runs(ed.stato.doc)).toEqual([['uno due tre', undefined]]);
  });

  it('il pulsante Link della barra e Inserisci > Link aprono lo stesso dialogo', async () => {
    const { g } = await guscio(daTesto('uno due'), cursore(0, 0));
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    (tb.shadowRoot.querySelector('button.comando[data-id="link"]') as HTMLButtonElement).click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).not.toBeNull();
    dialogoDi(g).shadowRoot.querySelector('button.annulla').click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).toBeNull();
    const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
    await barraMenu.updateComplete;
    (barraMenu.shadowRoot.querySelector('button.titolo-menu[data-menu="inserisci"]') as HTMLButtonElement).click();
    await barraMenu.updateComplete;
    const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Link')!;
    voce.click();
    await aggiornaTutto(g);
    expect(dialogoDi(g)).not.toBeNull();
  });

  it('Ctrl+clic su un link nel documento apre l\'indirizzo', async () => {
    const apri = vi.spyOn(window, 'open').mockReturnValue(null);
    const { g, ed } = await guscio(docLink(), cursore(0, 0));
    mouseGiu(spanLink(ed), { ctrlKey: true });
    await aggiornaTutto(g);
    expect(apri).toHaveBeenCalledWith(URL1, '_blank', 'noopener,noreferrer');
    expect(apri).toHaveBeenCalledTimes(1);
  });
});
