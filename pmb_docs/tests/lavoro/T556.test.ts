// T556: tabelle con celle unite, righe di intestazione e ordinamento delle righe (editor/tabelle.ts, modello/unioni.ts), disegnate
// nella pagina e salvate in .pdoc, .docx e .odt come li scrivono Word e LibreOffice. File di confronto: tests/file-prova/tabelle/
// word-tabelle.docx (fatto da Word con LAVORO/studio-microsoft-office/word_tabelle.py) e libreoffice-tabelle.odt (lo stesso file
// convertito da LibreOffice). I file scritti si lasciano in tmp/pmb-T556.docx e .odt per riaprirli in Word e in LibreOffice.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { importaDocx, esportaDocx } from '../../src/formati/docx';
import { importaOdt, esportaOdt } from '../../src/formati/odt';
import { disegna } from '../../src/editor/render';
import { cellaVicina, inserisciTabella, modificaTabella, motivoTabella, tabellaAl, type OperazioneTabella } from '../../src/editor/tabelle';
import { eseguiAzioneFormato } from '../../src/editor/azioni-formato';
import { nuovoEditor } from '../../src/editor/azioni';
import { controllaTabelle, cursore, daTesto, deserializza, serializza, statoIniziale, testoParagrafo, type Documento, type Stato } from '../../src/modello/documento';
import { controllaUnioni, riparaUnioni } from '../../src/modello/unioni';

const VALORI = [['Nome', 'Ruolo', 'Note'], ['Anna', 'Analista', 'Unita in verticale'], ['Bruno', 'Tecnico', ''], ['Unita in orizzontale', '', 'Fine']];

/** "ab", una tabella con i valori dati, un paragrafo vuoto. */
function conTabella(valori: string[][]): Stato {
  const s = inserisciTabella({ ...statoIniziale(daTesto('ab')), sel: cursore(0, 2) }, valori.length, valori[0].length);
  const paragrafi = s.doc.paragrafi.map((p) => (p.tb ? { ...p, runs: valori[p.tb.r][p.tb.c] === '' ? [] : [{ t: valori[p.tb.r][p.tb.c], g: false, c: false, s: false }] } : p));
  return { ...s, doc: { ...s.doc, paragrafi } };
}
/** Il paragrafo della cella (r, c) della prima tabella. */
const cella = (d: Documento, r: number, c: number): number => d.paragrafi.findIndex((p) => p.tb?.r === r && p.tb?.c === c);
const seleziona = (s: Stato, da: [number, number], a: [number, number]): Stato => ({ ...s, sel: { ancora: { p: cella(s.doc, ...da), o: 0 }, fuoco: { p: cella(s.doc, ...a), o: 0 } } });
const op = (s: Stato, o: OperazioneTabella): Stato => modificaTabella(s, o);
/** La tabella come righe di stringhe: «·» = cella coperta, «testo[rxc]» = cella unita su r righe e c colonne; «H» davanti alle righe di intestazione. */
function griglia(d: Documento): string[] {
  const t = tabellaAl(d, d.paragrafi.findIndex((p) => p.tb))!;
  return t.celle.map((riga, r) => (t.unioni[r][0].h ? 'H ' : '') + riga.map((pars, c) => {
    const u = t.unioni[r][c];
    if (u.co) return '·';
    return pars.map(testoParagrafo).join('/') + (u.cs > 1 || u.rs > 1 ? `[${u.rs}x${u.cs}]` : '');
  }).join(' | '));
}
const WORD = ['H Nome | Ruolo | Note', 'Anna | Analista | Unita in verticale[2x1]', 'Bruno | Tecnico | ·', 'Unita in orizzontale[1x2] | · | Fine'];
/** La tabella di Word fatta con le operazioni di pmb_docs. */
function comeWord(): Stato {
  let s = conTabella(VALORI);
  s = op(seleziona(s, [1, 2], [2, 2]), 'unisciCelle');
  s = op(seleziona(s, [3, 0], [3, 1]), 'unisciCelle');
  s = op({ ...s, sel: cursore(cella(s.doc, 0, 1), 0) }, 'intestazione');
  return s;
}

