// Finestra «Apri / Salva con nome» interna, solo per la versione pocket (device come AI_PRO).
// Le finestre di Windows annotano nel PC ospite gli ultimi file e cartelle usati (Elementi recenti, registro) anche quando i file
// sono sul device. Nella pocket i programmi usano questa finestra: elenca cartelle e file e legge/scrive tramite la parte nativa
// (src-tauri/src/portatile_file.rs), senza la shell di Windows, quindi sul PC non resta niente.
// Prende il posto di window.showOpenFilePicker / showSaveFilePicker: il resto dei programmi (file-io.ts) non cambia.
// Senza librerie (il codice comune non ne ha): DOM semplice in un shadow root; i nomi dei file entrano solo come testo.
import { portatile } from './piattaforma';

export type Traduttore = (testo: string, ...valori: Array<string | number>) => string;
interface Opzioni { t: Traduttore; locale: () => string }
interface TipoFile { description?: string; accept?: Record<string, string[] | string> }
interface OpzioniSelettore { suggestedName?: string; types?: TipoFile[]; multiple?: boolean; excludeAcceptAllOption?: boolean }
interface Voce { nome: string; cartella: boolean; dimensione: number; modificato: number }
interface Elenco { cartella: string; sopra: string; voci: Voce[]; troncato: boolean }
interface Scrivibile { write: (dati: unknown) => Promise<void>; close: () => Promise<void> }
/** Il file scelto, con le stesse funzioni di una maniglia del browser (FileSystemFileHandle) che usano i programmi. */
export interface ManigliaPortatile {
  kind: 'file'; name: string; percorso: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<Scrivibile>;
  queryPermission: () => Promise<'granted'>;
  requestPermission: () => Promise<'granted'>;
}

