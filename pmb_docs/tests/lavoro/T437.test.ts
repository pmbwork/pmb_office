// T437: elenco di attività (caselle da spuntare) e Copia formato.
import { describe, it, expect, beforeEach } from 'vitest';
import { disegna } from '../../src/editor/render';
import { eseguiAzioneFormato, azioneDaComandoFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente } from '../../src/editor/azioni';
import { esportaDocx, importaDocx } from '../../src/formati/docx';
import {
  alternaElenco, alternaFatto, daTesto, deserializza, formatoDaCopiare, incollaFormato, numeriElenco, serializza,
  type Documento, type Selezione, type Stato,
} from '../../src/modello/documento';

const sel = (p0: number, o0: number, p1 = p0, o1 = o0): Selezione => ({ ancora: { p: p0, o: o0 }, fuoco: { p: p1, o: o1 } });
const stato = (doc: Documento, s: Selezione): Stato => ({ doc, sel: s, pendenti: null });

describe('T437: elenco di attività', () => {
  it('il pulsante della barra mette l\'elenco di attività e un secondo clic lo toglie', () => {
    expect(azioneDaComandoFormato('elenco-attivita')).toEqual({ tipo: 'elenco', elenco: 't' });
    const doc = daTesto('uno\ndue');
    const a = alternaElenco(doc, sel(0, 0, 1, 0), 't');
    expect(a.paragrafi.map((p) => p.el)).toEqual(['t', 't']);
    const b = alternaElenco(a, sel(0, 0, 1, 0), 't');
    expect(b.paragrafi.map((p) => p.el)).toEqual([undefined, undefined]);
  });
  it('spuntare e togliere la spunta; solo sulle voci di attività', () => {
    let doc = alternaElenco(daTesto('uno\ndue'), sel(0, 0), 't');
    doc = alternaFatto(doc, 0);
    expect(doc.paragrafi[0].fa).toBe(true);
    expect(alternaFatto(doc, 1)).toBe(doc); // il paragrafo 1 non è una voce di attività
    doc = alternaFatto(doc, 0);
    expect(doc.paragrafi[0].fa).toBeUndefined();
  });
  it('cambiare o togliere l\'elenco perde la spunta', () => {
    let doc = alternaFatto(alternaElenco(daTesto('uno'), sel(0, 0), 't'), 0);
    expect(alternaElenco(doc, sel(0, 0), 'p').paragrafi[0].fa).toBeUndefined();
    doc = alternaElenco(doc, sel(0, 0), 't'); // tutti sono già 't': lo toglie
    expect(doc.paragrafi[0].el).toBeUndefined();
    expect(doc.paragrafi[0].fa).toBeUndefined();
  });
  it('un elenco di attività interrompe la numerazione di un elenco numerato', () => {
    let doc = alternaElenco(daTesto('a\nb\nc'), sel(0, 0, 2, 0), 'n');
    doc = alternaElenco(doc, sel(1, 0), 't');
    expect(numeriElenco(doc)).toEqual([1, null, 1]);
  });
  it('si disegna con la casella ☐ o ☑ e la classe fatto', () => {
    const box = document.createElement('div');
    const doc = alternaFatto(alternaElenco(daTesto('uno\ndue'), sel(0, 0, 1, 0), 't'), 0);
    disegna(box, doc);
    const [p0, p1] = Array.from(box.children);
    expect(p0.getAttribute('data-m')).toBe('☑');
    expect(p0.classList.contains('fatto')).toBe(true);
    expect(p1.getAttribute('data-m')).toBe('☐');
    expect(p1.classList.contains('fatto')).toBe(false);
    expect(p1.classList.contains('att')).toBe(true);
  });
  it('spuntare dopo averlo disegnato aggiorna la casella anche con il disegno incrementale', () => {
    const box = document.createElement('div');
    const doc = alternaElenco(daTesto('uno'), sel(0, 0), 't');
    disegna(box, doc);
    disegna(box, alternaFatto(doc, 0));
    expect(box.children[0].getAttribute('data-m')).toBe('☑');
    expect(box.children[0].classList.contains('fatto')).toBe(true);
    disegna(box, doc);
    expect(box.children[0].getAttribute('data-m')).toBe('☐');
    expect(box.children[0].classList.contains('fatto')).toBe(false);
  });
  it('a capo su una voce spuntata: la voce nuova non è spuntata, la vecchia sì', () => {
    let doc = alternaFatto(alternaElenco(daTesto('uno'), sel(0, 0), 't'), 0);
    let ed = nuovoEditor(stato(doc, sel(0, 3)));
    ed = eseguiAzioneFormato(ed, { tipo: 'invio' }).ed;
    doc = statoCorrente(ed).doc;
    expect(doc.paragrafi.length).toBe(2);
    expect(doc.paragrafi.map((p) => [p.el, p.fa])).toEqual([['t', true], ['t', undefined]]);
  });
  it('a capo su una voce vuota esce dall\'elenco', () => {
    const doc = alternaElenco(daTesto(''), sel(0, 0), 't');
    let ed = nuovoEditor(stato(doc, sel(0, 0)));
    ed = eseguiAzioneFormato(ed, { tipo: 'invio' }).ed;
    expect(statoCorrente(ed).doc.paragrafi[0].el).toBeUndefined();
  });
  it('si salva e si rilegge in .fdoc', () => {
    const doc = alternaFatto(alternaElenco(daTesto('uno\ndue'), sel(0, 0, 1, 0), 't'), 1);
    const letto = deserializza(serializza(doc));
    expect(letto.paragrafi.map((p) => [p.el, p.fa])).toEqual([['t', undefined], ['t', true]]);
  });
  it('un fdoc con una spunta su un paragrafo che non è una voce di attività la scarta', () => {
    const doc = deserializza('{"v":1,"p":[{"a":{"fa":true},"r":[{"t":"x","g":false,"c":false,"s":false}]}]}');
    expect(doc.paragrafi[0].fa).toBeUndefined();
  });
  it('si salva e si rilegge in .docx con le caselle e le spunte', async () => {
    let doc = alternaElenco(daTesto('uno\ndue\ntre'), sel(0, 0, 2, 0), 't');
    doc = alternaFatto(doc, 1);
    const letto = await importaDocx(await esportaDocx(doc));
    expect(letto.paragrafi.map((p) => [p.el, p.fa])).toEqual([['t', undefined], ['t', true], ['t', undefined]]);
  });
  it('un docx senza elenchi di attività non contiene le definizioni delle caselle', async () => {
    const byte = await esportaDocx(alternaElenco(daTesto('uno'), sel(0, 0), 'p'));
    const testo = new TextDecoder('latin1').decode(byte);
    expect(testo.includes('☐')).toBe(false);
    const letto = await importaDocx(byte);
    expect(letto.paragrafi[0].el).toBe('p');
  });
  it('un elenco puntato normale resta puntato dopo il giro in .docx', async () => {
    const letto = await importaDocx(await esportaDocx(alternaElenco(daTesto('a\nb'), sel(0, 0, 1, 0), 'p')));
    expect(letto.paragrafi.map((p) => p.el)).toEqual(['p', 'p']);
  });
});

