// T563: novità del 2026-11-21 in pmb_sheets: Raggruppa e struttura (sheet/gruppi.ts, .xlsx come Excel e .ods come LibreOffice:
// file di confronto in tests/file-prova/gruppi/, fatti con LAVORO/studio-microsoft-office/excel_gruppi.py e convertiti in .ods da LibreOffice)
// e Valuta formula (i passi del calcolo dal motore vero).
import fs from 'node:fs';
import { describe, expect, test } from 'vitest';
import { gruppoDi, gruppiValidi, intervalliDelLivello, livelloMassimo, raggruppa, separa } from '../../src/sheet/gruppi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiOds } from '../../src/formati/ods-leggi';
import { scriviOds } from '../../src/formati/ods-scrivi';
import { foglioVuoto, type Scambio } from '../../src/formati/scambio';
import { spostaDatiAccessori } from '../../src/sheet/sposta-struttura';
import { InlineEngineClient } from '../../src/sheet/engine-client';
import { DocumentStore } from '../../src/sheet/document-store';

const CARTELLA = 'tests/file-prova/gruppi';
const leggi = (n: string): Uint8Array => new Uint8Array(fs.readFileSync(`${CARTELLA}/${n}`));
// la struttura fatta da Excel: righe 2-6 livello 1, 3-4 livello 2 (compresse), colonne B-C livello 1
const RIGHE = { 2: 1, 3: 2, 4: 2, 5: 1, 6: 1 };
const COLONNE = { 2: 1, 3: 1 };

describe('T563: gruppi (modulo)', () => {
  test('raggruppa alza di un livello fino a 7, separa abbassa e toglie; i gruppi annidati si trovano', () => {
    let g = raggruppa(undefined, 'righe', 2, 6);
    g = raggruppa(g, 'righe', 4, 3);
    expect(g.righe).toEqual(RIGHE);
    expect(gruppoDi(g, 'righe', 3)).toEqual({ da: 3, a: 4, livello: 2 });
    expect(gruppoDi(g, 'righe', 6)).toEqual({ da: 2, a: 6, livello: 1 });
    expect(gruppoDi(g, 'righe', 7)).toBeNull();
    expect(intervalliDelLivello(g, 'righe', 1)).toEqual([[2, 6]]);
    expect(intervalliDelLivello(g, 'righe', 2)).toEqual([[3, 4]]);
    expect(livelloMassimo(g, 'righe')).toBe(2);
    for (let i = 0; i < 10; i++) g = raggruppa(g, 'colonne', 1, 1);
    expect(g.colonne[1]).toBe(7);
    expect(separa(g, 'righe', 8, 9)).toBeNull();
    const s = separa(g, 'righe', 2, 6)!;
    expect(s.righe).toEqual({ 3: 1, 4: 1 });
  });
  test('dati sbagliati da un file si scartano', () => {
    expect(gruppiValidi({ righe: { 0: 1, 2: 9, 3: 1.5, x: 1, 4: 2 }, colonne: { 16385: 1 } })).toEqual({ righe: { 4: 2 }, colonne: {} });
    expect(gruppiValidi('no')).toBeUndefined();
    expect(gruppiValidi({ righe: {}, colonne: {} })).toBeUndefined();
  });
  test('inserire o eliminare righe sposta i gruppi', () => {
    const doc: any = new DocumentStore().getOrCreateDocument('t563', 'T563', () => new InlineEngineClient());
    doc.gruppi = { righe: { ...RIGHE }, colonne: { ...COLONNE } };
    spostaDatiAccessori(doc, { tipo: 'insert_rows', indice: 1, conta: 2 });
    expect(doc.gruppi.righe).toEqual({ 4: 1, 5: 2, 6: 2, 7: 1, 8: 1 });
    spostaDatiAccessori(doc, { tipo: 'delete_cols', indice: 2, conta: 1 });
    expect(doc.gruppi.colonne).toEqual({ 2: 1 });
  });
});

describe('T563: gruppi nei file', () => {
  test('.xlsx di Excel: livelli e righe compresse', async () => {
    const f = (await leggiXlsx(leggi('gruppi_excel.xlsx'))).scambio.fogli[0];
    expect(f.gruppi).toEqual({ righe: RIGHE, colonne: COLONNE });
    expect(f.righeNascoste).toEqual([3, 4]);
  });
  test('.ods di LibreOffice: gruppi annidati e compressi', async () => {
    const f = (await leggiOds(leggi('gruppi_libreoffice.ods'))).scambio.fogli[0];
    expect(f.gruppi).toEqual({ righe: RIGHE, colonne: COLONNE });
    expect(f.righeNascoste).toEqual([3, 4]);
  });
  const nostro = (): Scambio => {
    const f = foglioVuoto('Foglio1');
    for (let r = 1; r <= 8; r++) f.celle[`A${r}`] = { valore: `r${r}` } as any;
    f.gruppi = { righe: { ...RIGHE }, colonne: { ...COLONNE } };
    f.righeNascoste = [3, 4];
    return { fogli: [f], foglioAttivo: 'Foglio1' };
  };
  test('.xlsx scritto da noi: outlineLevel su righe e colonne, sheetFormatPr col livello massimo; si rilegge uguale', async () => {
    const b = await scriviXlsx(nostro());
    fs.writeFileSync(`${CARTELLA}/gruppi_pmb.xlsx`, b);
    const f = (await leggiXlsx(b)).scambio.fogli[0];
    expect(f.gruppi).toEqual({ righe: RIGHE, colonne: COLONNE });
    expect(f.righeNascoste).toEqual([3, 4]);
  });
  test('.ods scritto da noi: table-row-group annidati, quello compresso con table:display="false"; si rilegge uguale', async () => {
    const b = await scriviOds(nostro());
    fs.writeFileSync(`${CARTELLA}/gruppi_pmb.ods`, b);
    const { leggiZip } = await import('@comune/formati/zip');
    const voci = await leggiZip(b);
    const content = new TextDecoder().decode((voci as any).get ? (voci as any).get('content.xml') : (voci as any)['content.xml']);
    expect(content).toMatch(/<table:table-row-group><table:table-row[^>]*>.*?<table:table-row-group table:display="false">/s);
    expect(content).toContain('<table:table-column-group>');
    const f = (await leggiOds(b)).scambio.fogli[0];
    expect(f.gruppi).toEqual({ righe: RIGHE, colonne: COLONNE });
    expect(f.righeNascoste).toEqual([3, 4]);
  });
});

describe('T563: valuta formula', () => {
  test('i passi di =SUM(A1:A2)*2 dal motore vero, dal più interno', async () => {
    const c = new InlineEngineClient();
    const f = (await c.listSheets())[0];
    await c.setCell(f, 1, 1, '3');
    await c.setCell(f, 2, 1, '4');
    await c.setCell(f, 1, 2, '=SUM(A1:A2)*2');
    const passi = await c.valutaPassi(f, 1, 2, '=SUM(A1:A2)*2');
    expect(passi.length).toBeGreaterThan(0);
    const ultimo = passi[passi.length - 1];
    expect(ultimo.valore).toEqual({ kind: 'number', value: 14 });
    expect(passi.map((p) => p.testo)).toContain('SUM(A1:A2)');
    expect(passi.find((p) => p.testo === 'SUM(A1:A2)')?.valore).toEqual({ kind: 'number', value: 7 });
  });
});
