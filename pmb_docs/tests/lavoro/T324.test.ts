import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { MENU } from '../../src/guscio/menu-dati';
import {
  azioneDaTastoFormato, azioneDaComandoFormato, eseguiAzioneFormato, type AzioneFormato, type EventoTastoFormato,
} from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente, type StatoEditor } from '../../src/editor/azioni';
import { daTesto, cursore, statoIniziale, type Stato } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
function t(key: string, extra: Partial<EventoTastoFormato> = {}): EventoTastoFormato {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra };
}
function da(testo: string): StatoEditor {
  const st: Stato = { doc: daTesto(testo), sel: cursore(0, 0), pendenti: null };
  return nuovoEditor(st);
}
function esegui(ed: StatoEditor, ...azioni: AzioneFormato[]): StatoEditor {
  let e = ed;
  for (const a of azioni) e = eseguiAzioneFormato(e, a).ed;
  return e;
}
const seleziona = (ed: StatoEditor, o1: number, o2: number): StatoEditor =>
  esegui(ed, { tipo: 'vai', pos: { p: 0, o: o1 }, estendi: false }, { tipo: 'vai', pos: { p: 0, o: o2 }, estendi: true });
const tratti = (ed: StatoEditor) => statoCorrente(ed).doc.paragrafi[0].runs.map((r) => [r.t, r.x, r.v]);

