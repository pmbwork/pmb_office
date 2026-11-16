import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-toolbar';
import { VOCI_BARRA } from '../../src/guscio/barra-dati';
import { cursore, daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
const rettangolo = (left: number, bottom: number): DOMRect => ({ left, bottom, top: bottom - 32, right: left + 32, width: 32, height: 32, x: left, y: bottom - 32, toJSON: () => ({}) }) as DOMRect;

async function monta(larghezza: number): Promise<any> {
  const el: any = document.createElement('docs-toolbar');
  el.larghezza = larghezza;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const altri = (el: any) => el.shadowRoot.querySelector('button.altri') as HTMLButtonElement;
const pannello = (el: any) => el.shadowRoot.querySelector('.pannello-altri') as HTMLElement | null;
const vociPannello = (el: any) => Array.from(el.shadowRoot.querySelectorAll('.pannello-altri .voce-altri')) as HTMLButtonElement[];

beforeEach(() => { document.body.innerHTML = ''; });

describe('T314: il pannello "Altri comandi" della barra strumenti', () => {
  it('il pannello sta sopra il righello e il foglio', async () => {
    const css = ((customElements.get('docs-toolbar') as unknown as { styles: { cssText: string } }).styles.cssText).replace(/\s+/g, ' ');
    expect(css).toContain('.pannello-altri { position: absolute; top: 100%; right: 48px;');
    expect(css).toMatch(/\.pannello-altri \{[^}]*z-index: 30;/);
  });

  it('i comandi nascosti sono nel pannello e si apre e si chiude col pulsante ⋮', async () => {
    const el = await monta(1200);
    expect(pannello(el)).toBeNull();
    altri(el).click();
    await el.updateComplete;
    const attesi = VOCI_BARRA.filter((v) => v.larghezzaMinima > 1200).map((v) => v.id);
    expect(vociPannello(el).map((b) => b.dataset.id)).toEqual(attesi);
    altri(el).click();
    await el.updateComplete;
    expect(pannello(el)).toBeNull();
  });

  it('scegliere un comando dal pannello lo manda con il rettangolo del pulsante ⋮ e chiude il pannello', async () => {
    const el = await monta(1200);
    altri(el).getBoundingClientRect = () => rettangolo(700, 100);
    const viste: Array<{ id: string; rect: DOMRect | null }> = [];
    el.addEventListener('comando', (e: Event) => viste.push((e as CustomEvent).detail));
    altri(el).click();
    await el.updateComplete;
    const voce = vociPannello(el).find((b) => b.dataset.id === 'allineamento')!;
    voce.getBoundingClientRect = () => rettangolo(5, 5);
    voce.click();
    await el.updateComplete;
    expect(viste).toHaveLength(1);
    expect(viste[0].id).toBe('allineamento');
    expect(viste[0].rect?.left).toBe(700);
    expect(viste[0].rect?.bottom).toBe(100);
    expect(pannello(el)).toBeNull();
  });

  it('ogni voce del pannello manda il proprio identificativo', async () => {
    const el = await monta(1200);
    const viste: string[] = [];
    el.addEventListener('comando', (e: Event) => viste.push((e as CustomEvent).detail.id));
    altri(el).click();
    await el.updateComplete;
    const ids = vociPannello(el).map((b) => b.dataset.id);
    for (const id of ids) {
      if (!pannello(el)) { altri(el).click(); await el.updateComplete; }
      vociPannello(el).find((b) => b.dataset.id === id)!.click();
      await el.updateComplete;
    }
    expect(viste).toEqual(ids);
  });

  it('i comandi in vista mandano ancora il loro rettangolo', async () => {
    const el = await monta(1200);
    const grassetto = el.shadowRoot.querySelector('button.comando[data-id="grassetto"]') as HTMLButtonElement;
    grassetto.getBoundingClientRect = () => rettangolo(11, 22);
    const viste: Array<{ id: string; rect: DOMRect | null }> = [];
    el.addEventListener('comando', (e: Event) => viste.push((e as CustomEvent).detail));
    grassetto.click();
    expect(viste[0].id).toBe('grassetto');
    expect(viste[0].rect?.left).toBe(11);
  });

  it('senza il pulsante ⋮ nel documento il rettangolo è nullo e non si rompe niente', async () => {
    const el = await monta(1200);
    altri(el).click();
    await el.updateComplete;
    const voce = vociPannello(el)[0];
    altri(el).remove();
    const viste: Array<{ id: string; rect: DOMRect | null }> = [];
    el.addEventListener('comando', (e: Event) => viste.push((e as CustomEvent).detail));
    expect(() => voce.click()).not.toThrow();
    expect(viste[0].rect).toBeNull();
  });
});

describe('T314: nella finestra', () => {
  async function guscio(larghezza: number): Promise<{ g: any; ed: any }> {
    Object.defineProperty(window, 'innerWidth', { value: larghezza, configurable: true, writable: true });
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const ed: any = g.shadowRoot.querySelector('docs-editor');
    await ed.updateComplete;
    ed.impostaStato({ ...statoIniziale(daTesto('uno\ndue')), sel: cursore(0, 1) });
    await g.updateComplete;
    return { g, ed };
  }
  const barra = (g: any): any => g.shadowRoot.querySelector('docs-toolbar');

  it('il popup di un comando del pannello si apre sotto il pulsante ⋮', async () => {
    const { g } = await guscio(1200);
    const t = barra(g);
    await t.updateComplete;
    t.shadowRoot.querySelector('button.altri').getBoundingClientRect = () => rettangolo(900, 120);
    t.shadowRoot.querySelector('button.altri').click();
    await t.updateComplete;
    (t.shadowRoot.querySelector('.pannello-altri .voce-altri[data-id="allineamento"]') as HTMLButtonElement).click();
    await attendi();
    await g.updateComplete;
    const popup: any = g.shadowRoot.querySelector('docs-popup');
    expect(popup).not.toBeNull();
    expect(popup.x).toBe(900);
    expect(popup.y).toBe(122);
    expect(popup.popup.titolo).toBe('Allineamento');
  });

  it('scegliere dal popup applica l\'allineamento al paragrafo', async () => {
    const { g, ed } = await guscio(1200);
    const t = barra(g);
    t.shadowRoot.querySelector('button.altri').click();
    await t.updateComplete;
    (t.shadowRoot.querySelector('.pannello-altri .voce-altri[data-id="allineamento"]') as HTMLButtonElement).click();
    await attendi();
    await g.updateComplete;
    const popup: any = g.shadowRoot.querySelector('docs-popup');
    await popup.updateComplete;
    (Array.from(popup.shadowRoot.querySelectorAll('button.voce')) as HTMLButtonElement[]).find((b) => (b.textContent ?? '').includes('Al centro'))!.click();
    await attendi();
    expect(ed.stato.doc.paragrafi[0].al).toBe('ce');
  });

  it('un comando senza popup scelto dal pannello viene eseguito (elenco puntato)', async () => {
    const { g, ed } = await guscio(1200);
    const t = barra(g);
    t.shadowRoot.querySelector('button.altri').click();
    await t.updateComplete;
    (t.shadowRoot.querySelector('.pannello-altri .voce-altri[data-id="elenco-puntato"]') as HTMLButtonElement).click();
    await attendi();
    expect(ed.stato.doc.paragrafi[0].el).toBe('p');
  });
});
