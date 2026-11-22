// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { popupPerComando, statoBarra, NOMI_STILE, TAVOLOZZA } from '../../src/guscio/popup-dati';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente, type StatoEditor } from '../../src/editor/azioni';
import { daTesto, cursore, type Stato } from '../../src/modello/documento';

function da(testo: string, p = 0, o = 0): StatoEditor {
  const st: Stato = { doc: daTesto(testo), sel: cursore(p, o), pendenti: null };
  return nuovoEditor(st);
}
function scegli(ed: StatoEditor, id: string, etichetta: string): StatoEditor {
  const popup = popupPerComando(id, statoBarra(statoCorrente(ed)))!;
  const voce = popup.voci.find((v) => v.etichetta === etichetta);
  if (!voce) throw new Error(`voce ${etichetta} non trovata in ${id}`);
  return eseguiAzioneFormato(ed, voce.azione).ed;
}
const sel = (ed: StatoEditor, p1: number, o1: number, p2: number, o2: number): StatoEditor =>
  eseguiAzioneFormato(eseguiAzioneFormato(ed, { tipo: 'vai', pos: { p: p1, o: o1 }, estendi: false }).ed, { tipo: 'vai', pos: { p: p2, o: o2 }, estendi: true }).ed;

describe('T043: menu a tendina', () => {
  it('quali pulsanti hanno un menu', () => {
    for (const id of ['allineamento', 'interlinea', 'stile-paragrafo', 'carattere', 'corpo', 'colore-testo', 'evidenzia']) expect(popupPerComando(id), id).not.toBeNull();
    for (const id of ['grassetto', 'zoom', 'annulla', 'link', '']) expect(popupPerComando(id), id).toBeNull();
  });

  it('allineamento e interlinea: voci, ordine e voce attiva di partenza', () => {
    const a = popupPerComando('allineamento')!;
    expect(a.tipo).toBe('lista');
    expect(a.voci.map((v) => v.etichetta)).toEqual(['Sinistra', 'Al centro', 'Destra', 'Giustificato']);
    expect(a.voci.map((v) => v.attiva)).toEqual([true, false, false, false]);
    expect(a.voci[1].azione).toEqual({ tipo: 'allinea', valore: 'ce' });
    const i = popupPerComando('interlinea')!;
    expect(i.voci.slice(0, 4).map((v) => v.etichetta)).toEqual(['Singola', '1,15', '1,5', 'Doppia']);
    expect(i.voci.map((v) => v.attiva)).toEqual([false, true, false, false, false, false]);
    expect(i.voci.slice(0, 4).map((v) => (v.azione as { valore: number }).valore)).toEqual([1, 1.15, 1.5, 2]);
    // dopo le interlinee, le due voci dello spazio prima e dopo il paragrafo (T441)
    expect(i.voci.slice(4).map((v) => (v.azione as { chiave: string }).chiave)).toEqual(['sb', 'sa']);
  });

  it('stile, carattere e corpo', () => {
    const s = popupPerComando('stile-paragrafo')!;
    // dal 0.4.14 in fondo c'è la voce per creare e gestire gli stili personali
    expect(s.voci.map((v) => v.etichetta)).toEqual(['Testo normale', 'Titolo', 'Sottotitolo', 'Titolo 1', 'Titolo 2', 'Titolo 3', 'Crea o gestisci stili…']);
    expect(Object.values(NOMI_STILE).length).toBe(6);
    expect(s.voci[0].attiva).toBe(true);
    const c = popupPerComando('carattere')!;
    const nomi = c.voci.filter((v) => !v.intestazione && v.carattere !== undefined).map((v) => v.etichetta);
    // sezioni: Windows (sempre), poi i caratteri inclusi per gruppo; ogni voce porta il proprio carattere per scrivere il nome
    expect(c.voci.filter((v) => v.intestazione).map((v) => v.etichetta)).toEqual(['Windows', 'Sans serif', 'Serif', 'Monospazio', 'Decorativo']);
    expect(nomi.slice(0, 6)).toEqual(['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana']);
    expect(nomi.length).toBeGreaterThan(40);
    expect(nomi).toContain('Roboto');
    expect(nomi).toContain('Open Sans');
    expect(new Set(nomi).size).toBe(nomi.length);
    expect(c.voci.filter((v) => !v.intestazione && v.carattere !== undefined).every((v) => v.carattere === v.etichetta)).toBe(true);
    const arial = c.voci.find((v) => v.etichetta === 'Arial')!;
    expect(arial).toMatchObject({ attiva: true, azione: { tipo: 'attributo', chiave: 'f', valore: undefined } });
    expect(c.voci.find((v) => v.etichetta === 'Georgia')!.azione).toEqual({ tipo: 'attributo', chiave: 'f', valore: 'Georgia' });
    expect(c.voci[c.voci.length - 1]).toMatchObject({ etichetta: 'Caratteri personali…', azione: { tipo: 'apri-caratteri' } });
    const z = popupPerComando('corpo')!;
    expect(z.voci.map((v) => v.etichetta)).toEqual(['8', '9', '10', '11', '12', '14', '18', '24', '30', '36', '48', '60', '72', '96']);
    expect(z.voci.find((v) => v.etichetta === '11')).toMatchObject({ attiva: true, azione: { valore: undefined } });
    expect(z.voci.find((v) => v.etichetta === '18')!.azione).toEqual({ tipo: 'attributo', chiave: 'z', valore: 18 });
  });

  it('tavolozze: Automatico e Nessuno, venti colori diversi e validi', () => {
    expect(TAVOLOZZA.length).toBe(20);
    expect(new Set(TAVOLOZZA).size).toBe(20);
    for (const c of TAVOLOZZA) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    const k = popupPerComando('colore-testo')!;
    expect(k.tipo).toBe('tavolozza');
    expect(k.voci.length).toBe(21);
    expect(k.voci[0]).toMatchObject({ etichetta: 'Automatico', attiva: true, azione: { tipo: 'attributo', chiave: 'k', valore: undefined } });
    expect(k.voci[12]).toMatchObject({ colore: '#ff0000', azione: { tipo: 'attributo', chiave: 'k', valore: '#ff0000' } });
    const h = popupPerComando('evidenzia')!;
    expect(h.voci[0].etichetta).toBe('Nessuno');
    expect(h.voci[14].azione).toEqual({ tipo: 'attributo', chiave: 'h', valore: '#ffff00' });
  });
});

