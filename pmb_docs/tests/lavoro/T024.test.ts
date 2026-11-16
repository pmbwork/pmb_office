import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-toolbar';
import { VOCI_BARRA } from '../../src/guscio/barra-dati';

async function monta(larghezza: number): Promise<any> {
  const el: any = document.createElement('docs-toolbar');
  el.larghezza = larghezza;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const normali = (el: any) => Array.from(el.shadowRoot.querySelectorAll('button.comando:not(.fisso)')) as HTMLButtonElement[];
const fisso = (el: any) => el.shadowRoot.querySelector('button.comando.fisso') as HTMLButtonElement | null;
const altri = (el: any) => el.shadowRoot.querySelector('button.altri') as HTMLButtonElement | null;
const pannello = (el: any) => el.shadowRoot.querySelector('.pannello-altri') as HTMLElement | null;

describe('T024: docs-toolbar', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('a 1600 px mostra tutti i 28 comandi, il pulsante fisso Funzioni e nessun "altri"', async () => {
    const el = await monta(1600);
    expect(normali(el).map((b) => b.dataset.id)).toEqual(VOCI_BARRA.map((v) => v.id));
    expect(fisso(el)?.dataset.id).toBe('funzioni');
    expect(altri(el)).toBeNull();
  });

  it('a 800 px mostra 9 comandi, il pulsante "⋮" e il pulsante fisso Funzioni', async () => {
    const el = await monta(800);
    expect(normali(el).length).toBe(9);
    expect(altri(el)).not.toBeNull();
    expect((altri(el)!.textContent ?? '').trim()).toBe('⋮');
    expect(fisso(el)?.dataset.id).toBe('funzioni');
  });

  it('cambiando la larghezza la barra si aggiorna (800 -> 1000 -> 1200)', async () => {
    const el = await monta(800);
    el.larghezza = 1000; await el.updateComplete;
    expect(normali(el).length).toBe(18);
    el.larghezza = 1200; await el.updateComplete;
    expect(normali(el).length).toBe(20);
    expect(altri(el)).not.toBeNull();
  });

  it('ogni comando ha aria-label e title uguali alla sua etichetta', async () => {
    const el = await monta(1600);
    normali(el).forEach((b, i) => {
      expect(b.getAttribute('aria-label')).toBe(VOCI_BARRA[i].etichetta);
      expect(b.getAttribute('title')).toBe(VOCI_BARRA[i].etichetta);
    });
  });

  it('il pulsante "⋮" apre e chiude il pannello dei comandi nascosti (18 a 800 px)', async () => {
    const el = await monta(800);
    expect(pannello(el)).toBeNull();
    altri(el)!.click(); await el.updateComplete;
    expect(pannello(el)).not.toBeNull();
    const voci = Array.from(pannello(el)!.querySelectorAll('.voce-altri')) as HTMLElement[];
    expect(voci.map((v) => v.dataset.id)).toEqual(VOCI_BARRA.slice(9).map((v) => v.id));
    altri(el)!.click(); await el.updateComplete;
    expect(pannello(el)).toBeNull();
  });

  it('un clic su un comando lancia l\'evento "comando" con il suo id', async () => {
    const el = await monta(1600);
    let id = '';
    el.addEventListener('comando', (e: Event) => { id = (e as CustomEvent).detail.id; });
    normali(el).find((b) => b.dataset.id === 'grassetto')!.click();
    expect(id).toBe('grassetto');
    fisso(el)!.click(); // Funzioni apre il pannello, non manda comandi
    await el.updateComplete;
    expect(id).toBe('grassetto');
    expect(el.shadowRoot.querySelector('.pannello-funzioni')).not.toBeNull();
  });

  it('un clic su un comando nascosto lancia "comando" e chiude il pannello', async () => {
    const el = await monta(800);
    let id = '';
    el.addEventListener('comando', (e: Event) => { id = (e as CustomEvent).detail.id; });
    altri(el)!.click(); await el.updateComplete;
    (pannello(el)!.querySelector('.voce-altri[data-id="grassetto"]') as HTMLElement).click(); await el.updateComplete;
    expect(id).toBe('grassetto');
    expect(pannello(el)).toBeNull();
  });
});
