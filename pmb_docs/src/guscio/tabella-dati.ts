// Menu "Formato > Tabella" di pmb_docs: le operazioni su righe, colonne e tabella.
import type { AzioneFormato } from '../editor/azioni-formato';
import type { Popup } from './popup-dati';
import { t } from '../i18n/lingua';

export const VOCI_TABELLA: Array<[string, 'rigaSopra' | 'rigaSotto' | 'colonnaPrima' | 'colonnaDopo' | 'eliminaRiga' | 'eliminaColonna' | 'eliminaTabella']> = [
  ['Inserisci riga sopra', 'rigaSopra'],
  ['Inserisci riga sotto', 'rigaSotto'],
  ['Inserisci colonna a sinistra', 'colonnaPrima'],
  ['Inserisci colonna a destra', 'colonnaDopo'],
  ['Elimina riga', 'eliminaRiga'],
  ['Elimina colonna', 'eliminaColonna'],
  ['Elimina tabella', 'eliminaTabella'],
];

export function popupTabella(): Popup {
  return {
    tipo: 'lista',
    titolo: t('Tabella'),
    voci: VOCI_TABELLA.map(([etichetta, op]) => ({ etichetta: t(etichetta), azione: { tipo: 'modificaTabella', op } as AzioneFormato, attiva: false })),
  };
}
