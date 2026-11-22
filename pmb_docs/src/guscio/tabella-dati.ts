// Menu "Formato > Tabella" di pmb_docs: le operazioni su righe, colonne, celle e tabella.
import type { AzioneFormato } from '../editor/azioni-formato';
import type { OperazioneTabella } from '../editor/tabelle';
import type { Popup } from './popup-dati';
import { t } from '../i18n/lingua';

export const VOCI_TABELLA: Array<[string, OperazioneTabella]> = [
  ['Inserisci riga sopra', 'rigaSopra'],
  ['Inserisci riga sotto', 'rigaSotto'],
  ['Inserisci colonna a sinistra', 'colonnaPrima'],
  ['Inserisci colonna a destra', 'colonnaDopo'],
  ['Elimina riga', 'eliminaRiga'],
  ['Elimina colonna', 'eliminaColonna'],
  ['Unisci celle', 'unisciCelle'],
  ['Dividi cella', 'dividiCella'],
  ['Ripeti come riga di intestazione', 'intestazione'],
  ['Ordina righe dalla A alla Z', 'ordinaCrescente'],
  ['Ordina righe dalla Z alla A', 'ordinaDecrescente'],
  ['Elimina tabella', 'eliminaTabella'],
];

/** intestazione = il cursore è in una riga di intestazione (la voce si mostra spuntata). */
export function popupTabella(intestazione = false): Popup {
  return {
    tipo: 'lista',
    titolo: t('Tabella'),
    voci: VOCI_TABELLA.map(([etichetta, op]) => ({ etichetta: t(etichetta), azione: { tipo: 'modificaTabella', op } as AzioneFormato, attiva: op === 'intestazione' && intestazione })),
  };
}
