import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/editor/docs-editor';
import { disegna, domDaPosizione, paragrafiDom, posizioneDaDom } from '../../src/editor/render';
import { ACCETTA_IMMAGINI, DIMENSIONE_MASSIMA_FILE, leggiImmagine, tipoDaByte } from '../../src/formati/immagine';
import { LARGHEZZE_IMMAGINE, popupImmagine } from '../../src/guscio/immagine-dati';
import { OGGETTO, cursore, daTesto, inserisciImmagine, statoIniziale, testoParagrafo, type Documento, type Immagine, type Selezione, type Stato } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const PNG64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = `data:image/png;base64,${PNG64}`;
const pngBytes = (): Uint8Array => Uint8Array.from(atob(PNG64), (c) => c.charCodeAt(0));
const img = (w = 200, h = 100): Immagine => ({ s: PNG, w, h });
const sel = (p: number, da: number, p2: number, a: number): Selezione => ({ ancora: { p, o: da }, fuoco: { p: p2, o: a } });
/** "ab" + immagine + "cd", cursore dopo l'immagine */
const conImmagine = (w = 200, h = 100): Stato => inserisciImmagine({ ...statoIniziale(daTesto('abcd')), sel: cursore(0, 2) }, img(w, h));
const docConImmagine = (): Documento => conImmagine().doc;

