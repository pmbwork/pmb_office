import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/menubar';
import { FreeMenubar } from '../../src/components/menubar';

let barra: FreeMenubar;
const radice = (): ShadowRoot => barra.shadowRoot as ShadowRoot;

beforeEach(async () => {
  document.body.innerHTML = '';
  barra = document.createElement('free-menubar') as FreeMenubar;
  document.body.appendChild(barra);
  await barra.updateComplete;
});

/** quello che fa il mouse vero: arriva sulla voce (mouseenter) e poi clicca */
async function passaESCegli(menu: string, voce: string): Promise<void> {
  Array.from(radice().querySelectorAll<HTMLButtonElement>('.menu-btn')).find((b) => (b.textContent ?? '').trim() === menu)!.click();
  await barra.updateComplete;
  const v = Array.from(radice().querySelectorAll<HTMLElement>('.dropdown-menu > .dropdown-item')).find((x) => (x.querySelector(':scope > span')?.textContent ?? '').trim() === voce)!;
  v.dispatchEvent(new MouseEvent('mouseenter'));
  await barra.updateComplete;
  v.click();
  await barra.updateComplete;
}
const sotto = (testo: string): HTMLElement => Array.from(radice().querySelectorAll<HTMLElement>('.submenu .sub-item')).find((x) => (x.querySelector('span')?.textContent ?? '').trim() === testo)!;

describe('T310: il clic dopo il passaggio del mouse non richiude il sottomenu', () => {
  it('Visualizza › Zoom: passaggio, clic e scelta di 150% mandano l\'azione di zoom', async () => {
    await passaESCegli('Visualizza', 'Zoom');
    expect(radice().querySelector('.submenu')).not.toBeNull();
    const viste: string[] = [];
    barra.addEventListener('menu-action', (e) => viste.push((e as CustomEvent).detail.action));
    sotto('150%').click();
    expect(viste).toEqual(['zoom-150']);
  });

  it('Visualizza › Blocca: passaggio, clic e scelta di "1 riga" mandano l\'azione di blocco', async () => {
    await passaESCegli('Visualizza', 'Blocca');
    expect(radice().querySelector('.submenu')).not.toBeNull();
    const viste: string[] = [];
    barra.addEventListener('menu-action', (e) => viste.push((e as CustomEvent).detail.action));
    sotto('1 riga').click();
    expect(viste).toEqual(['freeze-rows-1']);
  });

  it('Modifica › Incolla speciale: dopo passaggio e clic le quattro voci sono lì', async () => {
    await passaESCegli('Modifica', 'Incolla speciale');
    expect(radice().querySelectorAll('.submenu .sub-item')).toHaveLength(4);
  });

  it('il clic su una voce senza sottomenu chiude il menu come prima', async () => {
    Array.from(radice().querySelectorAll<HTMLButtonElement>('.menu-btn')).find((b) => (b.textContent ?? '').trim() === 'Modifica')!.click();
    await barra.updateComplete;
    const incolla = Array.from(radice().querySelectorAll<HTMLElement>('.dropdown-menu > .dropdown-item')).find((x) => (x.querySelector(':scope > span')?.textContent ?? '').trim() === 'Incolla')!;
    incolla.dispatchEvent(new MouseEvent('mouseenter'));
    incolla.click();
    await barra.updateComplete;
    expect(radice().querySelector('.dropdown-menu')).toBeNull();
  });
});
