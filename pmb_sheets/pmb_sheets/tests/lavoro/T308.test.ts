import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/components/menubar';
import { FreeMenubar } from '../../src/components/menubar';

let barra: FreeMenubar;

async function crea(): Promise<FreeMenubar> {
  document.body.innerHTML = '';
  const b = document.createElement('free-menubar') as FreeMenubar;
  document.body.appendChild(b);
  await b.updateComplete;
  return b;
}
const radice = (): ShadowRoot => barra.shadowRoot as ShadowRoot;
const pulsanti = (): HTMLButtonElement[] => Array.from(radice().querySelectorAll<HTMLButtonElement>('.menu-btn'));
async function apri(nome: string): Promise<void> {
  const p = pulsanti().find((b) => (b.textContent ?? '').trim() === nome);
  if (!p) throw new Error(`menu ${nome} non trovato`);
  p.click();
  await barra.updateComplete;
}
const voci = (): HTMLElement[] => Array.from(radice().querySelectorAll<HTMLElement>('.dropdown-menu > .dropdown-item'));
const voce = (testo: string): HTMLElement => {
  const v = voci().find((x) => (x.querySelector(':scope > span')?.textContent ?? '').trim() === testo);
  if (!v) throw new Error(`voce ${testo} non trovata`);
  return v;
};
const sottomenu = (): HTMLElement | null => radice().querySelector('.submenu');
const sotto = (): HTMLElement[] => Array.from(radice().querySelectorAll<HTMLElement>('.submenu .sub-item'));
const etichette = (): string[] => sotto().map((s) => (s.querySelector('span')?.textContent ?? '').trim());
function tasto(key: string): void { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }
function azioni(): Array<{ action: string; label: string }> {
  const raccolte: Array<{ action: string; label: string }> = [];
  barra.addEventListener('menu-action', (e) => raccolte.push((e as CustomEvent).detail));
  return raccolte;
}

beforeEach(async () => { barra = await crea(); });

