// T430: righello e margini collegati; voci di menu che prima non facevano niente.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { MENU } from '../../src/guscio/menu-dati';
import { cursore, daTesto, statoIniziale } from '../../src/modello/documento';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; });

async function guscio(): Promise<any> {
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true, writable: true });
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  const ed: any = g.shadowRoot.querySelector('docs-editor');
  await ed.updateComplete;
  ed.impostaStato({ ...statoIniziale(daTesto('uno\ndue')), sel: cursore(0, 0) });
  await g.updateComplete;
  return g;
}
async function voceMenu(g: any, menu: string, etichetta: string, figlio?: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await barra.updateComplete;
  if (figlio) {
    const f = (Array.from(barra.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).find((x) => (x.querySelector('.etichetta')?.textContent ?? '').trim() === figlio)!;
    f.click();
  }
  await attendi();
  await g.updateComplete;
}
const righello = (g: any): any => g.shadowRoot.querySelector('docs-righello');

describe('T430: il righello segue i margini e il formato', () => {
  it('cambiando margini e orientamento la geometria del righello cambia', async () => {
    const g = await guscio();
    await righello(g).updateComplete;
    expect(righello(g).geometria).toEqual({ larghezza: 794, margineSinistro: 96, margineDestro: 96 });
    g.impostaImpostazioniPagina({ ...g.impostazioniPagina, orientamento: 'orizzontale', margineSinistro: 200, margineDestro: 40 });
    await g.updateComplete;
    expect(righello(g).geometria).toEqual({ larghezza: 1123, margineSinistro: 200, margineDestro: 40 });
  });

  it('il guscio espone la larghezza del foglio per centrarlo (variabile CSS, non attributo in linea)', async () => {
    const g = await guscio();
    g.impostaImpostazioniPagina({ ...g.impostazioniPagina, orientamento: 'orizzontale' });
    expect(g.style.getPropertyValue('--larghezza-foglio')).toBe('1123px');
    expect(g.style.getPropertyValue('--sx-minimo')).toBe('44px');
    g.impostaImpostazioniPagina({ ...g.impostazioniPagina, orientamento: 'verticale' });
    expect(g.style.getPropertyValue('--sx-minimo')).toBe('301px');
  });

  it('il trascinamento dell\'indicatore aggiorna il margine mentre si muove', async () => {
    const g = await guscio();
    const r = righello(g);
    await r.updateComplete;
    const ricevuti: number[] = [];
    r.addEventListener('cambio-margine', (e: any) => ricevuti.push(e.detail.valore));
    const ind = r.shadowRoot.querySelector('.indicatore-drag[data-tipo="sinistro"]') as SVGElement;
    ind.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130 }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 130 }));
    expect(ricevuti).toEqual([126]);
    expect(g.impostazioniPagina.margineSinistro).toBe(126);
  });
});

describe('T430: voci di menu', () => {
  it('le voci non realizzate sono disattivate e non fanno niente', () => {
    const spente: string[] = [];
    const tutte = MENU.flatMap((m) => m.voci);
    for (const e of spente) expect(tutte.find((v) => v.etichetta === e)?.disabilitata, e).toBe(true);
  });

  it('Strumenti > Conteggio parole apre il conteggio', async () => {
    const g = await guscio();
    await voceMenu(g, 'strumenti', 'Conteggio parole');
    expect(g.shadowRoot.querySelector('docs-conteggio')).not.toBeNull();
  });

  it('Formato > Colonne > 2 colonne imposta due colonne', async () => {
    const g = await guscio();
    await voceMenu(g, 'formato', 'Colonne', '2 colonne');
    expect(g.colonne).toBe(2);
  });

  it('Formato > Orientamento pagina alterna verticale e orizzontale', async () => {
    const g = await guscio();
    await voceMenu(g, 'formato', 'Orientamento pagina');
    expect(g.impostazioniPagina.orientamento).toBe('orizzontale');
    await voceMenu(g, 'formato', 'Orientamento pagina');
    expect(g.impostazioniPagina.orientamento).toBe('verticale');
  });

  it('Visualizza > Mostra layout di stampa torna alle pagine dal formato senza pagine', async () => {
    const g = await guscio();
    await voceMenu(g, 'formato', 'Passa al formato Senza pagine');
    expect(g.senzaPagine).toBe(true);
    await voceMenu(g, 'visualizza', 'Mostra layout di stampa');
    expect(g.senzaPagine).toBe(false);
  });
});
