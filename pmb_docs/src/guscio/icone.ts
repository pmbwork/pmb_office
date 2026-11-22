// Icone della barra strumenti di pmb_docs: sono quelle COMUNI della suite (comune/src/icone.ts), uguali a pmb_sheets per le stesse funzioni
// (regola del progetto: progetti/pmb_office/REGOLE.md). Qui solo il collegamento comando → icona, nella stessa misura di pmb_sheets (18 px).
// Zoom, stile-paragrafo, carattere e corpo sono caselle di testo, non icone.
// Marcatore: ICONE_DOCS_T026
import { ICONE, iconaDiMisura } from '@comune/icone';
import { iconaFunzione } from '@comune/icone-funzioni';

const LATO = 18;
const di = (svg: string): string => iconaDiMisura(svg, LATO);

export const ICONE_DOCS: Record<string, string> = {
  'cerca': di(ICONE.search),
  'annulla': di(ICONE.undo),
  'ripeti': di(ICONE.redo),
  'stampa': di(ICONE.print),
  'ortografia': di(ICONE.spellcheck),
  'copia-formato': di(ICONE.formatPainter),
  'riduci-corpo': di(ICONE.remove),
  'aumenta-corpo': di(ICONE.add),
  'grassetto': di(ICONE.bold),
  'corsivo': di(ICONE.italic),
  'sottolineato': di(ICONE.underline),
  'barrato': di(ICONE.strike),
  'colore-testo': di(ICONE.textColor),
  // l'evidenziatore è il colore di sfondo del testo: la stessa icona del colore di sfondo della cella in pmb_sheets
  'evidenzia': di(ICONE.highlight),
  'link': di(ICONE.link),
  'immagine': di(ICONE.image),
  'allineamento': di(ICONE.alignLeft),
  'interlinea': di(ICONE.lineSpacing),
  'elenco-attivita': di(ICONE.checklist),
  'elenco-puntato': di(ICONE.listBullets),
  'elenco-numerato': di(ICONE.listNumbers),
  'riduci-rientro': di(ICONE.indentDecrease),
  'aumenta-rientro': di(ICONE.indentIncrease),
  'cancella-formattazione': di(ICONE.clearFormatting),
  'funzioni': di(ICONE.extension),
};

/** L'icona di una funzione della barra: quella del comando se c'è, altrimenti (voci dei menu) quella scelta dal nome con la regola comune
 *  della suite (comune/src/icone-funzioni.ts). Così una voce di menu messa nella barra è un pulsante a icona, non una scritta. */
export function iconaDi(f: { id: string; etichetta: string; menu?: unknown }): string {
  // le caselle (zoom, stile, carattere, corpo) non hanno icona: si mostrano col loro testo
  return ICONE_DOCS[f.id] ?? (f.menu ? di(iconaFunzione(f.etichetta)) : '');
}
