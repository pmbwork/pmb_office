import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/dialogo-regole';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';
import { evaluateConditionalFormats, percentileOrdinati, statisticheNumeri, valoreSoglia, type ConditionalFormatRule } from '../../src/sheet/conditional-format';
import { creaRegolaCondizionale, datiDaRegola, descriviRegola, type DatiCondizionale } from '../../src/sheet/regole-dialogo';
import { scriviXlsx } from '../../src/formati/xlsx-scrivi';
import { leggiXlsx } from '../../src/formati/xlsx-leggi';
import { foglioVuoto, type Scambio } from '../../src/formati/scambio';

const R = { startRow: 1, endRow: 5, startCol: 1, endCol: 1 };
const base: DatiCondizionale = { intervallo: 'A1:A5', condizione: 'scala-2', valore1: '', valore2: '', sfondo: '', testo: '', grassetto: false, coloreMin: '#000000', coloreMid: '#808080', coloreMax: '#ffffff' };

describe('T521: soglie (parte pura)', () => {
  const st = statisticheNumeri([10, 20, 30, 40, 1000])!;
  it('percentile come PERCENTILE.INCL di Excel', () => {
    expect(percentileOrdinati([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentileOrdinati([1, 2, 3, 4], 0)).toBe(1);
    expect(percentileOrdinati([1, 2, 3, 4], 100)).toBe(4);
    expect(percentileOrdinati([7], 30)).toBe(7);
  });
  it('ogni tipo di soglia dà il suo numero', () => {
    expect(valoreSoglia(undefined, { tipo: 'min' }, st)).toBe(10);
    expect(valoreSoglia({ tipo: 'numero', valore: 25 }, { tipo: 'min' }, st)).toBe(25);
    expect(valoreSoglia({ tipo: 'percentuale', valore: 10 }, { tipo: 'min' }, st)).toBe(109);
    expect(valoreSoglia({ tipo: 'percentile', valore: 50 }, { tipo: 'min' }, st)).toBe(30);
    // senza l'elenco dei valori il percentile si legge come percentuale
    expect(valoreSoglia({ tipo: 'percentile', valore: 50 }, { tipo: 'min' }, { min: 0, max: 100, count: 3 })).toBe(50);
  });
  it('scala con soglie a numero: sotto il minimo e sopra il massimo i colori estremi', () => {
    const r: ConditionalFormatRule[] = [{ id: 's', type: 'color_scale', range: R, colorScale: { minColor: '#000000', maxColor: '#ffffff', soglie: { min: { tipo: 'numero', valore: 20 }, max: { tipo: 'numero', valore: 40 } } } }];
    expect(evaluateConditionalFormats('10', 1, 1, r, st)!.backgroundColor).toBe('#000000');
    expect(evaluateConditionalFormats('30', 1, 1, r, st)!.backgroundColor).toBe('#808080');
    expect(evaluateConditionalFormats('1000', 1, 1, r, st)!.backgroundColor).toBe('#ffffff');
  });
  it('il punto medio di partenza è il 50° percentile: un valore isolato molto alto non schiaccia la scala', () => {
    const r: ConditionalFormatRule[] = [{ id: 's', type: 'color_scale', range: R, colorScale: { minColor: '#000000', midColor: '#ff0000', maxColor: '#ffffff' } }];
    expect(evaluateConditionalFormats('30', 1, 1, r, st)!.backgroundColor).toBe('#ff0000');
  });
  it('barra dati con massimo fissato a 50: 40 è all\'80 %, 1000 è piena', () => {
    const r: ConditionalFormatRule[] = [{ id: 'b', type: 'data_bar', range: R, dataBar: { color: '#0000ff', soglie: { min: { tipo: 'numero', valore: 0 }, max: { tipo: 'numero', valore: 50 } } } }];
    expect(evaluateConditionalFormats('40', 1, 1, r, st)!.dataBar!.percent).toBe(80);
    expect(evaluateConditionalFormats('1000', 1, 1, r, st)!.dataBar!.percent).toBe(100);
  });
});

describe('T521: le regole si combinano come in Excel', () => {
  const st = { min: 0, max: 100, count: 2 };
  const rosso: ConditionalFormatRule = { id: 'r', type: 'cell_value', range: R, operator: 'greater_than', value1: 10, style: { backgroundColor: '#ff0000' } };
  const verde: ConditionalFormatRule = { id: 'v', type: 'cell_value', range: R, operator: 'greater_than', value1: 10, style: { backgroundColor: '#00ff00', bold: true } };
  const barra: ConditionalFormatRule = { id: 'b', type: 'data_bar', range: R, dataBar: { color: '#0000ff' } };
  it('sfondo e barra insieme', () => {
    expect(evaluateConditionalFormats('50', 1, 1, [rosso, barra], st)).toEqual({ backgroundColor: '#ff0000', dataBar: { percent: 50, color: '#0000ff' } });
  });
  it('lo stesso effetto: vince la prima; gli effetti diversi si sommano', () => {
    expect(evaluateConditionalFormats('50', 1, 1, [rosso, verde], st)).toEqual({ backgroundColor: '#ff0000', bold: true });
    expect(evaluateConditionalFormats('50', 1, 1, [verde, rosso], st)).toEqual({ backgroundColor: '#00ff00', bold: true });
  });
  it('se nessuna vale: null', () => {
    expect(evaluateConditionalFormats('5', 1, 1, [rosso, verde], st)).toBeNull();
  });
});

describe('T521: soglie scritte nel dialogo', () => {
  it('quelle di partenza non si salvano nella regola', () => {
    const e = creaRegolaCondizionale({ ...base, soglie: { min: { tipo: 'min', valore: '' }, max: { tipo: 'max', valore: '' } } }, 'x');
    expect(e.ok && e.valore.colorScale).toEqual({ minColor: '#000000', maxColor: '#ffffff' });
    const tre = creaRegolaCondizionale({ ...base, condizione: 'scala-3', soglie: { mid: { tipo: 'percentile', valore: '50' } } }, 'x');
    expect(tre.ok && tre.valore.colorScale!.soglie).toBeUndefined();
  });
  it('numero, percentuale e percentile si salvano; il punto medio solo con tre toni', () => {
    const e = creaRegolaCondizionale({ ...base, soglie: { min: { tipo: 'numero', valore: '5' }, mid: { tipo: 'numero', valore: '7' }, max: { tipo: 'percentile', valore: '90' } } }, 'x');
    expect(e.ok && e.valore.colorScale!.soglie).toEqual({ min: { tipo: 'numero', valore: 5 }, max: { tipo: 'percentile', valore: 90 } });
    const b = creaRegolaCondizionale({ ...base, condizione: 'barre', coloreMax: '#0000ff', soglie: { max: { tipo: 'numero', valore: '100' } } }, 'x');
    expect(b.ok && b.valore.dataBar).toEqual({ color: '#0000ff', soglie: { max: { tipo: 'numero', valore: 100 } } });
  });
  it('gli errori: numero mancante, percentuale fuori da 0-100, minimo non minore del massimo', () => {
    const err = (soglie: DatiCondizionale['soglie']) => { const e = creaRegolaCondizionale({ ...base, soglie }, 'x'); return e.ok ? '' : e.errore; };
    expect(err({ min: { tipo: 'numero', valore: '' } })).toContain('minimo');
    expect(err({ max: { tipo: 'percentuale', valore: '120' } })).toContain('da 0 a 100');
    expect(err({ min: { tipo: 'numero', valore: '9' }, max: { tipo: 'numero', valore: '9' } })).toContain('minore del massimo');
  });
});

describe('T521: dalla regola ai dati della finestra (per modificarla)', () => {
  const giro = (r: ConditionalFormatRule) => { const d = datiDaRegola(r)!; const e = creaRegolaCondizionale(d, r.id); return e.ok ? e.valore : e.errore; };
  it('ogni tipo torna uguale', () => {
    const regole: ConditionalFormatRule[] = [
      { id: 'a', type: 'cell_value', range: R, operator: 'between', value1: 1, value2: 9, style: { backgroundColor: '#ff0000', bold: true } },
      { id: 'b', type: 'text', range: R, operator: 'starts_with', value1: 'ab', style: { textColor: '#00ff00' } },
      { id: 'c', type: 'text', range: R, operator: 'empty', style: { backgroundColor: '#cccccc' } },
      { id: 'd', type: 'formula', range: R, value1: '=A1>25', style: { backgroundColor: '#ff0000' } },
      { id: 'e', type: 'color_scale', range: R, colorScale: { minColor: '#000000', midColor: '#808080', maxColor: '#ffffff', soglie: { mid: { tipo: 'numero', valore: 3 } } } },
      { id: 'f', type: 'data_bar', range: R, dataBar: { color: '#0000ff', soglie: { min: { tipo: 'percentuale', valore: 10 } } } },
      { id: 'g', type: 'icon_set', range: R, iconSet: { type: 'traffic_lights' } },
    ];
    for (const r of regole) expect(giro(r)).toEqual(r);
  });
  it('una regola che la finestra non sa mostrare dà null', () => {
    expect(datiDaRegola({ id: 'x', type: 'date', range: R, operator: 'today' })).toBeNull();
    expect(datiDaRegola({ id: 'x', type: 'cell_value', range: R, operator: 'not_between', value1: 1, value2: 2 })).toBeNull();
  });
  it('la descrizione nell\'elenco', () => {
    expect(descriviRegola({ id: 'a', type: 'cell_value', range: R, operator: 'greater_than', value1: 10, style: {} })).toBe('Maggiore di 10');
    expect(descriviRegola({ id: 'a', type: 'cell_value', range: R, operator: 'between', value1: 1, value2: 9, style: {} })).toBe('Compreso tra 1 e 9');
    expect(descriviRegola({ id: 'a', type: 'text', range: R, operator: 'contains', value1: 'ok', style: {} })).toBe('Il testo contiene "ok"');
    expect(descriviRegola({ id: 'a', type: 'formula', range: R, value1: '=A1>2', style: {} })).toBe('La formula è vera: =A1>2');
    expect(descriviRegola({ id: 'a', type: 'icon_set', range: R, iconSet: { type: 'arrows' } })).toBe('Icone: frecce');
    expect(descriviRegola({ id: 'a', type: 'date', range: R })).toBe('Regola su data (dal file)');
  });
});

describe('T521: barre, icone e soglie nel file Excel', () => {
  it('si scrivono e si rileggono uguali', async () => {
    const condizionali: ConditionalFormatRule[] = [
      { id: '1', type: 'color_scale', range: R, colorScale: { minColor: '#ff0000', midColor: '#ffff00', maxColor: '#00ff00', soglie: { min: { tipo: 'numero', valore: 5 }, mid: { tipo: 'percentuale', valore: 40 }, max: { tipo: 'percentile', valore: 90 } } } },
      { id: '2', type: 'data_bar', range: R, dataBar: { color: '#0000ff', soglie: { max: { tipo: 'numero', valore: 100 } } } },
      { id: '3', type: 'data_bar', range: R, dataBar: { color: '#00aa00' } },
      { id: '4', type: 'icon_set', range: R, iconSet: { type: 'arrows' } },
      { id: '5', type: 'icon_set', range: R, iconSet: { type: 'traffic_lights' } },
    ];
    const s: Scambio = { foglioAttivo: 'F', fogli: [{ ...foglioVuoto('F'), celle: { A1: '1' }, condizionali }] };
    const r = await leggiXlsx(await scriviXlsx(s));
    expect(r.avvisi).toEqual([]);
    const lette = r.scambio.fogli[0].condizionali!.map(({ id: _id, ...resto }) => resto);
    expect(lette).toEqual(condizionali.map(({ id: _id, ...resto }) => resto));
  });
});

// ---- la finestra con l'elenco ----
async function monta(regole: ConditionalFormatRule[]): Promise<any> {
  const el: any = document.createElement('free-dialogo-regole');
  el.modo = 'condizionale';
  el.intervallo = 'A1:A5';
  el.regole = regole;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const campo = (el: any, nome: string): any => el.shadowRoot.querySelector(`[data-campo="${nome}"]`);
const visibile = (el: any, nome: string): boolean => !el.shadowRoot.querySelector(`[data-riga="${nome}"]`).classList.contains('nascosto');
const clic = async (el: any, sel: string) => { el.shadowRoot.querySelector(sel).click(); await new Promise((r) => setTimeout(r, 0)); await el.updateComplete; };
function ascolta(el: any, nome: string): any[] { const v: any[] = []; el.addEventListener(nome, (e: any) => v.push(e.detail)); return v; }
async function scegli(el: any, nome: string, valore: string): Promise<void> { campo(el, nome).value = valore; campo(el, nome).dispatchEvent(new Event('change', { bubbles: true })); await el.updateComplete; }

describe('T521: elenco delle regole nella finestra', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  const regole: ConditionalFormatRule[] = [
    { id: 'a', type: 'cell_value', range: { startRow: 2, endRow: 4, startCol: 2, endCol: 2 }, operator: 'greater_than', value1: 10, style: { backgroundColor: '#ff0000' } },
    { id: 'b', type: 'data_bar', range: R, dataBar: { color: '#0000ff', soglie: { max: { tipo: 'numero', valore: 100 } } } },
    { id: 'c', type: 'date', range: R, operator: 'today', style: { bold: true } },
  ];
  it('senza regole l\'elenco non c\'è', async () => {
    const el = await monta([]);
    expect(el.shadowRoot.querySelector('[data-elenco]')).toBeNull();
  });
  it('mostra le regole in ordine con descrizione e intervallo; prima non sale, ultima non scende, quella dal file non si modifica', async () => {
    const el = await monta(regole);
    const righe = Array.from(el.shadowRoot.querySelectorAll('[data-elenco] li')) as HTMLElement[];
    expect(righe.map((li) => li.querySelector('.descr')!.textContent)).toEqual(['Maggiore di 10', 'Barre dati', 'Regola su data (dal file)']);
    expect(righe[0].querySelector('.dove')!.textContent).toBe('B2:B4');
    expect((righe[0].querySelector('[data-azione="su"]') as HTMLButtonElement).disabled).toBe(true);
    expect((righe[2].querySelector('[data-azione="giu"]') as HTMLButtonElement).disabled).toBe(true);
    expect((righe[2].querySelector('[data-azione="modifica"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it('su, giù ed elimina chiedono al programma di farlo, con la posizione', async () => {
    const el = await monta(regole);
    const v = ascolta(el, 'gestisci-regola');
    await clic(el, 'li[data-indice="1"] [data-azione="su"]');
    await clic(el, 'li[data-indice="0"] [data-azione="giu"]');
    await clic(el, 'li[data-indice="2"] [data-azione="elimina"]');
    expect(v).toEqual([{ azione: 'su', indice: 1 }, { azione: 'giu', indice: 0 }, { azione: 'elimina', indice: 2 }]);
  });
  it('Modifica carica la regola nel modulo (soglie comprese) e Fine la sostituisce tenendo l\'id', async () => {
    const el = await monta(regole);
    await clic(el, 'li[data-indice="1"] [data-azione="modifica"]');
    expect(campo(el, 'condizione').value).toBe('barre');
    expect(campo(el, 'intervallo').value).toBe('A1:A5');
    expect(campo(el, 'colore-max').value).toBe('#0000ff');
    expect(campo(el, 'soglia-max-tipo').value).toBe('numero');
    expect(campo(el, 'soglia-max-valore').value).toBe('100');
    expect(visibile(el, 'soglia-min') && visibile(el, 'soglia-max') && !visibile(el, 'soglia-mid')).toBe(true);
    expect(el.shadowRoot.querySelector('[data-modifica]').textContent).toContain('regola 2');
    campo(el, 'soglia-max-valore').value = '200';
    const v = ascolta(el, 'applica-regola');
    await clic(el, 'button[data-azione="fine"]');
    expect(v).toEqual([{ modo: 'condizionale', sostituisce: 1, regola: { id: 'b', type: 'data_bar', range: R, dataBar: { color: '#0000ff', soglie: { max: { tipo: 'numero', valore: 200 } } } } }]);
  });
  it('"Fanne una nuova" torna a creare una regola nuova', async () => {
    const el = await monta(regole);
    await clic(el, 'li[data-indice="0"] [data-azione="modifica"]');
    expect(campo(el, 'valore1').value).toBe('10');
    await clic(el, 'button[data-azione="nuova"]');
    const v = ascolta(el, 'applica-regola');
    await clic(el, 'button[data-azione="fine"]');
    expect(v[0].sostituisce).toBeUndefined();
    expect(v[0].regola.id).not.toBe('a');
  });
  it('il valore della soglia si mostra solo se serve', async () => {
    const el = await monta([]);
    await scegli(el, 'condizione', 'scala-3');
    expect(campo(el, 'soglia-min-valore').classList.contains('nascosto')).toBe(true);
    expect(campo(el, 'soglia-mid-valore').classList.contains('nascosto')).toBe(false);
    expect(campo(el, 'soglia-mid-valore').value).toBe('50');
    await scegli(el, 'soglia-min-tipo', 'percentile');
    expect(campo(el, 'soglia-min-valore').classList.contains('nascosto')).toBe(false);
  });
});

describe('T521: la griglia sostituisce, sposta ed elimina le regole, e Annulla le rimette', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  const r1: ConditionalFormatRule = { id: 'r1', type: 'cell_value', range: R, operator: 'greater_than', value1: 1, style: { backgroundColor: '#ff0000' } };
  const r2: ConditionalFormatRule = { id: 'r2', type: 'cell_value', range: R, operator: 'greater_than', value1: 1, style: { backgroundColor: '#00ff00' } };
  beforeEach(async () => {
    const tabId = `test-T521-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
    grid['getDoc']().conditionalFormats.push({ ...r1 }, { ...r2 });
  });
  const ids = () => grid['getDoc']().conditionalFormats.map((r: ConditionalFormatRule) => r.id);
  it('sposta: la regola sale e vale per prima', async () => {
    grid.spostaRegolaCondizionale(1, -1);
    expect(ids()).toEqual(['r2', 'r1']);
    grid.spostaRegolaCondizionale(0, -1);   // già in cima: niente
    expect(ids()).toEqual(['r2', 'r1']);
    await grid.undo();
    expect(ids()).toEqual(['r1', 'r2']);
  });
  it('elimina e sostituisce, con Annulla', async () => {
    grid.eliminaRegolaCondizionale(0);
    expect(ids()).toEqual(['r2']);
    await grid.undo();
    expect(ids()).toEqual(['r1', 'r2']);
    grid.sostituisciRegolaCondizionale(1, { ...r2, value1: 99 });
    expect(grid['getDoc']().conditionalFormats[1].value1).toBe(99);
    await grid.undo();
    expect(grid['getDoc']().conditionalFormats[1].value1).toBe(1);
  });
});
