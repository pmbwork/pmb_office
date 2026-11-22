import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string; currentTheme: string }

let app: App;
let dentro: Dentro;
let invoke: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  invoke = vi.fn(async (cmd: string) => (cmd === 'get_settings' ? null : null));
  (window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: { invoke } };
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  dentro = app as unknown as Dentro;
});
afterEach(() => {
  impostaLocaleNumeri('en');
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
});

const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const dialogo = (): any => app.renderRoot.querySelector('free-dialogo-preferenze');

describe('T460: schermo intero', () => {
  // dal 2026-11-18 come pmb_docs: la pagina tiene lo stato e chiede alla parte nativa di metterlo o toglierlo (imposta_schermo_intero)
  it('Visualizza > Schermo intero chiede alla finestra nativa di andare a schermo intero, e la seconda volta di uscirne', async () => {
    invoke.mockClear();
    menu('toggle-fullscreen', 'Schermo intero');
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('imposta_schermo_intero', { attivo: true }));
    expect(dentro.statusMessage).not.toBe('Funzione non ancora disponibile: Schermo intero');
    menu('toggle-fullscreen', 'Schermo intero');
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('imposta_schermo_intero', { attivo: false }));
  });

  it('il tasto F11 fa la stessa cosa, ed Esc esce dallo schermo intero (come in pmb_docs)', async () => {
    invoke.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('imposta_schermo_intero', { attivo: true }));
    invoke.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('imposta_schermo_intero', { attivo: false }));
    invoke.mockClear();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(invoke).not.toHaveBeenCalledWith('imposta_schermo_intero', expect.anything()); // fuori dallo schermo intero Esc non lo tocca
  });
});

describe('T460: preferenze', () => {
  it('Strumenti > Preferenze apre la finestra con il tema attuale segnato', async () => {
    expect(dialogo()).toBeNull();
    menu('open-preferences', 'Preferenze');
    await app.updateComplete;
    const d = dialogo();
    expect(d).not.toBeNull();
    await d.updateComplete;
    const scelto = d.renderRoot.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    expect(scelto.dataset.tema).toBe(dentro.currentTheme);
  });

  it('scegliere "Scuro" cambia il tema subito e lo salva', async () => {
    menu('open-preferences', 'Preferenze');
    await app.updateComplete;
    const d = dialogo();
    await d.updateComplete;
    invoke.mockClear();
    (d.renderRoot.querySelector('input[data-tema="dark"]') as HTMLInputElement).click();
    await vi.waitFor(() => expect(dentro.currentTheme).toBe('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('save_settings', expect.objectContaining({ settings: expect.objectContaining({ theme: 'dark' }) })));
  });

  it('Chiudi e Esc tolgono la finestra senza cambiare il tema', async () => {
    menu('open-preferences', 'Preferenze');
    await app.updateComplete;
    let d = dialogo();
    await d.updateComplete;
    const prima = dentro.currentTheme;
    (d.renderRoot.querySelector('button[data-azione="chiudi"]') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(dialogo()).toBeNull();
    expect(dentro.currentTheme).toBe(prima);

    menu('open-preferences', 'Preferenze');
    await app.updateComplete;
    d = dialogo();
    await d.updateComplete;
    d.renderRoot.querySelector('.velo')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await app.updateComplete;
    expect(dialogo()).toBeNull();
  });
});
