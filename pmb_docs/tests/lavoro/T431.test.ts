// T431: righello verticale, Salva e Salva con nome, pulsanti della barra non disponibili.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { margineTrascinato } from '../../src/guscio/docs-righello-verticale';
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
async function voceMenu(g: any, menu: string, etichetta: string): Promise<void> {
  const barra: any = g.shadowRoot.querySelector('docs-menubar');
  await barra.updateComplete;
  (barra.shadowRoot.querySelector(`button.titolo-menu[data-menu="${menu}"]`) as HTMLButtonElement).click();
  await barra.updateComplete;
  const voce = (Array.from(barra.shadowRoot.querySelectorAll('.pannello .voce')) as HTMLElement[]).find((x) => (x.querySelector(':scope > .etichetta')?.textContent ?? '').trim() === etichetta)!;
  voce.click();
  await attendi(150); // l'esportazione è asincrona
  await g.updateComplete;
}

describe('T431: margineTrascinato', () => {
  const g = { altezza: 1123, margineAlto: 96, margineBasso: 96 };
  it('il margine alto cresce scendendo, il basso cresce salendo', () => {
    expect(margineTrascinato('alto', 96, 30, g)).toBe(126);
    expect(margineTrascinato('basso', 96, -30, g)).toBe(126);
    expect(margineTrascinato('basso', 96, 30, g)).toBe(66);
  });
  it('resta tra 20 px e lo spazio che lascia almeno 100 px di testo', () => {
    expect(margineTrascinato('alto', 96, -500, g)).toBe(20);
    expect(margineTrascinato('alto', 96, 5000, g)).toBe(1123 - 96 - 100);
  });
});

describe('T431: righello verticale', () => {
  it('c\'è col righello e segue i margini alto e basso; si nasconde con Mostra righello', async () => {
    const g = await guscio();
    const v = g.shadowRoot.querySelector('docs-righello-verticale');
    expect(v).not.toBeNull();
    g.impostaImpostazioniPagina({ ...g.impostazioniPagina, margineAlto: 150, margineBasso: 40 });
    await g.updateComplete;
    expect(v.geometria).toEqual({ altezza: 1123, margineAlto: 150, margineBasso: 40 });
    await voceMenu(g, 'visualizza', 'Mostra righello');
    expect(g.shadowRoot.querySelector('docs-righello-verticale')).toBeNull();
  });

  it('il trascinamento dell\'indicatore alto cambia il margine alto', async () => {
    const g = await guscio();
    const v = g.shadowRoot.querySelector('docs-righello-verticale');
    await v.updateComplete;
    const ind = v.shadowRoot.querySelector('.indicatore-drag[data-tipo="alto"]') as SVGElement;
    ind.dispatchEvent(new MouseEvent('mousedown', { clientY: 100, bubbles: true, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 140 }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientY: 140 }));
    expect(g.impostazioniPagina.margineAlto).toBe(136);
  });
});

describe('T431: Salva e Salva con nome', () => {
  function maniglia(scritture: Uint8Array[]): any {
    return { name: 'a.docx', createWritable: async () => ({ write: async (d: Uint8Array) => { scritture.push(d); }, close: async () => {} }) };
  }
  it('la prima volta chiede dove salvare, poi Salva riscrive sullo stesso file senza chiedere', async () => {
    const g = await guscio();
    const scritture: Uint8Array[] = [];
    let richieste = 0;
    g.salva = async () => { richieste++; return maniglia(scritture); };
    await voceMenu(g, 'file', 'Salva');
    expect(richieste).toBe(1);
    await voceMenu(g, 'file', 'Salva');
    expect(richieste).toBe(1);
    expect(scritture.length).toBe(1);
  });
  it('Salva con nome chiede sempre dove salvare', async () => {
    const g = await guscio();
    let richieste = 0;
    g.salva = async () => { richieste++; return maniglia([]); };
    await voceMenu(g, 'file', 'Salva');
    await voceMenu(g, 'file', 'Salva con nome');
    expect(richieste).toBe(2);
  });
  it('un documento nuovo dimentica il file di prima', async () => {
    const g = await guscio();
    let richieste = 0;
    g.salva = async () => { richieste++; return maniglia([]); };
    await voceMenu(g, 'file', 'Salva');
    g.nuovo();
    await voceMenu(g, 'file', 'Salva');
    expect(richieste).toBe(2);
  });
  it('Ctrl+S salva come la voce di menu', async () => {
    const g = await guscio();
    let richieste = 0;
    g.salva = async () => { richieste++; return maniglia([]); };
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, composed: true }));
    for (let i = 0; i < 40 && richieste === 0; i++) await attendi(50); // la catena di salvataggio è asincrona: si aspetta, non si indovina il tempo
    expect(richieste).toBe(1);
  });
});

describe('T431: pulsanti della barra non ancora disponibili', () => {
  it('non ci sono più pulsanti finti: «nascondi-menu» nasconde davvero i menu e li rimostra', async () => {
    const g = await guscio();
    expect(g.hasAttribute('menu-nascosti')).toBe(false);
    g.suComando(new CustomEvent('comando', { detail: { id: 'nascondi-menu' } }));
    await g.updateComplete;
    expect(g.hasAttribute('menu-nascosti')).toBe(true);
    g.suComando(new CustomEvent('comando', { detail: { id: 'nascondi-menu' } }));
    await g.updateComplete;
    expect(g.hasAttribute('menu-nascosti')).toBe(false);
  });
});
