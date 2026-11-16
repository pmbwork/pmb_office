import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { Recupero, LUNGHEZZA_MASSIMA_RECUPERO, type Archivio } from '../../src/formati/recupero';
import { defaultDocumentStore } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; recupero: Recupero; controllaRecupero(): Promise<void> };
interface Dentro { tabs: Array<{ id: string }>; statusMessage: string }

const archivio = (riesce: boolean): Archivio => ({ leggi: () => null, scrivi: () => riesce, cancella: () => undefined });

async function avvia(riesce = true) {
  const app = document.createElement('free-app') as App;
  app.recupero = new Recupero(archivio(riesce));
  document.body.appendChild(app);
  await app.updateComplete;
  const dentro = app as unknown as Dentro;
  return { app, dentro };
}

async function modifica(app: App, dentro: Dentro, testo: string) {
  const doc = defaultDocumentStore.getOrCreateDocument(dentro.tabs.at(-1)!.id);
  await app.controllaRecupero();               // il primo sguardo fissa il riferimento
  await doc.client.setCell(doc.activeSheetName, 1, 1, testo);
}

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); defaultDocumentStore.clear(); });
afterEach(() => { localStorage.clear(); });

describe('T496: avviso se la copia di emergenza non si scrive', () => {
  it('foglio troppo grande: la barra di stato lo dice, una volta sola', async () => {
    const { app, dentro } = await avvia();
    await modifica(app, dentro, 'x'.repeat(LUNGHEZZA_MASSIMA_RECUPERO + 10));
    await app.controllaRecupero();
    expect(app.recupero.esito).toBe('troppo-grande');
    expect(dentro.statusMessage).toMatch(/troppo grande|molto grande/i);
    expect(dentro.statusMessage).toMatch(/salva spesso/i);
    dentro.statusMessage = 'altro messaggio';
    await modifica(app, dentro, 'y'.repeat(LUNGHEZZA_MASSIMA_RECUPERO + 20));
    await app.controllaRecupero();
    expect(dentro.statusMessage).not.toMatch(/salva spesso/i);   // l'avviso non si ripete a ogni controllo
  });

  it('deposito che non scrive: avviso diverso', async () => {
    const { app, dentro } = await avvia(false);
    await modifica(app, dentro, 'ciao');
    await app.controllaRecupero();
    expect(app.recupero.esito).toBe('errore');
    expect(dentro.statusMessage).toMatch(/non si riesce a scrivere/);
  });

  it('con la copia scritta bene non si dice niente', async () => {
    const { app, dentro } = await avvia(true);
    const prima = dentro.statusMessage;
    await modifica(app, dentro, 'ciao');
    await app.controllaRecupero();
    expect(app.recupero.esito).toBe('scritto');
    expect(dentro.statusMessage).toBe(prima);
  });
});
