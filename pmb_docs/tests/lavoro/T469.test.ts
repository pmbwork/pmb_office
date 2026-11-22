// T469: correzioni dal controllo di tutte le funzioni nel programma vero: le voci che accendono o spengono qualcosa mostrano la spunta,
// «Mostra layout di stampa» è un interruttore vero, nascondere il righello toglie anche la sua striscia, il conteggio parole si traduce.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-conteggio';
import { impostaLingua } from '../../src/i18n/lingua';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function guscio(): Promise<any> { const g: any = document.createElement('docs-guscio'); document.body.appendChild(g); await g.updateComplete; return g; }
const mb = (g: any): any => g.shadowRoot.querySelector('docs-menubar');
const voce = (g: any, menu: string, v: string, padre?: string): void => {
  mb(g).dispatchEvent(new CustomEvent('voce-menu', { detail: padre ? { menu, voce: v, padre } : { menu, voce: v }, bubbles: true, composed: true }));
};
const etichetta = (x: Element): string => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim();
async function spunte(g: any, menu: string, padre?: string): Promise<string[]> {
  const b = mb(g);
  (b.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLElement).click();
  await b.updateComplete;
  let out: string[];
  if (padre) {
    const r = (Array.from(b.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).find((x) => etichetta(x) === padre)!;
    r.dispatchEvent(new MouseEvent('mouseenter'));
    await b.updateComplete;
    out = (Array.from(b.shadowRoot.querySelectorAll('.sottopannello .figlio')) as HTMLElement[]).filter((x) => x.querySelector(':scope > .spunta')).map(etichetta);
  } else {
    out = (Array.from(b.shadowRoot.querySelectorAll('.pannello > .voce')) as HTMLElement[]).filter((x) => x.querySelector(':scope > .spunta')).map(etichetta);
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await b.updateComplete;
  return out;
}

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); impostaLingua('it'); });

describe('T469: spunte e interruttori', () => {
  it('Visualizza: all’avvio sono spuntati layout di stampa, righello e barra delle equazioni; le spunte seguono i clic', async () => {
    const g = await guscio();
    expect(await spunte(g, 'visualizza')).toEqual(['Mostra layout di stampa', 'Mostra righello', 'Mostra barra degli strumenti delle equazioni']);
    voce(g, 'visualizza', 'Mostra caratteri non stampabili');
    voce(g, 'visualizza', 'Mostra righello');
    await attendi(); await g.updateComplete;
    expect(await spunte(g, 'visualizza')).toEqual(['Mostra layout di stampa', 'Mostra barra degli strumenti delle equazioni', 'Mostra caratteri non stampabili']);
  });

  it('«Mostra layout di stampa» spegne e riaccende le pagine', async () => {
    const g = await guscio();
    const pagina = (): string => g.shadowRoot.querySelector('.pagina').className;
    expect(pagina()).not.toContain('senza-pagine');
    voce(g, 'visualizza', 'Mostra layout di stampa');
    await attendi(); await g.updateComplete;
    expect(pagina()).toContain('senza-pagine');
    expect(await spunte(g, 'visualizza')).not.toContain('Mostra layout di stampa');
    voce(g, 'visualizza', 'Mostra layout di stampa');
    await attendi(); await g.updateComplete;
    expect(pagina()).not.toContain('senza-pagine');
  });

  it('nascondere il righello toglie anche la striscia (e il righello verticale)', async () => {
    const g = await guscio();
    voce(g, 'visualizza', 'Mostra righello');
    await attendi(); await g.updateComplete;
    expect(g.hasAttribute('senza-righello')).toBe(true);
    expect(g.shadowRoot.querySelector('docs-righello')).toBeNull();
    expect(g.shadowRoot.querySelector('docs-righello-verticale')).toBeNull();
    voce(g, 'visualizza', 'Mostra righello');
    await attendi(); await g.updateComplete;
    expect(g.hasAttribute('senza-righello')).toBe(false);
    expect(g.shadowRoot.querySelector('docs-righello')).not.toBeNull();
  });

  it('spunte nei sottomenu: tema, colonne, lingua del correttore; numeri di riga', async () => {
    const g = await guscio();
    expect(await spunte(g, 'visualizza', 'Modalità')).toEqual(['Tema di sistema']); // predefinito: segue il tema del computer
    expect(await spunte(g, 'formato', 'Colonne')).toEqual(['1 colonna']);
    expect(await spunte(g, 'file', 'Correttore lingua')).toEqual(['Italiano']);
    voce(g, 'formato', '2 colonne', 'Colonne');
    voce(g, 'visualizza', 'Tema scuro', 'Modalità');
    voce(g, 'strumenti', 'Numeri di riga');
    await attendi(); await g.updateComplete;
    expect(await spunte(g, 'formato', 'Colonne')).toEqual(['2 colonne']);
    expect(await spunte(g, 'visualizza', 'Modalità')).toEqual(['Tema scuro']);
    expect(await spunte(g, 'strumenti')).toContain('Numeri di riga');
  });

  it('conteggio parole con una selezione: «3 di 10» in italiano, «3 of 10» in inglese', async () => {
    const c: any = document.createElement('docs-conteggio');
    c.dati = { pagine: 1, parole: 10, paroleSel: 3, caratteri: 50, caratteriSel: 12, caratteriNoSpazi: 40, caratteriNoSpaziSel: 10, haSelezione: true };
    document.body.appendChild(c);
    await c.updateComplete;
    expect(c.shadowRoot.querySelector('[data-campo="parole"]').textContent.trim()).toBe('3 di 10');
    impostaLingua('en');
    await attendi(); await c.updateComplete;
    expect(c.shadowRoot.querySelector('[data-campo="parole"]').textContent.trim()).toBe('3 of 10');
  });
});
