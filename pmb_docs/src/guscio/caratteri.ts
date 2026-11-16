// Caratteri di pmb_docs: l'elenco del menu a tendina (personali, di Windows, inclusi nel programma), il riconoscimento di quelli installati in Windows
// e i caratteri personali che l'utente importa da un file (.ttf, .otf, .woff, .woff2) e che restano salvati sul computer.
import { CARATTERI_INCLUSI } from './caratteri-dati';
import { t } from '../i18n/lingua';

/** Presenti in ogni Windows: sempre nell'elenco. */
export const CARATTERI_WINDOWS_BASE = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
/** Caratteri di Windows e di Office che compaiono nell'elenco solo se sono installati su questo computer. */
export const CANDIDATI_WINDOWS = [
  'Calibri', 'Calibri Light', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel', 'Segoe UI', 'Tahoma', 'Palatino Linotype', 'Garamond',
  'Century Gothic', 'Comic Sans MS', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Franklin Gothic Medium', 'Gill Sans MT', 'Book Antiqua',
  'Bookman Old Style', 'Rockwell', 'Arial Narrow', 'Segoe Print', 'Segoe Script', 'Century', 'Perpetua', 'Tw Cen MT', 'Verdana Pro',
];
/** Caratteri inclusi nel programma che non stanno nei gruppi generati (Roboto serve all'interfaccia). */
const INCLUSI_EXTRA: Array<[string, string]> = [['Roboto', 'Sans serif']];
const ORDINE_GRUPPI = ['Sans serif', 'Serif', 'Monospazio', 'Decorativo'];

const SERIF = new Set(['Times New Roman', 'Georgia', 'Cambria', 'Constantia', 'Palatino Linotype', 'Garamond', 'Book Antiqua', 'Bookman Old Style', 'Rockwell', 'Century', 'Perpetua']);
const MONO = new Set(['Courier New', 'Consolas', 'Lucida Console']);

