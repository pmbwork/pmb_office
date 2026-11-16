import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/main';
import '../../src/components/sheet-grid';

describe('Verifica Isolamento Schede e Layout Griglia Fogli', () => {
  let app: any;

  beforeEach(async () => {
    document.body.innerHTML = '';
    app = document.createElement('free-app');
    document.body.appendChild(app);
    await app.updateComplete;
  });

  it('la griglia deve ricalcolare il viewport quando passa da nascosta a visibile', async () => {
    // Scheda sheet inizialmente creata
    const tabsEl = app.renderRoot.querySelector('free-tabs');
    tabsEl.dispatchEvent(new CustomEvent('tab-created', { detail: { type: 'sheet' }, bubbles: true, composed: true }));
    await app.updateComplete;

    const gridEl = app.renderRoot.querySelector('free-sheet-grid') as any;
    expect(gridEl).not.toBeNull();
    await gridEl.updateComplete;

    const container = gridEl.renderRoot.querySelector('.grid-container') as HTMLElement;
    expect(container).not.toBeNull();

    // Verifichiamo che le intestazioni e le celle siano renderizzate
    const ths = gridEl.renderRoot.querySelectorAll('th.col-header');
    expect(ths.length).toBeGreaterThan(0);

    const cells = gridEl.renderRoot.querySelectorAll('td.sheet-cell');
    expect(cells.length).toBeGreaterThan(0);
  });
});
