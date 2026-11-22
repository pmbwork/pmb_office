// T453: in pmb_sheets la voce «Segnala un bug o invia un feedback» apre una finestra per scrivere e inviare il messaggio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/formati/file-io', () => ({ salvaSuDisco: vi.fn(async () => true), scegliFile: vi.fn(async () => null) }));

import '../../src/main';
import { defaultDocumentStore } from '../../src/sheet/document-store';

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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const risposta = (corpo: unknown, stato = 200): Response => new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } });
const attendi = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));
const apri = async (): Promise<Dlg> => {
  app.renderRoot.querySelector('free-menubar')?.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'info-segnala', label: 'x' }, bubbles: true, composed: true }));
  await app.updateComplete;
  const d = app.renderRoot.querySelector('free-dialogo-segnala') as Dlg;
  await d.updateComplete;
  return d;
};
const scrivi = async (d: Dlg, testo: string, contatto = ''): Promise<void> => {
  const ta = d.shadowRoot.querySelector('textarea') as HTMLTextAreaElement; ta.value = testo; ta.dispatchEvent(new Event('input'));
  const em = d.shadowRoot.querySelector('input[type=email]') as HTMLInputElement; em.value = contatto; em.dispatchEvent(new Event('input'));
  await d.updateComplete;
};
const pulsante = (d: Dlg, testo: string): HTMLButtonElement => (Array.from(d.shadowRoot.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent!.trim() === testo)!;
const stato = (): string => (app as unknown as { statusMessage: string }).statusMessage;

describe('T453: segnalazioni (sheets)', () => {
  it('la voce apre la finestra, con avviso sulla privacy e spunta già messa', async () => {
    const d = await apri();
    expect(d.shadowRoot.textContent).toContain('pmbwork@proton.me');
    expect(d.shadowRoot.textContent).toMatch(/solo quando premi Invia/);
    expect((d.shadowRoot.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(true);
  });
  it('invio riuscito: parte il messaggio, la finestra si chiude, la barra di stato ringrazia', async () => {
    const f = vi.fn(async () => risposta({ ok: true }));
    vi.stubGlobal('fetch', f);
    const d = await apri();
    await scrivi(d, 'La formula SOMMA non aggiorna dopo aver ordinato.', 'luca@example.com');
    pulsante(d, 'Invia').click();
    await attendi(); await app.updateComplete;
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({ app: 'pmb_sheets', contatto: 'luca@example.com', sito: '' });
    expect(app.renderRoot.querySelector('free-dialogo-segnala')).toBeNull();
    expect(stato()).toContain('Grazie');
  });
  it('testo troppo corto: errore e nessuna chiamata di rete', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const d = await apri();
    await scrivi(d, 'no');
    pulsante(d, 'Invia').click();
    await attendi(); await d.updateComplete;
    expect(f).not.toHaveBeenCalled();
    expect(d.shadowRoot.querySelector('.stato.errore')?.textContent).toMatch(/almeno 10/);
  });
  it('il servizio rifiuta: motivo mostrato, testo intatto, e «Apri la posta» usa il mailto con il testo scritto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => risposta({ ok: false, errore: 'troppi messaggi, riprova più tardi' })));
    const aperti: string[] = [];
    vi.spyOn(window, 'open').mockImplementation((u) => { aperti.push(String(u)); return null; });
    const d = await apri();
    await scrivi(d, 'Un problema da raccontare con calma.');
    pulsante(d, 'Invia').click();
    await attendi(); await d.updateComplete;
    expect(d.shadowRoot.querySelector('.stato.errore')?.textContent).toMatch(/troppi messaggi/);
    expect((d.shadowRoot.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Un problema da raccontare con calma.');
    pulsante(d, 'Apri la posta').click();
    await attendi(); await app.updateComplete;
    expect(aperti).toHaveLength(1);
    expect(decodeURIComponent(aperti[0])).toContain('Un problema da raccontare con calma.');
    expect(aperti[0]).toMatch(/^mailto:pmbwork@proton\.me\?subject=pmb_sheets%20\d+\.\d+\.\d+/);
    expect(app.renderRoot.querySelector('free-dialogo-segnala')).toBeNull();
    expect(stato()).toContain('pmbwork@proton.me');
  });
  it('Annulla ed Esc chiudono senza inviare niente', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    let d = await apri();
    pulsante(d, 'Annulla').click();
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-segnala')).toBeNull();
    d = await apri();
    d.shadowRoot.querySelector('.velo')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.updateComplete;
    expect(app.renderRoot.querySelector('free-dialogo-segnala')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