describe('T308: sottomenu della barra dei menu', () => {
  it('le voci con sottomenu hanno la freccia, le altre no', async () => {
    await apri('Modifica');
    const speciale = voce('Incolla speciale');
    expect(speciale.classList.contains('has-sub')).toBe(true);
    expect(speciale.querySelector('.chevron')!.textContent).toBe('▸');
    expect(speciale.getAttribute('aria-haspopup')).toBe('menu');
    expect(speciale.getAttribute('aria-expanded')).toBe('false');
    const incolla = voce('Incolla');
    expect(incolla.classList.contains('has-sub')).toBe(false);
    expect(incolla.querySelector('.chevron')).toBeNull();
    expect(incolla.getAttribute('aria-haspopup')).toBe('false');
    expect(incolla.querySelector('.shortcut')!.textContent).toBe('Ctrl+V');
    expect(sottomenu()).toBeNull();
  });

  it('un clic su Incolla speciale apre il sottomenu con le quattro voci e le scorciatoie, senza chiudere il menu', async () => {
    await apri('Modifica');
    const raccolte = azioni();
    voce('Incolla speciale').click();
    await barra.updateComplete;
    expect(sottomenu()).not.toBeNull();
    expect(etichette()).toEqual(['Solo valori', 'Solo formato', 'Formule senza formato', 'Trasposto']);
    expect(sotto()[0].querySelector('.shortcut')!.textContent).toBe('Ctrl+Shift+V');
    expect(voce('Incolla speciale').getAttribute('aria-expanded')).toBe('true');
    expect(radice().querySelector('.dropdown-menu')).not.toBeNull();
    expect(raccolte).toEqual([]);
  });

  it('con il mouse: il passaggio apre il sottomenu e il clic che segue lo lascia aperto, anche ripetuto', async () => {
    await apri('Modifica');
    voce('Incolla speciale').dispatchEvent(new MouseEvent('mouseenter'));
    await barra.updateComplete;
    voce('Incolla speciale').click();
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    expect(sotto()[0].classList.contains('focused')).toBe(true);
    sotto()[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await barra.updateComplete;
    voce('Incolla speciale').click();
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    expect(voce('Incolla speciale').getAttribute('aria-expanded')).toBe('true');
    expect(sotto()[2].classList.contains('focused')).toBe(true);
  });

  it('scegliere una voce del sottomenu manda l\'azione con la sua etichetta e chiude tutto', async () => {
    await apri('Modifica');
    const raccolte = azioni();
    voce('Incolla speciale').click();
    await barra.updateComplete;
    sotto()[0].click();
    await barra.updateComplete;
    expect(raccolte).toEqual([{ action: 'paste-special-values', label: 'Solo valori' }]);
    expect(sottomenu()).toBeNull();
    expect(radice().querySelector('.dropdown-menu')).toBeNull();
  });

  it('ogni voce del sottomenu manda la sua azione, non quella della voce che lo contiene', async () => {
    await apri('Modifica');
    voce('Incolla speciale').click();
    await barra.updateComplete;
    const azioniViste: string[] = [];
    for (let i = 0; i < 4; i++) {
      const raccolte = azioni();
      sotto()[i].click();
      azioniViste.push(raccolte[0].action);
      await apri('Modifica');
      voce('Incolla speciale').click();
      await barra.updateComplete;
    }
    expect(azioniViste).toEqual(['paste-special-values', 'paste-special-format', 'paste-special-formulas', 'paste-special-transposed']);
  });

  it('il passaggio del mouse apre il sottomenu e passando a un\'altra voce lo chiude', async () => {
    await apri('Modifica');
    voce('Incolla speciale').dispatchEvent(new MouseEvent('mouseenter'));
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    voce('Incolla').dispatchEvent(new MouseEvent('mouseenter'));
    await barra.updateComplete;
    expect(sottomenu()).toBeNull();
  });

  it('il passaggio del mouse su una voce del sottomenu non lo chiude', async () => {
    await apri('Modifica');
    voce('Incolla speciale').dispatchEvent(new MouseEvent('mouseenter'));
    await barra.updateComplete;
    sotto()[2].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    expect(sotto()[2].classList.contains('focused')).toBe(true);
    expect(sotto()[0].classList.contains('focused')).toBe(false);
  });

  it('Visualizza ha Zoom con cinque voci e Blocca con nove voci e due separatori', async () => {
    await apri('Visualizza');
    voce('Zoom').click();
    await barra.updateComplete;
    expect(etichette()).toEqual(['50%', '75%', '100%', '125%', '150%']);
    voce('Blocca').click();
    await barra.updateComplete;
    expect(etichette()).toEqual(['Nessuna riga', '1 riga', '2 righe', 'Nessuna colonna', '1 colonna', '2 colonne', 'Fino alla riga corrente', 'Fino alla colonna corrente', 'Fino alla cella corrente']);
    expect(radice().querySelectorAll('.submenu .separator')).toHaveLength(2);
    expect(radice().querySelectorAll('.submenu')).toHaveLength(1);
  });

  it('le voci di Zoom e di Blocca mandano le azioni del registro', async () => {
    await apri('Visualizza');
    voce('Zoom').click();
    await barra.updateComplete;
    const z = azioni();
    sotto()[3].click();
    expect(z).toEqual([{ action: 'zoom-125', label: '125%' }]);
    await apri('Visualizza');
    voce('Blocca').click();
    await barra.updateComplete;
    const b = azioni();
    sotto()[4].click();
    expect(b).toEqual([{ action: 'freeze-cols-1', label: '1 colonna' }]);
  });

  it('chiudere il menu o passare a un altro menu azzera il sottomenu', async () => {
    await apri('Modifica');
    voce('Incolla speciale').click();
    await barra.updateComplete;
    await apri('Visualizza');
    expect(sottomenu()).toBeNull();
    await apri('Modifica');
    expect(sottomenu()).toBeNull();
    voce('Incolla speciale').click();
    await barra.updateComplete;
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await barra.updateComplete;
    expect(radice().querySelector('.dropdown-menu')).toBeNull();
    await apri('Modifica');
    expect(sottomenu()).toBeNull();
  });
});

describe('T308: sottomenu da tastiera', () => {
  async function conIncollaSpeciale(): Promise<void> {
    await apri('Modifica');
    const indice = voci().indexOf(voce('Incolla speciale'));
    for (let i = 0; i < 20 && !voci()[indice].classList.contains('focused'); i++) { tasto('ArrowDown'); await barra.updateComplete; }
    expect(voci()[indice].classList.contains('focused')).toBe(true);
  }

  it('Freccia destra su una voce con sottomenu lo apre e mette il cursore sulla prima voce, senza cambiare menu', async () => {
    await conIncollaSpeciale();
    tasto('ArrowRight');
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    expect(sotto()[0].classList.contains('focused')).toBe(true);
    expect(pulsanti().find((p) => p.classList.contains('active'))!.textContent!.trim()).toBe('Modifica');
  });

  it('Invio su una voce con sottomenu lo apre', async () => {
    await conIncollaSpeciale();
    tasto('Enter');
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
  });

  it('Freccia giù e su nel sottomenu girano tra le sue voci; Invio sceglie quella col cursore', async () => {
    await conIncollaSpeciale();
    tasto('ArrowRight');
    await barra.updateComplete;
    tasto('ArrowDown');
    tasto('ArrowDown');
    await barra.updateComplete;
    expect(sotto()[2].classList.contains('focused')).toBe(true);
    tasto('ArrowUp');
    await barra.updateComplete;
    expect(sotto()[1].classList.contains('focused')).toBe(true);
    tasto('ArrowUp');
    tasto('ArrowUp');
    await barra.updateComplete;
    expect(sotto()[3].classList.contains('focused')).toBe(true);
    tasto('ArrowDown');
    await barra.updateComplete;
    expect(sotto()[0].classList.contains('focused')).toBe(true);
    const raccolte = azioni();
    tasto('ArrowDown');
    tasto('Enter');
    await barra.updateComplete;
    expect(raccolte).toEqual([{ action: 'paste-special-format', label: 'Solo formato' }]);
    expect(radice().querySelector('.dropdown-menu')).toBeNull();
  });

  it('nel sottomenu di Blocca la freccia salta il separatore', async () => {
    await apri('Visualizza');
    const indice = voci().indexOf(voce('Blocca'));
    for (let i = 0; i < 20 && !voci()[indice].classList.contains('focused'); i++) { tasto('ArrowDown'); await barra.updateComplete; }
    tasto('ArrowRight');
    await barra.updateComplete;
    for (let i = 0; i < 3; i++) tasto('ArrowDown');
    await barra.updateComplete;
    expect(etichette()[sotto().findIndex((s) => s.classList.contains('focused'))]).toBe('Nessuna colonna');
  });

  it('Escape chiude solo il sottomenu; un secondo Escape chiude il menu', async () => {
    await conIncollaSpeciale();
    tasto('ArrowRight');
    await barra.updateComplete;
    tasto('Escape');
    await barra.updateComplete;
    expect(sottomenu()).toBeNull();
    expect(radice().querySelector('.dropdown-menu')).not.toBeNull();
    tasto('Escape');
    await barra.updateComplete;
    expect(radice().querySelector('.dropdown-menu')).toBeNull();
  });

  it('Freccia sinistra chiude il sottomenu e il menu resta aperto', async () => {
    await conIncollaSpeciale();
    tasto('ArrowRight');
    await barra.updateComplete;
    tasto('ArrowLeft');
    await barra.updateComplete;
    expect(sottomenu()).toBeNull();
    expect(radice().querySelector('.dropdown-menu')).not.toBeNull();
    expect(pulsanti().find((p) => p.classList.contains('active'))!.textContent!.trim()).toBe('Modifica');
  });

  it('con il sottomenu aperto Freccia destra non fa cambiare menu e il tasto è assorbito', async () => {
    await conIncollaSpeciale();
    tasto('ArrowRight');
    await barra.updateComplete;
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    await barra.updateComplete;
    expect(etichette()).toHaveLength(4);
    expect(pulsanti().find((p) => p.classList.contains('active'))!.textContent!.trim()).toBe('Modifica');
  });

  it('Freccia destra su una voce senza sottomenu passa al menu seguente', async () => {
    await apri('Modifica');
    tasto('ArrowRight');
    await barra.updateComplete;
    expect(pulsanti().find((p) => p.classList.contains('active'))!.textContent!.trim()).toBe('Visualizza');
  });
});

describe('T308: aspetto del sottomenu', () => {
  it('il sottomenu si apre a destra della voce, sopra il menu', () => {
    const css = ((customElements.get('free-menubar') as unknown as { styles: { cssText: string } }).styles.cssText).replace(/\s+/g, ' ');
    expect(css).toContain('.submenu { position: absolute; top: -5px; left: 100%;');
    expect(css).toContain('z-index: 1001;');
    expect(css).toContain('.dropdown-item.has-sub { position: relative; }');
  });
});
