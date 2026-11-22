// Azioni dell'editor di pmb_docs: dalla tastiera e dai pulsanti della barra a modifiche del documento.
// Tutto puro: nessun accesso al browser. Il componente docs-editor traduce gli eventi e chiama eseguiAzione.
import {
  alternaSegno, cancellaSelezione, cancella, collassata, estendi, estraiTesto, inserisciLineaOrizzontale, inserisciSaltoColonna, inserisciSaltoPagina, inserisciTesto, muovi, ordina,
  selezionaTutto, sposta, statoIniziale,
  type Mossa, type NomeSegno, type Posizione, type Stato,
} from '../modello/documento';
import { annulla, nuovaStoria, registra, ripeti, type Storia } from '../modello/storia';
import { cancellaConRevisione, inserisciConRevisione } from '../modello/revisioni';

export type Azione =
  | { tipo: 'testo'; testo: string }
  | { tipo: 'invio' }
  | { tipo: 'cancella'; direzione: 'indietro' | 'avanti'; parola: boolean }
  | { tipo: 'muovi'; mossa: Mossa; estendi: boolean }
  | { tipo: 'verticale'; direzione: 'su' | 'giu'; estendi: boolean }
  | { tipo: 'vai'; pos: Posizione; estendi: boolean }
  | { tipo: 'segno'; segno: NomeSegno }
  | { tipo: 'annulla' }
  | { tipo: 'ripeti' }
  | { tipo: 'selezionaTutto' }
  | { tipo: 'copia' }
  | { tipo: 'taglia' }
  | { tipo: 'incolla'; testo: string }
  | { tipo: 'saltoPagina' }
  | { tipo: 'saltoColonna' }
  | { tipo: 'lineaOrizzontale' };

export interface EventoTasto { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }
/** autore: il nome con cui si registrano le modifiche quando la registrazione è accesa (dalle preferenze). */
export interface StatoEditor { storia: Storia; ultima: string | null; autore?: string }

export function nuovoEditor(stato: Stato = statoIniziale()): StatoEditor {
  return { storia: nuovaStoria(stato), ultima: null };
}
export function statoCorrente(ed: StatoEditor): Stato { return ed.storia.presente; }

/** Traduce un tasto premuto in un'azione, oppure null se il tasto non fa niente di suo. */
export function azioneDaTasto(e: EventoTasto): Azione | null {
  const ctrl = e.ctrlKey || e.metaKey;
  const altGr = e.ctrlKey && e.altKey;
  const k = e.key;
  const sh = e.shiftKey;
  if (!ctrl || altGr) {
    if (Array.from(k).length === 1 && (!e.altKey || altGr)) return { tipo: 'testo', testo: k };
  }
  switch (k) {
    case 'Enter': return ctrl ? null : { tipo: 'invio' };
    case 'Backspace': return { tipo: 'cancella', direzione: 'indietro', parola: ctrl };
    case 'Delete': return { tipo: 'cancella', direzione: 'avanti', parola: ctrl };
    case 'ArrowLeft': return { tipo: 'muovi', mossa: ctrl ? 'parolaSinistra' : 'sinistra', estendi: sh };
    case 'ArrowRight': return { tipo: 'muovi', mossa: ctrl ? 'parolaDestra' : 'destra', estendi: sh };
    case 'Home': return { tipo: 'muovi', mossa: ctrl ? 'inizioDocumento' : 'inizioParagrafo', estendi: sh };
    case 'End': return { tipo: 'muovi', mossa: ctrl ? 'fineDocumento' : 'fineParagrafo', estendi: sh };
    case 'ArrowUp': return { tipo: 'verticale', direzione: 'su', estendi: sh };
    case 'ArrowDown': return { tipo: 'verticale', direzione: 'giu', estendi: sh };
    default: break;
  }
  if (ctrl && !e.altKey) {
    switch (k.toLowerCase()) {
      case 'b': return { tipo: 'segno', segno: 'g' };
      case 'i': return { tipo: 'segno', segno: 'c' };
      case 'u': return { tipo: 'segno', segno: 's' };
      case 'z': return sh ? { tipo: 'ripeti' } : { tipo: 'annulla' };
      case 'y': return { tipo: 'ripeti' };
      case 'a': return { tipo: 'selezionaTutto' };
      default: return null;
    }
  }
  return null;
}