describe('T556: unire e dividere celle', () => {
  test('unire due celle: il testo va nella prima, l\'altra resta coperta; dividere la riporta com\'era (vuota)', () => {
    const s = op(seleziona(conTabella(VALORI), [1, 0], [1, 1]), 'unisciCelle');
    expect(griglia(s.doc)[1]).toBe('Anna/Analista[1x2] | · | Unita in verticale');
    expect(controllaTabelle(s.doc)).toBeNull();
    expect(s.sel.fuoco).toEqual({ p: cella(s.doc, 1, 0), o: 0 });
    const d = op(s, 'dividiCella');
    expect(griglia(d.doc)[1]).toBe('Anna/Analista |  | Unita in verticale');
    expect(motivoTabella(d, 'dividiCella')).toBe('La cella del cursore non è una cella unita');
    expect(motivoTabella({ ...d, sel: cursore(cella(d.doc, 1, 0), 0) }, 'unisciCelle')).toBe('Seleziona due o più celle della stessa tabella da unire');
  });
  test('un\'unione che tocca un\'altra unione la ingloba (rettangolo più piccolo che le contiene)', () => {
    let s = op(seleziona(conTabella(VALORI), [1, 1], [2, 1]), 'unisciCelle');       // colonna 1, righe 1-2
    s = op(seleziona(s, [2, 0], [2, 0 + 0]), 'unisciCelle');                       // una cella sola: niente
    expect(griglia(s.doc)[2]).toBe('Bruno | · | ');
    s = op(seleziona(s, [1, 0], [1, 1]), 'unisciCelle');                           // tocca l'unione verticale: diventa 2×2
    expect(griglia(s.doc).slice(1, 3)).toEqual(['Anna/Analista/Tecnico/Bruno[2x2] | · | Unita in verticale', '· | · | ']);
    expect(controllaTabelle(s.doc)).toBeNull();
  });
  test('la tabella di Word si fa con le operazioni di pmb_docs', () => {
    expect(griglia(comeWord().doc)).toEqual(WORD);
  });
  test('righe e colonne nuove dentro un\'unione la allungano; eliminare la riga dell\'ancora passa l\'unione alla riga sotto', () => {
    const s = comeWord();
    const riga = op({ ...s, sel: cursore(cella(s.doc, 1, 0), 0) }, 'rigaSotto');
    expect(griglia(riga.doc).slice(1, 4)).toEqual(['Anna | Analista | Unita in verticale[3x1]', ' |  | ·', 'Bruno | Tecnico | ·']);
    const colonna = op({ ...s, sel: cursore(cella(s.doc, 1, 0), 0) }, 'colonnaDopo');
    expect(griglia(colonna.doc)[4 - 1]).toBe('Unita in orizzontale[1x3] | · | · | Fine');
    expect(griglia(colonna.doc)[0]).toBe('H Nome |  | Ruolo | Note');
    // eliminare la riga 1 (dove comincia l'unione verticale): l'unione passa alla riga 2, che resta unita su una sola riga
    const via = op({ ...s, sel: cursore(cella(s.doc, 1, 0), 0) }, 'eliminaRiga');
    expect(griglia(via.doc)).toEqual(['H Nome | Ruolo | Note', 'Bruno | Tecnico | ', 'Unita in orizzontale[1x2] | · | Fine']);
    // eliminare la colonna dall'ancora di un'unione orizzontale toglie tutte le colonne che copre
    const viaColonna = op({ ...s, sel: cursore(cella(s.doc, 3, 0), 0) }, 'eliminaColonna');
    expect(griglia(viaColonna.doc)).toEqual(['H Note', 'Unita in verticale[2x1]', '·', 'Fine']);
    for (const x of [riga, colonna, via, viaColonna]) expect(controllaTabelle(x.doc)).toBeNull();
  });
  test('il cursore salta le celle coperte: Tab, frecce e clic programmati non ci entrano', () => {
    const s = comeWord();
    const dopoTab = cellaVicina({ ...s, sel: cursore(cella(s.doc, 2, 1), 0) }, false);
    expect(dopoTab.doc.paragrafi[dopoTab.sel.fuoco.p].tb).toMatchObject({ r: 3, c: 0 });       // (2,2) è coperta
    const indietro = cellaVicina({ ...s, sel: cursore(cella(s.doc, 3, 2), 0) }, true);
    expect(indietro.doc.paragrafi[indietro.sel.fuoco.p].tb).toMatchObject({ r: 3, c: 0 });     // (3,1) è coperta
    // freccia a destra in fondo a «Tecnico»: il paragrafo dopo è la cella coperta (2,2), si va oltre
    const p = cella(s.doc, 2, 1);
    const ed = nuovoEditor({ ...s, sel: cursore(p, testoParagrafo(s.doc.paragrafi[p]).length) });
    const r = eseguiAzioneFormato(ed, { tipo: 'muovi', mossa: 'destra', estendi: false }).ed.storia.presente;
    expect(r.doc.paragrafi[r.sel.fuoco.p].tb).toMatchObject({ r: 3, c: 0 });
    const l = eseguiAzioneFormato(nuovoEditor({ ...s, sel: cursore(cella(s.doc, 3, 2), 0) }), { tipo: 'muovi', mossa: 'sinistra', estendi: false }).ed.storia.presente;
    expect(l.doc.paragrafi[l.sel.fuoco.p].tb).toMatchObject({ r: 3, c: 0 });
    expect(l.sel.fuoco.o).toBe('Unita in orizzontale'.length);
  });
  test('nella pagina: colspan e rowspan sull\'ancora, le celle coperte nascoste ma ancora con il loro paragrafo; la riga di intestazione marcata', () => {
    const zona = document.createElement('div');
    disegna(zona, comeWord().doc);
    const t = zona.querySelector('table')!;
    expect(Array.from(t.rows).map((r) => Array.from(r.cells).map((c) => `${c.colSpan}x${c.rowSpan}${c.classList.contains('coperta') ? '·' : ''}`))).toEqual([
      ['1x1', '1x1', '1x1'], ['1x1', '1x1', '1x2'], ['1x1', '1x1', '1x1·'], ['2x1', '1x1·', '1x1']]);
    expect(t.rows[0].classList.contains('intestazione')).toBe(true);
    expect(zona.querySelectorAll('p[data-p]').length).toBe(comeWord().doc.paragrafi.length);
  });
  test('controlli: unioni fuori posto e intestazione non in cima si rifiutano; la riparazione le sistema', () => {
    const u = (cs: number, rs: number, co = false, h = false) => ({ cs, rs, co, h });
    expect(controllaUnioni([[u(2, 1), u(1, 1, true)]])).toBeNull();
    expect(controllaUnioni([[u(3, 1), u(1, 1, true)]])).toBe('unione fuori dalla tabella');
    expect(controllaUnioni([[u(1, 1), u(1, 1, true)]])).toBe('cella coperta senza unione');
    expect(controllaUnioni([[u(1, 1)], [u(1, 1, false, true)]])).toBe('intestazione non in cima alla tabella');
    expect(riparaUnioni([[u(3, 1), u(1, 1, true)], [u(1, 1, true, true), u(1, 1)]])).toEqual([[u(1, 1), u(1, 1)], [u(1, 1), u(1, 1)]]);
    const s = comeWord();
    const rotto = { ...s.doc, paragrafi: s.doc.paragrafi.map((p, i) => (i === cella(s.doc, 2, 2) ? { ...p, tb: { ...p.tb!, co: false } } : p)) };
    expect(controllaTabelle(rotto)).not.toBeNull();
    expect(() => deserializza(serializza(rotto))).toThrow();
    expect(deserializza(serializza(s.doc))).toEqual(JSON.parse(JSON.stringify(s.doc)));
  });
});

