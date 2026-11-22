// T544: finestra «Personalizza barra degli strumenti» di pmb_docs: con tanti pulsanti il riquadro della barra scorre al suo interno e non si
// restringe, come in pmb_sheets. Prima i pulsanti uscivano dal bordo e coprivano «Funzioni disponibili» e la ricerca (analisi del 2026-11-18,
// 163 px di sovrapposizione misurati sul programma installato con la finestra a 1400x900).
import { describe, it, expect } from 'vitest';
import '../../src/guscio/docs-personalizza-barra';

describe('T544: riquadro della barra nella finestra Personalizza', () => {
  const css = (customElements.get('docs-personalizza-barra') as unknown as { styles: { cssText: string } }).styles.cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const regola = css.split('}').map((r) => r.trim()).find((r) => r.startsWith('.barra {')) ?? '';
  it('ha un’altezza massima e scorre al suo interno', () => {
    expect(regola).toMatch(/max-height:\s*180px/);
    expect(regola).toMatch(/overflow-y:\s*auto/);
  });
  it('non si restringe nella colonna della finestra', () => {
    expect(regola).toMatch(/flex-shrink:\s*0/);
  });
});