/** Il valore di font-family per un nome: tra virgolette (i nomi con numeri o simboli non funzionano senza) e con la famiglia generica come ripiego. */
export function famigliaCss(nome: string): string {
  const pulito = nome.replace(/["\\\u0000-\u001f]/g, '');
  const gruppo = INCLUSI.get(pulito);
  const generica = SERIF.has(pulito) || gruppo === 'Serif' ? 'serif' : MONO.has(pulito) || gruppo === 'Monospazio' ? 'monospace' : 'sans-serif';
  return `"${pulito}", ${generica}`;
}

const INCLUSI = new Map<string, string>([...CARATTERI_INCLUSI.map(([n, g]) => [n, g] as [string, string]), ...INCLUSI_EXTRA]);

// ---------------------------------------------------------------------------------------------------------------- riconoscimento in Windows
let installati: string[] = [];
let rilevato = false;

/** Quali tra i caratteri candidati di Windows sono installati, confrontando la larghezza di un testo con quella dei caratteri generici. */
export function rilevaCaratteriWindows(forza = false): string[] {
  if (rilevato && !forza) return installati;
  rilevato = true;
  installati = [];
  if (typeof document === 'undefined') return installati;
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = document.createElement('canvas').getContext('2d'); } catch { ctx = null; }
  if (!ctx) return installati;
  const prova = 'mmmmmmmmmmlliWWW@#0123|';
  const larghezza = (f: string): number => { ctx!.font = `72px ${f}`; return ctx!.measureText(prova).width; };
  const generiche = ['monospace', 'serif', 'sans-serif'];
  const base = generiche.map(larghezza);
  installati = CANDIDATI_WINDOWS.filter((c) => !CARATTERI_WINDOWS_BASE.includes(c) && generiche.some((g, i) => larghezza(`"${c}", ${g}`) !== base[i]));
  return installati;
}

// ---------------------------------------------------------------------------------------------------------------- lettura del file di un carattere
export interface InfoFont { famiglia: string | null; famigliaSemplice: string | null; sottofamiglia: string | null; peso: number | null; corsivo: boolean }

/** Nome, peso e corsivo letti dal file di un carattere TrueType o OpenType; null se non lo si riesce a leggere (per esempio .woff). Non lancia mai eccezioni. */
export function leggiInfoFont(b: Uint8Array): InfoFont | null {
  try {
    if (b.length < 12) return null;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const firma = v.getUint32(0);
    if (firma !== 0x00010000 && firma !== 0x4f54544f /* OTTO */ && firma !== 0x74727565 /* true */) return null;
    const n = v.getUint16(4);
    if (n === 0 || n > 64 || 12 + n * 16 > b.length) return null;
    const tabelle = new Map<string, { off: number; len: number }>();
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 16;
      const tag = String.fromCharCode(b[r], b[r + 1], b[r + 2], b[r + 3]);
      const off = v.getUint32(r + 8), len = v.getUint32(r + 12);
      if (off > b.length || len > b.length - off) continue;
      tabelle.set(tag, { off, len });
    }
    let famiglia: string | null = null, semplice: string | null = null, sotto: string | null = null;
    const nome = tabelle.get('name');
    if (nome && nome.len >= 6) {
      const cont = v.getUint16(nome.off + 2), inizioStringhe = nome.off + v.getUint16(nome.off + 4);
      const leggi = (id: number): string | null => {
        let migliore: string | null = null, punti = -1;
        for (let i = 0; i < cont && i < 400; i++) {
          const r = nome.off + 6 + i * 12;
          if (r + 12 > nome.off + nome.len) break;
          if (v.getUint16(r + 6) !== id) continue;
          const piattaforma = v.getUint16(r), lingua = v.getUint16(r + 4), len = v.getUint16(r + 8), off = inizioStringhe + v.getUint16(r + 10);
          if (off + len > b.length) continue;
          let testo = '';
          if (piattaforma === 3 || piattaforma === 0) { for (let k = 0; k + 1 < len; k += 2) testo += String.fromCharCode(v.getUint16(off + k)); }
          else if (piattaforma === 1) { for (let k = 0; k < len; k++) testo += String.fromCharCode(b[off + k]); }
          else continue;
          testo = testo.replace(/[\u0000-\u001f]/g, '').trim();
          if (testo === '') continue;
          const p = (piattaforma === 3 ? 2 : piattaforma === 0 ? 1 : 0) + (lingua === 0x409 ? 1 : 0);
          if (p > punti) { punti = p; migliore = testo; }
        }
        return migliore;
      };
      semplice = leggi(1);
      famiglia = leggi(16) ?? semplice;
      sotto = leggi(17) ?? leggi(2);
    }
    let peso: number | null = null, corsivo = false;
    const os2 = tabelle.get('OS/2');
    if (os2 && os2.len >= 64) {
      const p = v.getUint16(os2.off + 4);
      if (p >= 100 && p <= 900) peso = p;
      const sel = v.getUint16(os2.off + 62);
      corsivo = (sel & 1) !== 0 || (sel & 0x200) !== 0;
    }
    return { famiglia, famigliaSemplice: semplice, sottofamiglia: sotto, peso, corsivo };
  } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------------- caratteri personali
export interface FacciaPersonale { id: string; famiglia: string; peso: number; corsivo: boolean; nomeFile: string; dimensione: number; dati: ArrayBuffer }
export interface DepositoCaratteri {
  leggi(): Promise<FacciaPersonale[]>;
  salva(f: FacciaPersonale): Promise<void>;
  elimina(id: string): Promise<void>;
}
export interface FileCarattere { nome: string; byte: Uint8Array }
export interface RisultatoImporto { importati: string[]; errori: Array<{ file: string; motivo: string }> }

export const LIMITE_FILE = 10 * 1024 * 1024;
export const LIMITE_FACCE = 60;
const ESTENSIONI = ['ttf', 'otf', 'woff', 'woff2'];

let personali: FacciaPersonale[] = [];
const caricate = new Map<string, FontFace>();
const ascoltatori = new Set<() => void>();
const avvisa = (): void => { ascoltatori.forEach((f) => f()); };

/** Chiede di essere avvisato quando l'elenco dei caratteri personali cambia; restituisce la funzione per smettere. */
export function sulCambio(f: () => void): () => void { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; }

export function faccePersonali(): readonly FacciaPersonale[] { return personali; }

export function famigliePersonali(): Array<{ famiglia: string; facce: number; dimensione: number }> {
  const m = new Map<string, { famiglia: string; facce: number; dimensione: number }>();
  for (const f of personali) { const x = m.get(f.famiglia) ?? { famiglia: f.famiglia, facce: 0, dimensione: 0 }; x.facce++; x.dimensione += f.dimensione; m.set(f.famiglia, x); }
  return [...m.values()].sort((a, b) => a.famiglia.localeCompare(b.famiglia, 'it'));
}

/** Registra il carattere nel browser (verifica anche che il file sia davvero un carattere). Sostituibile nei test. */
export let registratore: (f: FacciaPersonale) => Promise<void> = async (f) => {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  const faccia = new FontFace(f.famiglia, f.dati, { weight: String(f.peso), style: f.corsivo ? 'italic' : 'normal' });
  await faccia.load();
  document.fonts.add(faccia);
  caricate.set(f.id, faccia);
};
export function impostaRegistratore(r: typeof registratore): void { registratore = r; }

function sanifica(nome: string): string {
  return nome.replace(/[\u0000-\u001f"'`\\;{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64);
}
function nomeDaFile(file: string): string {
  const senza = file.replace(/\.[^.]+$/, '').replace(/[-_]+(regular|bold|italic|bolditalic|light|medium|semibold|black|thin|extrabold|oblique)\b.*$/i, '').replace(/[-_]+/g, ' ');
  return sanifica(senza);
}
function nomiRiservati(): Set<string> {
  return new Set([...CARATTERI_WINDOWS_BASE, ...CANDIDATI_WINDOWS, ...INCLUSI.keys(), 'Inter'].map((x) => x.toLowerCase()));
}
function idFaccia(f: { famiglia: string; peso: number; corsivo: boolean }): string { return `${f.famiglia.toLowerCase()}|${f.peso}|${f.corsivo ? 'i' : 'n'}`; }

/** Carica dal deposito i caratteri personali già importati e li registra. Se un file non si registra più lo salta. */
export async function caricaPersonali(deposito: DepositoCaratteri): Promise<void> {
  let salvati: FacciaPersonale[] = [];
  try { salvati = await deposito.leggi(); } catch { salvati = []; }
  const buoni: FacciaPersonale[] = [];
  for (const f of salvati) { try { await registratore(f); buoni.push(f); } catch { /* file rovinato: non si usa */ } }
  personali = buoni;
  avvisa();
}

/** Importa uno o più file di caratteri. Ogni file è indipendente: quelli buoni si importano, gli altri finiscono negli errori con il motivo. */
export async function importaCaratteri(file: FileCarattere[], deposito: DepositoCaratteri): Promise<RisultatoImporto> {
  const esito: RisultatoImporto = { importati: [], errori: [] };
  const riservati = nomiRiservati();
  for (const fc of file) {
    const estensione = (fc.nome.split('.').pop() ?? '').toLowerCase();
    if (!ESTENSIONI.includes(estensione)) { esito.errori.push({ file: fc.nome, motivo: t('Formato non ammesso: servono file .ttf, .otf, .woff o .woff2') }); continue; }
    if (fc.byte.length === 0) { esito.errori.push({ file: fc.nome, motivo: t('Il file è vuoto') }); continue; }
    if (fc.byte.length > LIMITE_FILE) { esito.errori.push({ file: fc.nome, motivo: t('Il file è troppo grande (al massimo {} MB)', LIMITE_FILE / 1048576) }); continue; }
    const info = leggiInfoFont(fc.byte);
    let famiglia = sanifica(info?.famiglia ?? '') || nomeDaFile(fc.nome);
    // il nome tipografico può coincidere con un carattere già esistente (Arial Black → «Arial», peso Black): allora vale il nome semplice
    if (riservati.has(famiglia.toLowerCase()) && info?.famigliaSemplice) {
      const alt = sanifica(info.famigliaSemplice);
      if (alt !== '' && !riservati.has(alt.toLowerCase())) famiglia = alt;
    }
    if (famiglia === '') { esito.errori.push({ file: fc.nome, motivo: t('Non riesco a ricavare il nome del carattere') }); continue; }
    if (riservati.has(famiglia.toLowerCase())) { esito.errori.push({ file: fc.nome, motivo: t('Esiste già un carattere chiamato «{}»', famiglia) }); continue; }
    const faccia: FacciaPersonale = {
      id: '', famiglia, peso: info?.peso ?? (/bold/i.test(fc.nome) ? 700 : 400), corsivo: info?.corsivo ?? /italic|oblique/i.test(fc.nome),
      nomeFile: fc.nome, dimensione: fc.byte.length, dati: fc.byte.buffer.slice(fc.byte.byteOffset, fc.byte.byteOffset + fc.byte.byteLength) as ArrayBuffer,
    };
    faccia.id = idFaccia(faccia);
    const sostituisce = personali.some((p) => p.id === faccia.id);
    if (!sostituisce && personali.length >= LIMITE_FACCE) { esito.errori.push({ file: fc.nome, motivo: t('Troppi caratteri personali (al massimo {} file)', LIMITE_FACCE) }); continue; }
    try { await registratore(faccia); } catch { esito.errori.push({ file: fc.nome, motivo: t('Il file non è un carattere valido') }); continue; }
    try { await deposito.salva(faccia); } catch { esito.errori.push({ file: fc.nome, motivo: t('Non riesco a salvare il carattere su questo computer') }); continue; }
    const vecchia = caricate.get(faccia.id);
    if (sostituisce) { personali = personali.filter((p) => p.id !== faccia.id); }
    personali = [...personali, faccia];
    if (sostituisce && vecchia && typeof document !== 'undefined' && document.fonts) { try { document.fonts.delete(vecchia); } catch { /* niente */ } }
    if (!esito.importati.includes(famiglia)) esito.importati.push(famiglia);
  }
  if (esito.importati.length > 0) avvisa();
  return esito;
}

/** Toglie un carattere personale (tutte le sue facce) dal computer. */
export async function rimuoviFamiglia(famiglia: string, deposito: DepositoCaratteri): Promise<void> {
  const daTogliere = personali.filter((p) => p.famiglia === famiglia);
  for (const f of daTogliere) {
    try { await deposito.elimina(f.id); } catch { /* si toglie comunque dall'elenco */ }
    const c = caricate.get(f.id);
    if (c && typeof document !== 'undefined' && document.fonts) { try { document.fonts.delete(c); } catch { /* niente */ } }
    caricate.delete(f.id);
  }
  personali = personali.filter((p) => p.famiglia !== famiglia);
  avvisa();
}

// ---------------------------------------------------------------------------------------------------------------- elenco per il menu a tendina
export interface SezioneCaratteri { titolo: string; nomi: string[] }

/** Le sezioni del menu a tendina dei caratteri: personali (se ce ne sono), di Windows, poi quelli inclusi per gruppo. Titoli in italiano (chiavi di traduzione). */
export function elencoCaratteri(): SezioneCaratteri[] {
  const sezioni: SezioneCaratteri[] = [];
  const mie = famigliePersonali().map((f) => f.famiglia);
  if (mie.length > 0) sezioni.push({ titolo: 'Personali', nomi: mie });
  sezioni.push({ titolo: 'Windows', nomi: [...CARATTERI_WINDOWS_BASE, ...[...installati].sort((a, b) => a.localeCompare(b, 'it'))] });
  for (const gruppo of ORDINE_GRUPPI) {
    const nomi = [...INCLUSI.entries()].filter(([, g]) => g === gruppo).map(([n]) => n).sort((a, b) => a.localeCompare(b, 'it'));
    if (nomi.length > 0) sezioni.push({ titolo: gruppo, nomi });
  }
  return sezioni;
}

/** Tutti i nomi, nell'ordine del menu. */
export function tuttiINomiCaratteri(): string[] { return elencoCaratteri().flatMap((s) => s.nomi); }

// ---------------------------------------------------------------------------------------------------------------- deposito sul computer (IndexedDB)
export function depositoIndexedDb(): DepositoCaratteri {
  const apri = (): Promise<IDBDatabase> => new Promise((ok, ko) => {
    const r = indexedDB.open('pmb_docs.caratteri', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('facce', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  const richiesta = <T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => apri().then((db) => new Promise<T>((ok, ko) => {
    const tr = db.transaction('facce', modo);
    const r = f(tr.objectStore('facce'));
    tr.oncomplete = () => { db.close(); ok(r.result); };
    tr.onerror = () => { db.close(); ko(tr.error); };
    tr.onabort = () => { db.close(); ko(tr.error); };
  }));
  return {
    leggi: () => richiesta<FacciaPersonale[]>('readonly', (s) => s.getAll() as IDBRequest<FacciaPersonale[]>),
    salva: async (f) => { await richiesta('readwrite', (s) => s.put(f)); },
    elimina: async (id) => { await richiesta('readwrite', (s) => s.delete(id)); },
  };
}
