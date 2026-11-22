// T533: Dati › Rimuovi duplicati e Dati › Testo in colonne (lotto 2 del piano delle funzioni, 2026-11-18), scritti per pmb_office.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/sheet-grid';
import '../../src/components/dialogo-duplicati';
import '../../src/components/dialogo-testo-colonne';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { chiaveRiga, chiaveValore, compatta, trovaDuplicati } from '../../src/sheet/duplicati';
import {
  dividiALarghezza, dividiConSeparatore, dividiRighe, leggiPosizioni, OPZIONI_DIVISIONE, rilevaSeparatore, PEZZI_MASSIMI,
} from '../../src/sheet/testo-in-colonne';
import { menuRegistry } from '../../src/registry/menu';
import { cellKey } from '../../src/sheet/styles';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const testo = (v: string) => ({ kind: 'text' as const, value: v });
const numero = (v: number) => ({ kind: 'number' as const, value: v });

describe('T533: duplicati (modulo puro)', () => {
  it('maiuscole, minuscole e spazi ai bordi non contano; numero e testo sono diversi', () => {
    expect(chiaveValore(testo('Rossi'))).toBe(chiaveValore(testo(' ROSSI ')));
    expect(chiaveValore(numero(1))).not.toBe(chiaveValore(testo('1')));
    expect(chiaveValore(testo(''))).toBe(chiaveValore({ kind: 'empty' }));
    expect(chiaveValore(numero(-0))).toBe(chiaveValore(numero(0)));
  });
  it('resta la prima riga di ogni gruppo, nell’ordine', () => {
    const dati: Record<number, string> = { 2: 'a', 3: 'b', 4: 'A', 5: 'c', 6: 'b' };
    const e = trovaDuplicati([2, 3, 4, 5, 6], (r) => chiaveRiga([testo(dati[r])]));
    expect(e).toEqual({ tenute: [2, 3, 5], tolte: [4, 6] });
  });
  it('più colonne: duplicato solo se coincidono tutte', () => {
    const righe: Record<number, [string, number]> = { 1: ['Rossi', 1], 2: ['Rossi', 2], 3: ['rossi', 1] };
    const e = trovaDuplicati([1, 2, 3], (r) => chiaveRiga([testo(righe[r][0]), numero(righe[r][1])]));
    expect(e.tolte).toEqual([3]);
  });
  it('compatta: le tenute salgono e il fondo si svuota', () => {
    expect(compatta(2, 6, [2, 3, 5])).toEqual({ spostamenti: [{ da: 2, a: 2 }, { da: 3, a: 3 }, { da: 5, a: 4 }], daSvuotare: [5, 6] });
  });
});

describe('T533: testo in colonne (modulo puro)', () => {
  const o = OPZIONI_DIVISIONE;
  it('separatore, virgolette, spazi', () => {
    expect(dividiConSeparatore('Rossi; Mario ;Roma', ';', o)).toEqual(['Rossi', 'Mario', 'Roma']);
    expect(dividiConSeparatore('"Rossi, Mario",Roma', ',', o)).toEqual(['Rossi, Mario', 'Roma']);
    expect(dividiConSeparatore('"Detto ""Gigi""",x', ',', o)).toEqual(['Detto "Gigi"', 'x']);
    expect(dividiConSeparatore('a,,b', ',', o)).toEqual(['a', '', 'b']);
    expect(dividiConSeparatore('a,,b', ',', { ...o, consecutiviComeUno: true })).toEqual(['a', 'b']);
    expect(dividiConSeparatore('  a  b ', ' ', { ...o, consecutiviComeUno: true })).toEqual(['a', 'b']);
    expect(dividiConSeparatore('a::b::c', '::', o)).toEqual(['a', 'b', 'c']);
    expect(dividiConSeparatore(' a ;b', ';', { ...o, togliSpazi: false })).toEqual([' a ', 'b']);
    expect(dividiConSeparatore('"a;b";c', ';', { ...o, virgolette: false })).toEqual(['"a', 'b"', 'c']);
  });
  it('rileva il separatore più regolare', () => {
    expect(rilevaSeparatore(['Rossi;Mario;Roma', 'Bianchi;Anna;Milano'])).toBe(';');
    expect(rilevaSeparatore(['1,5;2,5;3', '4,1;5;6,2'])).toBe(';');
    expect(rilevaSeparatore(['a\tb', 'c\td'])).toBe('\t');
    expect(rilevaSeparatore(['Mario Rossi', 'Anna Bianchi'])).toBe(' ');
    expect(rilevaSeparatore(['"Rossi, Mario",Roma', '"Verdi, Luca",Napoli'])).toBe(',');
  });
  it('larghezza fissa e posizioni scritte dall’utente', () => {
    expect(dividiALarghezza('ABC12345XY', [3, 8], true)).toEqual(['ABC', '12345', 'XY']);
    expect(dividiALarghezza('AB', [3, 8], true)).toEqual(['AB']);
    expect(leggiPosizioni('10; 25')).toEqual([10, 25]);
    expect(leggiPosizioni('10, x')).toBeNull();
    expect(leggiPosizioni('')).toBeNull();
  });
  it('righe vuote restano vuote; non più di PEZZI_MASSIMI colonne', () => {
    expect(dividiRighe(['a;b', '', 'c'], { ...o, separatore: 'puntoevirgola' })).toEqual([['a', 'b'], [''], ['c']]);
    expect(dividiConSeparatore(Array(2000).fill('x').join(','), ',', o).length).toBe(PEZZI_MASSIMI);
  });
});

