// Azioni di formattazione dell'editor di pmb_docs: carattere, corpo, colori, allineamento, interlinea, stile,
// elenchi, rientri, Tab, cancella formattazione. Si appoggiano a azioni.ts: le azioni già esistenti passano da lì,
// salvo l'invio e la cancellazione dentro un elenco, che qui hanno il comportamento di Google Documenti.
import {
  alternaElenco, applicaParagrafo, attributiParagrafo, cambiaRientro, collassata, corpoSuccessivo, formatoSelezione,
  impostaAttributo, spazioValido, impostaBordo, type Bordo, impostaIntestazione, impostaLarghezzaImmagine, impostaPiede, inserisciImmagine, inserisciTesto, ordina, pulisciFormato, segniVuoti, testoParagrafo,
  CORPO_NORMALE,
  type Allineamento, type Immagine, type ChiaveAttributo, type Paragrafo, type Stato, type StileParagrafo, type TipoElenco,
} from '../modello/documento';
import { registra } from '../modello/storia';
import { inserisciLink, rimuoviLink } from './link';
import { attraversaCelle, cancellaSuConfine, cellaVicina, inserisciTabella, modificaTabella, svuotaSelezione, testoSelezionato, type OperazioneTabella } from './tabelle';
import { azioneDaComando, azioneDaTasto, eseguiAzione, type Azione, type Esito, type EventoTasto, type StatoEditor } from './azioni';

export type AzioneFormato =
  | Azione
  | { tipo: 'attributo'; chiave: ChiaveAttributo; valore: string | number | undefined }
  | { tipo: 'alterna'; chiave: 'x' | 'v'; valore: string }
  | { tipo: 'allinea'; valore: Allineamento }
  | { tipo: 'interlinea'; valore: number | undefined }
  | { tipo: 'spazio'; chiave: 'sb' | 'sa'; valore: number | undefined }
  | { tipo: 'bordo'; parziale: Partial<Bordo> | null }
  | { tipo: 'stile'; valore: StileParagrafo }
  | { tipo: 'elenco'; elenco: TipoElenco }
  | { tipo: 'rientro'; delta: 1 | -1 }
  | { tipo: 'tab'; indietro: boolean }
  | { tipo: 'corpo'; direzione: 1 | -1 }
  | { tipo: 'pulisci' }
  | { tipo: 'link'; url: string; testo?: string }
  | { tipo: 'togliLink' }
  | { tipo: 'immagine'; immagine: Immagine }
  | { tipo: 'larghezzaImmagine'; larghezza: number }
  | { tipo: 'tabella'; righe: number; colonne: number }
  | { tipo: 'modificaTabella'; op: OperazioneTabella }
  | { tipo: 'margini'; intestazione?: Paragrafo[]; piede?: Paragrafo[] };

export interface EventoTastoFormato extends EventoTasto { code?: string }

/** Come azioneDaTasto, con in più le scorciatoie di formattazione e il tasto Tab. */
export function azioneDaTastoFormato(e: EventoTastoFormato): AzioneFormato | null {
  const ctrl = e.ctrlKey || e.metaKey;
  const altGr = e.ctrlKey && e.altKey;
  const tasto = e.key.toLowerCase();
  if (e.key === 'Tab' && !ctrl && !e.altKey) return { tipo: 'tab', indietro: e.shiftKey };
  if (e.altKey && e.shiftKey && !ctrl && (e.code === 'Digit5' || e.key === '5' || e.key === '%')) return { tipo: 'alterna', chiave: 'x', valore: 'b' };
  if (ctrl && !e.altKey && !altGr) {
    if (e.shiftKey) {
      if (tasto === 'l') return { tipo: 'allinea', valore: 'sx' };
      if (tasto === 'e') return { tipo: 'allinea', valore: 'ce' };
      if (tasto === 'r') return { tipo: 'allinea', valore: 'dx' };
      if (tasto === 'j') return { tipo: 'allinea', valore: 'gi' };
      if (e.code === 'Digit7' || tasto === '7' || tasto === '&') return { tipo: 'elenco', elenco: 'n' };
      if (e.code === 'Digit8' || tasto === '8' || tasto === '*') return { tipo: 'elenco', elenco: 'p' };
      if (e.code === 'Period' || tasto === '>' || tasto === '.') return { tipo: 'corpo', direzione: 1 };
      if (e.code === 'Comma' || tasto === '<' || tasto === ',') return { tipo: 'corpo', direzione: -1 };
    } else {
      if (e.key === '.') return { tipo: 'alterna', chiave: 'v', valore: 'p' };
      if (e.key === ',') return { tipo: 'alterna', chiave: 'v', valore: 'd' };
      if (e.key === '\\') return { tipo: 'pulisci' };
      if (e.key === ']') return { tipo: 'rientro', delta: 1 };
      if (e.key === '[') return { tipo: 'rientro', delta: -1 };
      if (e.key === 'Enter') return { tipo: 'saltoPagina' };
    }
  }
  return azioneDaTasto(e);
}