describe('T122: leggere un file immagine', () => {
  const misura = async () => ({ w: 800, h: 400 });
  const blob = (bytes: Uint8Array, tipo = 'image/png'): Blob => new Blob([bytes as BlobPart], { type: tipo });

  it('riconosce il tipo dai byte: png, jpeg, gif e webp; il resto no', () => {
    expect(tipoDaByte(pngBytes())).toBe('png');
    expect(tipoDaByte(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(tipoDaByte(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif');
    expect(tipoDaByte(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('webp');
    expect(tipoDaByte(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
    expect(tipoDaByte(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(tipoDaByte(new Uint8Array(0))).toBeNull();
    expect(ACCETTA_IMMAGINI).toContain('.png');
    expect(ACCETTA_IMMAGINI).not.toContain('svg');
  });

  it('un file ammesso diventa un\'immagine con l\'indirizzo incorporato e le misure ridotte per stare nel foglio', async () => {
    const r = await leggiImmagine(blob(pngBytes()), misura);
    expect(r).toEqual({ s: PNG, w: 602, h: 301 });
    expect(await leggiImmagine(blob(pngBytes()), async () => ({ w: 100, h: 50 }))).toEqual({ s: PNG, w: 100, h: 50 });
  });

  it('il tipo dichiarato dal file non conta: un svg che si spaccia per png, o un png dichiarato come altro, si giudicano dai byte', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await leggiImmagine(blob(svg, 'image/png'), misura)).toBeNull();
    const r = await leggiImmagine(blob(pngBytes(), 'application/octet-stream'), misura);
    expect(r?.s).toBe(PNG);
  });

  it('l indirizzo porta il tipo vero del file: jpeg, gif e webp non diventano png', async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b]);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
    for (const [bytes, tipo] of [[jpeg, 'jpeg'], [gif, 'gif'], [webp, 'webp']] as const) {
      const r = await leggiImmagine(blob(bytes, 'image/png'), misura);
      expect(r?.s.startsWith(`data:image/${tipo};base64,`), tipo).toBe(true);
    }
  });

  it('vuoto, troppo grande, illeggibile o senza misure: nessuna immagine', async () => {
    expect(await leggiImmagine(blob(new Uint8Array(0)), misura)).toBeNull();
    const enorme = new Uint8Array(DIMENSIONE_MASSIMA_FILE + 1);
    enorme.set([0x89, 0x50, 0x4e, 0x47]);
    expect(await leggiImmagine(blob(enorme), misura)).toBeNull();
    expect(await leggiImmagine(blob(pngBytes()), async () => null)).toBeNull();
    expect(await leggiImmagine(blob(pngBytes()), async () => ({ w: 0, h: 10 }))).toBeNull();
    expect(await leggiImmagine(blob(pngBytes()), async () => ({ w: 10, h: 0 }))).toBeNull();
    expect(await leggiImmagine(blob(pngBytes()), async () => ({ w: NaN, h: 10 }))).toBeNull();
    const limite = new Uint8Array(DIMENSIONE_MASSIMA_FILE);
    limite.set([0x89, 0x50, 0x4e, 0x47]);
    expect(await leggiImmagine(blob(limite), misura)).not.toBeNull();
  });
});

describe('T122: il menu dell\'immagine', () => {
  // dal 0.4.14 tra le larghezze e «Elimina immagine» ci sono rotazioni, ritaglio e testo intorno (vedi T558)
  it('tre larghezze e "Elimina immagine", nessuna spuntata', () => {
    const p = popupImmagine();
    expect([...p.voci.slice(0, 3), p.voci[p.voci.length - 1]].map((v) => v.etichetta)).toEqual(['Piccola (150 px)', 'Media (300 px)', 'Larghezza del testo', 'Elimina immagine']);
    expect(LARGHEZZE_IMMAGINE.map((x) => x[1])).toEqual([150, 300, 602]);
    expect(p.voci.slice(0, 3).map((v) => v.azione)).toEqual([150, 300, 602].map((larghezza) => ({ tipo: 'larghezzaImmagine', larghezza })));
    expect(p.voci[p.voci.length - 1].azione).toEqual({ tipo: 'cancella', direzione: 'indietro', parola: false });
    expect(p.voci.every((v) => !v.attiva)).toBe(true);
  });
});

describe('T122: il disegno delle immagini', () => {
  it('un\'immagine è uno span con dentro l\'img (misure negli attributi) e il carattere dell\'immagine; niente stili in linea', () => {
    const zona = document.createElement('div');
    disegna(zona, docConImmagine());
    const span = zona.querySelector('span.immagine') as HTMLElement;
    const i = span.querySelector('img') as HTMLImageElement;
    expect(i.getAttribute('src')).toBe(PNG);
    expect([i.getAttribute('width'), i.getAttribute('height'), i.getAttribute('alt'), i.getAttribute('draggable')]).toEqual(['200', '100', '', 'false']);
    expect(span.lastChild?.nodeType).toBe(3);
    expect(span.lastChild?.nodeValue).toBe(OGGETTO);
    expect(zona.querySelectorAll('[style]').length).toBe(0);
    expect(Array.from(zona.querySelector('p')!.childNodes).map((n) => (n as Element).className ?? '')).toEqual(['', 'immagine', '']);
    expect(zona.querySelector('p')!.textContent).toBe(`ab${OGGETTO}cd`);
  });

  it('un\'immagine con collegamento ha anche la classe link e l\'indirizzo', () => {
    const doc = docConImmagine();
    doc.paragrafi[0].runs[1].u = 'https://esempio.it';
    const zona = document.createElement('div');
    disegna(zona, doc);
    const span = zona.querySelector('span.immagine') as HTMLElement;
    expect(span.className).toBe('immagine link');
    expect(span.getAttribute('data-u')).toBe('https://esempio.it');
    expect(span.title).toContain('Ctrl+clic');
  });

  it('dal DOM alla posizione e ritorno funzionano con l\'immagine in mezzo al testo', () => {
    const zona = document.createElement('div');
    document.body.appendChild(zona);
    disegna(zona, docConImmagine());
    const nodoImmagine = zona.querySelector('span.immagine')!.lastChild!;
    expect(posizioneDaDom(zona, nodoImmagine, 0)).toEqual({ p: 0, o: 2 });
    expect(posizioneDaDom(zona, nodoImmagine, 1)).toEqual({ p: 0, o: 3 });
    expect(posizioneDaDom(zona, zona.querySelector('img')!, 0)).toEqual({ p: 0, o: 2 });
    const spans = zona.querySelectorAll('p > span');
    expect(posizioneDaDom(zona, spans[2].firstChild!, 1)).toEqual({ p: 0, o: 4 });
    expect(domDaPosizione(zona, { p: 0, o: 3 })).toEqual({ nodo: nodoImmagine, offset: 1 });
    expect(domDaPosizione(zona, { p: 0, o: 5 })?.nodo).toBe(spans[2].firstChild);
    expect(paragrafiDom(zona).length).toBe(1);
    zona.remove();
  });
});

async function editor(stato: Stato): Promise<any> {
  const el: any = document.createElement('docs-editor');
  document.body.appendChild(el);
  await el.updateComplete;
  el.impostaStato(stato);
  return el;
}
function mouseGiu(bersaglio: Element, extra: Record<string, unknown> = {}): MouseEvent {
  const e = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true, button: 0, ...extra });
  bersaglio.dispatchEvent(e);
  return e;
}
const immagineDi = (el: any): HTMLElement => el.shadowRoot.querySelector('.testo span.immagine img');
function incolla(el: any, testo: string, file?: File): void {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => testo, files: file ? [file] : [] } });
  el.shadowRoot.querySelector('textarea').dispatchEvent(ev);
}