describe('T043: stato della barra', () => {
  it('documento semplice: testi di partenza e nessun pulsante acceso', () => {
    const s = statoBarra(statoCorrente(da('abc')));
    expect(s.valori).toEqual({ 'carattere': 'Arial ▾', 'corpo': '11', 'stile-paragrafo': 'Testo nor… ▾' });
    expect(s.attivi).toEqual([]);
  });

  it('segni, elenchi, stile, carattere e corpo si leggono dal punto in cui si trova il cursore', () => {
    let e = sel(da('uno\ndue'), 0, 0, 0, 3);
    e = eseguiAzioneFormato(e, { tipo: 'segno', segno: 'g' }).ed;
    e = eseguiAzioneFormato(e, { tipo: 'segno', segno: 's' }).ed;
    e = scegli(e, 'carattere', 'Georgia');
    e = scegli(e, 'corpo', '24');
    e = eseguiAzioneFormato(e, { tipo: 'elenco', elenco: 'n' }).ed;
    e = scegli(e, 'stile-paragrafo', 'Titolo 2');
    let s = statoBarra(statoCorrente(e));
    expect(s.valori).toEqual({ 'carattere': 'Georgia ▾', 'corpo': '24', 'stile-paragrafo': 'Titolo 2 ▾' });
    expect(s.attivi).toEqual(['grassetto', 'sottolineato', 'elenco-numerato']);
    e = eseguiAzioneFormato(e, { tipo: 'vai', pos: { p: 1, o: 1 }, estendi: false }).ed;
    s = statoBarra(statoCorrente(e));
    expect(s.valori['corpo']).toBe('11');
    expect(s.attivi).toEqual([]);
    e = eseguiAzioneFormato(e, { tipo: 'elenco', elenco: 'p' }).ed;
    expect(statoBarra(statoCorrente(e)).attivi).toEqual(['elenco-puntato']);
  });

  it('i valori preparati per il testo che si scriverà hanno la precedenza; il testo misto non ha un valore', () => {
    let e = da('abcd', 0, 4);
    e = eseguiAzioneFormato(e, { tipo: 'corpo', direzione: 1 }).ed;
    e = eseguiAzioneFormato(e, { tipo: 'segno', segno: 'c' }).ed;
    const s = statoBarra(statoCorrente(e));
    expect(s.valori['corpo']).toBe('12');
    expect(s.attivi).toEqual(['corsivo']);
    let m = sel(da('abcd'), 0, 0, 0, 2);
    m = eseguiAzioneFormato(m, { tipo: 'attributo', chiave: 'z', valore: 30 }).ed;
    m = sel(m, 0, 0, 0, 4);
    expect(statoBarra(statoCorrente(m)).valori['corpo']).toBe('11');
  });

  it('la voce attiva dei menu segue lo stato', () => {
    let e = da('uno');
    e = scegli(e, 'allineamento', 'Al centro');
    e = scegli(e, 'interlinea', '1,5');
    e = scegli(e, 'colore-testo', '#ff0000');
    const s = statoBarra(statoCorrente(e));
    expect(popupPerComando('allineamento', s)!.voci.map((v) => v.attiva)).toEqual([false, true, false, false]);
    expect(popupPerComando('interlinea', s)!.voci.map((v) => v.attiva)).toEqual([false, false, true, false, false, false]);
    expect(popupPerComando('colore-testo', s)!.voci.filter((v) => v.attiva).map((v) => v.etichetta)).toEqual(['#ff0000']);
  });
});

