// Menu "Formato > Immagine" di pmb_docs: la larghezza dell'immagine selezionata e come toglierla.
import type { AzioneFormato } from '../editor/azioni-formato';
import type { Popup } from './popup-dati';
import { LARGHEZZA_TESTO } from '../modello/documento';
import { t } from '../i18n/lingua';

export const LARGHEZZE_IMMAGINE: Array<[string, number]> = [['Piccola (150 px)', 150], ['Media (300 px)', 300], ['Larghezza del testo', LARGHEZZA_TESTO]];

export function popupImmagine(): Popup {
  return {
    tipo: 'lista',
    titolo: t('Immagine'),
    voci: [
      ...LARGHEZZE_IMMAGINE.map(([etichetta, larghezza]) => ({ etichetta: t(etichetta), azione: { tipo: 'larghezzaImmagine', larghezza } as AzioneFormato, attiva: false })),
      { etichetta: t('Elimina immagine'), azione: { tipo: 'cancella', direzione: 'indietro', parola: false } as AzioneFormato, attiva: false },
    ],
  };
}
