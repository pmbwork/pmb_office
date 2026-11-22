// T534: stampa di pmb_sheets (lotto 3 del piano delle funzioni, 2026-11-18), scritta per pmb_office: impostazione di pagina per foglio
// (carta, orientamento, margini, scala o adatta a pagine, intestazione e piè di pagina, area di stampa, righe e colonne ripetute, griglia,
// intestazioni, centratura, ordine, interruzioni a mano), stampa e PDF a più pagine con lo stesso piano, salvataggio in .psheet, .xlsx e .ods.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import '../../src/components/dialogo-imposta-pagina';
import {
  alternaInterruzione, eDiPartenza, impagina, leggiAreaStampa, leggiColonne, leggiRighe, paginaPredefinita, ripulisciPagina, scriviColonne, scriviRighe,
  sostituisciCampi, zonaUtile, type ImpostaPagina,
} from '../../src/sheet/pagina';
import { paginaDopoStruttura } from '../../src/sheet/sposta-struttura';
import { pianoDiStampa, testoDaStampare, valoreDaScambio } from '../../src/formati/piano-stampa';
import { esportaPdf } from '../../src/formati/pdf';
import { foglioVuoto, documentoDaScambio, scambioDaDocumento, type FoglioScambio, type Scambio } from '../../src/formati/scambio';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { scriviOds, avvisiScritturaOds } from '../../src/formati/ods-scrivi';
import { leggiOds } from '../../src/formati/ods-leggi';
import { leggiMargineExcel, margineExcel } from '../../src/formati/xlsx-pagina';
import { deserializeSheetDocumentData, serializeSheetDocumentData } from '../../src/sheet/document-data';
import { defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { menuRegistry } from '../../src/registry/menu';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const pagina = (x: Partial<ImpostaPagina> = {}): ImpostaPagina => ({ ...paginaPredefinita(), ...x });
const ctx = { file: 'Bilancio.psheet', adesso: new Date(2026, 10, 18, 9, 30), locale: 'it-IT' };
const testo = (f: FoglioScambio) => (r: number, c: number) => {
  const ind = `${String.fromCharCode(64 + c)}${r}`;
  return testoDaStampare(valoreDaScambio(f, ind));
};
/** Un foglio con n righe di dati in A e B. */
function foglioDi(n: number, extra: Partial<FoglioScambio> = {}): FoglioScambio {
  const celle: Record<string, string> = { A1: 'Voce', B1: 'Importo' };
  for (let r = 2; r <= n; r++) { celle[`A${r}`] = `riga ${r}`; celle[`B${r}`] = String(r * 10); }
  return { ...foglioVuoto('Conti'), celle, ...extra };
}

describe('T534: impostazione di pagina (modulo puro)', () => {
  it('di partenza: A4 verticale, margini 15 mm, adatta in larghezza a una pagina, intestazione col nome del foglio e numeri di pagina', () => {
    const p = paginaPredefinita();
    expect([p.formato, p.orientamento, p.margini, p.adatta]).toEqual(['A4', 'verticale', { alto: 15, basso: 15, sinistro: 15, destro: 15 }, { larghezza: 1, altezza: 0 }]);
    expect(p.intestazione.centro).toBe('&[Foglio]');
    expect(p.pie.centro).toBe('&[Pagina] / &[Pagine]');
    expect(eDiPartenza(p)).toBe(true);
    expect(Math.round(zonaUtile(p).larghezza)).toBe(680);
  });
  it('ripulisce i valori sbagliati letti da un file', () => {
    const p = ripulisciPagina({ formato: 'B5', orientamento: 'storto', scala: 9999, margini: { alto: -3, basso: 20 }, adatta: { larghezza: 0, altezza: 0 }, interruzioniRighe: [1, 5, 5, 'x', 3], intestazione: { centro: 'a\u0001b' } });
    expect(p.formato).toBe('A4');
    expect(p.orientamento).toBe('verticale');
    expect(p.scala).toBe(100);
    expect(p.margini).toEqual({ alto: 15, basso: 20, sinistro: 15, destro: 15 });
    expect(p.adatta).toBeNull();
    expect(p.interruzioniRighe).toEqual([3, 5]);
    expect(p.intestazione.centro).toBe('ab');
  });
  it('campi di intestazione e piè di pagina', () => {
    const v = { pagina: 2, pagine: 5, foglio: 'Conti', file: 'Bilancio.psheet', data: '18/11/2026', ora: '09:30' };
    expect(sostituisciCampi('Pagina &[Pagina] di &[Pagine] — &[Foglio] (&[File]) &[Data] &[Ora]', v)).toBe('Pagina 2 di 5 — Conti (Bilancio.psheet) 18/11/2026 09:30');
    expect(sostituisciCampi('Rossi && Bianchi', v)).toBe('Rossi & Bianchi');
  });
  it('righe, colonne e area scritte dall’utente', () => {
    expect(leggiRighe('1:2')).toEqual({ da: 1, a: 2 });
    expect(leggiRighe('$3')).toEqual({ da: 3, a: 3 });
    expect(leggiRighe('2:1')).toEqual({ da: 1, a: 2 });
    expect(leggiRighe('')).toBeUndefined();
    expect(leggiRighe('A:B')).toBeNull();
    expect(leggiColonne('$A:$C')).toEqual({ da: 1, a: 3 });
    expect(leggiColonne('1:2')).toBeNull();
    expect(scriviRighe({ da: 1, a: 2 })).toBe('1:2');
    expect(scriviColonne({ da: 1, a: 3 })).toBe('A:C');
    expect(leggiAreaStampa('b2:$D$9')).toEqual({ startRow: 2, endRow: 9, startCol: 2, endCol: 4 });
    expect(leggiAreaStampa('nonvalida')).toBeNull();
    expect(alternaInterruzione([5], 5)).toEqual([]);
    expect(alternaInterruzione([5], 3)).toEqual([3, 5]);
  });
});

describe('T534: divisione in pagine', () => {
  const dati = (righe: number, colonne: number, alt = 21, larg = 100) => ({ area: { startRow: 1, endRow: righe, startCol: 1, endCol: colonne }, altezza: () => alt, larghezza: () => larg });
  it('scala fissa al 100%: le righe vanno a capo pagina quando non stanno più', () => {
    const imp = impagina(dati(100, 2), pagina({ adatta: null, scala: 100 }));
    const h = zonaUtile(pagina()).altezza;
    expect(imp.scala).toBe(1);
    expect(imp.pagine[0].righe.length).toBe(Math.floor(h / 21));
    expect(imp.pagine.flatMap((p) => p.righe).length).toBe(100);
  });
  it('adatta a 1 × 1 pagina: tutto in una pagina, ridotto quanto basta', () => {
    const imp = impagina(dati(100, 12), pagina({ adatta: { larghezza: 1, altezza: 1 } }));
    expect(imp.pagine.length).toBe(1);
    expect(imp.scala).toBeLessThan(1);
    expect(imp.scala).toBeGreaterThan(0.4);
  });
  it('adatta a 1 pagina in larghezza: le colonne entrano, le righe continuano su più pagine', () => {
    const imp = impagina(dati(200, 12), pagina());
    expect(imp.colonnePagine).toBe(1);
    expect(imp.righePagine).toBeGreaterThan(1);
  });
  it('righe ripetute in cima alle pagine dopo la prima', () => {
    const imp = impagina(dati(100, 2), pagina({ adatta: null, righeRipetute: { da: 1, a: 1 } }));
    expect(imp.pagine[0].righeRipetute).toBe(0);
    expect(imp.pagine[1].righe[0]).toBe(1);
    expect(imp.pagine[1].righeRipetute).toBe(1);
    // ogni riga di dati compare una volta sola
    const dopo = imp.pagine.flatMap((p) => p.righe.slice(p.righeRipetute));
    expect(new Set(dopo).size).toBe(100);
  });
  it('interruzioni a mano e righe nascoste', () => {
    const imp = impagina({ ...dati(10, 2), altezza: (r: number) => (r === 3 ? 0 : 21) }, pagina({ adatta: null, interruzioniRighe: [6] }));
    expect(imp.pagine.map((p) => p.righe)).toEqual([[1, 2, 4, 5], [6, 7, 8, 9, 10]]);
  });
  it('ordine: prima in giù poi a destra, oppure prima a destra', () => {
    const p = pagina({ adatta: null, interruzioniRighe: [3], interruzioniColonne: [2] });
    const giu = impagina(dati(4, 2), p).pagine.map((x) => [x.righe[0], x.colonne[0]]);
    const destra = impagina(dati(4, 2), { ...p, ordine: 'destra' }).pagine.map((x) => [x.righe[0], x.colonne[0]]);
    expect(giu).toEqual([[1, 1], [3, 1], [1, 2], [3, 2]]);
    expect(destra).toEqual([[1, 1], [1, 2], [3, 1], [3, 2]]);
  });
  it('righe e colonne inserite o eliminate spostano area, titoli e interruzioni', () => {
    const p = pagina({ area: { startRow: 2, endRow: 10, startCol: 1, endCol: 3 }, righeRipetute: { da: 2, a: 2 }, interruzioniRighe: [5, 8] });
    const ins = paginaDopoStruttura(p, { tipo: 'insert_rows', indice: 1, conta: 2 });
    expect(ins.area).toEqual({ startRow: 4, endRow: 12, startCol: 1, endCol: 3 });
    expect(ins.righeRipetute).toEqual({ da: 4, a: 4 });
    expect(ins.interruzioniRighe).toEqual([7, 10]);
    const del = paginaDopoStruttura(p, { tipo: 'delete_rows', indice: 2, conta: 1 });
    expect(del.righeRipetute).toBeUndefined();
    expect(del.interruzioniRighe).toEqual([4, 7]);
    const col = paginaDopoStruttura(p, { tipo: 'delete_cols', indice: 1, conta: 3 });
    expect(col.area).toBeUndefined();
  });
});

describe('T534: piano di stampa e PDF', () => {
  it('le pagine hanno intestazione e piè di pagina con i numeri giusti', () => {
    const f = foglioDi(120, { pagina: pagina({ adatta: null, pie: { sinistra: '&[File]', centro: 'Pagina &[Pagina] di &[Pagine]', destra: '' } }) });
    const piano = pianoDiStampa(f, testo(f), ctx)!;
    expect(piano.pagine.length).toBeGreaterThan(1);
    const n = piano.pagine.length;
    expect(piano.pagine[0].intestazione.centro).toBe('Conti');
    expect(piano.pagine[n - 1].pie).toEqual({ sinistra: 'Bilancio.psheet', centro: `Pagina ${n} di ${n}`, destra: '' });
  });
  it('l’area di stampa limita ciò che si stampa', () => {
    const f = foglioDi(30, { pagina: pagina({ area: { startRow: 5, endRow: 7, startCol: 2, endCol: 2 } }) });
    const piano = pianoDiStampa(f, testo(f), ctx)!;
    expect(piano.pagine.length).toBe(1);
    expect(piano.pagine[0].celle.map((r) => r.map((c) => c.testo))).toEqual([['50'], ['60'], ['70']]);
  });
  it('la griglia mette un bordo grigio alle celle senza bordo', () => {
    const f = foglioDi(2, { pagina: pagina({ griglia: true }) });
    expect(pianoDiStampa(f, testo(f), ctx)!.pagine[0].celle[0][0].stile.borderTop).toBe('1px solid #c0c0c0');
  });
  it('il PDF ha una pagina per ogni pagina del piano, i risultati delle formule (non le formule) e l’orientamento scelto', () => {
    const f = foglioDi(120, { pagina: pagina({ adatta: null, orientamento: 'orizzontale' }) });
    f.celle.C1 = '=SUM(B2:B3)';
    f.calcolati = { C1: { tipo: 'n', valore: '50' } };
    const s: Scambio = { fogli: [f], foglioAttivo: 'Conti' };
    const pdf = new TextDecoder('latin1').decode(esportaPdf(s, { file: 'Bilancio.psheet', adesso: ctx.adesso }));
    const piano = pianoDiStampa(f, testo(f), ctx)!;
    expect(pdf).toContain(`/Count ${piano.pagine.length}`);
    expect((pdf.match(/\/Type \/Page /g) ?? []).length).toBe(piano.pagine.length);
    expect(pdf).toContain('(50) Tj');
    expect(pdf).not.toContain('SUM');
    expect(pdf).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(pdf).toContain('(Conti) Tj');
    expect(pdf.trim().endsWith('%%EOF')).toBe(true);
  });
});

describe('T534: salvataggio', () => {
  const completa = (): ImpostaPagina => pagina({
    formato: 'A3', orientamento: 'orizzontale', margini: { alto: 20, basso: 25, sinistro: 10, destro: 12 }, adatta: null, scala: 80,
    area: { startRow: 1, endRow: 20, startCol: 1, endCol: 2 }, righeRipetute: { da: 1, a: 1 }, colonneRipetute: { da: 1, a: 1 },
    intestazione: { sinistra: 'Ditta & figli', centro: '&[Foglio]', destra: '&[Data]' }, pie: { sinistra: '', centro: 'Pagina &[Pagina] di &[Pagine]', destra: '&[File]' },
    griglia: true, intestazioniRigheColonne: true, centraOrizzontale: true, centraVerticale: false, ordine: 'destra', interruzioniRighe: [10], interruzioniColonne: [2],
  });
  it('.psheet: la pagina di ogni foglio va e torna (anche dei fogli non attivi)', () => {
    const s: Scambio = { fogli: [foglioDi(20, { pagina: completa() }), { ...foglioDi(3), nome: 'Altro', pagina: pagina({ scala: 50, adatta: null }) }], foglioAttivo: 'Altro' };
    const dati = deserializeSheetDocumentData(serializeSheetDocumentData(documentoDaScambio(s)));
    const ritorno = scambioDaDocumento(dati);
    expect(ritorno.fogli[0].pagina).toEqual(completa());
    expect(ritorno.fogli[1].pagina?.scala).toBe(50);
  });
  it('.xlsx: tutto va e torna, comprese area di stampa, titoli e interruzioni', async () => {
    const s: Scambio = { fogli: [foglioDi(20, { pagina: completa() })], foglioAttivo: 'Conti' };
    const bytes = await scriviXlsx(s);
    const letto = await leggiXlsx(bytes);
    expect(letto.scambio.fogli[0].pagina).toEqual(completa());
  });
  it('.xlsx: adatta a pagine e intestazione nel formato di Excel', async () => {
    const p = pagina({ adatta: { larghezza: 1, altezza: 2 } });
    const letto = await leggiXlsx(await scriviXlsx({ fogli: [foglioDi(5, { pagina: { ...p, intestazione: { sinistra: 'x', centro: '', destra: '' } } })], foglioAttivo: 'Conti' }));
    expect(letto.scambio.fogli[0].pagina?.adatta).toEqual({ larghezza: 1, altezza: 2 });
    expect(margineExcel({ sinistra: 'Pag. &[Pagina]', centro: 'A && B', destra: '' })).toBe('&LPag. &P&CA && B');
    expect(leggiMargineExcel('&L&"Arial,Bold"&12Ditta&CPagina &P di &N&R&D')).toEqual({ sinistra: 'Ditta', centro: 'Pagina &[Pagina] di &[Pagine]', destra: '&[Data]' });
  });
  it('un foglio con la pagina di partenza non scrive niente di pagina nel file', async () => {
    const bytes = await scriviXlsx({ fogli: [foglioDi(5)], foglioAttivo: 'Conti' });
    expect((await leggiXlsx(bytes)).scambio.fogli[0].pagina).toBeUndefined();
  });
  it('.ods: carta, margini, scala, intestazione, griglia, ordine e area vanno e tornano; titoli e interruzioni no, e lo si dice', async () => {
    const s: Scambio = { fogli: [foglioDi(20, { pagina: completa() })], foglioAttivo: 'Conti' };
    const letto = await leggiOds(await scriviOds(s));
    const atteso = { ...completa(), interruzioniRighe: [], interruzioniColonne: [] };
    delete (atteso as Partial<ImpostaPagina>).righeRipetute;
    delete (atteso as Partial<ImpostaPagina>).colonneRipetute;
    expect(letto.scambio.fogli[0].pagina).toEqual(atteso);
    expect(avvisiScritturaOds(s).some((a) => a.includes('OpenDocument') && a.includes('Conti'))).toBe(true);
  });
});

describe('T534: nell’app', () => {
  type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot; stampa(): Promise<void> };
  let app: App;
  beforeEach(async () => {
    document.body.innerHTML = '';
    defaultDocumentStore.clear();
    app = document.createElement('free-app') as App;
    document.body.appendChild(app);
    await app.updateComplete;
  });
  afterEach(() => { vi.restoreAllMocks(); document.getElementById('pmb-sheets-pagina-stampa')?.remove(); });
  const dentro = (): any => app as any;
  const doc = (): SheetDocument => defaultDocumentStore.getOrCreateDocument(dentro().activeTabId);
  const griglia = (): any => app.renderRoot.querySelector('free-sheet-grid');
  const menu = async (action: string): Promise<void> => {
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label: action }, bubbles: true, composed: true }));
    await attendi(40); await app.updateComplete;
  };
  const riempi = async (n: number): Promise<void> => { for (let r = 1; r <= n; r++) { await doc().client.setCell(doc().activeSheetName, r, 1, `riga ${r}`); } };

  it('le voci sono nei menu File e Inserisci', () => {
    const azioni = (id: string): string[] => menuRegistry.find((m) => m.id === id)!.items.flatMap((i) => [i.action, ...(i.subitems ?? []).map((s) => s.action)]).filter(Boolean) as string[];
    expect(azioni('file')).toEqual(expect.arrayContaining(['page-setup', 'print-preview', 'print-area-set', 'print-area-clear', 'print']));
    expect(azioni('insert')).toEqual(expect.arrayContaining(['page-break-row', 'page-break-col', 'page-breaks-clear']));
  });
  it('area di stampa dalla selezione e interruzioni dal menu, annullabili', async () => {
    await riempi(10);
    const g = griglia();
    g.selectSingle(2, 1); g.extendSelectionTo(5, 1);
    await menu('print-area-set');
    expect(g.paginaAttiva().area).toEqual({ startRow: 2, endRow: 5, startCol: 1, endCol: 1 });
    expect(dentro().statusMessage).toBe('Area di stampa: A2:A5');
    g.selectSingle(4, 1);
    await menu('page-break-row');
    expect(g.paginaAttiva().interruzioniRighe).toEqual([4]);
    await g.undo();
    expect(g.paginaAttiva().interruzioniRighe).toEqual([]);
    await g.undo();
    expect(g.paginaAttiva().area).toBeUndefined();
    g.selectSingle(1, 1);
    await menu('page-break-row');
    expect(dentro().statusMessage).toMatch(/riga 1/);
  });
  it('Imposta pagina: la finestra mostra la pagina del foglio e OK la cambia', async () => {
    await riempi(3);
    await menu('page-setup');
    const d: any = app.renderRoot.querySelector('free-dialogo-imposta-pagina');
    expect(d).toBeTruthy();
    await d.updateComplete;
    (d.shadowRoot.querySelector('input[data-campo="orizzontale"]') as HTMLInputElement).click();
    (d.shadowRoot.querySelector('button[data-scheda="foglio"]') as HTMLButtonElement).click();
    await d.updateComplete;
    const righe = d.shadowRoot.querySelector('input[data-campo="righe"]') as HTMLInputElement;
    righe.value = '1:1'; righe.dispatchEvent(new Event('input'));
    (d.shadowRoot.querySelector('input[data-campo="griglia"]') as HTMLInputElement).click();
    await d.updateComplete;
    (d.shadowRoot.querySelector('button[data-azione="ok"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-imposta-pagina')).toBeNull();
    const p = griglia().paginaAttiva();
    expect([p.orientamento, p.righeRipetute, p.griglia]).toEqual(['orizzontale', { da: 1, a: 1 }, true]);
  });
  it('Imposta pagina: un valore sbagliato non chiude la finestra e lo dice', async () => {
    await riempi(3);
    await menu('page-setup');
    const d: any = app.renderRoot.querySelector('free-dialogo-imposta-pagina');
    await d.updateComplete;
    (d.shadowRoot.querySelector('button[data-scheda="foglio"]') as HTMLButtonElement).click();
    await d.updateComplete;
    const area = d.shadowRoot.querySelector('input[data-campo="area"]') as HTMLInputElement;
    area.value = 'zzz'; area.dispatchEvent(new Event('input'));
    (d.shadowRoot.querySelector('button[data-azione="ok"]') as HTMLButtonElement).click();
    await d.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-imposta-pagina')).toBeTruthy();
    expect(d.shadowRoot.querySelector('.errore').textContent).toContain('A1:F40');
  });
  it('stampa: una pagina di carta per pagina, intestazione col nome del foglio, @page con la carta scelta; poi tutto si toglie', async () => {
    await riempi(120);
    griglia().impostaPaginaAttiva({ ...paginaPredefinita(), adatta: null, orientamento: 'orizzontale' });
    let pagine = 0, testa = '', regola = '';
    vi.spyOn(window, 'print').mockImplementation(() => {
      pagine = app.renderRoot.querySelectorAll('.stampa .stampa-pagina').length;
      testa = (app.renderRoot.querySelector('.stampa .stampa-margine') as HTMLElement).textContent ?? '';
      regola = document.getElementById('pmb-sheets-pagina-stampa')?.textContent ?? '';
    });
    await app.stampa();
    expect(pagine).toBeGreaterThan(1);
    expect(testa).toContain(doc().activeSheetName);
    expect(regola).toContain('297mm 210mm');
    window.dispatchEvent(new Event('afterprint'));
    await app.updateComplete;
    expect(document.getElementById('pmb-sheets-pagina-stampa')).toBeNull();
    expect(app.renderRoot.querySelector('.stampa')).toBeNull();
  });
  it('anteprima di stampa: mostra le pagine e il loro numero; Esc la chiude', async () => {
    await riempi(5);
    await menu('print-preview');
    const a = app.renderRoot.querySelector('.anteprima') as HTMLElement;
    expect(a).toBeTruthy();
    expect(a.querySelectorAll('.stampa-pagina').length).toBe(1);
    expect(a.querySelector('[data-campo="conta-pagine"]')!.textContent).toContain('1 pagina');
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.updateComplete;
    expect(app.renderRoot.querySelector('.anteprima')).toBeNull();
  });
});
