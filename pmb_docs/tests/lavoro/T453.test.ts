// T453: segnalazione di bug e feedback: logica di invio condivisa e finestra di pmb_docs.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../src/guscio/docs-guscio';
import { EMAIL_SEGNALAZIONI, URL_SERVIZIO_SEGNALAZIONI, controllaTesto, corpoInvio, inviaSegnalazione, urlSegnalazione } from '@comune/informazioni/segnalazioni';

const dati = { app: 'pmb_docs' as const, versione: '0.1.0', sistema: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', testo: 'Il pulsante Salva non risponde quando il titolo è vuoto.', contatto: 'anna@example.com', includiDati: true };
const risposta = (corpo: unknown, stato = 200): Response => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } });

describe('mailto di ripiego', () => {
  const url = urlSegnalazione({ app: 'pmb_docs', versione: '0.1.0', sistema: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nX' });
  it('è un mailto all\'indirizzo giusto, senza spazi né caratteri di controllo e sotto i 2000 caratteri', () => {
    expect(url.startsWith(`mailto:${EMAIL_SEGNALAZIONI}?subject=`)).toBe(true);
    expect(/[\s\u0000-\u001f]/.test(url)).toBe(false);
    expect(url.length).toBeLessThan(2000);
  });
  it('oggetto e corpo contengono programma, versione e sistema', () => {
    const q = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(q.get('subject')).toBe('pmb_docs 0.1.0: segnalazione');
    expect(q.get('body')).toContain('Programma: pmb_docs 0.1.0');
    expect(q.get('body')).toContain('Sistema: Mozilla/5.0 (Windows NT 10.0; Win64; x64) X');
    expect(q.get('body')).toMatch(/non contengono i tuoi documenti/);
  });
  it('il testo già scritto finisce nel messaggio e, se è lunghissimo, viene accorciato restando nel limite', () => {
    const corto = urlSegnalazione({ app: 'pmb_docs', versione: '0.1.0', testo: 'Ciao, ecco il problema' });
    expect(new URLSearchParams(corto.split('?')[1]).get('body')).toContain('Ciao, ecco il problema');
    const lungo = urlSegnalazione({ app: 'pmb_sheets', versione: '1', sistema: 'x'.repeat(5000), testo: 'parola '.repeat(2000) });
    expect(lungo.length).toBeLessThan(2000);
    expect(new URLSearchParams(lungo.split('?')[1]).get('body')).toContain('messaggio accorciato');
  });
});

describe('inviaSegnalazione', () => {
  it('controlla il testo prima di inviare (troppo corto o troppo lungo)', () => {
    expect(controllaTesto('corto')).toMatch(/almeno 10/);
    expect(controllaTesto('x'.repeat(4001))).toMatch(/troppo lungo/);
    expect(controllaTesto('Un messaggio abbastanza lungo')).toBeNull();
  });
  it('il corpo spedito contiene solo ciò che serve, con il campo trappola vuoto; senza la spunta non parte il sistema', () => {
    const c = JSON.parse(corpoInvio(dati));
    expect(c).toMatchObject({ app: 'pmb_docs', versione: '0.1.0', includiDati: true, contatto: 'anna@example.com', sito: '' });
    expect(c.sistema).toContain('Windows NT 10.0');
    expect(Object.keys(c).sort()).toEqual(['app', 'contatto', 'includiDati', 'sistema', 'sito', 'testo', 'versione']);
    expect(JSON.parse(corpoInvio({ ...dati, includiDati: false })).sistema).toBe('');
  });
  it('esito positivo: POST come testo semplice all\'indirizzo del servizio, senza cookie', async () => {
    const f = vi.fn(async () => risposta({ ok: true }));
    expect(await inviaSegnalazione(dati, { fetchFn: f as unknown as typeof fetch })).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_SERVIZIO_SEGNALAZIONI);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    expect(init.credentials).toBe('omit');
  });
  it('il servizio rifiuta, risponde con un errore HTTP o non risponde in modo comprensibile: motivo leggibile, mai eccezioni', async () => {
    const rifiuto = await inviaSegnalazione(dati, { fetchFn: (async () => risposta({ ok: false, errore: 'troppi messaggi, riprova più tardi' })) as unknown as typeof fetch });
    expect(rifiuto).toEqual({ ok: false, motivo: "Ci sono troppi messaggi in questo momento: riprova tra un po'." });
    const http = await inviaSegnalazione(dati, { fetchFn: (async () => risposta('boom', 500)) as unknown as typeof fetch });
    expect(http).toEqual({ ok: false, motivo: 'Il servizio ha risposto con un errore (500).' });
    const strano = await inviaSegnalazione(dati, { fetchFn: (async () => risposta('<html>')) as unknown as typeof fetch });
    expect(strano.ok).toBe(false);
  });
  it('rete assente o tempo scaduto: motivo leggibile', async () => {
    const rete = await inviaSegnalazione(dati, { fetchFn: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    expect(rete).toEqual({ ok: false, motivo: 'Non riesco a collegarmi a Internet.' });
    const lento = await inviaSegnalazione(dati, { timeoutMs: 20, fetchFn: ((_u: string, init: RequestInit) => new Promise((_ok, ko) => { init.signal?.addEventListener('abort', () => ko(Object.assign(new Error('abortito'), { name: 'AbortError' }))); })) as unknown as typeof fetch });
    expect(lento).toEqual({ ok: false, motivo: 'Il servizio non risponde (tempo scaduto).' });
  });
  it('non chiama il servizio se il testo non va bene', async () => {
    const f = vi.fn();
    const r = await inviaSegnalazione({ ...dati, testo: 'no' }, { fetchFn: f as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('la finestra di pmb_docs', () => {
  beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  async function apri(): Promise<{ g: any; d: any }> {
    const g: any = document.createElement('docs-guscio');
    document.body.appendChild(g);
    await g.updateComplete;
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'informazioni', voce: 'Segnala un bug o invia un feedback' }, bubbles: true, composed: true }));
    await g.updateComplete;
    const d: any = g.shadowRoot.querySelector('docs-segnala');
    await d.updateComplete;
    return { g, d };
  }
  const scrivi = async (d: any, testo: string, contatto = ''): Promise<void> => {
    const ta = d.shadowRoot.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = testo; ta.dispatchEvent(new Event('input'));
    const em = d.shadowRoot.querySelector('input[type=email]') as HTMLInputElement;
    em.value = contatto; em.dispatchEvent(new Event('input'));
    await d.updateComplete;
  };
  const pulsante = (d: any, testo: string): HTMLButtonElement => (Array.from(d.shadowRoot.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent!.trim() === testo)!;
  const attendi = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));

  it('la voce di menu apre la finestra con il cursore nel testo, l\'avviso sulla privacy e la spunta già messa', async () => {
    const { d } = await apri();
    expect(d).not.toBeNull();
    expect(d.shadowRoot.textContent).toContain(EMAIL_SEGNALAZIONI);
    expect(d.shadowRoot.textContent).toMatch(/solo quando premi Invia/);
    expect((d.shadowRoot.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(true);
    expect(d.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
  });
  it('invio riuscito: parte il messaggio scritto, la finestra si chiude e compare il ringraziamento', async () => {
    const f = vi.fn(async () => risposta({ ok: true }));
    vi.stubGlobal('fetch', f);
    const { g, d } = await apri();
    await scrivi(d, 'Il pulsante Salva non risponde quando il titolo è vuoto.', 'anna@example.com');
    pulsante(d, 'Invia').click();
    await attendi(); await g.updateComplete;
    expect(f).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo).toMatchObject({ app: 'pmb_docs', contatto: 'anna@example.com', testo: 'Il pulsante Salva non risponde quando il titolo è vuoto.' });
    expect(g.shadowRoot.querySelector('docs-segnala')).toBeNull();
    expect(g.shadowRoot.querySelector('.avviso')?.textContent).toContain('Grazie');
  });
  it('testo troppo corto: errore sotto il campo e nessuna chiamata di rete', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { d } = await apri();
    await scrivi(d, 'no');
    pulsante(d, 'Invia').click();
    await attendi(); await d.updateComplete;
    expect(f).not.toHaveBeenCalled();
    expect(d.shadowRoot.querySelector('.stato.errore')?.textContent).toMatch(/almeno 10/);
  });
  it('rete assente: la finestra resta aperta con il testo intatto, mostra il motivo e offre «Apri la posta» con il testo scritto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const aperti: string[] = [];
    vi.spyOn(window, 'open').mockImplementation((u) => { aperti.push(String(u)); return null; });
    const { g, d } = await apri();
    await scrivi(d, 'Un problema che voglio raccontare con calma.');
    pulsante(d, 'Invia').click();
    await attendi(); await d.updateComplete;
    expect(d.shadowRoot.querySelector('.stato.errore')?.textContent).toMatch(/Internet/);
    expect((d.shadowRoot.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Un problema che voglio raccontare con calma.');
    pulsante(d, 'Apri la posta').click();
    await attendi(); await g.updateComplete;
    expect(aperti).toHaveLength(1);
    expect(decodeURIComponent(aperti[0])).toContain('Un problema che voglio raccontare con calma.');
    expect(aperti[0]).toMatch(/^mailto:pmbwork@proton\.me\?subject=pmb_docs%20\d+\.\d+\.\d+/);
    expect(g.shadowRoot.querySelector('docs-segnala')).toBeNull();
  });
  it('Annulla ed Esc chiudono senza inviare niente', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    const { g, d } = await apri();
    pulsante(d, 'Annulla').click();
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-segnala')).toBeNull();
    g.shadowRoot.querySelector('docs-menubar').dispatchEvent(new CustomEvent('voce-menu', { detail: { menu: 'informazioni', voce: 'Segnala un bug o invia un feedback' }, bubbles: true, composed: true }));
    await g.updateComplete;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await g.updateComplete;
    expect(g.shadowRoot.querySelector('docs-segnala')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
