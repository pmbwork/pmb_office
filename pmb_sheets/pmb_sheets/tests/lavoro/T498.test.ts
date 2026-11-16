import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { impostaLocaleNumeri } from '../../src/sheet/locale-numeri';

type Griglia = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ShadowRoot; toggleOrtografia: () => string; startEditing: (x: boolean) => void };
type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
interface Dentro { statusMessage: string }
let app: App;
let griglia: Griglia;

const monta = async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
};
const barra = () => griglia.renderRoot.querySelector('input.formula-input') as HTMLInputElement;
const f7 = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F7', bubbles: true }));

beforeEach(async () => { localStorage.clear(); vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['it-IT', 'en-GB']); await monta(); });
afterEach(() => { localStorage.clear(); impostaLocaleNumeri('en'); vi.restoreAllMocks(); });

describe('T498: controllo ortografico', () => {
  it('di partenza è spento: il campo di scrittura non chiede il correttore', async () => {
    expect(barra().getAttribute('spellcheck')).toBe('false');
  });

  it('F7 lo accende, lo dice nella barra di stato e lo ricorda; un secondo F7 lo spegne', async () => {
    f7();
    await app.updateComplete; await griglia.updateComplete;
    expect((app as unknown as Dentro).statusMessage).toMatch(/Controllo ortografico acceso/);
    expect(barra().getAttribute('spellcheck')).toBe('true');
    expect(localStorage.getItem('pmb_sheets.ortografia')).toBe('1');
    f7();
    await app.updateComplete; await griglia.updateComplete;
    expect((app as unknown as Dentro).statusMessage).toBe('Controllo ortografico spento');
    expect(barra().getAttribute('spellcheck')).toBe('false');
    expect(localStorage.getItem('pmb_sheets.ortografia')).toBe('0');
  });

  it('la voce di menu "Controllo ortografico" fa la stessa cosa', async () => {
    app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'spelling', label: 'Controllo ortografico' }, bubbles: true, composed: true }));
    await app.updateComplete; await griglia.updateComplete;
    expect((app as unknown as Dentro).statusMessage).toMatch(/acceso/);
    expect(barra().getAttribute('spellcheck')).toBe('true');
  });

  it('la scelta si ritrova alla prossima apertura del programma', async () => {
    griglia.toggleOrtografia();
    await monta();
    expect(barra().getAttribute('spellcheck')).toBe('true');
  });

  it('con il correttore acceso le formule non vengono controllate, il testo sì', async () => {
    griglia.toggleOrtografia();
    const campo = barra();
    campo.value = 'questo è un testo';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await griglia.updateComplete;
    expect(barra().getAttribute('spellcheck')).toBe('true');
    campo.value = '=SOMMA(A1:A3)';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await griglia.updateComplete;
    expect(barra().getAttribute('spellcheck')).toBe('false');
  });

  it('la lingua del campo segue quella dei numeri del programma', async () => {
    expect(['it', 'en']).toContain(barra().getAttribute('lang'));
  });

  it('in italiano, se Windows non ha il dizionario italiano, non si accende e dice come aggiungerlo', async () => {
    impostaLocaleNumeri('it');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'en', 'en-US']);
    const msg = griglia.toggleOrtografia();
    await griglia.updateComplete;
    expect(msg).toMatch(/non ha il dizionario italiano/);
    expect(msg).toMatch(/Impostazioni/);
    expect(barra().getAttribute('spellcheck')).toBe('false');
    expect(localStorage.getItem('pmb_sheets.ortografia')).toBeNull();
  });

  it('in italiano, con il dizionario italiano installato, si accende', async () => {
    impostaLocaleNumeri('it');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['it-IT', 'en-GB']);
    expect(griglia.toggleOrtografia()).toMatch(/acceso/);
    await griglia.updateComplete;
    expect(barra().getAttribute('spellcheck')).toBe('true');
    expect(barra().getAttribute('lang')).toBe('it');
  });
});
