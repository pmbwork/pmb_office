import { describe, it, expect, beforeEach } from 'vitest';
import { FreeSheetGrid } from '../../src/components/sheet-grid';
import { defaultDocumentStore } from '../../src/sheet/index';
import { evaluateConditionalFormats, statisticheNumeri, type ConditionalFormatRule } from '../../src/sheet/conditional-format';
import { creaRegolaCondizionale, eGrafica, type DatiCondizionale } from '../../src/sheet/regole-dialogo';

const base: DatiCondizionale = { intervallo: 'A1:A5', condizione: 'barre', valore1: '', valore2: '', sfondo: '', testo: '', grassetto: false };

describe('T520: statistiche e valutazione delle regole grafiche', () => {
  it('statisticheNumeri ignora i non numeri e dà undefined se non ce ne sono', () => {
    expect(statisticheNumeri([3, 9, NaN, 1])).toEqual({ min: 1, max: 9, count: 3, ordinati: [1, 3, 9] });
    expect(statisticheNumeri([])).toBeUndefined();
  });
  it('ogni regola usa le statistiche del proprio intervallo', () => {
    const regole: ConditionalFormatRule[] = [
      { id: 'a', type: 'data_bar', range: { startRow: 1, endRow: 2, startCol: 1, endCol: 1 }, dataBar: { color: '#00f' } },
    ];
    const stats = () => ({ min: 0, max: 200, count: 2 });
    expect(evaluateConditionalFormats('50', 1, 1, regole, stats)!.dataBar).toEqual({ percent: 25, color: '#00f' });
    expect(evaluateConditionalFormats('50', 1, 1, regole, undefined)).toBeNull();
  });
  it('scala a due toni: minimo e massimo prendono i colori estremi', () => {
    const r: ConditionalFormatRule[] = [{ id: 's', type: 'color_scale', range: { startRow: 1, endRow: 3, startCol: 1, endCol: 1 }, colorScale: { minColor: '#000000', maxColor: '#ffffff' } }];
    const st = { min: 0, max: 10, count: 3 };
    expect(evaluateConditionalFormats('0', 1, 1, r, st)!.backgroundColor).toBe('#000000');
    expect(evaluateConditionalFormats('10', 1, 1, r, st)!.backgroundColor).toBe('#ffffff');
  });
});

describe('T520: il dialogo crea le regole grafiche e a formula', () => {
  it('quali condizioni sono grafiche', () => {
    expect(['scala-2', 'scala-3', 'barre', 'frecce', 'semafori'].every((c) => eGrafica(c as never))).toBe(true);
    expect(eGrafica('maggiore')).toBe(false);
    expect(eGrafica('formula')).toBe(false);
  });
  it('barre dati', () => {
    const e = creaRegolaCondizionale({ ...base, coloreMax: '#9dc3e6' }, 'x');
    expect(e).toEqual({ ok: true, valore: { id: 'x', type: 'data_bar', range: { startRow: 1, endRow: 5, startCol: 1, endCol: 1 }, dataBar: { color: '#9dc3e6' } } });
    expect(creaRegolaCondizionale({ ...base, coloreMax: 'rosso' }, 'x').ok).toBe(false);
  });
  it('scale di colore a due e a tre toni', () => {
    const due = creaRegolaCondizionale({ ...base, condizione: 'scala-2', coloreMin: '#ff0000', coloreMax: '#00ff00' }, 'x');
    expect(due.ok && due.valore.colorScale).toEqual({ minColor: '#ff0000', maxColor: '#00ff00' });
    const tre = creaRegolaCondizionale({ ...base, condizione: 'scala-3', coloreMin: '#ff0000', coloreMid: '#ffff00', coloreMax: '#00ff00' }, 'x');
    expect(tre.ok && tre.valore.colorScale).toEqual({ minColor: '#ff0000', midColor: '#ffff00', maxColor: '#00ff00' });
    expect(creaRegolaCondizionale({ ...base, condizione: 'scala-3', coloreMin: '#ff0000', coloreMax: '#00ff00' }, 'x').ok).toBe(false);
  });
  it('icone: frecce e semafori, senza bisogno di stile', () => {
    const f = creaRegolaCondizionale({ ...base, condizione: 'frecce' }, 'x');
    expect(f.ok && f.valore.iconSet).toEqual({ type: 'arrows' });
    const s = creaRegolaCondizionale({ ...base, condizione: 'semafori' }, 'x');
    expect(s.ok && s.valore.iconSet).toEqual({ type: 'traffic_lights' });
  });
  it('formula: con o senza = iniziale, serve almeno uno stile, vuota è un errore', () => {
    const ok = creaRegolaCondizionale({ ...base, condizione: 'formula', valore1: 'A1>25', sfondo: '#ff0000' }, 'x');
    expect(ok.ok && ok.valore.type).toBe('formula');
    expect(ok.ok && ok.valore.value1).toBe('=A1>25');
    const conUguale = creaRegolaCondizionale({ ...base, condizione: 'formula', valore1: '=A1>25', sfondo: '#ff0000' }, 'x');
    expect(conUguale.ok && conUguale.valore.value1).toBe('=A1>25');
    expect(creaRegolaCondizionale({ ...base, condizione: 'formula', valore1: '', sfondo: '#ff0000' }, 'x').ok).toBe(false);
    expect(creaRegolaCondizionale({ ...base, condizione: 'formula', valore1: 'A1>1' }, 'x').ok).toBe(false);
  });
});

