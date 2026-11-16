import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/color-picker';

type Picker = HTMLElement & { open: boolean; updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };

describe('T528: la tavolozza dei colori non viene tagliata dalla barra degli strumenti', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('il riquadro è in posizione fissa, subito sotto il bottone che la contiene (la barra ha overflow: hidden e lo tagliava)', async () => {
    const contenitore = document.createElement('div');
    contenitore.getBoundingClientRect = () => ({ left: 300, top: 150, right: 332, bottom: 182, width: 32, height: 32, x: 300, y: 150, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(contenitore);
    const p = document.createElement('free-color-picker') as Picker;
    p.open = true;
    contenitore.appendChild(p);
    await p.updateComplete; await p.updateComplete;
    const riquadro = p.shadowRoot.querySelector('.picker-popup') as HTMLElement;
    expect(getComputedStyle(riquadro).position).toBe('fixed');
    expect(riquadro.style.top).toBe('186px');
    expect(riquadro.style.left).toBe('300px');
  });
  it('non esce dal bordo destro della finestra', async () => {
    const contenitore = document.createElement('div');
    contenitore.getBoundingClientRect = () => ({ left: window.innerWidth - 20, top: 150, right: window.innerWidth, bottom: 182, width: 20, height: 32, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(contenitore);
    const p = document.createElement('free-color-picker') as Picker;
    p.open = true;
    contenitore.appendChild(p);
    await p.updateComplete; await p.updateComplete;
    const riquadro = p.shadowRoot.querySelector('.picker-popup') as HTMLElement;
    expect(parseFloat(riquadro.style.left) + 240).toBeLessThanOrEqual(window.innerWidth - 8);
  });
});
