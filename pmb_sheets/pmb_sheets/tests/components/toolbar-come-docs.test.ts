// La barra degli strumenti di pmb_sheets è personalizzabile come quella di pmb_docs (regola del progetto, progetti/pmb_office/REGOLE.md):
// pulsante Funzioni (pezzo di puzzle) con tutte le funzioni e la puntina, freccia che nasconde i menu, Visualizza › Nascondi i menu, Ctrl+Maiusc+F;
// e le icone sono quelle comuni della suite.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/main';
import '../../src/components/toolbar';
import { ICONE } from '@comune/icone';
import { icons } from '../../src/assets/icons/index';
import { menuRegistry } from '../../src/registry/menu';
import { barraPredefinita } from '../../src/sheet/barra-personalizzata';

const attendi = (ms = 20): Promise<void> => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

async function barra(): Promise<any> {
  const el: any = document.createElement('free-toolbar');
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('barra degli strumenti di pmb_sheets come quella di pmb_docs', () => {
  it('le icone di pmb_sheets sono l\'insieme comune della suite', () => {
    expect(icons).toBe(ICONE);
    expect(icons.extension).toContain('<svg');
  });

  it('a destra ci sono il pulsante Funzioni (pezzo di puzzle) e la freccia dei menu', async () => {
    const el = await barra();
    const funzioni = el.shadowRoot.querySelector('#btn-funzioni');
    expect(funzioni).not.toBeNull();
    // il browser riscrive l'SVG quando lo inserisce: si confronta il tracciato del disegno
    const tracciato = funzioni.querySelector('svg path')?.getAttribute('d') ?? '';
    expect(tracciato.length).toBeGreaterThan(10);
    expect(ICONE.extension).toContain(tracciato);
    expect(el.shadowRoot.querySelector('#btn-nascondi-menu').getAttribute('aria-label')).toBe('Nascondi i menu');
  });

  it('il pannello Funzioni elenca tutte le funzioni; la puntina mette nella barra una funzione che non c\'è e toglie una che c\'è', async () => {
    const el = await barra();
    el.shadowRoot.querySelector('#btn-funzioni').click();
    await el.updateComplete;
    const pannello = el.shadowRoot.querySelector('.pannello-funzioni');
    expect(pannello).not.toBeNull();
    const righe = Array.from(pannello.querySelectorAll('.riga-funzione')) as HTMLElement[];
    expect(righe.length).toBeGreaterThan(40);
    const cambi: string[][] = [];
    el.addEventListener('barra-cambiata', (e: CustomEvent) => cambi.push(e.detail.barra));
    const voceMenu = righe.find((r) => r.dataset.funzione!.startsWith('menu:') && !barraPredefinita().includes(r.dataset.funzione!))!;
    expect(voceMenu.querySelector('.puntina')!.getAttribute('aria-pressed')).toBe('false');
    (voceMenu.querySelector('.puntina') as HTMLButtonElement).click();
    expect(cambi[0]).toContain(voceMenu.dataset.funzione);
    const grassetto = righe.find((r) => r.dataset.funzione === 'bold')!;
    expect(grassetto.querySelector('.puntina')!.getAttribute('aria-pressed')).toBe('true');
    (grassetto.querySelector('.puntina') as HTMLButtonElement).click();
    expect(cambi[1]).not.toContain('bold');
  });

  it('la ricerca nel pannello filtra le funzioni', async () => {
    const el = await barra();
    el.shadowRoot.querySelector('#btn-funzioni').click();
    await el.updateComplete;
    const cerca = el.shadowRoot.querySelector('.cerca-funzioni') as HTMLInputElement;
    cerca.value = 'grassetto';
    cerca.dispatchEvent(new Event('input'));
    await el.updateComplete;
    const righe = Array.from(el.shadowRoot.querySelectorAll('.riga-funzione')) as HTMLElement[];
    expect(righe.length).toBeGreaterThan(0);
    expect(righe.every((r) => (r.textContent ?? '').toLowerCase().includes('grassetto'))).toBe(true);
  });

  it('Visualizza ha «Nascondi i menu» con Ctrl+Maiusc+F, come pmb_docs', () => {
    const visualizza = menuRegistry.find((m) => m.items.some((i) => i.id === 'toggle-fullscreen'))!;
    const voce = visualizza.items.find((i) => i.id === 'nascondi-menu')!;
    expect(voce.label).toBe('Nascondi i menu');
    expect(voce.shortcut).toBe('Ctrl+Maiusc+F');
  });

  it('nella finestra: la freccia, la voce di menu e Ctrl+Maiusc+F nascondono e mostrano barra del titolo e menu, e la scelta si ricorda', async () => {
    const app: any = document.createElement('free-app');
    document.body.appendChild(app);
    await app.updateComplete; await attendi();
    expect(app.renderRoot.querySelector('free-menubar')).not.toBeNull();
    const toolbar = app.renderRoot.querySelector('free-toolbar');
    await toolbar.updateComplete;
    toolbar.shadowRoot.querySelector('#btn-nascondi-menu').click();
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-menubar')).toBeNull();
    expect(app.renderRoot.querySelector('free-titlebar')).toBeNull();
    expect(localStorage.getItem('pmb_sheets.menu_nascosti')).toBe('1');
    await toolbar.updateComplete;
    expect(toolbar.shadowRoot.querySelector('#btn-nascondi-menu').getAttribute('aria-label')).toBe('Mostra i menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true }));
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-menubar')).not.toBeNull();
    expect(localStorage.getItem('pmb_sheets.menu_nascosti')).toBe('0');
  });
});
