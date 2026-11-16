// Dati dei menu a tendina della barra strumenti di pmb_docs e stato dei pulsanti (testi delle caselle, pulsanti accesi).
// Tutto puro: il componente docs-popup li disegna, il guscio li collega all'editor.
import {
  CARATTERE_NORMALE, CORPO_NORMALE, PASSI_CORPO, attributiParagrafo, formatoSelezione, ordina,
  type AttributiParagrafo, type Formato, type Stato, type StileParagrafo,
} from '../modello/documento';
import type { AzioneFormato } from '../editor/azioni-formato';
import { elencoCaratteri } from './caratteri';
import { t, numero } from '../i18n/lingua';

export interface VocePopup {
  etichetta: string; azione: AzioneFormato; colore?: string; attiva: boolean;
  /** se c'è, l'etichetta si scrive con questo carattere (menu dei caratteri) */
  carattere?: string;
  /** titolo di una sezione: non si può scegliere */
  intestazione?: boolean;
}
export interface Popup { tipo: 'lista' | 'tavolozza'; titolo: string; voci: VocePopup[] }
export interface StatoBarra {
  /** testi delle caselle: carattere, corpo, stile-paragrafo */
  valori: Record<string, string>;
  /** identificativi dei pulsanti da mostrare accesi */
  attivi: string[];
  formato: Formato;
  paragrafo: AttributiParagrafo;
  zoom?: number;
}

export const LIVELLI_ZOOM = [50, 75, 90, 100, 125, 150, 200];
export const NOMI_STILE: Record<StileParagrafo, string> = {
  n: 'Testo normale', t: 'Titolo', s: 'Sottotitolo', '1': 'Titolo 1', '2': 'Titolo 2', '3': 'Titolo 3',
};
export const TAVOLOZZA = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
];
const ORDINE_STILI: StileParagrafo[] = ['n', 't', 's', '1', '2', '3'];
const INTERLINEE: Array<[string, number]> = [['Singola', 1], ['1,15', 1.15], ['1,5', 1.5], ['Doppia', 2]];
/** Spazio prima e dopo il paragrafo che si propone dal menu (punti). */
export const SPAZIO_PROPOSTO = 10;

/** Pulsanti accesi e testi delle caselle per lo stato corrente dell'editor. */
export function statoBarra(stato: Stato): StatoBarra {
  const formato: Formato = stato.pendenti ?? formatoSelezione(stato.doc, stato.sel);
  const paragrafo = attributiParagrafo(stato.doc, ordina(stato.doc, stato.sel)[0]);
  const stile: StileParagrafo = paragrafo.st ?? 'n';
  const attivi: string[] = [];
  if (formato.g) attivi.push('grassetto');
  if (formato.c) attivi.push('corsivo');
  if (formato.s) attivi.push('sottolineato');
  if (formato.x === 'b') attivi.push('barrato');
  if (paragrafo.el === 'p') attivi.push('elenco-puntato');
  if (paragrafo.el === 'n') attivi.push('elenco-numerato');
  if (paragrafo.el === 't') attivi.push('elenco-attivita');
  return {
    valori: {
      'carattere': `${formato.f ?? CARATTERE_NORMALE} ▾`,
      'corpo': String(formato.z ?? CORPO_NORMALE),
      'stile-paragrafo': stile === 'n' ? 'Testo nor… ▾' : `${NOMI_STILE[stile]} ▾`,
    },
    attivi,
    formato,
    paragrafo,
  };
}

