// T472: il tema predefinito è quello del computer e lo si segue anche quando cambia a programma aperto (regola dell'utente, 2026-11-18).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { currentTheme: string }

let scuro = false;
const ascoltatori = new Set<() => void>();
const matchMediaVero = window.matchMedia;
let impostazioni: unknown = null;

async function monta(): Promise<App & Dentro> {
  (window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: { invoke: vi.fn(async (cmd: string) => (cmd === 'get_settings' ? impostazioni : null)) } };
  const app = document.createElement('free-app') as App & Dentro;
  document.body.appendChild(app);
  await app.updateComplete;
  await vi.waitFor(() => expect(document.documentElement.getAttribute('data-theme')).not.toBeNull());
  return app;
}
const temaSullaPagina = (): string | null => document.documentElement.getAttribute('data-theme');
const sistemaCambia = (diventaScuro: boolean): void => { scuro = diventaScuro; ascoltatori.forEach((f) => f()); };

beforeEach(() => {
  scuro = false; ascoltatori.clear(); impostazioni = null;
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  defaultDocumentStore.clear();
  window.matchMedia = ((q: string) => ({
    get matches() { return q.includes('dark') && scuro; },
    media: q,
    addEventListener: (_: string, f: () => void) => ascoltatori.add(f),
    removeEventListener: (_: string, f: () => void) => ascoltatori.delete(f),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = matchMediaVero;
  impostaLocaleNumeri('en');
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
});

describe('T472: tema del computer', () => {
  it('senza impostazioni salvate il tema è «Come il sistema» e segue il computer quando cambia', async () => {
    scuro = true;
    const app = await monta();
    expect(app.currentTheme).toBe('system');
    expect(temaSullaPagina()).toBe('dark');
    sistemaCambia(false);
    await vi.waitFor(() => expect(temaSullaPagina()).toBe('light'));
    sistemaCambia(true);
    await vi.waitFor(() => expect(temaSullaPagina()).toBe('dark'));
  });

  it('con un tema scelto a mano il cambio del computer non conta', async () => {
    impostazioni = { theme: 'light', language: 'it' };
    const app = await monta();
    expect(app.currentTheme).toBe('light');
    sistemaCambia(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(temaSullaPagina()).toBe('light');
  });
});
