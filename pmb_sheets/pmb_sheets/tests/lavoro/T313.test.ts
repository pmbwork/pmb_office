import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { Recupero, type Archivio } from '../../src/formati/recupero';
import { DocumentStore, defaultDocumentStore, type SheetDocument } from '../../src/sheet/document-store';
import { estraiDati } from '../../src/formati/documento';
import { serializeSheetDocumentData } from '../../src/sheet/document-data';

function archivioFinto() {
  const a = {
    contenuto: null as string | null,
    scritture: [] as string[],
    cancellazioni: 0,
    leggi(): string | null { return a.contenuto; },
    scrivi(t: string): boolean { a.scritture.push(t); a.contenuto = t; return true; },
    cancella(): void { a.cancellazioni++; a.contenuto = null; },
  };
  return a as Archivio & typeof a;
}

type App = HTMLElement & {
  updateComplete: Promise<unknown>; renderRoot: ParentNode; recupero: Recupero; controllaRecupero(): Promise<void>;
  segnaVuoto(id: string): void; fotografa(doc: SheetDocument): Promise<string>; foglioVuoto: Promise<string> | null;
};
interface Dentro { tabs: Array<{ id: string; title: string; type: string }>; activeTabId: string }

async function avvia() {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  localStorage.clear();
  const a = archivioFinto();
  const app = document.createElement('free-app') as App;
  app.recupero = new Recupero(a, { ora: () => 5000 });
  document.body.appendChild(app);
  await app.updateComplete;
  // il foglio di partenza ha il suo riferimento appena l'app è su
  await vi.waitFor(async () => expect(await app.foglioVuoto).toBeTypeOf('string'));
  await new Promise((r) => setTimeout(r, 20));
  return { app, a, dentro: app as unknown as Dentro };
}
const doc = (app: App, id: string): SheetDocument => defaultDocumentStore.getOrCreateDocument(id);
async function nuovoFoglio(app: App, dentro: Dentro): Promise<SheetDocument> {
  await app.updateComplete;
  await new Promise((r) => setTimeout(r, 20));
  return doc(app, dentro.tabs.at(-1)!.id);
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('T313: il riferimento dei fogli appena nati', () => {
  it('un foglio vuoto vivo e uno nuovo hanno lo stesso contenuto in formato .fsheet', async () => {
    const { app } = await avvia();
    const vivo = serializeSheetDocumentData(await estraiDati(doc(app, 'tab-1')));
    const nuovo = serializeSheetDocumentData(await estraiDati(new DocumentStore().getOrCreateDocument('x')));
    expect(vivo).toBe(nuovo);
    expect(await app.foglioVuoto).toBe(nuovo);
  });

  it('il foglio di partenza: se si scrive prima del primo controllo la copia c\'è lo stesso', async () => {
    const { app, a } = await avvia();
    await doc(app, 'tab-1').client.setCell('Foglio1', 1, 1, 'scritto subito');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0]).schede[0].dati).toContain('scritto subito');
  });

  it('un foglio creato dopo: se si scrive prima del primo controllo la copia c\'è lo stesso', async () => {
    const { app, a, dentro } = await avvia();
    const d = await nuovoFoglio(app, dentro);
    await d.client.setCell('Foglio1', 2, 3, 'altro');
    await app.controllaRecupero();
    expect(a.scritture).toHaveLength(1);
    expect(JSON.parse(a.scritture[0]).schede[0].titolo).toBe(dentro.tabs.at(-1)!.title);
  });

  it('se il primo controllo viene prima del riferimento, quando il riferimento arriva la modifica conta lo stesso', async () => {
    const { app, a, dentro } = await avvia();
    await app.updateComplete;
    const d = doc(app, dentro.tabs.at(-1)!.id);
    await d.client.setCell('Foglio1', 1, 1, 'x');
    await app.controllaRecupero();
    await new Promise((r) => setTimeout(r, 30));
    await app.controllaRecupero();
    expect(a.scritture.length).toBeGreaterThan(0);
    expect(a.contenuto).not.toBeNull();
  });

  it('fogli vuoti e mai toccati non producono copie, controllo dopo controllo', async () => {
    const { app, a, dentro } = await avvia();
    await nuovoFoglio(app, dentro);
    for (let i = 0; i < 3; i++) await app.controllaRecupero();
    expect(a.scritture).toEqual([]);
    expect(a.contenuto).toBeNull();
  });

  it('scrivere e poi svuotare la cella: la copia si aggiorna e non contiene più il testo (il foglio interno non torna identico a prima, quindi la copia resta)', async () => {
    const { app, a, dentro } = await avvia();
    const d = await nuovoFoglio(app, dentro);
    await d.client.setCell('Foglio1', 1, 1, 'temporaneo');
    await app.controllaRecupero();
    expect(a.contenuto).toContain('temporaneo');
    await d.client.setCell('Foglio1', 1, 1, '');
    await app.controllaRecupero();
    expect(a.contenuto).not.toBeNull();
    expect(a.contenuto).not.toContain('temporaneo');
  });

  it('il riferimento si calcola una volta sola per tutti i fogli', async () => {
    const { app, dentro } = await avvia();
    const fotografa = vi.spyOn(app, 'fotografa');
    await nuovoFoglio(app, dentro);
    await nuovoFoglio(app, dentro);
    expect(fotografa).not.toHaveBeenCalled();
  });

  it('File > Nuovo rifà il riferimento del foglio vuoto con l\'identificativo del documento', async () => {
    const { app, dentro } = await avvia();
    const segna = vi.spyOn(app, 'segnaPulita');
    await nuovoFoglio(app, dentro);
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'new-sheet', label: 'Nuovo' }, bubbles: true, composed: true }));
    await vi.waitFor(() => expect(segna).toHaveBeenCalledTimes(1));
    expect(segna).toHaveBeenCalledWith('tab-1');
  });


  it('se il riferimento non si riesce a calcolare l\'app continua e lo dice sulla console', async () => {
    const { app } = await avvia();
    const avviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    app.foglioVuoto = null;
    vi.spyOn(app, 'fotografa').mockRejectedValueOnce(new Error('motore fermo'));
    app.segnaVuoto('tab-x');
    await vi.waitFor(() => expect(avviso).toHaveBeenCalled());
    await expect(app.controllaRecupero()).resolves.toBeUndefined();
  });
});
