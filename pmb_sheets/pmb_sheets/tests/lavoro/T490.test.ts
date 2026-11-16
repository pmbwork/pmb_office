import { describe, it, expect } from 'vitest';
import '../../src/components/toolbar';
import '../../src/components/color-picker';
import type { FreeToolbar } from '../../src/components/toolbar';

type Tb = FreeToolbar & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot };

async function toolbar(): Promise<Tb> {
  document.body.innerHTML = '';
  const tb = document.createElement('free-toolbar') as Tb;
  document.body.appendChild(tb);
  await tb.updateComplete;
  return tb;
}
const pausa = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe('T490: i selettori di colore della barra si aprono davvero', () => {
  it.each([['text-color', 'text'], ['fill-color', 'fill']])('un clic su "%s" mostra la tavolozza (non solo il suo contenitore vuoto)', async (id, modo) => {
    const tb = await toolbar();
    (tb.renderRoot.querySelector(`#btn-${id}`) as HTMLElement).click();
    await tb.updateComplete; await pausa();
    const picker = tb.renderRoot.querySelector('free-color-picker') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot; open: boolean };
    expect(picker).toBeTruthy();
    await picker.updateComplete;
    expect(picker.open).toBe(true);
    expect(picker.getAttribute('mode')).toBe(modo);
    expect(picker.renderRoot.querySelector('.picker-popup')).toBeTruthy();
    expect(picker.renderRoot.querySelectorAll('.color-swatch').length).toBe(40);
  });

  it('scegliere un colore manda l\'azione con il colore e il tipo, e chiude la tavolozza', async () => {
    const tb = await toolbar();
    const azioni: Array<{ action: string; value?: string }> = [];
    tb.addEventListener('toolbar-action', (e) => azioni.push((e as CustomEvent).detail));
    (tb.renderRoot.querySelector('#btn-fill-color') as HTMLElement).click();
    await tb.updateComplete; await pausa();
    const picker = tb.renderRoot.querySelector('free-color-picker') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
    await picker.updateComplete;
    const campione = picker.renderRoot.querySelectorAll('.color-swatch')[5] as HTMLElement;
    campione.click();
    await tb.updateComplete; await pausa();
    expect(azioni.some((a) => a.action === 'change-fill-color' && typeof a.value === 'string' && a.value.startsWith('#'))).toBe(true);
    expect(tb.renderRoot.querySelector('free-color-picker')).toBeNull();
  });

  it('un secondo clic sul bottone la richiude', async () => {
    const tb = await toolbar();
    const bottone = tb.renderRoot.querySelector('#btn-text-color') as HTMLElement;
    bottone.click(); await tb.updateComplete;
    expect(tb.renderRoot.querySelector('free-color-picker')).toBeTruthy();
    bottone.click(); await tb.updateComplete;
    expect(tb.renderRoot.querySelector('free-color-picker')).toBeNull();
  });
});