/** Il menu a tendina di un pulsante della barra, oppure null se il pulsante non ha menu. */
export function popupPerComando(id: string, s?: StatoBarra): Popup | null {
  const f: Formato = s?.formato ?? { g: false, c: false, s: false };
  const p: AttributiParagrafo = s?.paragrafo ?? {};
  switch (id) {
    case 'allineamento':
      return { tipo: 'lista', titolo: t('Allineamento'), voci: ([['Sinistra', 'sx'], ['Al centro', 'ce'], ['Destra', 'dx'], ['Giustificato', 'gi']] as const)
        .map(([etichetta, valore]) => ({ etichetta: t(etichetta), azione: { tipo: 'allinea', valore } as AzioneFormato, attiva: (p.al ?? 'sx') === valore })) };
    case 'interlinea':
      return { tipo: 'lista', titolo: t('Interlinea'), voci: INTERLINEE
        .map(([etichetta, valore]) => ({ etichetta: etichetta === 'Singola' || etichetta === 'Doppia' ? t(etichetta) : numero(valore ?? 1), azione: { tipo: 'interlinea', valore } as AzioneFormato, attiva: (p.ls ?? 1.15) === valore }))
        .concat([
          { etichetta: p.sb ? t('Togli lo spazio prima del paragrafo') : t('Aggiungi spazio prima del paragrafo ({} pt)', SPAZIO_PROPOSTO), azione: { tipo: 'spazio', chiave: 'sb', valore: p.sb ? undefined : SPAZIO_PROPOSTO } as AzioneFormato, attiva: !!p.sb },
          { etichetta: p.sa ? t('Togli lo spazio dopo il paragrafo') : t('Aggiungi spazio dopo il paragrafo ({} pt)', SPAZIO_PROPOSTO), azione: { tipo: 'spazio', chiave: 'sa', valore: p.sa ? undefined : SPAZIO_PROPOSTO } as AzioneFormato, attiva: !!p.sa },
        ]) };
    case 'stile-paragrafo':
      return { tipo: 'lista', titolo: t('Stile paragrafo'), voci: ORDINE_STILI
        .map((k) => ({ etichetta: t(NOMI_STILE[k]), azione: { tipo: 'stile', valore: k } as AzioneFormato, attiva: (p.st ?? 'n') === k })) };
    case 'carattere': {
      const voci: VocePopup[] = [];
      for (const sezione of elencoCaratteri()) {
        voci.push({ etichetta: t(sezione.titolo), azione: { tipo: 'apri-caratteri' } as unknown as AzioneFormato, attiva: false, intestazione: true });
        for (const nome of sezione.nomi) {
          voci.push({ etichetta: nome, carattere: nome, azione: { tipo: 'attributo', chiave: 'f', valore: nome === CARATTERE_NORMALE ? undefined : nome } as AzioneFormato, attiva: (f.f ?? CARATTERE_NORMALE) === nome });
        }
      }
      voci.push({ etichetta: t('Caratteri personali…'), azione: { tipo: 'apri-caratteri' } as unknown as AzioneFormato, attiva: false });
      return { tipo: 'lista', titolo: t('Carattere'), voci };
    }
    case 'corpo':
      return { tipo: 'lista', titolo: t('Corpo'), voci: PASSI_CORPO
        .map((z) => ({ etichetta: String(z), azione: { tipo: 'attributo', chiave: 'z', valore: z === CORPO_NORMALE ? undefined : z } as AzioneFormato, attiva: (f.z ?? CORPO_NORMALE) === z })) };
    case 'colore-testo':
      return { tipo: 'tavolozza', titolo: t('Colore del testo'), voci: [
        { etichetta: t('Automatico'), azione: { tipo: 'attributo', chiave: 'k', valore: undefined } as AzioneFormato, attiva: f.k === undefined },
        ...TAVOLOZZA.map((colore) => ({ etichetta: colore, colore, azione: { tipo: 'attributo', chiave: 'k', valore: colore } as AzioneFormato, attiva: f.k === colore })),
      ] };
    case 'evidenzia':
      return { tipo: 'tavolozza', titolo: t('Colore di evidenziazione'), voci: [
        { etichetta: t('Nessuno'), azione: { tipo: 'attributo', chiave: 'h', valore: undefined } as AzioneFormato, attiva: f.h === undefined },
        ...TAVOLOZZA.map((colore) => ({ etichetta: colore, colore, azione: { tipo: 'attributo', chiave: 'h', valore: colore } as AzioneFormato, attiva: f.h === colore })),
      ] };
    default:
      return null;
  }
}

/** Il popup di scelta del livello di zoom (50%, 75%, 90%, 100%, 125%, 150%, 200%). */
export function popupZoom(zoomAttuale = 100): Popup {
  return {
    tipo: 'lista',
    titolo: t('Zoom'),
    voci: LIVELLI_ZOOM.map((z) => ({
      etichetta: `${z}%`,
      azione: { tipo: 'zoom', valore: z } as unknown as AzioneFormato,
      attiva: zoomAttuale === z,
    })),
  };
}

/** Il popup della voce "Elenchi puntati e numerati" del menu Formato. */
export function popupElenchi(s?: StatoBarra): Popup {
  const el = s?.paragrafo?.el;
  return { tipo: 'lista', titolo: t('Elenchi puntati e numerati'), voci: [
    { etichetta: t('Elenco puntato'), azione: { tipo: 'elenco', elenco: 'p' } as AzioneFormato, attiva: el === 'p' },
    { etichetta: t('Elenco numerato'), azione: { tipo: 'elenco', elenco: 'n' } as AzioneFormato, attiva: el === 'n' },
    { etichetta: t('Elenco di attività'), azione: { tipo: 'elenco', elenco: 't' } as AzioneFormato, attiva: el === 't' },
  ] };
}

/** Il popup della voce "Allinea e applica rientro" del menu Formato: gli allineamenti e poi i due rientri. */
export function popupAllineaRientro(s?: StatoBarra): Popup {
  const al = s?.paragrafo?.al ?? 'sx';
  return { tipo: 'lista', titolo: t('Allinea e applica rientro'), voci: [
    ...([['Sinistra', 'sx'], ['Al centro', 'ce'], ['Destra', 'dx'], ['Giustificato', 'gi']] as const)
      .map(([etichetta, valore]) => ({ etichetta: t(etichetta), azione: { tipo: 'allinea', valore } as AzioneFormato, attiva: al === valore })),
    { etichetta: t('Riduci rientro'), azione: { tipo: 'rientro', delta: -1 } as AzioneFormato, attiva: false },
    { etichetta: t('Aumenta rientro'), azione: { tipo: 'rientro', delta: 1 } as AzioneFormato, attiva: false },
  ] };
}