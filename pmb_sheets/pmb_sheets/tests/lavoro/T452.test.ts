// T452: in pmb_sheets la freccia c'è solo sulle voci con un vero sottomenu, e il sottomenu si apre passandoci sopra.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/menubar';
import { menuRegistry } from '../../src/registry/menu';

type El = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };
beforeEach(() => { document.body.innerHTML = ''; });

describe('T452: frecce e sottomenu (sheets)', () => {
  it('nei dati ogni voce con subitems ne ha almeno una vera', () => {
    const giro = (items: typeof menuRegistry[number]['items'], dove: string): void => {
      for (const i of items) if (i.subitems) { expect(i.subitems.filter((s) => !s.separator).length, `${dove} › ${i.label}`).toBeGreaterThan(0); giro(i.subitems, `${dove} › ${i.label}`); }
    };
    for (const c of menuRegistry) giro(c.items, c.label);
  });
  it('freccia solo con sottomenu; il passaggio del mouse apre il sottomenu senza clic', async () => {
    const el = document.createElement('free-menubar') as El;
    el.setAttribute('doc-type', 'sheet');
    document.body.appendChild(el);
    await el.updateComplete;
    const titoli = Array.from(el.shadowRoot.querySelectorAll('.menu-btn')) as HTMLElement[];
    expect(titoli.length).toBeGreaterThan(0);
    let provate = 0;
    for (const t of titoli) {
      t.click();
      await el.updateComplete;
      const righe = Array.from(el.shadowRoot.querySelectorAll('.dropdown-menu > .dropdown-item')) as HTMLElement[];
      for (const r of righe) {
        const haSotto = r.classList.contains('has-sub');
        expect(!!r.querySelector(':scope > .chevron'), r.textContent ?? '').toBe(haSotto);
        r.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const aperta = !!r.querySelector(':scope > .submenu');
        expect(aperta, r.textContent ?? '').toBe(haSotto);
        provate++;
      }
    }
    expect(provate).toBeGreaterThan(40);
  });
});
