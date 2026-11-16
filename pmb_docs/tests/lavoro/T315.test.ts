import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { popupAllineaRientro, popupElenchi, popupPerComando, statoBarra } from '../../src/guscio/popup-dati';
import { cursore, daTesto, statoIniziale, type Documento } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('T315: i due popup nuovi', () => {
  it('Elenchi puntati e numerati: tre voci, senza spunta se il paragrafo non è in un elenco', () => {
    const p = popupElenchi();
    expect(p.tipo).toBe('lista');
    expect(p.titolo).toBe('Elenchi puntati e numerati');
    expect(p.voci.map((v) => [v.etichetta, v.attiva])).toEqual([['Elenco puntato', false], ['Elenco numerato', false], ['Elenco di attività', false]]);
    expect(p.voci.map((v) => v.azione)).toEqual([{ tipo: 'elenco', elenco: 'p' }, { tipo: 'elenco', elenco: 'n' }, { tipo: 'elenco', elenco: 't' }]);
  });

  it('la spunta sta sull\'elenco del paragrafo', () => {
    const doc = daTesto('uno');
    doc.paragrafi[0].el = 'n';
    const s = statoBarra({ doc, sel: cursore(0, 0), pendenti: null });
    expect(popupElenchi(s).voci.map((v) => v.attiva)).toEqual([false, true, false]);
    doc.paragrafi[0].el = 'p';
    expect(popupElenchi(statoBarra({ doc, sel: cursore(0, 0), pendenti: null })).voci.map((v) => v.attiva)).toEqual([true, false, false]);
  });

  it('Allinea e applica rientro: quattro allineamenti e due rientri', () => {
    const p = popupAllineaRientro();
    expect(p.tipo).toBe('lista');
    expect(p.titolo).toBe('Allinea e applica rientro');
    expect(p.voci.map((v) => v.etichetta)).toEqual(['Sinistra', 'Al centro', 'Destra', 'Giustificato', 'Riduci rientro', 'Aumenta rientro']);
    expect(p.voci.map((v) => v.azione)).toEqual([
      { tipo: 'allinea', valore: 'sx' }, { tipo: 'allinea', valore: 'ce' }, { tipo: 'allinea', valore: 'dx' }, { tipo: 'allinea', valore: 'gi' },
      { tipo: 'rientro', delta: -1 }, { tipo: 'rientro', delta: 1 },
    ]);
  });

  it('di partenza il paragrafo è a sinistra; con un altro allineamento la spunta si sposta; i rientri non hanno mai la spunta', () => {
    expect(popupAllineaRientro().voci.map((v) => v.attiva)).toEqual([true, false, false, false, false, false]);
    const doc = daTesto('uno');
    doc.paragrafi[0].al = 'dx';
    const s = statoBarra({ doc, sel: cursore(0, 0), pendenti: null });
    expect(popupAllineaRientro(s).voci.map((v) => v.attiva)).toEqual([false, false, true, false, false, false]);
  });

  it('gli altri popup restano quelli di prima', () => {
    expect(popupPerComando('allineamento')!.voci).toHaveLength(4);
    expect(popupPerComando('interlinea')).not.toBeNull();
    expect(popupPerComando('stile-paragrafo')).not.toBeNull();
  });
});