/** Come azioneDaComando, con in più i pulsanti della barra che agiscono subito (senza menu). */
export function azioneDaComandoFormato(id: string): AzioneFormato | null {
  switch (id) {
    case 'riduci-corpo': return { tipo: 'corpo', direzione: -1 };
    case 'aumenta-corpo': return { tipo: 'corpo', direzione: 1 };
    case 'elenco-puntato': return { tipo: 'elenco', elenco: 'p' };
    case 'elenco-numerato': return { tipo: 'elenco', elenco: 'n' };
    case 'elenco-attivita': return { tipo: 'elenco', elenco: 't' };
    case 'riduci-rientro': return { tipo: 'rientro', delta: -1 };
    case 'aumenta-rientro': return { tipo: 'rientro', delta: 1 };
    case 'cancella-formattazione': return { tipo: 'pulisci' };
    case 'barrato': return { tipo: 'alterna', chiave: 'x', valore: 'b' };
    case 'apice': return { tipo: 'alterna', chiave: 'v', valore: 'p' };
    case 'pedice': return { tipo: 'alterna', chiave: 'v', valore: 'd' };
    default: return azioneDaComando(id);
  }
}

function esegueInBase(a: AzioneFormato): a is Azione {
  return !['attributo', 'alterna', 'allinea', 'interlinea', 'spazio', 'bordo', 'stile', 'elenco', 'rientro', 'tab', 'corpo', 'pulisci', 'link', 'togliLink', 'tabella', 'modificaTabella', 'immagine', 'larghezzaImmagine', 'margini'].includes(a.tipo);
}

