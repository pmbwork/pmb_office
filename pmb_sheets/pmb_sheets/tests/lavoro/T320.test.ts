import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string; activeTabId: string }

let app: App;
let dentro: Dentro;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  dentro = app as unknown as Dentro;
});

const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
describe('T320: Scorciatoie da tastiera', () => {
  it('scrive l\'elenco delle principali nella barra di stato', () => {
    menu('show-shortcuts', 'Scorciatoie da tastiera');
    expect(dentro.statusMessage).toContain('Ctrl+C copia');
    expect(dentro.statusMessage).toContain('Ctrl+Z annulla');
    expect(dentro.statusMessage).toContain('Ctrl+P stampa');
    expect(dentro.statusMessage.startsWith('Scorciatoie:')).toBe(true);
  });
});

describe('T320: le altre voci senza azione dicono ancora che non ci sono', () => {
  it.each(['voce-inventata'])('%s', (azione) => {
    menu(azione, 'Voce');
    expect(dentro.statusMessage).toBe('Funzione non ancora disponibile: Voce');
  });
});
