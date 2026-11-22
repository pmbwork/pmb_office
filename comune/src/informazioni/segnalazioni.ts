// Segnalazione di bug e feedback.
// Strada principale: una finestra in cui l'utente scrive; il messaggio parte via Internet verso un piccolo servizio di Google Apps Script
// gestito da PMB (`comune/apps-script/segnalazioni.gs`), che lo inoltra per email. Nel programma non c'è nessuna password: solo l'indirizzo pubblico del servizio.
// Ripiego (nessuna rete, servizio non raggiungibile): un messaggio di posta già compilato (mailto) che l'utente rilegge e invia dal suo programma di posta.
// Il contenuto dei documenti non viene mai incluso: solo quello che l'utente scrive e, se vuole, nome e versione del programma e il sistema.
// I messaggi per l'utente passano da un traduttore facoltativo `tr` (come la funzione t() di pmb_docs); senza, escono in italiano.

// contatto pubblico di PMB (scelta dell'utente, 2026-11-22); il servizio di segnalazione spedisce invece all'account che lo pubblica
export const EMAIL_SEGNALAZIONI = 'pmbwork@proton.me';
export const URL_SERVIZIO_SEGNALAZIONI = 'https://script.google.com/macros/s/AKfycbxKl8R57M1zUnJKjayr7yHBP3BvH20FEoqtIYLyr5kX5g6OjkZCZja9z_uZf-modw/exec';

export const LIMITI_SEGNALAZIONE = { minimoTesto: 10, massimoTesto: 4000, massimoContatto: 200 } as const;
const TEMPO_MASSIMO_MS = 25000;

/** Un traduttore: il testo italiano (con `{}` al posto dei valori) e i valori; restituisce il testo nella lingua scelta. */
export type Traduttore = (testo: string, ...valori: Array<string | number>) => string;
const ITALIANO: Traduttore = (testo, ...valori) => { let i = 0; return testo.replace(/\{\}/g, (m) => (i < valori.length ? String(valori[i++]) : m)); };

export interface OpzioniSegnalazione { app: 'pmb_docs' | 'pmb_sheets'; versione: string; sistema?: string }
export interface DatiSegnalazione extends OpzioniSegnalazione { testo: string; contatto?: string; includiDati: boolean }
export type EsitoInvio = { ok: true } | { ok: false; motivo: string };

/** Messaggio per l'utente se il testo non va bene, altrimenti null. */
export function controllaTesto(testo: string, tr: Traduttore = ITALIANO): string | null {
  const t = testo.trim();
  if (t.length < LIMITI_SEGNALAZIONE.minimoTesto) return tr('Scrivi almeno {} caratteri, così capisco di che cosa si tratta.', LIMITI_SEGNALAZIONE.minimoTesto);
  if (testo.length > LIMITI_SEGNALAZIONE.massimoTesto) return tr('Il messaggio è troppo lungo: al massimo {} caratteri.', LIMITI_SEGNALAZIONE.massimoTesto);
  return null;
}

/** Il corpo spedito al servizio (JSON come testo semplice: così il browser non fa la richiesta di verifica preliminare). */
export function corpoInvio(d: DatiSegnalazione): string {
  return JSON.stringify({
    app: d.app,
    versione: d.versione,
    sistema: d.includiDati ? (d.sistema ?? '').replace(/[\r\n]+/g, ' ').slice(0, 300) : '',
    includiDati: d.includiDati,
    testo: d.testo.trim().slice(0, LIMITI_SEGNALAZIONE.massimoTesto),
    contatto: (d.contatto ?? '').trim().slice(0, LIMITI_SEGNALAZIONE.massimoContatto),
    sito: '', // campo trappola del servizio: da qui resta sempre vuoto
  });
}

