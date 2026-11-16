import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
let app: App;
const barra = () => app.renderRoot.querySelector('free-menubar') as HTMLElement & { renderRoot: ShadowRoot; updateComplete: Promise<unknown> };

beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
  await barra().updateComplete;
});

describe('T527: il bottone «Segnalazione bug» nella barra dei menu', () => {
  it('sta subito dopo il menu Informazioni e non è un menu (la navigazione tra i menu non cambia)', () => {
    const contenitore = barra().renderRoot.querySelector('.menu-bar-container')!;
    const figli = Array.from(contenitore.children);
    const ultimoMenu = figli[figli.length - 2];
    const bottone = figli[figli.length - 1] as HTMLButtonElement;
    expect(ultimoMenu.querySelector('.menu-btn')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Informazioni');
    expect(bottone.matches('button.bottone-segnala')).toBe(true);
    expect(bottone.textContent!.replace(/\s+/g, ' ').trim()).toBe('Segnalazione bug');
    expect(bottone.title).toBe('Segnala un bug o invia un feedback');
    expect(bottone.classList.contains('menu-btn')).toBe(false);
  });
  it('un clic apre la finestra di segnalazione; chiude un menu aperto', async () => {
    const menu = barra().renderRoot.querySelectorAll<HTMLButtonElement>('.menu-btn')[0];
    menu.click();
    await barra().updateComplete;
    expect(barra().renderRoot.querySelector('.dropdown-menu')).not.toBeNull();
    (barra().renderRoot.querySelector('.bottone-segnala') as HTMLButtonElement).click();
    await barra().updateComplete;
    await app.updateComplete;
    expect(barra().renderRoot.querySelector('.dropdown-menu')).toBeNull();
    expect(app.renderRoot.querySelector('free-dialogo-segnala')).not.toBeNull();
  });
});
