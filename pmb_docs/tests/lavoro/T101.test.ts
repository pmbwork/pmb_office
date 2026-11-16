import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-righello';
import { PX_PER_CM, RIGHELLO_A4, margini, tacche } from '../../src/guscio/righello';
import { cursore, daTesto } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T101: le tacche del righello', () => {
  it('un centimetro sono 96/2,54 pixel e il foglio A4 ha margini di un pollice', () => {
    expect(PX_PER_CM).toBeCloseTo(37.7953, 4);
    expect(RIGHELLO_A4).toEqual({ larghezza: 794, margineSinistro: 96, margineDestro: 96 });
  });

  it('sul foglio A4: 84 tacche, da sinistra a destra, tutte dentro il foglio, senza doppioni', () => {
    const t = tacche();
    expect(t.length).toBe(84);
    expect(t.every((c, i) => c.x >= 0 && c.x <= 794 && (i === 0 || c.x > t[i - 1].x))).toBe(true);
    expect(t.filter((c) => c.tipo === 'cm').length).toBe(21);
    expect(t.filter((c) => c.tipo === 'mezzo').length).toBe(21);
    expect(t.filter((c) => c.tipo === 'quarto').length).toBe(42);
  });

  it('lo zero è sul margine sinistro e non ha numero; i centimetri a destra crescono, quelli nel margine contano verso sinistra', () => {
    const t = tacche();
    const zero = t.find((c) => c.x === 96)!;
    expect(zero).toEqual({ x: 96, tipo: 'cm' });
    const numerate = t.filter((c) => c.etichetta !== undefined);
    expect(numerate.map((c) => c.etichetta)).toEqual(['2', '1', ...Array.from({ length: 18 }, (_, i) => String(i + 1))]);
    expect(numerate[0].x).toBeCloseTo(96 - 2 * PX_PER_CM, 1);
    expect(numerate[1].x).toBeCloseTo(96 - PX_PER_CM, 1);
    expect(numerate[2].x).toBeCloseTo(96 + PX_PER_CM, 1);
    expect(numerate[19].x).toBeCloseTo(96 + 18 * PX_PER_CM, 1);
    for (const c of t) expect(Math.round(c.x * 100) / 100).toBe(c.x);
  });

  it('mezzo centimetro e quarto stanno nei posti giusti', () => {
    const t = tacche();
    const dopoZero = t.slice(t.findIndex((c) => c.x === 96) + 1, t.findIndex((c) => c.x === 96) + 5);
    expect(dopoZero.map((c) => c.tipo)).toEqual(['quarto', 'mezzo', 'quarto', 'cm']);
    expect(dopoZero[1].x).toBeCloseTo(96 + PX_PER_CM / 2, 1);
  });

  it('con un\'altra larghezza o altri margini le tacche seguono', () => {
    const t = tacche({ larghezza: 200, margineSinistro: 50, margineDestro: 50 });
    expect(t.every((c) => c.x >= 0 && c.x <= 200)).toBe(true);
    expect(t.find((c) => c.x === 50)).toEqual({ x: 50, tipo: 'cm' });
    expect(t.filter((c) => c.etichetta !== undefined).map((c) => c.etichetta)).toEqual(['1', '1', '2', '3']);
    expect(margini({ larghezza: 200, margineSinistro: 50, margineDestro: 30 })).toEqual([{ x: 0, larghezza: 50 }, { x: 170, larghezza: 30 }]);
    expect(margini()).toEqual([{ x: 0, larghezza: 96 }, { x: 698, larghezza: 96 }]);
  });
});

describe('T101: il componente righello', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('disegna un SVG largo come il foglio, con due margini, i numeri e le tacche, senza stili in linea', async () => {
    const r: any = document.createElement('docs-righello');
    document.body.appendChild(r);
    await r.updateComplete;
    const s = r.shadowRoot.querySelector('svg');
    expect(s.getAttribute('width')).toBe('794');
    expect(s.getAttribute('height')).toBe('16');
    expect(r.shadowRoot.querySelectorAll('rect.margine').length).toBe(2);
    expect(Array.from(r.shadowRoot.querySelectorAll('rect.margine')).map((m: any) => [m.getAttribute('x'), m.getAttribute('width')])).toEqual([['0', '96'], ['698', '96']]);
    expect(r.shadowRoot.querySelectorAll('text').length).toBe(19); // 20 numeri meno quello coperto dall'indicatore del margine destro
    expect(r.shadowRoot.querySelectorAll('line.tacca').length).toBe(22);
    expect(r.shadowRoot.querySelectorAll('rect.punto').length).toBe(42);
    expect(r.shadowRoot.querySelectorAll('[style]').length).toBe(0);
    expect(Array.from(r.shadowRoot.querySelectorAll('text')).slice(0, 3).map((x: any) => x.textContent)).toEqual(['2', '1', '1']);
  });

  it('cambiando la geometria si ridisegna', async () => {
    const r: any = document.createElement('docs-righello');
    document.body.appendChild(r);
    await r.updateComplete;
    r.geometria = { larghezza: 400, margineSinistro: 50, margineDestro: 50 };
    await r.updateComplete;
    expect(r.shadowRoot.querySelector('svg').getAttribute('width')).toBe('400');
    expect(r.shadowRoot.querySelectorAll('text').length).toBeLessThan(20);
  });
});

async function guscio(): Promise<{ g: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ doc: daTesto('uno'), sel: cursore(0, 0), pendenti: null });
  return { g };
}
const righelloDi = (g: any): any => g.shadowRoot.querySelector('docs-righello');
async function vociMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barraMenu: any = g.shadowRoot.querySelector('docs-menubar');
  await barraMenu.updateComplete;
  (barraMenu.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barraMenu.updateComplete;
  const voce = (Array.from(barraMenu.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await attendi();
  await g.updateComplete;
}

describe('T101: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('il righello c\'è all\'inizio; Visualizza > Mostra righello lo toglie e lo rimette', async () => {
    const { g } = await guscio();
    expect(righelloDi(g)).not.toBeNull();
    expect(g.shadowRoot.querySelector('.righello')).not.toBeNull();
    await vociMenu(g, 'visualizza', 'Mostra righello');
    expect(righelloDi(g)).toBeNull();
    expect(g.shadowRoot.querySelector('.righello')).not.toBeNull();
    await vociMenu(g, 'visualizza', 'Mostra righello');
    expect(righelloDi(g)).not.toBeNull();
  });

  it('il righello lascia a destra lo spazio della barra di scorrimento, così resta sopra il foglio', async () => {
    const { g } = await guscio();
    const area = g.shadowRoot.querySelector('.area-editor');
    const r = g.shadowRoot.querySelector('.righello');
    Object.defineProperty(area, 'offsetWidth', { value: 1600, configurable: true });
    Object.defineProperty(area, 'clientWidth', { value: 1585, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(r.style.paddingRight).toBe('15px');
    Object.defineProperty(area, 'clientWidth', { value: 1600, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(r.style.paddingRight).toBe('');
    expect(r.hasAttribute('style')).toBe(false);
    expect(g.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
