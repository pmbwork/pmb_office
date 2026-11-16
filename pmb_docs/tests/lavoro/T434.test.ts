// T434: Ctrl+Maiusc+C apre il conteggio; zoom con Ctrl+rotella e Ctrl +/-/0.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { cursore, daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; });
async function guscio(): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('uno due')), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}
// happy-dom non copia ctrlKey/deltaY nel WheelEvent: li si impostano a mano
const rotella = (deltaY: number, ctrlKey: boolean): WheelEvent => {
  const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'deltaY', { value: deltaY });
  Object.defineProperty(ev, 'ctrlKey', { value: ctrlKey });
  return ev;
};
const tasto = (g: any, key: string, extra: KeyboardEventInit = {}) => g.shadowRoot.querySelector('main').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...extra }));

describe('T434: Ctrl+Maiusc+C', () => {
  it('apre davvero il dialogo del conteggio parole', async () => {
    const g = await guscio();
    tasto(g, 'C', { ctrlKey: true, shiftKey: true, code: 'KeyC' });
    await g.updateComplete; await attendi(30);
    expect(g.shadowRoot.querySelector('docs-conteggio')).not.toBeNull();
  });
});

describe('T434: zoom', () => {
  it('Ctrl+rotella in su ingrandisce, in giù rimpicciolisce; senza Ctrl non fa niente', async () => {
    const g = await guscio();
    const area = g.shadowRoot.querySelector('.area-editor');
    area.dispatchEvent(rotella(-100, true));
    expect(g.zoom).toBe(125);
    area.dispatchEvent(rotella(100, true));
    area.dispatchEvent(rotella(100, true));
    expect(g.zoom).toBe(90);
    area.dispatchEvent(rotella(100, false));
    expect(g.zoom).toBe(90);
  });
  it('la rotella con Ctrl non lascia fare lo zoom del browser (preventDefault)', async () => {
    const g = await guscio();
    const ev = rotella(-100, true);
    g.shadowRoot.querySelector('.area-editor').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
  it('lo zoom si ferma ai limiti (50% e 200%)', async () => {
    const g = await guscio();
    for (let i = 0; i < 20; i++) g.passoZoom(1);
    expect(g.zoom).toBe(200);
    for (let i = 0; i < 20; i++) g.passoZoom(-1);
    expect(g.zoom).toBe(50);
  });
  it('Ctrl+= ingrandisce, Ctrl+- rimpicciolisce, Ctrl+0 torna al 100%', async () => {
    const g = await guscio();
    tasto(g, '=', { ctrlKey: true });
    expect(g.zoom).toBe(125);
    tasto(g, '-', { ctrlKey: true }); tasto(g, '-', { ctrlKey: true });
    expect(g.zoom).toBe(90);
    tasto(g, '0', { ctrlKey: true });
    expect(g.zoom).toBe(100);
  });
});
