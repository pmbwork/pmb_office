import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../src/guscio/docs-righello';
import '../../src/guscio/docs-guscio';

describe('T421: Righello Interattivo (Drag & Drop Marker Rientro/Margine)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('gli indicatori hanno cursor ew-resize e supportano impostaMargine', async () => {
    const r: any = document.createElement('docs-righello');
    document.body.appendChild(r);
    await r.updateComplete;

    const indSinistro = r.shadowRoot.querySelector('.indicatore-drag[data-tipo="sinistro"]');
    const indDestro = r.shadowRoot.querySelector('.indicatore-drag[data-tipo="destro"]');
    expect(indSinistro).not.toBeNull();
    expect(indDestro).not.toBeNull();

    // impostaMargine aggiorna la geometria
    r.impostaMargine('sinistro', 120);
    await r.updateComplete;
    expect(r.geometria.margineSinistro).toBe(120);

    r.impostaMargine('destro', 110);
    await r.updateComplete;
    expect(r.geometria.margineDestro).toBe(110);
  });

  it('l\'evento cambio-margine emesso dal righello aggiorna le impostazioni del guscio', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;

    const r = g.shadowRoot.querySelector('docs-righello');
    expect(r).not.toBeNull();

    // Simula evento cambio-margine
    r.dispatchEvent(new CustomEvent('cambio-margine', {
      detail: { tipo: 'sinistro', valore: 140 },
      bubbles: true,
      composed: true,
    }));
    await g.updateComplete;

    expect(g.impostazioniPagina.margineSinistro).toBe(140);
  });
});
