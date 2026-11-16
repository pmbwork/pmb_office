import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-toolbar';
import { TESTI_CASELLE, contenutoComando } from '../../src/guscio/contenuto-barra';

async function monta(larghezza: number): Promise<any> {
  const el: any = document.createElement('docs-toolbar');
  el.larghezza = larghezza;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const icona = (el: any, id: string) => el.shadowRoot.querySelector(`.icona[data-icona="${id}"]`) as HTMLElement | null;

describe('T028: caselle di testo della barra strumenti', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('le quattro caselle mostrano il loro testo', async () => {
    const el = await monta(1600);
    expect(TESTI_CASELLE).toEqual({ 'zoom': '100% ▾', 'stile-paragrafo': 'Testo nor… ▾', 'carattere': 'Arial ▾', 'corpo': '11' });
    expect((icona(el, 'zoom')!.textContent ?? '').trim()).toBe('100% ▾');
    expect((icona(el, 'stile-paragrafo')!.textContent ?? '').trim()).toBe('Testo nor… ▾');
    expect((icona(el, 'carattere')!.textContent ?? '').trim()).toBe('Arial ▾');
    expect((icona(el, 'corpo')!.textContent ?? '').trim()).toBe('11');
  });

  it('gli altri comandi continuano a mostrare l\'icona SVG e nessun testo', async () => {
    const el = await monta(1600);
    for (const id of ['annulla', 'grassetto', 'link', 'elenco-puntato']) {
      const i = icona(el, id)!;
      expect(i.querySelector('svg'), id).not.toBeNull();
      expect((i.textContent ?? '').trim(), id).toBe('');
    }
    expect(typeof contenutoComando('grassetto')).not.toBe('string');
    expect(contenutoComando('zoom')).toBe('100% ▾');
  });

  it('le caselle restano pulsanti con aria-label e non usano stili in linea', async () => {
    const el = await monta(1600);
    for (const id of ['zoom', 'stile-paragrafo', 'carattere', 'corpo']) {
      const b = el.shadowRoot.querySelector(`button.comando[data-id="${id}"]`) as HTMLButtonElement;
      expect(b, id).not.toBeNull();
      expect((b.getAttribute('aria-label') ?? '').length, id).toBeGreaterThan(0);
    }
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
