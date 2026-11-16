// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { azioneDaTasto, azioneDaComando, eseguiAzione, nuovoEditor, statoCorrente, type Azione, type EventoTasto, type StatoEditor } from '../../src/editor/azioni';
import { daTesto, statoIniziale, testoDi, cursore, segniVuoti, type Stato } from '../../src/modello/documento';

function t(key: string, extra: Partial<EventoTasto> = {}): EventoTasto {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra };
}
function esegui(ed: StatoEditor, ...azioni: Azione[]): StatoEditor {
  let e = ed;
  for (const a of azioni) e = eseguiAzione(e, a).ed;
  return e;
}
const scrivi = (s: string): Azione => ({ tipo: 'testo', testo: s });
function da(testo: string, p: number, o: number): StatoEditor {
  const st: Stato = { doc: daTesto(testo), sel: cursore(p, o), pendenti: null };
  return nuovoEditor(st);
}
const tx = (ed: StatoEditor): string => testoDi(statoCorrente(ed).doc);

describe('T032: dai tasti alle azioni', () => {
  it('lettere, numeri, spazio, lettere accentate ed emoji sono testo', () => {
    for (const k of ['a', 'Z', '7', ' ', 'è', '€', '😀']) expect(azioneDaTasto(t(k)), k).toEqual({ tipo: 'testo', testo: k });
    expect(azioneDaTasto(t('A', { shiftKey: true }))).toEqual({ tipo: 'testo', testo: 'A' });
  });

  it('con Ctrl o Alt da soli non si scrive, con AltGr (Ctrl+Alt) sì', () => {
    expect(azioneDaTasto(t('a', { ctrlKey: true }))).toEqual({ tipo: 'selezionaTutto' });
    expect(azioneDaTasto(t('x', { ctrlKey: true }))).toBeNull();
    expect(azioneDaTasto(t('q', { altKey: true }))).toBeNull();
    expect(azioneDaTasto(t('@', { ctrlKey: true, altKey: true }))).toEqual({ tipo: 'testo', testo: '@' });
    expect(azioneDaTasto(t('Shift'))).toBeNull();
    expect(azioneDaTasto(t('F5'))).toBeNull();
    expect(azioneDaTasto(t('Tab'))).toBeNull();
    expect(azioneDaTasto(t('Escape'))).toBeNull();
  });

  it('invio, cancellazioni, frecce, Home e Fine', () => {
    expect(azioneDaTasto(t('Enter'))).toEqual({ tipo: 'invio' });
    expect(azioneDaTasto(t('Enter', { ctrlKey: true }))).toBeNull();
    expect(azioneDaTasto(t('Backspace'))).toEqual({ tipo: 'cancella', direzione: 'indietro', parola: false });
    expect(azioneDaTasto(t('Backspace', { ctrlKey: true }))).toEqual({ tipo: 'cancella', direzione: 'indietro', parola: true });
    expect(azioneDaTasto(t('Delete'))).toEqual({ tipo: 'cancella', direzione: 'avanti', parola: false });
    expect(azioneDaTasto(t('Delete', { ctrlKey: true }))).toEqual({ tipo: 'cancella', direzione: 'avanti', parola: true });
    expect(azioneDaTasto(t('ArrowLeft'))).toEqual({ tipo: 'muovi', mossa: 'sinistra', estendi: false });
    expect(azioneDaTasto(t('ArrowRight', { shiftKey: true }))).toEqual({ tipo: 'muovi', mossa: 'destra', estendi: true });
    expect(azioneDaTasto(t('ArrowLeft', { ctrlKey: true }))).toEqual({ tipo: 'muovi', mossa: 'parolaSinistra', estendi: false });
    expect(azioneDaTasto(t('ArrowRight', { ctrlKey: true, shiftKey: true }))).toEqual({ tipo: 'muovi', mossa: 'parolaDestra', estendi: true });
    expect(azioneDaTasto(t('Home'))).toEqual({ tipo: 'muovi', mossa: 'inizioParagrafo', estendi: false });
    expect(azioneDaTasto(t('End', { shiftKey: true }))).toEqual({ tipo: 'muovi', mossa: 'fineParagrafo', estendi: true });
    expect(azioneDaTasto(t('Home', { ctrlKey: true }))).toEqual({ tipo: 'muovi', mossa: 'inizioDocumento', estendi: false });
    expect(azioneDaTasto(t('End', { ctrlKey: true }))).toEqual({ tipo: 'muovi', mossa: 'fineDocumento', estendi: false });
    expect(azioneDaTasto(t('ArrowUp'))).toEqual({ tipo: 'verticale', direzione: 'su', estendi: false });
    expect(azioneDaTasto(t('ArrowDown', { shiftKey: true }))).toEqual({ tipo: 'verticale', direzione: 'giu', estendi: true });
  });

  it('scorciatoie: grassetto, corsivo, sottolineato, annulla, ripeti, seleziona tutto, anche con Cmd e maiuscole', () => {
    expect(azioneDaTasto(t('b', { ctrlKey: true }))).toEqual({ tipo: 'segno', segno: 'g' });
    expect(azioneDaTasto(t('B', { ctrlKey: true }))).toEqual({ tipo: 'segno', segno: 'g' });
    expect(azioneDaTasto(t('i', { metaKey: true }))).toEqual({ tipo: 'segno', segno: 'c' });
    expect(azioneDaTasto(t('u', { ctrlKey: true }))).toEqual({ tipo: 'segno', segno: 's' });
    expect(azioneDaTasto(t('z', { ctrlKey: true }))).toEqual({ tipo: 'annulla' });
    expect(azioneDaTasto(t('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ tipo: 'ripeti' });
    expect(azioneDaTasto(t('y', { ctrlKey: true }))).toEqual({ tipo: 'ripeti' });
    expect(azioneDaTasto(t('a', { ctrlKey: true }))).toEqual({ tipo: 'selezionaTutto' });
    expect(azioneDaTasto(t('c', { ctrlKey: true }))).toBeNull();
    expect(azioneDaTasto(t('v', { ctrlKey: true }))).toBeNull();
  });

  it('i pulsanti della barra collegati e quelli non ancora collegati', () => {
    expect(azioneDaComando('grassetto')).toEqual({ tipo: 'segno', segno: 'g' });
    expect(azioneDaComando('corsivo')).toEqual({ tipo: 'segno', segno: 'c' });
    expect(azioneDaComando('sottolineato')).toEqual({ tipo: 'segno', segno: 's' });
    expect(azioneDaComando('annulla')).toEqual({ tipo: 'annulla' });
    expect(azioneDaComando('ripeti')).toEqual({ tipo: 'ripeti' });
    expect(azioneDaComando('zoom')).toBeNull();
    expect(azioneDaComando('')).toBeNull();
  });
});

describe('T032: eseguire le azioni', () => {
  it('scrivere, andare a capo, cancellare', () => {
    let e = esegui(nuovoEditor(), scrivi('C'), scrivi('i'), scrivi('a'), scrivi('o'), { tipo: 'invio' }, scrivi('x'));
    expect(tx(e)).toBe('Ciao\nx');
    e = esegui(e, { tipo: 'cancella', direzione: 'indietro', parola: false }, { tipo: 'cancella', direzione: 'indietro', parola: false });
    expect(tx(e)).toBe('Ciao');
    expect(statoCorrente(e).sel).toEqual(cursore(0, 4));
  });

  it('la digitazione continua è un solo passo di annulla; dopo uno spostamento ne comincia un altro', () => {
    let e = esegui(nuovoEditor(), scrivi('a'), scrivi('b'), scrivi('c'));
    e = esegui(e, { tipo: 'muovi', mossa: 'inizioParagrafo', estendi: false }, scrivi('X'), scrivi('Y'));
    expect(tx(e)).toBe('XYabc');
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('abc');
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('');
    e = esegui(e, { tipo: 'annulla' });
    expect(tx(e)).toBe('');
    e = esegui(e, { tipo: 'ripeti' }, { tipo: 'ripeti' });
    expect(tx(e)).toBe('XYabc');
  });

  it('Ctrl+Backspace e Ctrl+Canc cancellano una parola; con selezione cancellano la selezione', () => {
    expect(tx(esegui(da('uno due tre', 0, 11), { tipo: 'cancella', direzione: 'indietro', parola: true }))).toBe('uno due ');
    expect(tx(esegui(da('uno due tre', 0, 4), { tipo: 'cancella', direzione: 'avanti', parola: true }))).toBe('uno tre');
    expect(tx(esegui(da('uno\ndue', 1, 0), { tipo: 'cancella', direzione: 'indietro', parola: true }))).toBe('unodue');
    const sel = esegui(da('uno due', 0, 0), { tipo: 'muovi', mossa: 'parolaDestra', estendi: true });
    expect(tx(esegui(sel, { tipo: 'cancella', direzione: 'indietro', parola: true }))).toBe('due');
  });

  it('frecce, estensione, vai e seleziona tutto', () => {
    let e = esegui(da('abc\ndef', 0, 1), { tipo: 'muovi', mossa: 'destra', estendi: true }, { tipo: 'muovi', mossa: 'destra', estendi: true });
    expect(statoCorrente(e).sel).toEqual({ ancora: { p: 0, o: 1 }, fuoco: { p: 0, o: 3 } });
    e = esegui(e, { tipo: 'vai', pos: { p: 1, o: 2 }, estendi: false });
    expect(statoCorrente(e).sel).toEqual(cursore(1, 2));
    e = esegui(e, { tipo: 'vai', pos: { p: 0, o: 0 }, estendi: true });
    expect(statoCorrente(e).sel).toEqual({ ancora: { p: 1, o: 2 }, fuoco: { p: 0, o: 0 } });
    e = esegui(e, { tipo: 'selezionaTutto' }, scrivi('Z'));
    expect(tx(e)).toBe('Z');
  });

  it('copia, taglia e incolla', () => {
    const base = esegui(da('uno due tre', 0, 4), { tipo: 'muovi', mossa: 'destra', estendi: true }, { tipo: 'muovi', mossa: 'destra', estendi: true }, { tipo: 'muovi', mossa: 'destra', estendi: true });
    const c = eseguiAzione(base, { tipo: 'copia' });
    expect(c.copiato).toBe('due');
    expect(tx(c.ed)).toBe('uno due tre');
    const x = eseguiAzione(base, { tipo: 'taglia' });
    expect(x.copiato).toBe('due');
    expect(tx(x.ed)).toBe('uno  tre');
    expect(eseguiAzione(da('abc', 0, 1), { tipo: 'copia' }).copiato).toBeNull();
    expect(eseguiAzione(da('abc', 0, 1), { tipo: 'taglia' }).copiato).toBeNull();
    const i = eseguiAzione(x.ed, { tipo: 'incolla', testo: 'XX\nYY' });
    expect(tx(i.ed)).toBe('uno XX\nYY tre');
    expect(i.copiato).toBeNull();
    expect(tx(esegui(i.ed, { tipo: 'annulla' }))).toBe('uno  tre');
  });

  it('grassetto prima di scrivere e su una selezione', () => {
    let e = esegui(da('ab', 0, 2), { tipo: 'segno', segno: 'g' }, scrivi('c'));
    expect(statoCorrente(e).doc.paragrafi[0].runs.map((r) => [r.t, r.g])).toEqual([['ab', false], ['c', true]]);
    e = esegui(da('abcd', 0, 1), { tipo: 'muovi', mossa: 'destra', estendi: true }, { tipo: 'segno', segno: 'c' });
    expect(statoCorrente(e).doc.paragrafi[0].runs.map((r) => [r.t, r.c])).toEqual([['a', false], ['b', true], ['cd', false]]);
    e = esegui(e, { tipo: 'annulla' });
    expect(statoCorrente(e).doc.paragrafi[0].runs.length).toBe(1);
    expect(statoCorrente(e).pendenti).toBeNull();
    expect(segniVuoti()).toEqual({ g: false, c: false, s: false });
  });

  it('nessuna azione cambia lo stato ricevuto', () => {
    const e = esegui(nuovoEditor(statoIniziale()), scrivi('a'), scrivi('b'));
    const copia = JSON.stringify(e);
    const azioni: Azione[] = [scrivi('z'), { tipo: 'invio' }, { tipo: 'cancella', direzione: 'indietro', parola: true },
      { tipo: 'muovi', mossa: 'sinistra', estendi: true }, { tipo: 'vai', pos: { p: 0, o: 0 }, estendi: false },
      { tipo: 'segno', segno: 'g' }, { tipo: 'annulla' }, { tipo: 'ripeti' }, { tipo: 'selezionaTutto' },
      { tipo: 'copia' }, { tipo: 'taglia' }, { tipo: 'incolla', testo: 'q' }, { tipo: 'verticale', direzione: 'su', estendi: false }];
    for (const a of azioni) eseguiAzione(e, a);
    expect(JSON.stringify(e)).toBe(copia);
  });
});
