// Barra degli strumenti personalizzabile (come «Personalizza» e il menu delle estensioni di Firefox).
// La barra è un elenco ordinato di identificativi: i comandi della barra (es. «grassetto»), le voci dei menu («menu:inserisci›Tabella»,
// «menu:inserisci›Grafico›A barre») e i separatori. L'elenco si salva nelle preferenze; null vuol dire «barra predefinita».
import { VOCI_BARRA } from './barra-dati';
import { MENU } from './menu-dati';
import { ICONE_DOCS } from './icone';

export const SEPARATORE = 'separatore';

export interface Funzione {
  id: string;
  /** testo italiano (si traduce dove si mostra) */
  etichetta: string;
  /** gruppo nel catalogo: «Barra» o il nome del menu */
  gruppo: string;
  /** per le voci di menu: dove sta la voce, per eseguirla come se fosse scelta dal menu */
  menu?: { menu: string; voce: string; padre?: string };
  /** true se nella barra si mostra come icona (altrimenti come testo) */
  icona: boolean;
}

/** Le voci che non hanno senso come pulsante: aprono soltanto un sottomenu. */
const idMenu = (menu: string, voce: string, padre?: string): string => `menu:${menu}›${padre ? `${padre}›` : ''}${voce}`;

let memoria: Funzione[] | null = null;
/** Tutte le funzioni che si possono mettere nella barra, nell'ordine del catalogo. */
export function catalogo(): Funzione[] {
  if (memoria) return memoria;
  const out: Funzione[] = VOCI_BARRA.map((v) => ({ id: v.id, etichetta: v.etichetta, gruppo: 'Barra degli strumenti', icona: !!ICONE_DOCS[v.id] || ['zoom', 'stile-paragrafo', 'carattere', 'corpo'].includes(v.id) }));
  for (const m of MENU) {
    for (const v of m.voci) {
      if (v.figli) {
        // anche le voci dei menu sono icone nella barra (icona scelta dal nome: iconaDi in icone.ts); prima erano testo e la barra diventava
        // una fila di scritte lunghe (segnalazione dell'utente, 2026-11-19)
        for (const f of v.figli) out.push({ id: idMenu(m.id, f.etichetta, v.etichetta), etichetta: `${v.etichetta} › ${f.etichetta}`, gruppo: m.etichetta, menu: { menu: m.id, voce: f.etichetta, padre: v.etichetta }, icona: true });
      } else {
        out.push({ id: idMenu(m.id, v.etichetta), etichetta: v.etichetta, gruppo: m.etichetta, menu: { menu: m.id, voce: v.etichetta }, icona: true });
      }
    }
  }
  memoria = out;
  return out;
}

export function funzione(id: string): Funzione | undefined { return catalogo().find((f) => f.id === id); }

/** La barra di partenza: i comandi di sempre, con i separatori dove li disegnava la barra originale. */
export function barraPredefinita(): string[] {
  const prima = new Set(['stile-paragrafo', 'carattere', 'riduci-corpo', 'grassetto', 'link', 'allineamento']);
  const out: string[] = [];
  for (const v of VOCI_BARRA) { if (prima.has(v.id)) out.push(SEPARATORE); out.push(v.id); }
  return out;
}

/** Una barra salvata ripulita: niente identificativi sconosciuti, niente doppioni (tranne i separatori), niente separatori in testa, in coda o doppi. */
export function ripulisciBarra(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const visti = new Set<string>();
  const out: string[] = [];
  for (const id of x) {
    if (typeof id !== 'string') continue;
    if (id === SEPARATORE) { if (out.length && out[out.length - 1] !== SEPARATORE) out.push(id); continue; }
    if (visti.has(id) || !funzione(id)) continue;
    visti.add(id); out.push(id);
  }
  while (out[out.length - 1] === SEPARATORE) out.pop();
  return out;
}

/** Larghezza indicativa di un elemento nella barra (px), per decidere cosa finisce sotto «⋮» quando la finestra è stretta. */
export function larghezzaElemento(id: string, etichettaMostrata = ''): number {
  if (id === SEPARATORE) return 13;
  const fisse: Record<string, number> = { 'zoom': 76, 'stile-paragrafo': 126, 'carattere': 104, 'corpo': 36 };
  if (fisse[id]) return fisse[id];
  const f = funzione(id);
  if (f && !f.icona) return Math.min(220, 20 + Math.ceil(etichettaMostrata.length * 7.2));
  return 34;
}

/** Quali elementi stanno nella barra e quali vanno sotto «⋮», data la larghezza disponibile. I separatori non vanno mai sotto «⋮». */
export function divisione(barra: string[], disponibile: number, etichetta: (id: string) => string): { visibili: string[]; nascoste: string[] } {
  const visibili: string[] = [];
  const nascoste: string[] = [];
  let usato = 0;
  for (const id of barra) {
    const w = larghezzaElemento(id, etichetta(id));
    if (nascoste.length === 0 && usato + w <= disponibile) { visibili.push(id); usato += w; }
    else if (id !== SEPARATORE) nascoste.push(id);
  }
  while (visibili[visibili.length - 1] === SEPARATORE) visibili.pop();
  return { visibili, nascoste };
}

/** Mette o toglie una funzione dalla barra (la «puntina» del pannello Funzioni). Una funzione nuova va in fondo. */
export function alternaNellaBarra(barra: string[], id: string): string[] {
  return barra.includes(id) ? ripulisciBarra(barra.filter((x) => x !== id))! : [...barra, id];
}

/** Sposta l'elemento in posizione «da» alla posizione «a» (indici nell'elenco). */
export function sposta(barra: string[], da: number, a: number): string[] {
  if (da < 0 || da >= barra.length) return barra;
  const out = [...barra];
  const [x] = out.splice(da, 1);
  out.splice(Math.max(0, Math.min(a, out.length)), 0, x);
  return ripulisciBarra(out)!;
}
