import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-toolbar';
import { ICONE_DOCS } from '../../src/guscio/icone';

async function monta(larghezza: number): Promise<any> {
  const el: any = document.createElement('docs-toolbar');
  el.larghezza = larghezza;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const icona = (el: any, id: string) => el.shadowRoot.querySelector(`.icona[data-icona="${id}"]`) as HTMLElement | null;

describe('T027: icone nella barra strumenti', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('ogni comando che ha un\'icona la mostra come SVG (a 1600 px)', async () => {
    const el = await monta(1600);
    for (const id of Object.keys(ICONE_DOCS)) {
      const i = icona(el, id);
      expect(i, id).not.toBeNull();
      expect(i!.querySelector('svg'), id).not.toBeNull();
    }
  });

  it('la modalità fissa a destra mostra la sua icona anche a 800 px', async () => {
    const el = await monta(800);
    expect(icona(el, 'funzioni')!.querySelector('svg')).not.toBeNull();
    expect(icona(el, 'annulla')!.querySelector('svg')).not.toBeNull();
  });

  it('zoom, stile, carattere e dimensione non hanno icona (sono caselle di testo)', async () => {
    const el = await monta(1600);
    for (const id of ['zoom', 'stile-paragrafo', 'carattere', 'corpo']) {
      const i = icona(el, id);
      expect(i, id).not.toBeNull();
      expect(i!.querySelector('svg'), id).toBeNull();
    }
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