describe('T520: la griglia disegna scale, barre e icone', () => {
  let grid: FreeSheetGrid;
  let n = 0;
  beforeEach(async () => {
    const tabId = `test-T520-${++n}`;
    defaultDocumentStore.getOrCreateDocument(tabId);
    grid = new FreeSheetGrid();
    grid.tabId = tabId;
    document.body.appendChild(grid);
    await grid.updateComplete;
    await grid.refreshSheetList();
    const doc = grid['getDoc']();
    await doc.client.applyBatch([1, 2, 3, 4, 5].map((r) => ({ type: 'set' as const, sheet: doc.activeSheetName, row: r, col: 2, raw: String(r * 25) })));
  });
  const td = (r: number, c = 2) => grid.renderRoot.querySelector(`td[data-row="${r}"][data-col="${c}"]`) as HTMLElement;
  const metti = async (regola: ConditionalFormatRule) => {
    grid['getDoc']().conditionalFormats.push(regola);
    grid.requestUpdate();
    await grid.updateComplete;
  };
  const colore = (e: HTMLElement) => { const v = e.style.backgroundColor.replace(/\s/g, ''); const m = v.match(/^rgb\((\d+),(\d+),(\d+)\)$/); return m ? '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('') : v; };
  const range = { startRow: 1, endRow: 5, startCol: 2, endCol: 2 };

  it('la scala di colore dà il colore del minimo e quello del massimo', async () => {
    await metti({ id: 's', type: 'color_scale', range, colorScale: { minColor: '#ff0000', maxColor: '#0000ff' } });
    expect(colore(td(1))).toBe('#ff0000');
    expect(colore(td(5))).toBe('#0000ff');
  });
  it('la barra dati è piena al massimo e vuota al minimo', async () => {
    await metti({ id: 'b', type: 'data_bar', range, dataBar: { color: '#9dc3e6' } });
    expect(td(5).style.backgroundImage).toContain('100%');
    expect(td(1).style.backgroundImage).toContain('0%');
  });
  it('le icone: freccia su per il valore alto, giù per il basso', async () => {
    await metti({ id: 'i', type: 'icon_set', range, iconSet: { type: 'arrows' } });
    expect(td(5).querySelector('.icona-condizionale')?.textContent).toBe('▲');
    expect(td(1).querySelector('.icona-condizionale')?.textContent).toBe('▼');
  });
  it('i semafori: verde, giallo, rosso', async () => {
    await metti({ id: 'i', type: 'icon_set', range, iconSet: { type: 'traffic_lights' } });
    const colori = [1, 3, 5].map((r) => td(r).querySelector('.icona-condizionale')?.getAttribute('aria-label'));
    expect(colori).toEqual(['rosso', 'giallo', 'verde']);
  });
});
