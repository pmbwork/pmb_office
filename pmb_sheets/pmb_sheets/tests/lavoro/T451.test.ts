// T451: menu "Informazioni" di pmb_sheets: condizioni d'uso, garanzie e licenze di terze parti.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { menuRegistry } from '../../src/registry/menu';
import { defaultDocumentStore } from '../../src/sheet/document-store';
import { COMPONENTI_TERZI, TESTI_LICENZE } from '../../src/components/licenze-terze';
import { sezioniInformazioni } from '@comune/informazioni/condizioni';

type App = HTMLElement & { updateComplete: Promise<unknown>; renderRoot: ParentNode };
type Dlg = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot };
let app: App;
beforeEach(async () => {
  document.body.innerHTML = '';
  defaultDocumentStore.clear();
  app = document.createElement('free-app') as App;
  document.body.appendChild(app);
  await app.updateComplete;
});
const menu = (action: string, label = action) => app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action, label }, bubbles: true, composed: true }));
const dialogo = async (): Promise<Dlg | null> => {
  await app.updateComplete;
  const d = app.renderRoot.querySelector('free-dialogo-informazioni') as Dlg | null;
  if (d) await d.updateComplete;
  return d;
};

describe('T451: Informazioni (sheets)', () => {
  it('"Informazioni" è l\'ultima voce del menu in alto, con tre voci', () => {
    const ultimo = menuRegistry[menuRegistry.length - 1];
    expect([ultimo.label, ultimo.items.map((i) => i.label)]).toEqual(['Informazioni', ['Informazioni su pmb_sheets', "Condizioni d'uso", 'Licenze di terze parti', 'Segnala un bug o invia un feedback']]);
  });
  it('ogni voce apre la finestra sulla sua pagina', async () => {
    menu('info-app');
    let d = await dialogo();
    expect(d).not.toBeNull();
    expect(d!.shadowRoot.textContent).toMatch(/software gratuito/i);
    menu('info-condizioni');
    d = await dialogo();
    expect(d!.shadowRoot.textContent).toMatch(/GPL-3.0/);
    expect(d!.shadowRoot.textContent).toMatch(/Nessuna garanzia/);
    menu('info-licenze');
    d = await dialogo();
    expect(d!.shadowRoot.querySelectorAll('tbody tr').length).toBe(COMPONENTI_TERZI.length);
    expect(Array.from(d!.shadowRoot.querySelectorAll('details summary')).map((s) => s.textContent)).toEqual(Object.keys(TESTI_LICENZE));
  });
  it('si chiude con Chiudi e con Esc; la ricerca filtra', async () => {
    menu('info-licenze');
    let d = (await dialogo())!;
    const campo = d.shadowRoot.querySelector('input[type=search]') as HTMLInputElement;
    campo.value = 'serde'; campo.dispatchEvent(new Event('input'));
    await d.updateComplete;
    const n = d.shadowRoot.querySelectorAll('tbody tr').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(COMPONENTI_TERZI.length);
    (d.shadowRoot.querySelector('.bottoni button') as HTMLButtonElement).click();
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-informazioni')).toBeNull();
    menu('info-app');
    d = (await dialogo())!;
    d.shadowRoot.querySelector('.velo')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-informazioni')).toBeNull();
  });
  it('testi e licenze: gratuito e open source (GPL-3.0), nessuna garanzia, librerie vere', () => {
    const s = sezioniInformazioni({ app: 'pmb_sheets', versione: '0.1.0' });
    const t = Object.values(s).flat().flatMap((x) => [x.titolo, ...x.paragrafi]).join('\n');
    for (const r of [/software gratuito/i, /GNU General Public License, versione 3/, /distribuire versioni modificate/, /non può presentarla con il nome o il logo PMB/, /senza garanzie di alcun tipo/, /non invia i tuoi documenti/]) expect(t).toMatch(r);
    expect(t).not.toMatch(/controllo ortografico/);
    const nomi = COMPONENTI_TERZI.map((c) => c[0]);
    for (const n of ['lit', 'tauri', 'serde']) expect(nomi, n).toContain(n);
    expect(COMPONENTI_TERZI.filter((c) => c[2] === '?' || c[2] === '')).toEqual([]);
    for (const l of ['MIT', 'Apache-2.0', 'MPL-2.0']) expect(TESTI_LICENZE[l], l).toBeTruthy();
  });
});