describe('T556: riga di intestazione e ordinamento', () => {
  test('la riga del cursore diventa intestazione con quelle sopra; di nuovo, smette di esserlo con quelle sotto', () => {
    let s = conTabella(VALORI);
    s = op({ ...s, sel: cursore(cella(s.doc, 1, 0), 0) }, 'intestazione');
    expect(griglia(s.doc).map((r) => r.startsWith('H '))).toEqual([true, true, false, false]);
    s = op({ ...s, sel: cursore(cella(s.doc, 1, 0), 0) }, 'intestazione');
    expect(griglia(s.doc).map((r) => r.startsWith('H '))).toEqual([true, false, false, false]);
  });
  test('ordinare per la colonna del cursore, sotto l\'intestazione: testi come Word (albero, apple, Árbol, banana, Zeta), numeri per valore prima dei testi, vuote in fondo', () => {
    // l'ordine dei testi è quello di Word (word_tabelle.py ordina): Table.Sort alfanumerico crescente
    const valori = ['banana', '10', 'Árbol', '2', 'apple', '', 'Zeta', '1,5', 'albero', '-3'];
    let s = conTabella([['Valore', 'n'], ...valori.map((v, i) => [v, String(i)])]);
    s = op({ ...s, sel: cursore(cella(s.doc, 0, 0), 0) }, 'intestazione');
    const su = op({ ...s, sel: cursore(cella(s.doc, 3, 0), 1) }, 'ordinaCrescente');
    expect(griglia(su.doc).map((r) => r.split(' | ')[0])).toEqual(['H Valore', '-3', '1,5', '2', '10', 'albero', 'apple', 'Árbol', 'banana', 'Zeta', '']);
    expect(griglia(su.doc)[5]).toBe('albero | 8');                     // la riga si sposta intera
    expect(testoParagrafo(su.doc.paragrafi[su.sel.fuoco.p])).toBe('Árbol');   // il cursore segue la sua riga
    expect(motivoTabella(su, 'ordinaCrescente')).toBe('Le righe sono già in ordine');
    const giu = op(su, 'ordinaDecrescente');
    expect(griglia(giu.doc).map((r) => r.split(' | ')[0])).toEqual(['H Valore', 'Zeta', 'banana', 'Árbol', 'apple', 'albero', '10', '2', '1,5', '-3', '']);
    // con celle unite in verticale non si ordina; in orizzontale sì (conta il testo dell'ancora)
    expect(motivoTabella({ ...comeWord(), sel: cursore(cella(comeWord().doc, 1, 0), 0) }, 'ordinaCrescente')).toBe('Non si possono ordinare righe con celle unite in verticale');
    let o = op(seleziona(conTabella([['b', 'x'], ['a', 'y'], ['c', 'z']]), [2, 0], [2, 1]), 'unisciCelle');
    o = op({ ...o, sel: cursore(cella(o.doc, 0, 0), 0) }, 'ordinaCrescente');
    expect(griglia(o.doc)).toEqual(['a | y', 'b | x', 'c/z[1x2] | ·']);
  });
});

