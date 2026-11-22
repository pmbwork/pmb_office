// Menu "Formato > Immagine" di pmb_docs: la larghezza dell'immagine selezionata, ruotare, capovolgere, ritagliare, il testo intorno
// e come toglierla.
import type { AzioneFormato } from '../editor/azioni-formato';
import type { Popup, VocePopup } from './popup-dati';
import { LARGHEZZA_TESTO, type Immagine } from '../modello/documento';
import { t } from '../i18n/lingua';

export const LARGHEZZE_IMMAGINE: Array<[string, number]> = [['Piccola (150 px)', 150], ['Media (300 px)', 300], ['Larghezza del testo', LARGHEZZA_TESTO]];
export const TRASFORMAZIONI_IMMAGINE: Array<[string, string]> = [
  ['Ruota a destra di 90°', 'ruotaDestra'], ['Ruota a sinistra di 90°', 'ruotaSinistra'],
  ['Capovolgi in orizzontale', 'capovolgiOrizzontale'], ['Capovolgi in verticale', 'capovolgiVerticale'],
];
export const DISPOSIZIONI_IMMAGINE: Array<[string, 'sx' | 'dx' | undefined]> = [
  ['In linea con il testo', undefined], ['Testo intorno, immagine a sinistra', 'sx'], ['Testo intorno, immagine a destra', 'dx'],
];

/** im = l'immagine selezionata (per spuntare come sta rispetto al testo). */
export function popupImmagine(im?: Immagine | null): Popup {
  const voce = (etichetta: string, azione: unknown, attiva = false): VocePopup => ({ etichetta: t(etichetta), azione: azione as AzioneFormato, attiva });
  return {
    tipo: 'lista',
    titolo: t('Immagine'),
    voci: [
      ...LARGHEZZE_IMMAGINE.map(([etichetta, larghezza]) => voce(etichetta, { tipo: 'larghezzaImmagine', larghezza })),
      ...TRASFORMAZIONI_IMMAGINE.map(([etichetta, op]) => voce(etichetta, { tipo: 'trasforma-immagine', op })),
      voce('Ritaglia…', { tipo: 'apri-ritaglio' }),
      voce('Testo alternativo…', { tipo: 'apri-testo-alternativo' }),
      ...DISPOSIZIONI_IMMAGINE.map(([etichetta, a]) => voce(etichetta, { tipo: 'disposizioneImmagine', a }, !!im && im.a === a)),
      voce('Elimina immagine', { tipo: 'cancella', direzione: 'indietro', parola: false }),
    ],
  };
}
