// T471: la finestra Preferenze come quella di pmb_sheets (un riquadro per argomento: Tema, Lingua del programma, Correttore ortografico)
// e il tema «Come il sistema», che segue il tema chiaro o scuro di Windows (o del Mac) e cambia con lui.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { ripulisciPreferenze } from '../../src/guscio/preferenze';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));

// un tema di sistema finto, che il test può cambiare
let scuro = false;
const ascoltatori = new Set<() => void>();
const matchMediaVero = window.matchMedia;
beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  scuro = false;
  ascoltatori.clear();
  window.matchMedia = ((q: string) => ({
    get matches() { return q.includes('dark') ? scuro : false; },
    media: q,
    addEventListener: (_: string, f: () => void) => ascoltatori.add(f),
    removeEventListener: (_: string, f: () => void) => ascoltatori.delete(f),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { window.matchMedia = matchMediaVero; });

async function guscio(pref: object = {}): Promise<any> {
  localStorage.setItem('pmb_docs.preferenze', JSON.stringify({ interfaccia: 'it', ...pref }));
  const g: any = document.createElement('docs-guscio');
  document.body.appendChild(g);
  await g.updateComplete;
  return g;
}
async function preferenze(g: any): Promise<any> {
  g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'strumenti', voce: 'Preferenze' }, bubbles: true, composed: true }));
  await attendi(); await g.updateComplete;
  const dlg: any = g.shadowRoot.querySelector('docs-preferenze');
  await dlg.updateComplete;
  return dlg;
}
const salvate = (): any => JSON.parse(localStorage.getItem('pmb_docs.preferenze')!);

describe('T471: finestra Preferenze e tema «Come il sistema»', () => {
  it('la finestra ha i riquadri Tema, Lingua del programma e Correttore ortografico; tema e lingua si scelgono con pulsanti di opzione', async () => {
    const dlg = await preferenze(await guscio());
    expect(Array.from(dlg.shadowRoot.querySelectorAll('legend')).map((l: any) => l.textContent.trim())).toEqual(['Tema', 'Lingua del programma', 'Correttore ortografico']);
    const etichette = (nome: string): string[] => Array.from(dlg.shadowRoot.querySelectorAll(`input[name="${nome}"]`)).map((r: any) => r.parentElement.textContent.trim());
    expect(etichette('tema')).toEqual(['Chiaro', 'Scuro', 'Come il sistema']);
    expect(etichette('interfaccia')).toEqual(['Automatica (come Windows)', 'Italiano', 'English']);
    expect(dlg.shadowRoot.querySelector('select[aria-label="Lingua del programma"]')).toBeNull();
  });

  it('«Come il sistema» si salva e segue il sistema: chiaro, poi scuro appena il sistema cambia', async () => {
    const g = await guscio();
    const dlg = await preferenze(g);
    const sistema = dlg.shadowRoot.querySelector('input[data-tema="sistema"]') as HTMLInputElement;
    sistema.checked = true; sistema.dispatchEvent(new Event('change'));
    await attendi(); await g.updateComplete;
    expect(salvate().tema).toBe('sistema');
    expect(g.tema).toBe('chiaro');
    scuro = true;
    ascoltatori.forEach((f) => f());
    await g.updateComplete;
    expect(g.tema).toBe('scuro');
  });

  it('con un tema scelto a mano il cambio del sistema non conta', async () => {
    const g = await guscio({ tema: 'chiaro' });
    scuro = true;
    ascoltatori.forEach((f) => f());
    await g.updateComplete;
    expect(g.tema).toBe('chiaro');
  });

  it('Visualizza › Modalità ha anche «Tema di sistema», con la spunta quando è quello scelto', async () => {
    scuro = true;
    const g = await guscio();
    const barra: any = g.shadowRoot.querySelector('docs-menubar');
    barra.dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'visualizza', voce: 'Tema di sistema', padre: 'Modalità' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    expect(salvate().tema).toBe('sistema');
    expect(g.tema).toBe('scuro');
    expect(barra.spuntate).toContain('visualizza›Modalità›Tema di sistema');
    expect(barra.spuntate).not.toContain('visualizza›Modalità›Tema scuro');
  });

  it('le preferenze salvate accettano «sistema» e rifiutano valori sconosciuti', () => {
    expect(ripulisciPreferenze({ tema: 'sistema' }).tema).toBe('sistema');
    expect(ripulisciPreferenze({ tema: 'arcobaleno' }).tema).toBe('chiaro');
  });
});