async function guscio(doc: Documento = daTesto('uno\ndue\ntre')): Promise<{ g: any; ed: any }> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(doc), sel: cursore(1, 1) });
  await g.updateComplete;
  return { g, ed };
}
const popup = (g: any): any => g.shadowRoot.querySelector('docs-popup');
const barraMenu = (g: any): any => g.shadowRoot.querySelector('docs-menubar');
/** La voce del menu aperto con quell'etichetta. */
const voceAperta = (g: any, etichetta: string): HTMLElement | undefined =>
  (Array.from(barraMenu(g).shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta);
/** Apre il menu e passa con il mouse sulla voce (senza clic): restituisce il sottomenu che si è aperto, o null. */
async function passaSopra(g: any, menu: string, etichetta: string): Promise<HTMLElement | null> {
  const barra = barraMenu(g);
  await barra.updateComplete;
  // il clic sul titolo apre il menu; se è già aperto lo richiuderebbe
  if (!barra.shadowRoot.querySelector(`.pannello[data-menu="${menu}"]`)) (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  voceAperta(g, etichetta)!.dispatchEvent(new MouseEvent('mouseenter'));
  await barra.updateComplete;
  return voceAperta(g, etichetta)!.querySelector('.sottopannello');
}
const etichetteSotto = (s: HTMLElement): string[] => Array.from(s.querySelectorAll('.figlio .etichetta')).map((e) => (e.textContent ?? '').trim());
/** Sceglie una voce di un sottomenu del menu Formato passandoci sopra e facendo clic sulla sotto-voce. */
async function scegliSotto(g: any, voce: string, testo: string): Promise<void> {
  const s = (await passaSopra(g, 'formato', voce))!;
  (Array.from(s.querySelectorAll('.figlio')) as HTMLElement[]).find((f) => (f.querySelector('.etichetta')?.textContent ?? '').trim() === testo)!.click();
  await attendi();
  await g.updateComplete;
}
const menuAperto = (g: any): boolean => !!barraMenu(g).shadowRoot.querySelector('.pannello');

beforeEach(() => { document.body.innerHTML = ''; });

describe('T315: le voci del menu Formato con sotto-voci sono sottomenu (freccia, si aprono passandoci sopra)', () => {
  it('Allinea e applica rientro ha la freccia e, passandoci sopra, apre il sottomenu con le sei voci (senza riquadro a parte)', async () => {
    const { g } = await guscio();
    const s = await passaSopra(g, 'formato', 'Allinea e applica rientro');
    expect(voceAperta(g, 'Allinea e applica rientro')!.querySelector('.freccia')).not.toBeNull();
    expect(s).not.toBeNull();
    expect(etichetteSotto(s!)).toEqual(['Sinistra', 'Al centro', 'Destra', 'Giustificato', 'Riduci rientro', 'Aumenta rientro']);
    expect(popup(g)).toBeNull();
  });

  it('scegliere Al centro allinea il paragrafo del cursore e chiude il menu', async () => {
    const { g, ed } = await guscio();
    await scegliSotto(g, 'Allinea e applica rientro', 'Al centro');
    expect(ed.stato.doc.paragrafi.map((p: any) => p.al)).toEqual([undefined, 'ce', undefined]);
    expect(menuAperto(g)).toBe(false);
    expect(popup(g)).toBeNull();
  });

  it('scegliere Aumenta rientro e poi Riduci rientro cambia il rientro del paragrafo', async () => {
    const { g, ed } = await guscio();
    await scegliSotto(g, 'Allinea e applica rientro', 'Aumenta rientro');
    expect(ed.stato.doc.paragrafi[1].ri).toBe(1);
    await scegliSotto(g, 'Allinea e applica rientro', 'Riduci rientro');
    expect(ed.stato.doc.paragrafi[1].ri ?? 0).toBe(0);
  });

  it('Elenchi puntati e numerati: il sottomenu ha i tre elenchi e Elenco puntato fa del paragrafo un elenco', async () => {
    const { g, ed } = await guscio();
    expect(etichetteSotto((await passaSopra(g, 'formato', 'Elenchi puntati e numerati'))!)).toEqual(['Elenco puntato', 'Elenco numerato', 'Elenco di attività']);
    await scegliSotto(g, 'Elenchi puntati e numerati', 'Elenco puntato');
    expect(ed.stato.doc.paragrafi.map((p: any) => p.el)).toEqual([undefined, 'p', undefined]);
  });

  it('Elenco numerato mette il numero', async () => {
    const { g, ed } = await guscio();
    await scegliSotto(g, 'Elenchi puntati e numerati', 'Elenco numerato');
    expect(ed.stato.doc.paragrafi[1].el).toBe('n');
  });

  it('Interlinea e spaziatura paragrafo: il sottomenu ha le interlinee e la scelta si applica', async () => {
    const { g, ed } = await guscio();
    const prima = etichetteSotto((await passaSopra(g, 'formato', 'Interlinea e spaziatura paragrafo'))!);
    expect(prima.length).toBeGreaterThan(1);
    const scelta = prima.find((e) => e !== prima[0] && e !== '1,15' && !e.includes('1.15')) ?? prima[1];
    await scegliSotto(g, 'Interlinea e spaziatura paragrafo', scelta);
    expect(ed.stato.doc.paragrafi[1].ls).toBeDefined();
  });

  it('Stili paragrafo: il sottomenu ha gli stili e Titolo 1 si applica', async () => {
    const { g, ed } = await guscio();
    expect(etichetteSotto((await passaSopra(g, 'formato', 'Stili paragrafo'))!)).toContain('Titolo 1');
    await scegliSotto(g, 'Stili paragrafo', 'Titolo 1');
    expect(ed.stato.doc.paragrafi[1].st).toBeDefined();
    expect(ed.stato.doc.paragrafi[0].st ?? 'n').toBe('n');
  });

  it('la spunta sta sulla scelta del paragrafo (allineamento a destra già impostato)', async () => {
    const doc = daTesto('uno\ndue\ntre');
    doc.paragrafi[1].al = 'dx';
    const { g } = await guscio(doc);
    const s = (await passaSopra(g, 'formato', 'Allinea e applica rientro'))!;
    expect(Array.from(s.querySelectorAll('.figlio[aria-checked="true"] .etichetta')).map((e) => (e.textContent ?? '').trim())).toEqual(['Destra']);
  });

  it('ogni voce del menu Formato con sotto-voci calcolate ne ha almeno una (Tabella e Immagine dicono che cosa serve)', async () => {
    const { g } = await guscio();
    for (const voce of ['Stili paragrafo', 'Allinea e applica rientro', 'Interlinea e spaziatura paragrafo', 'Elenchi puntati e numerati', 'Tabella', 'Immagine']) {
      const s = await passaSopra(g, 'formato', voce);
      expect(s, voce).not.toBeNull();
      expect(s!.querySelectorAll('.figlio').length, voce).toBeGreaterThan(0);
    }
    const tabella = (await passaSopra(g, 'formato', 'Tabella'))!;
    expect(etichetteSotto(tabella)).toEqual(['Metti il cursore in una tabella']);
    expect(tabella.querySelector('.figlio')!.classList.contains('disabilitata')).toBe(true);
  });

  it('passando su una voce senza sottomenu il sottomenu calcolato si chiude', async () => {
    const { g } = await guscio();
    expect(await passaSopra(g, 'formato', 'Stili paragrafo')).not.toBeNull();
    voceAperta(g, 'Cancella formattazione')!.dispatchEvent(new MouseEvent('mouseenter'));
    await barraMenu(g).updateComplete;
    expect(barraMenu(g).shadowRoot.querySelector('.sottopannello')).toBeNull();
  });

  it('le voci di Formato già collegate funzionano ancora (Intestazioni e piè di pagina)', async () => {
    const { g } = await guscio();
    const barra = barraMenu(g);
    (barra.shadowRoot.querySelector('button.titolo-menu[data-menu="formato"]') as HTMLButtonElement).click();
    await barra.updateComplete;
    voceAperta(g, 'Intestazioni e piè di pagina')!.click();
    await attendi();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-margini')).not.toBeNull();
  });

  it('una voce con lo stesso nome ma di un altro menu non apre niente', async () => {
    const { g } = await guscio();
    const barra: any = barraMenu(g);
    for (const nome of ['Allinea e applica rientro', 'Stili paragrafo', 'Elenchi puntati e numerati', 'Interlinea e spaziatura paragrafo']) {
      barra.dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'modifica', voce: nome }, bubbles: true, composed: true }));
      await attendi();
      expect(popup(g), nome).toBeNull();
    }
  });
});
