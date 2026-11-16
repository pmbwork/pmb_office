import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import '../../src/guscio/docs-finestra';
import { chiamaTauri, dentroTauri } from '../../src/guscio/tauri';

const w = window as unknown as Record<string, unknown>;
afterEach(() => { delete w.__TAURI__; delete w.__TAURI_INTERNALS__; });

describe('T060: chiamate alla parte nativa', () => {
  it('fuori dall\'app non succede niente e non si rompe nulla', async () => {
    expect(dentroTauri()).toBe(false);
    expect(await chiamaTauri('minimize_window')).toBeNull();
  });

  it('dentro l\'app si usa invoke (da __TAURI__.core o da __TAURI_INTERNALS__) con gli argomenti', async () => {
    const chiamate: Array<[string, unknown]> = [];
    w.__TAURI_INTERNALS__ = { invoke: async (c: string, a: unknown) => { chiamate.push([c, a]); return 'interno'; } };
    expect(dentroTauri()).toBe(true);
    expect(await chiamaTauri('uno', { x: 1 })).toBe('interno');
    w.__TAURI__ = { core: { invoke: async (c: string, a: unknown) => { chiamate.push([c, a]); return 'globale'; } } };
    expect(await chiamaTauri('due')).toBe('globale');
    expect(chiamate).toEqual([['uno', { x: 1 }], ['due', {}]]);
  });

  it('un comando che fallisce dà null invece di un errore', async () => {
    w.__TAURI__ = { core: { invoke: async () => { throw new Error('no'); } } };
    expect(await chiamaTauri('x')).toBeNull();
  });
});

describe('T060: pulsanti della finestra', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('riduci, ingrandisci e chiudi chiamano i comandi nativi giusti', async () => {
    const chiamate: string[] = [];
    w.__TAURI__ = { core: { invoke: async (c: string) => { chiamate.push(c); return null; } } };
    const f: any = document.createElement('docs-finestra');
    document.body.appendChild(f);
    await f.updateComplete;
    const b = Array.from(f.shadowRoot.querySelectorAll('button')) as HTMLButtonElement[];
    expect(b.map((x) => x.getAttribute('aria-label'))).toEqual(['Riduci a icona', 'Ingrandisci', 'Chiudi']);
    expect(b.every((x) => x.querySelector('svg') !== null)).toBe(true);
    b.forEach((x) => x.click());
    await new Promise((r) => setTimeout(r, 10));
    expect(chiamate).toEqual(['minimize_window', 'maximize_window', 'close_window']);
  });

  it('nel browser normale i pulsanti si possono premere senza errori', async () => {
    const f: any = document.createElement('docs-finestra');
    document.body.appendChild(f);
    await f.updateComplete;
    (f.shadowRoot.querySelector('button.chiudi') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(f.shadowRoot.querySelectorAll('button').length).toBe(3);
  });
});

describe('T060: nel guscio', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('la striscia per trascinare la finestra viene per prima, i pulsanti ci sono, il resto resta come prima', async () => {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    const figli = Array.from(g.shadowRoot.children).filter((e: any) => e.tagName !== 'STYLE') as HTMLElement[];
    expect(figli[0].className).toBe('trascina');
    expect(g.shadowRoot.querySelector('docs-finestra')).not.toBeNull();
    expect(g.shadowRoot.querySelector('.intestazione .titolo-documento')).not.toBeNull();
    expect(g.shadowRoot.querySelector('docs-menubar')).not.toBeNull();
    expect(g.shadowRoot.querySelector('main.area-editor .pagina docs-editor')).not.toBeNull();
  });
});