describe('T533: nella griglia', () => {
  let grid: FreeSheetGrid;
  beforeEach(async () => {
    defaultDocumentStore.clear();
    grid = document.createElement('free-sheet-grid') as FreeSheetGrid;
    grid.tabId = 'test-t533';
    document.body.appendChild(grid);
    await grid.updateComplete;
  });
  const doc = (): any => (grid as any).getDoc();
  const metti = async (righe: string[][]): Promise<void> => {
    for (let r = 0; r < righe.length; r++) for (let c = 0; c < righe[r].length; c++) await doc().client.setCell(doc().activeSheetName, r + 1, c + 1, righe[r][c]);
  };
  const leggi = async (r: number, c: number): Promise<string> => (await doc().client.getCell(doc().activeSheetName, r, c)).raw;
  const colonna = async (c: number, n: number): Promise<string[]> => { const v: string[] = []; for (let r = 1; r <= n; r++) v.push(await leggi(r, c)); return v; };
  const seleziona = (r1: number, c1: number, r2: number, c2: number): void => { (grid as any).selectSingle(r1, c1); (grid as any).extendSelectionTo(r2, c2); };

  it('rimuove le righe duplicate con l’intestazione; le altre salgono con i formati; Annulla rimette tutto', async () => {
    await metti([['Nome', 'Città'], ['Rossi', 'Roma'], ['Bianchi', 'Milano'], ['rossi', 'roma'], ['Verdi', 'Napoli'], ['Bianchi', 'Torino']]);
    (grid as any).selectSingle(1, 1);
    // un formato sulla riga di Verdi: deve salire con lei
    doc().styles.cellStyles.set(cellKey(5, 1), 7);
    const p: any = await grid.preparaDuplicati();
    expect(p.area).toEqual({ startRow: 1, endRow: 6, startCol: 1, endCol: 2 });
    expect(p.intestazioni).toEqual(['Nome', 'Città']);
    const esito = await grid.rimuoviDuplicati(p.area, [1, 2], true);
    expect(esito).toEqual({ tolte: 1, restano: 4 });
    expect(await colonna(1, 6)).toEqual(['Nome', 'Rossi', 'Bianchi', 'Verdi', 'Bianchi', '']);
    expect(await colonna(2, 6)).toEqual(['Città', 'Roma', 'Milano', 'Napoli', 'Torino', '']);
    expect(doc().styles.cellStyles.get(cellKey(4, 1))).toBe(7);
    expect(doc().styles.cellStyles.get(cellKey(5, 1))).toBeUndefined();
    await grid.undo();
    await attendi();
    expect(await colonna(1, 6)).toEqual(['Nome', 'Rossi', 'Bianchi', 'rossi', 'Verdi', 'Bianchi']);
    expect(doc().styles.cellStyles.get(cellKey(5, 1))).toBe(7);
  });
  it('solo sulla colonna Nome: anche le righe con città diverse sono duplicati', async () => {
    await metti([['Nome', 'Città'], ['Rossi', 'Roma'], ['Bianchi', 'Milano'], ['Bianchi', 'Torino']]);
    seleziona(1, 1, 4, 2);
    const esito = await grid.rimuoviDuplicati({ startRow: 1, endRow: 4, startCol: 1, endCol: 2 }, [1], true);
    expect(esito.tolte).toBe(1);
    expect(await colonna(2, 4)).toEqual(['Città', 'Roma', 'Milano', '']);
  });
  it('le formule delle righe che salgono restano giuste', async () => {
    await metti([['a', '1'], ['a', '1'], ['b', '2']]);
    await doc().client.setCell(doc().activeSheetName, 3, 3, '=B3*10');
    await grid.rimuoviDuplicati({ startRow: 1, endRow: 3, startCol: 1, endCol: 3 }, [1, 2], false);
    expect(await leggi(2, 1)).toBe('b');
    expect(await leggi(2, 3)).toBe('=B2*10');
    expect((await doc().client.getCell(doc().activeSheetName, 2, 3)).value).toEqual({ kind: 'number', value: 20 });
  });
  it('senza duplicati non cambia niente e non aggiunge passi di Annulla', async () => {
    await metti([['a'], ['b']]);
    const passi = doc().history.undoStack?.length ?? 0;
    expect(await grid.rimuoviDuplicati({ startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, [1], false)).toEqual({ tolte: 0, restano: 2 });
    expect(doc().history.undoStack?.length ?? 0).toBe(passi);
  });
  it('prepara: messaggi chiari se l’area non va', async () => {
    expect('errore' in (await grid.preparaDuplicati())).toBe(true); // foglio vuoto
    await metti([['a', 'b']]);
    seleziona(1, 1, 1, 2);
    expect((await grid.preparaDuplicati() as any).errore).toMatch(/due righe/);
    expect((await grid.preparaTestoInColonne() as any).errore).toMatch(/una sola colonna/);
  });
  it('testo in colonne: divide, legge i numeri all’italiana, conta le celle che sostituisce, Annulla', async () => {
    await metti([['Rossi;Mario;1,5'], ['Bianchi;Anna;2'], ['']]);
    await doc().client.setCell(doc().activeSheetName, 2, 2, 'vecchio');
    seleziona(1, 1, 2, 1);
    const p: any = await grid.preparaTestoInColonne();
    expect(p.testi).toEqual(['Rossi;Mario;1,5', 'Bianchi;Anna;2']);
    const opz = { ...OPZIONI_DIVISIONE };
    expect(await grid.celleSovrascritte(p.area, dividiRighe(p.testi, opz))).toBe(1);
    const esito = await grid.testoInColonne(p.area, opz);
    expect(esito).toEqual({ righe: 2, colonne: 3 });
    expect([await leggi(1, 1), await leggi(1, 2), await leggi(1, 3)]).toEqual(['Rossi', 'Mario', '1.5']);
    expect([await leggi(2, 1), await leggi(2, 2), await leggi(2, 3)]).toEqual(['Bianchi', 'Anna', '2']);
    await grid.undo();
    await attendi();
    expect([await leggi(1, 1), await leggi(2, 2), await leggi(1, 3)]).toEqual(['Rossi;Mario;1,5', 'vecchio', '']);
  });
});

describe('T533: menu e finestre', () => {
  it('le due voci sono nel menu Dati', () => {
    const dati = menuRegistry.find((m) => m.id === 'data')!;
    const azioni = dati.items.map((i) => i.action);
    expect(azioni).toContain('remove-duplicates');
    expect(azioni).toContain('split-text');
  });
  it('finestra Rimuovi duplicati: colonne con il nome dell’intestazione, scelta delle colonne', async () => {
    const d: any = document.createElement('free-dialogo-duplicati');
    d.primaColonna = 2; d.intestazioni = ['Nome', '']; d.area = 'B1:C9';
    document.body.appendChild(d);
    await d.updateComplete;
    const etichette = Array.from(d.shadowRoot.querySelectorAll('.colonne label')).map((l: any) => l.textContent.trim());
    expect(etichette).toEqual(['Nome (colonna B)', 'Colonna C']);
    let detto: any = null;
    d.addEventListener('rimuovi-duplicati', (e: CustomEvent) => { detto = e.detail; });
    (d.shadowRoot.querySelector('input[data-colonna="3"]') as HTMLInputElement).click();
    await d.updateComplete;
    (d.shadowRoot.querySelector('button[data-azione="rimuovi"]') as HTMLButtonElement).click();
    expect(detto).toEqual({ colonne: [2], conIntestazione: true });
    (d.shadowRoot.querySelector('button[data-azione="nessuna"]') as HTMLButtonElement).click();
    await d.updateComplete;
    expect((d.shadowRoot.querySelector('button[data-azione="rimuovi"]') as HTMLButtonElement).disabled).toBe(true);
    d.remove();
  });
  it('finestra Testo in colonne: anteprima, separatore rilevato, conferma per le celle sostituite', async () => {
    const d: any = document.createElement('free-dialogo-testo-colonne');
    d.testi = ['a;b;c', 'd;e']; d.area = 'A1:A2';
    document.body.appendChild(d);
    await d.updateComplete;
    const righe = Array.from(d.shadowRoot.querySelectorAll('.anteprima tr')).map((tr: any) => Array.from(tr.querySelectorAll('td')).map((td: any) => td.textContent));
    expect(righe).toEqual([['a', 'b', 'c'], ['d', 'e', '']]);
    expect(d.shadowRoot.textContent).toContain('punto e virgola');
    let detto: any = null;
    d.addEventListener('dividi-testo', (e: CustomEvent) => { detto = e.detail; });
    (d.shadowRoot.querySelector('button[data-azione="dividi"]') as HTMLButtonElement).click();
    expect(detto.confermato).toBe(false);
    d.sovrascritte = 3;
    await d.updateComplete;
    expect(d.shadowRoot.querySelector('[data-campo="avviso"]').textContent).toContain('3');
    (d.shadowRoot.querySelector('button[data-azione="sostituisci"]') as HTMLButtonElement).click();
    expect(detto.confermato).toBe(true);
    // larghezza fissa senza posizioni: messaggio e niente invio
    detto = null;
    const sel = d.shadowRoot.querySelector('select') as HTMLSelectElement;
    sel.value = 'larghezza'; sel.dispatchEvent(new Event('change'));
    await d.updateComplete;
    (d.shadowRoot.querySelector('button[data-azione="dividi"]') as HTMLButtonElement).click();
    await d.updateComplete;
    expect(detto).toBeNull();
    expect(d.shadowRoot.querySelector('.errore')).toBeTruthy();
    d.remove();
  });
});
