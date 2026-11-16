import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../src/formati/file-io', () => ({
  salvaSuDisco: vi.fn(async () => true),
  scegliFile: vi.fn(async () => null),
}));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Griglia = HTMLElement & { getDoc: () => unknown; updateComplete: Promise<unknown>; renderRoot: ShadowRoot; focusGriglia: () => void; isEditing: boolean; startEditing: (r: boolean, c: string) => Promise<void> };
let app: App;
let griglia: Griglia;

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  griglia = app.renderRoot.querySelector('free-sheet-grid') as Griglia;
  await griglia.updateComplete;
});

const attivo = () => (griglia.renderRoot.activeElement as HTMLElement | null)?.className ?? '';
const bottoneDelMenu = () => (app.renderRoot.querySelector('free-menubar') as HTMLElement).shadowRoot!.querySelector('.menu-btn') as HTMLElement;
const senzaCommenti = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('T489: il focus torna alla griglia dopo un comando', () => {
  it('dopo un comando da menu il focus è sulla griglia (così Ctrl+Z e Ctrl+C funzionano subito)', async () => {
    bottoneDelMenu().focus(); // come dopo aver cliccato una voce di menu: il focus resta sul menu
    const barra = app.renderRoot.querySelector('free-menubar') as HTMLElement;
    barra.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'select-all', label: 'Seleziona tutto' }, bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 250));
    expect(attivo()).toContain('grid-container');
  });

  it('dopo un comando dalla barra degli strumenti il focus è sulla griglia', async () => {
    bottoneDelMenu().focus();
    const barra = app.renderRoot.querySelector('free-toolbar') as HTMLElement;
    barra.dispatchEvent(new CustomEvent('toolbar-action', { detail: { action: 'format-bold', label: 'Grassetto' }, bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 250));
    expect(attivo()).toContain('grid-container');
  });

  it('non toglie il focus all\'editor mentre si scrive', async () => {
    await griglia.startEditing(true, 'a');
    expect(griglia.isEditing).toBe(true);
    griglia.focusGriglia();
    expect(attivo()).toContain('cell-editor-overlay');
  });
});

describe('T489: Alt da solo e stili della pagina', () => {
  it('il rilascio del tasto Alt viene annullato (altrimenti Windows blocca la finestra in "modalità menu")', () => {
    const e = new KeyboardEvent('keyup', { key: 'Alt', bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    const altro = new KeyboardEvent('keyup', { key: 'a', bubbles: true, cancelable: true });
    window.dispatchEvent(altro);
    expect(altro.defaultPrevented).toBe(false);
  });

  it('la politica di sicurezza di Tauri non disattiva gli stili scritti nella pagina (style-src)', () => {
    const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    expect(conf.app.security.dangerousDisableAssetCspModification).toContain('style-src');
    expect(senzaCommenti(conf.app.security.csp)).toContain("style-src 'self' 'unsafe-inline'");
  });
});