let opzioni: Opzioni = { t: (s) => s, locale: () => 'it-IT' };
const NON_AMMESSI = /[\\/:*?"<>|]/;

type Invocatore = (comando: string, argomenti?: unknown, opzioni?: unknown) => Promise<unknown>;
function invoca<R>(comando: string, argomenti?: unknown, opz?: unknown): Promise<R> {
  const w = window as unknown as { __TAURI__?: { core?: { invoke?: Invocatore } }; __TAURI_INTERNALS__?: { invoke?: Invocatore } };
  const f = w.__TAURI__?.core?.invoke ?? w.__TAURI_INTERNALS__?.invoke;
  if (!f) return Promise.reject(new Error('NON_NELL_APP'));
  return f(comando, argomenti, opz) as Promise<R>;
}

const annullato = (): DOMException => new DOMException('Scelta annullata', 'AbortError');
const unisci = (cartella: string, nome: string): string => (cartella.endsWith('\\') || cartella.endsWith('/') ? cartella + nome : `${cartella}\\${nome}`);
const estensioniDi = (tipo: TipoFile | undefined): string[] =>
  tipo?.accept ? Object.values(tipo.accept).flatMap((e) => (Array.isArray(e) ? e : [e])).map((e) => e.toLowerCase()).filter((e) => e.startsWith('.')) : [];

async function inByte(d: unknown): Promise<Uint8Array> {
  if (d instanceof Uint8Array) return d;
  if (d instanceof ArrayBuffer) return new Uint8Array(d);
  if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  if (typeof Blob !== 'undefined' && d instanceof Blob) return new Uint8Array(await d.arrayBuffer());
  if (typeof d === 'string') return new TextEncoder().encode(d);
  if (d && typeof d === 'object' && 'data' in d) return inByte((d as { data: unknown }).data);
  throw new TypeError('dati da scrivere non riconosciuti');
}

/** I comandi della parte nativa con cui una maniglia legge e scrive: quelli della pocket, o quelli di file-nativi.ts nella versione installata. */
export interface ComandiFile { leggi: string; scrivi: string }
const COMANDI_PORTATILE: ComandiFile = { leggi: 'portatile_leggi', scrivi: 'portatile_scrivi' };

/** Una maniglia per un file del device (o del PC) letto e scritto dalla parte nativa. */
export function manigliaPortatile(percorso: string, comandi: ComandiFile = COMANDI_PORTATILE): ManigliaPortatile {
  const nome = percorso.split(/[\\/]/).pop() ?? percorso;
  return {
    kind: 'file', name: nome, percorso,
    async getFile() {
      const r = await invoca<ArrayBuffer | ArrayLike<number>>(comandi.leggi, { percorsoFile: percorso });
      const byte = r instanceof ArrayBuffer ? new Uint8Array(r) : Uint8Array.from(r as ArrayLike<number>);
      return new File([byte as BlobPart], nome);
    },
    async createWritable() {
      const parti: Uint8Array[] = [];
      return {
        async write(dati: unknown) { parti.push(await inByte(dati)); },
        async close() {
          const totale = parti.reduce((n, p) => n + p.length, 0);
          const tutto = new Uint8Array(totale);
          let o = 0;
          for (const p of parti) { tutto.set(p, o); o += p.length; }
          await invoca(comandi.scrivi, tutto, { headers: { 'Content-Type': 'application/octet-stream', percorso: encodeURIComponent(percorso) } });
        },
      };
    },
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
  };
}

const STILE = `
  :host { all: initial; position: fixed; inset: 0; z-index: 2147483000; font: 13px Roboto, "Segoe UI", Arial, sans-serif; color: #202124; }
  .velo { position: absolute; inset: 0; background: rgba(32, 33, 36, 0.45); display: flex; align-items: center; justify-content: center; }
  .finestra { width: 720px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-sizing: border-box;
    background: #ffffff; border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3); padding: 16px 20px; gap: 10px; }
  h2 { margin: 0; font-size: 16px; font-weight: 500; }
  .percorso { display: flex; gap: 6px; align-items: center; }
  select, input[type=text] { height: 30px; box-sizing: border-box; border: 1px solid #dadce0; border-radius: 4px; padding: 0 8px; font: inherit; color: inherit; background: #ffffff; }
  .percorso input { flex: 1; min-width: 0; }
  button { height: 30px; padding: 0 14px; border-radius: 4px; border: 1px solid #dadce0; background: #ffffff; color: inherit; font: inherit; cursor: pointer; }
  button:hover { background: #f1f3f4; }
  button.principale { background: #1a73e8; border-color: #1a73e8; color: #ffffff; }
  button.principale:hover { background: #1765cc; }
  .elenco { flex: 1; overflow: auto; border: 1px solid #dadce0; border-radius: 4px; outline: none; }
  .elenco:focus-visible { box-shadow: 0 0 0 2px #1a73e8; }
  .riga { display: grid; grid-template-columns: 22px 1fr 90px 140px; gap: 8px; align-items: center; padding: 4px 10px; cursor: default; user-select: none; }
  .riga.intestazione { position: sticky; top: 0; background: #f8f9fa; color: #5f6368; font-size: 12px; border-bottom: 1px solid #e8eaed; }
  .riga:not(.intestazione):hover { background: #f1f3f4; }
  .riga.scelta { background: #d3e3fd; }
  .riga .dimensione, .riga .data { color: #5f6368; font-size: 12px; text-align: right; white-space: nowrap; }
  .riga .nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icona { width: 18px; height: 18px; }
  .vuota, .avviso { padding: 12px; color: #5f6368; }
  .avviso.errore { color: #b3261e; }
  .campi { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; }
  .pulsanti { display: flex; gap: 8px; justify-content: flex-end; }
  .pulsanti .sinistra { margin-right: auto; }
`;
const ICONA_CARTELLA = '<svg class="icona" viewBox="0 0 24 24" aria-hidden="true"><path fill="#f4b400" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';
const ICONA_FILE = '<svg class="icona" viewBox="0 0 24 24" aria-hidden="true"><path fill="#5f6368" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 7V3.5L19.5 9H14z"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attributi: Record<string, string> = {}, testo?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, v);
  if (testo !== undefined) e.textContent = testo;
  return e;
}