describe('T324: i comandi e le scorciatoie', () => {
  it('i tre comandi diventano l\'azione alterna con il loro attributo', () => {
    expect(azioneDaComandoFormato('barrato')).toEqual({ tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(azioneDaComandoFormato('apice')).toEqual({ tipo: 'alterna', chiave: 'v', valore: 'p' });
    expect(azioneDaComandoFormato('pedice')).toEqual({ tipo: 'alterna', chiave: 'v', valore: 'd' });
  });

  it('Alt+Maiusc+5 barra, Ctrl+. fa l\'apice, Ctrl+, fa il pedice', () => {
    expect(azioneDaTastoFormato(t('5', { altKey: true, shiftKey: true, code: 'Digit5' }))).toEqual({ tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(azioneDaTastoFormato(t('%', { altKey: true, shiftKey: true }))).toEqual({ tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(azioneDaTastoFormato(t('.', { ctrlKey: true, code: 'Period' }))).toEqual({ tipo: 'alterna', chiave: 'v', valore: 'p' });
    expect(azioneDaTastoFormato(t(',', { ctrlKey: true, code: 'Comma' }))).toEqual({ tipo: 'alterna', chiave: 'v', valore: 'd' });
    expect(azioneDaTastoFormato(t('.', { metaKey: true }))).toEqual({ tipo: 'alterna', chiave: 'v', valore: 'p' });
  });

  it('con la Maiusc le stesse due scorciatoie cambiano ancora il corpo, come prima', () => {
    expect(azioneDaTastoFormato(t('>', { ctrlKey: true, shiftKey: true, code: 'Period' }))).toEqual({ tipo: 'corpo', direzione: 1 });
    expect(azioneDaTastoFormato(t('<', { ctrlKey: true, shiftKey: true, code: 'Comma' }))).toEqual({ tipo: 'corpo', direzione: -1 });
  });

  it('le altre scorciatoie non cambiano e Alt da solo o Ctrl+Alt non fanno niente di nuovo', () => {
    expect(azioneDaTastoFormato(t('\\', { ctrlKey: true }))).toEqual({ tipo: 'pulisci' });
    expect(azioneDaTastoFormato(t(']', { ctrlKey: true }))).toEqual({ tipo: 'rientro', delta: 1 });
    expect(azioneDaTastoFormato(t('5', { altKey: true }))).not.toEqual({ tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(azioneDaTastoFormato(t('5', { ctrlKey: true, altKey: true, shiftKey: true }))).not.toEqual({ tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(azioneDaTastoFormato(t('.'))).not.toEqual({ tipo: 'alterna', chiave: 'v', valore: 'p' });
  });
});

describe('T324: l\'azione alterna', () => {
  it('barrato: la prima volta lo mette, la seconda lo toglie', () => {
    let ed = seleziona(da('abcdef'), 1, 4);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(tratti(ed)).toEqual([['a', undefined, undefined], ['bcd', 'b', undefined], ['ef', undefined, undefined]]);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(tratti(ed)).toEqual([['abcdef', undefined, undefined]]);
  });

  it('apice poi pedice: il pedice prende il posto dell\'apice, non si sommano', () => {
    let ed = seleziona(da('abcdef'), 0, 6);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'v', valore: 'p' });
    expect(tratti(ed)).toEqual([['abcdef', undefined, 'p']]);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'v', valore: 'd' });
    expect(tratti(ed)).toEqual([['abcdef', undefined, 'd']]);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'v', valore: 'd' });
    expect(tratti(ed)).toEqual([['abcdef', undefined, undefined]]);
  });

  it('su una selezione solo in parte barrata, la prima volta barra tutto', () => {
    let ed = seleziona(da('abcdef'), 0, 3);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    ed = seleziona(ed, 0, 6);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(tratti(ed)).toEqual([['abcdef', 'b', undefined]]);
  });

  it('barrato e apice sono indipendenti', () => {
    let ed = seleziona(da('abc'), 0, 3);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' }, { tipo: 'alterna', chiave: 'v', valore: 'p' });
    expect(tratti(ed)).toEqual([['abc', 'b', 'p']]);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    expect(tratti(ed)).toEqual([['abc', undefined, 'p']]);
  });

  it('con il cursore fermo vale per il testo scritto dopo, e la seconda volta lo spegne', () => {
    let ed = esegui(da('ab'), { tipo: 'vai', pos: { p: 0, o: 2 }, estendi: false });
    ed = esegui(ed, { tipo: 'alterna', chiave: 'v', valore: 'p' }, { tipo: 'testo', testo: 'X' });
    expect(tratti(ed)).toEqual([['ab', undefined, undefined], ['X', undefined, 'p']]);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'v', valore: 'p' }, { tipo: 'testo', testo: 'Y' });
    expect(tratti(ed)).toEqual([['ab', undefined, undefined], ['X', undefined, 'p'], ['Y', undefined, undefined]]);
  });

  it('con il cursore fermo, due volte di seguito senza scrivere: la seconda spegne quello che la prima ha acceso', () => {
    let ed = esegui(da('ab'), { tipo: 'vai', pos: { p: 0, o: 2 }, estendi: false });
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' }, { tipo: 'alterna', chiave: 'x', valore: 'b' }, { tipo: 'testo', testo: 'Z' });
    expect(tratti(ed)).toEqual([['abZ', undefined, undefined]]);
  });

  it('si può annullare e ripetere come le altre formattazioni', () => {
    let ed = seleziona(da('abc'), 0, 3);
    ed = esegui(ed, { tipo: 'alterna', chiave: 'x', valore: 'b' });
    ed = esegui(ed, { tipo: 'annulla' });
    expect(tratti(ed)).toEqual([['abc', undefined, undefined]]);
    ed = esegui(ed, { tipo: 'ripeti' });
    expect(tratti(ed)).toEqual([['abc', 'b', undefined]]);
  });
});

describe('T324: Formato › Testo', () => {
  it('le sei voci e le scorciatoie nei dati', () => {
    const testo = MENU.find((m) => m.id === 'formato')!.voci.find((v) => v.etichetta === 'Testo')!;
    // dal 0.4.15 seguono le sei voci delle maiuscole e minuscole
    expect(testo.figli?.slice(0, 6).map((f) => [f.etichetta, f.scorciatoia])).toEqual([
      ['Grassetto', 'Ctrl+B'], ['Corsivo', 'Ctrl+I'], ['Sottolineato', 'Ctrl+U'], ['Barrato', 'Alt+Maiusc+5'], ['Apice', 'Ctrl+.'], ['Pedice', 'Ctrl+,'],
    ]);
  });

  async function guscio(): Promise<{ g: any; ed: any }> {
    Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    ed.impostaStato({ ...statoIniziale(daTesto('uno due')), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 3 } } });
    await g.updateComplete;
    return { g, ed };
  }
  async function scegliTesto(g: any, figlio: string): Promise<void> {
    const barra: any = g.shadowRoot.querySelector('docs-menubar');
    await barra.updateComplete;
    (barra.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
    await barra.updateComplete;
    (Array.from(barra.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Testo')!.click();
    await barra.updateComplete;
    (Array.from(barra.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === figlio)!.click();
    await attendi();
    await g.updateComplete;
  }
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Barrato, Apice e Pedice dal menu agiscono sulla parola selezionata', async () => {
    const { g, ed } = await guscio();
    await scegliTesto(g, 'Barrato');
    expect(ed.stato.doc.paragrafi[0].runs.map((r: any) => [r.t, r.x, r.v])).toEqual([['uno', 'b', undefined], [' due', undefined, undefined]]);
    await scegliTesto(g, 'Apice');
    expect(ed.stato.doc.paragrafi[0].runs.map((r: any) => [r.t, r.x, r.v])).toEqual([['uno', 'b', 'p'], [' due', undefined, undefined]]);
    await scegliTesto(g, 'Pedice');
    expect(ed.stato.doc.paragrafi[0].runs[0].v).toBe('d');
  });

  it('scegliere Barrato due volte lo toglie; Grassetto continua a funzionare', async () => {
    const { g, ed } = await guscio();
    await scegliTesto(g, 'Barrato');
    await scegliTesto(g, 'Barrato');
    expect(ed.stato.doc.paragrafi[0].runs.every((r: any) => r.x === undefined)).toBe(true);
    await scegliTesto(g, 'Grassetto');
    expect(ed.stato.doc.paragrafi[0].runs[0].g).toBe(true);
  });
});
