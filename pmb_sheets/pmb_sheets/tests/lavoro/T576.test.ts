// T576 (pmb_sheets): pulsanti divisi dei colori nella barra, come in pmb_docs, Excel e LibreOffice (segnalazione del 2026-11-26): l'icona
// applica il colore della sua striscia, la freccia accanto apre la tavolozza e il colore scelto diventa quello dell'icona.
import { describe, it, expect } from 'vitest';
import '../../src/components/toolbar';
import '../../src/components/color-picker';
import type { FreeToolbar } from '../../src/components/toolbar';
import { COLORI_INIZIALI } from '@comune/icone';

type Tb = FreeToolbar & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
const pausa = (ms = 60) => new Promise((r) => setTimeout(r, ms));
async function toolbar(): Promise<Tb> {
  document.body.innerHTML = '';
  const tb = document.createElement('free-toolbar') as Tb;
  document.body.appendChild(tb);
  await tb.updateComplete;
  return tb;
}

describe('T576: pulsanti divisi dei colori (pmb_sheets)', () => {
  it.each([['text-color', 'change-text-color', COLORI_INIZIALI.testo], ['fill-color', 'change-fill-color', COLORI_INIZIALI.riempimento]])(
    'un clic sull\'icona «%s» applica il colore della striscia senza aprire la tavolozza', async (id, azione, colore) => {
      const tb = await toolbar();
      const azioni: Array<{ action: string; value?: string }> = [];
      tb.addEventListener('toolbar-action', (e) => azioni.push((e as CustomEvent).detail));
      (tb.renderRoot.querySelector(`#btn-${id}`) as HTMLElement).click();
      await tb.updateComplete;
      expect(azioni).toEqual([expect.objectContaining({ action: azione, value: colore })]);
      expect(tb.renderRoot.querySelector('free-color-picker')).toBeNull();
      expect((tb.renderRoot.querySelector(`#btn-${id}`) as HTMLElement).innerHTML).toContain(`fill="${colore}"`);
    });

  it('il colore scelto dalla tavolozza diventa quello dell\'icona', async () => {
    const tb = await toolbar();
    (tb.renderRoot.querySelector('#btn-text-color-scegli') as HTMLElement).click();
    await tb.updateComplete; await pausa();
    const picker = tb.renderRoot.querySelector('free-color-picker') as HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot };
    await picker.updateComplete;
    const campione = picker.renderRoot.querySelectorAll('.color-swatch')[17] as HTMLElement;
    campione.click();
    await tb.updateComplete; await pausa();
    const azioni: Array<{ action: string; value?: string }> = [];
    tb.addEventListener('toolbar-action', (e) => azioni.push((e as CustomEvent).detail));
    (tb.renderRoot.querySelector('#btn-text-color') as HTMLElement).click();
    expect(azioni[0].action).toBe('change-text-color');
    expect(azioni[0].value).not.toBe(COLORI_INIZIALI.testo);
    expect((tb.renderRoot.querySelector('#btn-text-color') as HTMLElement).innerHTML).toContain(`fill="${azioni[0].value}"`);
  });
});