describe('T437: Copia formato', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const grassettoRosso = (): Documento => {
    // "AAA" in grassetto, rosso, corpo 18, centrato; "bbb" normale
    const d = daTesto('AAA\nbbb');
    d.paragrafi[0] = { al: 'ce', ls: 2, st: '1', runs: [{ t: 'AAA', g: true, c: false, s: true, k: '#ff0000', z: 18, f: 'Roboto' }] };
    return d;
  };
  it('copia il formato del punto e lo applica a una selezione: segni, colore, corpo, carattere e paragrafo', () => {
    const d = grassettoRosso();
    const copia = formatoDaCopiare(stato(d, sel(0, 2)));
    expect(copia.testo.g).toBe(true);
    expect(copia.testo.k).toBe('#ff0000');
    expect(copia.paragrafo).toEqual({ al: 'ce', ls: 2, st: '1' });
    const dopo = incollaFormato(stato(d, sel(1, 0, 1, 3)), copia);
    const r = dopo.doc.paragrafi[1];
    expect(r.runs).toEqual([{ t: 'bbb', g: true, c: false, s: true, k: '#ff0000', z: 18, f: 'Roboto' }]);
    expect([r.al, r.ls, r.st]).toEqual(['ce', 2, '1']);
  });
  it('toglie ciò che il formato copiato non ha (si copia da un testo semplice su uno decorato)', () => {
    const d = grassettoRosso();
    const copia = formatoDaCopiare(stato(d, sel(1, 2))); // "bbb" normale
    const dopo = incollaFormato(stato(d, sel(0, 0, 0, 3)), copia);
    expect(dopo.doc.paragrafi[0].runs).toEqual([{ t: 'AAA', g: false, c: false, s: false }]);
    expect([dopo.doc.paragrafi[0].al, dopo.doc.paragrafi[0].ls, dopo.doc.paragrafi[0].st]).toEqual([undefined, undefined, undefined]);
  });
  it('con la selezione vuota non cambia niente', () => {
    const d = grassettoRosso();
    const s = stato(d, sel(1, 1));
    expect(incollaFormato(s, formatoDaCopiare(stato(d, sel(0, 1))))).toBe(s);
  });
  it('non copia il link', () => {
    const d = daTesto('xx');
    d.paragrafi[0] = { runs: [{ t: 'xx', g: true, c: false, s: false, u: 'https://esempio.it' }] };
    expect(formatoDaCopiare(stato(d, sel(0, 1))).testo.u).toBeUndefined();
  });
  it('applica solo alla parte selezionata e lascia il resto', () => {
    const d = grassettoRosso();
    const copia = formatoDaCopiare(stato(d, sel(0, 1)));
    const dopo = incollaFormato(stato(d, sel(1, 1, 1, 2)), copia);
    expect(dopo.doc.paragrafi[1].runs.map((r) => [r.t, r.g])).toEqual([['b', false], ['b', true], ['b', false]]);
  });
});