/** Apre la finestra e restituisce i percorsi scelti; rifiuta con AbortError se si annulla. */
function finestra(modo: 'apri' | 'salva', o: OpzioniSelettore): Promise<string[]> {
  const { t } = opzioni;
  return new Promise((risolvi, rifiuta) => {
    const host = el('div', { 'data-pmb-finestra-file': modo });
    const radice = host.attachShadow({ mode: 'open' });
    const stile = el('style'); stile.textContent = STILE; radice.appendChild(stile);
    const velo = el('div', { class: 'velo' });
    const fin = el('div', { class: 'finestra', role: 'dialog', 'aria-modal': 'true', 'aria-label': modo === 'apri' ? t('Apri') : t('Salva con nome') });
    fin.appendChild(el('h2', {}, modo === 'apri' ? t('Apri') : t('Salva con nome')));
    // riga del percorso: unità, cartella superiore, percorso scrivibile
    const riga = el('div', { class: 'percorso' });
    const unita = el('select', { 'aria-label': t('Unità') });
    const su = el('button', { type: 'button', title: t('Cartella superiore'), 'aria-label': t('Cartella superiore') }, '↑');
    const campoPercorso = el('input', { type: 'text', 'aria-label': t('Cartella') });
    riga.append(unita, su, campoPercorso);
    const elenco = el('div', { class: 'elenco', role: 'listbox', tabindex: '0', 'aria-label': t('Cartelle e file'), 'aria-multiselectable': o.multiple ? 'true' : 'false' });
    const avviso = el('div', { class: 'avviso', role: 'status' });
    // nome e tipo del file
    const campi = el('div', { class: 'campi' });
    const campoNome = el('input', { type: 'text', 'aria-label': t('Nome file:') });
    const tipo = el('select', { 'aria-label': t('Tipo:') });
    const tipi = (o.types ?? []).filter((x) => estensioniDi(x).length > 0);
    tipi.forEach((x, i) => tipo.appendChild(el('option', { value: String(i) }, `${x.description ?? ''} (${estensioniDi(x).map((e) => `*${e}`).join(', ')})`.trim())));
    if (!o.excludeAcceptAllOption || tipi.length === 0) tipo.appendChild(el('option', { value: 'tutti' }, `${t('Tutti i file')} (*.*)`));
    campi.append(el('label', {}, t('Nome file:')), campoNome, el('label', {}, t('Tipo:')), tipo);
    const pulsanti = el('div', { class: 'pulsanti' });
    const nuova = el('button', { type: 'button', class: 'sinistra' }, t('Nuova cartella'));
    const annulla = el('button', { type: 'button' }, t('Annulla'));
    const conferma = el('button', { type: 'button', class: 'principale' }, modo === 'apri' ? t('Apri') : t('Salva'));
    if (modo === 'salva') pulsanti.appendChild(nuova);
    pulsanti.append(annulla, conferma);
    fin.append(riga, elenco, avviso, campi, pulsanti);
    velo.appendChild(fin); radice.appendChild(velo);
    document.body.appendChild(host);

    let attuale: Elenco = { cartella: '', sopra: '', voci: [], troncato: false };
    const scelti = new Set<string>();
    const estensioniAttive = (): string[] => (tipo.value === 'tutti' ? [] : estensioniDi(tipi[Number(tipo.value)]));
    const visibile = (v: Voce): boolean => v.cartella || estensioniAttive().length === 0 || estensioniAttive().some((e) => v.nome.toLowerCase().endsWith(e));
    const dimensione = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toLocaleString(opzioni.locale(), { maximumFractionDigits: 0 })} KB` : `${(n / 1024 / 1024).toLocaleString(opzioni.locale(), { maximumFractionDigits: 1 })} MB`);
    const messaggio = (testo: string, errore = false): void => { avviso.textContent = testo; avviso.classList.toggle('errore', errore); };
    const chiudi = (): void => { document.removeEventListener('keydown', tasto, true); host.remove(); };

    function disegna(): void {
      elenco.replaceChildren();
      const testa = el('div', { class: 'riga intestazione', role: 'presentation' });
      testa.append(el('span'), el('span', {}, t('Nome')), el('span', { class: 'dimensione' }, t('Dimensione')), el('span', { class: 'data' }, t('Ultima modifica')));
      elenco.appendChild(testa);
      const voci = attuale.voci.filter(visibile);
      if (voci.length === 0) elenco.appendChild(el('div', { class: 'vuota' }, t('La cartella è vuota')));
      for (const v of voci) {
        const r = el('div', { class: `riga${scelti.has(v.nome) ? ' scelta' : ''}`, role: 'option', 'aria-selected': scelti.has(v.nome) ? 'true' : 'false', 'data-nome': v.nome, 'data-cartella': v.cartella ? '1' : '0' });
        const icona = el('span'); icona.innerHTML = v.cartella ? ICONA_CARTELLA : ICONA_FILE; // icone fisse, nessun dato dell'utente
        r.append(icona, el('span', { class: 'nome', title: v.nome }, v.nome),
          el('span', { class: 'dimensione' }, v.cartella ? '' : dimensione(v.dimensione)),
          el('span', { class: 'data' }, v.modificato ? new Date(v.modificato).toLocaleString(opzioni.locale(), { dateStyle: 'short', timeStyle: 'short' }) : ''));
        r.addEventListener('click', (e) => scegliVoce(v, e as MouseEvent));
        r.addEventListener('dblclick', () => { if (v.cartella) void vai(unisci(attuale.cartella, v.nome)); else { scelti.clear(); scelti.add(v.nome); void confermaScelta(); } });
        elenco.appendChild(r);
      }
      if (attuale.troncato) messaggio(t('Si vedono solo i primi 5000 elementi della cartella'));
    }

    function scegliVoce(v: Voce, e: MouseEvent): void {
      if (v.cartella) { scelti.clear(); scelti.add(v.nome); disegna(); return; }
      if (o.multiple && (e.ctrlKey || e.metaKey)) { if (scelti.has(v.nome)) scelti.delete(v.nome); else scelti.add(v.nome); }
      else { scelti.clear(); scelti.add(v.nome); }
      campoNome.value = [...scelti].filter((n) => !attuale.voci.find((x) => x.nome === n)?.cartella).join('; ');
      disegna();
    }

    async function vai(cartella: string): Promise<void> {
      try {
        attuale = await invoca<Elenco>('portatile_elenca', { cartella });
        scelti.clear(); messaggio('');
        campoPercorso.value = attuale.cartella;
        const u = attuale.cartella.slice(0, 3).toUpperCase();
        if ([...unita.options].some((x) => x.value === u)) unita.value = u;
        su.disabled = !attuale.sopra;
        disegna();
      } catch (e) {
        messaggio(t('Non riesco ad aprire la cartella: {}', String((e as Error)?.message ?? e)), true);
      }
    }

    async function confermaScelta(): Promise<void> {
      const nomi = modo === 'apri' && scelti.size > 0 ? [...scelti] : campoNome.value.split(';').map((x) => x.trim()).filter(Boolean);
      if (nomi.length === 0) { messaggio(t('Scegli un file'), true); return; }
      // un nome che è una cartella: ci si entra
      const cartella = attuale.voci.find((v) => v.cartella && v.nome.toLowerCase() === nomi[0].toLowerCase());
      if (nomi.length === 1 && cartella) { await vai(unisci(attuale.cartella, cartella.nome)); return; }
      if (modo === 'apri') {
        const mancante = nomi.find((n) => !attuale.voci.some((v) => !v.cartella && v.nome === n));
        if (mancante) { messaggio(t('Il file «{}» non c\'è in questa cartella', mancante), true); return; }
        const scelta = o.multiple ? nomi : nomi.slice(0, 1);
        void invoca('portatile_ricorda_cartella', { cartella: attuale.cartella }).catch(() => undefined);
        chiudi(); risolvi(scelta.map((n) => unisci(attuale.cartella, n)));
        return;
      }
      let nome = nomi[0];
      if (NON_AMMESSI.test(nome)) { messaggio(t('Il nome non può contenere \\ / : * ? " < > |'), true); return; }
      const est = estensioniAttive();
      if (est.length > 0 && !est.some((e) => nome.toLowerCase().endsWith(e))) nome += est[0];
      if (attuale.voci.some((v) => !v.cartella && v.nome.toLowerCase() === nome.toLowerCase()) && !window.confirm(t('«{}» esiste già. Vuoi sostituirlo?', nome))) return;
      void invoca('portatile_ricorda_cartella', { cartella: attuale.cartella }).catch(() => undefined);
      chiudi(); risolvi([unisci(attuale.cartella, nome)]);
    }

    function tasto(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudi(); rifiuta(annullato()); return; }
      if (e.key === 'Enter' && e.composedPath()[0] === campoPercorso) { e.preventDefault(); e.stopPropagation(); void vai(campoPercorso.value.trim()); return; }
      if (e.key === 'Enter' && (e.composedPath()[0] === campoNome || e.composedPath()[0] === elenco)) { e.preventDefault(); e.stopPropagation(); void confermaScelta(); }
    }
    document.addEventListener('keydown', tasto, true);
    su.addEventListener('click', () => { if (attuale.sopra) void vai(attuale.sopra); });
    unita.addEventListener('change', () => { void vai(unita.value); });
    tipo.addEventListener('change', () => disegna());
    annulla.addEventListener('click', () => { chiudi(); rifiuta(annullato()); });
    conferma.addEventListener('click', () => { void confermaScelta(); });
    nuova.addEventListener('click', async () => {
      const nome = window.prompt(t('Nome della nuova cartella:'), t('Nuova cartella'));
      if (!nome) return;
      try { await vai(await invoca<string>('portatile_nuova_cartella', { cartella: attuale.cartella, nome })); }
      catch (e) { messaggio(t('Non riesco a creare la cartella: {}', String((e as Error)?.message ?? e)), true); }
    });

    // avvio: unità, cartella iniziale, nome proposto
    if (modo === 'salva') campoNome.value = o.suggestedName ?? '';
    void (async () => {
      try {
        const lettere = await invoca<string[]>('portatile_unita');
        lettere.forEach((u) => unita.appendChild(el('option', { value: u }, u)));
        await vai(await invoca<string>('portatile_cartella_iniziale'));
      } catch (e) { messaggio(t('Non riesco ad aprire la cartella: {}', String((e as Error)?.message ?? e)), true); }
      (modo === 'salva' ? campoNome : elenco).focus();
      if (modo === 'salva') { const p = campoNome.value.lastIndexOf('.'); campoNome.setSelectionRange(0, p > 0 ? p : campoNome.value.length); }
    })();
  });
}

/** Nella versione pocket mette la finestra interna al posto di quelle di Windows. Fuori dalla pocket non fa niente. */
export function installaFinestraFilePortatile(o: Opzioni): boolean {
  if (!portatile()) return false;
  opzioni = o;
  const w = window as unknown as Record<string, unknown>;
  w.showOpenFilePicker = async (p: OpzioniSelettore = {}) => (await finestra('apri', p)).map((percorso) => manigliaPortatile(percorso));
  w.showSaveFilePicker = async (p: OpzioniSelettore = {}) => manigliaPortatile((await finestra('salva', p))[0]);
  return true;
}

/** Al posto di un campo «scegli file» (input type=file): nella pocket apre la finestra interna e restituisce i file scelti
 *  (vuoto se si annulla). `accept` come nell'attributo dell'input: ".png,.jpg". */
export async function scegliFilePortatili(accept: string, multiple = false): Promise<File[]> {
  const { t } = opzioni;
  const estensioni = accept.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.startsWith('.'));
  try {
    const percorsi = await finestra('apri', { multiple, types: estensioni.length ? [{ description: t('File ammessi'), accept: { 'application/octet-stream': estensioni } }] : [] });
    return Promise.all(percorsi.map((p) => manigliaPortatile(p).getFile()));
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return [];
    throw e;
  }
}
