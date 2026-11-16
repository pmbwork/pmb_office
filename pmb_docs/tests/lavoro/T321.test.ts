import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { MENU } from '../../src/guscio/menu-dati';
import { daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function monta(): Promise<any> {
  const el: any = document.createElement('docs-menubar');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
const titolo = (el: any, id: string): HTMLButtonElement => el.shadowRoot.querySelector(`button.titolo-menu[data-menu="${id}"]`);
const voci = (el: any): HTMLElement[] => Array.from(el.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[];
const voceDi = (el: any, nome: string): HTMLElement => voci(el).find((v) => (v.querySelector('.etichetta')?.textContent ?? '').trim() === nome)!;
const sotto = (el: any): HTMLElement | null => el.shadowRoot.querySelector('.sottopannello');
const figli = (el: any): string[] => Array.from(el.shadowRoot.querySelectorAll('.sottopannello .figlio')).map((f: any) => (f.querySelector('.etichetta')?.textContent ?? '').trim());
async function apriFormato(el: any): Promise<void> { titolo(el, 'formato').click(); await el.updateComplete; }

beforeEach(() => { document.body.innerHTML = ''; });

describe('T321: i dati del sottomenu Testo', () => {
  it('Testo ha sei figli con le scorciatoie; le altre voci non hanno figli', () => {
    const formato = MENU.find((m) => m.id === 'formato')!.voci;
    const testo = formato.find((v) => v.etichetta === 'Testo')!;
    expect(testo.sottomenu).toBe(true);
    expect(testo.figli?.map((f) => [f.etichetta, f.scorciatoia])).toEqual([['Grassetto', 'Ctrl+B'], ['Corsivo', 'Ctrl+I'], ['Sottolineato', 'Ctrl+U'], ['Barrato', 'Alt+Maiusc+5'], ['Apice', 'Ctrl+.'], ['Pedice', 'Ctrl+,']]);
    expect(formato.filter((v) => v.figli).map((v) => v.etichetta)).toEqual(['Testo', 'Colonne', 'Bordi e linee']);
  });
});

describe('T321: il sottomenu nella barra dei menu', () => {
  it('di partenza nessun sottomenu è aperto', async () => {
    const el = await monta();
    await apriFormato(el);
    expect(sotto(el)).toBeNull();
    expect(voceDi(el, 'Testo').getAttribute('aria-expanded')).toBe('false');
  });

  it('il clic su Testo apre il sottomenu e non sceglie niente', async () => {
    const el = await monta();
    let scelte = 0;
    el.addEventListener('voce-menu', () => { scelte += 1; });
    await apriFormato(el);
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    expect(sotto(el)).not.toBeNull();
    expect(figli(el)).toEqual(['Grassetto', 'Corsivo', 'Sottolineato', 'Barrato', 'Apice', 'Pedice']);
    expect(voceDi(el, 'Testo').getAttribute('aria-expanded')).toBe('true');
    expect(scelte).toBe(0);
    expect(el.shadowRoot.querySelectorAll('.pannello').length).toBe(1);
  });

  it('passare col mouse su Testo lo apre e passare su una voce senza figli lo chiude', async () => {
    const el = await monta();
    await apriFormato(el);
    voceDi(el, 'Testo').dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(sotto(el)).not.toBeNull();
    voceDi(el, 'Cancella formattazione').dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    expect(sotto(el)).toBeNull();
  });

  it('il clic dopo il passaggio del mouse lo lascia aperto', async () => {
    const el = await monta();
    await apriFormato(el);
    voceDi(el, 'Testo').dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    expect(sotto(el)).not.toBeNull();
  });

  it('scegliere un figlio manda voce-menu con la voce e il padre e chiude tutto', async () => {
    const el = await monta();
    const viste: any[] = [];
    el.addEventListener('voce-menu', (e: any) => viste.push(e.detail));
    await apriFormato(el);
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    (el.shadowRoot.querySelectorAll('.sottopannello .figlio')[1] as HTMLElement).click();
    await el.updateComplete;
    expect(viste).toEqual([{ menu: 'formato', voce: 'Corsivo', padre: 'Testo' }]);
    expect(el.shadowRoot.querySelectorAll('.pannello').length).toBe(0);
    expect(sotto(el)).toBeNull();
  });

  it('le voci senza figli mandano voce-menu come prima, senza padre', async () => {
    const el = await monta();
    const viste: any[] = [];
    el.addEventListener('voce-menu', (e: any) => viste.push(e.detail));
    await apriFormato(el);
    voceDi(el, 'Cancella formattazione').click();
    await el.updateComplete;
    expect(viste).toEqual([{ menu: 'formato', voce: 'Cancella formattazione' }]);
  });

  it('Esc chiude il pannello e il sottomenu; riaprendo il menu il sottomenu è chiuso', async () => {
    const el = await monta();
    await apriFormato(el);
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll('.pannello').length).toBe(0);
    await apriFormato(el);
    expect(sotto(el)).toBeNull();
  });

  it('cambiare menu chiude il sottomenu', async () => {
    const el = await monta();
    await apriFormato(el);
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    titolo(el, 'strumenti').click();
    await el.updateComplete;
    expect(sotto(el)).toBeNull();
    titolo(el, 'formato').click();
    await el.updateComplete;
    expect(sotto(el)).toBeNull();
  });

  it('il sottomenu sta dentro la voce Testo', async () => {
    const el = await monta();
    await apriFormato(el);
    voceDi(el, 'Testo').click();
    await el.updateComplete;
    expect(voceDi(el, 'Testo').contains(sotto(el))).toBe(true);
    expect(sotto(el)!.getAttribute('role')).toBe('menu');
    expect(sotto(el)!.dataset.sotto).toBe('Testo');
  });
});

async function guscio(): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('uno due')), sel: { ancora: { p: 0, o: 0 }, fuoco: { p: 0, o: 3 } } });
  await g.updateComplete;
  return { g, ed };
}
async function scegliTesto(g: any, figlio: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
  await barra.updateComplete;
  const testo = (Array.from(barra.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Testo')!;
  testo.click();
  await barra.updateComplete;
  const f = (Array.from(barra.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === figlio)!;
  f.click();
  await attendi();
  await g.updateComplete;
}

describe('T321: Formato › Testo nella finestra', () => {
  it('Grassetto mette in grassetto la parola selezionata e solo quella', async () => {
    const { g, ed } = await guscio();
    await scegliTesto(g, 'Grassetto');
    const runs = ed.stato.doc.paragrafi[0].runs;
    expect(runs.map((r: any) => [r.t, r.g])).toEqual([['uno', true], [' due', false]]);
  });

  it('Corsivo e Sottolineato fanno lo stesso con il loro segno', async () => {
    const { g, ed } = await guscio();
    await scegliTesto(g, 'Corsivo');
    await scegliTesto(g, 'Sottolineato');
    const r = ed.stato.doc.paragrafi[0].runs[0];
    expect([r.t, r.c, r.s]).toEqual(['uno', true, true]);
  });

  it('sceglierlo due volte toglie il formato', async () => {
    const { g, ed } = await guscio();
    await scegliTesto(g, 'Grassetto');
    await scegliTesto(g, 'Grassetto');
    expect(ed.stato.doc.paragrafi[0].runs.every((r: any) => r.g === false)).toBe(true);
  });

  it('il menu si chiude e le altre voci Formato funzionano ancora', async () => {
    const { g } = await guscio();
    await scegliTesto(g, 'Grassetto');
    const barra: any = g.shadowRoot.querySelector('docs-menubar');
    expect(barra.shadowRoot.querySelectorAll('.pannello').length).toBe(0);
    (barra.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
    await barra.updateComplete;
    (Array.from(barra.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === 'Elenchi puntati e numerati')!.click();
    await attendi();
    await g.updateComplete;
    // Elenchi puntati e numerati è un sottomenu anche lui: si apre lì, senza riquadro a parte
    expect(barra.shadowRoot.querySelector('.sottopannello')).not.toBeNull();
    expect(g.shadowRoot.querySelector('docs-popup')).toBeNull();
  });
});