describe('T043: scegliere una voce cambia il documento', () => {
  it('ogni menu produce l\'effetto giusto sul testo selezionato', () => {
    let e = sel(da('abcdef\nghi'), 0, 1, 1, 2);
    e = scegli(e, 'carattere', 'Verdana');
    e = scegli(e, 'corpo', '36');
    e = scegli(e, 'colore-testo', '#0000ff');
    e = scegli(e, 'evidenzia', '#ffff00');
    e = scegli(e, 'allineamento', 'Destra');
    e = scegli(e, 'stile-paragrafo', 'Titolo');
    const d = statoCorrente(e).doc;
    expect(d.paragrafi[0].runs.map((r) => [r.t, r.f, r.z, r.k, r.h])).toEqual([
      ['a', undefined, undefined, undefined, undefined], ['bcdef', 'Verdana', 36, '#0000ff', '#ffff00'],
    ]);
    expect(d.paragrafi[1].runs.map((r) => [r.t, r.f, r.z])).toEqual([['gh', 'Verdana', 36], ['i', undefined, undefined]]);
    expect(d.paragrafi.map((p) => [p.al, p.st])).toEqual([['dx', 't'], ['dx', 't']]);
    e = scegli(e, 'carattere', 'Arial');
    e = scegli(e, 'colore-testo', 'Automatico');
    expect(statoCorrente(e).doc.paragrafi[0].runs[1]).toEqual({ t: 'bcdef', g: false, c: false, s: false, z: 36, h: '#ffff00' });
    e = scegli(e, 'allineamento', 'Sinistra');
    e = scegli(e, 'stile-paragrafo', 'Testo normale');
    expect(Object.keys(statoCorrente(e).doc.paragrafi[0])).toEqual(['runs']);
  });
});
