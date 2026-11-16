// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  azioneDaTastoFormato, azioneDaComandoFormato, eseguiAzioneFormato, type AzioneFormato, type EventoTastoFormato,
} from '../../src/editor/azioni-formato';
import { nuovoEditor, statoCorrente, type StatoEditor } from '../../src/editor/azioni';
import { daTesto, testoDi, cursore, testoParagrafo, type Stato } from '../../src/modello/documento';

function t(key: string, extra: Partial<EventoTastoFormato> = {}): EventoTastoFormato {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra };
}
function da(testo: string, p = 0, o = 0): StatoEditor {
  const st: Stato = { doc: daTesto(testo), sel: cursore(p, o), pendenti: null };
  return nuovoEditor(st);
}
function esegui(ed: StatoEditor, ...azioni: AzioneFormato[]): StatoEditor {
  let e = ed;
  for (const a of azioni) e = eseguiAzioneFormato(e, a).ed;
  return e;
}
const par = (ed: StatoEditor) => statoCorrente(ed).doc.paragrafi;
const tx = (ed: StatoEditor): string => testoDi(statoCorrente(ed).doc);
const seleziona = (ed: StatoEditor, p1: number, o1: number, p2: number, o2: number): StatoEditor =>
  esegui(ed, { tipo: 'vai', pos: { p: p1, o: o1 }, estendi: false }, { tipo: 'vai', pos: { p: p2, o: o2 }, estendi: true });