describe('T122: l\'editor e le immagini', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('un clic sull\'immagine la seleziona tutta, e immagineSelezionata lo dice; un clic altrove no', async () => {
    const el = await editor({ ...conImmagine(), sel: cursore(0, 0) });
    expect(el.immagineSelezionata()).toBe(false);
    mouseGiu(immagineDi(el));
    expect(el.stato.sel).toEqual(sel(0, 2, 0, 3));
    expect(el.immagineSelezionata()).toBe(true);
    el.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 1 }, estendi: false });
    expect(el.immagineSelezionata()).toBe(false);
  });

  it('con l\'immagine selezionata Canc la toglie; cambiare la larghezza ridisegna con le misure nuove', async () => {
    const el = await editor({ ...conImmagine(), sel: sel(0, 2, 0, 3) });
    el.applicaAzione({ tipo: 'larghezzaImmagine', larghezza: 100 });
    expect([immagineDi(el).getAttribute('width'), immagineDi(el).getAttribute('height')]).toEqual(['100', '50']);
    expect(el.immagineSelezionata()).toBe(true);
    el.applicaAzione({ tipo: 'cancella', direzione: 'avanti', parola: false });
    expect(el.shadowRoot.querySelector('span.immagine')).toBeNull();
    expect(testoParagrafo(el.stato.doc.paragrafi[0])).toBe('abcd');
  });

  it('incollare un\'immagine avvisa con il file; incollare testo scrive il testo e non avvisa; il testo prevale', async () => {
    const el = await editor({ ...statoIniziale(daTesto('x')), sel: cursore(0, 1) });
    const visti: Blob[] = [];
    el.addEventListener('immagine-incollata', (e: any) => visti.push(e.detail.file));
    const file = new File([pngBytes() as BlobPart], 'a.png', { type: 'image/png' });
    incolla(el, '', file);
    expect(visti).toEqual([file]);
    incolla(el, 'testo');
    expect(testoParagrafo(el.stato.doc.paragrafi[0])).toBe('xtesto');
    incolla(el, 'altro', file);
    expect(visti.length).toBe(1);
    incolla(el, '', new File(['x'], 'a.txt', { type: 'text/plain' }));
    incolla(el, '');
    expect(visti.length).toBe(1);
  });
});

