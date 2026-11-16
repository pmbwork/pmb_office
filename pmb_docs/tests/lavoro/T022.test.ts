import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-menubar';
import { MENU } from '../../src/guscio/menu-dati';

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-menubar');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const titoli = (el: any) => Array.from(el.shadowRoot.querySelectorAll('button.titolo-menu')) as HTMLButtonElement[];
const pannelli = (el: any) => Array.from(el.shadowRoot.querySelectorAll('.pannello')) as HTMLElement[];
const titolo = (el: any, id: string) => titoli(el).find((b) => b.dataset.menu === id)!;

describe('T022: docs-menubar', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('mostra gli otto titoli dei menu, in ordine', async () => {
    const el = await monta();
    expect(titoli(el).map((b) => (b.textContent ?? '').trim())).toEqual(['File', 'Modifica', 'Visualizza', 'Inserisci', 'Formato', 'Strumenti', 'Informazioni', 'Segnalazione bug']);
    expect(titoli(el).map((b) => b.dataset.menu)).toEqual(MENU.map((m) => m.id));
  });

  it('all\'inizio nessun pannello aperto e i bottoni hanno gli attributi di accessibilità', async () => {
    const el = await monta();
    expect(pannelli(el).length).toBe(0);
    for (const b of titoli(el)) {
      if (b.dataset.menu === 'segnalazione') { expect(b.getAttribute('aria-haspopup')).toBe('false'); expect(b.hasAttribute('aria-expanded')).toBe(false); continue; } // «Segnalazione bug» apre subito la finestra, non un pannello
      expect(b.getAttribute('aria-haspopup')).toBe('menu');
      expect(b.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('un clic su Formato apre il suo pannello con le 14 voci', async () => {
    const el = await monta();
    titolo(el, 'formato').click();
    await el.updateComplete;
    expect(pannelli(el).length).toBe(1);
    const p = pannelli(el)[0];
    expect(p.getAttribute('role')).toBe('menu');
    expect(p.dataset.menu).toBe('formato');
    const voci = Array.from(p.querySelectorAll('.voce'));
    expect(voci.length).toBe(14);
    expect(titolo(el, 'formato').getAttribute('aria-expanded')).toBe('true');
  });

  it('ogni voce mostra etichetta, scorciatoia e freccia come nei dati', async () => {
    const el = await monta();
    titolo(el, 'formato').click();
    await el.updateComplete;
    const voci = Array.from(pannelli(el)[0].querySelectorAll('.voce')) as HTMLElement[];
    const dati = MENU.find((m) => m.id === 'formato')!.voci;
    voci.forEach((v, i) => {
      expect((v.querySelector('.etichetta')?.textContent ?? '').trim()).toBe(dati[i].etichetta);
      expect((v.querySelector('.scorciatoia')?.textContent ?? '').trim()).toBe(dati[i].scorciatoia ?? '');
      expect(!!v.querySelector('.freccia')).toBe(!!(dati[i].figli || dati[i].dinamico));
    });
    expect(voci[0].querySelector('.freccia')?.textContent?.trim()).toBe('►');
  });

  it('aprire un altro menu chiude il precedente: ce n\'è sempre uno solo', async () => {
    const el = await monta();
    titolo(el, 'file').click(); await el.updateComplete;
    titolo(el, 'modifica').click(); await el.updateComplete;
    expect(pannelli(el).length).toBe(1);
    expect(pannelli(el)[0].dataset.menu).toBe('modifica');
    expect(titolo(el, 'file').getAttribute('aria-expanded')).toBe('false');
  });

  it('un secondo clic sullo stesso titolo chiude il pannello', async () => {
    const el = await monta();
    titolo(el, 'inserisci').click(); await el.updateComplete;
    titolo(el, 'inserisci').click(); await el.updateComplete;
    expect(pannelli(el).length).toBe(0);
  });

  it('il tasto Esc chiude il pannello', async () => {
    const el = await monta();
    titolo(el, 'strumenti').click(); await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(pannelli(el).length).toBe(0);
  });

  it('un clic su una voce chiude il pannello e lancia l\'evento voce-menu', async () => {
    const el = await monta();
    let ricevuto: any = null;
    el.addEventListener('voce-menu', (e: Event) => { ricevuto = (e as CustomEvent).detail; });
    titolo(el, 'file').click(); await el.updateComplete;
    const apri = (Array.from(pannelli(el)[0].querySelectorAll('.voce')) as HTMLElement[]).find((v) => (v.querySelector('.etichetta')?.textContent ?? '').trim() === 'Apri')!;
    apri.click(); await el.updateComplete;
    expect(ricevuto).toEqual({ menu: 'file', voce: 'Apri' });
    expect(pannelli(el).length).toBe(0);
  });
});