/** Applica un'azione. Non modifica mai l'ingresso. */
export function eseguiAzioneFormato(ed: StatoEditor, a: AzioneFormato): Esito {
  const st = ed.storia.presente;
  const fatto = (nuovo: Stato): Esito => ({ ed: { storia: registra(ed.storia, nuovo), ultima: a.tipo }, copiato: null });
  const [inizio] = ordina(st.doc, st.sel);
  const attr = attributiParagrafo(st.doc, inizio);
  const vuoto = testoParagrafo(st.doc.paragrafi[inizio.p]) === '';
  const doc = st.doc;
  const senzaPendenti = (d: typeof doc): Stato => ({ ...st, doc: d, pendenti: null });

  // nelle tabelle: cancellare al bordo di una cella non unisce le celle, e una selezione su più celle si svuota senza unirle
  if (a.tipo === 'cancella' && collassata(st.sel) && cancellaSuConfine(st.doc, inizio, a.direzione)) return { ed, copiato: null };
  if (!collassata(st.sel) && attraversaCelle(st.doc, st.sel) && ['testo', 'invio', 'incolla', 'cancella', 'taglia'].includes(a.tipo)) {
    const testo = testoSelezionato(st);
    const svuotato = svuotaSelezione(st);
    if (a.tipo === 'cancella' || a.tipo === 'taglia') return { ed: { storia: registra(ed.storia, svuotato), ultima: a.tipo }, copiato: a.tipo === 'taglia' ? testo : null };
    const r = eseguiAzioneFormato({ storia: { passato: ed.storia.passato, presente: svuotato, futuro: [] }, ultima: ed.ultima }, a);
    return { ed: { storia: registra(ed.storia, r.ed.storia.presente), ultima: a.tipo }, copiato: r.copiato };
  }
  if (a.tipo === 'invio' && collassata(st.sel) && attr.el !== undefined && vuoto) {
    return fatto(senzaPendenti(applicaParagrafo(applicaParagrafo(doc, st.sel, 'el', undefined), st.sel, 'ri', undefined)));
  }
  if (a.tipo === 'invio' && collassata(st.sel) && attr.st !== undefined && inizio.o === testoParagrafo(doc.paragrafi[inizio.p]).length) {
    // a capo in fondo a un titolo: il paragrafo nuovo torna "testo normale"
    const diviso = inserisciTesto(st, '\n');
    const nuova = { p: inizio.p + 1, o: 0 };
    return fatto({ ...diviso, doc: applicaParagrafo(diviso.doc, { ancora: nuova, fuoco: nuova }, 'st', undefined) });
  }
  if (a.tipo === 'cancella' && !a.parola && a.direzione === 'indietro' && collassata(st.sel) && inizio.o === 0
    && (attr.el !== undefined || attr.ri !== undefined)) {
    return fatto(senzaPendenti(applicaParagrafo(applicaParagrafo(doc, st.sel, 'el', undefined), st.sel, 'ri', undefined)));
  }
  if (a.tipo === 'invio' && attr.el === 't' && attr.fa) {
    // a capo su una voce già spuntata: la voce nuova riparte senza spunta
    const r = eseguiAzione(ed, a as Azione);
    const s = r.ed.storia.presente;
    const nuovo = ordina(s.doc, s.sel)[0];
    return { ...r, ed: { ...r.ed, storia: { ...r.ed.storia, presente: { ...s, doc: applicaParagrafo(s.doc, { ancora: nuovo, fuoco: nuovo }, 'fa', undefined) } } } };
  }
  if (esegueInBase(a)) return eseguiAzione(ed, a);

  switch (a.tipo) {
    case 'attributo': return fatto(impostaAttributo(st, a.chiave, a.valore));
    case 'alterna': {
      const attuale = (st.pendenti ?? formatoSelezione(doc, st.sel))[a.chiave];
      return fatto(impostaAttributo(st, a.chiave, attuale === a.valore ? undefined : a.valore));
    }
    case 'allinea': return fatto(senzaPendenti(applicaParagrafo(doc, st.sel, 'al', a.valore === 'sx' ? undefined : a.valore)));
    case 'interlinea': return fatto(senzaPendenti(applicaParagrafo(doc, st.sel, 'ls', a.valore === undefined || a.valore === 1.15 ? undefined : a.valore)));
    case 'spazio': return fatto(senzaPendenti(applicaParagrafo(doc, st.sel, a.chiave, spazioValido(a.valore))));
    case 'bordo': return fatto(senzaPendenti(impostaBordo(doc, st.sel, a.parziale)));
    case 'stile': return fatto(senzaPendenti(applicaParagrafo(doc, st.sel, 'st', a.valore === 'n' ? undefined : a.valore)));
    case 'elenco': return fatto(senzaPendenti(alternaElenco(doc, st.sel, a.elenco)));
    case 'rientro': return fatto(senzaPendenti(cambiaRientro(doc, st.sel, a.delta)));
    case 'tab': {
      if (attr.tb !== undefined) {
        const nuovo = cellaVicina(st, a.indietro);
        return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
      }
      if (attr.el !== undefined) return fatto(senzaPendenti(cambiaRientro(doc, st.sel, a.indietro ? -1 : 1)));
      if (a.indietro) return { ed, copiato: null };
      return fatto(inserisciTesto(st, '\t'));
    }
    case 'corpo': {
      const z = formatoSelezione(doc, st.sel).z ?? CORPO_NORMALE;
      return fatto(impostaAttributo(st, 'z', corpoSuccessivo(z, a.direzione)));
    }
    case 'link': {
      const nuovo = inserisciLink(st, a.url, a.testo);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'togliLink': {
      const nuovo = rimuoviLink(st);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'immagine': {
      const nuovo = inserisciImmagine(st, a.immagine);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'larghezzaImmagine': {
      const nuovo = impostaLarghezzaImmagine(st, a.larghezza);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'tabella': {
      const nuovo = inserisciTabella(st, a.righe, a.colonne);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'margini': {
      // intestazione e piè di pagina nuovi (undefined li toglie); se non sono ammessi non cambia niente
      let nuovo = doc;
      try { nuovo = impostaPiede(impostaIntestazione(doc, a.intestazione), a.piede); } catch { return { ed, copiato: null }; }
      return fatto(senzaPendenti(nuovo));
    }
    case 'modificaTabella': {
      const nuovo = modificaTabella(st, a.op);
      return nuovo === st ? { ed, copiato: null } : fatto(nuovo);
    }
    case 'pulisci': {
      if (collassata(st.sel)) return fatto({ ...senzaPendenti(applicaParagrafo(doc, st.sel, 'st', undefined)), pendenti: segniVuoti() });
      return fatto(senzaPendenti(pulisciFormato(doc, st.sel)));
    }
  }
}