describe('T437: Copia formato nel guscio', () => {
  const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
  async function guscio(): Promise<any> {
    await import('../../src/guscio/docs-guscio');
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
    document.body.innerHTML = '';
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    const d = daTesto('AAA\nbbb');
    d.paragrafi[0] = { runs: [{ t: 'AAA', g: true, c: false, s: false, k: '#ff0000' }] };
    ed.impostaStato({ doc: d, sel: sel(0, 0, 0, 3), pendenti: null });
    await g.updateComplete;
    return g;
  }
  const premi = (el: EventTarget): void => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true })); };

  it('il pulsante copia il formato, si accende e avvisa; il secondo clic annulla', async () => {
    const g = await guscio();
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    await g.updateComplete;
    expect(g.copiaFormatoAttiva).toBe(true);
    expect(g.avviso).toMatch(/Formato copiato/);
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    await g.updateComplete;
    expect(g.copiaFormatoAttiva).toBe(false);
  });
  it('il clic che preme il pulsante non applica subito il formato alla stessa selezione', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    premi(g.shadowRoot.querySelector('docs-toolbar'));
    expect(g.copiaFormatoAttiva).toBe(true);
    expect(ed.formatoInAttesa).toBe(true);
  });
  it('selezionando poi del testo nell\'editor il formato si applica una volta sola e il pulsante si spegne', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    ed.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    ed.applicaAzione({ tipo: 'vai', pos: { p: 1, o: 0 }, estendi: false });
    ed.applicaAzione({ tipo: 'vai', pos: { p: 1, o: 3 }, estendi: true });
    ed.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await g.updateComplete;
    expect(g.copiaFormatoAttiva).toBe(false);
    expect(ed.formatoInAttesa).toBe(false);
    expect(ed.stato.doc.paragrafi[1].runs).toEqual([{ t: 'bbb', g: true, c: false, s: false, k: '#ff0000' }]);
    // si può annullare in un solo passo
    ed.annulla();
    expect(ed.stato.doc.paragrafi[1].runs).toEqual([{ t: 'bbb', g: false, c: false, s: false }]);
    await attendi(1);
  });
  it('un clic senza selezione nell\'editor lascia il formato in attesa', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    ed.applicaAzione({ tipo: 'vai', pos: { p: 1, o: 1 }, estendi: false });
    premi(ed);
    expect(g.copiaFormatoAttiva).toBe(true);
  });
  it('Esc annulla Copia formato', async () => {
    const g = await guscio();
    g.suComando(new CustomEvent('comando', { detail: { id: 'copia-formato' } }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await g.updateComplete;
    expect(g.copiaFormatoAttiva).toBe(false);
    expect(g.shadowRoot.querySelector('docs-editor').formatoInAttesa).toBe(false);
  });
  it('spuntaVoce dell\'editor spunta in un solo passo di annulla', async () => {
    const g = await guscio();
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    ed.applicaAzione({ tipo: 'elenco', elenco: 't' });
    ed.spuntaVoce(0);
    expect(ed.stato.doc.paragrafi[0].fa).toBe(true);
    ed.annulla();
    expect(ed.stato.doc.paragrafi[0].fa).toBeUndefined();
    expect(ed.stato.doc.paragrafi[0].el).toBe('t');
  });
});
