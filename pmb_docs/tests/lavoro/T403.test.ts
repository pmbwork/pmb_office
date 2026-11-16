import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-guscio';
import type { DocsGuscio } from '../../src/guscio/docs-guscio';
import { LIVELLI_ZOOM, popupZoom } from '../../src/guscio/popup-dati';

describe('T403: Zoom reale dell\'editor in DocsGuscio', () => {
  async function montaGuscio(): Promise<DocsGuscio> {
    const g = document.createElement('docs-guscio') as DocsGuscio;
    document.body.appendChild(g);
    await g.updateComplete;
    return g;
  }

  it('popupZoom restituisce tutti i livelli previsti con quello attivo', () => {
    const p100 = popupZoom(100);
    expect(p100).not.toBeNull();
    expect(p100.tipo).toBe('lista');
    expect(p100.voci.map((v) => v.etichetta)).toEqual(['50%', '75%', '90%', '100%', '125%', '150%', '200%']);
    const voce100 = p100.voci.find((v) => v.etichetta === '100%');
    expect(voce100?.attiva).toBe(true);

    const p150 = popupZoom(150);
    const voce150 = p150.voci.find((v) => v.etichetta === '150%');
    expect(voce150?.attiva).toBe(true);
  });

  it('impostaZoom aggiorna lo stato, la classe della pagina e il testo nella barra strumenti', async () => {
    const g = await montaGuscio();
    expect(g.zoomAttuale).toBe(100);

    const pagina = g.renderRoot.querySelector('.pagina');
    expect(pagina?.classList.contains('zoom-100')).toBe(true);

    g.impostaZoom(150);
    await g.updateComplete;

    expect(g.zoomAttuale).toBe(150);
    expect(pagina?.classList.contains('zoom-150')).toBe(true);
    expect(pagina?.classList.contains('zoom-100')).toBe(false);

    const toolbar = g.renderRoot.querySelector('docs-toolbar');
    expect(toolbar?.valori['zoom']).toBe('150% ▾');

    g.remove();
  });

  it('cliccando una voce di zoom dal popup, il guscio aggiorna il livello di zoom', async () => {
    const g = await montaGuscio();

    // Simula comando zoom dalla toolbar
    const toolbar = g.renderRoot.querySelector('docs-toolbar');
    toolbar?.dispatchEvent(new CustomEvent('comando', {
      detail: { id: 'zoom', rect: { left: 100, bottom: 50 } },
      bubbles: true,
      composed: true,
    }));
    await g.updateComplete;

    const popup = g.renderRoot.querySelector('docs-popup');
    expect(popup).not.toBeNull();

    // Simula la selezione di 75%
    popup?.dispatchEvent(new CustomEvent('scelta', {
      detail: { azione: { tipo: 'zoom', valore: 75 } },
      bubbles: true,
      composed: true,
    }));
    await g.updateComplete;

    expect(g.zoomAttuale).toBe(75);
    const pagina = g.renderRoot.querySelector('.pagina');
    expect(pagina?.classList.contains('zoom-75')).toBe(true);

    g.remove();
  });
});
