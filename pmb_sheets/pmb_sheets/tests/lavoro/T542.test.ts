// T542 (pmb_sheets): quando la domanda di uscita compare, la pagina lo dice alla shell (proteggi_chiusura): una seconda X mentre la domanda è
// aperta (doppio clic, due Alt+F4) trova la domanda invece di chiudere senza salvare (analisi del 2026-11-18, visto sul programma installato).
// La parte nativa (decidi_chiusura in src-tauri/src/lib.rs) ha i suoi test Rust. Lo stesso test c'è in pmb_docs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { Recupero, type Archivio } from '../../src/formati/recupero';
import { defaultDocumentStore } from '../../src/sheet/document-store';

function archivioFinto(): Archivio {
  let contenuto: string | null = null;
  return { leggi: () => contenuto, scrivi: (t) => { contenuto = t; return true; }, cancella: () => { contenuto = null; } };
}
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode; recupero: Recupero; controllaRecupero(): Promise<void>; richiediChiusuraApp(): Promise<void> };

const invoke = vi.fn(async (_cmd: string, _args?: unknown) => null);
const chiamate = (cmd: string) => invoke.mock.calls.filter((c) => c[0] === cmd);

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  invoke.mockClear();
  (window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: { invoke }, event: { listen: vi.fn() } };
});
afterEach(() => { delete (window as unknown as { __TAURI__?: unknown }).__TAURI__; });

describe('T542 (pmb_sheets): domanda di uscita e seconda X', () => {
  it('la domanda compare e la pagina azzera il conto della shell; una seconda richiesta non chiude', async () => {
    const app = document.createElement('free-app') as App;
    app.recupero = new Recupero(archivioFinto(), { ora: () => 5000 });
    document.body.appendChild(app);
    await app.updateComplete;
    const tabs = (app as unknown as { tabs: Array<{ id: string }> }).tabs;
    const doc = defaultDocumentStore.getOrCreateDocument(tabs.at(-1)!.id);
    await app.controllaRecupero(); // da qui in poi ogni cambiamento è una modifica
    await doc.client.setCell('Foglio1', 1, 1, 'x');
    const prima = chiamate('proteggi_chiusura').length;
    void app.richiediChiusuraApp();
    await vi.waitFor(() => expect(app.renderRoot.querySelector('free-dialogo-conferma')).not.toBeNull());
    expect(chiamate('proteggi_chiusura').length).toBe(prima + 1);
    await app.richiediChiusuraApp(); // la shell manda di nuovo l'evento: la domanda resta, niente chiusura
    expect(app.renderRoot.querySelector('free-dialogo-conferma')).not.toBeNull();
    // anche con la domanda già aperta la pagina ridice di essere viva: altrimenti la terza X entro 10 s chiudeva (prova fisica 2026-11-19)
    expect(chiamate('proteggi_chiusura').length).toBe(prima + 2);
    await app.richiediChiusuraApp();
    expect(chiamate('proteggi_chiusura').length).toBe(prima + 3);
    expect(chiamate('destroy_window')).toHaveLength(0);
  });
});