/** Traduce il pulsante premuto nella barra strumenti, oppure null se non è ancora collegato. */
export function azioneDaComando(id: string): Azione | null {
  switch (id) {
    case 'grassetto': return { tipo: 'segno', segno: 'g' };
    case 'corsivo': return { tipo: 'segno', segno: 'c' };
    case 'sottolineato': return { tipo: 'segno', segno: 's' };
    case 'annulla': return { tipo: 'annulla' };
    case 'ripeti': return { tipo: 'ripeti' };
    default: return null;
  }
}

export interface Esito { ed: StatoEditor; copiato: string | null }

/** Applica un'azione. Non modifica mai l'ingresso. `copiato` è il testo da mettere negli appunti (copia e taglia). */
export function eseguiAzione(ed: StatoEditor, a: Azione): Esito {
  const st = ed.storia.presente;
  const fatto = (nuovo: Stato, unisci = false, copiato: string | null = null): Esito => ({
    ed: { ...ed, storia: registra(ed.storia, nuovo, unisci), ultima: a.tipo },
    copiato,
  });
  // registrazione delle modifiche accesa: il testo scritto si segna come inserito, quello cancellato come cancellato
  if (st.doc.revisioni) {
    const autore = ed.autore ?? '';
    if (a.tipo === 'testo') return fatto(inserisciConRevisione(st, a.testo, autore), ed.ultima === 'testo');
    if (a.tipo === 'incolla' || a.tipo === 'invio') return fatto(inserisciConRevisione(st, a.tipo === 'invio' ? '\n' : a.testo, autore));
    if (a.tipo === 'cancella') return fatto(cancellaConRevisione(st, a.direzione, a.parola, autore));
    if (a.tipo === 'taglia') return collassata(st.sel) ? fatto(st) : fatto(cancellaConRevisione(st, 'indietro', false, autore), false, estraiTesto(st.doc, st.sel));
  }
  switch (a.tipo) {
    case 'testo': return fatto(inserisciTesto(st, a.testo), ed.ultima === 'testo');
    case 'invio': return fatto(inserisciTesto(st, '\n'));
    case 'incolla': return fatto(inserisciTesto(st, a.testo));
    case 'cancella': {
      if (a.parola && collassata(st.sel)) {
        const [c] = ordina(st.doc, st.sel);
        const altro = muovi(st.doc, c, a.direzione === 'indietro' ? 'parolaSinistra' : 'parolaDestra');
        return fatto(cancellaSelezione({ ...st, sel: { ancora: c, fuoco: altro } }));
      }
      return fatto(cancella(st, a.direzione));
    }
    case 'muovi': return fatto(a.estendi ? estendi(st, a.mossa) : sposta(st, a.mossa));
    case 'vai': {
      const sel = a.estendi ? { ancora: st.sel.ancora, fuoco: a.pos } : { ancora: a.pos, fuoco: a.pos };
      return fatto({ ...st, sel, pendenti: null });
    }
    case 'segno': return fatto(alternaSegno(st, a.segno));
    case 'selezionaTutto': return fatto(selezionaTutto(st));
    case 'copia': return fatto(st, false, collassata(st.sel) ? null : estraiTesto(st.doc, st.sel));
    case 'taglia': {
      if (collassata(st.sel)) return fatto(st);
      return fatto(cancellaSelezione(st), false, estraiTesto(st.doc, st.sel));
    }
    case 'annulla': return { ed: { ...ed, storia: annulla(ed.storia), ultima: 'annulla' }, copiato: null };
    case 'ripeti': return { ed: { ...ed, storia: ripeti(ed.storia), ultima: 'ripeti' }, copiato: null };
    case 'verticale': return fatto(st);
    case 'saltoPagina': return fatto(inserisciSaltoPagina(st));
    case 'saltoColonna': return fatto(inserisciSaltoColonna(st));
    case 'lineaOrizzontale': return fatto(inserisciLineaOrizzontale(st));
  }
}
