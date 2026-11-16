import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';

async function montaGuscio(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T410: Temi Chiaro/Scuro e CSP Compliance', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('DocsGuscio ha tema chiaro predefinito e supporta impostaTema e alternaTema', async () => {
    const el = await montaGuscio();
    expect(el.tema).toBe('chiaro');

    el.impostaTema('scuro');
    await el.updateComplete;
    expect(el.tema).toBe('scuro');
    expect(el.getAttribute('tema')).toBe('scuro');

    el.alternaTema();
    await el.updateComplete;
    expect(el.tema).toBe('chiaro');
    expect(el.getAttribute('tema')).toBe('chiaro');

    el.alternaTema();
    await el.updateComplete;
    expect(el.tema).toBe('scuro');
  });

  it('Menu Visualizza > Tema scuro e Tema chiaro commutano il tema', async () => {
    const el = await montaGuscio();
    const menu = q(el, 'docs-menubar');

    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'visualizza', voce: 'Tema scuro' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;
    expect(el.tema).toBe('scuro');

    menu?.dispatchEvent(new CustomEvent('voce-menu', {
      detail: { menu: 'visualizza', voce: 'Tema chiaro' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;
    expect(el.tema).toBe('chiaro');
  });

  it('nessun elemento in DocsGuscio ha stili in linea in tema chiaro o scuro (CSP compliant)', async () => {
    const el = await montaGuscio();
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.impostaTema('scuro');
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);

    el.impostaTema('chiaro');
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