describe('T041: scorciatoie e pulsanti di formattazione', () => {
  it('allineamento, elenchi, corpo, cancella formattazione e rientro con le scorciatoie di Google Documenti', () => {
    const c = { ctrlKey: true, shiftKey: true };
    expect(azioneDaTastoFormato(t('L', c))).toEqual({ tipo: 'allinea', valore: 'sx' });
    expect(azioneDaTastoFormato(t('E', c))).toEqual({ tipo: 'allinea', valore: 'ce' });
    expect(azioneDaTastoFormato(t('R', c))).toEqual({ tipo: 'allinea', valore: 'dx' });
    expect(azioneDaTastoFormato(t('J', c))).toEqual({ tipo: 'allinea', valore: 'gi' });
    expect(azioneDaTastoFormato(t('&', { ...c, code: 'Digit7' }))).toEqual({ tipo: 'elenco', elenco: 'n' });
    expect(azioneDaTastoFormato(t('*', { ...c, code: 'Digit8' }))).toEqual({ tipo: 'elenco', elenco: 'p' });
    expect(azioneDaTastoFormato(t('>', c))).toEqual({ tipo: 'corpo', direzione: 1 });
    expect(azioneDaTastoFormato(t('<', c))).toEqual({ tipo: 'corpo', direzione: -1 });
    expect(azioneDaTastoFormato(t('\\', { ctrlKey: true }))).toEqual({ tipo: 'pulisci' });
    expect(azioneDaTastoFormato(t(']', { ctrlKey: true }))).toEqual({ tipo: 'rientro', delta: 1 });
    expect(azioneDaTastoFormato(t('[', { ctrlKey: true }))).toEqual({ tipo: 'rientro', delta: -1 });
    expect(azioneDaTastoFormato(t('Tab'))).toEqual({ tipo: 'tab', indietro: false });
    expect(azioneDaTastoFormato(t('Tab', { shiftKey: true }))).toEqual({ tipo: 'tab', indietro: true });
  });

  it('i tasti già noti restano quelli di prima; Ctrl+Maiusc+lettere sconosciute non scrivono', () => {
    expect(azioneDaTastoFormato(t('a'))).toEqual({ tipo: 'testo', testo: 'a' });
    expect(azioneDaTastoFormato(t('b', { ctrlKey: true }))).toEqual({ tipo: 'segno', segno: 'g' });
    expect(azioneDaTastoFormato(t('Enter'))).toEqual({ tipo: 'invio' });
    expect(azioneDaTastoFormato(t('Q', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(azioneDaTastoFormato(t('@', { ctrlKey: true, altKey: true }))).toEqual({ tipo: 'testo', testo: '@' });
    expect(azioneDaTastoFormato(t('Tab', { ctrlKey: true }))).toBeNull();
  });

  it('i pulsanti della barra che agiscono subito', () => {
    expect(azioneDaComandoFormato('riduci-corpo')).toEqual({ tipo: 'corpo', direzione: -1 });
    expect(azioneDaComandoFormato('aumenta-corpo')).toEqual({ tipo: 'corpo', direzione: 1 });
    expect(azioneDaComandoFormato('elenco-puntato')).toEqual({ tipo: 'elenco', elenco: 'p' });
    expect(azioneDaComandoFormato('elenco-numerato')).toEqual({ tipo: 'elenco', elenco: 'n' });
    expect(azioneDaComandoFormato('riduci-rientro')).toEqual({ tipo: 'rientro', delta: -1 });
    expect(azioneDaComandoFormato('aumenta-rientro')).toEqual({ tipo: 'rientro', delta: 1 });
    expect(azioneDaComandoFormato('cancella-formattazione')).toEqual({ tipo: 'pulisci' });
    expect(azioneDaComandoFormato('grassetto')).toEqual({ tipo: 'segno', segno: 'g' });
    expect(azioneDaComandoFormato('annulla')).toEqual({ tipo: 'annulla' });
    expect(azioneDaComandoFormato('zoom')).toBeNull();
  });
});

describe('T041: effetti sul documento', () => {
  it('corpo: i pulsanti salgono e scendono lungo i passi, a partire da 11; con la selezione cambia il testo', () => {
    let e = seleziona(da('abcd'), 0, 0, 0, 4);
    e = esegui(e, { tipo: 'corpo', direzione: 1 });
    expect(par(e)[0].runs).toEqual([{ t: 'abcd', g: false, c: false, s: false, z: 12 }]);
    e = esegui(e, { tipo: 'corpo', direzione: 1 }, { tipo: 'corpo', direzione: 1 });
    expect(par(e)[0].runs[0].z).toBe(18);
    e = esegui(e, { tipo: 'corpo', direzione: -1 });
    expect(par(e)[0].runs[0].z).toBe(14);
    const giu = seleziona(da('abcd'), 0, 0, 0, 4);
    expect(par(esegui(giu, { tipo: 'corpo', direzione: -1 }))[0].runs[0].z).toBe(10);
    const misto = esegui(seleziona(da('abcd'), 0, 0, 0, 2), { tipo: 'attributo', chiave: 'z', valore: 24 });
    expect(par(esegui(seleziona(misto, 0, 0, 0, 4), { tipo: 'corpo', direzione: 1 }))[0].runs[0].z).toBe(12);
  });

  it('prima di scrivere: corpo e colore valgono per il testo che arriva', () => {
    let e = da('ab', 0, 2);
    e = esegui(e, { tipo: 'attributo', chiave: 'z', valore: 30 }, { tipo: 'attributo', chiave: 'k', valore: '#ff0000' }, { tipo: 'testo', testo: 'X' });
    expect(par(e)[0].runs.map((r) => [r.t, r.z, r.k])).toEqual([['ab', undefined, undefined], ['X', 30, '#ff0000']]);
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('ab');
  });

  it('allineamento, interlinea e stile: i valori normali non lasciano traccia', () => {
    let e = seleziona(da('uno\ndue\ntre'), 0, 1, 1, 1);
    e = esegui(e, { tipo: 'allinea', valore: 'ce' });
    expect(par(e).map((p) => p.al)).toEqual(['ce', 'ce', undefined]);
    e = esegui(e, { tipo: 'allinea', valore: 'sx' });
    expect(par(e).map((p) => Object.keys(p))).toEqual([['runs'], ['runs'], ['runs']]);
    e = esegui(e, { tipo: 'interlinea', valore: 1.5 }, { tipo: 'stile', valore: '1' });
    expect(par(e).map((p) => [p.ls, p.st])).toEqual([[1.5, '1'], [1.5, '1'], [undefined, undefined]]);
    e = esegui(e, { tipo: 'interlinea', valore: 1.15 }, { tipo: 'stile', valore: 'n' });
    expect(par(e).map((p) => Object.keys(p))).toEqual([['runs'], ['runs'], ['runs']]);
    e = esegui(e, { tipo: 'annulla' });
    expect(par(e)[0].st).toBe('1');
  });

  it('elenchi: invio continua l\'elenco, invio su una voce vuota lo chiude, Backspace a inizio voce toglie il punto', () => {
    let e = da('uno', 0, 3);
    e = esegui(e, { tipo: 'elenco', elenco: 'p' }, { tipo: 'invio' }, { tipo: 'testo', testo: 'due' });
    expect(par(e).map((p) => [testoParagrafo(p), p.el])).toEqual([['uno', 'p'], ['due', 'p']]);
    e = esegui(e, { tipo: 'invio' });
    expect(par(e).map((p) => p.el)).toEqual(['p', 'p', 'p']);
    e = esegui(e, { tipo: 'invio' });
    expect(par(e).map((p) => [testoParagrafo(p), p.el])).toEqual([['uno', 'p'], ['due', 'p'], ['', undefined]]);
    expect(Object.keys(par(e)[2])).toEqual(['runs']);
    e = esegui(e, { tipo: 'vai', pos: { p: 1, o: 0 }, estendi: false }, { tipo: 'cancella', direzione: 'indietro', parola: false });
    expect(par(e).map((p) => [testoParagrafo(p), p.el])).toEqual([['uno', 'p'], ['due', undefined], ['', undefined]]);
    expect(par(e).length).toBe(3);
    e = esegui(e, { tipo: 'cancella', direzione: 'indietro', parola: false });
    expect(par(e).map(testoParagrafo)).toEqual(['unodue', '']);
  });

  it('a capo in fondo a un titolo il paragrafo nuovo è testo normale; a capo in mezzo al titolo restano due titoli', () => {
    let e = esegui(da('Titolo', 0, 6), { tipo: 'stile', valore: '1' }, { tipo: 'allinea', valore: 'ce' });
    e = esegui(e, { tipo: 'invio' }, { tipo: 'testo', testo: 'corpo' });
    expect(par(e).map((p) => [testoParagrafo(p), p.st, p.al])).toEqual([['Titolo', '1', 'ce'], ['corpo', undefined, 'ce']]);
    expect(Object.keys(par(e)[1]).sort()).toEqual(['al', 'runs']);
    let m = esegui(da('Titolo', 0, 3), { tipo: 'stile', valore: '2' });
    m = esegui(m, { tipo: 'invio' });
    expect(par(m).map((p) => [testoParagrafo(p), p.st])).toEqual([['Tit', '2'], ['olo', '2']]);
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('Titolo\n');
    expect(par(e)[1].st).toBeUndefined();
  });

  it('Tab e Maiusc+Tab: cambiano il rientro nell\'elenco, scrivono una tabulazione fuori', () => {
    let e = da('uno\ndue', 1, 0);
    e = esegui(e, { tipo: 'tab', indietro: false });
    expect(tx(e)).toBe('uno\n\tdue');
    e = esegui(e, { tipo: 'tab', indietro: true });
    expect(tx(e)).toBe('uno\n\tdue');
    e = esegui(da('uno\ndue', 1, 0), { tipo: 'elenco', elenco: 'n' }, { tipo: 'tab', indietro: false }, { tipo: 'tab', indietro: false });
    expect(par(e).map((p) => p.ri)).toEqual([undefined, 2]);
    e = esegui(e, { tipo: 'tab', indietro: true });
    expect(par(e)[1].ri).toBe(1);
    e = esegui(e, { tipo: 'rientro', delta: -1 }, { tipo: 'rientro', delta: -1 });
    expect(par(e)[1].ri).toBeUndefined();
    expect(par(esegui(da('uno'), { tipo: 'rientro', delta: 1 }))[0].ri).toBe(1);
  });

  it('cancella formattazione: sulla selezione toglie tutto tranne allineamento ed elenchi; col cursore prepara testo normale', () => {
    let e = seleziona(da('abcd'), 0, 0, 0, 4);
    e = esegui(e, { tipo: 'segno', segno: 'g' }, { tipo: 'attributo', chiave: 'z', valore: 20 }, { tipo: 'stile', valore: '2' }, { tipo: 'allinea', valore: 'dx' });
    e = esegui(e, { tipo: 'pulisci' });
    expect(par(e)[0]).toEqual({ al: 'dx', runs: [{ t: 'abcd', g: false, c: false, s: false }] });
    let p = esegui(da('ab', 0, 2), { tipo: 'segno', segno: 'c' }, { tipo: 'attributo', chiave: 'z', valore: 20 });
    p = esegui(p, { tipo: 'pulisci' }, { tipo: 'testo', testo: 'X' });
    expect(par(p)[0].runs).toEqual([{ t: 'abX', g: false, c: false, s: false }]);
  });

  it('le azioni di prima funzionano come prima e nessuna cambia lo stato ricevuto', () => {
    let e = esegui(da(''), { tipo: 'testo', testo: 'a' }, { tipo: 'testo', testo: 'b' }, { tipo: 'invio' }, { tipo: 'testo', testo: 'c' });
    expect(tx(e)).toBe('ab\nc');
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('ab\n');
    const copia = JSON.stringify(e);
    const azioni: AzioneFormato[] = [
      { tipo: 'attributo', chiave: 'f', valore: 'Georgia' }, { tipo: 'allinea', valore: 'ce' }, { tipo: 'interlinea', valore: 2 },
      { tipo: 'stile', valore: 't' }, { tipo: 'elenco', elenco: 'n' }, { tipo: 'rientro', delta: 1 }, { tipo: 'tab', indietro: false },
      { tipo: 'corpo', direzione: 1 }, { tipo: 'pulisci' }, { tipo: 'invio' }, { tipo: 'cancella', direzione: 'indietro', parola: false },
    ];
    for (const a of azioni) eseguiAzioneFormato(e, a);
    expect(JSON.stringify(e)).toBe(copia);
  });
});