/** Gli errori che il servizio può rispondere (in italiano, sono codici) e il testo da mostrare. */
const MOTIVI: Record<string, string> = {
  'messaggio troppo corto': 'Il messaggio è troppo corto.',
  'messaggio troppo lungo': 'Il messaggio è troppo lungo.',
  'troppi messaggi, riprova più tardi': 'Ci sono troppi messaggi in questo momento: riprova tra un po\'.',
  'programma non valido': 'Il servizio non riconosce questa versione del programma.',
};

/** Invia la segnalazione al servizio. Non lancia mai eccezioni: restituisce l'esito con un motivo leggibile. */
export async function inviaSegnalazione(d: DatiSegnalazione, opzioni: { fetchFn?: typeof fetch; url?: string; timeoutMs?: number; tr?: Traduttore } = {}): Promise<EsitoInvio> {
  const tr = opzioni.tr ?? ITALIANO;
  const errore = controllaTesto(d.testo, tr);
  if (errore) return { ok: false, motivo: errore };
  const fetchFn = opzioni.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  if (!fetchFn) return { ok: false, motivo: tr('Questo ambiente non può collegarsi a Internet.') };
  const controllo = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controllo ? setTimeout(() => controllo.abort(), opzioni.timeoutMs ?? TEMPO_MASSIMO_MS) : null;
  try {
    const r = await fetchFn(opzioni.url ?? URL_SERVIZIO_SEGNALAZIONI, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: corpoInvio(d),
      redirect: 'follow',
      credentials: 'omit',
      signal: controllo?.signal,
    });
    if (!r.ok) return { ok: false, motivo: tr('Il servizio ha risposto con un errore ({}).', r.status) };
    let risposta: { ok?: boolean; errore?: string } | null = null;
    try { risposta = await r.json(); } catch { risposta = null; }
    if (risposta?.ok === true) return { ok: true };
    const motivo = risposta?.errore ? tr(MOTIVI[risposta.errore] ?? 'Il servizio non ha accettato il messaggio.') : tr('Risposta del servizio non comprensibile.');
    return { ok: false, motivo };
  } catch (e) {
    const interrotto = (e as { name?: string })?.name === 'AbortError';
    return { ok: false, motivo: interrotto ? tr('Il servizio non risponde (tempo scaduto).') : tr('Non riesco a collegarmi a Internet.') };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Ripiego: indirizzo mailto già compilato, senza spazi né caratteri di controllo e sotto i 2000 caratteri (limite del comando nativo). */
export function urlSegnalazione(o: OpzioniSegnalazione & { testo?: string; tr?: Traduttore }): string {
  const tr = o.tr ?? ITALIANO;
  const oggetto = `${o.app} ${o.versione}: ${tr('segnalazione')}`;
  const sistema = (o.sistema ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200) || tr('non indicato');
  const scritto = (o.testo ?? '').trim();
  const corpo = [
    scritto || tr('Descrivi qui il problema (che cosa hai fatto, che cosa è successo, che cosa ti aspettavi) o il suggerimento:'),
    '', '', '',
    '---',
    tr('Dati utili, aggiunti dal programma (non contengono i tuoi documenti):'),
    `${tr('Programma:')} ${o.app} ${o.versione}`,
    `${tr('Sistema:')} ${sistema}`,
  ].join('\n');
  // il testo scritto dall'utente va accorciato finché l'indirizzo sta nel limite
  let url = '';
  for (let limite = corpo.length; limite >= 0; limite -= 100) {
    const cr = limite >= corpo.length ? corpo : corpo.slice(0, limite) + `\n[…${tr('messaggio accorciato')}…]`;
    url = `mailto:${EMAIL_SEGNALAZIONI}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(cr)}`;
    if (url.length < 1900) break;
  }
  return url;
}

/** L'avviso che resta quando la posta non si apre, scritto con il traduttore dato. */
export function avvisoSegnalazione(tr: Traduttore = ITALIANO): string { return tr('Se non si apre il programma di posta, scrivi a {}', EMAIL_SEGNALAZIONI); }
export const AVVISO_SEGNALAZIONE = avvisoSegnalazione();