describe('T556: .docx e .odt come Word e LibreOffice', () => {
  test('la tabella di Word: gridSpan, vMerge e tblHeader si leggono come celle unite e riga di intestazione', async () => {
    const d = await importaDocx(new Uint8Array(fs.readFileSync('tests/file-prova/tabelle/word-tabelle.docx')));
    expect(griglia(d)).toEqual(WORD);
    expect(controllaTabelle(d)).toBeNull();
  });
  test('la stessa tabella convertita da LibreOffice: number-columns/rows-spanned, covered-table-cell e table-header-rows', async () => {
    const d = await importaOdt(new Uint8Array(fs.readFileSync('tests/file-prova/tabelle/libreoffice-tabelle.odt')));
    expect(griglia(d)).toEqual(WORD);
    expect(controllaTabelle(d)).toBeNull();
  });
  test('scritta da pmb_docs in .docx come la scrive Word, e riletta uguale', async () => {
    const s = comeWord();
    const bytes = await esportaDocx(s.doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T556.docx'), bytes);
    const { leggiZip } = await import('@comune/formati/zip');
    const voci = await leggiZip(bytes);
    const xml = new TextDecoder().decode(voci.get('word/document.xml')!);
    expect(xml).toContain('<w:trPr><w:tblHeader/></w:trPr>');
    expect(xml).toContain('<w:gridSpan w:val="2"/>');
    expect(xml).toContain('<w:vMerge w:val="restart"/>');
    expect((xml.match(/<w:vMerge\/>/g) ?? []).length).toBe(1);
    expect((xml.match(/<w:tc>/g) ?? []).length).toBe(11);            // 12 celle meno quella coperta in orizzontale
    const r = await importaDocx(bytes);
    expect(griglia(r)).toEqual(WORD);
  });
  test('scritta da pmb_docs in .odt come la scrive LibreOffice, e riletta uguale', async () => {
    const bytes = await esportaOdt(comeWord().doc);
    fs.writeFileSync(path.join(os.tmpdir(), 'pmb-T556.odt'), bytes);
    const { leggiZip } = await import('@comune/formati/zip');
    const voci = await leggiZip(bytes);
    const xml = new TextDecoder().decode(voci.get('content.xml')!);
    expect(xml).toMatch(/<table:table-header-rows><table:table-row>.*?Nome.*?<\/table:table-row><\/table:table-header-rows>/);
    expect(xml).toContain('table:number-rows-spanned="2"');
    expect(xml).toContain('table:number-columns-spanned="2"');
    expect((xml.match(/<table:covered-table-cell\/>/g) ?? []).length).toBe(2);
    expect(griglia(await importaOdt(bytes))).toEqual(WORD);
  });
});
