// Barra degli strumenti personalizzabile per pmb_sheets (come in pmb_docs).
// La barra è un elenco ordinato di identificativi: i comandi della barra (es. «bold»), le voci dei menu («menu:file›Salva») e i separatori.
// L'elenco si salva nelle impostazioni utente; null indica «barra predefinita».

import { sheetToolbar } from '../registry/toolbars';
import { menuRegistry } from '../registry/menu';

export const SEPARATORE = 'separatore';

export interface Funzione {
  id: string;
  /** Testo descrittivo italiano */
  etichetta: string;
  /** Gruppo nel catalogo: nome del gruppo barra o della categoria di menu */
  gruppo: string;
  /** Per le voci di menu: azione associata */
  azione?: string;
  /** Icona SVG opzionale */
  icona?: string;
  /** True se è una select (es. carattere, dimensione, formati) */
  tipoSelect?: boolean;
}

let memoriaCatalogo: Funzione[] | null = null;

/** Tutte le funzioni che si possono collocare nella barra degli strumenti, nell'ordine del catalogo. */
export function catalogo(): Funzione[] {
  if (memoriaCatalogo) return memoriaCatalogo;
  const out: Funzione[] = [];

  // 1. Elementi della toolbar di fogli
  for (const group of sheetToolbar) {
    const nomeGruppo = group.label || 'Barra degli strumenti';
    for (const item of group.items) {
      out.push({
        id: item.id,
        etichetta: item.label,
        gruppo: nomeGruppo,
        azione: item.action,
        icona: item.icon,
        tipoSelect: item.type === 'select',
      });
    }
  }

  // 2. Voci del registro menu
  for (const cat of menuRegistry) {
    for (const item of cat.items) {
      if (item.separator) continue;
      if (item.subitems && item.subitems.length > 0) {
        for (const sub of item.subitems) {
          if (sub.separator) continue;
          out.push({
            id: `menu:${cat.id}›${item.id}›${sub.id}`,
            etichetta: `${item.label} › ${sub.label}`,
            gruppo: `Menu ${cat.label}`,
            azione: sub.action,
          });
        }
      } else if (item.action) {
        out.push({
          id: `menu:${cat.id}›${item.id}`,
          etichetta: item.label,
          gruppo: `Menu ${cat.label}`,
          azione: item.action,
        });
      }
    }
  }

  memoriaCatalogo = out;
  return out;
}

export function funzione(id: string): Funzione | undefined {
  return catalogo().find((f) => f.id === id);
}

/** La barra di partenza: tutti gli elementi standard con i separatori tra i gruppi. */
export function barraPredefinita(): string[] {
  const out: string[] = [];
  for (let i = 0; i < sheetToolbar.length; i++) {
    const group = sheetToolbar[i];
    if (i > 0) out.push(SEPARATORE);
    for (const item of group.items) {
      out.push(item.id);
    }
  }
  return out;
}

/** Una barra salvata ripulita: niente identificativi sconosciuti, niente doppioni (tranne i separatori), niente separatori multipli o alle estremità. */
export function ripulisciBarra(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const visti = new Set<string>();
  const out: string[] = [];

  for (const id of x) {
    if (typeof id !== 'string') continue;
    if (id === SEPARATORE) {
      if (out.length > 0 && out[out.length - 1] !== SEPARATORE) {
        out.push(id);
      }
      continue;
    }
    if (visti.has(id) || !funzione(id)) continue;
    visti.add(id);
    out.push(id);
  }

  while (out.length > 0 && out[0] === SEPARATORE) out.shift();
  while (out.length > 0 && out[out.length - 1] === SEPARATORE) out.pop();
  return out;
}

/** Sposta un elemento da un indice a un altro. */
export function spostaElementoBarra(barra: string[], da: number, a: number): string[] {
  if (da < 0 || da >= barra.length) return barra;
  const out = [...barra];
  const [x] = out.splice(da, 1);
  out.splice(Math.max(0, Math.min(a, out.length)), 0, x);
  return ripulisciBarra(out) ?? [];
}

/** Calcola la larghezza stimata di un elemento nella toolbar (px) per il calcolo dell'overflow. */
export function larghezzaElementoBarra(id: string): number {
  if (id === SEPARATORE) return 14;
  if (id === 'number-format-select') return 130;
  if (id === 'font-family') return 110;
  if (id === 'font-size') return 60;
  if (id === 'borders-select') return 120;
  if (id === 'border-style-select') return 100;
  const f = funzione(id);
  if (f && f.id.startsWith('menu:')) {
    return Math.min(200, 24 + Math.ceil(f.etichetta.length * 7.5));
  }
  return 32;
}

/** Mette o toglie una funzione dalla barra (la «puntina» del pannello Funzioni, come in pmb_docs). Una funzione nuova va in fondo. */
export function alternaNellaBarra(barra: string[], id: string): string[] {
  return barra.includes(id) ? (ripulisciBarra(barra.filter((x) => x !== id)) ?? []) : [...barra, id];
}
