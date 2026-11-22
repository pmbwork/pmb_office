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
  it('la finestra ha i riquadri Tema, Lingua del programma, Correttore ortografico e Correzione automatica (T530); tema e lingua si scelgono con pulsanti di opzione', async () => {
    const dlg = await preferenze(await guscio());
    expect(Array.from(dlg.shadowRoot.querySelectorAll('legend')).map((l: any) => l.textContent.trim())).toEqual(['Tema', 'Lingua del programma', 'Correttore ortografico', 'Correzione automatica', 'Commenti e revisioni']);
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
    const g = await guscio({ tema: 'chiaro', temaScelto: true });
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
    expect(ripulisciPreferenze({ tema: 'arcobaleno' }).tema).toBe('sistema');
  });

  // T472: il tema predefinito è quello del computer (regola dell'utente, 2026-11-18)
  it('senza preferenze il programma segue il tema del computer, anche quando cambia', async () => {
    scuro = true;
    const g = await guscio();
    expect(g.tema).toBe('scuro');
    scuro = false;
    ascoltatori.forEach((f) => f());
    await g.updateComplete;
    expect(g.tema).toBe('chiaro');
  });
  it('un «chiaro» salvato dalle versioni precedenti senza essere stato scelto torna «Come il sistema»; quello scelto resta', () => {
    expect(ripulisciPreferenze({ tema: 'chiaro' }).tema).toBe('sistema');
    expect(ripulisciPreferenze({ tema: 'chiaro', temaScelto: true }).tema).toBe('chiaro');
    expect(ripulisciPreferenze({ tema: 'scuro' }).tema).toBe('scuro');
  });
  it('scegliere un tema dal menu lo segna come scelto, così non torna più al tema del computer', async () => {
    const g = await guscio();
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'visualizza', voce: 'Tema chiaro' }, bubbles: true, composed: true }));
    await attendi(); await g.updateComplete;
    expect(salvate()).toMatchObject({ tema: 'chiaro', temaScelto: true });
    scuro = true;
    ascoltatori.forEach((f) => f());
    await g.updateComplete;
    expect(g.tema).toBe('chiaro');
  });
  it('nel tema scuro il guscio ridefinisce tutte le variabili dei colori usate dai componenti', async () => {
    const { TEMA_SCURO } = await import('../../src/guscio/misure');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = 'src/guscio';
    const usate = new Set<string>();
    for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/var\((--pmb-[\w-]+),/g)) usate.add(m[1]);
    expect(usate.size).toBeGreaterThan(5);
    for (const v of usate) expect(TEMA_SCURO, v).toContain(v + ':');
    expect(TEMA_SCURO).toContain('color-scheme: dark');
  });
});