// ---------------------------------------------------------------- tutto insieme nel guscio
async function guscio(stato: Stato): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato(stato);
  return { g, ed };
}
/** Apre il menu Formato e passa con il mouse sulla voce: restituisce le sotto-voci del sottomenu che si apre (Formato › Tabella, › Immagine). */
async function sottovociFormato(g: any, etichetta: string): Promise<HTMLElement[]> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  if (!barraMenu.shadowRoot.querySelector('.pannello[data-menu="formato"]')) (barraMenu.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = () => (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce().dispatchEvent(new MouseEvent('mouseenter'));
  await barraMenu.updateComplete;
  return Array.from(voce().querySelectorAll('.sottopannello .figlio')) as HTMLElement[];
}
async function vociMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  (barraMenu.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await attendi(40);
  await g.updateComplete;
}
const avvisoDi = (g: any): string | null => g.shadowRoot.querySelector('.avviso')?.textContent?.trim() ?? null;
const FILE = new File([pngBytes() as BlobPart], 'foto.png', { type: 'image/png' });

describe('T122: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Inserisci > Immagine sceglie un file, lo legge e mette l\'immagine al cursore', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    const chiamate: string[] = [];
    g.scegliImmagine = async () => { chiamate.push('scelta'); return FILE; };
    g.caricaImmagine = async (f: Blob) => { chiamate.push(f === FILE ? 'letto' : 'altro'); return img(120, 60); };
    await vociMenu(g, 'inserisci', 'Immagine');
    expect(chiamate).toEqual(['scelta', 'letto']);
    expect(ed.shadowRoot.querySelectorAll('span.immagine img').length).toBe(1);
    expect(ed.stato.doc.paragrafi[0].runs.map((r: any) => (r.im ? [r.im.w, r.im.h] : r.t))).toEqual(['a', [120, 60], 'b']);
    expect(ed.stato.sel.fuoco).toEqual({ p: 0, o: 2 });
  });

  it('il pulsante Immagine della barra fa lo stesso; se si rinuncia alla scelta non cambia niente', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    let lette = 0;
    g.scegliImmagine = async () => null;
    g.caricaImmagine = async () => { lette++; return img(); };
    const tb: any = g.shadowRoot.querySelector('docs-toolbar');
    await tb.updateComplete;
    (tb.shadowRoot.querySelector('button.comando[data-id="immagine"]') as HTMLButtonElement).click();
    await attendi(40);
    expect(lette).toBe(0);
    expect(ed.shadowRoot.querySelector('span.immagine')).toBeNull();
    g.scegliImmagine = async () => FILE;
    (tb.shadowRoot.querySelector('button.comando[data-id="immagine"]') as HTMLButtonElement).click();
    await attendi(40);
    expect(lette).toBe(1);
    expect(ed.shadowRoot.querySelectorAll('span.immagine').length).toBe(1);
  });

  it('un file non ammesso avvisa e non cambia il documento', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 1) });
    g.scegliImmagine = async () => FILE;
    g.caricaImmagine = async () => null;
    await vociMenu(g, 'inserisci', 'Immagine');
    expect(avvisoDi(g)).toContain('Immagine non ammessa');
    expect(ed.shadowRoot.querySelector('span.immagine')).toBeNull();
    expect(ed.stato.doc.paragrafi[0].runs.length).toBe(1);
  });

  it('un\'immagine incollata nell\'editor arriva nel documento', async () => {
    const { g, ed } = await guscio({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 2) });
    let ricevuto: Blob | null = null;
    g.caricaImmagine = async (f: Blob) => { ricevuto = f; return img(80, 40); };
    incolla(ed, '', FILE);
    await attendi(40);
    expect(ricevuto).toBe(FILE);
    expect(ed.shadowRoot.querySelectorAll('span.immagine img').length).toBe(1);
  });

  it('Formato › Immagine è un sottomenu: senza un\'immagine selezionata dice che cosa serve; con l\'immagine selezionata la voce scelta la ridimensiona o la toglie', async () => {
    const { g, ed } = await guscio({ ...conImmagine(), sel: cursore(0, 0) });
    const senza = await sottovociFormato(g, 'Immagine');
    expect(senza.map((f) => (f.textContent ?? '').trim())).toEqual(["Seleziona prima un'immagine"]);
    expect(senza[0].classList.contains('disabilitata')).toBe(true);
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 2 }, estendi: false });
    ed.applicaAzione({ tipo: 'vai', pos: { p: 0, o: 3 }, estendi: true });
    const voci = await sottovociFormato(g, 'Immagine');
    expect(voci.length).toBe(13); // dal 0.4.16 c'è anche «Testo alternativo…»
    voci.find((v) => (v.textContent ?? '').includes('Piccola'))!.click();
    await attendi(40);
    expect(immagineDi(ed).getAttribute('width')).toBe('150');
    expect(immagineDi(ed).getAttribute('height')).toBe('75');
    (await sottovociFormato(g, 'Immagine')).find((v) => (v.textContent ?? '').includes('Elimina'))!.click();
    await attendi(40);
    expect(ed.shadowRoot.querySelector('span.immagine')).toBeNull();
    expect(testoParagrafo(ed.stato.doc.paragrafi[0])).toBe('abcd');
  });
});
