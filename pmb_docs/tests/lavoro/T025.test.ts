import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-guscio');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const q = (el: any, sel: string) => el.shadowRoot.querySelector(sel) as HTMLElement | null;

describe('T025: docs-guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('contiene intestazione con il titolo, barra dei menu, barra strumenti, righello e foglio A4', async () => {
    const el = await monta();
    expect(q(el, '.logo-app')?.getAttribute('aria-label')).toBe('pmb_docs'); // il logo orizzontale contiene già il nome
    expect(q(el, '.intestazione .badge-app')).toBeNull();
    expect(q(el, '.intestazione .titolo-documento')?.textContent?.trim()).toBe('Documento senza titolo');
    expect(q(el, '.intestazione button.stella')).toBeNull(); // la stella dei preferiti non serviva a niente: tolta
    expect(q(el, 'docs-menubar')).not.toBeNull();
    expect(q(el, '.contenitore-strumenti docs-toolbar')).not.toBeNull();
    expect(q(el, '.righello')).not.toBeNull();
    expect(q(el, 'main.area-editor .pagina')).not.toBeNull();
  });

  it('i pezzi sono nell\'ordine giusto dall\'alto in basso', async () => {
    const el = await monta();
    const figli = Array.from(el.shadowRoot.children).map((n: any) => (n.localName === 'docs-menubar' ? 'menu' : n.className));
    expect(figli.filter((x: string) => ['intestazione', 'menu', 'contenitore-strumenti', 'righello', 'area-editor'].includes(x))).toEqual(['intestazione', 'menu', 'contenitore-strumenti', 'righello', 'area-editor']);
  });

  it('la barra strumenti riceve la larghezza della finestra', async () => {
    const el = await monta();
    const barra: any = q(el, 'docs-toolbar');
    expect(barra.larghezza).toBe(window.innerWidth);
  });

  it('quando la finestra cambia larghezza la barra strumenti si aggiorna', async () => {
    const el = await monta();
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await el.updateComplete;
    const barra: any = q(el, 'docs-toolbar');
    expect(barra.larghezza).toBe(800);
    await barra.updateComplete;
    expect(barra.shadowRoot.querySelectorAll('button.comando:not(.fisso)').length).toBe(9);
  });

  it('il foglio ha un ruolo accessibile e non usa stili in linea', async () => {
    const el = await monta();
    expect(q(el, '.pagina')?.getAttribute('role')).toBe('textbox');
    expect(el.shadowRoot.querySelectorAll('[style]').length).toBe(0);
  });
});
